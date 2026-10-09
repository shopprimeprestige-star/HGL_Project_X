/** Preferenze PER PRESENTATORE (server-side, così seguono il consulente su ogni device).
 *  GET  /api/presenter/prefs?presenterId=xxx -> { audio: {...} }        (prefs del singolo)
 *  GET  /api/presenter/prefs                 -> { all: { [id]: {...} } } (mappa completa)
 *  POST { presenterId, audio } -> upsert (merge sul presentatore, gli altri restano intatti)
 *  app_config.key = 'presenter_prefs'  →  { [presenterId]: { audio: {...} } }
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
/*  ⚠️ Le preferenze si LEGGONO senza credenziali (sono impostazioni audio, non
    dati di nessuno) ma si SCRIVONO solo da presentatore: senza, chiunque
    poteva spegnere la soppressione del rumore o alzare la soglia del
    microfono a un consulente, e quello se ne sarebbe accorto solo dal fatto
    che il cliente non lo sente più. */
import { INTESTAZIONI_CONSENTITE, autorizzaPresentatore, nonAutorizzato } from "./api.presenter.consultant";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE };
const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

// preferenze audio del microfono (soppressione rumore + soglia di attivazione)
type AudioPrefs = { ns?: boolean; gate?: boolean; gateDb?: number; preset?: string };
type Prefs = { audio?: AudioPrefs };
type All = Record<string, Prefs>;

async function readAll(): Promise<All> {
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", "presenter_prefs").maybeSingle();
  try {
    const p = JSON.parse((data as { value?: string } | null)?.value ?? "{}");
    return p && typeof p === "object" ? (p as All) : {};
  } catch { return {}; }
}

export const Route = createFileRoute("/api/presenter/prefs")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const id = new URL(request.url).searchParams.get("presenterId")?.trim() || "";
        const all = await readAll();
        if (!id) return json({ all });
        const p = all[id] || {};
        return json({ presenterId: id, audio: p.audio ?? null });
      },
      POST: async ({ request }) => {
        if (!(await autorizzaPresentatore(request))) return nonAutorizzato(cors);
        let body: { presenterId?: string; audio?: AudioPrefs } = {};
        try { body = (await request.json()) as typeof body; } catch { /* ignore */ }
        const id = (body.presenterId || "").trim();
        if (!id) return json({ ok: false, error: "presenterId mancante" });
        const all = await readAll();
        const prev = all[id] || {};
        const a = body.audio || {};
        const audio: AudioPrefs = {
          ...(prev.audio || {}),
          ...(typeof a.ns === "boolean" ? { ns: a.ns } : {}),
          ...(typeof a.gate === "boolean" ? { gate: a.gate } : {}),
          ...(typeof a.gateDb === "number" && isFinite(a.gateDb) ? { gateDb: Math.max(-80, Math.min(0, a.gateDb)) } : {}),
          ...(typeof a.preset === "string" ? { preset: a.preset } : {}),
        };
        all[id] = { ...prev, audio };
        await supabaseAdmin.from("app_config").upsert({ key: "presenter_prefs", value: JSON.stringify(all), updated_at: new Date().toISOString() } as never, { onConflict: "key" });
        return json({ ok: true, audio });
      },
    },
  },
});
