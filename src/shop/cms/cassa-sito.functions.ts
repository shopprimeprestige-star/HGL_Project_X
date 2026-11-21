/** ── LA CASSA DEL SITO, PER LE PAGINE ───────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T50 (PIANO-R2 D56). Solo l'involucro `createServerFn` di `cassa-sito.ts` (puro e
 *  provato): collega `supabaseAdmin`, il catalogo del sito e `SHOP_CASSA_FORZA`.
 *  Risponde `vecchia` o `stripe` (la cassa EFFETTIVA: `stripe` solo con il catalogo `cms`); mai un errore. Se il collegamento
 *  non si fa o la lettura fallisce risponde `vecchia` e dice al CDN di non tenerla (`no-store`).
 *  ⚠️ `SHOP_CASSA_FORZA` vale solo in locale (`import.meta.env.DEV`): in produzione l'unica fonte è la tabella. */
import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl, setResponseHeader } from "@tanstack/react-start/server";
import { cacheDellaRisposta } from "./catalogo.server";
import { catalogoPubblico } from "./catalogo.functions";
import { cassaEffettiva, leggiCassa, type Cassa, type DbCassa } from "./cassa-sito";

/** La cassa effettiva adesso e se la lettura è andata male (in quel caso è `vecchia`). Non lancia mai. */
export async function cassaEffettivaDelServer(): Promise<{ cassa: Cassa; guasto: boolean }> {
  let guasto = false;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [catalogo, scelta] = await Promise.all([
      catalogoPubblico().then((k) => k.modalita()),
      leggiCassa({
        db: supabaseAdmin as unknown as DbCassa,
        forza: import.meta.env.DEV ? (process.env.SHOP_CASSA_FORZA ?? null) : null,
        log: (codice) => {
          guasto = true;
          console.warn("shop-cassa", codice);
        },
      }),
    ]);
    return { cassa: cassaEffettiva(catalogo, scelta), guasto };
  } catch {
    return { cassa: "vecchia", guasto: true };
  }
}

export const cassaDelSito = createServerFn({ method: "GET" }).handler(async (): Promise<Cassa> => {
  const { cassa, guasto } = await cassaEffettivaDelServer();
  try {
    const intestazione = cacheDellaRisposta(
      guasto ? "no-store" : "public, max-age=15",
      getRequestUrl().pathname,
    );
    if (intestazione) setResponseHeader("Cache-Control", intestazione);
  } catch {
    /* fuori da una richiesta (prove, prerender): niente intestazione */
  }
  return cassa;
});
