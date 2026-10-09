/** ── DI CHI È LA STANZA DI UNA CONSULENZA ──────────────────────────────────
 *
 *  Segnalazione del committente: «quando due consulenti diversi trasmettono
 *  contemporaneamente allo stesso lead, al secondo compare il messaggio "il
 *  consulente sta trasmettendo un'altra consulenza"».
 *
 *  ⚠️ IL MESSAGGIO NON ERA IL DIFETTO: ERA IL SINTOMO. La stanza si chiamava
 *   col SOLO numero del lead (`meet:<leadId>`), quindi due consulenti che
 *   aprivano una consulenza per la stessa persona ricevevano lo STESSO codice
 *   e finivano nello stesso canale: due padroni di casa e i clienti mescolati.
 *   Il cliente di uno bussava alla porta dell'altro, che non lo aspettava, e
 *   si vedeva rifiutare l'ingresso.
 *
 *  La regola giusta è la COPPIA lead + consulente: due consulenti sulla stessa
 *  persona sono due consulenze diverse, con due stanze e due link. Lo stesso
 *  consulente che riapre la stessa persona ritrova la sua.
 *
 *  ⚠️ E LA CHIAVE STORICA RESTA LEGGIBILE. I link già mandati portano il
 *   codice della riga vecchia: quella continua a valere per il consulente a
 *   cui appartiene — o per chiunque, se non porta un nome, perché è la stanza
 *   di prima e toglierla a chi la sta usando sarebbe peggio del difetto.
 *   Si smette di SCRIVERCI SOPRA la stanza di un altro, non di leggerla.
 */

/** La stanza storica di un lead: una sola, senza consulente. */
export const chiaveStanzaStorica = (leadId: string) => `meet:${String(leadId || "").trim().slice(0, 64)}`;

/** La stanza di QUESTA coppia. Senza consulente si ricade sulla storica: è il
 *  caso del presentatore dentro Meetly, che non ha una sessione del CRM. */
export function chiaveStanza(leadId: string, consultantId: string): string {
  const cid = String(consultantId || "").trim().slice(0, 64);
  return cid ? `${chiaveStanzaStorica(leadId)}:${cid}` : chiaveStanzaStorica(leadId);
}

/** ── ⚠️ LA STANZA DI UN APPUNTAMENTO VALE PER CHIUNQUE LA CHIEDA ──────────
 *
 *  Segnalazione del committente, il giorno dopo la separazione per consulente:
 *  «le persone non riescono più a entrare in Meetly».
 *
 *  La regola di ieri diceva che la riga dell'appuntamento apparteneva a UN
 *  consulente: un collega che apriva quella consulenza non la trovava, ne
 *  faceva coniare una nuova, e passava a trasmettere sul codice nuovo — mentre
 *  il cliente aveva in mano il link con quello vecchio e restava sulla
 *  schermata d'attesa, su un canale dove non c'era nessuno.
 *
 *  ⚠️ LA REGOLA CHE NON SI PUÒ VIOLARE: il codice di un appuntamento è l'unica
 *   cosa che il cliente ha in mano, ed è già partito per WhatsApp. Qualunque
 *   ragionamento nostro — di chi è la stanza, chi la conduce — vale meno di
 *   quel link. Se una stanza esiste, si riusa.
 *
 *  Resta vero che due consulenti sulla stessa persona non devono trasmettere
 *  sullo stesso canale: per quello c'è «Nuovo cliente» nella barra, che conia
 *  un codice nuovo APPOSTA e avvisa che i link precedenti scadono — cioè una
 *  scelta di chi lavora, non una sorpresa. */
export function stanzaStoricaSua(
  sessione: { consultantId?: string } | null | undefined,
  _consultantId?: string,
): boolean {
  return !!sessione;
}
