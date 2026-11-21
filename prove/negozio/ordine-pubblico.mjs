/** ── NEGOZIO · R2 · T55 · LA PAGINA ORDINE: IL SERVER (`ordinePubblico`) ───────────────────────────────
 *  `src/shop/cassa/ordine-pubblico.server.ts` + l'involucro `ordine-pubblico.functions.ts` (PIANO-R2 §3.3, D48, D49, D63, D66; SPEC 8A n. 5):
 *   · la chiave `t` si verifica a tempo costante contro l'impronta salvata (`verificaChiave` di T48), anche se l'ordine non c'è;
 *   · chiave sbagliata, assente, di un altro ordine, ref inesistente o storto, ordine R1 (senza impronta), qualunque guasto → `{ok:false}`
 *     IDENTICO byte per byte: la risposta non dice mai quale dei casi è;
 *   · nella risposta nessun indirizzo, telefono, email, CF, nome, id interno, id di Stripe: solo CAP e città (prova ricorsiva);
 *   · `in_attesa` = fase `verifica` (mai `pagato`, `ref` nullo); il tracking ha il link solo se `https://`;
 *   · limite per indirizzo (60 letture/ora, l'indirizzo solo come HMAC), consumato PRIMA di guardare la chiave;
 *   · nel log solo codici; `testiConfermati()` è la porta dei testi (di partenza `{}`).
 *  Dati inventati: nessuna chiave vera, nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { uuid } from "./dati.mjs";

const SERVIZIO = "chiave-di-servizio-di-prova-non-vera";
const ORA = Date.parse("2026-11-20T12:00:00.000Z");
const FRA_MEZZ_ORA = new Date(ORA + 30 * 60_000).toISOString();
const MEZZ_ORA_FA = new Date(ORA - 30 * 60_000).toISOString();
const ID_A = uuid(0xa001);
const ID_B = uuid(0xa002);
const ID_R1 = uuid(0xa003);
const REF_A = "HG-7K3M9Q";
const REF_B = "HG-4NP2XZ";
const REF_R1 = "HG-0R1ABC";
const IP = "203.0.113.7";
const RIFIUTO = JSON.stringify({ ok: false });
/** Tutto ciò che di una persona o del database non deve MAI comparire nella risposta (valori inventati). */
const RISERVATI = {
  nome: "Giovanna",
  cognome: "Rossettini",
  email: "giovanna.rossettini@example.test",
  telefono: "+39 333 1234567",
  indirizzo: "Via dei Pioppi 12 interno 4",
  note: "Citofono Verdi, secondo piano",
  cf: "RSSGNN80A41H501Z",
  sessione: "cs_test_PROVA0000SEGRETA",
  pagamento: "pi_test_PROVA0000SEGRETO",
  sku: "sku-segreto-uno",
  slug: "slug-segreto-uno",
  lead: uuid(0x1ead),
  idA: ID_A,
};
const CHIAVI_VIETATE = ["id", "order_id", "ordine_id", "indirizzo", "telefono", "email", "cf", "piva", "nome_cliente", "cognome", "lead_id", "sku", "slug", "prodottoId", "stripe_sessione_id", "stripe_pagamento_id", "chiave_pubblica_hash", "note", "ip", "user_agent"];
const CONTRATTO_ORDINE = ["cap", "citta", "creatoIl", "fase", "frase", "ref", "righe", "riprovabile", "rimborsatoCent", "spedizioneCent", "subtotaleCent", "tempo", "totaleCent", "tracking"];
const STATI_PAGAMENTO = ["in_attesa", "pagato", "fallito", "scaduto", "rimborsato_in_parte", "rimborsato", "da_incassare"];
const STATI_ORDINE = ["nuovo", "in_preparazione", "spedito", "consegnato", "annullato"];

/** Percorre una risposta: chiavi e valori testuali, a qualunque profondità. */
function percorri(v, chiavi, valori) {
  if (typeof v === "string") valori.push(v);
  else if (Array.isArray(v)) v.forEach((x) => percorri(x, chiavi, valori));
  else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) {
      chiavi.push(k);
      percorri(x, chiavi, valori);
    }
}

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO · LA PAGINA ORDINE, IL SERVER (21/11/2026, T55)");
  const S = mod["shop/cassa/ordine-pubblico.server"];
  c("il modulo src/shop/cassa/ordine-pubblico.server.ts esiste", true, !!S);
  if (!S) return;
  const K = mod["shop/cassa/chiave-ordine"];
  const P = mod["ecommerce/pagamento"];
  const kA = await K.chiaveOrdine(SERVIZIO, ID_A);
  const kB = await K.chiaveOrdine(SERVIZIO, ID_B);
  const kR1 = await K.chiaveOrdine(SERVIZIO, ID_R1);
  const hA = await K.impronta(kA);
  const hB = await K.impronta(kB);
  const cambia = (t) => t.slice(0, 10) + (t[10] === "a" ? "b" : "a") + t.slice(11);

  /** Un ordine del sito nuovo, in attesa di pagamento, con tutti i dati personali che la pagina NON deve far uscire. */
  const riga = (extra = {}) => ({
    id: ID_A, order_ref: REF_A, created_at: "2026-11-20T10:00:00.000Z",
    nome: RISERVATI.nome, cognome: RISERVATI.cognome, email: RISERVATI.email, telefono: RISERVATI.telefono,
    indirizzo: RISERVATI.indirizzo, citta: "Roma", cap: "00184", provincia: "RM", nazione: "IT", note: RISERVATI.note,
    cf: RISERVATI.cf, lead_id: RISERVATI.lead, senza_lead: false,
    items: [
      { product_id: RISERVATI.sku, name: "Patch di prova", slug: RISERVATI.slug, qty: 2, unit_price: 12.5, variant: "Colore: Nero" },
      { product_id: "sku-segreto-due", name: "Collante di prova", slug: "slug-segreto-due", qty: 1, unit_price: 0.1, variant: null },
    ],
    subtotal: 25.1, shipping: 4.9, total: 30, totale_cent: 3000, rimborsato_cent: 0,
    status: "nuovo", stato_pagamento: "in_attesa", pagato_il: null, pagato_importo: null, metodo_pagamento: null,
    stripe_sessione_id: RISERVATI.sessione, stripe_pagamento_id: RISERVATI.pagamento, prova: false,
    scade_il: FRA_MEZZ_ORA, canale: "sito", chiave_pubblica_hash: hA,
    tracking: null, tracking_url: null, corriere: null, spedito_il: null, senza_tracking: null,
    ...extra,
  });
  const pagato = (extra = {}) => riga({ stato_pagamento: "pagato", pagato_il: "2026-11-20T10:05:00.000Z", pagato_importo: 30, metodo_pagamento: "stripe", ...extra });
  const R1 = () => riga({ id: ID_R1, order_ref: REF_R1, canale: null, chiave_pubblica_hash: null, stato_pagamento: null, totale_cent: null });
  const evento = (stato, quando, tipo = "stato", ordine = ID_A) => ({ id: `ev-${stato}-${quando}`, order_id: ordine, order_ref: REF_A, tipo, chi: "prova", prima: {}, dopo: { stato }, created_at: quando });

  const logTutti = [];
  /** Una porta nuova: database nuovo (memoria e limiti nuovi). */
  const nuova = (righe = [riga()], { eventi = [], ip = IP, chiaveServizio = SERVIZIO, testi, ...opz } = {}) => {
    const db = fintoDb({ tabelle: { shop_orders: righe, shop_order_eventi: eventi }, ...opz });
    const log = [];
    const porte = { db, chiaveServizio, adesso: () => ORA, ip, log: (x) => { log.push(x); logTutti.push(x); }, ...(testi ? { testiConfermati: testi } : {}) };
    return { db, log, porte, vai: (ref, t) => S.ordinePubblico(porte, { ref, t }) };
  };
  const giro = async (righe, opz) => nuova(righe, opz).vai(REF_A, kA);

  // ── chiave giusta: il contratto di §3.3 ──
  const p = nuova();
  const r = await p.vai(REF_A, kA);
  c("chiave giusta → `{ok:true, ordine, testi}` e nient'altro", [true, ["ok", "ordine", "testi"]], [r.ok, Object.keys(r).sort()]);
  const o = r.ordine ?? {};
  c("…l'ordine ha le chiavi del contratto di §3.3 (D66) e nessun'altra", CONTRATTO_ORDINE, Object.keys(o).sort());
  c("…`in_attesa` → fase `verifica`, MAI `pagato`; il numero d'ordine non si dà (`ref` nullo)", ["verifica", null], [o.fase, o.ref]);
  c("…`tempo` ha le cinque tappe: ricevuto sì, tutte le altre nulle (nessuna data inventata)", { ricevuto: "2026-11-20T10:00:00.000Z", pagato: null, inPreparazione: null, spedito: null, consegnato: null }, o.tempo);
  c("…righe: nome, variante, quantità, totale riga in centesimi, `foto` nulla (la riempie V2)", [
    { nome: "Patch di prova", variante: "Colore: Nero", qty: 2, totaleCent: 2500, foto: null },
    { nome: "Collante di prova", variante: null, qty: 1, totaleCent: 10, foto: null },
  ], o.righe);
  c("…totali in centesimi interi: subtotale, spedizione, totale, rimborsato", [2510, 490, 3000, 0], [o.subtotaleCent, o.spedizioneCent, o.totaleCent, o.rimborsatoCent]);
  c("…solo CAP e città; nessun tracking; non riprovabile (c'è ancora tempo)", ["00184", "Roma", null, false], [o.cap, o.citta, o.tracking, o.riprovabile]);
  c("…`frase` è un testo breve e in `verifica` non dice «ricevuto»", [true, false], [typeof o.frase === "string" && o.frase.length > 0 && o.frase.length < 120, /ricevut/i.test(o.frase ?? "")]);

  // ── la stessa identica risposta, byte per byte ──
  const rifiuti = [];
  const prova = async (nome, ref, t, righe = [riga(), riga({ id: ID_B, order_ref: REF_B, chiave_pubblica_hash: hB }), R1()]) => {
    const x = nuova(righe);
    const risposta = JSON.stringify(await x.vai(ref, t));
    rifiuti.push([nome, risposta]);
    return x;
  };
  await prova("chiave sbagliata (un segno cambiato)", REF_A, cambia(kA));
  await prova("chiave assente (stringa vuota)", REF_A, "");
  await prova("chiave assente (undefined)", REF_A, undefined);
  await prova("chiave assente (null)", REF_A, null);
  await prova("chiave di un ALTRO ordine", REF_A, kB);
  await prova("chiave di un altro ordine, sull'altro ref", REF_B, kA);
  await prova("ref inesistente (forma giusta) con una chiave che sarebbe valida", "HG-ZZZZZZ", kA);
  await prova("ref storto (minuscolo)", REF_A.toLowerCase(), kA);
  await prova("ref storto (troppo lungo)", REF_A + "X", kA);
  await prova("ref assente", "", kA);
  await prova("ref non testo", 42, kA);
  await prova("ref oggetto", { $ne: "" }, kA);
  await prova("chiave oggetto", REF_A, { $ne: "" });
  await prova("chiave molto lunga", REF_A, "a".repeat(5000));
  await prova("ordine R1 (senza impronta) con la sua chiave derivata", REF_R1, kR1);
  await prova("ordine R1 con la chiave di un altro", REF_R1, kA);
  await prova("ordine con l'impronta ma non del sito (canale vuoto)", REF_A, kA, [riga({ canale: null })]);
  await prova("ordine del sito senza impronta", REF_A, kA, [riga({ chiave_pubblica_hash: null })]);
  await prova("ordine con l'impronta storta", REF_A, kA, [riga({ chiave_pubblica_hash: "non-una-impronta" })]);
  await prova("due righe con lo stesso ref (non deve accadere: nel dubbio, niente)", REF_A, kA, [riga(), riga({ id: ID_B })]);
  await prova("tabella degli ordini senza righe", REF_A, kA, []);
  c("ogni rifiuto è esattamente `{\"ok\":false}`", [], rifiuti.filter(([, x]) => x !== RIFIUTO).map(([n]) => n));
  c("…e sono tutti uguali fra loro (stringa JSON identica)", 1, new Set(rifiuti.map(([, x]) => x)).size);
  c("…venti e più casi di rifiuto provati", true, rifiuti.length >= 20);

  // ── nessun dato del cliente ──
  const visti = [];
  for (const [nome, ordine] of [["in attesa", riga()], ["pagato", pagato()], ["spedito con tracking", pagato({ status: "spedito", corriere: "BRT", tracking: "BRT123456789", tracking_url: "https://tracking.example.test/BRT123456789" })]]) {
    const x = await giro([ordine]);
    const chiavi = [];
    const valori = [];
    percorri(x, chiavi, valori);
    const testo = JSON.stringify(x);
    visti.push([nome, x.ok === true, chiavi.filter((k) => CHIAVI_VIETATE.includes(k)), Object.entries(RISERVATI).filter(([, v]) => testo.includes(v)).map(([k]) => k), valori.filter((v) => /@|\bVia\b|^\+39|^cs_|^pi_/.test(v))]);
  }
  c("risposte lette ricorsivamente (chiavi e valori), tre ordini: in attesa, pagato, spedito con tracking → tutti `ok`", [true, true, true], visti.map((v) => v[1]));
  c("…nessuna chiave vietata a nessuna profondità (id, indirizzo, telefono, email, cf, sku, slug, id di Stripe, impronta, note…)", [[], [], []], visti.map((v) => v[2]));
  c("…nessun valore riservato (nome, cognome, email, telefono, indirizzo, note, CF, id di Stripe, SKU, slug, id dell'ordine e del lead)", [[], [], []], visti.map((v) => v[3]));
  c("…né valori che sembrano email, via, telefono o id di Stripe", [[], [], []], visti.map((v) => v[4]));
  const colonne = [...new Set(p.db.registro.filter((q) => q.tab === "shop_orders").flatMap((q) => String(q.cols).split(",").map((s) => s.trim())))];
  c("il server NON legge nemmeno le colonne personali (nome, cognome, email, telefono, indirizzo, note, lead, id di Stripe)", [], colonne.filter((k) => /^(nome|cognome|email|telefono|indirizzo|note|cf|lead_id|stripe_.*|provincia|nazione|\*)$/.test(k)));
  c("…né scrive qualcosa (solo il limite, per funzione SQL)", [], p.db.registro.filter((q) => q.op !== "select" && q.op !== "rpc"));
  c("…le sole scritture sono quella del contatore del limite", ["rpc.shop_limite_consuma"], [...new Set(p.db.registro.filter((q) => q.scrisse).map((q) => q.chiave))]);

  // ── le fasi ──
  const fase = async (extra, eventi) => (await giro([riga(extra)], { eventi })).ordine ?? null;
  const f = (x) => x && [x.fase, x.ref, x.riprovabile];
  c("`pagato` → fase `pagato`, ora il numero d'ordine c'è, non riprovabile", ["pagato", REF_A, false], f(await fase({ stato_pagamento: "pagato", pagato_il: "2026-11-20T10:05:00.000Z" })));
  c("…`tempo.pagato` = la data del pagamento, e solo con un pagamento vero", ["2026-11-20T10:05:00.000Z", null], [(await fase({ stato_pagamento: "pagato", pagato_il: "2026-11-20T10:05:00.000Z" })).tempo.pagato, (await fase({ stato_pagamento: "in_attesa", pagato_il: "2026-11-20T10:05:00.000Z" })).tempo.pagato]);
  c("…`in_attesa` con una data di pagamento scritta per errore: ancora `verifica`, mai `pagato`", ["verifica", null], f((await fase({ stato_pagamento: "in_attesa", pagato_il: "2026-11-20T10:05:00.000Z" }))).slice(0, 2));
  c("`in_attesa` con `scade_il` già passata → `scaduto` (si legge, D52), riprovabile, il numero c'è", ["scaduto", REF_A, true], f(await fase({ scade_il: MEZZ_ORA_FA })));
  c("`in_attesa` con `scade_il` futura → `verifica`", "verifica", (await fase({ scade_il: FRA_MEZZ_ORA })).fase);
  c("`in_attesa` senza `scade_il` → `verifica`", "verifica", (await fase({ scade_il: null })).fase);
  c("`fallito` → `non_riuscito`, riprovabile", ["non_riuscito", REF_A, true], f(await fase({ stato_pagamento: "fallito" })));
  c("`scaduto` in tabella → `scaduto`, riprovabile", ["scaduto", REF_A, true], f(await fase({ stato_pagamento: "scaduto" })));
  c("`rimborsato` → `rimborsato`, non riprovabile", ["rimborsato", false], [(await fase({ stato_pagamento: "rimborsato", pagato_il: "2026-11-20T10:05:00.000Z", rimborsato_cent: 3000 })).fase, (await fase({ stato_pagamento: "rimborsato" })).riprovabile]);
  c("…il rimborsato in cifre", 3000, (await fase({ stato_pagamento: "rimborsato", rimborsato_cent: 3000 })).rimborsatoCent);
  c("`rimborsato_in_parte` su un ordine nuovo → `pagato`", "pagato", (await fase({ stato_pagamento: "rimborsato_in_parte", pagato_il: "2026-11-20T10:05:00.000Z", rimborsato_cent: 500 })).fase);
  for (const st of ["in_preparazione", "spedito", "consegnato"])
    c(`pagato e \`${st}\` → fase \`${st}\``, st, (await fase({ stato_pagamento: "pagato", pagato_il: "2026-11-20T10:05:00.000Z", status: st })).fase);
  c("`annullato` vince su tutto: fase `annullato` anche con pagamento fallito o scaduto, e MAI riprovabile", [["annullato", false], ["annullato", false], ["annullato", false], ["annullato", false]],
    await Promise.all([{ stato_pagamento: "fallito" }, { stato_pagamento: "scaduto" }, { scade_il: MEZZ_ORA_FA }, { stato_pagamento: "pagato", pagato_il: "2026-11-20T10:05:00.000Z" }].map(async (e) => { const x = await fase({ status: "annullato", ...e }); return [x.fase, x.riprovabile]; })));
  c("un ordine R2 con la colonna dello stato vuota e senza pagamento → `verifica` (mai «pagato» senza pagamento)", "verifica", (await fase({ stato_pagamento: null, pagato_il: null })).fase);

  // ── `riprovabile` coerente con `puoRiprovare` (annullato mai) ──
  const diversi = [];
  for (const sp of STATI_PAGAMENTO)
    for (const st of STATI_ORDINE) {
      const x = await fase({ stato_pagamento: sp, status: st, scade_il: FRA_MEZZ_ORA, pagato_il: ["pagato", "rimborsato_in_parte", "rimborsato"].includes(sp) ? "2026-11-20T10:05:00.000Z" : null });
      const atteso = P.puoRiprovare({ stato: st, statoPagamento: sp, pagatoIl: null });
      if (x.riprovabile !== atteso) diversi.push(`${sp}/${st}: pagina ${x.riprovabile}, puoRiprovare ${atteso}`);
      if (st === "annullato" && x.riprovabile) diversi.push(`${sp}/annullato riprovabile`);
    }
  c("per tutti i 35 incroci (stato di pagamento × stato dell'ordine) `riprovabile` = `puoRiprovare`, e `annullato` mai", [], diversi);
  c("(l'unico scarto voluto: `in_attesa` oltre `scade_il` si LEGGE scaduto e offre «Riprova»; `riprovaPagamento` rilegge Stripe prima di aprire, D66)", [true, false], [(await fase({ scade_il: MEZZ_ORA_FA })).riprovabile, P.puoRiprovare({ stato: "nuovo", statoPagamento: "in_attesa", pagatoIl: null })]);

  // ── i tempi: dalle colonne e da `shop_order_eventi`, mai inventati ──
  const t0 = (x) => x.tempo;
  const pg = { stato_pagamento: "pagato", pagato_il: "2026-11-20T10:05:00.000Z" };
  c("pagato, nessun evento di evasione → in preparazione, spedito, consegnato nulli", [null, null, null], ((x) => [x.inPreparazione, x.spedito, x.consegnato])(t0(await fase(pg))));
  c("`in_preparazione` con l'evento → la data dell'evento", "2026-11-20T11:00:00.000Z", t0(await fase({ ...pg, status: "in_preparazione" }, [evento("in_preparazione", "2026-11-20T11:00:00.000Z")])).inPreparazione);
  c("`in_preparazione` senza evento (nessuna data inventata)", null, t0(await fase({ ...pg, status: "in_preparazione" })).inPreparazione);
  const sp = { ...pg, status: "spedito", spedito_il: "2026-11-20T11:30:00.000Z" };
  c("`spedito`: la data viene dalla colonna `spedito_il`; la preparazione saltata (nuovo → spedito) resta nulla", ["2026-11-20T11:30:00.000Z", null], ((x) => [x.spedito, x.inPreparazione])(t0(await fase(sp))));
  c("`spedito` senza `spedito_il`: si usa l'evento", "2026-11-20T11:20:00.000Z", t0(await fase({ ...sp, spedito_il: null }, [evento("spedito", "2026-11-20T11:20:00.000Z", "spedito")])).spedito);
  c("`consegnato`: la data dell'evento; di più eventi uguali vale il più recente", "2026-11-20T11:50:00.000Z", t0(await fase({ ...sp, status: "consegnato" }, [evento("consegnato", "2026-11-20T11:40:00.000Z"), evento("consegnato", "2026-11-20T11:50:00.000Z")])).consegnato);
  c("riportato indietro (spedito → in preparazione con motivo): le tappe «future» tornano nulle", [null, null], ((x) => [x.spedito, x.consegnato])(t0(await fase({ ...sp, status: "in_preparazione" }, [evento("spedito", "2026-11-20T11:20:00.000Z", "spedito"), evento("consegnato", "2026-11-20T11:40:00.000Z")]))));
  c("annullato: la linea del tempo non c'è (tappe di evasione nulle)", [null, null, null], ((x) => [x.inPreparazione, x.spedito, x.consegnato])(t0(await fase({ ...sp, status: "annullato" }, [evento("in_preparazione", "2026-11-20T11:00:00.000Z"), evento("spedito", "2026-11-20T11:20:00.000Z", "spedito")]))));
  c("gli eventi di un ALTRO ordine non contano", null, t0(await fase({ ...pg, status: "in_preparazione" }, [evento("in_preparazione", "2026-11-20T11:00:00.000Z", "stato", ID_B)])).inPreparazione);
  c("gli eventi di altro tipo (nota, pagato, …) non contano", null, t0(await fase({ ...pg, status: "in_preparazione" }, [{ ...evento("in_preparazione", "2026-11-20T11:00:00.000Z"), tipo: "nota_interna" }])).inPreparazione);
  c("la lettura degli eventi che fallisce: l'ordine si vede lo stesso, tappe nulle, il codice nel log", [true, null, true], await (async () => {
    const x = nuova([riga({ ...pg, status: "in_preparazione" })], { errori: { "shop_order_eventi.select": { error: { code: "57P01", message: "PROVA testo con dati", details: "Giovanna" } } } });
    const y = await x.vai(REF_A, kA);
    return [y.ok === true, y.ordine?.tempo.inPreparazione ?? "assente", x.log.some((l) => l.includes("57p01"))];
  })());
  c("le date arrivano in ISO (UTC) anche se la colonna le dà in un altro formato", "2026-11-20T10:05:00.000Z", (await fase({ ...pg, pagato_il: "2026-11-20T11:05:00+01:00" })).tempo.pagato);

  // ── il tracking: il link solo con https ──
  const sped = (extra) => fase({ ...pg, status: "spedito", spedito_il: "2026-11-20T11:30:00.000Z", corriere: "BRT", tracking: "BRT123456789", ...extra });
  const tr = async (url) => (await sped({ tracking_url: url })).tracking;
  c("tracking con link https → corriere, numero e link", { corriere: "BRT", numero: "BRT123456789", url: "https://tracking.example.test/BRT123456789" }, await tr("https://tracking.example.test/BRT123456789"));
  for (const [nome, url] of [["http", "http://tracking.example.test/x"], ["javascript:", "javascript:alert(1)"], ["data:", "data:text/html,<b>x</b>"], ["senza protocollo", "//tracking.example.test/x"], ["ftp", "ftp://tracking.example.test/x"], ["con credenziali", "https://utente:segreto@tracking.example.test/x"], ["non un indirizzo", "tracking.example.test/x"], ["vuoto", ""]])
    c(`link ${nome} → il link è nullo, il numero resta`, [null, "BRT123456789"], ((t) => [t?.url ?? "assente", t?.numero])(await tr(url)));
  c("HTTPS in maiuscolo è comunque https", "string", typeof (await tr("HTTPS://tracking.example.test/x"))?.url);
  c("tracking prima della spedizione (ordine non ancora spedito) → nullo, anche se la colonna è piena", null, (await fase({ ...pg, status: "in_preparazione", corriere: "BRT", tracking: "BRT123456789", tracking_url: "https://tracking.example.test/x" })).tracking);
  c("spedito senza corriere né numero né link → nullo", null, (await sped({ corriere: null, tracking: null, tracking_url: null })).tracking);
  c("spedito «senza tracking» col solo corriere → corriere, nessun numero né link", { corriere: "BRT", numero: null, url: null }, (await sped({ tracking: null, tracking_url: null, senza_tracking: true })).tracking);
  c("un numero enorme viene tagliato (nessun testo di migliaia di righe)", true, ((t) => typeof t?.numero === "string" && t.numero.length <= 80)(await sped({ tracking: "9".repeat(5000) }).then((x) => x.tracking)));
  c("annullato dopo la spedizione: nessun tracking", null, (await sped({ status: "annullato" })).tracking);

  // ── il limite per indirizzo ──
  const l = nuova();
  const prime = [];
  for (let i = 0; i < 60; i++) prime.push((await l.vai(REF_A, kA)).ok);
  c("60 letture in un'ora dallo stesso indirizzo passano tutte", [60, 0], [prime.filter(Boolean).length, prime.filter((x) => !x).length]);
  c("la 61ª ha la stessa identica risposta di rifiuto, anche con la chiave giusta", RIFIUTO, JSON.stringify(await l.vai(REF_A, kA)));
  const altro = S.ordinePubblico({ ...l.porte, ip: "198.51.100.9" }, { ref: REF_A, t: kA });
  c("un altro indirizzo non è limitato", true, (await altro).ok);
  const chiaviLimite = l.db.tabelle.shop_limiti.map((x) => x.chiave);
  c("il contatore sta in `shop_limiti` con la chiave «lettura:<impronta HMAC di 64 esadecimali>»", true, chiaviLimite.length === 2 && chiaviLimite.every((k) => /^lettura:[0-9a-f]{64}$/.test(k)));
  c("…l'indirizzo non compare né in chiaro né in una impronta nuda (SHA-256 semplice) nel contatore o nelle chiamate", [false, false], [JSON.stringify([l.db.tabelle.shop_limiti, l.db.registro.map((q) => q.args ?? null)]).includes(IP), JSON.stringify(l.db.tabelle.shop_limiti).includes((await import("node:crypto")).createHash("sha256").update(IP).digest("hex"))]);
  c("…la finestra è un'ora e il massimo 60 (D49)", [3600, 60], ((q) => [q.args.p_finestra_s, q.args.p_max])(l.db.registro.find((q) => q.chiave === "rpc.shop_limite_consuma")));
  const sbagliate = nuova();
  for (let i = 0; i < 60; i++) await sbagliate.vai(REF_A, cambia(kA));
  c("i tentativi con la chiave SBAGLIATA consumano il limite: dopo 60 tentativi anche la chiave giusta è rifiutata", RIFIUTO, JSON.stringify(await sbagliate.vai(REF_A, kA)));
  const senzaIp = nuova([riga()], { ip: null });
  c("indirizzo assente (intestazione mancante) → la pagina funziona lo stesso (impronta «sconosciuto»)", true, (await senzaIp.vai(REF_A, kA)).ok);
  const limiteGuasto = nuova([riga()], { errori: { "rpc.shop_limite_consuma": { error: { code: "57P01", message: "PROVA" } } } });
  c("il limite che non risponde → rifiuto uguale (si chiude), codice nel log", [RIFIUTO, true], [JSON.stringify(await limiteGuasto.vai(REF_A, kA)), limiteGuasto.log.some((x) => x.includes("57p01"))]);
  c("…e senza leggere l'ordine", 0, limiteGuasto.db.registro.filter((q) => q.tab === "shop_orders").length);
  const rifiutata = nuova();
  for (let i = 0; i < 61; i++) await rifiutata.vai(REF_A, kA);
  c("oltre il limite non si legge più l'ordine (nessuna lettura dopo il rifiuto)", 60, rifiutata.db.registro.filter((q) => q.tab === "shop_orders").length);

  // ── guasti e migrazione assente: sempre lo stesso rifiuto, mai un'eccezione ──
  const guasti = [
    ["S4 assente (colonne e funzioni non ci sono)", nuova([riga()], { senzaColonne: { shop_orders: ["stato_pagamento", "chiave_pubblica_hash", "canale", "totale_cent", "scade_il", "rimborsato_cent", "spedito_il", "corriere", "tracking_url", "senza_tracking"] } })],
    ["tabella degli ordini assente", nuova([riga()], { mancante: ["shop_orders"] })],
    ["il database lancia un'eccezione sugli ordini", nuova([riga()], { errori: { "shop_orders.select": { lancia: new TypeError("PROVA rete con dati di Giovanna") } } })],
    ["il database risponde con un errore sugli ordini", nuova([riga()], { errori: { "shop_orders.select": { error: { code: "XX000", message: "PROVA con la riga di Giovanna", details: "Key (email)=(giovanna.rossettini@example.test)" } } } })],
    ["chiave di servizio mancante", nuova([riga()], { chiaveServizio: undefined })],
    ["chiave di servizio vuota", nuova([riga()], { chiaveServizio: "" })],
  ];
  for (const [nome, x] of guasti) c(`${nome} → la stessa risposta di rifiuto`, RIFIUTO, JSON.stringify(await x.vai(REF_A, kA).catch(() => "ECCEZIONE")));
  c("…con la chiave di servizio mancante non si chiama nemmeno il database", 0, guasti[4][1].db.registro.length);
  const nulla = await S.ordinePubblico({ db: null, chiaveServizio: SERVIZIO, adesso: () => ORA, ip: IP }, { ref: REF_A, t: kA }).catch(() => "ECCEZIONE");
  c("persino con un database nullo (collegamento mancante) → rifiuto, nessuna eccezione", RIFIUTO, JSON.stringify(nulla));
  const senzaPorte = await S.ordinePubblico(undefined, { ref: REF_A, t: kA }).catch(() => "ECCEZIONE");
  c("…e senza le porte", RIFIUTO, JSON.stringify(senzaPorte));
  const senzaDati = await S.ordinePubblico(nuova().porte, undefined).catch(() => "ECCEZIONE");
  c("…e senza richiesta", RIFIUTO, JSON.stringify(senzaDati));
  c("il rifiuto per guasto non è distinguibile dal rifiuto per chiave sbagliata", true, rifiuti[0][1] === JSON.stringify(await guasti[3][1].vai(REF_A, kA)));

  // ── dati sporchi nella riga: la pagina non si rompe e non inventa ──
  const sporca = await giro([riga({ items: null, subtotal: "boh", shipping: null, total: null, totale_cent: null, created_at: "2026-11-20T10:00:00.000Z", tracking: { x: 1 } })]);
  c("righe nulle e importi illeggibili → ordine ok, nessuna riga, cifre finite (mai NaN)", [true, [], true], [sporca.ok, sporca.ordine?.righe, [sporca.ordine?.subtotaleCent, sporca.ordine?.spedizioneCent, sporca.ordine?.totaleCent].every(Number.isInteger)]);
  c("totale: `totale_cent` quando c'è; altrimenti il totale in euro in centesimi", [3000, 3190], [(await fase({ totale_cent: 3000, total: 31.9 })).totaleCent, (await fase({ totale_cent: null, total: 31.9 })).totaleCent]);
  c("una data di creazione illeggibile → l'ordine non si mostra (rifiuto)", RIFIUTO, JSON.stringify(await giro([riga({ created_at: "ieri" })])));
  c("`ref` nella risposta è quello chiesto (validato), mai un pezzo dell'id", REF_A, (await fase({ stato_pagamento: "pagato", pagato_il: "2026-11-20T10:05:00.000Z", order_ref: REF_A })).ref);

  // ── la porta dei testi confermati (D63) ──
  const TUTTI_NULLI = { reso: null, assistenza: null, assistenza_whatsapp: null, pronta_consegna: null, garanzia: null, firmatario: null };
  c("senza la porta dei testi: `testi` ha le sei chiavi, tutte nulle (= tutto nascosto)", TUTTI_NULLI, (await nuova().vai(REF_A, kA)).testi);
  c("la porta che risponde `{}` → stessa cosa", TUTTI_NULLI, (await nuova([riga()], { testi: async () => ({}) }).vai(REF_A, kA)).testi);
  c("la porta passa per `filtraConfermati`: testo vero sì; vuoto, solo spazi e `{{…}}` no", { ...TUTTI_NULLI, reso: "Testo del reso scritto dal titolare", assistenza: null, garanzia: null }, (await nuova([riga()], { testi: async () => ({ reso: "  Testo del reso scritto dal titolare ", assistenza: "{{da confermare}}", garanzia: "   ", inventato: "non esiste" }) }).vai(REF_A, kA)).testi);
  c("la porta che lancia → ordine ok lo stesso, tutto nascosto", [true, TUTTI_NULLI], await (async () => { const y = await nuova([riga()], { testi: async () => { throw new Error("PROVA"); } }).vai(REF_A, kA); return [y.ok, y.testi]; })());
  c("la porta che dà una cosa che non è un oggetto → tutto nascosto", TUTTI_NULLI, (await nuova([riga()], { testi: async () => "testo" }).vai(REF_A, kA)).testi);
  let chiamateTesti = 0;
  const conta = () => { chiamateTesti++; return {}; };
  for (const [ref, t] of [[REF_A, cambia(kA)], [REF_B, kA], ["HG-ZZZZZZ", kA]]) await nuova([riga()], { testi: conta }).vai(ref, t);
  c("a un rifiuto la porta dei testi non si chiama nemmeno (e `testi` non compare)", [0, undefined], [chiamateTesti, (await nuova().vai(REF_A, cambia(kA))).testi]);

  // ── il log: solo codici ──
  c("nel log ogni riga è un codice (`/^[a-z0-9_ ]{1,40}$/`), mai un nome, una email, un testo di errore", [], logTutti.filter((x) => !/^[a-z0-9_ ]{1,40}$/.test(x)));
  const tutto = logTutti.join("\n");
  c("…nessun ref, nessuna chiave, nessuna impronta, nessun id, nessun indirizzo IP, nessun dato personale", [], [REF_A, REF_B, REF_R1, kA, kB, hA, hB, ID_A, ID_B, IP, "198.51.100.9", ...Object.values(RISERVATI)].filter((v) => tutto.includes(v)));
  c("…il log ha qualcosa da dire (i guasti si vedono)", true, logTutti.length > 0);

  // ── il sorgente ──
  const nudo = (file) => readFileSync(join(radice, file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const server = nudo("src/shop/cassa/ordine-pubblico.server.ts");
  c("server: nessun console, nessun `.message`, nessun `.details` (portano valori di riga)", [false, false, false], [/console\./.test(server), /\.message/.test(server), /\.details/.test(server)]);
  c("…importabile senza ambiente: niente `process.env`, niente chiave di servizio per nome, niente `supabaseAdmin`", [false, false, false], [/process\.env/.test(server), /SERVICE_ROLE/.test(server), /supabaseAdmin/.test(server)]);
  c("…la chiave si verifica con `verificaChiave` (tempo costante), mai con `===` sull'impronta", [true, false], [server.includes("verificaChiave("), /chiave_pubblica_hash\s*[!=]==|[!=]==\s*[^;]*chiave_pubblica_hash/.test(server)]);
  c("…il limite è quello di D49 (`LIMITI.lettura`, `chiaveLimite`, `improntaIndirizzo`), l'indirizzo non si legge da nessun'altra parte", [true, true, true, false], [server.includes("LIMITI.lettura"), server.includes("chiaveLimite("), server.includes("improntaIndirizzo("), /cf-connecting-ip|x-forwarded-for/i.test(server)]);
  c("…la stato e la fase vengono da `pagamento.ts` (`fasePubblica`, `puoRiprovare`), non da un secondo elenco", [true, true], [server.includes("fasePubblica("), server.includes("puoRiprovare(")]);
  c("…solo letture: nessun `.insert(` `.update(` `.upsert(` `.delete(`", [], [".insert(", ".update(", ".upsert(", ".delete("].filter((t) => server.includes(t)));
  const fn = nudo("src/shop/cassa/ordine-pubblico.functions.ts");
  c("functions: `createServerFn` POST (la chiave non finisce nell'indirizzo, nei log, nel referrer)", [true, true], [fn.includes("createServerFn"), /method:\s*"POST"/.test(fn)]);
  c("…`Cache-Control: private, no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`", [true, true, true], [/private, no-store/.test(fn), /no-referrer/.test(fn), /noindex/.test(fn)]);
  c("…le intestazioni valgono PRIMA del lavoro (anche per il rifiuto), con `setResponseHeader`", [true, true], [fn.includes("setResponseHeader"), fn.indexOf("setResponseHeader") < fn.indexOf("leggiOrdine(")]);
  c("…esporta `ordinePubblico` (il nome del contratto, §3.3)", true, /export const ordinePubblico\b/.test(fn));
  c("…l'indirizzo viene da `cf-connecting-ip` (poi `x-forwarded-for`) e va alla porta, non si scrive nel log", [true, false], [/cf-connecting-ip/.test(fn), /log:[^)]*ip/.test(fn)]);
  c("…nessun errore verso il pubblico (try/catch), nessun `console.log` con dati", [true, false], [fn.includes("catch"), /console\.log/.test(fn)]);
  c("…la porta dei testi è collegata, di partenza vuota (la fonte è di V1(b))", true, fn.includes("testiConfermati"));
}
