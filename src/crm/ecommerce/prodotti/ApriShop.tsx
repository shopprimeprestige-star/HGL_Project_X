/** ── «APRI LO SHOP AL PUBBLICO» (ApriShop.tsx) · SEGNAPOSTO DI T14, LO RIEMPIE T17 ───────────────
 *  Commessa 2026-11-20-shop-completo. Oggi non disegna niente. T17 SOSTITUISCE il contenuto (Design §4.10.5, D26:
 *  l'interruttore e sotto le condizioni di uscita; acceso solo se `puoAprire`; tornare a chiuso è un clic). `CRM.ecommerce.tsx`
 *  la mette in cima alla linguetta «Prodotti»: è il componente a nascondersi quando lo shop è già aperto.
 *
 *  ── LE PROPS (da tenere così) ────────────────────────────────────────────────
 *   · `negozio`  `Pick<Negozio, "interruttori" | "esegui">`: `interruttori()` legge `{ interruttori, condizioni }`,
 *                `esegui("interruttore_imposta", { chiave, valore, atteso })` li cambia (il rifiuto `cancello` porta le
 *                condizioni riga per riga). */
import type { Negozio } from "./tipi";

export interface PropsApriShop {
  negozio: Pick<Negozio, "interruttori" | "esegui">;
}

export function ApriShop(_props: PropsApriShop): null {
  return null;
}
