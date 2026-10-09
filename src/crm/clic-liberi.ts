/** ─────────────────────────────────────────────────────────────────────────
 *  I CLIC NON DEVONO POTER MORIRE
 *
 *  SEGNALAZIONE DEL COMMITTENTE
 *  «Su Chrome il CRM va male, si blocca, non clicca bene.»
 *
 *  COSA SUCCEDE DAVVERO — misurato, non dedotto
 *  Le finestre del CRM sono dialoghi Radix. Finché una è aperta, Radix scrive
 *  `pointer-events: none` sul <body>: è giusto, serve a impedire che i clic
 *  finiscano sulla pagina dietro al velo. Quella riga viene tolta quando la
 *  finestra si SMONTA — e la finestra si smonta alla fine della sua animazione
 *  di uscita, cioè quando il browser manda `animationend`.
 *
 *  Se quell'evento non arriva, non si smonta niente: il <body> resta con
 *  `pointer-events: none` PER SEMPRE. Da quel momento nessun clic, in nessun
 *  punto della pagina, raggiunge più niente — `document.elementFromPoint()`
 *  risponde «nessuno». Il CRM sembra bloccato: le schede si vedono, il mouse
 *  si muove, e non succede nulla. L'unico rimedio è ricaricare.
 *
 *  E l'animazione non parte tutte le volte che Chrome decide di non dipingere:
 *  scheda in secondo piano, finestra coperta da un'altra applicazione, finestra
 *  ridotta a icona. Chiudere una finestra e passare subito ad altro — che è il
 *  gesto più normale del mondo — basta a lasciare il CRM morto al ritorno.
 *  L'ho riprodotto: apri una scheda, chiudila, e il <body> resta a
 *  `pointer-events: none` anche dopo cinque secondi, con la finestra ancora
 *  attaccata al documento in stato «closed» e l'animazione «exit» mai partita.
 *
 *  LA CURA — ⚠️ UNA RETE, NON UNA MODIFICA AL COMPORTAMENTO
 *  Non si tocca Radix e non si tolgono le animazioni: si controlla una cosa
 *  sola, «il body è bloccato mentre non c'è nessuna finestra aperta?», e in
 *  quel caso si libera. Se una finestra è davvero aperta non si fa niente, così
 *  il velo continua a proteggere la pagina dietro come ha sempre fatto.
 *
 *  ⚠️ QUANDO SI CONTROLLA, E PERCHÉ PROPRIO LÌ
 *   · al primo clic dell'utente: con il body bloccato l'evento non colpisce
 *     nessun elemento, ma arriva lo stesso fino al documento — quindi il
 *     CRM si sblocca da solo appena si prova a usarlo;
 *   · quando la scheda torna in primo piano: è esattamente il momento in cui
 *     il guasto si è prodotto mentre non si guardava;
 *   · quando qualcuno riscrive lo stile del body: è Radix che apre o chiude.
 *  Nessun timer che gira a vuoto: tre eventi, e si dorme.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Le finestre e i menu che, se aperti, hanno DIRITTO di bloccare la pagina.
 *  ⚠️ Non basta cercare i dialoghi: anche un menu a tendina, un elenco a
 *   scelta e un calendario Radix bloccano il body mentre sono aperti, e
 *   liberarlo sotto di loro vorrebbe dire far passare i clic attraverso il
 *   menu aperto — cioè creare un guasto per ripararne un altro. */
const APERTI = [
  '[data-state="open"][role="dialog"]',
  '[data-state="open"][role="alertdialog"]',
  '[data-state="open"][role="menu"]',
  '[data-state="open"][role="listbox"]',
  '[data-state="open"][data-radix-menu-content]',
  '[data-state="open"][data-radix-popover-content]',
  '[data-radix-popper-content-wrapper] [data-state="open"]',
].join(",");

/** C'è davvero qualcosa di aperto che deve tenere la pagina bloccata? */
export function qualcosaDiAperto(doc: Document): boolean {
  return !!doc.querySelector(APERTI);
}

/** Il body è bloccato senza motivo? Restituisce true se ha liberato i clic.
 *  È una funzione pura di ciò che vede nel documento: nessun timer, nessuno
 *  stato nascosto, così si può provare. */
export function liberaIClic(doc: Document = document): boolean {
  const body = doc.body;
  if (!body) return false;
  //  Si guarda lo stile SCRITTO A MANO sull'elemento, non quello calcolato:
  //  `pointer-events: none` può arrivare anche da un foglio di stile per
  //  ragioni sue, e toglierlo da lì non è affar nostro.
  if (body.style.pointerEvents !== "none") return false;
  if (qualcosaDiAperto(doc)) return false;
  body.style.removeProperty("pointer-events");
  return true;
}

/** Attacca la rete. Restituisce la funzione che la stacca.
 *  ⚠️ Il controllo è SEMPRE differito di un attimo: quando una finestra si
 *   chiude, lo stile del body e lo smontaggio del nodo non avvengono nello
 *   stesso istante, e controllare troppo presto vorrebbe dire vedere una
 *   finestra ancora aperta e non fare niente. */
export function reteDeiClic(doc: Document = document): () => void {
  let sospeso: number | undefined;
  const fraPoco = () => {
    if (sospeso !== undefined) return;
    sospeso = (doc.defaultView ?? window).setTimeout(() => {
      sospeso = undefined;
      if (liberaIClic(doc)) {
        //  Lasciato di proposito: se ricompare spesso, il difetto è a monte e
        //  questa riga è l'unica traccia che lo dice.
        console.warn("[CRM] la pagina era rimasta bloccata ai clic: sbloccata");
      }
    }, 120);
  };

  /*  ⚠️ IL CONTROLLO A COSTO ZERO. Questi ascoltatori stanno su gesti che
      accadono centinaia di volte al minuto: prima di fare qualunque cosa si
      confronta UNA stringa, e nel caso normale — la pagina non è bloccata —
      si esce subito senza toccare il documento e senza accendere timer. */
  const forse = () => {
    if (doc.body?.style.pointerEvents !== "none") return;
    fraPoco();
  };

  //  Il movimento del mouse: la pagina si sblocca PRIMA che l'utente provi a
  //  cliccare, così non perde nemmeno un gesto.
  doc.addEventListener("mousemove", forse, { capture: true, passive: true });
  //  Il primo clic dell'utente: con il body bloccato non colpisce nessun
  //  elemento, ma arriva comunque al documento. È la via più veloce perché
  //  il CRM torni a rispondere — al secondo clic, non al ricaricamento.
  doc.addEventListener("pointerdown", forse, true);
  //  Il ritorno sulla scheda: è lì che il guasto si è prodotto, mentre
  //  l'animazione di uscita non poteva partire.
  doc.addEventListener("visibilitychange", fraPoco);
  (doc.defaultView ?? window).addEventListener("focus", fraPoco);

  //  E quando è Radix stesso a riscrivere lo stile del body: apre (e non si
  //  tocca niente) o chiude (e si controlla).
  const osservatore =
    typeof MutationObserver !== "undefined"
      ? new MutationObserver(fraPoco)
      : null;
  if (osservatore && doc.body)
    osservatore.observe(doc.body, { attributes: true, attributeFilter: ["style"] });

  return () => {
    if (sospeso !== undefined) (doc.defaultView ?? window).clearTimeout(sospeso);
    doc.removeEventListener("mousemove", forse, { capture: true } as EventListenerOptions);
    doc.removeEventListener("pointerdown", forse, true);
    doc.removeEventListener("visibilitychange", fraPoco);
    (doc.defaultView ?? window).removeEventListener("focus", fraPoco);
    osservatore?.disconnect();
  };
}
