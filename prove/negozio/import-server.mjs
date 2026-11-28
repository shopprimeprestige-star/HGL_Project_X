/** ── EDITOR PRODOTTI · E3 · IL SERVER DELL'IMPORT (`import.server.ts`) ───────────────────────────────────────────────
 *  Commessa 2026-11-25-editor-prodotti, PIANO §1.4 e compito E3. Due azioni: `prodotti_importa_verifica` (sola lettura:
 *  NESSUNA scrittura, criterio 6) e `prodotti_importa` (fino a 5 prodotti, uno alla volta con `shop_import_prodotto`).
 *  Qui il modulo si prova da solo, con la guardia e il database finto di E1; lo smistamento e la guardia su ENTRAMBE le
 *  azioni stanno in `import-rotta.mjs`. Il server rifà ogni controllo con `validaProdottoImport` (E2b): la stessa frase del browser.
 *  Dati inventati (`PROVA-…`), nessuna rete, nessuna chiave. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { tabelleProva, uuid, varianteProva } from "./dati.mjs";
import { guardiaOk, guardiaNo, post, leggi } from "./_server.mjs";

const togliCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const byte = (o) => new TextEncoder().encode(typeof o === "string" ? o : JSON.stringify(o)).length;

export async function prove(mod, { c, gruppo, radice }) {
  const I = mod["negozio/import.server"];
  const R = mod["negozio/import-regole"];
  gruppo("EDITOR PRODOTTI · E3 · IL SERVER DELL'IMPORT (25/11/2026)");
  c("il modulo `import.server` si carica e ha le due azioni", ["prodotti_importa_verifica", "prodotti_importa"], [...(I?.AZIONI_IMPORT ?? [])]);
  if (!I) return;

  const CAT = uuid(0x100);
  /** Un ambiente: database finto (con le tabelle di prova), guardia, orologio, log. */
  const amb = (opz = {}) => {
    const db = opz.db ?? fintoDb({ tabelle: opz.tabelle ?? tabelleProva(), ...(opz.finto ?? {}) });
    const log = [];
    const conta = { guardia: 0 };
    const d = {
      guardia: async (r) => { conta.guardia++; return (opz.guardia ?? guardiaOk("Giulia Esempio"))(r); },
      db, adesso: () => new Date(opz.adesso ?? "2026-11-25T10:00:00.000Z"), log: (x) => log.push(x),
    };
    return { db, d, log, conta };
  };
  const POST = async (corpo, opz) => { const a = amb(opz); return { ...a, ...(await leggi(await I.gestisciPOST(post(corpo), a.d))) }; };
  const verifica = (corpo, opz) => POST({ azione: "prodotti_importa_verifica", ...corpo }, opz);
  const importa = (prodotti, opz, extra = {}) => POST({ azione: "prodotti_importa", prodotti, ...extra }, opz);

  /** Un prodotto già normalizzato, come lo manda il browser. */
  const variante = (riga, sku, extra = {}) => ({ riga, sku, nome: "Unica", opzioni: {}, prezzoCent: null, pesoG: null, gtin: null, costoCent: null, giacenza: 0, ...extra });
  const prodotto = (n, extra = {}) => ({ handle: `prova-${n}`, titolo: `Prodotto importato ${n}`, tipo: "cura", categorie: [], sku: `IMP-${n}`, prezzoCent: 1990, varianti: [variante(2, `IMP-${n}`)], ...extra });
  const scritte = (db) => db.scritture.length;
  const righeDi = (db, t) => db.tabelle[t] ?? [];
  const chiamateImporta = (db) => db.registro.filter((q) => q.op === "rpc" && q.nome === "shop_import_prodotto" && Object.keys(q.args.p_prodotto ?? {}).length > 0);

  // ── la guardia: prima di tutto ──
  for (const stato of [401, 403]) {
    const esiti = [];
    for (const azione of I.AZIONI_IMPORT) { const r = await POST({ azione, prodotti: [prodotto(1)], slugs: [], skus: [] }, { guardia: guardiaNo(stato) }); esiti.push([r.stato, r.db.chiamate, r.conta.guardia]); }
    c(`guardia negata (${stato}) su entrambe le azioni: risposta della guardia, ZERO chiamate al database`, [[stato, 0, 1], [stato, 0, 1]], esiti);
  }
  const lancia = await POST({ azione: "prodotti_importa", prodotti: [prodotto(1)] }, { guardia: async () => { throw new Error("rete caduta con dati veri"); } });
  c("guardia che lancia → 500 «interno», database mai toccato, nel log solo il nome del tipo", [500, "interno", 0, ["eccezione Error"], false], [lancia.stato, lancia.corpo.motivo, lancia.db.chiamate, lancia.log, /rete|dati/.test(JSON.stringify(lancia.corpo))]);
  const sconosciuta = await POST({ azione: "prodotti_importa_boh" });
  c("un'azione che non è dell'import → 400, database mai toccato", [400, "azione_sconosciuta", 0], [sconosciuta.stato, sconosciuta.corpo.motivo, sconosciuta.db.chiamate]);
  const rotto = await POST("{non è json");
  c("corpo che non è JSON → 400, database mai toccato", [400, 0], [rotto.stato, rotto.db.chiamate]);

  // ── LA VERIFICA: sola lettura ──
  const tVer = tabelleProva();
  tVer.shop_varianti[0].costo_cent = 31337; // un costo che NON deve uscire
  tVer.shop_prodotti_categorie.push({ prodotto_id: uuid(0x201), categoria_id: CAT });
  const v1 = await verifica({ slugs: ["prodotto-di-prova", "prodotto-in-bozza", "non-esiste", "prodotto-di-prova"], skus: ["prova-001-a", "PROVA-002", "NUOVO-1"] }, { tabelle: tVer });
  c("verifica: 200, e NESSUNA scrittura nel database (né insert, né update, né funzione che scrive)", [200, true, 0, []], [v1.stato, v1.corpo.ok, scritte(v1.db), v1.db.registro.filter((q) => q.op !== "select" && q.op !== "rpc").map((q) => q.chiave)]);
  c("verifica: gli indirizzi già presenti (id, nome, stato), una volta sola ciascuno", [
    { id: uuid(0x200), slug: "prodotto-di-prova", nome: "Prodotto di prova", stato: "pubblicato" },
    { id: uuid(0x201), slug: "prodotto-in-bozza", nome: "Prodotto in bozza", stato: "bozza" },
  ], [...v1.corpo.presenti].sort((a, b) => a.slug.localeCompare(b.slug)));
  c("verifica: gli SKU già usati (anche scritti minuscoli: si rinormalizzano) con il nome del prodotto e se sono di una variante", [
    { sku: "PROVA-001-A", prodottoId: uuid(0x200), prodottoNome: "Prodotto di prova", comeVariante: true },
    { sku: "PROVA-002", prodottoId: uuid(0x201), prodottoNome: "Prodotto in bozza", comeVariante: false },
  ], [...v1.corpo.skuUsati].sort((a, b) => a.sku.localeCompare(b.sku)));
  c("verifica: le categorie (id, indirizzo, nome), il costo e l'import disponibili", [[{ id: CAT, slug: "categoria-prova", nome: "Categoria di prova" }], true, true], [v1.corpo.categorie, v1.corpo.costoDisponibile, v1.corpo.importaDisponibile]);
  const tutto = JSON.stringify(v1.corpo);
  c("verifica: nella risposta MAI il costo, le note interne, la giacenza", [false, false, false, false], [/31337/.test(tutto), /costo_cent|costoCent|"costo"/i.test(tutto), /nota interna/i.test(tutto), /giacenza/i.test(tutto)]);
  c("verifica: le chiavi della risposta sono solo quelle del contratto", ["categorie", "costoDisponibile", "importaDisponibile", "ok", "presenti", "skuUsati"], Object.keys(v1.corpo).sort());
  const sel = v1.db.registro.filter((q) => q.op === "select");
  const conCosto = sel.filter((q) => /costo/.test(q.cols));
  c("verifica: le colonne lette sono solo quelle che servono: il costo si legge una volta sola per sapere se la colonna c'è (limit 1), mai nota, giacenza, prezzo", [1, 1, false, false], [
    conCosto.length, conCosto[0]?.limite, sel.some((q) => /note|giacenza|prezzo/.test(q.cols)), sel.some((q) => q.cols.trim() === "*"),
  ]);
  const sonda = v1.db.registro.filter((q) => q.op === "rpc");
  c("verifica: la funzione si sonda con un prodotto vuoto, che non scrive", [1, {}, false], [sonda.length, sonda[0]?.args.p_prodotto, sonda[0]?.scrisse]);

  // 300 indirizzi e 400 SKU: query da non più di 100 valori
  const slugs300 = Array.from({ length: 299 }, (_, i) => `prova-${i}`);
  slugs300.splice(250, 0, "prodotto-in-bozza");
  const skus400 = Array.from({ length: 399 }, (_, i) => `PROVA-X${i}`);
  skus400.splice(350, 0, "PROVA-001-A");
  const v300 = await verifica({ slugs: slugs300, skus: skus400 });
  const inSlug = v300.db.registro.filter((q) => q.tab === "shop_prodotti").flatMap((q) => (q.filtri ?? []).filter(([t, col]) => t === "in" && col === "slug").map(([, , val]) => val.length));
  const inSku = v300.db.registro.flatMap((q) => (q.filtri ?? []).filter(([t, col]) => t === "in" && col === "sku").map(([, , val]) => val.length));
  c("verifica con 300 indirizzi: 3 query da 100 valori, e trova quello al posto 250", [200, [100, 100, 100], 1, 0], [v300.stato, inSlug, v300.corpo.presenti?.length, scritte(v300.db)]);
  c("verifica con 400 SKU: query da non più di 100 valori (4 sui prodotti e 4 sulle varianti), e trova quello al posto 350", [[100, 100, 100, 100, 100, 100, 100, 100], true, 1], [inSku, Math.max(...v300.db.registro.flatMap((q) => (q.filtri ?? []).filter(([t]) => t === "in").map(([, , val]) => val.length))) <= 100, v300.corpo.skuUsati?.length]);
  c("verifica: 301 indirizzi, 401 SKU, o elenchi che non sono elenchi → 400 senza toccare il database", [[400, 0], [400, 0], [400, 0], [400, 0]], [
    await verifica({ slugs: Array.from({ length: 301 }, (_, i) => `a-${i}`), skus: [] }),
    await verifica({ slugs: [], skus: Array.from({ length: 401 }, (_, i) => `A-${i}`) }),
    await verifica({ slugs: "prodotto-di-prova", skus: [] }),
    await verifica({ slugs: [], skus: { 0: "PROVA-001" } }),
  ].map((r) => [r.stato, r.db.chiamate]));
  const strani = await verifica({ slugs: ['x"),slug.neq.("', 5, null, "Maiuscole"], skus: ["a b", "", 7, 'X"),sku.neq.("'] });
  const valoriMandati = strani.db.registro.flatMap((q) => (q.filtri ?? []).filter(([t]) => t === "in").flatMap(([, , val]) => val));
  c("verifica: valori che non sono indirizzi o SKU (virgolette, parentesi, numeri) non arrivano mai alla query", [200, []], [strani.stato, valoriMandati.filter((x) => /["(),]|Maiuscole|^5$/.test(String(x)))]);
  const senzaFunzione = await verifica({ slugs: [], skus: [] }, { finto: { senzaFunzioni: ["shop_import_prodotto"] } });
  c("verifica senza la funzione del database: importaDisponibile falso, il resto risponde, niente scritto", [200, false, true, 0], [senzaFunzione.stato, senzaFunzione.corpo.importaDisponibile, senzaFunzione.corpo.costoDisponibile, scritte(senzaFunzione.db)]);
  const senzaCosto = await verifica({ slugs: [], skus: [] }, { finto: { senzaColonne: { shop_varianti: ["costo_cent"] } } });
  c("verifica senza la colonna del costo: costoDisponibile falso", [200, false], [senzaCosto.stato, senzaCosto.corpo.costoDisponibile]);
  const guastoV = await verifica({ slugs: ["prodotto-di-prova"], skus: [] }, { finto: { errori: { "shop_prodotti.select": { error: { code: "XX000", message: "SEGRETO-DEL-DATABASE" } } } } });
  c("verifica con un guasto del database: 500 generico, nel log solo il codice", [500, "interno", ["verifica XX000"], false], [guastoV.stato, guastoV.corpo.motivo, guastoV.log, /SEGRETO/.test(JSON.stringify(guastoV.corpo) + guastoV.log.join())]);

  // ── L'IMPORT: percorso felice ──
  const semplice = prodotto(1, {
    handle: "crema-prova", titolo: "Crema di prova", marca: "Marca Finta", descrizioneBreve: "Una descrizione breve inventata.", descrizioneLunga: "Prima riga.\nSeconda riga.",
    categoriaGoogle: "Salute e bellezza", fornitore: "Fornitore Finto", seoTitolo: "Titolo SEO", seoDescrizione: "Descrizione SEO.", categorie: ["categoria-prova"],
    pesoG: 250, gtin: "8012345678905", sku: "IMP-CREMA", varianti: [variante(2, "IMP-CREMA", { costoCent: 450, giacenza: 10 })],
  });
  const quattro = prodotto(2, {
    handle: "cuffia-prova", titolo: "Cuffia di prova", tipo: "patch", sku: "IMP-CUF-ROSSO-S", chi: "Mallory", creatoDa: "Mallory",
    varianti: [
      variante(5, "IMP-CUF-ROSSO-S", { nome: "Rosso / S", opzioni: { Colore: "Rosso", Misura: "S" }, giacenza: 3, pesoG: 40 }),
      variante(6, "IMP-CUF-ROSSO-M", { nome: "Rosso / M", opzioni: { Colore: "Rosso", Misura: "M" }, prezzoCent: 2190, giacenza: 0 }),
      variante(7, "IMP-CUF-NERO-S", { nome: "Nero / S", opzioni: { Colore: "Nero", Misura: "S" }, giacenza: 2, gtin: "4006381333931" }),
      variante(8, "IMP-CUF-NERO-M", { nome: "Nero / M", opzioni: { Colore: "Nero", Misura: "M" }, giacenza: 5, costoCent: 700 }),
    ],
  });
  const ok1 = await importa([semplice, quattro], {}, { chi: "Mallory", creatoDa: "Mallory" });
  c("import di 2 prodotti: 200, esiti «creato» nell'ordine, con l'id del prodotto", [200, true, ["creato", "creato"], ["crema-prova", "cuffia-prova"], true], [
    ok1.stato, ok1.corpo.ok, ok1.corpo.risultati?.map((r) => r.esito), ok1.corpo.risultati?.map((r) => r.handle), ok1.corpo.risultati?.every((r) => typeof r.prodottoId === "string"),
  ]);
  const pc = righeDi(ok1.db, "shop_prodotti").find((r) => r.slug === "crema-prova");
  const vc = righeDi(ok1.db, "shop_varianti").filter((r) => r.prodotto_id === pc?.id);
  c("prodotto creato IN BOZZA con tutti i campi e la nota «Importato da CSV il 25/11/2026»", [
    { stato: "bozza", nome: "Crema di prova", sku: "IMP-CREMA", tipo: "cura", prezzo_cent: 1990, marca: "Marca Finta", descrizione_breve: "Una descrizione breve inventata.", descrizione_lunga: "Prima riga.\nSeconda riga.", categoria_google: "Salute e bellezza", fornitore: "Fornitore Finto", seo_titolo: "Titolo SEO", seo_descrizione: "Descrizione SEO.", peso_g: 250, gtin: "8012345678905", nota_titolare: "Importato da CSV il 25/11/2026" },
  ], [Object.fromEntries(Object.keys({ stato: 0, nome: 0, sku: 0, tipo: 0, prezzo_cent: 0, marca: 0, descrizione_breve: 0, descrizione_lunga: 0, categoria_google: 0, fornitore: 0, seo_titolo: 0, seo_descrizione: 0, peso_g: 0, gtin: 0, nota_titolare: 0 }).map((k) => [k, pc?.[k]]))]);
  c("la variante ha SKU, costo e giacenza 10, la categoria è legata", [[{ sku: "IMP-CREMA", costo_cent: 450, giacenza: 10 }], [CAT]], [
    vc.map((v) => ({ sku: v.sku, costo_cent: v.costo_cent, giacenza: v.giacenza })), righeDi(ok1.db, "shop_prodotti_categorie").filter((r) => r.prodotto_id === pc?.id).map((r) => r.categoria_id),
  ]);
  const mov = righeDi(ok1.db, "shop_giacenza_movimenti");
  c("la giacenza è un movimento «carico» con nota «Import CSV» e il NOME DELLA GUARDIA; niente movimento per giacenza 0 (4 movimenti: 10, 3, 2, 5)", [[10, 3, 2, 5], ["carico"], ["Import CSV"], ["Giulia Esempio"]], [
    mov.map((m) => m.delta), [...new Set(mov.map((m) => m.motivo))], [...new Set(mov.map((m) => m.nota))], [...new Set(mov.map((m) => m.chi))],
  ]);
  const vq = righeDi(ok1.db, "shop_varianti").filter((r) => r.sku.startsWith("IMP-CUF"));
  c("il prodotto con 4 varianti: opzioni e prezzi delle varianti scritti, prezzo vuoto = quello del prodotto", [["Rosso / S", "Rosso / M", "Nero / S", "Nero / M"], [null, 2190, null, null], [1, 2, 3, 4]], [vq.map((v) => v.nome), vq.map((v) => v.prezzo_cent), vq.map((v) => v.ordine)]);
  const spazi = await importa([prodotto(4, { handle: "spazi-prova", sku: "IMP-SPAZI", varianti: [variante(2, "IMP-SPAZI", { nome: "Rosso", opzioni: { " Colore\t": "  Rosso \n" } })] })]);
  c("le opzioni arrivano ripulite dai bordi (chiavi e valori): «Colore»/«Rosso», non « Colore\\t»/«  Rosso \\n»", [200, [{ Colore: "Rosso" }]], [spazi.stato, righeDi(spazi.db, "shop_varianti").filter((r) => r.sku === "IMP-SPAZI").map((r) => r.opzioni)]);
  const fuse = await importa([prodotto(5, { handle: "fuse-prova", sku: "IMP-FUSE", varianti: [variante(2, "IMP-FUSE", { nome: "Rosso", opzioni: { Colore: "Rosso", " Colore": "Nero" } })] })]);
  const eFuse = fuse.corpo.risultati?.[0];
  c("due opzioni che dopo il trim hanno lo stesso nome («Colore» e « Colore») NON si fondono in silenzio: errore a parole, riga indicata, niente scritto", [200, "errore", 2, true, 0], [
    fuse.stato, eFuse?.esito, eFuse?.errori?.[0]?.riga, /Colore/.test(eFuse?.errori?.[0]?.frase ?? "") && /stesso nome/.test(eFuse?.errori?.[0]?.frase ?? ""), righeDi(fuse.db, "shop_varianti").filter((r) => r.sku === "IMP-FUSE").length,
  ]);
  c("`chi` preso dalla guardia anche se il corpo ne porta un altro: «Mallory» non compare da nessuna parte", [false, true], [JSON.stringify(ok1.db.tabelle).includes("Mallory"), righeDi(ok1.db, "shop_storico").length > 0 && righeDi(ok1.db, "shop_storico").every((r) => r.chi === "Giulia Esempio")]);
  const risposta = JSON.stringify(ok1.corpo);
  c("la risposta dell'import non porta il costo né altro di non richiesto", [false, false], [/costo|450|700/.test(risposta), /nota_titolare|Importato da CSV/.test(risposta)]);
  const dopoMezzanotte = await importa([prodotto(3)], { adesso: "2026-11-25T23:30:00.000Z" });
  c("la data della nota è quella del SERVER nell'ora italiana (23:30 UTC del 25 = il 26 a Roma)", "Importato da CSV il 26/11/2026", righeDi(dopoMezzanotte.db, "shop_prodotti").find((r) => r.slug === "prova-3")?.nota_titolare);
  const notaMisurata = await importa([prodotto(3)], { adesso: "2026-11-24T23:30:00.000Z" });
  c("…e 23:30 UTC del 24 = il 25 a Roma", "Importato da CSV il 25/11/2026", righeDi(notaMisurata.db, "shop_prodotti").find((r) => r.slug === "prova-3")?.nota_titolare);

  // ── dati che il browser non dovrebbe mandare: stato, id, origine, canali ──
  const furbo = prodotto(4, { stato: "pubblicato", id: "00000000-0000-4000-8000-0000000000ff", origine: "codice", canali: { sito: true }, correlatoId: CAT, idCodice: "x", chi: "Mallory" });
  furbo.varianti[0] = { ...furbo.varianti[0], attiva: false, stato: "pubblicato", id: "00000000-0000-4000-8000-0000000000fe" };
  const fb = await importa([furbo]);
  const pf = righeDi(fb.db, "shop_prodotti").find((r) => r.slug === "prova-4");
  c("stato «pubblicato», id, origine, canali, correlato e id_codice dal browser NON entrano: bozza, id nuovo, canali di default", ["creato", "bozza", false, true, null, null, null], [
    fb.corpo.risultati?.[0]?.esito, pf?.stato, pf?.id === "00000000-0000-4000-8000-0000000000ff", righeDi(fb.db, "shop_varianti").find((v) => v.sku === "IMP-4")?.attiva, pf?.origine ?? null, pf?.correlato_id ?? null, pf?.id_codice ?? null,
  ]);
  c("…e il canale «sito» resta spento (default del database)", true, !pf?.canali?.sito);
  const args = chiamateImporta(fb.db)[0]?.args ?? {};
  c("alla funzione SQL arrivano SOLO i campi previsti, uno per uno: mai stato, id, origine, canali, chi del browser", [
    ["nome", "nota_titolare", "prezzo_cent", "sku", "slug", "tipo"],
    ["costo_cent", "giacenza", "gtin", "nome", "opzioni", "ordine", "peso_g", "prezzo_cent", "sku"],
    ["p_categorie", "p_chi", "p_prodotto", "p_varianti"],
  ], [
    Object.keys(args.p_prodotto ?? {}).filter((k) => args.p_prodotto[k] !== undefined).sort(), Object.keys(args.p_varianti?.[0] ?? {}).sort(), Object.keys(args).sort(),
  ]);

  // ── dati manomessi: ogni controllo si rifà, con la stessa frase del browser ──
  const contesto = { categorie: [{ slug: "categoria-prova" }] };
  const storti = {
    "prezzo negativo": prodotto(20, { prezzoCent: -5 }),
    "SKU non valido": prodotto(21, { sku: "hg t01", varianti: [variante(2, "hg t01")] }),
    "handle non normalizzato": prodotto(22, { handle: "Lace Front" }),
    "«sconto del» nel titolo": prodotto(23, { titolo: "Crema sconto del 20%" }),
    "251 varianti": prodotto(24, { varianti: Array.from({ length: 251 }, (_, k) => variante(2 + k, `IMP-24-${k}`)) }),
    "giacenza enorme": prodotto(25, { varianti: [variante(2, "IMP-25", { giacenza: 99999999999 })] }),
    "tipo sconosciuto": prodotto(26, { tipo: "boh" }),
    "categoria inesistente": prodotto(27, { categorie: ["non-esiste"] }),
    "tab nel titolo": prodotto(28, { titolo: "Crema\tdi prova" }),
    "titolo fatto di un tab": prodotto(29, { titolo: "\t" }),
    "a capo nella marca": prodotto(30, { marca: "Marca\nFinta" }),
    "costo negativo": prodotto(31, { varianti: [variante(2, "IMP-31", { costoCent: -1 })] }),
    "titolo di 121 segni": prodotto(32, { titolo: "x".repeat(121) }),
    "nessuna variante": prodotto(33, { varianti: [] }),
    "SKU doppio fra le varianti": prodotto(34, { varianti: [variante(2, "IMP-34"), variante(3, "IMP-34")] }),
    "4 opzioni": prodotto(35, { varianti: [variante(2, "IMP-35", { opzioni: { A: "1", B: "2", C: "3", D: "4" } })] }),
    "Invisible Derm con un prezzo": prodotto(36, { titolo: "Invisible Derm Siero", handle: "invisible-derm-siero", prezzoCent: 1000 }),
    "prezzo che è un testo": prodotto(37, { prezzoCent: "19,90" }),
  };
  for (const [nome, p] of Object.entries(storti)) {
    const r = await importa([p]);
    const atteso = R.validaProdottoImport(structuredClone(p), contesto).errori.map((e) => e.frase);
    const letto = r.corpo.risultati?.[0];
    c(`manomesso · ${nome}: «errore» con la STESSA frase del browser, niente scritto, il database non riceve la funzione`, [200, "errore", true, atteso, 0, 0], [
      r.stato, letto?.esito, atteso.length > 0, letto?.errori?.map((e) => e.frase), scritte(r.db), chiamateImporta(r.db).length,
    ]);
  }
  const conRighe = await importa([storti["SKU doppio fra le varianti"]]);
  c("un errore dice anche la riga (come in Excel) e tutte le righe del prodotto, per «Scarica le righe da correggere»", [3, [2, 3]], [conRighe.corpo.risultati[0].errori[0].riga, conRighe.corpo.risultati[0].errori[0].righeProdotto]);
  const misto = await importa([storti["prezzo negativo"], prodotto(40), storti["tab nel titolo"], prodotto(41)]);
  c("un prodotto con errori non ferma gli altri: [errore, creato, errore, creato]", ["errore", "creato", "errore", "creato"], misto.corpo.risultati.map((r) => r.esito));
  c("…e nel database ci sono solo i due buoni", ["prova-40", "prova-41"], righeDi(misto.db, "shop_prodotti").filter((r) => r.slug.startsWith("prova-4")).map((r) => r.slug));
  const nonOggetto = await importa([prodotto(42), "una stringa", null, 7, []]);
  c("elementi che non sono prodotti (stringa, null, numero, lista) → «errore» ciascuno, senza lanciare", [200, ["creato", "errore", "errore", "errore", "errore"]], [nonOggetto.stato, nonOggetto.corpo.risultati?.map((r) => r.esito)]);

  // ── i limiti della richiesta ──
  const sei = await importa(Array.from({ length: 6 }, (_, i) => prodotto(50 + i)));
  c("6 prodotti in una richiesta → 400 con la frase, database mai toccato", [400, "valore", "Si importano al massimo 5 prodotti per volta.", 0], [sei.stato, sei.corpo.motivo, sei.corpo.frase, sei.db.chiamate]);
  const cinque = await importa(Array.from({ length: 5 }, (_, i) => prodotto(60 + i)));
  c("5 prodotti → tutti creati", [200, ["creato", "creato", "creato", "creato", "creato"]], [cinque.stato, cinque.corpo.risultati?.map((r) => r.esito)]);
  for (const [nome, corpo] of [["nessun elenco", {}], ["elenco vuoto", { prodotti: [] }], ["elenco che è un oggetto", { prodotti: { 0: prodotto(1) } }], ["elenco che è un testo", { prodotti: "boh" }]]) {
    const r = await POST({ azione: "prodotti_importa", ...corpo });
    c(`import · ${nome} → 400, database mai toccato`, [400, 0], [r.stato, r.db.chiamate]);
  }
  const grande = (n) => prodotto(n, {
    descrizioneBreve: "Testo di prova per la descrizione breve. ".repeat(10).trim().slice(0, 300),
    descrizioneLunga: "Una riga di descrizione inventata per misurare la richiesta. ".repeat(100).slice(0, 5000).trim(),
    seoDescrizione: "Descrizione per i motori di ricerca, inventata. ".repeat(12).slice(0, 500).trim(),
    varianti: Array.from({ length: 50 }, (_, k) => variante(2 + k, `GR-${n}-${k}`, { nome: `Variante numero ${k} del prodotto ${n}`, opzioni: { Colore: `Colore ${k}`, Misura: `Misura ${k}` }, giacenza: 1, costoCent: 100 + k, gtin: "8012345678905", pesoG: 100 })),
  });
  const gruppo75 = Array.from({ length: 5 }, (_, i) => grande(70 + i));
  const peso = byte({ azione: "prodotti_importa", prodotti: gruppo75 });
  const g75 = await importa(gruppo75);
  c(`un gruppo di 5 prodotti da ~75 KB (${peso} byte: oltre i 20 000 di leggiCorpo, sotto i 200 000 del server) è accettato`, [true, 200, ["creato", "creato", "creato", "creato", "creato"], 250], [peso > 70_000 && peso < 100_000, g75.stato, g75.corpo.risultati?.map((r) => r.esito), righeDi(g75.db, "shop_varianti").filter((v) => v.sku.startsWith("GR-")).length]);
  const pad = (n) => JSON.stringify({ azione: "prodotti_importa", prodotti: [], x: "a".repeat(n) });
  const n0 = 200_000 - byte(pad(0));
  const alTetto = await POST(pad(n0));
  c("corpo di ESATTAMENTE 200 000 byte → non è 413 (qui è «elenco vuoto», 400)", [200_000, 400], [byte(pad(n0)), alTetto.stato]);
  const sopra = await POST(pad(n0 + 1));
  c("corpo di 200 001 byte (con Content-Length) → 413, database mai toccato", [200_001, 413, 0], [byte(pad(n0 + 1)), sopra.stato, sopra.db.chiamate]);
  const flusso = (testo) => new ReadableStream({ start(ctrl) { const e = new TextEncoder().encode(testo); for (let i = 0; i < e.length; i += 4096) ctrl.enqueue(e.subarray(i, i + 4096)); ctrl.close(); } });
  const a2 = amb();
  const senzaLunghezza = await leggi(await I.gestisciPOST(new Request("https://sito.test/api/crm/negozio", { method: "POST", body: flusso(pad(n0 + 1)), duplex: "half" }), a2.d));
  c("corpo a pezzi senza Content-Length oltre 200 000 byte → 413 lo stesso", [413, 0], [senzaLunghezza.stato, a2.db.chiamate]);

  // ── doppioni: secondo invio, SKU di un altro prodotto, due prodotti con lo stesso SKU ──
  const db2 = fintoDb({ tabelle: tabelleProva() });
  const primo = await importa([semplice], { db: db2 });
  const prima = { ...Object.fromEntries(["shop_prodotti", "shop_varianti", "shop_giacenza_movimenti", "shop_storico", "shop_prodotti_categorie"].map((t) => [t, righeDi(db2, t).length])), scritture: scritte(db2) };
  const secondo = await importa([semplice], { db: db2 });
  const dopo = { ...Object.fromEntries(["shop_prodotti", "shop_varianti", "shop_giacenza_movimenti", "shop_storico", "shop_prodotti_categorie"].map((t) => [t, righeDi(db2, t).length])), scritture: scritte(db2) };
  c("secondo invio dello stesso prodotto → «aggiornato» con lo stesso id: nessun prodotto, variante o movimento in più, solo lo storico della sovrascrittura", [["creato"], ["aggiornato"], true, { ...prima, shop_storico: prima.shop_storico + 2, scritture: prima.scritture + 1 }], [primo.corpo.risultati.map((r) => r.esito), secondo.corpo.risultati.map((r) => r.esito), secondo.corpo.risultati[0].prodottoId === primo.corpo.risultati[0].prodottoId, dopo]);

  // ── la sovrascrittura (migrazione 20261128130000): il file rimette a posto il prodotto che c'è già ──
  const db3 = fintoDb({ tabelle: tabelleProva() });
  const vecchio = prodotto(70, { descrizioneBreve: "Breve vecchia", marca: "Vecchia", varianti: [variante(2, "SOV-1", { nome: "Biondo", opzioni: { Colore: "Biondo" }, giacenza: 5 }), variante(3, "SOV-2", { nome: "Nero", opzioni: { Colore: "Nero" }, giacenza: 5 })] });
  const creato = await importa([vecchio], { db: db3 });
  const p70 = () => righeDi(db3, "shop_prodotti").find((r) => r.slug === "prova-70");
  Object.assign(p70(), { stato: "archiviato", bozza_modifiche: { nome: "modifica a metà" }, nota_titolare: "Nota mia" });
  const nuovoFile = prodotto(70, { titolo: "Prodotto rifatto", prezzoCent: 2500, marca: "Nuova", descrizioneBreve: "", varianti: [variante(2, "SOV-1", { nome: "Biondo chiaro", opzioni: { Colore: "Biondo chiaro" }, prezzoCent: 2600, giacenza: 99 }), variante(3, "SOV-3", { nome: "Rosso", opzioni: { Colore: "Rosso" }, giacenza: 3 })] });
  const sov = await importa([nuovoFile], { db: db3 });
  const v70 = (sku) => righeDi(db3, "shop_varianti").find((r) => r.sku === sku);
  c("sovrascrive: stesso id, nome e prezzo del file, marca nuova, descrizione vuota nel file = resta quella di prima, nota del titolare intatta", ["aggiornato", creato.corpo.risultati[0].prodottoId, "Prodotto rifatto", 2500, "Nuova", "Breve vecchia", "Nota mia"], [sov.corpo.risultati[0].esito, sov.corpo.risultati[0].prodottoId, p70().nome, p70().prezzo_cent, p70().marca, p70().descrizione_breve, p70().nota_titolare]);
  c("dal Cestino torna in bozza e le modifiche in bozza non pubblicate si scartano (vince il file)", ["bozza", null], [p70().stato, p70().bozza_modifiche]);
  c("varianti per SKU: SOV-1 aggiornata (giacenza che c'era intatta, non quella del file), SOV-3 nuova col carico del file, SOV-2 tolta dal file = spenta, non cancellata", [["Biondo chiaro", 2600, 5, true], ["Rosso", 3, true], [false, 5]], [
    [v70("SOV-1").nome, v70("SOV-1").prezzo_cent, v70("SOV-1").giacenza, v70("SOV-1").attiva], [v70("SOV-3").nome, v70("SOV-3").giacenza, v70("SOV-3").attiva], [v70("SOV-2").attiva, v70("SOV-2").giacenza],
  ]);
  Object.assign(p70(), { stato: "pubblicato" });
  const ancora = await importa([nuovoFile], { db: db3 });
  c("un prodotto pubblicato sovrascritto resta pubblicato", ["aggiornato", "pubblicato"], [ancora.corpo.risultati[0].esito, p70().stato]);
  const rubaSku = await importa([prodotto(70, { varianti: [variante(2, "PROVA-001-A")] })], { db: db3 });
  c("sovrascrivere con lo SKU di un ALTRO prodotto → errore col suo nome, il prodotto resta com'era", [["errore"], ["Lo SKU PROVA-001-A è già usato dal prodotto «Prodotto di prova»."], "Prodotto rifatto", true], [rubaSku.corpo.risultati.map((r) => r.esito), rubaSku.corpo.risultati[0].errori.map((e) => e.frase), p70().nome, v70("SOV-1").attiva]);
  const db4 = fintoDb({ tabelle: tabelleProva(), senzaFunzioni: ["shop_import_sovrascrivi"] });
  await importa([vecchio], { db: db4 });
  const nScritte = scritte(db4);
  const senzaSov = await importa([nuovoFile], { db: db4 });
  c("database senza la funzione della sovrascrittura → «gia_presente» come prima, niente scritto, nessun errore", [200, ["gia_presente"], nScritte, "Prodotto importato 70"], [senzaSov.stato, senzaSov.corpo.risultati.map((r) => r.esito), scritte(db4), righeDi(db4, "shop_prodotti").find((r) => r.slug === "prova-70").nome]);
  const db5 = fintoDb({ tabelle: tabelleProva(), errori: { "rpc.shop_import_sovrascrivi": { error: { code: "XX000", message: "SEGRETO-DEL-DATABASE" } } } });
  await importa([vecchio], { db: db5 });
  const guastoSov = await importa([nuovoFile], { db: db5 });
  c("guasto del database nella sovrascrittura → 500 senza il messaggio del database", [500, false], [guastoSov.stato, JSON.stringify(guastoSov.corpo).includes("SEGRETO")]);
  const altroSku = await importa([prodotto(80, { varianti: [variante(9, "PROVA-001-A")] }), prodotto(81, { varianti: [variante(4, "PROVA-002")] })]);
  c("SKU di una variante o di un prodotto di un ALTRO prodotto → errore col nome del prodotto e la riga; niente scritto", [["errore", "errore"], ["Lo SKU PROVA-001-A è già usato dal prodotto «Prodotto di prova»."], ["Lo SKU PROVA-002 è già usato dal prodotto «Prodotto in bozza»."], [9, 4], 0], [
    altroSku.corpo.risultati.map((r) => r.esito), altroSku.corpo.risultati[0].errori.map((e) => e.frase), altroSku.corpo.risultati[1].errori.map((e) => e.frase), altroSku.corpo.risultati.map((r) => r.errori[0].riga), righeDi(altroSku.db, "shop_prodotti").filter((r) => r.slug === "prova-80" || r.slug === "prova-81").length,
  ]);
  const stessoSku = await importa([prodotto(82, { sku: "DOPPIO-1", varianti: [variante(2, "DOPPIO-1")] }), prodotto(83, { sku: "DOPPIO-1", varianti: [variante(5, "DOPPIO-1")] })]);
  c("due prodotti dello stesso gruppo con lo stesso SKU: il primo entra, il secondo è un errore (dice il nome del primo)", [["creato", "errore"], ["Lo SKU DOPPIO-1 è già usato dal prodotto «Prodotto importato 82»."]], [stessoSku.corpo.risultati.map((r) => r.esito), stessoSku.corpo.risultati[1].errori?.map((e) => e.frase)]);

  // ── tab, a capo e spazi nei testi lunghi: il server li ripulisce senza fidarsi della funzione (btrim toglie solo gli spazi) ──
  const sporco = await importa([prodotto(90, { descrizioneBreve: "\n  Breve con spazi \t", descrizioneLunga: "\t\n", seoDescrizione: " \n SEO \n ", marca: "  Marca  " })]);
  const ps = righeDi(sporco.db, "shop_prodotti").find((r) => r.slug === "prova-90");
  c("testi lunghi con tab e a capo ai bordi: ripuliti; fatti solo di spazi bianchi: vuoti (nessun valore); marca senza spazi ai bordi", ["creato", "Breve con spazi", null, "SEO", "Marca"], [sporco.corpo.risultati[0].esito, ps?.descrizione_breve, ps?.descrizione_lunga, ps?.seo_descrizione, ps?.marca]);
  const inviato = chiamateImporta(sporco.db)[0]?.args.p_prodotto ?? {};
  c("…e alla funzione SQL arrivano già ripuliti (il finto taglia anche tab e a capo, il SQL `btrim` no: lo si guarda negli argomenti): il vuoto non si manda", ["Breve con spazi", undefined, "SEO", "Marca"], [inviato.descrizione_breve, inviato.descrizione_lunga, inviato.seo_descrizione, inviato.marca]);
  const titolato = await importa([prodotto(91, { titolo: "\n Crema da bordi \t", varianti: [variante(2, "IMP-91", { nome: "\t Unica \n" })] })]);
  const invT = chiamateImporta(titolato.db)[0]?.args;
  c("titolo e nome della variante con tab o a capo ai bordi: arrivano alla funzione ripuliti", [["creato"], "Crema da bordi", "Unica"], [titolato.corpo.risultati.map((r) => r.esito), invT?.p_prodotto.nome, invT?.p_varianti[0].nome]);

  // ── la migrazione non c'è, il database non risponde, la funzione rifiuta ──
  const senzaFn = await importa([prodotto(95)], { finto: { senzaFunzioni: ["shop_import_prodotto"] } });
  c("finto SENZA la funzione → 409, la frase «Per importare serve un aggiornamento del database», niente scritto", [409, "migrazione", true, 0], [senzaFn.stato, senzaFn.corpo.motivo, /Per importare serve un aggiornamento del database/.test(senzaFn.corpo.frase), scritte(senzaFn.db)]);
  const guastoI = await importa([prodotto(96)], { finto: { errori: { "rpc.shop_import_prodotto": { error: { code: "XX000", message: "SEGRETO-DEL-DATABASE Crema" } } } } });
  c("la funzione che dà un guasto → 500 generico, nel log solo il codice, mai il messaggio", [500, "interno", ["importa XX000"], false], [guastoI.stato, guastoI.corpo.motivo, guastoI.log, /SEGRETO|Crema/.test(JSON.stringify(guastoI.corpo) + guastoI.log.join())]);
  const nonValido = await importa([prodotto(97, { categorie: ["categoria-prova"] }), prodotto(98)], { finto: { prima: { "rpc.shop_import_prodotto": (t) => { t.shop_categorie.length = 0; } } } });
  c("la funzione che risponde «non_valido» (la categoria sparita nel frattempo): errore con la frase, tutto annullato, il log col solo codice; l'altro prodotto entra", [["errore", "creato"], true, 0, ["import non_valido 23503"]], [
    nonValido.corpo.risultati.map((r) => r.esito), /Il database non ha accettato questo prodotto/.test(nonValido.corpo.risultati[0].errori?.[0]?.frase ?? ""), righeDi(nonValido.db, "shop_prodotti").filter((r) => r.slug === "prova-97").length, nonValido.log,
  ]);

  // ── il log: solo codici ──
  const velenoso = await importa([prodotto(99, { titolo: "SEGRETO-TITOLO sconto del 10%", marca: "SEGRETO-MARCA" }), prodotto(100, { titolo: "SEGRETO-BUONO" })]);
  c("log: con dati veri in gioco, nel log non compare nessun testo del prodotto", false, /SEGRETO/.test(velenoso.log.join(" ") + JSON.stringify(velenoso.db.registro.map((q) => q.chiave))));

  // ── il sorgente ──
  const src = togliCommenti(readFileSync(join(radice, "src/crm/negozio/import.server.ts"), "utf8"));
  c("sorgente: nessun `delete`, nessun `.delete(`, nessun `console.`, nessun `process.env`, nessun `parseFloat`", [false, false, false, false, false], [/\bdelete\b/i.test(src), /\.delete\(/.test(src), /console\./.test(src), /process\.env/.test(src), /parseFloat/.test(src)]);
  c("sorgente: il tetto del corpo è quello dell'import (200 000, LIMITI.byteServer) letto con leggiTesto, non con leggiCorpo (20 000)", [true, false], [/leggiTesto\(request,\s*LIMITI\.byteServer\)/.test(src), /leggiCorpo\(/.test(src)]);
  c("sorgente: ogni `d.log(` scrive un codice (parola fissa + codice o nome del tipo), mai un testo del prodotto", true, (src.match(/\.log\([^;]*\);/g) ?? []).length > 0 && (src.match(/\.log\([^;]*\);/g) ?? []).every((l) => /^\.log\(`[a-z_ ]+( \$\{sigla\([^`]*\)\})?`\);$/.test(l)));
  c("sorgente: `p_chi` viene dalla guardia (`chi`), mai dal corpo; i campi del prodotto si scrivono uno per uno (nessuna copia dell'input)", [true, false, false], [/p_chi:\s*chi\b/.test(src), /p_chi:\s*(corpo|p)\b/.test(src), /p_prodotto:\s*\{?\s*\.\.\./.test(src)]);
  c("sorgente: riusa le regole del browser (`validaProdottoImport`) e le letture sono spezzate in gruppi da 100", [true, true], [/validaProdottoImport\(/.test(src), /\b100\b/.test(src)]);
}
