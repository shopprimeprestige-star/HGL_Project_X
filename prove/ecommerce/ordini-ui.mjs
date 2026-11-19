/** ── E-COMMERCE · T12 · LA SCHEDA «ORDINI» E IL DETTAGLIO ───────────────────────
 *  `src/crm/ecommerce/ordini-ui.ts` (puro: filtri, ricerca, conferme, frasi, storico), `ElencoOrdini.tsx`, `DettaglioOrdine.tsx`
 *  e la riga del guscio che passa `esegui` e `storico`. Le regole si provano sul modulo puro; le schermate si disegnano con
 *  `react-dom/server` su ordini inventati (`dati.mjs`: nessun cliente vero). Il pannello a scomparsa (Radix) non si disegna sul
 *  server: si prova il suo CORPO (`CorpoOrdine`), che è tutto quello che c'è dentro.
 *  Istanti costruiti in ORA LOCALE (come il filtro periodo): stesso esito in ogni fuso. */
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";
import { build } from "esbuild";
import { rigaOrdineProva } from "./dati.mjs";

export async function prove(mod, { c, gruppo, radice }) {
  const O = mod["ecommerce/ordine"];
  const K = mod["ecommerce/conti"];
  const U = mod["ecommerce/ordini-ui"];
  const A = mod["ecommerce/azioni"];
  const leggi = (f) => readFileSync(join(radice, f), "utf8");
  const FILE = ["src/crm/ecommerce/ordini-ui.ts", "src/crm/ecommerce/ElencoOrdini.tsx", "src/crm/ecommerce/DettaglioOrdine.tsx"];
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, "");

  gruppo("E-COMMERCE · SCHEDA ORDINI E DETTAGLIO (18/11/2026)");

  // ── aiuti ──
  const loc = (a, m, g, h = 12, mi = 0, s = 0) => new Date(a, m - 1, g, h, mi, s).toISOString();
  let seq = 0;
  const ord = (extra = {}) => {
    seq++;
    return O.normalizzaOrdine(rigaOrdineProva({
      id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
      order_ref: `HG-U${seq}`,
      nome: `Cliente${seq}`,
      cognome: "Esempio",
      telefono: `+39 300 200 ${String(1000 + seq)}`,
      email: `cliente${seq}@example.com`,
      created_at: loc(2026, 11, 10),
      subtotal: 20,
      shipping: 4.9,
      total: 24.9,
      ...extra,
    }));
  };
  const P = { da: "2026-11-10", a: "2026-11-12" };
  const ADESSO = new Date(2026, 10, 18, 15, 0, 0);
  const refs = (l) => l.map((o) => o.ref);

  // ══ 1. FILTRI E RICERCA ══
  const A1 = ord({ order_ref: "HG-AAA111", nome: "Anna", cognome: "Esempio", telefono: "+39 300 000 0001", email: "Anna.Esempio@Example.com ", status: "nuovo", created_at: loc(2026, 11, 10, 9) });
  const B1 = ord({ order_ref: "HG-BBB222", nome: "Nicolò", cognome: "Verdi", telefono: "0039 300 000 0002", email: "nico@example.com", status: "spedito", pagato_il: loc(2026, 11, 11), created_at: loc(2026, 11, 11, 9) });
  const C1 = ord({ order_ref: "HG-CCC333", nome: "Carla", cognome: "Bianchi", telefono: "3000000003", email: "carla@example.com", status: "annullato", pagato_il: loc(2026, 11, 11), pagato_importo: 24.9, created_at: loc(2026, 11, 12, 23, 59, 59) });
  const D1 = ord({ order_ref: "HG-DDD444", nome: "Dario", cognome: "Neri", status: "in_preparazione", created_at: loc(2026, 11, 13, 0, 0, 0) }); // un secondo fuori
  const E1 = ord({ order_ref: "HG-AAA111", nome: "Eva", cognome: "Doppia", status: "nuovo", created_at: loc(2026, 11, 12, 8) }); // stesso numero ordine di A1, id diverso
  const TUTTI = [A1, B1, C1, D1, E1];
  const f = (extra = {}, ordini = TUTTI) => U.filtraOrdini(ordini, { periodo: P, ...extra });

  c("senza filtri: gli ordini del periodo, i più recenti per primi (id, non numero ordine: due ordini con lo stesso numero restano due)", ["HG-CCC333", "HG-AAA111", "HG-BBB222", "HG-AAA111"], refs(f()));
  c("il periodo è quello dei conti: 23:59:59 dell'ultimo giorno dentro, mezzanotte dopo fuori", [true, false], [f().includes(C1), f().includes(D1)]);
  c("la riga della scheda e la cifra della Panoramica contano lo stesso: stessi ordini di `nelPeriodo`", TUTTI.filter((o) => K.nelPeriodo(o, P)).length, f().length);
  c("filtro stato", ["HG-AAA111", "HG-AAA111"], refs(f({ stato: "nuovo" })));
  c("filtro «pagato» include gli annullati pagati (come «Incassato»)", [true, true], [f({ pagato: "si" }).includes(C1), f({ pagato: "si" }).includes(B1)]);
  c("la proprietà del piano: «Incassato».n = righe del filtro pagato = sì", K.panoramica(TUTTI, P).incassato.n, f({ pagato: "si" }).length);
  c("filtro «non pagato»", ["HG-AAA111", "HG-AAA111"], refs(f({ pagato: "no" })));
  c("stato e pagato insieme", ["HG-CCC333"], refs(f({ stato: "annullato", pagato: "si" })));
  c("ricerca per nome, senza maiuscole né accenti («nicolo» trova «Nicolò»)", ["HG-BBB222"], refs(f({ ricerca: "NICOLO" })));
  c("ricerca per nome e cognome insieme, in qualunque ordine", ["HG-AAA111"], refs(f({ ricerca: "esempio anna" })));
  c("ricerca per email con maiuscole e spazi", ["HG-AAA111"], refs(f({ ricerca: "  ANNA.esempio@EXAMPLE.com " })));
  c("ricerca per numero ordine, anche senza «HG-» e a pezzi", [["HG-BBB222"], ["HG-BBB222"]], [refs(f({ ricerca: "hg-bbb222" })), refs(f({ ricerca: "bbb2" }))]);
  c("ricerca per telefono: stesso numero scritto in tre modi trova lo stesso ordine", [["HG-AAA111"], ["HG-AAA111"], ["HG-AAA111"]], [refs(f({ ricerca: "+39 300 000 0001" })), refs(f({ ricerca: "0039 3000000001" })), refs(f({ ricerca: "3000000001" }))]);
  c("ricerca per telefono a pezzi (ultime cifre)", ["HG-BBB222"], refs(f({ ricerca: "000 0002" })));
  c("ricerca che non trova niente: elenco vuoto, non un errore", [], f({ ricerca: "zzz" }));
  c("ricerca con caratteri da espressione regolare non lancia", [[], []], [f({ ricerca: "(((" }), f({ ricerca: "[a-" })]);
  c("ricerca vuota o di soli spazi = nessun filtro", 4, f({ ricerca: "   " }).length);
  c("ricerca enorme non lancia e non trova", [], f({ ricerca: "a".repeat(100000) }));
  const copia = JSON.stringify(TUTTI);
  f({ stato: "nuovo", ricerca: "anna" });
  c("l'elenco in ingresso non è mutato né riordinato", [copia, ["HG-AAA111", "HG-BBB222", "HG-CCC333", "HG-DDD444", "HG-AAA111"]], [JSON.stringify(TUTTI), refs(TUTTI)]);
  const cs = U.conteggiPerStato(TUTTI, { periodo: P });
  c("i conteggi per stato sono quelli del periodo e coincidono con le righe di ogni stato", true, ["nuovo", "in_preparazione", "spedito", "consegnato", "annullato"].every((s) => cs[s] === f({ stato: s }).length) && cs.tutti === f().length);
  c("i conteggi seguono ricerca e pagato, ma NON lo stato scelto (si deve poter cambiare filtro)", [1, 0, 1], [U.conteggiPerStato(TUTTI, { periodo: P, pagato: "si", ricerca: "nicolo" }).spedito, U.conteggiPerStato(TUTTI, { periodo: P, pagato: "si", ricerca: "nicolo" }).nuovo, U.conteggiPerStato(TUTTI, { periodo: P, stato: "nuovo" }).spedito]);
  c("righe visibili: un tetto, per non disegnare migliaia di righe", true, Number.isInteger(U.PAGINA_RIGHE) && U.PAGINA_RIGHE >= 50 && U.PAGINA_RIGHE <= 500);

  // ══ 2. IL DETTAGLIO SI TROVA PER ID ══
  c("ordineDaId: per id, mai per numero ordine (due ordini con lo stesso numero)", [E1, null, null], [U.ordineDaId(TUTTI, E1.id), U.ordineDaId(TUTTI, "HG-AAA111"), U.ordineDaId(TUTTI, undefined)]);
  c("ordineDaId trova anche un ordine fuori dal periodo (il link dalla scheda lead)", D1, U.ordineDaId(TUTTI, D1.id));

  // ══ 3. IL PAGAMENTO ══
  c("importo di partenza: il totale con la virgola e due decimali, senza separatore delle migliaia", ["24,90", "1234,50", "0,00"], [U.importoDiPartenza(ord()), U.importoDiPartenza(ord({ total: 1234.5, subtotal: 1229.6 })), U.importoDiPartenza(ord({ total: 0, subtotal: 0, shipping: 0 }))]);
  c("totale fuori norma: nessuna proposta, si scrive a mano", ["", "", ""], [U.importoDiPartenza(ord({ total: -5 })), U.importoDiPartenza(ord({ total: 1e9 })), U.importoDiPartenza({ totale: NaN })]);
  const ordP = ord();
  const ok = U.controllaPagamento(ordP, { metodo: "bonifico", importo: "24,90", data: "2026-11-18" }, ADESSO);
  c("pagamento valido: l'azione per la rotta, con l'importo scritto com'è (la virgola la legge azioni.ts)", [true, { azione: "pagato", ordineId: ordP.id, metodo: "bonifico", importo: "24,90", data: "2026-11-18" }], [ok.ok, ok.azione]);
  c("l'azione prodotta passa davvero da costruisciAzione (stessa regola della rotta)", true, A.costruisciAzione(ok.azione, ordP, ADESSO).ok);
  const male = (extra) => U.controllaPagamento(ordP, { metodo: "bonifico", importo: "24,90", data: "2026-11-18", ...extra }, ADESSO);
  c("metodo mancante → errore chiaro", [false, true], [male({ metodo: "" }).ok, /metodo/i.test(male({ metodo: "" }).errore)]);
  c("importo illeggibile, negativo, con migliaia, esponenziale → errore", [false, false, false, false], ["abc", "-5", "1.234,50", "1e3"].map((x) => male({ importo: x }).ok));
  c("importo con la virgola e un decimale va bene", true, male({ importo: "12,5" }).ok);
  c("importo vuoto = il totale dell'ordine", true, male({ importo: "" }).ok);
  c("data futura e data illeggibile → errore con la frase dell'azione", [false, false, true], [male({ data: "2026-11-30" }).ok, male({ data: "18/11/2026" }).ok, /futuro/i.test(male({ data: "2026-11-30" }).errore)]);
  c("data vuota = adesso", true, male({ data: "" }).ok);
  c("già pagato → errore (qualcuno l'ha già fatto)", false, U.controllaPagamento(ord({ pagato_il: loc(2026, 11, 11) }), { metodo: "contanti", importo: "", data: "" }, ADESSO).ok);
  c("importo vuoto con totale fuori norma → errore: si deve scrivere", false, U.controllaPagamento(ord({ total: -5 }), { metodo: "contanti", importo: "", data: "" }, ADESSO).ok);
  c("nessuna eccezione con valori strani", [false, false], [U.controllaPagamento(ordP, { metodo: null, importo: {}, data: 5 }, ADESSO).ok, U.controllaPagamento(ordP, undefined, ADESSO).ok]);

  // ══ 4. QUANDO SERVE LA CONFERMA ══
  const STATI = ["nuovo", "in_preparazione", "spedito", "consegnato", "annullato"];
  const st = (da, a) => ({ azione: "stato", ordineId: ordP.id, da, a });
  const tutteLeCoppie = STATI.flatMap((da) => STATI.filter((a) => a !== da).map((a) => [da, a]));
  c("la conferma serve per «annullato» come stato, da qualunque stato (venti coppie su venti)", true, tutteLeCoppie.every(([da, a]) => U.serveConferma(st(da, a)) === (a === "annullato")));
  c("la conferma serve per «annulla pagamento»", true, U.serveConferma({ azione: "pagamento_annullato", ordineId: ordP.id }));
  c("non serve per le altre azioni (pagato, tracking, nota)", [false, false, false], [U.serveConferma({ azione: "pagato", ordineId: ordP.id, metodo: "carta" }), U.serveConferma({ azione: "tracking", ordineId: ordP.id, valore: "x" }), U.serveConferma({ azione: "nota_interna", ordineId: ordP.id, valore: "x" })]);
  const tx = U.testoConferma(st("nuovo", "annullato"), ord({ order_ref: "HG-XYZ789", nome: "Anna" }));
  c("testo della conferma «annullato»: dice quale ordine, che si può rimettere, che non scrive al cliente", [true, true, true], [/HG-XYZ789/.test(tx.titolo + tx.testo), /altro stato|rimett/i.test(tx.testo), /nessun messaggio|non riceve/i.test(tx.testo)]);
  const txPagato = U.testoConferma(st("nuovo", "annullato"), ord({ pagato_il: loc(2026, 11, 11), pagato_importo: 24.9, metodo_pagamento: "bonifico" }));
  c("«annullato» su un ordine già pagato: avverte che l'incasso resta", true, /pagament/i.test(txPagato.testo) && /incassat/i.test(txPagato.testo));
  const txPag = U.testoConferma({ azione: "pagamento_annullato", ordineId: ordP.id }, ord({ pagato_il: loc(2026, 11, 11), pagato_importo: 24.9, metodo_pagamento: "bonifico" }));
  c("testo della conferma «annulla pagamento»: importo, e che resta nello storico", [true, true], [/24,90/.test(txPag.titolo + txPag.testo), /storico/i.test(txPag.testo)]);
  c("le conferme hanno un tasto «sì» col verbo giusto, e nessuna parola di cancellazione", [true, false], [/annulla/i.test(tx.si) && /annulla/i.test(txPag.si), /elimin|cancell|delete/i.test(JSON.stringify([tx, txPag, txPagato]))]);
  c("serveConferma e testoConferma non lanciano con azioni strane", [false, null], [U.serveConferma({ azione: "boh" }), U.testoConferma({ azione: "boh" }, ordP)]);
  c("i comandi sono accesi solo se la migrazione è pronta (vero); falso e «non so» li spengono", [true, false, false], [U.comandiAttivi(true), U.comandiAttivi(false), U.comandiAttivi(null)]);

  // ══ 5. LE FRASI DOPO UN'AZIONE ══
  const az = (azione, extra = {}) => ({ azione, ordineId: ordP.id, ...extra });
  const buono = (storico = true) => ({ ok: true, nessunCambio: false, ordine: ordP, storico });
  c("azione riuscita: tono «ok», una frase per ogni azione", true, [
    U.esitoAzione(buono(), az("stato", { da: "nuovo", a: "spedito" })),
    U.esitoAzione(buono(), az("pagato", { metodo: "carta" })),
    U.esitoAzione(buono(), az("pagamento_annullato")),
    U.esitoAzione(buono(), az("tracking", { valore: "ABC" })),
    U.esitoAzione(buono(), az("nota_interna", { valore: "x" })),
  ].every((e) => e && e.tono === "ok" && e.testo.length > 5));
  c("le cinque frasi sono tutte diverse", 5, new Set([U.esitoAzione(buono(), az("stato", { a: "spedito" })).testo, U.esitoAzione(buono(), az("pagato")).testo, U.esitoAzione(buono(), az("pagamento_annullato")).testo, U.esitoAzione(buono(), az("tracking", { valore: "A" })).testo, U.esitoAzione(buono(), az("nota_interna", { valore: "A" })).testo]).size);
  c("tracking vuoto = «tolto», non «salvato»", true, /tolto/i.test(U.esitoAzione(buono(), az("tracking", { valore: "  " })).testo));
  const senzaStorico = U.esitoAzione(buono(false), az("stato", { a: "spedito" }));
  c("storico:false → tono «avviso»: la modifica c'è, lo storico no", [ "avviso", true, true ], [senzaStorico.tono, /storico/i.test(senzaStorico.testo), /salvat|c'è|registrat/i.test(senzaStorico.testo)]);
  const nessun = U.esitoAzione({ ok: true, nessunCambio: true }, az("stato", { a: "spedito" }));
  c("nessunCambio: una frase tranquilla, non un errore", [ "ok", true ], [nessun.tono, /già così|niente da cambiare/i.test(nessun.testo)]);
  const err = (tipo, messaggio = "frase della rotta") => ({ ok: false, errore: { tipo, messaggio } });
  const conf = U.esitoAzione(err("conflitto"), az("stato", { a: "spedito" }));
  c("conflitto: «un collega l'ha appena modificato, ho ricaricato»", [ "errore", true, true ], [conf.tono, /collega l'ha appena modificato/i.test(conf.testo), /ricaricat/i.test(conf.testo)]);
  c("non trovato: dice che si è ricaricato, non «Ordine non trovato» secco", true, /ricaricat/i.test(U.esitoAzione(err("non_trovato"), az("stato")).testo));
  c("migrazione, valore, rete, sessione, permesso, server: si mostra la frase già pronta", true, ["migrazione", "valore", "rete", "sessione", "permesso", "server"].every((t) => { const e = U.esitoAzione(err(t, `F-${t}`), az("pagato")); return e.tono === "errore" && e.testo.includes(`F-${t}`); }));

  // ══ 6. AVVISI SULL'ORDINE ══
  c("ordine pulito: nessun avviso", [], U.avvisiOrdine(ord()));
  c("totale che non torna → avviso", true, U.avvisiOrdine(ord({ total: 99 })).some((t) => /totale/i.test(t)));
  c("righe troncate → avviso", true, U.avvisiOrdine(ord({ items: Array.from({ length: 250 }, (_, i) => ({ name: `P${i}`, qty: 1, unit_price: 1 })), subtotal: 250, shipping: 0, total: 250 })).some((t) => /righe/i.test(t)));
  c("importo fuori norma → avviso (come in Panoramica)", true, U.avvisiOrdine(ord({ total: -50, subtotal: -50, shipping: 0 })).some((t) => /fuori norma/i.test(t)));
  c("stato scritto in tabella che non conosciamo → avviso col testo vero", true, U.avvisiOrdine(ord({ status: "boh" })).some((t) => /boh/.test(t)));
  c("annullato ma pagato → avviso (i soldi risultano incassati, rimborsi non gestiti)", true, U.avvisiOrdine(ord({ status: "annullato", pagato_il: loc(2026, 11, 11) })).some((t) => /incassat/i.test(t)));

  // ══ 7. LO STORICO ══
  const ev = (tipo, prima, dopo, extra = {}) => ({ id: "e1", creatoIl: loc(2026, 11, 11, 10, 5), tipo, chi: "Giulia", prima, dopo, ...extra });
  const d1 = U.descriviEvento(ev("stato", { stato: "nuovo" }, { stato: "spedito" }));
  c("evento «stato»: da Nuovo a Spedito, con chi", [true, true, "Giulia"], [/Nuovo/.test(d1.dettaglio) && /Spedito/.test(d1.dettaglio), /stato/i.test(d1.titolo), d1.chi]);
  const d2 = U.descriviEvento(ev("pagato", {}, { pagato_il: loc(2026, 11, 11), pagato_importo: 24.9, metodo_pagamento: "bonifico" }));
  c("evento «pagato»: importo, metodo, giorno", [true, true, true], [/24,90/.test(d2.dettaglio), /Bonifico/.test(d2.dettaglio), /11/.test(d2.dettaglio)]);
  const d3 = U.descriviEvento(ev("pagamento_annullato", { pagato_il: loc(2026, 11, 11), pagato_importo: 24.9, metodo_pagamento: "contanti" }, {}));
  c("evento «pagamento annullato»: conserva importo e metodo di ciò che c'era", [true, true, true], [/annullat/i.test(d3.titolo), /24,90/.test(d3.dettaglio), /Contanti/.test(d3.dettaglio)]);
  c("evento «tracking»: nuovo codice; vuoto = tolto", [true, true], [/AB123/.test(U.descriviEvento(ev("tracking", { tracking: null }, { tracking: "AB123" })).dettaglio), /tolto/i.test(U.descriviEvento(ev("tracking", { tracking: "AB123" }, { tracking: null })).titolo + U.descriviEvento(ev("tracking", { tracking: "AB123" }, { tracking: null })).dettaglio)]);
  c("evento «nota interna»: il testo nuovo, accorciato se lungo", [true, true], [/Ricontattare/.test(U.descriviEvento(ev("nota_interna", { note_interne: null }, { note_interne: "Ricontattare lunedì" })).dettaglio), U.descriviEvento(ev("nota_interna", {}, { note_interne: "x".repeat(5000) })).dettaglio.length < 400]);
  c("evento di un tipo che non conosciamo: una riga generica, mai un'eccezione", true, (() => { const d = U.descriviEvento(ev("collegato", { a: 1 }, { b: 2 })); return typeof d.titolo === "string" && d.titolo.length > 0; })());
  c("evento con dati rotti (null, numeri, testo): nessuna eccezione e niente NaN/undefined", false, [null, 5, "x", [], { stato: {} }].some((x) => /NaN|undefined|\[object|null/.test(JSON.stringify(U.descriviEvento(ev("stato", x, x))) + JSON.stringify(U.descriviEvento(ev("pagato", x, x))))));
  c("evento senza chi: «—», non vuoto", "—", U.descriviEvento(ev("stato", {}, {}, { chi: "" })).chi);
  c("storico: dal più recente, date illegibili in fondo, l'elenco non è mutato", [["c", "b", "a", "z"], ["a", "b", "c", "z"]], (() => { const l = [ev("stato", {}, {}, { id: "a", creatoIl: "2026-11-01T10:00:00Z" }), ev("stato", {}, {}, { id: "z", creatoIl: "boh" }), ev("stato", {}, {}, { id: "c", creatoIl: "2026-11-03T10:00:00Z" }), ev("stato", {}, {}, { id: "b", creatoIl: "2026-11-02T10:00:00Z" })]; const o = U.ordinaEventi(l); return [o.map((e) => e.id), l.map((e) => e.id).filter((i) => i !== "z").sort().concat("z")]; })());
  const q = U.dataOra(loc(2026, 11, 18, 14, 32));
  c("dataOra: giorno e ora locale; data illeggibile = «—»", [true, "—", "—"], [/18/.test(q) && /14[:.]32/.test(q), U.dataOra("boh"), U.dataOra(undefined)]);

  // ══ 8. SUL TESTO DEI FILE ══
  const testi = FILE.map(leggi);
  c("nessuna parola di cancellazione, in nessun file dell'area di T12 (commenti compresi)", [false, false, false], testi.map((t) => /elimin|cancell|delete/i.test(t)));
  c("nessun `console.*` (negli ordini ci sono nome, telefono, indirizzo)", [false, false, false], testi.map((t) => /console\./.test(senzaCommenti(t))));
  c("nessun accesso diretto al database: solo la rotta, tramite le funzioni passate", [false, false, false], testi.map((t) => /@\/integrations\/supabase|createClient|\.from\(["']/.test(senzaCommenti(t))));
  const [uiT, elT, deT] = testi.map(senzaCommenti);
  c("il periodo è `nelPeriodo` di conti.ts, mai `rangeMatch`", [true, false], [/nelPeriodo\(/.test(uiT), /rangeMatch/.test(uiT + elT + deT)]);
  c("gli ordini si identificano per id: mai un confronto sul numero ordine", [false, false, false], testi.map((t) => /\.ref\s*[!=]==?|order_ref/.test(senzaCommenti(t))));
  c("l'elenco usa i filtri puri, `ordineDaId` e `importoFuoriNorma`", [true, true, true], [/filtraOrdini\(/.test(elT), /ordineDaId\(/.test(elT), /importoFuoriNorma\(/.test(elT)]);
  c("stato e ordine passano dall'indirizzo con `imposta(`", true, /imposta\??\.?\(\{[^}]*stato/.test(elT) && /imposta\??\.?\(\{[^}]*ordine/.test(elT));
  c("le azioni partono da un punto solo (`esegui(`) e ne leggono l'esito con `esitoAzione`", [1, true, 0], [(elT.match(/\besegui\(/g) || []).length, /esitoAzione\(/.test(elT), (deT.match(/\besegui\(/g) || []).length]);
  c("la conferma passa da `serveConferma` e c'è un AlertDialog; l'azione si lancia da due punti soltanto (diretta o dopo la conferma)", [true, true, 2], [/serveConferma\(/.test(elT), /<AlertDialog\b/.test(elT), (elT.match(/(?<!function )\blancia\(/g) || []).length]);
  c("i comandi dipendono dalla migrazione: `comandiAttivi(migrazionePronta)`", true, /comandiAttivi\(/.test(elT) && /migrazionePronta/.test(elT));
  c("un doppio clic non lancia due azioni (blocco sincrono, non solo lo stato)", true, /useRef/.test(elT) && /occupato/.test(elT));
  c("il pannello torna al punto di partenza alla chiusura (fuoco)", true, /onCloseAutoFocus/.test(deT));
  c("il guscio passa `esegui` e `storico` alla scheda", [true, true], [/esegui=\{lettura\.esegui\}/.test(senzaCommenti(leggi("src/routes/CRM.ecommerce.tsx"))), /storico=\{lettura\.storico\}/.test(senzaCommenti(leggi("src/routes/CRM.ecommerce.tsx")))]);
  c("telefono: il pannello è a tutta larghezza sotto 640 px", true, /w-full[^"]*sm:max-w-/.test(leggi("src/crm/ecommerce/DettaglioOrdine.tsx")));

  // ══ 8b. LE NOTE DEL REVISORE SU T11 (toccano il guscio, la Panoramica e il menu) ══
  const PG = mod["ecommerce/pagina"];
  const guscioT = leggi("src/routes/CRM.ecommerce.tsx");
  const guscio = senzaCommenti(guscioT);
  const panT = senzaCommenti(leggi("src/crm/ecommerce/Panoramica.tsx"));
  const barra = senzaCommenti(leggi("src/crm/CRMSidebar.tsx"));
  //  nota 1: gli ordini fermi sono «di sempre»; l'elenco che si apre deve contenerli tutti, altrimenti cifra ≠ righe
  const vecchio = ord({ status: "nuovo", created_at: loc(2026, 10, 1, 9) }); // 48 giorni fa
  const recente = ord({ status: "nuovo", created_at: loc(2026, 11, 17, 9) });
  const fermi = K.ordiniFermi([vecchio, recente, A1], ADESSO);
  const tuttoP = PG.periodoDaRange(PG.RANGE_TUTTO, [vecchio, recente, A1], ADESSO);
  const trenta = PG.periodoDaRange(PG.rangeDiPartenza(ADESSO), [vecchio, recente, A1], ADESSO);
  c("(sanità) il fermo da 48 giorni è fermo", true, fermi.includes(vecchio));
  c("fermi → «Tutto»: ogni ordine fermo è fra le righe dell'elenco «Nuovo» (cifra = righe)", true, fermi.every((o) => U.filtraOrdini([vecchio, recente, A1], { periodo: tuttoP, stato: "nuovo" }).includes(o)));
  c("…mentre con i 30 giorni di partenza il fermo da 48 giorni NON c'era: per questo il periodo cambia", false, U.filtraOrdini([vecchio], { periodo: trenta, stato: "nuovo" }).includes(vecchio));
  c("«Tutto» = nessuna data nel filtro", { from: null, to: null }, PG.RANGE_TUTTO);
  c("il guscio, dai fermi, rimette il periodo su «Tutto» prima di aprire l'elenco", true, /opzioni\?\.tutto\)\s*setRange\(RANGE_TUTTO\)/.test(guscio));
  c("la Panoramica chiede «tutto» dal riquadro dei fermi e dalla riga «e altri N»; gli stati del periodo no", [2, 1], [(panT.match(/apriStato\("nuovo", \{ tutto: true \}\)/g) || []).length, (panT.match(/apriStato\(s\)/g) || []).length]);
  //  nota 2: l'avviso di migrazione non manda un consulente a cercare un file
  c("frase della migrazione: «Chiedi a chi gestisce il database…», niente nome di file", [true, false], [/^Chiedi a chi gestisce il database di applicare l'aggiornamento degli ordini\.$/.test(PG.AVVISO_MIGRAZIONE), /\.sql|SQL Editor|Supabase/.test(PG.AVVISO_MIGRAZIONE)]);
  c("il guscio e i comandi spenti usano la stessa frase", [true, true], [/\{AVVISO_MIGRAZIONE\}/.test(guscio) && !/ecommerce_ordini\.sql/.test(guscio), /AVVISO_MIGRAZIONE/.test(uiT + elT + deT)]);
  //  nota 3: il tetto di lettura è uno solo
  c("20.000 non è scritto a mano nel guscio: arriva da `MAX_ORDINI_LETTI`, la stessa costante della rotta", [true, false, true, 20000], [/MAX_ORDINI_LETTI/.test(guscio), /20\.000|20_000|20000/.test(guscio), /MAX_ORDINI = MAX_ORDINI_LETTI/.test(leggi("src/crm/ecommerce/ordini.server.ts")), O.MAX_ORDINI_LETTI]);
  //  nota 4: numeretto senza dato
  c("titolo del numeretto senza dato (null): «Ordini dello shop», non «Nessun ordine nuovo»", true, /ordiniNuovi === null\s*\?\s*"Ordini dello shop"/.test(barra));
  //  nota 6: il valore delle barre si legge anche senza mouse
  c("l'andamento ha la tabella dei valori (details/summary, tastiera) e le barre sono più scure", [true, true, false], [/Valori giorno per giorno/.test(panT) && /<table/.test(panT) && /<th scope="row"/.test(panT), /bg-sky-700/.test(panT), /bg-sky-600\/80/.test(panT)]);

  // ══ 9. LE SCHERMATE, DISEGNATE SUL SERIO ══
  const dove = mkdtempSync(join(tmpdir(), "ordini-ui-"));
  try {
    const req = createRequire(join(radice, "package.json"));
    const reactDelProgetto = { name: "react-del-progetto", setup(b) {
      b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (a) => ({ path: req.resolve(a.path), external: true }));
    } };
    const tsx = async (entrata, nome) => {
      await build({ entryPoints: [join(radice, entrata)], bundle: true, platform: "node", format: "cjs", outfile: join(dove, `${nome}.cjs`),
        loader: { ".tsx": "tsx", ".png": "dataurl", ".jpg": "dataurl", ".svg": "dataurl", ".webp": "dataurl" }, alias: { "@": join(radice, "src") },
        plugins: [reactDelProgetto], logLevel: "silent", jsx: "automatic" });
      return createRequire(import.meta.url)(join(dove, `${nome}.cjs`));
    };
    const { createElement: h } = req("react");
    const { renderToStaticMarkup } = req("react-dom/server");
    const { ElencoOrdini } = await tsx("src/crm/ecommerce/ElencoOrdini.tsx", "elenco");
    const { Panoramica } = await tsx("src/crm/ecommerce/Panoramica.tsx", "panoramica");
    const { CorpoOrdine, DettaglioOrdine } = await tsx("src/crm/ecommerce/DettaglioOrdine.tsx", "dettaglio");
    const testo = (html) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ");
    const lettura = (ordini, extra = {}) => ({ ordini, caricato: true, inCaricamento: false, inAggiornamento: false, errore: null, scartati: 0, troncato: false, migrazionePronta: true, ultimoAggiornamento: 0, ...extra });
    const finto = async () => ({ ok: true, nessunCambio: true });
    const stoVuoto = async () => ({ ok: true, eventi: [], migrazionePronta: true });
    const disegna = (ordini, props = {}, extra = {}) =>
      renderToStaticMarkup(h(ElencoOrdini, { lettura: lettura(ordini, extra), periodo: P, migrazionePronta: extra.migrazionePronta ?? true, imposta: () => {}, esegui: finto, storico: stoVuoto, ...props }));
    const bottoni = (html) => html.split("<button").slice(1).map((s) => s.slice(0, s.indexOf("</button>") + 9));
    const spento = (tag) => /\sdisabled=""/.test(tag.slice(0, tag.indexOf(">") + 1)); // l'attributo, non le classi «disabled:…»
    const selects = (html) => html.split("<select").slice(1).map((s) => s.slice(0, s.indexOf("</select>") + 9));

    const html = disegna(TUTTI);
    const t = testo(html);
    c("l'elenco mostra le 4 righe del periodo (non quella di un secondo dopo), numeri e nomi", [true, true, false, 4], [/Anna Esempio/.test(t) && /HG-BBB222/.test(t), /Nicolò Verdi/.test(t), /Dario/.test(t), (html.match(/data-riga="/g) || []).length]);
    c("totali con la virgola e gli euro; pagato / non pagato scritti", true, /€ 24,90/.test(t) && /Pagato/.test(t) && /Non pagato/.test(t));
    c("ogni riga ha uno stato cambiabile (menu nativo, va con la tastiera e sul telefono) con tutti e cinque gli stati", [true, true], [selects(html).length >= 4, selects(html).every((s) => ["Nuovo", "In preparazione", "Spedito", "Consegnato", "Annullato"].every((n) => s.includes(n)))]);
    c("il menu dello stato ha un nome per chi usa il lettore di schermo", true, selects(html).every((s) => /aria-label="Stato ordine HG-/.test(s)));
    c("ogni riga ha un pulsante che apre il dettaglio, col nome dell'ordine", true, /aria-label="Apri ordine HG-AAA111/.test(html));
    c("niente «NaN», «undefined», «Infinity» in pagina", false, /NaN|undefined|Infinity|\[object/.test(t));
    c("la ricerca e i filtri ci sono, con etichette", true, /type="search"/.test(html) && /aria-label="Cerca/.test(html) && /Non pagati/.test(t) && /Tutti/.test(t));

    const solo = testo(disegna(TUTTI, { stato: "annullato" }));
    c("filtrata per stato «Annullato»: una riga, come la Panoramica (3 non annullati nel periodo → 1 annullato)", [true, false], [/HG-CCC333/.test(solo), /HG-BBB222/.test(solo)]);
    const vuoto = testo(disegna(TUTTI, { stato: "consegnato" }));
    c("nessun ordine con quei filtri: lo dice e offre di togliere i filtri", true, /Nessun ordine/.test(vuoto) && /filtri/i.test(vuoto));
    const zero = testo(disegna([]));
    c("nessun ordine in tabella: stato vuoto chiaro", true, /Nessun ordine/.test(zero));

    const spenti = disegna(TUTTI, { migrazionePronta: false }, { migrazionePronta: false });
    c("migrazione mancante: tutti i menu dello stato spenti, e il motivo scritto", [true, true], [selects(spenti).every((s) => spento(s)), /aggiornamento del database|database/i.test(testo(spenti))]);
    c("migrazione pronta: i menu sono accesi", false, selects(html).some((s) => spento(s)));

    const strano = testo(disegna([ord({ total: -50, subtotal: -50, shipping: 0, status: "consegnato" }), ord({ total: 1e300, subtotal: 1e300, shipping: 0 })]));
    c("importi fuori norma: la riga lo dice invece di mostrare una cifra assurda", true, (strano.match(/importo fuori norma/g) || []).length === 2 && !/NaN|Infinity|e\+/.test(strano));

    const molti = Array.from({ length: U.PAGINA_RIGHE + 30 }, (_, i) => ord({ created_at: loc(2026, 11, 10, 8, i % 50) }));
    const hm = disegna(molti);
    c("oltre il tetto: si disegna solo il tetto e c'è «Mostra altri» con quanti mancano", [U.PAGINA_RIGHE, true], [(hm.match(/data-riga="/g) || []).length, /Mostra altri/.test(testo(hm)) && /30/.test(testo(hm))]);

    // la Panoramica: note intere (nota 5) e valori giornalieri leggibili (nota 6)
    const pan = renderToStaticMarkup(h(Panoramica, { lettura: lettura([A1, B1, C1]), periodo: P, adesso: ADESSO, apriStato: () => {} }));
    c("le note dei riquadri vanno a capo, non finiscono in «…» (nota 5)", true, /whitespace-normal[^>]*>[^<]*annullati esclusi/.test(pan) && /whitespace-normal[^>]*>[^<]*di cui 1 annullat/.test(pan));
    c("la tabella dei valori per giorno c'è, con un giorno per riga, e dice gli ordini di ogni giorno (nota 6)", true, /<table/.test(pan) && (pan.match(/<th scope="row"/g) || []).length === K.andamento([A1, B1, C1], P).length);

    // il corpo del dettaglio
    const chiedi = async () => true;
    const corpo = (o, extra = {}) => renderToStaticMarkup(h(CorpoOrdine, { ordine: o, comandi: true, occupato: false, esito: null, chiedi, storico: stoVuoto, ...extra }));
    const o1 = ord({ order_ref: "HG-DET001", nome: "Anna", cognome: "Esempio", indirizzo: "Via Inventata 1", citta: "Cittàfinta", cap: "00000", note: "Citofono rotto", telefono: "+39 300 000 0001", email: "anna@example.com", items: [{ product_id: "p1", name: "Patch classica", qty: 2, unit_price: 10, variant: "Beige" }], subtotal: 20, shipping: 4.9, total: 24.9 });
    const hc = corpo(o1);
    const tc = testo(hc);
    c("dettaglio: dati del cliente in sola lettura (nome, email, telefono, indirizzo, note del cliente)", true, ["Anna Esempio", "anna@example.com", "+39 300 000 0001", "Via Inventata 1", "00000", "Cittàfinta", "Citofono rotto"].every((x) => tc.includes(x)));
    c("dettaglio: righe con variante, quantità, prezzo, e i tre totali", true, /Patch classica/.test(tc) && /Beige/.test(tc) && /€ 20,00/.test(tc) && /€ 4,90/.test(tc) && /€ 24,90/.test(tc));
    c("dettaglio: telefono ed email sono collegamenti (si chiama e si scrive dal telefono)", true, /href="tel:/.test(hc) && /href="mailto:/.test(hc));
    c("dettaglio: «Segna come pagato» c'è, «Annulla pagamento» no (non è pagato)", [true, false], [/Segna come pagato/.test(tc), /Annulla pagamento/.test(tc)]);
    c("dettaglio: tracking e note interne con etichetta e tasto «Salva»", true, /Tracking|Codice di tracciamento/i.test(tc) && /Note interne/.test(tc) && (hc.match(/>Salva</g) || []).length === 2);
    c("dettaglio: lo storico si carica (segnaposto) e c'è un solo titolo «Storico»", [true, 1], [/storico/i.test(tc), (tc.match(/Storico/g) || []).length >= 1 ? 1 : 0]);
    const oPag = ord({ pagato_il: loc(2026, 11, 11), pagato_importo: 24.9, metodo_pagamento: "bonifico" });
    const tp = testo(corpo(oPag));
    c("ordine pagato: «Pagato € 24,90 · Bonifico», «Annulla pagamento» sì, «Segna come pagato» no", [true, true, false], [/€ 24,90/.test(tp) && /Bonifico/.test(tp), /Annulla pagamento/.test(tp), /Segna come pagato/.test(tp)]);
    const spent = corpo(o1, { comandi: false });
    c("senza migrazione: tutti i comandi spenti (stato, pagato, salva) e il motivo", [true, true], [bottoni(spent).filter((b) => /Segna come pagato|>Salva</.test(b)).every((b) => spento(b)), /database/i.test(testo(spent))]);
    const occ = corpo(o1, { occupato: true });
    c("mentre un'azione è in corso i comandi sono spenti (niente doppi invii)", true, bottoni(occ).filter((b) => /Segna come pagato|>Salva</.test(b)).every((b) => spento(b)));
    c("il menu dello stato nel pannello ha lo stato attuale scelto", true, /<option value="nuovo" selected/.test(selects(hc)[0] || "") || /selected=""[^>]*value="nuovo"|value="nuovo"[^>]*selected/.test(selects(hc)[0] || ""));
    const conEsito = testo(corpo(o1, { esito: { tono: "errore", testo: "Un collega l'ha appena modificato: ho ricaricato." } }));
    c("l'esito dell'ultima azione si vede dentro il pannello", true, /collega l'ha appena modificato/.test(conEsito));
    const incoer = testo(corpo(ord({ total: 99 })));
    c("totale che non torna: avviso nel pannello", true, /totale/i.test(incoer) && /non torn/i.test(incoer));
    c("dettaglio: nessun «NaN»/«undefined» anche con ordine strano, e nessuna parola di cancellazione", [false, false], [/NaN|undefined|Infinity|\[object/.test(testo(corpo(ord({ total: -5, items: [], note: null, indirizzo: "" })))), /elimin|cancell|delete/i.test(hc + corpo(oPag))]);
    c("il pannello chiuso (ordine nullo) non disegna niente", "", renderToStaticMarkup(h(DettaglioOrdine, { ordine: null, onChiudi: () => {}, comandi: true, occupato: false, esito: null, chiedi, storico: stoVuoto })));
  } finally {
    rmSync(dove, { recursive: true, force: true });
  }
}
