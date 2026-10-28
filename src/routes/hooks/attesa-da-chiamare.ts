/** ── IL GIRO «ATTESA WHATSAPP» → «DA CHIAMARE» (28/10/2026) ─────────────────
 *
 *  Ogni 15 minuti (pg_cron, migrazione `attesa_da_chiamare_cron`): le schede in
 *  «Attesa WhatsApp» da più di 10 ore, senza risposta del cliente, passano a
 *  «Da chiamare». La regola è in crm/importa/attesa-da-chiamare (provata).
 *
 *  COME LO SI CHIAMA
 *  POST /hooks/attesa-da-chiamare con Authorization che porta la chiave
 *  pubblicabile, come gli altri hook: chi ce l'ha può solo anticipare un giro
 *  che il cron farebbe comunque. La risposta ha solo conteggi.
 *  ⚠️ Si scrive SOLO se la scheda non è cambiata dalla lettura (`updated_at`
 *   uguale): una setter che intanto ha segnato un esito vince sempre.
 *  ⚠️ Nei log solo conteggi e codici, mai nomi o numeri.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { nove, patchDaChiamare, type ContattoWa } from "@/crm/importa/attesa-da-chiamare";
import type { LeadData } from "@/crm/types";

const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

type Riga = { id: string; user_id: string; data: Partial<LeadData>; updated_at: string };
type Contatto = {
  user_id: string;
  phone_e164: string;
  ultimo_in_entrata_il: string | null;
  non_scrivere_dal: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as unknown as { from: (t: string) => any };

export async function giroAttesaDaChiamare(adesso = new Date()) {
  const { data: righe, error } = await db()
    .from("crm_leads")
    .select("id, user_id, data, updated_at")
    .eq("data->>stato", "attesa_whatsapp")
    .limit(2000);
  if (error) throw error;
  const schede = (righe ?? []) as Riga[];
  if (schede.length === 0) return { inAttesa: 0, spostati: 0, cambiatiNelFrattempo: 0 };

  const utenti = [...new Set(schede.map((r) => r.user_id))];
  const { data: cont, error: e2 } = await db()
    .from("whatsapp_contacts")
    .select("user_id, phone_e164, ultimo_in_entrata_il, non_scrivere_dal")
    .in("user_id", utenti);
  if (e2) throw e2;
  const perNumero = new Map<string, ContattoWa>();
  for (const c of (cont ?? []) as Contatto[])
    perNumero.set(`${c.user_id}|${nove(c.phone_e164)}`, {
      ultimoInEntrataIl: c.ultimo_in_entrata_il,
      stop: !!c.non_scrivere_dal,
    });

  let spostati = 0;
  let cambiati = 0;
  for (const r of schede) {
    const contatto = perNumero.get(`${r.user_id}|${nove(r.data?.telefono)}`);
    const patch = patchDaChiamare(r.data, contatto, adesso);
    if (!patch) continue;
    const { data: scritte, error: e3 } = await db()
      .from("crm_leads")
      .update({ data: { ...r.data, ...patch }, updated_at: adesso.toISOString() })
      .eq("id", r.id)
      .eq("updated_at", r.updated_at)
      .select("id");
    if (e3) throw e3;
    if (scritte?.length) spostati++;
    else cambiati++;
  }
  return { inAttesa: schede.length, spostati, cambiatiNelFrattempo: cambiati };
}

export const Route = createFileRoute("/hooks/attesa-da-chiamare")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        const attesa = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
        if (!auth || !auth.includes(attesa || "__mancante__"))
          return json({ error: "unauthorized" }, 401);
        try {
          return json(await giroAttesaDaChiamare());
        } catch (e) {
          const code = (e as { code?: unknown } | null)?.code;
          console.error("[attesa-da-chiamare]", typeof code === "string" ? code : "errore");
          return json({ error: "giro interrotto" }, 500);
        }
      },
    },
  },
});
