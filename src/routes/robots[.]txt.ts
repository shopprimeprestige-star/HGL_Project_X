/** ── ROBOTS.TXT ─────────────────────────────────────────────────────────────
 *  Prima non c'era: l'indirizzo rispondeva con la pagina «non trovata».
 *  Il contenuto lo decide `seo/regole.ts` (con le ragioni di cosa si blocca e
 *  cosa no); qui c'è solo la risposta. */
import { createFileRoute } from "@tanstack/react-router";
import { robotsTxt, SITO } from "@/seo/regole";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () =>
        new Response(robotsTxt(SITO), {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        }),
    },
  },
});
