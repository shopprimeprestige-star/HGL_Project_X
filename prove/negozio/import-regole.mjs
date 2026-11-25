/** ── EDITOR PRODOTTI · E2b · LE REGOLE DELL'IMPORT ─────────────────────────
 *  `src/crm/negozio/import-regole.ts`: la funzione che gira uguale nel browser e nel server (`validaProdottoImport`), i prezzi da `centDaEuro`,
 *  i massimi numerici del PIANO §1.1, il confronto con il catalogo. Dati inventati. Anche i tipi di `import-contratto.ts`. */
import { build } from "esbuild";
import { join } from "node:path";

const carica = async (radice, file) => {
  const r = await build({ entryPoints: [join(radice, file)], bundle: true, format: "esm", write: false, alias: { "@": join(radice, "src") }, logLevel: "silent", platform: "neutral" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};

const variante = (o = {}) => ({ riga: 2, sku: "SIERO-1", nome: "Unica", opzioni: {}, prezzoCent: null, pesoG: null, gtin: null, costoCent: null, giacenza: 0, ...o });
const prodotto = (o = {}) => ({ handle: "siero", titolo: "Siero", tipo: "cura", categorie: [], sku: "SIERO-1", prezzoCent: 1990, varianti: [variante()], ...o });

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("EDITOR PRODOTTI · E2b · REGOLE DELL'IMPORT: STESSA FUNZIONE NEL BROWSER E NEL SERVER (25/11/2026)");
  const R = await carica(radice, "src/crm/negozio/import-regole.ts").catch((e) => ({ errore: String(e) }));
  c("import-regole.ts si compila e si carica", undefined, R.errore);
  if (R.errore) return;
  const V = (p, ctx) => R.validaProdottoImport(p, ctx);
  const frasi = (p, ctx) => V(p, ctx).errori.map((e) => e.frase);

  c("un prodotto buono: nessun errore, nessun avviso", [[], []], [V(prodotto()).errori, V(prodotto()).avvisi]);
  c("un prodotto buono con tutto compilato", [], V(prodotto({ marca: "M", descrizioneBreve: "Breve", descrizioneLunga: "Lunga", categoriaGoogle: "Salute", fornitore: "F", seoTitolo: "T", seoDescrizione: "D", pesoG: 250, gtin: "8000000000017", categorie: ["a"], prezzoCent: 1, varianti: [variante({ costoCent: 650, giacenza: 5, prezzoCent: 500, pesoG: 10 })] }), { categorie: [{ slug: "a" }] }).errori);

  // ── indirizzo, SKU, titolo, tipo ──
  c("handle non normalizzato (maiuscole, spazi, vuoto) → errore con la frase", [true, true, true], ["Siero A", "siero a", ""].map((h) => frasi(prodotto({ handle: h })).some((x) => /indirizzo \(Handle\)/.test(x))));
  c("SKU non valido: minuscolo, troppo corto, con spazi, troppo lungo", [true, true, true, true], ["siero-1", "A", "AB CD", "A".repeat(41)].map((s) => frasi(prodotto({ sku: s, varianti: [variante()] })).some((x) => /SKU .* non è valido/.test(x))));
  c("titolo vuoto, di 121 segni, con a capo, con emoji, con «sconto del», con «risparmi», con «prezzo barrato»", [true, true, true, true, true, true, true], [
    prodotto({ titolo: " " }), prodotto({ titolo: "x".repeat(121) }), prodotto({ titolo: "a\nb" }), prodotto({ titolo: "Bello 🔥" }),
    prodotto({ titolo: "Parrucca sconto del 20%" }), prodotto({ titolo: "Risparmi tanto" }), prodotto({ titolo: "Ora a prezzo barrato" }),
  ].map((p) => V(p).errori.length > 0));
  c("una cifra vicino a «Invisible Derm» nella descrizione è un errore", true, frasi(prodotto({ descrizioneLunga: "Invisible Derm costa 250" })).some((x) => /Invisible Derm/.test(x)));
  c("le parole da non usare sono un avviso e non fermano il prodotto", [0, 1], [V(prodotto({ descrizioneBreve: "Un prodotto premium" })).errori.length, V(prodotto({ descrizioneBreve: "Un prodotto premium" })).avvisi.length]);
  c("tipo che non è patch, cura o kit → errore", true, frasi(prodotto({ tipo: "altro" })).some((x) => /patch, cura o kit/.test(x)));

  // ── i massimi numerici (PIANO §1.1), uno per uno ──
  const un = (campo, valore) => frasi(prodotto({ [campo]: valore }));
  c("prezzo del prodotto: negativo, con decimali, oltre 2147483647 → errore; 2147483647 va bene", [true, true, true, 0], [-1, 1.5, 2147483648].map((x) => un("prezzoCent", x).length > 0).concat([un("prezzoCent", 2147483647).length]));
  const inV = (campo, valore) => frasi(prodotto({ varianti: [variante({ [campo]: valore })] }));
  c("prezzo della variante: oltre il massimo → errore; null e 0 vanno bene", [true, 0, 0], [inV("prezzoCent", 2147483648).length > 0, inV("prezzoCent", null).length, inV("prezzoCent", 0).length]);
  c("costo: oltre il massimo, negativo, con decimali → errore; il massimo va bene", [true, true, true, 0], [2147483648, -1, 0.5].map((x) => inV("costoCent", x).length > 0).concat([inV("costoCent", 2147483647).length]));
  c("peso (variante e prodotto): oltre 1.000.000 → errore; 1.000.000 va bene", [true, true, 0], [inV("pesoG", 1000001).length > 0, un("pesoG", 1000001).length > 0, inV("pesoG", 1000000).length]);
  c("giacenza: oltre 1.000.000, negativa, con decimali, «1e3» come testo → errore; 1.000.000 va bene", [true, true, true, true, 0], [1000001, -1, 1.5, "1e3"].map((x) => inV("giacenza", x).length > 0).concat([inV("giacenza", 1000000).length]));
  c("«99999999999» come giacenza o prezzo: errore a parole, non del database", [true, true], [/giacenza non è valida/.test(inV("giacenza", 99999999999)[0]), /prezzo della variante non è valido/.test(inV("prezzoCent", 99999999999)[0])]);
  const lungo = (campo, max) => [un(campo, "x".repeat(max)).length, un(campo, "x".repeat(max + 1)).length > 0];
  c("testi: marca 80, breve 300, lunga 5000, categoria Google 200, fornitore 200, SEO 300/500 — il massimo va bene, uno oltre no", [[0, true], [0, true], [0, true], [0, true], [0, true], [0, true], [0, true]], [lungo("marca", 80), lungo("descrizioneBreve", 300), lungo("descrizioneLunga", 5000), lungo("categoriaGoogle", 200), lungo("fornitore", 200), lungo("seoTitolo", 300), lungo("seoDescrizione", 500)]);
  c("GTIN oltre 20 segni → errore; 8/12/13/14 cifre senza avviso, 5 cifre con avviso", [true, 0, 1], [un("gtin", "1".repeat(21)).length > 0, V(prodotto({ gtin: "12345678" })).avvisi.length, V(prodotto({ gtin: "1234" })).avvisi.length]);
  c("SEO oltre 60/155 segni: avviso (come la scheda), non errore", [0, 2], [V(prodotto({ seoTitolo: "x".repeat(61), seoDescrizione: "y".repeat(156) })).errori.length, V(prodotto({ seoTitolo: "x".repeat(61), seoDescrizione: "y".repeat(156) })).avvisi.length]);
  c("nome della variante oltre 120, opzione oltre 40 segni → errore", [true, true], [inV("nome", "n".repeat(121)).length > 0, inV("opzioni", { Colore: "v".repeat(41) }).length > 0]);
  c("più di 3 opzioni su una variante → errore", true, inV("opzioni", { A: "1", B: "2", C: "3", D: "4" }).some((x) => /4 opzioni, il massimo è 3/.test(x)));

  // ── varianti ──
  const tante = (n) => Array.from({ length: n }, (_x, i) => variante({ riga: i + 2, sku: `S-${i}`, nome: `v${i}`, opzioni: { N: `v${i}` } }));
  c("50 varianti vanno, 51 no, nessuna no", [0, true, true], [frasi(prodotto({ varianti: tante(50) })).length, frasi(prodotto({ varianti: tante(51) })).some((x) => /51 varianti: il massimo è 50/.test(x)), frasi(prodotto({ varianti: [] })).some((x) => /nessuna variante/.test(x))]);
  const doppia = frasi(prodotto({ varianti: [variante({ riga: 2 }), variante({ riga: 3, sku: "SIERO-1" })] }));
  c("lo stesso SKU su due varianti dello stesso prodotto → errore con le due righe", [true], [doppia.some((x) => /SKU SIERO-1 è scritto due volte nel prodotto \(righe 2 e 3\)/.test(x))]);
  c("una frase per riga: gli errori portano la riga della variante", [3], [V(prodotto({ varianti: [variante({ riga: 2 }), variante({ riga: 3, sku: "DUE-1", giacenza: -1 })] })).errori[0].riga]);
  c("l'errore dello SKU del prodotto e della prima variante (lo stesso) si dice una volta sola", 1, V(prodotto({ sku: "x", varianti: [variante({ sku: "x" })] })).errori.filter((e) => /SKU/.test(e.frase)).length);

  // ── Invisible Derm, categorie, prezzo 0 ──
  c("Invisible Derm con un prezzo → errore; senza prezzo → nessun errore e nessun avviso «prezzo 0»", [true, 0, 0], [frasi(prodotto({ handle: "invisible-derm", titolo: "Invisible Derm" })).some((x) => /non ha prezzo nello shop/.test(x)), V(prodotto({ handle: "invisible-derm", titolo: "Invisible Derm", prezzoCent: 0 })).errori.length, V(prodotto({ handle: "invisible-derm", titolo: "Invisible Derm", prezzoCent: 0 })).avvisi.length]);
  c("prezzo 0: avviso «prezzo è 0»", true, V(prodotto({ prezzoCent: 0 })).avvisi.some((x) => /prezzo è 0/.test(x.frase)));
  c("categoria che non esiste (con il contesto del server) → errore; senza contesto no", [true, 0], [frasi(prodotto({ categorie: ["nuova"] }), { categorie: [{ slug: "a" }] }).some((x) => /«nuova» non esiste/.test(x)), frasi(prodotto({ categorie: ["nuova"] })).length]);
  c("più di 10 categorie → errore", true, frasi(prodotto({ categorie: Array.from({ length: 11 }, (_x, i) => `c${i}`) })).some((x) => /11 categorie/.test(x)));

  // ── il server riceve dati manomessi: non crolla e rifiuta ──
  c("input non valido (null, stringa, varianti non un elenco, opzioni un elenco) → errori, mai un'eccezione", [true, true, true, true], [null, "x", { ...prodotto(), varianti: "no" }, prodotto({ varianti: [variante({ opzioni: ["a"] })] })].map((p) => { try { return V(p).errori.length > 0; } catch { return false; } }));
  c("un campo «stato» o «id» nel prodotto non viene letto: il risultato non lo porta", [true], [!JSON.stringify(V({ ...prodotto(), stato: "pubblicato", id: "x" })).includes("pubblicato")]);
  c("caratteri di controllo nelle descrizioni → errore; a capo e tab nei testi lunghi sono ammessi", [true, 0], [frasi(prodotto({ descrizioneLunga: "a\u0000b" })).length > 0, frasi(prodotto({ descrizioneLunga: "riga1\nriga2\tx" })).length]);

  // ── prezzi: la lettura passa da centDaEuro ──
  const P = (t) => R.leggiPrezzo(t, "Variant Price");
  c("leggiPrezzo: «19,90», «19.9», «19», «€ 12», «0», vuoto", [1990, 1990, 1900, 1200, 0, null], ["19,90", "19.9", "19", "€ 12", "0", "  "].map((t) => P(t).cent));
  c("leggiPrezzo: «1.234,50» e «1,234.50» e «1.234» → «scrivi 1234,50» / «scrivi 1234»", [true, true, true], [/scrivi 1234,50\./.test(P("1.234,50").frase), /scrivi 1234,50\./.test(P("1,234.50").frase), /scrivi 1234\./.test(P("1.234").frase)]);
  c("leggiPrezzo: «abc», «-3», «1e3», «19,999», «5 euro» → non è un prezzo", [false, false, false, false, false], ["abc", "-3", "1e3", "19,999", "5 euro"].map((t) => P(t).ok));

  // ── descrizione di un errore e SKU ──
  c("descriviErrore: «Riga 7 (handle `x`): …»", ["Riga 7 (handle `lace-front`): Variant Price «abc» non è un prezzo. Scrivi 19,90.", "File: ciao"], [R.descriviErrore({ riga: 7, handle: "lace-front", frase: "Variant Price «abc» non è un prezzo. Scrivi 19,90." }), R.descriviErrore({ riga: 0, frase: "ciao" })]);
  c("normalizzaSku: maiuscolo, gli spazi diventano trattini", ["ROSSO-S", "A-B-C"], [R.normalizzaSku(" rosso s "), R.normalizzaSku("a  b\tc")]);

  // ── il confronto con il catalogo (la verifica del server) ──
  const cat = { presenti: [{ id: "p1", slug: "gia-qui", nome: "Già qui", stato: "pubblicato" }], skuUsati: [{ sku: "ROSSO-S", prodottoId: "p2", prodottoNome: "Lace Front Swiss + PU", comeVariante: true }] };
  const confronto = R.confrontaConCatalogo([prodotto({ handle: "gia-qui" }), prodotto({ handle: "nuovo", sku: "NU-1", varianti: [variante({ sku: "NU-1" })] }), prodotto({ handle: "altro", sku: "AL-1", varianti: [variante({ riga: 5, sku: "AL-1" }), variante({ riga: 6, sku: "rosso-s" })] })], cat);
  c("già presente = saltato (non è un errore), con id e nome; il nuovo entra", [[{ handle: "gia-qui", prodottoId: "p1", nome: "Già qui" }], ["nuovo"]], [confronto.giaPresenti, confronto.nuovi.map((x) => x.handle)]);
  c("SKU di un altro prodotto → errore sulla riga della variante, col nome del prodotto; quel prodotto non entra", [[6], true], [confronto.errori.map((e) => e.riga), /^Lo SKU ROSSO-S è già usato dal prodotto «Lace Front Swiss \+ PU»\./.test(confronto.errori[0].frase)]);
  c("lo stesso file due volte: tutti «già presenti», nessun nuovo", [0, 2], (() => { const r = R.confrontaConCatalogo([prodotto({ handle: "a" }), prodotto({ handle: "b" })], { presenti: [{ id: "1", slug: "a", nome: "A", stato: "bozza" }, { id: "2", slug: "b", nome: "B", stato: "bozza" }], skuUsati: [] }); return [r.nuovi.length, r.giaPresenti.length]; })());
}
