/** ── SHOP · IL PERMESSO A BREVE SCADENZA PER GLI EVENTI (T25) ──────────────────────
 *  GET -> { ok, permesso }   (10 minuti, firmato: src/lib/tracciamento/permesso.ts)
 *
 *  È un attrito, non un'autenticazione: chiunque può chiederlo. Senza chiave di servizio risponde 503. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SITO } from "@/lib/sito";
import { gestisciPermesso, type DepsMittente } from "@/lib/tracciamento/mittente";

const json = (o: unknown, status: number) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/public/evento-permesso")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ip = request.headers.get("cf-connecting-ip") || (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
        const deps: DepsMittente = {
          db: supabaseAdmin as unknown as DepsMittente["db"],
          adesso: () => Date.now(),
          fetch: (url, init) => fetch(url, init),
          chiave: process.env.SUPABASE_SERVICE_ROLE_KEY,
          log: (codice) => console.log("[evento-permesso]", codice),
          sito: SITO,
        };
        const r = await gestisciPermesso({ ip }, deps);
        return json(r.corpo, r.stato);
      },
    },
  },
});
