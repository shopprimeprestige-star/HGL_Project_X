/** ── SHOP R1 · T19 · ELENCO, CATEGORIA E RICERCA DELLO SHOP ──────────────────────────
 *  `src/routes/shop.index.tsx`, `src/routes/shop.c.$slug.tsx`, `src/shop/cms/GrigliaProdotti.tsx`, `src/shop/cms/elenco.ts`.
 *  Quattro livelli, senza browser:
 *   1. le funzioni PURE di `elenco.ts` (testo da cercare, pausa della ricerca, una sola volta per visita, Invisible Derm);
 *   2. con il catalogo `codice` la pagina è IDENTICA a oggi: stessa impronta del markup (ricavata dal codice di PRIMA di
 *      T19), 33 schede nell'ordine di `PRODUCTS`, stelle e recensioni come sempre (D29);
 *   3. con il catalogo `cms` il MARKUP RESO (non solo i dati): niente stelle, recensioni, badge, prezzo barrato, niente
 *      «4.8/5 · 1.500+ clienti», niente soglia dei 59 €; Invisible Derm sempre senza prezzo; esaurito, «Scegli»/«Aggiungi»;
 *   4. la categoria: il caricamento (non trovata → /shop, codice → 404), l'intestazione, i dati strutturati.
 *  Il sorgente conferma ciò che il rendering non vede (gli effetti: gli eventi). Dati inventati. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { impacchettaPagina, impostaPagina, testoVisibile } from "./_pagine.mjs";
import { categoriaProva, mediaProva, prodottoProva, uuid, varianteProva } from "./dati.mjs";

/** L'impronta (sha256) del markup di `/shop` con il catalogo del codice PRIMA di T19 (commit 69a7c4d), con le immagini
 *  incorporate sostituite da DATA e senza l'`aria-label` che T19 aggiunge al campo di ricerca (invisibile). */
const IMPRONTA_DI_OGGI = "0f5f475bb6ad0d565844020fccbe0b66d32fcc19c2ea03cbd9cca6c98e73b799";

/** Un catalogo CMS inventato, nella forma delle VISTE (`categorie` dentro la riga del prodotto). */
function catalogoProva(PUB) {
  const cat = (slug, nome) => ({ slug, nome });
  const P = (n, extra) => prodottoProva({ id: uuid(0x1000 + n), ...extra });
  const V = (n, extra) => varianteProva({ id: uuid(0x2000 + n), ...extra });
  const prodotti = [
    P(1, { sku: "PROVA-SH", slug: "shampoo-di-prova", nome: "Shampoo di prova", tipo: "cura", prezzo_cent: 1890, descrizione_breve: "Lava con delicatezza.", categorie: [cat("shampoo-e-balsami", "Shampoo e balsami")] }),
    P(2, { sku: "PROVA-PA", slug: "patch-di-prova", nome: "Patch di prova", tipo: "patch", prezzo_cent: 12000, descrizione_breve: "Una patch pronta.", categorie: [cat("patch-pronte", "Patch pronte")] }),
    P(3, { sku: "PROVA-CO", slug: "colla-di-prova", nome: "Colla di prova", tipo: "cura", prezzo_cent: 2400, descrizione_breve: "Tiene la patch.", categorie: [cat("colle-e-remover", "Colle e remover")] }),
    P(4, { sku: "PROVA-ID", slug: "invisible-derm-protocol", nome: "Invisible Derm Protocol®", tipo: "patch", prezzo_cent: 390000, descrizione_breve: "Su misura.", categorie: [cat("patch-pronte", "Patch pronte")] }),
    P(5, { sku: "PROVA-KI", slug: "kit-di-prova", nome: "Kit di prova", tipo: "kit", prezzo_cent: 4500, descrizione_breve: "Più prodotti insieme.", categorie: [cat("shampoo-e-balsami", "Shampoo e balsami")] }),
  ];
  const varianti = [
    V(1, { prodotto_id: prodotti[0].id, sku: "PROVA-SH-A", nome: "Unica", opzioni: {}, giacenza: 9 }),
    V(2, { prodotto_id: prodotti[1].id, sku: "PROVA-PA-NE", nome: "Nero", opzioni: { Colore: "Nero" }, giacenza: 3, ordine: 1 }),
    V(3, { prodotto_id: prodotti[1].id, sku: "PROVA-PA-CA", nome: "Castano", opzioni: { Colore: "Castano" }, prezzo_cent: 13500, giacenza: 2, ordine: 2 }),
    V(4, { prodotto_id: prodotti[2].id, sku: "PROVA-CO-A", nome: "Unica", opzioni: {}, giacenza: 0 }),
    V(5, { prodotto_id: prodotti[3].id, sku: "PROVA-ID-A", nome: "Unica", opzioni: {}, giacenza: 4 }),
    V(6, { prodotto_id: prodotti[4].id, sku: "PROVA-KI-A", nome: "Unica", opzioni: {}, giacenza: 7 }),
  ];
  const media = prodotti.map((p, i) => mediaProva({ id: uuid(0x3000 + i), prodotto_id: p.id, slot: "principale", path_480: `prova/p${i}-480.webp`, path_960: `prova/p${i}-960.webp`, path_1600: `prova/p${i}-1600.webp`, alt: `Foto ${p.nome}` }));
  return PUB.costruisciPubblico({ prodotti, varianti, media }, { baseMedia: "https://media.prova.test/shop" });
}
const categorieProva = [
  { slug: "patch-pronte", nome: "Patch pronte", tipo: "categoria", frase: "Per chi ha già deciso.", foto: null, seo: { titolo: "Patch pronte, scegli colore e misura", descrizione: "Patch pronte da uno studio di Roma." }, ordine: 1, quanti: 2 },
  { slug: "shampoo-e-balsami", nome: "Shampoo e balsami", tipo: "categoria", frase: null, foto: null, seo: { titolo: null, descrizione: null }, ordine: 2, quanti: 2 },
  { slug: "colle-e-remover", nome: "Colle e remover", tipo: "categoria", frase: "Per fissare e togliere.", foto: null, seo: { titolo: null, descrizione: null }, ordine: 3, quanti: 1 },
];

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("SHOP R1 · T19 · ELENCO, CATEGORIA E RICERCA DELLO SHOP (20/11/2026)");
  const leggi = (f) => (existsSync(join(radice, f)) ? readFileSync(join(radice, f), "utf8") : "");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const F = { indice: "src/routes/shop.index.tsx", categoria: "src/routes/shop.c.$slug.tsx", griglia: "src/shop/cms/GrigliaProdotti.tsx", elenco: "src/shop/cms/elenco.ts" };
  const src = Object.fromEntries(Object.entries(F).map(([k, f]) => [k, senzaCommenti(leggi(f))]));
  const E = mod["shop/cms/elenco"];
  const PUB = mod["shop/cms/pubblico"];

  /* ───────────────── 1 · LE FUNZIONI PURE ───────────────── */
  c("`elenco.ts` c'è e dà le funzioni che servono", ["function", "function", "function", "function", "function", "function"],
    ["testoDaCercare", "eInvisibleDerm", "datiListaVisualizzata", "emettiUnaVolta", "creaEmettitoreRicerca", "frasaSenzaRisultati"].map((n) => typeof E?.[n]));
  if (E?.testoDaCercare) {
    c("ricerca: il testo si ripulisce (spazi ai bordi e doppi) e basta", ["colla forte", "colla", "HG-T01"], [E.testoDaCercare("  colla   forte "), E.testoDaCercare("colla"), E.testoDaCercare("HG-T01")]);
    c("ricerca: vuoto, una lettera sola, non testo → niente evento", [null, null, null, null, null, null], ["", "   ", "a", undefined, 42, null].map((x) => E.testoDaCercare(x)));
    c("ricerca: un'email o un telefono NON escono verso le piattaforme (chiocciola, sei cifre o più, anche con spazi e trattini)", [null, null, null, null, null],
      ["mario@esempio.it", "3331234567", "333 123 4567", "06-1234-5678", "ordine 123456"].map((x) => E.testoDaCercare(x)));
    c("ricerca: poche cifre vanno bene (un codice come «HG-T01», «1B», «30 cm»)", ["1B", "colore 1B", "30 cm", "ordine 12345"], ["1B", "colore 1B", "30 cm", "ordine 12345"].map((x) => E.testoDaCercare(x)));
    c("ricerca: oltre 80 segni si taglia a 80", 80, E.testoDaCercare("x".repeat(200))?.length);
  }
  if (E?.creaEmettitoreRicerca) {
    // un orologio finto: nessuna attesa vera
    const orologio = () => { const t = { n: 0, vivi: new Map() }; return { set: (f, ms) => { const id = ++t.n; t.vivi.set(id, { f, ms }); return id; }, clear: (id) => void t.vivi.delete(id), passa: () => { for (const [id, v] of [...t.vivi]) { t.vivi.delete(id); v.f(); } }, ultimaPausa: () => [...t.vivi.values()].at(-1)?.ms, t }; };
    const o1 = orologio();
    const inviati = [];
    const r = E.creaEmettitoreRicerca((t) => inviati.push(t), { set: o1.set, clear: o1.clear });
    r.scrivi("c"); r.scrivi("co"); r.scrivi("col"); r.scrivi("colla");
    c("ricerca: scrivendo, non parte niente finché non si fa una pausa", 0, inviati.length);
    c("ricerca: la pausa è di 1 secondo", 1000, o1.ultimaPausa());
    o1.passa();
    c("ricerca: dopo la pausa parte UN evento solo, con il testo intero", ["colla"], inviati);
    r.scrivi("colla"); o1.passa();
    c("ricerca: lo stesso testo di prima non si ripete", ["colla"], inviati);
    r.scrivi("shampoo"); r.invio("shampoo"); o1.passa();
    c("ricerca: Invio manda subito e cancella l'attesa (nessun doppione dopo la pausa)", ["colla", "shampoo"], inviati);
    r.scrivi("mario@esempio.it"); r.invio("mario@esempio.it"); o1.passa();
    c("ricerca: un testo con dati personali non parte, né con la pausa né con Invio", ["colla", "shampoo"], inviati);
    r.scrivi("remover"); r.ferma(); o1.passa();
    c("ricerca: se la pagina si chiude (`ferma`) l'attesa non parte", ["colla", "shampoo"], inviati);
    c("ricerca: un'emissione che lancia non rompe la pagina", "ok", (() => { const r2 = E.creaEmettitoreRicerca(() => { throw new Error("x"); }, { set: o1.set, clear: o1.clear }); try { r2.invio("colla"); return "ok"; } catch { return "lancia"; } })());
  }
  if (E?.emettiUnaVolta) {
    const archivio = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), m }; };
    const a = archivio();
    let n = 0;
    const emetti = () => { n++; return "id-1"; };
    E.emettiUnaVolta(a, "tutti", emetti); E.emettiUnaVolta(a, "tutti", emetti);
    c("lista vista: una volta per visita e per lista (la seconda volta non emette)", 1, n);
    E.emettiUnaVolta(a, "patch-pronte", emetti);
    c("lista vista: un'altra lista è un'altra visita", 2, n);
    const b = archivio(); let m2 = 0;
    E.emettiUnaVolta(b, "tutti", () => { m2++; return null; }); E.emettiUnaVolta(b, "tutti", () => { m2++; return null; });
    c("lista vista: se l'evento non è partito (niente consenso) non si segna: riprova alla visita dopo", 2, m2);
    c("lista vista: archivio che lancia, o assente, non rompe niente e l'evento parte lo stesso", [1, 1], [(() => { let k = 0; E.emettiUnaVolta({ getItem: () => { throw new Error("no"); }, setItem: () => { throw new Error("no"); } }, "x", () => (k++, "id")); return k; })(), (() => { let k = 0; E.emettiUnaVolta(null, "x", () => (k++, "id")); return k; })()]);
  }
  if (E?.eInvisibleDerm) {
    c("Invisible Derm si riconosce dal nome (anche «Protocol®», maiuscole, spazi doppi); «Silk Top Invisible Knots» no", [true, true, true, false, false, false],
      ["Invisible Derm Protocol®", "INVISIBLE DERM", "invisible   derm", "Silk Top Invisible Knots", "Derm", ""].map((x) => E.eInvisibleDerm(x)));
  }
  if (E?.frasaSenzaRisultati) {
    c("nessun risultato: con il codice la frase di oggi, con il CMS quella del Copywriter (3.13)", ["Nessun prodotto trovato per «tape».", "Non troviamo “tape”. Prova con un'altra parola, o chiedici aiuto."], [E.frasaSenzaRisultati("tape", false), E.frasaSenzaRisultati("tape", true)]);
  }

  /* ───────────────── 2 · IL SORGENTE ───────────────── */
  c("i quattro file ci sono", [true, true, true, true], Object.values(F).map((f) => existsSync(join(radice, f))));
  const tutto = Object.values(src).join("\n");
  c("le stelle e «N recensioni» stanno dietro la guardia `reviews > 0` (la scheda di oggi non ne ha più)", true, /reviews\s*>\s*0/.test(src.griglia));
  c("`ViewContent` della lista passa da `emettiEvento` con `datiListaVisualizzata` (product_group), dentro `useListaVista`, usato da entrambe le pagine", [true, true, true], [/emettiEvento\(\s*"ViewContent"/.test(src.griglia) && /datiListaVisualizzata/.test(src.griglia), /useListaVista\(/.test(src.indice), /useListaVista\(/.test(src.categoria)]);
  c("`Search` passa da `emettiEvento` con il SOLO `searchString`, e parte da `creaEmettitoreRicerca` (pausa o Invio)", [true, true, false], [/emettiEvento\(\s*"Search"\s*,\s*\{\s*searchString:\s*\w+\s*\}\s*\)/.test(src.indice), /creaEmettitoreRicerca/.test(src.indice), /emettiEvento\(\s*"Search"[^)]*(contentIds|categoria|valueCent)/.test(src.indice)]);
  c("il testo cercato NON entra nell'indirizzo: la pagina non ha `validateSearch`, `useSearch`, né `search:`", false, /validateSearch|useSearch|search\s*:|history\.|replaceState|pushState/.test(src.indice));
  c("nessun nome di tabella e nessun client del database nelle pagine (solo le funzioni del server)", false, /\bshop_[a-z_]+|supabase|catalogo\.server/.test(tutto));
  c("nessuna riga con l'indirizzo dello studio", false, /Scipioni|\bVia degli\b/i.test(leggi(F.indice) + leggi(F.categoria) + leggi(F.griglia)));
  c("le pagine non importano il carattere nuovo (D29): niente `lib/carattere`, niente Inter", false, /lib\/carattere|\bInter\b/.test(tutto));
  c("l'elenco legge la modalità dal contesto del guscio (`useRouteContext`), non la rilegge (`modalitaCatalogo`)", [true, false], [/useRouteContext\(\)/.test(src.indice), /modalitaCatalogo/.test(src.indice + src.categoria + src.griglia)]);
  c("la categoria: codice → `notFound()`; CMS senza categoria o senza prodotti → `redirect` a /shop", [true, true], [/notFound\(\)/.test(src.categoria), /redirect\(\{\s*to:\s*"\/shop"/.test(src.categoria)]);

  /* ───────────────── 3 · IL MARKUP: CODICE E CMS ───────────────── */
  let M = null;
  try {
    M = await impacchettaPagina(
      radice,
      `import { renderToStaticMarkup } from "react-dom/server";
       import { createElement } from "react";
       import { CartProvider } from "@/shop/CartContext";
       export { Route as Indice } from "@/routes/shop.index";
       export { Route as Categoria } from "@/routes/shop.c.$slug";
       export { PRODUCTS } from "@/shop/catalog";
       export const disegna = (C) => renderToStaticMarkup(createElement(CartProvider, null, createElement(C)));`,
      "shop-elenco",
    );
  } catch (e) {
    console.log("   (le pagine non si impacchettano:", String(e?.message ?? e).split("\n")[0], ")");
  }
  c("la pagina dell'elenco e quella della categoria si impacchettano", [true, true], [typeof M?.Indice?.options?.component === "function", typeof M?.Categoria?.options?.component === "function"]);
  if (typeof M?.Indice?.options?.component !== "function") return;
  const norm = (h) => h.replace(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g, "DATA");
  const schede = (h) => [...h.matchAll(/<div class="group relative flex flex-col[\s\S]*?(?=<div class="group relative flex flex-col|<\/section><\/div>$)/g)].map((m) => m[0]);

  /* ── codice: identico a oggi ── */
  impostaPagina({ pathname: "/shop", searchStr: "", context: { modalita: "codice" }, loaderData: null });
  const hCodice = norm(M.disegna(M.Indice.options.component));
  c("codice: il markup di /shop è IDENTICO a oggi (impronta sha256; unica differenza ammessa: l'`aria-label` del campo di ricerca)", IMPRONTA_DI_OGGI, createHash("sha256").update(hCodice.replace(' aria-label="Cerca nel negozio"', "")).digest("hex"));
  c("codice: il campo di ricerca ha un nome per chi usa il lettore di schermo", true, /<input[^>]*aria-label="Cerca nel negozio"/.test(hCodice));
  const nomiOggi = [...hCodice.matchAll(/class="line-clamp-1 font-semibold text-white transition hover:text-brand">([^<]*)</g)].map((m) => m[1].replace(/&#x27;/g, "'").replace(/&amp;/g, "&"));
  c("codice: 33 schede, nell'ordine di `PRODUCTS`", [33, M.PRODUCTS.map((p) => p.name)], [nomiOggi.length, nomiOggi]);
  c("codice: le stelle e «N recensioni» ci sono su ogni scheda (33), come oggi", [33, true], [(hCodice.match(/ recensioni</g) ?? []).length, /4\.8\/5 · 1\.500\+ clienti/.test(testoVisibile(hCodice).replace(/&gt;/g, ">"))]);
  c("codice: la riga «Spedizione gratis > €59» del titolo c'è, come oggi", true, /Spedizione gratis > €59/.test(testoVisibile(hCodice)));

  /* ── cms ── */
  const PUBBLICI = catalogoProva(PUB);
  c("(prova stessa) il catalogo inventato dà 5 prodotti pubblici", 5, PUBBLICI.length);
  impostaPagina({ pathname: "/shop", searchStr: "", context: { modalita: "cms" }, loaderData: { prodotti: PUBBLICI, categorie: categorieProva } });
  const hCms = norm(M.disegna(M.Indice.options.component));
  const tCms = testoVisibile(hCms);
  const cardCms = schede(hCms);
  c("cms: 5 schede, una per prodotto pubblico, nell'ordine ricevuto", [5, ["Shampoo di prova", "Patch di prova", "Colla di prova", "Invisible Derm Protocol®", "Kit di prova"]],
    [cardCms.length, [...hCms.matchAll(/class="line-clamp-1 font-semibold text-white transition hover:text-brand">([^<]*)</g)].map((m) => m[1].replace(/&amp;/g, "&").replace(/&#x27;/g, "'"))]);
  c("cms: NIENTE stelle (nessuna icona stella), NIENTE «recensioni», nessun voto in nessuna parte della pagina", [0, false, false, false],
    [(hCms.match(/lucide-star/g) ?? []).length, /recension/i.test(tCms), /\b4[.,]8\b|1\.500|clienti/i.test(tCms), /text-amber-300/.test(hCms)]);
  c("cms: niente prezzo barrato, niente badge, niente «sconto», «risparmi», «ultimi»", [false, false, false],
    [/line-through|<del|<s>/.test(hCms), /border-brand\/40|rounded-full border border-brand/.test(hCms), /sconto|risparmi|ultimi|best seller|top rated/i.test(tCms)]);
  c("cms: niente soglia di spedizione gratuita (la cifra non è più vera) né il «Remy» non provato", [false, false], [/59|Spedizione gratis/i.test(tCms), /Remy/.test(tCms)]);
  c("cms: nessun indirizzo dello studio", false, /Scipioni|Via degli/i.test(tCms));
  const [cShampoo, cPatch, cColla, cDerm, cKit] = cardCms;
  const prezzo = (h) => (testoVisibile(h).match(/€\s?[\d.]+,\d{2}|[\d.]+,\d{2}\s?€/g) ?? []);
  c("cms: i prezzi sono quelli del server (centesimi → euro), con «Da» se le varianti costano diverso", [["18,90"], true, ["24,00"], ["45,00"]],
    [prezzo(cShampoo).map((x) => x.replace(/[^\d,]/g, "")), /Da\s/.test(testoVisibile(cPatch)) && /120,00/.test(testoVisibile(cPatch)), prezzo(cColla).map((x) => x.replace(/[^\d,]/g, "")), prezzo(cKit).map((x) => x.replace(/[^\d,]/g, ""))]);
  c("cms: Invisible Derm SENZA prezzo: nessuna cifra, nessun «€», nessun «Aggiungi»; c'è la frase «Il costo lo vedi in consulenza.» e il link alla scheda", [[], false, false, true, true],
    [prezzo(cDerm), /€/.test(cDerm), /Aggiungi/.test(cDerm), /Il costo lo vedi in consulenza\./.test(testoVisibile(cDerm)), /href="\/shop\/prodotto\/invisible-derm-protocol"/.test(cDerm)]);
  c("cms: Invisible Derm non lascia cifre da nessuna parte nel suo pezzo di pagina (nemmeno 3.900, 3900, 390000)", false, /3[.]?900|390000/.test(cDerm));
  c("cms: un solo prodotto, una sola variante, disponibile → «Aggiungi»; con opzioni → «Scegli» (link alla scheda); esaurito → «Esaurito» e nessun bottone", [true, true, true, false],
    [/<button[^>]*>[\s\S]*?Aggiungi/.test(cShampoo) && !/Scegli/.test(cShampoo), /Scegli/.test(cPatch) && !/<button/.test(cPatch), /Esaurito/.test(cColla) && !/<button/.test(cColla) && !/Aggiungi/.test(cColla), /Esaurito/.test(cKit)]);
  c("cms: le foto sono quelle del server (misura 960) con il testo alternativo", [true, true], [/src="https:\/\/media\.prova\.test\/shop\/prova\/p0-960\.webp"/.test(cShampoo), /alt="Shampoo di prova"/.test(cShampoo)]);
  c("cms: i nomi delle categorie sono link a /shop/c/<slug> (non pulsanti che cambiano lo stato)", [true, true, true], ["patch-pronte", "shampoo-e-balsami", "colle-e-remover"].map((s) => new RegExp(`<a [^>]*href="/shop/c/${s}"`).test(hCms)));
  c("cms: «Tutti» è la voce attiva e le altre no (come i pulsanti di oggi)", true, /bg-brand text-white[^>]*>\s*Tutti|>Tutti<\/a>/.test(hCms) && /Patch pronte/.test(tCms));
  c("cms: il conteggio dice quanti articoli (5)", true, /5 articoli/.test(tCms));
  c("cms: vetrina vuota (guasto o niente da mostrare) → una frase onesta, non una pagina rotta", [true, false], (() => {
    impostaPagina({ pathname: "/shop", searchStr: "", context: { modalita: "cms" }, loaderData: { prodotti: [], categorie: [] } });
    const t = testoVisibile(M.disegna(M.Indice.options.component));
    return [/Nessun prodotto disponibile/.test(t), /undefined|NaN|\[object/.test(t)];
  })());
  c("cms: loaderData assente (non è mai atteso) non rompe la pagina", "ok", (() => { try { impostaPagina({ pathname: "/shop", searchStr: "", context: { modalita: "cms" }, loaderData: undefined }); M.disegna(M.Indice.options.component); return "ok"; } catch (e) { return String(e).slice(0, 80); } })());

  /* ── il caricamento dell'elenco ── */
  const caric = M.Indice.options.loader;
  c("l'elenco ha un `loader` (il testo dei prodotti si legge già nell'HTML del server)", "function", typeof caric);
  if (typeof caric === "function") {
    impostaPagina({ server: { elenco: () => PUBBLICI, categorie: categorieProva } });
    const dalCodice = await caric({ context: { modalita: "codice" } });
    const dalCms = await caric({ context: { modalita: "cms" } });
    c("loader: con il codice non chiede niente al server (null); con il CMS dà prodotti e categorie", [null, 5, 3], [dalCodice, dalCms?.prodotti?.length, dalCms?.categorie?.length]);
    impostaPagina({ server: { elenco: () => { throw new Error("giù"); }, categorie: [] } });
    c("loader: se il server non risponde l'elenco è vuoto, mai un errore", [0, 0], await caric({ context: { modalita: "cms" } }).then((r) => [r.prodotti.length, r.categorie.length]).catch(() => ["lancia", "lancia"]));
  }

  /* ───────────────── 4 · LA CATEGORIA ───────────────── */
  const K = M.Categoria;
  const ctx = (modalita) => ({ modalita });
  const dati = (slug) => ({ elenco: ({ categoria }) => PUBBLICI.filter((p) => p.categorie.some((x) => x.slug === categoria)), categorie: categorieProva });
  impostaPagina({ server: dati() });
  const carica = (slug, modalita = "cms") => Promise.resolve(K.options.loader({ params: { slug }, context: ctx(modalita) })).then((r) => ({ r }), (e) => ({ e }));
  const ok = await carica("patch-pronte");
  c("categoria: esiste, visibile, con prodotti → dati con la categoria e i suoi 2 prodotti", [true, 2, "Patch pronte"], [!!ok.r, ok.r?.prodotti?.length, ok.r?.categoria?.nome]);
  c("categoria: con il catalogo del codice la pagina non esiste (404 come oggi): `notFound`", true, (await carica("patch-pronte", "codice")).e?.__notFound === true);
  c("categoria: che non esiste → rimanda a /shop", "/shop", (await carica("non-esiste")).e?.__redirect?.to);
  impostaPagina({ server: { elenco: () => [], categorie: categorieProva } });
  c("categoria: esiste ma senza prodotti pubblicati (o guasto) → rimanda a /shop", "/shop", (await carica("patch-pronte")).e?.__redirect?.to);
  impostaPagina({ server: { elenco: () => { throw new Error("giù"); }, categorie: () => { throw new Error("giù"); } } });
  c("categoria: se il server non risponde non è un errore al pubblico: rimanda a /shop", "/shop", (await carica("patch-pronte")).e?.__redirect?.to);
  impostaPagina({ server: dati() });

  const caricati = (await carica("patch-pronte")).r;
  const testa = K.options.head?.({ loaderData: caricati, params: { slug: "patch-pronte" } });
  const meta = (n) => testa?.meta?.find((m) => m.name === n || m.property === n)?.content;
  c("categoria: titolo e descrizione della pagina sono quelli SEO della categoria (e il nome del sito)", [true, "Patch pronte da uno studio di Roma."], [/^Patch pronte, scegli colore e misura \| /.test(testa?.meta?.find((m) => m.title)?.title ?? ""), meta("description")]);
  c("categoria: indirizzo canonico /shop/c/<slug> sul dominio del sito", true, /^https:\/\/[^/]+\/shop\/c\/patch-pronte$/.test(testa?.links?.find((l) => l.rel === "canonical")?.href ?? ""));
  c("categoria: i dati strutturati sono un'ItemList con i prodotti, scritti senza `<` (non chiudono il tag)", [true, false], (() => { const t = testa?.scripts?.[0]?.children ?? ""; return [/"ItemList"/.test(t) && /patch-di-prova/.test(t), /</.test(t)]; })());
  const sc = (await carica("shampoo-e-balsami")).r;
  const testa2 = K.options.head?.({ loaderData: sc, params: { slug: "shampoo-e-balsami" } });
  c("categoria: senza testi SEO il titolo è il nome della categoria", true, /^Shampoo e balsami \| /.test(testa2?.meta?.find((m) => m.title)?.title ?? ""));

  impostaPagina({ pathname: "/shop/c/patch-pronte", searchStr: "", params: { slug: "patch-pronte" }, context: ctx("cms"), loaderData: caricati });
  const hCat = norm(M.disegna(K.options.component));
  const tCat = testoVisibile(hCat);
  c("categoria: un solo titolo (h1) col nome della categoria, e la sua frase", [1, true, true], [(hCat.match(/<h1\b/g) ?? []).length, /<h1[^>]*>Patch pronte<\/h1>/.test(hCat), tCat.includes("Per chi ha già deciso.")]);
  c("categoria: mostra SOLO i prodotti della categoria (Patch di prova e Invisible Derm), nell'ordine ricevuto", ["Patch di prova", "Invisible Derm Protocol®"], [...hCat.matchAll(/class="line-clamp-1 font-semibold text-white transition hover:text-brand">([^<]*)</g)].map((m) => m[1].replace(/&amp;/g, "&")));
  c("categoria: niente stelle, recensioni, badge, barrato; Invisible Derm senza prezzo", [0, false, false, false, []],
    [(hCat.match(/lucide-star/g) ?? []).length, /recension/i.test(tCat), /line-through/.test(hCat), /border-brand\/40/.test(hCat), prezzo(schede(hCat)[1] ?? "")]);
  c("categoria: un sentiero per tornare (Shop › nome) e le altre categorie come link; quella aperta è evidenziata", [true, true, true], [/href="\/shop"[^>]*>Shop<\/a>/.test(hCat), /href="\/shop\/c\/colle-e-remover"/.test(hCat), /<a [^>]*aria-current="page"[^>]*>Patch pronte<\/a>/.test(hCat)]);
  c("categoria: nessun indirizzo dello studio", false, /Scipioni|Via degli/i.test(tCat));
}
