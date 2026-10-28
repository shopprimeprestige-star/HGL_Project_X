/** ─────────────────────────────────────────────────────────────────────────
 *  IL CANALE WHATSAPP, IN SOLA LETTURA (riquadro «Prova i modelli»)
 *
 *  GET → { ok, canale, modelliConFlusso, chiaveManychat, migrazione }
 *
 *  ⚠️ DIETRO `guardiaCRM` COL PERMESSO «lead.propri» (lo stesso della voce WhatsApp
 *   del menu): la chat del CRM la usano anche i setter, e deve sapere dal canale
 *   se bloccare la casella. Esce solo il canale, i nomi dei modelli e due booleani.
 *  ⚠️ NON ESCE NIENTE DI SEGRETO: né la chiave di ManyChat (solo se c'è) né i
 *   codici dei flussi (solo i nomi dei modelli che ne hanno uno).
 *  ⚠️ SENZA LA MIGRAZIONE M1 la tabella non c'è: risposta «cloud» con
 *   `migrazione: false`. Qualunque altro guasto è un 503, non un «cloud» a caso.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chiaveManychatPresente } from "@/crm/manychat/porta.server";
import { statoCanaleDaRiga } from "@/crm/prova-modelli";
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

/** I tipi generati non conoscono `manychat_config`. */
const db = supabaseAdmin as unknown as {
  from(t: string): {
    select(c: string): {
      eq(
        k: string,
        v: string,
      ): {
        maybeSingle(): PromiseLike<{
          data: { canale?: string | null; flussi?: Record<string, unknown> | null } | null;
          error: { code?: string; message?: string } | null;
        }>;
      };
    };
  };
};

export const Route = createFileRoute("/api/crm/whatsapp-canale")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "lead.propri");
        if (!g.ok) return g.risposta;
        //  Senza il titolare dei dati non si sa di quale installazione si parla.
        if (!g.chi.adminUserId) return json({ ok: false, error: "titolare" }, 403);
        let stato;
        try {
          const riga = await db
            .from("manychat_config")
            .select("canale, flussi")
            .eq("user_id", g.chi.adminUserId)
            .maybeSingle();
          stato = statoCanaleDaRiga(riga, chiaveManychatPresente());
        } catch {
          stato = null;
        }
        if (!stato) return json({ ok: false, error: "canale_non_leggibile" }, 503);
        return json({ ok: true, ...stato });
      },
    },
  },
});
