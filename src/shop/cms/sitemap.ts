/** ── LA SITEMAP DELLO SHOP ──────────────────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo (T07). Modulo PURO. Restituisce le voci `{ percorso, aggiornato }` nella forma
 *  `VoceMappa` di `src/seo/regole.ts` (è `sitemapXml` che le trasforma in XML e scarta i doppioni).
 *
 *  ⚠️ Solo i prodotti PUBBLICATI (una bozza o un archiviato non compaiono mai; senza `stato` la riga non si usa), e solo le
 *   categorie `visibile` (scritto `true`) con almeno un prodotto pubblicato (`quanti`, che calcola la vista `shop_v_categorie`).
 *   Righe di forma sbagliata si scartano. Chi la usa passa le righe dei soli prodotti che `costruisciPubblico` mostra davvero. */
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

/** Una voce della mappa del sito, nella forma di `VoceMappa` di `src/seo/regole.ts`. */
export interface VoceMappa {
  percorso: string;
  aggiornato?: string | null;
}
const voci = (x: unknown): VoceMappa[] => (Array.isArray(x) ? x.filter((v): v is VoceMappa => !!v && typeof (v as VoceMappa).percorso === "string") : []);

/**
 * La mappa intera: le pagine fisse, poi il blog, poi lo shop CMS (T22). Ogni fonte sta nel suo `try/catch`: se una non
 * risponde (tabella assente, rete) la mappa esce lo stesso con le altre. Con lo shop `[]` (catalogo `codice`, migrazione
 * assente) il risultato è quello di prima di T22. Chi la chiama passa `fisse` = `PAGINE_PUBBLICHE`.
 */
export async function vociDellaMappa(fonti: {
  fisse: readonly string[];
  blog: () => Promise<unknown>;
  shop: () => Promise<unknown>;
}): Promise<VoceMappa[]> {
  const leggi = async (f: () => Promise<unknown>) => {
    try {
      return voci(await f());
    } catch {
      return [];
    }
  };
  return [...fonti.fisse.map((percorso) => ({ percorso })), ...(await leggi(fonti.blog)), ...(await leggi(fonti.shop))];
}
