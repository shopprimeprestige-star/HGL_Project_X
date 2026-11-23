/** ── VETRINA V1 · T97b · LA PAGINA DELLA SCHEDA PRODOTTO ─────────────────────────────────────────────────────────
 *  `src/components/shop/pagine/PaginaScheda.tsx`: monta galleria, testata e blocco d'acquisto, barra d'acquisto, sezioni e pop-up d'uscita.
 *  Contratto delle proprietà (fissato qui): `{ scheda, tariffa, testi, cassa, anteprima }`
 *   · `scheda`: `Scheda` di `scheda.ts` (solo `tipo: "cms"` si disegna: con `codice`, `non_trovato`, `temporaneo` la pagina NON monta niente: la rotta,
 *     con `cms` nel contesto ma `scheda.tipo === "codice"`, cade sul componente di oggi: nota 5, la riga dello smistatore è di T97a);
 *   · `tariffa`: `tariffaSpedizione()`; `testi`: `contenutoShop()` (`{testi, media}`: da qui `testiDi`, `mediaDi` e i testi confermati);
 *   · `cassa`: `cassaPubblica()`; `anteprima`: l'indirizzo porta `?anteprima=` (o il prodotto porta il suo elenco `anteprima`): non si vende.
 *  Cosa deve valere (SPEC §4.5.4; V1-S1…S6, V1-T8; note del capo dopo W3 e W4):
 *   · un solo `useAcquisto`, lo stesso risultato al blocco e alla barra (un solo `AddToCart`, mai due); la pagina è montata con `key={slug}`;
 *   · lo stesso `blocchi` a `SezioniScheda1` (parte media, poi testo) e a `SezioniScheda2`: il kit lo disegna solo `SezioniScheda1`;
 *   · galleria da `ordinaGalleria`, dentro un confine d'errore e con la lightbox precaricata al primo `pointerdown`/`focus`;
 *   · la scelta di variante è della pagina: riparte da zero col prodotto e si ripulisce dai valori spariti; la barra legge la stessa scelta;
 *   · la barra d'acquisto si disegna nello slot in fondo al guscio (`[data-slot-barra-fissa]`, regola (a) di T93) con un portale, e SOLO con un prodotto
 *     che si compra e fuori dall'anteprima; nessuna `BarraConsulenza`; `PopupUscita` solo su una patch con il carrello vuoto;
 *   · in anteprima si toglie solo il bottone (selettore, spedizione e fiducia restano); gli h2 delle sezioni hanno tutti la stessa misura.
 *  Come si prova senza browser: `react-dom/server` non fa girare gli stati. La pagina (e `BloccoAcquisto`, dove vive `useAcquisto`) si impacchetta con un
 *  BANCO: `react` finto solo per quei due file (useState, useRef, useEffect che ricordano i valori tra un disegno e l'altro), i gestori veri (la scelta,
 *  «Aggiungi» dalla barra, la consulenza) e il disegno vero dell'albero con `react-dom/server`. Il fuoco vero, lo scorrimento, la barra a 390/1280 px
 *  e il portale nel guscio vero restano [M]/[T] (D103): li guardano T103c e T106. Dati inventati, nessuna rete, nessun database. */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as D from "./_dati-vetrina.mjs";

const FILE = "src/components/shop/pagine/PaginaScheda.tsx";
const copia = (x) => structuredClone(x);
const per = (slug) => D.CATALOGO.find((p) => p.slug === slug);
const EURO = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const formatta = (cent) => EURO.format(cent / 100).replace(/ /g, " ");
const leggibile = (html) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;| /g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const conta = (testo, ago) => (typeof ago === "string" ? testo.split(ago).length - 1 : (testo.match(ago) ?? []).length);
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/* ── il banco ─────────────────────────────────────────────────────────────────────────────────────────────── */

const FINTI = (reale) => ({
  "@/shop/CartContext": `export const useCart = () => globalThis.__banco.carrello;`,
  "@/lib/tracciamento/api": `export const emettiEvento = (n, d) => (globalThis.__banco.eventi.push([n, d]), "id"); export const emettiSoloContatore = (n, d) => { globalThis.__banco.contatori.push([n, d]); };`,
  "@/landing/consulenza/eventi": `export const traccia = (...a) => { globalThis.__banco.tracce.push(a); };`,
  "@tanstack/react-router": `
    import React from "react";
    export const Link = ({ to, children, className }) => React.createElement("a", { href: to, className }, children);
    export const useRouterState = (o) => { const s = { location: { pathname: "/shop/prodotto/x", searchStr: "", search: {} } }; return o && o.select ? o.select(s) : s; };
    export const useNavigate = () => () => {};
    export const useRouter = () => ({ invalidate: () => {} });`,
  "@/components/landing/consulenza/BoxProdottoGiusto": `import React from "react"; export const BoxProdottoGiusto = () => React.createElement("box-consulenza");`,
  "@/components/landing/consulenza/PopupUscita": `import React from "react"; export const PopupUscita = (p) => React.createElement("popup-uscita", { "data-aspetto": p.aspetto ?? "oggi", "data-prodotto": p.prodotto });`,
  "@/components/landing/consulenza/PannelloProblemi": `export default function PannelloProblemi() { return null; }`,
  // `react` solo per i due file che hanno stato: il resto dell'albero usa React vero
  "react#banco": `
    export * from ${JSON.stringify(reale)};
    export const useState = (i) => globalThis.__banco.useState(i);
    export const useRef = (i) => globalThis.__banco.useRef(i);
    export const useEffect = (f, d) => globalThis.__banco.useEffect(f, d);`,
  "react-dom#banco": `import React from "react"; export const createPortal = (c, el) => React.createElement("portale-finto", { "data-slot": el && el.nome }, c);`,
});

async function caricaBanco(radice) {
  const richiedi = createRequire(join(radice, "package.json"));
  const esbuild = richiedi("esbuild");
  const reale = richiedi.resolve("react");
  const dir = mkdtempSync(join(tmpdir(), "prova-t97b-"));
  try {
    const entrata = join(dir, "entrata.tsx");
    writeFileSync(
      entrata,
      `import { renderToStaticMarkup } from "react-dom/server";
       export * from ${JSON.stringify(join(radice, FILE))};
       export * from "@/shop/cms/vetrina-scheda";
       export * from "@/shop/cms/vetrina-fiducia";
       export * from "@/shop/cms/vetrina-galleria";
       export * from "@/shop/cms/vetrina-varianti";
       export * from "@/shop/cms/vetrina-contenuto";
       export { TESTI_SHOP, TESTI_PROVVISORI } from "@/landing/testi-shop";
       export const disegna = (albero) => renderToStaticMarkup(albero);`,
    );
    const finti = FINTI(reale);
    const dellaPagina = (importer) => importer.startsWith(join(radice, "src/components/shop/pagine")) || importer.endsWith("scheda/BloccoAcquisto.tsx");
    const r = await esbuild.build({
      entryPoints: [entrata], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic", loader: { ".tsx": "tsx" },
      alias: { "@": join(radice, "src") }, absWorkingDir: radice, nodePaths: [join(radice, "node_modules")], logLevel: "silent",
      define: { "import.meta.env": JSON.stringify({ DEV: false, PROD: true, SSR: true }) },
      plugins: [{
        name: "finti",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (a) => {
            if ((a.path === "react" || a.path === "react-dom") && dellaPagina(a.importer)) return { path: `${a.path}#banco`, namespace: "finto" };
            return finti[a.path] !== undefined ? { path: a.path, namespace: "finto" } : null;
          });
          b.onLoad({ filter: /.*/, namespace: "finto" }, (a) => ({ contents: finti[a.path], loader: "js", resolveDir: radice }));
        },
      }],
    });
    const file = join(dir, "banco.cjs");
    writeFileSync(file, r.outputFiles[0].text);
    return richiedi(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const figli = (el) => {
  const c = el?.props?.children;
  return c == null ? [] : Array.isArray(c) ? c.flat(Infinity) : [c];
};
/** Tutti gli elementi dell'albero per cui `test` è vero (l'albero è quello che la pagina ha restituito, non ancora disegnato). */
function trova(el, test, fuori = []) {
  if (el && typeof el === "object") {
    if (test(el)) fuori.push(el);
    for (const f of figli(el)) trova(f, test, fuori);
  }
  return fuori;
}
const di = (nome) => (el) => el?.type?.name === nome;

/** Monta `PaginaScheda(props)` nel banco: `slot` è il nodo che il guscio mette in fondo (o `null`: il guscio non l'ha). Gli effetti girano dopo ogni disegno. */
function monta(M, props, { slot = null, count = 0 } = {}) {
  const salvati = { setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout, document: globalThis.document };
  globalThis.setTimeout = () => 1;
  globalThis.clearTimeout = () => {};
  globalThis.document = { querySelector: (sel) => (sel === M.SLOT_BARRA_FISSA ? slot : null) };
  const b = {
    slots: [], k: 0, sporco: false, effetti: [], puliture: [], aggiunte: [], eventi: [], contatori: [], tracce: [], props, albero: null, chiave: undefined, render: 0,
    carrello: { count, lines: [], add: (...a) => b.aggiunte.push(a) },
    useState(iniziale) {
      const i = b.k++;
      if (!b.slots[i]) {
        const s = { v: typeof iniziale === "function" ? iniziale() : iniziale };
        s.set = (x) => { const nv = typeof x === "function" ? x(s.v) : x; if (!Object.is(nv, s.v)) { s.v = nv; b.sporco = true; } };
        b.slots[i] = s;
      }
      return [b.slots[i].v, b.slots[i].set];
    },
    useRef(iniziale) {
      const i = b.k++;
      if (!b.slots[i]) b.slots[i] = { current: iniziale };
      return b.slots[i];
    },
    useEffect(f) {
      const i = b.k++;
      if (!b.slots[i]) { b.slots[i] = { effetto: true }; b.effetti.push(f); }
    },
    ridisegna() {
      globalThis.__banco = b;
      b.k = 0; b.sporco = false; b.render++;
      const el = M.PaginaScheda(b.props);
      b.chiave = el?.key;
      b.albero = el ? el.type(el.props) : null;
    },
    assesta() {
      for (let n = 0; ; n++) {
        if (n > 20) throw new Error("banco: la pagina non si assesta");
        for (const f of b.effetti.splice(0)) b.puliture.push(f());
        if (!b.sporco) break;
        b.ridisegna();
      }
    },
    agisci(fn) { globalThis.__banco = b; fn(); b.ridisegna(); b.assesta(); },
    /** Cambiano le proprietà (stessa pagina, stato che resta) e si ridisegna. */
    con(props2) { b.props = props2; b.agisci(() => {}); },
    html: () => M.disegna(b.albero),
    uno: (nome) => trova(b.albero, di(nome))[0],
    tutti: (nome) => trova(b.albero, di(nome)),
    smonta() {
      for (const p of b.puliture.splice(0)) p?.();
      Object.assign(globalThis, { setTimeout: salvati.setTimeout, clearTimeout: salvati.clearTimeout });
      if (salvati.document === undefined) delete globalThis.document; else globalThis.document = salvati.document;
    },
  };
  globalThis.__banco = b;
  b.ridisegna();
  b.assesta();
  return b;
}

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T97b · LA PAGINA DELLA SCHEDA PRODOTTO (23/11/2026)");

  const file = join(radice, FILE);
  const esiste = existsSync(file);
  c("il file esiste (components/shop/pagine/PaginaScheda.tsx)", true, esiste);
  if (!esiste) return;
  const src = readFileSync(file, "utf8");
  const codice = senzaCommenti(src);
  const M = await caricaBanco(radice);
  const T = M.TESTI_SHOP;
  const P = M.TESTI_PROVVISORI;

  const alfa = per("patch-prova-alfa"); // Colore ×3, prezzi diversi, FAQ, box, correlato
  const shampoo = per("shampoo-prova"); // cura
  const kit = per("kit-prova"); // kit: «Cosa contiene»
  const derm = D.INVISIBLE_DERM;
  const cassa = { sicuro: true, metodi: ["Carta", "PayPal"] };
  const contenuto = { testi: Object.fromEntries(Object.entries(D.TESTI_CONFERMATI_PIENI).map(([k, v]) => [`shop.conf.${k}`, v])), media: {} };
  const cms = (prodotto) => ({ tipo: "cms", prodotto });
  const proprieta = (prodotto, extra = {}) => ({ scheda: cms(prodotto), tariffa: D.TARIFFA_OK, testi: contenuto, cassa, anteprima: false, ...extra });
  const SLOT = { nome: "slot-in-fondo-al-guscio" };
  const blocchiDi = (p, carrelloVuoto = true) => M.bloccheScheda(p, { tariffa: D.TARIFFA_OK, testi: M.confermatiDa(contenuto), cassa, carrelloVuoto });
  const pagine = [];
  const apri = (p, extra = {}, opz = { slot: SLOT }) => (pagine.push(monta(M, proprieta(p, extra), opz)), pagine.at(-1));

  try {
    // ════ 0 · IL CONTRATTO ════════════════════════════════════════════════════════════════════════════════
    c("esporta `PaginaScheda`, `ripulisciScelta`, `ConfineErrore` e il selettore dello slot della barra", [true, true, true, "[data-slot-barra-fissa]"], [typeof M.PaginaScheda === "function", typeof M.ripulisciScelta === "function", typeof M.ConfineErrore === "function", M.SLOT_BARRA_FISSA]);
    c("`scheda.tipo` diverso da `cms` (codice, non_trovato, temporaneo): la pagina non monta NIENTE (nota 5: si cade sul componente di oggi)", [null, null, null], ["codice", "non_trovato", "temporaneo"].map((tipo) => M.PaginaScheda({ ...proprieta(alfa), scheda: { tipo } })));
    c("`scheda` assente o storta: nessun errore, nessun disegno", [null, null], [M.PaginaScheda({ scheda: null }), M.PaginaScheda({})]);
    const elA = M.PaginaScheda(proprieta(alfa));
    const elB = M.PaginaScheda(proprieta(per("patch-prova-beta")));
    c("la pagina è montata con `key={slug}`: cambiando prodotto lo stato riparte da zero (A → B → A)", [alfa.slug, "patch-prova-beta", false], [elA.key, elB.key, elA.key === elB.key]);

    // ════ 1 · LA STRUTTURA: UN SOLO ACQUISTO, LO STESSO BLOCCHI, LA BARRA NELLO SLOT ═══════════════════════
    const a = apri(alfa);
    const htmlA = a.html();
    const testoA = leggibile(htmlA);
    c("il disegno non è vuoto e non porta «undefined», «null», «NaN» né «[object»", [true, false], [htmlA.length > 500, /undefined|\bnull\b|NaN|\[object/.test(htmlA)]);
    c("un solo H1 (il nome del prodotto), un solo blocco d'acquisto, una sola galleria", [1, 1, 1, alfa.nome], [conta(htmlA, "<h1"), a.tutti("BloccoAcquisto").length, a.tutti("GalleriaProdotto").length, leggibile((htmlA.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) ?? [])[1] ?? "")]);
    const blocco = a.uno("BloccoAcquisto");
    const barra = a.uno("BarraAcquisto");
    c("la barra d'acquisto c'è, nello slot del guscio (portale), una sola", [1, SLOT.nome], [a.tutti("BarraAcquisto").length, trova(a.albero, (e) => e.type === "portale-finto")[0]?.props["data-slot"]]);
    c("`useAcquisto` è chiamato UNA volta: la barra riceve lo STESSO gesto e gli stessi stati del blocco", [true, true, true], [barra.props.onAggiungi === blocco.props.acquisto.aggiungi, barra.props.aggiunto === blocco.props.acquisto.aggiunto, barra.props.esaurito === blocco.props.acquisto.esaurito]);
    c("…e nel sorgente `useAcquisto(` compare una volta sola", 1, conta(codice, /\buseAcquisto\(/g));
    const sez1 = a.tutti("SezioniScheda1");
    const sez2 = a.tutti("SezioniScheda2");
    c("`SezioniScheda1` due volte (parte media, poi testo) e `SezioniScheda2` una, tutte con LO STESSO `blocchi` di `bloccheScheda`", [["media", "testo"], 1, true], [sez1.map((e) => e.props.parte), sez2.length, [...sez1, ...sez2].every((e) => JSON.stringify(e.props.blocchi) === JSON.stringify(blocchiDi(alfa)))]);
    c("la parte «media» sta nell'albero prima della parte «testo», che sta prima di `SezioniScheda2`", true, (() => { const ordine = trova(a.albero, (e) => ["SezioniScheda1", "SezioniScheda2"].includes(e.type?.name)).map((e) => e.type.name + (e.props.parte ?? "")); return JSON.stringify(ordine) === JSON.stringify(["SezioniScheda1media", "SezioniScheda1testo", "SezioniScheda2"]); })());
    c("`BloccoAcquisto` riceve il blocco `acquisto`, le voci di fiducia vere (da `vociFiducia`) e i testi confermati", [true, true, true], [
      JSON.stringify(blocco.props.blocco) === JSON.stringify(blocchiDi(alfa).find((b) => b.id === "acquisto")),
      JSON.stringify(blocco.props.voci) === JSON.stringify(M.vociFiducia({ tariffa: D.TARIFFA_OK, testi: M.confermatiDa(contenuto), prodotto: alfa, cassa })),
      JSON.stringify(blocco.props.testi) === JSON.stringify(M.confermatiDa(contenuto)),
    ]);
    c("la galleria riceve `ordinaGalleria(media)` (la foto di scala seconda)", [M.ordinaGalleria(alfa.media).map((d) => d.id)], [a.uno("GalleriaProdotto").props.diapositive.map((d) => d.id)]);
    c("l'ordine nel documento: foto → H1 → box della consulenza (dopo le FAQ), nessuna consulenza tra il prodotto e il bottone (V1-S1)", true, htmlA.indexOf("<img") < htmlA.indexOf("<h1") && htmlA.indexOf("<h1") < htmlA.indexOf(T.scheda.faq) && htmlA.indexOf(T.scheda.faq) < htmlA.indexOf("<box-consulenza>") && htmlA.indexOf("<box-consulenza>") > htmlA.indexOf("data-barra-nascondi"));
    c("la barra d'acquisto è davvero disegnata (regione con `data-barra-fissa`) e NON c'è nessuna barra della consulenza", [1, 0], [conta(htmlA, 'data-barra-fissa="acquisto"'), conta(htmlA, 'data-barra-fissa="consulenza"')]);
    c("il guscio non ha lo slot: la barra non si disegna (e niente si rompe)", [0, 1], (() => { const s = apri(alfa, {}, { slot: null }); return [s.tutti("BarraAcquisto").length, conta(s.html(), "<h1")]; })());
    c("il blocco d'acquisto è figlio diretto della colonna di destra (sticky nel blocco): colonna con `lg:col-start-2` e `lg:row-span-2`, nessun antenato con `overflow`", [true, true, false], (() => {
      const colonna = trova(a.albero, (e) => figli(e).some((f) => f?.type?.name === "BloccoAcquisto"))[0];
      return [/\blg:col-start-2\b/.test(colonna?.props.className ?? ""), /\blg:row-span-2\b/.test(colonna?.props.className ?? ""), /overflow/.test(codice)];
    })());
    // T102 A12: prima la pagina schiacciava tutti gli h2 a 18 px con `[&_h2]:text-lg`; ora ogni file dà il suo titolo `text-xl md:text-2xl` (20/24 px) e la pagina non forza niente
    const classiTitoli = ["scheda/SezioniScheda1.tsx", "scheda/SezioniScheda2.tsx", "TiServeAnche.tsx"].map((f) => {
      const t = senzaCommenti(readFileSync(join(radice, "src/components/shop", f), "utf8"));
      return (t.match(/(?:const (?:H2|CLASSI_TITOLO) = |<h2\b[^>]*className=)"([^"]*)"/) ?? [])[1] ?? "";
    });
    c("tutti gli h2 delle sezioni hanno la stessa misura (`text-xl md:text-2xl`, grassetto) e la pagina non li forza più", [true, true, 0], [classiTitoli.every((k) => /\btext-xl\b/.test(k) && /\bmd:text-2xl\b/.test(k) && /\bfont-bold\b/.test(k)), new Set(classiTitoli).size === 1, trova(a.albero, (e) => typeof e.props?.className === "string" && /\[&_h2\]/.test(e.props.className)).length]);

    // ── il kit: «Cosa contiene» una volta sola ──
    const k = apri(kit);
    c("il kit: «Cosa contiene» compare UNA volta (lo disegna solo `SezioniScheda1`, passa lo stesso `blocchi` a tutte e due)", 1, conta(leggibile(k.html()), P.scheda.cosaContiene));
    c("la cura e il kit: nessun box della consulenza e nessun pop-up (solo patch)", [0, 0, 0, 0], [conta(apri(shampoo).html(), "<box-consulenza"), conta(k.html(), "<box-consulenza"), conta(apri(shampoo).html(), "<popup-uscita"), conta(k.html(), "<popup-uscita")]);

    // ════ 2 · LA SCELTA: DELLA PAGINA, ZERO ALL'INIZIO, RIPULITA, LA STESSA PER BARRA E BLOCCO ═══════════════
    c("all'inizio nessuna scelta: il blocco e la barra non hanno variante, il prezzo della barra è «—» perché le varianti costano cifre diverse (mai un «da» senza la parola)", [{}, null, true], [blocco.props.scelta, blocco.props.acquisto.variante, leggibile(htmlA.slice(htmlA.indexOf('data-barra-fissa="acquisto"'))).includes("—")]);
    const castano = alfa.opzioni[0].valori[1].valore;
    const sceltaCastano = { [alfa.opzioni[0].nome]: castano };
    a.agisci(() => a.uno("BloccoAcquisto").props.onScegli(sceltaCastano));
    const varCastano = M.varianteScelta(alfa, sceltaCastano);
    c("`onScegli` della pagina: il blocco riceve la scelta nuova e la variante che le corrisponde", [sceltaCastano, varCastano.sku], [a.uno("BloccoAcquisto").props.scelta, a.uno("BloccoAcquisto").props.acquisto.variante?.sku]);
    const htmlScelto = a.html();
    c("la barra legge la STESSA scelta: il suo prezzo è quello della variante scelta, dal server", [true, true], [leggibile(htmlScelto.slice(htmlScelto.indexOf('data-barra-fissa="acquisto"'))).includes(formatta(varCastano.prezzoCent)), a.uno("BarraAcquisto").props.onAggiungi === a.uno("BloccoAcquisto").props.acquisto.aggiungi]);
    c("un prodotto con un prezzo solo (cura con una variante): la barra mostra quel prezzo, non «—»", true, (() => { const s = apri(per("balsamo-prova")); const h = s.html(); return leggibile(h.slice(h.indexOf('data-barra-fissa="acquisto"'))).includes(formatta(per("balsamo-prova").prezzoDaCent)); })());
    // un valore che sparisce dal prodotto (stessa pagina, dati nuovi): la scelta si ripulisce da sola
    const senzaCastano = copia(alfa);
    senzaCastano.opzioni[0].valori = senzaCastano.opzioni[0].valori.filter((v) => v.valore !== castano);
    senzaCastano.varianti = senzaCastano.varianti.filter((v) => v.opzioni[alfa.opzioni[0].nome] !== castano);
    a.con(proprieta(senzaCastano));
    c("un valore spariti dal prodotto: la scelta si ripulisce (e senza variante nessuna riga nel carrello)", [{}, null], [a.uno("BloccoAcquisto").props.scelta, a.uno("BloccoAcquisto").props.acquisto.variante]);
    c("`ripulisciScelta`: toglie i valori spariti e le chiavi che il prodotto non ha, tiene il resto", [{ Colore: alfa.opzioni[0].valori[0].valore }, {}, {}], [
      M.ripulisciScelta(alfa, { Colore: alfa.opzioni[0].valori[0].valore, Misura: "XL", Altro: "x" }),
      M.ripulisciScelta(alfa, { Colore: "Inventato" }),
      M.ripulisciScelta(per("kit-prova"), { Colore: "Nero" }),
    ]);
    c("`ripulisciScelta` con scelta assente o storta non lancia", [{}, {}, {}], [M.ripulisciScelta(alfa, null), M.ripulisciScelta(alfa, undefined), M.ripulisciScelta({ ...alfa, opzioni: null }, { Colore: "x" })]);

    // ── il gesto dalla barra: un solo AddToCart, mai una riga senza SKU ──
    const g = apri(alfa);
    g.agisci(() => g.uno("BarraAcquisto").props.onAggiungi());
    c("«Aggiungi» dalla barra senza aver scelto: niente nel carrello e nessun evento (mai una riga senza SKU)", [0, 0], [g.aggiunte.length, g.eventi.length]);
    g.agisci(() => g.uno("BloccoAcquisto").props.onScegli(sceltaCastano));
    g.agisci(() => g.uno("BarraAcquisto").props.onAggiungi());
    c("scelta completa + «Aggiungi» dalla barra: UNA riga nel carrello con lo SKU della variante scelta e il prezzo del server", [1, varCastano.sku, varCastano.prezzoCent], [g.aggiunte.length, g.aggiunte[0]?.[3]?.sku, g.aggiunte[0]?.[3]?.snap?.prezzoCent]);
    c("…e UN solo `AddToCart` (con lo SKU della variante), non due", [1, [varCastano.sku]], [g.eventi.filter(([n]) => n === "AddToCart").length, g.eventi.find(([n]) => n === "AddToCart")?.[1]?.contentIds]);
    c("…e il blocco e la barra dicono «Aggiunto» insieme (stesso stato)", [true, true], [g.uno("BloccoAcquisto").props.acquisto.aggiunto, g.uno("BarraAcquisto").props.aggiunto]);
    c("la pagina non emette `ViewContent` (lo fa la rotta, T97a) né altro: gli unici eventi sono quelli del gesto", [["AddToCart"]], [[...new Set(g.eventi.map(([n]) => n))]]);

    // ════ 3 · ANTEPRIMA E PRODOTTI CHE NON SI COMPRANO ═════════════════════════════════════════════════════
    const an = apri(alfa, { anteprima: true });
    const htmlAn = an.html();
    c("anteprima (D94): niente bottone «Aggiungi al carrello», niente barra (anche con lo slot), niente `data-barra-nascondi`", [false, 0, 0, 0], [htmlAn.includes(`>${T.scheda.aggiungi}<`), an.tutti("BarraAcquisto").length, conta(htmlAn, 'data-barra-fissa="acquisto"'), conta(htmlAn, "data-barra-nascondi")]);
    c("anteprima: selettore, riga «Spedizione», fiducia, prezzo e la striscia «anteprima» ci sono (si controlla la bozza)", [true, true, true, true, true], [conta(htmlAn, 'role="radiogroup"') > 0, leggibile(htmlAn).includes("Spedizione:"), conta(htmlAn, '<ul role="list"') > 0, leggibile(htmlAn).includes(T.carrello.ivaInclusa), leggibile(htmlAn).includes(P.scheda.anteprimaStriscia)]);
    an.agisci(() => an.uno("BloccoAcquisto").props.onScegli(sceltaCastano));
    an.agisci(() => an.uno("BloccoAcquisto").props.acquisto.aggiungi());
    c("anteprima: nemmeno col gesto si compra (niente nel carrello, nessun evento)", [0, 0], [an.aggiunte.length, an.eventi.length]);
    const conElenco = apri({ ...copia(alfa), anteprima: { nascosti: [] } }, { anteprima: false });
    c("il prodotto che porta il suo elenco `anteprima` (dal server) vale come anteprima anche se la proprietà è falsa", [0, false], [conElenco.tutti("BarraAcquisto").length, conElenco.html().includes(`>${T.scheda.aggiungi}<`)]);
    c("anteprima: nessun pop-up d'uscita", 0, conta(htmlAn, "<popup-uscita"));
    const dm = apri(derm);
    const htmlDm = dm.html();
    c("Invisible Derm (non si compra): c'è la scheda, ma nessuna barra, nessun pop-up, nessun selettore, nessuna cifra, nessun box", [1, 0, 0, 0, 0, false, 0], [conta(htmlDm, "<h1"), dm.tutti("BarraAcquisto").length, conta(htmlDm, "<popup-uscita"), conta(htmlDm, 'role="radiogroup"'), conta(htmlDm, "<box-consulenza"), /€/.test(htmlDm), conta(htmlDm, "data-barra-nascondi")]);
    dm.agisci(() => dm.uno("BloccoAcquisto").props.acquisto.aggiungi());
    c("Invisible Derm: il gesto non fa niente (la guardia `acquistabile` di `useAcquisto` regge)", [0, 0], [dm.aggiunte.length, dm.eventi.length]);

    // ════ 4 · IL POP-UP D'USCITA: SOLO PATCH, SOLO CARRELLO VUOTO ══════════════════════════════════════════
    const pop = (p, count) => monta(M, proprieta(p), { slot: SLOT, count });
    const conPop = pop(alfa, 0);
    pagine.push(conPop);
    c("patch con il carrello vuoto: un pop-up d'uscita con l'aspetto dello shop e il nome del prodotto", [1, "shop", alfa.nome], [conta(conPop.html(), "<popup-uscita"), conPop.html().match(/data-aspetto="([^"]*)"/)?.[1], conPop.html().match(/data-prodotto="([^"]*)"/)?.[1]]);
    const conRighe = pop(alfa, 2);
    pagine.push(conRighe);
    c("patch con qualcosa nel carrello: nessun pop-up", 0, conta(conRighe.html(), "<popup-uscita"));
    c("il pop-up lo decide `popupPuoMontarsi` (T78), non una regola riscritta qui", [true, true], [/popupPuoMontarsi/.test(codice), /aspetto="shop"/.test(codice)]);

    // ════ 5 · GALLERIA: CONFINE D'ERRORE E PRECARICAMENTO DELLA LIGHTBOX ═══════════════════════════════════
    const confine = a.tutti("ConfineErrore").find((e) => trova(e, di("GalleriaProdotto")).length > 0);
    c("la galleria sta dentro un confine d'errore (se la lightbox non si scarica la scheda non cade)", true, !!confine);
    const istanza = new M.ConfineErrore({ children: "intero", fallback: "riserva" });
    istanza.state = { guasto: false };
    const dopo = [istanza.render()];
    istanza.state = M.ConfineErrore.getDerivedStateFromError(new Error("pezzo non scaricato"));
    c("`ConfineErrore`: finché va bene mostra il contenuto, dopo un errore la riserva (mai un errore a tutta la pagina)", ["intero", "riserva"], [dopo[0], istanza.render()]);
    const ariaPrecarico = trova(a.albero, (e) => typeof e.props?.onPointerDownCapture === "function" && typeof e.props?.onFocusCapture === "function");
    c("il precaricamento della lightbox parte al primo `pointerdown` o `focus` sulla galleria (una volta: richiamarlo non rompe)", [1, true], [ariaPrecarico.length, (() => { try { ariaPrecarico[0].props.onPointerDownCapture(); ariaPrecarico[0].props.onFocusCapture(); return true; } catch { return false; } })()]);
    c("il precaricamento è l'import della stessa lightbox che usa la galleria (stesso pezzo), senza passare per Radix a mano", [true, false], [/import\("@\/components\/shop\/scheda\/Lightbox"\)/.test(codice), /@radix-ui/.test(codice)]);
    const riserva = trova(a.albero, di("ConfineErrore"))[0]?.props.fallback;
    c("la riserva della galleria mostra comunque la foto principale (la pagina resta usabile)", true, !!riserva && /FotoShop/.test(src));

    // ════ 6 · LA CONSULENZA DEL COLORE ═════════════════════════════════════════════════════════════════════
    const col = apri(alfa);
    c("prima del tocco il pannello della consulenza non è montato", 0, trova(col.albero, (e) => typeof e.props?.onApertoChange === "function").length);
    col.agisci(() => col.tutti("SezioniScheda1")[0].props.onConsulenza());
    c("«Hai dubbi tra due tonalità?»: conta `ClickConsulenza` (solo contatore, punto «colore») e monta il pannello aperto, dentro il confine d'errore", [[["ClickConsulenza", { punto: "colore" }]], true], [col.contatori, trova(col.albero, (e) => e.props?.aperto === true && typeof e.props?.onApertoChange === "function").length === 1]);

    // ════ 7 · IL SORGENTE ══════════════════════════════════════════════════════════════════════════════════
    c("monta i pezzi già fatti: galleria, blocco d'acquisto, barra, sezioni 1 e 2 (T86, T87b, T84a, T88a, T88b)", [true, true, true, true, true, true], ["GalleriaProdotto", "BloccoAcquisto", "BarraAcquisto", "SezioniScheda1", "SezioniScheda2", "useAcquisto"].map((n) => new RegExp(`\\b${n}\\b`).test(codice)));
    c("riusa la logica già provata: `bloccheScheda`, `vociFiducia`, `ordinaGalleria`, `testiDi`, `mediaDi`, `confermatiDa`, `popupPuoMontarsi`", Array(7).fill(true), ["bloccheScheda", "vociFiducia", "ordinaGalleria", "testiDi", "mediaDi", "confermatiDa", "popupPuoMontarsi"].map((n) => new RegExp(`\\b${n}\\b`).test(codice)));
    c("la barra va nello slot con un portale (`createPortal`), che si cerca dopo il montaggio (mai durante il disegno sul server)", [true, true, true], [/\bcreatePortal\(/.test(codice), /document\.querySelector\(SLOT_BARRA_FISSA\)/.test(codice), /useEffect\(/.test(codice)]);
    c("nessuna `BarraConsulenza` (V1-T8: la monta solo il guscio) e nessuna barra della consulenza nel sorgente", false, /BarraConsulenza|data-barra-fissa="consulenza"/.test(codice));
    c("`PopupUscita` è importato qui e solo qui nello shop nuovo (V1-T8)", true, /import \{ PopupUscita \}/.test(codice));
    c("nessun evento d'ingresso: né `ViewContent` né `emettiEvento` (la pagina non lo emette: lo fa la rotta, T97a); l'`AddToCart` è di `useAcquisto`", [false, false], [/ViewContent/.test(codice), /emettiEvento/.test(codice)]);
    c("nessuna chiamata al server né rete (`*.functions`, `fetch`): la pagina riceve tutto dalla rotta", false, /\.functions|\bfetch\(|\.server/.test(codice));
    c("nessuna lettura di `localStorage`/`sessionStorage`: il prezzo viene dal prodotto del server", false, /localStorage|sessionStorage/.test(codice));
    c("nessuna cifra né frase scritta nella pagina (le parole sono di `testi-shop.ts`): niente importi, niente «Aggiungi al carrello», «IVA inclusa», «Spedizione»", [false, false], [/\b\d+[.,]\d{2}\b/.test(codice), /["'`]\s*(Aggiungi al carrello|IVA inclusa|Spedizione|Aggiunto|Esaurito|Vai al carrello)/.test(codice)]);
    c("nessun `fbq`, `ttq`, `gtag`, nessun `dangerouslySetInnerHTML`, nessun `toast`", [false, false, false], [/\b(fbq|ttq|gtag)\b/.test(codice), /dangerouslySetInnerHTML/.test(codice), /toast|sonner/i.test(codice)]);
    c("nessun «da confermare», `{{` o indirizzo dello studio nel sorgente (nemmeno nei commenti)", [false, false, false], [/da confermare/i.test(src), /\{\{/.test(src.replaceAll("={{", "")), /Scipioni|\bVia\s+[A-Z]\w+\s+\d/.test(src)]);
    c("nessuna ombra, sfocatura o gradiente scritti qui (colori e bordi, non effetti)", false, /shadow-|backdrop-|blur-|bg-gradient/.test(codice));
    const html = [htmlA, htmlAn, htmlDm, k.html(), conPop.html()].join("\n");
    c("nessuna parola vietata, segnaposto, stella né scarsità in nessuno stato disegnato", [[], false], [D.trovaParoleVietate(leggibile(html)), /\{\{|da confermare|Scipioni|ultim[io] pezz|\bstell/i.test(html)]);
    c("la pagina la monta solo la rotta della scheda (T97a; `routeTree.gen.ts` no)", ["src/routes/shop.prodotto.$slug.tsx"], camminaSrc(join(radice, "src/routes")).filter((f) => /PaginaScheda/.test(readFileSync(f, "utf8"))).map((f) => f.slice(radice.length + 1)));
    c("l'unico file di `src/` che importa `PaginaScheda` è la rotta della scheda (nessuno dei pezzi la richiama)", ["src/routes/shop.prodotto.$slug.tsx"], camminaSrc(join(radice, "src")).filter((f) => !f.endsWith("PaginaScheda.tsx") && /pagine\/PaginaScheda/.test(readFileSync(f, "utf8"))).map((f) => f.slice(radice.length + 1)));
  } finally {
    for (const p of pagine.reverse()) p.smonta();
  }
}

const camminaSrc = (d) => (existsSync(d) ? readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? camminaSrc(join(d, e.name)) : /\.(tsx?|mjs)$/.test(e.name) ? [join(d, e.name)] : [])) : []);
