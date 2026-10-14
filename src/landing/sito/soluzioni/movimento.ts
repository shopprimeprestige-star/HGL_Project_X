/** «Riduci movimento» del sistema. Tutto quello che si muove sulla pagina `/soluzioni` lo chiede qui
 *  (il CSS lo spegne da sé con la stessa media query: vedi `styles.css`). */
//  Il gancio ha il nome italiano fissato dal contratto («usa…», non «use…»): la regola non lo riconosce, ma è un gancio vero.
/* eslint-disable react-hooks/rules-of-hooks */
import { useSyncExternalStore } from "react";

const RICHIESTA = "(prefers-reduced-motion: reduce)";

/** Sul browser, adesso. Sul server non si sa: `false`, e il browser corregge subito dopo l'idratazione. */
export function movimentoRidottoOra(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(RICHIESTA).matches
  );
}

function iscriviti(cambiato: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const m = window.matchMedia(RICHIESTA);
  m.addEventListener("change", cambiato);
  return () => m.removeEventListener("change", cambiato);
}

export function usaMovimentoRidotto(): boolean {
  return useSyncExternalStore(iscriviti, movimentoRidottoOra, () => false);
}

/** Per `scrollIntoView`: morbido, ridotto = istantaneo (4.1). */
export function comportamentoScorrimento(): ScrollBehavior {
  return movimentoRidottoOra() ? "auto" : "smooth";
}
