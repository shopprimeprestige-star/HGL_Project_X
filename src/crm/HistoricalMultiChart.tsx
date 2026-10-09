import { useMemo, useState } from "react";
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine,
} from "recharts";
import { AlertTriangle } from "lucide-react";

export interface TrendPoint {
  date: string;
  spend: number;
  cpm: number;
  cpl: number;
  freq: number;
  sessions: number;
  leads: number;
  cvr: number;
  avgScroll: number;
  avgTime: number;
  bounceRate: number;
  thumbstopRate: number;
  hookRate: number;
  view25Rate?: number;
  view50Rate: number;
  view75Rate?: number;
  holdRate: number;
  completionRate: number;
  fatigueScore: number;
}

type MetricKey =
  | "cpm" | "cpl" | "freq"
  | "cvr" | "avgScroll" | "avgTime" | "bounceRate"
  | "thumbstopRate" | "hookRate" | "view50Rate" | "holdRate" | "completionRate"
  | "fatigueScore";

interface MetricDef {
  key: MetricKey;
  label: string;
  color: string;
  axis: "L" | "R";
  formatter: (v: number) => string;
  group: "Costi" | "Funnel" | "Engagement" | "Video" | "Fatigue";
  defaultOn?: boolean;
}

const FREQ_THRESHOLD = 3.5;

const METRICS: MetricDef[] = [
  // Costi (€ — asse sx)
  { key: "cpm", label: "CPM", color: "oklch(0.55 0.18 252)", axis: "L", formatter: (v) => `€${v.toFixed(2)}`, group: "Costi", defaultOn: true },
  { key: "cpl", label: "CPL", color: "oklch(0.6 0.22 25)", axis: "L", formatter: (v) => `€${v.toFixed(2)}`, group: "Costi", defaultOn: true },
  { key: "freq", label: "Frequenza", color: "oklch(0.65 0.18 45)", axis: "R", formatter: (v) => v.toFixed(2), group: "Costi" },
  // Funnel (% — asse dx)
  { key: "cvr", label: "CVR (lead/sess)", color: "oklch(0.55 0.22 320)", axis: "R", formatter: (v) => `${v.toFixed(1)}%`, group: "Funnel" },
  // Engagement LP (% / s — asse dx)
  { key: "avgScroll", label: "Scroll medio %", color: "oklch(0.6 0.18 200)", axis: "R", formatter: (v) => `${v.toFixed(0)}%`, group: "Engagement" },
  { key: "avgTime", label: "Tempo medio (s)", color: "oklch(0.55 0.16 175)", axis: "R", formatter: (v) => `${v.toFixed(0)}s`, group: "Engagement" },
  { key: "bounceRate", label: "Bounce %", color: "oklch(0.6 0.2 15)", axis: "R", formatter: (v) => `${v.toFixed(1)}%`, group: "Engagement" },
  // Video (% — asse dx)
  { key: "thumbstopRate", label: "Thumbstop %", color: "oklch(0.62 0.16 230)", axis: "R", formatter: (v) => `${v.toFixed(1)}%`, group: "Video" },
  { key: "hookRate", label: "Hook % (25%)", color: "oklch(0.65 0.16 175)", axis: "R", formatter: (v) => `${v.toFixed(1)}%`, group: "Video" },
  { key: "view50Rate", label: "View % (50%)", color: "oklch(0.68 0.18 145)", axis: "R", formatter: (v) => `${v.toFixed(1)}%`, group: "Video" },
  { key: "holdRate", label: "Hold % (75%)", color: "oklch(0.7 0.2 130)", axis: "R", formatter: (v) => `${v.toFixed(1)}%`, group: "Video" },
  { key: "completionRate", label: "Completion %", color: "oklch(0.72 0.2 100)", axis: "R", formatter: (v) => `${v.toFixed(1)}%`, group: "Video" },
  // Fatigue trend (0-100, asse dx) — alto = più stanca
  { key: "fatigueScore", label: "Fatigue Score", color: "oklch(0.55 0.24 15)", axis: "R", formatter: (v) => `${Math.round(v)}/100`, group: "Fatigue", defaultOn: true },
];

export function HistoricalMultiChart({ data }: { data: TrendPoint[] }) {
  const [active, setActive] = useState<Set<MetricKey>>(
    () => new Set(METRICS.filter((m) => m.defaultOn).map((m) => m.key)),
  );

  const freqOn = active.has("freq");
  const freqExceeded = useMemo(() => freqOn && data.some((d) => d.freq > FREQ_THRESHOLD), [data, freqOn]);

  // Primo giorno in cui fatigueScore > 50 (soglia "in degrado").
  const fatigueOn = active.has("fatigueScore");
  const fatigueDegradeDate = useMemo(() => {
    if (!fatigueOn) return null;
    const found = data.find((d) => (d.fatigueScore ?? 0) > 50);
    return found?.date ?? null;
  }, [data, fatigueOn]);

  function toggle(k: MetricKey) {
    setActive((cur) => {
      const n = new Set(cur);
      if (n.has(k)) n.delete(k); else n.add(k);
      return n;
    });
  }

  const groups: Array<{ name: MetricDef["group"]; metrics: MetricDef[] }> = [
    { name: "Fatigue", metrics: METRICS.filter((m) => m.group === "Fatigue") },
    { name: "Costi", metrics: METRICS.filter((m) => m.group === "Costi") },
    { name: "Funnel", metrics: METRICS.filter((m) => m.group === "Funnel") },
    { name: "Engagement", metrics: METRICS.filter((m) => m.group === "Engagement") },
    { name: "Video", metrics: METRICS.filter((m) => m.group === "Video") },
  ];

  const activeMetrics = METRICS.filter((m) => active.has(m.key));

  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="mb-3">
        <div className="text-[12.5px] font-semibold">Storico performance — multi-metrica</div>
        <div className="text-[11px] text-muted-foreground">
          Attiva metriche dai gruppi sotto. Asse sx: <span className="text-foreground font-medium">€ (Costi)</span>, asse dx:{" "}
          <span className="text-foreground font-medium">% / valori</span>. Combina costi + funnel + engagement + video per leggere la salute della creativa.
        </div>
      </div>

      {/* Toggle per gruppo */}
      <div className="space-y-1.5 mb-3">
        {groups.map((g) => (
          <div key={g.name} className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground w-20 shrink-0">{g.name}</span>
            {g.metrics.map((m) => {
              const on = active.has(m.key);
              return (
                <button
                  key={m.key}
                  onClick={() => toggle(m.key)}
                  className={`h-6 px-2 rounded-md text-[10.5px] font-medium border transition-all inline-flex items-center gap-1.5 ${
                    on
                      ? "bg-white border-border shadow-sm text-foreground"
                      : "bg-secondary/40 border-transparent text-muted-foreground hover:bg-secondary"
                  }`}
                  style={on ? { borderLeftWidth: 3, borderLeftColor: m.color } : undefined}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        ))}
        {freqExceeded && (
          <div className="inline-flex items-center gap-1 text-[11px] text-rose-700 font-semibold">
            <AlertTriangle className="h-3 w-3" /> Frequenza &gt; {FREQ_THRESHOLD} in qualche giorno
          </div>
        )}
      </div>

      <div className="h-72">
        {data.length === 0 ? (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">Nessun dato.</div>
        ) : activeMetrics.length === 0 ? (
          <div className="h-full grid place-items-center text-sm text-muted-foreground">Attiva almeno una metrica.</div>
        ) : (
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => String(d).slice(5)} />
              <YAxis yAxisId="L" tick={{ fontSize: 10 }} tickFormatter={(v) => `€${v}`} />
              <YAxis yAxisId="R" orientation="right" tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid oklch(0.9 0.005 250)" }}
                formatter={(v: number, n: string) => {
                  const m = METRICS.find((x) => x.label === n);
                  if (!m) return [v, n];
                  return [m.formatter(v), n];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {freqOn && (
                <ReferenceLine
                  yAxisId="R"
                  y={FREQ_THRESHOLD}
                  stroke="oklch(0.6 0.22 25)"
                  strokeDasharray="6 3"
                  strokeWidth={1.5}
                  label={{ value: `Soglia freq ${FREQ_THRESHOLD}`, position: "insideTopRight", fill: "oklch(0.55 0.22 25)", fontSize: 10, fontWeight: 600 }}
                />
              )}
              {fatigueDegradeDate && (
                <ReferenceLine
                  yAxisId="R"
                  x={fatigueDegradeDate}
                  stroke="oklch(0.55 0.24 15)"
                  strokeDasharray="4 3"
                  strokeWidth={1.8}
                  label={{ value: `Inizio degrado (Fatigue >50)`, position: "insideTop", fill: "oklch(0.5 0.24 15)", fontSize: 10, fontWeight: 700 }}
                />
              )}
              {activeMetrics.map((m) => (
                <Line
                  key={m.key}
                  yAxisId={m.axis}
                  type="monotone"
                  dataKey={m.key}
                  name={m.label}
                  stroke={m.color}
                  strokeWidth={2}
                  strokeDasharray={m.group === "Video" ? "4 2" : undefined}
                  dot={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
