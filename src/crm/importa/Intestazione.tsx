/** ── L'INTESTAZIONE: UNA RIGA SOLA ─────────────────────────────────────────
 *
 *  Commessa 2026-10-28 «Lead importati semplice». Titolo, Cerca, Altro. Il
 *  campo Cerca resta SEMPRE fuori dal menu: serve nei secondi in cui il cliente
 *  richiama. Sul telefono è un'icona che apre il campo sotto la riga.
 *
 *  ⚠️ IL CAMPO È UNO SOLO (non uno nascosto col CSS): `RicercaContatto` tiene il
 *   riferimento che la scorciatoia «/» mette a fuoco, e due copie si
 *   contenderebbero lo stesso riferimento. Perciò si sceglie in JS quale
 *   disegnare (`useIsMobile`).
 *  ⚠️ Con il campo aperto sul telefono le scorciatoie 1…4, S, A tacciono: la
 *   pagina tiene `ricercaAperta` e la mette in `bloccato`. Scrivere «1» in un
 *   campo di testo è già sicuro (`useScorciatoie` tace dentro i campi), ma
 *   l'icona aperta e il campo vuoto senza fuoco no.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

export function Intestazione({
  ricerca,
  altro,
  ricercaAperta,
  onRicerca,
}: {
  /** Il campo di ricerca (`RicercaContatto`). */
  ricerca: ReactNode;
  /** Il tasto «Altro» col suo pannello. */
  altro: ReactNode;
  /** Solo telefono: il campo è aperto sotto la riga. */
  ricercaAperta: boolean;
  onRicerca: (aperta: boolean) => void;
}) {
  const telefono = useIsMobile();
  return (
    <header className="space-y-2">
      <div className="flex items-center gap-2 md:gap-3">
        <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold leading-tight tracking-[-0.02em] md:flex-none">
          Lead importati
        </h1>
        {!telefono && <div className="ml-auto min-w-0 flex-1 md:max-w-md">{ricerca}</div>}
        {telefono && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0"
            aria-label={ricercaAperta ? "Chiudi la ricerca" : "Cerca un contatto"}
            aria-expanded={ricercaAperta}
            onClick={() => onRicerca(!ricercaAperta)}
          >
            {ricercaAperta ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Search className="h-4 w-4" aria-hidden="true" />
            )}
          </Button>
        )}
        {altro}
      </div>
      {telefono && ricercaAperta && <div>{ricerca}</div>}
    </header>
  );
}
