/** ── NEGOZIO · R2 · T54 · LE EMAIL DELLO SHOP: L'INVIO (SERVER) ──────────────────────────────────────────────
 *  `src/shop/email/invio.server.ts` (PIANO-R2 D53, T54; revisioni di T43 e T49):
 *   · `messaggioInviabile` viene SEMPRE prima di `componi`, anche con `manuale:true` («forzare» non invia un testo non approvato);
 *   · l'invio si prenota con `shop_email_prenota` (una sola volta; `in_invio` scade dopo 5 minuti), l'esito si scrive con `shop_email_esito`;
 *   · mittente «Hair Genius Labs» da `SHOP_EMAIL_INDIRIZZO` (porta `mittente()`), `reply_to` lo stesso, nessuna chiave né indirizzo nel codice;
 *   · mai un'eccezione verso chi chiama; nel log solo codici (mai l'email, il nome, il riferimento o la chiave del cliente);
 *   · nel corpo mai telefono né codice fiscale; l'indirizzo completo solo nella conferma (quello del CLIENTE); nessun indirizzo dello studio;
 *   · il link porta la chiave che la pagina ordine accetta (`chiaveOrdine` di T48); i modelli non si scrivono mai da qui.
 *  Resend è finto: nessuna email vera, nessuna rete, nessun database vero. Dati inventati (`@example.com`, `.example`). */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { partenzaDa, modelliEmailSeme } from "./_dati-r2.mjs";
import { uuid } from "./dati.mjs";

const SERVIZIO = "chiave-di-servizio-di-prova-non-vera";
const ID = uuid(0x6101);
const ALTRO_ID = uuid(0x6102);
const INIZIO = "2026-11-21T10:00:00.000Z";
const MITTENTE = "Hair Genius Labs <negozio@example.com>";
const TELEFONO = "+39 300 000 0001";
const CF = "RSSMRA80A01H501U";
const sha = (t) => createHash("sha256").update(t).digest("hex");

/** Un modello acceso e approvato (l'impronta è quella del testo di oggi). */
const modello = (chiave, oggetto, testo, extra = {}) => ({
  chiave, oggetto, testo, acceso: true, approvato_da: "Titolare Prova", approvato_il: INIZIO, approvato_hash: sha(`${oggetto}\n${testo}`), aggiornato_il: INIZIO, ...extra,
});
/** Un testo che usa TUTTE le variabili ammesse dalla chiave (più, dove c'è, telefono e CF che nessuna variabile porta). */
const TESTI = {
  conferma_ordine: ["Ordine {ref}", "Ciao {nome}, ordine {ref}, totale {totale}.\n{riepilogo_righe}\nSpedizione a:\n{indirizzo_spedizione}\nSegui: {link_ordine}"],
  spedito: ["Spedito {ref}", "Ciao {nome}, {corriere} {numero_tracking}\n{link_tracking}\n{link_ordine}"],
  pagamento_non_riuscito: ["Pagamento {ref}", "Ciao {nome}, riprova: {link_ordine}"],
  rimborso: ["Rimborso {ref}", "Ciao {nome}, rimborsati {importo_rimborso}. {link_ordine}"],
  annullato: ["Annullato {ref}", "Ciao {nome}, ordine {ref} annullato. {link_ordine}"],
};
const modelliApprovati = () => Object.entries(TESTI).map(([k, [o, t]]) => modello(k, o, t));

const ordine = (campi = {}) => ({
  id: ID, ref: "HG-T54ABC", totale_cent: 3850,
  righe: [{ sku: "PROVA-1", qty: 2, prezzo_cent: 1250 }, { sku: "PROVA-2", qty: 1, prezzo_cent: 1350 }],
  campi: {
    email: "cliente0@example.com", nome: "Anna", cognome: "Esempio", telefono: TELEFONO, indirizzo: "Via di Prova 1", citta: "Roma", cap: "00100", provincia: "RM", nazione: "IT",
    corriere: "Corriere Prova", tracking: "TRK-12345", tracking_url: "https://corriere.example/t/TRK-12345", stato_pagamento: "pagato",
    ...campi,
  },
});

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO R2 · EMAIL: L'INVIO (T54)");
  const I = mod["shop/email/invio.server"];
  c("il modulo src/shop/email/invio.server.ts esiste", true, !!I);
  if (!I) return;
  const K = mod["shop/cassa/chiave-ordine"];

  let ora = INIZIO;
  const adesso = () => ora;

  /** Il mondo: un ordine, i modelli, un finto Resend. */
  function mondo({ modelli = modelliApprovati(), ordini = [ordine()], extra = {}, dbOpz = {}, risposta = { ok: true, codice: "ok" }, porte = {}, rimborsi = [] } = {}) {
    ora = INIZIO;
    const t = partenzaDa({ ordini }, adesso);
    t.shop_email_modelli = structuredClone(modelli);
    t.shop_rimborsi = structuredClone(rimborsi);
    t.shop_storico = [];
    Object.assign(t, extra);
    const db = fintoDb({ tabelle: t, adesso, ...dbOpz });
    const resend = [];
    const idem = [];
    const log = [];
    const p = {
      db,
      resend: async (corpo, chiaveIdem) => {
        resend.push(corpo);
        idem.push(chiaveIdem);
        const r = typeof risposta === "function" ? risposta(corpo, resend.length) : risposta;
        if (r?.lancia) throw r.lancia;
        return r;
      },
      mittente: () => MITTENTE,
      chiaveServizio: SERVIZIO,
      sito: "https://shop.example",
      adesso: () => new Date(adesso()),
      log: (codice) => log.push(codice),
      ...porte,
    };
    return { db, p, resend, idem, log, riga: () => db.tabelle.shop_orders.find((o) => o.id === ID) };
  }
  const invia = (m, chiave = "conferma_ordine", opz = { manuale: false }, id = ID) => I.inviaEmail(m.p, chiave, id, opz);
  const scrittureDirette = (m) => m.db.registro.filter((q) => q.tab && q.op !== "select").map((q) => `${q.tab}.${q.op}`);
  const rpcDi = (m) => m.db.registro.filter((q) => q.op === "rpc").map((q) => q.nome);

  // ── spenta: nessuna chiamata a Resend, nessuna prenotazione ──
  const sp = mondo({ modelli: modelliApprovati().map((x) => ({ ...x, acceso: false })) });
  const rSp = await invia(sp);
  c("interruttore spento → stato «spenta», nessuna chiamata a Resend", ["spenta", 0], [rSp.stato, sp.resend.length]);
  c("…e nessuna prenotazione né scrittura (l'esito si scrive solo dopo una prenotazione vera)", [[], []], [rpcDi(sp), scrittureDirette(sp)]);
  c("…con `manuale:true` («invia ora») non cambia niente", ["spenta", 0], await invia(sp, "conferma_ordine", { manuale: true }).then((r) => [r.stato, sp.resend.length]));

  // ── il segnaposto e il testo non approvato: neanche forzando ──
  const base = modelliEmailSeme().map((x) => modello(x.chiave, x.oggetto, x.testo)); // `{{da confermare}}`, acceso, con approvazione valida sul testo
  const seg = mondo({ modelli: base });
  for (const manuale of [false, true]) {
    const r = await invia(seg, "conferma_ordine", { manuale });
    c(`acceso e approvato ma con {{da confermare}} → «segnaposto», nessun invio (manuale:${manuale})`, ["segnaposto", 0, []], [r.stato, seg.resend.length, rpcDi(seg)]);
  }
  const nonApp = mondo({ modelli: modelliApprovati().map((x) => ({ ...x, approvato_hash: null })) });
  const cambiato = mondo({ modelli: modelliApprovati().map((x) => ({ ...x, testo: `${x.testo} (cambiato dopo l'approvazione)` })) });
  for (const [nome, m] of [["mai approvato", nonApp], ["cambiato dopo l'approvazione", cambiato]]) {
    for (const manuale of [false, true]) {
      const r = await invia(m, "conferma_ordine", { manuale });
      c(`${nome} → «non_approvata», nessun invio (manuale:${manuale})`, ["non_approvata", 0], [r.stato, m.resend.length]);
    }
  }
  const sconosciuta = mondo({ modelli: [modello("conferma_ordine", "Ordine {ref}", "Ciao {nome} {cognome}")] });
  c("una graffa fuori elenco ({cognome}) → «variabile_sconosciuta», nessun invio, anche manuale", ["variabile_sconosciuta", 0], await invia(sconosciuta, "conferma_ordine", { manuale: true }).then((r) => [r.stato, sconosciuta.resend.length]));
  const vuoto = mondo({ modelli: [modello("conferma_ordine", "Ordine", "   ")] });
  c("testo vuoto → «vuota», nessun invio", ["vuota", 0], await invia(vuoto).then((r) => [r.stato, vuoto.resend.length]));

  // ── acceso e approvato: UNA chiamata ──
  const ok = mondo();
  const r1 = await invia(ok);
  const corpo = ok.resend[0] ?? {};
  c("acceso + approvato → UNA chiamata, stato «inviata»", ["inviata", 1], [r1.stato, ok.resend.length]);
  c("…mittente «Hair Genius Labs <indirizzo della porta>» e `reply_to` lo stesso", [MITTENTE, MITTENTE], [corpo.from, corpo.reply_to]);
  c("…destinatario: solo l'email dell'ordine; oggetto, testo e html composti (variabili sostituite)", [["cliente0@example.com"], "Ordine HG-T54ABC", true, true], [corpo.to, corpo.subject, /Ciao Anna, ordine HG-T54ABC/.test(corpo.text ?? ""), /^<!doctype html>/i.test(corpo.html ?? "")]);
  c("…l'esito è scritto dal database: `email_inviate.conferma_ordine.stato = inviata`, senza codice d'errore", ["inviata", null], [ok.riga().email_inviate?.conferma_ordine?.stato, ok.riga().email_inviate?.conferma_ordine?.codice]);
  c("…le sole chiamate: lettura, prenota, esito; NESSUNA scrittura diretta (né sull'ordine né sui modelli)", [["shop_email_prenota", "shop_email_esito"], []], [rpcDi(ok), scrittureDirette(ok)]);
  c("…e la tabella dei dati riservati (fattura, IP) non si legge nemmeno", false, ok.db.registro.some((q) => q.tab === "shop_ordini_riservati"));

  // ── la stessa conferma due volte: una sola chiamata ──
  const r2 = await invia(ok);
  c("la stessa conferma richiesta di nuovo → nessuna seconda chiamata, risposta «inviata» (già partita)", ["inviata", "gia_inviata", 1], [r2.stato, r2.codice, ok.resend.length]);
  const r3 = await invia(ok, "conferma_ordine", { manuale: true });
  c("…anche «invia ora»: una mail partita non si rimanda", ["inviata", 1], [r3.stato, ok.resend.length]);
  const dueInsieme = mondo();
  const [a, b] = await Promise.all([invia(dueInsieme), invia(dueInsieme)]);
  c("due richieste insieme (webhook ripetuto) → una sola chiamata a Resend; l'altra trova «in corso» o «già inviata»", [1, ["in_corso", "inviata"]], [dueInsieme.resend.length, [a.stato, b.stato].sort()]);

  // ── Resend risponde errore, o lancia ──
  const ko = mondo({ risposta: { ok: false, codice: "http_422" } });
  const rKo = await invia(ko);
  c("Resend risponde errore → stato «errore», nessuna eccezione, esito `errore` col codice", ["errore", "http_422", "errore", "http_422"], [rKo.stato, rKo.codice, ko.riga().email_inviate?.conferma_ordine?.stato, ko.riga().email_inviate?.conferma_ordine?.codice]);
  ko.p.resend = async (cp) => { ko.resend.push(cp); return { ok: true, codice: "ok" }; };
  const rRip = await invia(ko, "conferma_ordine", { manuale: true });
  c("…«invia ora» può riprovare: parte, e lo stato diventa «inviata»", ["inviata", 2, "inviata"], [rRip.stato, ko.resend.length, ko.riga().email_inviate?.conferma_ordine?.stato]);

  // ── Idempotency-Key: un retry identico non duplica, un testo cambiato riparte (rev. T54) ──
  const rete = mondo({ risposta: (_cp, n) => (n === 1 ? { ok: false, codice: "rete" } : { ok: true, codice: "ok" }) });
  const rr1 = await invia(rete);
  const rr2 = await invia(rete, "conferma_ordine", { manuale: true });
  c("dopo un errore di rete due invii consecutivi mandano la STESSA chiave di idempotenza", [["errore", "inviata"], true], [[rr1.stato, rr2.stato], rete.idem.length === 2 && rete.idem[0] === rete.idem[1]]);
  c("…la chiave è «shop-email:<ordine>:<messaggio>:<sha256>», al massimo 256 caratteri, senza dati del cliente", true, new RegExp(`^shop-email:${ID}:conferma_ordine:[0-9a-f]{64}$`).test(rete.idem[0] ?? "") && (rete.idem[0] ?? "").length <= 256 && !/cliente0|Anna|HG-T54ABC/.test(rete.idem[0] ?? ""));
  const ritesto = mondo({ risposta: (_cp, n) => (n === 1 ? { ok: false, codice: "rete" } : { ok: true, codice: "ok" }) });
  await invia(ritesto);
  const mm = ritesto.db.tabelle.shop_email_modelli.find((x) => x.chiave === "conferma_ordine");
  mm.testo = `${mm.testo}\nPS di prova`;
  mm.approvato_hash = sha(`${mm.oggetto}\n${mm.testo}`);
  await invia(ritesto, "conferma_ordine", { manuale: true });
  c("il titolare cambia il testo dopo l'errore → chiave DIVERSA (la mail riparte, niente 409 per 24 ore)", [2, true], [ritesto.idem.length, ritesto.idem[0] !== ritesto.idem[1]]);
  const altroDest = mondo({ risposta: (_cp, n) => (n === 1 ? { ok: false, codice: "rete" } : { ok: true, codice: "ok" }) });
  await invia(altroDest);
  altroDest.db.tabelle.shop_orders.find((o) => o.id === ID).email = "nuovo@example.com";
  await invia(altroDest, "conferma_ordine", { manuale: true });
  c("destinatario cambiato → chiave diversa; messaggio diverso (spedito) → chiave diversa", [true, true], [altroDest.idem[0] !== altroDest.idem[1], (await (async () => { const m = mondo(); await invia(m, "spedito"); await invia(m, "conferma_ordine"); return m.idem[0] !== m.idem[1]; })())]);
  const concorrente = mondo({ risposta: { ok: false, codice: "concurrent_idempotent_requests" } });
  const rc = await invia(concorrente);
  c("Resend dice «concurrent_idempotent_requests» (la prima è ancora in corso) → «in_corso», NON errore, esito non scritto", ["in_corso", "in_invio"], [rc.stato, concorrente.riga().email_inviate?.conferma_ordine?.stato]);
  for (const codice of ["http_409", "http_400"]) {
    const m = mondo({ risposta: { ok: false, codice } });
    c(`Resend risponde ${codice} (chiave con corpo diverso, richiesta non valida) → «errore» col codice, esito scritto`, ["errore", codice, "errore"], await invia(m).then((r) => [r.stato, r.codice, m.riga().email_inviate?.conferma_ordine?.stato]));
  }
  const lancia = mondo({ risposta: { lancia: new Error("PROVA cliente0@example.com Anna Esempio") } });
  const rL = await invia(lancia);
  c("Resend che LANCIA un'eccezione → «errore», nessuna eccezione verso chi chiama, esito scritto", ["errore", "errore"], [rL.stato, lancia.riga().email_inviate?.conferma_ordine?.stato]);
  c("…il codice dell'esito non porta il testo dell'eccezione (solo un codice)", true, /^[A-Za-z0-9_]{1,40}$/.test(lancia.riga().email_inviate?.conferma_ordine?.codice ?? ""));
  const sporco = mondo({ risposta: { ok: false, codice: "PROVA cliente0@example.com & altro\nrigaDue" } });
  await invia(sporco);
  c("un codice di Resend con spazi, email o a capo viene ripulito prima di scriverlo", true, /^[A-Za-z0-9_]{1,40}$/.test(sporco.riga().email_inviate?.conferma_ordine?.codice ?? ""));
  const senzaEsito = mondo({ dbOpz: { errori: { "rpc.shop_email_esito": { error: { code: "57P01", message: "PROVA cliente0@example.com" } } } } });
  const rSE = await invia(senzaEsito);
  c("se l'esito non si riesce a scrivere la mail è comunque partita: si dice «inviata», si logga il codice", ["inviata", 1, true], [rSE.stato, senzaEsito.resend.length, senzaEsito.log.some((l) => /esito/.test(l))]);

  // ── mittente, chiave di servizio, destinatario ──
  const sm = mondo({ porte: { mittente: () => null } });
  const rSm = await invia(sm);
  c("mittente non configurato → «non_configurata», nessuna chiamata, nessuna prenotazione", ["non_configurata", 0, []], [rSm.stato, sm.resend.length, rpcDi(sm)]);
  const sk = mondo({ porte: { chiaveServizio: undefined } });
  c("senza chiave di servizio il link non si può fare → «non_configurata», nessuna prenotazione", ["non_configurata", 0, []], await invia(sk).then((r) => [r.stato, sk.resend.length, rpcDi(sk)]));
  for (const [nome, email] of [["assente", null], ["vuoto", "  "], ["senza chiocciola", "cliente0.example.com"], ["con a capo", "a@example.com\nBcc: x@example.com"], ["due indirizzi", "a@example.com, b@example.com"]]) {
    const m = mondo({ ordini: [ordine({ email })] });
    c(`destinatario ${nome} → «senza_email», nessuna chiamata, nessuna prenotazione`, ["senza_email", 0, []], await invia(m).then((r) => [r.stato, m.resend.length, rpcDi(m)]));
  }

  // ── la prenotazione scade dopo 5 minuti ──
  const vecchia = mondo();
  await vecchia.db.rpc("shop_email_prenota", { p_ordine: ID, p_chiave: "conferma_ordine" }); // un altro processo ha prenotato e non ha finito
  ora = "2026-11-21T10:02:00.000Z";
  const r2m = await invia(vecchia);
  c("un invio rimasto «in_invio» da 2 minuti → non si ripete: «in_corso», nessuna chiamata", ["in_corso", 0], [r2m.stato, vecchia.resend.length]);
  ora = "2026-11-21T10:06:00.000Z";
  const r6m = await invia(vecchia);
  c("…da 6 minuti → si riprenota e parte", ["inviata", 1], [r6m.stato, vecchia.resend.length]);

  // ── la migrazione S6 non c'è ──
  const sen = mondo({ dbOpz: { mancante: ["shop_email_modelli"] } });
  const rSen = await invia(sen);
  c("S6 assente (tabella dei modelli mancante) → «migrazione», nessun invio, nessuna eccezione", ["migrazione", 0], [rSen.stato, sen.resend.length]);
  const senzaColonna = mondo({ dbOpz: { senzaColonne: { shop_orders: ["email_inviate", "stato_pagamento", "provincia"] } } });
  c("S4 assente (colonne dell'ordine mancanti) → «migrazione»", ["migrazione", 0], await invia(senzaColonna).then((r) => [r.stato, senzaColonna.resend.length]));
  const senzaRiga = mondo({ modelli: [] });
  c("la riga del modello non c'è (seme mancante) → «migrazione», nessun invio", ["migrazione", 0], await invia(senzaRiga).then((r) => [r.stato, senzaRiga.resend.length]));

  // ── mai un'eccezione ──
  const guasti = [
    ["lettura del modello", { "shop_email_modelli.select": { lancia: new Error("PROVA cliente0@example.com") } }],
    ["lettura dell'ordine", { "shop_orders.select": { lancia: new Error("PROVA cliente0@example.com") } }],
    ["prenotazione", { "rpc.shop_email_prenota": { lancia: new Error("PROVA cliente0@example.com") } }],
    ["esito", { "rpc.shop_email_esito": { lancia: new Error("PROVA cliente0@example.com") } }],
  ];
  for (const [dove, errori] of guasti) {
    const m = mondo({ dbOpz: { errori } });
    let esito, lanciato = false;
    try { esito = await invia(m); } catch { lanciato = true; }
    c(`il database lancia (${dove}) → nessuna eccezione verso chi chiama, uno stato`, [false, true], [lanciato, typeof esito?.stato === "string"]);
  }
  const erroreDb = mondo({ dbOpz: { errori: { "shop_orders.select": { error: { code: "57P01", message: "PROVA cliente0@example.com Anna" } } } } });
  const rE = await invia(erroreDb);
  c("errore del database sulla lettura dell'ordine → «errore», nessuna chiamata a Resend", ["errore", 0], [rE.stato, erroreDb.resend.length]);
  const noOrd = mondo();
  c("ordine che non c'è → «errore» (ordine_non_trovato), nessuna chiamata", ["errore", "ordine_non_trovato", 0], await invia(noOrd, "conferma_ordine", { manuale: false }, ALTRO_ID).then((r) => [r.stato, r.codice, noOrd.resend.length]));
  const chiaveBrutta = mondo();
  c("chiave del messaggio sconosciuta o id strano → «errore», zero chiamate al database", ["errore", "errore", 0], [
    (await I.inviaEmail(chiaveBrutta.p, "newsletter", ID, { manuale: false })).stato, (await I.inviaEmail(chiaveBrutta.p, "conferma_ordine", "' or 1=1 --", { manuale: false })).stato, chiaveBrutta.db.chiamate]);
  c("argomenti storti (null, numeri, niente opzioni) → uno stato, mai un'eccezione", [true, true, true], await Promise.all([
    I.inviaEmail(chiaveBrutta.p, null, null, null), I.inviaEmail(chiaveBrutta.p, 5, {}, undefined), I.inviaEmail(null, "conferma_ordine", ID, { manuale: true }),
  ].map((p) => p.then((r) => typeof r.stato === "string", () => false))));

  // ── il corpo: nessun telefono, nessun CF; l'indirizzo solo nella conferma ──
  const tutti = mondo({ extra: { shop_ordini_riservati: [{ ordine_id: ID, fattura: { cf: CF, piva: "01234567890" }, attribuzione: null, consensi: {}, ip: "203.0.113.9", user_agent: "prova" }] }, rimborsi: [{ id: "rim-1", ordine_id: ID, importo_cent: 1000, motivo: "prova", stato: "riuscito", origine: "crm", creato_il: INIZIO, aggiornato_il: INIZIO }] });
  const uscite = {};
  for (const k of Object.keys(TESTI)) {
    const q = { ...tutti.p, resend: async (cp) => { uscite[k] = cp; return { ok: true, codice: "ok" }; } };
    const r = await I.inviaEmail(q, k, ID, { manuale: false });
    c(`${k}: parte (acceso e approvato)`, "inviata", r.stato);
  }
  const intero = (cp) => `${cp.subject}\n${cp.text}\n${cp.html}`;
  c("in NESSUN modello compare il telefono né il codice fiscale né la P.IVA (nemmeno nelle cifre senza spazi)", [], Object.entries(uscite).filter(([, cp]) => new RegExp(`${TELEFONO.replace("+", "\\+")}|3000000001|${CF}|01234567890|203\\.0\\.113`).test(intero(cp))).map(([k]) => k));
  c("l'indirizzo completo del cliente c'è SOLO nella conferma", [true, false, false, false, false], Object.keys(TESTI).map((k) => /Via di Prova 1/.test(uscite[k].text) && /Via di Prova 1/.test(uscite[k].html) && /00100 Roma \(RM\)/.test(uscite[k].text)));
  c("la conferma: indirizzo su righe (nome, via, CAP città (provincia), paese), come lo ha scritto il cliente", true, uscite.conferma_ordine.text.includes("Anna Esempio\nVia di Prova 1\n00100 Roma (RM)\nItalia"));
  c("la conferma porta riepilogo righe e totale: «2 × Prodotto PROVA-1», totale in euro con la virgola", [true, true], [/2 × Prodotto PROVA-1/.test(uscite.conferma_ordine.text), /€ 38,50|38,50 €/.test(uscite.conferma_ordine.text)]);
  c("i prezzi stanno SOLO nella conferma e nel rimborso (l'importo rimborsato): spedito, non riuscito, annullato senza «€»", [false, false, false], ["spedito", "pagamento_non_riuscito", "annullato"].map((k) => /€|\beuro\b/i.test(intero(uscite[k]))));
  c("rimborso: l'importo è quello dell'ultimo rimborso riuscito dell'ordine (10,00 €)", true, /€ 10,00|10,00 €/.test(uscite.rimborso.text));
  c("spedito: corriere, numero di tracking e link di tracciamento dell'ordine", [true, true, true], [/Corriere Prova/.test(uscite.spedito.text), /TRK-12345/.test(uscite.spedito.text), /href="https:\/\/corriere\.example\/t\/TRK-12345"/.test(uscite.spedito.html)]);
  const senzaRimborso = mondo();
  const uR = [];
  await I.inviaEmail({ ...senzaRimborso.p, resend: async (cp) => (uR.push(cp), { ok: true, codice: "ok" }) }, "rimborso", ID, { manuale: false });
  c("rimborso senza nessun rimborso riuscito: l'importo resta vuoto (mai una cifra inventata)", [true], [/rimborsati \./.test(uR[0]?.text ?? "")]);
  c("nell'ordine di prova l'ultimo rimborso conta: con due rimborsi riusciti vale il più recente", true, await (async () => {
    const m = mondo({ rimborsi: [
      { id: "r1", ordine_id: ID, importo_cent: 500, motivo: "a", stato: "riuscito", origine: "crm", creato_il: "2026-11-21T09:00:00.000Z", aggiornato_il: "2026-11-21T09:00:00.000Z" },
      { id: "r2", ordine_id: ID, importo_cent: 700, motivo: "b", stato: "riuscito", origine: "crm", creato_il: "2026-11-21T09:30:00.000Z", aggiornato_il: "2026-11-21T09:30:00.000Z" },
      { id: "r3", ordine_id: ID, importo_cent: 900, motivo: "c", stato: "fallito", origine: "crm", creato_il: "2026-11-21T09:45:00.000Z", aggiornato_il: "2026-11-21T09:45:00.000Z" }] });
    const u = [];
    await I.inviaEmail({ ...m.p, resend: async (cp) => (u.push(cp), { ok: true, codice: "ok" }) }, "rimborso", ID, { manuale: false });
    return /€ 7,00|7,00 €/.test(u[0]?.text ?? "") && !/9,00/.test(u[0]?.text ?? "");
  })());

  // ── il link porta la chiave che la pagina ordine accetta (prova incrociata con chiave-ordine.mjs) ──
  const link = (uscite.conferma_ordine.text.match(/Segui: (https:\/\/\S+)/) ?? [])[1] ?? "";
  const url = (() => { try { return new URL(link); } catch { return null; } })();
  const chiave = url?.searchParams.get("t") ?? "";
  c("il link è «sito/shop/ordine/<ref>?t=<chiave>», solo https", ["https://shop.example", "/shop/ordine/HG-T54ABC"], [url?.origin, url?.pathname]);
  const impronta = await K.impronta(await K.chiaveOrdine(SERVIZIO, ID));
  c("la chiave nel link è quella che la pagina ordine accetta: `verificaChiave` contro l'impronta salvata", [true, false, false], [await K.verificaChiave(chiave, impronta), await K.verificaChiave(chiave, await K.impronta(await K.chiaveOrdine(SERVIZIO, ALTRO_ID))), await K.verificaChiave(chiave, null)]);
  c("la chiave nel link è proprio `chiaveOrdine(chiaveServizio, id dell'ordine)` (ricalcolata, non salvata)", await K.chiaveOrdine(SERVIZIO, ID), chiave);
  c("con un'altra chiave di servizio il link cambia (la chiave di servizio non compare mai nel messaggio)", [false, false], [intero(uscite.conferma_ordine).includes(SERVIZIO), chiave === (await K.chiaveOrdine("altra-chiave-di-prova", ID))]);

  // ── i log: solo codici ──
  const sporcoLog = mondo({ dbOpz: { errori: { "rpc.shop_email_prenota": { error: { code: "57P01", message: "PROVA cliente0@example.com Anna HG-T54ABC" } } } } });
  await invia(sporcoLog);
  const lanciaLog = mondo({ risposta: { lancia: new Error("PROVA cliente0@example.com Anna Esempio HG-T54ABC") } });
  await invia(lanciaLog);
  const guastoOrdine = mondo({ dbOpz: { errori: { "shop_orders.select": { error: { code: "57P01", message: "PROVA cliente0@example.com" } } } } });
  await invia(guastoOrdine);
  const tuttiLog = [...sporcoLog.log, ...lanciaLog.log, ...guastoOrdine.log, ...ko.log, ...senzaEsito.log];
  c("i log ci sono (un guasto lascia un codice) e sono solo codici, mai l'email, il nome, il riferimento o la chiave", [true, []], [tuttiLog.length > 0, tuttiLog.filter((l) => !/^[a-z_]+( [A-Za-z0-9_]{1,30})?$/.test(l) || /example|Anna|Esempio|HG-|PROVA|@/.test(l))]);
  const tutteLeChiamate = JSON.stringify([...sporcoLog.log, ...lanciaLog.log]);
  c("…nemmeno il testo di un'eccezione o di un errore del database", false, /cliente0|Anna|T54ABC/.test(tutteLeChiamate));

  // ── PorteEmail: la porta unica per il webhook e per il CRM ──
  const pe = mondo();
  const porta = I.creaPorteEmail(pe.p);
  const rp = await porta.invia("conferma_ordine", ID, { manuale: false });
  c("`creaPorteEmail(porte).invia(chiave, ordine, {manuale})` fa lo stesso lavoro", ["inviata", 1], [rp.stato, pe.resend.length]);

  // ── Resend vero, ma con un fetch finto: forma della richiesta, nessuna chiave nei risultati ──
  const visto = [];
  const fetchOk = async (u, o) => (visto.push({ u, o }), { ok: true, status: 200, json: async () => ({ id: "re_prova" }) });
  const rv = I.resendConFetch("re_chiave_finta_di_prova_000000", fetchOk);
  const esitoOk = await rv({ from: MITTENTE, to: ["cliente0@example.com"], subject: "S", text: "T", html: "<p>H</p>", reply_to: MITTENTE });
  c("Resend: POST su api.resend.com/emails con la chiave in `Authorization` e il corpo in JSON", ["https://api.resend.com/emails", "POST", "Bearer re_chiave_finta_di_prova_000000", "application/json", MITTENTE], [visto[0]?.u, visto[0]?.o?.method, visto[0]?.o?.headers?.Authorization, visto[0]?.o?.headers?.["Content-Type"], JSON.parse(visto[0]?.o?.body ?? "{}").reply_to]);
  c("…con un tempo massimo (signal) e risposta `{ ok: true }`", [true, true], [!!visto[0]?.o?.signal, esitoOk.ok === true]);
  const nuovi = [
    ["stato 422", async () => ({ ok: false, status: 422, json: async () => ({ name: "validation_error", message: "PROVA cliente0@example.com" }) }), "http_422", false],
    ["stato 500 senza JSON", async () => ({ ok: false, status: 500, json: async () => { throw new Error("x"); } }), "http_500", false],
    ["rete che cade", async () => { throw new Error("PROVA re_chiave_finta_di_prova_000000 cliente0@example.com"); }, "rete", false],
  ];
  for (const [nome, f, codice, okAtteso] of nuovi) {
    const e = await I.resendConFetch("re_chiave_finta_di_prova_000000", f)({ from: MITTENTE, to: ["a@example.com"], subject: "S", text: "T", html: "H", reply_to: MITTENTE });
    c(`Resend: ${nome} → \`{ ok:false, codice:"${codice}" }\`, senza testi né chiave nel risultato`, [okAtteso, codice, false], [e.ok, e.codice, /cliente0|re_chiave/.test(JSON.stringify(e))]);
  }
  const idemVisti = [];
  const fetchIdem = async (u, o) => (idemVisti.push(o), { ok: true, status: 200 });
  await I.resendConFetch("re_chiave_finta_di_prova_000000", fetchIdem)({ from: MITTENTE, to: ["a@example.com"], subject: "S", text: "T", html: "H", reply_to: MITTENTE }, "shop-email:x:y:z");
  await I.resendConFetch("re_chiave_finta_di_prova_000000", fetchIdem)({ from: MITTENTE, to: ["a@example.com"], subject: "S", text: "T", html: "H", reply_to: MITTENTE });
  c("Resend: la chiave di idempotenza va nell'intestazione `Idempotency-Key`, mai nel corpo JSON; senza chiave niente intestazione", ["shop-email:x:y:z", false, undefined], [idemVisti[0]?.headers?.["Idempotency-Key"], /shop-email/.test(idemVisti[0]?.body ?? ""), idemVisti[1]?.headers?.["Idempotency-Key"]]);
  const r409 = (nome) => async () => ({ ok: false, status: 409, json: async () => ({ name: nome, message: "PROVA cliente0@example.com" }) });
  const e1 = await I.resendConFetch("re_chiave_finta_di_prova_000000", r409("concurrent_idempotent_requests"))({ from: MITTENTE, to: ["a@example.com"], subject: "S", text: "T", html: "H", reply_to: MITTENTE }, "k");
  const e2 = await I.resendConFetch("re_chiave_finta_di_prova_000000", r409("invalid_idempotent_request"))({ from: MITTENTE, to: ["a@example.com"], subject: "S", text: "T", html: "H", reply_to: MITTENTE }, "k");
  const e3 = await I.resendConFetch("re_chiave_finta_di_prova_000000", async () => ({ ok: false, status: 409, json: async () => { throw new Error("x"); } }))({ from: MITTENTE, to: ["a@example.com"], subject: "S", text: "T", html: "H", reply_to: MITTENTE }, "k");
  c("Resend: 409 concurrent → codice «concurrent_idempotent_requests»; 409 invalid o senza JSON → «http_409»; mai testi nel risultato", [[false, "concurrent_idempotent_requests"], [false, "http_409"], [false, "http_409"], false], [[e1.ok, e1.codice], [e2.ok, e2.codice], [e3.ok, e3.codice], /cliente0|PROVA/.test(JSON.stringify([e1, e2, e3]))]);
  const senzaChiave = await I.resendConFetch("", async () => { throw new Error("non si deve chiamare"); })({ from: MITTENTE, to: ["a@example.com"], subject: "S", text: "T", html: "H", reply_to: MITTENTE });
  c("Resend: chiave assente → `{ ok:false, codice:\"non_configurata\" }`, nessuna chiamata di rete", [false, "non_configurata"], [senzaChiave.ok, senzaChiave.codice]);

  // ── ordine annullato: la conferma non parte mai, né da sola né a mano (decisione del capo progetto, rifinitura R3c) ──
  const annullato = (campi = {}) => ordine({ status: "annullato", ...campi });
  for (const [nome, ordini] of [["annullato", [annullato()]], ["annullato ma già pagato (pagato_dopo_annullo)", [annullato({ stato_pagamento: "pagato", pagato_il: INIZIO })]]]) {
    for (const manuale of [false, true]) {
      const m = mondo({ ordini });
      const r = await invia(m, "conferma_ordine", { manuale });
      c(`ordine ${nome}: la conferma è «saltata» con il motivo «ordine_annullato» (manuale:${manuale})`, ["saltata", "ordine_annullato"], [r.stato, r.codice]);
      c(`…nessuna chiamata a Resend, nessuna prenotazione, nessuna scrittura (manuale:${manuale})`, [0, [], []], [m.resend.length, rpcDi(m), scrittureDirette(m)]);
      c(`…e l'ordine non porta traccia dell'email (manuale:${manuale})`, {}, m.riga().email_inviate ?? {});
    }
  }
  for (const chiave of ["annullato", "spedito", "rimborso", "pagamento_non_riuscito"]) {
    const m = mondo({ ordini: [annullato()] });
    const r = await invia(m, chiave, { manuale: false });
    c(`ordine annullato: l'email «${chiave}» resta com'è, parte`, ["inviata", 1], [r.stato, m.resend.length]);
  }
  for (const status of ["nuovo", "in_preparazione", "spedito", "consegnato"]) {
    const m = mondo({ ordini: [ordine({ status })] });
    c(`ordine «${status}»: la conferma parte come prima`, ["inviata", 1], await invia(m).then((r) => [r.stato, m.resend.length]));
  }
  const annMan = mondo({ ordini: [annullato()] });
  const porteAnn = I.creaPorteEmail(annMan.p);
  const RS = mod["ecommerce/rimborsi.server"];
  c("il modulo src/crm/ecommerce/rimborsi.server.ts esiste (per le prove dell'invio dal CRM)", true, !!RS);
  if (RS) {
    const log = [];
    const pe = { db: annMan.db, email: porteAnn, adesso: () => new Date(INIZIO), log: (x) => log.push(x) };
    const auto = await RS.inviaAutomatica(pe, "conferma_ordine", ID);
    c("invio automatico dal CRM su ordine annullato: stato «saltata», mai un errore, nessun invio", ["saltata", 0], [auto.stato, annMan.resend.length]);
    const mano = await RS.eseguiEffetto(pe, { tipo: "email", chiave: "conferma_ordine", manuale: true }, { id: ID }, "titolare");
    c("«Invia ora» dal CRM su ordine annullato: esito «non_riuscito» con una frase e una risposta 4xx, NON un 500; nessun invio", ["non_riuscito", true, true, 0], [mano.esito, typeof mano.frase === "string" && mano.frase.length > 0, mano.http >= 400 && mano.http < 500, annMan.resend.length]);
    c("…nessun errore nel log (non è un guasto)", [], log);
  }

  // ── i sorgenti ──
  const sorgente = readFileSync(join(radice, "src/shop/email/invio.server.ts"), "utf8");
  const senzaCommenti = sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  c("nessuna chiave né indirizzo nel codice (Resend, Stripe, Supabase), nessun indirizzo dello studio", [], [/\b(?:(?:sk|rk)_(?:test|live)|whsec|re)_[A-Za-z0-9]{16,}/, /eyJ[A-Za-z0-9_-]{20,}/, /Scipioni/i, /[A-Za-z0-9._-]+@[A-Za-z0-9-]+\.(?:it|com|org|net|eu)\b/].filter((re) => re.test(senzaCommenti)).map(String));
  c("nessun `process.env`, nessun `console.*`, nessun import da `@supabase` o dal client di servizio", [], [/process\.env|import\.meta\.env/, /console\./, /@supabase|supabaseAdmin|integrations/].filter((re) => re.test(senzaCommenti)).map(String));
  c("`messaggioInviabile` compare PRIMA di `componi` nel sorgente (e `componi` non è mai chiamato senza)", true, senzaCommenti.indexOf("messaggioInviabile(") > 0 && senzaCommenti.indexOf("messaggioInviabile(") < senzaCommenti.indexOf("componi("));
  c("l'ordine delle chiamate dentro `inviaEmail`: modello → inviabile → componi → prenota → invio → esito", true, (() => {
    const corpoFn = senzaCommenti.slice(senzaCommenti.indexOf("export async function inviaEmail"));
    const pos = ["shop_email_modelli", "messaggioInviabile(", "componi(", "shop_email_prenota", "p.resend(", "scriviEsito("].map((x) => corpoFn.indexOf(x));
    return pos.every((x) => x > 0) && pos.every((x, i) => i === 0 || x > pos[i - 1]);
  })());
  c("dell'ordine non si leggono mai telefono, codice fiscale, P.IVA, IP (nemmeno come colonna)", [], ok.db.registro.filter((q) => q.tab === "shop_orders").flatMap((q) => String(q.cols).split(",").map((x) => x.trim())).filter((x) => /telefono|cf|piva|fattura|ip|user_agent|note/i.test(x)));
  c("nessuna scrittura diretta nel sorgente (`.insert(`, `.update(`, `.upsert(`, `.delete(`): solo `rpc`", [], [/\.insert\(|\.update\(|\.upsert\(|\.delete\(/].filter((re) => re.test(senzaCommenti)).map(String));
  c("`RESEND_FROM` non si usa (resta per gli hook)", false, /RESEND_FROM/.test(senzaCommenti));
}
