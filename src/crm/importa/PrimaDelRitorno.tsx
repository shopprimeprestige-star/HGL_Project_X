/** ── «PRIMA: …» SOTTO LO STATO (30/10/2026) ────────────────────────────────
 *  Richiesta del titolare: chi torna passa da solo in «Attesa WhatsApp»; sotto
 *  lo stato, in piccolo, si legge quello che aveva prima («prima: Non
 *  interessato»), con l'icona del ritorno. La regola è `primaDelRitorno`
 *  (crm/chatwa/ritorno, provata): niente da mostrare = niente nel DOM, così la
 *  riga non si alza per chi non è di ritorno.
 *  `icona={false}` dove l'icona ↩ c'è già accanto allo stato (riga della chat). */
import { Undo2 } from "lucide-react";
import { primaDelRitorno } from "@/crm/chatwa/ritorno";
import { cn } from "@/lib/utils";
import type { LeadData } from "@/crm/types";

export function PrimaDelRitorno({
  dati,
  icona = true,
  className,
}: {
  dati?: Partial<LeadData> | null;
  icona?: boolean;
  className?: string;
}) {
  const prima = primaDelRitorno(dati);
  if (!prima) return null;
  return (
    <span
      className={cn(
        "inline-flex min-w-0 max-w-full items-center gap-1 text-[11px] font-normal leading-4 text-muted-foreground",
        className,
      )}
      title={`Di ritorno: prima era «${prima}»`}
    >
      {icona && <Undo2 aria-hidden="true" className="h-3 w-3 shrink-0 text-amber-600" />}
      <span className="truncate">prima: {prima}</span>
    </span>
  );
}
