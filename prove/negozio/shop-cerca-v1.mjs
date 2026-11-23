/** ── VETRINA V1 · T96 · LA PAGINA DEI RISULTATI (`/shop/cerca?q=`) ───────────────────────────────────────────────
 *  `src/components/shop/pagine/PaginaCerca.tsx` e `src/routes/shop.cerca.tsx`. Criterio V1-C4 e le note del capo progetto dopo l'onda W3:
 *   · la pagina risponde per nome e per SKU, da 2 caratteri, senza badare a maiuscole e accenti;
 *   · senza risultati: `StatoVuoto` («Non troviamo “{testo}”…») più i 4 prodotti della vetrina, mai una pagina vuota; con meno di 2 caratteri
 *     niente «non troviamo», solo il campo e i 4 prodotti;
 *   · `noindex`; con il catalogo `codice` la pagina non esiste (`notFound`, come oggi);
 *   · `Search` (D90) lo emette SOLO l'header: la pagina e la rotta non chiamano mai `emettiEvento` né nessun tracciamento (prova di sorgente);
 *   · privacy: il testo cercato non va al server (il caricamento chiama `elencoProdotti` senza `q`, senza `loaderDeps`), non entra nel titolo
 *     della pagina, non va in nessun log;
 *   · `validateSearch` riduce `q` a testo (il router converte `2024`, `true`, `[1]`, `1e3` in numeri, booleani, liste) e lo taglia a 80;
 *   · `q` si codifica come fa il router (`a&b#c%` torna uguale) e finisce nella pagina solo come testo (mai HTML);
 *   · la pagina non monta il guscio (header, piè, barre: sono di T93) e ogni parola viene da `testi-shop.ts`.
 *  Disegnata davvero (esbuild + react-dom/server, aiuti di `_rende.mjs`) con dati inventati, nessuna rete. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CATALOGO, INVISIBLE_DERM, trovaParoleVietate } from "./_dati-vetrina.mjs";
import { gestore, rendi } from "./_rende.mjs";

const requireQui = createRequire(import.meta.url);
const PAGINA = "src/components/shop/pagine/PaginaCerca.tsx";
const ROTTA = "src/routes/shop.cerca.tsx";

/** Impacchetta un modulo del progetto e ne restituisce le esportazioni (le funzioni pure e i testi). */
function carica(radice, file) {
  const dir = mkdtempSync(join(tmpdir(), "prova-cerca-"));
  try {
    const r = requireQui("esbuild").buildSync({
      entryPoints: [join(radice, file)], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
      alias: { "@": join(radice, "src") }, absWorkingDir: radice, nodePaths: [join(radice, "node_modules")], logLevel: "silent",
    });
    const f = join(dir, "modulo.cjs");
    writeFileSync(f, r.outputFiles[0].text);
    return requireQui(f);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Il testo che si legge in una pagina (senza marcatori, entità rimesse a posto). */
const testo = (html) =>
  html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const conta = (html, re) => (html.match(re) ?? []).length;
const nomiNelleCard = (html) => [...html.matchAll(/<article\b[\s\S]*?<\/article>/g)].map((m) => CATALOGO.find((p) => testo(m[0]).includes(p.nome))?.nome ?? "?");
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const copia = (x) => structuredClone(x);

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T96 · LA PAGINA DEI RISULTATI DELLA RICERCA (23/11/2026)");
  const leggi = (f) => { try { return readFileSync(join(radice, f), "utf8"); } catch { return null; } };
  const sorgente = { pagina: leggi(PAGINA), rotta: leggi(ROTTA) };
  c("i due file di T96 esistono", [], [PAGINA, ROTTA].filter((f) => leggi(f) === null));
  if (!sorgente.pagina || !sorgente.rotta) return;

  const T = carica(radice, "src/landing/testi-shop.ts");
  const { TESTI_SHOP, TESTI_PROVVISORI, riempi } = T;
  const R = carica(radice, "src/shop/cms/vetrina-ricerca.ts");
  const attesi4 = R.quattroDallaVetrina(CATALOGO).map((p) => p.nome);
  const SERVER = (prodotti = CATALOGO) => ({ elencoProdotti: () => prodotti });
  const CMS = { modalita: "cms" };
  /** Disegna la rotta con `q` GIÀ passata da `validateSearch` (come fa il router) e i dati del caricamento. */
  /** Il caricamento VERO della rotta (col server finto che dà `prodotti`): la pagina si disegna con ciò che il browser riceverebbe davvero. */
  const dati = new Map();
  const caricamento = async (prodotti) => {
    if (!dati.has(prodotti)) {
      const r = await rendi(radice, ROTTA, { server: SERVER(prodotti), context: CMS, loaderData: { carte: [], suggeriti: [], guasto: false }, search: { q: "" } });
      dati.set(prodotti, await r.route.loader({ context: CMS, params: {}, search: { q: "" } }));
    }
    return dati.get(prodotti);
  };
  /** Disegna la rotta con `q` GIÀ passata da `validateSearch` (come fa il router) e i dati del caricamento. */
  const pagina = async (q, prodotti = CATALOGO, extra = {}) =>
    rendi(radice, ROTTA, { server: SERVER(prodotti), context: CMS, loaderData: await caricamento(prodotti), ...extra, search: { q } });
  const route = (await rendi(radice, ROTTA, { server: SERVER(), context: CMS, loaderData: { carte: [], suggeriti: [], guasto: false }, search: { q: "" } })).route;
  const vs = (q) => route.validateSearch({ q }).q;

  // ═════════════ SORGENTE: privacy, eventi, guscio, testi ═════════════
  const codice = Object.fromEntries(Object.entries(sorgente).map(([k, s]) => [k, senzaCommenti(s)]));
  for (const [nome, s] of Object.entries(codice)) {
    c(`${nome}: nessun evento, nessun tracciamento (`+"`Search` lo emette solo l'header, D90)", [], [
      [/emettiEvento/, "emettiEvento"], [/emettiSoloContatore/, "emettiSoloContatore"], [/["'`]Search["'`]/, "«Search»"], [/lib\/tracciamento/, "lib/tracciamento"],
      [/landing\/consulenza\/eventi/, "traccia"], [/\b(?:fbq|ttq|gtag)\b/, "fbq/ttq/gtag"], [/vetrina-eventi/, "vetrina-eventi"],
    ].filter(([re]) => re.test(s)).map(([, n]) => n));
    c(`${nome}: il testo cercato non va in log, rete o memoria del browser`, [], [
      [/\bconsole\b/, "console"], [/\bfetch\s*\(/, "fetch"], [/XMLHttpRequest|sendBeacon/, "beacon"], [/localStorage|sessionStorage|document\.cookie/, "memoria del browser"],
    ].filter(([re]) => re.test(s)).map(([, n]) => n));
    c(`${nome}: né «{{» né «da confermare»`, [], trovaParoleVietate(s));
  }
  c("la pagina non monta il guscio (è di T93): niente header, piè, barre, ricerca dell'header", [], [/guscio\//, /GuscioShop|ShopHeader|FooterShop|BarreFisse|BarraConsulenza|RicercaShop/].filter((re) => re.test(codice.pagina + codice.rotta)).map(String));
  c("nessun testo scritto a mano: né fra i marcatori né negli attributi (tutto da `testi-shop.ts`)", [], [
    ...(codice.pagina.match(/>\s*[A-Za-zÀ-ÿ][^<>{}=;()]*</g) ?? []),
    ...(codice.pagina.match(/(?:aria-label|placeholder|title|alt)="[^"{]*[A-Za-zÀ-ÿ]{3}[^"]*"/g) ?? []),
  ]);
  c("la pagina legge i testi da `testi-shop`", true, /@\/landing\/testi-shop/.test(codice.pagina));
  c("la rotta: `noindex` nella testata e nell'intestazione, `notFound` con `codice`, nessun `loaderDeps`", [true, true, true, false], [
    /name:\s*"robots"[^}]*noindex/.test(codice.rotta), /"X-Robots-Tag":\s*"noindex/.test(codice.rotta), /notFound\(\)/.test(codice.rotta), /loaderDeps/.test(codice.rotta),
  ]);
  c("l'indirizzo non si costruisce a mano (lo codifica il router): niente `?q=`, `encodeURI*`, `href:` verso la ricerca", [], [/\?q=/, /encodeURI/, /href:\s*[`"']\/shop\/cerca/].filter((re) => re.test(codice.pagina + codice.rotta)).map(String));
  c("design: niente sfocature, grigi di Tailwind, testo bianco spento, bordi laterali colorati, ombre", [], [
    /backdrop-|blur-|bg-(?:gray|zinc|slate|neutral|stone)-|text-white\/(?:[0-5]\d|[0-9])\b|border-[lr]-\d|border-[lr]-\[|shadow-/,
  ].filter((re) => re.test(codice.pagina)).map(String));
  c("layout: margini `px-4 min-[360px]:px-6`, nessun antenato con `overflow`, un solo H1, niente `<main>` (lo dà il guscio)", [true, false, 1, false], [
    /\bpx-4\b[^"]*\bmin-\[360px\]:px-6\b/.test(codice.pagina), /overflow-/.test(codice.pagina), conta(codice.pagina, /<h1\b/g), /<main\b/.test(codice.pagina),
  ]);

  // ═════════════ LA ROTTA ═════════════
  // `validateSearch`: il router converte i valori che sembrano numeri, booleani, liste; la pagina vuole sempre un testo
  c("validateSearch: un testo resta com'è", ["alfa", "a&b#c%", "mario rossi"], [vs("alfa"), vs("a&b#c%"), vs("mario rossi")]);
  c("validateSearch: 2024 (numero) → «2024»", "2024", vs(2024));
  c("validateSearch: true → «true»; false → «false»", ["true", "false"], [vs(true), vs(false)]);
  c("validateSearch: 1e3 (il router lo legge 1000) → «1000»", "1000", vs(1e3));
  c("validateSearch: [1] e {a:1} sono testo (vuoto), mai «[object Object]»", ["string", "string", "", ""], [typeof vs([1]), typeof vs({ a: 1 }), vs({ a: 1 }), vs([1, 2])]);
  c("validateSearch: assente, null, undefined → testo vuoto", ["", "", ""], [route.validateSearch({}).q, vs(null), vs(undefined)]);
  c("validateSearch: tagliato a 80 caratteri", [80, 80], [vs("x".repeat(500)).length, vs("é".repeat(81)).length]);
  c("validateSearch: restituisce solo `q` (nessun'altra chiave passa)", ["q"], Object.keys(route.validateSearch({ q: "a", filtro: "b", disp: 1 })));
  // la codifica: il router vero scrive e rilegge `a&b#c%` senza perdere niente
  const { defaultParseSearch, defaultStringifySearch } = await import("@tanstack/react-router").catch(() => ({}));
  if (defaultParseSearch) {
    for (const t of ["a&b#c%", "a b+c", "è/ü ?=", "2024", "true", "1e3"]) {
      const scritto = defaultStringifySearch({ q: t });
      const riletto = route.validateSearch(defaultParseSearch(scritto)).q;
      c(`codifica del router: «${t}» → ${scritto} → torna uguale (un testo scritto dalla pagina arriva fra virgolette: resta testo)`, [t, false], [riletto, /[#&]/.test(scritto.slice(3))]);
    }
  } else c("il router vero si carica per la prova di codifica", true, false);

  // il caricamento: nessun testo cercato verso il server, `notFound` con `codice`, un guasto non rompe la pagina
  const l = await rendi(radice, ROTTA, { server: SERVER(), context: CMS, loaderData: { carte: [], suggeriti: [], guasto: false }, search: { q: "mario rossi" } });
  const risposta = await l.route.loader({ context: CMS, deps: { q: "mario rossi" }, params: {}, search: { q: "mario rossi" } });
  c("loader (cms): un solo `elencoProdotti`, senza `q`, e nient'altro", [["elencoProdotti"], [[{ data: {} }]]], [l.pagina.chiamate, l.pagina.chiamateArgs]);
  c("loader: il testo cercato non compare in nessun argomento", false, JSON.stringify(l.pagina.chiamateArgs).includes("mario"));
  c("loader: dà una card per prodotto, le 4 patch dello stato vuoto e `guasto` falso", [CATALOGO.length, attesi4, false], [risposta?.carte?.length, risposta?.suggeriti?.map((x) => x.nome), risposta?.guasto]);
  // peso (V1-T14): al browser non arriva nessun prodotto intero, solo le card leggere
  const CAMPI_CARD = ["slug", "nome", "riga", "prezzoCent", "prezziDiversi", "foto", "fotoAlt", "nColori", "conVarianti", "aggiungibile", "disponibile", "senzaPrezzo", "skuVarianti"].sort();
  const tutteLeCard = [...risposta.carte, ...risposta.suggeriti];
  c("loader: ogni card ha i soli campi della card leggera (nessun campo del prodotto intero)", [], [...new Set(tutteLeCard.flatMap((x) => Object.keys(x)))].filter((k) => !CAMPI_CARD.includes(k)));
  c("loader: nessun testo del prodotto intero (descrizione lunga, FAQ, passi, SEO, correlato, foto 1600, prezzi delle varianti)", [], ["Descrizione lunga", "Domanda di prova", "Primo passo", "titolo di prova", "-1600.webp", "correlato", "descrizioneLunga", "varianti\":"].filter((t) => JSON.stringify(risposta).includes(t)));
  c("loader: quello che va al browser pesa meno di un quarto dei prodotti interi", true, JSON.stringify(risposta).length * 4 < JSON.stringify(CATALOGO).length);
  c("loader: le 4 patch dello stato vuoto sono le stesse di `quattroDallaVetrina` (non cambia niente per la pagina)", true, JSON.stringify(risposta.suggeriti.map((x) => x.slug)) === JSON.stringify(R.quattroDallaVetrina(CATALOGO).map((x) => x.slug)));
  const lc = await rendi(radice, ROTTA, { server: SERVER(), context: { modalita: "codice" }, loaderData: { carte: [], suggeriti: [], guasto: false }, search: { q: "alfa" } });
  c("loader (codice): `notFound`, e non chiama il server", ["notFound", []], await lc.route.loader({ context: { modalita: "codice" }, params: {}, search: { q: "alfa" } }).then(() => ["nessun errore", lc.pagina.chiamate], (e) => [e?.message, lc.pagina.chiamate]));
  const lg = await rendi(radice, ROTTA, { server: { elencoProdotti: () => { throw new Error("rete"); } }, context: CMS, loaderData: { carte: [], suggeriti: [], guasto: true }, search: { q: "alfa" } });
  const guasto = await lg.route.loader({ context: CMS, params: {}, search: { q: "alfa" } });
  c("loader: se il server non risponde la pagina non si rompe (`guasto`, nessuna card)", [[], [], true], [guasto?.carte, guasto?.suggeriti, guasto?.guasto]);
  const testa = route.head({ match: { context: CMS } });
  c("testata: `noindex`, titolo del documento, e nessun testo cercato", [true, TESTI_PROVVISORI.cerca.metaTitolo, false], [
    testa.meta.some((m) => m.name === "robots" && /noindex/.test(m.content)), testa.meta.find((m) => m.title)?.title, JSON.stringify(route.head({ match: { context: CMS }, params: {}, search: { q: "mario rossi" } })).includes("mario"),
  ]);
  c("intestazioni: `X-Robots-Tag: noindex` sul documento", true, /noindex/.test(route.headers?.({ matches: [] })?.["X-Robots-Tag"] ?? ""));

  // ═════════════ LA PAGINA: con risultati ═════════════
  const a = await pagina("alfa");
  const A = a.html;
  c("«alfa»: una sola card, quella di Patch di prova Alfa", [["Patch di prova Alfa"]], [nomiNelleCard(A)]);
  c("«alfa»: un solo H1 con «Risultati per “alfa”» (dal testo del documento)", [1, riempi(TESTI_PROVVISORI.cerca.titolo, { testo: "alfa" })], [conta(A, /<h1\b/g), testo(A.match(/<h1\b[\s\S]*?<\/h1>/)?.[0] ?? "")]);
  c("«alfa»: nessuno stato vuoto, nessun suggerimento", [0, false], [conta(A, /data-stato="vuoto"/g), testo(A).includes(TESTI_SHOP.header.patch + " ")]);
  c("«alfa»: «1 prodotto» in una regione che si legge a voce", [1, true], [conta(A, /role="status"/g) >= 1 ? 1 : 0, testo(A).includes(TESTI_PROVVISORI.filtri.unProdotto)]);
  c("«alfa»: nessun evento (la pagina non emette `Search`)", [[], []], [a.pagina.eventi, a.pagina.contatori ?? []]);
  const cp = await pagina("patch");
  c("«patch»: le cinque patch, e il conteggio al plurale", [5, true], [conta(cp.html, /<article\b/g), testo(cp.html).includes(riempi(TESTI_PROVVISORI.filtri.numero, { n: 5 }))]);
  c("«patch»: prima chi ha il nome che comincia così, nell'ordine dell'elenco", ["Patch di prova Alfa", "Patch di prova Beta"], nomiNelleCard(cp.html).slice(0, 2));
  c("per SKU, senza badare a maiuscole: «pat-beta» e «PAT-BETA-02»", [["Patch di prova Beta"], ["Patch di prova Beta"]], [nomiNelleCard((await pagina("pat-beta")).html), nomiNelleCard((await pagina("PAT-BETA-02")).html)]);
  c("senza badare agli accenti e agli spazi in più: «  ALFÀ  »", [["Patch di prova Alfa"]], [nomiNelleCard((await pagina("  ALFÀ  ")).html)]);
  const inv = await pagina("invisible");
  c("Invisible Derm si trova, con «Scopri» e senza nessuna cifra", [[INVISIBLE_DERM.nome], true, false], [nomiNelleCard(inv.html), testo(inv.html).includes(TESTI_PROVVISORI.card.scopri), /\d\s?€|€\s?\d/.test(testo(inv.html))]);

  // cercare cifre: il router le dà come numeri, `validateSearch` le rimette testo, e la ricerca le trova
  const conCifre = copia(CATALOGO);
  conCifre.find((p) => p.slug === "kit-prova").varianti[0].sku = "2024-A";
  conCifre.find((p) => p.slug === "balsamo-prova").varianti[0].sku = "1000-B";
  c("cifre (numero dal router): 2024 trova lo SKU «2024-A»", [["Kit di prova"]], [nomiNelleCard((await pagina(vs(2024), conCifre)).html)]);
  c("cifre (1e3 → 1000): trova lo SKU «1000-B»", [["Balsamo di prova"]], [nomiNelleCard((await pagina(vs(1e3), conCifre)).html)]);
  const vero = await pagina(vs(true));
  c("«true» (booleano dal router): la pagina si disegna, dice «non troviamo»", [1, true], [conta(vero.html, /data-stato="vuoto"/g), testo(vero.html).includes("“true”")]);

  // ═════════════ LA PAGINA: senza risultati ═════════════
  const z = await pagina("zzzz");
  const Z = z.html;
  c("senza risultati: lo stato vuoto con la frase del documento", [1, riempi(TESTI_SHOP.microtesti.ricercaVuota, { testo: "zzzz" })], [conta(Z, /data-stato="vuoto"/g), testo(Z.match(/<div data-stato="vuoto"[\s\S]*?<\/h2>/)?.[0] ?? "")]);
  c("senza risultati: PIÙ i 4 prodotti della vetrina, in ordine (solo patch che si comprano, con foto)", attesi4, nomiNelleCard(Z));
  c("senza risultati: i 4 stanno SOTTO lo stato vuoto, con un titolo («Patch pronte»)", [true, true], [Z.indexOf('data-stato="vuoto"') < Z.indexOf("<article"), /<h2\b[^>]*>\s*Patch pronte\s*<\/h2>/.test(Z)]);
  c("senza risultati: nessuna cifra di Invisible Derm, e nessuna card che non si può comprare", [false, false], [testo(Z).includes(INVISIBLE_DERM.nome), testo(Z).includes("Epsilon")]);
  c("senza risultati: un solo H1, il titolo con il testo cercato", [1, true], [conta(Z, /<h1\b/g), testo(Z).includes(riempi(TESTI_PROVVISORI.cerca.titolo, { testo: "zzzz" }))]);
  c("senza risultati: ogni card porta alla sua scheda", attesi4.map((n) => `/shop/prodotto/${CATALOGO.find((p) => p.nome === n).slug}`), [...Z.matchAll(/<article\b[\s\S]*?<a\b[^>]*?href="([^"]*)"/g)].map((m) => m[1]));
  for (const [chi, q] of [["vuoto", ""], ["un solo carattere", "a"], ["solo spazi", "   "]]) {
    const p = await pagina(q);
    c(`${chi}: niente «non troviamo», il campo e i 4 prodotti`, [0, 1, attesi4, TESTI_PROVVISORI.guscio.cerca], [conta(p.html, /data-stato="vuoto"/g), conta(p.html, /<input\b/g), nomiNelleCard(p.html), testo(p.html.match(/<h1\b[\s\S]*?<\/h1>/)?.[0] ?? "")]);
  }
  const v = await pagina("alfa", []);
  c("nessun prodotto in catalogo: lo stato vuoto, nessuna card, nessun errore", [1, 0, false], [conta(v.html, /data-stato="vuoto"/g), conta(v.html, /<article\b/g), testo(v.html).includes(TESTI_SHOP.header.patch + " ")]);
  const g = await pagina("alfa", [], { loaderData: { carte: [], suggeriti: [], guasto: true } });
  c("il server non ha risposto: dice che è un problema nostro, con «Riprova», e non «non troviamo»", [true, true, false], [
    testo(g.html).includes(TESTI_SHOP.err500.titolo), testo(g.html).includes(TESTI_PROVVISORI.errore.riprova), testo(g.html).includes("Non troviamo"),
  ]);
  c("…«Riprova» riprova davvero (non lancia)", "ok", (() => { try { gestore(g.pagina, "button", TESTI_PROVVISORI.errore.riprova)(); return "ok"; } catch (e) { return String(e); } })());

  // ═════════════ IL CAMPO ═════════════
  const campo = A.match(/<input\b[^>]*>/)?.[0] ?? "";
  const attr = (t, n) => (t.match(new RegExp(`\\s${n}="([^"]*)"`, "i")) ?? [])[1];
  c("campo: `type=search`, `name=q`, nome dal documento, segnaposto dal documento, 16 px e 48 px, senza correzione automatica", [true, true, true, true, true, true, true], [
    attr(campo, "type") === "search", attr(campo, "name") === "q", attr(campo, "aria-label") === TESTI_PROVVISORI.guscio.cerca, attr(campo, "placeholder") === TESTI_SHOP.header.ricerca,
    /\btext-base\b/.test(attr(campo, "class") ?? ""), /\bh-12\b/.test(attr(campo, "class") ?? ""), attr(campo, "autocomplete") === "off",
  ]);
  c("campo: si riempie con ciò che si è cercato (anche dopo la ricarica)", "alfa", attr(campo, "value"));
  const form = A.match(/<form\b[^>]*>/)?.[0] ?? "";
  c("modulo: `role=search`, GET verso /shop/cerca (funziona anche prima che parta lo script)", ["search", "/shop/cerca", "get"], [attr(form, "role"), attr(form, "action"), attr(form, "method")?.toLowerCase()]);
  c("modulo: il tasto è «Cerca» da 44 px o più", [true, true], [testo(A.match(/<button\b[^>]*type="submit"[\s\S]*?<\/button>/)?.[0] ?? "") === TESTI_PROVVISORI.guscio.cerca, /\bmin-h-11\b|\bh-12\b|\bh-11\b/.test(A.match(/<button\b[^>]*type="submit"[^>]*>/)?.[0] ?? "")]);
  // l'invio: il testo va al router come OGGETTO (lo codifica lui), compattato; sotto i 2 caratteri non succede niente
  const invia = async (valore) => {
    const p = await pagina("alfa");
    let fermato = false;
    const submit = gestore(p.pagina, "form");
    submit({ preventDefault: () => (fermato = true), currentTarget: { elements: { namedItem: () => ({ value: valore }) } } });
    return { naviga: p.pagina.navigazioni ?? [], fermato };
  };
  const i1 = await invia("a&b#c%");
  c("invio «a&b#c%»: preventDefault e navigazione con `search: { q }` (il router codifica)", [true, [{ to: "/shop/cerca", search: { q: "a&b#c%" } }]], [i1.fermato, i1.naviga.map(({ to, search }) => ({ to, search }))]);
  const i2 = await invia("  alfa   beta  ");
  c("invio: spazi compattati e tolti ai bordi", [{ q: "alfa beta" }], [i2.naviga[0]?.search]);
  const i3 = await invia(" a ");
  c("invio sotto i 2 caratteri: non naviga (e non ricarica la pagina)", [[], true], [i3.naviga, i3.fermato]);

  // ═════════════ IL TESTO CERCATO È SOLO TESTO ═════════════
  const x = await pagina('<img src=x onerror=alert(1)>"&');
  c("il testo cercato è escluso da HTML: nessun tag, nessun attributo, solo testo con le entità", [0, false, true], [conta(x.html, /<img src=x/g), /onerror=alert/.test(x.html.replace(/&lt;img src=x onerror=alert\(1\)&gt;/g, "")), x.html.includes("&lt;img src=x onerror=alert(1)&gt;")]);
  const e = await pagina("a&b#c%");
  c("«a&b#c%»: nel titolo, nel campo e nello stato vuoto è il testo vero", [true, "a&amp;b#c%", true], [testo(e.html).includes("“a&b#c%”"), attr(e.html.match(/<input\b[^>]*>/)?.[0] ?? "", "value"), (e.html.match(/data-stato="vuoto"[\s\S]*?<\/h2>/)?.[0] ?? "").includes("a&amp;b#c%")]);
  const lungo = await pagina(vs("x".repeat(500)));
  c("un testo lunghissimo non rompe la pagina (80 caratteri al massimo)", [true, true], [lungo.html.length < 60000, !lungo.html.includes("x".repeat(81))]);

  // ═════════════ REGOLE SU TUTTE LE SCHERMATE ═════════════
  const vuota = await pagina("");
  const disegni = { alfa: a, patch: cp, zzzz: z, vuoto: vuota, nessunProdotto: v, guasto: g, inv };
  const tutte = Object.fromEntries(Object.entries(disegni).map(([n, d]) => [n, d.html]));
  for (const [nome, h] of Object.entries(tutte)) {
    c(`${nome}: un solo H1, nessuna parola vietata, nessun «{{», nessun prezzo barrato`, [1, []], [conta(h, /<h1\b/g), trovaParoleVietate(testo(h))]);
  }
  c("nessuna schermata emette un evento (`Search` è dell'header)", [], Object.entries(disegni).filter(([, d]) => d.pagina.eventi.length > 0 || (d.pagina.contatori ?? []).length > 0).map(([n]) => n));
}
