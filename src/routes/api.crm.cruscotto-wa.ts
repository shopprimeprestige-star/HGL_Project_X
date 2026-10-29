/** ─────────────────────────────────────────────────────────────────────────
 *  IL CRUSCOTTO WHATSAPP (pacchetto p4-cruscotto-wa)
 *
 *  GET  ?periodo=7|30|90 → { ok, cruscotto }  (conteggi, tassi, minuti, importi)
 *  POST { tariffe?: {marketing, utility}, sogliaMinuti? } → { ok, impostazioni }
 *
 *  ⚠️ DIETRO `guardiaCRM` COL PERMESSO «impostazioni», come i costi della chat:
 *   ci sono soldi e i numeri dei singoli consulenti.
 *  ⚠️ Esce solo un riepilogo: nessun telefono, nome di cliente, scheda o testo.
 *   Nei log il solo codice dell'errore.
 *  ⚠️ L'UNICA SCRITTURA è il POST delle impostazioni (tariffe e soglia): i dati
 *   sotto non si toccano mai. Non chiama né ManyChat né Meta.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { leggiCruscotto, salvaImpostazioni } from "@/crm/cruscotto-wa/leggi.server";
import { PERIODO_CRUSCOTTO_INIZIALE, periodoCruscottoValido } from "@/crm/cruscotto-wa/calcolo";
import { guardiaCRM } from "./api.crm.accesso";

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

const codiceDi = (e: unknown) => {
  const code = (e as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "errore";
};

export const Route = createFileRoute("/api/crm/cruscotto-wa")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        if (!g.chi.adminUserId)
          return json({ error: "Non si sa di quale installazione si parla: rientra nel CRM." }, 403);
        const chiesto = new URL(request.url).searchParams.get("periodo") ?? PERIODO_CRUSCOTTO_INIZIALE;
        if (!periodoCruscottoValido(chiesto)) return json({ error: "Periodo non valido." }, 400);
        try {
          return json({ ok: true, cruscotto: await leggiCruscotto(g.chi.adminUserId, chiesto, new Date()) });
        } catch (e) {
          console.warn("[cruscotto-wa]", codiceDi(e));
          return json({ error: "Non riesco a leggere il cruscotto: riprova fra poco." }, 500);
        }
      },

      POST: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        if (!g.chi.adminUserId)
          return json({ error: "Non si sa di quale installazione si parla: rientra nel CRM." }, 403);
        const corpo = (await request.json().catch(() => null)) as {
          tariffe?: { marketing?: unknown; utility?: unknown };
          sogliaMinuti?: unknown;
        } | null;
        if (!corpo || typeof corpo !== "object") return json({ error: "Richiesta non valida." }, 400);
        try {
          const impostazioni = await salvaImpostazioni(g.chi.adminUserId, {
            tariffe: corpo.tariffe,
            sogliaMinuti: corpo.sogliaMinuti,
          });
          return json({ ok: true, impostazioni });
        } catch (e) {
          const code = codiceDi(e);
          console.warn("[cruscotto-wa] salva", code);
          return json(
            {
              error:
                code === "manca_migrazione"
                  ? "Manca l'aggiornamento del database per salvare le impostazioni: per ora valgono quelle di serie."
                  : "Non riesco a salvare: riprova fra poco.",
            },
            code === "manca_migrazione" ? 409 : 500,
          );
        }
      },
    },
  },
});
