/**
 * 📐 SINGLE SOURCE OF TRUTH per tutte le formule metriche di Ads Manager.
 *
 * Ogni metrica esposta in tabella, drawer, trend storici, sparkline e tooltip
 * DEVE passare da queste funzioni pure. Vietato re-calcolare inline altrove:
 * un cambio formula deve avere effetto in UN solo punto.
 *
 * Convenzioni:
 * - Tutte le funzioni sono pure (input numerici → output numerico, no side-effect).
 * - Ritornano `0` quando il denominatore è 0 (mai NaN né Infinity).
 * - Le percentuali sono espresse 0-100 (non 0-1).
 * - I metadati `FORMULA_DOCS` sono usati dai tooltip: numeratore, denominatore,
 *   benchmark Meta ufficiale e azione consigliata.
 *
 * Riferimenti:
 * - Meta Ads Help Center: https://www.facebook.com/business/help/438692010195160
 * - Hook/Hold rate definitions: video_3_sec_watched, video_thruplays, video_continuous_2_sec
 */

// ════════════════════════════════════════════════════════════════
// Helpers numerici
// ════════════════════════════════════════════════════════════════

/** Divisione safe: 0 se denominatore <= 0 o non finito. */
export const safeDiv = (num: number, den: number): number =>
  den > 0 && Number.isFinite(num) && Number.isFinite(den) ? num / den : 0;

/** Percentuale 0-100 safe. */
export const safePct = (num: number, den: number): number => safeDiv(num, den) * 100;

// ════════════════════════════════════════════════════════════════
// VIDEO METRICS — formule allineate ad Ads Manager Meta
// ════════════════════════════════════════════════════════════════

/** "Views" = chi ha visto ≥3s. Fallback su v25 per dati storici pre-v3sec. */
export const computeVideoViews = (v3sec: number, v25: number): number =>
  v3sec > 0 ? v3sec : v25;

/**
 * Hook Rate = % di video_plays che superano i 3 secondi.
 * Formula Meta: video_3_sec_watched / video_plays.
 */
export const computeHookRate = (videoViews: number, videoPlays: number): number =>
  safePct(videoViews, videoPlays);

/**
 * Thumbstop Rate = % di "engaged-views" (≥2s continui) che diventano view ≥3s.
 * Quando video_continuous_2_sec_watched non è disponibile, fallback su Hook Rate.
 */
export const computeThumbstopRate = (
  videoViews: number,
  videoContinuous2Sec: number,
  hookRateFallback: number,
): number =>
  videoContinuous2Sec > 0 ? safePct(videoViews, videoContinuous2Sec) : hookRateFallback;

/**
 * Hold Rate = % di chi vede ≥3s che arriva a ≥15s o fine video.
 * Formula Meta: video_thruplays / video_views (denominatore = views, non plays!).
 */
export const computeHoldRate = (thruplays: number, videoViews: number): number =>
  safePct(thruplays, videoViews);

/**
 * View X% = % di chi vede ≥3s che arriva al checkpoint X% del video.
 * Denominatore = video_views (NON impressions, NON plays).
 */
export const computeViewRate = (videoPxWatched: number, videoViews: number): number =>
  safePct(videoPxWatched, videoViews);

/** Bundle helper per calcolare tutti i view rates in un colpo solo. */
export interface ViewRates {
  view25Rate: number;
  view50Rate: number;
  view75Rate: number;
  view100Rate: number;
}
export const computeViewRates = (
  v25: number,
  v50: number,
  v75: number,
  v100: number,
  videoViews: number,
): ViewRates => ({
  view25Rate: computeViewRate(v25, videoViews),
  view50Rate: computeViewRate(v50, videoViews),
  view75Rate: computeViewRate(v75, videoViews),
  view100Rate: computeViewRate(v100, videoViews),
});

/** Thru Rate = % di video_plays che diventano thruplays (≥15s o fine). */
export const computeThruRate = (thruplays: number, videoPlays: number): number =>
  safePct(thruplays, videoPlays);

// ════════════════════════════════════════════════════════════════
// ENGAGEMENT METRICS
// ════════════════════════════════════════════════════════════════

/** CPM = costo per 1000 impressions. */
export const computeCpm = (spend: number, impressions: number): number =>
  safeDiv(spend, impressions) * 1000;

/** CTR = click / impressions × 100. Usa il denominatore appropriato (link/outbound/total). */
export const computeCtr = (clicks: number, impressions: number): number =>
  safePct(clicks, impressions);

/** CPC = spend / clicks. */
export const computeCpc = (spend: number, clicks: number): number => safeDiv(spend, clicks);

/** LP View Rate = % di click che effettivamente caricano la LP. */
export const computeLpViewRate = (lpv: number, clicks: number): number => safePct(lpv, clicks);

// ════════════════════════════════════════════════════════════════
// PERFORMANCE METRICS
// ════════════════════════════════════════════════════════════════

/** CPL = spend / lead. */
export const computeCpl = (spend: number, lead: number): number => safeDiv(spend, lead);

/** ROAS = fatturato / spend. */
export const computeRoas = (fatturato: number, spend: number): number => safeDiv(fatturato, spend);

/** ROAS netto = (fatturato - costi - spesa) / spesa. */
export const computeRoasNetto = (
  fatturato: number,
  costiVariabili: number,
  spend: number,
): number => safeDiv(fatturato - costiVariabili - spend, spend);

/** CAC = spend / vendite (clienti acquisiti, non lead). */
export const computeCac = (spend: number, vendite: number): number => safeDiv(spend, vendite);

// ════════════════════════════════════════════════════════════════
// METADATA per tooltip — formula leggibile + benchmark + azione
// ════════════════════════════════════════════════════════════════

export interface FormulaDoc {
  /** Etichetta breve (1-2 parole). */
  label: string;
  /** Formula matematica espressa in modo leggibile, con i nomi dei campi Meta. */
  formula: string;
  /** Cosa significa numeratore + denominatore in italiano. */
  what: string;
  /** Soglie Meta ufficiali per benchmark veloce. */
  benchmark: string;
  /** Azione consigliata se la metrica è bassa/alta. */
  action?: string;
}

export const FORMULA_DOCS: Record<string, FormulaDoc> = {
  // ── Video ──
  hookRate: {
    label: "Hook Rate",
    formula: "video_3_sec_watched ÷ video_plays × 100",
    what:
      "% di volte che il video è stato avviato e ha catturato l'attenzione per almeno 3 secondi.",
    benchmark: "🟢 >40% ottimo · 🟡 25-40% medio · 🔴 <25% scarso",
    action: "Riscrivi i primi 3 secondi: domanda forte, contrasto visivo, claim diretto.",
  },
  holdRate: {
    label: "Hold Rate (Thru)",
    formula: "video_thruplays ÷ video_views × 100",
    what:
      "% di chi ha visto almeno 3s che arriva al thruplay (≥15s o fine video). Misura la tenuta narrativa.",
    benchmark: "🟢 >50% ottimo · 🟡 30-50% medio · 🔴 <30% scarso",
    action: "Taglia i plateau a metà video, aggiungi pattern interrupt o cambio scena.",
  },
  thumbstopRate: {
    label: "Thumbstop Rate",
    formula: "video_3_sec ÷ video_continuous_2s × 100",
    what:
      "% di chi ferma il pollice per almeno 2s e poi continua oltre i 3s. Indicatore puro di hook visivo.",
    benchmark: "🟢 >60% ottimo · 🟡 40-60% medio · 🔴 <40% scarso",
    action: "Cambia thumbnail / primo frame: deve incuriosire prima del suono.",
  },
  view25Rate: {
    label: "View 25%",
    formula: "video_p25_watched ÷ video_views × 100",
    what: "% di chi ha visto almeno 3s che arriva al 25% del video.",
    benchmark: "🟢 >70% ottimo · 🟡 50-70% medio · 🔴 <50% scarso",
  },
  view50Rate: {
    label: "View 50%",
    formula: "video_p50_watched ÷ video_views × 100",
    what: "% di chi ha visto almeno 3s che arriva a metà video.",
    benchmark: "🟢 >50% ottimo · 🟡 30-50% medio · 🔴 <30% scarso",
  },
  view75Rate: {
    label: "View 75%",
    formula: "video_p75_watched ÷ video_views × 100",
    what: "% di chi ha visto almeno 3s che arriva al 75% del video.",
    benchmark: "🟢 >35% ottimo · 🟡 20-35% medio · 🔴 <20% scarso",
  },
  view100Rate: {
    label: "View 100%",
    formula: "video_p100_watched ÷ video_views × 100",
    what: "% di chi ha visto almeno 3s che completa il video.",
    benchmark: "🟢 >25% ottimo · 🟡 10-25% medio · 🔴 <10% scarso",
    action: "Accorcia il video, sposta la CTA prima del finale, costruisci attesa nei primi 5s.",
  },
  thruRate: {
    label: "Thru Rate",
    formula: "video_thruplays ÷ video_plays × 100",
    what: "Variante Hold ma con denominatore = video_plays. Più severo di Hold (Thru/Views).",
    benchmark: "🟢 >25% ottimo · 🟡 15-25% medio · 🔴 <15% scarso",
  },
  videoPlays: {
    label: "Video Plays",
    formula: "Σ video_plays",
    what: "Numero di volte che il video è stato auto-played o cliccato (≥1ms di playback).",
    benchmark: "Volume assoluto — più è alto, più dati hai per giudicare le altre %.",
  },

  // ── Engagement ──
  cpm: {
    label: "CPM",
    formula: "(spend ÷ impressions) × 1000",
    what: "Costo per mille impressions. Misura quanto è costosa l'audience che stai colpendo.",
    benchmark: "Dipende dal settore IT: 🟢 <€8 · 🟡 €8-€15 · 🔴 >€15",
    action: "CPM alto → audience troppo piccola/calda. Allarga targeting o cambia placement.",
  },
  ctr: {
    label: "CTR",
    formula: "clicks ÷ impressions × 100",
    what: "% di volte che chi vede l'ad la clicca. In modalità UTM-first usa sessioni LP reali.",
    benchmark: "🟢 >2% ottimo · 🟡 1-2% medio · 🔴 <1% scarso",
    action: "CTR basso → la creativa non aggancia. Cambia hook o primo frame.",
  },
  ctrLink: {
    label: "CTR Link",
    formula: "link_clicks ÷ impressions × 100",
    what: "% di click sul link verso la LP (esclude reazioni / commenti / share).",
    benchmark: "🟢 >1.5% ottimo · 🟡 0.7-1.5% medio · 🔴 <0.7% scarso",
  },
  ctrOutbound: {
    label: "CTR Outbound",
    formula: "outbound_clicks ÷ impressions × 100",
    what: "% di click che escono da Meta verso il tuo dominio. Esclude click su profilo/hashtag.",
    benchmark: "🟢 >1.2% ottimo · 🟡 0.5-1.2% medio · 🔴 <0.5% scarso",
  },
  cpc: {
    label: "CPC",
    formula: "spend ÷ clicks",
    what: "Costo per click. Combina qualità creativa (CTR) e costo audience (CPM).",
    benchmark: "Dipende dal settore: 🟢 <€0.50 · 🟡 €0.50-€1.50 · 🔴 >€1.50",
  },
  frequency: {
    label: "Frequency",
    formula: "impressions ÷ reach",
    what: "Quante volte la stessa persona vede l'ad nel periodo. Sopra 3-4 = saturazione.",
    benchmark: "🟢 <2.5 fresca · 🟡 2.5-3.5 ok · 🔴 >3.5 saturazione",
    action: "Frequency alta → refresh creativa o allarga audience.",
  },
  lpViewRate: {
    label: "LP View Rate",
    formula: "landing_page_views ÷ link_clicks × 100",
    what: "% di click che effettivamente carica la LP (esclude bounce di rete / chiusure rapide).",
    benchmark: "🟢 >85% ottimo · 🟡 65-85% medio · 🔴 <65% scarso (LP lenta o rotta)",
    action: "<65% = LP lenta o link rotto. Verifica TTFB e mobile speed.",
  },

  // ── Performance ──
  cpl: {
    label: "CPL",
    formula: "spend ÷ lead_CRM",
    what: "Costo per lead generato (lead = booking calendario completato sul CRM).",
    benchmark: "Dipende dal CPL target del tuo business. Sotto -20% target = ottimo.",
    action: "Ottimizza creative (hook), restringi audience ai segmenti con CVR alta.",
  },
  cpql: {
    label: "CPQL",
    formula: "spend ÷ lead_qualificati",
    what:
      "Costo per lead qualificato (portatore o urgenza alta). Più realistico del CPL puro.",
    benchmark: "Dipende dal tuo CPL target × inverso del % qualificazione.",
  },
  roas: {
    label: "ROAS",
    formula: "fatturato ÷ spend",
    what: "Ritorno lordo per ogni € speso in advertising. Non considera costi prodotto/IVA.",
    benchmark: "🟢 >3× ottimo · 🟡 1.5-3× medio · 🔴 <1.5× scarso",
  },
  roasNetto: {
    label: "ROAS netto",
    formula: "(fatturato − costi − spesa) ÷ spesa",
    what:
      "Ritorno netto reale per ogni € speso, dopo aver tolto costi prodotto, IVA e spesa stessa.",
    benchmark: "🟢 >0 in profitto · 🟡 -20% break-even · 🔴 <-20% in perdita",
    action: "ROAS netto negativo = stai bruciando. Spegni o rivedi prezzo/costi.",
  },
  cac: {
    label: "CAC",
    formula: "spend ÷ vendite",
    what: "Customer Acquisition Cost: costo per acquisire un cliente pagante (non lead).",
    benchmark: "Deve essere ≤ AOV × margine. Sotto LTV/3 = ottimo.",
  },
  netto: {
    label: "Netto",
    formula: "fatturato − costi − spesa",
    what: "Profitto netto in € dell'ad nel periodo. Cifra che ti rimane in tasca.",
    benchmark: "🟢 >0 sei in profitto · 🔴 <0 stai perdendo soldi",
  },
};

/** Helper: formatta un FormulaDoc come stringa multilinea per tooltip nativo HTML title=""). */
export function formatFormulaTooltip(key: string): string {
  const d = FORMULA_DOCS[key];
  if (!d) return "";
  const parts = [d.label, "", `📐 ${d.formula}`, "", d.what, "", d.benchmark];
  if (d.action) parts.push("", `💡 ${d.action}`);
  return parts.join("\n");
}
