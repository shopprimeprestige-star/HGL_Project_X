import { useMemo, useState } from "react";
import { Award, Sparkles, Info, ArrowRight, TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Sparkline } from "@/crm/ads-manager/Sparkline";

interface BreakdownItem {
  label: string;
  weight: number;
  current: number;
  previous: number;
  better: boolean;
  goodHigh?: boolean;
  /** Sub-score normalizzato 0-100 per questa metrica (calcolato lato server) */
  subScore?: number;
}

interface Composite {
  score: number;
  breakdown: BreakdownItem[];
}

interface MetricGuide {
  formula: string;
  benchmark: string;
  action: string;
}

/**
 * Guida per metrica: formula esatta, benchmark di settore, azione consigliata.
 * Usata nel tooltip al hover di ogni barra del chart.
 */
const METRIC_GUIDE: Record<string, MetricGuide> = {
  "CVR (lead/sessioni)": {
    formula: "lead_CRM / sessioni_LP × 100",
    benchmark: "Buono: > 8% · Medio: 3–8% · Scarso: < 3%",
    action: "Migliora coerenza ad↔LP, riduci frizioni nel form, aggiungi prove sociali sopra la fold.",
  },
  "Scroll medio %": {
    formula: "Σ max_scroll / sessioni",
    benchmark: "Buono: > 60% · Medio: 35–60% · Scarso: < 35%",
    action: "Riscrivi l'hero, accorcia il primo blocco, sposta CTA/prova sociale entro il primo schermo.",
  },
  "Hold rate (p75)": {
    formula: "video_thruplays / video_views × 100  (views = chi ha visto ≥3s)",
    benchmark: "Buono: > 30% · Medio: 15–30% · Scarso: < 15%",
    action: "Mantieni alta la tensione narrativa, taglia 'plateau' a metà video, aggiungi pattern interrupt.",
  },
  CPL: {
    formula: "spend / lead_CRM",
    benchmark: "Dipende dal settore. Scendi del 20% sotto il tuo CPL target è ottimo.",
    action: "Ottimizza creative (hook), restringi audience ai segmenti con CVR alta, escludi chi ha già convertito.",
  },
  "Tempo medio (s)": {
    formula: "Σ time_on_page / sessioni",
    benchmark: "Buono: > 60s · Medio: 25–60s · Scarso: < 25s",
    action: "Aumenta valore percepito sopra la fold, aggiungi video o sezione benefici, riduci wall-of-text.",
  },
  "Hook rate (p25)": {
    formula: "video_3_sec_watched / video_plays × 100  (formula Meta ufficiale)",
    benchmark: "Buono: > 40% · Medio: 25–40% · Scarso: < 25%",
    action: "Riscrivi i primi 3 secondi: domanda forte, contrasto visivo, claim diretto. Niente intro lunghe.",
  },
  "Completion rate": {
    formula: "video_p100_watched / video_views × 100  (views = chi ha visto ≥3s)",
    benchmark: "Buono: > 25% · Medio: 10–25% · Scarso: < 10%",
    action: "Accorcia il video, sposta la CTA prima del finale, costruisci attesa nei primi 5 secondi.",
  },
  "Bounce rate": {
    formula: "sessioni_bounce / sessioni_totali × 100  (good = basso)",
    benchmark: "Buono: < 40% · Medio: 40–65% · Scarso: > 65%",
    action: "Allinea promessa ad ↔ headline LP, velocità mobile, evita pop-up immediati, cambia immagine hero.",
  },
  CPM: {
    formula: "spend / impressions × 1000  (good = basso)",
    benchmark: "Buono: < €8 · Medio: €8–€15 · Scarso: > €15",
    action: "Migliora ranking creative (CTR↑), allarga audience, evita sovrapposizioni di adset, testa nuove placement.",
  },
  Frequenza: {
    formula: "impressions / reach  (good = basso)",
    benchmark: "Ottimale: 1.0–2.5 · Stanchezza: 2.5–4 · Critica: > 4",
    action: "Refresh creative, ruota varianti, allarga audience o aggiungi esclusioni. Pausa se freq > 5.",
  },
};

function scoreLabel(score: number): { label: string; tone: string; emoji: string } {
  if (score >= 75) return { label: "Top performer", tone: "bg-emerald-50 text-emerald-800 border-emerald-300", emoji: "🔥" };
  if (score >= 60) return { label: "Sopra media", tone: "bg-emerald-50/70 text-emerald-700 border-emerald-200", emoji: "✓" };
  if (score >= 45) return { label: "In media", tone: "bg-secondary text-muted-foreground border-border", emoji: "—" };
  if (score >= 30) return { label: "Sotto media", tone: "bg-amber-50 text-amber-800 border-amber-300", emoji: "⚠" };
  return { label: "Critica", tone: "bg-rose-50 text-rose-800 border-rose-300", emoji: "🔻" };
}

function formatVal(label: string, v: number): string {
  if (!isFinite(v)) return "—";
  if (label.includes("CPL") || label.includes("CPM") || label.includes("Spesa")) {
    return `€${v.toLocaleString("it-IT", { maximumFractionDigits: 2 })}`;
  }
  if (label.includes("Frequenza") || label.includes("Disagio")) return v.toFixed(2);
  if (label.includes("Tempo")) return `${v.toFixed(0)}s`;
  return `${v.toFixed(1)}%`;
}

/** Colore della barra in base allo score 0-100. */
function barTone(score: number): { bar: string; text: string; hex: string } {
  if (score >= 70) return { bar: "bg-emerald-500", text: "text-emerald-700", hex: "#10b981" };
  if (score >= 50) return { bar: "bg-emerald-400", text: "text-emerald-600", hex: "#34d399" };
  if (score >= 35) return { bar: "bg-amber-400", text: "text-amber-700", hex: "#f59e0b" };
  return { bar: "bg-rose-500", text: "text-rose-700", hex: "#ef4444" };
}

function fallbackSubScore(b: BreakdownItem): number {
  const eps = 1e-6;
  const goodHigh = b.goodHigh !== false;
  if (Math.abs(b.previous) < eps && Math.abs(b.current) < eps) return 0;
  if (Math.abs(b.previous) < eps) return goodHigh ? 60 : 40;
  if (Math.abs(b.current) < eps) return goodHigh ? 10 : 70;
  const ratio = b.current / Math.max(b.previous, eps);
  const adj = goodHigh ? ratio : 1 / Math.max(ratio, 0.01);
  return Math.max(0, Math.min(100, 50 * adj));
}

type SparkRange = 7 | 30 | 90;

/** Calcola età creativa in giorni dal primo spend. */
function ageBadge(firstActivity: string | null | undefined): {
  days: number;
  label: string;
  tone: string;
  hint: string;
} | null {
  if (!firstActivity) return null;
  const first = new Date(firstActivity);
  if (isNaN(first.getTime())) return null;
  const days = Math.max(0, Math.floor((Date.now() - first.getTime()) / 86400000));
  if (days <= 7) {
    return {
      days,
      label: `${days}g · Nuova`,
      tone: "bg-sky-50 text-sky-800 border-sky-300",
      hint: "Creative giovane: dati ancora in fase di stabilizzazione, soglie di gating più permissive.",
    };
  }
  if (days <= 21) {
    return {
      days,
      label: `${days}g · Maturazione`,
      tone: "bg-emerald-50 text-emerald-800 border-emerald-300",
      hint: "Periodo ottimale: la creative ha dati abbastanza stabili e non è ancora in fatigue.",
    };
  }
  if (days <= 45) {
    return {
      days,
      label: `${days}g · Matura`,
      tone: "bg-amber-50 text-amber-800 border-amber-300",
      hint: "Sorvegliare: monitora frequenza e CPL, prepara varianti se vedi degrado.",
    };
  }
  return {
    days,
    label: `${days}g · Stanca`,
    tone: "bg-rose-50 text-rose-800 border-rose-300",
    hint: "Probabile fatigue: valuta refresh, nuove varianti o esclusione audience che ha già visto.",
  };
}

export function CompositeScoreCard({
  composite,
  history,
  firstActivity,
}: {
  composite: Composite;
  /** Storico fino a 90gg passato dal parent. */
  history?: Array<{ date: string; score: number }>;
  /** Data del primo spend (ISO YYYY-MM-DD) per badge Età creativa. */
  firstActivity?: string | null;
}) {
  const meta = scoreLabel(composite.score);
  const sorted = [...composite.breakdown].sort((a, b) => b.weight - a.weight);
  const [sparkRange, setSparkRange] = useState<SparkRange>(30);
  const age = ageBadge(firstActivity);

  const filteredHistory = useMemo(() => {
    if (!history || history.length === 0) return [] as Array<{ date: string; score: number }>;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - sparkRange);
    return history.filter((h) => new Date(h.date) >= cutoff);
  }, [history, sparkRange]);

  const sparkValues = filteredHistory.map((h) => h.score);
  const sparkColor = composite.score >= 60 ? "#10b981" : composite.score >= 45 ? "#f59e0b" : "#ef4444";

  // Variazione vs 7 giorni fa (sempre, indipendente dal range visualizzato)
  const delta7d = useMemo(() => {
    if (!history || history.length < 2) return null;
    const sevenAgo = new Date();
    sevenAgo.setDate(sevenAgo.getDate() - 7);
    const past = [...history].reverse().find((h) => new Date(h.date) <= sevenAgo);
    if (!past || past.score <= 0) return null;
    const diff = composite.score - past.score;
    const pct = (diff / past.score) * 100;
    return { diff, pct, pastScore: past.score, pastDate: past.date };
  }, [history, composite.score]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="bg-white border border-border rounded-xl p-4">
        {/* Header con score totale */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <Award className="h-4 w-4 text-[oklch(0.55_0.18_252)]" />
          <div className="text-[12.5px] font-semibold">Score qualità composito</div>
          <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${meta.tone}`}>
            {meta.emoji} {meta.label}
          </span>
          {age && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border cursor-help ${age.tone}`}
                >
                  <Calendar className="h-3 w-3" />
                  {age.label}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[260px] text-[11px] leading-snug">
                <div className="font-semibold mb-1">Età creativa: {age.days} giorni</div>
                <div>{age.hint}</div>
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="inline-grid place-items-center h-5 w-5 rounded-full hover:bg-secondary text-muted-foreground">
                <Info className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-[300px] text-[11px] leading-snug">
              Score 0–100 calcolato come media pesata di 10 metriche (CVR, scroll, tempo, hook/hold/completion, CPL, CPM, frequenza). Ogni barra indica quanto la metrica performa rispetto al periodo precedente: <span className="font-semibold text-emerald-700">verde</span> = sopra media, <span className="font-semibold text-amber-700">giallo</span> = stabile, <span className="font-semibold text-rose-700">rosso</span> = peggiorata.
            </TooltipContent>
          </Tooltip>
          <div className="ml-auto flex items-center gap-3 flex-wrap">
            {history && history.length >= 2 && (
              <div className="inline-flex items-center rounded-md border border-border bg-secondary/40 p-0.5 text-[10px]">
                {([7, 30, 90] as SparkRange[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSparkRange(r)}
                    className={`px-1.5 py-0.5 rounded font-medium tabular-nums transition-colors ${
                      sparkRange === r ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r}g
                  </button>
                ))}
              </div>
            )}
            {sparkValues.length >= 2 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex flex-col items-end leading-none cursor-help">
                    <Sparkline values={sparkValues} width={90} height={26} color={sparkColor} area />
                    <span className="text-[9px] text-muted-foreground mt-0.5">ultimi {sparkValues.length}gg</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[11px]">
                  <div className="font-semibold mb-1">Storico Composite Score</div>
                  <div>Range: {sparkRange}gg · Punti: {sparkValues.length}</div>
                  <div>Min: {Math.round(Math.min(...sparkValues))} · Max: {Math.round(Math.max(...sparkValues))} · Oggi: {Math.round(sparkValues[sparkValues.length - 1])}</div>
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="text-[10px] text-muted-foreground italic">Storico in costruzione…</div>
            )}
            <div className="flex flex-col items-end leading-none">
              <div className="flex items-baseline gap-1">
                <span className="text-[28px] font-bold tabular-nums leading-none">{Math.round(composite.score)}</span>
                <span className="text-[12px] text-muted-foreground">/100</span>
              </div>
              {delta7d ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className={`mt-0.5 inline-flex items-center gap-0.5 text-[10.5px] font-semibold cursor-help ${
                        delta7d.diff > 0.5 ? "text-emerald-700" : delta7d.diff < -0.5 ? "text-rose-700" : "text-muted-foreground"
                      }`}
                    >
                      {delta7d.diff > 0.5 ? <TrendingUp className="h-3 w-3" /> : delta7d.diff < -0.5 ? <TrendingDown className="h-3 w-3" /> : null}
                      {delta7d.diff > 0 ? "+" : ""}{delta7d.diff.toFixed(1)} pt · {delta7d.pct > 0 ? "+" : ""}{delta7d.pct.toFixed(1)}%
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[11px]">
                    Variazione vs 7 giorni fa<br />
                    Score 7gg fa ({delta7d.pastDate}): <span className="font-semibold tabular-nums">{Math.round(delta7d.pastScore)}</span><br />
                    Oggi: <span className="font-semibold tabular-nums">{Math.round(composite.score)}</span>
                  </TooltipContent>
                </Tooltip>
              ) : history && history.length > 0 ? (
                <span className="mt-0.5 text-[10px] text-muted-foreground italic">delta 7gg n/d</span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Barra principale dello score */}
        <div className="h-2 rounded-full bg-secondary overflow-hidden mb-4">
          <div
            className={`h-full transition-all ${
              composite.score >= 60 ? "bg-emerald-500" : composite.score >= 45 ? "bg-amber-400" : "bg-rose-500"
            }`}
            style={{ width: `${Math.max(0, Math.min(100, composite.score))}%` }}
          />
        </div>

        {/* Legenda intestazione del chart */}
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          <span>Composizione score · barra = quanto sta performando vs prima</span>
          <div className="flex items-center gap-2 normal-case tracking-normal">
            <span className="inline-flex items-center gap-1"><span className="h-1.5 w-3 rounded-sm bg-rose-500" />0</span>
            <span className="inline-flex items-center gap-1"><span className="h-1.5 w-3 rounded-sm bg-amber-400" />50</span>
            <span className="inline-flex items-center gap-1"><span className="h-1.5 w-3 rounded-sm bg-emerald-500" />100</span>
          </div>
        </div>

        {/* Chart: una riga = una metrica, barra orizzontale + valore */}
        <div className="space-y-2">
          {sorted.map((b) => {
            const sub = b.subScore ?? fallbackSubScore(b);
            const tone = barTone(sub);
            const eps = 1e-6;
            const noData = Math.abs(b.current) < eps && Math.abs(b.previous) < eps;
            const isNew = Math.abs(b.previous) < eps && Math.abs(b.current) >= eps;
            const guide = METRIC_GUIDE[b.label];

            const rowInner = (
              <div className={`grid grid-cols-[150px_1fr_auto] items-center gap-3 ${noData ? "opacity-40" : ""} cursor-help rounded hover:bg-secondary/40 px-1 -mx-1 py-0.5`}>
                {/* Label + peso */}
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 inline-flex items-center justify-center h-4 px-1.5 rounded bg-secondary">{b.weight}%</span>
                  <span className="text-[11.5px] truncate" title={b.label}>{b.label}</span>
                </div>
                {/* Barra orizzontale dello sub-score */}
                <div className="relative h-3 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`absolute inset-y-0 left-0 ${tone.bar} transition-all rounded-full`}
                    style={{ width: noData ? "0%" : `${Math.max(2, Math.min(100, sub))}%` }}
                  />
                  <div className="absolute inset-y-0 left-1/2 w-px bg-border/80" />
                </div>
                {/* Valore current → previous */}
                <div className={`text-[10.5px] tabular-nums whitespace-nowrap text-right ${tone.text}`}>
                  {noData ? (
                    <span className="text-muted-foreground">—</span>
                  ) : isNew ? (
                    <span className="inline-flex items-center gap-1">
                      <Sparkles className="h-2.5 w-2.5" />
                      <span className="font-semibold">{formatVal(b.label, b.current)}</span>
                      <span className="text-muted-foreground">nuovo</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <span className="text-muted-foreground">{formatVal(b.label, b.previous)}</span>
                      <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className="font-semibold">{formatVal(b.label, b.current)}</span>
                    </span>
                  )}
                </div>
              </div>
            );

            if (!guide) {
              return <div key={b.label}>{rowInner}</div>;
            }

            return (
              <Tooltip key={b.label}>
                <TooltipTrigger asChild>{rowInner}</TooltipTrigger>
                <TooltipContent side="left" align="center" className="max-w-[320px] text-[11px] leading-snug p-3 space-y-2">
                  <div className="font-semibold text-[12px] flex items-center gap-2">
                    {b.label}
                    <span className="text-[10px] text-muted-foreground font-normal">peso {b.weight}%</span>
                    <span className={`ml-auto text-[10px] font-semibold ${tone.text}`}>{Math.round(sub)}/100</span>
                  </div>
                  <div>
                    <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground mb-0.5">Formula</div>
                    <code className="text-[10.5px] bg-secondary/60 px-1.5 py-0.5 rounded block">{guide.formula}</code>
                  </div>
                  <div>
                    <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground mb-0.5">Benchmark di settore</div>
                    <div className="text-[11px]">{guide.benchmark}</div>
                  </div>
                  <div>
                    <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground mb-0.5">Azione consigliata</div>
                    <div className="text-[11px]">{guide.action}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Footer con sorgente dati */}
        <div className="mt-3 pt-2 border-t border-border text-[10px] text-muted-foreground">
          Dati LP/CRM matchati all'inserzione via <code className="px-1 rounded bg-secondary text-[9.5px]">ad_id</code> + UTM Meta (<code className="px-1 rounded bg-secondary text-[9.5px]">utm_id</code>, <code className="px-1 rounded bg-secondary text-[9.5px]">utm_content</code>). Passa il cursore su una metrica per formula, benchmark e azione consigliata.
        </div>
      </div>
    </TooltipProvider>
  );
}
