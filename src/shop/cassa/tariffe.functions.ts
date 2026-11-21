/** ── LA TARIFFA DI SPEDIZIONE, PER LE PAGINE ────────────────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T50 (PIANO-R2 D51, D62, §3.7). Solo l'involucro `createServerFn` di
 *  `tariffe.server.ts` (provato con un finto database): collega `supabaseAdmin` e la cassa effettiva. Scheda, carrello e cassa
 *  leggono QUESTA funzione. Risponde `SpedizionePubblica` (costo sempre; corriere, tempi e frase solo se la tariffa è
 *  confermata) oppure `{stato:"assente"}`; mai un errore verso il pubblico.
 *  Memoria: `Cache-Control: public, max-age=30` solo sulla chiamata del browser (`/_serverFn/…`), come il catalogo. */
import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl, setResponseHeader } from "@tanstack/react-start/server";
import { cacheDellaRisposta } from "../cms/catalogo.server";
import { cassaEffettivaDelServer } from "../cms/cassa-sito.functions";
import type { SpedizionePubblica } from "./spedizione";
import { tariffaSpedizione as leggiTariffa, type DbTariffe } from "./tariffe.server";

export const tariffaSpedizione = createServerFn({ method: "GET" }).handler(
  async (): Promise<SpedizionePubblica> => {
    let r: SpedizionePubblica = { stato: "assente" };
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      r = await leggiTariffa({
        db: supabaseAdmin as unknown as DbTariffe,
        adesso: () => Date.now(),
        cassa: async () => (await cassaEffettivaDelServer()).cassa,
        log: (codice) => console.warn("shop-tariffa", codice),
      });
    } catch {
      /* assente */
    }
    try {
      const intestazione = cacheDellaRisposta("public, max-age=30", getRequestUrl().pathname);
      if (intestazione) setResponseHeader("Cache-Control", intestazione);
    } catch {
      /* fuori da una richiesta (prove, prerender): niente intestazione */
    }
    return r;
  },
);
