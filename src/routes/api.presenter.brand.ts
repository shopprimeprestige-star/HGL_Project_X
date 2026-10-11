/** Logo del brand (URL su Storage). GET pubblico, POST per impostarlo.
 *  GET  -> { logoUrl }
 *  POST { logoUrl } -> salva in app_config.key = 'brand_logo_url'
 *
 *  Il GET resta pubblico (il logo si vede ovunque, anche dal cliente); il POST
 *  cambia il marchio mostrato ai clienti e richiede l'accesso da presentatore.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { INTESTAZIONI_CONSENTITE, guardiaP } from "./api.presenter.consultant";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE };
const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

export const Route = createFileRoute("/api/presenter/brand")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async () => {
        const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", "brand_logo_url").maybeSingle();
        return json({ logoUrl: (data as { value?: string | null } | null)?.value || "" });
      },
      POST: async ({ request }) => {
        const no = await guardiaP(request, cors, "impostazioni");
        if (no) return no;
        let body: { logoUrl?: string } = {};
        try { body = (await request.json()) as typeof body; } catch { /* ignore */ }
        await supabaseAdmin.from("app_config").upsert(
          { key: "brand_logo_url", value: (body.logoUrl || "").trim(), updated_at: new Date().toISOString() } as never,
          { onConflict: "key" },
        );
        return json({ ok: true, logoUrl: (body.logoUrl || "").trim() });
      },
    },
  },
});
