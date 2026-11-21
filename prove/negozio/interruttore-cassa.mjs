/** ── NEGOZIO · T56 · L'INTERRUTTORE «CASSA DEL SITO» (SCRITTURA) E LO SMISTAMENTO ──
 *  `src/crm/negozio/interruttori.server.ts` (le regole di `cassa_sito`, `resi_confermati`, `pagamento_sicuro`,
 *  `metodi_pagamento`, `GET ?cassa`) e `smista.server.ts` (instrada `?spedizioni`, `?cassa` e le azioni di T50). Regole (PIANO-R2 T56, D56, D65):
 *   · `stripe` si accetta SOLO se: chiave Stripe presente, segreto del webhook presente, tariffa attiva, S4 applicata
 *     (i fatti arrivano dalla porta `fattiEsterni`): una frase per ciascuno, nessuna scrittura; `vecchia` sempre ammessa, senza nemmeno
 *     chiedere i fatti; il valore scritto è `"stripe"` minuscolo (qualunque altra forma → 400);
 *   · valore atteso vecchio → 409 col valore vero; ogni cambio nello storico (lo scrive il database con `shop_impostazione_imposta`);
 *   · le variabili d'ambiente non compaiono MAI nella risposta: solo «presente/assente»;
 *   · `pagamento_sicuro = true` solo se `pagamentoIncassa` è vero (un ordine reale pagato e rimborsato); `false` sempre;
 *   · `metodi_pagamento`: solo `carta|apple_pay|google_pay|paypal|klarna`, senza doppioni.
 *  Dati inventati. Nessun accesso al database vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { tabelleProva } from "./dati.mjs";
import { tariffaSeme, ID_TARIFFA_SEME } from "./_dati-r2.mjs";
import { porte, post, get, leggi, guardiaNo, guardiaOk, scrittureDirette } from "./_server.mjs";

const ISTANTE = "2026-11-20T10:00:00.000Z";
const imp = (chiave, valore) => ({ chiave, valore, aggiornato_il: ISTANTE, aggiornato_da: null });
const SEMI_R2 = () => [imp("cassa_sito", "vecchia"), imp("pagamento_sicuro", false), imp("metodi_pagamento", []), imp("resi_confermati", false)];
const tabelle = (extra = {}) => {
  const t = tabelleProva();
  t.shop_impostazioni.push(...SEMI_R2());
  return { ...t, ...extra };
};
const con = (t, chiave, valore) => ({ ...t, shop_impostazioni: t.shop_impostazioni.map((r) => (r.chiave === chiave ? { ...r, valore } : r)) });
const FATTI_OK = () => ({ bannerPresente: true, chiavePresente: true, segretoPresente: true, tariffaAttiva: true, s4Presente: true, pagamentoIncassa: false });
const FATTI_INCASSA = () => ({ ...FATTI_OK(), pagamentoIncassa: true, spedizioneResi: true, emailConferma: true });

export async function prove(mod, { c, gruppo, radice }) {
  const I = mod["negozio/interruttori.server"];
  const S = mod["negozio/smista.server"];
  const G = mod["negozio/cancello"];
  gruppo("NEGOZIO · L'INTERRUTTORE «CASSA DEL SITO» E LO SMISTAMENTO (21/11/2026, T56)");
  if (!G.condizioniCassa) return c("`condizioniCassa` esiste in cancello.ts", true, false);

  const esegui = async (corpo, opz = {}) => {
    const db = opz.db ?? fintoDb({ tabelle: opz.tabelle ?? tabelle() });
    const p = porte({ db, fattiEsterni: FATTI_OK, ...opz.porte });
    const r = opz.get ? await I.gestisciGET(get(corpo), p.d) : await I.gestisciPOST(post(corpo), p.d);
    return { db, log: p.log, ...(await leggi(r)) };
  };
  const imposta = (chiave, valore, atteso) => ({ azione: "interruttore_imposta", chiave, valore, atteso });
  const valoreDi = (db, chiave) => db.tabelle.shop_impostazioni.find((r) => r.chiave === chiave)?.valore;
  const scambi = (db) => db.registro.filter((q) => q.nome === "shop_impostazione_imposta").length;

  // ── la guardia ──
  for (const stato of [401, 403]) {
    const g = await esegui("cassa", { get: true, porte: { guardia: guardiaNo(stato) } });
    const p = await esegui(imposta("cassa_sito", "stripe", "vecchia"), { porte: { guardia: guardiaNo(stato) } });
    c(`guardia negata (${stato}) su ?cassa e su cassa_sito: zero chiamate al database, zero log`, [stato, stato, 0, 0, 0, 0], [g.stato, p.stato, g.db.chiamate, p.db.chiamate, g.log.length, p.log.length]);
  }

  // ── `stripe`: le quattro precondizioni, una frase per ciascuna, nessuna scrittura ──
  const MANCA = [
    ["chiavePresente", "chiave_stripe", /chiave/i],
    ["segretoPresente", "segreto_webhook", /segreto/i],
    ["tariffaAttiva", "tariffa", /tariffa/i],
    ["s4Presente", "migrazione_pagamenti", /database|aggiornamento|S4/i],
  ];
  const frasiViste = new Set();
  for (const [fatto, chiave, parola] of MANCA) {
    const r = await esegui(imposta("cassa_sito", "stripe", "vecchia"), { porte: { fattiEsterni: () => ({ ...FATTI_OK(), [fatto]: false }) } });
    c(`stripe con «${fatto}» mancante → 409 «cassa», la frase lo nomina, il valore resta «vecchia», nessuna scrittura`, [409, false, "cassa", true, "vecchia", 0, 0],
      [r.stato, r.corpo.ok, r.corpo.motivo, parola.test(r.corpo.frase), valoreDi(r.db, "cassa_sito"), r.db.scritture.length, scambi(r.db)]);
    c("…la risposta porta le righe: UNA sola non ok, e è la sua", [[chiave], 4], [r.corpo.condizioni?.righe?.filter((x) => !x.ok).map((x) => x.chiave), r.corpo.condizioni?.righe?.length]);
    frasiViste.add(r.corpo.frase);
  }
  c("le quattro frasi di rifiuto sono diverse fra loro", 4, frasiViste.size);
  const tuttiManca = await esegui(imposta("cassa_sito", "stripe", "vecchia"), { porte: { fattiEsterni: () => ({ bannerPresente: true }) } });
  c("fatti non passati (la porta dà solo il banner) → rifiutato, e la frase dice tutte e quattro le cose che mancano", [409, 4, true], [tuttiManca.stato, tuttiManca.corpo.condizioni?.righe?.filter((x) => !x.ok).length, MANCA.every(([, , p]) => p.test(tuttiManca.corpo.frase))]);
  const fatti2 = await esegui(imposta("cassa_sito", "stripe", "vecchia"), { porte: { fattiEsterni: () => ({ ...FATTI_OK(), chiavePresente: "sì", segretoPresente: 1 }) } });
  c("fatti che non sono veri booleani (testo, numero) → non contano come presenti", [409, 0], [fatti2.stato, scambi(fatti2.db)]);

  // ── `stripe` accettato: tutto presente ──
  const ok = await esegui(imposta("cassa_sito", "stripe", "vecchia"));
  c("tutto presente → «stripe» (minuscolo, esatto), cambiato", [200, true, "stripe", true, true], [ok.stato, ok.corpo.ok, valoreDi(ok.db, "cassa_sito"), ok.corpo.cambiato, ok.corpo.valore === "stripe"]);
  c("…lo storico ha UNA riga, scritta dal database: chiave, prima, dopo, chi", [[{ entita: "impostazione", entita_id: "cassa_sito", campo: "valore", prima: "vecchia", dopo: "stripe", chi: "Titolare Prova" }]],
    [ok.db.tabelle.shop_storico.map(({ entita, entita_id, campo, prima, dopo, chi }) => ({ entita, entita_id, campo, prima, dopo, chi }))]);
  c("…la sola scrittura è la funzione shop_impostazione_imposta", [["shop_impostazione_imposta"], []], [ok.db.registro.filter((q) => q.op === "rpc").map((q) => q.nome), scrittureDirette(ok.db)]);
  c("…il catalogo `codice` non è una condizione per scrivere (la cassa effettiva lo guarda alla lettura)", "stripe", valoreDi(ok.db, "cassa_sito"));

  // ── `vecchia`: sempre ammessa ──
  let chiesti = 0;
  const ch = await esegui(imposta("cassa_sito", "vecchia", "stripe"), { tabelle: con(tabelle(), "cassa_sito", "stripe"), porte: { fattiEsterni: () => { chiesti++; return {}; } } });
  c("tornare a «vecchia» si può sempre, senza nemmeno chiedere i fatti, con una riga di storico", [200, "vecchia", 0, 1], [ch.stato, valoreDi(ch.db, "cassa_sito"), chiesti, ch.db.tabelle.shop_storico.length]);
  const chm = await esegui(imposta("cassa_sito", "vecchia", "stripe"), { tabelle: con(tabelle(), "cassa_sito", "stripe"), porte: { fattiEsterni: () => { throw new Error("PROVA fatti rotti"); } } });
  c("…anche se i fatti non si riescono a leggere (la porta lancia)", [200, "vecchia"], [chm.stato, valoreDi(chm.db, "cassa_sito")]);
  const cg = await esegui(imposta("cassa_sito", "stripe", "vecchia"), { porte: { fattiEsterni: () => { throw new Error("PROVA fatti rotti"); } } });
  c("…mentre per accendere, se i fatti non si leggono → errore generico, niente scritto, il testo dell'errore non esce", [500, "interno", "vecchia", false], [cg.stato, cg.corpo.motivo, valoreDi(cg.db, "cassa_sito"), /PROVA/.test(JSON.stringify(cg.corpo))]);

  // ── valore atteso, forme del valore ──
  const vec = await esegui(imposta("cassa_sito", "vecchia", "stripe"));
  c("valore atteso vecchio (qualcuno l'ha già cambiato) → 409 conflitto col valore vero, niente scritto", [409, "conflitto", "vecchia", 0], [vec.stato, vec.corpo.motivo, vec.corpo.valore, vec.db.scritture.length]);
  const cor = await esegui(imposta("cassa_sito", "stripe", "vecchia"), { db: fintoDb({ tabelle: tabelle(), prima: { "rpc.shop_impostazione_imposta": (t) => { t.shop_impostazioni.find((r) => r.chiave === "cassa_sito").valore = "stripe"; } } }) });
  c("cambiato da un altro un attimo prima dello scambio (la funzione risponde false) → 409, non «ok»", [409, "conflitto"], [cor.stato, cor.corpo.motivo]);
  const uguale = await esegui(imposta("cassa_sito", "vecchia", "vecchia"));
  c("stesso valore → ok «non cambiato», nessuna scrittura e i fatti non si chiedono", [200, false, 0, 0], [uguale.stato, uguale.corpo.cambiato, uguale.db.scritture.length, scambi(uguale.db)]);
  for (const [nome, corpo] of [
    ["«Stripe» con la maiuscola", imposta("cassa_sito", "Stripe", "vecchia")], ["«STRIPE»", imposta("cassa_sito", "STRIPE", "vecchia")], ["« stripe» con lo spazio", imposta("cassa_sito", " stripe", "vecchia")],
    ["vero", imposta("cassa_sito", true, "vecchia")], ["nullo", imposta("cassa_sito", null, "vecchia")], ["«codice» (è del catalogo)", imposta("cassa_sito", "codice", "vecchia")],
    ["atteso «Stripe»", imposta("cassa_sito", "vecchia", "Stripe")], ["atteso mancante", { azione: "interruttore_imposta", chiave: "cassa_sito", valore: "stripe" }], ["atteso «cms»", imposta("cassa_sito", "stripe", "cms")],
  ]) {
    const r = await esegui(corpo);
    c(`cassa_sito ${nome} → 400, nessuna chiamata, niente scritto`, [400, 0, 0], [r.stato, r.db.chiamate, r.db.scritture.length]);
  }
  const maiuscolo = await esegui(imposta("cassa_sito", "Stripe", "vecchia"));
  c("…«Stripe» maiuscolo non arriva mai a scrivere: S4b e `cassaDa` lo leggerebbero «vecchia»", "vecchia", valoreDi(maiuscolo.db, "cassa_sito"));
  const senzaSeme = await esegui(imposta("cassa_sito", "stripe", "vecchia"), { tabelle: tabelleProva() });
  c("seme di S4 mancante (la riga `cassa_sito` non c'è) → 409 «migrazione», non la crea", [409, "migrazione", 0], [senzaSeme.stato, senzaSeme.corpo.motivo, senzaSeme.db.tabelle.shop_impostazioni.filter((r) => r.chiave === "cassa_sito").length]);
  const s1mancante = await esegui(imposta("cassa_sito", "stripe", "vecchia"), { db: fintoDb({ tabelle: tabelle(), mancante: true }) });
  c("S1 non applicata → 409 «migrazione»", [409, "migrazione"], [s1mancante.stato, s1mancante.corpo.motivo]);
  const gu = await esegui(imposta("cassa_sito", "stripe", "vecchia"), { db: fintoDb({ tabelle: tabelle(), errori: { "rpc.shop_impostazione_imposta": { error: { code: "XX003", message: "PROVA riga intera" } } } }) });
  c("errore della funzione → 500 generico, log col solo codice", [500, ["scambio XX003"], false], [gu.stato, gu.log, /PROVA|XX003/.test(JSON.stringify(gu.corpo))]);

  // ── resi_confermati ──
  const r1 = await esegui(imposta("resi_confermati", true, false));
  c("resi_confermati falso → vero: si può (lo attesta a mano il titolare), una riga di storico", [200, true, 1, true], [r1.stato, valoreDi(r1.db, "resi_confermati"), r1.db.tabelle.shop_storico.length, r1.corpo.cambiato]);
  c("…e indietro, vero → falso", [200, false], await esegui(imposta("resi_confermati", false, true), { tabelle: con(tabelle(), "resi_confermati", true) }).then((r) => [r.stato, valoreDi(r.db, "resi_confermati")]));
  c("…atteso vecchio → 409", [409, "conflitto"], await esegui(imposta("resi_confermati", true, true)).then((r) => [r.stato, r.corpo.motivo]));
  for (const [nome, v] of [["«true» (testo)", "true"], ["1", 1], ["nullo", null]]) {
    const r = await esegui(imposta("resi_confermati", v, false));
    c(`resi_confermati ${nome} → 400, nessuna chiamata`, [400, 0], [r.stato, r.db.chiamate]);
  }

  // ── pagamento_sicuro (D65) ──
  const ps = await esegui(imposta("pagamento_sicuro", true, false));
  c("pagamento_sicuro vero con `pagamentoIncassa` falso → 409 con la frase, niente scritto", [409, "cassa", false, true, 0], [ps.stato, ps.corpo.motivo, valoreDi(ps.db, "pagamento_sicuro"), /pagamento|rimbors/i.test(ps.corpo.frase), scambi(ps.db)]);
  const psn = await esegui(imposta("pagamento_sicuro", true, false), { porte: { fattiEsterni: () => ({ bannerPresente: true }) } });
  c("…e con il fatto non passato (non valutabile) → rifiutato lo stesso", [409, false], [psn.stato, valoreDi(psn.db, "pagamento_sicuro")]);
  const pso = await esegui(imposta("pagamento_sicuro", true, false), { porte: { fattiEsterni: FATTI_INCASSA } });
  c("dopo un ordine reale rimborsato (`pagamentoIncassa` vero) → accettato, una riga di storico", [200, true, 1], [pso.stato, valoreDi(pso.db, "pagamento_sicuro"), pso.db.tabelle.shop_storico.length]);
  let chiestiPs = 0;
  const psf = await esegui(imposta("pagamento_sicuro", false, true), { tabelle: con(tabelle(), "pagamento_sicuro", true), porte: { fattiEsterni: () => { chiestiPs++; return {}; } } });
  c("pagamento_sicuro falso si può sempre, senza chiedere i fatti", [200, false, 0], [psf.stato, valoreDi(psf.db, "pagamento_sicuro"), chiestiPs]);
  for (const [nome, v] of [["«true» (testo)", "true"], ["1", 1]]) {
    const r = await esegui(imposta("pagamento_sicuro", v, false), { porte: { fattiEsterni: FATTI_INCASSA } });
    c(`pagamento_sicuro ${nome} → 400, nessuna chiamata`, [400, 0], [r.stato, r.db.chiamate]);
  }

  // ── metodi_pagamento (D65) ──
  const m1 = await esegui(imposta("metodi_pagamento", ["carta", "paypal"], []));
  c("metodi_pagamento [] → [carta, paypal]: scritto, una riga di storico", [200, ["carta", "paypal"], 1], [m1.stato, valoreDi(m1.db, "metodi_pagamento"), m1.db.tabelle.shop_storico.length]);
  c("…tutti e cinque i valori ammessi, e poi di nuovo vuoto", [200, 5, 200, 0], await (async () => {
    const tutti = ["carta", "apple_pay", "google_pay", "paypal", "klarna"];
    const a = await esegui(imposta("metodi_pagamento", tutti, []));
    const b = await esegui(imposta("metodi_pagamento", [], tutti), { tabelle: con(tabelle(), "metodi_pagamento", tutti) });
    return [a.stato, valoreDi(a.db, "metodi_pagamento").length, b.stato, valoreDi(b.db, "metodi_pagamento").length];
  })());
  c("…l'atteso è l'elenco com'era: scritto in un altro ordine vale lo stesso (nessun falso conflitto)", [200, ["carta"]], await esegui(imposta("metodi_pagamento", ["carta"], ["paypal", "carta"]), { tabelle: con(tabelle(), "metodi_pagamento", ["carta", "paypal"]) }).then((r) => [r.stato, valoreDi(r.db, "metodi_pagamento")]));
  c("…atteso vecchio → 409 con l'elenco vero, niente scritto", [409, "conflitto", ["carta"], 0], await esegui(imposta("metodi_pagamento", ["paypal"], []), { tabelle: con(tabelle(), "metodi_pagamento", ["carta"]) }).then((r) => [r.stato, r.corpo.motivo, r.corpo.valore, r.db.scritture.length]));
  c("…stesso elenco (anche in un altro ordine) → «non cambiato», nessuna scrittura", [200, false, 0], await esegui(imposta("metodi_pagamento", ["paypal", "carta"], ["carta", "paypal"]), { tabelle: con(tabelle(), "metodi_pagamento", ["carta", "paypal"]) }).then((r) => [r.stato, r.corpo.cambiato, scambi(r.db)]));
  for (const [nome, v] of [["un metodo sconosciuto", ["carta", "bitcoin"]], ["un doppione", ["carta", "carta"]], ["un metodo con la maiuscola", ["Carta"]], ["un numero dentro", ["carta", 5]], ["non un elenco (testo)", "carta"], ["non un elenco (oggetto)", { carta: true }], ["nullo", null], ["più di cinque voci", ["carta", "apple_pay", "google_pay", "paypal", "klarna", "carta"]], ["un elenco di elenchi", [["carta"]]]]) {
    const r = await esegui(imposta("metodi_pagamento", v, []));
    c(`metodi_pagamento con ${nome} → 400, nessuna chiamata, niente scritto`, [400, 0, 0], [r.stato, r.db.chiamate, r.db.scritture.length]);
  }
  const am = await esegui(imposta("metodi_pagamento", ["carta"], ["boh"]));
  c("metodi_pagamento con l'atteso storto → 400", [400, 0], [am.stato, am.db.chiamate]);

  // ── le chiavi sono un elenco chiuso ──
  for (const k of ["constructor", "toString", "__proto__", "cassa", "Cassa_sito", "corrieri", "banner"]) {
    const r = await esegui(imposta(k, "stripe", "vecchia"));
    c(`chiave «${k}» → 400, nessuna chiamata`, [400, 0], [r.stato, r.db.chiamate]);
  }

  // ── GET ?cassa ──
  const l = await esegui("cassa", { get: true, tabelle: con(tabelle(), "metodi_pagamento", ["carta"]) });
  c("GET ?cassa: i quattro interruttori col valore, la versione e chi", [200, "vecchia", false, ["carta"], false, ISTANTE], [l.stato, l.corpo.interruttori?.cassa_sito?.valore, l.corpo.interruttori?.pagamento_sicuro?.valore, l.corpo.interruttori?.metodi_pagamento?.valore, l.corpo.interruttori?.resi_confermati?.valore, l.corpo.interruttori?.cassa_sito?.aggiornatoIl]);
  c("…le condizioni per accendere: quattro righe, tutte ok, `puoAccendere` vero; `pagamentoIncassa` falso → «sicuro» non si può accendere", [4, true, true, false], [l.corpo.condizioni?.righe?.length, l.corpo.condizioni?.puoAccendere, l.corpo.condizioni?.righe?.every((x) => x.ok), l.corpo.puoAccendereSicuro]);
  c("…solo letture", [], l.db.registro.filter((q) => q.op !== "select"));
  const l2 = await esegui("cassa", { get: true, porte: { fattiEsterni: FATTI_INCASSA } });
  c("…con `pagamentoIncassa` vero → «pagamento sicuro» si può accendere", true, l2.corpo.puoAccendereSicuro);
  const l3 = await esegui("cassa", { get: true, porte: { fattiEsterni: () => ({ ...FATTI_OK(), segretoPresente: false }) } });
  c("…con il segreto mancante → `puoAccendere` falso e la riga lo dice, ma lo stato arriva lo stesso", [200, false, ["segreto_webhook"]], [l3.stato, l3.corpo.condizioni?.puoAccendere, l3.corpo.condizioni?.righe?.filter((x) => !x.ok).map((x) => x.chiave)]);
  const l4 = await esegui("cassa", { get: true, porte: { fattiEsterni: () => { throw new Error("PROVA fatti rotti"); } } });
  c("…se i fatti non si leggono: 200, stato dell'interruttore presente, nessuna condizione vera, un avviso, il testo dell'errore non esce", [200, "vecchia", false, true, false, ["fatti"]], [l4.stato, l4.corpo.interruttori?.cassa_sito?.valore, l4.corpo.condizioni?.puoAccendere, typeof l4.corpo.condizioni?.avviso === "string", /PROVA/.test(JSON.stringify(l4.corpo)), l4.log]);
  const l5 = await esegui("cassa", { get: true, db: fintoDb({ tabelle: tabelle(), mancante: true }) });
  c("…con S1 non applicata → 409 «migrazione»", [409, "migrazione"], [l5.stato, l5.corpo.motivo]);
  const l6 = await esegui("cassa", { get: true, tabelle: tabelleProva() });
  c("…con S4 non applicata (i semi non ci sono) → 200, i valori sono `null`, nessuna eccezione", [200, null, null], [l6.stato, l6.corpo.interruttori?.cassa_sito?.valore, l6.corpo.interruttori?.pagamento_sicuro?.valore]);
  const l7 = await esegui("interruttori", { get: true });
  c("GET ?interruttori resta com'era in R1: solo `catalogo_sito` e `giacenza_bassa`, sette righe del cancello", [["catalogo_sito", "giacenza_bassa"], 7], [Object.keys(l7.corpo.interruttori), l7.corpo.condizioni?.righe?.length]);

  // ── le variabili d'ambiente non compaiono mai ──
  const F = mod["negozio/fatti.server"];
  const AMB = { STRIPE_SECRET_KEY: "sk_test_FINTA0123456789ABCDEF", STRIPE_WEBHOOK_SECRET: "whsec_FINTO0123456789ABCDEF" };
  const veri = async () => ({ bannerPresente: true, ...(await F.fattiDelDatabase(fintoDb({ tabelle: { shop_spedizioni_tariffe: [tariffaSeme()], shop_orders: [], shop_impostazioni: [] } }), AMB)) });
  const lv = await esegui("cassa", { get: true, porte: { fattiEsterni: veri } });
  const av = await esegui(imposta("cassa_sito", "stripe", "vecchia"), { porte: { fattiEsterni: veri } });
  const rif = await esegui(imposta("cassa_sito", "stripe", "vecchia"), { porte: { fattiEsterni: async () => ({ ...(await veri()), segretoPresente: false }) } });
  for (const [nome, r] of [["GET ?cassa", lv], ["accendere (riuscito)", av], ["accendere (rifiutato)", rif]])
    c(`${nome} con i fatti veri e un ambiente finto: nella risposta non c'è nessuna chiave (né sk_, né whsec_, né un pezzo)`, [false, false, false, false], [/sk_test|sk_live|rk_/.test(JSON.stringify(r.corpo)), /whsec/.test(JSON.stringify(r.corpo)), JSON.stringify(r.corpo).includes("FINT"), JSON.stringify(r.log).includes("FINT")]);
  c("…`GET ?cassa` dice solo «presente»: chiave e segreto veri, tariffa vera e S4 presente", [true, true, true], [lv.corpo.ambiente?.chiavePresente, lv.corpo.ambiente?.segretoPresente, lv.corpo.ambiente?.tariffaAttiva]);
  const intruso = await esegui("cassa", { get: true, porte: { fattiEsterni: () => ({ ...FATTI_OK(), STRIPE_SECRET_KEY: "sk_test_INTRUSA0000", segreto: "whsec_INTRUSO0000", chiave: "sk_live_INTRUSA" }) } });
  c("…anche se la porta per sbaglio passasse altri campi, la risposta li ignora (si copiano solo i booleani noti)", [false, true], [/INTRUS|sk_|whsec/.test(JSON.stringify(intruso.corpo)), Object.values(intruso.corpo.ambiente ?? {}).every((v) => typeof v === "boolean")]);

  // ── lo smistamento (T50 collegato) ──
  const amb = (opz = {}) => {
    const db = opz.db ?? fintoDb({ tabelle: opz.tabelle ?? tabelle({ shop_spedizioni_tariffe: [tariffaSeme()] }) });
    const conta = { guardia: 0, log: [] };
    const d = { guardia: async (r) => { conta.guardia++; return (opz.guardia ?? guardiaOk())(r); }, db, adesso: () => new Date("2026-11-20T12:00:00.000Z"), log: (x) => conta.log.push(x), chiaveServizio: () => "chiave-di-prova", fattiEsterni: opz.fattiEsterni ?? FATTI_OK };
    return { db, d, conta };
  };
  const POST = async (corpo, opz) => { const a = amb(opz); return { ...a, ...(await leggi(await S.gestisciPOST(post(corpo), a.d))) }; };
  const GET = async (q, opz) => { const a = amb(opz); return { ...a, ...(await leggi(await S.gestisciGET(get(q), a.d))) }; };
  const SP = mod["negozio/spedizioni.server"];
  const CHIAVI_SPED = [...SP.AZIONI_SPEDIZIONI];
  for (const stato of [401, 403]) {
    const esiti = [];
    for (const azione of [...CHIAVI_SPED, "interruttore_imposta"]) { const r = await POST({ azione }, { guardia: guardiaNo(stato) }); esiti.push([r.stato, r.db.chiamate, r.conta.guardia]); }
    for (const q of ["spedizioni", "cassa", "interruttori"]) { const r = await GET(q, { guardia: guardiaNo(stato) }); esiti.push([r.stato, r.db.chiamate, r.conta.guardia]); }
    c(`guardia negata (${stato}) su ${CHIAVI_SPED.length} azioni di spedizione, sull'interruttore e su ?spedizioni, ?cassa, ?interruttori: risposta della guardia, ZERO chiamate`, true, esiti.every(([s, ch, g]) => s === stato && ch === 0 && g === 1));
  }
  const gs = await GET("spedizioni");
  c("GET ?spedizioni → il modulo delle spedizioni (la tariffa del seme), guardia chiamata UNA volta", [200, true, 490, 1], [gs.stato, gs.corpo.ok, gs.corpo.tariffa?.costoCent, gs.conta.guardia]);
  const gc = await GET("cassa");
  c("GET ?cassa → il modulo degli interruttori (le condizioni della cassa)", [200, true, 4], [gc.stato, gc.corpo.ok, gc.corpo.condizioni?.righe?.length]);
  for (const azione of CHIAVI_SPED) {
    const r = await POST({ azione });
    c(`${azione}: arriva al modulo delle spedizioni (non è «azione sconosciuta» dei prodotti)`, true, r.corpo.motivo !== "azione_sconosciuta" && r.corpo.frase !== "Questa azione non esiste.");
  }
  const conf = await POST({ azione: "tariffa_conferma", id: ID_TARIFFA_SEME, atteso: ISTANTE });
  c("tariffa_conferma passa dallo smistamento: la funzione SQL toglie `provvisoria`", [200, true, ["shop_tariffa_imposta"]], [conf.stato, conf.corpo.ok, conf.db.registro.filter((q) => q.op === "rpc").map((q) => q.nome)]);
  const ic = await POST({ azione: "interruttore_imposta", chiave: "cassa_sito", valore: "stripe", atteso: "vecchia" });
  c("interruttore_imposta cassa_sito passa dallo smistamento e arriva ai fatti collegati", [200, "stripe"], [ic.stato, valoreDi(ic.db, "cassa_sito")]);
  const icn = await POST({ azione: "interruttore_imposta", chiave: "cassa_sito", valore: "stripe", atteso: "vecchia" }, { fattiEsterni: () => ({ bannerPresente: true }) });
  c("…con i fatti della cassa non passati lo smistamento rifiuta (la porta è quella vera, non un ripiego)", [409, "vecchia"], [icn.stato, valoreDi(icn.db, "cassa_sito")]);
  for (const nome of ["constructor", "toString", "__proto__", "tariffa_boh"]) {
    const r = await POST({ azione: nome });
    c(`azione «${nome}» → 400, database mai toccato`, [400, 0], [r.stato, r.db.chiamate]);
  }
  const tutte = [...mod["negozio/prodotti.server"].AZIONI_PRODOTTI, ...mod["negozio/giacenza.server"].AZIONI_GIACENZA, ...mod["negozio/categorie.server"].AZIONI_CATEGORIE, ...I.AZIONI_INTERRUTTORI, ...CHIAVI_SPED];
  c("nessuna azione compare in due moduli (nemmeno con le spedizioni)", [], [...new Map(tutte.map((a) => [a, tutte.filter((x) => x === a).length])).entries()].filter(([, n]) => n > 1).map(([a]) => a));
  c("`AZIONI_NEGOZIO` (R1) resta l'unione dei quattro moduli del CMS: la prova di R1 non cambia", [...mod["negozio/prodotti.server"].AZIONI_PRODOTTI, ...mod["negozio/giacenza.server"].AZIONI_GIACENZA, ...mod["negozio/categorie.server"].AZIONI_CATEGORIE, ...I.AZIONI_INTERRUTTORI].sort(), [...S.AZIONI_NEGOZIO].sort());
  c("…e le azioni di spedizione sono in un elenco loro, esportato dallo smistamento", CHIAVI_SPED.slice().sort(), [...(S.AZIONI_SPEDIZIONI_ROTTA ?? [])].sort());

  // ── i sorgenti ──
  const togli = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const sorg = togli(readFileSync(join(radice, "src/crm/negozio/interruttori.server.ts"), "utf8"));
  c("interruttori.server.ts non scrive mai direttamente e passa da shop_impostazione_imposta", [[], true], [[".insert(", ".update(", ".upsert(", ".delete("].filter((x) => sorg.includes(x)), sorg.includes("shop_impostazione_imposta")]);
  c("…non legge l'ambiente (`process.env`) né stampa", [false, false], [/process\.env|import\.meta\.env/.test(sorg), /console\./.test(sorg)]);
  const sm = togli(readFileSync(join(radice, "src/crm/negozio/smista.server.ts"), "utf8"));
  c("smista.server.ts collega `AZIONI_SPEDIZIONI` e le letture `spedizioni` e `cassa`", [true, true, true], [sm.includes("AZIONI_SPEDIZIONI"), /\bspedizioni\b/.test(sm), /\bcassa\b/.test(sm)]);
}
