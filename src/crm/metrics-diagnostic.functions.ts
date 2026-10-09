/** Server function per Diagnostica metriche.
 *  Fa una chiamata LIVE all'API Meta Insights (account-level, last_30d) e
 *  confronta valori chiave con quelli aggregati localmente da `meta_ad_spend`.
 *  Ritorna metriche ricalcolate con le stesse formule centralizzate
 *  in `metrics-formulas.ts` per garantire confronto apples-to-apples.
 *
 *  Drift > 5% = potenziale problema di sync o di formula. */

import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  computeHookRate,
  computeHoldRate,
  computeCpm,
  computeCtr,
  computeVideoViews,
} from "./ads-manager/metrics-formulas";

const META_API = "https://graph.facebook.com/v21.0";

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

interface VideoAction { action_type: string; value: string }
interface MetaInsight {
  spend?: string;
  impressions?: string;
  clicks?: string;
  inline_link_clicks?: string;
  video_play_actions?: VideoAction[];
  video_3_sec_watched_actions?: VideoAction[];
  video_thruplay_watched_actions?: VideoAction[];
  actions?: VideoAction[];
}

const sumAction = (arr: VideoAction[] | undefined, type = "video_view") => {
  if (!arr) return 0;
  const v = arr.find((a) => a.action_type === type);
  return v ? Number(v.value) : 0;
};

export interface DiagnosticRow {
  metric: string;
  label: string;
  live: number | null;
  local: number | null;
  unit: "€" | "%" | "n";
  driftPct: number | null;
  status: "ok" | "warn" | "drift" | "missing";
}

export interface AdDiagnosticRow {
  ad_id: string;
  ad_name: string | null;
  liveSpend: number;
  localSpend: number;
  liveImpr: number;
  localImpr: number;
  spendDriftPct: number | null;
  imprDriftPct: number | null;
  worstDriftPct: number;
  status: "ok" | "warn" | "drift" | "missing";
}

export const runMetricsDiagnostic = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string }) => d)
  .handler(async ({ data }): Promise<{ rows: DiagnosticRow[]; periodLabel: string; fetchedAt: string }> => {
    const { supabase, userId } = await authenticate(data.accessToken);

    // 1. Carica config Meta
    const { data: cfg } = await supabase
      .from("tracking_config")
      .select("meta_access_token, meta_ad_account_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!cfg?.meta_access_token || !cfg?.meta_ad_account_id) {
      throw new Error("Token Meta o Ad Account ID non configurati.");
    }
    const token = cfg.meta_access_token;
    const rawAcct = cfg.meta_ad_account_id.trim();
    const acct = rawAcct.startsWith("act_") ? rawAcct : `act_${rawAcct.replace(/^act_?/, "")}`;

    // 2. Live API call: account-level, last_30d
    const fields = [
      "spend",
      "impressions",
      "clicks",
      "inline_link_clicks",
      "video_play_actions",
      "video_3_sec_watched_actions",
      "video_thruplay_watched_actions",
    ].join(",");
    const u = new URL(`${META_API}/${acct}/insights`);
    u.searchParams.set("access_token", token);
    u.searchParams.set("fields", fields);
    u.searchParams.set("level", "account");
    u.searchParams.set("date_preset", "last_30d");
    const r = await fetch(u.toString());
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error?.message || `Meta API ${r.status}`);
    const ins: MetaInsight = (j.data?.[0] as MetaInsight) || {};

    const liveSpend = Number(ins.spend || 0);
    const liveImpressions = Number(ins.impressions || 0);
    const liveClicks = Number(ins.inline_link_clicks || ins.clicks || 0);
    const livePlays = sumAction(ins.video_play_actions);
    const liveV3sec = sumAction(ins.video_3_sec_watched_actions);
    const liveThru = sumAction(ins.video_thruplay_watched_actions);
    const liveViews = computeVideoViews(liveV3sec, 0);
    const liveCpm = computeCpm(liveSpend, liveImpressions);
    const liveCtr = computeCtr(liveClicks, liveImpressions);
    const liveHook = computeHookRate(liveViews, livePlays);
    const liveHold = computeHoldRate(liveThru, liveViews);

    // 3. Local aggregates: ultimi 30gg da meta_ad_spend
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().slice(0, 10);
    const { data: rows } = await supabase
      .from("meta_ad_spend")
      .select("spend, impressions, clicks, link_clicks, video_plays, video_3_sec_watched, video_thruplays")
      .eq("user_id", userId)
      .gte("spend_date", sinceStr);

    const agg = (rows || []).reduce(
      (acc, r) => {
        acc.spend += Number(r.spend || 0);
        acc.impressions += Number(r.impressions || 0);
        acc.clicks += Number(r.link_clicks || r.clicks || 0);
        acc.plays += Number(r.video_plays || 0);
        acc.v3 += Number(r.video_3_sec_watched || 0);
        acc.thru += Number(r.video_thruplays || 0);
        return acc;
      },
      { spend: 0, impressions: 0, clicks: 0, plays: 0, v3: 0, thru: 0 },
    );
    const localViews = computeVideoViews(agg.v3, 0);
    const localCpm = computeCpm(agg.spend, agg.impressions);
    const localCtr = computeCtr(agg.clicks, agg.impressions);
    const localHook = computeHookRate(localViews, agg.plays);
    const localHold = computeHoldRate(agg.thru, localViews);

    const buildRow = (
      metric: string,
      label: string,
      live: number,
      local: number,
      unit: "€" | "%" | "n",
    ): DiagnosticRow => {
      if (live === 0 && local === 0) {
        return { metric, label, live: 0, local: 0, unit, driftPct: 0, status: "missing" };
      }
      if (live === 0 || local === 0) {
        return { metric, label, live, local, unit, driftPct: null, status: "missing" };
      }
      const driftPct = ((local - live) / live) * 100;
      const abs = Math.abs(driftPct);
      const status: DiagnosticRow["status"] = abs <= 2 ? "ok" : abs <= 5 ? "warn" : "drift";
      return { metric, label, live, local, unit, driftPct, status };
    };

    const rowsOut: DiagnosticRow[] = [
      buildRow("spend", "Spesa", liveSpend, agg.spend, "€"),
      buildRow("impressions", "Impressions", liveImpressions, agg.impressions, "n"),
      buildRow("clicks", "Link Clicks", liveClicks, agg.clicks, "n"),
      buildRow("cpm", "CPM", liveCpm, localCpm, "€"),
      buildRow("ctr", "CTR", liveCtr, localCtr, "%"),
      buildRow("hookRate", "Hook Rate (3s/plays)", liveHook, localHook, "%"),
      buildRow("holdRate", "Hold Rate (thru/views)", liveHold, localHold, "%"),
    ];

    return {
      rows: rowsOut,
      periodLabel: "Ultimi 30 giorni · livello account",
      fetchedAt: new Date().toISOString(),
    };
  });

/** Diagnostica per singolo ad — confronta spesa+impressions per top 10 ad (per spesa locale)
 *  con i valori live di Meta Insights. Restituisce solo gli ad che hanno dati in entrambi. */
export const runTopAdsDiagnostic = createServerFn({ method: "POST" })
  .inputValidator((d: { accessToken: string }) => d)
  .handler(async ({ data }): Promise<{ ads: AdDiagnosticRow[]; periodLabel: string; fetchedAt: string }> => {
    const { supabase, userId } = await authenticate(data.accessToken);

    const { data: cfg } = await supabase
      .from("tracking_config")
      .select("meta_access_token, meta_ad_account_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!cfg?.meta_access_token || !cfg?.meta_ad_account_id) {
      throw new Error("Token Meta o Ad Account ID non configurati.");
    }
    const token = cfg.meta_access_token;
    const rawAcct = cfg.meta_ad_account_id.trim();
    const acct = rawAcct.startsWith("act_") ? rawAcct : `act_${rawAcct.replace(/^act_?/, "")}`;

    // 1. Top 10 ad locali per spesa ultimi 30gg
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().slice(0, 10);
    const { data: rows } = await supabase
      .from("meta_ad_spend")
      .select("ad_id, ad_name, spend, impressions")
      .eq("user_id", userId)
      .gte("spend_date", sinceStr);

    const localMap = new Map<string, { ad_name: string | null; spend: number; impr: number }>();
    for (const r of rows || []) {
      const cur = localMap.get(r.ad_id) || { ad_name: r.ad_name, spend: 0, impr: 0 };
      cur.spend += Number(r.spend || 0);
      cur.impr += Number(r.impressions || 0);
      if (!cur.ad_name && r.ad_name) cur.ad_name = r.ad_name;
      localMap.set(r.ad_id, cur);
    }
    const topLocal = [...localMap.entries()]
      .sort(([, a], [, b]) => b.spend - a.spend)
      .slice(0, 10);
    if (topLocal.length === 0) {
      return { ads: [], periodLabel: "Ultimi 30 giorni · top ad", fetchedAt: new Date().toISOString() };
    }

    // 2. Live API call: ad-level filtered by ids
    const u = new URL(`${META_API}/${acct}/insights`);
    u.searchParams.set("access_token", token);
    u.searchParams.set("fields", "ad_id,ad_name,spend,impressions");
    u.searchParams.set("level", "ad");
    u.searchParams.set("date_preset", "last_30d");
    u.searchParams.set("limit", "500");
    u.searchParams.set(
      "filtering",
      JSON.stringify([{ field: "ad.id", operator: "IN", value: topLocal.map(([id]) => id) }]),
    );
    const r = await fetch(u.toString());
    const j = await r.json();
    if (!r.ok || j.error) throw new Error(j.error?.message || `Meta API ${r.status}`);

    const liveMap = new Map<string, { spend: number; impr: number; name: string | null }>();
    for (const row of (j.data ?? []) as Array<{ ad_id: string; ad_name?: string; spend?: string; impressions?: string }>) {
      liveMap.set(row.ad_id, {
        spend: Number(row.spend || 0),
        impr: Number(row.impressions || 0),
        name: row.ad_name || null,
      });
    }

    const computeDrift = (live: number, local: number): { pct: number | null; status: AdDiagnosticRow["status"] } => {
      if (live === 0 && local === 0) return { pct: 0, status: "missing" };
      if (live === 0 || local === 0) return { pct: null, status: "missing" };
      const pct = ((local - live) / live) * 100;
      const abs = Math.abs(pct);
      return { pct, status: abs <= 2 ? "ok" : abs <= 5 ? "warn" : "drift" };
    };

    const ads: AdDiagnosticRow[] = topLocal.map(([ad_id, loc]) => {
      const live = liveMap.get(ad_id) || { spend: 0, impr: 0, name: null };
      const sd = computeDrift(live.spend, loc.spend);
      const id = computeDrift(live.impr, loc.impr);
      const worstAbs = Math.max(Math.abs(sd.pct ?? 0), Math.abs(id.pct ?? 0));
      // Status worst-of (drift > warn > ok > missing handled separately)
      let status: AdDiagnosticRow["status"] = "ok";
      if (sd.status === "missing" || id.status === "missing") status = "missing";
      else if (sd.status === "drift" || id.status === "drift") status = "drift";
      else if (sd.status === "warn" || id.status === "warn") status = "warn";
      return {
        ad_id,
        ad_name: live.name || loc.ad_name,
        liveSpend: live.spend,
        localSpend: loc.spend,
        liveImpr: live.impr,
        localImpr: loc.impr,
        spendDriftPct: sd.pct,
        imprDriftPct: id.pct,
        worstDriftPct: worstAbs,
        status,
      };
    });

    return {
      ads: ads.sort((a, b) => b.worstDriftPct - a.worstDriftPct),
      periodLabel: "Ultimi 30 giorni · top 10 ad per spesa",
      fetchedAt: new Date().toISOString(),
    };
  });
