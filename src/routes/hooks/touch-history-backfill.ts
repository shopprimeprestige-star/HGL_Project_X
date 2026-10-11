// Cron giornaliero: backfill best-effort touch_history su public_leads vecchi.
// Max 500 lead per esecuzione. Auth via Bearer = SUPABASE_PUBLISHABLE_KEY/ANON_KEY.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface TouchRow {
  ch: string;
  ts: number;
  utm_source?: string | null;
  utm_campaign?: string | null;
  fbclid?: string | null;
  ttclid?: string | null;
}

function detectCh(utm_source?: string | null, fbclid?: string | null, ttclid?: string | null): string {
  const s = (utm_source || "").toLowerCase();
  if (ttclid || s.includes("tiktok")) return "tiktok";
  if (fbclid || s.includes("facebook") || s.includes("instagram") || s.includes("meta")) return "meta";
  if (s.includes("google")) return "google";
  if (s.includes("email") || s.includes("newsletter")) return "email";
  return "direct";
}

function classify(touches: TouchRow[]): string {
  if (!touches || touches.length === 0) return "cold_direct";
  const ad = ["meta", "tiktok", "google", "email"];
  const adT = touches.filter((t) => ad.includes(t.ch));
  const distinct = new Set(adT.map((t) => t.ch));
  if (adT.length === 0) return "cold_direct";
  if (adT.length === 1) return touches.length === 1 ? "cold_direct" : "cold_assisted";
  if (adT.length >= 3 && distinct.size >= 2) return "retarget_multi";
  if (distinct.size >= 2) return "retarget_cross";
  return "retarget_same";
}

export const Route = createFileRoute("/hooks/touch-history-backfill")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const expected =
          process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!auth || !expected || !auth.includes(expected)) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const limit = 500;
        const { data: leads, error } = await supabaseAdmin
          .from("public_leads")
          .select("id, fbclid, ttclid, external_id, created_at, utm_source, utm_campaign, ad_id")
          .eq("touch_count", 0)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) {
          return new Response(
            JSON.stringify({ ok: false, error: error.message, processed: 0, updated: 0 }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        let updated = 0;
        for (const lead of leads || []) {
          const touches: TouchRow[] = [];
          const filters: string[] = [];
          if (lead.fbclid) filters.push(`fbclid.eq.${lead.fbclid}`);
          if (lead.ttclid) filters.push(`payload->>ttclid.eq.${lead.ttclid}`);
          if (lead.external_id) filters.push(`external_id.eq.${lead.external_id}`);

          if (filters.length === 0 && !lead.ad_id) {
            const ts = lead.created_at ? new Date(lead.created_at).getTime() : Date.now();
            touches.push({
              ch: detectCh(lead.utm_source, lead.fbclid, lead.ttclid),
              ts,
              utm_source: lead.utm_source,
              utm_campaign: lead.utm_campaign,
              fbclid: lead.fbclid,
              ttclid: lead.ttclid,
            });
          } else {
            let q = supabaseAdmin
              .from("lp_events")
              .select("created_at, utm_source, utm_campaign, fbclid, ad_id, payload")
              .eq("is_bot", false)
              .order("created_at", { ascending: true })
              .limit(50);
            if (filters.length > 0) q = q.or(filters.join(","));
            else if (lead.ad_id) q = q.eq("ad_id", lead.ad_id);
            const { data: events } = await q;
            (events || []).forEach((ev) => {
              const ts = ev.created_at ? new Date(ev.created_at).getTime() : Date.now();
              const ttc = (ev.payload && typeof ev.payload === "object" && "ttclid" in ev.payload
                ? (ev.payload as Record<string, unknown>).ttclid
                : null) as string | null;
              touches.push({
                ch: detectCh(ev.utm_source, ev.fbclid, ttc),
                ts,
                utm_source: ev.utm_source,
                utm_campaign: ev.utm_campaign,
                fbclid: ev.fbclid,
                ttclid: ttc,
              });
            });
            if (touches.length === 0) {
              const ts = lead.created_at ? new Date(lead.created_at).getTime() : Date.now();
              touches.push({
                ch: detectCh(lead.utm_source, lead.fbclid, lead.ttclid),
                ts,
                utm_source: lead.utm_source,
                utm_campaign: lead.utm_campaign,
                fbclid: lead.fbclid,
                ttclid: lead.ttclid,
              });
            }
          }

          const sorted = touches.sort((a, b) => a.ts - b.ts);
          const firstTs = sorted[0]?.ts || Date.now();
          const createdTs = lead.created_at ? new Date(lead.created_at).getTime() : Date.now();
          const ms = Math.max(0, createdTs - firstTs);

          const { error: upErr } = await supabaseAdmin
            .from("public_leads")
            .update({
              touch_history: sorted as never,
              touch_count: sorted.length,
              first_channel: sorted[0]?.ch || "direct",
              last_channel: sorted[sorted.length - 1]?.ch || "direct",
              journey_type: classify(sorted),
              days_to_convert: Math.round(ms / (1000 * 60 * 60 * 24)),
              hours_to_convert: Math.round(ms / (1000 * 60 * 60)),
            })
            .eq("id", lead.id);
          if (!upErr) updated++;
        }

        return new Response(
          JSON.stringify({ ok: true, processed: (leads || []).length, updated }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
