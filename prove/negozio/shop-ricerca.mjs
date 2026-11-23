/** ── VETRINA V1 · T82b · LA RICERCA DELL'HEADER ───────────────────────────────────────────────────────────────
 *  `src/components/shop/guscio/RicercaShop.tsx`. Cosa deve valere (V1-H3: 5 risultati e Invio; V1-C4 parte; V1-T11; D79, D90, D103):
 *   · il campo è da 48 px con testo da 16 px; sul telefono il tasto è da 44 px e la riga diventa il campo; l'elenco leggero si scarica
 *     SOLO al primo fuoco sul campo (mai al disegno, mai a ogni fuoco), e se il server non risponde si riprova al fuoco dopo;
 *   · la tendina ha al massimo 5 voci (miniatura, nome, prezzo; Invisible Derm senza cifra; senza foto solo testo), frecce/Invio/Esc
 *     passano da `voceEvidenziata`; Invio senza voce evidenziata → `/shop/cerca?q=`; sotto 2 caratteri Invio non fa niente;
 *     Invio durante la composizione di un IME non conta;
 *   · `Search` (D90): dopo 1 s di pausa o con Invio, una volta sola per testo, e il testo esce SOLO se è il nome di un prodotto o di
 *     una categoria del catalogo scaricato («mario rossi», «alopecia», un'email: evento senza testo o nessun evento);
 *   · nessun testo scritto nel componente (tutto da `testi-shop.ts`), nessuna sfocatura, nessun `fbq`/`ttq`/`gtag`.
 *  Due modi di guardare, come per le altre prove dei componenti:
 *   1. il MARCHIO, disegnato con `_rende.mjs` (esbuild + react-dom/server): attributi, misure, voci, foto, prezzi;
 *   2. il COMPORTAMENTO, con un piccolo esecutore di React scritto qui sotto (gli `useState`/`useEffect` girano davvero, il tempo è finto):
 *      senza browser né jsdom si prova che il fuoco, la digitazione, i tasti e il timer da 1 s CAMBIANO lo stato del componente.
 *  Il fuoco vero sul telefono, la tastiera a schermo e `aria-live` che annuncia li guardano T103c e T106 nel browser.
 *  Dati inventati di `_dati-vetrina.mjs`, nessuna rete. */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { CATALOGO, CATALOGO_SENZA_FOTO, CATEGORIE, INVISIBLE_DERM, SCENARIO_50, trovaParoleVietate } from "./_dati-vetrina.mjs";
import { rendiComponente } from "./_rende.mjs";

const requireQui = createRequire(import.meta.url);
/** `testi-shop.ts` non è fra i moduli impacchettati di `prove.mjs`: lo carica ogni prova che lo legge (come `testi-shop.mjs`). */
const caricaTesti = async (radice) => {
  const r = await build({ entryPoints: [join(radice, "src/landing/testi-shop.ts")], bundle: true, write: false, format: "esm", alias: { "@": join(radice, "src") }, logLevel: "silent" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};
const FILE = "src/components/shop/guscio/RicercaShop.tsx";

/* ── piccoli aiuti sul marchio ─────────────────────────────────────────────────────────────────────────────── */
const conta = (testo, ago) => testo.split(ago).length - 1;
const leggibile = (html) => html.replace(/<[^>]*>/g, " ").replace(/ /g, " ").replace(/\s+/g, " ").trim();
/** L'apertura del tag che contiene `segno` (l'intero `<…>`), o `""`. */
function tag(html, segno) {
  const i = html.indexOf(segno);
  if (i < 0) return "";
  return html.slice(html.lastIndexOf("<", i), html.indexOf(">", i) + 1);
}
const attr = (t, nome) => (t.match(new RegExp(`\\s${nome}="([^"]*)"`, "i")) ?? [])[1];
const classi = (t) => (attr(t, "class") ?? "").split(/\s+/).filter(Boolean);

/* ── l'esecutore: React con gli hook veri nello stato, senza schermo ───────────────────────────────────────── */

/** Un componente a funzione montato: `useState`, `useRef`, `useMemo`, `useId`, `useEffect` (con pulizia) funzionano davvero; ogni cambio di
 *  stato ridisegna e rilancia gli effetti. L'albero è fatto di elementi veri (`jsx` di React) espansi fino ai nodi del documento. */
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
    useId() {
      const i = idx++;
      return (hooks[i] ??= { v: `:p${i}:` }).v;
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

  /** I nodi del documento: i componenti a funzione (senza hook) si espandono, i frammenti si aprono. */
  function espandi(n) {
    if (n == null || typeof n === "boolean") return [];
    if (typeof n === "string" || typeof n === "number") return [String(n)];
    if (Array.isArray(n)) return n.flatMap(espandi);
    if (typeof n.type === "function") return espandi(n.type(n.props));
    if (typeof n.type === "symbol") return espandi(n.props.children);
    return [{ tag: n.type, props: n.props, figli: espandi(n.props.children) }];
  }
  /** I `ref` a oggetto diventano un finto nodo con `focus()`: porta il fuoco e fa partire `onFocus`, come il browser. */
  function collega(n) {
    if (typeof n === "string") return;
    const r = n.props.ref;
    if (r && typeof r === "object") {
      const f = (r.current ??= {
        focus() {
          app.attivo = this;
          app.fuochi++;
          if (this.props.onFocus) app.esegui(() => this.props.onFocus({}));
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
  app.albero = () => albero;
  app.tutti = (p, da = albero, fuori = []) => {
    if (typeof da === "string") return fuori;
    if (p(da)) fuori.push(da);
    da.figli.forEach((f) => app.tutti(p, f, fuori));
    return fuori;
  };
  app.trova = (p) => app.tutti(p)[0];
  app.smonta = () => {
    vivo = false;
    for (const h of hooks) if (h && typeof h.pulizia === "function") h.pulizia();
  };
  disegna();
  return app;
}

const testoDi = (n) => (typeof n === "string" ? n : n.figli.map(testoDi).join(""));

/** Il componente vero impacchettato con i finti del router, del server, dell'evento e delle icone, e con `react` sostituito dall'esecutore. */
async function impacchettaRicerca(radice) {
  const esbuild = requireQui(join(radice, "node_modules/esbuild"));
  const dir = mkdtempSync(join(tmpdir(), "prova-ricerca-"));
  const jsx = (t, p) => `import { jsx } from "react/jsx-runtime"; ${t} ${p}`;
  const FINTI = {
    react: `export const useState = (i) => globalThis.__corrente.useState(i); export const useRef = (i) => globalThis.__corrente.useRef(i); export const useMemo = (f, d) => globalThis.__corrente.useMemo(f, d); export const useId = () => globalThis.__corrente.useId(); export const useEffect = (f, d) => globalThis.__corrente.useEffect(f, d);`,
    "@tanstack/react-router": jsx(
      "export const Link = ({ to, params, children, ...resto }) => jsx('a', { href: String(to).replace(/\\$(\\w+)/g, (_, k) => encodeURIComponent((params ?? {})[k] ?? '')), ...resto, children });",
      "export const useNavigate = () => (o) => { globalThis.__prova.navigazioni.push(o); };",
    ),
    "lucide-react": jsx("export const Search = (p) => jsx('svg', { 'data-icona': 'Search', ...p });", "export const X = (p) => jsx('svg', { 'data-icona': 'X', ...p });"),
    "@/lib/tracciamento/api": `export const emettiEvento = (n, d) => { globalThis.__prova.eventi.push([n, d]); return "id"; };`,
    "@/shop/cms/catalogo.functions": `export const elencoProdotti = (a) => globalThis.__prova.elencoProdotti(a);`,
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
            // `react` lo sostituisce l'esecutore solo per il codice nostro; i pacchetti (jsx-runtime) restano quelli veri
            b.onResolve({ filter: /.*/ }, (a) => (FINTI[a.path] !== undefined && !(a.path === "react" && a.importer.includes("node_modules")) ? { path: a.path, namespace: "finto" } : null));
            b.onLoad({ filter: /.*/, namespace: "finto" }, (a) => ({ contents: FINTI[a.path], loader: "tsx", resolveDir: radice }));
          },
        },
      ],
    });
    const file = join(dir, "ricerca.cjs");
    writeFileSync(file, r.outputFiles[0].text);
    return requireQui(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Un orologio finto: `avanza(ms)` fa scattare i timer nell'ordine; si rimette a posto con `ripristina()`. */
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

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T82b · LA RICERCA DELL'HEADER (23/11/2026)");
  const T = await caricaTesti(radice);
  const K = mod["shop/cms/vetrina-ricerca"];
  const CARD = mod["shop/cms/vetrina-card"];
  const GUSCIO = T.TESTI_PROVVISORI.guscio;
  const RICERCA = T.TESTI_PROVVISORI.ricerca;

  const file = join(radice, FILE);
  const esiste = existsSync(file);
  c("il file esiste (src/components/shop/guscio/RicercaShop.tsx)", true, esiste);
  if (!esiste) return;
  const src = readFileSync(file, "utf8");
  const senzaCommenti = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");

  // ════ 1 · IL SORGENTE: testi, regole, misure ══════════════════════════════════════════════════════════════
  c("i testi nuovi stanno in testi-shop.ts (chiudi, risultati, un risultato) e non sono vuoti", [true, true, true], [RICERCA.chiudi, RICERCA.risultati, RICERCA.unRisultato].map((s) => typeof s === "string" && s.trim() !== ""));
  c("i testi nuovi non hanno parole vietate né segnaposti", [], [...Object.values(RICERCA)].flatMap((s) => trovaParoleVietate(s)));
  c("nessun «da confermare» né doppia graffa nel file, nemmeno nei commenti", [false, false], [/da confermare/i.test(src), src.includes("{" + "{")]);
  c("nessuna sfocatura dello sfondo (V1-H3): niente `backdrop-` né `blur`", [false, false], [/backdrop-/.test(src), /\bblur\b|blur-/.test(src)]);
  c("nessun tracciamento diretto: né fbq né ttq né gtag (D90); si emette con `emettiEvento`", [false, false, false, true], [/\bfbq\b/.test(src), /\bttq\b/.test(src), /\bgtag\b/.test(src), /import \{ emettiEvento \} from "@\/lib\/tracciamento\/api"/.test(src)]);
  c("nessun testo scritto nel componente: né etichette né segnaposto tra virgolette (solo `alt=\"\"` vuoto)", [], senzaCommenti.match(/\s(?:aria-label|placeholder|title|alt)="[^"]+"/g) ?? []);
  c("nessun testo fra i tag del JSX (tutto viene da testi-shop.ts)", [], (senzaCommenti.match(/>[^<>{}=;()]*[A-Za-zÀ-ÿ]{3,}[^<>{}=;()]*</g) ?? []).map((s) => s.trim()));
  c("le parole del campo e del tasto vengono dai testi (`header.ricerca`, `guscio.cerca`, `ricerca.chiudi`)", [true, true, true], [/header\.ricerca/.test(src), /guscio\.cerca|GUSCIO\.cerca/.test(src), /TESTI\.chiudi/.test(src)]);
  c("usa i moduli di T77/T79/T105 e non riscrive le loro regole: cerca, 5 voci, tasti, evento, vocabolario, pausa", true, [
    /cercaNeiLeggeri/, /suggerimenti\(/, /voceEvidenziata\(/, /tendinaDopoDigitazione\(/, /eventoCerca\(/, /vocabolarioRicerca\(/, /creaEmettitoreRicerca\(/, /soloLeggere\(/,
  ].every((re) => re.test(senzaCommenti)));
  c("il 5, il 2 e il secondo di pausa non sono scritti a mano (vengono da `MAX_SUGGERIMENTI`, `MIN_CARATTERI_RICERCA`, `PAUSA_RICERCA_MS`)", [false, false, false], [/slice\(0, ?5\)|\b5\b(?!\d)/.test(senzaCommenti.replace(/h-5|w-5|-5\b|\b5\)/g, "")), /length (?:>=|<) ?2\b/.test(senzaCommenti), /\b1000\b/.test(senzaCommenti)]);
  c("design: nessun bordo laterale colorato sulle voci (`border-l-`/`border-r-` oltre 1 px), nessuna ombra sotto un bordo (un'elevazione sola)", [false, false], [/border-[lr]-(?:\[|[2-9])/.test(src), /border[^"]*shadow-galleggiante|shadow-galleggiante[^"]*\bborder\b/.test(src)]);
  c("la voce evidenziata si vede anche senza il colore: anello interno (`ring-2 ring-inset`)", true, /ring-2 ring-inset/.test(src));
  c("il campo è da 48 px (`h-12`) col testo da 16 px (`text-base`); i tasti da 44 px (`h-11 w-11`)", [true, true, true], [/h-12/.test(src), /text-base/.test(src), /h-11 w-11/.test(src)]);
  c("l'elenco si scarica in una funzione sola (`elencoProdotti` chiamato una volta nel sorgente), non nel corpo del componente", 1, conta(senzaCommenti, "elencoProdotti({"));
  c("niente `window`, `document` o `localStorage` mentre si disegna (il server disegna l'header)", [false, false, false], [/\bwindow\b/.test(senzaCommenti), /\bdocument\b/.test(senzaCommenti), /localStorage/.test(senzaCommenti)]);
  c("gli ascolti si tolgono: la pausa si ferma allo smontaggio (`useEffect(() => ricerca.ferma`)", true, /useEffect\(\(\) => ricerca\.ferma, \[ricerca\]\)/.test(senzaCommenti));

  // ════ 2 · IL MARCHIO: componente disegnato davvero ═══════════════════════════════════════════════════════════
  const categorie = CATEGORIE;
  const disegna = (nome, props, extra = {}) => rendiComponente(radice, file, nome, props, extra);
  const iniziale = await disegna("RicercaShop", { categorie }, { server: { elencoProdotti: CATALOGO } });
  const h = iniziale.html;
  c("al disegno NON si scarica niente (l'elenco parte solo dal primo fuoco)", [], iniziale.pagina.chiamate);
  const input = tag(h, "<input");
  const lista = tag(h, 'role="listbox"');
  c("il campo è un combobox di ricerca chiuso: type, ruolo, aria-expanded, aria-autocomplete, elenco collegato", ["search", "combobox", "false", "list", true], [attr(input, "type"), attr(input, "role"), attr(input, "aria-expanded"), attr(input, "aria-autocomplete"), !!attr(input, "aria-controls") && attr(input, "aria-controls") === attr(lista, "id")]);
  c("niente correzioni automatiche né maiuscole; il tasto della tastiera del telefono dice «cerca»", ["off", "search", "off"], [attr(input, "autocomplete"), attr(input, "enterkeyhint"), attr(input, "autocapitalize")]);
  c("il campo ha il suo nome (`guscio.cerca`) e il suggerimento del documento (`header.ricerca`)", [GUSCIO.cerca, T.TESTI_SHOP.header.ricerca], [attr(input, "aria-label"), attr(input, "placeholder")]);
  c("il campo è alto 48 px e scrive a 16 px (V1-T11: mai lo zoom del telefono)", [true, true], [classi(input).includes("h-12"), classi(input).includes("text-base")]);
  const lente = tag(h, `aria-label="${GUSCIO.cerca}" aria-expanded`);
  c("sul telefono c'è il tasto della ricerca: 44 × 44, `type=button`, visibile solo sotto il computer, chiuso", [true, true, true, "button", "false"], [classi(lente).includes("h-11"), classi(lente).includes("w-11"), classi(lente).includes("lg:hidden"), attr(lente, "type"), attr(lente, "aria-expanded")]);
  const chiudi = tag(h, `aria-label="${RICERCA.chiudi}"`);
  c("c'è il tasto per chiudere il campo sul telefono: 44 × 44, solo sul telefono", [true, true, true], [classi(chiudi).includes("h-11"), classi(chiudi).includes("w-11"), classi(chiudi).includes("lg:hidden")]);
  const ricercaTag = tag(h, 'role="search"');
  c("il blocco è una regione di ricerca; chiuso, sul telefono non si vede (`hidden`), sul computer sì (`lg:block`)", [true, true, true], [ricercaTag !== "", classi(ricercaTag).includes("hidden"), classi(ricercaTag).includes("lg:block")]);
  c("la regione che dice a voce quanti risultati ci sono c'è sempre, anche vuota (una regione nuova non verrebbe letta)", true, /<[^>]*role="status"[^>]*aria-live="polite"[^>]*><\/[a-z]+>|<[^>]*aria-live="polite"[^>]*role="status"[^>]*><\/[a-z]+>/.test(h));
  c("l'elenco delle voci c'è già, nascosto, e senza voci", [true, 0], [/<ul[^>]*role="listbox"[^>]*hidden/.test(h) || /<ul[^>]*hidden[^>]*role="listbox"/.test(h), conta(h, 'role="option"')]);
  c("il campo è l'unico punto di tabulazione della ricerca sul computer (più i due tasti del telefono)", 3, conta(h, "<button") + conta(h, "<input"));

  // ── la tendina disegnata con voci vere ──
  const carte = CARD.soloLeggere(CATALOGO);
  const alfa = carte.find((x) => x.slug === "patch-prova-alfa");
  const delta = carte.find((x) => x.slug === "patch-prova-delta");
  const shampoo = carte.find((x) => x.slug === "shampoo-prova");
  const derm = carte.find((x) => x.slug === INVISIBLE_DERM.slug);
  const cinque = [alfa, delta, shampoo, carte.find((x) => x.slug === "balsamo-prova"), derm];
  const t5 = await disegna("VociRicerca", { id: "lista-x", voci: cinque, indice: 2, aperta: true, onScegli: () => {} }, {});
  const opzioni = [...t5.html.matchAll(/<a[^>]*role="option"[\s\S]*?<\/a>/g)].map((m) => m[0]);
  c("5 voci, ognuna col suo ruolo e il suo id (lista-x-0 … lista-x-4)", [5, ["lista-x-0", "lista-x-1", "lista-x-2", "lista-x-3", "lista-x-4"]], [opzioni.length, opzioni.map((o) => attr(o, "id"))]);
  c("l'elenco ha il ruolo, l'id e un nome; aperta non è `hidden`", [true, "lista-x", false], [/role="listbox"/.test(t5.html), attr(tag(t5.html, 'role="listbox"'), "id"), /<ul[^>]*\shidden/.test(t5.html)]);
  c("evidenziata solo la voce 2 (`aria-selected`)", ["false", "false", "true", "false", "false"], opzioni.map((o) => attr(o, "aria-selected")));
  c("ogni voce è UN SOLO elemento, il link alla scheda con il ruolo di opzione (niente di interattivo dentro un'opzione), fuori dalla tabulazione", [true, true], [opzioni.every((o) => conta(o, "<a ") === 1 && /href="\/shop\/prodotto\/[a-z-]+"/.test(o)), opzioni.every((o) => attr(tag(o, "<a "), "tabindex") === "-1")]);
  c("i link vanno ai prodotti giusti, nell'ordine ricevuto", cinque.map((x) => `/shop/prodotto/${x.slug}`), opzioni.map((o) => attr(tag(o, "<a "), "href")));
  c("ogni voce ha il nome del prodotto", cinque.map((x) => x.nome), opzioni.map((o) => leggibile(o).replace(/\s*(Da )?\d[\d.,]*\s*€\s*$/, "")));
  c("la miniatura è una foto vera della card (480, lazy, `alt` vuoto: il nome è lì accanto), un solo `<img>` per voce con foto", [5, 5, 5, 5], [conta(t5.html, "<img"), opzioni.filter((o) => attr(tag(o, "<img"), "alt") === "").length, opzioni.filter((o) => attr(tag(o, "<img"), "loading") === "lazy").length, opzioni.filter((o) => /src="https:\/\/prova\.test\/shop-media\/[a-z-]+-principale-480\.webp"/.test(o)).length]);
  c("prezzo «Da …» (testo di `card.da`) per le patch con varianti a prezzi diversi: Alfa 289,00 €, Delta 249,00 €", [T.TESTI_PROVVISORI.card.da.replace("{prezzo}", "289,00 €"), T.TESTI_PROVVISORI.card.da.replace("{prezzo}", "249,00 €")], [leggibile(opzioni[0]).match(/Da [\d,.]+ €/)?.[0], leggibile(opzioni[1]).match(/Da [\d,.]+ €/)?.[0]]);
  c("prezzo senza «Da» quando le varianti costano uguale (il balsamo ha una sola variante)", ["16,90 €"], [leggibile(opzioni[3]).match(/[\d,.]+ €/)?.[0]]);
  c("Invisible Derm: il nome e basta, nessuna cifra, nessun «€», nessun «Aggiungi» (V1-T6)", [false, false, false, true], [/\d/.test(leggibile(opzioni[4]).replace(INVISIBLE_DERM.nome, "")), /€/.test(opzioni[4]), /Aggiungi/i.test(opzioni[4]), leggibile(opzioni[4]).includes(INVISIBLE_DERM.nome)]);
  c("niente più di 5 voci anche se se ne danno 9: lo decide `suggerimenti`, qui si disegna ciò che arriva", true, K.suggerimenti(carte).length === 5);
  const senzaFoto = await disegna("VociRicerca", { id: "lista-y", voci: CARD.soloLeggere(CATALOGO_SENZA_FOTO).slice(0, 3), indice: null, aperta: true, onScegli: () => {} }, {});
  c("senza foto: solo testo, nessun `<img>` e nessun riquadro vuoto (mai il segnaposto)", [0, 0, 3], [conta(senzaFoto.html, "<img"), conta(senzaFoto.html, "aspect-ratio"), conta(senzaFoto.html, 'role="option"')]);
  c("nessuna voce evidenziata: nessun `aria-selected=\"true\"`", 0, conta(senzaFoto.html, 'aria-selected="true"'));
  const chiusa = await disegna("VociRicerca", { id: "lista-z", voci: cinque, indice: null, aperta: false, onScegli: () => {} }, {});
  c("chiusa: l'elenco è `hidden`", true, /<ul[^>]*\shidden/.test(chiusa.html));
  const html5 = t5.html;
  c("nessuna stella, nessun barrato, nessun «Aggiungi»: la tendina porta alla scheda, non compra", [false, false, false], [/★|⭐/.test(html5), /line-through|<del|<s>/.test(html5), /Aggiungi/i.test(html5)]);
  c("nessuna parola vietata nel marchio della tendina e del campo", [], [...trovaParoleVietate(html5.replace(/<[^>]*>/g, " ")), ...trovaParoleVietate(h.replace(/<[^>]*>/g, " "))]);

  // ════ 3 · IL COMPORTAMENTO: stato che cambia davvero ═════════════════════════════════════════════════════════
  const M = await impacchettaRicerca(radice);
  const nuovaProva = (dati = CATALOGO) => {
    const p = {
      eventi: [],
      navigazioni: [],
      chiamate: 0,
      risposta: null,
      elencoProdotti: async () => {
        p.chiamate++;
        if (p.risposta) return p.risposta;
        return dati;
      },
    };
    globalThis.__prova = p;
    return p;
  };
  const evento = (e = {}) => ({ key: "", nativeEvent: { isComposing: false }, preventDefault() { this.fermato = true; }, ...e });
  /** La prova guarda come l'utente: cerca i nodi di nuovo a ogni passo (dopo ogni ridisegno gli handler sono nuovi). */
  const vista = (app) => {
    const campo = () => app.trova((n) => n.tag === "input");
    const l = () => app.trova((n) => n.tag === "button" && n.props["aria-label"] === GUSCIO.cerca);
    const x = () => app.trova((n) => n.tag === "button" && n.props["aria-label"] === RICERCA.chiudi);
    const regione = () => app.trova((n) => n.props.role === "search");
    const voci = () => app.tutti((n) => n.props.role === "option");
    const stato = () => app.trova((n) => n.props.role === "status");
    return {
      campo,
      lente: l,
      chiudiTasto: x,
      regione,
      voci,
      stato,
      aperta: () => campo().props["aria-expanded"],
      attiva: () => campo().props["aria-activedescendant"] ?? null,
      selezionate: () => voci().map((o) => o.props["aria-selected"]),
      fuoco: () => app.attivo?.props?.role === "combobox" ? "campo" : app.attivo?.props?.["aria-label"] === GUSCIO.cerca ? "lente" : app.attivo ? "altro" : null,
      scrivi(v) { app.esegui(() => campo().props.onChange({ target: { value: v } })); },
      tasto(k, extra = {}) { const e = evento({ key: k, ...extra }); app.esegui(() => campo().props.onKeyDown(e)); return e; },
      suFuoco() { app.esegui(() => campo().props.onFocus({})); },
      fuori(verso = null) { app.esegui(() => regione().props.onBlur({ currentTarget: { contains: (x2) => x2 !== null && x2 === verso }, relatedTarget: verso })); },
      clic(nodo) { const e = evento(); app.esegui(() => nodo.props.onClick(e)); return e; },
    };
  };
  const PAUSA = 1000;
  const montaRicerca = (props = { categorie }) => {
    const app = monta(M.RicercaShop, props);
    return { app, v: vista(app) };
  };

  // ── 3.1 · l'elenco si scarica solo al primo fuoco ──
  {
    const p = nuovaProva();
    const { app, v } = montaRicerca();
    c("montato: nessuna chiamata al server, tendina chiusa", [0, false], [p.chiamate, v.aperta()]);
    v.suFuoco();
    c("primo fuoco: UNA chiamata", 1, p.chiamate);
    v.suFuoco();
    c("secondo fuoco con la prima in corso: ancora una sola chiamata", 1, p.chiamate);
    await attimo();
    v.suFuoco();
    v.fuori();
    v.suFuoco();
    c("a elenco arrivato: ogni altro fuoco non scarica più niente", 1, p.chiamate);
    app.smonta();
  }

  // ── 3.2 · digitazione: tendina di 5, minimo 2 caratteri, stato vuoto ──
  {
    const p = nuovaProva();
    const { app, v } = montaRicerca();
    v.suFuoco();
    await attimo();
    v.scrivi("p");
    c("una lettera: tendina chiusa, nessuna voce", [false, 0], [v.aperta(), v.voci().length]);
    v.scrivi("prova");
    c("«prova» (9 prodotti nel catalogo): la tendina si apre con 5 voci e basta", [true, 5], [v.aperta(), v.voci().length]);
    c("le 5 sono le prime 5 di `cercaNeiLeggeri` (stesso ordine della pagina dei risultati)", K.suggerimenti(K.cercaNeiLeggeri(CARD.soloLeggere(CATALOGO), "prova")).map((x) => x.nome), v.voci().map((o) => testoDi(o).replace(/\s*(Da )?\d[\d., ]*\s*€\s*$/, "").trim()));
    c("nessuna voce evidenziata appena si scrive", [null, [false, false, false, false, false]], [v.attiva(), v.selezionate()]);
    c("lo schermo parlato sente «5 risultati»", T.riempi(RICERCA.risultati, { n: 5 }), testoDi(v.stato()));
    v.scrivi("patch di prova alfa");
    c("una sola corrispondenza: una voce e «1 risultato»", [1, RICERCA.unRisultato], [v.voci().length, testoDi(v.stato())]);
    v.scrivi("PAT-BETA");
    c("per codice (SKU) in maiuscolo: trova la patch Beta", [1, true], [v.voci().length, testoDi(v.voci()[0]).includes("Beta")]);
    v.scrivi("zzzz");
    c("nessun risultato: la tendina resta chiusa e la regione tace", [false, 0, ""], [v.aperta(), v.voci().length, testoDi(v.stato())]);
    c("Invio sul testo che non trova niente porta comunque alla pagina dei risultati (là c'è lo stato vuoto con 4 prodotti)", [{ to: "/shop/cerca", search: { q: "zzzz" } }], (v.tasto("Enter"), p.navigazioni));
    app.smonta();
  }

  // ── 3.3 · tastiera: frecce, Invio, Esc (voceEvidenziata) ──
  {
    const p = nuovaProva();
    const { app, v } = montaRicerca();
    v.suFuoco();
    await attimo();
    v.scrivi("prova");
    const nomi = v.voci().length;
    const giu = v.tasto("ArrowDown");
    c("freccia giù: evidenzia la prima, il campo la nomina (`aria-activedescendant`) e il tasto è preso (niente scorrimento della pagina)", [[true, false, false, false, false], true, true], [v.selezionate(), v.attiva() === v.voci()[0].props.id && !!v.attiva(), giu.fermato === true]);
    const fuochiPrima = app.fuochi;
    for (let i = 0; i < 4; i++) v.tasto("ArrowDown");
    c("dopo cinque frecce è sull'ultima", [false, false, false, false, true], v.selezionate());
    v.tasto("ArrowDown");
    c("giù ancora: torna alla prima (gira)", true, v.selezionate()[0]);
    v.tasto("ArrowUp");
    c("su dalla prima: va all'ultima", true, v.selezionate()[nomi - 1]);
    v.tasto("ArrowUp");
    v.tasto("ArrowUp");
    const terza = v.voci()[2].props.id;
    c("un altro tasto qualunque non cambia la voce", terza, (v.tasto("a"), v.attiva()));
    c("il fuoco non si sposta mentre si scorre: nessuna chiamata a `focus()` durante le frecce (resta nel campo, mai sulla voce)", fuochiPrima, app.fuochi);
    p.navigazioni.length = 0;
    const e = v.tasto("Enter");
    const lista5 = K.suggerimenti(K.cercaNeiLeggeri(CARD.soloLeggere(CATALOGO), "prova"));
    c("Invio su una voce evidenziata apre quella scheda (non la ricerca)", [[{ to: "/shop/prodotto/$slug", params: { slug: lista5[2].slug } }], true], [p.navigazioni, e.fermato === true]);
    c("dopo l'Invio la tendina si chiude", false, v.aperta());
    v.tasto("ArrowDown");
    c("freccia giù a tendina chiusa con risultati: si riapre sulla prima", [true, true], [v.aperta(), v.selezionate()[0]]);
    const esc = v.tasto("Escape");
    c("Esc a tendina aperta la chiude e prende il tasto", [false, true], [v.aperta(), esc.fermato === true]);
    c("il testo scritto resta nel campo", "prova", v.campo().props.value);
    const navPrima = p.navigazioni.length;
    const escDaChiusa = v.tasto("Escape");
    c("Esc a tendina chiusa (computer) non fa niente e non si prende il tasto (spetta alla pagina)", [false, navPrima], [escDaChiusa.fermato === true, p.navigazioni.length]);
    // il mouse sulla voce non porta via il fuoco al campo
    const premuto = evento();
    app.esegui(() => app.trova((n) => n.tag === "a").props.onMouseDown(premuto));
    c("il clic del mouse su una voce non toglie il fuoco al campo (`mousedown` fermato)", true, premuto.fermato === true);
    // Invio senza voce evidenziata
    p.navigazioni.length = 0;
    v.scrivi("prova");
    v.tasto("Enter");
    c("Invio senza voce evidenziata: `/shop/cerca` con il solo testo", [{ to: "/shop/cerca", search: { q: "prova" } }], p.navigazioni);
    p.navigazioni.length = 0;
    v.scrivi("  prova   alfa ");
    v.tasto("Enter");
    c("il testo nell'indirizzo è pulito: spazi ridotti, senza spazi ai bordi", [{ to: "/shop/cerca", search: { q: "prova alfa" } }], p.navigazioni);
    //  T100a: `to` e `search` tipati. Con un indirizzo scritto a mano «1e3» veniva riletto come il numero 1000: ora la ricerca porta il testo com'è, come stringa
    p.navigazioni.length = 0;
    v.scrivi("1e3");
    v.tasto("Enter");
    c("«1e3» (e simili) va a `/shop/cerca` come testo, in `search` (stringa), mai in un indirizzo scritto a mano", [[{ to: "/shop/cerca", search: { q: "1e3" } }], "string"], [p.navigazioni, typeof p.navigazioni[0]?.search?.q]);
    for (const q of ["0x10", "12345", "true"]) { p.navigazioni.length = 0; v.scrivi(q); v.tasto("Enter"); c(`«${q}» resta la stringa «${q}» nella ricerca`, [q, "string"], [p.navigazioni[0]?.search?.q, typeof p.navigazioni[0]?.search?.q]); }
    // minimo 2 caratteri
    p.navigazioni.length = 0;
    v.scrivi("a");
    const unaLettera = v.tasto("Enter");
    v.scrivi("   ");
    v.tasto("Enter");
    v.scrivi("");
    v.tasto("Enter");
    c("Invio con meno di 2 caratteri (una lettera, spazi, vuoto): nessuna navigazione, e il tasto è preso", [[], true], [p.navigazioni, unaLettera.fermato === true]);
    // IME
    v.scrivi("prova");
    p.navigazioni.length = 0;
    const ime = v.tasto("Enter", { nativeEvent: { isComposing: true } });
    c("Invio mentre si compone con una tastiera a caratteri (IME): non conta, non naviga, non prende il tasto", [[], false], [p.navigazioni, ime.fermato === true]);
    app.smonta();
  }

  // ── 3.4 · telefono: la riga diventa il campo ──
  {
    const p = nuovaProva();
    const { app, v } = montaRicerca();
    c("chiuso: la lente dice «chiuso» e la riga del campo è nascosta sul telefono", [false, true], [v.lente().props["aria-expanded"], v.regione().props.className.split(/\s+/).includes("hidden")]);
    app.esegui(() => v.lente().props.onClick(evento()));
    const cl = v.regione().props.className.split(/\s+/);
    c("tocco sulla lente: la riga diventa il campo (a tutta larghezza, sopra l'header) e la lente dice «aperto»", [true, true, true], [cl.includes("fixed") && cl.includes("inset-x-0") && cl.includes("flex"), !cl.includes("hidden"), v.lente().props["aria-expanded"]]);
    c("il fuoco va al campo (effetto dopo il tocco) e quel fuoco FA SCARICARE l'elenco, una volta", ["campo", 1], [v.fuoco(), p.chiamate]);
    await attimo();
    v.scrivi("prova");
    c("scrivendo, la tendina si apre sotto la riga", [true, 5], [v.aperta(), v.voci().length]);
    // Esc: prima chiude la tendina, poi il campo
    v.tasto("Escape");
    c("primo Esc: chiude la tendina e il campo resta aperto", [false, false], [v.aperta(), v.regione().props.className.split(/\s+/).includes("hidden")]);
    const e2 = v.tasto("Escape");
    c("secondo Esc: chiude il campo, restituisce il fuoco alla lente e prende il tasto", [true, "lente", true], [v.regione().props.className.split(/\s+/).includes("hidden"), v.fuoco(), e2.fermato === true]);
    // la X
    app.esegui(() => v.lente().props.onClick(evento()));
    v.clic(v.chiudiTasto());
    c("il tasto «Chiudi la ricerca» chiude il campo e riporta il fuoco alla lente", [true, "lente", false], [v.regione().props.className.split(/\s+/).includes("hidden"), v.fuoco(), v.lente().props["aria-expanded"]]);
    // Invio dal telefono: porta alla pagina e richiude la riga
    app.esegui(() => v.lente().props.onClick(evento()));
    v.scrivi("prova alfa");
    p.navigazioni.length = 0;
    v.tasto("Enter");
    c("Invio sul telefono: va ai risultati, richiude la riga e riporta il fuoco alla lente", [[{ to: "/shop/cerca", search: { q: "prova alfa" } }], true, "lente"], [p.navigazioni, v.regione().props.className.split(/\s+/).includes("hidden"), v.fuoco()]);
    app.esegui(() => v.lente().props.onClick(evento()));
    v.scrivi("prova");
    v.tasto("ArrowDown");
    v.tasto("Enter");
    c("Invio su una voce dal telefono: richiude la riga", true, v.regione().props.className.split(/\s+/).includes("hidden"));
    // scelta di una voce
    app.esegui(() => v.lente().props.onClick(evento()));
    v.scrivi("prova");
    v.clic(v.voci()[0]);
    c("toccare una voce chiude la tendina e il campo (si va alla scheda)", [false, true], [v.aperta(), v.regione().props.className.split(/\s+/).includes("hidden")]);
    app.smonta();
  }

  // ── 3.5 · fuoco che esce ──
  {
    nuovaProva();
    const { app, v } = montaRicerca();
    v.suFuoco();
    await attimo();
    v.scrivi("prova");
    const dentro = { dentro: true };
    v.fuori(dentro);
    c("il fuoco passa a un altro punto DENTRO la ricerca (un tasto, una voce): la tendina resta aperta", true, v.aperta());
    c("il fuoco passa a un punto FUORI dalla ricerca: la tendina si chiude", false, (v.fuori(null), v.aperta()));
    v.suFuoco();
    c("e tornando nel campo con del testo la tendina si riapre", [true, 5], [v.aperta(), v.voci().length]);
    app.smonta();
  }

  // ── 3.6 · l'elenco arriva dopo che si è già scritto ──
  {
    const p = nuovaProva();
    let sblocca;
    p.elencoProdotti = () => {
      p.chiamate++;
      return new Promise((r) => (sblocca = () => r(CATALOGO)));
    };
    const { app, v } = montaRicerca();
    v.suFuoco();
    v.scrivi("prova");
    c("con l'elenco ancora in arrivo: nessuna voce, e non si rompe niente", 0, v.voci().length);
    c("Invio intanto porta comunque alla pagina dei risultati", [{ to: "/shop/cerca", search: { q: "prova" } }], (v.tasto("Enter"), p.navigazioni));
    v.scrivi("prova");
    sblocca();
    await attimo();
    c("appena l'elenco arriva, la tendina si riempie da sola (5 voci)", [true, 5], [v.aperta(), v.voci().length]);
    app.smonta();
  }

  // ── 3.7 · server che non risponde ──
  {
    const p = nuovaProva();
    p.elencoProdotti = async () => {
      p.chiamate++;
      throw new Error("server giù");
    };
    const { app, v } = montaRicerca();
    v.suFuoco();
    await attimo();
    v.scrivi("prova");
    c("elenco non scaricato (errore): nessuna voce, nessun errore a schermo, Invio funziona", [0, [{ to: "/shop/cerca", search: { q: "prova" } }]], [v.voci().length, (v.tasto("Enter"), p.navigazioni)]);
    v.suFuoco();
    c("al fuoco dopo si riprova (seconda chiamata)", 2, p.chiamate);
    p.elencoProdotti = async () => (p.chiamate++, []);
    v.suFuoco();
    await attimo();
    v.suFuoco();
    await attimo();
    c("una risposta vuota non chiude per sempre: si riprova al fuoco dopo", true, p.chiamate >= 3);
    p.elencoProdotti = async () => (p.chiamate++, CATALOGO);
    v.suFuoco();
    await attimo();
    const prima = p.chiamate;
    v.suFuoco();
    c("con l'elenco arrivato non si scarica più", prima, p.chiamate);
    v.scrivi("prova");
    c("e poi la tendina funziona", 5, v.voci().length);
    app.smonta();
  }

  // ── 3.8 · l'evento Search: pausa di 1 s, Invio, privacy ──
  {
    const p = nuovaProva(SCENARIO_50);
    const orologio = orologioFinto();
    try {
      const { app, v } = montaRicerca();
      v.suFuoco();
      await attimo();
      v.scrivi("Prodotto di prova 07");
      c("scrivendo: nessun evento subito, un timer in attesa", [0, 1], [p.eventi.length, orologio.pendenti()]);
      orologio.avanza(PAUSA - 1);
      c("a 999 ms dall'ultimo tasto: ancora nessun evento", 0, p.eventi.length);
      orologio.avanza(1);
      c("a 1000 ms: UN evento `Search`", ["Search", 1], [p.eventi[0]?.[0], p.eventi.length]);
      c("il nome di un prodotto del catalogo esce com'è nel catalogo", { searchString: "Prodotto di prova 07" }, p.eventi[0][1]);
      orologio.avanza(5000);
      c("il timer non riparte da solo: nessun secondo evento", 1, p.eventi.length);
      v.scrivi("Prodotto di prova 07");
      orologio.avanza(PAUSA);
      c("lo stesso testo non si conta due volte", 1, p.eventi.length);
      // una pausa che si rinnova
      v.scrivi("pro");
      orologio.avanza(600);
      v.scrivi("prod");
      orologio.avanza(600);
      c("chi continua a scrivere sposta l'attesa: ancora nessun nuovo evento a 600 ms dall'ultimo tasto", 1, p.eventi.length);
      orologio.avanza(400);
      c("a 1000 ms dall'ULTIMO tasto parte l'evento", 2, p.eventi.length);
      // privacy
      const senzaTesto = (e) => e && e[0] === "Search" && !("searchString" in e[1]);
      v.scrivi("mario rossi");
      orologio.avanza(PAUSA);
      c("un nome di persona: l'evento parte SENZA testo", true, senzaTesto(p.eventi.at(-1)));
      v.scrivi("alopecia");
      orologio.avanza(PAUSA);
      c("una parola di salute: l'evento parte SENZA testo", true, senzaTesto(p.eventi.at(-1)));
      v.scrivi("via roma 12");
      orologio.avanza(PAUSA);
      c("un indirizzo: l'evento parte SENZA testo", true, senzaTesto(p.eventi.at(-1)));
      const prima = p.eventi.length;
      v.scrivi("mario@posta.it");
      orologio.avanza(PAUSA);
      v.scrivi("3331234567");
      orologio.avanza(PAUSA);
      c("un'email o un telefono: nessun evento", prima, p.eventi.length);
      c("nessun testo libero è mai uscito: ogni `searchString` è un nome del catalogo o di una categoria", [], p.eventi.filter(([, d]) => "searchString" in d && !SCENARIO_50.some((x) => x.nome === d.searchString) && !CATEGORIE.some((x) => x.nome === d.searchString)));
      v.scrivi("Cura di prova");
      orologio.avanza(PAUSA);
      c("il nome di una categoria (dato alla ricerca dall'header) esce com'è", { searchString: "Cura di prova" }, p.eventi.at(-1)[1]);
      // Invio su una voce evidenziata: è una ricerca anche quella
      v.scrivi("Prodotto di prova 10");
      v.tasto("ArrowDown");
      const nVoce = p.eventi.length;
      v.tasto("Enter");
      c("Invio su una voce evidenziata conta la ricerca subito, con il nome del catalogo", [nVoce + 1, "Search"], [p.eventi.length, p.eventi.at(-1)[0]]);
      // Invio: subito, e il timer non raddoppia
      const n0 = p.eventi.length;
      v.scrivi("Prodotto di prova 08");
      v.tasto("Enter");
      c("Invio: l'evento parte subito, senza aspettare 1 s", [n0 + 1, { searchString: "Prodotto di prova 08" }], [p.eventi.length, p.eventi.at(-1)[1]]);
      orologio.avanza(PAUSA * 2);
      c("e il timer rimasto non lo ripete", n0 + 1, p.eventi.length);
      // meno di 2 caratteri
      const n1 = p.eventi.length;
      v.scrivi("x");
      orologio.avanza(PAUSA);
      c("una lettera sola non è una ricerca: nessun evento", n1, p.eventi.length);
      // smontaggio
      v.scrivi("Prodotto di prova 09");
      c("prima dello smontaggio il timer è in attesa", 1, orologio.pendenti());
      app.smonta();
      orologio.avanza(PAUSA * 2);
      c("smontato prima di 1 s: il timer è stato fermato e nessun evento parte", [n1, 0], [p.eventi.length, orologio.pendenti()]);
    } finally {
      orologio.ripristina();
    }
  }
  {
    // senza categorie date: il nome di una categoria non esce (non è nel vocabolario)
    const p = nuovaProva();
    const orologio = orologioFinto();
    try {
      const { app, v } = montaRicerca({});
      v.suFuoco();
      await attimo();
      v.scrivi("Cura di prova");
      orologio.avanza(PAUSA);
      c("senza l'elenco delle categorie il loro nome non è nel vocabolario: evento senza testo", [["Search", {}]], p.eventi);
      app.smonta();
    } finally {
      orologio.ripristina();
    }
  }

  // ── 3.9 · il testo scritto non va mai in un indirizzo diverso da /shop/cerca ──
  {
    const p = nuovaProva();
    const { app, v } = montaRicerca();
    v.suFuoco();
    await attimo();
    for (const t of ["mario rossi", "alopecia", "prova"]) {
      v.scrivi(t);
      v.tasto("Enter");
    }
    c("sorgente: `RicercaShop` naviga con `to` e `search` tipati, mai con `href` (T100a)", [true, false], [/navigate\(\{ to: "\/shop\/cerca", search: \{ q: pulito\(testo\) \} \}\)/.test(readFileSync(file, "utf8")), /navigate\(\{\s*href/.test(readFileSync(file, "utf8"))]);
    c("tutte le navigazioni da Invio senza voce vanno a `/shop/cerca`, mai altrove", true, p.navigazioni.every((n) => n.to === "/shop/cerca" && n.href === undefined && Object.keys(n.search ?? {}).join() === "q" && typeof n.search.q === "string"));
    app.smonta();
  }
}
