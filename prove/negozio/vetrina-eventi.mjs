/** ── VETRINA V1 · T79 · GLI EVENTI DELLE PAGINE NUOVE (V1-T10, V1-S8, V1-K2) ──────────────────────────────
 *  `src/shop/cms/vetrina-eventi.ts`: funzioni pure che dicono QUALE evento emettere e con quali dati; non lo emettono
 *  (lo fa la pagina con `emettiEvento`, che chiede il consenso). Si prova:
 *   · `content_ids` = SKU della VARIANTE (scheda, carrello) e valore in CENTESIMI interi (poi `costruisciEvento` lo porta in euro);
 *   · le liste usano gli SKU dei prodotti mostrati (`product_group`);
 *   · NESSUN dato personale: il testo cercato non esce se somiglia a un'email o a un telefono, le righe del carrello non portano
 *     nomi né altri campi, il conteggio interno porta solo lo SKU;
 *   · il valore non viene mai dal browser non controllato (carrello in «controllo» o non verificabile → evento senza cifra);
 *   · Invisible Derm, senza prezzo, non ha eventi di vendita.
 *  Il «Rifiuta» del banner (solo conteggi interni) lo decide `emettiEvento`/`emettiSoloContatore`: qui si prova che il conteggio
 *  interno esista a parte (`contaVariante`) e non porti niente oltre allo SKU.
 *  Dati: `_dati-vetrina.mjs` (inventati). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CARRELLO_MISTO, CARRELLO_NUOVO, CARRELLO_VECCHIO, CATALOGO, INVISIBLE_DERM, PRODOTTI, PRODOTTO_STRESS } from "./_dati-vetrina.mjs";

export async function prove(mod, { c, gruppo, radice }) {
  const E = mod["shop/cms/vetrina-eventi"];
  const EV = mod["lib/tracciamento/eventi"];
  const ELENCO = mod["shop/cms/elenco"];
  gruppo("VETRINA V1 · T79 · EVENTI: SKU DELLA VARIANTE, CENTESIMI, NESSUN DATO PERSONALE (23/11/2026)");
  c("il modulo c'è", true, !!E && !!EV && !!ELENCO);
  if (!E || !EV || !ELENCO) return;
  const { eventoListaCategoria, eventoCerca, eventoRimuovi, eventoVista, eventoAggiungi, eventoCarrello, contaVariante } = E;

  const alfa = PRODOTTI.find((p) => p.slug === "patch-prova-alfa");
  const beta = PRODOTTI.find((p) => p.slug === "patch-prova-beta");
  const gamma = PRODOTTI.find((p) => p.slug === "patch-prova-gamma");
  const costruisci = (e) => EV.costruisciEvento(e.nome, e.dati, { eventId: "id-di-prova" });
  const CHIAVI_AMMESSE = ["contentIds", "contentName", "contentType", "valueCent", "numItems", "searchString", "categoria"];

  // ── scheda: ViewContent e AddToCart con lo SKU della VARIANTE e i centesimi ──
  const v = alfa.varianti[1];
  const vista = eventoVista(alfa, v.sku);
  c("scheda: ViewContent con lo SKU della variante (non del prodotto) e il prezzo in centesimi interi", { nome: "ViewContent", dati: { contentIds: [v.sku], contentName: alfa.nome, contentType: "product", valueCent: v.prezzoCent, numItems: 1 } }, vista);
  c("lo SKU del prodotto non è lo SKU della variante: la prova distingue", [true, true], [v.sku !== alfa.sku, vista.dati.contentIds[0] !== alfa.sku]);
  c("il valore è un intero in centesimi (mai euro con la virgola)", true, Number.isInteger(vista.dati.valueCent) && vista.dati.valueCent === 29000);
  const costruito = costruisci(vista);
  c("a Meta: content_ids = SKU della variante, value in euro (centesimi / 100), valuta EUR", { content_ids: [v.sku], value: 290, currency: "EUR", content_type: "product" },
    (({ content_ids, value, currency, content_type }) => ({ content_ids, value, currency, content_type }))(costruito.meta.parametri));
  c("a TikTok e a Google: lo stesso SKU e la stessa cifra", [[{ content_id: v.sku, content_type: "product" }], [{ item_id: v.sku }], 290, 290], [costruito.tiktok.parametri.contents, costruito.ga4.parametri.items, costruito.tiktok.parametri.value, costruito.ga4.parametri.value]);
  const agg = eventoAggiungi(alfa, v.sku, 3);
  c("AddToCart: stesso SKU, quantità 3 → valore e pezzi per tre", { nome: "AddToCart", dati: { contentIds: [v.sku], contentName: alfa.nome, contentType: "product", valueCent: v.prezzoCent * 3, numItems: 3 } }, agg);
  c("AddToCart senza quantità = 1", 1, eventoAggiungi(alfa, v.sku).dati.numItems);
  c("quantità sbagliata (0, -1, 1,5, testo) → nessun evento", [null, null, null, null], [0, -1, 1.5, "2"].map((q) => eventoAggiungi(alfa, v.sku, q)));
  c("variante sconosciuta, mancante o di un altro prodotto → nessun evento", [null, null, null, null], [eventoVista(alfa, "NON-C-È"), eventoVista(alfa, null), eventoVista(alfa, beta.varianti[0].sku), eventoAggiungi(alfa, undefined, 1)]);
  c("ogni variante del prodotto stress (50) ha il suo SKU e i suoi centesimi, tutti interi", [50, true], [new Set(PRODOTTO_STRESS.varianti.map((x) => eventoVista(PRODOTTO_STRESS, x.sku).dati.contentIds[0])).size, PRODOTTO_STRESS.varianti.every((x) => eventoVista(PRODOTTO_STRESS, x.sku).dati.valueCent === x.prezzoCent)]);
  c("una variante esaurita è ancora vista (ViewContent racconta la pagina, non la vendita)", true, !!eventoVista(gamma, gamma.varianti[0].sku) && !gamma.varianti[0].disponibile);
  c("AddToCart di una variante esaurita → nessun evento (non si può aggiungere)", null, eventoAggiungi(gamma, gamma.varianti[0].sku, 1));
  c("Invisible Derm (nessun prezzo): nessun evento di scheda, nessuno di aggiunta", [null, null], [eventoVista(INVISIBLE_DERM, INVISIBLE_DERM.varianti[0].sku), eventoAggiungi(INVISIBLE_DERM, INVISIBLE_DERM.varianti[0].sku, 1)]);
  c("la scheda non porta mai la giacenza né altri campi: solo chiavi note", [], Object.keys(vista.dati).filter((k) => !CHIAVI_AMMESSE.includes(k)));

  // ── lista (categoria, home) ──
  const voci = ELENCO.vociDaPubblici(PRODOTTI);
  const lista = eventoListaCategoria(voci, "patch-pronte");
  c("lista: ViewContent di gruppo con gli SKU dei prodotti mostrati e la categoria", { nome: "ViewContent", dati: { contentType: "product_group", contentIds: PRODOTTI.map((p) => p.sku), categoria: "patch-pronte" } }, lista);
  c("lista senza categoria (la home): niente categoria", false, "categoria" in eventoListaCategoria(voci).dati);
  c("lista vuota → nessun evento", [null, null], [eventoListaCategoria([], "x"), eventoListaCategoria(undefined, "x")]);
  const costruitoLista = costruisci(lista);
  c("a Meta la lista è «product_group» e Google la chiama view_item_list", ["product_group", "view_item_list"], [costruitoLista.meta.parametri.content_type, costruitoLista.ga4.nome]);
  c("la lista non porta nessun valore in euro", false, "value" in costruitoLista.meta.parametri);

  // ── ricerca: il testo cercato non esce se somiglia a un dato personale ──
  c("ricerca normale: evento Search con il testo ripulito", { nome: "Search", dati: { searchString: "colla per patch" } }, eventoCerca("  colla   per patch "));
  c("a Meta, TikTok e Google il testo arriva", ["colla", "colla", "colla"], (() => { const x = costruisci(eventoCerca("colla")); return [x.meta.parametri.search_string, x.tiktok.parametri.query, x.ga4.parametri.search_term]; })());
  const PERSONALI = ["mario.rossi@esempio.it", "scrivi a anna@x.it", "3331234567", "06 1234 5678", "+39 333 123 4567", "12345678", "colla 123456", "@mario"];
  c("ricerca con email, telefono o numeri lunghi (6 cifre o più) → nessun evento", PERSONALI.map(() => null), PERSONALI.map((t) => eventoCerca(t)));
  c("ricerca vuota, di una lettera, non testo → nessun evento", [null, null, null, null, null], ["", " ", "a", undefined, 42].map((t) => eventoCerca(t)));
  c("ricerca con poche cifre resta (colla 3M, taglia 40)", ["colla 3M", "taglia 40"], ["colla 3M", "taglia 40"].map((t) => eventoCerca(t)?.dati.searchString));
  c("ricerca lunghissima → al massimo 80 caratteri", 80, eventoCerca("x".repeat(500)).dati.searchString.length);

  // ── RemoveFromCart: lo SKU della riga, il valore del server, nessun altro campo ──
  const riga = CARRELLO_NUOVO[1]; // beta, 2 pezzi
  const rim = eventoRimuovi(riga, "ok");
  c("Togli: RemoveFromCart con lo SKU della riga, il valore in centesimi (prezzo × quantità) e i pezzi", { nome: "RemoveFromCart", dati: { contentIds: [riga.sku], contentType: "product", valueCent: riga.snap.prezzoCent * 2, numItems: 2 } }, rim);
  c("Togli senza dire lo stato: senza cifra (chiuso, mai aperto)", { nome: "RemoveFromCart", dati: { contentIds: [riga.sku], contentType: "product", numItems: 2 } }, eventoRimuovi(riga));
  c("Togli mentre il server controlla o non risponde: l'evento c'è ma SENZA cifra (il valore ricordato dal browser non esce)",
    [{ contentIds: [riga.sku], contentType: "product", numItems: 2 }, { contentIds: [riga.sku], contentType: "product", numItems: 2 }], ["controllo", "non_verificabile"].map((s) => eventoRimuovi(riga, s).dati));
  const alterata = { ...riga, snap: { ...riga.snap, prezzoCent: 1 }, email: "cliente@esempio.it", telefono: "3331234567" };
  c("Togli: la riga può avere campi in più (rovinata): l'evento porta solo i campi noti", [], Object.keys(eventoRimuovi(alterata, "controllo").dati).filter((k) => !CHIAVI_AMMESSE.includes(k)));
  c("Togli: nessun nome, nessuna email, nessun telefono dentro l'evento", [], ["cliente@", "3331234567", "esempio.it", riga.snap.nome, "@"].filter((x) => JSON.stringify([eventoRimuovi(alterata, "ok"), costruisci(eventoRimuovi(alterata, "ok"))]).includes(x)));
  c("Togli una riga del catalogo vecchio o di Invisible Derm → nessun evento (non sono in vendita)", [null, null], [eventoRimuovi(CARRELLO_VECCHIO[0], "ok"), eventoRimuovi(CARRELLO_MISTO[2], "ok")]);
  c("Togli una riga rovinata (quantità 0, 1,5, senza sku, null) → nessun evento, senza lanciare", [null, null, null, null], [{ ...riga, qty: 0 }, { ...riga, qty: 1.5 }, { ...riga, sku: undefined }, null].map((r) => eventoRimuovi(r, "ok")));
  c("Togli con un prezzo rovinato: evento senza cifra, mai NaN", { contentIds: [riga.sku], contentType: "product", numItems: 2 }, eventoRimuovi({ ...riga, snap: { ...riga.snap, prezzoCent: "9" } }, "ok").dati);

  // ── ViewCart: una volta, a controllo finito ──
  const vc = eventoCarrello(CARRELLO_NUOVO, "ok");
  c("ViewCart: gli SKU delle righe, il totale in centesimi, i pezzi", { nome: "ViewCart", dati: { contentIds: CARRELLO_NUOVO.map((l) => l.sku), contentType: "product", valueCent: CARRELLO_NUOVO.reduce((s, l) => s + l.snap.prezzoCent * l.qty, 0), numItems: 3 } }, vc);
  c("ViewCart mentre il server controlla, o se non risponde → nessun evento (il valore non è ancora quello del server)", [null, null], [eventoCarrello(CARRELLO_NUOVO, "controllo"), eventoCarrello(CARRELLO_NUOVO, "non_verificabile")]);
  c("ViewCart nel carrello misto: solo la riga nuova (le vecchie e Invisible Derm non entrano)", [CARRELLO_MISTO[0].sku], eventoCarrello(CARRELLO_MISTO, "ok").dati.contentIds);
  c("ViewCart senza righe valide → nessun evento", [null, null, null], [eventoCarrello([], "ok"), eventoCarrello(CARRELLO_VECCHIO, "ok"), eventoCarrello(null, "ok")]);
  c("ViewCart: a Meta la cifra è in euro e gli SKU sono quelli delle varianti", [CARRELLO_NUOVO.map((l) => l.sku), "EUR"], [costruisci(vc).meta.parametri.content_ids, costruisci(vc).meta.parametri.currency]);

  // ── il conteggio interno della scelta della variante (resta anche con «Rifiuta») ──
  c("scelta variante: conteggio interno con il solo SKU", { contatore: "shop_variante_scelta", payload: { sku: v.sku } }, contaVariante(v.sku));
  c("scelta variante: SKU non valido (testo, email, numero, vuoto, troppo lungo) → nessun conteggio", [null, null, null, null, null, null], ["", "mario@esempio.it", "con spazio", 5, undefined, "A".repeat(80)].map((s) => contaVariante(s)));
  c("scelta variante: il conteggio non porta altro che lo SKU", ["sku"], Object.keys(contaVariante(v.sku).payload));

  // ── NESSUN DATO PERSONALE, su tutti gli eventi che si possono costruire ──
  const tutti = [
    vista, agg, lista, eventoCerca("colla"), rim, vc,
    ...CATALOGO.flatMap((p) => p.varianti.flatMap((x) => [eventoVista(p, x.sku), eventoAggiungi(p, x.sku, 2)])),
  ].filter(Boolean);
  c("la raccolta di eventi è grande", true, tutti.length > 40);
  c("ogni evento ha un nome noto di questo catalogo e solo le chiavi dei dati ammesse (nessun campo libero)", [],
    tutti.filter((e) => !["ViewContent", "AddToCart", "Search", "RemoveFromCart", "ViewCart"].includes(e.nome) || Object.keys(e.dati).some((k) => !CHIAVI_AMMESSE.includes(k))).map((e) => e.nome));
  c("ogni evento è costruibile per le piattaforme (Meta, TikTok dove c'è, Google)", [], tutti.filter((e) => !costruisci(e)?.ga4 || !costruisci(e)?.meta).map((e) => e.nome));
  c("nessun evento contiene una chiocciola, né un indirizzo web, né una frase lunga", [], tutti.filter((e) => /@|https?:|\s{2,}/.test(JSON.stringify(e))).map((e) => e.nome));
  c("nessun evento ha un valore che non sia un intero ≥ 0 (centesimi)", [], tutti.filter((e) => "valueCent" in e.dati && !(Number.isInteger(e.dati.valueCent) && e.dati.valueCent >= 0)).map((e) => e.nome));
  c("ogni SKU negli eventi di scheda è quello di una variante del catalogo (e mai il nome del prodotto)", [],
    tutti.filter((e) => e.nome !== "Search" && e.dati.contentType === "product" && e.dati.contentIds.some((id) => !CATALOGO.some((p) => p.varianti.some((x) => x.sku === id)))).map((e) => e.nome));

  // ── il sorgente: pura, riusa elenco.ts e scheda.ts, non li duplica ──
  const sorgente = readFileSync(join(radice, "src/shop/cms/vetrina-eventi.ts"), "utf8");
  const codice = sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c("nessun DOM, nessuna memoria del browser, nessuna rete, nessun orologio, nessun invio", [], ["window", "document", "localStorage", "sessionStorage", "fetch(", "Date", "Math.random", "setTimeout", "emettiEvento", "emettiSoloContatore", "traccia("].filter((p) => codice.includes(p)));
  c("riusa le funzioni esistenti (datiEventoScheda, datiListaVisualizzata, testoDaCercare, datiEventoRighe) e non le riscrive", [true, true, true, true],
    ["datiEventoScheda", "datiListaVisualizzata", "testoDaCercare", "datiEventoRighe"].map((n) => new RegExp(`import[^;]*\\b${n}\\b[^;]*from`).test(codice)));
  c("non ricalcola i centesimi per conto suo (nessun «* 100», nessun Math.round)", [], ["* 100", "*100", "Math.round", "/ 100", "/100"].filter((p) => codice.includes(p)));
}
