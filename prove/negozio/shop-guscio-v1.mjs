/** ── VETRINA V1 · T93 · IL GUSCIO PER PERCORSO E `shop.tsx` (D72, D73; V1-T1, V1-T2, V1-H3, V1-H4, V1-H5, V1-T15) ─────────────────────
 *  `src/components/shop/guscio/GuscioShop.tsx` e `src/routes/shop.tsx`, disegnati davvero (`_rende.mjs`: esbuild + react-dom/server).
 *  Cosa deve valere:
 *   · guscio NUOVO solo con `cms` E sulle cinque pagine V1; tutto il resto (cassa, ordine, collaudo, percorso sconosciuto) e ogni percorso
 *     con `codice` restano nel guscio di oggi, senza la voce «Consulenza gratuita» in cassa;
 *   · la stessa tabella di percorsi dà la stessa risposta a `guscioPerPercorso`, `usaInter` e `paginaInItaliano` (D73);
 *   · `CartProvider` è l'elemento radice in entrambi i rami (il carrello non si rimonta passando da una pagina V1 alla cassa);
 *   · ordine delle parti: header, striscia offline, `main` (`id="contenuto"`, `tabindex="-1"`), piè di pagina, barra in fondo (mai dentro `main`);
 *   · la barra la sceglie `barraFissa(percorso, stato)`; la consulenza passa `sopraAlBanner` e `hoverScuro`; l'acquisto ha il suo slot;
 *   · `head` con i testi del copy solo per le cinque pagine (si guarda la FOGLIA delle `matches`: `match.pathname` del layout è sempre `/shop`);
 *   · il loader del layout non chiama mai il server con `codice` né fuori dalle cinque pagine;
 *   · confine d'errore comune attorno ai pezzi in ritardo, 404/500 avvolti, `data-shop-v1` su `<html>` messo e tolto, lente non raggiungibile.
 *  Cosa NON si prova qui (non gira senza browser): il fuoco vero, la tastiera, `inert` che esclude davvero dalla tabulazione, il telefono e la
 *  barra sopra il banner, gli effetti che segnalano lo stato della pagina (`useStatoPagina`): li guardano T103c e T106. Dati inventati, nessuna rete. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as D from "./_dati-vetrina.mjs";
import { rendi, rendiComponente } from "./_rende.mjs";

const FILE_SHOP = "src/routes/shop.tsx";
const FILE_GUSCIO = "src/components/shop/guscio/GuscioShop.tsx";
const testoVisibile = (h) => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const conta = (h, s) => h.split(s).length - 1;

/** Il carrello finto che si vede nel marchio: avvolge i figli in un `div`, così «radice» si legge dall'HTML. */
const CART_MARCATO = `import React from "react"; export const useCart = () => globalThis.__pagina.carrello; export const CartProvider = ({ children }) => React.createElement("div", { "data-cart-provider": "" }, children);`;
/** La barra della consulenza finta: dice con che proprietà è stata montata (quella vera si disegna solo nel browser). */
const BARRA_MARCATA = `import React from "react"; export const BarraConsulenza = (p) => React.createElement("div", { "data-barra-finta": "consulenza", "data-prov": p.provenienza, "data-sopra": String(p.sopraAlBanner), "data-hover": String(p.hoverScuro) }); export default BarraConsulenza;`;
const CATEGORIE_PROVA = [
  { slug: "patch-pronte", nome: "Patch pronte", quanti: 4 },
  { slug: "shampoo-e-balsami", nome: "Shampoo e balsami", quanti: 3 },
];

/** Le cinque pagine V1 (anche con query, barra finale e maiuscole) e tutto il resto: la tabella comune a guscio, carattere e lingua. */
const V1 = ["/shop", "/shop/", "/SHOP", "/shop?utm_source=meta", "/shop/c/patch-pronte", "/Shop/C/Patch-Pronte/", "/shop/cerca", "/shop/cerca?q=a", "/shop/prodotto/lace-front", "/shop/prodotto/lace-front?anteprima=x", "/shop/carrello", "/shop/carrello/"];
const OGGI = ["/shop/checkout", "/shop/checkout/", "/shop/ordine/HG-1", "/shop/ordine/HG-1?t=abc", "/shop/collaudo", "/shop/xyz", "/shopx", "/shop/c", "/shop/c/a/b", "/shop/prodotto/a/b", "/shop/cerca/altro", "/shop/carrello/altro", "/shop//c/x"];

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T93 · IL GUSCIO PER PERCORSO E `shop.tsx` (23/11/2026)");
  const leggi = (f) => readFileSync(join(radice, f), "utf8");
  const srcShop = senzaCommenti(leggi(FILE_SHOP));
  const srcG = senzaCommenti(leggi(FILE_GUSCIO));
  const T = mod["landing/testi-shop"];
  const BARRE = mod["shop/cms/vetrina-barre"];
  const CAR = mod["lib/carattere"];
  const TS = T.TESTI_SHOP;

  /** Il layout `shop.tsx` disegnato alla percorso dato, con i finti di questa prova. */
  const vista = async (modalita, pathname, extra = {}) => {
    const { html, route, pagina } = await rendi(radice, FILE_SHOP, {
      server: {}, pathname, context: { modalita }, outlet: "CONTENUTO-PROVA",
      loaderData: { categorie: CATEGORIE_PROVA },
      finti: { "@/shop/CartContext": CART_MARCATO, "@/components/landing/consulenza/BarraConsulenza": BARRA_MARCATA },
      ...extra,
    });
    return { html, route, pagina };
  };
  const nuovo = (h) => h.includes('data-guscio="nuovo"');

  /* ───────────────── 1 · QUALE GUSCIO PER OGNI PERCORSO (D72) ───────────────── */
  const attesoNuovo = (p) => BARRE.guscioPerPercorso(p) === "nuovo";
  c("la tabella ha le cinque pagine V1 come «nuovo» e il resto come «oggi» (`guscioPerPercorso`)", [V1.map(() => true), OGGI.map(() => false)], [V1.map(attesoNuovo), OGGI.map(attesoNuovo)]);
  c("la stessa tabella dà la stessa risposta a `usaInter` e `paginaInItaliano` (D73): una lista sola", [V1.map(() => true), OGGI.map(() => false), V1.map(() => true), OGGI.map(() => false)], [V1.map(CAR.usaInter), OGGI.map(CAR.usaInter), V1.map(CAR.paginaInItaliano), OGGI.map(CAR.paginaInItaliano)]);

  const conCms = {};
  for (const p of [...V1, ...OGGI]) conCms[p] = (await vista("cms", p)).html;
  c("cms: le cinque pagine V1 sono nel guscio NUOVO", V1.map(() => true), V1.map((p) => nuovo(conCms[p])));
  c("cms: cassa, ordine, collaudo e percorsi sconosciuti restano nel guscio di OGGI", OGGI.map(() => false), OGGI.map((p) => nuovo(conCms[p])));
  const conCodice = {};
  for (const p of [...V1, ...OGGI]) conCodice[p] = (await vista("codice", p)).html;
  c("codice: nessun percorso è nel guscio nuovo (il sito di oggi non cambia)", [...V1, ...OGGI].map(() => false), [...V1, ...OGGI].map((p) => nuovo(conCodice[p])));
  const senzaModalita = (await vista(undefined, "/shop")).html;
  c("modalità illeggibile (lettura fallita): guscio di oggi, mai un errore", [false, true], [nuovo(senzaModalita), senzaModalita.includes("bg-blueprint")]);

  for (const p of ["/shop/checkout", "/shop/ordine/HG-1", "/shop/collaudo", "/shop/xyz"]) {
    const h = conCms[p];
    c(`cms ${p}: testata di oggi («Preventivo su misura», «Analisi gratuita»), niente voce «Consulenza gratuita», niente ricerca, niente «Vai al contenuto»`, [true, true, false, false, false, true], [
      h.includes("Preventivo su misura"), h.includes("Analisi gratuita"), /Consulenza gratuita/.test(testoVisibile(h)), /role="search"/.test(h), /Vai al contenuto/.test(h), h.includes("bg-blueprint"),
    ]);
  }
  c("cms /shop/checkout e /shop/ordine: nessun `id=\"contenuto\"`, nessun `data-slot-barra-fissa`, il carrello e il piè di pagina sono quelli di R2", [false, false, true], [
    /id="contenuto"/.test(conCms["/shop/checkout"] + conCms["/shop/ordine/HG-1"]), /data-slot-barra-fissa/.test(conCms["/shop/checkout"]), conCms["/shop/checkout"].includes("Hair Genius Labs SRLS"),
  ]);
  for (const f of ["src/routes/shop.checkout.tsx", "src/routes/shop.ordine.$ref.tsx", "src/routes/shop.collaudo.tsx"]) {
    c(`${f}: non importa il guscio nuovo`, false, /GuscioShop|components\/shop\/guscio/.test(leggi(f)));
  }
  c("`GuscioShop` è nominato in `shop.tsx` solo per il ramo nuovo: una importazione e un uso", [1, 1], [conta(srcShop, 'from "@/components/shop/guscio/GuscioShop"'), conta(srcShop, "<GuscioShop")]);

  /* ───────────────── 2 · CartProvider È LA RADICE IN ENTRAMBI I RAMI ───────────────── */
  const radiceCart = (h) => h.startsWith('<div data-cart-provider="">');
  c("`CartProvider` è l'elemento radice nel guscio nuovo, in quello di oggi con cms e con codice", [true, true, true], [radiceCart(conCms["/shop"]), radiceCart(conCms["/shop/checkout"]), radiceCart(conCodice["/shop"])]);
  c("in `shop.tsx` c'è UN solo `<CartProvider>`, ed è ciò che `ShopLayout` restituisce; `GuscioShop` non ne monta altri", [1, true, false], [
    conta(srcShop, "<CartProvider>"), /function ShopLayout\(\)[\s\S]*return\s*\(\s*<CartProvider>[\s\S]*<\/CartProvider>\s*\);\s*\}\s*$/.test(srcShop), /CartProvider/.test(srcG),
  ]);

  /* ───────────────── 3 · IL GUSCIO NUOVO: ORDINE DELLE PARTI ───────────────── */
  const v = conCms["/shop"];
  const i = (s) => v.indexOf(s);
  c("ordine: header, striscia offline, main, piè di pagina; la barra della consulenza è dopo il piè di pagina e fuori da `main`", true,
    i("<header") >= 0 && i("<header") < i("data-banner-offline") && i("data-banner-offline") < i("<main") && i("<main") < i("<footer") && i("<footer") < i("data-barra-finta") && v.indexOf("</main>") < i("data-barra-finta"));
  const main = v.match(/<main[^>]*>/)?.[0] ?? "";
  c("`main`: uno solo, `id=\"contenuto\"` e `tabindex=\"-1\"` (il bersaglio di «Vai al contenuto»), e i figli stanno dentro", [1, true, true, true], [
    conta(v, "<main"), /id="contenuto"/.test(main), /tabindex="-1"/.test(main), /<main[^>]*>[\s\S]*CONTENUTO-PROVA[\s\S]*<\/main>/.test(v),
  ]);
  c("«Vai al contenuto» c'è UNA volta (quella dell'header) e il suo `href` è l'`id` del `main`", [1, true], [conta(testoVisibile(v), "Vai al contenuto"), /href="#contenuto"/.test(v)]);
  c("la ricerca è montata nel posto dell'header (`role=\"search\"` dentro `<header>`), una volta", [1, true], [conta(v, 'role="search"'), v.indexOf('role="search"') < v.indexOf("</header>")]);
  c("«Cura» e «Consulenza gratuita» sono nell'header; «Consulenza gratuita» è anche nel piè di pagina (un bottone)", [true, true, true], [
    /Cura/.test(v.slice(0, v.indexOf("</header>"))), /Consulenza gratuita/.test(v.slice(0, v.indexOf("</header>"))), /<button[^>]*>Consulenza gratuita<\/button>/.test(v.slice(v.indexOf("<footer"), v.indexOf("</footer>"))),
  ]);
  const senzaCategorie = (await vista("cms", "/shop", { loaderData: undefined })).html;
  c("senza categorie (guasto del server) l'header non ha «Cura» e la pagina si disegna lo stesso", [false, true], [/Shampoo e balsami/.test(senzaCategorie.slice(0, senzaCategorie.indexOf("</header>"))), nuovo(senzaCategorie)]);
  c("niente sfondo scuro del vecchio guscio e niente `Toaster` nel nuovo; la radice del guscio nuovo è chiara", [false, true], [v.includes("bg-blueprint"), /data-guscio="nuovo"[^>]*class="[^"]*bg-white/.test(v) || /class="[^"]*bg-white[^"]*"[^>]*data-guscio="nuovo"/.test(v)]);

  /* la barra: chi la monta e con quali proprietà */
  const barra = (h) => ({ consulenza: /data-barra-finta="consulenza"/.test(h) });
  c("home e categoria: barra della consulenza con `provenienza=\"stock\"`, `sopraAlBanner` e `hoverScuro`", [{ consulenza: true }, { consulenza: true }, true], [
    barra(conCms["/shop"]), barra(conCms["/shop/c/patch-pronte"]), /data-prov="stock" data-sopra="true" data-hover="true"/.test(conCms["/shop"]),
  ]);
  c("scheda e carrello: nessuna barra della consulenza (la barra d'acquisto la disegna la pagina nello slot)", [{ consulenza: false }, { consulenza: false }], [barra(conCms["/shop/prodotto/lace-front"]), barra(conCms["/shop/carrello"])]);
  c("ricerca: nessuna barra della consulenza", { consulenza: false }, barra(conCms["/shop/cerca"]));
  const SLOT = '<div data-slot-barra-fissa=""></div>';
  c("lo slot `data-slot-barra-fissa` c'è su tutte le cinque pagine V1, UNA volta, dopo il piè di pagina e fuori da `main`, ed è l'ULTIMO figlio del guscio", V1.map(() => [1, true, true, true]), V1.map((p) => {
    const h = conCms[p];
    return [conta(h, "data-slot-barra-fissa"), h.indexOf("</footer>") < h.indexOf("data-slot-barra-fissa"), h.indexOf("</main>") < h.indexOf("data-slot-barra-fissa"), h.endsWith(`${SLOT}</div></div>`)];
  }));
  c("lo slot lo vedono le pagine solo se `barraFissa` dice «acquisto» (non su 404, 500, anteprima, Invisible Derm); il nodo è quello dell'ultimo figlio", [true, true], [
    /slot: barra === "acquisto" \? slot : null/.test(srcG), /<div ref=\{setSlot\} data-slot-barra-fissa="" \/>\s*<\/ContestoGuscio\.Provider>/.test(srcG),
  ]);
  c("`barraFissa` riceve sempre lo stato (404, 500, anteprima, Invisible Derm = nessuna barra): sorgente e funzione", [true, [null, null, null, "acquisto"]], [
    /barraFissa\(\s*pathname\s*,\s*stato\s*\)/.test(srcG), ["non_trovata", "errore", "non_in_vendita", "normale"].map((s) => BARRE.barraFissa("/shop/prodotto/x", s)),
  ]);

  /* ───────────────── 4 · 404, 500 E PEZZI IN RITARDO ───────────────── */
  const dir = mkdtempSync(join(tmpdir(), "prova-guscio-v1-"));
  try {
    const entrata = join(dir, "entrata.tsx");
    writeFileSync(entrata, `
import React from "react";
import * as G from ${JSON.stringify(join(radice, FILE_GUSCIO))};
export const NonTrovata = () => React.createElement(G.NonTrovataShop);
export const Errore = (p) => React.createElement(G.ErroreShop, { error: new Error(p.messaggio), reset: () => {} });
export const Confine = (p) => {
  const C = G.ConfinePezzoInRitardo;
  const i = new C({ ripiego: React.createElement("p", { "data-ripiego": "" }, "RIPIEGO"), children: React.createElement("p", null, "FIGLI") });
  if (p.guasto) i.state = C.getDerivedStateFromError(new Error("Failed to fetch dynamically imported module"));
  return i.render();
};
export const Riserva = () => React.createElement(G.HeaderDiRiserva);
export const Radice = () => {
  const attr = new Map();
  const doc = { documentElement: { setAttribute: (k, val) => attr.set(k, val), removeAttribute: (k) => attr.delete(k) } };
  const fine = G.collegaRadiceShop(doc);
  const durante = attr.has("data-shop-v1");
  fine();
  return JSON.stringify([durante, attr.has("data-shop-v1")]);
};
export const Lente = () => {
  const attr = new Map([["aria-expanded", "false"]]);
  const lente = { getAttribute: (k) => attr.get(k) ?? null, setAttribute: (k, val) => attr.set(k, String(val)), removeAttribute: (k) => attr.delete(k) };
  let richiamo = null, scollegato = false;
  class Osservatore { constructor(f) { richiamo = f; } observe() {} disconnect() { scollegato = true; } }
  const fine = G.collegaLente({ querySelector: (s) => (s === "button[aria-expanded]" ? lente : null) }, Osservatore);
  const letto = [attr.get("tabindex") ?? null];
  attr.set("aria-expanded", "true"); richiamo(); letto.push(attr.get("tabindex") ?? null);
  attr.set("aria-expanded", "false"); richiamo(); letto.push(attr.get("tabindex") ?? null);
  attr.set("aria-expanded", "true"); richiamo(); fine(); letto.push(attr.get("tabindex") ?? null, scollegato);
  const vuoto = G.collegaLente({ querySelector: () => null }, Osservatore);
  letto.push(typeof vuoto);
  return JSON.stringify(letto);
};
`);
    const disegna = async (nome, props = {}) => (await rendiComponente(radice, entrata, nome, props)).html.replaceAll("&quot;", '"');

    const nt = await disegna("NonTrovata");
    c("`NonTrovataShop` disegna la pagina 404 di T83 (titolo, «Patch pronte», «Cura») senza leggere il router", [true, true, true], [nt.includes(TS.err404.titolo.replace("'", "&#x27;")) || testoVisibile(nt).includes(TS.err404.titolo), /data-pagina-errore/.test(nt), />Patch pronte</.test(nt)]);
    const er = await disegna("Errore", { messaggio: "SEGRETO-DEL-SERVER 12345" });
    c("`ErroreShop`: la pagina 500 di T83 con «Riprova»; l'errore vero non compare MAI nel disegno", [true, true, false], [testoVisibile(er).includes(TS.err500.titolo), /Riprova/.test(er), /SEGRETO-DEL-SERVER/.test(er)]);
    const erVersione = await disegna("Errore", { messaggio: "Failed to fetch dynamically imported module: /assets/x.js" });
    c("`ErroreShop` con un pezzo che non arriva: stessa pagina, senza il testo dell'errore", [true, false], [testoVisibile(erVersione).includes(TS.err500.titolo), /dynamically imported/.test(erVersione)]);
    c("`ErroreShop` conserva il soccorso del router (`erroreDiVersione`, `ricaricaPerPezzoMancante` in un effetto) e per un pezzo mancante «Riprova» ricarica ripulendo (`ripulisciERicarica`)", [true, true, true], [
      /erroreDiVersione\(\s*error\s*\)/.test(srcG), /useEffect\([\s\S]{0,200}ricaricaPerPezzoMancante\(\s*error\s*\)/.test(srcG), /ripulisciERicarica/.test(srcG),
    ]);
    c("404 e 500 dicono alla pagina il loro stato (`useStatoPagina`): niente barra fissa sopra un errore", [true, true], [
      /function NonTrovataShop\(\)\s*\{\s*useStatoPagina\("non_trovata"\)/.test(srcG), /useStatoPagina\("errore"\)/.test(srcG),
    ]);
    c("`useStatoPagina`: segnala in un effetto e rimette «normale» allo smontaggio; fuori dal guscio non fa niente (contesto di partenza)", [true, true, true], [
      /export function useStatoPagina\([\s\S]*?useEffect\(/.test(srcG), /return \(\) => segnala\("normale"\)/.test(srcG), /createContext<[^>]*>\(\{ segnala: \(\) => \{\}, slot: null \}\)/.test(srcG),
    ]);

    const cf = await disegna("Confine", { guasto: false });
    const cg = await disegna("Confine", { guasto: true });
    c("`ConfinePezzoInRitardo`: senza guasto mostra i figli; dopo un errore mostra il ripiego e non più i figli", [true, false, true, false], [/FIGLI/.test(cf), /RIPIEGO/.test(cf), /data-ripiego/.test(cg), /FIGLI/.test(cg)]);
    const ri = await disegna("Riserva");
    c("l'header di riserva (quando un pezzo in ritardo non arriva): logo che porta a `/shop`, frase calma di `err500.testo`, «Riprova», regione `status`, niente rosso", [true, true, true, true, false], [
      /<a href="\/shop"/.test(ri), testoVisibile(ri).includes(TS.err500.testo), />Riprova</.test(ri), /role="status"/.test(ri), /red-|rose-|destructive/.test(ri),
    ]);
    c("l'header e il pannello in ritardo del piè di pagina stanno ciascuno dentro il confine (il pannello con ripiego nullo)", [true, true], [
      /<ConfinePezzoInRitardo ripiego=\{<HeaderDiRiserva \/>\}>\s*<ShopHeader/.test(srcG), /<ConfinePezzoInRitardo ripiego=\{null\}>\s*<Suspense[^>]*>\s*<PannelloProblemi/.test(srcG),
    ]);

    c("`data-shop-v1` si mette su `<html>` e si toglie allo smontaggio", "[true,false]", await disegna("Radice"));
    c("la lente del telefono: con la riga di ricerca aperta `tabindex=\"-1\"` (il fuoco da programma resta possibile), chiusa lo toglie, smontando disconnette; senza lente non fa niente", '[null,"-1",null,null,true,"function"]', await disegna("Lente"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  c("`data-shop-v1` è scritto PRIMA di `useAltezzaBanner` (lo stesso componente, due effetti in ordine): la sua prima misura trova l'elemento", true, srcG.indexOf("collegaRadiceShop(document)") > 0 && srcG.indexOf("collegaRadiceShop(document)") < srcG.indexOf("useAltezzaBanner()"));
  c("la lente è allineata dal guscio (la ricerca è di T82b e non si tocca): effetto con `collegaLente` e la ricerca montata con le categorie", [true, true], [/useEffect\(\(\) => \(rif\.current \? collegaLente\(rif\.current\) : undefined\), \[\]\)/.test(srcG), /<RicercaShop categorie=\{categorie\} \/>/.test(srcG)]);

  /* ───────────────── 5 · `head`: i testi del copy solo sulle cinque pagine ───────────────── */
  const foglia = (routeId, pathname) => ({ routeId, pathname });
  const layout = (context) => ({ routeId: "/shop", pathname: "/shop", context });
  const meta = (route, ctx, matches) => {
    const m = route.head({ match: layout(ctx), matches, params: {} })?.meta ?? [];
    return { title: m.find((x) => x.title)?.title, description: m.find((x) => x.name === "description")?.content };
  };
  const { route } = await vista("cms", "/shop");
  const ES = { home: foglia("/shop/", "/shop/"), carrello: foglia("/shop/carrello", "/shop/carrello"), cerca: foglia("/shop/cerca", "/shop/cerca"), scheda: foglia("/shop/prodotto/$slug", "/shop/prodotto/abc"), categoria: foglia("/shop/c/$slug", "/shop/c/patch-pronte") };
  const dentro = (leaf) => [layout({ modalita: "cms" }), leaf];
  c("head, cms home: titolo e descrizione del copy (`meta.home`)", { title: TS.meta.home.titolo, description: TS.meta.home.descrizione }, meta(route, { modalita: "cms" }, dentro(ES.home)));
  c("head, cms carrello: il titolo del carrello; ricerca: il titolo provvisorio della ricerca", [TS.meta.carrello.titolo, T.TESTI_PROVVISORI.cerca.metaTitolo], [meta(route, { modalita: "cms" }, dentro(ES.carrello)).title, meta(route, { modalita: "cms" }, dentro(ES.cerca)).title]);
  c("head, cms scheda e categoria: descrizione del copy (le loro pagine mettono il titolo proprio)", [TS.meta.home.descrizione, TS.meta.home.descrizione], [meta(route, { modalita: "cms" }, dentro(ES.scheda)).description, meta(route, { modalita: "cms" }, dentro(ES.categoria)).description]);
  const DI_OGGI = meta(route, { modalita: "codice" }, undefined);
  const stessoDiOggi = (m) => JSON.stringify(m) === JSON.stringify(DI_OGGI);
  c("head, codice: sempre quello di oggi, anche sulle cinque pagine (il titolo contiene ancora «Toupee»)", [true, true, true], [
    stessoDiOggi(meta(route, { modalita: "codice" }, [layout({ modalita: "codice" }), ES.home])), stessoDiOggi(meta(route, { modalita: "codice" }, [layout({ modalita: "codice" }), ES.carrello])), /Toupee/.test(DI_OGGI.title),
  ]);
  const checkout = foglia("/shop/checkout", "/shop/checkout");
  c("head, cms su cassa, ordine, collaudo e percorso sconosciuto (la foglia è il layout stesso): come oggi con il suo testo cms, MAI i testi del copy", [true, true, true], [
    meta(route, { modalita: "cms" }, dentro(checkout)).title === DI_OGGI.title, meta(route, { modalita: "cms" }, dentro(foglia("/shop/ordine/$ref", "/shop/ordine/HG-1"))).title === DI_OGGI.title,
    meta(route, { modalita: "cms" }, [layout({ modalita: "cms" }), foglia("/shop", "/shop")]).title === DI_OGGI.title,
  ]);
  c("head: senza `matches` (come nell'oro) o senza contesto resta quello di oggi; non si guarda `match.pathname` da solo (nel layout è sempre `/shop`)", [true, true, false], [
    meta(route, { modalita: "cms" }, undefined).title === DI_OGGI.title, meta(route, undefined, undefined).title === DI_OGGI.title, /match\??\.pathname/.test(srcShop),
  ]);

  /* ───────────────── 6 · il loader del layout ───────────────── */
  const chiama = async (modalita, pathname, server) => {
    const { route: r, pagina } = await vista(modalita, "/shop");
    pagina.server = server;
    pagina.chiamate.length = 0;
    const valore = await r.loader({ context: { modalita }, location: pathname === undefined ? undefined : { pathname }, params: {}, deps: {} });
    return { valore, chiamate: [...pagina.chiamate] };
  };
  const piene = { elencoCategorie: () => D.CATEGORIE };
  const a = await chiama("cms", "/shop", piene);
  c("loader, cms su una pagina V1: una sola chiamata `elencoCategorie`, e per ogni categoria solo `slug`, `nome` e `quanti` (niente foto nell'HTML)", [["elencoCategorie"], D.CATEGORIE.map((x) => ({ slug: x.slug, nome: x.nome, quanti: x.quanti }))], [a.chiamate, a.valore?.categorie]);
  const b = await chiama("cms", "/shop/checkout", piene);
  c("loader, cms su cassa/ordine/collaudo: nessuna chiamata al server e niente dati", [[], undefined], [b.chiamate, b.valore]);
  const cd = await chiama("codice", "/shop", piene);
  c("loader, codice: nessuna chiamata al server e valore `undefined` (come oggi, quando il layout non ha loader)", [[], undefined], [cd.chiamate, cd.valore]);
  const nl = await chiama("codice", undefined, piene);
  c("loader, codice senza `location`: nessuna chiamata, nessun errore", [[], undefined], [nl.chiamate, nl.valore]);
  const g = await chiama("cms", "/shop", { elencoCategorie: () => { throw new Error("rete"); } });
  c("loader, cms con il server che lancia: nessun errore al pubblico, elenco vuoto", { categorie: [] }, g.valore);
  const v2 = await chiama("cms", "/shop", { elencoCategorie: () => "non un elenco" });
  c("loader, cms con una risposta che non è un elenco: elenco vuoto", { categorie: [] }, v2.valore);

  /* ───────────────── 7 · sorgente: testi, parole, chiavi ───────────────── */
  const tutto = leggi(FILE_GUSCIO) + leggi(FILE_SHOP);
  c("nessuna parola vietata, nessun «da confermare», nessun `{{` nei due sorgenti (le doppie graffe del JSX non contano)", [[], false, false], [
    D.trovaParoleVietate(senzaCommenti(leggi(FILE_GUSCIO)).replaceAll("={{", "=").replaceAll("}}", "}")), /da confermare/i.test(leggi(FILE_GUSCIO)), /\{\{[^}]/.test(leggi(FILE_GUSCIO).replace(/=\{\{[^}]*\}\}/g, "")),
  ]);
  c("nessun indirizzo dello studio e nessuna chiave nei due sorgenti", [false, false], [/Scipioni|\bVia degli\b|\bCAP\b/i.test(tutto), /sk_(live|test)|service_role|SUPABASE_SERVICE|eyJ[A-Za-z0-9_-]{20,}/.test(tutto)]);
  const letterali = [TS.header.consulenza, T.TESTI_PROVVISORI.guscio.vaiAlContenuto, TS.err500.testo, TS.err500.titolo, T.TESTI_PROVVISORI.errore.riprova];
  c("i testi vengono tutti da `testi-shop.ts`: nessuno è scritto uguale nel guscio (commenti esclusi)", [], letterali.filter((t) => new RegExp(`["'\`>]\\s*${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*["'\`<]`).test(srcG)));
  c("nessun tracciamento diretto (`fbq`, `ttq`, `gtag`) e nessuna sfocatura dello sfondo nel guscio", [false, false], [/\b(fbq|ttq|gtag)\b/.test(srcG), /backdrop-|blur/.test(srcG)]);
  c("`shop.tsx`: la modalità si legge ancora UNA volta (`modalitaCatalogo(`) e `beforeLoad` non è cambiato nel contesto restituito", [1, true], [conta(srcShop, "modalitaCatalogo("), /return collaudo \? \{ modalita, collaudo: true as const \} : \{ modalita \};/.test(srcShop)]);
  c("`shop.tsx`: il ramo di oggi è ancora lì (`Header`, `ShopFooter`, `BarraShop`, `Toaster`) e `GuscioShop` vive in un file suo", [true, true, true, true, true], ["<Header />", "<ShopFooter", "<BarraShop", "<Toaster />", "export function GuscioShop"].map((s) => (srcShop + srcG).includes(s)));
}
