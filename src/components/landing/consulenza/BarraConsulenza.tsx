/** ── LA BARRA FISSA «IL TUO CASO È PARTICOLARE?» ───────────────────────────
 *  Sottile (56 px + zona dei gesti dell'iPhone), in fondo allo schermo.
 *  - Si disegna solo dopo il montaggio: legge `sessionStorage`, e sul server
 *    non c'è (niente differenze fra server e browser).
 *  - Non copre mai un bottone: si nasconde mentre un elemento marcato
 *    `data-barra-nascondi="vista"` (un modulo) è sullo schermo, o uno marcato
 *    `"fondo"` (il blocco «Aggiungi al carrello») entra negli ultimi 72 px.
 *  - Riserva in fondo alla pagina lo spazio che occupa, così nemmeno il
 *    piè di pagina resta sotto di lei.
 *  - La X la chiude per tutta la visita. Mai su carrello, cassa, CRM, Meetly…
 *  ⚠️ Metterla dopo il piè di pagina: lo spazio riservato sta dove sta lei.
 *  ───────────────────────────────────────────────────────────────────────── */
import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { traccia } from "@/landing/consulenza/eventi";
import { barraVisibile, type Provenienza } from "@/landing/consulenza/regole";
import { barraChiusaInSessione, segnaBarraChiusa } from "@/landing/consulenza/scelta";
import { TESTI_CONSULENZA } from "@/landing/testi-sito";

const PannelloProblemi = lazy(() => import("./PannelloProblemi"));

/** Altezza minima della barra e aria in più da tenere prima del blocco d'acquisto. */
const ALTEZZA = 56;
const ARIA_FONDO = 16;
const SPAZIO = `calc(${ALTEZZA}px + env(safe-area-inset-bottom, 0px))`;

interface Props {
  provenienza: Provenienza;
  /** Protesi guardata, se la pagina è la scheda di una protesi. */
  prodotto?: string;
}

export function BarraConsulenza({ provenienza, prodotto }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [montata, setMontata] = useState(false);
  const [chiusa, setChiusa] = useState(false);
  //  Parte nascosta: la barra si mostra (e si conta) solo dopo il primo controllo
  //  delle posizioni, fatto prima del disegno. Mai un fotogramma sopra un modulo.
  const [nascosta, setNascosta] = useState(true);
  const barra = useRef<HTMLDivElement | null>(null);
  const [pannelloMontato, setPannelloMontato] = useState(false);
  const [pannelloAperto, setPannelloAperto] = useState(false);
  const t = TESTI_CONSULENZA.barra;

  useEffect(() => {
    setChiusa(barraChiusaInSessione());
    setMontata(true);
  }, []);

  const presente = montata && barraVisibile(pathname, chiusa);
  const visibile = presente && !nascosta && !pannelloAperto;

  //  Controllo delle posizioni: a ogni scorrimento, ridimensionamento o
  //  cambio di altezza della pagina (contenuti che arrivano dopo).
  useLayoutEffect(() => {
    if (!presente) return;
    let raf = 0;
    const verifica = () => {
      raf = 0;
      const alto = window.innerHeight;
      //  Il margine segue l'altezza vera della barra (zona dei gesti dell'iPhone compresa).
      const margine =
        Math.max(barra.current?.getBoundingClientRect().height ?? 0, ALTEZZA) + ARIA_FONDO;
      let copre = false;
      document.querySelectorAll<HTMLElement>("[data-barra-nascondi]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        const tipo = el.dataset.barraNascondi;
        if (tipo === "vista" && r.bottom > 0 && r.top < alto) copre = true;
        if (tipo === "fondo" && r.bottom > alto - margine && r.top < alto) copre = true;
      });
      setNascosta(copre);
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
  }, [presente, pathname]);

  useEffect(() => {
    if (visibile) traccia("consulenza_barra_vista", { provenienza }, { dedupKey: "barra" });
  }, [visibile, provenienza]);

  const apri = () => {
    traccia("consulenza_barra_click", { provenienza });
    setPannelloMontato(true);
    setPannelloAperto(true);
  };
  const chiudi = () => {
    traccia("consulenza_barra_chiusa", { provenienza });
    segnaBarraChiusa();
    setChiusa(true);
  };

  if (!montata) return null;

  return (
    <>
      {presente && <div aria-hidden="true" data-barra-spazio="" style={{ height: SPAZIO }} />}
      {presente && (
        <div
          ref={barra}
          role="region"
          aria-label={t.bottone}
          data-barra-consulenza=""
          data-nascosta={visibile ? undefined : ""}
          inert={!visibile}
          style={{ height: SPAZIO, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/15 bg-[#081634] text-white transition-[transform,visibility] duration-200 motion-reduce:transition-none ${
            visibile ? "translate-y-0" : "invisible translate-y-full"
          }`}
        >
          <div className="mx-auto flex h-full max-w-6xl items-center gap-2 pl-4 pr-1">
            <p className="line-clamp-2 min-w-0 flex-1 text-[13px] leading-tight sm:text-sm">
              <span className="sm:hidden">{t.telefono}</span>
              <span className="hidden sm:inline">{t.schermoLargo}</span>
            </p>
            <button
              type="button"
              onClick={apri}
              className="h-11 shrink-0 rounded-lg bg-brand-scuro px-3.5 text-[13px] font-semibold text-white transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#081634] sm:px-5 sm:text-sm"
            >
              {t.bottone}
            </button>
            <button
              type="button"
              onClick={chiudi}
              aria-label={t.chiudi}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
      {pannelloMontato && (
        <Suspense fallback={null}>
          <PannelloProblemi
            aperto={pannelloAperto}
            onApertoChange={setPannelloAperto}
            provenienza={provenienza}
            //  Nello shop il punto è «barra»; sulle altre pagine il tocco
            //  passa dal pannello (le due diciture servono a Vendite).
            punto={provenienza === "stock" ? "barra" : "pannello"}
            prodotto={prodotto}
          />
        </Suspense>
      )}
    </>
  );
}

export default BarraConsulenza;
