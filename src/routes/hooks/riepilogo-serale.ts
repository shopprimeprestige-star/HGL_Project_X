/** ── IL RIEPILOGO DELLA SERA, COL CRON (30/10/2026) ─────────────────────────
 *
 *  Ogni sera alle 20:00 di Roma una notifica push con i numeri di domani
 *  (consulenze, confermate, da sentire) e le chat senza risposta. Le regole e
 *  la frase sono in crm/push/riepilogo (provate); qui c'è il collegamento al
 *  database e all'invio.
 *
 *  COME LO SI CHIAMA
 *  POST /hooks/riepilogo-serale con Authorization che porta la chiave
 *  pubblicabile, come gli altri hook. Il cron (migrazione
 *  `riepilogo_serale_cron`) suona alle 18:00 e alle 19:00 UTC: la rotta manda
 *  solo se a Roma sono le 20:xx, e una volta sola al giorno (segno
 *  `riepilogo_serale_ultimo` in app_config). Chi ha la chiave pubblica può solo
 *  anticipare un giro che il cron farebbe comunque, e fuori dall'ora non
 *  parte niente. La risposta ha solo conteggi.
 *  ⚠️ Nei log solo codici, mai nomi o numeri.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STATI_APPUNTAMENTO, type LeadData } from "@/crm/types";
import { inviaATutti } from "@/crm/push/invio.server";
import {
  CHIAVE_ULTIMO,
  giroRiepilogo,
  type PorteRiepilogo,
  type RigaContatto,
} from "@/crm/push/riepilogo";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as unknown as { from: (t: string) => any };

const PAGINA = 1000;

/** Legge TUTTE le righe di una query, a pagine in ordine fisso: PostgREST ne dà
 *  al massimo 1000 per volta. `fa` costruisce la query con l'ordine per `id`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tutte<T>(fa: () => any): Promise<T[]> {
  const out: T[] = [];
  for (let da = 0; ; da += PAGINA) {
    const { data, error } = await fa()
      .order("id", { ascending: true })
      .range(da, da + PAGINA - 1);
    if (error) throw error;
    const righe = (data ?? []) as T[];
    out.push(...righe);
    if (righe.length < PAGINA) return out;
  }
}

/** Le porte vere del giro. */
export function porteVere(): PorteRiepilogo {
  return {
    leggiUltimo: async () => {
      const { data, error } = await db()
        .from("app_config")
        .select("value")
        .eq("key", CHIAVE_ULTIMO)
        .maybeSingle();
      if (error) throw error;
      return (data?.value as string | null | undefined) ?? null;
    },
    scriviUltimo: async (giorno) => {
      const { error } = await db()
        .from("app_config")
        .upsert(
          { key: CHIAVE_ULTIMO, value: giorno, updated_at: new Date().toISOString() },
          { onConflict: "key" },
        );
      if (error) throw error;
    },
    utenti: async () => {
      const righe = await tutte<{ user_id: string }>(() =>
        db().from("push_iscrizioni").select("id, user_id"),
      );
      return [...new Set(righe.map((r) => r.user_id).filter(Boolean))];
    },
    schede: (userId, giorno) =>
      tutte<{ data: Partial<LeadData> }>(() =>
        db()
          .from("crm_leads")
          .select("id, data")
          .eq("user_id", userId)
          .in("data->>stato", STATI_APPUNTAMENTO as string[])
          .eq("data->>dataMeeting", giorno),
      ),
    contatti: (userId, da) =>
      tutte<RigaContatto>(() =>
        db()
          .from("whatsapp_contacts")
          .select("id, ultimo_in_entrata_il, risposto_il")
          .eq("user_id", userId)
          .gte("ultimo_in_entrata_il", da),
      ),
    invia: async (userId, avviso) => ({ inviate: (await inviaATutti(userId, avviso)).inviate }),
  };
}

export const Route = createFileRoute("/hooks/riepilogo-serale")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const attesa = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!auth || !auth.includes(attesa || "__mancante__"))
          return json({ error: "unauthorized" }, 401);
        try {
          return json(await giroRiepilogo(porteVere(), new Date()));
        } catch (e) {
          const code = (e as { code?: unknown } | null)?.code;
          console.error("[riepilogo-serale]", typeof code === "string" ? code : "errore");
          return json({ error: "giro interrotto" }, 500);
        }
      },
    },
  },
});
