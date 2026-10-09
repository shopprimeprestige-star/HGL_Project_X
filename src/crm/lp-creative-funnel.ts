import type { LpEventRecord, LpFunnelStep } from "./lp-performance";
import { reachedStep, isLead } from "./lp-funnel-utils";

export interface CreativeFunnelRow {
  key: string; // ad_id || ad_name || creative_name || "(unknown)"
  adId: string | null;
  adName: string | null;
  creativeName: string | null;
  campaignName: string | null;
  totalSessions: number;
  funnel: LpFunnelStep[];
  bounceRate: number;
  cvr: number;
}

const STEP_LABELS: Array<{ key: string; label: string; customEvent: string; step: number }> = [
  { key: "step1", label: "Step 1 · Vede calendario", customEvent: "Vista_Calendario", step: 1 },
  { key: "step2", label: "Step 2 · Sceglie data e orario", customEvent: "Selezionato_Orario_Consulenza", step: 2 },
  { key: "step3", label: "Step 3 · Risponde 'Sei già portatore?'", customEvent: "Risposta_Portatore_Impianto", step: 3 },
  { key: "step4", label: "Step 4 · Risponde 'quanto pesa'", customEvent: "Risposta_Livello_Disagio", step: 4 },
  { key: "step5", label: "Step 5 · Sceglie urgenza", customEvent: "Risposta_Urgenza", step: 5 },
  { key: "step6", label: "Step 6 · Invia lead", customEvent: "Lead_Prenotazione_Inviato", step: 6 },
];

interface AugmentedEvent extends LpEventRecord {
  ad_id?: string | null;
  adset_id?: string | null;
  campaign_id?: string | null;
  ad_name?: string | null;
  creative_name?: string | null;
}

export function buildCreativeFunnels(events: AugmentedEvent[]): CreativeFunnelRow[] {
  // Group sessions by creative key. Una sessione appartiene alla creativa
  // determinata dal primo evento che ha ad_id/ad_name/creative_name.
  const sessions = new Map<string, AugmentedEvent[]>();
  events.forEach((e) => {
    const list = sessions.get(e.session_id) || [];
    list.push(e);
    sessions.set(e.session_id, list);
  });

  const grouped = new Map<
    string,
    { events: AugmentedEvent[][]; sample: AugmentedEvent }
  >();

  sessions.forEach((sessionEvents) => {
    const sorted = [...sessionEvents].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const first = sorted.find((e) => e.ad_id || e.ad_name || e.creative_name) || sorted[0];
    const key =
      first?.ad_id || first?.ad_name || first?.creative_name || "(senza creativa)";
    const slot = grouped.get(key) || { events: [], sample: first };
    slot.events.push(sorted);
    grouped.set(key, slot);
  });

  const rows: CreativeFunnelRow[] = [];
  grouped.forEach((slot, key) => {
    const totalSessions = slot.events.length;
    const stepCounts = STEP_LABELS.map(({ step }) =>
      slot.events.filter((s) => (step === 6 ? isLead(s) : reachedStep(s, step))).length,
    );
    // step1 fallback: se nessuno step tracciato, usa totale sessioni
    if (stepCounts[0] === 0) stepCounts[0] = totalSessions;

    const funnel: LpFunnelStep[] = STEP_LABELS.map((meta, i) => {
      const count = stepCounts[i];
      const prev = i === 0 ? stepCounts[0] : stepCounts[i - 1];
      return {
        key: meta.key,
        label: meta.label,
        customEvent: meta.customEvent,
        count,
        pctOfTotal: totalSessions ? (count / totalSessions) * 100 : 0,
        dropFromPrev: Math.max(0, prev - count),
        dropPctFromPrev: prev ? ((prev - count) / prev) * 100 : 0,
      };
    });

    const leads = stepCounts[5];
    const bounced = slot.events.filter((s) => {
      // bounce sessione: nessuno step >= 2 e nessun lead
      return !reachedStep(s, 2) && !isLead(s);
    }).length;

    rows.push({
      key,
      adId: slot.sample?.ad_id ?? null,
      adName: slot.sample?.ad_name ?? null,
      creativeName: slot.sample?.creative_name ?? null,
      campaignName: null,
      totalSessions,
      funnel,
      bounceRate: totalSessions ? (bounced / totalSessions) * 100 : 0,
      cvr: totalSessions ? (leads / totalSessions) * 100 : 0,
    });
  });

  rows.sort((a, b) => b.totalSessions - a.totalSessions);
  return rows;
}
