/** ── E-COMMERCE · T4 · I CONTI DELLA PANORAMICA ────────────────────────────
 *  `src/crm/ecommerce/conti.ts`: periodo, ordini, incassato, da incassare, per stato, fermi,
 *  andamento, più venduti, clienti che ricomprano. Funzioni pure sugli `Ordine` di T3.
 *  Dati inventati (`dati.mjs`). Gli istanti sono costruiti con l'ORA LOCALE (come il filtro
 *  periodo del CRM): le prove danno lo stesso esito in qualunque fuso. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rigaOrdineProva } from "./dati.mjs";

export async function prove(mod, { c, gruppo, radice }) {
  const O = mod["ecommerce/ordine"];
  const K = mod["ecommerce/conti"];

  gruppo("E-COMMERCE · CONTI DELLA PANORAMICA (18/11/2026)");

  // ── aiuti ──
  const loc = (a, m, g, h = 12, mi = 0, s = 0) => new Date(a, m - 1, g, h, mi, s).toISOString();
  let seq = 0;
  /** Un ordine normalizzato; `extra` sovrascrive le colonne della tabella. Id e telefono diversi a ogni ordine. */
  const ord = (extra = {}) => {
    seq++;
    return O.normalizzaOrdine(rigaOrdineProva({
      id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
      order_ref: `HG-T${seq}`,
      telefono: `+39 300 100 ${String(1000 + seq)}`,
      email: `cliente${seq}@example.com`,
      created_at: loc(2026, 11, 10),
      ...extra,
    }));
  };
  const P = { da: "2026-11-10", a: "2026-11-12" };
  const voce = (nome, prezzo, qty = 1, extra = {}) => ({ product_id: nome.toLowerCase().replace(/\W+/g, "-"), name: nome, slug: nome.toLowerCase().replace(/\W+/g, "-"), qty, unit_price: prezzo, variant: null, ...extra });
  const tutteFinite = (x) => {
    const v = [];
    const giro = (y) => { if (typeof y === "number") v.push(y); else if (Array.isArray(y)) y.forEach(giro); else if (y && typeof y === "object") Object.values(y).forEach(giro); };
    giro(x);
    return v.every(Number.isFinite);
  };

  // ── periodo: i giorni di confine ──
  c("00:00:00 del primo giorno: dentro", true, K.nelPeriodo(ord({ created_at: loc(2026, 11, 10, 0, 0, 0) }), P));
  c("23:59:59 dell'ultimo giorno: dentro", true, K.nelPeriodo(ord({ created_at: loc(2026, 11, 12, 23, 59, 59) }), P));
  c("un secondo dopo (00:00:00 del giorno dopo): fuori", false, K.nelPeriodo(ord({ created_at: loc(2026, 11, 13, 0, 0, 0) }), P));
  c("un secondo prima del primo giorno (23:59:59): fuori", false, K.nelPeriodo(ord({ created_at: loc(2026, 11, 9, 23, 59, 59) }), P));
  c("periodo di un solo giorno", [true, false], [K.nelPeriodo(ord({ created_at: loc(2026, 11, 10, 8) }), { da: "2026-11-10", a: "2026-11-10" }), K.nelPeriodo(ord({ created_at: loc(2026, 11, 11, 8) }), { da: "2026-11-10", a: "2026-11-10" })]);
  c("periodo capovolto o illeggibile: niente è dentro, niente si rompe", [false, false, false], [
    K.nelPeriodo(ord(), { da: "2026-11-12", a: "2026-11-10" }), K.nelPeriodo(ord(), { da: "boh", a: "2026-11-12" }), K.nelPeriodo(ord(), { da: "", a: "" })]);
  c("ordine con la data nel futuro: fuori da un periodo che non lo contiene", [false, true], [
    K.nelPeriodo(ord({ created_at: loc(2031, 1, 1) }), P), K.nelPeriodo(ord({ created_at: loc(2031, 1, 1) }), { da: "2031-01-01", a: "2031-01-01" })]);
  const dst = K.nelPeriodo(ord({ created_at: loc(2026, 3, 29, 12) }), { da: "2026-03-29", a: "2026-03-29" });
  c("giorno del cambio d'ora: l'ordine di mezzogiorno è dentro", true, dst);

  // ── panoramica: cifre ──
  const A = ord({ total: 100, status: "nuovo" });
  const B = ord({ total: 50, status: "spedito", pagato_il: loc(2026, 11, 11), pagato_importo: 50 });
  const C = ord({ total: 30, status: "annullato" });
  const D = ord({ total: 20, status: "annullato", pagato_il: loc(2026, 11, 11), pagato_importo: 20 });
  const E = ord({ total: 70, status: "consegnato", pagato_il: loc(2026, 11, 11) }); // pagato_importo null → incassa il totale
  const F = ord({ total: 999, status: "nuovo", created_at: loc(2026, 11, 20) }); // fuori periodo
  const pan = K.panoramica([A, B, C, D, E, F], P);
  c("ordini: gli annullati non contano (n, totale, medio)", { n: 3, totale: 220, medio: 73.33 }, pan.ordini);
  c("incassato: ogni ordine con pagatoIl, annullati compresi", { n: 3, importo: 140 }, pan.incassato);
  c("pagato_il con pagato_importo null: incassa il totale", 70, K.panoramica([E], P).incassato.importo);
  c("importo pagato diverso dal totale: conta l'importo pagato", 40, K.panoramica([ord({ total: 50, pagato_il: loc(2026, 11, 11), pagato_importo: 40 })], P).incassato.importo);
  c("da incassare: non annullati e non pagati", { n: 1, importo: 100 }, pan.daIncassare);
  c("annullati pagati contati a parte", 1, pan.annullatiPagati);
  c("per stato: tutti e cinque, anche a zero", { nuovo: 1, in_preparazione: 0, spedito: 1, consegnato: 1, annullato: 2 }, pan.perStato);
  c("nessun ordine: tutto a zero, medio 0 (niente divisione per zero)", true, (() => {
    const v = K.panoramica([], P);
    return v.ordini.n === 0 && v.ordini.medio === 0 && v.incassato.importo === 0 && v.daIncassare.n === 0 && v.annullatiPagati === 0 && v.importiAnomali === 0 && tutteFinite(v);
  })());
  c("l'ordine in ingresso non è mutato né riordinato", [A.id, B.id], (() => { const l = [A, B]; K.panoramica(l, P); return l.map((x) => x.id); })());
  c("lo stesso order_ref due volte (id diversi): due ordini", 2, K.panoramica([ord({ order_ref: "HG-X" }), ord({ order_ref: "HG-X" })], P).ordini.n);

  // proprietà: perStato[s] = ordini del periodo con quello stato; incassato.n = ordini del periodo col filtro «pagato»
  const misti = [];
  const stati = O.STATI_ORDINE;
  for (let i = 0; i < 60; i++) misti.push(ord({ status: stati[i % 5], created_at: loc(2026, 11, 8 + (i % 7), (i * 3) % 24, (i * 7) % 60), total: (i % 9) * 10 + 5, pagato_il: i % 3 === 0 ? loc(2026, 11, 14) : null }));
  const pm = K.panoramica(misti, P);
  const nel = misti.filter((o) => K.nelPeriodo(o, P));
  c("proprietà: perStato[s] = ordini del periodo con quello stato", true, O.STATI_ORDINE.every((s) => pm.perStato[s] === nel.filter((o) => o.stato === s).length));
  c("proprietà: somma perStato = tutti gli ordini del periodo", nel.length, Object.values(pm.perStato).reduce((a, b) => a + b, 0));
  c("proprietà «pagato»: incassato.n = ordini del periodo col filtro pagato = sì", nel.filter((o) => o.pagatoIl !== null).length, pm.incassato.n);
  c("proprietà: ordini.n = periodo − annullati", nel.filter((o) => o.stato !== "annullato").length, pm.ordini.n);

  // ── importi assurdi (inseriti da anonimi) ──
  const assurdi = [
    ord({ total: -50 }), ord({ total: 1e300 }), ord({ total: "1e999" }),
    ord({ total: 40, pagato_il: loc(2026, 11, 11), pagato_importo: -9 }),
    ord({ total: 1e308, pagato_il: loc(2026, 11, 11) }),
    ord({ total: 25 }),
  ];
  const pa = K.panoramica(assurdi, P);
  c("importi assurdi: nessun NaN/Infinity in nessun campo", true, tutteFinite(pa));
  c("importi assurdi: gli ordini si contano lo stesso", 6, pa.ordini.n);
  //  -50, 1e300 e 1e308 valgono 0; "1e999" non si legge e ricade sulla somma delle righe (24,90); poi 40 e 25
  c("importi assurdi: i fuori norma valgono 0 nelle somme", 89.9, pa.ordini.totale);
  c("importi assurdi: l'importo pagato negativo vale 0", 0, pa.incassato.importo);
  c("importi assurdi: sono dichiarati (4 ordini), non spariti in silenzio", 4, pa.importiAnomali);
  c("importi assurdi: l'andamento resta finito e coerente", true, tutteFinite(K.andamento(assurdi, P)));
  c("importi assurdi: più venduti con riga enorme resta finito", true, tutteFinite(K.piuVenduti([ord({ items: [voce("Oro", 1e300, 1e300)] }), ord({ items: [voce("Oro", 1e12, 3)] })], P)));
  c("molti ordini enormi: la somma non diventa Infinity", true, tutteFinite(K.panoramica(Array.from({ length: 50 }, () => ord({ total: 1e300 })), P)));
  // il confine: 100.000 € è un ordine (grosso, ma sano), 100.000,01 no (allineato al tetto di T8)
  const aConf = K.panoramica([ord({ total: 100000 })], P);
  const oltre = K.panoramica([ord({ total: 100000.01 })], P);
  c("tetto: 100.000 € è sano, entra nelle somme", [100000, 0, 1], [aConf.ordini.totale, aConf.importiAnomali, aConf.ordini.n]);
  c("tetto: 100.000,01 € è fuori norma, vale 0 ma si conta", [0, 1, 1], [oltre.ordini.totale, oltre.importiAnomali, oltre.ordini.n]);
  c("tetto: lo stesso per l'importo pagato", [100000, 0, 0, 1], [
    K.panoramica([ord({ total: 5, pagato_il: loc(2026, 11, 11), pagato_importo: 100000 })], P).incassato.importo,
    K.panoramica([ord({ total: 5, pagato_il: loc(2026, 11, 11), pagato_importo: 100000 })], P).importiAnomali,
    K.panoramica([ord({ total: 5, pagato_il: loc(2026, 11, 11), pagato_importo: 100000.01 })], P).incassato.importo,
    K.panoramica([ord({ total: 5, pagato_il: loc(2026, 11, 11), pagato_importo: 100000.01 })], P).importiAnomali]);
  c("importoFuoriNorma: negativo, enorme, pagato fuori norma sì; sani, annullato non pagato no", [true, true, true, false, false, false], [
    K.importoFuoriNorma(ord({ total: -50 })), K.importoFuoriNorma(ord({ total: 1e300 })), K.importoFuoriNorma(ord({ total: 40, pagato_il: loc(2026, 11, 11), pagato_importo: -9 })),
    K.importoFuoriNorma(ord({ total: 100000 })), K.importoFuoriNorma(ord({ total: 40, pagato_il: loc(2026, 11, 11) })), K.importoFuoriNorma(ord({ total: -50, status: "annullato" }))]);
  c("importiAnomali = ordini del periodo per cui importoFuoriNorma è vero", true, (() => {
    const l = [...assurdi, A, B, C, D, E, ord({ total: 1e300, created_at: loc(2026, 11, 20) })];
    return K.panoramica(l, P).importiAnomali === l.filter((o) => K.nelPeriodo(o, P) && K.importoFuoriNorma(o)).length;
  })());
  c("un ordine con importo sano non è segnato anomalo", 0, K.panoramica([A, B], P).importiAnomali);

  // ── ordini fermi / da lavorare ──
  const ora = new Date(2026, 10, 18, 12, 0, 0);
  const hFa = (h, m = 0, s = 0) => new Date(ora.getTime() - ((h * 60 + m) * 60 + s) * 1000).toISOString();
  const f47 = ord({ created_at: hFa(47, 59) });
  const f48 = ord({ created_at: hFa(48, 1) });
  const fEsatto = ord({ created_at: hFa(48) });
  const fToccato = ord({ created_at: hFa(100), aggiornato_il: hFa(10) });
  const fSpedito = ord({ created_at: hFa(100), status: "spedito" });
  const fVecchio = ord({ created_at: hFa(400) });
  const fFuturo = ord({ created_at: new Date(ora.getTime() + 3600e3).toISOString() });
  c("fermi: 47h59 no, 48h01 sì, esattamente 48h no (da più di 48 ore)", [false, true, false], [
    K.ordiniFermi([f47], ora).length === 1, K.ordiniFermi([f48], ora).length === 1, K.ordiniFermi([fEsatto], ora).length === 1]);
  c("fermi: toccato (aggiornatoIl) no, già spedito no, data futura no", 0, K.ordiniFermi([fToccato, fSpedito, fFuturo], ora).length);
  c("fermi: NON seguono il periodo, il più vecchio per primo", [fVecchio.id, f48.id], K.ordiniFermi([f48, f47, fVecchio], ora).map((o) => o.id));
  c("fermi: ore diverse da 48", [1, 2], [K.ordiniFermi([f47, f48, fVecchio], ora, 72).length, K.ordiniFermi([f47, f48], ora, 24).length]);
  c("fermi: data di «adesso» illeggibile, non lancia", [], K.ordiniFermi([f48], new Date("boh")));
  c("daLavorare: tutti i «nuovo», di sempre, nessun periodo", 4, K.daLavorare([f47, f48, fVecchio, fToccato, fSpedito, ord({ status: "annullato" })]));
  c("daLavorare: elenco vuoto", 0, K.daLavorare([]));

  // ── andamento ──
  const an = K.andamento([A, B, C, D, E, F], P);
  c("andamento: un elemento per giorno, anche a zero", ["2026-11-10", "2026-11-11", "2026-11-12"], an.map((x) => x.giorno));
  c("andamento: il giorno senza ordini vale zero", { giorno: "2026-11-12", ordini: 0, incassato: 0 }, an[2]);
  c("andamento: la somma dei giorni = Panoramica (ordini e incassato)", [pan.ordini.n, pan.incassato.importo], [an.reduce((s, x) => s + x.ordini, 0), an.reduce((s, x) => s + x.incassato, 0)]);
  const sparsi = misti.filter((o) => K.nelPeriodo(o, { da: "2026-11-08", a: "2026-11-14" }));
  const PS = { da: "2026-11-08", a: "2026-11-14" };
  const ans = K.andamento(misti, PS);
  const pns = K.panoramica(misti, PS);
  c("andamento (proprietà): sette giorni, somme = Panoramica", [7, pns.ordini.n, pns.incassato.importo, sparsi.length > 0], [ans.length, ans.reduce((s, x) => s + x.ordini, 0), ans.reduce((s, x) => s + x.incassato, 0), true]);
  c("andamento: periodo a cavallo del cambio d'ora, un elemento per giorno", ["2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"], K.andamento([], { da: "2026-10-24", a: "2026-10-27" }).map((x) => x.giorno));
  const dopoMezzanotte = K.andamento([ord({ created_at: loc(2026, 11, 11, 0, 30), total: 10 })], P);
  c("andamento: un ordine alle 00:30 locali cade nel giorno 11, non nel 10", [0, 1, 0], dopoMezzanotte.map((x) => x.ordini));
  c("andamento: un ordine alle 23:59 locali cade nel suo giorno", [0, 1, 0], K.andamento([ord({ created_at: loc(2026, 11, 11, 23, 59, 59) })], P).map((x) => x.ordini));
  c("andamento su un periodo smisurato: l'ordine di oggi c'è, nel suo giorno", [1, "2026-11-12"], (() => {
    const r = K.andamento([ord({ created_at: loc(2026, 11, 12, 9) })], { da: "1000-01-01", a: "2026-11-12" });
    return [r.at(-1).ordini, r.at(-1).giorno];
  })());
  c("date che non esistono (30 febbraio, mese 13) → periodo rifiutato", [[], [], false, false], [
    K.andamento([A], { da: "2026-02-30", a: "2026-03-05" }), K.andamento([A], { da: "2026-02-01", a: "2026-13-05" }),
    K.nelPeriodo(ord({ created_at: loc(2026, 3, 1) }), { da: "2026-02-30", a: "2026-03-05" }), K.nelPeriodo(ord({ created_at: loc(2026, 3, 1) }), { da: "2026-02-28", a: "2026-02-30" })]);
  c("29 febbraio: solo negli anni bisestili", [true, false], [K.andamento([], { da: "2028-02-29", a: "2028-02-29" }).length === 1, K.andamento([], { da: "2026-02-29", a: "2026-02-29" }).length === 1]);
  c("andamento: periodo capovolto o illeggibile → vuoto", [[], []], [K.andamento([A], { da: "2026-11-12", a: "2026-11-10" }), K.andamento([A], { da: "x", a: "y" })]);
  c("andamento: periodo smisurato → tetto, non si pianta", true, K.andamento([], { da: "1000-01-01", a: "2026-11-12" }).length <= 4000);
  c("andamento: l'ultimo giorno resta quello chiesto anche col tetto", "2026-11-12", K.andamento([], { da: "1000-01-01", a: "2026-11-12" }).at(-1).giorno);

  // ── più venduti ──
  const m1 = ord({ items: [voce("Estensioni 1B", 50, 2), voce("Spazzola", 10, 1)] });
  const m2 = ord({ items: [voce("Estensioni 1B", 50, 1)] });
  const m3 = ord({ items: [voce("Estensioni 1B", 50, 3), voce("Estensioni 1B", 50, 1)] }); // due righe, stessa merce, nello stesso ordine
  const mAnn = ord({ status: "annullato", items: [voce("Estensioni 1B", 50, 100)] });
  const mFuori = ord({ created_at: loc(2026, 11, 20), items: [voce("Estensioni 1B", 50, 100)] });
  const pv = K.piuVenduti([m1, m2, m3, mAnn, mFuori], P);
  c("più venduti: stessa merce in tre ordini → una riga (annullati e fuori periodo esclusi)", 2, pv.length);
  c("più venduti: pezzi, ordini distinti, ricavo", { nome: "Estensioni 1B", pezzi: 7, ordini: 3, ricavo: 350 }, { nome: pv[0].nome, pezzi: pv[0].pezzi, ordini: pv[0].ordini, ricavo: pv[0].ricavo });
  c("più venduti: ordinati per pezzi", ["Estensioni 1B", "Spazzola"], pv.map((v) => v.nome));
  const v1 = ord({ items: [voce("Frangia", 20, 1, { variant: { Colore: "1B" } })] });
  const v2 = ord({ items: [voce("Frangia", 20, 2, { variant: { Colore: "2" } })] });
  const v3 = ord({ items: [voce("Frangia", 20, 1, { variant: { Colore: "1B" } })] });
  const pvv = K.piuVenduti([v1, v2, v3], P);
  c("più venduti: due varianti → una riga", [1, 4, 3], [pvv.length, pvv[0].pezzi, pvv[0].ordini]);
  c("più venduti: le varianti si vedono aprendo la riga", [{ variante: "Colore: 1B", pezzi: 2, ricavo: 40 }, { variante: "Colore: 2", pezzi: 2, ricavo: 40 }],
    [...pvv[0].varianti].sort((a, b) => a.variante.localeCompare(b.variante)));
  const dieci = Array.from({ length: 13 }, (_, i) => ord({ items: [voce(`Articolo ${i}`, 10, 13 - i)] }));
  c("più venduti: tetto a 10", [10, "Articolo 0", "Articolo 9"], (() => { const r = K.piuVenduti(dieci, P); return [r.length, r[0].nome, r[9].nome]; })());
  c("più venduti: max personalizzato", [3, 0], [K.piuVenduti(dieci, P, 3).length, K.piuVenduti(dieci, P, 0).length]);
  c("più venduti: senza prezzo / items vuoto / illeggibile: nessun NaN", true, tutteFinite(K.piuVenduti([ord({ items: [{ name: "Senza prezzo", qty: 2 }] }), ord({ items: [] }), ord({ items: "boh" }), ord({ items: [null, 3] })], P)));
  c("più venduti: riga senza prezzo vale 0 ma il pezzo si conta", { pezzi: 2, ricavo: 0 }, (() => { const r = K.piuVenduti([ord({ items: [{ name: "Senza prezzo", qty: 2 }] })], P)[0]; return { pezzi: r.pezzi, ricavo: r.ricavo }; })());
  c("più venduti: senza id prodotto si riconosce dal nome (maiuscole e spazi)", 1, K.piuVenduti([ord({ items: [{ name: "Cuffia ", qty: 1, unit_price: 5 }] }), ord({ items: [{ name: "cuffia", qty: 1, unit_price: 5 }] })], P).length);
  c("più venduti: pezzi non sani → la riga vale 0 anche nel ricavo", { pezzi: 0, ricavo: 0 }, (() => { const r = K.piuVenduti([ord({ items: [voce("Mille", 1, 2000000)] })], P)[0]; return { pezzi: r.pezzi, ricavo: r.ricavo }; })());
  c("più venduti: una riga sana accanto a una non sana conta solo la sana", { pezzi: 2, ricavo: 20 }, (() => { const r = K.piuVenduti([ord({ items: [voce("Mix", 10, 2), voce("Mix", 1, 2000000)] })], P)[0]; return { pezzi: r.pezzi, ricavo: r.ricavo }; })());
  c("più venduti: nessun ordine → vuoto", [], K.piuVenduti([], P));
  c("più venduti: prodotti con nome da prototipo non rompono (constructor, __proto__)", 2, K.piuVenduti([ord({ items: [{ name: "constructor", qty: 1, unit_price: 1 }, { name: "__proto__", qty: 1, unit_price: 1 }] })], P).length);

  // ── clienti ──
  const T1 = "+39 300 000 5001";
  const cl = (n, extra) => ord({ telefono: T1, email: `solo${n}@example.com`, created_at: loc(2026, 11, n), total: 10, ...extra });
  c("clienti: un ordine → un cliente con un ordine", [1, 1, 10], (() => { const r = K.raggruppaClienti([cl(1)]); return [r.length, r[0].n, r[0].speso]; })());
  c("clienti: due ordini dello stesso cliente", [1, 2, 20], (() => { const r = K.raggruppaClienti([cl(1), cl(2)]); return [r.length, r[0].n, r[0].speso]; })());
  c("clienti: tre ordini", [1, 3, 30], (() => { const r = K.raggruppaClienti([cl(1), cl(2), cl(3)]); return [r.length, r[0].n, r[0].speso]; })());
  c("clienti: telefoni scritti in sei modi → un cliente", 1, K.raggruppaClienti(["+39 300 000 5001", "0039 300 000 5001", "300-000-5001", "(300) 0005001", "+39.300.000.5001", "3000005001"].map((t, i) => ord({ telefono: t, email: `x${i}@example.com` }))).length);
  c("clienti: stessa email (maiuscole e spazi), telefono diverso → un cliente", 1, K.raggruppaClienti([ord({ email: "Anna@Example.com", telefono: "+39 300 000 7001" }), ord({ email: " anna@example.COM ", telefono: "+39 300 000 7002" })]).length);
  c("clienti: telefono e email diversi → due clienti", 2, K.raggruppaClienti([ord(), ord()]).length);
  c("clienti: catena (A-B per telefono, B-C per email) → un cliente", 1, K.raggruppaClienti([
    ord({ telefono: "+39 300 000 8001", email: "a@example.com" }), ord({ telefono: "+39 300 000 8001", email: "b@example.com" }), ord({ telefono: "+39 300 000 8002", email: "b@example.com" })]).length);
  c("clienti: senza telefono né email né scheda: ogni ordine è un cliente", 2, K.raggruppaClienti([ord({ telefono: "", email: "" }), ord({ telefono: "12", email: "senza chiocciola" })]).length);
  c("clienti: telefono corto (< 6 cifre) non unisce", 2, K.raggruppaClienti([ord({ telefono: "123", email: "" }), ord({ telefono: "123", email: "" })]).length);
  const L1 = "00000000-0000-4000-8000-0000000000a1";
  const L2 = "00000000-0000-4000-8000-0000000000a2";
  c("clienti: stessa scheda, telefoni e email diversi → un cliente", [1, L1], (() => { const r = K.raggruppaClienti([ord({ lead_id: L1 }), ord({ lead_id: L1 })]); return [r.length, r[0].leadId]; })());
  c("clienti: due ordini su schede DIVERSE con lo stesso numero → due clienti", 2, K.raggruppaClienti([ord({ telefono: T1, lead_id: L1 }), ord({ telefono: T1, lead_id: L2 })]).length);
  c("clienti: schede diverse e stessa email → due clienti", 2, K.raggruppaClienti([ord({ email: "u@example.com", lead_id: L1 }), ord({ email: "u@example.com", lead_id: L2 })]).length);
  c("clienti: un ordine senza scheda si unisce a quello con scheda (stesso numero)", [1, L1], (() => { const r = K.raggruppaClienti([ord({ telefono: T1, lead_id: L1 }), ord({ telefono: T1 })]); return [r.length, r[0].leadId]; })());
  c("clienti: senza scheda e numero comune a due schede: finisce in uno solo (il più vecchio), non in tutti e due", [2, 3], (() => {
    const r = K.raggruppaClienti([ord({ telefono: T1, lead_id: L1, created_at: loc(2026, 11, 1) }), ord({ telefono: T1, lead_id: L2, created_at: loc(2026, 11, 2) }), ord({ telefono: T1, created_at: loc(2026, 11, 3) })]);
    return [r.length, r.reduce((s, x) => s + x.n, 0)];
  })());
  c("clienti: la scheda principale (unitoIn) unisce due schede", [1, "P"], (() => {
    const r = K.raggruppaClienti([ord({ lead_id: L1 }), ord({ lead_id: L2 })], (id) => (id === L1 || id === L2 ? "P" : null));
    return [r.length, r[0].leadId];
  })());
  c("clienti: scheda che non si risolve (null) → si ragiona per telefono", 1, K.raggruppaClienti([ord({ lead_id: L1, telefono: T1 }), ord({ lead_id: L2, telefono: T1 })], () => null).length);
  c("clienti: gli annullati non contano (n, speso) e un cliente solo-annullato non c'è", [1, 1, 10], (() => {
    const r = K.raggruppaClienti([cl(1), cl(2, { status: "annullato" }), ord({ status: "annullato" })]);
    return [r.length, r[0].n, r[0].speso];
  })());
  const vecchio = cl(1, { nome: "Anna", email: "anna@example.com" });
  const recente = cl(5, { nome: "Zeno", email: "" });
  const dueO = K.raggruppaClienti([recente, vecchio])[0];
  c("clienti: nome e contatti dall'ordine più recente (l'email, se manca, dall'altro)", ["Zeno Esempio", "anna@example.com", T1], [dueO.nome, dueO.email, dueO.telefono]);
  c("clienti: primo e ultimo ordine", [vecchio.creatoIl, recente.creatoIl], [dueO.primoOrdine, dueO.ultimoOrdine]);
  c("clienti: ordinati per ultimo ordine, il più recente per primo", true, (() => {
    const u = K.raggruppaClienti([1, 9, 5].map((g) => ord({ created_at: loc(2026, 11, g) }))).map((x) => x.ultimoOrdine);
    return u.length === 3 && u[0] > u[1] && u[1] > u[2];
  })());
  c("clienti: chiavi tutte diverse, ordini di ciascuno dichiarati", [true, 3], (() => {
    const r = K.raggruppaClienti([cl(1), ord(), ord({ telefono: "", email: "" })]);
    return [new Set(r.map((x) => x.chiave)).size === r.length, r.reduce((s, x) => s + x.ordiniIds.length, 0)];
  })());
  c("clienti: importi assurdi, speso finito", true, tutteFinite(K.raggruppaClienti([cl(1, { total: 1e300 }), cl(2, { total: -5 }), cl(3, { total: 1e308 })])));
  c("clienti: il risultato non dipende dall'ordine di arrivo", true, (() => {
    const l = [ord({ telefono: T1, lead_id: L1, created_at: loc(2026, 11, 1) }), ord({ telefono: T1, lead_id: L2, created_at: loc(2026, 11, 2) }), ord({ telefono: T1, created_at: loc(2026, 11, 3) }), ord({ created_at: loc(2026, 11, 4) })];
    const forma = (x) => K.raggruppaClienti(x).map((k) => `${k.chiave}:${[...k.ordiniIds].sort().join(",")}`).sort().join("|");
    return forma(l) === forma([...l].reverse());
  })());
  c("clienti: elenco vuoto", [], K.raggruppaClienti([]));

  // ── riacquisto ──
  const R = { da: "2026-11-10", a: "2026-11-12" };
  const t = (n) => `+39 300 000 90${String(n).padStart(2, "0")}`;
  const nuovo = ord({ telefono: t(1), created_at: loc(2026, 11, 11) }); // solo nel periodo
  const tornato = [ord({ telefono: t(2), created_at: loc(2026, 10, 1) }), ord({ telefono: t(2), created_at: loc(2026, 11, 11) })]; // prima del periodo → tornato
  const soloAnnullatoPrima = [ord({ telefono: t(3), created_at: loc(2026, 10, 1), status: "annullato" }), ord({ telefono: t(3), created_at: loc(2026, 11, 11) })];
  const soloPrima = ord({ telefono: t(4), created_at: loc(2026, 10, 1) }); // fuori periodo: non è un cliente del periodo
  const dueNelPeriodo = [ord({ telefono: t(5), created_at: loc(2026, 11, 10, 9) }), ord({ telefono: t(5), created_at: loc(2026, 11, 12, 9) })];
  const ric = K.riacquisto([nuovo, ...tornato, ...soloAnnullatoPrima, soloPrima, ...dueNelPeriodo], R);
  c("riacquisto: clienti del periodo (chi ha ordinato solo prima non conta)", 4, ric.clientiNelPeriodo);
  c("riacquisto: tornato = aveva un ordine prima; solo-annullato prima = no", 2, ric.tornati);
  c("riacquisto: tasso", 0.5, ric.tasso);
  c("riacquisto: elenco dei tornati, con ordini e speso di sempre", [2, 2], [ric.elenco.length, ric.elenco.map((x) => x.n).sort()[0]]);
  c("riacquisto: un ordine annullato nel periodo non fa un cliente del periodo", 0, K.riacquisto([ord({ status: "annullato", created_at: loc(2026, 11, 11) })], R).clientiNelPeriodo);
  c("riacquisto: nessun ordine → zeri, tasso 0 (niente 0/0)", { clientiNelPeriodo: 0, tornati: 0, tasso: 0, elenco: [] }, K.riacquisto([], R));
  c("riacquisto: due schede diverse, stesso numero → due clienti, nessuno tornato", [1, 0], (() => {
    const r = K.riacquisto([ord({ telefono: T1, lead_id: L1, created_at: loc(2026, 10, 1) }), ord({ telefono: T1, lead_id: L2, created_at: loc(2026, 11, 11) })], R);
    return [r.clientiNelPeriodo, r.tornati];
  })());
  c("riacquisto: con la scheda principale", [1, 1], (() => {
    const r = K.riacquisto([ord({ lead_id: L1, created_at: loc(2026, 10, 1) }), ord({ lead_id: L2, created_at: loc(2026, 11, 11) })], R, () => "P");
    return [r.clientiNelPeriodo, r.tornati];
  })());
  c("riacquisto: elenco ordinato per ordini (più fedele prima)", [3, 2], (() => {
    const tre = [1, 2, 3].map((n) => ord({ telefono: t(6), created_at: loc(2026, 11, 7 + n) }));
    const due = [1, 2].map((n) => ord({ telefono: t(7), created_at: loc(2026, 11, 9 + n) }));
    return K.riacquisto([...due, ...tre], R).elenco.map((x) => x.n);
  })());
  c("riacquisto: tutto finito con importi assurdi", true, tutteFinite(K.riacquisto([ord({ telefono: t(8), total: 1e300, created_at: loc(2026, 10, 1) }), ord({ telefono: t(8), total: -1, created_at: loc(2026, 11, 11) })], R)));

  // ── il modulo resta puro ──
  const src = readFileSync(join(radice, "src/crm/ecommerce/conti.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c("conti.ts: importa solo da ./ordine (niente React, database, finestra, log)", [true, false], [
    [...src.matchAll(/from\s+["']([^"']+)["']/g)].every((m) => m[1] === "./ordine"), /\b(window|document|localStorage|supabase|console)\b/.test(src)]);
  c("conti.ts: nessun nome che cancella (D11)", false, /\b(elimina|cancella|delete)\w*/i.test(src));
}
