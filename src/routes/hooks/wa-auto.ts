/** ─────────────────────────────────────────────────────────────────────────
 *  WHATSAPP AUTOMATICO AI LEAD — IL GIRO DEL MINUTO
 *
 *  POST /hooks/wa-auto, chiamato da pg_cron ogni minuto (migrazione
 *  `wa_automatico_cron`) con l'intestazione Authorization che porta la chiave
 *  pubblicabile di Supabase: la stessa guardia di `/hooks/meta-lead-sync`.
 *
 *  Tutto il lavoro sta in `crm/wa-auto-invio.server.ts` (e le regole in
 *  `crm/wa-auto-regole.ts`). Qui si fa solo: guardia, orologio, risposta.
 *  Finché `whatsapp_settings.auto_attivo` è falso il giro non fa niente; con
 *  `auto_simulato` vero (di serie) scrive il registro e non manda nulla.
 *
 *  La risposta non porta né telefoni né token: solo conteggi e motivi.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chiaveGiroValida, eseguiGiro, type DbWa } from "@/crm/wa-auto-invio.server";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/hooks/wa-auto")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const attesa = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!chiaveGiroValida(auth, attesa)) return json({ error: "unauthorized" }, 401);

        try {
          const esito = await eseguiGiro({
            db: supabaseAdmin as unknown as DbWa,
            fetchFn: fetch,
            adesso: new Date(),
          });
          return json(esito, esito.ok ? 200 : 500);
        } catch (e) {
          console.error("[wa-auto] giro non riuscito", e instanceof Error ? e.name : "sconosciuto");
          return json({ ok: false, error: "giro non riuscito" }, 500);
        }
      },
    },
  },
});
