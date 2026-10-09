/** Pause/Resume + Status read for TikTok ads via TikTok Business API.
 *  POST { userId, adIds: string[], action: "pause" | "resume" | "status" }
 *  Auth: header Authorization deve includere SUPABASE_PUBLISHABLE_KEY (anon).
 *  Doc: https://business-api.tiktok.com/portal/docs?id=1739939120452097
 *  Endpoint write: POST /open_api/v1.3/ad/status/update/
 *  Endpoint read:  GET  /open_api/v1.3/ad/get/
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TT_API = "https://business-api.tiktok.com/open_api/v1.3";

interface ReqBody {
  userId: string;
  adIds: string[];
  action: "pause" | "resume" | "status";
}

async function callTTStatus(
  advertiserId: string,
  accessToken: string,
  adIds: string[],
  operationStatus: "DISABLE" | "ENABLE",
): Promise<{ ok: boolean; message?: string; raw?: unknown }> {
  const res = await fetch(`${TT_API}/ad/status/update/`, {
    method: "POST",
    headers: {
      "Access-Token": accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      advertiser_id: advertiserId,
      ad_ids: adIds,
      operation_status: operationStatus,
    }),
  });
  const json = (await res.json()) as { code: number; message: string; data?: unknown };
  if (!res.ok || json.code !== 0) {
    return { ok: false, message: json.message || `HTTP ${res.status}`, raw: json };
  }
  return { ok: true, raw: json };
}

async function callTTGet(
  advertiserId: string,
  accessToken: string,
  adIds: string[],
): Promise<{ ok: boolean; message?: string; status?: Record<string, "ENABLE" | "DISABLE" | "unknown"> }> {
  // /ad/get/ è GET con query string (filtering supporta ad_ids)
  const filtering = encodeURIComponent(JSON.stringify({ ad_ids: adIds }));
  const url = `${TT_API}/ad/get/?advertiser_id=${encodeURIComponent(advertiserId)}&filtering=${filtering}&fields=${encodeURIComponent(JSON.stringify(["ad_id", "operation_status", "secondary_status"]))}&page_size=100`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "Access-Token": accessToken },
  });
  const json = (await res.json()) as {
    code: number;
    message: string;
    data?: { list?: Array<{ ad_id: string; operation_status?: string; secondary_status?: string }> };
  };
  if (!res.ok || json.code !== 0) {
    return { ok: false, message: json.message || `HTTP ${res.status}` };
  }
  const status: Record<string, "ENABLE" | "DISABLE" | "unknown"> = {};
  for (const id of adIds) status[id] = "unknown";
  for (const row of json.data?.list ?? []) {
    const s = (row.operation_status || "").toUpperCase();
    status[row.ad_id] = s === "ENABLE" ? "ENABLE" : s === "DISABLE" ? "DISABLE" : "unknown";
  }
  return { ok: true, status };
}

export const Route = createFileRoute("/hooks/tiktok-ad-pause")({
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

        let body: ReqBody;
        try {
          body = (await request.json()) as ReqBody;
        } catch {
          return new Response(JSON.stringify({ error: "invalid_body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (!body.userId || !Array.isArray(body.adIds) || body.adIds.length === 0 || !body.action) {
          return new Response(
            JSON.stringify({ error: "missing_params", hint: "userId, adIds[], action required" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        if (body.adIds.length > 100) {
          return new Response(JSON.stringify({ error: "too_many_ads", max: 100 }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { data: cfg, error: cfgErr } = await supabaseAdmin
          .from("tracking_config")
          .select("tiktok_access_token, tiktok_advertiser_id")
          .eq("user_id", body.userId)
          .maybeSingle();
        if (cfgErr || !cfg) {
          return new Response(JSON.stringify({ error: "no_config" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        const accessToken = (cfg as { tiktok_access_token?: string | null }).tiktok_access_token;
        const advertiserId = (cfg as { tiktok_advertiser_id?: string | null }).tiktok_advertiser_id;
        if (!accessToken || !advertiserId) {
          return new Response(
            JSON.stringify({ error: "missing_credentials", hint: "Configura TikTok Access Token + Advertiser ID in Impostazioni" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        if (body.action === "status") {
          const r = await callTTGet(advertiserId, accessToken, body.adIds);
          if (!r.ok) {
            return new Response(JSON.stringify({ error: "tt_api_error", message: r.message }), {
              status: 502,
              headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ ok: true, status: r.status }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        const op = body.action === "pause" ? "DISABLE" : "ENABLE";
        const result = await callTTStatus(advertiserId, accessToken, body.adIds, op);
        if (!result.ok) {
          return new Response(
            JSON.stringify({ error: "tt_api_error", message: result.message, raw: result.raw }),
            { status: 502, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({
            ok: true,
            action: body.action,
            count: body.adIds.length,
            adIds: body.adIds,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
