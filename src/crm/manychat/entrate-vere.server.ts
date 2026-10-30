/** ── L'ULTIMA ENTRATA VERA DEI CONTATTI, PER LA FINESTRA DI 24 ORE (solo server) ──
 *
 *  Una reazione non riapre la finestra (vedi `chatwa/entrata-vera`). Chi decide fra testo
 *  libero e modello (`porta.server`, `porte.server`, `dati-fattura.server`) legge le righe
 *  di `whatsapp_contacts` e le passa di qui: per i soli contatti con una reazione come ultima
 *  entrata si leggono i messaggi recenti, in UNA lettura.
 *  ⚠️ Con la chiave di servizio e sempre con `user_id` nel filtro. Un guasto della lettura
 *   lancia: `entrateVere` lo prende e lascia quei contatti senza finestra (parte il modello).
 *  ⚠️ Niente testo dei clienti nei log: l'errore sale senza messaggio.
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { entrateVere, type MessaggioEntrata, type RigaEntrata } from "../chatwa/entrata-vera";
import { CANALE_PONTE } from "../ponte/tipi";

/** Oltre la finestra (23 ore, `ORE_TESTO_LIBERO`) un messaggio non serve: un'ora di margine. */
const ORE_LETTURA = 25;
/** Basta e avanza per le entrate recenti di pochi contatti. */
const RIGHE_MAX = 500;

type Catena = PromiseLike<{ data: MessaggioEntrata[] | null; error: { code?: string } | null }> & {
  eq(c: string, v: string): Catena;
  in(c: string, v: string[]): Catena;
  gte(c: string, v: string): Catena;
  or(filtri: string): Catena;
  order(c: string, o: { ascending: boolean }): Catena;
  limit(n: number): Catena;
};
const db = () => supabaseAdmin as unknown as { from(t: string): { select(c: string): Catena } };

/** I messaggi in entrata recenti di questi telefoni (con e senza «+»). */
async function messaggiRecenti(userId: string, telefoni: string[]): Promise<MessaggioEntrata[]> {
  const formati = telefoni
    .map((t) => t.replace(/\D/g, ""))
    .filter(Boolean)
    .flatMap((cifre) => [`+${cifre}`, cifre]);
  if (formati.length === 0) return [];
  const { data, error } = await db()
    .from("whatsapp_messages")
    .select("from_number, direction, body, created_at, canale")
    .eq("user_id", userId)
    .eq("direction", "inbound")
    .in("from_number", formati)
    .gte("created_at", new Date(Date.now() - ORE_LETTURA * 3_600_000).toISOString())
    //  Le righe del ponte WhatsApp sono solo da vedere: nessuna regola le legge (I3).
    .or(`canale.is.null,canale.neq.${CANALE_PONTE}`)
    .order("created_at", { ascending: false })
    .limit(RIGHE_MAX);
  if (error) throw { code: error.code ?? "?" };
  return data ?? [];
}

/** Le righe dei contatti con `ultimo_in_entrata_il` = l'ultima entrata che apre la finestra. */
export const entrateVereDi = <T extends RigaEntrata>(userId: string, righe: T[]): Promise<T[]> =>
  entrateVere(righe, (telefoni) => messaggiRecenti(userId, telefoni));
