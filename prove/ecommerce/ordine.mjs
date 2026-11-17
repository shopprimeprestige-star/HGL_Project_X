/** ── E-COMMERCE · T3 · IL MODELLO DELL'ORDINE ──────────────────────────────
 *  `src/crm/ecommerce/ordine.ts` legge una riga di `shop_orders` (come la dà la rotta) e la
 *  trasforma in un `Ordine` sempre sano: mai `NaN`, mai eccezioni, righe e testi con un tetto.
 *  Dati inventati (`dati.mjs`): nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rigaOrdineProva } from "./dati.mjs";

export async function prove(mod, { c, gruppo, radice }) {
  const O = mod["ecommerce/ordine"];
  const N = O.normalizzaOrdine;
  const src = readFileSync(join(radice, "src/crm/ecommerce/ordine.ts"), "utf8");

  gruppo("E-COMMERCE · MODELLO DELL'ORDINE (17/11/2026)");

  //  ── riga completa ──
  const o = N(rigaOrdineProva());
  c("riga completa: id, riferimento, data", ["00000000-0000-4000-8000-000000000001", "HG-PROVA1", "2026-11-17T10:00:00.000Z"], [o.id, o.ref, o.creatoIl]);
  c("riga completa: dati del cliente", ["Anna", "Esempio", "anna.esempio@example.com", "+39 300 000 0001", "Via Inventata 1", "Cittàfinta", "00000", null],
    [o.nome, o.cognome, o.email, o.telefono, o.indirizzo, o.citta, o.cap, o.note]);
  c("riga completa: una riga d'ordine tradotta", [{ prodottoId: "prodotto-uno", nome: "Prodotto di prova", slug: "prodotto-di-prova", variante: null, qty: 1, prezzo: 20 }], o.righe);
  c("riga completa: importi e righe non troncate", [20, 4.9, 24.9, false], [o.subtotale, o.spedizione, o.totale, o.righeTroncate]);
  c("riga completa: stato nuovo, grezzo «nuovo»", ["nuovo", "nuovo"], [o.stato, o.statoGrezzo]);
  c("riga di prima di M1: colonne nuove vuote", [null, false, null, null, null, null, null, null],
    [o.leadId, o.senzaLead, o.pagatoIl, o.pagatoImporto, o.metodoPagamento, o.tracking, o.noteInterne, o.aggiornatoIl]);
  c("riga completa: totaleCoerente", true, O.totaleCoerente(o));

  const m1 = N(rigaOrdineProva({
    lead_id: "00000000-0000-4000-8000-0000000000a1", senza_lead: true, pagato_il: "2026-11-18T09:00:00Z", pagato_importo: "24.90",
    metodo_pagamento: "bonifico", tracking: " TRK123 ", note_interne: "chiamare prima", aggiornato_il: "2026-11-18T09:05:00Z", note: "citofono rotto",
  }));
  c("colonne di M1: lettura", ["00000000-0000-4000-8000-0000000000a1", true, "2026-11-18T09:00:00Z", 24.9, "bonifico", "TRK123", "chiamare prima", "2026-11-18T09:05:00Z", "citofono rotto"],
    [m1.leadId, m1.senzaLead, m1.pagatoIl, m1.pagatoImporto, m1.metodoPagamento, m1.tracking, m1.noteInterne, m1.aggiornatoIl, m1.note]);
  c("metodo di pagamento sconosciuto → «altro»", "altro", N(rigaOrdineProva({ metodo_pagamento: "baratto" })).metodoPagamento);
  c("metodo di pagamento vuoto → null", null, N(rigaOrdineProva({ metodo_pagamento: "  " })).metodoPagamento);
  c("pagato_il illeggibile → null (non incassato)", null, N(rigaOrdineProva({ pagato_il: "ieri" })).pagatoIl);
  c("tracking/nota interna vuoti → null", [null, null], [N(rigaOrdineProva({ tracking: "  ", note_interne: "" })).tracking, N(rigaOrdineProva({ tracking: "  ", note_interne: "" })).noteInterne]);
  c("lead_id non testo → null", null, N(rigaOrdineProva({ lead_id: 42 })).leadId);
  c("senza_lead solo se è proprio true", [false, false, true], [N(rigaOrdineProva({ senza_lead: "true" })).senzaLead, N(rigaOrdineProva({ senza_lead: null })).senzaLead, N(rigaOrdineProva({ senza_lead: true })).senzaLead]);

  //  ── items di ogni forma ──
  for (const [nome, items] of [["null", null], ["mancante", undefined], ["stringa", "non sono righe"], ["oggetto", { a: 1 }], ["numero", 7]]) {
    const r = N(rigaOrdineProva({ items }));
    c(`items ${nome} → nessuna riga, ordine valido`, [[], false], [r.righe, r.righeTroncate]);
  }
  const rotto = N(rigaOrdineProva({ items: [null, 3, "x", [], { name: "Buono", qty: 2, unit_price: 5 }] }));
  c("items con elementi rotti: restano solo gli oggetti", ["Buono"], rotto.righe.map((r) => r.nome));
  c("riga senza nome → «Prodotto senza nome»", ["Prodotto senza nome", "Prodotto senza nome"],
    N(rigaOrdineProva({ items: [{ qty: 1, unit_price: 1 }, { name: "   ", qty: 1, unit_price: 1 }] })).righe.map((r) => r.nome));
  c("variante a oggetto → testo leggibile", "Colore: 1B, Lunghezza: 8\"", N(rigaOrdineProva({ items: [{ name: "X", qty: 1, unit_price: 1, variant: { Colore: "1B", Lunghezza: '8"' } }] })).righe[0].variante);
  c("variante vuota o strana → null", [null, null, null], [{}, 5, null].map((variant) => N(rigaOrdineProva({ items: [{ name: "X", qty: 1, unit_price: 1, variant }] })).righe[0].variante));

  //  ── prezzi e quantità ──
  const pr = (unit_price, qty = 1) => N(rigaOrdineProva({ items: [{ name: "X", qty, unit_price }] })).righe[0];
  c("prezzo numero", 12.5, pr(12.5).prezzo);
  c("prezzo stringa col punto", 12.5, pr("12.50").prezzo);
  c("prezzo stringa con la virgola", 12.5, pr("12,50").prezzo);
  c("prezzo illeggibile → 0, mai NaN", [0, 0, 0, 0, 0], [pr("abc").prezzo, pr(null).prezzo, pr(undefined).prezzo, pr(NaN).prezzo, pr({}).prezzo]);
  c("prezzo infinito o negativo → 0", [0, 0], [pr(Infinity).prezzo, pr(-3).prezzo]);
  c("quantità negativa → 0", 0, pr(1, -2).qty);
  c("quantità frazionaria → per difetto", 2, pr(1, 2.7).qty);
  c("quantità illeggibile → 0", [0, 0], [pr(1, "tre").qty, pr(1, null).qty]);
  c("quantità in stringa → numero", 3, pr(1, "3").qty);

  //  ── importi dell'ordine ──
  const senzaTotali = N(rigaOrdineProva({ subtotal: "boh", shipping: null, total: undefined, items: [{ name: "A", qty: 2, unit_price: 10.1 }, { name: "B", qty: 1, unit_price: 0.2 }] }));
  c("subtotal/total illeggibili: somma righe, spedizione 0", [20.4, 0, 20.4], [senzaTotali.subtotale, senzaTotali.spedizione, senzaTotali.totale]);
  const conSped = N(rigaOrdineProva({ subtotal: null, shipping: "4.9", total: "x", items: [{ name: "A", qty: 1, unit_price: 20 }] }));
  c("total illeggibile = somma righe + spedizione", [20, 4.9, 24.9], [conSped.subtotale, conSped.spedizione, conSped.totale]);
  c("importi mai NaN su una riga tutta rovinata", true,
    Object.values(N({ id: "x", created_at: "2026-11-17T10:00:00Z", subtotal: {}, shipping: [], total: "??", items: [{ qty: {}, unit_price: [] }] })).filter((v) => typeof v === "number").every(Number.isFinite));
  c("importo vuoto «» = illeggibile, non zero", 20, N(rigaOrdineProva({ subtotal: "" })).subtotale);
  c("totaleCoerente: totale diverso dalla somma → falso", false, O.totaleCoerente(N(rigaOrdineProva({ total: 99 }))));
  c("totaleCoerente: subtotale diverso dalle righe → falso", false, O.totaleCoerente(N(rigaOrdineProva({ subtotal: 50, total: 54.9 }))));
  c("totaleCoerente: tollera il centesimo", true, O.totaleCoerente(N(rigaOrdineProva({ total: 24.905 }))));
  c("totaleCoerente: righe troncate, controlla solo subtotale + spedizione", [true, false],
    [O.totaleCoerente(N(rigaOrdineProva({ items: Array.from({ length: 300 }, () => ({ name: "A", qty: 1, unit_price: 1 })), subtotal: 300, shipping: 0, total: 300 }))),
     O.totaleCoerente(N(rigaOrdineProva({ items: Array.from({ length: 300 }, () => ({ name: "A", qty: 1, unit_price: 1 })), subtotal: 300, shipping: 0, total: 5 })))]);

  //  ── ordine enorme ──
  const mille = (n) => Array.from({ length: n }, (_, i) => ({ product_id: `p${i}`, name: `Prodotto ${i}`, qty: 1, unit_price: 1 }));
  const grande = N(rigaOrdineProva({ items: mille(500), subtotal: 500, shipping: 0, total: 500 }));
  c("500 righe: ne restano 200, righeTroncate", [200, true, "Prodotto 199"], [grande.righe.length, grande.righeTroncate, grande.righe[199].nome]);
  const giusto = N(rigaOrdineProva({ items: mille(200), subtotal: 200, shipping: 0, total: 200 }));
  c("200 righe esatte: non troncate", [200, false], [giusto.righe.length, giusto.righeTroncate]);
  c("500 righe, importi illeggibili: la somma conta tutte le righe, non solo le 200 tenute", [500, 500], (() => { const g = N(rigaOrdineProva({ items: mille(500), subtotal: null, total: null, shipping: 0 })); return [g.subtotale, g.totale]; })());

  //  ── testo gigante ──
  const cinqueMb = "x".repeat(5 * 1024 * 1024);
  let lanciato = null;
  let g;
  try { g = N(rigaOrdineProva({ nome: cinqueMb, note: cinqueMb, email: cinqueMb, tracking: cinqueMb, note_interne: cinqueMb, status: cinqueMb, items: [{ name: cinqueMb, qty: 1, unit_price: 1, variant: { a: cinqueMb } }] })); } catch (e) { lanciato = String(e); }
  c("campi di testo da 5 MB: non lancia", null, lanciato);
  c("campi di testo da 5 MB: tenuti entro un tetto", true, !!g && [g.nome, g.note, g.email, g.tracking, g.noteInterne, g.statoGrezzo, g.righe[0].nome, g.righe[0].variante].every((t) => t.length <= 5000));
  c("campo da 5 MB: l'ordine resta leggibile", ["nuovo", 1], [g?.stato, g?.righe.length]);

  //  ── stato ──
  c("stati noti", ["nuovo", "in_preparazione", "spedito", "consegnato", "annullato"], O.STATI_ORDINE);
  c("ogni stato ha la sua etichetta", true, O.STATI_ORDINE.every((s) => typeof O.ETICHETTA_STATO[s] === "string" && O.ETICHETTA_STATO[s]));
  c("ogni metodo ha la sua etichetta", true, ["bonifico", "contanti", "carta", "altro"].every((s) => O.ETICHETTA_METODO[s]));
  for (const s of O.STATI_ORDINE) c(`stato ${s} riconosciuto`, [s, s], [N(rigaOrdineProva({ status: s })).stato, N(rigaOrdineProva({ status: s })).statoGrezzo]);
  const strano = N(rigaOrdineProva({ status: "in_viaggio" }));
  c("stato sconosciuto → nuovo, col grezzo", ["nuovo", "in_viaggio"], [strano.stato, strano.statoGrezzo]);
  c("stato maiuscolo o con spazi → riconosciuto", "spedito", N(rigaOrdineProva({ status: " SPEDITO " })).stato);
  c("stato mancante → nuovo, grezzo vuoto", ["nuovo", ""], [N(rigaOrdineProva({ status: null })).stato, N(rigaOrdineProva({ status: null })).statoGrezzo]);
  c("eAnnullato", [true, false], [O.eAnnullato(N(rigaOrdineProva({ status: "annullato" }))), O.eAnnullato(o)]);

  //  ── id e data: senza, è scarto ──
  c("senza id → null", [null, null, null, null], [N(rigaOrdineProva({ id: null })), N(rigaOrdineProva({ id: "" })), N(rigaOrdineProva({ id: "   " })), N(rigaOrdineProva({ id: 5 }))]);
  c("senza data → null", [null, null, null], [N(rigaOrdineProva({ created_at: null })), N(rigaOrdineProva({ created_at: "non è una data" })), N(rigaOrdineProva({ created_at: undefined }))]);
  c("non è una riga → null", [null, null, null, null, null], [N(null), N(undefined), N("ordine"), N(12), N([])]);
  c("riferimento mancante → inizio dell'id", "00000000", N(rigaOrdineProva({ order_ref: null })).ref);

  //  ── normalizzaTutti conta gli scarti ──
  const tutti = O.normalizzaTutti([
    rigaOrdineProva(), rigaOrdineProva({ id: "00000000-0000-4000-8000-000000000002" }),
    rigaOrdineProva({ id: null }), rigaOrdineProva({ created_at: "zzz" }), null, "no",
  ]);
  c("normalizzaTutti: due buone, quattro scartate", [2, 4], [tutti.ordini.length, tutti.scartati]);
  c("normalizzaTutti: ordine di arrivo conservato", ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-8000-000000000002"], tutti.ordini.map((x) => x.id));
  c("normalizzaTutti: vuoto", { ordini: [], scartati: 0 }, O.normalizzaTutti([]));
  c("normalizzaTutti: non un elenco → vuoto, non lancia", { ordini: [], scartati: 0 }, O.normalizzaTutti(null));

  //  ── chiavi e helper ──
  c("chiaveEmail: minuscolo e senza spazi", "anna.esempio@example.com", O.chiaveEmail(" Anna.Esempio@Example.COM "));
  c("chiaveEmail: spazi in mezzo", "anna@example.com", O.chiaveEmail("An na@example.com"));
  c("chiaveEmail: senza @ → vuota", ["", "", ""], [O.chiaveEmail("anna.example.com"), O.chiaveEmail(null), O.chiaveEmail(undefined)]);
  const sei = ["339 1234567", "+39 339 1234567", "0039 339 1234567", "3391234567", "+39-339-1234567", "39 339 1234567"];
  c("chiaveTelefono: i sei modi danno la stessa chiave", [1, true], [new Set(sei.map(O.chiaveTelefono)).size, O.chiaveTelefono(sei[0]) === "391234567"]);
  c("chiaveTelefono: troppo corto → vuota", "", O.chiaveTelefono("12345"));
  c("nomeCliente", ["Anna Esempio", "Anna", "Senza nome"], [O.nomeCliente(o), O.nomeCliente({ nome: "Anna", cognome: "" }), O.nomeCliente({ nome: " ", cognome: "" })]);
  const inc = N(rigaOrdineProva({ pagato_il: "2026-11-18T09:00:00Z" }));
  c("eIncassato", [false, true], [O.eIncassato(o), O.eIncassato(inc)]);
  c("importoIncassato: pagato_importo se c'è, altrimenti il totale", [24.9, 10, 0], [O.importoIncassato(inc), O.importoIncassato(N(rigaOrdineProva({ pagato_il: "2026-11-18T09:00:00Z", pagato_importo: 10 }))), O.importoIncassato(N(rigaOrdineProva({ pagato_il: "2026-11-18T09:00:00Z", pagato_importo: 0 })))]);

  //  ── il modulo resta puro ──
  c("ordine.ts: niente React, Supabase, window, console", false, /from\s+["'](react|@supabase|@\/integrations)|\bwindow\b|\bdocument\b|console\./.test(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "")));
}
