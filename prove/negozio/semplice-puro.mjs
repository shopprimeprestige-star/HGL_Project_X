/** ── EDITOR PRODOTTI · E5 · IL PRODOTTO SEMPLICE: LE REGOLE SENZA SCHERMO ───
 *  `src/crm/ecommerce/prodotti/semplice-puro.ts`: margine e utile in centesimi (mai `parseFloat`), modalità semplice o con opzioni,
 *  la variante «Unica», la quantità e il motivo del movimento. In più, i campi nuovi di `scheda-pura.ts` (GTIN, MPN, categoria
 *  Google, peso, classe di spedizione, fornitore, note) che `scheda-pura.mjs` non conosce e che restano verdi senza modifiche.
 *  Dati inventati, nessun cliente. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSync } from "esbuild";

const caricaBundle = (percorso, radice) => {
  const r = buildSync({
    entryPoints: [percorso],
    bundle: true,
    format: "esm",
    write: false,
    alias: { "@": join(radice, "src") },
    logLevel: "silent",
  });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");

const variante = (o) => ({ id: "v", prodottoId: "p", sku: "HG-T01", nome: "Unica", opzioni: {}, prezzoCent: null, giacenza: 0, pesoG: null, attiva: true, gtin: null, ordine: 0, ...o });

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("EDITOR PRODOTTI · E5 · PRODOTTO SEMPLICE: REGOLE PURE (25/11/2026)");
  const file = join(radice, "src/crm/ecommerce/prodotti/semplice-puro.ts");
  const S = existsSync(file) ? await caricaBundle(file, radice) : {};
  c(
    "semplice-puro.ts esporta le funzioni",
    true,
    ["margine", "fraseMargine", "euroInTesto", "modalitaDi", "trovaUnica", "statoUnica", "avvisoPassaggioAOpzioni", "cambioQuantita", "MOTIVI_GIACENZA"].every((n) => n in S),
  );
  if (!existsSync(file)) return;

  // ── margine e utile: sempre in centesimi ──
  c("margine: prezzo 20,00 e costo 10,40 → utile 960 cent, 48 %", { utileCent: 960, percento: 48 }, S.margine(2000, 1040));
  c("margine: prezzo zero → nessun margine", null, S.margine(0, 100));
  c("margine: costo assente → nessun margine", null, S.margine(2000, null));
  c("margine: costo 0 → 100 %", { utileCent: 2000, percento: 100 }, S.margine(2000, 0));
  c("margine: costo sopra il prezzo → utile negativo", { utileCent: -250, percento: -25 }, S.margine(1000, 1250));
  c("euroInTesto: 960 → «9,60»", "9,60", S.euroInTesto(960));
  c("euroInTesto: 5 → «0,05»", "0,05", S.euroInTesto(5));
  c("euroInTesto: -250 → «-2,50»", "-2,50", S.euroInTesto(-250));
  c("euroInTesto: 0 → «0,00»", "0,00", S.euroInTesto(0));
  const f = S.fraseMargine("20,00", "10,40");
  c("fraseMargine: «Margine 48 %, utile 9,60 €»", { testo: "Margine 48 %, utile 9,60 €", tono: "ok" }, f);
  c("fraseMargine: la virgola o il punto sono lo stesso prezzo", S.fraseMargine("20,00", "10,40"), S.fraseMargine("20.00", "10.40"));
  c("fraseMargine: in perdita lo dice a parole", { testo: "Margine -25 %, utile -2,50 € (il costo è più alto del prezzo)", tono: "perdita" }, S.fraseMargine("10,00", "12,50"));
  c("fraseMargine: costo vuoto → niente frase", null, S.fraseMargine("19,90", ""));
  c("fraseMargine: prezzo vuoto → niente frase", null, S.fraseMargine("", "5,00"));
  c("fraseMargine: testo che non è un prezzo → niente frase", null, S.fraseMargine("venti", "5,00"));
  c("fraseMargine: tre cifre dopo la virgola → niente frase", null, S.fraseMargine("19,999", "5,00"));
  c("fraseMargine: 0,29 e 0,10 sono 19 centesimi (non 18,999…)", "Margine 66 %, utile 0,19 €", S.fraseMargine("0,29", "0,10")?.testo);

  // ── modalità semplice o con opzioni ──
  c("modalitaDi: nessuna variante → semplice", "semplice", S.modalitaDi([]));
  c("modalitaDi: la sola Unica → semplice", "semplice", S.modalitaDi([variante()]));
  c("modalitaDi: una variante con opzioni → opzioni", "opzioni", S.modalitaDi([variante({ attiva: false }), variante({ id: "w", sku: "HG-T01-RO", nome: "Rosso", opzioni: { Colore: "Rosso" } })]));
  c("modalitaDi: l'Unica disattivata da sola resta «semplice»", "semplice", S.modalitaDi([variante({ attiva: false })]));

  // ── la variante Unica ──
  const unica = variante({ id: "u" });
  const rossa = variante({ id: "r", sku: "HG-T01-RO", nome: "Rosso", opzioni: { Colore: "Rosso" } });
  c("trovaUnica: quella senza opzioni", "u", S.trovaUnica([rossa, unica], "HG-T01")?.id);
  c("trovaUnica: tra due senza opzioni vince lo SKU del prodotto", "giusta", S.trovaUnica([variante({ id: "altra", sku: "ALTRO" }), variante({ id: "giusta" })], "HG-T01")?.id);
  c("trovaUnica: solo varianti con opzioni → nessuna", null, S.trovaUnica([rossa], "HG-T01"));
  c("statoUnica: nessuna variante → da creare", "assente", S.statoUnica([], "HG-T01"));
  c("statoUnica: attiva", "attiva", S.statoUnica([unica], "HG-T01"));
  c("statoUnica: disattivata (da riaccendere)", "disattivata", S.statoUnica([variante({ attiva: false })], "HG-T01"));
  c("statoUnica: con opzioni non serve (mai «da creare»)", "non_serve", S.statoUnica([rossa], "HG-T01"));
  c("avvisoPassaggioAOpzioni: con 7 pezzi lo dice", true, /7 pezzi/.test(S.avvisoPassaggioAOpzioni(variante({ giacenza: 7 })) ?? ""));
  c("avvisoPassaggioAOpzioni: con 1 pezzo parla al singolare", true, /1 pezzo\b/.test(S.avvisoPassaggioAOpzioni(variante({ giacenza: 1 })) ?? ""));
  c("avvisoPassaggioAOpzioni: a zero nessun avviso", null, S.avvisoPassaggioAOpzioni(variante({ giacenza: 0 })));
  c("avvisoPassaggioAOpzioni: senza Unica nessun avviso", null, S.avvisoPassaggioAOpzioni(null));

  // ── la quantità e il motivo ──
  c("cambioQuantita: da 4 a 10 → carico di 6", { ok: true, differenza: 6, motivo: "carico" }, S.cambioQuantita(4, "10"));
  c("cambioQuantita: da 10 a 4 → rettifica di -6", { ok: true, differenza: -6, motivo: "rettifica" }, S.cambioQuantita(10, "4"));
  c("cambioQuantita: uguale → nessun cambio", { ok: true, differenza: 0, motivo: null }, S.cambioQuantita(4, " 4 "));
  c("cambioQuantita: «1e3» è un errore a parole", true, S.cambioQuantita(0, "1e3").ok === false && /intero/.test(S.cambioQuantita(0, "1e3").frase));
  c("cambioQuantita: «10,5» è un errore", false, S.cambioQuantita(0, "10,5").ok);
  c("cambioQuantita: «-3» è un errore", false, S.cambioQuantita(0, "-3").ok);
  c("cambioQuantita: vuoto è un errore", false, S.cambioQuantita(0, "").ok);
  c("cambioQuantita: oltre un milione è un errore", false, S.cambioQuantita(0, "1000001").ok);
  c("MOTIVI_GIACENZA: i tre del server, con l'etichetta", ["carico:Carico", "rettifica:Rettifica", "reso:Reso"], S.MOTIVI_GIACENZA.map((m) => `${m.valore}:${m.etichetta}`));

  // ── sorgente: niente `parseFloat`, niente `* 100`, i centesimi passano da centDaEuro ──
  const src = senzaCommenti(readFileSync(file, "utf8"));
  c("semplice-puro.ts usa centDaEuro", true, /centDaEuro\(/.test(src));
  c("semplice-puro.ts: niente parseFloat", false, /parseFloat/.test(src));
  c("semplice-puro.ts: niente «* 100»", false, /\*\s*100\b/.test(src));
  c("semplice-puro.ts: niente rete né React", false, /\bfetch\(|from "react"/.test(src));

  // ── scheda-pura.ts: i campi in più (la prova vecchia resta com'è) ──
  const P = await caricaBundle(join(radice, "src/crm/ecommerce/prodotti/scheda-pura.ts"), radice);
  const prodotto = {
    id: "p", slug: "prova", sku: "HG-T01", nome: "Prova", stato: "bozza", tipo: "patch", prezzoCent: 1990, marca: null, rigaPresentazione: null,
    descrizioneBreve: null, descrizioneLunga: null, perChi: null, caratteristiche: [], passi: [], confezione: [], avvertenze: [], faq: [],
    resoConsentito: null, resoGiorni: null, boxConsulenza: false, correlatoId: null, canali: { sito: false, meta: false, google: false, tiktok: false },
    seoTitolo: null, seoDescrizione: null, bozzaModifiche: null,
    gtin: "8001234567890", mpn: "MPN-1", categoriaGoogle: "Salute e bellezza", pesoG: 250, classeSpedizione: "piccolo", fornitore: "Fornitore PROVA",
    noteInterne: "da rivedere", notaTitolare: "controlla il prezzo",
  };
  const m = P.moduloDaProdotto(prodotto);
  c("moduloDaProdotto: i campi in più come testo", ["8001234567890", "MPN-1", "Salute e bellezza", "250", "piccolo", "Fornitore PROVA", "da rivedere", "controlla il prezzo"],
    [m.gtin, m.mpn, m.categoriaGoogle, m.pesoG, m.classeSpedizione, m.fornitore, m.noteInterne, m.notaTitolare]);
  const vuoto = P.moduloDaProdotto({ ...prodotto, gtin: null, mpn: null, categoriaGoogle: null, pesoG: null, classeSpedizione: null, fornitore: null, noteInterne: null, notaTitolare: null });
  c("moduloDaProdotto: i null diventano testo vuoto", ["", "", "", "", "", "", "", ""], [vuoto.gtin, vuoto.mpn, vuoto.categoriaGoogle, vuoto.pesoG, vuoto.classeSpedizione, vuoto.fornitore, vuoto.noteInterne, vuoto.notaTitolare]);
  const r = P.campiDaModulo(m);
  c("campiDaModulo: i campi in più hanno i tipi del server", [prodotto.gtin, prodotto.mpn, prodotto.categoriaGoogle, 250, "piccolo", "Fornitore PROVA", "da rivedere", "controlla il prezzo"],
    [r.campi.gtin, r.campi.mpn, r.campi.categoriaGoogle, r.campi.pesoG, r.campi.classeSpedizione, r.campi.fornitore, r.campi.noteInterne, r.campi.notaTitolare]);
  c("campiDaModulo: nessun errore sui dati buoni", {}, r.errori);
  const v = P.campiDaModulo(P.moduloDaProdotto({ ...prodotto, gtin: null, pesoG: null, fornitore: null }));
  c("campiDaModulo: vuoto → null (come li vuole il server)", [null, null, null], [v.campi.gtin, v.campi.pesoG, v.campi.fornitore]);
  const lungo = (n) => "x".repeat(n);
  const errore = (k, valore) => P.campiDaModulo({ ...m, [k]: valore }).errori[k];
  c("GTIN oltre 20 segni → frase", true, /20/.test(errore("gtin", lungo(21)) ?? ""));
  c("MPN oltre 40 segni → frase", true, /40/.test(errore("mpn", lungo(41)) ?? ""));
  c("fornitore oltre 200 segni → frase", true, /200/.test(errore("fornitore", lungo(201)) ?? ""));
  c("categoria Google oltre 200 segni → frase", true, /200/.test(errore("categoriaGoogle", lungo(201)) ?? ""));
  c("classe di spedizione oltre 40 segni → frase", true, /40/.test(errore("classeSpedizione", lungo(41)) ?? ""));
  c("nota interna oltre 5000 segni → frase", true, /5000/.test(errore("noteInterne", lungo(5001)) ?? ""));
  c("nota del titolare oltre 2000 segni → frase", true, /2000/.test(errore("notaTitolare", lungo(2001)) ?? ""));
  c("peso «12,5» → frase a parole", true, /grammi/.test(errore("pesoG", "12,5") ?? ""));
  c("peso «1e3» → frase a parole", true, /grammi/.test(errore("pesoG", "1e3") ?? ""));
  c("peso oltre 1 000 000 → frase a parole", true, /grammi/.test(errore("pesoG", "1000001") ?? ""));
  c("peso «0» è valido", undefined, errore("pesoG", "0"));
  c("un campo con errore non parte verso il server", false, "pesoG" in P.campiDaModulo({ ...m, pesoG: "12,5" }).campi);
}
