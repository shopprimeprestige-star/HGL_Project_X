/** ── IL CONTENUTO DELLO SHOP, LETTO DAL SERVER ──────────────────────────────
 *  Commessa 2026-11-20-shop-completo, V1 · T80 (PIANO-V1 D76). Solo l'involucro `createServerFn`: collega `supabaseAdmin` e le intestazioni.
 *  Le regole e il lettore con memoria sono in `vetrina-contenuto.ts` (provato con un finto client).
 *
 *  Le pagine lo chiamano nel `loader` (nell'HTML del server): la foto dell'hero parte subito, senza aspettare l'idratazione (V1-T14).
 *  ⚠️ Esce SOLO ciò che comincia per `shop.` (testi e media salvati): mai le altre chiavi della landing, mai le recensioni.
 *  ⚠️ Mai un errore al pubblico: se la lettura non riesce risponde `{testi:{}, media:{}}` (testi di partenza, slot vuoti) e `no-store`.
 *  ⚠️ Memoria 30 s (`public, max-age=30`, solo sulla chiamata del browser: nel rendering della pagina l'HTML non si tiene, `cacheDellaRisposta`).
 *   Con il cookie del collaudo valido: `private, no-store` e nessuna memoria, come le funzioni del catalogo. */
import { createServerFn } from "@tanstack/react-start";
import { getRequestUrl, setResponseHeader } from "@tanstack/react-start/server";
import { cacheDellaRisposta } from "./catalogo.server";
import { collaudoDellaRichiesta } from "./catalogo.functions";
import { CACHE_COLLAUDO } from "./collaudo";
import { contenutoVuoto, creaLettoreContenuto, type ClienteContenuto, type ContenutoShop, type LetturaContenuto } from "./vetrina-contenuto";

/** Due lettori per isolato: il pubblico (memoria 30 s) e il collaudo (nessuna memoria). */
let pubblico: (() => Promise<LetturaContenuto>) | null = null;
let collaudo: (() => Promise<LetturaContenuto>) | null = null;

/** La lettura, senza toccare le intestazioni: per chi è già dentro una risposta sua (la pagina ordine, che resta `no-store`). Mai un'eccezione. */
export async function contenutoDelServer(inCollaudo = false): Promise<LetturaContenuto> {
  try {
    //  import dinamico: una funzione esportata che nomina il client del server lo porterebbe nel pacchetto del browser
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const porte = { db: supabaseAdmin as unknown as ClienteContenuto, adesso: () => Date.now(), log: (codice: string) => console.warn("shop-contenuto", codice) };
    if (inCollaudo) collaudo ??= creaLettoreContenuto({ ...porte, memoriaMs: 0 });
    else pubblico ??= creaLettoreContenuto(porte);
    return await (inCollaudo ? collaudo! : pubblico!)();
  } catch {
    return { contenuto: contenutoVuoto(), guasto: true };
  }
}

export const contenutoShop = createServerFn({ method: "GET" }).handler(async (): Promise<ContenutoShop> => {
  const inCollaudo = await collaudoDellaRichiesta();
  const { contenuto, guasto } = await contenutoDelServer(inCollaudo);
  try {
    // il guasto non si tiene da nessuna parte; il collaudo è privato
    const intestazione = cacheDellaRisposta(inCollaudo ? CACHE_COLLAUDO : guasto ? "no-store" : "public, max-age=30", getRequestUrl().pathname);
    if (intestazione) setResponseHeader("Cache-Control", intestazione);
  } catch {
    /* fuori da una richiesta (prove, prerender): niente intestazione */
  }
  return contenuto;
});
