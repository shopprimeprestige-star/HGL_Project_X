/** Consumo dati delle videochiamate (byte inviati/ricevuti per sessione).
 *  GET ?presenterId=...&from=YYYY-MM-DD&to=YYYY-MM-DD -> { usage: [...] }
 *  POST {id, presenterId, presenterName, date, sessionCode, bytesSent, bytesReceived, durationSec, guests}
 *       -> se l'id esiste già la voce viene AGGIORNATA (la chiamata in corso invia
 *          aggiornamenti periodici e uno finale alla chiusura).
 *  DELETE ?id=...   (?all=1 svuota tutto)
 *  Salvato in app_config.key = 'usage' via service role.
 *
 *  ── SOLO A CHI HA L'ACCESSO ───────────────────────────────────────────────
 *  È lo storico di chi ha fatto consulenze, quando, per quanto e con quale
 *  codice di sessione: leggerlo è ricostruire l'agenda dello studio, e il
 *  DELETE ?all=1 la cancellava tutta. Serve una sessione da presentatore.
 *  Scrivere parte dal dispositivo del presentatore durante la chiamata, dove la
 *  sessione c'è sempre (link magico o PIN).
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  INTESTAZIONI_CONSENTITE,
  accessoPresentatore,
  autorizzaPresentatore,
  guardia,
  guardiaP,
  nonAutorizzato,
} from "./api.presenter.consultant";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE,
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

interface Usage {
  id: string; presenterId: string; presenterName: string;
  date: string; sessionCode: string;
  bytesSent: number; bytesReceived: number; durationSec: number; guests: number;
}

const MAX = 2000; // tetto di sicurezza (JSON in app_config)

async function readList(): Promise<Usage[]> {
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", "usage").maybeSingle();
  try { return (JSON.parse((data as { value?: string } | null)?.value ?? "[]") as Usage[]) || []; } catch { return []; }
}
async function writeList(list: Usage[]) {
  await supabaseAdmin.from("app_config").upsert(
    { key: "usage", value: JSON.stringify(list.slice(0, MAX)), updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
}

export const Route = createFileRoute("/api/presenter/usage")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        //  Leggere il consumo di TUTTI è ricostruire l'agenda dello studio: chi
        //  non guarda i numeri dell'azienda vede solo le proprie chiamate. Il
        //  filtro sta qui, prima che l'elenco esca: `?presenterId=<collega>` può
        //  restringere il proprio elenco, mai allargarlo.
        const chi = await autorizzaPresentatore(request);
        if (!chi) return nonAutorizzato(cors, { usage: [] });
        const tutte = (await accessoPresentatore(chi)).puo("marketing");
        const q = new URL(request.url).searchParams;
        const pid = q.get("presenterId");
        const from = q.get("from");
        const to = q.get("to");
        let list = await readList();
        if (!tutte) list = list.filter((u) => u.presenterId === chi.id);
        if (pid) list = list.filter((u) => u.presenterId === pid);
        if (from) list = list.filter((u) => u.date >= from);
        if (to) list = list.filter((u) => u.date <= to + "T23:59:59.999Z");
        return json({ usage: list });
      },
      POST: async ({ request }) => {
        const no = await guardia(request, cors);
        if (no) return no;
        let body: Partial<Usage> = {};
        try { body = (await request.json()) as Partial<Usage>; } catch { /* ignore */ }
        const id = String(body.id || "").trim() || Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        const list = await readList();
        const row: Usage = {
          id,
          presenterId: body.presenterId || "",
          presenterName: body.presenterName || "",
          date: body.date || new Date().toISOString(),
          sessionCode: body.sessionCode || "",
          bytesSent: Math.max(0, Number(body.bytesSent) || 0),
          bytesReceived: Math.max(0, Number(body.bytesReceived) || 0),
          durationSec: Math.max(0, Math.round(Number(body.durationSec) || 0)),
          guests: Math.max(0, Number(body.guests) || 0),
        };
        const i = list.findIndex((u) => u.id === id);
        if (i >= 0) list[i] = { ...list[i], ...row };  // aggiorna la sessione in corso
        else list.unshift(row);
        await writeList(list);
        return json({ ok: true, id });
      },
      DELETE: async ({ request }) => {
        //  `?all=1` svuota lo storico di TUTTI: è una cancellazione, e le
        //  cancellazioni non sono lavoro da consulente.
        const no = await guardiaP(request, cors, "impostazioni", { usage: [] });
        if (no) return no;
        const q = new URL(request.url).searchParams;
        if (q.get("all") === "1") { await writeList([]); return json({ ok: true, usage: [] }); }
        const id = q.get("id") || "";
        const list = (await readList()).filter((u) => u.id !== id);
        await writeList(list);
        return json({ ok: true, usage: list });
      },
    },
  },
});
