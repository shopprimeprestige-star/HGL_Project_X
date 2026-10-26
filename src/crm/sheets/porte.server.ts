/** ── LE PORTE VERE DELL'INGRESSO DAL FOGLIO ────────────────────────────────
 *
 *  Commessa 2026-10-25, compito S. Il collegamento fra la logica pura
 *  (`sheets/ingresso.ts`) e Supabase: nessuna regola qui, solo letture e
 *  scritture. Prove della logica in `prove/sheets/ingresso.mjs`.
 *
 *  ⚠️ Tutto con la chiave di servizio, sempre con `user_id` nel filtro: la RLS
 *   qui non vale, quindi la scheda di un'altra installazione non si deve poter
 *   toccare.
 *  ⚠️ Chi legge o scrive LANCIA con `{ code }` se il database dice di no. MAI il
 *   messaggio: l'errore di Postgres su `crm_leads` («Failing row contains …»)
 *   contiene il `data` della scheda, cioè nome e telefono.
 *  ⚠️ Mai una chiamata fuori dal database. */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { LeadData } from "../types";
import type { PorteIngresso } from "./ingresso";

type ErroreDb = { code?: string | null } | null;
type Esito<T> = PromiseLike<{ data: T | null; error: ErroreDb }>;
interface Filtro<T> extends Esito<T> {
  eq(c: string, v: string | number): Filtro<T>;
  select(c: string): Filtro<T>;
  maybeSingle(): Esito<T extends (infer U)[] ? U : T>;
}
/** I tipi generati non conoscono le funzioni nuove. */
const db = () =>
  supabaseAdmin as unknown as {
    from(t: string): {
      select<T = Record<string, unknown>[]>(c: string): Filtro<T>;
      update(v: Record<string, unknown>): Filtro<{ id: string }[]>;
    };
    rpc(fn: string, a: Record<string, unknown>): Esito<unknown>;
  };

/** Il database dice di no: si lancia SOLO il codice. */
const lancia = (e: NonNullable<ErroreDb>): never => {
  throw { code: e.code ?? "?" };
};

export function porteIngresso(): PorteIngresso {
  return {
    utente: async () => {
      const { data, error } = await db()
        .from("manychat_config")
        .select<{ user_id: string | null }[]>("user_id")
        .eq("id", 1)
        .maybeSingle();
      if (error) return lancia(error);
      return data?.user_id ?? null;
    },

    scrivi: async (i) => {
      const { data, error } = await db().rpc("sheets_ingresso_scrivi", {
        p_user_id: i.userId,
        p_chiave: i.chiave,
        p_tel9: i.tel9,
        p_meta_id: i.metaId,
        p_foglio: i.foglio,
        p_riga: i.riga,
        p_data: i.data,
      });
      if (error) return lancia(error);
      const r = (data ?? {}) as { esito?: string; lead_id?: string; stato?: string };
      return {
        esito: r.esito as "nuovo",
        ...(r.lead_id ? { leadId: r.lead_id } : {}),
        ...(r.stato ? { stato: r.stato } : {}),
      };
    },

    leggiScheda: async (userId, leadId) => {
      const { data, error } = await db()
        .from("crm_leads")
        .select<{ data: Partial<LeadData>; updated_at: string }[]>("data, updated_at")
        .eq("id", leadId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) return lancia(error);
      return data ? { data: data.data ?? {}, versione: data.updated_at } : null;
    },

    //  ⚠️ Si scrive SOLO se `updated_at` è ancora quello letto (la firma della
    //   versione, come `updateLead`), e `.select("id")` dice se ha toccato una riga:
    //   senza, una `update` che non trova niente risponderebbe «tutto bene».
    scriviScheda: async (userId, leadId, data, versione) => {
      const { data: scritte, error } = await db()
        .from("crm_leads")
        .update({ data })
        .eq("id", leadId)
        .eq("user_id", userId)
        .eq("updated_at", versione)
        .select("id");
      if (error) return lancia(error);
      return (scritte?.length ?? 0) > 0;
    },

    chiudi: async ({ userId, chiave, esito }) => {
      const { data, error } = await db().rpc("sheets_ingresso_esito", {
        p_user_id: userId,
        p_chiave: chiave,
        p_esito: esito,
      });
      if (error) return lancia(error);
      return data === true;
    },
  };
}
