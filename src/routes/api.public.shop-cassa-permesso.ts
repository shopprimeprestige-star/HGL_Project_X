/** ── SHOP · IL PERMESSO DELLA CASSA (T57, PIANO-R2 §3.1) ───────────────────────────────────────────────────────
 *  GET → { ok, permesso }   (firmato, vale da 3 secondi a 30 minuti; 503 con la cassa chiusa)
 *
 *  Una rotta sottile: collega `supabaseAdmin`, le chiavi dell'ambiente (lette dentro il gestore, in `collega.server.ts`), `cf-connecting-ip`
 *  e la costante `SITO` a `gestisciPermesso` (T51), che decide. Nessuna intestazione CORS: la chiama solo il sito stesso.
 *  È un attrito, non un'autenticazione. Nei log solo codici. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { gestisciPermesso, type DbCassaServer } from "@/shop/cassa/cassa.server";
import { porteCassa } from "@/shop/cassa/collega.server";
import { cassaEffettivaDelServer } from "@/shop/cms/cassa-sito.functions";

const json = (o: unknown, stato: number) =>
  new Response(JSON.stringify(o), { status: stato, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/public/shop-cassa-permesso")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const r = await gestisciPermesso(
            porteCassa({
              db: supabaseAdmin as unknown as DbCassaServer,
              richiesta: request,
              cassa: async () => (await cassaEffettivaDelServer()).cassa,
              tariffa: async () => ({ stato: "assente" }), // il permesso non calcola niente
              log: (codice) => console.warn(`[shop-cassa-permesso] ${codice}`),
            }),
          );
          return json(r.corpo, r.stato);
        } catch {
          console.warn("[shop-cassa-permesso] eccezione");
          return json({ ok: false, motivo: "guasto" }, 500);
        }
      },
    },
  },
});
