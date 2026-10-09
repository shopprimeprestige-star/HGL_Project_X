import type { JourneyLead } from "./journey-utils";

export function JourneyKpiStrip({ leads }: { leads: JourneyLead[] }) {
  const total = leads.length;
  const counts = { cold_direct: 0, cold_assisted: 0, retarget_same: 0, retarget_cross: 0, retarget_multi: 0 };
  let totalTouches = 0;
  leads.forEach((l) => {
    const t = l.journeyType || "cold_direct";
    counts[t]++;
    totalTouches += l.touches?.length || 0;
  });
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0);
  const avgTouch = total > 0 ? totalTouches / total : 0;

  const pills = [
    { label: "Lead totali", value: String(total), color: "oklch(0.55 0.02 250)" },
    { label: "% Cold Direct", value: `${pct(counts.cold_direct).toFixed(1)}%`, color: "oklch(0.65 0.15 220)" },
    { label: "% Cold Assisted", value: `${pct(counts.cold_assisted).toFixed(1)}%`, color: "oklch(0.7 0.13 180)" },
    { label: "% Retarget Same", value: `${pct(counts.retarget_same).toFixed(1)}%`, color: "oklch(0.7 0.17 80)" },
    { label: "% Retarget Cross", value: `${pct(counts.retarget_cross).toFixed(1)}%`, color: "oklch(0.65 0.2 30)" },
    { label: "Avg Touch-to-Convert", value: avgTouch.toFixed(2), color: "oklch(0.55 0.22 320)" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {pills.map((p) => (
        <div key={p.label} className="rounded-lg border border-border bg-card p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.label}</div>
          <div className="text-xl font-bold tabular-nums mt-1" style={{ color: p.color }}>
            {p.value}
          </div>
        </div>
      ))}
    </div>
  );
}
