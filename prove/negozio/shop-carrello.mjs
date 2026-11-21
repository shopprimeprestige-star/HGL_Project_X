/** ── SHOP R1 · T21 · CARRELLO E CASSA VECCHIA SUI DATI CMS ───────────────────
 *  `src/shop/cms/cassa.ts` (decisioni pure), `src/shop/useRivalidaCarrello.ts` e le pagine `shop.carrello.tsx` /
 *  `shop.checkout.tsx` (disegnate davvero con `_rende.mjs`). Cosa deve valere:
 *   · la cassa ricalcola i prezzi dal SERVER e non legge mai `snap.prezzoCent` (provato sul codice e con uno `snap` falsificato);
 *   · con il catalogo `codice` le righe CMS si tolgono con garbo, con un messaggio; ma un guasto del database NON svuota il carrello;
 *   · `righeCarrello` (T11) e `ripulisciRighe` (T12) concatenate sullo stesso finto database;
 *   · la correzione già pubblicata del checkout (ordine con UUID, carrello non svuotato in caso di errore) è intatta;
 *   · con `codice` carrello e cassa sono IDENTICI a quelli di oggi (marchio contro marchio). Dati inventati, nessuna rete. */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { gestore, rendi } from "./_rende.mjs";
import { negozio, viste } from "./catalogo-server.mjs";
import { ISTANTE, prodottoProva, uuid, varianteProva } from "./dati.mjs";

const T0 = Date.parse(ISTANTE);
const OGGI = "a55e662";

export async function prove(mod, { c, gruppo, radice }) {
  const K = mod["shop/cms/cassa"];
  const CA = mod["shop/cms/carrello"];
  const CAT = mod["shop/cms/catalogo.server"];
  const MC = mod["shop/cms/modalita-certa"];
  const IO = mod["shop/invio-ordine"];
  gruppo("SHOP R1 · T21 · CARRELLO E CASSA SUI DATI CMS (20/11/2026)");

  const catalogoDi = (modalita = "cms", { db = {}, modifica = null } = {}) => {
    const t = negozio(modalita);
    modifica?.(t);
    const finto = fintoDb({ tabelle: { ...t, ...viste(t) }, ...db });
    return Object.assign(CAT.creaCatalogo({ db: finto, adesso: () => T0, baseMedia: "https://m.prova.test/shop", chiaveServizio: "chiave-di-prova" }), { __db: finto });
  };
  /** Le porte di `rivalida` sul catalogo vero: `righeCarrello` (T11), come sonda `schedaEsito`, e la lettura «certa» della modalità sullo STESSO database. */
  const porte = (k, modo = "cms") => ({ modo, chiediRighe: (skus) => k.righeCarrello(skus), sonda: async (slug) => (await k.schedaEsito(slug)).esito !== "guasto", modalitaCerta: () => MC.leggiModalitaCerta({ db: k.__db }) });
  const riga = (sku, slug, prezzoCent, qty = 1, extra = {}) => ({ productId: sku, qty, key: sku, sku, snap: { nome: "Nome vecchio", slug, prezzoCent, foto: null, varianteNome: null }, ...extra });
  const vecchia = (id, qty = 1) => ({ productId: id, qty, key: id });
  const ok = riga("PROVA-001-A", "prodotto-di-prova", 2890, 2);

  // ── i prezzi si ricalcolano dal server ──
  const prezzoFalso = { ...ok, snap: { ...ok.snap, prezzoCent: 1 } };
  const r1 = await K.rivalida(porte(catalogoDi()), [prezzoFalso]);
  c("rivalida: il prezzo di una riga con `snap` FALSIFICATO (1 centesimo) torna quello del server; il cliente ne è avvisato", ["ok", 2890, true, 0], [r1.stato, r1.righe[0].snap.prezzoCent, r1.prezziCambiati, r1.rimosse]);
  const o1 = K.itemsOrdine(r1.righe, r1.server);
  c("ordine: `product_id` = SKU, `unit_price` in euro da 2890 centesimi = 28.9, `variant` = nome della variante (§3.2), subtotale in centesimi", [[{ product_id: "PROVA-001-A", name: "Prodotto di prova", slug: "prodotto-di-prova", qty: 2, unit_price: 28.9, variant: "Unica" }], 5780], [o1.items, o1.subtotaleCent]);
  // anche con uno `snap` falso il numero che arriva all'ordine è del server, passando dalle righe NON ripulite
  const o2 = K.itemsOrdine([prezzoFalso], r1.server);
  c("ordine: con uno `snap` a 1 centesimo l'ordine resta a 28.9 per pezzo (lo `snap` non si legge)", [28.9, 5780], [o2.items[0].unit_price, o2.subtotaleCent]);
  c("ordine: 3 × 19,90 € si somma in centesimi (59,70 esatto)", [59.7, 5970], (() => { const s = [{ sku: "X-1", nome: "N", varianteNome: "V", prezzoCent: 1990, disponibile: true, foto: null, slug: "n" }]; const o = K.itemsOrdine([{ productId: "X-1", qty: 3, key: "X-1", sku: "X-1" }], s); return [o.subtotaleCent / 100, o.subtotaleCent]; })());
  c("ordine: una riga che il server non conosce, esaurita, o con quantità storta NON si ordina (lancia)", Array(4).fill("riga non ordinabile"),
    [[riga("ALTRO", "x", 100), []], [riga("PROVA-004-A", "altro-prodotto", 3500), (await catalogoDi().righeCarrello(["PROVA-004-A"]))], [riga("PROVA-001-A", "x", 100, 0), r1.server], [riga("PROVA-001-A", "x", 100, 1.5), r1.server]]
      .map(([l, s]) => { try { K.itemsOrdine([l], s); return "ordinata"; } catch (e) { return e.message; } }));

  // ── righeCarrello (T11) + ripulisciRighe (T12) sullo stesso finto database ──
  const k = catalogoDi();
  const righe = [ok, riga("PROVA-001-OFF", "prodotto-di-prova", 100), riga("PROVA-004-A", "altro-prodotto", 3500), riga("NON-C-E", "x", 5), vecchia("t01")];
  const server = await k.righeCarrello(righe.filter((l) => l.sku).map((l) => l.sku));
  const diretto = CA.ripulisciRighe(righe, server);
  const catena = await K.rivalida(porte(k), righe);
  c("CONCATENATE `righeCarrello` e `ripulisciRighe`: resta solo la riga buona; spenta, esaurita, sconosciuta e vecchia si tolgono (4)", [["PROVA-001-A"], 4], [diretto.righe.map((l) => l.sku), diretto.rimosse]);
  c("…e `rivalida` dà lo stesso risultato della catena a mano (stesse righe, stesse rimosse, prezzi dal server)", [diretto.righe.map((l) => [l.sku, l.qty, l.snap.prezzoCent]), diretto.rimosse], [catena.righe.map((l) => [l.sku, l.qty, l.snap.prezzoCent]), catena.rimosse]);
  c("la variante spenta (PROVA-001-OFF) non esce dal server, quindi non resta nel carrello", [true, true], [server.find((s) => s.sku === "PROVA-001-OFF")?.nonPiuDisponibile === true, !catena.righe.some((l) => l.sku === "PROVA-001-OFF")]);
  c("righe tutte buone e prezzi uguali: niente rimosse, niente «prezzi cambiati» (nessun avviso inutile)", [0, false], await (async () => { const r = await K.rivalida(porte(catalogoDi()), [riga("PROVA-001-A", "prodotto-di-prova", 2890)]); return [r.rimosse, r.prezziCambiati]; })());
  const intatto = JSON.stringify(righe); await K.rivalida(porte(k), righe);
  c("rivalida non cambia l'elenco che riceve", intatto, JSON.stringify(righe));

  // ── Invisible Derm non ha un prezzo: se arriva nel carrello, si toglie ──
  const kid = catalogoDi("cms", { modifica: (t) => { const p = t.shop_prodotti.find((x) => x.sku === "PROVA-001"); p.nome = "Invisible Derm Protocol"; p.slug = "invisible-derm-protocol"; } });
  const rid = await K.rivalida(porte(kid), [riga("PROVA-001-A", "invisible-derm-protocol", 2890)]);
  c("Invisible Derm nel carrello: la riga si toglie (mai un prezzo, mai una cassa)", [0, 1], [rid.righe.filter((l) => l.sku === "PROVA-001-A").length, rid.rimosse]);

  // ── catalogo tornato a `codice`: le righe CMS si tolgono con garbo ──
  const kc = catalogoDi("codice");
  const rc = await K.rivalida(porte(kc, "codice"), [ok, vecchia("t01", 2)]);
  c("`codice`: le righe CMS (con SKU) si tolgono, le vecchie restano con la loro quantità; il cliente vede il messaggio", [["t01"], 1, "ok"], [rc.righe.map((l) => l.productId), rc.rimosse, rc.stato]);
  c("il messaggio è quello del piano: «Alcuni prodotti non sono più disponibili…» (mai un errore)", true, /^Alcuni prodotti non sono più disponibili/.test(K.MSG_RIMOSSE) && !/errore/i.test(K.MSG_RIMOSSE));
  c("`codice` e solo righe vecchie: niente da fare, nemmeno una chiamata al server", [0, 0], await (async () => { let n = 0; const r = await K.rivalida({ modo: "codice", chiediRighe: async () => { n++; return []; }, sonda: async () => { n++; return false; }, modalitaCerta: async () => { n++; return "incerto"; } }, [vecchia("t01")]); return [r.rimosse, n]; })());

  // ── un guasto del database NON svuota il carrello ──
  const giu = catalogoDi("cms", { db: { errori: { "shop_v_prodotti.select": { error: { code: "57P01" } } } } });
  const rg = await K.rivalida(porte(giu), [ok]);
  c("`cms` con il database giù: il server dice «non più disponibile» a TUTTO, ma la sonda dice guasto → `non_verificabile`, nessuna riga tolta", ["non_verificabile", undefined], [rg.stato, rg.righe]);
  const rg2 = await K.rivalida(porte(catalogoDi("codice", { db: { errori: { "shop_v_prodotti.select": { error: { code: "57P01" } }, "shop_impostazioni.select": { error: { code: "57P01" } } } } }), "codice"), [ok]);
  c("`codice` per un guasto (la modalità non si è letta): le righe CMS NON si tolgono, `non_verificabile`", ["non_verificabile", undefined], [rg2.stato, rg2.righe]);
  c("la rete che lancia (carrello o sonda): `non_verificabile`, mai un'eccezione", ["non_verificabile", "non_verificabile"], [
    (await K.rivalida({ modo: "cms", chiediRighe: async () => { throw new Error("rete"); }, sonda: async () => true }, [ok])).stato,
    (await K.rivalida({ modo: "codice", chiediRighe: async () => [], sonda: async () => true, modalitaCerta: async () => { throw new Error("rete"); } }, [ok])).stato,
  ]);
  c("`cms`: se il server riconosce anche UNA sola riga, il database funziona: le altre si tolgono per davvero (nessuna sonda)", [1, 0], await (async () => { let n = 0; const r = await K.rivalida({ ...porte(catalogoDi()), sonda: async () => { n++; return false; } }, [ok, riga("NON-C-E", "x", 5)]); return [r.rimosse, n]; })());
  c("`cms` con righe vecchie (senza SKU): si tolgono senza chiedere niente al server", [1, 0], await (async () => { let n = 0; const r = await K.rivalida({ modo: "cms", chiediRighe: async () => { n++; return []; }, sonda: async () => true }, [vecchia("t01")]); return [r.rimosse, n]; })());

  // ── gli eventi del carrello ──
  const prezzoCodice = (id) => ({ t01: 289 })[id];
  c("eventi: SKU del CMS e, per le righe vecchie, lo SKU che avranno dopo l'importazione; valore in centesimi, mai a virgola mobile", { contentIds: ["PROVA-001-A", "HG-T01"], contentType: "product", valueCent: 5780 + 2 * 28900, numItems: 4 }, K.datiEventoRighe([ok, vecchia("t01", 2)], prezzoCodice));
  c("eventi: carrello vuoto o quantità storte → niente evento", [null, null], [K.datiEventoRighe([], prezzoCodice), K.datiEventoRighe([vecchia("t01", 0)], prezzoCodice)]);

  // ── la riga d'ordine VERA di `invio-ordine.ts` (la correzione già pubblicata) ──
  const form = { nome: "N", cognome: "C", email: "e@prova.test", telefono: "1", indirizzo: "Via Finta 1", citta: "Città", cap: "00000", note: "" };
  const t = IO.tentativoPer(null, "firma", 0, () => "00000000-0000-4000-8000-000000000001");
  const rCms = IO.rigaOrdine(t, { form, items: o1.items, subtotal: 57.8, shipping: 0, total: 57.8 });
  c("riga d'ordine CMS: `items[].unit_price = 28.9` da 2890, `product_id` = SKU, id = UUID del tentativo", [28.9, "PROVA-001-A", "00000000-0000-4000-8000-000000000001"], [rCms.items[0].unit_price, rCms.items[0].product_id, rCms.id]);
  c("riga d'ordine `codice`: `product_id: \"t01\"` come oggi", "t01", IO.rigaOrdine(t, { form, items: [{ product_id: "t01", name: "X", slug: "x", qty: 1, unit_price: 289, variant: null }], subtotal: 289, shipping: 0, total: 289 }).items[0].product_id);
  c("una riga CMS diversa (altro prezzo) è un ALTRO tentativo, un UUID nuovo: il 23505 non conferma un ordine diverso", true, IO.tentativoPer(t, JSON.stringify(["altro"]), 0, () => "00000000-0000-4000-8000-000000000002").id !== t.id);

  // ── il sorgente ──
  const FILE_CASSA = "src/routes/shop.checkout.tsx", FILE_CARR = "src/routes/shop.carrello.tsx";
  const cassa = readFileSync(join(radice, FILE_CASSA), "utf8");
  const nudo = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const itemsFn = nudo(readFileSync(join(radice, "src/shop/cms/cassa.ts"), "utf8")).split("export function itemsOrdine")[1]?.split("export function datiEventoRighe")[0] ?? "";
  const submit = nudo(cassa).split("const submit = async")[1]?.split("if (orderId)")[0] ?? "";
  c("sorgente: l'ordine NON legge `snap` (né `prezzoCent` della riga): `itemsOrdine` e `submit` della cassa", [false, false, true], [/snap/.test(itemsFn), /snap|\.prezzoCent/.test(submit), submit.length > 200]);
  c("sorgente: la cassa CMS ricalcola dal server (`controlla()` → `itemsOrdine`) e si ferma se qualcosa è cambiato", [true, true, true], [submit.includes("await controlla()"), submit.includes("itemsOrdine(esito.righe, esito.server)"), /esito\.rimosse > 0 \|\| esito\.prezziCambiati\) return/.test(submit)]);
  c("sorgente: la correzione già pubblicata c'è ancora (UUID per tentativo, `inviaOrdine`, carrello svuotato SOLO a ordine salvato)", [true, true, true, 1, true], [
    submit.includes("tentativoPer(tentativo.current, firmaOrdine(dati))"), submit.includes("inviaOrdine(rigaOrdine(t, dati)"), submit.includes("MESSAGGIO_ERRORE_ORDINE"),
    (submit.match(/\bclear\(\)/g) ?? []).length, /if \(esito === "salvato"\) \{[^}]*clear\(\)/s.test(submit)]);
  c("sorgente: `invio-ordine.ts` non è stato toccato da T21", "", execFileSync("git", ["diff", "--stat", OGGI, "--", "src/shop/invio-ordine.ts"], { cwd: radice, encoding: "utf8" }).trim());
  c("sorgente: eventi `ViewCart`, `InitiateCheckout` (una volta per carrello), `RemoveFromCart`; nessun pixel a mano; nessun «Purchase»", [true, true, true, false, false], [
    readFileSync(join(radice, FILE_CARR), "utf8").includes('emettiEvento("ViewCart"'), cassa.includes('emettiEvento("InitiateCheckout"') && cassa.includes("primaVolta(window.sessionStorage"), readFileSync(join(radice, FILE_CARR), "utf8").includes('emettiEvento("RemoveFromCart"'),
    /fbq|ttq|gtag|fireCapi|firePixel/.test(cassa + readFileSync(join(radice, FILE_CARR), "utf8")), /Purchase|CompletePayment/.test(cassa)]);
  c("sorgente: in `codice` una riga CMS rimasta non si ordina mai (bottone fermo, e fuori da `items`)", [true, true], [cassa.includes("righeCmsPendenti"), cassa.includes("lines.filter((l) => !l.sku)")]);
  c("sorgente: nessun indirizzo dello studio nelle pagine", false, /scipioni|via degli/i.test(cassa + readFileSync(join(radice, FILE_CARR), "utf8")));

  // ── il marchio reso: carrello e cassa ──
  const carrelloFinto = (lines, subtotal, extra = {}) => ({ lines, subtotal, count: lines.reduce((s, l) => s + l.qty, 0), setQty() {}, remove() {}, clear() {}, replaceLines() {}, add() {}, ...extra });
  const rivFinto = (extra = {}) => ({ stato: "ok", avviso: null, controlla: async () => ({ stato: "non_verificabile" }), ...extra });
  const ricche = [{ ...ok, snap: { ...ok.snap, nome: "Prodotto di prova", varianteNome: "Variante X" } }];
  const vietato = (h) => ({ stelle: /lucide-star/.test(h), recensioni: /recension/i.test(h), barrato: /line-through/.test(h), gratuita: /gratuit/i.test(h), sede: /scipioni/i.test(h) });
  const NIENTE = { stelle: false, recensioni: false, barrato: false, gratuita: false, sede: false };
  const car = await rendi(radice, FILE_CARR, { loaderData: { modo: "cms" }, carrello: carrelloFinto(ricche, 57.8), rivalida: rivFinto() });
  c("CARRELLO CMS, marchio reso: nome, variante, prezzo di riga (57,80 €), nessuna stella/recensione/barrato; niente «spedizione gratuita» (la cifra non è più vera)", [true, true, true, NIENTE], [car.html.includes("Prodotto di prova"), car.html.includes("Variante X"), /57,80\s€/.test(car.html), vietato(car.html)]);
  const carAvviso = await rendi(radice, FILE_CARR, { loaderData: { modo: "cms" }, carrello: carrelloFinto(ricche, 57.8), rivalida: rivFinto({ avviso: K.MSG_RIMOSSE }) });
  c("CARRELLO: il messaggio «Alcuni prodotti non sono più disponibili» si vede (`role=status`)", true, /role="status"[^>]*>Alcuni prodotti non sono più disponibili/.test(carAvviso.html));
  const carGuasto = await rendi(radice, FILE_CARR, { loaderData: { modo: "cms" }, carrello: carrelloFinto(ricche, 57.8), rivalida: rivFinto({ stato: "non_verificabile" }) });
  c("CARRELLO con il server che non risponde: le righe restano e un avviso (`role=alert`) dice di riprovare", [true, true], [carGuasto.html.includes("Prodotto di prova"), /role="alert"[^>]*>Non riusciamo a controllare il carrello/.test(carGuasto.html)]);
  const carCodice = await rendi(radice, FILE_CARR, { loaderData: { modo: "codice" }, carrello: carrelloFinto([ok], 57.8), rivalida: rivFinto() });
  c("CARRELLO `codice` con una riga CMS rimasta: non si disegna (e il cliente non vede un prodotto fantasma)", false, carCodice.html.includes("Prodotto di prova") || carCodice.html.includes("Nome vecchio"));
  const chk = await rendi(radice, FILE_CASSA, { loaderData: { modo: "cms" }, carrello: carrelloFinto(ricche, 57.8), rivalida: rivFinto() });
  c("CASSA CMS, marchio reso: riepilogo con nome, variante e prezzo; nessuna stella/barrato; «Conferma ordine» attivo", [true, true, NIENTE, false], [chk.html.includes("Prodotto di prova"), /57,80\s€/.test(chk.html), vietato(chk.html), /<button[^>]*\sdisabled=""[^>]*>[^]*Conferma ordine/.test(chk.html)]);
  const chkAspetta = await rendi(radice, FILE_CASSA, { loaderData: { modo: "cms" }, carrello: carrelloFinto(ricche, 57.8), rivalida: rivFinto({ stato: "non_verificabile" }) });
  c("CASSA CMS con il server che non risponde: «Conferma ordine» spento e l'avviso c'è (il carrello resta)", [true, true], [/<button[^>]*\sdisabled=""[^>]*>[^]*Conferma ordine/.test(chkAspetta.html), chkAspetta.html.includes("Non riusciamo a controllare il carrello")]);
  const chkCodice = await rendi(radice, FILE_CASSA, { loaderData: { modo: "codice" }, carrello: carrelloFinto([ok], 57.8), rivalida: rivFinto({ stato: "non_verificabile" }) });
  c("CASSA `codice` con una riga CMS rimasta: non si ordina (bottone spento)", true, /<button[^>]*\sdisabled=""[^>]*>[^]*Conferma ordine/.test(chkCodice.html));

  // ── la modalità «certa»: il server dice `codice` solo se l'ha letto, sano ──
  const certa = (db, forza) => MC.leggiModalitaCerta({ db: fintoDb({ tabelle: negozio("codice"), ...db }), forza });
  const impostazioni = (valore) => ({ tabelle: { ...negozio("codice"), shop_impostazioni: valore === undefined ? [] : [{ chiave: "catalogo_sito", valore, aggiornato_il: ISTANTE, aggiornato_da: null }] } });
  c("modalità certa: la riga dice `codice` → «codice»; dice `cms` → «cms»", ["codice", "cms"], [await certa(impostazioni("codice")), await certa(impostazioni("cms"))]);
  c("modalità certa: riga assente, valore strano, tabella assente, errore del database, rete che lancia → «incerto» (mai «codice» per assenza di notizie)", Array(5).fill("incerto"), [
    await certa(impostazioni(undefined)), await certa(impostazioni(5)), await certa({ mancante: true }),
    await certa({ ...impostazioni("codice"), errori: { "shop_impostazioni.select": { error: { code: "57P01" } } } }), await certa({ ...impostazioni("codice"), errori: { "shop_impostazioni.select": { lancia: new Error("rete") } } })]);
  c("modalità certa: `SHOP_CATALOGO_FORZA` («codice» o «cms») vale senza toccare il database; ogni altro valore si ignora", [["codice", 0], ["cms", 0], ["incerto", 1]], await Promise.all([["codice", "codice"], ["cms", "cms"], ["incerto", "boh"]].map(async ([, forza], i) => {
    const f = fintoDb({ tabelle: negozio("codice"), errori: { "shop_impostazioni.select": { error: { code: "57P01" } } } });
    return [await MC.leggiModalitaCerta({ db: f, forza }), f.chiamate];
  })));

  // ── la finestra della sonda: UN solo fallimento nella lettura della modalità non toglie le righe CMS ──
  //  Il catalogo è in memoria (sano), la lettura della modalità fallisce una volta → `modalita()` dice `codice` (è un guasto, non una scelta):
  //  la vecchia sonda (`schedaEsito`) risponde «sano» dalla memoria e il carrello veniva svuotato.
  const unaVolta = () => { let n = 0; return () => (n++ === 0 ? { error: { code: "57P01" } } : undefined); };
  const scenario = async ({ errori, modo }) => {
    const k = catalogoDi("cms", { db: { errori } });
    await k.elenco(); // il catalogo è già in memoria, sano
    const m = await k.modalita(); // il caricamento della pagina: la modalità non si legge → `codice`
    return { m, k, r: await K.rivalida(porte(k, modo ?? m), [ok, vecchia("t01", 2)]) };
  };
  const finestra = await scenario({ errori: { "shop_impostazioni.select": unaVolta() } });
  c("UN solo fallimento nella lettura della modalità (catalogo in memoria, sano): le righe CMS NON si tolgono; `non_verificabile`", ["codice", "non_verificabile", undefined], [finestra.m, finestra.r.stato, finestra.r.righe]);
  const fermo = await scenario({ errori: { "shop_impostazioni.select": { error: { code: "57P01" } } } });
  c("la modalità che continua a non rispondere: le righe restano, `non_verificabile`", ["codice", "non_verificabile"], [fermo.m, fermo.r.stato]);
  const vera = await K.rivalida(porte(catalogoDi("codice"), "codice"), [ok, vecchia("t01", 2)]);
  c("il server conferma in modo esplicito e sano `codice`: le righe CMS si tolgono (e le vecchie restano)", [["t01"], 1, "ok"], [vera.righe.map((l) => l.productId), vera.rimosse, vera.stato]);
  c("la conferma dice `cms` (la pagina era rimasta indietro) o la lettura lancia: le righe restano", ["non_verificabile", "non_verificabile", 2], await (async () => {
    const dice = (m) => ({ modo: "codice", chiediRighe: async () => [], sonda: async () => true, modalitaCerta: m });
    const a = await K.rivalida(dice(async () => "cms"), [ok]);
    const b = await K.rivalida(dice(async () => { throw new Error("rete"); }), [ok]);
    return [a.stato, b.stato, [ok, vecchia("t01")].length];
  })());
  const hook = readFileSync(join(radice, "src/shop/useRivalidaCarrello.ts"), "utf8");
  const funz = readFileSync(join(radice, "src/shop/cms/modalita-certa.functions.ts"), "utf8");
  c("sorgente: il carrello chiede la modalità certa al server (non la deduce dalla scheda) e la funzione del server non lancia, non si ferma in memoria, e non scrive niente", [true, true, true, true], [
    /modalitaCerta: \(\) => modalitaCertaDelServer\(\)/.test(hook), /catch/.test(funz) && /"incerto"/.test(funz), /no-store/.test(funz), !/\.(insert|update|upsert|delete|rpc)\(/.test(funz)]);

  // ── i prezzi delle VARIANTI: cassa e carrello non usano mai il prezzo «da» del prodotto ──
  //  «Taglia L» 35,00 € e «Taglia S» 20,00 € (il «da» del prodotto): `rivalida` deve riportarle ai prezzi del server anche se lo `snap` le ricordava tutte a 20,00 €.
  const conTaglie = (t) => {
    t.shop_prodotti.push(prodottoProva({ id: uuid(0x210), sku: "PROVA-005", slug: "prodotto-con-taglie", nome: "Prodotto con taglie", prezzo_cent: 2000 }));
    t.shop_varianti.push(
      varianteProva({ id: uuid(0x310), prodotto_id: uuid(0x210), sku: "PROVA-005-L", nome: "Taglia L", opzioni: { Taglia: "L" }, prezzo_cent: 3500, ordine: 1 }),
      varianteProva({ id: uuid(0x311), prodotto_id: uuid(0x210), sku: "PROVA-005-S", nome: "Taglia S", opzioni: { Taglia: "S" }, prezzo_cent: null, ordine: 2 }),
    );
  };
  const kt = catalogoDi("cms", { modifica: conTaglie });
  const taglie = [riga("PROVA-005-L", "prodotto-con-taglie", 2000, 1), riga("PROVA-005-S", "prodotto-con-taglie", 2000, 2)];
  const rt = await K.rivalida(porte(kt), taglie);
  c("varianti: `rivalida` riporta a ogni riga il prezzo della SUA variante (L 35,00 €, S 20,00 €) e avvisa che un prezzo è cambiato", [[3500, 2000], true], [rt.righe.map((l) => l.snap.prezzoCent), rt.prezziCambiati]);
  const ot = K.itemsOrdine(rt.righe, rt.server);
  c("varianti: le righe dell'ordine hanno il prezzo della variante (35 e 20 euro, nomi «Taglia L» e «Taglia S»), subtotale 75,00 € in centesimi", [[35, 20], ["Taglia L", "Taglia S"], 7500], [ot.items.map((i) => i.unit_price), ot.items.map((i) => i.variant), ot.subtotaleCent]);
  const giuste = taglie.map((l, i) => ({ ...l, snap: { ...l.snap, prezzoCent: [3500, 2000][i] } }));
  const cartaT = await rendi(radice, FILE_CARR, { loaderData: { modo: "cms" }, carrello: carrelloFinto(giuste, 75), rivalida: rivFinto() });
  c("CARRELLO: ogni riga mostra il prezzo della sua variante (L 35,00 €, S × 2 = 40,00 €), e il subtotale è 75,00 €", [true, true, true], [/35,00\s€/.test(cartaT.html), /40,00\s€/.test(cartaT.html), /75,00\s€/.test(cartaT.html)]);

  const submitSrc = nudo(readFileSync(join(radice, FILE_CASSA), "utf8")).split("const submit = async")[1]?.split("if (orderId)")[0] ?? "";
  // ── la cassa vera: si invia il modulo, si legge la riga che andrebbe nel database ──
  const invia = async (loaderData, lines, subtotal, controlla) => {
    const p = await rendi(radice, FILE_CASSA, { loaderData, carrello: carrelloFinto(lines, subtotal), rivalida: rivFinto({ controlla }) });
    await gestore(p.pagina, "form")({ preventDefault() {} });
    return p.pagina.righe;
  };
  const controllaCms = (lines, k = kt) => () => K.rivalida(porte(k), lines);
  const [oT] = await invia({ modo: "cms" }, giuste, 75, controllaCms(giuste));
  c("CASSA CMS: l'ordine ha i prezzi delle varianti dal server (35 e 20 euro), mai il «da» del prodotto; subtotale 75, spedizione 4,90 (tariffa fissa), totale 79,90", [[35, 20], ["PROVA-005-L", "PROVA-005-S"], 75, 4.9, 79.9], [oT?.items.map((i) => i.unit_price), oT?.items.map((i) => i.product_id), oT?.subtotal, oT?.shipping, oT?.total]);
  const vecchiePt = taglie.map((l) => ({ ...l, snap: { ...l.snap, prezzoCent: 1 } }));
  const [oF] = await invia({ modo: "cms" }, vecchiePt, 0.03, controllaCms(vecchiePt));
  c("CASSA CMS: con gli `snap` falsificati (1 centesimo) la prima conferma si ferma (prezzi cambiati), e nessun ordine parte con prezzi del browser", undefined, oF);

  // ── D37: in modalità CMS la spedizione è a tariffa fissa, senza soglia ──
  c("D37: una sola costante, 4,90 € (490 centesimi), in `cassa.ts`", 490, K.SPEDIZIONE_CMS_CENT);
  const una = riga("PROVA-001-A", "prodotto-di-prova", 2890, 1);
  const tre = riga("PROVA-001-A", "prodotto-di-prova", 2890, 3); // 86,70 €: sopra i 59 €
  for (const [nome, lines, sub, tot] of [["sotto i 59 € (28,90)", [una], 28.9, 33.8], ["sopra i 59 € (86,70)", [tre], 86.7, 91.6]]) {
    const car = await rendi(radice, FILE_CARR, { loaderData: { modo: "cms" }, carrello: carrelloFinto(lines, sub), rivalida: rivFinto() });
    const [o] = await invia({ modo: "cms" }, lines, sub, () => K.rivalida(porte(catalogoDi()), lines));
    c(`D37 CMS, ${nome}: CARRELLO con spedizione 4,90 € (mai «Gratuita», mai «Aggiungi … per la spedizione»), totale ${String(tot).replace(".", ",")}0 €; CASSA con shipping 4.9 e total ${tot}`, [true, false, false, 4.9, tot], [
      /Spedizione<\/span><span[^>]*>4,90\s€/.test(car.html) && new RegExp(`${String(tot).replace(".", ",")}0\\s€`).test(car.html), /gratuit/i.test(car.html), /per la spedizione/.test(car.html), o?.shipping, o?.total]);
  }
  c("D37 sorgente: l'invio della cassa CMS prende le spese dalla costante unica (nessuna soglia né tariffa scritte a mano nel ramo CMS)", [true, false], [
    submitSrc.includes("SPEDIZIONE_CMS_CENT"), /SHIPPING_THRESHOLD|SHIPPING_COST/.test(submitSrc)]);
  // la spedizione MOSTRATA (riepilogo di carrello e di cassa) parte dal ramo CMS: con `cms` mai la soglia dei 59 €, mai «Gratuita» per soglia
  const carrSrc = nudo(readFileSync(join(radice, FILE_CARR), "utf8"));
  const cassaSrc = nudo(cassa);
  c("D37 sorgente: la spedizione mostrata nel carrello e nella cassa è `cms ? SPEDIZIONE_CMS_CENT / 100 : …`, e «Aggiungi … per la spedizione gratuita» sta solo fuori da `cms`", [true, true, true], [
    /const shipping = cms \? SPEDIZIONE_CMS_CENT \/ 100 :/.test(carrSrc), /const shipping = cms \? SPEDIZIONE_CMS_CENT \/ 100 :/.test(cassaSrc), /shipping > 0 && !cms && \(\s*<p[^>]*>\s*Aggiungi/.test(carrSrc)]);
  // con `codice` non cambia niente: sotto soglia 4,90, da 59 in su gratis (la cassa vera)
  const catalogoCodice = readFileSync(join(radice, "src/shop/catalog.ts"), "utf8");
  const prezziCodice = [...catalogoCodice.matchAll(/\bid: "(\w+)",[\s\S]*?\bprice: (\d+(?:\.\d+)?)/g)].map((m) => [m[1], Number(m[2])]);
  const economico = prezziCodice.find(([, pr]) => pr < 59), caro = prezziCodice.find(([, pr]) => pr >= 59);
  const [oEco] = await invia({ modo: "codice" }, [vecchia(economico[0])], economico[1], async () => ({ stato: "ok", righe: [], server: [], rimosse: 0, prezziCambiati: false }));
  const [oCaro] = await invia({ modo: "codice" }, [vecchia(caro[0])], caro[1], async () => ({ stato: "ok", righe: [], server: [], rimosse: 0, prezziCambiati: false }));
  c("`codice`: la cassa non cambia: sotto i 59 € spedizione 4.9, da 59 € in su 0 (la soglia vale ancora)", [4.9, economico[1] + 4.9, 0, caro[1]], [oEco?.shipping, Math.round((oEco?.total ?? 0) * 100) / 100, oCaro?.shipping, oCaro?.total]);

  // ── con `codice`: IDENTICI a oggi ──
  const catalogo = readFileSync(join(radice, "src/shop/catalog.ts"), "utf8");
  const ids = [...catalogo.matchAll(/\bid: "(\w+)", slug: "([a-z0-9-]+)"/g)].map((m) => m[1]);
  const prezzi = new Map([...catalogo.matchAll(/\bid: "(\w+)",[\s\S]*?\bprice: (\d+(?:\.\d+)?)/g)].map((m) => [m[1], Number(m[2])]));
  const vecchie = [vecchia(ids[0], 2), vecchia(ids[7], 1), { ...vecchia(ids[12], 3), variant: { Colore: "1B" }, key: `${ids[12]}|Colore:1B` }];
  const subtotal = vecchie.reduce((s, l) => s + (prezzi.get(l.productId) ?? 0) * l.qty, 0);
  const oggi = async (file) => {
    try {
      const dir = mkdtempSync(join(tmpdir(), "prova-oggi-"));
      const f = join(dir, "oggi.tsx");
      writeFileSync(f, execFileSync("git", ["show", `${OGGI}:${file}`], { cwd: radice, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
      return f;
    } catch {
      console.log(`  SALTATA: la pagina di oggi (git show ${OGGI}:${file}) non si legge: il confronto «identica a oggi» non è stato fatto`);
      return null;
    }
  };
  for (const [nome, file] of [["il carrello", FILE_CARR], ["la cassa", FILE_CASSA]]) {
    const vecchio = await oggi(file);
    if (!vecchio) continue;
    const stati = [["con tre righe", vecchie, subtotal], ["vuoto", [], 0], ["una sola riga", [vecchie[0]], prezzi.get(ids[0]) * 2], ["sopra €59 (spedizione gratuita)", [vecchia(ids[0], 3)], prezzi.get(ids[0]) * 3]];
    const diversi = [];
    for (const [d, lines, sub] of stati) {
      const base = { carrello: carrelloFinto(lines, sub) };
      const a = (await rendi(radice, vecchio, base)).html;
      const b = (await rendi(radice, file, { ...base, loaderData: { modo: "codice" }, rivalida: rivFinto() })).html;
      if (a !== b) diversi.push(d);
    }
    c(`con il catalogo \`codice\` ${nome} è IDENTICO a quello di oggi (marchio contro marchio: ${stati.map((s) => s[0]).join(", ")})`, [], diversi);
  }
}
