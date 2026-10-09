import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const META_API = "https://graph.facebook.com/v21.0";

interface TrackingCfg {
  meta_access_token: string | null;
  meta_ad_account_id: string | null;
}

function makeAuthedClient(accessToken: string) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
}

async function authenticate(accessToken: string) {
  if (!accessToken) throw new Error("Sessione non valida. Effettua di nuovo il login.");
  const supabase = makeAuthedClient(accessToken);
  const { data, error } = await supabase.auth.getClaims(accessToken);
  if (error || !data?.claims?.sub) throw new Error("Sessione scaduta. Rieffettua il login.");
  return { supabase, userId: data.claims.sub as string };
}

async function getCfg(supabase: ReturnType<typeof makeAuthedClient>, userId: string): Promise<TrackingCfg> {
  const { data } = await supabase
    .from("tracking_config")
    .select("meta_access_token, meta_ad_account_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.meta_access_token || !data?.meta_ad_account_id) {
    throw new Error("Token Meta o Ad Account ID non configurati. Vai in Impostazioni → Tracking.");
  }
  // Normalize ad account ID — Meta Graph API requires "act_<id>" prefix
  const rawAcct = data.meta_ad_account_id.trim();
  const normalizedAcct = rawAcct.startsWith("act_") ? rawAcct : `act_${rawAcct.replace(/^act_?/, "")}`;
  return { meta_access_token: data.meta_access_token, meta_ad_account_id: normalizedAcct };
}

async function metaGET(token: string, path: string, params: Record<string, string> = {}) {
  const u = new URL(`${META_API}${path}`);
  u.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u.toString());
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error?.message || `Meta API ${r.status}`);
  return j;
}

async function metaPOST(token: string, path: string, body: Record<string, string>) {
  const fd = new URLSearchParams({ access_token: token, ...body });
  const r = await fetch(`${META_API}${path}`, { method: "POST", body: fd });
  const j = await r.json();
  if (!r.ok || j.error) throw new Error(j.error?.message || `Meta API ${r.status}`);
  return j;
}

const INSIGHTS_FIELDS = "spend,impressions,clicks,ctr,cpm,cpc,actions";

function extractLeads(actions: Array<{ action_type: string; value: string }> | undefined) {
  if (!actions) return 0;
  const a = actions.find((x) => x.action_type === "lead" || x.action_type === "offsite_conversion.fb_pixel_lead");
  return a ? Number(a.value) : 0;
}

// ───────── LIST CAMPAIGNS ─────────
export const listCampaigns = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string }) => d)
  .handler(async ({ data }) => {
    const { supabase, userId } = await authenticate(data.accessToken);
    const cfg = await getCfg(supabase, userId);
    const token = cfg.meta_access_token!;
    const acct = cfg.meta_ad_account_id!;
    const [list, ins] = await Promise.all([
      metaGET(token, `/${acct}/campaigns`, {
        fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget,created_time",
        limit: "200",
      }),
      metaGET(token, `/${acct}/insights`, {
        fields: INSIGHTS_FIELDS,
        level: "campaign",
        date_preset: "last_30d",
        limit: "500",
      }).catch(() => ({ data: [] })),
    ]);
    type Insight = { campaign_id?: string; spend?: string; impressions?: string; clicks?: string; ctr?: string; cpm?: string; cpc?: string; actions?: Array<{ action_type: string; value: string }> };
    const insMap = new Map<string, Insight>(((ins.data || []) as Insight[]).map((x) => [x.campaign_id || "", x]));
    type Campaign = { id: string; name: string; status: string; effective_status: string; objective: string; daily_budget?: string; lifetime_budget?: string; created_time: string };
    const items = ((list.data || []) as Campaign[]).map((c) => {
      const i = insMap.get(c.id) || {};
      return {
        id: c.id,
        name: c.name,
        status: c.status,
        effective_status: c.effective_status,
        objective: c.objective,
        daily_budget: c.daily_budget ? Number(c.daily_budget) / 100 : null,
        lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : null,
        created_time: c.created_time,
        spend: Number(i.spend || 0),
        impressions: Number(i.impressions || 0),
        clicks: Number(i.clicks || 0),
        ctr: Number(i.ctr || 0),
        cpm: Number(i.cpm || 0),
        cpc: Number(i.cpc || 0),
        leads: extractLeads(i.actions),
      };
    });
    return { items };
  });

// ───────── LIST ADSETS ─────────
export const listAdsets = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; campaignId?: string }) => d)
  .handler(async ({ data }) => {
    const { supabase, userId } = await authenticate(data.accessToken);
    const cfg = await getCfg(supabase, userId);
    const token = cfg.meta_access_token!;
    const acct = cfg.meta_ad_account_id!;
    const path = data.campaignId ? `/${data.campaignId}/adsets` : `/${acct}/adsets`;
    const [list, ins] = await Promise.all([
      metaGET(token, path, {
        fields: "id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget,optimization_goal,created_time",
        limit: "200",
      }),
      metaGET(token, `/${acct}/insights`, {
        fields: INSIGHTS_FIELDS,
        level: "adset",
        date_preset: "last_30d",
        limit: "500",
        ...(data.campaignId ? { filtering: JSON.stringify([{ field: "campaign.id", operator: "EQUAL", value: data.campaignId }]) } : {}),
      }).catch(() => ({ data: [] })),
    ]);
    type Insight = { adset_id?: string; spend?: string; impressions?: string; clicks?: string; ctr?: string; cpm?: string; cpc?: string; actions?: Array<{ action_type: string; value: string }> };
    const insMap = new Map<string, Insight>(((ins.data || []) as Insight[]).map((x) => [x.adset_id || "", x]));
    type Adset = { id: string; name: string; status: string; effective_status: string; campaign_id: string; daily_budget?: string; lifetime_budget?: string; optimization_goal?: string; created_time: string };
    const items = ((list.data || []) as Adset[]).map((a) => {
      const i = insMap.get(a.id) || {};
      return {
        id: a.id,
        name: a.name,
        status: a.status,
        effective_status: a.effective_status,
        campaign_id: a.campaign_id,
        daily_budget: a.daily_budget ? Number(a.daily_budget) / 100 : null,
        lifetime_budget: a.lifetime_budget ? Number(a.lifetime_budget) / 100 : null,
        optimization_goal: a.optimization_goal,
        created_time: a.created_time,
        spend: Number(i.spend || 0),
        impressions: Number(i.impressions || 0),
        clicks: Number(i.clicks || 0),
        ctr: Number(i.ctr || 0),
        cpm: Number(i.cpm || 0),
        cpc: Number(i.cpc || 0),
        leads: extractLeads(i.actions),
      };
    });
    return { items };
  });

// ───────── LIST ADS ─────────
export const listAds = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; adsetId?: string; campaignId?: string }) => d)
  .handler(async ({ data }) => {
    const { supabase, userId } = await authenticate(data.accessToken);
    const cfg = await getCfg(supabase, userId);
    const token = cfg.meta_access_token!;
    const acct = cfg.meta_ad_account_id!;
    const path = data.adsetId
      ? `/${data.adsetId}/ads`
      : data.campaignId
        ? `/${data.campaignId}/ads`
        : `/${acct}/ads`;
    const [list, ins] = await Promise.all([
      metaGET(token, path, {
        fields: "id,name,status,effective_status,adset_id,campaign_id,creative{id,thumbnail_url,object_story_spec},created_time",
        limit: "300",
      }),
      metaGET(token, `/${acct}/insights`, {
        fields: INSIGHTS_FIELDS,
        level: "ad",
        date_preset: "last_30d",
        limit: "1000",
        ...(data.adsetId ? { filtering: JSON.stringify([{ field: "adset.id", operator: "EQUAL", value: data.adsetId }]) } : {}),
        ...(data.campaignId && !data.adsetId ? { filtering: JSON.stringify([{ field: "campaign.id", operator: "EQUAL", value: data.campaignId }]) } : {}),
      }).catch(() => ({ data: [] })),
    ]);
    type Insight = { ad_id?: string; spend?: string; impressions?: string; clicks?: string; ctr?: string; cpm?: string; cpc?: string; actions?: Array<{ action_type: string; value: string }> };
    const insMap = new Map<string, Insight>(((ins.data || []) as Insight[]).map((x) => [x.ad_id || "", x]));
    type Ad = { id: string; name: string; status: string; effective_status: string; adset_id: string; campaign_id: string; creative?: { id?: string; thumbnail_url?: string }; created_time: string };
    const items = ((list.data || []) as Ad[]).map((a) => {
      const i = insMap.get(a.id) || {};
      return {
        id: a.id,
        name: a.name,
        status: a.status,
        effective_status: a.effective_status,
        adset_id: a.adset_id,
        campaign_id: a.campaign_id,
        creative_id: a.creative?.id || null,
        thumbnail_url: a.creative?.thumbnail_url || null,
        created_time: a.created_time,
        spend: Number(i.spend || 0),
        impressions: Number(i.impressions || 0),
        clicks: Number(i.clicks || 0),
        ctr: Number(i.ctr || 0),
        cpm: Number(i.cpm || 0),
        cpc: Number(i.cpc || 0),
        leads: extractLeads(i.actions),
      };
    });
    return { items };
  });

// ───────── DUPLICATE AD ─────────
export const duplicateAd = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; adId: string; newName?: string; status?: "ACTIVE" | "PAUSED" }) => d)
  .handler(async ({ data }) => {
    const { supabase, userId } = await authenticate(data.accessToken);
    const cfg = await getCfg(supabase, userId);
    const token = cfg.meta_access_token!;
    const orig = await metaGET(token, `/${data.adId}`, {
      fields: "name,adset_id,creative{id}",
    });
    const newName = data.newName || `${orig.name} – Copia ${new Date().toLocaleDateString("it-IT")}`;
    const created = await metaPOST(token, `/${orig.adset_id}/ads`, {
      name: newName,
      status: data.status || "PAUSED",
      creative: JSON.stringify({ creative_id: orig.creative.id }),
    });
    return { id: created.id, name: newName };
  });

// ───────── GET AD CREATIVE PREVIEW (thumbnail + video URL) ─────────
// Usato nella tab Deep Analysis per mostrare anteprima video cliccabile.
interface AdCreativeData {
  thumbnail_url?: string;
  video_id?: string;
  image_url?: string;
  object_story_spec?: {
    video_data?: { video_id?: string; image_url?: string };
    link_data?: { picture?: string; image_hash?: string };
  };
  asset_feed_spec?: {
    videos?: Array<{ video_id?: string; thumbnail_url?: string }>;
    images?: Array<{ url?: string }>;
  };
}

export const getAdPreviews = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string; adIds: string[] }) => d)
  .handler(async ({ data }) => {
    const { supabase, userId } = await authenticate(data.accessToken);
    const cfg = await getCfg(supabase, userId);
    const token = cfg.meta_access_token!;
    const adIds = data.adIds.slice(0, 50); // Limit per evitare abuse
    if (adIds.length === 0) return { items: [] as Array<{ ad_id: string; thumbnail_url: string | null; video_url: string | null; image_url: string | null }> };

    const items = await Promise.all(
      adIds.map(async (adId) => {
        try {
          const ad = await metaGET(token, `/${adId}`, {
            fields: "creative{id,thumbnail_url,video_id,image_url,object_story_spec,asset_feed_spec}",
          });
          const cr: AdCreativeData = ad.creative || {};
          const videoId = cr.video_id
            || cr.object_story_spec?.video_data?.video_id
            || cr.asset_feed_spec?.videos?.[0]?.video_id
            || null;
          let videoUrl: string | null = null;
          let thumbnailUrl: string | null = cr.thumbnail_url
            || cr.asset_feed_spec?.videos?.[0]?.thumbnail_url
            || cr.object_story_spec?.video_data?.image_url
            || null;
          if (videoId) {
            try {
              const v = await metaGET(token, `/${videoId}`, { fields: "source,picture" });
              videoUrl = v.source || null;
              if (!thumbnailUrl) thumbnailUrl = v.picture || null;
            } catch { /* video privato o mancante */ }
          }
          const imageUrl = cr.image_url
            || cr.object_story_spec?.link_data?.picture
            || cr.asset_feed_spec?.images?.[0]?.url
            || null;
          return { ad_id: adId, thumbnail_url: thumbnailUrl, video_url: videoUrl, image_url: imageUrl };
        } catch {
          return { ad_id: adId, thumbnail_url: null, video_url: null, image_url: null };
        }
      })
    );
    return { items };
  });
