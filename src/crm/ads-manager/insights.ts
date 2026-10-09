/** Helper analitici per Ads Manager: today-vs-yesterday, alert contestuali,
 *  winners/losers, health score 0-100 per ogni inserzione.
 *
 *  Nota: queste funzioni accettano `unknown[]` per evitare dipendenze circolari
 *  con il tipo PerfItem definito nella pagina; i campi attesi sono tipizzati
 *  internamente come `Pick<...>`. */

export interface PerfTrendPoint {
  date: string;
  spend: number;
  lead: number;
  conv?: number;
  rev?: number;
  fatigueScore?: number;
}

export interface PerfMin {
  ad_id: string;
  spend: number;
  lead: number;
  conversioni: number;
  fatturato: number;
  netto: number;
  cpl: number;
  roas: number;
  qualityRate: number;
  fatigueScore: number;
  portatorePct: number;
  urgenzaScore: number;
  trend: PerfTrendPoint[];
}

/** ISO yyyy-mm-dd per una data locale. */
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Aggrega trend di tutte le ad in una mappa {date → {spend, lead, rev}}. */
function aggregateTrend(
  perf: PerfMin[],
): Map<string, { spend: number; lead: number; rev: number }> {
  const m = new Map<string, { spend: number; lead: number; rev: number }>();
  for (const p of perf) {
    for (const t of p.trend ?? []) {
      const cur = m.get(t.date) ?? { spend: 0, lead: 0, rev: 0 };
      cur.spend += t.spend ?? 0;
      cur.lead += t.lead ?? 0;
      cur.rev += t.rev ?? 0;
      m.set(t.date, cur);
    }
  }
  return m;
}

export interface DayKpi {
  spend: number;
  lead: number;
  cpl: number;
  roas: number;
}

export interface TodayVsYesterday {
  today: DayKpi;
  yesterday: DayKpi;
  delta: { spend: number | null; lead: number | null; cpl: number | null; roas: number | null };
  hasData: boolean;
}

/** Calcola today vs yesterday confrontando le ultime 2 date presenti in `trend`.
 *  In assenza di dati per oggi (es. sync ritardato) usa le ultime 2 disponibili. */
export function computeTodayVsYesterday(perf: PerfMin[]): TodayVsYesterday {
  const agg = aggregateTrend(perf);
  if (agg.size < 2) {
    const empty: DayKpi = { spend: 0, lead: 0, cpl: 0, roas: 0 };
    return {
      today: empty,
      yesterday: empty,
      delta: { spend: null, lead: null, cpl: null, roas: null },
      hasData: false,
    };
  }
  const dates = [...agg.keys()].sort();
  const todayKey = dates[dates.length - 1];
  const yKey = dates[dates.length - 2];
  const t = agg.get(todayKey)!;
  const y = agg.get(yKey)!;
  const today: DayKpi = {
    spend: t.spend,
    lead: t.lead,
    cpl: t.lead > 0 ? t.spend / t.lead : 0,
    roas: t.spend > 0 ? t.rev / t.spend : 0,
  };
  const yesterday: DayKpi = {
    spend: y.spend,
    lead: y.lead,
    cpl: y.lead > 0 ? y.spend / y.lead : 0,
    roas: y.spend > 0 ? y.rev / y.spend : 0,
  };
  const pct = (a: number, b: number): number | null => (b === 0 ? null : ((a - b) / b) * 100);
  return {
    today,
    yesterday,
    delta: {
      spend: pct(today.spend, yesterday.spend),
      lead: pct(today.lead, yesterday.lead),
      cpl: pct(today.cpl, yesterday.cpl),
      roas: pct(today.roas, yesterday.roas),
    },
    hasData: true,
  };
}

/** Soglia degrado coerente con il toggle "Solo in degrado" della pagina. */
export function isDegradingMin(p: PerfMin): boolean {
  if ((p.fatigueScore ?? 0) >= 50) return true;
  const last7 = (p.trend ?? []).slice(-7);
  if (last7.length < 2) return false;
  const delta = (last7[last7.length - 1].fatigueScore ?? 0) - (last7[0].fatigueScore ?? 0);
  return delta >= 20;
}

export interface AdsAlerts {
  overBudget: { ad_id: string; spend: number; budget: number }[];
  cplOutlier: { ad_id: string; cpl: number; avg: number }[];
  degradedCount: number;
  /** Spesa totale > 0 ma 0 lead nel periodo selezionato (CPL non valutabile = critico). */
  noLeads: { totalSpend: number } | null;
  /** Ad con spesa > soglia ma 0 lead generati nel periodo. */
  zeroLeadAds: { ad_id: string; spend: number }[];
  /** CPL medio del periodo (somma spesa / somma lead) usato come riferimento. */
  periodAvgCpl: number;
}

/** Alert contestuali basati su:
 *  - spesa giornaliera totale > daily_spend_meta (budget di tracking_config)
 *  - CPL per ad > 1.5× CPL medio storico del periodo selezionato
 *  - 0 lead generati nel periodo malgrado spesa > 0 (critico)
 *  - ad con spesa significativa ma 0 lead (spesa bruciata)
 *  - count ad in degrado (riusa isDegradingMin) */
export function computeAlerts(perf: PerfMin[], dailyBudget: number): AdsAlerts {
  // CPL medio del periodo: somma spesa di tutti i giorni del trend / somma lead del trend.
  // Più rappresentativo della pura aggregazione corrente perché copre l'intero periodo.
  let trendSpend = 0;
  let trendLead = 0;
  for (const p of perf) {
    for (const t of p.trend ?? []) {
      trendSpend += t.spend ?? 0;
      trendLead += t.lead ?? 0;
    }
  }
  const totSpend = perf.reduce((s, p) => s + (p.spend ?? 0), 0);
  const totLead = perf.reduce((s, p) => s + (p.lead ?? 0), 0);
  // Preferisci la media storica del trend; fallback all'aggregato istantaneo.
  const periodAvgCpl =
    trendLead > 0 ? trendSpend / trendLead : totLead > 0 ? totSpend / totLead : 0;
  const cplOutlier = perf
    .filter((p) => p.lead > 0 && p.spend > 0 && periodAvgCpl > 0 && p.cpl > 1.5 * periodAvgCpl)
    .map((p) => ({ ad_id: p.ad_id, cpl: p.cpl, avg: periodAvgCpl }));

  // Soglia "spesa significativa" per zero-lead: max(€20, periodAvgCpl × 1) come budget atteso per 1 lead.
  const zeroLeadThreshold = Math.max(20, periodAvgCpl > 0 ? periodAvgCpl : 30);
  const zeroLeadAds = perf
    .filter((p) => p.spend >= zeroLeadThreshold && p.lead === 0)
    .map((p) => ({ ad_id: p.ad_id, spend: p.spend }))
    .sort((a, b) => b.spend - a.spend);

  const noLeads = totSpend > 0 && totLead === 0 ? { totalSpend: totSpend } : null;

  // Over-budget: spesa di OGGI vs budget giornaliero (se configurato).
  const overBudget: AdsAlerts["overBudget"] = [];
  if (dailyBudget > 0) {
    const agg = aggregateTrend(perf);
    if (agg.size > 0) {
      const lastDate = [...agg.keys()].sort().pop()!;
      const todaySpend = agg.get(lastDate)?.spend ?? 0;
      if (todaySpend > dailyBudget) {
        overBudget.push({ ad_id: "__total__", spend: todaySpend, budget: dailyBudget });
      }
    }
  }

  const degradedCount = perf.filter(isDegradingMin).length;
  return { overBudget, cplOutlier, degradedCount, noLeads, zeroLeadAds, periodAvgCpl };
}

export interface RankedAd {
  ad_id: string;
  primary: number;
  secondary: number;
}

/** Top ROAS: spend>0, lead>0, ordinato per ROAS desc. Max 3. */
export function pickWinners(perf: PerfMin[]): RankedAd[] {
  return perf
    .filter((p) => p.spend > 0 && p.lead > 0 && p.roas > 0)
    .sort((a, b) => b.roas - a.roas)
    .slice(0, 3)
    .map((p) => ({ ad_id: p.ad_id, primary: p.roas, secondary: p.spend }));
}

/** Peggiori: spend>0, lead=0 — soldi spesi senza ritorno. Ordinati per spesa desc. Max 3. */
export function pickLosers(perf: PerfMin[]): RankedAd[] {
  return perf
    .filter((p) => p.spend > 0 && p.lead === 0)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 3)
    .map((p) => ({ ad_id: p.ad_id, primary: p.spend, secondary: 0 }));
}

/** Health Score 0-100 — pesi:
 *  - ROAS normalizzato vs mediana del set (40%)
 *  - Fatigue inverso = 100 - fatigueScore (25%)
 *  - Qualità LP (qualityRate %) (20%)
 *  - Lead quality = (portatorePct * 0.5 + urgenzaScore * 5) clamp 0-100 (15%)
 *  Restituisce null se i dati sono insufficienti (no spesa). */
function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function computeHealthMap(perf: PerfMin[]): Map<string, number | null> {
  const map = new Map<string, number | null>();
  if (perf.length === 0) return map;
  // Riferimento ROAS: mediana del set (esclude zeri per non deprimere la baseline)
  const roasRef = median(perf.filter((p) => p.spend > 0 && p.roas > 0).map((p) => p.roas));
  for (const p of perf) {
    if (p.spend <= 0) {
      map.set(p.ad_id, null);
      continue;
    }
    // 1) ROAS norm (clamp 0-100): 100 quando ROAS = 2× mediana.
    const roasNorm =
      roasRef > 0
        ? Math.max(0, Math.min(100, (p.roas / (roasRef * 2)) * 100))
        : p.roas > 0
          ? 50
          : 0;
    // 2) Fatigue inverso
    const fatInv = Math.max(0, Math.min(100, 100 - (p.fatigueScore ?? 0)));
    // 3) Qualità LP
    const lp = Math.max(0, Math.min(100, p.qualityRate ?? 0));
    // 4) Lead quality
    const leadQ = Math.max(
      0,
      Math.min(100, (p.portatorePct ?? 0) * 0.5 + (p.urgenzaScore ?? 0) * 5),
    );
    const score = roasNorm * 0.4 + fatInv * 0.25 + lp * 0.2 + leadQ * 0.15;
    map.set(p.ad_id, Math.round(score));
  }
  return map;
}

/** Colore semantico per il pallino Health. */
export function healthColor(v: number | null): { dot: string; text: string; label: string } {
  if (v == null) return { dot: "bg-slate-300", text: "text-muted-foreground", label: "—" };
  if (v >= 70) return { dot: "bg-emerald-500", text: "text-emerald-700", label: "Sano" };
  if (v >= 45) return { dot: "bg-amber-500", text: "text-amber-700", label: "Da sorvegliare" };
  return { dot: "bg-rose-500", text: "text-rose-700", label: "Critico" };
}
