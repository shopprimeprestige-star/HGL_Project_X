/** ── «SOLO BLOCCO ORARIO»: LA SPUNTA E L'ETICHETTA ────────────────────────────
 *  Due pezzi piccoli, uguali ovunque si fissa o si vede un meet. La regola (che
 *  cosa esclude dai numeri) sta in crm/conta-nei-kpi; qui c'è solo il disegno. */
import { useId } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { ETICHETTA_BLOCCO, TESTO_SOLO_BLOCCO, eSoloBlocco, type ConSoloBlocco } from "@/crm/conta-nei-kpi";

/** La spunta. Spenta di base: chi non la tocca ottiene una consulenza vera. */
export function SpuntaSoloBlocco({
  acceso,
  onCambia,
  disabilitata,
  className,
}: {
  acceso?: boolean;
  onCambia: (acceso: boolean) => void;
  disabilitata?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <Checkbox
        id={id}
        checked={!!acceso}
        disabled={disabilitata}
        onCheckedChange={(v) => onCambia(v === true)}
        className="mt-0.5"
      />
      <label htmlFor={id} className="cursor-pointer text-[12px] leading-snug text-slate-600">
        {TESTO_SOLO_BLOCCO}
      </label>
    </div>
  );
}

/** La piccola etichetta grigia: nessuno deve scambiare un blocco per una consulenza. */
export function EtichettaBlocco({ className }: { className?: string }) {
  return (
    <span
      title={TESTO_SOLO_BLOCCO}
      className={cn(
        "inline-flex shrink-0 items-center rounded bg-slate-200 px-1.5 py-0 text-[10px] font-medium leading-4 text-slate-600",
        className,
      )}
    >
      {ETICHETTA_BLOCCO}
    </span>
  );
}

/** Mostra l'etichetta solo se il lead è un blocco. */
export function EtichettaBloccoDi({ lead, className }: { lead: ConSoloBlocco | null | undefined; className?: string }) {
  return eSoloBlocco(lead) ? <EtichettaBlocco className={className} /> : null;
}
