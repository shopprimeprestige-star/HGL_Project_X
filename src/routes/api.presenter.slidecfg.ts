/** Config slide: slide disattivate + slide personalizzate aggiunte.
 *  GET  -> { disabled: string[], custom: {id,eyebrow,title,sub}[] }
 *  POST { disabled, custom } -> salva
 *  app_config.key = 'slides_config'
 *  Caricata sia dal presentatore sia dal cliente → stesse slide, indici sincronizzati.
 *
 *  Lettura aperta perché la carica anche il cliente; scrittura no: cambiare le
 *  slide è cambiare quello che il cliente vedrà. Serve l'accesso.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { INTESTAZIONI_CONSENTITE, guardiaP } from "./api.presenter.consultant";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE };
const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

type Override = { eyebrow?: string; title?: string; sub?: string; big?: string; icon?: string };
// slide personalizzate: shape ricca (template + campi) — retrocompat con {id,eyebrow,title,sub}
type CustomBullet = { icon?: string; t?: string; d?: string };
type CustomSlide = { id: string; template?: string; eyebrow?: string; title?: string; sub?: string; big?: string; icon?: string; bullets?: CustomBullet[]; footnote?: string };
// opzioni per-caso persistite (es. vista separata prima/dopo) — retrocompat default {}
type CaseOpt = { split?: boolean };
type Cfg = { disabled: string[]; custom: CustomSlide[]; overrides: Record<string, Override>; order: string[]; caseOpts: Record<string, CaseOpt> };
const EMPTY: Cfg = { disabled: [], custom: [], overrides: {}, order: [], caseOpts: {} };

export const Route = createFileRoute("/api/presenter/slidecfg")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async () => {
        const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", "slides_config").maybeSingle();
        let cfg: Cfg = EMPTY;
        try { const p = JSON.parse((data as { value?: string } | null)?.value ?? "{}"); cfg = { disabled: Array.isArray(p.disabled) ? p.disabled : [], custom: Array.isArray(p.custom) ? p.custom : [], overrides: (p.overrides && typeof p.overrides === "object") ? p.overrides : {}, order: Array.isArray(p.order) ? p.order : [], caseOpts: (p.caseOpts && typeof p.caseOpts === "object") ? p.caseOpts : {} }; } catch { /* vuoto */ }
        return json(cfg);
      },
      POST: async ({ request }) => {
        const no = await guardiaP(request, cors, "impostazioni");
        if (no) return no;
        let body: Partial<Cfg> = {};
        try { body = (await request.json()) as Partial<Cfg>; } catch { /* ignore */ }
        const value = JSON.stringify({ disabled: Array.isArray(body.disabled) ? body.disabled : [], custom: Array.isArray(body.custom) ? body.custom : [], overrides: (body.overrides && typeof body.overrides === "object") ? body.overrides : {}, order: Array.isArray(body.order) ? body.order : [], caseOpts: (body.caseOpts && typeof body.caseOpts === "object") ? body.caseOpts : {} });
        await supabaseAdmin.from("app_config").upsert({ key: "slides_config", value, updated_at: new Date().toISOString() } as never, { onConflict: "key" });
        return json({ ok: true });
      },
    },
  },
});
