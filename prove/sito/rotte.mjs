/** ── PROVE DELLE ROTTE E DELLA MAPPA DEL SITO (compito B10) ────────────────
 *  `node prove/sito/rotte.mjs`.
 *  Cambio di piano del titolare (14/10/2026): home e Protocol vengono
 *  ridisegnate. Quindi `/` resta la home di oggi, e `/protocol` esiste ma è
 *  NASCOSTA (`noindex`, fuori dalla mappa) finché il redesign non è approvato.
 *  Anche `/catalogo` (frase «in preparazione») resta nascosta: la home online porta ancora a `/shop`.
 *  Cosa copre: elenco delle pagine della mappa, elenco delle pagine nascoste,
 *  che le due liste non si contraddicano (mai un `noindex` nella mappa), e che
 *  l'elenco delle rotte generato (`routeTree.gen.ts`) conosca tutte le pagine.
 *  ───────────────────────────────────────────────────────────────────────── */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { carica, leggi, nuovaProva, radice } from "./_comune.mjs";

const { c, vero, finisci } = nuovaProva("rotte e mappa del sito");
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const SEO = await carica("src/seo/regole.ts", "seo-regole");

/* ── La mappa del sito ──────────────────────────────────────────────────── */
const mappa = [...SEO.PAGINE_PUBBLICHE];
vero("mappa: resta tutto ciò che c'era", ["/", "/blog", "/shop", "/privacy-policy", "/cookie-policy", "/termini-e-condizioni"].every((p) => mappa.includes(p)));
c("mappa: /protocol, /catalogo, /classica e /nuova non ci sono (noindex o nascoste)", [], mappa.filter((p) => ["/protocol", "/catalogo", "/classica", "/nuova"].includes(p)));
c("mappa: nessun percorso doppio", mappa.length, new Set(mappa).size);

/* ── Le pagine nascoste ─────────────────────────────────────────────────── */
const nascoste = [...(SEO.PAGINE_NASCOSTE ?? [])];
c("nascoste: /protocol e /catalogo finché il redesign non è approvato", ["/protocol", "/catalogo"], nascoste);
c("nessuna pagina è insieme nella mappa e nascosta", [], nascoste.filter((p) => mappa.includes(p)));
const sitemap = SEO.sitemapXml(mappa.map((percorso) => ({ percorso })), "https://esempio.it");
vero("sitemap.xml: né /protocol né /catalogo", !sitemap.includes("/protocol") && !sitemap.includes("/catalogo"));
vero("robots.txt: non blocca /protocol né /catalogo (altrimenti Google non legge il noindex)", !/\/protocol|\/catalogo/.test(SEO.robotsTxt("https://esempio.it")));

// Ogni pagina nascosta dichiara `noindex` nella sua testata; ogni pagina della mappa NO.
const rotta = { "/protocol": "src/routes/protocol.tsx", "/catalogo": "src/routes/catalogo.tsx" };
for (const p of nascoste) {
  const testo = senzaCommenti(leggi(rotta[p]));
  vero(`${p}: la testata dichiara noindex`, /name:\s*"robots",\s*content:\s*"noindex/.test(testo));
}

/* ── Le rotte generate ──────────────────────────────────────────────────── */
const albero = leggi("src/routeTree.gen.ts");
for (const p of new Set([...nascoste, ...mappa])) vero(`routeTree.gen.ts conosce ${p}`, new RegExp(`'${p}':`).test(albero));
vero("routeTree.gen.ts: la home di oggi non si è spostata (nessuna /classica)", !/'\/classica'/.test(albero));
vero("routeTree.gen.ts: nessuna rotta di prova o di anteprima", !/prova-b7|anteprima-home/.test(albero));

finisci();
