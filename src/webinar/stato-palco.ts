/** ── COSA DIRE A CHI STA SUL PALCO ─────────────────────────────────────────
 *
 *  ⚠️ DICEVA UNA COSA SOLA: «Sei in diretta. Ti sentono tutti.» — e non era
 *   sempre vera. Chi conduce può chiudere il microfono, spegnere la camera, o
 *   tutti e due: in quei momenti la persona continuava a leggere che la
 *   sentivano tutti, e parlava. Una frase che dice il contrario di quello che
 *   sta succedendo è peggio di nessuna frase: toglie anche il dubbio che
 *   avrebbe fatto controllare.
 *
 *  ⚠️ E IL COLORE FA IL LAVORO PRIMA DELLE PAROLE. Chi è sul palco sta
 *   parlando davanti a duecento persone: non legge, guarda. Verde = esci
 *   tutto; ambra = esci a metà; spento = non esci affatto. Le parole dicono
 *   QUALE metà.
 *
 *  ⚠️ «NON HAI LA CAMERA» E «TI HANNO CHIUSO LA CAMERA» SONO DUE COSE DIVERSE,
 *   e confonderle fa arrabbiare: chi è salito apposta in sola voce non deve
 *   leggere che qualcuno gliel'ha spenta, e chi se l'è vista spegnere deve
 *   sapere che non è un guasto suo — altrimenti si mette a cercare il
 *   permesso del browser mentre dovrebbe parlare.
 *
 *  ⚠️ NON SI DICE CHI L'HA FATTO. Le frasi erano firmate — «chi conduce ha
 *   chiuso il tuo microfono» — e la firma faceva due danni: allungava la
 *   riga proprio dove va letta in un secondo, e spostava l'attenzione su una
 *   persona invece che sulla cosa da sapere. A chi sta per parlare davanti a
 *   duecento persone serve sapere COSA esce di lui, non per mano di chi. Che
 *   non sia un suo guasto si dice lo stesso, perché quello cambia cosa fa: la
 *   differenza è fra spiegare e attribuire.
 */
export type TonoPalco = "verde" | "ambra" | "spento";

export interface StatoSulPalco {
  titolo: string;
  spiega: string;
  tono: TonoPalco;
}

export function statoSulPalco(o: {
  /** il microfono è aperto? lo comanda chi conduce */
  microfono: boolean;
  /** la camera è accesa adesso? */
  camera: boolean;
  /** è salito con la camera, o apposta in sola voce? */
  conCamera: boolean;
}): StatoSulPalco {
  const { microfono, camera, conCamera } = o;

  //  Nessuna delle due: è il caso che va detto più forte, perché da fuori la
  //  persona sembra in diretta e invece non esce niente.
  if (!microfono && (!camera || !conCamera)) {
    return {
      titolo: "Sei sul palco, ma non esci",
      spiega: conCamera
        ? "Microfono e camera sono chiusi: adesso non ti vedono e non ti sentono."
        : "Il microfono è chiuso: adesso non ti sentono.",
      tono: "spento",
    };
  }

  if (!microfono) {
    return {
      titolo: "Ti vedono, ma non ti sentono",
      spiega: "Il microfono è chiuso. Resta pure: si riapre quando tocca a te.",
      tono: "ambra",
    };
  }

  //  Il microfono è aperto: resta da dire come sta la camera.
  if (!conCamera) {
    return {
      titolo: "Sei in diretta, solo con la voce",
      spiega: "Ti sentono tutti. Sei entrato senza camera, quindi non ti vedono.",
      tono: "verde",
    };
  }

  if (!camera) {
    return {
      titolo: "Ti sentono, non ti vedono",
      spiega: "Ti sentono tutti. La camera è stata chiusa: non è un guasto tuo.",
      tono: "ambra",
    };
  }

  return {
    titolo: "Sei in diretta",
    spiega: "Ti vedono e ti sentono tutti.",
    tono: "verde",
  };
}
