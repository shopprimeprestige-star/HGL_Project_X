/** ── VETRINA V1 · T70a · GLI AIUTI DI PROVA: `_dati-vetrina.mjs` E `_rende.mjs` ──────────────────────────────────
 *  PIANO-V1 §5 T70a. Cosa deve valere perché le prove delle pagine nuove (T70b e W1-W9) si fidino degli aiuti:
 *   · i dati inventati hanno la forma del codice vero (gli stessi moduli del progetto li leggono come se fossero del database)
 *     e nessuna parola vietata, nessuna cifra per Invisible Derm;
 *   · «server che lancia»: una funzione del server che il codice di oggi non chiama LANCIA davvero, ogni chiamata si registra
 *     (nome e ordine), le chiamate di oggi rispondono come oggi;
 *   · `senzaFinti` disegna il componente VERO dove di solito c'è un finto; `finti` si somma (e si può sovrascrivere un finto);
 *   · `rendiComponente` disegna un componente con le sue props; le cinque pagine dello shop si disegnano e `beforeLoad`/`loader` registrano le chiamate.
 *  Dati inventati, nessuna rete, nessun database. */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as D from "./_dati-vetrina.mjs";
import { rendi, rendiComponente } from "./_rende.mjs";

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T70a · GLI AIUTI DI PROVA (23/11/2026)");
  const M = mod["shop/cms/modello"];
  const PUB = mod["shop/cms/pubblico"];
  const CAR = mod["shop/cms/carrello"];
  const TC = mod["shop/cms/testi-confermati"];

  // ── i dati: la forma ──
  const tipi = (n) => D.PRODOTTI.filter((p) => p.tipo === n).length;
  c("catalogo: 8 prodotti (5 patch, 2 cura, 1 kit) più Invisible Derm", [8, 5, 2, 1, 9], [D.PRODOTTI.length, tipi("patch"), tipi("cura"), tipi("kit"), D.CATALOGO.length]);
  c("le patch hanno 1, 2 e 3 opzioni (cura e kit: da 0 a 1)", [true, true, true], [1, 2, 3].map((n) => D.PRODOTTI.some((p) => p.tipo === "patch" && p.opzioni.length === n)));
  c("ogni variante ha tante opzioni quante il prodotto, e tutte con un valore dichiarato", [], D.CATALOGO.flatMap((p) => p.varianti.filter((v) => Object.keys(v.opzioni).length !== p.opzioni.length || Object.entries(v.opzioni).some(([n, val]) => !p.opzioni.find((o) => o.nome === n)?.valori.some((x) => x.valore === val))).map((v) => v.sku)));
  c("slug e SKU validi per il modello (`slugValido`, `skuValido`), tutti diversi, anche quelli delle varianti", [[], true], [
    D.CATALOGO.flatMap((p) => (M.slugValido(p.slug) && M.skuValido(p.sku) && p.varianti.every((v) => M.skuValido(v.sku)) ? [] : [p.slug])),
    new Set(D.CATALOGO.flatMap((p) => [p.slug, ...p.varianti.map((v) => v.sku)])).size === D.CATALOGO.length + D.CATALOGO.reduce((s, p) => s + p.varianti.length, 0),
  ]);
  c("un prodotto «esaurito» (nessuna variante disponibile) e uno con una variante esaurita su più", [true, true], [
    D.PRODOTTI.some((p) => p.varianti.length > 0 && p.varianti.every((v) => !v.disponibile)), D.PRODOTTI.some((p) => p.varianti.some((v) => !v.disponibile) && p.varianti.some((v) => v.disponibile)),
  ]);
  c("`prezzoDaCent` = il prezzo più basso delle varianti, in centesimi interi", [], D.PRODOTTI.filter((p) => p.prezzoDaCent !== Math.min(...p.varianti.map((v) => v.prezzoCent)) || !Number.isInteger(p.prezzoDaCent)).map((p) => p.slug));
  c("due «Ti serve anche»: il correlato è un prodotto del catalogo, con il suo prezzo", [2, []], (() => {
    const con = D.PRODOTTI.filter((p) => p.correlato);
    return [con.length, con.filter((p) => { const t = D.CATALOGO.find((x) => x.slug === p.correlato.slug); return !t || t.prezzoDaCent !== p.correlato.prezzoDaCent; }).map((p) => p.slug)];
  })());
  c("`boxConsulenza` solo sulle patch (mai sulla cura, mai su Invisible Derm)", [], D.CATALOGO.filter((p) => p.boxConsulenza !== (p.tipo === "patch")).map((p) => p.slug));

  // ── Invisible Derm: nessuna cifra, mai ──
  c("Invisible Derm: `eInvisibleDerm` lo riconosce, gli altri 8 no", [true, 0], [PUB.eInvisibleDerm(D.INVISIBLE_DERM.nome, D.INVISIBLE_DERM.slug), D.PRODOTTI.filter((p) => PUB.eInvisibleDerm(p.nome, p.slug)).length]);
  c("Invisible Derm: nessun prezzo (`prezzoDaCent` e di ogni variante `null`), non acquistabile, nessuna variante disponibile", [null, false, true, true], [
    D.INVISIBLE_DERM.prezzoDaCent, D.INVISIBLE_DERM.acquistabile, D.INVISIBLE_DERM.varianti.every((v) => v.prezzoCent === null), D.INVISIBLE_DERM.varianti.every((v) => !v.disponibile),
  ]);
  c("Invisible Derm: nel suo JSON non c'è nessun numero oltre ai fissi dell'aggiornamento e dell'ordine delle foto", [], (() => {
    const { aggiornatoIl, media, ...resto } = D.INVISIBLE_DERM;
    return (JSON.stringify(resto).match(/:\s*-?\d+(\.\d+)?/g) ?? []).filter((n) => !/:\s*0$/.test(n));
  })());

  // ── i media ──
  c("media pieni: principale, scala, foto 2-5, video con copertina, confezione (8)", [["principale", "scala", "foto2", "foto3", "foto4", "foto5", "video", "confezione"], true], [
    D.PRODOTTI[0].media.map((m) => m.slot), D.PRODOTTI[0].media.find((m) => m.slot === "video").copertina.startsWith("https://") && D.PRODOTTI[0].media.find((m) => m.slot === "video").src === null,
  ]);
  c("media: ogni foto ha `alt` e le tre misure; «una foto» = solo la principale; «vuota» = nessuna", [true, 1, 0], [
    D.CATALOGO.every((p) => p.media.every((m) => m.alt && (m.slot === "video" || (m.src.w480 && m.src.w960 && m.src.w1600)))), D.CATALOGO_UNA_FOTO[0].media.length, D.CATALOGO_SENZA_FOTO[0].media.length,
  ]);
  c("campioni di colore solo con i media pieni (la pallina del valore)", [true, true], [D.PRODOTTI[0].opzioni[0].valori.every((v) => v.campione?.w480), D.CATALOGO_UNA_FOTO[0].opzioni[0].valori.every((v) => v.campione === null)]);

  // ── categorie, stress, scenario da 50 ──
  c("3 categorie: la terza senza prodotti (`quanti` 0), le altre contano i prodotti che le portano", [[6, 3, 0], true], [D.CATEGORIE.map((x) => x.quanti), new Set(D.CATEGORIE.map((x) => x.seo.titolo)).size === 3]);
  c("prodotto «stress»: 50 varianti (il massimo del modello), 2 opzioni", [M.MAX_COMBINAZIONI, 2], [D.PRODOTTO_STRESS.varianti.length, D.PRODOTTO_STRESS.opzioni.length]);
  c("scenario da 50 prodotti: nomi e indirizzi tutti diversi, SKU validi", [50, 50, true], [D.SCENARIO_50.length, new Set(D.SCENARIO_50.map((p) => p.slug)).size, D.SCENARIO_50.every((p) => M.skuValido(p.sku) && p.varianti.every((v) => M.skuValido(v.sku)))]);

  // ── tariffa, testi confermati, landing_content ──
  c("tariffa: `ok` confermata con costo intero, e `assente`", [true, "assente"], [D.TARIFFA_OK.stato === "ok" && D.TARIFFA_OK.confermata && Number.isInteger(D.TARIFFA_OK.costoCent), D.TARIFFA_ASSENTE.stato]);
  const pieni = TC.filtraConfermati(D.TESTI_CONFERMATI_PIENI), vuoti = TC.filtraConfermati(D.TESTI_CONFERMATI_VUOTI);
  c("testi confermati: pieni = tutte e sei le chiavi (`filtraConfermati`), vuoti = nessuna", [6, 0], [Object.values(pieni).filter(Boolean).length, Object.values(vuoti).filter(Boolean).length]);
  c("`landing_content`: pieno con testi e foto, vuoto con niente (stessa forma della riga)", [true, true, ["id", "media", "texts"]], [
    Object.keys(D.LANDING_CONTENT_PIENO.texts).length > 0 && Object.keys(D.LANDING_CONTENT_PIENO.media).length > 0, Object.keys(D.LANDING_CONTENT_VUOTO.texts).length === 0 && Object.keys(D.LANDING_CONTENT_VUOTO.media).length === 0, Object.keys(D.LANDING_CONTENT_VUOTO).sort(),
  ]);

  // ── il carrello: le righe e il server ──
  const skus = (righe) => righe.map((r) => r.sku ?? r.productId);
  c("carrello nuovo: due righe con `sku` e `snap`; vecchio: nessuna ha `sku`", [2, true, true], [D.CARRELLO_NUOVO.length, D.CARRELLO_NUOVO.every((r) => r.sku && r.snap), D.CARRELLO_VECCHIO.every((r) => !r.sku && !r.snap)]);
  const nuovoRipulito = CAR.ripulisciRighe(D.CARRELLO_NUOVO, D.righeServerDi(skus(D.CARRELLO_NUOVO)));
  c("`righeServerDi` + `ripulisciRighe`: il carrello nuovo resta intero, con i prezzi del server", [2, 0], [nuovoRipulito.righe.length, nuovoRipulito.rimosse]);
  const mistoRipulito = CAR.ripulisciRighe(D.CARRELLO_MISTO, D.righeServerDi(skus(D.CARRELLO_MISTO)));
  c("carrello misto: resta la riga nuova; la vecchia e Invisible Derm (prezzo di una volta) sono tolte", [1, 2], [mistoRipulito.righe.length, mistoRipulito.rimosse]);
  c("`carrelloFinto`: subtotale in euro come `totaleDaRighe` dei centesimi, conteggio pezzi, `rivalidaFinta` ok", [CAR.totaleDaRighe(D.CARRELLO_NUOVO), 3, "ok"], [D.carrelloFinto(D.CARRELLO_NUOVO).subtotal, D.carrelloFinto(D.CARRELLO_NUOVO).count, D.rivalidaFinta().stato]);

  // ── le parole vietate ──
  c("i dati inventati non contengono nessuna parola vietata, né «solo N»", [], D.trovaParoleVietate(JSON.stringify([D.CATALOGO, D.CATEGORIE, D.TARIFFA_OK, D.TESTI_CONFERMATI_PIENI, D.LANDING_CONTENT_PIENO, D.SCENARIO_50, D.PRODOTTO_STRESS, D.CARRELLO_NUOVO, D.CARRELLO_VECCHIO, D.CARRELLO_MISTO])));
  c("`trovaParoleVietate` ne trova davvero (anche scritte in maiuscolo e a pezzi dentro l'HTML) e `ultimi` solo intero", [true, true, true, true, true, false], [
    D.PAROLE_VIETATE.every((p) => D.trovaParoleVietate(`<p>${p.toUpperCase()}</p>`).length > 0),
    D.trovaParoleVietate("prezzo <del>9</del>").length === 1,
    D.trovaParoleVietate("ne restano solo 3").length === 1,
    D.trovaParoleVietate("ultimi pezzi").length === 1,
    D.trovaParoleVietate(`via ${["Scipi", "oni"].join("")} 1`).length === 1,
    D.trovaParoleVietate("sono multimiliardari").length > 0,
  ]);
  c("le costanti sono congelate: scriverci sopra lancia", true, (() => { try { D.PRODOTTI[0].nome = "x"; return false; } catch { return true; } })());

  // ── gli aiuti di disegno: un componente di prova scritto in una cartella temporanea ──
  const dir = mkdtempSync(join(tmpdir(), "prova-aiuti-"));
  try {
    mkdirSync(join(dir, "c"));
    const componente = (nome, corpo, importi = "") => {
      const file = join(dir, "c", `${nome}.tsx`);
      writeFileSync(file, `${importi}\nexport function ${nome}(props: any) { ${corpo} }\n`);
      return file;
    };
    // il componente chiama la funzione del server mentre si disegna e lascia la promessa in `globalThis.__prova`
    const chiama = componente("Chiama", `globalThis.__prova = ${["elencoProdotti({ data: {} })"].join("")}; return <b>chiama</b>;`, `import { elencoProdotti } from "@/shop/cms/catalogo.functions";`);
    const esito = async () => { try { return { ok: await globalThis.__prova }; } catch (e) { return { errore: String(e.message) }; } };

    const prima = await rendiComponente(radice, chiama, "Chiama", {}, {});
    c("senza `stato.server` (come prima di T70a): la funzione del server finta lancia «server finto» e la chiamata si registra", [{ errore: "server finto" }, ["elencoProdotti"]], [await esito(), prima.pagina.chiamate]);
    const lancia = await rendiComponente(radice, chiama, "Chiama", {}, { server: {} });
    c("«server che lancia»: una chiamata che il codice di oggi non fa LANCIA, e la chiamata si registra (nome e argomenti)", [{ errore: "chiamata al server NON prevista: elencoProdotti" }, ["elencoProdotti"], [[{ data: {} }]]], [await esito(), lancia.pagina.chiamate, lancia.pagina.chiamateArgs]);
    const risponde = await rendiComponente(radice, chiama, "Chiama", {}, { server: { elencoProdotti: ({ data }) => ["ok", data] } });
    c("…con una risposta dichiarata in `stato.server` (funzione degli argomenti) la chiamata risponde", [{ ok: ["ok", {}] }, ["elencoProdotti"]], [await esito(), risponde.pagina.chiamate]);
    await rendiComponente(radice, chiama, "Chiama", {}, { server: { elencoProdotti: () => { throw new Error("rete"); } } });
    c("…e una risposta che lancia fa lanciare la chiamata (lo scenario `guasto`)", { errore: "rete" }, await esito());

    // le chiamate di oggi rispondono come oggi, senza dichiarare niente
    const oggi = componente("Oggi", `globalThis.__prova = Promise.all([collaudoDellaVisita(), modalitaCatalogo(), modalitaCertaDelServer(), schedaProdotto({ data: { slug: "x", chiave: "" } })]); return <b>oggi</b>;`,
      `import { collaudoDellaVisita } from "@/shop/cms/cassa-sito.functions";\nimport { modalitaCatalogo, schedaProdotto } from "@/shop/cms/catalogo.functions";\nimport { modalitaCertaDelServer } from "@/shop/cms/modalita-certa.functions";`);
    const o1 = await rendiComponente(radice, oggi, "Oggi", {}, { server: {} });
    c("le quattro chiamate di oggi rispondono come oggi: collaudo falso, `modalitaCatalogo` «codice», modalità certa «incerto», scheda «non trovato»; l'ordine si registra", [{ ok: [false, "codice", "incerto", { esito: "non_trovato" }] }, ["collaudoDellaVisita", "modalitaCatalogo", "modalitaCertaDelServer", "schedaProdotto"]], [await esito(), o1.pagina.chiamate]);
    await rendiComponente(radice, oggi, "Oggi", {}, { server: {}, modalita: "cms", collaudo: true, modalitaCerta: "cms" });
    c("`modalitaCatalogo` risponde il valore dello stato (`modalita`), come collaudo e modalità certa", [{ ok: [true, "cms", "cms", { esito: "non_trovato" }] }], [await esito()]);

    // un server che nessuna pagina di oggi conosce: i nuovi si registrano e lanciano finché la prova non li dichiara
    const nuovi = componente("Nuovi", `globalThis.__prova = Promise.all([cassaPubblica(), contenutoShop(), tariffaSpedizione(), cassaDelSito()]); return <b>nuovi</b>;`,
      `import { cassaPubblica } from "@/shop/cms/cassa-pubblica.functions";\nimport { contenutoShop } from "@/shop/cms/contenuto-shop.functions";\nimport { tariffaSpedizione } from "@/shop/cassa/tariffe.functions";\nimport { cassaDelSito } from "@/shop/cms/cassa-sito.functions";`);
    const n1 = await rendiComponente(radice, nuovi, "Nuovi", {}, { server: { cassaPubblica: { cassa: "stripe", sicuro: false, metodi: [] }, contenutoShop: { testi: {} }, tariffaSpedizione: D.TARIFFA_OK, cassaDelSito: "stripe" } });
    c("i finti di `cassa-pubblica`, `contenuto-shop`, `tariffe` e `cassa-sito` rispondono quanto dichiarato", [{ ok: [{ cassa: "stripe", sicuro: false, metodi: [] }, { testi: {} }, D.TARIFFA_OK, "stripe"] }, ["cassaPubblica", "contenutoShop", "tariffaSpedizione", "cassaDelSito"]], [await esito(), n1.pagina.chiamate]);
    await rendiComponente(radice, nuovi, "Nuovi", {}, { server: {} });
    c("…e senza dichiarazione lanciano (la prima che non è prevista ferma tutto)", { errore: "chiamata al server NON prevista: cassaPubblica" }, await esito());

    // `finti` si somma e sovrascrive; `senzaFinti` toglie
    const usaModulo = componente("UsaModulo", `return <b>{valore}</b>;`, `import { valore } from "@/prova/modulo-nuovo";`);
    const f1 = await rendiComponente(radice, usaModulo, "UsaModulo", {}, { finti: { "@/prova/modulo-nuovo": `export const valore = "dal finto";` } });
    c("`stato.finti`: un modulo che non esiste nel progetto si finge con il codice dato", "<b>dal finto</b>", f1.html);
    const f2 = await rendiComponente(radice, usaModulo, "UsaModulo", {}, { finti: { "@/prova/modulo-nuovo": `export const valore = "uno";`, "@/prova/altro": `export const x = 1;` } });
    c("`stato.finti` ne somma più d'uno senza editare l'aiuto", "<b>uno</b>", f2.html);
    const sovr = componente("Sovrascrive", `return <b>{String(Object.keys(toast).join())}</b>;`, `import { toast } from "sonner";`);
    const s1 = await rendiComponente(radice, sovr, "Sovrascrive", {}, {});
    const s2 = await rendiComponente(radice, sovr, "Sovrascrive", {}, { finti: { sonner: `export const toast = { solo: 1 };` } });
    c("`stato.finti` sovrascrive un finto di base solo per QUEL disegno (il disegno dopo ha di nuovo quello di base)", ["<b>success,error</b>", "<b>solo</b>", "<b>success,error</b>"], [s1.html, s2.html, (await rendiComponente(radice, sovr, "Sovrascrive", {}, {})).html]);

    // `senzaFinti`: il componente vero. Una pagina importa `BoxProdottoGiusto` con l'alias `@/…` (e oggi ne trova il finto): qui lo fa un involucro di prova
    const involucro = componente("Involucro", `return <section>{BoxProdottoGiusto({ prodotto: "Patch di prova Alfa" })}</section>;`, `import { BoxProdottoGiusto } from "@/components/landing/consulenza/BoxProdottoGiusto";`);
    const conFinto = await rendiComponente(radice, involucro, "Involucro", {}, {});
    const vero = await rendiComponente(radice, involucro, "Involucro", {}, { senzaFinti: ["@/components/landing/consulenza/BoxProdottoGiusto"] });
    c("`senzaFinti`: con il finto il box è solo la sua etichetta; senza, si disegna il vero (con le sue voci e il bottone)", [true, true, true], [conFinto.html.includes("box-consulenza"), !vero.html.includes("box-consulenza"), vero.html.includes("<button")]);
    const diretto = await rendiComponente(radice, "src/components/landing/consulenza/BoxProdottoGiusto.tsx", "BoxProdottoGiusto", { prodotto: "Patch di prova Alfa" }, {});
    c("…e `rendiComponente` su un file vero passa le props e disegna il componente (il file nominato non si finge mai)", [true, true], [diretto.html.includes("<button"), vero.html === `<section>${diretto.html}</section>`]);
  } finally {
    rmSync(dir, { recursive: true });
  }

  // ── le cinque pagine dello shop con gli aiuti ──
  const R = (f) => `src/routes/${f}.tsx`;
  const vuotoLoader = { server: {} };
  const guscio = await rendi(radice, R("shop"), { ...vuotoLoader, pathname: "/shop", outlet: null });
  c("`shop.tsx` (guscio): si disegna con il router finto (`Outlet`, `useRouterState`), carrello vuoto e `CartProvider` finti, e il titolo c'è", true, guscio.html.length > 1000 && guscio.html.includes('href="/shop/carrello"'));
  const bl = await guscio.route.beforeLoad();
  c("…`beforeLoad` registra le chiamate di oggi: `modalitaCatalogo` poi `collaudoDellaVisita`; il valore è `{ modalita }` (e `collaudo` falso)", [["modalitaCatalogo", "collaudoDellaVisita"], { modalita: "codice" }], [guscio.pagina.chiamate, bl]);
  const car = await rendi(radice, R("shop.carrello"), { ...vuotoLoader, loaderData: { modo: "cms" }, carrello: D.carrelloFinto(D.CARRELLO_NUOVO), rivalida: D.rivalidaFinta(), tariffa: D.TARIFFA_CARRELLO_OK });
  c("`shop.carrello` con il carrello nuovo: si disegna con i nomi e il prezzo dei dati inventati", [true, true], [car.html.includes("Patch di prova Alfa"), /289,00\s€/.test(car.html)]);
  await car.route.loader();
  c("…il suo `loader` chiama solo `modalitaCatalogo`", ["modalitaCatalogo"], car.pagina.chiamate);
  const home = await rendi(radice, R("shop.index"), { ...vuotoLoader, loaderData: { prodotti: D.CATALOGO, categorie: D.CATEGORIE }, context: { modalita: "cms" } });
  c("`shop.index` (home di oggi) con prodotti e categorie inventati si disegna", true, home.html.includes("Patch di prova Alfa"));
  const homeLoader = await home.route.loader({ context: { modalita: "codice" } });
  c("…`loader` con `codice` non chiama il server (valore `null`)", [null, []], [homeLoader, home.pagina.chiamate]);
  home.pagina.server = { elencoProdotti: D.CATALOGO, elencoCategorie: D.CATEGORIE };
  const homeCms = await home.route.loader({ context: { modalita: "cms" } });
  c("…con `cms` chiama `elencoProdotti` e `elencoCategorie` (risposte dichiarate in `stato.server`, modificabili a disegno fatto)", [["elencoProdotti", "elencoCategorie"], 9, 3], [home.pagina.chiamate, homeCms.prodotti.length, homeCms.categorie.length]);
  const scheda = await rendi(radice, R("shop.prodotto.$slug"), { ...vuotoLoader, params: { slug: "patch-prova-alfa" }, loaderData: { scheda: { tipo: "cms", prodotto: D.PRODOTTI[0] }, anteprima: false }, carrello: D.carrelloFinto() });
  c("`shop.prodotto.$slug` con una scheda inventata si disegna con il nome del prodotto", true, scheda.html.includes("Patch di prova Alfa"));
  scheda.pagina.chiamate.length = 0;
  await scheda.route.loader({ params: { slug: "slug-che-non-e-del-codice" }, deps: { anteprima: "" } }).catch(() => {});
  c("…`loader` con `codice` e uno slug che il vecchio catalogo non conosce: `modalitaCatalogo` poi `schedaProdotto`", ["modalitaCatalogo", "schedaProdotto"], scheda.pagina.chiamate);
  const cat = await rendi(radice, R("shop.c.$slug"), { ...vuotoLoader, params: { slug: "patch-pronte" }, loaderData: { categoria: D.CATEGORIE[0], categorie: D.CATEGORIE, prodotti: D.CATALOGO.slice(0, 3) }, context: { modalita: "cms" } });
  c("`shop.c.$slug` con la categoria inventata si disegna", true, cat.html.includes("Patch di prova Alfa") || cat.html.includes(D.CATEGORIE[0].nome));
  const esitoCat = await cat.route.loader({ params: { slug: "patch-pronte" }, context: { modalita: "codice" } }).then(() => "nessun errore", (e) => String(e.message));
  c("…`loader` con `codice` fa `notFound` senza chiamare il server", ["notFound", []], [esitoCat, cat.pagina.chiamate]);
}
