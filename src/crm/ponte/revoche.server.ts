/** ── LA PORTA VERA DELLE REVOCHE DEL PONTE ───────────────────────────────────
 *
 *  Commessa 2026-10-31, ponte-revoche. Il collegamento fra `ingresso.ts` (la logica) e Supabase:
 *  nessuna regola qui, solo la funzione SQL `ponte_wa_revoca` della migrazione
 *  `20261031090000_ponte_revoche`. Sta in un file a parte (come `media.server.ts`) perché la prova
 *  di rotta fissa le funzioni SQL chiamate da `porte.server.ts`.
 *
 *  ⚠️ Chiave di servizio (la RLS qui non vale): l'utente viene SOLO da `manychat_config`, in
 *   `ingresso.ts`, e va in `p_user_id`; la chiave `bw:` l'ha già controllata `leggiRevoca`.
 *  ⚠️ LANCIA `{ code }` se il database dice di no: mai il messaggio d'errore. Migrazione non
 *   applicata = 42883 (l'ingresso la riconosce e il Mac ritenta per 24 ore).
 *  ⚠️ Nei log niente da qui: il codice «revoca» lo scrive `porte.avviso` con soli contatori.
 *  ───────────────────────────────────────────────────────────────────────── */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PorteRevoche } from "./tipi";

type Esito<T> = PromiseLike<{ data: T | null; error: { code?: string | null } | null }>;
/** I tipi generati non conoscono la funzione nuova. */
const db = () =>
  supabaseAdmin as unknown as { rpc<T>(fn: string, a: Record<string, unknown>): Esito<T> };

/** Un intero ≥ 0 dal jsonb (un campo mancante o storto vale 0). */
const intero = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;

/** `ponte_wa_revoca` marca come eliminata la riga del ponte con quella chiave e il suo pari
 *  ManyChat/CRM (mai un DELETE), e ricalcola l'anteprima del contatto. */
export function porteRevoche(): PorteRevoche {
  return {
    revoca: async (userId, chiave) => {
      const { data, error } = await db().rpc<Record<string, unknown>>("ponte_wa_revoca", {
        p_user_id: userId,
        p_chiave: chiave,
      });
      if (error) throw { code: String(error.code ?? "?") };
      const d = data ?? {};
      return { trovate: intero(d.trovate), marcate: intero(d.marcate) };
    },
  };
}
