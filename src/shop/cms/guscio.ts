/** ── IL GUSCIO DELLO SHOP CON IL CATALOGO CMS ───────────────────────────────
 *  Commessa 2026-11-20-shop-completo (T18). Modulo PURO: la parte del guscio (`src/routes/shop.tsx`) che si può provare
 *  senza browser. */
import { daPubblicoAProdotto } from "./adattatore";
import type { ProdottoPubblico } from "./modello";

/** Il nome della PROTESI che la barra della consulenza mostra nella scheda. Con il catalogo del codice vale solo la
 *  categoria «toupee» (`getProduct`): qui la stessa regola, letta dall'adattatore. Mai un'eccezione: senza prodotto, niente nome. */
export function nomeProtesiPerBarra(p: ProdottoPubblico | null | undefined): string | undefined {
  try {
    if (!p) return undefined;
    const prodotto = daPubblicoAProdotto(p);
    return prodotto.category === "toupee" ? prodotto.name : undefined;
  } catch {
    return undefined;
  }
}
