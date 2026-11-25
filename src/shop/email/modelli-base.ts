/** ── EMAIL DELLO SHOP · I CINQUE MODELLI DI PARTENZA (R2 · T49 · D53) ───────────────────────────────────
 *  Segnaposto, NON testi veri: tutti con `{{da confermare}}`, quindi mai inviabili (`messaggioInviabile` dà `segnaposto`).
 *  I testi veri li scrive e li approva il titolare dal CRM. Nessun indirizzo dello studio, nessuna cifra, nessuna consulenza.
 *  Sono IDENTICI al seme di S6 (`supabase/migrations/20261122140000_shop_email.sql`): una prova li confronta. */
import type { ModelloEmail } from "./tipi";

export const MODELLI_BASE: readonly ModelloEmail[] = [
  { chiave: "conferma_ordine", oggetto: "{{da confermare}} Conferma del tuo ordine", testo: "{{da confermare}}\n\nQui va il testo della conferma d'ordine: lo scrive e lo approva il titolare dal CRM.\n\nHair Genius Labs", acceso: false, approvato_da: null, approvato_il: null, approvato_hash: null },
  { chiave: "spedito", oggetto: "{{da confermare}} Il tuo ordine è in viaggio", testo: "{{da confermare}}\n\nQui va il testo dell'avviso di spedizione: lo scrive e lo approva il titolare dal CRM.\n\nHair Genius Labs", acceso: false, approvato_da: null, approvato_il: null, approvato_hash: null },
  { chiave: "pagamento_non_riuscito", oggetto: "{{da confermare}} Il pagamento non è andato a buon fine", testo: "{{da confermare}}\n\nQui va il testo per il pagamento non riuscito: lo scrive e lo approva il titolare dal CRM.\n\nHair Genius Labs", acceso: false, approvato_da: null, approvato_il: null, approvato_hash: null },
  { chiave: "rimborso", oggetto: "{{da confermare}} Abbiamo rimborsato il tuo ordine", testo: "{{da confermare}}\n\nQui va il testo del rimborso: lo scrive e lo approva il titolare dal CRM.\n\nHair Genius Labs", acceso: false, approvato_da: null, approvato_il: null, approvato_hash: null },
  { chiave: "annullato", oggetto: "{{da confermare}} Il tuo ordine è stato annullato", testo: "{{da confermare}}\n\nQui va il testo dell'annullo: lo scrive e lo approva il titolare dal CRM.\n\nHair Genius Labs", acceso: false, approvato_da: null, approvato_il: null, approvato_hash: null },
];
