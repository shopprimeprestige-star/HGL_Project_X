/** ── LA CASSA, PER LA VETRINA: `{cassa, sicuro, metodi}` ─────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T56 (PIANO-R2 D56, D65). Solo l'involucro `createServerFn`: collega `supabaseAdmin` e la
 *  cassa EFFETTIVA di `cassa-sito.functions.ts` (un solo punto di decisione: `stripe` solo con il catalogo `cms`); la lettura vera
 *  e le sue regole sono in `src/crm/negozio/fatti.server.ts` (`leggiVetrinaCassa`, provata con un database finto).
 *  Con la cassa effettiva `vecchia` risponde `{cassa:"vecchia", sicuro:false, metodi:[]}` senza leggere niente. Mai un errore:
 *  se il collegamento o la lettura falliscono, falso e vuoto, e `no-store` (la risposta di un guasto non si tiene da nessuna parte).
 *  Intestazioni come la cassa: `public, max-age=15`, solo sulla chiamata del browser (`cacheDellaRisposta`). */
import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl, setResponseHeader } from "@tanstack/react-start/server";
import { leggiVetrinaCassa } from "@/crm/negozio/fatti.server";
import type { ClienteDb } from "@/crm/negozio/comune";
import { cacheDellaRisposta } from "./catalogo.server";
import { collaudoDellaRichiesta } from "./catalogo.functions";
import { CACHE_COLLAUDO } from "./collaudo";
import { cassaEffettivaDelServer } from "./cassa-sito.functions";
import type { Cassa } from "./cassa-sito";

export interface CassaPubblica {
  cassa: Cassa;
  /** «Pagamento sicuro» si può scrivere in vetrina (solo dopo un pagamento reale rimborsato, D65). */
  sicuro: boolean;
  /** I metodi spuntati (loghi in vetrina). */
  metodi: string[];
}

export const cassaPubblica = createServerFn({ method: "GET" }).handler(
  async (): Promise<CassaPubblica> => {
    const { cassa, guasto: guastoCassa } = await cassaEffettivaDelServer();
    let esito: CassaPubblica = { cassa, sicuro: false, metodi: [] };
    let guasto = guastoCassa;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const v = await leggiVetrinaCassa({
        db: supabaseAdmin as unknown as ClienteDb,
        cassa,
        log: (codice) => console.warn("shop-cassa-pubblica", codice),
      });
      esito = { cassa, sicuro: v.sicuro, metodi: v.metodi };
      guasto = guasto || v.guasto;
    } catch {
      guasto = true;
    }
    // col cookie del collaudo l'HTML della pagina resta `private, no-store` (T114b: un guasto qui non deve scendere a `no-store` e sovrascriverlo)
    const inCollaudo = await collaudoDellaRichiesta().catch(() => false);
    try {
      const intestazione = cacheDellaRisposta(
        inCollaudo ? CACHE_COLLAUDO : guasto ? "no-store" : "public, max-age=15",
        getRequestUrl().pathname,
      );
      if (intestazione) setResponseHeader("Cache-Control", intestazione);
    } catch {
      /* fuori da una richiesta (prove, prerender): niente intestazione */
    }
    return esito;
  },
);
