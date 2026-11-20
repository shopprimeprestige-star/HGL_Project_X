/** ── NEGOZIO · T12 · L'ADATTATORE E IL CARRELLO ─────────────────────────────
 *  `src/shop/cms/adattatore.ts` (dal prodotto pubblico alla forma `Product` delle pagine di oggi, SKU, variante dalle
 *  opzioni) e `src/shop/cms/carrello.ts` (pulizia delle righe, totali in centesimi). Più il sorgente di `CartContext.tsx`
 *  (non gira in Node: si controlla che le righe vecchie non cambino). Dati inventati. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { mediaProva, prodottoProva, uuid, varianteProva } from "./dati.mjs";

export async function prove(mod, { c, gruppo, radice }) {
  const AD = mod["shop/cms/adattatore"];
  const CA = mod["shop/cms/carrello"];
  const PUB = mod["shop/cms/pubblico"];
  const M = mod["shop/cms/modello"];
  gruppo("NEGOZIO · L'ADATTATORE E IL CARRELLO (20/11/2026)");

  // un prodotto con due opzioni e tre varianti (una esaurita, una spenta) e uno semplice
  const righe = {
    prodotti: [
      prodottoProva({ id: uuid(0x200), sku: "PROVA-001", slug: "prodotto-di-prova", nome: "Prodotto di prova", descrizione_lunga: "Testo lungo.", prezzo_cent: 2890,
        caratteristiche: [{ etichetta: "Formato", valore: "100 ml", stato: "confermato", fonte: null }], contenuto: { passi: [], confezione: ["Un vasetto", "Un pettine"], avvertenze: [], faq: [] } }),
      prodottoProva({ id: uuid(0x201), sku: "PROVA-002", slug: "senza-opzioni", nome: "Senza opzioni", tipo: "kit" }),
    ],
    varianti: [
      varianteProva({ id: uuid(0x300), prodotto_id: uuid(0x200), sku: "PROVA-001-NE-30", nome: "Nero / 30", opzioni: { Colore: "Nero", Lunghezza: "30" }, giacenza: 7341, ordine: 1 }),
      varianteProva({ id: uuid(0x301), prodotto_id: uuid(0x200), sku: "PROVA-001-BI-30", nome: "Biondo / 30", opzioni: { Colore: "Biondo", Lunghezza: "30" }, prezzo_cent: 1500, giacenza: 0, ordine: 2 }),
      varianteProva({ id: uuid(0x302), prodotto_id: uuid(0x200), sku: "PROVA-001-RO-40", nome: "Rosso / 40", opzioni: { Colore: "Rosso", Lunghezza: "40" }, giacenza: 5, attiva: false, ordine: 3 }),
      varianteProva({ id: uuid(0x303), prodotto_id: uuid(0x201), sku: "PROVA-002-A", nome: "Unica", opzioni: {}, giacenza: 4 }),
    ],
    media: [mediaProva({ id: uuid(0x400), prodotto_id: uuid(0x200), slot: "principale" })],
  };
  const [P, S] = PUB.costruisciPubblico(righe, { baseMedia: "https://media.prova.test/shop" });

  // ── daPubblicoAProdotto ──
  const prod = AD.daPubblicoAProdotto(P);
  c("Product: stelle e recensioni a 0, nessun prezzo barrato, nessun badge", [0, 0, false, false], [prod.rating, prod.reviews, "compareAt" in prod, "badges" in prod]);
  c("Product: id = SKU, indirizzo, nome, prezzo «da» in euro", ["PROVA-001", "prodotto-di-prova", "Prodotto di prova", 15], [prod.id, prod.slug, prod.name, prod.price]);
  c("Product: testi, scheda tecnica dalle caratteristiche confermate, contenuto della confezione", ["Una descrizione breve inventata.", "Testo lungo.", [{ label: "Formato", value: "100 ml" }], ["Un vasetto", "Un pettine"]], [prod.short, prod.description, prod.specs, prod.bullets]);
  c("Product: `image` è la misura 960 della foto principale", "https://media.prova.test/shop/prova/aaaaaaaaaaaa-960.webp", prod.image);
  c("Product: senza foto principale la chiave `image` non c'è", false, "image" in AD.daPubblicoAProdotto({ ...P, media: [] }));
  c("Product: le varianti si ricavano dalle opzioni (solo valori delle varianti attive)", [{ label: "Colore", options: ["Nero", "Biondo"] }, { label: "Lunghezza", options: ["30"] }], prod.variants);
  c("Product: `stock` dice solo c'è / non c'è (mai la giacenza)", [1, 0, false], [prod.stock, AD.daPubblicoAProdotto({ ...P, varianti: P.varianti.map((v) => ({ ...v, disponibile: false })) }).stock, /7341/.test(JSON.stringify(prod))]);
  c("Product: la categoria è una delle nove di oggi (quella del CMS se coincide, se no quella del tipo)", ["accessori", "kit", "shampoo", "toupee"],
    [prod.category, AD.daPubblicoAProdotto(S).category, AD.daPubblicoAProdotto({ ...P, categorie: [{ slug: "boh", nome: "B" }, { slug: "shampoo", nome: "S" }] }).category, AD.daPubblicoAProdotto({ ...P, tipo: "patch" }).category]);
  const prima = JSON.stringify(P); AD.daPubblicoAProdotto(P);
  c("l'adattatore non cambia il prodotto che riceve", prima, JSON.stringify(P));

  // ── varianteDaOpzioni ──
  c("variante dalle opzioni: stesse chiavi e valori, in qualunque ordine", ["PROVA-001-NE-30", "PROVA-001-NE-30", "PROVA-001-BI-30"],
    [AD.varianteDaOpzioni(P, { Colore: "Nero", Lunghezza: "30" }), AD.varianteDaOpzioni(P, { Lunghezza: "30", Colore: "Nero" }), AD.varianteDaOpzioni(P, { Colore: "Biondo", Lunghezza: "30" })]);
  c("variante dalle opzioni: scelta incompleta, con una chiave in più, valore che non c'è, variante spenta, vuota → null", Array(6).fill(null),
    [{ Colore: "Nero" }, { Colore: "Nero", Lunghezza: "30", Misura: "M" }, { Colore: "Verde", Lunghezza: "30" }, { Colore: "Rosso", Lunghezza: "40" }, {}, undefined].map((o) => AD.varianteDaOpzioni(P, o)));
  c("prodotto senza opzioni: la sua unica variante con `{}`", ["PROVA-002-A", null], [AD.varianteDaOpzioni(S, {}), AD.varianteDaOpzioni(S, { Colore: "Nero" })]);

  // ── SKU del vecchio catalogo ──
  c("skuDaCodice: t01 → HG-T01", ["HG-T01", "HG-T12"], [AD.skuDaCodice("t01"), AD.skuDaCodice("t12")]);
  const catalogo = readFileSync(join(radice, "src/shop/catalog.ts"), "utf8");
  const vecchi = [...catalogo.matchAll(/\bid: "(\w+)", slug: "([a-z0-9-]+)"/g)].map((m) => ({ id: m[1], slug: m[2] }));
  c("tutti gli articoli del vecchio catalogo (33) danno uno SKU valido e diverso dagli altri", [33, true, 33], [vecchi.length, vecchi.every((v) => M.skuValido(AD.skuDaCodice(v.id))), new Set(vecchi.map((v) => AD.skuDaCodice(v.id))).size]);
  const s2 = join(radice, "supabase/migrations/20261120130000_shop_catalogo_import.sql");
  if (existsSync(s2)) {
    const sql = readFileSync(s2, "utf8");
    const nelSql = new Map([...sql.matchAll(/VALUES \('(HG-[A-Z0-9]+)', '([a-z0-9-]+)'/g)].map((m) => [m[2], m[1]]));
    c("prova incrociata sul file S2: lo SKU di ogni articolo è quello che calcola `skuDaCodice`", [], vecchi.filter((v) => nelSql.get(v.slug) !== AD.skuDaCodice(v.id)).map((v) => v.id));
    c("…e S2 non ha articoli in più né in meno", vecchi.length, nelSql.size);
  } else {
    console.log("  --  SALTATA: prova incrociata sul file S2 (supabase/migrations/20261120130000_*.sql non c'è su questo ramo: si accende da sola dopo l'unione con T04)");
  }

  // ── ripulisciRighe ──
  const snap = (extra = {}) => ({ nome: "Vecchio nome", slug: "vecchio", prezzoCent: 1, foto: null, varianteNome: null, ...extra });
  const riga = (sku, extra = {}) => ({ productId: sku, qty: 2, key: sku, sku, snap: snap(), ...extra });
  const ok = (sku, extra = {}) => ({ sku, nome: "Prodotto di prova", varianteNome: "Nero / 30", prezzoCent: 2890, disponibile: true, foto: null, slug: "prodotto-di-prova", ...extra });
  const vecchia = { productId: "t01", qty: 1, key: "t01" };
  const A = ripulisci();
  function ripulisci() { return CA.ripulisciRighe([vecchia], [ok("PROVA-001-NE-30")]); }
  c("una riga vecchia (id t01, senza sku) con il catalogo CMS viene tolta: rimosse = 1", [[], 1], [A.righe, A.rimosse]);
  const B = CA.ripulisciRighe([riga("PROVA-001-NE-30"), riga("GONE-1"), riga("OFF-1"), riga("ESAURITA-1"), vecchia], [ok("PROVA-001-NE-30"), { sku: "GONE-1", nonPiuDisponibile: true }, { sku: "ESAURITA-1", ...ok("ESAURITA-1"), disponibile: false }]);
  c("tolte: SKU non più pubblicato, SKU sconosciuto al server, esaurita, riga vecchia; resta la buona", [["PROVA-001-NE-30"], 4], [B.righe.map((l) => l.sku), B.rimosse]);
  c("la riga buona resta con la sua quantità e riceve nome, prezzo e foto di ADESSO", [2, 2890, "Prodotto di prova", "Nero / 30"], [B.righe[0].qty, B.righe[0].snap.prezzoCent, B.righe[0].snap.nome, B.righe[0].snap.varianteNome]);
  const ordine = CA.ripulisciRighe([riga("A-1"), riga("B-1"), riga("C-1")], [ok("C-1"), ok("A-1"), ok("B-1")]);
  c("l'ordine delle righe resta quello del carrello", ["A-1", "B-1", "C-1"], ordine.righe.map((l) => l.sku));
  const originale = [riga("A-1"), vecchia]; const copia = JSON.stringify(originale);
  CA.ripulisciRighe(originale, [ok("A-1")]);
  c("non cambia il carrello che riceve", copia, JSON.stringify(originale));
  c("carrello vuoto o dati strani → niente righe, niente rimosse, mai un'eccezione", [{ righe: [], rimosse: 0 }, { righe: [], rimosse: 0 }, { righe: [], rimosse: 0 }],
    [CA.ripulisciRighe([], []), CA.ripulisciRighe(undefined, undefined), CA.ripulisciRighe(null, [null, 4, {}])]);
  c("riga con quantità non valida o senza sku testuale → tolta", 3, CA.ripulisciRighe([riga("A-1", { qty: 0 }), riga("A-1", { qty: 1.5 }), riga("A-1", { sku: 7 })], [ok("A-1")]).rimosse);

  // ── totali ──
  const due = [riga("A-1", { qty: 2, snap: snap({ prezzoCent: 2890 }) }), riga("B-1", { qty: 1, snap: snap({ prezzoCent: 1500 }) })];
  c("due righe → totale corretto in euro da centesimi (2×28,90 + 15,00 = 72,80)", 72.8, CA.totaleDaRighe(due));
  c("niente errori binari: 3 × 19,90 = 59,70 (e non 59.699999…)", 59.7, CA.totaleDaRighe([riga("A-1", { qty: 3, snap: snap({ prezzoCent: 1990 }) })]));
  c("senza `snap` o con prezzo storto una riga non vale niente (mai un prezzo inventato)", 0, CA.totaleDaRighe([riga("A-1", { snap: undefined }), riga("B-1", { snap: snap({ prezzoCent: 12.5 }) }), riga("C-1", { snap: snap({ prezzoCent: -1 }) }), vecchia]));
  // con il catalogo `codice`: il subtotale è quello di oggi, a parità di righe (stessi prezzi di PRODUCTS)
  const prezzi = new Map([...catalogo.matchAll(/\bid: "(\w+)", slug: "[a-z0-9-]+", name: "[^"]*", category: "\w+",\s*price: (\d+(?:\.\d+)?)/g)].map((m) => [m[1], Number(m[2])]));
  c("(il prezzo di ognuno dei 33 articoli si legge dal catalogo)", 33, prezzi.size);
  const righeVecchie = [...prezzi.keys()].map((id, i) => ({ productId: id, qty: (i % 3) + 1, key: id }));
  const oggi = righeVecchie.reduce((s, l) => s + (prezzi.has(l.productId) ? prezzi.get(l.productId) * l.qty : 0), 0);
  c("catalogo `codice`: subtotale IDENTICO a quello di oggi (stessa formula, stesse righe, tutto il catalogo)", oggi, CA.subtotaleRighe(righeVecchie, (id) => prezzi.get(id)));
  c("…anche con una riga di un articolo che non c'è più (vale 0) e con carrello vuoto", [oggi, 0], [CA.subtotaleRighe([...righeVecchie, { productId: "zz", qty: 1, key: "zz" }], (id) => prezzi.get(id)), CA.subtotaleRighe([], () => 1)]);
  c("righe miste: le vecchie dal catalogo del codice, le CMS dai centesimi", 289 + 72.8, CA.subtotaleRighe([{ productId: "t01", qty: 1, key: "t01" }, ...due], (id) => prezzi.get(id)));
  c("una riga CMS non cerca mai il suo SKU nel catalogo del codice", 72.8, CA.subtotaleRighe(due, () => 9999));

  // ── CartContext.tsx: le righe vecchie non cambiano ──
  const ctx = readFileSync(join(radice, "src/shop/CartContext.tsx"), "utf8");
  c("CartContext: la chiave di memoria del carrello è la stessa (i carrelli già salvati si leggono)", true, /STORAGE_KEY = "hg_shop_cart_v1"/.test(ctx));
  c("CartContext: la riga guadagna `sku?` e `snap?` (facoltativi) e la chiave si fa come prima per le righe vecchie", [true, true, true], [/sku\?: string/.test(ctx), /snap\?: SnapRiga/.test(ctx), /cms \? cms\.sku : makeKey\(product\.id, variant\)/.test(ctx)]);
  c("CartContext: il subtotale passa da `subtotaleRighe`, con i prezzi di PRODUCTS per le righe vecchie", true, /subtotaleRighe\(lines, \(id\) => PRODUCTS\.find\(\(pr\) => pr\.id === id\)\?\.price\)/.test(ctx));
  c("CartContext: `add` accetta una variante CMS come quarto argomento facoltativo", true, /add: \(product: Product, qty: number, variant\?: Record<string, string>, cms\?: \{ sku: string; snap: SnapRiga \}\) => void/.test(ctx));
}
