/** ─────────────────────────────────────────────────────────────────────────
 *  LEGGERE UN MEDIA DEL PONTE WHATSAPP (LINK A TEMPO)
 *
 *  Commessa 2026-10-30-ponte-storico-completo, compito T5 (PIANO c.3 punto 4),
 *  estesa il 31/10 (commessa 2026-10-31-media-e-archiviazione, compito T2).
 *  GET /api/crm/ponte-media?id=<uuid>.<ext>[&uso=vedi|video|apri] → { ok:true, url }
 *  con un link di Storage che vale 300 secondi (il video 1.800), oppure
 *  { ok:false, motivo } con lo stato HTTP del motivo (400, 403, 404, 500, 503).
 *  Senza `uso` vale «vedi» (foto e vocali): la chiamata di prima non cambia.
 *  `uso` è verificato contro la categoria della riga; `Content-Disposition`
 *  (PDF inline, il resto allegato) lo decide il server dal mime, mai il browser. `id` è il nome casuale del file in
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
        const url = new URL(request.url);
        const r = await gestisciLettura(porteMedia(), {
          adminUserId: g.chi.adminUserId,
          id: url.searchParams.get("id"),
          uso: url.searchParams.get("uso"),
        });
        return json(r.corpo, r.stato);
      },
    },
  },
});
