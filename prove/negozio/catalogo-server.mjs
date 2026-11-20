/** ── NEGOZIO · T11 · LE LETTURE PUBBLICHE CON MEMORIA BREVE ─────────────────
 *  `src/shop/cms/catalogo.server.ts` (porte: `db`, `adesso`, `baseMedia`, `chiaveServizio`, `forza`, `log`) e
 *  `catalogo.functions.ts` (l'involucro `createServerFn`: se ne controlla il SORGENTE, non gira nel bundle di Node).
 *  Finto database `_finto-db.mjs`; le VISTE `shop_v_*` si ricavano dalle tabelle come fa S1 (solo i pubblicati, niente
 *  giacenza, niente colonne private). Dati inventati. Nessuna rete, nessuna chiave vera. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fintoDb } from "./_finto-db.mjs";
import { ISTANTE, categoriaProva, mediaProva, prodottoProva, tabelleProva, uuid, varianteProva } from "./dati.mjs";

const BASE = "https://media.prova.test/storage/shop-media";
const CHIAVE = "chiave-di-servizio-di-prova";
const T0 = Date.parse(ISTANTE);
const ORE = 3600 * 1000;
const PRIVATE = ["costo", "note_interne", "fornitore", "bozza_modifiche", "bozza_modificata_il", "id_codice", "origine", "canali", "mpn", "categoria_google",
  "peso_g", "classe_spedizione", "scheda_tecnica_path", "nota_titolare", "creato_il"];

/** Le tabelle del negozio di prova: due pubblicati, una bozza, un archiviato; una variante spenta; foto di un prodotto e di una categoria. */
export function negozio(modalita = "cms") {
  const t = tabelleProva();
  const P1 = uuid(0x200), P2 = uuid(0x201), P3 = uuid(0x202), P4 = uuid(0x203);
  t.shop_impostazioni = [{ chiave: "catalogo_sito", valore: modalita, aggiornato_il: ISTANTE, aggiornato_da: null }, { chiave: "giacenza_bassa", valore: 3, aggiornato_il: ISTANTE, aggiornato_da: null }];
  t.shop_prodotti.push(
    prodottoProva({ id: P3, sku: "PROVA-003", slug: "prodotto-archiviato", nome: "Prodotto archiviato", stato: "archiviato" }),
    prodottoProva({ id: P4, sku: "PROVA-004", slug: "altro-prodotto", nome: "Altro prodotto", prezzo_cent: 3500 }),
  );
  t.shop_varianti.push(
    varianteProva({ id: uuid(0x302), prodotto_id: P1, sku: "PROVA-001-OFF", nome: "Spenta", prezzo_cent: 100, giacenza: 9, attiva: false, ordine: 2 }),
    varianteProva({ id: uuid(0x303), prodotto_id: P3, sku: "PROVA-003-A", giacenza: 4 }),
    varianteProva({ id: uuid(0x304), prodotto_id: P4, sku: "PROVA-004-A", giacenza: 0 }),
  );
  t.shop_media.push(
    mediaProva({ id: uuid(0x401), prodotto_id: P4, slot: "principale" }),
    mediaProva({ id: uuid(0x402), prodotto_id: null, categoria_id: uuid(0x100), slot: "principale", path_480: "cat/a-480.webp", path_960: "cat/a-960.webp", path_1600: "cat/a-1600.webp", alt: "Foto della categoria" }),
  );
  t.shop_categorie.push(
    categoriaProva({ id: uuid(0x101), slug: "categoria-vuota", nome: "Vuota", visibile: true, ordine: 2 }),
    categoriaProva({ id: uuid(0x102), slug: "categoria-nascosta", nome: "Nascosta", visibile: false, ordine: 3 }),
  );
  t.shop_prodotti_categorie.push({ prodotto_id: P4, categoria_id: uuid(0x100) }, { prodotto_id: P2, categoria_id: uuid(0x101) }, { prodotto_id: P1, categoria_id: uuid(0x102) });
  return t;
}

/** Le quattro viste di S1, ricavate dalle tabelle (stessa regola del SQL). */
export function viste(t) {
  const pubblicati = new Set(t.shop_prodotti.filter((p) => p.stato === "pubblicato").map((p) => p.id));
  const cat = new Map(t.shop_categorie.map((c) => [c.id, c]));
  const quanti = (cid) => t.shop_prodotti_categorie.filter((l) => l.categoria_id === cid && pubblicati.has(l.prodotto_id)).length;
  return {
    shop_v_prodotti: t.shop_prodotti.filter((p) => pubblicati.has(p.id)).map((p) => {
      const v = { ...p, categorie: t.shop_prodotti_categorie.filter((l) => l.prodotto_id === p.id && cat.get(l.categoria_id)?.visibile).map((l) => ({ slug: cat.get(l.categoria_id).slug, nome: cat.get(l.categoria_id).nome })) };
      for (const k of PRIVATE) delete v[k];
      return v;
    }),
    shop_v_varianti: t.shop_varianti.filter((v) => pubblicati.has(v.prodotto_id)).map(({ giacenza, creato_il, aggiornato_il, peso_g, ...v }) => ({ ...v, disponibile: giacenza > 0 && v.attiva })),
    shop_v_media: t.shop_media.filter((m) => !m.rimosso_il && (!m.ritrae_persone || m.liberatoria_ok) && (pubblicati.has(m.prodotto_id) || (m.categoria_id && cat.get(m.categoria_id)?.visibile && quanti(m.categoria_id) > 0))),
    shop_v_categorie: t.shop_categorie.filter((c) => c.visibile && quanti(c.id) > 0).map((c) => ({ id: c.id, slug: c.slug, nome: c.nome, tipo: c.tipo, frase: c.frase, foto_path: c.foto_path, seo_titolo: c.seo_titolo, seo_descrizione: c.seo_descrizione, ordine: c.ordine, visibile: c.visibile, quanti: quanti(c.id) })),
  };
}

export async function prove(mod, { c, gruppo, radice }) {
  const CAT = mod["shop/cms/catalogo.server"];
  const AN = mod["shop/cms/anteprima"];
  const PUB = mod["shop/cms/pubblico"];
  gruppo("NEGOZIO · LE LETTURE PUBBLICHE: SOLO DALLE VISTE, CON MEMORIA BREVE (20/11/2026)");

  let ora = T0;
  const nuovo = ({ modalita = "cms", extra = {}, db: opzDb = {}, porte = {}, modifica = null } = {}) => {
    const t = negozio(modalita);
    modifica?.(t);
    const db = fintoDb({ tabelle: { ...t, ...viste(t), ...extra }, ...opzDb });
    const catalogo = CAT.creaCatalogo({ db, adesso: () => ora, baseMedia: BASE, chiaveServizio: CHIAVE, ...porte });
    return { db, catalogo, t };
  };
  const slugs = (l) => l.map((p) => p.slug);
  const lettiDa = (db, tab) => db.registro.filter((q) => q.tab === tab && q.op === "select").length;

  // ── la modalità e i guasti ──
  ora = T0;
  c("modalità: l'interruttore dice «cms» → cms; «codice» → codice", ["cms", "codice"], [await nuovo({ modalita: "cms" }).catalogo.modalita(), await nuovo({ modalita: "codice" }).catalogo.modalita()]);
  c("modalità: valore strano (testo qualunque, numero, nullo, lista) → codice", ["codice", "codice", "codice", "codice"],
    await Promise.all(["boh", 5, null, ["cms"]].map((v) => nuovo({ modalita: v }).catalogo.modalita())));
  c("modalità: riga assente → codice", "codice", await nuovo({ extra: { shop_impostazioni: [] } }).catalogo.modalita());
  c("modalità: migrazione non applicata (tabella assente, 42P01 o PGRST205) → codice, nessuna eccezione", ["codice", "codice", "codice"],
    await Promise.all([nuovo({ db: { mancante: true } }), nuovo({ db: { mancante: true, codiceMancante: "PGRST205" } }), nuovo({ db: { mancante: ["shop_impostazioni"] } })].map((x) => x.catalogo.modalita())));
  c("modalità: la lettura lancia (rete) → codice", "codice", await nuovo({ db: { errori: { "shop_impostazioni.select": { lancia: new Error("rete") } } } }).catalogo.modalita());
  c("SHOP_CATALOGO_FORZA=cms forza la modalità anche se il database dice «codice» o non risponde", ["cms", "cms"],
    [await nuovo({ modalita: "codice", porte: { forza: "cms" } }).catalogo.modalita(), await nuovo({ db: { mancante: true }, porte: { forza: "cms" } }).catalogo.modalita()]);
  c("…e =codice forza «codice»; un valore strano si ignora", ["codice", "cms"],
    [await nuovo({ modalita: "cms", porte: { forza: "codice" } }).catalogo.modalita(), await nuovo({ modalita: "cms", porte: { forza: "Cms!" } }).catalogo.modalita()]);
  c("la forzatura cambia SOLO la modalità: le bozze restano fuori", false, (await nuovo({ modalita: "codice", porte: { forza: "cms" } }).catalogo.elenco()).some((p) => p.slug === "prodotto-in-bozza"));
  const memoriaModalita = nuovo({ modalita: "cms" });
  await memoriaModalita.catalogo.modalita();
  ora = T0 + 14_000; await memoriaModalita.catalogo.modalita();
  c("modalità: memoria 15 s → una lettura entro 14 s", 1, lettiDa(memoriaModalita.db, "shop_impostazioni"));
  ora = T0 + 16_000; await memoriaModalita.catalogo.modalita();
  c("…e due dopo 16 s", 2, lettiDa(memoriaModalita.db, "shop_impostazioni"));
  ora = T0;
  // un guasto della modalità si ricorda 5 s (non 15): abbastanza per non rileggere a ogni richiesta, poco per tornare appena il database torna
  const modalitaGuasta = nuovo({ db: { mancante: true } });
  await modalitaGuasta.catalogo.modalita(); ora = T0 + 4_000; await modalitaGuasta.catalogo.modalita();
  c("modalità, guasto o migrazione assente: una lettura entro 4 s", 1, lettiDa(modalitaGuasta.db, "shop_impostazioni"));
  ora = T0 + 6_000; await modalitaGuasta.catalogo.modalita();
  c("…e due dopo 6 s (il guasto non resta 15 s)", 2, lettiDa(modalitaGuasta.db, "shop_impostazioni"));
  let giu = true;
  const rientra = nuovo({ db: { errori: { "shop_impostazioni.select": () => (giu ? { error: { code: "XX000" } } : undefined) } } });
  ora = T0; const prima_ = await rientra.catalogo.modalita(); giu = false; ora = T0 + 6_000;
  c("modalità: appena il database torna (dopo 6 s) si legge il valore vero", ["codice", "cms"], [prima_, await rientra.catalogo.modalita()]);
  ora = T0;
  // la lettura dell'interruttore è ESATTAMENTE questa (e solo questa)
  const una = nuovo(); await una.catalogo.modalita();
  const qm = una.db.registro.filter((q) => q.tab === "shop_impostazioni");
  c("l'interruttore: `select(\"valore\")` con `eq(\"chiave\", \"catalogo_sito\")`, una riga sola, una sola lettura", [1, "valore", [["eq", "chiave", "catalogo_sito"]], "maybe"], [qm.length, qm[0].cols, qm[0].filtri, qm[0].singolo]);

  // ── migrazione assente / guasti: niente eccezioni, tutto vuoto ──
  const rotto = (db) => nuovo({ db }).catalogo;
  const vuoti = [];
  for (const db of [{ mancante: true }, { mancante: true, codiceMancante: "PGRST205" }, { mancante: ["shop_v_prodotti"] }, { errori: { "shop_v_prodotti.select": { lancia: new Error("rete") } } }, { errori: { "shop_v_media.select": { error: { code: "XX000" } } } }]) {
    const k = rotto(db);
    try {
      vuoti.push(JSON.stringify([await k.elenco(), await k.scheda("prodotto-di-prova"), await k.categorie(), await k.vociSitemap(), await k.righeCarrello(["PROVA-001-A"])]));
    } catch (e) { vuoti.push(`eccezione: ${e.message}`); }
  }
  const atteso = JSON.stringify([[], null, [], [], [{ sku: "PROVA-001-A", nonPiuDisponibile: true }]]);
  c("migrazione assente o database che risponde male: elenco vuoto, nessuna scheda, nessuna categoria, sitemap vuota, carrello «non più disponibile»; MAI eccezioni", Array(5).fill(atteso), vuoti);
  const guasto = []; { const log = (x) => guasto.push(x); const k = nuovo({ db: { mancante: true }, porte: { log } }).catalogo; await k.elenco(); }
  c("nel log solo codici (mai testi o righe)", true, guasto.every((x) => /^[A-Za-z0-9_.:-]{1,40}$/.test(x)));

  // ── cosa esce ──
  const { catalogo, db } = nuovo();
  const el = await catalogo.elenco();
  c("elenco: solo i pubblicati (la bozza e l'archiviato no)", ["prodotto-di-prova", "altro-prodotto"], slugs(el));
  c("la foto ha l'indirizzo completo (baseMedia) e la giacenza non c'è", [`${BASE}/prova/aaaaaaaaaaaa-960.webp`, false], [el[0].media[0].src.w960, /"giacenza"/.test(JSON.stringify(el))]);
  const sc = await catalogo.scheda("prodotto-di-prova");
  c("scheda per slug: il prodotto, con le sole varianti attive", ["prodotto-di-prova", ["PROVA-001-A"]], [sc?.slug, sc?.varianti.map((v) => v.sku)]);
  c("scheda: bozza, archiviato, slug inesistente, slug storto e valori strani → null", Array(7).fill(null),
    await Promise.all(["prodotto-in-bozza", "prodotto-archiviato", "non-esiste", "A B/..", "", undefined, 42].map((s) => catalogo.scheda(s))));
  c("elenco per categoria: solo i prodotti di quella; categoria sconosciuta → vuoto", [["prodotto-di-prova", "altro-prodotto"], []], [slugs(await catalogo.elenco({ categoria: "categoria-prova" })), slugs(await catalogo.elenco({ categoria: "nessuna" }))]);
  c("ricerca per nome: senza maiuscole, anche a pezzi", [["prodotto-di-prova"], ["prodotto-di-prova"], []], [slugs(await catalogo.elenco({ q: "PRODOTTO DI" })), slugs(await catalogo.elenco({ q: "  provA " })), slugs(await catalogo.elenco({ q: "zzz" }))]);
  const strani = "%_'\";,.*()\\ OR 1=1 --";
  const r = await catalogo.elenco({ q: strani, categoria: strani });
  c("ricerca con segni da query (%, ', ;, ()): nessun errore, nessun risultato", [], r);
  c("il testo cercato non finisce MAI in una query (si filtra in memoria): nessun filtro porta quel testo né usa `or`", [false, false],
    [JSON.stringify(db.registro.map((q) => q.filtri)).includes("OR 1=1"), db.registro.some((q) => q.filtri.some(([tipo]) => tipo === "or"))]);

  // ── le categorie ──
  const cats = await catalogo.categorie();
  c("categorie: solo la visibile con almeno un pubblicato (non la vuota, non la nascosta)", ["categoria-prova"], cats.map((x) => x.slug));
  c("categoria: forma pubblica, con foto e quanti", { slug: "categoria-prova", nome: "Categoria di prova", tipo: "categoria", frase: null, foto: { w480: `${BASE}/cat/a-480.webp`, w960: `${BASE}/cat/a-960.webp`, w1600: `${BASE}/cat/a-1600.webp` }, seo: { titolo: null, descrizione: null }, ordine: 1, quanti: 2 }, cats[0]);
  const avvelenato = nuovo({ extra: { shop_v_categorie: [...viste(negozio()).shop_v_categorie, { id: uuid(0x1ff), slug: "vuota-in-vista", nome: "X", tipo: "categoria", visibile: true, ordine: 0, quanti: 0 }, { id: uuid(0x1fe), slug: "nascosta-in-vista", nome: "Y", tipo: "categoria", visibile: false, ordine: 0, quanti: 5 }] } });
  c("categorie: se per errore la vista mostra una vuota o una nascosta, non escono (difesa doppia)", ["categoria-prova"], (await avvelenato.catalogo.categorie()).map((x) => x.slug));
  c("costruisciCategorie: ordine per `ordine` poi nome; foto solo se ha le tre misure; righe strane scartate", ["a-prima", "b-seconda", "z-ultima"], PUB.costruisciCategorie({
    categorie: [{ id: "1", slug: "z-ultima", nome: "Z", ordine: 9, quanti: 1, visibile: true }, { id: "2", slug: "b-seconda", nome: "B", ordine: 1, quanti: 1, visibile: true }, { id: "3", slug: "a-prima", nome: "A", ordine: 1, quanti: 1, visibile: true }, null, 4, { id: "9", slug: "X Y", nome: "N", quanti: 1, visibile: true }, { id: "8", slug: "senza-visibile", nome: "S", quanti: 1 }],
    media: [{ id: "m", categoria_id: "2", slot: "principale", path_480: "x", path_960: null, path_1600: "z", rimosso_il: null, ritrae_persone: false, liberatoria_ok: false }],
  }).map((x) => x.slug));

  const tre = { path_480: "a", path_960: "b", path_1600: "c" };
  c("costruisciCategorie: la foto è solo la «principale» della categoria, non rimossa, e di nessuna persona senza liberatoria", [null, null, { w480: "a", w960: "b", w1600: "c" }],
    ((r) => ["1", "2", "3"].map((id) => r.find((x) => x.slug === `cat-${id}`).foto))(PUB.costruisciCategorie({
      categorie: ["1", "2", "3"].map((id) => ({ id, slug: `cat-${id}`, nome: id, ordine: 0, quanti: 1, visibile: true })),
      media: [{ id: "m1", categoria_id: "1", slot: "foto2", ...tre, rimosso_il: null, ritrae_persone: false, liberatoria_ok: false }, { id: "m2", categoria_id: "2", slot: "principale", ...tre, rimosso_il: ISTANTE, ritrae_persone: false, liberatoria_ok: false },
        { id: "m3", categoria_id: "3", slot: "principale", ...tre, rimosso_il: null, ritrae_persone: false, liberatoria_ok: false }, { id: "m4", categoria_id: "3", slot: "principale", ordine: -1, rimosso_il: null, ritrae_persone: true, liberatoria_ok: false, path_480: "x", path_960: "y", path_1600: "z" }],
    })));

  // ── una bozza non esce da NESSUNA funzione, nemmeno se la vista sbaglia ──
  const t2 = negozio();
  const v2 = viste(t2);
  v2.shop_v_prodotti.push({ ...t2.shop_prodotti.find((p) => p.slug === "prodotto-in-bozza"), categorie: [{ slug: "categoria-prova", nome: "Categoria di prova" }] });
  v2.shop_v_prodotti.push({ ...t2.shop_prodotti.find((p) => p.slug === "prodotto-archiviato"), categorie: [] });
  v2.shop_v_varianti.push({ ...t2.shop_varianti.find((v) => v.sku === "PROVA-002-A"), disponibile: true }, { ...t2.shop_varianti.find((v) => v.sku === "PROVA-003-A"), disponibile: true });
  const guasta = CAT.creaCatalogo({ db: fintoDb({ tabelle: { ...t2, ...v2 } }), adesso: () => ora, baseMedia: BASE, chiaveServizio: CHIAVE });
  c("vista sbagliata con una bozza e un archiviato dentro: elenco, scheda, sitemap e carrello li tengono fuori",
    [["prodotto-di-prova", "altro-prodotto"], null, null, ["/shop/prodotto/prodotto-di-prova", "/shop/prodotto/altro-prodotto", "/shop/c/categoria-prova"], [{ sku: "PROVA-002-A", nonPiuDisponibile: true }, { sku: "PROVA-003-A", nonPiuDisponibile: true }]],
    [slugs(await guasta.elenco()), await guasta.scheda("prodotto-in-bozza"), await guasta.scheda("prodotto-archiviato"), (await guasta.vociSitemap()).map((x) => x.percorso), await guasta.righeCarrello(["PROVA-002-A", "PROVA-003-A"])]);
  c("sitemap (modalità cms): i pubblicati e la categoria con prodotti; con modalità «codice» è vuota (non si promettono pagine che il sito non serve)", [["/shop/prodotto/prodotto-di-prova", "/shop/prodotto/altro-prodotto", "/shop/c/categoria-prova"], []],
    [(await catalogo.vociSitemap()).map((x) => x.percorso), await nuovo({ modalita: "codice" }).catalogo.vociSitemap()]);

  // un pubblicato che `costruisciPubblico` scarta (prezzo 0) non è in elenco e NON è in sitemap
  const zero = nuovo({ modifica: (t) => {
    t.shop_prodotti.push(prodottoProva({ id: uuid(0x2f1), sku: "PROVA-ZERO", slug: "prezzo-zero", nome: "Prezzo zero", prezzo_cent: 0 }));
    t.shop_varianti.push(varianteProva({ id: uuid(0x3f1), prodotto_id: uuid(0x2f1), sku: "PROVA-ZERO-A", prezzo_cent: null, giacenza: 3 }));
  } });
  c("pubblicato con prezzo 0: fuori dall'elenco, dalla scheda, dal carrello e dalla sitemap (che elenca solo ciò che si mostra)", [false, null, [{ sku: "PROVA-ZERO-A", nonPiuDisponibile: true }], false],
    [slugs(await zero.catalogo.elenco()).includes("prezzo-zero"), await zero.catalogo.scheda("prezzo-zero"), await zero.catalogo.righeCarrello(["PROVA-ZERO-A"]), (await zero.catalogo.vociSitemap()).some((x) => x.percorso.includes("prezzo-zero"))]);
  c("…e la sitemap ha comunque gli altri", true, (await zero.catalogo.vociSitemap()).some((x) => x.percorso === "/shop/prodotto/prodotto-di-prova"));

  // ── il carrello ──
  const rc = await catalogo.righeCarrello(["PROVA-001-A", "PROVA-004-A", "PROVA-001-OFF", "NON-ESISTE", "PROVA-002-A"]);
  c("righeCarrello: nome, prezzo, disponibile, foto e indirizzo per ogni SKU, nell'ordine chiesto", [
    { sku: "PROVA-001-A", nome: "Prodotto di prova", varianteNome: "Unica", prezzoCent: 2890, disponibile: true, foto: { w480: `${BASE}/prova/aaaaaaaaaaaa-480.webp`, w960: `${BASE}/prova/aaaaaaaaaaaa-960.webp`, w1600: `${BASE}/prova/aaaaaaaaaaaa-1600.webp` }, slug: "prodotto-di-prova" },
    { sku: "PROVA-004-A", nome: "Altro prodotto", varianteNome: "Unica", prezzoCent: 3500, disponibile: false, foto: { w480: `${BASE}/prova/aaaaaaaaaaaa-480.webp`, w960: `${BASE}/prova/aaaaaaaaaaaa-960.webp`, w1600: `${BASE}/prova/aaaaaaaaaaaa-1600.webp` }, slug: "altro-prodotto" },
    { sku: "PROVA-001-OFF", nonPiuDisponibile: true }, { sku: "NON-ESISTE", nonPiuDisponibile: true }, { sku: "PROVA-002-A", nonPiuDisponibile: true },
  ], rc);
  c("righeCarrello: la variante spenta è «non più disponibile»; la giacenza non compare", [true, false], [rc[2].nonPiuDisponibile === true, /giacenza|"5"|"9"/.test(JSON.stringify(rc))]);
  const molte = await catalogo.righeCarrello([...Array(80).keys()].map((i) => `X-${i}`));
  c("righeCarrello: al massimo 50 SKU; i doppioni e i valori strani non fanno danni", [50, 1, 0], [molte.length, (await catalogo.righeCarrello(["PROVA-001-A", "PROVA-001-A"])).length, (await catalogo.righeCarrello([null, 4, {}, "", "  "])).length]);
  c("righeCarrello: non un elenco → vuoto", [[], []], [await catalogo.righeCarrello(undefined), await catalogo.righeCarrello("PROVA-001-A")]);

  // ── solo dalle viste (D1) ──
  const pubbliche = nuovo();
  for (const f of [(k) => k.elenco(), (k) => k.elenco({ categoria: "categoria-prova", q: "x" }), (k) => k.scheda("prodotto-di-prova"), (k) => k.scheda("prodotto-in-bozza"), (k) => k.categorie(), (k) => k.vociSitemap(), (k) => k.righeCarrello(["PROVA-001-A"]), (k) => k.modalita()]) await f(pubbliche.catalogo);
  const lette = [...new Set(pubbliche.db.registro.map((q) => q.tab))].sort();
  c("a catalogo spento o acceso, senza chiave: le uniche tabelle lette sono le 4 viste e `shop_impostazioni` (l'interruttore)", ["shop_impostazioni", "shop_v_categorie", "shop_v_media", "shop_v_prodotti", "shop_v_varianti"], lette);
  c("…e mai una scrittura", 0, pubbliche.db.registro.filter((q) => q.op !== "select").length);

  // ── la chiave d'anteprima ──
  const bozzaSlug = "prodotto-in-bozza";
  const K = await AN.emettiChiaveAnteprima(CHIAVE, bozzaSlug, T0);
  const ap = nuovo();
  const conChiave = await ap.catalogo.scheda(bozzaSlug, K);
  c("chiave valida: la bozza esce, con `anteprima.nascosti`", [bozzaSlug, true], [conChiave?.slug, Array.isArray(conChiave?.anteprima?.nascosti)]);
  c("chiave valida: la bozza si legge dalle TABELLE (e solo qui)", true, ["shop_prodotti", "shop_varianti"].every((t) => lettiDa(ap.db, t) >= 1));
  const prima = lettiDa(ap.db, "shop_prodotti");
  await ap.catalogo.scheda(bozzaSlug, K);
  c("la chiave NON passa dalla memoria breve: due richieste = due letture", prima + 1, lettiDa(ap.db, "shop_prodotti"));
  c("…e non sporca quella pubblica: senza chiave la stessa scheda è «non trovata», l'elenco non la ha", [null, false], [await ap.catalogo.scheda(bozzaSlug), (await ap.catalogo.elenco()).some((p) => p.slug === bozzaSlug)]);
  const cattive = [["scaduta (+25 h)", K, T0 + 25 * ORE], ["di un altro slug", await AN.emettiChiaveAnteprima(CHIAVE, "altra-bozza", T0), T0], ["alterata", `${K.slice(0, -1)}${K.endsWith("0") ? "1" : "0"}`, T0], ["vuota", "", T0], ["strana", { x: 1 }, T0], ["di un'altra chiave di servizio", await AN.emettiChiaveAnteprima("altra-chiave", bozzaSlug, T0), T0]];
  const esiti = [];
  for (const [, chiave, quando] of cattive) { ora = quando; esiti.push(await nuovo().catalogo.scheda(bozzaSlug, chiave)); }
  ora = T0;
  c("chiave scaduta, di un altro slug, alterata, vuota, strana o di un'altra chiave di servizio: «non trovato»", cattive.map(() => null), esiti);
  c("senza chiave di servizio nelle porte la chiave non apre niente (e non lancia)", null, await nuovo({ porte: { chiaveServizio: null } }).catalogo.scheda(bozzaSlug, K));
  c("chiave valida per un archiviato: no; per un pubblicato: la scheda pubblicata (con `anteprima`, noindex)", [null, "prodotto-di-prova", true],
    await (async () => { const Ka = await AN.emettiChiaveAnteprima(CHIAVE, "prodotto-archiviato", T0); const Kp = await AN.emettiChiaveAnteprima(CHIAVE, "prodotto-di-prova", T0); const k = nuovo().catalogo; const s = await k.scheda("prodotto-di-prova", Kp); return [await k.scheda("prodotto-archiviato", Ka), s?.slug, Array.isArray(s?.anteprima?.nascosti)]; })());
  c("pubblicato con chiave sbagliata: la scheda pubblica normale (senza `anteprima`)", [true, false], await (async () => { const s = await nuovo().catalogo.scheda("prodotto-di-prova", "1.abc"); return [s?.slug === "prodotto-di-prova", s?.anteprima !== undefined]; })());

  // ── la memoria breve ──
  ora = T0;
  const m = nuovo();
  await m.catalogo.elenco(); ora = T0 + 29_000; await m.catalogo.elenco(); await m.catalogo.scheda("prodotto-di-prova"); await m.catalogo.categorie(); await m.catalogo.vociSitemap(); await m.catalogo.righeCarrello(["PROVA-001-A"]);
  c("stessa lettura entro 30 s = UNA sola lettura delle viste (elenco, scheda, categorie, sitemap e carrello la condividono)", [1, 1, 1, 1], ["shop_v_prodotti", "shop_v_varianti", "shop_v_media", "shop_v_categorie"].map((t) => lettiDa(m.db, t)));
  ora = T0 + 31_000; await m.catalogo.elenco();
  c("dopo 31 s sono due", 2, lettiDa(m.db, "shop_v_prodotti"));
  // bozza → pubblicato: visibile entro 60 s
  ora = T0; const cambio = nuovo();
  c("prima: la bozza non c'è", false, (await cambio.catalogo.elenco()).some((p) => p.slug === bozzaSlug));
  const tt = cambio.t; tt.shop_prodotti.find((p) => p.slug === bozzaSlug).stato = "pubblicato";
  const nv = viste(tt); for (const k of Object.keys(nv)) cambio.db.tabelle[k].splice(0, cambio.db.tabelle[k].length, ...nv[k]);
  ora = T0 + 10_000;
  c("dopo 10 s la memoria la tiene ancora nascosta", false, (await cambio.catalogo.elenco()).some((p) => p.slug === bozzaSlug));
  ora = T0 + 60_000;
  c("entro 60 s è visibile (30 s di memoria + 30 s del CDN)", true, (await cambio.catalogo.elenco()).some((p) => p.slug === bozzaSlug));
  // un guasto si ricorda 5 s (non 30, non 15): con il database giù non si rifanno 4 letture a ogni richiesta
  ora = T0; let n = 0;
  const g = nuovo({ db: { errori: { "shop_v_prodotti.select": () => (n++ === 0 ? { error: { code: "XX000" } } : undefined) } } });
  const a1 = await g.catalogo.elenco(); ora = T0 + 3_000; const a2 = await g.catalogo.elenco();
  c("un guasto si ricorda per 5 s: la lettura subito dopo non riprova (e non lancia)", [0, 0, 1], [a1.length, a2.length, lettiDa(g.db, "shop_v_prodotti")]);
  ora = T0 + 6_000; const a3 = await g.catalogo.elenco();
  c("…dopo 6 s riprova e, se il database è tornato, riesce", [2, 2], [a3.length, lettiDa(g.db, "shop_v_prodotti")]);
  ora = T0;
  const giuTutto = nuovo({ db: { mancante: true }, porte: { forza: "cms" } });
  for (let i = 0; i < 20; i++) { ora = T0 + i * 100; await giuTutto.catalogo.elenco(); await giuTutto.catalogo.scheda("prodotto-di-prova"); await giuTutto.catalogo.righeCarrello(["PROVA-001-A"]); await giuTutto.catalogo.categorie(); }
  c("con SHOP_CATALOGO_FORZA=cms e il database giù: 60 richieste in 2 s fanno UNA sola lettura per vista (non 4 per richiesta)", [1, 1, 1, 1], ["shop_v_prodotti", "shop_v_varianti", "shop_v_media", "shop_v_categorie"].map((t) => lettiDa(giuTutto.db, t)));
  ora = T0 + 6_000; await giuTutto.catalogo.elenco();
  c("…e dopo 6 s si riprova (una seconda lettura)", 2, lettiDa(giuTutto.db, "shop_v_prodotti"));
  ora = T0;

  // ── scheda: «non trovato» o «guasto»? ──
  const es = async (x, ...a) => (await x.catalogo.schedaEsito(...a)).esito;
  const sano = nuovo();
  c("schedaEsito: trovato (con il prodotto), non trovato (bozza, archiviato, sconosciuto, slug storto, vuoto)", ["trovato", "prodotto-di-prova", "non_trovato", "non_trovato", "non_trovato", "non_trovato", "non_trovato"],
    [await es(sano, "prodotto-di-prova"), (await sano.catalogo.schedaEsito("prodotto-di-prova")).prodotto?.slug, await es(sano, "prodotto-in-bozza"), await es(sano, "prodotto-archiviato"), await es(sano, "non-esiste"), await es(sano, "A B/.."), await es(sano, "")]);
  c("schedaEsito: database giù, errore di una vista o rete che lancia → «guasto» (non «non trovato»)", ["guasto", "guasto", "guasto"],
    [await es(nuovo({ db: { mancante: true } }), "prodotto-di-prova"), await es(nuovo({ db: { errori: { "shop_v_media.select": { error: { code: "XX000" } } } } }), "prodotto-di-prova"), await es(nuovo({ db: { errori: { "shop_v_prodotti.select": { lancia: new Error("rete") } } } }), "prodotto-di-prova")]);
  const Kb = await AN.emettiChiaveAnteprima(CHIAVE, "prodotto-in-bozza", T0);
  c("schedaEsito con la chiave: bozza trovata; chiave valida ma tabelle giù → «guasto»; chiave sbagliata e viste giù → «guasto»; chiave sbagliata e tutto ok → «non trovato»", ["trovato", "guasto", "guasto", "non_trovato"],
    [await es(nuovo(), "prodotto-in-bozza", Kb), await es(nuovo({ db: { errori: { "shop_prodotti.select": { lancia: new Error("rete") } } } }), "prodotto-in-bozza", Kb), await es(nuovo({ db: { mancante: true } }), "prodotto-in-bozza", "1.abc"), await es(nuovo(), "prodotto-in-bozza", "1.abc")]);
  c("`scheda` resta com'era: il prodotto, oppure `null` (anche per un guasto: chi vuole distinguere usa `schedaEsito`)", ["prodotto-di-prova", null, null], [(await sano.catalogo.scheda("prodotto-di-prova"))?.slug, await sano.catalogo.scheda("prodotto-in-bozza"), await nuovo({ db: { mancante: true } }).catalogo.scheda("prodotto-di-prova")]);
  const sorg = (f) => readFileSync(join(radice, f), "utf8");

  // ── prova di sorgente: nessuna lettura pubblica nomina una tabella ──
  gruppo("NEGOZIO · IL SORGENTE: NESSUNA TABELLA FUORI DALL'ANTEPRIMA (20/11/2026)");
  const server = sorg("src/shop/cms/catalogo.server.ts");
  const INIZIO = "«TABELLE-INIZIO»", FINE = "«TABELLE-FINE»";
  c("il percorso dell'anteprima è delimitato da due segnaposto, uno per uno", [1, 1], [server.split(INIZIO).length - 1, server.split(FINE).length - 1]);
  const dentro = server.slice(server.indexOf(INIZIO), server.indexOf(FINE));
  const codice = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const nomi = (s) => [...new Set(codice(s).match(/\bshop_[a-z_]+/g) ?? [])].sort();
  const fuori = nomi(server.slice(0, server.indexOf(INIZIO)) + server.slice(server.indexOf(FINE)));
  c("fuori dal percorso dell'anteprima il server pubblico nomina solo le 4 viste e `shop_impostazioni`", ["shop_impostazioni", "shop_v_categorie", "shop_v_media", "shop_v_prodotti", "shop_v_varianti"], fuori);
  c("dentro il percorso dell'anteprima nomina le tabelle (il segnaposto delimita davvero qualcosa)", true, ["shop_prodotti", "shop_varianti", "shop_media"].every((t) => nomi(dentro).includes(t)));
  c("il percorso dell'anteprima è raggiunto solo dopo `verificaChiaveAnteprima`", true, /verificaChiaveAnteprima[\s\S]{0,400}leggiPerAnteprima/.test(codice(server)));
  c("`anteprima: {slug}` si passa in UN solo punto (dentro il percorso delle tabelle) e `leggiPerAnteprima` si chiama in UN solo punto, dopo `verificaChiaveAnteprima`", [1, 2],
    [(codice(server).match(/anteprima:\s*\{/g) ?? []).length, (codice(server).match(/leggiPerAnteprima\(/g) ?? []).length]);
  c("l'`anteprima: {slug}` sta dentro il segnaposto delle tabelle", true, /anteprima:\s*\{/.test(codice(dentro)));
  c("`baseMedia` si passa SEMPRE: ogni costruisciPubblico e costruisciCategorie del server la riceve", true,
    codice(server).split(/costruisci(?:Pubblico|Categorie)\(/).slice(1).every((resto) => /^[^;]{0,260}baseMedia/.test(resto)));
  c("sorgente: la lettura dell'interruttore è ESATTAMENTE `select(\"valore\")` + `eq(\"chiave\", \"catalogo_sito\")` + `maybeSingle()`, e `shop_impostazioni` si nomina una volta sola", [1, 1],
    [(codice(server).match(/\.from\("shop_impostazioni"\)\s*\.select\("valore"\)\s*\.eq\("chiave", "catalogo_sito"\)\s*\.maybeSingle\(\)/g) ?? []).length, (codice(server).match(/shop_impostazioni/g) ?? []).length]);
  c("le tabelle non si scrivono mai: nessun insert, update, upsert, delete né rpc", false, /\.(insert|update|upsert|delete|rpc)\(/.test(codice(server)));
  const funzioni = sorg("src/shop/cms/catalogo.functions.ts");
  c("l'involucro delle funzioni non nomina nessuna tabella", [], nomi(funzioni));
  c("l'involucro: sei funzioni, memoria `public, max-age=30`, e senza memoria (`no-store`) per l'anteprima", [6, true, true], [(funzioni.match(/createServerFn\(/g) ?? []).length, /public, max-age=30/.test(funzioni), /data\.chiave \|\| r\.esito === "guasto" \? "private, no-store" : "public, max-age=30"/.test(funzioni)]);
  c("l'involucro legge SHOP_CATALOGO_FORZA solo se c'è, e il client del server lo importa a richiesta (mai a livello di modulo)", [true, true, false],
    [/SHOP_CATALOGO_FORZA/.test(funzioni), /await import\("@\/integrations\/supabase\/client\.server"\)/.test(funzioni), /^import .*client\.server/m.test(funzioni)]);
  c("nessuna chiave scritta nel codice", false, /(?:eyJ[A-Za-z0-9_-]{20,}|sb_secret_|service_role\s*[:=]\s*["'])/.test(server + funzioni));
}
