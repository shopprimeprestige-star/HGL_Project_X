/** ── EDITOR PRODOTTI · E2b · DALLE RIGHE DEL CSV AI PRODOTTI ───────────────
 *  `src/crm/negozio/csv-prodotti.ts` (+ `csv-colonne.ts`): raggruppamento per Handle, normalizzazione, errori riga per riga con il numero di
 *  riga di Excel, avvisi, e il file ostile (intestazioni `__proto__`, celle da 6000 segni, virgoletta spaiata). Dati inventati. */
import { build } from "esbuild";
import { join } from "node:path";

const carica = async (radice, file) => {
  const r = await build({ entryPoints: [join(radice, file)], bundle: true, format: "esm", write: false, alias: { "@": join(radice, "src") }, logLevel: "silent", platform: "neutral" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};

const INT = ["Handle", "Title", "Body (HTML)", "Short Description", "Vendor", "Type", "Categories", "Option1 Name", "Option1 Value", "Option2 Name", "Option2 Value", "Option3 Name", "Option3 Value", "Variant SKU", "Variant Price", "Variant Inventory Qty", "Variant Grams", "Variant Barcode", "Cost per item"];
/** Righe (oggetti con i nomi delle colonne) → record come li dà il lettore: la riga 1 è l'intestazione. */
const tab = (righe, intestazione = INT) => [intestazione, ...righe.map((r) => intestazione.map((h) => r[h] ?? ""))];
const CAT = [{ id: "c1", slug: "cura-capelli", nome: "Cura capelli" }, { id: "c2", slug: "patch", nome: "Patch" }];

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("EDITOR PRODOTTI · E2b · CSV → PRODOTTI: RAGGRUPPAMENTO, ERRORI RIGA PER RIGA, AVVISI (25/11/2026)");
  const M = await carica(radice, "src/crm/negozio/csv-prodotti.ts").catch((e) => ({ errore: String(e) }));
  c("csv-prodotti.ts si compila e si carica", undefined, M.errore);
  if (M.errore) return;
  const K = await carica(radice, "src/crm/negozio/csv-colonne.ts");
  const L = (righe, intestazione) => M.leggiProdottiCsv(tab(righe, intestazione), { categorie: CAT });
  const riga = (e) => e.riga;

  // ── il caso semplice e quello con varianti ──
  const a = L([{ Handle: "siero-uno", Title: "Siero uno", "Body (HTML)": "<p>Un <b>siero</b>.</p><script>alert(1)</script>", "Short Description": "Breve", Vendor: "Marca", Type: "cura", Categories: "Cura capelli|Patch", "Variant SKU": "siero-1", "Variant Price": "19,90", "Variant Inventory Qty": "7", "Variant Grams": "250", "Variant Barcode": "8000000000017", "Cost per item": "6,5" }]);
  const p = a.prodotti[0];
  c("un prodotto semplice: nessun errore, nessun avviso", [1, 0, 0], [a.prodotti.length, a.errori.length, a.avvisi.length]);
  c("campi: handle, titolo, tipo, marca, breve, categorie (slug esistenti), SKU in maiuscolo", ["siero-uno", "Siero uno", "cura", "Marca", "Breve", ["cura-capelli", "patch"], "SIERO-1"], [p.handle, p.titolo, p.tipo, p.marca, p.descrizioneBreve, p.categorie, p.sku]);
  c("Body (HTML) diventa testo semplice: niente etichette, niente script", "Un siero.", p.descrizioneLunga);
  c("prezzo in centesimi (19,90 → 1990), peso e barcode sul prodotto con UNA variante", [1990, 250, "8000000000017"], [p.prezzoCent, p.pesoG, p.gtin]);
  c("la variante Unica: stesso SKU, prezzo/peso/barcode vuoti (valgono quelli del prodotto), costo e giacenza sue", ["Unica", "SIERO-1", null, null, null, 650, 7, {}], [p.varianti[0].nome, p.varianti[0].sku, p.varianti[0].prezzoCent, p.varianti[0].pesoG, p.varianti[0].gtin, p.varianti[0].costoCent, p.varianti[0].giacenza, p.varianti[0].opzioni]);
  c("conteggi: 1 riga, 1 prodotto, 1 variante, 1 importabile", [1, 1, 1, 1, 0], [a.conteggi.righe, a.conteggi.prodotti, a.conteggi.varianti, a.conteggi.importabili, a.conteggi.conErrori]);

  const v = L([
    { Handle: "parrucca", Title: "Parrucca", Type: "patch", "Option1 Name": "Colore", "Option1 Value": "Nero", "Option2 Name": "Lunghezza", "Option2 Value": "20 cm", "Variant SKU": "PA-NE-20", "Variant Price": "199", "Variant Grams": "120", "Variant Barcode": "8000000000024" },
    { Handle: "parrucca", "Option1 Value": "Nero", "Option2 Value": "30 cm", "Variant SKU": "PA-NE-30", "Variant Price": "229,00", "Variant Grams": "140" },
    { Handle: "parrucca", "Option1 Value": "Castano", "Option2 Value": "20 cm", "Variant SKU": "PA-CA-20", "Variant Price": "199,00", "Variant Grams": "120" },
    { Handle: "parrucca", "Image Src": "x" },
  ]);
  const q = v.prodotti[0];
  c("più righe con lo stesso handle: un prodotto, 3 varianti (la riga con la sola foto non è una variante)", [1, 3], [v.prodotti.length, q.varianti.length]);
  c("il nome della variante è «Nero / 20 cm» e le opzioni hanno i nomi della prima riga", ["Nero / 20 cm", { Colore: "Nero", Lunghezza: "20 cm" }, "Castano / 20 cm"], [q.varianti[0].nome, q.varianti[0].opzioni, q.varianti[2].nome]);
  c("il prodotto prende prezzo, SKU e peso dalla prima variante; la prima vale «prezzo del prodotto»", [19900, "PA-NE-20", 120, null], [q.prezzoCent, q.sku, q.pesoG, q.varianti[0].prezzoCent]);
  c("una variante con lo stesso prezzo del prodotto resta vuota, una con prezzo diverso lo tiene", [22900, null], [q.varianti[1].prezzoCent, q.varianti[2].prezzoCent]);
  c("peso della variante: tenuto se diverso dal prodotto, vuoto se uguale", [140, null], [q.varianti[1].pesoG, q.varianti[2].pesoG]);
  c("con più varianti il barcode resta sulle varianti, mai sul prodotto", [undefined, "8000000000024"], [q.gtin, q.varianti[0].gtin]);

  // ── «Title» / «Default Title» di Shopify, SKU mancante, tipo ──
  const d = L([{ Handle: "olio", Title: "Olio", "Option1 Name": "Title", "Option1 Value": "Default Title", "Variant SKU": "OLIO", "Variant Price": "5" }]);
  c("«Title / Default Title» (come esporta Shopify) = nessuna opzione", [[], "Unica"], [d.prodotti[0] && Object.keys(d.prodotti[0].varianti[0].opzioni), d.prodotti[0]?.varianti[0].nome]);
  const s = L([{ Handle: "olio-nuovo", Title: "Olio nuovo", "Variant Price": "5" }]);
  c("SKU mancante su un prodotto semplice: l'handle in maiuscolo, con avviso", ["OLIO-NUOVO", "OLIO-NUOVO", true], [s.prodotti[0].sku, s.prodotti[0].varianti[0].sku, s.avvisi.some((x) => /propongo OLIO-NUOVO/.test(x.frase))]);
  const so = L([
    { Handle: "tinta", Title: "Tinta", "Option1 Name": "Colore", "Option1 Value": "Nero", "Variant SKU": "TI", "Variant Price": "5" },
    { Handle: "tinta", "Option1 Value": "Biondo", "Variant Price": "5" },
    { Handle: "tinta", "Option1 Value": "Biondo scuro", "Variant Price": "5" },
  ]);
  c("SKU mancante sulle varianti: «<SKU prodotto>-<sigla>», con numero se due uguali", ["TI", "TI-BI", "TI-BI-2"], so.prodotti[0].varianti.map((x) => x.sku));
  c("…e un avviso per ciascuno", 2, so.avvisi.filter((x) => /Manca lo SKU/.test(x.frase)).length);
  const t = L([{ Handle: "x1", Title: "X", Type: "Parrucca", "Variant SKU": "X1", "Variant Price": "1" }, { Handle: "x2", Title: "Y", "Variant SKU": "X2", "Variant Price": "1" }]);
  c("Type sconosciuto o mancante → «cura» con avviso (non è un errore)", [["cura", "cura"], 2, 0], [t.prodotti.map((x) => x.tipo), t.avvisi.filter((x) => /cura/.test(x.frase)).length, t.errori.length]);

  // ── i prezzi: sempre da centDaEuro ──
  const pr = (testo) => L([{ Handle: "pr", Title: "Pr", "Variant SKU": "PR", "Variant Price": testo }]);
  c("19,90 e 19.90 e «€ 19,9» e 19 → centesimi giusti", [1990, 1990, 1990, 1900], ["19,90", "19.90", "19,9 €", "19"].map((x) => pr(x).prodotti[0]?.prezzoCent));
  c("«abc» non è un prezzo: «Scrivi 19,90.» alla riga 2", [2, true, 0], [pr("abc").errori[0].riga, /Variant Price «abc» non è un prezzo\. Scrivi 19,90\./.test(pr("abc").errori[0].frase), pr("abc").prodotti.length]);
  c("«1.234,50» → errore «scrivi 1234,50»", true, /scrivi 1234,50/.test(pr("1.234,50").errori[0].frase));
  c("«1,234.50» → errore «scrivi 1234,50»", true, /scrivi 1234,50/.test(pr("1,234.50").errori[0].frase));
  c("negativo, 3 decimali, «1e3» → errori a parole", [true, true, true], ["-5", "1,999", "1e3"].map((x) => pr(x).errori.length === 1 && pr(x).prodotti.length === 0));
  c("un prezzo oltre il massimo di Postgres → «troppo alto»", true, /troppo alto/.test(pr("99999999999").errori[0].frase));
  c("prezzo mancante o 0: entra con prezzo 0 e un avviso", [0, true, 0, true], [pr("").prodotti[0].prezzoCent, pr("").avvisi.some((x) => /prezzo è 0/.test(x.frase)), pr("0").prodotti[0].prezzoCent, pr("0").avvisi.filter((x) => /prezzo è 0/.test(x.frase)).length === 1]);

  // ── giacenza, peso, costo ──
  const gi = (g, extra = {}) => L([{ Handle: "gi", Title: "Gi", "Variant SKU": "GI", "Variant Price": "1", "Variant Inventory Qty": g, ...extra }]);
  c("giacenza «12» e vuota", [12, 0], [gi("12").prodotti[0].varianti[0].giacenza, gi("").prodotti[0].varianti[0].giacenza]);
  c("giacenza «1e3», «10,5», «-3», «99999999999» → errori a parole, il prodotto non entra", [[1, 0], [1, 0], [1, 0], [1, 0]], ["1e3", "10,5", "-3", "99999999999"].map((x) => [gi(x).errori.length, gi(x).prodotti.length]));
  c("giacenza e peso con il punto delle migliaia («1.000», «2.000», «1,000») → errore «scrivi 2000», mai 1 o 2", [true, true, true, true], [["1.000", "scrivi 1000"], ["2.000", "scrivi 2000"], ["1,000", "scrivi 1000"]].map(([t, f]) => gi(t).prodotti.length === 0 && gi(t).errori[0].frase.includes(f)).concat([gi("1", { "Variant Grams": "2.000" }).errori[0].frase.includes("scrivi 2000")]));
  c("giacenza «10.0», «10,00», «0,0» → 10, 10, 0", [10, 10, 0], ["10.0", "10,00", "0,0"].map((t) => gi(t).prodotti[0].varianti[0].giacenza));
  c("giacenza «10,000» e «10.5» e «10,000,000» → errore", [0, 0, 0], ["10,000", "10.5", "10,000,000"].map((t) => gi(t).prodotti.length));
  c("peso oltre il massimo e peso con decimali → errore", [1, 1], [gi("1", { "Variant Grams": "2000000" }).errori.length, gi("1", { "Variant Grams": "12,5" }).errori.length]);
  c("costo «abc» → errore «Cost per item»", true, /Cost per item «abc»/.test(gi("1", { "Cost per item": "abc" }).errori[0].frase));

  // ── gli errori del criterio 6, riga per riga ──
  const grande = "a".repeat(6000);
  const f = L([
    /* 2 */ { Handle: "prezzo-abc", Title: "Prezzo abc", "Variant SKU": "PA1", "Variant Price": "abc" },
    /* 3 */ { Handle: "doppio-a", Title: "Doppio A", "Variant SKU": "DUP-1", "Variant Price": "10" },
    /* 4 */ { Handle: "doppio-b", Title: "Doppio B", "Variant SKU": "dup-1", "Variant Price": "10" },
    /* 5 */ { Handle: "quattro-opzioni", Title: "Quattro", "Option1 Name": "A", "Option1 Value": "1", "Option2 Name": "B", "Option2 Value": "2", "Option3 Name": "C", "Option3 Value": "3", "Option4 Name": "D", "Option4 Value": "4", "Variant SKU": "Q4", "Variant Price": "1" },
    /* 6 */ { Handle: "con-sconto", Title: "Parrucca sconto del 20%", "Variant SKU": "SC1", "Variant Price": "10" },
    /* 7 */ { Handle: "senza-titolo", Title: "", "Variant SKU": "ST1", "Variant Price": "10" },
    /* 8 */ { Handle: "Maiuscole E Spazi", Title: "Maiuscole", "Variant SKU": "ok 1", "Variant Price": "10" },
    /* 9 */ { Handle: "cella-lunga", Title: "Cella lunga", "Body (HTML)": grande, "Variant SKU": "CL1", "Variant Price": "10" },
    /* 10 */ { Handle: "cella-enorme", Title: "Cella enorme", "Body (HTML)": `${grande}b`, "Variant SKU": "CL2", "Variant Price": "10" },
    /* 11 */ { Handle: "buono", Title: "Buono", "Variant SKU": "BUONO", "Variant Price": "10" },
  ].map((r) => r), [...INT, "Option4 Name", "Option4 Value"]);
  const frase = (h) => f.errori.filter((e) => e.handle === h).map((e) => `${e.riga}: ${e.frase}`);
  c("riepilogo: 10 prodotti, 3 importabili (il primo dello SKU doppio, Maiuscole, Buono), 7 respinti", [10, 3, 7], [f.conteggi.prodotti, f.conteggi.importabili, f.conteggi.conErrori]);
  c("i prodotti che entrano sono quelli senza errori", ["doppio-a", "maiuscole-e-spazi", "buono"], f.prodotti.map((x) => x.handle));
  c("riga 2: «abc» non è un prezzo", [true, 2], [/«abc» non è un prezzo/.test(frase("prezzo-abc")[0]), f.errori.find((e) => e.handle === "prezzo-abc").riga]);
  c("SKU scritto due volte (anche in minuscolo): l'errore è del SECONDO, alla riga 4, con le righe 3 e 4", [[], true], [frase("doppio-a"), /^4: Lo SKU DUP-1 è scritto due volte nel file \(righe 3 e 4\)\./.test(frase("doppio-b")[0])]);
  c("riga 5: «Ci sono 4 opzioni, il massimo è 3.»", ["5: Ci sono 4 opzioni, il massimo è 3."], frase("quattro-opzioni"));
  c("riga 6: «sconto del» nel titolo, con la frase del progetto", [true], [/^6: Title: Non si scrive «sconto del»/.test(frase("con-sconto")[0])]);
  c("riga 7: manca il Title", [true], [/^7: Manca il Title/.test(frase("senza-titolo")[0])]);
  c("riga 8: handle con maiuscole e spazi → «maiuscole-e-spazi» (avviso), SKU «ok 1» → OK-1", ["maiuscole-e-spazi", "OK-1", true], [f.prodotti[1].handle, f.prodotti[1].sku, f.avvisi.some((x) => x.riga === 8 && /è diventato «maiuscole-e-spazi»/.test(x.frase))]);
  c("riga 9: Body da 6000 segni → errore con la lunghezza (il massimo è 5000)", [true], [/^9: Body \(HTML\) è lungo 6000 segni: il massimo è 5000\./.test(frase("cella-lunga")[0])]);
  c("riga 10: cella da 6001 segni → il tetto di 6000 per cella, col nome della colonna", [true], [/^10: La cella «Body \(HTML\)» ha 6001 segni: il massimo è 6000\./.test(frase("cella-enorme")[0])]);
  c("ogni errore porta le righe del suo prodotto (per «Scarica le righe da correggere»)", [[9]], f.errori.filter((e) => e.handle === "cella-lunga").map((e) => e.righeProdotto).slice(0, 1));
  c("nessun errore sulla riga 11 e 8", [], f.errori.filter((e) => e.riga === 11 || e.riga === 8));
  c("gli errori sono ordinati per riga", true, f.errori.every((e, i, tutti) => i === 0 || tutti[i - 1].riga <= e.riga));

  // ── un prodotto sbagliato non trascina gli altri; con una riga in errore non entra nemmeno la sua variante buona ──
  const m = L([
    { Handle: "mezzo", Title: "Mezzo", "Option1 Name": "Colore", "Option1 Value": "Nero", "Variant SKU": "MZ-1", "Variant Price": "5" },
    { Handle: "mezzo", "Option1 Value": "Rosso", "Variant SKU": "MZ-2", "Variant Price": "xx" },
    { Handle: "intero", Title: "Intero", "Variant SKU": "INT", "Variant Price": "5" },
  ]);
  c("una variante con errore: il prodotto intero non entra, l'altro sì", [["intero"], [3], 1], [m.prodotti.map((x) => x.handle), m.errori.map(riga), m.respinti.length]);
  c("la riga 1 è l'intestazione: le righe di dati partono dalla 2", 3, m.errori[0].righeProdotto.at(-1));

  // ── righe sparse, righe vuote, file senza prodotti ──
  const sp = L([
    { Handle: "uno", Title: "Uno", "Option1 Name": "Colore", "Option1 Value": "A", "Variant SKU": "U-A", "Variant Price": "1" },
    { Handle: "due", Title: "Due", "Variant SKU": "D", "Variant Price": "1" },
    { Handle: "uno", "Option1 Value": "B", "Variant SKU": "U-B", "Variant Price": "1" },
  ]);
  c("righe dello stesso handle sparse: un solo prodotto con 2 varianti, e l'avviso «non sono vicine»", [2, 1, true], [sp.prodotti.find((x) => x.handle === "uno").varianti.length, sp.prodotti.filter((x) => x.handle === "uno").length, sp.avvisi.some((x) => /non sono vicine/.test(x.frase))]);
  const conVuota = M.leggiProdottiCsv([INT, INT.map(() => ""), INT.map((h) => ({ Handle: "k", Title: "K", "Variant Price": "zz", "Variant SKU": "K1" })[h] ?? "")], { categorie: [] });
  c("una riga vuota in mezzo è ignorata, ma il numero di riga resta quello di Excel (la 3)", [3, 1], [conVuota.errori[0].riga, conVuota.conteggi.righe]);
  const z = (r) => [r.prodotti.length, r.errori.length, r.errori[0]?.frase];
  c("intestazione e zero righe → «Il file non contiene prodotti»", [0, 1, true], [z(M.leggiProdottiCsv([INT], { categorie: [] }))[0], z(M.leggiProdottiCsv([INT], { categorie: [] }))[1], /non contiene prodotti/.test(M.leggiProdottiCsv([INT], { categorie: [] }).errori[0].frase)]);
  c("intestazione e solo righe vuote → lo stesso", true, /non contiene prodotti/.test(M.leggiProdottiCsv([INT, [""], [""]], { categorie: [] }).errori[0].frase));
  c("record del tutto vuoto → lo stesso", true, /non contiene prodotti/.test(M.leggiProdottiCsv([], { categorie: [] }).errori[0].frase));
  c("senza la colonna Handle o Title: «manca la colonna …», nessun prodotto", [true, 0], [/manca la colonna Handle/.test(M.leggiProdottiCsv([["Title", "Variant SKU"], ["a", "b"]], { categorie: [] }).errori[0].frase), M.leggiProdottiCsv([["Title"], ["a"]], { categorie: [] }).prodotti.length]);
  c("riga di continuazione senza handle né titolo → fa parte del prodotto prima", 2, L([{ Handle: "cc", Title: "Cc", "Option1 Name": "T", "Option1 Value": "a", "Variant SKU": "CC-A", "Variant Price": "1" }, { "Option1 Value": "b", "Variant SKU": "CC-B", "Variant Price": "1" }]).prodotti[0].varianti.length);
  c("celle con spazi, a capo e spazi duri nei prezzi e negli SKU → puliti", [1990, "AB-1"], (() => { const r = L([{ Handle: "sp", Title: "Sp", "Variant SKU": " ab 1\r\n", "Variant Price": " 19,90 \r\n" }]); return [r.prodotti[0]?.prezzoCent, r.prodotti[0]?.sku]; })());
  const rep = L([{ Handle: "rep", Title: "Rep", "Option1 Name": "T", "Option1 Value": "a", "Variant SKU": "R1", "Variant Price": "1" }, { Handle: "rep", "Option1 Value": "A", "Variant SKU": "R2", "Variant Price": "1" }]);
  c("due varianti con le stesse opzioni (anche in maiuscolo) → errore con la riga della prima", true, /già alla riga 2/.test(rep.errori[0]?.frase ?? ""));
  c("due opzioni con lo stesso nome (anche in maiuscolo) → errore a parole", true, L([{ Handle: "dn", Title: "Dn", "Option1 Name": "Colore", "Option1 Value": "a", "Option2 Name": "colore", "Option2 Value": "b", "Variant SKU": "DN1", "Variant Price": "1" }]).errori.some((e) => /«colore» è scritta due volte/.test(e.frase)));
  c("più varianti ma una senza opzioni → errore a parole", true, L([{ Handle: "no", Title: "No", "Variant SKU": "N1", "Variant Price": "1" }, { Handle: "no", "Variant SKU": "N2", "Variant Price": "1" }]).errori.some((e) => /non ha opzioni/.test(e.frase)));
  c("più di 50 varianti → errore con il numero", true, L(Array.from({ length: 51 }, (_x, i) => ({ Handle: "tante", Title: "Tante", "Option1 Name": "Nn", "Option1 Value": `v${i}`, "Variant SKU": `T-${i}`, "Variant Price": "1" }))).errori.some((e) => /51 varianti: il massimo è 50/.test(e.frase)));
  const tanti = M.leggiProdottiCsv(tab(Array.from({ length: 301 }, (_x, i) => ({ Handle: `p${i}`, Title: `P${i}`, "Variant SKU": `S${i}`, "Variant Price": "1" }))), { categorie: [] });
  c("oltre 300 prodotti → respinto con la frase, nessun prodotto", [0, true], [tanti.prodotti.length, /301 prodotti: il massimo è 300/.test(tanti.errori[0].frase)]);

  // ── cosa si ignora, con gli avvisi ──
  const ig = M.leggiProdottiCsv(tab(
    [{ Handle: "ig", Title: "Ig", "Variant SKU": "IG1", "Variant Price": "10", "Variant Compare At Price": "20", "Image Src": "https://esempio.invalid/a.jpg", Published: "TRUE", Status: "active", Tags: "x, y", "Variant Taxable": "TRUE" },
     { Handle: "ig", "Image Src": "https://esempio.invalid/b.jpg" },
     { Handle: "ig2", Title: "Ig2", "Variant SKU": "IG2", "Variant Price": "10", "Variant Compare At Price": "30" }],
    [...INT, "Variant Compare At Price", "Image Src", "Published", "Status", "Tags", "Variant Taxable", "Colonna mia"],
  ), { categorie: [] });
  c("Published=TRUE, prezzo barrato e foto: importa tutto, senza errori", [2, 0], [ig.prodotti.length, ig.errori.length]);
  c("…niente prezzo barrato, niente foto, niente stato nel risultato", [false, false, false, false], [JSON.stringify(ig.prodotti).includes("20"), "stato" in ig.prodotti[0], /barrat|compare|immagin|image/i.test(Object.keys(ig.prodotti[0]).join()), JSON.stringify(ig.prodotti).includes("esempio.invalid")]);
  c("…e gli avvisi che lo dicono (prezzo barrato su 2 prodotti, 2 immagini, tutto in bozza)", [true, true, true], [ig.avvisi.some((x) => /2 prodotti avevano un prezzo barrato: non è stato importato/.test(x.frase)), ig.avvisi.some((x) => /2 immagini non importate/.test(x.frase)), ig.avvisi.some((x) => /tutto entra in bozza/.test(x.frase))]);
  c("le colonne ignorate sono elencate una volta (anche quella sconosciuta)", ["Variant Compare At Price", "Image Src", "Published", "Status", "Tags", "Variant Taxable", "Colonna mia"], ig.colonneIgnorate);
  c("conteggi: 2 immagini ignorate, 2 prodotti con prezzo barrato", [2, 2], [ig.conteggi.immaginiIgnorate, ig.conteggi.prodottiConBarrato]);

  // ── categorie ──
  const cg = L([{ Handle: "cg", Title: "Cg", Categories: "cura-capelli|Inesistente|PATCH|patch", "Variant SKU": "CG", "Variant Price": "1" }]);
  c("categorie: per nome o slug (senza badare alle maiuscole), senza doppioni; quella che non esiste è un avviso", [["cura-capelli", "patch"], true, 0], [cg.prodotti[0].categorie, cg.avvisi.some((x) => /«Inesistente» non esiste: creala in Categorie/.test(x.frase)), cg.errori.length]);

  // ── Invisible Derm: il prezzo si scarta ──
  const iv = L([{ Handle: "invisible-derm", Title: "Invisible Derm", "Variant SKU": "ID1", "Variant Price": "299" }]);
  c("Invisible Derm: il prezzo del file è scartato (0) con un avviso, il prodotto entra", [0, null, true, 0], [iv.prodotti[0].prezzoCent, iv.prodotti[0].varianti[0].prezzoCent, iv.avvisi.some((x) => /Invisible Derm non ha prezzo/.test(x.frase)), iv.errori.length]);
  c("Invisible Derm senza prezzo: nessun avviso «prezzo 0»", false, L([{ Handle: "invisible-derm", Title: "Invisible Derm", "Variant SKU": "ID1" }]).avvisi.some((x) => /prezzo è 0/.test(x.frase)));
  c("una cifra vicino a «Invisible Derm» in un testo è un errore", true, L([{ Handle: "altro", Title: "Altro", "Short Description": "Con Invisible Derm a 299 euro", "Variant SKU": "AL", "Variant Price": "1" }]).errori.some((e) => /Invisible Derm/.test(e.frase)));
  c("parole da non usare = avviso, non errore", [0, true], (() => { const r = L([{ Handle: "pw", Title: "Pw", "Short Description": "Un prodotto premium", "Variant SKU": "PW", "Variant Price": "1" }]); return [r.errori.length, r.avvisi.some((x) => /premium/.test(x.frase))]; })());
  c("titolo con più di 120 segni, con emoji o con a capo → errore a parole", [true, true, true], [L([{ Handle: "l", Title: "x".repeat(121), "Variant SKU": "L", "Variant Price": "1" }]).errori[0]?.frase.includes("121 segni"), /emoji/.test(L([{ Handle: "e", Title: "Bello 😀", "Variant SKU": "E", "Variant Price": "1" }]).errori[0]?.frase ?? ""), L([{ Handle: "n", Title: "Bello\nbrutto", "Variant SKU": "N1", "Variant Price": "1" }]).prodotti[0]?.titolo === "Bello brutto"]);
  c("barcode con 5 cifre → avviso, non errore", [0, true], (() => { const r = L([{ Handle: "bc", Title: "Bc", "Variant SKU": "BC", "Variant Price": "1", "Variant Barcode": "12345" }]); return [r.errori.length, r.avvisi.some((x) => /8, 12, 13 o 14 cifre/.test(x.frase))]; })());

  // ── file ostile: intestazioni e handle con nomi del prototipo ──
  const ost = M.leggiProdottiCsv([["Handle", "Title", "__proto__", "constructor", "toString", "Variant SKU", "Variant Price", "Option1 Name", "Option1 Value"],
    ["constructor", "Uno", "x", "y", "z", "C1", "1", "__proto__", "valore"],
    ["__proto__", "Due", "x", "y", "z", "C2", "1", "", ""],
    ["constructor", "", "", "", "", "C3", "1", "", "altro"]], { categorie: [] });
  c("intestazioni «__proto__», «constructor», «toString»: ignorate e elencate, nessun crollo", [["__proto__", "constructor", "toString"], undefined, undefined], [ost.colonneIgnorate, ({}).polluted, Object.prototype.valore]);
  c("handle «constructor» e «__proto__»: gruppi veri, senza toccare il prototipo", [["constructor", "proto"], 2], [ost.prodotti.map((x) => x.handle), ost.prodotti.find((x) => x.handle === "constructor").varianti.length]);
  c("un'opzione chiamata «__proto__» resta un nome (chiave propria, prototipo intatto)", [true, "valore", true], [Object.hasOwn(ost.prodotti[0].varianti[0].opzioni, "__proto__"), JSON.parse(JSON.stringify(ost.prodotti[0].varianti[0].opzioni)).__proto__ ?? ost.prodotti[0].varianti[0].opzioni["__proto__"], Object.getPrototypeOf(ost.prodotti[0].varianti[0].opzioni) === Object.prototype]);
  c("la mappa delle colonne è una Map: «constructor» e «__proto__» non sono chiavi di niente", [true, false, false], [K.mappaColonne(["Handle", "constructor", "__proto__"]).indici instanceof Map, K.mappaColonne(["constructor"]).indici.has("constructor"), K.mappaColonne(["__proto__"]).indici.size > 0]);
  c("intestazioni scritte come capita: maiuscole, spazi, trattini, underscore", [0, 1], (() => { const m2 = K.mappaColonne(["HANDLE", "title", "variant_sku", "Variant-Price", " Body "]); return [m2.indici.get("handle"), m2.indici.get("titolo")]; })());
  c("colonne in qualsiasi ordine", ["ord", 150], (() => { const r = M.leggiProdottiCsv([["variant price", "Variant_SKU", "TITLE", "handle"], ["1,50", "o1", "Ord", "ord"]], { categorie: [] }); return [r.prodotti[0].handle, r.prodotti[0].prezzoCent]; })());
  c("intestazione scritta due volte: vale la prima, con avviso", [true, 100], (() => { const r = M.leggiProdottiCsv([["Handle", "Title", "Variant SKU", "Variant Price", "Variant Price"], ["d", "D", "D1", "1", "9"]], { categorie: [] }); return [r.avvisi.some((x) => /scritte due volte/.test(x.frase)), r.prodotti[0].prezzoCent]; })());

  // ── virgoletta spaiata: l'anteprima deve dire i conteggi ──
  const sg = M.leggiProdottiCsv([["Handle", "Title", "Variant SKU", "Variant Price"], ["a", "A", "A1", "1"], ["b", "B\nsecondo", "B1", "1"], ["c", "C", "C1", "1"]], { categorie: [] });
  c("a capo dentro un titolo: avviso con la riga e i conteggi (righe e prodotti letti)", [true], [sg.avvisi.some((x) => x.riga === 3 && /virgoletta spaiata/.test(x.frase) && /3 righe e 3 prodotti/.test(x.frase))]);
  c("un a capo nel Body (testo lungo) non fa nessun avviso", 0, L([{ Handle: "bd", Title: "Bd", "Body (HTML)": "riga1\nriga2", Type: "cura", "Variant SKU": "BD", "Variant Price": "1" }]).avvisi.length);

  // ── i sorgenti ──
  const { readFileSync } = await import("node:fs");
  const src = ["csv-prodotti", "csv-colonne", "import-regole", "csv-errori", "csv-modello"].map((n) => readFileSync(join(radice, `src/crm/negozio/${n}.ts`), "utf8")).join("\n").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  c("i sorgenti non usano parseFloat né import da pacchetti di CSV; usano centDaEuro", [false, false, true], [/parseFloat/.test(src), /from "(papaparse|csv-parse|d3-dsv|xlsx)/.test(src), /centDaEuro\(/.test(src)]);
  c("nessun oggetto-dizionario riempito con chiavi del file: niente `[nome]:` né `out[` su dati del file", false, /\bacc\[|\bdati\[/.test(src));
  c("il lettore non scrive e non apre niente: nessun fetch, nessun innerHTML, nessun DOMParser, nessun delete", false, /fetch\(|innerHTML|DOMParser|\bdelete\b/.test(src));
}
