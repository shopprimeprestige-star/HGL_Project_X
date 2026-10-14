/** ── REGOLE DEGLI ORARI DEL CALENDARIO (funzioni pure, niente schermo) ──────
 *  Nel modo «solo-calendario» di `BookingFunnel` (il modulo corto) un orario
 *  già passato non si offre. La regola è quella della funzione SQL
 *  `fissa_orario_lead_sito`: «oggi» e «adesso» sono quelli di Roma
 *  (`Europe/Rome`), e se la data è oggi l'orario deve essere DOPO l'ora attuale.
 *  Così il calendario non propone mai un orario che il server rifiuterebbe
 *  (`non_valido`). Il funnel lungo (modo «completo») non passa `adesso` e si
 *  comporta come sempre.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Il giorno (`AAAA-MM-GG`) e i minuti dalla mezzanotte, ora di Roma, per l'istante dato. */
export function adessoARoma(adesso: Date): { oggi: string; minuti: number } {
  const parti = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(adesso);
  const v = (tipo: string) => parti.find((p) => p.type === tipo)?.value ?? "00";
  return { oggi: `${v("year")}-${v("month")}-${v("day")}`, minuti: Number(v("hour")) * 60 + Number(v("minute")) };
}

/** `HH:MM` → minuti dalla mezzanotte; `null` se non è un orario vero. */
function minutiDi(ora: string): number | null {
  const m = /^([0-2]\d):([0-5]\d)$/.exec(ora);
  if (!m) return null;
  const h = Number(m[1]);
  return h > 23 ? null : h * 60 + Number(m[2]);
}

interface Parametri {
  /** `AAAA-MM-GG`. */
  data: string;
  /** Gli orari della giornata, nell'ordine in cui si mostrano. */
  orari: readonly string[];
  /** Orari chiusi dal titolare per quella data. */
  bloccati: readonly string[];
  /** Orari già presi da altri lead. */
  occupati: readonly string[] | ReadonlySet<string>;
  /** Solo nel modo «solo-calendario»: se c'è, i giorni e gli orari passati non si offrono. */
  adesso?: Date;
}

/** Gli orari che si possono scegliere in quella data. */
export function orariDelGiorno({ data, orari, bloccati, occupati, adesso }: Parametri): string[] {
  const presi = occupati instanceof Set ? occupati : new Set(occupati);
  let liberi = orari.filter((t) => !bloccati.includes(t) && !presi.has(t));
  if (!adesso) return liberi;
  const { oggi, minuti } = adessoARoma(adesso);
  if (data < oggi) return [];
  liberi = liberi.filter((t) => {
    const m = minutiDi(t);
    return m !== null && (data > oggi || m > minuti);
  });
  return liberi;
}
