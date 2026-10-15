/** ── IL FOGLIO DEL MODULO ───────────────────────────────────────────────────
 *  Il modulo di `/soluzioni` sale dal basso su telefono (sotto 1024: `Drawer`) ed entra di lato su computer
 *  (da 1024: `Sheet`, 480 px). Dentro c'è il `ModuloCorto` di sempre, con i testi della pagina: stesso lead,
 *  stesso calendario (solo-calendario, nello stesso foglio dopo l'invio).
 *
 *  - Fuoco sul Nome all'apertura; Esc chiude sempre; il velo e il trascinamento chiudono solo a modulo vuoto
 *    o già inviato (nessun dato perso con un gesto sbagliato); la X chiude sempre.
 *  - Il fuoco torna al bottone che l'ha aperto (`rientro`); la pagina sotto è `inert`; lo scorrimento è bloccato.
 *  - «Indietro» del telefono chiude il foglio: all'apertura si aggiunge una voce alla cronologia
 *    (`{ ...history.state, foglio: "modulo" }`, lo `state` del router resta); la X fa `history.back()` solo
 *    se la voce è nostra. Ogni chiusura passa da `chiudi`: una strada sola, mai due `back()`.
 *  - Un solo punto d'uscita verso la pagina: `onChiudi`. Chi monta il foglio imposta `rientro.current` col bottone
 *    toccato PRIMA di mettere `aperto` a vero.
 *  ───────────────────────────────────────────────────────────────────────── */
//  I ganci hanno nomi italiani fissati dal contratto («usa…», non «use…»): la regola non li riconosce, sono ganci veri.

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { Check, X } from "lucide-react";
import {
  Drawer,
  DrawerDescription,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetDescription,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
} from "@/components/ui/sheet";
import { ModuloCorto } from "@/landing/booking/ModuloCorto";
import type { Interesse } from "./regole";
import { traccia } from "@/landing/sito/traccia";
import { TESTI_SOLUZIONI, rassicurazioniPer } from "@/landing/testi-sito";
import { comportamentoScorrimento } from "./movimento";
import { segnaFoglio, usaComputer } from "./stato-pagina";

export interface FoglioModuloProps {
  aperto: boolean;
  interesse: Interesse;
  onChiudi: () => void;
  /** L'elemento a cui rendere il fuoco alla chiusura (il bottone da cui si è aperto). */
  rientro: RefObject<HTMLElement | null>;
}

const T = TESTI_SOLUZIONI.modulo;
const MARCATORE = { "data-foglio-modulo": "" } as const;

export function FoglioModulo({ aperto, interesse, onChiudi, rientro }: FoglioModuloProps) {
  const computer = usaComputer();
  const [haDati, setHaDati] = useState(false);
  const [inviato, setInviato] = useState(false);
  const contenuto = useRef<HTMLDivElement | null>(null);
  const alChiudi = useRef(onChiudi);
  //  Un secondo tocco sulla X prima che arrivi `popstate` non deve fare un secondo `back()` (si uscirebbe dalla pagina).
  const inChiusura = useRef(false);
  useEffect(() => {
    alChiudi.current = onChiudi;
  });
  const apribile = !haDati || inviato;

  //  Cronologia, stato della pagina, evento: all'apertura e alla chiusura, una volta.
  useEffect(() => {
    if (!aperto) return;
    inChiusura.current = false;
    if (window.history.state?.foglio !== "modulo")
      window.history.pushState({ ...window.history.state, foglio: "modulo" }, "");
    segnaFoglio(true);
    traccia("modulo_apri", { interesse });
    //  «Indietro»: la nostra voce è già sparita, si chiude e basta.
    const suIndietro = () => {
      if (window.history.state?.foglio !== "modulo") alChiudi.current();
    };
    window.addEventListener("popstate", suIndietro);
    return () => {
      window.removeEventListener("popstate", suIndietro);
      segnaFoglio(false);
      setHaDati(false);
      setInviato(false);
    };
  }, [aperto, interesse]);

  //  La pagina sotto è inert: tutto ciò che c'è nel body adesso, tranne il foglio (che nasce dopo, in un portale).
  useEffect(() => {
    if (!aperto) return;
    const toccati: HTMLElement[] = [];
    for (const el of Array.from(document.body.children)) {
      if (
        el instanceof HTMLElement &&
        !el.inert &&
        !el.matches("script, style, link") &&
        !el.querySelector("[data-foglio-modulo]")
      ) {
        el.inert = true;
        toccati.push(el);
      }
    }
    return () => toccati.forEach((el) => (el.inert = false));
  }, [aperto]);

  //  Ogni chiusura passa da qui. Con la voce di cronologia nostra, `back()` fa partire `popstate`, che chiude.
  const chiudi = useCallback(() => {
    if (inChiusura.current) return;
    inChiusura.current = true;
    if (window.history.state?.foglio === "modulo") window.history.back();
    else alChiudi.current();
  }, []);

  //  Il trascinamento (e il velo) non si fidano: con dati scritti e non inviati, Esc lo gestiamo noi.
  useEffect(() => {
    if (!aperto || computer || apribile) return;
    const suTasto = (e: KeyboardEvent) => {
      if (e.key === "Escape") chiudi();
    };
    document.addEventListener("keydown", suTasto);
    return () => document.removeEventListener("keydown", suTasto);
  }, [aperto, computer, apribile, chiudi]);

  const alFuoco = (e: React.FocusEvent) => {
    //  Tastiera aperta: il campo toccato resta in vista (oltre a `repositionInputs` di vaul).
    const campo = e.target as HTMLElement;
    if (campo.matches("input"))
      window.setTimeout(
        () => campo.scrollIntoView({ block: "center", behavior: comportamentoScorrimento() }),
        250,
      );
  };

  const apertura = (e: Event) => {
    e.preventDefault();
    const primo = contenuto.current?.querySelector<HTMLElement>(
      "#mc-nome, [role=status][tabindex]",
    );
    primo?.focus({ preventScroll: true });
  };
  const ritorno = (e: Event) => {
    e.preventDefault();
    rientro.current?.focus({ preventScroll: true });
  };

  const corpo = (
    <div ref={contenuto} className="flex min-h-0 flex-1 flex-col" onFocusCapture={alFuoco}>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-4 lg:p-0">
        <div className={inviato ? "sr-only" : "pr-11"}>
          {computer ? (
            <SheetTitle className="text-[22px] font-semibold leading-tight tracking-normal text-[#0A1430]">
              {T.titolo}
            </SheetTitle>
          ) : (
            <DrawerTitle className="text-[22px] font-semibold leading-tight tracking-normal text-[#0A1430]">
              {T.titolo}
            </DrawerTitle>
          )}
          {computer ? (
            <SheetDescription className="mt-2 text-[15px] leading-snug text-[#0A1430]">
              {T.rigaInteresse[interesse]}
            </SheetDescription>
          ) : (
            <DrawerDescription className="mt-2 text-[15px] leading-snug text-[#0A1430]">
              {T.rigaInteresse[interesse]}
            </DrawerDescription>
          )}
          {!inviato && (
            <ul className="mt-4 space-y-2 pb-5">
              {rassicurazioniPer(interesse).map((r) => (
                <li key={r} className="flex items-start gap-2.5 text-[15px] leading-snug">
                  <Check
                    className="mt-0.5 h-4 w-4 shrink-0 text-[#0B5FB0]"
                    strokeWidth={2.5}
                    aria-hidden="true"
                  />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <ModuloCorto
          origine="consulenza"
          punto="soluzioni"
          problemaObbligatorio={false}
          titolo={T.titolo}
          interesse={interesse}
          testi={T}
          mostraProblema={false}
          mostraTitolo={false}
          ancora={null}
          onStato={(s) => {
            setHaDati(s.haDati);
            setInviato(s.inviato);
          }}
        />
      </div>
    </div>
  );

  const bottoneX = (
    <button
      type="button"
      onClick={chiudi}
      aria-label={T.chiudi}
      className="absolute right-2 top-2 z-10 flex h-11 w-11 items-center justify-center rounded-lg text-[#0A1430] hover:bg-[#0A1430]/5 lg:right-3 lg:top-3"
    >
      <X className="h-5 w-5" aria-hidden="true" />
    </button>
  );

  if (computer) {
    return (
      <Sheet open={aperto} onOpenChange={(o) => !o && chiudi()}>
        <SheetPortal>
          <SheetOverlay className="bg-[#0A1430]/60 data-[state=closed]:duration-200 data-[state=open]:duration-200" />
          <SheetPrimitive.Content
            {...MARCATORE}
            onOpenAutoFocus={apertura}
            onCloseAutoFocus={ritorno}
            onPointerDownOutside={(e) => !apribile && e.preventDefault()}
            className="tema-soluzioni fixed inset-y-0 right-0 z-50 flex h-full w-[480px] max-w-full flex-col bg-white p-10 text-[#0A1430] shadow-xl outline-none [--sol-fuoco:#0A1430] data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right data-[state=closed]:duration-200 data-[state=open]:duration-[280ms]"
          >
            {bottoneX}
            {corpo}
          </SheetPrimitive.Content>
        </SheetPortal>
      </Sheet>
    );
  }

  return (
    <Drawer
      open={aperto}
      onOpenChange={(o) => !o && chiudi()}
      dismissible={apribile}
      repositionInputs
      shouldScaleBackground={false}
    >
      <DrawerPortal>
        <DrawerOverlay className="bg-[#0A1430]/60 [animation-duration:200ms]!" />
        <DrawerPrimitive.Content
          {...MARCATORE}
          onOpenAutoFocus={apertura}
          onCloseAutoFocus={ritorno}
          className="tema-soluzioni fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-2xl bg-white text-[#0A1430] outline-none [--sol-fuoco:#0A1430] [animation-duration:280ms]!"
        >
          <div
            aria-hidden="true"
            className="mx-auto mt-3 h-1 w-9 shrink-0 rounded-full bg-[#0A1430]/20"
          />
          {bottoneX}
          {corpo}
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </Drawer>
  );
}
