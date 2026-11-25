/** ── L'ADATTATORE: DAL CATALOGO CMS ALLA FORMA CHE LE PAGINE DI OGGI CAPISCONO ─
 *  Commessa 2026-11-20-shop-completo (T12). Modulo PURO. In R1 le pagine `/shop` restano quelle di oggi (la vetrina nuova
 *  è del Rilascio V): con il catalogo CMS ricevono un `Product` ricavato da `ProdottoPubblico`.
 *
 *  ⚠️ Niente di inventato: stelle e recensioni a 0, nessun prezzo barrato, nessun badge. `stock` NON è la giacenza: dice
 *   solo «c'è» (1) o «non c'è» (0). */
import { CATEGORIES, type CategoryKey, type Product } from "../catalog";
import type { ProdottoPubblico } from "./modello";

const CHIAVI_CATEGORIA: readonly string[] = CATEGORIES.map((c) => c.key);
const CATEGORIA_PER_TIPO: Record<ProdottoPubblico["tipo"], CategoryKey> = { patch: "toupee", kit: "kit", cura: "accessori" };

/** Lo SKU di un articolo del vecchio catalogo (S2): `t01` → `HG-T01`. */
export const skuDaCodice = (id: string): string => `HG-${id.toUpperCase()}`;

/** La prima categoria del CMS che coincide con una delle nove di oggi; se nessuna, quella del tipo. */
const categoriaDi = (p: ProdottoPubblico): CategoryKey =>
  (p.categorie.find((c) => CHIAVI_CATEGORIA.includes(c.slug))?.slug as CategoryKey | undefined) ?? CATEGORIA_PER_TIPO[p.tipo];

export function daPubblicoAProdotto(p: ProdottoPubblico): Product {
  const immagine = p.media.find((m) => m.slot === "principale")?.src?.w960;
  return {
    id: p.sku,
    slug: p.slug,
    name: p.nome,
    category: categoriaDi(p),
    price: (p.prezzoDaCent ?? 0) / 100, // D39: Invisible Derm non ha prezzo (0, e `stock` 0: non si compra)
    short: p.descrizioneBreve,
    description: p.descrizioneLunga ?? p.descrizioneBreve,
    bullets: p.confezione,
    tone: "brand",
    icon: "Package",
    variants: p.opzioni.map((o) => ({ label: o.nome, options: o.valori.map((v) => v.valore) })),
    rating: 0,
    reviews: 0,
    stock: p.varianti.some((v) => v.disponibile) ? 1 : 0,
    ...(immagine ? { image: immagine } : {}),
    specs: p.caratteristiche.map((c) => ({ label: c.etichetta, value: c.valore })),
  };
}

/** Lo SKU della variante che ha ESATTAMENTE queste opzioni (stesse chiavi, stessi valori, in qualunque ordine), o `null`. */
export function varianteDaOpzioni(p: ProdottoPubblico, opzioni: Record<string, string>): string | null {
  const scelte = Object.entries(opzioni ?? {});
  return (
    p.varianti.find((v) => {
      const sue = Object.entries(v.opzioni);
      return sue.length === scelte.length && sue.every(([k, val]) => opzioni[k] === val);
    })?.sku ?? null
  );
}
