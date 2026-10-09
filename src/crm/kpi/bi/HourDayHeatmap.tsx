import { useMemo } from "react";
import type { JourneyLead } from "../journey/journey-utils";

const DAYS = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export function HourDayHeatmap({ leads }: { leads: JourneyLead[] }) {
  const grid = useMemo(() => {
    const g: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    leads.filter((l) => l.converted && l.convertedAt).forEach((l) => {
      const d = l.convertedAt as Date;
      const dow = (d.getDay() + 6) % 7; // lun=0
      const h = d.getHours();
      g[dow][h]++;
    });
    return g;
  }, [leads]);

  const max = Math.max(...grid.flat(), 1);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Conversioni per Giorno × Ora</h3>
      <div className="rounded-lg border border-border p-3 bg-card overflow-x-auto">
        <table className="text-[10px] border-collapse">
          <thead>
            <tr>
              <th className="p-1"></th>
              {Array.from({ length: 24 }, (_, h) => (
                <th key={h} className="px-1 py-0.5 font-normal text-muted-foreground tabular-nums">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, dowIdx) => (
              <tr key={day}>
                <td className="px-2 py-0.5 font-medium text-muted-foreground">{day}</td>
                {grid[dowIdx].map((v, h) => {
                  const intensity = v / max;
                  return (
                    <td
                      key={h}
                      className="w-5 h-5 text-center align-middle border border-border/40"
                      style={{ background: v > 0 ? `oklch(0.65 0.18 145 / ${0.1 + intensity * 0.8})` : "transparent" }}
                      title={`${day} ${h}:00 — ${v} conversioni`}
                    >
                      {v > 0 ? v : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
