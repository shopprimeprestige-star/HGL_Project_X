/** ── NEGOZIO · RILASCIO 2 · T53 · LA ROTTA DEGLI ORDINI: LETTURE E AZIONI NUOVE ─────────────────────────────────────────
 *  `src/crm/ecommerce/ordini.server.ts` (PIANO-R2 §3.4, D55) con le porte nuove: `stripe` (il client di T44) ed `email` (T54).
 *   · guardia negata = zero chiamate (database, Stripe, email) e zero log, anche per le letture e le azioni nuove;
 *   · la LISTA non porta mai dati fiscali né identificativi (prova ricorsiva, sulle chiavi e sui valori); il DETTAGLIO sì, ma non l'attribuzione;
 *   · `?conta=1` conta come `contaComeLavoro` (in attesa e prova fuori) con UNA richiesta; con S4 assente conta come oggi;
 *   · il contesto che la rotta passa a `costruisciAzione` è SEMPRE un oggetto: `rimborsi` illeggibili = `undefined` (mai `[]`), `effettiGestiti` = solo ciò che
 *     la rotta esegue davvero con le porte che ha; la riattivazione `annullato → nuovo` ricontrolla i rimborsi nel database DOPO la scrittura;
 *   · le azioni vecchie e le letture vecchie non cambiano (la prova di oggi, `prove/ecommerce/server.mjs`, resta com'è);
 *   · nessun dato del cliente nei log (solo codici), mai `delete`, lo storico lo scrive il server con `chi`.
 *  I rimborsi e Stripe stanno in `rimborsi-server.mjs`. Dati inventati. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rigaOrdineProva } from "../ecommerce/dati.mjs";
import { fintoDb, COLONNE_S4 } from "./_finto-db.mjs";
import { ordiniR1R2, conDefaultS4 } from "./_dati-r2.mjs";
import { guardiaNo, ADESSO } from "./_server.mjs";
import { stripeFinto, CHIAVE_PROVA } from "./_stripe-finto.mjs";

const uuid = (n) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
/** Una riga di `shop_orders` DOPO S4 (colonne nuove ai default), di un ordine di prima. */
const vecchio = (n, extra = {}) => ({
  ...structuredClone(COLONNE_S4),
  ...rigaOrdineProva({ id: uuid(n), order_ref: `HG-P${n}`, created_at: new Date(Date.UTC(2026, 10, 20, 9, 0, 0) - n * 60_000).toISOString() }),
  lead_id: null, senza_lead: false, pagato_il: null, pagato_importo: null, metodo_pagamento: null, tracking: null, note_interne: null, aggiornato_il: null,
  ...extra,
});
/** Un ordine della cassa nuova, pagato con Stripe. */
const pagato = (n, extra = {}) =>
  vecchio(n, {
    canale: "sito", stato_pagamento: "pagato", totale_cent: 2490, pagato_il: "2026-11-20T10:00:00.000Z", pagato_importo: 24.9, metodo_pagamento: "stripe",
    stripe_sessione_id: "cs_test_a", stripe_pagamento_id: "pi_test_a", ...extra,
  });
const CORRIERI = [{ nome: "BRT", modello: "https://tracking.example.com/brt/{numero}" }, { nome: "GLS", modello: "" }];
const impostazioni = () => [{ chiave: "corrieri", valore: CORRIERI, aggiornato_il: "2026-11-20T10:00:00.000Z" }];
/** I dati riservati di un ordine: tutto inventato, riconoscibile. */
const RISERVATI = {
  fattura: { tipo: "azienda", denominazione: "Ditta Finta Srl", cf: "ZZZZZZ00A00Z000Z", piva: "98765432109", sdi: "ZZZZZZZ", pec: "ditta@pec.example.com" },
  attribuzione: { fbp: "fb.1.0000000000.1111111111", fbc: "fb.1.0000000000.AbCdEf", utm_source: "prova" },
  consensi: { termini: true, privacy: true, versione: "v1" },
  ip: "203.0.113.77",
  user_agent: "Browser di prova 1.0",
};
const riservatiDi = (n) => ({ ordine_id: uuid(n), ...structuredClone(RISERVATI) });
const SEGNI_RISERVATI = ["ZZZZZZ00A00Z000Z", "98765432109", "ZZZZZZZ", "ditta@pec.example.com", "Ditta Finta Srl", "fb.1.0000000000", "203.0.113.77", "Browser di prova"];
const CHIAVI_VIETATE = ["fattura", "cf", "piva", "sdi", "pec", "fbp", "fbc", "ip", "user_agent", "attribuzione", "consensi", "riservati", "denominazione"];

/** Tutte le chiavi (a ogni profondità) di un valore JSON. */
function chiaviDi(v, fuori = new Set()) {
  if (Array.isArray(v)) v.forEach((x) => chiaviDi(x, fuori));
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { fuori.add(k); chiaviDi(x, fuori); }
  return fuori;
}

export async function prove(mod, { c, gruppo, radice }) {
  const S = mod["ecommerce/ordini.server"];
  const K = mod["shop/stripe/client"];
  const O = mod["ecommerce/ordine"];
  const P = mod["ecommerce/pagamento"];
  const ID = uuid(1);
  const richiesta = (url, corpo) =>
    new Request(`https://crm.example.com/api/crm/ordini${url}`, corpo === undefined ? { method: "GET" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  /** Le porte: guardia, orologio, log; `stripe` ed `email` solo se si chiedono (senza, la rotta non ha quelle porte). */
  function porte(db, { guardia, stripe = false, email = false, adesso = ADESSO, nome = "Giulia Esempio" } = {}) {
    const log = [];
    const chiamateEmail = [];
    const mondoStripe = stripe ? stripeFinto() : null;
    const d = {
      guardia: guardia ?? (async () => ({ ok: true, nome })),
      db,
      adesso: () => new Date(adesso),
      log: (x) => log.push(x),
      ...(stripe ? { stripe: K.creaClientStripe({ chiave: CHIAVE_PROVA, fetch: mondoStripe.fetch, timeoutMs: 50 }) } : {}),
      ...(email
        ? { email: { invia: async (chiave, ordineId, opzioni) => { chiamateEmail.push([chiave, ordineId, opzioni]); return typeof email === "function" ? email(chiave) : { stato: "inviata" }; } } }
        : {}),
    };
    return { d, log, mondoStripe, chiamateEmail };
  }
  const leggi = async (r) => ({ stato: r.status, json: await r.json() });
  const GET = async (db, url, opz) => { const x = porte(db, opz); return { ...(await leggi(await S.gestisciGET(richiesta(url), x.d))), ...x }; };
  const POST = async (db, corpo, opz) => { const x = porte(db, opz); return { ...(await leggi(await S.gestisciPOST(richiesta("", corpo), x.d))), ...x }; };
  const tab = (db, t) => db.tabelle[t] ?? [];
  const riga = (db, id = ID) => tab(db, "shop_orders").find((r) => r.id === id);
  const src = (p) => { try { return readFileSync(join(radice, p), "utf8"); } catch { return ""; } }; // un file che non c'è è «vuoto»: la prova che lo cerca diventa rossa, non si ferma

  gruppo("NEGOZIO R2 · ROTTA ORDINI: LETTURE E AZIONI NUOVE (T53)");

  // ── la guardia viene prima di tutto: zero chiamate e zero log, anche per le cose nuove ──
  {
    const casi = [
      ["GET dettaglio", (x) => S.gestisciGET(richiesta(`?dettaglio=${ID}`), x.d)],
      ["GET conta", (x) => S.gestisciGET(richiesta("?conta=1"), x.d)],
      ...[
        { azione: "rimborso", ordineId: ID, importoCent: 1000, motivo: "Prodotto rovinato", chiaveRichiesta: uuid(0xc1), conferma: true },
        { azione: "annulla", ordineId: ID, motivo: "Su richiesta", rimborso: "ora", rimettiInMagazzino: true, chiaveRichiesta: uuid(0xc2) },
        { azione: "spedisci", ordineId: ID, corriere: "BRT", numero: "ABC12345" },
        { azione: "riconcilia", ordineId: ID },
        { azione: "email_invia", ordineId: ID, chiave: "conferma_ordine" },
        { azione: "correggi_stato", ordineId: ID, da: "in_preparazione", a: "nuovo", motivo: "Errore" },
        { azione: "fattura_emessa", ordineId: ID, nota: "n. 1" },
        { azione: "giacenza_verificata", ordineId: ID },
      ].map((corpo) => [`POST ${corpo.azione}`, (x) => S.gestisciPOST(richiesta("", corpo), x.d)]),
    ];
    const esiti = [];
    for (const stato of [401, 403]) {
      for (const [nome, vai] of casi) {
        const db = fintoDb({ tabelle: { shop_orders: [pagato(1)] } });
        const x = porte(db, { guardia: guardiaNo(stato), stripe: true, email: true });
        const r = await vai(x);
        esiti.push([nome, stato, r.status, db.chiamate, x.mondoStripe.chiamate.length, x.chiamateEmail.length, x.log.length]);
      }
    }
    c("guardia negata (401/403): lettura, azioni nuove → risposta tale e quale, zero chiamate a database, Stripe, email, zero log", [], esiti.filter(([, st, rs, db, s, e, l]) => rs !== st || db || s || e || l));
  }

  // ── la LISTA non porta mai dati fiscali né identificativi (prova ricorsiva) ──
  {
    const db = fintoDb({ tabelle: { shop_orders: [pagato(1, { fattura_richiesta: true }), vecchio(2)], shop_ordini_riservati: [riservatiDi(1)], shop_order_eventi: [] } });
    for (const [nome, url] of [["elenco", ""], ["per scheda", `?lead=${uuid(0xa1)}`]]) {
      const r = await GET(db, url);
      const testo = JSON.stringify(r.json);
      c(`lista (${nome}): nessuna chiave fiscale o di attribuzione, a nessuna profondità`, [], [...chiaviDi(r.json)].filter((k) => CHIAVI_VIETATE.includes(k.toLowerCase())));
      c(`lista (${nome}): nessun valore riservato nel testo della risposta`, [], SEGNI_RISERVATI.filter((s) => testo.includes(s)));
    }
    const lista = await GET(db, "");
    c("lista: gli ordini ci sono (200, due ordini) e la tabella dei riservati non viene nemmeno letta", [200, 2, false], [lista.stato, lista.json.ordini.length, db.registro.some((q) => q.tab === "shop_ordini_riservati")]);
  }

  // ── il DETTAGLIO porta fattura e consensi, rimborsi, email, storico, avvisi; mai attribuzione, IP, browser ──
  {
    const ordine = pagato(1, {
      fattura_richiesta: true, stato_pagamento: "rimborsato_in_parte", rimborsato_cent: 1000,
      email_inviate: { conferma_ordine: { stato: "inviata", il: "2026-11-20T10:01:00.000Z", codice: null }, spedito: { stato: "errore", il: "2026-11-20T11:00:00.000Z", codice: "resend_422" } },
      avvisi: [{ codice: "pagato_dopo_scadenza", gravita: "arancio", rif: "cs_test_a", il: "2026-11-20T10:00:00.000Z" }],
    });
    const tabelle = {
      shop_orders: [ordine, vecchio(2)],
      shop_ordini_riservati: [riservatiDi(1), riservatiDi(2)],
      shop_rimborsi: [
        { id: uuid(0xb1), ordine_id: uuid(1), importo_cent: 1000, motivo: "Taglia sbagliata", stato: "riuscito", stripe_rimborso_id: "re_test_a", chiave_richiesta: uuid(0xc1), origine: "crm", chi: "Giulia Esempio", creato_il: "2026-11-20T10:30:00.000Z", aggiornato_il: "2026-11-20T10:31:00.000Z" },
        { id: uuid(0xb2), ordine_id: uuid(2), importo_cent: 50, motivo: "Di un altro ordine", stato: "riuscito", stripe_rimborso_id: null, chiave_richiesta: null, origine: "crm", chi: "x", creato_il: "2026-11-20T10:30:00.000Z", aggiornato_il: "2026-11-20T10:31:00.000Z" },
      ],
      shop_order_eventi: [
        { id: "e1", order_id: uuid(1), order_ref: "HG-P1", tipo: "pagato", chi: "stripe", prima: {}, dopo: {}, created_at: "2026-11-20T10:00:00.000Z" },
        { id: "e2", order_id: uuid(2), order_ref: "HG-P2", tipo: "stato", chi: "Altro", prima: {}, dopo: {}, created_at: "2026-11-20T10:00:00.000Z" },
      ],
    };
    const r = await GET(fintoDb({ tabelle }), `?dettaglio=${ID}`);
    const j = r.json;
    c("dettaglio: 200 con ordine, riservati, rimborsi, email, storico, avvisi", [200, true, ["ordine", "riservati", "rimborsi", "email", "storico", "avvisi"]], [r.stato, j.ok, ["ordine", "riservati", "rimborsi", "email", "storico", "avvisi"].filter((k) => k in j)]);
    c("dettaglio: l'ordine è quello chiesto (non un altro)", [uuid(1), true], [j.ordine?.id, j.ordine?.fatturaRichiesta]);
    c("dettaglio: porta fattura (CF, P.IVA, SDI) e consensi", [RISERVATI.fattura, RISERVATI.consensi], [j.riservati?.fattura, j.riservati?.consensi]);
    c("dettaglio: NON porta attribuzione, fbp, IP né browser", [], [...chiaviDi(j.riservati)].filter((k) => ["attribuzione", "fbp", "fbc", "ip", "user_agent", "utm_source"].includes(k)).concat(["203.0.113.77", "fb.1.0000000000", "Browser di prova"].filter((s) => JSON.stringify(j).includes(s))));
    c("dettaglio: i rimborsi sono solo quelli dell'ordine, con importo, stato e motivo", [[uuid(0xb1), 1000, "riuscito", "Taglia sbagliata"]], (j.rimborsi ?? []).map((x) => [x.id, x.importoCent, x.stato, x.motivo]));
    c("dettaglio: le email dell'ordine (chiave, stato, codice)", [["conferma_ordine", "inviata", null], ["spedito", "errore", "resend_422"]], (j.email ?? []).map((e) => [e.chiave, e.stato, e.codice]));
    c("dettaglio: lo storico è solo di questo ordine", ["e1"], (j.storico ?? []).map((e) => e.id));
    c("dettaglio: l'avviso «pagato dopo la scadenza» si vede, con la sua frase", true, (j.avvisi ?? []).some((a) => /dopo la scadenza/i.test(a)));
    c("dettaglio: l'ordine è no-store", "no-store", (await S.gestisciGET(richiesta(`?dettaglio=${ID}`), porte(fintoDb({ tabelle })).d)).headers.get("Cache-Control"));
    // id sbagliato / assente
    c("dettaglio: id che non è un UUID → 400, database non toccato", [400, 0], await (async () => { const db = fintoDb({ tabelle }); const x = await GET(db, "?dettaglio=non-un-uuid"); return [x.stato, db.chiamate]; })());
    c("dettaglio: ordine che non esiste → 404", 404, (await GET(fintoDb({ tabelle }), `?dettaglio=${uuid(99)}`)).stato);
    // un guasto in una sezione non nasconde il resto
    const guasta = await GET(fintoDb({ tabelle, errori: { "shop_rimborsi.select": { error: { code: "XX010", details: "Anna Esempio" } } } }), `?dettaglio=${ID}`);
    c("dettaglio: se i rimborsi non si leggono, la sezione è `null` (non `[]`) e il resto arriva", [200, null, true, ["shop_rimborsi XX010"].length], [guasta.stato, guasta.json.rimborsi, guasta.json.riservati?.fattura?.cf === RISERVATI.fattura.cf, guasta.log.filter((l) => l.includes("XX010")).length]);
    const guastaR = await GET(fintoDb({ tabelle, errori: { "shop_ordini_riservati.select": { error: { code: "XX011" } } } }), `?dettaglio=${ID}`);
    c("dettaglio: se i riservati non si leggono → `null`, il resto arriva", [200, null, 1], [guastaR.stato, guastaR.json.riservati, guastaR.json.rimborsi?.length]);
    // S4 assente: nessuna sezione di pagamento
    const senza = vecchio(3);
    for (const k of Object.keys(COLONNE_S4)) delete senza[k];
    const dbS = fintoDb({ tabelle: { shop_orders: [senza], shop_ordini_riservati: [], shop_rimborsi: [] } });
    const rs = await GET(dbS, `?dettaglio=${uuid(3)}`);
    c("dettaglio con S4 assente: l'ordine c'è, nessuna sezione di pagamento, e lo dice", [200, uuid(3), null, null, false], [rs.stato, rs.json.ordine?.id, rs.json.riservati, rs.json.rimborsi, rs.json.migrazione?.pagamenti]);
    c("dettaglio con S4 assente: non si leggono nemmeno le tabelle nuove", [], dbS.registro.filter((q) => ["shop_ordini_riservati", "shop_rimborsi"].includes(q.tab)).map((q) => q.tab));
  }

  // ── il numeretto: come `contaComeLavoro`, con UNA richiesta; con S4 assente come oggi ──
  {
    const tre = [
      pagato(1, { status: "nuovo" }), //                                  pagato: conta
      vecchio(2, { status: "nuovo", stato_pagamento: "in_attesa", canale: "sito" }), // in attesa: fuori
      pagato(3, { status: "nuovo", prova: true }), //                     di prova: fuori
      pagato(4, { status: "spedito" }), //                                non è «nuovo»
    ];
    const r = await GET(fintoDb({ tabelle: { shop_orders: tre } }), "?conta=1");
    c("conta: tre «nuovo» (in attesa, di prova, pagato) → 1", [200, { ok: true, nuovi: 1 }], [r.stato, r.json]);
    const db1 = fintoDb({ tabelle: { shop_orders: tre } });
    await GET(db1, "?conta=1");
    c("conta: una sola richiesta, che conta e non legge le righe", [1, true], [db1.chiamate, db1.registro[0].opzioni?.head === true]);
    // gli ordini di oggi (40, con e senza colonne di S4): il numero è quello di oggi e quello di `contaComeLavoro`
    for (const [nome, righe] of [["senza colonne di S4", ordiniR1R2()], ["con i default di S4", ordiniR1R2().map(conDefaultS4)]]) {
      const attesi = righe.filter((x) => x.status === "nuovo").length;
      const daFunzione = O.normalizzaTutti(righe).ordini.filter((o) => o.stato === "nuovo" && o.statoGrezzo === "nuovo" && P.contaComeLavoro(o)).length;
      const x = await GET(fintoDb({ tabelle: { shop_orders: righe } }), "?conta=1");
      c(`conta sugli ordini di oggi (${nome}): lo stesso numero di sempre e di contaComeLavoro`, [attesi, attesi], [x.json.nuovi, daFunzione]);
    }
    // ogni stato di pagamento: lo conta solo chi si lavora
    const stati = ["in_attesa", "pagato", "fallito", "scaduto", "rimborsato_in_parte", "rimborsato", "da_incassare", null];
    const perStato = stati.map((s, i) => vecchio(10 + i, { status: "nuovo", stato_pagamento: s, canale: s ? "sito" : null }));
    const xs = await GET(fintoDb({ tabelle: { shop_orders: perStato } }), "?conta=1");
    const funz = O.normalizzaTutti(perStato).ordini.filter((o) => P.contaComeLavoro(o)).length;
    c("conta: stesso risultato di `contaComeLavoro` per ognuno dei sette stati e per la colonna vuota", [4, 4], [xs.json.nuovi, funz]);
    // S4 assente: la colonna non c'è, si ripiega sul conteggio di oggi
    const senzaS4 = fintoDb({ tabelle: { shop_orders: ordiniR1R2() }, errori: { "shop_orders.select": (q) => (q.filtri.some(([t]) => t === "or") ? { error: { code: "42703" } } : undefined) } });
    const rv = await GET(senzaS4, "?conta=1");
    c("conta con S4 assente (42703): ripiega sul conteggio di oggi, senza errore", [200, ordiniR1R2().filter((x) => x.status === "nuovo").length], [rv.stato, rv.json.nuovi]);
    c("conta: un altro errore del database resta un 500 senza numero inventato", [500, undefined], await (async () => { const x = await GET(fintoDb({ tabelle: { shop_orders: tre }, errori: { "shop_orders.select": { error: { code: "57014" } } } }), "?conta=1"); return [x.stato, x.json.nuovi]; })());
  }

  // ── il contesto delle azioni: sempre un oggetto; rimborsi illeggibili = undefined; effettiGestiti = solo ciò che si esegue ──
  {
    const rimb = { importoCent: 1000, motivo: "Prodotto rovinato", chiaveRichiesta: uuid(0xc1), conferma: true };
    const base = () => ({ shop_orders: [pagato(1)], shop_order_eventi: [], shop_rimborsi: [], shop_impostazioni: impostazioni() });
    // senza la porta Stripe il rimborso non è tra gli effetti gestiti: non parte, e non si scrive niente
    {
      const db = fintoDb({ tabelle: base() });
      const r = await POST(db, { azione: "rimborso", ordineId: ID, ...rimb }, { email: true });
      c("rimborso SENZA porta Stripe: «non è ancora attiva», nessuna riga di rimborso, nessuna scrittura", [400, true, 0, 0], [r.stato, /non è ancora attiva/i.test(r.json.messaggio), tab(db, "shop_rimborsi").length, db.scritture.length]);
    }
    // con la porta Stripe ma i rimborsi che non si leggono: `undefined`, non `[]` → rifiutato, nessun rimborso prenotato
    {
      const db = fintoDb({ tabelle: base(), errori: { "shop_rimborsi.select": { error: { code: "XX020" } } } });
      const r = await POST(db, { azione: "rimborso", ordineId: ID, ...rimb }, { stripe: true });
      c("rimborso con elenco dei rimborsi illeggibile → rifiutato (mai trattato come «nessun rimborso»), zero Stripe, zero prenotazioni", [400, true, 0, []], [r.stato, /rimborsi/i.test(r.json.messaggio), r.mondoStripe.chiamate.length, db.registro.filter((q) => q.op === "rpc").map((q) => q.nome)]);
      c("…e il guasto si scrive nel log come solo codice", true, r.log.some((l) => l.includes("XX020")) && r.log.every((l) => /^[A-Za-z0-9 _.:-]{1,80}$/.test(l)));
      const a = await POST(fintoDb({ tabelle: { ...base(), shop_orders: [pagato(1, { status: "annullato" })] }, errori: { "shop_rimborsi.select": { error: { code: "XX021" } } } }), { azione: "correggi_stato", ordineId: ID, da: "annullato", a: "nuovo", motivo: "Annullato per errore" });
      c("riattivazione di un annullato con i rimborsi illeggibili → rifiutata", [400, true], [a.stato, /rimborsi/i.test(a.json.messaggio)]);
    }
    // email_invia: senza la porta email non è gestita; con la porta parte una volta, manuale
    {
      const senza = await POST(fintoDb({ tabelle: base() }), { azione: "email_invia", ordineId: ID, chiave: "conferma_ordine" });
      c("email_invia SENZA porta email: «non è ancora attiva»", [400, true], [senza.stato, /non è ancora attiva/i.test(senza.json.messaggio)]);
      const db = fintoDb({ tabelle: base() });
      const r = await POST(db, { azione: "email_invia", ordineId: ID, chiave: "conferma_ordine" }, { email: true });
      c("email_invia con la porta: UNA chiamata, manuale, per quell'ordine", [200, [["conferma_ordine", ID, { manuale: true }]]], [r.stato, r.chiamateEmail]);
      const spenta = await POST(fintoDb({ tabelle: base() }), { azione: "email_invia", ordineId: ID, chiave: "conferma_ordine" }, { email: () => ({ stato: "spenta" }) });
      c("email_invia con l'interruttore spento: la frase lo dice, e non è «inviata»", [true, false], [/interruttore spento/i.test(JSON.stringify(spenta.json)), /inviata\./i.test(JSON.stringify(spenta.json.effetti ?? []))]);
      const quasi = await POST(fintoDb({ tabelle: base() }), { azione: "email_invia", ordineId: ID, chiave: "spedito" }, { email: () => ({ stato: "segnaposto" }) });
      c("email_invia con un testo da confermare: rifiuto con la frase, mai «ok» muto", [false, true], [quasi.json.ok, /da confermare|testo|approv/i.test(quasi.json.messaggio ?? "")]);
    }
    // gli effetti gestiti sono SOLO quelli delle porte: la rotta li passa e `costruisciAzione` rifiuta il resto
    {
      const db = fintoDb({ tabelle: { ...base(), shop_orders: [vecchio(1, { status: "nuovo", stato_pagamento: "in_attesa", canale: "sito", stripe_sessione_id: "cs_test_x" })] } });
      const r = await POST(db, { azione: "annulla", ordineId: ID, motivo: "Il cliente non paga" });
      c("annulla di un ordine IN ATTESA senza porta Stripe → «non è ancora attiva», l'ordine non cambia (la sessione non si può far scadere)", [400, "nuovo", 0], [r.stato, riga(db).status, db.scritture.length]);
    }
  }

  // ── le azioni vecchie su un ordine Stripe: rifiutate dal server; su un ordine di prima: come oggi ──
  {
    const db = () => fintoDb({ tabelle: { shop_orders: [pagato(1), vecchio(2)], shop_order_eventi: [] } });
    const vecchie = [
      [{ azione: "pagato", ordineId: ID, metodo: "bonifico" }, /Stripe/],
      [{ azione: "pagamento_annullato", ordineId: ID }, /Stripe/],
      [{ azione: "tracking", ordineId: ID, valore: "ABC12345" }, /Spedisci/],
      [{ azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" }, /Spedisci/],
      [{ azione: "stato", ordineId: ID, da: "nuovo", a: "annullato" }, /Annulla/],
    ];
    const esiti = [];
    for (const [corpo, frase] of vecchie) {
      const d = db();
      const r = await POST(d, corpo);
      esiti.push([corpo.azione + (corpo.a ? `→${corpo.a}` : ""), r.stato, frase.test(r.json.messaggio ?? ""), d.scritture.length]);
    }
    c("azioni vecchie (pagato, pagamento_annullato, tracking, stato→spedito|annullato) su un ordine Stripe: 400 con la frase, nessuna scrittura", [], esiti.filter(([, s, f, w]) => s !== 400 || !f || w));
    const d = db();
    const prima = await POST(d, { azione: "pagato", ordineId: uuid(2), metodo: "bonifico" });
    const dopo = await POST(d, { azione: "tracking", ordineId: uuid(2), valore: "TRK12345" });
    const stato = await POST(d, { azione: "stato", ordineId: uuid(2), da: "nuovo", a: "spedito" });
    c("le stesse azioni su un ordine di prima (colonna vuota) passano come oggi", [200, 200, 200, "spedito"], [prima.stato, dopo.stato, stato.stato, riga(d, uuid(2)).status]);
    c("e la risposta ha ancora la forma di prima: `ok`, `ordine`, `storico` (nessuna chiave in più)", ["ok", "ordine", "storico"], Object.keys(stato.json));
  }

  // ── spedisci ──
  {
    const tabelle = () => ({ shop_orders: [pagato(1), vecchio(2, { canale: "sito", stato_pagamento: "in_attesa" })], shop_order_eventi: [], shop_impostazioni: impostazioni() });
    const db = fintoDb({ tabelle: tabelle() });
    const r = await POST(db, { azione: "spedisci", ordineId: ID, corriere: "brt", numero: "ABC 12345" }, { email: true });
    const o = riga(db);
    c("spedisci: stato spedito, data, corriere dell'elenco, numero e link", ["spedito", ADESSO, "BRT", "ABC 12345", "https://tracking.example.com/brt/ABC%2012345", false], [o.status, o.spedito_il, o.corriere, o.tracking, o.tracking_url, o.senza_tracking]);
    c("spedisci: la risposta è ok e porta l'ordine aggiornato", [200, true, "spedito", true], [r.stato, r.json.ok, r.json.ordine?.stato, r.json.storico]);
    c("spedisci: UNA riga di storico, tipo «spedito», scritta col nome di chi agisce", [1, "spedito", "Giulia Esempio", uuid(1)], (() => { const e = tab(db, "shop_order_eventi"); return [e.length, e[0]?.tipo, e[0]?.chi, e[0]?.order_id]; })());
    c("spedisci: parte UNA email «spedito» (non manuale) e la risposta lo dice", [[["spedito", ID, { manuale: false }]], "inviata"], [r.chiamateEmail, r.json.email?.stato]);
    const spenta = await POST(fintoDb({ tabelle: tabelle() }), { azione: "spedisci", ordineId: ID, senzaTracking: true }, { email: () => ({ stato: "spenta" }) });
    c("spedisci con l'email spenta: spedito lo stesso, e la frase dice «email non inviata: interruttore spento»", [200, "spedito", true], [spenta.stato, spenta.json.ordine?.stato, /email non inviata.*interruttore spento/i.test(spenta.json.email?.frase ?? "")]);
    const senzaPorta = await POST(fintoDb({ tabelle: tabelle() }), { azione: "spedisci", ordineId: ID, senzaTracking: true });
    c("spedisci senza la porta email: spedito, nessuna email e nessuna finzione", [200, undefined], [senzaPorta.stato, senzaPorta.json.email]);
    const rotta = await POST(fintoDb({ tabelle: tabelle() }), { azione: "spedisci", ordineId: ID, senzaTracking: true }, { email: () => { throw new Error("Resend giù: testo-del-guasto-segreto"); } });
    c("spedisci con la porta email che LANCIA: spedito lo stesso, il testo dell'eccezione non esce né nel log né nella risposta", [200, "spedito", false, false, "errore"], [rotta.stato, rotta.json.ordine?.stato, JSON.stringify(rotta.json).includes("testo-del-guasto-segreto"), rotta.log.join("|").includes("testo-del-guasto-segreto"), rotta.json.email?.stato]);
    const attesa = await POST(fintoDb({ tabelle: tabelle() }), { azione: "spedisci", ordineId: uuid(2), senzaTracking: true }, { email: true });
    c("spedisci un ordine in attesa di pagamento → rifiutato, nessuna email", [400, 0], [attesa.stato, attesa.chiamateEmail.length]);
    const senzaCorriere = await POST(fintoDb({ tabelle: tabelle() }), { azione: "spedisci", ordineId: ID });
    c("spedisci senza corriere né «senza tracking» → rifiutato (SPEC 8A n. 2)", [400, true], [senzaCorriere.stato, /corriere|tracking/i.test(senzaCorriere.json.messaggio)]);
    const vec = fintoDb({ tabelle: { shop_orders: [vecchio(5)], shop_order_eventi: [] } });
    const rv = await POST(vec, { azione: "spedisci", ordineId: uuid(5) }, { email: true });
    c("spedisci un ordine di prima: passa senza corriere e senza email (non è della cassa nuova)", [200, "spedito", 0], [rv.stato, riga(vec, uuid(5)).status, rv.chiamateEmail.length]);
  }

  // ── correggi_stato, fattura_emessa, giacenza_verificata ──
  {
    const db = fintoDb({ tabelle: { shop_orders: [pagato(1, { status: "in_preparazione", fattura_richiesta: true, giacenza_da_verificare: true })], shop_order_eventi: [] } });
    const r = await POST(db, { azione: "correggi_stato", ordineId: ID, da: "in_preparazione", a: "nuovo", motivo: "Segnato per sbaglio" });
    const e = tab(db, "shop_order_eventi");
    c("correggi_stato con motivo: stato indietro, evento «stato_corretto» col motivo e col nome di chi agisce", [200, "nuovo", 1, "stato_corretto", "Segnato per sbaglio", "Giulia Esempio"], [r.stato, riga(db).status, e.length, e[0]?.tipo, e[0]?.dopo?.motivo, e[0]?.chi]);
    const nm = await POST(fintoDb({ tabelle: { shop_orders: [pagato(1, { status: "in_preparazione" })], shop_order_eventi: [] } }), { azione: "correggi_stato", ordineId: ID, da: "in_preparazione", a: "nuovo", motivo: "  " });
    c("correggi_stato senza motivo → rifiutato", [400, true], [nm.stato, /motivo/i.test(nm.json.messaggio)]);
    const f = await POST(db, { azione: "fattura_emessa", ordineId: ID, nota: "Fattura n. 12/2026" });
    c("fattura_emessa: data e nota scritte, storico", [200, ADESSO, "Fattura n. 12/2026", "fattura_emessa"], [f.stato, riga(db).fattura_emessa_il, riga(db).fattura_nota, tab(db, "shop_order_eventi").at(-1)?.tipo]);
    const g = await POST(db, { azione: "giacenza_verificata", ordineId: ID });
    c("giacenza_verificata: la spunta si toglie, storico", [200, false, "giacenza_verificata"], [g.stato, riga(db).giacenza_da_verificare, tab(db, "shop_order_eventi").at(-1)?.tipo]);
    c("le due sono idempotenti nel senso giusto: la seconda volta è «nessun cambio», non una seconda scrittura", [false, false], [(await POST(db, { azione: "giacenza_verificata", ordineId: ID })).json.ok, (await POST(db, { azione: "fattura_emessa", ordineId: ID })).json.ok]);
  }

  // ── la riattivazione «annullato → nuovo» passa da `shop_ordine_riattiva` (T53b): sotto blocco nel database, senza `update` diretto né ripristino ──
  {
    const annullato = () => pagato(1, { status: "annullato", annullo_motivo: "Cliente pentito", annullato_il: "2026-11-20T11:00:00.000Z", giacenza_rimessa_il: "2026-11-20T11:00:00.000Z" });
    const corpo = { azione: "correggi_stato", ordineId: ID, da: "annullato", a: "nuovo", motivo: "Annullato per errore" };
    const rpcDi = (db) => db.registro.filter((q) => q.op === "rpc");
    const updateOrdini = (db) => db.registro.filter((q) => q.tab === "shop_orders" && q.op === "update");
    const pulita = fintoDb({ tabelle: { shop_orders: [annullato()], shop_order_eventi: [], shop_rimborsi: [] } });
    const ok = await POST(pulita, corpo);
    c("riattivazione senza rimborsi: passa, stato nuovo, motivo dell'annullo tolto, giacenza da verificare (i pezzi erano tornati)", [200, "nuovo", null, true], [ok.stato, riga(pulita).status, riga(pulita).annullo_motivo, riga(pulita).giacenza_da_verificare]);
    c("…con UNA sola chiamata alla funzione, con gli argomenti esatti (ordine, motivo, chi) e nessun `update` diretto dell'ordine", [[{ p_ordine: ID, p_motivo: "Annullato per errore", p_chi: "Giulia Esempio" }], 0], [rpcDi(pulita).filter((q) => q.nome === "shop_ordine_riattiva").map((q) => q.args), updateOrdini(pulita).length]);
    c("…lo storico lo scrive la funzione: UNA sola riga «stato_corretto», col motivo e col nome di chi agisce (non una seconda dalla rotta)", [1, "Annullato per errore", "Giulia Esempio"], (() => { const e = tab(pulita, "shop_order_eventi").filter((x) => x.tipo === "stato_corretto"); return [e.length, e[0]?.dopo?.motivo, e[0]?.chi]; })());
    c("…e la risposta è quella di sempre (ok, ordine nuovo, storico vero)", [true, "nuovo", true], [ok.json.ok, ok.json.ordine?.stato, ok.json.storico]);
    const attivo = fintoDb({ tabelle: { shop_orders: [annullato()], shop_order_eventi: [], shop_rimborsi: [{ id: uuid(0xb1), ordine_id: ID, importo_cent: 500, stato: "richiesto", motivo: "x", creato_il: ADESSO }] } });
    const no = await POST(attivo, corpo);
    c("riattivazione con un rimborso richiesto → rifiutata dalla regola pura (prima cintura): la funzione non si chiama, nessuna scrittura", [400, "annullato", 0, 0], [no.stato, riga(attivo).status, attivo.scritture.length, rpcDi(attivo).length]);
    // la corsa: il rimborso nasce DOPO la lettura dei rimborsi e PRIMA della funzione: la funzione, sotto blocco, lo vede
    const corsa = fintoDb({
      tabelle: { shop_orders: [annullato()], shop_order_eventi: [], shop_rimborsi: [] },
      prima: { "rpc.shop_ordine_riattiva": (t) => t.shop_rimborsi.push({ id: uuid(0xb9), ordine_id: ID, importo_cent: 700, stato: "richiesto", motivo: "x", creato_il: ADESSO }) },
    });
    const rc = await POST(corsa, corpo);
    c("riattivazione con un rimborso nato nel frattempo (`rimborso_attivo`): 409, ordine ANCORA annullato, motivo e data dell'annullo intatti", [409, "annullato", "Cliente pentito", "2026-11-20T11:00:00.000Z", true], [rc.stato, riga(corsa).status, riga(corsa).annullo_motivo, riga(corsa).annullato_il, /rimborso/i.test(rc.json.messaggio ?? "")]);
    c("…senza `update` dell'ordine, senza ripristini e senza storico «stato corretto»", [0, 0], [updateOrdini(corsa).length, tab(corsa, "shop_order_eventi").filter((e) => e.tipo === "stato_corretto").length]);
    // un collega l'ha già spostato: `cambiato` → 409
    const cambiata = fintoDb({
      tabelle: { shop_orders: [annullato()], shop_order_eventi: [], shop_rimborsi: [] },
      prima: { "rpc.shop_ordine_riattiva": (t) => { t.shop_orders[0].status = "nuovo"; } },
    });
    const rcam = await POST(cambiata, corpo);
    c("riattivazione di un ordine già spostato da un collega (`cambiato`): 409 «conflitto», niente scritto da noi", [409, "conflitto", 0], [rcam.stato, rcam.json.error, tab(cambiata, "shop_order_eventi").length]);
    // la funzione che non risponde: fallisce chiuso, con una frase onesta
    const guasta = fintoDb({ tabelle: { shop_orders: [annullato()], shop_order_eventi: [], shop_rimborsi: [] }, errori: { "rpc.shop_ordine_riattiva": { error: { code: "XX030", message: "dettaglio con Anna Esempio" } } } });
    const rg = await POST(guasta, corpo);
    c("riattivazione con la funzione che dà errore: l'ordine resta annullato, risposta d'errore con frase, nel log solo il codice", [502, "annullato", true, true, false], [rg.stato, riga(guasta).status, rg.json.ok === false && typeof rg.json.messaggio === "string" && rg.json.messaggio.length > 10, rg.log.some((l) => l.includes("XX030")), JSON.stringify([rg.json, rg.log]).includes("Anna")]);
    const lancia = fintoDb({ tabelle: { shop_orders: [annullato()], shop_order_eventi: [], shop_rimborsi: [] }, errori: { "rpc.shop_ordine_riattiva": { lancia: new Error("rete: Anna Esempio") } } });
    const rl = await POST(lancia, corpo);
    c("riattivazione con la funzione che LANCIA: 500 generico, ordine annullato, nessun dato nel log", [500, "annullato", false], [rl.stato, riga(lancia).status, JSON.stringify([rl.json, rl.log]).includes("Anna")]);
  }

  // ── la condizione sul valore visto: 409, e niente effetti ──
  {
    const db = fintoDb({
      tabelle: { shop_orders: [pagato(1)], shop_order_eventi: [], shop_rimborsi: [], shop_impostazioni: impostazioni() },
      prima: { "shop_orders.update": (t) => { t.shop_orders[0].status = "in_preparazione"; } }, // un collega l'ha cambiato un attimo prima
    });
    const r = await POST(db, { azione: "spedisci", ordineId: ID, senzaTracking: true }, { email: true });
    c("spedisci su un ordine cambiato da un collega: 409 conflitto, stato com'è, nessuna email, nessun evento", [409, "conflitto", "in_preparazione", 0, 0], [r.stato, r.json.error, riga(db).status, r.chiamateEmail.length, tab(db, "shop_order_eventi").length]);
    const db2 = fintoDb({
      tabelle: { shop_orders: [pagato(1)], shop_order_eventi: [], shop_rimborsi: [] },
      prima: { "shop_orders.update": (t) => { t.shop_orders[0].status = "in_preparazione"; } },
    });
    const a = await POST(db2, { azione: "annulla", ordineId: ID, motivo: "Cliente pentito", rimborso: "ora", rimettiInMagazzino: true, chiaveRichiesta: uuid(0xc2) }, { stripe: true });
    c("annulla con rimborso su un ordine cambiato da un collega: 409 e NESSUNA chiamata a Stripe, nessun rimborso, nessuna giacenza", [409, 0, 0, []], [a.stato, a.mondoStripe.chiamate.length, tab(db2, "shop_rimborsi").length, db2.registro.filter((q) => q.op === "rpc").map((q) => q.nome)]);
  }

  // ── migrazione S4 assente: le azioni nuove dicono quale file ──
  {
    const senza = vecchio(1);
    for (const k of Object.keys(COLONNE_S4)) delete senza[k];
    const esiti = [];
    for (const corpo of [{ azione: "spedisci", ordineId: ID, senzaTracking: true }, { azione: "annulla", ordineId: ID }, { azione: "riconcilia", ordineId: ID }, { azione: "giacenza_verificata", ordineId: ID }]) {
      const db = fintoDb({ tabelle: { shop_orders: [{ ...senza }], shop_order_eventi: [] } });
      const r = await POST(db, corpo, { stripe: true, email: true });
      esiti.push([corpo.azione, r.stato, r.json.error, /20261122120000_shop_pagamenti\.sql/.test(r.json.messaggio ?? ""), db.scritture.length, r.mondoStripe.chiamate.length]);
    }
    c("azioni nuove con S4 assente: 409 `migrazione` col nome del file, nessuna scrittura, nessuna chiamata a Stripe", [], esiti.filter(([, s, e, f, w, st]) => s !== 409 || e !== "migrazione" || !f || w || st));
    const vecchieOk = await POST(fintoDb({ tabelle: { shop_orders: [{ ...senza }], shop_order_eventi: [] } }), { azione: "nota_interna", ordineId: ID, valore: "ok" });
    c("le azioni vecchie con S4 assente funzionano come oggi", 200, vecchieOk.stato);
  }

  // ── nessun dato del cliente nei log; mai delete; il testo del modulo ──
  {
    const PERSONALI = ["Anna", "Esempio", "anna.esempio@example.com", "+39 300 000 0001", "Via Inventata 1", "Cittàfinta", "00000", "ZZZZZZ00A00Z000Z"];
    const dettagli = `Failing row contains (${PERSONALI.join(", ")}).`;
    const err = (code) => ({ error: { code, message: `violazione per ${PERSONALI.join(" ")}`, details: dettagli, hint: dettagli } });
    const t = () => ({ shop_orders: [pagato(1)], shop_order_eventi: [], shop_rimborsi: [], shop_ordini_riservati: [riservatiDi(1)], shop_impostazioni: impostazioni() });
    const scenari = [
      ["dettaglio: riservati", () => GET(fintoDb({ tabelle: t(), errori: { "shop_ordini_riservati.select": err("XX041") } }), `?dettaglio=${ID}`)],
      ["dettaglio: storico", () => GET(fintoDb({ tabelle: t(), errori: { "shop_order_eventi.select": (q) => (q.cols.includes("tipo") ? err("XX042") : undefined) } }), `?dettaglio=${ID}`)],
      ["spedisci: update", () => POST(fintoDb({ tabelle: t(), errori: { "shop_orders.update": err("XX043") } }), { azione: "spedisci", ordineId: ID, senzaTracking: true })],
      ["spedisci: evento", () => POST(fintoDb({ tabelle: t(), errori: { "shop_order_eventi.insert": err("XX044") } }), { azione: "spedisci", ordineId: ID, senzaTracking: true })],
      ["spedisci: corrieri", () => POST(fintoDb({ tabelle: t(), errori: { "shop_impostazioni.select": err("XX045") } }), { azione: "spedisci", ordineId: ID, corriere: "BRT", numero: "ABC12345" })],
      ["correggi: eccezione", () => POST(fintoDb({ tabelle: { ...t(), shop_orders: [pagato(1, { status: "annullato" })] }, errori: { "rpc.shop_ordine_riattiva": { lancia: new Error(`rete: ${dettagli}`) } } }), { azione: "correggi_stato", ordineId: ID, da: "annullato", a: "nuovo", motivo: "Annullato per errore" })],
    ];
    const brutti = [];
    for (const [nome, vai] of scenari) {
      const r = await vai();
      const testi = [...r.log, String(r.json.error ?? ""), String(r.json.messaggio ?? "")];
      if (!r.log.length) brutti.push([nome, "nessun log"]);
      if (!r.log.every((x) => typeof x === "string" && /^[A-Za-z0-9 _.:-]{1,80}$/.test(x))) brutti.push([nome, "log non solo codici", r.log]);
      if (PERSONALI.some((p) => testi.some((s) => s.includes(p)))) brutti.push([nome, "dato nel log o nell'errore"]);
    }
    c("log: mai l'oggetto errore né dati del cliente (nome, indirizzo, codice fiscale), né nel log né nella risposta", [], brutti);
    const dbDel = fintoDb({ tabelle: { shop_orders: [pagato(1)], shop_order_eventi: [], shop_rimborsi: [], shop_impostazioni: impostazioni() } });
    await POST(dbDel, { azione: "spedisci", ordineId: ID, senzaTracking: true }, { email: true });
    await POST(dbDel, { azione: "correggi_stato", ordineId: ID, da: "spedito", a: "in_preparazione", motivo: "Errore di battitura" });
    c("mai `delete`, e ogni update porta il filtro sull'id", [0, true], [dbDel.registro.filter((q) => q.op === "delete").length, dbDel.registro.filter((q) => q.op === "update").every((q) => q.filtri.some(([ti, co]) => ti === "eq" && co === "id"))]);
    const modulo = src("src/crm/ecommerce/ordini.server.ts");
    const rimb = src("src/crm/ecommerce/rimborsi.server.ts");
    const codice = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""); // senza i commenti: lì si può nominare ciò che non si fa
    c("sorgente: nessun `.delete(`, nessun `console`, nessun `process.env`, nessuna chiave di Stripe", [false, false, false, false], [/\.delete\(/.test(codice(modulo + rimb)), /console\./.test(codice(modulo + rimb)), /process\.env|import\.meta\.env/.test(codice(modulo + rimb)), /(?:sk|rk)_(?:test|live)_|whsec_/.test(modulo + rimb)]);
    c("sorgente: la rotta non importa `client.server` (le dipendenze sono porte)", false, /client\.server/.test(modulo + rimb));
    c("sorgente: le azioni nuove passano SEMPRE il contesto a `costruisciAzione`", true, /costruisciAzione\(\s*corpo,\s*\w+,\s*\w+,\s*contesto\s*\)/.test(modulo));
  }
}
