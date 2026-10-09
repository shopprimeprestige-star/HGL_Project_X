// Hook riusabili per top bar sticky:
// - useStickyTopHeight: misura l'altezza dinamica di un elemento sticky con ResizeObserver,
//   utile per posizionare correttamente righe sticky figlie (header tabelle, totali) sotto
//   una top bar che cambia altezza (es. quando compaiono delta badge sotto un filtro).
// - useStickyShadow: aggiunge una sottile shadow alla top bar quando l'utente scrolla,
//   per dare separazione visiva tra barra fissa e contenuto.

import { useEffect, useRef, useState } from "react";

/** Misura altezza in px di un elemento (sticky bar) con ResizeObserver.
 *  Ritorna [ref, height]. Default initial = 92 (compatibile con la vecchia hardcoded). */
export function useStickyTopHeight(initial = 92): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [h, setH] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setH(el.getBoundingClientRect().height);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => { ro.disconnect(); window.removeEventListener("resize", update); };
  }, []);
  return [ref, h];
}

/** Ritorna `true` quando la finestra è scrollata oltre la soglia (default 4px).
 *  Utile per applicare condizionalmente una shadow alla top bar sticky:
 *    `className={cn("sticky top-0", scrolled && "shadow-[0_1px_3px_rgba(0,0,0,0.06)]")}`
 */
export function useStickyShadow(threshold = 4): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}
