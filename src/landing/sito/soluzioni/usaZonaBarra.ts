/** ── DOVE STA LA BARRA E QUANDO SI FA DA PARTE ─────────────────────────────
 *  La logica di posizione della barra fissa di `/soluzioni` (`BarraPatch`). Stessa idea di
 *  `BarraConsulenza`: a ogni scorrimento, ridimensionamento o cambio di altezza della pagina si
 *  misurano gli elementi marcati `data-barra-nascondi` (con `requestAnimationFrame`, una misura per fotogramma).
 *
 *  A differenza di `BarraConsulenza` la barra c'è dal primo disegno e si nasconde solo in tre casi (4.4):
 *   1. il foglio del modulo è aperto (anche su computer: la pagina sotto è `inert`);
 *   2. il video del titolare sta girando;
 *   3. solo su telefono: un elemento `data-barra-nascondi="fondo"` (il bottone blu) entra negli ultimi 60 px,
 *      cioè starebbe sotto di lei.
 *  Mai per lo scorrimento in giù o in su: la barra è fissa per brief. Gli elementi «vista» (il modulo) qui non contano.
 *
 *  shortcut: la logica di misura è copiata da `BarraConsulenza` (che è di `giro2-crm` e qui non si tocca);
 *  quando S6 mette `BarraConsulenza` su questo gancio la copia sparisce (se S6 non si fa: registro tecnico).
 *  ───────────────────────────────────────────────────────────────────────── */
//  I ganci hanno nomi italiani fissati dal contratto («usa…», non «use…»): la regola non li riconosce, sono ganci veri.
/* eslint-disable react-hooks/rules-of-hooks */
import { useLayoutEffect, useState, type RefObject } from "react";
import { usaStatoPagina } from "./stato-pagina";

/** Quanto è alta la barra, area sicura esclusa (44 px), e l'aria da tenere prima del bottone. */
const ALTEZZA = 44;
const ARIA = 16;
/** La zona del fondo che, sul telefono, il bottone blu non deve occupare (4.0 punto 1: 44 + 16). */
const ZONA_FONDO = 60;

/** La misura di un elemento marcato `data-barra-nascondi`, già letta dalla pagina. */
export interface ElementoMisurato {
  tipo: string | undefined;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export interface QuadroBarra {
  elementi: ElementoMisurato[];
  /** L'altezza della finestra. */
  alto: number;
  /** Quanto in su dal bordo basso arriva la zona da tenere libera. */
  margine: number;
  /** Solo sul telefono il bottone blu in fondo conta. */
  telefono: boolean;
  foglioAperto: boolean;
  videoGira: boolean;
}

/** Vero se la barra deve farsi da parte. Pura: niente `window`, niente scorrimento. */
export function barraNascosta({
  elementi,
  alto,
  margine,
  telefono,
  foglioAperto,
  videoGira,
}: QuadroBarra): boolean {
  if (foglioAperto || videoGira) return true;
  if (!telefono) return false;
  return elementi.some((e) => {
    //  Un elemento che non occupa spazio (nascosto, non ancora disegnato) non copre niente.
    if (e.width === 0 && e.height === 0) return false;
    return e.tipo === "fondo" && e.bottom > alto - margine && e.top < alto;
  });
}

/** `lato`: dove sta la barra. In basso si misura la sua altezza vera (area sicura dell'iPhone compresa) per tenere
 *  libera la zona; in alto non c'è niente da tenere libero. `fondo`: vero solo su telefono (il bottone blu in fondo conta).
 *  Ritorna se la barra è da nascondere. Parte visibile: è nel primo disegno, la misura la corregge subito dopo (prima del disegno a schermo). */
export function usaZonaBarra(
  rif: RefObject<HTMLElement | null>,
  { lato, fondo }: { lato: "basso" | "alto"; fondo: boolean },
): { nascosta: boolean } {
  const { videoGira, foglioAperto } = usaStatoPagina();
  const [nascosta, setNascosta] = useState(false);

  useLayoutEffect(() => {
    let raf = 0;
    const verifica = () => {
      raf = 0;
      const margine =
        lato === "basso"
          ? Math.max(
              ZONA_FONDO,
              Math.max(rif.current?.getBoundingClientRect().height ?? 0, ALTEZZA) + ARIA,
            )
          : 0;
      const elementi = Array.from(
        document.querySelectorAll<HTMLElement>("[data-barra-nascondi]"),
        (el) => {
          const r = el.getBoundingClientRect();
          return {
            tipo: el.dataset.barraNascondi,
            top: r.top,
            bottom: r.bottom,
            width: r.width,
            height: r.height,
          };
        },
      );
      setNascosta(
        barraNascosta({
          elementi,
          alto: window.innerHeight,
          margine,
          telefono: fondo,
          foglioAperto,
          videoGira,
        }),
      );
    };
    const pianifica = () => {
      if (!raf) raf = requestAnimationFrame(verifica);
    };
    verifica();
    window.addEventListener("scroll", pianifica, { passive: true });
    window.addEventListener("resize", pianifica);
    const osserva = typeof ResizeObserver !== "undefined" ? new ResizeObserver(pianifica) : null;
    osserva?.observe(document.body);
    return () => {
      window.removeEventListener("scroll", pianifica);
      window.removeEventListener("resize", pianifica);
      osserva?.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [rif, lato, fondo, foglioAperto, videoGira]);

  return { nascosta };
}
