// Utility per analisi customer journey multi-touch.
// Usa touch_history (jsonb su public_leads) per ricostruire flussi cross-channel.

export type Channel = "meta" | "tiktok" | "google" | "email" | "direct" | "organic";
export const CHANNELS: Channel[] = ["meta", "tiktok", "google", "email", "direct", "organic"];
export const CHANNEL_LABEL: Record<Channel, string> = {
  meta: "Meta",
  tiktok: "TikTok",
  google: "Google",
  email: "Email",
  direct: "Direct",
  organic: "Organico",
};
export const CHANNEL_COLOR: Record<Channel, string> = {
  meta: "oklch(0.6 0.2 250)",
  tiktok: "oklch(0.55 0.22 350)",
  google: "oklch(0.65 0.18 50)",
  email: "oklch(0.6 0.15 180)",
  direct: "oklch(0.55 0.02 250)",
  organic: "oklch(0.65 0.18 145)",
};

export interface Touch {
  ch: Channel;
  ts: number; // epoch ms
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  clid?: string; // fbclid / ttclid / gclid
  page?: string;
}

export type JourneyType =
  | "cold_direct"
  | "cold_assisted"
  | "retarget_same"
  | "retarget_cross"
  | "retarget_multi";

export const JOURNEY_LABEL: Record<JourneyType, string> = {
  cold_direct: "Cold Diretto",
  cold_assisted: "Cold Assistito",
  retarget_same: "Retarget Same-Channel",
  retarget_cross: "Retarget Cross-Channel",
  retarget_multi: "Retarget Multi-Touch",
};

export const JOURNEY_COLOR: Record<JourneyType, string> = {
  cold_direct: "oklch(0.65 0.15 220)",
  cold_assisted: "oklch(0.7 0.13 180)",
  retarget_same: "oklch(0.7 0.17 80)",
  retarget_cross: "oklch(0.65 0.2 30)",
  retarget_multi: "oklch(0.55 0.22 320)",
};

/** Detecta il canale da utm_source/clid (logica condivisa con tracking.ts) */
export function detectChannelFromTouch(t: Partial<Touch> & { utm_source?: string; clid?: string; ttclid?: string; fbclid?: string; gclid?: string }): Channel {
  const src = (t.utm_source || "").toLowerCase();
  if (t.ttclid || src.includes("tiktok")) return "tiktok";
  if (t.fbclid || src.includes("facebook") || src.includes("meta") || src.includes("instagram")) return "meta";
  if (t.gclid || src.includes("google")) {
    if (src.includes("organic") || src.includes("seo")) return "organic";
    return "google";
  }
  if (src.includes("email") || src.includes("newsletter") || src.includes("mailchimp")) return "email";
  if (src.includes("direct") || !src) return "direct";
  return "organic";
}

/** Classifica il customer journey in base ai touchpoint */
export function classifyJourney(touches: Touch[]): JourneyType {
  if (!touches || touches.length === 0) return "cold_direct";
  const adChannels: Channel[] = ["meta", "tiktok", "google", "email"];
  const adTouches = touches.filter((t) => adChannels.includes(t.ch));
  const distinctAdCh = new Set(adTouches.map((t) => t.ch));

  if (adTouches.length === 0) return "cold_direct";
  if (adTouches.length === 1) {
    return touches.length === 1 ? "cold_direct" : "cold_assisted";
  }
  // ≥2 touch ad
  if (adTouches.length >= 3 && distinctAdCh.size >= 2) return "retarget_multi";
  if (distinctAdCh.size >= 2) return "retarget_cross";
  return "retarget_same";
}

/** Calcola days/hours to convert dato il primo touch e la data di conversione */
export function computeTimeToConvert(touches: Touch[], convertedAt: number): { days: number; hours: number } {
  if (!touches || touches.length === 0) return { days: 0, hours: 0 };
  const first = Math.min(...touches.map((t) => t.ts));
  const ms = Math.max(0, convertedAt - first);
  return {
    hours: Math.round(ms / (1000 * 60 * 60)),
    days: Math.round(ms / (1000 * 60 * 60 * 24)),
  };
}

/** Lead minimal per il calcolo journey */
export interface JourneyLead {
  id: string;
  touches: Touch[];
  firstChannel: Channel | null;
  lastChannel: Channel | null;
  journeyType: JourneyType | null;
  daysToConvert: number | null;
  hoursToConvert: number | null;
  converted: boolean;
  revenue: number;
  spend?: number; // opzionale, per ROAS per path
  createdAt: Date;
  convertedAt: Date | null;
  // Qualifica (opzionale) — per segmentazioni "CVR Generale style" con attribution corretta
  disagioScore?: number | null;
  urgenza?: string | null;
  portatore?: boolean | null;
}

/** Costruisce matrice 6x6 first→last channel: counts + revenue */
export interface MatrixCell {
  count: number;
  revenue: number;
  conversions: number;
  leadIds: string[];
}
export function computeMatrix(leads: JourneyLead[]): Record<Channel, Record<Channel, MatrixCell>> {
  const out = {} as Record<Channel, Record<Channel, MatrixCell>>;
  CHANNELS.forEach((r) => {
    out[r] = {} as Record<Channel, MatrixCell>;
    CHANNELS.forEach((c) => {
      out[r][c] = { count: 0, revenue: 0, conversions: 0, leadIds: [] };
    });
  });
  leads.forEach((l) => {
    const first = l.firstChannel || "direct";
    const last = l.lastChannel || "direct";
    out[first][last].count++;
    out[first][last].leadIds.push(l.id);
    if (l.converted) {
      out[first][last].conversions++;
      out[first][last].revenue += l.revenue;
    }
  });
  return out;
}

/** Top winning paths: ranking per revenue (sequenze concatenate) */
export interface PathRow {
  path: Channel[];
  pathLabel: string;
  leads: number;
  conversions: number;
  revenue: number;
  roas: number;
  spend: number;
}
export function topPaths(leads: JourneyLead[], n = 10, totalSpendByChannel?: Record<Channel, number>): PathRow[] {
  const map = new Map<string, { path: Channel[]; leads: number; conv: number; rev: number; chs: Set<Channel> }>();
  leads.forEach((l) => {
    if (!l.touches || l.touches.length === 0) return;
    // dedupe consecutivi: meta→meta→tiktok = meta→tiktok
    const path: Channel[] = [];
    l.touches
      .slice()
      .sort((a, b) => a.ts - b.ts)
      .forEach((t) => {
        if (path.length === 0 || path[path.length - 1] !== t.ch) path.push(t.ch);
      });
    if (path.length === 0) return;
    const key = path.join(">");
    const cur = map.get(key) || { path, leads: 0, conv: 0, rev: 0, chs: new Set<Channel>() };
    cur.leads++;
    path.forEach((c) => cur.chs.add(c));
    if (l.converted) {
      cur.conv++;
      cur.rev += l.revenue;
    }
    map.set(key, cur);
  });

  return [...map.values()]
    .map((v) => {
      const spend = totalSpendByChannel
        ? [...v.chs].reduce((s, c) => s + (totalSpendByChannel[c] || 0), 0) / Math.max(1, v.chs.size)
        : 0;
      return {
        path: v.path,
        pathLabel: v.path.map((c) => CHANNEL_LABEL[c]).join(" → "),
        leads: v.leads,
        conversions: v.conv,
        revenue: v.rev,
        roas: spend > 0 ? v.rev / spend : 0,
        spend,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, n);
}

/** Cohort buckets per giorni-to-convert */
export interface CohortBucket {
  label: string;
  min: number;
  max: number;
  leads: number;
  conversions: number;
  revenue: number;
  cpl: number; // proxy se totale spend disponibile
}
export function cohortBuckets(leads: JourneyLead[], totalSpend = 0): CohortBucket[] {
  const buckets: { label: string; min: number; max: number }[] = [
    { label: "0gg (same session)", min: 0, max: 0 },
    { label: "1gg", min: 1, max: 1 },
    { label: "2-3gg", min: 2, max: 3 },
    { label: "4-7gg", min: 4, max: 7 },
    { label: "8-14gg", min: 8, max: 14 },
    { label: "15-30gg", min: 15, max: 30 },
    { label: "30+gg", min: 31, max: Infinity },
  ];
  const out: CohortBucket[] = buckets.map((b) => ({ ...b, leads: 0, conversions: 0, revenue: 0, cpl: 0 }));
  leads.forEach((l) => {
    const d = l.daysToConvert ?? 0;
    const idx = out.findIndex((b) => d >= b.min && d <= b.max);
    if (idx === -1) return;
    out[idx].leads++;
    if (l.converted) {
      out[idx].conversions++;
      out[idx].revenue += l.revenue;
    }
  });
  const totalLeads = leads.length || 1;
  out.forEach((b) => {
    b.cpl = b.leads > 0 ? (totalSpend * (b.leads / totalLeads)) / b.leads : 0;
  });
  return out;
}

/** Channel assist score: direct vs assisted */
export interface AssistScore {
  channel: Channel;
  direct: number; // come last touch convertito
  assisted: number; // appare nel journey ma non come last
  total: number;
  assistRatio: number; // 0..1
  revenue: number; // revenue dove il canale è first OR last
  spend: number;
  trueRoas: number;
}
export function channelAssistScore(leads: JourneyLead[], spendByChannel: Record<Channel, number>): AssistScore[] {
  const out = {} as Record<Channel, AssistScore>;
  CHANNELS.forEach((c) => {
    out[c] = {
      channel: c,
      direct: 0,
      assisted: 0,
      total: 0,
      assistRatio: 0,
      revenue: 0,
      spend: spendByChannel[c] || 0,
      trueRoas: 0,
    };
  });
  leads.forEach((l) => {
    if (!l.converted || !l.touches || l.touches.length === 0) return;
    const chsInJourney = new Set(l.touches.map((t) => t.ch));
    const last = l.lastChannel;
    const first = l.firstChannel;
    chsInJourney.forEach((c) => {
      if (c === last) {
        out[c].direct++;
      } else {
        out[c].assisted++;
      }
      if (c === first || c === last) {
        out[c].revenue += l.revenue / 2; // split first+last
      }
    });
  });
  CHANNELS.forEach((c) => {
    out[c].total = out[c].direct + out[c].assisted;
    out[c].assistRatio = out[c].total > 0 ? out[c].assisted / out[c].total : 0;
    out[c].trueRoas = out[c].spend > 0 ? out[c].revenue / out[c].spend : 0;
  });
  return CHANNELS.map((c) => out[c]);
}

/** Z-score anomaly detection sui valori daily */
export interface AnomalyAlert {
  metric: string;
  date: string;
  value: number;
  mean: number;
  stdDev: number;
  zScore: number;
  severity: "warning" | "critical";
  direction: "spike" | "drop";
}
export function zScoreAlerts(
  series: { date: string; value: number }[],
  metric: string,
  threshold = 2,
  inverse = false, // true se "alto = brutto" (es. CPL)
): AnomalyAlert[] {
  if (series.length < 7) return [];
  const vals = series.map((s) => s.value).filter((v) => isFinite(v));
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const variance = vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return [];
  const out: AnomalyAlert[] = [];
  series.forEach((s) => {
    const z = (s.value - mean) / stdDev;
    if (Math.abs(z) >= threshold) {
      const direction: "spike" | "drop" = z > 0 ? "spike" : "drop";
      // se inverse: spike è "drop" semantico (CPL su = peggio = critical)
      const isBad = inverse ? direction === "spike" : direction === "drop";
      out.push({
        metric,
        date: s.date,
        value: s.value,
        mean,
        stdDev,
        zScore: z,
        direction,
        severity: isBad && Math.abs(z) >= threshold + 1 ? "critical" : "warning",
      });
    }
  });
  return out.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
}

/** Applica un modello di attribuzione ai touchpoint per ricalcolare revenue per canale */
export type AttributionModel = "first_touch" | "last_touch" | "linear" | "time_decay" | "position_based";

export const ATTRIBUTION_LABEL: Record<AttributionModel, string> = {
  first_touch: "First-Touch",
  last_touch: "Last-Touch",
  linear: "Linear",
  time_decay: "Time-Decay (7gg half-life)",
  position_based: "Position-Based (40-20-40)",
};

export function applyAttributionModel(
  leads: JourneyLead[],
  model: AttributionModel,
): Record<Channel, { revenue: number; conversions: number }> {
  const out = {} as Record<Channel, { revenue: number; conversions: number }>;
  CHANNELS.forEach((c) => {
    out[c] = { revenue: 0, conversions: 0 };
  });

  leads.forEach((l) => {
    if (!l.converted || !l.touches || l.touches.length === 0) return;
    const touches = l.touches.slice().sort((a, b) => a.ts - b.ts);
    const n = touches.length;
    const credits: Record<string, number> = {};

    const addCredit = (idx: number, weight: number) => {
      const ch = touches[idx].ch;
      credits[ch] = (credits[ch] || 0) + weight;
    };

    if (model === "first_touch") {
      addCredit(0, 1);
    } else if (model === "last_touch") {
      addCredit(n - 1, 1);
    } else if (model === "linear") {
      touches.forEach((_, i) => addCredit(i, 1 / n));
    } else if (model === "time_decay") {
      // half-life 7gg: peso = 0.5 ^ (giorni_dal_last / 7)
      const lastTs = touches[n - 1].ts;
      const weights = touches.map((t) => {
        const days = (lastTs - t.ts) / (1000 * 60 * 60 * 24);
        return Math.pow(0.5, days / 7);
      });
      const sum = weights.reduce((a, b) => a + b, 0) || 1;
      touches.forEach((_, i) => addCredit(i, weights[i] / sum));
    } else if (model === "position_based") {
      if (n === 1) addCredit(0, 1);
      else if (n === 2) {
        addCredit(0, 0.5);
        addCredit(1, 0.5);
      } else {
        addCredit(0, 0.4);
        addCredit(n - 1, 0.4);
        const midShare = 0.2 / (n - 2);
        for (let i = 1; i < n - 1; i++) addCredit(i, midShare);
      }
    }

    Object.entries(credits).forEach(([ch, w]) => {
      const c = ch as Channel;
      if (!out[c]) out[c] = { revenue: 0, conversions: 0 };
      out[c].revenue += l.revenue * w;
      out[c].conversions += w;
    });
  });

  return out;
}

/** Estrae touches dal payload di un lead (gestisce sia DB row che fallback dal tracking JSON) */
export function extractTouches(raw: unknown): Touch[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw
      .filter((t): t is Record<string, unknown> => t !== null && typeof t === "object")
      .map((t) => {
        const ts = typeof t.ts === "number" ? t.ts : typeof t.ts === "string" ? Date.parse(t.ts) : Date.now();
        const ch = (t.ch as Channel) || detectChannelFromTouch({
          utm_source: t.utm_source as string | undefined,
          fbclid: t.fbclid as string | undefined,
          ttclid: t.ttclid as string | undefined,
          gclid: t.gclid as string | undefined,
        });
        return {
          ch,
          ts,
          utm_source: t.utm_source as string | undefined,
          utm_medium: t.utm_medium as string | undefined,
          utm_campaign: t.utm_campaign as string | undefined,
          clid: (t.clid as string) || (t.fbclid as string) || (t.ttclid as string) || (t.gclid as string),
          page: t.page as string | undefined,
        };
      });
  }
  return [];
}
