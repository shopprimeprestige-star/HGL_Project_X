/** ── LE CAMERE, QUADRATE, GRANDI QUANTO SI PUÒ ─────────────────────────────
 *
 *  Richiesta del committente: «il layout della videochiamata, sull'ospite su
 *  mobile, sia quadrato sia per gli ospiti che per il presentatore, e che
 *  occupi più spazio possibile».
 *
 *  ── PERCHÉ IL RIQUADRO «GIUSTO» LASCIAVA LO SCHERMO VUOTO ────────────────
 *  Prima ogni riquadro prendeva la FORMA della sua camera, e la cella gli
 *  stava larga: un telefono manda un'immagine alta (9:16), un computer una
 *  larga (16:9), e due forme opposte nella stessa griglia non si incastrano.
 *  Nella schermata segnalata — due persone — si vedeva una striscia verticale
 *  da una parte, un rettangolo basso dall'altra e metà schermo di sfondo. Era
 *  corretto (nessuna immagine tagliata) ed era sbagliato da guardare: in una
 *  consulenza si guarda una faccia, e la faccia era grande un quarto di quello
 *  che poteva essere.
 *
 *  ── LA REGOLA ────────────────────────────────────────────────────────────
 *  Tutte le celle QUADRATE e tutte UGUALI, il più grandi possibile. Si provano
 *  tutte le disposizioni (1 colonna, 2, 3…) e vince quella che fa il quadrato
 *  più grande: su un telefono in verticale con due persone vengono due quadrati
 *  impilati che riempiono l'altezza; su un monitor largo, due quadrati
 *  affiancati che riempiono la larghezza.
 *
 *  ⚠️ IL QUADRATO TAGLIA, ED È UNA SCELTA. L'immagine riempie la cella
 *   (`object-cover`): da un 16:9 si perdono i lati, da un 9:16 si perdono sopra
 *   e sotto. In una videochiamata la faccia sta in mezzo, ed è il
 *   comportamento di tutte le applicazioni di questo tipo. Dove l'immagine NON
 *   si può tagliare — il media che il consulente mostra al cliente, la camera
 *   singola a tutto schermo — non si passa di qui: quelle restano intere.
 *  ⚠️ QUI NON SI DISEGNA NIENTE: si risponde «quante colonne, quante righe,
 *   che lato». Così la si prova senza aprire un browser (vedi
 *   proveDellaGrigliaCamere) — il calcolo è tutto in queste dieci righe, ed è
 *   quello che decide se lo schermo è pieno o mezzo vuoto.
 *  ───────────────────────────────────────────────────────────────────────── */

export interface Disposizione {
  colonne: number;
  righe: number;
  /** Il lato del quadrato, in punti. 0 quando l'area non è ancora misurata. */
  lato: number;
}

export function disposizioneQuadrata(
  n: number,
  larghezza: number,
  altezza: number,
  spazio = 6,
): Disposizione {
  const quante = Math.max(0, Math.floor(n));
  if (quante <= 0) return { colonne: 1, righe: 1, lato: 0 };
  //  Area non ancora misurata (primo disegno, pagina costruita sul server):
  //  si risponde con una colonna e lato 0 — chi disegna se la cava con lo
  //  spazio che ha, e al primo `ResizeObserver` arriva la misura vera.
  if (!(larghezza > 0) || !(altezza > 0)) return { colonne: 1, righe: quante, lato: 0 };

  let scelta: Disposizione = { colonne: 1, righe: quante, lato: 0 };
  for (let colonne = 1; colonne <= quante; colonne++) {
    const righe = Math.ceil(quante / colonne);
    const lato = Math.min(
      (larghezza - spazio * (colonne - 1)) / colonne,
      (altezza - spazio * (righe - 1)) / righe,
    );
    //  ⚠️ Il confronto ha una soglia: fra due disposizioni che danno lo stesso
    //   lato (a meno di mezzo punto) vince la PRIMA, cioè quella con meno
    //   colonne. Senza soglia, un arrotondamento faceva cambiare disposizione
    //   a ogni ridisegno — la griglia «ballava» mentre si parlava.
    if (lato > scelta.lato + 0.5) scelta = { colonne, righe, lato };
  }
  //  Un lato negativo vuol dire che nemmeno un quadrato ci sta (area
  //  microscopica): si risponde 0 e non un numero impossibile.
  return { ...scelta, lato: Math.max(0, scelta.lato) };
}
