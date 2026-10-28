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
import { telefonoE164 } from "@/crm/chatwa/daChiamare";
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

/** Le schede in «Attesa WhatsApp», tutte: PostgREST ne dà al massimo 1000 per
 *  volta, quindi si legge a pagine, in ordine fisso (revisione del 28/10). */
async function schedeInAttesa(): Promise<Riga[]> {
  const out: Riga[] = [];
  const PAGINA = 1000;
  for (let da = 0; ; da += PAGINA) {
    const { data, error } = await db()
      .from("crm_leads")
      .select("id, user_id, data, updated_at")
      .eq("data->>stato", "attesa_whatsapp")
      .order("id", { ascending: true })
      .range(da, da + PAGINA - 1);
    if (error) throw error;
    const righe = (data ?? []) as Riga[];
    out.push(...righe);
    if (righe.length < PAGINA) return out;
  }
}

/** I contatti WhatsApp dei SOLI numeri candidati, a blocchi: leggere tutta la
 *  rubrica si fermava a 1000 righe, e chi restava fuori sembrava «senza
 *  risposta e senza STOP» (revisione del 28/10). */
async function contattiDi(candidati: Riga[]): Promise<Map<string, ContattoWa>> {
  const perNumero = new Map<string, ContattoWa>();
  const perUtente = new Map<string, Set<string>>();
  for (const r of candidati) {
    const tel = telefonoE164(r.data?.telefono);
    if (!tel) continue;
    const insieme = perUtente.get(r.user_id) ?? new Set<string>();
    insieme.add(tel);
    perUtente.set(r.user_id, insieme);
  }
  for (const [userId, numeri] of perUtente) {
    const elenco = [...numeri];
    for (let i = 0; i < elenco.length; i += 100) {
      const { data, error } = await db()
        .from("whatsapp_contacts")
        .select("user_id, phone_e164, ultimo_in_entrata_il, non_scrivere_dal")
        .eq("user_id", userId)
        .in("phone_e164", elenco.slice(i, i + 100));
      if (error) throw error;
      for (const c of (data ?? []) as Contatto[])
        perNumero.set(`${c.user_id}|${nove(c.phone_e164)}`, {
          ultimoInEntrataIl: c.ultimo_in_entrata_il,
          stop: !!c.non_scrivere_dal,
        });
    }
  }
  return perNumero;
}

export async function giroAttesaDaChiamare(adesso = new Date()) {
  const schede = await schedeInAttesa();
  if (schede.length === 0) return { inAttesa: 0, spostati: 0, cambiatiNelFrattempo: 0 };
  //  Prima chi ha già passato le 10 ore (senza guardare la rubrica), poi i
  //  contatti dei soli candidati.
  const candidati = schede.filter((r) => patchDaChiamare(r.data, null, adesso));
  const perNumero = await contattiDi(candidati);

  let spostati = 0;
  let cambiati = 0;
  for (const r of candidati) {
    //  Un numero che non si sa scrivere nel formato delle chat non si può
    //  controllare in rubrica: meglio lasciarlo in attesa che spostarlo alla cieca.
    if (!telefonoE164(r.data?.telefono)) continue;
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
