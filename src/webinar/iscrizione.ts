/** ── L'ISCRIZIONE A UNA DIRETTA ────────────────────────────────────────────
 *
 *  ⚠️ IL NUMERO SI NORMALIZZA PRIMA DI SALVARLO, non quando si legge. Lo
 *   stesso telefono si scrive in almeno cinque modi — «339 123 4567»,
 *   «+39 3391234567», «0039339…», «339-123-4567» — e salvandoli così com'è
 *   diventano cinque persone: cinque righe, cinque promemoria allo stesso
 *   telefono, e un conto degli iscritti gonfiato che nessuno saprebbe
 *   spiegare. Normalizzando prima, la chiave della tabella fa il lavoro da
 *   sola.
 */

/** Il numero in forma internazionale, pronto per WhatsApp. Stringa vuota se
 *  non è un numero plausibile — e in quel caso NON si salva niente: meglio
 *  dire «controlla il numero» che raccogliere un contatto che non risponderà
 *  mai. */
export function numeroPerWhatsApp(grezzo: string): string {
  const testo = String(grezzo || "").trim();
  //  ⚠️ Il «+» iniziale conta e si perde subito: dice che il prefisso c'è già.
  const conPiu = testo.startsWith("+");
  let cifre = testo.replace(/[^\d]/g, "");

  //  «00» davanti è il vecchio modo di scrivere il «+».
  if (!conPiu && cifre.startsWith("00")) cifre = cifre.slice(2);

  //  ⚠️ Un cellulare italiano scritto senza prefisso comincia per 3 ed è lungo
  //   nove o dieci cifre. È il caso più comune di tutti — la gente il proprio
  //   numero lo scrive così — e rifiutarlo vorrebbe dire perdere la metà delle
  //   iscrizioni per una formalità.
  if (!conPiu && /^3\d{8,9}$/.test(cifre)) cifre = `39${cifre}`;

  //  Sotto le otto cifre non è un telefono; sopra le quindici non esiste
  //  (E.164 si ferma lì).
  if (cifre.length < 8 || cifre.length > 15) return "";
  return cifre;
}

/** Come si mostra a chi l'ha scritto: raggruppato, non una fila di cifre. */
export function numeroLeggibile(e164: string): string {
  const c = String(e164 || "");
  if (c.startsWith("39") && c.length === 12) return `+39 ${c.slice(2, 5)} ${c.slice(5, 8)} ${c.slice(8)}`;
  return c ? `+${c}` : "";
}

/** ── COSA SI SCRIVE NEL PROMEMORIA ─────────────────────────────────────────
 *  ⚠️ DUE MESSAGGI DIVERSI, e la differenza non è di stile: «manca un'ora» è
 *   un invito a organizzarsi, «siamo in diretta» è un invito a toccare adesso.
 *   Uno solo per tutti e due i momenti sbaglierebbe quello che chiede.
 *  ⚠️ Il link c'è SEMPRE e per intero: un promemoria che dice «ci vediamo
 *   dopo» e costringe a cercare il link nella cronologia è un promemoria che
 *   non fa venire nessuno.
 *  ⚠️ Nessuna promessa che non possiamo mantenere: niente «posti limitati» e
 *   niente «ultima occasione». Chi ci casca una volta non apre più il secondo.
 */
export function testoPromemoria(o: {
  tipo: "manca-poco" | "in-diretta";
  titolo: string;
  link: string;
  nome?: string;
}): string {
  const chi = (o.nome || "").trim().split(/\s+/)[0];
  const saluto = chi ? `Ciao ${chi}, ` : "";
  const titolo = (o.titolo || "").trim() || "la diretta";
  return o.tipo === "in-diretta"
    ? `${saluto}siamo in diretta adesso con ${titolo}. Entra da qui: ${o.link}`
    : `${saluto}fra poco cominciamo con ${titolo}. Ecco il link per entrare: ${o.link}`;
}
