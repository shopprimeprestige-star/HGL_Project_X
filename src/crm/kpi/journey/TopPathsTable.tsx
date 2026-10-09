import { useMemo } from "react";
import { topPaths, type JourneyLead, type Channel } from "./journey-utils";

export function TopPathsTable({
  leads,
  spendByChannel,
}: {
  leads: JourneyLead[];
  spendByChannel: Record<Channel, number>;
}) {
  const rows = useMemo(() => topPaths(leads, 10, spendByChannel), [leads, spendByChannel]);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Top 10 Winning Paths</h3>
      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-secondary/50 text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2 font-medium">#</th>
              <th className="text-left px-3 py-2 font-medium">Path</th>
              <th className="text-right px-3 py-2 font-medium">Lead</th>
              <th className="text-right px-3 py-2 font-medium">Vendite</th>
              <th className="text-right px-3 py-2 font-medium">Revenue</th>
              <th className="text-right px-3 py-2 font-medium">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-6 text-muted-foreground">
                  Nessun journey tracciato nel periodo.
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.pathLabel} className="border-t border-border hover:bg-secondary/30">
                <td className="px-3 py-2 text-muted-foreground tabular-nums">{i + 1}</td>
                <td className="px-3 py-2 font-medium">{r.pathLabel}</td>
                <td className="text-right px-3 py-2 tabular-nums">{r.leads}</td>
                <td className="text-right px-3 py-2 tabular-nums">{r.conversions}</td>
                <td className="text-right px-3 py-2 tabular-nums">€{r.revenue.toFixed(0)}</td>
                <td className={`text-right px-3 py-2 tabular-nums font-semibold ${r.roas >= 3 ? "text-emerald-700" : r.roas >= 1 ? "text-amber-700" : "text-rose-700"}`}>
                  {r.roas > 0 ? `${r.roas.toFixed(2)}x` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
