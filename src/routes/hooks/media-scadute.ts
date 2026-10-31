/** ── IL GIRO DEI MEDIA SCADUTI (commessa 2026-10-31-media-e-archiviazione, T3) ─
 *
 *  Ogni minuto (pg_cron, migrazione `20261031140000_ponte_media_cron`): libera i
 *  media del ponte con il timer scaduto (`stato='pronta'` e `scade_il` passato):
 *  toglie il file da Storage e poi segna `liberato` (il messaggio resta col
 *  segnaposto). Ai minuti 0 e 30 fa anche le pulizie e toglie gli oggetti orfani
 *  (rimozioni fallite). La regola è in `crm/ponte/media-azioni.ts` (`giroScadute`,
 *  provata con porte finte).
 *
 *  COME LO SI CHIAMA
 *  POST /hooks/media-scadute con Authorization che porta la chiave pubblicabile,
 *  come gli altri hook: chi ce l'ha può solo anticipare un giro che il cron farebbe
 *  comunque, e agisce su righe già scadute. Risponde con soli conteggi
 *  `{ ok, liberati, orfani, non_riusciti }` (stato 500 se un passo ha avuto un guasto).
 *  ⚠️ Senza le migrazioni A e B il giro dà 500 e un codice nel log: nessuno chiama la
 *   rotta finché non c'è la C. Ogni passo è idempotente: un giro interrotto lo rifà il minuto dopo.
 *  ⚠️ Nei log solo codici e conteggi, mai chiavi, numeri o percorsi.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { giroScadute } from "@/crm/ponte/media-azioni";
import { porteMediaAzioni } from "@/crm/ponte/media-azioni.server";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/hooks/media-scadute")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const attesa = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!auth || !auth.includes(attesa || "__mancante__"))
          return json({ error: "unauthorized" }, 401);
        try {
          const r = await giroScadute(porteMediaAzioni(), new Date());
          return json(r, r.ok ? 200 : 500);
        } catch (e) {
          const code = (e as { code?: unknown } | null)?.code;
          console.error("[media-scadute]", typeof code === "string" ? code : "errore");
          return json({ ok: false, error: "giro interrotto" }, 500);
        }
      },
    },
  },
});
