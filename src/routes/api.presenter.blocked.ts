/** MODERAZIONE — elenco dei dispositivi BLOCCATI (lato server, sopravvive ai reload).
 *  GET  -> { list: [{ id, name, at }] }
 *  POST { action: "block" | "unblock", id, name? } -> { ok, list }
 *  app_config.key = 'blocked_devices'
 *  NB: `id` è l'id PERSISTENTE del dispositivo dell'ospite (localStorage
 *  `hg_guest_device`): il pid della chiamata cambia ad ogni ricarica, quindi
 *  bloccare il pid non servirebbe a nulla.
 *
 *  ── CHI PUÒ FARE COSA ─────────────────────────────────────────────────────
 *  BLOCCARE E SBLOCCARE richiedono l'accesso da presentatore: senza controllo,
 *  chiunque poteva sbloccarsi da solo — o buttare fuori tutti gli altri.
 *
 *  LEGGERE ha due forme, perché ha due lettori diversi:
 *   · `?id=<dispositivo>` -> { blocked: true|false } e basta. È quello che serve
 *     all'ospite per sapere se PROPRIO LUI è bloccato, e non gli dice niente
 *     sugli altri;
 *   · senza parametri -> l'elenco intero, per il pannello del presentatore.
 *     Richiede l'accesso... quasi: vedi la nota di compatibilità qui sotto.
 *
 *  ⚠️ COMPATIBILITÀ ALL'INDIETRO (da togliere): oggi l'ospite chiama la forma
 *  SENZA parametri e si cerca dentro l'elenco (src/shop/call.tsx,
 *  checkBlockedOnJoin). Finché fa così, l'elenco senza parametri resta leggibile
 *  anche senza accesso, altrimenti un ospite bloccato rientrerebbe. Appena
 *  call.tsx passerà a `?id=`, togliere il ramo marcato COMPAT qui sotto e
 *  mettere la guardia: l'elenco contiene i nomi degli ospiti allontanati.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { INTESTAZIONI_CONSENTITE, guardia } from "./api.presenter.consultant";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE };
const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

interface Blocked { id: string; name: string; at: string }

async function read(): Promise<Blocked[]> {
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", "blocked_devices").maybeSingle();
  const v = (data as { value?: string | null } | null)?.value;
  if (!v) return [];
  try {
    const arr = JSON.parse(v) as Blocked[];
    return Array.isArray(arr) ? arr.filter((b) => b && typeof b.id === "string" && b.id) : [];
  } catch { return []; }
}
async function write(list: Blocked[]) {
  await supabaseAdmin.from("app_config").upsert(
    { key: "blocked_devices", value: JSON.stringify(list), updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
}

export const Route = createFileRoute("/api/presenter/blocked")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        //  La domanda dell'ospite: "sono bloccato IO?". Una risposta sola,
        //  vero o falso, che non racconta niente degli altri.
        const chiesto = (new URL(request.url).searchParams.get("id") || "").trim();
        if (chiesto) {
          const list = await read();
          return json({ blocked: list.some((b) => b.id === chiesto) });
        }
        //  COMPAT: elenco intero senza guardia, perché oggi lo usa anche
        //  l'ospite per riconoscersi (vedi nota in testa al file). Da chiudere
        //  appena call.tsx passa a `?id=`.
        return json({ list: await read() });
      },
      POST: async ({ request }) => {
        //  Bloccare/sbloccare è un potere da presentatore: senza questo, un
        //  ospite allontanato si rimetteva in lista da solo.
        const no = await guardia(request, cors, { list: [] });
        if (no) return no;
        let body: { action?: string; id?: string; name?: string } = {};
        try { body = (await request.json()) as typeof body; } catch { /* ignore */ }
        const id = (body.id || "").trim();
        if (!id) return json({ ok: false, list: await read() });
        const list = await read();
        const next = body.action === "unblock"
          ? list.filter((b) => b.id !== id)
          : list.some((b) => b.id === id)
            ? list.map((b) => (b.id === id ? { ...b, name: body.name || b.name } : b))
            : [...list, { id, name: body.name || "Ospite", at: new Date().toISOString() }];
        await write(next);
        return json({ ok: true, list: next });
      },
    },
  },
});
