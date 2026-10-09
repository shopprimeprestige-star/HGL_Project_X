/** Quality scoring v2 — formule documentate e auditable.
 *
 *  Sostituisce/affianca il vecchio `qualityRate` (HQV/PV) con metriche
 *  più ricche basate su engagement reale LP + qualità lead CRM.
 *
 *  Tutte le funzioni sono pure: prendono PerfMin (più qualche input
 *  opzionale) e restituiscono valori 0-100 normalizzati o numeri assoluti.
 */
import type { PerfMin, PerfTrendPoint } from "./insights";

// ─── Estensione PerfMin con campi opzionali per quality v2 ───
// I campi extra sono opzionali per non rompere chiamanti esistenti.
export interface PerfQualityInput extends PerfMin {
  /** Sessioni LP totali attribuite a questa creativa (da lp_events). */
  lpSessions?: number;
  /** Sessioni che hanno fatto bounce (≤10s O ≤15% scroll & step<2). */
  lpBounces?: number;
  /** Avg time on page in secondi. */
  lpAvgTime?: number;
  /** Avg max scroll % (0-100). */
  lpAvgScroll?: number;
  /** Sessioni che hanno raggiunto step ≥ 2 (engagement reale). */
  lpStep2Reached?: number;
  /** Sessioni filtrate come bot (is_bot=true). */
  lpBots?: number;
  /** Click totali Meta (per calcolo leakage). */
  metaClicks?: number;
  /** Costo prodotto/servizio per conversione (per ROAS netto). */
  costoProdotto?: number;
}

// ────────────────────────────────────────────────────────────
// 1. TRAFFIC QUALITY SCORE 0-100 per ad
// ────────────────────────────────────────────────────────────
/** Sostituisce `qualityRate` opaco. Combina 5 segnali pesati:
 *
 *  • engagedSessionPct (35%) — % sessioni non-bounce
 *  • scrollDepthScore (20%)  — avgScroll normalizzato (50% → 100)
 *  • timeOnPageScore (20%)   — avgTime normalizzato (60s → 100)
 *  • step2ReachedPct (20%)   — % sessioni che entrano nel funnel reale
 *  • botPenalty (5%)         — penalty se >5% bot rate
 *
 *  Ritorna null se mancano dati LP (no aggregazione possibile). */
export interface TrafficQualityBreakdown {
  score: number | null;
  engagedSessionPct: number;
  scrollDepthScore: number;
  timeOnPageScore: number;
  step2ReachedPct: number;
  botPenalty: number;
  bounceRate: number;
}

export function computeTrafficQuality(p: PerfQualityInput): TrafficQualityBreakdown {
  const sessions = p.lpSessions ?? 0;
  if (sessions <= 0) {
    return {
      score: null,
      engagedSessionPct: 0, scrollDepthScore: 0, timeOnPageScore: 0,
      step2ReachedPct: 0, botPenalty: 0, bounceRate: 0,
    };
  }
  const bounces = p.lpBounces ?? 0;
  const bounceRate = (bounces / sessions) * 100;
  const engagedSessionPct = 100 - bounceRate;

  // Scroll: 50% → 100 punti (lineare, clamp)
  const avgScroll = p.lpAvgScroll ?? 0;
  const scrollDepthScore = Math.max(0, Math.min(100, (avgScroll / 50) * 100));

  // Time: 60s → 100 punti (lineare, clamp)
  const avgTime = p.lpAvgTime ?? 0;
  const timeOnPageScore = Math.max(0, Math.min(100, (avgTime / 60) * 100));

  const step2 = p.lpStep2Reached ?? 0;
  const step2ReachedPct = (step2 / sessions) * 100;

  // Bot penalty: 0% bot → 0 penalty, 20%+ bot → 100 penalty
  const botRate = ((p.lpBots ?? 0) / sessions) * 100;
  const botPenalty = Math.max(0, Math.min(100, (botRate / 20) * 100));

  const score =
    engagedSessionPct * 0.35 +
    scrollDepthScore * 0.20 +
    timeOnPageScore * 0.20 +
    step2ReachedPct * 0.20 -
    botPenalty * 0.05;

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    engagedSessionPct, scrollDepthScore, timeOnPageScore,
    step2ReachedPct, botPenalty, bounceRate,
  };
}

// ────────────────────────────────────────────────────────────
// 2. CPQL — Cost Per Qualified Lead
// ────────────────────────────────────────────────────────────
/** Lead "qualificato" = (disagio_score≥6) OR (urgenza in [subito,1mese,convince,si]).
 *
 *  Approssimazione client-side: usiamo `portatorePct` e `urgenzaScore` aggregati
 *  per stimare la frazione di lead qualificati nel set.
 *
 *  qualifiedLeads ≈ lead × max(portatoreRatio, urgenzaRatio)
 *  dove urgenzaRatio = urgenzaScore/10 (urgenza media normalizzata 0-1).
 *
 *  Per maggior precisione il backend dovrebbe esporre `qualifiedLeadCount`.
 *  Finché non c'è, questa stima è già più informativa del CPL grezzo. */
export function computeCpql(p: PerfQualityInput): number {
  if (p.spend <= 0 || p.lead <= 0) return 0;
  const portatoreRatio = (p.portatorePct ?? 0) / 100;
  const urgenzaRatio = (p.urgenzaScore ?? 0) / 10; // urgenza media è 0-10
  // Lead qualificati = unione approssimata dei due segnali (max, non somma)
  const qualifiedRatio = Math.max(portatoreRatio, urgenzaRatio);
  // Floor: anche senza segnali assumiamo 30% lead qualificati di base
  // (altrimenti CPQL sarebbe ∞ per ad senza dati lead quality)
  const effectiveRatio = Math.max(0.3, qualifiedRatio);
  const qualifiedLeads = p.lead * effectiveRatio;
  return qualifiedLeads > 0 ? p.spend / qualifiedLeads : 0;
}

// ────────────────────────────────────────────────────────────
// 3. ROAS NETTO — Profittabilità reale
// ────────────────────────────────────────────────────────────
/** ROAS netto = (fatturato − costo_prodotto×conv − spend) / spend.
 *
 *  Mostra la VERA profittabilità: ROAS > 0 = stiamo guadagnando dopo costi.
 *  Un ROAS 3× lordo con margine 30% = ROAS netto = (0.3·3 − 1) / 1 = -0.1
 *  → in realtà stiamo perdendo. */
export function computeRoasNetto(p: PerfQualityInput): number {
  if (p.spend <= 0) return 0;
  const costoProd = p.costoProdotto ?? 0;
  const costiTot = costoProd * (p.conversioni ?? 0);
  const utileNetto = (p.fatturato ?? 0) - costiTot - p.spend;
  return utileNetto / p.spend;
}

// ────────────────────────────────────────────────────────────
// 4. HEALTH SCORE v2 — pesi rivisti
// ────────────────────────────────────────────────────────────
/** Pesi v2:
 *   • ROAS norm (35%) — vs mediana set
 *   • Traffic Quality (25%) — sostituisce qualityRate opaco
 *   • Fatigue inverso (20%)
 *   • Lead quality (15%) — portatore + urgenza
 *   • Funnel completion (5%) — sessioni che arrivano a step 5+ */
export interface HealthV2Result {
  score: number | null;
  components: {
    roasNorm: number;
    trafficQuality: number;
    fatigueInv: number;
    leadQuality: number;
    funnelCompletion: number;
  } | null;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function computeHealthV2Map(perf: PerfQualityInput[]): Map<string, HealthV2Result> {
  const map = new Map<string, HealthV2Result>();
  if (perf.length === 0) return map;

  const roasRef = median(perf.filter((p) => p.spend > 0 && p.roas > 0).map((p) => p.roas));

  for (const p of perf) {
    if (p.spend <= 0) {
      map.set(p.ad_id, { score: null, components: null });
      continue;
    }
    const roasNorm = roasRef > 0
      ? Math.max(0, Math.min(100, (p.roas / (roasRef * 2)) * 100))
      : (p.roas > 0 ? 50 : 0);
    const tq = computeTrafficQuality(p);
    const trafficQuality = tq.score ?? 50; // fallback neutro se no dati LP
    const fatigueInv = Math.max(0, Math.min(100, 100 - (p.fatigueScore ?? 0)));
    const leadQuality = Math.max(0, Math.min(100,
      (p.portatorePct ?? 0) * 0.5 + (p.urgenzaScore ?? 0) * 5,
    ));
    // Funnel completion: % sessioni step ≥5 (da lpStep5Reached se disponibile,
    // altrimenti 0). In assenza di dato esplicito usiamo qualityRate × 0.5 come proxy.
    const funnelCompletion = tq.step2ReachedPct > 0
      ? Math.max(0, Math.min(100, tq.step2ReachedPct * 0.6)) // step5 ≈ 60% di step2
      : 0;

    const score =
      roasNorm * 0.35 +
      trafficQuality * 0.25 +
      fatigueInv * 0.20 +
      leadQuality * 0.15 +
      funnelCompletion * 0.05;

    map.set(p.ad_id, {
      score: Math.round(score),
      components: { roasNorm, trafficQuality, fatigueInv, leadQuality, funnelCompletion },
    });
  }
  return map;
}

// ────────────────────────────────────────────────────────────
// 5. WoW comparison — Last 7 days vs Previous 7 days
// ────────────────────────────────────────────────────────────
export interface WoWKpi {
  spend: number;
  lead: number;
  cpl: number;
  roas: number;
  rev: number;
}

export interface WoWResult {
  current: WoWKpi;
  previous: WoWKpi;
  delta: { spend: number | null; lead: number | null; cpl: number | null; roas: number | null; rev: number | null };
  hasData: boolean;
}

function aggregateRange(perf: PerfQualityInput[], dates: Set<string>): WoWKpi {
  let spend = 0, lead = 0, rev = 0;
  for (const p of perf) {
    for (const t of p.trend ?? []) {
      if (!dates.has(t.date)) continue;
      spend += t.spend ?? 0;
      lead += t.lead ?? 0;
      rev += t.rev ?? 0;
    }
  }
  return {
    spend, lead, rev,
    cpl: lead > 0 ? spend / lead : 0,
    roas: spend > 0 ? rev / spend : 0,
  };
}

export function computeWoW(perf: PerfQualityInput[]): WoWResult {
  // Raccoglie tutte le date disponibili
  const allDates = new Set<string>();
  for (const p of perf) for (const t of p.trend ?? []) allDates.add(t.date);
  if (allDates.size < 8) {
    const empty: WoWKpi = { spend: 0, lead: 0, cpl: 0, roas: 0, rev: 0 };
    return {
      current: empty, previous: empty,
      delta: { spend: null, lead: null, cpl: null, roas: null, rev: null },
      hasData: false,
    };
  }
  const sorted = [...allDates].sort();
  const last7 = new Set(sorted.slice(-7));
  const prev7 = new Set(sorted.slice(-14, -7));
  const current = aggregateRange(perf, last7);
  const previous = aggregateRange(perf, prev7);
  const pct = (a: number, b: number): number | null =>
    b === 0 ? null : ((a - b) / b) * 100;
  return {
    current, previous,
    delta: {
      spend: pct(current.spend, previous.spend),
      lead: pct(current.lead, previous.lead),
      cpl: pct(current.cpl, previous.cpl),
      roas: pct(current.roas, previous.roas),
      rev: pct(current.rev, previous.rev),
    },
    hasData: prev7.size > 0,
  };
}

// ────────────────────────────────────────────────────────────
// 6. PREDICTED CPL — regressione lineare ultimi 7gg
// ────────────────────────────────────────────────────────────
/** Proietta il CPL di domani usando regressione lineare semplice sugli
 *  ultimi 7 giorni (ordinati). Ritorna null se dati insufficienti. */
export function predictTomorrowCpl(trend: PerfTrendPoint[]): number | null {
  const last7 = trend.slice(-7).filter((t) => (t.spend ?? 0) > 0 && (t.lead ?? 0) > 0);
  if (last7.length < 3) return null;
  // x = indice giorno (0..n-1), y = CPL giornaliero
  const points = last7.map((t, i) => ({ x: i, y: (t.spend ?? 0) / (t.lead ?? 1) }));
  const n = points.length;
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  const predicted = slope * n + intercept; // x = n (domani)
  return Math.max(0, predicted);
}

// ────────────────────────────────────────────────────────────
// 7. CLICK → SESSION LEAKAGE — qualità tracking + redirect
// ────────────────────────────────────────────────────────────
/** % di click Meta che NON arrivano a generare una sessione LP.
 *  Leakage > 30% segnala redirect rotti, ad blocker, click fraudolenti.
 *  Ritorna null se mancano dati. */
export function computeClickToSessionLeakage(p: PerfQualityInput): number | null {
  const clicks = p.metaClicks ?? 0;
  const sessions = p.lpSessions ?? 0;
  if (clicks <= 0) return null;
  const leakage = ((clicks - sessions) / clicks) * 100;
  return Math.max(0, Math.min(100, leakage));
}

// ────────────────────────────────────────────────────────────
// 8. BOT RATE per ad
// ────────────────────────────────────────────────────────────
export function computeBotRate(p: PerfQualityInput): number | null {
  const sessions = p.lpSessions ?? 0;
  if (sessions <= 0) return null;
  return ((p.lpBots ?? 0) / sessions) * 100;
}
