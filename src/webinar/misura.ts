import { useCallback, useEffect, useRef, useState } from "react";

/** ── QUANTO È GRANDE QUESTA COSA ───────────────────────────────────────────
 *
 *  ⚠️ NON SOLO `ResizeObserver`. Sembra il modo giusto e da solo non basta:
 *   ci sono situazioni in cui non consegna NIENTE — l'ho visto di persona,
 *   una pagina in una scheda che non sta disegnando non riceve una singola
 *   misura, nemmeno la prima, nemmeno su un elemento che sullo schermo è
 *   largo trecentosettantacinque punti. Chi si fida solo di lui resta con
 *   zero, e zero, in mano a un conto di proporzioni, vuol dire un riquadro
 *   vuoto: un guasto, non un ripiego.
 *
 *   Quindi tre strade per la stessa risposta, in ordine di quanto sono
 *   precise: si legge SUBITO appena l'elemento esiste, si riascolta a ogni
 *   ridimensionamento e rotazione della finestra, e in più c'è l'osservatore
 *   per i casi che la finestra non vede — la chat che si apre, la fila degli
 *   ospiti che compare, la tastiera che sale.
 *
 *  ⚠️ Il riferimento è una FUNZIONE e non un oggetto: le cose che si misurano
 *   compaiono e spariscono (si è in onda o no, si mostra un contenuto o no), e
 *   un `useEffect` con le dipendenze giuste sarebbe una lista da tenere
 *   allineata a mano ogni volta che cambia una condizione.
 */
export function useMisura<T extends HTMLElement>() {
  const [misura, setMisura] = useState({ larghezza: 0, altezza: 0 });
  const elemento = useRef<T | null>(null);
  const guardia = useRef<ResizeObserver | null>(null);

  const leggi = useCallback(() => {
    const el = elemento.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMisura((prima) => {
      const larghezza = Math.round(r.width);
      const altezza = Math.round(r.height);
      //  ⚠️ Solo se cambia davvero: rimettere lo stesso numero ridisegnerebbe
      //   in continuazione, e l'osservatore chiama a ogni fotogramma.
      return prima.larghezza === larghezza && prima.altezza === altezza
        ? prima
        : { larghezza, altezza };
    });
  }, []);

  const rif = useCallback(
    (el: T | null) => {
      guardia.current?.disconnect();
      guardia.current = null;
      elemento.current = el;
      if (!el) return;
      leggi();
      if (typeof ResizeObserver !== "undefined") {
        guardia.current = new ResizeObserver(leggi);
        guardia.current.observe(el);
      }
    },
    [leggi],
  );

  useEffect(() => {
    leggi();
    if (typeof window === "undefined") return;
    window.addEventListener("resize", leggi);
    window.addEventListener("orientationchange", leggi);
    return () => {
      window.removeEventListener("resize", leggi);
      window.removeEventListener("orientationchange", leggi);
    };
  }, [leggi]);

  return [rif, misura] as const;
}
