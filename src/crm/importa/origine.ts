/** ── DA DOVE È ENTRATO UN LEAD ──────────────────────────────────────────────
 *
 *  Commessa 2026-10-25 (Lead da Google Sheets), compito U. Tre strade per
 *  entrare nell'archivio dei lead importati, e chi lavora le liste vuole saperle
 *  a colpo d'occhio:
 *    · dal FOGLIO Google collegato alle inserzioni  → «Google Sheets · Lead HGL»
 *    · da un FILE caricato a mano                    → «File · lista_12ott.csv»
 *    · A MANO (nessuna delle due)                    → «A mano»
 *
 *  ⚠️ LA STRADA LA DICE IL DATO, NON IL NOME DEL FILE. Una scheda del foglio porta
 *   `origineIngresso.via === "google_sheets"` (lo scrive il compito S); porta
 *   anche `listaOrigine.file = "Google Sheets · <foglio>"`, perché passa dalla
 *   stessa strada del file. Per questo il foglio si guarda PRIMA: altrimenti ogni
 *   lead del foglio sarebbe «File · Google Sheets · Lead HGL».
 *  ⚠️ UNA SCHEDA VECCHIA, SENZA NESSUNO DEI CAMPI, VALE «A MANO». Le schede
 *   entrate prima di questa commessa non hanno `origineIngresso`, e molte non
 *   hanno nemmeno `listaOrigine`: non sono un errore, sono la maggioranza.
 *  ⚠️ DATI STORTI NON ROMPONO NIENTE. Il nome del foglio lo scrive uno script
 *   fuori dal CRM: si legge come testo, si ripulisce e si taglia; un valore che
 *   non è testo vale come vuoto.
 *  Pura: niente React, niente rete. Tutto provato in `prove/sheets/origine.mjs`. */
import type { LeadData } from "../types";

export type ViaOrigine = "google_sheets" | "file" | "a_mano";

export interface OrigineLead {
  via: ViaOrigine;
  /** il testo da mostrare, già pronto: «Google Sheets · Lead HGL» */
  etichetta: string;
}

/** Le tre strade, nell'ordine in cui il menu Origine le mostra. */
export const VIE_ORIGINE: ViaOrigine[] = ["google_sheets", "file", "a_mano"];

/** Il nome di una strada, per il menu e per l'etichetta del filtro acceso. */
export const NOME_VIA: Record<ViaOrigine, string> = {
  google_sheets: "Google Sheets",
  file: "File",
  a_mano: "A mano",
};

/** Cosa dice «Tutta la lista» quando il foglio non ha ancora mandato nessuno
 *  (la voce «Lead da Google Sheets» di Altro, a zero lead). */
export const VUOTO_GOOGLE_SHEETS = {
  titolo: "Nessun lead dal foglio Google per ora",
  testo: "Quando il foglio è collegato, le righe nuove compaiono qui entro un minuto.",
} as const;

/** Un nome ripulito: solo testo, spazi ridotti, al massimo 80 caratteri. */
const MAX_NOME = 80;
function testo(v: unknown): string {
  if (typeof v !== "string") return "";
  const t = v.replace(/\s+/g, " ").trim();
  return t.length > MAX_NOME ? `${t.slice(0, MAX_NOME - 1)}…` : t;
}

/** `origineIngresso` se è davvero del foglio, altrimenti `null`. */
function delFoglio(d: Partial<LeadData> | null | undefined) {
  const o = d?.origineIngresso;
  return o && typeof o === "object" && !Array.isArray(o) && o.via === "google_sheets" ? o : null;
}

export function origineDi(d: Partial<LeadData> | null | undefined): OrigineLead {
  const foglio = delFoglio(d);
  if (foglio) {
    const nome = testo(foglio.foglio);
    return { via: "google_sheets", etichetta: nome ? `Google Sheets · ${nome}` : "Google Sheets" };
  }
  const lista = d?.listaOrigine;
  const file = lista && typeof lista === "object" ? testo(lista.file) : "";
  if (file) return { via: "file", etichetta: `File · ${file}` };
  return { via: "a_mano", etichetta: "A mano" };
}

/** Vero se la scheda è entrata dal foglio Google (`origineIngresso.via`). */
export function daGoogleSheets(d: Partial<LeadData> | null | undefined): boolean {
  return origineDi(d).via === "google_sheets";
}

/** Quello che si scrive SULLA RIGA di un elenco: solo il foglio. Il file e «a
 *  mano» sono quasi tutte le righe, e ripeterli su ognuna è rumore. */
export function origineInRiga(d: Partial<LeadData> | null | undefined): string {
  const o = origineDi(d);
  return o.via === "google_sheets" ? o.etichetta : "";
}

/** Giorno, mese (e anno, se non è questo) e ora di Roma di un istante. */
function quandoDi(iso: string, adesso: Date): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const pezzi = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(t));
  const v = (tipo: string) => pezzi.find((p) => p.type === tipo)?.value ?? "";
  const annoOra = new Intl.DateTimeFormat("it-IT", {
    timeZone: "Europe/Rome",
    year: "numeric",
  }).format(adesso);
  const anno = v("year") === annoOra ? "" : `/${v("year")}`;
  return `arrivato il ${v("day")}/${v("month")}${anno} alle ${v("hour")}:${v("minute")}`;
}

/** La riga d'origine della scheda del lead:
 *  «Origine: Google Sheets · Lead HGL (Foglio1, riga 57) · arrivato il 25/10 alle 09:14».
 *  Vuota per tutto il resto: per il file c'è già «Da dove arriva» (ricarico).
 *  `adesso` serve solo a decidere se scrivere l'anno. */
export function rigaOrigineScheda(
  d: Partial<LeadData> | null | undefined,
  adesso: Date = new Date(),
): string {
  const foglio = delFoglio(d);
  if (!foglio) return "";
  const dove = [
    testo(foglio.scheda),
    Number.isInteger(foglio.riga) && (foglio.riga as number) >= 2 ? `riga ${foglio.riga}` : "",
  ].filter(Boolean);
  return [
    `Origine: ${origineDi(d).etichetta}${dove.length ? ` (${dove.join(", ")})` : ""}`,
    quandoDi(String(foglio.il ?? ""), adesso),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Quando è arrivata la scheda, in millisecondi: il momento d'ingresso dal
 *  foglio, altrimenti la data del modulo, altrimenti il caricamento. 0 = non si sa. */
function arrivoDi(d: Partial<LeadData> | null | undefined): number {
  for (const iso of [delFoglio(d)?.il, d?.createdAt, d?.listaOrigine?.il]) {
    const t = Date.parse(String(iso ?? ""));
    if (Number.isFinite(t)) return t;
  }
  return 0;
}

/** «Dal più recente»: un elenco nuovo, chi è arrivato per ultimo in cima, chi
 *  non ha una data in fondo, e a pari merito l'ordine di prima (`sort` è stabile). */
export function ordinaPerArrivo<T extends { data?: Partial<LeadData> | null }>(leads: T[]): T[] {
  return [...leads].sort((a, b) => arrivoDi(b.data) - arrivoDi(a.data));
}
