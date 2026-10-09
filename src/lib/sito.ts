/** L'INDIRIZZO PUBBLICO DEL SITO ──────────────────────────────────────────────
 *  I link che finiscono nei messaggi ai clienti — la stanza della consulenza,
 *  il preventivo — venivano costruiti con l'indirizzo da cui era aperta la
 *  pagina. In pratica: quello tecnico del servizio su cui gira l'applicazione.
 *  Funziona, ma un cliente che riceve su WhatsApp un indirizzo che non assomiglia
 *  al nome dell'azienda esita prima di aprirlo — e in una vendita l'esitazione
 *  costa più di qualsiasi difetto tecnico.
 *
 *  Qui c'è il dominio buono, in un punto solo: chi scrive un link lo prende da
 *  qui e non dall'indirizzo corrente.
 *
 *  ⚠️ Perché resti vero, questo dominio deve puntare all'applicazione. Se un
 *  giorno cambiasse, si cambia questa riga e cambiano tutti i link insieme.
 */
export const SITO = "https://hair-genius-hub.hair";

/** Unisce il dominio pubblico a un percorso, senza doppie barre né barre
 *  mancanti — l'errore più banale e più frequente quando si compongono link. */
export function urlPubblico(percorso: string): string {
  const p = String(percorso || "");
  return `${SITO}/${p.replace(/^\/+/, "")}`;
}

/** Il link della stanza di una consulenza, come lo riceve il cliente. */
export const urlStanza = (codice: string) => urlPubblico(`meetly/${encodeURIComponent(codice)}`);
