/** Cron-callable hook: sincronizza la spesa TikTok giornaliera per ogni ad
 *  usando la TikTok Business API (Reporting v1.3). Per ogni admin con
 *  tracking_config.tiktok_access_token + tiktok_advertiser_id, fa fetch
 *  degli insights di ieri e oggi e fa upsert su public.tiktok_ad_spend.
 *
 *  Body opzionale: { since?: "YYYY-MM-DD", until?: "YYYY-MM-DD", days?: number }.
 *  Se non specificato → ieri+oggi.
 *
 *  Auth: header Authorization deve includere SUPABASE_PUBLISHABLE_KEY (anon),
 *  stesso pattern di meta-spend-sync.
 *
 *  Doc API: https://business-api.tiktok.com/portal/docs?id=1738864915188737
 *  Endpoint: GET /open_api/v1.3/report/integrated/get/
 *  Required scopes: Ads Management (Read). */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TT_API = "https://business-api.tiktok.com/open_api/v1.3";

interface TTReportRow {
  dimensions: { ad_id?: string; stat_time_day?: string };
  metrics: Record<string, string>;
}
interface TTReportResponse {
  code: number;
  message: string;
  data?: {
    list?: TTReportRow[];
    page_info?: { page: number; page_size: number; total_number: number; total_page: number };
  };
}

const TT_METRICS = [
  // base
  "ad_name", "campaign_id", "campaign_name", "adgroup_id",
  "spend", "impressions", "clicks", "reach", "frequency",
  // video
  "video_play_actions", "video_watched_2s", "video_watched_6s",
  "video_views_p25", "video_views_p50", "video_views_p75", "video_views_p100",
  "average_video_play",
  // engagement
  "likes", "comments", "shares", "follows", "profile_visits",
  // conversions
  "conversion", "cost_per_conversion", "conversion_rate",
] as const;

async function fetchTTInsights(
  advertiserId: string,
  accessToken: string,
  since: string,
  until: string,
): Promise<TTReportRow[]> {
  const all: TTReportRow[] = [];
  let page = 1;
  const pageSize = 1000;
  for (;;) {
    const params = new URLSearchParams({
      advertiser_id: advertiserId,
      report_type: "BASIC",
      data_level: "AUCTION_AD",
      dimensions: JSON.stringify(["ad_id", "stat_time_day"]),
      metrics: JSON.stringify(TT_METRICS),
      start_date: since,
      end_date: until,
      page: String(page),
      page_size: String(pageSize),
    });
    const res = await fetch(`${TT_API}/report/integrated/get/?${params.toString()}`, {
      headers: { "Access-Token": accessToken },
    });
    const json = (await res.json()) as TTReportResponse;
    if (!res.ok || json.code !== 0) {
      throw new Error(json.message || `TikTok API ${res.status}`);
    }
    const list = json.data?.list ?? [];
    all.push(...list);
    const info = json.data?.page_info;
    if (!info || page >= info.total_page) break;
    page += 1;
  }
  return all;
}

const num = (v: unknown) => Number(v ?? 0) || 0;

export const Route = createFileRoute("/hooks/tiktok-spend-sync")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const expected = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!auth || !auth.includes(expected || "__missing__")) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const today = new Date();
        const iso = (d: Date) => d.toISOString().slice(0, 10);
        let bodySince: string | undefined;
        let bodyUntil: string | undefined;
        let bodyDays: number | undefined;
        try {
          const txt = await request.text();
          if (txt) {
            const parsed = JSON.parse(txt) as { since?: string; until?: string; days?: number };
            bodySince = parsed.since;
            bodyUntil = parsed.until;
            bodyDays = parsed.days;
          }
        } catch { /* no body */ }
        let since: string;
        let until: string;
        if (bodySince && bodyUntil) {
          since = bodySince;
          until = bodyUntil;
        } else if (bodyDays && bodyDays > 0) {
          const start = new Date(today);
          start.setDate(today.getDate() - bodyDays);
          since = iso(start);
          until = iso(today);
        } else {
          const yesterday = new Date(today);
          yesterday.setDate(today.getDate() - 1);
          since = iso(yesterday);
          until = iso(today);
        }

        const { data: configs, error } = await supabaseAdmin
          .from("tracking_config")
          .select("user_id, tiktok_access_token, tiktok_advertiser_id, ads_history_start")
          .not("tiktok_access_token", "is", null)
          .not("tiktok_advertiser_id", "is", null);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const results: Array<{ user_id: string; rows: number; error?: string }> = [];
        for (const cfg of configs ?? []) {
          const accessToken = cfg.tiktok_access_token;
          const advertiserId = (cfg as { tiktok_advertiser_id?: string }).tiktok_advertiser_id;
          if (!accessToken || !advertiserId) continue;
          const cutoff = (cfg as { ads_history_start?: string | null }).ads_history_start
            ? String((cfg as { ads_history_start?: string | null }).ads_history_start).slice(0, 10)
            : null;
          if (cutoff && cutoff > until) {
            results.push({ user_id: cfg.user_id, rows: 0, error: `cutoff ${cutoff} > ${until}` });
            continue;
          }
          try {
            const rows = await fetchTTInsights(advertiserId, accessToken, since, until);
            const upserts = rows
              .filter((r) => r.dimensions.ad_id && r.dimensions.stat_time_day)
              .map((r) => {
                // stat_time_day arriva come "YYYY-MM-DD HH:MM:SS" → tieni solo la data
                const spendDate = String(r.dimensions.stat_time_day).slice(0, 10);
                const m = r.metrics ?? {};
                return { spendDate, adId: r.dimensions.ad_id!, m };
              })
              .filter(({ spendDate }) => !cutoff || spendDate >= cutoff)
              .map(({ spendDate, adId, m }) => ({
                user_id: cfg.user_id,
                spend_date: spendDate,
                ad_id: adId,
                adset_id: m.adgroup_id ? String(m.adgroup_id) : null,
                campaign_id: m.campaign_id ? String(m.campaign_id) : null,
                ad_name: m.ad_name ? String(m.ad_name) : null,
                campaign_name: m.campaign_name ? String(m.campaign_name) : null,
                spend: num(m.spend),
                impressions: Math.round(num(m.impressions)),
                clicks: Math.round(num(m.clicks)),
                reach: Math.round(num(m.reach)),
                frequency: num(m.frequency),
                currency: "EUR",
                video_views: Math.round(num(m.video_play_actions)),
                video_views_p25: Math.round(num(m.video_views_p25)),
                video_views_p50: Math.round(num(m.video_views_p50)),
                video_views_p75: Math.round(num(m.video_views_p75)),
                video_views_p100: Math.round(num(m.video_views_p100)),
                video_play_actions: Math.round(num(m.video_play_actions)),
                video_watched_2s: Math.round(num(m.video_watched_2s)),
                video_watched_6s: Math.round(num(m.video_watched_6s)),
                average_video_play: num(m.average_video_play),
                likes: Math.round(num(m.likes)),
                comments: Math.round(num(m.comments)),
                shares: Math.round(num(m.shares)),
                follows: Math.round(num(m.follows)),
                profile_visits: Math.round(num(m.profile_visits)),
                conversions: Math.round(num(m.conversion)),
                cost_per_conversion: num(m.cost_per_conversion),
                conversion_rate: num(m.conversion_rate),
                fetched_at: new Date().toISOString(),
              }));

            if (upserts.length > 0) {
              const { error: upErr } = await supabaseAdmin
                .from("tiktok_ad_spend")
                .upsert(upserts, { onConflict: "user_id,ad_id,spend_date" });
              if (upErr) throw upErr;
            }
            results.push({ user_id: cfg.user_id, rows: upserts.length });
          } catch (e) {
            results.push({
              user_id: cfg.user_id,
              rows: 0,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }

        return new Response(
          JSON.stringify({ ok: true, since, until, results }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
