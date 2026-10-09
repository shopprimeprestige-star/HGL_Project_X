import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { snapshotAllActiveAdsComposite } from "@/crm/ads-financials.functions";

/**
 * Hook giornaliero invocato da pg_cron.
 * Calcola e salva lo snapshot del Composite Score per tutte le ad attive
 * (con spesa negli ultimi 7gg) di tutti gli utenti del CRM.
 */
export const Route = createFileRoute("/hooks/score-snapshot")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const token = auth?.replace("Bearer ", "");
        if (!token) {
          return new Response(JSON.stringify({ error: "Missing authorization" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }
        const url = process.env.SUPABASE_URL;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!url || !serviceKey) {
          return new Response(JSON.stringify({ error: "Server not configured" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
        const admin = createClient<Database>(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        try {
          const results = await snapshotAllActiveAdsComposite(admin);
          const totalProcessed = results.reduce((s, r) => s + r.processed, 0);
          const totalErrors = results.reduce((s, r) => s + r.errors, 0);
          return new Response(JSON.stringify({
            ok: true, users: results.length, totalProcessed, totalErrors, results,
          }), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
          console.error("[score-snapshot] failed:", e);
          return new Response(JSON.stringify({
            ok: false, error: e instanceof Error ? e.message : String(e),
          }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
