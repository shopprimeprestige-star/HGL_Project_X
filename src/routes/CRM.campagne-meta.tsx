// ── CAMPAGNE META ───────────────────────────────────────────────────────────
//  A cosa serve questa pagina: sapere QUALE CAMPAGNA META PORTA CLIENTI E A CHE
//  COSTO. Nient'altro. Tutto il resto — hook rate, frequenza, scroll medio,
//  punteggi compositi, previsione del costo contatto di domani — risponde alla
//  domanda successiva («questa non funziona, perché?») e sta un piano sotto,
//  negli Approfondimenti e nel dettaglio della singola inserzione.
//
//  COSA È CAMBIATO, E PERCHÉ
//   · È LA GEMELLA DI /CRM/campagne-tiktok. Disposizione, colonne, parole e
//     scala di giudizio arrivano da un file solo (ads-manager/campagne-ui.tsx):
//     passare da una pagina all'altra non chiede più di reimparare niente, e le
//     due piattaforme si confrontano a occhio.
//   · UN PIANO DI COMANDI INVECE DI CINQUE. C'erano intestazione + tab +
//     striscia KPI + tre riquadri-filtro + toolbar tabella prima di vedere un
//     numero. Adesso: titolo, una barra (periodo · livello · ricerca · esito),
//     i numeri, l'elenco.
//   · CAMPAGNE, GRUPPI E INSERZIONI HANNO LE STESSE COLONNE. Prima ogni livello
//     aveva la sua tabella: le campagne mostravano impression e CTR, le
//     inserzioni ottanta metriche, i gruppi quasi niente. La domanda però è la
//     stessa ai tre livelli, quindi le colonne sono le stesse.
//   · VIA LA TABELLA A OTTANTA COLONNE. Era il motivo per cui la pagina non
//     rispondeva: la colonna che serviva era sempre fuori campo, su telefono
//     era un rettangolo da trascinare di lato, e non aveva gemella su TikTok.
//     Le metriche fini restano dov'è utile guardarle — nel dettaglio della
//     singola inserzione (Analisi approfondita), nel Funnel e nel Controllo
//     totale — e le loro definizioni restano in ads-manager/columns.tsx.
//   · IL NUMERO CHE DECIDE C'È. Mancava: quanto costa portare a casa UNA
//     persona che paga (costo cliente), non un contatto.

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/crm/AuthContext";
import { useUserSettings } from "@/crm/UserSettingsContext";
import { supabase } from "@/integrations/supabase/client";
import {
  getCreativePerformance,
  syncMetaSpendNow,
  setAdsStatus,
  updateAdName,
  duplicateAd,
  generateAdInsights,
} from "@/crm/ads-financials.functions";
import { getMetaHierarchy } from "@/crm/ads-financials.functions";
import { ControlTotaleTab } from "@/crm/ControlTotaleTab";
import { AdDeepAnalysisTab } from "@/crm/AdDeepAnalysisTab";
import { TopMoversCard } from "@/crm/ads-manager/TopMoversCard";
import { CreativeTrendCard } from "@/crm/ads-manager/CreativeTrendCard";
import { FunnelKpiAdsTab } from "@/crm/ads-manager/FunnelKpiAdsTab";
import { DateRangeFilter, rangeBoundsAsDates, type DateRange } from "@/crm/DateRangeFilter";
import {
  Filter,
  Download,
  Copy,
  Pause,
  BarChart3,
  ImageIcon,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Sparkles,
  X,
  ExternalLink,
  Loader2,
  Lightbulb,
  Wand2,
  RotateCcw,
  Pencil,
  Play,
} from "lucide-react";
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
import { CampoFinestra, Finestra, SezioneFinestra } from "@/crm/ui/Finestra";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/CRM/campagne-meta")({
  head: () => ({
    meta: [
      { title: "Campagne Meta — Hair Genius Labs" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdsManagerPage,
});

/* ─────────── Tipi ─────────── */

type Tab = "campaigns" | "adsets" | "ads" | "trend" | "funnel" | "control";

interface Campaign {
  id: string;
  name: string;
  status: string;
  objective?: string;
  budget: number;
  budgetType: string | null;
}
interface Adset {
  id: string;
  name: string;
  status: string;
  campaign_id: string;
  optimization: string | null;
  budget: number;
  budgetType: string | null;
}
interface Creative {
  id?: string;
  thumbnail: string | null;
  title: string | null;
  body: string | null;
  description: string | null;
  link: string | null;
  cta: string | null;
  isVideo: boolean;
  videoDuration?: number | null;
  videoFileName?: string | null;
}
interface AdNode {
  id: string;
  name: string;
  status: string;
  adset_id: string;
  campaign_id: string;
  creative: Creative | null;
}

interface PerfItem {
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
  netto: number;
  showRate: number;
  closeRate: number;
  aov: number;
  cac: number;
  cpl: number;
  roas: number;
  disagioAvg: number | null;
  lpsCoverage: number | null;
  paybackDays: number | null;
  ctr: number;
  cpm: number;
  ctrLink: number;
  ctrOutbound: number;
  lpViewRate: number;
  reach?: number;
  frequency?: number;
  metaClicks?: number;
  metaCtr?: number;
  metaLpv?: number;
  metaLpViewRate?: number;
  videoPlays: number;
  v25: number;
  v50: number;
  v75: number;
  v100: number;
  thru: number;
  outboundClicks: number;
  linkClicks: number;
  postEng: number;
  lpv: number;
  hookRate: number;
  holdRate: number;
  thumbstopRate: number;
  view25Rate: number;
  view50Rate: number;
  view75Rate: number;
  view100Rate: number;
  thruRate: number;
  // F4: LP quality
  pageViews: number;
  hqv: number;
  qualityRate: number;
  cps0: number;
  cps25: number;
  cps50: number;
  cps75: number;
  cps100: number;
  cpt15: number;
  cpt30: number;
  cpt60: number;
  cplQ: number;
  // F5: lead quality
  portatorePct: number;
  urgenzaScore: number;
  // F6: fatigue
  avgScroll: number;
  avgTime: number;
  fatigueScore: number;
  // Sprint 1: Ponte Ads↔LP
  lpSessions?: number;
  lpBots?: number;
  lpBounces?: number;
  lpBounceRate?: number;
  lpAvgTime?: number;
  lpAvgScroll?: number;
  lpStep2Reached?: number;
  lpDropStepAvg?: number;
  // Costo prodotto (per ROAS netto v2) — opzionale, fornito dal backend o globale.
  costoProdotto?: number;
  trend: {
    date: string;
    spend: number;
    impressions: number;
    clicks: number;
    lpv: number;
    lead: number;
    conv: number;
    rev: number;
    videoPlays: number;
    v25: number;
    v100: number;
    pageViews: number;
    hqv: number;
    qualityRate: number;
    frequency: number;
    fatigueScore: number;
  }[];
}

/* ─────────── Date range (allineato al CRM: DateRangeFilter) ─────────── */

function defaultRange(): DateRange {
  const today = new Date();
  const since = new Date(today);
  since.setDate(today.getDate() - 29);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: iso(since), to: iso(today) };
}
function rangeBoundsFor(r: DateRange): { since: Date; until: Date } {
  const b = rangeBoundsAsDates(r);
  if (b) return b;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const since = new Date(now);
  since.setDate(since.getDate() - 30);
  const until = new Date(now);
  until.setDate(until.getDate() + 1);
  return { since, until };
}
function rangeKeyOf(r: DateRange): string {
  return `${r.from || "_"}_${r.to || "_"}`;
}

/* ─────────── Formati numerici ───────────
   Restano quelli di columns.tsx perché il dettaglio della singola inserzione
   (drawer) li usa ancora. Le colonne dell'elenco, invece, arrivano tutte da
   campagne-ui.tsx: è quello che tiene identiche le due pagine. */
import { fmtEUR, fmtINT, fmtPCT, fmtX } from "@/crm/ads-manager/columns";
import {
  computeTodayVsYesterday,
  computeAlerts,
  pickWinners,
  pickLosers,
} from "@/crm/ads-manager/insights";
import {
  computeHealthV2Map,
  computeCpql,
  computeRoasNetto,
  computeTrafficQuality,
  computeWoW,
  predictTomorrowCpl,
} from "@/crm/ads-manager/quality-v2";
import { computeAllPresetDeltas, type RangeDeltaPoint } from "@/crm/range-delta";
import {
  TodayKpiPanel,
  AdsAlertBar,
  PodiumRow,
  WoWPanel,
  PredictedCplBadge,
} from "@/crm/ads-manager/AdsInsightsUI";
import { AdsGalleryView } from "@/crm/ads-manager/AdsGalleryView";
import { computeQualityRank } from "@/crm/ads-manager/quality-rank";
import { CacheStatusBadge } from "@/crm/ads-manager/CacheStatusBadge";
import { loadGatingConfig } from "@/crm/ads-manager/gating-config";
import { computeVerdict, computeSetAvgCpl, type Verdict } from "@/crm/ads-manager/verdict";

/* ─────────── Strumenti di approfondimento ───────────
   Stessi nomi e stesso ordine della pagina TikTok: sono le domande che si
   fanno DOPO aver letto l'elenco. */
type Strumento = "andamento" | "creative" | "galleria" | "funnel" | "controllo";

const STRUMENTI: { chiave: Strumento; titolo: string; spiega: string }[] = [
  {
    chiave: "andamento",
    titolo: "Andamento",
    spiega: "Come sta andando oggi rispetto a ieri e alla settimana scorsa",
  },
  {
    chiave: "creative",
    titolo: "Trend creative",
    spiega: "Quali creative stanno salendo e quali si stanno consumando",
  },
  {
    chiave: "galleria",
    titolo: "Galleria",
    spiega: "Le inserzioni una accanto all'altra, con i numeri sotto",
  },
  {
    chiave: "funnel",
    titolo: "Funnel",
    spiega: "Dove si perdono le persone fra l'annuncio e la vendita",
  },
  {
    chiave: "controllo",
    titolo: "Controllo totale",
    spiega: "Il quadro completo di spesa e incassi del periodo",
  },
];

/* ─────────── UI helpers ─────────── */

function StatusPill({ s }: { s: string }) {
  const norm = s?.toUpperCase() || "";
  let cls = "bg-slate-100 text-slate-700";
  let dot = "bg-slate-400";
  let lbl = "—";
  if (norm.includes("ACTIVE")) {
    cls = "bg-emerald-50 text-emerald-700";
    dot = "bg-emerald-500";
    lbl = "Attivo";
  } else if (norm.includes("PAUSED")) {
    cls = "bg-slate-100 text-slate-700";
    dot = "bg-slate-400";
    lbl = "In pausa";
  } else if (norm.includes("PENDING") || norm.includes("REVIEW")) {
    cls = "bg-amber-50 text-amber-700";
    dot = "bg-amber-500";
    lbl = "In revisione";
  } else if (
    norm.includes("DELETED") ||
    norm.includes("ARCHIVED") ||
    norm.includes("DISAPPROVED")
  ) {
    cls = "bg-rose-50 text-rose-700";
    dot = "bg-rose-500";
    lbl = "Inattivo";
  } else if (norm) {
    lbl = norm.toLowerCase();
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {lbl}
    </span>
  );
}

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: "Scopri di più",
  SIGN_UP: "Iscriviti",
  SHOP_NOW: "Acquista ora",
  GET_QUOTE: "Richiedi preventivo",
  BOOK_TRAVEL: "Prenota",
  CONTACT_US: "Contattaci",
  GET_OFFER: "Ottieni offerta",
  APPLY_NOW: "Candidati",
  DOWNLOAD: "Scarica",
  WHATSAPP_MESSAGE: "Invia WhatsApp",
  MESSAGE_PAGE: "Invia messaggio",
  SUBSCRIBE: "Iscriviti",
};
function ctaLabel(c: string | null) {
  if (!c) return "Scopri di più";
  return (
    CTA_LABELS[c] ||
    c
      .replace(/_/g, " ")
      .toLowerCase()
      .replace(/\b\w/g, (m) => m.toUpperCase())
  );
}

/* ─────────── PAGINA ─────────── */

function AdsManagerPage() {
  const { user } = useAuth();
  const { canAccess, loading: settingsLoading } = useUserSettings();
  const [accessToken, setAccessToken] = useState<string>("");
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) setAccessToken(data.session?.access_token || "");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setAccessToken(s?.access_token || "");
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [user?.id]);

  //  Si parte dalle campagne, non dalle inserzioni: la domanda della pagina è
  //  "quale campagna porta clienti", e si scende solo quando serve capire da
  //  quale inserzione arrivano.
  const [livello, setLivello] = useState<Livello>("campagne");
  const [strumento, setStrumento] = useState<Strumento>("andamento");
  const [esitoFiltro, setEsitoFiltro] = useState<Esito | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange);
  const range = useMemo(() => rangeBoundsFor(dateRange), [dateRange]);
  const rangeKey = useMemo(() => rangeKeyOf(dateRange), [dateRange]);

  const [hierarchy, setHierarchy] = useState<{
    campaigns: Campaign[];
    adsets: Adset[];
    ads: AdNode[];
  } | null>(null);
  const [perf, setPerf] = useState<PerfItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  //  Scendere di livello = filtrare: sono la stessa cosa, e tenerli separati
  //  (tab da una parte, tendine dall'altra) era il motivo per cui si finiva a
  //  guardare le inserzioni di TUTTE le campagne credendo di guardarne una.
  const [campaignId, setCampaignId] = useState<string | "all">("all");
  const [adsetId, setAdsetId] = useState<string | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // "Mostra solo ad attive nel periodo": passa il range a getMetaHierarchy
  // così ads/adset/campagne senza spesa nel range non vengono nemmeno scaricate.
  const [onlyActiveInRange, setOnlyActiveInRange] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("ads-mgr-only-active") !== "false";
  });
  useEffect(() => {
    window.localStorage.setItem("ads-mgr-only-active", String(onlyActiveInRange));
  }, [onlyActiveInRange]);
  const [drawerInitialTab, setDrawerInitialTab] = useState<"riepilogo" | "approfondita">(
    "approfondita",
  );

  // Cache freshness info per badge "dati in cache"
  const [cacheInfo, setCacheInfo] = useState<{ cachedAt: number; isStale: boolean } | null>(null);

  const [drawerAdId, setDrawerAdId] = useState<string | null>(null);
  const [pauseConfirm, setPauseConfirm] = useState<string[] | null>(null);
  const [pausing, setPausing] = useState(false);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);

  // Loading progress (campagne → gruppi → inserzioni → creative)
  const [progress, setProgress] = useState<{ step: number; label: string } | null>(null);

  // Fatigue thresholds (caricati da tracking_config)
  const [fatigueCfg, setFatigueCfg] = useState<{
    enabled: boolean;
    freq: number;
    scroll: number;
    time: number;
  }>({
    enabled: true,
    freq: 3.5,
    scroll: 40,
    time: 15,
  });
  // Budget giornaliero Meta (per alert "spesa di oggi oltre il budget")
  const [dailyBudgetMeta, setDailyBudgetMeta] = useState(0);
  useEffect(() => {
    if (!user) return;
    let alive = true;
    supabase
      .from("tracking_config")
      .select(
        "fatigue_alerts_enabled, fatigue_freq_threshold, fatigue_scroll_threshold, fatigue_time_threshold, daily_spend_meta",
      )
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive || !data) return;
        setFatigueCfg({
          enabled: (data as { fatigue_alerts_enabled?: boolean }).fatigue_alerts_enabled ?? true,
          freq: Number((data as { fatigue_freq_threshold?: number }).fatigue_freq_threshold ?? 3.5),
          scroll: Number(
            (data as { fatigue_scroll_threshold?: number }).fatigue_scroll_threshold ?? 40,
          ),
          time: Number((data as { fatigue_time_threshold?: number }).fatigue_time_threshold ?? 15),
        });
        setDailyBudgetMeta(Number((data as { daily_spend_meta?: number }).daily_spend_meta ?? 0));
      });
    return () => {
      alive = false;
    };
  }, [user?.id]);

  async function handlePauseSelected(adIds: string[]) {
    if (adIds.length === 0) return;
    setPausing(true);
    const t = toast.loading(
      `Metto in pausa ${adIds.length} inserzion${adIds.length === 1 ? "e" : "i"}…`,
    );
    try {
      const r = await setAdsStatus({ data: { accessToken, adIds, status: "PAUSED" } });
      if (r.okCount === r.total) {
        toast.success(`${r.okCount} inserzion${r.okCount === 1 ? "e messa" : "i messe"} in pausa`, {
          id: t,
        });
      } else {
        const errs = r.results
          .filter((x) => !x.ok)
          .map((x) => x.error)
          .filter(Boolean);
        toast.warning(`${r.okCount}/${r.total} in pausa`, {
          id: t,
          description: errs[0] || "Alcune ads non sono state aggiornate.",
        });
      }
      setSelected(new Set());
      setPauseConfirm(null);
      await loadAll(false, true);
    } catch (e) {
      toast.error("Pausa fallita", {
        id: t,
        description: e instanceof Error ? e.message : "Errore",
      });
    } finally {
      setPausing(false);
    }
  }

  async function handleResumeSelected(adIds: string[]) {
    if (adIds.length === 0) return;
    setResuming(true);
    const t = toast.loading(`Riattivo ${adIds.length} inserzion${adIds.length === 1 ? "e" : "i"}…`);
    try {
      const r = await setAdsStatus({ data: { accessToken, adIds, status: "ACTIVE" } });
      if (r.okCount === r.total)
        toast.success(
          `${r.okCount} inserzion${r.okCount === 1 ? "e riattivata" : "i riattivate"}`,
          { id: t },
        );
      else {
        const errs = r.results
          .filter((x) => !x.ok)
          .map((x) => x.error)
          .filter(Boolean);
        toast.warning(`${r.okCount}/${r.total} riattivate`, { id: t, description: errs[0] });
      }
      setSelected(new Set());
      await loadAll(false, true);
    } catch (e) {
      toast.error("Riattivazione fallita", {
        id: t,
        description: e instanceof Error ? e.message : "Errore",
      });
    } finally {
      setResuming(false);
    }
  }

  async function handleRename(adId: string, newName: string) {
    const t = toast.loading("Aggiorno nome inserzione…");
    try {
      await updateAdName({ data: { accessToken, adId, name: newName } });
      toast.success("Nome aggiornato su Meta", { id: t });
      setRenaming(null);
      await loadAll(false, true);
    } catch (e) {
      toast.error("Modifica fallita", {
        id: t,
        description: e instanceof Error ? e.message : "Errore",
      });
    }
  }

  async function handleDuplicate(adId: string) {
    setDuplicating(adId);
    const t = toast.loading("Duplico inserzione su Meta…");
    try {
      const r = await duplicateAd({ data: { accessToken, adId } });
      toast.success("Inserzione duplicata (in pausa)", {
        id: t,
        description: r.copied_ad_id ? `Nuovo ID: ${String(r.copied_ad_id).slice(-8)}` : undefined,
      });
      await loadAll(false, true);
    } catch (e) {
      toast.error("Duplicazione fallita", {
        id: t,
        description: e instanceof Error ? e.message : "Errore",
      });
    } finally {
      setDuplicating(null);
    }
  }

  const allowed = settingsLoading || canAccess("ads");

  /* ───── Cache helpers (5 min) ─────
   * IMPORTANTE: la cache della gerarchia FULL è scopata per range, altrimenti
   * cambiando data l'utente vedeva ancora le campagne del range precedente
   * (es. "11 aprile" mostrata anche con range 14-20/04). */
  const cacheKey = `ads-mgr-hierarchy-v2-${rangeKey}`;
  const PERF_CACHE_KEY = (k: string) => `ads-mgr-perf-${k}-v2`;
  const MIN_HIERARCHY_CACHE_KEY = (k: string) => `ads-mgr-hierarchy-min-${k}-v1`;
  const CACHE_TTL = 5 * 60 * 1000;
  function readCache<T>(key: string): T | null {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) return null;
      return data as T;
    } catch {
      return null;
    }
  }
  function writeCache(key: string, data: unknown) {
    try {
      window.localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
    } catch {
      /* */
    }
  }

  /* ───── Fetch ───── */
  async function loadAll(
    showSpinner = true,
    force = false,
    options?: { enrichHierarchy?: boolean },
  ) {
    if (!accessToken) return;
    if (showSpinner) setLoading(true);
    setErr(null);

    const hCache = readCache<{ campaigns: Campaign[]; adsets: Adset[]; ads: AdNode[] }>(cacheKey);
    const pCache = !force ? readCache<PerfItem[]>(PERF_CACHE_KEY(rangeKey)) : null;
    const minHierarchyCache = readCache<{ campaigns: Campaign[]; adsets: Adset[]; ads: AdNode[] }>(
      MIN_HIERARCHY_CACHE_KEY(rangeKey),
    );
    const shouldEnrich = options?.enrichHierarchy ?? (!force && !hCache);

    if (!force && hCache && pCache) {
      setHierarchy(hCache);
      setPerf(pCache);
      setProgress(null);
      setLoading(false);
      return;
    }

    try {
      setProgress({ step: 1, label: "Carico performance inserzioni…" });
      const p = await getCreativePerformance({
        data: {
          accessToken,
          sinceISO: range.since.toISOString(),
          untilISO: range.until.toISOString(),
          bypassCache: force,
        },
      });
      const perfItems = p.items as PerfItem[];
      setPerf(perfItems);
      writeCache(PERF_CACHE_KEY(rangeKey), perfItems);

      if (hCache && !force) {
        setHierarchy(hCache);
      } else if (minHierarchyCache && !force) {
        setHierarchy(minHierarchyCache);
      } else {
        const adsetIds = new Set<string>();
        const campaignNames = new Set<string>();
        const minimalAds: AdNode[] = perfItems
          .filter((item) => (item.spend ?? 0) > 0)
          .map((item) => {
            const adId = item.ad_id;
            const inferredAdsetId = `derived-adset-${adId}`;
            const inferredCampaignId = item.campaign_name
              ? `derived-campaign-${item.campaign_name}`
              : "derived-campaign-unknown";
            adsetIds.add(inferredAdsetId);
            campaignNames.add(item.campaign_name || "Senza campagna");
            return {
              id: adId,
              name: item.ad_name || `Ad ${adId.slice(-8)}`,
              status: "ACTIVE",
              adset_id: inferredAdsetId,
              campaign_id: inferredCampaignId,
              creative: null,
            } satisfies AdNode;
          });
        const minimalHierarchy = {
          campaigns: Array.from(campaignNames).map((name) => ({
            id: name === "Senza campagna" ? "derived-campaign-unknown" : `derived-campaign-${name}`,
            name,
            status: "ACTIVE",
            objective: undefined,
            budget: 0,
            budgetType: null,
          })),
          adsets: Array.from(adsetIds).map((id) => ({
            id,
            name: "Gruppo attivo nel periodo",
            status: "ACTIVE",
            campaign_id:
              minimalAds.find((a) => a.adset_id === id)?.campaign_id || "derived-campaign-unknown",
            optimization: null,
            budget: 0,
            budgetType: null,
          })),
          ads: minimalAds,
        };
        setHierarchy(minimalHierarchy);
        writeCache(MIN_HIERARCHY_CACHE_KEY(rangeKey), minimalHierarchy);
      }

      setCacheInfo({ cachedAt: p._cachedAt ?? Date.now(), isStale: Boolean(p._isStale) });

      // Arricchimento gerarchia (nomi/creative Meta) sempre SILENZIOSO e
      // totalmente in background: la UI è già usabile con i dati di performance,
      // quindi non blocchiamo né mostriamo lo step 2/4 (che dava l'impressione
      // di "bloccato" se Meta era lento o rate-limited).
      setProgress(null);
      if (!shouldEnrich) return;

      void getMetaHierarchy({
        data: {
          accessToken,
          bypassCache: force,
          ...(onlyActiveInRange
            ? { sinceISO: range.since.toISOString(), untilISO: range.until.toISOString() }
            : {}),
        },
      })
        .then((h) => {
          const hData = { campaigns: h.campaigns, adsets: h.adsets, ads: h.ads };
          setHierarchy(hData);
          writeCache(cacheKey, hData);
          setCacheInfo((prev) => ({
            cachedAt: Math.min(prev?.cachedAt ?? Date.now(), h._cachedAt ?? Date.now()),
            isStale: Boolean(prev?.isStale || h._isStale),
          }));
        })
        .catch(() => {
          // Silenzioso: la UI resta usabile con la gerarchia minima.
        });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Errore caricamento");
      setProgress(null);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void loadAll(); /* eslint-disable-next-line */
  }, [accessToken, rangeKey, onlyActiveInRange]);

  async function refreshFromMeta() {
    if (!accessToken || refreshing) return;
    setRefreshing(true);
    const t = toast.loading("Sincronizzazione con Meta in corso…");
    try {
      const r = await syncMetaSpendNow({
        data: {
          accessToken,
          sinceISO: range.since.toISOString(),
          untilISO: range.until.toISOString(),
        },
      });
      toast.success(`Sync completato · ${r.rows} righe`, { id: t, description: r.range });
      await loadAll(false, true, { enrichHierarchy: false });
    } catch (e) {
      toast.error("Sync fallito", {
        id: t,
        description: e instanceof Error ? e.message : "Errore",
      });
    } finally {
      setRefreshing(false);
    }
  }

  /** Reset: risale a "tutte le campagne", svuota ricerca, filtro esito e
   *  selezione, rimette il periodo predefinito e butta la copia locale dei
   *  dati. Non tocca gli Approfondimenti: quella è una preferenza di lettura,
   *  non un filtro che possa far sembrare sbagliati i numeri. */
  async function resetDashboard() {
    if (resetting) return;
    setResetting(true);
    setLivello("campagne");
    setCampaignId("all");
    setAdsetId("all");
    setSearch("");
    setEsitoFiltro(null);
    setSelected(new Set());
    setDateRange(defaultRange());
    try {
      window.localStorage.removeItem(cacheKey);
      // Pulisci anche tutte le vecchie chiavi cross-range (v1, perf, min)
      Object.keys(window.localStorage)
        .filter(
          (k) =>
            k.startsWith("ads-mgr-perf-") ||
            k.startsWith("ads-mgr-hierarchy-v") ||
            k.startsWith("ads-mgr-hierarchy-min-"),
        )
        .forEach((k) => window.localStorage.removeItem(k));
    } catch {
      /* */
    }
    // Il cambio di rangeKey farà ripartire loadAll automaticamente.
    setTimeout(() => setResetting(false), 800);
    toast.success("Dashboard ripristinata");
  }

  // FILTRO RANGE: mostra solo campagne/adset/ads con spesa>0 nel range corrente.
  // Senza questo, dopo un cambio data la gerarchia full di Meta (cachata server-side
  // su rangeKey diverso) faceva apparire campagne come "Hair Genius Labs | 11 aprile"
  // anche selezionando 14-20/04. La verità è in `perf` (sempre coerente col range).
  const adIdsInRange = useMemo(() => {
    const s = new Set<string>();
    for (const p of perf) if ((p.spend ?? 0) > 0) s.add(p.ad_id);
    return s;
  }, [perf]);

  const allCampaigns = hierarchy?.campaigns ?? [];
  const allAdsets = hierarchy?.adsets ?? [];
  const allAds = hierarchy?.ads ?? [];

  const adsAll = useMemo(
    () => (onlyActiveInRange ? allAds.filter((a) => adIdsInRange.has(a.id)) : allAds),
    [allAds, adIdsInRange, onlyActiveInRange],
  );
  const activeAdsetIds = useMemo(() => {
    if (!onlyActiveInRange) return null;
    const s = new Set<string>();
    for (const a of adsAll) if (a.adset_id) s.add(a.adset_id);
    return s;
  }, [adsAll, onlyActiveInRange]);
  const adsets = useMemo(
    () => (activeAdsetIds ? allAdsets.filter((a) => activeAdsetIds.has(a.id)) : allAdsets),
    [allAdsets, activeAdsetIds],
  );
  const activeCampaignIds = useMemo(() => {
    if (!onlyActiveInRange) return null;
    const s = new Set<string>();
    for (const a of adsAll) if (a.campaign_id) s.add(a.campaign_id);
    return s;
  }, [adsAll, onlyActiveInRange]);
  const campaigns = useMemo(
    () =>
      activeCampaignIds ? allCampaigns.filter((c) => activeCampaignIds.has(c.id)) : allCampaigns,
    [allCampaigns, activeCampaignIds],
  );

  const adsetsForCampaign = useMemo(
    () => (campaignId === "all" ? adsets : adsets.filter((a) => a.campaign_id === campaignId)),
    [adsets, campaignId],
  );

  // Cascade status: se la campagna o l'adset di un'ad è PAUSED/inattivo,
  // l'ad viene mostrata come PAUSED indipendentemente dal suo status reale.
  // Solo se entrambi (campagna + adset) sono ACTIVE, segui lo status reale dell'ad.
  const adsetById = useMemo(() => {
    const m = new Map<string, Adset>();
    for (const a of allAdsets) m.set(a.id, a);
    return m;
  }, [allAdsets]);
  const campaignById = useMemo(() => {
    const m = new Map<string, Campaign>();
    for (const c of allCampaigns) m.set(c.id, c);
    return m;
  }, [allCampaigns]);
  function effectiveStatusOf(ad: AdNode): string {
    const adset = adsetById.get(ad.adset_id);
    const camp = campaignById.get(ad.campaign_id);
    const isActive = (s: string | undefined) =>
      !!s && /ACTIVE/i.test(s) && !/PAUSED|DELETED|ARCHIVED|DISAPPROVED/i.test(s);
    if (camp && !isActive(camp.status)) return "PAUSED";
    if (adset && !isActive(adset.status)) return "PAUSED";
    return ad.status;
  }

  // Health Score v2 + metriche sintetiche quality (CPQL, ROAS netto, Traffic Quality)
  // calcolate client-side da quality-v2.ts e iniettate come __ fields nel perfByAd.
  const healthV2 = useMemo(() => computeHealthV2Map(perf), [perf]);
  const healthMap = useMemo(() => {
    const m = new Map<string, number | null>();
    healthV2.forEach((v, k) => m.set(k, v.score));
    return m;
  }, [healthV2]);

  const perfByAd = useMemo(() => {
    const m = new Map<
      string,
      PerfItem & {
        __health?: number | null;
        __cpql?: number;
        __roasNetto?: number;
        __tq?: number | null;
      }
    >();
    for (const p of perf) {
      const tq = computeTrafficQuality(p);
      m.set(p.ad_id, {
        ...p,
        __health: healthMap.get(p.ad_id) ?? null,
        __cpql: computeCpql(p),
        __roasNetto: computeRoasNetto(p),
        __tq: tq.score,
      });
    }
    return m;
  }, [perf, healthMap]);

  // Fatigue map per badge gallery: stessa logica della tabella, riusata.
  const fatigueMap = useMemo(() => {
    const m = new Map<string, { isFatigued: boolean; reasons: string[] }>();
    for (const p of perf) {
      const reasons: string[] = [];
      if ((p.frequency ?? 0) >= fatigueCfg.freq)
        reasons.push(`Freq ${(p.frequency ?? 0).toFixed(2)} ≥ ${fatigueCfg.freq.toFixed(1)}`);
      if (p.pageViews > 0 && p.avgScroll < fatigueCfg.scroll)
        reasons.push(`Scroll ${p.avgScroll.toFixed(0)}% < ${fatigueCfg.scroll}%`);
      if (p.pageViews > 0 && p.avgTime < fatigueCfg.time)
        reasons.push(`Tempo ${Math.round(p.avgTime)}s < ${fatigueCfg.time}s`);
      m.set(p.ad_id, {
        isFatigued: fatigueCfg.enabled && (p.spend ?? 0) > 0 && reasons.length > 0,
        reasons,
      });
    }
    return m;
  }, [perf, fatigueCfg]);

  //  Le inserzioni del pezzo di account che si sta guardando. La ricerca NON
  //  entra qui: cercare è trovare una riga, non cambiare i totali. Il testo e
  //  il filtro per esito si applicano più in basso, sulle righe dell'elenco,
  //  perché valgono identici ai tre livelli.
  const visibleAds = useMemo(() => {
    let list = adsAll;
    if (campaignId !== "all") list = list.filter((a) => a.campaign_id === campaignId);
    if (adsetId !== "all") list = list.filter((a) => a.adset_id === adsetId);
    // Nascondi le ad senza attività nel range: senza spesa non sono state attive.
    list = list.filter((a) => (perfByAd.get(a.id)?.spend ?? 0) > 0);
    return [...list].sort(
      (a, b) => (perfByAd.get(b.id)?.spend ?? 0) - (perfByAd.get(a.id)?.spend ?? 0),
    );
  }, [adsAll, campaignId, adsetId, perfByAd]);

  // ───── Classifica qualità v3 (z-score, no spend/ROAS) ─────
  // Composito su 5 dimensioni: video engagement + LP traffic + lead quality
  // + CPL efficiency relativo + CVR. Spend/fatturato/netto/ROAS NON entrano
  // nel punteggio (restano visibili come dato). Classifica a 5 fasce via
  // z-score sulla distribuzione del set visibile.
  const classification = useMemo(() => {
    const items = visibleAds.map((a) => perfByAd.get(a.id)).filter(Boolean) as PerfItem[];
    // Carica le soglie configurate dall'utente in Impostazioni (localStorage).
    return computeQualityRank(items, loadGatingConfig());
  }, [visibleAds, perfByAd]);

  // ───── Verdetto operativo per ogni inserzione (Step 2 refactor) ─────
  // Combina classifica + ROAS netto + spesa + lead in 1 etichetta + motivo + azione.
  const verdictMap = useMemo(() => {
    const items = visibleAds.map((a) => perfByAd.get(a.id)).filter(Boolean) as PerfItem[];
    const setAvgCpl = computeSetAvgCpl(
      items.map((p) => ({ spend: p.spend ?? 0, lead: p.lead ?? 0 })),
    );
    const map = new Map<string, Verdict>();
    for (const a of visibleAds) {
      const p = perfByAd.get(a.id);
      if (!p) continue;
      map.set(
        a.id,
        computeVerdict({
          spend: p.spend ?? 0,
          lead: p.lead ?? 0,
          cpl: p.cpl ?? 0,
          roas: p.roas ?? 0,
          roasNetto: (p as PerfItem & { __roasNetto?: number }).__roasNetto ?? null,
          qualityRank: classification.get(a.id),
          fatigueScore: p.fatigueScore ?? 0,
          setAvgCpl,
          trendDays: (p.trend ?? []).length,
        }),
      );
    }
    return map;
  }, [visibleAds, perfByAd, classification]);

  /* ═══════════════════════════════════════════════════════════════════════
     LE RIGHE DELL'ELENCO — la stessa forma ai tre livelli
     ═════════════════════════════════════════════════════════════════════ */

  /*  Campagne, gruppi e inserzioni diventano la STESSA riga (RigaCampagna):
   *  è quello che permette a un'unica tabella di servire i tre livelli, e a
   *  Meta e TikTok di mostrare le stesse colonne senza copiare codice. */

  const righeCampagne = useMemo<RigaCampagna[]>(() => {
    const grezze = campaigns.map((c) => {
      const cAds = adsAll.filter((a) => a.campaign_id === c.id);
      const agg = aggregateForAds(
        cAds.map((a) => a.id),
        perfByAd,
      );
      return { c, nAds: cAds.length, agg };
    });
    const spesa = grezze.reduce((s, r) => s + r.agg.spend, 0);
    const contatti = grezze.reduce((s, r) => s + r.agg.lead, 0);
    const medio = costoPer(spesa, contatti);
    return grezze.map(({ c, nAds, agg }) => {
      const base = {
        spesa: agg.spend,
        contatti: agg.lead,
        clienti: agg.conv,
        incasso: agg.fatturato,
      };
      const { esito, motivo } = esitoAggregato(base, { costoContattoMedio: medio });
      return {
        id: c.id,
        nome: c.name,
        sotto: `${nAds} ${nAds === 1 ? "inserzione" : "inserzioni"}${c.objective ? ` · ${c.objective}` : ""}`,
        ...base,
        esito,
        motivo,
        attiva: /ACTIVE/i.test(c.status),
      };
    });
  }, [campaigns, adsAll, perfByAd]);

  const righeGruppi = useMemo<RigaCampagna[]>(() => {
    const grezze = adsetsForCampaign.map((g) => {
      const gAds = adsAll.filter((a) => a.adset_id === g.id);
      const agg = aggregateForAds(
        gAds.map((a) => a.id),
        perfByAd,
      );
      return { g, nAds: gAds.length, agg };
    });
    const spesa = grezze.reduce((s, r) => s + r.agg.spend, 0);
    const contatti = grezze.reduce((s, r) => s + r.agg.lead, 0);
    const medio = costoPer(spesa, contatti);
    return grezze.map(({ g, nAds, agg }) => {
      const base = {
        spesa: agg.spend,
        contatti: agg.lead,
        clienti: agg.conv,
        incasso: agg.fatturato,
      };
      const { esito, motivo } = esitoAggregato(base, { costoContattoMedio: medio });
      return {
        id: g.id,
        nome: g.name,
        sotto: `${nAds} ${nAds === 1 ? "inserzione" : "inserzioni"}${g.optimization ? ` · ${g.optimization}` : ""}`,
        ...base,
        esito,
        motivo,
        attiva: /ACTIVE/i.test(g.status),
      };
    });
  }, [adsetsForCampaign, adsAll, perfByAd]);

  /*  Le inserzioni sono l'unico livello con una creativa, quindi l'unico su cui
   *  ha senso il verdetto tecnico (qualità del video, affaticamento, punteggi):
   *  si riusa quello, tradotto nelle stesse cinque parole degli altri livelli. */
  const righeInserzioni = useMemo<RigaCampagna[]>(
    () =>
      visibleAds.map((a) => {
        const p = perfByAd.get(a.id);
        const v = verdictMap.get(a.id);
        return {
          id: a.id,
          nome: a.name,
          //  Da campaignById e non cercando dentro `perf`: con qualche centinaio
          //  di inserzioni quella ricerca dentro la map costava un giro completo
          //  per riga a ogni render.
          sotto: campaignById.get(a.campaign_id)?.name || undefined,
          spesa: p?.spend ?? 0,
          contatti: p?.lead ?? 0,
          clienti: p?.conversioni ?? 0,
          incasso: p?.fatturato ?? 0,
          esito: esitoDaVerdetto(v?.kind, p?.spend ?? 0),
          motivo: v?.reason,
          attiva: /ACTIVE/i.test(effectiveStatusOf(a)),
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleAds, perfByAd, verdictMap, campaignById],
  );

  const righeLivello =
    livello === "campagne" ? righeCampagne : livello === "gruppi" ? righeGruppi : righeInserzioni;

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
   *  delle due stia nascondendo qualcosa. Ai livelli superiori l'elenco parla
   *  di campagne o gruppi, quindi la galleria mostra tutte le inserzioni del
   *  pezzo di account aperto. */
  const adsGalleria = useMemo(() => {
    const ordine = livello === "inserzioni" ? righeVisibili : righeInserzioni;
    const perId = new Map(visibleAds.map((a) => [a.id, a]));
    return ordine.map((r) => perId.get(r.id)).filter((a): a is AdNode => !!a);
  }, [livello, righeVisibili, righeInserzioni, visibleAds]);

  // ── Insights "Today vs Yesterday" + alert + podio (riferiti a tutto il set perf,
  // non solo agli ad visibili — il quadro va letto a livello di account). ──
  const todayVsYesterday = useMemo(() => computeTodayVsYesterday(perf), [perf]);
  const wow = useMemo(() => computeWoW(perf), [perf]);
  // Predicted CPL domani: aggrega trend di tutte le ad per giorno e applica
  // la regressione lineare sugli ultimi 7gg di CPL globale.
  const predictedCpl = useMemo(() => {
    const byDay = new Map<string, { spend: number; lead: number; rev: number }>();
    for (const p of perf) {
      for (const t of p.trend ?? []) {
        const slot = byDay.get(t.date) ?? { spend: 0, lead: 0, rev: 0 };
        slot.spend += t.spend ?? 0;
        slot.lead += t.lead ?? 0;
        slot.rev += t.rev ?? 0;
        byDay.set(t.date, slot);
      }
    }
    const trend = [...byDay.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, ...v }));
    const predicted = predictTomorrowCpl(trend);
    const last7 = trend.slice(-7).filter((t) => t.spend > 0 && t.lead > 0);
    const avg =
      last7.length > 0 ? last7.reduce((s, t) => s + t.spend / t.lead, 0) / last7.length : null;
    // Sparkline: serie CPL giornaliera ultimi 7gg (giorni con dati validi)
    const trend7d = last7.map((t) => t.spend / t.lead);
    return { predicted, currentAvg: avg, trend7d };
  }, [perf]);
  const alerts = useMemo(() => computeAlerts(perf, dailyBudgetMeta), [perf, dailyBudgetMeta]);
  const winners = useMemo(() => pickWinners(perf), [perf]);
  const losers = useMemo(() => pickLosers(perf), [perf]);
  const adNameById = (id: string) => adsAll.find((a) => a.id === id)?.name ?? id;

  const toggleSel = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSelected(n);
  };

  /* ═══════════════════════════════════════════════════════════════════════
     NAVIGAZIONE — scendere di livello È filtrare
     ═════════════════════════════════════════════════════════════════════ */

  const campagnaAperta =
    campaignId !== "all" ? campaigns.find((c) => c.id === campaignId) : undefined;
  const gruppoAperto = adsetId !== "all" ? adsets.find((a) => a.id === adsetId) : undefined;

  const tappe: { etichetta: string; livello: Livello }[] = [
    { etichetta: "Tutte le campagne", livello: "campagne" },
    ...(campagnaAperta ? [{ etichetta: campagnaAperta.name, livello: "gruppi" as Livello }] : []),
    ...(gruppoAperto ? [{ etichetta: gruppoAperto.name, livello: "inserzioni" as Livello }] : []),
  ];

  /** Salire di livello svuota i filtri più profondi: un filtro che resta acceso
   *  mentre l'etichetta dice "tutte" è il modo più rapido per far dire che i
   *  numeri non tornano. */
  const cambiaLivello = (l: Livello) => {
    if (l === "campagne") {
      setCampaignId("all");
      setAdsetId("all");
    }
    if (l === "gruppi") setAdsetId("all");
    setEsitoFiltro(null);
    setLivello(l);
  };

  const apriRiga = (r: RigaCampagna) => {
    if (livello === "campagne") {
      setCampaignId(r.id);
      setAdsetId("all");
      setEsitoFiltro(null);
      setLivello("gruppi");
      return;
    }
    if (livello === "gruppi") {
      setAdsetId(r.id);
      setEsitoFiltro(null);
      setLivello("inserzioni");
      return;
    }
    setDrawerAdId(r.id);
  };

  const daSpegnere = righeVisibili.filter((r) => r.esito === "spegnere");

  if (!allowed) {
    return (
      <Pagina larga>
        <Vuoto
          titolo="Non hai accesso alle campagne"
          testo="Chiedi a chi amministra il CRM di abilitarti la sezione pubblicità."
          icona={BarChart3}
        />
      </Pagina>
    );
  }

  return (
    <Pagina larga>
      <Titolo
        testo="Campagne Meta"
        icona={BarChart3}
        nota={
          hierarchy ? (
            <>
              {conteggiLivello.campagne} campagne · {conteggiLivello.inserzioni} inserzioni ·{" "}
              <span className="font-medium">{soldi(totali.spesa)} spesi</span>
              {totali.clienti > 0 && (
                <>
                  {" "}
                  · <span className="font-medium text-emerald-700">{totali.clienti} clienti</span>
                </>
              )}
            </>
          ) : (
            "Sto caricando le campagne…"
          )
        }
        azioni={
          <>
            <CacheStatusBadge info={cacheInfo} />
            <Segmento
              onClick={() => esportaCsvCampagne(righeVisibili, livello, "Meta")}
              titolo="Scarica in CSV esattamente le righe che stai vedendo"
            >
              <Download className="mr-1 inline h-3.5 w-3.5" />
              Esporta
            </Segmento>
            <Segmento
              onClick={() => {
                if (!refreshing && accessToken) void refreshFromMeta();
              }}
              titolo="Risincronizza la spesa con Meta e ricarica le metriche del periodo"
            >
              {refreshing ? (
                <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
              )}
              {refreshing ? "Aggiorno…" : "Aggiorna"}
            </Segmento>
            <Segmento
              onClick={() => {
                if (!resetting && !loading) void resetDashboard();
              }}
              titolo="Ripristina periodo e filtri e svuota la copia locale dei dati"
            >
              {resetting ? (
                <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
              ) : (
                <RotateCcw className="mr-1 inline h-3.5 w-3.5" />
              )}
              Reset
            </Segmento>
          </>
        }
      />

      <BarraCampagne
        periodo={
          <DateRangeFilter
            value={dateRange}
            onChange={setDateRange}
            presetDeltas={(() => {
              // Punti giornalieri da tutte le ad: abilita il confronto fra periodi
              // su tutti i preset del selettore (Oggi, Ieri, 3g, 7g, 15g, 30g…).
              const points: RangeDeltaPoint[] = [];
              for (const p of perf) {
                for (const t of p.trend ?? []) {
                  points.push({
                    date: t.date,
                    spend: t.spend ?? 0,
                    lead: t.lead ?? 0,
                    revenue: (t as { rev?: number }).rev ?? 0,
                  });
                }
              }
              return computeAllPresetDeltas(points);
            })()}
          />
        }
        livello={livello}
        onLivello={cambiaLivello}
        conteggiLivello={conteggiLivello}
        ricerca={search}
        onRicerca={setSearch}
        esito={esitoFiltro}
        onEsito={setEsitoFiltro}
        conteggiEsito={conteggiEsito}
        azioni={
          <Segmento
            attivo={onlyActiveInRange}
            onClick={() => setOnlyActiveInRange((v) => !v)}
            titolo="Scarica e mostra solo ciò che ha speso nel periodo scelto. Meno rumore e caricamento più rapido."
          >
            <Filter className="mr-1 inline h-3.5 w-3.5" />
            Solo attive nel periodo
          </Segmento>
        }
      />

      <PercorsoCampagne tappe={tappe} onRisali={cambiaLivello} />

      {err && (
        <Scheda classeCorpo="p-3 text-[12.5px] text-rose-700">
          Non sono riuscito a leggere i dati Meta: {err}
        </Scheda>
      )}

      {progress && (
        <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="font-medium text-foreground">{progress.label}</span>
        </div>
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
            : "Nessuna spesa Meta nel periodo"
        }
        vuotoTesto={
          esitoFiltro || search
            ? "Cambia periodo, svuota la ricerca o togli il filtro dell'esito."
            : hierarchy
              ? "Allarga il periodo, oppure togli «Solo attive nel periodo» per vedere anche ciò che è fermo."
              : "Collega l'account Meta in Impostazioni, poi premi Aggiorna."
        }
        vuotoIcona={BarChart3}
      />

      {/*  Le inserzioni da spegnere si spengono da qui: è l'unica azione che la
          pagina deve permettere senza scendere nel dettaglio, e vale solo al
          livello in cui esiste un'inserzione da mettere in pausa. */}
      {livello === "inserzioni" && daSpegnere.length > 0 && (
        <Scheda classeCorpo="flex flex-wrap items-center gap-3 p-3">
          <span className="text-[12.5px]">
            <span className="font-semibold text-rose-700">{daSpegnere.length}</span>{" "}
            {daSpegnere.length === 1 ? "inserzione sta spendendo" : "inserzioni stanno spendendo"}{" "}
            senza portare clienti: {soldi(daSpegnere.reduce((s, r) => s + r.spesa, 0))} nel periodo.
          </span>
          <div className="flex-1" />
          <Segmento
            onClick={() => setPauseConfirm(daSpegnere.map((r) => r.id))}
            titolo="Mette in pausa su Meta tutte le inserzioni con esito «Da spegnere»"
          >
            <Pause className="mr-1 inline h-3.5 w-3.5" />
            Metti in pausa tutte
          </Segmento>
          {selected.size > 0 && (
            <Segmento
              onClick={() => void handleResumeSelected([...selected])}
              titolo={`Riattiva le ${selected.size} inserzioni selezionate`}
            >
              {resuming ? (
                <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="mr-1 inline h-3.5 w-3.5" />
              )}
              Riattiva selezionate ({selected.size})
            </Segmento>
          )}
        </Scheda>
      )}

      {/* ── PERCHÉ ──────────────────────────────────────────────────────── */}
      <Approfondimenti
        chiaveMemoria="campagne-meta-approfondimenti"
        nota="Le metriche di mestiere: servono quando l'elenco ha già detto quale riga non va"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {STRUMENTI.map((s) => (
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
              onShowDegraded={() => {
                setLivello("inserzioni");
                setEsitoFiltro("sistemare");
              }}
            />
            <DispersioneClic
              clic={perf.reduce((s, p) => s + (p.metaClicks ?? 0), 0)}
              sessioni={perf.reduce((s, p) => s + (p.lpSessions ?? 0), 0)}
            />
            <PodiumRow
              winners={winners}
              losers={losers}
              nameById={adNameById}
              onOpen={(id) => setDrawerAdId(id)}
            />
            {accessToken && (
              <TopMoversCard accessToken={accessToken} onOpen={(id) => setDrawerAdId(id)} />
            )}
          </div>
        )}

        {strumento === "creative" &&
          (accessToken ? (
            <CreativeTrendCard accessToken={accessToken} onOpen={(id) => setDrawerAdId(id)} />
          ) : (
            <Vuoto
              titolo="Sessione scaduta"
              testo="Ricarica la pagina per rileggere il trend delle creative."
            />
          ))}

        {strumento === "galleria" &&
          (adsGalleria.length === 0 ? (
            <Vuoto
              titolo="Nessuna inserzione da mostrare"
              testo="Cambia periodo o risali di livello."
            />
          ) : (
            <AdsGalleryView
              ads={adsGalleria}
              perfByAd={perfByAd}
              classification={classification}
              classifyOn
              fatigueMap={fatigueMap}
              healthMap={healthMap}
              verdictMap={verdictMap}
              selected={selected}
              onToggleSelect={toggleSel}
              onOpen={(id) => setDrawerAdId(id)}
              onOpenFatigue={(id) => {
                setDrawerAdId(id);
                setDrawerInitialTab("approfondita");
              }}
              onPause={(id) => setPauseConfirm([id])}
              onResume={(id) => handleResumeSelected([id])}
              resuming={resuming}
              sinceISO={range.since.toISOString()}
              untilISO={range.until.toISOString()}
            />
          ))}

        {strumento === "funnel" && (
          <FunnelKpiAdsTab
            perf={perf}
            since={range.since}
            until={range.until}
            parentRange={dateRange}
            onOpenAd={(id) => setDrawerAdId(id)}
          />
        )}

        {strumento === "controllo" && (
          <ControlTotaleTab
            since={range.since}
            until={range.until}
            perf={perf}
            ads={adsAll}
            campaigns={campaigns}
            adsets={adsets}
          />
        )}
      </Approfondimenti>

      {/* ───── Dettaglio inserzione ───── */}
      {drawerAdId &&
        (() => {
          const compareIds = selected.size >= 2 ? [...selected] : [drawerAdId];
          const ads = compareIds
            .map((id) => adsAll.find((a) => a.id === id))
            .filter(Boolean) as AdNode[];
          const perfs = compareIds.map((id) => perfByAd.get(id) || null);
          if (ads.length === 0) return null;
          return (
            <CreativeDrawer
              ads={ads}
              perfs={perfs}
              accessToken={accessToken}
              sinceISO={range.since.toISOString()}
              untilISO={range.until.toISOString()}
              initialTab={drawerInitialTab}
              onClose={() => {
                setDrawerAdId(null);
                setDrawerInitialTab("riepilogo");
              }}
              onPause={(ids) => setPauseConfirm(ids)}
              onRinomina={(ad) => setRenaming({ id: ad.id, name: ad.name })}
              onDuplica={(id) => void handleDuplicate(id)}
              duplicando={duplicating === drawerAdId}
            />
          );
        })()}

      {pauseConfirm && (
        <PauseConfirmDialog
          adIds={pauseConfirm}
          ads={adsAll.filter((a) => pauseConfirm.includes(a.id))}
          loading={pausing}
          onCancel={() => !pausing && setPauseConfirm(null)}
          onConfirm={() => handlePauseSelected(pauseConfirm)}
        />
      )}

      {renaming && (
        <RenameDialog
          initial={renaming.name}
          onCancel={() => setRenaming(null)}
          onConfirm={(name) => handleRename(renaming.id, name)}
        />
      )}
    </Pagina>
  );
}

/* ───────── Dispersione fra clic e sessioni ─────────
   Quante persone hanno cliccato e non sono mai arrivate sulla pagina: se il
   numero è alto, il problema non è la creativa ma il link. Stesso blocco,
   stesse soglie e stesse parole della pagina TikTok. */
function DispersioneClic({ clic, sessioni }: { clic: number; sessioni: number }) {
  if (clic <= 0) return null;
  const persi = ((clic - sessioni) / clic) * 100;
  const tono =
    persi >= 30
      ? "border-rose-500/25 bg-rose-500/10 text-rose-700"
      : persi >= 15
        ? "border-amber-500/25 bg-amber-500/10 text-amber-700"
        : "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2 ${tono}`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
        Persi fra il clic e la pagina
      </span>
      <span className="text-[15px] font-semibold tabular-nums">{persi.toFixed(1)}%</span>
      <span className="text-[11.5px] opacity-80">
        {sessioni.toLocaleString("it-IT")} arrivi su {clic.toLocaleString("it-IT")} clic
      </span>
      <span className="ml-auto text-[11.5px] opacity-80">
        {persi >= 30
          ? "Controlla il link: redirect rotto o ad blocker"
          : persi >= 15
            ? "Da tenere d'occhio"
            : "Nella norma"}
      </span>
    </div>
  );
}

/* ─────────── Drawer creativa (multi + quality trend) ─────────── */

function CreativeDrawer({
  ads,
  perfs,
  accessToken,
  sinceISO,
  untilISO,
  initialTab = "riepilogo",
  onClose,
  onPause,
  onRinomina,
  onDuplica,
  duplicando,
}: {
  ads: AdNode[];
  perfs: (PerfItem | null)[];
  accessToken: string;
  sinceISO: string;
  untilISO: string;
  initialTab?: "riepilogo" | "approfondita";
  onClose: () => void;
  onPause: (adIds: string[]) => void;
  /*  Rinomina e Duplica erano rimaste senza un punto da cui farle partire:
      le funzioni c'erano, i pulsanti no. Il posto giusto è qui, dove si sta
      già guardando UNA inserzione: nell'elenco sarebbero due icone in più
      per riga su una tabella che deve solo far leggere i numeri. */
  onRinomina?: (ad: AdNode) => void;
  onDuplica?: (adId: string) => void;
  duplicando?: boolean;
}) {
  // Tab unica: Approfondita (la sezione Riepilogo è stata rimossa).
  void initialTab;
  const compare = ads.length > 1;

  // Trend dataset combinato per il grafico in modalità confronto
  const palette = [
    "oklch(0.55 0.18 252)",
    "oklch(0.65 0.18 145)",
    "oklch(0.7 0.18 30)",
    "oklch(0.6 0.2 320)",
    "oklch(0.7 0.18 60)",
  ];
  //  L'uscita anticipata sta DOPO gli hook: prima era sopra, e con zero ad
  //  React trovava un numero di hook diverso da quello del render precedente
  //  (l'errore "Rendered fewer hooks than expected" che chiudeva la pagina).
  const combinedTrend = useMemo(() => {
    const days = new Set<string>();
    perfs.forEach((p) => p?.trend.forEach((d) => days.add(d.date)));
    const arr = [...days].sort();
    return arr.map((day) => {
      const row: Record<string, number | string> = { date: day };
      perfs.forEach((p, idx) => {
        const t = p?.trend.find((x) => x.date === day);
        row[`spend_${idx}`] = t?.spend ?? 0;
        row[`lead_${idx}`] = t?.lead ?? 0;
        row[`quality_${idx}`] = t?.qualityRate ?? 0;
      });
      return row;
    });
  }, [perfs]);

  if (ads.length === 0) return null;

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`absolute right-0 top-0 bottom-0 ${compare ? "w-full sm:w-[1100px]" : "w-full sm:w-[860px]"} max-w-full bg-[oklch(0.98_0.003_250)] shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-200`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-border px-5 py-3 flex items-center justify-between gap-3 z-10">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {compare ? `Confronto · ${ads.length} inserzioni` : "Inserzione"}
            </div>
            <div className="text-[14px] font-semibold truncate">
              {compare ? ads.map((a) => a.name).join(" · ") : ads[0].name}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!compare && <StatusPill s={ads[0].status} />}
            {!compare && onRinomina && (
              <button
                onClick={() => onRinomina(ads[0])}
                title="Rinomina l'inserzione su Meta"
                className="h-8 px-2.5 rounded-md text-[12px] font-medium bg-white border border-border hover:bg-secondary inline-flex items-center gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" /> Rinomina
              </button>
            )}
            {!compare && onDuplica && (
              <button
                onClick={() => onDuplica(ads[0].id)}
                disabled={duplicando}
                title="Crea una copia in pausa di questa inserzione su Meta"
                className="h-8 px-2.5 rounded-md text-[12px] font-medium bg-white border border-border hover:bg-secondary inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                {duplicando ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}{" "}
                Duplica
              </button>
            )}
            <button
              onClick={() => onPause(ads.map((a) => a.id))}
              className="h-8 px-2.5 rounded-md text-[12px] font-medium bg-white border border-border hover:bg-secondary inline-flex items-center gap-1.5"
            >
              <Pause className="h-3.5 w-3.5" /> Pausa
            </button>
            <button
              onClick={onClose}
              className="h-8 w-8 grid place-items-center rounded-md hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!compare && (
          <div className="px-5 pt-4">
            <AdInsightsAndComments
              accessToken={accessToken}
              adId={ads[0].id}
              adName={ads[0].name}
              perf={perfs[0]}
            />
          </div>
        )}

        {/* Single ad → solo Approfondita (Riepilogo rimosso). Compare → vista combinata sotto. */}
        {!compare ? (
          <div className="px-5 py-4">
            <AdDeepAnalysisTab
              accessToken={accessToken}
              adId={ads[0].id}
              sinceISO={sinceISO}
              untilISO={untilISO}
              creative={
                ads[0].creative
                  ? {
                      thumbnail: ads[0].creative.thumbnail,
                      isVideo: ads[0].creative.isVideo,
                      videoDuration: ads[0].creative.videoDuration ?? null,
                      videoFileName: ads[0].creative.videoFileName ?? null,
                    }
                  : null
              }
            />
          </div>
        ) : (
          <div className="px-5 py-4 space-y-4">
            {/* Creative card (no social mockups) */}
            {compare ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {ads.map((a, idx) => (
                  <div key={a.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: palette[idx % palette.length] }}
                      />
                      <div className="text-[11.5px] font-semibold truncate flex-1">{a.name}</div>
                    </div>
                    <CreativeCard creative={a.creative} />
                  </div>
                ))}
              </div>
            ) : (
              <CreativeCard creative={ads[0].creative} large />
            )}

            {/* KPI + Trend */}
            <div className="space-y-4">
              {compare ? (
                <div className="bg-white border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border text-[12.5px] font-semibold">
                    KPI a confronto
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead className="bg-[oklch(0.985_0.003_250)] text-muted-foreground">
                        <tr>
                          <th className="text-left font-medium px-3 py-2">Inserzione</th>
                          {(
                            [
                              "spend",
                              "lead",
                              "cpl",
                              "roas",
                              "cac",
                              "showRate",
                              "closeRate",
                              "netto",
                            ] as const
                          ).map((k) => (
                            <th key={k} className="text-right font-medium px-3 py-2">
                              {
                                (
                                  {
                                    spend: "Spesa",
                                    lead: "Lead",
                                    cpl: "CPL",
                                    roas: "ROAS",
                                    cac: "CAC",
                                    showRate: "Show%",
                                    closeRate: "Close%",
                                    netto: "Netto",
                                  } as const
                                )[k]
                              }
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ads.map((a, idx) => {
                          const p = perfs[idx];
                          return (
                            <tr key={a.id} className="border-t border-border">
                              <td className="px-3 py-2 truncate max-w-[180px]">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="h-2 w-2 rounded-full shrink-0"
                                    style={{ background: palette[idx % palette.length] }}
                                  />
                                  <span className="truncate font-medium">{a.name}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {fmtEUR(p?.spend ?? null)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {fmtINT(p?.lead ?? null)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {fmtEUR(p?.cpl ?? null)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums font-semibold">
                                {fmtX(p?.roas ?? null)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {fmtEUR(p?.cac ?? null)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {fmtPCT(p?.showRate ?? null)}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums">
                                {fmtPCT(p?.closeRate ?? null)}
                              </td>
                              <td
                                className={`px-3 py-2 text-right tabular-nums font-semibold ${p && p.netto < 0 ? "text-rose-600" : "text-emerald-600"}`}
                              >
                                {fmtEUR(p?.netto ?? null)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <HeroKPI label="Spesa" value={fmtEUR(perfs[0]?.spend ?? null)} tone="neutral" />
                  <HeroKPI label="Lead" value={fmtINT(perfs[0]?.lead ?? null)} tone="neutral" />
                  <HeroKPI
                    label="ROAS"
                    value={fmtX(perfs[0]?.roas ?? null)}
                    tone={
                      perfs[0] && perfs[0].roas >= 2
                        ? "good"
                        : perfs[0] && perfs[0].roas > 0
                          ? "warn"
                          : "neutral"
                    }
                  />
                  <HeroKPI
                    label="Netto"
                    value={fmtEUR(perfs[0]?.netto ?? null)}
                    tone={
                      perfs[0] && perfs[0].netto > 0
                        ? "good"
                        : perfs[0] && perfs[0].netto < 0
                          ? "bad"
                          : "neutral"
                    }
                  />
                  <HeroKPI label="CPL" value={fmtEUR(perfs[0]?.cpl ?? null)} />
                  <HeroKPI label="CAC" value={fmtEUR(perfs[0]?.cac ?? null)} />
                  <HeroKPI label="Show%" value={fmtPCT(perfs[0]?.showRate ?? null)} />
                  <HeroKPI label="Close%" value={fmtPCT(perfs[0]?.closeRate ?? null)} />
                </div>
              )}

              {/* Confronto UTM vs Meta — evidenzia il delta su CTR e LP Views */}
              {!compare &&
                perfs[0] &&
                perfs[0].impressions > 0 &&
                (() => {
                  const p = perfs[0] as PerfItem & {
                    metaClicks?: number;
                    metaCtr?: number;
                    metaLpv?: number;
                    metaLpViewRate?: number;
                  };
                  const metaCtr = p.metaCtr ?? 0;
                  const metaLpv = p.metaLpv ?? 0;
                  const metaLpvRate = p.metaLpViewRate ?? 0;
                  const ctrDelta = metaCtr > 0 ? ((p.ctr - metaCtr) / metaCtr) * 100 : 0;
                  const lpvDelta = metaLpv > 0 ? ((p.lpv - metaLpv) / metaLpv) * 100 : 0;
                  return (
                    <div className="rounded-xl border border-border bg-[oklch(0.985_0.003_250)] p-3">
                      <div className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                        UTM (reale) vs Meta (dichiarato)
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-[12px]">
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">CTR · UTM</span>
                            <span className="font-semibold tabular-nums">{fmtPCT(p.ctr)}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">CTR · Meta dichiara</span>
                            <span className="tabular-nums">{fmtPCT(metaCtr)}</span>
                          </div>
                          {metaCtr > 0 && (
                            <div
                              className={`text-[11px] font-medium ${ctrDelta < -10 ? "text-rose-600" : "text-muted-foreground"}`}
                            >
                              delta {ctrDelta > 0 ? "+" : ""}
                              {ctrDelta.toFixed(0)}%{" "}
                              {ctrDelta < -20 && "· bot/click invalidi probabili"}
                            </div>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">LP Views · UTM</span>
                            <span className="font-semibold tabular-nums">
                              {fmtINT(p.lpv)} ({fmtPCT(p.lpViewRate)})
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">LP Views · Meta dichiara</span>
                            <span className="tabular-nums">
                              {fmtINT(metaLpv)} ({fmtPCT(metaLpvRate)})
                            </span>
                          </div>
                          {metaLpv > 0 && (
                            <div
                              className={`text-[11px] font-medium ${lpvDelta < -10 ? "text-rose-600" : "text-muted-foreground"}`}
                            >
                              delta {lpvDelta > 0 ? "+" : ""}
                              {lpvDelta.toFixed(0)}%
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}

              <div className="bg-white border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[12.5px] font-semibold">
                      Trend giornaliero {compare ? "· sovrapposto" : ""}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {compare ? "Spesa per inserzione" : "Spesa Meta · Lead CRM · Vendite"}
                    </div>
                  </div>
                </div>
                <div className="h-64">
                  {(compare ? combinedTrend.length > 0 : perfs[0] && perfs[0].trend.length > 0) ? (
                    <ResponsiveContainer>
                      <LineChart
                        data={compare ? combinedTrend : perfs[0]!.trend}
                        margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(d) => String(d).slice(5)}
                        />
                        <YAxis yAxisId="L" tick={{ fontSize: 10 }} />
                        {!compare && (
                          <YAxis yAxisId="R" orientation="right" tick={{ fontSize: 10 }} />
                        )}
                        <Tooltip
                          contentStyle={{
                            fontSize: 12,
                            borderRadius: 8,
                            border: "1px solid oklch(0.9 0.005 250)",
                          }}
                          labelFormatter={(d) => `Data: ${d}`}
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {compare ? (
                          ads.map((a, idx) => (
                            <Line
                              key={a.id}
                              yAxisId="L"
                              type="monotone"
                              dataKey={`spend_${idx}`}
                              name={a.name.length > 24 ? a.name.slice(0, 24) + "…" : a.name}
                              stroke={palette[idx % palette.length]}
                              strokeWidth={2}
                              dot={false}
                            />
                          ))
                        ) : (
                          <>
                            <Line
                              yAxisId="L"
                              type="monotone"
                              dataKey="spend"
                              name="Spesa €"
                              stroke="oklch(0.55 0.18 252)"
                              strokeWidth={2}
                              dot={false}
                            />
                            <Line
                              yAxisId="R"
                              type="monotone"
                              dataKey="lead"
                              name="Lead"
                              stroke="oklch(0.65 0.18 145)"
                              strokeWidth={2}
                              dot={false}
                            />
                            <Line
                              yAxisId="R"
                              type="monotone"
                              dataKey="conv"
                              name="Vendite"
                              stroke="oklch(0.7 0.18 30)"
                              strokeWidth={2}
                              dot={false}
                            />
                          </>
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full grid place-items-center text-sm text-muted-foreground">
                      Nessun dato nel periodo.
                    </div>
                  )}
                </div>
              </div>

              {/* Funnel video — solo singolo */}
              {!compare && perfs[0] && perfs[0].videoPlays > 0 && (
                <div className="bg-white border border-border rounded-xl p-4">
                  <div className="text-[12.5px] font-semibold mb-3">Funnel video</div>
                  <div className="space-y-2">
                    {[
                      {
                        label: "Plays",
                        v: perfs[0].videoPlays,
                        of: perfs[0].impressions || perfs[0].videoPlays,
                      },
                      { label: "25%", v: perfs[0].v25, of: perfs[0].videoPlays },
                      { label: "50%", v: perfs[0].v50, of: perfs[0].videoPlays },
                      { label: "75%", v: perfs[0].v75, of: perfs[0].videoPlays },
                      { label: "100%", v: perfs[0].v100, of: perfs[0].videoPlays },
                    ].map((s) => {
                      const pct = s.of > 0 ? (s.v / s.of) * 100 : 0;
                      return (
                        <div key={s.label}>
                          <div className="flex items-center justify-between text-[11.5px] mb-0.5">
                            <span className="text-muted-foreground">{s.label}</span>
                            <span className="tabular-nums font-medium">
                              {fmtINT(s.v)}{" "}
                              <span className="text-muted-foreground">({fmtPCT(pct)})</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-[oklch(0.55_0.18_252)] to-[oklch(0.62_0.2_280)]"
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Trend qualità traffico (HQV / PageView) */}
              {!compare && perfs[0] && perfs[0].trend.some((t) => t.pageViews > 0) && (
                <div className="bg-white border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-[12.5px] font-semibold">Qualità traffico landing</div>
                      <div className="text-[11px] text-muted-foreground">
                        % lettori veri (HighQualityVisit) sul totale PageView
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Media periodo:{" "}
                      <span className="font-semibold text-foreground tabular-nums">
                        {fmtPCT(perfs[0].qualityRate)}
                      </span>
                    </div>
                  </div>
                  <div className="h-52">
                    <ResponsiveContainer>
                      <LineChart
                        data={perfs[0].trend}
                        margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.92 0.005 250)" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(d) => String(d).slice(5)}
                        />
                        <YAxis
                          yAxisId="L"
                          tick={{ fontSize: 10 }}
                          tickFormatter={(v) => `${v}%`}
                          domain={[0, 100]}
                        />
                        <YAxis yAxisId="R" orientation="right" tick={{ fontSize: 10 }} />
                        <Tooltip
                          contentStyle={{
                            fontSize: 12,
                            borderRadius: 8,
                            border: "1px solid oklch(0.9 0.005 250)",
                          }}
                          formatter={(val: number, name: string) =>
                            name === "Quality %" ? [`${val.toFixed(1)}%`, name] : [val, name]
                          }
                        />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {/* Soglia minima qualità: 30% */}
                        <ReferenceLine
                          yAxisId="L"
                          y={30}
                          stroke="oklch(0.6 0.22 25)"
                          strokeDasharray="6 3"
                          strokeWidth={1.5}
                          label={{
                            value: "Soglia 30%",
                            position: "insideTopRight",
                            fill: "oklch(0.55 0.22 25)",
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        />
                        <Line
                          yAxisId="L"
                          type="monotone"
                          dataKey="qualityRate"
                          name="Quality %"
                          stroke="oklch(0.65 0.18 145)"
                          strokeWidth={2}
                          dot={(props: {
                            cx?: number;
                            cy?: number;
                            payload?: { qualityRate?: number; date?: string };
                          }) => {
                            const v = props.payload?.qualityRate ?? 0;
                            const isLow = v > 0 && v < 30;
                            return (
                              <circle
                                key={props.payload?.date}
                                cx={props.cx}
                                cy={props.cy}
                                r={isLow ? 4 : 2.5}
                                fill={isLow ? "oklch(0.6 0.22 25)" : "oklch(0.65 0.18 145)"}
                                stroke={isLow ? "oklch(0.5 0.22 25)" : "transparent"}
                                strokeWidth={isLow ? 1.5 : 0}
                              />
                            );
                          }}
                        />
                        <Line
                          yAxisId="R"
                          type="monotone"
                          dataKey="pageViews"
                          name="PageView"
                          stroke="oklch(0.55 0.18 252)"
                          strokeWidth={1.5}
                          dot={false}
                          strokeDasharray="4 4"
                        />
                        <Line
                          yAxisId="R"
                          type="monotone"
                          dataKey="hqv"
                          name="HQV"
                          stroke="oklch(0.7 0.18 30)"
                          strokeWidth={1.5}
                          dot={false}
                          strokeDasharray="4 4"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {!compare && ads[0].creative?.link && (
                <a
                  href={ads[0].creative.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] text-[oklch(0.55_0.18_252)] hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Apri landing page
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

type Insight = { title: string; severity: "good" | "warn" | "bad"; reason: string; action: string };
function AdInsightsAndComments({
  accessToken,
  adName,
  perf,
}: {
  accessToken: string;
  adId: string;
  adName: string;
  perf: PerfItem | null;
}) {
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadInsights() {
    if (!perf) return;
    setLoading(true);
    try {
      const kpis: Record<string, number | null> = {
        spend: perf.spend,
        lead: perf.lead,
        cpl: perf.cpl,
        roas: perf.roas,
        cac: perf.cac,
        showRate: perf.showRate,
        closeRate: perf.closeRate,
      };
      const r = await generateAdInsights({ data: { accessToken, adName, kpis } });
      setInsights(r.insights);
    } catch (e) {
      toast.error("Errore AI", { description: String((e as Error).message) });
    } finally {
      setLoading(false);
    }
  }

  const sevColor = (s: Insight["severity"]) =>
    s === "good"
      ? "oklch(0.65 0.18 145)"
      : s === "warn"
        ? "oklch(0.7 0.18 60)"
        : "oklch(0.6 0.22 25)";

  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-1 p-1 bg-secondary/40 border-b border-border">
        <div className="h-7 px-3 rounded-md text-[12px] font-medium bg-white shadow-sm inline-flex items-center">
          <Sparkles className="inline h-3 w-3 mr-1" /> AI Insights
        </div>
      </div>
      <div className="p-4">
        <div className="space-y-2">
          {!insights ? (
            <button
              onClick={loadInsights}
              disabled={loading || !perf}
              className="h-8 px-3 rounded-md text-[12px] font-medium bg-primary text-primary-foreground hover:opacity-90 inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Wand2 className="h-3.5 w-3.5" />
              )}{" "}
              Genera suggerimenti AI
            </button>
          ) : (
            insights.map((ins, i) => (
              <div
                key={i}
                className="p-2.5 rounded-md bg-secondary/40 border-l-2"
                style={{ borderLeftColor: sevColor(ins.severity) }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Lightbulb className="h-3.5 w-3.5" style={{ color: sevColor(ins.severity) }} />
                  <span className="text-[12.5px] font-semibold">{ins.title}</span>
                </div>
                <div className="text-[11.5px] text-muted-foreground mb-1">{ins.reason}</div>
                <div className="text-[12px]">
                  <span className="font-medium">→ Azione:</span> {ins.action}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Creative card (no social mockups) ─────────── */

function CreativeCard({ creative, large = false }: { creative: Creative | null; large?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-white overflow-hidden">
      <div
        className="bg-slate-100 grid place-items-center overflow-hidden"
        style={{ aspectRatio: creative?.isVideo ? "9/16" : "1.91/1", maxHeight: large ? 360 : 220 }}
      >
        {creative?.thumbnail ? (
          <img src={creative.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="h-10 w-10 text-muted-foreground" />
        )}
      </div>
      <div className="p-3 space-y-1.5">
        {creative?.title && (
          <div className="text-[13px] font-semibold leading-snug line-clamp-2">
            {creative.title}
          </div>
        )}
        {creative?.body && (
          <div className="text-[12px] text-muted-foreground whitespace-pre-line line-clamp-4">
            {creative.body}
          </div>
        )}
        {creative?.description && (
          <div className="text-[11.5px] text-muted-foreground line-clamp-2">
            {creative.description}
          </div>
        )}
        <div className="flex items-center justify-between gap-2 pt-1">
          {creative?.link ? (
            <a
              href={creative.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[oklch(0.55_0.18_252)] hover:underline truncate inline-flex items-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              {(() => {
                try {
                  return new URL(creative.link!).hostname;
                } catch {
                  return creative.link;
                }
              })()}
            </a>
          ) : (
            <span className="text-[11px] text-muted-foreground">—</span>
          )}
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-foreground/80 font-medium">
            {ctaLabel(creative?.cta || null)}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Confirm Pause Dialog ─────────── */

function PauseConfirmDialog({
  adIds,
  ads,
  loading,
  onCancel,
  onConfirm,
}: {
  adIds: string[];
  ads: AdNode[];
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Finestra
      aperta
      onCambio={(o) => {
        if (!o && !loading) onCancel();
      }}
      titolo={`Metti in pausa ${adIds.length} inserzion${adIds.length === 1 ? "e" : "i"}`}
      contesto="L'azione viene applicata su Meta in tempo reale."
      icona={Pause}
      larghezza="sm"
      bloccante
      classeCorpo="space-y-3"
      azioni={
        <>
          <button
            onClick={onCancel}
            disabled={loading}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[12.5px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 text-[12.5px] font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Pause className="h-3.5 w-3.5" />
            )}
            {loading ? "In corso…" : "Conferma pausa"}
          </button>
        </>
      }
    >
      <SezioneFinestra titolo="Inserzioni coinvolte" senzaPadding={ads.length > 0}>
        {ads.length === 0 ? (
          <p className="text-[12px] text-slate-500">{adIds.length} inserzioni selezionate.</p>
        ) : (
          <ul className="max-h-52 divide-y divide-slate-200 overflow-y-auto">
            {ads.map((a) => (
              <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-[12px]">
                <div className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-md bg-slate-100">
                  {a.creative?.thumbnail ? (
                    <img src={a.creative.thumbnail} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="h-3 w-3 text-slate-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1 truncate font-medium text-slate-900">{a.name}</div>
                <StatusPill s={a.status} />
              </li>
            ))}
          </ul>
        )}
      </SezioneFinestra>
    </Finestra>
  );
}

function HeroKPI({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "good" | "bad" | "warn" | "neutral";
}) {
  const toneCls =
    tone === "good"
      ? "border-emerald-200 bg-emerald-50/60"
      : tone === "bad"
        ? "border-rose-200 bg-rose-50/60"
        : tone === "warn"
          ? "border-amber-200 bg-amber-50/60"
          : "border-border bg-white";
  return (
    <div className={`rounded-lg border ${toneCls} px-3 py-2`}>
      <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-[16px] font-semibold tabular-nums mt-0.5">{value}</div>
    </div>
  );
}

/* ─────────── Tabella Campagne (aggregata) ─────────── */

function aggregateForAds(adIds: string[], perfByAd: Map<string, PerfItem>) {
  let spend = 0,
    lead = 0,
    conv = 0,
    fatturato = 0,
    netto = 0,
    impressions = 0,
    clicks = 0;
  for (const id of adIds) {
    const p = perfByAd.get(id);
    if (!p) continue;
    spend += p.spend || 0;
    lead += p.lead || 0;
    conv += p.conversioni || 0;
    fatturato += p.fatturato || 0;
    netto += p.netto || 0;
    impressions += p.impressions || 0;
    clicks += p.clicks || 0;
  }
  return {
    spend,
    lead,
    conv,
    fatturato,
    netto,
    impressions,
    clicks,
    cpl: lead > 0 ? spend / lead : 0,
    cac: conv > 0 ? spend / conv : 0,
    roas: spend > 0 ? fatturato / spend : 0,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
  };
}

/* ─────────── Rename Dialog ─────────── */

function RenameDialog({
  initial,
  onCancel,
  onConfirm,
}: {
  initial: string;
  onCancel: () => void;
  onConfirm: (n: string) => void;
}) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <Finestra
      aperta
      onCambio={(o) => {
        if (!o && !busy) onCancel();
      }}
      titolo="Rinomina l'inserzione"
      contesto="Il nuovo nome viene sincronizzato su Meta in tempo reale."
      icona={Pencil}
      larghezza="sm"
      azioni={
        <>
          <button
            onClick={onCancel}
            disabled={busy}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-[12.5px] font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Annulla
          </button>
          <button
            onClick={async () => {
              if (!name.trim() || name === initial) return;
              setBusy(true);
              try {
                await onConfirm(name.trim());
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy || !name.trim() || name === initial}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 text-[12.5px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Salva su Meta
          </button>
        </>
      }
    >
      <SezioneFinestra classeCorpo="p-4">
        <CampoFinestra etichetta="Nome inserzione">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-300"
            placeholder="Nome inserzione"
          />
        </CampoFinestra>
      </SezioneFinestra>
    </Finestra>
  );
}
