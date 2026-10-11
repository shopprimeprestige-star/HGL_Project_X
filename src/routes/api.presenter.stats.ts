/** Numeri della presentazione (social proof + posti/urgenza).
 *  GET            -> { stats }
 *  POST {stats}   -> salva
 *  app_config.key = 'presenter_stats'
 *
 *  LETTURA APERTA, SCRITTURA NO: questi numeri e la frase di garanzia si
 *  mostrano al cliente nelle slide. Riscriverli è dire una cosa diversa a nome
 *  dello studio — compresa la promessa di garanzia: serve l'accesso.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { INTESTAZIONI_CONSENTITE, guardiaP } from "./api.presenter.consultant";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE };
const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const DEFAULT = { implants: "1.200", years: "8", spotsLeft: "9", spotsTotal: "12", guarantee: "Se l'attaccatura non ti convince, la rifacciamo. Rischio zero." };

async function read() {
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", "presenter_stats").maybeSingle();
  try { return { ...DEFAULT, ...(JSON.parse((data as { value?: string } | null)?.value ?? "{}") || {}) }; } catch { return DEFAULT; }
}

export const Route = createFileRoute("/api/presenter/stats")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async () => json({ stats: await read() }),
      POST: async ({ request }) => {
        const no = await guardiaP(request, cors, "impostazioni");
        if (no) return no;
        let body: Record<string, string> = {};
        try { body = (await request.json()) as Record<string, string>; } catch { /* ignore */ }
        const merged = { ...(await read()), ...body };
        await supabaseAdmin.from("app_config").upsert({ key: "presenter_stats", value: JSON.stringify(merged), updated_at: new Date().toISOString() } as never, { onConflict: "key" });
        return json({ ok: true, stats: merged });
      },
    },
  },
});
