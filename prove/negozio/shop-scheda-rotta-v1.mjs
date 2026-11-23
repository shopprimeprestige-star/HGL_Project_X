/** ── VETRINA V1 · T97a · LA ROTTA DELLA SCHEDA (`src/routes/shop.prodotto.$slug.tsx`, `RiquadroAnteprima`) ────────────────────────
 *  La pagina nuova (`PaginaScheda`, T97b) la monta la rotta, e la monta SOLO con `cms` nel contesto E `scheda.tipo === "cms"`. Cosa deve valere:
 *   · smistatore: `cms` + scheda `cms` → pagina nuova; `cms` + scheda `codice` (modalità letta male per un attimo) → la pagina di OGGI, identica byte per byte
 *     e SENZA chiamare niente al server; contesto `codice` (o assente) + scheda `cms` → la pagina di oggi (ripiego, come prima);
 *   · loader con `cms`: scheda con la chiave d'anteprima, tariffa, testi del contenuto, cassa (e basta: né `modalitaCatalogo` né `modalitaCertaDelServer`);
 *     un guasto di una delle tre non è un errore; guasto della scheda = errore temporaneo; non trovata (bozza o archiviato senza chiave) = `notFound`;
 *   · `anteprima` è vero SOLO se il server ha riconosciuto la chiave (un `?anteprima=` a caso su un prodotto pubblicato non toglie la vendita);
 *   · con `codice` nessuna delle tre fonti nuove (le chiamate esatte sono nell'oro, `codice-identico-v1.mjs`);
 *   · anteprima: riquadro ambra sopra la pagina, `noindex`, niente bottone d'acquisto, niente JSON-LD; bozza senza chiave = «non trovato»;
 *   · `ViewContent` una volta per prodotto e sessione (gli effetti si fanno girare davvero con un `useEffect` che li ricorda), mai in anteprima né per Invisible
 *     Derm; `AddToCart` NON lo emette la rotta (lo emette `useAcquisto`, una volta per clic);
 *   · 404 e 500 con `cms` sono quelli del guscio nuovo (`NonTrovataShop`, `ErroreShop`), con `codice` quelli di oggi; `useStatoPagina` nella pagina nuova;
 *   · `RiquadroAnteprima`: `<details>` chiuso, un motivo per riga, nulla senza motivi.
 *  Come si prova: `rendi` (la rotta vera impacchettata con i finti del router, del carrello e del server) e `rendiComponente`. Gli effetti di React non
 *  girano in `react-dom/server`: i soli `useEffect` si fanno ricordare con un `react` finto (`REACT_CHE_RICORDA`) e si eseguono qui con `window` finto.
 *  Il fuoco, il telefono e il guscio vero (barra assente su 404/500) sono [M]/[T]: li guardano T103c e T106. Dati inventati, nessuna rete. */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rendi, rendiComponente } from "./_rende.mjs";
import * as D from "./_dati-vetrina.mjs";

const requireQui = createRequire(import.meta.url);
const FILE = "src/routes/shop.prodotto.$slug.tsx";
const COMPONENTE_NUOVO = "src/components/shop/scheda/RiquadroAnteprima.tsx";

/** `testi-shop.ts` non è in `MODULI` di `prove.mjs`: lo carico io (come `shop-barre.mjs`), mai da `mod[...]`. */
async function carica(radice, file) {
  const esbuild = requireQui("esbuild");
  const dir = mkdtempSync(join(tmpdir(), "prova-rotta-scheda-"));
  try {
    const entrata = join(dir, "entrata.ts");
    writeFileSync(entrata, `export * from ${JSON.stringify(join(radice, file))};`);
    const r = await esbuild.build({
      entryPoints: [entrata], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
      alias: { "@": join(radice, "src") }, absWorkingDir: radice, nodePaths: [join(radice, "node_modules")], logLevel: "silent",
      define: { "import.meta.env": JSON.stringify({ DEV: false, PROD: true, SSR: true }) },
    });
    const uscita = join(dir, "caricato.cjs");
    writeFileSync(uscita, r.outputFiles[0].text);
    return requireQui(uscita);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const COPIA = (x) => structuredClone(x);
/** Un testo come lo scrive React nell'HTML (apostrofi e virgolette diventano entità). */
const HTML = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
const CARRELLO = { add() {}, lines: [], count: 0 };
const CASSA = { cassa: "vecchia", sicuro: false, metodi: [] };
const TESTI_VUOTI = { testi: {}, media: {} };
/** Una prova non lancia MAI (fermerebbe tutta la suite): un'eccezione è un rosso con il suo nome. */
const FALLITO = (e) => ({ html: `<<eccezione: ${e?.message ?? e}>>`, route: { head: () => ({}), headers: () => ({}), loader: async () => { throw e; } }, pagina: { chiamate: [`ECCEZIONE ${e?.message ?? e}`], chiamateArgs: [], eventi: [], tracce: [], effetti: [] } });
/** Un lancio che deve fallire: restituisce il messaggio dell'errore, o «NESSUN ERRORE». */
const messaggio = async (f) => { try { await f(); return "NESSUN ERRORE"; } catch (e) { return e?.message ?? String(e); } };

export async function prove(mod, { c, gruppo, radice }) {
  try {
    await corpo(mod, { c, gruppo, radice });
  } catch (e) {
    c("la prova non lancia eccezioni", "nessuna eccezione", String(e?.stack ?? e).slice(0, 300));
  }
}

async function corpo(mod, { c, gruppo, radice }) {
  /** Un blocco che lancia è un rosso nominato, e gli altri blocchi girano lo stesso. */
  const blocco = async (nome, f) => { try { await f(); } catch (e) { c(`${nome}: non lancia eccezioni`, "nessuna eccezione", String(e?.message ?? e).slice(0, 200)); } };
  gruppo("VETRINA V1 · T97a · ROTTA DELLA SCHEDA, LOADER, ANTEPRIMA (23/11/2026)");
  const TS = await carica(radice, "src/landing/testi-shop.ts");
  const { TESTI_SHOP, TESTI_PROVVISORI } = TS;
  const src = readFileSync(join(radice, FILE), "utf8");
  const codice = senzaCommenti(src);
  const catalogo = readFileSync(join(radice, "src/shop/catalog.ts"), "utf8");
  const SLUG_CODICE = [...catalogo.matchAll(/\bid: "(\w+)", slug: "([a-z0-9-]+)"/g)].map((m) => m[2])[0];

  const per = (slug) => COPIA(D.CATALOGO.find((p) => p.slug === slug));
  const patch = per("patch-prova-alfa");
  const patch2 = per("patch-prova-beta");
  const invisible = per("invisible-derm-prova");
  const conAnteprima = (p, nascosti = [{ blocco: "foto", motivo: "Manca la descrizione della foto." }, { blocco: "scheda", motivo: "Nessun dato nella scheda tecnica." }]) => ({ ...COPIA(p), anteprima: { nascosti } });
  const bozza = conAnteprima(patch);
  const datiCms = (p, extra = {}) => ({ scheda: { tipo: "cms", prodotto: p }, anteprima: Boolean(p.anteprima), tariffa: D.TARIFFA_OK, testi: TESTI_VUOTI, cassa: CASSA, ...extra });
  const CMS = { modalita: "cms" };

  /** La rotta disegnata (o, con `componente`, solo caricata). `server: {}` = ogni chiamata al server non dichiarata LANCIA. */
  const pagina = (slug, loaderData, extra = {}) => rendi(radice, FILE, { params: { slug }, loaderData, context: CMS, carrello: CARRELLO, server: {}, ...extra }).catch(FALLITO);
  const soloRotta = (server = {}, extra = {}) => rendi(radice, FILE, { componente: "notFoundComponent", context: CMS, server, ...extra }).catch(FALLITO);

  // ── lo smistatore (disegno vero) ──
  const nuova = await pagina(patch.slug, datiCms(patch));
  const MARCA_NUOVA = TESTI_PROVVISORI.galleria.etichetta; // la galleria nuova ha questo nome per chi usa lo schermo parlato
  c("smistatore: `cms` + scheda `cms` → la pagina NUOVA (galleria, blocco d'acquisto), senza «Acquista ora» di oggi", [true, false, true], [nuova.html.includes(MARCA_NUOVA), nuova.html.includes("Acquista ora"), nuova.html.includes(patch.nome)]);
  c("smistatore: la pagina nuova non chiama il server (ogni chiamata non dichiarata lancia)", [], nuova.pagina.chiamate);

  const oggiSenza = await rendi(radice, FILE, { params: { slug: SLUG_CODICE }, loaderData: { scheda: { tipo: "codice" }, anteprima: false }, carrello: CARRELLO, server: {} }).catch(FALLITO);
  const cmsMaCodice = await pagina(SLUG_CODICE, { scheda: { tipo: "codice" }, anteprima: false });
  c("smistatore: `cms` nel contesto + `scheda.tipo: \"codice\"` → il componente di OGGI, byte per byte uguale al disegno senza contesto", [true, true, false], [cmsMaCodice.html === oggiSenza.html, cmsMaCodice.html.includes("Acquista ora"), cmsMaCodice.html.includes(MARCA_NUOVA)]);
  c("smistatore: `cms` + `tipo: \"codice\"` → nessuna chiamata a funzioni server (né nuove né vecchie)", [], cmsMaCodice.pagina.chiamate);

  const ripiego = await rendi(radice, FILE, { params: { slug: patch.slug }, loaderData: datiCms(patch, { tariffa: undefined, testi: undefined, cassa: undefined }), context: { modalita: "codice" }, carrello: CARRELLO, server: {} }).catch(FALLITO);
  const senzaContesto = await rendi(radice, FILE, { params: { slug: patch.slug }, loaderData: datiCms(patch), carrello: CARRELLO, server: {} }).catch(FALLITO);
  c("smistatore: contesto `codice` (o assente) + scheda `cms` (modalità letta male, poi certa) → la pagina di oggi, non la nuova", [false, false, true, true], [ripiego.html.includes(MARCA_NUOVA), senzaContesto.html.includes(MARCA_NUOVA), ripiego.html.includes("Acquista ora"), senzaContesto.html.includes("Acquista ora")]);
  const corpoComponente = codice.slice(codice.indexOf("function ProductDetail("), codice.indexOf("function SchedaNuova("));
  c("sorgente: la riga dello smistatore controlla `modalita === \"cms\"` E `scheda.tipo === \"cms\"`", [true, true, true], [/modalita === "cms" && dati\.scheda\.tipo === "cms"/.test(corpoComponente), /<SchedaNuova /.test(corpoComponente), /<SchedaVista /.test(corpoComponente)]);

  // ── il loader ──
  const slug = patch.slug;
  const fonti = (extra = {}) => ({
    schedaProdotto: () => ({ esito: "trovato", prodotto: patch }),
    tariffaSpedizione: () => D.TARIFFA_OK,
    contenutoShop: () => TESTI_VUOTI,
    cassaPubblica: () => CASSA,
    ...extra,
  });
  await blocco("blocco 1", async () => {
    const { route, pagina: p } = await soloRotta(fonti());
    const v = await route.loader({ params: { slug }, deps: { anteprima: "" }, context: CMS });
    c("loader `cms`: le quattro fonti (scheda, tariffa, testi, cassa) e basta: né `modalitaCatalogo` né `modalitaCertaDelServer`", ["cassaPubblica", "contenutoShop", "schedaProdotto", "tariffaSpedizione"], [...p.chiamate].sort());
    c("loader `cms`: il valore è `{scheda, anteprima: false, tariffa, testi, cassa}` con i dati del server", [["anteprima", "cassa", "scheda", "tariffa", "testi"], "cms", patch.slug, false, D.TARIFFA_OK, CASSA], [Object.keys(v).sort(), v.scheda.tipo, v.scheda.prodotto.slug, v.anteprima, v.tariffa, v.cassa]);
  });
  await blocco("blocco 2", async () => {
    // la chiave d'anteprima arriva al server; ?anteprima= a caso su un prodotto pubblicato NON è anteprima (il server non l'ha riconosciuta)
    const { route, pagina: p } = await soloRotta(fonti());
    const v = await route.loader({ params: { slug }, deps: { anteprima: "chiave-a-caso" }, context: CMS });
    c("loader `cms`: `?anteprima=` NON riconosciuta dal server (prodotto pubblicato) → `anteprima: false`, la scheda si vende", [false, "chiave-a-caso"], [v.anteprima, p.chiamateArgs[p.chiamate.indexOf("schedaProdotto")]?.[0]?.data?.chiave]);
    const r2 = await soloRotta(fonti({ schedaProdotto: () => ({ esito: "trovato", prodotto: bozza }) }));
    const v2 = await r2.route.loader({ params: { slug }, deps: { anteprima: "chiave-vera" }, context: CMS });
    c("loader `cms`: chiave riconosciuta (la scheda porta `anteprima`) → `anteprima: true`, la bozza si vede", [true, ["foto", "scheda"]], [v2.anteprima, v2.scheda.prodotto.anteprima.nascosti.map((n) => n.blocco)]);
  });
  c("loader `cms`: bozza o archiviato senza chiave (il server dice «non_trovato») → `notFound` (404), non una pagina", "notFound", await messaggio(async () => (await soloRotta(fonti({ schedaProdotto: () => ({ esito: "non_trovato" }) }))).route.loader({ params: { slug: "bozza" }, deps: { anteprima: "" }, context: CMS })));
  c("loader `cms`: guasto del server sulla scheda → errore temporaneo (500), mai «non trovato»", ["catalogo-temporaneamente-non-raggiungibile", "catalogo-temporaneamente-non-raggiungibile"], [
    await messaggio(async () => (await soloRotta(fonti({ schedaProdotto: () => ({ esito: "guasto" }) }))).route.loader({ params: { slug }, deps: { anteprima: "" }, context: CMS })),
    await messaggio(async () => (await soloRotta(fonti({ schedaProdotto: () => { throw new Error("rete"); } }))).route.loader({ params: { slug }, deps: { anteprima: "" }, context: CMS })),
  ]);
  await blocco("blocco 3", async () => {
    const guasta = (n) => () => { throw new Error(`guasto ${n}`); };
    const { route } = await soloRotta(fonti({ tariffaSpedizione: guasta("tariffa"), contenutoShop: guasta("contenuto"), cassaPubblica: guasta("cassa") }));
    const v = await route.loader({ params: { slug }, deps: { anteprima: "" }, context: CMS });
    c("loader `cms`: un guasto di tariffa, testi o cassa NON è un errore al pubblico: tariffa e cassa `null`, testi vuoti, la scheda c'è", ["cms", null, null, TESTI_VUOTI], [v.scheda.tipo, v.tariffa, v.cassa, v.testi]);
    const uno = await soloRotta(fonti({ cassaPubblica: guasta("cassa") }));
    const v1 = await uno.route.loader({ params: { slug }, deps: { anteprima: "" }, context: CMS });
    c("loader `cms`: un guasto solo non toglie le altre (tariffa e testi restano)", [D.TARIFFA_OK, TESTI_VUOTI, null], [v1.tariffa, v1.testi, v1.cassa]);
  });
  await blocco("blocco 4", async () => {
    // la scheda che non c'è non lascia nulla di non gestito: le tre fonti in volo non lanciano errori non catturati
    const r = await soloRotta(fonti({ schedaProdotto: () => ({ esito: "non_trovato" }), tariffaSpedizione: () => { throw new Error("giù"); } }));
    c("loader `cms`: scheda non trovata con una fonte che lancia → ancora `notFound` (nessun errore non catturato)", "notFound", await messaggio(() => r.route.loader({ params: { slug }, deps: { anteprima: "" }, context: CMS })));
  });
  await blocco("blocco 5", async () => {
    // con `codice`: modalità certa «cms» per un guasto passato (oro) → la scheda arriva SENZA le tre fonti nuove
    const r = await soloRotta(fonti({ modalitaCertaDelServer: () => "cms", modalitaCatalogo: () => "codice" }), { context: { modalita: "codice" } });
    const v = await r.route.loader({ params: { slug: "solo-cms" }, deps: { anteprima: "" }, context: { modalita: "codice" } });
    c("loader `codice` con scheda CMS (modalità certa «cms»): `{scheda, anteprima}` come oggi e NESSUNA delle tre fonti nuove", [["anteprima", "scheda"], false, ["modalitaCatalogo", "schedaProdotto", "modalitaCertaDelServer"]], [Object.keys(v).sort(), v.anteprima, r.pagina.chiamate]);
    const r2 = await soloRotta({}, { context: { modalita: "codice" } });
    const v2 = await r2.route.loader({ params: { slug: SLUG_CODICE }, deps: { anteprima: "x" }, context: { modalita: "codice" } });
    c("loader `codice`: la scheda del codice chiede solo `modalitaCatalogo`, vale `{ scheda: { tipo: \"codice\" }, anteprima }` (con `?anteprima=` → true, come oggi)", [{ scheda: { tipo: "codice" }, anteprima: true }, ["modalitaCatalogo"]], [v2, r2.pagina.chiamate]);
  });

  // ── l'anteprima, disegnata ──
  const prev = await pagina(patch.slug, datiCms(bozza));
  const iRiquadro = prev.html.indexOf("data-riquadro-anteprima");
  const iPagina = prev.html.indexOf(MARCA_NUOVA);
  c("anteprima: il riquadro ambra («Mostra cosa è nascosto») sta SOPRA la pagina, con un motivo per riga", [true, true, true], [iRiquadro >= 0 && iRiquadro < iPagina, prev.html.includes(TESTI_PROVVISORI.scheda.anteprimaRiquadro), bozza.anteprima.nascosti.every((n) => prev.html.includes(n.motivo))]);
  c("anteprima: MAI vendita: niente «Aggiungi al carrello» né «Acquista ora», c'è la striscia «anteprima»", [false, false, true], [prev.html.includes(TESTI_SHOP.scheda.aggiungi), prev.html.includes("Acquista ora"), prev.html.includes(TESTI_PROVVISORI.scheda.anteprimaStriscia)]);
  c("anteprima: nessuna stella, nessun «Anteprima:» di oggi, nessun JSON-LD nel disegno", [false, false, false], [/lucide-star/.test(prev.html), prev.html.includes("Anteprima: questa scheda"), prev.html.includes("application/ld+json")]);
  c("scheda pubblica: nessun riquadro e il bottone d'acquisto c'è", [false, true], [nuova.html.includes("data-riquadro-anteprima"), nuova.html.includes(TESTI_SHOP.scheda.aggiungi)]);
  const chiaveACaso = await pagina(patch.slug, datiCms(patch, { anteprima: false }));
  c("scheda pubblica vista con un `?anteprima=` a caso (il server non lo riconosce): si vende, nessun riquadro", [true, false], [chiaveACaso.html.includes(TESTI_SHOP.scheda.aggiungi), chiaveACaso.html.includes("data-riquadro-anteprima")]);
  // il riquadro, da solo
  const riquadro = (nascosti) => rendiComponente(radice, COMPONENTE_NUOVO, "RiquadroAnteprima", { nascosti }).then((r) => r.html, (e) => `<<eccezione: ${e?.message}>>`);
  const hR = await riquadro(bozza.anteprima.nascosti);
  c("RiquadroAnteprima: un `<details>` CHIUSO con il titolo come `<summary>`, ambra, un `<li>` per motivo", [true, false, true, true, 2], [/<details[^>]*>\s*<summary/.test(hR), /<details[^>]*\sopen/.test(hR), hR.includes("border-amber-300") && hR.includes("bg-amber-50"), hR.includes(TESTI_PROVVISORI.scheda.anteprimaRiquadro), (hR.match(/<li>/g) ?? []).length]);
  //  T100a: due motivi uguali (stesso blocco, stesso testo) sono due righe. ⚠️ `react-dom/server` NON avvisa delle chiavi doppie (lo fa solo il browser): il guardiano della chiave è il controllo di sorgente qui sotto.
  const hDoppi = await riquadro([{ blocco: "faq", motivo: "Manca la risposta." }, { blocco: "faq", motivo: "Manca la risposta." }, { blocco: "faq", motivo: "Manca la risposta." }]);
  c("RiquadroAnteprima: motivi doppi (stesso blocco e stesso testo) = una riga ciascuno", 3, (hDoppi.match(/<li\b/g) ?? []).length);
  c("RiquadroAnteprima: la `key` di ogni riga ha l'indice (sorgente)", true, /<li key=\{`\$\{i\}-\$\{n\.blocco\}`\}>/.test(readFileSync(join(radice, COMPONENTE_NUOVO), "utf8")));
  c("RiquadroAnteprima: senza motivi (assenti, vuoti, nulli, non testo) non si disegna niente", ["", "", "", "", ""], [await riquadro(undefined), await riquadro([]), await riquadro(null), await riquadro([{ blocco: "x", motivo: "  " }, { blocco: "y" }]), await riquadro("non un elenco")]);
  await blocco("blocco 6", async () => {
    const h = await riquadro([{ blocco: "blocco-interno", motivo: "<b>grassetto</b> & altro" }]);
    c("RiquadroAnteprima: `<b>` e `&` nel motivo escono come testo, e il nome interno del blocco non compare", [false, true, false], [/<b>/.test(h), h.includes("&lt;b&gt;grassetto&lt;/b&gt; &amp; altro"), h.includes("blocco-interno")]);
  });

  // ── la testata ──
  const tipo = (x) => (x.meta ?? []).find((m) => m.name === "robots")?.content;
  const meta = (x, k, v) => (x.meta ?? []).find((m) => m[k] === v)?.content;
  await blocco("blocco 7", async () => {
    const { route } = await soloRotta();
    const h1 = route.head({ loaderData: datiCms(patch), match: { status: "success" } });
    const h2 = route.head({ loaderData: datiCms(patch2), match: { status: "success" } });
    c("head: titolo con il nome del prodotto, descrizione, canonico, UN JSON-LD «Product», niente `noindex`", [true, true, 1, undefined], [h1.meta[0].title.includes(patch.nome), Boolean(meta(h1, "name", "description")), h1.scripts.length, tipo(h1)]);
    c("head: immagine di condivisione = la foto principale del prodotto (https, 1600), mai il logo", [patch.media.find((m) => m.slot === "principale").src.w1600], [meta(h1, "property", "og:image")]);
    c("head: due prodotti diversi → titolo, canonico e og:url diversi (meta unici)", [true, true, true], [h1.meta[0].title !== h2.meta[0].title, h1.links[0].href !== h2.links[0].href, meta(h1, "property", "og:url") !== meta(h2, "property", "og:url")]);
    const ha = route.head({ loaderData: datiCms(bozza), match: { status: "success" } });
    c("head, anteprima riconosciuta: `noindex` e NESSUN JSON-LD", ["noindex", 0], [tipo(ha), ha.scripts.length]);
    c("head, scheda non trovata (404): `noindex`, nessun JSON-LD", ["noindex", 0], (() => { const x = route.head({ match: { status: "notFound" } }); return [tipo(x), x.scripts.length]; })());
    c("head, con `codice`: nessuna intestazione nuova (`{}`)", {}, route.head({ loaderData: { scheda: { tipo: "codice" }, anteprima: false }, match: { status: "success" } }));
    c("headers, anteprima riconosciuta: `private, no-store`; scheda pubblica: niente", [{ "Cache-Control": "private, no-store" }, {}], [route.headers({ loaderData: datiCms(bozza), match: { status: "success" } }), route.headers({ loaderData: datiCms(patch), match: { status: "success" } })]);
  });

  // ── 404 e 500 ──
  await blocco("blocco 8", async () => {
    const nt = (context) => rendi(radice, FILE, { componente: "notFoundComponent", context, server: {} }).catch(FALLITO).then((r) => r.html);
    const er = (context) => rendi(radice, FILE, { componente: "errorComponent", context, server: {} }).catch(FALLITO).then((r) => r.html);
    const [ntCms, ntCodice, ntSenza, erCms, erCodice, erSenza] = await Promise.all([nt(CMS), nt({ modalita: "codice" }), nt(undefined), er(CMS), er({ modalita: "codice" }), er(undefined)]);
    c("404 con `cms`: la pagina del guscio nuovo (titolo del documento, «Patch pronte»), non «Prodotto non trovato.» di oggi", [true, true, false], [ntCms.includes("data-pagina-errore"), ntCms.includes(HTML(TESTI_SHOP.err404.titolo)), ntCms.includes("Prodotto non trovato.")]);
    c("404 con `codice` (o senza contesto): quello di oggi, identico", [true, true, true], [ntCodice.includes("Prodotto non trovato.") && ntCodice.includes("Torna al catalogo"), ntCodice === ntSenza, !ntCodice.includes("data-pagina-errore")]);
    c("500 con `cms`: la pagina del guscio nuovo, mai l'errore vero; con `codice`: quella di oggi, identica", [true, true, true, true], [erCms.includes("data-pagina-errore") && erCms.includes(HTML(TESTI_SHOP.err500.titolo)), !erCms.includes("Non riusciamo a mostrarti questo prodotto"), erCodice.includes("Non riusciamo a mostrarti questo prodotto") && erCodice.includes("Riprova"), erCodice === erSenza]);
  });
  c("sorgente: i due componenti di errore sono gli smistatori e il guscio ne mette a posto lo stato (`NonTrovataShop`, `ErroreShop`)", [true, true, true, true], [
    /errorComponent: ErroreScheda/.test(codice), /notFoundComponent: NonTrovataScheda/.test(codice),
    /modalita === "cms" \? <NonTrovataShop \/> : <NonTrovato \/>/.test(codice), /modalita === "cms" \? <ErroreShop error=\{error\} \/> : <ErroreTemporaneo \/>/.test(codice),
  ]);
  c("sorgente: la pagina nuova dice al guscio che non si vende (anteprima, prodotto non acquistabile) con `useStatoPagina`", [true, true], [
    /import \{[^}]*useStatoPagina[^}]*\} from "@\/components\/shop\/guscio\/GuscioShop"/.test(codice),
    /useStatoPagina\(anteprima \|\| !prodotto\.acquistabile \? "non_in_vendita" : "normale"\)/.test(codice),
  ]);

  // ── gli eventi: gli effetti girano davvero ──
  const reale = requireQui.resolve("react", { paths: [radice] });
  const REACT_CHE_RICORDA = `import * as R from ${JSON.stringify(reale)}; export * from ${JSON.stringify(reale)}; export default R.default; export const useEffect = (f) => { (globalThis.__pagina.effetti ??= []).push(f); };`;
  const conEffetti = async (p, { storage = new Map(), nome, bloccato = false } = {}) => {
    const r = await pagina(p.slug, datiCms(p), { finti: { react: REACT_CHE_RICORDA } });
    const vecchi = [globalThis.window, globalThis.document];
    //  `bloccato`: cookie bloccati, già NOMINARE `window.sessionStorage` lancia (SecurityError)
    globalThis.window = bloccato
      ? Object.defineProperty({ addEventListener() {}, removeEventListener() {} }, "sessionStorage", { get() { throw new Error("SecurityError: cookie bloccati"); } })
      : { addEventListener() {}, removeEventListener() {}, sessionStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) } };
    globalThis.document = { querySelector: () => null };
    const lanciati = [];
    try {
      for (const f of r.pagina.effetti ?? []) { try { f(); } catch (e) { lanciati.push(String(e?.message ?? e)); /* gli effetti degli altri pezzi vogliono un browser vero */ } }
    } finally { [globalThis.window, globalThis.document] = vecchi; if (vecchi[0] === undefined) delete globalThis.window; if (vecchi[1] === undefined) delete globalThis.document; }
    void nome;
    r.pagina.lanciati = lanciati;
    return r.pagina;
  };
  await blocco("blocco 9", async () => {
    const storage = new Map();
    const prima = await conEffetti(patch, { storage });
    const ve = prima.eventi.filter(([n]) => n === "ViewContent");
    c("ViewContent: una volta, con lo SKU della variante e il valore in centesimi dal server", [1, [patch.varianti[0].sku], patch.varianti[0].prezzoCent], [ve.length, ve[0]?.[1]?.contentIds, ve[0]?.[1]?.valueCent]);
    const seconda = await conEffetti(patch, { storage });
    c("ViewContent: la seconda visita della stessa scheda nella sessione non lo rimanda", 0, seconda.eventi.filter(([n]) => n === "ViewContent").length);
    c("ViewContent: un altro prodotto nella stessa sessione sì", 1, (await conEffetti(patch2, { storage })).eventi.filter(([n]) => n === "ViewContent").length);
    //  Cookie bloccati: nessuna eccezione negli effetti (sarebbe un 500 della scheda) e l'evento parte comunque, una volta
    const senzaCookie = await conEffetti(patch, { bloccato: true });
    c("cookie bloccati (`window.sessionStorage` lancia): nessun effetto della scheda lancia, `ViewContent` parte una volta", [[], 1], [senzaCookie.lanciati.filter((m) => /SecurityError/.test(m)), senzaCookie.eventi.filter(([n]) => n === "ViewContent").length]);
    c("`AddToCart` non parte dalla visita (parte solo dal clic, da `useAcquisto`)", 0, prima.eventi.filter(([n]) => n === "AddToCart").length);
    c("conteggio interno «scheda vista» una volta, col solo slug; l'anteprima non lo conta", [1, ["stock_vista_scheda", { prodotto: patch.slug }], 0], [prima.tracce.length, prima.tracce[0]?.slice(0, 2), (await conEffetti(bozza)).tracce?.length ?? 0]);
    c("anteprima: nessun `ViewContent`", 0, (await conEffetti(bozza)).eventi.filter(([n]) => n === "ViewContent").length);
    c("Invisible Derm (nessuna cifra, non acquistabile): nessun `ViewContent`", 0, (await conEffetti(invisible)).eventi.filter(([n]) => n === "ViewContent").length);
    c("prodotto senza prezzo (D39: non acquistabile, prezzi `null`): nessun `ViewContent`", 0, (await conEffetti({ ...COPIA(patch), acquistabile: false, prezzoDaCent: null, varianti: patch.varianti.map((v) => ({ ...v, prezzoCent: null })) })).eventi.filter(([n]) => n === "ViewContent").length);
  });
  //  T109c · T103c-2: `emettiEvento` VERO non parte (e non segna) senza consenso: il finto lo imita (`null` finché `consenso` è falso). Il banner si accetta
  //  DOPO l'apertura della scheda: l'evento deve partire alla scelta (come home e categoria, `suScelta`), una volta sola, e nel ramo `codice` niente cambia.
  await blocco("blocco 9b · ViewContent dopo il consenso", async () => {
    const API_CON_CONSENSO = `export const emettiEvento = (n, d) => { const p = globalThis.__pagina; if (!p.consenso) return null; p.eventi.push([n, d]); return "id"; }; export const emettiSoloContatore = () => {}; export const scaricaEventi = async () => {};`;
    /** Apre la scheda (gli effetti girano), dà il consenso quando serve e fa scattare l'attesa di `suScelta` (orologio finto). */
    const apri = async (p, { consensoSubito = false, storage = new Map(), bloccato = false } = {}) => {
      const r = await pagina(p.slug, datiCms(p), { finti: { react: REACT_CHE_RICORDA, "@/lib/tracciamento/api": API_CON_CONSENSO } });
      const ascolti = new Map();
      const attese = [];
      const vecchi = [globalThis.window, globalThis.document, globalThis.setTimeout, globalThis.clearTimeout];
      const archivio = bloccato ? null : { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v) };
      globalThis.window = {
        addEventListener: (n, f) => ascolti.set(n, [...(ascolti.get(n) ?? []), f]),
        removeEventListener: (n, f) => ascolti.set(n, (ascolti.get(n) ?? []).filter((x) => x !== f)),
      };
      if (archivio) globalThis.window.sessionStorage = archivio;
      else Object.defineProperty(globalThis.window, "sessionStorage", { get() { throw new Error("SecurityError: cookie bloccati"); } });
      globalThis.document = { querySelector: () => null };
      globalThis.setTimeout = (f) => { attese.push(f); return attese.length; };
      globalThis.clearTimeout = (id) => { attese[id - 1] = null; };
      r.pagina.consenso = consensoSubito;
      const puliture = [];
      const lanciati = [];
      try {
        for (const f of r.pagina.effetti ?? []) { try { const u = f(); if (typeof u === "function") puliture.push(u); } catch (e) { lanciati.push(String(e?.message ?? e)); } }
      } catch (e) { lanciati.push(String(e?.message ?? e)); }
      const scelta = () => { r.pagina.consenso = true; for (const f of ascolti.get("hgl:consenso") ?? []) f(new Event("x")); for (const f of attese.splice(0)) f?.(); };
      const chiudi = () => { for (const u of puliture) u(); [globalThis.window, globalThis.document, globalThis.setTimeout, globalThis.clearTimeout] = vecchi; if (vecchi[0] === undefined) delete globalThis.window; if (vecchi[1] === undefined) delete globalThis.document; };
      return { r, ascolti, scelta, chiudi, lanciati, vc: () => r.pagina.eventi.filter(([n]) => n === "ViewContent").length };
    };
    // 1. senza consenso: niente, poi la scelta → l'evento parte, con lo SKU della variante
    const a = await apri(patch);
    const prima = a.vc();
    a.scelta();
    const dopo = a.vc();
    const sku = a.r.pagina.eventi.find(([n]) => n === "ViewContent")?.[1]?.contentIds;
    a.scelta(); // una seconda scelta (cambia idea, «Gestisci cookie»): niente doppione
    const dopoDue = a.vc();
    a.chiudi();
    c("ViewContent: senza consenso non parte; accettando sulla scheda parte (SKU della variante), una volta sola anche alla scelta dopo", [0, 1, [patch.varianti[0].sku], 1], [prima, dopo, sku, dopoDue]);
    // 2. consenso già dato: una volta, e la scelta di dopo non lo rifà
    const b = await apri(patch, { consensoSubito: true });
    const subito = b.vc();
    b.scelta();
    const dopoB = b.vc();
    b.chiudi();
    c("ViewContent: con il consenso già dato parte subito, una volta; una scelta successiva non lo rifà", [1, 1], [subito, dopoB]);
    // 3. sessione già segnata dopo il primo evento: riaprire la scheda e accettare non lo rimanda
    const storage = new Map();
    const c1 = await apri(patch, { storage }); c1.scelta(); c1.chiudi();
    const c2 = await apri(patch, { storage, consensoSubito: true });
    const rimandato = c2.vc(); c2.scelta(); const rimandato2 = c2.vc(); c2.chiudi();
    c("ViewContent: la stessa scheda nella stessa sessione, già segnata, non lo rimanda (né subito né alla scelta)", [0, 0], [rimandato, rimandato2]);
    // 4. cookie bloccati: nessun effetto lancia, l'evento parte una volta alla scelta e non si raddoppia
    const d = await apri(patch, { bloccato: true });
    d.scelta(); d.scelta();
    const bloccatoVc = d.vc(); const bloccatoLanciati = d.lanciati.filter((m) => /SecurityError/.test(m)); d.chiudi();
    c("ViewContent con cookie bloccati: nessun effetto lancia, parte una volta alla scelta e non si raddoppia", [[], 1], [bloccatoLanciati, bloccatoVc]);
    // 5. nessun ascolto in anteprima né per Invisible Derm; l'ascolto si toglie con la pulizia
    const e = await apri(bozza); e.scelta(); const anteprimaVc = e.vc(); e.chiudi();
    const f = await apri(invisible); f.scelta(); const invisibileVc = f.vc(); f.chiudi();
    c("ViewContent dopo la scelta: mai in anteprima, mai per Invisible Derm", [0, 0], [anteprimaVc, invisibileVc]);
    const g = await apri(patch);
    const prima2 = (g.ascolti.get("hgl:consenso") ?? []).length;
    g.chiudi();
    c("ViewContent: la pulizia dell'effetto toglie l'ascolto della scelta (nessun evento dopo aver lasciato la scheda)", [1, 0], [prima2, (g.ascolti.get("hgl:consenso") ?? []).length]);
  });
  await blocco("blocco 10", async () => {
    const corpoNuovo = codice.slice(codice.indexOf("function SchedaNuova("), codice.indexOf("function SchedaVista("));
    c("sorgente: nella pagina nuova `window.sessionStorage` si legge solo dentro un `try` (cookie bloccati = nessun 500)", [1, 1], [(corpoNuovo.match(/window\.sessionStorage/g) ?? []).length, (corpoNuovo.match(/try \{\s*archivio = window\.sessionStorage;\s*\} catch/g) ?? []).length]);
    c("sorgente: la pagina nuova emette solo `ViewContent` (mai `AddToCart`, mai un pixel a mano, mai `useCart`)", [true, false, false, false], [/emettiEvento\("ViewContent"/.test(corpoNuovo), /AddToCart/.test(corpoNuovo), /fbq|ttq|gtag|fireCapi|firePixel/.test(src), /useCart|\badd\(/.test(corpoNuovo)]);
  });

  // ── il resto del sorgente ──
  c("sorgente: nessun JSON-LD scritto a mano, nessuna chiave, nessun indirizzo dello studio; HTML della pagina nuova senza «{{» né «da confermare»", [false, false, false, false], [/JSON\.stringify|dangerouslySetInnerHTML/.test(src), /sk_|service_role|SUPABASE_/.test(src), /scipioni|via degli/i.test(src), /\{\{|da confermare/i.test(nuova.html)]);
  c("sorgente: il caricamento `cms` parte solo se `context.modalita === \"cms\"` (le tre fonti nuove stanno nel ramo `altre`, nulla con `codice`)", [true, true, true], [
    /const cms = context\?\.modalita === "cms"/.test(codice), /const altre = cms\s*\?\s*Promise\.all\(\[/.test(codice), /if \(!altre \|\| scheda\.tipo !== "cms"\) return \{ scheda, anteprima: Boolean\(deps\.anteprima\) \}/.test(codice),
  ]);
  c("sorgente: `anteprima` della pagina nuova = il server ha riconosciuto la chiave (`prodotto.anteprima`), mai il solo indirizzo", [true], [/anteprima: Boolean\(scheda\.prodotto\.anteprima\)/.test(codice)]);
  c("sorgente: la pagina nuova la importa solo la rotta (e `routeTree.gen.ts` no); il riquadro lo importa solo la rotta", [["src/routes/shop.prodotto.$slug.tsx"], ["src/routes/shop.prodotto.$slug.tsx"]], (() => {
    const camminaSrc = (d) => { const { readdirSync, statSync } = requireQui("node:fs"); return readdirSync(d).flatMap((n) => { const f = join(d, n); return statSync(f).isDirectory() ? camminaSrc(f) : /\.tsx?$/.test(n) ? [f] : []; }); };
    const tutti = camminaSrc(join(radice, "src"));
    const chi = (re, esclusi) => tutti.filter((f) => !esclusi.some((e) => f.endsWith(e)) && re.test(readFileSync(f, "utf8"))).map((f) => f.slice(radice.length + 1));
    return [chi(/pagine\/PaginaScheda"/, ["PaginaScheda.tsx"]), chi(/scheda\/RiquadroAnteprima"/, ["RiquadroAnteprima.tsx"])];
  })());
  void mod;
}
