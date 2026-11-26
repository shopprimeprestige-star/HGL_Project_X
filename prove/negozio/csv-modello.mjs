/** ── EDITOR PRODOTTI · E2b · IL FILE MODELLO ───────────────────────────────
 *  `src/crm/negozio/csv-modello.ts`: costruito dalla stessa lista di colonne del lettore; passa l'anteprima così com'è
 *  («2 prodotti · 5 varianti · 0 errori»), con dati inventati. E il percorso intero con il file di un'esportazione di Shopify, in UTF-8,
 *  con BOM, in Windows-1252 e con il punto e virgola. */
import { build } from "esbuild";
import { join } from "node:path";

const carica = async (radice, file) => {
  const r = await build({ entryPoints: [join(radice, file)], bundle: true, format: "esm", write: false, alias: { "@": join(radice, "src") }, logLevel: "silent", platform: "neutral" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};
const utf8 = (s) => new TextEncoder().encode(s);

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("EDITOR PRODOTTI · E2b · FILE MODELLO E PERCORSO INTERO DAL FILE ALL'ANTEPRIMA (25/11/2026)");
  const Mo = await carica(radice, "src/crm/negozio/csv-modello.ts").catch((e) => ({ errore: String(e) }));
  c("csv-modello.ts si compila e si carica", undefined, Mo.errore);
  if (Mo.errore) return;
  const Lt = await carica(radice, "src/crm/negozio/csv-lettore.ts");
  const P = await carica(radice, "src/crm/negozio/csv-prodotti.ts");
  const K = await carica(radice, "src/crm/negozio/csv-colonne.ts");
  const anteprima = (byte, categorie = []) => { const l = Lt.leggiCsv(byte); return l.ok ? { lettura: l, ...P.leggiProdottiCsv(l.record, { categorie }) } : { lettura: l }; };

  const testo = Mo.costruisciModello();
  const a = anteprima(utf8(testo));
  c("il modello passa l'anteprima: 2 prodotti · 5 varianti · 0 errori", [true, 2, 5, 0, 2, 0], [a.lettura.ok, a.conteggi.prodotti, a.conteggi.varianti, a.errori.length, a.prodotti.length, a.conteggi.conErrori]);
  c("…e senza nessun avviso (tutto quello che c'è è giusto)", [], a.avvisi);
  c("separatore virgola, UTF-8 (con il segno iniziale di Excel)", [",", "utf-8", true], [a.lettura.separatore, a.lettura.codifica, testo.startsWith("﻿")]);
  c("l'intestazione è fatta dalla stessa lista di colonne del lettore (una sola fonte)", K.COLONNE.filter((x) => x.nelModello).map((x) => x.intestazione), Lt.leggiCsv(utf8(testo)).record[0]);
  c("l'intestazione ha le colonne di Shopify, le tre in più e quelle che si ignorano (nessuna sconosciuta)", [[], true, true], [a.colonneIgnorate.filter((n) => !["Variant Compare At Price", "Image Src", "Image Position", "Image Alt Text", "Variant Image", "Published", "Status"].includes(n)), ["Short Description", "Categories", "Supplier"].every((n) => a.lettura.record[0].includes(n)), a.lettura.record[0].includes("Variant Compare At Price")]);
  c("nessuna colonna scritta due volte nel modello", [], K.mappaColonne(a.lettura.record[0]).doppie);
  const [semplice, conOpzioni] = a.prodotti;
  c("primo prodotto: semplice, una variante «Unica» con lo stesso SKU, giacenza e costo", ["ESEMPIO-SHAMPOO", 1490, 1, "Unica", "ESEMPIO-SHAMPOO", 10, 650, 250, "8000000000017"], [semplice.sku, semplice.prezzoCent, semplice.varianti.length, semplice.varianti[0].nome, semplice.varianti[0].sku, semplice.varianti[0].giacenza, semplice.varianti[0].costoCent, semplice.pesoG, semplice.gtin]);
  c("secondo prodotto: 2 opzioni, 4 varianti con SKU, prezzi e giacenze", [2, 4, ["Nero / 20 cm", "Nero / 30 cm", "Castano / 20 cm", "Castano / 30 cm"], [19900, 22900, 19900, 22900], [3, 2, 0, 1]], [Object.keys(conOpzioni.varianti[0].opzioni).length, conOpzioni.varianti.length, conOpzioni.varianti.map((v) => v.nome), conOpzioni.varianti.map((v) => v.prezzoCent ?? conOpzioni.prezzoCent), conOpzioni.varianti.map((v) => v.giacenza)]);
  c("nessun prodotto del modello usa una parola vietata né dati veri: nessun «sconto», nessuna cifra con Invisible Derm, nessun indirizzo web, nessuna email", false, /sconto|risparmi|barrato|invisible|https?:|@|\.it\b|\.com\b/i.test(testo));
  c("il modello non porta formule (nessuna cella che inizia con = + - @) né HTML pericoloso", false, /(^|[,\r\n])[=+\-@]|<script|<img/i.test(testo.replace(/^﻿/, "")));
  c("il modello è piccolo e il costo è una colonna del modello", [true, true], [testo.length < 5000, a.lettura.record[0].includes("Cost per item")]);
  c("caricato due volte il modello, gli SKU e gli indirizzi sono identici (nessun valore casuale o legato alla data)", testo, Mo.costruisciModello());

  // ── lo stesso file in altre forme: Excel italiano (; e Windows-1252), con il BOM ──
  const Er = await carica(radice, "src/crm/negozio/csv-errori.ts");
  const conPuntoVirgola = Er.scriviCsv(a.lettura.record, ";", false);
  const pv = anteprima(utf8(conPuntoVirgola));
  c("con il punto e virgola: lo stesso risultato (2 prodotti, 5 varianti, 0 errori)", [";", 2, 5, 0], [pv.lettura.separatore, pv.conteggi.prodotti, pv.conteggi.varianti, pv.errori.length]);
  const winzzz = Uint8Array.from(Buffer.from("Handle;Title;Variant SKU;Variant Price;Vendor\nbalsamo;Balsamo all'olio d'oliva è più;BAL-1;12,5;Caffè \x80\n", "latin1"));
  const w = anteprima(winzzz);
  c("Windows-1252 (Excel vecchio): accenti ed euro giusti nel titolo e nella marca", ["windows-1252", "Balsamo all'olio d'oliva è più", "Caffè €", 1250, 0], [w.lettura.codifica, w.prodotti[0].titolo, w.prodotti[0].marca, w.prodotti[0].prezzoCent, w.errori.length]);
  const bom = anteprima(Uint8Array.from([0xef, 0xbb, 0xbf, ...utf8("Handle,Title,Variant SKU,Variant Price\nx,Crème,X1,1\n")]));
  c("UTF-8 con il BOM di Excel: la prima colonna è «Handle» e il prodotto si legge", [1, "Crème"], [bom.conteggi.prodotti, bom.prodotti[0].titolo]);
  const bomRotto = anteprima(Uint8Array.from([0xef, 0xbb, 0xbf, ...Buffer.from("Handle;Title;Variant SKU;Variant Price\nx;Caff\xE8;X1;1\n", "latin1")]));
  c("BOM e un byte non UTF-8 (ripiego Windows-1252): «Handle» resta Handle, il prodotto si legge", [1, "Caffè"], [bomRotto.conteggi.prodotti, bomRotto.prodotti[0].titolo]);

  // ── un file di Shopify com'è ──
  const shopify = [
    "Handle,Title,Body (HTML),Vendor,Product Category,Type,Tags,Published,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Option3 Name,Option3 Value,Variant SKU,Variant Grams,Variant Inventory Tracker,Variant Inventory Qty,Variant Inventory Policy,Variant Fulfillment Service,Variant Price,Variant Compare At Price,Variant Requires Shipping,Variant Taxable,Variant Barcode,Image Src,Image Position,Image Alt Text,Gift Card,SEO Title,SEO Description,Variant Image,Variant Weight Unit,Variant Tax Code,Cost per item,Status",
    `colla-esempio,Colla di esempio,"<p>Una colla.</p><p>Due righe.</p>",Marca Esempio,Salute,kit,"a, b",TRUE,Title,Default Title,,,,,COLLA-1,50,shopify,4,deny,manual,15.90,19.90,TRUE,TRUE,,https://esempio.invalid/a.jpg,1,Foto,FALSE,Colla,Descrizione,,g,,5.00,active`,
    "colla-esempio,,,,,,,,,,,,,,,,,,,,,,,,,https://esempio.invalid/b.jpg,2,,,,,,,,,",
  ].join("\n");
  const sh = anteprima(utf8(shopify));
  c("un'esportazione di Shopify si carica così com'è: 1 prodotto, 1 variante, 0 errori", [1, 1, 0], [sh.conteggi.prodotti, sh.conteggi.varianti, sh.errori.length]);
  //  E13 (titolare, 26/11/2026): le foto si leggono; queste sono di un indirizzo finto, non di Shopify, quindi si saltano con l'avviso.
  c("…in bozza, senza foto (indirizzi non di Shopify) né prezzo barrato, con gli avvisi che lo dicono", [1590, 4, 500, "kit", true, true, true], [sh.prodotti[0].prezzoCent, sh.prodotti[0].varianti[0].giacenza, sh.prodotti[0].varianti[0].costoCent, sh.prodotti[0].tipo, sh.avvisi.some((x) => /1 prodotto aveva un prezzo barrato/.test(x.frase)), sh.avvisi.filter((x) => /Foto saltata: indirizzo non di Shopify/.test(x.frase)).length === 2, sh.avvisi.some((x) => /tutto entra in bozza/.test(x.frase))]);
  c("…la descrizione HTML diventa testo con i paragrafi", true, /^Una colla\.\s*\n+\s*Due righe\.$/.test(sh.prodotti[0].descrizioneLunga));
  c("…il costo «5.00» è letto da centDaEuro; nessun campo «stato» nel prodotto", [500, false], [sh.prodotti[0].varianti[0].costoCent, "stato" in sh.prodotti[0]]);

  // ── file ostile, di punta in bianco ──
  const spaiata = anteprima(utf8('Handle,Title,Variant SKU,Variant Price\na,"x,A1,1\nb,B,B1,1\nc,C,C1,1\n'));
  c("virgoletta aperta e mai chiusa: il lettore la ferma con la riga, nessun prodotto", [false, true], [spaiata.lettura.ok, /riga 2 c'è una virgoletta aperta/.test(spaiata.lettura.frase ?? "")]);
  const unita = anteprima(utf8('Handle,Title,Variant SKU,Variant Price\na,"x,A1,1\nb,"B,B1,1\nc,C,C1,1\n'));
  c("virgoletta spaiata chiusa più avanti: l'anteprima dice quante righe e quanti prodotti ha letto", [true], [unita.avvisi.some((x) => /virgoletta spaiata/.test(x.frase) && /righe e \d+ prodott/.test(x.frase))]);
  const t0 = performance.now();
  const righe = ["Handle,Title,Variant SKU,Variant Price"];
  for (let i = 0; i < 4000; i++) righe.push(`p${i},${"T".repeat(200)},SKU-${i},9`);
  const grande = anteprima(utf8(righe.join("\n")));
  c("4000 prodotti di 1 MB: respinti per il limite dei 300 (con la frase), in meno di un secondo", [true, false, true], [performance.now() - t0 < 1000, grande.lettura.ok && grande.prodotti.length > 0, /4000 prodotti: il massimo è 300/.test(grande.errori?.[0]?.frase ?? grande.lettura.frase ?? "")]);
  const t1 = performance.now();
  const lungheRighe = ["Handle,Title,Body (HTML),Variant SKU,Variant Price"];
  for (let i = 0; i < 250; i++) lungheRighe.push(`p${i},${"T".repeat(150)},"${"<b>x</b>".repeat(900)}",S${i}0,1`);
  const lunghe = anteprima(utf8(lungheRighe.join("\n")));
  c("250 prodotti con Body da 7200 segni (oltre il tetto per cella): tutti respinti, in meno di un secondo", [250, true], [lunghe.conteggi.conErrori, performance.now() - t1 < 1000]);
}
