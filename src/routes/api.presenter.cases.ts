/** Casi/risultati mostrati nelle slide (video testimonianza o prima/dopo).
 *  GET               -> { cases: [...] }
 *  POST {case}       -> aggiunge un caso
 *  DELETE ?id=...    -> rimuove
 *  Salvati in app_config.key = 'presenter_cases' via service role.
 *
 *  LETTURA APERTA, SCRITTURA NO: questi casi si vedono nelle slide sul telefono
 *  del cliente, quindi il GET deve rispondere a chiunque. Aggiungerne o
 *  toglierne significa invece cambiare quello che i clienti vedranno — e le
 *  foto sono di pazienti veri: serve l'accesso da presentatore.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { INTESTAZIONI_CONSENTITE, guardiaP } from "./api.presenter.consultant";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE,
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

interface Caso {
  id: string; name: string; age: string; location: string;
  kind: "video" | "photos"; videoUrl?: string; beforeUrl?: string; afterUrl?: string;
}

async function readList(): Promise<Caso[]> {
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", "presenter_cases").maybeSingle();
  try { return (JSON.parse((data as { value?: string } | null)?.value ?? "[]") as Caso[]) || []; } catch { return []; }
}
async function writeList(list: Caso[]) {
  await supabaseAdmin.from("app_config").upsert(
    { key: "presenter_cases", value: JSON.stringify(list), updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
}

export const Route = createFileRoute("/api/presenter/cases")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async () => json({ cases: await readList() }),
      POST: async ({ request }) => {
        const no = await guardiaP(request, cors, "impostazioni");
        if (no) return no;
        let body: Partial<Caso> = {};
        try { body = (await request.json()) as Partial<Caso>; } catch { /* ignore */ }
        const kind = body.kind === "photos" ? "photos" : "video";
        if (kind === "video" && !body.videoUrl) return json({ ok: false, reason: "missing_video" }, 400);
        if (kind === "photos" && (!body.beforeUrl || !body.afterUrl)) return json({ ok: false, reason: "missing_images" }, 400);
        const list = await readList();
        list.push({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          name: (body.name || "").trim(), age: (body.age || "").trim(), location: (body.location || "").trim(),
          kind, videoUrl: body.videoUrl, beforeUrl: body.beforeUrl, afterUrl: body.afterUrl,
        });
        await writeList(list);
        return json({ ok: true, cases: list });
      },
      DELETE: async ({ request }) => {
        const no = await guardiaP(request, cors, "impostazioni");
        if (no) return no;
        const id = new URL(request.url).searchParams.get("id") || "";
        const list = (await readList()).filter((c) => c.id !== id);
        await writeList(list);
        return json({ ok: true, cases: list });
      },
    },
  },
});
