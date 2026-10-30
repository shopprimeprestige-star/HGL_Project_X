/** ── «SCRIVI DAL TELEFONO»: IL FOGLIO CON IL CAMPO DI TESTO ──────────────────
 *
 *  Commessa 2026-10-30-ponte-invio-manuale, compito T4 (PIANO §4.2). A finestra
 *  chiusa, accanto a «Invia un modello»: si scrive a mano un testo libero che
 *  parte dal numero WhatsApp del titolare (passando dal Mac). Il foglio si apre
 *  dal basso come quello dei modelli; il contenuto è `FormScriviDalPonte`, a
 *  parte perché si disegna anche senza foglio (le prove).
 *
 *  ⚠️ Il testo ha una bozza PROPRIA (`useState` qui): non tocca `bozza` della
 *   casella, che resta conservata come oggi. La Casella monta questo foglio con
 *   `key` = numero della chat: cambiando chat si riparte da un campo vuoto.
 *  ⚠️ Campo a 16 px (iOS non ingrandisce la pagina), tasti da 44 px, nessun emoji
 *   (icone lucide). Il significato non sta nel solo colore.
 *  ⚠️ L'invio vero (rotta, chiave, rifiuti) è in `usaInvioPonte`: qui si mostra
 *   soltanto. Se il server rifiuta, la frase è già a schermo (toast) e il testo resta. */
import { useId, useRef, useState } from "react";
import { Loader2, Send, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { fraseMotivo } from "../ponte/invio";
import { LIMITI_INVIO, type ApiPonteInvio } from "../ponte/invio-tipi";

const L = LIMITI_INVIO;

/** I caratteri come li conta il server (punti di codice, non unità UTF-16: un emoji è uno). */
const lunghezza = (testo: string): number => [...testo].length;

export interface FormScriviDalPonteProps {
  api: ApiPonteInvio;
  testo: string;
  onTesto: (t: string) => void;
  /** Dopo un invio riuscito (il testo è già stato svuotato): il foglio si chiude. */
  onFatto: () => void;
  /** Per mettere il fuoco nel campo all'apertura. */
  areaRef?: React.Ref<HTMLTextAreaElement>;
}

/** Il campo, il contatore, la spiegazione e il tasto. */
export function FormScriviDalPonte({
  api,
  testo,
  onTesto,
  onFatto,
  areaRef,
}: FormScriviDalPonteProps) {
  const idSpiegazione = useId();
  const n = lunghezza(testo);
  const troppoLungo = n > L.caratteri;
  const puoInviare = api.puo.ok && !api.inviando && testo.trim() !== "" && !troppoLungo;

  const manda = async () => {
    if (!puoInviare) return;
    //  Se il server rifiuta, la frase è già a schermo e il testo resta nel campo.
    if (await api.invia(testo)) {
      onTesto("");
      onFatto();
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-3 overflow-y-auto px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      {!api.puo.ok && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[12.5px] leading-snug text-amber-900"
        >
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          {fraseMotivo(api.puo.motivo)}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <textarea
          ref={areaRef}
          value={testo}
          onChange={(e) => onTesto(e.target.value)}
          onKeyDown={(e) => {
            //  Invio va a capo (è un messaggio che si scrive con calma); Ctrl o Cmd + Invio manda.
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void manda();
            }
          }}
          rows={4}
          aria-label="Messaggio da mandare dal telefono"
          aria-describedby={idSpiegazione}
          aria-keyshortcuts="Control+Enter Meta+Enter"
          placeholder="Scrivi il messaggio"
          className={cn(
            "max-h-56 min-h-28 w-full resize-none rounded-lg border border-input bg-background px-3 py-2.5",
            //  16 px sul telefono: sotto, iOS ingrandisce la pagina al tocco.
            "text-base leading-6 text-foreground placeholder:text-muted-foreground [field-sizing:content] md:text-[14px] md:leading-5",
            "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          )}
        />
        <p
          className={cn(
            "text-right text-[11.5px] tabular-nums",
            troppoLungo ? "font-semibold text-destructive" : "text-muted-foreground",
          )}
        >
          {`${n}/${L.caratteri}${troppoLungo ? " · troppo lungo" : ""}`}
        </p>
      </div>
      <div
        id={idSpiegazione}
        className="flex flex-col gap-1 text-[12.5px] leading-snug text-muted-foreground"
      >
        <p>Parte dal tuo numero WhatsApp, di solito entro circa un minuto.</p>
        <p>
          {`Per non rischiare il blocco del numero: un messaggio ogni ${L.intervalloS} secondi e al massimo ${L.alGiorno} al giorno. Solo testo, scritto a mano, a chi ti ha già scritto.`}
        </p>
      </div>
      <Button
        type="button"
        onClick={() => void manda()}
        disabled={!puoInviare}
        className="min-h-11 w-full gap-2 bg-emerald-500 text-[13px] text-white hover:bg-emerald-600 sm:ml-auto sm:w-auto"
      >
        {api.inviando ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            Metto in coda…
          </>
        ) : (
          <>
            <Send aria-hidden />
            Invia dal telefono
          </>
        )}
      </Button>
    </div>
  );
}

export interface ScriviDalPonteProps {
  api: ApiPonteInvio;
  aperto: boolean;
  onAperto: (aperto: boolean) => void;
}

/** Il foglio dal basso. Da tablet in su una colonna centrata, come quello dei modelli. */
export function ScriviDalPonte({ api, aperto, onAperto }: ScriviDalPonteProps) {
  const [testo, setTesto] = useState("");
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  return (
    <Sheet open={aperto} onOpenChange={onAperto}>
      {/* La X di serie è piccola: la sostituisce il tasto «Chiudi» da 44 px. All'apertura il
          fuoco va nel campo (di serie andrebbe a «Chiudi»). */}
      <SheetContent
        side="bottom"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          areaRef.current?.focus({ preventScroll: true });
        }}
        className="mx-auto flex max-h-[85dvh] w-full flex-col gap-0 rounded-t-xl p-0 sm:max-w-lg [&>button]:hidden"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5">
          <SheetTitle className="text-[15px]">Scrivi dal telefono</SheetTitle>
          <SheetClose asChild>
            <Button type="button" variant="ghost" className="min-h-11 text-[13px]">
              Chiudi
            </Button>
          </SheetClose>
        </div>
        <SheetDescription className="sr-only">
          Scrivi un messaggio libero: parte dal tuo numero WhatsApp, passando dal telefono.
        </SheetDescription>
        <FormScriviDalPonte
          api={api}
          testo={testo}
          onTesto={setTesto}
          onFatto={() => onAperto(false)}
          areaRef={areaRef}
        />
      </SheetContent>
    </Sheet>
  );
}
