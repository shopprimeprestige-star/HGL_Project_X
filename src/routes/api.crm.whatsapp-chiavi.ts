/** Le chiavi Meta (Impostazioni → WhatsApp → «WhatsApp Cloud API (Meta)»), solo dal server.
 *
 *  Commessa 2026-10-31-anteprima-link (revisione). Il browser non legge più `access_token`, `app_secret` e
 *  `webhook_verify_token` di `whatsapp_settings` (migrazione 20261031170000): il pannello parla con questa rotta.
 *   · GET  → `StatoChiavi`: identificativi, modalità, verify token, e SOLO sì/no per token e app secret;
 *   · POST `{ phone_number_id?, business_account_id?, mode?, access_token?, app_secret?, webhook_verify_token?,
 *            cancella?: string[] }` → scrive SOLO i campi presenti. Un segreto vuoto non cancella (vedi
 *            `patchChiavi`). Risponde come il GET, mai coi valori scritti.
 *
 *  ⚠️ DIETRO `guardiaCRM` COL PERMESSO «impostazioni»: col PIN la sessione Supabase è quella del titolare per
 *   tutti, quindi la setter non deve poter leggere né cambiare le chiavi.
 *  ⚠️ Funziona prima e dopo la migrazione (il server usa la chiave di servizio). Nei log solo codici. */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { guardiaCRM } from "./api.crm.accesso";
import { patchChiavi, statoChiavi } from "@/crm/whatsapp-chiavi";

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

const FRASE_TITOLARE = "Non si sa di quale installazione si parla: rientra nel CRM.";

type ErroreDb = { code?: string } | null;
/** I tipi generati non conoscono tutte le colonne. */
const db = supabaseAdmin as unknown as {
  from(t: string): {
    select(c: string): {
      eq(
        k: string,
        v: string,
      ): { maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: ErroreDb }> };
    };
    upsert(v: Record<string, unknown>, o: { onConflict: string }): PromiseLike<{ error: ErroreDb }>;
  };
};

async function leggi(userId: string) {
  const { data, error } = await db
    .from("whatsapp_settings")
    .select(
      "phone_number_id, business_account_id, mode, webhook_verify_token, access_token, app_secret",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return statoChiavi(data);
}

/** Un guasto del database: nei log solo il codice. */
function guasto(e: unknown) {
  const code = (e as { code?: unknown } | null)?.code;
  console.warn("[whatsapp-chiavi]", typeof code === "string" ? code : "errore");
  return json({ error: "Il server ha avuto un problema: riprova fra poco." }, 500);
}

export const Route = createFileRoute("/api/crm/whatsapp-chiavi")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),

      GET: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        if (!g.chi.adminUserId) return json({ error: FRASE_TITOLARE }, 403);
        try {
          return json(await leggi(g.chi.adminUserId));
        } catch (e) {
          return guasto(e);
        }
      },

      POST: async ({ request }) => {
        const g = await guardiaCRM(request, cors, "impostazioni");
        if (!g.ok) return g.risposta;
        if (!g.chi.adminUserId) return json({ error: FRASE_TITOLARE }, 403);
        let corpo: unknown;
        try {
          corpo = await request.json();
        } catch {
          return json({ error: "Richiesta non valida." }, 400);
        }
        const p = patchChiavi(corpo);
        if (!p.ok) return json({ error: p.errore }, 400);
        try {
          const userId = g.chi.adminUserId;
          const { error } = await db
            .from("whatsapp_settings")
            .upsert({ user_id: userId, ...p.patch }, { onConflict: "user_id" });
          if (error) throw error;
          return json(await leggi(userId));
        } catch (e) {
          return guasto(e);
        }
      },
    },
  },
});
