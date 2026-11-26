/** ── EDITOR PRODOTTI · E1 · LA FUNZIONE `shop_import_prodotto` SUL FINTO ───────────────────────────────────────────
 *  L'elenco UNICO degli scenari (`_scenari-import.json`) si esegue qui, sul finto, e a mano sul Postgres usa-e-getta
 *  (`prove/sql/shop-editor-prodotti.sql`, marcatori `-- SCENARIO: <nome>`): se i due dicono cose diverse sullo stesso
 *  scenario, si decide guardando lo scenario, mai ritoccando uno dei due. Qui si controlla anche che i marcatori del SQL
 *  coincidano con l'elenco e che il finto rispetti ciò che la funzione promette (niente scritto quando rifiuta, mai lo stato
 *  dall'input, funzione assente = PGRST202, il costo col suo CHECK). Dati inventati. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { contiene, marcatoriSql } from "./finto-db-r2.mjs";
import { categoriaProva, prodottoProva, varianteProva, tabelleProva } from "./dati.mjs";

const RPC = "shop_import_prodotto";

/** Le tabelle di partenza di ogni scenario: il «mondo» dell'elenco. */
function mondoDa(mondo) {
  return {
    shop_categorie: mondo.categorie.map((x) => categoriaProva({ id: x.id, slug: x.slug, nome: x.nome })),
    shop_prodotti: mondo.prodotti.map((x) => prodottoProva({ id: x.id, sku: x.sku, slug: x.slug, nome: x.nome, tipo: x.tipo, prezzo_cent: x.prezzo_cent, stato: x.stato, pubblicato_il: null })),
    shop_varianti: mondo.prodotti.flatMap((x) => x.varianti.map((v) => varianteProva({ id: v.id, prodotto_id: x.id, sku: v.sku, nome: v.nome, opzioni: v.opzioni, giacenza: v.giacenza }))),
    shop_prodotti_categorie: [], shop_giacenza_movimenti: [], shop_storico: [], shop_media: [],
  };
}
const dove = (righe, filtro) => righe.filter((r) => Object.entries(filtro ?? {}).every(([k, v]) => (v === null ? r[k] == null : JSON.stringify(r[k]) === JSON.stringify(v))));

/** Esegue uno scenario sul finto: lista di `{ etichetta, atteso, letto }` (letto = atteso se è andata come previsto). */
async function eseguiScenario(sc, mondo) {
  const db = fintoDb({ tabelle: mondoDa(mondo) });
  const esiti = [];
  const metti = (etichetta, atteso, letto, ok) => esiti.push({ etichetta: `${sc.nome} · ${etichetta}`, atteso, letto: ok ? atteso : letto });
  let n = 0;
  for (const p of sc.passi) {
    n++;
    const r = await db.rpc(RPC, p.args);
    const letto = r.error ? { errore: r.error.message } : r.data;
    metti(`${n}) ${RPC} → ${p.atteso.esito}`, p.atteso, letto, contiene(p.atteso, letto));
  }
  for (const k of sc.controlli) {
    const trovate = dove(db.tabelle[k.tabella] ?? [], k.dove);
    if (k.conta !== undefined) metti(`${k.tabella} ${JSON.stringify(k.dove)}: ${k.conta} righe`, k.conta, trovate.length, trovate.length === k.conta);
    else {
      const ok = trovate.length === 1 && contiene(k.atteso, trovate[0]);
      metti(`${k.tabella} ${JSON.stringify(k.dove)}`, k.atteso, trovate.length === 1 ? Object.fromEntries(Object.keys(k.atteso).map((c) => [c, trovate[0][c]])) : { righe: trovate.length }, ok);
    }
  }
  return { esiti, db };
}

export async function prove(_mod, { c, gruppo, radice }) {
  const elenco = JSON.parse(readFileSync(join(radice, "prove/negozio/_scenari-import.json"), "utf8"));
  gruppo("EDITOR PRODOTTI · E1 · GLI SCENARI DELL'IMPORT SUL FINTO (25/11/2026)");
  const nomi = elenco.scenari.map((s) => s.nome);
  c("l'elenco ha scenari con un nome unico, minuscolo con trattini bassi, tutti per shop-editor-prodotti.sql", [true, true], [
    nomi.length >= 20 && new Set(nomi).size === nomi.length && nomi.every((n) => /^[a-z0-9_]+$/.test(n)),
    elenco.scenari.every((s) => s.passi.length > 0 && s.controlli.length > 0 && s.descrizione),
  ]);
  const casi = ["semplice", "quattro_varianti", "slug_gia_presente", "sku_di_altro_prodotto", "sku_doppio_nel_gruppo", "giacenza_zero", "categoria_inesistente", "input_manomesso",
    "cinquantuno_varianti", "giacenza_enorme", "sku_variante_di_altro_prodotto", "secondo_invio"];
  c("i casi che il piano chiede per nome ci sono tutti", [], casi.filter((n) => !nomi.includes(n)));
  const rifiutati = [];
  for (const sc of elenco.scenari) {
    const { esiti, db } = await eseguiScenario(sc, elenco.mondo);
    for (const e of esiti) c(e.etichetta, e.atteso, e.letto);
    // chi rifiuta (tutti i passi non «creato») non scrive niente: nemmeno una riga nel registro delle scritture
    if (sc.passi.every((p) => p.atteso.esito !== "creato")) rifiutati.push([sc.nome, db.scritture.length]);
  }
  c("ogni scenario che rifiuta lascia il registro del finto senza scritture", [], rifiutati.filter(([, n]) => n !== 0));

  // ── i marcatori nel file SQL del collaudo ──
  gruppo("EDITOR PRODOTTI · E1 · I MARCATORI DEGLI SCENARI NEL COLLAUDO SQL");
  const percorso = join(radice, "prove/sql/shop-editor-prodotti.sql");
  c("il collaudo su Postgres usa-e-getta esiste, si ferma se il nome del database non contiene «prova» e si ferma al primo controllo sbagliato", [true, true, true], [
    existsSync(percorso),
    existsSync(percorso) && /current_database\(\) NOT ILIKE '%prova%'/.test(readFileSync(percorso, "utf8")),
    existsSync(percorso) && /ON_ERROR_STOP on/.test(readFileSync(percorso, "utf8")),
  ]);
  if (existsSync(percorso)) {
    const trovati = marcatoriSql(readFileSync(percorso, "utf8"));
    c("ogni scenario dell'elenco ha il suo marcatore nel SQL", [], nomi.filter((n) => !trovati.includes(n)));
    c("nessun marcatore nel SQL che l'elenco non conosce, nessun marcatore doppio", [[], trovati.length], [trovati.filter((n) => !nomi.includes(n)), new Set(trovati).size]);
  }

  // ── ciò che gli scenari non dicono: il finto come il database vero ──
  gruppo("EDITOR PRODOTTI · E1 · IL FINTO: FUNZIONE ASSENTE, COSTO, ARGOMENTI");
  const sc = elenco.scenari.find((s) => s.nome === "semplice");
  const argomenti = sc.passi[0].args;
  const senza = fintoDb({ tabelle: mondoDa(elenco.mondo), senzaFunzioni: [RPC] });
  const r0 = await senza.rpc(RPC, argomenti);
  c("migrazione non applicata (funzione assente): PGRST202 e niente scritto", ["PGRST202", 0], [r0.error?.code, senza.scritture.length]);
  c("la sonda del server ('{}') con la funzione presente dà non_valido e non scrive", ["non_valido", 0], await (async () => {
    const db = fintoDb({ tabelle: mondoDa(elenco.mondo) });
    const r = await db.rpc(RPC, { p_prodotto: {}, p_varianti: [], p_categorie: [], p_chi: "titolare" });
    return [r.data?.esito, db.scritture.length];
  })());
  const conArgSbagliato = await fintoDb({ tabelle: mondoDa(elenco.mondo) }).rpc(RPC, { ...argomenti, p_stato: "pubblicato" });
  c("un argomento che la funzione non ha (p_stato) → PGRST202: lo stato non si può passare nemmeno da lì", "PGRST202", conArgSbagliato.error?.code);
  const db = fintoDb({ tabelle: mondoDa(elenco.mondo) });
  const costoNeg = await db.from("shop_varianti").insert({ prodotto_id: elenco.mondo.prodotti[0].id, sku: "PROVA-COSTO", costo_cent: -1 });
  c("il finto applica il CHECK del costo: negativo → 23514, vuoto e zero passano", ["23514", null, null], [
    costoNeg.error?.code,
    (await db.from("shop_varianti").insert({ prodotto_id: elenco.mondo.prodotti[0].id, sku: "PROVA-COSTO-1", costo_cent: null })).error,
    (await db.from("shop_varianti").insert({ prodotto_id: elenco.mondo.prodotti[0].id, sku: "PROVA-COSTO-2", costo_cent: 0 })).error,
  ]);
  const senzaCosto = fintoDb({ tabelle: tabelleProva(), senzaColonne: { shop_varianti: ["costo_cent"] } });
  c("colonna del costo assente (migrazione non applicata): leggerla dà 42703, scriverla PGRST204", ["42703", "PGRST204"], [
    (await senzaCosto.from("shop_varianti").select("costo_cent").limit(1)).error?.code,
    (await senzaCosto.from("shop_varianti").update({ costo_cent: 5 }).eq("sku", "PROVA-001-A")).error?.code,
  ]);
  const doppia = fintoDb({ tabelle: mondoDa(elenco.mondo) });
  await doppia.rpc(RPC, argomenti);
  const dopoUno = doppia.tabelle.shop_prodotti.length;
  await doppia.rpc(RPC, argomenti);
  c("la stessa chiamata due volte: un prodotto in più solo la prima volta", [1, 0], [dopoUno - 1, doppia.tabelle.shop_prodotti.length - dopoUno]);
  const lunga = await fintoDb({ tabelle: mondoDa(elenco.mondo) }).rpc(RPC, { ...argomenti, p_prodotto: { ...argomenti.p_prodotto, descrizione_lunga: "x".repeat(5001) } });
  const limite = await fintoDb({ tabelle: mondoDa(elenco.mondo) }).rpc(RPC, { ...argomenti, p_prodotto: { ...argomenti.p_prodotto, descrizione_lunga: "x".repeat(5000) } });
  c("testi sul massimo passano, un segno in più no (descrizione lunga 5000)", ["non_valido", "descrizione_lunga", "creato"], [lunga.data?.esito, lunga.data?.motivo, limite.data?.esito]);
}
