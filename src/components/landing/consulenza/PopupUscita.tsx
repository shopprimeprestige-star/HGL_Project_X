/** ── IL POP-UP «COSA NON TI CONVINCE?» (SPENTO DI BASE) ────────────────────
 *  Si accende con `INTERRUTTORI.popupUscita` (poi si pubblica) oppure, solo per
 *  le prove, con `?prova_popup=1` nell'indirizzo, per quella visita.
 *  Le regole stanno in `popupPuoPartire`: una volta per visita, solo sulle
 *  schede prodotto, mai se il pannello o il modulo sono già aperti; sul telefono
 *  solo dopo 40 secondi, al computer anche all'uscita del mouse dalla finestra.
 *  Si chiude con X, «No, grazie» ed Esc.
 *  ───────────────────────────────────────────────────────────────────────── */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { traccia } from "@/landing/consulenza/eventi";
import { popupPuoPartire, SECONDI_POPUP } from "@/landing/consulenza/regole";
import { pannelloGiaAperto, popupGiaMostrato, segnaPopupMostrato } from "@/landing/consulenza/scelta";
import { INTERRUTTORI, PROBLEMI, TESTI_CONSULENZA, type IdProblema } from "@/landing/testi-sito";
import { VociProblema } from "./VociProblema";

const PannelloProblemi = lazy(() => import("./PannelloProblemi"));

export function PopupUscita({ prodotto }: { prodotto?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const t = TESTI_CONSULENZA.popup;
  const finestra = useRef<HTMLDivElement | null>(null);
  const [attivo, setAttivo] = useState(false);
  const [aperto, setAperto] = useState(false);
  const [pannello, setPannello] = useState<{ aperto: boolean; problema: IdProblema | null } | null>(null);

  useEffect(() => {
    const prova = new URLSearchParams(window.location.search).get("prova_popup") === "1";
    setAttivo(INTERRUTTORI.popupUscita || prova);
  }, []);

  useEffect(() => {
    if (!attivo) return;
    const inizio = Date.now();
    const telefono = window.matchMedia?.("(hover: none) and (pointer: coarse)").matches ?? false;
    const prova = (motivo: "uscita" | "40s", secondi: number) => {
      const ok = popupPuoPartire({
        attivo: true,
        pathname,
        giaMostrato: popupGiaMostrato(),
        pannelloAperto: pannelloGiaAperto(),
        moduloAperto: !!document.querySelector("[data-consulenza-foglio]"),
        motivo,
        secondi,
        telefono,
      });
      if (!ok) return;
      segnaPopupMostrato();
      traccia("consulenza_popup_mostrato", { motivo });
      setAperto(true);
    };
    //  Il timer scatta un soffio prima dei 40 secondi veri: si passa il valore nominale.
    const timer = window.setTimeout(() => prova("40s", SECONDI_POPUP), SECONDI_POPUP * 1000);
    const uscita = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) prova("uscita", (Date.now() - inizio) / 1000);
    };
    if (!telefono) document.addEventListener("mouseout", uscita);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mouseout", uscita);
    };
  }, [attivo, pathname]);

  const chiudi = (azione: "x" | "no_grazie") => {
    traccia("consulenza_popup_click", { azione });
    setAperto(false);
  };

  const scegli = (id: IdProblema) => {
    const voce = PROBLEMI.find((p) => p.id === id);
    traccia("consulenza_popup_click", { azione: "problema", voce: voce?.etichetta ?? id });
    setAperto(false);
    setPannello({ aperto: true, problema: id });
  };

  return (
    <>
      <Dialog.Root
        open={aperto}
        onOpenChange={(a) => {
          if (!a) chiudi("x");
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/70 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none" />
          <Dialog.Content
            ref={finestra}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              finestra.current?.focus();
            }}
            className="fixed left-1/2 top-1/2 z-[60] flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-white/15 bg-[#0a1a3a] text-white shadow-[0_20px_60px_rgba(0,0,0,0.5)] focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none">
            <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
              <div className="min-w-0">
                <Dialog.Title className="text-xl font-bold leading-tight tracking-tight">{t.titolo}</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-white/75">{t.testo}</Dialog.Description>
              </div>
              <Dialog.Close
                aria-label={TESTI_CONSULENZA.barra.chiudi}
                className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </Dialog.Close>
            </div>
            <div className="overflow-y-auto overscroll-contain px-4 pb-4 pt-2">
              <VociProblema compatta voci={PROBLEMI} onScegli={scegli} />
              <button
                type="button"
                onClick={() => chiudi("no_grazie")}
                className="mt-3 min-h-11 w-full rounded-lg px-4 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {t.chiudi}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {pannello && (
        <Suspense fallback={null}>
          <PannelloProblemi
            aperto={pannello.aperto}
            onApertoChange={(a) => setPannello({ ...pannello, aperto: a })}
            provenienza="stock"
            punto="popup"
            prodotto={prodotto}
            problemaIniziale={pannello.problema}
          />
        </Suspense>
      )}
    </>
  );
}

export default PopupUscita;
