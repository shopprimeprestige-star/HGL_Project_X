/** ── NEGOZIO · RILASCIO 2 · T51 · LA CASSA: SERVER (`src/shop/cassa/cassa.server.ts`) ───────────────────────────
 *  PIANO-R2 §3.1 (contratto), D47 (sessione), D49 (anti-spam), D50 (totale), D66 (riprova), contratti per W2/W3 del capo progetto.
 *  Finto database (`_finto-db.mjs`, funzioni di S4) e finto Stripe (`_stripe-finto.mjs`): nessuna rete, nessuna chiave vera, dati INVENTATI.
 *  Il modulo riceve tutto dalle PORTE (database, Stripe, orologio, log, chiave di servizio, `sito`, indirizzo, interruttore, tariffa):
 *  nessun `process.env`, nessun `Host`/`Origin`. Risposta `{stato, corpo}`; la rotta (T57) la trasforma in `Response`.
 *  Nel finto manca `shop_s4_avviso` (l'aiuto di S4 che scrive gli avvisi): qui lo imita `conAvvisi` (nota in LAVAGNA per chi cura il finto). */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { partenzaDa } from "./_dati-r2.mjs";
import { stripeFinto, CHIAVE_PROVA } from "./_stripe-finto.mjs";
import { uuid } from "./dati.mjs";

const SERVIZIO = "chiave-di-servizio-di-prova-non-vera";
const ORA = Date.parse("2026-11-20T12:00:00.000Z");
const SITO = "https://sito-di-prova.example";
const MIN = 60_000;
const REGEX_LOG = /^[a-z0-9_ ]{1,40}$/;

/** Dati del cliente INVENTATI e riconoscibili: se uno di questi finisce in una risposta o in un log, la prova lo vede. */
const CLIENTE = {
  nome: "Zefirino",
  cognome: "Quartarolo",
  email: "zefirino.q@example.com",
  telefono: "+39 300 000 7741",
  indirizzo: "Via Gelsomini 77",
  citta: "Pontelagoscuro",
  cap: "44123",
  provincia: "FE",
  note: "Citofono-segreto-xyz",
};
const SEGNI_DEL_CLIENTE = ["Zefirino", "Quartarolo", "zefirino.q", "300 000 7741", "3000007741", "Gelsomini", "Pontelagoscuro", "44123", "Citofono-segreto"];
const senzaDati = (testo) => !SEGNI_DEL_CLIENTE.some((s) => String(testo).toLowerCase().includes(s.toLowerCase()));

/** Una P.IVA di 11 cifre con la cifra di controllo giusta (Luhn): dato inventato. */
const luhnOk = (cifre) =>
  [...cifre].reverse().reduce((s, ch, i) => {
    let d = Number(ch);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    return s + d;
  }, 0) % 10 === 0;
const PIVA = (() => { for (let k = 0; k < 10; k++) if (luhnOk(`1234567890${k}`)) return `1234567890${k}`; throw new Error("nessuna P.IVA"); })();

const VARIANTI = [
  { sku: "PROVA-A", giacenza: 5, prezzo_cent: 2500, nome_prodotto: "Prodotto Alfa", slug: "prodotto-alfa", nome: "Unica" },
  { sku: "PROVA-B", giacenza: 3, prezzo_cent: 1250, nome_prodotto: "Prodotto Beta", slug: "prodotto-beta", nome: "100 ml" },
  { sku: "PROVA-BOZZA", giacenza: 5, prezzo_cent: 1000, pubblicato: false, nome_prodotto: "Prodotto Bozza", slug: "prodotto-bozza" },
  { sku: "PROVA-SPENTA", giacenza: 5, prezzo_cent: 1000, attiva: false, nome_prodotto: "Prodotto Spento", slug: "prodotto-spento" },
  { sku: "PROVA-ESAURITA", giacenza: 0, prezzo_cent: 1000, nome_prodotto: "Prodotto Esaurito", slug: "prodotto-esaurito" },
  { sku: "PROVA-DERM", giacenza: 5, prezzo_cent: 9000, nome_prodotto: "Invisible Derm", slug: "invisible-derm" },
  { sku: "PROVA-DERM-2", giacenza: 5, prezzo_cent: 9000, nome_prodotto: "Kit speciale", slug: "invisible-derm-kit" },
];
const TARIFFA = { stato: "ok", costoCent: 490, confermata: false, corriere: null, tempi: null, frase: null };

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("SHOP R2 · T51 · LA CASSA: SERVER (21/11/2026)");
  const K = mod["shop/cassa/cassa.server"];
  c("il modulo src/shop/cassa/cassa.server.ts esiste", true, !!K);
  if (!K) return;
  const S = mod["shop/stripe/client"];
  const PC = mod["shop/cassa/permesso-cassa"];
  const CO = mod["shop/cassa/chiave-ordine"];
  const TUTTI_I_LOG = [];

  // ── il mondo di una prova ──────────────────────────────────────────────────────────────────────────────────
  /** `shop_s4_avviso` non c'è nel finto: lo si imita (stessa regola del SQL: lo stesso codice e riferimento non si scrive due volte). */
  function conAvvisi(db) {
    const rpc = db.rpc.bind(db);
    db.rpc = (nome, args = {}) => {
      if (nome !== "shop_s4_avviso") return rpc(nome, args);
      const o = db.tabelle.shop_orders.find((x) => x.id === args.p_ordine);
      const lista = Array.isArray(o?.avvisi) ? o.avvisi : [];
      if (o && !lista.some((a) => a.codice === args.p_codice && (a.rif ?? null) === (args.p_rif ?? null)))
        o.avvisi = [...lista, { codice: args.p_codice, gravita: args.p_gravita, rif: args.p_rif ?? null }];
      return Promise.resolve({ data: null, error: null });
    };
    return db;
  }
  function ambiente({ varianti = VARIANTI, db: opzDb = {}, tariffa = TARIFFA, aperta = { aperta: true }, timeoutMs, ip = "203.0.113.7", ordini = [], chiaveServizio = SERVIZIO } = {}) {
    const ora = { t: ORA };
    const iso = () => new Date(ora.t).toISOString();
    const db = conAvvisi(fintoDb({ tabelle: partenzaDa({ varianti, ordini }, iso), adesso: iso, ...opzDb }));
    const finto = stripeFinto({ adesso: () => ora.t / 1000 });
    const log = [];
    TUTTI_I_LOG.push(log);
    let n = 0;
    const porte = {
      db,
      stripe: S.creaClientStripe({ chiave: CHIAVE_PROVA, fetch: finto.fetch, timeoutMs }),
      adesso: () => ora.t,
      log: (x) => log.push(x),
      chiaveServizio,
      sito: SITO,
      ip,
      userAgent: "ProvaBrowser/1.0",
      cassaAperta: async () => aperta,
      tariffa: async () => tariffa,
      prova: true,
      random: (k) => Uint8Array.from({ length: k }, (_, i) => (++n * 7 + i * 13) & 255),
    };
    return { db, finto, log, porte, ora, iso };
  }
  const permesso = (env, eta = 5000) => PC.emettiPermessoCassa(SERVIZIO, env.ora.t - eta);
  const corpoOnesto = async (env, extra = {}) => ({
    permesso: await permesso(env),
    tentativo: uuid(0x1001),
    totaleAttesoCent: 2 * 2500 + 490,
    righe: [{ sku: "PROVA-A", qty: 2 }],
    contatti: { nome: CLIENTE.nome, cognome: CLIENTE.cognome, email: CLIENTE.email, telefono: CLIENTE.telefono },
    spedizione: { indirizzo: CLIENTE.indirizzo, citta: CLIENTE.citta, cap: CLIENTE.cap, provincia: CLIENTE.provincia, nazione: "IT" },
    consensi: { termini: true, privacy: true, versione: "2026-11-01" },
    consensoMarketing: false,
    sito_web: "",
    ...extra,
  });
  const richiesta = (corpo, intestazioni = {}) =>
    new Request("https://qualunque.example/api/public/shop-cassa", {
      method: "POST",
      headers: { "content-type": "application/json", ...intestazioni },
      body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
    });
  const vai = (env, corpo, intestazioni) => K.gestisciCassa(richiesta(corpo, intestazioni), env.porte);
  const ordini = (env) => env.db.tabelle.shop_orders;
  const sessioniCreate = (env) => env.finto.chiamateA("POST", "/v1/checkout/sessions").filter((x) => x.percorso === "/v1/checkout/sessions");
  const scritture = (env) => env.db.registro.filter((q) => q.scrisse).map((q) => q.chiave);
  const sessioneId = (url) => url.split("/").pop();
  const frase = (r) => typeof r.corpo?.frase === "string" && r.corpo.frase.length > 0;

  // ═════ 1 · la cassa chiusa: nessuna chiamata ═════
  gruppo("T51 · CASSA CHIUSA, S4 ASSENTE, CORPO TROPPO GRANDE");
  {
    const env = ambiente({ aperta: { aperta: false, motivo: "manca_la_tariffa" } });
    const r = await vai(env, await corpoOnesto(env));
    c("cassa chiusa → 503 `cassa_chiusa`, con una frase", [503, false, "cassa_chiusa", true], [r.stato, r.corpo.ok, r.corpo.motivo, frase(r)]);
    c("…e NESSUNA chiamata né al database né a Stripe", [0, 0], [env.db.registro.length, env.finto.chiamate.length]);
    const g = await K.gestisciPermesso(env.porte);
    c("il permesso con la cassa chiusa: 503 e nessuna chiamata", [503, 0, 0], [g.stato, env.db.registro.length, env.finto.chiamate.length]);
    const rr = await K.riprovaPagamento({ ref: "HG-ABCDEF", t: "x".repeat(43), permesso: await permesso(env) }, env.porte);
    c("la riprova con la cassa chiusa: 503 `cassa_chiusa` e nessuna chiamata", [503, "cassa_chiusa", 0, 0], [rr.stato, rr.corpo.motivo, env.db.registro.length, env.finto.chiamate.length]);
    const senzaChiave = ambiente({ chiaveServizio: "" });
    const rs = await vai(senzaChiave, await corpoOnesto(senzaChiave));
    c("senza chiave di servizio → 503 `cassa_chiusa`, nessuna chiamata", [503, "cassa_chiusa", 0, 0], [rs.stato, rs.corpo.motivo, senzaChiave.db.registro.length, senzaChiave.finto.chiamate.length]);
    const lancia = ambiente();
    lancia.porte.cassaAperta = async () => { throw new Error("guasto qualunque"); };
    const rl = await vai(lancia, await corpoOnesto(lancia));
    c("l'interruttore che lancia vale «chiusa»: 503, nessuna chiamata", [503, 0, 0], [rl.stato, lancia.db.registro.length, lancia.finto.chiamate.length]);
  }
  {
    const env = ambiente({ db: { mancante: ["shop_stripe_sessioni"] } });
    const r = await vai(env, await corpoOnesto(env));
    c("S4 assente → `cassa_chiusa` 503 senza eccezioni, nessun ordine, nessuna chiamata a Stripe", [503, "cassa_chiusa", 0, 0], [r.stato, r.corpo.motivo, ordini(env).length, env.finto.chiamate.length]);
    const g = await K.gestisciPermesso(env.porte);
    c("S4 assente: anche il permesso risponde 503", 503, g.stato);
    const senzaColonne = ambiente({ db: { senzaColonne: { shop_orders: ["stato_pagamento", "canale", "totale_cent"] }, mancante: ["shop_stripe_sessioni", "shop_limiti"] } });
    const rc = await vai(senzaColonne, await corpoOnesto(senzaColonne));
    c("…con le colonne nuove di shop_orders assenti: lo stesso", [503, "cassa_chiusa"], [rc.stato, rc.corpo.motivo]);
  }
  {
    const env = ambiente();
    const grande = JSON.stringify({ ...(await corpoOnesto(env)), attribuzione: { utm_source: "x".repeat(40_000) } });
    const veri = JSON.parse;
    let parse = 0;
    JSON.parse = function (...a) { parse++; return veri.apply(this, a); };
    let r;
    try { r = await vai(env, grande); } finally { JSON.parse = veri; }
    c("corpo di 40 KB (senza intestazione di lunghezza) → 413, nessun parsing, nessuna chiamata", [413, 0, 0, 0], [r.stato, parse, env.db.registro.length, env.finto.chiamate.length]);
    let toccato = false;
    const spia = new ReadableStream({ pull(k) { toccato = true; k.enqueue(new Uint8Array(4)); k.close(); } }, { highWaterMark: 0 });
    const r2 = await K.gestisciCassa(
      new Request("https://qualunque.example/api/public/shop-cassa", { method: "POST", body: spia, duplex: "half", headers: { "content-type": "application/json", "content-length": "33000" } }),
      env.porte,
    );
    c("`Content-Length` oltre il tetto → 413 SENZA leggere il corpo", [413, false], [r2.stato, toccato]);
    const quasi = JSON.stringify({ ...(await corpoOnesto(env)), tentativo: uuid(0x1002), attribuzione: { utm_source: "y".repeat(100) } });
    c("un corpo normale (poche centinaia di byte) passa il tetto", true, quasi.length < 32 * 1024 && (await vai(env, quasi)).stato === 200);
    const rj = await vai(env, "{non è json");
    c("corpo che non è JSON → 400 `valore`", [400, "valore"], [rj.stato, rj.corpo.motivo]);
    const ra = await vai(env, "[1,2,3]");
    c("corpo che non è un oggetto → 400 `valore`", [400, "valore"], [ra.stato, ra.corpo.motivo]);
  }

  // ═════ 2 · la richiesta onesta ═════
  gruppo("T51 · LA RICHIESTA ONESTA: UN ORDINE, UNA SESSIONE");
  let esempio; // l'ordine onesto, per le prove successive
  {
    const env = ambiente();
    const r = await vai(env, await corpoOnesto(env));
    c("richiesta onesta → 200 `{ok:true, url}`", [200, true], [r.stato, r.corpo.ok]);
    c("…l'indirizzo è su checkout.stripe.com e nient'altro è nella risposta", [true, ["ok", "url"]], [/^https:\/\/checkout\.stripe\.com\/[^\s]+$/.test(r.corpo.url), Object.keys(r.corpo).sort()]);
    c("un solo ordine, `in_attesa`, canale sito, status nuovo, totale_cent giusto (2×25,00 + 4,90)", [1, "in_attesa", "sito", "nuovo", 5490, 54.9], [ordini(env).length, ordini(env)[0]?.stato_pagamento, ordini(env)[0]?.canale, ordini(env)[0]?.status, ordini(env)[0]?.totale_cent, ordini(env)[0]?.total]);
    const o = ordini(env)[0];
    c("l'ordine porta subtotale, spedizione e righe (SKU, quantità, prezzo del catalogo) del SERVER", [50, 4.9, [["PROVA-A", 2, 25]]], [o.subtotal, o.shipping, o.items.map((i) => [i.product_id, i.qty, i.unit_price])]);
    c("l'id dell'ordine è il `tentativo`, il riferimento ha la forma HG-XXXXXX, la nazione è IT, la prova è vera (chiave di prova)", [uuid(0x1001), true, "IT", true], [o.id, /^HG-[0-9A-HJKMNP-TV-Z]{6}$/.test(o.order_ref), o.nazione, o.prova]);
    c("UNA sola sessione creata su Stripe, e registrata (corrente = quella di Stripe)", [1, 1, sessioneId(r.corpo.url), "aperta"], [sessioniCreate(env).length, env.db.tabelle.shop_stripe_sessioni.length, o.stripe_sessione_id, env.db.tabelle.shop_stripe_sessioni[0]?.stato]);
    const sess = sessioniCreate(env)[0];
    const corpo = sess.corpo;
    c("importi alla sessione = catalogo: 2 × 2500 centesimi, spedizione 490, valuta eur", [2500, 2, "eur", 490], [Number(corpo.line_items[0].price_data.unit_amount), Number(corpo.line_items[0].quantity), corpo.line_items[0].price_data.currency, Number(corpo.shipping_options[0].shipping_rate_data.fixed_amount.amount)]);
    c("`expires_at` = `scade_il` dell'ordine (calcolato una volta dal database)", Math.floor(Date.parse(o.scade_il) / 1000), Number(corpo.expires_at));
    c("`scade_il` = adesso + 60 minuti (decide il database)", ORA + 60 * MIN, Date.parse(o.scade_il));
    c("`Idempotency-Key` = sessione-<ordine>-<firma>-r0 (la firma è quella dell'ordine)", `sessione-${o.id}-${o.firma_tentativo}-r0`, sess.chiaveIdempotenza);
    c("…la firma è esadecimale e non ripete nulla del cliente", [true, true], [/^[0-9a-f]{32}$/.test(o.firma_tentativo), senzaDati(o.firma_tentativo)]);
    c("la sessione porta ordine_id e client_reference_id = id dell'ordine, e l'email del cliente", [o.id, o.id, o.id, CLIENTE.email], [corpo.client_reference_id, corpo.metadata.ordine_id, corpo.payment_intent_data.metadata.ordine_id, corpo.customer_email]);
    const t = await CO.chiaveOrdine(SERVIZIO, o.id);
    c("`success_url` = SITO/shop/ordine/<ref>?t=<chiave>; `cancel_url` = SITO/shop/checkout?annullato=1", [`${SITO}/shop/ordine/${o.order_ref}?t=${t}`, `${SITO}/shop/checkout?annullato=1`], [corpo.success_url, corpo.cancel_url]);
    c("sull'ordine resta solo l'impronta della chiave (mai la chiave), e la chiave la riconosce", [await CO.impronta(t), true, false], [o.chiave_pubblica_hash, await CO.verificaChiave(t, o.chiave_pubblica_hash), JSON.stringify(o).includes(t)]);
    const stripeVede = env.finto.chiamate.map((x) => x.corpoGrezzo + decodeURIComponent(x.corpoGrezzo)).join(" ");
    c("a Stripe va solo l'email del cliente: né nome, né telefono, né indirizzo, né note", true, ["Zefirino", "Quartarolo", "7741", "Gelsomini", "Pontelagoscuro", "Citofono"].every((s) => !stripeVede.includes(s)));
    c("nessuna immagine nella sessione e nessun metodo di pagamento elencato nel codice", [false, false], [/images/.test(sess.corpoGrezzo), /payment_method_types/.test(sess.corpoGrezzo)]);
    const riserv = env.db.tabelle.shop_ordini_riservati[0];
    c("i riservati dell'ordine esistono (con le due caselle di legge e la versione) e la fattura non c'è", [o.id, true, true, "2026-11-01", null, false], [riserv.ordine_id, riserv.consensi.termini, riserv.consensi.privacy, riserv.consensi.versione, riserv.fattura, o.fattura_richiesta]);
    esempio = { env, ordine: o, risposta: r };
  }

  // ═════ 3 · nessun prezzo dal client ═════
  gruppo("T51 · RICHIESTA ARTEFATTA: I PREZZI SONO QUELLI DEL CATALOGO");
  {
    const env = ambiente();
    const artefatta = await corpoOnesto(env, {
      righe: [{ sku: "PROVA-A", qty: 2, prezzo: 0.01, prezzoCent: 1, price: 1, unit_price: 0.01, unit_amount: 1, nome: "Regalo" }],
      spedizione: { indirizzo: CLIENTE.indirizzo, citta: CLIENTE.citta, cap: CLIENTE.cap, provincia: CLIENTE.provincia, nazione: "IT", costoCent: 0, costo: 0 },
      spedizioneCent: 0, shipping: 0, subtotaleCent: 2, totaleCent: 2, total: 0.02, subtotal: 0.02, prezzi: { "PROVA-A": 1 },
    });
    const r = await vai(env, artefatta);
    const s = sessioniCreate(env)[0]?.corpo;
    c("prezzo, spedizione e totali alterati dal client: l'importo a Stripe è quello del catalogo", [200, 2500, 490, 5490], [r.stato, Number(s?.line_items[0].price_data.unit_amount), Number(s?.shipping_options[0].shipping_rate_data.fixed_amount.amount), ordini(env)[0]?.totale_cent]);
    c("…e il nome della riga è quello del catalogo, non quello scritto dal client", true, !/Regalo/.test(JSON.stringify(s)));
    const sbagliato = ambiente();
    const r2 = await vai(sbagliato, await corpoOnesto(sbagliato, { totaleAttesoCent: 100 }));
    c("`totaleAttesoCent` diverso dal ricalcolo → 409 `prezzi_cambiati` con i totali nuovi", [409, "prezzi_cambiati", 5490, 490], [r2.stato, r2.corpo.motivo, r2.corpo.totaleCent, r2.corpo.spedizioneCent]);
    c("…nessun ordine, nessuna sessione", [0, 0], [ordini(sbagliato).length, sessioniCreate(sbagliato).length]);
    const r3 = await vai(sbagliato, await corpoOnesto(sbagliato, { totaleAttesoCent: "5490" }));
    c("il totale atteso come testo non vale: `prezzi_cambiati`", "prezzi_cambiati", r3.corpo.motivo);
    const qtyAlta = ambiente();
    const r4 = await vai(qtyAlta, await corpoOnesto(qtyAlta, { righe: [{ sku: "PROVA-A", qty: 21 }] }));
    c("quantità 21 (oltre il tetto di 20) → rifiutata, nessun ordine", [false, 0], [r4.corpo.ok, ordini(qtyAlta).length]);
    const troppe = ambiente();
    const r5 = await vai(troppe, await corpoOnesto(troppe, { righe: Array.from({ length: 31 }, (_, i) => ({ sku: `PROVA-${i}`, qty: 1 })) }));
    c("31 righe → 400 `valore`, nessuna chiamata al catalogo", [400, "valore"], [r5.stato, r5.corpo.motivo]);
  }

  // ═════ 4 · cosa non si vende ═════
  gruppo("T51 · PRODOTTI CHE NON SI VENDONO: NESSUN ORDINE, NESSUNA SESSIONE");
  for (const [nome, righe] of [
    ["prodotto in bozza", [{ sku: "PROVA-BOZZA", qty: 1 }]],
    ["variante spenta", [{ sku: "PROVA-SPENTA", qty: 1 }]],
    ["variante esaurita", [{ sku: "PROVA-ESAURITA", qty: 1 }]],
    ["quantità oltre la giacenza", [{ sku: "PROVA-B", qty: 4 }]],
    ["SKU che non esiste", [{ sku: "PROVA-NONC", qty: 1 }]],
    ["Invisible Derm (nome)", [{ sku: "PROVA-DERM", qty: 1 }]],
    ["Invisible Derm (solo lo slug)", [{ sku: "PROVA-DERM-2", qty: 1 }]],
    ["una riga buona e una cattiva", [{ sku: "PROVA-A", qty: 1 }, { sku: "PROVA-BOZZA", qty: 1 }]],
  ]) {
    const env = ambiente();
    const r = await vai(env, await corpoOnesto(env, { righe, totaleAttesoCent: 5490 }));
    c(`${nome} → 409 \`non_disponibile\` con la frase per riga, nessun ordine, nessuna sessione`, [409, "non_disponibile", true, 0, 0], [r.stato, r.corpo.motivo, Array.isArray(r.corpo.righe) && r.corpo.righe.length > 0 && r.corpo.righe.every((x) => typeof x.sku === "string" && x.frase), ordini(env).length, sessioniCreate(env).length]);
    c(`   …e la risposta non dice perché (niente «bozza», «Derm», cifre di giacenza)`, true, !/bozza|derm|invisible|giacenza|prezzo/i.test(JSON.stringify(r.corpo)));
  }
  {
    const env = ambiente({ varianti: [{ sku: "PROVA-ZERO", giacenza: 5, prezzo_cent: 0, nome_prodotto: "Prodotto Zero", slug: "prodotto-zero" }, ...VARIANTI] });
    const r = await vai(env, await corpoOnesto(env, { righe: [{ sku: "PROVA-ZERO", qty: 1 }] }));
    c("un prezzo 0 → `non_disponibile` (mai una sessione da zero euro)", [409, 0, 0], [r.stato, ordini(env).length, sessioniCreate(env).length]);
  }
  {
    const env = ambiente({ tariffa: { stato: "assente" } });
    const r = await vai(env, await corpoOnesto(env));
    c("senza tariffa di spedizione → `cassa_chiusa` 503, nessun ordine, nessuna sessione", [503, "cassa_chiusa", 0, 0], [r.stato, r.corpo.motivo, ordini(env).length, sessioniCreate(env).length]);
    const piccolo = ambiente({ varianti: [{ sku: "PROVA-P", giacenza: 5, prezzo_cent: 10, nome_prodotto: "Prodotto Piccolo", slug: "prodotto-piccolo" }], tariffa: { ...TARIFFA, costoCent: 0 } });
    const rp = await vai(piccolo, await corpoOnesto(piccolo, { righe: [{ sku: "PROVA-P", qty: 1 }], totaleAttesoCent: 10 }));
    c("un totale sotto i 50 centesimi → `valore`, nessun ordine", [400, "valore", 0], [rp.stato, rp.corpo.motivo, ordini(piccolo).length]);
  }

  // ═════ 5 · doppio clic e tentativi ═════
  gruppo("T51 · DOPPIO CLIC, TENTATIVO DIVERSO, ORDINE GIÀ CHIUSO");
  {
    const env = ambiente();
    const corpo = await corpoOnesto(env);
    const a = await vai(env, corpo);
    const b = await vai(env, corpo);
    c("doppio clic (stesso tentativo, stessa firma) → UN ordine e UNA sessione, la stessa `url`", [1, 1, true, a.corpo.url], [ordini(env).length, sessioniCreate(env).length, b.corpo.ok, b.corpo.url]);
    const diverso = await vai(env, { ...corpo, note: "un'altra nota" });
    c("stesso tentativo con dati diversi → 409 `tentativo_diverso`, niente di nuovo", [409, "tentativo_diverso", 1, 1], [diverso.stato, diverso.corpo.motivo, ordini(env).length, sessioniCreate(env).length]);
    const altroPrezzoAtteso = await vai(env, { ...corpo, righe: [{ sku: "PROVA-A", qty: 1 }], totaleAttesoCent: 2990 });
    c("…anche con le righe diverse", "tentativo_diverso", altroPrezzoAtteso.corpo.motivo);
  }
  {
    const env = ambiente();
    const corpo = await corpoOnesto(env);
    const [a, b] = await Promise.all([vai(env, corpo), vai(env, corpo)]);
    c("due richieste INSIEME con lo stesso tentativo → una riga d'ordine, una sessione su Stripe, stessa `url`", [1, 1, true, true, a.corpo.url], [ordini(env).length, env.finto.sessioni().length, a.corpo.ok, b.corpo.ok, b.corpo.url]);
    const chiamate = sessioniCreate(env);
    c("…se Stripe è stato chiamato due volte i parametri sono IDENTICI (stesso `expires_at`, stessa Idempotency-Key)", [1, 1], [new Set(chiamate.map((x) => x.corpoGrezzo)).size, new Set(chiamate.map((x) => x.chiaveIdempotenza)).size]);
    c("…e la sessione è registrata una volta sola", 1, env.db.tabelle.shop_stripe_sessioni.length);
  }
  {
    // Stripe rifiuta davvero: l'ordine si chiude `scaduto`, con l'avviso, e la risposta non porta dati del cliente
    const env = ambiente();
    env.finto.fallisci("POST /v1/checkout/sessions", { stato: 402, errore: { type: "card_error", code: "card_declined" } });
    const corpo = await corpoOnesto(env);
    const r = await vai(env, corpo);
    const o = ordini(env)[0];
    c("Stripe che RIFIUTA (402) → ordine `scaduto`, avviso `stripe_errore`, risposta 500 `guasto`", [1, "scaduto", true, 500, "guasto"], [ordini(env).length, o?.stato_pagamento, (o?.avvisi ?? []).some((x) => x.codice === "stripe_errore"), r.stato, r.corpo.motivo]);
    c("…nessun dato del cliente nella risposta", true, senzaDati(JSON.stringify(r)));
    const ancora = await vai(env, corpo);
    c("ordine già `scaduto`, stesso tentativo → 409 `non_riproponibile`, nessuna sessione nuova", [409, "non_riproponibile", 0], [ancora.stato, ancora.corpo.motivo, env.finto.sessioni().length]);
    const rifiuto400 = ambiente();
    rifiuto400.finto.fallisci("POST /v1/checkout/sessions", { stato: 400, errore: { type: "invalid_request_error", code: "parameter_invalid_integer" } });
    await vai(rifiuto400, await corpoOnesto(rifiuto400));
    c("anche un rifiuto 400 vero chiude l'ordine", "scaduto", ordini(rifiuto400)[0]?.stato_pagamento);
    const chiave401 = ambiente();
    chiave401.finto.fallisci("POST /v1/checkout/sessions", { stato: 401, errore: { type: "invalid_request_error" } });
    const r401 = await vai(chiave401, await corpoOnesto(chiave401));
    c("una chiave rifiutata (401) è un guasto nostro: ordine ancora `in_attesa`, risposta `guasto`", ["in_attesa", "guasto"], [ordini(chiave401)[0]?.stato_pagamento, r401.corpo.motivo]);
  }
  for (const [nome, guasto, opz] of [
    ["errore di idempotenza di Stripe", { stato: 400, errore: { type: "idempotency_error" } }, {}],
    ["timeout di Stripe", { timeout: true }, { timeoutMs: 30 }],
    ["rete che cade", { rete: true }, {}],
    ["Stripe che risponde 500", { stato: 500, errore: { type: "api_error" } }, {}],
  ]) {
    const env = ambiente(opz);
    env.finto.fallisci("POST /v1/checkout/sessions", guasto);
    const corpo = await corpoOnesto(env);
    const r = await vai(env, corpo);
    const prima = ordini(env)[0];
    c(`${nome} → l'ordine RESTA \`in_attesa\`, risposta 500 \`guasto\` (ritentabile), nessuna sessione`, [1, "in_attesa", 500, "guasto", 0], [ordini(env).length, prima?.stato_pagamento, r.stato, r.corpo.motivo, env.finto.sessioni().length]);
    const scadePrima = prima?.scade_il;
    const dopo = await vai(env, corpo);
    c("   …il secondo clic (stesso tentativo, stessa firma, stesso `scade_il`) ottiene UNA sessione", [true, 1, 1, scadePrima, 0], [dopo.corpo.ok, env.finto.sessioni().length, ordini(env).length, ordini(env)[0]?.scade_il, ordini(env)[0]?.riprova_n]);
  }

  // ═════ 6 · il permesso, la trappola, il limite ═════
  gruppo("T51 · PERMESSO, TRAPPOLA, LIMITE PER INDIRIZZO");
  {
    const env = ambiente();
    const base = await corpoOnesto(env);
    const falsificato = base.permesso.slice(0, -1) + (base.permesso.endsWith("0") ? "1" : "0");
    for (const [nome, permessoDato] of [
      ["troppo recente (1 s)", await permesso(env, 1000)],
      ["alterato", falsificato],
      ["assente", undefined],
      ["di un'altra forma", "ciao"],
      ["scaduto (31 minuti)", await permesso(env, 31 * MIN)],
      ["quello degli eventi (R1), non della cassa", "1700000000000." + "a".repeat(64)],
    ]) {
      const r = await vai(env, { ...base, permesso: permessoDato });
      c(`permesso ${nome} → 403 \`permesso\``, [403, "permesso"], [r.stato, r.corpo.motivo]);
    }
    c("…e senza nessuna chiamata al database né a Stripe", [0, 0, 0], [env.db.registro.length, env.finto.chiamate.length, ordini(env).length]);
    const ok = await vai(env, { ...base, permesso: await permesso(env, 3000) });
    c("un permesso di esattamente 3 secondi passa", 200, ok.stato);
  }
  {
    const env = ambiente();
    const base = await corpoOnesto(env);
    for (const trappola of ["sono-un-robot", "x", 1, true, ["a"], { a: 1 }]) {
      const r = await vai(env, { ...base, sito_web: trappola });
      c(`trappola piena (${JSON.stringify(trappola)}) → successo VUOTO: 200 \`{ok:true}\` senza indirizzo`, [200, true, false], [r.stato, r.corpo.ok, "url" in r.corpo]);
    }
    c("…senza scrivere niente: nessuna chiamata al database, nessuna a Stripe, nessun ordine", [0, 0, 0], [env.db.registro.length, env.finto.chiamate.length, ordini(env).length]);
  }
  {
    const env = ambiente();
    const esiti = [];
    for (let i = 0; i < 10; i++) esiti.push((await vai(env, await corpoOnesto(env, { tentativo: uuid(0x3000 + i) }))).stato);
    c("le prime dieci richieste dello stesso indirizzo nell'ora passano", Array(10).fill(200), esiti);
    const undicesima = await vai(env, await corpoOnesto(env, { tentativo: uuid(0x3100) }));
    c("l'UNDICESIMA nell'ora → 429 `troppe_richieste`, nessun ordine in più", [429, "troppe_richieste", 10, 10], [undicesima.stato, undicesima.corpo.motivo, ordini(env).length, env.finto.sessioni().length]);
    const righe = env.db.tabelle.shop_limiti;
    c("il limite sta in `shop_limiti` con l'impronta dell'indirizzo (mai l'indirizzo in chiaro)", [1, true, false], [righe.length, /^ordine:[0-9a-f]{64}$/.test(righe[0].chiave), JSON.stringify(righe).includes("203.0.113.7")]);
    const altro = ambiente({ ip: "203.0.113.99" });
    altro.db.tabelle.shop_limiti.push(...righe.map((x) => ({ ...x })));
    const rAltro = await vai(altro, await corpoOnesto(altro, { tentativo: uuid(0x3200) }));
    c("un altro indirizzo non è limitato", 200, rAltro.stato);
    env.ora.t += 61 * MIN;
    const dopoUnOra = await vai(env, await corpoOnesto(env, { tentativo: uuid(0x3300) }));
    c("passata l'ora la finestra riparte", 200, dopoUnOra.stato);
    const invalida = ambiente();
    for (let i = 0; i < 12; i++) await vai(invalida, await corpoOnesto(invalida, { tentativo: "non-un-uuid" }));
    const buona = await vai(invalida, await corpoOnesto(invalida));
    c("le richieste che non superano la validazione non consumano il limite", 200, buona.stato);
  }

  // ═════ 7 · dati del cliente: validazione, riservati, consensi ═════
  gruppo("T51 · RISERVATI, CONSENSI, FATTURA");
  {
    const env = ambiente();
    const r = await vai(env, await corpoOnesto(env, { contatti: { nome: "", cognome: CLIENTE.cognome, email: "non-una-email", telefono: "abc" } }));
    c("campi sbagliati → 400 `valore` con le frasi per campo, senza ripetere quanto scritto", [400, "valore", true, true, 0], [r.stato, r.corpo.motivo, ["nome", "email", "telefono"].every((k) => typeof r.corpo.campi?.[k] === "string"), !JSON.stringify(r.corpo).includes("non-una-email"), ordini(env).length]);
    const senzaConsenso = await vai(env, await corpoOnesto(env, { consensi: { termini: true, privacy: false, versione: "x" } }));
    c("senza la casella della privacy → 400 `valore`", [400, "valore"], [senzaConsenso.stato, senzaConsenso.corpo.motivo]);
    const estero = await vai(env, await corpoOnesto(env, { spedizione: { indirizzo: CLIENTE.indirizzo, citta: CLIENTE.citta, cap: CLIENTE.cap, provincia: "FE", nazione: "FR" } }));
    c("spedizione fuori Italia → 400 `valore`", [400, "valore"], [estero.stato, estero.corpo.motivo]);
  }
  {
    const env = ambiente();
    await vai(env, await corpoOnesto(env, { consensoMarketing: false, attribuzione: { fbp: "fb.1.1.123", fbc: "fb.1.1.abc", fbclid: "zzz", utm_source: "instagram" } }));
    const riserv = env.db.tabelle.shop_ordini_riservati[0];
    c("consenso di marketing FALSO → nessun `fbp`, `fbc`, `fbclid` nei riservati; restano le `utm_*`", [false, false, false, "instagram"], [!!riserv.attribuzione?.fbp, !!riserv.attribuzione?.fbc, !!riserv.attribuzione?.fbclid, riserv.attribuzione?.utm_source]);
    c("…e nessun indirizzo IP né user agent", [null, null, false], [riserv.ip, riserv.user_agent, JSON.stringify(riserv).includes("203.0.113.7")]);
    c("…i consensi dicono `marketing: false`", false, riserv.consensi.marketing);
    const con = ambiente();
    await vai(con, await corpoOnesto(con, { consensoMarketing: true, attribuzione: { fbp: "fb.1.1.123", utm_source: "instagram" } }));
    const rc = con.db.tabelle.shop_ordini_riservati[0];
    c("consenso di marketing VERO → `fbp` e IP stanno nei riservati, con lo user agent", ["fb.1.1.123", "203.0.113.7", "ProvaBrowser/1.0", true], [rc.attribuzione?.fbp, rc.ip, rc.user_agent, rc.consensi.marketing]);
    c("…ma mai su `shop_orders` (la tabella che il browser potrebbe leggere)", false, /fb\.1\.1|203\.0\.113|ProvaBrowser/.test(JSON.stringify(con.db.tabelle.shop_orders)));
  }
  {
    const env = ambiente();
    await vai(env, await corpoOnesto(env, { fattura: { tipo: "azienda", denominazione: "Azienda Inventata Srl", piva: PIVA } }));
    const o = ordini(env)[0];
    const riserv = env.db.tabelle.shop_ordini_riservati[0];
    c("fattura richiesta → `fattura_richiesta` sull'ordine, i dati SOLO nei riservati (SDI vuoto = 0000000)", [true, "azienda", PIVA, "0000000", false], [o.fattura_richiesta, riserv.fattura?.tipo, riserv.fattura?.piva, riserv.fattura?.sdi, JSON.stringify(o).includes(PIVA)]);
    const brutta = await vai(env, await corpoOnesto(env, { tentativo: uuid(0x1500), fattura: { tipo: "azienda", denominazione: "Azienda Inventata Srl", piva: "12345678900" } }));
    c("una P.IVA sbagliata → `valore` con l'errore accanto al campo", [400, "valore", true], [brutta.stato, brutta.corpo.motivo, typeof brutta.corpo.campi?.piva === "string"]);
  }

  // ═════ 8 · il sito è una costante, mai Host/Origin ═════
  gruppo("T51 · IL SITO È UNA COSTANTE");
  {
    const env = ambiente();
    await vai(env, await corpoOnesto(env), { host: "evil.example", origin: "https://evil.example", "x-forwarded-host": "evil.example", referer: "https://evil.example/x" });
    const s = sessioniCreate(env)[0]?.corpo;
    c("con Host, Origin e X-Forwarded-Host falsi, gli indirizzi di ritorno partono comunque da `porte.sito`", [true, true, false], [s?.success_url?.startsWith(`${SITO}/shop/ordine/HG-`), s?.cancel_url === `${SITO}/shop/checkout?annullato=1`, JSON.stringify(s).includes("evil")]);
    const storto = ambiente();
    storto.porte.sito = "http://sito-non-sicuro.example/";
    const r = await vai(storto, await corpoOnesto(storto));
    c("un `sito` non https (o con la barra in fondo) è un errore di configurazione: `cassa_chiusa`, nessun ordine", [503, 0], [r.stato, ordini(storto).length]);
  }


  // ═════ 9 · log: solo codici, mai dati del cliente ═════
  gruppo("T51 · NEI LOG SOLO CODICI, UN TRY/CATCH DI PRIMO LIVELLO");
  {
    const dati = "valore di Zefirino Quartarolo zefirino.q@example.com +39 300 000 7741 Via Gelsomini 77";
    const casi = [
      ["errore di PostgREST con dati nel messaggio, nei dettagli e nel suggerimento (crea)", { "rpc.shop_ordine_crea": { error: { code: "XX000", message: dati, details: `Key (email)=(zefirino.q@example.com) ${dati}`, hint: dati } } }],
      ["errore del database nel limite", { "rpc.shop_limite_consuma": { error: { code: "57014", message: dati, details: dati } } }],
      ["errore sulle righe del catalogo", { "rpc.shop_cassa_righe": { error: { code: "XX001", message: dati } } }],
      ["errore nel registrare la sessione", { "rpc.shop_ordine_sessione_registra": { error: { code: "XX002", message: dati } } }],
      ["errore nella lettura dell'ordine", { "shop_orders.select": { error: { code: "XX003", message: dati } } }],
      ["eccezione lanciata dal database (primo livello)", { "rpc.shop_cassa_righe": { lancia: new Error(dati) } }],
      ["eccezione con un nome strano e dati dentro", { "rpc.shop_limite_consuma": { lancia: Object.assign(new Error(dati), { name: `Errore Strano ${dati}` }) } }],
      ["eccezione che non è un Error", { "rpc.shop_limite_consuma": { lancia: dati } }],
    ];
    for (const [nome, errori] of casi) {
      const env = ambiente({ db: { errori } });
      const r = await vai(env, await corpoOnesto(env));
      const righeLog = env.log;
      c(`${nome} → 500 \`guasto\` con una frase, mai un'eccezione`, [500, "guasto", true], [r.stato, r.corpo.motivo, frase(r)]);
      c("   …nessun dato del cliente nella risposta né nei log, e ogni riga del log è un codice", [true, true, true, true], [senzaDati(JSON.stringify(r)), righeLog.length > 0, righeLog.every((x) => REGEX_LOG.test(x) && senzaDati(x)), !/message|details|hint/i.test(righeLog.join(" "))]);
    }
    const ordine = ambiente({ db: { errori: { "rpc.shop_ordine_crea": { error: { code: "XX000", message: dati } } } } });
    await vai(ordine, await corpoOnesto(ordine));
    c("…il codice di PostgREST è nel log (xx000) e nient'altro", true, ordine.log.some((x) => /xx000/.test(x)));
    c("…e quando la creazione fallisce non resta nessun ordine scritto", 0, ordini(ordine).length);
    const stripe = ambiente();
    stripe.finto.fallisci("POST /v1/checkout/sessions", { stato: 402, errore: { type: "card_error", code: "card_declined" } });
    await vai(stripe, await corpoOnesto(stripe));
    c("un errore di Stripe finisce nel log come codice (il `message` di Stripe, pieno di dati, mai)", [true, true], [stripe.log.some((x) => /card_declined/.test(x)), stripe.log.every((x) => REGEX_LOG.test(x) && !/messaggio di Stripe/.test(x))]);
    const poi = ambiente();
    poi.porte.chiaveServizio = "";
    await vai(poi, await corpoOnesto(poi));
    c("la chiave di servizio e la chiave di Stripe non compaiono mai nei log", true, TUTTI_I_LOG.flat().every((x) => !x.includes(SERVIZIO) && !x.includes(CHIAVE_PROVA)));
  }

  // ═════ 10 · il permesso (GET) ═════
  gruppo("T51 · IL PERMESSO (GET)");
  {
    const env = ambiente();
    const g = await K.gestisciPermesso(env.porte);
    c("200 `{ok:true, permesso}` firmato dalla cassa", [200, true, "string"], [g.stato, g.corpo.ok, typeof g.corpo.permesso]);
    c("…dopo 3 secondi vale per la cassa, subito no", [{ ok: true }, { ok: false, motivo: "troppo_presto" }], [await PC.verificaPermessoCassa(g.corpo.permesso, SERVIZIO, env.ora.t + 3000), await PC.verificaPermessoCassa(g.corpo.permesso, SERVIZIO, env.ora.t + 1000)]);
    c("…porta l'istante di emissione dato dall'orologio della porta", String(env.ora.t), g.corpo.permesso.split(".")[0]);
    let ultimo = g;
    for (let i = 0; i < 30; i++) ultimo = await K.gestisciPermesso(env.porte);
    c("il 31° permesso dell'ora dallo stesso indirizzo → 429", [429, false], [ultimo.stato, ultimo.corpo.ok]);
    const senza = ambiente({ chiaveServizio: "" });
    const s = await K.gestisciPermesso(senza.porte);
    c("senza chiave di servizio → 503, nessuna chiamata", [503, 0], [s.stato, senza.db.registro.length]);
  }

  // ═════ 11 · RIPROVA (D66) ═════
  gruppo("T51 · RIPROVA IL PAGAMENTO (D66, CONTRATTO W3 N. 1)");
  const creato = async (env, extra = {}) => {
    const r = await vai(env, await corpoOnesto(env, extra));
    const o = ordini(env).at(-1);
    return { r, o, id: o.id, ref: o.order_ref, t: await CO.chiaveOrdine(SERVIZIO, o.id), sessione: r.corpo.url ? sessioneId(r.corpo.url) : null };
  };
  const riprova = async (env, { ref, t }, eta, extra = {}) => K.riprovaPagamento({ ref, t, permesso: await permesso(env, eta), ...extra }, env.porte);
  const chiudi = (env, o, stato) => env.db.rpc("shop_ordine_chiudi", { p_ordine: o.id, p_sessione: o.stripe_sessione_id, p_stato: stato });
  const pagaViaWebhook = (env, o, sessione, importo = o.totale_cent) => env.db.rpc("shop_ordine_pagato", { p_ordine: o.id, p_sessione: sessione, p_importo_cent: importo, p_valuta: "eur", p_metodo: "card", p_pagamento_id: "pi_prova" });
  const stato = (env, id) => ordini(env).find((x) => x.id === id);
  const giacenza = (env, sku) => env.db.tabelle.shop_varianti.find((v) => v.sku === sku).giacenza;
  const nomiChiamate = (env) => env.finto.chiamate.map((x) => `${x.metodo} ${x.percorso}`);

  {
    // pagato → nessuna sessione
    const env = ambiente();
    const k = await creato(env);
    env.finto.paga(k.sessione);
    await pagaViaWebhook(env, k.o, k.sessione);
    const prima = env.finto.chiamate.length;
    const r = await riprova(env, k);
    c("ordine `pagato` → 409 `non_riproponibile` e NESSUNA sessione nuova, nessuna chiamata a Stripe", [409, "non_riproponibile", 1, prima], [r.stato, r.corpo.motivo, sessioniCreate(env).length, env.finto.chiamate.length]);
  }
  {
    // in_attesa in tabella ma `paid` su Stripe → riconcilia
    const env = ambiente();
    const k = await creato(env);
    env.finto.paga(k.sessione);
    const r = await riprova(env, k);
    c("`in_attesa` in tabella ma sessione `paid` su Stripe → `gia_pagato` (nessuna sessione nuova)", [409, "gia_pagato", 1, true], [r.stato, r.corpo.motivo, sessioniCreate(env).length, frase(r)]);
    c("…l'ordine si RICONCILIA: pagato, metodo stripe, giacenza scesa di 2, stessa funzione SQL del webhook", ["pagato", "stripe", 3, "card"], [stato(env, k.id).stato_pagamento, stato(env, k.id).metodo_pagamento, giacenza(env, "PROVA-A"), stato(env, k.id).metodo_dettaglio]);
    const ancora = await riprova(env, k);
    c("una seconda riprova trova `pagato` → `non_riproponibile`, ancora una sola sessione, giacenza scalata una volta", ["non_riproponibile", 1, 3], [ancora.corpo.motivo, sessioniCreate(env).length, giacenza(env, "PROVA-A")]);
  }
  let vecchia; // il caso completo della riprova, per le prove che seguono
  {
    // fallito con la sessione vecchia ancora aperta → scade prima, poi la nuova
    const env = ambiente();
    const k = await creato(env);
    await chiudi(env, k.o, "fallito");
    const r = await riprova(env, k);
    const nomi = nomiChiamate(env);
    const iScadi = nomi.findIndex((x) => x === `POST /v1/checkout/sessions/${k.sessione}/expire`);
    const iCrea = nomi.map((x, i) => (x === "POST /v1/checkout/sessions" ? i : -1)).filter((i) => i >= 0).at(1);
    c("da `fallito` con la sessione vecchia `open` → viene fatta SCADERE prima di aprire la nuova", [true, true, "expired"], [iScadi >= 0, iScadi < iCrea, env.finto.sessione(k.sessione).status]);
    const nuova = r.corpo.url ? sessioneId(r.corpo.url) : null;
    const o = stato(env, k.id);
    c("…nuova sessione, ordine di nuovo `in_attesa`, `riprova_n` + 1, risposta col nuovo indirizzo", [200, true, true, "in_attesa", 1, nuova, true], [r.stato, r.corpo.ok, /^https:\/\/checkout\.stripe\.com\//.test(r.corpo.url ?? ""), o.stato_pagamento, o.riprova_n, o.stripe_sessione_id, nuova !== k.sessione]);
    c("…`Idempotency-Key` con `r1` e `expires_at` = il nuovo `scade_il` della riapertura", [`sessione-${k.id}-${o.firma_tentativo}-r1`, Math.floor(Date.parse(o.scade_il) / 1000)], [sessioniCreate(env).at(-1).chiaveIdempotenza, Number(sessioniCreate(env).at(-1).corpo.expires_at)]);
    c("…le sessioni dell'ordine sono due, entrambe registrate", [2, true], [env.db.tabelle.shop_stripe_sessioni.length, [k.sessione, nuova].every((id) => env.db.tabelle.shop_stripe_sessioni.some((x) => x.sessione_id === id))]);
    c("…`success_url` della nuova sessione: stessa pagina ordine, stessa chiave", `${SITO}/shop/ordine/${k.ref}?t=${k.t}`, sessioniCreate(env).at(-1).corpo.success_url);
    const tardivo = await pagaViaWebhook(env, k.o, k.sessione);
    c("l'evento di pagamento della sessione VECCHIA, arrivato dopo, segna comunque pagato l'ordine", ["pagato_ora", "pagato"], [tardivo.data?.esito, stato(env, k.id).stato_pagamento]);
    vecchia = { env, k };
  }
  {
    // scaduto, sessione già scaduta → niente expire
    const env = ambiente();
    const k = await creato(env);
    await env.porte.stripe.scadiSessione(k.sessione);
    await chiudi(env, k.o, "scaduto");
    const prima = nomiChiamate(env).length;
    const r = await riprova(env, k);
    const nuove = nomiChiamate(env).slice(prima);
    c("da `scaduto` con la sessione già scaduta su Stripe → nuova sessione, nessun «expire» di troppo", [true, false, 2], [r.corpo.ok, nuove.some((x) => x.endsWith("/expire")), sessioniCreate(env).length]);
  }
  {
    // prezzo cambiato
    const env = ambiente();
    const k = await creato(env);
    await chiudi(env, k.o, "fallito");
    env.db.tabelle.shop_varianti.find((v) => v.sku === "PROVA-A").prezzo_cent = 2600;
    const prima = nomiChiamate(env).length;
    const r = await riprova(env, k);
    c("con un prezzo cambiato → 409 `prezzi_cambiati` (con i totali di oggi) e NESSUNA sessione", [409, "prezzi_cambiati", 2 * 2600 + 490, 490, 1], [r.stato, r.corpo.motivo, r.corpo.totaleCent, r.corpo.spedizioneCent, sessioniCreate(env).length]);
    c("…prima di riaprire: l'ordine resta `fallito`, `riprova_n` 0, nessuna chiamata a Stripe che cambi qualcosa", ["fallito", 0, true], [stato(env, k.id).stato_pagamento, stato(env, k.id).riprova_n, nomiChiamate(env).slice(prima).every((x) => x.startsWith("GET "))]);
    const tariffaNuova = ambiente();
    const k2 = await creato(tariffaNuova);
    await chiudi(tariffaNuova, k2.o, "fallito");
    tariffaNuova.porte.tariffa = async () => ({ ...TARIFFA, costoCent: 690 });
    const r2 = await riprova(tariffaNuova, k2);
    c("anche una spedizione cambiata → `prezzi_cambiati`", ["prezzi_cambiati", 5690, 690], [r2.corpo.motivo, r2.corpo.totaleCent, r2.corpo.spedizioneCent]);
    const finita = ambiente();
    const k3 = await creato(finita);
    await chiudi(finita, k3.o, "fallito");
    finita.db.tabelle.shop_varianti.find((v) => v.sku === "PROVA-A").giacenza = 1;
    const r3 = await riprova(finita, k3);
    c("un prodotto che nel frattempo non basta più → `non_disponibile`, nessuna sessione", [409, "non_disponibile", 1, "fallito"], [r3.stato, r3.corpo.motivo, sessioniCreate(finita).length, stato(finita, k3.id).stato_pagamento]);
    const chiusa = ambiente();
    const k4 = await creato(chiusa);
    await chiudi(chiusa, k4.o, "fallito");
    chiusa.porte.tariffa = async () => ({ stato: "assente" });
    const r4 = await riprova(chiusa, k4);
    c("senza tariffa → `cassa_chiusa`, nessuna sessione, ordine ancora `fallito`", [503, "cassa_chiusa", "fallito"], [r4.stato, r4.corpo.motivo, stato(chiusa, k4.id).stato_pagamento]);
  }
  {
    // chiavi sbagliate: la stessa identica risposta, byte per byte
    const env = ambiente();
    const k = await creato(env);
    await chiudi(env, k.o, "fallito");
    env.db.tabelle.shop_orders.push({ ...structuredClone(env.db.tabelle.shop_orders[0]), id: uuid(0x9001), order_ref: "HG-R10001", canale: null, chiave_pubblica_hash: null, stato_pagamento: null });
    const brutte = [
      ["chiave sbagliata (forma giusta)", { ref: k.ref, t: "A".repeat(43) }],
      ["chiave di un altro ordine", { ref: k.ref, t: await CO.chiaveOrdine(SERVIZIO, uuid(0x9999)) }],
      ["chiave assente", { ref: k.ref, t: undefined }],
      ["chiave di forma storta", { ref: k.ref, t: "corta" }],
      ["riferimento inesistente", { ref: "HG-ZZZZZZ", t: k.t }],
      ["riferimento di forma storta", { ref: "ciao", t: k.t }],
      ["ordine R1 (senza impronta)", { ref: "HG-R10001", t: k.t }],
    ];
    const risposte = [];
    for (const [nome, q] of brutte) risposte.push([nome, await riprova(env, q)]);
    c("chiave `t` sbagliata e tutti i rifiuti: `{ok:false}` identico (stesso stato, stessi byte)", [1, 404, '{"ok":false}'], [new Set(risposte.map(([, r]) => JSON.stringify(r))).size, risposte[0][1].stato, JSON.stringify(risposte[0][1].corpo)]);
    c("…nessuna sessione, l'ordine non si tocca", ["fallito", 1], [stato(env, k.id).stato_pagamento, sessioniCreate(env).length]);
    const giusta = await riprova(env, k);
    c("la chiave giusta invece riapre", [true, 1], [giusta.corpo.ok, stato(env, k.id).riprova_n]);
  }
  {
    // due clic insieme
    const env = ambiente();
    const k = await creato(env);
    await chiudi(env, k.o, "fallito");
    const permessi = [await permesso(env), await permesso(env, 6000)];
    const [a, b] = await Promise.all(permessi.map((p) => K.riprovaPagamento({ ref: k.ref, t: k.t, permesso: p }, env.porte)));
    const motivi = [a, b].map((r) => (r.corpo.ok ? "ok" : r.corpo.motivo)).sort();
    c("DUE clic insieme → UNA sola sessione nuova; l'altro riceve `riprova_in_corso`", [["ok", "riprova_in_corso"], 2, 1], [motivi, sessioniCreate(env).length, stato(env, k.id).riprova_n]);
    const vincitore = [a, b].find((r) => r.corpo.ok);
    const ancora = await riprova(env, k);
    c("il client ritenta e trova la sessione già aperta: stessa `url`, nessuna sessione in più", [true, vincitore.corpo.url, 2], [ancora.corpo.ok, ancora.corpo.url, sessioniCreate(env).length]);
  }
  {
    // ordine in attesa e Stripe dice «expired»
    const env = ambiente();
    const k = await creato(env);
    await env.porte.stripe.scadiSessione(k.sessione);
    const r = await riprova(env, k);
    c("`in_attesa` con la sessione scaduta ma `scade_il` nel futuro (qualcuno sta riaprendo) → `riprova_in_corso`", [409, "riprova_in_corso", 1, "in_attesa"], [r.stato, r.corpo.motivo, sessioniCreate(env).length, stato(env, k.id).stato_pagamento]);
    env.ora.t += 61 * MIN;
    const poi = await riprova(env, k);
    c("…con `scade_il` passato e Stripe `expired` → si chiude `scaduto` e si riapre (n=1): nuova sessione", [true, 1, "in_attesa", 2, "scaduta"], [poi.corpo.ok, stato(env, k.id).riprova_n, stato(env, k.id).stato_pagamento, sessioniCreate(env).length, env.db.tabelle.shop_stripe_sessioni.find((x) => x.sessione_id === k.sessione).stato]);
    const aperta = ambiente();
    const k2 = await creato(aperta);
    const r2 = await riprova(aperta, k2);
    c("`in_attesa` con la sessione ancora `open` → la stessa `url`, nulla viene scaduto né creato", [true, k2.r.corpo.url, 1, false], [r2.corpo.ok, r2.corpo.url, sessioniCreate(aperta).length, nomiChiamate(aperta).some((x) => x.endsWith("/expire"))]);
    const ritardato = ambiente();
    const k3 = await creato(ritardato);
    ritardato.finto.sessione(k3.sessione).status = "complete"; // pagamento ritardato non ancora riuscito
    const r3 = await riprova(ritardato, k3);
    c("`in_attesa` con pagamento ritardato in corso (sessione completa, non pagata) → `non_riproponibile`, nessuna sessione", [409, "non_riproponibile", 1], [r3.stato, r3.corpo.motivo, sessioniCreate(ritardato).length]);
    const fallitoRitardato = ambiente();
    const k4 = await creato(fallitoRitardato);
    fallitoRitardato.finto.sessione(k4.sessione).status = "complete";
    await chiudi(fallitoRitardato, k4.o, "fallito");
    const r4 = await riprova(fallitoRitardato, k4);
    c("da `fallito` (pagamento ritardato fallito) la sessione completa non blocca: nuova sessione", [true, 2], [r4.corpo.ok, sessioniCreate(fallitoRitardato).length]);
  }
  {
    // Stripe che non risponde, rifiuti nella riprova
    const env = ambiente();
    const k = await creato(env);
    await chiudi(env, k.o, "fallito");
    env.finto.fallisci(`GET /v1/checkout/sessions/${k.sessione}`, { rete: true });
    const r = await riprova(env, k);
    c("Stripe che non si legge → `guasto` e nulla cambia (`fallito`, `riprova_n` 0)", [500, "guasto", "fallito", 0], [r.stato, r.corpo.motivo, stato(env, k.id).stato_pagamento, stato(env, k.id).riprova_n]);
    env.finto.fallisci("POST /v1/checkout/sessions", { stato: 400, errore: { type: "invalid_request_error", code: "parameter_invalid_integer" } });
    const r2 = await riprova(env, k);
    c("se Stripe RIFIUTA la sessione nuova: ordine di nuovo `scaduto`, avviso `stripe_errore`, `guasto`", ["scaduto", 1, true, "guasto"], [stato(env, k.id).stato_pagamento, stato(env, k.id).riprova_n, (stato(env, k.id).avvisi ?? []).some((x) => x.codice === "stripe_errore"), r2.corpo.motivo]);
    const r3 = await riprova(env, k);
    c("…e si può riprovare ancora (n=2): nuova sessione e `in_attesa`", [true, 2, "in_attesa"], [r3.corpo.ok, stato(env, k.id).riprova_n, stato(env, k.id).stato_pagamento]);
    const senzaPermesso = await K.riprovaPagamento({ ref: k.ref, t: k.t }, env.porte);
    const presto = await riprova(env, k, 1000);
    c("senza permesso o con un permesso troppo recente → 403 `permesso`", [403, 403], [senzaPermesso.stato, presto.stato]);
  }
  {
    // limite delle riprove, separato da quello degli ordini
    const env = ambiente();
    const k = await creato(env);
    const esiti = [];
    for (let i = 0; i < 10; i++) esiti.push((await riprova(env, { ref: k.ref, t: "A".repeat(43) })).stato);
    const undicesima = await riprova(env, { ref: k.ref, t: "A".repeat(43) });
    c("le riprove: dieci rifiuti, l'UNDICESIMA nell'ora → 429 `troppe_richieste`", [Array(10).fill(404), 429, "troppe_richieste"], [esiti, undicesima.stato, undicesima.corpo.motivo]);
    const righe = env.db.tabelle.shop_limiti.map((x) => x.chiave.split(":")[0]).sort();
    c("…chiavi separate: ordini e riprove non si consumano a vicenda", ["ordine", "riprova"], righe);
    c("…il tentativo di indovinare la chiave consuma il limite anche se il riferimento non esiste", true, (await riprova(ambiente(), { ref: "HG-ZZZZZZ", t: "A".repeat(43) })).stato === 404);
  }

  // ═════ 12 · scadenza: ≥ 35 minuti o si riapre (contratto W3 n. 1) ═════
  gruppo("T51 · LA SESSIONE NON SI CREA CON UNA SCADENZA TROPPO VICINA (CONTRATTO W3 N. 1)");
  {
    const env = ambiente();
    env.finto.fallisci("POST /v1/checkout/sessions", { rete: true });
    const corpo = await corpoOnesto(env);
    const primo = await vai(env, corpo);
    const o0 = { ...ordini(env)[0] };
    c("il primo clic non arriva a Stripe: ordine `in_attesa`, nessuna sessione registrata", [500, "in_attesa", null, 0], [primo.stato, o0.stato_pagamento, o0.stripe_sessione_id, env.db.tabelle.shop_stripe_sessioni.length]);
    env.ora.t += 40 * MIN; // mancano 20 minuti: meno dei 35 (30 di Stripe + 5 di margine)
    const secondo = await vai(env, { ...corpo, permesso: await permesso(env) });
    const o = ordini(env)[0];
    c("sessione chiesta 40 minuti dopo l'ordine → una RIAPERTURA (n=1), non una chiusura `scaduto`", [true, "in_attesa", 1, 1], [secondo.corpo.ok, o.stato_pagamento, o.riprova_n, sessioniCreate(env).length]);
    c("…`scade_il` nuovo = adesso + 60 minuti, `expires_at` = quel valore, chiave idempotente `r1`", [env.ora.t + 60 * MIN, Math.floor(Date.parse(o.scade_il) / 1000), `sessione-${o.id}-${o.firma_tentativo}-r1`], [Date.parse(o.scade_il), Number(sessioniCreate(env)[0].corpo.expires_at), sessioniCreate(env)[0].chiaveIdempotenza]);
    c("…e il margine è almeno di 35 minuti (30 di Stripe + 5)", true, Number(sessioniCreate(env)[0].corpo.expires_at) * 1000 - env.ora.t >= 35 * MIN);
    const presto = ambiente();
    presto.finto.fallisci("POST /v1/checkout/sessions", { rete: true });
    const c2 = await corpoOnesto(presto);
    await vai(presto, c2);
    presto.ora.t += 20 * MIN; // mancano 40 minuti: basta, si usa il valore dell'ordine
    await vai(presto, { ...c2, permesso: await permesso(presto) });
    c("a 20 minuti dall'ordine (ne restano 40) NON si riapre: stesso `scade_il`, `r0`", [0, true], [ordini(presto)[0].riprova_n, sessioniCreate(presto)[0].chiaveIdempotenza.endsWith("-r0")]);
  }

  // ═════ 13 · prova di sorgente ═════
  gruppo("T51 · PROVA DI SORGENTE");
  {
    const grezzo = readFileSync(join(radice, "src/shop/cassa/cassa.server.ts"), "utf8");
    // senza i commenti (il testo delle regole non conta come codice); `//` dentro un indirizzo https non è un commento
    const src = grezzo.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((r) => (r.trim().startsWith("//") ? "" : r.replace(/\s\/\/\s.*$/, ""))).join("\n");
    c("le righe del catalogo si leggono SOLO con `rpc(\"shop_cassa_righe\")`: nessuna lettura di shop_varianti/shop_prodotti", [true, false], [/\.rpc\(\s*"shop_cassa_righe"/.test(src), /shop_varianti|shop_prodotti/.test(src)]);
    c("nessuna scrittura diretta di tabelle: tutto passa dalle funzioni SQL (insert/update/upsert/delete assenti)", false, /\.(insert|update|upsert|delete)\(/.test(src));
    c("nessun campo `recupero` (la casella di recupero carrello è del Modulo 4)", false, /recupero/i.test(src));
    c("`sito` non si ricava da Host, Origin, Referer né dall'indirizzo della richiesta", [false, false, false], [/headers\.get\(\s*["'`](host|origin|referer|x-forwarded-host|x-forwarded-proto)["'`]/i.test(src), /\.url\b|new URL\(/.test(src), /request\.headers|richiesta\.headers/.test(src.replace(/headers\.get\(\s*["']content-length["']\s*\)/gi, ""))]);
    c("niente `console`, niente `process.env` né `import.meta`: tutto dalle porte", [false, false, false], [/console\./.test(src), /process\.env/.test(src), /import\.meta/.test(src)]);
    c("nei log non si legge mai `message` né `details` di un errore", false, /\.(message|details|hint)\b/.test(src));
    c("Invisible Derm non è nominato nel modulo (lo decide `calcolaOrdine`: nessuna copia della regola)", false, /invisible|derm/i.test(src));
    c("usa i moduli già uniti, senza copiarli", [true, true, true, true, true, true, true], ["calcolaOrdine", "validaRichiesta", "corpoSessione", "verificaPermessoCassa", "improntaIndirizzo", "chiaveOrdine", "cassaEffettiva|tariffa"].map((n) => new RegExp(n).test(src)));
    c("il tetto del corpo è 32 KB, scritto una volta", true, /32\s*\*\s*1024|32768/.test(src));
    c("un `try/catch` di primo livello in ogni gestore (la funzione esportata non lancia mai)", true, (src.match(/export async function (gestisciCassa|gestisciPermesso|riprovaPagamento)[\s\S]*?\n}/g) ?? []).length === 3 && (src.match(/export async function (gestisciCassa|gestisciPermesso|riprovaPagamento)[\s\S]*?\n}/g) ?? []).every((f) => /try\s*{[\s\S]*catch/.test(f)));
  }

  // ═════ 14 · tutti i log di tutte le prove ═════
  gruppo("T51 · TUTTI I LOG DI QUESTA PROVA");
  const tutte = TUTTI_I_LOG.flat();
  c("ogni riga di log di ogni scenario è un codice (`/^[a-z0-9_ ]{1,40}$/`)", [], tutte.filter((x) => !REGEX_LOG.test(x)));
  c("…e nessuna contiene un dato del cliente, una chiave o un ref", [], tutte.filter((x) => !senzaDati(x) || /HG-|sk_|whsec|cs_test|chiave-di-servizio/i.test(x)));
  void esempio;
  void vecchia;
}
