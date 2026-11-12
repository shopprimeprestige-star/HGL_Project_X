/** ── FATTURE BULK · L'ORCHESTRAZIONE NEL BROWSER (usa-lotto.ts) ──
 *  SEGNAPOSTO di T0: i tipi e le firme ci sono, i corpi lanciano «da fare».
 *  Lo riempie T11 (dopo T8). L'hook (`useReducer`) non ricalcola mai stati: li
 *  riceve da `valutaRiga`. Le parti pure (`pianoDiCarico`) si provano in
 *  prove/fatture-bulk/carico.mjs. */

const daFare = (compito: string): never => {
  throw new Error(`da fare (${compito})`);
};

/** Dei file scelti, quali caricare e quali sono già nel lotto (ripresa a metà caricamento). */
export function pianoDiCarico(salvati: number[], daCaricare: number[]): { carica: number[]; giaSalvati: number[] } {
  return daFare("T11 pianoDiCarico");
}

/** L'hook di orchestrazione: carica, legge, riprende, rilegge, azioni di riga, emissione sequenziale. */
export function useLotto(): never {
  return daFare("T11 useLotto");
}
