/** ── LE PORTE VERE DEL PONTE WHATSAPP (Baileys) ──────────────────────────────
 *
 *  Commessa 2026-10-29-ponte-whatsapp-baileys, compito T4 (PIANO §b, §e.5).
 *  Il collegamento fra `ingresso.ts` (T3, la logica) e Supabase: nessuna
 *  regola qui, solo le tre funzioni SQL di T1, la lettura delle righe del
 *  ponte per il controllo tardivo e la riga di `ponte_wa_stato`.
 *
 *  ⚠️ Chiave di servizio (la RLS qui non vale): l'utente viene SOLO da
 *   `manychat_config` (riga `id=1`) e va in ogni filtro e in ogni `p_user_id`.
 *  ⚠️ Chi legge o scrive LANCIA `{ code }` se il database dice di no. Mai il
 *   messaggio d'errore: può contenere numeri o testi del cliente.
 *  ⚠️ Le forme JSON passano alle RPC così come sono (`tipi.ts`, congelate).
 *  ⚠️ Nei log solo `[ponte-wa] <codice>` e contatori numerici.
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  CANALE_PONTE,
  cifre,
  type CandidatoCrm,
  type CodiceAvviso,
  type EsitoScrittura,
  type PortePonte,
  type RigaDaAbbinare,
} from "./tipi";

type ErroreDb = { code?: string | null } | null;
type Esito<T> = PromiseLike<{ data: T | null; error: ErroreDb }>;
interface Filtro<T> extends Esito<T> {
  eq(c: string, v: string | number): Filtro<T>;
  is(c: string, v: null): Filtro<T>;
  gte(c: string, v: string): Filtro<T>;
  order(c: string, o: { ascending: boolean }): Filtro<T>;
  limit(n: number): Filtro<T>;
  maybeSingle(): Esito<T extends (infer U)[] ? U : T>;
}
/** I tipi generati non conoscono le funzioni, la tabella e le colonne nuove. */
const db = () =>
  supabaseAdmin as unknown as {
    from(t: string): {
      select<T = Record<string, unknown>[]>(c: string): Filtro<T>;
      upsert(v: Record<string, unknown>, o: { onConflict: string }): Esito<unknown>;
    };
    rpc<T>(fn: string, a: Record<string, unknown>): Esito<T>;
  };

/** La migrazione `20261029120000_ponte_whatsapp.sql` non è applicata (o la
 *  cache dello schema non la vede ancora): funzione, tabella o colonna assente. */
const CODICI_MIGRAZIONE = ["42883", "PGRST202", "42P01", "PGRST205", "42703", "PGRST204"];

/** Il controllo tardivo rilegge al più queste righe del ponte (ultima ora).
 *  shortcut: tetto fisso, basta finché un'ora di messaggi vivi resta sotto
 *  1000; se il ponte li supera, leggere a pagine come `leggiContattiAPagine`. */
const RECENTI_MAX = 1000;

/** «Una volta per processo»: il ponte ritenta, e senza migrazione ogni
 *  tentativo darebbe la stessa riga di log. */
let migrazioneAvvisata = false;

interface RigaPonteDb {
  wa_message_id: string;
  direction: string;
  from_number: string | null;
  to_number: string | null;
  created_at: string;
  body: string | null;
  media_type: string | null;
}

/** Un intero ≥ 0 dal jsonb di `ponte_wa_scrivi` (un campo mancante vale 0). */
const intero = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;

//  Le porte dell'invio a mano: si ripassano da qui perché la rotta del ponte
//  importa solo questo file (commessa 2026-10-30-ponte-invio-manuale).
export { porteInvio } from "./invio.server";

export function porteIngresso(): PortePonte {
  /** Il codice dell'ultimo errore lanciato: `ingresso.ts` riconosce come
   *  «funzioni assenti» solo 42883/PGRST202; una tabella o una colonna
   *  mancante (stessa causa: migrazione non applicata) arriva qui come
   *  `database`, e qui diventa lo stesso avviso unico. */
  let ultimoCodice = "";
  const lancia = (e: NonNullable<ErroreDb>): never => {
    ultimoCodice = String(e.code ?? "?");
    throw { code: ultimoCodice };
  };

  return {
    avviso(codice: CodiceAvviso, conteggi?: Record<string, number>) {
      const daMigrazione =
        codice === "funzioni_assenti" ||
        (codice === "database" && CODICI_MIGRAZIONE.includes(ultimoCodice));
      if (daMigrazione) {
        if (migrazioneAvvisata) return;
        migrazioneAvvisata = true;
        console.warn("[ponte-wa] funzioni_assenti");
        return;
      }
      const numeri = Object.entries(conteggi ?? {})
        .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
        .map(([k, v]) => ` ${k}=${v}`)
        .join("");
      const riga = `[ponte-wa] ${codice}${numeri}`;
      if (
        codice === "lotto" ||
        codice === "battito" ||
        codice === "riconciliati" ||
        codice === "noti"
      )
        console.info(riga);
      else console.warn(riga);
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

    noti: async (userId, numeri) => {
      const { data, error } = await db().rpc<string[]>("ponte_wa_noti", {
        p_user_id: userId,
        p_numeri: numeri,
      });
      if (error) return lancia(error);
      return (data ?? []).filter((n): n is string => typeof n === "string");
    },

    candidati: async (userId, righe) => {
      const { data, error } = await db().rpc<CandidatoCrm[]>("ponte_wa_candidati", {
        p_user_id: userId,
        p_righe: righe,
      });
      if (error) return lancia(error);
      return data ?? [];
    },

    scrivi: async (userId, s) => {
      const { data, error } = await db().rpc<Record<string, unknown>>("ponte_wa_scrivi", {
        p_user_id: userId,
        p_righe: s.righe,
        p_pari: s.pari,
        p_nomi: s.nomi,
      });
      if (error) return lancia(error);
      const d = data ?? {};
      const esito: EsitoScrittura = {
        nuovi: intero(d.nuovi),
        gia_presenti: intero(d.gia_presenti),
        doppioni: intero(d.doppioni),
        pari_persi: intero(d.pari_persi),
        contatti_nuovi: intero(d.contatti_nuovi),
        risposto: intero(d.risposto),
      };
      return esito;
    },

    recentiDelPonte: async (userId, dal) => {
      const { data, error } = await db()
        .from("whatsapp_messages")
        .select<
          RigaPonteDb[]
        >("wa_message_id, direction, from_number, to_number, created_at, body, media_type")
        .eq("user_id", userId)
        .eq("canale", CANALE_PONTE)
        .is("duplicato_di", null)
        .gte("created_at", dal.toISOString())
        .order("created_at", { ascending: true })
        .limit(RECENTI_MAX);
      if (error) return lancia(error);
      return (data ?? []).flatMap((r): RigaDaAbbinare[] => {
        const entrata = r.direction === "inbound";
        const t = Math.floor(Date.parse(r.created_at) / 1000);
        if (!r.wa_message_id || !Number.isFinite(t)) return [];
        return [
          {
            k: r.wa_message_id,
            n: cifre(entrata ? r.from_number : r.to_number),
            d: entrata ? "in" : "out",
            t,
            x: r.body ?? "",
            m: (r.media_type || null) as RigaDaAbbinare["m"],
          },
        ];
      });
    },

    battito: async (userId, b) => {
      const { error } = await db().from("ponte_wa_stato").upsert(
        {
          user_id: userId,
          stato: b.stato,
          collegato_dal: b.collegato_dal,
          ultimo_messaggio_il: b.ultimo_messaggio_il,
          storico: b.storico,
          contatori: b.contatori,
          versione: b.versione,
          aggiornato_il: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) lancia(error);
    },
  };
}
