/** ── LE REGOLE DI VISTA DEI COMPONENTI MANYCHAT (puro) ─────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat), compito 5 (Dev D). Qui ci sono
 *  le frasi e le scelte dei componenti: tutto quello che si può provare senza
 *  disegnare. Il disegno è in PastigliaContatto, OkWhatsapp, RisposteOggi e
 *  ManychatPannello; le prove sono in `prove/manychat/pannello.mjs`.
 *
 *  Modulo PURO: niente rete, niente React, niente orologio (`adesso` arriva
 *  sempre da fuori). I tipi delle rotte stanno in client-crm.ts (solo `import
 *  type`, che non entra nel pacchetto delle prove).
 *
 *  ⚠️ IL COLORE NON BASTA MAI. Ogni tono ha accanto una parola (l'etichetta del
 *   secondo stato, «ok» / «problema» / «da verificare»).
 *  ⚠️ NIENTE NUMERI DI TELEFONO: né qui né nelle frasi. I nomi arrivano già
 *   abbreviati dal server.
 *  ───────────────────────────────────────────────────────────────────────── */
import { LEAD_STATUS_LABEL } from "../types";
import type {
  ConsensoModulo,
  ContattoWa,
  LeadData,
  LeadStatus,
  OkWhatsapp,
  StatoContattoWa,
} from "../types";
import type { Tono } from "../ui";
import { aRoma } from "../promemoria/formati";
import type {
  CollegamentoManychat,
  ConfigManychat,
  FoglioManychat,
  FraseModulo,
  GiroManychat,
  RigaCollegamento,
  StatoManychat,
} from "./client-crm";
import {
  DA_AUTOMATICO,
  ETICHETTE_CONTATTO,
  FRASE_STOP_RISERVATO,
  STATI_CONTATTO,
  TONI_CONTATTO,
  istanteDiRoma,
  statoContattoEffettivo,
  type ToneContatto,
} from "./contatto";
import { TETTO_PRIMA_SETTIMANA, TETTO_RICONTATTI, TETTO_TOTALE } from "./quando";

/* ═══════════════════════════════════════════════════════════════════════════
   1. ORE E GIORNI (sempre ora di Roma, come nel resto del CRM)
   ═════════════════════════════════════════════════════════════════════════ */

const PEZZI = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function pezziDi(iso: string | null | undefined) {
  const t = Date.parse(String(iso ?? ""));
  if (!Number.isFinite(t)) return null;
  const p = Object.fromEntries(PEZZI.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return { g: p.day, m: p.month, h: p.hour, mi: p.minute };
}

/** «23/10 15:05»; vuoto se la data non si legge. */
export function quandoBreve(iso: string | null | undefined): string {
  const p = pezziDi(iso);
  return p ? `${p.g}/${p.m} ${p.h}:${p.mi}` : "";
}

/** «23/10». */
export function giornoBreve(iso: string | null | undefined): string {
  const p = pezziDi(iso);
  return p ? `${p.g}/${p.m}` : "";
}

/** «15:05». */
export function oraBreve(iso: string | null | undefined): string {
  const p = pezziDi(iso);
  return p ? `${p.h}:${p.mi}` : "";
}

const MIN = 60_000;
const ORA = 60 * MIN;
const GIORNO = 24 * ORA;

/* ═══════════════════════════════════════════════════════════════════════════
   2. ERRORI IN CHIARO (le chiamate del browser)
   ═════════════════════════════════════════════════════════════════════════ */

export const FRASE_RETE = "Il server non risponde: riprova fra poco.";

/** La frase da mostrare quando una rotta risponde male. Se il server ha già
 *  scritto un motivo (e non è un muro di testo) vale quello. */
export function fraseErrore(stato: number, dalServer?: string): string {
  const s = typeof dalServer === "string" ? dalServer.trim() : "";
  const server = s && s.length <= 200 ? s : "";
  if (stato === 0) return FRASE_RETE;
  if (stato === 401) return "Serve l'accesso al CRM: rientra e riprova.";
  if (stato === 403) return server || "Non hai il permesso per questa operazione.";
  if (stato === 404) return server || "Non trovato: ricarica la pagina.";
  if (stato === 409) return server || "La scheda è cambiata mentre salvavi: riprova.";
  if (stato === 429) return "Troppe richieste: aspetta un momento e riprova.";
  if (stato >= 500) return server || "Il server ha avuto un problema: riprova fra poco.";
  return server || "Non salvato.";
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. LA PASTIGLIA DEL SECONDO STATO
   ═════════════════════════════════════════════════════════════════════════ */

/** Il tono del secondo stato → il tono del CRM (stesse tinte delle altre
 *  pastiglie: nessuna tavolozza nuova da imparare). */
export const TONO_UI_CONTATTO: Record<ToneContatto, Tono> = {
  neutro: "neutro",
  info: "da_lavorare",
  ok: "vinta",
  attenzione: "in_sospeso",
  stop: "persa",
};

export const ETICHETTA_NON_SEGNATO = "Non segnato";

export interface VistaContatto {
  /** `null` = la scheda non ha un secondo stato */
  stato: StatoContattoWa | null;
  etichetta: string;
  tono: Tono;
  /** vero se «In attesa» è scaduta e si mostra «Non ha risposto» */
  scaduta: boolean;
}

/** Quello che la pastiglia mostra: lo stato EFFETTIVO (con la scadenza
 *  calcolata), mai quello grezzo. */
export function vistaContatto(
  d: Pick<Partial<LeadData>, "contattoWa"> | null | undefined,
  adesso: Date,
): VistaContatto {
  const stato = statoContattoEffettivo(d, adesso);
  if (!stato)
    return { stato: null, etichetta: ETICHETTA_NON_SEGNATO, tono: "neutro", scaduta: false };
  return {
    stato,
    etichetta: ETICHETTE_CONTATTO[stato],
    tono: TONO_UI_CONTATTO[TONI_CONTATTO[stato]],
    scaduta: stato !== d?.contattoWa?.stato,
  };
}

/** Che cosa significa ogni stato, in una riga (SPEC §4). */
export const NOTE_STATO_CONTATTO: Record<StatoContattoWa, string> = {
  contattato: "Gli abbiamo parlato o scritto",
  in_attesa: "Si aspetta una risposta",
  ha_risposto: "Ha scritto dopo il nostro messaggio",
  non_ha_risposto: "Il tempo per rispondere è scaduto",
  da_ricontattare: "Serve un'altra mossa di una persona",
  stop: "Non vuole messaggi",
  non_raggiungibile: "Numero non su WhatsApp o invio rifiutato",
};

export interface SceltaContatto {
  stato: StatoContattoWa;
  etichetta: string;
  nota: string;
  tono: Tono;
  /** è lo stato che si vede adesso */
  attuale: boolean;
  /** vero se si può premere */
  abilitata: boolean;
  /** perché non si può premere */
  perche?: string;
  /** vero se prima di salvare si chiede conferma (STOP: poi lo toglie solo il titolare) */
  chiedeConferma: boolean;
}

/** Le sette scelte della finestra. Se la scheda è in STOP e chi lavora non ha il
 *  permesso «impostazioni», tutte le altre sono chiuse (lo STOP lo toglie solo il
 *  titolare; la difesa vera è nella rotta). */
export function sceltePerContatto(
  d: Pick<Partial<LeadData>, "contattoWa"> | null | undefined,
  adesso: Date,
  puoTogliereStop: boolean,
): SceltaContatto[] {
  const attuale = statoContattoEffettivo(d, adesso);
  const inStop = attuale === "stop";
  return STATI_CONTATTO.map((stato) => {
    const chiusa = inStop && stato !== "stop" && !puoTogliereStop;
    return {
      stato,
      etichetta: ETICHETTE_CONTATTO[stato],
      nota:
        stato === "stop"
          ? `${NOTE_STATO_CONTATTO.stop} · lo toglie solo il titolare`
          : NOTE_STATO_CONTATTO[stato],
      tono: TONO_UI_CONTATTO[TONI_CONTATTO[stato]],
      attuale: stato === attuale,
      abilitata: !chiusa,
      ...(chiusa ? { perche: FRASE_STOP_RISERVATO } : {}),
      chiedeConferma: stato === "stop" && !inStop,
    };
  });
}

/** Frase della riga di storia: «In attesa · promemoria automatico, 23/10 15:05»,
 *  «Ha risposto · 23/10 15:09 · “ok ci sono”», «Contattato · a mano da Mario,
 *  23/10 15:05». */
export function fraseVoceStoria(v: ContattoWa["storia"][number]): string {
  const quando = quandoBreve(v.il);
  const automatico = v.da === DA_AUTOMATICO;
  let chi = "";
  if (automatico) {
    if (v.stato === "in_attesa" && v.motivo === "promemoria") chi = "promemoria automatico";
    else if (v.stato === "in_attesa" && v.motivo === "ricontatto") chi = "ricontatto automatico";
    else if (v.stato === "stop") chi = "ha scritto STOP";
    else if (v.stato === "non_raggiungibile") chi = v.motivo?.trim() || "invio rifiutato";
    else if (v.stato === "non_ha_risposto" && v.motivo === "promemoria")
      chi = "promemoria senza risposta";
    else if (v.stato === "non_ha_risposto" && v.motivo === "ricontatto")
      chi = "ricontatto senza risposta";
    else if (v.stato !== "ha_risposto") chi = "automatico";
  } else {
    chi = `a mano da ${v.da}`;
  }
  const mezzo = [chi, quando].filter(Boolean).join(chi && quando ? ", " : "");
  const testa = [ETICHETTE_CONTATTO[v.stato] ?? v.stato, mezzo].filter(Boolean).join(" · ");
  return v.anteprima ? `${testa} · “${v.anteprima}”` : testa;
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. «OK A WHATSAPP»
   ═════════════════════════════════════════════════════════════════════════ */

/** Il valore che il browser scrive nella scheda. Chi lo mette è chi lavora;
 *  se il nome non c'è si scrive «sconosciuto», come per il secondo stato. */
export function nuovoOkWhatsapp(si: boolean, chi: string, adesso: Date): OkWhatsapp {
  return { si, il: adesso.toISOString(), da: chi.trim() || "sconosciuto" };
}

export interface VistaOk {
  acceso: boolean;
  /** la riga sotto l'interruttore */
  riga: string;
  /** vero se il cliente ha lasciato il numero nel modulo */
  dalModulo: boolean;
  /** il modulo vale come consenso? `null` = non si sa (chi guarda non conosce
   *  la data della frase) o non c'è nessun modulo */
  valeDalModulo: boolean | null;
}

/** La riga del modulo. Vale come consenso solo se `il` (il giorno in cui ha
 *  lasciato il numero) è uguale o successivo alla data della frase nel modulo:
 *  la stessa regola di `consensoWhatsapp`. Un `il` che non si legge non vale mai. */
function rigaModulo(
  modulo: ConsensoModulo,
  frase: string | null | undefined,
): { riga: string; vale: boolean | null } {
  const il = Date.parse(String(modulo.il ?? ""));
  if (!Number.isFinite(il))
    return { riga: "Nel modulo, ma la data non si legge: non vale come consenso", vale: false };
  const giorno = giornoBreve(modulo.il);
  if (frase === undefined)
    return { riga: `Ha lasciato il numero nel modulo il ${giorno}`, vale: null };
  const dal = Date.parse(String(frase ?? ""));
  if (!Number.isFinite(dal))
    return {
      riga: `Nel modulo del ${giorno}: non vale finché non segni il giorno della frase`,
      vale: false,
    };
  return il >= dal
    ? {
        riga: `Ha lasciato il numero nel modulo il ${giorno}: vale (la frase c'è dal ${giornoBreve(frase)})`,
        vale: true,
      }
    : {
        riga: `Nel modulo del ${giorno}: non vale, precedente alla frase (dal ${giornoBreve(frase)})`,
        vale: false,
      };
}

/** La riga sotto l'interruttore: «chiesto a voce da Mario, 23/10». Con un
 *  modulo, la riga dice la data e (se `fraseModuloDal` è noto: ISO, o `null` se
 *  non è segnata) se vale o non vale. */
export function vistaOkWhatsapp(
  ok: OkWhatsapp | null | undefined,
  modulo?: ConsensoModulo | null,
  fraseModuloDal?: string | null,
): VistaOk {
  const dalModulo = modulo?.whatsapp === true;
  const dalMod = dalModulo && modulo ? rigaModulo(modulo, fraseModuloDal) : null;
  const giorno = giornoBreve(ok?.il);
  const quando = giorno ? `, ${giorno}` : "";
  if (ok?.si)
    return {
      acceso: true,
      riga: `Chiesto a voce da ${ok.da || "sconosciuto"}${quando}`,
      dalModulo,
      valeDalModulo: dalMod?.vale ?? null,
    };
  if (ok && ok.si === false && ok.il)
    return {
      acceso: false,
      riga: `Tolto da ${ok.da || "sconosciuto"}${quando}`,
      dalModulo,
      valeDalModulo: dalMod?.vale ?? null,
    };
  return {
    acceso: false,
    riga: dalMod?.riga ?? "Non ancora chiesto: senza, promemoria e ricontatti non partono",
    dalModulo,
    valeDalModulo: dalMod?.vale ?? null,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. «OGGI»: CHI HA RISPOSTO E CHI NO AL RICONTATTO AUTOMATICO
   ═════════════════════════════════════════════════════════════════════════ */

/** Per quanti giorni una risposta (o un silenzio) resta in evidenza in «Oggi».
 *  shortcut: finestra fissa di 3 giorni; se serve diversa, si cambia qui.
 *  Chi cambia il secondo stato a mano esce prima dalla striscia. */
export const GIORNI_IN_EVIDENZA = 3;

export interface RigaRisposteOggi<T> {
  scheda: T;
  /** ISO: quando ha risposto, o quando è scaduta l'attesa */
  quando: string;
  /** l'inizio della risposta, se c'è */
  anteprima?: string;
}

/** Chi ha risposto e chi non ha risposto al RICONTATTO AUTOMATICO, dal più
 *  recente. Una risposta o un «Non ha risposto» messi a mano non contano: la
 *  striscia parla solo di quello che ha fatto il sistema. */
export function righeRisposteOggi<T extends { data?: Partial<LeadData> | null }>(
  schede: T[],
  adesso: Date,
): { risposto: RigaRisposteOggi<T>[]; nonRisposto: RigaRisposteOggi<T>[] } {
  const risposto: RigaRisposteOggi<T>[] = [];
  const nonRisposto: RigaRisposteOggi<T>[] = [];
  const dal = adesso.getTime() - GIORNI_IN_EVIDENZA * GIORNO;
  for (const scheda of schede) {
    const c = scheda.data?.contattoWa;
    const stato = statoContattoEffettivo(scheda.data, adesso);
    if (!c || !stato || c.da !== DA_AUTOMATICO) continue;
    if (stato === "ha_risposto") {
      //  Il ricontatto è l'invio subito prima: la voce di sotto è «In attesa» o,
      //  se la risposta è arrivata tardi, «Non ha risposto» (che ne conserva il motivo).
      const prima = c.storia?.[1];
      if (prima?.motivo !== "ricontatto") continue;
      const t = Date.parse(c.il);
      if (!Number.isFinite(t) || t < dal) continue;
      risposto.push({
        scheda,
        quando: c.il,
        ...(c.storia[0]?.anteprima ? { anteprima: c.storia[0].anteprima } : {}),
      });
    } else if (stato === "non_ha_risposto" && c.motivo === "ricontatto") {
      const quando = c.stato === "in_attesa" ? c.scadeRisposta : c.il;
      const t = Date.parse(String(quando ?? ""));
      if (!quando || !Number.isFinite(t) || t < dal) continue;
      nonRisposto.push({ scheda, quando });
    }
  }
  const perData = (a: { quando: string }, b: { quando: string }) =>
    Date.parse(b.quando) - Date.parse(a.quando);
  return { risposto: risposto.sort(perData), nonRisposto: nonRisposto.sort(perData) };
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. IL RIQUADRO DI IMPOSTAZIONI
   ═════════════════════════════════════════════════════════════════════════ */

export type TonoRiquadro = "verde" | "ambra" | "rosso" | "neutro";

/** I modelli che passano da un flusso ManyChat, con il nome che li riconosce la
 *  setter. Un flusso in più nella configurazione si mostra comunque. */
export const MODELLI_FLUSSO: { modello: string; etichetta: string }[] = [
  {
    modello: "consulenza_conferma_presenza",
    etichetta: "Conferma della consulenza («risponda SÌ»)",
  },
  { modello: "hgl_promemoria_meet", etichetta: "Promemoria 20 minuti prima del meet" },
  { modello: "hgl_ricontatto_consulenza", etichetta: "Ricontatto dei consulenti" },
];

/** I flussi della commessa 2026-10-25: le due sequenze e i messaggi per stato.
 *  Restano FUORI da `MODELLI_FLUSSO` (e da `ID_COLLEGAMENTO`): sono righe «in
 *  coda» del collegamento, grigie finché il loro interruttore è spento. Il
 *  quarto modello dei ricontatti (`hgl_ricontatto_consulenza`) è già sopra. */
export const MODELLI_FLUSSO_SEQUENZE: { modello: string; etichetta: string }[] = [
  { modello: "hgl_primo_contatto", etichetta: "Lead nuovo: primo messaggio" },
  {
    modello: "hgl_primo_contatto_tre_fasce",
    etichetta: "Lead nuovo: primo messaggio con mattina, pomeriggio o sera (sostituisce il primo)",
  },
  { modello: "hgl_richiamo_24h", etichetta: "Lead nuovo: richiamo dopo 24 ore" },
  { modello: "hgl_ritorno", etichetta: "Lead nuovo: messaggio di ritorno" },
  { modello: "hgl_casi_reali", etichetta: "Lead nuovo: casi reali" },
  { modello: "hgl_meet_oggi", etichetta: "Giorno del meet: messaggio del mattino" },
  { modello: "hgl_meet_oggi_link", etichetta: "Giorno del meet: mattina col link (facoltativo)" },
  {
    modello: "hgl_meet_domani",
    etichetta: "Giorno del meet: promemoria 24 ore prima (solo testo, senza flusso)",
  },
  { modello: "hgl_meet_adesso", etichetta: "Giorno del meet: all'ora, col link (spento)" },
  { modello: "hgl_meet_da_fissare", etichetta: "Meet da fissare" },
  { modello: "hgl_richiamo_concordato", etichetta: "Richiamo concordato" },
  { modello: "hgl_non_risponde", etichetta: "Non risponde e Segreteria" },
  { modello: "hgl_cliente_assente", etichetta: "Cliente assente" },
  { modello: "hgl_da_riprogrammare", etichetta: "Da riprogrammare" },
  { modello: "hgl_promemoria_sede", etichetta: "Appuntamento in sede" },
  { modello: "hgl_sede_disdetta", etichetta: "Appuntamento in sede disdetto" },
  { modello: "hgl_ultimo_tentativo", etichetta: "Irreperibile: ultimo tentativo" },
  { modello: "hgl_acconto", etichetta: "Attesa acconto" },
  //  Facoltativo: lo sceglie il consulente nella finestra dello stato, per chi non scrive da
  //  più di 24 ore. Senza flusso collegato si manda il modello dello stato.
  { modello: "hgl_come_eravamo_rimasti", etichetta: "Messaggio generico: come eravamo rimasti" },
];

/** Lead nuovi al giorno.
 *  shortcut: stesso valore di `TETTO_LEAD_NUOVI` in `quando.ts`, che lo aggiunge
 *  il compito Q; dopo la fusione si importa da lì e questa riga sparisce (la
 *  prova li confronta appena esiste). */
export const TETTO_LEAD_NUOVI = 150;

/** Gli stati con un messaggio automatico (PIANO §5g), nell'ordine del riquadro.
 *  Un interruttore per riga, spento di serie, in `manychat_config.stati`.
 *  `legatoA`: la riga non ha un interruttore suo ma segue uno di sempre
 *  («Ricontatto fissato» è «Ricontatti dei consulenti»). `insieme`: altri stati
 *  che si accendono e si spengono con questo (stessa etichetta nel CRM). */
export interface StatoRiquadro {
  stato: LeadStatus;
  insieme?: LeadStatus[];
  etichetta: string;
  modello: string;
  /** quando parte, in una riga */
  quando: string;
  /** a chi */
  chi: string;
  legatoA?: "ricontatti";
}

const CONSULENTI = "Lead dei consulenti";
const A_DATA = "Il giorno della data di ricontatto, dalle 9 alle 20";

export const STATI_RIQUADRO: StatoRiquadro[] = [
  {
    stato: "da_ricontattare",
    legatoA: "ricontatti",
    etichetta: LEAD_STATUS_LABEL.da_ricontattare,
    modello: "hgl_ricontatto_consulenza",
    quando: A_DATA,
    chi: CONSULENTI,
  },
  {
    stato: "sta_valutando",
    etichetta: LEAD_STATUS_LABEL.sta_valutando,
    modello: "hgl_ricontatto_consulenza",
    quando: A_DATA,
    chi: CONSULENTI,
  },
  {
    stato: "fissa_meet_dopo",
    etichetta: LEAD_STATUS_LABEL.fissa_meet_dopo,
    modello: "hgl_meet_da_fissare",
    quando: A_DATA,
    chi: CONSULENTI,
  },
  {
    stato: "in_attesa_acconto",
    etichetta: LEAD_STATUS_LABEL.in_attesa_acconto,
    modello: "hgl_acconto",
    quando: A_DATA,
    chi: CONSULENTI,
  },
  {
    stato: "gestire_in_chat",
    etichetta: LEAD_STATUS_LABEL.gestire_in_chat,
    modello: "hgl_ricontatto_consulenza",
    quando: A_DATA,
    chi: CONSULENTI,
  },
  {
    stato: "richiamo",
    etichetta: LEAD_STATUS_LABEL.richiamo,
    modello: "hgl_richiamo_concordato",
    quando: "Da 30 a 10 minuti prima della chiamata concordata",
    chi: CONSULENTI,
  },
  {
    stato: "non_risponde",
    etichetta: LEAD_STATUS_LABEL.non_risponde,
    modello: "hgl_non_risponde",
    quando: "15 minuti dopo che lo stato è stato messo",
    chi: "Tutti, anche i lead importati",
  },
  {
    stato: "segreteria",
    etichetta: LEAD_STATUS_LABEL.segreteria,
    modello: "hgl_non_risponde",
    quando: "15 minuti dopo che lo stato è stato messo",
    chi: "Tutti, anche i lead importati",
  },
  {
    stato: "no_show",
    insieme: ["non_fatto"],
    etichetta: LEAD_STATUS_LABEL.no_show,
    modello: "hgl_cliente_assente",
    quando: "30 minuti dopo che lo stato è stato messo",
    chi: CONSULENTI,
  },
  {
    stato: "da_spostare",
    etichetta: LEAD_STATUS_LABEL.da_spostare,
    modello: "hgl_da_riprogrammare",
    quando: "Alla data fissata; senza data, 30 minuti dopo che lo stato è stato messo",
    chi: CONSULENTI,
  },
  {
    stato: "viene_in_sede",
    etichetta: LEAD_STATUS_LABEL.viene_in_sede,
    modello: "hgl_promemoria_sede",
    quando: "Il giorno prima dell'appuntamento, dalle 9 alle 20",
    chi: "Tutte le schede con l'appuntamento",
  },
  {
    stato: "sede_disdetta",
    etichetta: LEAD_STATUS_LABEL.sede_disdetta,
    modello: "hgl_sede_disdetta",
    quando: "15 minuti dopo la disdetta",
    chi: "Tutte le schede con il consenso",
  },
  {
    stato: "irreperibile",
    etichetta: LEAD_STATUS_LABEL.irreperibile,
    modello: "hgl_ultimo_tentativo",
    quando: "1 ora dopo, una volta sola per numero",
    chi: "Tutti, anche i lead importati",
  },
];

/** Lo stato della riga e gli altri che si muovono con lui. */
export const statiDiRiga = (r: StatoRiquadro): LeadStatus[] => [r.stato, ...(r.insieme ?? [])];

/** Gli stati che il riquadro sa accendere da solo (non «Ricontatto fissato»). */
export const STATI_ACCENDIBILI: LeadStatus[] = STATI_RIQUADRO.filter((r) => !r.legatoA).flatMap(
  statiDiRiga,
);

/** Il tipo di invio in parole, per i problemi del giro. */
export const ETICHETTA_TIPO: Record<string, string> = {
  promemoria: "promemoria",
  ricontatto: "ricontatto",
  conferma: "conferma",
  primo_contatto: "primo contatto",
  richiamo_24h: "richiamo dopo 24 ore",
  ritorno: "messaggio di ritorno",
  casi_reali: "casi reali",
  meet_oggi: "meet di oggi",
  meet_domani: "meet 24 ore prima",
  meet_adesso: "meet all'ora",
  promemoria_chiamata: "promemoria della chiamata",
  promemoria_sede: "promemoria in sede",
};

/** Il giro è fermo? Il minuto in più del cron non conta: oltre 5 minuti è un
 *  allarme (PIANO §0, «giro che non parte mai, in silenzio»). */
export const ALLARME_GIRO_MS = 5 * MIN;

export interface AllarmeGiro {
  tono: "rosso" | "ambra";
  frase: string;
}

/** «Nessun giro da più di 5 minuti», in rosso. Se il giro non è mai partito:
 *  rosso se l'interruttore è acceso, ambra se è tutto spento (in quel caso è
 *  solo da sapere). */
export function allarmeGiro(
  giro: Pick<GiroManychat, "ultimoGiroIl">,
  acceso: boolean,
  adesso: Date,
): AllarmeGiro | null {
  const t = Date.parse(String(giro.ultimoGiroIl ?? ""));
  if (!Number.isFinite(t))
    return {
      tono: acceso ? "rosso" : "ambra",
      frase: acceso
        ? "Il giro non è ancora partito mai: i messaggi non possono uscire. Controlla che l'ultima migrazione del database sia applicata."
        : "Il giro a orario non è ancora partito mai. Parte con l'ultima migrazione del database; finché è tutto spento non serve.",
    };
  if (adesso.getTime() - t <= ALLARME_GIRO_MS) return null;
  return {
    tono: "rosso",
    frase: `Nessun giro da più di 5 minuti (l'ultimo: ${quandoBreve(giro.ultimoGiroIl)}). Finché non riparte, nessun messaggio automatico esce.`,
  };
}

/** I tetti che valgono davvero adesso: il minimo fra il riquadro e le costanti,
 *  con la prima settimana a 10 ricontatti. */
export function tettiEffettivi(
  tetti: ConfigManychat["tetti"] | null | undefined,
  primaAccensione: string | null | undefined,
  adesso: Date,
): { ricontatti: number; leadNuovi: number; totale: number; primaSettimana: boolean } {
  const intero = (v: unknown, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : max;
  const t0 = Date.parse(String(primaAccensione ?? ""));
  const primaSettimana = Number.isFinite(t0) && adesso.getTime() < t0 + 7 * GIORNO;
  const ricontatti = intero(tetti?.ricontatti, TETTO_RICONTATTI);
  return {
    ricontatti: primaSettimana ? Math.min(ricontatti, TETTO_PRIMA_SETTIMANA) : ricontatti,
    leadNuovi: intero(tetti?.leadNuovi, TETTO_LEAD_NUOVI),
    totale: intero(tetti?.totale, TETTO_TOTALE),
    primaSettimana,
  };
}

/** Il tetto scritto dal titolare: un numero intero da 1 al massimo consentito.
 *  Il massimo non si alza (il server lo riporta comunque alle costanti). */
export function leggiTetto(
  testo: string,
  massimo: number,
): { ok: true; valore: number } | { ok: false; errore: string } {
  const t = String(testo ?? "").trim();
  if (!/^\d{1,4}$/.test(t)) return { ok: false, errore: "Scrivi un numero intero." };
  const n = Number(t);
  if (n < 1) return { ok: false, errore: "Almeno 1: per fermare tutto spegni l'interruttore." };
  if (n > massimo) return { ok: false, errore: `Al massimo ${massimo}: puoi solo abbassarlo.` };
  return { ok: true, valore: n };
}

/** L'identificativo di un flusso (`ns`): lo si copia da ManyChat. Vuoto = toglie
 *  il flusso. Niente spazi, lunghezza ragionevole. */
export function leggiNs(
  testo: string,
): { ok: true; valore: string } | { ok: false; errore: string } {
  const t = String(testo ?? "").trim();
  if (t.length > 120)
    return { ok: false, errore: "Troppo lungo: controlla di aver copiato solo l'identificativo." };
  if (/\s/.test(t))
    return { ok: false, errore: "L'identificativo non ha spazi: ricopialo da ManyChat." };
  return { ok: true, valore: t };
}

const plurale = (n: number, uno: string, molti: string) => `${n} ${n === 1 ? uno : molti}`;

export interface RigaStatoRiquadro {
  tono: TonoRiquadro;
  /** la parola che accompagna il colore */
  parola: string;
  frase: string;
}

/** La riga di stato in chiaro (SPEC §3.2): il motivo in rosso o «Attivo · ultimo
 *  giro alle 14:32 · oggi 6 promemoria, 9 ricontatti, 5 risposte · prossimo
 *  ricontatto verso le 15:01». */
export function rigaStatoRiquadro(s: StatoManychat, adesso: Date): RigaStatoRiquadro {
  const { config, giro } = s;
  const rosso = (frase: string): RigaStatoRiquadro => ({ tono: "rosso", parola: "Fermo", frase });
  if (!s.migrazione) return rosso("Manca l'aggiornamento del database: il giro non manda niente.");
  if (!s.chiavePresente) return rosso("Manca la chiave di ManyChat.");
  if (config.fermatoMotivo) return rosso(`Fermato: ${config.fermatoMotivo}`);
  if (!config.acceso)
    return { tono: "neutro", parola: "Spento", frase: "Spento: nessun messaggio parte." };
  const statiAccesi = Object.keys(config.stati ?? {}).length > 0;
  if (
    !config.promemoria &&
    !config.ricontatti &&
    !config.leadNuovo &&
    !config.giornoMeet &&
    !statiAccesi
  )
    return {
      tono: "ambra",
      parola: "In attesa",
      frase: "Acceso, ma promemoria e ricontatti sono spenti: non parte niente.",
    };
  const eff = tettiEffettivi(config.tetti, config.primaAccensione, adesso);
  const totaleOggi = giro.oggi.totale ?? giro.oggi.promemoria + giro.oggi.ricontatti;
  if (config.ricontatti && giro.oggi.ricontatti >= eff.ricontatti)
    return {
      tono: "ambra",
      parola: "Tetto",
      frase: `Tetto di oggi raggiunto: ${plurale(giro.oggi.ricontatti, "ricontatto", "ricontatti")} su ${eff.ricontatti}. Gli altri slittano a domani.`,
    };
  if (config.leadNuovo && (giro.oggi.leadNuovi ?? 0) >= eff.leadNuovi)
    return {
      tono: "ambra",
      parola: "Tetto",
      frase: `Tetto di oggi raggiunto: ${plurale(giro.oggi.leadNuovi ?? 0, "lead nuovo", "lead nuovi")} su ${eff.leadNuovi}. Gli altri slittano a domani.`,
    };
  if (totaleOggi >= eff.totale)
    return {
      tono: "ambra",
      parola: "Tetto",
      frase: `Tetto di oggi raggiunto: ${totaleOggi} messaggi su ${eff.totale}.`,
    };
  if (nessunaRispostaDa48Ore(s, adesso))
    return {
      tono: "ambra",
      parola: "Controlla",
      frase: "Nessuna risposta da ManyChat da 48 ore: controlla il flusso delle risposte.",
    };
  const pezzi = ["Attivo"];
  if (giro.ultimoGiroIl) pezzi.push(`ultimo giro alle ${oraBreve(giro.ultimoGiroIl)}`);
  const dioggi = [
    plurale(giro.oggi.promemoria, "promemoria", "promemoria"),
    plurale(giro.oggi.ricontatti, "ricontatto", "ricontatti"),
    ...(config.leadNuovo ? [plurale(giro.oggi.leadNuovi ?? 0, "lead nuovo", "lead nuovi")] : []),
    plurale(giro.oggi.risposte, "risposta", "risposte"),
  ];
  pezzi.push(`oggi ${dioggi.join(", ")}`);
  const prossimo = Date.parse(String(giro.prossimoRicontattoDopo ?? ""));
  if (config.ricontatti && Number.isFinite(prossimo) && prossimo > adesso.getTime())
    pezzi.push(`prossimo ricontatto verso le ${oraBreve(giro.prossimoRicontattoDopo)}`);
  return { tono: "verde", parola: "Attivo", frase: pezzi.join(" · ") };
}

/** Si sono mandati messaggi e in 48 ore non ne è tornata nessuna risposta? Solo
 *  dopo 48 ore dalla prima accensione: prima non c'è niente da aspettarsi.
 *  shortcut: basta un invio nelle ultime 48 ore e nessuna risposta nelle ultime 48. */
export function nessunaRispostaDa48Ore(s: StatoManychat, adesso: Date): boolean {
  const { config, giro } = s;
  const limite = adesso.getTime() - 2 * GIORNO;
  const prima = Date.parse(String(config.primaAccensione ?? ""));
  const invio = Date.parse(String(giro.ultimoInvioIl ?? ""));
  const risposta = Date.parse(String(giro.ultimaRispostaIl ?? ""));
  if (!Number.isFinite(prima) || prima > limite) return false;
  if (!Number.isFinite(invio) || invio < limite) return false;
  return !Number.isFinite(risposta) || risposta < limite;
}

/** Le parole accanto al colore nelle righe del «Collegamento ok». */
export const PAROLA_ESITO: Record<RigaCollegamento["esito"], string> = {
  ok: "ok",
  errore: "problema",
  da_verificare: "da verificare",
  non_serve: "non serve ancora",
};

export interface TitoloCollegamento {
  tono: TonoRiquadro;
  titolo: string;
}

/** Gli `id` delle righe del «Collegamento ok» che il server DEVE mandare dopo
 *  una «Prova di collegamento» (il contratto è in testa a client-crm.ts). Una
 *  riga che non arriva non è «ok»: diventa «da verificare». */
export const ID_COLLEGAMENTO: string[] = [
  "chiave",
  "is_pro",
  ...MODELLI_FLUSSO.map((m) => `flusso:${m.modello}`),
  "campi_crm",
  "segreto_ritorno",
  "ultima_risposta",
  "creazione_contatti",
];

const NOME_RIGA: Record<string, string> = {
  chiave: "la chiave di ManyChat",
  is_pro: "l'account Pro",
  campi_crm: "i campi crm_* del contatto",
  creazione_contatti: "la creazione dei contatti",
};

function nomeRiga(id: string): string {
  if (NOME_RIGA[id]) return NOME_RIGA[id];
  const modello = id.startsWith("flusso:") ? id.slice(7) : "";
  const m = MODELLI_FLUSSO.find((x) => x.modello === modello);
  return m ? `il flusso «${m.etichetta}»` : id;
}

/** Quello che il browser sa da sé, senza chiedere a ManyChat. */
export interface ContestoCollegamento {
  segretoRitornoPresente: boolean;
  ultimaRispostaIl: string | null;
}

/** Le righe da mostrare. Due le scrive il browser (`segreto_ritorno` e
 *  `ultima_risposta`, dai dati dello stato: si vedono anche prima della prima
 *  prova); le altre arrivano dal server. Una riga obbligatoria che manca vale
 *  «da verificare», mai «ok». Prima di ogni prova: solo le due del browser. */
export function righeCollegamento(
  c: CollegamentoManychat | null | undefined,
  ctx: ContestoCollegamento,
): RigaCollegamento[] {
  const quando = quandoBreve(ctx.ultimaRispostaIl);
  const proprie: Record<string, RigaCollegamento> = {
    segreto_ritorno: ctx.segretoRitornoPresente
      ? { id: "segreto_ritorno", esito: "ok", testo: "Segreto del ritorno presente" }
      : {
          id: "segreto_ritorno",
          esito: "errore",
          testo:
            "Manca il segreto del ritorno (MANYCHAT_RITORNO_TOKEN): le risposte dei clienti non arrivano al CRM",
        },
    ultima_risposta: quando
      ? { id: "ultima_risposta", esito: "ok", testo: `Ultima risposta ricevuta: ${quando}` }
      : { id: "ultima_risposta", esito: "da_verificare", testo: "Ultima risposta ricevuta: mai" },
  };
  if (!c) return [proprie.segreto_ritorno, proprie.ultima_risposta];
  const dalServer = new Map(c.righe.map((r) => [r.id, r]));
  const righe = ID_COLLEGAMENTO.map(
    (id): RigaCollegamento =>
      proprie[id] ??
      dalServer.get(id) ?? {
        id,
        esito: "da_verificare",
        testo: `Non controllato: ${nomeRiga(id)}`,
      },
  );
  return [...righe, ...c.righe.filter((r) => !ID_COLLEGAMENTO.includes(r.id))];
}

/** «Collegamento ok» solo se OGNI riga obbligatoria è ok E il segreto del
 *  ritorno c'è; altrimenti dice quanti problemi o cose da verificare. */
export function titoloCollegamento(
  c: CollegamentoManychat | null | undefined,
  ctx: ContestoCollegamento,
): TitoloCollegamento {
  const righe = righeCollegamento(c, ctx);
  const errori = righe.filter((r) => r.esito === "errore").length;
  const dubbi = righe.filter((r) => r.esito === "da_verificare").length;
  if (errori > 0)
    return { tono: "rosso", titolo: `Collegamento: ${plurale(errori, "problema", "problemi")}` };
  if (!c) return { tono: "neutro", titolo: "Collegamento non ancora controllato" };
  if (dubbi > 0)
    return {
      tono: "ambra",
      titolo: `Collegamento: ${plurale(dubbi, "cosa da verificare", "cose da verificare")}`,
    };
  return { tono: "verde", titolo: "Collegamento ok" };
}

/** Le righe dei problemi del giro: nome abbreviato e motivo, mai il numero.
 *  Al massimo 20, dal più recente. */
export function righeProblemi(
  giro: Pick<GiroManychat, "problemi">,
): { quando: string; testo: string }[] {
  return [...(giro.problemi ?? [])]
    .sort((a, b) => Date.parse(b.il) - Date.parse(a.il))
    .slice(0, 20)
    .map((p) => ({
      quando: quandoBreve(p.il),
      testo: `${p.nome} · ${ETICHETTA_TIPO[p.tipo] ?? p.tipo} · ${p.motivo}`,
    }));
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. LE SEQUENZE, I MESSAGGI PER STATO, LA FRASE, LA SEDE E IL FOGLIO
   (commessa 2026-10-25, compito P)
   ═════════════════════════════════════════════════════════════════════════ */

const FRASE_S2 =
  "Manca l'aggiornamento del database (le sequenze WhatsApp): finché non è applicato questo interruttore resta spento.";

export interface VistaInterruttore {
  disabilitato: boolean;
  /** la riga sotto l'interruttore; vuota se non c'è niente da dire */
  nota: string;
}

export interface VistaStato {
  stato: LeadStatus;
  etichetta: string;
  modello: string;
  quando: string;
  chi: string;
  legatoA?: "ricontatti";
  acceso: boolean;
  /** «acceso dal 23/10 10:00» */
  dal?: string;
  disabilitato: boolean;
  /** una cosa da sapere prima di accendere (per esempio l'indirizzo che manca) */
  avviso?: string;
}

/** Cosa si può accendere adesso e perché. Funzione pura sullo stato del riquadro. */
export function vistaSequenze(s: StatoManychat): {
  leadNuovo: VistaInterruttore;
  giornoMeet: VistaInterruttore;
  stati: VistaStato[];
} {
  const { config } = s;
  const senzaS2 = !config.sequenze;
  const stati = config.stati ?? {};
  return {
    leadNuovo: {
      //  Spegnere non fa danni: se è già acceso resta spegnibile anche se la frase
      //  non c'è più.
      disabilitato: senzaS2 || (!config.leadNuovo && !s.fraseModulo),
      nota: senzaS2
        ? FRASE_S2
        : !s.fraseModulo
          ? "I consensi dei moduli non valgono finché non segni la data della frase nel modulo Meta (qui sotto): senza, «Lead nuovo» non si accende."
          : "",
    },
    giornoMeet: { disabilitato: senzaS2, nota: senzaS2 ? FRASE_S2 : "" },
    stati: STATI_RIQUADRO.map((r) => {
      const dal = r.legatoA ? null : stati[r.stato];
      const acceso = r.legatoA ? config[r.legatoA] === true : !!dal;
      return {
        stato: r.stato,
        etichetta: r.etichetta,
        modello: r.modello,
        quando: r.quando,
        chi: r.chi,
        ...(r.legatoA ? { legatoA: r.legatoA } : {}),
        acceso,
        ...(dal ? { dal: `acceso dal ${quandoBreve(dal)}` } : {}),
        disabilitato: senzaS2 && !r.legatoA,
        //  Spento senza S2: si dice perché (collaudo 26/10), invece del solo grigio.
        ...(senzaS2 && !r.legatoA
          ? { avviso: FRASE_S2 }
          : r.stato === "viene_in_sede" && !config.indirizzoSede
            ? {
                avviso:
                  "Scrivi prima l'indirizzo della sede (qui sotto): senza, il promemoria non parte.",
              }
            : {}),
      };
    }),
  };
}

/** Il giorno scritto nel campo della frase (`AAAA-MM-GG`): un giorno vero, non
 *  nel futuro (si conta il giorno di Roma). */
export function leggiGiornoFrase(
  testo: string,
  adesso: Date,
): { ok: true; giorno: string } | { ok: false; errore: string } {
  const giorno = String(testo ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(giorno) || !istanteDiRoma(giorno, "00:00"))
    return { ok: false, errore: "Scegli il giorno in cui hai aggiunto la frase al modulo." };
  if (giorno > aRoma(adesso).giorno)
    return { ok: false, errore: "La data non può essere nel futuro." };
  return { ok: true, giorno };
}

/** La riga della frase del consenso nel modulo Meta. */
export function vistaFraseModulo(frase: FraseModulo | null): {
  tono: TonoRiquadro;
  frase: string;
} {
  if (!frase)
    return {
      tono: "ambra",
      frase:
        "Non ancora segnata: i consensi dei moduli non valgono per nessuno finché non segni il giorno in cui hai aggiunto la frase al modulo Meta.",
    };
  return {
    tono: "verde",
    frase: `Segnata per il ${giornoBreve(frase.il)} da ${frase.da || "sconosciuto"}. Valgono i moduli compilati da quel giorno in poi; quelli di prima no.`,
  };
}

/** Lunghezza massima dell'indirizzo: sta dentro una variabile del modello. */
const MAX_INDIRIZZO = 150;

/** L'indirizzo della sede: una riga sola (Meta rifiuta a capo e tabulazioni nelle
 *  variabili dei modelli), gli spazi doppi tolti. Vuoto = lo toglie. */
export function leggiIndirizzo(
  testo: string,
): { ok: true; valore: string } | { ok: false; errore: string } {
  const t = String(testo ?? "");
  if (/[\r\n\t]/.test(t))
    return { ok: false, errore: "L'indirizzo va su una riga sola: niente a capo né tabulazioni." };
  const pulito = t.trim().replace(/ {2,}/g, " ");
  if (pulito.length > MAX_INDIRIZZO)
    return { ok: false, errore: `Al massimo ${MAX_INDIRIZZO} caratteri.` };
  return { ok: true, valore: pulito };
}

const ESITO_FOGLIO: Record<string, string> = {
  in_corso: "in corso",
  nuovo: "nuovo lead",
  ritorno_da_segnare: "contatto di ritorno",
  ritorno: "contatto di ritorno",
  gia_presente: "già presente",
  scartata: "scartata",
  altro: "esito non riconosciuto",
};

/** La riga «Foglio Google»: mai nomi né numeri, solo l'ora, l'esito in parole e
 *  quante righe sono entrate oggi su quante ne ammette il tetto. */
export function vistaFoglio(f: FoglioManychat): { tono: TonoRiquadro; frase: string } {
  if (!f.migrazione)
    return {
      tono: "ambra",
      frase:
        "Manca l'aggiornamento del database (il registro del foglio): le righe del foglio non entrano.",
    };
  if (!f.segretoPresente)
    return {
      tono: "rosso",
      frase: "Il foglio non può mandare lead: manca SHEETS_INGRESSO_TOKEN fra i segreti del sito.",
    };
  const oggi = `righe ricevute oggi: ${f.righeOggi} su ${f.tetto}`;
  if (!f.ultimo) return { tono: "neutro", frase: `Nessuna riga ricevuta finora · ${oggi}` };
  const ultima = `Ultima riga ricevuta il ${quandoBreve(f.ultimo.il)} (${ESITO_FOGLIO[f.ultimo.esito] ?? ESITO_FOGLIO.altro})`;
  return f.righeOggi >= f.tetto
    ? {
        tono: "rosso",
        frase: `${ultima} · ${oggi} (tetto raggiunto: le altre aspettano domani)`,
      }
    : { tono: "verde", frase: `${ultima} · ${oggi}` };
}
