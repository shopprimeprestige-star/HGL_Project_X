/** ── NEGOZIO · R2 · T47 · LA SCHERMATA DEGLI ORDINI, REGOLE NUOVE (PURO) ───────────────────────────────────
 *  `src/crm/ecommerce/ordini-ui.ts`: i filtri nuovi (tutti opzionali), i conteggi senza gli ordini in attesa, gli avvisi nuovi
 *  (D55, D58, `pagato_dopo_scadenza`), le conferme e le frasi delle azioni nuove, le frasi degli errori nuovi di S4, lo storico.
 *  Parte 1: la FOTOGRAFIA. `filtraOrdini` e `conteggiPerStato` SENZA i filtri nuovi danno le stesse righe di prima (SPEC 8A n. 7),
 *  sui 40 ordini di `_dati-r2.mjs`, in tutte e due le forme (colonne di S4 assenti, o ai loro default). Le impronte sono state prese dal
 *  codice di `ordini-ui.ts` com'era PRIMA di T47 (fuso Europe/Rome fisso: i periodi sono giorni locali).
 *  Dati inventati (`@example.com`): nessun dato di clienti veri. */
import { createHash } from "node:crypto";
import { ordiniR1R2, conDefaultS4, PERIODI_FOTO, FUSO_FOTO } from "./_dati-r2.mjs";
import { rigaOrdineProva } from "../ecommerce/dati.mjs";

/** Le impronte (SHA-256) prese dal codice di prima di T47. Non si cambiano insieme al codice. */
export const IMPRONTE_PRIMA = {
  assenti: { filtra: "31cbce8af4dbec1f068f3fb774bd585385f6b09fed762557acff09b40eb18dfc", conteggi: "c46ed836212a06d553d10466722d57fbc382fd5f82fc7da46318de52f6cc966d" },
  default: { filtra: "31cbce8af4dbec1f068f3fb774bd585385f6b09fed762557acff09b40eb18dfc", conteggi: "c46ed836212a06d553d10466722d57fbc382fd5f82fc7da46318de52f6cc966d" },
};

const sha = (x) => createHash("sha256").update(JSON.stringify(x)).digest("hex");

/** Le righe che `filtraOrdini` e i conteggi restituiscono su tante combinazioni di filtri (solo quelli di prima). */
export function fotoFiltri(U, ordini) {
  const filtra = [];
  const conteggi = [];
  const STATI = [undefined, "nuovo", "in_preparazione", "spedito", "consegnato", "annullato"];
  for (const [nome, periodo] of Object.entries(PERIODI_FOTO))
    for (const pagato of [undefined, "si", "no"]) {
      conteggi.push([nome, pagato, U.conteggiPerStato(ordini, { periodo, pagato })]);
      for (const stato of STATI) filtra.push([nome, pagato, stato, U.filtraOrdini(ordini, { periodo, stato, pagato }).map((o) => o.id)]);
    }
  for (const ricerca of ["esempio", "cliente3", "HG-F01", "300 000 0105", "  ANNA ", "-", "zzzz"]) filtra.push([ricerca, U.filtraOrdini(ordini, { periodo: PERIODI_FOTO.tutto, ricerca }).map((o) => o.id)]);
  return { filtra: sha(filtra), conteggi: sha(conteggi) };
}

export async function prove(mod, { c, gruppo }) {
  const O = mod["ecommerce/ordine"];
  const U = mod["ecommerce/ordini-ui"];
  const ID = "00000000-0000-4000-8000-000000000001";
  const ADESSO = new Date("2026-11-21T12:00:00.000Z");
  const PASSATO = "2026-11-21T11:00:00.000Z";
  const FUTURO = "2026-11-21T13:00:00.000Z";
  const stripe = (extra = {}) => O.normalizzaOrdine(rigaOrdineProva({ stato_pagamento: "pagato", pagato_il: "2026-11-20T10:00:00.000Z", pagato_importo: 24.9, metodo_pagamento: "stripe", canale: "sito", totale_cent: 2490, ...extra }));
  const vecchio = (extra = {}) => O.normalizzaOrdine(rigaOrdineProva(extra));
  const TUTTO = PERIODI_FOTO.tutto;
  gruppo("NEGOZIO R2 · SCHERMATA DEGLI ORDINI, REGOLE NUOVE (T47)");

  // ── la fotografia: senza i filtri nuovi, le righe di prima ──
  const prima = process.env.TZ;
  process.env.TZ = FUSO_FOTO;
  let foto;
  try {
    const righe = ordiniR1R2();
    foto = {
      assenti: fotoFiltri(U, O.normalizzaTutti(righe).ordini),
      default: fotoFiltri(U, O.normalizzaTutti(righe.map(conDefaultS4)).ordini),
    };
  } finally {
    if (prima === undefined) delete process.env.TZ; else process.env.TZ = prima;
  }
  c("filtraOrdini senza i filtri nuovi: stesse righe di prima (colonne di S4 assenti)", IMPRONTE_PRIMA.assenti.filtra, foto.assenti.filtra);
  c("conteggiPerStato senza i filtri nuovi: stessi numeri di prima (colonne di S4 assenti)", IMPRONTE_PRIMA.assenti.conteggi, foto.assenti.conteggi);
  c("filtraOrdini senza i filtri nuovi: stesse righe di prima (colonne di S4 ai default)", IMPRONTE_PRIMA.default.filtra, foto.default.filtra);
  c("conteggiPerStato senza i filtri nuovi: stessi numeri di prima (colonne di S4 ai default)", IMPRONTE_PRIMA.default.conteggi, foto.default.conteggi);

  // ── i filtri nuovi ──
  const mondo = [
    stripe({ id: "00000000-0000-4000-8000-0000000000a1", order_ref: "HG-A1", created_at: "2026-11-20T09:00:00.000Z" }), //                                  pagato, sito
    stripe({ id: "00000000-0000-4000-8000-0000000000a2", order_ref: "HG-A2", created_at: "2026-11-20T09:10:00.000Z", stato_pagamento: "in_attesa", pagato_il: null, scade_il: FUTURO }),
    stripe({ id: "00000000-0000-4000-8000-0000000000a3", order_ref: "HG-A3", created_at: "2026-11-20T09:20:00.000Z", stato_pagamento: "in_attesa", pagato_il: null, scade_il: PASSATO }), // in attesa, ma scaduta
    stripe({ id: "00000000-0000-4000-8000-0000000000a4", order_ref: "HG-A4", created_at: "2026-11-20T09:30:00.000Z", prova: true }), //                       di prova
    stripe({ id: "00000000-0000-4000-8000-0000000000a5", order_ref: "HG-A5", created_at: "2026-11-20T09:40:00.000Z", fattura_richiesta: true }), //            fattura da fare
    stripe({ id: "00000000-0000-4000-8000-0000000000a6", order_ref: "HG-A6", created_at: "2026-11-20T09:50:00.000Z", fattura_richiesta: true, fattura_emessa_il: "2026-11-21T08:00:00.000Z" }),
    stripe({ id: "00000000-0000-4000-8000-0000000000a7", order_ref: "HG-A7", created_at: "2026-11-20T10:00:00.000Z", giacenza_da_verificare: true }),
    vecchio({ id: "00000000-0000-4000-8000-0000000000a8", order_ref: "HG-A8", created_at: "2026-11-20T10:10:00.000Z" }), //                                    vecchio, non pagato
  ];
  const ids = (f) => U.filtraOrdini(mondo, { periodo: TUTTO, ...f }).map((o) => o.id.slice(-2)).sort();
  c("senza filtri: tutti e otto (anche in attesa e di prova: la lista li mostra)", ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8"], ids({}));
  c("canale «sito»: solo gli ordini della cassa nuova", ["a1", "a2", "a3", "a4", "a5", "a6", "a7"], ids({ canale: "sito" }));
  c("canale «vecchio»: gli ordini senza canale", ["a8"], ids({ canale: "vecchio" }));
  c("statoPagamento «pagato»", ["a1", "a4", "a5", "a6", "a7"], ids({ statoPagamento: "pagato" }));
  c("statoPagamento «in_attesa» senza «adesso»: si legge la colonna", ["a2", "a3"], ids({ statoPagamento: "in_attesa" }));
  c("statoPagamento «in_attesa» con «adesso»: quella con la scadenza passata si legge «scaduto» (D52)", [["a2"], ["a3"]], [ids({ statoPagamento: "in_attesa", adesso: ADESSO }), ids({ statoPagamento: "scaduto", adesso: ADESSO })]);
  c("statoPagamento «da_incassare»: l'ordine vecchio non pagato (stato dedotto)", ["a8"], ids({ statoPagamento: "da_incassare" }));
  c("fatturaDaFare: richiesta e non ancora emessa", ["a5"], ids({ fatturaDaFare: true }));
  c("fatturaDaFare falso: non filtra", 8, ids({ fatturaDaFare: false }).length);
  c("giacenzaDaVerificare: solo quelli segnati", ["a7"], ids({ giacenzaDaVerificare: true }));
  c("mostraProva falso: nasconde gli ordini di prova; vero o assente: li lascia", [7, 8, 8], [ids({ mostraProva: false }).length, ids({ mostraProva: true }).length, ids({}).length]);
  c("più filtri insieme: sito + pagato + senza prova", ["a1", "a5", "a6", "a7"], ids({ canale: "sito", statoPagamento: "pagato", mostraProva: false }));
  c("i filtri nuovi non toccano l'elenco in ingresso", 8, mondo.length);

  // ── i conteggi: gli in attesa non contano come «Nuovo» ──
  const n = U.conteggiPerStato(mondo, { periodo: TUTTO });
  c("conteggiPerStato esclude gli ordini in attesa (anche scaduti in lettura: restano in attesa in tabella)", { nuovo: 6, tutti: 6 }, { nuovo: n.nuovo, tutti: n.tutti });
  const nAdesso = U.conteggiPerStato(mondo, { periodo: TUTTO, adesso: ADESSO });
  c("anche con «adesso» l'ordine con la sessione scaduta in lettura non conta come Nuovo", 6, nAdesso.nuovo);
  const nFiltro = U.conteggiPerStato(mondo, { periodo: TUTTO, statoPagamento: "in_attesa" });
  c("se il filtro chiede proprio gli in attesa, i conteggi li contano", 2, nFiltro.nuovo);
  c("i conteggi rispettano anche i filtri nuovi (fattura da fare)", 1, U.conteggiPerStato(mondo, { periodo: TUTTO, fatturaDaFare: true }).tutti);

  // ── gli avvisi ──
  const av = (extra) => U.avvisiOrdine(stripe(extra));
  const avviso = (codice, gravita = "rosso") => ({ codice, gravita, rif: null, il: "2026-11-21T10:00:00.000Z" });
  c("ordine sano: nessun avviso", [], av({}));
  c("ordine vecchio sano: nessun avviso (come prima)", [], U.avvisiOrdine(vecchio()));
  c("giacenza da verificare (colonna): una frase che lo dice", true, av({ giacenza_da_verificare: true }).some((f) => /giacenza/i.test(f) && /verific/i.test(f)));
  c("giacenza da verificare: colonna e avviso insieme non si ripetono", 1, av({ giacenza_da_verificare: true, avvisi: [avviso("giacenza_da_verificare", "arancio")] }).filter((f) => /giacenza/i.test(f)).length);
  c("importo diverso: dice che NON è stato segnato pagato", true, av({ avvisi: [avviso("importo_diverso")] }).some((f) => /importo/i.test(f) && /non/i.test(f)));
  c("contestazione: nomina la contestazione", true, av({ avvisi: [avviso("contestazione")] }).some((f) => /contestazione|contestato/i.test(f)));
  c("pagato dopo l'annullo: lo dice", true, av({ avvisi: [avviso("pagato_dopo_annullo")] }).some((f) => /dopo l'annull/i.test(f)));
  c("pagato dopo la scadenza (approvato dal capo progetto): lo dice e manda a controllare la giacenza", true, av({ avvisi: [avviso("pagato_dopo_scadenza", "arancio")] }).some((f) => /dopo la scadenza/i.test(f) && /giacenza/i.test(f)));
  c("doppio pagamento, sessione sconosciuta, valuta diversa, errore di Stripe: ognuno ha la sua frase", [], ["doppio_pagamento", "sessione_sconosciuta", "valuta_diversa", "stripe_errore"].filter((k) => av({ avvisi: [avviso(k)] }).length !== 1));
  c("lo stesso avviso scritto due volte compare una volta sola", 1, av({ avvisi: [avviso("contestazione"), avviso("contestazione")] }).length);
  c("un codice che non conosciamo non sparisce: una frase generica", 1, av({ avvisi: [avviso("codice_nuovo_di_domani")] }).length);
  c("nessuna frase mostra un codice grezzo con il trattino basso", [], av({ giacenza_da_verificare: true, avvisi: ["doppio_pagamento", "importo_diverso", "contestazione", "pagato_dopo_annullo", "pagato_dopo_scadenza", "sessione_sconosciuta", "valuta_diversa", "stripe_errore"].map((k) => avviso(k)) }).filter((f) => /[a-z]+_[a-z]+/.test(f)));
  c("gli avvisi di prima restano (annullato ma pagato)", true, U.avvisiOrdine(vecchio({ status: "annullato", pagato_il: "2026-11-18T10:00:00.000Z" })).some((f) => /annullato ma risulta pagato/.test(f)));

  // ── gli errori nuovi di S4 ──
  const NUOVI = ["rimborso_chiave_altro_ordine", "sessione_di_un_altro_ordine", "ordine_id_gia_usato", "rimborso_oltre_pagato", "rimborso_importo_non_valido", "ordine_non_pagato", "ordine_non_riapribile"];
  c("fraseErroreOrdine: ogni errore nuovo ha una frase in italiano, senza il codice", [], NUOVI.filter((k) => { const f = U.fraseErroreOrdine(k); return typeof f !== "string" || f.length < 15 || /_/.test(f); }));
  c("fraseErroreOrdine: frasi diverse per errori diversi", NUOVI.length, new Set(NUOVI.map((k) => U.fraseErroreOrdine(k))).size);
  c("fraseErroreOrdine: un codice sconosciuto o non testo → una frase generica, senza lanciare", [true, true], [typeof U.fraseErroreOrdine("boh_boh") === "string", typeof U.fraseErroreOrdine(undefined) === "string"]);

  // ── le conferme delle azioni nuove ──
  const pagato = stripe();
  const az = (extra) => ({ azione: "annulla", ordineId: ID, motivo: "Il cliente ha cambiato idea", rimborso: "nessuno", rimettiInMagazzino: false, ...extra });
  c("serveConferma: annulla, rimborso, correggi_stato, email_invia sì", [true, true, true, true], [
    U.serveConferma(az({})), U.serveConferma({ azione: "rimborso", ordineId: ID, importoCent: 500, motivo: "Reso", chiaveRichiesta: "00000000-0000-4000-8000-0000000000c1", conferma: true }),
    U.serveConferma({ azione: "correggi_stato", ordineId: ID, da: "spedito", a: "in_preparazione", motivo: "Errore" }), U.serveConferma({ azione: "email_invia", ordineId: ID, chiave: "spedito" })]);
  c("serveConferma: spedisci, riconcilia, fattura_emessa, giacenza_verificata no (la schermata è già il modulo)", [false, false, false, false], [
    U.serveConferma({ azione: "spedisci", ordineId: ID, corriere: "BRT", numero: "123456" }), U.serveConferma({ azione: "riconcilia", ordineId: ID }),
    U.serveConferma({ azione: "fattura_emessa", ordineId: ID }), U.serveConferma({ azione: "giacenza_verificata", ordineId: ID })]);
  c("serveConferma: le azioni di prima come prima", [true, true, false, false, false], [
    U.serveConferma({ azione: "stato", ordineId: ID, da: "nuovo", a: "annullato" }), U.serveConferma({ azione: "pagamento_annullato", ordineId: ID }),
    U.serveConferma({ azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" }), U.serveConferma({ azione: "tracking", ordineId: ID, valore: "x" }), U.serveConferma({ azione: "nota_interna", ordineId: ID, valore: "x" })]);
  const tAnn = U.testoConferma(az({ rimborso: "ora", rimettiInMagazzino: true, chiaveRichiesta: "00000000-0000-4000-8000-0000000000c1" }), pagato);
  c("testoConferma annulla: nomina l'ordine, il rimborso (con la cifra) e il magazzino", true, !!tAnn && tAnn.titolo.includes(pagato.ref) && /24,90/.test(tAnn.testo) && /magazzino/i.test(tAnn.testo) && tAnn.si.length > 3);
  c("testoConferma annulla senza rimborso: dice che non si rimborsa", true, /nessun rimborso/i.test(U.testoConferma(az({}), pagato)?.testo ?? ""));
  const tRim = U.testoConferma({ azione: "rimborso", ordineId: ID, importoCent: 1000, motivo: "Reso", chiaveRichiesta: "00000000-0000-4000-8000-0000000000c1", conferma: true }, pagato);
  c("testoConferma rimborso: la cifra, e che non si può annullare", true, !!tRim && /10,00/.test(tRim.testo) && /non (si può|puoi) (annullare|disfare)/i.test(tRim.testo));
  const tCor = U.testoConferma({ azione: "correggi_stato", ordineId: ID, da: "spedito", a: "in_preparazione", motivo: "Errore" }, stripe({ status: "spedito", email_inviate: { spedito: { stato: "inviata", il: PASSATO, codice: null } } }));
  c("testoConferma correggi_stato: se l'email «spedito» è già partita lo dice (resta un fatto)", true, /email/i.test(tCor?.testo ?? "") && /già (partita|inviata)/i.test(tCor?.testo ?? ""));
  const tCor2 = U.testoConferma({ azione: "correggi_stato", ordineId: ID, da: "spedito", a: "in_preparazione", motivo: "Errore" }, stripe({ status: "spedito" }));
  c("testoConferma correggi_stato: senza email partita non ne parla", false, /già (partita|inviata)/i.test(tCor2?.testo ?? ""));
  const tMail = U.testoConferma({ azione: "email_invia", ordineId: ID, chiave: "spedito" }, pagato);
  c("testoConferma email_invia: dice a chi arriva (l'email dell'ordine)", true, !!tMail && tMail.testo.includes(pagato.email));
  c("testoConferma: le azioni senza conferma e le azioni di prima restano come prima", [null, true], [U.testoConferma({ azione: "spedisci", ordineId: ID, corriere: "BRT", numero: "123456" }, pagato), /Annullare l'ordine/.test(U.testoConferma({ azione: "stato", ordineId: ID, da: "nuovo", a: "annullato" }, vecchio())?.titolo ?? "")]);

  // ── le frasi dopo un'azione ──
  const ok = { ok: true, nessunCambio: false, ordine: pagato, storico: true };
  const frase = (a, r = ok) => U.esitoAzione(r, a, "HG-X").testo;
  c("esitoAzione: ogni azione nuova ha la sua frase, nessuna muta e nessuna generica", [], [
    { azione: "spedisci", ordineId: ID, corriere: "BRT", numero: "123456" }, { azione: "annulla", ordineId: ID, motivo: "x" }, { azione: "rimborso", ordineId: ID },
    { azione: "riconcilia", ordineId: ID }, { azione: "fattura_emessa", ordineId: ID }, { azione: "email_invia", ordineId: ID, chiave: "spedito" },
    { azione: "giacenza_verificata", ordineId: ID }, { azione: "correggi_stato", ordineId: ID, da: "spedito", a: "in_preparazione", motivo: "x" },
  ].filter((a) => frase(a) === "HG-X: Fatto." || frase(a).length < 16));
  c("esitoAzione: le frasi di prima restano", ["HG-X: Stato aggiornato.", "HG-X: Tracking salvato."], [frase({ azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" }), frase({ azione: "tracking", ordineId: ID, valore: "x" })]);
  c("esitoAzione: un conflitto dice di controllare e riprovare (anche per le azioni nuove)", true, /riprova/i.test(frase({ azione: "spedisci", ordineId: ID, corriere: "BRT", numero: "123456" }, { ok: false, errore: { tipo: "conflitto", messaggio: "x" } })));

  // ── lo storico ──
  const ev = (tipo, prima, dopo) => U.descriviEvento({ id: "e", tipo, prima, dopo, chi: "Prova", creatoIl: "2026-11-21T10:00:00.000Z" });
  c("descriviEvento: i tipi nuovi hanno un titolo in italiano (non «Modifica all'ordine»)", [], ["spedito", "annullato", "rimborso_richiesto", "riconciliato", "fattura_emessa", "email_inviata", "giacenza_verificata", "stato_corretto"].filter((t) => ev(t, {}, {}).titolo === "Modifica all'ordine"));
  c("descriviEvento: spedito mostra corriere e numero; annullato il motivo", [true, true], [
    /BRT/.test(ev("spedito", {}, { corriere: "BRT", tracking: "123456789" }).dettaglio) && /123456789/.test(ev("spedito", {}, { corriere: "BRT", tracking: "123456789" }).dettaglio),
    /ha cambiato idea/.test(ev("annullato", {}, { motivo: "Il cliente ha cambiato idea" }).dettaglio)]);
  c("descriviEvento: rimborso mostra la cifra in euro", true, /10,00/.test(ev("rimborso_richiesto", {}, { importo_cent: 1000, motivo: "Reso" }).dettaglio));
  c("descriviEvento: gli eventi di prima restano", ["Stato cambiato", "Tracking aggiornato"], [ev("stato", { stato: "nuovo" }, { stato: "spedito" }).titolo, ev("tracking", {}, { tracking: "X1" }).titolo]);
}
