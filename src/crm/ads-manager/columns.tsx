import type { CSSProperties, ReactNode } from "react";
import { FatigueSparkline } from "./FatigueSparkline";
import { HealthPill } from "./AdsInsightsUI";

/** Tipo locale del row di performance (subset usato dalle colonne).
 *  Permissivo a proposito: la pagina passa il PerfItem completo. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PerfRowLike = any;

export type Group = "Performance" | "Video" | "CRM" | "Engagement" | "LP" | "Quality";

/** Chiavi colonna: include sia campi di PerfItem sia colonne custom (es. sparkline). */
export type ColKey = string;

export interface Col {
  key: ColKey;
  label: string;
  fmt: (v: number | null) => string;
  group: Group;
  goodWhen?: "high" | "low";
  w?: string;
  hero?: boolean;
  /** Chiave in FORMULA_DOCS (metrics-formulas.ts) per il tooltip formula. */
  formulaKey?: string;
  /** Custom renderer (overrides fmt + arrow row). */
  render?: (p: PerfRowLike | undefined) => ReactNode;
}

/* ── formatter ── */
export const fmtEUR = (v: number | null) =>
  v == null ? "—" : `€${v.toLocaleString("it-IT", { maximumFractionDigits: 2 })}`;
export const fmtINT = (v: number | null) =>
  v == null ? "—" : Math.round(v).toLocaleString("it-IT");
export const fmtPCT = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}%`);
export const fmtX = (v: number | null) => (v == null ? "—" : `${v.toFixed(2)}x`);
export const fmtDays = (v: number | null) => (v == null ? "—" : `${Math.round(v)}gg`);
export const fmtScore = (v: number | null) => (v == null ? "—" : `${Math.round(v)}/100`);
export const fmtSec = (v: number | null) => (v == null ? "—" : `${Math.round(v)}s`);
export const fmtStep = (v: number | null) => (v == null ? "—" : `${v.toFixed(1)}/6`);

/** Catalogo completo delle colonne disponibili.
 *  Tutte restano accessibili dal menu "Personalizza colonne".
 *  I preset di sotto ne scelgono un sottoinsieme focalizzato. */
export const ALL_COLS: Col[] = [
  // ── Performance core ──
  { key: "spend", label: "Spesa", fmt: fmtEUR, group: "Performance", goodWhen: "low", w: "w-28", hero: true },
  { key: "lead", label: "Lead", fmt: fmtINT, group: "Performance", goodWhen: "high", w: "w-20", hero: true },
  { key: "cpl", label: "CPL", fmt: fmtEUR, group: "Performance", goodWhen: "low", w: "w-24", formulaKey: "cpl" },
  { key: "cpql", label: "CPQL", fmt: fmtEUR, group: "Performance", goodWhen: "low", w: "w-24", formulaKey: "cpql" },
  { key: "cac", label: "CAC", fmt: fmtEUR, group: "Performance", goodWhen: "low", w: "w-24", formulaKey: "cac" },
  { key: "roas", label: "ROAS", fmt: fmtX, group: "Performance", goodWhen: "high", w: "w-20", hero: true, formulaKey: "roas" },
  { key: "roasNetto", label: "ROAS netto", fmt: fmtX, group: "Performance", goodWhen: "high", w: "w-24", formulaKey: "roasNetto" },
  { key: "netto", label: "Netto", fmt: fmtEUR, group: "Performance", goodWhen: "high", w: "w-28", hero: true, formulaKey: "netto" },
  { key: "fatturato", label: "Fatturato", fmt: fmtEUR, group: "Performance", goodWhen: "high", w: "w-28" },

  // ── CRM / Funnel ──
  { key: "showRate", label: "Show %", fmt: fmtPCT, group: "CRM", goodWhen: "high", w: "w-24" },
  { key: "closeRate", label: "Close %", fmt: fmtPCT, group: "CRM", goodWhen: "high", w: "w-24" },
  { key: "aov", label: "AOV", fmt: fmtEUR, group: "CRM", goodWhen: "high", w: "w-24" },
  { key: "disagioAvg", label: "Disagio (LPS)", fmt: fmtScore, group: "CRM", goodWhen: "high", w: "w-28" },
  // LPS Coverage: % lead con score dichiarato. Distingue "lead muti" da "lead davvero freddi".
  { key: "lpsCoverage", label: "LPS Cover %", fmt: fmtPCT, group: "CRM", goodWhen: "high", w: "w-28" },
  { key: "paybackDays", label: "Payback", fmt: fmtDays, group: "CRM", goodWhen: "low", w: "w-24" },
  { key: "conversioni", label: "Vendite", fmt: fmtINT, group: "CRM", goodWhen: "high", w: "w-20" },

  // ── Engagement Meta ──
  { key: "impressions", label: "Impressions", fmt: fmtINT, group: "Engagement", goodWhen: "high", w: "w-28" },
  { key: "clicks", label: "Clicks", fmt: fmtINT, group: "Engagement", goodWhen: "high", w: "w-24" },
  { key: "ctrLink", label: "CTR Link", fmt: fmtPCT, group: "Engagement", goodWhen: "high", w: "w-24", formulaKey: "ctrLink" },
  { key: "ctrOutbound", label: "CTR Out", fmt: fmtPCT, group: "Engagement", goodWhen: "high", w: "w-24", formulaKey: "ctrOutbound" },
  { key: "cpc", label: "CPC", fmt: fmtEUR, group: "Engagement", goodWhen: "low", w: "w-20", formulaKey: "cpc" },
  { key: "cpm", label: "CPM", fmt: fmtEUR, group: "Engagement", goodWhen: "low", w: "w-20", formulaKey: "cpm" },
  { key: "frequency", label: "Frequenza", fmt: (v) => (v == null ? "—" : `${v.toFixed(2)}x`), group: "Engagement", goodWhen: "low", w: "w-24", formulaKey: "frequency" },
  { key: "lpv", label: "LP Views", fmt: fmtINT, group: "Engagement", goodWhen: "high", w: "w-24" },
  { key: "lpViewRate", label: "LP View Rate", fmt: fmtPCT, group: "Engagement", goodWhen: "high", w: "w-28", formulaKey: "lpViewRate" },
  { key: "postEng", label: "Engagement", fmt: fmtINT, group: "Engagement", goodWhen: "high", w: "w-28" },

  // ── Video ──
  { key: "videoPlays", label: "Video Plays", fmt: fmtINT, group: "Video", goodWhen: "high", w: "w-28", formulaKey: "videoPlays" },
  { key: "thumbstopRate", label: "Thumbstop", fmt: fmtPCT, group: "Video", goodWhen: "high", w: "w-28", formulaKey: "thumbstopRate" },
  { key: "hookRate", label: "Hook (3s)", fmt: fmtPCT, group: "Video", goodWhen: "high", w: "w-28", formulaKey: "hookRate" },
  { key: "holdRate", label: "Hold (Thru)", fmt: fmtPCT, group: "Video", goodWhen: "high", w: "w-28", formulaKey: "holdRate" },
  { key: "view25Rate", label: "View 25%", fmt: fmtPCT, group: "Video", goodWhen: "high", w: "w-24", formulaKey: "view25Rate" },
  { key: "view50Rate", label: "View 50%", fmt: fmtPCT, group: "Video", goodWhen: "high", w: "w-24", formulaKey: "view50Rate" },
  { key: "view75Rate", label: "View 75%", fmt: fmtPCT, group: "Video", goodWhen: "high", w: "w-24", formulaKey: "view75Rate" },
  { key: "view100Rate", label: "View 100%", fmt: fmtPCT, group: "Video", goodWhen: "high", w: "w-24", formulaKey: "view100Rate" },
  { key: "thruRate", label: "Thru Rate", fmt: fmtPCT, group: "Video", goodWhen: "high", w: "w-24", formulaKey: "thruRate" },

  // ── LP quality (Sprint 1: nuove metriche LP per ad) ──
  { key: "pageViews", label: "PageView LP", fmt: fmtINT, group: "LP", goodWhen: "high", w: "w-28" },
  { key: "lpBounceRate", label: "LP Bounce %", fmt: fmtPCT, group: "LP", goodWhen: "low", w: "w-28" },
  { key: "lpAvgTime", label: "Avg Time LP", fmt: fmtSec, group: "LP", goodWhen: "high", w: "w-28" },
  { key: "lpDropStepAvg", label: "Drop Step", fmt: fmtStep, group: "LP", goodWhen: "high", w: "w-24" },
  { key: "hqv", label: "Visite Qualità", fmt: fmtINT, group: "LP", goodWhen: "high", w: "w-28" },
  { key: "cps50", label: "Costo / Scroll 50%", fmt: fmtEUR, group: "LP", goodWhen: "low", w: "w-32" },
  { key: "cpt30", label: "Costo / 30s", fmt: fmtEUR, group: "LP", goodWhen: "low", w: "w-28" },
  { key: "cplQ", label: "CPL-Q (Lettore)", fmt: fmtEUR, group: "LP", goodWhen: "low", w: "w-32" },
  { key: "avgScroll", label: "Scroll medio", fmt: fmtPCT, group: "LP", goodWhen: "high", w: "w-28" },
  { key: "avgTime", label: "Tempo medio", fmt: fmtSec, group: "LP", goodWhen: "high", w: "w-28" },
  // Avanzate
  { key: "cps0", label: "Costo / PageView", fmt: fmtEUR, group: "LP", goodWhen: "low", w: "w-32" },
  { key: "cps25", label: "Costo / Scroll 25%", fmt: fmtEUR, group: "LP", goodWhen: "low", w: "w-32" },
  { key: "cps75", label: "Costo / Scroll 75%", fmt: fmtEUR, group: "LP", goodWhen: "low", w: "w-32" },
  { key: "cps100", label: "Costo / Scroll 100%", fmt: fmtEUR, group: "LP", goodWhen: "low", w: "w-32" },
  { key: "cpt15", label: "Costo / 15s", fmt: fmtEUR, group: "LP", goodWhen: "low", w: "w-28" },
  { key: "cpt60", label: "Costo / 1min", fmt: fmtEUR, group: "LP", goodWhen: "low", w: "w-28" },
  // Bot rate: % sessioni LP marcate come bot rispetto al totale (sessioni reali + bot).
  { key: "botRate", label: "Bot Rate %", fmt: fmtPCT, group: "LP", goodWhen: "low", w: "w-28" },

  // ── Quality / Fatigue ──
  // NOTA: qualityRate vecchio (HQV/PV opaco) sostituito da Traffic Quality v2
  // (5 segnali pesati). Resta accessibile come "Qualità RAW" per chi la conosce.
  { key: "trafficQuality", label: "Traffic Quality", fmt: fmtScore, group: "Quality", goodWhen: "high", w: "w-32", hero: true },
  { key: "qualityRate", label: "Qualità RAW %", fmt: fmtPCT, group: "Quality", goodWhen: "high", w: "w-28" },
  { key: "portatorePct", label: "% Portatori", fmt: fmtPCT, group: "Quality", goodWhen: "high", w: "w-28" },
  { key: "urgenzaScore", label: "Urgenza /10", fmt: (v) => (v == null ? "—" : `${v.toFixed(1)}/10`), group: "Quality", goodWhen: "high", w: "w-28" },
  { key: "fatigueScore", label: "Fatigue", fmt: fmtScore, group: "Quality", goodWhen: "low", w: "w-24" },
  {
    key: "fatigueTrend7d",
    label: "Trend Fatigue 7gg",
    fmt: () => "—",
    group: "Quality",
    goodWhen: "low",
    w: "w-32",
    render: (p) => <FatigueSparkline trend={p?.trend ?? []} />,
  },
  // Health Score v2 (renderer in colonna, valore iniettato come `__health`).
  {
    key: "health",
    label: "Health",
    fmt: () => "—",
    group: "Quality",
    goodWhen: "high",
    w: "w-24",
    render: (p) => <HealthPill score={(p as { __health?: number | null } | undefined)?.__health ?? null} />,
  },
];

/** Preset focalizzati: max 8 colonne ciascuno. */
export type PresetKey = "Quick" | "Performance" | "Funnel" | "Creativa" | "Fatigue" | "Quality";

export const PRESETS: Record<PresetKey, ColKey[]> = {
  // Default: triage in 1 secondo. Health v2 + nuove metriche qualità.
  Quick: ["spend", "lead", "cpl", "cpql", "roas", "roasNetto", "health", "fatigueTrend7d"],
  // Salute media: efficienza acquisizione.
  Performance: ["spend", "lead", "cpl", "cpql", "roas", "roasNetto", "netto", "ctrLink"],
  // Funnel commerciale: dal lead alla cassa.
  Funnel: ["spend", "lead", "showRate", "closeRate", "aov", "cac", "paybackDays"],
  // Creativa: hook + retention + LP engagement.
  Creativa: ["spend", "hookRate", "holdRate", "thumbstopRate", "avgScroll", "avgTime", "fatigueTrend7d"],
  // Stanchezza: include sparkline.
  Fatigue: ["spend", "lead", "frequency", "avgScroll", "avgTime", "fatigueTrend7d", "ctrLink", "cpl"],
  // Sprint 1+2 nuovo: qualità traffico LP-driven.
  Quality: ["spend", "lead", "trafficQuality", "lpBounceRate", "botRate", "lpDropStepAvg", "cpql", "health"],
};

export const PRESET_ORDER: PresetKey[] = ["Quick", "Performance", "Funnel", "Creativa", "Fatigue", "Quality"];

/** Helper: estrae numero da un campo se numerico, altrimenti null.
 *  Le colonne custom (sparkline, health) NON sono numeriche → ritorna null.
 *  `cpc`, `cpql`, `roasNetto`, `trafficQuality` sono SINTETICHE: derivate
 *  client-side da quality-v2.ts via campi `__cpql`, `__roasNetto`, `__tq`. */
const NON_NUMERIC: ColKey[] = ["fatigueTrend7d", "health"];
/** Colonne che NON partecipano alla heat-map / ranking "sopra/sotto media". */
export const NON_RANKABLE: ColKey[] = ["impressions", "clicks", "lead", "videoPlays", "pageViews", "lpv", "hqv", "postEng", "conversioni"];

export function getNum(p: PerfRowLike | undefined, k: ColKey): number | null {
  if (!p || NON_NUMERIC.includes(k)) return null;
  if (k === "cpc") {
    const spend = (p as Record<string, unknown>).spend;
    const lc = (p as Record<string, unknown>).linkClicks;
    if (typeof spend === "number" && typeof lc === "number" && lc > 0) return spend / lc;
    return null;
  }
  // Colonne sintetiche calcolate via quality-v2 e iniettate dalla pagina.
  if (k === "cpql") {
    const v = (p as Record<string, unknown>).__cpql;
    return typeof v === "number" ? v : null;
  }
  if (k === "roasNetto") {
    const v = (p as Record<string, unknown>).__roasNetto;
    return typeof v === "number" ? v : null;
  }
  if (k === "trafficQuality") {
    const v = (p as Record<string, unknown>).__tq;
    return typeof v === "number" ? v : null;
  }
  // Bot rate sintetico: lpBots / (lpSessions + lpBots) * 100. Null se volume insufficiente.
  if (k === "botRate") {
    const sessions = Number((p as Record<string, unknown>).lpSessions ?? 0);
    const bots = Number((p as Record<string, unknown>).lpBots ?? 0);
    const total = sessions + bots;
    if (total < 5) return null; // serve volume minimo per essere significativo
    return (bots / total) * 100;
  }
  const v = (p as Record<string, unknown>)[k];
  return typeof v === "number" ? v : null;
}

/** Heat-map: ritorna uno style con background gradient verde→rosso in base al rank
 *  del valore `v` nel range [min..max]. `goodWhen` decide la direzione. */
export function heatStyle(
  v: number | null,
  values: number[],
  goodWhen: "high" | "low" | undefined,
): CSSProperties | null {
  if (v == null || !goodWhen || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return null;
  const norm = (v - min) / (max - min);
  const score = goodWhen === "high" ? norm : 1 - norm;
  const hue = score * 130;
  return { backgroundColor: `oklch(0.96 0.06 ${hue} / 0.55)` };
}
