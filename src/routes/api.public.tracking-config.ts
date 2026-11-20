/** ── SHOP · GLI ID PUBBLICI DEI PIXEL (T25) ────────────────────────────────────────
 *  GET -> { meta: {pixelId}|null, tiktok: {pixelId}|null, google: {ga4Id, adsId, adsLabelAcquisto}|null }
 *
 *  Solo ID pubblici, mai token né codici di prova. Legge la riga più recente con almeno un ID (D33, vedi
 *  src/lib/tracciamento/config-pubblica.ts) e la tiene in memoria 5 minuti. Se non c'è niente, o la lettura
 *  non riesce, risponde tutto `null`: il sito semplicemente non carica pixel. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { creaLettoreConfig } from "@/lib/tracciamento/config-pubblica";

const leggi = creaLettoreConfig(supabaseAdmin as unknown as Parameters<typeof creaLettoreConfig>[0], () => Date.now());

export const Route = createFileRoute("/api/public/tracking-config")({
  server: {
    handlers: {
      GET: async () =>
        new Response(JSON.stringify(await leggi()), {
          status: 200,
          headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" },
        }),
    },
  },
});
