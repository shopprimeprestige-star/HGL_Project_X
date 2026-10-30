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
import type { Consultant, TipoInvio } from "../types";
import { aRoma, nomePerModello } from "../promemoria/formati";
import { STATI_STELLA_UNO } from "../wa-orari";
import type { ClientManychat } from "./api";
import {
  dopoInvio,
  dopoRifiuto,
  dopoRisposta,
  dopoScadenza,
  istanteDiRoma,
  type CambioContatto,
  type IngressoInvio,
} from "./contatto";
import { finestraPerTesto } from "./finestra";
import {
  MODELLO_GENERICO,
  leggiMessaggioStato,
  sceltaInvio,
  type MessaggioStato,
} from "./messaggio-stato";
import { inviaWhatsapp, type PortePorta, type PrenotazionePorta } from "./porta";
import {
  ANTICIPO_PROMEMORIA_MIN,
  codaRicontatti,
  contaOggi,
  decidiPromemoria,
  intervalloRicontatto,
  tettiDelGiorno,
  type DecisioneQuando,
  type SchedaQuando,
  type Tetti,
} from "./quando";
import {
  TIPI_COL_RITMO,
  TIPI_NEI_TETTI,
  numeroWa,
  ultimeNoveCifre,
  type InvioPerFreno,
} from "./regole";
import {
  FRASE_FINESTRA_CHIUSA,
  PREFISSO_CASI,
  PREFISSO_IMPORTATO,
  PREFISSO_RITORNO,
  decidiGiornoMeet,
  decidiLeadNuovi,
  decidiMeetDomani,
  telefoniMeetDomani,
} from "./sequenze";
import { TABELLA_STATI, decidiPerStato } from "./stati";
import {
  campiCasiReali,
  campiMeetAdesso,
  campiMeetDomani,
  campiMeetOggi,
  campiMeetOggiLink,
  campiPerStato,
  campiPrimoContatto,
  campiPromemoria,
  campiRichiamo,
  campiRicontatto,
  campiRitorno,
  linkPerCliente,
  type CampiOSalta,
} from "./testi";

/** I modelli approvati da Meta, e i flussi di ManyChat che li mandano: il nome
 *  del modello è la chiave in `manychat_config.flussi`. */
export const MODELLO_PROMEMORIA = "hgl_promemoria_meet";
export const MODELLO_RICONTATTO = "hgl_ricontatto_consulenza";
/** La mattina del meet col link dentro (30/10/2026). Facoltativo: serve il flusso in
 *  `config.flussi` E il link in scheda; altrimenti la mattina è `hgl_meet_oggi`. */
export const MODELLO_MEET_OGGI_LINK = "hgl_meet_oggi_link";
/** Il primo contatto con le TRE fasce (mattina, pomeriggio o sera; richiesta del titolare
 *  30/10/2026). Parte appena il suo flusso è collegato in `config.flussi`; finché manca resta
 *  `hgl_primo_contatto` (mattina o sera): nessun lead nuovo resta senza messaggio. */
export const MODELLO_PRIMO_CONTATTO_TRE_FASCE = "hgl_primo_contatto_tre_fasce";
/** Il testo (non un modello Meta, senza flusso) del giorno prima solo se gratis: la porta lo
 *  cerca in `wa-meta-templates` e lo manda come messaggio normale. */
export const TESTO_MEET_DOMANI = "hgl_meet_domani_testo";
/** Il promemoria 24 ore prima della consulenza COME MODELLO. Spento dal titolare il 28/10:
 *  niente modello in più. Resta `false`. */
export const MEET_DOMANI_ACCESO = false;
/** Il promemoria 24 ore prima SOLO SE GRATIS (30/10/2026): parte come testo, con la finestra di
 *  24 ore aperta (ultima entrata < 23 ore), e la porta non ripiega mai sul modello. Altrimenti
 *  si salta. Si spegne con `false`; con `MEET_DOMANI_ACCESO` vero vale quello (modello ammesso). */
export const MEET_DOMANI_SOLO_GRATIS = true;
/** Il promemoria 24 ore prima COME MODELLO Utility (`hgl_meet_domani`), a pagamento, alle 9:00 del
 *  giorno prima e anche a finestra chiusa, se la consulenza è stata fissata da PIÙ di questi
 *  giorni (30/10/2026): chi l'ha fissata da tanto se la può dimenticare. Fissata da meno resta
 *  «solo se gratis». Una sola volta per meet (stessa chiave `d|…`). Serve il flusso
 *  `hgl_meet_domani` in `config.flussi`. Si spegne con `null`. */
export const MEET_DOMANI_A_PAGAMENTO_OLTRE_GIORNI: number | null = 3;
/** I tag per ritrovare in ManyChat chi ha ricevuto cosa. */
export const TAG_PROMEMORIA = "crm-promemoria";
export const TAG_RICONTATTO = "crm-ricontatto";
/** Modello e tag dei cinque messaggi delle sequenze (commessa 2026-10-25). I
 *  messaggi per stato li sceglie `TABELLA_STATI`, mai una seconda lista qui. */
export const MODELLI_SEQUENZE = {
  primo_contatto: { modello: "hgl_primo_contatto", tag: "crm-primo-contatto" },
  richiamo_24h: { modello: "hgl_richiamo_24h", tag: "crm-richiamo" },
  ritorno: { modello: "hgl_ritorno", tag: "crm-ritorno" },
  casi_reali: { modello: "hgl_casi_reali", tag: "crm-casi-reali" },
  meet_oggi: { modello: "hgl_meet_oggi", tag: "crm-meet-oggi" },
  meet_domani: { modello: "hgl_meet_domani", tag: "crm-meet-domani" },
  meet_adesso: { modello: "hgl_meet_adesso", tag: "crm-meet-adesso" },
} as const;

/** I tipi di messaggio che il giro manda: gli undici di `TIPI_NEI_TETTI`. */
export type TipoGiro = Extract<
  TipoInvio,
  | "promemoria"
  | "ricontatto"
  | "primo_contatto"
  | "richiamo_24h"
  | "ritorno"
  | "casi_reali"
  | "meet_oggi"
  | "meet_domani"
  | "meet_adesso"
  | "promemoria_chiamata"
  | "promemoria_sede"
>;

/** L'ORDINE DEI CANDIDATI (PIANO §5d): prima chi ha un'ora precisa e un
 *  appuntamento vicino, poi i lead nuovi, in fondo i messaggi col ritmo. I due
 *  che aspettano il ritmo (ricontatto, richiamo) sono in fondo: ne parte UNO per
 *  giro. Fra i due vince il ricontatto (a data o a evento: ha spesso un'ora
 *  fissata e il recupero del giorno dopo); il richiamo ha 48 ore di margine. */
export const ORDINE_GIRO: TipoGiro[] = [
  "meet_adesso",
  "promemoria",
  "promemoria_chiamata",
  "meet_oggi",
  "meet_domani",
  "promemoria_sede",
  //  chi ha già ricevuto il primo contatto riceve subito il secondo, prima dei nuovi
  "casi_reali",
  "ritorno",
  "primo_contatto",
  "ricontatto",
  "richiamo_24h",
];

/** Il lucchetto: più della durata massima del giro (45 s). */
export const LUCCHETTO_S = 120;
/** Al massimo due invii per giro, e di questi al massimo uno che aspetta il
 *  ritmo (ricontatto o richiamo: `TIPI_COL_RITMO`). */
export const MAX_INVII_PER_GIRO = 2;
export const MAX_COL_RITMO_PER_GIRO = 1;
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
  /** gli altri sei tipi: primo contatto, richiamo, mattina e ora esatta del meet,
   *  chiamata concordata, appuntamento in sede */
  nuoviInviati: number;
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
  tipo: TipoGiro;
  esito: "scriverebbe" | "aspetta" | "salta";
  motivo: string;
}

/** Un problema per il riquadro. `scheda` serve a non scriverlo due volte e non
 *  esce mai dal server. */
export interface ProblemaGiroSalvato {
  il: string;
  nome: string;
  tipo: TipoGiro;
  motivo: string;
  scheda: string;
}

/** Quello che il giro lascia in `manychat_giro.stato` (jsonb). */
export interface StatoGiroSalvato {
  /** l'ultimo messaggio automatico partito */
  ultimoInvioIl: string | null;
  /** conteggi del giorno di oggi (Roma). `leadNuovi` = primo contatto + richiamo + ritorno + casi reali;
   *  `totale` = tutto ciò che conta nel tetto (`TIPI_NEI_TETTI`). */
  oggi: {
    promemoria: number;
    ricontatti: number;
    leadNuovi: number;
    totale: number;
    risposte: number;
  };
  problemi: ProblemaGiroSalvato[];
  /** una frase se il giro ha trovato un limite (tetto, ritmo, flusso mancante) */
  nota: string | null;
  /** perché l'ultimo giro non ha fatto niente (`spento`, `senza_chiave`…) */
  fermo: string | null;
}

/** La riga `manychat_config`. Le colonne di S2 (`leadNuovo` in giù) sono spente o
 *  vuote se la migrazione non c'è: il giro di prima resta identico. */
export interface ConfigGiro {
  userId: string;
  canale: "cloud" | "manychat";
  acceso: boolean;
  promemoria: boolean;
  ricontatti: boolean;
  /** «Lead nuovo» (primo contatto e richiamo a 24 ore) */
  leadNuovo: boolean;
  /** «Giorno del meet» (24 ore prima, mattina e ora esatta) */
  giornoMeet: boolean;
  /** ISO dell'ultima accensione di «Lead nuovo» */
  leadNuovoDal: string | null;
  /** ISO: da quando i primi contatti ricevono i casi reali. La porta vera non lo imposta (vale
   *  `CASI_REALI_DAL` di sequenze.ts); le prove lo passano per usare date del passato. */
  casiRealiDal?: string | null;
  /** stato → ISO dell'accensione del suo messaggio; assente = spento */
  stati: Record<string, string>;
  /** l'indirizzo della sede, per il promemoria «in sede» */
  indirizzoSede: string | null;
  /** `controlli.fraseModulo.il`: da quando vale il consenso del modulo Meta */
  fraseModuloDal: string | null;
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
export interface PrenotazioneGiro extends Omit<PrenotazionePorta, "tipo"> {
  tipo: TipoGiro;
  /** ISO: promemoria = il momento a cui puntava (−25' dal meet); ora esatta = l'inizio */
  previstoIl: string | null;
}

/** Quali schede serve leggere oltre agli appuntamenti di oggi e ai ricontatti a data. */
export interface AmbitoSchede {
  /** i lead del modulo Meta entrati da questo ISO in poi; `null` = non servono */
  leadNuoviDal: string | null;
  /** gli importati «da contattare» non ancora scritti e i contatti di ritorno (commessa
   *  2026-10-28): servono se «Lead nuovo» è acceso */
  importatiERitorni: boolean;
  /** gli stati con un messaggio acceso (stato → ISO dell'accensione) */
  stati: Record<string, string>;
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
  /** L'ultimo messaggio del cliente per ognuno di questi telefoni (solo cifre col prefisso;
   *  in uscita: ultime 9 cifre → ISO), da
   *  `whatsapp_contacts.ultimo_in_entrata_il`: una sola lettura per giro, solo per i meet di
   *  domani. Chi non ha scritto non compare. */
  ultimeEntrate(userId: string, telefoni: string[]): Promise<Record<string, string>>;
  /** le schede che il giro può dover toccare: appuntamenti di oggi in poi, schede
   *  negli stati dei ricontatti a data, e quelle che chiede `ambito` */
  schede(userId: string, oggi: string, ambito: AmbitoSchede): Promise<SchedaQuando[]>;
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
  /** Stella 1 alla chat di quel numero (`mettiStellaUno` di wa-orari su `app_config.wa_stelle`, una
   *  riga per tutto lo studio: niente `userId`). Può lanciare `{ code }`: il giro lo cattura. */
  stellaUno(telefono: string): Promise<"messa" | "gia_uno" | "senza_numero" | "conflitto">;
  /** `lead_attesa_whatsapp`: «da contattare» → «attesa_whatsapp» (con `statoDal` = `il`), SOLO se
   *  la scheda è ancora «da contattare» al momento della scrittura. Vero se ha scritto. */
  attesaWhatsapp(userId: string, leadId: string, il: Date): Promise<boolean>;
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
  nuoviInviati: 0,
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

/** Un blocco che spegne SUBITO l'interruttore: ManyChat non ci ascolta più
 *  (chiave 401, permesso 403, limite 429) oppure da noi manca qualcosa (chiave,
 *  registro, configurazione: qualunque codice che non sia una risposta HTTP di
 *  ManyChat). Gli altri `http_4xx` sono quasi sempre un contatto solo: contano
 *  come falliti di fila. */
export function bloccoImmediato(codice: string | undefined): boolean {
  const m = /^http_(\d{3})/.exec(codice ?? "");
  if (!m) return true;
  return ["401", "403", "429"].includes(m[1]);
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

/** ═══════════════════════════════════════════════════════════════════════════
 *  LE DECISIONI DEL GIRO, TUTTE INSIEME
 *  ═══════════════════════════════════════════════════════════════════════════
 *  Un posto solo che chiama le cinque famiglie di decisioni pure e le rimette in
 *  fila: lo usano il giro vero, la prova a secco del giro e quella del riquadro
 *  (`provaASecco`), così non esistono due elenchi che si possono separare. */

/** Quello che serve del messaggio oltre al tipo: lo stato della scheda (per
 *  scegliere il modello dalla tabella), l'inizio dell'appuntamento (per «In
 *  attesa» fino a quel momento) e se è un recupero. */
export interface ExtraVoce {
  stato: string | null;
  inizio: Date | null;
  recupero: boolean;
  /** il giorno prima fissato da oltre `MEET_DOMANI_A_PAGAMENTO_OLTRE_GIORNI`: va come modello */
  aPagamento?: boolean;
}

/** Una decisione col suo tipo di messaggio. Per `aspetta` e `salta` il tipo è
 *  quello più probabile (serve a dire di che messaggio si parla). */
export interface Voce {
  tipo: TipoGiro;
  d: DecisioneQuando<ExtraVoce>;
  /** viene dai messaggi per stato: «Non risponde» e «Irreperibile» valgono anche per
   *  gli importati, che spesso non hanno il consenso (non è un guasto da mostrare) */
  perStato?: boolean;
}

/** Cosa serve in lettura per decidere (nessuna scrittura, nessuna rete). */
export interface DatiDecisioni {
  consulenti: Pick<Consultant, "id" | "data">[];
  invii: InvioPerFreno[];
  tetti: Tetti;
  /** `manychat_giro.prossimo_ricontatto_dopo` */
  prossimoDopo: Date | null;
  /** ultime 9 cifre → ISO dell'ultimo messaggio del cliente, per i soli meet di domani
   *  (`telefoniMeetDomani`). Assente o senza il telefono = finestra chiusa: nessun testo gratis. */
  ultimeEntrate?: Record<string, string | null>;
}

/** Quali messaggi sono accesi e con quali date. */
export interface SceltaDecisioni {
  promemoria: boolean;
  /** «Ricontatto fissato» */
  ricontatti: boolean;
  leadNuovo: boolean;
  giornoMeet: boolean;
  /** stato → ISO dell'accensione */
  statiAccesi: Record<string, string>;
  leadNuovoDal: string | null;
  casiRealiDal?: string | null;
  ultimaAccensione: string | null;
  indirizzoSede: string | null;
  fraseModuloDal: string | null;
}

/** La parte della configurazione che decide quali messaggi vanno guardati. */
export type ConfigDecisioni = Pick<
  ConfigGiro,
  | "promemoria"
  | "ricontatti"
  | "leadNuovo"
  | "giornoMeet"
  | "leadNuovoDal"
  | "casiRealiDal"
  | "stati"
  | "indirizzoSede"
  | "ultimaAccensione"
  | "fraseModuloDal"
>;

/** Dalla configurazione a ciò che si guarda. Nel giro vero valgono gli
 *  interruttori. Nella prova a secco no: serve a vedere cosa succederebbe PRIMA
 *  di accendere, quindi tutto si guarda; per ciò che è spento si finge
 *  l'accensione di stamattina (altrimenti i lead e gli stati di oggi, tutti
 *  arrivati prima di «adesso», non comparirebbero mai). */
export function sceltaDaConfig(c: ConfigDecisioni, adesso: Date, prova: boolean): SceltaDecisioni {
  if (!prova) {
    return {
      promemoria: c.promemoria,
      ricontatti: c.ricontatti,
      leadNuovo: c.leadNuovo,
      giornoMeet: c.giornoMeet,
      statiAccesi: c.stati,
      leadNuovoDal: c.leadNuovoDal,
      casiRealiDal: c.casiRealiDal,
      ultimaAccensione: c.ultimaAccensione,
      indirizzoSede: c.indirizzoSede,
      fraseModuloDal: c.fraseModuloDal,
    };
  }
  const stamattina = (istanteDiRoma(aRoma(adesso).giorno, "00:00") ?? adesso).toISOString();
  const statiAccesi: Record<string, string> = {};
  for (const stato of Object.keys(TABELLA_STATI))
    if (stato !== "da_ricontattare") statiAccesi[stato] = c.stati[stato] ?? stamattina;
  return {
    promemoria: true,
    ricontatti: true,
    leadNuovo: true,
    giornoMeet: true,
    statiAccesi,
    leadNuovoDal: c.leadNuovoDal ?? stamattina,
    casiRealiDal: c.casiRealiDal,
    ultimaAccensione: c.ultimaAccensione,
    indirizzoSede: c.indirizzoSede,
    fraseModuloDal: c.fraseModuloDal,
  };
}

/** Le schede da leggere per questa scelta. */
export const ambitoDi = (s: SceltaDecisioni): AmbitoSchede => ({
  leadNuoviDal: s.leadNuovo ? s.leadNuovoDal : null,
  importatiERitorni: s.leadNuovo,
  stati: s.statiAccesi,
});

/** Il tipo di messaggio di uno stato: chiamata e sede sono a orario, il resto è un ricontatto. */
function tipoDelloStato(stato: unknown): TipoGiro {
  if (stato === "richiamo") return "promemoria_chiamata";
  if (stato === "viene_in_sede") return "promemoria_sede";
  return "ricontatto";
}

export function decisioniDelGiro(
  schede: SchedaQuando[],
  adesso: Date,
  dati: DatiDecisioni,
  scelta: SceltaDecisioni,
): Voce[] {
  const base = {
    consulenti: dati.consulenti,
    invii: dati.invii,
    tetti: dati.tetti,
    fraseModuloDal: scelta.fraseModuloDal,
  };
  const voci: Voce[] = [];
  /** `invia` porta il suo tipo, `aspetta`/`salta` lo indovinano da `tipoPer`. */
  function aggiungi<X>(
    decisioni: DecisioneQuando<X>[],
    daInvia: (x: X) => { tipo: TipoGiro; extra: Partial<ExtraVoce> },
    tipoPer: (d: DecisioneQuando<X>) => TipoGiro,
    perStato = false,
  ) {
    for (const d of decisioni) {
      if (d.tipo === "invia") {
        const { tipo, extra } = daInvia(d.extra);
        voci.push({
          tipo,
          d: { ...d, extra: { stato: null, inizio: null, recupero: false, ...extra } },
          ...(perStato ? { perStato } : {}),
        });
      } else {
        voci.push({ tipo: tipoPer(d), d, ...(perStato ? { perStato } : {}) });
      }
    }
  }

  if (scelta.promemoria)
    aggiungi(
      decidiPromemoria(schede, adesso, base),
      (x) => ({ tipo: "promemoria", extra: { inizio: x.inizioMeet } }),
      () => "promemoria",
    );
  if (scelta.giornoMeet)
    aggiungi(
      decidiGiornoMeet(schede, adesso, base),
      (x) => ({ tipo: x.quale, extra: { inizio: x.inizioMeet } }),
      //  I motivi di un salto dicono da soli di quale messaggio si parla.
      (d) =>
        /messaggio all'ora|giro in ritardo|link/.test((d as { motivo: string }).motivo)
          ? "meet_adesso"
          : "meet_oggi",
    );
  //  Il promemoria 24 ore prima: stesso interruttore, subito dopo la mattina del meet.
  //  Come modello è spento (decisione del titolare 28/10); come testo gratis parte solo con
  //  la finestra aperta (30/10: `MEET_DOMANI_SOLO_GRATIS`).
  if (
    scelta.giornoMeet &&
    (MEET_DOMANI_ACCESO ||
      MEET_DOMANI_SOLO_GRATIS ||
      MEET_DOMANI_A_PAGAMENTO_OLTRE_GIORNI !== null)
  )
    aggiungi(
      decidiMeetDomani(schede, adesso, {
        ...base,
        soloGratis: !MEET_DOMANI_ACCESO,
        pagaOltreGiorni: MEET_DOMANI_A_PAGAMENTO_OLTRE_GIORNI,
        senzaGratis: !MEET_DOMANI_SOLO_GRATIS,
        ultimeEntrate: dati.ultimeEntrate,
      }),
      (x) => ({
        tipo: x.quale,
        extra: { inizio: x.inizioMeet, ...(x.aPagamento ? { aPagamento: true } : {}) },
      }),
      () => "meet_domani",
    );
  if (scelta.leadNuovo)
    aggiungi(
      decidiLeadNuovi(schede, adesso, {
        ...base,
        leadNuovoDal: scelta.leadNuovoDal,
        casiRealiDal: scelta.casiRealiDal,
        prossimoDopo: dati.prossimoDopo,
      }),
      (x) => ({ tipo: x.quale, extra: {} }),
      (d) => {
        const motivo = (d as { motivo: string }).motivo;
        if (motivo.startsWith(PREFISSO_RITORNO)) return "ritorno";
        if (motivo.startsWith(PREFISSO_CASI)) return "casi_reali";
        if (motivo.startsWith(PREFISSO_IMPORTATO)) return "primo_contatto";
        return /richiamo|sequenza finita/.test(motivo) ? "richiamo_24h" : "primo_contatto";
      },
    );
  //  I ricontatti «a data»: «Ricontatto fissato» con il suo interruttore, gli
  //  altri con quello del loro stato. Spento → la coda non dice niente.
  aggiungi(
    codaRicontatti(schede, adesso, scelta.ultimaAccensione, {
      ...base,
      prossimoDopo: dati.prossimoDopo,
      statiAccesi: scelta.statiAccesi,
      ricontattiAcceso: scelta.ricontatti,
    }),
    (x) => ({ tipo: "ricontatto", extra: { stato: x.stato, recupero: x.recupero } }),
    () => "ricontatto",
  );
  if (Object.keys(scelta.statiAccesi).length > 0)
    aggiungi(
      decidiPerStato(schede, adesso, {
        ...base,
        statiAccesi: scelta.statiAccesi,
        indirizzoSede: scelta.indirizzoSede,
        prossimoDopo: dati.prossimoDopo,
      }),
      (x) => ({ tipo: x.tipo, extra: { stato: x.stato, inizio: x.inizio } }),
      (d) => tipoDelloStato(d.scheda.data.stato),
      true,
    );

  //  Stabile: dentro lo stesso tipo resta l'ordine delle decisioni.
  const rango = (t: TipoGiro) => ORDINE_GIRO.indexOf(t);
  return voci.sort((a, b) => rango(a.tipo) - rango(b.tipo));
}

/** I «salta» che non sono un guasto da mostrare (la sequenza è finita, c'è già
 *  un altro messaggio). STOP non è un problema: è quello che il cliente ha chiesto. */
const NON_SONO_PROBLEMI = [
  "STOP",
  "sequenza finita",
  "saltato: c'è già il promemoria",
  "la conferma è già partita oggi",
  //  il giorno prima, solo se gratis: senza finestra aperta si risparmia, non è un guasto
  FRASE_FINESTRA_CHIUSA,
];
//  I motivi degli importati e dei ritorni (numero storto, nome mancante, revoca…) non sono
//  guasti: sono tanti, e riempirebbero i 20 posti dei problemi veri.
const eProblema = (motivo: string) =>
  ![PREFISSO_IMPORTATO, PREFISSO_RITORNO, PREFISSO_CASI, ...NON_SONO_PROBLEMI].some((m) =>
    motivo.startsWith(m),
  );

/** Come si presenta un messaggio che parte, nella prova a secco. */
function chiSara(v: Voce): string {
  const ora = v.d.tipo === "invia" && v.d.extra.inizio ? aRoma(v.d.extra.inizio).minuti : null;
  const hm =
    ora === null
      ? ""
      : ` alle ${String(Math.floor(ora / 60)).padStart(2, "0")}:${String(ora % 60).padStart(2, "0")}`;
  switch (v.tipo) {
    case "promemoria":
    case "meet_oggi":
    case "meet_domani":
    case "meet_adesso":
      return `meet${hm}`;
    case "promemoria_chiamata":
      return `chiamata${hm}`;
    case "promemoria_sede":
      return `appuntamento in sede${hm}`;
    case "primo_contatto":
      return "primo contatto";
    case "richiamo_24h":
      return "richiamo dopo 24 ore";
    case "ritorno":
      return "messaggio di ritorno";
    case "casi_reali":
      return "casi reali";
    default:
      return v.d.tipo === "invia" && v.d.extra.recupero
        ? "recupero del ricontatto di ieri"
        : "ricontatto di oggi";
  }
}

/** Le righe della prova a secco, con le STESSE regole del giro vero: al massimo
 *  `MAX_INVII_PER_GIRO` invii, di cui uno solo che aspetta il ritmo. */
export function righeDiProva(voci: Voce[], nomeDi: (s: SchedaQuando) => string): RigaGiro[] {
  const righe: RigaGiro[] = [];
  let invii = 0;
  let colRitmo = 0;
  for (const v of voci) {
    const nome = nomeDi(v.d.scheda);
    if (v.d.tipo !== "invia") {
      righe.push({ nome, tipo: v.tipo, esito: v.d.tipo, motivo: v.d.motivo });
      continue;
    }
    const chi = chiSara(v);
    const aspettaRitmo = TIPI_COL_RITMO.includes(v.tipo);
    if (invii >= MAX_INVII_PER_GIRO) {
      righe.push({
        nome,
        tipo: v.tipo,
        esito: "aspetta",
        motivo: `${chi}: al giro dopo (al massimo ${MAX_INVII_PER_GIRO} messaggi per giro)`,
      });
    } else if (aspettaRitmo && colRitmo >= MAX_COL_RITMO_PER_GIRO) {
      righe.push({
        nome,
        tipo: v.tipo,
        esito: "aspetta",
        motivo: `${chi}: un ricontatto alla volta, uno ogni 27-33 minuti (ritmo)`,
      });
    } else {
      invii++;
      if (aspettaRitmo) colRitmo++;
      righe.push({ nome, tipo: v.tipo, esito: "scriverebbe", motivo: chi });
    }
  }
  return righe;
}

/** Il modello e il tag di un messaggio. `null` = uno stato senza riga nella tabella. */
export function modelloETag(
  tipo: TipoGiro,
  stato: string | null,
  /** la mattina del meet va col link? (`mattinaColLink`) */
  conLink = false,
  /** il primo contatto ha il flusso con le tre fasce? */
  treFasce = false,
): { modello: string; tag: string } | null {
  if (tipo === "promemoria") return { modello: MODELLO_PROMEMORIA, tag: TAG_PROMEMORIA };
  if (
    tipo === "primo_contatto" ||
    tipo === "richiamo_24h" ||
    tipo === "ritorno" ||
    tipo === "casi_reali" ||
    tipo === "meet_oggi" ||
    tipo === "meet_domani" ||
    tipo === "meet_adesso"
  )
    return tipo === "meet_oggi" && conLink
      ? { ...MODELLI_SEQUENZE.meet_oggi, modello: MODELLO_MEET_OGGI_LINK }
      : tipo === "primo_contatto" && treFasce
        ? { ...MODELLI_SEQUENZE.primo_contatto, modello: MODELLO_PRIMO_CONTATTO_TRE_FASCE }
        : MODELLI_SEQUENZE[tipo];
  const riga = TABELLA_STATI[(stato ?? "da_ricontattare") as keyof typeof TABELLA_STATI];
  return riga ? { modello: riga.modello, tag: riga.tag } : null;
}

/** La mattina del meet parte col link se la scheda ha un link usabile (stessa fonte del
 *  promemoria) E il flusso col link è collegato; altrimenti col messaggio di prima. */
const mattinaColLink = (scheda: SchedaQuando, flussi: Record<string, string>): boolean =>
  !!flussi[MODELLO_MEET_OGGI_LINK] && !!linkPerCliente(scheda.data, scheda.id);

/** Le variabili del modello, nell'ordine in cui il modello le vuole. */
function campiDi(
  tipo: TipoGiro,
  v: ExtraVoce,
  scheda: SchedaQuando,
  consulente: string | undefined,
  indirizzoSede: string | null,
  conLink = false,
): CampiOSalta {
  const d = scheda.data;
  switch (tipo) {
    case "promemoria":
      return campiPromemoria(d, consulente, scheda.id);
    case "primo_contatto":
      return campiPrimoContatto(d);
    case "richiamo_24h":
      return campiRichiamo(d);
    case "ritorno":
      return campiRitorno(d);
    case "casi_reali":
      return campiCasiReali(d);
    case "meet_oggi":
      return conLink ? campiMeetOggiLink(d, consulente, scheda.id) : campiMeetOggi(d, consulente);
    case "meet_domani":
      return campiMeetDomani(d, consulente);
    case "meet_adesso":
      return campiMeetAdesso(d, consulente, scheda.id);
    default:
      return campiPerStato(v.stato ?? "da_ricontattare", d, consulente, indirizzoSede);
  }
}

/** Il secondo stato dopo l'invio (§5e). */
function ingressoInvio(
  tipo: Exclude<TipoGiro, "casi_reali">,
  v: ExtraVoce,
  inviatoIl: Date,
  invioId: string,
): IngressoInvio {
  switch (tipo) {
    case "promemoria":
    case "meet_oggi":
    case "meet_domani":
    case "promemoria_chiamata":
    case "promemoria_sede":
      //  Senza l'ora dell'appuntamento non c'è una scadenza vera: vale come un ricontatto (24 ore).
      return v.inizio
        ? { tipo, inviatoIl, inizioMeet: v.inizio, invioId }
        : { tipo: "ricontatto", inviatoIl, invioId };
    case "meet_adesso":
      return { tipo, inviatoIl, invioId };
    default:
      return { tipo, inviatoIl, invioId };
  }
}

/** A quale istante puntava il messaggio (`previsto_il` del registro). */
function previstoDi(tipo: TipoGiro, inizio: Date | null): string | null {
  if (!inizio) return null;
  if (tipo === "promemoria")
    return new Date(inizio.getTime() - ANTICIPO_PROMEMORIA_MIN * 60_000).toISOString();
  return tipo === "meet_adesso" ? inizio.toISOString() : null;
}

type Candidato = {
  tipo: TipoGiro;
  d: Extract<DecisioneQuando<ExtraVoce>, { tipo: "invia" }>;
  modello: string;
  tag: string;
  /** mai come modello: solo il testo, o «saltato» (porta.ts, `soloTesto`) */
  soloTesto?: boolean;
  /** il messaggio che il consulente ha scritto per lo stato della scheda (se vale ancora) */
  messaggio?: MessaggioStato | null;
};

/** Il messaggio scritto dal consulente, per i soli messaggi legati a uno stato (ricontatto e i
 *  due promemoria a orario): per gli altri tipi non esiste. `null` = tutto come prima. */
const messaggioDelloStato = (tipo: TipoGiro, scheda: SchedaQuando): MessaggioStato | null =>
  tipo === "ricontatto" || tipo === "promemoria_chiamata" || tipo === "promemoria_sede"
    ? leggiMessaggioStato(scheda.data)
    : null;

/** Come è andato un tentativo di invio. */
type Tentativo =
  | { fine: "inviato" }
  | { fine: "continua" }
  /** questi tipi, oggi, non possono più partire (tetto o ritmo) */
  | { fine: "chiudi"; tipi: TipoGiro[] }
  | { fine: "ferma" };

/** Qualcosa è acceso? (generale a parte) */
const qualcosaAcceso = (c: ConfigGiro) =>
  c.promemoria || c.ricontatti || c.leadNuovo || c.giornoMeet || Object.keys(c.stati).length > 0;

/** Il nome di un modello nella nota «flusso non collegato». */
const NOME_MODELLO: Record<string, string> = {
  [MODELLO_PROMEMORIA]: "promemoria",
  [MODELLO_RICONTATTO]: "ricontatto",
};

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
  //  La prova a secco mostra cosa farebbe anche col canale ancora `cloud`: serve a
  //  vederlo PRIMA di cambiare canale. Il giro vero con `cloud` non fa niente.
  if (!prova && config.canale !== "manychat") return fermoCon("canale");
  if (!prova) {
    if (!config.acceso || !qualcosaAcceso(config)) return fermoCon("spento");
    if (!porte.chiaveManychat()) return fermoCon("senza_chiave");
  }

  //  Quello che serve a decidere, letto una volta.
  const userId = config.userId;
  const adesso = porte.adesso();
  const oggi = aRoma(adesso).giorno;
  const scelta = sceltaDaConfig(config, adesso, prova);
  const consulenti = await porte.consulenti(userId);
  const [schede, inAttesa, registro] = await Promise.all([
    porte.schede(userId, oggi, ambitoDi(scelta)),
    porte.schedeInAttesa(userId),
    porte.invii(userId, new Date(adesso.getTime() - GIORNI_REGISTRO * 86_400_000)),
  ]);
  /** L'istantanea del registro: ogni invio del giro ci si aggiunge, così le
   *  decisioni dopo il primo invio vedono pausa, tetti e freno aggiornati. */
  const invii: InvioPerFreno[] = [...registro];
  const tetti = tettiDelGiorno(config.tetti, config.primaAccensione, adesso);
  const prossimoDopo = giro.prossimoRicontattoDopo ? new Date(giro.prossimoRicontattoDopo) : null;
  //  Il giorno prima, solo se gratis: serve l'ultima entrata dei soli meet di domani. Se la
  //  lettura si guasta nessuno ha la finestra aperta: si risparmia, il resto del giro prosegue.
  let ultimeEntrate: Record<string, string> = {};
  if (scelta.giornoMeet && !MEET_DOMANI_ACCESO && MEET_DOMANI_SOLO_GRATIS) {
    const telefoni = telefoniMeetDomani(schede, adesso, invii);
    if (telefoni.length > 0)
      try {
        ultimeEntrate = await porte.ultimeEntrate(userId, telefoni);
      } catch (e) {
        porte.avviso(`giro_entrate_errore_${codiceErrore(e)}`);
      }
  }
  const dati: DatiDecisioni = { consulenti, invii, tetti, prossimoDopo, ultimeEntrate };

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

  //  Le decisioni. Gli interruttori contano solo nel giro vero (`sceltaDaConfig`).
  const voci = decisioniDelGiro(schede, adesso, dati, scelta);

  const nomeDi = (s: SchedaQuando) => nomeAbbreviato(s.data);
  const problemi: ProblemaGiroSalvato[] = [];
  const problema = (s: SchedaQuando, tipo: TipoGiro, motivo: string) =>
    problemi.push({ il: adesso.toISOString(), nome: nomeDi(s), tipo, motivo, scheda: s.id });
  for (const v of voci) {
    if (v.d.tipo !== "salta" || !eProblema(v.d.motivo)) continue;
    //  Senza consenso, per i messaggi per stato, non è un guasto: gli importati sono
    //  tanti e riempirebbero i 20 posti dei problemi, coprendo quelli veri.
    if (v.perStato && v.d.motivo === "manca il consenso WhatsApp") continue;
    problema(v.d.scheda, v.tipo, v.d.motivo);
  }

  //  La prova a secco si ferma qui: nessuna scrittura, nessuna chiamata.
  if (prova) {
    const righe = righeDiProva(voci, nomeDi);
    return { ...esito, saltati: righe.filter((r) => r.esito === "salta").length, righe };
  }

  //  I flussi: un modello senza flusso non parte (solo quello), e lo dice.
  let nota: string | null = null;
  const candidati: Candidato[] = [];
  const senzaFlusso = new Set<string>();
  for (const v of voci) {
    if (v.d.tipo !== "invia") continue;
    const mt = modelloETag(
      v.tipo,
      v.d.extra.stato,
      v.tipo === "meet_oggi" && mattinaColLink(v.d.scheda, config.flussi),
      !!config.flussi[MODELLO_PRIMO_CONTATTO_TRE_FASCE],
    );
    if (!mt) continue;
    //  Il giorno prima, solo se gratis, parte come testo: il suo flusso non serve e non si usa.
    //  Eccetto se fissata da oltre 3 giorni: quella va come modello (`aPagamento`).
    const soloTesto =
      v.tipo === "meet_domani" && !MEET_DOMANI_ACCESO && !v.d.extra.aPagamento;
    if (!soloTesto && !config.flussi[mt.modello]) {
      senzaFlusso.add(mt.modello);
      continue;
    }
    candidati.push({
      tipo: v.tipo,
      d: v.d,
      ...mt,
      ...(soloTesto ? { soloTesto } : {}),
      messaggio: messaggioDelloStato(v.tipo, v.d.scheda),
    });
  }
  //  Il messaggio dello stato scritto dal consulente: per sapere se la finestra delle 24 ore è
  //  aperta si legge l'ultima entrata (una volta sola) dei soli telefoni di chi ha un messaggio.
  //  Se la lettura si guasta nessuno ha la finestra aperta: parte il modello, il giro prosegue.
  let entrateMessaggi: Record<string, string> = {};
  const telefoniMessaggi = [
    ...new Set(
      candidati
        .filter((x) => x.messaggio)
        .map((x) => numeroWa(x.d.scheda.data.telefono))
        .filter((n): n is string => !!n),
    ),
  ];
  if (telefoniMessaggi.length > 0)
    try {
      entrateMessaggi = await porte.ultimeEntrate(userId, telefoniMessaggi);
    } catch (e) {
      porte.avviso(`giro_entrate_errore_${codiceErrore(e)}`);
    }
  if (senzaFlusso.size > 0) {
    const nomi = [...senzaFlusso].map((m) => NOME_MODELLO[m] ?? m);
    nota =
      nomi.length === 1
        ? `Il flusso del ${nomi[0]} non è collegato in ManyChat`
        : `Il flusso non è collegato in ManyChat per: ${nomi.join(", ")}`;
  }

  //  4-7. Gli invii.
  let falliti = giro.falliti;
  let ultimoInvioIl = statoPrima.ultimoInvioIl ?? null;
  const base = porte.porta(userId, config);

  const tenta = async (cand: Candidato): Promise<Tentativo> => {
    const { scheda, chiave, extra } = cand.d;
    const d = scheda.data;
    const numero = numeroWa(d.telefono);
    const consulente = consulenti.find((c) => c.id === d.consulenteId);
    const campi = campiDi(
      cand.tipo,
      extra,
      scheda,
      consulente?.data?.nome,
      config.indirizzoSede,
      cand.modello === MODELLO_MEET_OGGI_LINK,
    );
    if (!numero || campi.tipo === "salta") return { fine: "continua" };
    //  L'ordine delle variabili è quello dei campi (v1…v4 del modello): una lista sola.
    let parametri = Object.values(campi.campi);
    const previstoIl = previstoDi(cand.tipo, extra.inizio);

    //  ── IL MESSAGGIO CHE HA SCRITTO IL CONSULENTE ──
    //  Finestra aperta → il suo testo (la porta lo manda come testo, col modello di riserva).
    //  Altrimenti il modello scelto: quello dello stato o il generico «come eravamo rimasti»
    //  (v1 nome, v2 consulente, come il ricontatto). Senza messaggio, o con lo stato cambiato,
    //  non cambia niente.
    let modelloDaMandare = cand.modello;
    let testoLibero: string | null = null;
    if (cand.messaggio) {
      const nome = nomePerModello(d.nome) ?? "";
      const sc = sceltaInvio(cand.messaggio, {
        finestraAperta: finestraPerTesto(entrateMessaggi[ultimeNoveCifre(numero)], porte.adesso()),
        flussoGenericoCollegato: !!config.flussi[MODELLO_GENERICO],
        nome,
      });
      testoLibero = sc.testoLibero;
      if (sc.generico) {
        const g = campiRicontatto(d, consulente?.data?.nome);
        //  Senza il nome del consulente il generico non si può compilare: resta il modello dello stato.
        if (g.tipo === "campi") {
          modelloDaMandare = MODELLO_GENERICO;
          parametri = Object.values(g.campi);
        }
      }
    }

    /** Perché la prenotazione non c'è stata (se non c'è stata), con la parola dell'SQL. */
    let rifiuto: string | null = null;
    /** La scheda come l'ha riletta il giro dopo la prenotazione. */
    let riletta: SchedaQuando = scheda;
    const ancora = async (): Promise<boolean> => {
      const s = await porte.scheda(userId, scheda.id);
      if (!s) return false;
      riletta = s;
      const ora = porte.adesso();
      const buona = decisioniDelGiro([s], ora, dati, scelta).find(
        (x) => x.d.tipo === "invia" && x.d.chiave === chiave,
      );
      if (!buona || buona.d.tipo !== "invia") return false;
      //  Il consulente ha cambiato (o tolto) il suo messaggio dopo la lettura: non si manda quello
      //  vecchio. La riga si annulla senza chiave e il giro dopo riparte col messaggio nuovo.
      if (
        JSON.stringify(messaggioDelloStato(buona.tipo, buona.d.scheda)) !==
        JSON.stringify(cand.messaggio ?? null)
      )
        return false;
      //  Stessa chiave ma stato cambiato (r|tel9|giorno è uguale per quattro stati):
      //  se il modello non è più lo stesso, non si manda quello.
      return (
        modelloETag(
          buona.tipo,
          buona.d.extra.stato,
          buona.tipo === "meet_oggi" && mattinaColLink(buona.d.scheda, config.flussi),
          !!config.flussi[MODELLO_PRIMO_CONTATTO_TRE_FASCE],
        )?.modello === cand.modello
      );
    };

    const porta: PortePorta = {
      ...base,
      client: () => conTag(base.client(), cand.tag),
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
            !MOTIVI_DEL_GIRO.includes(r.motivo)
            ? r
            : { motivo: "gia_preso" };
        }
        //  ⚠️ Rilegge la scheda e rifà la decisione: fra la lettura del giro e
        //   ora la scheda può essere cambiata (meet spostato, consenso tolto, STOP).
        let ancoraBuona = false;
        try {
          ancoraBuona = await ancora();
        } catch (e) {
          //  La rilettura non è riuscita: la riga prenotata non deve restare
          //  appesa (diventerebbe «incerto» e quel messaggio non partirebbe più).
          //  Si annulla e il giro si ferma senza spegnere niente.
          porte.avviso(`giro_rilettura_errore_${codiceErrore(e)}`);
          await porte.annulla(userId, r.id, "rilettura_non_riuscita").catch(() => undefined);
          rifiuto = "rilettura_non_riuscita";
          return { motivo: "gia_preso" };
        }
        if (!ancoraBuona) {
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
      //  Il giorno prima: il testo proprio (`hgl_meet_domani_testo`), mai il modello Meta.
      modello: cand.soloTesto ? TESTO_MEET_DOMANI : modelloDaMandare,
      parametri,
      ...(testoLibero ? { testoLibero } : {}),
      nome: d.nome,
      leadId: scheda.id,
      tipo: cand.tipo,
      chiave,
      ...(cand.soloTesto ? { soloTesto: true } : {}),
    });

    //  ── Rifiutato dalla prenotazione: non è partito niente. ──
    switch (rifiuto as string | null) {
      case "tetto_totale":
        nota = "Tetto di messaggi di oggi raggiunto";
        esito.saltati++;
        //  Con la riserva i tre che la rispettano si fermano prima: gli altri
        //  (appuntamenti) possono ancora partire. Se il tetto è pieno per tutti, si chiude tutto.
        return { fine: "chiudi", tipi: RISERVATI.includes(cand.tipo) ? RISERVATI : ORDINE_GIRO };
      case "tetto_ricontatti":
        nota = "Tetto di ricontatti di oggi raggiunto";
        esito.saltati++;
        return { fine: "chiudi", tipi: ["ricontatto"] };
      case "tetto_lead_nuovi":
        nota = "Tetto di messaggi ai lead nuovi di oggi raggiunto";
        esito.saltati++;
        return {
          fine: "chiudi",
          tipi: ["primo_contatto", "richiamo_24h", "ritorno", "casi_reali"],
        };
      case "ritmo":
        esito.saltati++;
        return { fine: "chiudi", tipi: TIPI_COL_RITMO as TipoGiro[] };
      case "pausa_contatto":
        esito.saltati++;
        return { fine: "continua" };
      case "scheda_cambiata":
        esito.saltati++;
        return { fine: "continua" };
      case "rilettura_non_riuscita":
        esito.saltati++;
        return { fine: "ferma" };
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
        else if (cand.tipo === "ricontatto") esito.ricontattiInviati++;
        else esito.nuoviInviati++;
        //  Il registro dell'istantanea: i tentativi dopo vedono pausa, tetti e freno.
        invii.push({
          telefono: numero,
          tipo: cand.tipo,
          stato: "inviato",
          prenotatoIl: ora.toISOString(),
          chiave,
        });
        //  I casi reali sono il seguito del primo contatto: la scheda resta «In attesa» con la
        //  scadenza e l'invio di quello (le risposte non guardano l'id dell'invio), niente
        //  nuova scadenza che farebbe slittare il richiamo.
        const cambio =
          cand.tipo === "casi_reali"
            ? null
            : dopoInvio(
                riletta.data.contattoWa,
                ingressoInvio(cand.tipo, extra, ora, r.invioId ?? ""),
              );
        if (cambio) {
          await porte
            .aggiornaContatto(userId, scheda.id, cambio)
            .catch((e) => porte.avviso(`giro_contatto_errore_${codiceErrore(e)}`));
        }
        //  I quattro stati dopo la consulenza: la chat va a stella 1 (anche se ne aveva 2 o 3).
        //  Un guasto qui NON ferma il giro né rimanda il messaggio: già partito, si avvisa il codice.
        if (
          cand.tipo === "ricontatto" &&
          (STATI_STELLA_UNO as readonly unknown[]).includes(riletta.data.stato)
        ) {
          try {
            const s = await porte.stellaUno(numero);
            if (s === "conflitto") porte.avviso("giro_stella_conflitto");
          } catch (e) {
            porte.avviso(`giro_stella_errore_${codiceErrore(e)}`);
          }
        }
        //  Dopo il primo messaggio (o il ritorno) la scheda «da contattare» passa ad «Attesa
        //  WhatsApp». Solo dopo un «inviato»: chi non lo riceve resta com'è. La condizione
        //  «ancora da contattare» la rifà la funzione SQL dentro la scrittura.
        if (
          (cand.tipo === "primo_contatto" || cand.tipo === "ritorno") &&
          riletta.data.stato === "da_contattare"
        ) {
          await porte
            .attesaWhatsapp(userId, scheda.id, ora)
            .catch((e) => porte.avviso(`giro_stato_errore_${codiceErrore(e)}`));
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
      case "saltato":
        //  Solo testo e la finestra si è chiusa tra la decisione e l'invio: non è partito
        //  niente, non si paga, non è un guasto. La riga resta «saltato» con la sua chiave.
        esito.saltati++;
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
        const frase = `ManyChat ha rifiutato l'invio (${r.codice ?? "blocco"})`;
        problema(scheda, cand.tipo, frase);
        //  Chiave rifiutata (401), permesso negato (403), limite (429), chiave
        //  mancante, registro o configurazione che non vanno: si spegne subito.
        if (bloccoImmediato(r.codice)) {
          await spegni(frase);
          return { fine: "ferma" };
        }
        //  Ogni altro 4xx può essere UN contatto «rotto» (cancellato in ManyChat,
        //  inattivo…): non deve spegnere tutto al primo. Conta come fallito, e al
        //  secondo di fila si spegne.
        falliti++;
        return finisciSeTroppi();
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
  let colRitmo = 0;
  let tentativi = 0;
  const chiusi = new Set<TipoGiro>();
  for (const cand of candidati) {
    if (inviati >= MAX_INVII_PER_GIRO || tentativi >= MAX_TENTATIVI_PER_GIRO) break;
    if (chiusi.has(cand.tipo)) continue;
    const aspettaRitmo = TIPI_COL_RITMO.includes(cand.tipo);
    if (aspettaRitmo && colRitmo >= MAX_COL_RITMO_PER_GIRO) continue;
    //  Dopo 20 s dall'inizio non se ne apre un altro.
    if (porte.adesso().getTime() - inizio.getTime() >= TEMPO_GIRO_MS) break;
    tentativi++;
    const t = await tenta(cand);
    if (t.fine === "inviato") {
      inviati++;
      if (aspettaRitmo) colRitmo++;
    }
    if (t.fine === "chiudi") t.tipi.forEach((x) => chiusi.add(x));
    if (t.fine === "ferma") break;
  }

  //  8. Lo stato per il riquadro.
  const fine = porte.adesso();
  const stato: StatoGiroSalvato = {
    ultimoInvioIl,
    oggi: {
      promemoria: contaOggi(invii, oggi, ["promemoria"]),
      ricontatti: contaOggi(invii, oggi, ["ricontatto"]),
      leadNuovi: contaOggi(invii, oggi, [
        "primo_contatto",
        "richiamo_24h",
        "ritorno",
        "casi_reali",
      ]),
      totale: contaOggi(invii, oggi, TIPI_NEI_TETTI),
      risposte: contaRisposteOggi(invii, oggi),
    },
    problemi: unisciProblemi(statoPrima.problemi ?? [], problemi),
    nota,
    fermo: null,
  };
  await porte.scriviGiro({ ultimoGiroIl: fine, falliti, stato });
  return { ...esito, ...(spento ? { spento: true } : {}) };
}

/** I motivi che la prenotazione del giro dà e che la porta non conosce: li legge il giro. */
const MOTIVI_DEL_GIRO = [
  "tetto_totale",
  "tetto_ricontatti",
  "tetto_lead_nuovi",
  "ritmo",
  "gia_preso",
];
/** I cinque tipi che rispettano la riserva per gli appuntamenti (`totale − 30`). */
const RISERVATI: TipoGiro[] = [
  "primo_contatto",
  "richiamo_24h",
  "ritorno",
  "casi_reali",
  "ricontatto",
];

function statoVuoto(): StatoGiroSalvato {
  return {
    ultimoInvioIl: null,
    oggi: { promemoria: 0, ricontatti: 0, leadNuovi: 0, totale: 0, risposte: 0 },
    problemi: [],
    nota: null,
    fermo: null,
  };
}
