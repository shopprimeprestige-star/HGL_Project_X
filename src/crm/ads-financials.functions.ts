// Server functions per le metriche finanziarie e la deep analysis creativa.
// Incrocia meta_ad_spend (live da Marketing API) con crm_leads (vendite reali).
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
//  L'elenco degli stati che vogliono dire «ha comprato» sta in un posto solo
//  (crm/types.ts): qui si importa, non si riscrive. Le due copie scritte a mano
//  che c'erano in questo file conoscevano solo il vecchio "venduto".
import { eChiusuraVinta } from "@/crm/types";
import {
  computeCpm,
  computeHookRate,
  computeHoldRate,
  computeThumbstopRate,
  computeThruRate,
  computeVideoViews,
  computeViewRate,
  computeViewRates,
} from "./ads-manager/metrics-formulas";

function makeAuthedClient(accessToken: string) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

async function authenticate(accessToken: string) {
  if (!accessToken) throw new Error("Sessione non valida.");
  const supabase = makeAuthedClient(accessToken);
  const { data, error } = await supabase.auth.getClaims(accessToken);
  if (error || !data?.claims?.sub) throw new Error("Sessione scaduta.");
  return { supabase, userId: data.claims.sub as string };
}

interface LeadDataShape {
  stato?: string;
  fonte?: string;
  piattaformaAds?: string;
  disagioScore?: number;
  payment?: {
    prezzoFinaleVendita?: number;
    prezzoTotale?: number;
    accontoPagato?: number;
    accontoData?: string;
    saldoData?: string;
    costi?: { costoTaglio?: number; costoInstallatore?: number; costoProdotto?: number };
  };
  tracking?: {
    ad_id?: string; adset_id?: string; campaign_id?: string;
    ad_name?: string; campaign_name?: string;
    utm_source?: string; source?: string;
    fbp?: string; fbc?: string; ttclid?: string;
  };
  dataMeeting?: string;
  createdAt?: string;
}

function leadRevenue(d: LeadDataShape): number {
  const p = d.payment;
  if (!p) return 0;
  if (p.prezzoFinaleVendita) return p.prezzoFinaleVendita;
  if (p.prezzoTotale) return p.prezzoTotale;
  if ((p.accontoPagato || 0) > 0) return p.costi?.costoProdotto || p.accontoPagato || 0;
  return 0;
}
function leadCosts(d: LeadDataShape): number {
  const c = d.payment?.costi;
  if (!c) return 0;
  return (c.costoTaglio || 0) + (c.costoInstallatore || 0) + (c.costoProdotto || 0);
}
function leadIsConverted(d: LeadDataShape): boolean {
  //  ⚠️ QUESTO NUMERO DECIDE QUANTO SI SPENDE IN PUBBLICITÀ. Qui si incrocia la
  //   spesa Meta/TikTok con le vendite vere: se una vendita non è riconosciuta,
  //   la campagna che l'ha portata risulta senza incassi e il ROAS dice di
  //   spegnerla. L'elenco era scritto a mano e si fermava al vecchio "venduto",
  //   quindi da quando le vendite si chiudono con le tre pose nessuna vendita
  //   nuova entrava più qui — tranne quelle con un acconto, salvate per caso
  //   dalla riga sotto. `eChiusuraVinta` è l'elenco unico di types.ts.
  if (d.stato && (eChiusuraVinta(d.stato) || d.stato === "concluso")) return true;
  return (d.payment?.accontoPagato || 0) > 0;
}
//  Stessa storia sul DENOMINATORE: «si è presentato» comprende chi ha comprato,
//  e chi compra oggi porta una delle tre pose. Senza, il tasso di chiusura per
//  annuncio saliva da solo — meno presentati, stesse vendite — proprio sugli
//  annunci che vendono di più, cioè quelli su cui si decide di spendere.
const ALTRI_PRESENTATI = ["in_attesa_acconto", "viene_in_sede", "concluso"];
const ePresentato = (s?: string): boolean =>
  !!s && (eChiusuraVinta(s) || ALTRI_PRESENTATI.includes(s));
function leadPlatform(d: LeadDataShape): "meta" | "tiktok" | null {
  if (d.piattaformaAds === "meta" || d.piattaformaAds === "tiktok") return d.piattaformaAds;
  if (d.piattaformaAds === "none") return null;
  const t = d.tracking;
  if (t?.source === "tiktok" || t?.ttclid) return "tiktok";
  const src = (t?.utm_source || "").toLowerCase();
  if (src.includes("tiktok")) return "tiktok";
  if (t?.source === "meta" || t?.fbp || t?.fbc) return "meta";
  if (src.includes("meta") || src.includes("facebook") || src.includes("instagram")) return "meta";
  if (d.fonte === "ADV") return "meta";
  return null;
}
function leadDate(raw: string | undefined, createdAt: string): Date | null {
  const v = raw || createdAt;
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// Cutoff utente: nessuna spesa/ad precedente a questa data viene considerata.
// Definita in tracking_config.ads_history_start (DATE, opzionale).
async function getAdsHistoryStart(
  supabase: ReturnType<typeof makeAuthedClient>,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("tracking_config")
    .select("ads_history_start")
    .eq("user_id", userId)
    .maybeSingle();
  const v = (data as { ads_history_start?: string | null } | null)?.ads_history_start;
  return v ? String(v).slice(0, 10) : null;
}

// Clamp: se il cutoff esiste ed è > sinceDate, ritorna il cutoff.
function clampSince(sinceDate: string, cutoff: string | null): string {
  if (!cutoff) return sinceDate;
  return cutoff > sinceDate ? cutoff : sinceDate;
}

// ─────────────────────────────────────────────────────────
// 1) FINANCIALS — MER, Break-even, CAC, proiezione
// ─────────────────────────────────────────────────────────
export const getAdsFinancials = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; sinceISO: string; untilISO: string }) => d)
  .handler(async ({ data }) => {
    const { supabase, userId } = await authenticate(data.accessToken);
    const since = new Date(data.sinceISO);
    const until = new Date(data.untilISO);

    // Spesa Meta dal DB live (sync ogni 15 min) — applica cutoff utente
    const cutoff = await getAdsHistoryStart(supabase, userId);
    const sinceDate = clampSince(data.sinceISO.slice(0, 10), cutoff);
    const untilDate = data.untilISO.slice(0, 10);
    const { data: spendRows } = await supabase
      .from("meta_ad_spend")
      .select("spend, spend_date, fetched_at")
      .eq("user_id", userId)
      .gte("spend_date", sinceDate)
      .lte("spend_date", untilDate);
    const spesaMeta = (spendRows ?? []).reduce((s, r) => s + Number(r.spend || 0), 0);
    const lastFetched = (spendRows ?? [])
      .map((r) => r.fetched_at)
      .sort()
      .reverse()[0] || null;

    // Spesa oggi (per proiezione)
    const todayISO = new Date().toISOString().slice(0, 10);
    const spesaOggi = (spendRows ?? [])
      .filter((r) => r.spend_date === todayISO)
      .reduce((s, r) => s + Number(r.spend || 0), 0);

    // Config: margine % + costo prodotto + tiktok
    const { data: cfg } = await supabase
      .from("tracking_config")
      .select("margine_profitto_pct, daily_spend_tiktok, costo_prodotto")
      .eq("user_id", userId)
      .maybeSingle();
    const marginePct = Number(cfg?.margine_profitto_pct ?? 40);
    const costoProdotto = Number(cfg?.costo_prodotto ?? 0);
    const spesaTikTokDaily = Number(cfg?.daily_spend_tiktok ?? 0);

    // Stima TikTok dal fallback giornaliero (giorni nel range)
    const giorniRange = Math.max(1, Math.ceil((until.getTime() - since.getTime()) / 86400000));
    const spesaTikTok = spesaTikTokDaily * giorniRange;
    const spesaTotale = spesaMeta + spesaTikTok;

    // Lead nel range
    const { data: leads } = await supabase
      .from("crm_leads")
      .select("data, created_at")
      .eq("user_id", userId);
    const list = (leads ?? [])
      .map((l) => ({ d: l.data as LeadDataShape, created: l.created_at as string }))
      .filter((x) => {
        const dt = leadDate(x.d.createdAt, x.created);
        return dt && dt >= since && dt < until;
      });

    const converted = list.filter((x) => leadIsConverted(x.d));
    const fatturato = converted.reduce((s, x) => s + leadRevenue(x.d), 0);
    const costiViviCRM = converted.reduce((s, x) => s + leadCosts(x.d), 0);
    // Costi vivi totali = costi CRM + (costo_prodotto × conversioni se non già nei costi CRM)
    const totLead = list.length;
    const totConv = converted.length;
    // Se l'utente ha impostato costo_prodotto in Impostazioni, usa quello come baseline
    // (somma se i costi CRM sono inferiori)
    const costoProdottoTotal = costoProdotto * totConv;
    const costiVivi = Math.max(costiViviCRM, costoProdottoTotal);

    // Margine reale medio (su lead chiusi): (fatt - costi) / fatt
    const margineRealePct = fatturato > 0 ? ((fatturato - costiVivi) / fatturato) * 100 : marginePct;

    // Break-even ROAS
    const breakEvenTeorico = marginePct > 0 ? 100 / marginePct : 0;
    const breakEvenReale = margineRealePct > 0 ? 100 / margineRealePct : 0;

    // Metriche
    const mer = spesaTotale > 0 ? fatturato / spesaTotale : 0;
    const roasCRM = mer; // alias
    const cpl = totLead > 0 ? spesaTotale / totLead : 0;
    const cac = totConv > 0 ? spesaTotale / totConv : 0;
    const netto = fatturato - costiVivi - spesaTotale;

    // Proiezione fine mese
    const now = new Date();
    const giornoOggi = now.getDate();
    const ultimoGiornoMese = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const giorniRimanenti = ultimoGiornoMese - giornoOggi;
    const proiezioneSpesaMese = spesaOggi * ultimoGiornoMese; // oggi × giorni totali (proxy)
    const meseStartISO = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const spesaMeseFinora = (spendRows ?? [])
      .filter((r) => r.spend_date >= meseStartISO)
      .reduce((s, r) => s + Number(r.spend || 0), 0);
    const giorniDalMeseStart = giornoOggi;
    const mediaGiornaliera = giorniDalMeseStart > 0 ? spesaMeseFinora / giorniDalMeseStart : spesaOggi;
    const proiezioneMese = spesaMeseFinora + mediaGiornaliera * giorniRimanenti;

    // Per-piattaforma
    const meta = computePlatform("meta", list, converted, spesaMeta, costoProdotto);
    const tiktok = computePlatform("tiktok", list, converted, spesaTikTok, costoProdotto);

    return {
      lastFetched,
      spesaMeta,
      spesaTikTok,
      spesaTotale,
      spesaOggi,
      spesaMeseFinora,
      proiezioneMese,
      proiezioneSpesaMese,
      fatturato,
      costiVivi,
      costoProdotto,
      netto,
      totLead,
      totConv,
      mer,
      roasCRM,
      cpl,
      cac,
      marginePct,
      margineRealePct,
      breakEvenTeorico,
      breakEvenReale,
      meta,
      tiktok,
    };
  });

function computePlatform(
  platform: "meta" | "tiktok",
  list: { d: LeadDataShape; created: string }[],
  converted: { d: LeadDataShape; created: string }[],
  spesa: number,
  costoProdotto: number,
) {
  const items = list.filter((x) => leadPlatform(x.d) === platform);
  const conv = converted.filter((x) => leadPlatform(x.d) === platform);
  const lead = items.length;
  const conversioni = conv.length;
  const fatt = conv.reduce((s, x) => s + leadRevenue(x.d), 0);
  const costiCRM = conv.reduce((s, x) => s + leadCosts(x.d), 0);
  const costi = Math.max(costiCRM, costoProdotto * conversioni);
  return {
    spesa,
    lead,
    conversioni,
    fatturato: fatt,
    costiVivi: costi,
    cpl: lead > 0 ? spesa / lead : 0,
    cac: conversioni > 0 ? spesa / conversioni : 0,
    roas: spesa > 0 ? fatt / spesa : 0,
    netto: fatt - costi - spesa,
  };
}

// ─────────────────────────────────────────────────────────
// 2) CREATIVE PERFORMANCE — Deep Analysis per ad_id
// ─────────────────────────────────────────────────────────
export const getCreativePerformance = createServerFn({ method: "POST" })
  .inputValidator((d: {
    accessToken: string;
    sinceISO: string;
    untilISO: string;
    campaignIds?: string[];
    adsetIds?: string[];
    adIds?: string[];
    bypassCache?: boolean;
  }) => d)
  .handler(async ({ data }) => {
    const { supabase, userId } = await authenticate(data.accessToken);
    const filterKey = `${(data.campaignIds ?? []).sort().join(",")}|${(data.adsetIds ?? []).sort().join(",")}|${(data.adIds ?? []).sort().join(",")}`;
    const cacheKey = `creative-perf:${userId}:${data.sinceISO}:${data.untilISO}:${filterKey}`;
    if (data.bypassCache) SERVER_CACHE.delete(cacheKey);
    const __cached = await withServerCache(cacheKey, SERVER_CACHE_TTL_MS, async () => {
    const since = new Date(data.sinceISO);
    const until = new Date(data.untilISO);
    const cutoff = await getAdsHistoryStart(supabase, userId);
    const sinceDate = clampSince(data.sinceISO.slice(0, 10), cutoff);
    const untilDate = data.untilISO.slice(0, 10);
    const campaignFilter = data.campaignIds && data.campaignIds.length > 0 ? new Set(data.campaignIds) : null;
    const adsetFilter = data.adsetIds && data.adsetIds.length > 0 ? new Set(data.adsetIds) : null;
    const adFilter = data.adIds && data.adIds.length > 0 ? new Set(data.adIds) : null;

    // Costo prodotto per CAC reale
    const { data: cfg } = await supabase
      .from("tracking_config")
      .select("costo_prodotto")
      .eq("user_id", userId)
      .maybeSingle();
    const costoProdotto = Number(cfg?.costo_prodotto ?? 0);

    // Spesa per ad (range filtrato + filtro selezione) — include video/engagement + trend daily
    let spendQ = supabase
      .from("meta_ad_spend")
      .select("ad_id, adset_id, campaign_id, ad_name, campaign_name, spend_date, spend, impressions, clicks, reach, frequency, video_plays, video_p25_watched, video_p50_watched, video_p75_watched, video_p100_watched, video_thruplays, video_3_sec_watched, video_continuous_2_sec_watched, outbound_clicks, link_clicks, post_engagement, landing_page_views")
      .eq("user_id", userId)
      .gte("spend_date", sinceDate)
      .lte("spend_date", untilDate);
    if (campaignFilter) spendQ = spendQ.in("campaign_id", [...campaignFilter]);
    if (adsetFilter) spendQ = spendQ.in("adset_id", [...adsetFilter]);
    if (adFilter) spendQ = spendQ.in("ad_id", [...adFilter]);
    const { data: spendRows } = await spendQ;

    interface SpendAgg {
      ad_name: string | null; campaign_name: string | null;
      spend: number; impressions: number; clicks: number; reach: number; frequencySum: number; frequencyDays: number;
      video_plays: number; video_p25: number; video_p50: number; video_p75: number; video_p100: number; thruplays: number; v3sec: number; vCont2: number;
      outbound_clicks: number; link_clicks: number; post_engagement: number; lpv: number;
      daily: Map<string, { spend: number; impressions: number; clicks: number; video_plays: number; video_p25: number; video_p100: number; lpv: number; reach: number; frequency: number }>;
    }
    const spendMap = new Map<string, SpendAgg>();
    for (const r of spendRows ?? []) {
      let cur = spendMap.get(r.ad_id);
      if (!cur) {
        cur = {
          ad_name: r.ad_name, campaign_name: r.campaign_name,
          spend: 0, impressions: 0, clicks: 0, reach: 0, frequencySum: 0, frequencyDays: 0,
          video_plays: 0, video_p25: 0, video_p50: 0, video_p75: 0, video_p100: 0, thruplays: 0, v3sec: 0, vCont2: 0,
          outbound_clicks: 0, link_clicks: 0, post_engagement: 0, lpv: 0,
          daily: new Map(),
        };
        spendMap.set(r.ad_id, cur);
      }
      const sp = Number(r.spend || 0);
      const im = Number(r.impressions || 0);
      const cl = Number(r.clicks || 0);
      const rh = Number(r.reach || 0);
      const fq = Number(r.frequency || 0);
      const vp = Number(r.video_plays || 0);
      const v25 = Number(r.video_p25_watched || 0);
      const v50 = Number(r.video_p50_watched || 0);
      const v75 = Number(r.video_p75_watched || 0);
      const v100 = Number(r.video_p100_watched || 0);
      const thru = Number(r.video_thruplays || 0);
      const v3sec = Number((r as unknown as Record<string, number>).video_3_sec_watched || 0);
      const vCont2 = Number((r as unknown as Record<string, number>).video_continuous_2_sec_watched || 0);
      const oc = Number(r.outbound_clicks || 0);
      const lc = Number(r.link_clicks || 0);
      const pe = Number(r.post_engagement || 0);
      const lpv = Number(r.landing_page_views || 0);
      cur.spend += sp; cur.impressions += im; cur.clicks += cl;
      cur.reach += rh;
      if (fq > 0) { cur.frequencySum += fq; cur.frequencyDays++; }
      cur.video_plays += vp; cur.video_p25 += v25; cur.video_p50 += v50;
      cur.video_p75 += v75; cur.video_p100 += v100; cur.thruplays += thru;
      cur.v3sec += v3sec; cur.vCont2 += vCont2;
      cur.outbound_clicks += oc; cur.link_clicks += lc; cur.post_engagement += pe; cur.lpv += lpv;
      const day = r.spend_date as string;
      const d = cur.daily.get(day) || { spend: 0, impressions: 0, clicks: 0, video_plays: 0, video_p25: 0, video_p100: 0, lpv: 0, reach: 0, frequency: 0 };
      d.spend += sp; d.impressions += im; d.clicks += cl;
      d.video_plays += vp; d.video_p25 += v25; d.video_p100 += v100; d.lpv += lpv;
      d.reach += rh; d.frequency = Math.max(d.frequency, fq);
      cur.daily.set(day, d);
    }

    // Lead nel range con ad_id
    const { data: leads } = await supabase
      .from("crm_leads")
      .select("data, created_at")
      .eq("user_id", userId);
    const list = (leads ?? [])
      .map((l) => ({ d: l.data as LeadDataShape, created: l.created_at as string }))
      .filter((x) => {
        const dt = leadDate(x.d.createdAt, x.created);
        return dt && dt >= since && dt < until;
      });

    // Aggrega per ad_id
    interface CreativeStats {
      ad_id: string;
      ad_name: string;
      campaign_name: string;
      spend: number;
      impressions: number;
      clicks: number;
      lead: number;
      meet: number;
      presentati: number;
      conversioni: number;
      noShow: number;
      fatturato: number;
      costiVivi: number;
      disagioScores: number[];
    }
    const map = new Map<string, CreativeStats>();
    function ensure(adId: string, name?: string, camp?: string): CreativeStats {
      let cur = map.get(adId);
      if (!cur) {
        cur = {
          ad_id: adId,
          ad_name: name || "—",
          campaign_name: camp || "—",
          spend: 0, impressions: 0, clicks: 0,
          lead: 0, meet: 0, presentati: 0, conversioni: 0, noShow: 0,
          fatturato: 0, costiVivi: 0,
          disagioScores: [],
        };
        map.set(adId, cur);
      }
      return cur;
    }
    // Inietta tutti gli ad con spesa (anche senza lead)
    for (const [adId, s] of spendMap) {
      const c = ensure(adId, s.ad_name || undefined, s.campaign_name || undefined);
      c.spend = s.spend; c.impressions = s.impressions; c.clicks = s.clicks;
    }
    // Aggrega lead (filtra per selezione se presente)
    for (const x of list) {
      const adId = x.d.tracking?.ad_id;
      const adsetId = x.d.tracking?.adset_id;
      const campId = x.d.tracking?.campaign_id;
      if (!adId) continue;
      if (campaignFilter && campId && !campaignFilter.has(campId)) continue;
      if (adsetFilter && adsetId && !adsetFilter.has(adsetId)) continue;
      if (adFilter && !adFilter.has(adId)) continue;
      const c = ensure(adId, x.d.tracking?.ad_name, x.d.tracking?.campaign_name);
      c.lead++;
      if (x.d.stato === "no_show") c.noShow++;
      if (x.d.stato !== "perdi_tempo" && x.d.dataMeeting) c.meet++;
      if (ePresentato(x.d.stato)) c.presentati++;
      if (typeof x.d.disagioScore === "number") c.disagioScores.push(x.d.disagioScore);
      if (leadIsConverted(x.d)) {
        c.conversioni++;
        c.fatturato += leadRevenue(x.d);
        c.costiVivi += leadCosts(x.d);
      }
    }

    // Trend lead daily per ad
    const leadDailyByAd = new Map<string, Map<string, { lead: number; conv: number; rev: number }>>();
    for (const x of list) {
      const adId = x.d.tracking?.ad_id;
      if (!adId) continue;
      if (campaignFilter && x.d.tracking?.campaign_id && !campaignFilter.has(x.d.tracking.campaign_id)) continue;
      if (adsetFilter && x.d.tracking?.adset_id && !adsetFilter.has(x.d.tracking.adset_id)) continue;
      if (adFilter && !adFilter.has(adId)) continue;
      const dt = leadDate(x.d.createdAt, x.created);
      if (!dt) continue;
      const day = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      if (!leadDailyByAd.has(adId)) leadDailyByAd.set(adId, new Map());
      const m = leadDailyByAd.get(adId)!;
      const cur = m.get(day) || { lead: 0, conv: 0, rev: 0 };
      cur.lead++;
      if (leadIsConverted(x.d)) {
        cur.conv++;
        cur.rev += leadRevenue(x.d);
      }
      m.set(day, cur);
    }

    // ───── F4 + F5: arricchimento da lp_events e public_leads ─────
    // lp_events: aggrega per ad_id buckets di scroll (25/50/75/100) e tempo (15/30/60s)
    interface LpAgg {
      sessions: Set<string>;
      pageViews: Set<string>;
      hqv: Set<string>;
      scroll25: Set<string>;
      scroll50: Set<string>;
      scroll75: Set<string>;
      scroll100: Set<string>;
      t15: Set<string>;
      t30: Set<string>;
      t60: Set<string>;
      // Per sessione: max scroll e max time_on_page (per calcolare medie reali per ad)
      sessionMaxScroll: Map<string, number>;
      sessionMaxTime: Map<string, number>;
      // Sprint 1: max step funnel raggiunto per sessione + flag bot
      sessionMaxStep: Map<string, number>;
      botSessions: Set<string>;
      sessionHasLead: Set<string>;
    }
    const lpByAd = new Map<string, LpAgg>();
    // F3-bis: bucket giornaliero PageView/HQV per ad → trend qualità nel drawer
    const lpDailyByAd = new Map<string, Map<string, { pv: Set<string>; hqv: Set<string> }>>();
    function ensureLp(adId: string): LpAgg {
      let cur = lpByAd.get(adId);
      if (!cur) {
        cur = {
          sessions: new Set(), pageViews: new Set(), hqv: new Set(),
          scroll25: new Set(), scroll50: new Set(), scroll75: new Set(), scroll100: new Set(),
          t15: new Set(), t30: new Set(), t60: new Set(),
          sessionMaxScroll: new Map(), sessionMaxTime: new Map(),
          sessionMaxStep: new Map(), botSessions: new Set(), sessionHasLead: new Set(),
        };
        lpByAd.set(adId, cur);
      }
      return cur;
    }
    function ensureLpDay(adId: string, day: string) {
      let m = lpDailyByAd.get(adId);
      if (!m) { m = new Map(); lpDailyByAd.set(adId, m); }
      let d = m.get(day);
      if (!d) { d = { pv: new Set(), hqv: new Set() }; m.set(day, d); }
      return d;
    }
    // Sprint 1: includiamo bot e step per quality scoring (filter applicato dopo).
    const { data: lpRows } = await supabase
      .from("lp_events")
      .select("ad_id, event_name, session_id, time_on_page, max_scroll, is_bot, created_at, step")
      .gte("created_at", data.sinceISO)
      .lte("created_at", data.untilISO)
      .limit(100000);
    for (const ev of lpRows ?? []) {
      const adId = ev.ad_id;
      if (!adId) continue;
      if (adFilter && !adFilter.has(adId)) continue;
      const agg = ensureLp(adId);
      // Bot tracking: marca la sessione come bot ma NON skip — serve per il bot rate.
      if (ev.is_bot) {
        agg.botSessions.add(ev.session_id);
        continue; // i bot non contribuiscono ad altre metriche di qualità
      }
      agg.sessions.add(ev.session_id);
      const day = (ev.created_at as string).slice(0, 10);
      const dayAgg = ensureLpDay(adId, day);
      if (ev.event_name === "PageView") { agg.pageViews.add(ev.session_id); dayAgg.pv.add(ev.session_id); }
      if (ev.event_name === "HighQualityVisit") { agg.hqv.add(ev.session_id); dayAgg.hqv.add(ev.session_id); }
      if (ev.event_name === "Lead") agg.sessionHasLead.add(ev.session_id);
      // Step massimo raggiunto (FunnelStep + StepView)
      if ((ev.event_name === "FunnelStep" || ev.event_name === "StepView") && typeof ev.step === "number") {
        const cur = agg.sessionMaxStep.get(ev.session_id) ?? 0;
        if (ev.step > cur) agg.sessionMaxStep.set(ev.session_id, ev.step);
      }
      const scroll = ev.max_scroll ?? 0;
      if (scroll >= 25) agg.scroll25.add(ev.session_id);
      if (scroll >= 50) agg.scroll50.add(ev.session_id);
      if (scroll >= 75) agg.scroll75.add(ev.session_id);
      if (scroll >= 100) agg.scroll100.add(ev.session_id);
      const t = ev.time_on_page ?? 0;
      if (t >= 15) agg.t15.add(ev.session_id);
      if (t >= 30) agg.t30.add(ev.session_id);
      if (t >= 60) agg.t60.add(ev.session_id);
      // Tieni il massimo per sessione (ogni sessione genera molti eventi)
      if (scroll > (agg.sessionMaxScroll.get(ev.session_id) ?? 0)) {
        agg.sessionMaxScroll.set(ev.session_id, scroll);
      }
      if (t > (agg.sessionMaxTime.get(ev.session_id) ?? 0)) {
        agg.sessionMaxTime.set(ev.session_id, t);
      }
    }

    // public_leads: portatore% + urgenza score (mappa fissa)
    const URGENCY_MAP: Record<string, number> = {
      subito: 10, si: 10, convince: 9,
      "1mese": 8,
      "2_3mesi": 5,
      valutando: 2, valuto: 2,
    };
    interface LeadQualAgg { total: number; portatori: number; urgenze: number[]; disagi: number[] }
    const leadQualByAd = new Map<string, LeadQualAgg>();
    const { data: pubLeads } = await supabase
      .from("public_leads")
      .select("ad_id, portatore, urgenza, disagio_score")
      .gte("created_at", data.sinceISO)
      .lte("created_at", data.untilISO)
      .limit(50000);
    for (const pl of pubLeads ?? []) {
      const adId = pl.ad_id;
      if (!adId) continue;
      if (adFilter && !adFilter.has(adId)) continue;
      let q = leadQualByAd.get(adId);
      if (!q) { q = { total: 0, portatori: 0, urgenze: [], disagi: [] }; leadQualByAd.set(adId, q); }
      q.total++;
      if (pl.portatore === true) q.portatori++;
      if (pl.urgenza && URGENCY_MAP[pl.urgenza] !== undefined) q.urgenze.push(URGENCY_MAP[pl.urgenza]);
      if (typeof pl.disagio_score === "number") q.disagi.push(pl.disagio_score);
    }

    // Calcola payback time per creativa: stima giorni medi tra createdAt e accontoData/saldoData
    const paybackByAd = new Map<string, number[]>();
    for (const x of list) {
      const adId = x.d.tracking?.ad_id;
      if (!adId) continue;
      const start = leadDate(x.d.createdAt, x.created);
      const payDate = x.d.payment?.saldoData || x.d.payment?.accontoData;
      if (!start || !payDate) continue;
      const end = new Date(payDate);
      if (isNaN(end.getTime())) continue;
      const days = (end.getTime() - start.getTime()) / 86400000;
      if (days < 0) continue;
      if (!paybackByAd.has(adId)) paybackByAd.set(adId, []);
      paybackByAd.get(adId)!.push(days);
    }

    const items = [...map.values()].map((c) => {
      const sa = spendMap.get(c.ad_id);
      const showRate = c.lead > 0 ? (c.presentati / c.lead) * 100 : 0;
      const closeRate = c.presentati > 0 ? (c.conversioni / c.presentati) * 100 : 0;
      const aov = c.conversioni > 0 ? c.fatturato / c.conversioni : 0;
      const cac = c.conversioni > 0 ? c.spend / c.conversioni : 0;
      const cpl = c.lead > 0 ? c.spend / c.lead : 0;
      const roas = c.spend > 0 ? c.fatturato / c.spend : 0;
      const costiViviTot = Math.max(c.costiVivi, costoProdotto * c.conversioni);
      const netto = c.fatturato - costiViviTot - c.spend;
      // LPS (Lead Pain Score): Σ punteggi disagio / N TOTALE lead generati dall'ad.
      // Lead senza score dichiarato contano come 0 (dolore non manifestato).
      // Questo penalizza correttamente le ad che attirano lead "tiepidi" che non
      // si esprimono sul dolore, e premia le ad che attirano lead estremamente
      // motivati anche se più costose. Formula richiesta dall'utente.
      const disagioAvg = c.lead > 0
        ? c.disagioScores.reduce((s, v) => s + v, 0) / c.lead
        : null;
      // LPS Coverage: % di lead che hanno dichiarato un punteggio di disagio.
      // Aiuta a distinguere LPS basso per "lead muti" (coverage bassa) da
      // LPS basso per "lead davvero senza dolore" (coverage alta).
      const lpsCoverage = c.lead > 0
        ? (c.disagioScores.length / c.lead) * 100
        : null;
      const pbDays = paybackByAd.get(c.ad_id);
      const paybackDays = pbDays && pbDays.length > 0 ? pbDays.reduce((s, v) => s + v, 0) / pbDays.length : null;

      // Metriche video / engagement Meta (TOP-OF-FUNNEL DA META)
      const videoPlays = sa?.video_plays ?? 0;
      const v25 = sa?.video_p25 ?? 0;
      const v50 = sa?.video_p50 ?? 0;
      const v75 = sa?.video_p75 ?? 0;
      const v100 = sa?.video_p100 ?? 0;
      const thru = sa?.thruplays ?? 0;
      const v3sec = sa?.v3sec ?? 0;
      const vCont2 = sa?.vCont2 ?? 0;
      const postEng = sa?.post_engagement ?? 0;

      // ───── UTM-FIRST TOTALE ─────
      // Click reali, LP views, CTR, CTR Link, CTR Outbound, LP View Rate
      // tutti calcolati da lp_events (sessioni uniche con ad_id match) — non più da Meta.
      const lp = lpByAd.get(c.ad_id);
      const utmSessions = lp?.sessions.size ?? 0;          // = "click reali" che hanno raggiunto LP
      const pageViews = lp?.pageViews.size ?? 0;            // = LP views uniche
      const hqv = lp?.hqv.size ?? 0;
      const qualityRate = pageViews > 0 ? (hqv / pageViews) * 100 : 0;

      // CTR da Meta = SOSTITUITO con UTM CTR (sessioni LP / impressions)
      const ctr = c.impressions > 0 ? (utmSessions / c.impressions) * 100 : 0;
      const cpm = c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0;
      // CTR Link / Outbound: in approccio UTM-first puro coincidono con CTR (un solo dato veritiero)
      const ctrLink = ctr;
      const ctrOutbound = ctr;
      // LP View Rate: % di chi clicca che effettivamente visualizza la pagina (PageView fired)
      const lpViewRate = utmSessions > 0 ? (pageViews / utmSessions) * 100 : 0;

      // Click reali e LP views esposti come "clicks" e "lpv" (override valori Meta)
      const clicks = utmSessions;
      const linkClicks = utmSessions;
      const outboundClicks = utmSessions;
      const lpv = pageViews;

      // Video metrics — formule centralizzate in metrics-formulas.ts (single source of truth)
      const videoViews = computeVideoViews(v3sec, v25);
      const hookRate = computeHookRate(videoViews, videoPlays);
      const thumbstopRate = computeThumbstopRate(videoViews, vCont2, hookRate);
      const holdRate = computeHoldRate(thru, videoViews);
      const _vr = computeViewRates(v25, v50, v75, v100, videoViews);
      const view25Rate = _vr.view25Rate;
      const view50Rate = _vr.view50Rate;
      const view75Rate = _vr.view75Rate;
      const view100Rate = _vr.view100Rate;
      const thruRate = computeThruRate(thru, videoPlays);

      // Trend daily merge spesa Meta + lead CRM + qualità LP
      const ldMap = leadDailyByAd.get(c.ad_id) || new Map();
      const lpDay = lpDailyByAd.get(c.ad_id);
      const allDays = new Set<string>([
        ...(sa ? [...sa.daily.keys()] : []),
        ...ldMap.keys(),
        ...(lpDay ? [...lpDay.keys()] : []),
      ]);
      const trend = [...allDays].sort().map((day) => {
        const s = sa?.daily.get(day);
        const l = ldMap.get(day);
        const q = lpDay?.get(day);
        const pvD = q?.pv.size ?? 0;
        const hqvD = q?.hqv.size ?? 0;
        return {
          date: day,
          spend: s?.spend ?? 0,
          impressions: s?.impressions ?? 0,
          // UTM-first: clicks giornalieri = pageViews UTM, non più Meta clicks
          clicks: pvD,
          lpv: pvD,
          videoPlays: s?.video_plays ?? 0,
          v25: s?.video_p25 ?? 0,
          v100: s?.video_p100 ?? 0,
          lead: l?.lead ?? 0,
          conv: l?.conv ?? 0,
          rev: l?.rev ?? 0,
          pageViews: pvD,
          hqv: hqvD,
          qualityRate: pvD > 0 ? (hqvD / pvD) * 100 : 0,
          // Daily inputs per fatigue trend (popolati dopo)
          frequency: Number(s?.frequency ?? 0),
          fatigueScore: 0,
        };
      });

      // F4: LP scroll/tempo
      const lpScroll25 = lp?.scroll25.size ?? 0;
      const lpScroll50 = lp?.scroll50.size ?? 0;
      const lpScroll75 = lp?.scroll75.size ?? 0;
      const lpScroll100 = lp?.scroll100.size ?? 0;
      const lpT15 = lp?.t15.size ?? 0;
      const lpT30 = lp?.t30.size ?? 0;
      const lpT60 = lp?.t60.size ?? 0;
      const cps0 = pageViews > 0 ? c.spend / pageViews : 0;
      const cps25 = lpScroll25 > 0 ? c.spend / lpScroll25 : 0;
      const cps50 = lpScroll50 > 0 ? c.spend / lpScroll50 : 0;
      const cps75 = lpScroll75 > 0 ? c.spend / lpScroll75 : 0;
      const cps100 = lpScroll100 > 0 ? c.spend / lpScroll100 : 0;
      const cpt15 = lpT15 > 0 ? c.spend / lpT15 : 0;
      const cpt30 = lpT30 > 0 ? c.spend / lpT30 : 0;
      const cpt60 = lpT60 > 0 ? c.spend / lpT60 : 0;
      const cplQ = hqv > 0 && c.lead > 0 ? c.spend / Math.min(c.lead, hqv) : (c.lead > 0 ? c.spend / c.lead : 0);

      // Avg scroll / time per ad (medie sulle sessioni LP che l'ad ha portato)
      const scrollVals = lp ? [...lp.sessionMaxScroll.values()] : [];
      const timeVals = lp ? [...lp.sessionMaxTime.values()] : [];
      const avgScroll = scrollVals.length > 0
        ? scrollVals.reduce((s, v) => s + v, 0) / scrollVals.length
        : 0;
      const avgTime = timeVals.length > 0
        ? timeVals.reduce((s, v) => s + v, 0) / timeVals.length
        : 0;

      // ───── Sprint 1: Ponte Ads↔LP — metriche traffic quality per ad ─────
      // lpSessions = sessioni reali (NO bot). lpBots conteggio separato.
      const lpSessions = lp?.sessions.size ?? 0;
      const lpBots = lp?.botSessions.size ?? 0;
      // Bounce sessione: ≤10s scroll≤15% e step<2 e nessun lead.
      // Una sessione bounce = utente arrivato e subito uscito senza interazione.
      const stepMap = lp?.sessionMaxStep ?? new Map<string, number>();
      const leadSet = lp?.sessionHasLead ?? new Set<string>();
      let lpBounces = 0;
      let lpStep2Reached = 0;
      let stepSum = 0;
      if (lp) {
        for (const sid of lp.sessions) {
          const sScroll = lp.sessionMaxScroll.get(sid) ?? 0;
          const sTime = lp.sessionMaxTime.get(sid) ?? 0;
          const sStep = stepMap.get(sid) ?? 0;
          const hasLead = leadSet.has(sid);
          if (sTime < 10 || (sScroll < 15 && sStep < 2 && !hasLead)) {
            lpBounces++;
          }
          // Step 2 raggiunto = engagement reale nel funnel
          if (sStep >= 2 || hasLead) lpStep2Reached++;
          // Per dropStepAvg: step max raggiunto, considerando lead come step 6
          stepSum += hasLead ? 6 : sStep;
        }
      }
      const lpAvgTime = avgTime; // alias semantico (≡ avgTime)
      const lpAvgScroll = avgScroll;
      const lpBounceRate = lpSessions > 0 ? (lpBounces / lpSessions) * 100 : 0;
      const lpDropStepAvg = lpSessions > 0 ? stepSum / lpSessions : 0;

      // F5: Lead quality (portatore + urgenza)
      const lq = leadQualByAd.get(c.ad_id);
      const portatorePct = lq && lq.total > 0 ? (lq.portatori / lq.total) * 100 : 0;
      const urgenzaScore = lq && lq.urgenze.length > 0
        ? lq.urgenze.reduce((s, v) => s + v, 0) / lq.urgenze.length
        : 0;

      // Reach + Frequency da Meta (top-of-funnel)
      const reach = sa?.reach ?? 0;
      const frequency = sa && sa.frequencyDays > 0 ? sa.frequencySum / sa.frequencyDays : 0;
      // Click "dichiarati" da Meta (per tooltip UTM vs Meta)
      const metaClicks = sa?.clicks ?? 0;
      const metaCtr = c.impressions > 0 ? (metaClicks / c.impressions) * 100 : 0;
      const metaLpv = sa?.lpv ?? 0;
      const metaLpViewRate = metaClicks > 0 ? (metaLpv / metaClicks) * 100 : 0;

      return {
        ad_id: c.ad_id,
        ad_name: c.ad_name,
        campaign_name: c.campaign_name,
        spend: c.spend,
        impressions: c.impressions,
        clicks,                 // UTM-first
        lead: c.lead,
        meet: c.meet,
        presentati: c.presentati,
        conversioni: c.conversioni,
        noShow: c.noShow,
        fatturato: c.fatturato,
        costiVivi: costiViviTot,
        netto,
        showRate, closeRate, aov, cac, cpl, roas,
        disagioAvg, lpsCoverage, paybackDays,
        // Meta extra (top-of-funnel)
        ctr, cpm, ctrLink, ctrOutbound, lpViewRate,
        reach, frequency,
        // Per tooltip UTM vs Meta
        metaClicks, metaCtr, metaLpv, metaLpViewRate,
        videoPlays, v25, v50, v75, v100, thru,
        outboundClicks, linkClicks, postEng, lpv,
        hookRate, holdRate, thumbstopRate,
        view25Rate, view50Rate, view75Rate, view100Rate, thruRate,
        // F4: LP quality + costi per scroll/tempo
        pageViews, hqv, qualityRate,
        cps0, cps25, cps50, cps75, cps100,
        cpt15, cpt30, cpt60,
        cplQ,
        // F6: fatigue inputs (avgScroll % 0–100, avgTime in secondi)
        avgScroll, avgTime,
        // Sprint 1: Ponte Ads↔LP
        lpSessions, lpBots, lpBounces, lpBounceRate,
        lpAvgTime, lpAvgScroll, lpStep2Reached, lpDropStepAvg,
        // F5: lead quality
        portatorePct, urgenzaScore,
        trend,
      };
    }).sort((a, b) => b.spend - a.spend);

    // ───── F6: Fatigue Score 0–100 (calcolato dopo aver costruito gli items)
    // Componenti (peso uguale 33% ciascuno):
    //  • Frequenza: 0 score a freq=1, 100 score a freq=6 (clamp).
    //  • CTR drop: shortfall vs CTR mediano del set (0 se ≥ mediano, 100 se = 0%).
    //  • Tempo medio LP: 0 score a 60s, 100 score a 0s (linear) — meno è peggio.
    // Punteggio finale: alto = ad più stanca.
    const ctrValues = items.filter((x) => x.spend > 0 && x.impressions > 100).map((x) => x.ctr).sort((a, b) => a - b);
    const medianCtr = ctrValues.length > 0
      ? ctrValues[Math.floor(ctrValues.length / 2)]
      : 0;
    const itemsWithFatigue = items.map((it) => {
      const freq = it.frequency ?? 0;
      const freqScore = Math.max(0, Math.min(100, ((freq - 1) / 5) * 100));
      const ctrDropScore = medianCtr > 0
        ? Math.max(0, Math.min(100, ((medianCtr - it.ctr) / medianCtr) * 100))
        : 0;
      const timeScore = Math.max(0, Math.min(100, ((60 - it.avgTime) / 60) * 100));
      const fatigueScore = Math.round((freqScore + ctrDropScore + timeScore) / 3);
      // Trend giornaliero del fatigue score (per sparkline 7gg in tabella e linea nel drawer).
      // Componenti per-day: freq giornaliera + ctrDrop vs CTR mediano periodo (calcolato su impressions=clicks/imp giornalieri) + timeScore (avgTime periodo, costante per giorno: dato non disponibile per-day).
      const trendWithFatigue = it.trend.map((t) => {
        const dayCtr = t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0;
        const dayFreq = t.frequency ?? 0;
        const dFreqScore = Math.max(0, Math.min(100, ((dayFreq - 1) / 5) * 100));
        const dCtrDrop = medianCtr > 0
          ? Math.max(0, Math.min(100, ((medianCtr - dayCtr) / medianCtr) * 100))
          : 0;
        const dScore = Math.round((dFreqScore + dCtrDrop + timeScore) / 3);
        return { ...t, fatigueScore: dScore };
      });
      return { ...it, fatigueScore, trend: trendWithFatigue };
    });

    return { items: itemsWithFatigue };
    });
    return { ...__cached.value, _cachedAt: __cached.cachedAt, _isStale: __cached.isStale };
  });

// ─────────────────────────────────────────────────────────
// 3) MANUAL SYNC — chiama Meta Marketing API direttamente per l'utente
// ─────────────────────────────────────────────────────────
interface MetaActionRow { action_type: string; value: string }
interface MetaInsightRow {
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  ad_name?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  reach?: string;
  frequency?: string;
  date_start?: string;
  actions?: MetaActionRow[];
  outbound_clicks?: MetaActionRow[];
  video_play_actions?: MetaActionRow[];
  video_p25_watched_actions?: MetaActionRow[];
  video_p50_watched_actions?: MetaActionRow[];
  video_p75_watched_actions?: MetaActionRow[];
  video_p100_watched_actions?: MetaActionRow[];
  video_thruplay_watched_actions?: MetaActionRow[];
  video_3_sec_watched_actions?: MetaActionRow[];
  video_15_sec_watched_actions?: MetaActionRow[];
  video_avg_time_watched_actions?: MetaActionRow[];
  video_continuous_2_sec_watched_actions?: MetaActionRow[];
}

function sumAction(rows: MetaActionRow[] | undefined, type?: string): number {
  if (!rows) return 0;
  if (!type) return rows.reduce((s, r) => s + Number(r.value || 0), 0);
  return rows
    .filter((r) => r.action_type === type)
    .reduce((s, r) => s + Number(r.value || 0), 0);
}

async function fetchMetaInsights(
  adAccountId: string,
  accessToken: string,
  since: string,
  until: string,
): Promise<MetaInsightRow[]> {
  const account = adAccountId.startsWith("act_") ? adAccountId : `act_${adAccountId}`;
  const fields = [
    "ad_id","adset_id","campaign_id","ad_name","campaign_name",
    "spend","impressions","clicks","reach","frequency",
    "actions","outbound_clicks",
    "video_play_actions",
    "video_p25_watched_actions","video_p50_watched_actions",
    "video_p75_watched_actions","video_p100_watched_actions",
    "video_thruplay_watched_actions",
    "video_15_sec_watched_actions",
    "video_avg_time_watched_actions",
  ].join(",");
  const params = new URLSearchParams({
    level: "ad",
    fields,
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    limit: "500",
    access_token: accessToken,
  });
  const all: MetaInsightRow[] = [];
  let url: string | undefined =
    `https://graph.facebook.com/v19.0/${account}/insights?${params.toString()}`;
  let pages = 0;
  while (url && pages < 10) {
    const res = await fetch(url);
    const txt = await res.text();
    let json: { data?: MetaInsightRow[]; paging?: { next?: string }; error?: { message?: string } };
    try { json = JSON.parse(txt); }
    catch { throw new Error(`Meta API risposta non-JSON (${res.status}): ${txt.slice(0, 200)}`); }
    if (!res.ok || json.error) throw new Error(json.error?.message || `Meta API ${res.status}`);
    all.push(...(json.data ?? []));
    url = json.paging?.next;
    pages++;
  }
  return all;
}

export const syncMetaSpendNow = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; sinceISO?: string; untilISO?: string }) => d)
  .handler(async ({ data }) => {
    const { supabase, userId } = await authenticate(data.accessToken);
    // Invalida la cache server-side: dopo un sync vogliamo dati freschi
    for (const k of [...SERVER_CACHE.keys()]) {
      if (k.startsWith(`creative-perf:${userId}:`) || k === `meta-hierarchy:${userId}`) {
        SERVER_CACHE.delete(k);
      }
    }

    const { data: cfg, error: cfgErr } = await supabase
      .from("tracking_config")
      .select("meta_ad_account_id, meta_access_token")
      .eq("user_id", userId)
      .maybeSingle();
    if (cfgErr) throw new Error(`Config: ${cfgErr.message}`);
    if (!cfg?.meta_ad_account_id || !cfg?.meta_access_token) {
      throw new Error("Configura Meta Ad Account ID e Access Token in Impostazioni.");
    }

    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const today = new Date();
    const past = new Date(today); past.setDate(today.getDate() - 30);
    const sinceRaw = data.sinceISO ? data.sinceISO.slice(0, 10) : iso(past);
    const until = data.untilISO ? data.untilISO.slice(0, 10) : iso(today);
    // Applica cutoff "Data inizio storico ads": NON sincronizzare nulla prima di quel giorno
    const cutoff = await getAdsHistoryStart(supabase, userId);
    const since = clampSince(sinceRaw, cutoff);
    if (since > until) {
      return {
        ok: true,
        rows: 0,
        fetched: 0,
        range: `${since} → ${until}`,
        chunks: 0,
        errors: [],
        skipped: `Cutoff (${cutoff}) successivo al range richiesto.`,
        account: cfg.meta_ad_account_id,
      };
    }

    // Spezza il range in chunk da 30g per evitare "Please reduce the amount of data"
    // di Meta su finestre lunghe (90g/180g/lifetime).
    const startD = new Date(since + "T00:00:00");
    const endD = new Date(until + "T00:00:00");
    const chunks: { since: string; until: string }[] = [];
    let cur = new Date(startD);
    while (cur <= endD) {
      const chunkEnd = new Date(cur);
      chunkEnd.setDate(chunkEnd.getDate() + 29);
      if (chunkEnd > endD) chunkEnd.setTime(endD.getTime());
      chunks.push({ since: iso(cur), until: iso(chunkEnd) });
      cur = new Date(chunkEnd);
      cur.setDate(cur.getDate() + 1);
    }

    const rows: MetaInsightRow[] = [];
    const chunkErrors: string[] = [];
    for (const c of chunks) {
      try {
        const part = await fetchMetaInsights(cfg.meta_ad_account_id, cfg.meta_access_token, c.since, c.until);
        rows.push(...part);
      } catch (e) {
        chunkErrors.push(`${c.since}→${c.until}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    const upserts = rows
      .filter((r) => r.ad_id && r.date_start && (!cutoff || r.date_start >= cutoff))
      .map((r) => {
        const linkClicks = sumAction(r.actions, "link_click");
        const lpv = sumAction(r.actions, "landing_page_view");
        const postEng = sumAction(r.actions, "post_engagement");
        return {
          user_id: userId,
          spend_date: r.date_start!,
          ad_id: r.ad_id!,
          adset_id: r.adset_id ?? null,
          campaign_id: r.campaign_id ?? null,
          ad_name: r.ad_name ?? null,
          campaign_name: r.campaign_name ?? null,
          spend: Number(r.spend || 0),
          impressions: Number(r.impressions || 0),
          clicks: Number(r.clicks || 0),
          reach: Math.round(Number(r.reach || 0)),
          frequency: Number(r.frequency || 0),
          // Per i video_*_watched_actions di Meta NON va filtrato action_type
          // (l'array contiene già SOLO la metrica richiesta).
          video_plays: Math.round(sumAction(r.video_play_actions)),
          video_p25_watched: Math.round(sumAction(r.video_p25_watched_actions)),
          video_p50_watched: Math.round(sumAction(r.video_p50_watched_actions)),
          video_p75_watched: Math.round(sumAction(r.video_p75_watched_actions)),
          video_p100_watched: Math.round(sumAction(r.video_p100_watched_actions)),
          video_thruplays: Math.round(sumAction(r.video_thruplay_watched_actions)),
          video_3_sec_watched: Math.round(sumAction(r.actions, "video_view")),
          video_15_sec_watched: Math.round(sumAction(r.video_15_sec_watched_actions)),
          video_avg_time_watched: sumAction(r.video_avg_time_watched_actions),
          video_continuous_2_sec_watched: 0,
          outbound_clicks: Math.round(sumAction(r.outbound_clicks, "outbound_click")),
          link_clicks: Math.round(linkClicks),
          post_engagement: Math.round(postEng),
          landing_page_views: Math.round(lpv),
          fetched_at: new Date().toISOString(),
        };
      });

    let upserted = 0;
    if (upserts.length > 0) {
      const keys = upserts.map((u) => ({ ad_id: u.ad_id, spend_date: u.spend_date }));
      const dates = [...new Set(keys.map((k) => k.spend_date))];
      const adIds = [...new Set(keys.map((k) => k.ad_id))];
      const { data: existing } = await supabase
        .from("meta_ad_spend")
        .select("ad_id, spend_date, spend, impressions, clicks, video_plays, video_p25_watched, video_p50_watched, video_p75_watched, video_p100_watched, video_thruplays, video_3_sec_watched, video_15_sec_watched, video_avg_time_watched, video_continuous_2_sec_watched, outbound_clicks, link_clicks, post_engagement, landing_page_views")
        .eq("user_id", userId)
        .in("spend_date", dates)
        .in("ad_id", adIds);
      const existMap = new Map<string, Record<string, number>>();
      for (const r of existing ?? []) {
        existMap.set(`${r.spend_date}|${r.ad_id}`, {
          spend: Number(r.spend || 0),
          impressions: Number(r.impressions || 0),
          clicks: Number(r.clicks || 0),
          video_plays: Number(r.video_plays || 0),
          video_p25_watched: Number(r.video_p25_watched || 0),
          video_p50_watched: Number(r.video_p50_watched || 0),
          video_p75_watched: Number(r.video_p75_watched || 0),
          video_p100_watched: Number(r.video_p100_watched || 0),
          video_thruplays: Number(r.video_thruplays || 0),
          video_3_sec_watched: Number((r as unknown as Record<string, number>).video_3_sec_watched || 0),
          video_15_sec_watched: Number((r as unknown as Record<string, number>).video_15_sec_watched || 0),
          video_avg_time_watched: Number((r as unknown as Record<string, number>).video_avg_time_watched || 0),
          video_continuous_2_sec_watched: Number((r as unknown as Record<string, number>).video_continuous_2_sec_watched || 0),
          outbound_clicks: Number(r.outbound_clicks || 0),
          link_clicks: Number(r.link_clicks || 0),
          post_engagement: Number(r.post_engagement || 0),
          landing_page_views: Number(r.landing_page_views || 0),
        });
      }
      const merged = upserts.map((u) => {
        const prev = existMap.get(`${u.spend_date}|${u.ad_id}`);
        if (!prev) return u;
        return {
          ...u,
          spend: Math.max(u.spend, prev.spend),
          impressions: Math.max(u.impressions, prev.impressions),
          clicks: Math.max(u.clicks, prev.clicks),
          video_plays: Math.max(u.video_plays, prev.video_plays),
          video_p25_watched: Math.max(u.video_p25_watched, prev.video_p25_watched),
          video_p50_watched: Math.max(u.video_p50_watched, prev.video_p50_watched),
          video_p75_watched: Math.max(u.video_p75_watched, prev.video_p75_watched),
          video_p100_watched: Math.max(u.video_p100_watched, prev.video_p100_watched),
          video_thruplays: Math.max(u.video_thruplays, prev.video_thruplays),
          video_3_sec_watched: Math.max(u.video_3_sec_watched, prev.video_3_sec_watched),
          video_15_sec_watched: Math.max(u.video_15_sec_watched, prev.video_15_sec_watched),
          video_avg_time_watched: Math.max(u.video_avg_time_watched, prev.video_avg_time_watched),
          video_continuous_2_sec_watched: Math.max(u.video_continuous_2_sec_watched, prev.video_continuous_2_sec_watched),
          outbound_clicks: Math.max(u.outbound_clicks, prev.outbound_clicks),
          link_clicks: Math.max(u.link_clicks, prev.link_clicks),
          post_engagement: Math.max(u.post_engagement, prev.post_engagement),
          landing_page_views: Math.max(u.landing_page_views, prev.landing_page_views),
        };
      });
      const { error: upErr, count } = await supabase
        .from("meta_ad_spend")
        .upsert(merged, { onConflict: "user_id,spend_date,ad_id", count: "exact" });
      if (upErr) throw new Error(`Upsert: ${upErr.message}`);
      upserted = count ?? merged.length;
    }

    return {
      ok: chunkErrors.length === 0,
      rows: upserted,
      fetched: rows.length,
      range: `${since} → ${until}`,
      chunks: chunks.length,
      errors: chunkErrors,
      account: cfg.meta_ad_account_id,
    };
  });

// ─────────────────────────────────────────────────────────
// 3.5) PAUSE / RESUME ADS — chiama Meta API per cambiare status
// ─────────────────────────────────────────────────────────
export const setAdsStatus = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; adIds: string[]; status: "PAUSED" | "ACTIVE" }) => d)
  .handler(async ({ data }) => {
    const { supabase, userId } = await authenticate(data.accessToken);
    const { data: cfg } = await supabase
      .from("tracking_config")
      .select("meta_access_token")
      .eq("user_id", userId)
      .maybeSingle();
    if (!cfg?.meta_access_token) throw new Error("Token Meta non configurato.");
    const token = cfg.meta_access_token;
    const results: { ad_id: string; ok: boolean; error?: string }[] = [];
    for (const adId of data.adIds) {
      try {
        const r = await fetch(`https://graph.facebook.com/v19.0/${adId}`, {
          method: "POST",
          body: new URLSearchParams({ status: data.status, access_token: token }),
        });
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error?.message || `Meta API ${r.status}`);
        results.push({ ad_id: adId, ok: true });
      } catch (e) {
        results.push({ ad_id: adId, ok: false, error: e instanceof Error ? e.message : "Errore" });
      }
    }
    const okCount = results.filter((r) => r.ok).length;
    return { ok: okCount === data.adIds.length, results, okCount, total: data.adIds.length };
  });

// ─────────────────────────────────────────────────────────
// 4) RESET MEMORIA STORICA — cancella spese Meta per range
// ─────────────────────────────────────────────────────────
export const resetMetaSpend = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; sinceISO?: string; untilISO?: string }) => d)
  .handler(async ({ data }) => {
    const { supabase, userId } = await authenticate(data.accessToken);
    let q = supabase.from("meta_ad_spend").delete({ count: "exact" }).eq("user_id", userId);
    if (data.sinceISO) q = q.gte("spend_date", data.sinceISO.slice(0, 10));
    if (data.untilISO) q = q.lte("spend_date", data.untilISO.slice(0, 10));
    const { error, count } = await q;
    if (error) throw new Error(`Reset: ${error.message}`);
    return { ok: true, deleted: count ?? 0 };
  });

// Invalida la cache server-side (in-memory) per l'utente corrente.
// Da chiamare DOPO operazioni distruttive che modificano lo stato sottostante (Reset KPI,
// cambio cutoff `ads_history_start`, sync forzato da source esterna), così il prossimo
// `getCreativePerformance`/`getMetaHierarchy` rifa la query al DB invece di servire il cached.
export const clearAdsServerCache = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string }) => d)
  .handler(async ({ data }) => {
    const { userId } = await authenticate(data.accessToken);
    let cleared = 0;
    for (const k of [...SERVER_CACHE.keys()]) {
      if (
        k.startsWith(`creative-perf:${userId}:`) ||
        k.startsWith(`meta-hierarchy:${userId}`) ||
        k.startsWith(`ads-financials:${userId}:`)
      ) {
        SERVER_CACHE.delete(k);
        cleared++;
      }
    }
    return { ok: true, cleared };
  });

// ─────────────────────────────────────────────────────────
// 5) BACKFILL METRICHE VIDEO — riscarica TUTTO lo storico esistente
// ─────────────────────────────────────────────────────────
export const backfillMetaVideoMetrics = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string }) => d)
  .handler(async ({ data }) => {
    const { supabase, userId } = await authenticate(data.accessToken);

    const { data: cfg, error: cfgErr } = await supabase
      .from("tracking_config")
      .select("meta_ad_account_id, meta_access_token")
      .eq("user_id", userId)
      .maybeSingle();
    if (cfgErr) throw new Error(`Config: ${cfgErr.message}`);
    if (!cfg?.meta_ad_account_id || !cfg?.meta_access_token) {
      throw new Error("Configura Meta Ad Account ID e Access Token in Impostazioni.");
    }

    const { data: bounds } = await supabase
      .from("meta_ad_spend")
      .select("spend_date")
      .eq("user_id", userId)
      .order("spend_date", { ascending: true })
      .limit(1);
    const { data: boundsMax } = await supabase
      .from("meta_ad_spend")
      .select("spend_date")
      .eq("user_id", userId)
      .order("spend_date", { ascending: false })
      .limit(1);

    if (!bounds?.length || !boundsMax?.length) {
      return { ok: true, rows: 0, fetched: 0, batches: 0, range: null, message: "Nessuno storico da backfillare." };
    }

    const minDate = bounds[0].spend_date as string;
    const maxDate = boundsMax[0].spend_date as string;

    // Spezza in blocchi da 30g per non sforare i limiti Meta
    const startD = new Date(minDate);
    const endD = new Date(maxDate);
    const batches: { since: string; until: string }[] = [];
    let cur = new Date(startD);
    while (cur <= endD) {
      const batchEnd = new Date(cur);
      batchEnd.setDate(batchEnd.getDate() + 29);
      if (batchEnd > endD) batchEnd.setTime(endD.getTime());
      const iso = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      batches.push({ since: iso(cur), until: iso(batchEnd) });
      cur = new Date(batchEnd);
      cur.setDate(cur.getDate() + 1);
    }

    let totalUpserted = 0;
    let totalFetched = 0;
    const errors: string[] = [];

    for (const b of batches) {
      try {
        const rows = await fetchMetaInsights(cfg.meta_ad_account_id, cfg.meta_access_token, b.since, b.until);
        totalFetched += rows.length;
        const upserts = rows
          .filter((r) => r.ad_id && r.date_start)
          .map((r) => ({
            user_id: userId,
            spend_date: r.date_start!,
            ad_id: r.ad_id!,
            adset_id: r.adset_id ?? null,
            campaign_id: r.campaign_id ?? null,
            ad_name: r.ad_name ?? null,
            campaign_name: r.campaign_name ?? null,
            spend: Number(r.spend || 0),
            impressions: Number(r.impressions || 0),
            clicks: Number(r.clicks || 0),
            reach: Math.round(Number(r.reach || 0)),
            frequency: Number(r.frequency || 0),
            video_plays: Math.round(sumAction(r.video_play_actions)),
            video_p25_watched: Math.round(sumAction(r.video_p25_watched_actions)),
            video_p50_watched: Math.round(sumAction(r.video_p50_watched_actions)),
            video_p75_watched: Math.round(sumAction(r.video_p75_watched_actions)),
            video_p100_watched: Math.round(sumAction(r.video_p100_watched_actions)),
            video_thruplays: Math.round(sumAction(r.video_thruplay_watched_actions)),
            video_3_sec_watched: Math.round(sumAction(r.actions, "video_view")),
            video_15_sec_watched: Math.round(sumAction(r.video_15_sec_watched_actions)),
            video_avg_time_watched: sumAction(r.video_avg_time_watched_actions),
            video_continuous_2_sec_watched: 0,
            outbound_clicks: Math.round(sumAction(r.outbound_clicks, "outbound_click")),
            link_clicks: Math.round(sumAction(r.actions, "link_click")),
            post_engagement: Math.round(sumAction(r.actions, "post_engagement")),
            landing_page_views: Math.round(sumAction(r.actions, "landing_page_view")),
            fetched_at: new Date().toISOString(),
          }));

        if (upserts.length > 0) {
          // Per il backfill: MAX() su spend/impr/clicks (preserva picchi),
          // overwrite sui nuovi campi video (non c'erano prima)
          const dates = [...new Set(upserts.map((u) => u.spend_date))];
          const adIds = [...new Set(upserts.map((u) => u.ad_id))];
          const { data: existing } = await supabase
            .from("meta_ad_spend")
            .select("ad_id, spend_date, spend, impressions, clicks")
            .eq("user_id", userId)
            .in("spend_date", dates)
            .in("ad_id", adIds);
          const existMap = new Map<string, { spend: number; impressions: number; clicks: number }>();
          for (const r of existing ?? []) {
            existMap.set(`${r.spend_date}|${r.ad_id}`, {
              spend: Number(r.spend || 0),
              impressions: Number(r.impressions || 0),
              clicks: Number(r.clicks || 0),
            });
          }
          const merged = upserts.map((u) => {
            const prev = existMap.get(`${u.spend_date}|${u.ad_id}`);
            if (!prev) return u;
            return {
              ...u,
              spend: Math.max(u.spend, prev.spend),
              impressions: Math.max(u.impressions, prev.impressions),
              clicks: Math.max(u.clicks, prev.clicks),
            };
          });
          const { error: upErr, count } = await supabase
            .from("meta_ad_spend")
            .upsert(merged, { onConflict: "user_id,spend_date,ad_id", count: "exact" });
          if (upErr) {
            errors.push(`${b.since}→${b.until}: ${upErr.message}`);
          } else {
            totalUpserted += count ?? merged.length;
          }
        }
      } catch (e) {
        errors.push(`${b.since}→${b.until}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    return {
      ok: errors.length === 0,
      rows: totalUpserted,
      fetched: totalFetched,
      batches: batches.length,
      range: `${minDate} → ${maxDate}`,
      errors: errors.length > 0 ? errors : undefined,
    };
  });

// ─────────────────────────────────────────────────────────
// 6) META HIERARCHY + CREATIVES — campagne, adset, ads + creative
// ─────────────────────────────────────────────────────────
interface MetaCreative {
  id?: string;
  name?: string;
  thumbnail_url?: string;
  image_url?: string;
  video_id?: string;
  body?: string;
  title?: string;
  call_to_action_type?: string;
  object_story_spec?: {
    link_data?: {
      link?: string;
      message?: string;
      name?: string;
      description?: string;
      caption?: string;
      picture?: string;
      call_to_action?: { type?: string; value?: { link?: string } };
    };
    video_data?: {
      video_id?: string;
      message?: string;
      title?: string;
      image_url?: string;
      call_to_action?: { type?: string; value?: { link?: string } };
    };
  };
  effective_object_story_id?: string;
}

interface MetaAdNode {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  adset_id: string;
  campaign_id: string;
  creative?: MetaCreative;
}

// ─────────── In-memory server cache per evitare di saturare Meta ───────────
// Vive nel processo Worker; condiviso tra utenti diversi grazie alla chiave per userId.
// TTL differenziati: hierarchy (campagne/adset/ads) cambia raramente → 15 min;
// performance (numeri spesa/lead) → 5 min.
type CacheEntry<T> = { value: T; expiresAt: number; cachedAt: number };
const SERVER_CACHE = new Map<string, CacheEntry<unknown>>();
const SERVER_CACHE_TTL_MS = 5 * 60 * 1000;
const SERVER_CACHE_TTL_HIERARCHY_MS = 15 * 60 * 1000;

// Cache PERSISTENTE per i creative payloads di Meta — chiavata su creative_id
// (NON su userId/range). Le creative cambiano raramente (immagine/copy/video),
// quindi una volta scaricate le riusiamo per 24h indipendentemente dal range
// selezionato. Questo elimina il collo di bottiglia principale: scaricare
// 100-500 creative payloads ad ogni cambio data (15-60s → near-zero).
type CreativePayload = {
  id: string; name?: string; thumbnail_url?: string; image_url?: string;
  body?: string; title?: string; call_to_action_type?: string;
  object_story_spec?: unknown; effective_object_story_id?: string;
};
const CREATIVE_CACHE = new Map<string, { value: CreativePayload; expiresAt: number }>();
const CREATIVE_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
function getCachedCreative(id: string): CreativePayload | null {
  const hit = CREATIVE_CACHE.get(id);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) { CREATIVE_CACHE.delete(id); return null; }
  return hit.value;
}
function setCachedCreative(id: string, value: CreativePayload) {
  CREATIVE_CACHE.set(id, { value, expiresAt: Date.now() + CREATIVE_CACHE_TTL_MS });
  // GC se oltre 2000 entries
  if (CREATIVE_CACHE.size > 2000) {
    const now = Date.now();
    for (const [k, v] of CREATIVE_CACHE) if (v.expiresAt <= now) CREATIVE_CACHE.delete(k);
  }
}

// Cache per i metadati dei video Meta (durata + nome file caricato).
// Chiave = video_id, TTL 24h. I video Meta non cambiano nome/durata una volta caricati.
type VideoMeta = { id: string; length: number | null; title: string | null };
const VIDEO_META_CACHE = new Map<string, { value: VideoMeta; expiresAt: number }>();
function getCachedVideoMeta(id: string): VideoMeta | null {
  const hit = VIDEO_META_CACHE.get(id);
  if (!hit) return null;
  if (hit.expiresAt <= Date.now()) { VIDEO_META_CACHE.delete(id); return null; }
  return hit.value;
}
function setCachedVideoMeta(id: string, value: VideoMeta) {
  VIDEO_META_CACHE.set(id, { value, expiresAt: Date.now() + CREATIVE_CACHE_TTL_MS });
  if (VIDEO_META_CACHE.size > 2000) {
    const now = Date.now();
    for (const [k, v] of VIDEO_META_CACHE) if (v.expiresAt <= now) VIDEO_META_CACHE.delete(k);
  }
}

interface CachedResult<T> { value: T; cachedAt: number; isStale: boolean }

async function withServerCache<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<CachedResult<T>> {
  const now = Date.now();
  const hit = SERVER_CACHE.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > now) return { value: hit.value, cachedAt: hit.cachedAt, isStale: false };
  try {
    const value = await fetcher();
    // Conserviamo expiresAt come "fresh until"; il valore resta in mappa anche dopo,
    // così possiamo servirlo come stale-fallback se Meta blocca.
    SERVER_CACHE.set(key, { value, expiresAt: now + ttlMs, cachedAt: now });
    if (SERVER_CACHE.size > 200) {
      // rimuoviamo solo entries molto vecchie (> 1h oltre la scadenza)
      for (const [k, v] of SERVER_CACHE) if (v.expiresAt + 60 * 60 * 1000 <= now) SERVER_CACHE.delete(k);
    }
    return { value, cachedAt: now, isStale: false };
  } catch (err) {
    // Stale-while-error: se Meta blocca per rate limit ma abbiamo dati vecchi, serviamoli
    if (hit) {
      console.warn(`[withServerCache] serving stale for ${key}: ${err instanceof Error ? err.message : String(err)}`);
      return { value: hit.value, cachedAt: hit.cachedAt, isStale: true };
    }
    throw err;
  }
}

function isMetaRateLimit(err?: { message?: string; code?: number; error_subcode?: number }): boolean {
  if (!err) return false;
  if (err.code === 4 || err.code === 17 || err.code === 32 || err.code === 613) return true;
  if (err.error_subcode === 2446079) return true;
  return /rate limit|user request limit|too many calls|throttled/i.test(err.message || "");
}

async function metaFetchWithRetry(url: string, init?: RequestInit, maxAttempts = 4): Promise<Response> {
  let attempt = 0;
  let lastErr: unknown = null;
  while (attempt < maxAttempts) {
    const r = await fetch(url, init);
    if (r.ok) return r;
    const cloned = r.clone();
    let parsed: { error?: { message?: string; code?: number; error_subcode?: number } } = {};
    try { parsed = await cloned.json(); } catch { /* not JSON */ }
    const rateLimited = r.status === 429 || r.status === 613 || isMetaRateLimit(parsed.error);
    if (!rateLimited) return r;
    const msg = parsed.error?.message || "";
    // "User request limit reached" è un blocco lungo (ore) → inutile martellare a lungo dentro la stessa request
    const isUserLimit = /user request limit/i.test(msg);
    // Backoff in secondi: user-limit più breve (falliamo presto e usiamo cache stale), altri errori più lungo
    const schedule = isUserLimit ? [3000, 8000, 15000] : [5000, 15000, 30000, 60000];
    const waitMs = schedule[attempt] ?? schedule[schedule.length - 1];
    lastErr = msg || `HTTP ${r.status}`;
    await new Promise((res) => setTimeout(res, waitMs));
    attempt++;
  }
  throw new Error(`Meta rate limit dopo ${maxAttempts} tentativi: ${lastErr}`);
}

async function metaPaged<T>(url: string): Promise<T[]> {
  const all: T[] = [];
  let next: string | undefined = url;
  let pages = 0;
  while (next && pages < 20) {
    const r = await metaFetchWithRetry(next);
    const txt = await r.text();
    let json: { data?: T[]; paging?: { next?: string }; error?: { message?: string; code?: number } };
    try { json = JSON.parse(txt); }
    catch { throw new Error(`Meta API: ${txt.slice(0, 200)}`); }
    if (!r.ok || json.error) throw new Error(json.error?.message || `Meta API ${r.status}`);
    all.push(...(json.data ?? []));
    next = json.paging?.next;
    pages++;
    // Small delay between pages to be nice to Meta
    if (next) await new Promise((res) => setTimeout(res, 250));
  }
  return all;
}

export const getMetaHierarchy = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; bypassCache?: boolean; sinceISO?: string; untilISO?: string }) => d)
  .handler(async ({ data }) => {
    const { supabase, userId } = await authenticate(data.accessToken);
    const rangeKey = data.sinceISO && data.untilISO
      ? `${data.sinceISO.slice(0, 10)}_${data.untilISO.slice(0, 10)}`
      : "all";
    const cacheKey = `meta-hierarchy:${userId}:${rangeKey}`;
    if (data.bypassCache) SERVER_CACHE.delete(cacheKey);
    const __cached = await withServerCache(cacheKey, SERVER_CACHE_TTL_HIERARCHY_MS, async () => {
    const { data: cfg } = await supabase
      .from("tracking_config")
      .select("meta_ad_account_id, meta_access_token")
      .eq("user_id", userId)
      .maybeSingle();
    if (!cfg?.meta_ad_account_id || !cfg?.meta_access_token) {
      throw new Error("Configura Meta Ad Account ID e Access Token in Impostazioni.");
    }
    const acct = cfg.meta_ad_account_id.startsWith("act_") ? cfg.meta_ad_account_id : `act_${cfg.meta_ad_account_id}`;
    const tok = cfg.meta_access_token;
    const base = "https://graph.facebook.com/v19.0";

    const campaigns = await metaPaged<{ id: string; name: string; status: string; effective_status: string; objective: string; daily_budget?: string; lifetime_budget?: string }>(
      `${base}/${acct}/campaigns?fields=id,name,status,effective_status,objective,daily_budget,lifetime_budget&limit=100&access_token=${tok}`,
    );
    const adsets = await metaPaged<{ id: string; name: string; status: string; effective_status: string; campaign_id: string; daily_budget?: string; lifetime_budget?: string; optimization_goal?: string }>(
      `${base}/${acct}/adsets?fields=id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget,optimization_goal&limit=100&access_token=${tok}`,
    );
    // Step 1: light list of ads (no heavy creative payload) to avoid Meta "reduce amount of data" errors
    const adsLight = await metaPaged<{ id: string; name: string; status: string; effective_status: string; adset_id: string; campaign_id: string; creative?: { id: string } }>(
      `${base}/${acct}/ads?fields=id,name,status,effective_status,adset_id,campaign_id,creative{id}&limit=100&access_token=${tok}`,
    );

    // Cutoff "Data inizio storico ads" + filtro periodo opzionale.
    // IMPORTANTE: applichiamo il filtro PRIMA del fetch dei creative (Step 2),
    // così evitiamo di scaricare centinaia di payload pesanti per ad che poi
    // verrebbero comunque scartate. Questo è il principale collo di bottiglia
    // (15-60s a fronte di ~5s per la sola lista ads).
    const cutoff = await getAdsHistoryStart(supabase, userId);
    let allowedAdIds: Set<string> | null = null;
    let allowedAdsetIds: Set<string> | null = null;
    let allowedCampaignIds: Set<string> | null = null;
    const sinceFilter = data.sinceISO ? data.sinceISO.slice(0, 10) : cutoff;
    const untilFilter = data.untilISO ? data.untilISO.slice(0, 10) : null;
    if (sinceFilter || untilFilter) {
      let q = supabase
        .from("meta_ad_spend")
        .select("ad_id, adset_id, campaign_id")
        .eq("user_id", userId)
        .gt("spend", 0);
      if (sinceFilter) q = q.gte("spend_date", sinceFilter);
      if (untilFilter) q = q.lte("spend_date", untilFilter);
      const { data: spentRows } = await q;
      allowedAdIds = new Set();
      allowedAdsetIds = new Set();
      allowedCampaignIds = new Set();
      for (const r of spentRows ?? []) {
        if (r.ad_id) allowedAdIds.add(r.ad_id);
        if (r.adset_id) allowedAdsetIds.add(r.adset_id);
        if (r.campaign_id) allowedCampaignIds.add(r.campaign_id);
      }
    }

    // Step 2: fetch creative details SOLO per ads attive nel periodo (se filtro attivo).
    // In parallelo invece che sequenziale (era il principale collo di bottiglia).
    const adsToFetchCreatives = allowedAdIds
      ? adsLight.filter((a) => allowedAdIds!.has(a.id))
      : adsLight;
    // PRE-FILTRO: rimuovi dai creativi da fetchare quelli già in CREATIVE_CACHE.
    // Le creative non cambiano col refresh dei dati spend, quindi le riusiamo
    // anche con bypassCache=true. Questo è il fix principale per il "riscarica
    // sempre i video Meta": se l'inserzione è la stessa, non rifetchiamo.
    const creativeIds = Array.from(new Set(adsToFetchCreatives.map((a) => a.creative?.id).filter(Boolean))) as string[];
    const creativeMap = new Map<string, CreativePayload>();
    const idsToFetch: string[] = [];
    for (const id of creativeIds) {
      const cached = getCachedCreative(id);
      if (cached) creativeMap.set(id, cached);
      else idsToFetch.push(id);
    }
    const CHUNK = 40;
    const batches: string[][] = [];
    for (let i = 0; i < idsToFetch.length; i += CHUNK) {
      batches.push(idsToFetch.slice(i, i + CHUNK));
    }
    await Promise.all(batches.map(async (chunk) => {
      const batch = chunk.map((id) => ({
        method: "GET",
        relative_url: `${id}?fields=id,name,thumbnail_url,image_url,body,title,call_to_action_type,object_story_spec,effective_object_story_id`,
      }));
      try {
        const r = await metaFetchWithRetry(`${base}/`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ access_token: tok, batch: JSON.stringify(batch) }),
        });
        const j: Array<{ code: number; body: string } | null> = await r.json();
        if (Array.isArray(j)) {
          for (const item of j) {
            if (!item || item.code !== 200) continue;
            try {
              const parsed = JSON.parse(item.body) as CreativePayload;
              if (parsed?.id) {
                creativeMap.set(parsed.id, parsed);
                setCachedCreative(parsed.id, parsed);
              }
            } catch {}
          }
        }
      } catch (e) {
        console.warn("[getMetaHierarchy] creative batch failed", e);
      }
    }));

    const ads: MetaAdNode[] = adsLight.map((a) => ({
      ...a,
      creative: a.creative?.id ? (creativeMap.get(a.creative.id) || { id: a.creative.id }) : undefined,
    })) as MetaAdNode[];

    // Step 3: per le creative video, fetcho durata + nome file originale.
    // Cache 24h su VIDEO_META_CACHE: i video Meta non cambiano una volta caricati.
    const videoIds = new Set<string>();
    for (const a of ads) {
      const vid = a.creative?.object_story_spec?.video_data?.video_id;
      if (vid) videoIds.add(vid);
    }
    const videoMetaMap = new Map<string, VideoMeta>();
    const videoIdsToFetch: string[] = [];
    for (const vid of videoIds) {
      const cached = getCachedVideoMeta(vid);
      if (cached) videoMetaMap.set(vid, cached);
      else videoIdsToFetch.push(vid);
    }
    const VCHUNK = 40;
    const vBatches: string[][] = [];
    for (let i = 0; i < videoIdsToFetch.length; i += VCHUNK) {
      vBatches.push(videoIdsToFetch.slice(i, i + VCHUNK));
    }
    await Promise.all(vBatches.map(async (chunk) => {
      const batch = chunk.map((id) => ({
        method: "GET",
        relative_url: `${id}?fields=id,length,title`,
      }));
      try {
        const r = await metaFetchWithRetry(`${base}/`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ access_token: tok, batch: JSON.stringify(batch) }),
        });
        const j: Array<{ code: number; body: string } | null> = await r.json();
        if (Array.isArray(j)) {
          for (const item of j) {
            if (!item || item.code !== 200) continue;
            try {
              const parsed = JSON.parse(item.body) as { id: string; length?: number; title?: string };
              if (parsed?.id) {
                const meta: VideoMeta = {
                  id: parsed.id,
                  length: typeof parsed.length === "number" ? parsed.length : null,
                  title: parsed.title || null,
                };
                videoMetaMap.set(parsed.id, meta);
                setCachedVideoMeta(parsed.id, meta);
              }
            } catch {}
          }
        }
      } catch (e) {
        console.warn("[getMetaHierarchy] video meta batch failed", e);
      }
    }));

    return {
      ok: true,
      cutoff,
      campaigns: campaigns
        .filter((c) => !allowedCampaignIds || allowedCampaignIds.has(c.id))
        .map((c) => ({
          id: c.id, name: c.name, status: c.effective_status || c.status,
          objective: c.objective,
          budget: Number(c.daily_budget || c.lifetime_budget || 0) / 100,
          budgetType: c.daily_budget ? "daily" : c.lifetime_budget ? "lifetime" : null,
        })),
      adsets: adsets
        .filter((a) => !allowedAdsetIds || allowedAdsetIds.has(a.id))
        .map((a) => ({
          id: a.id, name: a.name, status: a.effective_status || a.status,
          campaign_id: a.campaign_id,
          optimization: a.optimization_goal || null,
          budget: Number(a.daily_budget || a.lifetime_budget || 0) / 100,
          budgetType: a.daily_budget ? "daily" : a.lifetime_budget ? "lifetime" : null,
        })),
      ads: ads
        .filter((a) => !allowedAdIds || allowedAdIds.has(a.id))
        .map((a) => {
          const c = a.creative;
          const ld = c?.object_story_spec?.link_data;
          const vd = c?.object_story_spec?.video_data;
          const videoId = vd?.video_id;
          const vmeta = videoId ? videoMetaMap.get(videoId) || null : null;
          return {
            id: a.id, name: a.name, status: a.effective_status || a.status,
            adset_id: a.adset_id, campaign_id: a.campaign_id,
            creative: c ? {
              id: c.id,
              thumbnail: c.thumbnail_url || c.image_url || ld?.picture || vd?.image_url || null,
              title: c.title || ld?.name || vd?.title || null,
              body: c.body || ld?.message || vd?.message || null,
              description: ld?.description || null,
              link: ld?.link || ld?.call_to_action?.value?.link || vd?.call_to_action?.value?.link || null,
              cta: c.call_to_action_type || ld?.call_to_action?.type || vd?.call_to_action?.type || null,
              isVideo: Boolean(vd?.video_id),
              videoDuration: vmeta?.length ?? null,
              videoFileName: vmeta?.title ?? null,
            } : null,
          };
        }),
    };
    });
    return { ...__cached.value, _cachedAt: __cached.cachedAt, _isStale: __cached.isStale };
  });

// ─────────────────────────────────────────────────────────
// 6) UPDATE AD NAME — modifica reale via Meta API
// ─────────────────────────────────────────────────────────
export const updateAdName = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; adId: string; name: string }) => d)
  .handler(async ({ data }) => {
    const { supabase, userId } = await authenticate(data.accessToken);
    const { data: cfg } = await supabase
      .from("tracking_config").select("meta_access_token").eq("user_id", userId).maybeSingle();
    if (!cfg?.meta_access_token) throw new Error("Token Meta non configurato.");
    const r = await fetch(`https://graph.facebook.com/v19.0/${data.adId}`, {
      method: "POST",
      body: new URLSearchParams({ name: data.name, access_token: cfg.meta_access_token }),
    });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error?.message || `Meta API ${r.status}`);
    return { ok: true };
  });

// ─────────────────────────────────────────────────────────
// 7) DUPLICATE AD — copia un'inserzione esistente
// ─────────────────────────────────────────────────────────
export const duplicateAd = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; adId: string; newName?: string }) => d)
  .handler(async ({ data }) => {
    const { supabase, userId } = await authenticate(data.accessToken);
    const { data: cfg } = await supabase
      .from("tracking_config").select("meta_access_token").eq("user_id", userId).maybeSingle();
    if (!cfg?.meta_access_token) throw new Error("Token Meta non configurato.");
    const tok = cfg.meta_access_token;
    // Endpoint copies: https://graph.facebook.com/v19.0/{ad_id}/copies
    const params = new URLSearchParams({ access_token: tok, status_option: "PAUSED" });
    if (data.newName) params.set("rename_options", JSON.stringify({ rename_suffix: ` — ${data.newName}` }));
    const r = await fetch(`https://graph.facebook.com/v19.0/${data.adId}/copies`, {
      method: "POST", body: params,
    });
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error?.message || `Meta API ${r.status}`);
    return { ok: true, copied_ad_id: j.copied_ad_id || j.ad_id || null, raw: j };
  });

// ─────────────────────────────────────────────────────────
// 8) POST ENGAGEMENT — reazioni, commenti, share del post collegato
// ─────────────────────────────────────────────────────────
export const getPostEngagement = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; adId: string }) => d)
  .handler(async ({ data }) => {
    const { supabase, userId } = await authenticate(data.accessToken);
    const { data: cfg } = await supabase
      .from("tracking_config").select("meta_access_token").eq("user_id", userId).maybeSingle();
    if (!cfg?.meta_access_token) throw new Error("Token Meta non configurato.");
    const tok = cfg.meta_access_token;
    const base = "https://graph.facebook.com/v19.0";
    // 1) prendi creative -> effective_object_story_id
    const adRes = await fetch(`${base}/${data.adId}?fields=creative{effective_object_story_id,object_story_id}&access_token=${tok}`);
    const adJ = await adRes.json();
    const postId: string | null = adJ?.creative?.effective_object_story_id || adJ?.creative?.object_story_id || null;
    if (!postId) return { ok: false, error: "Post collegato non disponibile per questa ads.", reactions: null, comments: [], shares: 0, postId: null };
    // 2) summary reazioni e commenti
    const fields = [
      "shares",
      "reactions.type(LIKE).limit(0).summary(total_count).as(like)",
      "reactions.type(LOVE).limit(0).summary(total_count).as(love)",
      "reactions.type(WOW).limit(0).summary(total_count).as(wow)",
      "reactions.type(HAHA).limit(0).summary(total_count).as(haha)",
      "reactions.type(SAD).limit(0).summary(total_count).as(sad)",
      "reactions.type(ANGRY).limit(0).summary(total_count).as(angry)",
      "comments.limit(15).order(reverse_chronological){id,from{name},message,created_time,like_count}",
    ].join(",");
    const r = await fetch(`${base}/${postId}?fields=${encodeURIComponent(fields)}&access_token=${tok}`);
    const j = await r.json();
    if (!r.ok || j.error) {
      return { ok: false, error: j.error?.message || `Meta API ${r.status}`, reactions: null, comments: [], shares: 0, postId };
    }
    const reactions = {
      like: j.like?.summary?.total_count ?? 0,
      love: j.love?.summary?.total_count ?? 0,
      wow: j.wow?.summary?.total_count ?? 0,
      haha: j.haha?.summary?.total_count ?? 0,
      sad: j.sad?.summary?.total_count ?? 0,
      angry: j.angry?.summary?.total_count ?? 0,
    };
    const comments = (j.comments?.data || []).map((c: any) => ({
      id: c.id,
      from: c.from?.name || "Utente",
      message: c.message || "",
      created_time: c.created_time,
      like_count: c.like_count || 0,
    }));
    const shares = j.shares?.count ?? 0;
    return { ok: true, postId, reactions, comments, shares };
  });

// ─────────────────────────────────────────────────────────
// 9) AI INSIGHTS — OpenRouter analizza KPI ad
// ─────────────────────────────────────────────────────────
export const generateAdInsights = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; adName: string; kpis: Record<string, number | null> }) => d)
  .handler(async ({ data }) => {
    await authenticate(data.accessToken);
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OpenRouter non configurato (manca OPENROUTER_API_KEY).");
    const sys = `Sei un media buyer senior esperto di Meta Ads. Analizzi KPI di un'inserzione e generi suggerimenti azionabili in italiano. Risposta JSON con array "insights" di 3 oggetti {title, severity (good|warn|bad), reason, action}. Sii concreto e specifico (es. "Hook rate 12% basso, prova 3s con domanda diretta").`;
    const usr = `Inserzione: ${data.adName}\nKPI:\n${JSON.stringify(data.kpis, null, 2)}\n\nGenera 3 insights prioritari per migliorare le performance.`;
    const tools = [{
      type: "function",
      function: {
        name: "return_insights",
        description: "Ritorna 3 insights concreti",
        parameters: {
          type: "object",
          properties: {
            insights: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  severity: { type: "string", enum: ["good", "warn", "bad"] },
                  reason: { type: "string" },
                  action: { type: "string" },
                },
                required: ["title", "severity", "reason", "action"],
                additionalProperties: false,
              },
            },
          },
          required: ["insights"],
          additionalProperties: false,
        },
      },
    }];
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: usr }],
        tools, tool_choice: { type: "function", function: { name: "return_insights" } },
      }),
    });
    if (res.status === 429) throw new Error("Rate limit AI superato, riprova fra poco.");
    if (res.status === 402) throw new Error("Crediti AI esauriti. Aggiungi credito in Settings → Workspace → Usage.");
    if (!res.ok) throw new Error(`AI Gateway ${res.status}`);
    const j = await res.json();
    const args = j.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("Risposta AI vuota.");
    const parsed = JSON.parse(args);
    return { ok: true, insights: parsed.insights as Array<{ title: string; severity: "good"|"warn"|"bad"; reason: string; action: string }> };
  });

// ─────────────────────────────────────────────────────────
// 10) DEEP ANALYSIS PER SINGOLA AD — KPI + confronto periodo precedente
//     + multi-touch attribution + allarme stanchezza creativa
// ─────────────────────────────────────────────────────────
interface DeepKPI {
  current: number;
  previous: number;
  delta: number;       // diff assoluta
  deltaPct: number;    // % cambiamento (positiva = current > previous)
}

function deepKpi(current: number, previous: number): DeepKPI {
  const delta = current - previous;
  const deltaPct = previous > 0 ? (delta / previous) * 100 : (current > 0 ? 100 : 0);
  return { current, previous, delta, deltaPct };
}

function readLpPayloadNumber(payload: unknown, key: string): number | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>)[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getLpEventScroll(event: { max_scroll: number | null; payload?: unknown }) {
  return event.max_scroll ?? readLpPayloadNumber(event.payload, "max_scroll") ?? readLpPayloadNumber(event.payload, "scroll") ?? 0;
}

function getLpEventTime(event: { event_name: string; time_on_page: number | null; payload?: unknown }) {
  return event.time_on_page
    ?? readLpPayloadNumber(event.payload, "time_on_page")
    ?? (event.event_name === "Heartbeat" ? readLpPayloadNumber(event.payload, "elapsed") : null)
    ?? 0;
}

export const getAdDeepAnalysis = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; adId: string; sinceISO: string; untilISO: string }) => d)
  .handler(async ({ data }) => {
    const { supabase, userId } = await authenticate(data.accessToken);
    const since = new Date(data.sinceISO);
    const until = new Date(data.untilISO);
    const rangeMs = until.getTime() - since.getTime();
    // Periodo precedente: stessa lunghezza, immediatamente prima
    const prevUntil = new Date(since.getTime());
    const prevSince = new Date(since.getTime() - rangeMs);
    const cutoff = await getAdsHistoryStart(supabase, userId);
    const sinceDate = clampSince(data.sinceISO.slice(0, 10), cutoff);
    const untilDate = data.untilISO.slice(0, 10);
    const prevSinceDate = clampSince(prevSince.toISOString().slice(0, 10), cutoff);
    const prevUntilDate = clampSince(prevUntil.toISOString().slice(0, 10), cutoff);

    // 1) Spese Meta — corrente + precedente (incluse metriche video, traffico, engagement social)
    const SPEND_COLS = "spend, impressions, clicks, reach, frequency, spend_date, video_plays, video_p25_watched, video_p50_watched, video_p75_watched, video_p100_watched, video_thruplays, video_3_sec_watched, video_15_sec_watched, video_avg_time_watched, video_continuous_2_sec_watched, outbound_clicks, link_clicks, landing_page_views, post_engagement";
    const { data: spendCur } = await supabase
      .from("meta_ad_spend")
      .select(SPEND_COLS)
      .eq("user_id", userId)
      .eq("ad_id", data.adId)
      .gte("spend_date", sinceDate)
      .lte("spend_date", untilDate);
    const { data: spendPrev } = await supabase
      .from("meta_ad_spend")
      .select(SPEND_COLS)
      .eq("user_id", userId)
      .eq("ad_id", data.adId)
      .gte("spend_date", prevSinceDate)
      .lt("spend_date", sinceDate);

    function aggSpend(rows: { spend: number; impressions: number; clicks: number; reach: number; frequency: number; video_plays?: number; video_p25_watched?: number; video_p50_watched?: number; video_p75_watched?: number; video_p100_watched?: number; video_thruplays?: number; video_3_sec_watched?: number; video_15_sec_watched?: number; video_avg_time_watched?: number; video_continuous_2_sec_watched?: number; outbound_clicks?: number; link_clicks?: number; landing_page_views?: number; post_engagement?: number; spend_date?: string }[] | null) {
      let spend = 0, impressions = 0, clicks = 0, reach = 0;
      let freqSum = 0, freqDays = 0;
      let vPlays = 0, v25 = 0, v50 = 0, v75 = 0, v100 = 0, vThru = 0;
      let v3sec = 0, vCont2 = 0;
      let outboundClicks = 0, linkClicks = 0, lpv = 0, postEng = 0;
      for (const r of rows ?? []) {
        spend += Number(r.spend || 0);
        impressions += Number(r.impressions || 0);
        clicks += Number(r.clicks || 0);
        reach += Number(r.reach || 0);
        const f = Number(r.frequency || 0);
        if (f > 0) { freqSum += f; freqDays++; }
        vPlays += Number(r.video_plays || 0);
        v25 += Number(r.video_p25_watched || 0);
        v50 += Number(r.video_p50_watched || 0);
        v75 += Number(r.video_p75_watched || 0);
        v100 += Number(r.video_p100_watched || 0);
        vThru += Number(r.video_thruplays || 0);
        v3sec += Number(r.video_3_sec_watched || 0);
        vCont2 += Number(r.video_continuous_2_sec_watched || 0);
        outboundClicks += Number(r.outbound_clicks || 0);
        linkClicks += Number(r.link_clicks || 0);
        lpv += Number(r.landing_page_views || 0);
        postEng += Number(r.post_engagement || 0);
      }
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const frequency = freqDays > 0 ? freqSum / freqDays : 0;
      // Video — formule centralizzate (single source of truth)
      const videoViews = computeVideoViews(v3sec, v25);
      const denomPlays = vPlays > 0 ? vPlays : (videoViews > 0 ? videoViews : impressions);
      const hookRate = computeHookRate(videoViews, denomPlays);
      const thumbstopRate = computeThumbstopRate(videoViews, vCont2, hookRate);
      const _vr2 = computeViewRates(v25, v50, v75, v100, videoViews);
      const view25Rate = _vr2.view25Rate;
      const view50Rate = _vr2.view50Rate;
      const view75Rate = _vr2.view75Rate;
      const completionRate = _vr2.view100Rate;
      const holdRate = computeHoldRate(vThru, videoViews);
      const thruRate = holdRate; // alias per retro-compat
      const holdRateVsPlay = computeThruRate(vThru, denomPlays);
      // Real Attention Frequency = thruplays / reach
      const realAttentionFreq = reach > 0 ? vThru / reach : 0;
      // Traffico
      const ctrOutbound = impressions > 0 ? (outboundClicks / impressions) * 100 : 0;
      const ctrLink = impressions > 0 ? (linkClicks / impressions) * 100 : 0;
      const lpIntentRate = outboundClicks > 0 ? (lpv / outboundClicks) * 100 : 0;
      const lpViewRate = linkClicks > 0 ? (lpv / linkClicks) * 100 : 0;
      const lpvFreq = reach > 0 ? lpv / reach : 0;
      const stdFrequency = reach > 0 ? impressions / reach : frequency;
      const realEngRate = reach > 0 ? (postEng / reach) * 100 : 0;
      return {
        spend, impressions, clicks, reach, cpm, ctr, frequency,
        vPlays, v25, v50, v75, v100, vThru, v3sec: videoViews, vCont2,
        denomPlays, denomViews: videoViews,
        outboundClicks, linkClicks, lpv, postEng,
        thumbstopRate, hookRate, view25Rate, view50Rate, view75Rate, holdRate, holdRateVsPlay, completionRate, thruRate,
        realAttentionFreq, ctrOutbound, ctrLink, lpIntentRate, lpViewRate, lpvFreq, stdFrequency, realEngRate,
      };
    }
    const aCur = aggSpend(spendCur);
    const aPrev = aggSpend(spendPrev);

    // Storico globale dell'ad (lifetime) — utile per spiegare quando il range
    // selezionato non contiene attività ma l'ad ne ha avuta in altri periodi.
    const { data: lifetimeRows } = await supabase
      .from("meta_ad_spend")
      .select("spend_date, spend")
      .eq("user_id", userId)
      .eq("ad_id", data.adId)
      .gt("spend", 0)
      .order("spend_date", { ascending: true });
    let lifetimeSpend = 0;
    let firstActivity: string | null = null;
    let lastActivity: string | null = null;
    for (const r of lifetimeRows ?? []) {
      lifetimeSpend += Number(r.spend || 0);
      if (!firstActivity) firstActivity = r.spend_date as string;
      lastActivity = r.spend_date as string;
    }
    const historyMeta = {
      hasDataInRange: aCur.spend > 0 || aCur.impressions > 0,
      lifetimeSpend,
      firstActivity,
      lastActivity,
      activeDays: lifetimeRows?.length ?? 0,
    };

    // 2) lp_events — qualità + sessioni
    // MATCHING: usiamo sia ad_id (taggato dal nostro tracker) sia gli UTM Meta
    // (utm_id/utm_content), che Meta popola automaticamente con l'ID inserzione
    // tramite i dynamic params {{ad.id}}. Questo recupera anche le sessioni
    // arrivate da link Meta dove il nostro ad_id non è stato propagato.
    const adIdFilter = `ad_id.eq.${data.adId},utm_id.eq.${data.adId},utm_content.eq.${data.adId}`;
    const { data: lpCur } = await supabase
      .from("lp_events")
      .select("event_name, session_id, max_scroll, time_on_page, payload, created_at")
      .or(adIdFilter)
      .eq("is_bot", false)
      .gte("created_at", data.sinceISO)
      .lte("created_at", data.untilISO)
      .limit(50000);
    const { data: lpPrev } = await supabase
      .from("lp_events")
      .select("event_name, session_id, max_scroll, time_on_page, payload, created_at")
      .or(adIdFilter)
      .eq("is_bot", false)
      .gte("created_at", prevSince.toISOString())
      .lt("created_at", data.sinceISO)
      .limit(50000);

    function aggLp(rows: typeof lpCur) {
      const sessions = new Set<string>();
      const pageViews = new Set<string>();
      // Per-session aggregato per calcolare bounce rate
      const perSession = new Map<string, { maxScroll: number; maxTime: number }>();
      for (const e of rows ?? []) {
        sessions.add(e.session_id);
        if (e.event_name === "PageView") pageViews.add(e.session_id);
        const ms = getLpEventScroll(e);
        const tp = getLpEventTime(e);
        const cur = perSession.get(e.session_id) || { maxScroll: 0, maxTime: 0 };
        if (ms > cur.maxScroll) cur.maxScroll = ms;
        if (tp > cur.maxTime) cur.maxTime = tp;
        perSession.set(e.session_id, cur);
      }
      // Bounce rate: % sessioni con scroll<25% E tempo<10s
      let bounced = 0;
      for (const v of perSession.values()) {
        if (v.maxScroll < 25 && v.maxTime < 10) bounced++;
      }
      const totSess = perSession.size;
      const sessionValues = [...perSession.values()];
      const avgScroll = totSess > 0 ? sessionValues.reduce((s, v) => s + v.maxScroll, 0) / totSess : 0;
      const avgTime = totSess > 0 ? sessionValues.reduce((s, v) => s + v.maxTime, 0) / totSess : 0;
      const bounceRate = totSess > 0 ? (bounced / totSess) * 100 : 0;
      return {
        sessions: sessions.size,
        pageViews: pageViews.size,
        avgScroll,
        avgTime,
        bounceRate,
      };
    }
    const lpCurAgg = aggLp(lpCur);
    const lpPrevAgg = aggLp(lpPrev);

    // 3) Lead — corrente + precedente (da public_leads)
    // Match anche su utm_id/utm_content per coerenza con lp_events.
    const { data: pubCur } = await supabase
      .from("public_leads")
      .select("id, email, telefono, ad_id, external_id, created_at, status")
      .or(adIdFilter)
      .gte("created_at", data.sinceISO)
      .lte("created_at", data.untilISO);
    const { data: pubPrev } = await supabase
      .from("public_leads")
      .select("id, email, telefono, ad_id, external_id, created_at")
      .or(adIdFilter)
      .gte("created_at", prevSince.toISOString())
      .lt("created_at", data.sinceISO);

    const leadsCurCount = (pubCur ?? []).length;
    const leadsPrevCount = (pubPrev ?? []).length;

    // 4) Multi-touch attribution — JOIN ESATTO via external_id (lovable_uid persistente
    // in localStorage). Lookback 90gg. Calcola first-click vs last-click per ogni lead.
    const journey: Array<{
      leadId: string;
      email: string;
      sessionsCount: number;
      distinctAds: number;
      adIds: string[];
      firstClickAdId: string | null;
      lastClickAdId: string;
      firstSeen: string | null;
      lastTouch: string;
      matchType: "uid" | "contact";
    }> = [];

    for (const lead of (pubCur ?? []).slice(0, 200)) {
      const leadDate = new Date(lead.created_at);
      const lookbackStart = new Date(leadDate.getTime() - 90 * 86400000);
      let relatedEvents: Array<{ session_id: string; ad_id: string | null; created_at: string }> | null = null;
      const matchType: "uid" | "contact" = "uid";

      if (lead.external_id) {
        const { data: byUid } = await supabase
          .from("lp_events")
          .select("session_id, ad_id, created_at")
          .eq("is_bot", false)
          .eq("external_id", lead.external_id)
          .gte("created_at", lookbackStart.toISOString())
          .lte("created_at", lead.created_at)
          .order("created_at", { ascending: true })
          .limit(500);
        relatedEvents = byUid ?? [];
      }

      if (!relatedEvents || relatedEvents.length === 0) {
        // Lead senza UID match: solo last-click (l'ad attuale)
        journey.push({
          leadId: lead.id, email: lead.email,
          sessionsCount: 1, distinctAds: 1, adIds: [data.adId],
          firstClickAdId: data.adId, lastClickAdId: data.adId,
          firstSeen: lead.created_at, lastTouch: lead.created_at, matchType: "contact",
        });
        continue;
      }
      const sessions = new Set(relatedEvents.map((e) => e.session_id));
      const adsList = relatedEvents.map((e) => e.ad_id).filter(Boolean) as string[];
      const ads = new Set(adsList);
      // First-click = primo ad_id non-null in ordine cronologico; Last-click = l'ad attuale (lead.ad_id)
      const firstClickAdId = adsList[0] || data.adId;
      const lastClickAdId = data.adId;
      journey.push({
        leadId: lead.id,
        email: lead.email,
        sessionsCount: sessions.size,
        distinctAds: ads.size || 1,
        adIds: [...ads],
        firstClickAdId,
        lastClickAdId,
        firstSeen: relatedEvents[0]?.created_at || null,
        lastTouch: relatedEvents[relatedEvents.length - 1]?.created_at || lead.created_at,
        matchType,
      });
    }
    const avgSessionsBeforeLead = journey.length > 0
      ? journey.reduce((s, j) => s + j.sessionsCount, 0) / journey.length
      : 0;
    const avgAdsBeforeLead = journey.length > 0
      ? journey.reduce((s, j) => s + j.distinctAds, 0) / journey.length
      : 0;
    const multiAdLeads = journey.filter((j) => j.distinctAds > 1).length;
    const uidMatchedLeads = journey.filter((j) => j.matchType === "uid").length;
    // Attribution model: questo ad come first-click vs last-click
    const firstClickLeads = journey.filter((j) => j.firstClickAdId === data.adId).length;
    const lastClickLeads = journey.filter((j) => j.lastClickAdId === data.adId).length;
    const assistLeads = journey.filter(
      (j) => j.adIds.includes(data.adId) && j.lastClickAdId !== data.adId,
    ).length;

    // 5) Allarme stanchezza creativa: ultimi 3 giorni vs media periodo
    const last3Cutoff = new Date(until.getTime() - 3 * 86400000);
    const last3Date = last3Cutoff.toISOString().slice(0, 10);
    const last3Spend = (spendCur ?? []).filter((r) => r.spend_date >= last3Date);
    const last3Freq = last3Spend.reduce((s, r) => s + Number(r.frequency || 0), 0)
      / Math.max(1, last3Spend.length);
    const last3Lp = (lpCur ?? []).filter((e) => new Date(e.created_at) >= last3Cutoff);
    const last3LpAgg = aggLp(last3Lp);
    const fatigueAlerts: string[] = [];
    if (last3Freq > 3.5) fatigueAlerts.push(`Frequenza ultimi 3gg: ${last3Freq.toFixed(2)} (>3.5 = audience saturata)`);
    if (last3LpAgg.avgScroll < 30 && lpCurAgg.avgScroll >= 30)
      fatigueAlerts.push(`Scroll medio crollato negli ultimi 3gg: ${last3LpAgg.avgScroll.toFixed(0)}% vs ${lpCurAgg.avgScroll.toFixed(0)}% del periodo`);
    if (last3LpAgg.avgTime < 15 && lpCurAgg.avgTime >= 15)
      fatigueAlerts.push(`Tempo medio sceso a ${last3LpAgg.avgTime.toFixed(0)}s negli ultimi 3gg`);

    // ───── 6) Score composito reale (0-100) ─────
    // Usa tutte le metriche disponibili nel periodo, normalizzate vs periodo precedente.
    // Pesi: Funnel 30%, Engagement LP 25%, Video 25%, Costi 20%.
    const cvrCur = lpCurAgg.sessions > 0 ? (leadsCurCount / lpCurAgg.sessions) * 100 : 0;
    const cvrPrev = lpPrevAgg.sessions > 0 ? (leadsPrevCount / lpPrevAgg.sessions) * 100 : 0;
    function compScore(): { score: number; breakdown: Array<{ label: string; weight: number; current: number; previous: number; better: boolean; goodHigh: boolean; subScore: number }> } {
      const items = [
        { label: "CVR (lead/sessioni)", weight: 30, current: cvrCur, previous: cvrPrev, goodHigh: true },
        { label: "Scroll medio %", weight: 12, current: lpCurAgg.avgScroll, previous: lpPrevAgg.avgScroll, goodHigh: true },
        { label: "Tempo medio (s)", weight: 8, current: lpCurAgg.avgTime, previous: lpPrevAgg.avgTime, goodHigh: true },
        { label: "Bounce rate", weight: 5, current: lpCurAgg.bounceRate, previous: lpPrevAgg.bounceRate, goodHigh: false },
        { label: "Hook rate (p25)", weight: 8, current: aCur.hookRate, previous: aPrev.hookRate, goodHigh: true },
        { label: "Hold rate (p75)", weight: 10, current: aCur.holdRate, previous: aPrev.holdRate, goodHigh: true },
        { label: "Completion rate", weight: 7, current: aCur.completionRate, previous: aPrev.completionRate, goodHigh: true },
        { label: "CPL", weight: 10, current: leadsCurCount > 0 ? aCur.spend / leadsCurCount : 0, previous: leadsPrevCount > 0 ? aPrev.spend / leadsPrevCount : 0, goodHigh: false },
        { label: "CPM", weight: 5, current: aCur.cpm, previous: aPrev.cpm, goodHigh: false },
        { label: "Frequenza", weight: 5, current: aCur.frequency, previous: aPrev.frequency, goodHigh: false },
      ];
      // Indicatore di "attività reale" del periodo: serve a non premiare ad
      // che hanno SOLO bruciato budget senza generare nulla. Se non c'è
      // nessun output (0 lead, 0 sessioni LP, 0 video plays significativi),
      // tutte le metriche "goodHigh" a 0 vengono contate come fallimento
      // anche quando il previous era 0 (ratio non calcolabile).
      const hasOutputCur = leadsCurCount > 0 || lpCurAgg.sessions > 0 || aCur.vPlays > 50;
      const hasOutputPrev = leadsPrevCount > 0 || lpPrevAgg.sessions > 0 || aPrev.vPlays > 50;

      let totalW = 0, sum = 0;
      const breakdown = items.map((it) => {
        let sub: number;
        let better = false;
        if (it.previous > 0 && it.current >= 0) {
          // Caso normale: confronto vs periodo precedente
          const ratio = it.current / Math.max(it.previous, 0.0001);
          const adj = it.goodHigh ? ratio : 1 / Math.max(ratio, 0.01);
          sub = Math.max(0, Math.min(100, 50 * adj));
          better = adj > 1;
        } else if (it.goodHigh && it.current > 0) {
          // Periodo prev a 0 ma ora produce → bonus moderato (60)
          sub = 60;
          better = true;
        } else if (!it.goodHigh && it.previous === 0 && it.current > 0) {
          // Costo che prima era 0 e ora c'è → leggermente negativo (40)
          sub = 40;
          better = false;
        } else if (it.goodHigh && it.current === 0 && hasOutputPrev) {
          // Era buono prima, ora è zero → critico (10)
          sub = 10;
          better = false;
        } else if (it.goodHigh && it.current === 0 && !hasOutputCur) {
          // Mai prodotto nulla in entrambi i periodi → fallimento (15)
          // così non viene "neutralizzato" e lo score scende.
          sub = 15;
          better = false;
        } else {
          // Default neutro
          sub = 50;
          better = false;
        }
        sum += sub * it.weight;
        totalW += it.weight;
        return { label: it.label, weight: it.weight, current: it.current, previous: it.previous, better, goodHigh: it.goodHigh, subScore: sub };
      });
      return { score: totalW > 0 ? sum / totalW : 50, breakdown };
    }
    const composite = compScore();

    return {
      ok: true,
      adId: data.adId,
      range: { since: data.sinceISO, until: data.untilISO },
      previousRange: { since: prevSince.toISOString(), until: prevUntil.toISOString() },
      historyMeta,
      kpis: {
        spend: deepKpi(aCur.spend, aPrev.spend),
        cpm: deepKpi(aCur.cpm, aPrev.cpm),
        frequency: deepKpi(aCur.frequency, aPrev.frequency),
        reach: deepKpi(aCur.reach, aPrev.reach),
        ctr: deepKpi(aCur.ctr, aPrev.ctr),
        impressions: deepKpi(aCur.impressions, aPrev.impressions),
        sessions: deepKpi(lpCurAgg.sessions, lpPrevAgg.sessions),
        avgScroll: deepKpi(lpCurAgg.avgScroll, lpPrevAgg.avgScroll),
        avgTime: deepKpi(lpCurAgg.avgTime, lpPrevAgg.avgTime),
        bounceRate: deepKpi(lpCurAgg.bounceRate, lpPrevAgg.bounceRate),
        cvr: deepKpi(cvrCur, cvrPrev),
        leads: deepKpi(leadsCurCount, leadsPrevCount),
        cpl: deepKpi(
          leadsCurCount > 0 ? aCur.spend / leadsCurCount : 0,
          leadsPrevCount > 0 ? aPrev.spend / leadsPrevCount : 0,
        ),
        // Video — formule manuali su impressions
        thumbstopRate: deepKpi(aCur.thumbstopRate, aPrev.thumbstopRate),
        hookRate: deepKpi(aCur.hookRate, aPrev.hookRate),
        view25Rate: deepKpi(aCur.view25Rate, aPrev.view25Rate),
        view50Rate: deepKpi(aCur.view50Rate, aPrev.view50Rate),
        view75Rate: deepKpi(aCur.view75Rate, aPrev.view75Rate),
        holdRate: deepKpi(aCur.holdRate, aPrev.holdRate),
        holdRateVsPlay: deepKpi(aCur.holdRateVsPlay, aPrev.holdRateVsPlay),
        completionRate: deepKpi(aCur.completionRate, aPrev.completionRate),
        thruRate: deepKpi(aCur.thruRate, aPrev.thruRate),
        realAttentionFreq: deepKpi(aCur.realAttentionFreq, aPrev.realAttentionFreq),
        // Conteggi assoluti video per mostrare i volumi (impressions/reach/plays/thru/v25-100)
        videoCounts: {
          impressions: aCur.impressions,
          reach: aCur.reach,
          videoPlays: aCur.vPlays,
          v25: aCur.v25,
          v50: aCur.v50,
          v75: aCur.v75,
          v100: aCur.v100,
          thruplays: aCur.vThru,
          v3sec: aCur.v3sec,
          vCont2: aCur.vCont2,
          denomPlays: aCur.denomPlays,
          denomViews: aCur.denomViews,
        },
        // Traffico — formule manuali (Meta dichiara ma noi calcoliamo da nostre colonne)
        ctrOutbound: deepKpi(aCur.ctrOutbound, aPrev.ctrOutbound),
        lpIntentRate: deepKpi(aCur.lpIntentRate, aPrev.lpIntentRate),
        lpViewRate: deepKpi(aCur.lpViewRate, aPrev.lpViewRate),
        lpvFreq: deepKpi(aCur.lpvFreq, aPrev.lpvFreq),
        stdFrequency: deepKpi(aCur.stdFrequency, aPrev.stdFrequency),
        realEngRate: deepKpi(aCur.realEngRate, aPrev.realEngRate),
        // Conversioni reali (CRM via UTM)
        contactsRate: deepKpi(
          aCur.lpv > 0 ? (leadsCurCount / aCur.lpv) * 100 : 0,
          aPrev.lpv > 0 ? (leadsPrevCount / aPrev.lpv) * 100 : 0,
        ),
        whatsappCvr: deepKpi(
          aCur.linkClicks > 0 ? (leadsCurCount / aCur.linkClicks) * 100 : 0,
          aPrev.linkClicks > 0 ? (leadsPrevCount / aPrev.linkClicks) * 100 : 0,
        ),
      },
      // Tooltip "UTM (CRM) vs Meta dichiara" — per evidenziare bot/click invalidi.
      // CTR UTM = sessioni LP / impressions; Meta CTR = clicks / impressions.
      // LP Views UTM = sessioni LP / link_clicks; Meta LPV rate = landing_page_views / link_clicks.
      utmVsMeta: {
        ctrUtm: aCur.impressions > 0 ? (lpCurAgg.sessions / aCur.impressions) * 100 : 0,
        ctrMeta: aCur.ctr,
        lpvRateUtm: aCur.linkClicks > 0 ? (lpCurAgg.sessions / aCur.linkClicks) * 100 : 0,
        lpvRateMeta: aCur.linkClicks > 0 ? (aCur.lpv / aCur.linkClicks) * 100 : 0,
      },
      composite,
      // Aggregati video per funnel chart (drop-off impressions → p25 → p50 → p75 → p100)
      videoFunnel: {
        impressions: aCur.impressions,
        videoPlays: aCur.vPlays,
        v25: aCur.v25,
        v50: aCur.v50,
        v75: aCur.v75,
        v100: aCur.v100,
        thruplays: aCur.vThru,
      },
      multiTouch: {
        leadsAnalyzed: journey.length,
        avgSessionsBeforeLead,
        avgAdsBeforeLead,
        multiAdLeads,
        multiAdPct: journey.length > 0 ? (multiAdLeads / journey.length) * 100 : 0,
        uidMatchedLeads,
        uidMatchPct: journey.length > 0 ? (uidMatchedLeads / journey.length) * 100 : 0,
        firstClickLeads,
        lastClickLeads,
        assistLeads,
        sample: journey.slice(0, 20),
      },
      fatigueAlerts,
      // Trend giornaliero arricchito: spesa, costi, video rates, engagement, funnel
      dailyTrend: (() => {
        interface Day {
          date: string;
          spend: number; impressions: number; clicks: number;
          videoPlays: number; v3: number; v25: number; v50: number; v75: number; v100: number; thru: number; vCont2: number;
          freq: number; reach: number;
          sessions: Set<string>;
          scrollSum: number; scrollCount: number;
          timeSum: number; timeCount: number;
          bounced: number; sessTotal: Set<string>;
          perSess: Map<string, { ms: number; mt: number }>;
          leads: number;
        }
        const m = new Map<string, Day>();
        function get(d: string): Day {
          let cur = m.get(d);
          if (!cur) {
            cur = {
              date: d,
              spend: 0, impressions: 0, clicks: 0,
              videoPlays: 0, v3: 0, v25: 0, v50: 0, v75: 0, v100: 0, thru: 0, vCont2: 0,
              freq: 0, reach: 0,
              sessions: new Set(),
              scrollSum: 0, scrollCount: 0,
              timeSum: 0, timeCount: 0,
              bounced: 0, sessTotal: new Set(),
              perSess: new Map(),
              leads: 0,
            };
            m.set(d, cur);
          }
          return cur;
        }
        for (const r of spendCur ?? []) {
          const c = get(r.spend_date as string);
          c.spend += Number(r.spend || 0);
          c.impressions += Number(r.impressions || 0);
          c.clicks += Number(r.clicks || 0);
          c.videoPlays += Number(r.video_plays || 0);
          c.v3 += Number(r.video_3_sec_watched || 0);
          c.v25 += Number(r.video_p25_watched || 0);
          c.v50 += Number(r.video_p50_watched || 0);
          c.v75 += Number(r.video_p75_watched || 0);
          c.v100 += Number(r.video_p100_watched || 0);
          c.thru += Number(r.video_thruplays || 0);
          c.vCont2 += Number(r.video_continuous_2_sec_watched || 0);
          c.reach += Number(r.reach || 0);
          c.freq = Math.max(c.freq, Number(r.frequency || 0));
        }
        for (const e of lpCur ?? []) {
          const d = (e.created_at as string).slice(0, 10);
          const c = get(d);
          c.sessions.add(e.session_id);
          c.sessTotal.add(e.session_id);
          const ms = typeof e.max_scroll === "number" ? e.max_scroll : 0;
          const tp = typeof e.time_on_page === "number" ? e.time_on_page : 0;
          if (ms > 0) { c.scrollSum += ms; c.scrollCount++; }
          if (tp > 0) { c.timeSum += tp; c.timeCount++; }
          const ps = c.perSess.get(e.session_id) || { ms: 0, mt: 0 };
          if (ms > ps.ms) ps.ms = ms;
          if (tp > ps.mt) ps.mt = tp;
          c.perSess.set(e.session_id, ps);
        }
        for (const lead of pubCur ?? []) {
          const d = (lead.created_at as string).slice(0, 10);
          get(d).leads++;
        }
        const allDays = [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
        // Mediana CTR del periodo (per ctrDrop component, coerente con global fatigueScore)
        const ctrSeries = allDays
          .filter((x) => x.impressions > 100)
          .map((x) => (x.clicks / x.impressions) * 100)
          .sort((a, b) => a - b);
        const medianCtr = ctrSeries.length > 0 ? ctrSeries[Math.floor(ctrSeries.length / 2)] : 0;
        return allDays.map((x) => {
          // Bounce per il giorno
          let bounced = 0;
          for (const v of x.perSess.values()) if (v.ms < 25 && v.mt < 10) bounced++;
          const sessN = x.perSess.size;
          const sessions = x.sessions.size;
          const cpm = x.impressions > 0 ? (x.spend / x.impressions) * 1000 : 0;
          const cpl = x.leads > 0 ? x.spend / x.leads : 0;
          const ctrDay = x.impressions > 0 ? (x.clicks / x.impressions) * 100 : 0;
          const avgScroll = x.scrollCount > 0 ? x.scrollSum / x.scrollCount : 0;
          const avgTime = x.timeCount > 0 ? x.timeSum / x.timeCount : 0;
          // Fatigue score giornaliero (stessa formula del globale, peso 33% ciascuno)
          const freqScore = Math.max(0, Math.min(100, ((x.freq - 1) / 5) * 100));
          const ctrDropScore = medianCtr > 0
            ? Math.max(0, Math.min(100, ((medianCtr - ctrDay) / medianCtr) * 100))
            : 0;
          const timeScore = Math.max(0, Math.min(100, ((60 - avgTime) / 60) * 100));
          const fatigueScore = Math.round((freqScore + ctrDropScore + timeScore) / 3);
          return {
            date: x.date,
            spend: x.spend,
            cpm,
            cpl,
            freq: x.freq,
            sessions,
            leads: x.leads,
            cvr: sessions > 0 ? (x.leads / sessions) * 100 : 0,
            avgScroll,
            avgTime,
            bounceRate: sessN > 0 ? (bounced / sessN) * 100 : 0,
            // Video rates giornalieri — formule centralizzate (single source of truth)
            ...(() => {
              const videoViews = computeVideoViews(x.v3, x.v25);
              const denomPlays = x.videoPlays > 0 ? x.videoPlays : (videoViews > 0 ? videoViews : x.impressions);
              const hookRate = computeHookRate(videoViews, denomPlays);
              return {
                thumbstopRate: computeThumbstopRate(videoViews, x.vCont2, hookRate),
                hookRate,
                view25Rate: computeViewRate(x.v25, videoViews),
                view50Rate: computeViewRate(x.v50, videoViews),
                view75Rate: computeViewRate(x.v75, videoViews),
                holdRate: computeHoldRate(x.thru, videoViews),
                completionRate: computeViewRate(x.v100, videoViews),
              };
            })(),
            fatigueScore,
          };
        });
      })(),
    };
  });

// ─────────────────────────────────────────────────────────
// 3) LEAD JOURNEY — customer journey individuale (multi-touch)
// Ricostruisce TUTTE le visite + ad viste prima della conversione di un lead.
// Usa external_id (lovable_uid). Lookback 90gg.
// ─────────────────────────────────────────────────────────
interface JourneyTouchpoint {
  ts: string;
  sessionId: string;
  eventName: string;
  adId: string | null;
  adName: string | null;
  campaignId: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
  device: string | null;
}
export const getLeadJourney = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; leadId: string; lookbackDays?: number }) => d)
  .handler(async ({ data }) => {
    const { supabase } = await authenticate(data.accessToken);
    const lookbackDays = data.lookbackDays ?? 90;

    // 1) Trova lead — prova prima crm_leads (potrebbe non avere external_id top-level)
    //    poi public_leads. external_id può essere nel data.tracking del crm_lead.
    const { data: crmLead } = await supabase
      .from("crm_leads")
      .select("id, data, created_at")
      .eq("id", data.leadId)
      .maybeSingle();

    let externalId: string | null = null;
    let email: string | null = null;
    let leadCreatedAt: string | null = null;
    let leadAdId: string | null = null;

    if (crmLead) {
      const d = crmLead.data as { tracking?: { external_id?: string; ad_id?: string }; email?: string; publicLeadId?: string };
      externalId = d.tracking?.external_id ?? null;
      email = d.email ?? null;
      leadCreatedAt = crmLead.created_at;
      leadAdId = d.tracking?.ad_id ?? null;

      if (!externalId && d.publicLeadId) {
        const { data: pub } = await supabase
          .from("public_leads")
          .select("external_id, email, created_at, ad_id")
          .eq("id", d.publicLeadId)
          .maybeSingle();
        if (pub) {
          externalId = pub.external_id ?? externalId;
          email = pub.email ?? email;
          leadAdId = pub.ad_id ?? leadAdId;
        }
      }
    } else {
      const { data: pub } = await supabase
        .from("public_leads")
        .select("id, external_id, email, created_at, ad_id")
        .eq("id", data.leadId)
        .maybeSingle();
      if (pub) {
        externalId = pub.external_id;
        email = pub.email;
        leadCreatedAt = pub.created_at;
        leadAdId = pub.ad_id;
      }
    }

    if (!leadCreatedAt) {
      return {
        ok: false as const,
        error: "Lead non trovato",
        externalId: null, email: null, leadCreatedAt: null,
        sessionsCount: 0, distinctAds: 0, eventsCount: 0,
        firstSeen: null, lastTouch: null,
        firstClickAdId: null, lastClickAdId: null,
        adIds: [] as string[], touchpoints: [] as JourneyTouchpoint[],
      };
    }
    if (!externalId) {
      return {
        ok: true as const,
        error: "Lead senza lovable_uid (importato/manuale o tracking precedente)",
        externalId: null, email, leadCreatedAt,
        sessionsCount: 1, distinctAds: leadAdId ? 1 : 0, eventsCount: 0,
        firstSeen: leadCreatedAt, lastTouch: leadCreatedAt,
        firstClickAdId: leadAdId, lastClickAdId: leadAdId,
        adIds: leadAdId ? [leadAdId] : [], touchpoints: [] as JourneyTouchpoint[],
      };
    }

    const lookbackStart = new Date(new Date(leadCreatedAt).getTime() - lookbackDays * 86400000);
    const { data: events } = await supabase
      .from("lp_events")
      .select("created_at, session_id, event_name, ad_id, ad_name, campaign_id, utm_source, utm_campaign, device")
      .eq("is_bot", false)
      .eq("external_id", externalId)
      .gte("created_at", lookbackStart.toISOString())
      .lte("created_at", leadCreatedAt)
      .order("created_at", { ascending: true })
      .limit(1000);

    const list = (events ?? []) as Array<{
      created_at: string; session_id: string; event_name: string;
      ad_id: string | null; ad_name: string | null; campaign_id: string | null;
      utm_source: string | null; utm_campaign: string | null; device: string | null;
    }>;
    const sessions = new Set(list.map((e) => e.session_id));
    const adsList = list.map((e) => e.ad_id).filter(Boolean) as string[];
    const distinctAds = new Set(adsList);
    const firstClickAdId = adsList[0] || leadAdId;
    const lastClickAdId = leadAdId || adsList[adsList.length - 1] || null;

    const touchpoints: JourneyTouchpoint[] = list.map((e) => ({
      ts: e.created_at,
      sessionId: e.session_id,
      eventName: e.event_name,
      adId: e.ad_id,
      adName: e.ad_name,
      campaignId: e.campaign_id,
      utmSource: e.utm_source,
      utmCampaign: e.utm_campaign,
      device: e.device,
    }));

    return {
      ok: true as const,
      error: null,
      externalId,
      email,
      leadCreatedAt,
      sessionsCount: sessions.size,
      distinctAds: distinctAds.size,
      eventsCount: list.length,
      firstSeen: list[0]?.created_at || null,
      lastTouch: list[list.length - 1]?.created_at || leadCreatedAt,
      firstClickAdId,
      lastClickAdId,
      adIds: [...distinctAds],
      touchpoints,
    };
  });

// ─────────────────────────────────────────────────────────
// 4) ATTRIBUTION OVERVIEW — vista globale di tutti i journey
// Aggrega tutti i lead convertiti negli ultimi N giorni, ricostruisce
// il loro path multi-touch e calcola classifiche first/last/assist per ad.
// ─────────────────────────────────────────────────────────
export interface AttributionJourneyRow {
  leadId: string;
  source: "crm" | "public";
  email: string | null;
  fullName: string | null;
  createdAt: string;
  externalId: string | null;
  sessionsCount: number;
  distinctAds: number;
  firstClickAdId: string | null;
  firstClickAdName: string | null;
  lastClickAdId: string | null;
  lastClickAdName: string | null;
  intermediateAdIds: string[];
  campaignId: string | null;
  isMultiAd: boolean;
  isConverted: boolean;
  daysToConvert: number | null;
}
export interface AttributionAdRanking {
  adId: string;
  adName: string | null;
  campaignId: string | null;
  firstClicks: number;
  lastClicks: number;
  assists: number;
  totalTouches: number;
  uniqueLeads: number;
  // Costo per assist / touch / lead (calcolato da meta_ad_spend nel periodo)
  spend: number;
  costPerAssist: number | null;
  costPerTouch: number | null;
  costPerLead: number | null;
}
export interface AttributionCampaignRanking {
  campaignId: string;
  firstClicks: number;
  lastClicks: number;
  assists: number;
  uniqueLeads: number;
}
export interface AttributionPathRow {
  path: string;            // "AdA → AdB → AdC" (max 4 nodi visualizzati)
  pathAdIds: string[];     // sequenza grezza di ad_id
  count: number;           // # journey con questo path
  converted: number;       // # convertiti
  conversionRate: number;  // converted / count
  avgDays: number | null;  // tempo medio conversione
}
export interface AttributionSummary {
  totalLeads: number; multiAdLeads: number; multiTouchLeads: number; convertedLeads: number;
  avgSessions: number; avgDistinctAds: number; avgDaysToConvert: number;
}
export const getAttributionOverview = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; sinceISO: string; untilISO: string; lookbackDays?: number; comparePrevious?: boolean }) => d)
  .handler(async ({ data }) => {
    const { supabase, userId } = await authenticate(data.accessToken);
    const lookbackDays = data.lookbackDays ?? 90;

    // Lead crm nel periodo
    const { data: crmLeadsRaw } = await supabase
      .from("crm_leads")
      .select("id, data, created_at")
      .gte("created_at", data.sinceISO)
      .lte("created_at", data.untilISO)
      .order("created_at", { ascending: false })
      .limit(2000);

    // Public leads nel periodo (catch-all per quelli non ancora in crm_leads)
    const { data: publicLeadsRaw } = await supabase
      .from("public_leads")
      .select("id, external_id, email, nome, cognome, created_at, ad_id, ad_name, campaign_id, status")
      .gte("created_at", data.sinceISO)
      .lte("created_at", data.untilISO)
      .order("created_at", { ascending: false })
      .limit(2000);

    type CrmRow = { id: string; data: LeadDataShape & { tracking?: { external_id?: string; ad_id?: string; ad_name?: string; campaign_id?: string }; email?: string; nome?: string; cognome?: string; publicLeadId?: string }; created_at: string };
    type PubRow = { id: string; external_id: string | null; email: string; nome: string; cognome: string; created_at: string; ad_id: string | null; ad_name: string | null; campaign_id: string | null; status: string };

    const crmLeads = (crmLeadsRaw ?? []) as CrmRow[];
    const pubLeads = (publicLeadsRaw ?? []) as PubRow[];

    // Costruisci una lista unificata, dedup via publicLeadId
    const seenPublicIds = new Set<string>();
    const baseRows: Array<{
      leadId: string;
      source: "crm" | "public";
      externalId: string | null;
      email: string | null;
      fullName: string | null;
      createdAt: string;
      adId: string | null;
      adName: string | null;
      campaignId: string | null;
      isConverted: boolean;
    }> = [];

    for (const c of crmLeads) {
      const d = c.data || {};
      if (d.publicLeadId) seenPublicIds.add(d.publicLeadId);
      baseRows.push({
        leadId: c.id,
        source: "crm",
        externalId: d.tracking?.external_id ?? null,
        email: d.email ?? null,
        fullName: [d.nome, d.cognome].filter(Boolean).join(" ").trim() || null,
        createdAt: c.created_at,
        adId: d.tracking?.ad_id ?? null,
        adName: d.tracking?.ad_name ?? null,
        campaignId: d.tracking?.campaign_id ?? null,
        isConverted: leadIsConverted(d),
      });
    }
    for (const p of pubLeads) {
      if (seenPublicIds.has(p.id)) continue;
      baseRows.push({
        leadId: p.id,
        source: "public",
        externalId: p.external_id,
        email: p.email,
        fullName: [p.nome, p.cognome].filter(Boolean).join(" ").trim() || null,
        createdAt: p.created_at,
        adId: p.ad_id,
        adName: p.ad_name,
        campaignId: p.campaign_id,
        isConverted: false,
      });
    }

    // Bulk fetch lp_events per tutti gli external_id presenti
    const externalIds = [...new Set(baseRows.map((r) => r.externalId).filter(Boolean) as string[])];
    const minCreated = baseRows.reduce<string | null>((acc, r) => {
      if (!acc || r.createdAt < acc) return r.createdAt;
      return acc;
    }, null);
    const lookbackStart = minCreated
      ? new Date(new Date(minCreated).getTime() - lookbackDays * 86400000).toISOString()
      : data.sinceISO;

    const eventsByExternal = new Map<string, Array<{ ts: string; sessionId: string; adId: string | null; adName: string | null; campaignId: string | null }>>();
    if (externalIds.length > 0) {
      // chunk per evitare URL troppo lunghe
      const chunkSize = 100;
      for (let i = 0; i < externalIds.length; i += chunkSize) {
        const chunk = externalIds.slice(i, i + chunkSize);
        const { data: evs } = await supabase
          .from("lp_events")
          .select("created_at, session_id, ad_id, ad_name, campaign_id, external_id")
          .eq("is_bot", false)
          .in("external_id", chunk)
          .gte("created_at", lookbackStart)
          .lte("created_at", data.untilISO)
          .order("created_at", { ascending: true })
          .limit(10000);
        for (const e of (evs ?? []) as Array<{ created_at: string; session_id: string; ad_id: string | null; ad_name: string | null; campaign_id: string | null; external_id: string }>) {
          if (!eventsByExternal.has(e.external_id)) eventsByExternal.set(e.external_id, []);
          eventsByExternal.get(e.external_id)!.push({
            ts: e.created_at, sessionId: e.session_id, adId: e.ad_id, adName: e.ad_name, campaignId: e.campaign_id,
          });
        }
      }
    }

    // Costruisci journey rows
    const journeys: AttributionJourneyRow[] = [];
    const adStats = new Map<string, { adName: string | null; campaignId: string | null; firstClicks: number; lastClicks: number; assists: number; totalTouches: number; uniqueLeads: Set<string> }>();
    const campStats = new Map<string, { firstClicks: number; lastClicks: number; assists: number; uniqueLeads: Set<string> }>();

    function bumpAd(adId: string, adName: string | null, campaignId: string | null, key: "firstClicks" | "lastClicks" | "assists" | "totalTouches", leadId: string) {
      let s = adStats.get(adId);
      if (!s) {
        s = { adName, campaignId, firstClicks: 0, lastClicks: 0, assists: 0, totalTouches: 0, uniqueLeads: new Set() };
        adStats.set(adId, s);
      }
      if (adName && !s.adName) s.adName = adName;
      if (campaignId && !s.campaignId) s.campaignId = campaignId;
      s[key] += 1;
      s.uniqueLeads.add(leadId);
    }
    function bumpCamp(campaignId: string, key: "firstClicks" | "lastClicks" | "assists", leadId: string) {
      let s = campStats.get(campaignId);
      if (!s) {
        s = { firstClicks: 0, lastClicks: 0, assists: 0, uniqueLeads: new Set() };
        campStats.set(campaignId, s);
      }
      s[key] += 1;
      s.uniqueLeads.add(leadId);
    }

    for (const r of baseRows) {
      const evs = r.externalId ? eventsByExternal.get(r.externalId) || [] : [];
      const sessions = new Set(evs.map((e) => e.sessionId));
      const adIdsSeen = evs.map((e) => e.adId).filter(Boolean) as string[];
      const distinctAds = new Set(adIdsSeen);

      const firstClickAdId = adIdsSeen[0] || r.adId;
      const lastClickAdId = r.adId || adIdsSeen[adIdsSeen.length - 1] || null;
      const firstEv = evs.find((e) => e.adId === firstClickAdId);
      const lastEv = [...evs].reverse().find((e) => e.adId === lastClickAdId);
      const firstClickAdName = firstEv?.adName ?? r.adName;
      const lastClickAdName = lastEv?.adName ?? r.adName;

      const isMultiAd = !!firstClickAdId && !!lastClickAdId && firstClickAdId !== lastClickAdId;

      journeys.push({
        leadId: r.leadId,
        source: r.source,
        email: r.email,
        fullName: r.fullName,
        createdAt: r.createdAt,
        externalId: r.externalId,
        sessionsCount: Math.max(sessions.size, r.adId ? 1 : 0),
        distinctAds: Math.max(distinctAds.size, r.adId ? 1 : 0),
        firstClickAdId,
        firstClickAdName,
        lastClickAdId,
        lastClickAdName,
        intermediateAdIds: [...distinctAds].filter((id) => id !== firstClickAdId && id !== lastClickAdId),
        campaignId: r.campaignId,
        isMultiAd,
        isConverted: r.isConverted,
        daysToConvert: evs[0] ? Math.max(0, Math.round((new Date(r.createdAt).getTime() - new Date(evs[0].ts).getTime()) / 86400000)) : null,
      });

      // Stats
      if (firstClickAdId) bumpAd(firstClickAdId, firstClickAdName, r.campaignId, "firstClicks", r.leadId);
      if (lastClickAdId) bumpAd(lastClickAdId, lastClickAdName, r.campaignId, "lastClicks", r.leadId);
      if (r.campaignId) {
        if (firstClickAdId) bumpCamp(r.campaignId, "firstClicks", r.leadId);
        if (lastClickAdId) bumpCamp(r.campaignId, "lastClicks", r.leadId);
      }
      // Assist: ad viste in mezzo (non first né last)
      for (const adId of distinctAds) {
        if (adId !== firstClickAdId && adId !== lastClickAdId) {
          const ev = evs.find((e) => e.adId === adId);
          bumpAd(adId, ev?.adName ?? null, ev?.campaignId ?? r.campaignId, "assists", r.leadId);
          if (ev?.campaignId || r.campaignId) bumpCamp((ev?.campaignId || r.campaignId)!, "assists", r.leadId);
        }
      }
      // Total touches
      for (const adId of distinctAds) {
        const ev = evs.find((e) => e.adId === adId);
        bumpAd(adId, ev?.adName ?? null, ev?.campaignId ?? r.campaignId, "totalTouches", r.leadId);
      }
    }

    // ── Costo per assist/touch/lead: join meta_ad_spend nel periodo ──
    const adIds = [...adStats.keys()];
    const spendByAd = new Map<string, number>();
    if (adIds.length > 0) {
      const sinceDate = data.sinceISO.slice(0, 10);
      const untilDate = data.untilISO.slice(0, 10);
      const chunkSize = 200;
      for (let i = 0; i < adIds.length; i += chunkSize) {
        const chunk = adIds.slice(i, i + chunkSize);
        const { data: spendRows } = await supabase
          .from("meta_ad_spend")
          .select("ad_id, spend")
          .eq("user_id", userId)
          .in("ad_id", chunk)
          .gte("spend_date", sinceDate)
          .lte("spend_date", untilDate);
        for (const r of (spendRows ?? []) as Array<{ ad_id: string; spend: number }>) {
          spendByAd.set(r.ad_id, (spendByAd.get(r.ad_id) || 0) + Number(r.spend || 0));
        }
      }
    }

    const adRanking: AttributionAdRanking[] = [...adStats.entries()].map(([adId, s]) => {
      const spend = spendByAd.get(adId) || 0;
      const uniqueLeads = s.uniqueLeads.size;
      return {
        adId, adName: s.adName, campaignId: s.campaignId,
        firstClicks: s.firstClicks, lastClicks: s.lastClicks, assists: s.assists,
        totalTouches: s.totalTouches, uniqueLeads,
        spend,
        costPerAssist: s.assists > 0 && spend > 0 ? spend / s.assists : null,
        costPerTouch: s.totalTouches > 0 && spend > 0 ? spend / s.totalTouches : null,
        costPerLead: uniqueLeads > 0 && spend > 0 ? spend / uniqueLeads : null,
      };
    });
    const campaignRanking: AttributionCampaignRanking[] = [...campStats.entries()].map(([campaignId, s]) => ({
      campaignId, firstClicks: s.firstClicks, lastClicks: s.lastClicks, assists: s.assists, uniqueLeads: s.uniqueLeads.size,
    }));

    // ── Top sequenze path (max 4 nodi visualizzati: First → Mid1 → Mid2 → Last) ──
    const adNameById = new Map<string, string | null>();
    for (const [id, s] of adStats) adNameById.set(id, s.adName);
    const labelOf = (id: string): string => {
      const n = adNameById.get(id);
      return n ? n.slice(0, 24) : `…${id.slice(-6)}`;
    };
    const pathStats = new Map<string, { pathAdIds: string[]; count: number; converted: number; daysSum: number; daysCount: number }>();
    for (const j of journeys) {
      const seq: string[] = [];
      if (j.firstClickAdId) seq.push(j.firstClickAdId);
      for (const m of j.intermediateAdIds) if (!seq.includes(m)) seq.push(m);
      if (j.lastClickAdId && !seq.includes(j.lastClickAdId)) seq.push(j.lastClickAdId);
      if (seq.length === 0) continue;
      const key = seq.join("→");
      let p = pathStats.get(key);
      if (!p) { p = { pathAdIds: seq, count: 0, converted: 0, daysSum: 0, daysCount: 0 }; pathStats.set(key, p); }
      p.count++;
      if (j.isConverted) p.converted++;
      if (typeof j.daysToConvert === "number") { p.daysSum += j.daysToConvert; p.daysCount++; }
    }
    const topPaths: AttributionPathRow[] = [...pathStats.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((p) => {
        const visible = p.pathAdIds.length <= 4 ? p.pathAdIds : [p.pathAdIds[0], "…", p.pathAdIds[p.pathAdIds.length - 1]];
        const pathLabel = visible.map((id) => id === "…" ? `… (+${p.pathAdIds.length - 2})` : labelOf(id)).join(" → ");
        return {
          path: pathLabel,
          pathAdIds: p.pathAdIds,
          count: p.count,
          converted: p.converted,
          conversionRate: p.count > 0 ? p.converted / p.count : 0,
          avgDays: p.daysCount > 0 ? p.daysSum / p.daysCount : null,
        };
      });

    const totalLeads = journeys.length;
    const multiAdLeads = journeys.filter((j) => j.isMultiAd).length;
    const multiTouchLeads = journeys.filter((j) => j.sessionsCount > 1).length;
    const convertedLeads = journeys.filter((j) => j.isConverted).length;
    const avgSessions = totalLeads > 0 ? journeys.reduce((a, j) => a + j.sessionsCount, 0) / totalLeads : 0;
    const avgDistinctAds = totalLeads > 0 ? journeys.reduce((a, j) => a + j.distinctAds, 0) / totalLeads : 0;
    const avgDaysToConvert = (() => {
      const vals = journeys.map((j) => j.daysToConvert).filter((v): v is number => typeof v === "number");
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    })();
    const summary: AttributionSummary = {
      totalLeads, multiAdLeads, multiTouchLeads, convertedLeads,
      avgSessions, avgDistinctAds, avgDaysToConvert,
    };

    // ── Confronto periodo precedente (solo summary, nessun dettaglio) ──
    let previousSummary: AttributionSummary | null = null;
    if (data.comparePrevious) {
      const sinceMs = new Date(data.sinceISO).getTime();
      const untilMs = new Date(data.untilISO).getTime();
      const rangeMs = untilMs - sinceMs;
      const prevUntilISO = new Date(sinceMs).toISOString();
      const prevSinceISO = new Date(sinceMs - rangeMs).toISOString();

      const { data: prevCrm } = await supabase
        .from("crm_leads")
        .select("id, data, created_at")
        .gte("created_at", prevSinceISO).lte("created_at", prevUntilISO)
        .order("created_at", { ascending: false }).limit(2000);
      const { data: prevPub } = await supabase
        .from("public_leads")
        .select("id, external_id, created_at")
        .gte("created_at", prevSinceISO).lte("created_at", prevUntilISO)
        .order("created_at", { ascending: false }).limit(2000);

      const prevCrmRows = (prevCrm ?? []) as Array<{ id: string; data: LeadDataShape & { tracking?: { external_id?: string }; publicLeadId?: string }; created_at: string }>;
      const prevPubRows = (prevPub ?? []) as Array<{ id: string; external_id: string | null; created_at: string }>;
      const prevSeenPub = new Set<string>();
      for (const c of prevCrmRows) { if (c.data?.publicLeadId) prevSeenPub.add(c.data.publicLeadId); }
      const prevExternalIds = new Set<string>();
      const prevConvertedSet = new Set<string>();
      for (const c of prevCrmRows) {
        if (c.data?.tracking?.external_id) prevExternalIds.add(c.data.tracking.external_id);
        if (leadIsConverted(c.data || {})) prevConvertedSet.add(c.id);
      }
      const prevPubFiltered = prevPubRows.filter((p) => !prevSeenPub.has(p.id));
      for (const p of prevPubFiltered) if (p.external_id) prevExternalIds.add(p.external_id);

      // sessions / distinct ads count via lp_events
      const prevSessionsByExt = new Map<string, Set<string>>();
      const prevDistinctAdsByExt = new Map<string, Set<string>>();
      const extArr = [...prevExternalIds];
      const chunkSize = 100;
      for (let i = 0; i < extArr.length; i += chunkSize) {
        const chunk = extArr.slice(i, i + chunkSize);
        if (chunk.length === 0) continue;
        const lookbackStart = new Date(new Date(prevSinceISO).getTime() - lookbackDays * 86400000).toISOString();
        const { data: evs } = await supabase
          .from("lp_events")
          .select("session_id, ad_id, external_id")
          .eq("is_bot", false)
          .in("external_id", chunk)
          .gte("created_at", lookbackStart)
          .lte("created_at", prevUntilISO)
          .limit(10000);
        for (const e of (evs ?? []) as Array<{ session_id: string; ad_id: string | null; external_id: string }>) {
          if (!prevSessionsByExt.has(e.external_id)) prevSessionsByExt.set(e.external_id, new Set());
          prevSessionsByExt.get(e.external_id)!.add(e.session_id);
          if (e.ad_id) {
            if (!prevDistinctAdsByExt.has(e.external_id)) prevDistinctAdsByExt.set(e.external_id, new Set());
            prevDistinctAdsByExt.get(e.external_id)!.add(e.ad_id);
          }
        }
      }
      const prevTotal = prevCrmRows.length + prevPubFiltered.length;
      let multiAd = 0, multiTouch = 0, sessSum = 0, adsSum = 0;
      const collect = (extId: string | null | undefined) => {
        const sessN = extId ? (prevSessionsByExt.get(extId)?.size || 0) : 0;
        const adsN = extId ? (prevDistinctAdsByExt.get(extId)?.size || 0) : 0;
        sessSum += sessN; adsSum += adsN;
        if (sessN > 1) multiTouch++;
        if (adsN > 1) multiAd++;
      };
      for (const c of prevCrmRows) collect(c.data?.tracking?.external_id);
      for (const p of prevPubFiltered) collect(p.external_id);

      previousSummary = {
        totalLeads: prevTotal,
        multiAdLeads: multiAd,
        multiTouchLeads: multiTouch,
        convertedLeads: prevConvertedSet.size,
        avgSessions: prevTotal > 0 ? sessSum / prevTotal : 0,
        avgDistinctAds: prevTotal > 0 ? adsSum / prevTotal : 0,
        avgDaysToConvert: 0,
      };
    }

    return {
      ok: true as const,
      summary,
      previousSummary,
      journeys,
      adRanking,
      campaignRanking,
      topPaths,
    };
  });

// ============================================================================
// AD SCORE HISTORY — salvataggio storico giornaliero del Composite Score
// ============================================================================

/**
 * Salva (upsert) lo snapshot del Composite Score per un'inserzione nella data odierna.
 * Idempotente grazie al UNIQUE(user_id, ad_id, snapshot_date).
 */
export const saveAdScoreSnapshot = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; adId: string; score: number; subScores: Record<string, number> }) => input)
  .handler(async ({ data }) => {
    const { supabase, userId } = await authenticate(data.accessToken);
    const today = new Date();
    const snapshotDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const { error } = await supabase
      .from("ad_score_history")
      .upsert(
        {
          user_id: userId,
          ad_id: data.adId,
          snapshot_date: snapshotDate,
          score: data.score,
          sub_scores: data.subScores,
        },
        { onConflict: "user_id,ad_id,snapshot_date" }
      );
    if (error) {
      console.error("[saveAdScoreSnapshot] error:", error);
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  });

/**
 * Recupera lo storico ultimi N giorni del Composite Score per un'inserzione.
 */
export const getAdScoreHistory = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; adId: string; days?: number }) => input)
  .handler(async ({ data }) => {
    const { supabase } = await authenticate(data.accessToken);
    const days = Math.max(1, Math.min(365, data.days ?? 30));
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    const sinceISO = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-${String(since.getDate()).padStart(2, "0")}`;
    const { data: rows, error } = await supabase
      .from("ad_score_history")
      .select("snapshot_date,score,sub_scores")
      .eq("ad_id", data.adId)
      .gte("snapshot_date", sinceISO)
      .order("snapshot_date", { ascending: true });
    if (error) {
      console.error("[getAdScoreHistory] error:", error);
      return { ok: false as const, history: [] as Array<{ date: string; score: number }> };
    }
    return {
      ok: true as const,
      history: (rows ?? []).map((r) => ({ date: r.snapshot_date as string, score: Number(r.score) })),
    };
  });

/**
 * Top movers: confronta lo score attuale (ultimi 3gg) con quello di 14gg fa
 * per ogni ad nello storico utente. Restituisce top crescita e top calo.
 */
export const getTopMovers = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; limit?: number; lookbackDays?: number }) => input)
  .handler(async ({ data }) => {
    const { supabase, userId } = await authenticate(data.accessToken);
    const limit = Math.max(1, Math.min(50, data.limit ?? 10));
    const lookback = Math.max(7, Math.min(60, data.lookbackDays ?? 14));
    const today = new Date();
    const since = new Date(today);
    since.setDate(today.getDate() - lookback);
    const sinceISO = since.toISOString().slice(0, 10);

    const { data: rows, error } = await supabase
      .from("ad_score_history")
      .select("ad_id,snapshot_date,score")
      .eq("user_id", userId)
      .gte("snapshot_date", sinceISO)
      .order("snapshot_date", { ascending: true });
    if (error) {
      console.error("[getTopMovers] error:", error);
      return { ok: false as const, gainers: [], losers: [] };
    }

    // Raggruppa per ad_id e prendi primo + ultimo punto del periodo
    const byAd = new Map<string, Array<{ date: string; score: number }>>();
    for (const r of rows ?? []) {
      const list = byAd.get(r.ad_id) ?? [];
      list.push({ date: r.snapshot_date as string, score: Number(r.score) });
      byAd.set(r.ad_id, list);
    }

    type Mover = { adId: string; first: number; last: number; delta: number; deltaPct: number; points: number; sparkline: number[] };
    const movers: Mover[] = [];
    for (const [adId, points] of byAd.entries()) {
      if (points.length < 2) continue;
      const first = points[0].score;
      const last = points[points.length - 1].score;
      const delta = last - first;
      const deltaPct = first > 0 ? (delta / first) * 100 : 0;
      movers.push({
        adId,
        first,
        last,
        delta,
        deltaPct,
        points: points.length,
        sparkline: points.map((p) => p.score),
      });
    }

    // Lookup nomi ad da meta_ad_spend (più recenti)
    const adIds = movers.map((m) => m.adId);
    const nameMap = new Map<string, { adName: string; campaignName: string }>();
    if (adIds.length > 0) {
      const { data: nameRows } = await supabase
        .from("meta_ad_spend")
        .select("ad_id, ad_name, campaign_name, spend_date")
        .eq("user_id", userId)
        .in("ad_id", adIds)
        .order("spend_date", { ascending: false });
      for (const r of nameRows ?? []) {
        if (!nameMap.has(r.ad_id)) {
          nameMap.set(r.ad_id, {
            adName: r.ad_name ?? r.ad_id,
            campaignName: r.campaign_name ?? "—",
          });
        }
      }
    }

    const enriched = movers.map((m) => ({
      ...m,
      adName: nameMap.get(m.adId)?.adName ?? m.adId,
      campaignName: nameMap.get(m.adId)?.campaignName ?? "—",
    }));

    const gainers = [...enriched].sort((a, b) => b.delta - a.delta).slice(0, limit);
    const losers = [...enriched].sort((a, b) => a.delta - b.delta).slice(0, limit);

    return { ok: true as const, gainers, losers, periodDays: lookback };
  });

// ─────────────────────────────────────────────────────────
// CRON: snapshot Composite Score per TUTTE le ad attive
// ─────────────────────────────────────────────────────────
// Riusabile dall'hook /hooks/score-snapshot. Scorre tutti gli utenti con un
// access token Meta configurato e calcola lo score per ogni ad con spesa
// negli ultimi 7 giorni, usando direttamente i dati già in DB
// (meta_ad_spend + lp_events + public_leads). Idempotente per (user, ad, data).

interface SnapshotResult { user_id: string; processed: number; errors: number }

function isoDateNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export async function snapshotAllActiveAdsComposite(adminClient: ReturnType<typeof createClient<Database>>): Promise<SnapshotResult[]> {
  const today = new Date();
  const todayISO = today.toISOString().slice(0, 10);
  const since7 = isoDateNDaysAgo(7);
  const since14 = isoDateNDaysAgo(14);

  // Tutti gli utenti con almeno una ad spese negli ultimi 7gg
  const { data: userRows, error: uErr } = await adminClient
    .from("meta_ad_spend")
    .select("user_id")
    .gte("spend_date", since7);
  if (uErr) {
    console.error("[snapshotAll] users error:", uErr);
    return [];
  }
  const userIds = Array.from(new Set((userRows ?? []).map((r) => r.user_id)));
  const results: SnapshotResult[] = [];

  for (const userId of userIds) {
    let processed = 0;
    let errors = 0;

    // Tutte le ad con spesa > 0 negli ultimi 14gg per questo utente
    const { data: spend14 } = await adminClient
      .from("meta_ad_spend")
      .select("ad_id, spend, impressions, clicks, reach, frequency, video_plays, video_p25_watched, video_p50_watched, video_p75_watched, video_p100_watched, video_thruplays, video_3_sec_watched, video_continuous_2_sec_watched, spend_date")
      .eq("user_id", userId)
      .gte("spend_date", since14)
      .gt("spend", 0);

    if (!spend14 || spend14.length === 0) {
      results.push({ user_id: userId, processed: 0, errors: 0 });
      continue;
    }

    // Raggruppa per ad_id, dividendo in finestra current (7gg) e previous (precedenti 7gg)
    type Window = {
      spend: number; impressions: number; clicks: number; reach: number; freqSum: number; freqDays: number;
      vPlays: number; v25: number; v50: number; v75: number; v100: number; vThru: number; v3sec: number; vCont2: number;
    };
    const empty = (): Window => ({ spend: 0, impressions: 0, clicks: 0, reach: 0, freqSum: 0, freqDays: 0, vPlays: 0, v25: 0, v50: 0, v75: 0, v100: 0, vThru: 0, v3sec: 0, vCont2: 0 });
    const adWindows = new Map<string, { cur: Window; prev: Window }>();

    for (const r of spend14) {
      const isCur = r.spend_date >= since7;
      const w = adWindows.get(r.ad_id) ?? { cur: empty(), prev: empty() };
      const target = isCur ? w.cur : w.prev;
      target.spend += Number(r.spend || 0);
      target.impressions += Number(r.impressions || 0);
      target.clicks += Number(r.clicks || 0);
      target.reach += Number(r.reach || 0);
      const f = Number(r.frequency || 0);
      if (f > 0) { target.freqSum += f; target.freqDays++; }
      target.vPlays += Number(r.video_plays || 0);
      target.v25 += Number(r.video_p25_watched || 0);
      target.v50 += Number(r.video_p50_watched || 0);
      target.v75 += Number(r.video_p75_watched || 0);
      target.v100 += Number(r.video_p100_watched || 0);
      target.vThru += Number(r.video_thruplays || 0);
      target.v3sec += Number(r.video_3_sec_watched || 0);
      target.vCont2 += Number(r.video_continuous_2_sec_watched || 0);
      adWindows.set(r.ad_id, w);
    }

    function deriveMetrics(w: Window) {
      const cpm = computeCpm(w.spend, w.impressions);
      const frequency = w.freqDays > 0 ? w.freqSum / w.freqDays : 0;
      const videoViews = computeVideoViews(w.v3sec, w.v25);
      const denomPlays = w.vPlays > 0 ? w.vPlays : (videoViews > 0 ? videoViews : w.impressions);
      const hookRate = computeHookRate(videoViews, denomPlays);
      const holdRate = computeHoldRate(w.vThru, videoViews);
      const completionRate = computeViewRate(w.v100, videoViews);
      return { cpm, frequency, hookRate, holdRate, completionRate };
    }

    // Per ogni ad: aggrega anche LP + lead via OR ad_id/utm
    for (const [adId, win] of adWindows.entries()) {
      try {
        const adIdFilter = `ad_id.eq.${adId},utm_id.eq.${adId},utm_content.eq.${adId}`;
        const sinceCur = `${since7}T00:00:00Z`;
        const untilCur = `${todayISO}T23:59:59Z`;
        const sincePrev = `${since14}T00:00:00Z`;

        const [lpCurR, lpPrevR, leadCurR, leadPrevR] = await Promise.all([
          adminClient.from("lp_events").select("session_id, payload, max_scroll, time_on_page").eq("is_bot", false).or(adIdFilter).gte("created_at", sinceCur).lte("created_at", untilCur).limit(20000),
          adminClient.from("lp_events").select("session_id, payload, max_scroll, time_on_page").eq("is_bot", false).or(adIdFilter).gte("created_at", sincePrev).lt("created_at", sinceCur).limit(20000),
          adminClient.from("public_leads").select("id").or(adIdFilter).gte("created_at", sinceCur).lte("created_at", untilCur),
          adminClient.from("public_leads").select("id").or(adIdFilter).gte("created_at", sincePrev).lt("created_at", sinceCur),
        ]);

        function aggLp(rows: Array<{ session_id: string; max_scroll: number | null; time_on_page: number | null }> | null) {
          const sessions = new Set<string>();
          const perSession = new Map<string, { maxScroll: number; maxTime: number }>();
          for (const e of rows ?? []) {
            sessions.add(e.session_id);
            const ms = Number(e.max_scroll ?? 0);
            const tp = Number(e.time_on_page ?? 0);
            const cur = perSession.get(e.session_id) || { maxScroll: 0, maxTime: 0 };
            if (ms > cur.maxScroll) cur.maxScroll = ms;
            if (tp > cur.maxTime) cur.maxTime = tp;
            perSession.set(e.session_id, cur);
          }
          let bounced = 0;
          const vals = [...perSession.values()];
          for (const v of vals) if (v.maxScroll < 25 && v.maxTime < 10) bounced++;
          const totSess = perSession.size;
          return {
            sessions: sessions.size,
            avgScroll: totSess > 0 ? vals.reduce((s, v) => s + v.maxScroll, 0) / totSess : 0,
            avgTime: totSess > 0 ? vals.reduce((s, v) => s + v.maxTime, 0) / totSess : 0,
            bounceRate: totSess > 0 ? (bounced / totSess) * 100 : 0,
          };
        }

        const lpCurAgg = aggLp(lpCurR.data as Array<{ session_id: string; max_scroll: number | null; time_on_page: number | null }> | null);
        const lpPrevAgg = aggLp(lpPrevR.data as Array<{ session_id: string; max_scroll: number | null; time_on_page: number | null }> | null);
        const leadsCurCount = (leadCurR.data ?? []).length;
        const leadsPrevCount = (leadPrevR.data ?? []).length;

        const cur = deriveMetrics(win.cur);
        const prev = deriveMetrics(win.prev);
        const cvrCur = lpCurAgg.sessions > 0 ? (leadsCurCount / lpCurAgg.sessions) * 100 : 0;
        const cvrPrev = lpPrevAgg.sessions > 0 ? (leadsPrevCount / lpPrevAgg.sessions) * 100 : 0;
        const cplCur = leadsCurCount > 0 ? win.cur.spend / leadsCurCount : 0;
        const cplPrev = leadsPrevCount > 0 ? win.prev.spend / leadsPrevCount : 0;

        const items = [
          { label: "CVR (lead/sessioni)", weight: 30, current: cvrCur, previous: cvrPrev, goodHigh: true },
          { label: "Scroll medio %", weight: 12, current: lpCurAgg.avgScroll, previous: lpPrevAgg.avgScroll, goodHigh: true },
          { label: "Tempo medio (s)", weight: 8, current: lpCurAgg.avgTime, previous: lpPrevAgg.avgTime, goodHigh: true },
          { label: "Bounce rate", weight: 5, current: lpCurAgg.bounceRate, previous: lpPrevAgg.bounceRate, goodHigh: false },
          { label: "Hook rate (p25)", weight: 8, current: cur.hookRate, previous: prev.hookRate, goodHigh: true },
          { label: "Hold rate (p75)", weight: 10, current: cur.holdRate, previous: prev.holdRate, goodHigh: true },
          { label: "Completion rate", weight: 7, current: cur.completionRate, previous: prev.completionRate, goodHigh: true },
          { label: "CPL", weight: 10, current: cplCur, previous: cplPrev, goodHigh: false },
          { label: "CPM", weight: 5, current: cur.cpm, previous: prev.cpm, goodHigh: false },
          { label: "Frequenza", weight: 5, current: cur.frequency, previous: prev.frequency, goodHigh: false },
        ];
        const hasOutputCur = leadsCurCount > 0 || lpCurAgg.sessions > 0 || win.cur.vPlays > 50;
        const hasOutputPrev = leadsPrevCount > 0 || lpPrevAgg.sessions > 0 || win.prev.vPlays > 50;
        let totalW = 0, sum = 0;
        const subScores: Record<string, number> = {};
        for (const it of items) {
          let sub: number;
          if (it.previous > 0 && it.current >= 0) {
            const ratio = it.current / Math.max(it.previous, 0.0001);
            const adj = it.goodHigh ? ratio : 1 / Math.max(ratio, 0.01);
            sub = Math.max(0, Math.min(100, 50 * adj));
          } else if (it.goodHigh && it.current > 0) sub = 60;
          else if (!it.goodHigh && it.previous === 0 && it.current > 0) sub = 40;
          else if (it.goodHigh && it.current === 0 && hasOutputPrev) sub = 10;
          else if (it.goodHigh && it.current === 0 && !hasOutputCur) sub = 15;
          else sub = 50;
          subScores[it.label] = sub;
          sum += sub * it.weight;
          totalW += it.weight;
        }
        const score = totalW > 0 ? sum / totalW : 50;

        const { error: upErr } = await adminClient
          .from("ad_score_history")
          .upsert(
            { user_id: userId, ad_id: adId, snapshot_date: todayISO, score, sub_scores: subScores },
            { onConflict: "user_id,ad_id,snapshot_date" }
          );
        if (upErr) { errors++; console.error(`[snapshotAll] upsert ${adId}:`, upErr); }
        else processed++;
      } catch (e) {
        errors++;
        console.error(`[snapshotAll] ad ${adId} failed:`, e);
      }
    }
    results.push({ user_id: userId, processed, errors });
  }
  return results;
}


// ─────────────────────────────────────────────────────────
// CREATIVE TREND WoW: ultimi 7gg vs 7gg precedenti per ogni ad
// ─────────────────────────────────────────────────────────
// Aggrega meta_ad_spend + lp_events (matchati per ad_id/utm_id/utm_content)
// in due finestre di 7 giorni. Restituisce per ogni ad: CPC, CPL, CTR,
// hookRate, holdRate, bounceRate, scrollAvg, timeOnPage — current vs previous
// con delta %. Usato dalla scheda "Trend Creative WoW" in Ads Manager.

export const getCreativeWowSnapshot = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; windowDays?: number }) => input)
  .handler(async ({ data }) => {
    const { supabase, userId } = await authenticate(data.accessToken);
    const winDays = [7, 14, 30].includes(data.windowDays ?? 0) ? (data.windowDays as number) : 7;
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const since7 = new Date(today); since7.setDate(today.getDate() - winDays);
    const since14 = new Date(today); since14.setDate(today.getDate() - winDays * 2);
    const since7ISO = since7.toISOString().slice(0, 10);
    const since14ISO = since14.toISOString().slice(0, 10);

    // Spesa ultimi 14gg
    const { data: spend14, error: spErr } = await supabase
      .from("meta_ad_spend")
      .select("ad_id, ad_name, campaign_name, spend_date, spend, impressions, clicks, video_plays, video_p25_watched, video_p75_watched, video_3_sec_watched, video_continuous_2_sec_watched, video_thruplays")
      .eq("user_id", userId)
      .gte("spend_date", since14ISO);
    if (spErr) {
      console.error("[getCreativeWowSnapshot] spend error:", spErr);
      return { ok: false as const, items: [] };
    }
    if (!spend14 || spend14.length === 0) return { ok: true as const, items: [] };

    interface Win {
      spend: number; impressions: number; clicks: number;
      vPlays: number; v25: number; v75: number; v3sec: number; vCont2: number; vThru: number;
      firstDate: string | null;
    }
    const empty = (): Win => ({ spend: 0, impressions: 0, clicks: 0, vPlays: 0, v25: 0, v75: 0, v3sec: 0, vCont2: 0, vThru: 0, firstDate: null });
    const adMap = new Map<string, { adName: string; campaignName: string; cur: Win; prev: Win }>();

    for (const r of spend14) {
      const isCur = r.spend_date >= since7ISO;
      const entry = adMap.get(r.ad_id) ?? { adName: r.ad_name ?? r.ad_id, campaignName: r.campaign_name ?? "—", cur: empty(), prev: empty() };
      const w = isCur ? entry.cur : entry.prev;
      w.spend += Number(r.spend || 0);
      w.impressions += Number(r.impressions || 0);
      w.clicks += Number(r.clicks || 0);
      w.vPlays += Number(r.video_plays || 0);
      w.v25 += Number(r.video_p25_watched || 0);
      w.v75 += Number(r.video_p75_watched || 0);
      w.v3sec += Number(r.video_3_sec_watched || 0);
      w.vCont2 += Number(r.video_continuous_2_sec_watched || 0);
      w.vThru += Number(r.video_thruplays || 0);
      if (!entry.cur.firstDate || r.spend_date < entry.cur.firstDate) entry.cur.firstDate = r.spend_date;
      if (!entry.prev.firstDate || r.spend_date < entry.prev.firstDate) entry.prev.firstDate = r.spend_date;
      adMap.set(r.ad_id, entry);
    }

    interface AggLp { sessions: number; bounceRate: number; avgScroll: number; avgTime: number }
    async function lpFor(adId: string, sinceISO: string, untilISO: string): Promise<AggLp> {
      const adIdFilter = `ad_id.eq.${adId},utm_id.eq.${adId},utm_content.eq.${adId}`;
      const { data: rows } = await supabase
        .from("lp_events")
        .select("session_id, max_scroll, time_on_page")
        .eq("is_bot", false)
        .or(adIdFilter)
        .gte("created_at", `${sinceISO}T00:00:00Z`)
        .lt("created_at", `${untilISO}T00:00:00Z`)
        .limit(20000);
      const perSession = new Map<string, { maxScroll: number; maxTime: number }>();
      for (const e of rows ?? []) {
        const ms = Number(e.max_scroll ?? 0);
        const tp = Number(e.time_on_page ?? 0);
        const cur = perSession.get(e.session_id) || { maxScroll: 0, maxTime: 0 };
        if (ms > cur.maxScroll) cur.maxScroll = ms;
        if (tp > cur.maxTime) cur.maxTime = tp;
        perSession.set(e.session_id, cur);
      }
      const vals = [...perSession.values()];
      const totSess = vals.length;
      let bounced = 0;
      for (const v of vals) if (v.maxScroll < 25 && v.maxTime < 10) bounced++;
      return {
        sessions: totSess,
        bounceRate: totSess > 0 ? (bounced / totSess) * 100 : 0,
        avgScroll: totSess > 0 ? vals.reduce((s, v) => s + v.maxScroll, 0) / totSess : 0,
        avgTime: totSess > 0 ? vals.reduce((s, v) => s + v.maxTime, 0) / totSess : 0,
      };
    }
    async function leadsFor(adId: string, sinceISO: string, untilISO: string): Promise<number> {
      const adIdFilter = `ad_id.eq.${adId},utm_id.eq.${adId},utm_content.eq.${adId}`;
      const { data: rows } = await supabase
        .from("public_leads")
        .select("id")
        .or(adIdFilter)
        .gte("created_at", `${sinceISO}T00:00:00Z`)
        .lt("created_at", `${untilISO}T00:00:00Z`);
      return (rows ?? []).length;
    }

    // Score history ultimi 14gg per tutte le ad presenti
    const adIds = [...adMap.keys()];

    // Età creative: prima spend_date assoluta nel periodo storico (max 180gg) per distinguere
    // creative mature da lanci recenti. Usato dal filtro "Solo attive da >30gg".
    const since180 = new Date(today); since180.setDate(today.getDate() - 180);
    const since180ISO = since180.toISOString().slice(0, 10);
    const { data: firstSeenRows } = await supabase
      .from("meta_ad_spend")
      .select("ad_id, spend_date")
      .eq("user_id", userId)
      .in("ad_id", adIds.length > 0 ? adIds : ["__none__"])
      .gte("spend_date", since180ISO)
      .order("spend_date", { ascending: true });
    const firstSeenByAd = new Map<string, string>();
    for (const r of firstSeenRows ?? []) {
      if (!firstSeenByAd.has(r.ad_id)) firstSeenByAd.set(r.ad_id, r.spend_date);
    }
    const { data: scoreRows } = await supabase
      .from("ad_score_history")
      .select("ad_id, snapshot_date, score")
      .eq("user_id", userId)
      .in("ad_id", adIds.length > 0 ? adIds : ["__none__"])
      .gte("snapshot_date", since14ISO)
      .order("snapshot_date", { ascending: true });
    const scoreByAd = new Map<string, { date: string; score: number }[]>();
    for (const r of scoreRows ?? []) {
      const arr = scoreByAd.get(r.ad_id) ?? [];
      arr.push({ date: r.snapshot_date, score: Number(r.score) });
      scoreByAd.set(r.ad_id, arr);
    }

    // Trend giornaliero CPL/CPC/Bounce per riga (ultimi 14gg) usando spend per data
    const dailySpendByAd = new Map<string, Map<string, { spend: number; clicks: number }>>();
    for (const r of spend14) {
      const m = dailySpendByAd.get(r.ad_id) ?? new Map();
      const cur = m.get(r.spend_date) ?? { spend: 0, clicks: 0 };
      cur.spend += Number(r.spend || 0);
      cur.clicks += Number(r.clicks || 0);
      m.set(r.spend_date, cur);
      dailySpendByAd.set(r.ad_id, m);
    }

    const items = await Promise.all(
      [...adMap.entries()].map(async ([adId, e]) => {
        const [lpCur, lpPrev, leadCur, leadPrev] = await Promise.all([
          lpFor(adId, since7ISO, todayISO),
          lpFor(adId, since14ISO, since7ISO),
          leadsFor(adId, since7ISO, todayISO),
          leadsFor(adId, since14ISO, since7ISO),
        ]);
        function metrics(w: Win, leads: number, lp: AggLp) {
          const cpc = w.clicks > 0 ? w.spend / w.clicks : 0;
          const cpl = leads > 0 ? w.spend / leads : 0;
          const ctr = w.impressions > 0 ? (w.clicks / w.impressions) * 100 : 0;
          const views = computeVideoViews(w.v3sec, w.v25);
          const denomPlays = w.vPlays > 0 ? w.vPlays : (views > 0 ? views : w.impressions);
          const hookRate = computeHookRate(views, denomPlays);
          const holdRate = computeHoldRate(w.vThru, views);
          return { cpc, cpl, ctr, hookRate, holdRate, bounceRate: lp.bounceRate, scrollAvg: lp.avgScroll, timeOnPage: lp.avgTime, leads, sessions: lp.sessions, spend: w.spend };
        }
        const cur = metrics(e.cur, leadCur, lpCur);
        const prev = metrics(e.prev, leadPrev, lpPrev);
        const isNew = e.prev.spend === 0 && e.prev.impressions === 0 && e.cur.spend > 0;

        // Score delta + sparkline (max 14 punti)
        const scoreSeries = (scoreByAd.get(adId) ?? []).map((p) => p.score);
        const scoreCur = scoreSeries.length > 0 ? scoreSeries[scoreSeries.length - 1] : null;
        // primo punto in finestra prev (≥7gg fa)
        const prevSeries = (scoreByAd.get(adId) ?? []).filter((p) => p.date < since7ISO);
        const scorePrev = prevSeries.length > 0 ? prevSeries[prevSeries.length - 1].score : null;

        // Sparkline 14gg di CPL giornaliero (lead non disponibili daily → usiamo CPC come proxy traiettoria spesa/clicks)
        const dailyMap = dailySpendByAd.get(adId);
        const sparkCpc: number[] = [];
        if (dailyMap) {
          const sortedDates = [...dailyMap.keys()].sort();
          for (const d of sortedDates) {
            const v = dailyMap.get(d)!;
            sparkCpc.push(v.clicks > 0 ? v.spend / v.clicks : 0);
          }
        }

        const firstSeenISO = firstSeenByAd.get(adId) ?? null;
        const ageDays = firstSeenISO
          ? Math.floor((today.getTime() - new Date(firstSeenISO).getTime()) / 86400000)
          : null;

        return {
          adId, adName: e.adName, campaignName: e.campaignName,
          cur, prev, isNew,
          scoreCur, scorePrev, scoreSeries,
          sparkCpc,
          firstSeenISO, ageDays,
        };
      })
    );

    return { ok: true as const, items };
  });

// ─────────────────────────────────────────────────────────
// AI WEEKLY SUMMARY: riepilogo testuale Trend Creative WoW
// ─────────────────────────────────────────────────────────
export const getCreativeWowAiSummary = createServerFn({ method: "POST" })
  .inputValidator((input: { accessToken: string; digest: string }) => input)
  .handler(async ({ data }) => {
    await authenticate(data.accessToken);
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { ok: false as const, summary: "AI non configurata." };
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "Sei un performance marketer senior. Analizza dati WoW di creative pubblicitarie Meta e produci 1-2 frasi (max 240 char) in italiano che evidenziano: pattern dominante, creative critica principale, raccomandazione operativa. Tono diretto, niente preamboli, niente bullet.",
            },
            { role: "user", content: data.digest },
          ],
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        console.error("[getCreativeWowAiSummary] AI error", res.status, t);
        return { ok: false as const, summary: res.status === 429 ? "Limite AI raggiunto." : "Errore AI." };
      }
      const j = await res.json();
      const summary = j.choices?.[0]?.message?.content?.trim() || "Nessun insight.";
      return { ok: true as const, summary };
    } catch (err) {
      console.error("[getCreativeWowAiSummary]", err);
      return { ok: false as const, summary: "Errore AI." };
    }
  });

// ============================================================================
// Backfill touch_history per public_leads vuoti, ricostruendo da lp_events.
// Strategia best-effort: per ogni public_lead senza touch_history, cerca
// lp_events con session_id matching (via fbclid/ttclid/email/external_id) e
// ricostruisce un array minimal di touchpoints. Aggiorna la riga.
// ============================================================================
interface TouchRow {
  ch: string;
  ts: number;
  utm_source?: string | null;
  utm_campaign?: string | null;
  fbclid?: string | null;
  ttclid?: string | null;
  page?: string | null;
}

function detectChForBackfill(utm_source: string | null, fbclid: string | null, ttclid: string | null): string {
  const s = (utm_source || "").toLowerCase();
  if (ttclid || s.includes("tiktok")) return "tiktok";
  if (fbclid || s.includes("facebook") || s.includes("meta") || s.includes("instagram")) return "meta";
  if (s.includes("google")) return "google";
  if (s.includes("email") || s.includes("newsletter")) return "email";
  if (!s) return "direct";
  return "organic";
}

function classifyForBackfill(touches: TouchRow[]): string {
  if (!touches || touches.length === 0) return "cold_direct";
  const ad = ["meta", "tiktok", "google", "email"];
  const adT = touches.filter((t) => ad.includes(t.ch));
  const distinct = new Set(adT.map((t) => t.ch));
  if (adT.length === 0) return "cold_direct";
  if (adT.length === 1) return touches.length === 1 ? "cold_direct" : "cold_assisted";
  if (adT.length >= 3 && distinct.size >= 2) return "retarget_multi";
  if (distinct.size >= 2) return "retarget_cross";
  return "retarget_same";
}

export const backfillTouchHistory = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; limit?: number }) => d)
  .handler(async ({ data }) => {
    await authenticate(data.accessToken);
    // Service-role client per fare update bypass RLS (admin op interno).
    const svcUrl = process.env.SUPABASE_URL!;
    const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!svcUrl || !svcKey) {
      return { ok: false as const, processed: 0, updated: 0, error: "Service role mancante" };
    }
    const admin = createClient<Database>(svcUrl, svcKey, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });
    const limit = Math.min(Math.max(data.limit || 200, 1), 1000);

    // Lead candidati: touch_count = 0 oppure touch_history nullo/empty
    const { data: leads, error } = await admin
      .from("public_leads")
      .select("id, email, fbclid, ttclid, external_id, created_at, utm_source, utm_campaign, ad_id")
      .eq("touch_count", 0)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { ok: false as const, processed: 0, updated: 0, error: error.message };

    let updated = 0;
    for (const lead of leads || []) {
      const touches: TouchRow[] = [];
      // Match clicks/sessions via clid o external_id su lp_events
      const filters: string[] = [];
      if (lead.fbclid) filters.push(`fbclid.eq.${lead.fbclid}`);
      if (lead.ttclid) filters.push(`payload->>ttclid.eq.${lead.ttclid}`);
      if (lead.external_id) filters.push(`external_id.eq.${lead.external_id}`);
      if (filters.length === 0 && !lead.ad_id) {
        // Fallback: usa solo il tracking del lead stesso
        const ts = lead.created_at ? new Date(lead.created_at).getTime() : Date.now();
        touches.push({
          ch: detectChForBackfill(lead.utm_source, lead.fbclid, lead.ttclid),
          ts,
          utm_source: lead.utm_source,
          utm_campaign: lead.utm_campaign,
          fbclid: lead.fbclid,
          ttclid: lead.ttclid,
        });
      } else {
        let q = admin
          .from("lp_events")
          .select("created_at, utm_source, utm_campaign, fbclid, ad_id, payload")
          .eq("is_bot", false)
          .order("created_at", { ascending: true })
          .limit(50);
        if (filters.length > 0) {
          q = q.or(filters.join(","));
        } else if (lead.ad_id) {
          q = q.eq("ad_id", lead.ad_id);
        }
        const { data: events } = await q;
        (events || []).forEach((ev) => {
          const ts = ev.created_at ? new Date(ev.created_at).getTime() : Date.now();
          const ttc = (ev.payload && typeof ev.payload === "object" && "ttclid" in ev.payload ? (ev.payload as Record<string, unknown>).ttclid : null) as string | null;
          touches.push({
            ch: detectChForBackfill(ev.utm_source, ev.fbclid, ttc),
            ts,
            utm_source: ev.utm_source,
            utm_campaign: ev.utm_campaign,
            fbclid: ev.fbclid,
            ttclid: ttc,
          });
        });
        if (touches.length === 0) {
          // Fallback al tracking del lead
          const ts = lead.created_at ? new Date(lead.created_at).getTime() : Date.now();
          touches.push({
            ch: detectChForBackfill(lead.utm_source, lead.fbclid, lead.ttclid),
            ts,
            utm_source: lead.utm_source,
            utm_campaign: lead.utm_campaign,
            fbclid: lead.fbclid,
            ttclid: lead.ttclid,
          });
        }
      }

      const sorted = touches.sort((a, b) => a.ts - b.ts);
      const firstChannel = sorted[0]?.ch || "direct";
      const lastChannel = sorted[sorted.length - 1]?.ch || "direct";
      const journeyType = classifyForBackfill(sorted);
      const firstTs = sorted[0]?.ts || Date.now();
      const createdTs = lead.created_at ? new Date(lead.created_at).getTime() : Date.now();
      const ms = Math.max(0, createdTs - firstTs);
      const daysToConvert = Math.round(ms / (1000 * 60 * 60 * 24));
      const hoursToConvert = Math.round(ms / (1000 * 60 * 60));

      const { error: upErr } = await admin
        .from("public_leads")
        .update({
          touch_history: sorted as unknown as Database["public"]["Tables"]["public_leads"]["Update"]["touch_history"],
          touch_count: sorted.length,
          first_channel: firstChannel,
          last_channel: lastChannel,
          journey_type: journeyType,
          days_to_convert: daysToConvert,
          hours_to_convert: hoursToConvert,
        })
        .eq("id", lead.id);
      if (!upErr) updated++;
    }
    return { ok: true as const, processed: (leads || []).length, updated };
  });
