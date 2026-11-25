/** ── «TRACCIAMENTO» NELLE IMPOSTAZIONI: LA ROTTA (api.crm.tracciamento.ts) ──────────
 *  Shop R1 · T30. Una rotta sottile: collega la guardia del CRM e il client del server al lavoro vero, che sta in
 *  `src/crm/tracciamento/salute.server.ts` (provato con un database finto).
 *
 *  GET → proprietario del tracciamento, ID presenti (sì/no), «modalità prova», stato degli ultimi invii dal server.
 *
 *  ⚠️ Permesso «impostazioni» su OGNI chiamata, lo stesso della pagina: il primo passo è la guardia. Nessuna
 *   intestazione CORS: stessa origine. Sola lettura. La chiave di servizio c'è solo nell'ambiente del server.
 *  ⚠️ Nei registri solo codici. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { gestisciGET, type DipendenzeSalute } from "@/crm/tracciamento/salute.server";
import { guardiaCRM } from "./api.crm.accesso";

const dipendenze: DipendenzeSalute = {
  guardia: async (request) => {
    const g = await guardiaCRM(request, {}, "impostazioni");
    return g.ok ? { ok: true, utenteId: g.chi.adminUserId } : g;
  },
  db: supabaseAdmin as unknown as DipendenzeSalute["db"],
  adesso: () => new Date(),
  log: (codice) => console.warn(`[tracciamento] ${codice}`),
};

export const Route = createFileRoute("/api/crm/tracciamento")({
  server: {
    handlers: {
      GET: ({ request }) => gestisciGET(request, dipendenze),
    },
  },
});
