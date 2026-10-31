/** ── «LA BOLLA È IN VISTA?» PER IL CARICAMENTO PIGRO DEI MEDIA ───────────────
 *
 *  Commessa 2026-10-31-media-e-archiviazione, compito T8 (PIANO b.1).
 *  Una chat può avere centinaia di messaggi e decine di media: foto, miniature e
 *  righe si chiedono solo per le bolle vicine alla vista.
 *
 *  ⚠️ UN osservatore per contenitore che scorre, con `root` = quel contenitore.
 *   Senza `root` il `rootMargin` non anticipa niente: l'area è prima ritagliata
 *   dal contenitore con `overflow`. `Conversazione.tsx` non si tocca, quindi il
 *   contenitore si trova risalendo dagli antenati (primo con `overflow-y`
 *   auto/scroll/overlay), come fa `ElencoChat` con `root: fondo.parentElement`.
 *  ⚠️ Conferma dopo `ATTESA_MS`: all'apertura la chat si posiziona in fondo con un
 *   effetto, dopo il primo disegno. Una bolla in alto che per un attimo risulta
 *   «in vista» e poi esce NON deve far partire richieste (e nemmeno una che
 *   passa veloce durante uno scorrimento).
 *  ⚠️ Una volta sola per bolla: quando è stata vista resta vista.
 *  shortcut: senza `IntersectionObserver` (browser molto vecchi) è tutto visibile
 *  subito, come prima di questa commessa; nessuna alternativa con lo scroll.
 *  Nessun log. */
import { useEffect, useRef, useState } from "react";

/** Quanto prima di entrare in vista si comincia a caricare. */
export const MARGINE_PX = 300;
/** Quanto deve restare in vista per contare (assorbe il posizionamento in fondo). */
export const ATTESA_MS = 150;

type Elemento = { parentElement: Elemento | null };

/** Il primo antenato che scorre in verticale, o `null` (= la pagina intera). */
export function contenitoreCheScorre(el: Elemento | null): Elemento | null {
  if (typeof getComputedStyle === "undefined") return null;
  for (let p = el?.parentElement ?? null; p; p = p.parentElement) {
    const oy = getComputedStyle(p as unknown as Element).overflowY;
    if (oy === "auto" || oy === "scroll" || oy === "overlay") return p;
  }
  return null;
}

interface Voce {
  /** chiamata una volta, quando la bolla è stata vista per `ATTESA_MS` */
  vista: () => void;
  timer: ReturnType<typeof setTimeout> | null;
}
interface Osservatore {
  io: IntersectionObserver;
  voci: Map<Element, Voce>;
}
/** Un osservatore per contenitore (`null` = la finestra). */
const osservatori = new Map<Element | null, Osservatore>();

/** Osserva `el`; `vista` parte una volta sola. Restituisce la funzione che smette. */
export function osservaVisibile(el: Element, vista: () => void): () => void {
  if (typeof IntersectionObserver === "undefined") {
    vista();
    return () => undefined;
  }
  const root = contenitoreCheScorre(el as unknown as Elemento) as Element | null;
  let o = osservatori.get(root);
  if (!o) {
    const voci = new Map<Element, Voce>();
    const nuovo: Osservatore = {
      voci,
      io: new IntersectionObserver(
        (entrate) => {
          for (const e of entrate) {
            const v = voci.get(e.target);
            if (!v) continue;
            if (v.timer) clearTimeout(v.timer);
            v.timer = null;
            if (!e.isIntersecting) continue;
            v.timer = setTimeout(() => {
              v.timer = null;
              smetti(e.target);
              v.vista();
            }, ATTESA_MS);
          }
        },
        { root, rootMargin: `${MARGINE_PX}px 0px` },
      ),
    };
    osservatori.set(root, nuovo);
    o = nuovo;
  }
  const mio = o;
  const smetti = (t: Element) => {
    const v = mio.voci.get(t);
    if (v?.timer) clearTimeout(v.timer);
    mio.voci.delete(t);
    mio.io.unobserve(t);
    if (mio.voci.size === 0) {
      mio.io.disconnect();
      if (osservatori.get(root) === mio) osservatori.delete(root);
    }
  };
  mio.voci.set(el, { vista, timer: null });
  mio.io.observe(el);
  return () => smetti(el);
}

/** Quanti osservatori ci sono (le prove: uno per contenitore, non uno per bolla). */
export const osservatoriAttivi = () => osservatori.size;

/** `true` quando l'elemento di `ref` è stato in vista (o vicino). Mai più `false` dopo. */
export function useVisibile(forzato = false) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visto, setVisto] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || visto || forzato) return;
    return osservaVisibile(el, () => setVisto(true));
  }, [visto, forzato]);
  return { ref, visibile: visto || forzato };
}
