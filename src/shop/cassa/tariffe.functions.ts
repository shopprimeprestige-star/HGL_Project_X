/** ── LA TARIFFA DI SPEDIZIONE, PER LE PAGINE ────────────────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T50 (PIANO-R2 D51, D62, §3.7). Solo l'involucro `createServerFn` di
 *  `tariffe.server.ts` (provato con un finto database): collega `supabaseAdmin` e la cassa effettiva. Scheda, carrello e cassa
 *  leggono QUESTA funzione. Risponde `SpedizionePubblica` (costo sempre; corriere, tempi e frase solo se la tariffa è
 *  confermata) oppure `{stato:"assente"}`; mai un errore verso il pubblico.
 *  Memoria: `Cache-Control: public, max-age=30` solo sulla chiamata del browser (`/_serverFn/…`), come il catalogo.
 *  ⚠️ Collaudo con chiave (T67): col cookie valido la cassa effettiva è `stripe` e la risposta può differire da quella del pubblico (S5 assente):
 *   esce `private, no-store`. Il cookie si legge una volta e si passa alla cassa. */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestUrl, setResponseHeader } from "@tanstack/react-start/server";
import { cacheDellaRisposta } from "../cms/catalogo.server";
import { collaudoDellaRichiesta } from "../cms/catalogo.functions";
import { CACHE_COLLAUDO } from "../cms/collaudo";
import { cassaEffettivaDelServer } from "../cms/cassa-sito.functions";
import type { SpedizionePubblica } from "./spedizione";
import { tariffaSpedizione as leggiTariffa, type DbTariffe } from "./tariffe.server";

export const tariffaSpedizione = createServerFn({ method: "GET" }).handler(
  async (): Promise<SpedizionePubblica> => {
    let r: SpedizionePubblica = { stato: "assente" };
    let cookie: string | null = null;
    try {
      cookie = getRequestHeader("cookie") ?? null;
    } catch {
      /* fuori da una richiesta (prove, prerender): nessun cookie */
    }
    const collaudo = await collaudoDellaRichiesta(cookie);
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      r = await leggiTariffa({
        db: supabaseAdmin as unknown as DbTariffe,
        adesso: () => Date.now(),
        cassa: async () => (await cassaEffettivaDelServer(cookie)).cassa,
        log: (codice) => console.warn("shop-tariffa", codice),
      });
    } catch {
      /* assente */
    }
    try {
      const intestazione = cacheDellaRisposta(collaudo ? CACHE_COLLAUDO : "public, max-age=30", getRequestUrl().pathname);
      if (intestazione) setResponseHeader("Cache-Control", intestazione);
    } catch {
      /* fuori da una richiesta (prove, prerender): niente intestazione */
    }
    return r;
  },
);
