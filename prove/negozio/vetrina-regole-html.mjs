/** ── VETRINA V1 · T99b · LE REGOLE SULL'HTML RESO (PIANO-V1 §7.3 regole 3, 4, 5b, 17; V1-T4, T5, T6, T7, T15) ────────────────
 *  Disegna TUTTE le pagine V1 (home, categoria, ricerca, scheda, carrello) con `rendi()` di `_rende.mjs`, DENTRO il guscio vero (`shop.tsx`), in quattro
 *  scenari: `completo` (tutto pieno), `vuoto` (nessun contenuto, nessuna foto, nessuna tariffa: la pagina si ricompone), `pochi` (un prodotto, una foto)
 *  e `guasto` (il server che lancia: la pagina resta valida). In più, dove serve, il prodotto Invisible Derm (cura, ricerca, scheda, carrello) e le
 *  pagine 404 e 500. Su OGNI html reso (guscio + pagina, più `head`: meta e JSON-LD) controlla:
 *   · le parole vietate (SPEC §12.4.1 n. 11, più `<del>`, `<s>`, `line-through`, «ultimi», «solo N», `{{`, «da confermare»), costruite a pezzi in `_dati-vetrina.mjs`;
 *   · nessun indirizzo dello studio (`Scipioni`, via con civico, CAP di Roma);
 *   · Invisible Derm senza cifre (card, ricerca, scheda, carrello: HTML, meta e JSON-LD) e nessun prezzo nei `<meta>`;
 *   · un solo `h1` per documento;
 *   · ogni `<img>` con `alt`, `width`, `height`;
 *   · fra le foto della pagina al più una `eager`, tutte le altre `lazy`;
 *   · un solo pieno nel marchio (al massimo un'azione piena: la barra fissa non è nell'HTML del server);
 *   · nessun errore tecnico mostrato (500) e, per lo scenario che non può disegnare (categoria senza prodotti), il rimando a `/shop`.
 *  Regola 17: richiama `codice-identico-v1` (l'oro) e vuole zero rossi.
 *  Le violazioni NON si correggono qui e le regole non si indeboliscono: un rosso è una domanda per l'architetto (vedi lavagna).
 *  È una prova ADDITIVA: non tocca altre prove né `src/`. Dati inventati (`_dati-vetrina.mjs`), nessuna rete, nessun database.
 *  Memoria: ogni disegno si impacchetta con esbuild (≈ 11 MB di heap trattenuto per pacchetto). Qui se ne tengono vivi al massimo due (la «sonda» della
 *  pagina, che serve per chiamarne il `loader` vero, e il disegno in corso) e si staccano da `require.cache` e dal registro `__pagine` subito dopo.
 *  Come per `r2-regole`, la ricerca delle parole proibite non guarda `prove/`. */
import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as D from "./_dati-vetrina.mjs";
import { rendi, rendiComponente } from "./_rende.mjs";

const requireQui = createRequire(import.meta.url);
const TMP = realpathSync(tmpdir());
const CMS = { modalita: "cms" };
const SEGNAPOSTO = "SEGNAPOSTO-PAGINA-T99B";
const SCENARI = ["completo", "vuoto", "pochi", "guasto"];
const ROTTE = {
  guscio: "src/routes/shop.tsx",
  home: "src/routes/shop.index.tsx",
  categoria: "src/routes/shop.c.$slug.tsx",
  cerca: "src/routes/shop.cerca.tsx",
  scheda: "src/routes/shop.prodotto.$slug.tsx",
  carrello: "src/routes/shop.carrello.tsx",
};
const FILE_GUSCIO = "src/components/shop/guscio/GuscioShop.tsx";

/* ── memoria: staccare i pacchetti dopo l'uso (stessa idea di `prove/negozio.mjs`, ma disegno per disegno) ── */

const istantanea = () => ({ chiavi: new Set(Object.keys(requireQui.cache)), n: globalThis.__pagine?.length ?? 0 });
function libera(prima) {
  for (const k of Object.keys(requireQui.cache)) {
    if (prima.chiavi.has(k) || !k.startsWith(TMP)) continue;
    const modulo = requireQui.cache[k];
    delete requireQui.cache[k];
    const figli = modulo?.parent?.children;
    if (figli) { const i = figli.indexOf(modulo); if (i >= 0) figli.splice(i, 1); }
  }
  for (let i = prima.n; i < (globalThis.__pagine?.length ?? 0); i++) globalThis.__pagine[i] = null;
}
/** Esegue `fn` e stacca tutto ciò che ha caricato (`fn` restituisce solo stringhe e numeri, mai la rotta o la pagina). */
async function conPulizia(fn) {
  const prima = istantanea();
  try { return await fn(); } finally { libera(prima); }
}

/* ── lettura dell'html ── */

/** Senza le immagini incorporate (il logo: centinaia di KB di lettere a caso che potrebbero contenere una parola vietata). */
/** Un marcatore intero: i valori fra virgolette possono contenere «>» (React non lo trasforma nelle classi: `[&>div]:mx-0`). */
const RE_TAG = /<\/?[a-zA-Z][a-zA-Z0-9]*(?:"[^"]*"|'[^']*'|[^>"'])*>/g;
const senzaDati = (h) => h.replace(/data:[\w/+.-]+;base64,[A-Za-z0-9+/=]+/g, "data:IMMAGINE");
const entita = (t) => t.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/ /g, " ");
/** I pezzi di testo che si leggono, più le descrizioni che si sentono (`alt`, `aria-label`, `title`, `placeholder`), uno per nodo. */
const nodi = (h) => entita(h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(RE_TAG, (tag) => `\u0001${[...tag.matchAll(/\s(?:alt|aria-label|title|placeholder)="([^"]*)"/g)].map((m) => m[1]).join("\u0001")}\u0001`)).split("\u0001").map((t) => t.replace(/\s+/g, " ").trim()).filter(Boolean);
const leggibile = (h) => nodi(h).join(" ");
const conta = (h, re) => (h.match(re) ?? []).length;
const attr = (tag, nome) => (tag.match(new RegExp(`\\s${nome}(?:="([^"]*)")?(?=[\\s/>])`)) ?? [])[1] ?? (new RegExp(`\\s${nome}(?=[\\s/>])`).test(tag) ? "" : undefined);
const imgs = (h) => h.match(/<img\b(?:"[^"]*"|'[^']*'|[^>"'])*>/g) ?? [];
/** Le immagini con un dato in più: stanno dentro un link, un bottone o una voce di elenco (che hanno un nome accanto)? */
const VUOTI = new Set(["img", "br", "hr", "input", "link", "meta", "path", "circle", "rect", "line", "source", "use", "polyline", "polygon", "ellipse"]);
function immaginiConAntenati(h) {
  const pila = [];
  const fuori = [];
  for (const m of h.matchAll(RE_TAG)) {
    const nome = m[0].match(/^<\/?([a-zA-Z0-9]+)/)[1].toLowerCase();
    const chiude = m[0].startsWith("</");
    if (nome === "img") { fuori.push({ tag: m[0], dentro: pila.some((x) => x === "a" || x === "button" || x === "li") }); continue; }
    if (VUOTI.has(nome) || m[0].endsWith("/>")) continue;
    if (chiude) { const i = pila.lastIndexOf(nome); if (i >= 0) pila.length = i; } else pila.push(nome);
  }
  return fuori;
}

/** Cosa è «un pieno»: l'azione col fondo notte e il testo bianco (sul chiaro) o col fondo bianco e il testo notte (sullo scuro), o il blu della consulenza.
 *  Si guardano solo link e bottoni grandi: i chip dei filtri (con il bordo), le palline dei colori (`rounded-full`) e i quadratini di quantità non sono azioni. */
function pieni(h) {
  const trovati = [];
  for (const m of h.matchAll(/<(a|button)\b((?:"[^"]*"|'[^']*'|[^>"'])*)>/g)) {
    const a = m[2];
    const classi = new Set((attr(a, "class") ?? "").split(/\s+/));
    const bordo = [...classi].some((x) => /^border(-|$)/.test(x));
    const grande = [...classi].some((x) => /^(min-)?h-1[2-9]$/.test(x));
    const notte = classi.has("bg-[#0A1430]") && classi.has("text-white");
    const blu = (classi.has("bg-brand") || classi.has("bg-brand-scuro")) && classi.has("text-white");
    const chiaro = classi.has("bg-white") && classi.has("text-[#0A1430]");
    if (attr(a, "data-aspetto") === "pieno" || ((notte || blu || chiaro) && grande && !bordo && !classi.has("rounded-full"))) trovati.push(`<${m[1]}${a.slice(0, 90)}`);
  }
  return trovati;
}

/** Le cifre di un frammento. Sono strutturali, non di prodotto, e non contano: un nodo che è solo un indice (1-2 cifre: passi, domande), un contatore «1/7» o «Foto 1 di 7». */
const STRUTTURA = /^(?:\d{1,2}|\d{1,2}\s*\/\s*\d{1,2}|Foto \d+ di \d+)$/;
const cifre = (h) => nodi(h).filter((n) => !STRUTTURA.test(n)).flatMap((n) => n.match(/\d+(?:[.,]\d+)*/g) ?? []);
/** Un prezzo: una cifra con la virgola o il punto e due decimali, il simbolo dell'euro, «EUR». */
const PREZZO = /€|\bEUR\b|\d[\d.]*,\d{2}\b/;
/** Le chiavi del JSON-LD che portano un prezzo. */
const CHIAVE_PREZZO = /^(price|lowPrice|highPrice|priceCurrency|priceSpecification|offers|aggregateOffer)$/i;
/** Un indirizzo dello studio: la via, la via con un civico, un CAP di Roma. Il testo è quello che si legge (non gli indirizzi dei link). */
const INDIRIZZO = [/Scipioni/i, /\bVia degli\b/i, /\b(?:Via|Viale|Piazza|Largo|Corso)\s+(?:d[eil]l?l?[oa']?\s+)?[A-ZÀ-Ù][\wà-ù']+(?:\s+[A-ZÀ-Ù][\wà-ù']+)*,?\s+\d{1,3}\b/, /\b00[1-2]\d{2}\b/];

/** Il JSON-LD e i meta resi da `head()` di una rotta: `{ meta, jsonld }` come testo, per le regole. */
function leggiTesta(testa) {
  const meta = [...(testa?.meta ?? []), ...(testa?.links ?? [])];
  const scripts = (testa?.scripts ?? []).map((s) => String(s.children ?? ""));
  return { meta, scripts };
}
function visita(x, f, chiave = "") {
  if (Array.isArray(x)) x.forEach((v) => visita(v, f, chiave));
  else if (x && typeof x === "object") for (const [k, v] of Object.entries(x)) { f(k, v); visita(v, f, k); }
}

/** Il guscio e la pagina in un solo documento (come li compone `shop.tsx`: la pagina sta dentro `<main>`). */
const documento = (guscio, pagina) => guscio.replace(SEGNAPOSTO, pagina);

/** Le regole su UN documento reso. `nome` = «pagina · scenario»; `pagina` = il solo frammento della pagina (le foto del guscio, il logo, non sono foto di contenuto);
 *  `testa` = ciò che `head()` dà (meta e JSON-LD); `derm` = i pezzi di documento che parlano di Invisible Derm (le sue card, o tutta la pagina della sua scheda). */
function regole(c, { nome, doc, pagina, testa = {}, derm = null, tuttoDerm = false }) {
  const h = senzaDati(doc);
  const { meta, scripts } = leggiTesta(testa);
  const tuttaLaTesta = JSON.stringify(meta) + scripts.join("\n");
  const testo = leggibile(h);
  // 3 · parole vietate, in HTML, meta e JSON-LD
  c(`${nome}: nessuna parola vietata, nessun «da confermare», nessuna «{{», nessun prezzo barrato (HTML, meta, JSON-LD)`, [], D.trovaParoleVietate(`${h}\n${tuttaLaTesta}`));
  // V1-T7 · nessun indirizzo dello studio
  c(`${nome}: nessun indirizzo dello studio (via, civico, CAP) nel testo, nei meta e nel JSON-LD`, [], INDIRIZZO.filter((re) => re.test(testo) || re.test(entita(tuttaLaTesta))).map(String));
  // 4 · nessun prezzo nei meta (il JSON-LD di un prodotto in vendita può avere l'offerta; quello di Invisible Derm no: sotto)
  c(`${nome}: nessun prezzo nei <meta> (né «€», né una cifra con due decimali)`, [], meta.filter((m) => PREZZO.test(String(m.content ?? m.title ?? m.href ?? ""))).map((m) => m.property ?? m.name ?? m.rel));
  // 5b · un solo h1
  c(`${nome}: un solo h1`, 1, conta(h, /<h1[\s>]/g));
  // 5b · ogni <img> con alt, width, height. `alt=""` è un `alt` (decorazione) solo dentro un link, un bottone o una voce di elenco, che hanno un nome accanto
  //  (campioni, miniature della galleria, riga del carrello), con `aria-hidden`, o se è una miniatura fissa (`sizes="72px"`, «Ti serve anche»); su una foto grande è un testo alternativo mancato
  //  (in produzione `FotoShop` senza descrizione scrive `alt=""`).
  const manca = immaginiConAntenati(h).flatMap(({ tag, dentro }) => {
    const alt = attr(tag, "alt");
    const dimensione = (n) => /^[1-9]\d*$/.test(attr(tag, n) ?? "");
    const mancanti = [];
    const miniatura = /^\d+px$/.test(attr(tag, "sizes") ?? "") && parseInt(attr(tag, "sizes"), 10) <= 96;
    if (alt === undefined || (alt === "" && !dentro && !miniatura && attr(tag, "aria-hidden") !== "true" && attr(tag, "role") !== "presentation")) mancanti.push("alt");
    if (!dimensione("width")) mancanti.push("width");
    if (!dimensione("height")) mancanti.push("height");
    return mancanti.length ? [`${mancanti.join("+")} · ${(attr(tag, "src") ?? "").slice(0, 60)}`] : [];
  });
  c(`${nome}: ogni <img> ha alt, width e height`, [], manca);
  // 5b · solo una foto `eager` (la prima di contenuto), le altre `lazy`
  const foto = imgs(senzaDati(pagina));
  const nonLazy = foto.filter((i) => attr(i, "loading") !== "lazy");
  const altaPriorita = foto.filter((i) => /\sfetchPriority="high"/i.test(i) || /\sfetchpriority="high"/i.test(i));
  c(`${nome}: fra le foto della pagina al più una è eager (le altre lazy) e al più una ha la priorità alta`, [true, true], [nonLazy.length <= 1, altaPriorita.length <= 1 && altaPriorita.every((i) => nonLazy.includes(i))]);
  // 17 · un solo pieno nel marchio
  const pien = pieni(h);
  c(`${nome}: un solo pieno nel marchio (al massimo un'azione piena; la barra fissa non è nell'HTML)`, [], pien.length <= 1 ? [] : pien);
  // 4 · Invisible Derm senza cifre
  if (derm) {
    const pezzi = tuttoDerm ? [senzaDati(pagina)] : derm;
    c(`${nome}: Invisible Derm senza cifre (HTML: nessun numero, nessun prezzo vicino al suo nome)`, [], pezzi.flatMap((p) => [...cifre(p), ...(PREZZO.test(leggibile(p)) ? ["prezzo"] : [])]));
    const jsonLd = [];
    for (const s of scripts) { try { visita(JSON.parse(s), (k, v) => { if (CHIAVE_PREZZO.test(k)) jsonLd.push(k); if (typeof v === "string" && !/^https?:/.test(v) && !/^(sku|gtin\d*|mpn|productID|identifier)$/i.test(k) && /\d/.test(v)) jsonLd.push(`${k}=${v}`); }); } catch { jsonLd.push("JSON-LD che non si rilegge"); } }
    c(`${nome}: Invisible Derm senza cifre né offerta nel JSON-LD`, [], jsonLd);
    c(`${nome}: Invisible Derm senza cifre nei meta (titolo, descrizione, og)`, [], meta.flatMap((m) => (String(m.content ?? m.title ?? "").match(/\d+/g) ?? []).map((x) => `${m.property ?? m.name ?? "title"}=${x}`)).filter((x) => !/^(og:url|og:image|canonical|twitter:image|image)/.test(x)));
  }
}

/** Una pagina può non esistere per lo scenario (categoria senza prodotti: rimanda a `/shop`). */
const RIMANDO = Symbol("rimando");

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T99b · LE REGOLE SULL'HTML RESO, QUATTRO SCENARI, TUTTE LE PAGINE (23/11/2026)");
  try {
    await corpo(mod, { c, radice });
  } catch (e) {
    c("la prova non lancia eccezioni", "nessuna eccezione", String(e?.stack ?? e).slice(0, 400));
  }
  try {
    await oro({ c, gruppo, radice });
  } catch (e) {
    c("l'oro non lancia eccezioni", "nessuna eccezione", String(e?.stack ?? e).slice(0, 400));
  }
}

/** Un blocco che lancia è un rosso con il suo nome (pagina e scenario), e gli altri blocchi girano lo stesso. */
async function blocco(c, nome, f) {
  try { return await f(); } catch (e) { c(`${nome}: il disegno non lancia eccezioni`, "nessuna eccezione", String(e?.message ?? e).slice(0, 220)); return null; }
}

async function corpo(mod, { c, radice }) {
  const KC = mod["shop/cms/vetrina-carrello"];
  const SLUG_PATCH = KC.HREF_PATCH_PRONTE.split("/").pop();
  const SLUG_CURA = KC.HREF_CURA.split("/").pop();
  const guasta = (n = "giù") => () => { throw new Error(n); };

  /* ═════ i dati: un solo punto dove si dice cosa vale ogni scenario ═════ */
  const HERO = "https://prova.invalid/hero.jpg";
  const FOTO = (n) => `https://prova.invalid/${n}.jpg`;
  const PIENO = {
    testi: { "shop.conf.firmatario": "Nome di Prova", "shop.conf.reso": "Testo di prova sul reso.", "shop.conf.assistenza": "Testo di prova sull'assistenza.", "shop.conf.garanzia": "Testo di prova sulla copertura del prodotto." },
    media: { "shop.heroFoto": HERO, "shop.titolareFoto": FOTO("titolare"), "shop.pacco": FOTO("pacco"), "shop.coloriFoto": FOTO("colori"), "shop.coloriVideo": FOTO("colori-video"), "shop.coloriPoster": FOTO("colori-poster"), "shop.condivisione": FOTO("condivisione") },
  };
  const VUOTO = { testi: {}, media: {} };
  const SOLO_HERO = { testi: {}, media: { "shop.heroFoto": HERO } };
  const CASSA = { cassa: "vecchia", sicuro: false, metodi: [] };
  // le due categorie vere del documento (quelle dei due bottoni dell'eroe), per la home
  const ricat = (p) => ({ ...p, categorie: [{ slug: p.tipo === "cura" ? SLUG_CURA : SLUG_PATCH, nome: p.tipo === "cura" ? "Shampoo e balsami" : "Patch pronte" }] });
  const riga = (cat, ordine, quanti) => ({ slug: cat.slug, nome: cat.nome, tipo: "categoria", frase: null, foto: null, fotoAlt: null, seo: { titolo: null, descrizione: null }, ordine, quanti });
  const categorieHome = (prodotti) => [[SLUG_PATCH, "Patch pronte"], [SLUG_CURA, "Shampoo e balsami"]].map(([slug, nome], i) => riga({ slug, nome }, i, prodotti.filter((p) => p.categorie.some((x) => x.slug === slug)).length));
  const patchDi = (catalogo) => catalogo.filter((p) => p.tipo === "patch");
  const per = (catalogo, slug) => structuredClone(catalogo.find((p) => p.slug === slug));
  const spoglia = (cats) => cats.map((x) => ({ ...x, foto: null, fotoAlt: null, frase: null }));

  /* ═════ il guscio: un disegno per scenario (le categorie del suo loader vero) ═════ */
  const guscio = {};
  const testaGuscio = {};
  await blocco(c, "guscio", async () => {
    const base = istantanea();
    try {
      const sonda = await rendi(radice, ROTTE.guscio, { server: {}, pathname: "/shop", context: CMS, outlet: SEGNAPOSTO, loaderData: { categorie: [] } });
      const serverGuscio = {
        completo: { elencoCategorie: () => D.categorie(D.CATALOGO) },
        vuoto: { elencoCategorie: () => [] },
        pochi: { elencoCategorie: () => D.categorie(D.CATALOGO).slice(0, 1) },
        guasto: { elencoCategorie: guasta() },
      };
      for (const s of SCENARI) {
        sonda.pagina.server = serverGuscio[s];
        const dati = await sonda.route.loader({ context: CMS, location: { pathname: "/shop" } });
        const r = await conPulizia(async () => {
          const d = await rendi(radice, ROTTE.guscio, { server: {}, pathname: "/shop", context: CMS, outlet: SEGNAPOSTO, loaderData: dati });
          return d.html;
        });
        guscio[s] = r;
        c(`guscio · ${s}: si disegna, con il segnaposto della pagina dentro <main> e senza nessun h1`, [true, 0], [new RegExp(`<main[^>]*>${SEGNAPOSTO}</main>`).test(r), conta(r, /<h1[\s>]/g)]);
      }
      // la testa del layout, per ogni pagina (titolo e descrizione del copy)
      const layout = { routeId: "/shop", pathname: "/shop", context: CMS };
      for (const [pagina, percorso] of Object.entries({ home: "/shop", categoria: "/shop/c/patch-pronte", cerca: "/shop/cerca", scheda: "/shop/prodotto/abc", carrello: "/shop/carrello" })) {
        testaGuscio[pagina] = sonda.route.head({ match: layout, matches: [layout, { routeId: `/${pagina}`, pathname: percorso }], params: {} });
      }
    } finally {
      libera(base);
    }
  });
  const testaUnita = (pagina, testa) => ({ meta: [...(testaGuscio[pagina]?.meta ?? []), ...(testa?.meta ?? [])], links: testa?.links ?? [], scripts: testa?.scripts ?? [] });

  /** Disegna e controlla un documento: la pagina `html` dentro il guscio dello scenario. */
  const controlla = (nome, scenario, pagina, extra = {}) => {
    if (!guscio[scenario]) return c(`${nome}: il guscio dello scenario c'è`, true, false);
    regole(c, { nome, doc: documento(guscio[scenario], pagina.html), pagina: pagina.html, testa: pagina.testa, ...extra });
  };

  /* ═════ HOME ═════ */
  await blocco(c, "home", async () => {
    const base = istantanea();
    try {
      const sonda = await rendi(radice, ROTTE.home, { server: {}, pathname: "/shop", context: { modalita: "codice" }, loaderData: null });
      const PRODOTTI = D.CATALOGO.map(ricat);
      const sv = (prodotti, contenuto, tariffa) => ({ contenutoShop: () => contenuto, tariffaSpedizione: () => tariffa, elencoProdotti: () => prodotti, elencoCategorie: () => categorieHome(prodotti) });
      const server = {
        completo: sv(PRODOTTI, PIENO, D.TARIFFA_OK),
        vuoto: sv([], VUOTO, D.TARIFFA_ASSENTE),
        pochi: sv(PRODOTTI.slice(0, 1), SOLO_HERO, D.TARIFFA_OK),
        guasto: { contenutoShop: guasta(), tariffaSpedizione: guasta(), elencoProdotti: guasta(), elencoCategorie: guasta() },
      };
      for (const s of SCENARI) {
        const nome = `home · ${s}`;
        await blocco(c, nome, async () => {
          sonda.pagina.server = server[s];
          const dati = await sonda.route.loader({ params: {}, context: CMS, deps: {} });
          const testaRotta = sonda.route.head({ match: { context: CMS, status: "success" }, loaderData: dati, params: {} });
          const r = await conPulizia(async () => ({ html: (await rendi(radice, ROTTE.home, { server: {}, pathname: "/shop", context: CMS, loaderData: dati })).html }));
          controlla(nome, s, { ...r, testa: testaUnita("home", testaRotta) });
        });
      }
    } finally {
      libera(base);
    }
  });

  /* ═════ CATEGORIA ═════ */
  await blocco(c, "categoria", async () => {
    const base = istantanea();
    try {
      const sonda = await rendi(radice, ROTTE.categoria, {
        server: {}, context: CMS, params: { slug: D.CATEGORIE[0].slug },
        loaderData: { categoria: D.CATEGORIE[0], meta: { titolo: "Prova", descrizione: "Prova" }, prodotti: [], contenuto: VUOTO, tariffa: D.TARIFFA_ASSENTE },
      });
      const sv = (prodotti, categorie, contenuto, tariffa) => ({
        elencoProdotti: ({ data }) => prodotti.filter((p) => p.categorie.some((x) => x.slug === data.categoria)),
        elencoCategorie: () => categorie,
        contenutoShop: contenuto,
        tariffaSpedizione: tariffa,
      });
      const unaPatch = patchDi(D.CATALOGO_UNA_FOTO).slice(0, 1);
      const server = {
        completo: sv(D.CATALOGO, D.CATEGORIE, () => PIENO, () => D.TARIFFA_OK),
        vuoto: sv(D.CATALOGO_SENZA_FOTO, spoglia(D.categorie(D.CATALOGO_SENZA_FOTO)), () => VUOTO, () => D.TARIFFA_ASSENTE),
        pochi: sv(unaPatch, D.categorie(unaPatch), () => SOLO_HERO, () => D.TARIFFA_OK),
        guasto: sv(D.CATALOGO, D.CATEGORIE, guasta(), guasta()),
      };
      /** Il loader vero, poi il disegno: `RIMANDO` se la categoria non esiste per il pubblico (rimanda a `/shop`). */
      const pagina = async (slug, sv_) => {
        sonda.pagina.server = sv_;
        let dati;
        try { dati = await sonda.route.loader({ params: { slug }, context: CMS }); } catch (e) { if (e?.redirect) return { [RIMANDO]: e.redirect.to }; throw e; }
        const testaRotta = sonda.route.head({ loaderData: dati, params: { slug } });
        const r = await conPulizia(async () => ({ html: (await rendi(radice, ROTTE.categoria, { server: {}, context: CMS, params: { slug }, loaderData: dati })).html }));
        return { ...r, testa: testaUnita("categoria", testaRotta) };
      };
      for (const s of SCENARI) {
        const nome = `categoria · ${s}`;
        await blocco(c, nome, async () => controlla(nome, s, await pagina(D.CATEGORIE[0].slug, server[s])));
      }
      // Invisible Derm sta nella cura: le sue card (nome, «Scopri», nessuna cifra)
      await blocco(c, "categoria · completo · cura", async () => {
        const p = await pagina("cura", server.completo);
        const articoli = (p.html.match(/<article\b[\s\S]*?<\/article>/g) ?? []).filter((a) => /Invisible Derm/.test(a));
        c("categoria · completo · cura: la card di Invisible Derm c'è (il controllo delle cifre guarda qualcosa)", 1, articoli.length);
        controlla("categoria · completo · cura", "completo", p, { derm: articoli });
      });
      // senza prodotti pubblicati (o con il server dei prodotti giù) la categoria non esiste: rimanda a /shop, mai un errore
      const senza = await pagina(D.CATEGORIE[0].slug, sv([], D.CATEGORIE, () => PIENO, () => D.TARIFFA_OK));
      const giu = await pagina(D.CATEGORIE[0].slug, { ...server.completo, elencoProdotti: guasta() });
      c("categoria · vuoto e guasto dei prodotti: la pagina non c'è, rimanda a /shop (nessun errore al pubblico)", ["/shop", "/shop"], [senza[RIMANDO], giu[RIMANDO]]);
    } finally {
      libera(base);
    }
  });

  /* ═════ RICERCA ═════ */
  await blocco(c, "ricerca", async () => {
    const base = istantanea();
    try {
      const sonda = await rendi(radice, ROTTE.cerca, { server: { elencoProdotti: () => [] }, context: CMS, loaderData: { carte: [], suggeriti: [], guasto: false }, search: { q: "" } });
      const server = {
        completo: { elencoProdotti: () => D.CATALOGO },
        vuoto: { elencoProdotti: () => [] },
        pochi: { elencoProdotti: () => D.CATALOGO_UNA_FOTO.slice(0, 1) },
        guasto: { elencoProdotti: guasta() },
      };
      const cerca = async (s, q, nome, extra = {}) => {
        sonda.pagina.server = server[s];
        const dati = await sonda.route.loader({ context: CMS, params: {}, search: { q } });
        const testaRotta = sonda.route.head({});
        const ricerca = sonda.route.validateSearch({ q });
        const r = await conPulizia(async () => ({ html: (await rendi(radice, ROTTE.cerca, { server: {}, context: CMS, loaderData: dati, search: ricerca })).html }));
        controlla(nome, s, { ...r, testa: testaUnita("cerca", testaRotta) }, extra);
        return r;
      };
      for (const s of SCENARI) await blocco(c, `ricerca · ${s}`, () => cerca(s, s === "pochi" ? "alfa" : "patch", `ricerca · ${s}`));
      // Invisible Derm fra i risultati: la sua card senza cifre
      await blocco(c, "ricerca · completo · Invisible Derm", async () => {
        sonda.pagina.server = server.completo;
        const dati = await sonda.route.loader({ context: CMS, params: {}, search: { q: "invisible" } });
        const r = await conPulizia(async () => ({ html: (await rendi(radice, ROTTE.cerca, { server: {}, context: CMS, loaderData: dati, search: sonda.route.validateSearch({ q: "invisible" }) })).html }));
        const articoli = (r.html.match(/<article\b[\s\S]*?<\/article>/g) ?? []).filter((a) => /Invisible Derm/.test(a));
        c("ricerca · completo · Invisible Derm: la card c'è tra i risultati", true, articoli.length >= 1);
        controlla("ricerca · completo · Invisible Derm", "completo", { ...r, testa: testaUnita("cerca", sonda.route.head({})) }, { derm: articoli });
      });
    } finally {
      libera(base);
    }
  });

  /* ═════ SCHEDA ═════ */
  await blocco(c, "scheda", async () => {
    const base = istantanea();
    try {
      const sonda = await rendi(radice, ROTTE.scheda, { componente: "notFoundComponent", context: CMS, server: {} });
      const CARRELLO = { add() {}, lines: [], count: 0 };
      const sv = (prodotto, { tariffa, testi, cassa }) => ({ schedaProdotto: () => ({ esito: "trovato", prodotto }), tariffaSpedizione: tariffa, contenutoShop: testi, cassaPubblica: cassa });
      const guasti = { tariffa: guasta(), testi: guasta(), cassa: guasta() };
      const scheda = async (prodotto, fonti, nome, scenario, extra = {}) => {
        sonda.pagina.server = sv(prodotto, fonti);
        const dati = await sonda.route.loader({ params: { slug: prodotto.slug }, deps: { anteprima: "" }, context: CMS });
        const testaRotta = sonda.route.head({ loaderData: dati, match: { status: "success" } });
        const r = await conPulizia(async () => ({ html: (await rendi(radice, ROTTE.scheda, { params: { slug: prodotto.slug }, loaderData: dati, context: CMS, carrello: CARRELLO, server: {} })).html }));
        controlla(nome, scenario, { ...r, testa: testaUnita("scheda", testaRotta) }, extra);
        return r;
      };
      const ok = { tariffa: () => D.TARIFFA_OK, testi: () => PIENO, cassa: () => CASSA };
      await blocco(c, "scheda · completo", () => scheda(per(D.CATALOGO, "patch-prova-alfa"), ok, "scheda · completo", "completo"));
      await blocco(c, "scheda · vuoto", () => scheda(per(D.CATALOGO_SENZA_FOTO, "patch-prova-alfa"), { tariffa: () => D.TARIFFA_ASSENTE, testi: () => VUOTO, cassa: () => CASSA }, "scheda · vuoto", "vuoto"));
      await blocco(c, "scheda · pochi", () => scheda(per(D.CATALOGO_UNA_FOTO, "patch-prova-alfa"), { ...ok, testi: () => VUOTO }, "scheda · pochi", "pochi"));
      await blocco(c, "scheda · guasto", () => scheda(per(D.CATALOGO, "patch-prova-alfa"), guasti, "scheda · guasto", "guasto"));
      // un prodotto per la cura, e Invisible Derm (a foto piene e a una foto): tutta la sua pagina senza cifre
      await blocco(c, "scheda · completo · cura", () => scheda(per(D.CATALOGO, "shampoo-prova"), ok, "scheda · completo · cura", "completo"));
      await blocco(c, "scheda · completo · Invisible Derm", () => scheda(per(D.CATALOGO, "invisible-derm-prova"), ok, "scheda · completo · Invisible Derm", "completo", { derm: [], tuttoDerm: true }));
      await blocco(c, "scheda · pochi · Invisible Derm", () => scheda(per(D.CATALOGO_UNA_FOTO, "invisible-derm-prova"), { ...ok, testi: () => VUOTO }, "scheda · pochi · Invisible Derm", "pochi", { derm: [], tuttoDerm: true }));
    } finally {
      libera(base);
    }
  });

  /* ═════ CARRELLO ═════ */
  await blocco(c, "carrello", async () => {
    const base = istantanea();
    try {
      const [alfa] = D.CARRELLO_NUOVO;
      const scenari = {
        completo: { righe: D.CARRELLO_NUOVO, rivalida: {}, tariffa: D.TARIFFA_CARRELLO_OK },
        vuoto: { righe: [], rivalida: {}, tariffa: D.TARIFFA_CARRELLO_OK },
        pochi: { righe: [{ ...alfa, qty: 1 }], rivalida: {}, tariffa: D.TARIFFA_CARRELLO_OK },
        guasto: { righe: D.CARRELLO_NUOVO, rivalida: { stato: "non_verificabile" }, tariffa: D.TARIFFA_CARRELLO_ASSENTE },
        misto: { righe: D.CARRELLO_MISTO, rivalida: {}, tariffa: D.TARIFFA_CARRELLO_OK },
      };
      for (const [s, d] of Object.entries(scenari)) {
        const nome = s === "misto" ? "carrello · completo · Invisible Derm" : `carrello · ${s}`;
        await blocco(c, nome, async () => {
          const r = await conPulizia(async () => ({
            html: (await rendi(radice, ROTTE.carrello, { loaderData: { modo: "cms" }, carrello: D.carrelloFinto(d.righe), rivalida: D.rivalidaFinta(d.rivalida), tariffa: d.tariffa, pathname: "/shop/carrello", context: CMS })).html,
          }));
          // Invisible Derm in un carrello vecchio con un prezzo ricordato dal browser (123,00): la riga non si disegna e nessuna cifra sua esce
          if (s === "misto") c(`${nome}: la riga di Invisible Derm non c'è e il suo prezzo ricordato dal browser nemmeno`, [false, false], [/Invisible Derm/.test(r.html) && /123,00/.test(r.html), /123,00/.test(r.html)]);
          controlla(nome, s === "misto" ? "completo" : s, { ...r, testa: testaUnita("carrello", undefined) }, s === "misto" ? { derm: [r.html.match(/Invisible Derm[^<]*/g)?.join(" ") ?? "", ...(/123,00/.test(r.html) ? ["123,00"] : [])], tuttoDerm: false } : {});
        });
      }
    } finally {
      libera(base);
    }
  });

  /* ═════ 404 e 500 DENTRO IL GUSCIO ═════ */
  await blocco(c, "errori", async () => {
    const base = istantanea();
    try {
      for (const [nome, componente, props] of [["404", "NonTrovataShop", {}], ["500", "ErroreShop", { error: new Error("SEGRETO-DEL-SERVER-99") }]]) {
        await blocco(c, `pagina ${nome}`, async () => {
          const r = await conPulizia(async () => ({ html: (await rendiComponente(radice, FILE_GUSCIO, componente, props, { context: CMS })).html }));
          controlla(`pagina ${nome} · guasto`, "guasto", { ...r, testa: testaUnita("home", undefined) });
          c(`pagina ${nome} · guasto: nessun errore tecnico al pubblico`, false, /SEGRETO-DEL-SERVER|catalogo-temporaneamente|stack|TypeError|at\s+\S+\s+\(/.test(r.html));
        });
      }
    } finally {
      libera(base);
    }
  });
}

/** Regola 17: l'oro del `codice` (`codice-identico-v1`) è verde. */
async function oro({ c, gruppo, radice }) {
  const { prove: proveOro } = await import("./codice-identico-v1.mjs");
  const base = istantanea();
  let fatti = 0;
  const rossi = [];
  try {
    await proveOro({}, {
      c: (nome, atteso, letto) => { fatti++; if (JSON.stringify(atteso) !== JSON.stringify(letto)) rossi.push(nome.slice(0, 120)); },
      gruppo: () => {},
      radice,
    });
  } finally {
    libera(base);
    delete globalThis.__pagina;
  }
  c(`regola 17 · l'oro del codice (codice-identico-v1) è verde: zero rossi su ${fatti} controlli`, { rossi: [], controlliAlmeno: true }, { rossi: rossi.slice(0, 6), controlliAlmeno: fatti >= 300 });
}
