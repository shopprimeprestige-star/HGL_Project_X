/** Sparkline inline 7gg del fatigueScore (0-100). Linea + soglia 50 tratteggiata.
 *  Cliccabile: invoca onClick (in genere apre il drawer dell'ad sul tab "Approfondita"). */
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export function FatigueSparkline({
  trend,
  onClick,
}: {
  trend: { date: string; fatigueScore: number }[];
  onClick?: () => void;
}) {
  const last7 = trend.slice(-7);
  if (last7.length < 2) {
    return <span className="text-[10.5px] text-muted-foreground tabular-nums">—</span>;
  }
  const w = 96,
    h = 28,
    pad = 2;
  const xs = last7.map((_, i) => pad + (i * (w - 2 * pad)) / (last7.length - 1));
  const ys = last7.map((t) => {
    const v = Math.max(0, Math.min(100, t.fatigueScore ?? 0));
    return h - pad - (v / 100) * (h - 2 * pad);
  });
  const path = xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`)
    .join(" ");
  const last = last7[last7.length - 1].fatigueScore ?? 0;
  const first = last7[0].fatigueScore ?? 0;
  const delta = last - first;
  const lineColor =
    last >= 50 ? "oklch(0.55 0.24 15)" : last >= 30 ? "oklch(0.7 0.18 70)" : "oklch(0.62 0.16 160)";
  const yThreshold = h - pad - 0.5 * (h - 2 * pad);
  const content = (
    <>
      <svg width={w} height={h} className="block">
        <line
          x1={pad}
          x2={w - pad}
          y1={yThreshold}
          y2={yThreshold}
          stroke="oklch(0.85 0.005 250)"
          strokeDasharray="2 2"
          strokeWidth={1}
        />
        <path
          d={path}
          fill="none"
          stroke={lineColor}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={xs[xs.length - 1]} cy={ys[ys.length - 1]} r={2.2} fill={lineColor} />
      </svg>
      <span
        className={`text-[10.5px] tabular-nums font-medium ${last >= 50 ? "text-rose-600" : "text-muted-foreground"}`}
      >
        {Math.round(last)}
      </span>
    </>
  );
  const tipBody = (
    <div className="space-y-0.5">
      <div className="font-semibold">Fatigue Score</div>
      <div>
        {first} → <span className={last >= 50 ? "text-rose-300" : "text-emerald-300"}>{last}</span>{" "}
        <span className="opacity-70">
          ({delta >= 0 ? "+" : ""}
          {delta}) · ultimi {last7.length}gg
        </span>
      </div>
      {onClick && (
        <div className="text-[10px] opacity-70 pt-0.5 border-t border-white/15">
          Clicca per il trend completo
        </div>
      )}
    </div>
  );
  const trigger = onClick ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-1.5 rounded-md px-1 -mx-1 hover:bg-secondary/70 cursor-pointer transition-colors"
    >
      {content}
    </button>
  ) : (
    <span className="inline-flex items-center gap-1.5">{content}</span>
  );
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side="top" className="bg-slate-900 text-white text-[11px] px-2.5 py-2">
          {tipBody}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
