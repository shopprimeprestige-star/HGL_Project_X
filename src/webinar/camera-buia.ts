/** ── QUANDO UNA CAMERA ARRIVA MA NON PORTA NIENTE ──────────────────────────
 *
 *  ⚠️ «TRACCIA VIVA» NON VUOL DIRE «SI VEDE QUALCOSA». Misurato in sala su una
 *   diretta vera: la traccia di un ospite era `live`, non muta, il tempo del
 *   video scorreva (26 secondi) e la risoluzione era vera (360×640) — eppure
 *   OGNI pixel era nero, luminanza massima ZERO. Succede tutte le volte che il
 *   telefono di chi partecipa manda il browser in secondo piano: il sistema
 *   sospende la camera e l'encoder continua a spedire fotogrammi neri. Succede
 *   anche con l'obiettivo coperto, o con la traccia disabilitata dal mittente.
 *
 *  ⚠️ IL CONTROLLO CHE C'ERA NON BASTAVA: guardava `readyState` e `enabled`,
 *   che qui dicono tutti e due di sì. Il risultato era un rettangolo nero col
 *   nome sopra — cioè esattamente la cosa che quel controllo esisteva per
 *   evitare, e che dall'altra parte si legge come «il webinar è rotto».
 *
 *  ⚠️ SI GUARDA IL PIXEL PIÙ CHIARO, non la media. Una stanza buia ha una
 *   media bassissima ma quasi sempre qualcosa che riflette: una lampadina, uno
 *   schermo, un riflesso sugli occhiali. Con la media si spegnerebbe la camera
 *   di chi è seduto in penombra — che invece si vede benissimo.
 *
 *  ⚠️ E SERVONO PIÙ CAMPIONI DI FILA. Il primo fotogramma dopo l'aggancio è
 *   nero quasi sempre, perché il decodificatore non ha ancora niente da
 *   mostrare: decidere su quello vorrebbe dire far lampeggiare l'avatar a ogni
 *   persona che sale sul palco.
 */

/** Sopra questo valore c'è qualcosa da vedere. Tre su 255: sono i neri di
 *  compressione, non un'immagine. */
export const SOGLIA_LUCE = 4;
/** Quanti campioni consecutivi al buio prima di dirlo. A un campione ogni due
 *  secondi fanno sei secondi: abbastanza da non lampeggiare, poco da non
 *  lasciare un buco nero a lungo. */
export const CAMPIONI_AL_BUIO = 3;

/** `true` quando la camera va considerata spenta.
 *  ⚠️ Con pochi campioni si risponde SEMPRE «no»: nel dubbio si mostra il
 *   video. Sbagliare mostrando un video nero per sei secondi costa molto meno
 *   che sbagliare nascondendo la faccia di chi sta parlando. */
export function cameraSpenta(campioni: readonly number[]): boolean {
  if (!Array.isArray(campioni) || campioni.length < CAMPIONI_AL_BUIO) return false;
  return campioni
    .slice(-CAMPIONI_AL_BUIO)
    .every((c) => Number.isFinite(c) && c <= SOGLIA_LUCE);
}

/** ── IL CAMPIONAMENTO ──────────────────────────────────────────────────────
 *  ⚠️ QUESTA LETTURA COSTA, E SI VEDE. `getImageData` su un elemento video
 *   obbliga il browser a riportare l'immagine dalla scheda grafica alla
 *   memoria normale: è una delle poche cose che possono bloccare la
 *   composizione della pagina. Farla ogni due secondi PER OGNI RIQUADRO —
 *   quattro riquadri fanno due letture al secondo — ha fatto andare a scatti
 *   la diretta, segnalato subito dopo averlo introdotto. Il rimedio alla
 *   camera nera stava rompendo la cosa che doveva salvare.
 *
 *   Tre cose, e insieme cambiano l'ordine di grandezza:
 *    · QUATTRO PER QUATTRO pixel invece di otto per otto: un quarto dei dati,
 *      e per rispondere a «c'è qualcosa o è tutto nero» sedici pixel bastano;
 *    · UNA TELA SOLA per tutta la pagina, non una nuova a ogni giro: creare un
 *      elemento e chiedergli un contesto è un costo che si pagava a ogni
 *      campione e per ogni riquadro;
 *    · E SI SALTA QUANDO LA PAGINA È DIETRO: leggere i pixel di un video che
 *      nessuno sta guardando è lavoro buttato, e sono la maggioranza dei
 *      secondi di una diretta.
 *
 *  ⚠️ Il disegno può FALLIRE (video non ancora pronto): in quel caso non si
 *   campiona affatto invece di registrare uno zero, che verrebbe letto come
 *   buio.
 */

/** ⚠️ Una sola per tutta la pagina. Le tele sono oggetti pesanti e non c'è
 *  nessuna ragione per averne una per riquadro: si disegna, si legge, si
 *  passa al prossimo. */
let tela: HTMLCanvasElement | null = null;
let pennello: CanvasRenderingContext2D | null = null;

export function guardaSeBuia(video: HTMLVideoElement): number | null {
  //  ⚠️ Con la pagina dietro non si legge niente: il browser non sta nemmeno
  //   disegnando, e la lettura costerebbe senza dire niente di nuovo.
  if (typeof document !== "undefined" && document.visibilityState !== "visible") return null;
  //  ⚠️ NESSUNA DIMENSIONE CONTA COME BUIO, non come «non lo so». Un elemento
  //   video agganciato a una traccia viva che dopo qualche secondo non ha
  //   ancora una risoluzione non sta per mostrare qualcosa: non sta mostrando
  //   niente. Tornando `null` il campionamento si fermava e il riquadro
  //   restava nero PER SEMPRE — è il quadrato nero visto in regia.
  if (!video.videoWidth || !video.videoHeight) return 0;
  try {
    if (!tela) {
      tela = document.createElement("canvas");
      tela.width = 4;
      tela.height = 4;
      pennello = tela.getContext("2d", { willReadFrequently: true });
    }
    if (!pennello) return null;
    pennello.drawImage(video, 0, 0, 4, 4);
    const d = pennello.getImageData(0, 0, 4, 4).data;
    let massimo = 0;
    for (let i = 0; i < d.length; i += 4) {
      const luce = (d[i] + d[i + 1] + d[i + 2]) / 3;
      if (luce > massimo) massimo = luce;
    }
    return massimo;
  } catch {
    return null;
  }
}

/** ── OGNI QUANTO GUARDARE ──────────────────────────────────────────────────
 *  ⚠️ Non è un numero solo. Finché non si è deciso, e finché la camera risulta
 *   buia, si guarda spesso: nel primo caso perché la risposta serve, nel
 *   secondo perché una camera che torna deve tornare subito. Quando invece si
 *   sta vedendo qualcosa, la domanda è già risolta e ripeterla ogni due
 *   secondi è solo lavoro: si passa a sei.
 *  ⚠️ E si sfalsa con la CHIAVE del riquadro, non a caso: quattro riquadri che
 *   leggono i pixel nello stesso istante fanno uno scatto visibile, quattro
 *   che si alternano no. La stessa persona ha sempre lo stesso sfasamento —
 *   così non cambia a ogni disegno.
 */
export function quandoRiguardare(o: { buia: boolean; deciso: boolean; chiave: string }): number {
  const base = o.buia || !o.deciso ? 3000 : 6000;
  let somma = 0;
  for (let i = 0; i < (o.chiave || "").length; i++) somma = (somma + o.chiave.charCodeAt(i)) % 1000;
  return base + somma;
}
