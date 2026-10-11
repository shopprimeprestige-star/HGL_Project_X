import { TrendingUp, TrendingDown, Minus, AlertTriangle, Flame, TrendingUp as TUp, TrendingDown as TDown, Trophy, Skull, Sparkles } from "lucide-react";
import type { TodayVsYesterday, AdsAlerts, RankedAd } from "./insights";
import { healthColor } from "./insights";
import type { WoWResult } from "./quality-v2";

const fmtEUR = (v: number) => `€${v.toLocaleString("it-IT", { maximumFractionDigits: 0 })}`;
const fmtINT = (v: number) => Math.round(v).toLocaleString("it-IT");
const fmtX = (v: number) => `${v.toFixed(2)}x`;
const fmtPct = (v: number | null): string => v == null ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`;

/** 4 KPI compatti con delta % vs ieri. */
export function TodayKpiPanel({ data }: { data: TodayVsYesterday }) {
  if (!data.hasData) {
    return (
      <div className="rounded-xl border border-border bg-white p-3 text-[12px] text-muted-foreground">
        Dati insufficienti per il confronto Oggi vs Ieri.
      </div>
    );
  }
  const items: { label: string; today: string; delta: number | null; lowerIsBetter?: boolean }[] = [
    { label: "Spesa", today: fmtEUR(data.today.spend), delta: data.delta.spend },
    { label: "Lead", today: fmtINT(data.today.lead), delta: data.delta.lead },
    { label: "CPL", today: fmtEUR(data.today.cpl), delta: data.delta.cpl, lowerIsBetter: true },
    { label: "ROAS", today: fmtX(data.today.roas), delta: data.delta.roas },
  ];
  return (
    <div className="rounded-xl border border-border bg-white">
      <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Oggi vs Ieri</div>
        <div className="text-[10.5px] text-muted-foreground">basato sulle ultime 2 date di sync</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border border-t border-border">
        {items.map((it) => {
          const delta = it.delta;
          const positive = delta != null && (it.lowerIsBetter ? delta < 0 : delta > 0);
          const negative = delta != null && (it.lowerIsBetter ? delta > 0 : delta < 0);
          const Icon = delta == null ? Minus : positive ? TrendingUp : negative ? TrendingDown : Minus;
          const cls = delta == null
            ? "text-muted-foreground"
            : positive ? "text-emerald-600" : negative ? "text-rose-600" : "text-muted-foreground";
          return (
            <div key={it.label} className="px-3 py-2.5">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{it.label}</div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="text-[16px] font-semibold tabular-nums">{it.today}</span>
                <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${cls}`}>
                  <Icon className="h-3 w-3" /> {fmtPct(delta)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** WoW: ultimi 7 giorni vs 7 precedenti — gemello di TodayKpiPanel.
 *  Dà visibilità sul trend reale (più stabile del confronto giornaliero). */
export function WoWPanel({ data }: { data: WoWResult }) {
  if (!data.hasData) {
    return (
      <div className="rounded-xl border border-border bg-white p-3 text-[12px] text-muted-foreground">
        Dati insufficienti per il confronto WoW (servono almeno 14 giorni).
      </div>
    );
  }
  const items: { label: string; today: string; delta: number | null; lowerIsBetter?: boolean }[] = [
    { label: "Spesa", today: fmtEUR(data.current.spend), delta: data.delta.spend },
    { label: "Lead", today: fmtINT(data.current.lead), delta: data.delta.lead },
    { label: "CPL", today: fmtEUR(data.current.cpl), delta: data.delta.cpl, lowerIsBetter: true },
    { label: "ROAS", today: fmtX(data.current.roas), delta: data.delta.roas },
  ];
  return (
    <div className="rounded-xl border border-border bg-white">
      <div className="px-3 pt-2.5 pb-1.5 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Ultimi 7gg vs 7gg precedenti</div>
        <div className="text-[10.5px] text-muted-foreground">trend stabile WoW</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border border-t border-border">
        {items.map((it) => {
          const delta = it.delta;
          const positive = delta != null && (it.lowerIsBetter ? delta < 0 : delta > 0);
          const negative = delta != null && (it.lowerIsBetter ? delta > 0 : delta < 0);
          const Icon = delta == null ? Minus : positive ? TrendingUp : negative ? TrendingDown : Minus;
          const cls = delta == null
            ? "text-muted-foreground"
            : positive ? "text-emerald-600" : negative ? "text-rose-600" : "text-muted-foreground";
          return (
            <div key={it.label} className="px-3 py-2.5">
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{it.label}</div>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="text-[16px] font-semibold tabular-nums">{it.today}</span>
                <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${cls}`}>
                  <Icon className="h-3 w-3" /> {fmtPct(delta)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Badge "Predicted CPL Tomorrow" — proiezione regressione lineare 7gg.
 *  Confronta la previsione con il CPL medio degli ultimi 7gg per dare un tono. */
export function PredictedCplBadge({
  predicted, currentAvg, trend7d,
}: {
  predicted: number | null;
  currentAvg: number | null;
  /** Ultimi 7 punti CPL (giorno per giorno) per la sparkline. */
  trend7d?: number[];
}) {
  if (predicted == null) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border bg-white text-[11.5px] text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 opacity-60" />
        <span>Predicted CPL domani: dati insufficienti (≥3 giorni)</span>
      </div>
    );
  }
  const delta = currentAvg && currentAvg > 0 ? ((predicted - currentAvg) / currentAvg) * 100 : null;
  // CPL: lower is better → delta negativo = positivo (success)
  const tone = delta == null
    ? "bg-white border-border text-foreground"
    : delta <= -5 ? "bg-success/10 border-success/30 text-success"
    : delta >= 10 ? "bg-destructive/10 border-destructive/30 text-destructive"
    : delta >= 5 ? "bg-warning/10 border-warning/40 text-warning-foreground"
    : "bg-white border-border text-foreground";
  const arrow = delta == null ? null
    : delta < 0 ? <TrendingDown className="h-3.5 w-3.5" />
    : delta > 0 ? <TrendingUp className="h-3.5 w-3.5" />
    : <Minus className="h-3.5 w-3.5" />;
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-md border ${tone}`}>
      <Sparkles className="h-3.5 w-3.5 opacity-80" />
      <span className="text-[10.5px] uppercase tracking-wider font-semibold opacity-80">Predicted CPL domani</span>
      <span className="text-[15px] font-bold tabular-nums">{fmtEUR(predicted)}</span>
      {delta != null && (
        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium">
          {arrow} {fmtPct(delta)}
        </span>
      )}
      {trend7d && trend7d.length >= 2 && (
        <CplSparkline points={trend7d} predicted={predicted} />
      )}
      <span className="text-[10.5px] opacity-70 ml-1">regressione lineare ultimi 7gg</span>
    </div>
  );
}

/** Mini sparkline CPL: linea piena per ultimi 7gg + segmento tratteggiato
 *  verso il punto proiettato di domani. Render come SVG inline. */
function CplSparkline({ points, predicted }: { points: number[]; predicted: number }) {
  const W = 80, H = 24, PAD = 2;
  const all = [...points, predicted];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const range = max - min || 1;
  const stepX = (W - PAD * 2) / (all.length - 1);
  const y = (v: number) => H - PAD - ((v - min) / range) * (H - PAD * 2);
  const x = (i: number) => PAD + i * stepX;
  // Path solido = ultimi 7gg
  const solidPath = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  // Path tratteggiato = ultimo punto storico → predicted
  const lastIdx = points.length - 1;
  const dashedPath = `M${x(lastIdx).toFixed(1)},${y(points[lastIdx]).toFixed(1)} L${x(all.length - 1).toFixed(1)},${y(predicted).toFixed(1)}`;
  return (
    <svg width={W} height={H} className="opacity-90" aria-hidden="true">
      <path d={solidPath} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={dashedPath} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" />
      {/* punto predicted */}
      <circle cx={x(all.length - 1)} cy={y(predicted)} r="2" fill="currentColor" />
    </svg>
  );
}

/** Alert bar contestuale: budget sforato · CPL outlier · ad in degrado.
 *  Cliccando "X in degrado" attiva il filtro globale. */
export function AdsAlertBar({
  alerts,
  onShowDegraded,
}: {
  alerts: AdsAlerts;
  onShowDegraded: () => void;
}) {
  const parts: { key: string; node: React.ReactNode; tone?: "critical" | "warn" }[] = [];

  // CRITICO: spesa > 0 ma 0 lead generati nel periodo
  if (alerts.noLeads) {
    parts.push({
      key: "noLeads",
      tone: "critical",
      node: (
        <span className="inline-flex items-center gap-1">
          <XCircleLike />
          Spesa <span className="font-semibold tabular-nums">{fmtEUR(alerts.noLeads.totalSpend)}</span> · 0 lead generati · CPL non valutabile
        </span>
      ),
    });
  }
  if (alerts.zeroLeadAds.length > 0) {
    parts.push({
      key: "zero",
      tone: "critical",
      node: (
        <span className="inline-flex items-center gap-1">
          <Flame className="h-3.5 w-3.5" />
          <span className="font-semibold">{alerts.zeroLeadAds.length}</span> ad con spesa &gt; 0 e 0 lead
        </span>
      ),
    });
  }
  if (alerts.overBudget.length > 0) {
    const ob = alerts.overBudget[0];
    parts.push({
      key: "budget",
      tone: "warn",
      node: (
        <span className="inline-flex items-center gap-1">
          <Flame className="h-3.5 w-3.5" />
          Spesa di oggi <span className="font-semibold tabular-nums">{fmtEUR(ob.spend)}</span> oltre il budget di <span className="font-semibold tabular-nums">{fmtEUR(ob.budget)}</span>
        </span>
      ),
    });
  }
  if (alerts.cplOutlier.length > 0) {
    parts.push({
      key: "cpl",
      tone: "warn",
      node: (
        <span className="inline-flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="font-semibold">{alerts.cplOutlier.length}</span> ad con CPL &gt; 1.5× media periodo (<span className="tabular-nums">{fmtEUR(alerts.periodAvgCpl)}</span>)
        </span>
      ),
    });
  }
  if (alerts.degradedCount > 0) {
    parts.push({
      key: "deg",
      tone: "warn",
      node: (
        <button
          type="button"
          onClick={onShowDegraded}
          className="inline-flex items-center gap-1 hover:underline underline-offset-2"
          title="Filtra solo le ad in degrado"
        >
          <TDown className="h-3.5 w-3.5" />
          <span className="font-semibold">{alerts.degradedCount}</span> ad in degrado · filtra →
        </button>
      ),
    });
  }
  if (parts.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-[12.5px] text-emerald-800 inline-flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Nessun alert: budget rispettato, CPL nella media del periodo, lead generati e nessuna ad in degrado.
      </div>
    );
  }
  const hasCritical = parts.some((p) => p.tone === "critical");
  const wrapperCls = hasCritical
    ? "rounded-xl border border-rose-300 bg-rose-50/80 px-3 py-2 text-[12.5px] text-rose-900 flex items-center gap-3 flex-wrap"
    : "rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[12.5px] text-amber-900 flex items-center gap-3 flex-wrap";
  const sepCls = hasCritical ? "mx-2 text-rose-300" : "mx-2 text-amber-400";
  return (
    <div className={wrapperCls}>
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      {parts.map((p, i) => (
        <span key={p.key} className="inline-flex items-center">
          {p.node}
          {i < parts.length - 1 && <span className={sepCls}>·</span>}
        </span>
      ))}
    </div>
  );
}

function XCircleLike() {
  return (
    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-rose-600 text-white text-[9px] font-bold leading-none">!</span>
  );
}

/** Card vincitore/perdente compatta. */
export function PodiumCard({
  kind,
  rank,
  name,
  primaryLabel,
  primaryValue,
  hint,
  onClick,
}: {
  kind: "winner" | "loser";
  rank: number;
  name: string;
  primaryLabel: string;
  primaryValue: string;
  hint?: string;
  onClick?: () => void;
}) {
  const isWin = kind === "winner";
  const Icon = isWin ? Trophy : Skull;
  const cls = isWin
    ? "border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50"
    : "border-rose-200 bg-rose-50/60 hover:bg-rose-50";
  const iconCls = isWin ? "text-emerald-600" : "text-rose-600";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border ${cls} px-3 py-2.5 transition-colors`}
      title={`Apri dettaglio: ${name}`}
    >
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white border border-current ${iconCls} text-[10px] font-bold`}>
          {rank}
        </span>
        <Icon className={`h-3.5 w-3.5 ${iconCls}`} />
        <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{primaryLabel}</span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-semibold tabular-nums">{primaryValue}</span>
      </div>
      <div className="mt-0.5 text-[12px] text-foreground truncate" title={name}>{name}</div>
      {hint && <div className="text-[10.5px] text-muted-foreground mt-0.5">{hint}</div>}
    </button>
  );
}

/** Riga 3+3 vincitori/perdenti. */
export function PodiumRow({
  winners,
  losers,
  nameById,
  onOpen,
}: {
  winners: RankedAd[];
  losers: RankedAd[];
  nameById: (id: string) => string;
  onOpen: (id: string) => void;
}) {
  if (winners.length === 0 && losers.length === 0) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5 inline-flex items-center gap-1">
          <Trophy className="h-3 w-3 text-emerald-600" /> Vincitori (Top ROAS)
        </div>
        <div className="grid grid-cols-3 gap-2">
          {winners.length === 0 && (
            <div className="col-span-3 text-[12px] text-muted-foreground italic px-1">Nessun vincitore con ROAS positivo nel periodo.</div>
          )}
          {winners.map((w, i) => (
            <PodiumCard
              key={w.ad_id}
              kind="winner"
              rank={i + 1}
              name={nameById(w.ad_id)}
              primaryLabel="ROAS"
              primaryValue={fmtX(w.primary)}
              hint={`spesa ${fmtEUR(w.secondary)}`}
              onClick={() => onOpen(w.ad_id)}
            />
          ))}
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1.5 inline-flex items-center gap-1">
          <Skull className="h-3 w-3 text-rose-600" /> Da fermare (spesa &gt; 0, lead = 0)
        </div>
        <div className="grid grid-cols-3 gap-2">
          {losers.length === 0 && (
            <div className="col-span-3 text-[12px] text-muted-foreground italic px-1">🎉 Nessuna ad sta bruciando budget senza lead.</div>
          )}
          {losers.map((l, i) => (
            <PodiumCard
              key={l.ad_id}
              kind="loser"
              rank={i + 1}
              name={nameById(l.ad_id)}
              primaryLabel="Spesa bruciata"
              primaryValue={fmtEUR(l.primary)}
              hint="0 lead nel periodo"
              onClick={() => onOpen(l.ad_id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Pill con pallino colorato per il punteggio Health 0-100. */
export function HealthPill({ score }: { score: number | null }) {
  const c = healthColor(score);
  return (
    <span className={`inline-flex items-center gap-1.5 ${c.text}`} title={`Health ${score ?? "—"}/100 · ${c.label}`}>
      <span className={`h-2 w-2 rounded-full ${c.dot}`} />
      <span className="tabular-nums text-[12.5px] font-medium">{score == null ? "—" : `${score}`}</span>
    </span>
  );
}

// re-export per evitare warning unused
void TUp;
