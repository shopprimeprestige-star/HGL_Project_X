/** ── LE VOCI DI «CURA» E LA CATEGORIA DELLE PATCH (VETRINA V1 · T82a) ──────────────────────────────────────
 *  Funzioni pure, senza schermo: le usano `ShopHeader` e `MenuTelefono` (un file a parte, così i due non si importano a vicenda). */
import { TESTI_SHOP } from "@/landing/testi-shop";
import type { CategoriaPubblica } from "@/shop/cms/modello";

const T = TESTI_SHOP;

/** La categoria delle patch: ha il nome della voce «Patch pronte». Non è mai una voce di «Cura». */
const CATEGORIA_PATCH = T.categorie.find((c) => c.nome === T.header.patch);
const hrefCategoria = (slug: string) => `/shop/c/${slug}`;
/** Lo slug e l'indirizzo di «Patch pronte» (la categoria con quel nome nel documento). */
export const SLUG_PATCH = CATEGORIA_PATCH?.slug ?? "";
export const HREF_PATCH = hrefCategoria(SLUG_PATCH);

export interface VoceCura {
  slug: string;
  nome: string;
  href: string;
}

/** Le voci di «Cura»: le categorie del documento (nel loro ordine, con i loro nomi) che hanno almeno un prodotto pubblicato.
 *  Elenco mancante o rotto (guasto del server) = nessuna voce, e «Cura» non si disegna. */
export function vociCura(categorie: readonly Pick<CategoriaPubblica, "slug" | "quanti">[] | null | undefined): VoceCura[] {
  const conProdotti = new Set<string>();
  for (const c of Array.isArray(categorie) ? (categorie as readonly unknown[]) : []) {
    const { slug, quanti } = (c ?? {}) as { slug?: unknown; quanti?: unknown };
    if (typeof slug === "string" && typeof quanti === "number" && Number.isInteger(quanti) && quanti > 0) conProdotti.add(slug);
  }
  return T.categorie
    .filter((c) => c.slug !== CATEGORIA_PATCH?.slug && conProdotti.has(c.slug))
    .map((c) => ({ slug: c.slug, nome: c.nome, href: hrefCategoria(c.slug) }));
}
