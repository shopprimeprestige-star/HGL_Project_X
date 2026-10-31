/** ─────────────────────────────────────────────────────────────────────────
 *  IL RIQUADRO «CONFERMA CONSULENZE»: LEGGERE, ACCENDERE, CONTROLLARE
 *
 *  Commessa 2026-10-22. Il riquadro in Impostazioni → WhatsApp parla solo con
 *  questa rotta:
 *   · GET  → l'interruttore (quello del registro) e la frase dell'ultimo giro del cron;
 *   · POST { prova: true } → «Controlla ora»: il giro a secco (non scrive,
 *     non invia), solo conteggi.
 *   ⚠️ L'interruttore NON si cambia più da qui (commessa 2026-10-31-interruttori-automatici):
 *   si accende e si spegne in «Messaggi automatici», una sola fonte nel registro. Un
 *   POST con `acceso` è rifiutato (400) e non scrive niente: una scheda Impostazioni
 *   rimasta aperta durante la pubblicazione non può riaccendere un messaggio spento.
 *
 *  ⚠️ TUTTO DIETRO `guardiaCRM` COL PERMESSO «impostazioni» (controllo di
 *   sicurezza, MEDIUM). Prima l'interruttore scriveva `app_config` dal
 *   browser: con l'accesso col PIN la sessione Supabase è quella del
 *   proprietario per tutti, quindi anche la setter poteva accendere i
 *   messaggi ai clienti. Per lo stesso motivo la prova a secco non si fida più
 *   della sola sessione Supabase. Chi non ha «impostazioni» riceve 403.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { guardiaCRM } from "./api.crm.accesso";
import { porteVere } from "./hooks/promemoria-whatsapp";
import { giroPromemoria } from "@/crm/promemoria/giro";
import { FRASI_BLOCCO } from "@/crm/promemoria/pronto";

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

export const Route = createFileRoute("/api/crm/promemoria-whatsapp")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        //  Senza il titolare dei dati non si sa di quale installazione si parla:
        //  si rifiuta invece di guardarle tutte.
        if (!g.chi.adminUserId) return json({ ok: false, error: "titolare" }, 403);
        const porte = porteVere(g.chi.adminUserId);
        const [config, stato] = await Promise.all([porte.leggiConfig(), porte.leggiStato()]);
        return json({ ok: true, config, stato });
      },

      POST: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        //  Senza il titolare dei dati non si sa di quale installazione si parla:
        //  si rifiuta invece di guardarle tutte.
        if (!g.chi.adminUserId) return json({ ok: false, error: "titolare" }, 403);
        let b: { acceso?: unknown; prova?: unknown } | null;
        try {
          b = (await request.json()) as typeof b;
        } catch {
          return json({ ok: false, error: "corpo" }, 400);
        }
        if (!b || typeof b !== "object") return json({ ok: false, error: "corpo" }, 400);
        //  L'interruttore sta in «Messaggi automatici»: da qui non si cambia, né si legge dal corpo.
        if (b.acceso !== undefined)
          return json(
            { ok: false, error: "L'interruttore si cambia in Messaggi automatici." },
            400,
          );

        const porte = porteVere(g.chi.adminUserId);

        if (b.prova === true) {
          try {
            return json(await giroPromemoria(porte, { prova: true }));
          } catch {
            return json({ ok: false, pronto: false, frase: FRASI_BLOCCO.controllo_fallito });
          }
        }
        return json({ ok: false, error: "prova" }, 400);
      },
    },
  },
});
