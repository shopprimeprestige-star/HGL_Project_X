/** ── RISPOSTE AI: IL MAC CHIEDE LAVORO E CONSEGNA (29/10/2026) ─────────────
 *
 *  POST /api/public/risposte-ai. La chiama il servizio sul Mac del titolare
 *  (`strumenti/risposte-ai`) con la chiave del ponte WhatsApp. Tutta la
 *  logica è in `crm/risposte-ai/ingresso.ts`, provata; qui il collegamento.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { gestisciRisposteAi } from "@/crm/risposte-ai/ingresso";
import { porteRisposteAi } from "@/crm/risposte-ai/porte.server";

export const Route = createFileRoute("/api/public/risposte-ai")({
  server: {
    handlers: {
      POST: ({ request }) =>
        gestisciRisposteAi(porteRisposteAi(), {
          request,
          segreto: process.env.PONTE_WA_TOKEN,
        }),
    },
  },
});
