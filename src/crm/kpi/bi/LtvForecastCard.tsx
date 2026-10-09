import { useMemo } from "react";
import { CHANNEL_LABEL, CHANNELS, type JourneyLead } from "../journey/journey-utils";

interface Props {
  leads: JourneyLead[];
  dailyRevenueLast14: { date: string; revenue: number }[];
}

export function LtvForecastCard({ leads, dailyRevenueLast14 }: Props) {
  const ltvByChannel = useMemo(() => {
    return CHANNELS.map((c) => {
      const ch = leads.filter((l) => l.lastChannel === c && l.converted);
      const rev = ch.reduce((s, l) => s + l.revenue, 0);
      const avg = ch.length > 0 ? rev / ch.length : 0;
      // proxy frequenza: 1.0 (no repeat purchase tracking) — segnale chiaro
      const ltv = avg * 1.0;
      return { channel: c, count: ch.length, avg, ltv };
    }).filter((r) => r.count > 0);
  }, [leads]);

  // Linear regression sui 14 giorni
  const forecast = useMemo(() => {
    if (dailyRevenueLast14.length < 7) return { slope: 0, intercept: 0, next30: 0, current: 0 };
    const n = dailyRevenueLast14.length;
    const xs = dailyRevenueLast14.map((_, i) => i);
    const ys = dailyRevenueLast14.map((d) => d.revenue);
    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;
    const num = xs.reduce((s, x, i) => s + (x - meanX) * (ys[i] - meanY), 0);
    const den = xs.reduce((s, x) => s + (x - meanX) ** 2, 0) || 1;
    const slope = num / den;
    const intercept = meanY - slope * meanX;
    let next30 = 0;
    for (let i = n; i < n + 30; i++) next30 += Math.max(0, intercept + slope * i);
    const current = ys.reduce((a, b) => a + b, 0);
    return { slope, intercept, next30, current };
  }, [dailyRevenueLast14]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">LTV proxy &amp; Forecast 30gg</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border p-3 bg-card">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">LTV per Canale</div>
          {ltvByChannel.length === 0 ? (
            <div className="text-xs text-muted-foreground">Nessuna vendita tracciata</div>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {ltvByChannel.map((r) => (
                  <tr key={r.channel} className="border-t border-border first:border-t-0">
                    <td className="py-1.5 font-medium">{CHANNEL_LABEL[r.channel]}</td>
                    <td className="text-right py-1.5 tabular-nums text-muted-foreground">{r.count} vendite</td>
                    <td className="text-right py-1.5 tabular-nums font-semibold">€{r.ltv.toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-[10px] text-muted-foreground mt-2">
            LTV proxy = Avg revenue × 1.0 (no repeat purchase tracking attivo)
          </p>
        </div>
        <div className="rounded-lg border border-border p-3 bg-card">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Forecast Revenue</div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] text-muted-foreground">Ultimi 14gg</div>
              <div className="text-xl font-bold tabular-nums">€{forecast.current.toFixed(0)}</div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">Prossimi 30gg (lineare)</div>
              <div className={`text-xl font-bold tabular-nums ${forecast.slope >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                €{forecast.next30.toFixed(0)}
              </div>
            </div>
          </div>
          <div className="mt-3 text-[10px] text-muted-foreground">
            Trend slope: {forecast.slope >= 0 ? "+" : ""}€{forecast.slope.toFixed(1)}/giorno
          </div>
        </div>
      </div>
    </div>
  );
}
