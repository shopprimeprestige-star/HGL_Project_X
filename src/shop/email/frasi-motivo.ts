/** ── EMAIL DELLO SHOP · LE FRASI DEL «NON SI PUÒ MANDARE» (R2 · T66) ───────────────────────────────────
 *  Modulo PURO, va bene anche nel browser. UNA costante sola: la usano il server del CRM (`email.server.ts`, nei rifiuti) e la scheda
 *  «Email» (`ModelliEmail.tsx`, a schermo), così il titolare legge sempre le stesse parole. Nessun testo per i clienti. */
import type { MotivoNonInviabile } from "./tipi";

/** Perché un messaggio non si può mandare, nella lingua del titolare. `spento` non dipende dal testo: «Accendi» è proprio quello che si chiede. */
export const FRASI_MOTIVO: Record<MotivoNonInviabile, string> = {
  spento: "Il messaggio è spento.",
  vuoto: "L'oggetto e il testo non possono essere vuoti.",
  segnaposto:
    "Il testo ha ancora un segnaposto «{{…}}» (per esempio «{{da confermare}}»): scrivi il testo vero prima di approvarlo e accenderlo.",
  non_approvato:
    "Il testo non è approvato, o è stato cambiato dopo l'approvazione: approvalo prima di accendere il messaggio.",
  variabile_sconosciuta:
    "Nel testo c'è una parola tra graffe che non è una variabile di questo messaggio, oppure una graffa rimasta sola: usa solo le variabili dell'elenco, ognuna con una graffa per parte, per esempio {nome}.",
};
