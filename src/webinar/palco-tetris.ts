/** ── COME SI INCASTRANO LE PERSONE SUL PALCO ───────────────────────────────
 *
 *  Una regola sola, usata dalla console E dalla sala. È la stessa scelta già
 *  fatta per il montaggio (`chiVaInOnda`) e per la stessa ragione: se le due
 *  schermate calcolassero due disposizioni diverse, chi conduce vedrebbe una
 *  cosa e la sala un'altra — e se ne accorgerebbe solo riguardando la
 *  registrazione.
 *
 *  ── LE REGOLE, E PERCHÉ ───────────────────────────────────────────────────
 *
 *  1. METÀ SCHERMO È SEMPRE DI CHI CONDUCE. Non è una preferenza estetica: in
 *     un webinar la persona che sta tenendo il discorso non deve rimpicciolirsi
 *     ogni volta che qualcuno prende la parola, altrimenti il filo si perde.
 *     L'altra metà è di chi sta parlando adesso.
 *
 *  2. ⚠️ MA SE NON PARLA NESSUNO, LA METÀ NON SI LASCIA VUOTA. Tenere metà
 *     schermo nero «per coerenza» vuol dire dare a chi conduce un quarto dello
 *     spazio che avrebbe: quando è solo, prende tutto.
 *
 *  3. AFFIANCATI O UNO SOPRA L'ALTRO, secondo la FORMA dello schermo e non
 *     secondo il tipo di apparecchio. Un telefono girato di lato è largo come
 *     un tablet, e su uno schermo alto e stretto due riquadri affiancati sono
 *     due francobolli: si guarda quanto è largo rispetto a quanto è alto.
 *
 *  4. GLI ALTRI IN UNA FILA CHE SCORRE, al massimo sei per volta. Sei perché è
 *     il punto in cui una faccia in miniatura smette di essere riconoscibile:
 *     oltre, non si guadagna informazione, si perde soltanto dimensione. Chi
 *     resta fuori si raggiunge scorrendo, e QUANTI sono si dice — una fila che
 *     finisce senza dire che continua sembra tutta lì.
 *
 *  5. QUANTI CE NE STANNO DAVVERO lo decide la larghezza, non il desiderio: se
 *     sei riquadri non ci stanno se ne mettono meno e si scorre lo stesso. Un
 *     riquadro sotto i novanta punti non è più una persona, è un puntino.
 */

/** La larghezza minima perché in un riquadro si riconosca una faccia. Sotto,
 *  tanto vale non mostrarlo. */
export const MINIMA_FACCIA = 104;

/** Il tetto dichiarato: sei. Vedi la regola 4. */
export const MASSIMO_IN_FILA = 6;

export interface Disposizione {
  /** `solo` = chi conduce prende tutto; `duo` = metà e metà con chi parla. */
  modo: "solo" | "duo";
  /** `fianco` = affiancati, `sopra` = uno sopra l'altro. */
  orientamento: "fianco" | "sopra";
  /** quanti riquadri della fila ci stanno adesso */
  inFila: number;
  /** quanti restano fuori: si dice, non si nasconde */
  fuori: number;
  /** quanto è alta la fila, in punti */
  altezzaFila: number;
}

export function disponiPalco(o: {
  larghezza: number;
  altezza: number;
  /** quante persone ci sono sul palco, oltre a chi conduce */
  ospiti: number;
  /** c'è qualcuno in primo piano? (chi parla, o chi la regia ha scelto) */
  inPrimoPiano: boolean;
  /** Lo spazio VERO della scena, misurato, quando chi chiama ce l'ha.
   *  ⚠️ Serve solo a decidere se i due riquadri stanno meglio affiancati o uno
   *   sopra l'altro. L'altezza della fila continua a venire dalla finestra,
   *   apposta: la fila toglie altezza alla scena, e se la scena decidesse
   *   l'altezza della fila che le toglie l'altezza, le due misure si
   *   rincorrerebbero a ogni disegno. */
  scena?: { larghezza: number; altezza: number };
}): Disposizione {
  const larghezza = Math.max(0, o.larghezza || 0);
  const altezza = Math.max(0, o.altezza || 0);
  const ospiti = Math.max(0, Math.floor(o.ospiti || 0));

  //  ⚠️ «C'è qualcuno in primo piano» non basta: se non c'è NESSUNO sul palco
  //   non c'è niente da mettere nell'altra metà, e la promessa di un secondo
  //   riquadro resterebbe un rettangolo nero.
  const modo: Disposizione["modo"] = o.inPrimoPiano && ospiti > 0 ? "duo" : "solo";

  //  ── DOVE STA IL SECONDO RIQUADRO ────────────────────────────────────
  //  ⚠️ NON dalla forma della finestra: da quale delle due dà la faccia più
  //   grande. Erano affiancati appena la scena era larga più di 1,15 volte
  //   l'altezza, e in console si vedeva il risultato — due riquadri da 433
  //   punti in mezzo a una scena di 872×590, con centosessanta punti di vuoto
  //   sopra e altrettanti sotto. Uno sopra l'altro, nello stesso spazio, i
  //   riquadri venivano da 519. Più grandi: quindi è quella la disposizione
  //   giusta, e la forma della finestra non c'entra.
  //   Il conto è lo stesso di `riquadroDentro`, fatto due volte.
  const spazio = o.scena && o.scena.larghezza > 0 ? o.scena : { larghezza, altezza };
  const RAPPORTO = 16 / 9;
  const SPAZIO_FRA = 6; //  il `gap-1.5` fra le due metà
  const affiancati = Math.min(
    (spazio.larghezza - SPAZIO_FRA) / 2,
    Math.max(0, spazio.altezza) * RAPPORTO,
  );
  const impilati = Math.min(
    spazio.larghezza,
    ((Math.max(0, spazio.altezza) - SPAZIO_FRA) / 2) * RAPPORTO,
  );
  const orientamento: Disposizione["orientamento"] = affiancati >= impilati ? "fianco" : "sopra";

  //  Nella fila stanno tutti tranne chi è già grande nell'altra metà.
  const daMettere = Math.max(0, ospiti - (modo === "duo" ? 1 : 0));

  //  ⚠️ Se non c'è nessuno da mettere, la fila NON esiste — e la sua altezza è
  //   zero, non «piccola»: una striscia vuota alta ottanta punti è spazio
  //   rubato a chi conduce, tutte le volte.
  if (daMettere === 0) return { modo, orientamento, inFila: 0, fuori: 0, altezzaFila: 0 };

  const ciStanno = Math.max(1, Math.floor(larghezza / MINIMA_FACCIA));
  const inFila = Math.min(daMettere, MASSIMO_IN_FILA, ciStanno);

  //  L'altezza cresce con lo schermo ma non oltre: su un monitor grande una
  //  fila alta un quinto della pagina toglierebbe alla scena senza aggiungere
  //  niente — quelle sono miniature, e una miniatura più grande resta una
  //  miniatura.
  const altezzaFila = Math.round(Math.min(148, Math.max(72, altezza * 0.17)));

  return { modo, orientamento, inFila, fuori: daMettere - inFila, altezzaFila };
}

/** ── COME RIEMPIRE UN RIQUADRO ─────────────────────────────────────────────
 *
 *  ⚠️ LA DOMANDA NON È «CHI È», È «QUANTO SPAZIO HA».
 *
 *   · CHI CONDUCE, DA SOLO, non si taglia mai. È la faccia su cui si regge la
 *     diretta, ha tutta la scena a disposizione, e tagliarla è stato il primo
 *     difetto segnalato: con una fascia larga e bassa si vedeva una fetta di
 *     soffitto al posto di una persona. Lì una banda nera è il male minore.
 *
 *   · CHI CONDUCE, IN DUE, riempie la sua metà. È il caso indicato dal
 *     committente: con due riquadri affiancati la cella diventa quasi quadrata,
 *     e un 16:9 lasciato intero ci sta dentro con due bande nere che sono un
 *     terzo dello spazio. Meglio tagliare i lati di un'inquadratura che
 *     regalare un terzo di metà schermo al nero — e in un riquadro quasi
 *     quadrato di una faccia si taglia lo sfondo, non la faccia.
 *
 *   · TUTTI GLI ALTRI riempiono sempre. Sono celle piccole, e una miniatura
 *     con le bande è metà miniatura.
 */
export function riempimento(
  chi: "conduce" | "parla" | "miniatura",
  modo: Disposizione["modo"] = "duo",
): "contain" | "cover" {
  return chi === "conduce" && modo === "solo" ? "contain" : "cover";
}

/** Il riquadro più grande con le proporzioni giuste che entra in uno spazio.
 *
 *  ⚠️ QUESTO CONTO NON SI PUÒ FARE IN CSS. Ho provato con
 *  `height:100%; aspect-ratio:16/9; max-width:100%`: quando è la larghezza a
 *  non bastare, il browser tronca la larghezza e TIENE l'altezza — il riquadro
 *  diventa 870×578, cioè 1,5:1, e il video 16:9 dentro viene tagliato ai lati.
 *  È esattamente quello che si vedeva nella console: la scritta a destra
 *  mangiata. Con due misure vere e una moltiplicazione, invece, il riquadro è
 *  16:9 sempre, e non c'è nulla né da tagliare né da riempire di nero.
 *
 *  Torna zero finché lo spazio non è stato misurato: chi chiama tiene la sua
 *  strada di riserva, così al primo disegno non si vede un buco. */
export function riquadroDentro(
  larghezza: number,
  altezza: number,
  rapporto = 16 / 9,
): { larghezza: number; altezza: number } {
  if (!(larghezza > 0) || !(altezza > 0)) return { larghezza: 0, altezza: 0 };
  //  Provo a riempire in larghezza; se così sfora in altezza, comando l'altezza.
  const perLarghezza = larghezza / rapporto;
  return perLarghezza <= altezza
    ? { larghezza: Math.floor(larghezza), altezza: Math.floor(perLarghezza) }
    : { larghezza: Math.floor(altezza * rapporto), altezza: Math.floor(altezza) };
}

/** ── IL FACCIA A FACCIA: DUE QUADRATI UGUALI ───────────────────────────────
 *
 *  Serve a una cosa sola e va detta: un DIBATTITO. Chi conduce e una persona
 *  che gli risponde, messi alla pari, grandi, uno accanto all'altro — e tutti
 *  gli altri sotto, piccoli. È il montaggio che si usa in televisione quando
 *  due persone si parlano, e funziona perché nessuno dei due è ospite
 *  dell'altro: sono due riquadri identici.
 *
 *  ⚠️ QUADRATI, NON 16:9. Due 16:9 affiancati su uno schermo da computer
 *   vengono lunghi e bassi: ci sta dentro un mezzobusto sdraiato, con mezzo
 *   metro di soffitto sopra e la scrivania sotto. Un quadrato inquadra una
 *   faccia — è la forma che usano tutti quelli che mettono due persone a
 *   confronto, e non è un caso.
 *
 *  ⚠️ AFFIANCATI O UNO SOPRA L'ALTRO, si sceglie come per il resto del palco:
 *   quale delle due dà il quadrato più grande. Su un telefono in piedi
 *   affiancati verrebbero due francobolli da centottanta punti; impilati, due
 *   quadrati da trecentosettanta. La forma dello schermo decide, non la
 *   consuetudine.
 */
export interface Duello {
  /** il lato del quadrato, in punti */
  lato: number;
  /** affiancati o uno sopra l'altro */
  orientamento: "fianco" | "sopra";
}

export function duello(larghezza: number, altezza: number, spazio = 6): Duello {
  const l = Math.max(0, larghezza || 0);
  const a = Math.max(0, altezza || 0);
  if (!(l > 0) || !(a > 0)) return { lato: 0, orientamento: "fianco" };

  const affiancati = Math.min((l - spazio) / 2, a);
  const impilati = Math.min(l, (a - spazio) / 2);
  return affiancati >= impilati
    ? { lato: Math.max(0, Math.floor(affiancati)), orientamento: "fianco" }
    : { lato: Math.max(0, Math.floor(impilati)), orientamento: "sopra" };
}
