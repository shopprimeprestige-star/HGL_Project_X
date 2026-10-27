/** ── PRENOTA LA CONSULENZA IN CHAT, DA MANYCHAT AL CRM ──────────────────────
 *
 *  POST /api/public/manychat-prenota. Lo chiama una External Request di un
 *  flusso ManyChat quando il lead risponde «sera» o tocca «Opzione 2». Il corpo
 *  e la risposta (`{ ok, esito, testo }`) sono descritti in
 *  `crm/manychat/prenota-tipi.ts`; la logica sta in `crm/manychat/prenota.ts`,
 *  provata. Qui c'è solo il collegamento.
 *
 *  ⚠️ PUBBLICA: la protegge `X-HGL-Token` contro il segreto
 *   `MANYCHAT_RITORNO_TOKEN` (503 se il segreto manca, 401 se la chiave è
 *   sbagliata, 413 oltre 8 KB). Il corpo si legge solo dopo la chiave giusta.
 *   Il segreto sta solo nei segreti del Worker.
 *  ⚠️ NON CHIAMA MAI MANYCHAT: risponde nella stessa richiesta, con il testo
 *   che il flusso manda al lead.
 *  ⚠️ Nei log solo codici: mai numero, nome, testo o id del contatto.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { gestisciRichiestaPrenota } from "@/crm/manychat/prenota";
import { portePrenota } from "@/crm/manychat/prenota.server";

export const Route = createFileRoute("/api/public/manychat-prenota")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { response, esito } = await gestisciRichiestaPrenota(portePrenota(), {
          request,
          segreto: process.env.MANYCHAT_RITORNO_TOKEN,
          adesso: new Date(),
        });
        if (esito) console.info(`[manychat-prenota] ${response.status} ${esito}`);
        return response;
      },
    },
  },
});
