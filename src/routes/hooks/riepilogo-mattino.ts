/** ── IL RIEPILOGO DEL MATTINO (commessa 2026-10-30, idea 16) ────────────────
 *
 *  Ogni mattina (pg_cron, migrazione `20261030120000_p6-lead-doppi-chiamate`)
 *  ogni consulente riceve sul telefono una notifica con i NUMERI della sua
 *  giornata — consulenze, da chiamare, chi ha risposto, richiami scaduti — e
 *  la stessa cosa per email se c'è il canale (RESEND_API_KEY). Il titolare
 *  (iscrizioni senza consulente, email CRM_ADMIN_EMAIL) riceve i totali, chi
 *  non è di nessuno e i numeri doppi. I conti stanno in crm/riepilogo-mattino.
 *
 *  COME LO SI CHIAMA
 *  POST /hooks/riepilogo-mattino con Authorization che porta la chiave
 *  pubblicabile, come gli altri hook.
 *  ⚠️ UNA VOLTA AL GIORNO, ANCHE SE LO CHIAMANO DIECI VOLTE: prima si scrive la
 *   notifica del CRM con la chiave del giorno (indice unico user_id +
 *   dedupe_key); se c'è già, quell'installazione oggi è già stata servita e
 *   non parte niente. Chi ha la chiave pubblicabile non può riempire di
 *   notifiche i telefoni.
 *  ⚠️ LEGGE E BASTA: non scrive sulle schede e non unisce niente. Nessun
 *   messaggio automatico ai clienti.
 *  ⚠️ Nei log solo conteggi e codici.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { inviaATutti } from "@/crm/push/invio.server";
import {
  avvisoRiepilogo,
  daMandare,
  emailRiepilogo,
  riepilogoMattino,
  type RiepilogoMattino,
} from "@/crm/riepilogo-mattino";
import type { Lead } from "@/crm/types";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as unknown as { from: (t: string) => any };

type Consulente = { id: string; user_id: string; data: { nome?: string; email?: string; attivo?: boolean } };
type Iscrizione = { id: string; endpoint: string; p256dh: string; auth: string; consulente_id: string | null };

/** Tutte le schede di un'installazione, a pagine (PostgREST ne dà 1000 per volta). */
async function schedeDi(userId: string): Promise<Lead[]> {
  const out: Lead[] = [];
  const PAGINA = 1000;
  for (let da = 0; ; da += PAGINA) {
    const { data, error } = await db()
      .from("crm_leads")
      .select("id, user_id, data, created_at, updated_at")
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .range(da, da + PAGINA - 1);
    if (error) throw error;
    const righe = (data ?? []) as Lead[];
    out.push(...righe);
    if (righe.length < PAGINA) return out;
  }
}

async function mandaEmail(a: string, oggetto: string, html: string): Promise<boolean> {
  const chiave = process.env.RESEND_API_KEY;
  if (!chiave || !a) return false;
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chiave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "CRM Hair Genius <onboarding@resend.dev>",
        to: [a],
        subject: oggetto,
        html,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Il giro di un'installazione. `false` = oggi era già stato fatto. */
async function servi(userId: string, consulenti: Consulente[], adesso: Date, sito: string) {
  const leads = await schedeDi(userId);
  const r: RiepilogoMattino = riepilogoMattino({ leads, consulenti, adesso });
  const titolare = avvisoRiepilogo(r.titolare, r.giorno);

  //  ⚠️ Prima il segno del giorno: è il lucchetto contro i giri doppi.
  const { error } = await db().from("notifications").insert({
    user_id: userId,
    kind: "riepilogo_mattino",
    severity: "info",
    title: "Il riepilogo del mattino",
    body: titolare.corpo,
    link: "/CRM/dafare",
    dedupe_key: `riepilogo-mattino:${r.giorno}`,
  });
  if (error?.code === "23505") return { gia: true, push: 0, email: 0 };
  if (error) throw error;

  const { data: isc, error: e2 } = await db()
    .from("push_iscrizioni")
    .select("id, endpoint, p256dh, auth, consulente_id")
    .eq("user_id", userId);
  if (e2) throw e2;
  const iscrizioni = (isc ?? []) as Iscrizione[];

  let push = 0;
  let email = 0;
  for (const c of r.perConsulente) {
    if (!daMandare(c)) continue;
    const sue = iscrizioni.filter((i) => i.consulente_id === c.id);
    if (sue.length) push += (await inviaATutti(userId, avvisoRiepilogo(c, r.giorno), sue)).inviate;
    const m = emailRiepilogo(c, r.giorno, sito);
    if (c.email && (await mandaEmail(c.email, m.oggetto, m.html))) email++;
  }
  if (daMandare(r.titolare)) {
    const sue = iscrizioni.filter((i) => !i.consulente_id);
    if (sue.length) push += (await inviaATutti(userId, titolare, sue)).inviate;
    const m = emailRiepilogo(r.titolare, r.giorno, sito);
    if (await mandaEmail(String(process.env.CRM_ADMIN_EMAIL ?? ""), m.oggetto, m.html)) email++;
  }
  return { gia: false, push, email };
}

export async function giroRiepilogoMattino(adesso = new Date(), sito = "") {
  const { data, error } = await db().from("crm_consultants").select("id, user_id, data");
  if (error) throw error;
  const consulenti = (data ?? []) as Consulente[];
  const { data: isc, error: e2 } = await db().from("push_iscrizioni").select("user_id");
  if (e2) throw e2;
  const installazioni = new Set<string>([
    ...consulenti.map((c) => c.user_id),
    ...((isc ?? []) as { user_id: string }[]).map((i) => i.user_id),
  ]);
  let servite = 0;
  let gia = 0;
  let push = 0;
  let email = 0;
  for (const userId of installazioni) {
    if (!userId) continue;
    const esito = await servi(
      userId,
      consulenti.filter((c) => c.user_id === userId),
      adesso,
      sito,
    );
    if (esito.gia) gia++;
    else servite++;
    push += esito.push;
    email += esito.email;
  }
  return { servite, giaFatte: gia, push, email };
}

export const Route = createFileRoute("/hooks/riepilogo-mattino")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const attesa = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!auth || !auth.includes(attesa || "__mancante__"))
          return json({ error: "unauthorized" }, 401);
        try {
          return json(await giroRiepilogoMattino(new Date(), new URL(request.url).origin));
        } catch (e) {
          const code = (e as { code?: unknown } | null)?.code;
          console.error("[riepilogo-mattino]", typeof code === "string" ? code : "errore");
          return json({ error: "giro interrotto" }, 500);
        }
      },
    },
  },
});
