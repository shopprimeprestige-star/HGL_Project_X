/** ── LE CATEGORIE (Categorie.tsx) · SEGNAPOSTO DI T14, LO RIEMPIE T17 ─────────────────────────────
 *  Commessa 2026-11-20-shop-completo. Oggi non disegna niente. T17 SOSTITUISCE il contenuto (Design §4.10.5: elenco
 *  ordinabile, indirizzo bloccato dopo la pubblicazione, foto, visibile sì/no, «Nascosta dal sito»). `CRM.ecommerce.tsx` la
 *  mette sotto l'elenco dei prodotti, nella linguetta «Prodotti».
 *
 *  ── LE PROPS (da tenere così) ────────────────────────────────────────────────
 *   · `negozio`  `Pick<Negozio, "categorie" | "esegui">`: `categorie()` legge l'elenco (nell'ordine del sito),
 *                `esegui` per `categoria_salva`, `categoria_ordina`, `categoria_visibile`, `categoria_foto`.
 *   · `cambiate` da chiamare dopo ogni modifica riuscita: l'elenco dei prodotti rilegge i nomi per il suo filtro. */
import type { Negozio } from "./tipi";

export interface PropsCategorie {
  negozio: Pick<Negozio, "categorie" | "esegui">;
  cambiate: () => void;
}

export function Categorie(_props: PropsCategorie): null {
  return null;
}
