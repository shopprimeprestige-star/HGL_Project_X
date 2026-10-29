/** ─────────────────────────────────────────────────────────────────────────
 *  I COSTI WHATSAPP, IN SOLA LETTURA (pannello «Costi WhatsApp» della chat)
 *
 *  GET ?periodo=oggi|3|7|30|90 → { ok, costi }  (conteggi e importi, vedi `Costi`)
 *
 *  ⚠️ DIETRO `guardiaCRM` COL PERMESSO «impostazioni» (come le altre letture di
 *   ManyChat) e solo con il titolare dei dati noto: sono soldi.
 *  ⚠️ Esce solo un riepilogo: nessun telefono, nome, scheda o testo. Nei log il solo codice.
 *  ⚠️ NON SCRIVE NIENTE e non chiama né ManyChat né Meta: le cifre sono una stima
 *   (tariffe in `crm/chatwa/costi-whatsapp.ts`); il conto vero è nel Wallet di ManyChat.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { leggiCosti } from "@/crm/chatwa/costi.server";
import { PERIODO_INIZIALE, periodoValido } from "@/crm/chatwa/calcolo-costi";
import { guardiaCRM } from "./api.crm.accesso";

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

export const Route = createFileRoute("/api/crm/whatsapp-costi")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        if (!g.chi.adminUserId)
          return json({ error: "Non si sa di quale installazione si parla: rientra nel CRM." }, 403);
        const chiesto = new URL(request.url).searchParams.get("periodo") ?? PERIODO_INIZIALE;
        if (!periodoValido(chiesto)) return json({ error: "Periodo non valido." }, 400);
        try {
          return json({ ok: true, costi: await leggiCosti(g.chi.adminUserId, chiesto, new Date()) });
        } catch (e) {
          const code = (e as { code?: unknown } | null)?.code;
          console.warn("[whatsapp-costi]", typeof code === "string" ? code : "errore");
          return json({ error: "Non riesco a leggere i costi: riprova fra poco." }, 500);
        }
      },
    },
  },
});
