import { Link, createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth, intestazioniCRM } from "@/crm/AuthContext";
/*  Il foglio delle istruzioni è UN FILE SOLO, in `docs/CLONARE.md`: finisce
    nella sorgente scaricabile e si scarica anche da qui. Due copie dello
    stesso testo sarebbero due fogli che un giorno dicono cose diverse. */
import ISTRUZIONI_CLONARE from "../../docs/CLONARE.md?raw";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  useUserSettings,
  ALL_SCHEMES,
  SCHEME_LABEL,
  type SchemeKey,
} from "@/crm/UserSettingsContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImpostazioniWebinar } from "@/crm/ImpostazioniWebinar";
//  ⚠️ Lo STESSO editor della pagina WhatsApp, non una copia: i testi che
//   partono ai clienti si modificano da un posto solo (vedi crm/EditorMessaggi).
import { EditorMessaggi } from "@/crm/EditorMessaggi";
import { ImpostazioniAI } from "@/crm/ImpostazioniAI";
import { ClassificaTagli } from "@/crm/ClassificaTagli";
import { ImpostazioniMeetly } from "@/crm/ImpostazioniMeetly";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  ShieldCheck,
  User as UserIcon,
  Settings as SettingsIcon,
  BarChart3,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Target,
  Trash2,
  AlertOctagon,
  MessageCircle,
  Music2,
  Radio,
  Video,
  Bell,
  Activity,
  Euro,
  HelpCircle,
  Copy,
  Check,
  Send,
  Layout,
  Database,
  Download,
  Upload,
  FileJson,
  ArrowRight,
  Loader2,
  MapPin,
  Sparkles,
} from "lucide-react";
import { LandingContentEditor } from "@/crm/LandingContentEditor";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CampoFinestra,
  CLASSE_CAMPO,
  Finestra,
  NotaFinestra,
  SezioneFinestra,
} from "@/crm/ui/Finestra";
import {
  loadGatingConfig,
  saveGatingConfig,
  DEFAULT_GATING,
  type GatingConfig,
} from "@/crm/ads-manager/gating-config";
import { NotificationPrefsSection } from "@/crm/notifications/NotificationPrefsSection";
import { MetricsDiagnosticSection } from "@/crm/MetricsDiagnosticSection";
import { clearAdsServerCache } from "@/crm/ads-financials.functions";
import { formatDistanceToNow } from "date-fns";
import { it } from "date-fns/locale";

/** Pulisce TUTTE le cache localStorage di Ads Manager (gerarchia + performance per ogni range).
 *  Da chiamare dopo un Reset KPI o un cambio cutoff `ads_history_start`, altrimenti la dashboard
 *  mostra ancora i dati vecchi cachati e sembra "rotta". */
function clearAdsLocalCache() {
  try {
    const keys = Object.keys(window.localStorage).filter(
      (k) =>
        k.startsWith("ads-mgr-perf-") ||
        k.startsWith("ads-mgr-hierarchy-") ||
        k.startsWith("ads-mgr-hierarchy-min-") ||
        k.startsWith("ads-mgr-hierarchy-v"),
    );
    for (const k of keys) window.localStorage.removeItem(k);
    return keys.length;
  } catch {
    return 0;
  }
}

export const Route = createFileRoute("/CRM/impostazioni")({
  component: ImpostazioniPage,
});

interface TrackingConfigState {
  meta_pixel_id: string;
  meta_access_token: string;
  meta_test_event_code: string;
  meta_ad_account_id: string;
  meta_page_id: string;
  meta_page_access_token: string;
  meta_leadgen_verify_token: string;
  meta_app_secret: string;
  tiktok_pixel_id: string;
  tiktok_access_token: string;
  tiktok_advertiser_id: string;
  tiktok_test_event_code: string;
  tiktok_ads_history_start: string;
  daily_spend_meta: number;
  daily_spend_tiktok: number;
  daily_spend_organico: number;
  iva_included: boolean;
  margine_profitto_pct: number;
  costo_prodotto: number;
  ads_history_start: string; // YYYY-MM-DD, "" = nessun cutoff
  fatigue_alerts_enabled: boolean;
  fatigue_freq_threshold: number;
  fatigue_scroll_threshold: number;
  fatigue_time_threshold: number;
}

const EMPTY_TRACKING: TrackingConfigState = {
  meta_pixel_id: "",
  meta_access_token: "",
  meta_test_event_code: "",
  meta_ad_account_id: "",
  meta_page_id: "",
  meta_page_access_token: "",
  meta_leadgen_verify_token: "",
  meta_app_secret: "",
  tiktok_pixel_id: "",
  tiktok_access_token: "",
  tiktok_advertiser_id: "",
  tiktok_test_event_code: "",
  tiktok_ads_history_start: "",
  daily_spend_meta: 0,
  daily_spend_tiktok: 0,
  daily_spend_organico: 0,
  iva_included: true,
  margine_profitto_pct: 40,
  costo_prodotto: 0,
  ads_history_start: "",
  fatigue_alerts_enabled: true,
  fatigue_freq_threshold: 3.5,
  fatigue_scroll_threshold: 40,
  fatigue_time_threshold: 15,
};

function ImpostazioniPage() {
  const { user } = useAuth();
  const { isAdmin, allUsers, updateUser } = useUserSettings();
  //  ── LA SCHEDA APERTA ────────────────────────────────────────────────────
  //  Serve controllata perché a questa pagina si arriva anche da un
  //  collegamento salvato (/CRM/impostazioni?tab=dati, dove prima c'era la
  //  pagina Importa). La scheda iniziale resta sempre la stessa e cambia solo
  //  DOPO il primo disegno: leggere l'indirizzo durante il rendering farebbe
  //  divergere server e browser, e la pagina sfarfallerebbe.
  const [tab, setTab] = useState("meta");
  useEffect(() => {
    const richiesta = new URLSearchParams(window.location.search).get("tab");
    if (richiesta) setTab(richiesta);
  }, []);
  const [tracking, setTracking] = useState<TrackingConfigState>(EMPTY_TRACKING);
  const [savingTracking, setSavingTracking] = useState(false);
  const [lastSync, setLastSync] = useState<{ at: string | null; rows: number }>({
    at: null,
    rows: 0,
  });
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; message: string } | null>(null);
  /*  ── ⚠️ IL RECUPERO PERIODICO DEI LEAD META ──────────────────────────
      Gira da solo ogni 5 minuti (pg_cron → /hooks/meta-lead-sync). Questi due
      stati servono solo a lanciarlo a mano e a dire com'è andato l'ultimo
      giro: un recupero che gira di notte e non lascia traccia è un recupero di
      cui nessuno può dire se funziona. */
  const [recupero, setRecupero] = useState<null | "ora" | "storico">(null);
  const [esitoRecupero, setEsitoRecupero] = useState<null | {
    nuovi?: number;
    trovati?: number;
    moduli?: number;
    errore?: string;
    quando?: string;
  }>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  // Storico ultime esecuzioni cron (job 'meta-spend-sync-daily')
  interface CronRunRow {
    runid: number;
    status: string;
    return_message: string | null;
    start_time: string;
    end_time: string | null;
  }
  const [cronRuns, setCronRuns] = useState<CronRunRow[] | null>(null);
  const [cronLoading, setCronLoading] = useState(false);
  const [cronError, setCronError] = useState<string | null>(null);
  const [initialCutoff, setInitialCutoff] = useState<string>("");
  const [syncDays, setSyncDays] = useState<number>(0);
  // TikTok sync state
  const [ttSyncing, setTtSyncing] = useState(false);
  const [ttSyncDays, setTtSyncDays] = useState<number>(0);
  const [ttSyncResult, setTtSyncResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [ttLastSync, setTtLastSync] = useState<{ at: string | null; rows: number }>({
    at: null,
    rows: 0,
  });

  const loadCronHistory = async () => {
    setCronLoading(true);
    setCronError(null);
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const res = await fetch("/hooks/cron-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
      });
      if (!res.ok) {
        setCronError(`HTTP ${res.status}`);
        setCronRuns([]);
        return;
      }
      const json = (await res.json()) as { ok?: boolean; runs?: CronRunRow[]; error?: string };
      if (!json.ok) {
        setCronError(json.error || "Errore sconosciuto");
        setCronRuns([]);
      } else {
        setCronRuns((json.runs ?? []).slice(0, 5));
      }
    } catch (e) {
      setCronError(e instanceof Error ? e.message : String(e));
      setCronRuns([]);
    } finally {
      setCronLoading(false);
    }
  };

  const runVideoBackfill = async () => {
    if (!user) return;
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const { backfillMetaVideoMetrics } = await import("@/crm/ads-financials.functions");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessione scaduta, rifai login");
      const res = await backfillMetaVideoMetrics({ data: { accessToken: token } });
      const msg = `${res.rows ?? 0} righe aggiornate · ${res.fetched ?? 0} fetched · ${res.batches ?? 0} batch${res.errors?.length ? ` · ${res.errors.length} errori` : ""}`;
      setBackfillResult({ ok: true, message: msg });
      toast.success(`Backfill OK: ${msg}`);
      await loadLastSync();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setBackfillResult({ ok: false, message: msg });
      toast.error(`Backfill fallito: ${msg}`);
    } finally {
      setBackfilling(false);
    }
  };

  const loadTracking = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("tracking_config")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setTracking({
        meta_pixel_id: data.meta_pixel_id ?? "",
        meta_access_token: data.meta_access_token ?? "",
        meta_test_event_code: data.meta_test_event_code ?? "",
        meta_ad_account_id: data.meta_ad_account_id ?? "",
        meta_page_id: (data as { meta_page_id?: string | null }).meta_page_id ?? "",
        meta_page_access_token:
          (data as { meta_page_access_token?: string | null }).meta_page_access_token ?? "",
        meta_leadgen_verify_token:
          (data as { meta_leadgen_verify_token?: string | null }).meta_leadgen_verify_token ?? "",
        meta_app_secret: (data as { meta_app_secret?: string | null }).meta_app_secret ?? "",
        tiktok_pixel_id: data.tiktok_pixel_id ?? "",
        tiktok_access_token: data.tiktok_access_token ?? "",
        tiktok_advertiser_id:
          (data as { tiktok_advertiser_id?: string | null }).tiktok_advertiser_id ?? "",
        tiktok_test_event_code:
          (data as { tiktok_test_event_code?: string | null }).tiktok_test_event_code ?? "",
        tiktok_ads_history_start: (data as { tiktok_ads_history_start?: string | null })
          .tiktok_ads_history_start
          ? String(
              (data as { tiktok_ads_history_start?: string | null }).tiktok_ads_history_start,
            ).slice(0, 10)
          : "",
        daily_spend_meta: Number(data.daily_spend_meta ?? 0),
        daily_spend_tiktok: Number(data.daily_spend_tiktok ?? 0),
        daily_spend_organico: Number(
          (data as { daily_spend_organico?: number }).daily_spend_organico ?? 0,
        ),
        iva_included: data.iva_included ?? true,
        margine_profitto_pct: Number(data.margine_profitto_pct ?? 40),
        costo_prodotto: Number(data.costo_prodotto ?? 0),
        ads_history_start: (data as { ads_history_start?: string | null }).ads_history_start
          ? String((data as { ads_history_start?: string | null }).ads_history_start).slice(0, 10)
          : "",
        fatigue_alerts_enabled:
          (data as { fatigue_alerts_enabled?: boolean }).fatigue_alerts_enabled ?? true,
        fatigue_freq_threshold: Number(
          (data as { fatigue_freq_threshold?: number }).fatigue_freq_threshold ?? 3.5,
        ),
        fatigue_scroll_threshold: Number(
          (data as { fatigue_scroll_threshold?: number }).fatigue_scroll_threshold ?? 40,
        ),
        fatigue_time_threshold: Number(
          (data as { fatigue_time_threshold?: number }).fatigue_time_threshold ?? 15,
        ),
      });
      const c = (data as { ads_history_start?: string | null }).ads_history_start
        ? String((data as { ads_history_start?: string | null }).ads_history_start).slice(0, 10)
        : "";
      setInitialCutoff(c);
    }
  };

  const loadLastSync = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("meta_ad_spend")
      .select("fetched_at")
      .eq("user_id", user.id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { count } = await supabase
      .from("meta_ad_spend")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    setLastSync({ at: data?.fetched_at ?? null, rows: count ?? 0 });
  };

  const loadTtLastSync = async () => {
    if (!user) return;
    type TtRow = { fetched_at: string };
    const { data } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (s: string) => {
            eq: (
              k: string,
              v: string,
            ) => {
              order: (
                c: string,
                o: { ascending: boolean },
              ) => {
                limit: (n: number) => { maybeSingle: () => Promise<{ data: TtRow | null }> };
              };
            };
          };
        };
      }
    )
      .from("tiktok_ad_spend")
      .select("fetched_at")
      .eq("user_id", user.id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const { count } = await (
      supabase as unknown as {
        from: (t: string) => {
          select: (
            s: string,
            o: { count: string; head: boolean },
          ) => {
            eq: (k: string, v: string) => Promise<{ count: number | null }>;
          };
        };
      }
    )
      .from("tiktok_ad_spend")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);
    setTtLastSync({ at: data?.fetched_at ?? null, rows: count ?? 0 });
  };

  const runTtSyncNow = async (overrideDays?: number) => {
    if (!user) return;
    if (!tracking.tiktok_advertiser_id || !tracking.tiktok_access_token) {
      toast.error("Inserisci e salva Advertiser ID + Access Token TikTok prima di sincronizzare");
      return;
    }
    setTtSyncing(true);
    setTtSyncResult(null);
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const days = overrideDays ?? ttSyncDays;
      const res = await fetch("/hooks/tiktok-spend-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
        body: days > 0 ? JSON.stringify({ days }) : undefined,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        results?: Array<{ user_id: string; rows: number; error?: string }>;
      };
      if (!res.ok || !json.ok) {
        const msg = json.error || `HTTP ${res.status}`;
        setTtSyncResult({ ok: false, message: msg });
        toast.error(`Sync TikTok fallita: ${msg}`);
      } else {
        const mine = json.results?.find((r) => r.user_id === user.id);
        if (mine?.error) {
          setTtSyncResult({ ok: false, message: mine.error });
          toast.error(`Sync TikTok fallita: ${mine.error}`);
        } else {
          const rows = mine?.rows ?? 0;
          setTtSyncResult({ ok: true, message: `${rows} righe sincronizzate` });
          toast.success(`Sync TikTok completata: ${rows} righe`);
          await loadTtLastSync();
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTtSyncResult({ ok: false, message: msg });
      toast.error(`Sync TikTok fallita: ${msg}`);
    } finally {
      setTtSyncing(false);
    }
  };

  useEffect(() => {
    loadTracking();
    loadLastSync();
    loadTtLastSync();
    loadCronHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const saveTracking = async () => {
    if (!user) return;
    setSavingTracking(true);
    const { error } = await supabase.from("tracking_config").upsert(
      {
        user_id: user.id,
        meta_pixel_id: tracking.meta_pixel_id || null,
        meta_access_token: tracking.meta_access_token || null,
        meta_test_event_code: tracking.meta_test_event_code || null,
        meta_ad_account_id: tracking.meta_ad_account_id || null,
        meta_page_id: tracking.meta_page_id || null,
        meta_page_access_token: tracking.meta_page_access_token || null,
        meta_leadgen_verify_token: tracking.meta_leadgen_verify_token || null,
        meta_app_secret: tracking.meta_app_secret || null,
        tiktok_pixel_id: tracking.tiktok_pixel_id || null,
        tiktok_access_token: tracking.tiktok_access_token || null,
        tiktok_advertiser_id: tracking.tiktok_advertiser_id || null,
        tiktok_test_event_code: tracking.tiktok_test_event_code || null,
        tiktok_ads_history_start: tracking.tiktok_ads_history_start || null,
        daily_spend_meta: tracking.daily_spend_meta,
        daily_spend_tiktok: tracking.daily_spend_tiktok,
        daily_spend_organico: tracking.daily_spend_organico,
        iva_included: tracking.iva_included,
        margine_profitto_pct: tracking.margine_profitto_pct,
        costo_prodotto: tracking.costo_prodotto,
        ads_history_start: tracking.ads_history_start || null,
        fatigue_alerts_enabled: tracking.fatigue_alerts_enabled,
        fatigue_freq_threshold: tracking.fatigue_freq_threshold,
        fatigue_scroll_threshold: tracking.fatigue_scroll_threshold,
        fatigue_time_threshold: tracking.fatigue_time_threshold,
      } as never,
      { onConflict: "user_id" },
    );
    setSavingTracking(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Configurazione tracking salvata");
    // Se è cambiato il cutoff "Data inizio storico ads", invalidiamo le cache
    // (server-side + localStorage di Ads Manager) altrimenti la dashboard continua
    // a mostrare i dati vecchi cachati e sembra che il cutoff non venga rispettato.
    const newCutoff = tracking.ads_history_start || "";
    if (newCutoff !== initialCutoff) {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) await clearAdsServerCache({ data: { accessToken: token } });
      } catch {
        /* non bloccante */
      }
      const n = clearAdsLocalCache();
      toast.info(
        `Cache Ads invalidata${n > 0 ? ` (${n} entries)` : ""} — riapri Ads Manager per vedere i dati col nuovo cutoff`,
      );
      setInitialCutoff(newCutoff);
    }
  };

  /** Lancia subito il recupero dei lead dei moduli Meta.
   *  `giorni` = quanto indietro guardare: 3 per il giro normale, 90 per
   *  portare dentro lo storico la prima volta. */
  useEffect(() => {
    //  L'ultimo giro fatto dal recupero automatico: senza questa riga la
    //  pagina saprebbe dire solo com'è andata quando sei stato tu a premere.
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
    fetch("/hooks/meta-lead-sync", { headers: { Authorization: `Bearer ${anonKey}` } })
      .then((r) => r.json())
      .then((j: { ultimo?: { nuovi?: number; trovati?: number; moduli?: number; errore?: string; quando?: string } | null }) => {
        if (j?.ultimo) setEsitoRecupero(j.ultimo);
      })
      .catch(() => { /* niente esito: la riga semplicemente non compare */ });
  }, []);

  const recuperaLeadMeta = async (giorni: number) => {
    if (!tracking.meta_page_id || !tracking.meta_page_access_token) {
      toast.error("Prima inserisci e salva Page ID e Page Access Token");
      return;
    }
    setRecupero(giorni > 30 ? "storico" : "ora");
    setEsitoRecupero(null);
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const res = await fetch("/hooks/meta-lead-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({ giorni }),
      });
      const j = (await res.json()) as {
        ok?: boolean;
        errore?: string;
        error?: string;
        nuovi?: number;
        trovati?: number;
        moduli?: number;
      };
      const errore = j.errore || j.error || (res.ok ? undefined : `HTTP ${res.status}`);
      setEsitoRecupero({ nuovi: j.nuovi, trovati: j.trovati, moduli: j.moduli, errore });
      if (errore) toast.error(`Recupero non riuscito: ${errore}`);
      else if ((j.nuovi ?? 0) > 0)
        toast.success(`${j.nuovi} nuovi contatti: li trovi in «Nuovi contatti»`);
      else toast.success(`Nessun contatto nuovo (${j.trovati ?? 0} già dentro)`);
    } catch (e) {
      const errore = e instanceof Error ? e.message : "errore di rete";
      setEsitoRecupero({ errore });
      toast.error(`Recupero non riuscito: ${errore}`);
    } finally {
      setRecupero(null);
    }
  };

  const runSyncNow = async (overrideDays?: number) => {
    if (!user) return;
    if (!tracking.meta_ad_account_id || !tracking.meta_access_token) {
      toast.error("Inserisci e salva Ad Account ID + Access Token prima di sincronizzare");
      return;
    }
    setSyncing(true);
    setSyncResult(null);
    try {
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const days = overrideDays ?? syncDays;
      const res = await fetch("/hooks/meta-spend-sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
        },
        body: days > 0 ? JSON.stringify({ days }) : undefined,
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        results?: Array<{ user_id: string; rows: number; error?: string }>;
      };
      if (!res.ok || !json.ok) {
        const msg = json.error || `HTTP ${res.status}`;
        setSyncResult({ ok: false, message: msg });
        toast.error(`Sync fallita: ${msg}`);
      } else {
        const mine = json.results?.find((r) => r.user_id === user.id);
        if (mine?.error) {
          setSyncResult({ ok: false, message: mine.error });
          toast.error(`Sync fallita: ${mine.error}`);
        } else {
          const rows = mine?.rows ?? 0;
          if (rows === 0) {
            // 0 righe: controlla se esistono spese > 0 negli ultimi 30gg per capire se
            // l'account è vivo. Se sì → warning esplicito (probabile delay Meta o pausa
            // momentanea), altrimenti messaggio neutro su account inattivo.
            const since = new Date();
            since.setDate(since.getDate() - 30);
            const sinceIso = since.toISOString().slice(0, 10);
            const { count: recentCount } = await supabase
              .from("meta_ad_spend")
              .select("*", { count: "exact", head: true })
              .eq("user_id", user.id)
              .gte("spend_date", sinceIso)
              .gt("spend", 0);
            if ((recentCount ?? 0) > 0) {
              setSyncResult({
                ok: false,
                message:
                  "0 righe per il periodo selezionato. La Meta API non ha restituito spesa: account in pausa o spesa non ancora consolidata (Meta aggiorna gli insights con qualche ora di ritardo). Riprova più tardi o seleziona un range più ampio.",
              });
              toast.warning("Sync: 0 righe ma account attivo negli ultimi 30gg");
            } else {
              setSyncResult({
                ok: true,
                message:
                  "0 righe sincronizzate. Nessuna spesa rilevata nemmeno negli ultimi 30 giorni: account inattivo o credenziali su un ad account sbagliato.",
              });
              toast.message("Sync: nessuna spesa recente sull'account");
            }
          } else {
            setSyncResult({ ok: true, message: `${rows} righe sincronizzate` });
            toast.success(`Sync completata: ${rows} righe`);
          }
          await loadLastSync();
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSyncResult({ ok: false, message: msg });
      toast.error(`Sync fallita: ${msg}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <SettingsIcon className="h-6 w-6" />
            Impostazioni
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestione utenti, integrazioni API, costi e notifiche. Passa il mouse sui{" "}
            <HelpCircle className="inline h-3.5 w-3.5 mx-0.5 -mt-0.5" /> per la guida.
          </p>
        </div>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          {/* ── ⚠️ LE SCHEDE NON STANNO IN UNA GRIGLIA ────────────────────
                Erano dodici colonne di larghezza uguale, e le parole non sono
                lunghe uguali: «Dati» ci ballava dentro e «Intelligenza
                artificiale» usciva dalla sua casella e finiva SOPRA
                «Diagnostica» — due nomi stampati uno sull'altro, illeggibili
                tutti e due.
                Adesso ogni scheda è larga quanto la sua parola e vanno a capo
                da sole: nessuna si accavalla mai, qualunque nome ci si metta e
                qualunque sia la larghezza dello schermo. È anche il motivo per
                cui non c'è una barra che scorre di lato — quello che scorre
                fuori campo, su una pagina di impostazioni, non lo trova più
                nessuno. */}
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 p-1">
            <TabsTrigger value="meta" className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs">
              <BarChart3 className="h-3.5 w-3.5" /> Meta Ads
            </TabsTrigger>
            <TabsTrigger value="tiktok" className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs">
              <Music2 className="h-3.5 w-3.5" /> TikTok Ads
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs">
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </TabsTrigger>
            {/* ── ⚠️ I TESTI CHE PARTONO AI CLIENTI ────────────────────────
                Richiesta del committente: «fai che tutti i messaggi posso
                modificarli da una scheda nelle impostazioni, con i
                segnaposto».
                L'editor c'era già, ma viveva dentro la pagina delle chat —
                un posto in cui si entra per LEGGERE le conversazioni, non per
                configurare — e chi cercava «dove si cambiano i testi» veniva
                qui e non trovava niente. È lo stesso identico componente, non
                una copia: due schermate gemelle per la stessa configurazione
                si scostano al primo ritocco.
                Sta accanto a «WhatsApp» perché è lì che si va a cercarlo, ma
                è una scheda sua: quella accanto sono le CREDENZIALI, questi
                sono i TESTI, e sono due lavori diversi. */}
            <TabsTrigger value="messaggi" className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs">
              <MessageCircle className="h-3.5 w-3.5" /> Messaggi
            </TabsTrigger>
            <TabsTrigger value="landing" className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs">
              <Layout className="h-3.5 w-3.5" /> Landing Page
            </TabsTrigger>
            <TabsTrigger value="costi" className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs">
              <Euro className="h-3.5 w-3.5" /> Costi & Margini
            </TabsTrigger>
            <TabsTrigger value="alert" className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs">
              <Bell className="h-3.5 w-3.5" /> Notifiche
            </TabsTrigger>
            <TabsTrigger value="meetly" className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs">
              <Video className="h-3.5 w-3.5" /> Meetly
            </TabsTrigger>
            <TabsTrigger value="webinar" className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs">
              <Radio className="h-3.5 w-3.5" /> Webinar
            </TabsTrigger>
            <TabsTrigger value="ai" className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs">
              <Sparkles className="h-3.5 w-3.5" /> Intelligenza artificiale
            </TabsTrigger>
            <TabsTrigger value="diagnostica" className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs">
              <Activity className="h-3.5 w-3.5" /> Diagnostica
            </TabsTrigger>
            <TabsTrigger value="dati" className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs">
              <Database className="h-3.5 w-3.5" /> Dati
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="utenti" className="shrink-0 gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs">
                <ShieldCheck className="h-3.5 w-3.5" /> Utenti
              </TabsTrigger>
            )}
          </TabsList>

          {/* === META ADS TAB === */}
          <TabsContent value="meta" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-5 w-5" />
                  Meta Ads — Pixel, CAPI & Marketing API
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Tracking eventi (browser + server), sync spesa giornaliera, backfill metriche
                  video.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <LabelWithHelp
                      label="Pixel ID"
                      help="Trovi il Pixel ID in Meta Events Manager → Origini dati → seleziona il pixel → l'ID è in alto. È un numero di 15-16 cifre. Serve per il tracking lato browser."
                    />
                    <Input
                      value={tracking.meta_pixel_id}
                      onChange={(e) => setTracking({ ...tracking, meta_pixel_id: e.target.value })}
                      placeholder="1234567890"
                    />
                  </div>
                  <div>
                    <LabelWithHelp
                      label="Test event code (opz.)"
                      help="Solo per testing: in Events Manager → Test events copi il codice TESTxxxxx e lo incolli qui per vedere gli eventi in tempo reale nel pannello di test. Lascialo vuoto in produzione."
                    />
                    <Input
                      value={tracking.meta_test_event_code}
                      onChange={(e) =>
                        setTracking({ ...tracking, meta_test_event_code: e.target.value })
                      }
                      placeholder="TEST12345"
                    />
                  </div>
                  <div className="col-span-2">
                    <LabelWithHelp
                      label="Access Token (Conversions API + Marketing API)"
                      help="Genera un System User token in Business Settings → System Users → Add → Admin → Generate Token. Permessi richiesti: ads_read, ads_management, business_management. Scegli 'Never expire'."
                    />
                    <Input
                      type="password"
                      value={tracking.meta_access_token}
                      onChange={(e) =>
                        setTracking({ ...tracking, meta_access_token: e.target.value })
                      }
                      placeholder="EAA…"
                    />
                  </div>
                  <div className="col-span-2">
                    <LabelWithHelp
                      label="Ad Account ID"
                      help="Trovi l'ID in Ads Manager in alto a sinistra (sotto al nome account). Includi sempre il prefisso act_ (es. act_123456789). Necessario per la sync automatica della spesa."
                    />
                    <Input
                      value={tracking.meta_ad_account_id}
                      onChange={(e) =>
                        setTracking({ ...tracking, meta_ad_account_id: e.target.value })
                      }
                      placeholder="act_123456789"
                    />
                  </div>

                  {/* ── Meta Lead Ads (leadgen) → CRM automatico ── */}
                  <div className="col-span-2 rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-3">
                    <Label className="flex items-center gap-1.5 text-blue-900 font-semibold">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Meta Lead Ads → CRM automatico
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      I lead raccolti dai moduli delle inserzioni Meta arrivano automaticamente nel
                      CRM. Configura la Pagina, il token e il webhook qui sotto.
                    </p>
                    <div>
                      <LabelWithHelp
                        label="Page ID"
                        help="ID della Pagina Facebook collegata alle inserzioni Lead. Lo trovi in Impostazioni Pagina → Informazioni, oppure in Business Settings → Pagine."
                      />
                      <Input
                        value={tracking.meta_page_id}
                        onChange={(e) => setTracking({ ...tracking, meta_page_id: e.target.value })}
                        placeholder="1234567890"
                      />
                    </div>
                    <div>
                      <LabelWithHelp
                        label="Page Access Token"
                        help="Token della Pagina con permesso leads_retrieval + pages_manage_metadata. Genera un System User token in Business Settings → System Users, assegna la Pagina come asset e scegli 'Never expire'."
                      />
                      <Input
                        type="password"
                        value={tracking.meta_page_access_token}
                        onChange={(e) =>
                          setTracking({ ...tracking, meta_page_access_token: e.target.value })
                        }
                        placeholder="EAA…"
                      />
                    </div>
                    <div>
                      <LabelWithHelp
                        label="Verify Token (webhook)"
                        help="Una stringa segreta a tua scelta: la incolli qui e poi identica nel campo 'Verify token' del webhook su Meta. Serve per l'handshake iniziale."
                      />
                      <Input
                        value={tracking.meta_leadgen_verify_token}
                        onChange={(e) =>
                          setTracking({ ...tracking, meta_leadgen_verify_token: e.target.value })
                        }
                        placeholder="hairgenius_leadgen_2026"
                      />
                    </div>
                    <div>
                      <LabelWithHelp
                        label="App Secret"
                        help="App Secret dell'app Meta (Impostazioni → Di base). Serve per verificare la firma X-Hub-Signature-256 dei webhook in arrivo."
                      />
                      <Input
                        type="password"
                        value={tracking.meta_app_secret}
                        onChange={(e) =>
                          setTracking({ ...tracking, meta_app_secret: e.target.value })
                        }
                        placeholder="32 caratteri esadecimali"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">
                        Callback URL (incollalo su Meta → Webhooks → campo "leadgen")
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Input
                          readOnly
                          value={
                            typeof window !== "undefined"
                              ? `${window.location.origin}/api/public/meta-leadgen-webhook`
                              : "/api/public/meta-leadgen-webhook"
                          }
                          className="font-mono text-[11px]"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `${window.location.origin}/api/public/meta-leadgen-webhook`,
                            );
                            toast.success("Callback URL copiato");
                          }}
                        >
                          Copia
                        </Button>
                      </div>
                    </div>

                    {/* ── ⚠️ IL RECUPERO PERIODICO ────────────────────────────
                        Il webhook porta dentro il lead nell'istante in cui
                        viene compilato, ma quando non parte — app in revisione,
                        token scaduto, un nostro deploy nel momento sbagliato —
                        quel lead non arriva MAI PIÙ: Meta non ritenta
                        all'infinito. Ogni 5 minuti andiamo a vedere noi, e
                        scriviamo quello che manca. Qui si può anche lanciare a
                        mano — serve al primo giro, per tirare dentro i lead
                        raccolti prima di collegare tutto. */}
                    <div className="rounded-md border border-blue-200 bg-white/70 p-2.5">
                      <p className="text-[12px] font-semibold text-blue-900">
                        Recupero periodico (ogni 5 minuti)
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Ripassa gli ultimi giorni e porta dentro i lead che il webhook non ha
                        visto. I doppioni non li scrive: riconosce quelli già presi.
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={recupero !== null}
                          onClick={() => recuperaLeadMeta(3)}
                        >
                          {recupero === "ora" ? "Recupero…" : "Recupera adesso"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={recupero !== null}
                          onClick={() => recuperaLeadMeta(90)}
                          title="Guarda indietro 90 giorni: serve la prima volta, per portare dentro i lead già raccolti."
                        >
                          {recupero === "storico" ? "Recupero…" : "Porta dentro lo storico (90 giorni)"}
                        </Button>
                      </div>
                      {esitoRecupero && (
                        <p
                          className={`mt-2 text-[11px] ${esitoRecupero.errore ? "text-red-700" : "text-muted-foreground"}`}
                        >
                          {esitoRecupero.errore
                            ? `Ultimo tentativo${esitoRecupero.quando ? ` (${new Date(esitoRecupero.quando).toLocaleString("it-IT")})` : ""}: ${esitoRecupero.errore}`
                            : `Ultimo recupero${esitoRecupero.quando ? ` (${new Date(esitoRecupero.quando).toLocaleString("it-IT")})` : ""}: ${esitoRecupero.nuovi ?? 0} nuovi su ${esitoRecupero.trovati ?? 0} letti, ${esitoRecupero.moduli ?? 0} moduli.`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                    <Label className="flex items-center gap-1.5 text-amber-900">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Data inizio storico ads (cutoff)
                    </Label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Input
                        type="date"
                        value={tracking.ads_history_start}
                        onChange={(e) =>
                          setTracking({ ...tracking, ads_history_start: e.target.value })
                        }
                        className="max-w-[200px]"
                      />
                      {tracking.ads_history_start && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setTracking({ ...tracking, ads_history_start: "" })}
                        >
                          Rimuovi cutoff
                        </Button>
                      )}
                    </div>
                    <p className="text-[11.5px] text-amber-900/80 mt-2 leading-relaxed">
                      Tutto ciò che è precedente a questa data verrà{" "}
                      <strong>ignorato ovunque</strong> nel CRM. Lascia vuoto per usare tutto lo
                      storico disponibile.
                    </p>
                  </div>

                  <div className="col-span-2 mt-2 rounded-lg border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-sm font-medium flex items-center gap-1.5">
                          <RefreshCw className="h-3.5 w-3.5" />
                          Sync spesa Meta (Marketing API)
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {lastSync.at ? (
                            <>
                              Ultima sync:{" "}
                              <span className="font-medium text-foreground">
                                {formatDistanceToNow(new Date(lastSync.at), {
                                  addSuffix: true,
                                  locale: it,
                                })}
                              </span>{" "}
                              · {lastSync.rows} righe
                            </>
                          ) : (
                            <>Mai sincronizzato. Il cron parte ogni giorno alle 06:00 UTC.</>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <select
                          value={syncDays}
                          onChange={(e) => setSyncDays(Number(e.target.value))}
                          disabled={syncing}
                          className="h-8 text-xs rounded-md border border-input bg-background px-2"
                        >
                          <option value={0}>Ieri+Oggi</option>
                          <option value={7}>Ultimi 7gg</option>
                          <option value={30}>Ultimi 30gg</option>
                          <option value={90}>Ultimi 90gg</option>
                          <option value={180}>Ultimi 180gg</option>
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runSyncNow()}
                          disabled={syncing}
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 mr-1.5 ${syncing ? "animate-spin" : ""}`}
                          />
                          {syncing ? "Sync…" : "Sincronizza ora"}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={runVideoBackfill}
                          disabled={backfilling}
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 mr-1.5 ${backfilling ? "animate-spin" : ""}`}
                          />
                          {backfilling ? "Backfill…" : "Backfill video"}
                        </Button>
                      </div>
                    </div>
                    {syncResult && (
                      <div
                        className={`text-[11px] flex items-center gap-1.5 rounded px-2 py-1 ${syncResult.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}
                      >
                        {syncResult.ok ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        )}
                        {syncResult.message}
                      </div>
                    )}
                    {backfillResult && (
                      <div
                        className={`text-[11px] flex items-center gap-1.5 rounded px-2 py-1 ${backfillResult.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}
                      >
                        {backfillResult.ok ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        )}
                        Video backfill: {backfillResult.message}
                      </div>
                    )}

                    <div className="rounded-md border border-border/60 bg-muted/30 p-2.5 mt-1">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Ultime esecuzioni cron (06:00 UTC)
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={loadCronHistory}
                          disabled={cronLoading}
                          className="h-6 px-1.5 text-[10px]"
                        >
                          <RefreshCw className={`h-3 w-3 ${cronLoading ? "animate-spin" : ""}`} />
                        </Button>
                      </div>
                      {cronError && (
                        <div className="text-[11px] text-destructive">Errore: {cronError}</div>
                      )}
                      {!cronError && cronRuns && cronRuns.length === 0 && (
                        <div className="text-[11px] text-muted-foreground italic">
                          Nessuna esecuzione registrata.
                        </div>
                      )}
                      {!cronError && cronRuns && cronRuns.length > 0 && (
                        <div className="space-y-0.5">
                          {cronRuns.map((r) => {
                            const ok = r.status === "succeeded";
                            const when = formatDistanceToNow(new Date(r.start_time), {
                              addSuffix: true,
                              locale: it,
                            });
                            return (
                              <div
                                key={r.runid}
                                className="flex items-center gap-2 text-[11px] tabular-nums"
                              >
                                {ok ? (
                                  <CheckCircle2 className="h-3 w-3 text-emerald-600 shrink-0" />
                                ) : (
                                  <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />
                                )}
                                <span className="text-muted-foreground w-32 shrink-0">{when}</span>
                                <span
                                  className={
                                    ok
                                      ? "text-emerald-700 dark:text-emerald-400 font-medium"
                                      : "text-destructive font-medium"
                                  }
                                >
                                  {r.status}
                                </span>
                                {r.return_message && (
                                  <span
                                    className="text-muted-foreground truncate"
                                    title={r.return_message}
                                  >
                                    · {r.return_message}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <GatingThresholdsSection />

                <Button onClick={saveTracking} disabled={savingTracking} className="w-full">
                  {savingTracking ? "Salvataggio…" : "Salva configurazione"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === TIKTOK TAB === */}
          <TabsContent value="tiktok" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Music2 className="h-5 w-5" />
                  TikTok Ads — Pixel, CAPI & Marketing API
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Tracking eventi (browser + server), sync spesa giornaliera, attribuzione campagne.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <LabelWithHelp
                      label="Pixel ID"
                      help="In TikTok Ads Manager → Strumenti → Eventi → Web events. Copia l'ID del pixel (formato C1234ABCD…). Serve per il tracking lato browser."
                    />
                    <Input
                      value={tracking.tiktok_pixel_id}
                      onChange={(e) =>
                        setTracking({ ...tracking, tiktok_pixel_id: e.target.value })
                      }
                      placeholder="C1234…"
                    />
                  </div>
                  <div>
                    <LabelWithHelp
                      label="Test event code (opz.)"
                      help="Solo per testing: in TikTok Events Manager → Test events copia il codice TEST… e incollalo qui per vedere gli eventi in tempo reale nel pannello di test. Lascia vuoto in produzione."
                    />
                    <Input
                      value={tracking.tiktok_test_event_code}
                      onChange={(e) =>
                        setTracking({ ...tracking, tiktok_test_event_code: e.target.value })
                      }
                      placeholder="TEST12345"
                    />
                  </div>
                  <div className="col-span-2">
                    <LabelWithHelp
                      label="Access Token (Events API + Marketing API)"
                      help="In TikTok for Business → Developer → My apps → la tua app → Access tokens. Genera un long-lived token con scopi 'Ads Management (Read)' + 'Web Events Management'. Validità: 24 mesi."
                    />
                    <Input
                      type="password"
                      value={tracking.tiktok_access_token}
                      onChange={(e) =>
                        setTracking({ ...tracking, tiktok_access_token: e.target.value })
                      }
                      placeholder="Long-lived token con scope Ads Management + Web Events"
                    />
                  </div>
                  <div className="col-span-2">
                    <LabelWithHelp
                      label="Advertiser ID"
                      help="In TikTok Ads Manager → Account info (in alto a destra). È un numero di 19 cifre. Necessario per la sync della spesa via Marketing API."
                    />
                    <Input
                      value={tracking.tiktok_advertiser_id}
                      onChange={(e) =>
                        setTracking({ ...tracking, tiktok_advertiser_id: e.target.value })
                      }
                      placeholder="7234567890123456789"
                    />
                  </div>

                  <div className="col-span-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                    <Label className="flex items-center gap-1.5 text-amber-900">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Data inizio storico TikTok ads (cutoff)
                    </Label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Input
                        type="date"
                        value={tracking.tiktok_ads_history_start}
                        onChange={(e) =>
                          setTracking({ ...tracking, tiktok_ads_history_start: e.target.value })
                        }
                        className="max-w-[200px]"
                      />
                      {tracking.tiktok_ads_history_start && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setTracking({ ...tracking, tiktok_ads_history_start: "" })}
                        >
                          Rimuovi cutoff
                        </Button>
                      )}
                    </div>
                    <p className="text-[11.5px] text-amber-900/80 mt-2 leading-relaxed">
                      Tutto ciò che è precedente a questa data verrà{" "}
                      <strong>ignorato ovunque</strong> nel CRM TikTok. Lascia vuoto per usare tutto
                      lo storico disponibile.
                    </p>
                  </div>

                  <div className="col-span-2 mt-2 rounded-lg border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="text-sm font-medium flex items-center gap-1.5">
                          <RefreshCw className="h-3.5 w-3.5" />
                          Sync spesa TikTok
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {ttLastSync.at ? (
                            <>
                              Ultima sync:{" "}
                              <span className="font-medium text-foreground">
                                {formatDistanceToNow(new Date(ttLastSync.at), {
                                  addSuffix: true,
                                  locale: it,
                                })}
                              </span>{" "}
                              · {ttLastSync.rows} righe
                            </>
                          ) : (
                            <>Mai sincronizzato.</>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={ttSyncDays}
                          onChange={(e) => setTtSyncDays(Number(e.target.value))}
                          disabled={ttSyncing}
                          className="h-8 text-xs rounded-md border border-input bg-background px-2"
                        >
                          <option value={0}>Ieri+Oggi</option>
                          <option value={7}>Ultimi 7gg</option>
                          <option value={30}>Ultimi 30gg</option>
                          <option value={90}>Ultimi 90gg</option>
                        </select>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => runTtSyncNow()}
                          disabled={ttSyncing}
                        >
                          <RefreshCw
                            className={`h-3.5 w-3.5 mr-1.5 ${ttSyncing ? "animate-spin" : ""}`}
                          />
                          {ttSyncing ? "Sync…" : "Sincronizza ora"}
                        </Button>
                      </div>
                    </div>
                    {ttSyncResult && (
                      <div
                        className={`text-[11px] flex items-center gap-1.5 rounded px-2 py-1 ${ttSyncResult.ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}
                      >
                        {ttSyncResult.ok ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        )}
                        {ttSyncResult.message}
                      </div>
                    )}
                  </div>
                </div>

                <Button onClick={saveTracking} disabled={savingTracking} className="w-full">
                  {savingTracking ? "Salvataggio…" : "Salva configurazione"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === WHATSAPP TAB === */}
          <TabsContent value="whatsapp" className="space-y-4 mt-4">
            <WhatsAppSettingsSection />

            <SezioneIndirizziGoogle />
          </TabsContent>

          {/* === MESSAGGI TAB === */}
          <TabsContent value="messaggi" className="mt-4">
            {/*  ⚠️ L'altezza è dichiarata: l'editor è a due colonne che
                scorrono per conto loro (l'elenco dei testi a sinistra,
                l'anteprima a destra), e dentro un contenitore che cresce
                all'infinito le due colonne non scorrerebbero mai. */}
            <div className="h-[calc(100vh-14rem)] min-h-[32rem] overflow-hidden rounded-xl border border-border">
              <EditorMessaggi />
            </div>
          </TabsContent>

          {/* === LANDING PAGE TAB === */}
          <TabsContent value="landing" className="space-y-4 mt-4">
            <LandingContentEditor />
          </TabsContent>

          {/* === COSTI TAB === */}
          <TabsContent value="costi" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Euro className="h-5 w-5" />
                  Costi, margini & spese manuali
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Parametri economici per ROAS, Break-even, CPL e attribuzione organica.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <LabelWithHelp
                      label="Margine di profitto %"
                      help="Margine netto sul prezzo di vendita. Es. 40% → Break-even ROAS = 2.5x. Usato per calcolare il ROAS minimo profittevole."
                    />
                    <Input
                      type="number"
                      min={1}
                      max={99}
                      value={tracking.margine_profitto_pct}
                      onChange={(e) =>
                        setTracking({ ...tracking, margine_profitto_pct: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <LabelWithHelp
                      label="Costo prodotto € (per vendita)"
                      help="Costo unitario reale che paghi per produrre/fornire 1 vendita. Usato per il calcolo netto: Ricavo − Costo Prodotto × Conv − Spesa Ads."
                    />
                    <Input
                      type="number"
                      min={0}
                      value={tracking.costo_prodotto}
                      onChange={(e) =>
                        setTracking({ ...tracking, costo_prodotto: Number(e.target.value) })
                      }
                      placeholder="es. 800"
                    />
                  </div>
                  <div>
                    <LabelWithHelp
                      label="Spesa giornaliera Meta (€)"
                      help="Override manuale: usato come fallback solo se la Marketing API non risponde. Lascia 0 per usare sempre i dati API."
                    />
                    <Input
                      type="number"
                      value={tracking.daily_spend_meta}
                      onChange={(e) =>
                        setTracking({ ...tracking, daily_spend_meta: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <LabelWithHelp
                      label="Spesa giornaliera TikTok (€)"
                      help="Override manuale TikTok: se > 0 viene usato al posto dei dati Marketing API."
                    />
                    <Input
                      type="number"
                      value={tracking.daily_spend_tiktok}
                      onChange={(e) =>
                        setTracking({ ...tracking, daily_spend_tiktok: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="col-span-2">
                    <LabelWithHelp
                      label="Spesa giornaliera Organico (€)"
                      help="Il traffico organico (SEO, social non sponsorizzato) non ha API. Imposta a mano un costo giornaliero attribuito (es. costo content creator). Lascia 0 per non attribuire alcun costo."
                    />
                    <Input
                      type="number"
                      min={0}
                      value={tracking.daily_spend_organico}
                      onChange={(e) =>
                        setTracking({ ...tracking, daily_spend_organico: Number(e.target.value) })
                      }
                      placeholder="es. 50"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t pt-3">
                  <Label>IVA inclusa nei prezzi</Label>
                  <Switch
                    checked={tracking.iva_included}
                    onCheckedChange={(v) => setTracking({ ...tracking, iva_included: v })}
                  />
                </div>

                <Button onClick={saveTracking} disabled={savingTracking} className="w-full">
                  {savingTracking ? "Salvataggio…" : "Salva configurazione"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* === ALERT TAB === */}
          <TabsContent value="alert" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Flame className="h-5 w-5 text-rose-600" />
                  Alert stanchezza creativa
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">
                    Mostra un badge "Stanca" sulle ad che superano queste soglie in Ads Manager.
                  </p>
                  <Switch
                    checked={tracking.fatigue_alerts_enabled}
                    onCheckedChange={(v) => setTracking({ ...tracking, fatigue_alerts_enabled: v })}
                  />
                </div>
                {tracking.fatigue_alerts_enabled && (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div>
                      <Label className="text-[11px]">Frequenza max</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min={1}
                        value={tracking.fatigue_freq_threshold}
                        onChange={(e) =>
                          setTracking({
                            ...tracking,
                            fatigue_freq_threshold: Number(e.target.value),
                          })
                        }
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Default 3.5</p>
                    </div>
                    <div>
                      <Label className="text-[11px]">Scroll min %</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={tracking.fatigue_scroll_threshold}
                        onChange={(e) =>
                          setTracking({
                            ...tracking,
                            fatigue_scroll_threshold: Number(e.target.value),
                          })
                        }
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Default 40%</p>
                    </div>
                    <div>
                      <Label className="text-[11px]">Tempo min (sec)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={tracking.fatigue_time_threshold}
                        onChange={(e) =>
                          setTracking({
                            ...tracking,
                            fatigue_time_threshold: Number(e.target.value),
                          })
                        }
                      />
                      <p className="text-[10px] text-muted-foreground mt-0.5">Default 15s</p>
                    </div>
                  </div>
                )}
                <Button onClick={saveTracking} disabled={savingTracking} className="w-full">
                  {savingTracking ? "Salvataggio…" : "Salva soglie"}
                </Button>
              </CardContent>
            </Card>

            <NotificationPrefsSection />
          </TabsContent>

          {/* === DIAGNOSTICA TAB === */}
          {/* === MEETLY === */}
          <TabsContent value="meetly" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Video className="h-5 w-5 text-indigo-600" /> Meetly
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  L&apos;impianto della videoconsulenza: la credenziale che la fa funzionare, la
                  prova che dice se funziona davvero, e dove sta tutto il resto.
                </p>
              </CardHeader>
              <CardContent>
                <ImpostazioniMeetly />
              </CardContent>
            </Card>
          </TabsContent>

          {/* === WEBINAR === */}
          {/* === INTELLIGENZA ARTIFICIALE === */}
          <TabsContent value="ai" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-5 w-5 text-violet-600" /> Intelligenza artificiale
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Una chiave sola, OpenRouter, per tutto quello che il gestionale genera con
                  l'intelligenza artificiale — a cominciare dalla prova capelli.
                </p>
              </CardHeader>
              <CardContent>
                <ImpostazioniAI />
              </CardContent>
            </Card>

            {/* ── ⚠️ LA CLASSIFICA STA QUI, ACCANTO ALLA CHIAVE ───────────────
                  Non in una pagina di statistiche per conto suo: una schermata
                  di numeri che vive da sola la si apre due volte e poi mai più.
                  Qui invece la si incontra ogni volta che si viene a guardare
                  quanto si sta spendendo in generazioni — che è esattamente il
                  momento in cui serve sapere se quelle generazioni stanno
                  servendo a qualcosa. */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-5 w-5 text-violet-600" /> I tagli più scelti
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Cosa sceglie chi prova i capelli sul sito. Serve a due cose: sapere cosa
                  proporre in consulenza, e togliere dalla vetrina i tagli che non guarda nessuno.
                </p>
              </CardHeader>
              <CardContent>
                <ClassificaTagli />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webinar" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Radio className="h-5 w-5 text-sky-600" /> Webinar
                </CardTitle>
                <p className="text-[11px] text-muted-foreground">
                  Con quale tecnologia parte il pulsante «Vai in onda». La videoconsulenza a due non
                  passa di qui e non cambia in nessun caso.
                </p>
              </CardHeader>
              <CardContent>
                <ImpostazioniWebinar />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="diagnostica" className="space-y-4 mt-4">
            <MetricsDiagnosticSection />
            <DangerZoneSection onReset={loadLastSync} />
          </TabsContent>

          {/* === DATI TAB === */}
          <TabsContent value="dati" className="space-y-4 mt-4">
            <CopiaDatiSection />
            {/*  ⚠️ SOTTO i dati, non sopra: la copia dei dati è quella che si
                 usa ogni settimana, portare via tutto si fa una volta. */}
            <PortaViaTuttoSection />
          </TabsContent>

          {/* === UTENTI TAB === */}
          {isAdmin && (
            <TabsContent value="utenti" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                    Gestione utenti & permessi
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Assegna le schede del CRM ad ogni utente e promuovi ad amministratore.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {allUsers.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nessun utente registrato.</p>
                  )}
                  {allUsers.map((u) => (
                    <UserRow
                      key={u.user_id}
                      row={u}
                      isMe={u.user_id === user?.id}
                      onUpdate={async (patch) => {
                        try {
                          await updateUser(u.user_id, patch);
                          toast.success("Aggiornato");
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Errore");
                        }
                      }}
                    />
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </TooltipProvider>
  );
}

/** Label con icona ? che mostra la guida al passaggio del mouse. */
function LabelWithHelp({ label, help }: { label: string; help: string }) {
  return (
    <div className="flex items-center gap-1">
      <Label>{label}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            tabIndex={-1}
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[320px] text-[11.5px] leading-relaxed">
          {help}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

/** ── LA CHIAVE DI GOOGLE PER GLI INDIRIZZI ────────────────────────────────
 *  Richiesta del committente: poter collegare l'autocompletamento di Google a
 *  tutti i campi degli indirizzi.
 *
 *  ── ⚠️ LA CHIAVE NON TORNA MAI INDIETRO ──────────────────────────────────
 *  Si scrive, si salva, e da quel momento questa schermata sa soltanto SE c'è.
 *  Rileggerla per rimetterla nella casella vorrebbe dire mandarla al browser a
 *  ogni apertura delle impostazioni — cioè esattamente quello che la rotta
 *  evita tenendola sul servitore. Per cambiarla si riscrive; per toglierla si
 *  svuota il campo e si salva.
 *
 *  ── ⚠️ E SENZA CHIAVE NON SI ROMPE NIENTE ────────────────────────────────
 *  I campi continuano a suggerire con OpenStreetMap, che è quello che fanno da
 *  sempre. Questa voce aggiunge precisione, non accende una funzione spenta:
 *  va detto, o si crede di aver rotto qualcosa quando la quota finisce.
 *  ───────────────────────────────────────────────────────────────────────── */
function SezioneIndirizziGoogle() {
  const [chiave, setChiave] = useState("");
  const [attiva, setAttiva] = useState<boolean | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [prova, setProva] = useState("");

  useEffect(() => {
    void fetch("/api/indirizzi?stato=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setAttiva(j?.google === true))
      .catch(() => setAttiva(false));
  }, []);

  const salva = async () => {
    setSalvando(true);
    const r = await fetch("/api/indirizzi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chiave: chiave.trim() }),
    }).catch(() => null);
    setSalvando(false);
    if (!r?.ok) {
      toast.error("La chiave non è stata salvata: riprova.");
      return;
    }
    const j = (await r.json()) as { google?: boolean };
    setAttiva(j.google === true);
    setChiave("");
    toast.success(j.google ? "Google collegato" : "Chiave rimossa: si torna a OpenStreetMap");
  };

  /*  ⚠️ La prova sta QUI e non altrove: una chiave sbagliata non dà nessun
      errore visibile — i campi continuano a suggerire, perché ripiegano. Senza
      un modo di provarla si crede di aver collegato Google per mesi mentre si
      sta usando OpenStreetMap e si paga zero senza saperlo. */
  const provaOra = async () => {
    setProva("cerco…");
    const r = await fetch("/api/indirizzi?q=via%20degli%20scipioni%20roma").catch(() => null);
    if (!r?.ok) {
      setProva("il servizio non ha risposto");
      return;
    }
    const v = (await r.json()) as { esteso?: string }[];
    setProva(v.length ? `${v.length} risultati · il primo: ${v[0].esteso}` : "nessun risultato");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-5 w-5 text-sky-600" />
          Indirizzi: autocompletamento di Google
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Vale su TUTTI i campi degli indirizzi: la fattura, il preventivo e la spedizione. Senza
          chiave i campi suggeriscono lo stesso, con i dati di OpenStreetMap — Google è più preciso
          sui civici e sui CAP.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 text-[13px]">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[12px] font-medium",
              attiva ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600",
            )}
          >
            {attiva === null ? "…" : attiva ? "Google collegato" : "OpenStreetMap"}
          </span>
        </div>

        <label className="block">
          <span className="mb-1 block text-[12.5px] font-medium">
            {attiva ? "Sostituisci la chiave" : "Chiave API di Google"}
          </span>
          <Input
            value={chiave}
            onChange={(e) => setChiave(e.target.value)}
            placeholder={attiva ? "•••••••••  (scrivi per sostituirla)" : "AIza…"}
            autoComplete="off"
            spellCheck={false}
          />
          <span className="mt-1 block text-[11.5px] leading-snug text-muted-foreground">
            Serve <strong>Places API (New)</strong> attiva sul progetto Google Cloud, con la
            fatturazione collegata. La chiave resta sul servitore e non passa mai dal browser:
            questa schermata non la rilegge più, sa solo se c&apos;è. Per toglierla, svuota il campo
            e salva.
          </span>
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={salvando} onClick={() => void salva()}>
            {salvando ? "Salvo…" : chiave.trim() ? "Salva la chiave" : "Togli la chiave"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void provaOra()}>
            Prova la ricerca
          </Button>
          {prova && <span className="text-[12px] text-muted-foreground">{prova}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

/** Sezione WhatsApp Cloud API: credenziali Meta + URL webhook generati dinamicamente. */
interface WhatsAppSettingsState {
  phone_number_id: string;
  business_account_id: string;
  access_token: string;
  webhook_verify_token: string;
  app_secret: string;
  mode: "live" | "sandbox";
}
const EMPTY_WA: WhatsAppSettingsState = {
  phone_number_id: "",
  business_account_id: "",
  access_token: "",
  webhook_verify_token: "",
  app_secret: "",
  mode: "live",
};

interface WhatsAppDiagnose {
  ok: boolean;
  requestedMode: "live" | "sandbox";
  detectedMode: "live" | "sandbox";
  modeMismatch: boolean;
  phone: {
    ok: boolean;
    display_phone_number: string | null;
    verified_name: string | null;
    quality_rating: string | null;
    error: { message?: string; code?: number } | null;
  };
  waba: {
    ok: boolean;
    id: string | null;
    name: string | null;
    namespace: string | null;
    error: { message?: string; code?: number } | null;
  };
  templates: {
    ok: boolean;
    approved_count: number;
    total: number;
    error: { message?: string; code?: number } | null;
  };
  token: {
    valid: boolean | null;
    scopes: string[];
    missing_scopes: string[];
    expires_at: number;
    never_expires: boolean;
    error: string | null;
  };
  error?: string;
  message?: string;
}

function looksLikeMetaTestPhoneNumberId(value: string): boolean {
  return value.trim() === "1105476355977493";
}

function WhatsAppSettingsSection() {
  const { user } = useAuth();
  const [wa, setWa] = useState<WhatsAppSettingsState>(EMPTY_WA);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [diag, setDiag] = useState<WhatsAppDiagnose | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);

  const webhookUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/public/whatsapp-webhook` : "";

  const runDiagnose = async () => {
    setDiagLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch("/api/whatsapp-diagnose", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as WhatsAppDiagnose;
      setDiag(json);
    } catch (e) {
      console.error("[wa-diagnose]", e);
    } finally {
      setDiagLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      const { data } = await (
        supabase as unknown as {
          from: (t: string) => {
            select: (s: string) => {
              eq: (
                k: string,
                v: string,
              ) => { maybeSingle: () => Promise<{ data: WhatsAppSettingsState | null }> };
            };
          };
        }
      )
        .from("whatsapp_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setWa({
          phone_number_id: data.phone_number_id ?? "",
          business_account_id: data.business_account_id ?? "",
          access_token: data.access_token ?? "",
          webhook_verify_token: data.webhook_verify_token ?? "",
          app_secret: data.app_secret ?? "",
          mode: ((data as unknown as { mode?: string }).mode as "live" | "sandbox") ?? "live",
        });
        // Diagnosi automatica se le credenziali ci sono
        if (data.phone_number_id && data.business_account_id && data.access_token) {
          void runDiagnose();
        }
      }
      setLoading(false);
    };
    void load();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await (
      supabase as unknown as {
        from: (t: string) => {
          upsert: (
            v: Record<string, unknown>,
            o: { onConflict: string },
          ) => Promise<{ error: { message: string } | null }>;
        };
      }
    )
      .from("whatsapp_settings")
      .upsert(
        {
          user_id: user.id,
          phone_number_id: wa.phone_number_id || null,
          business_account_id: wa.business_account_id || null,
          access_token: wa.access_token || null,
          webhook_verify_token: wa.webhook_verify_token || null,
          app_secret: wa.app_secret || null,
          mode: wa.mode,
        },
        { onConflict: "user_id" },
      );
    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Credenziali WhatsApp salvate");
      void runDiagnose();
    }
  };

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Copia fallita");
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Caricamento…</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageCircle className="h-5 w-5 text-emerald-600" />
          WhatsApp Cloud API (Meta)
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Collega la tua app Meta WhatsApp per inviare/ricevere messaggi reali dal CRM. In modalità
          test puoi messaggiare verso max 5 numeri verificati gratuitamente.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="config">
          <TabsList className="w-full grid grid-cols-4 h-9">
            <TabsTrigger value="config" className="text-xs">
              Configurazione
            </TabsTrigger>
            <TabsTrigger value="static" className="text-xs">
              Template statici
            </TabsTrigger>
            <TabsTrigger value="meta" className="text-xs">
              Template Meta
            </TabsTrigger>
            <TabsTrigger value="test" className="text-xs">
              Invio live
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-4 mt-4">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-[11.5px] leading-relaxed text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200 dark:border-emerald-900/40">
              <div className="font-semibold mb-1 flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5" /> Guida rapida (5 minuti)
              </div>
              <ol className="list-decimal pl-4 space-y-0.5">
                <li>
                  Vai su{" "}
                  <a
                    href="https://developers.facebook.com"
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-medium"
                  >
                    developers.facebook.com
                  </a>{" "}
                  → My Apps → Create App → tipo <strong>Business</strong>.
                </li>
                <li>
                  Nella dashboard dell'app aggiungi il prodotto <strong>WhatsApp</strong>. Meta crea
                  automaticamente un numero di test.
                </li>
                <li>
                  Genera un <strong>System User Access Token permanente</strong> in Business
                  Settings con permessi <code>whatsapp_business_messaging</code> e{" "}
                  <code>whatsapp_business_management</code>.
                </li>
                <li>
                  Aggiungi il tuo numero personale tra i destinatari di test (max 5) per provare
                  l'invio.
                </li>
                <li>
                  Compila i campi qui sotto, salva, poi configura il webhook (in fondo) su Meta.
                </li>
              </ol>
            </div>

            {/* Selettore modalità live/sandbox */}
            <div className="rounded-lg border border-border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold">Modalità invio</div>
                  <div className="text-[11px] text-muted-foreground">
                    Live = numero WhatsApp Business reale verso qualunque destinatario. Sandbox =
                    numero di test Meta verso massimo 5 numeri whitelisted.
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant={wa.mode === "live" ? "default" : "outline"}
                    onClick={() => setWa({ ...wa, mode: "live" })}
                    className="h-8"
                  >
                    Live
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={wa.mode === "sandbox" ? "default" : "outline"}
                    onClick={() => setWa({ ...wa, mode: "sandbox" })}
                    className="h-8"
                  >
                    Sandbox
                  </Button>
                </div>
              </div>
            </div>

            {/* Riepilogo diagnosi */}
            <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5" />
                  Diagnosi configurazione Meta
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={runDiagnose}
                  disabled={diagLoading}
                  className="h-7 gap-1 text-[11px]"
                >
                  <RefreshCw className={`h-3 w-3 ${diagLoading ? "animate-spin" : ""}`} />
                  Verifica ora
                </Button>
              </div>
              {!diag ? (
                <div className="text-[11px] text-muted-foreground italic">
                  {diagLoading
                    ? "Verifica in corso…"
                    : "Nessuna diagnosi eseguita. Salva le credenziali per attivarla."}
                </div>
              ) : diag.error ? (
                <div className="text-[11.5px] text-rose-700 dark:text-rose-300">
                  {diag.message ?? diag.error}
                </div>
              ) : (
                <div className="space-y-1.5 text-[11.5px]">
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono text-[10px] ${diag.detectedMode === "live" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"}`}
                    >
                      Rilevato: {diag.detectedMode.toUpperCase()}
                    </span>
                    <span className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-muted">
                      Impostato: {diag.requestedMode.toUpperCase()}
                    </span>
                    {diag.modeMismatch && (
                      <span className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300">
                        ⚠ Mismatch
                      </span>
                    )}
                  </div>
                  <div>
                    <strong>Numero:</strong>{" "}
                    {diag.phone.ok ? (
                      <span>
                        {diag.phone.display_phone_number ?? "—"} ({diag.phone.verified_name ?? "?"})
                        · qualità {diag.phone.quality_rating ?? "?"}
                      </span>
                    ) : (
                      <span className="text-rose-700 dark:text-rose-300">
                        ❌ {diag.phone.error?.message ?? "errore"}{" "}
                        {diag.phone.error?.code ? `(code ${diag.phone.error.code})` : ""}
                      </span>
                    )}
                  </div>
                  <div>
                    <strong>WABA:</strong>{" "}
                    {diag.waba.ok ? (
                      <span>
                        {diag.waba.name ?? "?"} (id {diag.waba.id ?? "?"})
                      </span>
                    ) : (
                      <span className="text-rose-700 dark:text-rose-300">
                        ❌ {diag.waba.error?.message ?? "errore"}{" "}
                        {diag.waba.error?.code ? `(code ${diag.waba.error.code})` : ""}
                      </span>
                    )}
                  </div>
                  <div>
                    <strong>Template:</strong>{" "}
                    {diag.templates.ok ? (
                      <span>
                        {diag.templates.approved_count} approvati / {diag.templates.total} totali
                      </span>
                    ) : (
                      <span className="text-rose-700 dark:text-rose-300">
                        ❌ {diag.templates.error?.message ?? "errore"}
                      </span>
                    )}
                  </div>
                  <div>
                    <strong>Token:</strong>{" "}
                    {diag.token.valid ? (
                      <span>
                        valido ·{" "}
                        {diag.token.never_expires
                          ? "non scade"
                          : `scade il ${new Date(diag.token.expires_at * 1000).toLocaleDateString()}`}
                        {diag.token.missing_scopes.length > 0 && (
                          <span className="text-rose-700 dark:text-rose-300">
                            {" "}
                            · ⚠ mancano permessi: {diag.token.missing_scopes.join(", ")}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-rose-700 dark:text-rose-300">
                        ❌ {diag.token.error ?? "non valido"}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {looksLikeMetaTestPhoneNumberId(wa.phone_number_id) && wa.mode === "live" && (
                <div className="md:col-span-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-[11.5px] leading-relaxed text-amber-900 dark:bg-amber-950/20 dark:text-amber-200 dark:border-amber-900/40">
                  Hai salvato il <strong>Phone Number ID del numero di test Meta</strong> ma la
                  modalità è LIVE. Sostituiscilo con il numero reale, oppure passa a Sandbox.
                </div>
              )}
              <div>
                <LabelWithHelp
                  label="Phone Number ID"
                  help="Inserisci l'ID interno del numero WhatsApp Business live. Se il numero configurato risulta 'Test Number', stai usando ancora il numero sandbox Meta."
                />
                <Input
                  value={wa.phone_number_id}
                  onChange={(e) => setWa({ ...wa, phone_number_id: e.target.value })}
                  placeholder="123456789012345"
                />
              </div>
              <div>
                <LabelWithHelp
                  label="WhatsApp Business Account ID (WABA)"
                  help="Inserisci il WABA ID reale del tuo account business WhatsApp. Se qui salvi un oggetto sbagliato, il caricamento template fallisce con 'Unsupported get request'."
                />
                <Input
                  value={wa.business_account_id}
                  onChange={(e) => setWa({ ...wa, business_account_id: e.target.value })}
                  placeholder="987654321098765"
                />
              </div>
              <div className="md:col-span-2">
                <LabelWithHelp
                  label="Access Token (permanente)"
                  help="Business Settings → System Users → crea un Admin → Generate New Token → seleziona la tua app WhatsApp → permessi: whatsapp_business_messaging + whatsapp_business_management → Never expire. Copialo subito (non sarà più visibile)."
                />
                <Input
                  type="password"
                  value={wa.access_token}
                  onChange={(e) => setWa({ ...wa, access_token: e.target.value })}
                  placeholder="EAAxxxxxxxxxxx…"
                />
              </div>
              <div>
                <LabelWithHelp
                  label="Webhook Verify Token"
                  help="Stringa segreta che scegli TU (es. 'hairgenius_wh_2026'). La incollerai poi su Meta nella configurazione del webhook: serve per l'handshake iniziale (Meta ti manda questo token e tu rispondi con lo stesso valore)."
                />
                <Input
                  value={wa.webhook_verify_token}
                  onChange={(e) => setWa({ ...wa, webhook_verify_token: e.target.value })}
                  placeholder="hairgenius_wh_2026"
                />
              </div>
              <div>
                <LabelWithHelp
                  label="App Secret"
                  help="App Meta → Settings → Basic → 'App Secret' (clicca Show). Serve per validare la firma X-Hub-Signature-256 dei webhook in arrivo (sicurezza: garantisce che le notifiche vengano davvero da Meta)."
                />
                <Input
                  type="password"
                  value={wa.app_secret}
                  onChange={(e) => setWa({ ...wa, app_secret: e.target.value })}
                  placeholder="32 caratteri esadecimali"
                />
              </div>
            </div>

            <Button onClick={save} disabled={saving} className="w-full">
              {saving ? "Salvataggio…" : "Salva credenziali WhatsApp"}
            </Button>

            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-2 dark:bg-blue-950/20 dark:border-blue-900/40">
              <div className="font-semibold text-sm flex items-center gap-1.5 text-blue-900 dark:text-blue-200">
                <HelpCircle className="h-4 w-4" /> Configurazione Webhook su Meta
              </div>
              <p className="text-[11.5px] text-blue-900/80 dark:text-blue-200/80">
                Vai su App Meta → WhatsApp → Configuration → Webhooks → <strong>Edit</strong>.
                Incolla questi due valori:
              </p>

              <div>
                <Label className="text-[11px] uppercase tracking-wider">Callback URL</Label>
                <div className="flex gap-1.5 mt-0.5">
                  <Input value={webhookUrl} readOnly className="font-mono text-[11px]" />
                  <Button size="sm" variant="outline" onClick={() => copy(webhookUrl, "url")}>
                    {copied === "url" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-[11px] uppercase tracking-wider">Verify Token</Label>
                <div className="flex gap-1.5 mt-0.5">
                  <Input
                    value={wa.webhook_verify_token || "(salva prima il verify token sopra)"}
                    readOnly
                    className="font-mono text-[11px]"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copy(wa.webhook_verify_token, "vt")}
                    disabled={!wa.webhook_verify_token}
                  >
                    {copied === "vt" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              <p className="text-[11px] text-blue-900/80 dark:text-blue-200/80 pt-1">
                Dopo aver salvato, clicca <strong>Verify and Save</strong>, poi nella sezione{" "}
                <strong>Webhook fields</strong> sottoscrivi: <code>messages</code> e{" "}
                <code>message_status</code>.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="static" className="mt-4">
            <StaticTemplatesTab />
          </TabsContent>

          <TabsContent value="meta" className="mt-4">
            <MetaTemplatesTab />
          </TabsContent>

          <TabsContent value="test" className="mt-4">
            <WhatsAppTestSendTab phoneNumberId={wa.phone_number_id} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/** Pulsante "Copia" inline con feedback visivo (icona check per 1.2s). */
function CopyChip({
  value,
  label,
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    } catch {
      toast.error("Impossibile copiare");
    }
  };
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={onClick}
      className={cn("h-6 px-2 text-[10.5px] gap-1", className)}
    >
      {done ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
      {label ?? (done ? "Copiato" : "Copia")}
    </Button>
  );
}

/** Lista dei template Meta-ready: ogni card mostra Name, Category, Language, Body e Sample
 *  values con un pulsante "Copia" su ciascun campo. Pensata per incollare velocemente
 *  nel form di creazione template su Meta Business Manager. */
function MetaReadyTemplatesList() {
  // Lazy import per non includerlo nel bundle iniziale.
  const [tpls, setTpls] = useState<
    Array<{
      name: string;
      language: string;
      category: string;
      body: string;
      params: Array<{ index: number; key: string; description: string; example: string }>;
    }>
  >([]);
  useEffect(() => {
    void (async () => {
      const { META_TEMPLATES } = await import("@/crm/wa-meta-templates");
      setTpls(META_TEMPLATES);
    })();
  }, []);
  if (tpls.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic px-1">Caricamento template Meta…</div>
    );
  }
  return (
    <details className="rounded-lg border border-border bg-card/50">
      <summary className="cursor-pointer list-none px-3 py-2 flex items-center gap-2 text-[13px] font-semibold">
        <Layout className="h-3.5 w-3.5 text-emerald-600" />
        Template pronti per Meta · copia rapida ({tpls.length})
        <span className="ml-auto text-[10px] text-muted-foreground font-normal">apri / chiudi</span>
      </summary>
      <div className="border-t border-border p-2 space-y-2">
        {tpls.map((t, idx) => (
          <div
            key={t.name}
            className="rounded border border-border bg-background/60 p-2.5 space-y-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-[10px] font-mono">
                #{String(idx + 1).padStart(2, "0")}
              </Badge>
              <code className="text-[12px] font-semibold">{t.name}</code>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px]",
                  t.category === "UTILITY"
                    ? "bg-blue-500/10 text-blue-700 border-blue-500/30"
                    : "bg-purple-500/10 text-purple-700 border-purple-500/30",
                )}
              >
                {t.category}
              </Badge>
              <Badge variant="outline" className="text-[10px] uppercase">
                {t.language}
              </Badge>
              <div className="ml-auto flex gap-1.5">
                <CopyChip value={t.name} label="Name" />
                <CopyChip value={t.category} label="Category" />
                <CopyChip value={t.language} label="Lang" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10.5px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Body
                </span>
                <CopyChip value={t.body} label="Copia body" />
              </div>
              <pre className="text-[11.5px] whitespace-pre-wrap bg-muted/50 rounded px-2 py-1.5 border border-border/60 font-sans leading-snug">
                {t.body}
              </pre>
            </div>

            {t.params.length > 0 && (
              <div>
                <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground font-semibold mb-1">
                  Sample values (per la review Meta)
                </div>
                <div className="space-y-1">
                  {t.params.map((p) => (
                    <div
                      key={p.index}
                      className="flex items-center gap-2 text-[11.5px] bg-muted/30 rounded px-2 py-1 border border-border/40"
                    >
                      <code className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400 shrink-0">
                        {`{{${p.index}}}`}
                      </code>
                      <span className="text-muted-foreground shrink-0">→</span>
                      <span className="truncate flex-1 min-w-0" title={p.example}>
                        {p.example}
                      </span>
                      <span className="text-[10px] text-muted-foreground hidden sm:inline truncate max-w-[40%]">
                        {p.description}
                      </span>
                      <CopyChip value={p.example} label="Copia" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

/** Mostra tutti i template statici (uno per ogni LeadStatus) usati da `getWhatsAppMessageForStatus`.
 *  Sono i messaggi che il CRM suggerisce automaticamente nel composer al cambio stato.
 *  L'utente può disattivare singoli template: quelli disattivati non saranno proposti
 *  automaticamente né inviati dal pannello WhatsApp. */
function StaticTemplatesTab() {
  const { user } = useAuth();
  const [items, setItems] = useState<Array<{ status: string; label: string; preview: string }>>([]);
  const [disabled, setDisabled] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingStatus, setSavingStatus] = useState<string | null>(null);

  // Carica preview + disabled list
  useEffect(() => {
    void (async () => {
      const [{ getWhatsAppMessageForStatus }, { LEAD_STATUS_LABEL, ALL_LEAD_STATUSES }] =
        await Promise.all([import("@/crm/whatsapp"), import("@/crm/types")]);
      const fakeLead = (status: string) =>
        ({
          id: "preview",
          data: {
            nome: "Mario",
            cognome: "Rossi",
            telefono: "+39 333 1234567",
            stato: status,
            dataMeeting: "2026-05-12",
            oraMeeting: "15:30",
            dataVieneInSede: "2026-05-15",
            oraVieneInSede: "10:00",
            dataRicontatto: "2026-05-20",
            oraRicontatto: "11:00",
          },
        }) as unknown as Parameters<typeof getWhatsAppMessageForStatus>[0];
      setItems(
        ALL_LEAD_STATUSES.map((s) => ({
          status: s,
          label: LEAD_STATUS_LABEL[s],
          preview: getWhatsAppMessageForStatus(fakeLead(s), "Luca"),
        })),
      );
      if (user) {
        const { data } = await (
          supabase as unknown as {
            from: (t: string) => {
              select: (s: string) => {
                eq: (
                  k: string,
                  v: string,
                ) => {
                  maybeSingle: () => Promise<{
                    data: { disabled_template_statuses?: string[] } | null;
                  }>;
                };
              };
            };
          }
        )
          .from("whatsapp_settings")
          .select("disabled_template_statuses")
          .eq("user_id", user.id)
          .maybeSingle();
        setDisabled(data?.disabled_template_statuses ?? []);
      }
      setLoading(false);
    })();
  }, [user]);

  const toggleStatus = async (status: string, enabled: boolean) => {
    if (!user) return;
    const next = enabled
      ? disabled.filter((s) => s !== status)
      : [...new Set([...disabled, status])];
    setSavingStatus(status);
    setDisabled(next);
    try {
      const { error } = await (
        supabase as unknown as {
          from: (t: string) => {
            upsert: (
              v: Record<string, unknown>,
              o?: { onConflict?: string },
            ) => Promise<{ error: { message: string } | null }>;
          };
        }
      )
        .from("whatsapp_settings")
        .upsert(
          {
            user_id: user.id,
            disabled_template_statuses: next,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      if (error) throw new Error(error.message);
      toast.success(enabled ? "Template attivato" : "Template disattivato");
    } catch (e) {
      // rollback
      setDisabled(disabled);
      toast.error(e instanceof Error ? e.message : "Errore salvataggio");
    } finally {
      setSavingStatus(null);
    }
  };

  const downloadMetaTxt = async () => {
    const { buildMetaTemplatesTxt, META_TEMPLATES } = await import("@/crm/wa-meta-templates");
    const txt = buildMetaTemplatesTxt();
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `whatsapp-templates-meta-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Scaricati ${META_TEMPLATES.length} template pronti per Meta`);
  };

  const copyMetaTxt = async () => {
    const { buildMetaTemplatesTxt } = await import("@/crm/wa-meta-templates");
    await navigator.clipboard.writeText(buildMetaTemplatesTxt());
    toast.success("Template copiati negli appunti");
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 dark:bg-emerald-950/20 dark:border-emerald-900/40">
        <div className="text-[12.5px] text-emerald-900 dark:text-emerald-200 mb-2">
          <strong>Template pronti per Meta Business Manager.</strong> Ogni template qui sotto ha i
          campi <em>Name</em>, <em>Category</em>, <em>Language</em>, <em>Body</em> e i
          <em> Sample values</em> già pronti — clicca il pulsante{" "}
          <Copy className="inline h-3 w-3" /> di ogni campo per copiarlo e incollarlo direttamente
          nel form di Meta. I placeholder usano
          <code className="mx-1">{`{{snake_case}}`}</code> (variabili nominate) e il CRM li riempirà
          automaticamente con i dati del lead.
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={downloadMetaTxt}>
            <Copy className="h-3.5 w-3.5 mr-1.5" /> Scarica tutto in TXT
          </Button>
          <Button size="sm" variant="outline" onClick={copyMetaTxt}>
            Copia tutto negli appunti
          </Button>
        </div>
      </div>

      <MetaReadyTemplatesList />

      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5 text-[11.5px] text-amber-900 dark:bg-amber-950/20 dark:border-amber-900/40 dark:text-amber-200">
        Anteprima dei messaggi <strong>pre-compilati</strong> che il CRM suggerisce nel composer ad
        ogni cambio stato del lead. Usa l'interruttore a destra per <strong>disattivare</strong> un
        template: quando è OFF il CRM non lo proporrà più e non sarà inviabile dal pannello
        WhatsApp.
      </div>

      {loading ? (
        <div className="text-xs text-muted-foreground italic px-1">Caricamento template…</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => {
            const isOn = !disabled.includes(it.status);
            return (
              <div key={it.status} className="rounded border border-border bg-card/50">
                <div className="px-3 py-2 flex items-center justify-between gap-2">
                  <details className="flex-1 min-w-0">
                    <summary className="cursor-pointer list-none flex items-center gap-2">
                      <span
                        className={cn(
                          "text-sm font-medium truncate",
                          !isOn && "text-muted-foreground line-through",
                        )}
                      >
                        {it.label}
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                        {it.status}
                      </Badge>
                    </summary>
                    <div className="pt-2 mt-2 text-[12.5px] whitespace-pre-wrap text-muted-foreground border-t border-border/60">
                      {it.preview}
                    </div>
                  </details>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={cn(
                        "text-[10.5px] font-medium uppercase tracking-wide",
                        isOn ? "text-emerald-600" : "text-muted-foreground",
                      )}
                    >
                      {isOn ? "ON" : "OFF"}
                    </span>
                    <Switch
                      checked={isOn}
                      disabled={savingStatus === it.status}
                      onCheckedChange={(v) => void toggleStatus(it.status, v)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Carica i template approvati su Meta WABA (chiamando /api/whatsapp-templates).
 *  Mostra nome, lingua, status (APPROVED/PENDING/REJECTED), categoria e anteprima del body. */
function MetaTemplatesTab() {
  interface TplComponent {
    type: string;
    text?: string;
    format?: string;
  }
  interface Tpl {
    name: string;
    language: string;
    status: string;
    category: string;
    components?: TplComponent[];
  }
  const [templates, setTemplates] = useState<Tpl[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessione scaduta");
      const res = await fetch("/api/whatsapp-templates", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as {
        ok?: boolean;
        templates?: Tpl[];
        error?: string;
        message?: string;
        hint?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.message || json.hint || json.error || `HTTP ${res.status}`);
      }
      setTemplates(json.templates ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (s: string) => {
    if (s === "APPROVED")
      return (
        <Badge
          className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px]"
          variant="outline"
        >
          Approvato
        </Badge>
      );
    if (s === "PENDING")
      return (
        <Badge
          className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px]"
          variant="outline"
        >
          In revisione
        </Badge>
      );
    if (s === "REJECTED")
      return (
        <Badge
          className="bg-rose-500/15 text-rose-700 border-rose-500/30 text-[10px]"
          variant="outline"
        >
          Rifiutato
        </Badge>
      );
    return (
      <Badge variant="outline" className="text-[10px]">
        {s}
      </Badge>
    );
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-2.5 text-[11.5px] text-blue-900 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-200">
        I template dinamici sono i <strong>Message Templates</strong> approvati da Meta sul tuo
        WhatsApp Business Account. Servono per scrivere ai clienti{" "}
        <strong>fuori dalla finestra di 24h</strong>. Crea/modifica i template su{" "}
        <a
          href="https://business.facebook.com/wa/manage/message-templates/"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          Meta Business Manager
        </a>
        .
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={fetchTemplates}
        disabled={loading}
        className="gap-1.5"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Caricamento…" : templates ? "Ricarica template" : "Carica template da Meta"}
      </Button>
      {error && (
        <div className="rounded border border-rose-300 bg-rose-50 p-2 text-[12px] text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-300">
          {error}
        </div>
      )}
      {templates && templates.length === 0 && (
        <div className="text-sm text-muted-foreground italic">
          Nessun template trovato sul WABA.
        </div>
      )}
      {templates && templates.length > 0 && (
        <div className="space-y-1.5">
          {templates.map((t, i) => {
            const body = t.components?.find((c) => c.type === "BODY")?.text ?? "";
            return (
              <details
                key={`${t.name}-${t.language}-${i}`}
                className="rounded border border-border bg-card/50"
              >
                <summary className="cursor-pointer list-none px-3 py-2 flex items-center justify-between gap-2 hover:bg-muted/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium truncate">{t.name}</span>
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {t.language}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-[10px]">
                      {t.category}
                    </Badge>
                    {statusBadge(t.status)}
                  </div>
                </summary>
                <div className="px-3 pb-3 pt-1 text-[12.5px] whitespace-pre-wrap text-muted-foreground border-t border-border/60">
                  {body || <span className="italic">(nessun body)</span>}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface UserRowProps {
  row: {
    user_id: string;
    is_admin: boolean;
    scheme_access: SchemeKey[];
    display_name: string | null;
    can_accept_leads?: boolean;
  };
  isMe: boolean;
  onUpdate: (patch: {
    is_admin?: boolean;
    scheme_access?: SchemeKey[];
    can_accept_leads?: boolean;
  }) => Promise<void>;
}

function UserRow({ row, isMe, onUpdate }: UserRowProps) {
  const [open, setOpen] = useState(false);
  const [schemes, setSchemes] = useState<SchemeKey[]>(row.scheme_access ?? []);
  const [admin, setAdmin] = useState<boolean>(row.is_admin);
  const [canAccept, setCanAccept] = useState<boolean>(row.can_accept_leads ?? true);
  const [saving, setSaving] = useState(false);

  const toggle = (k: SchemeKey) => {
    setSchemes((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  };

  const save = async () => {
    setSaving(true);
    try {
      await onUpdate({
        is_admin: admin,
        scheme_access: schemes,
        can_accept_leads: canAccept,
      });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border rounded-lg p-3 bg-muted/20">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-9 w-9 rounded-full bg-primary/15 text-primary grid place-items-center">
            <UserIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="font-medium truncate flex items-center gap-1.5">
              {row.display_name || row.user_id.slice(0, 8)}
              {isMe && (
                <Badge variant="outline" className="text-[10px] py-0 h-4">
                  TU
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {row.is_admin ? "Amministratore" : `${row.scheme_access?.length || 0} schede`}
              {!row.is_admin && row.can_accept_leads === false && " · accettazione lead OFF"}
            </div>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? "Chiudi" : "Modifica"}
        </Button>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t pt-3">
          <div className="flex items-center justify-between p-2 rounded-md border bg-background">
            <div>
              <div className="text-sm font-medium">Amministratore</div>
              <div className="text-xs text-muted-foreground">
                Accesso completo a tutte le schede e gestione utenti.
              </div>
            </div>
            <Switch checked={admin} onCheckedChange={setAdmin} disabled={isMe} />
          </div>

          <div className="flex items-center justify-between p-2 rounded-md border bg-background">
            <div>
              <div className="text-sm font-medium">Può accettare lead</div>
              <div className="text-xs text-muted-foreground">
                Se attivo, riceve la notifica "Accetta/Rifiuta" sui nuovi lead. Se disattivo, vedrà
                solo notifiche passive: l'admin assegna manualmente.
              </div>
            </div>
            <Switch checked={admin || canAccept} onCheckedChange={setCanAccept} disabled={admin} />
          </div>

          {!admin && (
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Schede accessibili
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_SCHEMES.map((k) => (
                  <label
                    key={k}
                    className="flex items-center gap-2 p-2 rounded-md border bg-background hover:border-primary/40 cursor-pointer text-sm"
                  >
                    <Checkbox checked={schemes.includes(k)} onCheckedChange={() => toggle(k)} />
                    <span className="truncate">{SCHEME_LABEL[k]}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <Button onClick={save} disabled={saving} size="sm" className="w-full">
            {saving ? "Salvataggio…" : "Salva modifiche"}
          </Button>
        </div>
      )}
    </div>
  );
}

/** Sezione Soglie classifica creative (gating v3).
 *  Persistita in localStorage — vedi `src/crm/ads-manager/gating-config.ts`. */
function GatingThresholdsSection() {
  const [cfg, setCfg] = useState<GatingConfig>(DEFAULT_GATING);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCfg(loadGatingConfig());
  }, []);

  const update = (patch: Partial<GatingConfig>) => setCfg((p) => ({ ...p, ...patch }));

  const save = () => {
    setSaving(true);
    saveGatingConfig(cfg);
    setTimeout(() => {
      setSaving(false);
      toast.success("Soglie classifica salvate · ricarica Ads Manager per applicarle");
    }, 200);
  };

  const reset = () => {
    setCfg(DEFAULT_GATING);
    saveGatingConfig(DEFAULT_GATING);
    toast.success("Soglie ripristinate ai default");
  };

  return (
    <div className="border-t pt-4 space-y-3">
      <div>
        <Label className="flex items-center gap-1.5">
          <Target className="h-4 w-4 text-emerald-600" />
          Soglie classifica creative (Ads Manager)
        </Label>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Regole di gating v3: impressions = soglia di ingresso, spesa/bounce/hook = kill su
          risultati reali.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[11px]">Impressions min (ingresso)</Label>
          <Input
            type="number"
            min={0}
            step={100}
            value={cfg.minImpressions}
            onChange={(e) => update({ minImpressions: Number(e.target.value) })}
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Default 1300 — sotto = "Dati insufficienti"
          </p>
        </div>
        <div>
          <Label className="text-[11px]">Spesa kill 0-lead (€)</Label>
          <Input
            type="number"
            min={0}
            step={10}
            value={cfg.zeroLeadKillSpend}
            onChange={(e) => update({ zeroLeadKillSpend: Number(e.target.value) })}
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Default €50 — 0 lead oltre = Scarso forzato
          </p>
        </div>
        <div>
          <Label className="text-[11px]">Bounce kill (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={cfg.highBounceKill}
            onChange={(e) => update({ highBounceKill: Number(e.target.value) })}
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Default 80% — + 0 lead = Scarso forzato
          </p>
        </div>
        <div>
          <Label className="text-[11px]">Hook rate kill video (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={cfg.lowHookKill}
            onChange={(e) => update({ lowHookKill: Number(e.target.value) })}
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Default 15% — + 0 lead = Sotto forzato
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Button onClick={save} disabled={saving} size="sm" className="flex-1">
          {saving ? "Salvataggio…" : "Salva soglie"}
        </Button>
        <Button onClick={reset} variant="outline" size="sm">
          Reset default
        </Button>
      </div>
    </div>
  );
}

// ── COPIA COMPLETA DEI DATI ─────────────────────────────────────────────────
//  Un pulsante per scaricare, uno per caricare, e sotto — in piccolo — cosa c'è
//  dentro il file. Niente pannello tecnico: chi apre questa scheda vuole una
//  copia dei propri dati, non una console.
//
//  L'ELENCO DI COSA C'È DENTRO NON STA QUI. Lo dice il server insieme al file
//  (`riepilogo` e `fuori` in /api/crm/backup): un secondo elenco scritto a mano
//  in questa pagina si sarebbe scollato al primo campo aggiunto, e la schermata
//  avrebbe promesso cose che il file non contiene.
//
//  PRIMA SI GUARDA, POI SI SCRIVE. Il file scelto non viene importato: viene
//  mandato in "prova", che non scrive nulla e risponde con quante righe
//  entrerebbero, quante esistono già e quante ce ne sono adesso. Solo dopo
//  compaiono i pulsanti che scrivono.

interface VoceRiepilogo {
  campo: string;
  etichetta: string;
  righe: number;
  nota?: string;
  problema?: string;
}
interface VoceFuori {
  cosa: string;
  perche: string;
}
interface VoceAnteprima {
  campo: string;
  etichetta: string;
  /** righe presenti nel file */
  nelFile: number;
  /** di quelle, quante esistono già qui: verranno aggiornate */
  gia: number;
  /** quante non esistono: verranno aggiunte */
  nuove: number;
  /** quante ce ne sono adesso nel database: è ciò che "sostituisci" perde */
  attuali: number;
  svuotabile: boolean;
  problema?: string;
}

/** La copia dei dati è roba da amministratore e il server lo verifica ad ogni
 *  chiamata: il token della sessione viaggia nell'intestazione, mai nell'URL. */
async function tokenSessione(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** ── PORTARE VIA TUTTO, NON SOLO I DATI ───────────────────────────────────
 *
 *  Richiesta del committente: «fai che posso scaricare tutto il sito, i lead,
 *  il funzionamento, il software Meetly, tutto il database e il sito web, per
 *  clonarlo e installarlo su un altro database/hosting: il 100% di tutto,
 *  proprio la sorgente di tutto».
 *
 *  Qui sopra c'erano i DATI, e basta. Con i soli dati non si rimette in piedi
 *  niente: senza il programma sono tabelle, e senza le istruzioni sono tabelle
 *  che nessuno sa dove mettere. I pezzi sono quattro e stanno tutti in questo
 *  riquadro, nell'ordine in cui si montano.
 *
 *  ⚠️ IL PROGRAMMA NON SI PUÒ FABBRICARE AL MOMENTO. Quello che gira online è
 *   la COSTRUZIONE — codice rimpicciolito, senza commenti — e da lì non si
 *   torna indietro. La sorgente leggibile viene depositata in un contenitore
 *   privato a ogni pubblicazione (strumenti/sorgente.mjs) e questo pulsante la
 *   consegna. Se non è ancora stata depositata, lo dice invece di fingere.
 *  ⚠️ I FILE NON PASSANO DI QUI: le registrazioni da sole sono gigabyte. Si
 *   scarica l'ELENCO, con un collegamento per ciascuno e le due righe di
 *   comando per prenderli tutti (sono nel foglio delle istruzioni).
 *  ⚠️ LE CREDENZIALI NON ESCONO, mai, da nessuno di questi file. È scritto
 *   anche nel foglio, perché chi rimonta tutto altrove deve sapere PRIMA che
 *   i PIN dei consulenti dovrà rifarli. */
function PortaViaTuttoSection() {
  const [sorg, setSorg] = useState<{
    ok?: boolean; url?: string; nome?: string; byte?: number; commit?: string; quando?: string; reason?: string;
  } | null>(null);
  const [chiedo, setChiedo] = useState<"programma" | "file" | null>(null);

  //  Si guarda SUBITO se la sorgente c'è: un pulsante che scopre solo dopo
  //  averlo premuto che non c'è niente da scaricare è un pulsante che mente.
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/crm/sorgente", { headers: await intestazioniCRM() });
        setSorg((await r.json()) as typeof sorg);
      } catch { setSorg(null); }
    })();
  }, []);

  const scaricaProgramma = async () => {
    setChiedo("programma");
    try {
      //  Il collegamento scade in un'ora: se ne chiede uno NUOVO al momento di
      //  premere, invece di usare quello letto all'apertura della pagina — che
      //  per una pagina lasciata aperta tutto il giorno sarebbe già scaduto.
      const r = await fetch("/api/crm/sorgente", { headers: await intestazioniCRM() });
      const j = (await r.json()) as { ok?: boolean; url?: string; reason?: string };
      if (!j?.ok || !j.url) throw new Error(j?.reason || "sorgente non disponibile");
      window.location.href = j.url;
      toast.success("Sto scaricando il programma");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scaricamento fallito");
    } finally { setChiedo(null); }
  };

  const scaricaElencoFile = async () => {
    setChiedo("file");
    try {
      const r = await fetch("/api/crm/sorgente?file=1", { headers: await intestazioniCRM() });
      const j = (await r.json()) as { ok?: boolean; quanti?: number; reason?: string };
      if (!j?.ok) throw new Error(j?.reason || "elenco non disponibile");
      const url = URL.createObjectURL(new Blob([JSON.stringify(j, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `file-caricati-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Elenco scaricato: ${j.quanti ?? 0} file`, {
        description: "I collegamenti dentro il file scadono fra un'ora: scaricali adesso.",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Elenco non riuscito");
    } finally { setChiedo(null); }
  };

  const scaricaIstruzioni = () => {
    const url = URL.createObjectURL(new Blob([ISTRUZIONI_CLONARE], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "COME-INSTALLARLO-ALTROVE.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const mb = (b?: number) => (b ? `${(b / 1024 / 1024).toFixed(1)} MB` : "");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Download className="h-5 w-5" />
          Porta via tutto
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          I quattro pezzi che servono a rimettere in piedi questo sistema da un'altra parte — altro
          database, altro hosting, altro dominio — senza dipendere da nessuno.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            size="lg"
            className="h-auto py-3 justify-start gap-3"
            onClick={() => void scaricaProgramma()}
            disabled={chiedo === "programma" || sorg?.ok === false}
          >
            {chiedo === "programma" ? <Loader2 className="h-5 w-5 animate-spin shrink-0" /> : <FileJson className="h-5 w-5 shrink-0" />}
            <span className="text-left">
              <span className="block text-sm font-semibold">1 · Il programma</span>
              <span className="block text-[11px] font-normal opacity-80">
                {sorg?.ok
                  ? `la sorgente completa · ${mb(sorg.byte)}${sorg.quando ? ` · del ${new Date(sorg.quando).toLocaleDateString("it-IT")}` : ""}`
                  : "sorgente di CRM, Meetly e sito"}
              </span>
            </span>
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="h-auto py-3 justify-start gap-3"
            onClick={() => void scaricaElencoFile()}
            disabled={chiedo === "file"}
          >
            {chiedo === "file" ? <Loader2 className="h-5 w-5 animate-spin shrink-0" /> : <Database className="h-5 w-5 shrink-0" />}
            <span className="text-left">
              <span className="block text-sm font-semibold">3 · I file caricati</span>
              <span className="block text-[11px] font-normal text-muted-foreground">
                registrazioni, foto, documenti: l'elenco con i collegamenti
              </span>
            </span>
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="h-auto py-3 justify-start gap-3 sm:col-span-2"
            onClick={scaricaIstruzioni}
          >
            <ArrowRight className="h-5 w-5 shrink-0" />
            <span className="text-left">
              <span className="block text-sm font-semibold">4 · Le istruzioni per installarlo altrove</span>
              <span className="block text-[11px] font-normal text-muted-foreground">
                database nuovo, chiavi, pubblicazione, videochiamata: passo per passo
              </span>
            </span>
          </Button>
        </div>

        {/*  Il punto 2 sono i dati, che stanno nel riquadro qui sopra: ripetere
             lo stesso pulsante due volte vorrebbe dire due pulsanti che un
             giorno fanno cose diverse. */}
        <p className="rounded-lg border bg-muted/30 px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
          <b className="text-foreground">2 · I dati</b> sono la «Copia dei dati» qui sopra: lead,
          preventivi, fatture, listino, impostazioni. Scaricali con «Scarica una copia».
        </p>

        {sorg?.ok === false && (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[12px] leading-snug text-muted-foreground">
            <b className="text-foreground">Il programma non è ancora depositato.</b> {sorg.reason}
          </p>
        )}
        {sorg?.ok && sorg.commit && (
          <p className="px-1 text-[11px] text-muted-foreground">
            Versione depositata: <span className="font-mono">{sorg.commit}</span> · il collegamento
            per scaricarla vale un'ora.
          </p>
        )}
        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
          In nessuno di questi file ci sono PIN, token, chiavi o password: restano in questo
          database. Sul sistema nuovo si rifanno — è scritto anche nelle istruzioni.
        </p>
      </CardContent>
    </Card>
  );
}

function CopiaDatiSection() {
  const { isAdmin } = useUserSettings();
  const [scaricando, setScaricando] = useState(false);
  const [riepilogo, setRiepilogo] = useState<VoceRiepilogo[] | null>(null);
  const [fuori, setFuori] = useState<VoceFuori[]>([]);
  const [nomeFile, setNomeFile] = useState<string | null>(null);
  const [contenuto, setContenuto] = useState<Record<string, unknown> | null>(null);
  const [anteprima, setAnteprima] = useState<VoceAnteprima[] | null>(null);
  const [leggendo, setLeggendo] = useState(false);
  const [scrivendo, setScrivendo] = useState<"aggiungi" | "sostituisci" | null>(null);
  const [conferma, setConferma] = useState("");
  const [esito, setEsito] = useState<{ ok: boolean; testo: string } | null>(null);
  const inputFile = useRef<HTMLInputElement | null>(null);
  /*  ── LA COPIA CHE SI FA DA SOLA ────────────────────────────────────────
      Il CRM ne deposita una alla prima apertura della giornata
      (api.crm.copia-automatica). Qui si dice QUANDO è stata l'ultima e quante
      ce ne sono: una rete di sicurezza di cui non si sa niente è una rete di
      cui non ci si fida — e il giorno che serve, si scopre che non c'era. */
  const [automatica, setAutomatica] = useState<{ ultima: string; quante: number } | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/crm/copia-automatica", { headers: await intestazioniCRM() });
        if (r.ok) setAutomatica((await r.json()) as { ultima: string; quante: number });
      } catch { /* non è un guasto: la riga semplicemente non compare */ }
    })();
  }, []);

  const scarica = async () => {
    setScaricando(true);
    try {
      const token = await tokenSessione();
      if (!token) throw new Error("sessione scaduta: rientra nel CRM");
      //  Si dichiara ANCHE chi è entrato col PIN (x-crm-token): l'archivio lo
      //  esporta solo chi ha il permesso «archivio», e senza questa intestazione
      //  un consulente verrebbe letto come il titolare dei dati.
      const r = await fetch("/api/crm/backup", { headers: await intestazioniCRM() });
      const j = (await r.json()) as {
        reason?: string;
        riepilogo?: VoceRiepilogo[];
        fuori?: VoceFuori[];
      };
      if (!r.ok) throw new Error(j.reason || `errore ${r.status}`);
      setRiepilogo(j.riepilogo ?? []);
      setFuori(j.fuori ?? []);
      //  Il file scaricato è ESATTAMENTE la risposta del server: se un giorno
      //  qualcuno lo apre a mano deve trovarci dentro anche il riepilogo.
      const testo = JSON.stringify(j, null, 2);
      const url = URL.createObjectURL(new Blob([testo], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `copia-crm-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Copia scaricata");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scaricamento fallito");
    } finally {
      setScaricando(false);
    }
  };

  const leggiFile = async (file: File) => {
    setLeggendo(true);
    setEsito(null);
    setAnteprima(null);
    setConferma("");
    setNomeFile(file.name);
    try {
      const testo = await file.text();
      const dati = JSON.parse(testo) as Record<string, unknown>;
      setContenuto(dati);
      const token = await tokenSessione();
      if (!token) throw new Error("sessione scaduta: rientra nel CRM");
      //  "prova" non scrive niente: serve solo a poter dire cosa succederebbe.
      const r = await fetch("/api/crm/backup", {
        method: "POST",
        headers: await intestazioniCRM({ "Content-Type": "application/json" }),
        body: JSON.stringify({ dati, modo: "prova" }),
      });
      const j = (await r.json()) as { reason?: string; anteprima?: VoceAnteprima[] };
      if (!r.ok) throw new Error(j.reason || `errore ${r.status}`);
      setAnteprima(j.anteprima ?? []);
    } catch (e) {
      setContenuto(null);
      setNomeFile(null);
      toast.error(e instanceof Error ? e.message : "File non leggibile");
    } finally {
      setLeggendo(false);
    }
  };

  const importa = async (modo: "aggiungi" | "sostituisci") => {
    if (!contenuto) return;
    setScrivendo(modo);
    setEsito(null);
    try {
      const token = await tokenSessione();
      if (!token) throw new Error("sessione scaduta: rientra nel CRM");
      const r = await fetch("/api/crm/backup", {
        method: "POST",
        headers: await intestazioniCRM({ "Content-Type": "application/json" }),
        body: JSON.stringify({ dati: contenuto, modo }),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        reason?: string;
        esito?: Record<string, number>;
        errori?: { campo: string; motivo: string }[];
      };
      if (!r.ok) throw new Error(j.reason || `errore ${r.status}`);
      const scritte = Object.values(j.esito ?? {}).reduce((a, b) => a + b, 0);
      const errori = j.errori ?? [];
      setEsito({
        ok: errori.length === 0,
        testo: errori.length
          ? `${scritte} righe scritte, ma qualcosa non è entrato: ${errori
              .map((x) => `${x.campo} (${x.motivo})`)
              .join("; ")}`
          : `${scritte} righe scritte. Ricarica la pagina per vederle.`,
      });
      if (errori.length) toast.warning("Importazione parziale: leggi il dettaglio");
      else toast.success("Importazione completata");
      setConferma("");
    } catch (e) {
      setEsito({ ok: false, testo: e instanceof Error ? e.message : "Importazione fallita" });
      toast.error("Importazione fallita");
    } finally {
      setScrivendo(null);
    }
  };

  //  Gli hook stanno tutti sopra: da qui in giù si può uscire.
  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5" />
            Copia dei dati
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] text-muted-foreground">
            Scaricare o rimettere dentro l'intero archivio è un'operazione da amministratore. Chiedi
            a chi amministra il CRM di abilitarti dalla scheda <strong>Utenti</strong>.
          </p>
        </CardContent>
      </Card>
    );
  }

  const perse = (anteprima ?? []).filter((v) => v.svuotabile && v.attuali > 0);
  const elencoPerse = perse.map((v) => `${v.attuali} ${v.etichetta.toLowerCase()}`).join(", ");
  const puoSostituire = conferma.trim().toUpperCase() === "SOSTITUISCI";

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Database className="h-5 w-5" />
            Copia dei dati
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Una copia di tutto quello che è stato scritto qui dentro — CRM e Meetly — in un file
            solo. Serve a portarsi via i propri dati, e a rimetterli dentro.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {automatica && (
            <p className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 px-3 py-2 text-[12px] leading-snug text-muted-foreground">
              <b className="text-foreground">Copia automatica:</b>{" "}
              {automatica.ultima
                ? `l'ultima è di ${new Date(automatica.ultima).toLocaleString("it-IT")}`
                : "non ancora fatta"}
              {automatica.quante ? ` · ne teniamo ${automatica.quante}` : ""}. Si deposita da sola
              alla prima apertura del CRM di ogni giornata, in un contenitore privato.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              size="lg"
              className="h-auto py-3 justify-start gap-3"
              onClick={() => void scarica()}
              disabled={scaricando}
            >
              {scaricando ? (
                <Loader2 className="h-5 w-5 animate-spin shrink-0" />
              ) : (
                <Download className="h-5 w-5 shrink-0" />
              )}
              <span className="text-left">
                <span className="block text-sm font-semibold">Scarica una copia</span>
                <span className="block text-[11px] font-normal opacity-80">
                  un file .json sul tuo computer
                </span>
              </span>
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="h-auto py-3 justify-start gap-3"
              onClick={() => inputFile.current?.click()}
              disabled={leggendo}
            >
              {leggendo ? (
                <Loader2 className="h-5 w-5 animate-spin shrink-0" />
              ) : (
                <Upload className="h-5 w-5 shrink-0" />
              )}
              <span className="text-left">
                <span className="block text-sm font-semibold">Carica una copia</span>
                <span className="block text-[11px] font-normal text-muted-foreground">
                  prima ti dice cosa succederebbe
                </span>
              </span>
            </Button>
            <input
              ref={inputFile}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                //  Si azzera subito: senza, riscegliere lo STESSO file non
                //  farebbe scattare niente e sembrerebbe che il pulsante
                //  non funzioni.
                e.target.value = "";
                if (f) void leggiFile(f);
              }}
            />
          </div>

          {/* ── COSA C'È DENTRO ──────────────────────────────────────────── */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Cosa c'è dentro il file
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              Lead, consulenti, spesa inserita a mano, preventivi, codici sconto, richieste dal
              sito, candidature, orari e disponibilità, contenuti della landing, utenti e permessi,
              preferenze notifiche, template WhatsApp, listino, sconti quantità e tutte le
              impostazioni di CRM e Meetly.
            </p>
            {riepilogo && (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 pt-1">
                {riepilogo.map((v) => (
                  <li
                    key={v.campo}
                    className="flex items-baseline justify-between gap-2 text-[12px]"
                  >
                    <span className="text-muted-foreground truncate">{v.etichetta}</span>
                    <span
                      className={cn(
                        "font-semibold tabular-nums shrink-0",
                        v.problema ? "text-destructive" : "text-foreground",
                      )}
                    >
                      {v.problema ? "non letto" : v.righe}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground pt-1">
              Cosa NON c'è dentro
            </div>
            <ul className="space-y-1">
              {(fuori.length
                ? fuori
                : [
                    {
                      cosa: "I file video delle registrazioni",
                      perche:
                        "restano nell'archivio online; nel file ci sono data, durata, nome e collegamento",
                    },
                    {
                      cosa: "PIN, token, chiavi e password",
                      perche: "un file che gira per email non deve contenerli",
                    },
                  ]
              ).map((f) => (
                <li key={f.cosa} className="text-[12px] leading-relaxed">
                  <span className="font-medium">{f.cosa}</span>
                  <span className="text-muted-foreground"> — {f.perche}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-[12px] text-muted-foreground">
            Devi caricare una <strong>lista di contatti</strong> (CSV o esportazione di un altro
            gestionale) invece che una copia completa?{" "}
            <Link to="/CRM/importa" className="text-primary underline underline-offset-2">
              Importa una lista di contatti <ArrowRight className="inline h-3 w-3" />
            </Link>
          </p>
        </CardContent>
      </Card>

      {/* ── PRIMA SI GUARDA ─────────────────────────────────────────────── */}
      {anteprima && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileJson className="h-5 w-5" />
              Cosa succede se importi {nomeFile}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Ancora non è stato scritto niente. Questo è quello che c'è nel file, confrontato con
              quello che c'è adesso.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border divide-y">
              {anteprima
                .filter((v) => v.nelFile > 0 || v.attuali > 0)
                .map((v) => (
                  <div
                    key={v.campo}
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 p-2.5"
                  >
                    <span className="text-[13px] font-medium flex-1 min-w-[140px]">
                      {v.etichetta}
                    </span>
                    {v.problema ? (
                      <span className="text-[12px] text-destructive">{v.problema}</span>
                    ) : (
                      <>
                        <span className="text-[12px] text-muted-foreground tabular-nums">
                          {v.nelFile} nel file
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[11px] border-emerald-300 text-emerald-700"
                        >
                          +{v.nuove} nuove
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[11px] border-amber-300 text-amber-700"
                        >
                          {v.gia} sovrascritte
                        </Badge>
                        <span className="text-[11px] text-muted-foreground tabular-nums">
                          adesso: {v.attuali}
                        </span>
                      </>
                    )}
                  </div>
                ))}
            </div>

            <div className="rounded-lg border p-3 space-y-2">
              <div className="text-sm font-semibold">Aggiungi e aggiorna</div>
              <p className="text-[12px] text-muted-foreground">
                Non cancella niente: le righe che esistono già vengono riscritte con quelle del
                file, le altre vengono aggiunte. È l'operazione normale.
              </p>
              <Button
                onClick={() => void importa("aggiungi")}
                disabled={scrivendo !== null}
                className="gap-2"
              >
                {scrivendo === "aggiungi" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Aggiungi e aggiorna
              </Button>
            </div>

            {/* ── ZONA PERICOLOSA ──────────────────────────────────────────
                Separata a vista, con il rosso addosso e una conferma che
                NOMINA quello che si perde: "sostituisci" cancella e riscrive,
                e nessuno deve poterci finire dentro premendo il pulsante
                accanto a quello giusto. */}
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                <AlertOctagon className="h-4 w-4" />
                Sostituisci tutto
              </div>
              <p className="text-[12px] text-muted-foreground">
                Cancella gli archivi che ci sono adesso e riscrive quelli del file. Si usa solo per
                tornare indietro a una copia precedente. <strong>Non si può annullare.</strong>
              </p>
              <p className="text-[12px]">
                {elencoPerse ? (
                  <>
                    Vengono cancellati: <strong className="text-destructive">{elencoPerse}</strong>.
                  </>
                ) : (
                  <>Adesso non c'è niente da cancellare: si comporta come «Aggiungi».</>
                )}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Le impostazioni (listino, template, chiavi di configurazione) non vengono mai
                svuotate: vengono sovrascritte con quelle del file. PIN e token restano dove sono.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Input
                  value={conferma}
                  onChange={(e) => setConferma(e.target.value)}
                  placeholder="scrivi SOSTITUISCI"
                  className="sm:max-w-[220px] text-sm"
                />
                <Button
                  variant="destructive"
                  disabled={!puoSostituire || scrivendo !== null}
                  onClick={() => void importa("sostituisci")}
                  className="gap-2"
                >
                  {scrivendo === "sostituisci" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Cancella e sostituisci
                </Button>
              </div>
            </div>

            {esito && (
              <div
                className={cn(
                  "rounded-lg border p-3 text-[12px]",
                  esito.ok
                    ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                    : "border-destructive/40 bg-destructive/5 text-destructive",
                )}
              >
                <div className="flex items-start gap-2">
                  {esito.ok ? (
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  )}
                  <span>{esito.testo}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

/** Zona pericolosa: reset di tutti i dati storici KPI con conferma testuale. */
function DangerZoneSection({ onReset }: { onReset: () => Promise<void> | void }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);

  const canReset = confirmText.trim().toLowerCase() === "conferma";

  const handleReset = async () => {
    if (!user || !canReset) return;
    setResetting(true);
    try {
      // Eseguo le delete in parallelo. Tutte filtrate da RLS sull'utente corrente.
      const results = await Promise.all([
        supabase.from("meta_ad_spend").delete().eq("user_id", user.id),
        supabase.from("ad_score_history").delete().eq("user_id", user.id),
        supabase.from("notifications").delete().eq("user_id", user.id),
        // lp_events non ha user_id: cancello tutti gli eventi (RLS richiede authenticated admin)
        supabase.from("lp_events").delete().gte("created_at", "1970-01-01"),
      ]);
      const firstErr = results.find((r) => r.error);
      if (firstErr?.error) {
        toast.error(`Reset parziale: ${firstErr.error.message}`);
      } else {
        toast.success("Tutti i KPI sono stati cancellati");
      }
      setOpen(false);
      setConfirmText("");
      await onReset();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Reset fallito: ${msg}`);
    } finally {
      setResetting(false);
    }
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <AlertOctagon className="h-5 w-5" />
          Zona pericolosa
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Operazioni distruttive irreversibili. Procedi solo se sai cosa stai facendo.
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 space-y-3">
          <div>
            <div className="text-sm font-semibold">Reset di tutti i KPI</div>
            <p className="text-[12px] text-muted-foreground mt-1">
              Cancella tutti i dati storici di performance: spesa Meta sincronizzata, snapshot
              storici dei punteggi creative, eventi della landing page e notifiche.{" "}
              <strong>Non</strong> cancella lead, consulenti, configurazione tracking né preferenze
              notifiche.
            </p>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Reset tutti i KPI
          </Button>
          <Finestra
            aperta={open}
            onCambio={(v) => {
              setOpen(v);
              if (!v) setConfirmText("");
            }}
            titolo="Cancella lo storico KPI"
            contesto="L'operazione non si può annullare."
            icona={AlertOctagon}
            larghezza="sm"
            bloccante
            classeCorpo="space-y-3"
            azioni={
              <>
                <Button
                  variant="outline"
                  disabled={resetting}
                  onClick={() => setOpen(false)}
                  className="border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                >
                  Annulla
                </Button>
                <Button
                  variant="destructive"
                  disabled={!canReset || resetting}
                  onClick={() => handleReset()}
                >
                  {resetting ? "Cancellazione…" : "Cancella definitivamente"}
                </Button>
              </>
            }
          >
            <NotaFinestra tono="attenzione" icona={AlertOctagon}>
              Vengono svuotate quattro tabelle. Lead, consulenti, configurazione tracking e
              preferenze notifiche restano dove sono.
            </NotaFinestra>

            <SezioneFinestra titolo="Cosa viene cancellato" senzaPadding>
              <ul className="divide-y divide-slate-200">
                {[
                  ["meta_ad_spend", "Spesa Meta storica sincronizzata"],
                  ["ad_score_history", "Snapshot giornalieri del punteggio creative"],
                  ["lp_events", "Eventi della landing (sessioni, scroll, funnel)"],
                  ["notifications", "Storico delle notifiche del centro alert"],
                ].map(([tabella, cosa]) => (
                  <li key={tabella} className="px-4 py-2.5">
                    <div className="font-mono text-[12px] text-slate-900">{tabella}</div>
                    <div className="text-[11px] text-slate-500">{cosa}</div>
                  </li>
                ))}
              </ul>
            </SezioneFinestra>

            <SezioneFinestra classeCorpo="p-4">
              <CampoFinestra
                etichetta="Scrivi «conferma» per procedere"
                nota="È l'unico modo per sbloccare il pulsante rosso."
              >
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="conferma"
                  autoFocus
                  className={CLASSE_CAMPO}
                />
              </CampoFinestra>
            </SezioneFinestra>
          </Finestra>
        </div>
      </CardContent>
    </Card>
  );
}

/** Pannello invio WhatsApp live.
 *  Permette di inviare un messaggio libero o un template Meta a un numero (E.164),
 *  usando il numero WhatsApp Business reale configurato nelle impostazioni.
 */
function WhatsAppTestSendTab({ phoneNumberId }: { phoneNumberId: string }) {
  interface TplComponent {
    type: string;
    text?: string;
  }
  interface Tpl {
    name: string;
    language: string;
    status: string;
    category: string;
    components?: TplComponent[];
  }

  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<"text" | "template">("text");
  const [body, setBody] = useState("Ciao! Questo è un messaggio di test inviato dal CRM.");
  const [templates, setTemplates] = useState<Tpl[] | null>(null);
  const [loadingTpl, setLoadingTpl] = useState(false);
  const [selectedTpl, setSelectedTpl] = useState<string>(""); // "name|lang"
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    category?: string;
    code?: number | null;
    subcode?: number | null;
    fbtrace?: string | null;
    raw?: unknown;
  } | null>(null);

  const loadTemplates = async () => {
    setLoadingTpl(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessione scaduta");
      const res = await fetch("/api/whatsapp-templates", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = (await res.json()) as {
        ok?: boolean;
        templates?: Tpl[];
        error?: string;
        message?: string;
      };
      if (!res.ok || !json.ok) throw new Error(json.message || json.error || `HTTP ${res.status}`);
      const approved = (json.templates ?? []).filter((t) => t.status === "APPROVED");
      setTemplates(approved);
      if (approved.length > 0 && !selectedTpl) {
        setSelectedTpl(`${approved[0].name}|${approved[0].language}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore caricamento template");
    } finally {
      setLoadingTpl(false);
    }
  };

  useEffect(() => {
    if (mode === "template" && templates === null) {
      void loadTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const normalizePhone = (p: string) => {
    const d = p.replace(/[^\d+]/g, "");
    return d.startsWith("+") ? d : `+${d}`;
  };

  const send = async () => {
    setResult(null);
    if (!phone.trim()) {
      toast.error("Inserisci il numero di destinazione");
      return;
    }
    const to = normalizePhone(phone);
    if (!/^\+\d{8,15}$/.test(to)) {
      toast.error("Formato numero non valido. Usa formato internazionale (es. +393331234567)");
      return;
    }
    if (mode === "text" && !body.trim()) {
      toast.error("Scrivi il messaggio da inviare");
      return;
    }
    if (mode === "template" && !selectedTpl) {
      toast.error("Seleziona un template");
      return;
    }

    setSending(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessione scaduta");

      const payload: Record<string, unknown> = { to };
      if (mode === "text") {
        payload.body = body;
      } else {
        const [name, lang] = selectedTpl.split("|");
        payload.templateName = name;
        payload.templateLang = lang;
      }

      const res = await fetch("/api/whatsapp-send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        waMessageId?: string;
        error?: string;
        category?: string;
        code?: number | null;
        error_subcode?: number | null;
        message?: string;
        hint?: string;
        fbtrace_id?: string | null;
        raw?: unknown;
      };
      if (!res.ok || !json.ok) {
        const msg = json.message || json.hint || json.error || `HTTP ${res.status}`;
        setResult({
          ok: false,
          message: msg,
          category: json.category ?? json.error,
          code: json.code ?? null,
          subcode: json.error_subcode ?? null,
          fbtrace: json.fbtrace_id ?? null,
          raw: json.raw,
        });
        toast.error("Invio fallito");
      } else {
        setResult({ ok: true, message: `Messaggio inviato (id: ${json.waMessageId ?? "n/d"})` });
        toast.success("Messaggio inviato");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setResult({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <HelloWorldQuickTest />

      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-[11.5px] leading-relaxed text-blue-900 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-200">
        <div className="font-semibold mb-1 flex items-center gap-1.5">
          <HelpCircle className="h-3.5 w-3.5" /> Invio reale (live)
        </div>
        {looksLikeMetaTestPhoneNumberId(phoneNumberId) ? (
          <>
            Al momento però nelle impostazioni è salvato un{" "}
            <strong>Phone Number ID di test Meta</strong>. Finché non lo sostituisci con quello del
            numero live, l'invio verso numeri reali non potrà funzionare.
          </>
        ) : (
          <>
            Questo invio usa il tuo numero WhatsApp Business <strong>in modalità Live</strong> verso
            qualsiasi destinatario. Per messaggi di testo libero il destinatario deve averti scritto
            nelle <strong>ultime 24h</strong>; altrimenti devi usare un{" "}
            <strong>template approvato</strong>. Assicurati che la tua app Meta sia in{" "}
            <strong>modalità Live</strong> (non Development) e che il numero sia verificato.
          </>
        )}
      </div>

      <div>
        <LabelWithHelp
          label="Numero destinatario (formato internazionale)"
          help="Es. +393331234567 — qualsiasi numero WhatsApp valido."
        />
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+393331234567"
        />
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "text" ? "default" : "outline"}
          onClick={() => setMode("text")}
          className="flex-1"
        >
          Messaggio libero
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "template" ? "default" : "outline"}
          onClick={() => setMode("template")}
          className="flex-1"
        >
          Template Meta
        </Button>
      </div>

      {mode === "text" ? (
        <div>
          <Label className="text-xs">Testo del messaggio</Label>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Scrivi il messaggio…"
            maxLength={1000}
          />
          <div className="text-[10px] text-muted-foreground mt-1 text-right">
            {body.length}/1000
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Template approvato</Label>
            <Button
              size="sm"
              variant="ghost"
              onClick={loadTemplates}
              disabled={loadingTpl}
              className="h-7 gap-1 text-[11px]"
            >
              <RefreshCw className={`h-3 w-3 ${loadingTpl ? "animate-spin" : ""}`} />
              Ricarica
            </Button>
          </div>
          {loadingTpl && !templates ? (
            <div className="text-xs text-muted-foreground italic">Caricamento template…</div>
          ) : templates && templates.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">
              Nessun template approvato. Creane uno su Meta Business Manager.
            </div>
          ) : templates ? (
            <select
              value={selectedTpl}
              onChange={(e) => setSelectedTpl(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              {templates.map((t) => (
                <option key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>
                  {t.name} ({t.language}) — {t.category}
                </option>
              ))}
            </select>
          ) : null}
          {selectedTpl &&
            templates &&
            (() => {
              const [n, l] = selectedTpl.split("|");
              const tpl = templates.find((t) => t.name === n && t.language === l);
              const txt = tpl?.components?.find((c) => c.type === "BODY")?.text;
              return txt ? (
                <div className="rounded border border-border bg-muted/30 p-2 text-[12px] whitespace-pre-wrap text-muted-foreground">
                  {txt}
                </div>
              ) : null;
            })()}
        </div>
      )}

      <Button onClick={send} disabled={sending} className="w-full gap-1.5">
        <Send className="h-4 w-4" />
        {sending ? "Invio in corso…" : "Invia messaggio"}
      </Button>

      {result && (
        <div
          className={`rounded border p-2 text-[12px] space-y-1 ${
            result.ok
              ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-300"
              : "border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-300"
          }`}
        >
          <div>{result.message}</div>
          {!result.ok && (result.category || result.code || result.fbtrace) && (
            <div className="text-[10.5px] font-mono opacity-80">
              {result.category && (
                <>
                  tipo: <strong>{result.category}</strong> ·{" "}
                </>
              )}
              {result.code != null && (
                <>
                  code: <strong>{result.code}</strong> ·{" "}
                </>
              )}
              {result.subcode != null && (
                <>
                  subcode: <strong>{result.subcode}</strong> ·{" "}
                </>
              )}
              {result.fbtrace && <>fbtrace: {result.fbtrace}</>}
            </div>
          )}
          {!result.ok && result.raw !== undefined && result.raw !== null && (
            <details className="text-[10.5px]">
              <summary className="cursor-pointer opacity-80">Mostra raw error Meta</summary>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all bg-background/60 p-1.5 rounded">
                {JSON.stringify(result.raw, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/** Quick tester per il template Meta base `hello_world` (en_US).
 *  È il template preapprovato Meta per il primo test di invio: serve solo a
 *  verificare che credenziali / numero / permessi siano configurati correttamente. */
function HelloWorldQuickTest() {
  const [phone, setPhone] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const normalizePhone = (p: string) => {
    const d = p.replace(/[^\d+]/g, "");
    return d.startsWith("+") ? d : `+${d}`;
  };

  const send = async () => {
    setResult(null);
    if (!phone.trim()) {
      toast.error("Inserisci il numero di destinazione");
      return;
    }
    const to = normalizePhone(phone);
    if (!/^\+\d{8,15}$/.test(to)) {
      toast.error("Formato non valido. Usa +<prefisso><numero>");
      return;
    }
    setSending(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error("Sessione scaduta");
      const res = await fetch("/api/whatsapp-send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to, templateName: "hello_world", templateLang: "en_US" }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        message?: string;
        hint?: string;
        waMessageId?: string;
      };
      if (!res.ok || !json.ok) {
        const msg = json.message || json.hint || json.error || `HTTP ${res.status}`;
        setResult({ ok: false, message: msg });
        toast.error("Invio hello_world fallito");
      } else {
        setResult({ ok: true, message: `Inviato! (id: ${json.waMessageId ?? "n/d"})` });
        toast.success("hello_world inviato");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setResult({ ok: false, message: msg });
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 p-3 dark:bg-emerald-950/20 dark:border-emerald-900/40 space-y-2">
      <div className="text-[12.5px] text-emerald-900 dark:text-emerald-200">
        <strong>
          Test rapido: template Meta <code>hello_world</code>.
        </strong>{" "}
        È il template preapprovato da Meta (lingua <code>en_US</code>): usalo per verificare in 2
        secondi che credenziali, Phone Number ID e permessi siano configurati correttamente.
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+393331234567"
          className="flex-1"
        />
        <Button onClick={send} disabled={sending} className="gap-1.5 shrink-0">
          <Send className="h-4 w-4" />
          {sending ? "Invio…" : "Invia hello_world"}
        </Button>
      </div>
      {result && (
        <div
          className={`rounded border p-2 text-[12px] ${
            result.ok
              ? "border-emerald-400 bg-emerald-100/60 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
              : "border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/40 dark:text-rose-300"
          }`}
        >
          {result.message}
        </div>
      )}
    </div>
  );
}
