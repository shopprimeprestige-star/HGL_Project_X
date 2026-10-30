/** ── LE PORTE VERE DELL'INVIO A MANO (PONTE WHATSAPP) ────────────────────────
 *
 *  Commessa 2026-10-30-ponte-invio-manuale, compito T5 (PIANO §3.4). Il
 *  collegamento fra `invio-giro.ts` (la logica) e Supabase: nessuna regola qui,
 *  solo le tre funzioni SQL della migrazione `20261030120000_ponte_invio_manuale`
 *  e le letture/scritture condizionate sulla coda `ponte_wa_invii`.
 *
 *  ⚠️ Chiave di servizio (la RLS qui non vale): l'utente viene SOLO da
 *   `manychat_config` (riga `id=1`) e va in ogni filtro e in ogni `p_user_id`.
 *  ⚠️ Le porte della coda (`fatti`, `accoda`, `riga`, `riprova`, `prendi`,
 *   `esito`, `utente`) LANCIANO `{ code }` se il database dice di no: mai il
 *   messaggio d'errore, che può contenere testi o numeri dei clienti.
 *  ⚠️ `inviatiDalCrm` e `inAttesa` NON LANCIANO MAI: toccano il ponte già
 *   online (lotti e battiti). Su qualunque errore tornano `[]` / `0` con un solo
 *   avviso per processo, così pubblicare il codice prima della migrazione non
 *   ferma l'importazione dei messaggi.
 *  ⚠️ Niente `unread_count`, STOP, schede: «ha già una chat» e STOP li legge la
 *   funzione SQL `ponte_wa_invio_fatti`, mai questo file.
 *  ⚠️ Nei log solo `[ponte-invio] <codice>` e contatori numerici.
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { puoRiprovare, statoVisibile } from "./invio";
import {
  LIMITI_INVIO,
  STATI_CODA,
  type CodiceAvvisoInvio,
  type CorpoEsito,
  type FattiInvio,
  type PorteInvio,
  type RigaCoda,
  type RispostaEsito,
  type RispostaPrendi,
  type StatoCoda,
} from "./invio-tipi";
import { chiaveMessaggio } from "./tipi";

type ErroreDb = { code?: string | null } | null;
type Esito<T> = PromiseLike<{ data: T | null; error: ErroreDb; count?: number | null }>;
interface Filtro<T> extends Esito<T> {
  eq(c: string, v: string | number): Filtro<T>;
  is(c: string, v: null): Filtro<T>;
  in(c: string, v: string[]): Filtro<T>;
  lt(c: string, v: string): Filtro<T>;
  gte(c: string, v: string): Filtro<T>;
  limit(n: number): Filtro<T>;
  select<U = T>(c?: string): Filtro<U>;
  single(): Esito<T extends (infer U)[] ? U : T>;
  maybeSingle(): Esito<T extends (infer U)[] ? U : T>;
}
/** I tipi generati non conoscono la tabella e le funzioni nuove. */
const db = () =>
  supabaseAdmin as unknown as {
    from(t: string): {
      select<T = Record<string, unknown>[]>(
        c: string,
        o?: { count?: "exact"; head?: boolean },
      ): Filtro<T>;
      insert(v: Record<string, unknown>): Filtro<Record<string, unknown>[]>;
      update(v: Record<string, unknown>): Filtro<Record<string, unknown>[]>;
      delete(): Filtro<null>;
    };
    rpc<T>(fn: string, a: Record<string, unknown>): Esito<T>;
  };

const TABELLA = "ponte_wa_invii";
/** Le colonne di `RigaCoda`, e basta (mai `*`). */
const COLONNE =
  "id, chiave, numero, testo, stato, motivo, created_at, preso_il, inviato_il, wa_message_id";
/** L'eco di un nostro invio arriva entro minuti: si guardano gli ultimi invii. */
const ORE_INVIATI_RECENTI = 48;
const INVIATI_RECENTI_MAX = 200;

/** «Una volta per processo»: i lotti e i battiti si ripetono, e senza migrazione
 *  ogni giro darebbe la stessa riga di log. */
let migrazioneAvvisata = false;

const intero = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
const testo = (v: unknown): string | null => (typeof v === "string" ? v : null);
const stato = (v: unknown): StatoCoda | null =>
  typeof v === "string" && (STATI_CODA as readonly string[]).includes(v) ? (v as StatoCoda) : null;

const prima = (ore: number, adesso: number) => new Date(adesso - ore * 3_600_000).toISOString();

export function porteInvio(): PorteInvio {
  const lancia = (e: NonNullable<ErroreDb>): never => {
    throw { code: String(e.code ?? "?") };
  };

  /** La riga di `RigaCoda` da quella del database, o null se storta. */
  const comeRiga = (r: Record<string, unknown> | null): RigaCoda | null => {
    const s = stato(r?.stato);
    if (!r || !s || typeof r.id !== "string") return null;
    return {
      id: r.id,
      chiave: testo(r.chiave) ?? "",
      numero: testo(r.numero) ?? "",
      testo: testo(r.testo) ?? "",
      stato: s,
      motivo: testo(r.motivo),
      created_at: testo(r.created_at) ?? "",
      preso_il: testo(r.preso_il),
      inviato_il: testo(r.inviato_il),
      wa_message_id: testo(r.wa_message_id),
    };
  };

  const leggiRiga = async (userId: string, id: string): Promise<RigaCoda | null> => {
    const { data, error } = await db()
      .from(TABELLA)
      .select<Record<string, unknown>[]>(COLONNE)
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();
    if (error) return lancia(error);
    return comeRiga(data as Record<string, unknown> | null);
  };

  /** Il primo avviso (per processo) dice «migrazione»; poi silenzio. */
  const avvisoUnico = () => {
    if (migrazioneAvvisata) return;
    migrazioneAvvisata = true;
    console.warn("[ponte-invio] invio_migrazione");
  };

  return {
    avviso(codice: CodiceAvvisoInvio, conteggi?: Record<string, number>) {
      if (codice === "invio_migrazione") return avvisoUnico();
      const numeri = Object.entries(conteggi ?? {})
        .filter(([, v]) => typeof v === "number" && Number.isFinite(v))
        .map(([k, v]) => ` ${k}=${v}`)
        .join("");
      const riga = `[ponte-invio] ${codice}${numeri}`;
      if (codice === "invio_database") console.warn(riga);
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

    fatti: async (userId, numero) => {
      const { data, error } = await db().rpc<Record<string, unknown>>("ponte_wa_invio_fatti", {
        p_user_id: userId,
        p_numero: numero,
      });
      if (error) return lancia(error);
      const d = data ?? {};
      const f: FattiInvio = {
        entrata: d.entrata === true,
        stop: d.stop === true,
        ponte_stato: testo(d.ponte_stato),
        ponte_battito: testo(d.ponte_battito),
        invii_attivi: d.invii_attivi === true,
        ultime24h: intero(d.ultime24h),
        in_coda: intero(d.in_coda),
      };
      return f;
    },

    accoda: async (userId, r) => {
      //  La pulizia dei 30 giorni sta qui (azione rara), non nel prelievo. Se
      //  fallisce non ferma l'accodamento: se manca la tabella lo dirà l'insert.
      await db()
        .from(TABELLA)
        .delete()
        .eq("user_id", userId)
        .in("stato", ["inviato", "non_inviato"])
        .lt("created_at", prima(LIMITI_INVIO.retentionGiorni * 24, Date.now()));
      const { data, error } = await db()
        .from(TABELLA)
        .insert({
          user_id: userId,
          chiave: r.chiave,
          numero: r.numero,
          testo: r.testo,
          creato_da: r.creato_da,
        })
        .select<Record<string, unknown>[]>("id, stato")
        .single();
      const nuova = (d: unknown, nuovo: boolean) => {
        const o = d as { id?: unknown; stato?: unknown } | null;
        const s = stato(o?.stato);
        if (!o || typeof o.id !== "string" || !s) return lancia({ code: "?" });
        return { id: o.id, stato: s, nuovo };
      };
      if (!error) return nuova(data, true);
      //  Lo stesso tocco due volte (stessa chiave): è la stessa riga.
      if (error.code !== "23505") return lancia(error);
      const { data: vecchia, error: e2 } = await db()
        .from(TABELLA)
        .select<Record<string, unknown>[]>("id, stato")
        .eq("user_id", userId)
        .eq("chiave", r.chiave)
        .maybeSingle();
      if (e2) return lancia(e2);
      return nuova(vecchia, false);
    },

    riga: (userId, id) => leggiRiga(userId, id),

    riprova: async (userId, id, confermaIncerto) => {
      const riga = await leggiRiga(userId, id);
      if (!riga) return { stato: null };
      const adesso = new Date();
      //  La stessa regola di `puoRiprovare`, sulla riga come la vede la chat: una
      //  `in_attesa` oltre la scadenza e una `in_invio` oltre l'incerto si possono
      //  riprovare anche se il database non le ha ancora svuotate (Mac spento).
      const v = statoVisibile(riga, adesso);
      const regola = puoRiprovare({ ...riga, stato: v.fase, motivo: v.motivo });
      if (!regola.ok || (regola.serveConferma && !confermaIncerto)) return { stato: riga.stato };
      let q = db()
        .from(TABELLA)
        .update({
          stato: "in_attesa",
          motivo: null,
          created_at: adesso.toISOString(),
          aggiornato_il: adesso.toISOString(),
        })
        .eq("user_id", userId)
        .eq("id", id)
        .eq("stato", riga.stato);
      //  L'`UPDATE` riconferma lo stato letto: se nel frattempo è cambiato, non fa niente.
      if (riga.stato === "non_inviato")
        q = riga.motivo === null ? q.is("motivo", null) : q.eq("motivo", riga.motivo);
      else if (riga.stato === "in_attesa")
        q = q.lt("created_at", prima(LIMITI_INVIO.scadenzaMin / 60, adesso.getTime()));
      else
        q =
          riga.preso_il === null
            ? q.lt("created_at", prima(LIMITI_INVIO.incertoMin / 60, adesso.getTime()))
            : q.lt("preso_il", prima(LIMITI_INVIO.incertoMin / 60, adesso.getTime()));
      const { data, error } = await q.select<Record<string, unknown>[]>("stato");
      if (error) return lancia(error);
      if ((data ?? []).length > 0) return { stato: "in_attesa" };
      //  Perso la corsa (un doppio tocco, il Mac che ha scritto l'esito): lo stato di adesso.
      const ora = await leggiRiga(userId, id);
      return { stato: ora?.stato ?? null };
    },

    prendi: async (userId) => {
      const { data, error } = await db().rpc<Record<string, unknown>>("ponte_wa_invii_prendi", {
        p_user_id: userId,
        p_intervallo_s: LIMITI_INVIO.intervalloS,
        p_al_giorno: LIMITI_INVIO.alGiorno,
        p_scadenza_min: LIMITI_INVIO.scadenzaMin,
        p_incerto_min: LIMITI_INVIO.incertoMin,
      });
      if (error) return lancia(error);
      const d = data ?? {};
      const i = d.invio as { id?: unknown; numero?: unknown; testo?: unknown } | null | undefined;
      const invio =
        i && testo(i.id) && testo(i.numero) && testo(i.testo)
          ? { id: i.id as string, numero: i.numero as string, testo: i.testo as string }
          : null;
      const r: RispostaPrendi = {
        ok: true,
        invio,
        attendi_s: intero(d.attendi_s),
        limite: d.limite === true,
      };
      return r;
    },

    esito: async (userId, c: CorpoEsito) => {
      const { data, error } = await db().rpc<Record<string, unknown>>("ponte_wa_invio_esito", {
        p_user_id: userId,
        p_id: c.id,
        p_esito: c.esito,
        p_wa_id: c.wa_id ?? null,
        p_ts: c.ts ?? null,
        p_motivo: c.motivo ?? null,
      });
      if (error) return lancia(error);
      const s = stato(data?.stato);
      //  `stato` assente = la riga non c'è. Altrimenti si dà lo stato di adesso,
      //  anche se l'esito non è stato accettato: `gestisciPonte` lo confronta con
      //  quello che l'esito avrebbe prodotto.
      if (!s) return null;
      const r: RispostaEsito = { ok: true, stato: s };
      return r;
    },

    inviatiDalCrm: async (userId, chiavi) => {
      if (chiavi.length === 0) return [];
      try {
        //  shortcut: si guardano gli ultimi invii (48 h, al più 200) e non si filtra
        //  per chiave in SQL; basta finché si mandano 20 messaggi al giorno.
        const { data, error } = await db()
          .from(TABELLA)
          .select<Record<string, unknown>[]>("numero, wa_message_id")
          .eq("user_id", userId)
          .gte("inviato_il", prima(ORE_INVIATI_RECENTI, Date.now()))
          .limit(INVIATI_RECENTI_MAX);
        if (error) throw error;
        const cercate = new Set(chiavi);
        return (data ?? []).flatMap((r) => {
          const n = testo(r.numero);
          const w = testo(r.wa_message_id);
          const k = n && w ? chiaveMessaggio(n, w) : null;
          return k && cercate.has(k) ? [k] : [];
        });
      } catch {
        avvisoUnico();
        return [];
      }
    },

    inAttesa: async (userId) => {
      try {
        const { count, error } = await db()
          .from(TABELLA)
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("stato", "in_attesa");
        if (error) throw error;
        return intero(count);
      } catch {
        avvisoUnico();
        return 0;
      }
    },
  };
}
