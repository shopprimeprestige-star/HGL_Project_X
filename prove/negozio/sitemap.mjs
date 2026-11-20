/** ── NEGOZIO · T22 · LA SITEMAP DEL SITO CON I PRODOTTI PUBBLICATI ──────────
 *  `vociDellaMappa` (in `src/shop/cms/sitemap.ts`) mette insieme le pagine fisse, il blog e lo shop CMS; ogni fonte
 *  sta dentro il suo `try/catch`. La rotta `src/routes/sitemap[.]xml.ts` la usa (se ne controlla il sorgente).
 *  ⚠️ Con il catalogo `codice` o la migrazione assente il file XML deve essere IDENTICO a quello di oggi (byte per byte).
 *  Finto database come per T11; dati inventati. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { negozio, viste } from "./catalogo-server.mjs";

const SITO = "https://sito.prova.test";

export async function prove(mod, { c, gruppo, radice }) {
  const SM = mod["shop/cms/sitemap"];
  const SEO = mod["seo/regole"];
  const CAT = mod["shop/cms/catalogo.server"];
  gruppo("NEGOZIO · LA SITEMAP DEL SITO: BLOG E SHOP CMS (20/11/2026)");

  const blog = [{ percorso: "/blog/primo-articolo", aggiornato: "2026-10-11T10:00:00Z" }, { percorso: "/blog/secondo", aggiornato: null }];
  const xmlDi = (voci) => SEO.sitemapXml(voci, SITO);
  /** La mappa di OGGI (prima di T22): pagine fisse e blog. */
  const oggi = xmlDi([...SEO.PAGINE_PUBBLICHE.map((percorso) => ({ percorso })), ...blog]);
  const mappa = async (fonti) => xmlDi(await SM.vociDellaMappa({ fisse: SEO.PAGINE_PUBBLICHE, blog: async () => blog, shop: async () => [], ...fonti }));
  const catalogo = (modalita, db = {}) => CAT.creaCatalogo({ db: fintoDb({ tabelle: { ...negozio(modalita), ...viste(negozio(modalita)) }, ...db }), adesso: () => Date.parse("2026-11-20T10:00:00Z"), baseMedia: "https://m.prova.test" });

  // ── uguale a oggi quando lo shop CMS non c'è ──
  c("nessuna voce dello shop: la mappa è IDENTICA a quella di oggi (byte per byte)", oggi, await mappa({}));
  c("catalogo `codice`: identica a oggi", oggi, await mappa({ shop: () => catalogo("codice").vociSitemap() }));
  c("migrazione S1 assente (tabelle mancanti): identica a oggi, nessuna eccezione", oggi, await mappa({ shop: () => catalogo("cms", { mancante: true }).vociSitemap() }));
  c("l'interruttore illeggibile (la lettura lancia): identica a oggi", oggi, await mappa({ shop: () => catalogo("cms", { errori: { "shop_impostazioni.select": { lancia: new Error("rete") } } }).vociSitemap() }));
  c("tutte le pagine fisse e gli articoli del blog di oggi ci sono ancora, nell'ordine di prima", true, [...SEO.PAGINE_PUBBLICHE, ...blog.map((b) => b.percorso)].every((p) => (oggi.match(new RegExp(`<loc>${SITO}${p}</loc>`)) ?? []).length === 1));

  // ── con il catalogo CMS ──
  const cms = await mappa({ shop: () => catalogo("cms").vociSitemap() });
  const locs = [...cms.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(SITO, ""));
  c("catalogo `cms`: restano tutte le voci di oggi e si aggiungono i prodotti pubblicati e la categoria con prodotti", [...[...oggi.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(SITO, "")), "/shop/prodotto/prodotto-di-prova", "/shop/prodotto/altro-prodotto", "/shop/c/categoria-prova"], locs);
  c("mai una bozza, un archiviato, una categoria vuota o nascosta", false, /prodotto-in-bozza|archiviato|categoria-vuota|categoria-nascosta/.test(cms));
  c("la data di aggiornamento del prodotto viaggia come `lastmod` (solo il giorno)", true, /<loc>[^<]*prodotto-di-prova<\/loc><lastmod>2026-11-20<\/lastmod>/.test(cms));
  c("le pagine fisse non si ripetono (`/shop` c'è una volta sola)", 1, (cms.match(new RegExp(`<loc>${SITO}/shop</loc>`, "g")) ?? []).length);

  // ── i guasti di una fonte non toccano le altre ──
  const rotta = async () => { throw new Error("guasto"); };
  c("la lettura dello shop fallisce: il blog e le pagine fisse escono lo stesso (identica a oggi)", oggi, await mappa({ shop: rotta }));
  c("il blog fallisce: le pagine fisse e lo shop escono lo stesso", [true, false], await (async () => {
    const x = await mappa({ blog: rotta, shop: () => catalogo("cms").vociSitemap() });
    return [x.includes("/shop/prodotto/prodotto-di-prova") && x.includes("<loc>" + SITO + "/blog</loc>"), x.includes("primo-articolo")];
  })());
  c("il blog legge bene e lo shop lancia: il blog esce (la lettura del CMS non lo ferma)", true, (await mappa({ shop: rotta })).includes("/blog/primo-articolo"));
  c("tutte e due falliscono: solo le pagine fisse", xmlDi(SEO.PAGINE_PUBBLICHE.map((percorso) => ({ percorso }))), await mappa({ blog: rotta, shop: rotta }));
  c("una fonte che risponde cose strane (non elenchi) non rompe la mappa", oggi, await mappa({ blog: async () => blog, shop: async () => "boh" }));

  // ── la rotta ──
  const rotta_ = readFileSync(join(radice, "src/routes/sitemap[.]xml.ts"), "utf8");
  const codice = rotta_.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  c("la rotta usa `vociDellaMappa` e conserva il blog, le pagine fisse e la memoria di un'ora", [true, true, true, true], [/vociDellaMappa\(/.test(codice), /blog_articoli/.test(codice), /fisse: PAGINE_PUBBLICHE,/.test(codice), /"Cache-Control": "public, max-age=3600"/.test(codice)]);
  c("lo shop arriva dalle letture pubbliche (`vociSitemap`), e la rotta non nomina nessuna tabella dello shop", [true, []], [/catalogoPubblico\(\)[\s\S]{0,60}\.vociSitemap\(\)/.test(codice), codice.match(/\bshop_[a-z_]+/g) ?? []]);
}
