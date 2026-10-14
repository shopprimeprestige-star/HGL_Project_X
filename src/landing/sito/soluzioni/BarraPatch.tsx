/** ── LA BARRA FISSA «PATCH PRONTE IN STOCK →» ──────────────────────────────
 *  Porta al catalogo delle patch pronte (`LINK_CATALOGO`, oggi `/shop`). Sempre lì, mai blu pieno:
 *  una pillola a contorno su fondo notte più chiaro, perché si legge come un servizio e non ruba la consulenza.
 *  - Telefono: in basso, 44 px + area sicura, con lo spazio riservato in fondo alla pagina (nemmeno il footer resta sotto).
 *  - Computer (da 1024): in alto, 44 px, testo a destra nel contenitore da 1200.
 *  - Presente dal primo disegno (la disegna anche il server). Si nasconde solo in tre casi, vedi `usaZonaBarra`.
 *  ⚠️ Montarla DOPO il footer, come `BarraConsulenza`: lo spazio riservato sta dove sta lei. Su computer la barra
 *  è fissa in alto e non occupa posto: la pagina riserva i 44 px in alto da sé (`lg:pt-11` sulla radice).
 *  ───────────────────────────────────────────────────────────────────────── */
//  I ganci hanno nomi italiani fissati dal contratto («usa…», non «use…»): la regola non li riconosce, sono ganci veri.

import { useRef } from "react";
import { LINK_CATALOGO, TESTI_SOLUZIONI } from "@/landing/testi-sito";
import { traccia } from "@/landing/sito/traccia";
import { usaComputer } from "./stato-pagina";
import { usaZonaBarra } from "./usaZonaBarra";

const SPAZIO = "calc(44px + env(safe-area-inset-bottom))";
export function BarraPatch() {
  const t = TESTI_SOLUZIONI.barra;
  const rif = useRef<HTMLAnchorElement | null>(null);
  const telefono = !usaComputer();
  const { nascosta } = usaZonaBarra(rif, { lato: telefono ? "basso" : "alto", fondo: telefono });
  //  La freccia del testo («Patch pronte in stock →») ha il suo colore; il nome accessibile è l'etichetta.
  const [parole, freccia] = t.testo.split("→");

  return (
    <>
      <div
        aria-hidden="true"
        data-barra-spazio=""
        className="lg:hidden"
        style={{ height: SPAZIO }}
      />
      <a
        ref={rif}
        href={LINK_CATALOGO}
        aria-label={t.etichettaAccessibile}
        data-barra-patch=""
        data-nascosta={nascosta ? "" : undefined}
        inert={nascosta}
        onClick={() => traccia("barra_shop_clic")}
        className={`fixed inset-x-0 bottom-0 z-40 flex h-[calc(44px+env(safe-area-inset-bottom))] items-center border-t border-[#C9D6FF]/30 bg-[#111C3D] pb-[env(safe-area-inset-bottom)] transition-[opacity,visibility] duration-150 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white motion-reduce:transition-none lg:bottom-auto lg:top-0 lg:h-11 lg:border-b lg:border-t-0 lg:pb-0 ${
          nascosta ? "invisible opacity-0" : "visible opacity-100"
        }`}
      >
        <span className="mx-auto flex w-full max-w-[1200px] items-center justify-center px-4 lg:justify-end">
          <span className="inline-flex h-8 items-center rounded-full border-[1.5px] border-[#C9D6FF] px-4 text-[15px] font-semibold text-white">
            <span>
              {parole}
              {freccia !== undefined && (
                <span aria-hidden="true" className="text-[#5CB6FF]">
                  →
                </span>
              )}
            </span>
          </span>
        </span>
      </a>
    </>
  );
}
