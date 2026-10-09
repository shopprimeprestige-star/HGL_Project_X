/** ── IL NUMERO DELLA SCHEDA CHE SI VEDE NELLA CHAT ─────────────────────────
 *
 *  Sta da solo, senza dipendenze, perché lo leggono due mondi che non si
 *  devono toccare: il gestionale (che disegna e deposita l'immagine) e la
 *  pagina pubblica (che dichiara dove sta). Tenerlo dentro il modulo del
 *  disegno significherebbe trascinare il gestionale — sessione compresa —
 *  dentro il pacchetto di una pagina aperta da telefoni qualunque.
 *
 *  ── ⚠️ A COSA SERVE DAVVERO ──────────────────────────────────────────────
 *  A due cose, e la seconda è quella che ci ha fatto perdere una serata:
 *   · il gestionale sa se l'immagine depositata è vecchia e la rifà;
 *   · e l'INDIRIZZO dell'immagine cambia. Facebook e WhatsApp non tengono in
 *     cache solo la pagina: tengono in cache l'IMMAGINE, per indirizzo. Con un
 *     indirizzo identico, «scrape again» rilegge la pagina, vede lo stesso
 *     `og:image` di prima e continua a mostrare i byte vecchi — per giorni.
 *     Un numero diverso è un indirizzo diverso, e un indirizzo diverso è
 *     l'unica cosa che li obbliga a riscaricare.
 *
 *  ⚠️ Si alza di uno ogni volta che il disegno cambia davvero.
 */
export const VERSIONE_SCHEDA = 6;
