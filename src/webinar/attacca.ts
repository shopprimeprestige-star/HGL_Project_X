/** ── ATTACCARE UN FLUSSO A UN ELEMENTO ──────────────────────────────────────
 *
 *  ⚠️ È LA STESSA LEZIONE, IMPARATA TRE VOLTE, E OGNI VOLTA LO STESSO SINTOMO:
 *   schermo nero, senza un errore, senza un motivo visibile.
 *
 *  La tentazione è scrivere `elemento.srcObject = flusso` dentro un effetto
 *  legato al flusso, o nel punto in cui il flusso arriva. Sembra giusto e non
 *  lo è, perché lega l'aggancio a un MOMENTO invece che a un ELEMENTO:
 *   · se in quell'istante l'elemento non è ancora nato, non si aggancia niente;
 *   · se l'elemento nasce DOPO — e succede a ogni cambio di disposizione, di
 *     scheda, di stato — il flusso è lo stesso di prima, quindi per l'effetto
 *     non c'è niente da rifare, e il video nuovo resta vuoto.
 *
 *  Un `ref` a funzione invece viene chiamato su OGNI elemento che nasce: è
 *  impossibile che ne resti uno scollegato.
 *
 *  ⚠️ E `muted` si mette a mano, prima di `play()`: React lo tratta come
 *   proprietà e su un elemento appena creato può arrivare dopo — a quel punto
 *   il browser blocca la riproduzione, perché un video con audio non parte da
 *   solo. Risultato: di nuovo un rettangolo nero.
 *
 *  ── ⚠️ E LA QUARTA VOLTA È STATA SOLO SUL TELEFONO ────────────────────────
 *   Qui c'era scritto `.catch(() => { riproverà al primo fotogramma })`, e non
 *   era vero: NIENTE riprovava. Era una promessa scritta in un commento, e per
 *   il resto un rifiuto ingoiato in silenzio.
 *
 *   Sul computer non si vedeva, perché lì un video con l'audio parte quasi
 *   sempre: basta aver cliccato una volta sulla pagina. Su iOS e su Android no,
 *   e non basta nemmeno il tocco su «Entra e ascolta»: fra quel tocco e
 *   l'arrivo del flusso ci sono i secondi della trattativa con l'SFU, e per il
 *   browser il permesso del gesto a quel punto è già scaduto. Quindi `play()`
 *   veniva rifiutato, il `catch` non faceva niente, e restava un rettangolo
 *   nero — su cui non c'era nemmeno scritto perché.
 *
 *   Il ripiego è quello che fanno tutti i lettori video: se col suono non si
 *   può, si riprova MUTI, perché un video muto parte sempre. Così si vede
 *   almeno l'immagine invece del nero.
 *  ⚠️ E LO SI DEVE DIRE. Un video che parte muto senza avvisare è peggio del
 *   nero: si guarda una diretta convinti che il relatore non stia parlando.
 *   Per questo il ripiego avvisa chi lo ha chiesto (`seRestaMuto`), e chi
 *   mostra il video ci mette sopra un tasto per riaccendere l'audio — quello
 *   sì dentro un gesto vero, quindi non può essere rifiutato.
 */

/** Restituisce un `ref` da mettere su un `<video>` o un `<audio>`.
 *
 *  `muto` va acceso per la PROPRIA camera: il proprio audio che torna dagli
 *  altoparlanti è il fischio che fa interrompere la diretta.
 *
 *  `seRestaMuto` viene chiamato SOLO quando il suono era voluto e il browser
 *  l'ha rifiutato, e la riproduzione è ripartita muta: è il segnale per
 *  mostrare il tasto «tocca per sentire». Chi non lo passa si accontenta
 *  dell'immagine — che è comunque meglio del nero. */
export function attaccaFlusso(
  flusso: MediaStream | null,
  muto = false,
  seRestaMuto?: (el: HTMLMediaElement) => void,
) {
  return (el: HTMLMediaElement | null) => {
    if (!el) return;
    if (muto) el.muted = true;
    if (el.srcObject !== flusso) el.srcObject = flusso;
    if (!flusso) return;
    void el.play().catch(() => {
      //  Era già muto e l'hanno rifiutato lo stesso: non è la regola del suono,
      //  e insistere non porta da nessuna parte.
      if (el.muted) return;
      el.muted = true;
      void el
        .play()
        .then(() => seRestaMuto?.(el))
        .catch(() => {
          /*  Nemmeno muto: qui non c'è più niente da tentare da soli. Il
              video ha i suoi comandi, e resta quella la strada. */
        });
    });
  };
}

/** Riaccende l'audio su richiesta di chi guarda.
 *  ⚠️ VA CHIAMATA DENTRO UN GESTO — il gestore di un click o di un tocco — e
 *   non da un effetto: è precisamente il permesso che mancava prima, e da un
 *   effetto verrebbe rifiutata di nuovo.
 *  Torna `true` se il suono è davvero tornato: il tasto deve sparire solo
 *  allora, altrimenti si toglie il rimedio lasciando il problema. */
export async function riaccendiAudio(el: HTMLMediaElement | null): Promise<boolean> {
  if (!el) return false;
  el.muted = false;
  try {
    await el.play();
    return !el.muted;
  } catch {
    el.muted = true;
    return false;
  }
}
