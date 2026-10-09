/** ── QUELLO CHE VIENE MANDATO IN ONDA ─────────────────────────────────────
 *
 *  ⚠️ QUI C'ERA UNA PROIEZIONE, ed è stata tolta: la pagina si disegnava
 *   sempre a 1280×720 e veniva rimpicciolita nel riquadro. Rimediava a un
 *   difetto vero — il palco della sala era una striscia 16:9 alta duecento
 *   punti — ma quel difetto adesso non c'è più, perché con un contenuto in
 *   onda la chat si sposta nella sua scheda e il palco prende tutto lo
 *   schermo. Rimasta lì, la proiezione faceva il danno al contrario: due bande
 *   nere in verticale sul telefono e la pagina disegnata piccola dentro una
 *   forma che nessuno le aveva chiesto.
 *   La lezione da tenere: si toglie il MALE, non si aggiunge un rimedio sopra
 *   l'altro. Il male era la striscia.
 */

/** ── QUALE PAGINA STA VEDENDO LA SALA ──────────────────────────────────────
 *
 *  ⚠️ LA REGIA HA DUE VITE, E IL PERCORSO NON SI LEGGE ALLO STESSO MODO.
 *   · Dentro la postazione delle consulenze la regia è una barra: quando
 *     scegli «Media», l'applicazione NAVIGA davvero, e l'indirizzo del browser
 *     diventa quello che vede anche la sala.
 *   · Nella pagina `/regia/<codice>` invece l'indirizzo resta `/regia/...` per
 *     sempre: il contenuto vive dentro un riquadro incorporato, e quale sia lo
 *     dice solo lo stato interno.
 *
 *   Mandare in giro `window.location.pathname` funziona nel primo caso e nel
 *   secondo manda alla sala «/regia/gfr-tzmt-drr» — un indirizzo che non è un
 *   contenuto. Da lì il difetto segnalato: premi «Mostra» su una foto, tu la
 *   vedi, e alla sala non arriva niente di nuovo perché il percorso pubblicato
 *   non è mai cambiato. Non era il media a non partire: era l'indirizzo.
 */
export function percorsoDaMandare(o: {
  /** siamo nella pagina `/regia/<codice>`? */
  pagina: boolean;
  /** cosa mostra il riquadro incorporato, quando c'è */
  contenuto: string;
  /** l'indirizzo del browser, che vale solo quando si naviga davvero */
  browser: string;
}): string {
  const scelto = o.pagina ? o.contenuto : o.browser;
  //  ⚠️ Un indirizzo di regia non è un contenuto: se per qualunque motivo
  //   finisse qui, meglio non toccare niente che mandare la sala su una
  //   pagina che non le appartiene.
  return /^\/regia(\/|$)/.test(scelto) ? "" : scelto;
}
