/** ── GLI ORDINI DELL'E-COMMERCE: LA ROTTA (api.crm.ordini.ts) ───────────────
 *  Commessa 2026-11-17-crm-ecommerce (T9). Una rotta sottile: collega la guardia del CRM e il client del
 *  server al magazzino `ordini.server.ts`, dove sta tutto il lavoro (ed è provato con un database finto).
 *
 *  GET                  → elenco degli ordini
 *  GET ?conta=1         → quanti ordini «nuovo» (il numeretto del menu)
 *  GET ?lead=id1,id2    → gli ordini di quelle schede (max 20)
 *  GET ?storico=<id>    → lo storico di un ordine
 *  GET ?dettaglio=<id>  → l'ordine con riservati, rimborsi, email e storico (R2)
 *  POST { azione, … }   → stato, pagato, pagamento_annullato, tracking, nota_interna; dal R2 spedisci, annulla, rimborso, riconcilia,
 *                         fattura_emessa, email_invia, giacenza_verificata, correggi_stato
 *
 *  ⚠️ Permesso «pagamenti» su OGNI chiamata: il primo passo di GET e POST (dentro `gestisciGET`/`gestisciPOST`)
 *   è `guardia`, cioè `guardiaCRM(request, {}, "pagamenti")`. Nessuna intestazione CORS: stessa origine.
 *  ⚠️ La chiave di servizio c'è solo nell'ambiente del server (client `supabaseAdmin`): mai nel codice. Dal R2 le porte `stripe` e `email`
 *   (rimborsi, «Controlla con Stripe», email) si costruiscono a ogni richiesta in `collega.server.ts`, che legge le chiavi dell'ambiente.
 *  ⚠️ Nei log solo codici. Nessun gestore cancella niente. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  gestisciGET,
  gestisciPOST,
  type ClienteDb,
  type DipendenzeOrdini,
} from "@/crm/ecommerce/ordini.server";
import type { ClienteDb as ClienteDbEmail } from "@/crm/negozio/comune";
import { clienteStripe, porteInvio } from "@/shop/cassa/collega.server";
import { creaPorteEmail } from "@/shop/email/invio.server";
import { guardiaCRM } from "./api.crm.accesso";

//  ⚠️ Solo codici: mai l'oggetto errore, mai id o testi del cliente.
const log = (codice: string) => console.warn(`[ordini] ${codice}`);

//  Le porte `stripe` ed `email` leggono le chiavi di ADESSO e si costruiscono DOPO la guardia, a ogni richiesta: chi non ha il permesso non
//  arriva nemmeno a toccare l'ambiente, e un guasto qui cade nel `try/catch` del modulo (risposta generica, nel log solo il nome del tipo).
//  Il modulo legge `d.stripe` e `d.email` solo dopo la guardia: è lo stesso oggetto.
const dipendenzeDi = (): DipendenzeOrdini => {
  const d: DipendenzeOrdini = {
    guardia: async (request) => {
      //  `extra`: la forma che il client si aspetta anche quando la risposta è un «no».
      const g = await guardiaCRM(request, {}, "pagamenti", { extra: { ordini: [] } });
      if (!g.ok) return g;
      d.stripe = clienteStripe();
      d.email = creaPorteEmail(porteInvio(supabaseAdmin as unknown as ClienteDbEmail, log));
      return { ok: true, nome: g.chi.nome };
    },
    db: supabaseAdmin as unknown as ClienteDb,
    adesso: () => new Date(),
    log,
  };
  return d;
};

export const Route = createFileRoute("/api/crm/ordini")({
  server: {
    handlers: {
      GET: ({ request }) => gestisciGET(request, dipendenzeDi()),
      POST: ({ request }) => gestisciPOST(request, dipendenzeDi()),
    },
  },
});
