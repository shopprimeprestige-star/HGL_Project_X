/** ── PRENOTA IN CHAT: LA LETTURA A PAGINE (T6) ─────────────────────────────
 *
 *  Commessa 2026-10-27 (PIANO.md, rev. 4). PostgREST dà al massimo 1000 righe
 *  per richiesta e, oltre, taglia IN SILENZIO: un'agenda con le schede
 *  tagliate propone un orario che in realtà è occupato. Qui si legge a pagine
 *  da 1000 con `.range()` e, se l'archivio è più grande del tetto, si LANCIA:
 *  meglio una risposta di errore (e una setter che richiama) di un'agenda
 *  finta.
 *
 *  Puro: nessun database. Chi legge passa la funzione che sa leggere UNA
 *  pagina; ⚠️ quella funzione deve avere un `.order("id")` fisso, altrimenti
 *  fra una pagina e l'altra l'ordine può cambiare e le righe si ripetono o
 *  saltano (lo prova `prenota-porte.mjs`).
 *  ───────────────────────────────────────────────────────────────────────── */

/** Righe per pagina: il massimo che PostgREST dà in una richiesta. */
export const RIGHE_PER_PAGINA = 1000;

/** Legge a pagine da 1000 con `leggiPagina(da, a)` (estremi inclusi, come
 *  `.range()`), fino a `maxPagine`. Una pagina piena non è un errore: si legge
 *  la successiva; solo oltre il tetto, o con una pagina che fallisce, LANCIA
 *  (mai un risultato parziale).
 *  shortcut: se l'ultima pagina consentita è piena non si legge la successiva
 *  per vedere se è vuota ma si lancia: con esattamente `maxPagine × 1000` righe
 *  dà errore. Da cambiare solo se il tetto diventa troppo stretto. */
export async function leggiPaginato<T>(
  leggiPagina: (da: number, a: number) => Promise<T[]>,
  maxPagine: number,
): Promise<T[]> {
  const tutte: T[] = [];
  for (let pagina = 0; pagina < maxPagine; pagina++) {
    const da = pagina * RIGHE_PER_PAGINA;
    const righe = await leggiPagina(da, da + RIGHE_PER_PAGINA - 1);
    for (const riga of righe) tutte.push(riga);
    if (righe.length < RIGHE_PER_PAGINA) return tutte;
  }
  throw { code: "oltre_il_tetto" };
}
