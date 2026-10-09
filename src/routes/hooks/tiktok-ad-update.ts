/** Rinomina TikTok ad via TikTok Business API.
 *  POST { userId, adId, adName }
 *  Auth: header Authorization deve includere SUPABASE_PUBLISHABLE_KEY (anon).
 *  Endpoint: POST /open_api/v1.3/ad/update/
 *  Doc: https://business-api.tiktok.com/portal/docs?id=1739953377508354
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const TT_API = "https://business-api.tiktok.com/open_api/v1.3";

interface ReqBody {
  userId: string;
  adId: string;
  adName: string;
}

export const Route = createFileRoute("/hooks/tiktok-ad-update")({
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

        const adName = (body.adName || "").trim();
        if (!body.userId || !body.adId || !adName) {
          return new Response(
            JSON.stringify({ error: "missing_params", hint: "userId, adId, adName required" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        if (adName.length > 512) {
          return new Response(JSON.stringify({ error: "name_too_long", max: 512 }), {
            status: 400, headers: { "Content-Type": "application/json" },
          });
        }

        const { data: cfg } = await supabaseAdmin
          .from("tracking_config")
          .select("tiktok_access_token, tiktok_advertiser_id")
          .eq("user_id", body.userId)
          .maybeSingle();
        const accessToken = (cfg as { tiktok_access_token?: string | null } | null)?.tiktok_access_token;
        const advertiserId = (cfg as { tiktok_advertiser_id?: string | null } | null)?.tiktok_advertiser_id;
        if (!accessToken || !advertiserId) {
          return new Response(
            JSON.stringify({ error: "missing_credentials", hint: "Configura TikTok in Impostazioni" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const res = await fetch(`${TT_API}/ad/update/`, {
          method: "POST",
          headers: { "Access-Token": accessToken, "Content-Type": "application/json" },
          body: JSON.stringify({
            advertiser_id: advertiserId,
            ad_id: body.adId,
            ad_name: adName,
          }),
        });
        const json = (await res.json()) as { code: number; message: string };
        if (!res.ok || json.code !== 0) {
          return new Response(
            JSON.stringify({ error: "tt_api_error", message: json.message || `HTTP ${res.status}` }),
            { status: 502, headers: { "Content-Type": "application/json" } },
          );
        }

        // Aggiorna anche la copia locale
        await supabaseAdmin
          .from("tiktok_ad_spend")
          .update({ ad_name: adName })
          .eq("user_id", body.userId)
          .eq("ad_id", body.adId);

        return new Response(JSON.stringify({ ok: true, adId: body.adId, adName }), {
          status: 200, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
