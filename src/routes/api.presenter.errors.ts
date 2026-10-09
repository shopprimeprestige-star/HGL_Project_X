/** DIARIO DEGLI ERRORI — problemi rilevati sul dispositivo del cliente.
 *  Prima l'avviso compariva sullo schermo del presentatore e spariva: se non lo
 *  si leggeva al volo, l'informazione era persa. Qui resta scritta, così un
 *  problema si può analizzare con calma anche a consulenza finita.
 *  GET    -> { list: [{ at, msg, stack, name, page, ua }] }  (piu recente per primo)
 *  POST   { msg, stack?, name?, page?, ua? } -> { ok, list }
 *  DELETE                                     -> { ok, list: [] }   (svuota)
 *  app_config.key = 'guest_errors'  ·  conserva al massimo MAX voci
 *
 *  ── CHI PUÒ LEGGERLO ──────────────────────────────────────────────────────
 *  Il diario racconta il dispositivo del cliente: che pagina aveva aperto, con
 *  che telefono, che cosa si è rotto e col nome che aveva digitato. LEGGERLO e
 *  SVUOTARLO richiedono l'accesso da presentatore.
 *  SCRIVERE resta aperto, e deve restarlo: la segnalazione parte dal telefono
 *  del cliente, che non ha (e non deve avere) nessuna credenziale. È una rotta
 *  di sola aggiunta, con tetto di MAX voci e antiripetizione: chi scrive non
 *  può leggere niente in cambio.
 */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { INTESTAZIONI_CONSENTITE, guardia } from "./api.presenter.consultant";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS", "Access-Control-Allow-Headers": INTESTAZIONI_CONSENTITE };
const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

export interface GuestErr { at: string; msg: string; stack: string; name: string; page: string; ua: string }
const MAX = 80;
const KEY = "guest_errors";

async function read(): Promise<GuestErr[]> {
  const { data } = await supabaseAdmin.from("app_config").select("value").eq("key", KEY).maybeSingle();
  const v = (data as { value?: string | null } | null)?.value;
  if (!v) return [];
  try {
    const arr = JSON.parse(v) as GuestErr[];
    return Array.isArray(arr) ? arr.filter((e) => e && typeof e.msg === "string") : [];
  } catch { return []; }
}
async function write(list: GuestErr[]) {
  await supabaseAdmin.from("app_config").upsert(
    { key: KEY, value: JSON.stringify(list.slice(0, MAX)), updated_at: new Date().toISOString() } as never,
    { onConflict: "key" },
  );
}
const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);

export const Route = createFileRoute("/api/presenter/errors")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const no = await guardia(request, cors, { list: [] });
        if (no) return no;
        return json({ list: await read() });
      },
      POST: async ({ request }) => {
        let b: Partial<GuestErr> = {};
        try { b = (await request.json()) as Partial<GuestErr>; } catch { /* ignore */ }
        const msg = clip(b.msg, 400);
        if (!msg) return json({ ok: false, reason: "messaggio vuoto" });
        const list = await read();
        // stesso messaggio sulla stessa pagina entro un minuto: non si duplica
        const last = list[0];
        const now = Date.now();
        //  NB: la risposta non riporta MAI il diario. Prima lo restituiva, e
        //  siccome scrivere è aperto a tutti bastava mandare un errore
        //  qualsiasi per ricevere indietro l'intero elenco: la porta di
        //  servizio della stessa falla che il controllo sul GET chiude.
        if (last && last.msg === msg && last.page === clip(b.page, 120) && now - Date.parse(last.at) < 60_000) {
          return json({ ok: true });
        }
        list.unshift({
          at: new Date().toISOString(),
          msg,
          stack: clip(b.stack, 2000),
          name: clip(b.name, 80),
          page: clip(b.page, 120),
          ua: clip(b.ua, 200),
        });
        await write(list);
        return json({ ok: true });
      },
      DELETE: async ({ request }) => {
        const no = await guardia(request, cors, { list: [] });
        if (no) return no;
        await write([]);
        return json({ ok: true, list: [] });
      },
    },
  },
});
