import { useMemo } from "react";
import type { JourneyLead } from "../journey/journey-utils";

function weekKey(d: Date): string {
  const tmp = new Date(d);
  tmp.setHours(0, 0, 0, 0);
  const day = (tmp.getDay() + 6) % 7;
  tmp.setDate(tmp.getDate() - day);
  return tmp.toISOString().slice(0, 10);
}

export function CohortRetention({ leads }: { leads: JourneyLead[] }) {
  const cohorts = useMemo(() => {
    const map = new Map<string, { acquired: number; w0: number; w1: number; w2: number; w3: number; w4: number }>();
    leads.forEach((l) => {
      const ackKey = weekKey(l.createdAt);
      const cur = map.get(ackKey) || { acquired: 0, w0: 0, w1: 0, w2: 0, w3: 0, w4: 0 };
      cur.acquired++;
      if (l.converted && l.convertedAt) {
        const diffDays = Math.floor((l.convertedAt.getTime() - l.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 7) cur.w0++;
        else if (diffDays <= 14) cur.w1++;
        else if (diffDays <= 21) cur.w2++;
        else if (diffDays <= 28) cur.w3++;
        else cur.w4++;
      }
      map.set(ackKey, cur);
    });
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 8)
      .map(([k, v]) => ({ week: k, ...v }));
  }, [leads]);

  const heatColor = (pct: number) => {
    if (pct === 0) return "transparent";
    return `oklch(0.7 0.18 145 / ${0.15 + Math.min(0.7, pct * 1.5)})`;
  };

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Cohort Retention (settimana di acquisizione)</h3>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-secondary/50 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Cohort</th>
              <th className="text-right px-3 py-2 font-medium">Acq.</th>
              <th className="text-right px-3 py-2 font-medium">W0</th>
              <th className="text-right px-3 py-2 font-medium">W1</th>
              <th className="text-right px-3 py-2 font-medium">W2</th>
              <th className="text-right px-3 py-2 font-medium">W3</th>
              <th className="text-right px-3 py-2 font-medium">W4+</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-6 text-muted-foreground">
                  Insufficient data — almeno 1 settimana di lead richiesta.
                </td>
              </tr>
            )}
            {cohorts.map((c) => {
              const pct = (n: number) => (c.acquired > 0 ? n / c.acquired : 0);
              return (
                <tr key={c.week} className="border-t border-border">
                  <td className="px-3 py-2 font-medium tabular-nums">{c.week}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{c.acquired}</td>
                  {(["w0", "w1", "w2", "w3", "w4"] as const).map((k) => {
                    const v = c[k];
                    const p = pct(v);
                    return (
                      <td
                        key={k}
                        className="text-right px-3 py-2 tabular-nums"
                        style={{ background: heatColor(p) }}
                      >
                        {v > 0 ? `${v} (${(p * 100).toFixed(0)}%)` : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
