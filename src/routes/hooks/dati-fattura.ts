/** ── IL GIRO «DATI PER LA FATTURA» (30/10/2026) ─────────────────────────────
 *
 *  Ogni 5 minuti (pg_cron, migrazione `dati_fattura`): chiede i dati per la fattura a
 *  chi ha versato un acconto (una volta sola) e, a chi ha risposto con una foto o con
 *  un testo coi dati, prepara la BOZZA di fattura. Regole: crm/fatture/dati-fattura*.
 *
 *  ⚠️ SPENTO di base: lo accende il titolare da Impostazioni (`/api/crm/dati-fattura`).
 *  ⚠️ Mai una fattura confermata o inviata allo SdI: solo bozze.
 *  ⚠️ Auth come gli altri hook (chiave pubblicabile); la risposta ha solo conteggi.
 *  ⚠️ Nei log solo codici: mai nomi, numeri, testi o dati letti.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { giroDatiFattura } from "@/crm/fatture/dati-fattura-giro";
import { porteDatiFatturaVere } from "@/crm/fatture/dati-fattura.server";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/hooks/dati-fattura")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const attesa = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!auth || !auth.includes(attesa || "__mancante__"))
          return json({ error: "unauthorized" }, 401);
        try {
          return json(await giroDatiFattura(porteDatiFatturaVere()));
        } catch (e) {
          const code = (e as { code?: unknown } | null)?.code;
          console.error("[dati-fattura]", typeof code === "string" ? code : "errore");
          return json({ error: "giro interrotto" }, 500);
        }
      },
    },
  },
});
