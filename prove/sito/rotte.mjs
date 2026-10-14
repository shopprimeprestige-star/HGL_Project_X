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
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { carica, leggi, nuovaProva, radice } from "./_comune.mjs";

const { c, vero, finisci } = nuovaProva("rotte e mappa del sito");
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const SEO = await carica("src/seo/regole.ts", "seo-regole");

/* ── La mappa del sito ──────────────────────────────────────────────────── */
const mappa = [...SEO.PAGINE_PUBBLICHE];
vero("mappa: resta tutto ciò che c'era", ["/", "/blog", "/shop", "/privacy-policy", "/cookie-policy", "/termini-e-condizioni"].every((p) => mappa.includes(p)));
c("mappa: /protocol, /catalogo, /soluzioni, /classica e /nuova non ci sono (noindex o nascoste)", [], mappa.filter((p) => ["/protocol", "/catalogo", "/soluzioni", "/classica", "/nuova"].includes(p)));
c("mappa: nessun percorso doppio", mappa.length, new Set(mappa).size);

/* ── Le pagine nascoste ─────────────────────────────────────────────────── */
const nascoste = [...(SEO.PAGINE_NASCOSTE ?? [])];
c("nascoste: /protocol, /catalogo e /soluzioni finché il redesign non è approvato", ["/protocol", "/catalogo", "/soluzioni"], nascoste);
c("nessuna pagina è insieme nella mappa e nascosta", [], nascoste.filter((p) => mappa.includes(p)));
const sitemap = SEO.sitemapXml(mappa.map((percorso) => ({ percorso })), "https://esempio.it");
vero("sitemap.xml: né /protocol né /catalogo né /soluzioni", !/\/protocol|\/catalogo|\/soluzioni/.test(sitemap));
vero("robots.txt: non blocca /protocol, /catalogo né /soluzioni (altrimenti Google non legge il noindex)", !/\/protocol|\/catalogo|\/soluzioni/.test(SEO.robotsTxt("https://esempio.it")));

// Ogni pagina nascosta dichiara `noindex` nella sua testata; ogni pagina della mappa NO.
const rotta = { "/protocol": "src/routes/protocol.tsx", "/catalogo": "src/routes/catalogo.tsx", "/soluzioni": "src/routes/soluzioni.tsx" };
for (const p of nascoste) {
  const testo = senzaCommenti(leggi(rotta[p]));
  vero(`${p}: la testata dichiara noindex`, /name:\s*"robots",\s*content:\s*"noindex/.test(testo));
}

/* ── Le rotte generate ──────────────────────────────────────────────────── */
const albero = leggi("src/routeTree.gen.ts");
for (const p of new Set([...nascoste, ...mappa])) vero(`routeTree.gen.ts conosce ${p}`, new RegExp(`'${p}':`).test(albero));
vero("routeTree.gen.ts conosce l'API dell'anteprima di /soluzioni", /'\/api\/crm\/anteprima-soluzioni':/.test(albero));
vero("routeTree.gen.ts: la home di oggi non si è spostata (nessuna /classica)", !/'\/classica'/.test(albero));
vero("routeTree.gen.ts: nessuna rotta di prova o di anteprima", !/prova-b7|anteprima-home/.test(albero));

/* ── /soluzioni · la rotta e la sua cartella (landing v3) ───────────────────────────────────────── */
{
  const rottaSoluzioni = senzaCommenti(leggi("src/routes/soluzioni.tsx"));
  vero("/soluzioni: canonical sulla pagina stessa", /rel:\s*"canonical",\s*href:\s*`\$\{SITO\}\/soluzioni`/.test(rottaSoluzioni));
  vero("/soluzioni: il 302 è temporaneo (mai 301) e il cancello non dipende dal solo componente", /statusCode:\s*302/.test(rottaSoluzioni) && !/301/.test(rottaSoluzioni));
  vero("/soluzioni: il loader passa dalla funzione del server (la vista filtrata), mai dal contenuto grezzo", /leggiSoluzioni\(/.test(rottaSoluzioni) && !/landing-content|useLandingContent|fetchLandingContent/.test(rottaSoluzioni));

  //  Nessun import vietato nei componenti della pagina (landing v3: «Non si usa» di 4.8) e nessun tipo del contenuto grezzo nelle prop.
  const VIETATI = /MediaSlot|PlaceholderBox|useLandingContent|traccia-provvisoria|StickyHeader|BarraConsulenza|VideoReviewsSection|PannelloProblemi|ModuloSegnaposto/;
  const cartella = "src/landing/sito/soluzioni";
  const componenti = readdirSync(join(radice, cartella)).filter((f) => f.endsWith(".tsx"));
  vero("la cartella soluzioni/ ha i componenti di S3", ["PaginaSoluzioni.tsx", "SpiegazioneInvisible.tsx", "TavolaSoluzioni.tsx", "Testata.tsx"].every((f) => componenti.includes(f)));
  const trovati = [];
  for (const f of componenti) {
    const testo = senzaCommenti(leggi(`${cartella}/${f}`));
    if (VIETATI.test(testo)) trovati.push(`${f}: import o uso vietato`);
    if (/\bLandingContent\b/.test(testo)) trovati.push(`${f}: usa il tipo LandingContent (le prop sono la VistaSoluzioni)`);
    if (/wa\.me|whatsapp|mailto:|tel:/i.test(testo) && f !== "ponte-ui.tsx") trovati.push(`${f}: un'uscita che la pagina non ha`);
  }
  c("soluzioni/: nessun import vietato, nessun LandingContent nelle prop, nessuna uscita fuori da modulo e /shop", [], trovati);

  //  I testi stanno in TESTI_SOLUZIONI: nei componenti di S3 e nella rotta non c'è nessuna frase scritta a mano.
  const FRASE = /["'`][A-ZÀ-Ù][a-zà-ù']+(?: [a-zà-ù',.?!:]+){2,}/;
  const frasi = [];
  for (const f of ["Testata.tsx", "TavolaSoluzioni.tsx", "SpiegazioneInvisible.tsx", "PaginaSoluzioni.tsx"]) {
    for (const riga of senzaCommenti(leggi(`${cartella}/${f}`)).split("\n")) if (FRASE.test(riga)) frasi.push(`${f}: ${riga.trim().slice(0, 70)}`);
  }
  for (const riga of rottaSoluzioni.split("\n")) if (FRASE.test(riga)) frasi.push(`soluzioni.tsx: ${riga.trim().slice(0, 70)}`);
  c("testi: nessuna frase scritta nei componenti (tutto da TESTI_SOLUZIONI)", [], frasi);

  //  Le parti della home e di /protocol non si toccano (G1): questa pagina non le importa.
  const importaG1 = componenti.filter((f) => /HomeNuova|PaginaProtocol|routes\/index|VideoReviewsSection|StickyHeader/.test(senzaCommenti(leggi(`${cartella}/${f}`))));
  c("soluzioni/: non importa HomeNuova, PaginaProtocol né altro della home", [], importaG1);
}

finisci();
