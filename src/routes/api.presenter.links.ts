/** Link salvati da trasmettere (YouTube, siti web, ecc.).
 *  GET / POST {name,url} / DELETE ?url=  — in app_config.key = 'presenter_links'
 *
 *  LETTURA APERTA, SCRITTURA NO: l'elenco si vede nella pagina web mostrata in
 *  consulenza. Aggiungere un link significa decidere che cosa verrà aperto
 *  davanti a un cliente: serve l'accesso da presentatore.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { INTESTAZIONI_CONSENTITE, guardiaP } from "./api.presenter.consultant";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

interface Lnk { name: string; url: string }
async function readList(): Promise<Lnk[]> {
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", "presenter_links").maybeSingle();
  try { return (JSON.parse((data as { value?: string } | null)?.value ?? "[]") as Lnk[]) || []; } catch { return []; }
}
async function writeList(list: Lnk[]) {
  await supabaseAdmin.from("app_config").upsert({ key: "presenter_links", value: JSON.stringify(list), updated_at: new Date().toISOString() } as never, { onConflict: "key" });
}

export const Route = createFileRoute("/api/presenter/links")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async () => json({ links: await readList() }),
      POST: async ({ request }) => {
        const no = await guardiaP(request, cors, "impostazioni");
        if (no) return no;
        let body: Lnk = { name: "", url: "" };
        try { body = (await request.json()) as Lnk; } catch { /* ignore */ }
        const url = (body.url || "").trim();
        if (!url) return json({ ok: false, reason: "missing_url" }, 400);
        const list = await readList();
        if (!list.some((v) => v.url === url)) list.unshift({ name: (body.name || url).trim(), url });
        await writeList(list);
        return json({ ok: true, links: list });
      },
      DELETE: async ({ request }) => {
        const no = await guardiaP(request, cors, "impostazioni");
        if (no) return no;
        const url = new URL(request.url).searchParams.get("url") || "";
        const list = (await readList()).filter((v) => v.url !== url);
        await writeList(list);
        return json({ ok: true, links: list });
      },
    },
  },
});
