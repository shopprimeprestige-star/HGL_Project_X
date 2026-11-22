/** ── LE EMAIL DELLO SHOP: LA ROTTA (api.crm.negozio-email.ts) ────────────────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T57 (PIANO-R2 §3.5, D53). Una rotta sottile come `api.crm.negozio.ts`: collega la guardia
 *  del CRM e il client del server al modulo `src/crm/negozio/email.server.ts` (T54), dove sta tutto ed è provato con un database finto.
 *
 *  GET  ?modelli
 *  POST { azione: "modello_salva" | "modello_approva" | "modello_acceso" | "anteprima", … }
 *
 *  ⚠️ Permesso «impostazioni» su OGNI chiamata (i testi che arrivano ai clienti li cambia chi può cambiare le impostazioni): la guardia
 *   è la prima cosa che il modulo fa. «Invia ora» e lo stato per ordine restano di «pagamenti» (`api.crm.ordini`). Nessuna intestazione CORS.
 *  ⚠️ La chiave di servizio c'è solo nel client `supabaseAdmin`. Nei log solo codici. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { gestisciGET, gestisciPOST } from "@/crm/negozio/email.server";
import type { ClienteDb, PorteDb } from "@/crm/negozio/comune";
import { guardiaCRM } from "./api.crm.accesso";

const dipendenze: PorteDb = {
  guardia: async (request) => {
    //  `extra`: la forma che il client si aspetta anche quando la risposta è un «no».
    const g = await guardiaCRM(request, {}, "impostazioni", { extra: { modelli: [] } });
    return g.ok ? { ok: true, nome: g.chi.nome } : g;
  },
  db: supabaseAdmin as unknown as ClienteDb,
  adesso: () => new Date(),
  //  ⚠️ Solo codici: mai l'oggetto errore, mai testi del titolare.
  log: (codice) => console.warn(`[negozio-email] ${codice}`),
};

export const Route = createFileRoute("/api/crm/negozio-email")({
  server: {
    handlers: {
      GET: ({ request }) => gestisciGET(request, dipendenze),
      POST: ({ request }) => gestisciPOST(request, dipendenze),
    },
  },
});
