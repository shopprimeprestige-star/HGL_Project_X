/** ── LA SPIEGAZIONE «CHE COS'È INVISIBLE DERM?» CHE SI APRE SUL POSTO (landing v3, 4.3) ───────────────
 *  Il pannello è già nell'HTML del server (per Google e per la ricerca nella pagina) ma chiuso:
 *  `hidden="until-found"` (con ripiego `hidden`), e finché è chiuso NON c'è nessun video né indirizzo di video nel DOM.
 *  Si apre dal bottone della cella 03 (animazione di 240 ms), da `?apri=invisible-derm` (il server lo disegna già
 *  aperto), da `#invisible-derm` e dalla ricerca nella pagina (`beforematch`): questi ultimi senza animazione.
 *  Aprire scrive `#invisible-derm` con `replaceState` (nessuna voce nuova nella cronologia); chiudere lo toglie.
 *  La macchina dell'apertura sta nel gancio `usaSpiegazione`, perché la comandano due pezzi: il bottone nella
 *  cella 03 (in `TavolaSoluzioni`) e il pannello qui sotto. */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { Clock, Ruler, Wrench } from "lucide-react";
import { TESTI_SOLUZIONI as T } from "@/landing/testi-sito";
import { fraseSemaforo, type VistaSoluzioni } from "./ponte";
import { BottonePrimario, ClipLoop, LinkAzione, VideoParlato } from "./ponte-ui";
import { segnaVideo } from "./stato-pagina";
import { tracciaSoluzioni } from "./traccia-soluzioni";
import { ANTON, INTER, STILE_CHIARO } from "./stile";
import { ID_CELLA, ID_SPIEGAZIONE } from "./TavolaSoluzioni";
import type { AlPrenotare } from "./Testata";

export const ID_TITOLO = "titolo-invisible-derm";
const HASH = `#${ID_CELLA}`;
export type OrigineApertura = "tocco" | "link" | "ricerca";

export interface StatoSpiegazione {
  /** Lo stato che si vede (apre/chiude l'animazione). */
  aperta: boolean;
  /** Il pannello è disegnato (senza `hidden`): resta così fino alla fine dell'animazione di chiusura. */
  montata: boolean;
  apri: (origine: OrigineApertura, animato?: boolean) => void;
  chiudi: () => void;
  alterna: () => void;
  bottoneRef: RefObject<HTMLElement | null>;
  cellaRef: RefObject<HTMLLIElement | null>;
  titoloRef: RefObject<HTMLHeadingElement | null>;
}

const ridotto = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Cambia solo l'ancora dell'indirizzo, senza voci nuove nella cronologia e conservando lo stato del router. */
function scriviAncora(presente: boolean) {
  try {
    const { pathname, search, hash } = window.location;
    if ((hash === HASH) === presente) return;
    window.history.replaceState(window.history.state, "", pathname + search + (presente ? HASH : ""));
  } catch {
    // l'indirizzo resta com'è: la pagina funziona lo stesso
  }
}

export function usaSpiegazione(apertaDalServer: boolean): StatoSpiegazione {
  const [aperta, setAperta] = useState(apertaDalServer);
  const [montata, setMontata] = useState(apertaDalServer);
  //  Lo stato «logico» cambia subito; quello che si vede (`aperta`) dopo un disegno, per far partire l'animazione.
  const logica = useRef(apertaDalServer);
  const bottoneRef = useRef<HTMLElement>(null);
  const cellaRef = useRef<HTMLLIElement>(null);
  const titoloRef = useRef<HTMLHeadingElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const contataDalServer = useRef(false);

  const apri = useCallback((origine: OrigineApertura, animato = true) => {
    if (logica.current) return;
    logica.current = true;
    clearTimeout(timer.current);
    const senzaMoto = !animato || ridotto();
    setMontata(true);
    if (senzaMoto) setAperta(true);
    else requestAnimationFrame(() => requestAnimationFrame(() => setAperta(true)));
    scriviAncora(true);
    tracciaSoluzioni("invisible_apri", { origine });
    //  Dalla ricerca nella pagina il browser ha già portato a schermo il testo trovato: non si sposta niente.
    if (origine === "ricerca") return;
    timer.current = setTimeout(() => {
      const titolo = titoloRef.current;
      if (!titolo) return;
      titolo.scrollIntoView({ block: "start", behavior: senzaMoto ? "auto" : "smooth" });
      //  Il fuoco va al titolo solo se è stata una persona ad aprire; da un link la pagina non si muove da sola.
      if (origine === "tocco") titolo.focus({ preventScroll: true });
    //  240 ms di animazione + i due disegni prima che parta: scorrere prima della fine si fermerebbe a metà (la pagina è ancora bassa).
    }, senzaMoto ? 0 : 320);
  }, []);

  const chiudi = useCallback(() => {
    if (!logica.current) return;
    logica.current = false;
    clearTimeout(timer.current);
    const senzaMoto = ridotto();
    setAperta(false);
    //  Se il video girava, la barra delle patch deve tornare anche se il video si smonta senza dirlo.
    segnaVideo(false);
    scriviAncora(false);
    bottoneRef.current?.focus({ preventScroll: true });
    timer.current = setTimeout(
      () => {
        setMontata(false);
        //  Chi chiude ritrova le tre soluzioni: la cella 03 torna a schermo.
        requestAnimationFrame(() => cellaRef.current?.scrollIntoView({ block: "nearest", behavior: senzaMoto ? "auto" : "smooth" }));
      },
      senzaMoto ? 0 : 200,
    );
  }, []);

  const alterna = useCallback(() => (logica.current ? chiudi() : apri("tocco")), [apri, chiudi]);

  useEffect(() => {
    if (apertaDalServer) {
      if (!contataDalServer.current) {
        contataDalServer.current = true;
        tracciaSoluzioni("invisible_apri", { origine: "link" });
      }
    } else if (window.location.hash === HASH) {
      apri("link", false);
    }
    const suCambioAncora = () => {
      if (window.location.hash === HASH) apri("link", false);
    };
    window.addEventListener("hashchange", suCambioAncora);
    return () => {
      window.removeEventListener("hashchange", suCambioAncora);
      clearTimeout(timer.current);
    };
  }, [apri, apertaDalServer]);

  return { aperta, montata, apri, chiudi, alterna, bottoneRef, cellaRef, titoloRef };
}

/** La riga a contorno tratteggiato dell'anteprima del CRM. Mai sul sito. */
function RigaAnteprima({ children }: { children: ReactNode }) {
  return (
    <p className={`${INTER} rounded-lg border-2 border-dashed border-[var(--hgl-elettrico-su-chiaro,#0B5FB0)] p-4 text-[15px] font-medium leading-snug text-[var(--hgl-notte,#0A1430)]`}>
      {children}
    </p>
  );
}

const ICONE = { cose: Ruler, come: Clock, limite: Wrench } as const;
const E = T.spiegazione;

export function SpiegazioneInvisible({
  stato,
  vista,
  onPrenota,
  priorita,
}: {
  stato: StatoSpiegazione;
  vista: VistaSoluzioni;
  onPrenota: AlPrenotare;
  /** Aperta dal server: la copertina del video si carica subito. */
  priorita: boolean;
}) {
  const { aperta, montata, apri, chiudi, titoloRef } = stato;
  const sezione = useRef<HTMLElement>(null);

  //  La ricerca nella pagina trova il testo nel pannello chiuso: il browser lo scopre e ci avvisa con `beforematch`.
  useEffect(() => {
    const el = sezione.current;
    if (!el) return;
    const suTrovato = () => apri("ricerca", false);
    el.addEventListener("beforematch", suTrovato);
    return () => el.removeEventListener("beforematch", suTrovato);
  }, [apri]);

  //  ⚠️ React 19.2 non conosce `hidden="until-found"`: dal booleano scrive `hidden=""`, cioè display:none, e la ricerca nella
  //  pagina non vedrebbe il testo. La parola giusta la scrive questo effetto dopo ogni disegno a pannello chiuso. Nei browser che
  //  non la conoscono (Firefox) un valore sconosciuto vale `hidden`: il ripiego è già quello giusto. Aperto, React toglie l'attributo.
  useLayoutEffect(() => {
    if (!montata) sezione.current?.setAttribute("hidden", "until-found");
  }, [montata]);

  const suTasto = (e: KeyboardEvent<HTMLElement>) => {
    //  Esc chiude, tranne a schermo intero: lì serve al video per uscirne.
    if (e.key !== "Escape" || e.defaultPrevented || document.fullscreenElement) return;
    e.stopPropagation();
    chiudi();
  };

  const conMacro = !!vista.macro;
  const rigaAnteprima = vista.anteprima && !vista.pubblicabile;

  return (
    <section
      ref={sezione}
      id={ID_SPIEGAZIONE}
      aria-labelledby={ID_TITOLO}
      hidden={!montata}
      onKeyDown={suTasto}
      style={STILE_CHIARO}
      className={`${INTER} relative -mx-5 text-[var(--hgl-notte,#0A1430)] lg:mx-0`}
    >
      {/* Il triangolo che lega il foglio alla sua cella (la 03 è la terza colonna): solo da 1024. */}
      <span
        aria-hidden="true"
        className="absolute -top-2 left-[calc(100%*5/6-8px)] hidden size-0 border-x-8 border-b-8 border-x-transparent border-b-[var(--hgl-chiaro,#EEF2FF)] lg:block"
      />
      <div
        className={`grid ease-[cubic-bezier(0.2,0.8,0.2,1)] transition-[grid-template-rows] motion-reduce:transition-none ${
          aperta ? "grid-rows-[1fr] duration-[240ms]" : "grid-rows-[0fr] duration-200"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className={`px-5 pb-10 pt-8 transition-[opacity,transform] motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none lg:grid lg:grid-cols-12 lg:gap-x-10 lg:px-8 lg:py-10 ${
              aperta ? "translate-y-0 opacity-100 duration-[180ms]" : "translate-y-2 opacity-0 duration-150"
            }`}
          >
            <h2
              ref={titoloRef}
              id={ID_TITOLO}
              tabIndex={-1}
              className={`${ANTON} scroll-mt-4 text-[28px] leading-none lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:scroll-mt-[60px] lg:text-[44px]`}
            >
              {E.titolo}
            </h2>
            <p className="mt-4 text-lg font-medium leading-snug lg:col-span-7 lg:col-start-6 lg:row-start-2 lg:max-w-[52ch] lg:text-xl">{E.primaRiga}</p>

            {/* Il video del titolare (4:5). Chiuso, non c'è: nessun file si scarica prima del tocco sul bottone. */}
            <div className="mt-6 space-y-3 lg:col-span-5 lg:col-start-1 lg:row-span-4 lg:row-start-1 lg:mt-0">
              {rigaAnteprima && vista.video ? <RigaAnteprima>{`Anteprima. ${fraseSemaforo(vista.mancanti)}.`}</RigaAnteprima> : null}
              {!vista.video && vista.anteprima ? <RigaAnteprima>{E.anteprima.senzaVideo}</RigaAnteprima> : null}
              {montata && vista.video ? (
                <VideoParlato slot={vista.video.slot} formato="4:5" testi={E.video} trascrizione={vista.video.trascrizione} priorita={priorita} />
              ) : null}
            </div>

            {/* La macro (la clip) e le righe: la clip, se manca, non lascia buchi. */}
            <div className="mt-8 lg:col-span-7 lg:col-start-6 lg:row-start-3 lg:mt-6 lg:grid lg:grid-cols-7 lg:gap-x-6">
              {montata && vista.macro ? (
                <div className="mb-6 w-[60%] lg:col-span-3 lg:mb-0 lg:w-full">
                  <ClipLoop
                    slot={vista.macro}
                    formato="4:5"
                    descrizione={vista.macro.alt}
                    didascalia={E.macro.didascalia}
                    etichette={{ ferma: E.macro.ferma, riparti: E.macro.riparti }}
                  />
                </div>
              ) : null}
              <div className={conMacro ? "lg:col-span-4" : "lg:col-span-7"}>
                <ul className="space-y-4">
                  {E.righe.map((r) => {
                    const Icona = ICONE[r.id as keyof typeof ICONE];
                    const limite = r.id === "limite";
                    return (
                      <li
                        key={r.id}
                        className={`flex gap-3 ${limite ? "border-l-2 border-[var(--hgl-notte,#0A1430)] bg-[var(--hgl-carta,#FFFFFF)] py-3 pl-4 pr-3" : ""}`}
                      >
                        <Icona aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[var(--hgl-elettrico-su-chiaro,#0B5FB0)]" />
                        <p className="text-[17px] leading-[1.55] lg:text-lg">
                          <strong className="font-semibold">{r.titolo}</strong> {r.testo}
                        </p>
                      </li>
                    );
                  })}
                </ul>
                <ul className="mt-5 space-y-3 border-t border-[var(--hgl-notte,#0A1430)]/15 pt-4">
                  {E.piccole.map((r) => (
                    <li key={r.id} className="text-[15px] leading-[1.5]">
                      <strong className="font-semibold">{r.titolo}</strong> {r.testo}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Il passo: dopo il limite, mai prima. Il bottone blu qui sostituisce quello sotto la tavola. */}
            <div className="mt-8 lg:col-span-7 lg:col-start-6 lg:row-start-4 lg:mt-6">
              <BottonePrimario
                onClick={(e) => onPrenota("invisible-derm", e.currentTarget)}
                className="w-full border border-[var(--hgl-elettrico-su-chiaro,#0B5FB0)] lg:w-[360px]"
              >
                {E.passo.bottone}
              </BottonePrimario>
              <p className="mt-3 text-sm font-medium leading-snug">{E.passo.riga}</p>
              <LinkAzione
                onClick={chiudi}
                className="mt-4 inline-flex min-h-11 items-center text-base font-semibold underline decoration-2 underline-offset-4 decoration-[var(--hgl-elettrico-su-chiaro,#0B5FB0)]"
              >
                {E.passo.chiudi}
              </LinkAzione>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
