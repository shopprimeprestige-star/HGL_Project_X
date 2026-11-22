/** ── AIUTO DELLE PROVE (T20, T21): DISEGNARE UNA PAGINA DELLO SHOP SENZA BROWSER ──
 *  Impacchetta la pagina VERA (`src/routes/shop.*.tsx`) con esbuild, mettendo dei finti al posto del router, del carrello,
 *  dei server e dei tracciamenti, e la disegna con `react-dom/server`: i controlli leggono il MARCHIO reso (stelle,
 *  recensioni, badge, prezzo barrato…), non solo i dati. Gli effetti (`useEffect`) in questo modo non girano: ciò che
 *  parte dopo il caricamento si prova con le funzioni pure di `src/shop/cms/*`.
 *  Il file inizia per `_`: non è una prova, è un aiuto (lo salta `prove/negozio.mjs`). */
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const requireQui = createRequire(import.meta.url);

const FINTI = {
  "@tanstack/react-router": `
    import React from "react";
    const S = () => globalThis.__pagina;
    export const createFileRoute = () => (opts) => ({ ...opts, useParams: () => S().params ?? {}, useLoaderData: () => S().loaderData, useSearch: () => S().search ?? {} });
    export const Link = ({ to, params, children, className }) => React.createElement("a", { href: String(to).replace("$slug", params?.slug ?? ""), className }, children);
    export const useNavigate = () => () => {};
    export const useRouter = () => ({ invalidate: () => {} });
    export const notFound = () => new Error("notFound");
  `,
  "@/shop/CartContext": `export const useCart = () => globalThis.__pagina.carrello;`,
  "@/shop/useRivalidaCarrello": `export const useRivalidaCarrello = () => globalThis.__pagina.rivalida;`,
  "@/shop/cassa/useTariffa": `export const useTariffa = (attiva) => { (globalThis.__pagina.tariffaChiesta ??= []).push(attiva); return attiva ? (globalThis.__pagina.tariffa ?? { stato: "attesa", costoCent: null, chiusa: false }) : { stato: "attesa", costoCent: null, chiusa: false }; };`,
  "@/shop/cms/catalogo.functions": `const no = async () => { throw new Error("server finto"); };
    export const modalitaCatalogo = no, schedaProdotto = no, righeCarrello = no, elencoProdotti = no, elencoCategorie = no, vociSitemap = no;`,
  "@/shop/cms/modalita-certa.functions": `export const modalitaCertaDelServer = async () => "incerto";`,
  "@/lib/tracciamento/api": `export const emettiEvento = (n, d) => (globalThis.__pagina.eventi.push([n, d]), "id"); export const emettiSoloContatore = () => {};`,
  "@/landing/consulenza/eventi": `export const traccia = () => {};`,
  "@/integrations/supabase/client": `export const supabase = { from: () => ({ insert: async (riga) => (globalThis.__pagina.righe.push(riga), { error: null }) }) };`,
  "sonner": `export const toast = { success: () => {}, error: () => {} };`,
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
/** Disegna la pagina `file` (assoluto, o relativo alla radice) con lo stato finto `stato`; restituisce `{ html, route, pagina }` (`stato.componente` sceglie quale componente disegnare, di norma `component`; la rotta serve per provare `head`, `loader`…; `pagina` ha gli `eventi` emessi, le `righe` d'ordine inserite e i `gestori` per `gestore()`). */
export async function rendi(radice, file, stato, nomeExport = "Route") {
  const esbuild = requireQui("esbuild");
  const dir = mkdtempSync(join(tmpdir(), "prova-pagina-"));
  const entrata = join(dir, "entrata.tsx");
  writeFileSync(
    entrata,
    `import { renderToStaticMarkup } from "react-dom/server";
     import React from "react";
     import { ${nomeExport} as R } from ${JSON.stringify(file.startsWith("/") ? file : join(radice, file))};
     export const html = () => renderToStaticMarkup(React.createElement(R[globalThis.__pagina.componente ?? "component"]));
     export const route = R;`,
  );
  const r = await esbuild.build({
    entryPoints: [entrata],
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
    plugins: [
      {
        name: "finti",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (a) => (FINTI[a.path] ? { path: a.path, namespace: "finto" } : a.path === "react/jsx-runtime" ? { path: a.path, namespace: "jsx-avvolto" } : null));
          b.onLoad({ filter: /.*/, namespace: "finto" }, (a) => ({ contents: FINTI[a.path], loader: "tsx", resolveDir: radice }));
          b.onLoad({ filter: /.*/, namespace: "jsx-avvolto" }, () => ({ contents: JSX_AVVOLTO(requireQui.resolve("react/jsx-runtime", { paths: [radice] })), loader: "js", resolveDir: radice }));
        },
      },
    ],
  });
  const file_ = join(dir, `pagina-${++numero}.cjs`);
  writeFileSync(file_, r.outputFiles[0].text);
  const pagina = { eventi: [], righe: [], gestori: [], params: {}, search: {}, ...stato };
  globalThis.__pagina = pagina;
  const m = requireQui(file_);
  const html = m.html();
  return { html, route: m.route, pagina };
}
