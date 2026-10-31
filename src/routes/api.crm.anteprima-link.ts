/** L'interruttore «Anteprima dei link nei messaggi manuali (invio diretto a Meta)».
 *
 *  Commessa 2026-10-31-anteprima-link. Il riquadro in Impostazioni → WhatsApp parla solo con questa rotta:
 *   · GET  → `{ acceso, chiavi }`: l'interruttore (riga `anteprima_link_manuali` di `app_config`) e se
 *            le chiavi Meta (token e phone_number_id) ci sono. Mai le chiavi, solo sì/no;
 *   · POST `{ acceso: boolean }` → accende o spegne. Accendere senza le chiavi è rifiutato (422);
 *            spegnere si può sempre.
 *
 *  ⚠️ DIETRO `guardiaCRM` COL PERMESSO «impostazioni»: col PIN la sessione Supabase è quella del
 *   proprietario per tutti, quindi la scrittura NON parte dal browser (vedi PromemoriaWhatsappPannello).
 *  ⚠️ Spento di serie: senza la riga, o con un valore diverso da «on», i manuali con link partono da
 *   ManyChat come prima. Nei log solo codici: mai chiavi, numeri o testi. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { guardiaCRM } from "./api.crm.accesso";
import { CHIAVE_ANTEPRIMA_LINK } from "@/crm/manychat/porta";
import { anteprimaLinkAcceso, chiaviAnteprimaPresenti } from "@/crm/manychat/porta.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-crm-token",
};

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const FRASE_TITOLARE = "Non si sa di quale installazione si parla: rientra nel CRM.";
const FRASE_SENZA_CHIAVI =
  "Mancano le chiavi di Meta (token e Phone Number ID): inseriscile in «WhatsApp Cloud API (Meta)» e riprova.";

/** Un guasto del database: nei log solo il codice. */
function guasto(e: unknown) {
  const code = (e as { code?: unknown } | null)?.code;
  console.warn("[anteprima-link]", typeof code === "string" ? code : "errore");
  return json({ error: "Il server ha avuto un problema: riprova fra poco." }, 500);
}

export const Route = createFileRoute("/api/crm/anteprima-link")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        if (!g.chi.adminUserId) return json({ error: FRASE_TITOLARE }, 403);
        try {
          const [acceso, chiavi] = await Promise.all([
            anteprimaLinkAcceso(),
            chiaviAnteprimaPresenti(g.chi.adminUserId),
          ]);
          return json({ acceso, chiavi });
        } catch (e) {
          return guasto(e);
        }
      },

      POST: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        if (!g.chi.adminUserId) return json({ error: FRASE_TITOLARE }, 403);
        let corpo: { acceso?: unknown } | null;
        try {
          corpo = (await request.json()) as typeof corpo;
        } catch {
          return json({ error: "Richiesta non valida." }, 400);
        }
        if (typeof corpo?.acceso !== "boolean")
          return json({ error: "Richiesta non valida." }, 400);
        try {
          //  Accendere solo con le chiavi presenti; spegnere sempre.
          const chiavi = await chiaviAnteprimaPresenti(g.chi.adminUserId);
          if (corpo.acceso && !chiavi) return json({ error: FRASE_SENZA_CHIAVI }, 422);
          const { error } = await supabaseAdmin.from("app_config").upsert(
            {
              key: CHIAVE_ANTEPRIMA_LINK,
              value: corpo.acceso ? "on" : "off",
              updated_at: new Date().toISOString(),
            } as never,
            { onConflict: "key" },
          );
          if (error) throw error;
          return json({ acceso: corpo.acceso, chiavi });
        } catch (e) {
          return guasto(e);
        }
      },
    },
  },
});
