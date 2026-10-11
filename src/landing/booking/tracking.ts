// Tracking utilities — UTM, fbp/fbc/ttclid, session, event id
import { supabase } from "@/integrations/supabase/client";

const SOURCE_KEY = "lp_source_data";
const ADMIN_FLAG = "lp_admin_skip";
const EXTERNAL_ID_KEY = "lp_external_id";
const TOUCH_HISTORY_KEY = "lp_touch_history";
const TOUCH_TTL_DAYS = 30;

// ---------- Touch history (multi-touch journey, localStorage 30gg) ----------
export interface TouchPoint {
  ch: "meta" | "tiktok" | "google" | "email" | "direct" | "organic";
  ts: number; // epoch ms
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  clid?: string;
  page?: string;
}

function detectChannelFromUrl(src: SourceData, gclid?: string): TouchPoint["ch"] {
  const s = (src.utm_source || "").toLowerCase();
  if (src.ttclid || s.includes("tiktok")) return "tiktok";
  if (src.fbclid || src.fbp || src.fbc || s.includes("facebook") || s.includes("meta") || s.includes("instagram")) return "meta";
  if (gclid || s.includes("google")) {
    if (s.includes("organic") || s.includes("seo")) return "organic";
    return "google";
  }
  if (s.includes("email") || s.includes("newsletter") || s.includes("mailchimp")) return "email";
  if (typeof document !== "undefined" && document.referrer && !document.referrer.includes(window.location.hostname)) {
    if (/google\./i.test(document.referrer)) return "organic";
    return "organic";
  }
  if (!s) return "direct";
  return "organic";
}

export function getTouchHistory(): TouchPoint[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TOUCH_HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as TouchPoint[];
    if (!Array.isArray(arr)) return [];
    const cutoff = Date.now() - TOUCH_TTL_DAYS * 24 * 60 * 60 * 1000;
    return arr.filter((t) => t && typeof t.ts === "number" && t.ts >= cutoff);
  } catch {
    return [];
  }
}

/** Aggiunge un touch alla history. Dedup: stesso canale + stessa campagna entro 30 min = stesso touch. */
export function appendTouch(src: SourceData): TouchPoint[] {
  if (typeof window === "undefined") return [];
  const url = typeof window !== "undefined" ? new URL(window.location.href) : null;
  const gclid = url?.searchParams.get("gclid") || undefined;
  const ch = detectChannelFromUrl(src, gclid);
  const now = Date.now();
  const newTouch: TouchPoint = {
    ch,
    ts: now,
    utm_source: src.utm_source,
    utm_medium: src.utm_medium,
    utm_campaign: src.utm_campaign,
    clid: src.fbclid || src.ttclid || gclid,
    page: typeof window !== "undefined" ? window.location.pathname : undefined,
  };
  const history = getTouchHistory();
  // Dedup: stesso canale + stessa campagna entro 30 min → non duplicare
  const last = history[history.length - 1];
  const sameRecent =
    last &&
    last.ch === newTouch.ch &&
    last.utm_campaign === newTouch.utm_campaign &&
    now - last.ts < 30 * 60 * 1000;
  if (!sameRecent) {
    history.push(newTouch);
  }
  // Cap a 50 touch
  const trimmed = history.slice(-50);
  try {
    localStorage.setItem(TOUCH_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore quota / Safari ITP
  }
  return trimmed;
}

export type JourneyType =
  | "cold_direct"
  | "cold_assisted"
  | "retarget_same"
  | "retarget_cross"
  | "retarget_multi";

export function classifyJourneyClient(touches: TouchPoint[]): JourneyType {
  if (!touches || touches.length === 0) return "cold_direct";
  const adChannels: TouchPoint["ch"][] = ["meta", "tiktok", "google", "email"];
  const adTouches = touches.filter((t) => adChannels.includes(t.ch));
  const distinct = new Set(adTouches.map((t) => t.ch));
  if (adTouches.length === 0) return "cold_direct";
  if (adTouches.length === 1) return touches.length === 1 ? "cold_direct" : "cold_assisted";
  if (adTouches.length >= 3 && distinct.size >= 2) return "retarget_multi";
  if (distinct.size >= 2) return "retarget_cross";
  return "retarget_same";
}

export function buildJourneySnapshot(): {
  touch_history: TouchPoint[];
  touch_count: number;
  first_channel: string | null;
  last_channel: string | null;
  journey_type: JourneyType;
  days_to_convert: number;
  hours_to_convert: number;
} {
  const history = getTouchHistory();
  if (history.length === 0) {
    return {
      touch_history: [],
      touch_count: 0,
      first_channel: null,
      last_channel: null,
      journey_type: "cold_direct",
      days_to_convert: 0,
      hours_to_convert: 0,
    };
  }
  const sorted = [...history].sort((a, b) => a.ts - b.ts);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const now = Date.now();
  const ms = Math.max(0, now - first.ts);
  return {
    touch_history: sorted,
    touch_count: sorted.length,
    first_channel: first.ch,
    last_channel: last.ch,
    journey_type: classifyJourneyClient(sorted),
    days_to_convert: Math.round(ms / (1000 * 60 * 60 * 24)),
    hours_to_convert: Math.round(ms / (1000 * 60 * 60)),
  };
}

const adminListeners = new Set<(isAdmin: boolean) => void>();
let runtimeSessionId: string | null = null;
let runtimePageInstanceId: string | null = null;

export interface SourceData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  // UTM granulari Meta: utm_id=Campaign, utm_content=Ad, utm_term=Adset
  utm_id?: string;
  utm_content?: string;
  utm_term?: string;
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  ttclid?: string;
  // Granular Meta ad attribution (passati come URL params dalle ad)
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
  ad_name?: string;
  creative_name?: string;
  external_id?: string;
}

// External ID: UUID persistente per utente (localStorage), usato per
// Advanced Matching su Meta CAPI e per legare lead → sessione → ad creative.
export function getExternalId(): string {
  if (typeof window === "undefined") return "ssr";
  try {
    const existing = localStorage.getItem(EXTERNAL_ID_KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
    localStorage.setItem(EXTERNAL_ID_KEY, fresh);
    return fresh;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  }
}

export function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  if (!runtimeSessionId) {
    runtimeSessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
  return runtimeSessionId;
}

function getPageInstanceId(): string {
  if (typeof window === "undefined") return "ssr";
  if (!runtimePageInstanceId) {
    runtimePageInstanceId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  return runtimePageInstanceId;
}

export function eventId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[2]) : undefined;
}

export function captureSourceData(): SourceData {
  if (typeof window === "undefined") return {};
  const url = new URL(window.location.href);
  const stored = sessionStorage.getItem(SOURCE_KEY);
  const prev: SourceData = stored ? JSON.parse(stored) : {};
  const q = (k: string) => url.searchParams.get(k) || undefined;

  // Meta consiglia: se in URL c'è fbclid e non esiste cookie _fbc,
  // sintetizzalo come "fb.1.<timestamp>.<fbclid>" (formato standard).
  const fbclid = q("fbclid") || prev.fbclid;
  let fbcCookie = readCookie("_fbc") || prev.fbc;
  if (!fbcCookie && fbclid) {
    fbcCookie = `fb.1.${Date.now()}.${fbclid}`;
  }

  const next: SourceData = {
    utm_source: q("utm_source") || prev.utm_source,
    utm_medium: q("utm_medium") || prev.utm_medium,
    utm_campaign: q("utm_campaign") || prev.utm_campaign,
    utm_id: q("utm_id") || prev.utm_id,
    utm_content: q("utm_content") || prev.utm_content,
    utm_term: q("utm_term") || prev.utm_term,
    fbp: readCookie("_fbp") || prev.fbp,
    fbc: fbcCookie,
    fbclid,
    ttclid: q("ttclid") || prev.ttclid,
    // Meta dynamic URL params: configurare nelle ad come
    // ?ad_id={{ad.id}}&adset_id={{adset.id}}&campaign_id={{campaign.id}}
    // &ad_name={{ad.name}}&creative={{ad.name}}
    // In alternativa Meta passa anche utm_id/content/term automaticamente.
    ad_id: q("ad_id") || q("utm_id") || prev.ad_id,
    adset_id: q("adset_id") || q("utm_term") || prev.adset_id,
    campaign_id: q("campaign_id") || q("utm_content") || prev.campaign_id,
    ad_name: q("ad_name") || prev.ad_name,
    creative_name: q("creative") || q("creative_name") || prev.creative_name,
    external_id: getExternalId(),
  };
  sessionStorage.setItem(SOURCE_KEY, JSON.stringify(next));
  // Append touch to multi-touch history (localStorage 30gg)
  try {
    appendTouch(next);
  } catch {
    // ignore (Safari ITP / quota)
  }
  return next;
}

export function detectSource(): "meta" | "tiktok" | "organic" {
  const s = captureSourceData();
  const src = (s.utm_source || "").toLowerCase();
  if (src.includes("tiktok") || s.ttclid) return "tiktok";
  if (src.includes("facebook") || src.includes("meta") || src.includes("instagram") || s.fbp || s.fbc)
    return "meta";
  return "organic";
}

function detectDevice(): string {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/Windows|Mac|Linux/.test(ua)) return "desktop";
  return "other";
}

function detectBot(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return /bot|crawler|spider|headless|phantom|preview/.test(ua);
}

// ---------- Admin detection ----------
// Risolto in modo sincrono dopo il primo getSession asincrono.
// Se admin: NESSUN evento al DB, NESSUN pixel, NESSUNA CAPI.
let adminCheckPromise: Promise<boolean> | null = null;
let adminResolved: boolean | null = null;

export function initAdminCheck(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  const cached = sessionStorage.getItem(ADMIN_FLAG);
  if (cached === "1") {
    adminResolved = true;
    return Promise.resolve(true);
  }
  if (cached === "0") {
    adminResolved = false;
    return Promise.resolve(false);
  }
  if (!adminCheckPromise) {
    adminCheckPromise = supabase.auth
      .getSession()
      .then(({ data }) => {
        const isAdmin = !!data.session?.user;
        try {
          sessionStorage.setItem(ADMIN_FLAG, isAdmin ? "1" : "0");
        } catch {
          // ignore
        }
        adminResolved = isAdmin;
        adminListeners.forEach((listener) => listener(isAdmin));
        return isAdmin;
      })
      .catch(() => {
        adminResolved = false;
        adminListeners.forEach((listener) => listener(false));
        return false;
      });
  }
  return adminCheckPromise;
}

export function subscribeAdminStatus(listener: (isAdmin: boolean) => void) {
  adminListeners.add(listener);
  if (adminResolved !== null) listener(adminResolved);
  return () => adminListeners.delete(listener);
}

export function isAdminLogged(): boolean {
  if (typeof window === "undefined") return false;
  if (adminResolved !== null) return adminResolved;
  const cached = sessionStorage.getItem(ADMIN_FLAG);
  if (cached === "1") return true;
  if (cached === "0") return false;
  // Se non ancora risolto: avvia check ma blocca per sicurezza
  // (non vogliamo tracciare admin per sbaglio).
  initAdminCheck();
  return true; // safe default: NON tracciare finché non sappiamo
}

const firedOnce = new Set<string>();

function markFiredOnce(key: string): boolean {
  const scopedKey = `${getSessionId()}:${getPageInstanceId()}:${key}`;
  if (firedOnce.has(scopedKey)) return false;
  firedOnce.add(scopedKey);
  return true;
}

export async function trackEvent(
  eventName: string,
  step: number | null = null,
  payload: Record<string, unknown> = {},
  options: { dedupKey?: string } = {},
) {
  if (isAdminLogged()) return;
  // Dedup: se viene passata una dedupKey, garantisce 1 invio per sessione
  if (options.dedupKey && !markFiredOnce(`evt:${eventName}:${options.dedupKey}`)) {
    return;
  }
  const source = captureSourceData();
  try {
    await supabase.from("lp_events").insert({
      event_name: eventName,
      session_id: getSessionId(),
      step,
      payload: payload as never,
      utm_source: source.utm_source ?? detectSource(),
      utm_medium: source.utm_medium ?? null,
      utm_campaign: source.utm_campaign ?? null,
      utm_id: source.utm_id ?? null,
      utm_content: source.utm_content ?? null,
      utm_term: source.utm_term ?? null,
      fbc: source.fbc ?? null,
      fbp: source.fbp ?? null,
      fbclid: source.fbclid ?? null,
      device: detectDevice(),
      is_bot: detectBot(),
      ad_id: source.ad_id ?? null,
      adset_id: source.adset_id ?? null,
      campaign_id: source.campaign_id ?? null,
      ad_name: source.ad_name ?? null,
      creative_name: source.creative_name ?? null,
      external_id: source.external_id ?? null,
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
    });
  } catch (e) {
    console.warn("trackEvent failed", e);
  }
}

// Browser pixel firing — Meta + TikTok
declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (event: string, params?: Record<string, unknown>) => void };
  }
}

export function firePixel(
  event: "PageView" | "ViewContent" | "AddToCart" | "Lead",
  params: Record<string, unknown> = {},
  evtId?: string,
  options: { dedupKey?: string; customName?: string } = {},
) {
  if (isAdminLogged()) return;
  if (options.dedupKey && !markFiredOnce(`px:${event}:${options.dedupKey}`)) {
    return;
  }
  try {
    if (typeof window !== "undefined") {
      window.fbq?.("track", event, params, evtId ? { eventID: evtId } : undefined);
      window.ttq?.track(event, params);
      // Custom proprietary event name (Meta trackCustom + TikTok)
      if (options.customName) {
        window.fbq?.("trackCustom", options.customName, params, evtId ? { eventID: evtId } : undefined);
        window.ttq?.track(options.customName, params);
      }
    }
  } catch (e) {
    console.warn("firePixel failed", e);
  }
}

// Server-side CAPI dispatch — deduplicated via event_id with browser pixel.
// Punta alla edge function Supabase capi (vedi supabase/functions/capi/index.ts).
const CAPI_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/capi`;

export async function fireCapi(
  event: "PageView" | "ViewContent" | "AddToCart" | "Lead" | "HighQualityVisit" | string,
  evtId: string,
  userData: {
    email?: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
    city?: string;
  } = {},
  customData: { value?: number; currency?: string; content_name?: string } & Record<string, unknown> = {},
) {
  if (typeof window === "undefined") return;
  if (isAdminLogged()) return;
  const source = captureSourceData();
  try {
    await fetch(CAPI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      keepalive: true,
      body: JSON.stringify({
        event_name: event,
        event_id: evtId,
        event_source_url: window.location.href,
        source: detectSource(),
        user_data: {
          ...userData,
          fbp: source.fbp,
          fbc: source.fbc,
          fbclid: source.fbclid,
          ttclid: source.ttclid,
          external_id: source.external_id,
          user_agent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        },
        custom_data: {
          ...customData,
          ad_id: source.ad_id,
          adset_id: source.adset_id,
          campaign_id: source.campaign_id,
          ad_name: source.ad_name,
          creative_name: source.creative_name,
          utm_source: source.utm_source,
          utm_medium: source.utm_medium,
          utm_campaign: source.utm_campaign,
          utm_id: source.utm_id,
          utm_content: source.utm_content,
          utm_term: source.utm_term,
        },
      }),
    });
  } catch (e) {
    console.warn("fireCapi failed", e);
  }
}

// HighQualityVisit: trigger quando l'utente sta sulla pagina > 40s
// OPPURE supera il 50% di scroll. Inviato 1 sola volta per sessione.
// Manda l'evento sia al DB (lp_events) che a Meta CAPI con UTM/IP/UA per
// alimentare il segnale "lookalike di lettori attenti".
export function initHighQualityVisit(thresholdSec = 40, thresholdScrollPct = 50) {
  if (typeof window === "undefined") return () => {};
  if (isAdminLogged()) return () => {};
  let fired = false;
  let elapsed = 0;
  let maxScroll = 0;

  const fire = (reason: "time" | "scroll") => {
    if (fired) return;
    fired = true;
    const evtId = eventId();
    void trackEvent("HighQualityVisit", null, {
      reason,
      time_on_page: elapsed,
      max_scroll: maxScroll,
    }, { dedupKey: "hqv" });
    void fireCapi("HighQualityVisit", evtId, {}, {
      content_name: "high_quality_landing_visit",
      value: 1,
      currency: "EUR",
      time_on_page: elapsed,
      max_scroll: maxScroll,
      reason,
    });
    // Segnale anche a Pixel browser (custom event) per match lato Events Manager
    try {
      if (typeof window !== "undefined") {
        window.fbq?.("trackCustom", "HighQualityVisit", { reason, time_on_page: elapsed, max_scroll: maxScroll }, { eventID: evtId });
      }
    } catch {
      // ignore
    }
  };

  const interval = setInterval(() => {
    if (document.hidden) return;
    elapsed += 1;
    if (elapsed >= thresholdSec) fire("time");
  }, 1000);

  const onScroll = () => {
    const docH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    const winH = window.innerHeight;
    const pct = Math.min(100, Math.round(((window.scrollY + winH) / docH) * 100));
    if (pct > maxScroll) maxScroll = pct;
    if (pct >= thresholdScrollPct) fire("scroll");
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  return () => {
    clearInterval(interval);
    window.removeEventListener("scroll", onScroll);
  };
}

// Heartbeat: invia un evento ogni 15s finché la pagina è visibile.
// Serve a calcolare correttamente la durata della sessione lato dashboard.
export function initHeartbeat() {
  if (typeof window === "undefined") return () => {};
  let timer: ReturnType<typeof setInterval> | null = null;
  let elapsed = 0;
  const tick = () => {
    if (document.hidden) return;
    elapsed += 15;
    // NB: niente dedupKey -> un evento ogni 15s, ma lo step rimane null
    void trackEvent("Heartbeat", null, { elapsed });
  };
  const start = () => {
    if (timer) return;
    timer = setInterval(tick, 15000);
  };
  const stop = () => {
    if (!timer) return;
    clearInterval(timer);
    timer = null;
  };
  const onVis = () => {
    if (document.hidden) stop();
    else start();
  };
  document.addEventListener("visibilitychange", onVis);
  start();
  return () => {
    stop();
    document.removeEventListener("visibilitychange", onVis);
  };
}

export function initScrollTracking() {
  if (typeof window === "undefined") return () => {};
  const reported = new Set<number>();
  let maxPct = 0;
  let raf = 0;

  const compute = () => {
    raf = 0;
    const docH = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
    );
    const winH = window.innerHeight;
    const scrolled = window.scrollY + winH;
    const pct = Math.min(100, Math.round((scrolled / docH) * 100));
    if (pct > maxPct) maxPct = pct;
    [25, 50, 75, 100].forEach((th) => {
      if (pct >= th && !reported.has(th)) {
        reported.add(th);
        trackEvent("Scroll", null, { scroll: th });
      }
    });
  };

  const onScroll = () => {
    if (raf) return;
    raf = window.requestAnimationFrame(compute);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("touchmove", onScroll, { passive: true });

  // primo check appena montato (utente già in cima → 25% potrebbe non scattare,
  // ma una volta che scrolla, scatta)
  setTimeout(compute, 100);

  return () => {
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("touchmove", onScroll);
    if (raf) window.cancelAnimationFrame(raf);
  };
}

// Click tracker — generic helper. Per dedup, passa dedupKey.
export function trackClick(
  element: string,
  payload: Record<string, unknown> = {},
  options: { dedupKey?: string } = {},
) {
  trackEvent("Click", null, { element, ...payload }, options);
}

// Global delegated click tracking on [data-track] elements.
// Ogni (track-name, track-value) viene contato 1 sola volta per sessione.
export function initClickTracking() {
  if (typeof window === "undefined") return () => {};
  const handler = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const el = target.closest<HTMLElement>("[data-track]");
    if (!el) return;
    const name = el.dataset.track || "unknown";
    const value = el.dataset.trackValue;
    trackClick(
      name,
      {
        text: el.textContent?.trim().slice(0, 50),
        ...(value ? { value } : {}),
      },
      { dedupKey: `${name}:${value ?? ""}` },
    );
  };
  document.addEventListener("click", handler);
  return () => document.removeEventListener("click", handler);
}

// ---------- Live presence (real-time visitors) ----------
// Uses Supabase Realtime presence channel. Each visitor joins the channel
// with a unique session id; the channel state contains all currently-connected
// presences. Much more robust than counting recent DB events because it
// reflects WebSocket connection state in real time.
const PRESENCE_CHANNEL = "lp_visitors_presence";

export function initLivePresence(): () => void {
  if (typeof window === "undefined") return () => {};
  if (isAdminLogged()) return () => {};

  const channel = supabase.channel(PRESENCE_CHANNEL, {
    config: { presence: { key: getSessionId() } },
  });

  channel.subscribe(async (status) => {
    if (status === "SUBSCRIBED") {
      await channel.track({
        session_id: getSessionId(),
        device: detectDevice(),
        joined_at: Date.now(),
      });
    }
  });

  const onVis = () => {
    if (document.hidden) {
      void channel.untrack();
    } else {
      void channel.track({
        session_id: getSessionId(),
        device: detectDevice(),
        joined_at: Date.now(),
      });
    }
  };
  document.addEventListener("visibilitychange", onVis);

  return () => {
    document.removeEventListener("visibilitychange", onVis);
    void supabase.removeChannel(channel);
  };
}

// For the dashboard: subscribe to live presence count.
export function subscribeLiveVisitorsCount(
  onCount: (count: number) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const channel = supabase.channel(PRESENCE_CHANNEL, {
    config: { presence: { key: `dashboard-${Math.random().toString(36).slice(2, 10)}` } },
  });

  const compute = () => {
    const state = channel.presenceState();
    // Count unique session_ids; exclude dashboard observers (key starts with "dashboard-")
    const ids = new Set<string>();
    Object.keys(state).forEach((key) => {
      if (key.startsWith("dashboard-")) return;
      ids.add(key);
    });
    onCount(ids.size);
  };

  channel
    .on("presence", { event: "sync" }, compute)
    .on("presence", { event: "join" }, compute)
    .on("presence", { event: "leave" }, compute)
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        // Track ourselves so we appear in state (but filtered out of count)
        await channel.track({ kind: "dashboard" });
        compute();
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}
