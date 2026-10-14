/** ─────────────────────────────────────────────────────────────────────────
 *  wa-auto-regole.ts — LE REGOLE DEL WHATSAPP AUTOMATICO AI LEAD
 *
 *  Solo funzioni pure: niente Supabase, niente rete, niente orologio (l'ora
 *  arriva sempre da fuori). Le usa il motore lato server
 *  (`wa-auto-invio.server.ts`) e le prova `npm test`, sul codice vero.
 *
 *  PERCHÉ TUTTO QUI DENTRO
 *  Sono le regole che tengono il numero lontano dal ban: a che ora scade ogni
 *  messaggio, chi ha dato il consenso, quanti ne escono per giro e per giorno,
 *  chi ha chiesto di smettere. Messe in un file senza dipendenze si provano
 *  una per una; sparse nel motore si proverebbero solo con un giro intero.
 *  ───────────────────────────────────────────────────────────────────────── */

import { findMetaTemplate } from "./wa-meta-templates";

/* ── 1. LE REGOLE (la tabella che il titolare può modificare) ───────────── */

/** A quale data guarda la regola. */
export type Riferimento = "ricontatto" | "consulenza";

/** Una riga di `wa_auto_regole` (stessi nomi di colonna della migrazione). */
export interface RegolaWa {
  codice: string;
  descrizione?: string;
  attiva: boolean;
  riferimento: Riferimento;
  /** Se c'è, la regola vale solo per quello stato; se è null, per gli stati di serie del riferimento. */
  stato_lead: string | null;
  /** Quanti giorni prima della data di riferimento. */
  giorni_prima: number;
  /** "HH:MM" a Roma: se c'è, il messaggio scade a quell'ora (del giorno meno `giorni_prima`). */
  ora_fissa: string | null;
  /** Se manca `ora_fissa`: quanti minuti prima dell'ora di riferimento. */
  minuti_prima: number | null;
  /** Nome del template Meta già approvato (vedi `wa-meta-templates.ts`). */
  template: string;
  /** Fascia in cui è permesso mandare, "HH:MM" a Roma: da incluso, a escluso. */
  ora_da: string;
  ora_a: string;
}

/** Gli stati che, senza una scelta del titolare, ricevono i messaggi di ogni riferimento. */
export const STATI_DI_SERIE: Record<Riferimento, string[]> = {
  ricontatto: ["da_ricontattare"],
  consulenza: ["appuntamento_fissato", "appuntamento_rifissato"],
};

/** ── LE REGOLE DI SERIE ───────────────────────────────────────────────────
 *  Fascia 9-20 per tutte, TRANNE il promemoria dei 10 minuti: 8:45-21:30.
 *  Perché: è un messaggio legato a un appuntamento che il lead ha preso e
 *  aspetta; con la fascia 9-20 le consulenze delle 9:00 e delle 20:30-21:30
 *  (l'ultimo orario prenotabile è le 21:30) non lo riceverebbero mai. Il
 *  rischio per il numero è minimo. Il resto resta 9-20. */
export const REGOLE_PREDEFINITE: RegolaWa[] = [
  {
    codice: "ricontatto_data",
    descrizione: "Ricontatto fissato: messaggio la mattina del giorno concordato",
    attiva: true,
    riferimento: "ricontatto",
    stato_lead: "da_ricontattare",
    giorni_prima: 0,
    ora_fissa: "09:00",
    minuti_prima: null,
    template: "promemoria_ricontatto",
    ora_da: "09:00",
    ora_a: "20:00",
  },
  {
    codice: "consulenza_giorno_prima",
    descrizione: "Consulenza: promemoria il giorno prima alle 18:00",
    attiva: true,
    riferimento: "consulenza",
    stato_lead: null,
    giorni_prima: 1,
    ora_fissa: "18:00",
    minuti_prima: null,
    template: "promemoria_meet",
    ora_da: "09:00",
    ora_a: "20:00",
  },
  {
    codice: "consulenza_10_minuti",
    descrizione: "Consulenza: promemoria 10 minuti prima (fascia larga, vedi sopra)",
    attiva: true,
    riferimento: "consulenza",
    stato_lead: null,
    giorni_prima: 0,
    ora_fissa: null,
    minuti_prima: 10,
    template: "promemoria_meet",
    ora_da: "08:45",
    ora_a: "21:30",
  },
];

/* ── 2. IL CONSENSO ───────────────────────────────────────────────────────── */

/** ── ⚠️ LE VERSIONI DEL CONSENSO ACCETTATE ────────────────────────────────
 *  `{ versione: testo ESATTO della casella }`. È la prova di cosa ha accettato
 *  il lead. Versione sconosciuta o assente → niente consenso.
 *  REGOLA: testo nuovo della casella = versione nuova = voce aggiunta qui.
 *  Le vecchie NON si tolgono e NON si riscrivono mai: i lead che le hanno
 *  accettate restano validi, e cambiare un testo sotto una versione già
 *  usata falsificherebbe la prova.
 *  `wa-2026-10-14` è il testo provvisorio della casella di BookingFunnel (il
 *  titolare lo conferma): la casella deve scrivere ESATTAMENTE questo. */
export const VERSIONI_CONSENSO_WA: Record<string, string> = {
  "wa-sito-2026-10-14": "Ok a ricevere promemoria su WhatsApp",
  "wa-2026-10-14": "Ok a ricevere promemoria su WhatsApp",
};

/** Il lead del CRM, per quanto serve qui (`crm_leads`: id + `data`). */
export interface LeadWa {
  id: string;
  data: {
    stato?: string;
    nome?: string;
    telefono?: string;
    publicLeadId?: string;
    consulenteId?: string | null;
    dataRicontatto?: string;
    oraRicontatto?: string;
    dataMeeting?: string;
    oraMeeting?: string;
    linkMeeting?: string;
  };
}

/** La riga di `public_leads` da cui è nato il lead. */
export interface ModuloWa {
  id: string;
  telefono?: string | null;
  consenso_whatsapp?: boolean | null;
  consenso_whatsapp_il?: string | null;
  consenso_whatsapp_versione?: string | null;
}

/** ── IL TELEFONO COME CHIAVE ──────────────────────────────────────────────
 *  Solo cifre, col prefisso del paese: "+39 333 123 4567", "3331234567" e
 *  "0039 333 1234567" sono lo stesso numero. È la chiave dei limiti (silenzio,
 *  esclusi) e del confronto con il modulo. Vuoto se non sembra un telefono.
 *  shortcut: un numero di 10 cifre che inizia per 3 (cellulare) o di 9-11 che
 *  inizia per 0 (fisso) senza prefisso è italiano; un numero estero senza +
 *  non si indovina. Da cambiare se arrivano lead dall'estero senza prefisso. */
export function telefonoE164(grezzo: string | null | undefined): string {
  let cifre = String(grezzo ?? "").replace(/\D/g, "");
  if (cifre.startsWith("00")) cifre = cifre.slice(2);
  else if (cifre.length === 10 && cifre.startsWith("3")) cifre = `39${cifre}`;
  else if (cifre.length >= 9 && cifre.length <= 11 && cifre.startsWith("0")) cifre = `39${cifre}`;
  return cifre.length >= 9 && cifre.length <= 15 ? `+${cifre}` : "";
}

/** ── IL CONSENSO VALE SOLO SE ─────────────────────────────────────────────
 *  La riga del modulo è proprio quella da cui è nato il lead (`publicLeadId`:
 *  mai cercata per telefono), ha `consenso_whatsapp = true`, l'ora del
 *  consenso (la scrive il database), una versione che conosciamo, e il
 *  telefono del lead CRM è lo stesso del modulo. Lead da Meta, importati o
 *  fatti a mano non hanno `publicLeadId`: niente consenso, niente messaggi. */
export function consensoValido(lead: LeadWa, modulo: ModuloWa | null | undefined): boolean {
  const idModulo = lead.data.publicLeadId;
  if (!idModulo || !modulo || modulo.id !== idModulo) return false;
  if (modulo.consenso_whatsapp !== true || !modulo.consenso_whatsapp_il) return false;
  const versione = modulo.consenso_whatsapp_versione;
  if (!versione || !Object.prototype.hasOwnProperty.call(VERSIONI_CONSENSO_WA, versione)) return false;
  const tel = telefonoE164(lead.data.telefono);
  return tel !== "" && tel === telefonoE164(modulo.telefono);
}

/* ── 3. L'ORA DI ROMA ─────────────────────────────────────────────────────── */

const FORMATO_ROMA = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Rome",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** Data e ora a Roma di un istante: `data` "AAAA-MM-GG", `ora` "HH:MM", `minuti` dalla mezzanotte. */
export function oraRoma(d: Date): { data: string; ora: string; minuti: number } {
  const p: Record<string, string> = {};
  for (const x of FORMATO_ROMA.formatToParts(d)) p[x.type] = x.value;
  return { data: `${p.year}-${p.month}-${p.day}`, ora: `${p.hour}:${p.minute}`, minuti: Number(p.hour) * 60 + Number(p.minute) };
}

function minutiDa(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm ?? ""));
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  return h > 23 || mm > 59 ? null : h * 60 + mm;
}

/** L'istante in cui a Roma è `data` alle `ora`. Prova l'offset di entrambe le stagioni, così vale anche nei giorni del cambio d'ora. */
function istanteRoma(data: string, ora: string): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(data ?? ""));
  const min = minutiDa(ora);
  if (!dm || min === null) return null;
  const [y, mo, g] = [Number(dm[1]), Number(dm[2]), Number(dm[3])];
  const voluto = `${dm[1]}-${dm[2]}-${dm[3]} ${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  const comeUtc = Date.UTC(y, mo - 1, g, Math.floor(min / 60), min % 60);
  for (const offset of [1, 2, 0]) {
    const prova = new Date(comeUtc - offset * 3600000);
    const r = oraRoma(prova);
    if (`${r.data} ${r.ora}` === voluto) return prova;
  }
  return null; // l'ora che salta nel cambio d'ora (02:30 del 29/03): non esiste
}

/** `ora_da` incluso, `ora_a` escluso: "09:00"-"20:00" vale fino alle 19:59. */
export function inFascia(d: Date, ora_da: string, ora_a: string): boolean {
  const da = minutiDa(ora_da);
  const a = minutiDa(ora_a);
  if (da === null || a === null) return false;
  const t = oraRoma(d).minuti;
  return t >= da && t < a;
}

/** Il giorno prima/dopo, in calendario (senza fusi di mezzo). */
function spostaGiorni(data: string, giorni: number): string | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(data ?? ""));
  if (!dm) return null;
  const d = new Date(Date.UTC(Number(dm[1]), Number(dm[2]) - 1, Number(dm[3]) + giorni));
  return d.toISOString().slice(0, 10);
}

/* ── 4. QUANDO SCADE OGNI MESSAGGIO ───────────────────────────────────────── */

export interface Scadenza {
  regola: string;
  template: string;
  scadenza: Date;
  ora_da: string;
  ora_a: string;
}

/** Le scadenze di un lead, una per regola che lo riguarda. Dati mancanti o illeggibili: nessuna scadenza, mai un errore. */
export function scadenzePer(lead: LeadWa, regole: RegolaWa[]): Scadenza[] {
  const d = lead.data;
  const fuori: Scadenza[] = [];
  for (const r of regole) {
    if (!r.attiva) continue;
    const stati = r.stato_lead ? [r.stato_lead] : STATI_DI_SERIE[r.riferimento];
    if (!stati || !d.stato || !stati.includes(d.stato)) continue;
    const giorno = r.riferimento === "ricontatto" ? d.dataRicontatto : r.riferimento === "consulenza" ? d.dataMeeting : undefined;
    const ora = r.riferimento === "ricontatto" ? d.oraRicontatto : d.oraMeeting;
    //  Una consulenza senza ora non è un appuntamento: il messaggio direbbe «alle …» a vuoto.
    //  Il ricontatto invece ha l'ora facoltativa: la scadenza c'è, e se manca l'ora lo ferma `parametriTemplate`.
    if (!giorno || (r.riferimento === "consulenza" && !ora)) continue;
    let quando: Date | null = null;
    if (r.ora_fissa) {
      const g = spostaGiorni(giorno, -r.giorni_prima);
      quando = g ? istanteRoma(g, r.ora_fissa) : null;
    } else if (r.minuti_prima !== null && r.minuti_prima !== undefined && ora) {
      const base = istanteRoma(spostaGiorni(giorno, -r.giorni_prima) ?? "", ora);
      quando = base ? new Date(base.getTime() - r.minuti_prima * 60000) : null;
    }
    if (quando) fuori.push({ regola: r.codice, template: r.template, scadenza: quando, ora_da: r.ora_da, ora_a: r.ora_a });
  }
  return fuori;
}

/* ── 5. CHI ESCE DAL GIRO ─────────────────────────────────────────────────── */

/** Quanto indietro si manda ancora un messaggio scaduto: oltre, è inutile (e rischioso) dirlo adesso. */
export const FINESTRA_MS = 15 * 60000;
/** Silenzio sullo stesso telefono, anche con lead diversi. */
export const SILENZIO_MS = 20 * 60000;
export const TETTO_GIORNALIERO = 40;
export const MAX_PER_GIRO = 5;

export interface Candidato {
  leadId: string;
  regola: string;
  scadenza: Date;
  /** Telefono già normalizzato (`telefonoE164`). */
  telefono: string;
  template: string;
  ora_da: string;
  ora_a: string;
}

export type MotivoSalto = "tetto" | "giro_pieno" | "silenzio" | "escluso" | "fuori_fascia";

export interface Saltato {
  candidato: Candidato;
  motivo: MotivoSalto;
  /** true = si scrive nel registro e non si riprova (STOP, fuori fascia). false = riprova al prossimo giro, finché la scadenza è in finestra. */
  definitivo: boolean;
}

export interface OpzioniGiro {
  tetto?: number;
  maxGiro?: number;
}

/** ── CHI MANDARE ADESSO ───────────────────────────────────────────────────
 *  `candidati`: lead con consenso e scadenza calcolata. `prenotatiOggi`: righe
 *  del registro prenotate oggi (giorno di Roma, simulate comprese).
 *  `recenti`: telefono + istante delle prenotazioni degli ultimi 20 minuti.
 *  `esclusi`: telefoni che hanno chiesto di smettere.
 *  Si considerano solo le scadenze nelle ultime 15 minuti: le future aspettano,
 *  le più vecchie non partono più. Si parte dalla più vecchia. */
export function daMandare(
  candidati: Candidato[],
  prenotatiOggi: number,
  recenti: Array<{ telefono: string; quando: Date }>,
  esclusi: Iterable<string>,
  adesso: Date,
  opzioni: OpzioniGiro = {},
): { mandare: Candidato[]; saltati: Saltato[] } {
  const tetto = opzioni.tetto ?? TETTO_GIORNALIERO;
  const maxGiro = opzioni.maxGiro ?? MAX_PER_GIRO;
  const setEsclusi = new Set([...esclusi].map((t) => telefonoE164(t)));
  const ultimaVolta = new Map<string, number>();
  for (const r of recenti) {
    const t = telefonoE164(r.telefono);
    ultimaVolta.set(t, Math.max(ultimaVolta.get(t) ?? 0, r.quando.getTime()));
  }
  const visti = new Set<string>();
  const mandare: Candidato[] = [];
  const saltati: Saltato[] = [];
  const inFinestra = candidati
    .filter((c) => {
      const ms = adesso.getTime() - c.scadenza.getTime();
      return ms >= 0 && ms <= FINESTRA_MS;
    })
    .sort((a, b) => a.scadenza.getTime() - b.scadenza.getTime());
  for (const c of inFinestra) {
    const chiave = `${c.leadId}|${c.regola}|${c.scadenza.getTime()}`;
    if (visti.has(chiave)) continue;
    visti.add(chiave);
    const tel = telefonoE164(c.telefono);
    const salta = (motivo: MotivoSalto, definitivo: boolean) => saltati.push({ candidato: c, motivo, definitivo });
    if (setEsclusi.has(tel)) { salta("escluso", true); continue; }
    if (!inFascia(adesso, c.ora_da, c.ora_a)) { salta("fuori_fascia", true); continue; }
    if (prenotatiOggi + mandare.length >= tetto) { salta("tetto", false); continue; }
    const ultima = ultimaVolta.get(tel);
    if (ultima !== undefined && adesso.getTime() - ultima < SILENZIO_MS) { salta("silenzio", false); continue; }
    if (mandare.length >= maxGiro) { salta("giro_pieno", false); continue; }
    mandare.push(c);
    ultimaVolta.set(tel, adesso.getTime());
  }
  return { mandare, saltati };
}

/* ── 6. STOP ──────────────────────────────────────────────────────────────── */

function semplifica(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PAROLE_STOP = new Set(["stop", "basta", "unsubscribe", "smettila", "smettete", "cancellami", "disiscrivimi"]);
const FRASI_STOP = [
  /\bnon (mi )?(scrivere|scrivermi|scrivetemi|mandare|mandarmi|mandatemi|contattare|contattarmi|contattatemi|chiamare|chiamatemi|disturbare|disturbate)\b.*\b(piu|mai piu)\b/,
  /\bnon voglio piu (ricevere|essere contattat)/,
  /\btoglimi\b/,
  /\bdisiscriv/,
  /\bcancellami\b/,
];

/** Un messaggio che chiede di smettere. Prudente: «stop alle 15 va bene» non lo è; nel dubbio fra due errori, un lead escluso di troppo lo chiama il consulente, un messaggio di troppo costa il numero. */
export function eRichiestaStop(testo: string | null | undefined): boolean {
  if (!testo) return false;
  const t = semplifica(String(testo));
  if (!t) return false;
  const parole = t.split(" ");
  if (parole.length <= 3 && parole.some((p) => PAROLE_STOP.has(p))) return true;
  return FRASI_STOP.some((re) => re.test(t));
}

/* ── 7. I PARAMETRI DEL TEMPLATE ──────────────────────────────────────────── */

/** Le date del CRM sono stringhe ("2026-08-14", "15:30"), non timestamp: si riscrivono, senza passare dai fusi. */
function dataIt(data?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(data ?? ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
function oraIt(ora?: string | null): string {
  const m = /(\d{1,2}):(\d{2})/.exec(String(ora ?? ""));
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/** I valori da mettere in {{1}} {{2}}… del template, nell'ordine di Meta. Se ne manca uno non si manda: Meta rifiuta un parametro vuoto, e un valore inventato («ci sentiamo alle 15») lo legge il cliente. */
export function parametriTemplate(
  nomeTemplate: string,
  lead: LeadWa,
  nomeConsulente: string,
): { ok: true; params: string[] } | { ok: false; motivo: string } {
  const tpl = findMetaTemplate(nomeTemplate);
  if (!tpl) return { ok: false, motivo: "template sconosciuto" };
  const d = lead.data;
  const valori: Record<string, string> = {
    lead_name: (d.nome ?? "").trim(),
    consultant_name: (nomeConsulente ?? "").trim(),
    appointment_date: dataIt(d.dataMeeting),
    appointment_time: oraIt(d.oraMeeting),
    recontact_date: dataIt(d.dataRicontatto),
    recontact_time: oraIt(d.oraRicontatto),
    meet_link: (d.linkMeeting ?? "").trim(),
  };
  const params: string[] = [];
  for (const p of tpl.params) {
    const v = valori[p.key] ?? "";
    if (!v) return { ok: false, motivo: `manca ${p.key}` };
    params.push(v);
  }
  return { ok: true, params };
}
