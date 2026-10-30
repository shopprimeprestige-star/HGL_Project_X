/** ── L'ELENCO SI DISEGNA A PEZZI (p1-chat-veloce, 30/10/2026) ───────────────────
 *  Con 2.000+ chat, disegnarle tutte voleva dire 95.000 nodi nella pagina e secondi di blocco a
 *  ogni cambio. Si disegnano le prime `RIGHE_INIZIALI`, e `PASSO_RIGHE` in più quando si scende
 *  verso il fondo. Tutto quello che si conta o si sceglie («Seleziona tutto», i numeri delle
 *  pillole) usa gli elenchi interi: qui si taglia solo quello che si DISEGNA. Pura. */
export const RIGHE_INIZIALI = 40;
export const PASSO_RIGHE = 40;

/** Le sezioni dell'elenco, una dopo l'altra, tagliate a `n` righe in tutto (la prima ha la precedenza).
 *  Una sezione intera resta com'è (stessa lista, niente copia). Non muta l'ingresso. */
export function tagliaSezioni<T>(n: number, ...sezioni: T[][]): T[][] {
  let resto = Math.max(0, n);
  return sezioni.map((s) => {
    const k = Math.min(s.length, resto);
    resto -= k;
    return k === s.length ? s : s.slice(0, k);
  });
}
