/** ── LE PORTE VERE DI MANYCHAT: LA PARTE «RISPOSTA» ────────────────────────
 *
 *  Commessa 2026-10-23, compito U2. Il collegamento fra la logica pura di
 *  `risposta.ts` e Supabase: nessuna regola qui, solo letture e scritture.
 *  (La parte del giro la aggiunge il compito 3, sotto, nello stesso file.)
 *
 *  ⚠️ Tutto con la chiave di servizio, sempre con `user_id` nel filtro: la RLS
 *   qui non vale, quindi la scheda o il contatto di un'altra installazione non
 *   si devono poter toccare.
 *  ⚠️ Chi legge o scrive LANCIA con `{ code }` se il database dice di no: la
 *   logica registra solo il codice. Mai il messaggio d'errore (può contenere
 *   dati del cliente).
 *  ⚠️ Mai una chiamata fuori dal database.
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STATI_CON_MESSAGGIO } from "../promemoria/risposta";
import type { PorteRisposta as PorteConferma } from "../promemoria/in-entrata";
import type { InvioAbbinabile } from "./ritorno";
import type { PorteRispostaManychat } from "./risposta";

type ErroreDb = { code?: string | null; message?: string | null } | null;
type Esito<T> = PromiseLike<{ data: T | null; error: ErroreDb }>;
interface Filtro<T> extends Esito<T> {
  eq(c: string, v: string | number): Filtro<T>;
  in(c: string, v: string[]): Filtro<T>;
  gte(c: string, v: string): Filtro<T>;
  or(filtri: string): Filtro<T>;
  order(c: string, o: { ascending: boolean }): Filtro<T>;
  limit(n: number): Filtro<T>;
  maybeSingle(): Esito<T extends (infer U)[] ? U : T>;
}
/** I tipi generati non conoscono le tabelle nuove né le colonne nuove. */
const db = () =>
  supabaseAdmin as unknown as {
    from(t: string): {
      select<T = Record<string, unknown>[]>(c: string): Filtro<T>;
      insert(v: Record<string, unknown>): Esito<unknown>;
      upsert(v: Record<string, unknown>, o: { onConflict: string }): Esito<unknown>;
      update(v: Record<string, unknown>): Filtro<unknown>;
    };
    rpc(fn: string, a: Record<string, unknown>): Esito<unknown>;
  };

/** Il database dice di no: si lancia SOLO il codice. */
const lancia = (e: NonNullable<ErroreDb>): never => {
  throw { code: e.code ?? "?" };
};
/** La tabella (o la cache dello schema) non ha ancora la migrazione M1. */
const tabellaMancante = (e: NonNullable<ErroreDb>) =>
  ["42P01", "PGRST205", "42703", "PGRST204"].includes(String(e.code ?? ""));

/** Lo stesso numero come l'ha scritto qualcuno: col «+» (le righe nuove) e senza
 *  (le righe vecchie). */
const formati = (telefono: string) => [`+${telefono}`, telefono];

interface RigaInvio {
  id: string;
  lead_id: string | null;
  telefono: string;
  subscriber_id: string | null;
  prenotato_il: string;
  stato: string;
}

export function porteRisposta(): PorteRispostaManychat {
  return {
    avviso: (m) => console.warn("[manychat-risposta]", m),

    utente: async () => {
      const { data, error } = await db()
        .from("manychat_config")
        .select<{ user_id: string | null }[]>("user_id")
        .eq("id", 1)
        .maybeSingle();
      if (error) {
        if (tabellaMancante(error)) return { userId: null, motivo: "manca_migrazione" };
        return lancia(error);
      }
      const id = data?.user_id;
      return id ? { userId: id } : { userId: null, motivo: "non_configurato" };
    },

    invii: async ({ userId, crmInvioId, subscriberId, telefono, dal }) => {
      //  ⚠️ I tre valori sono già ripuliti (uuid, cifre): niente di libero nel filtro.
      const o: string[] = [];
      if (crmInvioId) o.push(`id.eq.${crmInvioId}`);
      if (subscriberId) o.push(`subscriber_id.eq.${subscriberId}`);
      if (telefono) o.push(`telefono.eq.${telefono}`);
      if (o.length === 0) return [];
      const { data, error } = await db()
        .from("manychat_invii")
        .select<RigaInvio[]>("id, lead_id, telefono, subscriber_id, prenotato_il, stato")
        .eq("user_id", userId)
        .gte("prenotato_il", dal.toISOString())
        .or(o.join(","))
        .order("prenotato_il", { ascending: false })
        .limit(50);
      if (error) return lancia(error);
      return (data ?? []).map(
        (r): InvioAbbinabile => ({
          id: r.id,
          leadId: r.lead_id,
          telefono: r.telefono,
          subscriberId: r.subscriber_id,
          prenotatoIl: r.prenotato_il,
          stato: r.stato,
        }),
      );
    },

    contattoNoto: async (userId, telefono) => {
      const { data, error } = await db()
        .from("whatsapp_contacts")
        .select<{ lead_id: string | null }[]>("lead_id")
        .eq("user_id", userId)
        .in("phone_e164", formati(telefono))
        .limit(1);
      if (error) return lancia(error);
      return data && data.length > 0 ? { leadId: data[0].lead_id } : null;
    },

    registraMessaggio: async (userId, m) => {
      const { error } = await db()
        .from("whatsapp_messages")
        .insert({
          user_id: userId,
          lead_id: m.leadId,
          direction: "inbound",
          from_number: `+${m.telefono}`,
          to_number: "manychat",
          body: m.testo,
          wa_message_id: m.waId,
          status: "delivered",
          canale: "manychat",
          raw_payload: {},
        });
      //  23505 = `wa_message_id` già c'è: la stessa risposta è arrivata due volte.
      if (error) return error.code === "23505" ? "doppione" : lancia(error);
      return "nuovo";
    },

    aggiornaContatto: async (userId, { telefono, leadId, adesso }) => {
      const { data, error } = await db()
        .from("whatsapp_contacts")
        .select<{ id: string; lead_id: string | null }[]>("id, lead_id")
        .eq("user_id", userId)
        .in("phone_e164", formati(telefono))
        .limit(1);
      if (error) return lancia(error);
      //  shortcut: `unread_count` sempre 1, come fa il webhook di Meta; un
      //  contatore vero (+1) quando la chat mostrerà i non letti per ManyChat.
      const ora = adesso.toISOString();
      const esiste = data?.[0];
      if (esiste) {
        const { error: e2 } = await db()
          .from("whatsapp_contacts")
          .update({
            last_message_at: ora,
            unread_count: 1,
            ...(leadId && !esiste.lead_id ? { lead_id: leadId } : {}),
          })
          .eq("id", esiste.id)
          .eq("user_id", userId);
        if (e2) lancia(e2);
        return;
      }
      const { error: e3 } = await db()
        .from("whatsapp_contacts")
        .upsert(
          {
            user_id: userId,
            phone_e164: `+${telefono}`,
            ...(leadId ? { lead_id: leadId } : {}),
            last_message_at: ora,
            unread_count: 1,
          },
          { onConflict: "user_id,phone_e164" },
        );
      if (e3) lancia(e3);
    },

    conferma: (userId, telefono, adesso): PorteConferma => ({
      schedeConMessaggio: async () => {
        const { data, error } = await db()
          .from("crm_leads")
          .select<{ id: string; data: Record<string, unknown> }[]>("id, data")
          .eq("user_id", userId)
          .in("data->promemoria->>stato", [...STATI_CON_MESSAGGIO]);
        //  Un errore NON è «nessuna scheda»: altrimenti il SÌ si perderebbe in silenzio.
        if (error) return lancia(error);
        return data ?? [];
      },
      //  Solo la funzione SQL, che tocca `data.promemoria` e basta: il browser
      //  potrebbe star scrivendo la stessa scheda.
      aggiorna: async (id, pezzo, seChiave) => {
        const { error } = await db().rpc("promemoria_aggiorna", {
          p_id: id,
          p_patch: pezzo,
          p_se_chiave: seChiave,
        });
        return { error };
      },
      segnaStop: async () => {
        const { error } = await db()
          .from("whatsapp_contacts")
          .update({ non_scrivere_dal: adesso.toISOString() })
          .eq("user_id", userId)
          .in("phone_e164", formati(telefono));
        return { error };
      },
      avviso: (m) => console.warn("[manychat-risposta] conferma:", m),
    }),
  };
}
