/** ── LA SCHEDA PRODOTTO COL CATALOGO CMS: LE DECISIONI SENZA REACT ──────────
 *  Commessa 2026-11-20-shop-completo (T20). Modulo PURO: la pagina `shop.prodotto.$slug.tsx` lo collega e basta, così
 *  si prova senza browser. Quattro cose:
 *   · `cercaScheda`: cosa mostrare. Un guasto del database NON è «Prodotto non trovato» (per Google e per il cliente):
 *     è `temporaneo`. Con il catalogo `codice` la pagina è quella di oggi; solo se lo SLUG non è del vecchio catalogo si
 *     chiede al server se è un guasto (mai per esporre un prodotto CMS con l'interruttore su `codice`).
 *  · `testataScheda`: titolo, descrizione, immagine, indirizzo canonico e JSON-LD; `noindex` e NIENTE JSON-LD in anteprima.
 *  · `datiEventoScheda`: i dati di `ViewContent` e `AddToCart` (stesso SKU, centesimi interi).
 *  · `primaVolta`: «una volta per prodotto e sessione».
 *  · `intestazioniScheda`: `no-store` per il guasto, `private, no-store` per l'anteprima.
 *  ⚠️ Mai la giacenza: arriva solo `disponibile`. */
import type { DatiEvento } from "../../lib/tracciamento/eventi";
import type { Product } from "../catalog";
import { skuDaCodice } from "./adattatore";
import type { EsitoScheda } from "./catalogo.server";
import { datiStrutturatiProdotto, serializzaJsonLd } from "./json-ld";
import type { ProdottoPubblico } from "./modello";
import { eInvisibleDerm } from "./pubblico";

const MARCHIO = "Hair Genius";

/* ── cosa mostrare ── */

export type Scheda =
  | { tipo: "codice" }
  | { tipo: "cms"; prodotto: ProdottoPubblico }
  | { tipo: "non_trovato" }
  | { tipo: "temporaneo" };

export interface PorteScheda {
  /** `modalitaCatalogo()`: se non risponde (rete) si pensa `codice`, che è il sito di oggi. */
  modalita: () => Promise<"codice" | "cms">;
  /** `schedaProdotto(slug, chiave)`: può lanciare (rete del cliente). */
  scheda: (slug: string, chiave: string) => Promise<EsitoScheda>;
  /** Il vecchio catalogo conosce questo indirizzo? */
  nelCodice: (slug: string) => boolean;
}

export async function cercaScheda(porte: PorteScheda, slug: string, chiave: string): Promise<Scheda> {
  let modo: "codice" | "cms" = "codice";
  try {
    modo = await porte.modalita();
  } catch {
    /* la rete: si prosegue come `codice` */
  }
  try {
    if (modo === "codice" && porte.nelCodice(slug)) return { tipo: "codice" };
    // `cms`, oppure `codice` con un indirizzo che il vecchio catalogo non conosce: un guasto potrebbe aver nascosto la modalità vera
    const r = await porte.scheda(slug, modo === "cms" ? chiave : "");
    if (r.esito === "guasto") return { tipo: "temporaneo" };
    if (modo === "cms" && r.esito === "trovato") return { tipo: "cms", prodotto: r.prodotto };
    return { tipo: "non_trovato" };
  } catch {
    return { tipo: "temporaneo" };
  }
}

/* ── la testata della pagina ── */

type Meta = Record<string, string>;
export interface Testata {
  meta: Meta[];
  links: { rel: string; href: string }[];
  scripts: { type: string; children: string }[];
}

/** `anteprima`: l'indirizzo porta `?anteprima=…`, valida o no: in ogni caso `noindex` e nessun dato strutturato. */
export function testataScheda(p: ProdottoPubblico | null, anteprima: boolean, sito: string): Testata {
  const noindex: Meta[] = anteprima || !p ? [{ name: "robots", content: "noindex" }] : [];
  if (!p) return { meta: [{ title: `Prodotto non trovato | ${MARCHIO}` }, ...noindex], links: [], scripts: [] };
  const indirizzo = `${sito}/shop/prodotto/${p.slug}`;
  const titolo = p.seo.titolo || `${p.nome} | ${MARCHIO}`;
  const descrizione = p.seo.descrizione || p.descrizioneBreve;
  const principale = p.media.find((m) => m.slot === "principale")?.src?.w1600;
  const immagine = [p.seo.immagine, principale].find((u) => typeof u === "string" && u.startsWith("https://"));
  const json = anteprima ? "" : serializzaJsonLd(datiStrutturatiProdotto(p, sito));
  return {
    meta: [
      { title: titolo },
      { name: "description", content: descrizione },
      { property: "og:type", content: "product" },
      { property: "og:title", content: titolo },
      { property: "og:description", content: descrizione },
      { property: "og:url", content: indirizzo },
      ...(immagine ? [{ property: "og:image", content: immagine }] : []),
      ...noindex,
    ],
    links: [{ rel: "canonical", href: indirizzo }],
    // niente tag vuoto: in anteprima (o per un prodotto che il JSON-LD scarta) non c'è
    scripts: json ? [{ type: "application/ld+json", children: json }] : [],
  };
}

/** Le intestazioni della RISPOSTA della scheda (oltre a `no-cache, must-revalidate` della radice, che resta per tutto il resto).
 *  Un guasto (il loader ha lanciato) e l'anteprima non si fermano in nessuna memoria: né del browser né della rete. */
export function intestazioniScheda(s: { anteprima: boolean; errore: boolean }): Record<string, string> {
  if (s.errore) return { "Cache-Control": "no-store" };
  return s.anteprima ? { "Cache-Control": "private, no-store" } : {};
}

/* ── gli eventi ── */

/** Cosa raccontare a Meta, TikTok e Google di una variante: lo SKU della VARIANTE, il nome del prodotto, i centesimi. */
export function datiEventoScheda(p: ProdottoPubblico, skuVariante: string | null, quantita = 1): DatiEvento | null {
  const v = p.varianti.find((x) => x.sku === skuVariante);
  // senza prezzo (D39) non c'è evento: mai un valore 0 o NaN
  if (!v || v.prezzoCent === null || !Number.isInteger(quantita) || quantita < 1) return null;
  return { contentIds: [v.sku], contentName: p.nome, contentType: "product", valueCent: v.prezzoCent * quantita, numItems: quantita };
}

/** Lo stesso per il catalogo `codice`: lo SKU è quello che l'articolo avrà dopo l'importazione (S2), il prezzo quello di oggi. */
export function datiEventoCodice(p: Product, quantita = 1): DatiEvento | null {
  if (!Number.isInteger(quantita) || quantita < 1) return null;
  return { contentIds: [skuDaCodice(p.id)], contentName: p.name, contentType: "product", valueCent: Math.round(p.price * 100) * quantita, numItems: quantita };
}

/** Vero la PRIMA volta che si chiede per questa chiave in questa sessione. Senza archivio (o se non scrive) conta come prima: meglio un evento in più che nessuno. */
export function primaVolta(archivio: Pick<Storage, "getItem" | "setItem"> | null | undefined, chiave: string): boolean {
  try {
    if (archivio?.getItem(chiave)) return false;
    archivio?.setItem(chiave, "1");
  } catch {
    /* archivio chiuso */
  }
  return true;
}

/* ── una regola del titolare ── */

/** Invisible Derm non ha MAI un prezzo nello shop (decisione 20/11): il nome comincia così o l'indirizzo comincia con `invisible-derm` (D40, `pubblico.ts`)
 *  → niente cifra e niente «Aggiungi». */
export const senzaPrezzo = (nome: string | null | undefined, slug?: string | null): boolean => eInvisibleDerm(nome, slug);
