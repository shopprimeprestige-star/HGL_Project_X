/** ─────────────────────────────────────────────────────────────────────────
 *  L'INTERRUTTORE «PRENOTAZIONE DELLA CONSULENZA IN CHAT»
 *
 *  Il riquadro in Impostazioni → WhatsApp parla solo con questa rotta:
 *   · GET  → { ok, acceso } com'è nel database adesso (acceso = `acceso: true`
 *     esatto, come lo legge la rotta di ManyChat);
 *   · POST { acceso: boolean } → accende o spegne. Scrive la riga
 *     `prenota_chat` tenendo gli altri campi (`rigaConAcceso`); spegnere
 *     scrive `acceso: false`, la riga non si cancella mai.
 *
 *  ⚠️ TUTTO DIETRO `guardiaCRM` COL PERMESSO «impostazioni», come
 *   `/api/crm/promemoria-whatsapp`: col PIN la sessione Supabase è del
 *   proprietario per tutti, quindi una scrittura diretta di `app_config` dal
 *   browser la farebbe anche la setter. Chi non ha «impostazioni» riceve 403.
 *  ⚠️ Nelle risposte e nei log solo codici: mai il contenuto della riga.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { guardiaCRM } from "./api.crm.accesso";
import { leggiRiga, scriviRiga } from "@/crm/manychat/prenota.server";
import { CHIAVE_CONFIG, leggiConfigPrenota, rigaConAcceso } from "@/crm/manychat/prenota-tipi";

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
          return json({ ok: true, acceso: !!leggiConfigPrenota(await leggiRiga(CHIAVE_CONFIG)) });
        } catch {
          return json({ ok: false, error: "Non riesco a leggere lo stato: riprova." }, 500);
        }
      },

      POST: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        let b: { acceso?: unknown } = {};
        try {
          b = (await request.json()) as typeof b;
        } catch {
          return json({ ok: false, error: "corpo" }, 400);
        }
        if (typeof b.acceso !== "boolean") return json({ ok: false, error: "acceso" }, 400);
        try {
          const nuova = rigaConAcceso(await leggiRiga(CHIAVE_CONFIG), b.acceso);
          await scriviRiga(CHIAVE_CONFIG, nuova);
          return json({ ok: true, acceso: !!leggiConfigPrenota(nuova) });
        } catch {
          return json({ ok: false, error: "Non salvato: il database non ha risposto." }, 500);
        }
      },
    },
  },
});
