/** ── LE PORTE VERE DEI MEDIA DEL PONTE ───────────────────────────────────────
 *
 *  Commessa 2026-10-30-ponte-storico-completo, compito T5 (PIANO c.3, c.4),
 *  estesa il 31/10 (commessa 2026-10-31-media-e-archiviazione, compito T2). Il
 *  collegamento fra `media.ts` (la logica) e Supabase: nessuna regola qui, solo
 *  le funzioni SQL `ponte_wa_media_permesso`, `_fatto` e `_dettagli`, la lettura
 *  dell'interruttore, delle richieste `in_corso` e della riga `pronta`, e le
 *  firme e la rimozione di Storage. Il database, `lancia` e l'utente stanno in
 *  `media-db.server.ts` (li usa anche T3).
 *
 *  ⚠️ Chiave di servizio (la RLS qui non vale): l'utente viene SOLO da
 *   `manychat_config` (riga `id=1`) o dalla sessione già confrontata con essa, e
 *   va in ogni filtro e in ogni `p_user_id`.
 *  ⚠️ Le porte LANCIANO `{ code }` se il database dice di no: mai il messaggio
 *   d'errore, che può contenere numeri, percorsi o indirizzi firmati.
 *  ⚠️ Il database si scrive solo con le funzioni SQL: nessun insert/update
 *   diretto qui. Storage: firma di carico, firma di lettura, e `remove` di UN
 *   percorso (già controllato da `media.ts`) del solo bucket `ponte-media`.
 *  ⚠️ Nei log solo `[ponte-media] <codice>` e contatori numerici.
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { oggettoAssente, percorsoDi } from "./media";
import { dbMedia as db, lancia, utenteDelPonte } from "./media-db.server";
import {
  BUCKET_MEDIA,
  CHIAVE_INTERRUTTORE,
  type CodiceAvvisoMedia,
  type EsitoFattoSql,
  type EsitoPermessoSql,
  type PorteMedia,
  type RigaMediaPronta,
} from "./media-tipi";

/** «Una volta per processo»: il Mac ritenta, e senza migrazione ogni
 *  tentativo darebbe la stessa riga di log. */
let migrazioneAvvisata = false;

export function porteMedia(): PorteMedia {
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

    utente: utenteDelPonte,

    interruttore: async () => {
      const { data, error } = await db()
        .from("app_config")
        .select<{ value: unknown }[]>("value")
        .eq("key", CHIAVE_INTERRUTTORE)
        .maybeSingle();
      if (error) return lancia(error);
      return data?.value ?? null;
    },

    //  Il Worker non si fida di `richiesto`: serve una richiesta `in_corso` di QUESTO utente per QUELLA chiave.
    richiestaInCorso: async (userId, chiave) => {
      const { data, error } = await db()
        .from("ponte_wa_media_richieste")
        .select<{ chiave: string }[]>("chiave")
        .eq("user_id", userId)
        .eq("chiave", chiave)
        .eq("stato", "in_corso")
        .maybeSingle();
      if (error) return lancia(error);
      return !!data;
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

    dettagli: async (userId, chiave, d) => {
      const { error } = await db().rpc<null>("ponte_wa_media_dettagli", {
        p_user_id: userId,
        p_chiave: chiave,
        p_nome: d.nome,
        p_durata_s: d.durata_s,
        p_larghezza: d.larghezza,
        p_altezza: d.altezza,
        p_miniatura: d.miniatura,
      });
      if (error) return lancia(error);
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

    //  Un oggetto solo, del solo bucket dei media: il percorso lo ha già controllato `media.ts`.
    rimuovi: async (path) => {
      const { error } = await supabaseAdmin.storage.from(BUCKET_MEDIA).remove([path]);
      if (error) return lancia({ code: "storage" });
    },

    //  Per nome del file (`<utente>/<uuid>.<ext>`): l'indirizzo della GET non porta il numero del cliente.
    percorsoPronto: async (userId, id) => {
      const { data, error } = await db()
        .from("ponte_wa_media")
        .select<RigaMediaPronta[]>("path,categoria,mime,nome")
        .eq("user_id", userId)
        .eq("path", percorsoDi(userId, id))
        .eq("stato", "pronta")
        .maybeSingle();
      if (error) return lancia(error);
      return typeof data?.path === "string" ? data : null;
    },

    //  Un oggetto assente (404) non è un guasto: la rotta dice 404. Un altro errore di Storage
    //  (429, 5xx, rete) sì: si lancia e la rotta dice 503, così la chat lascia Riprova.
    //  Con `download` il link serve il file come allegato con quel nome (documenti non PDF).
    firmaLettura: async (path, secondi, opzioni) => {
      const { data, error } = await supabaseAdmin.storage
        .from(BUCKET_MEDIA)
        .createSignedUrl(
          path,
          secondi,
          opzioni?.download ? { download: opzioni.download } : undefined,
        );
      if (error) return oggettoAssente(error) ? null : lancia({ code: "storage" });
      return data?.signedUrl ?? null;
    },
  };
}
