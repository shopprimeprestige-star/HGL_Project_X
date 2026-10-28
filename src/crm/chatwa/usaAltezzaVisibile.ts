import { useEffect, useState } from "react";

/** Altezza (px) dell'area davvero visibile, o `null` se non serve/non si sa.
 *
 *  Su iPhone la tastiera NON accorcia `100dvh`: copre la parte bassa della
 *  pagina, e con lei la casella di scrittura. `visualViewport` invece si
 *  accorcia, quindi la pagina si dimensiona su quello e la casella resta
 *  sopra la tastiera. Con lo zoom a pizzico (`scale ≠ 1`) si lascia stare:
 *  l'altezza zoomata non è quella della pagina.
 *  `null` al primo giro (anche sul server): la pagina parte con `dvh`, così
 *  non c'è differenza fra HTML del server e primo disegno nel browser. */
function useAltezzaVisibile(): number | null {
  const [altezza, setAltezza] = useState<number | null>(null);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const leggi = () => setAltezza(vv.scale === 1 ? Math.round(vv.height) : null);
    leggi();
    vv.addEventListener("resize", leggi);
    return () => vv.removeEventListener("resize", leggi);
  }, []);

  return altezza;
}

//  Nome italiano come il resto del CRM; la funzione si chiama `use…` qui sopra perché
//  il controllo delle regole degli hook riconosce un hook dal nome (vedi anteprime-passata.ts).
export const usaAltezzaVisibile = useAltezzaVisibile;
