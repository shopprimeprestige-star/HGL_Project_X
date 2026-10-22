/** ─────────────────────────────────────────────────────────────────────────
 *  IL RIQUADRO «CONFERMA CONSULENZE»: LEGGERE, ACCENDERE, CONTROLLARE
 *
 *  Commessa 2026-10-22. Il riquadro in Impostazioni → WhatsApp parla solo con
 *  questa rotta:
 *   · GET  → l'interruttore e la frase dell'ultimo giro del cron;
 *   · POST { acceso: boolean } → accende o spegne;
 *   · POST { prova: true } → «Controlla ora»: il giro a secco (non scrive,
 *     non invia), solo conteggi.
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
import { giroPromemoria, type ConfigPromemoria } from "@/crm/promemoria/giro";
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
        let b: { acceso?: unknown; prova?: unknown } = {};
        try {
          b = (await request.json()) as typeof b;
        } catch {
          return json({ ok: false, error: "corpo" }, 400);
        }
        const porte = porteVere(g.chi.adminUserId);

        if (b.prova === true) {
          try {
            return json(await giroPromemoria(porte, { prova: true }));
          } catch {
            return json({ ok: false, pronto: false, frase: FRASI_BLOCCO.controllo_fallito });
          }
        }

        if (typeof b.acceso !== "boolean") return json({ ok: false, error: "acceso" }, 400);
        const prima = await porte.leggiConfig();
        //  Già acceso: riaccendere non deve rimettere `avvio: "da_fare"` né
        //  spostare `attivoDal` (revisione finale, N2).
        if (b.acceso && prima?.acceso) return json({ ok: true, config: prima });
        //  Accendere = `avvio: "da_fare"`: il primo giro marca «preesistenti»
        //  gli appuntamenti già in agenda, che così non ricevono niente.
        const nuovo: ConfigPromemoria = b.acceso
          ? { acceso: true, attivoDal: new Date().toISOString(), avvio: "da_fare" }
          : { ...(prima ?? {}), acceso: false };
        try {
          await porte.scriviConfig(nuovo);
        } catch {
          return json({ ok: false, error: "Non salvato: il database non ha risposto." }, 500);
        }
        return json({ ok: true, config: nuovo });
      },
    },
  },
});
