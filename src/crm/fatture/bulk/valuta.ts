/** ── FATTURE BULK · L'ASSEMBLATORE (valuta.ts) ──
 *  SEGNAPOSTO di T0: i tipi e le firme ci sono, i corpi lanciano «da fare».
 *  Lo riempie T10 (PIANO §5); il file è suo e di nessun altro.
 *  L'unico punto che compone le regole: identico in browser e server. */
import type { ValutaLotto, ValutaRiga } from "./tipi";

const daFare = (compito: string): never => {
  throw new Error(`da fare (${compito})`);
};

/** File + letture + decisioni + contesto → campi effettivi, fattura simulata, `problemiXml`, motivi, stato, emettibile. */
export const valutaRiga: ValutaRiga = () => daFare("T10 valutaRiga");

export const valutaLotto: ValutaLotto = () => daFare("T10 valutaLotto");
