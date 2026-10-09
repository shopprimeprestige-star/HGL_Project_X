import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Cron hook: aggiorna i tassi di cambio rispetto a EUR usando l'API gratuita Frankfurter.
 * Schedulato ogni 24h via pg_cron + pg_net.
 * Auth: Bearer token (anon o service role) — usato per creare un client Supabase RLS-compliant.
 * NB: scrittura su exchange_rates passa via service role key configurata server-side.
 */
const FRANKFURTER_URL = "https://api.frankfurter.dev/v1/latest?base=EUR";

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string; // YYYY-MM-DD
  rates: Record<string, number>;
}

export const Route = createFileRoute("/hooks/fx-rates")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization")?.replace("Bearer ", "");
        if (!auth) {
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Per scrivere serve il service role key, perché RLS blocca le scritture client.
        const supabaseUrl =
          process.env.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL!;
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) {
          return new Response(
            JSON.stringify({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        // Fetch dei tassi
        const fxRes = await fetch(FRANKFURTER_URL);
        if (!fxRes.ok) {
          return new Response(
            JSON.stringify({ error: `frankfurter ${fxRes.status}` }),
            { status: 502, headers: { "Content-Type": "application/json" } },
          );
        }
        const fx = (await fxRes.json()) as FrankfurterResponse;

        const supabase = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const rows = Object.entries(fx.rates).map(([currency, rate]) => ({
          rate_date: fx.date,
          currency,
          rate_vs_eur: rate,
          fetched_at: new Date().toISOString(),
        }));

        // Includiamo anche EUR=1 per coerenza
        rows.push({
          rate_date: fx.date,
          currency: "EUR",
          rate_vs_eur: 1,
          fetched_at: new Date().toISOString(),
        });

        const { error } = await supabase
          .from("exchange_rates")
          .upsert(rows, { onConflict: "rate_date,currency" });

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(
          JSON.stringify({ ok: true, date: fx.date, currencies: rows.length }),
          { headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
