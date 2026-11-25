/** ── LA CASSA DEL SITO, PER LE PAGINE ───────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T50 (PIANO-R2 D56). Solo l'involucro `createServerFn` di `cassa-sito.ts` (puro e
 *  provato): collega `supabaseAdmin`, il catalogo del sito e `SHOP_CASSA_FORZA`.
 *  Risponde `vecchia` o `stripe` (la cassa EFFETTIVA: `stripe` solo con il catalogo `cms`); mai un errore. Se il collegamento
 *  non si fa o la lettura fallisce risponde `vecchia` e dice al CDN di non tenerla (`no-store`).
 *  ⚠️ Collaudo con chiave (T67, D57): con il cookie valido la cassa è `stripe` (senza leggere il database) e la risposta non si tiene da
 *   nessuna parte. Senza cookie non cambia niente.
 *  ⚠️ `SHOP_CASSA_FORZA` vale solo in locale (`import.meta.env.DEV`): in produzione l'unica fonte è la tabella. */
import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl, setResponseHeader } from "@tanstack/react-start/server";
import { cacheDellaRisposta } from "./catalogo.server";
import { CACHE_COLLAUDO } from "./collaudo";
import { catalogoPubblico, collaudoDellaRichiesta } from "./catalogo.functions";
import { cassaEffettiva, leggiCassa, type Cassa, type DbCassa } from "./cassa-sito";

/** La cassa effettiva adesso e se la lettura è andata male (in quel caso è `vecchia`). Non lancia mai.
 *  `cookie`: l'intestazione `Cookie` della richiesta (la rotta di cassa la passa); senza argomento si legge dalla richiesta in corso
 *  (la rotta del permesso la chiama così). Con il collaudo valido: `stripe`, e `guasto: true` = «la risposta non si tiene» (chi la usa per
 *  le intestazioni mette `no-store`; la sola `cassaPubblica` e `cassaDelSito` la leggono così). */
export async function cassaEffettivaDelServer(cookie?: string | null): Promise<{ cassa: Cassa; guasto: boolean; collaudo?: true }> {
  let guasto = false;
  try {
    if (await collaudoDellaRichiesta(cookie)) return { cassa: "stripe", guasto: true, collaudo: true };
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
  const { cassa, guasto, collaudo } = await cassaEffettivaDelServer();
  try {
    const intestazione = cacheDellaRisposta(
      collaudo ? CACHE_COLLAUDO : guasto ? "no-store" : "public, max-age=15",
      getRequestUrl().pathname,
    );
    if (intestazione) setResponseHeader("Cache-Control", intestazione);
  } catch {
    /* fuori da una richiesta (prove, prerender): niente intestazione */
  }
  return cassa;
});

/** Per `shop.tsx` (sul server): il collaudo è attivo per questa visita? Serve a `headers` della rotta, che non vede la richiesta.
 *  Sta qui e non in `catalogo.functions.ts`: quel file ha le sue sei funzioni, provate da R1. */
export const collaudoDellaVisita = createServerFn({ method: "GET" }).handler(() => collaudoDellaRichiesta());
