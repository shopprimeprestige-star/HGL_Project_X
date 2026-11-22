/** ── NEGOZIO · RILASCIO 2 · T58 · LA CASSA NUOVA NEL SITO: SORGENTE E DISEGNO ───────────────────────────
 *  `src/routes/shop.checkout.tsx` (loader e scelta della cassa), `src/shop/cassa/CassaStripe.tsx` (D61), disegnati davvero con esbuild e
 *  `react-dom/server` (i server e il carrello sono finti: nessuna rete, nessun database). Cosa deve valere:
 *   · loader: con il catalogo `codice` `cassaDelSito` NON è chiamata; se rifiuta, con `cms`, la cassa è la vecchia;
 *   · LA CASSA VECCHIA NON SI È MOSSA: il testo da `const prezzoCodice` in poi è quello di prima (impronta), con `inviaOrdine` e `SHIPPING_COST`;
 *   · `CassaStripe.tsx` non contiene indirizzi dello studio, script di Stripe, segnaposto, «da confermare», «Avvisami», «novità»,
 *     «pagamento sicuro»; ha la trappola nascosta (`aria-hidden`, `tabIndex=-1`); le due caselle di legge con i collegamenti; mai 59 € né 4,90 €;
 *   · la ricerca è nei file di `src/`, mai in `prove/`, e le parole sono costruite a pezzi dove la prova stessa le nominerebbe.
 *  Dati inventati. */
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const requireQui = createRequire(import.meta.url);
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const pezzi = (...p) => p.join("");
/** L'impronta del testo della cassa vecchia: da `const prezzoCodice` alla fine, con il solo cambio di nome della funzione (era `CheckoutPage`). */
const IMPRONTA_CASSA_VECCHIA = "93d15921c8627c7dcaff5bc7f91c067cb04da225ae3c7b767101761078e45dab";

/** I finti: leggono tutto da `globalThis.__p`. */
const FINTI = {
  "@tanstack/react-router": `
    import React from "react";
    const S = () => globalThis.__p;
    export const createFileRoute = () => (opts) => ({ ...opts, useParams: () => ({}), useLoaderData: () => S().loaderData, useSearch: () => S().search ?? {} });
    export const Link = ({ to, children, className }) => React.createElement("a", { href: String(to), className }, children);
    export const useNavigate = () => () => {};`,
  "@/shop/CartContext": `export const useCart = () => globalThis.__p.carrello;`,
  "@/shop/useRivalidaCarrello": `export const useRivalidaCarrello = () => globalThis.__p.rivalida;`,
  "@/shop/cms/catalogo.functions": `const no = async () => { throw new Error("server finto"); };
    export const modalitaCatalogo = () => globalThis.__p.modalita(), schedaProdotto = no, righeCarrello = no;`,
  "@/shop/cms/cassa-sito.functions": `export const cassaDelSito = () => (globalThis.__p.chiamateCassa++, globalThis.__p.cassa());`,
  "@/shop/cassa/tariffe.functions": `export const tariffaSpedizione = async () => ({ stato: "assente" });`,
  "@/lib/tracciamento/api": `export const emettiEvento = () => null; export const emettiSoloContatore = () => {};`,
  "@/integrations/supabase/client": `export const supabase = { from: () => ({ insert: async () => ({ error: null }) }) };`,
};

let n = 0;
async function carica(radice, file) {
  const esbuild = requireQui("esbuild");
  const dir = mkdtempSync(join(tmpdir(), "prova-cassa-"));
  try {
    writeFileSync(join(dir, "entrata.tsx"), `import { renderToStaticMarkup } from "react-dom/server";
      import React from "react";
      import { Route as R } from ${JSON.stringify(join(radice, file))};
      export const html = () => renderToStaticMarkup(React.createElement(R.component));
      export const route = R;`);
    const r = await esbuild.build({
      entryPoints: [join(dir, "entrata.tsx")], bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
      loader: { ".tsx": "tsx", ".png": "dataurl", ".svg": "dataurl", ".webp": "dataurl", ".jpg": "dataurl" },
      alias: { "@": join(radice, "src") }, absWorkingDir: radice, nodePaths: [join(radice, "node_modules")], logLevel: "silent",
      plugins: [{ name: "finti", setup(b) {
        b.onResolve({ filter: /.*/ }, (a) => (FINTI[a.path] ? { path: a.path, namespace: "finto" } : null));
        b.onLoad({ filter: /.*/, namespace: "finto" }, (a) => ({ contents: FINTI[a.path], loader: "tsx", resolveDir: radice }));
      } }],
    });
    const f = join(dir, `pagina-${++n}.cjs`);
    writeFileSync(f, r.outputFiles[0].text);
    return requireQui(f);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
const riga = (sku, qty = 1, prezzoCent = 2890) => ({ productId: sku, qty, key: sku, sku, snap: { nome: "Prodotto di prova", slug: "prodotto-di-prova", prezzoCent, foto: null, varianteNome: "Unica" } });
const stato = (extra = {}) => {
  const lines = extra.lines ?? [riga("PROVA-001-A", 2)];
  return {
    chiamateCassa: 0, modalita: async () => "cms", cassa: async () => "stripe", search: {},
    loaderData: { modo: "cms", cassa: "stripe" },
    carrello: { lines, count: lines.reduce((s, l) => s + l.qty, 0), subtotal: 57.8, clear: () => {} },
    rivalida: { stato: "ok", avviso: null, controlla: async () => ({ stato: "ok", righe: lines, server: [], rimosse: 0, prezziCambiati: false }) },
    ...extra,
  };
};

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("SHOP R2 · T58 · LA CASSA NUOVA NEL SITO: SORGENTE E DISEGNO (22/11/2026)");
  const rotta = "src/routes/shop.checkout.tsx";
  const fCassa = "src/shop/cassa/CassaStripe.tsx";
  let src = "", srcCassa = "";
  try { src = readFileSync(join(radice, rotta), "utf8"); } catch { /* manca */ }
  try { srcCassa = readFileSync(join(radice, fCassa), "utf8"); } catch { /* manca */ }
  c("il file src/shop/cassa/CassaStripe.tsx esiste", true, srcCassa !== "");
  if (!srcCassa) return;

  // ── la cassa vecchia non si è mossa ──
  const dopo = src.slice(src.indexOf("const prezzoCodice"));
  c("cassa vecchia: da `const prezzoCodice` in poi il testo è quello di prima (cambia solo il nome della funzione, ora `CassaVecchia`)", IMPRONTA_CASSA_VECCHIA, createHash("sha256").update(dopo.replace("function CassaVecchia()", "function CheckoutPage()")).digest("hex"));
  c("cassa vecchia: `inviaOrdine`, `SHIPPING_COST` e «Conferma ordine» ci sono ancora", [true, true, true], [src.includes("inviaOrdine("), src.includes("SHIPPING_COST"), src.includes("Conferma ordine")]);
  c("rotta: la cassa nuova è un componente separato (`CassaStripe`) scelto da `cassa === \"stripe\"`", [true, true], [/import \{[^}]*CassaStripe[^}]*\} from "@\/shop\/cassa\/CassaStripe"/.test(src), /cassa === "stripe"/.test(src)]);
  c("rotta: il loader passa dal tetto e dal catch (`cassaPerLoader`)", true, /cassaPerLoader\(/.test(src));

  // ── il loader, con i server finti ──
  const M = await carica(radice, rotta);
  const loader = (st) => { globalThis.__p = st; return M.route.loader(); };
  {
    const st = stato({ modalita: async () => "codice" });
    const r = await loader(st);
    c("loader: catalogo `codice` → `cassaDelSito` NON chiamata, cassa vecchia", [0, "codice", "vecchia"], [st.chiamateCassa, r.modo, r.cassa]);
  }
  {
    const st = stato({ modalita: async () => { throw new Error("giù"); } });
    const r = await loader(st);
    c("loader: `modalitaCatalogo` che rifiuta → `codice`, cassa vecchia, `cassaDelSito` non chiamata", [0, "codice", "vecchia"], [st.chiamateCassa, r.modo, r.cassa]);
  }
  {
    const st = stato();
    const r = await loader(st);
    c("loader: cms + stripe → `{modo:cms, cassa:stripe}` (una sola chiamata)", [1, "cms", "stripe"], [st.chiamateCassa, r.modo, r.cassa]);
  }
  {
    const st = stato({ cassa: async () => { throw new Error("giù"); } });
    const r = await loader(st);
    c("loader: cms + `cassaDelSito` che RIFIUTA → cassa vecchia (il catalogo resta cms)", ["cms", "vecchia"], [r.modo, r.cassa]);
  }
  {
    const st = stato({ cassa: async () => "vecchia" });
    c("loader: cms + il server dice vecchia → vecchia", "vecchia", (await loader(st)).cassa);
  }

  // ── il disegno ──
  const disegna = async (st) => { globalThis.__p = st; return M.html(); };
  const vecchiaHtml = await disegna(stato({ loaderData: { modo: "cms", cassa: "vecchia" } }));
  c("disegno: cassa vecchia → «Conferma ordine» e nessun «Paga ora»", [true, false], [vecchiaHtml.includes("Conferma ordine"), vecchiaHtml.includes("Paga ora")]);
  const senzaCassa = await disegna(stato({ loaderData: { modo: "codice" } }));
  c("disegno: i dati del loader di oggi (senza `cassa`) → cassa vecchia", true, senzaCassa.includes("Conferma ordine"));
  const nuova = await disegna(stato());
  c("disegno: cassa stripe → «Paga ora», niente «Conferma ordine»", [true, false], [nuova.includes("Paga ora"), nuova.includes("Conferma ordine")]);
  c("disegno: i tre blocchi (contatti, spedizione, fattura) e il riepilogo", [true, true, true, true], [/Contatti/.test(nuova), /Spedizione/.test(nuova), /Mi serve la fattura/.test(nuova), /Il tuo ordine/.test(nuova)]);
  c("disegno: la provincia è un campo, la nazione NON è un campo (solo Italia)", [true, false], [/name="provincia"|id="cassa-provincia"/.test(nuova), /name="nazione"|id="cassa-nazione"/.test(nuova)]);
  c("disegno: due caselle di legge, NON pre-spuntate, con i collegamenti ai testi", [true, true, false], [nuova.includes('href="/termini-e-condizioni"') && nuova.includes('href="/privacy-policy"'), (nuova.match(/type="checkbox"/g) ?? []).length >= 3, /type="checkbox"[^>]*checked/.test(nuova)]);
  c("disegno: la trappola `sito_web` è nascosta (`aria-hidden`, `tabindex=-1`, niente autocompilazione)", [true, true, true], [/name="sito_web"/.test(nuova), /sito_web[\s\S]{0,400}tabindex="-1"|tabindex="-1"[\s\S]{0,400}sito_web/.test(nuova), /aria-hidden="true"/.test(nuova)]);
  c("disegno: i campi hanno `autocomplete` e il CAP la tastiera numerica", [true, true], [/autoComplete|autocomplete="email"/i.test(nuova), /inputMode="numeric"|inputmode="numeric"/i.test(nuova)]);
  c("disegno: mai 59 € né 4,90 € nella cassa nuova", [false, false], [/59\s?€|€\s?59/.test(nuova), /4,90/.test(nuova)]);
  c("disegno: «Pagamento annullato, il carrello è ancora qui» solo con `?annullato=1`", [false, true], [nuova.includes("Pagamento annullato"), (await disegna(stato({ search: { annullato: 1 } }))).includes("Pagamento annullato, il carrello è ancora qui")]);
  const vuota = await disegna(stato({ lines: [], carrello: { lines: [], count: 0, subtotal: 0, clear: () => {} } }));
  c("disegno: carrello vuoto → «Carrello vuoto», nessun modulo", [true, false], [vuota.includes("Carrello vuoto"), vuota.includes("Paga ora")]);
  c("disegno: la riga del riepilogo mostra nome, variante e quantità (il prezzo viene dallo `snap` del server)", [true, true], [nuova.includes("Prodotto di prova"), nuova.includes("Unica")]);

  // ── il sorgente di CassaStripe.tsx e cassa-client.ts ──
  const clientSrc = (() => { try { return readFileSync(join(radice, "src/shop/cassa/cassa-client.ts"), "utf8"); } catch { return ""; } })();
  const nudi = senzaCommenti(srcCassa), nudoClient = senzaCommenti(clientSrc);
  const vietate = [
    ["l'indirizzo dello studio (via)", pezzi("Scipi", "oni")], ["il CAP dello studio", pezzi("001", "92")], ["il nome del prodotto riservato", pezzi("Invis", "ible")],
    ["lo script di Stripe", pezzi("stripe.com", "/v3")], ["la libreria di Stripe", pezzi("load", "Stripe")], ["il segnaposto grafico", pezzi("Placeholder", "Box")],
    ["«da confermare»", pezzi("da conf", "ermare")], ["il pacchetto Stripe", pezzi("@stri", "pe/")], ["la casella di recupero", pezzi("Avvi", "sami")], ["la casella novità", pezzi("novi", "tà")],
    ["una promessa di sicurezza", pezzi("pagamento sic", "uro")], ["i segnaposto", "{{"],
  ];
  for (const [nome, parola] of vietate) c(`CassaStripe.tsx non contiene ${nome}`, false, nudi.toLowerCase().includes(parola.toLowerCase()) || srcCassa.toLowerCase().includes(parola.toLowerCase()));
  c("cassa-client.ts non contiene l'indirizzo dello studio né il nome del prodotto riservato", false, [pezzi("Scipi", "oni"), pezzi("001", "92"), pezzi("Invis", "ible")].some((p) => clientSrc.includes(p)));
  c("CassaStripe.tsx non usa le costanti della cassa vecchia (spedizione fissa, soglia)", [false, false, false], [nudi.includes("SHIPPING_"), nudi.includes("SPEDIZIONE_CMS_CENT"), /\b490\b|\b4\.9\b/.test(nudi + nudoClient)]);
  c("CassaStripe.tsx legge la spedizione dalla funzione del server (`tariffaSpedizione`)", true, /tariffaSpedizione/.test(nudi));
  c("CassaStripe.tsx non scrive in `shop_orders` dal browser (nessun `supabase`, nessun `inviaOrdine`)", [false, false], [/supabase/.test(nudi), /inviaOrdine/.test(nudi)]);
  c("CassaStripe.tsx: gli errori accanto al campo hanno `role=\"alert\"` e il campo `aria-invalid`", [true, true], [/role="alert"/.test(nudi), /aria-invalid/.test(nudi)]);
  c("CassaStripe.tsx: nessun logo di metodi di pagamento (Visa, Mastercard, PayPal, Klarna, Apple Pay)", false, /visa|mastercard|paypal|klarna|apple pay|google pay/i.test(srcCassa));
  c("CassaStripe.tsx: parla con la rotta della cassa e con quella del permesso", [true, true], [nudi.includes("/api/public/shop-cassa-permesso"), /\/api\/public\/shop-cassa["'`]/.test(nudi)]);
  c("CassaStripe.tsx: il pulsante non si ripreme mentre si lavora (`disabled`, `aria-busy`)", [true, true], [/disabled=/.test(nudi), /aria-busy/.test(nudi)]);
}
