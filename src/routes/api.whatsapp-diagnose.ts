/** Diagnostica configurazione WhatsApp Cloud API:
 *  GET → verifica via Graph che Phone Number ID e WABA ID siano validi e
 *  ritorna informazioni utili (display number, verified_name, sandbox/live,
 *  permessi token, conteggio template approvati). Usata dal pannello impostazioni
 *  per mostrare un riepilogo "live/test" all'apertura della pagina.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface PhoneInfo {
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
  code_verification_status?: string;
  error?: { message?: string; code?: number; error_subcode?: number };
}
interface WabaInfo {
  id?: string;
  name?: string;
  message_template_namespace?: string;
  error?: { message?: string; code?: number; error_subcode?: number };
}
interface TemplatesInfo {
  data?: Array<{ status: string; name: string; language: string }>;
  error?: { message?: string; code?: number; error_subcode?: number };
}

function isMetaTestNumber(p: PhoneInfo | null): boolean {
  const display = p?.display_phone_number ?? "";
  return p?.verified_name === "Test Number" || display.includes("555-");
}

export const Route = createFileRoute("/api/whatsapp-diagnose")({
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
          .select("phone_number_id, business_account_id, access_token, mode")
          .eq("user_id", userId)
          .maybeSingle();
        const c = (cfg ?? {}) as {
          phone_number_id?: string | null;
          business_account_id?: string | null;
          access_token?: string | null;
          mode?: string | null;
        };

        if (!c.phone_number_id || !c.business_account_id || !c.access_token) {
          return Response.json({
            ok: false,
            mode: c.mode ?? "live",
            error: "missing_credentials",
            message: "Compila Phone Number ID, WABA ID e Access Token in Impostazioni.",
          });
        }

        const headers = { Authorization: `Bearer ${c.access_token}` };

        // Chiamate parallele
        const [phoneRes, wabaRes, tplRes, dbgRes] = await Promise.all([
          fetch(
            `https://graph.facebook.com/v21.0/${c.phone_number_id}?fields=display_phone_number,verified_name,quality_rating,code_verification_status`,
            { headers },
          ),
          fetch(
            `https://graph.facebook.com/v21.0/${c.business_account_id}?fields=id,name,message_template_namespace`,
            { headers },
          ),
          fetch(
            `https://graph.facebook.com/v21.0/${c.business_account_id}/message_templates?fields=name,language,status&limit=200`,
            { headers },
          ),
          fetch(
            `https://graph.facebook.com/v21.0/debug_token?input_token=${encodeURIComponent(
              c.access_token,
            )}&access_token=${encodeURIComponent(c.access_token)}`,
          ),
        ]);

        const phone = (await phoneRes.json()) as PhoneInfo;
        const waba = (await wabaRes.json()) as WabaInfo;
        const tpl = (await tplRes.json()) as TemplatesInfo;
        const dbg = (await dbgRes.json()) as {
          data?: { scopes?: string[]; expires_at?: number; is_valid?: boolean; error?: { message?: string } };
          error?: { message?: string };
        };

        const phoneOk = phoneRes.ok && !phone.error;
        const wabaOk = wabaRes.ok && !waba.error;
        const tplOk = tplRes.ok && !tpl.error;
        const isSandbox = phoneOk && isMetaTestNumber(phone);
        const detectedMode = isSandbox ? "sandbox" : "live";
        const requestedMode = c.mode === "sandbox" ? "sandbox" : "live";
        const modeMismatch = detectedMode !== requestedMode;

        const scopes = dbg.data?.scopes ?? [];
        const requiredScopes = ["whatsapp_business_messaging", "whatsapp_business_management"];
        const missingScopes = requiredScopes.filter((s) => !scopes.includes(s));
        const tokenExpiresAt = dbg.data?.expires_at ?? 0; // 0 = never

        const approvedCount =
          tplOk && tpl.data ? tpl.data.filter((t) => t.status === "APPROVED").length : 0;

        return Response.json({
          ok: phoneOk && wabaOk && tplOk && missingScopes.length === 0,
          requestedMode,
          detectedMode,
          modeMismatch,
          phone: {
            ok: phoneOk,
            display_phone_number: phone.display_phone_number ?? null,
            verified_name: phone.verified_name ?? null,
            quality_rating: phone.quality_rating ?? null,
            code_verification_status: phone.code_verification_status ?? null,
            error: phone.error ?? null,
          },
          waba: {
            ok: wabaOk,
            id: waba.id ?? null,
            name: waba.name ?? null,
            namespace: waba.message_template_namespace ?? null,
            error: waba.error ?? null,
          },
          templates: {
            ok: tplOk,
            approved_count: approvedCount,
            total: tpl.data?.length ?? 0,
            error: tpl.error ?? null,
          },
          token: {
            valid: dbg.data?.is_valid ?? null,
            scopes,
            missing_scopes: missingScopes,
            expires_at: tokenExpiresAt,
            never_expires: tokenExpiresAt === 0,
            error: dbg.data?.error?.message ?? dbg.error?.message ?? null,
          },
        });
      },
    },
  },
});
