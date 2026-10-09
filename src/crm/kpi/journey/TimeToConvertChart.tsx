import { useMemo } from "react";
import { cohortBuckets, type JourneyLead } from "./journey-utils";

export function TimeToConvertChart({ leads, totalSpend }: { leads: JourneyLead[]; totalSpend: number }) {
  const buckets = useMemo(() => cohortBuckets(leads, totalSpend), [leads, totalSpend]);
  const max = Math.max(...buckets.map((b) => b.leads), 1);
  const maxCpl = Math.max(...buckets.map((b) => b.cpl), 1);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Time-to-Convert Distribution</h3>
      <div className="rounded-lg border border-border p-3 bg-card">
        <div className="space-y-2">
          {buckets.map((b) => {
            const wPct = (b.leads / max) * 100;
            const cplPct = (b.cpl / maxCpl) * 100;
            return (
              <div key={b.label} className="flex items-center gap-2 text-xs">
                <div className="w-32 text-muted-foreground shrink-0">{b.label}</div>
                <div className="flex-1 relative h-6 bg-muted/30 rounded">
                  <div
                    className="absolute inset-y-0 left-0 rounded"
                    style={{
                      width: `${wPct}%`,
                      background: "oklch(0.65 0.18 220)",
                    }}
                    title={`${b.leads} lead · ${b.conversions} vendite · €${b.revenue.toFixed(0)}`}
                  />
                  {b.cpl > 0 && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 h-1 rounded"
                      style={{
                        left: `${Math.min(95, cplPct)}%`,
                        width: "4px",
                        background: "oklch(0.6 0.22 27)",
                      }}
                      title={`CPL stimato €${b.cpl.toFixed(2)}`}
                    />
                  )}
                </div>
                <div className="w-20 text-right tabular-nums">{b.leads}</div>
                <div className="w-20 text-right tabular-nums text-muted-foreground">€{b.cpl.toFixed(0)}</div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ background: "oklch(0.65 0.18 220)" }} />
            Lead per cohort
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-1 rounded" style={{ background: "oklch(0.6 0.22 27)" }} />
            CPL proxy
          </span>
        </div>
      </div>
    </div>
  );
}
