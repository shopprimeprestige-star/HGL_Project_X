/** ── SHOP · UN EVENTO DI NAVIGAZIONE DAL BROWSER AL SERVER (T25) ────────────────────
 *  POST { nome, eventId, permesso, percorso, query, dati, consenso:true } -> { ok }
 *
 *  La rotta è sottile: legge il corpo e le intestazioni (IP e user agent vengono SOLO da lì) e passa tutto a
 *  `gestisciEvento` (src/lib/tracciamento/mittente.ts), che decide. Risponde solo `{ok}` e un codice: mai un errore
 *  dettagliato, mai un token. Nessuna intestazione CORS: la chiama solo il sito stesso. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SITO } from "@/lib/sito";
import { gestisciEvento, type DepsMittente } from "@/lib/tracciamento/mittente";

const json = (o: unknown, status: number) =>
  new Response(JSON.stringify(o), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/public/evento")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const testo = await request.text();
        if (testo.length > 8000) return json({ ok: false }, 400);
        let corpo: unknown = null;
        try {
          corpo = JSON.parse(testo);
        } catch {
          /* corpo rotto: lo rifiuta gestisciEvento */
        }
        const ip = request.headers.get("cf-connecting-ip") || (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
        const deps: DepsMittente = {
          db: supabaseAdmin as unknown as DepsMittente["db"],
          adesso: () => Date.now(),
          fetch: (url, init) => fetch(url, init),
          chiave: process.env.SUPABASE_SERVICE_ROLE_KEY,
          log: (codice) => console.log("[evento]", codice),
          sito: SITO,
        };
        const r = await gestisciEvento({ corpo, ip, userAgent: request.headers.get("user-agent") ?? "" }, deps);
        return json(r.corpo, r.stato);
      },
    },
  },
});
