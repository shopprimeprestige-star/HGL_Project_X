/** ── VETRINA V1 · T77 · LA RICERCA (D79) ───────────────────────────────────────
 *  `src/shop/cms/vetrina-ricerca.ts`: cerca nell'elenco LEGGERO per nome e per SKU, minimo 2 caratteri, tendina a 5, i 4 prodotti dello stato vuoto.
 *  Funzioni pure: lavorano solo sull'elenco che ricevono, quindi una bozza (che il server non manda mai) non può comparire.
 *  Dati inventati (`_dati-vetrina.mjs`, `dati.mjs`). Criterio: V1-C4 (nome e SKU, 4 prodotti senza risultati), V1-C3 (bozza mai in ricerca). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOGO, CATALOGO_SENZA_FOTO, SCENARIO_50 } from "./_dati-vetrina.mjs";
import { tabelleProva } from "./dati.mjs";

export async function prove(mod, { c, gruppo, radice }) {
  const R = mod["shop/cms/vetrina-ricerca"];
  const PUB = mod["shop/cms/pubblico"];
  gruppo("VETRINA V1 · T77 · RICERCA (23/11/2026)");

  /** L'elenco leggero come lo darà T76: nome e SKU delle varianti (il resto non serve alla ricerca). */
  const leggero = (p) => ({ slug: p.slug, nome: p.nome, skuVarianti: p.varianti.map((v) => v.sku) });
  const ELENCO = Object.freeze(CATALOGO.map((p) => Object.freeze(leggero(p))));
  const cerca = (q, elenco = ELENCO) => R.cercaNeiLeggeri(elenco, q).map((x) => x.slug);

  // ── per nome ──
  c("per nome: «alfa» trova la patch Alfa", ["patch-prova-alfa"], cerca("alfa"));
  c("maiuscole indifferenti", ["patch-prova-alfa"], cerca("ALFA"));
  c("gli accenti non contano («pàtch alfa»)", ["patch-prova-alfa"], cerca("pàtch alfa"));
  c("pezzi di parola: «shamp» trova lo shampoo", ["shampoo-prova"], cerca("shamp"));
  c("più parole: tutte devono esserci, in qualunque ordine («alfa patch»)", ["patch-prova-alfa"], cerca("alfa patch"));
  c("più parole che non stanno insieme → niente («alfa beta»)", [], cerca("alfa beta"));
  c("spazi in più e agli estremi non contano", ["patch-prova-alfa"], cerca("   patch    alfa  "));
  c("il nome di Invisible Derm si trova (compare, senza prezzo: lo decide la scheda)", ["invisible-derm-prova"], cerca("invisible"));
  c("un nome che non c'è → niente, senza errore", [], cerca("zzzz"));
  c("i simboli delle espressioni regolari valgono come testo, non lanciano", [[], [], []], [cerca("(*["), cerca("pat.*"), cerca("\\")]);

  // ── per SKU ──
  c("per SKU: lo SKU intero di una variante trova il suo prodotto", ["patch-prova-beta"], cerca("PAT-BETA-03"));
  c("per SKU, minuscolo", ["patch-prova-beta"], cerca("pat-beta-03"));
  c("per SKU, un pezzo («cur-shampoo»)", ["shampoo-prova"], cerca("cur-shampoo"));
  c("per SKU con tutte le varianti: ognuna porta allo stesso prodotto", [true, true, true], ["PAT-GAMMA-01", "PAT-GAMMA-04", "PAT-GAMMA-08"].map((s) => JSON.stringify(cerca(s)) === JSON.stringify(["patch-prova-gamma"])));
  c("un SKU senza lo stesso nome nel titolo (kit-prova-01) trova il kit", ["kit-prova"], cerca("KIT-PROVA-01"));
  c("nome e SKU insieme nello stesso prodotto: un prodotto compare una volta sola", ["patch-prova-alfa"], cerca("alfa"));
  c("un SKU vale solo se è di una variante di quel prodotto (un altro SKU → niente)", [], cerca("PAT-ALFA-99"));

  // ── minimo 2 caratteri ──
  c("vuoto, spazi, un solo carattere → nessun risultato", [[], [], [], []], ["", "   ", "a", "  a  "].map((q) => cerca(q)));
  c("due caratteri bastano («ba» → balsamo)", ["balsamo-prova"], cerca("ba"));
  c("il minimo è sul testo ripulito: «a   » vale un carattere", [], cerca("a   "));
  c("ingressi che non sono testo (null, undefined, numero, oggetto, lista) → nessun risultato, nessun errore", [[], [], [], [], []], [null, undefined, 42, {}, ["alfa"]].map((q) => cerca(q)));
  c("la soglia è 2", 2, R.MIN_CARATTERI_RICERCA);

  // ── ordine dei risultati ──
  const mix = Object.freeze([
    { slug: "colla", nome: "Colla patch", skuVarianti: ["C-1"] },
    { slug: "spray", nome: "Spray", skuVarianti: ["PATCH-1"] },
    { slug: "alfa", nome: "Patch alfa", skuVarianti: ["A-1"] },
    { slug: "beta", nome: "Patch beta", skuVarianti: ["B-1"] },
  ]);
  c("prima chi inizia con il testo, poi chi lo contiene nel nome, poi chi lo ha solo nello SKU; a parità, l'ordine dell'elenco", ["alfa", "beta", "colla", "spray"], cerca("patch", mix));
  c("restituisce gli oggetti dell'elenco (le card), non copie", true, R.cercaNeiLeggeri(mix, "colla")[0] === mix[0]);
  c("non modifica l'elenco (congelato: se scrivesse, lancerebbe)", 4, mix.length);

  // ── tendina: 5 ──
  const tutti50 = R.cercaNeiLeggeri(SCENARIO_50.map(leggero), "prodotto");
  c("la pagina dei risultati li ha tutti (50)", 50, tutti50.length);
  c("TENDINA A 5: i primi cinque, nell'ordine", ["prodotto-prova-01", "prodotto-prova-02", "prodotto-prova-03", "prodotto-prova-04", "prodotto-prova-05"], R.suggerimenti(tutti50, 5).map((x) => x.slug));
  c("il numero di partenza è 5", 5, R.suggerimenti(tutti50).length);
  c("con meno di cinque risultati, quelli che ci sono; con nessuno, nessuno", [3, 0], [R.suggerimenti(tutti50.slice(0, 3)).length, R.suggerimenti([]).length]);
  c("un limite diverso vale (2), zero dà niente, un limite senza senso torna a 5", [2, 0, 5, 5, 5], [R.suggerimenti(tutti50, 2).length, R.suggerimenti(tutti50, 0).length, R.suggerimenti(tutti50, -3).length, R.suggerimenti(tutti50, NaN).length, R.suggerimenti(tutti50, 2.5).length]);
  c("la costante dice 5", 5, R.MAX_SUGGERIMENTI);
  c("non modifica i risultati", 50, tutti50.length);

  // ── i 4 prodotti dello stato vuoto ──
  const slugsDi = (lista) => lista.map((p) => p.slug);
  c("QUATTRO: patch acquistabili, in ordine alfabetico di nome, senza chi è tutto esaurito (epsilon), senza kit e Invisible Derm",
    ["patch-prova-alfa", "patch-prova-beta", "patch-prova-delta", "patch-prova-gamma"], slugsDi(R.quattroDallaVetrina(CATALOGO)));
  c("quattro e non di più (25 patch, si prendono le prime 4 per nome)", ["prodotto-prova-01", "prodotto-prova-03", "prodotto-prova-05", "prodotto-prova-07"], slugsDi(R.quattroDallaVetrina(SCENARIO_50)));
  c("l'ordine in ingresso non conta", slugsDi(R.quattroDallaVetrina(CATALOGO)), slugsDi(R.quattroDallaVetrina([...CATALOGO].reverse())));
  c("se le patch sono meno di quattro, quelle che ci sono", ["patch-prova-alfa", "patch-prova-beta"], slugsDi(R.quattroDallaVetrina(CATALOGO.filter((p) => ["patch-prova-beta", "patch-prova-alfa", "shampoo-prova"].includes(p.slug)))));
  c("nessuna patch → niente (la pagina mostra solo il messaggio)", [[], []], [R.quattroDallaVetrina(CATALOGO.filter((p) => p.tipo !== "patch")), R.quattroDallaVetrina([])]);
  const idPatch = { ...structuredClone(CATALOGO.find((p) => p.slug === "invisible-derm-prova")), tipo: "patch" };
  c("un prodotto non acquistabile (Invisible Derm) non entra nemmeno se è di tipo patch", false, slugsDi(R.quattroDallaVetrina([idPatch, ...CATALOGO])).includes("invisible-derm-prova"));
  const alfaP = CATALOGO.find((p) => p.slug === "patch-prova-alfa");
  c("NON ACQUISTABILE ma con una variante disponibile → fuori (il flag conta da solo)", [], slugsDi(R.quattroDallaVetrina([{ ...alfaP, acquistabile: false }])));
  c("senza foto principale → fuori (come la vetrina della home)", [[], []], [slugsDi(R.quattroDallaVetrina(CATALOGO_SENZA_FOTO)), slugsDi(R.quattroDallaVetrina([{ ...alfaP, media: alfaP.media.filter((m) => m.slot !== "principale") }]))]);
  c("una foto principale senza le misure (src nullo) non vale", [], slugsDi(R.quattroDallaVetrina([{ ...alfaP, media: alfaP.media.map((m) => ({ ...m, src: null })) }])));
  const nomi = (...n) => n.map((nome, i) => ({ ...alfaP, nome, slug: `p-${n.length - i}` }));
  c("STESSO ORDINE DELLA HOME: i numeri come numeri («Patch 2» prima di «Patch 10»), maiuscole e accenti non contano", ["Patch 2", "Patch 10", "Zeta"], R.quattroDallaVetrina(nomi("Zeta", "Patch 10", "Patch 2")).map((p) => p.nome));
  c("a parità di nome decide lo slug", ["p-1", "p-2", "p-3"], R.quattroDallaVetrina(nomi("Uguale", "Uguale", "Uguale")).map((p) => p.slug));
  c("restituisce i prodotti dell'elenco, non copie", true, R.quattroDallaVetrina(CATALOGO)[0] === CATALOGO.find((p) => p.slug === "patch-prova-alfa"));
  c("il numero è 4", 4, R.QUANTI_NELLO_STATO_VUOTO);

  // ── la bozza non c'è mai ──
  // I dati veri passano da `costruisciPubblico`, che non fa uscire una bozza: la ricerca lavora solo su quello che le arriva.
  const t = tabelleProva();
  const righe = { prodotti: t.shop_prodotti, varianti: t.shop_varianti, media: t.shop_media, categorie: t.shop_categorie, prodottiCategorie: t.shop_prodotti_categorie };
  const pubblici = PUB.costruisciPubblico(righe);
  c("(controllo dei dati) il database di prova ha una bozza, ma il pubblico no", [2, ["prodotto-di-prova"]], [t.shop_prodotti.length, pubblici.map((p) => p.slug)]);
  const veri = pubblici.map(leggero);
  c("BOZZA MAI PRESENTE: né per nome, né per SKU, né a pezzi", [[], [], [], []], ["Prodotto in bozza", "bozza", "PROVA-002", "prodotto-in-bozza"].map((q) => cerca(q, veri)));
  c("…mentre il prodotto pubblicato si trova per nome e per SKU", [["prodotto-di-prova"], ["prodotto-di-prova"]], [cerca("Prodotto di prova", veri), cerca("PROVA-001", veri)]);
  c("nessun risultato è mai un prodotto che non era nell'elenco", true, ["a", "al", "prova", "pat", "cur", "kit", "derm", "00", "-"].every((q) => R.cercaNeiLeggeri(ELENCO, q).every((x) => ELENCO.includes(x))));

  // ── il sorgente ──
  const sorgente = readFileSync(join(radice, "src/shop/cms/vetrina-ricerca.ts"), "utf8");
  const senzaCommenti = sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c("il modulo è puro: niente window, document, fetch, Date, Math.random, console, storage, nessuna espressione regolare costruita dal testo", [],
    senzaCommenti.match(/\b(window|document|fetch|localStorage|sessionStorage|navigator|Date|console)\b|Math\.random|new RegExp/g) ?? []);
  c("importa solo tipi", [], (senzaCommenti.match(/^\s*import\s.*$/gm) ?? []).filter((r) => !/^\s*import type\b/.test(r)));
}
