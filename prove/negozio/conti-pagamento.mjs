/** ── NEGOZIO · R2 · T46 · I CONTI CON LO STATO DI PAGAMENTO ────────────────────────────────────────────────
 *  `src/crm/ecommerce/conti.ts` dopo il Rilascio 2 (D41, D52, D58; regola n. 2 del product owner). Le cifre degli ordini R1/R2 NON
 *  cambiano (lo prova `conti-invariati.mjs`, la fotografia di 46cf8d5): qui si prova ciò che è NUOVO.
 *   · gli ordini in attesa, scaduti, falliti o rimborsati del tutto non entrano in «Ordini», «Da incassare», «da lavorare», «fermi», «più venduti»;
 *   · gli ordini di PROVA non entrano in nessuna cifra (si contano a parte);
 *   · «Incassato» legge lo stato di pagamento, non la data da sola, e toglie i rimborsi.
 *  Dati inventati (`@example.com`): nessun dato di clienti veri. */

const NOV = { da: "2026-11-01", a: "2026-11-30" };
const ADESSO = new Date("2026-11-20T12:00:00.000Z");
const PAGATO_IL = "2026-11-11T09:00:00.000Z";

let n = 0;
/** Una riga di `shop_orders` con un solo prodotto da `totale` euro; `extra` cambia o aggiunge colonne. */
const riga = (totale, extra = {}) => {
  n++;
  return {
    id: `t46-${String(n).padStart(3, "0")}`, created_at: "2026-11-10T10:00:00.000Z", order_ref: `HG-T46-${n}`, nome: "Anna", cognome: "Esempio", email: `anna${n}@example.com`, telefono: `+39 300 000 ${String(1000 + n)}`,
    items: [{ product_id: `P${n}`, name: `Prodotto ${n}`, slug: `p${n}`, qty: 1, unit_price: totale, variant: null }], subtotal: totale, shipping: 0, total: totale, status: "nuovo", ...extra,
  };
};

export async function prove(mod, { c, gruppo }) {
  const O = mod["ecommerce/ordine"];
  const K = mod["ecommerce/conti"];
  const tutti = (righe) => O.normalizzaTutti(righe).ordini;
  const pano = (righe, adesso) => K.panoramica(tutti(righe), NOV, adesso);
  gruppo("NEGOZIO R2 · I CONTI CON LO STATO DI PAGAMENTO (T46)");

  // ── gli ordini che non sono ancora (o non sono più) un ordine ──
  const misto = [
    riga(50, { stato_pagamento: "pagato", pagato_il: PAGATO_IL, pagato_importo: 50 }), //   1 pagato                       → ordine, incassato 50
    riga(30, { stato_pagamento: "in_attesa", scade_il: "2026-11-20T13:00:00.000Z" }), //    2 in attesa (sessione aperta)  → solo «in attesa»
    riga(31, { stato_pagamento: "fallito" }), //                                           3 fallito                      → fuori
    riga(32, { stato_pagamento: "scaduto" }), //                                           4 scaduto                      → fuori
    riga(40, { stato_pagamento: "rimborsato", pagato_il: PAGATO_IL, pagato_importo: 40, rimborsato_cent: 4000 }), // 5 rimborsato → fuori da ordini, incassato n=1 importo 0
    riga(20), //                                                                           6 R1 non pagato                → ordine, da incassare 20
  ];
  const p = pano(misto, ADESSO);
  c("«Ordini»: solo il pagato e l'R1 (50 + 20); in attesa, fallito, scaduto e rimborsato non entrano", { n: 2, totale: 70, medio: 35 }, p.ordini);
  c("«Da incassare»: solo l'R1 non pagato (20); l'ordine in attesa NON è da incassare", { n: 1, importo: 20 }, p.daIncassare);
  c("«Incassato»: il pagato (50) e il rimborsato per intero (conta, ma vale 40 − 40 = 0)", { n: 2, importo: 50 }, p.incassato);
  c("nuovi campi: `inAttesa` (1), `rimborsato` (1 ordine, 40 €), `prova` (0)", [1, { n: 1, importo: 40 }, 0], [p.inAttesa, p.rimborsato, p.prova]);
  c("`perStato` conta gli stessi ordini di «Ordini» (2 nuovi), non quelli in attesa", [2, 0], [p.perStato.nuovo, p.perStato.annullato]);
  c("`importiAnomali` e `annullatiPagati` come prima: nessuno", [0, 0], [p.importiAnomali, p.annullatiPagati]);
  c("un in_attesa con la scadenza passata (letto «scaduto») non è più «in attesa»; senza «adesso» vale la tabella", [0, 1], [pano(misto, new Date("2026-11-20T14:00:00.000Z")).inAttesa, pano(misto).inAttesa]);
  c("la fase del periodo vale: un in_attesa di un altro mese non entra in `inAttesa`", 0, K.panoramica(tutti(misto), { da: "2026-12-01", a: "2026-12-31" }, ADESSO).inAttesa);

  // ── da lavorare, fermi, più venduti ──
  const os = tutti(misto);
  c("«da lavorare» (il numeretto): solo pagato e R1 → 2, non 5 (gli «nuovo» in attesa, falliti, scaduti e rimborsati non contano)", 2, K.daLavorare(os));
  c("«ordini fermi»: gli in attesa vecchi di giorni NON sono fermi da lavorare (solo pagato e R1)", [os[0].id, os[5].id], K.ordiniFermi(os, ADESSO).map((o) => o.id).sort());
  c("«più venduti»: i prodotti degli ordini in attesa, falliti, scaduti e rimborsati non ci sono", [2, ["Prodotto 1", "Prodotto 6"]], ((v) => [v.length, v.map((x) => x.nome).sort()])(K.piuVenduti(os, NOV)));

  // ── ordini di prova (D58) ──
  const conProva = [...misto, riga(99, { stato_pagamento: "pagato", pagato_il: PAGATO_IL, pagato_importo: 99, prova: true }), riga(77, { stato_pagamento: "da_incassare", prova: true }), riga(66, { stato_pagamento: "in_attesa", prova: true })];
  const pp = pano(conProva, ADESSO);
  c("un ordine di prova pagato NON entra nelle cifre: tutto come senza prova", [p.ordini, p.incassato, p.daIncassare, p.perStato, p.inAttesa, p.rimborsato], [pp.ordini, pp.incassato, pp.daIncassare, pp.perStato, pp.inAttesa, pp.rimborsato]);
  c("…ma la Panoramica dice quanti ne ha messi da parte (`prova` = 3)", 3, pp.prova);
  const osP = tutti(conProva);
  c("…e il suo stato resta visibile: `prova` vera e stato «pagato» sull'ordine", [true, "pagato"], [osP.find((o) => o.prova && o.pagatoIl)?.prova, osP.find((o) => o.prova && o.pagatoIl)?.statoPagamento]);
  c("«da lavorare», «fermi», «più venduti», clienti e riacquisto non vedono gli ordini di prova", [2, 2, 2, 2], [K.daLavorare(osP), K.ordiniFermi(osP, ADESSO).length, K.piuVenduti(osP, NOV).length, K.raggruppaClienti(osP).length]);
  c("anche l'andamento non conta le prove", K.andamento(os, NOV), K.andamento(osP, NOV));
  c("`importoFuoriNorma` non segnala un ordine di prova con un importo assurdo (non è nelle cifre)", false, K.importoFuoriNorma(tutti([riga(5e6, { prova: true })])[0]));

  // ── «Incassato» legge lo stato di pagamento, non la data da sola ──
  const incasso = (righe) => pano(righe, ADESSO).incassato;
  c("un ordine in_attesa con `pagato_il` valorizzato per errore NON conta come incassato", { n: 0, importo: 0 }, incasso([riga(60, { stato_pagamento: "in_attesa", pagato_il: PAGATO_IL, pagato_importo: 60 })]));
  c("…un fallito, uno scaduto e un da_incassare con `pagato_il` per errore, idem", { n: 0, importo: 0 }, incasso(["fallito", "scaduto", "da_incassare"].map((s) => riga(60, { stato_pagamento: s, pagato_il: PAGATO_IL, pagato_importo: 60 }))));
  c("un pagato Stripe (con la colonna) conta anche senza `pagato_importo`: vale il totale", { n: 1, importo: 61.5 }, incasso([riga(61.5, { stato_pagamento: "pagato", pagato_il: PAGATO_IL })]));
  c("un rimborsato in parte vale incasso − rimborso (100 − 30 = 70) e resta un ordine", [{ n: 1, importo: 70 }, { n: 1, totale: 100, medio: 100 }, { n: 1, importo: 30 }], ((r) => { const q = pano(r, ADESSO); return [q.incassato, q.ordini, q.rimborsato]; })([riga(100, { stato_pagamento: "rimborsato_in_parte", pagato_il: PAGATO_IL, pagato_importo: 100, rimborsato_cent: 3000 })]));
  c("un rimborso più grande dell'incasso non rende l'«Incassato» negativo (si ferma a 0)", { n: 1, importo: 0 }, incasso([riga(50, { stato_pagamento: "rimborsato_in_parte", pagato_il: PAGATO_IL, pagato_importo: 50, rimborsato_cent: 99999 })]));
  c("`rimborsato_cent` negativo o illeggibile vale 0: l'incasso resta intero", [{ n: 1, importo: 50 }, { n: 1, importo: 50 }], [-500, "boh"].map((v) => incasso([riga(50, { stato_pagamento: "pagato", pagato_il: PAGATO_IL, pagato_importo: 50, rimborsato_cent: v })])));
  c("un ordine R1 annullato e pagato conta come prima: incassato, `annullatiPagati` 1, fuori da «Ordini»", [{ n: 1, importo: 80 }, 1, 0], ((q) => [q.incassato, q.annullatiPagati, q.ordini.n])(pano([riga(80, { status: "annullato", pagato_il: PAGATO_IL, pagato_importo: 80 })], ADESSO)));
  c("un ordine Stripe annullato e pagato (non rimborsato) conta come incassato e come `annullatiPagati`", [{ n: 1, importo: 80 }, 1, 0], ((q) => [q.incassato, q.annullatiPagati, q.ordini.n])(pano([riga(80, { status: "annullato", stato_pagamento: "pagato", pagato_il: PAGATO_IL, pagato_importo: 80 })], ADESSO)));
  c("un ordine Stripe annullato e in attesa (mai pagato) non conta da nessuna parte", [0, 0, 0, 0, 0], ((q) => [q.incassato.n, q.ordini.n, q.daIncassare.n, q.perStato.annullato, q.annullatiPagati])(pano([riga(80, { status: "annullato", stato_pagamento: "in_attesa" })], ADESSO)));
  c("un ordine R1 non pagato di un altro stato conta «da incassare» come prima; il da_incassare esplicito idem", [{ n: 2, importo: 45 }, 2], ((q) => [q.daIncassare, q.ordini.n])(pano([riga(20), riga(25, { stato_pagamento: "da_incassare" })], ADESSO)));

  // ── importi assurdi: restano 0 come prima (`IMPORTO_MAX`) ──
  const assurdi = pano([
    riga(-5, { stato_pagamento: "pagato", pagato_il: PAGATO_IL }), //                                    totale negativo
    riga(5e6, { stato_pagamento: "pagato", pagato_il: PAGATO_IL, pagato_importo: 5e6 }), //                incasso enorme
    riga(10, { stato_pagamento: "pagato", pagato_il: PAGATO_IL, pagato_importo: 10, rimborsato_cent: 1e300 }), // rimborso enorme
    riga(10, { stato_pagamento: "in_attesa", total: 9e9 }), //                                            in attesa con totale assurdo: non è nelle cifre, non è anomalo
  ], ADESSO);
  c("importi negativi o enormi valgono 0 e si segnalano come prima (2 anomali: totale negativo, importo enorme); il rimborso enorme vale 0 e il pagato da 10 resta 10", [2, 10], [assurdi.importiAnomali, assurdi.incassato.importo]);
  c("…nessuna cifra è null, NaN o Infinity (nemmeno `rimborsato`)", true, !/:null|NaN|Infinity/.test(JSON.stringify(assurdi)));

  // ── l'andamento torna con la Panoramica ──
  const incassatoGiorno = (righe) => K.andamento(tutti(righe), NOV).filter((g) => g.giorno === "2026-11-10").map((g) => [g.ordini, g.incassato])[0];
  c("andamento: in attesa e fallito non fanno «ordini»; il rimborso in parte si toglie dall'incassato", [2, 70], incassatoGiorno([
    riga(100, { stato_pagamento: "rimborsato_in_parte", pagato_il: "2026-11-10T09:00:00.000Z", pagato_importo: 100, rimborsato_cent: 3000 }), riga(10), riga(50, { stato_pagamento: "in_attesa" }), riga(50, { stato_pagamento: "fallito" })]));

  // ── clienti e riacquisto: chi non ha mai pagato non è un cliente ──
  const soloAttesa = tutti([riga(10, { stato_pagamento: "in_attesa", email: "mai@example.com", telefono: "" }), riga(10, { stato_pagamento: "fallito", email: "mai@example.com", telefono: "" })]);
  c("chi ha solo ordini in attesa o falliti non è un cliente e non è «tornato»", [0, 0], [K.raggruppaClienti(soloAttesa).length, K.riacquisto(soloAttesa, NOV).clientiNelPeriodo]);
  const tornato = tutti([riga(10, { email: "torna@example.com", telefono: "" }), riga(10, { stato_pagamento: "pagato", pagato_il: PAGATO_IL, email: "torna@example.com", telefono: "", created_at: "2026-11-12T10:00:00.000Z" }), riga(10, { stato_pagamento: "in_attesa", email: "torna@example.com", telefono: "", created_at: "2026-11-13T10:00:00.000Z" })]);
  c("un cliente con due ordini veri e uno in attesa: 2 ordini (l'in attesa non conta), «tornato»", [[2], 1], [K.raggruppaClienti(tornato).map((x) => x.n), K.riacquisto(tornato, NOV).tornati]);

  // ── le due forme della base di dati: colonne assenti e default di S4 danno le stesse cifre ──
  const R1 = [riga(30), riga(40, { pagato_il: PAGATO_IL, pagato_importo: 40 }), riga(55, { status: "annullato", pagato_il: PAGATO_IL })];
  const S4 = R1.map((r) => ({ ...r, stato_pagamento: null, prova: false, rimborsato_cent: 0, scade_il: null }));
  c("righe vecchie senza colonne o con i default di S4: stessa Panoramica", pano(R1, ADESSO), pano(S4, ADESSO));
}
