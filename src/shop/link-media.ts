/** ── IL LINK «SOLO I MEDIA», DA MANDARE AL CLIENTE ─────────────────────────
 *
 *  Richiesta del committente: «aggiungi un link solo per i media che posso
 *  condividere, come se stesse dentro».
 *
 *  È il gemello di `linkPreventivo` (shop/quote-link) e fa la stessa cosa per
 *  l'altra metà della consulenza: apre — o riusa — la sessione con cui il
 *  consulente sta trasmettendo, e costruisce l'indirizzo che il cliente apre
 *  per vedere, in diretta, i media che gli si stanno mostrando.
 *
 *  ⚠️ LA SESSIONE SI APRE AL CLIC, NON PRIMA. Se il codice non c'è, il link
 *   partirebbe senza: il cliente aprirebbe una pagina che non segue nessuno e
 *   resterebbe davanti alla schermata d'attesa. È lo stesso errore che il link
 *   del preventivo ha già fatto una volta, ed è scritto lì per esteso.
 *  ⚠️ `client=1` non lo legge la pagina dei media — a lei basta `sess` — ma lo
 *   legge il ROUTER: un indirizzo con quel parametro è il dispositivo di un
 *   cliente, e davanti a un errore gli si mostra la schermata brandizzata
 *   invece di quella tecnica (vedi `isGuestDevice` in src/router).
 *  ───────────────────────────────────────────────────────────────────────── */
import { getLiveId, startLive } from "@/shop/live";
import { urlPubblico } from "@/lib/sito";

/** Il codice della consulenza con cui si sta trasmettendo, creandolo se serve. */
export function sessioneMedia(): string {
  return getLiveId() || startLive();
}

/** L'indirizzo da copiare. Volutamente SINCRONO: il link si costruisce e si
 *  copia dentro lo stesso clic, perché gli appunti del browser non aspettano
 *  una risposta di rete. */
export function linkMedia(): string {
  const code = sessioneMedia();
  //  Dominio pubblico: questo link lo apre il CLIENTE (vedi lib/sito).
  return urlPubblico(`media-diretta?client=1&sess=${encodeURIComponent(code)}`);
}
