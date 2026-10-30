/** ── NOTE VOCALI · REGOLE PURE ────────────────────────────────────────────────
 *  Il testo dettato in scheda lead si AGGIUNGE in fondo alle note, mai le
 *  sostituisce, con una riga d'origine («[Vocale 30/10 13:32] …») per capire
 *  a colpo d'occhio che è parlato e quando (può contenere errori di ascolto).
 *  Solo testo: nessun invio, nessuna risposta. Il giorno e l'ora sono quelli
 *  italiani, qualunque sia il fuso del computer. */

const PARTI = new Intl.DateTimeFormat("it-IT", {
  timeZone: "Europe/Rome",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** «30/10 13:32», ora d'Italia. */
export function etichettaVocale(quando: Date): string {
  const p = Object.fromEntries(PARTI.formatToParts(quando).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
}

/** Le note con il dettato in coda. Dettato vuoto: le note restano com'erano. */
export function notaConDettato(
  note: string | undefined,
  dettato: string,
  quando: Date,
): string | undefined {
  const d = dettato.trim();
  if (!d) return note;
  const riga = `[Vocale ${etichettaVocale(quando)}] ${d}`;
  const prima = (note ?? "").trimEnd();
  return prima ? `${prima}\n\n${riga}` : riga;
}
