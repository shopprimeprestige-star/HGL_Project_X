/** ── NEGOZIO · R2 · T46 · LO STATO DI PAGAMENTO NEL CRM (PURO) ─────────────────────────────────────────────
 *  `src/crm/ecommerce/pagamento.ts` (D41, D52, D58, D66) e i campi nuovi di `Ordine` (`ordine.ts`).
 *  Si prova: da dove nasce lo stato (colonna o deduzione), la scadenza letta, la tabella dei passaggi (TUTTE le 49 coppie),
 *  chi si lavora e chi si conta, quando si può riprovare, la fase della pagina ordine, i passaggi di evasione.
 *  Dati inventati (`@example.com`, ref `HG-T46-…`): nessun dato di clienti veri. */

const ADESSO = new Date("2026-11-20T12:00:00.000Z");
const PASSATO = "2026-11-20T11:00:00.000Z"; // un'ora prima di ADESSO
const FUTURO = "2026-11-20T13:00:00.000Z";

/** Una riga di `shop_orders` minima e valida; `extra` aggiunge o cambia colonne. */
const riga = (extra = {}) => ({ id: "ord-t46", created_at: "2026-11-10T10:00:00.000Z", order_ref: "HG-T46-1", items: [], total: 10, status: "nuovo", ...extra });

export async function prove(mod, { c, gruppo }) {
  const O = mod["ecommerce/ordine"];
  const P = mod["ecommerce/pagamento"];
  const ord = (extra) => O.normalizzaOrdine(riga(extra));
  gruppo("NEGOZIO R2 · LO STATO DI PAGAMENTO NEL CRM (T46)");

  // ── gli stati e le etichette ──
  const SETTE = ["in_attesa", "pagato", "fallito", "scaduto", "rimborsato_in_parte", "rimborsato", "da_incassare"];
  c("i sette stati di D41, in quest'ordine", SETTE, [...P.STATI_PAGAMENTO]);
  c("ogni stato ha la sua etichetta in italiano, diversa dalle altre", [SETTE.length, []], [new Set(SETTE.map((s) => P.ETICHETTA_PAGAMENTO[s])).size, SETTE.filter((s) => !/^[A-ZÀ-Ý]/.test(P.ETICHETTA_PAGAMENTO[s] ?? "") || /_/.test(P.ETICHETTA_PAGAMENTO[s]))]);

  // ── statoPagamentoDi: la colonna se c'è, altrimenti si deduce, in un punto solo (D41) ──
  c("riga R1 con `pagato_il` e senza colonna → pagato", "pagato", P.statoPagamentoDi(ord({ pagato_il: "2026-11-11T09:00:00.000Z" })));
  c("riga R1 senza `pagato_il` → da_incassare", "da_incassare", P.statoPagamentoDi(ord()));
  c("colonna sconosciuta («boh») con `pagato_il` → deduzione: pagato", "pagato", P.statoPagamentoDi(ord({ stato_pagamento: "boh", pagato_il: "2026-11-11T09:00:00.000Z" })));
  c("colonna sconosciuta senza `pagato_il` → deduzione: da_incassare", "da_incassare", P.statoPagamentoDi(ord({ stato_pagamento: "boh" })));
  c("colonna vuota o non testo (42, «», null, un oggetto) → deduzione", Array(4).fill("da_incassare"), [42, "", null, {}].map((v) => P.statoPagamentoDi(ord({ stato_pagamento: v }))));
  c("la colonna vince sulla data: in_attesa con `pagato_il` per errore resta in_attesa", "in_attesa", P.statoPagamentoDi(ord({ stato_pagamento: "in_attesa", pagato_il: "2026-11-11T09:00:00.000Z" })));
  c("la colonna vince sulla data: fallito con `pagato_il` resta fallito; da_incassare con `pagato_il` resta da_incassare", ["fallito", "da_incassare"], [P.statoPagamentoDi(ord({ stato_pagamento: "fallito", pagato_il: "2026-11-11T09:00:00.000Z" })), P.statoPagamentoDi(ord({ stato_pagamento: "da_incassare", pagato_il: "2026-11-11T09:00:00.000Z" }))]);
  c("maiuscole e spazi nella colonna non la rendono sconosciuta", ["pagato", "rimborsato"], [P.statoPagamentoDi(ord({ stato_pagamento: " PAGATO " })), P.statoPagamentoDi(ord({ stato_pagamento: "Rimborsato" }))]);
  c("tutti e sette gli stati si leggono dalla colonna", SETTE, SETTE.map((s) => P.statoPagamentoDi(ord({ stato_pagamento: s }))));

  // ── statoEffettivo: la scadenza si LEGGE, non si lavora (D52) ──
  c("in_attesa con `scade_il` passato → scaduto", "scaduto", P.statoEffettivo(ord({ stato_pagamento: "in_attesa", scade_il: PASSATO }), ADESSO));
  c("in_attesa con `scade_il` futuro → in_attesa", "in_attesa", P.statoEffettivo(ord({ stato_pagamento: "in_attesa", scade_il: FUTURO }), ADESSO));
  c("in_attesa senza `scade_il` → in_attesa", "in_attesa", P.statoEffettivo(ord({ stato_pagamento: "in_attesa" }), ADESSO));
  c("in_attesa con `scade_il` illeggibile → in_attesa (nel dubbio non si dice scaduto)", "in_attesa", P.statoEffettivo(ord({ stato_pagamento: "in_attesa", scade_il: "domani" }), ADESSO));
  c("`scade_il` nell'istante esatto → scaduto", "scaduto", P.statoEffettivo(ord({ stato_pagamento: "in_attesa", scade_il: ADESSO.toISOString() }), ADESSO));
  c("«adesso» non valido → lo stato della tabella", "in_attesa", P.statoEffettivo(ord({ stato_pagamento: "in_attesa", scade_il: PASSATO }), new Date("niente")));
  c("la scadenza tocca SOLO in_attesa: un pagato con `scade_il` passato resta pagato", ["pagato", "fallito", "da_incassare"], [
    P.statoEffettivo(ord({ stato_pagamento: "pagato", scade_il: PASSATO }), ADESSO), P.statoEffettivo(ord({ stato_pagamento: "fallito", scade_il: PASSATO }), ADESSO), P.statoEffettivo(ord({ scade_il: PASSATO }), ADESSO)]);

  // ── la tabella dei passaggi: tutte le 49 coppie ──
  const AMMESSI = {
    in_attesa: ["pagato", "fallito", "scaduto"],
    pagato: ["rimborsato_in_parte", "rimborsato"],
    fallito: ["pagato"],
    scaduto: ["pagato"],
    rimborsato_in_parte: ["rimborsato"],
    rimborsato: [],
    da_incassare: ["pagato"],
  };
  const coppie = SETTE.flatMap((da) => SETTE.map((a) => [da, a]));
  c("49 coppie: ammesse solo quelle della tabella (rimborsato → pagato no, pagato → in_attesa no, in_attesa → in_attesa no…)", [], coppie.filter(([da, a]) => P.passaggioPagamento(da, a).ok !== AMMESSI[da].includes(a)));
  c("la tabella esportata `PASSAGGI_PAGAMENTO` dice la stessa cosa", AMMESSI, Object.fromEntries(SETTE.map((s) => [s, [...P.PASSAGGI_PAGAMENTO[s]]])));
  c("scaduto → pagato è ammesso CON avviso (pagato dopo la scadenza: controlla la giacenza); gli altri passaggi senza avviso", [true, true], (() => {
    const s = P.passaggioPagamento("scaduto", "pagato");
    const altri = coppie.filter(([da, a]) => P.passaggioPagamento(da, a).ok && !(da === "scaduto" && a === "pagato")).map(([da, a]) => P.passaggioPagamento(da, a).avviso);
    return [typeof s.avviso === "string" && s.avviso.length > 15, altri.every((x) => x === null)];
  })());
  c("fallito → pagato è ammesso, senza avviso", [true, null], ((r) => [r.ok, r.avviso])(P.passaggioPagamento("fallito", "pagato")));
  // «riapri» (D66): fallito|scaduto → in_attesa SOLO così; pagato|rimborsato mai
  c("riapri: fallito → in_attesa e scaduto → in_attesa sì", [true, true], [P.passaggioPagamento("fallito", "in_attesa", true).ok, P.passaggioPagamento("scaduto", "in_attesa", true).ok]);
  c("senza «riapri» fallito|scaduto → in_attesa è rifiutato", [false, false], [P.passaggioPagamento("fallito", "in_attesa").ok, P.passaggioPagamento("scaduto", "in_attesa").ok]);
  c("riapri da pagato, rimborsato_in_parte, rimborsato, da_incassare, in_attesa → rifiutato, anche con «riapri»", Array(5).fill(false), ["pagato", "rimborsato_in_parte", "rimborsato", "da_incassare", "in_attesa"].map((da) => P.passaggioPagamento(da, "in_attesa", true).ok));
  c("«riapri» non apre altre strade: scaduto → fallito, rimborsato → pagato restano no", [false, false], [P.passaggioPagamento("scaduto", "fallito", true).ok, P.passaggioPagamento("rimborsato", "pagato", true).ok]);
  c("ogni rifiuto ha la sua frase in italiano", [], coppie.filter(([da, a]) => { const r = P.passaggioPagamento(da, a); return !r.ok && !(typeof r.errore === "string" && r.errore.length > 10); }));
  c("stati che non esistono → rifiutati, senza lanciare", [false, false, false], [P.passaggioPagamento("boh", "pagato").ok, P.passaggioPagamento("pagato", undefined).ok, P.passaggioPagamento(null, null).ok]);

  // ── chi si lavora e chi si conta ──
  const LAVORABILI = ["pagato", "rimborsato_in_parte", "da_incassare"];
  c("puoLavorare: pagato, rimborsato_in_parte, da_incassare sì; in_attesa, scaduto, fallito, rimborsato no", [], SETTE.filter((s) => P.puoLavorare(ord({ stato_pagamento: s })) !== LAVORABILI.includes(s)));
  c("puoLavorare: un ordine R1 (colonna vuota), pagato o no, si lavora", [true, true], [P.puoLavorare(ord()), P.puoLavorare(ord({ pagato_il: "2026-11-11T09:00:00.000Z" }))]);
  c("puoLavorare: un in_attesa con la scadenza passata NON si lavora (né prima né dopo la scadenza)", false, P.puoLavorare(ord({ stato_pagamento: "in_attesa", scade_il: PASSATO })));
  c("contaComeLavoro = puoLavorare e non prova", [true, false, false, false], [
    P.contaComeLavoro(ord({ stato_pagamento: "pagato" })), P.contaComeLavoro(ord({ stato_pagamento: "pagato", prova: true })), P.contaComeLavoro(ord({ stato_pagamento: "in_attesa" })), P.contaComeLavoro(ord({ stato_pagamento: "rimborsato" }))]);
  c("contaNelleCifre = non prova (qualunque stato)", [true, false, true, false], [
    P.contaNelleCifre(ord()), P.contaNelleCifre(ord({ prova: true })), P.contaNelleCifre(ord({ stato_pagamento: "in_attesa" })), P.contaNelleCifre(ord({ stato_pagamento: "pagato", prova: true }))]);
  c("`prova` si legge solo se è proprio true (testo «true», 1 o «sì» no)", [true, false, false, false, false], [true, "true", 1, "sì", undefined].map((v) => ord({ prova: v }).prova));

  // ── puoRiprovare (D66): serve lo stato IN TABELLA fallito|scaduto, non quello letto dalla scadenza ──
  c("puoRiprovare: fallito e scaduto in tabella sì", [true, true], [P.puoRiprovare(ord({ stato_pagamento: "fallito" })), P.puoRiprovare(ord({ stato_pagamento: "scaduto" }))]);
  c("puoRiprovare: in_attesa con la scadenza passata NO (prima si rilegge Stripe), anche se `statoEffettivo` dice scaduto", ["scaduto", false], [P.statoEffettivo(ord({ stato_pagamento: "in_attesa", scade_il: PASSATO }), ADESSO), P.puoRiprovare(ord({ stato_pagamento: "in_attesa", scade_il: PASSATO }))]);
  c("puoRiprovare: pagato, rimborsato, rimborsato_in_parte, da_incassare, in_attesa e riga R1 no", Array(6).fill(false), [...["pagato", "rimborsato", "rimborsato_in_parte", "da_incassare", "in_attesa"].map((s) => P.puoRiprovare(ord({ stato_pagamento: s }))), P.puoRiprovare(ord())]);

  // ── fasePubblica (§3.3): mai «pagato» da solo ──
  const fase = (extra) => P.fasePubblica(ord(extra), ADESSO);
  c("in_attesa → verifica (anche con la scadenza futura o assente)", ["verifica", "verifica"], [fase({ stato_pagamento: "in_attesa", scade_il: FUTURO }), fase({ stato_pagamento: "in_attesa" })]);
  c("in_attesa con la scadenza passata → scaduto", "scaduto", fase({ stato_pagamento: "in_attesa", scade_il: PASSATO }));
  c("fallito → non_riuscito; scaduto → scaduto", ["non_riuscito", "scaduto"], [fase({ stato_pagamento: "fallito" }), fase({ stato_pagamento: "scaduto" })]);
  c("pagato → la fase segue l'evasione: nuovo → pagato, poi in_preparazione, spedito, consegnato", ["pagato", "in_preparazione", "spedito", "consegnato"], ["nuovo", "in_preparazione", "spedito", "consegnato"].map((status) => fase({ stato_pagamento: "pagato", status })));
  c("rimborsato → rimborsato; rimborsato_in_parte segue l'evasione", ["rimborsato", "spedito"], [fase({ stato_pagamento: "rimborsato", status: "spedito" }), fase({ stato_pagamento: "rimborsato_in_parte", status: "spedito" })]);
  c("annullato vince su tutto, anche su in_attesa, fallito e rimborsato", Array(4).fill("annullato"), ["pagato", "in_attesa", "fallito", "rimborsato"].map((s) => fase({ stato_pagamento: s, status: "annullato" })));
  c("da_incassare e riga R1 non pagata → verifica (mai «pagato» senza un pagamento)", ["verifica", "verifica"], [fase({ stato_pagamento: "da_incassare" }), fase()]);
  c("riga R1 con `pagato_il` → pagato", "pagato", fase({ pagato_il: "2026-11-11T09:00:00.000Z" }));
  const FASI = ["verifica", "pagato", "in_preparazione", "spedito", "consegnato", "annullato", "non_riuscito", "scaduto", "rimborsato"];
  c("la fase è sempre una delle nove del contratto, qualunque combinazione", [], SETTE.flatMap((s) => ["nuovo", "in_preparazione", "spedito", "consegnato", "annullato", "ESOTICO"].map((status) => ({ s, status, f: fase({ stato_pagamento: s, status }) }))).filter((x) => !FASI.includes(x.f)));

  // ── i passaggi di evasione (D55) ──
  const ev = (da, a, opz) => P.passaggioEvasione(da, a, opz);
  c("in avanti, un passo alla volta, senza motivo: nuovo → in_preparazione → spedito → consegnato", [true, true, true], [ev("nuovo", "in_preparazione").ok, ev("in_preparazione", "spedito").ok, ev("spedito", "consegnato").ok]);
  c("in avanti saltando un passo (nuovo → consegnato, in_preparazione → consegnato) no; nuovo → spedito sì (decisione del capo progetto, T47: lo studio può spedire senza passare da «in preparazione»)", [false, false, true], [ev("nuovo", "consegnato").ok, ev("in_preparazione", "consegnato").ok, ev("nuovo", "spedito").ok]);
  c("all'indietro SENZA motivo → rifiutato (in_preparazione → nuovo, spedito → in_preparazione, annullato → nuovo)", [false, false, false], [ev("in_preparazione", "nuovo").ok, ev("spedito", "in_preparazione").ok, ev("annullato", "nuovo").ok]);
  c("all'indietro con un motivo vero → ammesso", [true, true, true], [ev("in_preparazione", "nuovo", { motivo: "Clic sbagliato" }).ok, ev("spedito", "in_preparazione", { motivo: "Clic sbagliato" }).ok, ev("annullato", "nuovo", { motivo: "Annullato per errore" }).ok]);
  c("un motivo di soli spazi, null o non testo vale come nessun motivo", Array(4).fill(false), ["   ", "", null, 7].map((motivo) => ev("spedito", "in_preparazione", { motivo }).ok));
  c("annullato → nuovo con un rimborso richiesto o riuscito → rifiutato, anche con il motivo", false, ev("annullato", "nuovo", { motivo: "Annullato per errore", rimborsoAttivo: true }).ok);
  c("annullato: da nuovo, in_preparazione e spedito con motivo sì, senza motivo no", [true, true, true, false, false, false], [
    ev("nuovo", "annullato", { motivo: "Il cliente ha cambiato idea" }).ok, ev("in_preparazione", "annullato", { motivo: "Prodotto finito" }).ok, ev("spedito", "annullato", { motivo: "Reso prima della consegna" }).ok,
    ev("nuovo", "annullato").ok, ev("in_preparazione", "annullato").ok, ev("spedito", "annullato").ok]);
  c("consegnato e annullato sono finali: da consegnato non si va da nessuna parte; da annullato solo a nuovo", [[], ["nuovo"]], [
    ["nuovo", "in_preparazione", "spedito", "annullato"].filter((a) => ev("consegnato", a, { motivo: "x motivo" }).ok),
    ["nuovo", "in_preparazione", "spedito", "consegnato"].filter((a) => ev("annullato", a, { motivo: "x motivo" }).ok)]);
  c("lo stesso stato non è un passaggio; stati che non esistono → rifiutati senza lanciare", [false, false, false], [ev("nuovo", "nuovo").ok, ev("boh", "nuovo", { motivo: "x motivo" }).ok, ev("nuovo", undefined).ok]);
  c("la risposta dice se serve il motivo (in avanti no, all'indietro e annullo sì)", [false, true, true], [ev("nuovo", "in_preparazione").serveMotivo, ev("spedito", "in_preparazione", { motivo: "Clic sbagliato" }).serveMotivo, ev("nuovo", "annullato", { motivo: "Prodotto finito" }).serveMotivo]);
  c("la tabella esportata ha cinque stati e nessun passaggio verso uno stato che non esiste", [5, []], [Object.keys(P.PASSAGGI_EVASIONE).length, Object.values(P.PASSAGGI_EVASIONE).flat().filter((p) => !O.STATI_ORDINE.includes(p.a))]);

  // ── i campi nuovi di Ordine: valore sano se la colonna manca, mai un'eccezione ──
  const vecchio = ord();
  c("riga R1 (nessuna colonna di S4): tutti i campi nuovi hanno il loro valore sano", {
    statoPagamento: null, stripeSessioneId: null, stripePagamentoId: null, metodoDettaglio: null, prova: false, canale: null, totaleCent: null, rimborsatoCent: 0, scadeIl: null, riprovaN: 0,
    provincia: null, nazione: null, giacenzaDaVerificare: false, giacenzaScalataIl: null, giacenzaRimessaIl: null, speditoIl: null, corriere: null, trackingUrl: null, senzaTracking: false,
    annulloMotivo: null, annullatoIl: null, fatturaRichiesta: false, fatturaEmessaIl: null, fatturaNota: null, emailInviate: {}, avvisi: [],
  }, Object.fromEntries(Object.keys({
    statoPagamento: 0, stripeSessioneId: 0, stripePagamentoId: 0, metodoDettaglio: 0, prova: 0, canale: 0, totaleCent: 0, rimborsatoCent: 0, scadeIl: 0, riprovaN: 0, provincia: 0, nazione: 0, giacenzaDaVerificare: 0,
    giacenzaScalataIl: 0, giacenzaRimessaIl: 0, speditoIl: 0, corriere: 0, trackingUrl: 0, senzaTracking: 0, annulloMotivo: 0, annullatoIl: 0, fatturaRichiesta: 0, fatturaEmessaIl: 0, fatturaNota: 0, emailInviate: 0, avvisi: 0,
  }).map((k) => [k, vecchio[k]])));
  c("la riga R1 con i default di S4 si legge identica a quella senza colonne (stessi campi, stessi valori)", vecchio, O.normalizzaOrdine(riga({
    stato_pagamento: null, stripe_sessione_id: null, stripe_pagamento_id: null, metodo_dettaglio: null, prova: false, canale: null, totale_cent: null, rimborsato_cent: 0, scade_il: null, riprova_n: 0, provincia: null, nazione: null,
    giacenza_da_verificare: false, giacenza_scalata_il: null, giacenza_rimessa_il: null, spedito_il: null, corriere: null, tracking_url: null, senza_tracking: null, annullo_motivo: null, annullato_il: null,
    fattura_richiesta: false, fattura_emessa_il: null, fattura_nota: null, email_inviate: {}, avvisi: [],
  })));
  const nuovo = ord({
    stato_pagamento: "pagato", stripe_sessione_id: "cs_test_finta0001", stripe_pagamento_id: "pi_finto0001", metodo_dettaglio: "visa ····4242", prova: true, canale: "sito", totale_cent: 2890, rimborsato_cent: 500,
    scade_il: FUTURO, riprova_n: 2, provincia: "RM", nazione: "IT", giacenza_da_verificare: true, giacenza_scalata_il: PASSATO, giacenza_rimessa_il: null, spedito_il: PASSATO, corriere: "Corriere finto",
    tracking_url: "https://esempio.example.com/t/ABC", senza_tracking: true, annullo_motivo: "Prova", annullato_il: PASSATO, fattura_richiesta: true, fattura_emessa_il: PASSATO, fattura_nota: "Fattura n. 1",
    email_inviate: { conferma: { stato: "inviata", il: PASSATO, codice: null } }, avvisi: [{ codice: "doppio_pagamento", gravita: "rosso", rif: "cs_test_finta0002", il: PASSATO }],
  });
  c("riga di S4 piena: i campi si leggono (centesimi interi, date, booleani, avvisi, email)", {
    statoPagamento: "pagato", stripeSessioneId: "cs_test_finta0001", stripePagamentoId: "pi_finto0001", metodoDettaglio: "visa ····4242", prova: true, canale: "sito", totaleCent: 2890, rimborsatoCent: 500, scadeIl: FUTURO, riprovaN: 2,
    provincia: "RM", nazione: "IT", giacenzaDaVerificare: true, giacenzaScalataIl: PASSATO, giacenzaRimessaIl: null, speditoIl: PASSATO, corriere: "Corriere finto", trackingUrl: "https://esempio.example.com/t/ABC", senzaTracking: true,
    annulloMotivo: "Prova", annullatoIl: PASSATO, fatturaRichiesta: true, fatturaEmessaIl: PASSATO, fatturaNota: "Fattura n. 1",
    emailInviate: { conferma: { stato: "inviata", il: PASSATO, codice: null } }, avvisi: [{ codice: "doppio_pagamento", gravita: "rosso", rif: "cs_test_finta0002", il: PASSATO }],
  }, Object.fromEntries(Object.keys({ statoPagamento: 0, stripeSessioneId: 0, stripePagamentoId: 0, metodoDettaglio: 0, prova: 0, canale: 0, totaleCent: 0, rimborsatoCent: 0, scadeIl: 0, riprovaN: 0, provincia: 0, nazione: 0, giacenzaDaVerificare: 0,
    giacenzaScalataIl: 0, giacenzaRimessaIl: 0, speditoIl: 0, corriere: 0, trackingUrl: 0, senzaTracking: 0, annulloMotivo: 0, annullatoIl: 0, fatturaRichiesta: 0, fatturaEmessaIl: 0, fatturaNota: 0, emailInviate: 0, avvisi: 0 }).map((k) => [k, nuovo[k]])));
  const sporco = O.normalizzaOrdine(riga({
    stato_pagamento: 7, totale_cent: -5, rimborsato_cent: "tanto", riprova_n: -3, prova: "true", scade_il: "domani", spedito_il: "ieri", giacenza_da_verificare: 1, senza_tracking: "si", fattura_richiesta: "true",
    email_inviate: "no", avvisi: { codice: "x" }, corriere: 42, tracking_url: {}, provincia: ["RM"],
  }));
  c("colonne sporche (negativi, testo al posto di numeri, tipi sbagliati) → valori sani, nessuna eccezione", {
    statoPagamento: null, totaleCent: null, rimborsatoCent: 0, riprovaN: 0, prova: false, scadeIl: null, speditoIl: null, giacenzaDaVerificare: false, senzaTracking: false, fatturaRichiesta: false, emailInviate: {}, avvisi: [], corriere: null, trackingUrl: null, provincia: null,
  }, Object.fromEntries(["statoPagamento", "totaleCent", "rimborsatoCent", "riprovaN", "prova", "scadeIl", "speditoIl", "giacenzaDaVerificare", "senzaTracking", "fatturaRichiesta", "emailInviate", "avvisi", "corriere", "trackingUrl", "provincia"].map((k) => [k, sporco[k]])));
  c("importi in centesimi non interi, enormi o infiniti → interi o zero (mai NaN, mai Infinity); un totale illeggibile resta null", [12, 0, 0, 1234, null, null], [
    ord({ rimborsato_cent: 12.7 }).rimborsatoCent, ord({ rimborsato_cent: Infinity }).rimborsatoCent, ord({ rimborsato_cent: 1e300 }).rimborsatoCent, ord({ rimborsato_cent: "1234" }).rimborsatoCent, ord({ totale_cent: 1e300 }).totaleCent, ord({ totale_cent: "boh" }).totaleCent]);
  c("avvisi: gli elementi non validi si scartano, il resto resta, con un tetto di 50", [1, 50], [
    ord({ avvisi: [null, 5, "x", { codice: "ok", gravita: "giallo" }] }).avvisi.length,
    ord({ avvisi: Array.from({ length: 500 }, () => ({ codice: "x", gravita: "giallo" })) }).avvisi.length]);
  c("email inviate: solo gli elementi con uno `stato` testuale si tengono", { buona: { stato: "errore", il: PASSATO, codice: "429" } },
    ord({ email_inviate: { conferma: "inviata", altra: null, buona: { stato: "errore", il: PASSATO, codice: "429" }, vuota: {} } }).emailInviate);
  c("`MetodoPagamento` guadagna «stripe»: si legge, con la sua etichetta; un metodo sconosciuto resta «altro»", ["stripe", "Stripe", "altro"], [ord({ metodo_pagamento: "stripe" }).metodoPagamento, O.ETICHETTA_METODO.stripe, ord({ metodo_pagamento: "satispay" }).metodoPagamento]);
}
