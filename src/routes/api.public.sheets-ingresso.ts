/** ── I LEAD DAL FOGLIO GOOGLE, DENTRO IL CRM ───────────────────────────────
 *
 *  POST /api/public/sheets-ingresso. Lo chiama lo script Apps Script del
 *  titolare (strumenti/google-sheets/ingresso-crm.gs) per ogni riga nuova del
 *  foglio dove Meta Lead Ads scrive i lead. Il corpo, i limiti e gli esiti sono
 *  descritti in `crm/sheets/ingresso.ts`; la logica sta lì, provata. Qui c'è
 *  solo il collegamento.
 *
 *  ⚠️ PUBBLICA: la protegge `X-HGL-Token` contro il segreto
 *   `SHEETS_INGRESSO_TOKEN` (503 se il segreto manca, 401 se la chiave è
 *   sbagliata, 413 oltre 8 KB). Il segreto sta solo nei segreti del Worker e
 *   nelle proprietà dello script del titolare. Dietro la chiave: al massimo 300
 *   righe al giorno (S1).
 *  ⚠️ Nei log solo codici: mai nome, telefono, testo o id del lead.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { gestisciIngresso } from "@/crm/sheets/ingresso";
import { porteIngresso } from "@/crm/sheets/porte.server";

export const Route = createFileRoute("/api/public/sheets-ingresso")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { response, esito } = await gestisciIngresso(porteIngresso(), {
          request,
          segreto: process.env.SHEETS_INGRESSO_TOKEN,
          adesso: new Date(),
        });
        if (esito) console.info(`[sheets-ingresso] ${response.status} ${esito}`);
        return response;
      },
    },
  },
});
