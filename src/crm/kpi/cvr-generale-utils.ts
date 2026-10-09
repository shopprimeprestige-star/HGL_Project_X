// Helper aggregazione per la scheda "CVR Generale" (KPI dashboard).
// Lavora su public_leads + lp_events + meta_ad_spend già caricati.
//
// Calcoli chiave:
// - CVR % = lead convertiti / lead totali del segmento
// - CPL = spesa totale del periodo / lead del segmento (semplice, come scelto dall'utente)
// - Bounce rate per fascia oraria = sessioni LP della fascia che NON hanno emesso "Lead"

//  L'elenco degli stati vinti sta in un posto solo, in crm/types.ts: qui si
//  legge, non si riscrive (vedi CONVERTED_STATUSES più sotto).
import { STATI_VINTI } from "@/crm/types";

export type Period = 7 | 14 | 30 | 90;
export type Channel = "all" | "meta" | "tiktok" | "organic";

export interface PublicLeadLite {
  id: string;
  created_at: string;
  status: string;
  email: string | null;
  telefono: string | null;
  portatore: boolean | null;
  disagio_score: number | null;
  urgenza: string | null;
  utm_source: string | null;
  fbclid: string | null;
  ttclid: string | null;
}

export interface LpEventLite {
  session_id: string;
  event_name: string;
  created_at: string;
}

/** Auto-detect canale da utm_source / fbclid / ttclid (priorità: fbclid > ttclid > utm_source > organic). */
export function detectChannel(
  l: Pick<PublicLeadLite, "utm_source" | "fbclid" | "ttclid">,
): Exclude<Channel, "all"> {
  if (l.fbclid) return "meta";
  if (l.ttclid) return "tiktok";
  const s = (l.utm_source || "").toLowerCase().trim();
  if (s.includes("facebook") || s.includes("instagram") || s === "fb" || s === "ig" || s === "meta")
    return "meta";
  if (s.includes("tiktok") || s === "tt") return "tiktok";
  return "organic";
}

export function filterByChannel<T extends Pick<PublicLeadLite, "utm_source" | "fbclid" | "ttclid">>(
  rows: T[],
  channel: Channel,
): T[] {
  if (channel === "all") return rows;
  return rows.filter((r) => detectChannel(r) === channel);
}

export interface SegmentRow {
  key: string;
  label: string;
  leads: number;
  converted: number;
  cvrPct: number;
  cpl: number;
}

export const URGENZA_ORDER: Array<{ key: string; label: string }> = [
  { key: "subito", label: "Subito, voglio risolvere" },
  { key: "1mese", label: "Entro 1 mese" },
  { key: "convince", label: "Se mi convince → subito" },
  { key: "2_3mesi", label: "Tra 2-3 mesi" },
  { key: "valuto", label: "Sto valutando" },
  { key: "valutando", label: "Sto valutando (legacy)" },
  { key: "si", label: "Sì (legacy)" },
];

//  ⚠️ L'elenco era scritto a mano e conosceva solo il vecchio "venduto": ogni
//  vendita chiusa con una delle tre `posa_*` — cioè ogni vendita di oggi —
//  risultava NON convertita, e il tasso di conversione delle campagne
//  scendeva da solo mese dopo mese senza che fosse cambiato niente nel
//  marketing. Si legge da `STATI_VINTI` di crm/types.ts, che è l'elenco unico.
//  "concluso" e "in_attesa_acconto" restano aggiunti qui e restano una scelta
//  di questo file soltanto: types.ts li tiene fuori dai vinti (una pratica
//  archiviata non è detto sia stata vinta, e un acconto atteso non è incassato),
//  ma qui si misura la conversione di un lead pubblico, dove «ha detto sì»
//  basta.
const CONVERTED_STATUSES = new Set<string>([...STATI_VINTI, "concluso", "in_attesa_acconto"]);

export interface CrmConvertedLite {
  email: string | null;
  telefono: string | null;
  converted: boolean;
}

/** Un public_lead è "convertito" se status convertito OR cross-match con crm_leads convertito. */
export function isPublicLeadConverted(l: PublicLeadLite, crmIndex: Map<string, true>): boolean {
  if (CONVERTED_STATUSES.has(l.status)) return true;
  // Cross-match per email/telefono
  if (l.email && crmIndex.has(`e:${l.email.trim().toLowerCase()}`)) return true;
  if (l.telefono && crmIndex.has(`t:${normalizePhone(l.telefono)}`)) return true;
  return false;
}

export function buildCrmConvertedIndex(items: CrmConvertedLite[]): Map<string, true> {
  const m = new Map<string, true>();
  for (const it of items) {
    if (!it.converted) continue;
    if (it.email) m.set(`e:${it.email.trim().toLowerCase()}`, true);
    if (it.telefono) m.set(`t:${normalizePhone(it.telefono)}`, true);
  }
  return m;
}

function normalizePhone(p: string): string {
  return p.replace(/[\s+\-().]/g, "");
}

export function painBucket(score: number | null): "alto" | "medio" | "basso" | "ignoto" {
  if (score == null) return "ignoto";
  if (score >= 7) return "alto";
  if (score >= 4) return "medio";
  return "basso";
}

export const PAIN_LABELS: Record<string, string> = {
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

export const HOUR_BUCKETS: Array<{ key: string; label: string; from: number; to: number }> = [
  { key: "00-05", label: "00:00-05:59", from: 0, to: 6 },
  { key: "06-08", label: "06:00-08:59", from: 6, to: 9 },
  { key: "09-11", label: "09:00-11:59", from: 9, to: 12 },
  { key: "12-14", label: "12:00-14:59", from: 12, to: 15 },
  { key: "15-17", label: "15:00-17:59", from: 15, to: 18 },
  { key: "18-20", label: "18:00-20:59", from: 18, to: 21 },
  { key: "21-23", label: "21:00-23:59", from: 21, to: 24 },
];

function hourBucketKey(h: number): string {
  for (const b of HOUR_BUCKETS) if (h >= b.from && h < b.to) return b.key;
  return "21-23";
}

interface AggArgs {
  leads: PublicLeadLite[];
  crmIndex: Map<string, true>;
  totalSpend: number;
}

function buildRow(
  key: string,
  label: string,
  segLeads: PublicLeadLite[],
  crmIndex: Map<string, true>,
  totalSpend: number,
  totalLeads: number,
): SegmentRow {
  const converted = segLeads.filter((l) => isPublicLeadConverted(l, crmIndex)).length;
  const leads = segLeads.length;
  return {
    key,
    label,
    leads,
    converted,
    cvrPct: leads > 0 ? (converted / leads) * 100 : 0,
    // CPL = spesa totale / lead segmento (come scelto dall'utente)
    cpl: leads > 0 ? totalSpend / leads : 0,
    // totalLeads serve solo per share, ma non lo esponiamo qui
    ...({} as { _totalLeads?: number }),
  } as SegmentRow & { _totalLeads?: number };

  void totalLeads;
}

export function aggregatePortatore({ leads, crmIndex, totalSpend }: AggArgs): SegmentRow[] {
  const buckets: Array<[string, string, (l: PublicLeadLite) => boolean]> = [
    ["true", PORTATORE_LABELS.true, (l) => l.portatore === true],
    ["false", PORTATORE_LABELS.false, (l) => l.portatore === false],
    ["null", PORTATORE_LABELS.null, (l) => l.portatore == null],
  ];
  return buckets.map(([k, lab, pred]) =>
    buildRow(k, lab, leads.filter(pred), crmIndex, totalSpend, leads.length),
  );
}

export function aggregatePain({ leads, crmIndex, totalSpend }: AggArgs): SegmentRow[] {
  const order = ["alto", "medio", "basso", "ignoto"] as const;
  return order.map((k) =>
    buildRow(
      k,
      PAIN_LABELS[k],
      leads.filter((l) => painBucket(l.disagio_score) === k),
      crmIndex,
      totalSpend,
      leads.length,
    ),
  );
}

export function aggregateUrgenza({ leads, crmIndex, totalSpend }: AggArgs): SegmentRow[] {
  // Solo le risposte effettivamente presenti
  const presentKeys = new Set(leads.map((l) => l.urgenza).filter((x): x is string => !!x));
  const rows: SegmentRow[] = [];
  for (const o of URGENZA_ORDER) {
    if (!presentKeys.has(o.key)) continue;
    rows.push(
      buildRow(
        o.key,
        o.label,
        leads.filter((l) => l.urgenza === o.key),
        crmIndex,
        totalSpend,
        leads.length,
      ),
    );
  }
  // "Non risposto"
  const missing = leads.filter((l) => !l.urgenza);
  if (missing.length > 0) {
    rows.push(buildRow("__missing__", "Non risposto", missing, crmIndex, totalSpend, leads.length));
  }
  return rows;
}

export interface HourlyRow extends SegmentRow {
  bouncePct: number;
}

export function aggregateHourly(
  leads: PublicLeadLite[],
  events: LpEventLite[],
  crmIndex: Map<string, true>,
  totalSpend: number,
): HourlyRow[] {
  // Sessioni LP per fascia oraria + flag "ha emesso Lead"
  const sessionFirstHour = new Map<string, number>(); // session_id → ora prima visita
  const sessionHasLead = new Map<string, boolean>();
  for (const ev of events) {
    const d = new Date(ev.created_at);
    if (Number.isNaN(d.getTime())) continue;
    const h = d.getHours();
    if (!sessionFirstHour.has(ev.session_id)) sessionFirstHour.set(ev.session_id, h);
    if (ev.event_name === "Lead") sessionHasLead.set(ev.session_id, true);
  }
  const sessByBucket = new Map<string, { total: number; withLead: number }>();
  for (const [sid, h] of sessionFirstHour.entries()) {
    const k = hourBucketKey(h);
    const cur = sessByBucket.get(k) || { total: 0, withLead: 0 };
    cur.total++;
    if (sessionHasLead.get(sid)) cur.withLead++;
    sessByBucket.set(k, cur);
  }

  return HOUR_BUCKETS.map((b) => {
    const segLeads = leads.filter((l) => {
      const d = new Date(l.created_at);
      if (Number.isNaN(d.getTime())) return false;
      const h = d.getHours();
      return h >= b.from && h < b.to;
    });
    const base = buildRow(b.key, b.label, segLeads, crmIndex, totalSpend, leads.length);
    const sess = sessByBucket.get(b.key) || { total: 0, withLead: 0 };
    const noLead = sess.total - sess.withLead;
    const bouncePct = sess.total > 0 ? (noLead / sess.total) * 100 : 0;
    return { ...base, bouncePct };
  });
}

export function periodSinceUntil(period: Period): { since: Date; until: Date } {
  const until = new Date();
  until.setHours(23, 59, 59, 999);
  const since = new Date(until);
  since.setDate(since.getDate() - period + 1);
  since.setHours(0, 0, 0, 0);
  return { since, until };
}
