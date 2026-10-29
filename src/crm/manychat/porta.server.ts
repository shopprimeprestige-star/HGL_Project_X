/** ── LE PORTE VERE DELLA PORTA UNICA (solo server) ─────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat), compito U1. Qui sta l'I/O:
 *  `supabaseAdmin`, `fetch`, `process.env.MANYCHAT_API_KEY` e le chiavi della
 *  Cloud API. Le regole sono in `porta.ts` (pura, provata); questo file le
 *  collega al mondo e basta.
 *
 *  ⚠️ LA CHIAVE DI MANYCHAT RESTA QUI DENTRO: non esce nelle risposte, non va
 *   nei log. Nei log solo codici.
 *  ⚠️ SENZA LA MIGRAZIONE M1 (`manychat_config` ecc.) IL CANALE È `cloud`: il
 *   codice si pubblica prima delle migrazioni e non deve rompere niente.
 *
 *  ── I CONTRATTI CON M1 (migrazione `20261023120000_manychat_base.sql`) ─────
 *   manychat_config(user_id, canale, flussi jsonb)
 *   manychat_prenota_porta(p_user_id uuid, p jsonb) → jsonb
 *       p = { tipo, telefono (cifre), lead_id, chiave, flow_ns }
 *       → { id } se prenotato, oppure { motivo: 'pausa_contatto' | 'stop' | 'gia_preso' }
 *   manychat_esito(p_user_id, p_id, p_patch jsonb, p_da text) → bool
 *       p_da = 'prenotato'; p_patch con le colonne da cambiare:
 *       stato, motivo, subscriber_id, inviato_il
 *   manychat_invii(user_id, telefono, subscriber_id, prenotato_il)
 *   whatsapp_messages.canale
 *
 *  ── CONTRATTO CON LA MIGRAZIONE DELLA CHAT (commessa 2026-10-28) ───────────
 *   whatsapp_segna_risposto(p_user_id uuid, p_phone text) → boolean
 *       scrive `risposto_il` (ora del database): il cliente esce da «Da rispondere»
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { creaClient, type FetchManychat } from "./api";
import type { CanaleWhatsapp, MessaggioPorta, PortePorta, PrenotazionePorta } from "./porta";

const META_API = "https://graph.facebook.com/v21.0";

type ErroreDb = { code?: string; message?: string } | null;
type Risultato<T> = PromiseLike<{ data: T | null; error: ErroreDb }>;
interface Filtro<T> extends Risultato<T> {
  eq(c: string, v: string): Filtro<T>;
  in(c: string, v: string[]): Filtro<T>;
  not(c: string, op: string, v: null): Filtro<T>;
  order(c: string, o: { ascending: boolean }): Filtro<T>;
  limit(n: number): Filtro<T>;
  maybeSingle(): Risultato<T>;
}
/** I tipi generati non conoscono le tabelle e le funzioni nuove. */
const db = supabaseAdmin as unknown as {
  from(t: string): {
    select<T = Record<string, unknown>[]>(c: string): Filtro<T>;
    insert(v: Record<string, unknown>): Risultato<unknown>;
    upsert(v: Record<string, unknown>, o: { onConflict: string }): Risultato<unknown>;
  };
  rpc<T = unknown>(fn: string, args: Record<string, unknown>): Risultato<T>;
};

/** La tabella di M1 non c'è (codice pubblicato prima della migrazione). */
const mancaTabella = (e: ErroreDb) =>
  !!e &&
  (["42P01", "PGRST205"].includes(String(e.code ?? "")) ||
    /does not exist|could not find the table/i.test(String(e.message ?? "")));

/** Il canale dell'installazione e i flussi dei modelli. Senza M1: `cloud`.
 *  Qualunque altro guasto del database LANCIA: scegliere il canale a caso vuol
 *  dire mandare dal numero sbagliato. */
export async function leggiCanale(
  userId: string,
): Promise<{ canale: CanaleWhatsapp; flussi: Record<string, string> }> {
  const { data, error } = await db
    .from("manychat_config")
    .select<{ canale?: string | null; flussi?: Record<string, unknown> | null }>("canale, flussi")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (mancaTabella(error)) return { canale: "cloud", flussi: {} };
    throw new Error(`manychat_config: ${error.code ?? ""}`);
  }
  const flussi: Record<string, string> = {};
  for (const [nome, ns] of Object.entries(data?.flussi ?? {}))
    if (typeof ns === "string" && ns.trim()) flussi[nome] = ns.trim();
  return { canale: data?.canale === "manychat" ? "manychat" : "cloud", flussi };
}

/** L'avviso «manca whatsapp_segna_risposto» una volta per processo, non uno per messaggio. */
let avvisatoFunzioneMancante = false;

/** Il messaggio dal CRM è partito: il cliente esce da «Da rispondere».
 *  NON LANCIA MAI e non cambia l'esito dell'invio (il messaggio è già andato): se
 *  la funzione manca (codice pubblicato prima della migrazione) o il database
 *  fa i capricci, la chat resta in elenco, che è la direzione sicura.
 *  Nei log solo il codice: mai numero, messaggio dell'errore o testo. */
export async function segnaRispostoDalCrm(userId: string, telefono: string): Promise<boolean> {
  try {
    const { error } = await db.rpc("whatsapp_segna_risposto", {
      p_user_id: userId,
      p_phone: telefono,
    });
    if (!error) return true;
    const codice = String(error.code ?? "");
    if (codice === "42883" || codice === "PGRST202") {
      if (!avvisatoFunzioneMancante) {
        avvisatoFunzioneMancante = true;
        console.warn("[whatsapp-send] segna_risposto: migrazione mancante", codice);
      }
    } else console.warn("[whatsapp-send] segna_risposto:", codice);
  } catch {
    console.warn("[whatsapp-send] segna_risposto: eccezione");
  }
  return false;
}

/** C'è `MANYCHAT_API_KEY` fra i segreti del Worker? (Non la legge nessuno qui fuori.) */
export const chiaveManychatPresente = () => !!(process.env.MANYCHAT_API_KEY ?? "").trim();

/** Il nome della persona per creare il contatto in ManyChat (la porta ne usa
 *  solo la prima parola). Vuoto se la scheda non è dell'installazione. */
export async function nomeDelLead(userId: string, leadId: string): Promise<string> {
  const { data } = await db
    .from("crm_leads")
    .select<{ data?: { nome?: unknown } | null }>("data")
    .eq("id", leadId)
    .eq("user_id", userId)
    .maybeSingle();
  return typeof data?.data?.nome === "string" ? data.data.nome : "";
}

/** Le porte vere per un'installazione. `cloud`: le chiavi della Cloud API, se
 *  chi chiama le ha già lette; altrimenti si leggono da `whatsapp_settings`
 *  solo quando serve. */
export function portePortaVere(
  userId: string,
  o: { flussi?: Record<string, string>; cloud?: { phoneNumberId: string; token: string } } = {},
): PortePorta {
  let client: ReturnType<typeof creaClient> | null | undefined;
  let flussi = o.flussi;
  return {
    adesso: () => new Date(),
    //  Un client solo per tutta la vita delle porte: tiene l'id del campo
    //  `crm_telefono`, e un giro con più conferme non lo richiede ogni volta.
    client: () => {
      if (client !== undefined) return client;
      const chiave = (process.env.MANYCHAT_API_KEY ?? "").trim();
      client = chiave
        ? creaClient({ chiave, fetch: globalThis.fetch as unknown as FetchManychat })
        : null;
      return client;
    },
    flusso: async (modello) => {
      flussi ??= (await leggiCanale(userId)).flussi;
      return flussi[modello] ?? null;
    },
    prenota: async (p: PrenotazionePorta) => {
      const { data, error } = await db.rpc<Record<string, unknown>>("manychat_prenota_porta", {
        p_user_id: userId,
        p: {
          tipo: p.tipo,
          telefono: p.telefono,
          lead_id: p.leadId,
          chiave: p.chiave,
          flow_ns: p.flowNs,
        },
      });
      if (error) throw new Error(`manychat_prenota_porta: ${error.code ?? ""}`);
      if (typeof data?.id === "string") return { id: data.id };
      if (typeof data?.motivo === "string") return { motivo: data.motivo };
      throw new Error("manychat_prenota_porta: risposta senza id né motivo");
    },
    esito: async (id, patch) => {
      const { error } = await db.rpc("manychat_esito", {
        p_user_id: userId,
        p_id: id,
        p_patch: patch,
        p_da: "prenotato",
      });
      if (error) throw new Error(`manychat_esito: ${error.code ?? ""}`);
    },
    subscriberNoto: async (telefono) => {
      const { data } = await db
        .from("manychat_invii")
        .select<{ subscriber_id?: number | string | null }[]>("subscriber_id")
        .eq("user_id", userId)
        .eq("telefono", telefono)
        .not("subscriber_id", "is", null)
        .order("prenotato_il", { ascending: false })
        .limit(1);
      const id = Number(data?.[0]?.subscriber_id);
      if (Number.isSafeInteger(id) && id > 0) return id;
      //  ⚠️ IL CONTATTO GIÀ VISTO IN RUBRICA (29/10/2026). Chi ha scritto lui a
      //   ManyChat ha il suo id nella rubrica delle chat (`whatsapp_contacts`,
      //   scritto dall'arrivo dei messaggi), ma non sempre si trova per numero
      //   in ManyChat: la ricerca falliva, la creazione rispondeva «esiste già»
      //   e il promemoria della consulenza finiva «da collegare» senza partire.
      const { data: rubrica } = await db
        .from("whatsapp_contacts")
        .select<{ subscriber_id?: string | null }[]>("subscriber_id")
        .eq("user_id", userId)
        .in("phone_e164", [`+${telefono.replace(/\D/g, "")}`, telefono.replace(/\D/g, "")])
        .not("subscriber_id", "is", null)
        .limit(1);
      const daRubrica = Number(rubrica?.[0]?.subscriber_id);
      return Number.isSafeInteger(daRubrica) && daRubrica > 0 ? daRubrica : null;
    },
    //  La finestra di 24 ore: la stessa colonna che usa la chat (`finestra24`).
    ultimaEntrata: async (telefono) => {
      const cifre = String(telefono).replace(/\D/g, "");
      const { data } = await db
        .from("whatsapp_contacts")
        .select<{ ultimo_in_entrata_il?: string | null }[]>("ultimo_in_entrata_il")
        .eq("user_id", userId)
        .in("phone_e164", [`+${cifre}`, cifre])
        .not("ultimo_in_entrata_il", "is", null)
        .order("ultimo_in_entrata_il", { ascending: false })
        .limit(1);
      return data?.[0]?.ultimo_in_entrata_il ?? null;
    },
    registra: async (m: MessaggioPorta) => {
      await db.from("whatsapp_messages").insert({
        user_id: userId,
        lead_id: m.leadId,
        direction: "outbound",
        from_number: "manychat",
        to_number: m.a,
        body: m.corpo,
        status: m.stato,
        wa_message_id: m.waId,
        error_message: m.errore,
        raw_payload: {},
        canale: "manychat",
      });
      if (m.stato === "sent")
        await db.from("whatsapp_contacts").upsert(
          {
            user_id: userId,
            phone_e164: m.a,
            lead_id: m.leadId,
            last_message_at: new Date().toISOString(),
          },
          { onConflict: "user_id,phone_e164" },
        );
    },
    //  Il codice Cloud di prima, spostato qui: le chiavi, la chiamata, il tempo massimo.
    cloud: async (corpo) => {
      let cloud = o.cloud;
      if (!cloud) {
        const { data } = await db
          .from("whatsapp_settings")
          .select<{
            phone_number_id?: string | null;
            access_token?: string | null;
          }>("phone_number_id, access_token")
          .eq("user_id", userId)
          .maybeSingle();
        if (data?.phone_number_id && data.access_token)
          cloud = { phoneNumberId: data.phone_number_id, token: data.access_token };
      }
      //  Senza chiavi: lo stesso rifiuto «token non valido» che il giro già conosce.
      if (!cloud) return { status: 400, corpo: { error: { code: 190 } } };
      const res = await fetch(`${META_API}/${cloud.phoneNumberId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cloud.token}` },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(20_000),
      });
      return { status: res.status, corpo: await res.json().catch(() => null) };
    },
  };
}
