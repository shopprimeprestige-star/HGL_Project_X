/** ── PRENOTA IN CHAT: LE PORTE VERE SU SUPABASE (T6) ────────────────────────
 *
 *  Commessa 2026-10-27 (PIANO.md, T6). Il collegamento fra l'orchestratore
 *  (`prenota.ts`, puro) e il database: nessuna regola qui, solo letture e
 *  scritture. Stile di `porte.server.ts`.
 *
 *  ⚠️ `crm_leads`, `crm_consultants`, `whatsapp_contacts`, `manychat_invii`:
 *   chiave di servizio, quindi la RLS qui non vale, e OGNI lettura o scrittura
 *   porta `user_id` nel filtro.
 *  ⚠️ `app_config` NON ha `user_id` e la sua RLS è «authenticated vede tutto»:
 *   per le righe `prenota_chat*`, `meet:*`, `fascia:*`, `attesi:*` la regola
 *   «sempre user_id» (SPEC 7.7) non si può applicare. Per questo le chiavi
 *   portano solo l'impronta HMAC del numero o l'id del lead, MAI il numero, e
 *   nelle righe non c'è nessun dato del cliente oltre a ciò che già sta nella
 *   stanza (`meet:*`).
 *  ⚠️ Chi legge o scrive LANCIA con `{ code }` se il database dice di no: la
 *   logica registra solo il codice. Mai il messaggio d'errore (può contenere
 *   dati del cliente). Nei log solo codici.
 *  ⚠️ Mai una chiamata fuori dal database (né ManyChat né altro).
 *  ⚠️ Mai `like`: i lucchetti si prendono con INSERT (la chiave primaria rende
 *   l'inserimento atomico) e si rilasciano con DELETE sul valore ESATTO.
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { CHIAVE_BLOCCHI, leggiBlocchiDaJson } from "../blocchi";
import type { Consultant, Lead } from "../types";
import { leggiPaginato } from "./prenota-lettura";
import {
  CHIAVE_CONFIG,
  FASCE,
  leggiConfigPrenota,
  type OraProposta,
  type PortePrenota,
  type RigaProposta,
} from "./prenota-tipi";
import { porteRisposta } from "./porte.server";
import { cifreTelefono } from "./ritorno";

type ErroreDb = { code?: string | null; message?: string | null } | null;
type Esito<T> = PromiseLike<{ data: T | null; error: ErroreDb }>;
interface Filtro<T> extends Esito<T> {
  eq(c: string, v: string | number): Filtro<T>;
  in(c: string, v: string[]): Filtro<T>;
  gte(c: string, v: string): Filtro<T>;
  lte(c: string, v: string): Filtro<T>;
  is(c: string, v: null): Filtro<T>;
  not(c: string, op: string, v: null): Filtro<T>;
  contains(c: string, v: Record<string, unknown>): Filtro<T>;
  order(c: string, o?: { ascending: boolean }): Filtro<T>;
  range(da: number, a: number): Filtro<T>;
  limit(n: number): Filtro<T>;
  select<U = T>(c: string): Filtro<U>;
  maybeSingle(): Esito<T extends (infer U)[] ? U : T>;
}
/** I tipi generati non conoscono `app_config` né le colonne nuove. */
const db = () =>
  supabaseAdmin as unknown as {
    from(t: string): {
      select<T = Record<string, unknown>[]>(c: string): Filtro<T>;
      insert(v: Record<string, unknown>): Esito<unknown>;
      upsert(v: Record<string, unknown>, o: { onConflict: string }): Esito<unknown>;
      update(v: Record<string, unknown>): Filtro<unknown>;
      delete(): Filtro<unknown>;
    };
  };

/** Il database dice di no: si lancia SOLO il codice. */
const lancia = (e: NonNullable<ErroreDb>): never => {
  throw { code: e.code ?? "?" };
};

/** Lo stesso numero come l'ha scritto qualcuno: col «+» e senza. */
const formati = (telefono: string) => [`+${telefono}`, telefono];

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Le colonne della scheda, scritte (mai l'asterisco su `crm_leads`). */
const COLONNE_LEAD = "id, user_id, data, created_at, updated_at";
/** Tetto delle pagine da 1000 per ogni lettura dell'agenda (PIANO rev. 4). */
const PAGINE_MAX = 5;
const SETTE_GIORNI_MS = 7 * 24 * 3600e3;

// ── app_config (value è TEXT) ──────────────────────────────────────────────

async function leggiRiga(chiave: string): Promise<string | null> {
  const { data, error } = await db()
    .from("app_config")
    .select<{ value: string | null }>("value")
    .eq("key", chiave)
    .maybeSingle();
  if (error) return lancia(error);
  return data?.value ?? null;
}

async function scriviRiga(chiave: string, valore: string): Promise<void> {
  const { error } = await db()
    .from("app_config")
    .upsert(
      { key: chiave, value: valore, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) lancia(error);
}

async function eliminaRiga(chiave: string): Promise<void> {
  const { error } = await db().from("app_config").delete().eq("key", chiave);
  if (error) lancia(error);
}

/** La riga della proposta com'è nel database, o `null` se manca o non si legge:
 *  una riga storta vale «nessuna proposta aperta» (si risponde `nessuno`),
 *  meglio che far esplodere l'orchestratore più avanti. */
function comeRigaProposta(testo: string | null): RigaProposta | null {
  if (!testo) return null;
  let j: unknown;
  try {
    j = JSON.parse(testo);
  } catch {
    return null;
  }
  const r = j as Partial<RigaProposta> | null;
  const eOra = (x: unknown): x is OraProposta =>
    !!x &&
    typeof x === "object" &&
    typeof (x as OraProposta).g === "string" &&
    typeof (x as OraProposta).o === "string";
  const eLista = (x: unknown) => Array.isArray(x) && x.every(eOra);
  const ok =
    !!r &&
    typeof r === "object" &&
    r.v === 1 &&
    typeof r.il === "string" &&
    !!r.fascia &&
    Object.hasOwn(FASCE, r.fascia) &&
    !!r.fasciaChiesta &&
    Object.hasOwn(FASCE, r.fasciaChiesta) &&
    (r.pagina === 1 || r.pagina === 2 || r.pagina === 3) &&
    eLista(r.proposte) &&
    eLista(r.mostrati) &&
    !!r.chiamate &&
    typeof r.chiamate.ora === "string" &&
    Number.isFinite(r.chiamate.n);
  return ok ? (r as RigaProposta) : null;
}

/** Le porte vere della prenotazione in chat. Una per richiesta: i lucchetti
 *  presi da QUESTA istanza si ricordano qui per essere rilasciati col valore
 *  esatto. */
export function portePrenota(): PortePrenota {
  //  `chiave + di` → il valore scritto da `prendi`, quello che `lascia` cancella.
  const presi = new Map<string, string>();
  const base = porteRisposta();

  /** Una lettura di schede, a pagine da 1000 con `.order("id")` fisso. */
  const leggiSchede = (
    userId: string,
    filtra: (q: Filtro<Lead[]>) => Filtro<Lead[]>,
  ): Promise<Lead[]> =>
    leggiPaginato<Lead>(async (da, a) => {
      const { data, error } = await filtra(
        db().from("crm_leads").select<Lead[]>(COLONNE_LEAD).eq("user_id", userId),
      )
        .order("id")
        .range(da, a);
      if (error) return lancia(error);
      return data ?? [];
    }, PAGINE_MAX);

  return {
    adesso: () => new Date(),
    avviso: (codice) => console.warn("[manychat-prenota]", codice),

    config: async () => leggiConfigPrenota(await leggiRiga(CHIAVE_CONFIG)),

    //  Le stesse tre porte della risposta: non si riscrivono.
    utente: () => base.utente(),
    statoSecondo: (userId, leadId) => base.contattoDi(userId, leadId),
    scriviContatto: (userId, leadId, cambio) => base.scriviContatto(userId, leadId, cambio),

    consulenti: async (userId) => {
      const { data, error } = await db()
        .from("crm_consultants")
        .select<Consultant[]>("id, user_id, data, created_at, updated_at")
        .eq("user_id", userId);
      if (error) return lancia(error);
      return data ?? [];
    },

    //  ⚠️ Quattro letture con limite di data (o, per le manutenzioni, solo le
    //  `fissata`: ogni cliente installato ne ha, ma quelle fissate sono poche),
    //  ognuna a pagine da 1000 con tetto 5: oltre il tetto LANCIA. Mai l'archivio
    //  intero. La forma del filtro sulle manutenzioni è quella del tipo vero
    //  (`LeadData.manutenzione.appuntamenti[].stato`, vedi `manutenzioniDi`); il
    //  giorno lo guarda poi `slotDelGiorno`, non il database.
    schedeAgenda: async (userId, dal, al) => {
      const perId = new Map<string, Lead>();
      const letture = await Promise.all([
        leggiSchede(userId, (q) => q.gte("data->>dataMeeting", dal).lte("data->>dataMeeting", al)),
        leggiSchede(userId, (q) =>
          q.gte("data->>dataVieneInSede", dal).lte("data->>dataVieneInSede", al),
        ),
        leggiSchede(userId, (q) =>
          q
            .gte("data->installazione->>dataInstallazione", dal)
            .lte("data->installazione->>dataInstallazione", al),
        ),
        leggiSchede(userId, (q) =>
          q.contains("data", { manutenzione: { appuntamenti: [{ stato: "fissata" }] } }),
        ),
      ]);
      for (const righe of letture) for (const r of righe) perId.set(r.id, r);
      return [...perId.values()];
    },

    //  Le chiusure del centro stanno in `app_config` (una riga JSON), non in una tabella.
    blocchi: async () => leggiBlocchiDaJson(await leggiRiga(CHIAVE_BLOCCHI)),

    //  Candidati: l'id del corpo, i lead di `whatsapp_contacts` e quelli degli
    //  invii degli ultimi 7 giorni per quel numero. Poi UNA lettura per id, e si
    //  tiene solo chi ha davvero quel telefono (SPEC 7.3: un lead prenota solo
    //  per sé). Nessuna scansione della tabella.
    schedeDelNumero: async (userId, telefono, crmLeadId) => {
      if (!/^\d{8,15}$/.test(telefono)) return [];
      const dal = new Date(Date.now() - SETTE_GIORNI_MS).toISOString();
      const [contatti, invii] = await Promise.all([
        db()
          .from("whatsapp_contacts")
          .select<{ lead_id: string | null }[]>("lead_id")
          .eq("user_id", userId)
          .in("phone_e164", formati(telefono))
          .limit(20),
        db()
          .from("manychat_invii")
          .select<{ lead_id: string | null }[]>("lead_id")
          .eq("user_id", userId)
          .eq("telefono", telefono)
          .gte("prenotato_il", dal)
          .order("prenotato_il", { ascending: false })
          .limit(50),
      ]);
      if (contatti.error) return lancia(contatti.error);
      if (invii.error) return lancia(invii.error);
      const ids = new Set<string>();
      if (RE_UUID.test(crmLeadId)) ids.add(crmLeadId);
      for (const r of [...(contatti.data ?? []), ...(invii.data ?? [])])
        if (r.lead_id && RE_UUID.test(r.lead_id)) ids.add(r.lead_id);
      if (ids.size === 0) return [];
      const { data, error } = await db()
        .from("crm_leads")
        .select<Lead[]>(COLONNE_LEAD)
        .eq("user_id", userId)
        .in("id", [...ids]);
      if (error) return lancia(error);
      return (data ?? []).filter((s) => cifreTelefono(s.data?.telefono) === telefono);
    },

    scheda: async (userId, leadId) => {
      const { data, error } = await db()
        .from("crm_leads")
        .select<Lead>(COLONNE_LEAD)
        .eq("id", leadId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) return lancia(error);
      return data ?? null;
    },

    //  Scrittura condizionata: la riga si cambia solo se `updated_at` è ancora
    //  quello letto (il trigger del database lo muove a ogni modifica, anche
    //  del browser). Zero righe = qualcuno è arrivato prima = `cambiata`.
    scriviScheda: async (userId, leadId, vistoIl, data) => {
      const q = db().from("crm_leads").update({ data }).eq("id", leadId).eq("user_id", userId);
      const { data: scritte, error } = await (
        vistoIl === null ? q.is("updated_at", null) : q.eq("updated_at", vistoIl)
      ).select<{ id: string }[]>("id");
      if (error) return lancia(error);
      return scritte && scritte.length > 0 ? "ok" : "cambiata";
    },

    proposta: async (chiave) => comeRigaProposta(await leggiRiga(chiave)),
    scriviProposta: (chiave, riga) => scriviRiga(chiave, JSON.stringify(riga)),

    //  ── Il lucchetto ──
    //  PRENDI: INSERT di `{di, fino}`. La chiave primaria lo rende atomico: chi
    //  arriva secondo riceve 23505. Se la riga c'è ma `fino` è passato (processo
    //  morto) si riprende con un UPDATE sul valore LETTO: se nel frattempo un
    //  altro l'ha ripreso il valore è cambiato e l'UPDATE non scrive niente.
    lucchetto: {
      prendi: async (chiave, di, scadeMs) => {
        const valore = JSON.stringify({ di, fino: new Date(Date.now() + scadeMs).toISOString() });
        for (let tentativo = 0; tentativo < 2; tentativo++) {
          const { error } = await db()
            .from("app_config")
            .insert({ key: chiave, value: valore, updated_at: new Date().toISOString() });
          if (!error) {
            presi.set(chiave + "\n" + di, valore);
            return true;
          }
          if (error.code !== "23505") return lancia(error);
          const attuale = await leggiRiga(chiave);
          //  Rilasciato un attimo fa: si riprova l'INSERT (una volta sola).
          if (attuale === null) continue;
          let fino = 0;
          try {
            fino = Date.parse((JSON.parse(attuale) as { fino?: string }).fino ?? "");
          } catch {
            //  illeggibile = scaduto: un lucchetto che nessuno sa leggere non
            //  deve restare per sempre
          }
          if (fino > Date.now()) return false;
          const { data, error: e2 } = await db()
            .from("app_config")
            .update({ value: valore, updated_at: new Date().toISOString() })
            .eq("key", chiave)
            .eq("value", attuale)
            .select<{ key: string }[]>("key");
          if (e2) return lancia(e2);
          if (data && data.length > 0) {
            presi.set(chiave + "\n" + di, valore);
            return true;
          }
          return false;
        }
        return false;
      },
      //  LASCIA: DELETE sul valore ESATTO scritto da `prendi`. Se il lucchetto è
      //  scaduto e l'ha ripreso un altro, il suo valore è diverso e non si
      //  cancella niente (il suo lucchetto non si tocca). Se questa istanza non
      //  l'aveva preso non c'è niente da rilasciare.
      lascia: async (chiave, di) => {
        const valore = presi.get(chiave + "\n" + di);
        if (valore === undefined) return;
        const { error } = await db()
          .from("app_config")
          .delete()
          .eq("key", chiave)
          .eq("value", valore);
        if (error) return lancia(error);
        presi.delete(chiave + "\n" + di);
      },
    },

    stanza: {
      leggi: leggiRiga,
      scrivi: scriviRiga,
      elimina: eliminaRiga,
    },

    nonScrivere: async (userId, telefono) => {
      const { data, error } = await db()
        .from("whatsapp_contacts")
        .select<{ non_scrivere_dal: string | null }[]>("non_scrivere_dal")
        .eq("user_id", userId)
        .in("phone_e164", formati(telefono))
        .not("non_scrivere_dal", "is", null)
        .limit(1);
      if (error) return lancia(error);
      return (data ?? []).length > 0;
    },

    attesa: (ms) => new Promise((ok) => setTimeout(ok, ms)),
  };
}
