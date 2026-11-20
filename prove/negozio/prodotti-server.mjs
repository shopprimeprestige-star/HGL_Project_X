/** ── NEGOZIO · T08 · IL SERVER DEI PRODOTTI ─────────────────────────────────
 *  `src/crm/negozio/prodotti.server.ts` riceve la guardia, il database, l'orologio, il log e la chiave di servizio
 *  (porte) e fa tutto il lavoro; la rotta (T10) li collega a `guardiaCRM` e a `supabaseAdmin`.
 *  Qui il database è il finto di T01 (`_finto-db.mjs`): nessuna rete, nessuna chiave, nessuna migrazione.
 *  ⚠️ Il finto NON ha il trigger `shop_controlla_pubblicazione`: il rifiuto del database si prova con un errore programmato.
 *  Dati inventati (`dati.mjs`), chiave di servizio inventata. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { ISTANTE, mediaProva, prodottoProva, tabelleProva, uuid, varianteProva } from "./dati.mjs";

const P1 = uuid(0x200); // pubblicato, completo
const P2 = uuid(0x201); // bozza, senza foto né categoria
const ADESSO = new Date("2026-11-20T12:00:00.000Z");
const FRASE_FOTO = "Manca la foto principale: il prodotto resta in bozza.";

export async function prove(mod, { c, gruppo, radice }) {
  const S = mod["negozio/prodotti.server"];
  const A = mod["shop/cms/anteprima"];
  gruppo("NEGOZIO · IL SERVER DEI PRODOTTI (20/11/2026)");

  const richiesta = (url, corpo) =>
    new Request(`https://crm.example.com/api/crm/negozio${url}`, corpo === undefined ? { method: "GET" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: typeof corpo === "string" ? corpo : JSON.stringify(corpo) });
  const dip = (db, opz = {}) => {
    const log = [];
    return { log, d: { guardia: opz.guardia ?? (async () => ({ ok: true, nome: "Giulia Esempio" })), db, adesso: () => ADESSO, log: (x) => log.push(x), chiaveServizio: () => ("chiave" in opz ? opz.chiave : "chiave-di-prova") } };
  };
  const leggi = async (r) => ({ stato: r.status, json: await r.json() });
  const POST = async (db, corpo, opz) => { const x = dip(db, opz); return { ...(await leggi(await S.gestisciPOST(richiesta("", corpo), x.d))), log: x.log }; };
  const GET = async (db, url, opz) => { const x = dip(db, opz); return { ...(await leggi(await S.gestisciGET(richiesta(url), x.d))), log: x.log }; };

  /** Le tabelle di partenza, più ciò che serve a un caso. */
  const tab = (...mut) => { const t = tabelleProva(); mut.forEach((m) => m(t)); return t; };
  /** Un prodotto in bozza COMPLETO (foto con alt, categoria, variante con SKU e prezzo): si può pubblicare. */
  const completo = (n, extra = {}, conFoto = true) => (t) => {
    const id = uuid(0x200 + n);
    t.shop_prodotti.push(prodottoProva({ id, sku: `PROVA-00${n}`, slug: `prodotto-${n}`, nome: `Prodotto ${n}`, stato: "bozza", pubblicato_il: null, ...extra }));
    t.shop_varianti.push(varianteProva({ id: uuid(0x300 + n), prodotto_id: id, sku: `PROVA-00${n}-A`, giacenza: 0 }));
    if (conFoto) t.shop_media.push(mediaProva({ id: uuid(0x400 + n), prodotto_id: id }));
    t.shop_prodotti_categorie.push({ prodotto_id: id, categoria_id: uuid(0x100) });
  };
  const P4 = uuid(0x204);
  const bozzaPronta = tab(completo(4));
  const storicoDi = (db) => db.tabelle.shop_storico.map(({ campo, prima, dopo, chi }) => ({ campo, prima, dopo, chi }));
  const riga = (db, id) => db.tabelle.shop_prodotti.find((p) => p.id === id);

  // ── la guardia viene prima di tutto ──
  {
    const esiti = [];
    for (const stato of [401, 403]) {
      for (const [metodo, url, corpo] of [["GET", "?prodotti"], ["GET", `?prodotto=${P1}`], ["POST", "", { azione: "prodotto_stato", prodottoId: P2, stato: "pubblicato" }], ["POST", "", { azione: "media_rimuovi", mediaId: uuid(0x400) }]]) {
        const db = fintoDb({ tabelle: tab() });
        const x = dip(db, { guardia: async () => ({ ok: false, risposta: new Response(JSON.stringify({ ok: false }), { status: stato }) }) });
        const r = metodo === "GET" ? await S.gestisciGET(richiesta(url), x.d) : await S.gestisciPOST(richiesta(url, corpo), x.d);
        esiti.push([r.status === stato, db.chiamate, x.log.length]);
      }
    }
    c("guardia negata (401 e 403): restituita tale e quale, ZERO chiamate al database, zero log", true, esiti.every(([ok, ch, lg]) => ok && ch === 0 && lg === 0));
    const db = fintoDb({ tabelle: tab() });
    const x = dip(db, { guardia: async () => { throw new Error("rete caduta, cliente Anna Esempio"); } });
    const r = await leggi(await S.gestisciPOST(richiesta("", { azione: "prodotto_stato" }), x.d));
    c("guardia che lancia: 500 «interno» in JSON, database mai toccato, log solo col nome del tipo", [500, "interno", 0, ["eccezione Error"], false], [r.stato, r.json.motivo, db.chiamate, x.log, JSON.stringify(r.json).includes("Anna")]);
  }

  // ── pubblicare: gli stessi controlli del pannello, e nessuna scrittura se non passa ──
  {
    const senzaFoto = fintoDb({ tabelle: tab(completo(4, {}, false)) });
    const r = await POST(senzaFoto, { azione: "prodotto_stato", prodottoId: P4, stato: "pubblicato" });
    c("pubblicare senza foto principale → {ok:false} con la frase esatta, nessuna scrittura", [422, false, FRASE_FOTO, 0, "bozza"], [r.stato, r.json.ok, r.json.frase, senzaFoto.scritture.length, riga(senzaFoto, P4).stato]);
    const senzaAlt = fintoDb({ tabelle: tab(completo(4), (t) => { t.shop_media.find((m) => m.prodotto_id === P4).alt = ""; }) });
    const ra = await POST(senzaAlt, { azione: "prodotto_stato", prodottoId: P4, stato: "pubblicato" });
    c("pubblicare con una foto senza testo alternativo → rifiutato, nessuna scrittura", [false, true, 0], [ra.json.ok, /testo alternativo/.test(JSON.stringify(ra.json.bloccanti)), senzaAlt.scritture.length]);
    const sku = fintoDb({ tabelle: tab(completo(4), (t) => { t.shop_varianti.find((v) => v.prodotto_id === P4).sku = "PROVA-001-A"; }) });
    const rs = await POST(sku, { azione: "prodotto_stato", prodottoId: P4, stato: "pubblicato" });
    c("pubblicare con uno SKU già usato da una variante di un ALTRO prodotto → rifiutato, nessuna scrittura", [false, ["sku"], 0], [rs.json.ok, rs.json.bloccanti?.map((b) => b.campo), sku.scritture.length]);
    const zero = fintoDb({ tabelle: tab(completo(4, { prezzo_cent: 0 })) });
    const rz = await POST(zero, { azione: "prodotto_stato", prodottoId: P4, stato: "pubblicato" });
    c("pubblicare con prezzo 0 → rifiutato, nessuna scrittura", [false, ["prezzo"], 0], [rz.json.ok, rz.json.bloccanti?.map((b) => b.campo), zero.scritture.length]);
    // D40: Invisible Derm non ha prezzo e si pubblica lo stesso (il server usa la stessa `controllaPubblicazione`); un prodotto qualunque a 0, no
    const derm0 = fintoDb({ tabelle: tab(completo(4, { prezzo_cent: 0, nome: "Invisible Derm", slug: "invisible-derm" })) });
    const rd0 = await POST(derm0, { azione: "prodotto_stato", prodottoId: P4, stato: "pubblicato" });
    c("D40: Invisible Derm a prezzo 0 → si pubblica (mai «il prezzo deve essere maggiore di zero»)", [true, "pubblicato"], [rd0.json.ok, riga(derm0, P4).stato]);
    const solv0 = fintoDb({ tabelle: tab(completo(4, { prezzo_cent: 0, nome: "Solvente per Invisible Derm", slug: "solvente-per-invisible-derm" })) });
    const rs0 = await POST(solv0, { azione: "prodotto_stato", prodottoId: P4, stato: "pubblicato" });
    c("D40: «Solvente per Invisible Derm» a prezzo 0 → rifiutato sul prezzo, nessuna scrittura", [false, ["prezzo"], 0], [rs0.json.ok, rs0.json.bloccanti?.map((b) => b.campo), solv0.scritture.length]);
    const tanti = await POST(fintoDb({ tabelle: tab() }), { azione: "prodotto_stato", prodottoId: P2, stato: "pubblicato" });
    c("con più cose mancanti la frase dice quante", true, /^Mancano \d+ cose: /.test(tanti.json.frase));
    const vecchio = fintoDb({ tabelle: tab(completo(4, { origine: "codice", id_codice: "v" })) });
    c("un prodotto del «Vecchio catalogo» non si pubblica prima di averlo adottato", [false, "non_pubblicabile"], ((x) => [x.json.ok, x.json.motivo])(await POST(vecchio, { azione: "prodotto_stato", prodottoId: P4, stato: "pubblicato" })));

    const ok = fintoDb({ tabelle: bozzaPronta });
    const rok = await POST(ok, { azione: "prodotto_stato", prodottoId: P4, stato: "pubblicato" });
    c("tutto a posto → pubblicato, con la data, e una riga di storico (chi, prima, dopo)", [true, "pubblicato", ADESSO.toISOString(), [{ campo: "stato", prima: "bozza", dopo: "pubblicato", chi: "Giulia Esempio" }]],
      [rok.json.ok, riga(ok, P4).stato, riga(ok, P4).pubblicato_il, storicoDi(ok)]);
    const trigger = fintoDb({ tabelle: bozzaPronta, errori: { "shop_prodotti.update": { error: { code: "23514", message: "shop_pubblicazione_negata: manca la categoria" } } } });
    const rt = await POST(trigger, { azione: "prodotto_stato", prodottoId: P4, stato: "pubblicato" });
    c("il trigger del database dice no (errore programmato 23514): {ok:false}, mai un errore tecnico", [422, false, "non_pubblicabile", false], [rt.stato, rt.json.ok, rt.json.motivo, JSON.stringify(rt.json).includes("shop_pubblicazione_negata")]);
  }

  // ── il salvataggio: versione, storico per campo, bozza di modifica ──
  {
    const db = fintoDb({ tabelle: tab() });
    const vecchia = await POST(db, { azione: "prodotto_salva", prodottoId: P2, versione: "2026-11-19T00:00:00.000Z", campi: { nome: "Altro" } });
    c("prodotto_salva con la versione vecchia → 409, niente scritto", [409, "conflitto", 0], [vecchia.stato, vecchia.json.motivo, db.scritture.length]);
    const senzaV = await POST(db, { azione: "prodotto_salva", prodottoId: P2, campi: { nome: "Altro" } });
    c("prodotto_salva senza versione → 409", 409, senzaV.stato);

    const r = await POST(db, { azione: "prodotto_salva", prodottoId: P2, versione: ISTANTE, campi: { nome: "Nuovo nome", rigaPresentazione: "Una riga di prova", descrizioneBreve: "Una descrizione breve inventata." } });
    c("su una bozza: le colonne vere cambiano (e non quella uguale)", [true, "Nuovo nome", "Una riga di prova", ["nome", "rigaPresentazione"], ADESSO.toISOString()],
      [r.json.ok, riga(db, P2).nome, riga(db, P2).riga_presentazione, r.json.cambiati, r.json.versione]);
    c("…una riga di storico per OGNI campo cambiato, con prima, dopo e chi", [{ campo: "nome", prima: "Prodotto in bozza", dopo: "Nuovo nome", chi: "Giulia Esempio" }, { campo: "rigaPresentazione", prima: null, dopo: "Una riga di prova", chi: "Giulia Esempio" }], storicoDi(db));
    const ancora = await POST(db, { azione: "prodotto_salva", prodottoId: P2, versione: ISTANTE, campi: { nome: "Terzo" } });
    c("…e la versione vecchia di prima ora non vale più (409)", 409, ancora.stato);
    const gemello = fintoDb({ tabelle: tab(), prima: { "shop_prodotti.update": (t) => { t.shop_prodotti[1].aggiornato_il = "2026-11-20T11:59:00.000Z"; } } });
    const g = await POST(gemello, { azione: "prodotto_salva", prodottoId: P2, versione: ISTANTE, campi: { nome: "Mio" } });
    c("un altro salva fra la lettura e la scrittura → 409, il suo nome resta", [409, "Prodotto in bozza"], [g.stato, riga(gemello, P2).nome]);

    const sku = await POST(db, { azione: "prodotto_salva", prodottoId: P2, versione: ADESSO.toISOString(), campi: { sku: "PROVA-001-A" } });
    c("SKU di una variante di un altro prodotto → rifiutato", [false, "duplicato"], [sku.json.ok, sku.json.motivo]);
    const aggiorna = await POST(db, { azione: "prodotto_salva", prodottoId: P2, versione: ADESSO.toISOString(), campi: { sku: "PROVA-002-NUOVO", slug: "nuovo-indirizzo", prezzoCent: 1990 } });
    c("sulla bozza si cambiano anche SKU, indirizzo e prezzo", ["PROVA-002-NUOVO", "nuovo-indirizzo", 1990], [riga(db, P2).sku, riga(db, P2).slug, riga(db, P2).prezzo_cent]);
  }
  {
    const db = fintoDb({ tabelle: tab() });
    const r = await POST(db, { azione: "prodotto_salva", prodottoId: P1, versione: ISTANTE, campi: { nome: "Nome nuovo", passi: ["Uno", "Due"] } });
    c("su un PUBBLICATO il testo va in bozza_modifiche e le colonne vive NON cambiano", [true, "Prodotto di prova", { nome: "Nome nuovo", passi: ["Uno", "Due"] }, [], true], [r.json.ok, riga(db, P1).nome, riga(db, P1).bozza_modifiche, riga(db, P1).contenuto.passi, r.json.bozza]);
    c("…lo storico dice che è una bozza", ["bozza:nome", "bozza:passi"], storicoDi(db).map((x) => x.campo));
    const rinomina = await POST(db, { azione: "prodotto_salva", prodottoId: P1, versione: ADESSO.toISOString(), campi: { sku: "ALTRO-SKU" } });
    c("SKU e indirizzo di un prodotto già pubblicato non si cambiano", [false, "valore", "PROVA-001"], [rinomina.json.ok, rinomina.json.motivo, riga(db, P1).sku]);
    const pubblica = await POST(db, { azione: "prodotto_pubblica_modifiche", prodottoId: P1, versione: ADESSO.toISOString() });
    c("«Pubblica le modifiche» copia la bozza nelle colonne vive e la svuota", [true, "Nome nuovo", ["Uno", "Due"], null], [pubblica.json.ok, riga(db, P1).nome, riga(db, P1).contenuto.passi, riga(db, P1).bozza_modifiche]);
  }
  {
    const db = fintoDb({ tabelle: tab() });
    await POST(db, { azione: "prodotto_salva", prodottoId: P1, versione: ISTANTE, campi: { descrizioneBreve: null } });
    const r = await POST(db, { azione: "prodotto_pubblica_modifiche", prodottoId: P1, versione: ADESSO.toISOString() });
    c("«Pubblica le modifiche» ripete i controlli: una bozza che toglie la descrizione breve è rifiutata, la bozza resta", [422, false, "Una descrizione breve inventata.", true], [r.stato, r.json.ok, riga(db, P1).descrizione_breve, riga(db, P1).bozza_modifiche !== null]);
    const sc = await POST(db, { azione: "prodotto_scarta_modifiche", prodottoId: P1, versione: ADESSO.toISOString() });
    c("«Scarta» azzera la bozza e il sito resta com'era", [true, null, "Una descrizione breve inventata."], [sc.json.ok, riga(db, P1).bozza_modifiche, riga(db, P1).descrizione_breve]);
    const nulla = await POST(db, { azione: "prodotto_pubblica_modifiche", prodottoId: P1 });
    c("senza modifiche da pubblicare → rifiutato con la frase", [400, "valore"], [nulla.stato, nulla.json.motivo]);
  }

  // ── tetti di testo e testi che non si possono scrivere ──
  {
    const db = fintoDb({ tabelle: tab() });
    const prova = async (campi) => (await POST(db, { azione: "prodotto_salva", prodottoId: P2, versione: ISTANTE, campi })).stato;
    c("riga di presentazione di 91 segni, descrizione breve di 301, nome vuoto, tipo storto → 400", [400, 400, 400, 400],
      [await prova({ rigaPresentazione: "x".repeat(91) }), await prova({ descrizioneBreve: "x".repeat(301) }), await prova({ nome: "  " }), await prova({ tipo: "gel" })]);
    c("90 segni di riga e 300 di descrizione passano", 200, await prova({ rigaPresentazione: "x".repeat(90), descrizioneBreve: "y".repeat(300) }));
    const db2 = fintoDb({ tabelle: tab() });
    const p2 = async (campi) => (await POST(db2, { azione: "prodotto_salva", prodottoId: P2, versione: ISTANTE, campi })).stato;
    c("prezzo oltre l'integer di Postgres, negativo, non intero, campo sconosciuto, caratteristica «confermata» senza fonte → 400",
      [400, 400, 400, 400, 400], [await p2({ prezzoCent: 2147483648 }), await p2({ prezzoCent: -1 }), await p2({ prezzoCent: 12.5 }), await p2({ id: "x" }), await p2({ caratteristiche: [{ etichetta: "A", valore: "b", stato: "confermato" }] })]);
    c("una cifra vicino a «Invisible Derm» o «sconto del» non si può nemmeno salvare", [400, 400, 0], [await p2({ descrizioneLunga: "Invisible Derm da 3.900 €" }), await p2({ faq: [{ d: "Costo?", r: "Oggi sconto del 20%." }] }), db2.scritture.length]);
    c("il box consulenza solo per le patch", [400, 200], [await p2({ boxConsulenza: true }), await p2({ boxConsulenza: true, tipo: "patch" })]);
  }

  // ── un prodotto pubblicato non diventa non pubblicabile per un salvataggio ──
  {
    const prezzo0 = async (campi) => { const db = fintoDb({ tabelle: tab() }); const r = await POST(db, { azione: "prodotto_salva", prodottoId: P1, versione: ISTANTE, campi }); return { r, db }; };
    const a = await prezzo0({ prezzoCent: 0 });
    c("prezzo del prodotto a 0 (con la variante senza prezzo proprio) → rifiutato, colonna invariata", [422, "non_pubblicabile", 2890, 0], [a.r.stato, a.r.json.motivo, riga(a.db, P1).prezzo_cent, a.db.scritture.length]);
    const b = await prezzo0({ prezzoCent: 3500 });
    c("un prezzo valido cambia subito (D27), col suo storico", [3500, [{ campo: "prezzoCent", prima: 2890, dopo: 3500, chi: "Giulia Esempio" }]], [riga(b.db, P1).prezzo_cent, storicoDi(b.db)]);
    const v0 = fintoDb({ tabelle: tab() });
    const rv = await POST(v0, { azione: "variante_salva", prodottoId: P1, variante: { id: uuid(0x300), prezzoCent: 0 } });
    c("il prezzo di una variante di un pubblicato lasciato a 0 → rifiutato", [422, null], [rv.stato, v0.tabelle.shop_varianti[0].prezzo_cent]);
    const v1 = fintoDb({ tabelle: tab() });
    const rv1 = await POST(v1, { azione: "variante_salva", prodottoId: P1, variante: { id: uuid(0x300), prezzoCent: 4200 } });
    c("…un prezzo di variante valido cambia subito, e la giacenza non si tocca da qui", [true, 4200, 5], [rv1.json.ok, v1.tabelle.shop_varianti[0].prezzo_cent, v1.tabelle.shop_varianti[0].giacenza]);
    const off = fintoDb({ tabelle: tab() });
    const roff = await POST(off, { azione: "variante_attiva", prodottoId: P1, varianteId: uuid(0x300), attiva: false });
    c("spegnere l'ultima variante attiva di un pubblicato → rifiutato", [422, true], [roff.stato, off.tabelle.shop_varianti[0].attiva]);
    const off2 = fintoDb({ tabelle: tab() });
    c("spegnere una variante di una BOZZA va bene", [true, false], [(await POST(off2, { azione: "variante_attiva", prodottoId: P2, varianteId: uuid(0x301), attiva: false })).json.ok, off2.tabelle.shop_varianti[1].attiva]);
    const foto = fintoDb({ tabelle: tab() });
    const rf = await POST(foto, { azione: "media_rimuovi", mediaId: uuid(0x400) });
    c("togliere l'ultima foto principale di un pubblicato → rifiutato, la foto resta", [422, null], [rf.stato, foto.tabelle.shop_media[0].rimosso_il]);
    const alt = fintoDb({ tabelle: tab() });
    c("svuotare il testo alternativo della principale di un pubblicato → rifiutato", [422, "Foto di prova del prodotto"], [(await POST(alt, { azione: "media_alt", mediaId: uuid(0x400), alt: "" })).stato, alt.tabelle.shop_media[0].alt]);
    const sku = fintoDb({ tabelle: tab() });
    c("uno SKU di variante già usato da un altro prodotto → rifiutato", [409, "PROVA-001-A"], [(await POST(sku, { azione: "variante_salva", prodottoId: P1, variante: { id: uuid(0x300), sku: "PROVA-002-A" } })).stato, sku.tabelle.shop_varianti[0].sku]);
    const altra = fintoDb({ tabelle: tab(completo(5, {}, false)) });
    c("togliere una foto NON principale di un pubblicato va bene", true, await (async () => { altra.tabelle.shop_media.push(mediaProva({ id: uuid(0x4f0), prodotto_id: P1, slot: "foto2" })); return (await POST(altra, { azione: "media_rimuovi", mediaId: uuid(0x4f0) })).json.ok; })());
  }

  // ── l'unica eccezione: il ritiro per liberatoria revocata ──
  {
    const conPersone = (t) => Object.assign(t.shop_media[0], { ritrae_persone: true, liberatoria_ok: true });
    const a = fintoDb({ tabelle: tab(conPersone) });
    const ra = await POST(a, { azione: "media_flag", mediaId: uuid(0x400), flag: { liberatoriaOk: false } });
    c("liberatoria revocata sulla principale: non si rifiuta; il prodotto torna in bozza con un avviso", [true, true, "bozza", false, true],
      [ra.json.ok, ra.json.tornatoInBozza, riga(a, P1).stato, a.tabelle.shop_media[0].liberatoria_ok, /liberatoria/.test(ra.json.avviso)]);
    c("…e lo storico lo dice (il cambio di stato c'è)", true, storicoDi(a).some((x) => x.campo === "stato" && x.prima === "pubblicato" && x.dopo === "bozza" && x.chi === "Giulia Esempio"));
    const b = fintoDb({ tabelle: tab(conPersone) });
    const rb = await POST(b, { azione: "media_rimuovi", mediaId: uuid(0x400), liberatoriaRevocata: true });
    c("ritiro della foto per liberatoria revocata: foto rimossa, prodotto in bozza, avviso", [true, true, "bozza"], [rb.json.ok, b.tabelle.shop_media[0].rimosso_il !== null, riga(b, P1).stato]);
    const cc = fintoDb({ tabelle: tab(conPersone, (t) => t.shop_media.push(mediaProva({ id: uuid(0x4f1), prodotto_id: P1, slot: "foto2" }))) });
    const rc = await POST(cc, { azione: "media_rimuovi", mediaId: uuid(0x4f1), liberatoriaRevocata: true });
    c("se il prodotto resta pubblicabile, il ritiro non lo tocca e non c'è avviso", ["pubblicato", undefined], [riga(cc, P1).stato, rc.json.avviso]);
    const d = fintoDb({ tabelle: tab(conPersone) });
    c("togliere la principale SENZA dire «liberatoria revocata» resta un rifiuto", [422, "pubblicato"], [(await POST(d, { azione: "media_rimuovi", mediaId: uuid(0x400) })).stato, riga(d, P1).stato]);
  }

  // ── più foto nello stesso slot: la scelta è sempre la stessa ──
  {
    const m = (n, ordine, creato) => mediaProva({ id: uuid(0x400 + n), prodotto_id: P1, slot: "principale", ordine, creato_il: creato });
    const set = [m(9, 1, "2026-11-20T09:00:00.000Z"), m(2, 1, "2026-11-20T09:00:00.000Z"), m(5, 1, "2026-11-20T08:00:00.000Z"), m(7, 2, "2026-11-20T07:00:00.000Z")];
    const permutazioni = [[0, 1, 2, 3], [3, 2, 1, 0], [2, 0, 3, 1], [1, 3, 0, 2]];
    const scelte = [];
    for (const p of permutazioni) {
      const db = fintoDb({ tabelle: tab((t) => { t.shop_media = p.map((i) => set[i]); }) });
      scelte.push((await GET(db, `?prodotto=${P1}`)).json.principaleId);
    }
    c("quattro foto principali attive, in qualunque ordine arrivino: sempre la stessa (`ordine`, poi `id`; la data non conta)", Array(4).fill(uuid(0x402)), scelte);
    c("e l'elenco dei media esce nello stesso ordine", [uuid(0x402), uuid(0x405), uuid(0x409), uuid(0x407)], (await GET(fintoDb({ tabelle: tab((t) => { t.shop_media = set; }) }), `?prodotto=${P1}`)).json.media.map((x) => x.id));
    c("ordinaMedia: a parità di ordine decide l'id, anche se le date dicono il contrario", ["a", "b"], S.ordinaMedia([{ id: "b", ordine: 1, creatoIl: "2026-01-01" }, { id: "a", ordine: 1, creatoIl: "2026-12-31" }]).map((x) => x.id));
    const db = fintoDb({ tabelle: tab((t) => { t.shop_media = set.slice(0, 3); }) });
    const r = await POST(db, { azione: "media_registra", prodottoId: P1, slot: "principale", alt: "Nuova foto", path480: "prova/n-480.webp", path960: "prova/n-960.webp", path1600: "prova/n-1600.webp" });
    c("una foto nuova in uno slot occupato prende il posto di TUTTE le attive: ne resta una sola", [true, 1, 1], [r.json.ok, db.tabelle.shop_media.filter((x) => !x.rimosso_il && x.slot === "principale").length, db.tabelle.shop_media.filter((x) => x.id === r.json.media.id).length]);
  }

  // ── la bozza scritta da T08 si rilegge con T07 (camelCase di CampiProdotto) ──
  {
    const PUB = mod["shop/cms/pubblico"];
    const db = fintoDb({ tabelle: tab() });
    await POST(db, { azione: "prodotto_salva", prodottoId: P1, versione: ISTANTE, campi: { nome: "Nome della bozza", descrizioneBreve: "Testo della bozza", passi: ["Un passo nuovo"], seoTitolo: "Titolo nuovo" } });
    const t = db.tabelle;
    const righeDb = { prodotti: t.shop_prodotti, varianti: t.shop_varianti, categorie: t.shop_categorie, prodottiCategorie: t.shop_prodotti_categorie, media: t.shop_media };
    const letto = (opz) => PUB.costruisciPubblico(righeDb, opz).find((p) => p.slug === "prodotto-di-prova");
    const an = letto({ anteprima: { slug: "prodotto-di-prova" } });
    c("con l'anteprima T07 legge la bozza scritta da T08: nome, descrizione, passi, titolo SEO", ["Nome della bozza", "Testo della bozza", ["Un passo nuovo"], "Titolo nuovo"], [an?.nome, an?.descrizioneBreve, an?.passi, an?.seo.titolo]);
    const senza = letto({});
    c("senza anteprima il sito è com'era (e la bozza non esce)", ["Prodotto di prova", "Una descrizione breve inventata.", [], false], [senza?.nome, senza?.descrizioneBreve, senza?.passi, JSON.stringify(senza).includes("della bozza")]);
    c("le chiavi della bozza sono quelle di CampiProdotto, in camelCase", ["descrizioneBreve", "nome", "passi", "seoTitolo"], Object.keys(riga(db, P1).bozza_modifiche).sort());
  }

  // ── registrare un media: i percorsi e il testo ──
  {
    const db = fintoDb({ tabelle: tab() });
    const reg = async (extra) => (await POST(db, { azione: "media_registra", prodottoId: P2, slot: "foto2", alt: "Una foto", path480: "prova/a-480.webp", path960: "prova/a-960.webp", path1600: "prova/a-1600.webp", ...extra })).stato;
    c("percorso con «..», con spazi, vuoto, slot che non esiste, testo alternativo oltre 125 → 400", Array(5).fill(400),
      [await reg({ path480: "../x.webp" }), await reg({ path960: "con spazi.webp" }), await reg({ path1600: "" }), await reg({ slot: "foto9" }), await reg({ alt: "a".repeat(126) })]);
    c("la foto giusta passa; un video chiede il suo file", [200, 400, 200], [await reg({}), await reg({ slot: "video" }), await reg({ slot: "video", pathVideo: "prova/v.mp4", pathCopertina: "prova/c.webp", muto: true })]);
    const camp = await reg({ slot: "campione", valoreOpzione: "Nero" });
    c("il campione colore chiede il valore del colore", [200, 400], [camp, await reg({ slot: "campione" })]);
    const pub = fintoDb({ tabelle: tab() });
    const rp = await POST(pub, { azione: "media_registra", prodottoId: P1, slot: "principale", alt: "", path480: "p/a-480.webp", path960: "p/a-960.webp", path1600: "p/a-1600.webp" });
    c("su un pubblicato, una principale nuova senza testo alternativo → rifiutata, la vecchia resta", [422, null], [rp.stato, pub.tabelle.shop_media[0].rimosso_il]);
  }
  {
    const db = fintoDb({ tabelle: tab((t) => t.shop_media.push(mediaProva({ id: uuid(0x4e0), prodotto_id: P1, slot: "foto2", ordine: 2 }))) });
    const r = await POST(db, { azione: "media_ordina", prodottoId: P1, ordine: [uuid(0x4e0), uuid(0x400)] });
    c("media_ordina: l'ordine nuovo si scrive", [true, 2, 1], [r.json.ok, db.tabelle.shop_media[0].ordine, db.tabelle.shop_media[1].ordine]);
    c("media_ordina con una foto di un altro prodotto → 400", 400, (await POST(db, { azione: "media_ordina", prodottoId: P1, ordine: [uuid(0x999)] })).stato);
    const fl = await POST(db, { azione: "media_flag", mediaId: uuid(0x4e0), flag: { muto: true, sottotitoliOk: true } });
    c("media_flag: sottotitoli e muto", [true, true, true], [fl.json.ok, db.tabelle.shop_media[1].muto, db.tabelle.shop_media[1].sottotitoli_ok]);
    const parlato = fintoDb({ tabelle: tab((t) => t.shop_media.push(mediaProva({ id: uuid(0x4e1), prodotto_id: P1, slot: "video", tipo: "video", muto: false, sottotitoli_ok: true, path_video: "p/v.mp4", path_copertina: "p/c.webp" }))) });
    c("togliere i sottotitoli a un video parlato di un pubblicato → rifiutato", [422, true], [(await POST(parlato, { azione: "media_flag", mediaId: uuid(0x4e1), flag: { sottotitoliOk: false } })).stato, parlato.tabelle.shop_media[1].sottotitoli_ok]);
  }

  // ── variante nuova e varianti dalle opzioni ──
  {
    const db = fintoDb({ tabelle: tab() });
    const nuova = await POST(db, { azione: "variante_salva", prodottoId: P2, variante: { sku: "PROVA-002-B", nome: "Seconda", opzioni: { Colore: "Nero" }, prezzoCent: null } });
    c("variante nuova: giacenza 0, attiva, con lo storico", [true, 0, true, "Seconda"], [nuova.json.ok, db.tabelle.shop_varianti[2].giacenza, db.tabelle.shop_varianti[2].attiva, nuova.json.variante.nome]);
    c("variante senza SKU o con SKU già usato → rifiutata", [400, 409], [(await POST(db, { azione: "variante_salva", prodottoId: P2, variante: { nome: "x" } })).stato, (await POST(db, { azione: "variante_salva", prodottoId: P2, variante: { sku: "PROVA-001-A", nome: "x" } })).stato]);
    const g = fintoDb({ tabelle: tab() });
    const r = await POST(g, { azione: "varianti_genera", prodottoId: P2, opzioni: [{ nome: "Colore", valori: ["Nero", "Biondo"] }, { nome: "Lunghezza", valori: ["30", "40"] }, { nome: "Base", valori: ["PU", "Lace"] }] });
    c("varianti_genera con 3 opzioni (2×2×2) → 8 varianti, SKU diversi, giacenza 0", [true, 8, 8, true], [r.json.ok, r.json.create.length, new Set(r.json.create.map((v) => v.sku)).size, r.json.create.every((v) => v.giacenza === 0)]);
    const di_nuovo = await POST(g, { azione: "varianti_genera", prodottoId: P2, opzioni: [{ nome: "Colore", valori: ["Nero", "Biondo"] }, { nome: "Lunghezza", valori: ["30", "40"] }, { nome: "Base", valori: ["PU", "Lace"] }] });
    c("rilanciata: non nascono doppioni", [0, 8, 9], [di_nuovo.json.create.length, di_nuovo.json.esistenti, g.tabelle.shop_varianti.filter((v) => v.prodotto_id === P2).length]);
    const troppe = await POST(g, { azione: "varianti_genera", prodottoId: P2, opzioni: ["A", "B", "C"].map((nome) => ({ nome, valori: ["1", "2", "3", "4"] })) });
    c("64 combinazioni → rifiutate con la frase del limite; 4 opzioni anche", [400, true, 400], [troppe.stato, /50/.test(troppe.json.frase), (await POST(g, { azione: "varianti_genera", prodottoId: P2, opzioni: ["A", "B", "C", "D"].map((nome) => ({ nome, valori: ["1"] })) })).stato]);
    c("opzioni nulle → 400, nessuna eccezione", 400, (await POST(g, { azione: "varianti_genera", prodottoId: P2, opzioni: [{ nome: null, valori: null }] })).stato);
  }

  // ── duplica, adotta, gruppo, archivia ──
  {
    const db = fintoDb({ tabelle: tab() });
    const senza = await POST(db, { azione: "prodotto_duplica", prodottoId: P1 });
    c("duplica senza SKU nuovo, o con SKU già usato → rifiutato, niente creato", [400, 409, 2], [senza.stato, (await POST(db, { azione: "prodotto_duplica", prodottoId: P1, sku: "PROVA-002" })).stato, db.tabelle.shop_prodotti.length]);
    const r = await POST(db, { azione: "prodotto_duplica", prodottoId: P1, sku: "PROVA-009" });
    const copia = db.tabelle.shop_prodotti.at(-1);
    c("duplica: copia tutto TRANNE foto e SKU (nuovo), in bozza, senza data né origine", [true, "PROVA-009", "bozza", null, null, "Prodotto di prova"], [r.json.ok, copia.sku, copia.stato, copia.pubblicato_il, copia.id_codice, copia.nome]);
    c("…la copia ha le varianti (giacenza 0, SKU derivati), le categorie e NESSUNA foto", [["PROVA-009-A"], [0], 1, 1], [db.tabelle.shop_varianti.filter((v) => v.prodotto_id === copia.id).map((v) => v.sku), db.tabelle.shop_varianti.filter((v) => v.prodotto_id === copia.id).map((v) => v.giacenza), db.tabelle.shop_prodotti_categorie.filter((x) => x.prodotto_id === copia.id).length, db.tabelle.shop_media.length]);

    const vec = fintoDb({ tabelle: tab(completo(4, { origine: "codice", id_codice: "v1" })) });
    const ad = await POST(vec, { azione: "prodotto_adotta", prodottoId: P4 });
    c("prodotto_adotta toglie `origine`, il prodotto resta in bozza", [true, null, "bozza"], [ad.json.ok, riga(vec, P4).origine, riga(vec, P4).stato]);
    c("…e adottarne uno che non viene dal vecchio catalogo → 400", 400, (await POST(vec, { azione: "prodotto_adotta", prodottoId: P1 })).stato);

    const gr = fintoDb({ tabelle: tab(completo(4), completo(5, {}, false), completo(6)) });
    const rg = await POST(gr, { azione: "gruppo_stato", ids: [uuid(0x204), uuid(0x205), uuid(0x206)], stato: "pubblicato" });
    c("gruppo_stato su 3 prodotti (2 ok, 1 senza foto) → {pubblicati:2, restano:[{id, motivo}]}", [2, [{ id: uuid(0x205), motivo: FRASE_FOTO }], ["pubblicato", "bozza", "pubblicato"]],
      [rg.json.pubblicati, rg.json.restano, [uuid(0x204), uuid(0x205), uuid(0x206)].map((i) => riga(gr, i).stato)]);
    c("gruppo_stato: elenco vuoto, troppo lungo o stato strano → 400", [400, 400, 400],
      [(await POST(gr, { azione: "gruppo_stato", ids: [], stato: "pubblicato" })).stato, (await POST(gr, { azione: "gruppo_stato", ids: Array.from({ length: 101 }, (_, i) => `x${i}`), stato: "pubblicato" })).stato, (await POST(gr, { azione: "gruppo_stato", ids: [P1], stato: "archiviato" })).stato]);

    const ar = fintoDb({ tabelle: tab() });
    const rar = await POST(ar, { azione: "prodotto_stato", prodottoId: P1, stato: "archiviato" });
    c("archivia → stato «archiviato», e nel registro delle chiamate NESSUN delete", [true, "archiviato", true], [rar.json.ok, riga(ar, P1).stato, ar.registro.every((x) => x.op !== "delete")]);
    c("rimettere lo stato che c'è già non scrive niente", [true, false, 0], ((x) => [x.json.ok, x.json.cambiato, 0])(await POST(fintoDb({ tabelle: tab() }), { azione: "prodotto_stato", prodottoId: P1, stato: "pubblicato" })));
    const cr = fintoDb({ tabelle: tab() });
    const rc = await POST(cr, { azione: "prodotto_crea", nome: "Spray Districante", tipo: "cura", sku: "HG-N01" });
    c("prodotto_crea: bozza con indirizzo dal nome, prezzo 0", [true, "bozza", "spray-districante", 0], [rc.json.ok, rc.json.prodotto.stato, rc.json.prodotto.slug, rc.json.prodotto.prezzoCent]);
    c("prodotto_crea con SKU già usato → 409", 409, (await POST(cr, { azione: "prodotto_crea", nome: "Altro", tipo: "cura", sku: "PROVA-001" })).stato);
  }

  // ── l'anteprima ──
  {
    const db = fintoDb({ tabelle: tab() });
    const r = await POST(db, { azione: "anteprima_chiave", prodottoId: P2 });
    const token = /anteprima=(.+)$/.exec(r.json.url)?.[1];
    c("anteprima_chiave: un indirizzo col suo slug", ["/shop/prodotto/prodotto-in-bozza?anteprima="], [r.json.url?.slice(0, 43)]);
    c("…con una chiave che verificaChiaveAnteprima accetta (per quello slug, entro 24 ore) e non per un altro", [true, false, false], [
      await A.verificaChiaveAnteprima("chiave-di-prova", "prodotto-in-bozza", token, ADESSO.getTime() + 3600_000),
      await A.verificaChiaveAnteprima("chiave-di-prova", "prodotto-di-prova", token, ADESSO.getTime() + 3600_000),
      await A.verificaChiaveAnteprima("chiave-di-prova", "prodotto-in-bozza", token, ADESSO.getTime() + 25 * 3600_000),
    ]);
    const senzaChiave = await POST(fintoDb({ tabelle: tab() }), { azione: "anteprima_chiave", prodottoId: P2 }, { chiave: undefined });
    c("senza chiave di servizio → 503 con la frase, mai un indirizzo", [503, undefined], [senzaChiave.stato, senzaChiave.json.url]);
  }

  // ── le letture ──
  {
    const t = () => tab(completo(3, { origine: "codice", id_codice: "v3" }, false));
    const nomi = async (url) => (await GET(fintoDb({ tabelle: t() }), url)).json.prodotti.map((p) => p.sku);
    c("elenco «tutti»: i prodotti del CMS, non quelli del vecchio catalogo (D28)", ["PROVA-001", "PROVA-002"], await nomi("?prodotti"));
    c("segmenti: pubblicati, bozze, da sistemare, vecchio catalogo", [["PROVA-001"], ["PROVA-002"], ["PROVA-002"], ["PROVA-003"]], [await nomi("?prodotti&segmento=pubblicati"), await nomi("?prodotti&segmento=bozze"), await nomi("?prodotti&segmento=da_sistemare"), await nomi("?prodotti&segmento=vecchio_catalogo")]);
    c("ricerca per nome o SKU (maiuscole non contano), filtro per categoria", [["PROVA-002"], ["PROVA-001"], 400], [await nomi("?prodotti&q=BOZZA"), await nomi(`?prodotti&categoria=${uuid(0x100)}`), (await GET(fintoDb({ tabelle: t() }), "?prodotti&segmento=boh")).stato]);
    const el = (await GET(fintoDb({ tabelle: t() }), "?prodotti")).json.prodotti;
    c("ogni riga porta il PRIMO motivo per cui non è pubblicabile (null se lo è) e la versione", [null, FRASE_FOTO, ISTANTE], [el[0].motivo, el[1].motivo, el[0].versione]);
    // T32 (17): `canali` e `giacenza` per riga; la giacenza è la somma delle varianti ATTIVE (le spente non contano)
    c("ogni riga porta i canali (solo i quattro) e la giacenza (somma delle varianti attive)", [{ sito: true, meta: false, google: false, tiktok: false }, 5, 0], [el[0].canali, el[0].giacenza, el[1].giacenza]);
    const piu = (await GET(fintoDb({ tabelle: tab((t) => {
      t.shop_varianti.push(varianteProva({ id: uuid(0x3a0), prodotto_id: P1, sku: "PROVA-001-B", giacenza: 3 }), varianteProva({ id: uuid(0x3a1), prodotto_id: P1, sku: "PROVA-001-C", giacenza: 100, attiva: false }));
      t.shop_prodotti.find((p) => p.id === P1).canali = { sito: true, meta: true, google: false, tiktok: false, segreto: "x" };
    }) }), "?prodotti")).json.prodotti[0];
    c("più varianti: 5 + 3 (la spenta da 100 non conta); i canali escono solo con le quattro chiavi note", [8, { sito: true, meta: true, google: false, tiktok: false }], [piu.giacenza, piu.canali]);
    const s = (await GET(fintoDb({ tabelle: tab() }), `?prodotto=${P1}`)).json;
    c("la scheda: prodotto, versione, varianti con la giacenza e «disponibile», media, esito dei controlli, storico", [true, ISTANTE, 5, "disponibile", 1, { bloccanti: [], informativi: [] }, []],
      [s.ok, s.versione, s.varianti[0].giacenza, s.varianti[0].disponibilita, s.media.length, s.controllo, s.storico]);
    const s2 = (await GET(fintoDb({ tabelle: tab() }), `?prodotto=${P2}`)).json;
    c("la scheda di una bozza dice cosa manca (stessa funzione del pannello)", [FRASE_FOTO, true], [s2.controllo.bloccanti[0].frase, s2.controllo.bloccanti.some((b) => b.campo === "categoria")]);
    c("prodotto che non c'è → 404; id storto → 400; lettura sconosciuta → 400", [404, 400, 400], [(await GET(fintoDb({ tabelle: tab() }), `?prodotto=${uuid(0x999)}`)).stato, (await GET(fintoDb({ tabelle: tab() }), "?prodotto=a/b")).stato, (await GET(fintoDb({ tabelle: tab() }), "?boh")).stato]);
  }

  // ── guasti: tabella mancante, errori, log ──
  {
    const mancante = fintoDb({ tabelle: tab(), mancante: true });
    const r = await POST(mancante, { azione: "prodotto_stato", prodottoId: P2, stato: "pubblicato" });
    c("tabelle assenti (S1 non applicata) → {ok:false, motivo:\"migrazione\"} con la frase, nessuna scrittura", [409, false, "migrazione", 0], [r.stato, r.json.ok, r.json.motivo, mancante.scritture.length]);
    c("…vale anche per le letture", "migrazione", (await GET(fintoDb({ tabelle: tab(), mancante: ["shop_varianti"] }), "?prodotti")).json.motivo);
    const rotto = fintoDb({ tabelle: tab(), errori: { "shop_prodotti.select": { error: { code: "XX000", message: "guasto: cliente Anna Esempio 3331234567" } } } });
    const rr = await POST(rotto, { azione: "prodotto_stato", prodottoId: P2, stato: "pubblicato" });
    c("errore del database: 500 generico, nel log solo il codice, nessun dato nella risposta", [500, ["prodotto XX000"], false], [rr.stato, rr.log, /Anna|333/.test(JSON.stringify(rr.json) + rr.log.join(" "))]);
    const lancia = fintoDb({ tabelle: tab(), errori: { "shop_prodotti.select": { lancia: new Error("rete caduta, Anna Esempio") } } });
    const rl = await POST(lancia, { azione: "prodotto_stato", prodottoId: P2, stato: "pubblicato" });
    c("il database che lancia: 500, nel log solo il nome del tipo", [500, ["eccezione Error"]], [rl.stato, rl.log]);
    const storico = fintoDb({ tabelle: bozzaPronta, errori: { "shop_storico.insert": { error: { code: "XX000", message: "x" } } } });
    const rs = await POST(storico, { azione: "prodotto_stato", prodottoId: P4, stato: "pubblicato" });
    c("lo storico che non si scrive non annulla il cambio: ok, con `storico:false` e il codice nel log", [true, false, "pubblicato", ["storico XX000"]], [rs.json.ok, rs.json.storico, riga(storico, P4).stato, rs.log]);
    c("azione sconosciuta, corpo che non è JSON, corpo troppo grande → 400, niente database", [400, 400, 400, 0], await (async () => { const db = fintoDb({ tabelle: tab() }); return [(await POST(db, { azione: "boh" })).stato, (await POST(db, "non json")).stato, (await POST(db, { azione: "prodotto_salva", campi: { nome: "x".repeat(120_000) } })).stato, db.chiamate]; })());
    c("un id che non è un id (con barre, apici) → 400 prima del database", [400, 0], await (async () => { const db = fintoDb({ tabelle: tab() }); return [(await POST(db, { azione: "prodotto_stato", prodottoId: "x'; drop", stato: "bozza" })).stato, db.chiamate]; })());
  }

  // ── note del revisore (20/11/2026) ──
  {
    // 1 · lo smistamento delle azioni guarda solo le azioni vere, non ciò che ogni oggetto eredita
    const db = fintoDb({ tabelle: tab() });
    const nomi = ["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"];
    const esiti = [];
    for (const azione of nomi) esiti.push((await POST(db, { azione, prodottoId: P1 })).stato);
    c("azione «constructor», «toString», «__proto__»…: 400 con la frase, database mai toccato", [nomi.map(() => 400), 0], [esiti, db.chiamate]);

    // 2 · la versione è quella che il database ha scritto, e si confronta come istante
    const pg = (iso) => iso.replace(/\.(\d{3})Z$/, ".$1456+00:00"); // come PostgREST: microsecondi e +00:00
    const alFormatoPostgrest = (base) => ({
      from(t) {
        const b = base.from(t);
        const aggiorna = b.update;
        b.update = (patch) => aggiorna(typeof patch?.aggiornato_il === "string" ? { ...patch, aggiornato_il: pg(patch.aggiornato_il) } : patch);
        return b;
      },
    });
    const sotto = fintoDb({ tabelle: tab((t) => { t.shop_prodotti[1].aggiornato_il = "2026-11-20T10:00:00.123456+00:00"; }) });
    const via = alFormatoPostgrest(sotto);
    const uno = await POST(via, { azione: "prodotto_salva", prodottoId: P2, versione: "2026-11-20T10:00:00.123Z", campi: { nome: "Uno" } });
    c("la versione scritta nel formato del database (…Z contro +00:00, microsecondi) è la stessa: 1° salvataggio ok", [200, "2026-11-20T12:00:00.000456+00:00"], [uno.stato, uno.json.versione]);
    c("…la versione che torna è QUELLA DEL DATABASE (riletta), non l'ora del server", [true, "2026-11-20T12:00:00.000456+00:00"], [uno.json.versione !== ADESSO.toISOString(), riga(sotto, P2).aggiornato_il]);
    const due = await POST(via, { azione: "prodotto_salva", prodottoId: P2, versione: uno.json.versione, campi: { nome: "Due" } });
    const tre = await POST(via, { azione: "prodotto_salva", prodottoId: P2, versione: due.json.versione, campi: { nome: "Tre" } });
    c("due salvataggi di fila con la versione che il server ha restituito: nessun 409", [200, 200, "Tre"], [due.stato, tre.stato, riga(sotto, P2).nome]);
    c("una versione di un altro istante → 409", 409, (await POST(via, { azione: "prodotto_salva", prodottoId: P2, versione: "2026-11-20T10:00:00.123456+00:00", campi: { nome: "Quattro" } })).stato);
    const z = fintoDb({ tabelle: tab() });
    c("«…+00:00» e «…Z» dello stesso istante valgono lo stesso (anche per pubblicare e scartare)", [200, 200], [
      (await POST(z, { azione: "prodotto_salva", prodottoId: P2, versione: "2026-11-20T10:00:00+00:00", campi: { nome: "Z" } })).stato,
      (await POST(z, { azione: "prodotto_scarta_modifiche", prodottoId: P2, versione: "2026-11-20T12:00:00+00:00" })).stato]);
    const stato = fintoDb({ tabelle: bozzaPronta });
    const pub = await POST(stato, { azione: "prodotto_stato", prodottoId: P4, stato: "pubblicato" });
    c("anche lo stato restituisce la versione riletta", ADESSO.toISOString(), pub.json.versione);

    // 3 · i testi vietati ovunque si scrivano
    const v = fintoDb({ tabelle: tab() });
    const stati = [
      (await POST(v, { azione: "prodotto_crea", nome: "Kit Invisible Derm da 3.900 €", tipo: "kit", sku: "HG-V01" })).stato,
      (await POST(v, { azione: "variante_salva", prodottoId: P2, variante: { sku: "PROVA-002-Z", nome: "Oggi sconto del 20%" } })).stato,
      (await POST(v, { azione: "variante_salva", prodottoId: P2, variante: { id: uuid(0x301), nome: "Con risparmi sicuri" } })).stato,
      (await POST(v, { azione: "media_alt", mediaId: uuid(0x400), alt: "Invisible Derm 3900 euro" })).stato,
      (await POST(v, { azione: "media_registra", prodottoId: P2, slot: "foto2", alt: "sconto del 10%", path480: "p/a-480.webp", path960: "p/a-960.webp", path1600: "p/a-1600.webp" })).stato,
      (await POST(v, { azione: "media_flag", mediaId: uuid(0x400), flag: { testoParlato: "Invisible Derm costa 3900 euro" } })).stato,
    ];
    c("cifra vicino a «Invisible Derm» o «sconto del»: rifiutati nel nome del prodotto, della variante, nell'alt e nel testo parlato", [Array(6).fill(400), 0], [stati, v.scritture.length]);
    const pubVariante = fintoDb({ tabelle: tab(completo(4), (t) => { t.shop_varianti.find((x) => x.prodotto_id === P4).nome = "Offerta: sconto del 30%"; }) });
    const rv = await POST(pubVariante, { azione: "prodotto_stato", prodottoId: P4, stato: "pubblicato" });
    c("pubblicare con un nome di variante vietato → rifiutato (campo «varianti»)", [422, ["varianti"], 0], [rv.stato, rv.json.bloccanti?.map((b) => b.campo), pubVariante.scritture.length]);
    const pubAlt = fintoDb({ tabelle: tab(completo(4), (t) => { t.shop_media.find((x) => x.prodotto_id === P4).alt = "Invisible Derm da 3900 €"; }) });
    const ra = await POST(pubAlt, { azione: "prodotto_stato", prodottoId: P4, stato: "pubblicato" });
    c("pubblicare con un alt vietato → rifiutato (campo «alt»)", [422, ["alt"]], [ra.stato, ra.json.bloccanti?.map((b) => b.campo)]);

    // 4 · la bozza di modifica rimasta indietro non si applica mai sopra valori più nuovi
    const b1 = fintoDb({ tabelle: tab() });
    await POST(b1, { azione: "prodotto_salva", prodottoId: P1, versione: ISTANTE, campi: { nome: "Nome della vecchia bozza" } });
    const giu = await POST(b1, { azione: "prodotto_stato", prodottoId: P1, stato: "bozza" });
    c("un pubblicato con una bozza di modifica torna in bozza: la bozza si azzera", [true, null, null, "bozza"], [giu.json.ok, riga(b1, P1).bozza_modifiche, riga(b1, P1).bozza_modificata_il, riga(b1, P1).stato]);
    await POST(b1, { azione: "prodotto_salva", prodottoId: P1, versione: giu.json.versione, campi: { nome: "Nome più recente" } });
    const su = await POST(b1, { azione: "prodotto_stato", prodottoId: P1, stato: "pubblicato" });
    c("…ripubblicato, il nome è quello PIÙ RECENTE (la bozza vecchia non lo sovrascrive)", [true, "Nome più recente"], [su.json.ok, riga(b1, P1).nome]);
    c("…e «Pubblica le modifiche» non ha più niente da applicare", 400, (await POST(b1, { azione: "prodotto_pubblica_modifiche", prodottoId: P1 })).stato);
    c("…con la riga di storico che dice che la bozza è stata scartata", true, storicoDi(b1).some((x) => x.campo === "bozza" && x.dopo === null && x.prima?.nome === "Nome della vecchia bozza"));
    const b2 = fintoDb({ tabelle: tab((t) => { Object.assign(t.shop_prodotti[1], { bozza_modifiche: { nome: "Nome stantio" }, bozza_modificata_il: ISTANTE }); }) });
    await POST(b2, { azione: "prodotto_salva", prodottoId: P2, versione: ISTANTE, campi: { rigaPresentazione: "Una riga" } });
    c("una bozza che salva le colonne vive con una bozza di modifica rimasta: la bozza di modifica si azzera", [null, "Una riga"], [riga(b2, P2).bozza_modifiche, riga(b2, P2).riga_presentazione]);
    const b3 = fintoDb({ tabelle: tab((t) => { Object.assign(t.shop_media[0], { ritrae_persone: true, liberatoria_ok: true }); Object.assign(t.shop_prodotti[0], { bozza_modifiche: { nome: "Bozza" }, bozza_modificata_il: ISTANTE }); }) });
    await POST(b3, { azione: "media_flag", mediaId: uuid(0x400), flag: { liberatoriaOk: false } });
    c("il ritiro per liberatoria riporta in bozza E azzera la bozza di modifica", ["bozza", null], [riga(b3, P1).stato, riga(b3, P1).bozza_modifiche]);
    const b4 = fintoDb({ tabelle: tab() });
    await POST(b4, { azione: "prodotto_salva", prodottoId: P1, versione: ISTANTE, campi: { nome: "Bozza" } });
    await POST(b4, { azione: "prodotto_stato", prodottoId: P1, stato: "archiviato" });
    c("archiviare azzera la bozza di modifica", [null, "archiviato"], [riga(b4, P1).bozza_modifiche, riga(b4, P1).stato]);

    // gruppo: al massimo 20
    const g20 = fintoDb({ tabelle: tab() });
    const venti = Array.from({ length: 20 }, (_, i) => uuid(0x900 + i));
    const r20 = await POST(g20, { azione: "gruppo_stato", ids: venti, stato: "pubblicato" });
    const r21 = await POST(g20, { azione: "gruppo_stato", ids: [...venti, uuid(0x999)], stato: "pubblicato" });
    c("gruppo_stato: 20 prodotti sì (anche se non esistono: restano con il motivo), 21 → 400 con la frase", [200, 20, 400, true], [r20.stato, r20.json.restano.length, r21.stato, /al massimo 20/.test(r21.json.frase)]);

    // ritiro: va in bozza solo se è stato il ritiro a renderlo non pubblicabile
    const gia = fintoDb({ tabelle: tab((t) => { t.shop_prodotti_categorie.length = 0; t.shop_media.push(mediaProva({ id: uuid(0x4f5), prodotto_id: P1, slot: "foto2", ritrae_persone: true, liberatoria_ok: true })); }) });
    const rg = await POST(gia, { azione: "media_flag", mediaId: uuid(0x4f5), flag: { liberatoriaOk: false } });
    c("un pubblicato che era GIÀ non pubblicabile per un'altra ragione (niente categoria) e perde una foto non principale per liberatoria: resta com'è, nessun avviso", ["pubblicato", undefined], [riga(gia, P1).stato, rg.json.avviso]);

    // sottoRuolo
    const sr = fintoDb({ tabelle: tab() });
    const reg = async (sottoRuolo) => (await POST(sr, { azione: "media_registra", prodottoId: P2, slot: "foto3", sottoRuolo, alt: "Una foto", path480: "p/a-480.webp", path960: "p/a-960.webp", path1600: "p/a-1600.webp" })).stato;
    c("sottoRuolo: uno vero passa, uno inventato o un numero → 400", [200, 400, 400], [await reg("retro_base"), await reg("boh"), await reg(7)]);
  }

  // ── gli SKU si chiedono al database, e l'elenco dice quando è troncato ──
  {
    const molti = (n) => (t) => {
      for (let i = 0; i < n; i++) t.shop_prodotti.push(prodottoProva({ id: uuid(0x10000 + i), sku: `MASSA-${i}`, slug: `massa-${i}`, nome: `Massa ${i}`, stato: "bozza", pubblicato_il: null, id_codice: null }));
    };
    const grande = fintoDb({ tabelle: tab(molti(1500)) });
    const dup = await POST(grande, { azione: "prodotto_crea", nome: "Doppione", tipo: "cura", sku: "MASSA-1400" });
    c("uno SKU già usato da uno dei 1500 prodotti (oltre ogni tetto di lettura) è trovato lo stesso: 409", [409, "duplicato"], [dup.stato, dup.json.motivo]);
    const sku = fintoDb({ tabelle: tab() });
    await POST(sku, { azione: "prodotto_crea", nome: "Nuovo", tipo: "cura", sku: "HG-N01" });
    const letture = sku.registro.filter((x) => x.op === "select" && /sku/.test(x.cols ?? ""));
    c("la verifica dello SKU interroga il database per QUELLO SKU (filtro `in`), senza caricare l'elenco", [true, true], [
      letture.length >= 2 && letture.every((x) => x.filtri.some(([t, col, val]) => t === "in" && col === "sku" && val.length === 1 && val[0] === "HG-N01")),
      sku.registro.every((x) => !(x.tab === "shop_prodotti" && x.op === "select" && x.cols === "*" && x.limite === 1000)),
    ]);
    const el = (await GET(fintoDb({ tabelle: tab(molti(1000)) }), "?prodotti")).json;
    c("elenco oltre il tetto di 1000 prodotti: `troncato: true`, e non si mostrano più di 1000 righe", [true, 1000], [el.troncato, el.prodotti.length]);
    c("elenco sotto il tetto: `troncato: false`", false, (await GET(fintoDb({ tabelle: tab() }), "?prodotti")).json.troncato);
  }

  // ── il sorgente ──
  {
    const src = readFileSync(join(radice, "src/crm/negozio/prodotti.server.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    c("il sorgente: nessun delete, nessun process.env, nessun console, nessun client creato qui", [false, false, false, false], [/\.delete\(|\bDELETE\b/.test(src), /process\.env/.test(src), /console\./.test(src), /client\.server|createClient/.test(src)]);
    c("il sorgente: lo smistamento usa `hasOwnProperty`, mai `in`", [true, false], [/hasOwnProperty\.call\(AZIONI/.test(src), /azione in AZIONI/.test(src)]);
    c("il sorgente: la guardia viene prima di leggere il corpo (POST) e i parametri (GET)", [true, true], [src.indexOf("d.guardia(request)") < src.indexOf("request.text()"), src.indexOf("d.guardia(request)") < src.indexOf("new URL(request.url).searchParams")]);
  }
}
