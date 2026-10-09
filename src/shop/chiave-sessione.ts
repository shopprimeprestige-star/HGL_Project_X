/** ── OGNI CONSULENZA HA LA SUA RIGA ────────────────────────────────────────
 *
 *  Segnalazione del committente: «ogni consulente deve avere la sua sessione di
 *  Meetly; se allo stesso orario due o più consulenti trasmettono, non devono
 *  fare conflitto».
 *
 *  ⚠️ E FACEVANO CONFLITTO DAVVERO, non «a volte». Tre stati che governano una
 *   consulenza — la sessione avviata, la pagina che il cliente segue, il
 *   preventivo rispecchiato — vivevano in UNA riga sola, la stessa per tutti:
 *   `session_live`, `presenter_page`, `quote_state`. Due consulenti in diretta
 *   nello stesso momento scrivevano nella stessa casella, e l'ultimo che
 *   toccava qualcosa comandava su entrambe le consulenze:
 *    · il cliente di uno seguiva la pagina aperta dall'altro;
 *    · il preventivo rispecchiato era quello dell'altro — con dentro la scheda
 *      di un cliente che non era il suo;
 *    · e ogni nuova diretta «spegneva» quella in corso, perché il codice della
 *      sessione veniva sovrascritto: il primo cliente si ritrovava sulla
 *      schermata d'attesa a consulenza avviata.
 *
 *  La riga adesso porta il CODICE della consulenza. Non l'id del consulente:
 *  il codice ce l'hanno in mano tutti e due i lati — il consulente lo genera,
 *  il cliente ce l'ha nell'indirizzo della sua stanza — mentre l'id del
 *  consulente il cliente non lo sa e non deve saperlo. Ed è anche il confine
 *  giusto: due consulenze DELLO STESSO consulente (una ripresa, una seconda
 *  scheda) restano separate.
 *
 *  ⚠️ LA RIGA VECCHIA RESTA LEGGIBILE. Chi è in consulenza nel momento in cui
 *   si pubblica non ha un codice scritto da nessuna parte: se la riga col
 *   codice non c'è, si legge quella di prima. Si smette di scriverla, non di
 *   leggerla — una consulenza a metà non deve accorgersi di niente.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Il codice ridotto a ciò che può stare in una chiave: lettere, cifre e
 *  trattini. ⚠️ Non è pignoleria: il codice arriva dall'indirizzo, cioè da
 *  fuori, e finisce in una chiave di database. */
export function codiceChiave(codice: unknown): string {
  return String(codice ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40);
}

/** La chiave di uno stato per UNA consulenza. Senza codice torna quella
 *  storica, che è la riga condivisa di prima: è il ripiego di chi è già in
 *  consulenza adesso, non il modo normale di lavorare. */
export function chiaveSessione(base: string, codice: unknown): string {
  const c = codiceChiave(codice);
  return c ? `${base}:${c}` : base;
}
