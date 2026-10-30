/** ─────────────────────────────────────────────────────────────────────────
 *  L'INTERRUTTORE «ASSENZA ALLA CONSULENZA» (commessa 2026-10-30, p5)
 *
 *  Il riquadro in Impostazioni → WhatsApp (`AssenzaAutoPannello`) parla solo con
 *  questa rotta, che ricalca api.crm.prenota-chat:
 *   · GET  → { ok, acceso } (acceso = `acceso: true` esatto nella riga `assenza_auto`);
 *   · POST { acceso: boolean } → accende o spegne; la riga non si cancella mai.
 *  Spento (di serie): il giro hooks/assenza-meet SEGNALA soltanto in «Da fare».
 *  Acceso: sposta la scheda in «Da riprogrammare» e parte il messaggio dello stato.
 *
 *  ⚠️ TUTTO DIETRO `guardiaCRM` COL PERMESSO «impostazioni»: chi non ce l'ha
 *   riceve 403. Nelle risposte e nei log solo codici.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { guardiaCRM } from "./api.crm.accesso";
import { leggiRiga, scriviRiga } from "@/crm/manychat/prenota.server";
import { CHIAVE_ASSENZA_AUTO, leggiAssenzaAuto, rigaAssenzaAuto } from "@/crm/manychat/consulenze";

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

export const Route = createFileRoute("/api/crm/assenza-auto")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        try {
          return json({ ok: true, acceso: leggiAssenzaAuto(await leggiRiga(CHIAVE_ASSENZA_AUTO)) });
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
          const nuova = rigaAssenzaAuto(b.acceso);
          await scriviRiga(CHIAVE_ASSENZA_AUTO, nuova);
          return json({ ok: true, acceso: leggiAssenzaAuto(nuova) });
        } catch {
          return json({ ok: false, error: "Non salvato: il database non ha risposto." }, 500);
        }
      },
    },
  },
});
