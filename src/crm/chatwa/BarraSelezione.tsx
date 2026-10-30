import { CheckCheck, CheckCircle2, Loader2, Mail, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AzioneBlocco } from "./selezione";

/** Le azioni in blocco, nell'ordine in cui si leggono: prima le due «letto», poi le altre. */
const AZIONI: { v: AzioneBlocco; etichetta: string; Icona: typeof Mail }[] = [
  { v: "letto", etichetta: "Segna come letto", Icona: CheckCheck },
  { v: "da-leggere", etichetta: "Segna come da leggere", Icona: Mail },
  { v: "fatto", etichetta: "Fatto", Icona: CheckCircle2 },
  { v: "osservazione", etichetta: "In osservazione", Icona: Star },
];

interface BarraSelezioneProps {
  /** Le chat scelte che l'elenco mostra ancora. */
  quante: number;
  /** Tutte le visibili sono scelte? Il tasto allora toglie la selezione. */
  tutte: boolean;
  /** Un'azione è in corso: i tasti si fermano (niente doppio tocco). */
  inCorso: AzioneBlocco | null;
  onTutte: () => void;
  onAnnulla: () => void;
  onAzione: (a: AzioneBlocco) => void;
}

/** ── LA BARRA DELLA SELEZIONE (30/10/2026) ─────────────────────────────────
 *  Prende il posto del titolo «Chat» in cima all'elenco. Sopra: quante sono scelte,
 *  «Seleziona tutto» (le chat che si vedono) e «Annulla». Sotto: le azioni, in una fila
 *  che scorre di lato come le pastiglie dei filtri. Tutti i tocchi da 44 px sul telefono;
 *  dal computer si stringono. Niente colori nuovi: il verde è quello delle spunte. */
export function BarraSelezione({
  quante,
  tutte,
  inCorso,
  onTutte,
  onAnnulla,
  onAzione,
}: BarraSelezioneProps) {
  const occupata = inCorso !== null;
  return (
    <div className="border-b border-border bg-emerald-50/70">
      <div className="flex items-center gap-1 px-3 pt-2 md:px-2 md:pt-1.5">
        <p
          role="status"
          className="min-w-0 flex-1 truncate text-[17px] font-semibold text-foreground md:text-[13px]"
        >
          {quante === 0 ? "Nessuna selezionata" : `${quante} selezionat${quante === 1 ? "a" : "e"}`}
        </p>
        <button
          type="button"
          onClick={onTutte}
          disabled={occupata}
          className="inline-flex h-11 shrink-0 items-center rounded-md px-3 text-[14px] font-medium text-emerald-800 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:h-8 md:px-2 md:text-[12px]"
        >
          {tutte ? "Deseleziona tutto" : "Seleziona tutto"}
        </button>
        <button
          type="button"
          onClick={onAnnulla}
          disabled={occupata}
          className="inline-flex h-11 shrink-0 items-center gap-1 rounded-md px-3 text-[14px] font-medium text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:h-8 md:px-2 md:text-[12px]"
        >
          <X aria-hidden="true" className="h-4 w-4" />
          Annulla
        </button>
      </div>
      <div
        role="group"
        aria-label="Cosa fare con le chat scelte"
        className="flex gap-2 overflow-x-auto overscroll-x-contain px-3 pb-2 pt-1 [scrollbar-width:none] md:gap-1.5 md:px-2 [&::-webkit-scrollbar]:hidden"
      >
        {AZIONI.map(({ v, etichetta, Icona }) => (
          <button
            key={v}
            type="button"
            onClick={() => onAzione(v)}
            disabled={occupata || quante === 0}
            aria-busy={inCorso === v}
            className={cn(
              "inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-200 bg-background px-4 text-[14px] font-medium text-emerald-800 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 md:h-8 md:px-3 md:text-[12px]",
            )}
          >
            {inCorso === v ? (
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
            ) : (
              <Icona aria-hidden="true" className="h-4 w-4" />
            )}
            {etichetta}
          </button>
        ))}
      </div>
    </div>
  );
}
