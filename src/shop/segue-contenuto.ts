/** ── I LINK «SOLO UNA COSA» SEGUONO QUELLO CHE MOSTRI ──────────────────────
 *
 *  Richiesta del committente: «mentre condivido il preventivo, se seleziono
 *  media deve mostrare i media; e se sto condividendo solo il link dei media e
 *  clicco su preventivo, deve mostrare il preventivo. Quindi può trasmettere
 *  entrambi».
 *
 *  COM'ERA. I due link erano due stanze separate: quello del preventivo
 *  mostrava il preventivo e basta, quello dei media i media e basta. Se durante
 *  la consulenza si passava da una cosa all'altra — ed è la cosa più normale
 *  del mondo: gli faccio vedere due foto, poi torniamo al prezzo — il cliente
 *  restava sulla schermata di prima e non se ne accorgeva nessuno: lui vedeva
 *  un preventivo fermo mentre il consulente parlava di una foto.
 *
 *  ── COME FUNZIONA ────────────────────────────────────────────────────────
 *  La postazione registra già la schermata che sta guardando
 *  (`/api/presenter/curpage`, la scrive la barra ogni secondo e mezzo). Qui si
 *  legge quella riga e si traduce in «quale delle due pagine deve avere davanti
 *  il cliente con un link solo».
 *
 *  ⚠️ NON SI RIUSA `useLiveNav`, ED È VOLUTO. Quella porta l'ospite ovunque
 *   vada il consulente — slide, sito, anteprima capelli — e lo fa con il link
 *   della stanza (`?watch=`). Questi due link sono un'altra promessa: «vedi
 *   quello che ti mostro, senza entrare da nessuna parte». Mandare qui una
 *   pagina che non conosce la forma `client=1&sess=` vorrebbe dire un cliente
 *   davanti a una schermata che non è fatta per lui — o, peggio, la richiesta
 *   di entrare in videochiamata che questo link esiste per evitare.
 *   Per questo la traduzione è un elenco CHIUSO di due voci: tutto il resto
 *   vale «resta dove sei», che è la risposta prudente.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Le due pagine che un link «solo una cosa» sa mostrare. */
export const PAGINA_PREVENTIVO = "/preventivo";
export const PAGINA_MEDIA = "/media-diretta";

/** Il percorso nudo, senza parametri: la postazione registra anche indirizzi
 *  interi («/prova-capelli?meet=…»), e confrontarli tali e quali non
 *  combacerebbe mai. */
const soloPercorso = (indirizzo: string): string =>
  String(indirizzo || "")
    .trim()
    .split(/[?#]/)[0];

/** ── DOVE DEVE STARE IL CLIENTE, ADESSO ───────────────────────────────────
 *  Traduce la schermata del consulente nella pagina del cliente «con il link».
 *  `null` = non lo so, o è una schermata che questo link non sa mostrare:
 *  in tutti e due i casi il cliente resta dov'è.
 *
 *  ⚠️ `/presenta` è la POSTAZIONE dei media, non la pagina del cliente: quella
 *   è `/media-diretta`, che mostra lo stesso media senza i comandi. Mandare il
 *   cliente su `/presenta` vorrebbe dire dargli in mano la libreria. */
export function paginaPerIlLink(pathDelConsulente: string): string | null {
  const p = soloPercorso(pathDelConsulente);
  if (!p) return null;
  if (p === "/preventivo") return PAGINA_PREVENTIVO;
  if (p === "/presenta" || p === PAGINA_MEDIA) return PAGINA_MEDIA;
  return null;
}

/** Serve cambiare pagina? Confronta con quella che il cliente ha davanti.
 *  ⚠️ Si confronta il PERCORSO, non l'indirizzo intero: il link del cliente
 *   porta sempre `client=1&sess=…` dietro, e quei parametri non c'entrano con
 *   «quale schermata sto guardando». */
export function deveAndareSu(
  pathDelConsulente: string,
  percorsoAttuale: string,
): string | null {
  const dove = paginaPerIlLink(pathDelConsulente);
  if (!dove) return null;
  return dove === soloPercorso(percorsoAttuale) ? null : dove;
}

/** L'indirizzo completo da aprire, con l'identità del link conservata.
 *  ⚠️ `client=1` e `sess` NON si perdono per strada: senza il primo la pagina
 *   si comporta da postazione, senza il secondo non segue più nessuno — e in
 *   tutti e due i casi il cliente si ritroverebbe davanti una schermata muta. */
export function indirizzoDelLink(percorso: string, sess: string): string {
  return `${percorso}?client=1&sess=${encodeURIComponent(sess)}`;
}
