import { useEffect, useState } from "react";

/** L'area davvero visibile: altezza, distanza dall'alto della pagina, tastiera aperta. */
export interface AreaVisibile {
  /** px: `visualViewport.height` */
  altezza: number;
  /** px: `visualViewport.offsetTop`, di quanto iOS ha spostato in giù la vista */
  alto: number;
  /** la vista è molto più bassa della pagina: c'è la tastiera (iOS) */
  tastiera: boolean;
}

/** Sotto questa differenza fra pagina e vista non è la tastiera (barre del browser). */
const SOGLIA_TASTIERA = 120;

/** L'area davvero visibile, o `null` se non serve/non si sa.
 *
 *  Su iPhone la tastiera NON accorcia `100dvh` né la pagina: copre la parte
 *  bassa e, per mostrare il campo toccato, iOS SPOSTA in giù la vista
 *  (`visualViewport.offsetTop`). Guasto del 28/10/2026 (screenshot del
 *  titolare, browser dentro un'app): la chat si accorciava sull'altezza giusta
 *  ma restava in cima alla pagina, mentre la vista era scesa sotto di lei —
 *  si vedeva solo il fondo bianco della pagina e la tastiera.
 *  Per questo serve anche `alto`, e si ascolta anche `scroll` (lo spostamento
 *  della vista non è un `resize`). Con lo zoom a pizzico (`scale ≠ 1`) si
 *  lascia stare: l'altezza zoomata non è quella della pagina.
 *  `null` al primo giro (anche sul server): la pagina parte con `dvh`, così
 *  non c'è differenza fra HTML del server e primo disegno nel browser. */
function useAltezzaVisibile(): AreaVisibile | null {
  const [area, setArea] = useState<AreaVisibile | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const leggi = () =>
      setArea((prima) => {
        if (vv.scale !== 1) return null;
        const altezza = Math.round(vv.height);
        const alto = Math.max(0, Math.round(vv.offsetTop));
        const tastiera = window.innerHeight - altezza > SOGLIA_TASTIERA;
        return prima?.altezza === altezza && prima.alto === alto && prima.tastiera === tastiera
          ? prima
          : { altezza, alto, tastiera };
      });
    leggi();
    vv.addEventListener("resize", leggi);
    vv.addEventListener("scroll", leggi);
    return () => {
      vv.removeEventListener("resize", leggi);
      vv.removeEventListener("scroll", leggi);
    };
  }, []);

  return area;
}

//  Nome italiano come il resto del CRM; la funzione si chiama `use…` qui sopra perché
//  il controllo delle regole degli hook riconosce un hook dal nome (vedi anteprime-passata.ts).
export const usaAltezzaVisibile = useAltezzaVisibile;
