// ── CAMPAGNE TIKTOK ─────────────────────────────────────────────────────────
//  A cosa serve questa pagina: sapere QUALE CAMPAGNA TIKTOK PORTA CLIENTI E A
//  CHE COSTO. Nient'altro. Le metriche di mestiere (hook a 2 secondi, hold a 6,
//  completamento, frequenza, sospetto bot) rispondono alla domanda successiva —
//  «questa non funziona, perché?» — e stanno un piano sotto, negli
//  Approfondimenti e nel dettaglio della singola inserzione.
//
//  COSA È CAMBIATO, E PERCHÉ
//   · È LA GEMELLA DI /CRM/campagne-meta. Prima le due pagine avevano due
//     intestazioni diverse, due barre di filtri in posti diversi, tabelle con
//     colonne diverse e parole diverse per la stessa cosa: chi passava dall'una
//     all'altra doveva reimparare tutto e non poteva confrontarle a occhio.
//     Adesso disposizione, colonne e nomi arrivano da un file solo
//     (ads-manager/campagne-ui.tsx): non possono più divergere.
//   · STESSI MATTONI DEL RESTO DEL CRM. La striscia da dieci celle attaccate,
//     l'header sticky fatto a mano e le tabelle a fondo bianco pieno erano
//     rimasti solo qui. Adesso Pagina · Titolo · BarraAzioni · Scheda · Kpi.
//   · SU TELEFONO SI LEGGE. La tabella a diciotto colonne diventava un
//     rettangolo da trascinare di lato: adesso sotto md ogni riga è una scheda.
//   · IL NUMERO CHE DECIDE C'È. Mancava in tutt'e due le pagine: quanto costa
//     portare a casa UNA persona che paga (costo cliente), non un contatto.
//
//  Sorgente dati: tiktok_ad_spend, attribuzione lead via ttclid.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/crm/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { DateRangeFilter, rangeBoundsAsDates, type DateRange } from "@/crm/DateRangeFilter";
import {
  RefreshCw, Loader2, Download, Music2, Pause, Play,
} from "lucide-react";
import { toast } from "sonner";
import { Pagina, Titolo, Scheda, Segmento, Vuoto } from "@/crm/ui";
import {
  Approfondimenti,
  BarraCampagne,
  ElencoCampagne,
  NumeriCampagne,
  PercorsoCampagne,
  contaEsiti,
  costoPer,
  esitoAggregato,
  esitoDaVerdetto,
  esportaCsvCampagne,
  filtraRighe,
  soldi,
  totaliDi,
  type Esito,
  type Livello,
  type RigaCampagna,
} from "@/crm/ads-manager/campagne-ui";
import { CreativeTrendCard } from "@/crm/ads-manager/CreativeTrendCard";
import { AdDetailDrawer } from "@/crm/tiktok-ads-manager/AdDetailDrawer";
import { FunnelKpiAdsTabTT } from "@/crm/tiktok-ads-manager/FunnelKpiAdsTabTT";
import { ControlTotaleTabTT } from "@/crm/tiktok-ads-manager/ControlTotaleTabTT";
import { AdsGalleryView } from "@/crm/ads-manager/AdsGalleryView";
import { computeQualityRank, type QualityResult } from "@/crm/ads-manager/quality-rank";
import { computeVerdict, computeSetAvgCpl, type Verdict } from "@/crm/ads-manager/verdict";
import {
  computeTodayVsYesterday, computeAlerts, pickWinners, pickLosers,
  type PerfMin,
} from "@/crm/ads-manager/insights";
import {
  computeWoW, predictTomorrowCpl, computeHealthV2Map,
  type PerfQualityInput,
} from "@/crm/ads-manager/quality-v2";
import {
  TodayKpiPanel, WoWPanel, PredictedCplBadge, AdsAlertBar, PodiumRow,
} from "@/crm/ads-manager/AdsInsightsUI";
import { computeAllPresetDeltas } from "@/crm/range-delta";

export const Route = createFileRoute("/CRM/campagne-tiktok")({
  head: () => ({
    meta: [
      { title: "Campagne TikTok — Hair Genius Labs" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: TikTokAdsManagerPage,
});

/* ───────── Types ───────── */

/** Gli strumenti di approfondimento, con gli stessi nomi e nello stesso ordine
 *  della pagina Meta: sono le domande che si fanno DOPO aver letto l'elenco. */
type Strumento = "andamento" | "creative" | "galleria" | "funnel" | "controllo";

const STRUMENTI: { chiave: Strumento; titolo: string; spiega: string }[] = [
  { chiave: "andamento", titolo: "Andamento", spiega: "Come sta andando oggi rispetto a ieri e alla settimana scorsa" },
  { chiave: "creative", titolo: "Trend creative", spiega: "Quali creative stanno salendo e quali si stanno consumando" },
  { chiave: "galleria", titolo: "Galleria", spiega: "Le inserzioni una accanto all'altra, con i numeri sotto" },
  { chiave: "funnel", titolo: "Funnel", spiega: "Dove si perdono le persone fra l'annuncio e la vendita" },
  { chiave: "controllo", titolo: "Controllo totale", spiega: "Il quadro completo di spesa e incassi del periodo" },
];

interface TTRow {
  ad_id: string;
  ad_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  spend_date: string;
  spend: number;
  impressions: number;
  clicks: number;
  reach: number;
  frequency: number;
  video_views: number;
  video_views_p25: number;
  video_views_p50: number;
  video_views_p75: number;
  video_views_p100: number;
  video_watched_2s: number;
  video_watched_6s: number;
  average_video_play: number;
  likes: number;
  comments: number;
  shares: number;
  follows: number;
  profile_visits: number;
  conversions: number;
  cost_per_conversion: number;
  conversion_rate: number;
}

interface AttributedLead {
  ad_id: string | null;
  ttclid: string | null;
  status: string;
  revenue: number;
  isWon: boolean;
}

/** Riga aggregata TikTok mappata sul tipo PerfItem-like atteso da AdsGalleryView. */
interface AdAgg {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  reach: number;
  frequency: number;
  videoPlays: number;
  v25: number; v50: number; v75: number; v100: number;
  hookRate: number;       // 2s/impr
  holdRate: number;       // 6s/impr
  view100Rate: number;    // p100/views
  view25Rate: number;
  view50Rate: number;
  view75Rate: number;
  thruRate: number;       // alias view100Rate (TikTok non ha thru distinto)
  thumbstopRate: number;  // 2s/impr (TikTok proxy)
  postEng: number;
  conversioni: number;
  cpa: number;
  cvr: number;
  // Lead attribution (ttclid)
  lead: number;
  vendite: number;
  fatturato: number;
  cpl: number;
  cplReal: number;
  roas: number;
  netto: number;
  // Trend giornaliero (compatibile con sparkline + insights)
  trend: { date: string; spend: number; clicks: number; lead: number; conv: number; fatigueScore: number; v25: number; v100: number; lpv: number; videoPlays: number; impressions: number; pageViews: number; hqv: number; qualityRate: number; frequency: number; rev: number }[];
  // Health/fatigue (calcolati semplici)
  fatigueScore: number;
  // LP enrichment
  lpSessions: number;
  lpBots: number;
  lpBounces: number;
  lpAvgTime: number;
  lpAvgScroll: number;
  lpStep2Reached: number;
  // Quality input fields necessari a quality-v2
  qualityRate: number;
  portatorePct: number;
  urgenzaScore: number;
}

/* ───────── Helpers ───────── */
function defaultRange(): DateRange {
  const today = new Date();
  const since = new Date(today);
  since.setDate(today.getDate() - 29);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(since), to: iso(today) };
}

/*  I formattatori locali (fmtEUR, fmtINT, fmtPCT, fmtX) sono spariti: scrivevano
    "€1.234" e "1.50x" mentre la pagina Meta scriveva "€ 1.234" e "1,50×" per lo
    stesso numero. Adesso arrivano da campagne-ui.tsx, uno solo per tutt'e due. */

/* ───────── Page ───────── */
function TikTokAdsManagerPage() {
  const { user } = useAuth();
  //  Si parte dalle campagne, non dalle inserzioni: la domanda della pagina è
  //  "quale campagna porta clienti", e si scende solo quando serve capire da
  //  quale inserzione arrivano.
  const [livello, setLivello] = useState<Livello>("campagne");
  const [strumento, setStrumento] = useState<Strumento>("andamento");
  const [esitoFiltro, setEsitoFiltro] = useState<Esito | null>(null);
  const [rows, setRows] = useState<TTRow[]>([]);
  const [leads, setLeads] = useState<AttributedLead[]>([]);
  const [lpByAd, setLpByAd] = useState<Map<string, { sessions: number; bots: number; bounces: number; avgTime: number; avgScroll: number; step2: number }>>(new Map());
  //  Scendere di livello = filtrare. Sono la stessa cosa, e tenerli separati
  //  (tab da una parte, tendine dall'altra) era il motivo per cui si finiva a
  //  guardare le inserzioni di TUTTE le campagne credendo di guardare quelle
  //  di una sola.
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null);
  const [adsetFilter, setAdsetFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);
  const [search, setSearch] = useState("");
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);
  const [advertiserId, setAdvertiserId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* Load advertiser_id */
  useEffect(() => {
    if (!user) return;
    let alive = true;
    supabase.from("tracking_config")
      .select("tiktok_advertiser_id")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (alive && data) setAdvertiserId((data as { tiktok_advertiser_id: string | null }).tiktok_advertiser_id);
      });
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setAccessToken(data.session?.access_token || "");
    });
    return () => { alive = false; };
  }, [user]);

  const range = useMemo(() => {
    const b = rangeBoundsAsDates(dateRange);
    if (b) return b;
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const since = new Date(now); since.setDate(since.getDate() - 30);
    const until = new Date(now); until.setDate(until.getDate() + 1);
    return { since, until };
  }, [dateRange]);

  /* Load data: TikTok spend + lead attribuiti */
  useEffect(() => {
    if (!user) return;
    let alive = true;
    setLoading(true); setErr(null);
    const sinceISO = range.since.toISOString().slice(0, 10);
    const untilISO = range.until.toISOString().slice(0, 10);

    Promise.all([
      supabase.from("tiktok_ad_spend").select("*").eq("user_id", user.id)
        .gte("spend_date", sinceISO).lte("spend_date", untilISO)
        .order("spend_date", { ascending: true }),
      supabase.from("public_leads").select("ad_id, ttclid, status, created_at")
        .not("ttclid", "is", null)
        .gte("created_at", `${sinceISO}T00:00:00Z`)
        .lte("created_at", `${untilISO}T23:59:59Z`),
      supabase.from("crm_leads").select("data, created_at").eq("user_id", user.id)
        .gte("created_at", `${sinceISO}T00:00:00Z`)
        .lte("created_at", `${untilISO}T23:59:59Z`),
      // LP events filtrati per traffic TikTok (utm_source ilike 'tiktok' OR ttclid presente nel payload)
      supabase.from("lp_events").select("session_id, ad_id, is_bot, max_scroll, time_on_page, step, payload")
        .or("utm_source.ilike.%tiktok%,utm_source.ilike.%tt%")
        .gte("created_at", `${sinceISO}T00:00:00Z`)
        .lte("created_at", `${untilISO}T23:59:59Z`)
        .limit(5000),
    ]).then(([spendRes, publicRes, crmRes, lpRes]) => {
      if (!alive) return;
      if (spendRes.error) { setErr(spendRes.error.message); setRows([]); }
      else setRows((spendRes.data as TTRow[]) || []);

      const attributed: AttributedLead[] = [];
      for (const pl of (publicRes.data as Array<{ ad_id: string | null; ttclid: string | null; status: string }> | null) || []) {
        if (!pl.ttclid) continue;
        attributed.push({
          ad_id: pl.ad_id,
          ttclid: pl.ttclid,
          status: pl.status,
          revenue: 0,
          isWon: pl.status === "vinto" || pl.status === "venduto",
        });
      }
      for (const cl of (crmRes.data as Array<{ data: Record<string, unknown> }> | null) || []) {
        const d = cl.data || {};
        const tracking = (d as { tracking?: Record<string, unknown> }).tracking || {};
        const ttclid = (d as { ttclid?: string }).ttclid || (tracking as { ttclid?: string }).ttclid || null;
        if (!ttclid) continue;
        const payment = (d as { payment?: { prezzoFinaleVendita?: number; prezzoTotale?: number } }).payment || {};
        const revenue = payment.prezzoFinaleVendita || payment.prezzoTotale || 0;
        const status = String((d as { status?: string }).status || "").toLowerCase();
        const adId = (d as { ad_id?: string }).ad_id || (tracking as { ad_id?: string }).ad_id || null;
        attributed.push({
          ad_id: adId,
          ttclid: String(ttclid),
          status,
          revenue: Number(revenue) || 0,
          isWon: revenue > 0 || status === "vinto" || status === "venduto" || status === "installato",
        });
      }
      setLeads(attributed);

      // Aggrega LP events per ad_id (sessione = session_id univoco)
      type LpAcc = { sessionIds: Set<string>; botSids: Set<string>; bounceSids: Set<string>; step2Sids: Set<string>; scrollSum: number; timeSum: number; eventCount: number };
      const byAd = new Map<string, LpAcc>();
      const sidsLastEvent = new Map<string, { ad_id: string | null; max_scroll: number; time: number; step: number }>();
      for (const ev of (lpRes.data as Array<{ session_id: string; ad_id: string | null; is_bot: boolean; max_scroll: number | null; time_on_page: number | null; step: number | null; payload: Record<string, unknown> | null }> | null) || []) {
        if (!ev.ad_id) continue;
        let acc = byAd.get(ev.ad_id);
        if (!acc) { acc = { sessionIds: new Set(), botSids: new Set(), bounceSids: new Set(), step2Sids: new Set(), scrollSum: 0, timeSum: 0, eventCount: 0 }; byAd.set(ev.ad_id, acc); }
        acc.sessionIds.add(ev.session_id);
        if (ev.is_bot) acc.botSids.add(ev.session_id);
        if ((ev.step ?? 0) >= 2) acc.step2Sids.add(ev.session_id);
        // ultimo snapshot per session
        const cur = sidsLastEvent.get(ev.session_id) || { ad_id: ev.ad_id, max_scroll: 0, time: 0, step: 0 };
        cur.max_scroll = Math.max(cur.max_scroll, ev.max_scroll ?? 0);
        cur.time = Math.max(cur.time, ev.time_on_page ?? 0);
        cur.step = Math.max(cur.step, ev.step ?? 0);
        sidsLastEvent.set(ev.session_id, cur);
      }
      // Calcola bounces e medie per ad
      for (const [sid, snap] of sidsLastEvent) {
        const acc = byAd.get(snap.ad_id ?? "");
        if (!acc) continue;
        if (snap.time <= 10 || (snap.max_scroll <= 15 && snap.step < 2)) acc.bounceSids.add(sid);
        acc.scrollSum += snap.max_scroll;
        acc.timeSum += snap.time;
        acc.eventCount += 1;
      }
      const lpMap = new Map<string, { sessions: number; bots: number; bounces: number; avgTime: number; avgScroll: number; step2: number }>();
      for (const [adId, acc] of byAd) {
        const sessions = acc.sessionIds.size;
        lpMap.set(adId, {
          sessions,
          bots: acc.botSids.size,
          bounces: acc.bounceSids.size,
          step2: acc.step2Sids.size,
          avgTime: acc.eventCount > 0 ? acc.timeSum / acc.eventCount : 0,
          avgScroll: acc.eventCount > 0 ? acc.scrollSum / acc.eventCount : 0,
        });
      }
      setLpByAd(lpMap);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [user, range.since, range.until]);

  /* Aggregate per ad — schema PerfItem-like */
  const ads: AdAgg[] = useMemo(() => {
    const map = new Map<string, AdAgg & { _w2: number; _w6: number }>();
    for (const r of rows) {
      let a = map.get(r.ad_id);
      if (!a) {
        a = {
          ad_id: r.ad_id,
          ad_name: r.ad_name || r.ad_id,
          campaign_name: r.campaign_name || "—",
          spend: 0, impressions: 0, clicks: 0, ctr: 0, cpc: 0, cpm: 0,
          reach: 0, frequency: 0,
          videoPlays: 0, v25: 0, v50: 0, v75: 0, v100: 0,
          hookRate: 0, holdRate: 0, view100Rate: 0, view25Rate: 0, view50Rate: 0, view75Rate: 0,
          thruRate: 0, thumbstopRate: 0,
          postEng: 0, conversioni: 0, cpa: 0, cvr: 0,
          lead: 0, vendite: 0, fatturato: 0, cpl: 0, cplReal: 0, roas: 0, netto: 0,
          trend: [],
          fatigueScore: 0,
          lpSessions: 0, lpBots: 0, lpBounces: 0, lpAvgTime: 0, lpAvgScroll: 0, lpStep2Reached: 0,
          qualityRate: 0, portatorePct: 0, urgenzaScore: 0,
          _w2: 0, _w6: 0,
        };
        map.set(r.ad_id, a);
      }
      a.spend += Number(r.spend) || 0;
      a.impressions += Number(r.impressions) || 0;
      a.clicks += Number(r.clicks) || 0;
      a.reach = Math.max(a.reach, Number(r.reach) || 0);
      a.videoPlays += Number(r.video_views) || 0;
      a.v25 += Number(r.video_views_p25) || 0;
      a.v50 += Number(r.video_views_p50) || 0;
      a.v75 += Number(r.video_views_p75) || 0;
      a.v100 += Number(r.video_views_p100) || 0;
      a.postEng += (Number(r.likes) || 0) + (Number(r.comments) || 0) + (Number(r.shares) || 0);
      a.conversioni += Number(r.conversions) || 0;
      a._w2 += Number(r.video_watched_2s) || 0;
      a._w6 += Number(r.video_watched_6s) || 0;
      a.trend.push({
        date: r.spend_date,
        spend: Number(r.spend) || 0,
        clicks: Number(r.clicks) || 0,
        lead: 0,
        conv: Number(r.conversions) || 0,
        fatigueScore: 0,
        v25: Number(r.video_views_p25) || 0,
        v100: Number(r.video_views_p100) || 0,
        lpv: 0,
        videoPlays: Number(r.video_views) || 0,
        impressions: Number(r.impressions) || 0,
        pageViews: 0, hqv: 0, qualityRate: 0,
        frequency: Number(r.frequency) || 0,
        rev: 0,
      });
    }

    const leadByAd = new Map<string, { count: number; vendite: number; revenue: number }>();
    const untracked = { count: 0, vendite: 0, revenue: 0 };
    for (const l of leads) {
      if (l.ad_id && map.has(l.ad_id)) {
        const cur = leadByAd.get(l.ad_id) || { count: 0, vendite: 0, revenue: 0 };
        cur.count += 1;
        if (l.isWon) cur.vendite += 1;
        cur.revenue += l.revenue;
        leadByAd.set(l.ad_id, cur);
      } else {
        untracked.count += 1;
        if (l.isWon) untracked.vendite += 1;
        untracked.revenue += l.revenue;
      }
    }
    const totalSpend = [...map.values()].reduce((s, a) => s + a.spend, 0);

    for (const a of map.values()) {
      a.ctr = a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0;
      a.cpc = a.clicks > 0 ? a.spend / a.clicks : 0;
      a.cpm = a.impressions > 0 ? (a.spend / a.impressions) * 1000 : 0;
      a.frequency = a.reach > 0 ? a.impressions / a.reach : 0;
      a.cpa = a.conversioni > 0 ? a.spend / a.conversioni : 0;
      a.cvr = a.clicks > 0 ? (a.conversioni / a.clicks) * 100 : 0;
      a.view100Rate = a.videoPlays > 0 ? (a.v100 / a.videoPlays) * 100 : 0;
      a.view25Rate = a.videoPlays > 0 ? (a.v25 / a.videoPlays) * 100 : 0;
      a.view50Rate = a.videoPlays > 0 ? (a.v50 / a.videoPlays) * 100 : 0;
      a.view75Rate = a.videoPlays > 0 ? (a.v75 / a.videoPlays) * 100 : 0;
      a.thruRate = a.view100Rate;
      a.hookRate = a.impressions > 0 ? (a._w2 / a.impressions) * 100 : 0;
      a.holdRate = a.impressions > 0 ? (a._w6 / a.impressions) * 100 : 0;
      a.thumbstopRate = a.hookRate;
      a.trend.sort((x, y) => x.date.localeCompare(y.date));

      const direct = leadByAd.get(a.ad_id) || { count: 0, vendite: 0, revenue: 0 };
      const share = totalSpend > 0 ? a.spend / totalSpend : 0;
      a.lead = direct.count + Math.round(untracked.count * share);
      a.vendite = direct.vendite + Math.round(untracked.vendite * share);
      a.fatturato = direct.revenue + untracked.revenue * share;
      a.cpl = a.lead > 0 ? a.spend / a.lead : 0;
      a.cplReal = a.cpl;
      a.roas = a.spend > 0 ? a.fatturato / a.spend : 0;
      a.netto = a.fatturato - a.spend;

      // Distribuisci revenue/lead per giorno proporzionalmente alla spesa giornaliera
      const trendSpendSum = a.trend.reduce((s, t) => s + t.spend, 0);
      if (trendSpendSum > 0) {
        for (const t of a.trend) {
          const w = t.spend / trendSpendSum;
          t.lead = Math.round(a.lead * w);
          t.rev = a.fatturato * w;
        }
      }

      // LP enrichment
      const lp = lpByAd.get(a.ad_id);
      if (lp) {
        a.lpSessions = lp.sessions;
        a.lpBots = lp.bots;
        a.lpBounces = lp.bounces;
        a.lpAvgTime = lp.avgTime;
        a.lpAvgScroll = lp.avgScroll;
        a.lpStep2Reached = lp.step2;
        a.qualityRate = lp.sessions > 0 ? ((lp.sessions - lp.bounces) / lp.sessions) * 100 : 0;
      }

      // Fatigue proxy: frequency > 3 + hold basso
      const freqPenalty = Math.max(0, (a.frequency - 2.5) * 20);
      const holdPenalty = a.holdRate > 0 && a.holdRate < 5 ? 30 : 0;
      a.fatigueScore = Math.min(100, freqPenalty + holdPenalty);
    }
    return [...map.values()].sort((a, b) => b.spend - a.spend);
  }, [rows, leads, lpByAd]);

  /* Filter by search + campaign + adset + onlyActive */
  //  La ricerca NON entra qui: cercare è trovare una riga, non cambiare i
  //  totali. Il testo si applica solo all'elenco (filtraRighe), così i numeri
  //  in cima restano quelli del pezzo di account che si sta guardando.
  const baseFiltered = useMemo(() => {
    const adsetById = new Map<string, string>();
    for (const r of rows) if (r.ad_id && r.adset_id) adsetById.set(r.ad_id, r.adset_id);
    const campaignById = new Map<string, string>();
    for (const r of rows) if (r.ad_id && r.campaign_id) campaignById.set(r.ad_id, r.campaign_id);
    return ads.filter(a => {
      if (campaignFilter && campaignById.get(a.ad_id) !== campaignFilter) return false;
      if (adsetFilter && adsetById.get(a.ad_id) !== adsetFilter) return false;
      return true;
    });
  }, [ads, campaignFilter, adsetFilter, rows]);

  /* QualityRank classification */
  const classification = useMemo<Map<string, QualityResult>>(() => {
    return computeQualityRank(baseFiltered.map(a => ({
      ad_id: a.ad_id,
      spend: a.spend,
      lead: a.lead,
      cpl: a.cpl,
      impressions: a.impressions,
      hookRate: a.hookRate,
      holdRate: a.holdRate,
      view50Rate: a.view50Rate,
      videoPlays: a.videoPlays,
    })));
  }, [baseFiltered]);

  /* Verdict map */
  const verdictMap = useMemo<Map<string, Verdict>>(() => {
    const setAvgCpl = computeSetAvgCpl(baseFiltered.map(a => ({ spend: a.spend, lead: a.lead })));
    const m = new Map<string, Verdict>();
    for (const a of baseFiltered) {
      m.set(a.ad_id, computeVerdict({
        spend: a.spend,
        lead: a.lead,
        cpl: a.cpl,
        roas: a.roas,
        roasNetto: a.spend > 0 ? a.netto / a.spend : null,
        qualityRank: classification.get(a.ad_id),
        healthScore: null,
        fatigueScore: a.fatigueScore,
        setAvgCpl,
        trendDays: a.trend.length,
      }));
    }
    return m;
  }, [baseFiltered, classification]);

  /* Health map V2 (multi-fattore) */
  const healthMap = useMemo<Map<string, number | null>>(() => {
    const v2 = computeHealthV2Map(baseFiltered as unknown as PerfQualityInput[]);
    const m = new Map<string, number | null>();
    for (const [id, r] of v2) m.set(id, r.score);
    return m;
  }, [baseFiltered]);

  /*  Le inserzioni del pezzo di account che si sta guardando. Il filtro per
   *  esito e la ricerca si applicano più in basso, sulle righe dell'elenco,
   *  perché valgono identici ai tre livelli. */
  const filtered = baseFiltered;

  /* Insights: today vs yesterday, WoW, predicted CPL, alerts, podio */
  const perfMin = useMemo<PerfMin[]>(() =>
    baseFiltered.map(a => ({
      ad_id: a.ad_id, spend: a.spend, lead: a.lead,
      conversioni: a.conversioni, fatturato: a.fatturato, netto: a.netto,
      cpl: a.cpl, roas: a.roas, qualityRate: a.qualityRate,
      fatigueScore: a.fatigueScore, portatorePct: 0, urgenzaScore: 0,
      trend: a.trend.map(t => ({ date: t.date, spend: t.spend, lead: t.lead, conv: t.conv, rev: t.rev, fatigueScore: t.fatigueScore })),
    })),
  [baseFiltered]);
  const todayVsYesterday = useMemo(() => computeTodayVsYesterday(perfMin), [perfMin]);
  const wow = useMemo(() => computeWoW(perfMin as unknown as PerfQualityInput[]), [perfMin]);
  const predictedCpl = useMemo(() => {
    const aggMap = new Map<string, { spend: number; lead: number }>();
    for (const p of perfMin) for (const t of p.trend ?? []) {
      const cur = aggMap.get(t.date) || { spend: 0, lead: 0 };
      cur.spend += t.spend; cur.lead += t.lead;
      aggMap.set(t.date, cur);
    }
    const points = [...aggMap.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, spend: v.spend, lead: v.lead }));
    const predicted = predictTomorrowCpl(points);
    const last7 = points.slice(-7);
    const totalSpend = last7.reduce((s, p) => s + p.spend, 0);
    const totalLead = last7.reduce((s, p) => s + p.lead, 0);
    const currentAvg = totalLead > 0 ? totalSpend / totalLead : null;
    const trend7d = last7.map(p => p.lead > 0 ? p.spend / p.lead : 0).filter(v => v > 0);
    return { predicted, currentAvg, trend7d };
  }, [perfMin]);
  const [dailySpendTiktok, setDailySpendTiktok] = useState(0);
  useEffect(() => {
    if (!user) return;
    supabase.from("tracking_config").select("daily_spend_tiktok").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setDailySpendTiktok(Number((data as { daily_spend_tiktok?: number } | null)?.daily_spend_tiktok || 0)));
  }, [user]);
  const alerts = useMemo(() => computeAlerts(perfMin, dailySpendTiktok), [perfMin, dailySpendTiktok]);
  const winners = useMemo(() => pickWinners(perfMin), [perfMin]);
  const losers = useMemo(() => pickLosers(perfMin), [perfMin]);
  const adNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of ads) m.set(a.ad_id, a.ad_name);
    return (id: string) => m.get(id) || id;
  }, [ads]);

  /* Preset deltas per DateRangeFilter */
  const presetDeltas = useMemo(() => {
    const points = perfMin.flatMap(p => (p.trend ?? []).map(t => ({
      date: t.date, spend: t.spend, lead: t.lead, revenue: t.rev,
    })));
    return computeAllPresetDeltas(points);
  }, [perfMin]);

  /* Hierarchy aggregations */
  const campaignsAgg = useMemo(() => {
    const m = new Map<string, { id: string; name: string; spend: number; impressions: number; lead: number; vendite: number; fatturato: number; ads: number }>();
    const adsByCampaign = new Map<string, Set<string>>();
    for (const r of rows) {
      const cid = r.campaign_id || "—";
      let c = m.get(cid);
      if (!c) { c = { id: cid, name: r.campaign_name || cid, spend: 0, impressions: 0, lead: 0, vendite: 0, fatturato: 0, ads: 0 }; m.set(cid, c); }
      c.spend += Number(r.spend) || 0;
      c.impressions += Number(r.impressions) || 0;
      let s = adsByCampaign.get(cid); if (!s) { s = new Set(); adsByCampaign.set(cid, s); } s.add(r.ad_id);
    }
    // Lead/vendite/fatturato dagli ad aggregati
    const adByCampaign = new Map<string, string>();
    for (const r of rows) if (r.ad_id) adByCampaign.set(r.ad_id, r.campaign_id || "—");
    for (const a of ads) {
      const cid = adByCampaign.get(a.ad_id) || "—";
      const c = m.get(cid); if (!c) continue;
      c.lead += a.lead; c.vendite += a.vendite; c.fatturato += a.fatturato;
    }
    for (const [cid, set] of adsByCampaign) { const c = m.get(cid); if (c) c.ads = set.size; }
    return [...m.values()].sort((a, b) => b.spend - a.spend);
  }, [rows, ads]);

  const adsetsAgg = useMemo(() => {
    const m = new Map<string, { id: string; campaign_id: string; campaign_name: string; spend: number; impressions: number; lead: number; vendite: number; fatturato: number; ads: number }>();
    const adsByAdset = new Map<string, Set<string>>();
    for (const r of rows) {
      const aid = r.adset_id || "—";
      let g = m.get(aid);
      //  campaign_id serve a filtrare i gruppi quando si scende dentro una
      //  campagna: senza, il livello "Gruppi" mostrava quelli di tutto
      //  l'account anche dopo aver aperto una campagna sola.
      if (!g) { g = { id: aid, campaign_id: r.campaign_id || "—", campaign_name: r.campaign_name || "—", spend: 0, impressions: 0, lead: 0, vendite: 0, fatturato: 0, ads: 0 }; m.set(aid, g); }
      g.spend += Number(r.spend) || 0;
      g.impressions += Number(r.impressions) || 0;
      let s = adsByAdset.get(aid); if (!s) { s = new Set(); adsByAdset.set(aid, s); } s.add(r.ad_id);
    }
    const adByAdset = new Map<string, string>();
    for (const r of rows) if (r.ad_id) adByAdset.set(r.ad_id, r.adset_id || "—");
    for (const a of ads) {
      const aid = adByAdset.get(a.ad_id) || "—";
      const g = m.get(aid); if (!g) continue;
      g.lead += a.lead; g.vendite += a.vendite; g.fatturato += a.fatturato;
    }
    for (const [aid, set] of adsByAdset) { const g = m.get(aid); if (g) g.ads = set.size; }
    return [...m.values()].sort((a, b) => b.spend - a.spend);
  }, [rows, ads]);

  /* ═══════════════════════════════════════════════════════════════════════
     LE RIGHE DELL'ELENCO — la stessa forma ai tre livelli
     ═════════════════════════════════════════════════════════════════════ */

  /*  Campagne, gruppi e inserzioni diventano la STESSA riga (RigaCampagna):
   *  è quello che permette a un'unica tabella di servire i tre livelli, e a
   *  Meta e TikTok di mostrare le stesse colonne senza copiare codice. */

  const righeCampagne = useMemo<RigaCampagna[]>(() => {
    const visibili = campaignsAgg;
    const spesa = visibili.reduce((s, c) => s + c.spend, 0);
    const contatti = visibili.reduce((s, c) => s + c.lead, 0);
    const medio = costoPer(spesa, contatti);
    return visibili.map(c => {
      const base = { spesa: c.spend, contatti: c.lead, clienti: c.vendite, incasso: c.fatturato };
      const { esito, motivo } = esitoAggregato(base, { costoContattoMedio: medio });
      return {
        id: c.id,
        nome: c.name,
        sotto: `${c.ads} ${c.ads === 1 ? "inserzione" : "inserzioni"}`,
        ...base,
        esito,
        motivo,
      };
    });
  }, [campaignsAgg]);

  const righeGruppi = useMemo<RigaCampagna[]>(() => {
    const visibili = campaignFilter
      ? adsetsAgg.filter(g => g.campaign_id === campaignFilter)
      : adsetsAgg;
    const spesa = visibili.reduce((s, g) => s + g.spend, 0);
    const contatti = visibili.reduce((s, g) => s + g.lead, 0);
    const medio = costoPer(spesa, contatti);
    return visibili.map(g => {
      const base = { spesa: g.spend, contatti: g.lead, clienti: g.vendite, incasso: g.fatturato };
      const { esito, motivo } = esitoAggregato(base, { costoContattoMedio: medio });
      return {
        //  TikTok non restituisce il nome del gruppo nel sync della spesa: si
        //  mostra la coda dell'id, che è comunque quello che si cerca quando
        //  si torna sulla piattaforma.
        id: g.id,
        nome: g.id === "—" ? "Senza gruppo" : `Gruppo ${g.id.slice(-8)}`,
        sotto: `${g.campaign_name} · ${g.ads} ${g.ads === 1 ? "inserzione" : "inserzioni"}`,
        ...base,
        esito,
        motivo,
      };
    });
  }, [adsetsAgg, campaignFilter]);

  /*  Le inserzioni sono l'unico livello con una creativa, quindi l'unico su cui
   *  ha senso il verdetto tecnico (qualità del video, affaticamento, punteggi):
   *  si riusa quello, tradotto nelle stesse cinque parole degli altri livelli. */
  const righeInserzioni = useMemo<RigaCampagna[]>(() =>
    filtered.map(a => {
      const v = verdictMap.get(a.ad_id);
      return {
        id: a.ad_id,
        nome: a.ad_name,
        sotto: a.campaign_name,
        spesa: a.spend,
        contatti: a.lead,
        clienti: a.vendite,
        incasso: a.fatturato,
        esito: esitoDaVerdetto(v?.kind, a.spend),
        motivo: v?.reason,
      };
    }),
  [filtered, verdictMap]);

  const righeLivello = livello === "campagne" ? righeCampagne
    : livello === "gruppi" ? righeGruppi
    : righeInserzioni;

  /*  I conteggi degli esiti seguono la ricerca ma non il filtro per esito:
   *  altrimenti, filtrando "Da spegnere", gli altri conteggi andrebbero a zero
   *  e non si potrebbe più tornare indietro con un clic. */
  const conteggiEsito = useMemo(
    () => contaEsiti(filtraRighe(righeLivello, { testo: search })),
    [righeLivello, search],
  );
  const righeVisibili = useMemo(
    () => filtraRighe(righeLivello, { esito: esitoFiltro, testo: search }),
    [righeLivello, esitoFiltro, search],
  );
  const totali = useMemo(() => totaliDi(righeVisibili), [righeVisibili]);

  const conteggiLivello: Record<Livello, number> = {
    campagne: righeCampagne.length,
    gruppi: righeGruppi.length,
    inserzioni: righeInserzioni.length,
  };

  /*  La galleria mostra le stesse inserzioni dell'elenco e NELLO STESSO ORDINE:
   *  due liste ordinate diversamente della stessa cosa fanno pensare che una
   *  delle due stia nascondendo qualcosa. */
  const adLikeList = useMemo(() => {
    //  Ai livelli superiori l'elenco parla di campagne o gruppi: la galleria
    //  mostra allora tutte le inserzioni del pezzo di account aperto.
    const ordine = livello === "inserzioni" ? righeVisibili : righeInserzioni;
    const perId = new Map(filtered.map(a => [a.ad_id, a]));
    return ordine
      .map(r => perId.get(r.id))
      .filter((a): a is AdAgg => !!a)
      .map(a => ({
        id: a.ad_id,
        name: a.ad_name,
        status: "ACTIVE", // TikTok non restituisce lo status nel sync della spesa
        creative: { thumbnail: null, isVideo: a.videoPlays > 0, videoFileName: null },
      }));
  }, [filtered, livello, righeVisibili, righeInserzioni]);

  /* PerfByAd (Map<string, PerfLike>) */
  const perfByAd = useMemo(() => {
    const m = new Map<string, AdAgg>();
    for (const a of filtered) m.set(a.ad_id, a);
    return m;
  }, [filtered]);

  /* Empty fatigue map (richiesta da AdsGalleryView ma non popolata su TT) */
  const fatigueMap = useMemo(() => {
    const m = new Map<string, { isFatigued: boolean; reasons: string[] }>();
    for (const a of filtered) {
      m.set(a.ad_id, {
        isFatigued: a.fatigueScore >= 50,
        reasons: a.frequency > 3 ? [`Frequency ${a.frequency.toFixed(1)}×`] : [],
      });
    }
    return m;
  }, [filtered]);

  /* Sync */
  const handleSync = async () => {
    setRefreshing(true);
    try {
      const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch("/hooks/tiktok-spend-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anon}` },
        body: JSON.stringify({
          since: range.since.toISOString().slice(0, 10),
          until: range.until.toISOString().slice(0, 10),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Sync failed");
      const r = (json.results || []).reduce((s: number, x: { rows?: number }) => s + (x.rows || 0), 0);
      toast.success(`Sync TikTok completata: ${r} righe`);
      const sinceISO = range.since.toISOString().slice(0, 10);
      const untilISO = range.until.toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("tiktok_ad_spend").select("*").eq("user_id", user!.id)
        .gte("spend_date", sinceISO).lte("spend_date", untilISO)
        .order("spend_date", { ascending: true });
      if (!error) setRows((data as TTRow[]) || []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync fallita");
    } finally {
      setRefreshing(false);
    }
  };

  /* Bulk pause/resume via TikTok API */
  const callPauseApi = async (adIds: string[], action: "pause" | "resume") => {
    if (!user || adIds.length === 0) return;
    const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const res = await fetch("/hooks/tiktok-ad-pause", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${anon}` },
      body: JSON.stringify({ userId: user.id, adIds, action }),
    });
    const json = await res.json();
    if (!res.ok) {
      const msg = json.message || json.error || "TikTok API error";
      throw new Error(msg);
    }
    return json;
  };
  const handleBulkPause = async (idsOverride?: string[]) => {
    const ids = idsOverride && idsOverride.length > 0 ? idsOverride : Array.from(selected);
    if (ids.length === 0) return;
    try {
      await callPauseApi(ids, "pause");
      toast.success(`${ids.length} ad messe in pausa`);
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pausa fallita");
    }
  };
  const handleBulkResume = async (idsOverride?: string[]) => {
    const ids = idsOverride && idsOverride.length > 0 ? idsOverride : Array.from(selected);
    if (ids.length === 0) return;
    try {
      await callPauseApi(ids, "resume");
      toast.success(`${ids.length} ad riattivate`);
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Riattiva fallita");
    }
  };
  const handleSingleAction = async (adId: string, action: "pause" | "resume") => {
    try {
      await callPauseApi([adId], action);
      toast.success(action === "pause" ? "Ad in pausa" : "Ad riattivata");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Operazione fallita");
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  /* ═══════════════════════════════════════════════════════════════════════
     NAVIGAZIONE — scendere di livello È filtrare
     ═════════════════════════════════════════════════════════════════════ */

  const campagnaAperta = campaignFilter ? campaignsAgg.find(c => c.id === campaignFilter) : null;
  const gruppoAperto = adsetFilter ? adsetsAgg.find(g => g.id === adsetFilter) : null;

  const tappe: { etichetta: string; livello: Livello }[] = [
    { etichetta: "Tutte le campagne", livello: "campagne" },
    ...(campagnaAperta ? [{ etichetta: campagnaAperta.name, livello: "gruppi" as Livello }] : []),
    ...(gruppoAperto ? [{ etichetta: `Gruppo ${gruppoAperto.id.slice(-8)}`, livello: "inserzioni" as Livello }] : []),
  ];

  /** Salire di livello svuota i filtri più profondi: un filtro che resta acceso
   *  mentre l'etichetta dice "tutte" è il modo più rapido per far dire che i
   *  numeri non tornano. */
  const cambiaLivello = (l: Livello) => {
    if (l === "campagne") { setCampaignFilter(null); setAdsetFilter(null); }
    if (l === "gruppi") setAdsetFilter(null);
    setEsitoFiltro(null);
    setLivello(l);
  };

  const apriRiga = (r: RigaCampagna) => {
    if (livello === "campagne") {
      setCampaignFilter(r.id); setAdsetFilter(null); setEsitoFiltro(null); setLivello("gruppi");
      return;
    }
    if (livello === "gruppi") {
      setAdsetFilter(r.id); setEsitoFiltro(null); setLivello("inserzioni");
      return;
    }
    setSelectedAdId(r.id);
  };

  const daSpegnere = righeVisibili.filter(r => r.esito === "spegnere");

  return (
    <Pagina larga>
      <Titolo
        testo="Campagne TikTok"
        icona={Music2}
        nota={
          <>
            {conteggiLivello.campagne} campagne · {conteggiLivello.inserzioni} inserzioni ·{" "}
            <span className="font-medium">{soldi(totali.spesa)} spesi</span>
            {totali.clienti > 0 && (
              <> · <span className="font-medium text-emerald-700">{totali.clienti} clienti</span></>
            )}
          </>
        }
        azioni={
          <>
            <Segmento
              onClick={() => esportaCsvCampagne(righeVisibili, livello, "TikTok")}
              titolo="Scarica in CSV esattamente le righe che stai vedendo"
            >
              <Download className="mr-1 inline h-3.5 w-3.5" />
              Esporta
            </Segmento>
            <Segmento
              onClick={() => { if (!refreshing) void handleSync(); }}
              titolo="Riscarica da TikTok la spesa del periodo scelto"
            >
              {refreshing
                ? <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="mr-1 inline h-3.5 w-3.5" />}
              {refreshing ? "Aggiorno…" : "Aggiorna"}
            </Segmento>
          </>
        }
      />

      <BarraCampagne
        periodo={<DateRangeFilter value={dateRange} onChange={setDateRange} presetDeltas={presetDeltas} />}
        livello={livello}
        onLivello={cambiaLivello}
        conteggiLivello={conteggiLivello}
        ricerca={search}
        onRicerca={setSearch}
        esito={esitoFiltro}
        onEsito={setEsitoFiltro}
        conteggiEsito={conteggiEsito}
      />

      <PercorsoCampagne tappe={tappe} onRisali={cambiaLivello} />

      {err && (
        <Scheda classeCorpo="p-3 text-[12.5px] text-rose-700">
          Non sono riuscito a leggere i dati TikTok: {err}
        </Scheda>
      )}

      {/* ── LA RISPOSTA ─────────────────────────────────────────────────── */}
      <NumeriCampagne totali={totali} />

      <ElencoCampagne
        righe={righeVisibili}
        livello={livello}
        caricamento={loading}
        onApri={apriRiga}
        vuotoTitolo={
          esitoFiltro || search
            ? "Nessuna riga con questi filtri"
            : "Nessuna spesa TikTok nel periodo"
        }
        vuotoTesto={
          esitoFiltro || search
            ? "Cambia periodo, svuota la ricerca o togli il filtro dell'esito."
            : "Controlla che Advertiser ID e token TikTok siano configurati in Impostazioni, poi premi Aggiorna."
        }
        vuotoIcona={Music2}
      />

      {/*  Le inserzioni da spegnere si spengono da qui: è l'unica azione che
          la pagina deve permettere senza scendere nel dettaglio, e vale solo
          al livello in cui esiste un'inserzione da mettere in pausa. */}
      {livello === "inserzioni" && daSpegnere.length > 0 && (
        <Scheda classeCorpo="flex flex-wrap items-center gap-3 p-3">
          <span className="text-[12.5px]">
            <span className="font-semibold text-rose-700">{daSpegnere.length}</span>{" "}
            {daSpegnere.length === 1 ? "inserzione sta spendendo" : "inserzioni stanno spendendo"} senza portare
            clienti: {soldi(daSpegnere.reduce((s, r) => s + r.spesa, 0))} nel periodo.
          </span>
          <div className="flex-1" />
          <Segmento
            onClick={() => void handleBulkPause(daSpegnere.map(r => r.id))}
            titolo="Mette in pausa su TikTok tutte le inserzioni con esito «Da spegnere»"
          >
            <Pause className="mr-1 inline h-3.5 w-3.5" />
            Metti in pausa tutte
          </Segmento>
          {selected.size > 0 && (
            <Segmento
              onClick={() => void handleBulkResume()}
              titolo={`Riattiva le ${selected.size} inserzioni selezionate`}
            >
              <Play className="mr-1 inline h-3.5 w-3.5" />
              Riattiva selezionate ({selected.size})
            </Segmento>
          )}
        </Scheda>
      )}

      {/* ── PERCHÉ ──────────────────────────────────────────────────────── */}
      <Approfondimenti
        chiaveMemoria="campagne-tiktok-approfondimenti"
        nota="Le metriche di mestiere: servono quando l'elenco ha già detto quale riga non va"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {STRUMENTI.map(s => (
            <Segmento
              key={s.chiave}
              attivo={strumento === s.chiave}
              onClick={() => setStrumento(s.chiave)}
              titolo={s.spiega}
            >
              {s.titolo}
            </Segmento>
          ))}
        </div>

        {strumento === "andamento" && (
          <div className="space-y-3">
            <TodayKpiPanel data={todayVsYesterday} />
            <WoWPanel data={wow} />
            <PredictedCplBadge
              predicted={predictedCpl.predicted}
              currentAvg={predictedCpl.currentAvg}
              trend7d={predictedCpl.trend7d}
            />
            {/*  «Mostra le consumate» porta all'elenco filtrato per «Da
                sistemare»: è lì che finisce un'inserzione affaticata, e
                mandare altrove sarebbe una promessa non mantenuta. */}
            <AdsAlertBar
              alerts={alerts}
              onShowDegraded={() => { setLivello("inserzioni"); setEsitoFiltro("sistemare"); }}
            />
            <DispersioneClic
              clic={baseFiltered.reduce((s, a) => s + a.clicks, 0)}
              sessioni={baseFiltered.reduce((s, a) => s + a.lpSessions, 0)}
            />
            <PodiumRow winners={winners} losers={losers} nameById={adNameById} onOpen={setSelectedAdId} />
          </div>
        )}

        {strumento === "creative" && (
          accessToken
            ? <CreativeTrendCard accessToken={accessToken} source="tiktok" onOpen={setSelectedAdId} />
            : <Vuoto titolo="Sessione scaduta" testo="Ricarica la pagina per rileggere il trend delle creative." />
        )}

        {strumento === "galleria" && (
          adLikeList.length === 0
            ? <Vuoto titolo="Nessuna inserzione da mostrare" testo="Cambia periodo o risali di livello." />
            : (
              <AdsGalleryView
                ads={adLikeList}
                perfByAd={perfByAd as unknown as Map<string, unknown>}
                classification={classification}
                classifyOn
                fatigueMap={fatigueMap}
                healthMap={healthMap}
                verdictMap={verdictMap}
                selected={selected}
                onToggleSelect={toggleSelect}
                onOpen={setSelectedAdId}
                onOpenFatigue={setSelectedAdId}
                onPause={(id: string) => handleSingleAction(id, "pause")}
                onResume={(id: string) => handleSingleAction(id, "resume")}
                resuming={false}
                sinceISO={range.since.toISOString()}
                untilISO={range.until.toISOString()}
              />
            )
        )}

        {strumento === "funnel" && (
          <FunnelKpiAdsTabTT
            perf={filtered as unknown as Parameters<typeof FunnelKpiAdsTabTT>[0]["perf"]}
            since={range.since}
            until={range.until}
            parentRange={dateRange}
            onOpenAd={setSelectedAdId}
          />
        )}

        {strumento === "controllo" && (
          <ControlTotaleTabTT since={range.since} until={range.until} />
        )}
      </Approfondimenti>

      <AdDetailDrawer
        ad={selectedAdId ? (filtered.find(a => a.ad_id === selectedAdId) as unknown as Parameters<typeof AdDetailDrawer>[0]["ad"]) || null : null}
        open={!!selectedAdId}
        onClose={() => setSelectedAdId(null)}
        sinceISO={range.since.toISOString().slice(0, 10)}
        untilISO={range.until.toISOString().slice(0, 10)}
        advertiserId={advertiserId}
        onSync={handleSync}
        onPauseAd={(id) => handleSingleAction(id, "pause")}
        onResumeAd={(id) => handleSingleAction(id, "resume")}
      />
    </Pagina>
  );
}

/* ───────── Dispersione fra clic e sessioni ─────────
   Quante persone hanno cliccato e non sono mai arrivate sulla pagina: se il
   numero è alto, il problema non è la creativa ma il link. Stesso blocco,
   stesse soglie e stesse parole della pagina Meta. */
function DispersioneClic({ clic, sessioni }: { clic: number; sessioni: number }) {
  if (clic <= 0) return null;
  const persi = ((clic - sessioni) / clic) * 100;
  const tono = persi >= 30
    ? "border-rose-500/25 bg-rose-500/10 text-rose-700"
    : persi >= 15
      ? "border-amber-500/25 bg-amber-500/10 text-amber-700"
      : "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2 ${tono}`}>
      <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
        Persi fra il clic e la pagina
      </span>
      <span className="text-[15px] font-semibold tabular-nums">{persi.toFixed(1)}%</span>
      <span className="text-[11.5px] opacity-80">
        {sessioni.toLocaleString("it-IT")} arrivi su {clic.toLocaleString("it-IT")} clic
      </span>
      <span className="ml-auto text-[11.5px] opacity-80">
        {persi >= 30
          ? "Controlla il link: redirect rotto o ttclid perso per strada"
          : persi >= 15
            ? "Da tenere d'occhio"
            : "Nella norma"}
      </span>
    </div>
  );
}
