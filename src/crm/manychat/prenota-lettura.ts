/** ── PRENOTA IN CHAT: LA LETTURA A PAGINE (stub del compito 0) ─────────────
 *  Lo riempie il compito T6 (PIANO.md). Firma definitiva. */

/** Legge a pagine da 1000 con `leggiPagina(da, a)` (estremi inclusi, come
 *  `.range()`), fino a `maxPagine`. Una pagina piena non è un errore: si legge
 *  la successiva; solo oltre il tetto, o con una pagina che fallisce, LANCIA
 *  (mai un risultato parziale). */
export async function leggiPaginato<T>(
  _leggiPagina: (da: number, a: number) => Promise<T[]>,
  _maxPagine: number,
): Promise<T[]> {
  throw new Error("da fare");
}
