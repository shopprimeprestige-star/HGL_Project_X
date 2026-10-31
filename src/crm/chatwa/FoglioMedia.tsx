import { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Eye, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  ETICHETTE_TIMER,
  scadenzaInParole,
  type Categoria,
  type ScelteTimer,
} from "./usaMediaPonte";

/** ── IL FOGLIO DEL MEDIA (commessa 2026-10-31-media-e-archiviazione, T8, PIANO c.2) ─
 *  Si apre con la pressione lunga su un media del ponte (o con la freccia al passaggio del mouse):
 *  dal telefono è un foglio dal basso, dal computer una finestra compatta. Tre cose, nell'ordine:
 *   · Mostra (segnaposto o file liberato) o Apri (documento pronto);
 *   · il timer: Tieni sempre, 5 minuti, 1 ora, 24 ore, 7 giorni, 30 giorni (per «Mostra» si sceglie
 *     prima, di serie Tieni sempre; su un file già pronto la scelta vale subito) e, su un file pronto,
 *     «Elimina ora» (resta il segnaposto);
 *   · Rispiega con AI (la selezione di sempre), se la bolla la offre.
 *  ⚠️ I testi sono per il titolare, senza parole tecniche. Niente indirizzi: il foglio non vede mai
 *   un indirizzo firmato. */

export type ModoFoglio = "mostra" | "pronta" | "solo";

const NOME_TIPO: Record<Categoria, string> = {
  foto: "Foto",
  audio: "Vocale",
  video: "Video",
  documento: "Documento",
};
const TIPO_IN_ITALIANO: Record<Categoria, string> = {
  foto: "la foto",
  audio: "il vocale",
  video: "il video",
  documento: "il documento",
};

export interface PropsCorpoFoglio {
  modo: ModoFoglio;
  categoria: Categoria;
  /** La scadenza attuale (file pronto): evidenzia «Tieni sempre» se manca e dice quando si elimina. */
  scadeIl: string | null;
  onMostra: (timer: ScelteTimer) => void;
  onTimer: (timer: ScelteTimer) => void;
  onElimina: () => void;
  /** Documento pronto: lo apre in una nuova scheda. */
  onApri?: () => void;
  /** Se c'è, la voce «Rispiega con AI». */
  onRispiega?: () => void;
  /** Un'azione precedente è fallita: la frase resta nel foglio. */
  errore?: string | null;
  adesso?: number;
}

/** Il contenuto del foglio (senza il contenitore: così si prova e si riusa nei due formati). */
export function CorpoFoglio(p: PropsCorpoFoglio) {
  const [scelto, setScelto] = useState<ScelteTimer>("tieni");
  const [conferma, setConferma] = useState(false);
  const attuale: ScelteTimer | null = p.modo === "mostra" ? scelto : p.scadeIl ? null : "tieni";
  const quando = p.modo === "pronta" ? scadenzaInParole(p.scadeIl, p.adesso ?? Date.now()) : null;
  const voce =
    "flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 text-left text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <div className="flex flex-col gap-4">
      {p.modo === "mostra" && (
        <Button
          type="button"
          onClick={() => p.onMostra(scelto)}
          className="min-h-11 w-full gap-2 text-[14px]"
        >
          <Eye className="h-4 w-4" aria-hidden />
          Mostra {TIPO_IN_ITALIANO[p.categoria]}
        </Button>
      )}
      {p.modo === "pronta" && p.onApri && (
        <Button type="button" onClick={p.onApri} className="min-h-11 w-full gap-2 text-[14px]">
          <ExternalLink className="h-4 w-4" aria-hidden />
          Apri
        </Button>
      )}
      {p.modo !== "solo" && (
        <section aria-labelledby="titolo-timer" className="flex flex-col gap-1">
          <h3 id="titolo-timer" className="px-3 text-[12px] font-medium text-muted-foreground">
            {p.modo === "mostra" ? "Poi eliminalo dal CRM" : "Eliminalo dal CRM"}
          </h3>
          <div role="radiogroup" aria-labelledby="titolo-timer" className="flex flex-col">
            {ETICHETTE_TIMER.map((t) => {
              const sel = attuale === t.valore;
              return (
                <button
                  key={String(t.valore)}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  onClick={() => (p.modo === "mostra" ? setScelto(t.valore) : p.onTimer(t.valore))}
                  className={cn(voce, sel ? "bg-accent text-foreground" : "hover:bg-accent/60")}
                >
                  <Check
                    className={cn("h-4 w-4 shrink-0", sel ? "opacity-100" : "opacity-0")}
                    aria-hidden
                  />
                  {t.etichetta}
                </button>
              );
            })}
          </div>
          {quando && <p className="px-3 pt-1 text-[12.5px] text-muted-foreground">{quando}</p>}
        </section>
      )}
      {p.modo === "pronta" &&
        (conferma ? (
          <div className="flex flex-col gap-2 rounded-md border border-destructive/30 p-3">
            <p className="text-[13px]">
              Elimino {TIPO_IN_ITALIANO[p.categoria]}? Resta solo il segnaposto.
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="destructive"
                onClick={p.onElimina}
                className="min-h-11 flex-1 text-[13px]"
              >
                Sì, elimina
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConferma(false)}
                className="min-h-11 flex-1 text-[13px]"
              >
                No
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConferma(true)}
            className={cn(voce, "text-destructive hover:bg-destructive/10")}
          >
            <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
            Elimina ora
          </button>
        ))}
      {p.errore && (
        <p role="status" className="px-3 text-[12.5px] text-destructive">
          {p.errore}
        </p>
      )}
      {p.onRispiega && (
        <button
          type="button"
          onClick={p.onRispiega}
          className={cn(voce, "border-t border-border pt-0 hover:bg-accent/60")}
        >
          <Sparkles className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
          Rispiega con AI
        </button>
      )}
    </div>
  );
}

export interface PropsFoglio extends PropsCorpoFoglio {
  aperto: boolean;
  onApertoCambia: (aperto: boolean) => void;
}

/** Dov'è il dito (o il mouse) adesso, per tutta la pagina: serve a capire se il foglio si è aperto sotto un dito ancora giù. */
let puntatoreGiu = false;
let tracciaInstallata = false;
function installaTracciaPuntatore() {
  if (tracciaInstallata || typeof document === "undefined") return;
  tracciaInstallata = true;
  document.addEventListener("pointerdown", () => (puntatoreGiu = true), true);
  const su = () => {
    puntatoreGiu = false;
  };
  document.addEventListener("pointerup", su, true);
  document.addEventListener("pointercancel", su, true);
}

/** Il foglio: dal basso sul telefono, finestra compatta dal computer. */
export function FoglioMedia({ aperto, onApertoCambia, ...corpo }: PropsFoglio) {
  const telefono = useIsMobile();
  //  Il foglio si apre mentre il dito è ancora giù (pressione lunga): il rilascio può generare un click
  //  che cade fuori dal foglio (con il tocco Radix chiude sul click, non sul primo contatto) o sulla voce
  //  che ci sta sotto il dito. Quel click non vale: ~450 ms dall'apertura e, se il dito era giù
  //  all'apertura, ~450 ms dal suo rilascio. Un tocco vero dopo non è toccato.
  const apertoAlle = useRef(0);
  const giuAllApertura = useRef(false);
  useEffect(installaTracciaPuntatore, []);
  if (aperto && apertoAlle.current === 0) {
    apertoAlle.current = Date.now();
    giuAllApertura.current = puntatoreGiu;
  }
  if (!aperto) apertoAlle.current = 0;
  const rilasciatoAlle = useRef(0);
  useEffect(() => {
    rilasciatoAlle.current = 0;
    if (!aperto || !giuAllApertura.current) return;
    //  Il primo rilascio dopo l'apertura è quello del gesto che l'ha aperto.
    const su = () => {
      rilasciatoAlle.current = Date.now();
    };
    document.addEventListener("pointerup", su, { capture: true, once: true });
    document.addEventListener("pointercancel", su, { capture: true, once: true });
    return () => {
      document.removeEventListener("pointerup", su, true);
      document.removeEventListener("pointercancel", su, true);
    };
  }, [aperto]);
  /** Troppo presto per fidarsi di un tocco. */
  const troppoPresto = () => {
    const ora = Date.now();
    const dopoApertura = ora - apertoAlle.current;
    if (dopoApertura < 450) return true;
    if (!giuAllApertura.current) return false;
    //  Dito ancora giù (rilascio non visto): niente click vale, ma non per sempre.
    if (rilasciatoAlle.current === 0) return dopoApertura < 5000;
    return ora - rilasciatoAlle.current < 450;
  };
  const nonSubito = (e: Event) => {
    if (troppoPresto()) e.preventDefault();
  };
  //  Il foglio si apre SOTTO il dito (dal basso): il click del rilascio non deve premere la voce che ci sta sotto.
  const dentroProtetto = aperto ? (
    <div
      className="text-foreground"
      onClickCapture={(e) => {
        if (troppoPresto()) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <CorpoFoglio {...corpo} />
    </div>
  ) : null;
  const titolo = NOME_TIPO[corpo.categoria];
  const descrizione = "Cosa fare con questo file";
  // Il corpo si rimonta a ogni apertura: la scelta del timer e la conferma ripartono da zero.
  if (telefono) {
    return (
      <Sheet open={aperto} onOpenChange={onApertoCambia}>
        <SheetContent
          side="bottom"
          onInteractOutside={nonSubito}
          className="max-h-[85dvh] overflow-y-auto rounded-t-2xl px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"
        >
          <SheetHeader className="px-3 pb-2 text-left">
            <SheetTitle className="text-[16px]">{titolo}</SheetTitle>
            <SheetDescription className="sr-only">{descrizione}</SheetDescription>
          </SheetHeader>
          {dentroProtetto}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={aperto} onOpenChange={onApertoCambia}>
      <DialogContent className="max-w-sm gap-3 p-4" onInteractOutside={nonSubito}>
        <DialogHeader className="px-3 text-left">
          <DialogTitle className="text-[16px]">{titolo}</DialogTitle>
          <DialogDescription className="sr-only">{descrizione}</DialogDescription>
        </DialogHeader>
        {dentroProtetto}
      </DialogContent>
    </Dialog>
  );
}
