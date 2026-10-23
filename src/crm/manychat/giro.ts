/** ── IL GIRO A ORARIO ──────────────────────────────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat), compito 3 (Dev C). Le prove
 *  stanno in `prove/manychat/giro.mjs` (database e ManyChat finti); le porte
 *  vere in `porte.server.ts` (`porteGiro`); la rotta in `hooks/manychat-giro`.
 *
 *  pg_cron chiama `/hooks/manychat-giro` ogni minuto. Il giro (PIANO §4.3):
 *   1. prende il lucchetto da 120 s; se non lo prende, esce;
 *   2. controlla migrazione, configurazione, chiave, `user_id` e fermo in corso;
 *   3. registra «Non ha risposto» sulle schede scadute (`dopoScadenza`);
 *   4. AL MASSIMO 2 invii per giro: prima i promemoria nella finestra, poi al
 *      massimo UN ricontatto; dopo 20 s dall'inizio non ne apre un altro;
 *   5. per ogni invio: `manychat_prenota_giro` (tetti, ritmo, pausa, chiave sul
 *      telefono, STOP) → rilegge la scheda e rifà la decisione → contatto →
 *      campi → tag → `sendFlow` → esito → `contattoWa` → `whatsapp_messages`;
 *   6. errore incerto o tempo scaduto: la riga resta `prenotato`, dopo 10'
 *      diventa `incerto`, e non si rimanda mai;
 *   7. 2 falliti di fila, o un `blocco` → `acceso = false` col motivo;
 *   8. scrive `ultimo_giro_il` e lo stato, e lascia il lucchetto.
 *
 *  `prova: true` = prova a secco: nessuna scrittura e nessuna chiamata a
 *  ManyChat (niente lucchetto, niente scadenze, niente stato), e gli
 *  interruttori non contano: serve a vedere chi verrebbe scritto PRIMA di
 *  accendere. Il giro non accetta mai `prova` da una richiesta pubblica: la
 *  rotta del cron passa sempre `prova: false`.
 *
 *  ── COME SI USA LA PORTA DEGLI INVII ──────────────────────────────────────
 *  L'invio vero è `inviaWhatsapp` di `porta.ts` (contatto, campi, `sendFlow`,
 *  riga in `whatsapp_messages`). Il giro gli passa le SUE porte: la
 *  prenotazione è `manychat_prenota_giro` (tetti e ritmo compresi, al posto di
 *  `manychat_prenota_porta`), e subito dopo la prenotazione il giro rilegge la
 *  scheda e rifà la decisione. Il tag (`crm-promemoria` / `crm-ricontatto`) si
 *  aggiunge subito prima di `sendFlow`, senza che un suo errore fermi l'invio.
 *
 *  ⚠️ Nei log solo codici: mai numero, nome, chiavi o testi. Lo stato che il
 *   giro lascia (`manychat_giro.stato`) ha nomi abbreviati («Mario R.») e id
 *   di scheda, mai il telefono: lo legge solo il server.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { Consultant } from "../types";
import { aRoma } from "../promemoria/formati";
import type { ClientManychat } from "./api";
import {
  dopoInvio,
  dopoRifiuto,
  dopoRisposta,
  dopoScadenza,
  type CambioContatto,
} from "./contatto";
import { inviaWhatsapp, type PortePorta, type PrenotazionePorta } from "./porta";
import {
  ANTICIPO_PROMEMORIA_MIN,
  codaRicontatti,
  decidiPromemoria,
  intervalloRicontatto,
  tettiDelGiorno,
  type DecisioneQuando,
  type SchedaQuando,
  type Tetti,
} from "./quando";
import { STATI_ARRIVATI, numeroWa, type InvioPerFreno } from "./regole";
import { campiPromemoria, campiRicontatto } from "./testi";

/** I modelli approvati da Meta, e i flussi di ManyChat che li mandano: il nome
 *  del modello è la chiave in `manychat_config.flussi`. */
export const MODELLO_PROMEMORIA = "hgl_promemoria_meet";
export const MODELLO_RICONTATTO = "hgl_ricontatto_consulenza";
/** I tag per ritrovare in ManyChat chi ha ricevuto cosa. */
export const TAG_PROMEMORIA = "crm-promemoria";
export const TAG_RICONTATTO = "crm-ricontatto";

/** Il lucchetto: più della durata massima del giro (45 s). */
export const LUCCHETTO_S = 120;
/** Al massimo due invii per giro, e di questi al massimo un ricontatto. */
export const MAX_INVII_PER_GIRO = 2;
export const MAX_RICONTATTI_PER_GIRO = 1;
/** Dopo tanto dall'inizio del giro non se ne apre un altro: ogni invio fa fino
 *  a 6 chiamate da 8 s, e il cron aspetta 45 s. */
export const TEMPO_GIRO_MS = 20_000;
/** Quanti invii falliti uno dopo l'altro spengono tutto. */
export const FALLITI_DI_FILA_MAX = 2;
/** Prenotazioni tentate in un giro, anche se rifiutate (pausa, STOP…): un
 *  giro non deve scorrere tutta la coda. */
export const MAX_TENTATIVI_PER_GIRO = 6;
/** Quanti giorni di registro legge il giro: il freno scade dopo 7. */
export const GIORNI_REGISTRO = 8;
/** Gli ultimi problemi che il giro tiene per il riquadro. */
export const MAX_PROBLEMI = 20;
/** Quante schede scadute il giro chiude per volta (il resto al giro dopo). */
const MAX_SCADUTE_PER_GIRO = 50;

/** ── LA CHIAVE DEL GIRO ────────────────────────────────────────────────────
 *  La rotta accetta ESATTAMENTE `Bearer <chiave pubblicabile>` o
 *  `Bearer <chiave anon>` (come le manda pg_cron), con gli spazi tolti da
 *  tutte e due le parti. Non protegge niente — sono chiavi pubbliche — e lo
 *  diciamo: la protezione vera sta nella prenotazione atomica e nel fatto che
 *  il giro non accetta mai `prova`. Non è un `includes`: una stringa più lunga
 *  che CONTIENE la chiave non passa. */
export function chiaveGiroValida(
  autorizzazione: string | null | undefined,
  pubblicabile: string | null | undefined,
  anon: string | null | undefined,
): boolean {
  const ricevuta = String(autorizzazione ?? "").trim();
  if (!ricevuta) return false;
  return [pubblicabile, anon].some((k) => {
    const chiave = String(k ?? "").trim();
    return chiave !== "" && ricevuta === `Bearer ${chiave}`;
  });
}

/** I conteggi che il giro lascia al riquadro (mai nomi né numeri). */
export interface EsitoGiroManychat {
  /** perché il giro non ha fatto niente, se è così: `lucchetto`, `spento`,
   *  `senza_migrazione`, `senza_configurazione`, `canale`, `senza_chiave`,
   *  `errore`… */
  fermo?: string;
  promemoriInviati: number;
  ricontattiInviati: number;
  saltati: number;
  incerti: number;
  /** schede passate a «Non ha risposto» in questo giro */
  scadute: number;
  /** vero se un blocco ha spento l'interruttore generale */
  spento?: boolean;
  /** solo nella prova a secco: una riga per scheda toccata dalla decisione */
  righe?: RigaGiro[];
}

/** Una riga della prova a secco (stessa forma di `RigaProva` del riquadro). */
export interface RigaGiro {
  /** nome abbreviato («Mario R.») */
  nome: string;
  tipo: "promemoria" | "ricontatto";
  esito: "scriverebbe" | "aspetta" | "salta";
  motivo: string;
}

/** Un problema per il riquadro. `scheda` serve a non scriverlo due volte e non
 *  esce mai dal server. */
export interface ProblemaGiroSalvato {
  il: string;
  nome: string;
  tipo: "promemoria" | "ricontatto";
  motivo: string;
  scheda: string;
}

/** Quello che il giro lascia in `manychat_giro.stato` (jsonb). */
export interface StatoGiroSalvato {
  /** l'ultimo messaggio automatico partito */
  ultimoInvioIl: string | null;
  /** conteggi del giorno di oggi (Roma) */
  oggi: { promemoria: number; ricontatti: number; risposte: number };
  problemi: ProblemaGiroSalvato[];
  /** una frase se il giro ha trovato un limite (tetto, ritmo, flusso mancante) */
  nota: string | null;
  /** perché l'ultimo giro non ha fatto niente (`spento`, `senza_chiave`…) */
  fermo: string | null;
}

/** La riga `manychat_config`. */
export interface ConfigGiro {
  userId: string;
  canale: "cloud" | "manychat";
  acceso: boolean;
  promemoria: boolean;
  ricontatti: boolean;
  /** i tetti del riquadro: l'SQL e `tettiDelGiorno` li riportano comunque alle costanti */
  tetti: Partial<Tetti>;
  flussi: Record<string, string>;
  primaAccensione: string | null;
  ultimaAccensione: string | null;
}

/** La riga `manychat_giro`. */
export interface RigaGiroDb {
  prossimoRicontattoDopo: string | null;
  falliti: number;
  stato: Partial<StatoGiroSalvato>;
}

/** Cosa si chiede all'SQL per prenotare un invio del giro. */
export interface PrenotazioneGiro extends PrenotazionePorta {
  tipo: "promemoria" | "ricontatto";
  /** ISO: promemoria = il momento a cui puntava (−25' dal meet) */
  previstoIl: string | null;
}

export interface PorteGiro {
  adesso(): Date;
  /** un numero fra 0 e 1 (`Math.random` nelle porte vere, fisso nelle prove) */
  caso(): number;
  /** solo codici: mai numero, nome, chiavi o testi */
  avviso(codice: string): void;
  /** `senza_migrazione` = le funzioni di M2 non ci sono ancora */
  prendiLucchetto(secondi: number): Promise<"preso" | "occupato" | "senza_migrazione">;
  lasciaLucchetto(): Promise<void>;
  leggiConfig(): Promise<ConfigGiro | { fermo: "senza_migrazione" | "senza_configurazione" }>;
  leggiGiro(): Promise<RigaGiroDb>;
  /** c'è `MANYCHAT_API_KEY` fra i segreti? */
  chiaveManychat(): boolean;
  consulenti(userId: string): Promise<Pick<Consultant, "id" | "data">[]>;
  /** le schede che il giro può dover toccare: appuntamenti di oggi in poi e
   *  schede nei tre stati dei ricontatti */
  schede(userId: string, oggi: string): Promise<SchedaQuando[]>;
  /** le schede con il secondo stato «In attesa» */
  schedeInAttesa(userId: string): Promise<SchedaQuando[]>;
  /** una scheda riletta; `null` se non c'è */
  scheda(userId: string, id: string): Promise<SchedaQuando | null>;
  /** il registro degli ultimi giorni, per i freni */
  invii(userId: string, dal: Date): Promise<InvioPerFreno[]>;
  /** `manychat_prenota_giro` */
  prenota(
    userId: string,
    p: PrenotazioneGiro,
    tetti: Partial<Tetti>,
    intervalloMin: number,
  ): Promise<{ id: string } | { motivo: string }>;
  /** `manychat_giro_annulla`: la riga diventa «saltato» e perde la chiave */
  annulla(userId: string, invioId: string, motivo: string): Promise<void>;
  /** `contatto_wa_aggiorna`; vero se ha scritto */
  aggiornaContatto(
    userId: string,
    leadId: string,
    cambio: CambioContatto,
    seInvio?: string,
  ): Promise<boolean>;
  /** le porte della porta degli invii (client ManyChat, flussi, registro,
   *  `whatsapp_messages`); la prenotazione la sostituisce il giro */
  porta(userId: string, config: ConfigGiro): PortePorta;
  /** `acceso = false` col motivo, e il conteggio dei falliti a zero */
  spegni(motivo: string): Promise<void>;
  scriviGiro(r: { ultimoGiroIl: Date; falliti: number; stato: StatoGiroSalvato }): Promise<void>;
}

const vuoto = (): EsitoGiroManychat => ({
  promemoriInviati: 0,
  ricontattiInviati: 0,
  saltati: 0,
  incerti: 0,
  scadute: 0,
});

/** Solo il codice di un errore, se sembra un codice: il messaggio può contenere
 *  dati del cliente. */
function codiceErrore(e: unknown): string {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === "string" && /^[A-Za-z0-9_]{1,12}$/.test(code) ? code : "?";
}

/** «Mario R.»: il nome e l'iniziale del cognome. Mai il telefono. */
export function nomeAbbreviato(d: { nome?: string; cognome?: string } | null | undefined): string {
  const nome = String(d?.nome ?? "")
    .trim()
    .split(/\s+/)[0];
  const cognome = String(d?.cognome ?? "").trim();
  const iniziale = cognome ? `${Array.from(cognome)[0].toUpperCase()}.` : "";
  return [nome, iniziale].filter(Boolean).join(" ") || "senza nome";
}

/** I messaggi automatici di oggi (Roma) che possono essere arrivati. */
function contaOggi(invii: InvioPerFreno[], oggi: string, tipo: InvioPerFreno["tipo"]) {
  return invii.filter((i) => {
    if (i.tipo !== tipo || !STATI_ARRIVATI.includes(i.stato)) return false;
    const t = Date.parse(i.prenotatoIl);
    return Number.isFinite(t) && aRoma(new Date(t)).giorno === oggi;
  }).length;
}
function contaRisposteOggi(invii: InvioPerFreno[], oggi: string) {
  return invii.filter((i) => {
    const t = i.rispostaIl ? Date.parse(i.rispostaIl) : Number.NaN;
    return Number.isFinite(t) && aRoma(new Date(t)).giorno === oggi;
  }).length;
}

/** Aggiunge i problemi nuovi in testa, senza ripetere quelli già scritti per
 *  la stessa scheda, lo stesso tipo e lo stesso motivo, e tiene gli ultimi 20. */
function unisciProblemi(
  prima: ProblemaGiroSalvato[],
  nuovi: ProblemaGiroSalvato[],
): ProblemaGiroSalvato[] {
  const chiave = (p: ProblemaGiroSalvato) => `${p.scheda}|${p.tipo}|${p.motivo}`;
  const visti = new Set(prima.map(chiave));
  const veri: ProblemaGiroSalvato[] = [];
  for (const p of nuovi) {
    if (visti.has(chiave(p))) continue;
    visti.add(chiave(p));
    veri.push(p);
  }
  return [...veri, ...prima].slice(0, MAX_PROBLEMI);
}

/** Il client di ManyChat con una cosa in più: prima di `sendFlow` mette il tag.
 *  Un errore del tag non ferma l'invio (il tag serve solo a ritrovare le
 *  persone in ManyChat). */
function conTag(client: ClientManychat | null, tag: string): ClientManychat | null {
  if (!client) return null;
  return {
    ...client,
    mandaFlusso: async (subscriberId, flowNs) => {
      await client.aggiungiTag(subscriberId, tag).catch(() => undefined);
      return client.mandaFlusso(subscriberId, flowNs);
    },
  };
}

type Candidato =
  | {
      tipo: "promemoria";
      d: Extract<DecisioneQuando<{ inizioMeet: Date }>, { tipo: "invia" }>;
    }
  | {
      tipo: "ricontatto";
      d: Extract<DecisioneQuando<{ giorno: string; recupero: boolean }>, { tipo: "invia" }>;
    };

/** Come è andato un tentativo di invio. */
type Tentativo =
  | { fine: "inviato" }
  | { fine: "continua" }
  | { fine: "ricontatti_chiusi" }
  | { fine: "tutto_chiuso" }
  | { fine: "ferma" };

/** Il giro. Non lancia: ogni guasto è un `fermo` o un conteggio. */
export async function giroManychat(
  porte: PorteGiro,
  o: { prova: boolean },
): Promise<EsitoGiroManychat> {
  if (o.prova) {
    try {
      return await lavora(porte, true);
    } catch (e) {
      porte.avviso(`giro_prova_errore_${codiceErrore(e)}`);
      return { ...vuoto(), fermo: "errore" };
    }
  }
  let lucchetto: "preso" | "occupato" | "senza_migrazione";
  try {
    lucchetto = await porte.prendiLucchetto(LUCCHETTO_S);
  } catch (e) {
    porte.avviso(`giro_lucchetto_errore_${codiceErrore(e)}`);
    return { ...vuoto(), fermo: "errore" };
  }
  if (lucchetto === "occupato") return { ...vuoto(), fermo: "lucchetto" };
  if (lucchetto === "senza_migrazione") return { ...vuoto(), fermo: "senza_migrazione" };
  try {
    return await lavora(porte, false);
  } catch (e) {
    porte.avviso(`giro_errore_${codiceErrore(e)}`);
    return { ...vuoto(), fermo: "errore" };
  } finally {
    await porte.lasciaLucchetto().catch(() => porte.avviso("giro_lucchetto_non_lasciato"));
  }
}

async function lavora(porte: PorteGiro, prova: boolean): Promise<EsitoGiroManychat> {
  const inizio = porte.adesso();
  const esito = vuoto();

  //  2. migrazione, configurazione, chiave, installazione, interruttori.
  const letta = await porte.leggiConfig();
  if ("fermo" in letta) return { ...esito, fermo: letta.fermo };
  const config = letta;
  const giro = await porte.leggiGiro();
  const statoPrima = giro.stato ?? {};

  /** Un giro che non fa niente lascia comunque l'ora: «nessun giro da più di 5
   *  minuti» deve scattare solo se il cron è fermo davvero. */
  const fermoCon = async (fermo: string): Promise<EsitoGiroManychat> => {
    if (!prova) {
      await porte.scriviGiro({
        ultimoGiroIl: porte.adesso(),
        falliti: giro.falliti,
        stato: { ...statoVuoto(), ...statoPrima, fermo },
      });
    }
    return { ...esito, fermo };
  };
  if (config.canale !== "manychat") return fermoCon("canale");
  if (!prova) {
    if (!config.acceso || (!config.promemoria && !config.ricontatti)) return fermoCon("spento");
    if (!porte.chiaveManychat()) return fermoCon("senza_chiave");
  }

  //  Quello che serve a decidere, letto una volta.
  const userId = config.userId;
  const adesso = porte.adesso();
  const oggi = aRoma(adesso).giorno;
  const consulenti = await porte.consulenti(userId);
  const [schede, inAttesa, registro] = await Promise.all([
    porte.schede(userId, oggi),
    porte.schedeInAttesa(userId),
    porte.invii(userId, new Date(adesso.getTime() - GIORNI_REGISTRO * 86_400_000)),
  ]);
  /** L'istantanea del registro: ogni invio del giro ci si aggiunge, così le
   *  decisioni dopo il primo invio vedono pausa, tetti e freno aggiornati. */
  const invii: InvioPerFreno[] = [...registro];
  const tetti = tettiDelGiorno(config.tetti, config.primaAccensione, adesso);
  const prossimoDopo = giro.prossimoRicontattoDopo ? new Date(giro.prossimoRicontattoDopo) : null;

  //  3. «Non ha risposto» sulle schede scadute.
  if (!prova) {
    for (const s of inAttesa.slice(0, MAX_SCADUTE_PER_GIRO)) {
      const prima = s.data.contattoWa;
      const cambio = dopoScadenza(prima, adesso);
      if (!cambio || !prima?.invioId) continue;
      try {
        if (await porte.aggiornaContatto(userId, s.id, cambio, prima.invioId)) esito.scadute++;
      } catch (e) {
        porte.avviso(`giro_scadenza_errore_${codiceErrore(e)}`);
      }
    }
  }

  //  Le decisioni. Gli interruttori contano solo nel giro vero.
  const promemoriaOn = prova || config.promemoria;
  const ricontattiOn = prova || config.ricontatti;
  const decP = promemoriaOn ? decidiPromemoria(schede, adesso, { consulenti, invii, tetti }) : [];
  const decR = ricontattiOn
    ? codaRicontatti(schede, adesso, config.ultimaAccensione, {
        consulenti,
        invii,
        tetti,
        prossimoDopo,
      })
    : [];

  const nomeDi = (s: SchedaQuando) => nomeAbbreviato(s.data);
  const problemi: ProblemaGiroSalvato[] = [];
  const problema = (s: SchedaQuando, tipo: "promemoria" | "ricontatto", motivo: string) =>
    problemi.push({ il: adesso.toISOString(), nome: nomeDi(s), tipo, motivo, scheda: s.id });
  //  STOP non è un problema: è quello che il cliente ha chiesto.
  for (const d of decP)
    if (d.tipo === "salta" && d.motivo !== "STOP") problema(d.scheda, "promemoria", d.motivo);
  for (const d of decR)
    if (d.tipo === "salta" && d.motivo !== "STOP") problema(d.scheda, "ricontatto", d.motivo);

  //  La prova a secco si ferma qui: nessuna scrittura, nessuna chiamata.
  if (prova) {
    const righe: RigaGiro[] = [];
    let promemoriaDelGiro = 0;
    let ricontattoDelGiro = 0;
    const riga = (d: DecisioneQuando<unknown>, tipo: "promemoria" | "ricontatto") => {
      if (d.tipo === "invia") {
        const posto =
          tipo === "promemoria"
            ? ++promemoriaDelGiro <= MAX_INVII_PER_GIRO
            : ++ricontattoDelGiro <= MAX_RICONTATTI_PER_GIRO;
        righe.push({
          nome: nomeDi(d.scheda),
          tipo,
          esito: posto ? "scriverebbe" : "aspetta",
          motivo: posto ? "tocca adesso" : "ne parte uno per giro: al prossimo giro",
        });
      } else {
        righe.push({ nome: nomeDi(d.scheda), tipo, esito: d.tipo, motivo: d.motivo });
      }
    };
    decP.forEach((d) => riga(d, "promemoria"));
    decR.forEach((d) => riga(d, "ricontatto"));
    return { ...esito, saltati: righe.filter((r) => r.esito === "salta").length, righe };
  }

  //  I flussi: un modello senza flusso non parte, e lo dice.
  let nota: string | null = null;
  const candidati: Candidato[] = [];
  const senzaFlusso = (modello: string, nomeModello: string) => {
    if (config.flussi[modello]) return false;
    nota = `Il flusso del ${nomeModello} non è collegato in ManyChat`;
    return true;
  };
  if (!senzaFlusso(MODELLO_PROMEMORIA, "promemoria")) {
    for (const d of decP) if (d.tipo === "invia") candidati.push({ tipo: "promemoria", d });
  }
  if (!senzaFlusso(MODELLO_RICONTATTO, "ricontatto")) {
    for (const d of decR) if (d.tipo === "invia") candidati.push({ tipo: "ricontatto", d });
  }

  //  4-7. Gli invii.
  let falliti = giro.falliti;
  let ultimoInvioIl = statoPrima.ultimoInvioIl ?? null;
  const base = porte.porta(userId, config);

  const tenta = async (cand: Candidato): Promise<Tentativo> => {
    const { scheda, chiave } = cand.d;
    const d = scheda.data;
    const numero = numeroWa(d.telefono);
    const consulente = consulenti.find((c) => c.id === d.consulenteId);
    const campi =
      cand.tipo === "promemoria"
        ? campiPromemoria(d, consulente?.data?.nome, scheda.id)
        : campiRicontatto(d, consulente?.data?.nome);
    if (!numero || campi.tipo === "salta") return { fine: "continua" };
    //  L'ordine è quello del modello: {{1}} nome, {{2}} ora, {{3}} link, {{4}} consulente.
    const parametri =
      cand.tipo === "promemoria"
        ? [
            campi.campi.crm_nome,
            campi.campi.crm_ora_meet,
            campi.campi.crm_link_meet,
            campi.campi.crm_consulente,
          ]
        : [campi.campi.crm_nome, campi.campi.crm_consulente];
    const inizioMeet = cand.tipo === "promemoria" ? cand.d.extra.inizioMeet : null;
    const previstoIl = inizioMeet
      ? new Date(inizioMeet.getTime() - ANTICIPO_PROMEMORIA_MIN * 60_000).toISOString()
      : null;

    /** Perché la prenotazione non c'è stata (se non c'è stata), con la parola dell'SQL. */
    let rifiuto: string | null = null;
    /** La scheda come l'ha riletta il giro dopo la prenotazione. */
    let riletta: SchedaQuando = scheda;
    const ancora = async (): Promise<boolean> => {
      const s = await porte.scheda(userId, scheda.id);
      if (!s) return false;
      riletta = s;
      const ora = porte.adesso();
      const dec =
        cand.tipo === "promemoria"
          ? decidiPromemoria([s], ora, { consulenti, invii, tetti })
          : codaRicontatti([s], ora, config.ultimaAccensione, {
              consulenti,
              invii,
              tetti,
              prossimoDopo,
            });
      return dec.some((x) => x.tipo === "invia" && x.chiave === chiave);
    };

    const porta: PortePorta = {
      ...base,
      client: () =>
        conTag(base.client(), cand.tipo === "promemoria" ? TAG_PROMEMORIA : TAG_RICONTATTO),
      prenota: async (p) => {
        const r = await porte.prenota(
          userId,
          { ...p, tipo: cand.tipo, previstoIl },
          config.tetti,
          intervalloRicontatto(porte.caso()),
        );
        if ("motivo" in r) {
          rifiuto = r.motivo;
          //  La porta conosce solo «pausa» e «STOP» (e «già preso»): i motivi del
          //  giro (tetti, ritmo) li legge il giro da `rifiuto`. Quelli che non
          //  conosce nessuno (`dati_mancanti`…) arrivano alla porta come sono
          //  e diventano un blocco.
          return ["pausa_contatto", "stop"].includes(r.motivo) ||
            !["tetto_totale", "tetto_ricontatti", "ritmo", "gia_preso"].includes(r.motivo)
            ? r
            : { motivo: "gia_preso" };
        }
        //  ⚠️ Rilegge la scheda e rifà la decisione: fra la lettura del giro e
        //   ora la scheda può essere cambiata (meet spostato, consenso tolto, STOP).
        if (!(await ancora())) {
          await porte.annulla(userId, r.id, "scheda_cambiata").catch(() => undefined);
          rifiuto = "scheda_cambiata";
          return { motivo: "gia_preso" };
        }
        return r;
      },
    };

    const r = await inviaWhatsapp(porta, {
      canale: "manychat",
      a: `+${numero}`,
      modello: cand.tipo === "promemoria" ? MODELLO_PROMEMORIA : MODELLO_RICONTATTO,
      parametri,
      nome: d.nome,
      leadId: scheda.id,
      tipo: cand.tipo,
      chiave,
    });

    //  ── Rifiutato dalla prenotazione: non è partito niente. ──
    switch (rifiuto as string | null) {
      case "tetto_totale":
        nota = "Tetto di messaggi di oggi raggiunto";
        esito.saltati++;
        return { fine: "tutto_chiuso" };
      case "tetto_ricontatti":
        nota = "Tetto di ricontatti di oggi raggiunto";
        esito.saltati++;
        return { fine: "ricontatti_chiusi" };
      case "ritmo":
        esito.saltati++;
        return { fine: "ricontatti_chiusi" };
      case "pausa_contatto":
        esito.saltati++;
        return { fine: "continua" };
      case "scheda_cambiata":
        esito.saltati++;
        return { fine: "continua" };
      case "gia_preso":
        return { fine: "continua" };
      case "stop": {
        //  `whatsapp_contacts` dice STOP ma la scheda no: lo si segna, così il
        //  giro dopo non ci riprova ogni minuto.
        const cambio = dopoRisposta(scheda.data.contattoWa, "stop", porte.adesso());
        if (cambio) await porte.aggiornaContatto(userId, scheda.id, cambio).catch(() => undefined);
        esito.saltati++;
        return { fine: "continua" };
      }
      default:
        break;
    }

    //  ── Com'è andata la chiamata. ──
    const ora = porte.adesso();
    switch (r.esito) {
      case "ok": {
        falliti = 0;
        ultimoInvioIl = ora.toISOString();
        if (cand.tipo === "promemoria") esito.promemoriInviati++;
        else esito.ricontattiInviati++;
        //  Il registro dell'istantanea: i tentativi dopo vedono pausa, tetti e freno.
        invii.push({
          telefono: numero,
          tipo: cand.tipo,
          stato: "inviato",
          prenotatoIl: ora.toISOString(),
          chiave,
        });
        const invioId = r.invioId ?? "";
        const cambio =
          cand.tipo === "promemoria" && inizioMeet
            ? dopoInvio(riletta.data.contattoWa, {
                tipo: "promemoria",
                inviatoIl: ora,
                inizioMeet,
                invioId,
              })
            : dopoInvio(riletta.data.contattoWa, { tipo: "ricontatto", inviatoIl: ora, invioId });
        if (cambio) {
          await porte
            .aggiornaContatto(userId, scheda.id, cambio)
            .catch((e) => porte.avviso(`giro_contatto_errore_${codiceErrore(e)}`));
        }
        return { fine: "inviato" };
      }
      case "incerto": {
        //  La riga resta «prenotato» (poi «incerto» dopo 10') e non si rimanda
        //  mai. Non si sa com'è andata: il giro non ne apre un altro.
        esito.incerti++;
        falliti++;
        problema(scheda, cand.tipo, "esito incerto: controlla in ManyChat prima di rimandare");
        return finisciSeTroppi();
      }
      case "riprova_fra_poco":
      case "gia_preso":
        return { fine: "continua" };
      case "stop": {
        const cambio = dopoRisposta(scheda.data.contattoWa, "stop", ora);
        if (cambio) await porte.aggiornaContatto(userId, scheda.id, cambio).catch(() => undefined);
        esito.saltati++;
        return { fine: "continua" };
      }
      case "da_collegare":
      case "rifiuto_contatto": {
        const motivo =
          r.esito === "da_collegare" ? "contatto ManyChat da collegare" : "numero non su WhatsApp";
        const cambio = dopoRifiuto(riletta.data.contattoWa, motivo, ora);
        if (cambio) {
          await porte
            .aggiornaContatto(userId, scheda.id, cambio)
            .catch((e) => porte.avviso(`giro_contatto_errore_${codiceErrore(e)}`));
        }
        problema(scheda, cand.tipo, motivo);
        esito.saltati++;
        return { fine: "continua" };
      }
      case "flusso_mancante":
        nota = "Il flusso del modello non è collegato in ManyChat";
        esito.saltati++;
        return { fine: "continua" };
      default: {
        //  `blocco`. ManyChat non ha risposto PRIMA dell'invio: è certo che non è
        //  partito niente, la riga è «fallito», e la si libera dalla chiave perché
        //  il tentativo dopo possa riprovare. Non è un blocco di ManyChat.
        if (r.codice === "non_risponde_prima_invio") {
          if (r.invioId) await porte.annulla(userId, r.invioId, r.codice).catch(() => undefined);
          falliti++;
          problema(scheda, cand.tipo, "ManyChat non risponde: il messaggio non è partito");
          return finisciSeTroppi();
        }
        //  Chiave rifiutata, canale scollegato, modello in pausa, limite, o il
        //  registro che non risponde: si ferma tutto e si spegne.
        problema(scheda, cand.tipo, `ManyChat ha rifiutato l'invio (${r.codice ?? "blocco"})`);
        await spegni(`ManyChat ha rifiutato l'invio (${r.codice ?? "blocco"})`);
        return { fine: "ferma" };
      }
    }
  };

  let spento = false;
  /** Dopo un fallito: se sono due di fila si spegne, altrimenti il giro si ferma qui. */
  const finisciSeTroppi = async (): Promise<Tentativo> => {
    if (falliti >= FALLITI_DI_FILA_MAX) {
      await spegni(`Fermato: ${FALLITI_DI_FILA_MAX} invii falliti di fila`);
    }
    return { fine: "ferma" };
  };
  const spegni = async (motivo: string) => {
    spento = true;
    falliti = 0;
    await porte.spegni(motivo).catch((e) => porte.avviso(`giro_spegni_errore_${codiceErrore(e)}`));
  };

  let inviati = 0;
  let ricontattiDelGiro = 0;
  let tentativi = 0;
  let ricontattiChiusi = false;
  for (const cand of candidati) {
    if (inviati >= MAX_INVII_PER_GIRO || tentativi >= MAX_TENTATIVI_PER_GIRO) break;
    if (
      cand.tipo === "ricontatto" &&
      (ricontattiChiusi || ricontattiDelGiro >= MAX_RICONTATTI_PER_GIRO)
    )
      continue;
    //  Dopo 20 s dall'inizio non se ne apre un altro.
    if (porte.adesso().getTime() - inizio.getTime() >= TEMPO_GIRO_MS) break;
    tentativi++;
    const t = await tenta(cand);
    if (t.fine === "inviato") {
      inviati++;
      if (cand.tipo === "ricontatto") ricontattiDelGiro++;
    }
    if (t.fine === "ricontatti_chiusi") ricontattiChiusi = true;
    if (t.fine === "tutto_chiuso" || t.fine === "ferma") break;
  }

  //  8. Lo stato per il riquadro.
  const fine = porte.adesso();
  const stato: StatoGiroSalvato = {
    ultimoInvioIl,
    oggi: {
      promemoria: contaOggi(invii, oggi, "promemoria"),
      ricontatti: contaOggi(invii, oggi, "ricontatto"),
      risposte: contaRisposteOggi(invii, oggi),
    },
    problemi: unisciProblemi(statoPrima.problemi ?? [], problemi),
    nota,
    fermo: null,
  };
  await porte.scriviGiro({ ultimoGiroIl: fine, falliti, stato });
  return { ...esito, ...(spento ? { spento: true } : {}) };
}

function statoVuoto(): StatoGiroSalvato {
  return {
    ultimoInvioIl: null,
    oggi: { promemoria: 0, ricontatti: 0, risposte: 0 },
    problemi: [],
    nota: null,
    fermo: null,
  };
}
