/** Invio messaggio WhatsApp via Cloud API.
 *  POST { to: string (E.164), body?: string, templateName?: string, templateLang?: string, leadId?: string }
 *  Auth: bearer della sessione utente (il client allega `Authorization: Bearer <access_token>`).
 *  Persistenza: scrive su public.whatsapp_messages con user_id = utente autenticato.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Cast helper: i tipi generati per whatsapp_messages/whatsapp_contacts non includono ancora
// tutti i campi nuovi (user_id ecc.). Uso un client untyped per le insert/upsert.
const adminUntyped = supabaseAdmin as unknown as {
  from: (t: string) => {
    insert: (v: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    upsert: (v: Record<string, unknown>, o?: { onConflict?: string }) => Promise<{ error: { message: string } | null }>;
    select: (s: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
      };
    };
  };
};

interface SendBody {
  to: string;
  body?: string;
  templateName?: string;
  templateLang?: string;
  leadId?: string | null;
  /** Parametri posizionali del body del template, in ordine {{1}}, {{2}}, ... */
  templateParams?: string[];
}

interface PhoneNumberMeta {
  display_phone_number?: string;
  verified_name?: string;
  error?: { message?: string };
}

function normalizePhone(p: string): string {
  const digits = p.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

function isMetaTestNumber(meta: PhoneNumberMeta | null): boolean {
  const display = meta?.display_phone_number ?? "";
  return meta?.verified_name === "Test Number" || display.includes("555-");
}

export const Route = createFileRoute("/api/whatsapp-send")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) {
          return Response.json({ error: "missing_auth" }, { status: 401 });
        }

        // Risolvo user dall'access token
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

        let body: SendBody;
        try {
          body = (await request.json()) as SendBody;
        } catch {
          return Response.json({ error: "invalid_body" }, { status: 400 });
        }
        if (!body.to || (!body.body && !body.templateName)) {
          return Response.json({ error: "missing_params", hint: "to + (body | templateName)" }, { status: 400 });
        }
        const to = normalizePhone(body.to);

        // Carico credenziali WhatsApp dell'utente (admin client per leggerle)
        const { data: cfg } = await supabaseAdmin
          .from("whatsapp_settings")
          .select("phone_number_id, access_token, mode")
          .eq("user_id", userId)
          .maybeSingle();
        const phoneNumberId = (cfg as { phone_number_id?: string | null } | null)?.phone_number_id;
        const accessToken = (cfg as { access_token?: string | null } | null)?.access_token;
        const mode = ((cfg as { mode?: string | null } | null)?.mode ?? "live") as "live" | "sandbox";
        if (!phoneNumberId || !accessToken) {
          return Response.json(
            { error: "missing_credentials", hint: "Configura WhatsApp in Impostazioni → WhatsApp" },
            { status: 400 },
          );
        }

        const phoneMetaRes = await fetch(
          `https://graph.facebook.com/v21.0/${phoneNumberId}?fields=display_phone_number,verified_name`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        const phoneMeta = (await phoneMetaRes.json()) as PhoneNumberMeta;
        const detectedSandbox = phoneMetaRes.ok && isMetaTestNumber(phoneMeta);

        // Se la modalità richiesta è "live" ma il numero è di test, blocco con errore chiaro.
        if (mode === "live" && detectedSandbox) {
          return Response.json(
            {
              error: "test_phone_number_configured",
              code: "mode_mismatch",
              message:
                `Modalità impostata su LIVE ma il Phone Number ID configurato (${phoneMeta.display_phone_number ?? phoneNumberId}) è il numero di TEST Meta. ` +
                "Sostituiscilo con il Phone Number ID del numero WhatsApp Business reale, oppure cambia modalità in Sandbox.",
              hint:
                "Apri Meta → WhatsApp Manager / API Setup del numero live e copia il Phone Number ID del numero finale.",
              raw: phoneMeta,
            },
            { status: 400 },
          );
        }

        const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
        const payload: Record<string, unknown> = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to.replace(/^\+/, ""),
        };
        if (body.templateName) {
          payload.type = "template";
          const template: Record<string, unknown> = {
            name: body.templateName,
            language: { code: body.templateLang || "it" },
          };
          const params = body.templateParams;
          if (Array.isArray(params) && params.length > 0) {
            template.components = [
              {
                type: "body",
                parameters: params.map((text) => ({
                  type: "text",
                  text: String(text ?? ""),
                })),
              },
            ];
          }
          payload.template = template;
        } else {
          payload.type = "text";
          payload.text = { preview_url: false, body: body.body };
        }

        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });
        const json = (await res.json()) as {
          messages?: Array<{ id: string }>;
          error?: {
            message: string;
            code?: number;
            error_subcode?: number;
            type?: string;
            error_data?: { details?: string };
            fbtrace_id?: string;
          };
        };

        if (!res.ok || json.error) {
          const code = json.error?.code;
          const sub = json.error?.error_subcode;
          let msg = json.error?.message || `HTTP ${res.status}`;
          let hint: string | undefined;
          let category = "unknown";
          if (code === 131030) {
            category = "recipient_not_allowed";
            hint = detectedSandbox
              ? "Hai ancora configurato il numero di test Meta. Inserisci il Phone Number ID del numero WhatsApp Business live, altrimenti Meta accetterà solo destinatari whitelisted."
              : "L'app Meta è in Development mode e accetta solo numeri whitelisted. Su Meta for Developers → app → switch 'App mode: Live'. Servono privacy policy URL, business verification e display name WhatsApp approvato.";
          } else if (code === 131031 || code === 131047 || code === 131026) {
            category = "outside_24h_window";
            hint =
              "Sei fuori dalla finestra di 24h. Per messaggi di testo liberi serve che il destinatario ti abbia scritto nelle ultime 24h. Usa un template approvato.";
          } else if (code === 132000 || code === 132001 || code === 132005 || code === 132007 || code === 132012) {
            category = "template_invalid";
            hint = "Template non valido, non approvato o parametri mancanti. Verifica nome, lingua e variabili.";
          } else if (code === 190 || code === 102) {
            category = "token_expired";
            hint = "Access token scaduto o non valido. Rigenera un System User Token permanente con permessi whatsapp_business_messaging + whatsapp_business_management.";
          } else if (code === 200 || code === 10) {
            category = "missing_permission";
            hint = "Permessi insufficienti sul token. Aggiungi whatsapp_business_messaging e whatsapp_business_management e rigenera.";
          } else if (code === 100) {
            category = "bad_parameter";
            hint = "Parametro non valido (Phone Number ID o destinatario). Verifica gli ID Meta nelle impostazioni.";
          } else if (code === 80007 || code === 4) {
            category = "rate_limit";
            hint = "Rate limit Meta raggiunto. Aspetta qualche secondo e riprova.";
          }
          const fullMsg = hint ? `${msg} — ${hint}` : msg;
          // Log dettagliato lato server per capire l'errore
          console.error("[whatsapp-send] Meta error", {
            category,
            code,
            error_subcode: sub,
            message: msg,
            fbtrace_id: json.error?.fbtrace_id,
            details: json.error?.error_data?.details,
          });
          // Persisto comunque l'errore per visibilità nello UI
          await adminUntyped.from("whatsapp_messages").insert({
            user_id: userId,
            lead_id: body.leadId ?? null,
            direction: "outbound",
            from_number: phoneNumberId,
            to_number: to,
            body: body.body ?? `[template:${body.templateName}]`,
            status: "failed",
            error_message: fullMsg,
            raw_payload: json as unknown as Record<string, unknown>,
          });
          return Response.json(
            {
              error: "wa_api_error",
              category,
              code: code ?? null,
              error_subcode: sub ?? null,
              message: fullMsg,
              hint,
              fbtrace_id: json.error?.fbtrace_id ?? null,
              raw: json.error ?? null,
            },
            { status: 502 },
          );
        }

        const waId = json.messages?.[0]?.id;
        const { error: insErr } = await adminUntyped.from("whatsapp_messages").insert({
          user_id: userId,
          lead_id: body.leadId ?? null,
          direction: "outbound",
          from_number: phoneNumberId,
          to_number: to,
          body: body.body ?? `[template:${body.templateName}]`,
          status: "sent",
          wa_message_id: waId ?? null,
          raw_payload: json as unknown as Record<string, unknown>,
        });
        if (insErr) {
          console.error("[whatsapp-send] insert error:", insErr.message);
        }

        // Upsert contatto (last_message_at)
        await adminUntyped
          .from("whatsapp_contacts")
          .upsert(
            {
              user_id: userId,
              phone_e164: to,
              lead_id: body.leadId ?? null,
              last_message_at: new Date().toISOString(),
            },
            { onConflict: "user_id,phone_e164" },
          );

        return Response.json({ ok: true, waMessageId: waId });
      },
    },
  },
});
