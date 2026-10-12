import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { Chip } from "./ui";
import { useCapiHealth } from "./useCapiHealth";

export function CapiHealthAlert() {
  const h = useCapiHealth(7);
  if (h.loading || !h.triggered) return null;

  return (
    <div
      data-slot="scheda"
      className="rounded-xl border border-rose-300 bg-rose-50 p-4 flex flex-wrap gap-3 items-start"
    >
      <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-[260px]">
        <div className="font-semibold text-rose-900 text-[14px]">
          ⚠️ Tracciamento CAPI degradato
        </div>
        <div className="text-[12.5px] text-rose-800 mt-1">
          Match Pixel ↔ CAPI sotto l'<strong>80%</strong> per{" "}
          <strong>{h.badDays.length} giorni</strong> recenti. Meta non riceve correttamente gli
          eventi server-side: il targeting si sta degradando.
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {h.badDays.map((d) => (
            <Chip key={d.day} tono="persa" className="py-px leading-4 tabular-nums">
              {d.day}: {d.rate.toFixed(0)}% ({d.capi}/{d.total})
            </Chip>
          ))}
        </div>
      </div>
      <Link
        to="/CRM/campagne-meta"
        className="shrink-0 inline-flex items-center gap-1 text-[12px] font-medium text-rose-700 hover:text-rose-900 underline"
      >
        Apri Controllo Totale <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}
