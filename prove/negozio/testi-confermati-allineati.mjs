/** ── NEGOZIO · V1 · T80 · I TESTI CONFERMATI ALLINEATI (D63, D77) ───────────────────────────────────────────
 *  Un solo punto di rinomina: `CHIAVI_TESTI` (`src/shop/cms/testi-confermati.ts`). Si prova che:
 *   (a) i campi `shop.conf.*` della sezione «Shop» di `LANDING_SCHEMA` sono ESATTAMENTE `CHIAVI_TESTI`, nello stesso ordine;
 *   (b) un valore vuoto o con `{{` dà `null`, dall'editor fino alla pagina;
 *   (c) una chiave inventata (o mancante, o fuori posto) nello schema o in `CHIAVI_TESTI` fa rosso (si prova il confronto stesso);
 *   (d) la pagina ordine con un testo confermato dal titolare mostra «Serve aiuto?»: la catena VERA, dalla riga di `landing_content`
 *       attraverso `ordinePubblico` (la funzione del server) fino al disegno di `PaginaOrdine`, con un finto database;
 *   (e) ogni chiave `shop.*` dello schema ha un valore di partenza senza segnaposto aperti, tranne i `shop.conf.*`, le trascrizioni, la liberatoria
 *       e gli slot media, che partono vuoti PER SCELTA (un «sì» di partenza sbloccherebbe in silenzio i media con persone, D95);
 *   (f) ogni chiave `shop.*` letta da un file dello shop esiste nello schema;
 *   (g) `riempi` non scrive mai «undefined».
 *  Dati inventati, nessuna rete, nessuna chiave vera. */
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import { fintoDb } from "./_finto-db.mjs";
import { uuid } from "./dati.mjs";

const requireQui = createRequire(import.meta.url);
const SERVIZIO = "chiave-di-servizio-di-prova-non-vera";
const REF = "HG-7K3M9Q";
const ID = uuid(0xa001);
const ASSISTENZA = "TESTO-ASSISTENZA-DEL-TITOLARE scrivici e ti rispondiamo";
const piatto = (h) => h.replace(/<[^>]+>/g, " ").replace(/ /g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ");

/** Le differenze fra le chiavi dei campi `shop.conf.*` dello schema e `CHIAVI_TESTI`: vuoto = allineati (stesse, stesso ordine, nessuna in più). */
export function differenze(campi, chiavi) {
  const attese = chiavi.map((k) => `shop.conf.${k}`);
  const fuori = [];
  for (const k of campi) if (!attese.includes(k)) fuori.push(`in più nello schema: ${k}`);
  for (const k of attese) if (!campi.includes(k)) fuori.push(`manca nello schema: ${k}`);
  if (!fuori.length && campi.some((k, i) => k !== attese[i])) fuori.push("ordine diverso");
  if (new Set(campi).size !== campi.length) fuori.push("chiave doppia");
  return fuori;
}

const FINTI = {
  "@tanstack/react-start": `
    export const createServerOnlyFn = (f) => f; // T107: catalogo.functions legge il cookie con createServerOnlyFn
    export const createServerFn = () => {
      let v = (d) => d;
      const b = { inputValidator(f) { v = f; return b; }, handler(h) { return async (arg) => h({ data: v(arg && arg.data) }); } };
      return b;
    };`,
  "@tanstack/react-start/server": `
    const S = () => globalThis.__t80b;
    export const setResponseHeader = (k, v) => { S().intestazioni.push([k, v]); };
    export const getRequestUrl = () => new URL("https://prova.test/_serverFn/x");
    export const getRequestHeader = (k) => (k === "cf-connecting-ip" ? "203.0.113.7" : undefined);`,
  "@/integrations/supabase/client.server": `export const supabaseAdmin = new Proxy({}, { get: (_, p) => globalThis.__t80b.db[p] });`,
  // il client del browser nasce con le variabili d'ambiente: qui non serve (si legge solo lo schema)
  "@/integrations/supabase/client": `export const supabase = {};`,
};
const plugin = {
  name: "finti",
  setup(b) {
    b.onResolve({ filter: /.*/ }, (a) => (FINTI[a.path] ? { path: a.path, namespace: "finto" } : null));
    b.onLoad({ filter: /.*/, namespace: "finto" }, (a) => ({ contents: FINTI[a.path], loader: "js" }));
  },
};
const impacchetta = (radice, contents, extra = {}) =>
  build({ stdin: { contents, resolveDir: radice, loader: "ts" }, bundle: true, write: false, alias: { "@": join(radice, "src") }, logLevel: "silent", plugins: [plugin], ...extra });

let giro = 0;
const importa = (testo) => import(`data:text/javascript;base64,${Buffer.from(testo + `\n//${++giro}`).toString("base64")}`);

/** Le funzioni vere del server dell'ordine, con la porta dei testi; ogni modulo è nuovo (memoria e limiti vuoti). */
async function caricaCatena(radice) {
  const src = join(radice, "src");
  const r = await impacchetta(
    radice,
    `export { ordinePubblico } from ${JSON.stringify(join(src, "shop/cassa/ordine-pubblico.functions.ts"))};
     export { chiaveOrdine, impronta } from ${JSON.stringify(join(src, "shop/cassa/chiave-ordine.ts"))};`,
    { format: "esm", platform: "node" },
  );
  return () => importa(r.outputFiles[0].text);
}

/** La pagina ordine vera (`VistaOrdine`), disegnata con react-dom/server, con i finti di ordine-pagina.mjs. */
async function caricaPagina(radice) {
  const FINTI_PAGINA = {
    "@tanstack/react-router": `import React from "react"; export const Link = ({ to, children, className }) => React.createElement("a", { href: String(to), className }, children);`,
    "@/shop/CartContext": `export const useCart = () => ({ clear: () => {} });`,
    "@/lib/tracciamento/api": `export const emettiSoloContatore = () => {};`,
    "@/shop/cassa/ordine-pubblico.functions": `export const ordinePubblico = async () => ({ ok: false });`,
  };
  const dir = mkdtempSync(join(tmpdir(), "prova-t80-"));
  try {
    const entrata = join(dir, "entrata.tsx");
    writeFileSync(
      entrata,
      `import React from "react";
       import { renderToStaticMarkup } from "react-dom/server";
       export * from ${JSON.stringify(join(radice, "src/shop/cassa/PaginaOrdine.tsx"))};
       export { React };
       export const rendi = (el) => renderToStaticMarkup(el);`,
    );
    const r = await build({
      entryPoints: [entrata],
      bundle: true,
      write: false,
      platform: "node",
      format: "cjs",
      jsx: "automatic",
      loader: { ".tsx": "tsx", ".png": "dataurl", ".svg": "dataurl" },
      alias: { "@": join(radice, "src") },
      absWorkingDir: radice,
      nodePaths: [join(radice, "node_modules")],
      logLevel: "silent",
      plugins: [
        {
          name: "finti-pagina",
          setup(b) {
            b.onResolve({ filter: /.*/ }, (a) => (FINTI_PAGINA[a.path] ? { path: a.path, namespace: "finto" } : null));
            b.onLoad({ filter: /.*/, namespace: "finto" }, (a) => ({ contents: FINTI_PAGINA[a.path], loader: "tsx", resolveDir: radice }));
          },
        },
      ],
    });
    const file = join(dir, "pagina.cjs");
    writeFileSync(file, r.outputFiles[0].text);
    return requireQui(file);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Un client finto che serve la tabella degli ordini (il finto di R2) e `landing_content` (quello che decide la prova). */
function dbMisto(ordini, contenuto) {
  const base = fintoDb({ tabelle: { shop_orders: ordini, shop_order_eventi: [] } });
  const landing = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () =>
            contenuto.errore
              ? { data: null, error: { code: "XX000" } }
              : { data: contenuto.riga === undefined ? null : { data: contenuto.riga }, error: null },
        }),
      }),
    }),
  };
  return new Proxy(base, { get: (b, p) => (p === "from" ? (t) => (t === "landing_content" ? landing.from() : b.from(t)) : b[p]) });
}

/** I file `.ts`/`.tsx` sotto una cartella. */
function file(radice, d) {
  const fuori = [];
  const giu = (p) => {
    for (const e of readdirSync(join(radice, p), { withFileTypes: true })) {
      if (e.isDirectory()) giu(`${p}/${e.name}`);
      else if (/\.tsx?$/.test(e.name)) fuori.push(`${p}/${e.name}`);
    }
  };
  try {
    giu(d);
  } catch {
    /* cartella assente: nessun file */
  }
  return fuori;
}

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO · V1 · T80 · I TESTI CONFERMATI ALLINEATI (23/11/2026)");
  const leggiTesto = (p) => readFileSync(join(radice, p), "utf8");

  /* ── lo schema vero ─────────────────────────────────────────────────────── */
  let L;
  let TS;
  let CF;
  let V;
  try {
    const src = join(radice, "src");
    const r = await impacchetta(
      radice,
      `export { LANDING_SCHEMA, DEFAULT_TEXTS, DEFAULT_MEDIA } from ${JSON.stringify(join(src, "landing/landing-content.ts"))};
       export { CAMPI_TESTO_SHOP, SLOT_SHOP, ALT_SHOP, CAMPI_CONFERMATI, riempi } from ${JSON.stringify(join(src, "landing/testi-shop.ts"))};
       export { CHIAVI_TESTI, filtraConfermati } from ${JSON.stringify(join(src, "shop/cms/testi-confermati.ts"))};
       export { confermatiDa, testiDi } from ${JSON.stringify(join(src, "shop/cms/vetrina-contenuto.ts"))};`,
      { format: "esm", platform: "node", define: { "import.meta.env": "{}" } },
    );
    const M = await importa(r.outputFiles[0].text);
    L = M;
    TS = M;
    CF = M;
    V = M;
  } catch (e) {
    return c("lo schema della landing e i testi dello shop si impacchettano", true, `no: ${String(e.message).split("\n")[0]}`);
  }

  const sezioni = L.LANDING_SCHEMA;
  const shop = sezioni.find((s) => s.id === "shop");
  c("LANDING_SCHEMA ha la sezione «shop» «Shop (/shop)», ultima, e le altre sezioni sono quelle di prima", [true, "Shop (/shop)", ["hero", "s02", "s03", "s04", "s05", "banner", "faq", "s08", "slogan", "invisible-derm", "shop"]], [!!shop && sezioni[sezioni.length - 1] === shop, shop?.title, sezioni.map((s) => s.id)]);
  if (!shop) return;
  const chiavi = shop.fields.map((f) => f.key);
  const conf = chiavi.filter((k) => k.startsWith("shop.conf."));

  /* ── (a) i campi confermati sono CHIAVI_TESTI ───────────────────────────── */
  c("(a) i campi `shop.conf.*` dello schema sono ESATTAMENTE `CHIAVI_TESTI`, nello stesso ordine", [], differenze(conf, CF.CHIAVI_TESTI));
  c("(a) …e `CAMPI_CONFERMATI` di testi-shop.ts è la stessa lista", [...conf], TS.CAMPI_CONFERMATI);
  c("(a) …i campi confermati stanno nell'editor come testi di una riga, e partono VUOTI", [true, true], [
    shop.fields.filter((f) => f.key.startsWith("shop.conf.")).every((f) => f.type === "text"),
    shop.fields.filter((f) => f.key.startsWith("shop.conf.")).every((f) => f.default === ""),
  ]);

  /* ── (c) il confronto sente le differenze ────────────────────────────────── */
  const CH = [...CF.CHIAVI_TESTI];
  const bene = CH.map((k) => `shop.conf.${k}`);
  c("(c) una chiave INVENTATA nello schema fa rosso", true, differenze([...bene, "shop.conf.inventata"], CH).length > 0);
  c("(c) una chiave inventata in CHIAVI_TESTI (manca nello schema) fa rosso", true, differenze(bene, [...CH, "inventata"]).length > 0);
  c("(c) una chiave tolta dallo schema fa rosso", true, differenze(bene.slice(1), CH).length > 0);
  c("(c) una chiave rinominata (nello schema o in CHIAVI_TESTI) fa rosso", [true, true], [differenze(["shop.conf.resi", ...bene.slice(1)], CH).length > 0, differenze(bene, ["resi", ...CH.slice(1)]).length > 0]);
  c("(c) l'ordine scambiato fa rosso; una chiave doppia fa rosso", [true, true], [differenze([bene[1], bene[0], ...bene.slice(2)], CH).length > 0, differenze([...bene, bene[0]], CH).length > 0]);
  c("(c) lo schema vero e CHIAVI_TESTI, invece, non hanno nessuna differenza", [], differenze(conf, CH));

  /* ── (b) vuoto o `{{` = null, dall'editor alla pagina ────────────────────── */
  const riga = (extra) => ({ texts: Object.fromEntries(Object.entries(extra).map(([k, v]) => [`shop.conf.${k}`, v])) });
  const contenutoDa = (extra) => ({ testi: riga(extra).texts, media: {} });
  const nulli = Object.fromEntries(CH.map((k) => [k, null]));
  c("(b) niente di scritto (partenza vuota) → tutti `null`", nulli, V.confermatiDa({ testi: {}, media: {} }));
  c("(b) tutti i campi vuoti o solo spazi → tutti `null`", nulli, V.confermatiDa(contenutoDa(Object.fromEntries(CH.map((k) => [k, "   "])))));
  c("(b) con `{{…}}` (anche in mezzo al testo) → `null`", nulli, V.confermatiDa(contenutoDa(Object.fromEntries(CH.map((k) => [k, `Scrivi a {{indirizzo da decidere}} ${k}`])))));
  c("(b) un testo vero passa tale e quale, le altre chiavi restano `null`", { ...nulli, assistenza: ASSISTENZA, reso: "Reso entro quattordici giorni" }, V.confermatiDa(contenutoDa({ assistenza: ASSISTENZA, reso: "Reso entro quattordici giorni" })));
  c("(b) una chiave inventata nel contenuto non entra nei testi confermati", Object.keys(nulli), Object.keys(V.confermatiDa(contenutoDa({ inventata: "NO", assistenza: "sì" }))));
  c("(b) la porta passa per `filtraConfermati`: stessa risposta, per ogni chiave", true, CH.every((k) => JSON.stringify(V.confermatiDa(contenutoDa({ [k]: "Un testo vero" }))) === JSON.stringify(CF.filtraConfermati({ [k]: "Un testo vero" }))));

  /* ── (d) la catena vera: riga → funzione del server → pagina ─────────────── */
  const carica = await caricaCatena(radice);
  const P = await caricaPagina(radice);
  const h = P.React.createElement;
  const vecchioServizio = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SERVIZIO;
  const avvisiVeri = console.warn; // il guasto simulato scrive un codice nel log: qui non serve vederlo
  console.warn = () => {};
  try {
    const riga0 = async (chiaveOrdine, impronta) => {
      const k = await chiaveOrdine(SERVIZIO, ID);
      return {
        t: k,
        ordine: {
          id: ID, order_ref: REF, created_at: "2026-11-20T10:00:00.000Z",
          nome: "Nome Inventato", cognome: "Cognome Inventato", email: "persona.inventata@example.test", telefono: "+39 333 0000000",
          indirizzo: "Via Inventata 1", citta: "Roma", cap: "00184", provincia: "RM", nazione: "IT", note: null,
          cf: null, lead_id: null, senza_lead: false,
          items: [{ product_id: "sku-di-prova", name: "Patch di prova", slug: "patch-di-prova", qty: 1, unit_price: 25, variant: "Colore 1B" }],
          subtotal: 25, shipping: 5, total: 30, totale_cent: 3000, rimborsato_cent: 0,
          status: "nuovo", stato_pagamento: "pagato", pagato_il: "2026-11-20T10:05:00.000Z", pagato_importo: 30, metodo_pagamento: "stripe",
          stripe_sessione_id: null, stripe_pagamento_id: null, prova: false,
          scade_il: null, canale: "sito", chiave_pubblica_hash: null, // l'impronta si mette sotto
          tracking: null, tracking_url: null, corriere: null, spedito_il: null, senza_tracking: null,
        },
        hash: await impronta(k),
      };
    };
    /** Una richiesta vera: ordinePubblico() con il contenuto deciso dalla prova; ritorna risposta, intestazioni e pagina disegnata. */
    const giroPagina = async (contenuto) => {
      const M = await carica();
      const { t, ordine, hash } = await riga0(M.chiaveOrdine, M.impronta);
      globalThis.__t80b = { intestazioni: [], db: dbMisto([{ ...ordine, chiave_pubblica_hash: hash }], contenuto) };
      const risposta = await M.ordinePubblico({ data: { ref: REF, t } });
      const intestazioni = globalThis.__t80b.intestazioni;
      const stato = risposta.ok
        ? { tipo: "ordine", ordine: risposta.ordine, testi: risposta.testi, finestraFinita: false }
        : { tipo: "assente" };
      const html = piatto(P.rendi(h(P.VistaOrdine, { stato, riprova: { tipo: "fermo" }, suRiprova: () => {}, suAggiorna: () => {}, inLettura: false })));
      return { risposta, intestazioni, html };
    };

    const con = await giroPagina({ riga: riga({ assistenza: ASSISTENZA }) });
    c("(d) catena vera: la riga con `shop.conf.assistenza` → l'ordine è letto (`ok`) e il testo è nella risposta", [true, ASSISTENZA], [con.risposta.ok, con.risposta.testi?.assistenza]);
    c("(d) …la pagina ordine mostra «Serve aiuto?» e il testo del titolare, tale e quale", [true, true], [con.html.includes("Serve aiuto?"), con.html.includes(ASSISTENZA)]);
    c("(d) …gli altri cinque testi restano `null`", { ...nulli, assistenza: ASSISTENZA }, con.risposta.testi);
    c("(d) …la risposta dell'ordine resta `private, no-store`: leggere il contenuto non mette nessun `public`", [true, true], [
      con.intestazioni.some(([k, v]) => k === "Cache-Control" && v === "private, no-store"),
      con.intestazioni.every(([k, v]) => k !== "Cache-Control" || v === "private, no-store"),
    ]);
    c("(d) …e il contenuto del sito non entra nella risposta dell'ordine (solo i sei testi)", [["assistenza", "assistenza_whatsapp", "firmatario", "garanzia", "pronta_consegna", "reso"], true], [Object.keys(con.risposta.testi).sort(), !JSON.stringify(con.risposta).includes("shop.conf")]);

    const senza = [
      ["testo vuoto", { riga: riga({ assistenza: "" }) }],
      ["solo spazi", { riga: riga({ assistenza: "   " }) }],
      ["testo con `{{`", { riga: riga({ assistenza: "{{da decidere}}" }) }],
      ["niente di salvato", { riga: { texts: {} } }],
      ["nessuna riga in landing_content", { riga: undefined }],
      ["chiave scritta senza il prefisso", { riga: { texts: { assistenza: ASSISTENZA } } }],
      ["guasto del database dei contenuti", { errore: true }],
    ];
    for (const [nome, contenuto] of senza) {
      const x = await giroPagina(contenuto);
      c(`(b)(d) ${nome}: l'ordine si legge lo stesso, ma nessun «Serve aiuto?»`, [true, false, null], [x.risposta.ok, x.html.includes("Serve aiuto?") || x.html.includes(ASSISTENZA), x.risposta.testi?.assistenza]);
    }
  } finally {
    console.warn = avvisiVeri;
    if (vecchioServizio === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = vecchioServizio;
    delete globalThis.__t80b;
  }

  /* ── (e) i valori di partenza ─────────────────────────────────────────────── */
  const VUOTI_PER_SCELTA = ["shop.clienti.liberatoria", "shop.coloriTrascrizione", "shop.curaTrascrizione"];
  c("(e) ogni chiave dello schema `shop` comincia per «shop.», nessuna è doppia, nessuna sta in un'altra sezione", [true, true, []], [
    chiavi.every((k) => k.startsWith("shop.")),
    new Set(chiavi).size === chiavi.length,
    sezioni.filter((s) => s !== shop).flatMap((s) => s.fields.map((f) => f.key)).filter((k) => k.startsWith("shop.")),
  ]);
  c("(e) i campi della sezione sono tutti e soli quelli di testi-shop.ts (slot, descrizioni, testi, confermati)", [...TS.SLOT_SHOP.map((s) => s.chiave), ...Object.keys(TS.ALT_SHOP), ...TS.CAMPI_TESTO_SHOP.map((x) => x.chiave)].sort(), [...chiavi].sort());
  const aperti = shop.fields.filter((f) => /\{\{|da confermare/i.test(f.default) || /\{\{/.test(f.label));
  c("(e) nessun valore di partenza (né etichetta) con `{{` o «da confermare»", [], aperti.map((f) => f.key));
  const pieni = shop.fields.filter((f) => f.type !== "image" && f.type !== "video" && !f.key.startsWith("shop.conf.") && !VUOTI_PER_SCELTA.includes(f.key) && f.default.trim() === "");
  c("(e) ogni testo ha un valore di partenza vero, tranne i confermati, le trascrizioni e la liberatoria", [], pieni.map((f) => f.key));
  c("(e) i campi di servizio partono VUOTI (default `\"\"`): liberatoria e trascrizioni (un «sì» di partenza sbloccherebbe i media con persone)", [true, true, true], VUOTI_PER_SCELTA.map((k) => shop.fields.find((f) => f.key === k)?.default === ""));
  c("(e) gli slot media partono vuoti e sono immagini o video", [true, true], [
    shop.fields.filter((f) => f.type === "image" || f.type === "video").every((f) => f.default === ""),
    TS.SLOT_SHOP.every((s) => ["image", "video"].includes(shop.fields.find((f) => f.key === s.chiave)?.type)),
  ]);
  c("(e) le liste di partenza della landing (DEFAULT_TEXTS/MEDIA) contengono le chiavi `shop.*` dei due tipi giusti", [true, true], [
    shop.fields.filter((f) => f.type === "text" || f.type === "textarea").every((f) => f.key in L.DEFAULT_TEXTS),
    shop.fields.filter((f) => f.type === "image" || f.type === "video").every((f) => f.key in L.DEFAULT_MEDIA),
  ]);
  c("(e) i testi di partenza che la vetrina legge (`testiDi`) sono quelli dello schema, uno per uno", [], (() => {
    const t = V.testiDi({ testi: {}, media: {} });
    return shop.fields.filter((f) => (f.type === "text" || f.type === "textarea") && !f.key.startsWith("shop.conf.") && t[f.key] !== (f.default.trim() === "" ? null : f.default.trim())).map((f) => f.key);
  })());

  /* ── (f) ogni chiave letta da un file dello shop esiste nello schema ─────── */
  const lette = [];
  for (const d of ["src/components/shop", "src/shop", "src/routes"]) {
    for (const f of file(radice, d)) {
      const t = leggiTesto(f).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
      for (const m of t.matchAll(/["'`](shop\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*)["'`]/g)) lette.push(`${f}: ${m[1]}`);
    }
  }
  c("(f) ogni chiave `shop.*` scritta in un file dello shop (pagine, componenti, rotte) esiste nello schema", [], lette.filter((x) => !chiavi.includes(x.split(": ")[1])));

  /* ── (g) riempi non scrive mai «undefined» ───────────────────────────────── */
  c("(g) riempi: un valore `undefined` lascia il segnaposto com'è (mai «undefined»)", ["Ciao {nome}", "Ciao {nome}"], [TS.riempi("Ciao {nome}", { nome: undefined }), TS.riempi("Ciao {nome}", { altro: "x" })]);
  c("(g) riempi: `null` idem; un numero (anche 0) e un testo vuoto si scrivono", ["Ciao {nome}", "0 prodotti", "Ciao "], [TS.riempi("Ciao {nome}", { nome: null }), TS.riempi("{n} prodotti", { n: 0 }), TS.riempi("Ciao {nome}", { nome: "" })]);
  c("(g) riempi: nessun segnaposto reinterpretato (`$&`, `{nome}` dentro il valore)", ["Ciao $& {altro}", "Ciao {altro}"], [TS.riempi("Ciao {nome}", { nome: "$& {altro}", altro: "NO" }), TS.riempi("Ciao {nome}", { nome: "{altro}", altro: "NO" })]);

  /* ── i commenti di testi-shop.ts non contengono le parole che una ricerca nel codice cerca (SPEC 12.4.1 n. 11) ── */
  const sorgenteTesti = leggiTesto("src/landing/testi-shop.ts");
  c("testi-shop.ts: nessun `{{` e nessun «da confermare» nemmeno nei commenti (una ricerca nel codice non deve trovarli)", [false, false], [/\{\{/.test(sorgenteTesti), /da confermare/i.test(sorgenteTesti)]);
  const fnOrdine = leggiTesto("src/shop/cassa/ordine-pubblico.functions.ts").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c("la porta `testiConfermati` dell'ordine non è più `{}`: legge il contenuto dello shop e passa da `confermatiDa`", [true, true, false], [/confermatiDa\(/.test(fnOrdine), /contenutoDelServer\(/.test(fnOrdine), /testiConfermati\s*:\s*async\s*\(\)\s*=>\s*\(\{\}\)/.test(fnOrdine)]);
  c("…e NON chiama la funzione `contenutoShop` (metterebbe un `public` sulla risposta dell'ordine)", false, /\bcontenutoShop\b/.test(fnOrdine));
}
