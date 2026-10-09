/** LpsTrendSparkline — mini-grafico trend LPS giornaliero (default 30gg).
 *  Usato accanto all'alert "LPS in calo" per capire se il calo è puntuale o
 *  strutturale. Mostra una linea della media disagio per giorno + soglia. */

import { useMemo } from "react";
import type { Lead } from "@/crm/types";
import { leadAttributionDate } from "@/crm/lead-analytics";

interface Props {
  leads: Lead[];
  days?: number; // default 30
  threshold: number;
  height?: number;
}

export function LpsTrendSparkline({ leads, days = 30, threshold, height = 48 }: Props) {
  const points = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // bucket per giorno (key = "YYYY-MM-DD" locale)
    const buckets = new Map<string, { sum: number; n: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      buckets.set(d.toISOString().slice(0, 10), { sum: 0, n: 0 });
    }
    for (const l of leads) {
      const d = leadAttributionDate(l);
      if (!d) continue;
      const key = d.toISOString().slice(0, 10);
      const b = buckets.get(key);
      if (!b) continue;
      b.n += 1;
      const score = l.data.qualifica?.disagio;
      if (typeof score === "number") b.sum += score;
    }
    return [...buckets.entries()].map(([date, { sum, n }]) => ({
      date,
      lps: n > 0 ? sum / n : null,
      n,
    }));
  }, [leads, days]);

  const maxY = 10;
  const w = 200;
  const stepX = points.length > 1 ? w / (points.length - 1) : w;

  // Path costruito solo per i punti con dato valido
  const segments: Array<Array<{ x: number; y: number }>> = [];
  let cur: Array<{ x: number; y: number }> = [];
  points.forEach((p, i) => {
    if (p.lps == null) {
      if (cur.length) segments.push(cur);
      cur = [];
    } else {
      cur.push({ x: i * stepX, y: height - (p.lps / maxY) * height });
    }
  });
  if (cur.length) segments.push(cur);

  const pathD = segments
    .map((seg) =>
      seg
        .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
        .join(" "),
    )
    .join(" ");

  const thresholdY = height - (threshold / maxY) * height;
  const last = [...points].reverse().find((p) => p.lps != null);
  const first = points.find((p) => p.lps != null);
  const trend =
    last && first && first !== last && last.lps != null && first.lps != null
      ? last.lps - first.lps
      : 0;

  const lastValid = last?.lps;
  const lastBelow = lastValid != null && lastValid < threshold;

  return (
    <div className="inline-flex flex-col items-end shrink-0">
      <div className="flex items-baseline gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-amber-900/70 font-medium">
          Trend {days}gg
        </span>
        {lastValid != null && (
          <span
            className={`text-[11px] font-semibold tabular-nums ${lastBelow ? "text-rose-700" : "text-emerald-700"}`}
          >
            {lastValid.toFixed(1)}
          </span>
        )}
        {trend !== 0 && (
          <span
            className={`text-[10px] tabular-nums ${trend < 0 ? "text-rose-700" : "text-emerald-700"}`}
          >
            {trend > 0 ? "+" : ""}
            {trend.toFixed(1)}
          </span>
        )}
      </div>
      <svg
        width={w}
        height={height}
        viewBox={`0 0 ${w} ${height}`}
        className="rounded bg-white/60 border border-amber-300/40"
      >
        {/* threshold line */}
        <line
          x1={0}
          x2={w}
          y1={thresholdY}
          y2={thresholdY}
          stroke="oklch(0.78 0.15 78)"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.6}
        />
        <path
          d={pathD}
          fill="none"
          stroke={lastBelow ? "oklch(0.6 0.22 27)" : "oklch(0.62 0.17 152)"}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* dots evidenziati per ultimi 7gg */}
        {points.slice(-7).map((p, i) => {
          const idx = points.length - 7 + i;
          if (p.lps == null) return null;
          const x = idx * stepX;
          const y = height - (p.lps / maxY) * height;
          return (
            <circle
              key={p.date}
              cx={x}
              cy={y}
              r={1.6}
              fill={p.lps < threshold ? "oklch(0.6 0.22 27)" : "oklch(0.62 0.17 152)"}
            />
          );
        })}
      </svg>
    </div>
  );
}
