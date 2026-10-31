/** ── PONTE WHATSAPP · MEDIA: L'ACCESSO COMUNE AL DATABASE ───────────────────
 *
 *  Commessa 2026-10-31-media-e-archiviazione, compito T2 (PIANO f, dipendenza
 *  T2 → T3). Le tre piccole cose che `media.server.ts` (T2) e
 *  `media-azioni.server.ts` (T3) usano insieme: il database con i tipi larghi,
 *  l'errore da lanciare, l'utente dell'installazione. Nessuna regola qui.
 *
 *  ⚠️ Chiave di servizio (la RLS qui non vale): l'utente viene SOLO da
 *   `manychat_config` (riga `id=1`) e va in ogni filtro e in ogni `p_user_id`.
 *  ⚠️ `lancia` butta solo `{ code }`: mai il messaggio d'errore, che può portare
 *   numeri, percorsi o indirizzi firmati.
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type ErroreDb = { code?: string | null } | null;
type Esito<T> = PromiseLike<{ data: T | null; error: ErroreDb }>;
interface Filtro<T> extends Esito<T> {
  eq(c: string, v: string | number): Filtro<T>;
  maybeSingle(): Esito<T extends (infer U)[] ? U : T>;
}

/** I tipi generati non conoscono le tabelle e le funzioni nuove. */
export const dbMedia = () =>
  supabaseAdmin as unknown as {
    from(t: string): { select<T = Record<string, unknown>[]>(c: string): Filtro<T> };
    rpc<T>(fn: string, a: Record<string, unknown>): Esito<T>;
  };

/** Un errore del database diventa `{ code }` e basta. */
export const lancia = (e: { code?: string | null }): never => {
  throw { code: String(e.code ?? "?") };
};

/** `manychat_config.user_id` (riga `id=1`); null = non configurato. */
export const utenteDelPonte = async (): Promise<string | null> => {
  const { data, error } = await dbMedia()
    .from("manychat_config")
    .select<{ user_id: string | null }[]>("user_id")
    .eq("id", 1)
    .maybeSingle();
  if (error) return lancia(error);
  return data?.user_id || null;
};
