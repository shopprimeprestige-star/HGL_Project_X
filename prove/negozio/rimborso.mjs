/** ── NEGOZIO · R2 · T47 · IL RIMBORSO (PURO) ──────────────────────────────────────────────────────────────
 *  `src/crm/ecommerce/rimborso.ts` (D55, SPEC 7.4 n. 5): il massimo rimborsabile (pagato meno i rimborsi `richiesto` E `riuscito`, come
 *  `shop_rimborso_prenota` in SQL) e il controllo di una richiesta: importo intero > 0 e non oltre il massimo, motivo 5..500 caratteri,
 *  conferma esplicita, chiave di richiesta (UUID). Ogni rifiuto ha la sua frase. Dati inventati. */
import { rigaOrdineProva } from "../ecommerce/dati.mjs";

export async function prove(mod, { c, gruppo }) {
  const O = mod["ecommerce/ordine"];
  const R = mod["ecommerce/rimborso"];
  const ID = "00000000-0000-4000-8000-000000000001";
  const CHIAVE = "00000000-0000-4000-8000-0000000000c1";
  const pagato = (extra = {}) => O.normalizzaOrdine(rigaOrdineProva({ stato_pagamento: "pagato", pagato_il: "2026-11-20T10:00:00.000Z", pagato_importo: 24.9, metodo_pagamento: "stripe", canale: "sito", totale_cent: 2490, ...extra }));
  const rimb = (importoCent, stato) => ({ importoCent, stato });
  const ok = (extra = {}) => ({ importoCent: 1000, motivo: "Prodotto danneggiato", chiaveRichiesta: CHIAVE, conferma: true, ...extra });
  gruppo("NEGOZIO R2 · IL RIMBORSO (T47)");

  // ── il massimo ──
  c("massimo: pagato 24,90 e nessun rimborso → 2490 centesimi", 2490, R.massimoRimborsabileCent(pagato(), []));
  c("massimo: un rimborso RICHIESTO (non ancora riuscito) lo riduce subito", 1490, R.massimoRimborsabileCent(pagato(), [rimb(1000, "richiesto")]));
  c("massimo: un rimborso RIUSCITO lo riduce", 1490, R.massimoRimborsabileCent(pagato({ stato_pagamento: "rimborsato_in_parte" }), [rimb(1000, "riuscito")]));
  c("massimo: richiesto + riuscito si sommano", 990, R.massimoRimborsabileCent(pagato(), [rimb(1000, "richiesto"), rimb(500, "riuscito")]));
  c("massimo: un rimborso FALLITO libera la cifra", 2490, R.massimoRimborsabileCent(pagato(), [rimb(1000, "fallito")]));
  c("massimo: mai sotto zero", 0, R.massimoRimborsabileCent(pagato(), [rimb(3000, "riuscito")]));
  c("massimo: tutto rimborsato → 0", 0, R.massimoRimborsabileCent(pagato({ stato_pagamento: "rimborsato" }), [rimb(2490, "riuscito")]));
  c("massimo: ordine non pagato (in attesa, scaduto, fallito, da incassare) → 0", [0, 0, 0, 0], ["in_attesa", "scaduto", "fallito", "da_incassare"].map((s) => R.massimoRimborsabileCent(pagato({ stato_pagamento: s, pagato_il: null, pagato_importo: null }), [])));
  c("massimo: ordine vecchio (colonna vuota) → 0: i suoi soldi non passano da Stripe", 0, R.massimoRimborsabileCent(O.normalizzaOrdine(rigaOrdineProva({ pagato_il: "2026-11-20T10:00:00.000Z", pagato_importo: 24.9 })), []));
  c("massimo: l'importo pagato è `pagato_importo` (come il SQL): niente importo → 0", 0, R.massimoRimborsabileCent(pagato({ pagato_importo: null }), []));
  c("massimo: elenco assente, che non è un elenco o con voci illeggibili → 0 (fallisce chiuso, mai «nessun rimborso»)", [0, 0, 0, 0, 0], [undefined, null, "boh", [null], [{ stato: "boh", importoCent: 100 }]].map((l) => R.massimoRimborsabileCent(pagato(), l)));
  c("rimborsiLeggibili / haRimborsoAttivo", [true, true, false, false, true, false, false], [R.rimborsiLeggibili([]), R.rimborsiLeggibili([rimb(100, "fallito")]), R.rimborsiLeggibili(undefined), R.rimborsiLeggibili([{ stato: "riuscito" }]), R.haRimborsoAttivo([rimb(100, "richiesto")]), R.haRimborsoAttivo([rimb(100, "fallito")]), R.haRimborsoAttivo("boh")]);
  c("massimo: importo in centesimi senza errori binari (19,99 → 1999, 0,29 → 29)", [1999, 29], [R.massimoRimborsabileCent(pagato({ pagato_importo: 19.99 }), []), R.massimoRimborsabileCent(pagato({ pagato_importo: 0.29 }), [])]);

  // ── la richiesta buona ──
  const buono = R.controllaRimborso(ok(), pagato(), []);
  c("richiesta buona → ok, con importo, motivo e chiave normalizzati", [true, 1000, "Prodotto danneggiato", CHIAVE], [buono.ok, buono.importoCent, buono.motivo, buono.chiaveRichiesta]);
  c("il motivo si taglia agli spazi", "Reso per taglia", R.controllaRimborso(ok({ motivo: "   Reso per taglia \n" }), pagato(), []).motivo);
  c("rimborso totale (= il massimo) → ok", true, R.controllaRimborso(ok({ importoCent: 2490 }), pagato(), []).ok);
  c("rimborso in parte su un ordine già rimborsato in parte → ok fino al massimo", [true, false], [R.controllaRimborso(ok({ importoCent: 1490 }), pagato({ stato_pagamento: "rimborsato_in_parte" }), [rimb(1000, "riuscito")]).ok, R.controllaRimborso(ok({ importoCent: 1491 }), pagato({ stato_pagamento: "rimborsato_in_parte" }), [rimb(1000, "riuscito")]).ok]);

  // ── le richieste rifiutate: ognuna con la sua frase ──
  const no = (richiesta, o = pagato(), rimborsi = []) => R.controllaRimborso(richiesta, o, rimborsi);
  const rifiuta = (nome, r, regex) => c(`rifiutato: ${nome}`, [false, true, true], [r.ok, typeof r.errore === "string" && r.errore.length > 12, regex.test(r.errore ?? "")]);
  rifiuta("oltre il massimo (e la frase dice quanto si può)", no(ok({ importoCent: 2491 })), /al massimo.*24,90/);
  rifiuta("oltre il massimo che tiene conto dei rimborsi RICHIESTI", no(ok({ importoCent: 500 }), pagato(), [rimb(2200, "richiesto")]), /al massimo.*2,90/);
  rifiuta("elenco dei rimborsi illeggibile", R.controllaRimborso(ok(), pagato(), undefined), /rimborsi/i);
  rifiuta("importo 0", no(ok({ importoCent: 0 })), /importo/i);
  rifiuta("importo negativo", no(ok({ importoCent: -100 })), /importo/i);
  rifiuta("importo con decimali (12,5 centesimi)", no(ok({ importoCent: 12.5 })), /importo|centesim/i);
  rifiuta("importo in testo", no(ok({ importoCent: "1000" })), /importo/i);
  rifiuta("importo non numero (NaN, Infinity, assente)", no(ok({ importoCent: NaN })), /importo/i);
  c("importo Infinity, assente, null → rifiutati", [false, false, false], [Infinity, undefined, null].map((v) => no(ok({ importoCent: v })).ok));
  rifiuta("motivo vuoto", no(ok({ motivo: "" })), /motivo/i);
  rifiuta("motivo di soli spazi", no(ok({ motivo: "      " })), /motivo/i);
  rifiuta("motivo di 4 caratteri", no(ok({ motivo: "abcd" })), /motivo.*5/i);
  rifiuta("motivo di 501 caratteri", no(ok({ motivo: "a".repeat(501) })), /motivo.*500/i);
  rifiuta("motivo non testo", no(ok({ motivo: 12345 })), /motivo/i);
  c("motivo di 5 e di 500 caratteri → ok", [true, true], [no(ok({ motivo: "abcde" })).ok, no(ok({ motivo: "a".repeat(500) })).ok]);
  rifiuta("senza conferma", no(ok({ conferma: undefined })), /conferm/i);
  c("conferma falsa, «true» in testo, 1 → rifiutate (serve `true`)", [false, false, false], [false, "true", 1].map((v) => no(ok({ conferma: v })).ok));
  rifiuta("chiave di richiesta che non è un UUID", no(ok({ chiaveRichiesta: "abc" })), /chiave|richiesta/i);
  c("chiave assente → rifiutata", false, no(ok({ chiaveRichiesta: undefined })).ok);
  rifiuta("ordine in attesa di pagamento", no(ok(), pagato({ stato_pagamento: "in_attesa", pagato_il: null, pagato_importo: null })), /non (è|risulta) pagat/i);
  rifiuta("ordine già rimborsato del tutto", no(ok(), pagato({ stato_pagamento: "rimborsato" }), [rimb(2490, "riuscito")]), /rimborsat|niente|nulla/i);
  rifiuta("ordine vecchio (non passa da Stripe)", no(ok(), O.normalizzaOrdine(rigaOrdineProva({ pagato_il: "2026-11-20T10:00:00.000Z", pagato_importo: 24.9 }))), /Stripe/);
  rifiuta("richiesta che non è un oggetto", no(null), /richiesta/i);
  c("richiesta undefined, testo, elenco → rifiutata senza lanciare", [false, false, false], [undefined, "rimborsa", []].map((r) => no(r).ok));

  // ── non muta niente ──
  const o = Object.freeze(pagato());
  const lista = Object.freeze([Object.freeze(rimb(500, "richiesto"))]);
  const richiesta = Object.freeze(ok());
  let lancia = false;
  try { R.controllaRimborso(richiesta, o, lista); R.massimoRimborsabileCent(o, lista); } catch { lancia = true; }
  c("non muta l'ordine, i rimborsi né la richiesta (tutto congelato)", false, lancia);
}
