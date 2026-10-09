// Helpers di formattazione date in italiano per il CRM.
// "Oggi, 20 aprile" / "Domani, 21 aprile" / "Lunedì, 4 ottobre 2027"

const GIORNI = [
  "Domenica",
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
];
const GIORNI_BREVI = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const MESI = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Parse una stringa data ISO (YYYY-MM-DD) o ISO datetime in modo safe. */
export function parseDate(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const s = input.trim();
  if (!s) return null;
  // YYYY-MM-DD plain
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export interface FormatDateOptions {
  /** include anno solo se diverso da quello corrente (default true) */
  smartYear?: boolean;
  /** usa il formato lungo "Lunedì, 4 ottobre 2027" anche per oggi/domani (default false) */
  forceLong?: boolean;
  /** formato breve "Lun 4 ott" (default false) */
  short?: boolean;
}

/**
 * Formatta una data nel formato user-friendly italiano.
 * - Oggi, 20 aprile
 * - Domani, 21 aprile
 * - Ieri, 19 aprile
 * - Lunedì, 4 ottobre 2027
 */
export function formatDate(
  input: string | Date | null | undefined,
  opts: FormatDateOptions = {},
): string {
  const d = parseDate(input);
  if (!d) return "—";
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const day = d.getDate();
  const month = MESI[d.getMonth()];
  const year = d.getFullYear();
  const giorno = GIORNI[d.getDay()];
  const giornoBreve = GIORNI_BREVI[d.getDay()];
  const mesiBrevi = MESI.map((m) => m.slice(0, 3));

  if (opts.short) {
    return `${giornoBreve} ${day} ${mesiBrevi[d.getMonth()]}`;
  }

  if (!opts.forceLong) {
    if (diffDays === 0) return `Oggi, ${day} ${month}`;
    if (diffDays === 1) return `Domani, ${day} ${month}`;
    if (diffDays === -1) return `Ieri, ${day} ${month}`;
  }

  const includeYear = opts.smartYear === false || year !== today.getFullYear();
  return includeYear
    ? `${giorno}, ${day} ${month} ${year}`
    : `${giorno}, ${day} ${month}`;
}

/** Formatta un orario "HH:mm" o stringa data in "HH:mm" pulito. */
export function formatTime(input: string | Date | null | undefined): string {
  if (!input) return "—";
  if (typeof input === "string" && /^\d{1,2}:\d{2}/.test(input)) {
    const [h, m] = input.split(":");
    return `${h.padStart(2, "0")}:${m.slice(0, 2)}`;
  }
  const d = parseDate(input);
  if (!d) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "Oggi, 20 aprile · 15:00" */
export function formatDateTime(
  date: string | Date | null | undefined,
  time?: string | null,
  opts: FormatDateOptions = {},
): string {
  const d = formatDate(date, opts);
  if (!time) return d;
  return `${d} · ${formatTime(time)}`;
}

/** Per il funnel finale: "per oggi alle ore 15:00" / "per Domani, ore 15:00" / "per Lunedì 4 ottobre, ore 15:00" */
export function formatBookingPhrase(
  date: string | Date | null | undefined,
  time: string | null | undefined,
): string {
  const d = parseDate(date);
  if (!d) return time ? `alle ore ${formatTime(time)}` : "";
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const giorno = GIORNI[d.getDay()];
  const day = d.getDate();
  const month = MESI[d.getMonth()];
  const orario = time ? formatTime(time) : "";

  if (diffDays === 0) return orario ? `per oggi alle ore ${orario}` : `per oggi`;
  if (diffDays === 1)
    return orario ? `per Domani, ore ${orario}` : `per Domani`;
  return orario
    ? `per ${giorno} ${day} ${month}, ore ${orario}`
    : `per ${giorno} ${day} ${month}`;
}

export function isToday(input: string | Date | null | undefined): boolean {
  const d = parseDate(input);
  if (!d) return false;
  return startOfDay(d).getTime() === startOfDay(new Date()).getTime();
}
