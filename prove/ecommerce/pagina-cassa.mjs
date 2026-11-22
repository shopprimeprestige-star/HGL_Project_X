/** ── E-COMMERCE · R2 · T62 · IL GUSCIO DEL CRM: NASTRO «PROVA», SCHEDA «CASSA», SEGNAPOSTO ──
 *  `src/crm/ecommerce/pagina-r2.ts` (puro: indirizzo `?scheda=cassa|spedizioni|email`, le chiamate a `/api/crm/stripe` e a
 *  `/api/crm/negozio?cassa`, le frasi), `cassa/PannelloCassa.tsx` (D59, D65), i due segnaposto di T65 e T66 e il guscio
 *  `src/routes/CRM.ecommerce.tsx`. Regole (PIANO-R2 T62, D56, D58, D59, D65, SPEC 7.2 e 7.4 n. 8-9):
 *   · `?scheda=cassa|spedizioni|email` valido; un valore sconosciuto apre le schede di prima (Panoramica); `leggiRicerca` non cambia;
 *   · la chiave di Stripe non compare in nessun file di UI e nessuna risposta del server la porta fino a schermo (solo «prova/reale»);
 *   · la pagina fa UNA lettura leggera dello stato (GET, che non chiama Stripe: ricava prova/reale dal prefisso della chiave) per il nastro; «Prova adesso»
 *     (POST, chiama Stripe) e la lettura della cassa partono SOLO aprendo «Cassa»;
 *   · il nastro «PROVA: nessun pagamento è reale» sta in cima a ogni scheda, solo se Stripe dice «prova»; se la lettura fallisce niente nastro e nessun errore;
 *   · l'interruttore `stripe` è spento con la frase di ogni condizione mancante; «Pagamento sicuro» spento con la sua frase;
 *   · «Elimina» non esiste; Panoramica e Ordini si comportano come prima (la prova di T11 resta verde).
 *  La rotta di Stripe è di T57 e qui non esiste: si prova con una PORTA FINTA che risponde come dice §3.5; l'accordo con la rotta
 *  vera lo prova T68. Il lato di T56 (`GET ?cassa`, i rifiuti) si prova col SERVER VERO di T56 e il suo database finto. */
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { join } from "node:path";
import { build } from "esbuild";
import { fintoDb } from "../negozio/_finto-db.mjs";
import { tabelleProva } from "../negozio/dati.mjs";
import { porte, get, post, leggi } from "../negozio/_server.mjs";

const ISTANTE = "2026-11-20T10:00:00.000Z";
const imp = (chiave, valore) => ({ chiave, valore, aggiornato_il: ISTANTE, aggiornato_da: null });
/** Una chiave di Stripe inventata, scritta a pezzi: nemmeno la prova la porta intera nel repo. */
const CHIAVE_FINTA = ["sk", "test", "FINTA0123456789"].join("_");

export async function prove(mod, { c, gruppo, radice }) {
  const R2 = mod["ecommerce/pagina-r2"] ?? {};
  const PG = mod["ecommerce/pagina"];
  const I = mod["negozio/interruttori.server"];
  const leggiFile = (f) => readFileSync(join(radice, f), "utf8");
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/.*$/gm, "");
  /** Una funzione di `pagina-r2` che non c'è fa rosso la prova, non la fa crollare. */
  const fn = (nome) => (typeof R2[nome] === "function" ? R2[nome] : () => `«${nome}» non esiste`);

  gruppo("E-COMMERCE · R2 · T62 · GUSCIO DEL CRM, SCHEDA «CASSA» (21/11/2026)");
  c("pagina-r2.ts esiste e dice le tre schede nuove", ["cassa", "spedizioni", "email"], R2.SCHEDE_R2 ?? null);

  // ── l'indirizzo ──
  const ric = fn("leggiRicercaEstesa");
  c("?scheda=cassa, spedizioni, email: valide", [{ scheda: "cassa" }, { scheda: "spedizioni" }, { scheda: "email" }], ["cassa", "spedizioni", "email"].map((scheda) => ric({ scheda })));
  c("un valore sconosciuto apre la Panoramica (indirizzo pulito)", [{}, {}, {}], [ric({ scheda: "casa" }), ric({ scheda: 7 }), ric({})]);
  c("«ordini» con lo stato resta com'era: `leggiRicerca` non è cambiata", { scheda: "ordini", stato: "nuovo" }, ric({ scheda: "ordini", stato: "nuovo" }));
  c("«leggiRicerca» di T11 non conosce le schede nuove (non è stata toccata)", [{}, {}], [PG.leggiRicerca({ scheda: "cassa" }), PG.leggiRicerca({ scheda: "email" })]);
  c("sulle schede nuove niente stato né ordine: l'indirizzo resta pulito", { scheda: "cassa" }, ric({ scheda: "cassa", stato: "nuovo", ordine: "x" }));

  // ── la porta finta: contratto di §3.5 ──
  /** Una `fetch` finta: registra le chiamate e risponde con quello che le si dice per ogni indirizzo. */
  const porta = (risposte) => {
    const chiamate = [];
    const f = async (url, init = {}) => {
      chiamate.push({ url, metodo: init.method ?? "GET", corpo: init.body ? JSON.parse(init.body) : null, init });
      const r = risposte[`${init.method ?? "GET"} ${url}`] ?? risposte[url];
      if (r instanceof Error) throw r;
      if (!r) throw new Error("indirizzo non previsto");
      return new Response(JSON.stringify(r.corpo), { status: r.stato ?? 200, headers: { "Content-Type": "application/json" } });
    };
    return { f, chiamate };
  };
  const STRIPE_PROVA = { corpo: { ok: true, collegato: true, modalita: "prova", chiave: CHIAVE_FINTA, ultimoWebhook: { tipo: "checkout.session.completed", ricevutoIl: ISTANTE } } };
  const STRIPE_REALE = { corpo: { ok: true, collegato: true, modalita: "reale", ultimoWebhook: null } };
  const STRIPE_NO = { corpo: { ok: true, collegato: false, modalita: null } };

  c("gli indirizzi sono quelli di §3.5", ["/api/crm/stripe", "/api/crm/negozio?cassa"], [R2.urlStripe, R2.urlCassa]);

  const a = porta({ "/api/crm/stripe": STRIPE_PROVA });
  const s1 = await fn("caricaStripe")(a.f);
  c("leggere Stripe è UNA richiesta GET a /api/crm/stripe", [1, "GET", "/api/crm/stripe"], [a.chiamate.length, a.chiamate[0]?.metodo, a.chiamate[0]?.url]);
  c("lo stato: collegato, prova, ultimo webhook", [true, true, "prova", "checkout.session.completed"], [s1.ok, s1.stripe?.collegato, s1.stripe?.modalita, s1.stripe?.ultimoWebhook?.tipo]);
  c("la chiave che un server sbadato mandasse NON arriva allo stato (si copiano solo i campi noti)", false, JSON.stringify(s1).includes(CHIAVE_FINTA) || JSON.stringify(s1).includes("sk_"));
  const sReale = await fn("caricaStripe")(porta({ "/api/crm/stripe": STRIPE_REALE }).f);
  const sNo = await fn("caricaStripe")(porta({ "/api/crm/stripe": STRIPE_NO }).f);
  c("«reale» e «non collegato» si leggono", ["reale", null, false, null], [sReale.stripe?.modalita, sReale.stripe?.ultimoWebhook, sNo.stripe?.collegato, sNo.stripe?.modalita]);
  c("una modalità che non è prova né reale vale «null» (nel dubbio nessun nastro e nessuna frase falsa)", [null, null], ["strana", 7].map((m) => fn("leggiStripe")({ collegato: true, modalita: m })?.modalita ?? null));
  c("non collegato: nessuna modalità anche se il server ne manda una", null, fn("leggiStripe")({ collegato: false, modalita: "prova" })?.modalita);

  c("il nastro compare solo con «collegato» e «prova»", [true, false, false, false, false], [
    fn("mostraNastro")(s1.stripe), fn("mostraNastro")(sReale.stripe), fn("mostraNastro")(sNo.stripe), fn("mostraNastro")(null), fn("mostraNastro")(undefined),
  ]);

  // ── gli errori, in frasi ──
  const e403 = await fn("caricaStripe")(porta({ "/api/crm/stripe": { stato: 403, corpo: { ok: false } } }).f);
  const e401 = await fn("caricaStripe")(porta({ "/api/crm/stripe": { stato: 401, corpo: { ok: false } } }).f);
  const eRete = await fn("caricaStripe")(porta({ "/api/crm/stripe": new Error(`impossibile raggiungere /api/crm/stripe con ${CHIAVE_FINTA}`) }).f);
  const e500 = await fn("caricaStripe")(porta({ "/api/crm/stripe": { stato: 500, corpo: { ok: false, motivo: "interno", frase: "Il database non ha risposto: riprova tra un momento." } } }).f);
  c("403 → «permesso», 401 → «sessione», rete caduta → «rete», 500 → la frase del server", ["permesso", "sessione", "rete", "server", "Il database non ha risposto: riprova tra un momento."], [e403.tipo, e401.tipo, eRete.tipo, e500.tipo, e500.messaggio]);
  c("ogni errore ha una frase in italiano e non ripete il testo del browser (potrebbe nominare indirizzo o chiave)", [true, false], [[e403, e401, eRete, e500].every((e) => e.ok === false && typeof e.messaggio === "string" && e.messaggio.length > 10), eRete.messaggio?.includes("sk_") || eRete.messaggio?.includes("/api")]);

  // ── il nastro su ogni scheda: UNA lettura leggera all'apertura della pagina (GET: non chiama Stripe) ──
  const nastro = async (risposta) => {
    const g = porta({ "/api/crm/stripe": risposta });
    return { stato: await fn("leggiNastro")(g.f), chiamate: g.chiamate };
  };
  const nProva = await nastro(STRIPE_PROVA);
  c("`leggiNastro`: UNA GET a /api/crm/stripe, mai un POST, e lo stato (il nastro lo accende)", [1, "GET", "prova", true], [nProva.chiamate.length, nProva.chiamate[0]?.metodo, nProva.stato?.modalita, fn("mostraNastro")(nProva.stato)]);
  const nReale = await nastro(STRIPE_REALE);
  c("con la chiave reale lo stato arriva, ma il nastro no", [true, false], [nReale.stato?.collegato, fn("mostraNastro")(nReale.stato)]);
  const guasti = [
    (await nastro({ stato: 403, corpo: { ok: false } })).stato,
    (await nastro({ stato: 401, corpo: { ok: false } })).stato,
    (await nastro({ stato: 500, corpo: { ok: false, frase: "Errore." } })).stato,
    (await nastro({ corpo: { ok: true, strano: 1 } })).stato,
    await fn("leggiNastro")(porta({ "/api/crm/stripe": new Error("giù") }).f),
  ];
  c("lettura fallita, permesso mancante, risposta strana, rete caduta: «null», cioè niente nastro e nessun errore (non lancia)", [null, null, null, null, null], guasti);

  // ── nota 2 del revisore: una chiave dentro una FRASE del server non arriva né allo stato né a schermo ──
  const SK = ["sk", "live", "ABCDEF0123456789"].join("_");
  const WH = ["whsec", "ABCDEF0123456789"].join("_");
  const JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc";
  const fs = fn("fraseSicura");
  c("`fraseSicura`: scarta chi somiglia a una chiave (sk_, rk_, pk_, whsec_, eyJ…) e usa il ripiego; il resto passa uguale", ["ripiego", "ripiego", "ripiego", "ripiego", "ripiego", "Manca la chiave di Stripe: va messa fra le variabili.", "Il risk_live_ non conta"], [
    fs(`Stripe dice ${SK}`, "ripiego"), fs(`rk_test_ABCDEF0123456789`, "ripiego"), fs(`pk_live_ABCDEF0123456789`, "ripiego"), fs(`segreto ${WH}`, "ripiego"), fs(`token ${JWT}`, "ripiego"),
    fs("Manca la chiave di Stripe: va messa fra le variabili.", "ripiego"), fs("Il risk_live_ non conta", "ripiego"),
  ]);
  const pK = await fn("provaAdesso")(porta({ "POST /api/crm/stripe": { corpo: { ok: true, frase: `Funziona con ${SK}` } } }).f);
  c("«Prova adesso» con una chiave nella frase: ok, ma la frase è quella di ripiego", [true, false, true], [pK.ok, JSON.stringify(pK).includes("sk_"), typeof pK.frase === "string" && pK.frase.length > 10]);
  const eK = await fn("provaAdesso")(porta({ "POST /api/crm/stripe": { stato: 409, corpo: { ok: false, motivo: "non_collegato", frase: `Chiave ${WH} non valida` } } }).f);
  const eK2 = await fn("caricaStripe")(porta({ "/api/crm/stripe": { stato: 500, corpo: { ok: false, frase: `Errore ${SK}` } } }).f);
  c("errori con una chiave nella frase: ok false e frase di ripiego, mai la chiave", [false, false, false, true, true], [eK.ok, /whsec_/.test(JSON.stringify(eK)), /sk_/.test(JSON.stringify(eK2)), eK.messaggio?.length > 10, eK2.messaggio?.length > 10]);
  const cK = await fn("caricaCassa")(porta({ "/api/crm/negozio?cassa": { corpo: { ok: true, interruttori: { cassa_sito: { valore: "vecchia" } }, condizioni: { puoAccendere: false, avviso: `Avviso ${WH}`, righe: [{ chiave: "tariffa", ok: false, frase: `Manca ${SK}` }, { chiave: "chiave_stripe", ok: true, frase: "Collegata." }] }, puoAccendereSicuro: false } } }).f);
  c("righe e avviso della cassa con una chiave: la riga resta (con il ripiego), la frase buona passa, nessuna chiave nello stato", [2, "Collegata.", false], [cK.cassa?.righe?.length, cK.cassa?.righe?.[1]?.frase, /sk_|whsec_/.test(JSON.stringify(cK))]);
  const rK = await fn("impostaCassa")(porta({ "POST /api/crm/negozio": { stato: 409, corpo: { ok: false, motivo: "cassa", frase: `No ${SK}`, condizioni: { puoAccendere: false, righe: [{ chiave: "tariffa", ok: false, frase: `Manca ${WH}` }] } } } }).f, "cassa_sito", "stripe", "vecchia");
  c("rifiuto con la chiave nella frase e nelle righe: nessuna chiave nell'errore", false, /sk_|whsec_/.test(JSON.stringify(rK)));

  // ── «Prova adesso» ──
  const p = porta({ "POST /api/crm/stripe": { corpo: { ok: true, collegato: true, modalita: "prova", frase: "Stripe risponde: la chiave funziona." } } });
  const pr = await fn("provaAdesso")(p.f);
  c("«Prova adesso» è UN POST a /api/crm/stripe, in JSON", [1, "POST", "/api/crm/stripe", "application/json"], [p.chiamate.length, p.chiamate[0]?.metodo, p.chiamate[0]?.url, p.chiamate[0]?.init?.headers?.["Content-Type"]]);
  c("…e porta la frase del server", [true, "Stripe risponde: la chiave funziona."], [pr.ok, pr.frase]);
  const pNo = await fn("provaAdesso")(porta({ "POST /api/crm/stripe": { stato: 409, corpo: { ok: false, motivo: "non_collegato", frase: "Stripe non è collegato: manca la chiave." } } }).f);
  c("senza chiave la risposta è «non collegato», con la sua frase", [false, "Stripe non è collegato: manca la chiave."], [pNo.ok, pNo.messaggio]);

  // ── l'interruttore e il server vero di T56 ──
  const tab = (extra = {}) => {
    const t = tabelleProva();
    t.shop_impostazioni.push(imp("cassa_sito", "vecchia"), imp("pagamento_sicuro", false), imp("metodi_pagamento", ["carta"]), imp("resi_confermati", false));
    return { ...t, ...extra };
  };
  const fatti = (extra = {}) => () => ({ bannerPresente: true, chiavePresente: true, segretoPresente: true, tariffaAttiva: true, s4Presente: true, pagamentoIncassa: false, ...extra });
  /** La `fetch` della pagina collegata al SERVER VERO di T56 (guardia aperta, database finto). */
  const portaServer = (opz = {}) => {
    const db = fintoDb({ tabelle: opz.tabelle ?? tab() });
    const chiamate = [];
    const f = async (url, init = {}) => {
      chiamate.push({ url, metodo: init.method ?? "GET", corpo: init.body ? JSON.parse(init.body) : null });
      const { d } = porte({ db, fattiEsterni: opz.fatti ?? fatti() });
      const q = url.split("?")[1] ?? "";
      return init.method === "POST" ? I.gestisciPOST(new Request(`https://sito.test${url}`, { method: "POST", headers: { "content-type": "application/json" }, body: init.body }), d) : I.gestisciGET(get(q), d);
    };
    return { f, db, chiamate };
  };
  const ok = portaServer();
  const k = await fn("caricaCassa")(ok.f);
  c("leggere la cassa è UNA GET a /api/crm/negozio?cassa", [1, "GET", "/api/crm/negozio?cassa"], [ok.chiamate.length, ok.chiamate[0]?.metodo, ok.chiamate[0]?.url]);
  c("dal server vero: «vecchia», sicuro spento, un metodo, 4 condizioni tutte a posto e «si può accendere»", ["vecchia", false, ["carta"], 4, true, true], [k.cassa?.valore, k.cassa?.sicuro, k.cassa?.metodi, k.cassa?.righe?.length, k.cassa?.puoAccendere, k.cassa?.righe?.every((r) => r.ok)]);
  c("…e «pagamento sicuro» NON si può accendere (nessun pagamento reale rimborsato)", false, k.cassa?.puoAccendereSicuro);
  const manca = portaServer({ fatti: fatti({ chiavePresente: false, tariffaAttiva: false }) });
  const km = await fn("caricaCassa")(manca.f);
  c("con chiave e tariffa mancanti: due righe «no», ognuna con la sua frase, e non si può accendere", [2, false, true, true], [
    km.cassa?.righe?.filter((r) => !r.ok).length, km.cassa?.puoAccendere, /chiave/i.test(km.cassa?.righe?.find((r) => r.chiave === "chiave_stripe")?.frase ?? ""), /tariffa/i.test(km.cassa?.righe?.find((r) => r.chiave === "tariffa")?.frase ?? ""),
  ]);
  c("le variabili d'ambiente non arrivano allo stato: nessun valore, solo le frasi", false, /sk_|whsec_|STRIPE_/.test(JSON.stringify(km)));
  const kSenzaSeme = await fn("caricaCassa")(portaServer({ tabelle: tabelleProva() }).f);
  c("senza i semi dei pagamenti (S4 non applicata) il valore è «null»: l'interruttore non si può girare", [true, null, false], [kSenzaSeme.ok, kSenzaSeme.cassa?.valore ?? null, kSenzaSeme.cassa?.puoAccendere ?? false]);

  // ── il cambio: vecchia ⇄ stripe ──
  const acc = portaServer();
  const ra = await fn("impostaCassa")(acc.f, "cassa_sito", "stripe", "vecchia");
  c("accendere Stripe: POST /api/crm/negozio con azione, chiave, valore e il valore che si vedeva (`atteso`)", [1, "POST", "/api/crm/negozio", { azione: "interruttore_imposta", chiave: "cassa_sito", valore: "stripe", atteso: "vecchia" }], [acc.chiamate.length, acc.chiamate[0]?.metodo, acc.chiamate[0]?.url, acc.chiamate[0]?.corpo]);
  c("…riuscito, e nel database ora c'è «stripe» minuscolo", [true, "stripe"], [ra.ok, acc.db.tabelle.shop_impostazioni.find((r) => r.chiave === "cassa_sito")?.valore]);
  const rif = portaServer({ fatti: fatti({ segretoPresente: false }) });
  const rr = await fn("impostaCassa")(rif.f, "cassa_sito", "stripe", "vecchia");
  c("rifiutato dal server (manca il segreto): non è un errore generico, porta la frase e le righe", [false, "rifiutato", true, 4], [rr.ok, rr.tipo, /segreto/i.test(rr.messaggio ?? ""), rr.condizioni?.righe?.length]);
  const vec = portaServer({ tabelle: tab({ shop_impostazioni: tab().shop_impostazioni.map((r) => (r.chiave === "cassa_sito" ? { ...r, valore: "stripe" } : r)) }), fatti: fatti({ chiavePresente: false }) });
  const rv = await fn("impostaCassa")(vec.f, "cassa_sito", "vecchia", "stripe");
  c("tornare a «vecchia» riesce SEMPRE, anche con le condizioni cadute", [true, "vecchia"], [rv.ok, vec.db.tabelle.shop_impostazioni.find((r) => r.chiave === "cassa_sito")?.valore]);
  const cf = portaServer();
  const rc = await fn("impostaCassa")(cf.f, "cassa_sito", "stripe", "stripe"); // io credevo fosse già «stripe»: nel database è «vecchia»
  c("valore visto vecchio: «conflitto» col valore vero, la pagina rilegge (nessun secondo invio da sola)", [false, "conflitto", "vecchia", 1], [rc.ok, rc.tipo, rc.valore, cf.chiamate.length]);
  const sic = portaServer();
  const rs = await fn("impostaCassa")(sic.f, "pagamento_sicuro", true, false);
  c("«Pagamento sicuro» acceso senza un pagamento reale rimborsato: rifiutato dal server con la sua frase (e nessuna scrittura)", [false, "rifiutato", true, false], [rs.ok, rs.tipo, /rimborsat/i.test(rs.messaggio ?? ""), sic.db.tabelle.shop_impostazioni.find((r) => r.chiave === "pagamento_sicuro")?.valore]);
  const sic2 = portaServer({ fatti: fatti({ pagamentoIncassa: true }) });
  const rs2 = await fn("impostaCassa")(sic2.f, "pagamento_sicuro", true, false);
  c("…dopo un pagamento reale rimborsato si accende", [true, true], [rs2.ok, sic2.db.tabelle.shop_impostazioni.find((r) => r.chiave === "pagamento_sicuro")?.valore]);
  const mt = portaServer();
  const rm = await fn("impostaCassa")(mt.f, "metodi_pagamento", ["carta", "paypal"], ["carta"]);
  c("i metodi si salvano come elenco", [true, ["carta", "paypal"]], [rm.ok, mt.db.tabelle.shop_impostazioni.find((r) => r.chiave === "metodi_pagamento")?.valore]);
  const vietati = portaServer();
  const nulla = [
    await fn("impostaCassa")(vietati.f, "catalogo_sito", "cms", "codice"), // è dello shop, non della cassa
    await fn("impostaCassa")(vietati.f, "cassa_sito", "Stripe", "vecchia"),
    await fn("impostaCassa")(vietati.f, "cassa_sito", "stripe", undefined),
    await fn("impostaCassa")(vietati.f, "metodi_pagamento", ["bonifico"], []),
    await fn("impostaCassa")(vietati.f, "metodi_pagamento", ["carta", "carta"], []),
    await fn("impostaCassa")(vietati.f, "pagamento_sicuro", "si", false),
  ];
  c("chiavi o valori che la cassa non conosce non partono nemmeno: zero richieste", [false, 0], [nulla.some((x) => x.ok), vietati.chiamate.length]);
  const e403i = await fn("impostaCassa")(porta({ "POST /api/crm/negozio": { stato: 403, corpo: { ok: false } } }).f, "cassa_sito", "vecchia", "stripe");
  c("senza permesso (403): «permesso»", "permesso", e403i.tipo);
  const eRete2 = await fn("impostaCassa")(porta({ "POST /api/crm/negozio": new Error("giù") }).f, "cassa_sito", "stripe", "vecchia");
  c("rete caduta a metà: dice che non sa se è stato scritto (può esserlo)", ["rete", true], [eRete2.tipo, /non so|controlla/i.test(eRete2.messaggio ?? "")]);

  // ── metodi, webhook, eventi ──
  c("i cinque metodi, con la loro etichetta", ["carta", "apple_pay", "google_pay", "paypal", "klarna"], (R2.METODI_PAGAMENTO ?? []).map((m) => m.chiave));
  c("accendere un metodo lo aggiunge nell'ordine fisso, senza doppioni; spegnerlo lo toglie", [["carta", "paypal"], ["carta", "paypal"], ["paypal"]], [
    fn("metodiDopoCambio")(["paypal"], "carta", true), fn("metodiDopoCambio")(["carta", "paypal"], "carta", true), fn("metodiDopoCambio")(["carta", "paypal"], "carta", false),
  ]);
  c("l'indirizzo del webhook da incollare in Stripe", ["https://hairgenius.it/api/public/stripe-webhook", "https://hairgenius.it/api/public/stripe-webhook", ""], [
    fn("indirizzoWebhook")("https://hairgenius.it"), fn("indirizzoWebhook")("https://hairgenius.it/"), fn("indirizzoWebhook")(""),
  ]);
  c("gli otto eventi da spuntare in Stripe sono quelli che il webhook gestisce", [
    "charge.dispute.created", "charge.refunded", "checkout.session.async_payment_failed", "checkout.session.async_payment_succeeded", "checkout.session.completed", "checkout.session.expired", "refund.failed", "refund.updated",
  ], [...(R2.EVENTI_STRIPE ?? [])].sort());

  // ── le schermate, disegnate sul serio ──
  const dove = mkdtempSync(join(tmpdir(), "pagina-cassa-"));
  try {
    const req = createRequire(join(radice, "package.json"));
    const reactDelProgetto = { name: "react-del-progetto", setup(b) {
      b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (x) => ({ path: req.resolve(x.path), external: true }));
    } };
    const tsx = async (entrata, nome) => {
      try {
        await build({ entryPoints: [join(radice, entrata)], bundle: true, platform: "node", format: "cjs", outfile: join(dove, `${nome}.cjs`),
          loader: { ".tsx": "tsx", ".png": "dataurl", ".jpg": "dataurl", ".svg": "dataurl", ".webp": "dataurl" }, alias: { "@": join(radice, "src") },
          plugins: [reactDelProgetto], logLevel: "silent", jsx: "automatic" });
        return createRequire(import.meta.url)(join(dove, `${nome}.cjs`));
      } catch (e) {
        return { __errore: String(e?.message ?? e).split("\n")[0] };
      }
    };
    const { createElement: h } = req("react");
    const { renderToStaticMarkup } = req("react-dom/server");
    const testo = (x) => x.replace(/<[^>]*>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
    /** L'etichetta del controllo `aria-label` → il suo tag (per guardare `disabled` e `aria-checked`). */
    const tag = (html, etichetta) => html.match(new RegExp(`<(?:button|input)[^>]*aria-label="${etichetta}"[^>]*>`))?.[0] ?? "";
    const spento = (t) => /\sdisabled(=|\s|>)/.test(t);
    const acceso = (t) => /aria-checked="true"/.test(t) || /\schecked(=|\s|>)/.test(t);

    const Pannello = await tsx("src/crm/ecommerce/cassa/PannelloCassa.tsx", "pannello");
    c("PannelloCassa.tsx si compila e porta VistaCassa, PannelloCassa e NastroProva", [true, true, true], ["VistaCassa", "PannelloCassa", "NastroProva"].map((n) => typeof Pannello[n] === "function"));
    if (Pannello.__errore) c("PannelloCassa.tsx: l'errore di compilazione", "nessuno", Pannello.__errore);

    const base = (extra = {}) => ({
      stripe: s1.stripe, erroreStripe: null, cassa: km.cassa, erroreCassa: null, lavoro: null, esito: null,
      indirizzo: "https://hairgenius.it/api/public/stripe-webhook", copiato: false, provaEsito: null,
      onProva: () => {}, onCassa: () => {}, onSicuro: () => {}, onMetodo: () => {}, onCopia: () => {}, onRiprova: () => {},
      ...extra,
    });
    const vista = (extra) => (typeof Pannello.VistaCassa === "function" ? renderToStaticMarkup(h(Pannello.VistaCassa, base(extra))) : "");

    c("il nastro dice proprio «PROVA: nessun pagamento è reale»", true, typeof Pannello.NastroProva === "function" && testo(renderToStaticMarkup(h(Pannello.NastroProva))).includes("PROVA: nessun pagamento è reale"));

    const html = vista();
    const vProva = testo(html);
    const vReale = testo(vista({ stripe: sReale.stripe }));
    const vNo = testo(vista({ stripe: sNo.stripe }));
    c("stato: «Stripe collegato · PROVA», «· REALE», «non collegato»", [true, true, true], [/Stripe collegato · PROVA/.test(vProva), /Stripe collegato · REALE/.test(vReale), /Stripe non è collegato/i.test(vNo)]);
    c("il pannello non mostra mai la chiave né una variabile", false, /sk_|rk_|whsec_|STRIPE_(SECRET|WEBHOOK)/.test(vista() + vista({ stripe: sReale.stripe }) + vista({ stripe: sNo.stripe })));
    c("«Prova adesso» c'è, «Copia» c'è, l'indirizzo del webhook è scritto", [true, true, true], [/Prova adesso/.test(vProva), /Copia/.test(vProva), html.includes('value="https://hairgenius.it/api/public/stripe-webhook"')]);
    c("ultimo webhook: il tipo e «nessuno ancora» quando non c'è", [true, true], [vProva.includes("checkout.session.completed"), /Nessun webhook ricevuto/i.test(vReale)]);
    c("tutti gli otto eventi da spuntare sono elencati", true, (R2.EVENTI_STRIPE ?? ["x"]).every((ev) => vProva.includes(ev)));
    c("«Prova adesso» dice il suo esito (frase del server)", true, testo(vista({ provaEsito: { ok: true, frase: "Stripe risponde: la chiave funziona." } })).includes("Stripe risponde: la chiave funziona."));

    const swCassa = tag(html, "Usa la cassa Stripe");
    c("cassa «vecchia» con due condizioni mancanti: l'interruttore Stripe è SPENTO", [true, false], [spento(swCassa), acceso(swCassa)]);
    c("…e le due frasi si leggono (chiave e tariffa), quelle a posto restano visibili come «a posto»", [true, true, true], [/Manca la chiave di Stripe/.test(vProva), /Manca una tariffa di spedizione attiva/.test(vProva), /Il segreto del webhook di Stripe è collegato/.test(vProva)]);
    const vTutto = vista({ cassa: k.cassa });
    c("con le quattro condizioni a posto l'interruttore si può girare", false, spento(tag(vTutto, "Usa la cassa Stripe")));
    const vAttiva = vista({ cassa: { ...km.cassa, valore: "stripe" } });
    c("con la cassa già su Stripe l'interruttore è acceso e si può SEMPRE spegnere", [true, false], [acceso(tag(vAttiva, "Usa la cassa Stripe")), spento(tag(vAttiva, "Usa la cassa Stripe"))]);
    c("senza i semi (valore «null») è spento e dice di applicare l'aggiornamento dei pagamenti", [true, true], [spento(tag(vista({ cassa: kSenzaSeme.cassa }), "Usa la cassa Stripe")), /aggiornamento|S4/i.test(testo(vista({ cassa: kSenzaSeme.cassa })))]);
    c("avverte che la cassa nuova lavora solo con lo shop aperto al pubblico (D56)", true, /shop (è )?aperto al pubblico/i.test(vProva));

    const swSicuro = tag(html, "Mostra «Pagamento sicuro» sul sito");
    c("«Pagamento sicuro» è SPENTO finché non c'è un pagamento reale rimborsato, e lo dice", [true, true], [spento(swSicuro), /pagamento reale[^.]*rimborsat/i.test(vProva)]);
    const vSicuroOk = vista({ cassa: { ...k.cassa, puoAccendereSicuro: true } });
    c("dopo il pagamento reale rimborsato si può accendere", false, spento(tag(vSicuroOk, "Mostra «Pagamento sicuro» sul sito")));
    const vSicuroAcceso = vista({ cassa: { ...km.cassa, sicuro: true, puoAccendereSicuro: false } });
    c("se è già acceso si può spegnere anche quando il fatto non c'è più", [true, false], [acceso(tag(vSicuroAcceso, "Mostra «Pagamento sicuro» sul sito")), spento(tag(vSicuroAcceso, "Mostra «Pagamento sicuro» sul sito"))]);

    // nota 3: l'esito sta DENTRO il riquadro dell'interruttore che si è girato, non in fondo alla pagina
    const pos = (t, x) => t.indexOf(x);
    const T = (extra) => testo(vista(extra));
    const hWeb = "Il webhook da collegare in Stripe", hCassa = "Cassa del sito", hSicuro = "Pagamento sicuro e metodi";
    const eC = T({ cassa: k.cassa, esito: { tono: "errore", testo: "ESITO-CASSA", dove: "cassa" } });
    const eS = T({ cassa: k.cassa, esito: { tono: "ok", testo: "ESITO-SICURO", dove: "sicuro" } });
    const eW = T({ cassa: k.cassa, esito: { tono: "errore", testo: "ESITO-WEBHOOK", dove: "webhook" } });
    c("l'esito di «Cassa del sito» sta nel suo riquadro (dopo il titolo, prima di «Pagamento sicuro e metodi»), una volta sola", [true, 1], [pos(eC, hCassa) < pos(eC, "ESITO-CASSA") && pos(eC, "ESITO-CASSA") < pos(eC, hSicuro), eC.split("ESITO-CASSA").length - 1]);
    c("l'esito di «Pagamento sicuro» e dei metodi sta nel suo riquadro, in fondo a quello (non dopo, fuori)", [true, 1], [pos(eS, hSicuro) < pos(eS, "ESITO-SICURO"), eS.split("ESITO-SICURO").length - 1]);
    c("l'esito della copia sta nel riquadro del webhook", true, pos(eW, hWeb) < pos(eW, "ESITO-WEBHOOK") && pos(eW, "ESITO-WEBHOOK") < pos(eW, hCassa));
    c("un esito d'errore si annuncia come avviso (role=alert); uno riuscito come stato", [true, true], [/role="alert"[^>]*>[\s\S]{0,800}ESITO-CASSA/.test(vista({ cassa: k.cassa, esito: { tono: "errore", testo: "ESITO-CASSA", dove: "cassa" } })), /role="status"[^>]*>[\s\S]{0,600}ESITO-SICURO/.test(vista({ cassa: k.cassa, esito: { tono: "ok", testo: "ESITO-SICURO", dove: "sicuro" } }))]);

    // nota 4: l'interruttore spento punta alla frase della condizione che manca
    const descr = (t) => (t.match(/aria-describedby="([^"]*)"/)?.[1] ?? "").split(/\s+/).filter(Boolean);
    const testoDi = (h, id) => testo(h.match(new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)</p>`))?.[1] ?? "");
    const ids = descr(tag(html, "Usa la cassa Stripe"));
    c("«Cassa del sito» spento: aria-describedby punta alle frasi di chiave e tariffa, che esistono e dicono cosa manca", [true, true, true], [
      ids.length >= 2 && ids.every((i) => html.includes(`id="${i}"`)),
      ids.some((i) => /Manca la chiave di Stripe/.test(testoDi(html, i))), ids.some((i) => /Manca una tariffa di spedizione/.test(testoDi(html, i))),
    ]);
    const htmlSenzaSemi = vista({ cassa: kSenzaSeme.cassa });
    const idsS = descr(tag(htmlSenzaSemi, "Usa la cassa Stripe"));
    c("senza i semi punta alla frase della migrazione", [true, true], [idsS.length >= 1 && idsS.every((i) => htmlSenzaSemi.includes(`id="${i}"`)), idsS.some((i) => /migrazione S4/.test(testoDi(htmlSenzaSemi, i)))]);
    const idsOk = descr(tag(vTutto, "Usa la cassa Stripe"));
    c("con tutto a posto punta comunque a un testo che esiste (la spiegazione)", true, idsOk.length >= 1 && idsOk.every((i) => vTutto.includes(`id="${i}"`)));

    // nota 5: la dicitura c'è solo con la cassa Stripe
    c("«Pagamento sicuro» acceso: la frase dice che compare solo con la cassa Stripe", true, /dicitura[^.]*solo con la cassa Stripe/i.test(testo(vSicuroOk)));

    const vMetodi = vista({ cassa: { ...k.cassa, metodi: ["carta", "klarna"] } });
    c("cinque caselle dei metodi: spuntati solo quelli dell'elenco", [["Carta", true], ["Apple Pay", false], ["Google Pay", false], ["PayPal", false], ["Klarna", true]], ["Carta", "Apple Pay", "Google Pay", "PayPal", "Klarna"].map((m) => [m, acceso(tag(vMetodi, m))]));
    c("…le caselle spiegano che sono i metodi già attivi sull'account Stripe", true, /attiv[io] sull'account Stripe/i.test(testo(vMetodi)));

    c("errore di lettura: la frase del server e «Riprova»; niente dati vecchi di una lettura negata", [true, true], [
      /sessione è scaduta/.test(testo(vista({ stripe: null, cassa: null, erroreStripe: "La sessione è scaduta: rientra nel CRM.", erroreCassa: null }))),
      /Riprova/.test(testo(vista({ stripe: null, cassa: null, erroreStripe: "La sessione è scaduta: rientra nel CRM.", erroreCassa: null }))),
    ]);
    c("una lettura che non è ancora arrivata non mostra un interruttore «spento per sempre»: dice «Controllo…»", [true, false], [/Controllo/.test(testo(vista({ stripe: null, cassa: null }))), spento(tag(vista({ stripe: null, cassa: null }), "Usa la cassa Stripe")) && tag(vista({ stripe: null, cassa: null }), "Usa la cassa Stripe") !== ""]);
    c("«Elimina», «Cancella», «Rimuovi» non esistono nel pannello", false, /elimin|cancell|rimuov|delete/i.test(vProva + testo(vista({ cassa: k.cassa }))));

    // ── i segnaposto ──
    const Tar = await tsx("src/crm/ecommerce/spedizioni/ElencoTariffe.tsx", "tariffe");
    const Em = await tsx("src/crm/ecommerce/email/ModelliEmail.tsx", "email");
    c("i due segnaposto esistono con i nomi che T65 e T66 sostituiranno", [true, true], [typeof Tar.ElencoTariffe === "function", typeof Em.ModelliEmail === "function"]);
    const nessuna = porta({});
    const tTar = typeof Tar.ElencoTariffe === "function" ? testo(renderToStaticMarkup(h(Tar.ElencoTariffe, { fetch: nessuna.f }))) : "";
    const tEm = typeof Em.ModelliEmail === "function" ? testo(renderToStaticMarkup(h(Em.ModelliEmail, { fetch: nessuna.f, onNegato: () => {} }))) : "";
    c("i segnaposto dicono onestamente che arrivano dopo, e non chiamano il server", [true, true, 0], [/tariff/i.test(tTar) && /arriv/i.test(tTar), /email/i.test(tEm) && /arriv/i.test(tEm), nessuna.chiamate.length]);
  } finally {
    rmSync(dove, { recursive: true, force: true });
  }

  // ── il guscio, i file: nessuna chiave, nessun «Elimina», niente Stripe all'apertura ──
  const FILE = ["src/routes/CRM.ecommerce.tsx", "src/crm/ecommerce/pagina-r2.ts", "src/crm/ecommerce/cassa/PannelloCassa.tsx", "src/crm/ecommerce/spedizioni/ElencoTariffe.tsx", "src/crm/ecommerce/email/ModelliEmail.tsx"];
  const testi = Object.fromEntries(FILE.map((f) => { try { return [f, leggiFile(f)]; } catch { return [f, null]; } }));
  c("i cinque file del compito esistono", FILE, FILE.filter((f) => testi[f] !== null));
  const nudi = FILE.map((f) => senzaCommenti(testi[f] ?? ""));
  c("la chiave di Stripe non compare in nessun file di UI (nemmeno il nome della variabile, nemmeno un prefisso di chiave)", [false, false, false, false, false], nudi.map((t) => /\b(sk|rk|pk)_(test|live)|whsec_|STRIPE_(SECRET|WEBHOOK)|process\.env|import\.meta\.env/.test(t)));
  c("«Elimina» non esiste in nessun file del compito (nemmeno come parola di una frase)", [false, false, false, false, false], nudi.map((t) => /elimin|cancell|delete|rimuov/i.test(t.replace(/\/api\/[^"'`\s]*/g, ""))));
  c("nessun log, nessun accesso diretto al database da questi file", [false, false, false, false, false], nudi.map((t) => /console\.|@\/integrations\/supabase|createClient|\.from\(["']/.test(t)));
  const guscio = nudi[0];
  c("nota 1: il pannello dice «sulloStato» solo quando Stripe è stato letto (mai al montaggio con null: il nastro non lampeggia)", [true, false], [
    /useEffect\(\(\) => \{[^}]{0,80}if \(stripe\)[^}]{0,80}sullo\.current\?\.\(stripe\)/.test(nudi[2]), /useEffect\(\(\) => \{\s*sullo\.current\?\.\(stripe\);/.test(nudi[2]),
  ]);
  c("il guscio non nomina l'indirizzo e non chiama «Prova adesso»; per il nastro fa UNA lettura leggera (`leggiNastro`), da un effetto, che non mostra errori", [false, false, 1, true, true], [
    /api\/crm\/stripe/.test(guscio), /provaAdesso\(/.test(guscio), (guscio.match(/leggiNastro\(/g) || []).length,
    /useEffect\(\(\) => \{[\s\S]{0,300}leggiNastro\(fetchCRM\)/.test(guscio), !/erroreStripe|setErrore|<Avviso[^>]*>[^<]*Stripe/.test(guscio),
  ]);
  c("la scheda «Cassa» si disegna solo con ?scheda=cassa", true, /scheda === "cassa"[\s\S]{0,200}<PannelloCassa/.test(guscio));
  c("il pannello legge Stripe e la cassa solo da un effetto (`carica`), mai nel disegno e mai a livello di modulo", [true, true, 1], [
    /useEffect\(\(\) => \{[\s\S]{0,300}void carica\(\)/.test(nudi[2]), /const carica = useCallback\(async \(\) => \{[\s\S]{0,300}caricaStripe\(/.test(nudi[2]), (nudi[2].match(/caricaStripe\(/g) || []).length,
  ]);
  c("il guscio mostra il nastro con `mostraNastro` (solo se Stripe dice prova) e tiene lo stato fra una scheda e l'altra", true, /mostraNastro\(/.test(guscio) && /<NastroProva/.test(guscio));
  c("le sei linguette: Panoramica, Ordini, Prodotti, Cassa, Spedizioni, Email", [true, true, true], [/titolo: "Cassa"/.test(guscio), /titolo: "Spedizioni"/.test(guscio), /titolo: "Email"/.test(guscio)]);
  c("la linguetta «Email» sparisce se il server rifiuta (`onNegato`), ma il guscio non decide il permesso da solo", true, /onNegato/.test(guscio) && !/permessi\.ts|PERMESSI_RUOLO|haPermesso|can\(/.test(guscio));
  c("le schede di prima restano: Panoramica, Ordini e Prodotti sono ancora lì, con `useOrdini()` una volta sola", [true, true, true, 1], [/<Panoramica/.test(guscio), /<ElencoOrdini/.test(guscio), /<LinguettaProdotti/.test(guscio), (guscio.match(/useOrdini\(\)/g) || []).length]);
  c("il periodo e «Aggiorna» restano degli ordini: nelle schede nuove non compaiono", true, /const schedaOrdini =/.test(guscio) || /scheda === "panoramica" \|\| scheda === "ordini"/.test(guscio));
}
