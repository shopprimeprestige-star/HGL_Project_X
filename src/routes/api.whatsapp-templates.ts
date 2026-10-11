/** Lista template WhatsApp dinamici approvati su Meta (WABA Message Templates).
 *  GET → ritorna l'elenco dei template del WhatsApp Business Account dell'utente autenticato.
 *  Uso: scheda Impostazioni → WhatsApp → Template dinamici Meta.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface MetaTemplate {
  name: string;
  language: string;
  status: string;
  category: string;
  components?: Array<{ type: string; text?: string; format?: string }>;
}

export const Route = createFileRoute("/api/whatsapp-templates")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const auth = request.headers.get("authorization") || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return Response.json({ error: "missing_auth" }, { status: 401 });

        const userClient = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY!,
          { global: { headers: { Authorization: `Bearer ${token}` } } },
        );
        const { data: userRes, error: userErr } = await userClient.auth.getUser();
        if (userErr || !userRes.user) {
          return Response.json({ error: "invalid_session" }, { status: 401 });
        }
        const userId = userRes.user.id;

        const { data: cfg } = await supabaseAdmin
          .from("whatsapp_settings")
          .select("business_account_id, access_token")
          .eq("user_id", userId)
          .maybeSingle();

        const wabaId = (cfg as { business_account_id?: string | null } | null)?.business_account_id;
        const accessToken = (cfg as { access_token?: string | null } | null)?.access_token;
        if (!wabaId || !accessToken) {
          return Response.json(
            { error: "missing_credentials", hint: "Configura WABA ID + Access Token in Impostazioni → WhatsApp" },
            { status: 400 },
          );
        }

        const url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=name,language,status,category,components&limit=100`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        const json = (await res.json()) as {
          data?: MetaTemplate[];
          error?: { message: string; code?: number; error_subcode?: number };
        };
        if (!res.ok || json.error) {
          const code = json.error?.code;
          const sub = json.error?.error_subcode;
          let message = json.error?.message || `HTTP ${res.status}`;
          let hint: string | undefined;
          if (code === 100 && sub === 33) {
            hint =
              "Il WABA ID salvato non è accessibile con questo token oppure non è il vero WhatsApp Business Account ID del numero live. Su Meta → WhatsApp Manager copia il WABA ID corretto.";
          } else if (code === 190 || code === 102) {
            hint =
              "Access token scaduto o non valido. Rigenera un System User Token su Business Settings con permessi whatsapp_business_messaging + whatsapp_business_management.";
          } else if (code === 200 || code === 10) {
            hint =
              "Permessi insufficienti sul token. Manca whatsapp_business_management. Rigenera il token con entrambi i permessi WhatsApp.";
          }
          return Response.json(
            {
              error: "wa_api_error",
              code: code ?? null,
              error_subcode: sub ?? null,
              message,
              hint,
              raw: json.error ?? null,
            },
            { status: 502 },
          );
        }
        return Response.json({ ok: true, templates: json.data ?? [] });
      },
    },
  },
});
