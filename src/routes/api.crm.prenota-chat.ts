/** ─────────────────────────────────────────────────────────────────────────
 *  L'INTERRUTTORE «PRENOTAZIONE DELLA CONSULENZA IN CHAT»
 *
 *  Dalla commessa 2026-10-31-interruttori-automatici l'interruttore sta in
 *  Impostazioni → WhatsApp → «Messaggi automatici» (chiave `prenota_chat` del
 *  registro). Questa rotta resta per le schede Impostazioni vecchie e per chi la
 *  legge:
 *   · GET  → { ok, acceso } com'è nel registro adesso;
 *   · POST → 400 «Si cambia in Messaggi automatici»: non scrive più niente. La riga
 *     `app_config['prenota_chat']` tiene consulente, preavviso, giorni e durata.
 *
 *  ⚠️ TUTTO DIETRO `guardiaCRM` COL PERMESSO «impostazioni», come
 *   `/api/crm/promemoria-whatsapp`: col PIN la sessione Supabase è del
 *   proprietario per tutti. Chi non ha «impostazioni» riceve 403.
 *  ⚠️ Nelle risposte e nei log solo codici: mai il contenuto della riga.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { guardiaCRM } from "./api.crm.accesso";
import { messaggioAcceso } from "@/crm/messaggi-automatici/registro.server";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-crm-token",
};

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const Route = createFileRoute("/api/crm/prenota-chat")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        try {
          return json({ ok: true, acceso: await messaggioAcceso("prenota_chat") });
        } catch {
          return json({ ok: false, error: "Non riesco a leggere lo stato: riprova." }, 500);
        }
      },

      POST: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        return json({ ok: false, error: "Si cambia in Messaggi automatici." }, 400);
      },
    },
  },
});
