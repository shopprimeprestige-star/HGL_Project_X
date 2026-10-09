/** Classifica qualità creative v3 — basata su qualità intrinseca, NON su spend.
 *
 *  Filosofia:
 *  - Niente spend / fatturato / netto / ROAS / conversioni nel punteggio
 *    (restano visibili come dato, ma non influenzano la rank).
 *  - 5 dimensioni 0-100 pesate (engagement video, qualità LP, qualità lead,
 *    efficienza CPL relativa al set, conversion rate).
 *  - Classificazione finale a 5 fasce via z-score sulla distribuzione del
 *    set visibile → "sopra la media" significa davvero meglio delle altre
 *    creative dello stesso periodo, non vs benchmark astratto.
 */

export type QualityTier = "top" | "good" | "avg" | "low" | "poor";

export interface QualitySubScores {
  videoEngagement: number;   // 0-100
  lpTraffic: number;         // 0-100
  leadQuality: number;       // 0-100
  cplEfficiency: number;     // 0-100
  cvr: number;               // 0-100
}

export interface QualityResult {
  tier: QualityTier;
  score: number;             // composito 0-100
  z: number;                 // z-score nel set
  subs: QualitySubScores;
  /** Se la fascia è stata FORZATA da una regola gating, qui c'è la spiegazione
   *  in italiano (es. "0 lead con €87 di spesa"). null se classifica naturale. */
  reason: string | null;
}

/** Sottoinsieme dei campi PerfItem necessari per la classifica. */
export interface RankablePerf {
  ad_id: string;
  spend: number;
  lead: number;
  cpl: number;
  impressions?: number;
  // video
  hookRate?: number;       // 0-100
  holdRate?: number;       // 0-100
  view50Rate?: number;     // 0-100
  videoPlays?: number;
  // LP
  lpSessions?: number;
  lpBounces?: number;
  lpAvgScroll?: number;    // 0-100
  lpAvgTime?: number;      // secondi
  // lead quality
  disagioAvg?: number | null; // 0-10
  lpsCoverage?: number | null;       // 0-100 (% lead con disagio_score dichiarato)
  urgenzaScore?: number;      // 0-10
  portatorePct?: number;      // 0-100
}

/** Soglie gating configurabili dall'utente.
 *  Impressions = SOLO soglia di ingresso (non un segnale di qualità).
 *  Spesa = misura di "rischio reale" per giustificare un kill 0-lead. */
export interface GatingThresholds {
  minImpressions: number;
  zeroLeadKillSpend: number;
  highBounceKill: number;
  lowHookKill: number;
}

/** Default usati se il chiamante non passa una config (backward compat). */
const DEFAULT_GATE: GatingThresholds = {
  minImpressions: 1300,
  zeroLeadKillSpend: 50,
  highBounceKill: 80,
  lowHookKill: 15,
};

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mad(xs: number[], med: number): number {
  if (xs.length === 0) return 0;
  const dev = xs.map((x) => Math.abs(x - med));
  return median(dev);
}

/** Engagement video 0-100. Se l'ad non è video → null (verrà gestito col fallback). */
function videoEngagementScore(p: RankablePerf): number | null {
  if (!p.videoPlays || p.videoPlays <= 0) return null;
  const hook = clamp(p.hookRate ?? 0);    // già %
  const hold = clamp(p.holdRate ?? 0);
  const v50  = clamp(p.view50Rate ?? 0);
  return hook * 0.4 + hold * 0.4 + v50 * 0.2;
}

/** Qualità traffico LP 0-100. Null se zero sessions. */
function lpTrafficScore(p: RankablePerf): number | null {
  const s = p.lpSessions ?? 0;
  if (s <= 0) return null;
  const bounceRate = ((p.lpBounces ?? 0) / s) * 100;
  const engaged = clamp(100 - bounceRate);
  // 50% scroll = 100 pt
  const scroll = clamp(((p.lpAvgScroll ?? 0) / 50) * 100);
  // 60s = 100 pt
  const time = clamp(((p.lpAvgTime ?? 0) / 60) * 100);
  return engaged * 0.4 + scroll * 0.3 + time * 0.3;
}

/** Qualità lead 0-100. Null se zero lead.
 *  LPS pesato per Coverage: un LPS 8 con coverage 30% pesa meno di un LPS 6 con coverage 90%. */
function leadQualityScore(p: RankablePerf): number | null {
  if ((p.lead ?? 0) <= 0) return null;
  const lpsRaw = (p.disagioAvg ?? 0) * 10;          // 0-100
  const coverage = clamp(p.lpsCoverage ?? 0) / 100; // 0-1
  // Floor coverage 30% per non azzerare ad con pochi dati ma lead reali
  const effectiveCoverage = Math.max(0.3, coverage);
  const lpsWeighted = clamp(lpsRaw * effectiveCoverage);
  const urg = clamp((p.urgenzaScore ?? 0) * 10);
  const port = clamp(p.portatorePct ?? 0);
  return lpsWeighted * 0.5 + urg * 0.3 + port * 0.2;
}

/** CPL efficiency 0-100, relativo al set via z-score robusto (MAD). */
function cplEfficiencyScore(p: RankablePerf, medCpl: number, madCpl: number): number | null {
  if (!p.cpl || p.cpl <= 0 || medCpl <= 0) return null;
  if (madCpl <= 0) return 50; // tutti uguali → neutro
  // robusto: 1.4826 ≈ fattore consistenza con dev.std normale
  const z = (p.cpl - medCpl) / (1.4826 * madCpl);
  // CPL più basso = meglio. Score = 50 - 25*z, clamp.
  return clamp(50 - 25 * z);
}

/** CVR del traffico (lead / sessions). 8% = 100 pt. */
function cvrScore(p: RankablePerf): number | null {
  const s = p.lpSessions ?? 0;
  if (s <= 0) return null;
  const cvr = ((p.lead ?? 0) / s) * 100;
  return clamp((cvr / 8) * 100);
}

/** Composito 0-100. Pesi rinormalizzati sulle dimensioni effettivamente disponibili
 *  (così un'ad senza video non viene penalizzata per assenza dati video). */
const W = {
  videoEngagement: 0.25,
  lpTraffic: 0.25,
  leadQuality: 0.25,
  cplEfficiency: 0.15,
  cvr: 0.10,
};

function compositeScore(subs: Partial<QualitySubScores>): number | null {
  let num = 0, den = 0;
  for (const [k, w] of Object.entries(W) as [keyof QualitySubScores, number][]) {
    const v = subs[k];
    if (v == null || !isFinite(v)) continue;
    num += v * w;
    den += w;
  }
  return den > 0 ? num / den : null;
}

function tierFromZ(z: number): QualityTier {
  if (z >= 1.0) return "top";
  if (z >= 0.3) return "good";
  if (z > -0.3) return "avg";
  if (z > -1.0) return "low";
  return "poor";
}

/** Verifica gating: l'ad ha abbastanza dati di RISULTATO per essere classificata?
 *  Ritorna `null` se non è classificabile (sotto soglia impressions di ingresso),
 *  o un oggetto con `forcedTier` quando va FORZATA a una fascia (override hard penalty).
 *  Sentinel "avg" = nessun override, calcola normalmente.
 *
 *  IMPORTANTE: impressions è SOLO la soglia di ingresso, non un segnale di qualità.
 *  Le decisioni di kill si basano sui costi REALI (spesa) e sui RISULTATI (lead). */
function gatingCheck(p: RankablePerf, gate: GatingThresholds): { forcedTier: QualityTier; reason: string } | null {
  const spend = p.spend ?? 0;
  const lead = p.lead ?? 0;
  const impressions = p.impressions ?? 0;

  // 1) ENTRY: sotto la soglia di impressions configurata → non classificabile
  if (impressions < gate.minImpressions) {
    return null;
  }

  // 2) HARD KILL: spesa significativa + 0 lead → "poor" sempre
  if (lead === 0 && spend >= gate.zeroLeadKillSpend) {
    return { forcedTier: "poor", reason: `0 lead con €${spend.toFixed(0)} di spesa` };
  }

  // 3) Bounce rate catastrofico + 0 lead → cap a "poor"
  const lpSessions = p.lpSessions ?? 0;
  if (lpSessions >= 20 && lead === 0) {
    const bounceRate = ((p.lpBounces ?? 0) / lpSessions) * 100;
    if (bounceRate > gate.highBounceKill) {
      return { forcedTier: "poor", reason: `bounce ${bounceRate.toFixed(0)}% + 0 lead (${lpSessions} sessioni)` };
    }
  }

  // 4) Hook rate basso su video + 0 lead → cap a "low"
  if ((p.videoPlays ?? 0) > 0 && lead === 0
      && (p.hookRate ?? 0) < gate.lowHookKill && spend > 0) {
    return { forcedTier: "low", reason: `hook ${(p.hookRate ?? 0).toFixed(0)}% + 0 lead` };
  }

  return { forcedTier: "avg", reason: "" };
}

/** Calcola la classifica per un set di ad. Ritorna mappa ad_id → QualityResult.
 *  Solo ad con spend > 0 vengono considerate (le altre non sono attive nel periodo).
 *  Se il set è < 4 ad, ritorna mappa vuota (statistica non significativa).
 *
 *  v3 — Risultati prima di tutto:
 *  - Gating: serve impressions ≥ minImpressions (default 1300) per essere classificata
 *  - Hard penalty: 0 lead + spesa ≥ zeroLeadKillSpend → forzata "poor"
 *  - LeadQuality usa LPS × Coverage (non più solo portatore + urgenza). */
export function computeQualityRank(
  perf: RankablePerf[],
  gate: GatingThresholds = DEFAULT_GATE,
): Map<string, QualityResult> {
  const out = new Map<string, QualityResult>();
  const active = perf.filter((p) => (p.spend ?? 0) > 0);
  if (active.length < 4) return out;

  // Statistiche set per CPL z-score
  const cpls = active.map((p) => p.cpl).filter((v) => v > 0 && isFinite(v));
  const medCpl = median(cpls);
  const madCpl = mad(cpls, medCpl);

  // Step 1: subscores + composito + gating
  type Row = { ad_id: string; score: number; subs: QualitySubScores; forced: QualityTier | null; reason: string | null; lead: number; spend: number };
  const composites: Row[] = [];
  for (const p of active) {
    const gateResult = gatingCheck(p, gate);
    if (gateResult === null) continue; // non classificabile (sotto soglia impressions)

    const subsRaw = {
      videoEngagement: videoEngagementScore(p),
      lpTraffic: lpTrafficScore(p),
      leadQuality: leadQualityScore(p),
      cplEfficiency: cplEfficiencyScore(p, medCpl, madCpl),
      cvr: cvrScore(p),
    };
    const composite = compositeScore(subsRaw as Partial<QualitySubScores>);
    const forcedHard = gateResult.forcedTier !== "avg" ? gateResult.forcedTier : null;
    const reason = forcedHard ? gateResult.reason : null;
    // Se forced ma composite null, usa placeholder coerente con la fascia.
    const finalScore = composite ?? (forcedHard === "poor" ? 10 : forcedHard === "low" ? 30 : null);
    if (finalScore == null) continue;

    composites.push({
      ad_id: p.ad_id,
      score: finalScore,
      subs: {
        videoEngagement: subsRaw.videoEngagement ?? 0,
        lpTraffic: subsRaw.lpTraffic ?? 0,
        leadQuality: subsRaw.leadQuality ?? 0,
        cplEfficiency: subsRaw.cplEfficiency ?? 0,
        cvr: subsRaw.cvr ?? 0,
      },
      forced: forcedHard,
      reason,
      lead: p.lead ?? 0,
      spend: p.spend ?? 0,
    });
  }
  if (composites.length < 4) return out;

  // Step 2: z-score sulla distribuzione dei compositi
  const scores = composites.map((c) => c.score);
  const mu = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((s, x) => s + (x - mu) ** 2, 0) / scores.length;
  const sigma = Math.sqrt(variance);

  for (const c of composites) {
    const z = sigma > 0 ? (c.score - mu) / sigma : 0;
    let tier = c.forced ?? tierFromZ(z);
    let reason = c.reason;

    // FLOOR ASSOLUTO: senza lead reali non puoi essere "top"/"good", anche se
    // il set è tutto pessimo e lo z-score ti promuove. Lo z è relativo, ma
    // "Top" deve significare anche risultati assoluti minimi.
    if (!c.forced && c.lead === 0 && (tier === "top" || tier === "good")) {
      tier = "avg";
      reason = `0 lead nel periodo (cap a Media)`;
    }
    // Con 1 solo lead, max "good" (mai "top")
    if (!c.forced && c.lead < 2 && tier === "top") {
      tier = "good";
      reason = `solo ${c.lead} lead (cap a Sufficiente)`;
    }

    let displayScore = Math.round(c.score);
    if (c.forced === "poor") displayScore = Math.min(displayScore, 25);
    if (c.forced === "low") displayScore = Math.min(displayScore, 40);
    out.set(c.ad_id, {
      tier,
      score: displayScore,
      z,
      subs: c.subs,
      reason,
    });
  }
  return out;
}

// ───────── UI helpers (pure, riusabili da page + gallery) ─────────

export const TIER_LABEL: Record<QualityTier, string> = {
  top: "Sopra la media",
  good: "Sufficiente",
  avg: "Media",
  low: "Sotto la media",
  poor: "Scarso",
};

export const TIER_SHORT: Record<QualityTier, string> = {
  top: "🔥 Top",
  good: "✓ Buona",
  avg: "— Media",
  low: "⚠ Sotto",
  poor: "🔻 Scarso",
};

export const TIER_RANK: Record<QualityTier, number> = {
  top: 0, good: 1, avg: 2, low: 3, poor: 4,
};

/** Tint riga per tabella/lista. */
export function tierRowTint(t: QualityTier | undefined): string {
  switch (t) {
    case "top":  return "bg-emerald-50/70 hover:bg-emerald-50";
    case "good": return "bg-lime-50/60 hover:bg-lime-50";
    case "avg":  return "";
    case "low":  return "bg-amber-50/70 hover:bg-amber-50";
    case "poor": return "bg-rose-50/70 hover:bg-rose-50";
    default:     return "";
  }
}

/** Ring per le card gallery. */
export function tierRingClass(t: QualityTier | undefined): string {
  switch (t) {
    case "top":  return "ring-2 ring-emerald-300";
    case "good": return "ring-2 ring-lime-300";
    case "avg":  return "ring-1 ring-border";
    case "low":  return "ring-2 ring-amber-300";
    case "poor": return "ring-2 ring-rose-300";
    default:     return "ring-1 ring-border";
  }
}

/** Badge classes (bg+text+border) per pill. */
export function tierBadgeClass(t: QualityTier): string {
  switch (t) {
    case "top":  return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "good": return "bg-lime-100 text-lime-800 border-lime-200";
    case "avg":  return "bg-muted text-muted-foreground border-border";
    case "low":  return "bg-amber-100 text-amber-900 border-amber-300";
    case "poor": return "bg-rose-100 text-rose-800 border-rose-300";
  }
}
