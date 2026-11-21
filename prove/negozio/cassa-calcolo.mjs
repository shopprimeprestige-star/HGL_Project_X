/** ── NEGOZIO · RILASCIO 2 · T48 · IL CALCOLO DELLA CASSA ─────────────────────────────────────────────
 *  `src/shop/cassa/calcolo.ts` (D50, SPEC 7.4 n. 2): `calcolaOrdine(righeServer, righeRichieste, tariffa)` e `confrontaTotale`.
 *   · il prezzo, la spedizione e il totale li decide SOLO il server: del cliente si leggono `sku` e `qty`, il resto si butta;
 *   · si rifiuta: bozza, variante spenta, esaurita, quantità oltre la giacenza o fuori 1..20, SKU sconosciuto, riga senza slug,
 *     Invisible Derm (anche con un prezzo dato e anche col nome cambiato, se lo slug resta), qualunque prezzo non intero o ≤ 0,
 *     più di 30 righe, un totale sotto 50 centesimi;
 *   · lo stesso SKU due volte si somma; il totale si somma in CENTESIMI interi (mai euro con la virgola).
 *  Tutti i dati sono INVENTATI (`PROVA-…`): nessun cliente, nessun prodotto vero. */

const riga = (o = {}) => ({ sku: "PROVA-A", slug: "prodotto-a", nome: "Prodotto A", nome_variante: null, prezzo_cent: 2890, attiva: true, pubblicato: true, giacenza: 10, ...o });
const TARIFFA = { paese: "IT", costo_cent: 490, gratis_da_cent: null, attiva: true };
const catalogo = () => [
  riga({ sku: "PROVA-A", slug: "prodotto-a", nome: "Prodotto A", nome_variante: "Rosso", prezzo_cent: 2890 }),
  riga({ sku: "PROVA-B", slug: "prodotto-b", nome: "Prodotto B", prezzo_cent: 1990 }),
  riga({ sku: "PROVA-C", slug: "prodotto-c", nome: "Prodotto C", prezzo_cent: 100, giacenza: 3 }),
];

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("SHOP R2 · T48 · IL CALCOLO DELLA CASSA (21/11/2026)");
  const K = mod["shop/cassa/calcolo"];
  c("il modulo src/shop/cassa/calcolo.ts esiste", true, !!K);
  if (!K) return;
  const { calcolaOrdine, confrontaTotale } = K;
  const motivi = (e) => (e.ok ? null : e.righe?.map((r) => r.sku) ?? []);
  const rifiuta = (nome, server, richieste, tariffa = TARIFFA) => {
    const e = calcolaOrdine(server, richieste, tariffa);
    c(nome, false, e.ok);
    return e;
  };

  // ── il caso onesto: 2890×2 + 1990 + 490 = 8260 (centesimi interi, nessun errore binario) ──
  const onesto = calcolaOrdine(catalogo(), [{ sku: "PROVA-A", qty: 2 }, { sku: "PROVA-B", qty: 1 }], TARIFFA);
  c("3 pezzi su 2 righe: subtotale 7770, spedizione 490, totale 8260", [true, 7770, 490, 8260], [onesto.ok, onesto.subtotaleCent, onesto.spedizioneCent, onesto.totaleCent]);
  c("le righe dell'ordine hanno SKU, nome, slug, quantità, prezzo in euro e variante, nell'ordine chiesto", [
    { product_id: "PROVA-A", name: "Prodotto A", slug: "prodotto-a", qty: 2, unit_price: 28.9, variant: "Rosso" },
    { product_id: "PROVA-B", name: "Prodotto B", slug: "prodotto-b", qty: 1, unit_price: 19.9, variant: null },
  ], onesto.items);
  c("le righe per la sessione di Stripe: nome, variante, quantità e prezzo in CENTESIMI", [
    { nome: "Prodotto A", variante: "Rosso", qty: 2, prezzoCent: 2890 },
    { nome: "Prodotto B", variante: null, qty: 1, prezzoCent: 1990 },
  ], onesto.righe);
  const tre = calcolaOrdine(catalogo(), [{ sku: "PROVA-A", qty: 2 }, { sku: "PROVA-B", qty: 1 }, { sku: "PROVA-C", qty: 3 }], TARIFFA);
  c("un errore binario non c'è: 0,1 + 0,2 in centesimi (10 + 20) fa 30", 30, calcolaOrdine([riga({ prezzo_cent: 10 }), riga({ sku: "PROVA-B", slug: "b", prezzo_cent: 20 })], [{ sku: "PROVA-A", qty: 1 }, { sku: "PROVA-B", qty: 1 }], { costo_cent: 20 }).subtotaleCent);
  c("tre righe: 7770 + 300 + 490 = 8560", 8560, tre.totaleCent);

  // ── richiesta artefatta: il cliente non decide nessuna cifra ──
  const base = [{ sku: "PROVA-A", qty: 2 }, { sku: "PROVA-B", qty: 1 }];
  const artefatta = base.map((r) => ({ ...r, prezzoCent: 1, prezzo: 0.01, unit_price: 0.01, price: 1, totale: 1 }));
  c("prezzo mandato dal client (prezzoCent: 1, prezzo, unit_price) → IGNORATO: stesso identico risultato", onesto, calcolaOrdine(catalogo(), artefatta, TARIFFA));
  c("anche la spedizione del client (spedizioneCent: 0) e il totale del client sono ignorati", onesto, calcolaOrdine(catalogo(), base.map((r) => ({ ...r, spedizioneCent: 0, shipping: 0, totaleCent: 1 })), TARIFFA));
  const richiesteOriginali = JSON.stringify(artefatta);
  calcolaOrdine(catalogo(), artefatta, TARIFFA);
  c("le righe ricevute non vengono modificate", richiesteOriginali, JSON.stringify(artefatta));

  // ── quantità ──
  const q25 = rifiuta("quantità 25 → rifiutata", catalogo(), [{ sku: "PROVA-B", qty: 25 }]);
  c("…con lo SKU della riga e una frase in italiano", [["PROVA-B"], true], [motivi(q25), /[a-zàèéìòù]{4}/.test(q25.righe?.[0]?.frase ?? "")]);
  c("quantità 20 con giacenza 20 → accettata", true, calcolaOrdine([riga({ giacenza: 20 })], [{ sku: "PROVA-A", qty: 20 }], TARIFFA).ok);
  for (const [nome, qty] of [["0", 0], ["-1", -1], ["1,5", 1.5], ["testo", "2"], ["NaN", NaN], ["Infinity", Infinity], ["null", null], ["mancante", undefined]])
    rifiuta(`quantità ${nome} → rifiutata`, catalogo(), [{ sku: "PROVA-A", qty }]);
  const oltre = rifiuta("quantità oltre la giacenza (4 su 3) → rifiutata con lo SKU", catalogo(), [{ sku: "PROVA-C", qty: 4 }]);
  c("…con la frase, che non rivela quanti pezzi ci sono (nessuna cifra)", [["PROVA-C"], false], [motivi(oltre), /\d/.test(oltre.righe?.[0]?.frase ?? "")]);
  c("quantità pari alla giacenza (3 su 3) → accettata", true, calcolaOrdine(catalogo(), [{ sku: "PROVA-C", qty: 3 }], TARIFFA).ok);
  rifiuta("giacenza 0 (esaurita) → rifiutata", [riga({ giacenza: 0 })], [{ sku: "PROVA-A", qty: 1 }]);
  rifiuta("giacenza negativa → rifiutata", [riga({ giacenza: -2 })], [{ sku: "PROVA-A", qty: 1 }]);
  rifiuta("giacenza non intera o mancante → rifiutata", [riga({ giacenza: 2.5 })], [{ sku: "PROVA-A", qty: 1 }]);
  rifiuta("…giacenza assente", [riga({ giacenza: undefined })], [{ sku: "PROVA-A", qty: 1 }]);

  // ── SKU doppio: si somma, e la somma conta per il limite e per la giacenza ──
  const doppio = calcolaOrdine(catalogo(), [{ sku: "PROVA-B", qty: 1 }, { sku: "PROVA-A", qty: 1 }, { sku: "PROVA-B", qty: 2 }], TARIFFA);
  c("lo stesso SKU due volte si somma in una riga sola (3 × 1990 + 2890 + 490 = 9350)", [true, 2, 3, 9350], [doppio.ok, doppio.items?.length, doppio.items?.find((i) => i.product_id === "PROVA-B")?.qty, doppio.totaleCent]);
  c("…e conserva l'ordine della prima comparsa (B prima di A)", ["PROVA-B", "PROVA-A"], doppio.items?.map((i) => i.product_id));
  rifiuta("la somma di due righe oltre 20 (12 + 12) → rifiutata", [riga({ giacenza: 50 })], [{ sku: "PROVA-A", qty: 12 }, { sku: "PROVA-A", qty: 12 }]);
  rifiuta("la somma di due righe oltre la giacenza (2 + 2 su 3) → rifiutata", catalogo(), [{ sku: "PROVA-C", qty: 2 }, { sku: "PROVA-C", qty: 2 }]);

  // ── quante righe ──
  const molte = (n) => Array.from({ length: n }, (_, i) => riga({ sku: `PROVA-${i}`, slug: `prodotto-${i}`, nome: `Prodotto ${i}` }));
  const chiedi = (n) => Array.from({ length: n }, (_, i) => ({ sku: `PROVA-${i}`, qty: 1 }));
  c("30 righe → accettate", true, calcolaOrdine(molte(30), chiedi(30), TARIFFA).ok);
  const e31 = rifiuta("31 righe → rifiutate", molte(31), chiedi(31));
  c("…come errore di valore, non di un prodotto", "valore", e31.motivo);
  const vuoto = rifiuta("nessuna riga → rifiutato", catalogo(), []);
  c("…anche questo come errore di valore", "valore", vuoto.motivo);
  for (const [nome, v] of [["non è un elenco", "PROVA-A"], ["null", null], ["undefined", undefined], ["un oggetto", { sku: "PROVA-A", qty: 1 }]]) rifiuta(`le righe richieste: ${nome} → rifiutato, senza eccezione`, catalogo(), v);
  rifiuta("righe richieste con elementi non oggetto → rifiutato", catalogo(), [null, 3, "PROVA-A"]);
  rifiuta("SKU non testo → rifiutato", catalogo(), [{ sku: 12, qty: 1 }]);
  rifiuta("righe del server non è un elenco → rifiutato, senza eccezione", null, [{ sku: "PROVA-A", qty: 1 }]);

  // ── disponibilità ──
  const bozza = rifiuta("prodotto in bozza → rifiutato", [riga({ pubblicato: false })], [{ sku: "PROVA-A", qty: 1 }]);
  c("…e la frase non dice «bozza» né un prezzo", [["PROVA-A"], false], [motivi(bozza), /bozza|\d/.test(bozza.righe?.[0]?.frase ?? "")]);
  rifiuta("variante con attiva:false → rifiutata", [riga({ attiva: false })], [{ sku: "PROVA-A", qty: 1 }]);
  rifiuta("attiva non vero (null, 'true', 1) → rifiutata", [riga({ attiva: "true" })], [{ sku: "PROVA-A", qty: 1 }]);
  rifiuta("pubblicato non vero ('si') → rifiutato", [riga({ pubblicato: "si" })], [{ sku: "PROVA-A", qty: 1 }]);
  const ignoto = rifiuta("SKU che il server non conosce → rifiutato con lo SKU", catalogo(), [{ sku: "PROVA-NON-C-E", qty: 1 }]);
  c("…con lo SKU in lista", ["PROVA-NON-C-E"], motivi(ignoto));
  const mista = rifiuta("una riga buona e una cattiva → rifiuta tutto, ma elenca SOLO la cattiva", catalogo(), [{ sku: "PROVA-A", qty: 1 }, { sku: "PROVA-C", qty: 9 }]);
  c("…l'elenco dei rifiuti ha solo PROVA-C", ["PROVA-C"], motivi(mista));
  const due = rifiuta("due righe cattive → le elenca entrambe", catalogo(), [{ sku: "PROVA-C", qty: 9 }, { sku: "PROVA-X", qty: 1 }]);
  c("…tutte e due", ["PROVA-C", "PROVA-X"], motivi(due));

  // ── riga senza slug, Invisible Derm, prezzi storti ──
  for (const [nome, slug] of [["mancante", undefined], ["vuoto", ""], ["di soli spazi", "   "], ["non testo", 7]]) rifiuta(`riga senza slug (${nome}) → rifiutata`, [riga({ slug })], [{ sku: "PROVA-A", qty: 1 }]);
  rifiuta("riga senza nome → rifiutata", [riga({ nome: "" })], [{ sku: "PROVA-A", qty: 1 }]);
  rifiuta("Invisible Derm col suo prezzo dato in dati finti → rifiutato", [riga({ nome: "Invisible Derm", slug: "invisible-derm", prezzo_cent: 49000 })], [{ sku: "PROVA-A", qty: 1 }]);
  rifiuta("…anche scritto «Invisibile Derm» (nome) con slug qualunque", [riga({ nome: "Invisibile Derm", slug: "prodotto-a", prezzo_cent: 49000 })], [{ sku: "PROVA-A", qty: 1 }]);
  rifiuta("…anche col nome cambiato, se lo slug comincia per invisible-derm", [riga({ nome: "Sistema capelli", slug: "invisible-derm-v2", prezzo_cent: 49000 })], [{ sku: "PROVA-A", qty: 1 }]);
  rifiuta("…anche con Invisible Derm in mezzo a righe buone", [riga(), riga({ sku: "PROVA-ID", nome: "Invisible-Derm", slug: "x", prezzo_cent: 49000 })], [{ sku: "PROVA-A", qty: 1 }, { sku: "PROVA-ID", qty: 1 }]);
  const derm = rifiuta("…e dice quale riga", [riga(), riga({ sku: "PROVA-ID", nome: "InvisibleDerm", slug: "x", prezzo_cent: 49000 })], [{ sku: "PROVA-A", qty: 1 }, { sku: "PROVA-ID", qty: 1 }]);
  c("…solo la riga di Invisible Derm, con una frase senza cifre", [["PROVA-ID"], false], [motivi(derm), /\d|invisible|derm/i.test(derm.righe?.[0]?.frase ?? "")]);
  c("un prodotto che si chiama «Solvente per Invisible Derm» conserva il suo prezzo", true, calcolaOrdine([riga({ nome: "Solvente per Invisible Derm", slug: "solvente" })], [{ sku: "PROVA-A", qty: 1 }], TARIFFA).ok);
  rifiuta("prezzo 0 con un nome non riconosciuto → rifiutato", [riga({ nome: "Qualcosa di nuovo", slug: "qualcosa", prezzo_cent: 0 })], [{ sku: "PROVA-A", qty: 1 }]);
  rifiuta("prezzo negativo → rifiutato", [riga({ prezzo_cent: -100 })], [{ sku: "PROVA-A", qty: 1 }]);
  const p125 = rifiuta("prezzo 12,5 (non intero) → rifiutato", [riga({ prezzo_cent: 12.5 })], [{ sku: "PROVA-A", qty: 1 }]);
  c("…con una frase senza cifre e senza dire «prezzo»", false, /\d|prezz/i.test(p125.righe?.[0]?.frase ?? ""));
  for (const [nome, v] of [["null", null], ["mancante", undefined], ["testo '2890'", "2890"], ["NaN", NaN], ["Infinity", Infinity], ["oltre i numeri sicuri", 2 ** 53]])
    rifiuta(`prezzo ${nome} → rifiutato`, [riga({ prezzo_cent: v })], [{ sku: "PROVA-A", qty: 1 }]);
  c("prezzo 1 centesimo, intero → il prezzo passa (e il totale lo ferma: vedi sotto)", true, calcolaOrdine([riga({ prezzo_cent: 1 })], [{ sku: "PROVA-A", qty: 1 }], TARIFFA).ok);

  // ── totale minimo: 50 centesimi (Stripe) ──
  const gratis = { costo_cent: 0, gratis_da_cent: null };
  const t49 = calcolaOrdine([riga({ prezzo_cent: 49 })], [{ sku: "PROVA-A", qty: 1 }], gratis);
  c("totale 49 centesimi → rifiutato", false, t49.ok);
  c("…come errore di valore, con una frase (e nessuna riga da incolpare)", ["valore", true, 0], [t49.motivo, /[a-zàèéìòù]{4}/.test(t49.frase ?? ""), (t49.righe ?? []).length]);
  c("totale 50 centesimi → accettato", [true, 50], (() => { const e = calcolaOrdine([riga({ prezzo_cent: 50 })], [{ sku: "PROVA-A", qty: 1 }], gratis); return [e.ok, e.totaleCent]; })());
  c("il minimo conta sul totale con la spedizione: 20 + 30 = 50 → accettato", true, calcolaOrdine([riga({ prezzo_cent: 20 })], [{ sku: "PROVA-A", qty: 1 }], { costo_cent: 30 }).ok);
  c("…e 20 + 29 = 49 → rifiutato", false, calcolaOrdine([riga({ prezzo_cent: 20 })], [{ sku: "PROVA-A", qty: 1 }], { costo_cent: 29 }).ok);
  const enorme = calcolaOrdine([riga({ prezzo_cent: 99_999_999, giacenza: 20 })], [{ sku: "PROVA-A", qty: 2 }], gratis);
  c("un totale oltre il massimo di Stripe (999.999,99 €) → rifiutato come valore", [false, "valore"], [enorme.ok, enorme.motivo]);

  // ── la spedizione la decide la tariffa del server ──
  const nessuna = calcolaOrdine(catalogo(), base, null);
  c("senza tariffa (null) la cassa non si apre: motivo cassa_chiusa", [false, "cassa_chiusa"], [nessuna.ok, nessuna.motivo]);
  for (const [nome, t] of [["undefined", undefined], ["costo non intero", { costo_cent: 4.9 }], ["costo negativo", { costo_cent: -1 }], ["costo testo", { costo_cent: "490" }], ["non un oggetto", "490"]])
    c(`tariffa storta (${nome}) → cassa_chiusa, mai una spedizione inventata`, [false, "cassa_chiusa"], (() => { const e = calcolaOrdine(catalogo(), base, t); return [e.ok, e.motivo]; })());
  c("spedizione gratis oltre la soglia della tariffa (stessa funzione di T45): 7770 ≥ 5000 → 0", [0, 7770], (() => { const e = calcolaOrdine(catalogo(), base, { costo_cent: 490, gratis_da_cent: 5000 }); return [e.spedizioneCent, e.totaleCent]; })());
  c("soglia vuota o zero → ignorata, la spedizione si paga", [490, 490], [calcolaOrdine(catalogo(), base, { costo_cent: 490, gratis_da_cent: 0 }).spedizioneCent, calcolaOrdine(catalogo(), base, { costo_cent: 490, gratis_da_cent: null }).spedizioneCent]);

  // ── confrontaTotale: il cliente non paga mai una cifra diversa da quella vista ──
  c("totale atteso uguale → ok", { ok: true }, confrontaTotale(8260, 8260));
  const diverso = confrontaTotale(8250, 8260);
  c("totale atteso diverso → prezzi_cambiati con i totali nuovi", [false, "prezzi_cambiati", 8260], [diverso.ok, diverso.motivo, diverso.totaleCent]);
  for (const [nome, v] of [["decimale", 82.6], ["testo", "8260"], ["null", null], ["undefined", undefined], ["NaN", NaN], ["negativo", -8260]])
    c(`totale atteso ${nome} → prezzi_cambiati (mai ok)`, false, confrontaTotale(v, 8260).ok);

  // ── il sorgente: nessun prezzo letto dalla richiesta, soldi in centesimi ──
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const src = readFileSync(join(radice, "src/shop/cassa/calcolo.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c("il sorgente non legge prezzo, price, unit_price o totale dalle righe richieste", false, /\b(?:r|richiesta|riga)\??\.(?:prezzo|price|unit_price|prezzoCent|totale|spedizione|shipping)/.test(src));
  c("il sorgente usa eInvisibleDerm di pubblico.ts (non una copia)", true, /eInvisibleDerm|senzaPrezzo/.test(src) && !/invisibi\?l\[ei\]/i.test(src));
  c("il sorgente usa costoSpedizione di T45 (non una copia)", true, /costoSpedizione/.test(src));
  c("il sorgente non usa Math.round né toFixed né parseFloat sui soldi", false, /Math\.round|toFixed|parseFloat/.test(src));
}
