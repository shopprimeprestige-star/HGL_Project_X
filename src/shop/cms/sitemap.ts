/** ── LA SITEMAP DELLO SHOP ──────────────────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo (T07). Modulo PURO. Restituisce le voci `{ percorso, aggiornato }` nella forma
 *  `VoceMappa` di `src/seo/regole.ts` (è `sitemapXml` che le trasforma in XML e scarta i doppioni).
 *
 *  ⚠️ Solo i prodotti PUBBLICATI (una bozza o un archiviato non compaiono mai; se la vista non porta `stato`, vale «pubblicato»), e solo le categorie visibili con almeno
 *   un prodotto pubblicato (`quanti`, che calcola la vista `shop_v_categorie`). Righe di forma sbagliata si scartano. */
import { categoriaDaRiga, oggetto, prodottoDaRiga, righeDi } from "./righe";

export interface VoceShop {
  percorso: string;
  aggiornato: string | null;
}

export function vociSitemapShop(dati: unknown): VoceShop[] {
  const d = oggetto(dati) ?? {};
  const prodotti = righeDi(d.prodotti).flatMap((riga) => {
    const p = prodottoDaRiga(riga);
    return p?.stato === "pubblicato" ? [{ percorso: `/shop/prodotto/${p.slug}`, aggiornato: p.aggiornatoIl || null }] : [];
  });
  const categorie = righeDi(d.categorie).flatMap((riga) => {
    const c = categoriaDaRiga(riga);
    return c?.visibile && typeof riga.quanti === "number" && riga.quanti > 0 ? [{ percorso: `/shop/c/${c.slug}`, aggiornato: null }] : [];
  });
  return [...prodotti, ...categorie];
}
