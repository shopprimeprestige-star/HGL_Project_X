/** ── E-COMMERCE · T9 · LA ROTTA /api/crm/ordini E IL SUO MODULO SERVER ─────
 *  `src/crm/ecommerce/ordini.server.ts` riceve la guardia, il client del database, l'orologio e il log (porte)
 *  e fa tutto il lavoro; `src/routes/api.crm.ordini.ts` li collega a `guardiaCRM` e a `supabaseAdmin`.
 *  Qui il database è un finto in memoria (`_finto-db.mjs`): nessuna rete, nessuna chiave, nessuna migrazione.
 *  Dati inventati (`dati.mjs`): nessun cliente vero. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rigaOrdineProva } from "./dati.mjs";
import { fintoDb } from "./_finto-db.mjs";

const uuid = (n) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
const ADESSO = new Date("2026-11-18T12:00:00.000Z");
const LISTA_BIANCA = ["status", "pagato_il", "pagato_importo", "metodo_pagamento", "tracking", "note_interne", "lead_id", "senza_lead", "aggiornato_il"];
/** Una riga di shop_orders com'è nel database (colonne di M1 comprese, vuote). */
const riga = (n, extra = {}) => ({
  ...rigaOrdineProva({ id: uuid(n), order_ref: `HG-P${n}`, created_at: new Date(Date.UTC(2026, 10, 17, 10, 0, 0) - n * 60_000).toISOString() }),
  lead_id: null, senza_lead: false, pagato_il: null, pagato_importo: null, metodo_pagamento: null, tracking: null, note_interne: null, aggiornato_il: null,
  ...extra,
});
const molte = (n) => Array.from({ length: n }, (_, i) => riga(i + 1));

export async function prove(mod, { c, gruppo, radice }) {
  const S = mod["ecommerce/ordini.server"];
  const richiesta = (url, corpo) =>
    new Request(`https://crm.example.com/api/crm/ordini${url}`, corpo === undefined ? { method: "GET" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) });
  /** Dipendenze finte: guardia che dice sì (col nome dato), orologio fermo, log che registra. */
  const dip = (db, opz = {}) => {
    const nome = "nome" in opz ? opz.nome : "Giulia Esempio";
    const guardia = opz.guardia;
    const log = [];
    return {
      d: { guardia: guardia ?? (async () => ({ ok: true, nome })), db, adesso: () => ADESSO, log: (x) => log.push(x) },
      log,
    };
  };
  const leggi = async (r) => ({ stato: r.status, json: await r.json(), cache: r.headers.get("Cache-Control") });
  const GET = async (db, url, opz) => { const x = dip(db, opz); return { ...(await leggi(await S.gestisciGET(richiesta(url), x.d))), log: x.log }; };
  const POST = async (db, corpo, opz) => { const x = dip(db, opz); return { ...(await leggi(await S.gestisciPOST(richiesta("", corpo), x.d))), log: x.log }; };
  const ID = uuid(1);
  const src = (p) => readFileSync(join(radice, p), "utf8");

  gruppo("E-COMMERCE · ROTTA ORDINI (18/11/2026)");

  //  ── la guardia viene prima di tutto ──
  {
    const negate = [
      ["401", new Response(JSON.stringify({ ok: false, ordini: [] }), { status: 401 })],
      ["403", new Response(JSON.stringify({ ok: false, ordini: [] }), { status: 403 })],
    ];
    const esiti = [];
    for (const [nome, risposta] of negate) {
      for (const [metodo, url, corpo] of [["GET", ""], ["GET", "?conta=1"], ["GET", `?lead=${uuid(9)}`], ["GET", `?storico=${ID}`], ["POST", "", { azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" }]]) {
        const db = fintoDb({ ordini: [riga(1)] });
        const x = dip(db, { guardia: async () => ({ ok: false, risposta: risposta.clone() }) });
        const r = metodo === "GET" ? await S.gestisciGET(richiesta(url), x.d) : await S.gestisciPOST(richiesta(url, corpo), x.d);
        esiti.push([nome, metodo + url, r.status, db.chiamate, x.log.length]);
      }
    }
    c("guardia negata: 401/403 restituito tale e quale, il database non viene toccato", true, esiti.every(([n, , s, ch, lg]) => s === Number(n) && ch === 0 && lg === 0));
    const db = fintoDb({ ordini: [riga(1)] });
    let chiamataGuardia = 0;
    const x = dip(db, { guardia: async () => { chiamataGuardia++; return { ok: true, nome: "X" }; } });
    await S.gestisciGET(richiesta(""), x.d); await S.gestisciGET(richiesta("?conta=1"), x.d); await S.gestisciPOST(richiesta("", {}), x.d);
    c("guardia: chiesta una volta per ogni chiamata, anche per la conta e per il POST", 3, chiamataGuardia);
  }

  //  ── la guardia che lancia (Supabase non raggiungibile): JSON «interno», niente database, log solo col nome ──
  {
    const esiti = [];
    for (const vai of [(x) => S.gestisciGET(richiesta(""), x.d), (x) => S.gestisciPOST(richiesta("", { azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" }), x.d)]) {
      const db = fintoDb({ ordini: [riga(1)] });
      const x = dip(db, { guardia: async () => { throw new Error("rete caduta, cliente Anna Esempio"); } });
      const r = await leggi(await vai(x));
      esiti.push([r.stato, r.json.error, db.chiamate, x.log, JSON.stringify(r.json).includes("Anna")]);
    }
    c("guardia che lancia: 500 «interno» in JSON, database mai toccato, log solo col nome del tipo", [[500, "interno", 0, ["eccezione Error"], false], [500, "interno", 0, ["eccezione Error"], false]], esiti);
  }

  //  ── GET: elenco, pagine, tetto ──
  {
    const g = await GET(fintoDb({ ordini: molte(2500) }), "");
    c("elenco: 2500 righe → tutte, senza troncamento, risposta ok e senza cache", [200, true, 2500, false, 0, true, "no-store"], [g.stato, g.json.ok, g.json.ordini.length, g.json.troncato, g.json.scartati, g.json.migrazione.pronta, g.cache]);
    const db3 = fintoDb({ ordini: molte(2500) });
    await GET(db3, "");
    const pagine = db3.registro.filter((q) => q.tab === "shop_orders" && q.range).map((q) => q.range);
    c("elenco: 2500 righe = tre pagine da 1000", [[0, 999], [1000, 1999], [2000, 2999]], pagine);
    c("elenco: l'orologio è quello della rotta, in ISO", ADESSO.toISOString(), g.json.adesso);
    c("elenco: forma normalizzata (id, ref, stato, importi), non la riga grezza", [uuid(1), "HG-P1", "nuovo", 24.9, true], [g.json.ordini[0].id, g.json.ordini[0].ref, g.json.ordini[0].stato, g.json.ordini[0].totale, "creatoIl" in g.json.ordini[0]]);
    c("elenco: dal più recente al più vecchio", true, g.json.ordini.every((o, i, a) => i === 0 || a[i - 1].creatoIl >= o.creatoIl));

    const dbTetto = fintoDb({ ordini: molte(25000) });
    const t = await GET(dbTetto, "");
    c("elenco: 25000 righe → tetto a 20000 e `troncato`", [200, 20000, true], [t.stato, t.json.ordini.length, t.json.troncato]);
    const lette = dbTetto.registro.filter((q) => q.tab === "shop_orders" && q.range).length;
    c("elenco: 25000 righe non fanno più di 21 letture (sottorichieste del piano Free)", true, lette <= 21);
    const t2 = await GET(fintoDb({ ordini: molte(20000) }), "");
    c("elenco: esattamente 20000 righe → tutte e NON troncato", [20000, false], [t2.json.ordini.length, t2.json.troncato]);

    // un ordine che arriva mentre si leggono le pagine sposta le righe: la stessa riga non si conta due volte
    const doppie = molte(1500); doppie.splice(1000, 0, { ...doppie[999] });
    const dd = await GET(fintoDb({ ordini: doppie }), "");
    c("elenco: la riga letta due volte al confine fra due pagine conta una volta sola", [1500, 1500], [dd.json.ordini.length, new Set(dd.json.ordini.map((o) => o.id)).size]);

    //  righe ostili: non lanciano, o si contano come scartate
    const enorme = riga(2, { items: Array.from({ length: 500 }, (_, i) => ({ name: `P${i}`, qty: 1, unit_price: 1 })) });
    const cinqueMega = riga(3, { note: "x".repeat(5_000_000), nome: "y".repeat(5_000_000) });
    const rotta = { id: null, created_at: "boh", total: "?" };
    const senzaData = riga(4, { created_at: null });
    const malformata = riga(5, { items: "non è un elenco", total: "abc", subtotal: {}, shipping: [] });
    const o = await GET(fintoDb({ ordini: [riga(1), enorme, cinqueMega, rotta, senzaData, malformata] }), "");
    c("righe ostili: risposta 200, quelle illeggibili (senza id o senza data) contate in `scartati`", [200, 2, 4], [o.stato, o.json.scartati, o.json.ordini.length]);
    const oe = o.json.ordini.find((x) => x.id === uuid(2));
    c("righe ostili: 500 righe d'ordine → troncate e dichiarate", [true, 200], [oe.righeTroncate, oe.righe.length]);
    const om = o.json.ordini.find((x) => x.id === uuid(3));
    c("righe ostili: testi da 5 MB tagliati, la risposta resta piccola", true, om.note.length <= 5000 && JSON.stringify(o.json).length < 100_000);

    // importi assurdi
    const assurdi = riga(6, { total: "1e999", subtotal: 1e308, shipping: -1e999, pagato_il: "2026-11-17T12:00:00Z", pagato_importo: "1e999", items: [{ name: "X", qty: 1e308, unit_price: 1e308 }, { name: "Y", qty: -5, unit_price: "boh" }] });
    const a = await GET(fintoDb({ ordini: [assurdi, riga(7, { total: 1e308, pagato_il: "2026-11-17T12:00:00Z", pagato_importo: 1e308 })] }), "");
    const numeri = [];
    const guarda = (v) => { if (typeof v === "number") numeri.push(v); else if (v && typeof v === "object") Object.values(v).forEach(guarda); };
    guarda(a.json.ordini);
    c("importi assurdi: 200, nessun numero nullo al posto dei numeri, tutti finiti", [200, 2, true], [a.stato, a.json.ordini.length, numeri.length > 0 && numeri.every(Number.isFinite)]);
    c("importi assurdi: totale e importi sono numeri (mai null)", true, a.json.ordini.every((x) => typeof x.totale === "number" && typeof x.subtotale === "number" && typeof x.spedizione === "number"));
  }

  //  ── la sonda: M1 non applicata ──
  {
    const m = fintoDb({ ordini: [riga(1)], mancante: true });
    const g = await GET(m, "");
    c("M1 assente: l'elenco risponde lo stesso, con `pronta: false`", [200, false, 1], [g.stato, g.json.migrazione.pronta, g.json.ordini.length]);
    const ok = await GET(fintoDb({ ordini: [riga(1)] }), "");
    c("M1 presente: `pronta: true`", true, ok.json.migrazione.pronta);

    const azioni = [
      { azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" },
      { azione: "pagato", ordineId: ID, metodo: "bonifico" },
      { azione: "pagamento_annullato", ordineId: ID },
      { azione: "tracking", ordineId: ID, valore: "AB123" },
      { azione: "nota_interna", ordineId: ID, valore: "ciao" },
      { azione: "elimina", ordineId: ID },
      { azione: "collega", ordineId: ID },
    ];
    const esiti = [];
    for (const a of azioni) {
      const db = fintoDb({ ordini: [riga(1)], mancante: true });
      const r = await POST(db, a);
      esiti.push([r.stato, r.json.error, db.scritture.length, db.registro.some((q) => q.tab === "shop_order_eventi" && q.op === "insert")]);
    }
    c("M1 assente: ogni POST → 409 «migrazione», nessuna scrittura, nessun evento", true, esiti.every((e) => e[0] === 409 && e[1] === "migrazione" && e[2] === 0 && e[3] === false));

    const l = await GET(fintoDb({ ordini: [riga(1)], mancante: true }), `?lead=${uuid(9)}`);
    c("M1 assente: `?lead=` non legge colonne che non ci sono → elenco vuoto e pronta false", [200, [], false], [l.stato, l.json.ordini, l.json.migrazione.pronta]);
    const s = await GET(fintoDb({ mancante: true }), `?storico=${ID}`);
    c("M1 assente: `?storico=` → nessun evento e pronta false", [200, [], false], [s.stato, s.json.eventi, s.json.migrazione.pronta]);

    // un errore della sonda che non è «manca la colonna» non vale «manca»: si dice errore e non si scrive
    const guasto = fintoDb({ ordini: [riga(1)], errori: { "shop_orders.select": (q) => (q.cols.includes("pagato_il") ? { error: { code: "57014", message: "timeout", details: null } } : undefined) } });
    const p = await POST(guasto, { azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" });
    c("sonda in errore (non «manca la colonna»): 500, nessuna scrittura", [500, "interno", 0], [p.stato, p.json.error, guasto.scritture.length]);
    const gg = await GET(guasto, "");
    c("sonda in errore: l'elenco risponde 500 e non finge che la migrazione sia pronta", [500, false], [gg.stato, gg.json.ok]);
  }

  //  ── conta, ?lead=, ?storico= ──
  {
    const ordini = [riga(1), riga(2, { status: "spedito" }), riga(3), riga(4, { status: "annullato" })];
    const cn = fintoDb({ ordini });
    const n = await GET(cn, "?conta=1");
    c("conta: solo gli ordini «nuovo», risposta minima", [200, { ok: true, nuovi: 2 }], [n.stato, n.json]);
    c("conta: una sola richiesta al database, senza leggere le righe", [1, true], [cn.chiamate, cn.registro[0].opzioni?.head === true]);
    const ne = await GET(fintoDb({ ordini, errori: { "shop_orders.select": { error: { code: "57014", message: "x" } } } }), "?conta=1");
    c("conta: errore del database → 500 senza numero inventato", [500, false, undefined], [ne.stato, ne.json.ok, ne.json.nuovi]);

    const lead = await GET(fintoDb({ ordini: [riga(1, { lead_id: uuid(90) }), riga(2, { lead_id: uuid(91) }), riga(3, { lead_id: uuid(92) }), riga(4)] }), `?lead=${uuid(90)},${uuid(92)}`);
    c("?lead=: solo gli ordini di quelle schede, stessa forma dell'elenco", [200, [uuid(1), uuid(3)], 0, false, true], [lead.stato, lead.json.ordini.map((o) => o.id), lead.json.scartati, lead.json.troncato, lead.json.migrazione.pronta]);
    const venti = Array.from({ length: 20 }, (_, i) => uuid(100 + i)).join(",");
    c("?lead=: 20 id vanno bene", 200, (await GET(fintoDb({ ordini: [riga(1)] }), `?lead=${venti}`)).stato);

    const cattivi = ["", "x", "1 OR 1=1", `${uuid(90)},x`, `${uuid(90)},`, `${uuid(90)})&select=*`, "00000000-0000-4000-8000-00000000009g", `${venti},${uuid(200)}`, `${uuid(90)};drop`, "*", "null", `${uuid(90)}%2C${uuid(91)}`];
    const rif = [];
    for (const v of cattivi) { const db = fintoDb({ ordini: [riga(1)] }); const r = await GET(db, `?lead=${encodeURIComponent(v)}`); rif.push([v, r.stato, r.json.error, db.chiamate]); }
    c("?lead=: ogni id che non è UUID (o più di 20) → 400 «valore», PRIMA del database", [], rif.filter(([, s, e, ch]) => s !== 400 || e !== "valore" || ch !== 0));

    const ev = [
      { id: "e1", created_at: "2026-11-17T10:00:00Z", order_id: ID, order_ref: "HG-P1", tipo: "stato", chi: "Giulia Esempio", prima: { stato: "nuovo" }, dopo: { stato: "spedito" } },
      { id: "e2", created_at: "2026-11-17T11:00:00Z", order_id: ID, order_ref: "HG-P1", tipo: "tracking", chi: "Titolare", prima: { tracking: null }, dopo: { tracking: "AB123" } },
      { id: "e3", created_at: "2026-11-17T12:00:00Z", order_id: uuid(2), order_ref: "HG-P2", tipo: "stato", chi: "Altro", prima: {}, dopo: {} },
    ];
    const st = await GET(fintoDb({ ordini: [riga(1)], eventi: ev }), `?storico=${ID}`);
    c("?storico=: gli eventi di quell'ordine, dal più recente", [200, ["e2", "e1"], ["tracking", "stato"], "Giulia Esempio", { stato: "spedito" }, true], [st.stato, st.json.eventi.map((e) => e.id), st.json.eventi.map((e) => e.tipo), st.json.eventi[1].chi, st.json.eventi[1].dopo, st.json.migrazione.pronta]);
    c("?storico=: ogni evento ha id, data, tipo, chi, prima e dopo", ["chi", "creatoIl", "dopo", "id", "prima", "tipo"], Object.keys(st.json.eventi[0]).sort());
    const cattivi2 = ["", "x", "1 OR 1=1", `${ID},${uuid(2)}`, `${ID}'`];
    const rif2 = [];
    for (const v of cattivi2) { const db = fintoDb({ eventi: ev }); const r = await GET(db, `?storico=${encodeURIComponent(v)}`); rif2.push([v, r.stato, r.json.error, db.chiamate]); }
    c("?storico=: id che non è UUID → 400 «valore», PRIMA del database", [], rif2.filter(([, s, e, ch]) => s !== 400 || e !== "valore" || ch !== 0));
    const evx = [{ id: "e9", created_at: "2026-11-17T10:00:00Z", order_id: ID, tipo: "stato", chi: null, prima: "boh", dopo: [1] }];
    const sx = await GET(fintoDb({ eventi: evx }), `?storico=${ID}`);
    c("?storico=: prima/dopo non oggetto e chi vuoto non rompono la risposta", [200, {}, {}], [sx.stato, sx.json.eventi[0].prima, sx.json.eventi[0].dopo]);
  }

  //  ── POST: la sequenza lettura → scrittura → evento ──
  {
    const db = fintoDb({ ordini: [riga(1), riga(2)] });
    const r = await POST(db, { azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" });
    c("stato: ok, l'ordine nuovo è nella risposta con lo stato scelto", [200, true, "spedito", true, "no-store"], [r.stato, r.json.ok, r.json.ordine.stato, r.json.storico, r.cache]);
    c("stato: la riga è scritta nel database, solo quella", ["spedito", "nuovo"], [db.tabelle.shop_orders[0].status, db.tabelle.shop_orders[1].status]);
    const upd = db.registro.find((q) => q.op === "update");
    c("stato: l'update riguarda solo l'ordine, chiede indietro le righe (`.select(\"id\")`) e usa la lista bianca", [[["eq", "id", ID], ["eq", "status", "nuovo"]], "id", true], [upd.filtri, upd.chiestiIndietro, Object.keys(upd.patch).every((k) => LISTA_BIANCA.includes(k))]);
    const ordine = db.registro.map((q) => `${q.tab}.${q.op}`);
    c("stato: sequenza = sonda, lettura dell'ordine, update, poi l'evento", ["shop_orders.select", "shop_order_eventi.select", "shop_orders.select", "shop_orders.update", "shop_order_eventi.insert"], ordine);
    c("stato: l'evento lo scrive il server (ordine, ref, tipo, chi, prima, dopo)", [{ chi: "Giulia Esempio", dopo: { stato: "spedito" }, order_id: ID, order_ref: "HG-P1", prima: { stato: "nuovo" }, tipo: "stato" }], db.tabelle.shop_order_eventi.map(({ id, ...e }) => Object.fromEntries(Object.entries(e).sort())));

    // l'evento e la patch non vengono dal browser
    const db2 = fintoDb({ ordini: [riga(1)] });
    await POST(db2, { azione: "tracking", ordineId: ID, valore: "ZZ9", chi: "Falso", evento: { tipo: "pagato", chi: "Falso" }, patch: { status: "annullato", nome: "Hacker" }, status: "annullato", nome: "Hacker", totale: 0 });
    const u2 = db2.registro.find((q) => q.op === "update");
    c("POST: patch, evento, chi e altri campi mandati dal browser sono ignorati", [["aggiornato_il", "tracking"], "tracking", "Giulia Esempio", "Anna"], [Object.keys(u2.patch).sort(), db2.tabelle.shop_order_eventi[0].tipo, db2.tabelle.shop_order_eventi[0].chi, db2.tabelle.shop_orders[0].nome]);

    // chi: nome mai vuoto
    const nomi = [["Giulia Esempio", "Giulia Esempio"], ["", "Titolare"], ["   ", "Titolare"], [undefined, "Titolare"], [null, "Titolare"], [42, "Titolare"], ["  Marco Prova  ", "Marco Prova"], ["N".repeat(500), "N".repeat(100)]];
    const chi = [];
    for (const [nome] of nomi) {
      const d = fintoDb({ ordini: [riga(1)] });
      await POST(d, { azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" }, { nome });
      chi.push(d.tabelle.shop_order_eventi[0]?.chi);
    }
    c("chi: il nome dell'utente dalla guardia; vuoto o assente → «Titolare»; tetto a 100", nomi.map((n) => n[1]), chi);
  }

  //  ── POST: concorrenza ──
  {
    // un altro utente cambia lo stato fra la lettura e la scrittura: 0 righe = 409, niente evento
    const db = fintoDb({ ordini: [riga(1)], prima: { "shop_orders.update": (t, q) => { if (q.patch.status) t.shop_orders[0].status = "annullato"; } } });
    const r = await POST(db, { azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" });
    c("aggiornamento con 0 righe → 409 «conflitto»", [409, false, "conflitto"], [r.stato, r.json.ok, r.json.error]);
    c("0 righe: nessun evento scritto, la riga resta come l'ha lasciata l'altro", [0, "annullato"], [db.tabelle.shop_order_eventi.length, db.tabelle.shop_orders[0].status]);
    c("0 righe: messaggio leggibile, in italiano", true, typeof r.json.messaggio === "string" && r.json.messaggio.length > 10);

    // pagato_il a microsecondi: passa tale e quale
    const PI = "2026-11-17T15:00:00.123456+00:00";
    const dm = fintoDb({ ordini: [riga(1, { pagato_il: PI, pagato_importo: 24.9, metodo_pagamento: "bonifico" })] });
    const rm = await POST(dm, { azione: "pagamento_annullato", ordineId: ID });
    const um = dm.registro.find((q) => q.op === "update");
    c("pagato_il a microsecondi: `.eq` col testo identico, update riuscito, pagamento tolto", [200, [["eq", "id", ID], ["eq", "pagato_il", PI]], null], [rm.stato, um.filtri, dm.tabelle.shop_orders[0].pagato_il]);
    c("pagato_il a microsecondi: l'evento conserva data, importo e metodo", [{ pagato_il: PI, pagato_importo: 24.9, metodo_pagamento: "bonifico" }], [dm.tabelle.shop_order_eventi[0].prima]);
    const dm2 = fintoDb({ ordini: [riga(1, { pagato_il: PI })], prima: { "shop_orders.update": (t) => { t.shop_orders[0].pagato_il = "2026-11-17T15:00:00.123457+00:00"; } } });
    const rm2 = await POST(dm2, { azione: "pagamento_annullato", ordineId: ID });
    c("pagato_il: cambiato di UN microsecondo da un altro → 409, non si scrive", [409, "2026-11-17T15:00:00.123457+00:00", 0], [rm2.stato, dm2.tabelle.shop_orders[0].pagato_il, dm2.tabelle.shop_order_eventi.length]);
    // il database rende il timestamp in un altro formato (spazio, +00): la condizione è quella letta, non una riscrittura
    const dm3 = fintoDb({ ordini: [riga(1, { pagato_il: "2026-11-17 15:00:00.5+00" })] });
    await POST(dm3, { azione: "pagamento_annullato", ordineId: ID });
    c("pagato_il: il testo letto dal database arriva alla condizione senza passare da `Date`", [["eq", "pagato_il", "2026-11-17 15:00:00.5+00"]], dm3.registro.find((q) => q.op === "update").filtri.filter((f) => f[1] === "pagato_il"));

    // null → `.is`, mai `.eq(col, null)`
    const dn = fintoDb({ ordini: [riga(1)] });
    const rn = await POST(dn, { azione: "pagato", ordineId: ID, metodo: "carta" });
    const un = dn.registro.find((q) => q.op === "update");
    c("pagato: la condizione «non ancora pagato» è `.is(pagato_il, null)`", [200, [["eq", "id", ID], ["is", "pagato_il", null]], "carta"], [rn.stato, un.filtri, dn.tabelle.shop_orders[0].metodo_pagamento]);
    c("pagato: nessun `.eq(col, null)` in nessuna chiamata", false, dn.registro.some((q) => q.filtri.some((f) => f[0] === "eq" && f[2] === null)));
    c("pagato: l'evento ha chi, tipo e le tre cose scritte", ["pagato", "carta", "Giulia Esempio"], [dn.tabelle.shop_order_eventi[0].tipo, dn.tabelle.shop_order_eventi[0].dopo.metodo_pagamento, dn.tabelle.shop_order_eventi[0].chi]);
    const dd = fintoDb({ ordini: [riga(1)], prima: { "shop_orders.update": (t) => { t.shop_orders[0].pagato_il = "2026-11-18T09:00:00Z"; } } });
    c("pagato: già segnato da un altro nel frattempo → 409 e niente doppio incasso", [409, "2026-11-18T09:00:00Z"], [(await POST(dd, { azione: "pagato", ordineId: ID, metodo: "carta" })).stato, dd.tabelle.shop_orders[0].pagato_il]);

    // null sui testi = NULL oppure ''
    for (const [nome, extra] of [["NULL", { tracking: null }], ["testo vuoto", { tracking: "" }]]) {
      const dt = fintoDb({ ordini: [riga(1, extra)] });
      const rt = await POST(dt, { azione: "tracking", ordineId: ID, valore: "AB123" });
      const ut = dt.registro.find((q) => q.op === "update");
      c(`tracking su colonna ${nome}: condizione «NULL oppure ''» e scrittura riuscita`, [200, [["eq", "id", ID], ["or", "tracking.is.null,tracking.eq.", null]], "AB123"], [rt.stato, ut.filtri, dt.tabelle.shop_orders[0].tracking]);
    }
    for (const [nome, extra] of [["NULL", { status: null }], ["testo vuoto", { status: "" }]]) {
      const ds = fintoDb({ ordini: [riga(1, extra)] });
      const rs = await POST(ds, { azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" });
      c(`stato su colonna ${nome}: la condizione non resta 409 per sempre`, [200, "spedito"], [rs.stato, ds.tabelle.shop_orders[0].status]);
    }
    const dnota = fintoDb({ ordini: [riga(1, { note_interne: "" })] });
    c("nota su colonna vuota: scrive con `.or`", [200, "ciao", true], [(await POST(dnota, { azione: "nota_interna", ordineId: ID, valore: "ciao" })).stato, dnota.tabelle.shop_orders[0].note_interne, dnota.registro.some((q) => q.filtri.some((f) => f[0] === "or" && f[1] === "note_interne.is.null,note_interne.eq."))]);
    // testo con virgole, punti, apici: passa come valore, non si spezza (la condizione è `.eq`, non `.or`)
    const NOTA = "ritirare, \"urgente\" (sì.) a.b,c.d";
    const dv = fintoDb({ ordini: [riga(1, { note_interne: NOTA })] });
    const rv = await POST(dv, { azione: "nota_interna", ordineId: ID, valore: "altro" });
    c("nota con virgole e virgolette: la condizione è `.eq` col testo intero", [200, [["eq", "id", ID], ["eq", "note_interne", NOTA]]], [rv.stato, dv.registro.find((q) => q.op === "update").filtri]);

    // spazi ai bordi scritti a mano: 0 righe, UNA rilettura, un solo nuovo tentativo con il testo vero
    const dsp = fintoDb({ ordini: [riga(1, { tracking: "  AB123  " })] });
    const rsp = await POST(dsp, { azione: "tracking", ordineId: ID, valore: "ZZ9" });
    const upds = dsp.registro.filter((q) => q.op === "update");
    c("spazi ai bordi: dopo 0 righe si rilegge UNA volta e si riprova col testo vero → riuscito", [200, "ZZ9", 2, [["eq", "id", ID], ["eq", "tracking", "  AB123  "]]], [rsp.stato, dsp.tabelle.shop_orders[0].tracking, upds.length, upds[1].filtri]);
    const lettureDopo = dsp.registro.slice(dsp.registro.indexOf(upds[0]) + 1, dsp.registro.indexOf(upds[1]));
    c("spazi ai bordi: fra i due tentativi c'è esattamente una lettura dell'ordine", [["shop_orders.select"]], [lettureDopo.map((q) => `${q.tab}.${q.op}`)]);
    c("spazi ai bordi: l'evento è scritto una volta sola", 1, dsp.tabelle.shop_order_eventi.length);
    // testo di soli spazi scritto a mano: per T8 è «vuoto», per `.or(is.null, eq.)` no → non deve restare 409 per sempre (N2 del revisore)
    for (const [azione, colonna, extra, corpo] of [
      ["tracking", "tracking", { tracking: "   " }, { azione: "tracking", ordineId: ID, valore: "ZZ9" }],
      ["nota", "note_interne", { note_interne: " \t " }, { azione: "nota_interna", ordineId: ID, valore: "ciao" }],
      ["stato", "status", { status: "  " }, { azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" }],
    ]) {
      const dw = fintoDb({ ordini: [riga(1, extra)] });
      const rw = await POST(dw, corpo);
      const uw = dw.registro.filter((q) => q.op === "update");
      c(`solo spazi in «${azione}»: dopo 0 righe si riprova col testo vero → riuscito, due update, un evento`, [200, 2, extra[colonna], 1], [rw.stato, uw.length, uw[1]?.filtri.find((f) => f[1] === colonna)?.[2], dw.tabelle.shop_order_eventi.length]);
    }
    const dwc = fintoDb({ ordini: [riga(1, { tracking: "   " })], prima: { "shop_orders.update": (t) => { t.shop_orders[0].tracking = "ALTRO77"; } } });
    c("solo spazi, ma cambiato davvero da un altro → 409, un solo update", [409, 1], [(await POST(dwc, { azione: "tracking", ordineId: ID, valore: "ZZ9" })).stato, dwc.registro.filter((q) => q.op === "update").length]);
    // conflitto vero con testo: dopo la rilettura il valore è davvero diverso → 409 senza secondo tentativo
    const dcv = fintoDb({ ordini: [riga(1, { tracking: "AB123" })], prima: { "shop_orders.update": (t) => { t.shop_orders[0].tracking = "ALTRO77"; } } });
    const rcv = await POST(dcv, { azione: "tracking", ordineId: ID, valore: "ZZ9" });
    c("conflitto vero su un testo: 409 dopo una rilettura, un solo update, niente evento", [409, 1, "ALTRO77", 0], [rcv.stato, dcv.registro.filter((q) => q.op === "update").length, dcv.tabelle.shop_orders[0].tracking, dcv.tabelle.shop_order_eventi.length]);
    // anche il secondo tentativo può perdere: 409, mai un terzo
    let n = 0;
    const dd3 = fintoDb({ ordini: [riga(1, { tracking: "  AB123  " })], prima: { "shop_orders.update": (t) => { if (++n === 2) t.shop_orders[0].tracking = "ALTRO77"; } } });
    const rd3 = await POST(dd3, { azione: "tracking", ordineId: ID, valore: "ZZ9" });
    c("il secondo tentativo perde la corsa → 409, mai un terzo tentativo", [409, 2], [rd3.stato, dd3.registro.filter((q) => q.op === "update").length]);
    // l'ordine sparisce fra update e rilettura
    const dsv = fintoDb({ ordini: [riga(1, { tracking: "AB123" })], prima: { "shop_orders.update": (t) => { t.shop_orders.length = 0; } } });
    const rsv = await POST(dsv, { azione: "tracking", ordineId: ID, valore: "ZZ9" });
    c("l'ordine non c'è più alla rilettura → 404 «non_trovato»", [404, "non_trovato"], [rsv.stato, rsv.json.error]);
  }

  //  ── POST: errori del database, evento, esiti di T8 ──
  {
    const ev = fintoDb({ ordini: [riga(1)], errori: { "shop_order_eventi.insert": { error: { code: "23505", message: "boom", details: "Key (nome)=(Anna) già presente" } } } });
    const r = await POST(ev, { azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" });
    c("evento che fallisce: ordine scritto, risposta ok con `storico: false`", [200, true, false, "spedito", "spedito"], [r.stato, r.json.ok, r.json.storico, r.json.ordine.stato, ev.tabelle.shop_orders[0].status]);
    const evl = fintoDb({ ordini: [riga(1)], errori: { "shop_order_eventi.insert": { lancia: new Error("rete caduta, cliente Anna Esempio") } } });
    const rl = await POST(evl, { azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" });
    c("evento che lancia: stesso esito, `storico: false`", [200, false, "spedito"], [rl.stato, rl.json.storico, evl.tabelle.shop_orders[0].status]);

    const eu = fintoDb({ ordini: [riga(1)], errori: { "shop_orders.update": { error: { code: "23514", message: "check", details: "Failing row contains (Anna, Esempio)" } } } });
    const ru = await POST(eu, { azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" });
    c("update in errore: 500 «interno», nessun evento, ordine intatto", [500, "interno", 0, "nuovo"], [ru.stato, ru.json.error, eu.tabelle.shop_order_eventi.length, eu.tabelle.shop_orders[0].status]);
    const emc = fintoDb({ ordini: [riga(1)], errori: { "shop_orders.update": { error: { code: "42703", message: "no column" } } } });
    c("update che trova una colonna mancante (migrazione tolta a metà): 409 «migrazione»", [409, "migrazione"], [(await POST(emc, { azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" })).stato, (await POST(emc, { azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" })).json.error]);

    // gli esiti di T8 diventano stato e testo
    const casi = [
      [{ azione: "stato", ordineId: ID, da: "nuovo", a: "nuovo" }, 200, "nessun_cambio", {}],
      [{ azione: "stato", ordineId: ID, da: "spedito", a: "consegnato" }, 409, "conflitto", {}],
      [{ azione: "stato", ordineId: ID, da: "nuovo", a: "rimborsato" }, 400, "valore", {}],
      [{ azione: "pagato", ordineId: ID, metodo: "bitcoin" }, 400, "valore", {}],
      [{ azione: "pagato", ordineId: ID, metodo: "carta", importo: -5 }, 400, "valore", {}],
      [{ azione: "pagamento_annullato", ordineId: ID }, 409, "conflitto", {}],
      [{ azione: "tracking", ordineId: ID, valore: "x".repeat(121) }, 400, "valore", {}],
      [{ azione: "nota_interna", ordineId: ID, valore: 5 }, 400, "valore", {}],
      [{ azione: "elimina", ordineId: ID }, 400, "azione_sconosciuta", {}],
      [{ azione: "cancella", ordineId: ID }, 400, "azione_sconosciuta", {}],
      [{ azione: "delete", ordineId: ID }, 400, "azione_sconosciuta", {}],
      [{ azione: "collega", ordineId: ID, leadId: uuid(9), via: "persona" }, 400, "azione_sconosciuta", {}],
      [{ ordineId: ID }, 400, "azione_sconosciuta", {}],
    ];
    const sb = [];
    for (const [corpo, stato, errore] of casi) {
      const db = fintoDb({ ordini: [riga(1)] });
      const r = await POST(db, corpo);
      if (r.stato !== stato || r.json.ok !== false || r.json.error !== errore || db.scritture.length !== 0 || typeof r.json.messaggio !== "string") sb.push([corpo.azione, r.stato, r.json.error, db.scritture.length]);
    }
    c("esiti di T8: valore 400, conflitto 409, nessun_cambio 200 (ok:false), azione sconosciuta 400; mai una scrittura", [], sb);

    // ordineId e corpo
    const brutti = [undefined, null, "", "x", "1;drop table shop_orders", `${ID}x`, 5, [ID], { id: ID }, "00000000-0000-4000-8000-00000000000g", ID.toUpperCase().slice(0, 35)];
    const rif = [];
    for (const v of brutti) { const db = fintoDb({ ordini: [riga(1)] }); const r = await POST(db, { azione: "tracking", ordineId: v, valore: "A" }); rif.push([String(v), r.stato, r.json.error, db.chiamate]); }
    c("ordineId che non è UUID → 400 «valore», PRIMA del database", [], rif.filter(([, s, e, ch]) => s !== 400 || e !== "valore" || ch !== 0));
    const corpi = ["", "non json", "[]", "null", "5", "\"x\"", `{"azione": "stato"`, JSON.stringify({ azione: "nota_interna", ordineId: ID, valore: "a".repeat(100_000) })];
    const rc = [];
    for (const b of corpi) { const db = fintoDb({ ordini: [riga(1)] }); const r = await POST(db, b); rc.push([b.slice(0, 12), r.stato, db.scritture.length]); }
    c("corpo vuoto, non JSON, non oggetto o enorme → 400, nessuna scrittura", true, rc.every(([, s, w]) => s === 400 && w === 0));
    // corpo troppo grande: rifiutato dall'intestazione, senza leggerlo (N4)
    {
      let lette = 0;
      const db = fintoDb({ ordini: [riga(1)] });
      const x = dip(db);
      const finta = { url: "https://crm.example.com/api/crm/ordini", method: "POST", headers: new Headers({ "content-length": "20001" }), text: async () => { lette++; return "{}"; } };
      const r = await leggi(await S.gestisciPOST(finta, x.d));
      c("content-length oltre il tetto → 413, corpo mai letto, database mai toccato", [413, "valore", 0, 0], [r.stato, r.json.error, lette, db.chiamate]);
      const ok = await POST(fintoDb({ ordini: [riga(1)] }), { azione: "tracking", ordineId: ID, valore: "A" });
      c("content-length nel tetto (o assente): il POST normale passa", 200, ok.stato);
    }
    const nt = await POST(fintoDb({ ordini: [riga(2)] }), { azione: "tracking", ordineId: ID, valore: "A" });
    c("ordine che non esiste → 404 «non_trovato», nessuna scrittura", [404, "non_trovato"], [nt.stato, nt.json.error]);
    const illeggibile = fintoDb({ ordini: [riga(1, { created_at: null })] });
    const ri = await POST(illeggibile, { azione: "tracking", ordineId: ID, valore: "A" });
    c("riga non leggibile (senza data) → 404 «non_trovato», non si scrive su ciò che non si legge", [404, 0], [ri.stato, illeggibile.scritture.length]);
    const lettura = fintoDb({ ordini: [riga(1)], errori: { "shop_orders.select": (q) => (q.filtri.some((f) => f[1] === "id") ? { error: { code: "57014", message: "t" } } : undefined) } });
    const rle = await POST(lettura, { azione: "tracking", ordineId: ID, valore: "A" });
    c("lettura dell'ordine in errore → 500, nessuna scrittura", [500, 0], [rle.stato, lettura.scritture.length]);
    // prima di scrivere, nessun update senza il filtro sull'id
    const tutte = [];
    for (const corpo of [{ azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" }, { azione: "tracking", ordineId: ID, valore: "A" }, { azione: "nota_interna", ordineId: ID, valore: "N" }, { azione: "pagato", ordineId: ID, metodo: "altro" }]) {
      const db = fintoDb({ ordini: [riga(1), riga(2)] });
      await POST(db, corpo);
      tutte.push(db.registro.filter((q) => q.op === "update").every((q) => q.filtri.some((f) => f[0] === "eq" && f[1] === "id" && f[2] === ID)));
    }
    c("ogni update porta il filtro sull'id: mai su più ordini", [true, true, true, true], tutte);
  }

  //  ── log: solo codici ──
  {
    const PERSONALI = ["Anna", "Esempio", "anna.esempio@example.com", "+39 300 000 0001", "Via Inventata 1", "Cittàfinta", "00000"];
    const dettagli = `Failing row contains (${PERSONALI.join(", ")}).`;
    const err = (code) => ({ error: { code, message: `violazione per ${PERSONALI.join(" ")}`, details: dettagli, hint: dettagli, toString() { return dettagli; } } });
    const scenari = [
      ["lettura elenco", (errori) => GET(fintoDb({ ordini: [riga(1)], errori }), ""), { "shop_orders.select": (q) => (q.range ? err("XX001") : undefined) }],
      ["conta", (errori) => GET(fintoDb({ ordini: [riga(1)], errori }), "?conta=1"), { "shop_orders.select": err("XX002") }],
      ["storico", (errori) => GET(fintoDb({ eventi: [], errori }), `?storico=${ID}`), { "shop_order_eventi.select": (q) => (q.cols.includes("tipo") ? err("XX003") : undefined) }],
      ["update", (errori) => POST(fintoDb({ ordini: [riga(1)], errori }), { azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" }), { "shop_orders.update": err("XX004") }],
      ["evento", (errori) => POST(fintoDb({ ordini: [riga(1)], errori }), { azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" }), { "shop_order_eventi.insert": err("XX005") }],
      ["lettura ordine", (errori) => POST(fintoDb({ ordini: [riga(1)], errori }), { azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" }), { "shop_orders.select": (q) => (q.filtri.some((f) => f[1] === "id") ? err("XX006") : undefined) }],
      ["eccezione", (errori) => POST(fintoDb({ ordini: [riga(1)], errori }), { azione: "stato", ordineId: ID, da: "nuovo", a: "spedito" }), { "shop_orders.update": { lancia: new Error(`rete: ${dettagli}`) } }],
    ];
    const brutti = [];
    const codici = [];
    for (const [nome, vai, errori] of scenari) {
      const r = await vai(errori);
      const testi = [...r.log, String(r.json.error ?? ""), String(r.json.messaggio ?? "")]; // una risposta ok porta l'ordine, che è del cliente per forza
      if (!r.log.length) brutti.push([nome, "nessun log"]);
      if (!r.log.every((x) => typeof x === "string" && /^[A-Za-z0-9 _.:-]{1,80}$/.test(x))) brutti.push([nome, "log non solo codici", r.log]);
      if (PERSONALI.some((p) => testi.some((t) => t.includes(p)))) brutti.push([nome, "dato del cliente nel log o nella risposta"]);
      codici.push(r.log.join("|"));
    }
    c("log: mai l'oggetto errore né dati del cliente, né nei log né nelle risposte", [], brutti);
    c("log: contiene il codice dell'errore (error.code)", [true, true, true, true, true, true], codici.slice(0, 6).map((l, i) => l.includes(`XX00${i + 1}`)));
    c("log: l'eccezione dice solo il nome del tipo", true, /Error/.test(codici[6]) && !codici[6].includes("rete"));
  }

  //  ── il testo della rotta e del modulo ──
  {
    const rotta = src("src/routes/api.crm.ordini.ts");
    const modulo = src("src/crm/ecommerce/ordini.server.ts");
    const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");
    const R = senzaCommenti(rotta), M = senzaCommenti(modulo);
    c("rotta: `guardiaCRM(request, …, \"pagamenti\"` con la guardia del CRM", true, /guardiaCRM\(\s*request,\s*[^,]+,\s*"pagamenti"/.test(R));
    c("rotta: i soli gestori sono GET e POST, e ciascuno passa dal modulo (che apre con la guardia)", [["GET", "POST"], true, true], [[...R.matchAll(/^\s{6}([A-Z]+):/gm)].map((m) => m[1]), /GET:[^\n]*gestisciGET\(/.test(R), /POST:[^\n]*gestisciPOST\(/.test(R)]);
    for (const f of ["gestisciGET", "gestisciPOST"]) {
      const corpo = M.slice(M.indexOf(`export async function ${f}`));
      c(`modulo: ${f} apre con la guardia (dentro il try), prima di ogni altra cosa`, true, /^export async function \w+\([^{}]*\): Promise<Response> \{\s*try \{\s*const g = await d\.guardia\(request\);\s*if \(!g\.ok\) return g\.risposta;/.test(corpo));
    }
    c("nessuna chiave o indirizzo nel codice (solo il client del server)", [false, false, false, false], [/eyJ[A-Za-z0-9_-]{10,}/.test(R + M), /SERVICE_ROLE|process\.env|sb_secret/.test(R + M), /https:\/\/[a-z0-9]+\.supabase\.co/i.test(R + M), /createClient/.test(R + M)]);
    c("`supabaseAdmin` solo nella rotta: il modulo riceve il client", [true, false], [/supabaseAdmin/.test(R), /supabaseAdmin|client\.server/.test(M)]);
    const altri = ["ordine.ts", "conti.ts", "azioni.ts"].some((f) => /supabaseAdmin|client\.server/.test(src(`src/crm/ecommerce/${f}`)));
    c("`supabaseAdmin` non compare negli altri moduli dell'area", false, altri);
    const consoleArgs = [...(R + M).matchAll(/console\.\w+\(([^;]*)\)/g)].map((m) => m[1]);
    c("nessun `console.*` con un oggetto errore: solo testi con il codice", true, consoleArgs.every((a) => !/\b(e|err|error|erro|ex)\b\s*[,)]|\.message|\.details|JSON\.stringify/.test(a) && /`|"/.test(a)));
    c("modulo: nessun console, il log passa dalla porta", false, /console\./.test(M));
    c("modulo: l'update chiede indietro le righe, le condizioni nulle usano `.is` e `.or`", [true, true, true], [/\.select\("id"\)/.test(M), /\.is\(/.test(M), /\.or\(`/.test(M)]);
    c("modulo: i valori delle condizioni non passano da `new Date`", false, /new Date\(/.test(M.slice(M.indexOf("condizioni"))));
    c("D11: nessun delete e nessuna parola «elimina/cancella» nel codice", false, /\.delete\(|\belimina\b|\bcancella\b/i.test(R + M));
    c("ogni risposta è no-store", true, /no-store/.test(M));
    c("ogni id passa da `eUuid` di azioni.ts (ordineId, ?lead=, ?storico=)", true, (M.match(/\beUuid\b/g) ?? []).length >= 3);
    c("«Titolare» come nome di ripiego", true, /"Titolare"/.test(M));
  }
}
