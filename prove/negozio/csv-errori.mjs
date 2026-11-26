/** ── EDITOR PRODOTTI · E2b · «SCARICA LE RIGHE DA CORREGGERE» ───────────────
 *  `src/crm/negozio/csv-errori.ts`: solo le righe respinte + la colonna «Errore», le formule messe al sicuro con un apice (anche dopo gli spazi,
 *  anche `-`, `+`, `@`, tab, CR), il file che si rilegge uguale, e i tempi. Dati inventati. */
import { build } from "esbuild";
import { join } from "node:path";

const carica = async (radice, file) => {
  const r = await build({ entryPoints: [join(radice, file)], bundle: true, format: "esm", write: false, alias: { "@": join(radice, "src") }, logLevel: "silent", platform: "neutral" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};
const utf8 = (s) => new TextEncoder().encode(s);

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("EDITOR PRODOTTI · E2b · RIGHE DA CORREGGERE: SOLO LE RESPINTE, FORMULE AL SICURO (25/11/2026)");
  const E = await carica(radice, "src/crm/negozio/csv-errori.ts").catch((e) => ({ errore: String(e) }));
  c("csv-errori.ts si compila e si carica", undefined, E.errore);
  if (E.errore) return;
  const Lt = await carica(radice, "src/crm/negozio/csv-lettore.ts");
  const P = await carica(radice, "src/crm/negozio/csv-prodotti.ts");
  const rileggi = (testo) => Lt.leggiCsv(utf8(testo)).record;

  // ── formule ──
  c("proteggiCella: =, +, -, @ prendono un apice; il testo normale no", ["'=CMD()", "'+1", "'-1", "'@SOMMA(A1)", "ciao", "19,90", ""], ["=CMD()", "+1", "-1", "@SOMMA(A1)", "ciao", "19,90", ""].map(E.proteggiCella));
  c("…anche con gli spazi davanti (la variante classica « =CMD()»), anche lo spazio duro", ["' =CMD()", "'   @x", "' =1"], [" =CMD()", "   @x", " =1"].map(E.proteggiCella));
  c("…e tab e CR in testa (anche dopo gli spazi)", ["'\t=1", "'\rx", "' \tx"], ["\t=1", "\rx", " \tx"].map(E.proteggiCella));
  c("un segno nel mezzo non conta", ["a=b", "5-3", "a@b.it"], ["a=b", "5-3", "a@b.it"].map(E.proteggiCella));

  // ── il file ──
  const record = [
    ["Handle", "Title", "Variant Price"],
    ["bene", "Bene", "10"],
    ["male", "=CMD()", "abc"],
    ["male", " =HYPERLINK(\"x\")", "-5"],
    ["altro", "Altro, con virgola", "xx"],
    ["fine", "Fine", "1"],
  ];
  const errori = [
    { riga: 3, handle: "male", frase: "Variant Price «abc» non è un prezzo. Scrivi 19,90.", righeProdotto: [3, 4] },
    { riga: 5, handle: "altro", frase: "Variant Price «xx» non è un prezzo.", righeProdotto: [5] },
  ];
  const csv = E.righeDaCorreggere(record, errori);
  const letto = rileggi(csv);
  c("il file comincia con il segno di Excel (UTF-8) e usa gli a capo di Windows", [true, true], [csv.startsWith("﻿"), csv.includes("\r\n")]);
  c("intestazione con in più «Errore»", ["Handle", "Title", "Variant Price", "Errore"], letto[0]);
  c("solo le righe respinte, con TUTTE le righe del prodotto (3 e 4, poi 5): la 2 e la 6 non ci sono", ["male", "male", "altro"], letto.slice(1).map((r) => r[0]));
  c("la frase dell'errore sta sulla riga che ha l'errore; la riga del prodotto senza errore propri ha la cella vuota", ["Variant Price «abc» non è un prezzo. Scrivi 19,90.", "", "Variant Price «xx» non è un prezzo."], letto.slice(1).map((r) => r[3]));
  c("la cella «=CMD()» e « =HYPERLINK» escono con l'apice davanti, e «-5» pure", ["'=CMD()", "' =HYPERLINK(\"x\")", "'-5"], [letto[1][1], letto[2][1], letto[2][2]]);
  c("la virgola e le virgolette dentro una cella si scrivono come da norma CSV", "Altro, con virgola", letto[3][1]);
  c("un errore del file intero (riga 1) o senza prodotto non aggiunge righe", 1, rileggi(E.righeDaCorreggere(record, [{ riga: 1, frase: "Nel file manca la colonna Handle." }, { riga: 0, frase: "x" }])).length);
  c("nessun errore: solo l'intestazione", 1, rileggi(E.righeDaCorreggere(record, [])).length);
  c("con il punto e virgola (Excel italiano) si rilegge uguale", [[";", true]], [(() => { const t = E.righeDaCorreggere(record, errori, ";"); const r = Lt.leggiCsv(utf8(t)); return [r.separatore, r.record[1][1] === "'=CMD()"]; })()]);
  c("il giro completo: si corregge e si ricarica il file scaricato (la colonna Errore è ignorata, nessun crollo)", [true], (() => { const r = P.leggiProdottiCsv(letto, { categorie: [] }); return [r.colonneIgnorate.includes("Errore") && r.conteggi.prodotti === 2]; })());
  c("celle con tab e CR al principio escono protette; un a capo dentro la cella resta tra virgolette", [true], (() => { const t = E.scriviCsv([["a"], ["\t=1"], ["x\ny"]]); const r = rileggi(t); return [r[1][0] === "'\t=1" && r[2][0] === "x\ny"]; })());

  // ── tempi: lineare, anche con 5000 righe e celle da 6000 ──
  const t0 = performance.now();
  const grande = Array.from({ length: 5000 }, (_x, i) => [`h${i}`, "T".repeat(300), "=x".repeat(5), "abc"]);
  const errGrandi = grande.map((_r, i) => ({ riga: i + 2, handle: `h${i}`, frase: "Errore lungo ".repeat(10), righeProdotto: [i + 2] }));
  const fuori = E.righeDaCorreggere([["Handle", "Title", "F", "P"], ...grande], errGrandi);
  const ms = performance.now() - t0;
  c("5000 righe respinte (circa 2 MB) in meno di un secondo", [true, true], [ms < 1000, fuori.length > 1_000_000]);
}
