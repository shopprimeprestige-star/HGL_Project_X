/** ── LE SEI FUNZIONI DEL SERVER PER IL CATALOGO PUBBLICO ────────────────────
 *  Commessa 2026-11-20-shop-completo (T11). Solo l'involucro `createServerFn`: collega `supabaseAdmin`, le variabili
 *  d'ambiente e le intestazioni. Tutto il resto, e le prove, sono in `catalogo.server.ts`.
 *
 *  ⚠️ Mai un errore al pubblico: se il collegamento non si fa (variabili mancanti, rete), ogni funzione risponde
 *   `codice` / vuoto / `null` / «non più disponibile», come con la migrazione non applicata.
 *  ⚠️ Memoria: `Cache-Control: public, max-age=30` (la memoria dell'isolato ne aggiunge altri 30), ma SOLO sulla chiamata
 *   del browser (`/_serverFn/…`): nel rendering della pagina il `public` non si imposta (`cacheDellaRisposta`). La scheda con la chiave
 *   d'anteprima è privata e `no-store`: non si ferma da nessuna parte.
 *  ⚠️ Collaudo con chiave (T67, D57): con il cookie `__Host-hgl_collaudo` valido, SOLO per quel browser, il catalogo è `cms` (un'istanza a
 *   parte, con la sua memoria) e ogni risposta è `private, no-store`. Senza cookie (o con uno falso, scaduto, di altro segreto) non cambia niente. */
import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { getRequestHeader, getRequestUrl, setResponseHeader } from "@tanstack/react-start/server";
import { cacheDellaRisposta, creaCatalogo, type Catalogo, type ClienteDb, type EsitoScheda } from "./catalogo.server";
import { CACHE_COLLAUDO, collaudoValido } from "./collaudo";

/** Una per isolato: la memoria breve sta qui. */
let istanza: Catalogo | null = null;
/** Anche per le rotte del server (la sitemap): la stessa istanza, quindi la stessa memoria breve. */
export async function catalogoPubblico(): Promise<Catalogo> {
  if (!istanza) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const url = process.env.SUPABASE_URL;
    istanza = creaCatalogo({
      db: supabaseAdmin as unknown as ClienteDb,
      adesso: () => Date.now(),
      baseMedia: url ? `${url.replace(/\/+$/, "")}/storage/v1/object/public/shop-media` : "",
      chiaveServizio: process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
      forza: process.env.SHOP_CATALOGO_FORZA ?? null,
      log: (codice) => console.warn("shop-catalogo", codice),
    });
  }
  return istanza;
}

/** Legge il cookie della richiesta in corso. `createServerOnlyFn` (non un `import()` dinamico del modulo del server: in `vite dev` finiva nel client e
 *  `import-protection` rifiutava tutto con un 500, T107): nel browser lancia, e `collaudoDellaRichiesta` risponde `false` col suo `try/catch`. */
const leggiCookie = createServerOnlyFn(() => getRequestHeader("cookie"));

/** Il cookie del collaudo di QUESTA richiesta è valido? Il segreto si legge qui, ogni volta. Mai un'eccezione; fuori da una richiesta (prove,
 *  prerender) o senza cookie: no, e senza lavoro. */
export async function collaudoDellaRichiesta(cookie?: string | null): Promise<boolean> {
  try {
    const intestazione = cookie === undefined ? leggiCookie() : cookie;
    if (!intestazione) return false;
    return await collaudoValido(intestazione, process.env.SUPABASE_SERVICE_ROLE_KEY, Date.now());
  } catch {
    return false;
  }
}

/** Il catalogo del collaudo: come quello pubblico ma sempre `cms`, con una memoria sua (le risposte non si mescolano mai a quelle del pubblico). */
let istanzaCollaudo: Catalogo | null = null;
async function catalogoCollaudo(): Promise<Catalogo> {
  if (!istanzaCollaudo) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const url = process.env.SUPABASE_URL;
    istanzaCollaudo = creaCatalogo({
      db: supabaseAdmin as unknown as ClienteDb,
      adesso: () => Date.now(),
      baseMedia: url ? `${url.replace(/\/+$/, "")}/storage/v1/object/public/shop-media` : "",
      chiaveServizio: process.env.SUPABASE_SERVICE_ROLE_KEY ?? null,
      forza: "cms",
      log: (codice) => console.warn("shop-catalogo-collaudo", codice),
    });
  }
  return istanzaCollaudo;
}

/** Esegue, con la memoria breve (`cache` può dipendere dal risultato); qualunque guasto → `vuoto`. */
async function letto<T>(vuoto: T, f: (k: Catalogo) => Promise<T>, cache: string | ((r: T) => string) = "public, max-age=30"): Promise<T> {
  let r = vuoto;
  const collaudo = await collaudoDellaRichiesta();
  try {
    r = await f(collaudo ? await catalogoCollaudo() : await catalogoPubblico());
  } catch {
    /* vuoto */
  }
  try {
    // solo per la chiamata del browser: nel rendering della pagina l'HTML non si tiene in memoria
    const intestazione = cacheDellaRisposta(collaudo ? CACHE_COLLAUDO : typeof cache === "function" ? cache(r) : cache, getRequestUrl().pathname);
    if (intestazione) setResponseHeader("Cache-Control", intestazione);
  } catch {
    /* fuori da una richiesta (prove, prerender): niente intestazione */
  }
  return r;
}

export const modalitaCatalogo = createServerFn({ method: "GET" }).handler(() => letto<"codice" | "cms">("codice", (k) => k.modalita()));

export const elencoProdotti = createServerFn({ method: "GET" })
  .inputValidator((d?: { categoria?: string; q?: string }) => ({ categoria: String(d?.categoria ?? ""), q: String(d?.q ?? "") }))
  .handler(({ data }) => letto([], (k) => k.elenco(data)));

export const schedaProdotto = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string; chiave?: string }) => ({ slug: String(d?.slug ?? ""), chiave: String(d?.chiave ?? "") }))
  // risponde `{esito: "trovato", prodotto} | {esito: "non_trovato"} | {esito: "guasto"}`: sul guasto la risposta è `no-store`
  .handler(({ data }) =>
    letto<EsitoScheda>({ esito: "guasto" }, (k) => k.schedaEsito(data.slug, data.chiave), (r) => (data.chiave || r.esito === "guasto" ? "private, no-store" : "public, max-age=30")),
  );

export const elencoCategorie = createServerFn({ method: "GET" }).handler(() => letto([], (k) => k.categorie()));

export const vociSitemap = createServerFn({ method: "GET" }).handler(() => letto([], (k) => k.vociSitemap()));

export const righeCarrello = createServerFn({ method: "POST" })
  .inputValidator((d: { skus: string[] }) => ({ skus: Array.isArray(d?.skus) ? d.skus.map(String) : [] }))
  .handler(({ data }) => letto(data.skus.map((sku) => ({ sku, nonPiuDisponibile: true as const })), (k) => k.righeCarrello(data.skus), "no-store"));
