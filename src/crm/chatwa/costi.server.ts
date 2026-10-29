/** ── I COSTI WHATSAPP · LA LETTURA (solo server) ────────────────────────────
 *
 *  Commessa 2026-10-29-chat-modelli-costi. Legge il registro degli invii di
 *  ManyChat (`manychat_invii`) con la chiave di servizio, SEMPRE con `user_id` nel
 *  filtro (la RLS qui non vale), e lascia il calcolo a `calcolo-costi.ts` (puro).
 *  Lo usa `routes/api.crm.whatsapp-costi.ts`, dietro `guardiaCRM`.
 *
 *  ⚠️ Si seleziona SOLO tipo, flusso e ora: mai telefono, scheda o nome. Il flusso
 *   (`flow_ns`) si traduce nel nome del modello con `manychat_config.flussi`.
 *  ⚠️ Gli invii della chat e quelli del giro stanno tutti in `manychat_invii`
 *   (`tipo = 'chat'` per la chat); le righe che la porta scrive in `whatsapp_messages`
 *   sono le stesse (`wa_message_id = mc:<id>`): leggerle anche lì conterebbe due volte.
 *  ⚠️ Chi legge LANCIA `{ code }` se il database dice di no: la rotta registra il solo codice.
 *  shortcut: al massimo 20 pagine da 1000 righe (20.000 invii nel periodo), oltre i tetti
 *   del giro in 90 giorni non ci si arriva; da cambiare se i tetti salgono molto.
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { calcolaCosti, inizioPeriodo, type Costi, type InvioPagato } from "./calcolo-costi";

type ErroreDb = { code?: string | null } | null;
interface Interrogazione<T> extends PromiseLike<{ data: T | null; error: ErroreDb }> {
  eq(c: string, v: string): Interrogazione<T>;
  gte(c: string, v: string): Interrogazione<T>;
  order(c: string, o: { ascending: boolean }): Interrogazione<T>;
  range(da: number, a: number): Interrogazione<T>;
  maybeSingle(): PromiseLike<{ data: T extends (infer U)[] ? U | null : T | null; error: ErroreDb }>;
}
/** I tipi generati non conoscono queste tabelle. */
const db = supabaseAdmin as unknown as {
  from(t: string): { select<T>(c: string): Interrogazione<T> };
};

interface RigaInvio {
  tipo: string;
  flow_ns: string | null;
  inviato_il: string | null;
}

const PAGINA = 1000;
const MAX_PAGINE = 20;

const lancia = (e: NonNullable<ErroreDb>): never => {
  throw { code: e.code ?? "?" };
};

/** flow_ns → nome del modello, dalla configurazione del canale. */
async function modelliPerFlusso(userId: string): Promise<Map<string, string>> {
  const r = await db
    .from("manychat_config")
    .select<{ flussi?: Record<string, unknown> | null }[]>("flussi")
    .eq("user_id", userId)
    .maybeSingle();
  if (r.error) lancia(r.error);
  const mappa = new Map<string, string>();
  for (const [modello, ns] of Object.entries(r.data?.flussi ?? {}))
    if (typeof ns === "string" && ns.trim()) mappa.set(ns.trim(), modello);
  return mappa;
}

export async function leggiCosti(userId: string, periodo: string, adesso: Date): Promise<Costi> {
  const dal = inizioPeriodo(periodo, adesso).toISOString();
  const modelli = await modelliPerFlusso(userId);
  const invii: InvioPagato[] = [];
  for (let p = 0; p < MAX_PAGINE; p++) {
    const r = await db
      .from("manychat_invii")
      .select<RigaInvio[]>("tipo, flow_ns, inviato_il")
      .eq("user_id", userId)
      .eq("stato", "inviato")
      .gte("inviato_il", dal)
      .order("inviato_il", { ascending: false })
      .order("id", { ascending: false })
      .range(p * PAGINA, (p + 1) * PAGINA - 1);
    if (r.error) lancia(r.error);
    const righe = r.data ?? [];
    for (const x of righe) {
      if (!x.inviato_il) continue;
      invii.push({
        tipo: x.tipo,
        modello: x.flow_ns ? (modelli.get(x.flow_ns) ?? null) : null,
        conFlusso: !!x.flow_ns,
        inviatoIl: x.inviato_il,
      });
    }
    if (righe.length < PAGINA) break;
  }
  return calcolaCosti(invii, periodo, adesso);
}
