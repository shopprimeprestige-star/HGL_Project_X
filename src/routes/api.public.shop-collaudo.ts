/** ── SHOP · IL COLLAUDO CON CHIAVE: LA CHIAVE DIVENTA COOKIE (T67, PIANO-R2 D57) ────────────────────────────────
 *  POST { k } → 200 { ok:true } con `Set-Cookie: __Host-hgl_collaudo=…` · ogni rifiuto: 403 { ok:false }, UGUALE per ogni motivo
 *
 *  Una rotta sottile: collega la chiave di servizio (letta dentro il gestore, a ogni richiesta), l'orologio e il log a
 *  `gestisciCollaudo` (`src/shop/cms/collaudo.ts`, provato), che verifica la chiave (HMAC, 2 ore) e mette il cookie (4 ore).
 *  La chiave arriva nel CORPO di un POST, mai in un indirizzo: non finisce nei log di Cloudflare né nel referrer.
 *  Nessuna intestazione CORS: la chiama solo il sito stesso. Risposte `no-store`. Nei log solo codici. */
import { createFileRoute } from "@tanstack/react-router";
import { gestisciCollaudo } from "@/shop/cms/collaudo";

export const Route = createFileRoute("/api/public/shop-collaudo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return await gestisciCollaudo(request, {
            segreto: () => process.env.SUPABASE_SERVICE_ROLE_KEY,
            adesso: () => Date.now(),
            log: (codice) => console.warn(`[shop-collaudo] ${codice}`),
          });
        } catch {
          console.warn("[shop-collaudo] eccezione");
          return new Response(JSON.stringify({ ok: false }), {
            status: 403,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
          });
        }
      },
    },
  },
});
