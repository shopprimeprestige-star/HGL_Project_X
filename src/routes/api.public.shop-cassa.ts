/** ── SHOP · LA CASSA STRIPE (T57, PIANO-R2 §3.1, D66) ──────────────────────────────────────────────────────────
 *  POST { permesso, tentativo, totaleAttesoCent, righe, contatti, spedizione, … } → { ok:true, url } | { ok:false, motivo, frase, … }
 *  POST { azione: "riprova", ref, t, permesso }                                  → il «Riprova il pagamento» di D66
 *
 *  Una rotta sottile: collega `supabaseAdmin`, il client di Stripe (la chiave si legge dentro il gestore, in `collega.server.ts`),
 *  `cf-connecting-ip`, la tariffa del server e la costante `SITO` a `gestisciCassa` (T51), che legge il corpo (tetto 32 KB prima del
 *  parsing), decide e non lancia mai. Cassa chiusa = nessuna chiamata a database e Stripe.
 *  Nessuna intestazione CORS: la chiama solo il sito stesso. Risposte `no-store`. Nei log solo codici. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { gestisciCassa, type DbCassaServer } from "@/shop/cassa/cassa.server";
import { porteCassa } from "@/shop/cassa/collega.server";
import { tariffaSpedizione as leggiTariffa, type DbTariffe } from "@/shop/cassa/tariffe.server";
import { cassaEffettivaDelServer } from "@/shop/cms/cassa-sito.functions";

const json = (o: unknown, stato: number) =>
  new Response(JSON.stringify(o), {
    status: stato,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/public/shop-cassa")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const cassa = async () => (await cassaEffettivaDelServer()).cassa;
          const r = await gestisciCassa(
            request,
            porteCassa({
              db: supabaseAdmin as unknown as DbCassaServer,
              richiesta: request,
              cassa,
              tariffa: () =>
                leggiTariffa({
                  db: supabaseAdmin as unknown as DbTariffe,
                  adesso: () => Date.now(),
                  cassa,
                  log: (codice) => console.warn(`[shop-cassa] ${codice}`),
                }),
              log: (codice) => console.warn(`[shop-cassa] ${codice}`),
            }),
          );
          return json(r.corpo, r.stato);
        } catch {
          console.warn("[shop-cassa] eccezione");
          return json(
            {
              ok: false,
              motivo: "guasto",
              frase: "Non siamo riusciti ad aprire il pagamento: riprova tra poco.",
            },
            500,
          );
        }
      },
    },
  },
});
