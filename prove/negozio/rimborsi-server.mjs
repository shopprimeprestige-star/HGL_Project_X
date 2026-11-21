/** ── NEGOZIO · RILASCIO 2 · T53 · I RIMBORSI, L'ANNULLO E «CONTROLLA CON STRIPE» (SERVER DEL CRM) ────────────────────────
 *  `src/crm/ecommerce/rimborsi.server.ts` attraverso la rotta `gestisciPOST` (PIANO-R2 D46, D55, SPEC 7.4 n. 5, 8A n. 6). Sempre contro il database finto di
 *  T40 (stessa logica del SQL di S4) e Stripe finto, col client vero di T44 (`creaClientStripe`): nessuna rete, nessuna chiave, nessun dato vero.
 *   · rimborso: UNA riga `richiesto` prenotata sotto blocco (`shop_rimborso_prenota`), UNA chiamata a Stripe con `Idempotency-Key` = id della riga e
 *     `metadata[riga_id]`; lo stato finale (`riuscito`, `rimborsato`) lo scrive solo `shop_rimborso_riconcilia` (webhook o «Controlla con Stripe»);
 *   · doppio clic (stessa chiave, anche insieme) → una chiamata; due richieste diverse che insieme superano il pagato → una sola passa;
 *   · Stripe rifiuta → riga `fallito` e importo di nuovo disponibile; Stripe in timeout → riga `richiesto`; prima di ripetere si legge l'elenco di Stripe;
 *   · annulla (rimborso del residuo, rimessa in magazzino solo di ciò che i movimenti dicono scalato, sessione fatta scadere se in attesa);
 *   · riconcilia: `paid` → `shop_ordine_pagato` (idempotente), `unpaid` → niente, rimborsi dal pannello di Stripe, righe orfane > 10 minuti → `fallito`;
 *   · nessun dato del cliente verso Stripe né nei log. Dati inventati. */
import { rigaOrdineProva } from "../ecommerce/dati.mjs";
import { fintoDb, COLONNE_S4 } from "./_finto-db.mjs";
import { stripeFinto, CHIAVE_PROVA } from "./_stripe-finto.mjs";
import { ADESSO } from "./_server.mjs";

const uuid = (n) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const ID = uuid(1);
const K1 = uuid(0xc1);
const K2 = uuid(0xc2);
const K3 = uuid(0xc3);
const CINQUE_MINUTI = "2026-11-20T12:05:00.000Z";
const VENTI_MINUTI_FA = "2026-11-20T11:40:00.000Z";
const CINQUE_MINUTI_FA = "2026-11-20T11:55:00.000Z";
const PERSONALI = ["Anna", "Esempio", "anna.esempio@example.com", "+39 300 000 0001", "Via Inventata 1", "Cittàfinta"];

/** L'ordine come lo scrive S4: due righe (SKU-A × 2, SKU-B × 1), 24,90 €, della cassa nuova. */
const ordine = (extra = {}) => ({
  ...structuredClone(COLONNE_S4),
  ...rigaOrdineProva({
    id: ID, order_ref: "HG-P1", created_at: "2026-11-20T09:00:00.000Z",
    items: [
      { product_id: "SKU-A", name: "Prodotto A", slug: "prodotto-a", qty: 2, unit_price: 10, variant: null },
      { product_id: "SKU-B", name: "Prodotto B", slug: "prodotto-b", qty: 1, unit_price: 0.1, variant: null },
    ],
  }),
  lead_id: null, senza_lead: false, pagato_il: null, pagato_importo: null, metodo_pagamento: null, tracking: null, note_interne: null, aggiornato_il: null,
  canale: "sito", status: "nuovo", totale_cent: 2490, ...extra,
});
const VARIANTI = () => [
  { id: uuid(0x7100), sku: "SKU-A", giacenza: 8, attiva: true, nome: "Unica", opzioni: {} },
  { id: uuid(0x7101), sku: "SKU-B", giacenza: 5, attiva: true, nome: "Unica", opzioni: {} },
];
/** I movimenti di un ordine pagato in cui SOLO la riga A è stata scalata (la B no: giacenza insufficiente a quel momento). */
const MOVIMENTI_SOLO_A = () => [{ id: "m1", variante_id: uuid(0x7100), delta: -2, giacenza_dopo: 8, motivo: "ordine", ordine_ref: "HG-P1", chi: "stripe", creato_il: ADESSO }];

export async function prove(mod, { c, gruppo }) {
  const K = mod["shop/stripe/client"];
  gruppo("NEGOZIO R2 · RIMBORSI, ANNULLO, CONTROLLA CON STRIPE (T53)");
  const S = mod["ecommerce/ordini.server"];

  /** Un mondo: Stripe finto con una sessione pagata (o aperta), il database con l'ordine e la sessione registrata. */
  async function mondo({ pagata = true, statoSessione = pagata ? "pagata" : "aperta", ordineExtra = {}, tabelle = {}, errori = {}, prima = {}, importo = 2490 } = {}) {
    const stripe = stripeFinto();
    const client = K.creaClientStripe({ chiave: CHIAVE_PROVA, fetch: stripe.fetch, timeoutMs: 50 });
    const creata = await client.creaSessione({ mode: "payment", success_url: "https://sito.example/ok", line_items: [{ price_data: { currency: "eur", unit_amount: importo, product_data: { name: "Prodotto di prova" } }, quantity: 1 }] }, "k-prova-1");
    const sessione = creata.dati.id;
    if (pagata) stripe.paga(sessione);
    const pi = stripe.sessione(sessione).payment_intent;
    const righe = pagata
      ? { stato_pagamento: "pagato", pagato_il: "2026-11-20T10:00:00.000Z", pagato_importo: importo / 100, metodo_pagamento: "stripe", stripe_pagamento_id: pi }
      : { stato_pagamento: "in_attesa", scade_il: "2026-11-20T13:00:00.000Z" };
    const db = fintoDb({
      tabelle: {
        shop_orders: [ordine({ ...righe, stripe_sessione_id: sessione, totale_cent: importo, ...ordineExtra })],
        shop_stripe_sessioni: [{ sessione_id: sessione, ordine_id: ID, creata_il: ADESSO, scade_il: null, stato: statoSessione }],
        shop_order_eventi: [], shop_rimborsi: [], shop_varianti: VARIANTI(), shop_giacenza_movimenti: [], shop_impostazioni: [],
        ...tabelle,
      },
      errori, prima,
    });
    stripe.azzera();
    return { stripe, client, sessione, pi, db };
  }
  /** Una richiesta alla rotta con le porte date; `adesso` e `email` facoltativi. Restituisce stato, JSON, log. */
  async function posta(m, corpo, { adesso = ADESSO, email = false, nome = "Giulia Esempio", client = m.client } = {}) {
    const log = [];
    const chiamateEmail = [];
    const d = {
      guardia: async () => ({ ok: true, nome }),
      db: m.db,
      adesso: () => new Date(adesso),
      log: (x) => log.push(x),
      stripe: client,
      ...(email ? { email: { invia: async (chiave, ordineId, opzioni) => { chiamateEmail.push([chiave, ordineId, opzioni]); return typeof email === "function" ? email(chiave) : { stato: "inviata" }; } } } : {}),
    };
    const r = await S.gestisciPOST(new Request("https://crm.example.com/api/crm/ordini", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }), d);
    return { stato: r.status, json: await r.json(), log, chiamateEmail };
  }
  const rimb = (importoCent, chiaveRichiesta = K1, extra = {}) => ({ azione: "rimborso", ordineId: ID, importoCent, motivo: "Prodotto rovinato", chiaveRichiesta, conferma: true, ...extra });
  const tab = (m, t) => m.db.tabelle[t] ?? [];
  const ord = (m) => tab(m, "shop_orders")[0];
  const POSTrimborsi = (m) => m.stripe.chiamateA("POST", "/v1/refunds");
  const GETrimborsi = (m) => m.stripe.chiamateA("GET", "/v1/refunds");
  const riconcilia = (m, opz) => posta(m, { azione: "riconcilia", ordineId: ID }, opz);

  // ── il rimborso: una riga, una chiamata, lo stato finale non lo scrive questo gestore ──
  {
    const m = await mondo();
    const r = await posta(m, rimb(2490));
    const riga = tab(m, "shop_rimborsi")[0];
    c("rimborso totale: ok, UNA riga `richiesto` (importo, motivo, chi, chiave) e UNA chiamata a Stripe", [200, true, 1, "richiesto", 2490, "Prodotto rovinato", "Giulia Esempio", K1, 1], [r.stato, r.json.ok, tab(m, "shop_rimborsi").length, riga?.stato, riga?.importo_cent, riga?.motivo, riga?.chi, riga?.chiave_richiesta, POSTrimborsi(m).length]);
    const p = POSTrimborsi(m)[0];
    c("la chiamata a Stripe: importo, pagamento, `Idempotency-Key` = id della riga, `metadata[riga_id]` = id della riga", [String(2490), m.pi, riga?.id, riga?.id], [String(p?.corpo?.amount), p?.corpo?.payment_intent, p?.chiaveIdempotenza, p?.corpo?.metadata?.riga_id]);
    c("nulla del cliente verso Stripe (né nome, né email, né indirizzo)", [], PERSONALI.filter((s) => (p?.corpoGrezzo ?? "").includes(encodeURIComponent(s)) || (p?.corpoGrezzo ?? "").includes(s)));
    c("lo stato finale NON lo scrive questo gestore: la riga resta `richiesto` e l'ordine resta «pagato» finché non lo dice Stripe", ["richiesto", "pagato", 0], [riga?.stato, ord(m).stato_pagamento, ord(m).rimborsato_cent]);
    c("la risposta dice che è stato richiesto (non «rimborsato»)", ["fatto", true], [r.json.effetti?.[0]?.esito, /richiest/i.test(r.json.effetti?.[0]?.frase ?? "") && !/rimborsato/i.test(r.json.effetti?.[0]?.frase ?? "")]);
    c("storico: UNA riga «rimborso richiesto» (la scrive la funzione SQL, col nome di chi agisce), non due", [1, "rimborso_richiesto", "Giulia Esempio"], (() => { const e = tab(m, "shop_order_eventi").filter((x) => x.tipo === "rimborso_richiesto"); return [e.length, e[0]?.tipo, e[0]?.chi]; })());
    // «Controlla con Stripe»: ora Stripe lo dà per riuscito
    const q = await riconcilia(m);
    c("«Controlla con Stripe» dopo il rimborso: la riga diventa `riuscito`, l'ordine «rimborsato», 2490 rimborsati", [200, "riuscito", "rimborsato", 2490], [q.stato, tab(m, "shop_rimborsi")[0]?.stato, ord(m).stato_pagamento, ord(m).rimborsato_cent]);
    c("…e la riga ha l'id del rimborso di Stripe", true, /^re_/.test(tab(m, "shop_rimborsi")[0]?.stripe_rimborso_id ?? ""));
    c("…e non si crea un secondo rimborso su Stripe", 1, POSTrimborsi(m).length);
    // niente più da rimborsare
    const ancora = await posta(m, rimb(100, K2));
    c("dopo il rimborso totale un altro rimborso è rifiutato, senza chiamare Stripe", [400, 1], [ancora.stato, POSTrimborsi(m).length]);
  }

  // ── parziale, poi il resto; oltre il pagato ──
  {
    const m = await mondo();
    await posta(m, rimb(1000, K1));
    await riconcilia(m);
    c("rimborso parziale: ordine «rimborsato in parte», 1000 rimborsati", ["rimborsato_in_parte", 1000], [ord(m).stato_pagamento, ord(m).rimborsato_cent]);
    const oltre = await posta(m, rimb(1491, K2));
    c("oltre il pagato (1491 su 1490 rimasti) → rifiutato con la frase, nessuna chiamata", [400, true, 1, 1], [oltre.stato, /al massimo.*14,90/.test(oltre.json.messaggio ?? ""), POSTrimborsi(m).length, tab(m, "shop_rimborsi").length]);
    const resto = await posta(m, rimb(1490, K3));
    await riconcilia(m);
    c("il resto (1490) passa: ordine «rimborsato» per intero", [200, "rimborsato", 2490, 2], [resto.stato, ord(m).stato_pagamento, ord(m).rimborsato_cent, POSTrimborsi(m).length]);
  }

  // ── doppio clic: una sola chiamata, una sola riga ──
  {
    const m = await mondo();
    const [a, b] = await Promise.all([posta(m, rimb(1000, K1)), posta(m, rimb(1000, K1))]);
    c("doppio clic INSIEME (stessa chiave): UNA riga e UNA chiamata a Stripe", [1, 1], [tab(m, "shop_rimborsi").length, POSTrimborsi(m).length]);
    c("…e nessuna delle due risposte è un errore: la seconda dice che è già in corso", [true, true, true], [a.json.ok, b.json.ok, [a, b].some((x) => x.json.effetti?.[0]?.esito === "in_corso")]);
    const terza = await posta(m, rimb(1000, K1));
    c("terzo clic dopo (stessa chiave): ancora una chiamata sola, e non è un errore", [true, 1, 1], [terza.json.ok, tab(m, "shop_rimborsi").length, POSTrimborsi(m).length]);
    // un rimborso totale ripetuto con la stessa chiave: non diventa «niente da rimborsare»
    const t = await mondo();
    await posta(t, rimb(2490, K1));
    const ripetuta = await posta(t, rimb(2490, K1));
    c("rimborso TOTALE ripetuto con la stessa chiave: risposta uguale alla prima (non «niente da rimborsare»), una sola chiamata", [200, true, 1], [ripetuta.stato, ripetuta.json.ok, POSTrimborsi(t).length]);
    // la stessa chiave di un altro ordine
    const altro = await mondo();
    tab(altro, "shop_rimborsi").push({ id: uuid(0xb7), ordine_id: uuid(9), importo_cent: 100, motivo: "x", stato: "riuscito", chiave_richiesta: K2, stripe_rimborso_id: "re_x", origine: "crm", chi: "x", creato_il: ADESSO, aggiornato_il: ADESSO });
    const ra = await posta(altro, rimb(500, K2));
    c("la chiave di un ALTRO ordine → rifiutata, nessuna chiamata", [false, 0], [ra.json.ok, POSTrimborsi(altro).length]);
  }

  // ── due richieste diverse che insieme superano il pagato: una sola passa ──
  {
    const m = await mondo();
    const [a, b] = await Promise.all([posta(m, rimb(1500, K1)), posta(m, rimb(1500, K2))]);
    c("1500 + 1500 su 2490 insieme: UNA sola passa, UNA chiamata a Stripe, UNA riga", [1, 1, 1, 1], [[a, b].filter((x) => x.json.ok).length, [a, b].filter((x) => !x.json.ok).length, POSTrimborsi(m).length, tab(m, "shop_rimborsi").length]);
    const rifiutata = [a, b].find((x) => !x.json.ok);
    c("…quella rifiutata dice perché (oltre il pagato) e non ripete dati del cliente", [true, false], [/supera|pagat/i.test(rifiutata?.json.messaggio ?? ""), PERSONALI.some((s) => JSON.stringify(rifiutata?.json).includes(s))]);
  }

  // ── Stripe rifiuta: riga `fallito`, importo di nuovo disponibile; Stripe non risponde: riga `richiesto` ──
  {
    const m = await mondo();
    m.stripe.fallisci("POST /v1/refunds", { stato: 400, errore: { type: "invalid_request_error", code: "charge_already_refunded" } });
    const r = await posta(m, rimb(1000, K1));
    c("Stripe rifiuta il rimborso: risposta d'errore con la frase, riga `fallito`", [false, "fallito", 1], [r.json.ok, tab(m, "shop_rimborsi")[0]?.stato, POSTrimborsi(m).length]);
    c("…chiusa con `shop_rimborso_rifiuta` (argomenti esatti: id della riga e codice di Stripe), senza id inventati e con UNA riga di storico «rimborso_rifiutato»", [[{ p_rimborso: tab(m, "shop_rimborsi")[0]?.id, p_codice: "charge_already_refunded" }], null, false, 1], [m.db.registro.filter((q) => q.nome === "shop_rimborso_rifiuta").map((q) => q.args), tab(m, "shop_rimborsi")[0]?.stripe_rimborso_id ?? null, JSON.stringify(m.db.registro).includes("non_creato"), tab(m, "shop_order_eventi").filter((e) => e.tipo === "rimborso_rifiutato").length]);
    c("…e la risposta e il log portano solo il codice di Stripe, mai il suo messaggio", [false, true], [JSON.stringify(r.json).includes("messaggio di Stripe"), r.log.some((l) => l.includes("charge_already_refunded")) && r.log.every((l) => /^[A-Za-z0-9 _.:-]{1,80}$/.test(l)) && !r.log.some((l) => l.includes("messaggio di Stripe"))]);
    const ripeti = await posta(m, rimb(1000, K1));
    c("la stessa chiave dopo un rifiuto: dice di ricaricare, nessuna nuova chiamata", [false, 1], [ripeti.json.ok, POSTrimborsi(m).length]);
    const nuova = await posta(m, rimb(2490, K2));
    c("l'importo è di nuovo disponibile: una richiesta nuova per tutto passa", [200, true, 2, "fallito"], [nuova.stato, nuova.json.ok, tab(m, "shop_rimborsi").length, tab(m, "shop_rimborsi")[0]?.stato]);
  }
  {
    const g = await mondo({ errori: { "rpc.shop_rimborso_rifiuta": { error: { code: "XX060", message: "dettaglio con Anna Esempio" } } } });
    g.stripe.fallisci("POST /v1/refunds", { stato: 402, errore: { type: "card_error", code: "card_declined" } });
    const rg = await posta(g, rimb(1000, K1));
    c("Stripe rifiuta ma la funzione di chiusura non risponde: errore onesto («resta aperta, usa Controlla con Stripe»), riga `richiesto`, solo codici nel log", [false, "richiesto", true, true, false], [rg.json.ok, tab(g, "shop_rimborsi")[0]?.stato, /Controlla con Stripe/.test(rg.json.messaggio ?? ""), rg.log.some((l) => l.includes("XX060")), JSON.stringify([rg.json, rg.log]).includes("Anna")]);
    const ignorato = await mondo({ tabelle: { shop_rimborsi: [{ id: uuid(0xb1), ordine_id: ID, importo_cent: 1000, motivo: "x", stato: "riuscito", stripe_rimborso_id: "re_x", chiave_richiesta: K3, origine: "crm", chi: "x", creato_il: ADESSO, aggiornato_il: ADESSO }] } });
    c("un `riuscito` non si tocca mai: la funzione dice `ignorato` e la riga resta com'è", ["ignorato", "riuscito"], await (async () => { const r = await ignorato.db.rpc("shop_rimborso_rifiuta", { p_rimborso: uuid(0xb1), p_codice: "x" }); return [r.data?.esito, tab(ignorato, "shop_rimborsi")[0].stato]; })());
  }
  {
    const m = await mondo();
    m.stripe.fallisci("POST /v1/refunds", { timeout: true });
    const r = await posta(m, rimb(1000, K1));
    c("Stripe non risponde (timeout): la riga RESTA `richiesto`, nessun «fallito», risposta ok che dice di non ripetere e di controllare", [200, true, "richiesto", "in_corso", true], [r.stato, r.json.ok, tab(m, "shop_rimborsi")[0]?.stato, r.json.effetti?.[0]?.esito, /Controlla con Stripe/i.test(r.json.effetti?.[0]?.frase ?? "")]);
    c("…e il massimo resta impegnato (un altro rimborso da 1491 è rifiutato)", false, (await posta(m, rimb(1491, K2))).json.ok);
    const subito = await posta(m, rimb(1000, K1));
    c("la stessa chiave subito dopo (riga di pochi secondi): NESSUNA nuova chiamata, nemmeno la lettura dell'elenco", [1, 0], [POSTrimborsi(m).length, GETrimborsi(m).length]);
    // passati 5 minuti: prima si LEGGE l'elenco di Stripe, poi si riprova con la stessa chiave di idempotenza
    const tardi = await posta(m, rimb(1000, K1), { adesso: CINQUE_MINUTI });
    c("dopo 5 minuti: si legge PRIMA l'elenco di Stripe, poi si ripete con la stessa chiave di idempotenza", [true, 1, 2, true], [tardi.json.ok, GETrimborsi(m).length, POSTrimborsi(m).length, POSTrimborsi(m)[0]?.chiaveIdempotenza === POSTrimborsi(m)[1]?.chiaveIdempotenza && POSTrimborsi(m)[1]?.chiaveIdempotenza === tab(m, "shop_rimborsi")[0]?.id]);
    c("…e la riga è ancora una sola", 1, tab(m, "shop_rimborsi").length);
    const ancora = await posta(m, rimb(1000, K1), { adesso: CINQUE_MINUTI });
    c("ancora dopo: l'elenco di Stripe ha già il rimborso → nessuna terza chiamata a creare, e la riga si aggiorna", [2, true], [POSTrimborsi(m).length, /^re_/.test(tab(m, "shop_rimborsi")[0]?.stripe_rimborso_id ?? "") || ancora.json.ok]);
  }
  {
    // il rimborso c'era già su Stripe (la risposta si è persa): non se ne crea un secondo
    const m = await mondo({ tabelle: { shop_rimborsi: [{ id: uuid(0xb1), ordine_id: ID, importo_cent: 1000, motivo: "Prodotto rovinato", stato: "richiesto", stripe_rimborso_id: null, chiave_richiesta: K1, origine: "crm", chi: "Giulia Esempio", creato_il: "2026-11-20T11:00:00.000Z", aggiornato_il: "2026-11-20T11:00:00.000Z" }] } });
    await m.client.creaRimborso({ payment_intent: m.pi, amount: 1000, metadata: { riga_id: uuid(0xb1) } }, uuid(0xb1));
    m.stripe.azzera();
    const r = await posta(m, rimb(1000, K1), { adesso: CINQUE_MINUTI });
    c("riga `richiesto` vecchia, rimborso già su Stripe (metadata riga_id): si legge l'elenco, NON si crea un secondo rimborso", [true, 0, 1], [r.json.ok, POSTrimborsi(m).length, GETrimborsi(m).length]);
    c("…e la riga prende l'id di Stripe e lo stato che Stripe dice (via funzione SQL)", ["riuscito", true], [tab(m, "shop_rimborsi")[0]?.stato, /^re_/.test(tab(m, "shop_rimborsi")[0]?.stripe_rimborso_id ?? "")]);
  }

  // ── «Controlla con Stripe»: le righe rimaste `richiesto` ──
  {
    const riga = (id, creato) => ({ id, ordine_id: ID, importo_cent: 1000, motivo: "Prodotto rovinato", stato: "richiesto", stripe_rimborso_id: null, chiave_richiesta: id, origine: "crm", chi: "x", creato_il: creato, aggiornato_il: creato });
    const m = await mondo({ tabelle: { shop_rimborsi: [riga(uuid(0xb1), VENTI_MINUTI_FA), riga(uuid(0xb2), CINQUE_MINUTI_FA)] } });
    const prima = await posta(m, rimb(1491, K3));
    const r = await riconcilia(m);
    const righe = Object.fromEntries(tab(m, "shop_rimborsi").map((x) => [x.id, x.stato]));
    c("riconcilia: la riga `richiesto` che Stripe non conosce da oltre 10 minuti diventa `fallito`; quella di 5 minuti resta", [200, "fallito", "richiesto"], [r.stato, righe[uuid(0xb1)], righe[uuid(0xb2)]]);
    const dopo = await posta(m, rimb(1490, K3));
    c("…e il massimo si libera (prima 1491 non passava, ora 1490 sì)", [false, true], [prima.json.ok, dopo.json.ok]);
    // un rimborso fatto dal pannello di Stripe compare nel CRM
    const p = await mondo();
    p.stripe.rimborsaDalPannello(p.pi, 500);
    await riconcilia(p);
    const rr = tab(p, "shop_rimborsi")[0];
    c("un rimborso fatto dal pannello di Stripe compare nel CRM (origine stripe) e l'ordine segue", [1, "stripe", 500, "riuscito", "rimborsato_in_parte", 500], [tab(p, "shop_rimborsi").length, rr?.origine, rr?.importo_cent, rr?.stato, ord(p).stato_pagamento, ord(p).rimborsato_cent]);
  }

  // ── annulla ──
  {
    const m = await mondo({ ordineExtra: { giacenza_scalata_il: ADESSO }, tabelle: { shop_giacenza_movimenti: MOVIMENTI_SOLO_A() } });
    await posta(m, rimb(1000, K1));
    await riconcilia(m);
    m.stripe.azzera();
    const r = await posta(m, { azione: "annulla", ordineId: ID, motivo: "Il cliente ha cambiato idea", rimborso: "ora", rimettiInMagazzino: true, chiaveRichiesta: K2 });
    const o = ord(m);
    c("annulla un ordine pagato con «rimborsa ora»: annullato, motivo, data; rimborso del RESIDUO (1490) richiesto a Stripe", [200, "annullato", "Il cliente ha cambiato idea", ADESSO, ["1490"], 2], [r.stato, o.status, o.annullo_motivo, o.annullato_il, POSTrimborsi(m).map((x) => String(x.corpo.amount)), tab(m, "shop_rimborsi").length]);
    c("annulla con «rimetti in magazzino»: `giacenza_rimessa_il` e UN movimento «annullo_ordine» solo per la riga che i movimenti dicono scalata (A × 2), nessuna scorta fantasma per la B", [ADESSO, [["SKU-A", 10], ["SKU-B", 5]], [[uuid(0x7100), 2]]], [o.giacenza_rimessa_il, tab(m, "shop_varianti").map((v) => [v.sku, v.giacenza]), tab(m, "shop_giacenza_movimenti").filter((x) => x.motivo === "annullo_ordine").map((x) => [x.variante_id, x.delta])]);
    c("annulla: l'evento «annullato» ha il motivo, la scelta sul rimborso e sul magazzino, e chi l'ha fatto", ["annullato", "Il cliente ha cambiato idea", "ora", true, "Giulia Esempio"], (() => { const e = tab(m, "shop_order_eventi").find((x) => x.tipo === "annullato"); return [e?.tipo, e?.dopo?.motivo, e?.dopo?.rimborso, e?.dopo?.rimetti_in_magazzino, e?.chi]; })());
    c("annulla: la risposta elenca ciò che è stato fatto (rimborso richiesto, magazzino rimesso)", [["rimborso", "fatto"], ["giacenza_rimetti", "fatto"]], (r.json.effetti ?? []).filter((e) => ["rimborso", "giacenza_rimetti"].includes(e.tipo)).map((e) => [e.tipo, e.esito]));
    c("l'annullo non scrive «rimborsato»: lo stato del pagamento lo dirà Stripe", ["rimborsato_in_parte", 1000], [o.stato_pagamento, o.rimborsato_cent]);
    const di_nuovo = await posta(m, { azione: "annulla", ordineId: ID, motivo: "Ancora", rimborso: "ora", rimettiInMagazzino: true, chiaveRichiesta: K3 });
    c("annulla due volte: la seconda non rifà niente (nessun rimborso, nessun movimento in più)", [false, 1, 1], [di_nuovo.json.ok, POSTrimborsi(m).length, tab(m, "shop_giacenza_movimenti").filter((x) => x.motivo === "annullo_ordine").length]);
  }
  {
    const m = await mondo({ tabelle: { shop_giacenza_movimenti: MOVIMENTI_SOLO_A() } });
    const senza = await posta(m, { azione: "annulla", ordineId: ID, rimborso: "nessuno", rimettiInMagazzino: false });
    c("annulla senza motivo → rifiutato (anche con «nessun rimborso»)", [400, "nuovo", 0], [senza.stato, ord(m).status, m.stripe.chiamate.length]);
    const r = await posta(m, { azione: "annulla", ordineId: ID, motivo: "Pagamento duplicato, rimborsato dal pannello", rimborso: "nessuno", rimettiInMagazzino: false });
    const e = tab(m, "shop_order_eventi").find((x) => x.tipo === "annullato");
    c("annulla con «nessun rimborso dovuto»: annullato, NESSUN rimborso, nessuna chiamata a Stripe, motivo nello storico", [200, "annullato", 0, 0, "Pagamento duplicato, rimborsato dal pannello", "nessuno", null], [r.stato, ord(m).status, m.stripe.chiamate.length, tab(m, "shop_rimborsi").length, e?.dopo?.motivo, e?.dopo?.rimborso, ord(m).giacenza_rimessa_il]);
    c("…e senza «rimetti in magazzino» la giacenza non si tocca", [8, 5], tab(m, "shop_varianti").map((v) => v.giacenza));
  }
  {
    const m = await mondo({ pagata: false });
    const r = await posta(m, { azione: "annulla", ordineId: ID, motivo: "Il cliente non ha pagato" });
    c("annulla un ordine IN ATTESA: annullato e la sessione su Stripe si fa SCADERE (una chiamata), nessun rimborso", [200, "annullato", 1, "expired", 0], [r.stato, ord(m).status, m.stripe.chiamateA("POST", `/v1/checkout/sessions/${m.sessione}/expire`).length, m.stripe.sessione(m.sessione).status, POSTrimborsi(m).length]);
    const g = await mondo({ pagata: false });
    g.stripe.fallisci(`POST /v1/checkout/sessions/${g.sessione}/expire`, { timeout: true });
    const rg = await posta(g, { azione: "annulla", ordineId: ID, motivo: "Il cliente non ha pagato" });
    c("annulla un ordine in attesa con Stripe che non risponde: l'ordine è annullato lo stesso e la risposta avverte della sessione", [200, "annullato", "non_riuscito", true], [rg.stato, ord(g).status, rg.json.effetti?.find((e) => e.tipo === "scadi_sessione")?.esito, /sessione/i.test(rg.json.effetti?.find((e) => e.tipo === "scadi_sessione")?.frase ?? "")]);
  }

  // ── riconcilia: pagato, non pagato, avvisi ──
  {
    const m = await mondo({ pagata: true, statoSessione: "aperta", ordineExtra: { stato_pagamento: "in_attesa", pagato_il: null, pagato_importo: null, metodo_pagamento: null, stripe_pagamento_id: null, scade_il: "2026-11-20T13:00:00.000Z" } });
    const r = await riconcilia(m, { email: true });
    const o = ord(m);
    c("riconcilia con Stripe `paid`: ordine pagato (importo, metodo «stripe», pagamento di Stripe), giacenza scesa, riga di storico", [200, "pagato", 24.9, "stripe", m.pi, [["SKU-A", 6], ["SKU-B", 4]], true], [r.stato, o.stato_pagamento, o.pagato_importo, o.metodo_pagamento, o.stripe_pagamento_id, tab(m, "shop_varianti").map((v) => [v.sku, v.giacenza]), tab(m, "shop_order_eventi").some((e) => e.tipo === "pagato")]);
    c("…e il metodo di pagamento si legge da Stripe (best effort)", "card", o.metodo_dettaglio);
    c("…e parte la conferma (non manuale): la guardia contro i doppi invii è del database, qui si chiama e basta", [["conferma_ordine", ID, { manuale: false }]], r.chiamateEmail);
    const ancora = await riconcilia(m, { email: true });
    c("riconcilia due volte: stessa funzione, idempotente — una sola scalatura", [200, [["SKU-A", 6], ["SKU-B", 4]], 1], [ancora.stato, tab(m, "shop_varianti").map((v) => [v.sku, v.giacenza]), tab(m, "shop_giacenza_movimenti").filter((x) => x.variante_id === uuid(0x7100)).length]);
  }
  {
    const m = await mondo({ pagata: false, ordineExtra: { stato_pagamento: "in_attesa" } });
    const r = await riconcilia(m, { email: true });
    c("riconcilia con Stripe `unpaid`: nessun cambio, `shop_ordine_pagato` non si chiama, nessuna email", [200, "in_attesa", [], 0], [r.stato, ord(m).stato_pagamento, m.db.registro.filter((q) => q.nome === "shop_ordine_pagato").map((q) => q.nome), r.chiamateEmail.length]);
    c("…e la risposta dice com'è (non pagato), senza fingere", true, /non è ancora pagat/i.test(JSON.stringify(r.json.effetti ?? [])));
  }
  {
    const m = await mondo({ statoSessione: "scaduta", ordineExtra: { stato_pagamento: "scaduto", pagato_il: null, pagato_importo: null, metodo_pagamento: null, stripe_pagamento_id: null } });
    const r = await riconcilia(m);
    c("riconcilia di un ordine SCADUTO che Stripe dice pagato: pagato e l'avviso «dopo la scadenza» si vede nella risposta", [200, "pagato", true], [r.stato, ord(m).stato_pagamento, (r.json.avvisi ?? []).some((a) => /dopo la scadenza/i.test(a))]);
    const d = await mondo({ statoSessione: "aperta", ordineExtra: { stato_pagamento: "in_attesa", pagato_il: null, pagato_importo: null, metodo_pagamento: null, stripe_pagamento_id: null, totale_cent: 2400 } });
    const rd = await riconcilia(d);
    c("riconcilia con un importo diverso dal totale: l'ordine NON diventa pagato e l'avviso si vede", [200, "in_attesa", true], [rd.stato, ord(d).stato_pagamento, (rd.json.avvisi ?? []).some((a) => /importo diverso/i.test(a))]);
  }
  {
    const m = await mondo({ statoSessione: "aperta", ordineExtra: { stato_pagamento: "in_attesa", pagato_il: null, pagato_importo: null, metodo_pagamento: null, stripe_pagamento_id: null } });
    m.stripe.fallisci(`GET /v1/checkout/sessions/${m.sessione}`, { rete: true });
    const r = await riconcilia(m);
    c("riconcilia con Stripe irraggiungibile: errore con la frase, ordine com'era, log col solo codice", [false, "in_attesa", true], [r.json.ok, ord(m).stato_pagamento, r.log.length > 0 && r.log.every((l) => /^[A-Za-z0-9 _.:-]{1,80}$/.test(l))]);
    const vec = await mondo();
    tab(vec, "shop_orders")[0].stato_pagamento = null;
    const rv = await riconcilia(vec);
    c("riconcilia su un ordine di prima (colonna vuota) → rifiutato, nessuna chiamata a Stripe", [400, 0], [rv.stato, vec.stripe.chiamate.length]);
  }

  // ── il registro: cosa scrive e cosa no questo gestore ──
  {
    const m = await mondo({ ordineExtra: { giacenza_scalata_il: ADESSO }, tabelle: { shop_giacenza_movimenti: MOVIMENTI_SOLO_A() } });
    await posta(m, rimb(1000, K1));
    await riconcilia(m);
    await posta(m, { azione: "annulla", ordineId: ID, motivo: "Il cliente ha cambiato idea", rimborso: "ora", rimettiInMagazzino: true, chiaveRichiesta: K2 });
    await riconcilia(m);
    const scritture = m.db.registro.filter((q) => q.op !== "select");
    const rpc = [...new Set(scritture.filter((q) => q.op === "rpc").map((q) => q.nome))].sort();
    c("il gestore scrive solo con le funzioni SQL previste (prenota, riconcilia, rimetti) — mai direttamente `shop_rimborsi`", [["shop_ordine_giacenza_rimetti", "shop_rimborso_prenota", "shop_rimborso_riconcilia"], 0], [rpc, scritture.filter((q) => q.tab === "shop_rimborsi").length]);
    const direttiOrdini = scritture.filter((q) => q.tab === "shop_orders");
    const chiavi = [...new Set(direttiOrdini.flatMap((q) => Object.keys(q.patch ?? {})))].sort();
    c("sull'ordine il gestore scrive solo stato di evasione e annullo: mai `stato_pagamento`, `rimborsato_cent`, `pagato_*`", [], chiavi.filter((k) => ["stato_pagamento", "rimborsato_cent", "pagato_il", "pagato_importo", "metodo_pagamento"].includes(k)));
    c("lo stato «rimborsato» compare nell'ordine solo dopo `shop_rimborso_riconcilia`, mai per mano della rotta", [], direttiOrdini.filter((q) => JSON.stringify(q.patch ?? {}).includes("rimborsat")).map((q) => q.patch));
    c("mai `delete`", 0, scritture.filter((q) => q.op === "delete").length);
    const tuttiILog = [];
    // i log di una corsa intera: solo codici
    for (const corpo of [rimb(100, uuid(0xd1)), { azione: "riconcilia", ordineId: ID }]) tuttiILog.push(...(await posta(await mondo({ errori: { "shop_rimborsi.select": { error: { code: "XX050", details: `riga ${PERSONALI.join(" ")}` } } } }), corpo)).log);
    c("log: solo codici, nessun dato del cliente, nessuna chiave", [true, false], [tuttiILog.every((l) => /^[A-Za-z0-9 _.:-]{1,80}$/.test(l)), tuttiILog.some((l) => PERSONALI.some((p) => l.includes(p)) || /sk_|Bearer/.test(l))]);
  }
}
