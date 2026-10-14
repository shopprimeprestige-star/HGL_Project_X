/** Invio messaggio WhatsApp via Cloud API.
 *  POST { to: string (E.164), body?: string, templateName?: string, templateLang?: string, leadId?: string }
 *  Auth: bearer della sessione utente (il client allega `Authorization: Bearer <access_token>`).
 *  Persistenza: scrive su public.whatsapp_messages con user_id = utente autenticato.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  chiamaGraph,
  classificaErrore,
  costruisciPayload,
  erroreModoNonCoerente,
  isMetaTestNumber,
  leggiNumero,
  normalizePhone,
} from "@/crm/wa-graph.server";

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

        const { ok: phoneMetaOk, meta: phoneMeta } = await leggiNumero(fetch, phoneNumberId, accessToken);
        const detectedSandbox = phoneMetaOk && isMetaTestNumber(phoneMeta);

        // Se la modalità richiesta è "live" ma il numero è di test, blocco con errore chiaro.
        const blocco = erroreModoNonCoerente(mode, detectedSandbox, phoneMeta, phoneNumberId);
        if (blocco) {
          return Response.json(blocco, { status: 400 });
        }

        const payload = costruisciPayload(to, body);
        const { ok: inviato, status, json } = await chiamaGraph(fetch, phoneNumberId, accessToken, payload);

        if (!inviato) {
          const { category, code, sub, msg, hint, fullMsg } = classificaErrore(json, status, detectedSandbox);
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
