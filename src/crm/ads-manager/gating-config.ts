/** Gating config persistente in localStorage — soglie di classificazione v3.
 *
 *  Filosofia: impressions e spesa NON sono qualità.
 *  - `MIN_IMPRESSIONS` è solo la soglia di INGRESSO alla classificazione
 *    (sotto = "Dati insufficienti", niente fascia).
 *  - `ZERO_LEAD_KILL_SPEND` è la soglia di costo reale oltre cui 0 lead =
 *    bocciatura definitiva ("hai speso veri soldi senza un lead").
 *
 *  Nota: usiamo localStorage perché sono soglie utente, non condivise tra
 *  device/team. Nessuna migration DB richiesta. */

export interface GatingConfig {
  /** Impressions minime per essere classificata (entry threshold). Default 1300. */
  minImpressions: number;
  /** Spesa oltre cui 0 lead diventa bocciatura definitiva ("poor"). Default €50. */
  zeroLeadKillSpend: number;
  /** Bounce rate sopra cui creative con 0 lead viene capped a "poor". Default 80%. */
  highBounceKill: number;
  /** Hook rate sotto cui creative video con 0 lead viene capped a "low". Default 15%. */
  lowHookKill: number;
}

export const DEFAULT_GATING: GatingConfig = {
  minImpressions: 1300,
  zeroLeadKillSpend: 50,
  highBounceKill: 80,
  lowHookKill: 15,
};

const STORAGE_KEY = "crm.ads.gating-config.v1";

export function loadGatingConfig(): GatingConfig {
  if (typeof window === "undefined") return DEFAULT_GATING;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_GATING;
    const parsed = JSON.parse(raw) as Partial<GatingConfig>;
    return {
      minImpressions: Number(parsed.minImpressions ?? DEFAULT_GATING.minImpressions),
      zeroLeadKillSpend: Number(parsed.zeroLeadKillSpend ?? DEFAULT_GATING.zeroLeadKillSpend),
      highBounceKill: Number(parsed.highBounceKill ?? DEFAULT_GATING.highBounceKill),
      lowHookKill: Number(parsed.lowHookKill ?? DEFAULT_GATING.lowHookKill),
    };
  } catch {
    return DEFAULT_GATING;
  }
}

export function saveGatingConfig(c: GatingConfig): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {
    /* quota / private mode: ignore */
  }
}
