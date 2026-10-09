/** Verdetto operativo a colpo d'occhio per ogni inserzione.
 *
 *  Combina i segnali GIÀ CALCOLATI (quality-rank tier, health v2, alerts,
 *  fatigue, spesa, lead) in UNA singola etichetta pratica + motivo + azione
 *  suggerita. NON sostituisce le metriche esistenti: le aggrega per fornire
 *  un "verdetto del manager" leggibile in 1 secondo.
 *
 *  Regole (in ordine di priorità — la prima che matcha vince):
 *
 *  1. ⚪  IN TEST     — Ad attiva da poco o spesa <€20: dati insufficienti per giudicare
 *  2. 🔴  DA SPEGNERE — Spesa significativa SENZA lead OR tier "poor" OR ROAS netto <-50%
 *  3. 🟢  VINCENTE    — Tier "top"/"good" + lead >0 + (ROAS netto ≥0 OR CPL sotto media)
 *  4. 🟡  DA OTTIMIZZARE — Tutto il resto (ha dati ma non eccelle)
 */

import type { QualityResult } from "./quality-rank";

export type VerdictKind = "winner" | "optimize" | "kill" | "test";

export interface VerdictInput {
  /** Spesa nel periodo selezionato. */
  spend: number;
  /** Lead generati nel periodo. */
  lead: number;
  /** CPL ad-level (calcolato spend/lead). */
  cpl: number;
  /** ROAS lordo. */
  roas: number;
  /** ROAS netto se disponibile (può essere negativo). */
  roasNetto?: number | null;
  /** Risultato quality-rank (può essere undefined se ad sotto soglia gating). */
  qualityRank?: QualityResult | undefined;
  /** Health v2 score 0-100 (può essere null se no dati). */
  healthScore?: number | null;
  /** Fatigue score 0-100 (più alto = peggio). */
  fatigueScore?: number;
  /** CPL medio del set (per giudicare "sotto media"). */
  setAvgCpl?: number;
  /** Quanti giorni di vita ha l'ad nel set (lunghezza trend). */
  trendDays?: number;
}

export interface Verdict {
  kind: VerdictKind;
  /** Etichetta breve da mostrare nel badge. */
  label: string;
  /** Emoji singolo per density alta. */
  emoji: string;
  /** 1 frase di motivo (perché questo verdetto). */
  reason: string;
  /** 1 azione suggerita imperativa. */
  action: string;
  /** Tailwind classes per il badge (bg + text + border). */
  badgeClass: string;
  /** Tailwind classes per il dot/anello sulla card gallery. */
  ringClass: string;
  /** Priorità ordinamento: kill=0, optimize=1, winner=2, test=3 (i kill in cima). */
  sortPriority: number;
}

const fmtEur = (n: number) => `€${Math.round(n).toLocaleString("it-IT")}`;
const fmtPct = (n: number) => `${Math.round(n * 100)}%`;

export function computeVerdict(p: VerdictInput): Verdict {
  const spend = p.spend ?? 0;
  const lead = p.lead ?? 0;
  const trendDays = p.trendDays ?? 0;
  const tier = p.qualityRank?.tier;
  const roasNetto = p.roasNetto ?? null;

  // ── 1. IN TEST: dati insufficienti ──
  if (spend < 20 || trendDays < 3) {
    return {
      kind: "test",
      label: "In test",
      emoji: "⚪",
      reason:
        spend < 20
          ? `Spesa solo ${fmtEur(spend)}, serve più volume`
          : `Solo ${trendDays}gg di vita`,
      action: "Lascia girare 3-5gg con almeno €30/gg",
      badgeClass: "bg-slate-100 text-slate-700 border-slate-200",
      ringClass: "ring-1 ring-slate-300",
      sortPriority: 3,
    };
  }

  // ── 2. DA SPEGNERE: scenari hard kill ──
  // 2a) Spesa significativa + 0 lead
  if (spend >= 50 && lead === 0) {
    return {
      kind: "kill",
      label: "Da spegnere",
      emoji: "🔴",
      reason: `${fmtEur(spend)} bruciati, 0 lead`,
      action: "Spegni o cambia creativa/audience subito",
      badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
      ringClass: "ring-2 ring-rose-300",
      sortPriority: 0,
    };
  }
  // 2b) Quality tier "poor" forzato
  if (tier === "poor") {
    return {
      kind: "kill",
      label: "Da spegnere",
      emoji: "🔴",
      reason: p.qualityRank?.reason || "Qualità sotto soglia critica",
      action: "Spegni e analizza cosa ha fallito",
      badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
      ringClass: "ring-2 ring-rose-300",
      sortPriority: 0,
    };
  }
  // 2c) ROAS netto catastrofico (<-50%)
  if (roasNetto != null && roasNetto < -0.5 && spend >= 50) {
    return {
      kind: "kill",
      label: "Da spegnere",
      emoji: "🔴",
      reason: `ROAS netto ${fmtPct(roasNetto)} (perdita)`,
      action: "Stop, costa più di quanto rende",
      badgeClass: "bg-rose-100 text-rose-800 border-rose-300",
      ringClass: "ring-2 ring-rose-300",
      sortPriority: 0,
    };
  }

  // ── 3. VINCENTE: tier alto + risultati concreti ──
  if ((tier === "top" || tier === "good") && lead > 0) {
    const profitableHint = roasNetto != null && roasNetto >= 0;
    const cheapHint = p.setAvgCpl && p.setAvgCpl > 0 && p.cpl > 0 && p.cpl < p.setAvgCpl * 0.85;
    if (profitableHint || cheapHint || tier === "top") {
      const reason =
        tier === "top"
          ? `Top del set · ${lead} lead · ROAS ${p.roas.toFixed(1)}×`
          : profitableHint
            ? `In utile · ${lead} lead · netto ${fmtPct(roasNetto!)}`
            : `CPL ${fmtEur(p.cpl)} sotto media set · ${lead} lead`;
      return {
        kind: "winner",
        label: "Vincente",
        emoji: "🟢",
        reason,
        action: "Scala budget +20% e duplica per A/B test",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
        ringClass: "ring-2 ring-emerald-300",
        sortPriority: 2,
      };
    }
  }

  // ── 4. DA OTTIMIZZARE: tutto il resto con dati ──
  // Costruisci motivo specifico in base a cosa zoppica
  let reason = "Performance media, margini di crescita";
  let action = "Testa nuovo hook o restringi audience";
  if ((p.fatigueScore ?? 0) >= 60) {
    reason = `Fatigue alta (${Math.round(p.fatigueScore!)}/100)`;
    action = "Refresh creativa o cambia placement";
  } else if (p.setAvgCpl && p.cpl > p.setAvgCpl * 1.3) {
    reason = `CPL ${fmtEur(p.cpl)} alto (media set ${fmtEur(p.setAvgCpl)})`;
    action = "Ottimizza targeting o testa nuovo angle";
  } else if (lead === 0 && spend < 50) {
    reason = `${fmtEur(spend)} senza lead, ancora basso volume`;
    action = "Aumenta budget o aspetta altri 2gg";
  } else if (tier === "low") {
    reason = "Sotto la media del set";
    action = "Riduci budget e testa varianti";
  } else if (p.healthScore != null && p.healthScore < 50) {
    reason = `Health score ${p.healthScore}/100`;
    action = "Rivedi creativa, copy o LP";
  }

  return {
    kind: "optimize",
    label: "Da ottimizzare",
    emoji: "🟡",
    reason,
    action,
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
    ringClass: "ring-2 ring-amber-300",
    sortPriority: 1,
  };
}

/** Calcola CPL medio del set (somma spesa / somma lead) escludendo gli zeri. */
export function computeSetAvgCpl(items: { spend: number; lead: number }[]): number {
  let s = 0,
    l = 0;
  for (const it of items) {
    s += it.spend ?? 0;
    l += it.lead ?? 0;
  }
  return l > 0 ? s / l : 0;
}

/** Etichetta lunga + colore per legenda/filtro. */
export const VERDICT_META: Record<
  VerdictKind,
  { label: string; emoji: string; color: string; description: string }
> = {
  winner: {
    label: "Vincente",
    emoji: "🟢",
    color: "emerald",
    description: "Quality top/good + lead reali + profittevole o sotto media CPL",
  },
  optimize: {
    label: "Da ottimizzare",
    emoji: "🟡",
    color: "amber",
    description: "Performance media: ha dati ma con margini di miglioramento chiari",
  },
  kill: {
    label: "Da spegnere",
    emoji: "🔴",
    color: "rose",
    description: "Spesa ≥€50 senza lead, oppure quality 'poor', oppure ROAS netto < -50%",
  },
  test: {
    label: "In test",
    emoji: "⚪",
    color: "zinc",
    description: "Spesa <€20 o meno di 3 giorni di vita: troppo presto per giudicare",
  },
};

export const VERDICT_ORDER: VerdictKind[] = ["winner", "optimize", "kill", "test"];
