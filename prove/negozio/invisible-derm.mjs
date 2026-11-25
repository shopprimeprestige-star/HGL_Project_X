/** ── NEGOZIO · D39 · IL PREZZO DI INVISIBLE DERM NON LASCIA MAI IL SERVER ──
 *  Il titolare ha deciso (D39): Invisible Derm è sempre senza prezzo. Non basta nasconderlo nel markup: il prezzo non deve
 *  comparire nei dati della pagina, nelle risposte delle funzioni del server né nel JSON-LD.
 *  Prova: un Invisible Derm col prezzo «strano» 4731 centesimi (sul prodotto e su una variante) attraversa elenco, scheda,
 *  anteprima, categorie, carrello, sitemap, JSON-LD e adattatore; ogni forma del numero (4731, 47.31, 47,31) deve mancare.
 *  Con il catalogo `codice` non cambia niente (non si tocca qui). Dati inventati. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { viste, negozio } from "./catalogo-server.mjs";
import { ISTANTE, mediaProva, prodottoProva, uuid, varianteProva } from "./dati.mjs";

const BASE = "https://media.prova.test/storage/shop-media";
const CHIAVE = "chiave-di-servizio-di-prova";
const T0 = Date.parse(ISTANTE);
const SITO = "https://sito.prova.test";
/** Tutte le forme in cui 4731 centesimi potrebbero uscire. */
const PREZZO = /4731|47[.,]31/;

export async function prove(mod, { c, gruppo, radice }) {
  const PUB = mod["shop/cms/pubblico"];
  const CAT = mod["shop/cms/catalogo.server"];
  const LD = mod["shop/cms/json-ld"];
  const AD = mod["shop/cms/adattatore"];
  const AN = mod["shop/cms/anteprima"];
  gruppo("NEGOZIO · D39: IL PREZZO DI INVISIBLE DERM NON ESCE DAL SERVER (20/11/2026)");

  // ── il riconoscimento (D40: ancorato all'inizio del nome, oppure lo slug comincia con `invisible-derm`) ──
  const E = PUB.eInvisibleDerm;
  c("eInvisibleDerm: riconosce le scritture del nome (spazi, trattini, trattini bassi, punto, «&», barra, maiuscole, attaccato, «Invisibile»)", Array(10).fill(true),
    ["Invisible Derm", "INVISIBLE-DERM", "invisible_derm", "InvisibleDerm", "invisible - derm", "Invisibile Derm", "  Invisible Derm Protocol®", "Invisible.Derm", "Invisible & Derm", "Invisible/Derm"].map((n) => E(n)));
  c("eInvisibleDerm: il nome deve COMINCIARE così: «Solvente per Invisible Derm» e «Sistema Invisible Derm 30 ml» conservano il loro prezzo", [false, false],
    ["Solvente per Invisible Derm", "Sistema Invisible Derm 30 ml"].map((n) => E(n)));
  c("eInvisibleDerm: «Invisible Dermatologico» non è Invisible Derm", false, E("Invisible Dermatologico"));
  c("eInvisibleDerm: altri nomi, vuoto, nullo o non testo → no", Array(6).fill(false), ["Invisible", "Derm", "Prodotto di prova", "", null, 42].map((n) => E(n)));
  c("eInvisibleDerm: anche lo SLUG che comincia con `invisible-derm` basta (con qualunque nome); uno slug che lo contiene soltanto, no",
    [true, true, false, false, false], [E("Kit", "invisible-derm"), E(null, "invisible-derm-kit"), E("Kit", "solvente-per-invisible-derm"), E("Kit", "kit"), E("Kit", 7)]);

  // ── UNA funzione sola: nessun'altra regex del nome nel codice (elenco, scheda, CRM, carrello la importano da `pubblico.ts`) ──
  {
    const letto = (f) => readFileSync(join(radice, f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const CHI = ["src/shop/cms/elenco.ts", "src/shop/cms/scheda.ts", "src/shop/cms/cassa.ts", "src/shop/cms/catalogo.server.ts", "src/shop/cms/adattatore.ts", "src/shop/cms/json-ld.ts",
      "src/shop/cms/pubblicazione.ts", "src/crm/ecommerce/prodotti/scheda-pura.ts", "src/crm/negozio/prodotti.server.ts", "src/routes/shop.prodotto.$slug.tsx"];
    // una regex del nome ha «invisib…» seguito da una classe `[` o da `\s`: nelle stringhe e nei percorsi non c'è mai
    const copie = (f) => /invisib[a-z?]{0,4}(?:\[|\\)/i.test(letto(f));
    c("nessuna copia della regex di Invisible Derm fuori da `pubblico.ts`", [], CHI.filter(copie));
    c("`pubblico.ts` ha la regex del nome una volta sola", 1, (letto("src/shop/cms/pubblico.ts").match(/invisib[a-z?]{0,4}(?:\[|\\)/gi) ?? []).length);
  }

  // ── il negozio di prova: Invisible Derm a 4731 (prodotto e una variante), più un prodotto che lo ha come «Ti serve anche» ──
  const ID = uuid(0x250), ID_BOZZA = uuid(0x251), ID_RIGA = uuid(0x252), ID_SLUG = uuid(0x253), ID_ZERO = uuid(0x254);
  const tabelle = () => {
    const t = negozio("cms");
    t.shop_prodotti.find((p) => p.id === uuid(0x200)).correlato_id = ID; // «Prodotto di prova» consiglia Invisible Derm
    t.shop_prodotti.push(
      prodottoProva({ id: ID, sku: "PROVA-ID", slug: "invisible-derm", nome: "Invisible Derm", prezzo_cent: 4731, tipo: "kit" }),
      // il nome può uscire dalla riga, dalla bozza (anteprima) o dallo slug: ognuno da solo basta
      prodottoProva({ id: ID_BOZZA, sku: "PROVA-ID2", slug: "sistema-in-bozza", nome: "Sistema", stato: "bozza", pubblicato_il: null, prezzo_cent: 4731, bozza_modifiche: { nome: "Invisible-Derm" } }),
      prodottoProva({ id: ID_RIGA, sku: "PROVA-ID3", slug: "sistema-nuovo", nome: "InvisibleDerm Plus", prezzo_cent: 4731 }),
      prodottoProva({ id: ID_SLUG, sku: "PROVA-ID4", slug: "invisible-derm-kit", nome: "Kit di prova", prezzo_cent: 4731 }),
      // un prodotto qualunque a 0: resta scartato (non si vende a zero), non è Invisible Derm
      prodottoProva({ id: ID_ZERO, sku: "PROVA-ZERO", slug: "prodotto-a-zero", nome: "Prodotto a zero", prezzo_cent: 0 }),
    );
    t.shop_varianti.push(
      varianteProva({ id: uuid(0x350), prodotto_id: ID, sku: "PROVA-ID-A", nome: "Misura S", opzioni: { Misura: "S" }, giacenza: 8, ordine: 1 }),
      varianteProva({ id: uuid(0x351), prodotto_id: ID, sku: "PROVA-ID-B", nome: "Misura M", opzioni: { Misura: "M" }, prezzo_cent: 4731, giacenza: 8, ordine: 2 }),
      varianteProva({ id: uuid(0x352), prodotto_id: ID_BOZZA, sku: "PROVA-ID2-A", giacenza: 4 }),
      varianteProva({ id: uuid(0x353), prodotto_id: ID_RIGA, sku: "PROVA-ID3-A", giacenza: 4 }),
      varianteProva({ id: uuid(0x354), prodotto_id: ID_SLUG, sku: "PROVA-ID4-A", giacenza: 4 }),
      varianteProva({ id: uuid(0x355), prodotto_id: ID_ZERO, sku: "PROVA-ZERO-A", giacenza: 4 }),
    );
    t.shop_media.push(mediaProva({ id: uuid(0x450), prodotto_id: ID, slot: "principale" }));
    t.shop_prodotti_categorie.push({ prodotto_id: ID, categoria_id: uuid(0x100) });
    return t;
  };
  let ora = T0;
  const catalogo = () => {
    const t = tabelle();
    return CAT.creaCatalogo({ db: fintoDb({ tabelle: { ...t, ...viste(t) } }), adesso: () => ora, baseMedia: BASE, chiaveServizio: CHIAVE });
  };

  // ── il costruttore ──
  const t = tabelle();
  const pubblici = PUB.costruisciPubblico({ prodotti: t.shop_prodotti, varianti: t.shop_varianti, media: t.shop_media, categorie: t.shop_categorie, prodottiCategorie: t.shop_prodotti_categorie }, { baseMedia: BASE });
  const perSlug = (l, s) => l.find((p) => p.slug === s);
  const d = perSlug(pubblici, "invisible-derm");
  c("Invisible Derm esce (non si scarta più per il prezzo) e gli altri pubblicati restano; il prodotto a 0 non è Invisible Derm e resta fuori",
    ["altro-prodotto", "invisible-derm", "invisible-derm-kit", "prodotto-di-prova", "sistema-nuovo"], pubblici.map((p) => p.slug).sort());
  c("Invisible Derm: nessun prezzo (prodotto e varianti `null`), non acquistabile, varianti non disponibili",
    [null, [null, null], false, [false, false]], [d.prezzoDaCent, d.varianti.map((v) => v.prezzoCent), d.acquistabile, d.varianti.map((v) => v.disponibile)]);
  c("Invisible Derm: sku, nome e opzioni delle varianti restano (si vede la scheda, non si compra)", [["PROVA-ID-A", "PROVA-ID-B"], ["Misura S", "Misura M"]], [d.varianti.map((v) => v.sku), d.varianti.map((v) => v.nome)]);
  c("un prodotto qualunque è acquistabile e col prezzo, come prima", [true, 2890], ((p) => [p.acquistabile, p.prezzoDaCent])(perSlug(pubblici, "prodotto-di-prova")));
  c("il nome si riconosce anche dalla riga e dallo slug, non solo dal nome mostrato: non acquistabili", [false, false], ["sistema-nuovo", "invisible-derm-kit"].map((s) => perSlug(pubblici, s).acquistabile));
  c("…con prezzo `null` anche per la riga e per lo slug", [null, null], ["sistema-nuovo", "invisible-derm-kit"].map((s) => perSlug(pubblici, s).prezzoDaCent));
  c("«Ti serve anche» che porta a Invisible Derm: nome e foto sì, prezzo `null`", [{ slug: "invisible-derm", nome: "Invisible Derm", prezzoDaCent: null }], [(({ slug, nome, prezzoDaCent }) => ({ slug, nome, prezzoDaCent }))(perSlug(pubblici, "prodotto-di-prova").correlato)]);
  c("nessuna forma di 4731 in tutto l'elenco costruito", false, PREZZO.test(JSON.stringify(pubblici)));

  // ── anteprima: il nome nuovo della bozza rende il prodotto Invisible Derm, anche se la riga dice altro ──
  const ant = PUB.costruisciPubblico({ prodotti: t.shop_prodotti, varianti: t.shop_varianti, media: t.shop_media, categorie: t.shop_categorie, prodottiCategorie: t.shop_prodotti_categorie }, { baseMedia: BASE, anteprima: { slug: "sistema-in-bozza" } });
  const b = perSlug(ant, "sistema-in-bozza");
  c("anteprima: la bozza che si chiama «Invisible-Derm» è senza prezzo e non acquistabile", ["Invisible-Derm", null, [null], false], [b.nome, b.prezzoDaCent, b.varianti.map((v) => v.prezzoCent), b.acquistabile]);
  c("nessuna forma di 4731 nell'anteprima costruita", false, PREZZO.test(JSON.stringify(ant)));

  // ── dalle funzioni del server (le stesse che le pagine chiamano) ──
  const k = catalogo();
  const elenco = await k.elenco();
  const scheda = await k.scheda("invisible-derm");
  const chiave = await AN.emettiChiaveAnteprima(CHIAVE, "sistema-in-bozza", T0);
  const schedaAnteprima = await k.scheda("sistema-in-bozza", chiave);
  const schedaConCorrelato = await k.scheda("prodotto-di-prova");
  const categorie = await k.categorie();
  const carrello = await k.righeCarrello(["PROVA-ID-A", "PROVA-ID-B", "PROVA-ID3-A", "PROVA-ID4-A", "PROVA-001-A", "PROVA-ID2-A"]);
  const sitemap = await k.vociSitemap();
  c("elenco: Invisible Derm c'è, senza prezzo", [true, null], [elenco.some((p) => p.slug === "invisible-derm"), perSlug(elenco, "invisible-derm")?.prezzoDaCent]);
  c("scheda: trovata, senza prezzo, non acquistabile", [null, [null, null], false], [scheda?.prezzoDaCent, scheda?.varianti.map((v) => v.prezzoCent), scheda?.acquistabile]);
  c("anteprima (chiave valida): la scheda della bozza esce, senza prezzo", [true, null, false], [!!schedaAnteprima, schedaAnteprima?.prezzoDaCent, schedaAnteprima?.acquistabile]);
  c("carrello: ogni sku di Invisible Derm (anche quelli per riga, per slug e in bozza) è «non più disponibile»; un prodotto normale resta con prezzo",
    [{ sku: "PROVA-ID-A", nonPiuDisponibile: true }, { sku: "PROVA-ID-B", nonPiuDisponibile: true }, { sku: "PROVA-ID3-A", nonPiuDisponibile: true }, { sku: "PROVA-ID4-A", nonPiuDisponibile: true }, 2890, { sku: "PROVA-ID2-A", nonPiuDisponibile: true }],
    carrello.map((r) => (r.sku === "PROVA-001-A" ? r.prezzoCent : r)));
  for (const [nome, valore] of [["elenco", elenco], ["scheda", scheda], ["scheda con «Ti serve anche»", schedaConCorrelato], ["anteprima", schedaAnteprima], ["categorie", categorie], ["carrello", carrello], ["sitemap", sitemap]])
    c(`${nome}: nessuna forma di 4731, 47.31 o 47,31 nella risposta serializzata`, false, PREZZO.test(JSON.stringify(valore)));

  // ── JSON-LD ──
  const ld = LD.datiStrutturatiProdotto(scheda, SITO);
  c("JSON-LD: Invisible Derm ha nome, sku e indirizzo ma NESSUNA `offers`", [true, false], [ld.name === "Invisible Derm" && ld.sku === "PROVA-ID", "offers" in ld]);
  c("JSON-LD: nessuna forma del prezzo, né nel prodotto né nella lista", false, PREZZO.test(LD.serializzaJsonLd(ld) + LD.serializzaJsonLd(LD.datiStrutturatiLista(elenco, SITO))));
  const normale = LD.datiStrutturatiProdotto(perSlug(elenco, "prodotto-di-prova"), SITO);
  c("JSON-LD: un prodotto normale ha ancora le sue offerte", true, Array.isArray(normale.offers) && normale.offers.length > 0);

  // ── adattatore (le pagine di oggi) ──
  const prodotto = AD.daPubblicoAProdotto(scheda);
  c("adattatore: Invisible Derm non rompe niente e non porta un prezzo inventato (0), sempre «non c'è»", [0, 0], [prodotto.price, prodotto.stock]);
  c("adattatore: nessuna forma di 4731 nel `Product`", false, PREZZO.test(JSON.stringify(prodotto)));
  c("adattatore: un prodotto normale ha il suo prezzo", 28.9, AD.daPubblicoAProdotto(perSlug(elenco, "prodotto-di-prova")).price);
}
