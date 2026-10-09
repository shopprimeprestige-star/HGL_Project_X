// Cron-callable hook: sincronizza la spesa Meta giornaliera per ogni ad
// usando la Marketing API. Per ogni admin con tracking_config.meta_ad_account_id
// + meta_access_token, fa fetch degli insights di ieri e oggi e fa upsert
// su public.meta_ad_spend (incluse metriche video + reach/frequency).
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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

interface MetaInsightsResponse {
  data?: MetaInsightRow[];
  paging?: { next?: string };
  error?: { message?: string };
}

function sumAction(rows: MetaActionRow[] | undefined, type?: string): number {
  if (!rows) return 0;
  if (!type) return rows.reduce((s, r) => s + Number(r.value || 0), 0);
  return rows.filter((r) => r.action_type === type).reduce((s, r) => s + Number(r.value || 0), 0);
}

async function fetchInsights(
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
  while (url) {
    const res = await fetch(url);
    const json = (await res.json()) as MetaInsightsResponse;
    if (!res.ok || json.error) {
      throw new Error(json.error?.message || `Meta API ${res.status}`);
    }
    all.push(...(json.data ?? []));
    url = json.paging?.next;
  }
  return all;
}

export const Route = createFileRoute("/hooks/meta-spend-sync")({
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
        // Optional body: { since?: "YYYY-MM-DD", until?: "YYYY-MM-DD", days?: number }
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
          .select("user_id, meta_ad_account_id, meta_access_token, ads_history_start")
          .not("meta_ad_account_id", "is", null)
          .not("meta_access_token", "is", null);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const results: Array<{ user_id: string; rows: number; error?: string }> = [];
        for (const cfg of configs ?? []) {
          if (!cfg.meta_ad_account_id || !cfg.meta_access_token) continue;
          const cutoff = (cfg as { ads_history_start?: string | null }).ads_history_start
            ? String((cfg as { ads_history_start?: string | null }).ads_history_start).slice(0, 10)
            : null;
          // Se l'utente ha impostato un cutoff successivo a "until", skippa
          if (cutoff && cutoff > until) {
            results.push({ user_id: cfg.user_id, rows: 0, error: `cutoff ${cutoff} > ${until}` });
            continue;
          }
          try {
            const rows = await fetchInsights(
              cfg.meta_ad_account_id,
              cfg.meta_access_token,
              since,
              until,
            );
            const upserts = rows
              .filter((r) => r.ad_id && r.date_start && (!cutoff || r.date_start >= cutoff))
              .map((r) => ({
                user_id: cfg.user_id,
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
                // Per i video_*_watched_actions di Meta NON va filtrato action_type:
                // l'array contiene già SOLO la metrica richiesta (la breakdown interna
                // è per video_id/placement, non un filtro). Filtrare su "video_view"
                // droppa rows e sotto-stima il dato del 30-70%.
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
              const dates = [...new Set(upserts.map((u) => u.spend_date))];
              const adIds = [...new Set(upserts.map((u) => u.ad_id))];
              const { data: existing } = await supabaseAdmin
                .from("meta_ad_spend")
                .select("ad_id, spend_date, spend, impressions, clicks, reach, frequency, video_plays, video_p25_watched, video_p50_watched, video_p75_watched, video_p100_watched, video_thruplays, video_3_sec_watched, video_15_sec_watched, video_avg_time_watched, video_continuous_2_sec_watched, outbound_clicks, link_clicks, post_engagement, landing_page_views")
                .eq("user_id", cfg.user_id)
                .in("spend_date", dates)
                .in("ad_id", adIds);
              const existMap = new Map<string, Record<string, number>>();
              for (const r of existing ?? []) {
                existMap.set(`${r.spend_date}|${r.ad_id}`, {
                  spend: Number(r.spend || 0),
                  impressions: Number(r.impressions || 0),
                  clicks: Number(r.clicks || 0),
                  reach: Number(r.reach || 0),
                  frequency: Number(r.frequency || 0),
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
                  reach: Math.max(u.reach, prev.reach),
                  frequency: Math.max(u.frequency, prev.frequency),
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
              const { error: upErr } = await supabaseAdmin
                .from("meta_ad_spend")
                .upsert(merged, { onConflict: "user_id,spend_date,ad_id" });
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
