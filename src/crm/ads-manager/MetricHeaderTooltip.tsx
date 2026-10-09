/** Tooltip shadcn per gli header delle colonne metriche.
 *  Mostra formula, descrizione, benchmark Meta e azione consigliata
 *  leggendo da FORMULA_DOCS (single source of truth in metrics-formulas.ts).
 *  Se la chiave non esiste in FORMULA_DOCS, ritorna il children senza wrapper. */

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FORMULA_DOCS } from "./metrics-formulas";

interface Props {
  /** Chiave in FORMULA_DOCS. Se assente o non trovata → no tooltip. */
  formulaKey?: string;
  children: ReactNode;
}

export function MetricHeaderTooltip({ formulaKey, children }: Props) {
  const doc = formulaKey ? FORMULA_DOCS[formulaKey] : null;
  if (!doc) return <>{children}</>;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 cursor-help">
            {children}
            <Info className="h-2.5 w-2.5 opacity-50 shrink-0" />
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          align="end"
          className="max-w-xs bg-slate-900 text-white text-[11px] p-3 space-y-1.5 leading-relaxed"
        >
          <div className="font-semibold text-[12px] text-white">{doc.label}</div>
          <div className="font-mono text-[10.5px] text-slate-300 bg-slate-800/60 px-2 py-1 rounded">
            📐 {doc.formula}
          </div>
          <div className="text-slate-200">{doc.what}</div>
          <div className="text-[10.5px] text-slate-300 pt-0.5 border-t border-slate-700/60 mt-1">
            {doc.benchmark}
          </div>
          {doc.action && <div className="text-[10.5px] text-amber-200/90">💡 {doc.action}</div>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
