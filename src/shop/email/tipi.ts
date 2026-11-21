/** ── EMAIL DELLO SHOP · TIPI E COSTANTI (R2 · T49 · D53) ───────────────────────────────────────────────
 *  Modulo PURO: niente database, niente servizio di posta. Le cinque chiavi sono quelle di S6 (`shop_email_modelli`).
 *  Variabili a GRAFFA SINGOLA (`{nome}`, `{ref}`…): `{{` nel database e qui significa sempre «segnaposto da confermare»
 *  e blocca l'invio (revisione di T43). Nessun testo vero è scritto qui: i testi li scrive e li approva il titolare. */

/** Le cinque email: E1 conferma, E2 spedito, E3 pagamento non riuscito, E4 rimborso e l'annullo (SPEC §12.4.3). Stesso ordine di S6. */
export const CHIAVI_EMAIL = ["conferma_ordine", "spedito", "pagamento_non_riuscito", "rimborso", "annullato"] as const;
export type ChiaveEmail = (typeof CHIAVI_EMAIL)[number];

/** Le variabili che un testo può usare, e nessun'altra. Telefono, codice fiscale ed email del cliente non hanno una variabile. */
export const VARIABILI_NOTE = [
  "nome", "ref", "totale", "link_ordine", "corriere", "numero_tracking", "link_tracking", "importo_rimborso", "riepilogo_righe", "indirizzo_spedizione",
] as const;
export type NomeVariabile = (typeof VARIABILI_NOTE)[number];

/** Quali variabili ammette ogni messaggio. I prezzi stanno solo dove servono (conferma: totale e righe; rimborso: l'importo);
 *  l'indirizzo di spedizione del CLIENTE sta solo nella conferma; il tracking solo in «spedito»; il pagamento non riuscito non ha cifre. */
export const VARIABILI_PER_CHIAVE: Record<ChiaveEmail, readonly NomeVariabile[]> = {
  conferma_ordine: ["nome", "ref", "totale", "link_ordine", "riepilogo_righe", "indirizzo_spedizione"],
  spedito: ["nome", "ref", "link_ordine", "corriere", "numero_tracking", "link_tracking"],
  pagamento_non_riuscito: ["nome", "ref", "link_ordine"],
  rimborso: ["nome", "ref", "link_ordine", "importo_rimborso"],
  annullato: ["nome", "ref", "link_ordine"],
};

/** I valori per `componi`: tutto testo, tutto facoltativo (un valore assente diventa vuoto). */
export type Variabili = Partial<Record<NomeVariabile, string | null | undefined>>;

/** Una riga di `shop_email_modelli`. I campi di approvazione sono quelli del database. */
export type ModelloEmail = {
  chiave: ChiaveEmail;
  oggetto: string;
  testo: string;
  acceso: boolean;
  approvato_da?: string | null;
  approvato_il?: string | null;
  approvato_hash?: string | null;
};

/** Perché un messaggio non si può mandare (T49). */
export type MotivoNonInviabile = "spento" | "non_approvato" | "segnaposto" | "vuoto" | "variabile_sconosciuta";
export type EsitoInviabile = { ok: true } | { ok: false; motivo: MotivoNonInviabile };

/** Il messaggio pronto: testo semplice e html minimo. */
export type EmailComposta = { oggetto: string; testo: string; html: string };

/** Come finisce un tentativo di invio (lo scrive T54 in `email_inviate`: `inviata` ed `errore` sono gli unici due stati del database). */
export type StatoInvio =
  | "inviata" | "errore" | "in_corso" | "spenta" | "non_approvata" | "segnaposto" | "vuota" | "variabile_sconosciuta"
  | "non_configurata" | "senza_email" | "migrazione" | "saltata";
/** `saltata` = non si manda per scelta, non è un guasto; il perché sta in `codice` (oggi solo `ordine_annullato`: la conferma su un ordine annullato). */
export type EsitoInvio = { stato: StatoInvio; codice?: string };

/** Le porte per chi manda l'email (il webhook di pagamento e il CRM): una sola, con `manuale` per «invia ora». Mai un'eccezione verso chi chiama. */
export type PorteEmail = {
  invia: (chiave: ChiaveEmail, ordineId: string, opzioni: { manuale: boolean }) => Promise<EsitoInvio>;
};

/** Il perché dell'esito, nella lingua degli stati. */
export const STATO_DEL_MOTIVO: Record<MotivoNonInviabile, StatoInvio> = {
  spento: "spenta",
  non_approvato: "non_approvata",
  segnaposto: "segnaposto",
  vuoto: "vuota",
  variabile_sconosciuta: "variabile_sconosciuta",
};

/** Il nome del mittente è fisso. L'indirizzo viene da `SHOP_EMAIL_INDIRIZZO`, sul dominio del titolare; `RESEND_FROM` non si usa. */
export const NOME_MITTENTE = "Hair Genius Labs";

/** «Hair Genius Labs <indirizzo>», oppure `null` se l'indirizzo manca o non è un solo indirizzo semplice
 *  (niente a capo, virgole, `<`, `>`: non si inietta nell'intestazione). */
export function intestazioneMittente(indirizzo: unknown): string | null {
  if (typeof indirizzo !== "string") return null;
  const a = indirizzo.trim();
  if (!/^[^\s@<>,;"()]+@[^\s@<>,;"()]+\.[^\s@<>,;"()]+$/.test(a)) return null;
  return `${NOME_MITTENTE} <${a}>`;
}
