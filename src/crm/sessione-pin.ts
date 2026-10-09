/** ── QUANTO VIVE UNA SESSIONE APERTA COL PIN ───────────────────────────────
 *
 *  Nasce da due cose insieme.
 *
 *  1. La segnalazione del committente: «ogni tanto dice che non riesce ad
 *     accedere al CRM col PIN, aggiorno la pagina e va». Una delle due cause
 *     era che la sessione scadeva a OROLOGIO FISSO — dodici ore dall'ingresso —
 *     e chi entrava alle otto del mattino veniva buttato fuori alle otto di
 *     sera mentre stava lavorando, senza che niente glielo avesse detto.
 *     Rimedio: la finestra scorre con il lavoro.
 *
 *  2. Il controllo di sicurezza sui commit, che ha segnalato proprio quel
 *     cambio. Aveva ragione: una finestra che scorre e basta non muore MAI —
 *     basta che qualcuno la usi una volta ogni dodici ore. Un gettone rubato
 *     diventerebbe una chiave senza scadenza, e il PIN si usa su postazioni
 *     condivise, dove un browser lasciato aperto è la cosa più normale del
 *     mondo.
 *
 *  Quindi DUE scadenze, e servono tutte e due:
 *   · INATTIVITÀ — dodici ore senza fare niente: la sessione si chiude. È
 *     quella che protegge la postazione lasciata accesa.
 *   · VECCHIAIA — sette giorni dall'ingresso, qualunque cosa succeda: si
 *     rientra col PIN. È quella che impedisce a un gettone di diventare
 *     eterno, ed è l'unica che un attaccante non può rimandare usandolo.
 *
 *  ⚠️ LE RIGHE VECCHIE NON HANNO LA DATA DI NASCITA: sono nate quando ce
 *   n'era una sola. Lì si prende quella che c'è — chi era già dentro non viene
 *   buttato fuori da un aggiornamento, e dalla prima volta che lavora la sua
 *   data di nascita comincia a esistere.
 *  ⚠️ QUI NON SI SCRIVE NIENTE: si risponde a «questa sessione è ancora
 *   buona?» e «vale la pena rinfrescarla adesso?». Scrivere a ogni richiesta
 *   vorrebbe dire una scrittura in archivio per ogni clic, e questo sito si è
 *   già fermato una volta per il tetto giornaliero del piano.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Dodici ore senza lavorare e la sessione si chiude. */
export const INATTIVITA_MS = 12 * 60 * 60 * 1000;
/** Sette giorni dall'ingresso, comunque vada. */
export const VECCHIAIA_MS = 7 * 24 * 60 * 60 * 1000;
/** Ogni quanto si sposta avanti l'ora dell'ultimo lavoro. */
export const RINFRESCO_MS = 30 * 60 * 1000;

export type StatoSessione = "viva" | "ferma-da-troppo" | "troppo-vecchia" | "illeggibile";

export interface SessioneLetta {
  /** Quando ha lavorato l'ultima volta (ISO). */
  at?: string | null;
  /** Quando è nata (ISO). Assente sulle righe di prima: vale `at`. */
  creataIl?: string | null;
}

/** Com'è messa questa sessione, adesso. */
export function statoSessione(s: SessioneLetta | null | undefined, adesso = Date.now()): StatoSessione {
  const ultimo = Date.parse(String(s?.at || ""));
  if (!Number.isFinite(ultimo)) return "illeggibile";
  //  ⚠️ La data di nascita ripiega sull'ultimo lavoro, non su «adesso»: con
  //   «adesso» una riga vecchia di un mese risulterebbe appena nata, cioè la
  //   scadenza assoluta non scatterebbe mai proprio sulle righe che la
  //   richiedono.
  const nata = Date.parse(String(s?.creataIl || s?.at || ""));
  if (Number.isFinite(nata) && adesso - nata > VECCHIAIA_MS) return "troppo-vecchia";
  if (adesso - ultimo > INATTIVITA_MS) return "ferma-da-troppo";
  return "viva";
}

/** Vale la pena spostare avanti l'ora adesso? */
export function daRinfrescare(s: SessioneLetta | null | undefined, adesso = Date.now()): boolean {
  if (statoSessione(s, adesso) !== "viva") return false;
  const ultimo = Date.parse(String(s?.at || ""));
  return Number.isFinite(ultimo) && adesso - ultimo > RINFRESCO_MS;
}
