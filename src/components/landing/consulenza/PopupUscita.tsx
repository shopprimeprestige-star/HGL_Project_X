/** ── IL POP-UP «COSA NON TI CONVINCE?» (SPENTO DI BASE) ────────────────────
 *  Si accende con `INTERRUTTORI.popupUscita` (poi si pubblica) oppure, solo per
 *  le prove, con `?prova_popup=1` nell'indirizzo, per quella visita.
 *  Le regole stanno in `popupPuoPartire`: una volta per visita, solo sulle
 *  schede prodotto, mai se il pannello o il modulo sono già aperti; sul telefono
 *  solo dopo 40 secondi, al computer anche all'uscita del mouse dalla finestra.
 *  Si chiude con X, «No, grazie» ed Esc.
 *  `aspetto="shop"` (V1, scheda dello shop, D85): la STRUTTURA della SPEC §12.4.2: fondo blueprint, titolo e testo del documento
 *  dello shop («Prima di andare»), [Consulenza gratuita] blu pieno che apre il pannello dei problemi, «No, grazie»; senza l'elenco
 *  delle voci. Di base «oggi»: il pop-up di questa pagina, uguale a prima. Si monta solo sulla scheda di una patch a carrello vuoto
 *  (lo decide la pagina, non il pop-up).
 *  ───────────────────────────────────────────────────────────────────────── */
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { traccia } from "@/landing/consulenza/eventi";
import { popupPuoPartire, SECONDI_POPUP } from "@/landing/consulenza/regole";
import {
  pannelloGiaAperto,
  popupGiaMostrato,
  segnaPopupMostrato,
} from "@/landing/consulenza/scelta";
import { INTERRUTTORI, PROBLEMI, TESTI_CONSULENZA, type IdProblema } from "@/landing/testi-sito";
import { TESTI_SHOP } from "@/landing/testi-shop";
import { VociProblema } from "./VociProblema";

const PannelloProblemi = lazy(() => import("./PannelloProblemi"));

export type AspettoPopup = "oggi" | "shop";

/** `azione` di `consulenza_popup_click` per il bottone [Consulenza gratuita] del pop-up nuovo. Diversa da quelle di oggi («x», «no_grazie»,
 *  «problema» + `voce`): il conteggio di Vendite non deve confondere il bottone con la scelta di un problema. */
export const AZIONE_POPUP_CONSULENZA = "consulenza";

/** Le classi del pop-up, per aspetto: funzione pura (provata a parte). Le stringhe di «oggi» sono quelle di prima, byte per byte. */
export function classiPopup(aspetto: AspettoPopup) {
  const shop = aspetto === "shop";
  return {
    sfondo:
      "fixed inset-0 z-[60] bg-black/70 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none",
    finestra: shop
      ? "fixed left-1/2 top-1/2 z-[60] flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-white/15 bg-blueprint text-white shadow-[0_20px_60px_rgba(0,0,0,0.5)] focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none"
      : "fixed left-1/2 top-1/2 z-[60] flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-white/15 bg-[#0a1a3a] text-white shadow-[0_20px_60px_rgba(0,0,0,0.5)] focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none",
    testa: shop
      ? "flex items-start justify-between gap-3 px-6 pb-2 pt-6"
      : "flex items-start justify-between gap-3 px-4 pb-2 pt-4",
    titolo: shop
      ? "text-2xl font-bold leading-tight tracking-tight"
      : "text-xl font-bold leading-tight tracking-tight",
    testo: shop ? "mt-2 text-base leading-relaxed text-white/85" : "mt-1 text-sm text-white/75",
    chiudi:
      "-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
    corpo: shop
      ? "overflow-y-auto overscroll-contain px-6 pb-6 pt-4"
      : "overflow-y-auto overscroll-contain px-4 pb-4 pt-2",
    rifiuto: shop
      ? "mt-2 min-h-11 w-full rounded-lg px-4 text-sm font-medium text-white/80 underline underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      : "mt-3 min-h-11 w-full rounded-lg px-4 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
    /** Il bottone blu pieno della consulenza: solo nel pop-up nuovo (quello di oggi non lo ha). */
    consulenza: shop
      ? "h-12 w-full rounded-lg bg-brand-scuro px-4 text-[15px] font-semibold text-white transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1a3a]"
      : "",
  };
}

export function PopupUscita({
  prodotto,
  aspetto = "oggi",
}: {
  prodotto?: string;
  aspetto?: AspettoPopup;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const shop = aspetto === "shop";
  const cl = classiPopup(aspetto);
  const testi = TESTI_SHOP.popup;
  const t = shop
    ? { titolo: testi.titolo, testo: testi.testo, chiudi: testi.rifiuto }
    : TESTI_CONSULENZA.popup;
  const finestra = useRef<HTMLDivElement | null>(null);
  const [attivo, setAttivo] = useState(false);
  const [aperto, setAperto] = useState(false);
  const [pannello, setPannello] = useState<{ aperto: boolean; problema: IdProblema | null } | null>(
    null,
  );

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

  //  [Consulenza gratuita] del pop-up nuovo: un evento suo (`azione` nuova), poi il pannello, senza problema scelto.
  const consulenza = () => {
    traccia("consulenza_popup_click", { azione: AZIONE_POPUP_CONSULENZA });
    setAperto(false);
    setPannello({ aperto: true, problema: null });
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
          <Dialog.Overlay className={cl.sfondo} />
          <Dialog.Content
            ref={finestra}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              finestra.current?.focus();
            }}
            className={cl.finestra}
          >
            <div className={cl.testa}>
              <div className="min-w-0">
                <Dialog.Title className={cl.titolo}>{t.titolo}</Dialog.Title>
                <Dialog.Description className={cl.testo}>{t.testo}</Dialog.Description>
              </div>
              <Dialog.Close aria-label={TESTI_CONSULENZA.barra.chiudi} className={cl.chiudi}>
                <X className="h-5 w-5" aria-hidden="true" />
              </Dialog.Close>
            </div>
            <div className={cl.corpo}>
              {shop ? (
                <button type="button" onClick={consulenza} className={cl.consulenza}>
                  {testi.bottone}
                </button>
              ) : (
                <VociProblema compatta voci={PROBLEMI} onScegli={scegli} />
              )}
              <button type="button" onClick={() => chiudi("no_grazie")} className={cl.rifiuto}>
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
