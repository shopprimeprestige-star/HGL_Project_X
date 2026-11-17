/** ── GLI ORDINI DELL'E-COMMERCE: LA ROTTA (api.crm.ordini.ts) ───────────────
 *  Commessa 2026-11-17-crm-ecommerce (T9). Una rotta sottile: collega la guardia del CRM e il client del
 *  server al magazzino `ordini.server.ts`, dove sta tutto il lavoro (ed è provato con un database finto).
 *
 *  GET                  → elenco degli ordini
 *  GET ?conta=1         → quanti ordini «nuovo» (il numeretto del menu)
 *  GET ?lead=id1,id2    → gli ordini di quelle schede (max 20)
 *  GET ?storico=<id>    → lo storico di un ordine
 *  POST { azione, … }   → stato, pagato, pagamento_annullato, tracking, nota_interna
 *
 *  ⚠️ Permesso «pagamenti» su OGNI chiamata: il primo passo di GET e POST (dentro `gestisciGET`/`gestisciPOST`)
 *   è `guardia`, cioè `guardiaCRM(request, {}, "pagamenti")`. Nessuna intestazione CORS: stessa origine.
 *  ⚠️ La chiave di servizio c'è solo nell'ambiente del server (client `supabaseAdmin`): mai nel codice.
 *  ⚠️ Nei log solo codici. Nessun gestore cancella niente. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  gestisciGET,
  gestisciPOST,
  type ClienteDb,
  type DipendenzeOrdini,
} from "@/crm/ecommerce/ordini.server";
import { guardiaCRM } from "./api.crm.accesso";

const dipendenze: DipendenzeOrdini = {
  guardia: async (request) => {
    //  `extra`: la forma che il client si aspetta anche quando la risposta è un «no».
    const g = await guardiaCRM(request, {}, "pagamenti", { extra: { ordini: [] } });
    return g.ok ? { ok: true, nome: g.chi.nome } : g;
  },
  db: supabaseAdmin as unknown as ClienteDb,
  adesso: () => new Date(),
  //  ⚠️ Solo codici: mai l'oggetto errore, mai id o testi del cliente.
  log: (codice) => console.warn(`[ordini] ${codice}`),
};

export const Route = createFileRoute("/api/crm/ordini")({
  server: {
    handlers: {
      GET: ({ request }) => gestisciGET(request, dipendenze),
      POST: ({ request }) => gestisciPOST(request, dipendenze),
    },
  },
});
