/** WhatsApp Cloud API webhook (multi-tenant).
 *  GET  → handshake Meta (challenge)
 *  POST → riceve eventi (messaggi inbound + status)
 *
 *  Multi-tenant: identifico l'utente dal phone_number_id presente nel payload e
 *  lo cerco in public.whatsapp_settings. Verify_token e app_secret sono per-utente.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const adminUntyped = supabaseAdmin as unknown as {
  from: (t: string) => {
    insert: (v: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    upsert: (v: Record<string, unknown>, o?: { onConflict?: string; ignoreDuplicates?: boolean }) => Promise<{ error: { message: string } | null }>;
    update: (v: Record<string, unknown>) => {
      eq: (k: string, v: string) => {
        eq: (k: string, v: string) => Promise<{ error: { message: string } | null }>;
      };
    };
    select: (s: string) => {
      eq: (k: string, v: string) => {
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null }>;
        limit: (n: number) => Promise<{ data: Array<Record<string, unknown>> | null }>;
      };
    };
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Hub-Signature-256",
};

interface WaChange {
  field: string;
  value: {
    metadata?: { phone_number_id?: string; display_phone_number?: string };
    messages?: Array<{
      id: string;
      from: string;
      timestamp: string;
      type: string;
      text?: { body: string };
      image?: { id: string; mime_type?: string; caption?: string };
      audio?: { id: string; mime_type?: string };
      video?: { id: string; mime_type?: string; caption?: string };
      document?: { id: string; mime_type?: string; filename?: string };
    }>;
    statuses?: Array<{
      id: string;
      status: "sent" | "delivered" | "read" | "failed";
      timestamp: string;
      recipient_id: string;
      errors?: Array<{ message: string }>;
    }>;
    contacts?: Array<{ profile?: { name?: string }; wa_id: string }>;
  };
}

interface WaWebhookPayload {
  object: string;
  entry: Array<{ id: string; changes: WaChange[] }>;
}

function normalizePhone(p: string): string {
  const digits = p.replace(/[^\d+]/g, "");
  return digits.startsWith("+") ? digits : `+${digits}`;
}

async function findUserIdByPhoneNumberId(phoneNumberId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("whatsapp_settings")
    .select("user_id, app_secret")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  return (data as { user_id?: string } | null)?.user_id ?? null;
}

async function getAppSecretForPhoneNumber(phoneNumberId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("whatsapp_settings")
    .select("app_secret")
    .eq("phone_number_id", phoneNumberId)
    .maybeSingle();
  return (data as { app_secret?: string | null } | null)?.app_secret ?? null;
}

function verifySignature(rawBody: string, signatureHeader: string | null, appSecret: string): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) return false;
  const provided = signatureHeader.slice(7);
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(provided, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function autoLinkLead(userId: string, phoneE164: string): Promise<{ leadId: string | null; displayName: string | null }> {
  // cerca nei lead del CRM un telefono che corrisponda (normalizzo cifre)
  const digits = phoneE164.replace(/\D/g, "");
  const { data: leads } = await supabaseAdmin
    .from("crm_leads")
    .select("id,data")
    .eq("user_id", userId)
    .limit(1000);
  for (const row of (leads ?? []) as Array<{ id: string; data: { telefono?: string; nome?: string; cognome?: string } }>) {
    const t = String(row.data?.telefono || "").replace(/\D/g, "");
    if (t && (t === digits || t.endsWith(digits.slice(-9)) || digits.endsWith(t.slice(-9)))) {
      const display = `${row.data?.nome ?? ""} ${row.data?.cognome ?? ""}`.trim() || null;
      return { leadId: row.id, displayName: display };
    }
  }
  return { leadId: null, displayName: null };
}

export const Route = createFileRoute("/api/public/whatsapp-webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const verifyToken = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        if (mode !== "subscribe" || !verifyToken || !challenge) {
          return new Response("bad_request", { status: 400, headers: corsHeaders });
        }
        // Match contro tutti gli utenti (multi-tenant)
        const { data } = await supabaseAdmin
          .from("whatsapp_settings")
          .select("user_id")
          .eq("webhook_verify_token", verifyToken)
          .limit(1);
        if (!data || data.length === 0) {
          return new Response("forbidden", { status: 403, headers: corsHeaders });
        }
        return new Response(challenge, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "text/plain" },
        });
      },

      POST: async ({ request }) => {
        const rawBody = await request.text();
        let payload: WaWebhookPayload;
        try {
          payload = JSON.parse(rawBody) as WaWebhookPayload;
        } catch {
          return new Response("invalid_json", { status: 400, headers: corsHeaders });
        }
        const sigHeader = request.headers.get("x-hub-signature-256");

        for (const entry of payload.entry ?? []) {
          for (const change of entry.changes ?? []) {
            const v = change.value;
            const phoneNumberId = v.metadata?.phone_number_id;
            if (!phoneNumberId) continue;
            const userId = await findUserIdByPhoneNumberId(phoneNumberId);
            if (!userId) continue;

            // Verifica firma se app_secret configurato
            const appSecret = await getAppSecretForPhoneNumber(phoneNumberId);
            if (appSecret && !verifySignature(rawBody, sigHeader, appSecret)) {
              console.warn("[wa-webhook] invalid signature for", phoneNumberId);
              continue;
            }

            // Inbound messages
            for (const m of v.messages ?? []) {
              const fromE164 = normalizePhone(m.from);
              const { leadId, displayName } = await autoLinkLead(userId, fromE164);
              const text =
                m.text?.body ??
                m.image?.caption ??
                m.video?.caption ??
                (m.type === "audio" ? "[audio]" : null) ??
                (m.type === "document" ? `[doc: ${m.document?.filename ?? ""}]` : null) ??
                `[${m.type}]`;
              await adminUntyped.from("whatsapp_messages").insert({
                user_id: userId,
                lead_id: leadId,
                direction: "inbound",
                from_number: fromE164,
                to_number: phoneNumberId,
                body: text,
                wa_message_id: m.id,
                status: "delivered",
                raw_payload: m as unknown as Record<string, unknown>,
              });
              const contactName =
                v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name ?? displayName ?? null;
              await adminUntyped.from("whatsapp_contacts").upsert(
                {
                  user_id: userId,
                  phone_e164: fromE164,
                  lead_id: leadId,
                  display_name: contactName,
                  last_message_at: new Date().toISOString(),
                  unread_count: 1,
                },
                { onConflict: "user_id,phone_e164", ignoreDuplicates: false },
              );
            }

            // Status updates
            for (const s of v.statuses ?? []) {
              const patch: Record<string, unknown> = { status: s.status };
              if (s.status === "delivered") patch.delivered_at = new Date(Number(s.timestamp) * 1000).toISOString();
              if (s.status === "read") patch.read_at = new Date(Number(s.timestamp) * 1000).toISOString();
              if (s.status === "failed" && s.errors?.[0]?.message) patch.error_message = s.errors[0].message;
              await adminUntyped
                .from("whatsapp_messages")
                .update(patch)
                .eq("user_id", userId)
                .eq("wa_message_id", s.id);
            }
          }
        }

        return new Response("ok", { status: 200, headers: corsHeaders });
      },
    },
  },
});
