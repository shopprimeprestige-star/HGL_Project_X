/** ── SHOP · IL WEBHOOK DI STRIPE (T57, PIANO-R2 §3.2, D45) ─────────────────────────────────────────────────────
 *  POST (corpo grezzo di Stripe, intestazione `Stripe-Signature`) → 200 | 400 firma sbagliata | 413 | 503 senza segreto | 500 (Stripe ritenta)
 *
 *  La rotta NON tocca il corpo: lo legge `gestisciWebhook` (T52) in byte, a pezzi e fermandosi al tetto (1 MB), e solo dopo la firma lo
 *  interpreta. (Il piano diceva `request.arrayBuffer()`: leggerebbe tutto prima di controllare il tetto, contro la regola «413 prima del
 *  parsing» del capo progetto, W3 n. 2.) Segreto e chiave di Stripe si leggono a ogni richiesta (in `collega.server.ts`); l'email e il
 *  metodo di pagamento partono DOPO la risposta (`waitUntil` di Cloudflare se c'è, altrimenti attesa con tetto di 8 s).
 *  Nessuna intestazione CORS: lo chiama solo Stripe. Risposte `no-store`. Solo POST. Nei log solo codici. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ClienteDb } from "@/crm/negozio/comune";
import { porteWebhook } from "@/shop/cassa/collega.server";
import { gestisciWebhook, type DbWebhook } from "@/shop/cassa/webhook.server";

const json = (o: unknown, stato: number) =>
  new Response(JSON.stringify(o), {
    status: stato,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const porte = await porteWebhook({
            db: supabaseAdmin as unknown as DbWebhook & ClienteDb,
            log: (codice) => console.warn(`[stripe-webhook] ${codice}`),
          });
          return await gestisciWebhook(request, porte);
        } catch {
          console.warn("[stripe-webhook] eccezione");
          return json({ ok: false }, 500); // Stripe ritenta
        }
      },
    },
  },
});
