/** Server function: WoW Creative snapshot per TikTok ads.
 *  Mirror di getCreativeWowSnapshot ma legge da tiktok_ad_spend e mappa
 *  hookRate/holdRate sulle metriche TikTok native (video_watched_2s/6s).
 *  Schema output identico così CreativeTrendCard può ingerirlo senza branching.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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

export const getTikTokCreativeWowSnapshot = createServerFn({ method: "POST" })
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

    const { data: spend14, error } = await supabase
      .from("tiktok_ad_spend")
      .select("ad_id, ad_name, campaign_name, spend_date, spend, impressions, clicks, video_views, video_views_p25, video_views_p100, video_watched_2s, video_watched_6s")
      .eq("user_id", userId)
      .gte("spend_date", since14ISO);
    if (error) {
      console.error("[getTikTokCreativeWowSnapshot]", error);
      return { ok: false as const, items: [] };
    }
    if (!spend14 || spend14.length === 0) return { ok: true as const, items: [] };

    interface Win {
      spend: number; impressions: number; clicks: number;
      vViews: number; v25: number; v100: number; w2: number; w6: number;
    }
    const empty = (): Win => ({ spend: 0, impressions: 0, clicks: 0, vViews: 0, v25: 0, v100: 0, w2: 0, w6: 0 });
    const adMap = new Map<string, { adName: string; campaignName: string; cur: Win; prev: Win }>();

    for (const r of spend14) {
      const isCur = r.spend_date >= since7ISO;
      const e = adMap.get(r.ad_id) ?? { adName: r.ad_name ?? r.ad_id, campaignName: r.campaign_name ?? "—", cur: empty(), prev: empty() };
      const w = isCur ? e.cur : e.prev;
      w.spend += Number(r.spend || 0);
      w.impressions += Number(r.impressions || 0);
      w.clicks += Number(r.clicks || 0);
      w.vViews += Number(r.video_views || 0);
      w.v25 += Number(r.video_views_p25 || 0);
      w.v100 += Number(r.video_views_p100 || 0);
      w.w2 += Number(r.video_watched_2s || 0);
      w.w6 += Number(r.video_watched_6s || 0);
      adMap.set(r.ad_id, e);
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
        const ms = Number(e.max_scroll ?? 0); const tp = Number(e.time_on_page ?? 0);
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
        .not("ttclid", "is", null)
        .gte("created_at", `${sinceISO}T00:00:00Z`)
        .lt("created_at", `${untilISO}T00:00:00Z`);
      return (rows ?? []).length;
    }

    const adIds = [...adMap.keys()];
    const since180 = new Date(today); since180.setDate(today.getDate() - 180);
    const since180ISO = since180.toISOString().slice(0, 10);
    const { data: firstSeenRows } = await supabase
      .from("tiktok_ad_spend")
      .select("ad_id, spend_date")
      .eq("user_id", userId)
      .in("ad_id", adIds.length > 0 ? adIds : ["__none__"])
      .gte("spend_date", since180ISO)
      .order("spend_date", { ascending: true });
    const firstSeenByAd = new Map<string, string>();
    for (const r of firstSeenRows ?? []) {
      if (!firstSeenByAd.has(r.ad_id)) firstSeenByAd.set(r.ad_id, r.spend_date);
    }

    const dailyByAd = new Map<string, Map<string, { spend: number; clicks: number }>>();
    for (const r of spend14) {
      const m = dailyByAd.get(r.ad_id) ?? new Map();
      const cur = m.get(r.spend_date) ?? { spend: 0, clicks: 0 };
      cur.spend += Number(r.spend || 0); cur.clicks += Number(r.clicks || 0);
      m.set(r.spend_date, cur); dailyByAd.set(r.ad_id, m);
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
          // TikTok-native: hook = 2s/impressions, hold = 6s/impressions
          const hookRate = w.impressions > 0 ? (w.w2 / w.impressions) * 100 : 0;
          const holdRate = w.impressions > 0 ? (w.w6 / w.impressions) * 100 : 0;
          return {
            cpc, cpl, ctr, hookRate, holdRate,
            bounceRate: lp.bounceRate, scrollAvg: lp.avgScroll, timeOnPage: lp.avgTime,
            leads, sessions: lp.sessions, spend: w.spend,
          };
        }
        const cur = metrics(e.cur, leadCur, lpCur);
        const prev = metrics(e.prev, leadPrev, lpPrev);
        const isNew = e.prev.spend === 0 && e.prev.impressions === 0 && e.cur.spend > 0;

        const dailyMap = dailyByAd.get(adId);
        const sparkCpc: number[] = [];
        if (dailyMap) {
          for (const d of [...dailyMap.keys()].sort()) {
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
          // Score history non disponibile per TT (ad_score_history è per Meta)
          scoreCur: null as number | null, scorePrev: null as number | null, scoreSeries: [] as number[],
          sparkCpc, firstSeenISO, ageDays,
        };
      })
    );

    return { ok: true as const, items };
  });
