/** ── AIUTO DELLE PROVE (T20, T21): DISEGNARE UNA PAGINA DELLO SHOP SENZA BROWSER ──
 *  Impacchetta la pagina VERA (`src/routes/shop.*.tsx`) con esbuild, mettendo dei finti al posto del router, del carrello,
 *  dei server e dei tracciamenti, e la disegna con `react-dom/server`: i controlli leggono il MARCHIO reso (stelle,
 *  recensioni, badge, prezzo barrato…), non solo i dati. Gli effetti (`useEffect`) in questo modo non girano: ciò che
 *  parte dopo il caricamento si prova con le funzioni pure di `src/shop/cms/*`.
 *  Il file inizia per `_`: non è una prova, è un aiuto (lo salta `prove/negozio.mjs`).
 *
 *  ── VETRINA V1 · T70a (PIANO-V1 §5): unico proprietario di questo file per tutta la V1; i compiti dopo T70a NON lo editano ──
 *   · `rendiComponente(radice, file, nomeExport, props, stato)`: disegna un solo componente (non una rotta), con le stesse finzioni.
 *   · `stato.finti = { "@/modulo": "codice" }`: finti in più (o al posto di quelli qui sotto) solo per QUESTO disegno.
 *   · `stato.senzaFinti = ["@/modulo", …]`: toglie un finto per QUEL disegno, così si disegna il componente vero (`BoxProdottoGiusto`, `PopupUscita`).
 *   · «Server che lancia»: con `stato.server = { … }` ogni funzione del server finta REGISTRA la chiamata (`pagina.chiamate` = nomi in ordine,
 *     `pagina.chiamateArgs` = i loro argomenti) e risponde solo se è una di quelle che il codice di oggi fa davvero oppure se `stato.server` le dà una
 *     risposta (valore, o funzione degli argomenti: se lancia, la chiamata lancia); OGNI ALTRA LANCIA un errore («chiamata al server NON prevista»).
 *     Risposte «come oggi», senza dichiararle: `collaudoDellaVisita` → `stato.collaudo ?? false`; `modalitaCatalogo` → `stato.modalita ?? "codice"`
 *     (il valore dello stato); `modalitaCertaDelServer` → `stato.modalitaCerta ?? "incerto"`; `schedaProdotto` → `{ esito: "non_trovato" }`.
 *     Senza `stato.server` le funzioni rispondono come prima di T70a (le prove esistenti non cambiano), ma registrano comunque le chiamate.
 *
 *  ── T70c (manutenzione, scelta dal revisore di T85) ──
 *   · la cartella temporanea di ogni disegno si cancella a fine impacchettamento, anche se lancia (prima ne restavano migliaia nel `tmpdir()`);
 *   · `import.meta.env` è definito come in `_pagine.mjs`: produzione sul server (`DEV: false, PROD: true, SSR: true`); una prova che vuole lo
 *     sviluppo passa `stato.env = { PROD: false, DEV: true }` (si sommano ai valori di base). */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const requireQui = createRequire(import.meta.url);

/** Una funzione del server finta: registra la chiamata e lascia decidere a `pagina.chiamaServer` (definita in `rendi`, che conosce lo stato). */
const serverFinto = (...nomi) => nomi.map((n) => `export const ${n} = async (...a) => globalThis.__pagina.chiamaServer(${JSON.stringify(n)}, a);`).join("\n");
/** Come rispondono le funzioni del server SENZA `stato.server` (il comportamento di prima di T70a): le altre lanciano «server finto». */
const RISPOSTE_PRIMA = { modalitaCertaDelServer: "incerto", cassaDelSito: "vecchia", collaudoDellaVisita: false, tariffaSpedizione: { stato: "assente" } };
/** Le chiamate che il codice di oggi fa davvero (`shop.tsx`, scheda, carrello): in modalità «server che lancia» rispondono senza che la prova lo dichiari. */
const RISPOSTE_OGGI = (p) => ({
  collaudoDellaVisita: () => p.collaudo ?? false,
  modalitaCatalogo: () => p.modalita ?? "codice",
  modalitaCertaDelServer: () => p.modalitaCerta ?? "incerto",
  schedaProdotto: () => ({ esito: "non_trovato" }),
});

const FINTI = {
  "@tanstack/react-router": `
    import React from "react";
    const S = () => globalThis.__pagina;
    const href = (to, params, search) => {
      const q = search && typeof search === "object" ? new URLSearchParams(Object.entries(search).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)])).toString() : "";
      return String(to).replace(/\\$(\\w+)/g, (_, k) => encodeURIComponent((params ?? {})[k] ?? "")) + (q ? "?" + q : "");
    };
    export const createFileRoute = () => (opts) => ({ ...opts, useParams: () => S().params ?? {}, useLoaderData: () => S().loaderData, useSearch: () => S().search ?? {}, useRouteContext: () => S().context ?? {} });
    export const Link = ({ to, params, search, hash, children, className, activeProps, inactiveProps, activeOptions, preload, replace, resetScroll, viewTransition, ...resto }) => React.createElement("a", { ...resto, href: href(to, params, search), className }, children);
    export const Outlet = () => S().outlet ?? null;
    //  il percorso e la ricerca: pathname e searchStr (come in _pagine.mjs); search è l'oggetto
    export const useRouterState = (o) => {
      const stato = { location: { pathname: S().pathname ?? "/shop", searchStr: S().searchStr ?? "", search: S().search ?? {} } };
      return o && o.select ? o.select(stato) : stato;
    };
    export const useSearch = () => S().search ?? {};
    export const useParams = () => S().params ?? {};
    export const useNavigate = () => (o) => { (S().navigazioni ??= []).push(o); };
    export const useRouter = () => ({ invalidate: () => {}, options: { defaultErrorComponent: S().erroreDelRouter } });
    export const notFound = () => new Error("notFound");
    export const redirect = (o) => Object.assign(new Error("redirect"), { redirect: o });
  `,
  "@/shop/CartContext": `export const useCart = () => globalThis.__pagina.carrello; export const CartProvider = ({ children }) => children;`,
  "@/shop/useRivalidaCarrello": `export const useRivalidaCarrello = () => globalThis.__pagina.rivalida;`,
  "@/shop/useTariffa": `export const useTariffa = (attiva) => { (globalThis.__pagina.tariffaChiesta ??= []).push(attiva); return attiva ? (globalThis.__pagina.tariffa ?? { stato: "attesa", costoCent: null, chiusa: false }) : { stato: "attesa", costoCent: null, chiusa: false }; };`,
  "@/shop/cms/catalogo.functions": serverFinto("modalitaCatalogo", "schedaProdotto", "righeCarrello", "elencoProdotti", "elencoCategorie", "vociSitemap"),
  "@/shop/cms/modalita-certa.functions": serverFinto("modalitaCertaDelServer"),
  //  R2 · T58: la cassa nuova (loader di `shop.checkout.tsx`, `CassaStripe.tsx`) importa questi due server: finti, come gli altri.
  "@/shop/cms/cassa-sito.functions": serverFinto("cassaDelSito", "collaudoDellaVisita"),
  "@/shop/cassa/tariffe.functions": serverFinto("tariffaSpedizione"),
  //  V1 · T70a: i server che le pagine nuove importeranno (`contenuto-shop.functions` lo scrive T80: qui basta il nome)
  "@/shop/cms/cassa-pubblica.functions": serverFinto("cassaPubblica"),
  "@/shop/cms/contenuto-shop.functions": serverFinto("contenutoShop"),
  "@/lib/tracciamento/api": `export const emettiEvento = (n, d) => (globalThis.__pagina.eventi.push([n, d]), "id"); export const emettiSoloContatore = (n, d) => { (globalThis.__pagina.contatori ??= []).push([n, d]); }; export const scaricaEventi = async () => {};`,
  "@/landing/consulenza/eventi": `export const traccia = (...a) => { (globalThis.__pagina.tracce ??= []).push(a); };`,
  "@/integrations/supabase/client": `export const supabase = { from: () => ({ insert: async (riga) => (globalThis.__pagina.righe.push(riga), { error: null }) }) };`,
  "sonner": `export const toast = { success: () => {}, error: () => {} }; export const Toaster = () => null;`,
  "@/components/landing/consulenza/BoxProdottoGiusto": `export const BoxProdottoGiusto = () => "<box-consulenza>";`,
  "@/components/landing/consulenza/PopupUscita": `export const PopupUscita = () => null;`,
};

/** Avvolge il `jsx` di React: ogni elemento con `onClick` o `onSubmit` finisce in `gestori`, così una prova può «cliccare» (o «inviare») con le
 *  chiusure di QUEL disegno (variante scelta, carrello finto…) anche se `react-dom/server` non fa girare gli eventi. */
const JSX_AVVOLTO = (reale) => `
  import * as R from ${JSON.stringify(reale)};
  const nota = (tipo, p) => { if (typeof tipo === "string" && p && (p.onClick || p.onSubmit)) globalThis.__pagina?.gestori.push({ tipo, props: p }); };
  export const Fragment = R.Fragment;
  export const jsx = (t, p, k) => (nota(t, p), R.jsx(t, p, k));
  export const jsxs = (t, p, k) => (nota(t, p), R.jsxs(t, p, k));
`;
const testoDi = (n) => (n == null || typeof n === "boolean" ? "" : Array.isArray(n) ? n.map(testoDi).join("") : typeof n === "object" ? testoDi(n.props?.children) : String(n));
/** Il gestore registrato dell'elemento `tipo` il cui testo contiene `testo` (es. `("button", "Aggiungi al carrello")`, `("form")`). */
export function gestore(pagina, tipo, testo = "") {
  const g = pagina.gestori.find((x) => x.tipo === tipo && testoDi(x.props.children).includes(testo));
  if (!g) throw new Error(`nessun <${tipo}> con «${testo}» nel disegno`);
  return g.props.onClick ?? g.props.onSubmit;
}

let numero = 0;

/** Lo stato di base di un disegno: un carrello vuoto e una rivalida «ok» (così una pagina che li legge non si rompe se la prova non li dà). */
const CARRELLO_VUOTO = { lines: [], subtotal: 0, count: 0, setQty() {}, remove() {}, clear() {}, replaceLines() {}, add() {} };
const RIVALIDA_OK = { stato: "ok", avviso: null, controlla: async () => ({ stato: "non_verificabile" }) };

/** Impacchetta `entrata` (sorgente di un modulo che esporta `html()` e, per le rotte, `route`) con i finti dello stato e ne carica il risultato.
 *  La cartella temporanea serve solo a caricare il pacchetto (è tutto in memoria dopo): si cancella sempre, anche se il disegno lancia. */
async function impacchetta(radice, entrata, stato) {
  const dir = mkdtempSync(join(tmpdir(), "prova-pagina-"));
  try {
    return await impacchettaIn(dir, radice, entrata, stato);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function impacchettaIn(dir, radice, entrata, stato) {
  const esbuild = requireQui("esbuild");
  const file_entrata = join(dir, "entrata.tsx");
  //  Ogni disegno ha la SUA pagina: nel codice del pacchetto `globalThis.__pagina` diventa `globalThis.__pagine[N]` (N scritto qui, al momento
  //  dell'impacchettamento). Così il `loader` o il `beforeLoad` di un disegno, chiamati dopo un disegno successivo, registrano e rispondono
  //  ancora col suo stato (`globalThis.__pagina` resta l'ultimo disegno, per chi lo legge da fuori).
  const pagine = (globalThis.__pagine ??= []);
  const numeroPagina = pagine.length;
  pagine.push(null);
  const suaPagina = (codice) => codice.replaceAll("globalThis.__pagina", `globalThis.__pagine[${numeroPagina}]`);
  writeFileSync(file_entrata, suaPagina(entrata));
  //  i finti di base, più quelli della prova (`stato.finti`), meno quelli che la prova vuole VERI (`stato.senzaFinti`)
  const finti = { ...FINTI, ...(stato.finti ?? {}) };
  for (const modulo of stato.senzaFinti ?? []) delete finti[modulo];
  const r = await esbuild.build({
    entryPoints: [file_entrata],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    loader: { ".tsx": "tsx", ".png": "dataurl", ".svg": "dataurl", ".webp": "dataurl", ".jpg": "dataurl" },
    alias: { "@": join(radice, "src") },
    absWorkingDir: radice,
    nodePaths: [join(radice, "node_modules")],
    logLevel: "silent",
    //  `import.meta.env` di Vite, come in `_pagine.mjs`: produzione sul server; `stato.env` cambia i valori per quel disegno
    define: { "import.meta.env": JSON.stringify({ DEV: false, PROD: true, SSR: true, ...(stato.env ?? {}) }) },
    plugins: [
      {
        name: "finti",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (a) => (finti[a.path] !== undefined ? { path: a.path, namespace: "finto" } : a.path === "react/jsx-runtime" ? { path: a.path, namespace: "jsx-avvolto" } : null));
          b.onLoad({ filter: /.*/, namespace: "finto" }, (a) => ({ contents: suaPagina(finti[a.path]), loader: "tsx", resolveDir: radice }));
          b.onLoad({ filter: /.*/, namespace: "jsx-avvolto" }, () => ({ contents: suaPagina(JSX_AVVOLTO(requireQui.resolve("react/jsx-runtime", { paths: [radice] }))), loader: "js", resolveDir: radice }));
        },
      },
    ],
  });
  const file_ = join(dir, `pagina-${++numero}.cjs`);
  writeFileSync(file_, r.outputFiles[0].text);
  const pagina = {
    eventi: [], righe: [], gestori: [], chiamate: [], chiamateArgs: [], params: {}, search: {}, carrello: CARRELLO_VUOTO, rivalida: RIVALIDA_OK, ...stato,
  };
  //  ogni funzione del server finta passa di qui: registra, poi risponde (o lancia) secondo la modalità
  pagina.chiamaServer = async (nome, args) => {
    pagina.chiamate.push(nome);
    //  una copia: se la pagina cambia gli argomenti dopo la chiamata, il registro conserva quelli di allora (non clonabili, p.es. funzioni: il riferimento)
    try { pagina.chiamateArgs.push(structuredClone(args)); } catch { pagina.chiamateArgs.push(args); }
    const risposte = pagina.server ? { ...RISPOSTE_OGGI(pagina), ...pagina.server } : null;
    if (risposte) {
      if (!Object.hasOwn(risposte, nome)) throw new Error(`chiamata al server NON prevista: ${nome}`);
      const r = risposte[nome];
      return typeof r === "function" ? r(...args) : r;
    }
    if (Object.hasOwn(RISPOSTE_PRIMA, nome)) return RISPOSTE_PRIMA[nome];
    throw new Error("server finto");
  };
  pagine[numeroPagina] = pagina;
  globalThis.__pagina = pagina;
  const m = requireQui(file_);
  return { m, pagina };
}

/** Disegna la pagina `file` (assoluto, o relativo alla radice) con lo stato finto `stato`; restituisce `{ html, route, pagina }` (`stato.componente` sceglie quale componente disegnare, di norma `component`; la rotta serve per provare `head`, `loader`…; `pagina` ha gli `eventi` emessi, le `righe` d'ordine inserite, i `gestori` per `gestore()` e le `chiamate` al server, vedi sopra). */
export async function rendi(radice, file, stato = {}, nomeExport = "Route") {
  const { m, pagina } = await impacchetta(
    radice,
    `import { renderToStaticMarkup } from "react-dom/server";
     import React from "react";
     import { ${nomeExport} as R } from ${JSON.stringify(file.startsWith("/") ? file : join(radice, file))};
     export const html = () => renderToStaticMarkup(React.createElement(R[globalThis.__pagina.componente ?? "component"]));
     export const route = R;`,
    stato,
  );
  const html = m.html();
  return { html, route: m.route, pagina };
}

/** Disegna UN componente (non una rotta): `nomeExport` di `file` con le `props` date (`default` per l'export di default). Restituisce `{ html, pagina }`. */
export async function rendiComponente(radice, file, nomeExport, props = {}, stato = {}) {
  const { m, pagina } = await impacchetta(
    radice,
    `import { renderToStaticMarkup } from "react-dom/server";
     import React from "react";
     import * as M from ${JSON.stringify(file.startsWith("/") ? file : join(radice, file))};
     export const html = () => renderToStaticMarkup(React.createElement(M[${JSON.stringify(nomeExport)}], globalThis.__pagina.props));`,
    { ...stato, props },
  );
  return { html: m.html(), pagina };
}
