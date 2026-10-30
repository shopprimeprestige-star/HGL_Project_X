/** ── LE PORTE VERE DELLE IMMAGINI DEL PONTE ──────────────────────────────────
 *
 *  Commessa 2026-10-30-ponte-storico-completo, compito T5 (PIANO c.3, c.4). Il
 *  collegamento fra `media.ts` (la logica) e Supabase: nessuna regola qui, solo
 *  le due funzioni SQL della migrazione `20261030170000_ponte_immagini`, la
 *  lettura dell'interruttore e della riga `pronta`, e le firme di Storage.
 *
 *  ⚠️ Chiave di servizio (la RLS qui non vale): l'utente viene SOLO da
 *   `manychat_config` (riga `id=1`) o dalla sessione già confrontata con essa, e
 *   va in ogni filtro e in ogni `p_user_id`.
 *  ⚠️ Le porte LANCIANO `{ code }` se il database dice di no: mai il messaggio
 *   d'errore, che può contenere numeri, percorsi o indirizzi firmati.
 *  ⚠️ Il database si scrive solo con le due funzioni (`ponte_wa_media_permesso`,
 *   `ponte_wa_media_fatto`): nessun insert/update diretto qui.
 *  ⚠️ Nei log solo `[ponte-media] <codice>` e contatori numerici.
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  BUCKET_MEDIA,
  CHIAVE_INTERRUTTORE,
  type CodiceAvvisoMedia,
  type EsitoFattoSql,
  type EsitoPermessoSql,
  type PorteMedia,
} from "./media-tipi";

type ErroreDb = { code?: string | null } | null;
type Esito<T> = PromiseLike<{ data: T | null; error: ErroreDb }>;
interface Filtro<T> extends Esito<T> {
  eq(c: string, v: string | number): Filtro<T>;
  maybeSingle(): Esito<T extends (infer U)[] ? U : T>;
}
/** I tipi generati non conoscono la tabella e le funzioni nuove. */
const db = () =>
  supabaseAdmin as unknown as {
    from(t: string): { select<T = Record<string, unknown>[]>(c: string): Filtro<T> };
    rpc<T>(fn: string, a: Record<string, unknown>): Esito<T>;
  };

/** «Una volta per processo»: il Mac ritenta, e senza migrazione ogni
 *  tentativo darebbe la stessa riga di log. */
let migrazioneAvvisata = false;

export function porteMedia(): PorteMedia {
  const lancia = (e: NonNullable<ErroreDb>): never => {
    throw { code: String(e.code ?? "?") };
  };

  return {
    avviso(codice: CodiceAvvisoMedia, conteggi?: Record<string, number>) {
      if (codice === "media_migrazione") {
        if (migrazioneAvvisata) return;
        migrazioneAvvisata = true;
        console.warn("[ponte-media] media_migrazione");
        return;
      }
      const numeri = Object.entries(conteggi ?? {})
        .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
        .map(([k, v]) => ` ${k}=${v}`)
        .join("");
      const riga = `[ponte-media] ${codice}${numeri}`;
      if (codice === "media_database" || codice === "media_non_valido") console.warn(riga);
      else console.info(riga);
    },

    utente: async () => {
      const { data, error } = await db()
        .from("manychat_config")
        .select<{ user_id: string | null }[]>("user_id")
        .eq("id", 1)
        .maybeSingle();
      if (error) return lancia(error);
      return data?.user_id || null;
    },

    interruttore: async () => {
      const { data, error } = await db()
        .from("app_config")
        .select<{ value: unknown }[]>("value")
        .eq("key", CHIAVE_INTERRUTTORE)
        .maybeSingle();
      if (error) return lancia(error);
      return data?.value ?? null;
    },

    permesso: async (userId, p) => {
      const { data, error } = await db().rpc<EsitoPermessoSql>("ponte_wa_media_permesso", {
        p_user_id: userId,
        p_chiave: p.chiave,
        p_numero: p.numero,
        p_mime: p.mime,
        p_byte: p.byte,
        p_tetto_byte: p.tettoByte,
      });
      if (error) return lancia(error);
      return data as EsitoPermessoSql;
    },

    //  Il token di Storage vale per un solo percorso e per ~2 ore, senza `upsert`.
    firmaCarico: async (path) => {
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET_MEDIA)
        .createSignedUploadUrl(path);
      if (error || !data?.signedUrl) return lancia({ code: "storage" });
      return data.signedUrl;
    },

    fatto: async (userId, chiave) => {
      const { data, error } = await db().rpc<EsitoFattoSql>("ponte_wa_media_fatto", {
        p_user_id: userId,
        p_chiave: chiave,
      });
      if (error) return lancia(error);
      return data as EsitoFattoSql;
    },

    percorsoPronto: async (userId, chiave) => {
      const { data, error } = await db()
        .from("ponte_wa_media")
        .select<{ path: string | null }[]>("path")
        .eq("user_id", userId)
        .eq("chiave", chiave)
        .eq("stato", "pronta")
        .maybeSingle();
      if (error) return lancia(error);
      return typeof data?.path === "string" ? data.path : null;
    },

    //  Un oggetto assente non è un guasto: la firma fallisce e la rotta dice 404.
    firmaLettura: async (path, secondi) => {
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET_MEDIA)
        .createSignedUrl(path, secondi);
      return error || !data?.signedUrl ? null : data.signedUrl;
    },
  };
}
