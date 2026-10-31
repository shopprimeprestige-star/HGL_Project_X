/** ── LE PORTE VERE DELLE AZIONI SUI MEDIA DEL PONTE ──────────────────────────
 *
 *  Commessa 2026-10-31-media-e-archiviazione, compito T3 (PIANO c.1, c.3, c2,
 *  d.3). Il collegamento fra `media-azioni.ts` (la logica) e Supabase: nessuna
 *  regola qui, solo le funzioni SQL di (e) (`richiedi`, `prendi`,
 *  `richiesta_esito`, `timer`, `da_liberare`, `liberato`, `scadute`, `orfani`,
 *  `pulizia`), la lettura dell'interruttore e delle richieste, e la rimozione da
 *  Storage. Il database, `lancia` e l'utente stanno in `media-db.server.ts` (T2).
 *
 *  ⚠️ Chiave di servizio (la RLS qui non vale): l'utente viene SOLO da
 *   `manychat_config` (riga `id=1`) e va in ogni filtro e in ogni `p_user_id`.
 *  ⚠️ Le porte LANCIANO `{ code }` se il database o Storage dicono di no: mai il
 *   messaggio d'errore, che può contenere numeri, percorsi o indirizzi firmati.
 *  ⚠️ Il database si scrive solo con le funzioni SQL: nessun insert/update/delete
 *   diretto qui. Storage: UN solo `remove`, del SOLO bucket costante
 *   `BUCKET_MEDIA`, con percorsi che `media-azioni.ts` ha già controllato (forma e
 *   cartella) e che vengono dal database, mai dal browser.
 *  ⚠️ Nei log solo `[ponte-media] <codice>` e contatori numerici.
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { dbMedia as db, lancia, utenteDelPonte } from "./media-db.server";
import {
  RICHIESTA_SCADE_MINUTI,
  type EsitoRichiediSql,
  type EsitoTimerSql,
  type PorteMediaAzioni,
  type ScadutaSql,
  type VoceMedia,
} from "./media-azioni-tipi";
import { BUCKET_MEDIA, CHIAVE_INTERRUTTORE } from "./media-tipi";

/** «Una volta per processo»: l'hook gira ogni minuto, e senza migrazione ogni giro darebbe la stessa riga. */
let migrazioneAvvisata = false;

const TABELLA_RICHIESTE = "ponte_wa_media_richieste";

export function porteMediaAzioni(): PorteMediaAzioni {
  return {
    avviso(codice, conteggi) {
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
      if (
        codice === "media_database" ||
        codice === "media_storage" ||
        codice === "media_non_valido" ||
        codice === "media_percorso"
      )
        console.warn(riga);
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

    richiedi: async (userId, chiave, timerS) => {
      const { data, error } = await db().rpc<EsitoRichiediSql>("ponte_wa_media_richiedi", {
        p_user_id: userId,
        p_chiave: chiave,
        p_timer_s: timerS,
      });
      if (error) return lancia(error);
      return data as EsitoRichiediSql;
    },

    prendi: async (userId, max) => {
      const { data, error } = await db().rpc<string[]>("ponte_wa_media_prendi", {
        p_user_id: userId,
        p_max: max,
      });
      if (error) return lancia(error);
      return data ?? [];
    },

    richiestaEsito: async (userId, chiave, esito) => {
      const { error } = await db().rpc<unknown>("ponte_wa_media_richiesta_esito", {
        p_user_id: userId,
        p_chiave: chiave,
        p_esito: esito,
      });
      if (error) return lancia(error);
    },

    //  Le richieste che aspettano il Mac: `in_attesa`, più le `in_corso` da troppo (rientrano in `prendi`).
    inAttesa: async (userId) => {
      const attesa = await db()
        .from(TABELLA_RICHIESTE)
        .select<{ chiave: string }[]>("chiave")
        .eq("user_id", userId)
        .eq("stato", "in_attesa");
      if (attesa.error) return lancia(attesa.error);
      const corso = await db()
        .from(TABELLA_RICHIESTE)
        .select<{ presa_il: string | null }[]>("presa_il")
        .eq("user_id", userId)
        .eq("stato", "in_corso");
      if (corso.error) return lancia(corso.error);
      const limite = Date.now() - RICHIESTA_SCADE_MINUTI * 60e3;
      //  Senza ora di presa (non dovrebbe esistere) vale «vecchia»: non resta ferma per sempre.
      const vecchie = (corso.data ?? []).filter((r) => {
        const t = Date.parse(r.presa_il ?? "");
        return !Number.isFinite(t) || t <= limite;
      }).length;
      return (attesa.data?.length ?? 0) + vecchie;
    },

    timer: async (userId, chiave, secondi) => {
      const { data, error } = await db().rpc<EsitoTimerSql>("ponte_wa_media_timer", {
        p_user_id: userId,
        p_chiave: chiave,
        p_secondi: secondi,
      });
      if (error) return lancia(error);
      return data as EsitoTimerSql;
    },

    daLiberare: async (userId, numero, chiavi, limite) => {
      const { data, error } = await db().rpc<VoceMedia[]>("ponte_wa_media_da_liberare", {
        p_user_id: userId,
        p_numero: numero,
        p_chiavi: chiavi,
        p_limite: limite,
      });
      if (error) return lancia(error);
      return data ?? [];
    },

    //  L'unico `remove`: il bucket è la costante, i percorsi li ha già controllati `media-azioni.ts`.
    //  Un oggetto già assente non dà errore (idempotente). I byte tolti, se Storage li dice.
    rimuovi: async (paths) => {
      const { data, error } = await supabaseAdmin.storage.from(BUCKET_MEDIA).remove(paths);
      if (error) return lancia({ code: "storage" });
      let byte = 0;
      for (const o of (data ?? []) as { metadata?: { size?: unknown } | null }[]) {
        const b = o?.metadata?.size;
        if (typeof b === "number" && Number.isFinite(b) && b > 0) byte += b;
      }
      return byte;
    },

    liberato: async (userId, voci) => {
      const { data, error } = await db().rpc<number>("ponte_wa_media_liberato", {
        p_user_id: userId,
        p_voci: voci,
      });
      if (error) return lancia(error);
      return typeof data === "number" ? data : 0;
    },

    scadute: async (limite) => {
      const { data, error } = await db().rpc<ScadutaSql[]>("ponte_wa_media_scadute", {
        p_limite: limite,
      });
      if (error) return lancia(error);
      return data ?? [];
    },

    orfani: async (limite) => {
      const { data, error } = await db().rpc<string[]>("ponte_wa_media_orfani", {
        p_limite: limite,
      });
      if (error) return lancia(error);
      return data ?? [];
    },

    pulizia: async () => {
      const { error } = await db().rpc<unknown>("ponte_wa_media_pulizia", {});
      if (error) return lancia(error);
    },
  };
}
