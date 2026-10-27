/** ── PRENOTA IN CHAT: I TESTI (stub del compito 0) ─────────────────────────
 *  Lo riempie il compito T3 (PIANO.md). Firme definitive: tutte pure,
 *  `(dati) => string`. */
import type { DatiAppuntamento, DatiNome, DatiProposte } from "./prenota-tipi";

export function testoProposte(_d: DatiProposte): string {
  throw new Error("da fare");
}
/** Nomina giorno, ora e consulente e contiene il link della stanza (D13). */
export function testoConferma(_d: DatiAppuntamento): string {
  throw new Error("da fare");
}
export function testoGiaFissato(_d: DatiAppuntamento): string {
  throw new Error("da fare");
}
/** «Quell'orario è appena stato preso» + le nuove proposte. */
export function testoPreso(_d: DatiProposte): string {
  throw new Error("da fare");
}
/** «Gli orari che Le avevo mandato non sono più validi» + le nuove proposte. */
export function testoVecchia(_d: DatiProposte): string {
  throw new Error("da fare");
}
export function testoNessunOrario(_d: DatiNome): string {
  throw new Error("da fare");
}
export function testoAltriFiniti(_d: DatiNome): string {
  throw new Error("da fare");
}
export function testoErrore(_d: DatiNome): string {
  throw new Error("da fare");
}
/** «Quell'opzione non c'è» + le stesse proposte. */
export function testoOpzioneNonCe(_d: DatiProposte): string {
  throw new Error("da fare");
}
export function testoAttesa(_d?: DatiNome): string {
  throw new Error("da fare");
}
