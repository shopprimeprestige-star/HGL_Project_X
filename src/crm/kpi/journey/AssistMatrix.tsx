import { useState, useMemo } from "react";
import { CHANNELS, CHANNEL_LABEL, computeMatrix, type JourneyLead, type Channel } from "./journey-utils";

export function AssistMatrix({ leads }: { leads: JourneyLead[] }) {
  const matrix = useMemo(() => computeMatrix(leads), [leads]);
  const [selected, setSelected] = useState<{ first: Channel; last: Channel } | null>(null);

  const max = Math.max(
    ...CHANNELS.flatMap((r) => CHANNELS.map((c) => matrix[r][c].count)),
    1,
  );

  const cellBg = (count: number) => {
    if (count === 0) return "bg-muted/20";
    const intensity = Math.min(1, count / max);
    return `bg-primary/[${(intensity * 0.5).toFixed(2)}]`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Cross-Channel Assist Matrix</h3>
        <span className="text-[11px] text-muted-foreground">Righe = First Touch · Colonne = Last Touch</span>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs border-collapse">
          <thead>
            <tr>
              <th className="p-2"></th>
              {CHANNELS.map((c) => (
                <th key={c} className="p-2 text-center font-medium text-muted-foreground">
                  {CHANNEL_LABEL[c]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CHANNELS.map((row) => (
              <tr key={row}>
                <td className="p-2 font-medium text-muted-foreground">{CHANNEL_LABEL[row]}</td>
                {CHANNELS.map((col) => {
                  const cell = matrix[row][col];
                  const isDiagonal = row === col;
                  const intensity = max > 0 ? Math.min(1, cell.count / max) : 0;
                  return (
                    <td
                      key={col}
                      onClick={() => cell.count > 0 && setSelected({ first: row, last: col })}
                      className={`relative w-20 h-16 border border-border text-center align-middle ${cell.count > 0 ? "cursor-pointer hover:ring-2 hover:ring-primary" : ""} ${isDiagonal ? "ring-1 ring-primary/40" : ""}`}
                      style={{
                        backgroundColor: cell.count > 0
                          ? `oklch(0.7 0.18 220 / ${0.1 + intensity * 0.5})`
                          : "transparent",
                      }}
                      title={`${CHANNEL_LABEL[row]} → ${CHANNEL_LABEL[col]}: ${cell.count} lead, ${cell.conversions} vendite, €${cell.revenue.toFixed(0)}`}
                    >
                      {cell.count > 0 && (
                        <>
                          <div className="text-sm font-bold tabular-nums">{cell.count}</div>
                          {cell.revenue > 0 && (
                            <div className="text-[9px] text-muted-foreground">€{cell.revenue.toFixed(0)}</div>
                          )}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <div className="rounded-lg border border-border bg-secondary/30 p-3 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">
              {CHANNEL_LABEL[selected.first]} → {CHANNEL_LABEL[selected.last]}
            </span>
            <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
              Chiudi
            </button>
          </div>
          <div className="text-muted-foreground">
            {matrix[selected.first][selected.last].leadIds.length} lead · {matrix[selected.first][selected.last].conversions} vendite · €
            {matrix[selected.first][selected.last].revenue.toFixed(2)}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground truncate">
            IDs: {matrix[selected.first][selected.last].leadIds.slice(0, 10).join(", ")}
            {matrix[selected.first][selected.last].leadIds.length > 10 && "…"}
          </div>
        </div>
      )}
    </div>
  );
}
