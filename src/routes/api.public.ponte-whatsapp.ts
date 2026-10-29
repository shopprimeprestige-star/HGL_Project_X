/** ── IL PONTE WHATSAPP (Baileys), DAL MAC AL CRM ──────────────────────────
 *
 *  POST /api/public/ponte-whatsapp. Lo chiama il servizio sul Mac del
 *  titolare (`strumenti/ponte-whatsapp/`) con i lotti di messaggi e il
 *  battito. Il contratto è il §b del piano (`src/crm/ponte/tipi.ts`); la
 *  logica sta in `crm/ponte/ingresso.ts`, provata. Qui c'è solo il
 *  collegamento.
 *
 *  ⚠️ PUBBLICA: la protegge `X-HGL-Token` contro il segreto `PONTE_WA_TOKEN`
 *   (503 se manca o è più corto di 32 caratteri, 401 se la chiave è
 *   sbagliata, 413 oltre 256 KB, 400 corpo non valido, 500 database). Il
 *   segreto sta solo nei segreti del Worker e in `config.env` sul Mac.
 *  ⚠️ L'utente non arriva mai dal corpo: è `manychat_config.user_id`.
 *  ⚠️ Nei log solo codici e contatori (li scrive `porte.avviso`): mai numeri,
 *   nomi, testi o id.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { gestisciRichiesta } from "@/crm/ponte/ingresso";
import { porteIngresso } from "@/crm/ponte/porte.server";

export const Route = createFileRoute("/api/public/ponte-whatsapp")({
  server: {
    handlers: {
      POST: ({ request }) =>
        gestisciRichiesta(porteIngresso(), {
          request,
          segreto: process.env.PONTE_WA_TOKEN,
          adesso: new Date(),
        }),
    },
  },
});
