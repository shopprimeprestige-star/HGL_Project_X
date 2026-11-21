/** ── NEGOZIO · RILASCIO 2 · T52 · IL WEBHOOK DI STRIPE: IL SERVER ─────────────────────────────────────
 *  `src/shop/cassa/webhook.server.ts` (PIANO-R2 D44, D45, D46, §3.2): `gestisciWebhook(richiesta, porte)` → `Response`.
 *  Finto database (con la logica del SQL di S4/S6), Stripe finto, email finta: nessuna rete, nessuna chiave vera, dati inventati.
 *   · PRIMA di tutto la firma, sui BYTE del corpo (`verificaFirma` di T44); il tetto di 1 MB si controlla prima di leggere (413);
 *     firma sbagliata/vecchia/futura/assente → 400 e NESSUNA chiamata al database; segreto mancante → 503 (mai accettare senza firma);
 *   · «pagato» nasce solo da `shop_ordine_pagato` (importo, valuta, sessione, giacenza stanno nel database): qui si provano gli effetti;
 *   · idempotenza per evento (`shop_stripe_evento_registra`/`chiudi`); un evento registrato e mai chiuso (crash) si rielabora;
 *   · la lettura del metodo e l'email partono DOPO la risposta (`dopoRisposta`), mai un errore verso Stripe se falliscono;
 *   · nei log solo codici (un log finto che riceve tutto e viene frugato alla ricerca di dati del cliente). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { partenzaDa, eventoStripeProva } from "./_dati-r2.mjs";
import { stripeFinto, eventoFirmato, firmaStripe, CHIAVE_PROVA, SEGRETO_PROVA, T0 } from "./_stripe-finto.mjs";
import { uuid } from "./dati.mjs";

const ADESSO_MS = T0 * 1000; // 20/11/2026 12:00:00 UTC: lo stesso istante del finto database
const ORD = uuid(0x6001);
const ORD2 = uuid(0x6002);
const EMAIL_CLIENTE = "cliente0@example.com";

/** Il database finto con le due funzioni «aiuto» di S4 (`shop_s4_avviso`, `shop_s4_evento`), che il finto di T40 non conosce ancora:
 *  stessa logica del SQL (lo stesso avviso con lo stesso riferimento non si scrive due volte). Chiesto in Lavagna: quando il finto le avrà, questa riga sparisce. */
function conAvvisi(db) {
  const w = Object.create(db);
  w.rpc = (nome, args = {}) => {
    if (nome !== "shop_s4_avviso" && nome !== "shop_s4_evento") return db.rpc(nome, args);
    db.registro.push({ chiave: `rpc.${nome}`, tab: null, op: "rpc", nome, args, scrisse: true });
    const o = db.tabelle.shop_orders.find((x) => x.id === args.p_ordine);
    if (o && nome === "shop_s4_avviso") {
      const lista = Array.isArray(o.avvisi) ? o.avvisi : [];
      if (!lista.some((x) => x.codice === args.p_codice && (x.rif ?? null) === (args.p_rif ?? null))) o.avvisi = [...lista, { codice: args.p_codice, gravita: args.p_gravita, rif: args.p_rif ?? null, il: "2026-11-20T12:00:00.000Z" }];
    }
    if (o && nome === "shop_s4_evento") (db.tabelle.shop_order_eventi ??= []).push({ order_id: o.id, order_ref: o.order_ref, tipo: args.p_tipo, chi: args.p_chi, prima: args.p_prima, dopo: args.p_dopo });
    return Promise.resolve({ data: null, error: null });
  };
  return w;
}

export async function prove(mod, { c, gruppo, radice }) {
  const W = mod["shop/cassa/webhook.server"];
  const K = mod["shop/stripe/client"];
  gruppo("SHOP R2 · T52 · IL WEBHOOK DI STRIPE, SERVER (21/11/2026)");
  c("il modulo src/shop/cassa/webhook.server.ts esiste", true, !!W);
  if (!W) return;

  /** Una sessione di Stripe finta (aperta) per l'ordine: l'id che il finto dà. */
  async function sessioneStripe(stripe, ordine, importo) {
    const r = await stripe.fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${CHIAVE_PROVA}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: K.codificaForm({ mode: "payment", success_url: "https://sito.test/ok", client_reference_id: ordine, line_items: [{ price_data: { unit_amount: importo }, quantity: 1 }] }),
    });
    return (await r.json()).id;
  }

  /** L'email finta, come la scriverà T54: la guardia `shop_email_prenota` è del database, l'invio è un conto. `cancello` ferma l'invio finché non si apre. */
  function emailFinta(db, { cancello = null, rompi = false } = {}) {
    const chiamate = [];
    const inviate = [];
    return {
      chiamate,
      inviate,
      porta: {
        async invia(chiave, ordineId, opzioni) {
          chiamate.push([chiave, ordineId, opzioni]);
          if (rompi) throw new Error(`invio fallito per ${EMAIL_CLIENTE}`);
          const { data: prenotata } = await db.rpc("shop_email_prenota", { p_ordine: ordineId, p_chiave: chiave });
          if (!prenotata) return { stato: "inviata" };
          if (cancello) await cancello;
          inviate.push(chiave);
          await db.rpc("shop_email_esito", { p_ordine: ordineId, p_chiave: chiave, p_stato: "inviata", p_codice: null });
          return { stato: "inviata" };
        },
      },
    };
  }

  /**
   * Un mondo: finto database, Stripe finto e le porte del webhook.
   * @param {object} [o]
   * @param {number} [o.sessioni]  quante sessioni ha l'ordine (l'ultima è la corrente)
   * @param {number} [o.importo]  il totale in centesimi (anche quello delle sessioni di Stripe)
   * @param {object[]} [o.varianti]
   * @param {object[]} [o.righe]
   * @param {object} [o.campi]  colonne dell'ordine
   * @param {object} [o.dbOpzioni]  opzioni del finto database (`errori`, `senzaColonne`…)
   * @param {string|null} [o.segreto]
   */
  async function mondo({ sessioni = 1, importo = 2890, varianti = [{ sku: "SKU-1", giacenza: 5 }], righe = [{ sku: "SKU-1", qty: 2, prezzo_cent: 1000 }], campi = {}, dbOpzioni = {}, segreto = SEGRETO_PROVA, cancello = null, emailRotta = false, ordini2 = false } = {}) {
    const stripe = stripeFinto();
    const ids = [];
    for (let i = 0; i < sessioni; i++) ids.push(await sessioneStripe(stripe, ORD, importo));
    const spec = { varianti, ordini: [{ id: ORD, ref: "HG-AAAAAA", totale_cent: importo, righe, sessioni: ids, campi: { prova: true, ...campi } }] };
    if (ordini2) spec.ordini.push({ id: ORD2, ref: "HG-BBBBBB", totale_cent: importo, righe: [{ sku: "SKU-1", qty: 1, prezzo_cent: importo }], sessioni: [await sessioneStripe(stripe, ORD2, importo)], campi: { prova: true } });
    const db = conAvvisi(fintoDb({ tabelle: partenzaDa(spec), ...dbOpzioni }));
    const email = emailFinta(db, { cancello, rompi: emailRotta });
    const piOrdine = new Map(); // payment_intent → ordine: i metadati del pagamento (il finto non li ha)
    const fetchStripe = async (url, init) => {
      const r = await stripe.fetch(url, init);
      const m = /\/v1\/payment_intents\/([^/?]+)/.exec(String(url));
      if (!m || !piOrdine.has(m[1]) || !r.ok) return r;
      const j = await r.json();
      return new Response(JSON.stringify({ ...j, metadata: { ordine_id: piOrdine.get(m[1]) } }), { status: r.status, headers: r.headers });
    };
    const log = [];
    const dopo = [];
    const porte = {
      db,
      stripe: K.creaClientStripe({ chiave: CHIAVE_PROVA, fetch: fetchStripe }),
      segreto: () => segreto,
      adesso: () => ADESSO_MS,
      log: (x) => log.push(x),
      email: email.porta,
      dopoRisposta: (p) => { dopo.push(p); },
    };
    const m = {
      db, stripe, email, log, porte, sessioni: ids, dopo,
      /** Il cliente paga la sessione `i`; il pagamento ha per metadato l'ordine. */
      paga(i = 0, opz) { const s = stripe.paga(ids[i], opz); piOrdine.set(s.payment_intent, ORD); return s; },
      /** Manda un evento firmato al webhook. */
      async vai(evento, { t = T0, segretoFirma = SEGRETO_PROVA, bom = false, porteExtra = {} } = {}) {
        const { corpo, intestazione } = await eventoFirmato(evento, { segreto: segretoFirma, t, bom });
        return m.vaiGrezzo(corpo, intestazione, porteExtra);
      },
      async vaiGrezzo(corpo, intestazione, porteExtra = {}) {
        const richiesta = new Request("https://sito.test/api/public/stripe-webhook", { method: "POST", body: corpo, headers: intestazione === null ? {} : { "stripe-signature": intestazione } });
        const r = await W.gestisciWebhook(richiesta, { ...porte, ...porteExtra });
        return { stato: r.status, corpo: await r.text() };
      },
      /** Aspetta il lavoro «dopo la risposta» (metodo, email). */
      async finisci() { await Promise.allSettled(dopo); },
      ordine: (id = ORD) => db.tabelle.shop_orders.find((o) => o.id === id),
      movimenti: () => (db.tabelle.shop_giacenza_movimenti ?? []).filter((x) => x.motivo === "ordine"),
      giacenza: (sku = "SKU-1") => db.tabelle.shop_varianti.find((v) => v.sku === sku).giacenza,
      avvisi: (id = ORD) => (m.ordine(id).avvisi ?? []).map((a) => a.codice),
      eventi: (tipo) => (db.tabelle.shop_order_eventi ?? []).filter((e) => e.tipo === tipo),
      chiamateRpc: (nome) => db.registro.filter((q) => q.nome === nome),
    };
    return m;
  }

  /** Un evento di sessione nella forma di Stripe. */
  const evSessione = (tipo, { id = "evt_p0001", sessione, pi = null, ordine = ORD, importo = 2890, valuta = "eur", pagamento = "paid", livemode = false } = {}) =>
    eventoStripeProva(tipo, { id: sessione, object: "checkout.session", client_reference_id: ordine, payment_status: pagamento, payment_intent: pi, amount_total: importo, currency: valuta, metadata: { ordine_id: ordine } }, { id, livemode });
  const completato = (m, i = 0, extra = {}) => evSessione("checkout.session.completed", { sessione: m.sessioni[i], pi: m.stripe.sessione(m.sessioni[i]).payment_intent, ...extra });

  // ═══ 1 · FIRMA, SEGRETO, TETTO: prima di tutto, e senza toccare il database ═══
  {
    const m = await mondo();
    const s = m.paga();
    m.stripe.azzera(); // la preparazione (sessione, pagamento) non conta: da qui nessuna chiamata
    const ev = completato(m);
    const sbagliata = await m.vai(ev, { segretoFirma: ["whsec", "altro000000000000000"].join("_") });
    c("firma sbagliata → 400, corpo senza dettagli", [400, '{"ok":false}'], [sbagliata.stato, sbagliata.corpo]);
    c("…e NESSUNA chiamata al database né a Stripe", [0, 0], [m.db.chiamate, m.stripe.chiamate.length]);
    c("firma di 6 minuti fa → 400", 400, (await m.vai(ev, { t: T0 - 360 })).stato);
    c("`t` nel futuro oltre 5 minuti → 400", 400, (await m.vai(ev, { t: T0 + 360 })).stato);
    c("nessuna firma → 400", 400, (await m.vaiGrezzo(new TextEncoder().encode(JSON.stringify(ev)), null)).stato);
    c("intestazione senza v1 → 400", 400, (await m.vaiGrezzo(new TextEncoder().encode(JSON.stringify(ev)), `t=${T0}`)).stato);
    c("corpo toccato dopo la firma (un segno) → 400", 400, await (async () => {
      const { corpo, intestazione } = await eventoFirmato(ev);
      const t = corpo.slice(); t[t.length - 3] ^= 1;
      return (await m.vaiGrezzo(t, intestazione)).stato;
    })());
    c("tutti questi rifiuti: ancora nessuna chiamata al database", 0, m.db.chiamate);
    c("…e l'ordine non è cambiato", "in_attesa", m.ordine().stato_pagamento);
    const senza = await mondo({ segreto: null });
    senza.paga();
    c("segreto mancante → 503 (mai accettare senza firma)", 503, (await senza.vai(completato(senza))).stato);
    const vuoto = await mondo({ segreto: "" });
    vuoto.paga();
    c("segreto vuoto → 503, nessuna chiamata al database", [503, 0], [(await vuoto.vai(completato(vuoto))).stato, vuoto.db.chiamate]);
    void s;
  }
  {
    const m = await mondo();
    const grande = new Uint8Array(2 * 1024 * 1024);
    const r = await m.vaiGrezzo(grande, await firmaStripe(grande, SEGRETO_PROVA, T0));
    c("corpo di 2 MB → 413", 413, r.stato);
    c("…senza database e senza risposta con dettagli", [0, '{"ok":false}'], [m.db.chiamate, r.corpo]);
    // Content-Length dichiarato di 2 MB: si risponde SENZA leggere il corpo (il flusso non viene nemmeno toccato)
    let letto = false;
    const flusso = new ReadableStream({ pull(x) { letto = true; x.enqueue(new Uint8Array(10)); x.close(); } }, { highWaterMark: 0 }); // 0: si legge solo se qualcuno lo chiede
    const finta = new Request("https://sito.test/api/public/stripe-webhook", { method: "POST", body: flusso, duplex: "half", headers: { "content-length": String(2 * 1024 * 1024), "stripe-signature": `t=${T0},v1=00` } });
    const r2 = await W.gestisciWebhook(finta, m.porte);
    c("Content-Length di 2 MB → 413 senza leggere il corpo", [413, false], [r2.status, letto]);
    // senza Content-Length (flusso a pezzi): si smette di leggere appena si supera il tetto
    let pezzi = 0;
    const infinito = new ReadableStream({ pull(x) { pezzi++; x.enqueue(new Uint8Array(256 * 1024)); } });
    const r3 = await W.gestisciWebhook(new Request("https://sito.test/api/public/stripe-webhook", { method: "POST", body: infinito, duplex: "half", headers: { "stripe-signature": `t=${T0},v1=00` } }), m.porte);
    c("flusso senza Content-Length oltre il tetto → 413, e si smette di leggere (≤ 6 pezzi da 256 KB)", [413, true], [r3.status, pezzi <= 6]);
    const quasi = new Uint8Array(1024 * 1024);
    const r4 = await m.vaiGrezzo(quasi, await firmaStripe(quasi, SEGRETO_PROVA, T0));
    c("un corpo di esattamente 1 MB passa il tetto (poi la firma buona e il JSON no: 400)", 400, r4.stato);
  }

  // ═══ 2 · IL PAGAMENTO RIUSCITO: ordine pagato, giacenza, storico, metodo, email ═══
  {
    let apri;
    const cancello = new Promise((ok) => { apri = ok; });
    const m = await mondo({ cancello });
    const s = m.paga(0, { metodo: "paypal" });
    const ev = completato(m);
    // se il webhook aspettasse l'email (ferma al cancello) la risposta non arriverebbe: dopo mezzo secondo la prova lo dice invece di restare appesa
    const r = await Promise.race([m.vai(ev), new Promise((ok) => setTimeout(() => ok({ stato: "bloccato", corpo: "la risposta aspetta l'email" }), 500))]);
    const o = m.ordine();
    c("evento firmato giusto → 200", [200, '{"ok":true}'], [r.stato, r.corpo]);
    c("ordine pagato: stato, importo, metodo `stripe`, sessione e pagamento salvati", ["pagato", 28.9, "stripe", m.sessioni[0], s.payment_intent], [o.stato_pagamento, o.pagato_importo, o.metodo_pagamento, o.stripe_sessione_id, o.stripe_pagamento_id]);
    c("giacenza scesa di `qty` (5 → 3), una riga di movimento con il riferimento dell'ordine", [3, [[-2, "HG-AAAAAA"]]], [m.giacenza(), m.movimenti().map((x) => [x.delta, x.ordine_ref])]);
    c("una riga in `shop_order_eventi` («pagato»)", 1, m.eventi("pagato").length);
    c("`stripe_pagamento_id` passato a `shop_ordine_pagato` (salvato DENTRO la funzione, non dopo)", s.payment_intent, m.chiamateRpc("shop_ordine_pagato")[0].args.p_pagamento_id);
    c("l'importo e la valuta dell'evento arrivano alla funzione (in centesimi interi)", [2890, "eur"], [m.chiamateRpc("shop_ordine_pagato")[0].args.p_importo_cent, m.chiamateRpc("shop_ordine_pagato")[0].args.p_valuta]);
    // l'email e la lettura del metodo partono DOPO la risposta: la risposta è già tornata, l'invio è fermo al cancello
    await new Promise((ok) => setTimeout(ok, 5));
    c("DOPO la risposta: l'email è partita ma non ha finito (il webhook non l'ha aspettata)", [1, 0], [m.email.chiamate.length, m.email.inviate.length]);
    c("la conferma si chiede con `manuale:false`", [["conferma_ordine", ORD, { manuale: false }]], m.email.chiamate);
    apri();
    await m.finisci();
    c("una sola email inviata", ["conferma_ordine"], m.email.inviate);
    c("metodo letto da Stripe dopo la risposta (best effort) e salvato", "paypal", m.ordine().metodo_dettaglio);
    c("la lettura del metodo è UNA chiamata a Stripe", 1, m.stripe.chiamateA("GET", "/v1/payment_intents/").length);
    c("«pagato» solo con `shop_ordine_pagato`: l'unica scrittura diretta è il dettaglio del metodo", ["shop_orders.update:metodo_dettaglio"], m.db.registro.filter((q) => q.tab && q.op !== "select").map((q) => `${q.tab}.${q.op}:${Object.keys(q.patch ?? {})}`));
    c("la chiave di Stripe non è in nessun registro del finto", false, JSON.stringify(m.stripe.chiamate).includes(CHIAVE_PROVA));
  }

  // ═══ 3 · IDEMPOTENZA ═══
  {
    const m = await mondo();
    m.paga();
    const ev = completato(m);
    const a = await m.vai(ev);
    await m.finisci();
    const b = await m.vai(ev);
    await m.finisci();
    c("lo stesso evento due volte → 200 e 200", [200, 200], [a.stato, b.stato]);
    c("…una scalatura, una riga di giacenza, una riga di storico «pagato»", [3, 1, 1], [m.giacenza(), m.movimenti().length, m.eventi("pagato").length]);
    c("…una sola email (la seconda consegna non fa niente)", [1, 1], [m.email.chiamate.length, m.email.inviate.length]);
    c("…`shop_ordine_pagato` chiamata una volta sola", 1, m.chiamateRpc("shop_ordine_pagato").length);
    c("l'evento è registrato e chiuso, con il suo esito", ["pagato_ora", true], [m.db.tabelle.shop_stripe_eventi[0].esito, m.db.tabelle.shop_stripe_eventi[0].elaborato_il != null]);
  }
  {
    const m = await mondo();
    m.paga();
    const ev = completato(m);
    const [a, b] = await Promise.all([m.vai(ev), m.vai(ev)]);
    await m.finisci();
    c("due consegne IN PARALLELO dello stesso evento → entrambe 200", [200, 200], [a.stato, b.stato]);
    c("…una sola scalatura e una sola riga di storico", [3, 1, 1], [m.giacenza(), m.movimenti().length, m.eventi("pagato").length]);
    c("…e al massimo una email vera (la guardia sta nel database)", 1, m.email.inviate.length);
  }
  {
    // il crash fra il commit e la risposta: la chiusura dell'evento fallisce la prima volta → 500; Stripe ritenta → `da_rielaborare` → `gia_pagato`
    let volte = 0;
    const m = await mondo({ dbOpzioni: { errori: { "rpc.shop_stripe_evento_chiudi": () => (++volte === 1 ? { error: { code: "XX000", message: `boom ${EMAIL_CLIENTE}` } } : undefined) } } });
    m.paga();
    const ev = completato(m);
    const a = await m.vai(ev);
    await m.finisci();
    c("evento pagato ma non chiuso (guasto prima della risposta) → 500: Stripe ritenta", [500, 0], [a.stato, m.email.chiamate.length]);
    c("…l'ordine però è già pagato (il commit c'è stato)", "pagato", m.ordine().stato_pagamento);
    const b = await m.vai(ev);
    await m.finisci();
    c("il tentativo di Stripe: 200; l'ordine era già pagato (`gia_pagato`) ma la conferma PARTE comunque, una volta", [200, "gia_pagato", 1], [b.stato, m.db.tabelle.shop_stripe_eventi[0].esito, m.email.inviate.length]);
    c("…e nessuna seconda scalatura", [3, 1], [m.giacenza(), m.movimenti().length]);
    const terza = await m.vai(ev);
    await m.finisci();
    c("la terza consegna è già elaborata: niente di nuovo", [200, 1, 1], [terza.stato, m.email.chiamate.length, m.email.inviate.length]);
  }
  {
    // due eventi diversi per lo stesso pagamento (completed + async_payment_succeeded): la seconda è `gia_pagato`, l'email resta una
    const m = await mondo();
    m.paga();
    await m.vai(completato(m, 0, { id: "evt_p0001" }));
    await m.finisci();
    await m.vai(evSessione("checkout.session.async_payment_succeeded", { id: "evt_p0002", sessione: m.sessioni[0], pi: m.stripe.sessione(m.sessioni[0]).payment_intent }));
    await m.finisci();
    c("completed + async_payment_succeeded sullo stesso ordine: una scalatura", [3, 1], [m.giacenza(), m.movimenti().length]);
    c("…la conferma è stata chiesta due volte (la guardia è del database) ma inviata una", [2, 1], [m.email.chiamate.length, m.email.inviate.length]);
  }

  // ═══ 4 · IMPORTO, VALUTA, SESSIONE ═══
  {
    const m = await mondo();
    m.paga();
    const r = await m.vai(completato(m, 0, { importo: 2891 }));
    await m.finisci();
    c("importo diverso di un centesimo → 200, ordine NON pagato", [200, "in_attesa", null], [r.stato, m.ordine().stato_pagamento, m.ordine().pagato_il]);
    c("…avviso `importo_diverso` nel CRM, giacenza intatta, nessuna email", [["importo_diverso"], 5, 0], [m.avvisi(), m.giacenza(), m.email.chiamate.length]);
    const u = await mondo();
    u.paga();
    const r2 = await u.vai(completato(u, 0, { valuta: "usd" }));
    c("valuta `usd` → 200, non pagato, avviso `valuta_diversa`", [200, "in_attesa", ["valuta_diversa"]], [r2.stato, u.ordine().stato_pagamento, u.avvisi()]);
  }
  {
    const m = await mondo();
    m.paga();
    // una sessione che non è di nessun ordine nostro (stesso ordine nell'evento, sessione estranea)
    const estranea = await sessioneStripe(m.stripe, ORD, 2890);
    const r = await m.vai(evSessione("checkout.session.completed", { sessione: estranea, pi: m.stripe.paga(estranea).payment_intent }));
    await m.finisci();
    c("sessione dell'evento che NON è dell'ordine → 200, l'ordine non cambia", [200, "in_attesa", 5], [r.stato, m.ordine().stato_pagamento, m.giacenza()]);
    c("…si scrive l'avviso `sessione_sconosciuta` (non «nulla»), nessuna email", [["sessione_sconosciuta"], 0], [m.avvisi(), m.email.chiamate.length]);
  }
  {
    // sessione sostituita: la riprova ha aperto la seconda; il cliente paga la PRIMA
    const m = await mondo({ sessioni: 2 });
    m.paga(0);
    const r = await m.vai(completato(m, 0));
    await m.finisci();
    c("evento di una sessione SOSTITUITA (la riprova ne ha aperta un'altra) → ordine pagato regolarmente", [200, "pagato", 3], [r.stato, m.ordine().stato_pagamento, m.giacenza()]);
  }
  {
    // già pagato dalla sessione B, poi arriva il pagamento della A
    const m = await mondo({ sessioni: 2 });
    m.paga(1);
    m.paga(0);
    await m.vai(completato(m, 1, { id: "evt_p0001" }));
    await m.finisci();
    const r = await m.vai(completato(m, 0, { id: "evt_p0002" }));
    await m.finisci();
    c("già pagato dalla B, arriva il pagamento della A → 200", 200, r.stato);
    c("…avviso rosso `doppio_pagamento` (rimborso da proporre) e una riga di storico", [["doppio_pagamento"], "rosso", 1], [m.avvisi(), m.ordine().avvisi[0].gravita, m.eventi("doppio_pagamento").length]);
    c("…nessuna seconda scalatura, nessuna seconda email", [3, 1, 1], [m.giacenza(), m.movimenti().length, m.email.chiamate.length]);
    c("…l'esito registrato è `doppio_pagamento`", "doppio_pagamento", m.db.tabelle.shop_stripe_eventi[1].esito);
  }
  {
    const m = await mondo({ varianti: [{ sku: "SKU-1", giacenza: 1 }, { sku: "SKU-2", giacenza: 9 }], righe: [{ sku: "SKU-1", qty: 2, prezzo_cent: 500 }, { sku: "SKU-2", qty: 1, prezzo_cent: 1890 }] });
    m.paga();
    const r = await m.vai(completato(m));
    await m.finisci();
    c("giacenza insufficiente su una riga → ordine pagato lo stesso, `giacenza_da_verificare`", [200, "pagato", true], [r.stato, m.ordine().stato_pagamento, m.ordine().giacenza_da_verificare]);
    c("…la riga che non basta non si scala, l'altra sì; la conferma parte", [1, 8, 1], [m.giacenza("SKU-1"), m.giacenza("SKU-2"), m.email.inviate.length]);
  }
  {
    const m = await mondo();
    m.paga();
    const r = await m.vai(completato(m, 0, { ordine: uuid(0x6999) }));
    c("ordine non trovato → 200 (non si fa ritentare per sempre), niente scritto sull'ordine", [200, "in_attesa"], [r.stato, m.ordine().stato_pagamento]);
    const prima = m.db.chiamate;
    const fuori = await m.vai(completato(m, 0, { id: "evt_p0009", ordine: "non-e-un-uuid" }));
    c("client_reference_id che non è un id nostro (altro uso dell'account Stripe) → 200 e il database non viene toccato", [200, 0], [fuori.stato, m.db.chiamate - prima]);
  }

  // ═══ 5 · PAGAMENTO RITARDATO, FALLITO, SCADUTO ═══
  {
    const m = await mondo();
    m.paga();
    const r = await m.vai(completato(m, 0, { pagamento: "unpaid" }));
    await m.finisci();
    c("`payment_status:unpaid` → resta `in_attesa`, giacenza intatta, nessuna email", [200, "in_attesa", 5, 0], [r.stato, m.ordine().stato_pagamento, m.giacenza(), m.email.chiamate.length]);
    c("…una riga di storico «pagamento_in_corso»", 1, m.eventi("pagamento_in_corso").length);
    const s = await m.vai(evSessione("checkout.session.async_payment_succeeded", { id: "evt_p0002", sessione: m.sessioni[0], pi: m.stripe.sessione(m.sessioni[0]).payment_intent }));
    await m.finisci();
    c("`async_payment_succeeded` poi paga", [200, "pagato", 3, 1], [s.stato, m.ordine().stato_pagamento, m.giacenza(), m.email.inviate.length]);
  }
  {
    const m = await mondo();
    const r = await m.vai(evSessione("checkout.session.async_payment_failed", { sessione: m.sessioni[0], pagamento: "unpaid" }));
    await m.finisci();
    c("`async_payment_failed` → ordine `fallito`", [200, "fallito"], [r.stato, m.ordine().stato_pagamento]);
    c("E3: con l'email dell'ordine, UNA sola email `pagamento_non_riuscito`", [[["pagamento_non_riuscito", ORD, { manuale: false }]], ["pagamento_non_riuscito"]], [m.email.chiamate, m.email.inviate]);
    const ancora = await m.vai(evSessione("checkout.session.async_payment_failed", { id: "evt_p0002", sessione: m.sessioni[0], pagamento: "unpaid" }));
    await m.finisci();
    c("…una seconda consegna (altro evento) su un ordine già fallito non rimanda niente", [200, 1], [ancora.stato, m.email.chiamate.length]);
  }
  {
    const m = await mondo({ campi: { email: "" } });
    await m.vai(evSessione("checkout.session.async_payment_failed", { sessione: m.sessioni[0], pagamento: "unpaid" }));
    await m.finisci();
    c("E3: senza email dell'ordine → `fallito` ma nessun invio", ["fallito", 0], [m.ordine().stato_pagamento, m.email.chiamate.length]);
  }
  {
    const m = await mondo();
    const r = await m.vai(evSessione("checkout.session.expired", { sessione: m.sessioni[0], pagamento: "unpaid" }));
    await m.finisci();
    c("`expired` → `scaduto`, e NON manda email", [200, "scaduto", 0], [r.stato, m.ordine().stato_pagamento, m.email.chiamate.length]);
    const p = await mondo();
    p.paga();
    await p.vai(completato(p));
    await p.finisci();
    const dopoPagato = await p.vai(evSessione("checkout.session.expired", { id: "evt_p0003", sessione: p.sessioni[0], pagamento: "unpaid" }));
    c("`expired` su un ordine già `pagato` → ignorato (resta pagato)", [200, "pagato"], [dopoPagato.stato, p.ordine().stato_pagamento]);
  }
  {
    // una sessione scaduta, ma già sostituita dalla riprova: l'ordine, riaperto, non si chiude
    const m = await mondo({ sessioni: 2 });
    await m.vai(evSessione("checkout.session.expired", { sessione: m.sessioni[0], pagamento: "unpaid" }));
    c("`expired` della sessione VECCHIA mentre la corrente è un'altra → l'ordine resta `in_attesa`", "in_attesa", m.ordine().stato_pagamento);
  }

  // ═══ 6 · PROVA E REALE ═══
  {
    const m = await mondo();
    m.paga();
    const r = await m.vai(completato(m, 0, { livemode: true }));
    await m.finisci();
    c("evento `livemode` diverso dall'ordine di prova → 200, l'ordine NON cambia", [200, "in_attesa", 5, 0], [r.stato, m.ordine().stato_pagamento, m.giacenza(), m.email.chiamate.length]);
    c("…avviso `livemode_diverso`", ["livemode_diverso"], m.avvisi());
    c("…e `shop_ordine_pagato` non è stata nemmeno chiamata", 0, m.chiamateRpc("shop_ordine_pagato").length);
    const reale = await mondo({ campi: { prova: false } });
    reale.paga();
    const s = await reale.vai(completato(reale, 0, { livemode: true }));
    c("ordine reale (prova=false) con evento reale → pagato", [200, "pagato"], [s.stato, reale.ordine().stato_pagamento]);
  }

  // ═══ 7 · RIMBORSI E CONTESTAZIONI (D46) ═══
  {
    const m = await mondo();
    const s = m.paga();
    await m.vai(completato(m));
    await m.finisci();
    m.stripe.rimborsaDalPannello(s.payment_intent, 1000);
    m.stripe.azzera();
    const ev = eventoStripeProva("charge.refunded", { id: "ch_prova0000000001", object: "charge", payment_intent: s.payment_intent, amount_refunded: 1000 }, { id: "evt_r0001" });
    const r = await m.vai(ev);
    c("`charge.refunded` → 200", 200, r.stato);
    c("…il webhook LEGGE l'elenco da Stripe (GET /v1/refunds?payment_intent=…)", [1, s.payment_intent], [m.stripe.chiamateA("GET", "/v1/refunds").length, m.stripe.chiamateA("GET", "/v1/refunds")[0]?.query.payment_intent]);
    c("…l'ordine si trova dal metadata[ordine_id] del payment intent (l'evento non lo porta): una lettura del pagamento", 1, m.stripe.chiamateA("GET", "/v1/payment_intents/").length);
    const riga = m.db.tabelle.shop_rimborsi?.[0];
    c("rimborso fatto dal pannello Stripe (nessuna riga prima) → riga con origine «stripe», importo e stato", ["stripe", 1000, "riuscito"], [riga?.origine, riga?.importo_cent, riga?.stato]);
    c("…`rimborsato_cent` aggiornato e stato `rimborsato_in_parte`", [1000, "rimborsato_in_parte"], [m.ordine().rimborsato_cent, m.ordine().stato_pagamento]);
    c("…nessuna scrittura diretta sulle tabelle chiuse", [], m.db.registro.filter((q) => ["shop_rimborsi", "shop_stripe_eventi"].includes(q.tab) && q.op !== "select"));
    m.stripe.rimborsaDalPannello(s.payment_intent, 1890);
    const tot = await m.vai(eventoStripeProva("refund.updated", { id: "re_x", object: "refund", payment_intent: s.payment_intent }, { id: "evt_r0002" }));
    c("`refund.updated` col resto → rimborso totale → `rimborsato`", [200, 2890, "rimborsato"], [tot.stato, m.ordine().rimborsato_cent, m.ordine().stato_pagamento]);
    const dup = await m.vai(ev);
    c("lo stesso `charge.refunded` ripetuto → niente di nuovo (idempotenza)", [200, 2], [dup.stato, m.stripe.chiamateA("GET", "/v1/refunds").length]);
    const fail = await m.vai(eventoStripeProva("refund.failed", { id: "re_y", object: "refund", payment_intent: s.payment_intent }, { id: "evt_r0003" }));
    c("`refund.failed` riconcilia allo stesso modo (200)", 200, fail.stato);
  }
  {
    // 150 rimborsi → due pagine
    const m = await mondo({ importo: 2890 });
    const s = m.paga();
    await m.vai(completato(m));
    await m.finisci();
    for (let i = 0; i < 150; i++) m.stripe.rimborsaDalPannello(s.payment_intent, 1);
    const r = await m.vai(eventoStripeProva("charge.refunded", { id: "ch_x", object: "charge", payment_intent: s.payment_intent }, { id: "evt_r0100" }));
    c("riconciliazione con 150 rimborsi → DUE pagine lette", [200, 2], [r.stato, m.stripe.chiamateA("GET", "/v1/refunds").length]);
    c("…tutti e 150 nel database", [150, 150], [m.db.tabelle.shop_rimborsi.length, m.ordine().rimborsato_cent]);
  }
  {
    // l'evento porta già l'ordine nei suoi metadati
    const m = await mondo();
    const s = m.paga();
    await m.vai(completato(m));
    await m.finisci();
    m.stripe.rimborsaDalPannello(s.payment_intent, 500);
    m.stripe.azzera();
    const r = await m.vai(eventoStripeProva("refund.updated", { id: "re_z", object: "refund", payment_intent: s.payment_intent, metadata: { ordine_id: ORD } }, { id: "evt_r0200" }));
    c("`refund.updated` con `metadata[ordine_id]` nell'evento → l'ordine si trova senza leggere il pagamento", [200, 0, 500], [r.stato, m.stripe.chiamateA("GET", "/v1/payment_intents/").length, m.ordine().rimborsato_cent]);
  }
  {
    const m = await mondo();
    const r = await m.vai(eventoStripeProva("charge.refunded", { id: "ch_n", object: "charge", payment_intent: "pi_inesistente0001" }, { id: "evt_r0300" }));
    c("rimborso di un pagamento che non conosciamo (nessun ordine) → 200, nessuna riconciliazione", [200, 0], [r.stato, m.chiamateRpc("shop_rimborso_riconcilia").length]);
    const guasto = await mondo();
    const s = guasto.paga();
    await guasto.vai(completato(guasto));
    await guasto.finisci();
    guasto.stripe.fallisci("GET /v1/refunds", { stato: 500, errore: { type: "api_error" } });
    const g = await guasto.vai(eventoStripeProva("charge.refunded", { id: "ch_g", object: "charge", payment_intent: s.payment_intent }, { id: "evt_r0400" }));
    c("Stripe che non risponde alla lettura dei rimborsi → 500 (Stripe ritenta), l'evento non si chiude", [500, null], [g.stato, guasto.db.tabelle.shop_stripe_eventi.find((e) => e.id === "evt_r0400").elaborato_il]);
    const ancora = await guasto.vai(eventoStripeProva("charge.refunded", { id: "ch_g", object: "charge", payment_intent: s.payment_intent }, { id: "evt_r0400" }));
    c("…al tentativo successivo l'elenco si legge e si riconcilia", [200, true], [ancora.stato, guasto.db.tabelle.shop_stripe_eventi.find((e) => e.id === "evt_r0400").elaborato_il != null]);
  }
  {
    const m = await mondo();
    const s = m.paga();
    await m.vai(completato(m));
    await m.finisci();
    const r = await m.vai(eventoStripeProva("charge.dispute.created", { id: "dp_prova0001", object: "dispute", payment_intent: s.payment_intent, amount: 2890, reason: "fraudulent" }, { id: "evt_d0001" }));
    c("`charge.dispute.created` → 200, avviso `contestazione`, stato INVARIATO", [200, ["contestazione"], "pagato"], [r.stato, m.avvisi(), m.ordine().stato_pagamento]);
    c("…una riga di storico «contestazione» (importo e motivo, nessun dato del cliente)", [1, 2890, "fraudulent"], [m.eventi("contestazione").length, m.eventi("contestazione")[0]?.dopo?.importo_cent, m.eventi("contestazione")[0]?.dopo?.motivo]);
    const dup = await m.vai(eventoStripeProva("charge.dispute.created", { id: "dp_prova0001", object: "dispute", payment_intent: s.payment_intent, amount: 2890, reason: "fraudulent" }, { id: "evt_d0001" }));
    c("…lo stesso evento ripetuto non moltiplica l'avviso", [200, 1], [dup.stato, m.avvisi().length]);
  }

  // ═══ 8 · IL CORPO: BOM, TIPI SCONOSCIUTI, GUASTI ═══
  {
    const m = await mondo();
    m.paga();
    const r = await m.vai(completato(m), { bom: true });
    await m.finisci();
    c("corpo con BOM: la firma si calcola sui BYTE, l'evento si legge", [200, "pagato"], [r.stato, m.ordine().stato_pagamento]);
    const u = await mondo();
    const sc = await u.vai(eventoStripeProva("customer.created", { id: "cus_x", object: "customer" }, { id: "evt_u0001" }));
    c("tipo sconosciuto → 200, e il database non viene toccato", [200, 0], [sc.stato, u.db.chiamate]);
    const nonJson = new TextEncoder().encode("questo non è json");
    const nj = await u.vaiGrezzo(nonJson, await firmaStripe(nonJson, SEGRETO_PROVA, T0));
    c("corpo firmato ma non JSON → 400", [400, 0], [nj.stato, u.db.chiamate]);
  }
  {
    const m = await mondo({ dbOpzioni: { errori: { "rpc.shop_stripe_evento_registra": { error: { code: "XX000", message: `errore con ${EMAIL_CLIENTE}` } } } } });
    m.paga();
    const r = await m.vai(completato(m));
    c("database che dà errore prima di scrivere → 500 (Stripe ritenta fino a 3 giorni)", [500, 0, "in_attesa"], [r.stato, m.chiamateRpc("shop_ordine_pagato").length, m.ordine().stato_pagamento]);
    const p = await mondo({ dbOpzioni: { errori: { "rpc.shop_ordine_pagato": { error: { code: "23514", message: "check" } } } } });
    p.paga();
    const rp = await p.vai(completato(p));
    c("errore dentro `shop_ordine_pagato` → 500, e l'evento resta aperto (si rielabora)", [500, null], [rp.stato, p.db.tabelle.shop_stripe_eventi[0].elaborato_il]);
    const l = await mondo({ dbOpzioni: { errori: { "rpc.shop_stripe_evento_registra": { lancia: new Error(`eccezione con ${EMAIL_CLIENTE}`) } } } });
    l.paga();
    const rl = await l.vai(completato(l));
    c("eccezione imprevista → 500 (un try/catch di primo livello), mai un'eccezione verso la rotta", 500, rl.stato);
    const s4 = await mondo({ dbOpzioni: { senzaColonne: { shop_orders: ["stato_pagamento"] } } });
    s4.paga();
    const r4 = await s4.vai(completato(s4));
    c("S4 assente → 503 (Stripe ritenta), nessuna scrittura", [503, 0], [r4.stato, s4.db.scritture.length]);
    const s4t = await mondo({ dbOpzioni: { mancante: ["shop_stripe_sessioni"] } });
    s4t.paga();
    c("S4 assente (tabella mancante) → 503", 503, (await s4t.vai(completato(s4t))).stato);
  }
  {
    const m = await mondo({ emailRotta: true });
    m.paga();
    const r = await m.vai(completato(m));
    await m.finisci();
    c("email che fallisce DOPO il commit → 200 e ordine pagato", [200, "pagato", 1], [r.stato, m.ordine().stato_pagamento, m.email.chiamate.length]);
    const q = await mondo();
    q.paga();
    q.stripe.fallisci("GET /v1/payment_intents/" + q.stripe.sessione(q.sessioni[0]).payment_intent, { stato: 500, errore: { type: "api_error" } });
    const r2 = await q.vai(completato(q), { porteExtra: {} });
    await q.finisci();
    c("lettura del metodo che fallisce → 200, ordine pagato, la conferma parte lo stesso", [200, "pagato", 1], [r2.stato, q.ordine().stato_pagamento, q.email.inviate.length]);
    const d = await mondo();
    d.paga();
    const r3 = await d.vai(completato(d), { porteExtra: { dopoRisposta: () => { throw new Error(`waitUntil rotto ${EMAIL_CLIENTE}`); } } });
    c("`dopoRisposta` che lancia → il «pagato» c'è e la risposta a Stripe è 200", [200, "pagato"], [r3.stato, d.ordine().stato_pagamento]);
  }
  {
    // il fallback senza `waitUntil`: si aspetta, con un tetto
    const lenta = new Promise((ok) => setTimeout(ok, 200));
    const t0 = Date.now();
    await W.attendiConTetto(lenta, 20);
    c("`attendiConTetto`: una promessa lenta si aspetta solo fino al tetto", true, Date.now() - t0 < 150);
    c("`attendiConTetto`: una promessa che fallisce non lancia", "ok", await W.attendiConTetto(Promise.reject(new Error("x")), 20).then(() => "ok", () => "lancia"));
    c("`attendiConTetto`: una promessa veloce si aspetta intera", "fatto", await (async () => { let f = "no"; await W.attendiConTetto(new Promise((ok) => setTimeout(() => { f = "fatto"; ok(); }, 5)), 500); return f; })());
  }

  // ═══ 9 · NEI LOG SOLO CODICI ═══
  {
    // si fa girare di tutto, con errori che contengono dati del cliente, e si fruga in ogni riga di log
    const tutti = [];
    const SEGRETI = [EMAIL_CLIENTE, "Anna", "Esempio", "Via Inventata", "Cittàfinta", "whsec", "sk_test", ORD, "Bearer", "boom", "eccezione con", "waitUntil rotto", "errore con"];
    const ID_STRIPE = /\b(?:pi|cs|evt|ch|re|dp)_[A-Za-z0-9]{4,}/;
    const esegui = async (opz, f) => { const m = await mondo(opz); await f(m); await m.finisci(); tutti.push(...m.log); };
    await esegui({ dbOpzioni: { errori: { "rpc.shop_stripe_evento_registra": { error: { code: "XX000", message: `errore con ${EMAIL_CLIENTE}`, details: "Anna Esempio, Via Inventata 1" } } } } }, async (m) => { m.paga(); await m.vai(completato(m)); });
    await esegui({ dbOpzioni: { errori: { "rpc.shop_stripe_evento_registra": { lancia: new Error(`eccezione con ${EMAIL_CLIENTE} Anna`) } } } }, async (m) => { m.paga(); await m.vai(completato(m)); });
    await esegui({ segreto: null }, async (m) => { await m.vai(evSessione("checkout.session.expired", { sessione: m.sessioni[0] })); });
    await esegui({}, async (m) => { m.paga(); await m.vai(completato(m), { segretoFirma: "altro" }); await m.vai(completato(m), { t: T0 - 999 }); });
    await esegui({ emailRotta: true }, async (m) => { m.paga(); await m.vai(completato(m)); });
    await esegui({}, async (m) => { m.paga(); await m.vai(completato(m), { porteExtra: { dopoRisposta: () => { throw new Error(`waitUntil rotto ${EMAIL_CLIENTE}`); } } }); });
    await esegui({}, async (m) => { const s = m.paga(); await m.vai(completato(m)); m.stripe.fallisci("GET /v1/refunds", { stato: 500, errore: { type: "api_error" } }); await m.vai(eventoStripeProva("charge.refunded", { id: "ch", object: "charge", payment_intent: s.payment_intent }, { id: "evt_r9" })); });
    await esegui({ dbOpzioni: { senzaColonne: { shop_orders: ["stato_pagamento"] } } }, async (m) => { m.paga(); await m.vai(completato(m)); });
    await esegui({}, async (m) => { m.paga(); await m.vai(completato(m, 0, { livemode: true })); });
    c("il log finto ha ricevuto qualcosa (la prova non è vuota)", true, tutti.length > 5);
    c("…ogni riga è un codice breve (lettere, cifre, spazio, trattino basso)", [], tutti.filter((x) => typeof x !== "string" || !/^[A-Za-z0-9_ .:-]{1,60}$/.test(x)));
    c("…e nessuna riga contiene email, nome, indirizzo, id di Stripe, id dell'ordine o pezzi di segreto", [], tutti.filter((x) => SEGRETI.some((s) => String(x).includes(s)) || ID_STRIPE.test(String(x))));
    c("…le risposte non portano dettagli (solo `{ok:true}` o `{ok:false}`)", true, await (async () => {
      const m = await mondo({ dbOpzioni: { errori: { "rpc.shop_stripe_evento_registra": { error: { code: "XX000", message: `errore con ${EMAIL_CLIENTE}` } } } } });
      m.paga();
      const r = await m.vai(completato(m));
      return r.corpo === '{"ok":false}' && !r.corpo.includes(EMAIL_CLIENTE);
    })());
  }

  // ═══ 10 · IL SORGENTE ═══
  {
    const sorgente = readFileSync(join(radice, "src/shop/cassa/webhook.server.ts"), "utf8");
    const senzaCommenti = sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    c("il webhook non legge il corpo come testo (`.text()`): si firmano i byte", false, /\.text\(\)/.test(senzaCommenti));
    c("non compone email (`componi`): `messaggioInviabile` e `componi` stanno in chi invia (PorteEmail)", false, /\bcomponi\b/.test(senzaCommenti));
    c("nessun `console.`, nessun `process.env`, nessun `import.meta.env`: tutto passa dalle porte", [false, false, false], [/console\./.test(senzaCommenti), /process\.env/.test(senzaCommenti), /import\.meta\.env/.test(senzaCommenti)]);
    c("nessuna chiave o segreto scritti nel sorgente", false, /\b(?:(?:sk|rk)_(?:test|live)|whsec)_[A-Za-z0-9]{16,}/.test(sorgente));
    c("nessuna cancellazione: il webhook non fa `delete`", false, /\.delete\(/.test(senzaCommenti));
    c("«pagato» si scrive solo con `shop_ordine_pagato`: nessun `stato_pagamento` scritto a mano", false, /stato_pagamento\s*:/.test(senzaCommenti));
  }
}
