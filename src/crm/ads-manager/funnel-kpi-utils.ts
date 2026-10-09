// Helper per la scheda "Funnel KPI Ads": incrocia risposte funnel × creative.
//
// Per ogni domanda del funnel (urgenza, portatore, pain score, pain points)
// raggruppa i lead per (creative_key, answer_value) e calcola CVR/CPL/ROAS
// di segmento + uno score 1-10 normalizzato sulla distribuzione del set.

export type QuestionKey = "urgenza" | "portatore" | "pain_score" | "pain_points";

export interface FunnelLeadLite {
  id: string;
  ad_id: string | null;
  ad_name: string | null;
  creative_name: string | null;
  campaign_id: string | null;
  urgenza: string | null;
  portatore: boolean | null;
  disagio_score: number | null;
  pain_points: string[];
}

export interface CreativeRef {
  ad_id: string;
  ad_name: string;
  spend: number;
  lpSessions: number; // sessioni LP (fallback su clicks se assente)
  lead: number; // lead totali della creative nel periodo
  // Per ROAS stimato globale
  aov?: number;
  showRate?: number;
  closeRate?: number;
}

export interface SegmentRow {
  creativeKey: string;
  adId: string | null;
  adName: string;
  leadCount: number;
  cvr: number; // % lead segmento / sessioni LP creative
  cpl: number; // spesa creative / lead segmento (proxy di costo per quel tipo di lead)
  roas: number; // stimato
  score: number; // 1-10
}

export interface AnswerBlock {
  answer: string;
  answerLabel: string;
  totalLeads: number;
  rows: SegmentRow[];
}

export const URGENZA_LABELS: Record<string, string> = {
  subito: "Parto subito",
  "1mese": "Entro 1 mese",
  convince: "Se mi convince → subito",
  "2_3mesi": "Tra 2-3 mesi",
  valuto: "Sto valutando",
};

export function painBucket(score: number | null): "alto" | "medio" | "basso" | "ignoto" {
  if (score == null) return "ignoto";
  if (score >= 7) return "alto";
  if (score >= 4) return "medio";
  return "basso";
}

export const PAIN_BUCKET_LABELS: Record<string, string> = {
  alto: "Dolore alto (7-10)",
  medio: "Dolore medio (4-6)",
  basso: "Dolore basso (0-3)",
  ignoto: "Non dichiarato",
};

export const PORTATORE_LABELS: Record<string, string> = {
  true: "Già portatore",
  false: "Non portatore",
  null: "Non dichiarato",
};

/** Chiave coerente con buildCreativeFunnels: ad_id || ad_name || creative_name. */
export function creativeKey(l: { ad_id: string | null; ad_name: string | null; creative_name: string | null }): string {
  return l.ad_id || l.ad_name || l.creative_name || "(senza creativa)";
}

/** Estrae le risposte di un lead per la domanda data. Per pain_points ritorna array. */
function extractAnswers(l: FunnelLeadLite, q: QuestionKey): string[] {
  switch (q) {
    case "urgenza":
      return l.urgenza ? [l.urgenza] : ["__missing__"];
    case "portatore":
      return [l.portatore == null ? "null" : String(l.portatore)];
    case "pain_score":
      return [painBucket(l.disagio_score)];
    case "pain_points":
      return l.pain_points && l.pain_points.length > 0 ? l.pain_points : ["__missing__"];
  }
}

function answerLabelFor(q: QuestionKey, ans: string, topPainPoints?: Set<string>): string {
  if (ans === "__missing__") return "Non risposto";
  switch (q) {
    case "urgenza":
      return URGENZA_LABELS[ans] || ans;
    case "portatore":
      return PORTATORE_LABELS[ans] || ans;
    case "pain_score":
      return PAIN_BUCKET_LABELS[ans] || ans;
    case "pain_points":
      if (topPainPoints && !topPainPoints.has(ans)) return "Altri pain points";
      return ans;
  }
}

/** Mediana di un array numerico (0 se vuoto). */
function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Normalizza un valore 0-1 dove 1 = miglior performer. higherIsBetter inverte la logica per CPL. */
function normalize(value: number, ref: number, higherIsBetter: boolean): number {
  if (ref <= 0) return 0.5;
  const ratio = value / ref;
  if (higherIsBetter) {
    // 1× ref = 0.5, 2× ref = 1, 0× = 0
    return Math.max(0, Math.min(1, ratio / 2));
  } else {
    // CPL: meno = meglio. 1× = 0.5, 0.5× = 1, 2× = 0
    return Math.max(0, Math.min(1, 1 - (ratio - 0.5)));
  }
}

/** Calcola lo score 1-10 dato cvr/cpl/roas di un segmento e i ref del set. */
function computeScore(
  cvr: number,
  cpl: number,
  roas: number,
  refCvr: number,
  refCpl: number,
  refRoas: number,
): number {
  const cvrN = normalize(cvr, refCvr, true);
  const cplN = normalize(cpl, refCpl, false);
  const roasN = normalize(roas, refRoas, true);
  const composite = 0.5 * cvrN + 0.3 * cplN + 0.2 * roasN;
  return Math.max(1, Math.min(10, Math.round(composite * 10)));
}

export interface BuildArgs {
  leads: FunnelLeadLite[];
  creatives: Map<string, CreativeRef>; // key = creativeKey
  question: QuestionKey;
  minLeads: number;
  aov: number;
  showRate: number;
  closeRate: number;
}

export function buildFunnelKpiBlocks(args: BuildArgs): AnswerBlock[] {
  const { leads, creatives, question, minLeads, aov, showRate, closeRate } = args;

  // Per pain_points: trova top 5 risposte più frequenti
  let topPainPoints: Set<string> | undefined;
  if (question === "pain_points") {
    const counts = new Map<string, number>();
    for (const l of leads) {
      for (const pp of l.pain_points || []) {
        counts.set(pp, (counts.get(pp) || 0) + 1);
      }
    }
    topPainPoints = new Set(
      [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k),
    );
  }

  // Raggruppa lead per (answer, creativeKey)
  const buckets = new Map<string, Map<string, number>>(); // answer → (creativeKey → count)
  for (const l of leads) {
    const ck = creativeKey(l);
    const answers = extractAnswers(l, question);
    for (const rawAns of answers) {
      const ans = question === "pain_points" && topPainPoints && !topPainPoints.has(rawAns) && rawAns !== "__missing__"
        ? "__other__"
        : rawAns;
      let m = buckets.get(ans);
      if (!m) { m = new Map(); buckets.set(ans, m); }
      m.set(ck, (m.get(ck) || 0) + 1);
    }
  }

  // Calcola tutti i segmenti raw per derivare i reference (mediane)
  interface Raw { ans: string; ck: string; leadCount: number; cvr: number; cpl: number; roas: number }
  const raws: Raw[] = [];
  buckets.forEach((m, ans) => {
    m.forEach((leadCount, ck) => {
      const c = creatives.get(ck);
      if (!c) return;
      const cvr = c.lpSessions > 0 ? leadCount / c.lpSessions : 0;
      // CPL segmento: spesa creative attribuita proporzionalmente al peso del segmento
      const segSpend = c.lead > 0 ? (c.spend * leadCount) / c.lead : c.spend;
      const cpl = leadCount > 0 ? segSpend / leadCount : 0;
      const estRevenue = leadCount * aov * showRate * closeRate;
      const roas = segSpend > 0 ? estRevenue / segSpend : 0;
      raws.push({ ans, ck, leadCount, cvr, cpl, roas });
    });
  });

  const eligible = raws.filter((r) => r.leadCount >= minLeads);
  const refCvr = median(eligible.map((r) => r.cvr).filter((v) => v > 0));
  const refCpl = median(eligible.map((r) => r.cpl).filter((v) => v > 0));
  const refRoas = median(eligible.map((r) => r.roas).filter((v) => v > 0));

  // Costruisci blocchi finali
  const blocksMap = new Map<string, AnswerBlock>();
  for (const r of raws) {
    const c = creatives.get(r.ck)!;
    const score = r.leadCount >= minLeads
      ? computeScore(r.cvr, r.cpl, r.roas, refCvr || 0.01, refCpl || 1, refRoas || 0.01)
      : 0;
    let block = blocksMap.get(r.ans);
    if (!block) {
      block = {
        answer: r.ans,
        answerLabel: r.ans === "__other__" ? "Altri pain points" : answerLabelFor(question, r.ans, topPainPoints),
        totalLeads: 0,
        rows: [],
      };
      blocksMap.set(r.ans, block);
    }
    block.totalLeads += r.leadCount;
    block.rows.push({
      creativeKey: r.ck,
      adId: c.ad_id || null,
      adName: c.ad_name,
      leadCount: r.leadCount,
      cvr: r.cvr,
      cpl: r.cpl,
      roas: r.roas,
      score,
    });
  }

  // Ordina blocchi per totale lead desc, righe interne per score desc (con score 0 in fondo)
  const blocks = [...blocksMap.values()];
  blocks.sort((a, b) => b.totalLeads - a.totalLeads);
  for (const b of blocks) {
    b.rows.sort((a, b) => {
      if (a.score === 0 && b.score !== 0) return 1;
      if (b.score === 0 && a.score !== 0) return -1;
      return b.score - a.score || b.leadCount - a.leadCount;
    });
  }
  return blocks;
}
