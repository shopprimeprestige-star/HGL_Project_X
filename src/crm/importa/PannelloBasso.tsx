/** ── UN PANNELLO CHE SUL TELEFONO SI APRE DAL BASSO ────────────────────────
 *
 *  Commessa 2026-10-28 «Lead importati semplice». «Filtra» e «Altro» hanno lo
 *  stesso contenitore: sul telefono (sotto i 768 px) un foglio che sale dal
 *  basso, sotto il pollice; sul computer un riquadro attaccato al suo tasto.
 *  Il contenuto è lo stesso nei due casi.
 *
 *  ⚠️ UN FOGLIO NON FERMA LE SCORCIATOIE. `useScorciatoie` (crm/ui) tace solo se
 *   c'è un contenuto di Radix «ancorato» (menu e riquadri: hanno
 *   `data-radix-popper-content-wrapper`); un foglio è un Dialog e quell'attributo
 *   non ce l'ha. Perciò chi usa questo pannello tiene lo stato `aperto` NELLA
 *   PAGINA e lo mette in `bloccato` di `useScorciatoie`: un «1» battuto con
 *   «Filtra» aperto non deve segnare «Non risponde» a nessuno. `ui.tsx` non si
 *   tocca (lo usano altre cinque pagine).
 *  ⚠️ Il tasto di chiusura di `SheetContent` è 16 px: si nasconde e se ne mette
 *   uno da 44 px dentro l'intestazione.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function PannelloBasso({
  aperto,
  onCambio,
  titolo,
  descrizione,
  trigger,
  larghezza = "w-80",
  children,
}: {
  aperto: boolean;
  onCambio: (aperto: boolean) => void;
  titolo: string;
  /** Per chi legge con lo schermo: cosa c'è dentro. */
  descrizione?: string;
  /** Il tasto che lo apre: un solo elemento. */
  trigger: ReactNode;
  /** Larghezza del riquadro sul computer (classe Tailwind). */
  larghezza?: string;
  children: ReactNode;
}) {
  const telefono = useIsMobile();
  if (telefono) {
    return (
      <Sheet open={aperto} onOpenChange={onCambio}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] gap-0 overflow-y-auto rounded-t-2xl p-0 [&>button]:hidden"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4">
            <SheetTitle className="text-[15px] font-semibold">{titolo}</SheetTitle>
            <SheetClose
              className="-mr-3 flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
              aria-label="Chiudi"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </SheetClose>
          </div>
          <SheetDescription className="sr-only">{descrizione ?? titolo}</SheetDescription>
          <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open={aperto} onOpenChange={onCambio}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className={cn("max-h-[75vh] overflow-y-auto p-3", larghezza)}>
        <div className="mb-2 text-[13px] font-semibold">{titolo}</div>
        {children}
      </PopoverContent>
    </Popover>
  );
}
