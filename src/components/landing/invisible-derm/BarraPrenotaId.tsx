/** ── LA BARRA FISSA DEL TELEFONO DELLA LANDING /invisible-derm ──────────────
 *  Solo sotto i 1024 px. Compare DOPO la sezione 3 (quando il segnale `data-barra-dopo="confronto"`
 *  è uscito dall'alto dello schermo) e si nasconde ogni volta che un elemento
 *  `data-barra-nascondi="vista"` è a schermo: così non ci sono mai due richieste nello stesso schermo.
 *  La X la chiude per tutta la visita (sessionStorage). Come BarraConsulenza: sta sotto al banner dei cookie
 *  e riserva in fondo alla pagina lo spazio che occupa. */
import { useEffect, useLayoutEffect, useState } from "react";
import { X } from "lucide-react";
import { BARRA, BOTTONE } from "@/landing/testi-invisible-derm";

const ALTEZZA = 56;
const SPAZIO = `calc(${ALTEZZA}px + env(safe-area-inset-bottom, 0px))`;
const CHIAVE = "hg_barra_id_chiusa";

export function BarraPrenotaId() {
  const [montata, setMontata] = useState(false);
  const [chiusa, setChiusa] = useState(false);
  const [visibile, setVisibile] = useState(false);

  useEffect(() => {
    try {
      setChiusa(sessionStorage.getItem(CHIAVE) === "1");
    } catch {
      /* senza sessionStorage la barra si può comunque chiudere, ma solo fino al ricaricamento */
    }
    setMontata(true);
  }, []);

  useLayoutEffect(() => {
    if (!montata || chiusa) return;
    let raf = 0;
    const verifica = () => {
      raf = 0;
      const alto = window.innerHeight;
      const dopo = document.querySelector("[data-barra-dopo='confronto']")?.getBoundingClientRect();
      const passato = !!dopo && dopo.bottom < 0;
      let copre = false;
      document.querySelectorAll<HTMLElement>("[data-barra-nascondi='vista']").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return;
        if (r.bottom > 0 && r.top < alto) copre = true;
      });
      setVisibile(passato && !copre);
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
  }, [montata, chiusa]);

  if (!montata || chiusa) return null;
  return (
    <>
      <div aria-hidden="true" data-barra-spazio="" className="lg:hidden" style={{ height: SPAZIO }} />
      <div
        role="region"
        aria-label={BOTTONE}
        inert={!visibile}
        style={{ height: SPAZIO, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        className={`fixed inset-x-0 bottom-0 z-40 border-t border-white/15 bg-[#081634] text-white transition-[transform,visibility] duration-200 motion-reduce:transition-none lg:hidden ${
          visibile ? "translate-y-0" : "invisible translate-y-full"
        }`}
      >
        <div className="mx-auto flex h-full max-w-6xl items-center gap-2 pl-4 pr-1">
          <a
            href="#prenota"
            data-track="cta_barra_clic"
            className="flex min-h-11 flex-1 items-center justify-center rounded-md bg-brand-scuro px-3 text-center text-[15px] font-semibold leading-tight text-brand-foreground hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            {BOTTONE}
          </a>
          <button
            type="button"
            onClick={() => {
              try {
                sessionStorage.setItem(CHIAVE, "1");
              } catch {
                /* vedi sopra */
              }
              setChiusa(true);
            }}
            aria-label={BARRA.chiudi}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white/75 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  );
}
