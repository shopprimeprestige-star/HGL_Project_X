// ── IL LINK DEL PREVENTIVO APRE UNA SESSIONE ────────────────────────────────
//  Copiare il link non è copiare un indirizzo: da quel momento esiste una
//  CONSULENZA a cui quel link appartiene, e il consulente ne fa parte.
//
//  Prima non era così. La sessione nasceva soltanto avviando la videochiamata:
//  se copiavi il link del preventivo senza chiamata, il codice non c'era, il
//  link partiva senza, e il consulente non stava trasmettendo su alcun canale.
//  Il cliente apriva una pagina muta — vedeva il preventivo, non vedeva te:
//  nessuno scorrimento, nessuna voce che si aggiorna, niente.
//
//  Ora il codice si crea nell'istante del clic, il consulente comincia subito a
//  trasmettere su quel canale, e il codice viene registrato sul server INSIEME
//  al numero del preventivo. Registrarlo col numero è ciò che rende ogni link
//  indipendente: quello mandato ieri a un cliente resta valido anche dopo che
//  hai preparato il preventivo di qualcun altro.
import { getLiveId, startLive } from "@/shop/live";
import { urlPubblico } from "@/lib/sito";
import { setQuoteRef } from "@/shop/quote-ref";

/** Apre — o riusa — la sessione con cui stiamo mandando i link, e la registra
 *  sul server per questo preventivo. Restituisce il codice.
 *
 *  Va chiamata anche quando il codice sembra già esserci: la registrazione è
 *  ripetibile senza danno, e senza di essa il server non sa che quel link è
 *  stato mandato. */
export function sessionePreventivo(ref?: string | null): string {
  const code = getLiveId() || startLive();
  fetch("/api/presenter/quote-session", {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ref ? { code, ref } : { code }),
  }).catch(() => { /* la registrazione riparte al prossimo clic */ });
  // il preventivo appena collegato diventa quello corrente della consulenza:
  // è a lui che verranno legate la registrazione e i link successivi.
  if (ref) setQuoteRef(ref);
  return code;
}

/** Il link da mandare al cliente, con la sessione già aperta.
 *
 *  È volutamente SINCRONA: il link si costruisce e si copia dentro lo stesso
 *  clic, perché gli appunti del browser non aspettano una risposta di rete.
 *  La registrazione sul server viaggia per conto suo, un istante dopo. */
export function linkPreventivo(ref?: string | null): string {
  const code = sessionePreventivo(ref);
  const q = `client=1&sess=${encodeURIComponent(code)}${ref ? `&id=${encodeURIComponent(ref)}` : ""}`;
  //  Dominio pubblico: questo link lo apre il CLIENTE (vedi lib/sito).
  return urlPubblico(`preventivo?${q}`);
}
