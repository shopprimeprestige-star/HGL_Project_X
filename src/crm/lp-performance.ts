import { reachedStep } from "./lp-funnel-utils";

export interface LpEventRecord {
  id: string;
  created_at: string;
  event_name: string;
  session_id: string;
  step: number | null;
  payload: Record<string, unknown> | null;
  utm_source: string | null;
  device: string | null;
  is_bot: boolean;
}

export interface LpSessionSummary {
  id: string;
  when: string;
  dur: number;
  scroll: number;
  device: string;
  source: string;
  converted: boolean;
  dateClicked: boolean;
  timeClicked: boolean;
}

export interface LpFunnelStep {
  key: string;
  label: string;
  customEvent: string;
  count: number;
  pctOfTotal: number;
  dropFromPrev: number;
  dropPctFromPrev: number;
}

export interface LpDashboardStats {
  sessions: LpSessionSummary[];
  totalSessions: number;
  bounce: number;
  bounceRate: number;
  avgDuration: number;
  avgScroll: number;
  leads: number;
  cvr: number;
  dateClicks: number;
  timeClicks: number;
  scrollDepths: Record<25 | 50 | 75 | 100, number>;
  devices: Record<string, number>;
  sources: Record<string, number>;
  funnel: LpFunnelStep[];
}

function payloadNumber(payload: Record<string, unknown> | null | undefined, key: string): number {
  const value = payload?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function payloadString(payload: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = payload?.[key];
  return typeof value === "string" ? value : null;
}

function normalizeSource(source: string | null | undefined): string {
  const clean = source?.trim();
  if (!clean) return "Diretto";
  return clean.toLowerCase() === "diretto" ? "Diretto" : clean;
}

export function buildLpDashboardStats(events: LpEventRecord[]): LpDashboardStats {
  const grouped = new Map<string, LpEventRecord[]>();
  events.forEach((event) => {
    const list = grouped.get(event.session_id) || [];
    list.push(event);
    grouped.set(event.session_id, list);
  });

  const sessions: LpSessionSummary[] = Array.from(grouped.entries()).map(([id, entries]) => {
    const sorted = [...entries].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    // Durata: usa l'evento Heartbeat con elapsed più alto se disponibile,
    // altrimenti differenza tra ultimo e primo timestamp.
    const maxHeartbeat = sorted.reduce((max, entry) => {
      if (entry.event_name !== "Heartbeat") return max;
      return Math.max(max, payloadNumber(entry.payload, "elapsed"));
    }, 0);
    const tsDiff = Math.max(
      0,
      (new Date(last.created_at).getTime() - new Date(first.created_at).getTime()) / 1000,
    );
    const dur = Math.max(maxHeartbeat, tsDiff);

    const maxScroll = sorted.reduce(
      (max, entry) => Math.max(max, payloadNumber(entry.payload, "scroll")),
      0,
    );

    return {
      id,
      when: first.created_at,
      dur,
      scroll: maxScroll,
      device: first.device || "unknown",
      source: normalizeSource(first.utm_source),
      converted: sorted.some((entry) => entry.event_name === "Lead"),
      dateClicked: sorted.some(
        (entry) =>
          entry.event_name === "AddToCart" &&
          payloadString(entry.payload, "content_name") === "date_pick",
      ),
      timeClicked: sorted.some(
        (entry) =>
          entry.event_name === "AddToCart" &&
          payloadString(entry.payload, "content_name") === "time_pick",
      ),
    };
  });

  const scrollDepths: Record<25 | 50 | 75 | 100, number> = { 25: 0, 50: 0, 75: 0, 100: 0 };
  const devices: Record<string, number> = {};
  const sources: Record<string, number> = {};

  let bounce = 0;
  let totalDuration = 0;
  let totalScroll = 0;
  let leads = 0;
  let dateClicks = 0;
  let timeClicks = 0;

  sessions.forEach((session) => {
    totalDuration += session.dur;
    totalScroll += session.scroll;
    if (session.converted) leads++;
    if (session.dateClicked) dateClicks++;
    if (session.timeClicked) timeClicks++;
    // Bounce: sessione di rimbalzo = poco tempo (<15s) E poco scroll (<25%) E nessuna interazione/conversione
    const bounced =
      session.dur < 15 &&
      session.scroll < 25 &&
      !session.dateClicked &&
      !session.timeClicked &&
      !session.converted;
    if (bounced) bounce++;

    devices[session.device] = (devices[session.device] || 0) + 1;
    sources[session.source] = (sources[session.source] || 0) + 1;

    if (session.scroll >= 25) scrollDepths[25]++;
    if (session.scroll >= 50) scrollDepths[50]++;
    if (session.scroll >= 75) scrollDepths[75]++;
    if (session.scroll >= 100) scrollDepths[100]++;
  });

  const totalSessions = sessions.length;

  // Funnel step-by-step (tracking via FunnelStep + StepView events emessi dal client)
  // Conta sessioni uniche che hanno raggiunto ciascuno step. Usa helper condiviso.
  const sessionsAtStep = (stepNum: number): number => {
    let n = 0;
    grouped.forEach((entries) => {
      if (reachedStep(entries, stepNum)) n++;
    });
    return n;
  };

  // Step 1 = visita pagina (calendar visibile) — fallback al totale sessioni se manca tracking
  // Mapping FunnelStep emesso dal client (step = next+1):
  //  1 = calendar, 2 = portatore, 3 = disagio, 4 = urgenza, 5 = contact, 6 = thankyou (lead inviato)
  const step1 = Math.max(sessionsAtStep(1), totalSessions);
  const step2 = sessionsAtStep(2); // portatore
  const step3 = sessionsAtStep(3); // disagio
  const step4 = sessionsAtStep(4); // urgenza
  const step5 = sessionsAtStep(5); // contact form visualizzato
  const step6 = leads; // lead inviato

  const buildStep = (key: string, label: string, customEvent: string, count: number, prev: number): LpFunnelStep => ({
    key,
    label,
    customEvent,
    count,
    pctOfTotal: totalSessions ? (count / totalSessions) * 100 : 0,
    dropFromPrev: Math.max(0, prev - count),
    dropPctFromPrev: prev ? ((prev - count) / prev) * 100 : 0,
  });
  const funnel: LpFunnelStep[] = [
    buildStep("step1", "Step 1 · Vede calendario", "Vista_Calendario", step1, step1),
    buildStep("step2", "Step 2 · Sceglie data e orario", "Selezionato_Orario_Consulenza", step2, step1),
    buildStep("step3", "Step 3 · Risponde 'Sei già portatore?'", "Risposta_Portatore_Impianto", step3, step2),
    buildStep("step4", "Step 4 · Risponde 'quanto pesa'", "Risposta_Livello_Disagio", step4, step3),
    buildStep("step5", "Step 5 · Sceglie urgenza", "Risposta_Urgenza", step5, step4),
    buildStep("step6", "Step 6 · Invia lead", "Lead_Prenotazione_Inviato", step6, step5),
  ];

  return {
    sessions,
    totalSessions,
    bounce,
    bounceRate: totalSessions ? (bounce / totalSessions) * 100 : 0,
    avgDuration: totalSessions ? totalDuration / totalSessions : 0,
    avgScroll: totalSessions ? totalScroll / totalSessions : 0,
    leads,
    cvr: totalSessions ? (leads / totalSessions) * 100 : 0,
    dateClicks,
    timeClicks,
    scrollDepths,
    devices,
    sources,
    funnel,
  };
}