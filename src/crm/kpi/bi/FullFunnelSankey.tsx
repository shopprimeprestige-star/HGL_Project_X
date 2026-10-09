import { useMemo } from "react";
import type { JourneyLead, Channel } from "../journey/journey-utils";
import { CHANNEL_LABEL, CHANNEL_COLOR, CHANNELS } from "../journey/journey-utils";

interface Props {
  leads: JourneyLead[];
  meetings: number;
  shows: number;
  sales: number;
  installs: number;
  totalImpressions?: number;
  totalClicks?: number;
}

export function FullFunnelSankey({ leads, meetings, shows, sales, installs, totalImpressions = 0, totalClicks = 0 }: Props) {
  const stages = useMemo(() => {
    const lpView = leads.length;
    const lpEng = Math.round(lpView * 0.6); // proxy se non disponibile
    const booking = leads.filter((l) => l.touches.length > 0).length || lpView;
    return [
      { key: "imp", label: "Impressioni", value: totalImpressions || lpView * 100 },
      { key: "click", label: "Click", value: totalClicks || lpView * 8 },
      { key: "lpv", label: "LP View", value: lpView },
      { key: "lpe", label: "LP Engagement", value: lpEng },
      { key: "book", label: "Booking", value: booking },
      { key: "show", label: "Show", value: shows || meetings },
      { key: "sale", label: "Sale", value: sales },
      { key: "install", label: "Install", value: installs },
    ];
  }, [leads, meetings, shows, sales, installs, totalImpressions, totalClicks]);

  // Breakdown per canale dell'ultimo step (Sale)
  const saleByChannel = useMemo(() => {
    const out = {} as Record<Channel, number>;
    CHANNELS.forEach((c) => (out[c] = 0));
    leads.filter((l) => l.converted).forEach((l) => {
      const ch = l.lastChannel || "direct";
      out[ch]++;
    });
    return out;
  }, [leads]);

  const max = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Funnel Completo Cross-Source</h3>
      <div className="rounded-lg border border-border p-4 bg-card">
        <div className="space-y-2">
          {stages.map((s, i) => {
            const w = (s.value / max) * 100;
            const dropPct = i > 0 && stages[i - 1].value > 0 ? (1 - s.value / stages[i - 1].value) * 100 : 0;
            const isCritical = dropPct > 50;
            return (
              <div key={s.key} className="flex items-center gap-3 text-xs">
                <div className="w-32 font-medium">{s.label}</div>
                <div className="flex-1 relative h-7 bg-muted/30 rounded">
                  <div
                    className="absolute inset-y-0 left-0 rounded flex items-center justify-end px-2"
                    style={{
                      width: `${w}%`,
                      background: `oklch(0.65 0.15 ${220 - i * 25})`,
                    }}
                  >
                    <span className="text-white text-[10px] font-bold tabular-nums">{s.value.toLocaleString()}</span>
                  </div>
                </div>
                <div className={`w-16 text-right text-[10px] tabular-nums ${isCritical ? "text-rose-700 font-bold" : "text-muted-foreground"}`}>
                  {i > 0 ? `−${dropPct.toFixed(0)}%` : ""}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 pt-4 border-t border-border">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Sale Breakdown per Canale</div>
          <div className="flex flex-wrap gap-2">
            {CHANNELS.filter((c) => saleByChannel[c] > 0).map((c) => (
              <div
                key={c}
                className="px-2 py-1 rounded text-[11px] font-medium text-white"
                style={{ background: CHANNEL_COLOR[c] }}
              >
                {CHANNEL_LABEL[c]}: {saleByChannel[c]}
              </div>
            ))}
            {Object.values(saleByChannel).every((v) => v === 0) && (
              <span className="text-xs text-muted-foreground">Nessuna vendita nel periodo.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
