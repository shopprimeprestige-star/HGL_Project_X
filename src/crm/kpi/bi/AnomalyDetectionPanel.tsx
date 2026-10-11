import { useMemo } from "react";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { zScoreAlerts } from "../journey/journey-utils";

interface Props {
  dailyCpl: { date: string; value: number }[];
  dailyConversionRate: { date: string; value: number }[];
  dailySpend: { date: string; value: number }[];
}

export function AnomalyDetectionPanel({ dailyCpl, dailyConversionRate, dailySpend }: Props) {
  const alerts = useMemo(() => {
    const all = [
      ...zScoreAlerts(dailyCpl, "CPL", 2, true),
      ...zScoreAlerts(dailyConversionRate, "CVR booking→sale", 1.5, false),
      ...zScoreAlerts(dailySpend, "Spend totale", 2, false).filter((a) => a.direction === "spike"),
    ];
    return all.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore)).slice(0, 10);
  }, [dailyCpl, dailyConversionRate, dailySpend]);

  const insufficient = dailyCpl.length < 14;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5" />
        Anomaly Detection (z-score)
      </h3>
      <div className="rounded-lg border border-border bg-card p-3">
        {insufficient ? (
          <div className="text-xs text-muted-foreground">Insufficient data — servono almeno 14gg di storico per analisi z-score.</div>
        ) : alerts.length === 0 ? (
          <div className="text-xs text-emerald-700">✓ Nessuna anomalia rilevata nel periodo</div>
        ) : (
          <ul className="space-y-1.5">
            {alerts.map((a, i) => (
              <li
                key={i}
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${a.severity === "critical" ? "bg-rose-50 border border-rose-200" : "bg-amber-50 border border-amber-200"}`}
              >
                {a.direction === "spike" ? (
                  <TrendingUp className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                )}
                <span className="font-mono text-[10px] text-muted-foreground">{a.date}</span>
                <span className="font-semibold">{a.metric}</span>
                <span className="tabular-nums">{a.value.toFixed(2)}</span>
                <span className="text-muted-foreground text-[10px]">(media {a.mean.toFixed(2)} · z={a.zScore.toFixed(1)})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
