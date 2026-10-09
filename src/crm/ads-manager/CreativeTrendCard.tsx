import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  Sparkles,
  Wand2,
} from "lucide-react";
import { getCreativeWowSnapshot, getCreativeWowAiSummary } from "@/crm/ads-financials.functions";
import { getTikTokCreativeWowSnapshot } from "@/crm/tiktok-ads-manager/tiktok-creative-wow.functions";
import { Sparkline } from "@/crm/ads-manager/Sparkline";

interface MetricSet {
  cpc: number;
  cpl: number;
  ctr: number;
  hookRate: number;
  holdRate: number;
  bounceRate: number;
  scrollAvg: number;
  timeOnPage: number;
  leads: number;
  sessions: number;
  spend: number;
}
interface Item {
  adId: string;
  adName: string;
  campaignName: string;
  cur: MetricSet;
  prev: MetricSet;
  isNew: boolean;
  scoreCur: number | null;
  scorePrev: number | null;
  scoreSeries: number[];
  sparkCpc: number[];
  firstSeenISO: string | null;
  ageDays: number | null;
}

type Status = "critical" | "watch" | "growing" | "stable" | "newBad" | "newOk";

interface RowEval {
  status: Status;
  worsenedCount: number;
  improvedCount: number;
  deltas: Record<keyof MetricSet, number | null>;
  worstReason?: string;
}

const LOWER_IS_BETTER = new Set<keyof MetricSet>(["cpc", "cpl", "bounceRate"]);

function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0 && curr === 0) return 0;
  if (prev === 0) return null; // "+∞" / nuovo
  return ((curr - prev) / prev) * 100;
}

function evaluateRow(
  item: Item,
  accountAvg: { cpc: number; bounceRate: number; scrollAvg: number },
): RowEval {
  const keys: (keyof MetricSet)[] = [
    "cpc",
    "cpl",
    "ctr",
    "hookRate",
    "holdRate",
    "bounceRate",
    "scrollAvg",
    "timeOnPage",
  ];
  const deltas: Record<string, number | null> = {};
  for (const k of keys) deltas[k] = pctDelta(item.cur[k], item.prev[k]);

  if (item.isNew) {
    // Confronta con media account
    const badCpc = accountAvg.cpc > 0 && item.cur.cpc > accountAvg.cpc * 1.3;
    const badBounce =
      accountAvg.bounceRate > 0 && item.cur.bounceRate > accountAvg.bounceRate * 1.2;
    const badScroll = accountAvg.scrollAvg > 0 && item.cur.scrollAvg < accountAvg.scrollAvg * 0.8;
    const badCount = (badCpc ? 1 : 0) + (badBounce ? 1 : 0) + (badScroll ? 1 : 0);
    return {
      status: badCount >= 1 ? "newBad" : "newOk",
      worsenedCount: 0,
      improvedCount: 0,
      deltas: deltas as Record<keyof MetricSet, number | null>,
      worstReason: badCount >= 1 ? "Lancio sotto la media account" : undefined,
    };
  }

  let worsened = 0;
  let improved = 0;
  for (const k of keys) {
    const d = deltas[k];
    if (d == null) continue;
    const lower = LOWER_IS_BETTER.has(k);
    const isWorse = lower ? d > 15 : d < -15;
    const isBetter = lower ? d < -10 : d > 10;
    if (isWorse) worsened++;
    if (isBetter) improved++;
  }
  const cplDelta = deltas.cpl;
  const bounceDelta = deltas.bounceRate;
  const cplCritical = cplDelta != null && cplDelta > 50;
  const bounceCritical = bounceDelta != null && bounceDelta > 20;

  let status: Status = "stable";
  if (worsened >= 3 || cplCritical || bounceCritical) status = "critical";
  else if (worsened >= 1) status = "watch";
  else if (improved >= 2) status = "growing";

  return {
    status,
    worsenedCount: worsened,
    improvedCount: improved,
    deltas: deltas as Record<keyof MetricSet, number | null>,
  };
}

const fmtPct = (
  v: number | null,
  lower: boolean,
): { text: string; cls: string; arrow: typeof TrendingUp | null } => {
  if (v == null) return { text: "nuovo", cls: "text-violet-700", arrow: null };
  const sign = v > 0 ? "+" : "";
  const text = `${sign}${v.toFixed(0)}%`;
  const positive = lower ? v < 0 : v > 0;
  const negative = lower ? v > 0 : v < 0;
  const cls =
    Math.abs(v) < 5
      ? "text-muted-foreground"
      : positive
        ? "text-emerald-700"
        : negative
          ? "text-rose-700"
          : "text-muted-foreground";
  const arrow = Math.abs(v) < 5 ? Minus : v > 0 ? TrendingUp : TrendingDown;
  return { text, cls, arrow };
};

/** Heatmap: sfondo graduato rosso (peggio) → bianco (neutro) → verde (meglio).
 *  Intensità basata su |delta|, satura a 50%. Per metriche "lower is better"
 *  un delta positivo = peggio (rosso). */
function heatBg(v: number | null, lower: boolean): string {
  if (v == null) return "";
  const sat = Math.min(1, Math.abs(v) / 50);
  if (sat < 0.05) return "";
  const isBad = lower ? v > 0 : v < 0;
  const alpha = (sat * 0.45).toFixed(2);
  return isBad
    ? `rgba(225, 29, 72, ${alpha})` // rose-600
    : `rgba(5, 150, 105, ${alpha})`; // emerald-600
}

const STATUS_META: Record<Status, { label: string; cls: string; icon: string }> = {
  critical: { label: "Critica", cls: "bg-rose-100 text-rose-800 border-rose-300", icon: "🚨" },
  watch: {
    label: "Da sorvegliare",
    cls: "bg-amber-100 text-amber-800 border-amber-300",
    icon: "⚠️",
  },
  growing: {
    label: "In crescita",
    cls: "bg-emerald-100 text-emerald-800 border-emerald-300",
    icon: "✅",
  },
  stable: { label: "Stabile", cls: "bg-slate-100 text-slate-700 border-slate-300", icon: "➖" },
  newBad: {
    label: "Lancio sotto media",
    cls: "bg-rose-100 text-rose-800 border-rose-300",
    icon: "🚨🆕",
  },
  newOk: {
    label: "Nuova creative",
    cls: "bg-violet-100 text-violet-800 border-violet-300",
    icon: "🆕",
  },
};

const COLS: { key: keyof MetricSet; label: string; lower: boolean }[] = [
  { key: "cpc", label: "CPC", lower: true },
  { key: "cpl", label: "CPL", lower: true },
  { key: "ctr", label: "CTR", lower: false },
  { key: "hookRate", label: "Hook", lower: false },
  { key: "holdRate", label: "Hold", lower: false },
  { key: "bounceRate", label: "Bounce", lower: true },
  { key: "scrollAvg", label: "Scroll", lower: false },
];

export function CreativeTrendCard({
  accessToken,
  onOpen,
  source = "meta",
}: {
  accessToken: string;
  onOpen: (adId: string) => void;
  source?: "meta" | "tiktok";
}) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [onlyCritical, setOnlyCritical] = useState(false);
  const [onlyNew, setOnlyNew] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [windowDays, setWindowDays] = useState<7 | 14 | 30>(7);
  const [onlyMature, setOnlyMature] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setAiSummary(null);
    const fetcher =
      source === "tiktok"
        ? getTikTokCreativeWowSnapshot({ data: { accessToken, windowDays } })
        : getCreativeWowSnapshot({ data: { accessToken, windowDays } });
    fetcher
      .then((r) => {
        if (!alive || !r.ok) return;
        setItems(r.items as Item[]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [accessToken, windowDays, source]);

  // Media account su current per benchmark "nuove creative"
  const accountAvg = useMemo(() => {
    const valid = items.filter((i) => i.cur.spend > 0);
    if (valid.length === 0) return { cpc: 0, bounceRate: 0, scrollAvg: 0 };
    const cpcs = valid.filter((i) => i.cur.cpc > 0).map((i) => i.cur.cpc);
    const bounces = valid.filter((i) => i.cur.sessions > 0).map((i) => i.cur.bounceRate);
    const scrolls = valid.filter((i) => i.cur.sessions > 0).map((i) => i.cur.scrollAvg);
    const avg = (xs: number[]) => (xs.length > 0 ? xs.reduce((s, v) => s + v, 0) / xs.length : 0);
    return { cpc: avg(cpcs), bounceRate: avg(bounces), scrollAvg: avg(scrolls) };
  }, [items]);

  const evaluated = useMemo(
    () =>
      items
        .filter((i) => i.cur.spend > 0 || i.prev.spend > 0)
        .map((i) => ({ item: i, ev: evaluateRow(i, accountAvg) }))
        .sort((a, b) => {
          const order: Status[] = ["critical", "newBad", "watch", "stable", "newOk", "growing"];
          return order.indexOf(a.ev.status) - order.indexOf(b.ev.status);
        }),
    [items, accountAvg],
  );

  const filtered = useMemo(
    () =>
      evaluated.filter(({ ev, item }) => {
        if (onlyCritical && ev.status !== "critical" && ev.status !== "newBad") return false;
        if (onlyNew && !item.isNew) return false;
        if (onlyMature && (item.ageDays == null || item.ageDays < 30)) return false;
        return true;
      }),
    [evaluated, onlyCritical, onlyNew, onlyMature],
  );

  // Account totale: aggrega cur/prev di TUTTE le creative attive (non filtrate),
  // così la riga benchmark resta stabile anche con filtri locali applicati.
  const accountTotals = useMemo(() => {
    if (evaluated.length === 0) return null;
    const build = (sel: "cur" | "prev"): MetricSet => {
      let totSpend = 0,
        totLeads = 0,
        totSessions = 0;
      for (const { item } of evaluated) {
        const m = item[sel];
        totSpend += m.spend;
        totLeads += m.leads;
        totSessions += m.sessions;
      }
      // Medie pesate per spend (proxy di significatività) sulle metriche derivate.
      const avgWeighted = (sel2: (m: MetricSet) => number) => {
        let num = 0,
          den = 0;
        for (const { item } of evaluated) {
          const m = item[sel];
          const w = m.spend;
          if (w > 0 && isFinite(sel2(m))) {
            num += sel2(m) * w;
            den += w;
          }
        }
        return den > 0 ? num / den : 0;
      };
      return {
        cpc: avgWeighted((m) => m.cpc),
        cpl: totLeads > 0 ? totSpend / totLeads : 0,
        ctr: avgWeighted((m) => m.ctr),
        hookRate: avgWeighted((m) => m.hookRate),
        holdRate: avgWeighted((m) => m.holdRate),
        bounceRate: avgWeighted((m) => m.bounceRate),
        scrollAvg: avgWeighted((m) => m.scrollAvg),
        timeOnPage: avgWeighted((m) => m.timeOnPage),
        leads: totLeads,
        sessions: totSessions,
        spend: totSpend,
      };
    };
    const cur = build("cur");
    const prev = build("prev");
    const fakeItem: Item = {
      adId: "__account__",
      adName: "Account totale",
      campaignName: "Benchmark aggregato",
      cur,
      prev,
      isNew: false,
      scoreCur: null,
      scorePrev: null,
      scoreSeries: [],
      sparkCpc: [],
      firstSeenISO: null,
      ageDays: null,
    };
    const ev = evaluateRow(fakeItem, accountAvg);
    return { item: fakeItem, ev };
  }, [evaluated, accountAvg]);

  if (loading) {
    return (
      <div className="bg-white border border-border rounded-xl p-4 flex items-center gap-2 text-[12px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Calcolo trend creative WoW…
      </div>
    );
  }
  if (evaluated.length === 0) {
    return (
      <div className="bg-white border border-border rounded-xl p-4">
        <div className="text-[12.5px] font-semibold mb-1 inline-flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5" /> Trend Creative · settimana corrente vs precedente
        </div>
        <div className="text-[11px] text-muted-foreground">
          Nessun dato disponibile per il confronto WoW. Servono almeno 14 giorni di spesa.
        </div>
      </div>
    );
  }

  const counts = {
    critical: evaluated.filter(({ ev }) => ev.status === "critical" || ev.status === "newBad")
      .length,
    growing: evaluated.filter(({ ev }) => ev.status === "growing").length,
    new: evaluated.filter(({ item }) => item.isNew).length,
  };

  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div>
          <div className="text-[12.5px] font-semibold inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Trend Creative · ultimi {windowDays}gg vs{" "}
            {windowDays}gg precedenti
          </div>
          <div className="text-[10.5px] text-muted-foreground mt-0.5">
            <span className="text-rose-700 font-semibold">{counts.critical}</span> critiche ·
            <span className="text-emerald-700 font-semibold"> {counts.growing}</span> in crescita ·
            <span className="text-violet-700 font-semibold"> {counts.new}</span> nuove
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <div className="inline-flex rounded border border-border overflow-hidden">
            {([7, 14, 30] as const).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWindowDays(w)}
                className={`px-2 py-1 text-[10.5px] font-medium transition-colors ${
                  windowDays === w
                    ? "bg-foreground text-background"
                    : "bg-white hover:bg-secondary text-muted-foreground"
                }`}
              >
                {w}vs{w}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={async () => {
              if (aiLoading) return;
              setAiLoading(true);
              setAiSummary(null);
              const top = evaluated.slice(0, 12).map(({ item, ev }) => ({
                name: item.adName,
                status: ev.status,
                isNew: item.isNew,
                scoreDelta:
                  item.scoreCur != null && item.scorePrev != null
                    ? item.scoreCur - item.scorePrev
                    : null,
                deltas: Object.fromEntries(
                  Object.entries(ev.deltas).map(([k, v]) => [k, v == null ? null : Math.round(v)]),
                ),
              }));
              const digest = `Creative WoW (${evaluated.length} attive, ${counts.critical} critiche, ${counts.growing} in crescita, ${counts.new} nuove). Top 12: ${JSON.stringify(top)}`;
              const r = await getCreativeWowAiSummary({ data: { accessToken, digest } });
              setAiSummary(r.summary);
              setAiLoading(false);
            }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border bg-secondary/50 hover:bg-secondary text-[10.5px] font-medium disabled:opacity-50"
            disabled={aiLoading || evaluated.length === 0}
          >
            {aiLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Wand2 className="h-3 w-3" />
            )}
            Insight AI
          </button>
          <label className="inline-flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyCritical}
              onChange={(e) => setOnlyCritical(e.target.checked)}
              className="h-3 w-3"
            />
            Solo critiche
          </label>
          <label className="inline-flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyNew}
              onChange={(e) => setOnlyNew(e.target.checked)}
              className="h-3 w-3"
            />
            Solo nuove
          </label>
          <label
            className="inline-flex items-center gap-1 cursor-pointer"
            title="Mostra solo creative con prima spesa registrata da almeno 30 giorni: distingue fatigue genuino da rumore di lancio."
          >
            <input
              type="checkbox"
              checked={onlyMature}
              onChange={(e) => setOnlyMature(e.target.checked)}
              className="h-3 w-3"
            />
            Solo &gt;30gg
          </label>
        </div>
      </div>

      {aiSummary && (
        <div className="mb-3 p-2.5 rounded border border-violet-200 bg-violet-50/60 text-[11.5px] text-violet-900 leading-snug inline-flex items-start gap-1.5">
          <Sparkles className="h-3 w-3 mt-0.5 shrink-0" />
          <span>{aiSummary}</span>
        </div>
      )}

      <div className="overflow-x-auto -mx-1 max-h-[60vh] overflow-y-auto">
        <table className="w-full text-[11.5px]">
          <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_var(--border)]">
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="font-medium px-2 py-1.5 bg-white">Creative</th>
              <th className="font-medium px-2 py-1.5 text-center bg-white">
                Trend {windowDays * 2}g
              </th>
              {COLS.map((c) => (
                <th
                  key={c.key}
                  className="font-medium px-2 py-1.5 text-right tabular-nums bg-white"
                >
                  {c.label}
                </th>
              ))}
              <th
                className="font-medium px-2 py-1.5 text-right tabular-nums bg-white"
                title="Composite Score current vs ~periodo fa"
              >
                Score
              </th>
              <th className="font-medium px-2 py-1.5 text-right bg-white">Status</th>
            </tr>
          </thead>
          <tbody>
            {accountTotals &&
              (() => {
                const { ev } = accountTotals;
                return (
                  <tr className="sticky top-[33px] z-[9] bg-amber-50/95 backdrop-blur border-b-2 border-amber-300">
                    <td className="px-2 py-1.5 max-w-[260px]">
                      <div className="font-semibold text-amber-900 text-[11px] uppercase tracking-wide">
                        📊 Account totale
                      </div>
                      <div className="text-[10px] text-amber-700/80">
                        Benchmark aggregato · {evaluated.length} creative
                      </div>
                    </td>
                    <td className="px-2 py-1.5" />
                    {COLS.map((c) => {
                      const d = ev.deltas[c.key];
                      const f = fmtPct(d, c.lower);
                      const Arrow = f.arrow;
                      const bg = heatBg(d, c.lower);
                      return (
                        <td
                          key={c.key}
                          className={`px-2 py-1.5 text-right tabular-nums font-semibold ${f.cls}`}
                          style={bg ? { backgroundColor: bg } : undefined}
                        >
                          <span className="inline-flex items-center gap-0.5 justify-end">
                            {Arrow && <Arrow className="h-3 w-3" />}
                            {f.text}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-2 py-1.5 text-right text-muted-foreground">—</td>
                    <td className="px-2 py-1.5 text-right">
                      <span className="text-[10px] text-amber-800/80 italic">benchmark</span>
                    </td>
                  </tr>
                );
              })()}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={COLS.length + 4}
                  className="text-center text-muted-foreground italic py-4"
                >
                  Nessuna creative con i filtri selezionati.
                </td>
              </tr>
            )}
            {filtered.map(({ item, ev }) => {
              const meta = STATUS_META[ev.status];
              const scoreDelta =
                item.scoreCur != null && item.scorePrev != null
                  ? item.scoreCur - item.scorePrev
                  : null;
              const scoreCls =
                scoreDelta == null
                  ? "text-muted-foreground"
                  : scoreDelta >= 5
                    ? "text-emerald-700"
                    : scoreDelta <= -5
                      ? "text-rose-700"
                      : "text-muted-foreground";
              const sparkColor =
                item.sparkCpc.length >= 2
                  ? item.sparkCpc[item.sparkCpc.length - 1] > item.sparkCpc[0]
                    ? "#e11d48"
                    : "#059669"
                  : "#71717a";
              return (
                <tr
                  key={item.adId}
                  className="border-b border-border/60 hover:bg-secondary/30 transition-colors"
                >
                  <td className="px-2 py-1.5 max-w-[260px]">
                    <button
                      type="button"
                      onClick={() => onOpen(item.adId)}
                      className="text-left w-full hover:underline"
                      title={item.adName}
                    >
                      <div className="font-medium truncate">{item.adName}</div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {item.campaignName}
                      </div>
                    </button>
                  </td>
                  <td className="px-2 py-1.5">
                    <div
                      className="flex justify-center"
                      title={`CPC giornaliero ultimi ${item.sparkCpc.length}gg`}
                    >
                      <Sparkline values={item.sparkCpc} color={sparkColor} width={64} height={20} />
                    </div>
                  </td>
                  {COLS.map((c) => {
                    const d = ev.deltas[c.key];
                    const f = fmtPct(d, c.lower);
                    const Arrow = f.arrow;
                    const bg = heatBg(d, c.lower);
                    return (
                      <td
                        key={c.key}
                        className={`px-2 py-1.5 text-right tabular-nums ${f.cls}`}
                        style={bg ? { backgroundColor: bg } : undefined}
                      >
                        <span className="inline-flex items-center gap-0.5 justify-end">
                          {Arrow && <Arrow className="h-3 w-3" />}
                          {f.text}
                        </span>
                      </td>
                    );
                  })}
                  <td
                    className={`px-2 py-1.5 text-right tabular-nums ${scoreCls}`}
                    title={
                      item.scoreCur != null
                        ? `Score attuale: ${item.scoreCur}${item.scorePrev != null ? ` · 7gg fa: ${item.scorePrev}` : ""}`
                        : "Storico insufficiente"
                    }
                  >
                    {scoreDelta == null
                      ? "—"
                      : `${scoreDelta > 0 ? "+" : ""}${scoreDelta.toFixed(0)}`}
                  </td>
                  <td className="px-2 py-1.5 text-right">
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10.5px] font-medium ${meta.cls}`}
                      title={
                        ev.worstReason ||
                        `${ev.worsenedCount} metriche peggiorate · ${ev.improvedCount} migliorate`
                      }
                    >
                      <span>{meta.icon}</span>
                      {meta.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-[10px] text-muted-foreground mt-2 inline-flex items-center gap-1">
        <AlertTriangle className="h-2.5 w-2.5" />
        Soglie: 🚨 ≥3 metriche peggiorate &gt;15% · CPL +50% · Bounce +20% · ✅ ≥2 metriche
        migliorate &gt;10%
      </div>
    </div>
  );
}
