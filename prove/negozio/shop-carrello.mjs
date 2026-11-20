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
import { rendi } from "./_rende.mjs";
import { negozio, viste } from "./catalogo-server.mjs";
import { ISTANTE } from "./dati.mjs";

const T0 = Date.parse(ISTANTE);
const OGGI = "a55e662";

export async function prove(mod, { c, gruppo, radice }) {
  const K = mod["shop/cms/cassa"];
  const CA = mod["shop/cms/carrello"];
  const CAT = mod["shop/cms/catalogo.server"];
  const IO = mod["shop/invio-ordine"];
  gruppo("SHOP R1 · T21 · CARRELLO E CASSA SUI DATI CMS (20/11/2026)");

  const catalogoDi = (modalita = "cms", { db = {}, modifica = null } = {}) => {
    const t = negozio(modalita);
    modifica?.(t);
    return CAT.creaCatalogo({ db: fintoDb({ tabelle: { ...t, ...viste(t) }, ...db }), adesso: () => T0, baseMedia: "https://m.prova.test/shop", chiaveServizio: "chiave-di-prova" });
  };
  /** Le porte di `rivalida` sul catalogo vero: `righeCarrello` (T11) e, come sonda, `schedaEsito`. */
  const porte = (k, modo = "cms") => ({ modo, chiediRighe: (skus) => k.righeCarrello(skus), sonda: async (slug) => (await k.schedaEsito(slug)).esito !== "guasto" });
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
  c("`codice` e solo righe vecchie: niente da fare, nemmeno una chiamata alla sonda", [0, 0], await (async () => { let n = 0; const r = await K.rivalida({ modo: "codice", chiediRighe: async () => { n++; return []; }, sonda: async () => { n++; return false; } }, [vecchia("t01")]); return [r.rimosse, n]; })());

  // ── un guasto del database NON svuota il carrello ──
  const giu = catalogoDi("cms", { db: { mancante: true } });
  const rg = await K.rivalida(porte(giu), [ok]);
  c("`cms` con il database giù: il server dice «non più disponibile» a TUTTO, ma la sonda dice guasto → `non_verificabile`, nessuna riga tolta", ["non_verificabile", undefined], [rg.stato, rg.righe]);
  const rg2 = await K.rivalida(porte(catalogoDi("codice", { db: { mancante: true } }), "codice"), [ok]);
  c("`codice` per un guasto (la modalità non si è letta): le righe CMS NON si tolgono, `non_verificabile`", ["non_verificabile", undefined], [rg2.stato, rg2.righe]);
  c("la rete che lancia (carrello o sonda): `non_verificabile`, mai un'eccezione", ["non_verificabile", "non_verificabile"], [
    (await K.rivalida({ modo: "cms", chiediRighe: async () => { throw new Error("rete"); }, sonda: async () => true }, [ok])).stato,
    (await K.rivalida({ modo: "codice", chiediRighe: async () => [], sonda: async () => { throw new Error("rete"); } }, [ok])).stato,
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
