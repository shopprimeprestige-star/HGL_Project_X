/** ── LA SCHEDA DI UN PRODOTTO (SchedaProdotto.tsx) · SEGNAPOSTO DI T14, LO RIEMPIE T15 ──────────
 *  Commessa 2026-11-20-shop-completo. Oggi non disegna niente: esiste perché `CRM.ecommerce.tsx` la importa già con la
 *  firma finale. T15 SOSTITUISCE il contenuto di questo file (Design §4.10.2) senza toccare `CRM.ecommerce.tsx`.
 *
 *  ── LE PROPS (da tenere così) ────────────────────────────────────────────────
 *   · `id`      il prodotto aperto: viene dall'indirizzo `?scheda=prodotti&id=<id>` (già controllato dal guscio).
 *   · `negozio` l'archivio unico che il guscio crea con `useNegozio()`: `negozio.scheda(id)` legge la scheda,
 *               `negozio.esegui(azione, dati)` scrive (l'esito va letto: `conflitto`, `non_pubblicabile`…),
 *               `negozio.categorie()` per la sezione Categorie, `negozio.aggiorna()` rilegge l'elenco.
 *   · `apri`    cambia l'indirizzo: `apri(null)` torna all'elenco, `apri(altroId)` apre un altro prodotto (dopo «Duplica»).
 *  La scheda passa a `EditorVarianti` ed `EditorMedia` ciò che serve loro (vedi i commenti in cima a quei file). */
import type { Negozio } from "./tipi";

export interface PropsSchedaProdotto {
  id: string;
  negozio: Negozio;
  apri: (id: string | null) => void;
}

export function SchedaProdotto(_props: PropsSchedaProdotto): null {
  return null;
}
