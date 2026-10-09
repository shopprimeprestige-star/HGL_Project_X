/** Meta Lead Ads webhook (multi-tenant).
 *  GET  → handshake Meta (hub.challenge) verificato contro tracking_config.meta_leadgen_verify_token
 *  POST → riceve eventi "leadgen": scarica il lead completo via Graph API e lo inserisce in public_leads
 *
 *  Multi-tenant: identifico l'utente dal page_id del payload cercandolo in
 *  public.tracking_config (meta_page_id). page access token e app_secret sono per-utente.
 *
 *  Setup su Meta: App → Webhooks → Page → campo "leadgen"; Callback URL =
 *  https://<dominio>/api/public/meta-leadgen-webhook ; Verify Token = quello salvato in Impostazioni.
 *  La Pagina va sottoscritta all'app con le permission leads_retrieval + pages_manage_metadata.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
//  ⚠️ La traduzione del modulo in riga sta in un posto solo: la usa anche il
//   recupero periodico (routes/hooks/meta-lead-sync). Due traduzioni diverse
//   dello stesso lead vogliono dire lo stesso cliente scritto in due modi.
import { idEsterno, schedaDaLead, type LeadMeta } from "@/crm/meta-leadgen";

const META_API = "https://graph.facebook.com/v21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Hub-Signature-256",
};

interface LeadgenValue {
  leadgen_id?: string;
  page_id?: string;
  form_id?: string;
  ad_id?: string;
  adgroup_id?: string; // = adset id
  campaign_id?: string;
  created_time?: number;
}
interface LeadgenPayload {
  object: string;
  entry: Array<{ id: string; time?: number; changes: Array<{ field: string; value: LeadgenValue }> }>;
}

interface TenantCfg {
  user_id: string;
  meta_page_access_token: string | null;
  meta_app_secret: string | null;
}

const adminUntyped = supabaseAdmin as unknown as {
  from: (t: string) => {
    insert: (v: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
};

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

async function findTenantByPageId(pageId: string): Promise<TenantCfg | null> {
  const { data } = await supabaseAdmin
    .from("tracking_config")
    .select("user_id, meta_page_access_token, meta_app_secret")
    .eq("meta_page_id", pageId)
    .maybeSingle();
  return (data as TenantCfg | null) ?? null;
}

async function fetchAndStoreLead(leadgenId: string, cfg: TenantCfg, hint: LeadgenValue): Promise<void> {
  if (!cfg.meta_page_access_token) {
    console.warn("[meta-leadgen] page access token mancante per user", cfg.user_id);
    return;
  }
  const fieldsWanted = "id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,field_data";
  const url = `${META_API}/${leadgenId}?fields=${fieldsWanted}&access_token=${encodeURIComponent(cfg.meta_page_access_token)}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error("[meta-leadgen] graph fetch fallita", res.status, await res.text());
    return;
  }
  const lead = (await res.json()) as LeadMeta;

  /*  ── ⚠️ LO STESSO LEAD PUÒ BUSSARE DUE VOLTE ─────────────────────────
      Meta ritenta la consegna quando non riceve subito il 200, e il recupero
      periodico va a ripescare comunque gli ultimi giorni: senza questo
      controllo lo stesso cliente finiva in elenco due volte, e qualcuno lo
      avrebbe chiamato due volte. */
  const { data: esistenti } = await (supabaseAdmin as unknown as {
    from: (t: string) => { select: (c: string) => { eq: (col: string, v: string) => { limit: (n: number) => PromiseLike<{ data: unknown[] | null }> } } };
  }).from("public_leads").select("id").eq("external_id", idEsterno(lead.id)).limit(1);
  if (esistenti && esistenti.length) return;

  const { error } = await adminUntyped.from("public_leads").insert(schedaDaLead(lead, hint));
  if (error) console.error("[meta-leadgen] insert public_leads fallito:", error.message);
}

export const Route = createFileRoute("/api/public/meta-leadgen-webhook")({
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
        const { data } = await supabaseAdmin
          .from("tracking_config")
          .select("user_id")
          .eq("meta_leadgen_verify_token", verifyToken)
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
        let payload: LeadgenPayload;
        try {
          payload = JSON.parse(rawBody) as LeadgenPayload;
        } catch {
          return new Response("invalid_json", { status: 400, headers: corsHeaders });
        }
        if (payload.object !== "page") {
          return new Response("ok", { status: 200, headers: corsHeaders });
        }
        const sigHeader = request.headers.get("x-hub-signature-256");

        for (const entry of payload.entry ?? []) {
          for (const change of entry.changes ?? []) {
            if (change.field !== "leadgen") continue;
            const v = change.value;
            const pageId = v.page_id || entry.id;
            const leadgenId = v.leadgen_id;
            if (!pageId || !leadgenId) continue;

            const cfg = await findTenantByPageId(pageId);
            if (!cfg) {
              console.warn("[meta-leadgen] nessun tenant per page_id", pageId);
              continue;
            }
            // Verifica firma se app_secret configurato
            if (cfg.meta_app_secret && !verifySignature(rawBody, sigHeader, cfg.meta_app_secret)) {
              console.warn("[meta-leadgen] firma non valida per page", pageId);
              continue;
            }
            try {
              await fetchAndStoreLead(leadgenId, cfg, v);
            } catch (err) {
              console.error("[meta-leadgen] errore elaborazione lead", err);
            }
          }
        }

        return new Response("ok", { status: 200, headers: corsHeaders });
      },
    },
  },
});
