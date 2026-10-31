/** ── IL GIRO DEL CRON: LEGGE, DECIDE, SEGNA, INVIA, SCRIVE LO STATO ──────────
 *
 *  Commessa 2026-10-22. Lo chiama ogni 2 minuti `/hooks/promemoria-whatsapp`
 *  (e, a secco, il tasto «Controlla ora» del titolare). Tutto quello che
 *  tocca il mondo — database, Meta — arriva dalle `porte`: la rotta le
 *  collega a Supabase e alla Graph API, le prove a un database finto che si
 *  comporta come le funzioni SQL. Così l'ordine delle cose si prova davvero.
 *
 *  L'ORDINE, CHE È LA SICUREZZA
 *   1. un giro a meno di 60 s dall'ultimo esce subito (correzione 5: la rotta
 *      si può chiamare con la chiave pubblica, non deve bruciare i limiti)
 *   2. migrazione, interruttore, chiavi, App Secret, sandbox: se manca
 *      qualcosa non si legge nemmeno una scheda
 *   3. dopo un errore tecnico si aspettano 10 minuti
 *   4. le decisioni; i segni «preesistente» e «non inviato»
 *   5. solo se c'è qualcuno da avvisare: il controllo del modello su Meta
 *   6. per ognuno (massimo 15): SEGNO PRIMA (`aggancia`, vince un giro
 *      solo), poi l'invio, poi l'esito. Errore di rete = il segno resta;
 *      rifiuto tecnico = il segno si toglie e il giro si ferma.
 *  ⚠️ I TOKEN NON PASSANO DI QUI: le impostazioni arrivano senza segreti, la
 *   rotta li tiene per sé. La risposta ha solo conteggi: niente id né nomi.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LeadData, PromemoriaWhatsapp } from "../types";
import { aRoma } from "./formati";
import { NOME_MODELLO, NOME_MODELLO_SENZA_LINK, decidiInvio, pezzoDaScrivere, type Decisione } from "./invio";
import { statoConferma } from "./conferma";
import {
  esitoInvio,
  valutaPronto,
  FRASI_BLOCCO,
  type CodiceBlocco,
  type EsitoInvio,
  type RispostaInvio,
} from "./pronto";

export const MAX_PER_GIRO = 15;
/** Col canale ManyChat ogni conferma fa 4-5 chiamate da fino a 8 s l'una, e il
 *  cron aspetta 45 s: al massimo 2 conferme per giro (2 ogni 2 minuti smaltisce
 *  30 conferme in mezz'ora) e nessun invio nuovo dopo 20 s dall'inizio del
 *  giro. Col canale `cloud` resta tutto com'è (15, senza limite di tempo). */
export const MAX_PER_GIRO_MANYCHAT = 2;
export const TEMPO_GIRO_MS = 20_000;
export const GIRO_MINIMO_S = 60;
export const PAUSA_DOPO_ERRORE_MIN = 10;

export interface ConfigPromemoria {
  acceso: boolean;
  attivoDal?: string | null;
  /** «da_fare» dopo ogni accensione: il primo giro marca tutto preesistente */
  avvio?: "da_fare" | "fatto";
}

/** Quello che il giro lascia scritto in app_config per il riquadro. */
export interface StatoGiro {
  giroIl: string;
  pronto: boolean;
  blocco?: CodiceBlocco;
  frase: string;
  riprovaDopo?: string | null;
  inviatiOggi: number;
  confermatiOggi: number;
  senzaRisposta: number;
  inAttesa: number;
  /** vedi `EsitoGiro.nota` */
  nota?: string;
}

/** Una riga di whatsapp_settings, SENZA i segreti. */
export interface Impostazione {
  userId: string;
  haChiavi: boolean;
  haWaba: boolean;
  haAppSecret: boolean;
  mode: "live" | "sandbox";
  /** il canale dell'installazione; assente = `cloud` (come prima del 23/10) */
  canale?: "cloud" | "manychat";
  /** col canale ManyChat: c'è `MANYCHAT_API_KEY` fra i segreti? */
  haChiaveManychat?: boolean;
}

export interface SchedaGiro {
  id: string;
  data: Partial<LeadData>;
  updated_at: string | null;
  /** il link per-persona (`valoriDaLead`), "" se manca */
  link: string;
  /** il consulente della scheda non usa Meetly (`crm_consultants.data.invitoMeet = "senza"`):
   *  la conferma parte col gemello senza link. Assente = usa Meetly. */
  senzaMeetly?: boolean;
}

export interface Porte {
  adesso(): Date;
  leggiConfig(): Promise<ConfigPromemoria | null>;
  scriviConfig(c: ConfigPromemoria): Promise<void>;
  leggiStato(): Promise<StatoGiro | null>;
  scriviStato(s: StatoGiro): Promise<void>;
  /** true = le funzioni promemoria_* e la colonna ci sono */
  provaMigrazione(): Promise<boolean>;
  impostazioni(): Promise<Impostazione[]>;
  /** le schede con appuntamento da oggi (Roma) in avanti */
  schede(imp: Impostazione, oggi: string): Promise<SchedaGiro[]>;
  numeriStop(imp: Impostazione): Promise<string[]>;
  aggancia(id: string, chiave: string, pezzo: Partial<PromemoriaWhatsapp>): Promise<boolean>;
  aggiorna(
    id: string,
    pezzo: Partial<PromemoriaWhatsapp>,
    seChiave: string | null,
  ): Promise<boolean>;
  controllaModello(
    imp: Impostazione,
    /** assente = `NOME_MODELLO`; i consulenti senza Meetly chiedono il gemello `_sl` */
    modello?: string,
  ): Promise<{ trovato: boolean; stato?: string } | { errore: CodiceBlocco }>;
  /** `contesto`: la scheda e il giro, per il registro della porta ManyChat
   *  (la chiave del registro è unica per tentativo, così un nuovo tentativo
   *  dopo un rifiuto tecnico non trova la riga di quello prima). */
  invia(
    imp: Impostazione,
    numero: string,
    parametri: string[],
    contesto?: { leadId: string; chiave: string; giro: string; modello?: string },
  ): Promise<RispostaInvio>;
  registraInvio(
    imp: Impostazione,
    id: string,
    numero: string,
    esito: EsitoInvio,
    /** il modello inviato (assente = `NOME_MODELLO`): serve al segnaposto nella chat */
    modello?: string,
  ): Promise<void>;
}

export interface EsitoGiro {
  ok: boolean;
  prova: boolean;
  pronto: boolean;
  blocco?: CodiceBlocco;
  frase: string;
  inviati: number;
  saltati: number;
  inAttesa: number;
  partirebbero?: number;
  saltato?: string;
  /** una frase per il titolare se qualcosa è fermo senza essere un guasto (es. il flusso senza
   *  link non è collegato: chi non usa Meetly aspetta, mai il link) */
  nota?: string;
}

export async function giroPromemoria(porte: Porte, o: { prova: boolean }): Promise<EsitoGiro> {
  const { prova } = o;
  const adesso = porte.adesso();
  const ora = adesso.toISOString();
  const oggi = aRoma(adesso).giorno;
  const prima = await porte.leggiStato();
  const conti = { inviati: 0, saltati: 0, inAttesa: 0, partirebbero: 0 };
  const esito = (p: { pronto: boolean; blocco?: CodiceBlocco; frase: string }): EsitoGiro => ({
    ok: true,
    prova,
    ...p,
    inviati: conti.inviati,
    saltati: conti.saltati,
    inAttesa: conti.inAttesa,
    ...(prova ? { partirebbero: conti.partirebbero } : {}),
  });

  if (!prova) {
    if (prima?.giroIl && adesso.getTime() - Date.parse(prima.giroIl) < GIRO_MINIMO_S * 1000)
      return { ...esito({ pronto: !!prima.pronto, frase: prima.frase }), saltato: "troppo presto" };
    //  Il segno del giro si scrive subito: due chiamate ravvicinate non
    //  partono entrambe (l'idempotenza vera resta comunque `aggancia`).
    await porte.scriviStato({ ...vuoto(ora), ...(prima ?? {}), giroIl: ora });
    if (prima?.riprovaDopo && Date.parse(prima.riprovaDopo) > adesso.getTime())
      return {
        ...esito({ pronto: false, blocco: prima.blocco, frase: prima.frase }),
        saltato: "pausa",
      };
  }

  const config = await porte.leggiConfig();
  const migrazione = await porte.provaMigrazione();
  const elenco = await porte.impostazioni();
  const contatori = { inviatiOggi: 0, confermatiOggi: 0, senzaRisposta: 0 };
  /** Le conferme dei consulenti senza Meetly ferme perché il flusso del gemello non è collegato. */
  let nota: string | undefined;
  const chiudi = async (
    p: { pronto: boolean; blocco?: CodiceBlocco; frase: string },
    pausa = false,
  ) => {
    if (!prova)
      await porte.scriviStato({
        giroIl: ora,
        ...p,
        ...(nota ? { nota } : {}),
        riprovaDopo: pausa
          ? new Date(adesso.getTime() + PAUSA_DOPO_ERRORE_MIN * 60_000).toISOString()
          : null,
        ...contatori,
        inAttesa: conti.inAttesa,
      });
    return { ...esito(p), ...(nota ? { nota } : {}) };
  };
  const base = (imp?: Impostazione) => ({
    //  A secco l'interruttore non conta: «Controlla ora» si preme PRIMA di
    //  accendere, per sapere se il resto è a posto.
    acceso: prova || !!config?.acceso,
    migrazione,
    haChiavi: !!imp?.haChiavi,
    haWaba: !!imp?.haWaba,
    haAppSecret: !!imp?.haAppSecret,
    mode: imp?.mode ?? "sandbox",
    canale: imp?.canale,
    haChiaveManychat: imp?.haChiaveManychat,
  });

  //  Il primo motivo che blocca, prima di leggere una sola scheda.
  const pronte = elenco.filter((imp) => valutaPronto({ ...base(imp), modello: null }).pronto);
  if (pronte.length === 0) return chiudi(valutaPronto({ ...base(elenco[0]), modello: null }));

  const primoGiro = config?.avvio !== "fatto";
  let finale = valutaPronto({ ...base(pronte[0]), modello: null });
  for (const imp of pronte) {
    const schede = await porte.schede(imp, oggi);
    const numeriStop = await porte.numeriStop(imp);
    const daInviare: { s: SchedaGiro; dec: Extract<Decisione, { azione: "invia" }> }[] = [];
    for (const s of schede) {
      conta(s.data, oggi, adesso, contatori);
      const dec = decidiInvio({
        d: s.data,
        link: s.link,
        aggiornataIl: s.updated_at,
        numeriStop,
        adesso,
        primoGiro,
        senzaLink: !!s.senzaMeetly,
      });
      if (dec.azione === "invia") daInviare.push({ s, dec });
      if (dec.azione !== "salta" && dec.azione !== "preesistente") continue;
      conti.saltati++;
      if (prova) continue;
      const pezzo = pezzoDaScrivere(dec, ora) ?? {};
      if (dec.azione === "salta" && dec.stato === "incerto")
        await porte.aggiorna(s.id, pezzo, dec.chiave);
      else await porte.aggancia(s.id, dec.chiave, pezzo);
    }
    conti.partirebbero += daInviare.length;
    //  Il controllo su Meta costa una chiamata: si fa solo se serve (o a secco,
    //  dove il titolare vuole sapere se è tutto a posto).
    if (daInviare.length === 0 && !prova) continue;
    //  Il modello col link si controlla se serve a qualcuno (o se non c'è nessuno, come prima); il
    //  gemello senza link solo se c'è chi lo usa, e il suo guasto non ferma gli altri.
    const serveConLink =
      daInviare.length === 0 || daInviare.some((x) => x.dec.modello === NOME_MODELLO);
    const m = serveConLink ? await porte.controllaModello(imp) : null;
    finale = valutaPronto({
      ...base(imp),
      modello: !m || "errore" in m ? null : m,
      erroreControllo: m && "errore" in m ? m.errore : undefined,
    });
    if (!finale.pronto) return chiudi(finale, !!m && "errore" in m);
    let gemelloPronto = true;
    if (daInviare.some((x) => x.dec.modello === NOME_MODELLO_SENZA_LINK)) {
      const g = await porte.controllaModello(imp, NOME_MODELLO_SENZA_LINK);
      gemelloPronto = valutaPronto({
        ...base(imp),
        modello: "errore" in g ? null : g,
        erroreControllo: "errore" in g ? g.errore : undefined,
      }).pronto;
      if (!gemelloPronto)
        nota =
          "Flusso senza link non collegato in ManyChat: le conferme ai consulenti che non usano Meetly aspettano (il link non parte mai)";
    }
    if (prova) continue;

    const manychat = imp.canale === "manychat";
    for (const { s, dec } of daInviare) {
      //  ManyChat: due per giro e niente di nuovo dopo 20 s (il cron aspetta 45 s).
      const finito = manychat
        ? conti.inviati >= MAX_PER_GIRO_MANYCHAT ||
          porte.adesso().getTime() - adesso.getTime() >= TEMPO_GIRO_MS
        : conti.inviati >= MAX_PER_GIRO;
      if (finito) {
        conti.inAttesa++;
        continue;
      }
      //  Chi non usa Meetly senza il flusso del gemello: resta fermo, nessun segno sulla scheda.
      if (dec.modello === NOME_MODELLO_SENZA_LINK && !gemelloPronto) {
        conti.inAttesa++;
        continue;
      }
      //  ⚠️ IL SEGNO PRIMA DELL'INVIO. false = un altro giro l'ha già preso.
      const mio = await porte.aggancia(s.id, dec.chiave, pezzoDaScrivere(dec, ora) ?? {});
      if (!mio) continue;
      const e = esitoInvio(
        await porte
          .invia(imp, dec.numero, dec.parametri, {
            leadId: s.id,
            chiave: dec.chiave,
            giro: ora,
            modello: dec.modello,
          })
          .catch(() => ({ rete: true })),
      );
      if (e.tipo === "ok") {
        await porte.aggiorna(
          s.id,
          { stato: "inviato", inviatoIl: ora, waMessageId: e.waId },
          dec.chiave,
        );
        await porte.registraInvio(imp, s.id, dec.numero, e, dec.modello);
        conti.inviati++;
        contatori.inviatiOggi++;
        contatori.senzaRisposta++;
        continue;
      }
      if (e.tipo === "rifiuto" && e.errore.tipo === "cliente") {
        await porte.aggiorna(
          s.id,
          { stato: "non_recapitato", motivo: e.errore.codice },
          dec.chiave,
        );
        await porte.registraInvio(imp, s.id, dec.numero, e, dec.modello);
        continue;
      }
      if (e.tipo === "riprova") {
        //  Non è partito e non è colpa di nessuno (pausa per contatto, invio già
        //  preso): il segno si toglie, niente blocco, e si passa alla scheda dopo.
        await porte.aggiorna(
          s.id,
          { chiave: null, stato: null, invioIl: null, volte: dec.volte - 1 },
          dec.chiave,
        );
        conti.inAttesa++;
        continue;
      }
      if (e.tipo === "rifiuto") {
        //  Rifiuto esplicito, tecnico o limite: Meta NON l'ha preso. Si toglie
        //  il segno (si riproverà) e ci si ferma: niente martellamento.
        //  ⚠️ Col canale ManyChat la chiave resta e il motivo dice «canale»:
        //   la scheda compare in «Da sentire» con «conferma non partita:
        //   WhatsApp in passaggio a ManyChat» (conferma.ts), e riprende da sola
        //   appena il canale torna a posto (stato vuoto = si può riprovare).
        await porte.aggiorna(
          s.id,
          manychat
            ? { stato: null, invioIl: null, volte: dec.volte - 1, motivo: "canale" }
            : { chiave: null, stato: null, invioIl: null, volte: dec.volte - 1 },
          dec.chiave,
        );
        const blocco = e.errore.codice as CodiceBlocco;
        return chiudi({ pronto: false, blocco, frase: FRASI_BLOCCO[blocco] }, true);
      }
      //  Incerto: il segno RESTA (diventerà «incerto» fra 10 minuti), e ci si ferma.
      return chiudi(
        { pronto: false, blocco: "meta_incerto", frase: FRASI_BLOCCO.meta_incerto },
        true,
      );
    }
  }
  if (!prova && primoGiro)
    await porte.scriviConfig({ ...(config ?? { acceso: true }), avvio: "fatto" });
  return chiudi(finale);
}

const vuoto = (ora: string): StatoGiro => ({
  giroIl: ora,
  pronto: false,
  frase: "",
  inviatiOggi: 0,
  confermatiOggi: 0,
  senzaRisposta: 0,
  inAttesa: 0,
});

/** I conti di oggi per la frase del titolare. */
function conta(
  d: Partial<LeadData>,
  oggi: string,
  adesso: Date,
  c: { inviatiOggi: number; confermatiOggi: number; senzaRisposta: number },
) {
  const p = d.promemoria;
  const diOggi = (x?: string | null) => !!x && aRoma(new Date(x)).giorno === oggi;
  if (diOggi(p?.inviatoIl)) {
    c.inviatiOggi++;
    if (statoConferma(d, adesso).tipo !== "confermato") c.senzaRisposta++;
  }
  if (diOggi(p?.confermatoIl)) c.confermatiOggi++;
}
