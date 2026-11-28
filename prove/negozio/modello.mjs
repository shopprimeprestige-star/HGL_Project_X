/** ── NEGOZIO · T05 · IL MODELLO E I VALIDATORI ─────────────────────────────
 *  `src/shop/cms/modello.ts`: costanti (slot, limiti, tetti di lunghezza) e funzioni pure per slug, SKU,
 *  prezzi in centesimi, varianti generate dalle opzioni, caratteristiche. Nessun database, nessuna rete.
 *  Dati inventati. Le frasi di rifiuto sono in italiano: le legge il titolare, non un programmatore. */

export async function prove(mod, { c, gruppo }) {
  const M = mod["shop/cms/modello"];
  gruppo("NEGOZIO · IL MODELLO E I VALIDATORI (20/11/2026)");

  // ── costanti ──
  c("gli slot dei media (D30)", ["principale", "foto2", "foto3", "foto4", "foto5", "scala", "video", "confezione", "campione"], [...M.SLOT]);
  c("i sotto-ruoli delle foto", ["retro_base", "macro_attaccatura", "colore_luce", "altro"], [...M.SOTTO_RUOLI]);
  c("opzioni al massimo 3, combinazioni al massimo 250 (D25; 250 dal 28/11/2026 per i kit di Shopify)", [3, 250], [M.MAX_OPZIONI, M.MAX_COMBINAZIONI]);
  c("tetti di lunghezza: riga 90, breve 300, alt 125, SEO 60 e 155", { riga: 90, breve: 300, alt: 125, seoTitolo: 60, seoDescrizione: 155 }, { ...M.TETTI });

  // ── slug ──
  c("slugDa: «Lace Front Swiss + PU»", "lace-front-swiss-pu", M.slugDa("Lace Front Swiss + PU"));
  c("slugDa: accenti e segni via", "cura-piu-forte", M.slugDa("Cura & Più  Forte!"));
  c("slugDa: trattini e spazi ai bordi via", "gia", M.slugDa("  --Già--  "));
  c("slugDa: «ß» e «œ» non si inventano: restano fuori, senza rompere", "kit-2", M.slugDa("Kit ß 2"));
  c("slugDa: nome vuoto o di soli segni → vuoto", ["", "", ""], [M.slugDa(""), M.slugDa("%%% ???"), M.slugDa(null)]);
  const lungo = M.slugDa(`${"parola ".repeat(30)}fine`);
  c("slugDa: mai oltre 80 segni e non finisce con un trattino", [true, true], [lungo.length <= 80, !lungo.endsWith("-")]);
  const nomi = ["Lace Front Swiss + PU", "Cura & Più Forte!", "Kit 2 pezzi", "Patch Skin 0,03 mm", "  ÀÈÌÒÙ  ", "a/b/c"];
  c("slugDa: quello che esce è sempre un indirizzo valido", [], nomi.filter((n) => !M.slugValido(M.slugDa(n))));
  c("slugValido: sì", [true, true, true], ["lace-front", "kit-2", "a"].map(M.slugValido));
  c("slugValido: no (maiuscole, doppio trattino, bordi, spazi, accenti, vuoto, non testo)", Array(9).fill(false),
    ["Lace", "a--b", "-a", "a-", "a b", "perché", "", null, 42].map(M.slugValido));
  c("slugValido: 80 segni sì, 81 no", [true, false], ["a".repeat(80), "a".repeat(81)].map(M.slugValido));

  // ── SKU ──
  c("skuValido: sì", Array(7).fill(true), ["HG-T01", "PROVA-001-A", "AB", "A1", "PROVA.1", "HG_T01", "X".repeat(40)].map(M.skuValido));
  c("skuValido: no (minuscolo, spazi, vuoto, un solo segno, 41 segni, trattino davanti, non testo)", Array(9).fill(false),
    ["hg-t01", "HG T01", "", "A", "X".repeat(41), "-HG", " HG-T01", null, 7].map(M.skuValido));

  // ── prezzi: centesimi esatti, mai errori binari ──
  c("centDaEuro: 289 → 28900", 28900, M.centDaEuro(289));
  c("centDaEuro: 19.9 → 1990", 1990, M.centDaEuro(19.9));
  c("centDaEuro: 29.9 → 2990 (29.9*100 dà 2990.0000000000005)", 2990, M.centDaEuro(29.9));
  c("centDaEuro: il testo del campo, con virgola o punto, con l'euro", [1990, 1990, 1990, 28900, 0], ["19,90", "19.9", " 19,9 € ", "289", "0"].map(M.centDaEuro));
  c("centDaEuro: 0.1 + 0.2 è 30 centesimi", 30, M.centDaEuro(0.1 + 0.2));
  c("centDaEuro: il numero si può anche calcolare (19.9 * 3 → 5970)", 5970, M.centDaEuro(19.9 * 3));
  c("centDaEuro: frazioni di centesimo, negativi, testo, vuoti → null (mai un prezzo inventato)", Array(9).fill(null),
    ["1.005", 1.005, "-3", -3, "abc", "", NaN, Infinity, null].map(M.centDaEuro));
  c("centDaEuro: il tetto è l'integer di Postgres (2.147.483.647 centesimi): sopra → null", [2147483647, null, null, null],
    [M.centDaEuro("21474836,47"), M.centDaEuro("21474836,48"), M.centDaEuro(1e12), M.centDaEuro("99999999999999")]);
  c("MAX_CENT = 2147483647", 2147483647, M.MAX_CENT);
  c("euroDaCent: gli euro che vanno alle piattaforme", [289, 19.9, 28.9, 0, 0.05], [28900, 1990, 2890, 0, 5].map(M.euroDaCent));
  let sbagliati = 0;
  for (let k = 0; k <= 30000; k++) if (M.centDaEuro(M.euroDaCent(k)) !== k) sbagliati++;
  c("andata e ritorno su 30001 prezzi (0 – 300 €): nessun centesimo si perde", 0, sbagliati);

  // ── prezzo effettivo (D25) ──
  const prod = { prezzoCent: 2890 };
  c("prezzoEffettivo: variante senza prezzo → quello del prodotto", [2890, 2890], [M.prezzoEffettivo(prod, { prezzoCent: null }), M.prezzoEffettivo(prod, {})]);
  c("prezzoEffettivo: variante col suo prezzo → il suo", 1500, M.prezzoEffettivo(prod, { prezzoCent: 1500 }));
  c("prezzoEffettivo: uno zero scritto è uno zero (non si pubblica), non «vuoto»", 0, M.prezzoEffettivo(prod, { prezzoCent: 0 }));

  // ── varianti dalle opzioni ──
  const base = [{ nome: "Colore", valori: ["Nero", "Biondo"] }, { nome: "Lunghezza", valori: ["30", "40"] }];
  const g = M.combinazioni("HG-X", base);
  c("combinazioni: 2 × 2 → 4 varianti, la prima opzione gira più lenta", [true, ["Nero / 30", "Nero / 40", "Biondo / 30", "Biondo / 40"]], [g.ok, g.varianti?.map((v) => v.nome)]);
  c("combinazioni: SKU proposto = SKU del prodotto + 2 lettere per valore", ["HG-X-NE-30", "HG-X-NE-40", "HG-X-BI-30", "HG-X-BI-40"], g.varianti?.map((v) => v.sku));
  c("combinazioni: ogni variante porta le sue opzioni per nome", { Colore: "Biondo", Lunghezza: "40" }, g.varianti?.[3].opzioni);
  c("combinazioni: gli SKU proposti sono validi e diversi", [true, 4], [g.varianti?.every((v) => M.skuValido(v.sku)), new Set(g.varianti?.map((v) => v.sku)).size]);
  const tr = M.combinazioni("HG-X", [{ nome: "Colore", valori: [" Nero ", "Biondo"] }]);
  c("combinazioni: gli spazi attorno ai valori si tolgono", ["Nero", "Biondo"], tr.varianti?.map((v) => v.nome));
  const doppioPrefisso = M.combinazioni("HG-X", [{ nome: "Colore", valori: ["Biondo", "Biondo scuro", "Bianco"] }]);
  c("combinazioni: due valori che cominciano uguale non fanno lo stesso SKU", [true, 3], [doppioPrefisso.varianti?.every((v) => M.skuValido(v.sku)), new Set(doppioPrefisso.varianti?.map((v) => v.sku)).size]);
  const lunga = M.combinazioni("X".repeat(40), [{ nome: "Colore", valori: ["Nero", "Nocciola", "Nerissimo"] }]);
  c("combinazioni: con un SKU di 40 segni quelli proposti restano validi e diversi", [true, 3], [lunga.varianti?.every((v) => M.skuValido(v.sku)), new Set(lunga.varianti?.map((v) => v.sku)).size]);
  const senzaLettere = M.combinazioni("HG-X", [{ nome: "Misura", valori: ["—", "…"] }]);
  c("combinazioni: un valore senza lettere né cifre dà comunque uno SKU valido", [true, 2], [senzaLettere.varianti?.every((v) => M.skuValido(v.sku)), new Set(senzaLettere.varianti?.map((v) => v.sku)).size]);
  const cinquanta = M.combinazioni("HG-X", [{ nome: "Colore", valori: Array.from({ length: 10 }, (_, i) => `c${i}`) }, { nome: "Lunghezza", valori: Array.from({ length: 25 }, (_, i) => `l${i}`) }]);
  c("combinazioni: 250 è il massimo e passa", [true, 250, 250], [cinquanta.ok, cinquanta.varianti?.length, new Set(cinquanta.varianti?.map((v) => v.sku)).size]);
  const tre = M.combinazioni("HG-X", [{ nome: "A", valori: ["1", "2"] }, { nome: "B", valori: ["1", "2"] }, { nome: "C", valori: ["1", "2"] }]);
  c("combinazioni: 3 opzioni da 2 valori → 8 varianti", [true, 8], [tre.ok, tre.varianti?.length]);

  const v = (n) => Array.from({ length: n }, (_, i) => `v${i}`);
  const sessantaquattro = M.combinazioni("HG-X", [{ nome: "A", valori: v(7) }, { nome: "B", valori: v(7) }, { nome: "C", valori: v(7) }]);
  c("combinazioni: 3 opzioni da 7 valori (343) → rifiutate", [false, "troppe_combinazioni"], [sessantaquattro.ok, sessantaquattro.motivo]);
  c("…con la frase del limite: dice 343 e 250", [true, true], [/343/.test(sessantaquattro.frase), /\b250\b/.test(sessantaquattro.frase)]);
  const cinquantuno = M.combinazioni("HG-X", [{ nome: "A", valori: v(3) }, { nome: "B", valori: v(84) }]);
  c("combinazioni: 252 → rifiutate", [false, "troppe_combinazioni"], [cinquantuno.ok, cinquantuno.motivo]);
  const quattro = M.combinazioni("HG-X", ["A", "B", "C", "D"].map((nome) => ({ nome, valori: ["1", "2"] })));
  c("combinazioni: 4 opzioni → rifiutate, anche se le combinazioni sarebbero poche", [false, "troppe_opzioni", true], [quattro.ok, quattro.motivo, /\b3\b/.test(quattro.frase)]);
  const enorme = M.combinazioni("HG-X", ["A", "B", "C"].map((nome) => ({ nome, valori: v(2000) })));
  c("combinazioni: 8 miliardi di combinazioni: si rifiuta subito, senza costruirle", [false, "troppe_combinazioni"], [enorme.ok, enorme.motivo]);
  c("combinazioni: nessuna opzione", [false, "nessuna_opzione"], ((r) => [r.ok, r.motivo])(M.combinazioni("HG-X", [])));
  c("combinazioni: opzione senza nome", "opzione_senza_nome", M.combinazioni("HG-X", [{ nome: "  ", valori: ["1"] }]).motivo);
  c("combinazioni: opzione senza valori", "opzione_senza_valori", M.combinazioni("HG-X", [{ nome: "Colore", valori: [] }]).motivo);
  c("combinazioni: valore vuoto", "valore_vuoto", M.combinazioni("HG-X", [{ nome: "Colore", valori: ["Nero", " "] }]).motivo);
  c("combinazioni: valore ripetuto (anche in maiuscolo o con spazi)", "valore_doppio", M.combinazioni("HG-X", [{ nome: "Colore", valori: ["Nero", " nero "] }]).motivo);
  c("combinazioni: due opzioni con lo stesso nome", "opzione_doppia", M.combinazioni("HG-X", [{ nome: "Colore", valori: ["1"] }, { nome: "colore", valori: ["2"] }]).motivo);
  c("combinazioni: SKU del prodotto non valido", "sku_non_valido", M.combinazioni("hg x", base).motivo);
  c("combinazioni: ogni rifiuto ha la sua frase in italiano", [], [sessantaquattro, quattro, M.combinazioni("HG-X", []), M.combinazioni("HG-X", [{ nome: " ", valori: ["1"] }]), M.combinazioni("hg x", base)].filter((r) => !r.frase || r.frase.length < 15));
  c("combinazioni: nome o valori nulli o mancanti → rifiuto con la frase, mai un errore", ["opzione_senza_nome", "opzione_senza_nome", "opzione_senza_valori", "opzione_senza_valori", "valore_vuoto", "valore_vuoto", "nessuna_opzione", "nessuna_opzione"],
    [M.combinazioni("HG-X", [{ nome: null, valori: ["1"] }]), M.combinazioni("HG-X", [{ valori: ["1"] }]), M.combinazioni("HG-X", [{ nome: "Colore", valori: null }]), M.combinazioni("HG-X", [{ nome: "Colore" }]),
      M.combinazioni("HG-X", [{ nome: "Colore", valori: ["Nero", null] }]), M.combinazioni("HG-X", [{ nome: "Colore", valori: [7] }]), M.combinazioni("HG-X", null), M.combinazioni("HG-X", undefined)].map((r) => r.motivo));
  c("…e la riga dell'opzione nulla (null) nell'elenco non fa lanciare", "opzione_senza_nome", M.combinazioni("HG-X", [null]).motivo);
  const congelata = Object.freeze(base.map((o) => Object.freeze({ nome: o.nome, valori: Object.freeze([...o.valori]) })));
  c("combinazioni: non tocca quello che riceve", true, M.combinazioni("HG-X", congelata).ok);

  // ── caratteristiche ──
  const cr = (stato) => M.normalizzaCaratteristiche([{ etichetta: "Formato", valore: "100 ml", stato, fonte: "scheda" }])[0]?.stato;
  c("caratteristiche: «confermato» e «da_confermare» restano", ["confermato", "da_confermare"], [cr("confermato"), cr("da_confermare")]);
  c("caratteristiche: stato ignoto, mancante o storto → da_confermare (mai «confermato» per caso)", Array(6).fill("da_confermare"),
    ["boh", undefined, null, 123, "Confermato", " confermato"].map(cr));
  c("caratteristiche: non è un elenco → elenco vuoto", [[], [], [], []], [null, undefined, "x", { etichetta: "a", valore: "b" }].map((x) => M.normalizzaCaratteristiche(x)));
  c("caratteristiche: le righe senza etichetta o senza valore, o non oggetti, si scartano", [{ etichetta: "Ok", valore: "sì", stato: "da_confermare", fonte: null }],
    M.normalizzaCaratteristiche([null, "x", 3, { etichetta: "", valore: "a" }, { etichetta: "a", valore: "  " }, { etichetta: "a" }, { etichetta: "Ok", valore: "sì" }]));
  c("caratteristiche: gli spazi si tolgono, la fonte che non è testo diventa null", [{ etichetta: "Formato", valore: "100 ml", stato: "confermato", fonte: null }],
    M.normalizzaCaratteristiche([{ etichetta: " Formato ", valore: " 100 ml ", stato: "confermato", fonte: 7 }]));
  const orig = [{ etichetta: "A", valore: "b", stato: "boh" }];
  M.normalizzaCaratteristiche(orig);
  c("caratteristiche: non tocca quello che riceve", [{ etichetta: "A", valore: "b", stato: "boh" }], orig);
}
