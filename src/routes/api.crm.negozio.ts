/** ── IL CMS DEL NEGOZIO: LA ROTTA (api.crm.negozio.ts) ──────────────────────
 *  Commessa 2026-11-20-shop-completo (T10). Una rotta sottile, come `api.crm.ordini.ts`: collega la guardia del CRM e il client
 *  del server allo smistamento `src/crm/negozio/smista.server.ts`, dove sta tutto (ed è provato con un database finto).
 *
 *  GET  ?prodotti · ?prodotto=<id> · ?categorie · ?interruttori
 *  POST { azione, … }  → prodotti, varianti, media, stato (T08); giacenza, categorie, foto di categoria, interruttori (T09)
 *
 *  ⚠️ Permesso «pagamenti» su OGNI chiamata: la guardia è la prima cosa che lo smistamento fa (prima di leggere il corpo).
 *   Nessuna intestazione CORS: stessa origine.
 *  ⚠️ La chiave di servizio c'è solo nell'ambiente del server (client `supabaseAdmin`, e `process.env` del Worker per la chiave
 *   dell'anteprima): mai nel codice. Nei log solo codici. Nessun gestore cancella niente (tranne il legame prodotto-categoria, in `categorie.server.ts`). */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { gestisciGET, gestisciPOST, type ClienteDbNegozio, type DipendenzeNegozio } from "@/crm/negozio/smista.server";
import { guardiaCRM } from "./api.crm.accesso";

const dipendenze: DipendenzeNegozio = {
  guardia: async (request) => {
    //  `extra`: la forma che il client si aspetta anche quando la risposta è un «no».
    const g = await guardiaCRM(request, {}, "pagamenti", { extra: { prodotti: [] } });
    return g.ok ? { ok: true, nome: g.chi.nome } : g;
  },
  db: supabaseAdmin as unknown as ClienteDbNegozio,
  adesso: () => new Date(),
  //  ⚠️ Solo codici: mai l'oggetto errore, mai testi del titolare.
  log: (codice) => console.warn(`[negozio] ${codice}`),
  chiaveServizio: () => process.env.SUPABASE_SERVICE_ROLE_KEY,
  //  Il banner dei cookie non si sa ancora verificare da qui (arriva con T27 e con il rilascio della cassa): «non valutabile»,
  //  quindi lo shop non si può aprire. Quando il banner è nel sito si passa il valore vero; i fatti del R2 si aggiungono allora.
  fattiEsterni: () => ({ bannerPresente: null }),
};

export const Route = createFileRoute("/api/crm/negozio")({
  server: {
    handlers: {
      GET: ({ request }) => gestisciGET(request, dipendenze),
      POST: ({ request }) => gestisciPOST(request, dipendenze),
    },
  },
});
