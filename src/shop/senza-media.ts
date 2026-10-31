/** ── «DENTRO MA SPENTI»: CHI NON HA CAMERA NÉ MICROFONO SI COLLEGA LO STESSO ──
 *
 *  Segnalazione del committente: in Meetly consulente e cliente si vedono
 *  «dentro» la stanza, ma ognuno vede l'altro con camera e microfono spenti.
 *  Succedeva ad alcuni clienti, da tempo.
 *
 *  ── DOVE SI ROMPEVA ──────────────────────────────────────────────────────
 *  Due righe di `shop/call` rifiutavano di negoziare la connessione finché
 *  `localStream` era nullo, cioè finché questa scheda non aveva ottenuto la
 *  PROPRIA camera/microfono:
 *    · il gestore dell'offerta in arrivo la scartava in silenzio;
 *    · `maybeInitiate` (chi ha il pid minore offre) usciva subito.
 *  Se i media arrivano, il giro di saluti (ogni 3 s) ripara. Se NON arrivano —
 *  permesso negato, nessun dispositivo, browser interno di WhatsApp/Instagram
 *  senza `getUserMedia`, iPhone dove la richiesta resta appesa — nessuno dei
 *  due lati può mai offrire o rispondere: la presenza (sul canale) dice «sono
 *  qui», il media (peer-to-peer) non nasce mai, e ognuno vede l'altro
 *  «camera spenta». Peggio: chi non ha media non vedeva nemmeno quelli
 *  dell'altro, anche se riceve non costa niente.
 *
 *  ── LA REGOLA ────────────────────────────────────────────────────────────
 *  Si negozia se i media locali ci sono OPPURE se è certo che non ci saranno
 *  (richiesta fallita, o ancora appesa dopo `SENZA_MEDIA_DOPO_MS`). Prima di
 *  allora il comportamento è quello di sempre: chi sta ancora aspettando il
 *  permesso non crea connessioni vuote. In sola ricezione la connessione nasce
 *  con due transceiver «recvonly»; se i media arrivano dopo, le tracce vi si
 *  agganciano e si rinegozia sulla stessa connessione. */

/** Quanto si aspetta la camera/microfono prima di collegarsi in sola ricezione. */
export const SENZA_MEDIA_DOPO_MS = 15_000;

export function puoNegoziare(p: { haMedia: boolean; mediaFallita: boolean }): boolean {
  return p.haMedia || p.mediaFallita;
}
