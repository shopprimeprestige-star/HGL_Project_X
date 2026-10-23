/** ── LA RISPOSTA DEL CLIENTE, DA MANYCHAT AL CRM ───────────────────────────
 *
 *  POST /api/public/manychat-risposta. Lo chiama una External Request di un
 *  flusso ManyChat (e la Default Reply) quando il cliente risponde. Il corpo e
 *  la chiave sono descritti in `crm/manychat/ritorno.ts`; la logica sta in
 *  `crm/manychat/risposta.ts`, provata. Qui c'è solo il collegamento.
 *
 *  ⚠️ PUBBLICA: la protegge `X-HGL-Token` contro il segreto
 *   `MANYCHAT_RITORNO_TOKEN` (503 se il segreto manca, 401 se la chiave è
 *   sbagliata, 413 oltre 8 KB). Il segreto sta solo nei segreti del Worker.
 *  ⚠️ NON CHIAMA MAI MANYCHAT. A una richiesta autorizzata risponde `{ok:true}`.
 *  ⚠️ Nei log solo codici: mai numero, nome, testo o id del contatto.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { gestisciRichiesta } from "@/crm/manychat/risposta";
import { porteRisposta } from "@/crm/manychat/porte.server";

export const Route = createFileRoute("/api/public/manychat-risposta")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { response, esito } = await gestisciRichiesta(porteRisposta(), {
          request,
          segreto: process.env.MANYCHAT_RITORNO_TOKEN,
          adesso: new Date(),
        });
        if (esito) console.info(`[manychat-risposta] ${response.status} ${esito}`);
        return response;
      },
    },
  },
});
