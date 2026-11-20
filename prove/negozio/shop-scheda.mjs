/** ── SHOP R1 · T20 · LA SCHEDA PRODOTTO COL CATALOGO CMS ─────────────────────
 *  `src/shop/cms/scheda.ts` (decisioni pure) e `src/routes/shop.prodotto.$slug.tsx` (disegnata davvero con `_rende.mjs`).
 *  Cosa deve valere: un guasto del database NON è «Prodotto non trovato»; l'anteprima solo con chiave valida, mai JSON-LD,
 *  mai eventi, mai acquisto; con il CMS niente stelle, recensioni, prezzo barrato, badge né frasi non più vere (verificato
 *  sul MARCHIO reso); Invisible Derm senza prezzo; con `codice` la pagina è IDENTICA a quella di oggi (confronto del
 *  marchio con la versione del commit precedente). Finto database, dati inventati, nessuna rete. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { gestore, rendi } from "./_rende.mjs";
import { negozio, viste } from "./catalogo-server.mjs";
import { ISTANTE, prodottoProva, uuid, varianteProva } from "./dati.mjs";

const T0 = Date.parse(ISTANTE);
const CHIAVE = "chiave-di-servizio-di-prova";
const SITO = "https://sito.prova.test";
/** L'ultimo commit prima di T20/T21: le pagine di «oggi». */
const OGGI = "a55e662";

export async function prove(mod, { c, gruppo, radice }) {
  const S = mod["shop/cms/scheda"];
  const CAT = mod["shop/cms/catalogo.server"];
  const AN = mod["shop/cms/anteprima"];
  const EV = mod["lib/tracciamento/eventi"];
  const AD = mod["shop/cms/adattatore"];
  gruppo("SHOP R1 · T20 · LA SCHEDA PRODOTTO (20/11/2026)");

  const catalogoDi = (modalita = "cms", { modifica = null, db = {} } = {}) => {
    const t = negozio(modalita);
    modifica?.(t);
    return CAT.creaCatalogo({ db: fintoDb({ tabelle: { ...t, ...viste(t) }, ...db }), adesso: () => T0, baseMedia: "https://m.prova.test/shop", chiaveServizio: CHIAVE });
  };
  /** Le porte di `cercaScheda` sul catalogo vero (finto database). `nelCodice`: gli indirizzi del vecchio catalogo. */
  const porte = (k, { nelCodice = [] } = {}) => ({ modalita: () => k.modalita(), scheda: (slug, chiave) => k.schedaEsito(slug, chiave), nelCodice: (s) => nelCodice.includes(s) });
  const pubblicato = (await catalogoDi().schedaEsito("prodotto-di-prova")).prodotto;

  // ── cosa mostrare: un guasto non è «non trovato» ──
  c("catalogo `cms`, prodotto pubblicato → la scheda", ["cms", "prodotto-di-prova"], await (async () => { const r = await S.cercaScheda(porte(catalogoDi()), "prodotto-di-prova", ""); return [r.tipo, r.prodotto?.slug]; })());
  c("catalogo `cms`: bozza, archiviato, slug che non c'è → «non trovato» (stessa pagina di oggi)", Array(3).fill("non_trovato"),
    await Promise.all(["prodotto-in-bozza", "prodotto-archiviato", "non-esiste"].map(async (s) => (await S.cercaScheda(porte(catalogoDi()), s, "")).tipo)));
  c("catalogo `cms` con il database in difficoltà (errore, rete, riavvio): MAI «non trovato», sempre «temporaneo»", Array(4).fill("temporaneo"),
    await Promise.all([{ errori: { "shop_v_prodotti.select": { error: { code: "57P01" } } } }, { errori: { "shop_v_prodotti.select": { error: { code: "XX000" } } } }, { errori: { "shop_v_media.select": { lancia: new Error("rete") } } }, { errori: { "shop_v_varianti.select": { error: { code: "57P01" } } } }]
      .map(async (db) => (await S.cercaScheda({ ...porte(catalogoDi("cms", { db })), modalita: async () => "cms" }, "prodotto-di-prova", "")).tipo)));
  c("la chiamata al server che lancia (rete del cliente) è «temporaneo», non «non trovato»", "temporaneo", (await S.cercaScheda({ modalita: async () => "cms", scheda: async () => { throw new Error("rete"); }, nelCodice: () => false }, "x-y", "")).tipo);
  c("catalogo `codice` e articolo del vecchio catalogo → la pagina di oggi, senza chiedere niente al server", ["codice", 0], await (async () => { let n = 0; const r = await S.cercaScheda({ modalita: async () => "codice", scheda: async () => { n++; return { esito: "guasto" }; }, nelCodice: () => true }, "parrucca-t01", ""); return [r.tipo, n]; })());
  c("migrazione S1 non ancora applicata (tabella o vista assente): «non trovato», non un guasto (ramo d, bcbbfc8)", "non_trovato", (await S.cercaScheda({ ...porte(catalogoDi("cms", { db: { mancante: true } })), modalita: async () => "cms" }, "prodotto-di-prova", "")).tipo);
  c("`codice`, indirizzo sconosciuto, database in difficoltà (può aver nascosto la modalità vera) → «temporaneo»", "temporaneo", (await S.cercaScheda(porte(catalogoDi("codice", { db: { errori: { "shop_v_prodotti.select": { error: { code: "57P01" } } } } })), "nuovo-prodotto", "")).tipo);
  c("`codice`, indirizzo sconosciuto, database sano → «non trovato»: un prodotto del CMS NON si espone con l'interruttore su `codice`", "non_trovato", (await S.cercaScheda(porte(catalogoDi("codice")), "prodotto-di-prova", "")).tipo);
  c("la modalità che non risponde (rete) vale `codice`: il sito di oggi", "codice", (await S.cercaScheda({ modalita: async () => { throw new Error("rete"); }, scheda: async () => ({ esito: "guasto" }), nelCodice: () => true }, "parrucca-t01", "")).tipo);

  // ── anteprima: solo con chiave valida ──
  const slugBozza = "prodotto-in-bozza";
  const chiaveBozza = await AN.emettiChiaveAnteprima(CHIAVE, slugBozza, T0);
  const conChiave = await S.cercaScheda(porte(catalogoDi()), slugBozza, chiaveBozza);
  c("anteprima: con la chiave valida la BOZZA si vede, con i «nascosti»", ["cms", true], [conChiave.tipo, Array.isArray(conChiave.prodotto?.anteprima?.nascosti)]);
  c("anteprima: chiave sbagliata, di un altro slug, scaduta, o senza chiave → «non trovato» (la bozza non esce)", Array(4).fill("non_trovato"),
    await Promise.all([chiaveBozza.slice(0, -2) + "xx", await AN.emettiChiaveAnteprima(CHIAVE, "prodotto-di-prova", T0), await AN.emettiChiaveAnteprima(CHIAVE, slugBozza, T0 - 25 * 3600 * 1000), ""].map(async (k) => (await S.cercaScheda(porte(catalogoDi()), slugBozza, k)).tipo)));
  c("anteprima con il catalogo `codice`: la chiave non apre niente", "non_trovato", (await S.cercaScheda(porte(catalogoDi("codice")), slugBozza, chiaveBozza)).tipo);

  // ── la testata: titolo, descrizione, immagine, JSON-LD ──
  const T = S.testataScheda(pubblicato, false, SITO);
  const meta = (t, k, v) => t.meta.find((m) => m[k] === v);
  c("testata: titolo «{nome} | Hair Genius», descrizione, indirizzo canonico, immagine di condivisione (https)", ["Prodotto di prova | Hair Genius", "Una descrizione breve inventata.", `${SITO}/shop/prodotto/prodotto-di-prova`, "https://m.prova.test/shop/prova/aaaaaaaaaaaa-1600.webp"],
    [T.meta[0].title, meta(T, "name", "description")?.content, T.links.find((l) => l.rel === "canonical")?.href, meta(T, "property", "og:image")?.content]);
  const json = T.scripts.find((s) => s.type === "application/ld+json")?.children ?? "";
  const ld = JSON.parse(json || "null");
  c("JSON-LD «Product» con prezzo a due decimali, EUR e disponibilità; mai la giacenza", ["Product", "28.90", "EUR", false], [ld?.["@type"], ld?.offers?.[0]?.price, ld?.offers?.[0]?.priceCurrency, /giacenza|"stock"/i.test(json)]);
  c("JSON-LD: un nome con `</script>` non chiude il tag", [false, true], (() => { const x = S.testataScheda({ ...pubblicato, nome: "A</script><b>" }, false, SITO).scripts[0].children; return [x.includes("</script"), JSON.parse(x).name === "A</script><b>"]; })());
  const A = S.testataScheda({ ...pubblicato, anteprima: { nascosti: [] } }, true, SITO);
  c("ANTEPRIMA: `noindex`, nessun JSON-LD (nemmeno un tag vuoto)", [true, 0], [Boolean(meta(A, "name", "robots")), A.scripts.length]);
  c("`?anteprima=` con chiave non valida (prodotto pubblico): `noindex` e niente JSON-LD comunque", [true, 0], (() => { const x = S.testataScheda(pubblicato, true, SITO); return [Boolean(meta(x, "name", "robots")), x.scripts.length]; })());
  c("senza anteprima: nessun `noindex`", false, Boolean(meta(T, "name", "robots")));
  const NT = S.testataScheda(null, false, SITO);
  c("prodotto non trovato: `noindex`, nessun JSON-LD", [true, 0], [Boolean(meta(NT, "name", "robots")), NT.scripts.length]);
  c("il titolo e la descrizione del titolare (SEO) vincono su quelli di default", ["Titolo SEO", "Descrizione SEO"], (() => { const x = S.testataScheda({ ...pubblicato, seo: { titolo: "Titolo SEO", descrizione: "Descrizione SEO", immagine: null } }, false, SITO); return [x.meta[0].title, meta(x, "name", "description").content]; })());
  c("immagine di condivisione non https → non si scrive", false, Boolean(meta(S.testataScheda({ ...pubblicato, seo: { titolo: null, descrizione: null, immagine: "http://x.test/a.jpg" }, media: [] }, false, SITO), "property", "og:image")));

  // ── gli eventi ──
  const dv = S.datiEventoScheda(pubblicato, "PROVA-001-A");
  c("ViewContent: SKU della VARIANTE, nome, `contentType: product`, valore in centesimi", { contentIds: ["PROVA-001-A"], contentName: "Prodotto di prova", contentType: "product", valueCent: 2890, numItems: 1 }, dv);
  c("AddToCart: il valore è prezzo × quantità, in centesimi interi", [8670, 3], [S.datiEventoScheda(pubblicato, "PROVA-001-A", 3).valueCent, S.datiEventoScheda(pubblicato, "PROVA-001-A", 3).numItems]);
  c("nessun evento per una variante che non c'è, una quantità storta o un valore decimale", [null, null, null], [S.datiEventoScheda(pubblicato, "NON-C-E"), S.datiEventoScheda(pubblicato, "PROVA-001-A", 0), S.datiEventoScheda(pubblicato, "PROVA-001-A", 1.5)]);
  const costruito = EV.costruisciEvento("ViewContent", dv, { eventId: "e1" });
  c("l'evento si costruisce per Meta, TikTok e Google con lo stesso `event_id`, in euro", ["e1", "e1", 28.9, "view_item"], [costruito.meta.eventId, costruito.tiktok.eventId, costruito.meta.parametri.value, costruito.ga4.nome]);
  c("vecchio catalogo: SKU come sarà dopo l'importazione (HG-T01), prezzo di oggi", ["HG-T01", 28900], (() => { const d = S.datiEventoCodice({ id: "t01", name: "X", price: 289 }); return [d.contentIds[0], d.valueCent]; })());
  const mem = new Map(); const archivio = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  c("«una volta per prodotto e sessione»: la prima sì, la seconda no, un altro prodotto sì", [true, false, true], [S.primaVolta(archivio, "a"), S.primaVolta(archivio, "a"), S.primaVolta(archivio, "b")]);
  c("archivio che lancia o assente: conta come prima volta (mai un'eccezione)", [true, true], [S.primaVolta({ getItem() { throw new Error("chiuso"); }, setItem() {} }, "a"), S.primaVolta(null, "a")]);
  c("Invisible Derm: riconosciuto dal nome e dall'indirizzo, in ogni scrittura", [true, true, true, false], ["Invisible Derm Protocol®", "invisible-derm-protocollo", "INVISIBLE  DERM", "Spray districante"].map(S.senzaPrezzo));

  // ── la pagina, disegnata davvero ──
  const FILE = "src/routes/shop.prodotto.$slug.tsx";
  const pagina = (slug, loaderData, extra = {}) => rendi(radice, FILE, { params: { slug }, loaderData, carrello: { add() {}, lines: [] }, ...extra });
  const cmsDi = (p, anteprima = false) => ({ scheda: { tipo: "cms", prodotto: p }, anteprima });
  const spenti = (h) => (h.match(/<button[^>]*\sdisabled=""/g) ?? []).length;
  const marchioVietato = (h) => ({ stelle: /lucide-star/.test(h), recensioni: /recension/i.test(h), barrato: /line-through/.test(h), sconto: /-\d+%/.test(h), badge: /best seller|capelli veri|nuovo!|bestseller/i.test(h), spedizione59: /€\s?59|59\s?€/.test(h), premium: /premium/i.test(h), sede: /scipioni/i.test(h), giacenza: /7341/.test(h) });
  const NIENTE = { stelle: false, recensioni: false, barrato: false, sconto: false, badge: false, spedizione59: false, premium: false, sede: false, giacenza: false };

  const base = (await catalogoDi("cms", { modifica: (t) => { t.shop_varianti.find((v) => v.sku === "PROVA-001-A").giacenza = 7341; } }).schedaEsito("prodotto-di-prova")).prodotto;
  const { html: hCms, route } = await pagina("prodotto-di-prova", cmsDi(base));
  c("CMS, MARCHIO RESO: niente stelle, recensioni, prezzo barrato, sconto, badge, «sopra €59», «premium», indirizzo dello studio, giacenza", NIENTE, marchioVietato(hCms));
  c("CMS: nome, prezzo (28,90 €), «Aggiungi al carrello» attivo, «Disponibile»", [true, true, true, true, false], [hCms.includes("Prodotto di prova"), /28,90\s€/.test(hCms), hCms.includes("Aggiungi al carrello"), hCms.includes("● Disponibile"), spenti(hCms) > 0]);
  c("CMS: niente «Anteprima» in una scheda pubblica", false, hCms.includes("Anteprima:"));

  // ── il prezzo è quello della VARIANTE scelta, non quello «da» del prodotto ──
  //  «Taglia L» costa 35,00 € ed è la prima opzione (quella scelta all'apertura); «Taglia S» costa 20,00 € ed è il «da».
  const conTaglie = (t) => {
    t.shop_prodotti.push(prodottoProva({ id: uuid(0x210), sku: "PROVA-005", slug: "prodotto-con-taglie", nome: "Prodotto con taglie", prezzo_cent: 2000 }));
    t.shop_varianti.push(
      varianteProva({ id: uuid(0x310), prodotto_id: uuid(0x210), sku: "PROVA-005-L", nome: "Taglia L", opzioni: { Taglia: "L" }, prezzo_cent: 3500, ordine: 1 }),
      varianteProva({ id: uuid(0x311), prodotto_id: uuid(0x210), sku: "PROVA-005-S", nome: "Taglia S", opzioni: { Taglia: "S" }, prezzo_cent: null, ordine: 2 }),
    );
  };
  const taglie = (await catalogoDi("cms", { modifica: conTaglie }).schedaEsito("prodotto-con-taglie")).prodotto;
  const aggiunte = [];
  const carr = { add: (...a) => aggiunte.push(a), lines: [] };
  const pT = await pagina("prodotto-con-taglie", cmsDi(taglie), { carrello: carr });
  c("prezzo: il «da» del prodotto è 20,00 € ma la variante scelta (Taglia L) costa 35,00 €: la scheda mostra 35,00, mai il «da»", [true, false], [/35,00\s€/.test(pT.html), /20,00\s€/.test(pT.html)]);
  gestore(pT.pagina, "button", "Aggiungi al carrello")();
  gestore(pT.pagina, "button", "Acquista ora")();
  c("prezzo: «Aggiungi» e «Acquista ora» mettono nel carrello la variante scelta, con il SUO prezzo (3500 centesimi) e il suo SKU",
    [["PROVA-005-L", 3500], ["PROVA-005-L", 3500]], aggiunte.map(([, , , cms]) => [cms?.sku, cms?.snap?.prezzoCent]));
  c("prezzo: una variante senza prezzo proprio (Taglia S) vale quello del prodotto, 20,00 €, e il «da» è il più basso", [2000, 2000], [taglie.varianti.find((v) => v.sku === "PROVA-005-S").prezzoCent, taglie.prezzoDaCent]);

  const esaurito = (await catalogoDi().schedaEsito("altro-prodotto")).prodotto;
  const hEs = (await pagina("altro-prodotto", cmsDi(esaurito))).html;
  c("CMS, variante esaurita: «Esaurita», i due bottoni `disabled`, «Esaurito» a video; la giacenza non c'è", [true, 2, true, false], [hEs.includes("Esaurita"), spenti(hEs), hEs.includes("Esaurito"), /\b0\b.*pezz|ne restano/i.test(hEs)]);

  const prev = (await catalogoDi().schedaEsito(slugBozza, chiaveBozza)).prodotto;
  const hPrev = (await pagina(slugBozza, cmsDi(prev, true))).html;
  c("ANTEPRIMA, marchio reso: riquadro con «non ancora visibile» e i motivi dei nascosti; acquisto spento; nessuna stella", [true, true, 2, false], [hPrev.includes("non è ancora visibile al pubblico"), prev.anteprima.nascosti.every((n) => hPrev.includes(n.motivo)) && prev.anteprima.nascosti.length > 0, spenti(hPrev), /lucide-star/.test(hPrev)]);

  const idn = (await catalogoDi("cms", { modifica: (t) => { t.shop_prodotti.find((p) => p.sku === "PROVA-001").nome = "Invisible Derm Protocol"; t.shop_prodotti.find((p) => p.sku === "PROVA-001").slug = "invisible-derm-protocol"; } }).schedaEsito("invisible-derm-protocol")).prodotto;
  const hId = (await pagina("invisible-derm-protocol", cmsDi(idn))).html;
  c("Invisible Derm: MAI un prezzo (nessun «€», nessun «Aggiungi», nessun «Acquista»), il costo si vede in consulenza", [false, false, false, true], [/€/.test(hId), hId.includes("Aggiungi al carrello"), hId.includes("Acquista ora"), hId.includes("Il costo lo vedi in consulenza.")]);

  // ── D39: un prodotto non acquistabile (prezzi `null`) non mostra cifre né bottoni, qualunque sia il suo nome ──
  const senzaCifre = { ...base, nome: "Sistema su misura", slug: "sistema-su-misura", acquistabile: false, prezzoDaCent: null, varianti: base.varianti.map((v) => ({ ...v, prezzoCent: null, disponibile: false })) };
  const hSc = (await pagina("sistema-su-misura", cmsDi(senzaCifre))).html;
  c("D39, `acquistabile: false` con prezzi `null` (nome qualunque): nessuna cifra, niente «Aggiungi» né «Acquista ora», «Il costo lo vedi in consulenza.», niente «Esaurito»",
    [false, false, false, true, false], [/€|NaN/.test(hSc), hSc.includes("Aggiungi"), hSc.includes("Acquista ora"), hSc.includes("Il costo lo vedi in consulenza."), hSc.includes("Esaurito")]);
  const hScP = (await pagina("sistema-su-misura", cmsDi({ ...senzaCifre, prezzoDaCent: 2890, varianti: base.varianti }))).html;
  c("D39, `acquistabile: false` anche se i prezzi arrivassero valorizzati: la cifra e i bottoni non si disegnano comunque", [false, false, false, true], [/€/.test(hScP), hScP.includes("Aggiungi"), hScP.includes("Acquista ora"), hScP.includes("Il costo lo vedi in consulenza.")]);
  c("D39, un prodotto acquistabile resta com'era: prezzo e bottoni", [true, true, true], [/28,90\s€/.test(hCms), hCms.includes("Aggiungi al carrello"), hCms.includes("Acquista ora")]);
  const correlato = (prezzoDaCent) => ({ ...base, correlato: { slug: "un-altro-prodotto", nome: "Un altro prodotto", prezzoDaCent, foto: null } });
  const sezione = (h) => h.slice(h.indexOf("Ti serve anche"));
  const hCorN = sezione((await pagina("prodotto-di-prova", cmsDi(correlato(null)))).html);
  const hCorP = sezione((await pagina("prodotto-di-prova", cmsDi(correlato(1250)))).html);
  c("D39, «Ti serve anche» con prezzo `null`: il nome sì, né «€» né «0» né «NaN»", [true, false, false], [hCorN.includes("Un altro prodotto"), /€|NaN/.test(hCorN), />\s*0\s*</.test(hCorN)]);
  c("D39, «Ti serve anche» con un prezzo vero: si vede (12,50 €)", true, /12,50\s€/.test(hCorP));
  c("D39, evento senza prezzo: nessun `ViewContent`/`AddToCart` (mai un valore 0 o NaN)", [null, null], [S.datiEventoScheda(senzaCifre, "PROVA-001-A"), S.datiEventoScheda(senzaCifre, "PROVA-001-A", 2)]);
  c("CMS, striscia di fiducia del vecchio catalogo: né «Qualità premium» né «Spedizione gratuita … €59» (neppure sotto il pulsante)", [false, false, false], [/qualit[àa] premium/i.test(hCms), /spedizione gratuita/i.test(hCms), /€\s?59|59\s?€/.test(hCms)]);

  //  «Non trovato» risponde 404 davvero (non una pagina 200 che dice «non trovato»): il loader lancia `notFound()`, la rotta ha il suo `notFoundComponent`.
  const hNt = (await pagina("x-y", {}, { componente: "notFoundComponent" })).html;
  c("«Prodotto non trovato.» è la stessa frase di oggi (bozza o archiviato senza chiave), disegnata dal `notFoundComponent` con il link al catalogo", [true, true], [hNt.includes("Prodotto non trovato."), hNt.includes("Torna al catalogo")]);
  c("rotta, `head` di una scheda non trovata (`match.status` «notFound», nessun `loaderData`): titolo «Prodotto non trovato», `noindex`, nessun JSON-LD", ["Prodotto non trovato | Hair Genius", true, 0],
    (() => { const x = route.head({ match: { status: "notFound" } }); return [x.meta[0].title, Boolean(meta(x, "name", "robots")), x.scripts.length]; })());
  c("rotta, `head` di un guasto (nessun `loaderData`, `match.status` «error»): niente di tutto questo", {}, route.head({ match: { status: "error" } }));
  // la `head` e il `loader` della rotta vera
  const hd = route.head({ loaderData: cmsDi(base) });
  c("rotta, `head` con il CMS: titolo, canonical e UN tag JSON-LD; con `codice` nessuna intestazione nuova", [1, "Prodotto di prova | Hair Genius", {}], [hd.scripts.length, hd.meta[0].title, route.head({ loaderData: { scheda: { tipo: "codice" }, anteprima: false } })]);
  c("rotta, `head` in anteprima: `noindex` e nessun JSON-LD", [true, 0], (() => { const x = route.head({ loaderData: cmsDi(prev, true) }); return [Boolean(meta(x, "name", "robots")), x.scripts.length]; })());
  c("rotta, anteprima: `Cache-Control: private, no-store` sulla pagina; altrimenti niente di speciale", [{ "Cache-Control": "private, no-store" }, {}], [route.headers({ loaderData: cmsDi(prev, true) }), route.headers({ loaderData: cmsDi(base) })]);
  c("rotta, scheda in GUASTO (il loader ha lanciato: `match.status` «error», nessun `loaderData`): `Cache-Control: no-store`", [{ "Cache-Control": "no-store" }, { "Cache-Control": "no-store" }], [route.headers({ match: { status: "error" } }), route.headers({ match: { status: "error" }, loaderData: undefined })]);
  c("rotta, scheda sana senza anteprima, anche con `match` «success»: niente intestazione (resta quella della radice, `no-cache, must-revalidate`)", [{}, { "Cache-Control": "private, no-store" }], [route.headers({ loaderData: cmsDi(base), match: { status: "success" } }), route.headers({ loaderData: cmsDi(prev, true), match: { status: "success" } })]);
  const carica = async (porteFinte, slug = "prodotto-di-prova", anteprima = "") => {
    const pf = { modalita: async () => "cms", ...porteFinte };
    return S.cercaScheda(pf, slug, anteprima);
  };
  c("rotta, caricamento: il guasto fa lanciare il loader (errore temporaneo) invece di una pagina «non trovato»", true, /tipo === "temporaneo"\) throw new Error/.test(readFileSync(join(radice, FILE), "utf8")) && (await carica({ scheda: async () => ({ esito: "guasto" }), nelCodice: () => false })).tipo === "temporaneo");

  // ── il SORGENTE della rotta ──
  const src = readFileSync(join(radice, FILE), "utf8");
  c("sorgente: la testata viene da `testataScheda` (JSON-LD con `serializzaJsonLd`, mai `JSON.stringify` nella pagina)", [true, false], [src.includes("testataScheda("), /JSON\.stringify|dangerouslySetInnerHTML/.test(src)]);
  c("sorgente: `ViewContent` con `datiEventoScheda`, `AddToCart` con gli stessi dati dello stesso SKU, via `emettiEvento` (nessun pixel a mano)", [true, true, false], [src.includes('emettiEvento("ViewContent"') && src.includes("datiEventoScheda(cms"), src.includes('emettiEvento("AddToCart"'), /fbq|ttq|gtag|fireCapi|firePixel|trackEvent/.test(src)]);
  c("sorgente: nessun evento in anteprima, ViewContent una volta per sessione, la bozza non si compra", [true, true, true], [/if \(dati && !anteprima\) emettiEvento\("AddToCart"/.test(src), src.includes("primaVolta(window.sessionStorage"), src.includes("fuoriVendita")]);
  c("sorgente: variante esaurita → `disabled`; guardia sulle stelle (`reviews > 0`); mai la giacenza a schermo", [true, true, false], [src.includes("disabled={nonAcquistabile}"), src.includes("product.reviews > 0"), /giacenza/i.test(src.replace(/^\s*\/\/.*$/gm, ""))]);
  c("sorgente: «non trovato» lancia `notFound()` nel loader (risposta 404) e la rotta ha `notFoundComponent`", [true, true], [/scheda\.tipo === "non_trovato"\) throw notFound\(\)/.test(src), /notFoundComponent: NonTrovato/.test(src)]);
  c("sorgente: la rotta non scrive l'indirizzo dello studio", false, /scipioni|via degli/i.test(src));

  // ── con `codice` la pagina è IDENTICA a quella di oggi (stesso marchio, byte per byte) ──
  let vecchio = null;
  try {
    const dir = mkdtempSync(join(tmpdir(), "prova-oggi-"));
    const f = join(dir, "scheda-oggi.tsx");
    writeFileSync(f, execFileSync("git", ["show", `${OGGI}:${FILE}`], { cwd: radice, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
    vecchio = f;
  } catch {
    console.log(`  SALTATA: la pagina di oggi (git show ${OGGI}) non si legge: il confronto «identica a oggi» non è stato fatto`);
  }
  if (vecchio) {
    const ids = ["t01", "t12", "t30"].map((i) => i).filter(Boolean);
    const catalogo = readFileSync(join(radice, "src/shop/catalog.ts"), "utf8");
    const slugs = [...catalogo.matchAll(/\bid: "(\w+)", slug: "([a-z0-9-]+)"/g)].map((m) => m[2]);
    // un articolo di ogni categoria (protesi con box e pop-up, cura, kit, accessori…) per coprire tutti i rami della pagina
    const scelti = [...new Set([slugs[0], slugs[5], slugs[10], slugs[15], slugs[20], slugs[25], slugs[slugs.length - 1]])];
    const diversi = [];
    for (const slug of scelti) {
      const a = (await rendi(radice, vecchio, { params: { slug }, carrello: { add() {}, lines: [] } })).html;
      const b = (await pagina(slug, { scheda: { tipo: "codice" }, anteprima: false })).html;
      if (a !== b) { diversi.push(slug); if (process.env.PROVA_DIFF) { let i = 0; while (a[i] === b[i]) i++; console.log("DIFF", slug, "\n A:", a.slice(i - 60, i + 120), "\n B:", b.slice(i - 60, i + 120)); } }
    }
    c(`con il catalogo \`codice\` la scheda è IDENTICA a quella di oggi (${scelti.length} articoli, protesi e cura), marchio contro marchio`, [], diversi);
    void ids;
  }

  void AD; void prodottoProva; void uuid; void varianteProva;
}
