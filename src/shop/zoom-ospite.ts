/** ── AZZERARE LO ZOOM DEL CLIENTE, SENZA IMPORTARE IL MOTORE ───────────────
 *  Cambiando schermata lo zoom del cliente si azzera: se no si ritrova la
 *  pagina nuova ingrandita come quella di prima. Il COME lo sa il motore (c'è
 *  di mezzo il viewport dei telefoni, che va ricalibrato in due tempi); qui
 *  c'è solo il filo per chiederlo.
 *  ⚠️ Come shop/gettone-cliente e shop/annuncio-pagina: serve a `shop/live`,
 *   che il CRM importa — e finché `shop/live` importava il motore, aprire il
 *   CRM voleva dire scaricare 254 kB di videochiamata. Misurato. */
let azzera: (() => void) | null = null;

/** Lo registra il motore della consulenza (shop/call). */
export function registraAzzeraZoom(f: (() => void) | null) { azzera = f; }

/** Azzera lo zoom, se c'è qualcuno che sa come farlo. */
export function azzeraZoomDelCliente() {
  try { azzera?.(); } catch { /* non è un guasto da annunciare */ }
}
