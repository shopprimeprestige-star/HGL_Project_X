/** ── CRUSCOTTO WHATSAPP · LA LETTURA (solo server) ──────────────────────────
 *
 *  Pacchetto p4-cruscotto-wa. Legge con la chiave di servizio, SEMPRE con
 *  `user_id` nel filtro (la RLS qui non vale), e lascia il calcolo a
 *  `calcolo.ts` (puro). Lo usa `routes/api.crm.cruscotto-wa.ts`, dietro `guardiaCRM`.
 *
 *  ⚠️ Si seleziona il minimo: mai il testo dei messaggi, mai il nome del cliente.
 *   Il numero del cliente serve solo a contare le persone distinte e non esce.
 *  ⚠️ SOLA LETTURA, tranne le impostazioni (tariffe e soglia) che stanno nella tabella
 *   `cruscotto_wa_impostazioni`. Senza la migrazione la pagina funziona con i valori
 *   di serie e lo dice.
 *  ⚠️ `duplicato_di` (ponte Mac) può non esserci ancora: se il database dice «colonna
 *   mancante» si rilegge senza, e gli eventuali doppioni del ponte non si escludono.
 *  shortcut: al massimo 20 pagine da 1000 righe per tabella; se si arriva al tetto la
 *   risposta dice `troncato: true` e la pagina lo scrive.
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { leggiCosti } from "../chatwa/costi.server";
import {
  FRASE_SALDO_MANUALE,
  SOGLIA_MINUTI_PREDEFINITA,
  TARIFFE_PREDEFINITE,
  costoConTariffe,
  inizioCruscotto,
  perGiorno,
  perModello,
  segnaleSaldo,
  sogliaValida,
  tariffeValide,
  velocitaConsulenti,
  type CostoStimato,
  type InvioRegistro,
  type MessaggioWa,
  type RigaConsulente,
  type RigaGiorno,
  type RigaModello,
  type SchedaLead,
  type SegnaleSaldo,
  type Tariffe,
} from "./calcolo";

type ErroreDb = { code?: string | null } | null;
interface Interrogazione<T> extends PromiseLike<{ data: T | null; error: ErroreDb }> {
  eq(c: string, v: string): Interrogazione<T>;
  gte(c: string, v: string): Interrogazione<T>;
  in(c: string, v: string[]): Interrogazione<T>;
  not(c: string, op: string, v: unknown): Interrogazione<T>;
  order(c: string, o: { ascending: boolean }): Interrogazione<T>;
  range(da: number, a: number): Interrogazione<T>;
  maybeSingle(): PromiseLike<{ data: (T extends (infer U)[] ? U : T) | null; error: ErroreDb }>;
}
interface Tabella {
  select<T>(c: string): Interrogazione<T>;
  upsert(r: Record<string, unknown>, o?: { onConflict: string }): PromiseLike<{ error: ErroreDb }>;
}
/** I tipi generati non conoscono queste tabelle. */
const db = supabaseAdmin as unknown as { from(t: string): Tabella };

const PAGINA = 1000;
const MAX_PAGINE = 20;
const lancia = (e: NonNullable<ErroreDb>): never => {
  throw { code: e.code ?? "?" };
};
/** Tabella o colonna che il database non ha ancora (migrazione non applicata). */
const manca = (e: ErroreDb) =>
  ["42P01", "42703", "PGRST205", "PGRST204"].includes(String(e?.code ?? ""));

/** Legge a pagine; `troncato` se si è fermato al tetto. */
async function pagine<T>(
  voglio: (da: number, a: number) => Interrogazione<T[]>,
): Promise<{ righe: T[]; troncato: boolean; errore: ErroreDb }> {
  const righe: T[] = [];
  for (let p = 0; p < MAX_PAGINE; p++) {
    const r = await voglio(p * PAGINA, (p + 1) * PAGINA - 1);
    if (r.error) return { righe, troncato: false, errore: r.error };
    const x = r.data ?? [];
    righe.push(...x);
    if (x.length < PAGINA) return { righe, troncato: false, errore: null };
  }
  return { righe, troncato: true, errore: null };
}

export interface ImpostazioniCruscotto {
  tariffe: Tariffe;
  sogliaMinuti: number;
  /** la tabella delle impostazioni esiste (migrazione applicata) */
  salvabili: boolean;
}

export async function leggiImpostazioni(userId: string): Promise<ImpostazioniCruscotto> {
  const r = await db
    .from("cruscotto_wa_impostazioni")
    .select<
      {
        tariffa_marketing: number | string | null;
        tariffa_utility: number | string | null;
        soglia_minuti: number | null;
      }[]
    >("tariffa_marketing, tariffa_utility, soglia_minuti")
    .eq("user_id", userId)
    .maybeSingle();
  if (r.error) {
    if (manca(r.error))
      return {
        tariffe: { ...TARIFFE_PREDEFINITE },
        sogliaMinuti: SOGLIA_MINUTI_PREDEFINITA,
        salvabili: false,
      };
    lancia(r.error);
  }
  return {
    tariffe: tariffeValide({
      marketing: r.data?.tariffa_marketing,
      utility: r.data?.tariffa_utility,
    }),
    sogliaMinuti: sogliaValida(r.data?.soglia_minuti),
    salvabili: true,
  };
}

export async function salvaImpostazioni(
  userId: string,
  nuove: { tariffe?: { marketing?: unknown; utility?: unknown }; sogliaMinuti?: unknown },
): Promise<ImpostazioniCruscotto> {
  const prima = await leggiImpostazioni(userId);
  if (!prima.salvabili) throw { code: "manca_migrazione" };
  const tariffe = tariffeValide({ ...prima.tariffe, ...(nuove.tariffe ?? {}) });
  const sogliaMinuti =
    nuove.sogliaMinuti === undefined ? prima.sogliaMinuti : sogliaValida(nuove.sogliaMinuti);
  const { error } = await db.from("cruscotto_wa_impostazioni").upsert(
    {
      user_id: userId,
      tariffa_marketing: tariffe.marketing,
      tariffa_utility: tariffe.utility,
      soglia_minuti: sogliaMinuti,
      aggiornato_il: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) lancia(error);
  return { tariffe, sogliaMinuti, salvabili: true };
}

const cifre = (v: unknown) => String(v ?? "").replace(/\D/g, "");

async function leggiMessaggi(userId: string, dal: string) {
  interface Riga {
    created_at: string;
    direction: "inbound" | "outbound";
    canale: string | null;
    status: string;
    from_number: string;
    to_number: string;
    duplicato_di?: string | null;
  }
  const leggi = (colonne: string) =>
    pagine<Riga>((da, a) =>
      db
        .from("whatsapp_messages")
        .select<Riga[]>(colonne)
        .eq("user_id", userId)
        .gte("created_at", dal)
        .order("created_at", { ascending: false })
        .range(da, a),
    );
  const base = "created_at, direction, canale, status, from_number, to_number";
  let r = await leggi(`${base}, duplicato_di`);
  if (r.errore && manca(r.errore)) r = await leggi(base);
  if (r.errore) lancia(r.errore);
  const messaggi: MessaggioWa[] = r.righe.map((x) => ({
    creatoIl: x.created_at,
    direzione: x.direction,
    canale: x.canale,
    stato: x.status,
    cliente: cifre(x.direction === "inbound" ? x.from_number : x.to_number),
    doppione: !!x.duplicato_di,
  }));
  return { messaggi, troncato: r.troncato };
}

async function leggiInvii(userId: string, dal: string, modelli: Map<string, string>) {
  interface Riga {
    tipo: string;
    stato: string;
    motivo: string | null;
    flow_ns: string | null;
    inviato_il: string | null;
    prenotato_il: string | null;
    risposta_il: string | null;
    lead_id: string | null;
  }
  const r = await pagine<Riga>((da, a) =>
    db
      .from("manychat_invii")
      .select<
        Riga[]
      >("tipo, stato, motivo, flow_ns, inviato_il, prenotato_il, risposta_il, lead_id")
      .eq("user_id", userId)
      .gte("prenotato_il", dal)
      .order("prenotato_il", { ascending: false })
      .range(da, a),
  );
  if (r.errore) lancia(r.errore);
  const invii: InvioRegistro[] = r.righe.map((x) => ({
    tipo: x.tipo,
    stato: x.stato,
    motivo: x.motivo,
    modello: x.flow_ns ? (modelli.get(x.flow_ns) ?? null) : null,
    conFlusso: !!x.flow_ns,
    inviatoIl: x.inviato_il,
    prenotatoIl: x.prenotato_il,
    rispostaIl: x.risposta_il,
    leadId: x.lead_id,
  }));
  return { invii, troncato: r.troncato };
}

async function leggiSchede(
  userId: string,
  dal: string,
): Promise<{ schede: SchedaLead[]; troncato: boolean }> {
  interface Riga {
    id: string;
    creatoIl: string | null;
    primoContattoIl: string | null;
    consulenteId: string | null;
    stato: string | null;
    fissatoIl: string | null;
    importato: string | null;
  }
  const colonne =
    "id, creatoIl:data->>createdAt, primoContattoIl:data->>firstContactAt, consulenteId:data->>consulenteId, stato:data->>stato, fissatoIl:data->>fissatoIl, importato:data->>importato";
  const per = (campo: string) =>
    pagine<Riga>((da, a) =>
      db
        .from("crm_leads")
        .select<Riga[]>(colonne)
        .eq("user_id", userId)
        .gte(`data->>${campo}`, dal)
        .order("id", { ascending: true })
        .range(da, a),
    );
  const [nuovi, fissati] = await Promise.all([per("createdAt"), per("fissatoIl")]);
  if (nuovi.errore) lancia(nuovi.errore);
  if (fissati.errore) lancia(fissati.errore);
  const mappa = new Map<string, SchedaLead>();
  for (const x of [...nuovi.righe, ...fissati.righe])
    mappa.set(x.id, {
      id: x.id,
      creatoIl: x.creatoIl,
      primoContattoIl: x.primoContattoIl,
      consulenteId: x.consulenteId || null,
      stato: x.stato ?? "",
      fissatoIl: x.fissatoIl,
      importato: x.importato === "true",
    });
  return { schede: [...mappa.values()], troncato: nuovi.troncato || fissati.troncato };
}

/** I lead che WhatsApp ha già toccato: hanno un contatto con messaggi o un invio partito. */
async function leadConWhatsapp(
  userId: string,
  ids: string[],
  invii: InvioRegistro[],
): Promise<Set<string>> {
  const set = new Set<string>();
  for (const i of invii) if (i.leadId && i.stato === "inviato") set.add(i.leadId);
  for (let p = 0; p < ids.length; p += 200) {
    const r = await db
      .from("whatsapp_contacts")
      .select<{ lead_id: string | null }[]>("lead_id")
      .eq("user_id", userId)
      .in("lead_id", ids.slice(p, p + 200))
      .not("last_message_at", "is", null);
    if (r.error) lancia(r.error);
    for (const x of r.data ?? []) if (x.lead_id) set.add(x.lead_id);
  }
  return set;
}

export interface Cruscotto {
  periodo: string;
  dal: string;
  giorni: RigaGiorno[];
  totali: { inviati: number; dalTelefono: number; risposte: number; prenotazioni: number };
  modelli: RigaModello[];
  costo: CostoStimato;
  consulenti: RigaConsulente[];
  sogliaMinuti: number;
  saldo: SegnaleSaldo & { fraseManuale: string };
  impostazioni: ImpostazioniCruscotto;
  troncato: boolean;
}

export async function leggiCruscotto(
  userId: string,
  periodo: string,
  adesso: Date,
): Promise<Cruscotto> {
  const dal = inizioCruscotto(periodo, adesso).toISOString();
  const impostazioni = await leggiImpostazioni(userId);
  const cfg = await db
    .from("manychat_config")
    .select<
      {
        acceso: boolean | null;
        fermato_motivo: string | null;
        flussi: Record<string, unknown> | null;
      }[]
    >("acceso, fermato_motivo, flussi")
    .eq("user_id", userId)
    .maybeSingle();
  if (cfg.error && !manca(cfg.error)) lancia(cfg.error);
  const modelli = new Map<string, string>();
  for (const [nome, ns] of Object.entries(cfg.data?.flussi ?? {}))
    if (typeof ns === "string" && ns.trim()) modelli.set(ns.trim(), nome);

  const [m, i, s, costiGrezzi, consulenti] = await Promise.all([
    leggiMessaggi(userId, dal),
    leggiInvii(userId, dal, modelli),
    leggiSchede(userId, dal),
    leggiCosti(userId, periodo, adesso),
    db
      .from("crm_consultants")
      .select<{ id: string; nome: string | null }[]>("id, nome:data->>nome")
      .eq("user_id", userId),
  ]);
  if (consulenti.error) lancia(consulenti.error);
  const nomi = new Map((consulenti.data ?? []).map((x) => [x.id, x.nome ?? "Consulente"]));
  const ids = s.schede
    .filter((x) => x.fissatoIl && Date.parse(x.fissatoIl) >= Date.parse(dal))
    .map((x) => x.id);
  const conWa = await leadConWhatsapp(userId, ids, i.invii);

  const giorni = perGiorno(m.messaggi, s.schede, conWa, periodo, adesso);
  const somma = (k: "inviati" | "dalTelefono" | "risposte" | "prenotazioni") =>
    giorni.reduce((n, g) => n + g[k], 0);
  const config = cfg.data
    ? { acceso: !!cfg.data.acceso, fermatoMotivo: cfg.data.fermato_motivo }
    : null;
  return {
    periodo,
    dal,
    giorni,
    totali: {
      inviati: somma("inviati"),
      dalTelefono: somma("dalTelefono"),
      risposte: somma("risposte"),
      prenotazioni: somma("prenotazioni"),
    },
    modelli: perModello(i.invii, s.schede, impostazioni.tariffe, periodo, adesso),
    costo: costoConTariffe(costiGrezzi, impostazioni.tariffe),
    consulenti: velocitaConsulenti(s.schede, nomi, impostazioni.sogliaMinuti, periodo, adesso),
    sogliaMinuti: impostazioni.sogliaMinuti,
    saldo: { ...segnaleSaldo(i.invii, config, adesso), fraseManuale: FRASE_SALDO_MANUALE },
    impostazioni,
    troncato: m.troncato || i.troncato || s.troncato,
  };
}
