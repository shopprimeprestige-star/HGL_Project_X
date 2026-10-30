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
 *  ⚠️ UNA VOLTA AL GIORNO PER DESTINATARIO, ANCHE SE LO CHIAMANO DIECI VOLTE:
 *   prima di ogni invio si prenota il giorno per quel consulente (o per il
 *   titolare) con `prenotaInvio` (crm/riepilogo-mattino, riga in app_config);
 *   se era già prenotato non parte niente. Chi ha la chiave pubblicabile non
 *   può riempire di notifiche e di email i consulenti. La notifica del CRM
 *   (campanella) ha la sua chiave del giorno e non si ripete.
 *  ⚠️ I LINK DELLE EMAIL VENGONO DA `SITO` (lib/sito), mai dall'indirizzo della
 *   richiesta: un'intestazione Host falsa li avvelenerebbe.
 *  ⚠️ LEGGE E BASTA: non scrive sulle schede e non unisce niente. Nessun
 *   messaggio automatico ai clienti.
 *  ⚠️ Nei log solo conteggi e codici.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { inviaATutti } from "@/crm/push/invio.server";
import { SITO } from "@/lib/sito";
import {
  avvisoRiepilogo,
  chiaveInvio,
  daMandare,
  emailRiepilogo,
  prenotaInvio,
  riepilogoMattino,
  type PortaLucchetto,
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

type Consulente = {
  id: string;
  user_id: string;
  data: { nome?: string; email?: string; attivo?: boolean };
};
type Iscrizione = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  consulente_id: string | null;
};

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

/** Il lucchetto del giorno su app_config (vedi `prenotaInvio`). */
const lucchetto: PortaLucchetto = {
  aggiornaSeDiverso: async (chiave, giorno) => {
    const { data, error } = await db()
      .from("app_config")
      .update({ value: giorno, updated_at: new Date().toISOString() })
      .eq("key", chiave)
      .or(`value.is.null,value.neq.${giorno}`)
      .select("key");
    if (error) throw error;
    return (data ?? []).length;
  },
  inserisci: async (chiave, giorno) => {
    const { error } = await db().from("app_config").insert({ key: chiave, value: giorno });
    if (error?.code === "23505") return "esiste";
    if (error) throw error;
    return "ok";
  },
};

/** Il giro di un'installazione. */
async function servi(userId: string, consulenti: Consulente[], adesso: Date) {
  const leads = await schedeDi(userId);
  const r: RiepilogoMattino = riepilogoMattino({ leads, consulenti, adesso });
  const titolare = avvisoRiepilogo(r.titolare, r.giorno);

  //  La notifica nella campanella del CRM: una al giorno (indice unico).
  const { error } = await db()
    .from("notifications")
    .insert({
      user_id: userId,
      kind: "riepilogo_mattino",
      severity: "info",
      title: "Il riepilogo del mattino",
      body: titolare.corpo,
      link: "/CRM/dafare",
      dedupe_key: `riepilogo-mattino:${r.giorno}`,
    });
  if (error && error.code !== "23505") throw error;

  const { data: isc, error: e2 } = await db()
    .from("push_iscrizioni")
    .select("id, endpoint, p256dh, auth, consulente_id")
    .eq("user_id", userId);
  if (e2) throw e2;
  const iscrizioni = (isc ?? []) as Iscrizione[];

  let push = 0;
  let email = 0;
  let gia = 0;
  for (const c of r.perConsulente) {
    if (!daMandare(c)) continue;
    const sue = iscrizioni.filter((i) => i.consulente_id === c.id);
    if (!sue.length && !c.email) continue;
    //  ⚠️ Prima il lucchetto del giorno per QUESTO consulente, poi gli invii.
    if (!(await prenotaInvio(lucchetto, chiaveInvio(userId, c.id), r.giorno))) {
      gia++;
      continue;
    }
    if (sue.length) push += (await inviaATutti(userId, avvisoRiepilogo(c, r.giorno), sue)).inviate;
    const m = emailRiepilogo(c, r.giorno, SITO);
    if (c.email && (await mandaEmail(c.email, m.oggetto, m.html))) email++;
  }
  if (daMandare(r.titolare)) {
    const sue = iscrizioni.filter((i) => !i.consulente_id);
    if (await prenotaInvio(lucchetto, chiaveInvio(userId, ""), r.giorno)) {
      if (sue.length) push += (await inviaATutti(userId, titolare, sue)).inviate;
      const m = emailRiepilogo(r.titolare, r.giorno, SITO);
      if (await mandaEmail(String(process.env.CRM_ADMIN_EMAIL ?? ""), m.oggetto, m.html)) email++;
    } else gia++;
  }
  return { gia, push, email };
}

export async function giroRiepilogoMattino(adesso = new Date()) {
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
    );
    servite++;
    gia += esito.gia;
    push += esito.push;
    email += esito.email;
  }
  return { servite, giaServiti: gia, push, email };
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
          return json(await giroRiepilogoMattino());
        } catch (e) {
          const code = (e as { code?: unknown } | null)?.code;
          console.error("[riepilogo-mattino]", typeof code === "string" ? code : "errore");
          return json({ error: "giro interrotto" }, 500);
        }
      },
    },
  },
});
