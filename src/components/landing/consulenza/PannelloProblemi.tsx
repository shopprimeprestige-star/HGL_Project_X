/** ── IL PANNELLO «QUAL È IL PROBLEMA?» ─────────────────────────────────────
 *  Foglio che sale dal basso (Radix: Esc, tocco fuori, fuoco intrappolato).
 *  - Nello shop (provenienza «stock») il tocco su una voce apre il modulo
 *    DENTRO lo stesso foglio, con il problema già scelto: carrello e scheda
 *    restano dove sono. Il modulo (400 kB di calendario) si scarica solo allora.
 *  - Altrove (home, Protocol) il tocco salva la scelta, chiude e scende al
 *    modulo della pagina (`#prenota`).
 *  Eventi: `consulenza_pannello_aperto`, `consulenza_problema_scelto` (con la
 *  voce, mai testo libero, nome o telefono).
 *  ───────────────────────────────────────────────────────────────────────── */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import { traccia } from "@/landing/consulenza/eventi";
import { salvaScelta, segnaPannelloAperto } from "@/landing/consulenza/scelta";
import type { Provenienza, PuntoIngresso } from "@/landing/consulenza/regole";
import { LINK_CONSULENZA, PROBLEMI, TESTI_CONSULENZA, type IdProblema } from "@/landing/testi-sito";
import { VociProblema } from "./VociProblema";

const BookingFunnel = lazy(() =>
  import("@/landing/booking/BookingFunnel").then((m) => ({ default: m.BookingFunnel })),
);

export interface PannelloProps {
  aperto: boolean;
  onApertoChange: (aperto: boolean) => void;
  provenienza: Provenienza;
  punto: PuntoIngresso;
  /** Protesi guardata, se c'è (solo schede di protesi). */
  prodotto?: string;
  /** Problema già scelto altrove (box, pop-up): si va dritti al modulo. */
  problemaIniziale?: IdProblema | null;
}

/** Scende al modulo della pagina; se la pagina non ne ha uno, ci va. */
function vaiAlModulo() {
  const ridotto = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  //  Aspetta che il foglio sia chiuso e lo scorrimento della pagina sbloccato.
  window.setTimeout(() => {
    const el = document.getElementById("prenota");
    if (el) el.scrollIntoView({ behavior: ridotto ? "auto" : "smooth", block: "start" });
    else window.location.assign(LINK_CONSULENZA);
  }, 180);
}

export function PannelloProblemi({
  aperto,
  onApertoChange,
  provenienza,
  punto,
  prodotto,
  problemaIniziale = null,
}: PannelloProps) {
  const [fase, setFase] = useState<"voci" | "modulo">("voci");
  const t = TESTI_CONSULENZA.pannello;
  const eraAperto = useRef(false);
  const foglio = useRef<HTMLDivElement | null>(null);

  const scegli = (id: IdProblema) => {
    const voce = PROBLEMI.find((p) => p.id === id);
    traccia("consulenza_problema_scelto", { voce: voce?.etichetta ?? id, punto, provenienza });
    salvaScelta({ problema: id, provenienza, punto, ...(prodotto ? { prodotto } : {}) });
    if (provenienza === "stock") {
      setFase("modulo");
    } else {
      onApertoChange(false);
      vaiAlModulo();
    }
  };

  useEffect(() => {
    if (!aperto) {
      eraAperto.current = false;
      return;
    }
    if (eraAperto.current) return;
    eraAperto.current = true;
    segnaPannelloAperto();
    traccia("consulenza_pannello_aperto", { punto, provenienza });
    setFase("voci");
    if (problemaIniziale) scegli(problemaIniziale);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aperto]);

  return (
    <Dialog.Root open={aperto} onOpenChange={onApertoChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/70 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
        <Dialog.Content
          ref={foglio}
          //  Il fuoco parte dal foglio, non dalla X: niente anello su un tasto che nessuno ha toccato.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            foglio.current?.focus();
          }}
          data-consulenza-foglio=""
          className="fixed inset-x-0 bottom-0 z-[60] mx-auto flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-2xl border border-b-0 border-white/15 bg-[#0a1a3a] text-white shadow-[0_-12px_40px_rgba(0,0,0,0.45)] focus:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom motion-reduce:animate-none"
        >
          <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
            {fase === "voci" ? (
              <div className="min-w-0">
                <Dialog.Title className="text-xl font-bold leading-tight tracking-tight">
                  {t.titolo}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-white/75">
                  {t.sottotitolo}
                </Dialog.Description>
              </div>
            ) : (
              //  Il problema si cambia nel modulo stesso (passo dei contatti): qui basta la X.
              <div className="min-w-0">
                <Dialog.Title className="sr-only">{TESTI_CONSULENZA.barra.bottone}</Dialog.Title>
                <Dialog.Description className="sr-only">{t.sottotitolo}</Dialog.Description>
              </div>
            )}
            <Dialog.Close
              aria-label={TESTI_CONSULENZA.barra.chiudi}
              className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </Dialog.Close>
          </div>

          <div className="overflow-y-auto overscroll-contain px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
            {fase === "voci" ? (
              <VociProblema voci={PROBLEMI} onScegli={scegli} />
            ) : (
              <Suspense
                fallback={
                  <div className="flex min-h-40 items-center justify-center text-white/70">
                    <Loader2
                      className="h-5 w-5 animate-spin motion-reduce:animate-none"
                      aria-label="Caricamento"
                    />
                  </div>
                }
              >
                <BookingFunnel variant="dark" />
              </Suspense>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default PannelloProblemi;
