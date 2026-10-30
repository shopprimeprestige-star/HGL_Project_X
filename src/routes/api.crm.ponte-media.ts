/** ─────────────────────────────────────────────────────────────────────────
 *  LEGGERE UNA FOTO DEL PONTE WHATSAPP (LINK A TEMPO)
 *
 *  Commessa 2026-10-30-ponte-storico-completo, compito T5 (PIANO c.3 punto 4).
 *  GET /api/crm/ponte-media?id=<uuid>.<ext> → { ok:true, url } con un link di
 *  Storage che vale 300 secondi, oppure { ok:false, motivo } con lo stato HTTP
 *  del motivo (400, 403, 404, 500, 503). `id` è il nome casuale del file in
 *  Storage: nell'indirizzo (e quindi nei log di accesso) non c'è il numero del
 *  cliente. 503 `storage` = guasto passeggero di Storage (la chat lascia Riprova). La logica sta in
 *  `crm/ponte/media.ts` (provata con porte finte); la foto la carica il Mac,
 *  qui si LEGGE soltanto.
 *
 *  ⚠️ Con `supabaseAdmin` la RLS non vale: la rotta verifica la sessione
 *   (`guardiaCRM`) e che l'installazione della sessione sia quella del database
 *   (`gestisciLettura`, 403 altrimenti). La riga si cerca per quell'utente: la
 *   foto di un altro è «non trovata».
 *  ⚠️ Chi può usarlo: chiunque sia entrato nel CRM, come la chat
 *   (`guardiaCRM(request, cors, null)`): chi vede le chat vede le foto.
 *  ⚠️ `Cache-Control: no-store` sempre: il link firmato non deve restare in una cache.
 *  ⚠️ Nei log solo codici e contatori: mai numeri, chiavi, percorsi, link.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { guardiaCRM } from "./api.crm.accesso";
import { gestisciLettura } from "@/crm/ponte/media";
import { porteMedia } from "@/crm/ponte/media.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-crm-token",
};

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/crm/ponte-media")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const g = await guardiaCRM(request, cors, null);
        if (!g.ok) return g.risposta;
        const r = await gestisciLettura(porteMedia(), {
          adminUserId: g.chi.adminUserId,
          id: new URL(request.url).searchParams.get("id"),
        });
        return json(r.corpo, r.stato);
      },
    },
  },
});
