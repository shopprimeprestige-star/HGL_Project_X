/** ── LE PORTE VERE DEL RIQUADRO E DEL CAMBIO A MANO (solo server) ───────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat), compito 4. Qui c'è solo I/O:
 *  letture e scritture con la chiave di servizio, SEMPRE con `user_id` nel
 *  filtro (la RLS qui non vale). Le regole sono in `pannello.ts` (puro,
 *  provato). Lo usano `api.crm.manychat.ts` e `api.crm.contatto-wa.ts`, dietro
 *  `guardiaCRM`.
 *
 *  ⚠️ Chi legge o scrive LANCIA `{ code }` se il database dice di no: le rotte
 *   registrano il solo codice. Mai il messaggio d'errore (può contenere dati
 *   del cliente), mai un numero di telefono.
 *  ⚠️ Mai una chiamata fuori dal database da qui: ManyChat lo chiama solo la
 *   rotta, col client della porta (`portePortaVere`).
 *
 *  ── I CONTRATTI CON IL DATABASE ────────────────────────────────────────────
 *   M1  manychat_config(id=1, user_id, canale, acceso, promemoria, ricontatti,
 *       tetti, flussi, prima_accensione, ultima_accensione, fermato_motivo,
 *       aggiornato_da, aggiornato_il), manychat_giro(id=1, …),
 *       manychat_invii(…)
 *   M2  contatto_wa_aggiorna(p_user_id uuid, p_id uuid, p_patch jsonb,
 *       p_voce jsonb, p_se_invio text DEFAULT NULL) → boolean
 *       (scritta dal compito 3; p_patch e p_voce sono `CambioContatto`)
 *   B   manychat_config.controlli jsonb
 *       (migrazione `20261023120150_manychat_pannello.sql`, di questo compito)
 *   S1  sheets_ingressi(chiave, user_id, lead_id, esito, foglio, riga,
 *       ricevuto_il, aggiornato_il) (migrazione `20261025120000_sheets_ingresso.sql`):
 *       qui si leggono SOLO `ricevuto_il` ed `esito`, mai nomi né numeri
 *   S2  manychat_config.lead_nuovo, giorno_meet, lead_nuovo_dal, stati,
 *       indirizzo_sede (migrazione `20261025120100_manychat_sequenze.sql`)
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { STATI_APPUNTAMENTO, type LeadData } from "../types";
import { aRoma } from "../promemoria/formati";
import type { CambioContatto } from "./contatto";
import type { ConfigManychat } from "./client-crm";
import {
  type DatiSecco,
  type DatiStato,
  type PorteContatto,
  type RigaConfig,
  type RigaGiro,
  type RigaInvio,
} from "./pannello";
import { STATI_RICONTATTO_AUTOMATICO, TIPI_AUTOMATICI, type InvioPerFreno } from "./regole";
import type { SchedaQuando } from "./quando";
import { portePortaVere } from "./porta.server";
import { ambitoDi, sceltaDaConfig } from "./giro";
import { porteGiro } from "./porte.server";
import { telefoniMeetDomani } from "./sequenze";
import type { ClientManychat } from "./api";

type ErroreDb = { code?: string | null; message?: string | null } | null;
type Esito<T> = PromiseLike<{ data: T | null; error: ErroreDb }>;
interface Filtro<T> extends Esito<T> {
  eq(c: string, v: string | number): Filtro<T>;
  in(c: string, v: string[]): Filtro<T>;
  gte(c: string, v: string): Filtro<T>;
  lte(c: string, v: string): Filtro<T>;
  not(c: string, op: string, v: null): Filtro<T>;
  order(c: string, o: { ascending: boolean }): Filtro<T>;
  limit(n: number): Filtro<T>;
  select<U = { id: string }[]>(c: string): Filtro<U>;
  maybeSingle(): Esito<T extends (infer U)[] ? U : T>;
}
/** I tipi generati non conoscono le tabelle e le funzioni nuove. */
const db = () =>
  supabaseAdmin as unknown as {
    from(t: string): {
      select<T = Record<string, unknown>[]>(c: string): Filtro<T>;
      upsert(v: Record<string, unknown>, o: { onConflict: string }): Esito<unknown>;
      update(v: Record<string, unknown>): Filtro<unknown>;
    };
    rpc(fn: string, a: Record<string, unknown>): Esito<unknown>;
  };

const lancia = (e: NonNullable<ErroreDb>): never => {
  throw { code: e.code ?? "?" };
};
/** La tabella (o la cache dello schema) non ha ancora la migrazione. */
const tabellaMancante = (e: NonNullable<ErroreDb>) =>
  ["42P01", "PGRST205"].includes(String(e.code ?? ""));
/** Una colonna che la migrazione aggiunge non c'è ancora. */
const colonnaMancante = (e: NonNullable<ErroreDb>) =>
  ["42703", "PGRST204"].includes(String(e.code ?? ""));
/** La funzione SQL non c'è ancora. */
const funzioneMancante = (e: NonNullable<ErroreDb>) =>
  ["42883", "PGRST202"].includes(String(e.code ?? ""));

const GIORNO_MS = 86_400_000;

/* ═══════════════════════════════════════════════════════════════════════════
   IL RIQUADRO
   ═════════════════════════════════════════════════════════════════════════ */

/** La riga di `manychat_config`. `manca: true` = la migrazione M1 non c'è.
 *  `sequenze`: ci sono le colonne di S2? Con la riga si vede dalle colonne; senza
 *  riga (mai scritta) si prova a leggerle. */
export async function leggiRigaConfig(): Promise<{
  manca: boolean;
  riga: RigaConfig | null;
  sequenze: boolean;
}> {
  const { data, error } = await db()
    .from("manychat_config")
    .select<RigaConfig[]>("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    if (tabellaMancante(error)) return { manca: true, riga: null, sequenze: false };
    return lancia(error);
  }
  const riga = (data as RigaConfig | null) ?? null;
  if (riga) return { manca: false, riga, sequenze: riga.lead_nuovo !== undefined };
  const prova = await db()
    .from("manychat_config")
    .select<unknown[]>("lead_nuovo, giorno_meet, lead_nuovo_dal, stati, indirizzo_sede")
    .limit(1);
  if (prova.error && !colonnaMancante(prova.error)) lancia(prova.error);
  return { manca: false, riga: null, sequenze: !prova.error };
}

/** Tutto quello che serve a `costruisciStato`: letture sole, niente ManyChat. */
export async function leggiDatiStato(
  userId: string,
  d: { manca: boolean; riga: RigaConfig | null; sequenze: boolean },
  adesso: Date,
  ambiente: { chiave: boolean; segreto: boolean; segretoFoglio: boolean },
): Promise<DatiStato> {
  const vuoto: DatiStato = {
    migrazione: !d.manca,
    chiave: ambiente.chiave,
    segreto: ambiente.segreto,
    config: d.riga,
    sequenze: d.sequenze,
    foglio: { migrazione: false, segreto: ambiente.segretoFoglio, ricevuti: [] },
    giro: null,
    invii: [],
    problemi: [],
    ultimoInvioIl: null,
    nomi: {},
  };
  if (d.manca) return vuoto;

  const g = await db()
    .from("manychat_giro")
    .select<RigaGiro[]>("ultimo_giro_il, ultima_risposta_il, prossimo_ricontatto_dopo, stato")
    .eq("id", 1)
    .maybeSingle();
  if (g.error && !tabellaMancante(g.error)) lancia(g.error);

  const campi = "lead_id, tipo, stato, motivo, prenotato_il, risposta_il";
  //  Ieri e oggi: 30 ore bastano a coprire la giornata di Roma.
  const dal = new Date(adesso.getTime() - 30 * 3_600_000).toISOString();
  const invii = await db()
    .from("manychat_invii")
    .select<RigaInvio[]>(campi)
    .eq("user_id", userId)
    .in("tipo", TIPI_AUTOMATICI)
    .gte("prenotato_il", dal)
    .order("prenotato_il", { ascending: false })
    .limit(500);
  if (invii.error) lancia(invii.error);

  const rotti = await db()
    .from("manychat_invii")
    .select<RigaInvio[]>(campi)
    .eq("user_id", userId)
    .in("tipo", TIPI_AUTOMATICI)
    .in("stato", ["fallito", "saltato", "incerto"])
    .order("prenotato_il", { ascending: false })
    .limit(20);
  if (rotti.error) lancia(rotti.error);

  const ultimo = await db()
    .from("manychat_invii")
    .select<{ inviato_il: string | null }[]>("inviato_il")
    .eq("user_id", userId)
    .in("tipo", TIPI_AUTOMATICI)
    .eq("stato", "inviato")
    .not("inviato_il", "is", null)
    .order("inviato_il", { ascending: false })
    .limit(1);
  if (ultimo.error) lancia(ultimo.error);

  const problemi = rotti.data ?? [];
  const ids = [...new Set(problemi.map((p) => p.lead_id).filter((x): x is string => !!x))];
  const nomi: DatiStato["nomi"] = {};
  if (ids.length) {
    const r = await db()
      .from("crm_leads")
      .select<
        { id: string; nome: string | null; cognome: string | null }[]
      >("id, nome:data->>nome, cognome:data->>cognome")
      .eq("user_id", userId)
      .in("id", ids);
    if (r.error) lancia(r.error);
    for (const x of r.data ?? []) nomi[x.id] = { nome: x.nome, cognome: x.cognome };
  }

  //  Il registro del foglio (S1): solo ora ed esito delle ultime righe. Ieri e oggi
  //  bastano a contare «righe di oggi» (giorno di Roma); il tetto è 300 al giorno.
  //  Senza la tabella il foglio non può ancora mandare niente: non è un guasto.
  const fogli = await db()
    .from("sheets_ingressi")
    .select<{ ricevuto_il: string; esito: string }[]>("ricevuto_il, esito")
    .eq("user_id", userId)
    .gte("ricevuto_il", dal)
    .order("ricevuto_il", { ascending: false })
    .limit(400);
  if (fogli.error && !tabellaMancante(fogli.error)) lancia(fogli.error);
  let ricevuti = fogli.error ? [] : (fogli.data ?? []);
  //  Nessuna riga nelle ultime 30 ore: l'ultima in assoluto, per dire quando è stata.
  if (!fogli.error && ricevuti.length === 0) {
    const ultima = await db()
      .from("sheets_ingressi")
      .select<{ ricevuto_il: string; esito: string }[]>("ricevuto_il, esito")
      .eq("user_id", userId)
      .order("ricevuto_il", { ascending: false })
      .limit(1);
    if (ultima.error) lancia(ultima.error);
    ricevuti = ultima.data ?? [];
  }

  return {
    ...vuoto,
    giro: (g.data as RigaGiro | null) ?? null,
    invii: invii.data ?? [],
    problemi,
    ultimoInvioIl: ultimo.data?.[0]?.inviato_il ?? null,
    nomi,
    foglio: {
      migrazione: !fogli.error,
      segreto: ambiente.segretoFoglio,
      ricevuti,
    },
  };
}

/** Scrive le colonne di un comando (upsert sulla riga unica). `user_id` e chi
 *  ha scritto vanno sempre. */
export async function scriviConfig(
  userId: string,
  patch: Record<string, unknown>,
  chi: string,
  adesso: Date,
): Promise<void> {
  const { error } = await db()
    .from("manychat_config")
    .upsert(
      {
        id: 1,
        user_id: userId,
        ...patch,
        aggiornato_da: chi.slice(0, 60),
        aggiornato_il: adesso.toISOString(),
      },
      { onConflict: "id" },
    );
  if (error) lancia(error);
}

/** Salva l'ultimo «Collegamento ok» e l'esito della prova di creazione. Se la
 *  colonna `controlli` non c'è ancora (migrazione del riquadro non applicata)
 *  non è un guasto: il risultato si mostra comunque, non si ricorda. Vero se
 *  salvato. */
export async function salvaControlli(
  userId: string,
  controlli: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await db()
    .from("manychat_config")
    .upsert({ id: 1, user_id: userId, controlli }, { onConflict: "id" });
  if (error) {
    if (colonnaMancante(error)) return false;
    lancia(error);
  }
  return true;
}

/** `manychat_controlli_unisci` (S2): unisce UNA parte di `controlli` in un solo
 *  UPDATE. Vero se ha scritto; falso se la riga non c'è, o se la funzione o la
 *  colonna mancano ancora (allora chi chiama ricade su `salvaControlli`). */
export async function unisciControlli(
  userId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const { data, error } = await db().rpc("manychat_controlli_unisci", {
    p_user_id: userId,
    p_patch: patch,
  });
  if (error) {
    if (funzioneMancante(error) || colonnaMancante(error)) return false;
    lancia(error);
  }
  return data === true;
}

/** Il client di ManyChat (lo stesso della porta), o `null` senza chiave. */
export const clientManychat = (userId: string): ClientManychat | null =>
  portePortaVere(userId).client();

/** Le schede, i consulenti e il registro per la prova a secco: SOLO letture.
 *  Le schede le legge la stessa funzione del giro (`porteGiro().schede`) con la
 *  stessa scelta della prova (tutto guardato): così la prova e il giro vedono le
 *  stesse schede. */
export async function leggiDatiSecco(
  userId: string,
  config: ConfigManychat,
  adesso: Date,
  fraseModuloDal: string | null = null,
): Promise<DatiSecco> {
  const oggi = aRoma(adesso).giorno;
  const scelta = sceltaDaConfig({ ...config, fraseModuloDal }, adesso, true);
  const schede = await porteGiro().schede(userId, oggi, ambitoDi(scelta));
  //  Il giorno prima parte solo se gratis: la prova legge le entrate come il giro. Se la
  //  lettura non riesce la prova mostra «finestra chiusa» (nel dubbio si risparmia).
  const telefoniDomani = telefoniMeetDomani(schede, adesso);
  const ultimeEntrate =
    telefoniDomani.length > 0
      ? await porteGiro()
          .ultimeEntrate(userId, telefoniDomani)
          .catch(() => ({}) as Record<string, string>)
      : {};

  const consulenti = await db()
    .from("crm_consultants")
    .select<{ id: string; data: Record<string, unknown> }[]>("id, data")
    .eq("user_id", userId)
    .limit(500);
  if (consulenti.error) lancia(consulenti.error);

  //  shortcut: i freni guardano gli ultimi 30 giorni di registro; un invio più
  //  vecchio senza risposta non frena la prova (il giro ha la sua finestra).
  const registro = await db()
    .from("manychat_invii")
    .select<
      {
        telefono: string;
        tipo: InvioPerFreno["tipo"];
        stato: InvioPerFreno["stato"];
        prenotato_il: string;
        risposta_il: string | null;
        sbloccato_il: string | null;
        chiave: string | null;
      }[]
    >("telefono, tipo, stato, prenotato_il, risposta_il, sbloccato_il, chiave")
    .eq("user_id", userId)
    .gte("prenotato_il", new Date(adesso.getTime() - 30 * GIORNO_MS).toISOString())
    .order("prenotato_il", { ascending: false })
    .limit(2000);
  if (registro.error) lancia(registro.error);

  const g = await db()
    .from("manychat_giro")
    .select<{ prossimo_ricontatto_dopo: string | null }[]>("prossimo_ricontatto_dopo")
    .eq("id", 1)
    .maybeSingle();
  if (g.error && !tabellaMancante(g.error)) lancia(g.error);
  const prossimo = Date.parse(String(g.data?.prossimo_ricontatto_dopo ?? ""));

  return {
    config,
    schede,
    fraseModuloDal,
    consulenti: (consulenti.data ?? []) as unknown as DatiSecco["consulenti"],
    invii: (registro.data ?? []).map((r) => ({
      telefono: r.telefono,
      tipo: r.tipo,
      stato: r.stato,
      prenotatoIl: r.prenotato_il,
      rispostaIl: r.risposta_il,
      sbloccatoIl: r.sbloccato_il,
      chiave: r.chiave,
    })),
    prossimoDopo: Number.isFinite(prossimo) ? new Date(prossimo) : null,
    ultimeEntrate,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   IL CAMBIO A MANO DEL SECONDO STATO
   ═════════════════════════════════════════════════════════════════════════ */

export function porteContatto(): PorteContatto {
  return {
    //  ⚠️ L'UNICA lettura senza `user_id` nel filtro, e apposta: serve a
    //   distinguere «non esiste» (404) da «è di un'altra installazione» (403).
    //   La scheda altrui non esce da `cambioContatto`: il confronto con
    //   l'installazione della sessione viene prima di ogni scrittura.
    leggiScheda: async (leadId) => {
      const { data, error } = await db()
        .from("crm_leads")
        .select<{ user_id: string | null; data: Partial<LeadData> | null }[]>("user_id, data")
        .eq("id", leadId)
        .maybeSingle();
      if (error) return lancia(error);
      return data ?? null;
    },

    //  STOP per NUMERO, per tutti i canali: lo leggono la prenotazione della
    //  porta e quella del giro. Le righe vecchie hanno il numero senza «+».
    scriviBlocco: async (userId, cifre, dal) => {
      const valore = dal ? dal.toISOString() : null;
      const { data, error } = await db()
        .from("whatsapp_contacts")
        .update({ non_scrivere_dal: valore })
        .eq("user_id", userId)
        .in("phone_e164", [`+${cifre}`, cifre])
        .select("id");
      if (error) lancia(error);
      //  Un numero che non è ancora in rubrica va messo, altrimenti lo STOP si
      //  perderebbe. Per TOGLIERE non c'è niente da creare.
      if (dal && (data ?? []).length === 0) {
        const { error: e2 } = await db()
          .from("whatsapp_contacts")
          .upsert(
            { user_id: userId, phone_e164: `+${cifre}`, non_scrivere_dal: valore },
            {
              onConflict: "user_id,phone_e164",
            },
          );
        if (e2) lancia(e2);
      }
    },

    aggiorna: async (userId, leadId, cambio: CambioContatto) => {
      const { data, error } = await db().rpc("contatto_wa_aggiorna", {
        p_user_id: userId,
        p_id: leadId,
        p_patch: cambio.patch,
        p_voce: cambio.voce,
      });
      if (error) {
        if (funzioneMancante(error)) return "manca_migrazione";
        return lancia(error);
      }
      return data === true ? "ok" : "nessuna_riga";
    },

    rileggi: async (userId, leadId) => {
      const { data, error } = await db()
        .from("crm_leads")
        .select<{ c: unknown }[]>("c:data->contattoWa")
        .eq("id", leadId)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) return null;
      const c = data?.c as { stato?: unknown } | null | undefined;
      return c && typeof c.stato === "string" ? (c as never) : null;
    },

    avviso: (codice) => console.warn("[manychat-pannello]", codice),
  };
}
