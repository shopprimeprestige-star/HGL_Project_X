/** ── VETRINA V1 · T70b · L'ORO DEL `codice`: IL SITO DI OGGI NON DEVE CAMBIARE ────────────────────────────────────
 *  PIANO-V1 §5 T70b, D70, D71, criterio V1-T1 (parte `codice`). `_oro-codice-v1.json` è la FOTOGRAFIA di ciò che le rotte dello shop
 *  fanno oggi con il catalogo `codice`, presa dal base pulito (commit scritto nel file) PRIMA di ogni cambio di codice di V1.
 *  Questa prova rifà la fotografia sul codice di adesso e la confronta per UGUAGLIANZA con l'oro: un byte di HTML, un valore di `head`/`headers`/
 *  `loader`/`beforeLoad`, una chiamata al server in più, in meno, diversa o in un altro ordine = rosso.
 *
 *  Cosa si fotografa, con `rendi()` di `_rende.mjs` e «server che lancia» (ogni funzione del server NON prevista dal codice di oggi lancia):
 *   (a) l'HTML di: guscio (`shop.tsx`, carrello vuoto e con due righe), home, scheda di una patch, scheda di un prodotto per la cura
 *       (e i suoi due componenti di riserva: «non trovato» ed «errore temporaneo»), carrello vuoto, carrello con due righe. La categoria con `codice` è `notFound` (il suo `loader` lancia: nessun HTML della rotta;
 *       il 404 è quello della radice, che l'aiuto non sa disegnare: si fotografa il valore del `loader`).
 *   (b) il valore di `head()` e `headers()` di `shop.tsx` e di ogni rotta `shop.*` (anche con `collaudo` falso e con `collaudo` vero);
 *   (c) il valore di `loader()` e `beforeLoad()` di ogni rotta (`null`, `{modo}`, `{scheda:{tipo:"codice"},anteprima}`, `notFound`…), e quello di
 *       `validateSearch()` e `loaderDeps()` (`?anteprima=` della scheda con il taglio a 300 caratteri, `?annullato=` della cassa);
 *   (d) l'ELENCO ESATTO delle chiamate al server (nome, ordine e argomenti) di ogni funzione e di ogni scenario. «Zero chiamate» non è la
 *       regola: l'oro registra quello che il codice di oggi fa davvero (es. `modalitaCatalogo` e `collaudoDellaVisita` da `beforeLoad`).
 *  Una funzione che la rotta non ha (es. `head` della home) vale `«undefined»`: aggiungerne una che restituisce `{}` è una differenza.
 *
 *  ── come si lancia da sola ──
 *      SUPABASE_URL=http://127.0.0.1:9 VITE_SUPABASE_URL=http://127.0.0.1:9 node prove/negozio/codice-identico-v1.mjs [--verifica]
 *  Senza argomenti (o con `--verifica`) lancia la sola prova dell'oro e esce con codice 1 se c'è anche un solo rosso, 0 se è tutta verde.
 *
 *  ── come si rifà l'oro ──
 *  Mai per far tornare verde: serve solo se una decisione dell'architetto CAMBIA il sito di `codice` (D73: Inter e `lang="it"` sulle cinque pagine
 *  portano differenze di HTML volute; le scrive il compito che le introduce, dichiarandole in lavagna). Dal base pulito (`src/` senza modifiche):
 *      SUPABASE_URL=http://127.0.0.1:9 VITE_SUPABASE_URL=http://127.0.0.1:9 node prove/negozio/codice-identico-v1.mjs --scrivi
 *  Rifiuta di scrivere se `src/` o `prove/negozio/` (a parte il file dell'oro) hanno modifiche non salvate (l'oro non si prende da un albero sporco).
 *  Dati inventati (`_dati-vetrina.mjs`), nessuna rete, nessun database, la data è fissa (il piè di pagina scrive l'anno). */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as D from "./_dati-vetrina.mjs";
import { rendi } from "./_rende.mjs";

const QUI = dirname(fileURLToPath(import.meta.url));
const FILE_ORO = join(QUI, "_oro-codice-v1.json");
const INDEFINITO = "«undefined»";
const R = (f) => `src/routes/${f}.tsx`;

/** Il piè di pagina scrive `new Date().getFullYear()`: la data è ferma per la durata della fotografia. */
async function conDataFissa(fn) {
  const Vera = globalThis.Date;
  const FISSA = Vera.parse("2026-06-15T12:00:00.000Z");
  globalThis.Date = class extends Vera {
    constructor(...a) { super(...(a.length ? a : [FISSA])); }
    static now() { return FISSA; }
  };
  try { return await fn(); } finally { globalThis.Date = Vera; }
}

/** I dati incorporati (`data:…;base64,…`: il logo e le immagini del bundle) occupano molto: si tiene tipo, lunghezza e impronta. Un byte diverso cambia l'impronta. */
const comprimiDataUrl = (html) => html.replace(/data:([\w/+.-]+);base64,([A-Za-z0-9+/=]+)/g, (_, tipo, b) => `data:${tipo};base64,«${b.length}:${createHash("sha256").update(b).digest("hex").slice(0, 16)}»`);

/** Un valore come lo vede il JSON, con `undefined` e funzioni resi visibili (un `{ x: undefined }` e un `{}` sono diversi). */
const norma = (v) => JSON.parse(JSON.stringify(v, (_k, x) => (x === undefined ? INDEFINITO : typeof x === "function" ? "«funzione»" : x)) ?? `"${INDEFINITO}"`);
/** Stringa canonica (chiavi in ordine): il confronto non dipende dall'ordine di scrittura delle chiavi. */
const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));

/* ── i dati fissi degli scenari ── */
const PATCH = "lace-front-swiss-pu"; // protesi del catalogo del codice (t01)
const CURA = "shampoo-delicato-lace"; // cura del catalogo del codice (s1)
const RIGHE_CARRELLO = [{ productId: "t01", qty: 1, key: "t01" }, { productId: "s1", qty: 2, key: "s1" }]; // 289 + 2 × 24 = 337 €
const CARRELLO_2_RIGHE = D.carrelloFinto(RIGHE_CARRELLO, { subtotal: 337, count: 3 });
const PRODOTTO_CMS_FINTO = { slug: "prodotto-solo-cms", nome: "Prodotto di prova solo CMS" };
const lungo = (n) => "a".repeat(n);
const RETE = () => { throw new Error("rete"); };

/** I disegni (HTML): nome → [file, stato]. Ogni stato dichiara il server vuoto: ogni chiamata al server lancia. */
const DISEGNI = {
  "guscio · carrello vuoto": [R("shop"), { server: {}, pathname: "/shop", outlet: null }],
  "guscio · carrello con 2 righe": [R("shop"), { server: {}, pathname: "/shop", outlet: null, carrello: CARRELLO_2_RIGHE }],
  //  il ramo «link non attivo» dell'header (`text-white/60 hover:text-white`): il percorso non è `/shop`
  "guscio · /shop/carrello": [R("shop"), { server: {}, pathname: "/shop/carrello", outlet: null }],
  "home": [R("shop.index"), { server: {}, pathname: "/shop", loaderData: null, context: { modalita: "codice" } }],
  "scheda patch": [R("shop.prodotto.$slug"), { server: {}, pathname: `/shop/prodotto/${PATCH}`, params: { slug: PATCH }, loaderData: { scheda: { tipo: "codice" }, anteprima: false }, carrello: { add() {}, lines: [] } }],
  "scheda cura": [R("shop.prodotto.$slug"), { server: {}, pathname: `/shop/prodotto/${CURA}`, params: { slug: CURA }, loaderData: { scheda: { tipo: "codice" }, anteprima: false }, carrello: { add() {}, lines: [] } }],
  //  i due componenti di riserva della scheda (indirizzo che non c'è, guasto del catalogo): con `codice` si raggiungono davvero (il `loader` lancia)
  "scheda · non trovato": [R("shop.prodotto.$slug"), { server: {}, pathname: "/shop/prodotto/non-c-e", params: { slug: "non-c-e" }, componente: "notFoundComponent" }],
  "scheda · errore temporaneo": [R("shop.prodotto.$slug"), { server: {}, pathname: "/shop/prodotto/non-c-e", params: { slug: "non-c-e" }, componente: "errorComponent" }],
  "carrello vuoto": [R("shop.carrello"), { server: {}, pathname: "/shop/carrello", loaderData: { modo: "codice" }, rivalida: D.rivalidaFinta() }],
  "carrello con 2 righe": [R("shop.carrello"), { server: {}, pathname: "/shop/carrello", loaderData: { modo: "codice" }, carrello: CARRELLO_2_RIGHE, rivalida: D.rivalidaFinta() }],
};

/** Gli argomenti di una funzione di rotta quando la rotta non la ha o non serve altro: `head({match})`, `headers({matches})`, `loader({context})`. */
const CTX = { modalita: "codice" };
const ARG_PREDEFINITO = {
  beforeLoad: { context: {} },
  loader: { params: {}, context: CTX, deps: { anteprima: "" } },
  loaderDeps: { search: {} },
  head: { match: { context: CTX, status: "success" }, loaderData: undefined, params: {} },
  headers: { matches: [{ context: CTX }], match: { status: "success" }, loaderData: undefined },
};

/** Gli scenari per rotta e funzione: `[nome, arg, server, extra]` (`server` = le risposte dichiarate; `extra` = altri campi dello stato, p.es. `collaudo`). */
const come = (nome = "come oggi", arg = undefined, extra = {}) => [nome, arg, {}, extra];
const ROTTE = {
  "shop": {
    file: R("shop"),
    beforeLoad: [
      ["codice, collaudo falso", undefined, {}, {}],
      ["codice, collaudo vero", undefined, {}, { collaudo: true }],
      ["la modalità non si legge (rete)", undefined, { modalitaCatalogo: RETE }, {}],
      ["il collaudo non si legge (rete)", undefined, { collaudoDellaVisita: RETE }, {}],
    ],
    head: [
      ["contesto codice", { match: { context: CTX } }, {}, {}],
      ["contesto codice con collaudo falso", { match: { context: { modalita: "codice", collaudo: false } } }, {}, {}],
      ["senza contesto (lettura fallita)", { match: {} }, {}, {}],
      ["senza match", {}, {}, {}],
    ],
    headers: [
      ["nessun incontro", { matches: [] }, {}, {}],
      ["collaudo falso", { matches: [{ context: CTX }] }, {}, {}],
      ["collaudo falso esplicito", { matches: [{ context: { modalita: "codice", collaudo: false } }] }, {}, {}],
      ["collaudo vero", { matches: [{ context: { modalita: "codice", collaudo: true } }] }, {}, {}],
      ["incontro senza contesto", { matches: [{}] }, {}, {}],
    ],
    loader: [come()],
  },
  "shop.index": {
    file: R("shop.index"),
    beforeLoad: [come()],
    loader: [
      ["codice", { context: CTX }, {}, {}],
      ["senza modalità nel contesto", { context: {} }, {}, {}],
    ],
    head: [come()],
    headers: [come()],
  },
  "shop.c.$slug": {
    file: R("shop.c.$slug"),
    //  il disegno serve solo ad avere la rotta (`rendi` disegna sempre): con `codice` la rotta non si disegna mai, il suo `loader` lancia
    stato: { loaderData: { categoria: D.CATEGORIE[0], categorie: D.CATEGORIE, prodotti: D.CATALOGO.slice(0, 3) } },
    beforeLoad: [come()],
    loader: [
      ["codice: notFound", { params: { slug: "patch-pronte" }, context: CTX }, {}, {}],
      ["senza modalità nel contesto: notFound", { params: { slug: "patch-pronte" }, context: {} }, {}, {}],
    ],
    head: [
      ["senza dati (codice)", { params: { slug: "patch-pronte" } }, {}, {}],
    ],
    headers: [come()],
  },
  "shop.prodotto.$slug": {
    file: R("shop.prodotto.$slug"),
    stato: { params: { slug: PATCH }, loaderData: { scheda: { tipo: "codice" }, anteprima: false }, carrello: { add() {}, lines: [] } },
    beforeLoad: [come()],
    validateSearch: [
      ["senza ricerca", {}, {}, {}],
      ["?anteprima=chiave", { anteprima: "chiave-di-prova" }, {}, {}],
      ["?anteprima= vuota", { anteprima: "" }, {}, {}],
      ["anteprima non testo (numero)", { anteprima: 5 }, {}, {}],
      ["anteprima non testo (elenco)", { anteprima: ["a"] }, {}, {}],
      ["anteprima di 299 caratteri", { anteprima: lungo(299) }, {}, {}],
      ["anteprima di 300 caratteri", { anteprima: lungo(300) }, {}, {}],
      ["anteprima di 301 caratteri: tagliata a 300", { anteprima: lungo(301) }, {}, {}],
      ["anteprima di 400 caratteri: tagliata a 300", { anteprima: lungo(400) }, {}, {}],
      ["altre chiavi: scartate", { anteprima: "x", altro: 1, utm_source: "y" }, {}, {}],
    ],
    loaderDeps: [
      ["senza anteprima", { search: {} }, {}, {}],
      ["anteprima non definita", { search: { anteprima: undefined } }, {}, {}],
      ["anteprima presente", { search: { anteprima: "chiave-di-prova" } }, {}, {}],
    ],
    loader: [
      ["patch del codice", { params: { slug: PATCH }, deps: { anteprima: "" } }, {}, {}],
      ["cura del codice", { params: { slug: CURA }, deps: { anteprima: "" } }, {}, {}],
      ["patch del codice con ?anteprima=", { params: { slug: PATCH }, deps: { anteprima: "chiave-di-prova" } }, {}, {}],
      ["patch del codice, la modalità non si legge (rete)", { params: { slug: PATCH }, deps: { anteprima: "" } }, { modalitaCatalogo: RETE }, {}],
      ["slug sconosciuto, il server non lo ha: notFound", { params: { slug: "slug-che-non-esiste" }, deps: { anteprima: "" } }, {}, {}],
      ["slug sconosciuto, il server non lo ha, con ?anteprima=", { params: { slug: "slug-che-non-esiste" }, deps: { anteprima: "chiave-di-prova" } }, {}, {}],
      ["slug sconosciuto, il server guasto: errore temporaneo", { params: { slug: "slug-che-non-esiste" }, deps: { anteprima: "" } }, { schedaProdotto: { esito: "guasto" } }, {}],
      ["slug sconosciuto, la rete cade: errore temporaneo", { params: { slug: "slug-che-non-esiste" }, deps: { anteprima: "" } }, { schedaProdotto: RETE }, {}],
      ["slug solo CMS, modalità certa «incerto»: errore temporaneo", { params: { slug: PRODOTTO_CMS_FINTO.slug }, deps: { anteprima: "" } }, { schedaProdotto: { esito: "trovato", prodotto: PRODOTTO_CMS_FINTO } }, {}],
      ["slug solo CMS, modalità certa «codice»: notFound", { params: { slug: PRODOTTO_CMS_FINTO.slug }, deps: { anteprima: "" } }, { schedaProdotto: { esito: "trovato", prodotto: PRODOTTO_CMS_FINTO } }, { modalitaCerta: "codice" }],
      ["slug solo CMS, modalità certa «cms»: la scheda CMS", { params: { slug: PRODOTTO_CMS_FINTO.slug }, deps: { anteprima: "" } }, { schedaProdotto: { esito: "trovato", prodotto: PRODOTTO_CMS_FINTO } }, { modalitaCerta: "cms" }],
    ],
    head: [
      ["non trovato", { match: { status: "notFound" } }, {}, {}],
      ["scheda del codice", { loaderData: { scheda: { tipo: "codice" }, anteprima: false }, match: { status: "success" } }, {}, {}],
      ["scheda del codice con ?anteprima=", { loaderData: { scheda: { tipo: "codice" }, anteprima: true }, match: { status: "success" } }, {}, {}],
      ["senza dati", { match: { status: "pending" } }, {}, {}],
    ],
    headers: [
      ["scheda del codice", { loaderData: { scheda: { tipo: "codice" }, anteprima: false }, match: { status: "success" } }, {}, {}],
      ["scheda del codice con ?anteprima=", { loaderData: { scheda: { tipo: "codice" }, anteprima: true }, match: { status: "success" } }, {}, {}],
      ["guasto del loader", { match: { status: "error" } }, {}, {}],
      ["senza dati", { match: { status: "pending" } }, {}, {}],
    ],
  },
  "shop.carrello": {
    file: R("shop.carrello"),
    stato: { loaderData: { modo: "codice" }, rivalida: D.rivalidaFinta() },
    beforeLoad: [come()],
    loader: [
      ["codice", undefined, {}, {}],
      ["la modalità non si legge (rete)", undefined, { modalitaCatalogo: RETE }, {}],
    ],
    head: [come()],
    headers: [come()],
  },
  "shop.checkout": {
    file: R("shop.checkout"),
    stato: { loaderData: { modo: "codice", cassa: "vecchia" } },
    beforeLoad: [come()],
    validateSearch: [
      ["senza ricerca", {}, {}, {}],
      ["annullato=\"1\" (testo)", { annullato: "1" }, {}, {}],
      ["annullato=1 (numero)", { annullato: 1 }, {}, {}],
      ["annullato=\"0\"", { annullato: "0" }, {}, {}],
      ["annullato=0 (numero)", { annullato: 0 }, {}, {}],
      ["annullato=true", { annullato: true }, {}, {}],
      ["annullato=2", { annullato: 2 }, {}, {}],
      ["annullato vuoto", { annullato: "" }, {}, {}],
      ["altre chiavi: scartate", { annullato: "1", altro: 1 }, {}, {}],
    ],
    loader: [
      ["codice: cassa di oggi, senza chiedere la cassa nuova", undefined, {}, {}],
      ["la modalità non si legge (rete)", undefined, { modalitaCatalogo: RETE }, {}],
    ],
    head: [come()],
    headers: [come()],
  },
  "shop.ordine.$ref": {
    file: R("shop.ordine.$ref"),
    //  qui contano `head` e `headers`: la pagina dell'ordine (che importa le funzioni del server vere) è un finto vuoto
    stato: { params: { ref: "ordine-di-prova" }, finti: { "@/shop/cassa/PaginaOrdine": "export const PaginaOrdine = () => null;" } },
    beforeLoad: [come()],
    loader: [come()],
    head: [come()],
    headers: [come()],
  },
  "shop.collaudo": {
    file: R("shop.collaudo"),
    beforeLoad: [come()],
    loader: [come()],
    head: [come()],
    headers: [come()],
  },
};
const FUNZIONI = ["beforeLoad", "validateSearch", "loaderDeps", "loader", "head", "headers"];

/** Chiama `route[funzione]` con gli argomenti dello scenario; restituisce `{ valore | lancia, chiamate, argomenti }` (ogni chiamata al server registrata dall'aiuto). */
async function esegui(pagina, route, funzione, arg, server, extra) {
  Object.assign(pagina, { server, collaudo: undefined, modalita: undefined, modalitaCerta: undefined, ...extra });
  pagina.chiamate.length = 0;
  pagina.chiamateArgs.length = 0;
  //  `validateSearch` riceve la ricerca grezza così com'è; le altre un oggetto con i loro campi
  const argomenti = funzione === "validateSearch" ? (arg ?? {}) : { ...ARG_PREDEFINITO[funzione], ...(arg ?? {}) };
  const esito = {};
  try {
    const v = typeof route[funzione] === "function" ? await route[funzione](argomenti) : undefined;
    esito.valore = norma(v);
  } catch (e) {
    esito.lancia = String(e?.message ?? e);
    if (e?.redirect) esito.redirect = norma(e.redirect);
  }
  esito.chiamate = [...pagina.chiamate];
  esito.argomenti = norma(pagina.chiamateArgs);
  return esito;
}

/** La fotografia del codice di adesso: `{ html, rotte }`. */
export async function fotografa(radice) {
  return conDataFissa(async () => {
    const html = {};
    for (const [nome, [file, stato]] of Object.entries(DISEGNI)) html[nome] = comprimiDataUrl((await rendi(radice, file, stato)).html);
    const rotte = {};
    for (const [nome, def] of Object.entries(ROTTE)) {
      const { route, pagina } = await rendi(radice, def.file, { server: {}, pathname: "/shop", context: CTX, ...def.stato });
      rotte[nome] = {};
      for (const f of FUNZIONI) {
        rotte[nome][f] = {};
        for (const [scenario, arg, server, extra] of def[f] ?? [come()]) rotte[nome][f][scenario] = await esegui(pagina, route, f, arg, server, extra);
      }
    }
    return { html, rotte };
  });
}

/** Dov'è il primo carattere diverso, con un po' di contorno: il solo modo di leggere un rosso su un HTML lungo. */
function dove(oro, ora) {
  let i = 0;
  while (i < oro.length && i < ora.length && oro[i] === ora[i]) i++;
  const pezzo = (s) => JSON.stringify(s.slice(Math.max(0, i - 40), i + 60));
  return `diverso al carattere ${i} (oro ${oro.length}, ora ${ora.length}): oro ${pezzo(oro)} · ora ${pezzo(ora)}`;
}

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T70b · L'ORO DEL `codice`: IL SITO DI OGGI NON CAMBIA (23/11/2026)");
  const oro = JSON.parse(readFileSync(FILE_ORO, "utf8"));
  const ora = await fotografa(radice);

  // ── (a) l'HTML ──
  c("HTML: gli stessi disegni nell'oro e nella prova (nessuno in più, nessuno in meno)", Object.keys(oro.html), Object.keys(ora.html));
  for (const nome of Object.keys(oro.html)) {
    const uguale = oro.html[nome] === ora.html[nome];
    c(`HTML · ${nome}: identico all'oro, byte per byte`, "identico", uguale ? "identico" : dove(oro.html[nome] ?? "", ora.html[nome] ?? ""));
  }
  c("HTML: il piè di pagina porta l'anno della data ferma (la prova non dipende dall'orologio)", [true, true], [ora.html["guscio · carrello vuoto"].includes("© 2026 Hair Genius Labs SRLS"), ora.html["guscio · carrello vuoto"].includes("Spedizione gratuita sopra €59")]);

  // ── (b) (c) (d) head, headers, loader, beforeLoad e le chiamate al server ──
  c("rotte: le stesse nell'oro e nella prova", Object.keys(oro.rotte), Object.keys(ora.rotte));
  for (const [nome, funzioni] of Object.entries(oro.rotte)) {
    for (const f of FUNZIONI) {
      const scenariOro = Object.keys(funzioni[f] ?? {});
      c(`${nome} · ${f}: l'oro ha almeno uno scenario`, true, scenariOro.length > 0);
      c(`${nome} · ${f}: gli stessi scenari nell'oro e nella prova`, scenariOro, Object.keys(ora.rotte[nome]?.[f] ?? {}));
      for (const scenario of scenariOro) {
        const a = funzioni[f][scenario], b = ora.rotte[nome]?.[f]?.[scenario];
        // il valore (o l'errore) e, a parte, l'elenco delle chiamate al server: nome, ordine e argomenti, per uguaglianza
        c(`${nome} · ${f} · ${scenario}: valore`, canon({ valore: a.valore, lancia: a.lancia, redirect: a.redirect }), canon({ valore: b?.valore, lancia: b?.lancia, redirect: b?.redirect }));
        c(`${nome} · ${f} · ${scenario}: chiamate al server`, canon({ chiamate: a.chiamate, argomenti: a.argomenti }), canon({ chiamate: b?.chiamate, argomenti: b?.argomenti }));
      }
    }
  }

  // ── i 6 rossi noti dell'Agenzia (D106): l'elenco nominato che la porta d'unione usa al posto del numero ──
  const noti = JSON.parse(readFileSync(join(QUI, "_rossi-noti.json"), "utf8"));
  c("`_rossi-noti.json`: sei controlli, ognuno con gruppo e nome, tutti diversi", [6, true, 6], [noti.rossi.length, noti.rossi.every((r) => r.gruppo && r.nome), new Set(noti.rossi.map((r) => `${r.gruppo}|${r.nome}`)).size]);

  // ── l'oro è quello che dice di essere (non una fotografia vuota che passa sempre) ──
  const v = (nome, f, s) => oro.rotte[nome][f][s];
  c("oro: `beforeLoad` di `shop.tsx` chiama `modalitaCatalogo` e poi `collaudoDellaVisita` (oggi, non «zero chiamate»)", [["modalitaCatalogo", "collaudoDellaVisita"], { modalita: "codice" }], [v("shop", "beforeLoad", "codice, collaudo falso").chiamate, v("shop", "beforeLoad", "codice, collaudo falso").valore]);
  c("oro: la home con `codice` vale `null` e non chiama il server", [null, []], [v("shop.index", "loader", "codice").valore, v("shop.index", "loader", "codice").chiamate]);
  c("oro: la scheda del codice vale `{ scheda: { tipo: \"codice\" }, anteprima }` e chiede solo `modalitaCatalogo`", [{ scheda: { tipo: "codice" }, anteprima: false }, ["modalitaCatalogo"]], [v("shop.prodotto.$slug", "loader", "patch del codice").valore, v("shop.prodotto.$slug", "loader", "patch del codice").chiamate]);
  c("oro: lo slug che il codice non conosce chiede `modalitaCatalogo` e `schedaProdotto`; se il server lo ha, anche `modalitaCertaDelServer`", [["modalitaCatalogo", "schedaProdotto"], ["modalitaCatalogo", "schedaProdotto", "modalitaCertaDelServer"]], [
    v("shop.prodotto.$slug", "loader", "slug sconosciuto, il server non lo ha: notFound").chiamate, v("shop.prodotto.$slug", "loader", "slug solo CMS, modalità certa «incerto»: errore temporaneo").chiamate,
  ]);
  c("oro: il carrello chiede solo `modalitaCatalogo` e vale `{ modo: \"codice\" }`; la categoria è `notFound` senza chiamate", [["modalitaCatalogo"], { modo: "codice" }, "notFound", []], [
    v("shop.carrello", "loader", "codice").chiamate, v("shop.carrello", "loader", "codice").valore, v("shop.c.$slug", "loader", "codice: notFound").lancia, v("shop.c.$slug", "loader", "codice: notFound").chiamate,
  ]);
  c("oro: con il collaudo vero `headers` di `shop.tsx` dichiara `private, no-store`; senza, niente", [{ "Cache-Control": "private, no-store" }, {}], [v("shop", "headers", "collaudo vero").valore, v("shop", "headers", "collaudo falso").valore]);
  c("oro: l'HTML è vero (nessun disegno vuoto: guscio, home, schede e carrelli hanno il loro testo)", [true, true, true, true, true, true], [
    oro.html["guscio · carrello con 2 righe"].includes("Hair Genius"), oro.html["home"].includes("Toupee"), oro.html["scheda patch"].includes("Lace Front Swiss + PU"), oro.html["scheda cura"].includes("Shampoo Delicato Lace-Safe"),
    oro.html["carrello vuoto"].includes("Il carrello è vuoto"), oro.html["carrello con 2 righe"].includes("Carrello"),
  ]);
}

/** Riscrive l'oro dal base pulito (vedi sopra). */
async function scrivi() {
  const radice = join(QUI, "..", "..");
  //  `src/` e `prove/negozio/` (l'oro è fatto dalle rotte e dagli aiuti di prova), meno il file dell'oro stesso
  const sporco = execFileSync("git", ["status", "--porcelain", "--", "src", "prove/negozio"], { cwd: radice, encoding: "utf8" })
    .split("\n").filter((r) => r.trim() && !r.trimEnd().endsWith("prove/negozio/_oro-codice-v1.json")).join("\n");
  if (sporco) throw new Error(`l'oro si prende dal base pulito: src/ o prove/negozio/ hanno modifiche non salvate:\n${sporco}`);
  const commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: radice, encoding: "utf8" }).trim();
  const foto = await fotografa(radice);
  writeFileSync(FILE_ORO, JSON.stringify({ _nota: "Fotografia del sito `codice` di oggi (T70b). NON si modifica a mano e non si rifà per far tornare verde la prova: vedi la testa di codice-identico-v1.mjs.", commit, ...foto }, null, 1) + "\n");
  console.log(`oro scritto: ${FILE_ORO} (commit ${commit}, ${Object.keys(foto.html).length} disegni, ${Object.keys(foto.rotte).length} rotte)`);
}

/** Da sola: lancia la prova e esce con 1 se c'è un rosso (nessuno si accorge di un rosso se la prova non si può lanciare da sola). */
async function verifica() {
  let fatti = 0, rotti = 0;
  const c = (nome, atteso, letto) => {
    fatti++;
    const bene = canon(atteso) === canon(letto);
    if (!bene) rotti++;
    console.log((bene ? "  ok  " : "  NO  ") + nome + (bene ? "" : ` · atteso ${canon(atteso).slice(0, 300)}, letto ${canon(letto).slice(0, 600)}`));
  };
  await prove({}, { c, gruppo: (t) => console.log(`\n── ${t}`), radice: join(QUI, "..", "..") });
  console.log(`\n${rotti ? "✖" : "✔"} ${rotti} rossi su ${fatti} controlli`);
  process.exitCode = rotti ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await (process.argv.includes("--scrivi") ? scrivi() : verifica());
