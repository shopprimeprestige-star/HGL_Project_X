/** ── NEGOZIO · T09 · IL SERVER DELLA GIACENZA ──────────────────────────────
 *  `src/crm/negozio/giacenza.server.ts`: `giacenza_muovi` e `giacenza_imposta`. La giacenza si muove SOLO con le
 *  funzioni SQL di S1 (`shop_giacenza_muovi`, `shop_giacenza_imposta`): mai una scrittura diretta. Finto database di T01. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { tabelleProva, uuid } from "./dati.mjs";
import { porte, post, leggi, guardiaNo, scrittureDirette } from "./_server.mjs";

export async function prove(mod, { c, gruppo, radice }) {
  const G = mod["negozio/giacenza.server"];
  gruppo("NEGOZIO · IL SERVER DELLA GIACENZA (20/11/2026)");
  const V5 = uuid(0x300); // 5 pezzi
  const V0 = uuid(0x301); // 0 pezzi
  const esegui = async (corpo, opz = {}) => {
    const db = opz.db ?? fintoDb({ tabelle: tabelleProva() });
    const p = porte({ db, ...opz.porte });
    return { db, log: p.log, ...(await leggi(await G.gestisciPOST(post(corpo), p.d))) };
  };

  // ── la guardia viene prima di tutto ──
  for (const stato of [401, 403]) {
    const r = await esegui({ azione: "giacenza_muovi", varianteId: V5, delta: 1, motivo: "carico" }, { porte: { guardia: guardiaNo(stato) } });
    c(`guardia negata (${stato}): la risposta è quella della guardia, zero chiamate al database, zero log`, [stato, 0, 0], [r.stato, r.db.chiamate, r.log.length]);
  }

  // ── muovere ──
  const a = await esegui({ azione: "giacenza_muovi", varianteId: V5, delta: 5, motivo: "carico", nota: "Arrivo dal fornitore" });
  c("carico +5 su 5 → 10", [200, true, 10], [a.stato, a.corpo.ok, a.corpo.giacenza]);
  const mov = a.db.tabelle.shop_giacenza_movimenti;
  c("…un movimento scritto, con chi (il nome della guardia), giacenza dopo, motivo e nota", [1, "Titolare Prova", 10, 5, "carico", "Arrivo dal fornitore"],
    [mov.length, mov[0]?.chi, mov[0]?.giacenza_dopo, mov[0]?.delta, mov[0]?.motivo, mov[0]?.nota]);
  c("…e la variante ha 10 pezzi", 10, a.db.tabelle.shop_varianti.find((v) => v.id === V5).giacenza);

  const b = await esegui({ azione: "giacenza_muovi", varianteId: V0, delta: -1, motivo: "rettifica" });
  c("−1 su giacenza 0 → rifiutato (409, giacenza_negativa)", [409, false, "giacenza_negativa"], [b.stato, b.corpo.ok, b.corpo.motivo]);
  c("…la frase in italiano dice quanti ce ne sono e quanti se ne toglievano", [true, true], [/\b0\b/.test(b.corpo.frase), /\b1\b/.test(b.corpo.frase)]);
  c("…movimento NON scritto, giacenza ancora 0, nessuna scrittura", [0, 0, 0], [b.db.tabelle.shop_giacenza_movimenti.length, b.db.tabelle.shop_varianti.find((v) => v.id === V0).giacenza, b.db.scritture.length]);

  const z = await esegui({ azione: "giacenza_muovi", varianteId: V5, delta: 0, motivo: "rettifica" });
  c("delta 0 non è un errore (come S1): ok, giacenza di ora, nessun movimento, nessuna scrittura", [200, true, 5, 0, 0], [z.stato, z.corpo.ok, z.corpo.giacenza, z.db.tabelle.shop_giacenza_movimenti.length, z.db.scritture.length]);

  const ordine = await esegui({ azione: "giacenza_muovi", varianteId: V5, delta: -1, motivo: "ordine" });
  c("motivo «ordine» (è dell'ordine vero, non del CMS) → rifiutato prima del database", [400, "valore", 0], [ordine.stato, ordine.corpo.motivo, ordine.db.chiamate]);
  for (const m of ["boh", "", null, undefined, 3]) {
    const r = await esegui({ azione: "giacenza_muovi", varianteId: V5, delta: 1, motivo: m });
    c(`motivo ${JSON.stringify(m)} → rifiutato, nessuna chiamata`, [400, 0], [r.stato, r.db.chiamate]);
  }
  for (const [nome, v] of [["decimale", 1.5], ["testo", "2"], ["nullo", null], ["assente", undefined], ["infinito", Infinity], ["oltre il tetto", 2_000_000]]) {
    const r = await esegui({ azione: "giacenza_muovi", varianteId: V5, delta: v, motivo: "carico" });
    c(`delta ${nome} → 400 con la frase, nessuna chiamata`, [400, false, true, 0], [r.stato, r.corpo.ok, typeof r.corpo.frase === "string" && r.corpo.frase.length > 10, r.db.chiamate]);
  }
  const nonUuid = await esegui({ azione: "giacenza_muovi", varianteId: "t01", delta: 1, motivo: "carico" });
  c("varianteId che non è un UUID → 400, nessuna chiamata", [400, 0], [nonUuid.stato, nonUuid.db.chiamate]);
  const sparita = await esegui({ azione: "giacenza_muovi", varianteId: uuid(0x999), delta: 1, motivo: "carico" });
  c("variante che non c'è → 404 variante_inesistente", [404, "variante_inesistente"], [sparita.stato, sparita.corpo.motivo]);

  // ── impostare dalla lista ──
  const i = await esegui({ azione: "giacenza_imposta", varianteId: V0, valore: 5 });
  c("imposta 5 da 0 → 5, e il movimento ha il delta giusto (+5), motivo rettifica", [200, 5, 1, 5, "rettifica", 5], ((m) => [i.stato, i.corpo.giacenza, i.db.tabelle.shop_giacenza_movimenti.length, m?.delta, m?.motivo, m?.giacenza_dopo])(i.db.tabelle.shop_giacenza_movimenti[0]));
  const i2 = await esegui({ azione: "giacenza_imposta", varianteId: V5, valore: 5 });
  c("imposta lo stesso numero → ok, nessun movimento, nessuna scrittura", [200, 5, 0, 0], [i2.stato, i2.corpo.giacenza, i2.db.tabelle.shop_giacenza_movimenti.length, i2.db.scritture.length]);
  const i3 = await esegui({ azione: "giacenza_imposta", varianteId: V5, valore: 2, motivo: "reso" });
  c("imposta 2 da 5 con motivo reso → delta −3", [-3, "reso"], [i3.db.tabelle.shop_giacenza_movimenti[0].delta, i3.db.tabelle.shop_giacenza_movimenti[0].motivo]);
  for (const [nome, v] of [["negativo", -1], ["decimale", 2.5], ["testo", "5"], ["assente", undefined], ["oltre il tetto", 2_000_000]]) {
    const r = await esegui({ azione: "giacenza_imposta", varianteId: V5, valore: v });
    c(`imposta con valore ${nome} → 400, nessuna chiamata`, [400, 0], [r.stato, r.db.chiamate]);
  }

  // ── la corsa: cinque «−1» insieme su 3 pezzi ──
  const db = fintoDb({ tabelle: { ...tabelleProva(), shop_varianti: tabelleProva().shop_varianti.map((v) => (v.id === V5 ? { ...v, giacenza: 3 } : v)) } });
  const p = porte({ db });
  const esiti = await Promise.all(Array.from({ length: 5 }, () => G.gestisciPOST(post({ azione: "giacenza_muovi", varianteId: V5, delta: -1, motivo: "rettifica" }), p.d).then(leggi)));
  c("cinque «−1» insieme su 3 pezzi: tre riescono, due no, giacenza 0, mai sotto zero", [3, 2, 0, 3], [esiti.filter((e) => e.corpo.ok).length, esiti.filter((e) => e.corpo.motivo === "giacenza_negativa").length, db.tabelle.shop_varianti.find((v) => v.id === V5).giacenza, db.tabelle.shop_giacenza_movimenti.length]);
  c("…ogni movimento ha chi e giacenza_dopo (e la somma dei delta torna)", [true, -3], [db.tabelle.shop_giacenza_movimenti.every((m) => m.chi === "Titolare Prova" && Number.isInteger(m.giacenza_dopo) && m.giacenza_dopo >= 0), db.tabelle.shop_giacenza_movimenti.reduce((s, m) => s + m.delta, 0)]);

  // ── mai una scrittura diretta ──
  c("nel registro del database: solo rpc e letture, nessun insert/update/upsert su varianti o movimenti", [], scrittureDirette(db, ["shop_varianti", "shop_giacenza_movimenti"]));
  c("…le chiamate di scrittura sono funzioni SQL di S1", true, db.registro.filter((q) => q.op === "rpc").every((q) => ["shop_giacenza_muovi", "shop_giacenza_imposta"].includes(q.nome)));
  const sorgente = readFileSync(join(radice, "src/crm/negozio/giacenza.server.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c("il sorgente non contiene .insert( .update( .upsert( .delete(", [], [".insert(", ".update(", ".upsert(", ".delete("].filter((t) => sorgente.includes(t)));
  c("…e chiama le due funzioni SQL", [true, true], [sorgente.includes("shop_giacenza_muovi"), sorgente.includes("shop_giacenza_imposta")]);

  // ── guasti, migrazione, corpo storto ──
  const mancante = await esegui({ azione: "giacenza_muovi", varianteId: V5, delta: 1, motivo: "carico" }, { db: fintoDb({ tabelle: tabelleProva(), mancante: true }) });
  c("S1 non applicata (funzione assente) → 409 motivo «migrazione»", [409, false, "migrazione"], [mancante.stato, mancante.corpo.ok, mancante.corpo.motivo]);
  const guasto = await esegui({ azione: "giacenza_muovi", varianteId: V5, delta: 1, motivo: "carico" }, { db: fintoDb({ tabelle: tabelleProva(), errori: { "rpc.shop_giacenza_muovi": { error: { code: "XX000", message: "dettaglio con PROVA-001 e nota interna", details: "riga intera" } } } }) });
  c("errore del database → 500 con frase generica; il log ha solo il codice", [500, false, ["movimento XX000"]], [guasto.stato, guasto.corpo.ok, guasto.log]);
  c("…la risposta non ripete il messaggio del database", false, /PROVA-001|riga intera|XX000/.test(JSON.stringify(guasto.corpo)));
  const lancia = await esegui({ azione: "giacenza_muovi", varianteId: V5, delta: 1, motivo: "carico" }, { db: fintoDb({ tabelle: tabelleProva(), errori: { "rpc.shop_giacenza_muovi": { lancia: new TypeError("rete con PROVA-001") } } }) });
  c("eccezione → 500, nel log solo il nome del tipo", [500, ["eccezione TypeError"]], [lancia.stato, lancia.log]);
  for (const [nome, corpo] of [["JSON rotto", "{non json"], ["una lista", "[1]"], ["azione sconosciuta", { azione: "giacenza_boh" }], ["senza azione", {}]]) {
    const r = await esegui(corpo);
    c(`corpo storto (${nome}) → 400, nessuna chiamata al database`, [400, false, 0], [r.stato, r.corpo.ok, r.db.chiamate]);
  }
  for (const nome of ["constructor", "toString", "__proto__"]) {
    const r = await esegui({ azione: nome, varianteId: V5, delta: 1, motivo: "carico" });
    c(`azione «${nome}» → 400 azione_sconosciuta, nessuna chiamata`, [400, "azione_sconosciuta", 0], [r.stato, r.corpo.motivo, r.db.chiamate]);
  }
  c("l'elenco delle azioni del modulo", ["giacenza_imposta", "giacenza_muovi"], [...G.AZIONI_GIACENZA].sort());
}
