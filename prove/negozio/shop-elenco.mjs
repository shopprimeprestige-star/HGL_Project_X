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
import { impostaPagina, testoVisibile } from "./_pagine.mjs";
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

/** `_pagine.mjs` finge solo `catalogo` e `cassa-sito`; la home nuova (T94) importa anche `contenuto-shop.functions` e `tariffe.functions`, che portano dentro il
 *  server vero e non si impacchettano. Qui lo si carica dal suo testo con i due finti in più (e `esbuild` cercato dalla radice): nessun file di altri toccato.
 *  shortcut: un ritocco al testo di un aiuto di altri; si toglie quando `_pagine.mjs` conoscerà i due server (e la categoria nuova di T95 non lo importerà più). */
async function pagineConFintiDellaHome(radice) {
  const filtro = "/^@\\/shop\\/cms\\/(catalogo|cassa-sito)\\.functions$/";
  const aggiunte = 'export const cassaDelSito = async () => "vecchia";';
  const sorgente = readFileSync(join(radice, "prove/negozio/_pagine.mjs"), "utf8");
  for (const pezzo of [filtro, aggiunte, "useParams: () => S().params ?? {},", "createRequire(import.meta.url)"]) if (!sorgente.includes(pezzo)) throw new Error(`_pagine.mjs è cambiato: manca «${pezzo}»`);
  const nuovo = sorgente
    .replace(filtro, "/^@\\/shop\\/(cms\\/(catalogo|cassa-sito|contenuto-shop)|cassa\\/tariffe)\\.functions$/")
    .replace(aggiunte, `${aggiunte}\nexport const contenutoShop = async () => ({ testi: {}, media: {} });\nexport const tariffaSpedizione = async () => ({ stato: "assente" });`)
    .replace("useParams: () => S().params ?? {},", "useParams: () => S().params ?? {}, useSearch: () => S().search ?? {},")
    .replace("createRequire(import.meta.url)", `createRequire(${JSON.stringify(join(radice, "package.json"))})`);
  return import(`data:text/javascript;base64,${Buffer.from(nuovo).toString("base64")}`);
}

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("SHOP R1 · T19 · ELENCO, CATEGORIA E RICERCA DELLO SHOP (20/11/2026)");
  const leggi = (f) => (existsSync(join(radice, f)) ? readFileSync(join(radice, f), "utf8") : "");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const F = { indice: "src/routes/shop.index.tsx", categoria: "src/routes/shop.c.$slug.tsx", paginaCategoria: "src/components/shop/pagine/PaginaCategoria.tsx", griglia: "src/shop/cms/GrigliaProdotti.tsx", elenco: "src/shop/cms/elenco.ts" };
  const src = Object.fromEntries(Object.entries(F).map(([k, f]) => [k, senzaCommenti(leggi(f))]));
  const E = mod["shop/cms/elenco"];
  const PUB = mod["shop/cms/pubblico"];

  /* ───────────────── 1 · LE FUNZIONI PURE ───────────────── */
  c("`elenco.ts` c'è e dà le funzioni che servono", ["function", "function", "function", "function", "function", "function", "function", "function", "function"],
    ["testoDaCercare", "eInvisibleDerm", "datiListaVisualizzata", "emettiUnaVolta", "creaEmettitoreRicerca", "frasaSenzaRisultati", "etichettaArticoli", "suScelta", "senzaPrezzo"].map((n) => typeof E?.[n]));
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
    c("Invisible Derm si riconosce dal nome (anche «Protocol®», maiuscole, spazi doppi); «Silk Top Invisible Knots» e «Solvente per Invisible Derm» no (D40: ancorato all'inizio)", [true, true, true, false, false, false, false],
      ["Invisible Derm Protocol®", "INVISIBLE DERM", "invisible   derm", "Silk Top Invisible Knots", "Derm", "", "Solvente per Invisible Derm"].map((x) => E.eInvisibleDerm(x)));
    c("Invisible Derm: anche «Invisible-Derm», «InvisibleDerm», «invisible_derm» (come la funzione di T11, D39)", [true, true, true], ["Invisible-Derm Protocol", "InvisibleDerm", "invisible_derm"].map((x) => E.eInvisibleDerm(x)));
  }
  if (E?.etichettaArticoli) {
    c("conteggio: «0 articoli», «1 articolo» (singolare), «5 articoli»", ["0 articoli", "1 articolo", "5 articoli"], [0, 1, 5].map((n) => E.etichettaArticoli(n)));
  }
  if (E?.senzaPrezzo && E?.daAggiungereDalCard && E?.haPrezziDiversi) {
    //  D39: dal server Invisible Derm arriva con `prezzoCent: null` (e `prezzoDaCent: null`). Nessuna di queste funzioni deve lanciare o inventare un prezzo.
    const base = (extra, varianti) => ({ sku: "X", slug: "x", nome: "Un prodotto", opzioni: [], media: [], prezzoDaCent: 1000, varianti: varianti ?? [{ sku: "X-A", nome: "Unica", opzioni: {}, prezzoCent: 1000, disponibile: true }], ...extra });
    const conPrezzo = { product: { name: "Un prodotto" }, pubblico: base({}) };
    const senza = { product: { name: "Un prodotto" }, pubblico: base({ prezzoDaCent: null }, [{ sku: "X-A", nome: "Unica", opzioni: {}, prezzoCent: null, disponibile: true }]) };
    const derm = { product: { name: "Invisible Derm Protocol®" }, pubblico: base({}) };
    c("senza prezzo: un prodotto con prezzo no; uno con `prezzoCent: null` sì; Invisible Derm sì (anche se il prezzo arrivasse)", [false, true, true], [E.senzaPrezzo(conPrezzo), E.senzaPrezzo(senza), E.senzaPrezzo(derm)]);
    c("senza prezzo: un prodotto del codice (senza `pubblico`) ha sempre il suo prezzo", false, E.senzaPrezzo({ product: { name: "Toupee" } }));
    c("un prodotto senza prezzo non si aggiunge dalla scheda dell'elenco (niente riga da 0 €)", [null, true], [E.daAggiungereDalCard(senza), !!E.daAggiungereDalCard(conPrezzo)]);
    c("`haPrezziDiversi` non lancia con prezzi nulli e non dice «Da» per un prezzo solo", [false, false], [E.haPrezziDiversi(senza.pubblico), E.haPrezziDiversi(conPrezzo.pubblico)]);
  }
  if (E?.suScelta) {
    //  dopo la scelta sul banner l'evento si riprova (il banner può essere accettato DOPO il caricamento della pagina)
    const finto = () => { const a = new Map(); return { a, addEventListener: (n, f) => a.set(n, f), removeEventListener: (n) => a.delete(n), manda: (n) => a.get(n)?.() }; };
    const orologio = () => { const t = { n: 0, vivi: new Map() }; return { set: (f, ms) => { const id = ++t.n; t.vivi.set(id, { f, ms }); return id; }, clear: (id) => void t.vivi.delete(id), passa: () => { for (const [id, v] of [...t.vivi]) { t.vivi.delete(id); v.f(); } }, vivi: () => t.vivi.size, ms: () => [...t.vivi.values()].at(-1)?.ms }; };
    const w = finto(); const o = orologio(); let n = 0;
    const via = E.suScelta(w, "hgl:consenso", () => n++, 2000, { set: o.set, clear: o.clear });
    c("dopo la scelta: l'ascolto è sul nome dell'evento del consenso e non parte niente subito", [true, 0], [w.a.has("hgl:consenso"), n]);
    w.manda("hgl:consenso"); c("dopo la scelta: si aspetta (il provider carica i pixel dopo) e poi l'azione parte UNA volta", [2000, 0], [o.ms(), n]);
    w.manda("hgl:consenso"); o.passa(); c("dopo la scelta: due scelte ravvicinate = un'azione sola", 1, n);
    w.manda("hgl:consenso"); via();
    c("dopo la scelta: lasciando la pagina l'ascolto e l'attesa si tolgono (l'azione non parte)", [false, 0, 1], [w.a.has("hgl:consenso"), o.vivi(), (o.passa(), n)]);
  }
  if (E?.frasaSenzaRisultati) {
    c("nessun risultato: con il codice la frase di oggi, con il CMS quella del Copywriter (3.13)", ["Nessun prodotto trovato per «tape».", "Non troviamo “tape”. Prova con un'altra parola, o chiedici aiuto."], [E.frasaSenzaRisultati("tape", false), E.frasaSenzaRisultati("tape", true)]);
  }

  /* ───────────────── 2 · IL SORGENTE ───────────────── */
  c("i cinque file ci sono", [true, true, true, true, true], Object.values(F).map((f) => existsSync(join(radice, f))));
  const tutto = Object.values(src).join("\n");
  c("le stelle e «N recensioni» stanno dietro la guardia `reviews > 0` (la scheda di oggi non ne ha più)", true, /reviews\s*>\s*0/.test(src.griglia));
  c("`ViewContent` della lista passa da `emettiEvento` (product_group): l'elenco di `codice` con `datiListaVisualizzata` dentro `useListaVista`, la categoria V1 con il suo hook (`emettiUnaVolta`, product_group); la home V1 non lo emette (decisione del capo)", [true, true, true], [/emettiEvento\(\s*"ViewContent"/.test(src.griglia) && /datiListaVisualizzata/.test(src.griglia), /useListaVista\(/.test(src.indice), /emettiEvento\(\s*"ViewContent"/.test(src.paginaCategoria) && /emettiUnaVolta\(/.test(src.paginaCategoria) && /product_group/.test(src.paginaCategoria)]);
  c("`Search` passa da `emettiEvento` con il SOLO `searchString`, e parte da `creaEmettitoreRicerca` (pausa o Invio)", [true, true, false], [/emettiEvento\(\s*"Search"\s*,\s*\{\s*searchString:\s*\w+\s*\}\s*\)/.test(src.indice), /creaEmettitoreRicerca/.test(src.indice), /emettiEvento\(\s*"Search"[^)]*(contentIds|categoria|valueCent)/.test(src.indice)]);
  c("il testo cercato NON entra nell'indirizzo: la pagina non ha `validateSearch`, `useSearch`, né `search:`", false, /validateSearch|useSearch|search\s*:|history\.|replaceState|pushState/.test(src.indice));
  c("nessun nome di tabella e nessun client del database nelle pagine (solo le funzioni del server)", false, /\bshop_[a-z_]+|supabase|catalogo\.server/.test(tutto));
  c("nessuna riga con l'indirizzo dello studio", false, /Scipioni|\bVia degli\b/i.test(leggi(F.indice) + leggi(F.categoria) + leggi(F.griglia)));
  c("le pagine non importano il carattere nuovo (D29): niente `lib/carattere`, niente Inter", false, /lib\/carattere|\bInter\b/.test(tutto));
  c("l'elenco legge la modalità dal contesto del guscio (`useRouteContext`), non la rilegge (`modalitaCatalogo`)", [true, false], [/useRouteContext\(\)/.test(src.indice), /modalitaCatalogo/.test(src.indice + src.categoria + src.griglia)]);
  c("`ViewContent` della lista riparte anche se il banner si accetta DOPO il caricamento della pagina: `useListaVista` ascolta la scelta (EVENTO_CONSENSO) con `suScelta`", [true, true], [/EVENTO_CONSENSO/.test(src.griglia), /suScelta\(/.test(src.griglia)]);
  //   La pulizia: l'effetto RESTITUISCE ciò che `suScelta` dà (la funzione che stacca l'ascolto da `window`). Senza `return` l'ascolto resta
  //   attaccato dopo lo smontaggio (mutazione del revisore: `return suScelta(` → `suScelta(` restava verde).
  c("`useListaVista` restituisce la pulizia di `suScelta` (nessun ascolto resta attaccato a `window`)", true, /return\s+suScelta\(/.test(src.griglia));
  c("il conteggio degli articoli dell'elenco di `codice` passa da `etichettaArticoli` (singolare «1 articolo»); la categoria V1 non lo scrive (il numero è di `FiltriCategoria`)", [true, false, false], [/etichettaArticoli\(/.test(src.indice), /etichettaArticoli\(/.test(src.categoria + src.paginaCategoria), /articoli<\/span>|\} articoli/.test(src.indice)]);
  c("la categoria: codice → `notFound()`; CMS senza categoria o senza prodotti → `redirect` a /shop", [true, true], [/notFound\(\)/.test(src.categoria), /redirect\(\{\s*to:\s*"\/shop"/.test(src.categoria)]);

  /* ───────────────── 3 · IL MARKUP: CODICE E CMS ───────────────── */
  let M = null;
  try {
    //  `_pagine.mjs` (aiuto che nessuno edita) conosce solo due server finti; la home nuova (T94) ne importa altri due (contenuto e tariffa).
    const { impacchettaPagina } = await pagineConFintiDellaHome(radice);
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
  const schede = (h) => h.split("<article").slice(1);

  /* ── codice: identico a oggi ── */
  impostaPagina({ pathname: "/shop", searchStr: "", context: { modalita: "codice" }, loaderData: null });
  const hCodice = norm(M.disegna(M.Indice.options.component));
  c("codice: il titolo e il sottotitolo di oggi restano (premium, indistinguibili): l'impronta lo prova, qui il testo", [true, true], [/Toupee\s*indistinguibili\s*e tutto per curarli/.test(testoVisibile(hCodice)), /grado premium/.test(testoVisibile(hCodice))]);
  c("codice: il markup di /shop è IDENTICO a oggi (impronta sha256; unica differenza ammessa: l'`aria-label` del campo di ricerca)", IMPRONTA_DI_OGGI, createHash("sha256").update(hCodice.replace(' aria-label="Cerca nel negozio"', "")).digest("hex"));
  c("codice: il campo di ricerca ha un nome per chi usa il lettore di schermo", true, /<input[^>]*aria-label="Cerca nel negozio"/.test(hCodice));
  const nomiOggi = [...hCodice.matchAll(/class="line-clamp-1 font-semibold text-white transition hover:text-brand">([^<]*)</g)].map((m) => m[1].replace(/&#x27;/g, "'").replace(/&amp;/g, "&"));
  c("codice: 33 schede, nell'ordine di `PRODUCTS`", [33, M.PRODUCTS.map((p) => p.name)], [nomiOggi.length, nomiOggi]);
  c("codice: le stelle e «N recensioni» ci sono su ogni scheda (33), come oggi", [33, true], [(hCodice.match(/ recensioni</g) ?? []).length, /4\.8\/5 · 1\.500\+ clienti/.test(testoVisibile(hCodice).replace(/&gt;/g, ">"))]);
  c("codice: la riga «Spedizione gratis > €59» del titolo c'è, come oggi", true, /Spedizione gratis > €59/.test(testoVisibile(hCodice)));

  /* ── cms: la GRIGLIA dei prodotti (T94 passo 2) ──
   *  Con `cms` `/shop` è la home nuova (`shop-home-v1.mjs`) e la categoria è `PaginaCategoria` con le card di T85: i controlli sul markup dei prodotti si disegnano
   *  sulla categoria V1, con la forma V1 del loader (righe `{ sku, card, varianti, opzioni }`, `meta`, `contenuto`, `tariffa`). */
  const PUBBLICI = catalogoProva(PUB);
  c("(prova stessa) il catalogo inventato dà 5 prodotti pubblici", 5, PUBBLICI.length);
  const CARD = mod["shop/cms/vetrina-card"];
  const leggero = (p) => ({ sku: p.sku, card: CARD.cardDaPubblico(p), varianti: p.varianti, opzioni: p.opzioni });
  const disegnaCms = (extra = {}) => {
    const { prodotti = PUBBLICI, ...resto } = extra;
    impostaPagina({ pathname: "/shop/c/patch-pronte", searchStr: "", search: {}, params: { slug: "patch-pronte" }, context: { modalita: "cms" },
      loaderData: { categoria: categorieProva[0], meta: { titolo: "Titolo di prova", descrizione: "Descrizione di prova." }, prodotti: prodotti.map(leggero), contenuto: { testi: {}, media: {} }, tariffa: { stato: "assente" }, ...resto } });
    return norm(M.disegna(M.Categoria.options.component));
  };
  const hCms = disegnaCms();
  const tCms = testoVisibile(hCms);
  const cardCms = schede(hCms);
  const nomiCard = (h) => [...h.matchAll(/<h2 class="line-clamp-2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => testoVisibile(m[1]));
  c("cms: 5 schede, una per prodotto pubblico, nell'ordine ricevuto", [5, ["Shampoo di prova", "Patch di prova", "Colla di prova", "Invisible Derm Protocol®", "Kit di prova"]], [cardCms.length, nomiCard(hCms)]);
  c("cms: NIENTE stelle (nessuna icona stella), NIENTE «recensioni», nessun voto in nessuna parte della pagina", [0, false, false, false],
    [(hCms.match(/lucide-star/g) ?? []).length, /recension/i.test(tCms), /\b4[.,]8\b|1\.500|clienti/i.test(tCms), /text-amber-300/.test(hCms)]);
  c("cms: niente prezzo barrato, niente «sconto», «risparmi», «ultimi»", [false, false],
    [/line-through|<del|<s>/.test(hCms), /sconto|risparmi|ultimi|best seller|top rated/i.test(tCms)]);
  c("cms: niente soglia di spedizione gratuita (la cifra non è più vera) né il «Remy» non provato", [false, false], [/\b59\b|Spedizione gratis/i.test(tCms), /Remy/.test(tCms)]);
  c("cms: nessun indirizzo dello studio", false, /Scipioni|Via degli/i.test(tCms));
  const prezzo = (h) => (testoVisibile(h).match(/€\s?[\d.]+,\d{2}|[\d.]+,\d{2}\s?€/g) ?? []);
  const cifre = (l) => l.map((x) => x.replace(/[^\d,]/g, ""));
  //  D38: le parole vietate non ci sono
  const PAROLE_VIETATE = /premium|indistinguibil|\bRemy\b|grado/i;
  c("cms: in tutta la pagina niente «premium», «indistinguibil…», «Remy», «grado»", false, PAROLE_VIETATE.test(tCms));
  //  D39: il server dà Invisible Derm con `prezzoCent` e `prezzoDaCent` nulli; un prodotto qualunque senza prezzo non si compra
  const senzaPrezzi = PUBBLICI.map((p) => (/Invisible Derm/.test(p.nome) ? { ...p, prezzoDaCent: null, varianti: p.varianti.map((v) => ({ ...v, prezzoCent: null })) } : p));
  const stranoSenzaPrezzo = { ...PUBBLICI[0], sku: "PROVA-SP", slug: "senza-prezzo", nome: "Un prodotto senza prezzo", prezzoDaCent: null, varianti: PUBBLICI[0].varianti.map((v) => ({ ...v, prezzoCent: null })) };
  const hNull = (() => { try { return disegnaCms({ prodotti: [...senzaPrezzi, stranoSenzaPrezzo] }); } catch (e) { return `LANCIA ${String(e).slice(0, 80)}`; } })();
  const cNull = schede(hNull);
  c("D39: con i prezzi nulli la pagina si disegna (6 schede) e non lancia", [6, false], [cNull.length, /^LANCIA/.test(hNull)]);
  c("D39: Invisible Derm senza prezzo dal server: nessuna cifra, nessun «NaN», nessun «Aggiungi», «Scopri» e link alla scheda", [[], false, false, true, true],
    [prezzo(cNull[3]), /NaN|null|undefined/.test(cNull[3]), /Aggiungi/.test(cNull[3]), /Scopri/.test(cNull[3]), /href="\/shop\/prodotto\/invisible-derm-protocol"/.test(cNull[3])]);
  c("D39: un prodotto qualunque senza prezzo non mostra «0,00», né «Aggiungi», e manda alla scheda", [[], false, false, true], [prezzo(cNull[5]), /0,00/.test(cNull[5]), /Aggiungi/.test(cNull[5]), /href="\/shop\/prodotto\/senza-prezzo"/.test(cNull[5])]);
  c("D39: gli altri prodotti restano come prima (prezzi)", [["18,90"], ["24,00"], ["45,00"]], [cifre(prezzo(cNull[0])), cifre(prezzo(cNull[2])), cifre(prezzo(cNull[4]))]);
  const [cShampoo, cPatch, cColla, cDerm, cKit] = cardCms;
  c("cms: i prezzi sono quelli del server (centesimi → euro), con «da» se le varianti costano diverso", [["18,90"], true, ["24,00"], ["45,00"]],
    [cifre(prezzo(cShampoo)), /\bda\b/i.test(testoVisibile(cPatch)) && /120,00/.test(testoVisibile(cPatch)), cifre(prezzo(cColla)), cifre(prezzo(cKit))]);
  c("cms: Invisible Derm SENZA prezzo: nessuna cifra, nessun «€», nessun «Aggiungi»; «Scopri» e il link alla scheda", [[], false, false, true, true],
    [prezzo(cDerm), /€/.test(cDerm), /Aggiungi/.test(cDerm), /Scopri/.test(cDerm), /href="\/shop\/prodotto\/invisible-derm-protocol"/.test(cDerm)]);
  c("cms: Invisible Derm non lascia cifre da nessuna parte nel suo pezzo di pagina (nemmeno 3.900, 3900, 390000)", false, /3[.]?900|390000/.test(cDerm));
  //  l'«Esaurito» lo dice la scheda (la card non lo scrive): una card non aggiungibile manda alla scheda con «Scegli»
  c("cms: un solo prodotto, una sola variante, disponibile → «Aggiungi» (bottone); con opzioni → «Scegli» (senza bottone); non aggiungibile (esaurito) → «Scegli» alla scheda e mai «Aggiungi»", [true, true, true, true, true],
    [/<button[^>]*>[\s\S]*?Aggiungi/.test(cShampoo) && !/Scegli/.test(cShampoo), /Scegli/.test(cPatch) && !/Aggiungi/.test(cPatch) && !/<button/.test(cPatch),
      /Scegli/.test(cColla) && !/Aggiungi/.test(cColla) && !/<button/.test(cColla), /href="\/shop\/prodotto\/colla-di-prova"/.test(cColla), /Aggiungi/.test(cKit)]);
  c("cms: le foto sono quelle del server (misura 960) con il testo alternativo", [true, true], [/https:\/\/media\.prova\.test\/shop\/prova\/p0-960\.webp/.test(cShampoo), /alt="Foto Shampoo di prova"/.test(cShampoo)]);

  /* ── il caricamento dell'elenco ──
   *  T94 (passo 1): il `loader` di `/shop` con `cms` dà ora i dati leggeri della home (contenuto, tariffa, categorie piene, vetrina) e il suo guasto è una home valida:
   *  lo prova `shop-home-v1.mjs` (chiamate registrate, dati leggeri, guasti). Qui resta il `codice`: nessuna chiamata, come oggi. */
  const caric = M.Indice.options.loader;
  c("l'elenco ha un `loader`: con il codice non chiede niente al server (null)", ["function", null], [typeof caric, typeof caric === "function" ? await (async () => { impostaPagina({ server: { elenco: () => { throw new Error("no"); }, categorie: () => { throw new Error("no"); } } }); return caric({ context: { modalita: "codice" } }); })() : "assente"]);

  /* ───────────────── 4 · LA CATEGORIA ───────────────── */
  //  T94 (passo 2): la categoria V1 (`PaginaCategoria`, T95) è provata da `shop-categoria-v1.mjs` (loader, `head`, disegno, sorgente): i controlli che stavano qui
  //  (loader notFound/redirect, titolo e descrizione SEO, canonical, ItemList e `</script>`, solo i prodotti della categoria, un H1, sentiero, nessun indirizzo,
  //  parole vietate) sono tolti e SOSTITUITI da quelli; l'elenco riga per riga è in LAVAGNA. Qui restano solo la forma V1 disegnata (sopra) e il sorgente (sezione 2).
  const K = M.Categoria;
  c("categoria V1: la rotta ha `validateSearch` (i filtri passano dall'indirizzo) e un `loader` che con `codice` fa `notFound` senza chiamare il server", ["function", "function", "notFound", []],
    await (async () => {
      impostaPagina({ server: { elenco: () => { throw new Error("no"); }, categorie: () => { throw new Error("no"); } } });
      const e = await Promise.resolve(K.options.loader({ params: { slug: "patch-pronte" }, context: { modalita: "codice" } })).then(() => "nessun errore", (x) => (x?.__notFound ? "notFound" : String(x)));
      return [typeof K.options.validateSearch, typeof K.options.loader, e, []];
    })());
}
