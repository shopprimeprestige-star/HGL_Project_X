/** ── RISPOSTE AI: LE PORTE VERE (DATABASE) ───────────────────────────────────
 *
 *  Con il client di servizio, perché il Mac non è un utente collegato. Per
 *  questo OGNI lettura e scrittura porta `.eq("user_id", userId)`, e l'utente
 *  è quello dell'installazione (`manychat_config`, riga 1), come nel ponte.
 *  Il contratto e la logica sono in `ingresso.ts`.
 *  ⚠️ Nei log solo codici (`[risposte-ai] codice`).
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { LeadData } from "@/crm/types";
import { CHIAVE_BATTITO, MESSAGGI_CONTESTO, type MessaggioRiga } from "./regole";
import type { PorteRisposteAi, RichiestaInCoda } from "./ingresso";

type Esito<T> = { data: T | null; error: { message?: string; code?: string } | null };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabaseAdmin as any;

const lancia = (e: unknown): never => {
  throw e;
};

/** Le due forme del numero, come le scrive il resto del CRM. */
const forme = (telefono: string) => {
  const d = telefono.replace(/\D/g, "");
  return [`+${d}`, d];
};

const COLONNE_MSG = "id, direction, body, created_at";

export function porteRisposteAi(): PorteRisposteAi {
  return {
    avviso: (codice) => console.warn(`[risposte-ai] ${codice}`),

    utente: async () => {
      const { data, error }: Esito<{ user_id: string | null }> = await db()
        .from("manychat_config")
        .select("user_id")
        .eq("id", 1)
        .maybeSingle();
      if (error) return lancia(error);
      return data?.user_id || null;
    },

    battito: async () => {
      //  `app_config` è dello studio (non ha `user_id`): ci va solo l'ora.
      const { error } = await db().from("app_config").upsert(
        {
          key: CHIAVE_BATTITO,
          value: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
      if (error) console.warn("[risposte-ai] battito_non_scritto");
    },

    prendi: async (userId) => {
      const { data, error }: Esito<RichiestaInCoda[]> = await db().rpc("risposte_ai_prendi", {
        p_user_id: userId,
      });
      if (error) return lancia(error);
      const r = data?.[0];
      return r
        ? { id: r.id, telefono: r.telefono, messaggi: r.messaggi ?? [], indicazione: r.indicazione }
        : null;
    },

    messaggiChat: async (userId, telefono, scelti) => {
      const [a, b] = forme(telefono);
      const filtro = `from_number.eq.${a},to_number.eq.${a},from_number.eq.${b},to_number.eq.${b}`;
      const ultimi: Esito<MessaggioRiga[]> = await db()
        .from("whatsapp_messages")
        .select(COLONNE_MSG)
        .eq("user_id", userId)
        .or(filtro)
        .is("duplicato_di", null)
        .order("created_at", { ascending: false })
        .limit(MESSAGGI_CONTESTO);
      if (ultimi.error) return lancia(ultimi.error);
      //  I scelti anche se più vecchi degli ultimi: ma solo di QUESTA chat.
      const vecchi: Esito<MessaggioRiga[]> = scelti.length
        ? await db()
            .from("whatsapp_messages")
            .select(COLONNE_MSG)
            .eq("user_id", userId)
            .or(filtro)
            .in("id", scelti)
        : { data: [], error: null };
      if (vecchi.error) return lancia(vecchi.error);
      const tutti = new Map<string, MessaggioRiga>();
      for (const m of [...(ultimi.data ?? []), ...(vecchi.data ?? [])]) tutti.set(m.id, m);
      return [...tutti.values()];
    },

    scheda: async (userId, telefono) => {
      const contatto: Esito<{ lead_id: string | null }[]> = await db()
        .from("whatsapp_contacts")
        .select("lead_id")
        .eq("user_id", userId)
        .in("phone_e164", forme(telefono))
        .not("lead_id", "is", null)
        .limit(1);
      if (contatto.error) return lancia(contatto.error);
      const leadId = contatto.data?.[0]?.lead_id;
      if (!leadId) return { lead: null, consulente: null };
      const lead: Esito<{ data: Partial<LeadData> | null }> = await db()
        .from("crm_leads")
        .select("data")
        .eq("id", leadId)
        .eq("user_id", userId)
        .maybeSingle();
      if (lead.error) return lancia(lead.error);
      const dati = lead.data?.data ?? null;
      let consulente: string | null = null;
      if (dati?.consulenteId) {
        const c: Esito<{ data: { nome?: string } | null }> = await db()
          .from("crm_consultants")
          .select("data")
          .eq("id", dati.consulenteId)
          .eq("user_id", userId)
          .maybeSingle();
        consulente = c.data?.data?.nome ?? null;
      }
      return { lead: dati, consulente };
    },

    chiudi: async (userId, id, esito) => {
      const { data, error }: Esito<{ id: string }[]> = await db()
        .from("wa_risposte_ai")
        .update({
          ...("risposta" in esito
            ? { stato: "pronta", risposta: esito.risposta }
            : { stato: "errore", errore: esito.errore }),
          finita_il: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", userId)
        .eq("stato", "in_lavoro")
        .select("id");
      if (error) return lancia(error);
      return (data?.length ?? 0) > 0;
    },
  };
}
