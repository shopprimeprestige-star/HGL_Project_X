// Restituisce le ultime esecuzioni del cron job 'meta-spend-sync-daily'.
// Usa supabaseAdmin (service_role) perché lo schema cron è leggibile solo da postgres/service_role.
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface CronRun {
  jobid: number;
  runid: number;
  status: string;
  return_message: string | null;
  start_time: string;
  end_time: string | null;
}

export const Route = createFileRoute("/hooks/cron-history")({
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
        // pg_cron non è esposto via PostgREST → usiamo una RPC creata ad-hoc.
        // Invece di richiedere migration, usiamo direttamente una select via REST custom:
        // chiamiamo postgres tramite "rpc" su una funzione SECURITY DEFINER definita altrove.
        // Per ora proviamo via REST schema 'cron' (potrebbe fallire se non esposto).
        const { data, error } = await supabaseAdmin.rpc("get_meta_sync_cron_history" as never);
        if (error) {
          return new Response(
            JSON.stringify({ ok: false, error: error.message, runs: [] as CronRun[] }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(
          JSON.stringify({ ok: true, runs: (data ?? []) as CronRun[] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
