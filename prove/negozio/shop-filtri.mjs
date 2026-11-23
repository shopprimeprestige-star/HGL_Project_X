/** ── VETRINA V1 · T90 · I FILTRI DELLA CATEGORIA ──────────────────────────────────────────────────────────────
 *  `src/components/shop/categoria/FiltriCategoria.tsx` (barra, colonna, chip, stato vuoto, attesa) e `FoglioFiltri.tsx` (il foglio dal basso,
 *  Radix, in ritardo). Cosa deve valere (V1-C2, V1-T11, V1-T15; D80, D82, D103):
 *   · compaiono SOLO i filtri che i prodotti hanno davvero (`gruppiDaProdotti`); senza filtri non c'è né barra né colonna;
 *   · la logica è quella di T77 (`leggiFiltri`, `scriviFiltri`, `applicaFiltri`, `chipAttivi`, `filtriAttivi`, `togliFiltro`) e di T105 (`foglio`):
 *     qui non si riscrive niente; lo stato sta nell'indirizzo (ricaricare dà la stessa pagina);
 *   · telefono: barra «Filtra (n)» sotto l'header e foglio dal basso con «Mostra {n} prodotti» pieno notte e «Azzera filtri»; computer: colonna a
 *     sinistra e chip rimovibili; nessun risultato = stato vuoto con «Azzera filtri»;
 *   · al cambio si tengono le card vecchie con `aria-busy`, gli scheletri compaiono solo dopo 300 ms (il timer è di `Scheletro`, T83).
 *  Due modi di guardare: il MARCHIO (`_rende.mjs`: esbuild + react-dom/server) e il COMPORTAMENTO con un piccolo esecutore di React scritto qui
 *  (gli `useState`/`useEffect` girano davvero, il tempo è finto, Radix è un finto che registra le sue proprietà): si prova che il clic apre il
 *  foglio, che Esc/X/«Mostra» lo chiudono, che il fuoco torna al bottone una volta sola, che ogni scelta scrive l'indirizzo e che il timer
 *  CAMBIA lo stato. Il fuoco intrappolato e Esc nel documento li dà Radix Dialog (modale): si guardano nel browser (T103c, T106). */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { PRODOTTI, trovaParoleVietate } from "./_dati-vetrina.mjs";
import { rendiComponente } from "./_rende.mjs";

const requireQui = createRequire(import.meta.url);
const COMP = "src/components/shop/categoria";
const FILE = `${COMP}/FiltriCategoria.tsx`;
const FILE_FOGLIO = `${COMP}/FoglioFiltri.tsx`;

const caricaTesti = async (radice) => {
  const r = await build({ entryPoints: [join(radice, "src/landing/testi-shop.ts")], bundle: true, write: false, format: "esm", alias: { "@": join(radice, "src") }, logLevel: "silent" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};
const conta = (testo, ago) => testo.split(ago).length - 1;
const attr = (t, nome) => (t.match(new RegExp(`\\s${nome}="([^"]*)"`, "i")) ?? [])[1];
const classi = (t) => (attr(t, "class") ?? "").split(/\s+/).filter(Boolean);
const leggibile = (html) => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;| /g, " ").replace(/\s+/g, " ").trim();
/** L'apertura del tag che contiene `segno` (l'intero `<…>`), o `""`. */
function tag(html, segno, da = 0) {
  const i = html.indexOf(segno, da);
  if (i < 0) return "";
  return html.slice(html.lastIndexOf("<", i), html.indexOf(">", i) + 1);
}
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");

/* ── l'esecutore: React con gli hook veri nello stato, senza schermo ───────────────────────────────────────── */

function monta(Componente, props) {
  const hooks = [];
  let idx = 0;
  let effetti = [];
  let sporco = false;
  let lotto = 0;
  let disegnando = false;
  let albero = null;
  let vivo = true;
  const uguali = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const app = { attivo: null, disegni: 0, fuochi: 0 };
  const corrente = {
    useState(iniziale) {
      const i = idx++;
      const h = (hooks[i] ??= { v: typeof iniziale === "function" ? iniziale() : iniziale });
      h.set ??= (n) => {
        const nuovo = typeof n === "function" ? n(h.v) : n;
        if (Object.is(nuovo, h.v) || !vivo) return;
        h.v = nuovo;
        richiedi();
      };
      return [h.v, h.set];
    },
    useRef(iniziale) {
      const i = idx++;
      return (hooks[i] ??= { current: iniziale });
    },
    useMemo(f, d) {
      const i = idx++;
      if (hooks[i] && uguali(hooks[i].d, d)) return hooks[i].v;
      return (hooks[i] = { v: f(), d }).v;
    },
    useEffect(f, d) {
      const i = idx++;
      const h = (hooks[i] ??= { primo: true, d: undefined, pulizia: null });
      if (!h.primo && d && uguali(h.d, d)) return;
      effetti.push(() => {
        h.pulizia?.();
        h.pulizia = f() ?? null;
        h.d = d;
        h.primo = false;
      });
    },
  };
  function espandi(n) {
    if (n == null || typeof n === "boolean") return [];
    if (typeof n === "string" || typeof n === "number") return [String(n)];
    if (Array.isArray(n)) return n.flatMap(espandi);
    if (typeof n.type === "function") return espandi(n.type(n.props));
    if (typeof n.type === "symbol") return espandi(n.props.children);
    return [{ tag: n.type, props: n.props, figli: espandi(n.props.children) }];
  }
  /** I `ref` a oggetto diventano un finto nodo con `focus()`: porta il fuoco, come il browser. */
  function collega(n) {
    if (typeof n === "string") return;
    const r = n.props.ref;
    if (r && typeof r === "object") {
      const f = (r.current ??= {
        focus() {
          app.attivo = this;
          app.fuochi++;
        },
      });
      f.tag = n.tag;
      f.props = n.props;
    }
    n.figli.forEach(collega);
  }
  function disegna() {
    do {
      sporco = false;
      disegnando = true;
      idx = 0;
      effetti = [];
      globalThis.__corrente = corrente;
      albero = { tag: "#radice", props: {}, figli: espandi(Componente(props)) };
      app.disegni++;
      disegnando = false;
      collega(albero);
      lotto++;
      for (const e of effetti) e();
      lotto--;
    } while (sporco && lotto === 0);
  }
  function richiedi() {
    if (lotto > 0 || disegnando) sporco = true;
    else disegna();
  }
  app.esegui = (f) => {
    lotto++;
    try {
      f();
    } finally {
      lotto--;
    }
    if (sporco && lotto === 0) disegna();
  };
  /** Il router ha cambiato lo stato fuori dal componente (`isLoading`…): si ridisegna. */
  app.ridisegna = () => app.esegui(() => (sporco = true));
  app.tutti = (p, da = albero, fuori = []) => {
    if (typeof da === "string") return fuori;
    if (p(da)) fuori.push(da);
    da.figli.forEach((f) => app.tutti(p, f, fuori));
    return fuori;
  };
  app.albero = () => albero;
  app.trova = (p, da) => app.tutti(p, da)[0];
  app.smonta = () => {
    vivo = false;
    for (const h of hooks) if (h && typeof h.pulizia === "function") h.pulizia();
  };
  disegna();
  return app;
}
const testoDi = (n) => (typeof n === "string" ? n : n.figli.map(testoDi).join(""));

/** Il componente vero impacchettato con i finti del router, di Radix e delle icone, e con `react` sostituito dall'esecutore. */
async function impacchetta(radice) {
  const esbuild = requireQui(join(radice, "node_modules/esbuild"));
  const dir = mkdtempSync(join(tmpdir(), "prova-filtri-"));
  const jsx = (...p) => `import { jsx } from "react/jsx-runtime"; ${p.join(" ")}`;
  const icona = (n) => `export const ${n} = (p) => jsx('svg', { 'data-icona': '${n}', ...p });`;
  const nota = `const nota = (nome, p) => { const r = (globalThis.__prova.radix ??= {}); r[nome] = p; };`;
  const pezzo = (nome, t) => `export const ${nome} = (p) => { nota('${nome}', p); const { children, asChild, onOpenAutoFocus, onCloseAutoFocus, onEscapeKeyDown, onPointerDownOutside, onInteractOutside, ...dom } = p; return jsx('${t}', { 'data-radix': '${nome}', ...dom, children }); };`;
  const FINTI = {
    react: `
      export const useState = (i) => globalThis.__corrente.useState(i);
      export const useRef = (i) => globalThis.__corrente.useRef(i);
      export const useMemo = (f, d) => globalThis.__corrente.useMemo(f, d);
      export const useEffect = (f, d) => globalThis.__corrente.useEffect(f, d);
      // il pezzo in ritardo è già arrivato quando la prova clicca (come dopo il primo caricamento)
      export const lazy = (f) => { let C = null; f().then((m) => { C = m.default; }); return (p) => (C ? C(p) : null); };
      export const Suspense = (p) => p.children;`,
    "@tanstack/react-router": jsx(
      "export const Link = ({ to, children, ...resto }) => jsx('a', { href: String(to), ...resto, children });",
      "export const useNavigate = () => (o) => { globalThis.__prova.navigazioni.push(o); };",
      "export const useRouterState = (o) => { const s = { isLoading: globalThis.__prova.inAttesa === true }; return o && o.select ? o.select(s) : s; };",
    ),
    "lucide-react": jsx(["SlidersHorizontal", "Check", "X", "Inbox", "ChevronDown"].map(icona).join(" ")),
    "@radix-ui/react-dialog": jsx(
      nota,
      "export const Root = (p) => { const r = (globalThis.__prova.radix = {}); r.Root = p; return p.open ? p.children : null; };",
      "export const Portal = (p) => p.children;",
      pezzo("Overlay", "div"),
      pezzo("Content", "div"),
      pezzo("Title", "h2"),
      pezzo("Description", "p"),
      // Radix: Close chiede a Root di chiudersi (onOpenChange(false))
      "export const Close = (p) => { nota('Close', p); const { children, asChild, ...dom } = p; return jsx('button', { 'data-radix': 'Close', type: 'button', ...dom, onClick: () => globalThis.__prova.radix.Root.onOpenChange(false), children }); };",
    ),
  };
  try {
    const entrata = join(dir, "entrata.tsx");
    writeFileSync(entrata, `export * from ${JSON.stringify(join(radice, FILE))};`);
    const r = await esbuild.build({
      entryPoints: [entrata],
      bundle: true,
      write: false,
      platform: "node",
      format: "cjs",
      jsx: "automatic",
      loader: { ".tsx": "tsx", ".png": "dataurl" },
      alias: { "@": join(radice, "src") },
      absWorkingDir: radice,
      nodePaths: [join(radice, "node_modules")],
      logLevel: "silent",
      define: { "import.meta.env": JSON.stringify({ DEV: false, PROD: true, SSR: false }) },
      plugins: [
        {
          name: "finti",
          setup(b) {
            b.onResolve({ filter: /.*/ }, (a) => (FINTI[a.path] !== undefined && !(a.path === "react" && a.importer.includes("node_modules")) ? { path: a.path, namespace: "finto" } : null));
            b.onLoad({ filter: /.*/, namespace: "finto" }, (a) => ({ contents: FINTI[a.path], loader: "tsx", resolveDir: radice }));
          },
        },
      ],
    });
    const file = join(dir, "filtri.cjs");
    writeFileSync(file, r.outputFiles[0].text);
    return requireQui(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Un orologio finto: `avanza(ms)` fa scattare i timer nell'ordine; `ripristina()` rimette quello vero. */
function orologioFinto() {
  const vero = { s: globalThis.setTimeout, c: globalThis.clearTimeout };
  let ora = 0;
  let n = 0;
  const coda = new Map();
  globalThis.setTimeout = (f, ms = 0) => (coda.set(++n, { f, a: ora + ms }), n);
  globalThis.clearTimeout = (id) => void coda.delete(id);
  return {
    avanza(ms) {
      const fine = ora + ms;
      for (;;) {
        const prossimo = [...coda.entries()].filter(([, x]) => x.a <= fine).sort((a, b) => a[1].a - b[1].a)[0];
        if (!prossimo) break;
        coda.delete(prossimo[0]);
        ora = prossimo[1].a;
        prossimo[1].f();
      }
      ora = fine;
    },
    pendenti: () => coda.size,
    ripristina() {
      globalThis.setTimeout = vero.s;
      globalThis.clearTimeout = vero.c;
    },
  };
}
const attimo = () => new Promise((r) => setImmediate(r));

/** Chi importa `nome` (un file `.tsx` o `.ts` sotto `src/`, esclusi i file stessi). */
function chiImporta(radice, dir, re, saltati) {
  const fuori = [];
  for (const f of readdirSync(join(radice, dir))) {
    const p = join(dir, f);
    if (statSync(join(radice, p)).isDirectory()) fuori.push(...chiImporta(radice, p, re, saltati));
    else if (/\.(tsx?|mjs)$/.test(f) && !saltati.includes(p) && !f.endsWith(".gen.ts") && re.test(readFileSync(join(radice, p), "utf8"))) fuori.push(p);
  }
  return fuori;
}

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T90 · I FILTRI DELLA CATEGORIA (23/11/2026)");
  const T = await caricaTesti(radice);
  const F = mod["shop/cms/vetrina-filtri"];
  const TF = T.TESTI_PROVVISORI.filtri;
  const TC = T.TESTI_SHOP.categoria;
  const mostra = (n) => (n === 1 ? TF.mostraUno : TF.mostra.replace("{n}", n));

  const esiste = [FILE, FILE_FOGLIO].map((f) => existsSync(join(radice, f)));
  c("i due file esistono (FiltriCategoria.tsx e FoglioFiltri.tsx, il foglio in ritardo)", [true, true], esiste);
  if (!esiste.every(Boolean)) return;
  const src = readFileSync(join(radice, FILE), "utf8");
  const srcFoglio = readFileSync(join(radice, FILE_FOGLIO), "utf8");
  const sc = senzaCommenti(src);
  const scFoglio = senzaCommenti(srcFoglio);

  // ════ 1 · I TESTI ═══════════════════════════════════════════════════════════════════════════════════════
  const nuovi = ["chiudi", "mostraUno", "numero", "unProdotto", "togli", "attivi"];
  c("i testi nuovi stanno in `TESTI_PROVVISORI.filtri` (chiudi, mostraUno, numero, unProdotto, togli, attivi) e non sono vuoti", nuovi.map(() => true), nuovi.map((k) => typeof TF[k] === "string" && TF[k].trim() !== ""));
  c("i testi dei filtri non hanno parole vietate né segnaposti sconosciuti", [], Object.entries(TF).flatMap(([, s]) => trovaParoleVietate(s.replace(/\{(?:n|nome)\}/g, "x"))));
  c("i segnaposto sono solo {n} e {nome}: `mostra`, `numero` con {n}; `togli` con {nome}", [true, true, true], [TF.mostra.includes("{n}"), TF.numero.includes("{n}"), TF.togli.includes("{nome}")]);
  c("niente «da confermare» né doppia graffa nei due file, nemmeno nei commenti", [false, false, false, false], [/da confermare/i.test(src), src.includes("{" + "{"), /da confermare/i.test(srcFoglio), srcFoglio.includes("{" + "{")]);
  const loose = (s) => [...(s.match(/\s(?:aria-label|placeholder|title|alt)="[^"]+"/g) ?? []), ...(s.match(/>[^<>{}=;()]*[A-Za-zÀ-ÿ]{3,}[^<>{}=;()]*</g) ?? []).map((x) => x.trim())];
  c("nessun testo scritto nei componenti: né etichette fra virgolette né parole fra i tag (tutto da `testi-shop.ts`)", [[], []], [loose(sc), loose(scFoglio)]);

  // ════ 2 · IL SORGENTE: riuso, fogli, misure ═══════════════════════════════════════════════════════════════
  c("usa la logica di T77: gruppiDaProdotti, leggiFiltri, scriviFiltri, applicaFiltri, chipAttivi, filtriAttivi, togliFiltro", true, ["gruppiDaProdotti", "leggiFiltri", "scriviFiltri", "applicaFiltri", "chipAttivi", "filtriAttivi", "togliFiltro"].every((n) => new RegExp(`\\b${n}\\(`).test(sc)));
  c("usa il riduttore `foglio` di T105 (apri, chiudi, `FOGLIO_CHIUSO`) per il fuoco che torna al bottone", true, /\bfoglio\(/.test(sc) && /FOGLIO_CHIUSO/.test(sc) && /fuocoA/.test(sc));
  c("non riscrive le regole di T77: nessuna di quelle funzioni è definita qui, nessun `filter`/`some` sulle varianti", [false, false], [/(?:function|const)\s+(?:gruppiDaProdotti|leggiFiltri|scriviFiltri|applicaFiltri|chipAttivi|filtriAttivi|togliFiltro|conteggio)\b/.test(sc), /\.varianti\b/.test(sc)]);
  c("la barra e gli scheletri riusano `Scheletro` (T83) e `StatoVuoto` (T83): niente timer né 300 scritti qui", [true, true, false, false], [/from "@\/components\/shop\/Scheletro"/.test(sc), /from "@\/components\/shop\/StatoVuoto"/.test(sc), /setTimeout|clearTimeout/.test(sc + scFoglio), /\b300\b/.test(sc + scFoglio)]);
  c("il foglio si carica in ritardo (`lazy(import(\"./FoglioFiltri\"))`) e Radix sta solo nel foglio: nessuna importazione fissa nella pagina", [true, false, false, true], [/lazy\(\(\) => import\("\.\/FoglioFiltri"\)\)/.test(sc), /from "@radix-ui\/react-dialog"/.test(sc), /^import .* from "\.\/FoglioFiltri"/m.test(sc), /from "@radix-ui\/react-dialog"/.test(scFoglio)]);
  c("il foglio è modale (fuoco intrappolato lo dà Radix): niente `modal={false}`, niente `forceMount`", [false, false], [/modal=\{false\}/.test(scFoglio), /forceMount/.test(scFoglio)]);
  c("il foglio ha titolo (Dialog.Title), senza descrizione ma dichiarato (`aria-describedby={undefined}`), X da 44 px, sfondo che si dissolve e foglio dal basso (`shop-dissolvi`, `shop-foglio`)", [true, true, true, true, true], [/Dialog\.Title/.test(scFoglio), /aria-describedby=\{undefined\}/.test(scFoglio), /Dialog\.Close/.test(scFoglio) && /size-11|h-11 w-11/.test(scFoglio), /shop-dissolvi/.test(scFoglio), /shop-foglio/.test(scFoglio)]);
  c("alla chiusura Radix non manda il fuoco a caso: `onCloseAutoFocus` fa `preventDefault` e chiama `onRendiFuoco`", [true, true], [/onCloseAutoFocus/.test(scFoglio) && /preventDefault\(\)/.test(scFoglio), /onRendiFuoco\(\)/.test(scFoglio)]);
  c("il fuoco si restituisce da un gestore, mai da un effetto che riparte a ogni disegno", false, /useEffect\([^)]*fuoco/i.test(sc));
  c("nessuna sfocatura dello sfondo (V1-H3): niente `backdrop-` né `blur`", [false, false], [/backdrop-|\bblur\b|blur-/.test(sc + scFoglio), /shadow-galleggiante[^"]*\bborder\b|\bborder\b[^"]*shadow-galleggiante/.test(sc + scFoglio)]);
  c("niente `window`, `document` o `localStorage` (il server disegna la categoria)", [false, false, false], [/\bwindow\b/.test(sc + scFoglio), /\bdocument\b/.test(sc + scFoglio), /localStorage/.test(sc + scFoglio)]);
  c("i bersagli sono da 44 px (`min-h-11` / `size-11`) e ogni controllo ha l'anello di fuoco (`shop-anello`)", [true, true], [conta(sc, "min-h-11") + conta(sc, "size-11") >= 4, conta(sc, "shop-anello") >= 4]);
  c("design: nessun bordo laterale colorato (`border-l-`/`border-r-` oltre 1 px), nessuna `shadow` di decorazione sulle pillole", [false, false], [/border-[lr]-(?:\[|[2-9])/.test(sc + scFoglio), /shadow-(?:md|lg|xl)/.test(sc + scFoglio)]);
  c("non è montato in nessuna route né componente (lo monta T95)", [], chiImporta(radice, "src", /categoria\/(?:FiltriCategoria|FoglioFiltri)/, [FILE, FILE_FOGLIO]));

  // ════ 3 · IL MARCHIO ════════════════════════════════════════════════════════════════════════════════════
  const PATCH = PRODOTTI.filter((p) => p.tipo === "patch");
  const gruppi = F.gruppiDaProdotti(PATCH);
  const conValori = gruppi.filter((g) => g.tipo !== "interruttore");
  const nValori = conValori.reduce((n, g) => n + g.valori.length, 0);
  const SEGNO = (n) => `[[visibili:${n}]]`;
  const disegna = (props, extra = {}) => rendiComponente(radice, join(radice, FILE), "FiltriCategoria", { prodotti: PATCH, search: {}, children: (v) => SEGNO(v.length), ...props }, extra);
  const a = (await disegna({})).html;
  c("con i prodotti di prova i filtri ci sono: Colore, Lunghezza, Misura e «Disponibile» (tutti e soli quelli che esistono davvero)", true, conValori.length >= 2 && gruppi.some((g) => g.tipo === "interruttore"));
  c("colonna dei filtri: `aside` solo dal computer (`hidden lg:block`), con tanti gruppi quanti ne dà T77, tanti valori, e l'interruttore «Disponibile»", [conValori.length, nValori, 1, true, true], [conta(a, "<legend"), conta(a, "aria-pressed="), conta(a, 'role="switch"'), classi(tag(a, "<aside")).includes("hidden") && classi(tag(a, "<aside")).includes("lg:block"), a.includes(`>${TC.filtri.disponibile}<`)]);
  c("i nomi dei gruppi sono quelli dei dati (`legend`)", conValori.map((g) => g.nome), [...a.matchAll(/<legend[^>]*>([^<]*)<\/legend>/g)].map((m) => m[1]));
  const barra = tag(a, 'aria-haspopup="dialog"');
  c("barra del telefono: bottone «Filtra (0)» da 44 px, `aria-expanded=false`, `aria-haspopup=dialog`, nascosta dal computer (`lg:hidden`)", [TC.filtri.filtra.replace("{n}", "0"), true, "false", true], [leggibile(a.slice(a.indexOf(barra), a.indexOf("</button>", a.indexOf(barra)))), classi(barra).includes("min-h-11"), attr(barra, "aria-expanded"), /lg:hidden/.test(a.slice(Math.max(0, a.lastIndexOf("<div", a.indexOf(barra)) - 0), a.indexOf(barra)))]);
  c("la barra sta attaccata sotto l'header (`sticky top-14`, sotto l'header z-30)", [true, true], [/sticky top-14/.test(a), /z-20/.test(a)]);
  c("il foglio non c'è finché non lo si apre (si scarica al primo tocco): nessun `role=dialog` nel disegno", 0, conta(a, 'role="dialog"'));
  c("i prodotti passano dal disegno dato dalla pagina (`children`), tutti se non c'è filtro", true, a.includes(SEGNO(PATCH.length)));
  c("senza filtri attivi: nessun chip, nessun «Azzera filtri»", [0, false], [conta(a, "data-chip"), a.includes(TC.filtri.azzera)]);
  c("la regione che dice quanti prodotti ci sono c'è sempre (`role=status`, `aria-live=polite`) col testo `filtri.numero`", true, new RegExp(`role="status"[^>]*>${TF.numero.replace("{n}", PATCH.length)}<|aria-live="polite"[^>]*>${TF.numero.replace("{n}", PATCH.length)}<`).test(a));

  // un filtro attivo: indirizzo → stato → disegno
  const primo = conValori.find((g) => g.tipo === "campioni") ?? conValori[0];
  const v1 = primo.valori[0];
  const sceltoSearch = { [primo.chiave]: v1.chiave };
  const stato1 = F.leggiFiltri(sceltoSearch, gruppi);
  const n1 = F.applicaFiltri(PATCH, stato1).length;
  const b = (await disegna({ search: sceltoSearch })).html;
  c("con `?" + primo.chiave + "=" + v1.chiave + "`: «Filtra (1)», UN valore premuto, UN chip rimovibile con il nome e il «Togli» di `testi-shop`", [TC.filtri.filtra.replace("{n}", "1"), 1, 1, true], [leggibile(b.slice(b.indexOf(tag(b, 'aria-haspopup="dialog"')), b.indexOf("</button>", b.indexOf(tag(b, 'aria-haspopup="dialog"'))))), conta(b, 'aria-pressed="true"'), conta(b, "data-chip"), b.includes(`aria-label="${TF.togli.replace("{nome}", v1.valore)}"`)]);
  c("con il filtro attivo passano solo i prodotti che lo hanno (stessa `applicaFiltri` di T77) e compare «Azzera filtri»", [true, true], [b.includes(SEGNO(n1)), b.includes(TC.filtri.azzera)]);
  c("ricaricare dà la stessa pagina: l'indirizzo scritto da `scriviFiltri` rilegge lo stesso stato", [stato1, true], [F.leggiFiltri(F.scriviFiltri(stato1), gruppi), (await disegna({ search: F.scriviFiltri(stato1) })).html === b]);
  c("un valore sconosciuto nell'indirizzo si ignora: nessun errore, nessun filtro, tutti i prodotti", true, (await disegna({ search: { colore: "viola-che-non-esiste", altro: "1" } })).html.includes(SEGNO(PATCH.length)));

  // nessun risultato
  const impossibile = (() => {
    for (const g1 of conValori) for (const g2 of conValori) {
      if (g1.chiave >= g2.chiave) continue;
      for (const x of g1.valori) for (const y of g2.valori) {
        const s = { [g1.chiave]: x.chiave, [g2.chiave]: y.chiave };
        if (F.applicaFiltri(PATCH, F.leggiFiltri(s, gruppi)).length === 0) return s;
      }
    }
    return null;
  })();
  c("(i dati di prova hanno due scelte che non stanno insieme)", true, impossibile !== null);
  const vuoto = (await disegna({ search: impossibile ?? {} })).html;
  c("nessun risultato: lo stato vuoto con la frase di `categoria.vuoto` e «Azzera filtri»; le card non si disegnano", [true, true, true, false], [vuoto.includes('data-stato="vuoto"'), leggibile(vuoto).includes(TC.vuoto), leggibile(vuoto).includes(TC.filtri.azzera), vuoto.includes("[[visibili")]);
  c("lo stato vuoto non ha altro pieno: «Azzera filtri» è l'unico bottone pieno (`data-aspetto=pieno`)", 1, conta(vuoto, 'data-aspetto="pieno"'));

  // niente filtri veri
  const SENZA = [{ opzioni: [], varianti: [{ opzioni: {}, disponibile: true }] }];
  const s0 = (await disegna({ prodotti: SENZA })).html;
  c("prodotti senza opzioni: nessun filtro, né barra né colonna (V1-C2: solo filtri che esistono), le card sì", [0, 0, 0, true], [conta(s0, "<aside"), conta(s0, 'aria-haspopup="dialog"'), conta(s0, "<legend"), s0.includes(SEGNO(1))]);
  c("prodotti con tutto disponibile: nessun «Disponibile» (non filtrerebbe niente)", 0, conta((await disegna({ prodotti: PATCH.filter((p) => p.varianti.every((v) => v.disponibile)) })).html, 'role="switch"'));

  // ════ 4 · IL COMPORTAMENTO (esecutore) ═══════════════════════════════════════════════════════════════════
  const orologio = orologioFinto();
  let esito;
  try {
    const banco = await impacchetta(radice);
    await attimo(); // il foglio in ritardo arriva
    const nuovo = (search = {}, extra = {}) => {
      globalThis.__prova = { navigazioni: [], radix: {}, inAttesa: false, ...extra };
      return monta(banco.FiltriCategoria, { prodotti: PATCH, search, children: (v) => SEGNO(v.length) });
    };
    const bottone = (app, p, da) => app.trova((n) => n.tag === "button" && p(n), da);
    const sulBarra = (app) => bottone(app, (n) => n.props["aria-haspopup"] === "dialog");
    const foglioNodo = (app) => app.trova((n) => n.props?.["data-radix"] === "Content");
    const filtro = (app, g, v, da) => bottone(app, (n) => n.props["data-filtro"] === `${g}:${v}`, da);
    const nav = () => globalThis.__prova.navigazioni;

    // ── apre, chiude, restituisce il fuoco ──
    const app = nuovo({ [primo.chiave]: v1.chiave });
    c("all'inizio il foglio non c'è (nessun `Root` di Radix disegnato) e la barra dice «chiuso»", [undefined, false], [globalThis.__prova.radix.Root, sulBarra(app).props["aria-expanded"]]);
    app.esegui(() => sulBarra(app).props.onClick({}));
    const aperto = foglioNodo(app);
    c("il clic sulla barra CAMBIA lo stato: il foglio compare, la barra dice «aperto», Radix riceve `open`", [true, true, true], [!!aperto, sulBarra(app).props["aria-expanded"], globalThis.__prova.radix.Root.open]);
    const titolo = app.trova((n) => n.props?.["data-radix"] === "Title", aperto);
    c("il foglio ha il titolo `filtri.titolo` e il pulsante pieno «Mostra {n} prodotti» col conteggio di T77", [TF.titolo, mostra(n1)], [testoDi(titolo), testoDi(bottone(app, (n) => n.props["data-radix"] === "Close" && n.props["data-aspetto"] === "pieno", aperto) ?? { figli: [] })]);
    const chiusura = globalThis.__prova.radix.Content.onCloseAutoFocus;
    c("Radix riceve `onCloseAutoFocus` (per non mandare il fuoco a caso) e l'elenco dei valori sta DENTRO il foglio", [true, true], [typeof chiusura === "function", !!filtro(app, primo.chiave, v1.chiave, aperto)]);
    // Esc / tocco fuori / X: Radix chiede di chiudere
    app.esegui(() => globalThis.__prova.radix.Root.onOpenChange(false));
    c("Esc (o tocco fuori) CAMBIA lo stato: il foglio sparisce e la barra torna «chiuso»", [undefined, false], [foglioNodo(app), sulBarra(app).props["aria-expanded"]]);
    let impedito = 0;
    const fuochiPrima = app.fuochi;
    chiusura({ preventDefault: () => impedito++ });
    c("alla chiusura Radix non sposta il fuoco (`preventDefault`) e il fuoco torna al bottone «Filtra», una volta", [1, 1, true], [impedito, app.fuochi - fuochiPrima, app.attivo?.props["aria-haspopup"] === "dialog"]);
    chiusura({ preventDefault: () => impedito++ });
    c("il fuoco non si restituisce una seconda volta (nessun fuoco rubato a un disegno successivo)", 1, app.fuochi - fuochiPrima);
    // «Mostra» e X chiudono come Esc
    for (const [nome, cerca] of [["«Mostra n prodotti»", (n) => n.props["data-aspetto"] === "pieno"], ["la X", (n) => n.props["aria-label"] === TF.chiudi]]) {
      app.esegui(() => sulBarra(app).props.onClick({}));
      const prima = app.fuochi;
      const dopoLaChiusura = globalThis.__prova.radix.Content.onCloseAutoFocus;
      app.esegui(() => bottone(app, (n) => n.props["data-radix"] === "Close" && cerca(n), foglioNodo(app)).props.onClick({}));
      dopoLaChiusura({ preventDefault() {} });
      c(`${nome} chiude il foglio e il fuoco torna al bottone «Filtra»`, [undefined, 1], [foglioNodo(app), app.fuochi - prima]);
    }
    app.smonta();

    // ── ogni scelta scrive l'indirizzo ──
    const base = nuovo({});
    base.esegui(() => sulBarra(base).props.onClick({}));
    const dentro = foglioNodo(base);
    const nom = primo.valori.length > 1 ? primo.valori[1] : v1;
    base.esegui(() => filtro(base, primo.chiave, v1.chiave, dentro).props.onClick({}));
    c("scegliere un valore nel foglio naviga UNA volta, senza riempire la cronologia (`replace`) e senza saltare in alto (`resetScroll: false`)", [1, true, false], [nav().length, nav()[0]?.replace, nav()[0]?.resetScroll]);
    c("…con l'indirizzo di `scriviFiltri` e senza toccare gli altri parametri (utm, ecc.)", { utm: "x", [primo.chiave]: v1.chiave }, nav()[0].search({ utm: "x" }));
    c("…e togliendo i filtri vecchi dall'indirizzo (non restano parametri di filtri che non ci sono più)", { utm: "x", [primo.chiave]: v1.chiave }, nav()[0].search({ utm: "x", [primo.chiave]: "vecchio", ...Object.fromEntries(conValori.map((g) => [g.chiave, "vecchio"])) }));
    c("un valore premuto di nuovo si toglie: l'indirizzo non ha più il parametro", { utm: "x" }, (() => { const s = nuovo({ [primo.chiave]: v1.chiave }); s.esegui(() => sulBarra(s).props.onClick({})); s.esegui(() => filtro(s, primo.chiave, v1.chiave, foglioNodo(s)).props.onClick({})); const r = nav().at(-1).search({ utm: "x" }); s.smonta(); return r; })());
    base.smonta();
    if (nom !== v1) {
      const due = nuovo({ [primo.chiave]: v1.chiave });
      due.esegui(() => sulBarra(due).props.onClick({}));
      due.esegui(() => filtro(due, primo.chiave, nom.chiave, foglioNodo(due)).props.onClick({}));
      c("due valori dello stesso gruppo si sommano (dentro un gruppo vale «o»), in ordine alfabetico come scrive T77", F.scriviFiltri({ valori: { [primo.chiave]: [v1.chiave, nom.chiave] }, disponibile: false }), new URLSearchParams(Object.entries(nav().at(-1).search({}))).toString().replace(/%2C/g, ","));
      due.smonta();
    }
    const interr = gruppi.find((g) => g.tipo === "interruttore");
    const dis = nuovo({});
    dis.esegui(() => sulBarra(dis).props.onClick({}));
    dis.esegui(() => bottone(dis, (n) => n.props.role === "switch", foglioNodo(dis)).props.onClick({}));
    c("«Disponibile» è un interruttore (`role=switch`) che scrive `disp=1`", [true, { disp: "1" }], [interr !== undefined, nav().at(-1).search({})]);
    dis.smonta();

    // ── ricaricare dà la stessa pagina; il conteggio del foglio segue lo stato ──
    const dopo = nuovo(nav().length ? { [primo.chiave]: v1.chiave } : {});
    dopo.esegui(() => sulBarra(dopo).props.onClick({}));
    c("dall'indirizzo risale lo stato: «Mostra {n} prodotti» ha il numero giusto e il valore risulta premuto", [mostra(n1), true], [testoDi(bottone(dopo, (n) => n.props["data-aspetto"] === "pieno", foglioNodo(dopo))), filtro(dopo, primo.chiave, v1.chiave, foglioNodo(dopo)).props["aria-pressed"] === true]);
    c("«Azzera filtri» nel foglio naviga all'indirizzo senza filtri (e senza toccare utm)", { utm: "x" }, (() => { dopo.esegui(() => bottone(dopo, (n) => testoDi(n) === TC.filtri.azzera, foglioNodo(dopo)).props.onClick({})); return nav().at(-1).search({ utm: "x", [primo.chiave]: v1.chiave }); })());
    dopo.smonta();

    // ── chip rimovibili ──
    const ch = nuovo({ [primo.chiave]: v1.chiave });
    const chip = ch.trova((n) => n.tag === "button" && n.props["aria-label"] === TF.togli.replace("{nome}", v1.valore));
    ch.esegui(() => chip.props.onClick({}));
    c("il chip rimuove il suo filtro (`togliFiltro` di T77): l'indirizzo non ha più il parametro", [{}], [nav().at(-1).search({ [primo.chiave]: v1.chiave })]);
    ch.smonta();

    // ── nessun risultato: «Azzera filtri» ──
    const vu = nuovo(impossibile);
    const azz = bottone(vu, (n) => testoDi(n) === TC.filtri.azzera && n.props["data-aspetto"] === "pieno");
    vu.esegui(() => azz.props.onClick({}));
    c("nello stato vuoto «Azzera filtri» naviga senza filtri", { utm: "x" }, nav().at(-1).search({ utm: "x", ...impossibile }));
    vu.smonta();

    // ── l'attesa: card vecchie con aria-busy, scheletri solo dopo 300 ms (il timer cambia lo stato) ──
    const at = nuovo({ [primo.chiave]: v1.chiave });
    const busy = () => at.trova((n) => n.props?.["data-griglia"] !== undefined)?.props["aria-busy"];
    const vecchie = () => testoDi(at.albero()).includes(SEGNO(n1));
    c("a riposo: `aria-busy=false`, le card vere, nessuno scheletro, nessun timer", [false, true, 0, 0], [busy(), vecchie(), at.tutti((n) => n.props?.["data-scheletro-card"] !== undefined).length, orologio.pendenti()]);
    globalThis.__prova.inAttesa = true;
    at.ridisegna();
    c("al cambio (il router sta caricando): `aria-busy=true`, si tengono le card VECCHIE, nessuno scheletro, il timer parte", [true, true, 0, 1], [busy(), vecchie(), at.tutti((n) => n.props?.["data-scheletro-card"] !== undefined).length, orologio.pendenti()]);
    orologio.avanza(299);
    c("a 299 ms ancora le card vecchie, nessuno scheletro", [true, 0], [vecchie(), at.tutti((n) => n.props?.["data-scheletro-card"] !== undefined).length]);
    orologio.avanza(1);
    c("a 300 ms il timer CAMBIA lo stato: compaiono gli scheletri (`mostraScheletro`) al posto delle card", [true, false], [at.tutti((n) => n.props?.["data-scheletro-card"] !== undefined).length > 0, vecchie()]);
    globalThis.__prova.inAttesa = false;
    at.ridisegna();
    c("a caricamento finito tornano le card, `aria-busy=false`, nessuno scheletro, nessun timer pendente", [true, false, 0, 0], [vecchie(), busy(), at.tutti((n) => n.props?.["data-scheletro-card"] !== undefined).length, orologio.pendenti()]);
    c("se l'attesa finisce prima dei 300 ms il timer si ferma e non compare nessuno scheletro", [0, true], (() => {
      globalThis.__prova.inAttesa = true;
      at.ridisegna();
      orologio.avanza(100);
      globalThis.__prova.inAttesa = false;
      at.ridisegna();
      orologio.avanza(500);
      return [at.tutti((n) => n.props?.["data-scheletro-card"] !== undefined).length, vecchie()];
    })());
    at.smonta();
    esito = true;
  } finally {
    orologio.ripristina();
    delete globalThis.__prova;
  }
  c("il comportamento è stato provato fino in fondo", true, esito === true);
}
