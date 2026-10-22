/** ── LA CONFERMA SU WHATSAPP: NUMERI, GIORNI, ORE DI ROMA ───────────────────
 *
 *  Commessa 2026-10-22 («Rispondi SÌ»). Qui stanno i pezzi che il messaggio
 *  automatico usa per non sbagliare: il numero nel formato che vuole Meta, il
 *  giorno detto a parole, l'ora pulita, e l'orologio di Roma.
 *
 *  ⚠️ L'ORA È SEMPRE QUELLA DI ROMA, MAI QUELLA DEL SERVER. Il Worker gira in
 *   UTC: `getHours()` lì dice le 13 quando a Roma sono le 15 (d'estate) o le
 *   14 (d'inverno). Qui si legge l'orologio di Roma con `Intl` e si
 *   confrontano orologi di Roma fra loro. `hooks/meet-reminder.ts` usa
 *   `getHours()`: non è un modello da copiare per le ore.
 *  ⚠️ NIENTE `toLocaleDateString` per i nomi dei giorni: dipende dalla lingua
 *   installata su chi esegue, e la prova deve dire lo stesso dappertutto.
 *  ───────────────────────────────────────────────────────────────────────── */

const GIORNI = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
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

/** Il numero come lo vuole Meta: solo cifre, col prefisso del paese, senza «+».
 *  `null` se non è un cellulare a cui si possa scrivere.
 *  ⚠️ Senza «+» si riconoscono solo i cellulari italiani (iniziano per 3): un
 *   numero straniero scritto senza prefisso non si indovina, e un messaggio a
 *   un numero indovinato è un messaggio a uno sconosciuto. */
export function numeroPerWhatsapp(grezzo?: string | null): string | null {
  let t = String(grezzo ?? "").trim();
  if (t.startsWith("00")) t = `+${t.slice(2)}`;
  const conPiu = t.startsWith("+");
  const cifre = t.replace(/\D/g, "");
  //  Un cellulare italiano: 3 e poi 8 o 9 cifre.
  const cellulareIt = (n: string) => /^3\d{8,9}$/.test(n);
  if (conPiu) {
    if (cifre.startsWith("39")) return cellulareIt(cifre.slice(2)) ? cifre : null;
    return /^\d{8,15}$/.test(cifre) ? cifre : null;
  }
  //  Con il 39 davanti: 11 o 12 cifre (i cellulari da soli ne hanno al massimo 10).
  if (cifre.startsWith("39") && cifre.length >= 11 && cellulareIt(cifre.slice(2))) return cifre;
  if (cellulareIt(cifre)) return `39${cifre}`;
  return null;
}

/** «2026-10-23» → «venerdì 23 ottobre». `null` se la data non esiste. */
export function giornoParlato(giorno: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(giorno ?? ""));
  if (!m) return null;
  const [a, me, g] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(a, me - 1, g));
  if (d.getUTCFullYear() !== a || d.getUTCMonth() !== me - 1 || d.getUTCDate() !== g) return null;
  return `${GIORNI[d.getUTCDay()]} ${g} ${MESI[me - 1]}`;
}

/** «9:05» → «09:05». `null` se non è un'ora vera. */
export function oraNormale(ora?: string | null): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(ora ?? "").trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

const OROLOGIO_ROMA = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Rome",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Che giorno è e che ora è A ROMA in questo istante. */
export function aRoma(adesso: Date): { giorno: string; minuti: number } {
  const p = Object.fromEntries(OROLOGIO_ROMA.formatToParts(adesso).map((x) => [x.type, x.value]));
  return {
    giorno: `${p.year}-${p.month}-${p.day}`,
    minuti: Number(p.hour) * 60 + Number(p.minute),
  };
}

/** La finestra in cui si scrive: dalle 08:00 (compresa) alle 21:00 (esclusa). */
export const APERTURA_MIN = 8 * 60;
export const CHIUSURA_MIN = 21 * 60;

export function finestraAperta(adesso: Date): boolean {
  const { minuti } = aRoma(adesso);
  return minuti >= APERTURA_MIN && minuti < CHIUSURA_MIN;
}

/** Fra quanti minuti si riapre la finestra (0 se è aperta). */
export function minutiAllApertura(adesso: Date): number {
  const { minuti } = aRoma(adesso);
  if (minuti < APERTURA_MIN) return APERTURA_MIN - minuti;
  if (minuti >= CHIUSURA_MIN) return 24 * 60 - minuti + APERTURA_MIN;
  return 0;
}

const giornoInMinuti = (g: string) => {
  const [a, m, d] = g.split("-").map(Number);
  return Date.UTC(a, m - 1, d) / 60_000;
};

/** Minuti da adesso all'appuntamento (positivo = nel futuro), orologio di Roma.
 *  shortcut: se fra adesso e l'appuntamento c'è il cambio dell'ora legale il
 *  conto sbaglia di 60 minuti; succede solo su distanze di giorni, dove i 60
 *  minuti di anticipo non contano. Da cambiare se le soglie diventano di giorni. */
export function minutiAlla(giorno: string, ora: string, adesso: Date): number {
  const r = aRoma(adesso);
  const [h, mi] = ora.split(":").map(Number);
  return giornoInMinuti(giorno) - giornoInMinuti(r.giorno) + h * 60 + mi - r.minuti;
}

/** Il nome come entra nel messaggio. Meta rifiuta (132018) un parametro con
 *  a-capo, tabulazioni o più di quattro spazi di fila, e il nome è testo
 *  libero scritto a mano. `null` se non resta niente. */
export function nomePerModello(nome?: string | null): string | null {
  const pulito = String(nome ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
    .trim();
  return pulito || null;
}
