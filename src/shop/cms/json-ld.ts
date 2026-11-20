/** ── DATI STRUTTURATI (JSON-LD) PER GOOGLE ──────────────────────────────────
 *  Commessa 2026-11-20-shop-completo (T07). Modulo PURO: parte da `ProdottoPubblico`, quindi non può contenere
 *  nulla che il pubblico non veda (niente giacenza: solo InStock / OutOfStock).
 *
 *  ⚠️ Si scrive solo ciò che c'è: niente `gtin`, `brand` o `image` vuoti, niente offerta se non c'è una variante in vendita.
 *  ⚠️ Per metterlo nella pagina si usa `serializzaJsonLd` (non `JSON.stringify`): un nome con `</script>` chiuderebbe il tag. */
import type { ProdottoPubblico } from "./modello";

const SCHEMA = "https://schema.org";
const percorso = (slug: string) => `/shop/prodotto/${slug}`;
/** Euro con due decimali, come lo vuole schema.org (28900 centesimi → «289.00»). */
const euro = (cent: number) => (cent / 100).toFixed(2);

/** `null` per un'anteprima (`p.anteprima`): una bozza vista con la chiave non deve mai dire niente a Google. */
export function datiStrutturatiProdotto(p: ProdottoPubblico, sito: string): Record<string, unknown> | null {
  if (p.anteprima) return null;
  const indirizzo = `${sito}${percorso(p.slug)}`;
  const immagini = p.media.flatMap((m) => (m.src?.w1600.startsWith("https://") ? [m.src.w1600] : []));
  return {
    "@context": SCHEMA,
    "@type": "Product",
    name: p.nome,
    sku: p.sku,
    url: indirizzo,
    description: p.descrizioneBreve,
    ...(p.marca ? { brand: { "@type": "Brand", name: p.marca } } : {}),
    ...(p.gtin && /^(\d{8}|\d{12,14})$/.test(p.gtin) ? { gtin: p.gtin } : {}),
    ...(immagini.length ? { image: immagini } : {}),
    ...(p.varianti.length
      ? {
          offers: p.varianti.map((v) => ({
            "@type": "Offer",
            sku: v.sku,
            name: v.nome,
            url: indirizzo,
            price: euro(v.prezzoCent),
            priceCurrency: "EUR",
            availability: `${SCHEMA}/${v.disponibile ? "InStock" : "OutOfStock"}`,
            itemCondition: `${SCHEMA}/NewCondition`,
          })),
        }
      : {}),
  };
}

export function datiStrutturatiLista(prodotti: readonly ProdottoPubblico[], sito: string): Record<string, unknown> {
  return {
    "@context": SCHEMA,
    "@type": "ItemList",
    itemListElement: prodotti.filter((p) => !p.anteprima).map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${sito}${percorso(p.slug)}`, name: p.nome })),
  };
}

/** Il testo da mettere dentro `<script type="application/ld+json">`: `<` diventa `<`, e si rilegge identico.
 *  Per `null` (anteprima) il testo è vuoto: non si scrive nessun tag. */
export const serializzaJsonLd = (dati: unknown): string => !dati ? "" : JSON.stringify(dati).replace(/</g, "\\u003c");
