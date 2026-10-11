/** ── CAMBIARE IL NUMERO A UN PREVENTIVO ────────────────────────────────────
 *
 *  Richiesta del committente: «fai che posso cambiare l'ID del preventivo».
 *
 *  ── PERCHÉ NON È UN CAMPO DA RISCRIVERE E BASTA ──────────────────────────
 *  Quel numero non è un'etichetta: è la chiave con cui il preventivo si
 *  ritrova dappertutto. Ci sono attaccati il link che il cliente ha in chat, la
 *  causale del suo bonifico, la scheda del lead (`data.quoteRef`), la
 *  fotografia delle condizioni, l'anteprima del link, gli elenchi dei
 *  sospesi e dei «solo avviso», e le fatture già emesse. Riscriverlo e basta
 *  vuol dire lasciare indietro qualcuno di questi — e il guasto non si vede
 *  subito: si vede il giorno in cui il cliente apre il suo link e non trova
 *  più niente.
 *
 *  Qui c'è solo la parte che si può decidere senza database: com'è fatto un
 *  numero accettabile. Lo spostamento di tutto il resto lo fa il server
 *  (api.presenter.quotes, azione «rinumera»), che è l'unico che può farlo in
 *  un colpo solo.
 *
 *  ⚠️ SI DETTA AL TELEFONO. Per questo niente lettere ambigue in un numero
 *   generato da noi (O/0, I/1: vedi `nuovoRef` in api.public.quote-create) —
 *   ma uno scritto A MANO le può contenere, perché a sceglierlo è una persona
 *   che sa quello che fa e magari sta ricopiando un numero che il cliente ha
 *   già annotato. Qui si vieta solo ciò che romperebbe qualcosa.
 *  ⚠️ NIENTE SPAZI, NIENTE ACCENTI, NIENTE «/»: quel numero finisce
 *   nell'indirizzo del link e dentro le chiavi di configurazione
 *   (`preventivo_condizioni:<numero>`), dove sono ammesse lettere, cifre e
 *   trattini e basta (vedi `codiceChiave` in shop/chiave-sessione).
 *  ───────────────────────────────────────────────────────────────────────── */

export const NUMERO_MIN = 3;
export const NUMERO_MAX = 24;

/** Il numero ripulito: maiuscolo, senza spazi, solo lettere, cifre e trattini.
 *  Serve PRIMA di ogni confronto — «idp 1234» e «IDP1234» sono lo stesso
 *  numero scritto da due persone diverse. */
export function normalizzaNumero(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9-]/g, "");
}

/** Perché questo numero non va bene, in una frase da mostrare. Stringa vuota
 *  = va bene. */
export function perchéNonVa(v: unknown): string {
  const n = normalizzaNumero(v);
  if (!n) return "Scrivi il numero nuovo.";
  if (n.length < NUMERO_MIN) return `Troppo corto: almeno ${NUMERO_MIN} caratteri.`;
  if (n.length > NUMERO_MAX) return `Troppo lungo: al massimo ${NUMERO_MAX} caratteri.`;
  //  Un numero fatto di soli trattini passerebbe i controlli qui sopra ed è
  //  un indirizzo che non si può dettare né riconoscere.
  if (!/[A-Z0-9]/.test(n)) return "Deve contenere almeno una lettera o una cifra.";
  return "";
}

export const numeroValido = (v: unknown): boolean => !perchéNonVa(v);

/** È lo stesso numero, scritto magari in un altro modo? */
export const stessoNumero = (a: unknown, b: unknown): boolean =>
  !!normalizzaNumero(a) && normalizzaNumero(a) === normalizzaNumero(b);
