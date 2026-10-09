import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, Users, Fingerprint, Info, Film, Calendar as CalendarIcon, FileVideo } from "lucide-react";
import { getAdDeepAnalysis, saveAdScoreSnapshot, getAdScoreHistory } from "@/crm/ads-financials.functions";
import { VideoFunnelChart } from "@/crm/VideoFunnelChart";
import { HistoricalMultiChart, type TrendPoint } from "@/crm/HistoricalMultiChart";
import { CompositeScoreCard } from "@/crm/CompositeScoreCard";
import { LpFunnelMini } from "@/crm/ads-manager/LpFunnelMini";
import { Sparkline } from "@/crm/ads-manager/Sparkline";
import { diagnoseVideo, VideoDiagnosis } from "@/crm/ads-manager/VideoDiagnosis";
import { diagnoseTraffic, TrafficDiagnosis } from "@/crm/ads-manager/TrafficDiagnosis";
import { DateRangeFilter, rangeBoundsAsDates, type DateRange } from "@/crm/DateRangeFilter";

interface DeepKPI { current: number; previous: number; delta: number; deltaPct: number }
interface DeepAnalysis {
  ok: boolean;
  adId: string;
  range: { since: string; until: string };
  previousRange: { since: string; until: string };
  historyMeta?: {
    hasDataInRange: boolean;
    lifetimeSpend: number;
    firstActivity: string | null;
    lastActivity: string | null;
    activeDays: number;
  };
  kpis: {
    spend: DeepKPI; cpm: DeepKPI; frequency: DeepKPI; reach: DeepKPI;
    ctr: DeepKPI; impressions: DeepKPI; sessions: DeepKPI;
    avgScroll: DeepKPI; avgTime: DeepKPI; bounceRate: DeepKPI; cvr: DeepKPI;
    leads: DeepKPI; cpl: DeepKPI;
    thumbstopRate: DeepKPI; hookRate: DeepKPI; view25Rate: DeepKPI; view50Rate: DeepKPI; view75Rate: DeepKPI;
    holdRate: DeepKPI; holdRateVsPlay: DeepKPI; completionRate: DeepKPI; thruRate: DeepKPI;
    realAttentionFreq: DeepKPI;
    videoCounts?: {
      impressions: number; reach: number; videoPlays: number;
      v25: number; v50: number; v75: number; v100: number; thruplays: number;
      v3sec: number; vCont2: number; denomPlays: number; denomViews: number;
    };
    ctrOutbound: DeepKPI; lpIntentRate: DeepKPI; lpViewRate: DeepKPI; lpvFreq: DeepKPI;
    stdFrequency: DeepKPI; realEngRate: DeepKPI;
    contactsRate: DeepKPI; whatsappCvr: DeepKPI;
  };
  utmVsMeta: { ctrUtm: number; ctrMeta: number; lpvRateUtm: number; lpvRateMeta: number };
  composite: {
    score: number;
    breakdown: Array<{ label: string; weight: number; current: number; previous: number; better: boolean }>;
  };
  videoFunnel: {
    impressions: number; videoPlays: number;
    v25: number; v50: number; v75: number; v100: number; thruplays: number;
  };
  multiTouch: {
    leadsAnalyzed: number;
    avgSessionsBeforeLead: number;
    avgAdsBeforeLead: number;
    multiAdLeads: number;
    multiAdPct: number;
    uidMatchedLeads: number;
    uidMatchPct: number;
    firstClickLeads: number;
    lastClickLeads: number;
    assistLeads: number;
    sample: Array<{ leadId: string; email: string; sessionsCount: number; distinctAds: number; firstSeen: string | null; lastTouch: string; matchType: "uid" | "contact" }>;
  };
  fatigueAlerts: string[];
  dailyTrend: TrendPoint[];
}

const fmtEUR = (v: number) => `€${v.toLocaleString("it-IT", { maximumFractionDigits: 2 })}`;
const fmtINT = (v: number) => Math.round(v).toLocaleString("it-IT");
const fmtPCT = (v: number) => `${v.toFixed(1)}%`;
function deltaLabel(utm: number, meta: number): string {
  if (meta <= 0) return "n/d";
  const d = ((utm - meta) / meta) * 100;
  return `${d > 0 ? "+" : ""}${d.toFixed(0)}%`;
}

// Default range Deep Analysis: ultimi 7 giorni
function defaultDeepRange(): DateRange {
  const today = new Date();
  const since = new Date(today); since.setDate(today.getDate() - 6);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(since), to: iso(today) };
}

function rangeFromDR(r: DateRange, fallbackSinceISO: string, fallbackUntilISO: string): { since: string; until: string } {
  const b = rangeBoundsAsDates(r);
  if (b) return { since: b.since.toISOString(), until: b.until.toISOString() };
  return { since: fallbackSinceISO, until: fallbackUntilISO };
}

function fmtDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Benchmark = { low: number; mid: number };

function benchTier(value: number, b: Benchmark): "basso" | "medio" | "ottimo" {
  if (value < b.low) return "basso";
  if (value < b.mid) return "medio";
  return "ottimo";
}

function BenchBadge({ value, bench }: { value: number; bench: Benchmark }) {
  const t = benchTier(value, bench);
  const cls =
    t === "ottimo"
      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
      : t === "medio"
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-rose-100 text-rose-700 border-rose-200";
  const label = t === "ottimo" ? "Ottimo" : t === "medio" ? "Medio" : "Basso";
  return (
    <span
      className={`inline-flex items-center px-1.5 h-4 rounded text-[9px] font-bold uppercase tracking-wider border ${cls}`}
      title={`Benchmark: <${bench.low} basso · ${bench.low}–${bench.mid} medio · >${bench.mid} ottimo`}
    >
      {label}
    </span>
  );
}

function KpiCard({
  label, current, previous, deltaPct, format, goodWhen = "high", tooltip, benchmark, subValue, trend,
}: {
  label: string;
  current: number;
  previous: number;
  deltaPct: number;
  format: (v: number) => string;
  goodWhen?: "high" | "low";
  tooltip?: string;
  benchmark?: Benchmark;
  subValue?: string;
  /** Mini-sparkline trend (es. ultimi 7gg). Se omesso non viene mostrato. */
  trend?: number[];
}) {
  const noPrev = previous === 0 && current === 0;
  const better = goodWhen === "high" ? deltaPct > 0 : deltaPct < 0;
  const tone = noPrev || Math.abs(deltaPct) < 0.5
    ? "border-border bg-white"
    : better
    ? "border-emerald-200 bg-emerald-50/60"
    : "border-rose-200 bg-rose-50/60";
  const txtCol = noPrev || Math.abs(deltaPct) < 0.5
    ? "text-muted-foreground"
    : better
    ? "text-emerald-700"
    : "text-rose-700";
  const sparkColor = noPrev || Math.abs(deltaPct) < 0.5
    ? "oklch(0.6 0.01 250)"
    : better
    ? "oklch(0.55 0.18 145)"
    : "oklch(0.55 0.22 25)";
  const Icon = better ? TrendingUp : TrendingDown;
  return (
    <div className={`rounded-lg border ${tone} px-3 py-2.5`} title={tooltip}>
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        <span className="truncate">{label}</span>
        {tooltip && <Info className="h-2.5 w-2.5 opacity-60 shrink-0" />}
      </div>
      <div className="flex items-center justify-between gap-1.5 mt-0.5 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          <div className="text-[16px] font-semibold tabular-nums">{format(current)}</div>
          {benchmark && current > 0 && <BenchBadge value={current} bench={benchmark} />}
        </div>
        {trend && trend.length >= 2 && (
          <Sparkline values={trend} color={sparkColor} width={56} height={18} />
        )}
      </div>
      {subValue && (
        <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">{subValue}</div>
      )}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-muted-foreground">prima: {format(previous)}</span>
        {!noPrev && Math.abs(deltaPct) >= 0.5 && (
          <span className={`inline-flex items-center gap-0.5 text-[10.5px] font-semibold ${txtCol}`}>
            <Icon className="h-3 w-3" />
            {deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

const FREQ_THRESHOLD = 3.5;

export interface AdDeepCreativeMeta {
  thumbnail?: string | null;
  isVideo?: boolean;
  videoDuration?: number | null;
  videoFileName?: string | null;
  /** Data di upload (created_time del video o della creative). Opzionale. */
  uploadedAt?: string | null;
  /** Dimensioni o formato (es. "1080x1920" o "9:16"). Opzionale. */
  dimensions?: string | null;
}

export function AdDeepAnalysisTab({
  accessToken, adId, sinceISO, untilISO, creative,
}: {
  accessToken: string;
  adId: string;
  sinceISO: string;
  untilISO: string;
  creative?: AdDeepCreativeMeta | null;
}) {
  // Selettore periodo INDIPENDENTE basato su DateRangeFilter (Oggi/Ieri/3-7-15-30g/Lifetime + custom from-to).
  // "Globale" = usa il range del drawer (sinceISO/untilISO esterni).
  const [useGlobal, setUseGlobal] = useState<boolean>(false);
  const [dateRange, setDateRange] = useState<DateRange>(defaultDeepRange);
  const [showFreq, setShowFreq] = useState<boolean>(false);

  const effectiveRange = useMemo(() => {
    if (useGlobal) return { since: sinceISO, until: untilISO };
    return rangeFromDR(dateRange, sinceISO, untilISO);
  }, [useGlobal, dateRange, sinceISO, untilISO]);

  const [data, setData] = useState<DeepAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [scoreHistory, setScoreHistory] = useState<Array<{ date: string; score: number }>>([]);

  useEffect(() => {
    let alive = true;
    setLoading(true); setErr(null);
    getAdDeepAnalysis({ data: { accessToken, adId, sinceISO: effectiveRange.since, untilISO: effectiveRange.until } })
      .then((r) => { if (alive) setData(r as DeepAnalysis); })
      .catch((e) => { if (alive) setErr(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [accessToken, adId, effectiveRange.since, effectiveRange.until]);

  // Carica storico Composite Score (ultimi 30 giorni) per lo sparkline
  useEffect(() => {
    let alive = true;
    getAdScoreHistory({ data: { accessToken, adId, days: 90 } })
      .then((r) => { if (alive && r.ok) setScoreHistory(r.history); })
      .catch(() => { /* silent */ });
    return () => { alive = false; };
  }, [accessToken, adId]);

  // Salva snapshot giornaliero del Composite Score (idempotente per data)
  useEffect(() => {
    if (!data?.composite) return;
    const subScores: Record<string, number> = {};
    for (const b of data.composite.breakdown) {
      const val = (b as { subScore?: number }).subScore;
      if (typeof val === "number") subScores[b.label] = val;
    }
    saveAdScoreSnapshot({
      data: { accessToken, adId, score: data.composite.score, subScores },
    })
      .then((r) => {
        if (r.ok) {
          getAdScoreHistory({ data: { accessToken, adId, days: 90 } })
            .then((h) => { if (h.ok) setScoreHistory(h.history); })
            .catch(() => {});
        }
      })
      .catch(() => { /* silent */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adId, data?.composite?.score]);

  const freqExceeded = useMemo(() => {
    if (!data) return false;
    return data.dailyTrend.some((d) => d.freq > FREQ_THRESHOLD);
  }, [data]);

  // Ultimi 7 giorni di trend per le sparkline (o tutti se ce ne sono meno)
  const last7 = useMemo(() => {
    if (!data) return [] as TrendPoint[];
    return data.dailyTrend.slice(-7);
  }, [data]);

  // Diagnosi automatica creatività video (basata sui KPI correnti)
  const videoVerdict = useMemo(() => {
    if (!data) return null;
    return diagnoseVideo({
      thumbstop: data.kpis.thumbstopRate.current,
      hold: data.kpis.holdRate.current,
      view50: data.kpis.view50Rate.current,
      view75: data.kpis.view75Rate.current,
      view100: data.kpis.completionRate.current,
      realAttention: data.kpis.realAttentionFreq.current,
    });
  }, [data]);

  // Diagnosi automatica traffico & qualità (CTR/LP/bounce)
  const trafficVerdict = useMemo(() => {
    if (!data) return null;
    return diagnoseTraffic({
      ctrOutbound: data.kpis.ctrOutbound.current,
      ctr: data.kpis.ctr.current,
      ctrMeta: data.utmVsMeta.ctrMeta,
      lpIntentRate: data.kpis.lpIntentRate.current,
      lpViewRate: data.utmVsMeta.lpvRateMeta,
      lpvRateUtm: data.utmVsMeta.lpvRateUtm,
      bounceRate: data.kpis.bounceRate.current,
      cvr: data.kpis.cvr.current,
    });
  }, [data]);

  const durationLabel = fmtDuration(creative?.videoDuration);
  const hasMetaBox = Boolean(creative && (creative.isVideo || creative.thumbnail));

  return (
    <div className="space-y-4">
      {/* 🎬 Metadata box creativa: thumbnail mini + nome file + durata + upload date + dimensioni */}
      {hasMetaBox && (
        <div className="flex items-center gap-3 bg-white border border-border rounded-xl p-3">
          <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gradient-to-br from-[oklch(0.92_0.02_252)] to-[oklch(0.86_0.04_252)] grid place-items-center shrink-0 ring-1 ring-border">
            {creative?.thumbnail ? (
              <img src={creative.thumbnail} alt={creative.videoFileName || "thumbnail"} className="w-full h-full object-cover" />
            ) : (
              <FileVideo className="h-6 w-6 text-muted-foreground" />
            )}
            {creative?.isVideo && durationLabel && (
              <>
                <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/85 text-white text-[9.5px] font-semibold tabular-nums tracking-tight">
                  {durationLabel}
                </div>
              </>
            )}
          </div>
          <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetaCell icon={<Film className="h-3 w-3" />} label="File caricato" value={creative?.videoFileName || "—"} title={creative?.videoFileName || undefined} />
            <MetaCell icon={<CalendarIcon className="h-3 w-3" />} label="Durata" value={durationLabel || "—"} />
            <MetaCell icon={<CalendarIcon className="h-3 w-3" />} label="Upload" value={creative?.uploadedAt ? creative.uploadedAt.slice(0, 10) : "—"} />
            <MetaCell icon={<FileVideo className="h-3 w-3" />} label="Formato" value={creative?.dimensions || (creative?.isVideo ? "video" : "image")} />
          </div>
        </div>
      )}

      {/* Selettore periodo dedicato — usa DateRangeFilter (include Oggi + custom from-to) */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setUseGlobal((v) => !v)}
            className={`h-9 px-3 rounded-md text-[12px] font-medium border transition-colors ${useGlobal ? "bg-[oklch(0.55_0.18_252)] text-white border-[oklch(0.55_0.18_252)]" : "bg-white text-foreground border-border hover:bg-secondary"}`}
            title="Usa il range scelto nella dashboard principale"
          >
            {useGlobal ? "Range globale ✓" : "Usa range globale"}
          </button>
          {!useGlobal && <DateRangeFilter value={dateRange} onChange={setDateRange} />}
        </div>
        <div className="text-[10.5px] text-muted-foreground tabular-nums">
          {effectiveRange.since.slice(0, 10)} → {effectiveRange.until.slice(0, 10)}
        </div>
      </div>

      {loading && (
        <div className="grid place-items-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <div className="text-[12px] text-muted-foreground mt-2">Analisi in corso…</div>
        </div>
      )}
      {err && (
        <div className="p-4 text-[12.5px] text-rose-700 bg-rose-50 border border-rose-200 rounded-md">{err}</div>
      )}

      {!loading && !err && data && (
        <>
          {/* Banner: nessun dato nel range ma esiste storico */}
          {data.historyMeta && !data.historyMeta.hasDataInRange && data.historyMeta.lifetimeSpend > 0 && (
            <div className="rounded-xl border-2 border-amber-300 bg-amber-50 p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <Info className="h-4 w-4 text-amber-700" />
                <div className="text-[13px] font-semibold text-amber-900">
                  Nessun dato nel periodo selezionato
                </div>
              </div>
              <div className="text-[12px] text-amber-800 mb-2">
                Quest'inserzione ha speso <span className="font-semibold">{fmtEUR(data.historyMeta.lifetimeSpend)}</span> in totale su <span className="font-semibold">{data.historyMeta.activeDays}</span> giorni di attività, ma non ha avuto attività tra {data.range.since.slice(0, 10)} e {data.range.until.slice(0, 10)}.
                {data.historyMeta.firstActivity && data.historyMeta.lastActivity && (
                  <> Periodo attivo: <span className="font-semibold">{data.historyMeta.firstActivity}</span> → <span className="font-semibold">{data.historyMeta.lastActivity}</span>.</>
                )}
              </div>
              <button
                onClick={() => { setUseGlobal(false); setDateRange({ from: null, to: null }); /* azzera per spingere a "lifetime" via DateRangeFilter */ }}
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md text-[11.5px] font-semibold bg-amber-600 hover:bg-amber-700 text-white transition-colors"
              >
                Cambia periodo
              </button>
            </div>
          )}

          {/* Banner stanchezza creativa */}
          {data.fatigueAlerts.length > 0 && (
            <div className="rounded-xl border-2 border-rose-300 bg-rose-50 p-3.5">
              <div className="flex items-center gap-2 mb-1.5">
                <AlertTriangle className="h-4 w-4 text-rose-700" />
                <div className="text-[13px] font-semibold text-rose-900">Allarme stanchezza creativa</div>
              </div>
              <ul className="space-y-1 text-[12px] text-rose-800">
                {data.fatigueAlerts.map((a, i) => <li key={i}>• {a}</li>)}
              </ul>
            </div>
          )}

          {/* KPI confronto periodo */}
          <div>
            <div className="text-[12.5px] font-semibold mb-2">
              KPI vs periodo precedente
              <span className="text-[10.5px] text-muted-foreground font-normal ml-2">
                ({data.previousRange.since.slice(0, 10)} → {data.previousRange.until.slice(0, 10)})
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              <KpiCard label="Spesa" current={data.kpis.spend.current} previous={data.kpis.spend.previous} deltaPct={data.kpis.spend.deltaPct} format={fmtEUR} goodWhen="low" />
              <KpiCard label="CPM" current={data.kpis.cpm.current} previous={data.kpis.cpm.previous} deltaPct={data.kpis.cpm.deltaPct} format={fmtEUR} goodWhen="low" />
              <KpiCard label="Frequenza" current={data.kpis.frequency.current} previous={data.kpis.frequency.previous} deltaPct={data.kpis.frequency.deltaPct} format={(v) => v.toFixed(2)} goodWhen="low" />
              <KpiCard label="Reach" current={data.kpis.reach.current} previous={data.kpis.reach.previous} deltaPct={data.kpis.reach.deltaPct} format={fmtINT} goodWhen="high" />
              <KpiCard
                label="CTR (UTM)"
                current={data.kpis.ctr.current}
                previous={data.kpis.ctr.previous}
                deltaPct={data.kpis.ctr.deltaPct}
                format={fmtPCT}
                goodWhen="high"
                tooltip={`UTM: ${data.utmVsMeta.ctrUtm.toFixed(2)}% · Meta dichiara: ${data.utmVsMeta.ctrMeta.toFixed(2)}% · delta ${deltaLabel(data.utmVsMeta.ctrUtm, data.utmVsMeta.ctrMeta)}\nUn delta negativo grosso indica click invalidi/bot conteggiati da Meta.`}
              />
              <KpiCard label="Sessioni LP" current={data.kpis.sessions.current} previous={data.kpis.sessions.previous} deltaPct={data.kpis.sessions.deltaPct} format={fmtINT} goodWhen="high" />
              <KpiCard label="Scroll medio" current={data.kpis.avgScroll.current} previous={data.kpis.avgScroll.previous} deltaPct={data.kpis.avgScroll.deltaPct} format={(v) => `${v.toFixed(0)}%`} goodWhen="high" />
              <KpiCard label="Tempo medio" current={data.kpis.avgTime.current} previous={data.kpis.avgTime.previous} deltaPct={data.kpis.avgTime.deltaPct} format={(v) => `${v.toFixed(0)}s`} goodWhen="high" />
              <KpiCard label="Lead" current={data.kpis.leads.current} previous={data.kpis.leads.previous} deltaPct={data.kpis.leads.deltaPct} format={fmtINT} goodWhen="high" />
              <KpiCard label="CPL reale" current={data.kpis.cpl.current} previous={data.kpis.cpl.previous} deltaPct={data.kpis.cpl.deltaPct} format={fmtEUR} goodWhen="low" />
              <KpiCard label="Impressions" current={data.kpis.impressions.current} previous={data.kpis.impressions.previous} deltaPct={data.kpis.impressions.deltaPct} format={fmtINT} goodWhen="high" />
            </div>
          </div>

          {/* 🎥 Video Engagement (formule allineate Ads Manager — denominatore = video_plays) */}
          <div>
            <div className="text-[12.5px] font-semibold mb-2 flex items-center gap-2 flex-wrap">
              🎥 Video Engagement
              <span className="text-[10.5px] text-muted-foreground font-normal">
                Rate calcolati come Meta Ads Manager (su <code>video_plays</code>) · sparkline = ultimi {last7.length}gg · badge:{" "}
                <span className="text-rose-700 font-semibold">Basso</span> /{" "}
                <span className="text-amber-700 font-semibold">Medio</span> /{" "}
                <span className="text-emerald-700 font-semibold">Ottimo</span>
              </span>
            </div>

            {/* Diagnosi automatica creatività */}
            {videoVerdict && <VideoDiagnosis verdict={videoVerdict} />}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              <KpiCard
                label="Thumbstop"
                current={data.kpis.thumbstopRate.current}
                previous={data.kpis.thumbstopRate.previous}
                deltaPct={data.kpis.thumbstopRate.deltaPct}
                format={fmtPCT}
                goodWhen="high"
                benchmark={{ low: 40, mid: 60 }}
                subValue={data.kpis.videoCounts ? `${fmtINT(data.kpis.videoCounts.v3sec)} ≥3s · ${fmtINT(data.kpis.videoCounts.denomViews)} engaged views` : undefined}
                trend={last7.map((d) => d.thumbstopRate)}
                tooltip={"video_3_sec_watched / video_continuous_2_sec (engaged views)\n\n% di chi smette di scrollare tra chi ha visto almeno 2s.\n\nBenchmark Meta:\n• Basso < 40%\n• Medio 40–60%\n• Ottimo > 60%"}
              />
              <KpiCard
                label="Hook Rate"
                current={data.kpis.hookRate.current}
                previous={data.kpis.hookRate.previous}
                deltaPct={data.kpis.hookRate.deltaPct}
                format={fmtPCT}
                goodWhen="high"
                benchmark={{ low: 25, mid: 40 }}
                subValue={data.kpis.videoCounts ? `${fmtINT(data.kpis.videoCounts.v3sec)} ≥3s · ${fmtINT(data.kpis.videoCounts.denomPlays)} plays` : undefined}
                trend={last7.map((d) => d.hookRate)}
                tooltip={"video_3_sec_watched / video_plays\n\n% di plays che superano i 3 secondi.\n\nBenchmark:\n• Basso < 25%\n• Medio 25–40%\n• Ottimo > 40%"}
              />
              <KpiCard
                label="Hold Rate"
                current={data.kpis.holdRate.current}
                previous={data.kpis.holdRate.previous}
                deltaPct={data.kpis.holdRate.deltaPct}
                format={fmtPCT}
                goodWhen="high"
                benchmark={{ low: 30, mid: 50 }}
                subValue={data.kpis.videoCounts ? `${fmtINT(data.kpis.videoCounts.thruplays)} thruplays · ${fmtINT(data.kpis.videoCounts.denomPlays)} plays` : undefined}
                trend={last7.map((d) => d.holdRate)}
                tooltip={"video_thruplays / video_plays\n\n% che arriva a ≥15s o fine video.\n\nBenchmark:\n• Basso < 30%\n• Medio 30–50%\n• Ottimo > 50%"}
              />
              <KpiCard
                label="View 25%"
                current={data.kpis.view25Rate.current}
                previous={data.kpis.view25Rate.previous}
                deltaPct={data.kpis.view25Rate.deltaPct}
                format={fmtPCT}
                goodWhen="high"
                benchmark={{ low: 30, mid: 50 }}
                subValue={data.kpis.videoCounts ? `${fmtINT(data.kpis.videoCounts.v25)} views` : undefined}
                trend={last7.map((d) => d.view25Rate ?? 0)}
                tooltip={"video_p25_watched / video_plays\n\nBenchmark:\n• Basso < 30%\n• Medio 30–50%\n• Ottimo > 50%"}
              />
              <KpiCard
                label="View 50%"
                current={data.kpis.view50Rate.current}
                previous={data.kpis.view50Rate.previous}
                deltaPct={data.kpis.view50Rate.deltaPct}
                format={fmtPCT}
                goodWhen="high"
                benchmark={{ low: 20, mid: 35 }}
                subValue={data.kpis.videoCounts ? `${fmtINT(data.kpis.videoCounts.v50)} views` : undefined}
                trend={last7.map((d) => d.view50Rate)}
                tooltip={"video_p50_watched / video_plays\n\nBenchmark:\n• Basso < 20%\n• Medio 20–35%\n• Ottimo > 35%"}
              />
              <KpiCard
                label="View 75%"
                current={data.kpis.view75Rate.current}
                previous={data.kpis.view75Rate.previous}
                deltaPct={data.kpis.view75Rate.deltaPct}
                format={fmtPCT}
                goodWhen="high"
                benchmark={{ low: 15, mid: 25 }}
                subValue={data.kpis.videoCounts ? `${fmtINT(data.kpis.videoCounts.v75)} views` : undefined}
                trend={last7.map((d) => d.view75Rate ?? 0)}
                tooltip={"video_p75_watched / video_plays\n\nBenchmark:\n• Basso < 15%\n• Medio 15–25%\n• Ottimo > 25%"}
              />
              <KpiCard
                label="View 100%"
                current={data.kpis.completionRate.current}
                previous={data.kpis.completionRate.previous}
                deltaPct={data.kpis.completionRate.deltaPct}
                format={fmtPCT}
                goodWhen="high"
                benchmark={{ low: 10, mid: 20 }}
                subValue={data.kpis.videoCounts ? `${fmtINT(data.kpis.videoCounts.v100)} views` : undefined}
                trend={last7.map((d) => d.completionRate)}
                tooltip={"video_p100_watched / video_plays\n\nBenchmark:\n• Basso < 10%\n• Medio 10–20%\n• Ottimo > 20%"}
              />
              <KpiCard
                label="Real Attention Freq"
                current={data.kpis.realAttentionFreq.current}
                previous={data.kpis.realAttentionFreq.previous}
                deltaPct={data.kpis.realAttentionFreq.deltaPct}
                format={(v) => v.toFixed(2)}
                goodWhen="high"
                benchmark={{ low: 0.3, mid: 0.7 }}
                subValue={data.kpis.videoCounts ? `${fmtINT(data.kpis.videoCounts.thruplays)} thru / ${fmtINT(data.kpis.videoCounts.reach)} reach` : undefined}
                tooltip={"thruplays / reach\n\nQuante volte in media UN UTENTE UNICO ha guardato il video fino in fondo.\n\n• < 0.3 = poca attenzione reale\n• 0.3–0.7 = engagement medio\n• > 0.7 = ottimo (1.0 = ogni utente l'ha completato 1 volta)\n• > 1.5 = saturazione attenzione (rischio fatigue)"}
              />
            </div>
          </div>

          {/* 🖱️ Traffico e Qualità */}
          <div>
            <div className="text-[12.5px] font-semibold mb-2">
              🖱️ Traffico & Qualità
              <span className="text-[10.5px] text-muted-foreground font-normal ml-2">
                Outbound = qualità reale del clic; LP Views vs Sessioni LP rivela bot/click invalidi
              </span>
            </div>

            {/* Diagnosi automatica traffico */}
            {trafficVerdict && <TrafficDiagnosis verdict={trafficVerdict} />}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              <KpiCard label="CTR Outbound" current={data.kpis.ctrOutbound.current} previous={data.kpis.ctrOutbound.previous} deltaPct={data.kpis.ctrOutbound.deltaPct} format={fmtPCT} goodWhen="high" tooltip="clic_in_uscita / impressions — qualità del clic (esclude reazioni e click sul nome pagina)" />
              <KpiCard
                label="Landing Intent Rate"
                current={data.kpis.lpIntentRate.current}
                previous={data.kpis.lpIntentRate.previous}
                deltaPct={data.kpis.lpIntentRate.deltaPct}
                format={fmtPCT}
                goodWhen="high"
                tooltip={`landing_page_views / outbound_clicks — metrica DICHIARATA da Meta (Pixel PageView/link click).\nNON misura visitatori reali al sito: misura solo coerenza tra clic Meta e fire del Pixel.\nUn valore alto NON garantisce traffico vero — controlla 'Sessioni LP' (UTM) per il dato reale.`}
              />
              <KpiCard
                label="LP View Rate"
                current={data.kpis.lpViewRate.current}
                previous={data.kpis.lpViewRate.previous}
                deltaPct={data.kpis.lpViewRate.deltaPct}
                format={fmtPCT}
                goodWhen="high"
                tooltip={`Meta (Pixel): ${data.utmVsMeta.lpvRateMeta.toFixed(1)}% (LPV / link clicks)\nUTM tracciato (sessioni reali): ${data.utmVsMeta.lpvRateUtm.toFixed(1)}%\ndelta ${deltaLabel(data.utmVsMeta.lpvRateUtm, data.utmVsMeta.lpvRateMeta)}\n\n⚠ Il valore Meta misura solo se il Pixel ha registrato la PageView dopo un click — NON il numero di visitatori reali.\nPer il traffico vero usa 'Sessioni LP' nella sezione UTM.\nDelta negativo grosso (UTM ≪ Meta) = bot/click invalidi.`}
              />
              <KpiCard label="Frequenza LP View" current={data.kpis.lpvFreq.current} previous={data.kpis.lpvFreq.previous} deltaPct={data.kpis.lpvFreq.deltaPct} format={(v) => v.toFixed(2)} goodWhen="high" tooltip="visualizzazioni_pagina_destinazione / copertura — quante volte un utente unico vede la LP" />
              <KpiCard label="Frequenza Standard" current={data.kpis.stdFrequency.current} previous={data.kpis.stdFrequency.previous} deltaPct={data.kpis.stdFrequency.deltaPct} format={(v) => v.toFixed(2)} goodWhen="low" tooltip="impressions / copertura — frequenza media giornaliera del set" />
              <KpiCard label="Bounce Rate LP" current={data.kpis.bounceRate.current} previous={data.kpis.bounceRate.previous} deltaPct={data.kpis.bounceRate.deltaPct} format={fmtPCT} goodWhen="low" tooltip="% sessioni con scroll < 25% E tempo < 10s — quanto la LP fallisce a trattenere" />
            </div>
            {/* Mini funnel LP per questa creativa — step-by-step da lp_events */}
            <div className="mt-3 bg-white border border-border rounded-xl p-3">
              <LpFunnelMini adId={adId} sinceISO={effectiveRange.since} untilISO={effectiveRange.until} />
            </div>
          </div>

          {/* 📈 Conversioni e Social */}
          <div>
            <div className="text-[12.5px] font-semibold mb-2">
              📈 Conversioni & Social
              <span className="text-[10.5px] text-muted-foreground font-normal ml-2">
                Lead reali dal CRM matchati per ad_id via UTM
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              <KpiCard label="Contacts Rate" current={data.kpis.contactsRate.current} previous={data.kpis.contactsRate.previous} deltaPct={data.kpis.contactsRate.deltaPct} format={fmtPCT} goodWhen="high" tooltip="lead_reali (CRM) / visualizzazioni_pagina_destinazione" />
              <KpiCard label="WhatsApp / Lead CVR" current={data.kpis.whatsappCvr.current} previous={data.kpis.whatsappCvr.previous} deltaPct={data.kpis.whatsappCvr.deltaPct} format={fmtPCT} goodWhen="high" tooltip="lead_reali (CRM) / clic_sul_link — proxy per conversazioni avviate" />
              <KpiCard label="CVR (lead/sessioni)" current={data.kpis.cvr.current} previous={data.kpis.cvr.previous} deltaPct={data.kpis.cvr.deltaPct} format={fmtPCT} goodWhen="high" tooltip="lead_CRM / sessioni_LP — qualità totale del funnel" />
              <KpiCard label="Real Engagement Rate" current={data.kpis.realEngRate.current} previous={data.kpis.realEngRate.previous} deltaPct={data.kpis.realEngRate.deltaPct} format={fmtPCT} goodWhen="high" tooltip="post_engagement (reazioni+commenti+condivisioni+salvataggi) / copertura" />
            </div>
          </div>

          {/* Score composito reale */}
          <CompositeScoreCard
            composite={data.composite}
            history={scoreHistory}
            firstActivity={data.historyMeta?.firstActivity ?? null}
          />

          {/* Grafico storico multi-metrica (CPM/CPL/Freq + CVR + Engagement + Video) */}
          <HistoricalMultiChart data={data.dailyTrend} />

          {/* Funnel video — calcolo manuale su impressions */}
          <VideoFunnelChart data={data.videoFunnel} />

          {/* Multi-touch attribution */}
          <div className="bg-white border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <Users className="h-4 w-4 text-[oklch(0.55_0.18_252)]" />
              <div className="text-[12.5px] font-semibold">Multi-touch attribution</div>
              <span className="text-[10.5px] text-muted-foreground">lookback 90gg</span>
              {data.multiTouch.leadsAnalyzed > 0 && (
                <span
                  className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200"
                  title={
                    "Join esatto via lovable_uid:\n\n" +
                    "Ogni visitatore della landing page riceve un ID anonimo persistente (lovable_uid) salvato in localStorage e inviato in ogni lp_event. Quando converte, lo stesso ID viene salvato sul lead (external_id), così possiamo ricostruire ESATTAMENTE il suo viaggio multi-touch (sessioni, ads viste).\n\n" +
                    "I lead più vecchi (creati prima dell'introduzione del lovable_uid) usano un fallback approssimato via email/telefono, meno preciso. La % qui sotto indica quanti lead nel periodo hanno un join esatto."
                  }
                >
                  <Fingerprint className="h-3 w-3" />
                  {data.multiTouch.uidMatchPct.toFixed(0)}% join esatto via UID ({data.multiTouch.uidMatchedLeads}/{data.multiTouch.leadsAnalyzed})
                  <Info className="h-3 w-3 opacity-70" />
                </span>
              )}
            </div>
            {data.multiTouch.leadsAnalyzed === 0 ? (
              <div className="text-[12px] text-muted-foreground">Nessun lead nel periodo da analizzare.</div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
                    <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Lead analizzati</div>
                    <div className="text-[16px] font-semibold tabular-nums">{data.multiTouch.leadsAnalyzed}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
                    <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Visite medie prima conv.</div>
                    <div className="text-[16px] font-semibold tabular-nums">{data.multiTouch.avgSessionsBeforeLead.toFixed(1)}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
                    <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">Ads diverse viste</div>
                    <div className="text-[16px] font-semibold tabular-nums">{data.multiTouch.avgAdsBeforeLead.toFixed(1)}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
                    <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">% multi-ad</div>
                    <div className="text-[16px] font-semibold tabular-nums">{data.multiTouch.multiAdPct.toFixed(0)}%</div>
                    <div className="text-[10px] text-muted-foreground">{data.multiTouch.multiAdLeads}/{data.multiTouch.leadsAnalyzed} lead</div>
                  </div>
                </div>

                {/* Attribution model: first-click vs last-click vs assist */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2">
                    <div className="text-[10.5px] uppercase tracking-wider text-emerald-800">First-click</div>
                    <div className="text-[16px] font-semibold tabular-nums text-emerald-900">{data.multiTouch.firstClickLeads}</div>
                    <div className="text-[10px] text-emerald-700">lead in cui questa è la prima ad vista</div>
                  </div>
                  <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2">
                    <div className="text-[10.5px] uppercase tracking-wider text-blue-800">Last-click</div>
                    <div className="text-[16px] font-semibold tabular-nums text-blue-900">{data.multiTouch.lastClickLeads}</div>
                    <div className="text-[10px] text-blue-700">lead in cui è l'ultimo touch (default Meta)</div>
                  </div>
                  <div className="rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2">
                    <div className="text-[10.5px] uppercase tracking-wider text-violet-800">Assist</div>
                    <div className="text-[16px] font-semibold tabular-nums text-violet-900">{data.multiTouch.assistLeads}</div>
                    <div className="text-[10px] text-violet-700">lead "aiutati" ma chiusi da altra ad</div>
                  </div>
                </div>
                {data.multiTouch.sample.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11.5px]">
                      <thead className="bg-[oklch(0.985_0.003_250)] text-muted-foreground">
                        <tr>
                          <th className="text-left font-medium px-2 py-1.5">Email</th>
                          <th className="text-left font-medium px-2 py-1.5">Match</th>
                          <th className="text-right font-medium px-2 py-1.5">Visite</th>
                          <th className="text-right font-medium px-2 py-1.5">Ads viste</th>
                          <th className="text-left font-medium px-2 py-1.5">Primo touch</th>
                          <th className="text-left font-medium px-2 py-1.5">Conversione</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.multiTouch.sample.map((j) => (
                          <tr key={j.leadId} className="border-t border-border">
                            <td className="px-2 py-1.5 truncate max-w-[180px]">{j.email}</td>
                            <td className="px-2 py-1.5">
                              {j.matchType === "uid" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  <Fingerprint className="h-2.5 w-2.5" /> UID
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">contact</span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{j.sessionsCount}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              <span className={j.distinctAds > 1 ? "text-emerald-700 font-semibold" : ""}>{j.distinctAds}</span>
                            </td>
                            <td className="px-2 py-1.5 text-muted-foreground">{j.firstSeen?.slice(0, 10) || "—"}</td>
                            <td className="px-2 py-1.5 text-muted-foreground">{j.lastTouch.slice(0, 10)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MetaCell({ icon, label, value, title }: { icon: ReactNode; label: string; value: string; title?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground flex items-center gap-1 leading-none">
        <span className="opacity-70">{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-[12px] font-semibold tabular-nums mt-0.5 truncate" title={title}>{value}</div>
    </div>
  );
}
