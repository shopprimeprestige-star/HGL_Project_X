/** ── SEGNAPOSTO DEI DUE COMPONENTI DI S4 (ramo `v3-s4`, non ancora unito) ───────────────────────────────
 *  Stesse firme di `FoglioModulo.tsx` e `BarraPatch.tsx` di S4 (572f322, c61622d). ALL'UNIONE DI S4 questo file si cancella e
 *  `PaginaSoluzioni.tsx` importa da `./FoglioModulo` e `./BarraPatch`. Il resto (S1, S2) è già importato dai file veri. */
import type { RefObject } from "react";
import { LINK_CATALOGO, TESTI_SOLUZIONI } from "@/landing/testi-sito";
import type { Interesse } from "./regole";

export function FoglioModulo(_: { aperto: boolean; interesse: Interesse; onChiudi: () => void; rientro: RefObject<HTMLElement | null> }) {
  return null;
}

export function BarraPatch() {
  return (
    <a href={LINK_CATALOGO} aria-label={TESTI_SOLUZIONI.barra.etichettaAccessibile} data-barra-patch="">
      {TESTI_SOLUZIONI.barra.testo}
    </a>
  );
}
