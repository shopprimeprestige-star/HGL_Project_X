// Utility riusabile: calcola delta % vs periodo precedente equivalente per tutti i preset del DateRangeFilter.
// Input generico: serie di punti {date: "YYYY-MM-DD", spend?, lead?, revenue?, sessions?, conversions?}.
// Output: mappa preset_key → {spend, lead, cpl, roas, cvr} in delta %.
//
// Esempio: se selezioni preset "30g" (ultimi 30), confronta con i 30 giorni precedenti equivalenti.

import type { PresetDelta } from "./DateRangeFilter";

export interface RangeDeltaPoint {
  date: string; // "YYYY-MM-DD"
  spend?: number;
  lead?: number;
  revenue?: number;
  sessions?: number;
  conversions?: number;
}

interface Agg {
  spend: number;
  lead: number;
  revenue: number;
  sessions: number;
  conversions: number;
}

const EMPTY: Agg = { spend: 0, lead: 0, revenue: 0, sessions: 0, conversions: 0 };

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function aggregate(points: RangeDeltaPoint[], from: string, to: string): Agg {
  const a = { ...EMPTY };
  for (const p of points) {
    if (!p.date) continue;
    const d = p.date.slice(0, 10);
    if (d < from || d > to) continue;
    a.spend += p.spend ?? 0;
    a.lead += p.lead ?? 0;
    a.revenue += p.revenue ?? 0;
    a.sessions += p.sessions ?? 0;
    a.conversions += p.conversions ?? 0;
  }
  return a;
}

function pct(cur: number, prev: number): number | null {
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / prev) * 100;
}

function metricsOf(a: Agg) {
  return {
    spend: a.spend,
    lead: a.lead,
    revenue: a.revenue,
    sessions: a.sessions,
    conversions: a.conversions,
    cpl: a.lead > 0 ? a.spend / a.lead : 0,
    roas: a.spend > 0 ? a.revenue / a.spend : 0,
    cvr: a.sessions > 0 ? (a.conversions / a.sessions) * 100 : 0,
  };
}

function deltaOf(cur: Agg, prev: Agg, prevLabel?: string): PresetDelta {
  const c = metricsOf(cur);
  const p = metricsOf(prev);
  return {
    spend: pct(c.spend, p.spend),
    lead: pct(c.lead, p.lead),
    cpl: pct(c.cpl, p.cpl),
    roas: pct(c.roas, p.roas),
    cvr: pct(c.cvr, p.cvr),
    current: c,
    previous: p,
    prevLabel,
  };
}

/** Calcola serie giornaliere {spend, lead, cpl, roas, cvr} per finestra [from, to] inclusivi. */
function buildDailyTrends(points: RangeDeltaPoint[], from: string, to: string): NonNullable<PresetDelta["trends"]> {
  const buckets = new Map<string, Agg>();
  const fD = new Date(from + "T00:00:00");
  const tD = new Date(to + "T00:00:00");
  for (let d = new Date(fD); d <= tD; d.setDate(d.getDate() + 1)) {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    buckets.set(key, { ...EMPTY });
  }
  for (const p of points) {
    if (!p.date) continue;
    const d = p.date.slice(0, 10);
    const b = buckets.get(d);
    if (!b) continue;
    b.spend += p.spend ?? 0;
    b.lead += p.lead ?? 0;
    b.revenue += p.revenue ?? 0;
    b.sessions += p.sessions ?? 0;
    b.conversions += p.conversions ?? 0;
  }
  const sorted = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  return {
    spend: sorted.map((a) => a.spend),
    lead: sorted.map((a) => a.lead),
    cpl: sorted.map((a) => (a.lead > 0 ? a.spend / a.lead : 0)),
    roas: sorted.map((a) => (a.spend > 0 ? a.revenue / a.spend : 0)),
    cvr: sorted.map((a) => (a.sessions > 0 ? (a.conversions / a.sessions) * 100 : 0)),
  };
}

/** Costruisce i delta per finestra di N giorni (preset "3g","7g","15g","30g","90g","180g"): confronta ultimi N gg vs N gg precedenti. */
function windowDelta(points: RangeDeltaPoint[], days: number): PresetDelta {
  const curFrom = isoDaysAgo(days - 1);
  const curTo = isoDaysAgo(0);
  const prevFrom = isoDaysAgo(days * 2 - 1);
  const prevTo = isoDaysAgo(days);
  const curAgg = aggregate(points, curFrom, curTo);
  const base = deltaOf(curAgg, aggregate(points, prevFrom, prevTo), `${days}gg precedenti`);
  return { ...base, trends: buildDailyTrends(points, curFrom, curTo), volume: curAgg.lead };
}

/** Delta singolo giorno: today vs yesterday, yesterday vs day before. */
function singleDayDelta(points: RangeDeltaPoint[], curDaysAgo: number): PresetDelta {
  const cur = isoDaysAgo(curDaysAgo);
  const prev = isoDaysAgo(curDaysAgo + 1);
  // Per il singolo giorno mostriamo gli ultimi 7gg come trend di contesto
  const ctxFrom = isoDaysAgo(curDaysAgo + 6);
  const curAgg = aggregate(points, cur, cur);
  const base = deltaOf(
    curAgg,
    aggregate(points, prev, prev),
    curDaysAgo === 0 ? "Ieri" : "Giorno prec.",
  );
  return { ...base, trends: buildDailyTrends(points, ctxFrom, cur), volume: curAgg.lead };
}

/** Costruisce la mappa completa presetDeltas per tutti i preset gestiti dal DateRangeFilter.
 *  Può essere passata direttamente a <DateRangeFilter presetDeltas={...} />. */
export function computeAllPresetDeltas(points: RangeDeltaPoint[]): Record<string, PresetDelta> {
  return {
    today: singleDayDelta(points, 0),
    yesterday: singleDayDelta(points, 1),
    today_vs_yesterday: singleDayDelta(points, 0),
    "3": windowDelta(points, 3),
    "7": windowDelta(points, 7),
    "7v7": windowDelta(points, 7),
    "15": windowDelta(points, 15),
    "30": windowDelta(points, 30),
    "90": windowDelta(points, 90),
    "180": windowDelta(points, 180),
  };
}

/** Variante: calcola il delta solo per il range attualmente selezionato.
 *  Utile se preferisci non iterare tutti i preset. */
export function computeRangeDelta(
  points: RangeDeltaPoint[],
  range: { from: string | null; to: string | null },
): PresetDelta | null {
  if (!range.from && !range.to) return null;
  const from = range.from || range.to!;
  const to = range.to || range.from!;
  // Lunghezza finestra in giorni (inclusivi)
  const fD = new Date(from + "T00:00:00");
  const tD = new Date(to + "T00:00:00");
  const days = Math.max(1, Math.round((tD.getTime() - fD.getTime()) / 86400000) + 1);
  // Periodo precedente equivalente: stessa lunghezza, subito prima di "from"
  const prevToD = new Date(fD);
  prevToD.setDate(prevToD.getDate() - 1);
  const prevFromD = new Date(prevToD);
  prevFromD.setDate(prevFromD.getDate() - (days - 1));
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const curAgg = aggregate(points, from, to);
  const base = deltaOf(
    curAgg,
    aggregate(points, iso(prevFromD), iso(prevToD)),
    `${days}gg precedenti`,
  );
  return { ...base, trends: buildDailyTrends(points, from, to), volume: curAgg.lead };
}
