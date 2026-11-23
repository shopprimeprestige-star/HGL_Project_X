/** ── NEGOZIO · V1 · T80 · IL CONTENUTO DELLO SHOP DAL SERVER (D76, D77) ─────────────────────────────────────
 *  `src/shop/cms/vetrina-contenuto.ts` (regole pure + lettore con memoria) e `src/shop/cms/contenuto-shop.functions.ts`
 *  (l'involucro `contenutoShop`, ESEGUITO qui con dei finti al posto di `createServerFn`, delle intestazioni e del client del server).
 *  Cosa deve valere:
 *   · escono SOLO le chiavi `shop.*` (provato con una riga che contiene anche chiavi della landing, recensioni e un'altra chiave);
 *   · un guasto del database (errore, eccezione, client assente) = `{testi:{}, media:{}}` e `no-store`, mai un errore al pubblico, e il guasto non si tiene in memoria;
 *   · memoria di 30 s; con il cookie del collaudo valido `private, no-store` e nessuna memoria;
 *   · un testo svuotato o con `{{` non si disegna (`null`); uno slot vuoto, storto o senza liberatoria non si disegna.
 *  Il client Supabase è finto, i dati sono inventati: nessuna rete, nessuna chiave vera. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";

const SEGRETO = "segreto-di-prova-non-vero-0123456789";
const T0 = Date.parse("2026-11-23T10:00:00.000Z");

/** I finti: la funzione del server si chiama come una funzione; le intestazioni si registrano; il database lo decide la prova. */
const FINTI = {
  "@tanstack/react-start": `
    export const createServerFn = () => {
      let v = (d) => d;
      const b = { inputValidator(f) { v = f; return b; }, handler(h) { return async (arg) => h({ data: v(arg && arg.data) }); } };
      return b;
    };`,
  "@tanstack/react-start/server": `
    const S = () => globalThis.__t80;
    export const setResponseHeader = (k, v) => { S().intestazioni.push([k, v]); };
    export const getRequestUrl = () => { if (S().percorso == null) throw new Error("fuori da una richiesta"); return new URL("https://prova.test" + S().percorso); };
    export const getRequestHeader = (k) => (k === "cookie" ? S().cookie : undefined);`,
  "@/integrations/supabase/client.server": `export const supabaseAdmin = new Proxy({}, { get: (_, p) => { const d = globalThis.__t80.db; if (!d) throw new Error("client assente"); return d[p]; } });`,
};

let giro = 0;
/** Impacchetta le funzioni vere (e le regole pure) con i finti e le importa: ogni chiamata dà un modulo NUOVO (memoria vuota). */
async function carica(radice) {
  const src = join(radice, "src");
  const r = await build({
    stdin: {
      contents: `export * from ${JSON.stringify(join(src, "shop/cms/contenuto-shop.functions.ts"))};
                 export * from ${JSON.stringify(join(src, "shop/cms/vetrina-contenuto.ts"))};
                 export { emettiCookieCollaudo, NOME_COOKIE } from ${JSON.stringify(join(src, "shop/cms/collaudo.ts"))};
                 export { TESTI_SHOP, SLOT_SHOP, ALT_SHOP, CAMPI_TESTO_SHOP } from ${JSON.stringify(join(src, "landing/testi-shop.ts"))};
                 export { CHIAVI_TESTI } from ${JSON.stringify(join(src, "shop/cms/testi-confermati.ts"))};`,
      resolveDir: radice,
      loader: "ts",
    },
    bundle: true,
    write: false,
    format: "esm",
    platform: "node",
    alias: { "@": src },
    logLevel: "silent",
    plugins: [
      {
        name: "finti",
        setup(b) {
          b.onResolve({ filter: /.*/ }, (a) => (FINTI[a.path] ? { path: a.path, namespace: "finto" } : null));
          b.onLoad({ filter: /.*/, namespace: "finto" }, (a) => ({ contents: FINTI[a.path], loader: "js" }));
        },
      },
    ],
  });
  return () => import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text + `\n//${++giro}`).toString("base64")}`);
}

/** Un client finto di `landing_content`: registra a chi si chiede cosa. `riga` = il valore di `data`; `undefined` = nessuna riga. */
const dbFinto = ({ riga, errore = false, lancia = false } = {}) => {
  const chiamate = [];
  return {
    chiamate,
    from(t) {
      chiamate.push(`from:${t}`);
      if (lancia) throw new Error("rete assente: dettaglio che non deve uscire");
      return {
        select(cols) {
          chiamate.push(`select:${cols}`);
          return {
            eq(k, v) {
              chiamate.push(`eq:${k}=${v}`);
              return {
                maybeSingle: async () => {
                  chiamate.push("maybeSingle");
                  return errore
                    ? { data: null, error: { code: "XX000", message: "dettaglio che non deve uscire" } }
                    : { data: riga === undefined ? null : { data: riga }, error: null };
                },
              };
            },
          };
        },
      };
    },
  };
};

/** La riga `landing_content/default` com'è davvero: chiavi della landing, recensioni, un'altra chiave, e le nostre `shop.*`. */
const RIGA_MISTA = {
  texts: {
    "hero.h1": "TITOLO-DELLA-LANDING",
    "id.confronto.liberatoria": "sì",
    "shop.hero.h1": "Titolo [a]nuovo[/a]",
    "shop.vetrina.titolo": "",
    "shop.err404.testo": "Testo con {{da decidere}}",
    "shop.conf.assistenza": "Scrivici qui",
    "shop.numero": 5,
    shop: "senza punto",
    "xshop.hero.h1": "prefisso storto",
    "Shop.hero.h1": "maiuscola",
    "segreto.token": "TOKEN-DI-PROVA",
  },
  media: {
    "hero.foto": "https://prova.test/landing.jpg",
    "id.titolareFoto": "https://prova.test/id.jpg",
    "shop.heroFoto": "https://prova.test/hero.jpg",
    "shop.altro": 42,
  },
  reviewsBadge: "BADGE-DELLA-LANDING",
  reviews: [{ id: "r1", name: "NOME-DI-UN-CLIENTE", text: "RECENSIONE" }],
  altraChiave: "ALTRO-DI-PROVA",
};

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO · V1 · T80 · IL CONTENUTO DELLO SHOP DAL SERVER (23/11/2026)");
  const leggiTesto = (p) => readFileSync(join(radice, p), "utf8");
  const nudo = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

  let nuovo;
  try {
    nuovo = await carica(radice);
  } catch (e) {
    return c("vetrina-contenuto.ts e contenuto-shop.functions.ts si impacchettano", true, `no: ${String(e.message).split("\n")[0]}`);
  }
  const M0 = await nuovo();
  const ATTESI = ["contenutoShop", "contenutoDelServer", "soloShop", "contenutoDaRiga", "testiDi", "mediaDi", "slotUsabile", "confermatiDa", "creaLettoreContenuto", "contenutoVuoto"];
  c("esporta quello che il piano promette (D76, T80)", [], ATTESI.filter((n) => M0[n] === undefined));
  if (ATTESI.some((n) => M0[n] === undefined)) return;

  /** Una chiamata di `contenutoShop()` come la fa il server: percorso, cookie e database decisi dalla prova; ritorna `{risposta, cache, chiamate}`. */
  const chiama = async (M, { db, percorso = "/_serverFn/contenuto", cookie, vuotoSenzaDb = false } = {}) => {
    globalThis.__t80 = { intestazioni: [], percorso, cookie, db: vuotoSenzaDb ? null : db };
    const risposta = await M.contenutoShop();
    const cache = globalThis.__t80.intestazioni.filter(([k]) => k === "Cache-Control").map(([, v]) => v);
    return { risposta, cache, chiamate: db?.chiamate ?? [] };
  };
  const chiaveEnv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dataNow = Date.now;
  const avvisiVeri = console.warn;
  const avvisi = [];
  console.warn = (...a) => avvisi.push(a.join(" "));
  let adesso = T0;
  Date.now = () => adesso;
  process.env.SUPABASE_SERVICE_ROLE_KEY = SEGRETO;
  try {
    /* ── 1 · solo le chiavi `shop.*` ──────────────────────────────────────── */
    const M = await nuovo();
    const solo = M.soloShop(RIGA_MISTA.texts);
    c("soloShop: restano le chiavi che cominciano per «shop.» e hanno un testo; niente prefissi storti, maiuscole, numeri", ["shop.conf.assistenza", "shop.err404.testo", "shop.hero.h1", "shop.vetrina.titolo"], Object.keys(solo).sort());
    c("soloShop: valori tali e quali (anche il vuoto)", ["Titolo [a]nuovo[/a]", ""], [solo["shop.hero.h1"], solo["shop.vetrina.titolo"]]);
    c("soloShop: oggetti strani (null, array, testo, numero, undefined) → niente, mai un errore", [{}, {}, {}, {}, {}], [null, [], "shop.a", 7, undefined].map((x) => M.soloShop(x)));
    const dalla = M.contenutoDaRiga(RIGA_MISTA);
    c("contenutoDaRiga: solo `testi` e `media`, e dentro solo «shop.»", [["media", "testi"], true], [Object.keys(dalla).sort(), Object.keys({ ...dalla.testi, ...dalla.media }).every((k) => k.startsWith("shop."))]);
    const testoRisposta = JSON.stringify(dalla);
    c("…nessun valore della landing, delle recensioni o di un'altra chiave nella risposta", [], ["TITOLO-DELLA-LANDING", "BADGE-DELLA-LANDING", "NOME-DI-UN-CLIENTE", "RECENSIONE", "ALTRO-DI-PROVA", "TOKEN-DI-PROVA", "landing.jpg", "id.jpg", "prefisso storto", "maiuscola"].filter((v) => testoRisposta.includes(v)));
    c("contenutoDaRiga: riga assente o storta → vuoto", [M.contenutoVuoto(), M.contenutoVuoto(), M.contenutoVuoto(), M.contenutoVuoto()], [null, undefined, "x", []].map((x) => M.contenutoDaRiga(x)));
    c("contenutoVuoto dà ogni volta un oggetto nuovo (nessuno lo sporca per gli altri)", true, M.contenutoVuoto() !== M.contenutoVuoto() && JSON.stringify(M.contenutoVuoto()) === '{"testi":{},"media":{}}');

    /* ── 2 · la funzione eseguita: la riga mista esce filtrata ────────────── */
    const db1 = dbFinto({ riga: RIGA_MISTA });
    const r1 = await chiama(M, { db: db1 });
    c("contenutoShop(): la riga mista esce SOLO con le chiavi shop.*", dalla, r1.risposta);
    c("…il database è chiesto così: tabella landing_content, colonna data, riga default, una riga sola", ["from:landing_content", "select:data", "eq:id=default", "maybeSingle"], db1.chiamate);
    c("…chiamata del browser (`/_serverFn/…`): `public, max-age=30`", ["public, max-age=30"], r1.cache);

    /* ── 3 · la memoria di 30 secondi ────────────────────────────────────── */
    adesso = T0 + 29_000;
    await chiama(M, { db: db1 });
    c("entro 30 s non si rilegge il database", 4, db1.chiamate.length);
    adesso = T0 + 31_000;
    await chiama(M, { db: db1 });
    c("passati 30 s si rilegge (una volta sola)", 8, db1.chiamate.length);

    /* ── 4 · la pagina (rendering): niente `public` ──────────────────────── */
    adesso = T0;
    const Mp = await nuovo();
    const rp = await chiama(Mp, { db: dbFinto({ riga: RIGA_MISTA }), percorso: "/shop" });
    c("nel rendering della pagina il `public` non si imposta (l'HTML resta `no-cache`)", [dalla, []], [rp.risposta, rp.cache]);
    const rf = await chiama(await nuovo(), { db: dbFinto({ riga: RIGA_MISTA }), percorso: null });
    c("fuori da una richiesta (prove, prerender): risponde lo stesso, nessuna intestazione, nessun errore", [dalla, []], [rf.risposta, rf.cache]);

    /* ── 5 · il guasto: vuoto, `no-store`, mai un errore, mai in memoria ─── */
    const VUOTO = { testi: {}, media: {} };
    const guasti = [
      ["errore del database", { db: dbFinto({ errore: true }) }],
      ["eccezione del client", { db: dbFinto({ lancia: true }) }],
      ["client del server assente (variabili mancanti)", { db: null, vuotoSenzaDb: true }],
    ];
    for (const [nome, opz] of guasti) {
      const r = await chiama(await nuovo(), { ...opz, percorso: "/_serverFn/contenuto" });
      c(`guasto, ${nome}: vuoto, \`no-store\`, nessuna eccezione`, [VUOTO, ["no-store"]], [r.risposta, r.cache]);
      const rPagina = await chiama(await nuovo(), { ...opz, percorso: "/shop" });
      c(`…anche nel rendering della pagina il guasto è \`no-store\``, [VUOTO, ["no-store"]], [rPagina.risposta, rPagina.cache]);
    }
    const Mg = await nuovo();
    const dbG = dbFinto({ errore: true });
    await chiama(Mg, { db: dbG });
    await chiama(Mg, { db: dbG });
    c("un guasto NON si tiene in memoria: la chiamata dopo rilegge", 8, dbG.chiamate.length);
    const dbOk = dbFinto({ riga: RIGA_MISTA });
    const rDopo = await chiama(Mg, { db: dbOk });
    c("…e quando il database torna, tornano i contenuti", dalla, rDopo.risposta);
    const dbS = dbFinto({ errore: true });
    const rs = await chiama(await nuovo(), { db: dbS });
    c("il testo dell'errore del database non arriva alla risposta", false, JSON.stringify(rs.risposta).includes("dettaglio"));
    const rAss = await chiama(await nuovo(), { db: dbFinto({ riga: undefined }) });
    c("nessuna riga (la landing non è mai stata salvata) NON è un guasto: vuoto, memoria normale", [VUOTO, ["public, max-age=30"]], [rAss.risposta, rAss.cache]);
    const rStorta = await chiama(await nuovo(), { db: dbFinto({ riga: "testo" }) });
    c("una riga storta (testo al posto dell'oggetto) → vuoto", VUOTO, rStorta.risposta);

    /* ── 6 · il collaudo: `private, no-store`, nessuna memoria ───────────── */
    adesso = T0;
    const Mc = await nuovo();
    const valore = await Mc.emettiCookieCollaudo(SEGRETO, T0);
    const cookie = `altro=1; ${Mc.NOME_COOKIE}=${valore}`;
    const dbC = dbFinto({ riga: RIGA_MISTA });
    const c1 = await chiama(Mc, { db: dbC, cookie });
    c("collaudo valido: `private, no-store` (anche sulla chiamata del browser) e gli stessi contenuti filtrati", [["private, no-store"], dalla], [c1.cache, c1.risposta]);
    await chiama(Mc, { db: dbC, cookie });
    c("…e nessuna memoria: ogni visita del collaudo rilegge (chi modifica i testi li rivede subito)", 8, dbC.chiamate.length);
    const cPagina = await chiama(await nuovo(), { db: dbFinto({ riga: RIGA_MISTA }), cookie: `${Mc.NOME_COOKIE}=${valore}`, percorso: "/shop" });
    c("…lo stesso nel rendering della pagina", ["private, no-store"], cPagina.cache);
    const cGuasto = await chiama(await nuovo(), { db: dbFinto({ errore: true }), cookie });
    c("collaudo + guasto: vuoto e `private, no-store`", [VUOTO, ["private, no-store"]], [cGuasto.risposta, cGuasto.cache]);
    // la memoria del pubblico e quella del collaudo non si mescolano
    const Mm = await nuovo();
    const dbM = dbFinto({ riga: RIGA_MISTA });
    await chiama(Mm, { db: dbM });
    const dopoPubblico = dbM.chiamate.length;
    const cm = await chiama(Mm, { db: dbM, cookie });
    c("il collaudo non pesca dalla memoria del pubblico (e non ci scrive la sua `no-store`)", [true, ["private, no-store"]], [dbM.chiamate.length > dopoPubblico, cm.cache]);
    const pubDopo = await chiama(Mm, { db: dbM });
    c("…il pubblico dopo il collaudo resta `public, max-age=30`", ["public, max-age=30"], pubDopo.cache);
    for (const [nome, ck] of [
      ["cookie falso", `${Mc.NOME_COOKIE}=1790000000000.abcdef`],
      ["cookie di un altro segreto", `${Mc.NOME_COOKIE}=${await Mc.emettiCookieCollaudo("altro-segreto-di-prova", T0)}`],
      ["cookie scaduto (5 ore)", `${Mc.NOME_COOKIE}=${await Mc.emettiCookieCollaudo(SEGRETO, T0 - 5 * 3600_000)}`],
      ["nome del cookie sbagliato", `hgl_collaudo=${valore}`],
    ]) {
      const r = await chiama(await nuovo(), { db: dbFinto({ riga: RIGA_MISTA }), cookie: ck });
      c(`${nome}: non cambia niente (\`public, max-age=30\`)`, ["public, max-age=30"], r.cache);
    }

    /* ── 7 · i testi: svuotato o `{{` = niente riga (V1-T16) ─────────────── */
    const T = M.TESTI_SHOP;
    const t0 = M.testiDi(M.contenutoVuoto());
    c("testiDi: senza niente di salvato valgono i testi di partenza", [T.hero.eyebrow, T.hero.h1, T.carrello.vuotoTitolo], [t0["shop.hero.eyebrow"], t0["shop.hero.h1"], t0["shop.carrello.vuoto.titolo"]]);
    c("…anche le descrizioni (alt) di partenza", M.ALT_SHOP["shop.heroFoto.alt"], t0["shop.heroFoto.alt"]);
    const t1 = M.testiDi({ testi: { "shop.hero.eyebrow": "Nuovo sopratitolo", "shop.vetrina.titolo": "", "shop.vetrina.sottotitolo": "   ", "shop.vetrina.link": "Vedi {{tutto}}", "shop.hero.cta1": "  Bottone  " } });
    c("testiDi: un testo salvato sostituisce quello di partenza", "Nuovo sopratitolo", t1["shop.hero.eyebrow"]);
    c("…svuotato (anche solo spazi) → `null`, e NON torna il testo di partenza: la riga si nasconde", [null, null], [t1["shop.vetrina.titolo"], t1["shop.vetrina.sottotitolo"]]);
    c("…con `{{…}}` → `null` (non si disegna)", null, t1["shop.vetrina.link"]);
    c("…il testo si consegna senza spazi ai lati", "Bottone", t1["shop.hero.cta1"]);
    c("…il resto resta di partenza", T.hero.sottotitolo, t1["shop.hero.sottotitolo"]);
    c("testiDi: contenuto strano (null, testo, array) → testi di partenza, mai un errore", [t0, t0, t0], [null, "x", []].map((x) => M.testiDi(x)));
    c("testiDi: le chiavi che non sono dello shop, anche dentro la risposta, non passano", [undefined, undefined], [M.testiDi({ testi: { "hero.h1": "X", "inventata.chiave": "Y" } })["hero.h1"], M.testiDi({ testi: { "inventata.chiave": "Y" } })["inventata.chiave"]]);
    c("testiDi: i testi confermati NON passano di qui (hanno una porta sola: `confermatiDa`)", [], Object.keys(M.testiDi({ testi: { "shop.conf.reso": "Reso in 14 giorni" } })).filter((k) => k.startsWith("shop.conf.")));
    c("testiDi: ogni campo di testo dell'editor c'è (tranne i confermati)", [], M.CAMPI_TESTO_SHOP.filter((x) => !x.chiave.startsWith("shop.conf.") && !(x.chiave in t0)).map((x) => x.chiave));
    c("testiDi: la liberatoria e le trascrizioni partono vuote = `null`", [null, null, null], [t0["shop.clienti.liberatoria"], t0["shop.coloriTrascrizione"], t0["shop.curaTrascrizione"]]);

    /* ── 8 · i media: vuoto, storto o senza liberatoria = niente ─────────── */
    const m0 = M.mediaDi(M.contenutoVuoto());
    c("mediaDi: ogni slot di V1 c'è, e senza niente di salvato è `null` (guasto = slot vuoti, hero a una colonna)", [M.SLOT_SHOP.map((s) => s.chiave), true], [Object.keys(m0), Object.values(m0).every((v) => v === null)]);
    const m1 = M.mediaDi({ media: { "shop.heroFoto": " https://prova.test/hero.jpg ", "shop.pacco": "", "shop.coloriFoto": "javascript:alert(1)", "shop.coloriVideo": "//cattivo.test/v.mp4", "shop.curaVideo": "data:text/html;base64,AAAA", "shop.titolareFoto": "https://prova.test/{{foto}}.jpg", "shop.condivisione": "/media/condivisione.jpg", "hero.foto": "https://prova.test/landing.jpg", "shop.inventata": "https://prova.test/x.jpg" } });
    c("mediaDi: l'indirizzo vero passa (senza spazi); vuoto, `javascript:`, `//`, `data:`, `{{` → `null`", ["https://prova.test/hero.jpg", null, null, null, null, null, "/media/condivisione.jpg"], [m1["shop.heroFoto"], m1["shop.pacco"], m1["shop.coloriFoto"], m1["shop.coloriVideo"], m1["shop.curaVideo"], m1["shop.titolareFoto"], m1["shop.condivisione"]]);
    c("mediaDi: solo gli slot dell'elenco (una chiave inventata o della landing non esce)", M.SLOT_SHOP.map((s) => s.chiave), Object.keys(m1));
    c("mediaDi: contenuto strano → tutti vuoti, mai un errore", [m0, m0, m0], [null, "x", []].map((x) => M.mediaDi(x)));

    const ok = M.slotUsabile("https://prova.test/a.jpg", "Descrizione vera");
    c("slotUsabile: indirizzo e descrizione veri → `{src, alt}`", { src: "https://prova.test/a.jpg", alt: "Descrizione vera" }, ok);
    c("slotUsabile: senza descrizione (vuota, spazi, `{{`, null) non si disegna: la foto senza alt non esiste", [null, null, null, null, null], ["", "  ", "Da {{decidere}}", null, undefined].map((a) => M.slotUsabile("https://prova.test/a.jpg", a)));
    c("slotUsabile: senza indirizzo (vuoto, null, undefined, numero, storto) non si disegna", [null, null, null, null, null], ["", null, undefined, 5, "ftp://prova.test/a.jpg"].map((u) => M.slotUsabile(u, "Descrizione vera")));
    c("slotUsabile con liberatoria: «sì» (in qualunque grafia) passa", [true, true, true], ["sì", "SI", " si "].map((l) => M.slotUsabile("https://prova.test/a.jpg", "Descrizione vera", l) !== null));
    c("…vuota, null, «no», «forse» o un altro testo NON passa (nel dubbio la persona non si mostra)", [null, null, null, null, null], ["", null, "no", "forse", "sì, ma non ho il foglio"].map((l) => M.slotUsabile("https://prova.test/a.jpg", "Descrizione vera", l)));
    c("…la liberatoria letta da `testiDi` (vuota = `null`) blocca; scritta «sì» sblocca", [null, "ok"], [
      M.slotUsabile("https://prova.test/a.jpg", "D", t0["shop.clienti.liberatoria"]),
      M.slotUsabile("https://prova.test/a.jpg", "D", M.testiDi({ testi: { "shop.clienti.liberatoria": "sì" } })["shop.clienti.liberatoria"]) ? "ok" : "no",
    ]);

    /* ── 9 · i testi confermati: una porta sola, `filtraConfermati` ───────── */
    const CH = M.CHIAVI_TESTI;
    const cf = M.confermatiDa({ testi: { "shop.conf.assistenza": "  Scrivici qui  ", "shop.conf.reso": "", "shop.conf.garanzia": "{{da decidere}}", "shop.conf.firmatario": "Nome di prova", "shop.conf.inventata": "NO", assistenza_whatsapp: "senza prefisso", reso: "senza prefisso", "hero.h1": "NO" } });
    c("confermatiDa: ha esattamente le chiavi di CHIAVI_TESTI, nell'ordine", [...CH], Object.keys(cf));
    c("…un testo vero (senza spazi ai lati) passa", ["Scrivici qui", "Nome di prova"], [cf.assistenza, cf.firmatario]);
    c("…vuoto → `null`; con `{{` → `null`; mai scritto → `null`", [null, null, null, null], [cf.reso, cf.garanzia, cf.pronta_consegna, cf.assistenza_whatsapp]);
    c("…senza il prefisso «shop.conf.» NON passa (una chiave `reso` della landing non è un testo confermato)", [null, null], [cf.reso, cf.assistenza_whatsapp]);
    c("confermatiDa: contenuto strano → tutti `null`, mai un errore", [true, true, true], [null, "x", []].map((x) => Object.values(M.confermatiDa(x)).every((v) => v === null) && Object.keys(M.confermatiDa(x)).length === CH.length));

    /* ── 10 · il lettore con memoria, senza il server ─────────────────────── */
    let t = 1000;
    const dbL = dbFinto({ riga: RIGA_MISTA });
    const lettore = M.creaLettoreContenuto({ db: dbL, adesso: () => t });
    const a = await lettore();
    t += 29_999;
    await lettore();
    c("lettore: 29,999 s dopo la memoria vale ancora; il risultato è lo stesso", [dalla, false, 4], [a.contenuto, a.guasto, dbL.chiamate.length]);
    t += 1;
    await lettore();
    c("…a 30 s esatti si rilegge", 8, dbL.chiamate.length);
    const senzaMemoria = M.creaLettoreContenuto({ db: dbL, adesso: () => t, memoriaMs: 0 });
    const n0 = dbL.chiamate.length;
    await senzaMemoria();
    await senzaMemoria();
    c("lettore con `memoriaMs: 0` (il collaudo): ogni volta rilegge", 8, dbL.chiamate.length - n0);
    const logTutti = [];
    const lettoreG = M.creaLettoreContenuto({ db: dbFinto({ errore: true }), adesso: () => t, log: (x) => logTutti.push(x) });
    const g = await lettoreG();
    c("lettore: guasto → vuoto e `guasto: true`; nel log solo un codice, mai il testo dell'errore", [{ testi: {}, media: {} }, true, true], [g.contenuto, g.guasto, logTutti.length > 0 && logTutti.every((x) => /^[a-z0-9_ .:-]{1,60}$/i.test(x) && !/dettaglio/.test(x))]);
    c("nel log del server solo codici («shop-contenuto <codice>»), mai il testo dell'errore o un valore della riga", [true, []], [avvisi.length > 0 && avvisi.every((x) => /^shop-contenuto [A-Za-z0-9_.:-]{1,40}$/.test(x)), avvisi.filter((x) => /dettaglio|rete|TOKEN|NOME-DI/.test(x))]);
  } finally {
    console.warn = avvisiVeri;
    Date.now = dataNow;
    if (chiaveEnv === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = chiaveEnv;
    delete globalThis.__t80;
  }

  /* ── 11 · il sorgente: nessuna chiave, nessuna tabella in più, nessun client importato in testa ── */
  const puro = nudo(leggiTesto("src/shop/cms/vetrina-contenuto.ts"));
  const funz = nudo(leggiTesto("src/shop/cms/contenuto-shop.functions.ts"));
  c("vetrina-contenuto.ts è puro: nessun import dal server o dal client Supabase, nessun `process.env`, nessun `console`", [false, false, false], [/@tanstack|client\.server|integrations\/supabase|supabaseAdmin/.test(puro), /process\.env/.test(puro), /\bconsole\s*\./.test(puro)]);
  c("l'involucro: una funzione del server GET; il client del server si importa a richiesta, mai in testa al file", [1, true, false], [(funz.match(/createServerFn\(/g) ?? []).length, /await import\("@\/integrations\/supabase\/client\.server"\)/.test(funz), /^import .*client\.server/m.test(funz)]);
  c("…legge una tabella sola (`landing_content`) e nessuna variabile d'ambiente per nome", [["landing_content"], false], [[...new Set([...(puro + funz).matchAll(/\.from\(\s*["'`]([a-z_]+)["'`]/g)].map((m) => m[1]))], /process\.env/.test(funz)]);
  c("…la collaudo e le intestazioni passano da `collaudoDellaRichiesta`, `CACHE_COLLAUDO` e `cacheDellaRisposta` (come il catalogo)", [true, true, true], [/collaudoDellaRichiesta\(/.test(funz), /CACHE_COLLAUDO/.test(funz), /cacheDellaRisposta\(/.test(funz)]);
  c("nessuna chiave scritta nel codice", false, /(?:eyJ[A-Za-z0-9_-]{20,}|sb_secret_|service_role\s*[:=]\s*["'])/.test(puro + funz));
}
