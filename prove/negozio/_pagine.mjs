/** ── AIUTO PER LE PROVE DELLE PAGINE DELLO SHOP (T18, T19) ──────────────────────────
 *  Impacchetta il file di una rotta VERA con esbuild e la disegna con `react-dom/server`, senza browser:
 *   · `@tanstack/react-router` è sostituito da un finto minimo (`Link` = `<a href>`, `useRouterState` legge il percorso
 *     e la ricerca che la prova imposta, `createFileRoute(...)(opzioni)` restituisce `{ options, useRouteContext, … }`);
 *   · le funzioni del server (`catalogo.functions`) sono sostituite da finte che rispondono ciò che la prova decide;
 *   · le immagini diventano `data:` e gli alias `@/…` puntano a `src/`.
 *  La prova imposta lo stato in `globalThis.__PROVA_PAGINA__` PRIMA di disegnare:
 *    { pathname, searchStr, context, loaderData, params, server: { modalita, scheda, elenco, categorie } }
 *  ⚠️ Il markup è quello che il componente disegna sul server (la prima passata): gli effetti non girano.
 *  Il nome inizia per «_»: non è una prova, `negozio.mjs` non lo chiama. */
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const requireQui = createRequire(import.meta.url);

const ROUTER_FINTO = `
import { createElement } from "react";
const S = () => globalThis.__PROVA_PAGINA__ ?? {};
const href = (to, params) => String(to ?? "").replace(/\\$(\\w+)/g, (_, k) => encodeURIComponent((params ?? {})[k] ?? ""));
export const createFileRoute = (path) => (opzioni) => ({
  path, options: opzioni,
  useRouteContext: () => S().context ?? {},
  useLoaderData: () => S().loaderData,
  useParams: () => S().params ?? {},
  useNavigate: () => () => {},
});
export const getRouteApi = () => ({ useLoaderData: () => S().loaderData, useRouteContext: () => S().context ?? {} });
export const Link = ({ to, params, search, children, ...resto }) => createElement("a", { href: href(to, params), ...resto }, children);
export const Outlet = () => null;
export const useRouterState = (o) => {
  const stato = { location: { pathname: S().pathname ?? "/shop", searchStr: S().searchStr ?? "" } };
  return o && o.select ? o.select(stato) : stato;
};
export const useNavigate = () => () => {};
export const notFound = () => ({ __notFound: true });
export const redirect = (o) => ({ __redirect: o });
`;

const FUNZIONI_FINTE = `
const S = () => (globalThis.__PROVA_PAGINA__ ?? {}).server ?? {};
export const modalitaCatalogo = async () => S().modalita ?? "codice";
export const schedaProdotto = async ({ data }) => (S().scheda ? S().scheda(data) : null);
export const elencoProdotti = async ({ data }) => (S().elenco ? S().elenco(data) : []);
export const elencoCategorie = async () => (S().categorie ?? []);
`;

/** @param {string} radice  la radice del progetto
 *  @param {string} contenuto  il sorgente di ingresso (TSX) che esporta ciò che serve alla prova */
export async function impacchettaPagina(radice, contenuto, nome) {
  const esbuild = requireQui("esbuild");
  const finti = {
    name: "finti",
    setup(b) {
      b.onResolve({ filter: /^@tanstack\/react-router$/ }, () => ({ path: "router", namespace: "finto" }));
      b.onResolve({ filter: /^@\/shop\/cms\/catalogo\.functions$/ }, () => ({ path: "funzioni", namespace: "finto" }));
      b.onLoad({ filter: /^router$/, namespace: "finto" }, () => ({ contents: ROUTER_FINTO, loader: "js", resolveDir: radice }));
      b.onLoad({ filter: /^funzioni$/, namespace: "finto" }, () => ({ contents: FUNZIONI_FINTE, loader: "js", resolveDir: radice }));
    },
  };
  const r = await esbuild.build({
    stdin: { contents: contenuto, resolveDir: radice, loader: "tsx" },
    bundle: true, format: "cjs", platform: "node", write: false, logLevel: "silent", jsx: "automatic",
    alias: { "@": join(radice, "src") },
    loader: { ".png": "dataurl", ".jpg": "dataurl", ".webp": "dataurl", ".svg": "dataurl" },
    plugins: [finti],
    // `import.meta.env` di Vite: valori finti, nessuna chiave vera
    define: { "import.meta.env": JSON.stringify({ VITE_SUPABASE_URL: "https://prova.invalid", VITE_SUPABASE_PUBLISHABLE_KEY: "prova", DEV: false, PROD: true, SSR: true }) },
  });
  const dir = mkdtempSync(join(tmpdir(), "pagina-"));
  const file = join(dir, `${nome}.cjs`);
  writeFileSync(file, r.outputFiles[0].text);
  return requireQui(file);
}

/** Imposta lo stato della pagina finta. */
export function impostaPagina(stato) {
  globalThis.__PROVA_PAGINA__ = stato;
}

/** Il testo che si legge (senza tag, con le entità più comuni sciolte). */
export const testoVisibile = (h) =>
  h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
