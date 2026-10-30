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
import {
  BOZZA_ENTRO_ORE,
  CHIAVE_BATTITO,
  MESSAGGI_CONTESTO,
  colonnaMancante,
  tempoDiCercareBozza,
  type ContattoBozza,
  type MessaggioRiga,
} from "./regole";
import {
  preparaBozza,
  type LettureBozza,
  type PorteRisposteAi,
  type RichiestaInCoda,
} from "./ingresso";

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

/** L'ultima ricerca a vuoto di una bozza (per istanza del server).
 *  shortcut: la memoria è di un'istanza sola, con più istanze la ricerca si fa
 *  qualche volta in più; basta per tenere leggero il database, da rivedere se
 *  le richieste del Mac diventano molte. */
let ultimaRicercaBozza = 0;

/** Le letture della bozza automatica sul database vero. Ognuna filtra per utente. */
const lettureBozza = (userId: string): LettureBozza => ({
  automaticheRecenti: async (adesso) => {
    const da = new Date(adesso.getTime() - BOZZA_ENTRO_ORE * 3_600_000).toISOString();
    const r: Esito<{ id: string }[]> = await db()
      .from("wa_risposte_ai")
      .select("id")
      .eq("user_id", userId)
      .eq("automatica", true)
      .gte("creata_il", da)
      .limit(200);
    if (r.error) return lancia(r.error);
    return r.data?.length ?? 0;
  },

  contatti: async (adesso) => {
    const da = new Date(adesso.getTime() - BOZZA_ENTRO_ORE * 3_600_000).toISOString();
    const r: Esito<ContattoBozza[]> = await db()
      .from("whatsapp_contacts")
      .select("phone_e164, lead_id, ultimo_in_entrata_il, risposto_il, non_scrivere_dal")
      .eq("user_id", userId)
      .not("lead_id", "is", null)
      .is("non_scrivere_dal", null)
      .gte("ultimo_in_entrata_il", da)
      .order("ultimo_in_entrata_il", { ascending: false })
      .limit(40);
    if (r.error) return lancia(r.error);
    return r.data ?? [];
  },

  messaggi: async (telefono) => {
    const [a, b] = forme(telefono);
    const r: Esito<MessaggioRiga[]> = await db()
      .from("whatsapp_messages")
      .select(COLONNE_MSG)
      .eq("user_id", userId)
      .or(`from_number.eq.${a},to_number.eq.${a},from_number.eq.${b},to_number.eq.${b}`)
      .is("duplicato_di", null)
      .order("created_at", { ascending: false })
      .limit(10);
    if (r.error) return lancia(r.error);
    return r.data ?? [];
  },

  richiestaDopo: async (telefono, dopo) => {
    const r: Esito<{ id: string }[]> = await db()
      .from("wa_risposte_ai")
      .select("id")
      .eq("user_id", userId)
      .in("telefono", forme(telefono))
      .gt("creata_il", dopo)
      .limit(1);
    if (r.error) return lancia(r.error);
    return (r.data?.length ?? 0) > 0;
  },

  schedaEsiste: async (leadId) => {
    const r: Esito<{ id: string }> = await db()
      .from("crm_leads")
      .select("id")
      .eq("id", leadId)
      .eq("user_id", userId)
      .maybeSingle();
    if (r.error) return lancia(r.error);
    return Boolean(r.data);
  },

  crea: async (telefono, leadId, scelti) => {
    const r: Esito<RichiestaInCoda> = await db()
      .from("wa_risposte_ai")
      .insert({
        user_id: userId,
        telefono,
        lead_id: leadId,
        messaggi: scelti,
        automatica: true,
        //  Nasce già presa: la rotta la dà al Mac subito, nessun altro la prende.
        stato: "in_lavoro",
        presa_il: new Date().toISOString(),
      })
      .select("id, telefono, messaggi, indicazione")
      .single();
    if (r.error || !r.data) return lancia(r.error ?? new Error("bozza_non_scritta"));
    return { ...r.data, messaggi: r.data.messaggi ?? [], orari: null };
  },
});

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
        ? {
            id: r.id,
            telefono: r.telefono,
            messaggi: r.messaggi ?? [],
            indicazione: r.indicazione,
            orari: r.orari ?? null,
            modo: r.modo === "rispiega" ? "rispiega" : "rispondi",
          }
        : null;
    },

    //  Mai un errore verso il Mac: la bozza è un di più. Senza la colonna
    //  `automatica` (migrazione non applicata) si tace e tutto va come prima.
    bozza: async (userId) => {
      const adesso = Date.now();
      if (!tempoDiCercareBozza(ultimaRicercaBozza, adesso)) return null;
      try {
        const q = await preparaBozza(lettureBozza(userId), new Date(adesso));
        //  Trovata: il Mac richiede subito, può essercene un'altra; a vuoto si aspetta.
        ultimaRicercaBozza = q ? 0 : adesso;
        return q;
      } catch (e) {
        ultimaRicercaBozza = adesso;
        if (!colonnaMancante(e as { code?: string }))
          console.warn("[risposte-ai] bozza_non_preparata");
        return null;
      }
    },

    messaggiChat: async (userId, telefono, scelti, soloScelti) => {
      const [a, b] = forme(telefono);
      const filtro = `from_number.eq.${a},to_number.eq.${a},from_number.eq.${b},to_number.eq.${b}`;
      //  «Rispiega con AI»: del resto della chat non serve niente, non si legge nemmeno.
      const ultimi: Esito<MessaggioRiga[]> = soloScelti
        ? { data: [], error: null }
        : await db()
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
