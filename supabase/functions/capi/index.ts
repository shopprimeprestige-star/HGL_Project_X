// Edge function Supabase: Conversion API server-side per Meta + TikTok
// Legge meta_pixel_id / meta_access_token / meta_test_event_code / tiktok_*
// dalla tabella tracking_config.
// Deduplicazione browser/server tramite event_id univoco.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

interface CapiPayload {
  event_name: "PageView" | "ViewContent" | "AddToCart" | "Lead" | "Purchase" | string;
  event_id: string;
  event_time?: number;
  event_source_url?: string;
  user_data?: {
    email?: string;
    phone?: string;
    first_name?: string;
    last_name?: string;
    city?: string;
    fbp?: string;
    fbc?: string;
    fbclid?: string;
    ttclid?: string;
    external_id?: string;
    ip?: string;
    user_agent?: string;
  };
  custom_data?: {
    value?: number;
    currency?: string;
    content_name?: string;
    ad_id?: string;
    adset_id?: string;
    campaign_id?: string;
    ad_name?: string;
    creative_name?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_id?: string;
    utm_content?: string;
    utm_term?: string;
    time_on_page?: number;
    max_scroll?: number;
    reason?: string;
    [key: string]: unknown;
  };
  source?: "meta" | "tiktok" | "organic";
  admin_user_id?: string;
}

async function sha256Lower(value?: string): Promise<string | undefined> {
  if (!value) return undefined;
  const norm = value.trim().toLowerCase();
  const buf = new TextEncoder().encode(norm);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function buildMetaPayload(p: CapiPayload) {
  const ud: Record<string, unknown> = {};
  if (p.user_data?.email) ud.em = [await sha256Lower(p.user_data.email)];
  if (p.user_data?.phone) ud.ph = [await sha256Lower(p.user_data.phone.replace(/\D/g, ""))];
  if (p.user_data?.first_name) ud.fn = [await sha256Lower(p.user_data.first_name)];
  if (p.user_data?.last_name) ud.ln = [await sha256Lower(p.user_data.last_name)];
  if (p.user_data?.city) ud.ct = [await sha256Lower(p.user_data.city)];
  if (p.user_data?.external_id) ud.external_id = [await sha256Lower(p.user_data.external_id)];
  if (p.user_data?.fbp) ud.fbp = p.user_data.fbp;
  // Meta best practice: se manca _fbc cookie ma c'è fbclid, sintetizza
  const fbc = p.user_data?.fbc
    || (p.user_data?.fbclid ? `fb.1.${Date.now()}.${p.user_data.fbclid}` : undefined);
  if (fbc) ud.fbc = fbc;
  if (p.user_data?.ip) ud.client_ip_address = p.user_data.ip;
  if (p.user_data?.user_agent) ud.client_user_agent = p.user_data.user_agent;

  return {
    event_name: p.event_name,
    event_time: p.event_time ?? Math.floor(Date.now() / 1000),
    event_id: p.event_id,
    action_source: "website",
    event_source_url: p.event_source_url,
    user_data: ud,
    custom_data: p.custom_data,
  };
}

async function buildTikTokPayload(p: CapiPayload) {
  const ud: Record<string, unknown> = {};
  if (p.user_data?.email) ud.email = await sha256Lower(p.user_data.email);
  if (p.user_data?.phone) ud.phone = await sha256Lower(p.user_data.phone.replace(/\D/g, ""));
  if (p.user_data?.ttclid) ud.ttclid = p.user_data.ttclid;
  if (p.user_data?.ip) ud.ip = p.user_data.ip;
  if (p.user_data?.user_agent) ud.user_agent = p.user_data.user_agent;

  return {
    event: p.event_name,
    event_id: p.event_id,
    event_time: p.event_time ?? Math.floor(Date.now() / 1000),
    user: ud,
    properties: {
      value: p.custom_data?.value,
      currency: p.custom_data?.currency,
      content_name: p.custom_data?.content_name,
    },
    page: { url: p.event_source_url },
  };
}

async function sendMeta(
  pixelId: string,
  accessToken: string,
  testCode: string | null,
  data: unknown,
) {
  const url =
    `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;
  const body: Record<string, unknown> = { data: [data] };
  if (testCode) body.test_event_code = testCode;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

async function sendTikTok(pixelId: string, accessToken: string, data: unknown) {
  const res = await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Access-Token": accessToken },
    body: JSON.stringify({ pixel_code: pixelId, event_source: "web", data: [data] }),
  });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: CapiPayload;
  try {
    payload = (await req.json()) as CapiPayload;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!payload.event_name || !payload.event_id) {
    return new Response(
      JSON.stringify({ error: "event_name + event_id required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined;
  const ua = req.headers.get("user-agent") || undefined;
  payload.user_data = {
    ...payload.user_data,
    ip: payload.user_data?.ip || ip,
    user_agent: payload.user_data?.user_agent || ua,
  };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  let configs: Array<{
    user_id: string;
    meta_pixel_id: string | null;
    meta_access_token: string | null;
    meta_test_event_code: string | null;
    tiktok_pixel_id: string | null;
    tiktok_access_token: string | null;
  }> = [];

  let q = supabase.from("tracking_config").select(
    "user_id,meta_pixel_id,meta_access_token,meta_test_event_code,tiktok_pixel_id,tiktok_access_token",
  );
  if (payload.admin_user_id) q = q.eq("user_id", payload.admin_user_id);
  const { data, error } = await q;
  if (error) {
    return new Response(
      JSON.stringify({ ok: true, sent: 0, skipped: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  configs = (data ?? []) as typeof configs;

  const results: unknown[] = [];
  const wantMeta = payload.source !== "tiktok";
  const wantTikTok = payload.source !== "meta";

  for (const cfg of configs) {
    if (wantMeta && cfg.meta_pixel_id && cfg.meta_access_token) {
      const built = await buildMetaPayload(payload);
      const r = await sendMeta(
        cfg.meta_pixel_id,
        cfg.meta_access_token,
        cfg.meta_test_event_code ?? null,
        built,
      );
      results.push({ provider: "meta", user: cfg.user_id, ...r });
    }
    if (wantTikTok && cfg.tiktok_pixel_id && cfg.tiktok_access_token) {
      const built = await buildTikTokPayload(payload);
      const r = await sendTikTok(cfg.tiktok_pixel_id, cfg.tiktok_access_token, built);
      results.push({ provider: "tiktok", user: cfg.user_id, ...r });
    }
  }

  // Se è un evento Lead inviato con successo a Meta, marca il public_lead come capi_sent=true
  // Convenzione: il client passa external_id = id del public_lead per Lead/Purchase
  const metaOk = results.some(
    (r: any) => r?.provider === "meta" && r?.ok === true,
  );
  if (
    metaOk &&
    (payload.event_name === "Lead" || payload.event_name === "Purchase") &&
    payload.user_data?.external_id
  ) {
    try {
      await supabase
        .from("public_leads")
        .update({ capi_sent: true, capi_sent_at: new Date().toISOString() })
        .eq("id", payload.user_data.external_id);
    } catch (e) {
      console.error("Failed to mark capi_sent:", e);
    }
  }

  return new Response(JSON.stringify({ ok: true, sent: results.length, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
