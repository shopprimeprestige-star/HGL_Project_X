/** ── EDITOR PRODOTTI · E4 · IL SERVER DEI PRODOTTI, PARTE ADDITIVA ──────────────────────────────────────────────
 *  `src/crm/negozio/prodotti.server.ts`: `prodotto_crea` esteso (campi, categorie, variante «Unica» con giacenza e costo),
 *  `variante_salva` col costo, `schedaProdotto()` con `costi` e `costoDisponibile`, `prodotto_duplica` che copia il costo.
 *  Il database è il finto (`_finto-db.mjs`): nessuna rete, nessuna chiave, nessuna migrazione vera.
 *  `senzaColonne: { shop_varianti: ["costo_cent"] }` = la migrazione del costo NON è ancora applicata.
 *  `prodotti-server.mjs` resta com'è: qui si prova solo ciò che è nuovo. Dati inventati. */
import { fintoDb } from "./_finto-db.mjs";
import { mediaProva, prodottoProva, tabelleProva, uuid, varianteProva } from "./dati.mjs";
import { leggi as leggiG, post as postG, porte as porteG } from "./_server.mjs";

const P1 = uuid(0x200); // pubblicato, completo (variante PROVA-001-A)
const ADESSO = new Date("2026-11-20T12:00:00.000Z");
const CAT = uuid(0x100);
const FRASE_COSTO = "Per il costo serve un aggiornamento del database";
const SENZA_COSTO = { shop_varianti: ["costo_cent"] };

export async function prove(mod, { c, gruppo }) {
  const S = mod["negozio/prodotti.server"];
  const G = mod["negozio/giacenza.server"];
  const R = mod["shop/cms/righe"];
  const PUB = mod["shop/cms/pubblico"];
  gruppo("EDITOR PRODOTTI · E4 · IL SERVER, PARTE ADDITIVA (25/11/2026)");

  const richiesta = (url, corpo) =>
    new Request(`https://crm.example.com/api/crm/negozio${url}`, corpo === undefined ? { method: "GET" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  const dip = (db) => { const log = []; return { log, d: { guardia: async () => ({ ok: true, nome: "Giulia Esempio" }), db, adesso: () => ADESSO, log: (x) => log.push(x), chiaveServizio: () => "chiave-di-prova" } }; };
  const leggi = async (r) => ({ stato: r.status, json: await r.json() });
  const POST = async (db, corpo) => { const x = dip(db); return { ...(await leggi(await S.gestisciPOST(richiesta("", corpo), x.d))), log: x.log }; };
  const GET = async (db, url) => { const x = dip(db); return { ...(await leggi(await S.gestisciGET(richiesta(url), x.d))), log: x.log }; };
  /** Le tabelle di partenza (la colonna del costo presente: la sua assenza si prova con `senzaColonne`). */
  const tab = (...mut) => { const t = tabelleProva(); t.shop_varianti.forEach((v) => { v.costo_cent = null; }); mut.forEach((m) => m(t)); return t; };
  const nuovo = (extra = {}) => ({ azione: "prodotto_crea", nome: "Spray Prova", tipo: "cura", sku: "HG-E01", slug: "spray-prova", ...extra });
  const completa = {
    campi: { prezzoCent: 1990, descrizioneBreve: "Una descrizione breve inventata.", pesoG: 120, gtin: "8012345678905", canali: { sito: true, meta: false, google: false, tiktok: false } },
    categorie: [CAT],
    variante: { giacenza: 10, costoCent: 1040 },
  };
  const righeDi = (db, t) => db.tabelle[t];
  const QUESTA_PROVA = (db) => db.tabelle.shop_prodotti.find((p) => p.sku === "HG-E01");

  // ── «Salva bozza» completo: prodotto, variante Unica, carico, categoria, costo ──
  {
    const db = fintoDb({ tabelle: tab() });
    const r = await POST(db, nuovo(completa));
    const p = QUESTA_PROVA(db);
    const vs = righeDi(db, "shop_varianti").filter((v) => v.prodotto_id === p?.id);
    const mov = righeDi(db, "shop_giacenza_movimenti");
    c("prodotto_crea completo → ok, in bozza, prezzo del prodotto 1990, senza «parziale»", [200, true, "bozza", 1990, false], [r.stato, r.json.ok, p?.stato, p?.prezzo_cent, "parziale" in r.json]);
    c("…i campi vanno sul PRODOTTO: peso, barcode, descrizione breve", [120, "8012345678905", "Una descrizione breve inventata."], [p?.peso_g, p?.gtin, p?.descrizione_breve]);
    c("…una sola variante «Unica»: SKU = quello del prodotto, prezzo vuoto, attiva, costo 1040, giacenza 10",
      [1, "HG-E01", "Unica", null, true, 1040, 10], [vs.length, vs[0]?.sku, vs[0]?.nome, vs[0]?.prezzo_cent, vs[0]?.attiva, vs[0]?.costo_cent, vs[0]?.giacenza]);
    c("…la Unica NON prende prezzo, peso né barcode (valgono quelli del prodotto)", [null, null], [vs[0]?.peso_g, vs[0]?.gtin]);
    c("…un movimento «carico» di +10 col nome di chi chiama", [1, 10, "carico", "Giulia Esempio", vs[0]?.id], [mov.length, mov[0]?.delta, mov[0]?.motivo, mov[0]?.chi, mov[0]?.variante_id]);
    c("…la categoria è legata", [[CAT]], [righeDi(db, "shop_prodotti_categorie").filter((x) => x.prodotto_id === p?.id).map((x) => x.categoria_id)]);
    c("…lo storico dice «creato» e chi", [true, "Giulia Esempio"], [righeDi(db, "shop_storico").some((x) => x.campo === "creato" && x.entita_id === p?.id), righeDi(db, "shop_storico").find((x) => x.campo === "creato")?.chi]);
    c("…la risposta porta prodotto, versione, storico e la variante creata", [true, "HG-E01", true], [r.json.prodotto?.sku === "HG-E01", r.json.variante?.sku, r.json.storico]);
    c("…nel database vero la bozza è nata UNA volta sola", 1, righeDi(db, "shop_prodotti").filter((x) => x.sku === "HG-E01").length);
  }

  // ── la richiesta vecchia (nome, tipo, sku, slug) resta identica a oggi ──
  {
    const db = fintoDb({ tabelle: tab() });
    const prima = { v: righeDi(db, "shop_varianti").length, m: righeDi(db, "shop_giacenza_movimenti").length, k: righeDi(db, "shop_prodotti_categorie").length };
    const r = await POST(db, { azione: "prodotto_crea", nome: "Spray Districante", tipo: "cura", sku: "HG-N01" });
    c("richiesta vecchia: bozza, indirizzo dal nome, prezzo 0, e le stesse chiavi di risposta di oggi", [true, "bozza", "spray-districante", 0, ["ok", "prodotto", "storico", "versione"]],
      [r.json.ok, r.json.prodotto?.stato, r.json.prodotto?.slug, r.json.prodotto?.prezzoCent, Object.keys(r.json).sort()]);
    c("…nessuna variante, nessun movimento, nessuna categoria", [prima.v, prima.m, prima.k], [righeDi(db, "shop_varianti").length, righeDi(db, "shop_giacenza_movimenti").length, righeDi(db, "shop_prodotti_categorie").length]);
    c("…e non guarda nemmeno se il costo c'è (nessuna lettura di `costo_cent`)", false, db.registro.some((q) => JSON.stringify(q).includes("costo_cent")));
  }

  // ── i tre controlli PRIMA del primo insert: nessuna riga nuova, mai una bozza orfana ──
  {
    const casi = [
      ["SKU già usato da un prodotto", nuovo({ sku: "PROVA-001", ...completa }), 409, /^Lo SKU “PROVA-001” è già usato da un altro prodotto\.$/],
      ["indirizzo già usato", nuovo({ slug: "prodotto-di-prova", ...completa }), 409, /^Questo SKU o questo indirizzo è già usato da un altro prodotto\.$/],
      ["SKU uguale a quello di una VARIANTE di un altro prodotto (PROVA-001-A)", nuovo({ sku: "PROVA-001-A", ...completa }), 409, /SKU/],
      ["categoria che non esiste", nuovo({ ...completa, categorie: [uuid(0x999)] }), 400, /categoria/i],
    ];
    for (const [nome, corpo, stato, frase] of casi) {
      const db = fintoDb({ tabelle: tab() });
      const prima = { p: righeDi(db, "shop_prodotti").length, v: righeDi(db, "shop_varianti").length };
      const r = await POST(db, corpo);
      c(`${nome} → ${stato} e NESSUNA scrittura, nessuna riga nuova`, [stato, false, 0, prima.p, prima.v, true],
        [r.stato, r.json.ok, db.scritture.length, righeDi(db, "shop_prodotti").length, righeDi(db, "shop_varianti").length, frase.test(r.json.frase)]);
    }
    // la frase per SKU e indirizzo è quella di oggi
    const db = fintoDb({ tabelle: tab() });
    const sku = await POST(db, nuovo({ sku: "PROVA-001" }));
    const slug = await POST(db, nuovo({ slug: "prodotto-di-prova" }));
    c("SKU doppio: la frase di oggi con lo SKU; indirizzo doppio: quella del database di oggi", ["Lo SKU “PROVA-001” è già usato da un altro prodotto.", "Questo SKU o questo indirizzo è già usato da un altro prodotto."], [sku.json.frase, slug.json.frase]);
    // frase giusta per ogni caso delle categorie (un elemento che non è un id non è «più di 10»)
    const frasi = [];
    for (const categorie of [["../x"], Array.from({ length: 11 }, (_, i) => uuid(0x100 + i))]) frasi.push((await POST(fintoDb({ tabelle: tab() }), nuovo({ ...completa, categorie }))).json.frase);
    c("categorie: un elemento non valido e più di 10 danno la stessa frase giusta", ["Le categorie non sono valide (al massimo 10).", "Le categorie non sono valide (al massimo 10)."], frasi);
  }

  // ── il costo (valore 4242, riconoscibile) non esce da nessuna risposta di scrittura: né la chiave né il numero ──
  // Decisione: nella SPEC e nel PIANO il costo è letto dalla scheda del CRM (`schedaProdotto().costi`, provata sotto); le risposte di
  // `prodotto_crea` e `variante_salva` non lo ridanno (passano da `varianteDaRiga`, che non lo copia), quindi il divieto vale anche per loro.
  {
    const db = fintoDb({ tabelle: tab() });
    const crea = await POST(db, nuovo({ ...completa, variante: { giacenza: 10, costoCent: 4242 } }));
    const vs = await POST(db, { azione: "variante_salva", prodottoId: P1, variante: { id: uuid(0x300), costoCent: 4242 } });
    const nuova = await POST(db, { azione: "variante_salva", prodottoId: P1, variante: { sku: "PROVA-001-K", nome: "K", costoCent: 4242 } });
    const dove = [["prodotto_crea", crea], ["variante_salva (esistente)", vs], ["variante_salva (nuova)", nuova]];
    c("…le scritture sono andate a buon fine (il costo c'è nel database)", [true, true, true, 4242], [crea.json.ok, vs.json.ok, nuova.json.ok, righeDi(db, "shop_varianti").find((v) => v.sku === "HG-E01")?.costo_cent]);
    for (const [nome, r] of dove) c(`${nome}: la risposta non contiene «costo» né 4242`, [false, false], [/costo/i.test(JSON.stringify(r.json)), JSON.stringify(r.json).includes("4242")]);
  }

  // ── tutto si controlla PRIMA di scrivere: richieste storte, nessuna scrittura ──
  {
    const storte = [
      ["un campo che non si può dare (stato)", { ...completa, campi: { stato: "pubblicato" } }],
      ["un campo che non si può dare (correlatoId)", { ...completa, campi: { correlatoId: P1 } }],
      ["un campo che non si può dare (seoMediaId)", { ...completa, campi: { seoMediaId: P1 } }],
      ["il nome dentro `campi` (ha il suo posto)", { ...completa, campi: { nome: "Altro" } }],
      ["un prezzo con la virgola", { ...completa, campi: { prezzoCent: 19.9 } }],
      ["un testo con uno sconto", { ...completa, campi: { descrizioneBreve: "Sconto del 20% solo oggi" } }],
      ["box consulenza su una cura", { ...completa, campi: { boxConsulenza: true } }],
      ["`campi` non è un oggetto", { ...completa, campi: ["a"] }],
      ["più di 10 categorie", { ...completa, categorie: Array.from({ length: 11 }, (_, i) => uuid(0x100 + i)) }],
      ["categorie non è un elenco", { ...completa, categorie: CAT }],
      ["una categoria che non è un id", { ...completa, categorie: ["../x"] }],
      ["giacenza negativa", { ...completa, variante: { giacenza: -1 } }],
      ["giacenza con la virgola", { ...completa, variante: { giacenza: 1.5 } }],
      ["giacenza oltre il tetto", { ...completa, variante: { giacenza: 2_000_000 } }],
      ["giacenza scritta come testo", { ...completa, variante: { giacenza: "10" } }],
      ["costo negativo", { ...completa, variante: { costoCent: -5 } }],
      ["costo con la virgola", { ...completa, variante: { costoCent: 10.4 } }],
      ["costo oltre il tetto", { ...completa, variante: { costoCent: 3_000_000_000 } }],
      ["un campo della variante che non c'è (prezzoCent)", { ...completa, variante: { prezzoCent: 100 } }],
      ["`variante` non è un oggetto", { ...completa, variante: 5 }],
    ];
    for (const [nome, extra] of storte) {
      const db = fintoDb({ tabelle: tab() });
      const r = await POST(db, nuovo(extra));
      c(`${nome} → 400, nessuna scrittura`, [400, 0], [r.stato, db.scritture.length]);
    }
  }

  // ── costo senza migrazione: la frase, e nessuna scrittura; senza costo, tutto funziona ──
  {
    const db = fintoDb({ tabelle: tab(), senzaColonne: SENZA_COSTO });
    const r = await POST(db, nuovo(completa));
    c("prodotto_crea con costo e colonna assente → la frase del costo, 409, nessuna scrittura", [409, false, true, 0], [r.stato, r.json.ok, r.json.frase?.startsWith(FRASE_COSTO), db.scritture.length]);
    const db2 = fintoDb({ tabelle: tab(), senzaColonne: SENZA_COSTO });
    const senza = await POST(db2, nuovo({ ...completa, variante: { giacenza: 10 } }));
    const v = righeDi(db2, "shop_varianti").find((x) => x.sku === "HG-E01");
    c("…senza il costo, a migrazione non applicata, «Salva bozza» funziona (Unica con giacenza 10, nessuna colonna `costo_cent`)", [true, 10, false], [senza.json.ok, v?.giacenza, "costo_cent" in (v ?? {})]);
    const db3 = fintoDb({ tabelle: tab(), senzaColonne: SENZA_COSTO });
    const nullo = await POST(db3, nuovo({ ...completa, variante: { giacenza: 10, costoCent: null } }));
    c("…un costo `null` (nessun costo) non chiede la migrazione", true, nullo.json.ok);
  }

  // ── un guasto DOPO il primo insert: ok:true con `parziale`, mai un 500 ──
  {
    const guasto = { error: { code: "XX000", message: "guasto" } };
    const prova = async (nome, errori, atteso, extra = {}) => {
      const db = fintoDb({ tabelle: tab(), errori });
      const r = await POST(db, nuovo({ ...completa, ...extra }));
      c(`guasto su ${nome} → ok:true col prodotto creato e parziale ${JSON.stringify(atteso)}`, [200, true, atteso, 1], [r.stato, r.json.ok, r.json.parziale, righeDi(db, "shop_prodotti").filter((x) => x.sku === "HG-E01").length]);
      return { db, r };
    };
    const a = await prova("la variante", { "shop_varianti.insert": guasto }, ["variante", "giacenza"]);
    c("…senza variante non si prova a caricare la giacenza (nessun movimento)", 0, righeDi(a.db, "shop_giacenza_movimenti").length);
    const b = await prova("il carico di giacenza", { "rpc.shop_giacenza_muovi": guasto }, ["giacenza"]);
    c("…la variante c'è, la categoria anche", [1, 1], [righeDi(b.db, "shop_varianti").filter((x) => x.sku === "HG-E01").length, righeDi(b.db, "shop_prodotti_categorie").filter((x) => x.prodotto_id !== P1).length]);
    await prova("la categoria", { "shop_prodotti_categorie.insert": guasto }, ["categorie"]);
    const s = await prova("lo storico", { "shop_storico.insert": guasto }, undefined);
    c("…uno storico che non si scrive resta `storico:false`, come oggi", false, s.r.json.storico);
    const log = (await prova("la variante", { "shop_varianti.insert": { error: { code: "XX000", message: "guasto: cliente Anna Esempio" } } }, ["variante", "giacenza"])).r;
    c("…la risposta non contiene il messaggio del database", false, JSON.stringify(log.json).includes("Anna"));
  }

  // ── il costo: scrivere, leggere, confrontare col valore grezzo ──
  {
    const VAR = uuid(0x300);
    const scheda = async (db) => (await GET(db, `?prodotto=${P1}`)).json;
    const db = fintoDb({ tabelle: tab() });
    const r = await POST(db, { azione: "variante_salva", prodottoId: P1, variante: { id: VAR, costoCent: 450 } });
    const sc = await scheda(db);
    c("variante_salva col costo → scritto nella colonna e restituito da schedaProdotto (`costi`)", [true, 450, { [VAR]: 450 }, true], [r.json.ok, righeDi(db, "shop_varianti").find((v) => v.id === VAR).costo_cent, sc.costi, sc.costoDisponibile]);
    c("…lo storico della variante dice campo, prima (null) e dopo (450), e chi", [{ campo: "costoCent", prima: null, dopo: 450, chi: "Giulia Esempio" }],
      [righeDi(db, "shop_storico").filter((x) => x.campo === "costoCent").map(({ campo, prima, dopo, chi }) => ({ campo, prima, dopo, chi }))[0]]);
    c("…la variante nella scheda NON ha il costo dentro (sta solo in `costi`)", false, JSON.stringify(sc.varianti).includes("costo"));
    const stesso = fintoDb({ tabelle: tab((t) => { t.shop_varianti.find((v) => v.id === VAR).costo_cent = 450; }) });
    const r2 = await POST(stesso, { azione: "variante_salva", prodottoId: P1, variante: { id: VAR, costoCent: 450 } });
    c("lo stesso costo (confronto col valore grezzo) → ok, nessuna scrittura, nessuna riga di storico", [true, 0, 0], [r2.json.ok, stesso.scritture.length, righeDi(stesso, "shop_storico").length]);
    const zero = await POST(fintoDb({ tabelle: tab() }), { azione: "variante_salva", prodottoId: P1, variante: { id: VAR, costoCent: 0 } });
    c("costo 0 è un costo (omaggio): ammesso", true, zero.json.ok);
    const azzera = fintoDb({ tabelle: tab((t) => { t.shop_varianti.find((v) => v.id === VAR).costo_cent = 450; }) });
    await POST(azzera, { azione: "variante_salva", prodottoId: P1, variante: { id: VAR, costoCent: null } });
    c("costo `null` toglie il costo e lo storico lo dice", [null, { prima: 450, dopo: null }], [righeDi(azzera, "shop_varianti").find((v) => v.id === VAR).costo_cent, ((x) => ({ prima: x?.prima, dopo: x?.dopo }))(righeDi(azzera, "shop_storico").find((x) => x.campo === "costoCent"))]);
    for (const [nome, v] of [["negativo", -1], ["con la virgola", 4.5], ["testo", "4,50"], ["oltre il tetto", 3_000_000_000]]) {
      const d = fintoDb({ tabelle: tab() });
      const x = await POST(d, { azione: "variante_salva", prodottoId: P1, variante: { id: VAR, costoCent: v } });
      c(`costo ${nome} → 400, nessuna scrittura`, [400, 0], [x.stato, d.scritture.length]);
    }
    const nuova = fintoDb({ tabelle: tab() });
    const vn = await POST(nuova, { azione: "variante_salva", prodottoId: P1, variante: { sku: "PROVA-001-N", nome: "Nuova", costoCent: 99 } });
    c("una variante NUOVA nasce col suo costo", [true, 99], [vn.json.ok, righeDi(nuova, "shop_varianti").find((v) => v.sku === "PROVA-001-N")?.costo_cent]);
    const vnn = fintoDb({ tabelle: tab(), senzaColonne: SENZA_COSTO });
    const senzaCosto = await POST(vnn, { azione: "variante_salva", prodottoId: P1, variante: { sku: "PROVA-001-N", nome: "Nuova", costoCent: null } });
    c("…un costo `null` su una variante nuova non chiede la migrazione", [true, false], [senzaCosto.json.ok, "costo_cent" in (righeDi(vnn, "shop_varianti").find((v) => v.sku === "PROVA-001-N") ?? {})]);
  }

  // ── il costo senza migrazione: spento con la frase, il resto funziona ──
  {
    const VAR = uuid(0x300);
    const db = fintoDb({ tabelle: tab(), senzaColonne: SENZA_COSTO });
    const sc = (await GET(db, `?prodotto=${P1}`)).json;
    c("scheda senza la colonna: ok, costoDisponibile false, costi vuoto", [true, false, {}], [sc.ok, sc.costoDisponibile, sc.costi]);
    const r = await POST(db, { azione: "variante_salva", prodottoId: P1, variante: { id: VAR, costoCent: 450 } });
    c("variante_salva con un costo vero → la frase «Per il costo serve un aggiornamento del database», 409, nessuna scrittura", [409, false, true, 0], [r.stato, r.json.ok, r.json.frase?.startsWith(FRASE_COSTO), db.scritture.length]);
    const nullo = await POST(db, { azione: "variante_salva", prodottoId: P1, variante: { id: VAR, costoCent: null, gtin: "123" } });
    c("…un costo `null` insieme ad altro si salva (non c'è niente da scrivere sul costo)", [true, "123"], [nullo.json.ok, righeDi(db, "shop_varianti").find((v) => v.id === VAR).gtin]);
    const altro = await POST(db, { azione: "variante_salva", prodottoId: P1, variante: { id: VAR, pesoG: 80 } });
    c("…e senza costo, variante_salva funziona come prima", [true, 80], [altro.json.ok, righeDi(db, "shop_varianti").find((v) => v.id === VAR).peso_g]);
    const elenco = await GET(db, "?prodotti");
    c("…l'elenco non cambia", [true, 2], [elenco.json.ok, elenco.json.prodotti.length]);
    const guasto = fintoDb({ tabelle: tab(), errori: { "shop_varianti.select": { error: { code: "XX000", message: "guasto" } } } });
    c("un guasto vero nel leggere il costo non si scambia per «migrazione mancante»: 500", 500, (await GET(guasto, `?prodotto=${P1}`)).stato);
  }

  // ── il giro intero (criteri 2 e 3): scrivo SKU, barcode, peso, prezzo, costo, giacenza; ricarico: gli stessi valori ──
  {
    const VAR = uuid(0x300);
    const db = fintoDb({ tabelle: tab() });
    const r = await POST(db, { azione: "variante_salva", prodottoId: P1, variante: { id: VAR, sku: "PROVA-001-Z", gtin: "8012345678905", pesoG: 250, prezzoCent: 2000, costoCent: 1040 } });
    const gp = porteG({ db });
    const g = await leggiG(await G.gestisciPOST(postG({ azione: "giacenza_muovi", varianteId: VAR, delta: 7, motivo: "carico" }), gp.d));
    const sc = (await GET(db, `?prodotto=${P1}`)).json;
    const v = sc.varianti.find((x) => x.id === VAR);
    c("variante_salva + giacenza_muovi, poi schedaProdotto(): SKU, barcode, peso, prezzo, giacenza e costo sono quelli scritti",
      [true, true, "PROVA-001-Z", "8012345678905", 250, 2000, 12, 1040, true], [r.json.ok, g.corpo.ok, v?.sku, v?.gtin, v?.pesoG, v?.prezzoCent, v?.giacenza, sc.costi[VAR], sc.costoDisponibile]);
  }

  // ── prodotto_duplica copia il costo, se la colonna c'è ──
  {
    const VAR = uuid(0x300);
    const db = fintoDb({ tabelle: tab((t) => { t.shop_varianti.find((v) => v.id === VAR).costo_cent = 450; }) });
    const r = await POST(db, { azione: "prodotto_duplica", prodottoId: P1, sku: "PROVA-009" });
    const copie = righeDi(db, "shop_varianti").filter((v) => v.prodotto_id === r.json.prodotto?.id);
    c("prodotto_duplica: le varianti copiate hanno lo stesso costo, la giacenza resta 0", [true, [450], [0]], [r.json.ok, copie.map((v) => v.costo_cent), copie.map((v) => v.giacenza)]);
    const senza = fintoDb({ tabelle: tab(), senzaColonne: SENZA_COSTO });
    const rs = await POST(senza, { azione: "prodotto_duplica", prodottoId: P1, sku: "PROVA-009" });
    const cs = righeDi(senza, "shop_varianti").filter((v) => v.prodotto_id === rs.json.prodotto?.id);
    c("…a migrazione non applicata la copia funziona e non scrive la colonna", [true, 1, false], [rs.json.ok, cs.length, cs.some((v) => "costo_cent" in v)]);
    const senzaValore = fintoDb({ tabelle: tab() });
    const rn = await POST(senzaValore, { azione: "prodotto_duplica", prodottoId: P1, sku: "PROVA-009" });
    c("…un costo non scritto resta non scritto nella copia", [true, [null]], [rn.json.ok, righeDi(senzaValore, "shop_varianti").filter((v) => v.prodotto_id === rn.json.prodotto?.id).map((v) => v.costo_cent)]);
  }

  // ── il costo non esce mai verso il sito ──
  {
    const COSTO = 31337;
    const riga = varianteProva({ costo_cent: COSTO });
    const letta = R.varianteDaRiga(riga);
    c("varianteDaRiga: una riga col costo non lascia traccia nel risultato (né «costo» né il numero)", [true, false, false], [letta?.sku === "PROVA-001-A", JSON.stringify(letta).includes("costo"), JSON.stringify(letta).includes(String(COSTO))]);
    const t = tab((x) => { x.shop_varianti.find((v) => v.id === uuid(0x300)).costo_cent = COSTO; });
    const pubblici = PUB.costruisciPubblico({ prodotti: t.shop_prodotti, varianti: t.shop_varianti, media: t.shop_media, categorie: t.shop_categorie, prodottiCategorie: t.shop_prodotti_categorie }, { baseMedia: "https://media.prova.test/shop" });
    const testo = JSON.stringify(pubblici);
    c("costruisciPubblico: il prodotto c'è, e nel risultato serializzato non ci sono né «costo» né il numero", [true, false, false], [pubblici.length > 0, /costo/i.test(testo), testo.includes(String(COSTO))]);
    const db = fintoDb({ tabelle: t });
    const elenco = JSON.stringify((await GET(db, "?prodotti")).json);
    c("l'elenco del CRM non porta il costo", [false, false], [/costo/i.test(elenco), elenco.includes(String(COSTO))]);
  }

  // ── le regole di pubblicazione di prima non cambiano ──
  {
    const VAR = uuid(0x300);
    const db = fintoDb({ tabelle: tab() });
    const r = await POST(db, { azione: "variante_salva", prodottoId: P1, variante: { id: VAR, costoCent: 500 } });
    const p = righeDi(db, "shop_prodotti").find((x) => x.id === P1);
    c("il costo su un prodotto PUBBLICATO si salva subito e non lo sposta (resta pubblicato, nessuna bozza di modifica)", [true, "pubblicato", null], [r.json.ok, p.stato, p.bozza_modifiche]);
    // un prodotto creato con la scheda nuova segue le regole di oggi: senza foto non si pubblica
    const nuovoDb = fintoDb({ tabelle: tab() });
    const cr = await POST(nuovoDb, nuovo({ ...completa, campi: { ...completa.campi } }));
    const pub = await POST(nuovoDb, { azione: "prodotto_stato", prodottoId: cr.json.prodotto?.id, stato: "pubblicato" });
    c("un prodotto appena creato non si pubblica senza foto principale (stessa frase di oggi)", [422, "Manca la foto principale: il prodotto resta in bozza."], [pub.stato, pub.json.frase]);
    const conFoto = tab();
    const dbF = fintoDb({ tabelle: conFoto });
    const cr2 = await POST(dbF, nuovo({ ...completa }));
    righeDi(dbF, "shop_media").push(mediaProva({ id: uuid(0x4f0), prodotto_id: cr2.json.prodotto?.id }));
    const pub2 = await POST(dbF, { azione: "prodotto_stato", prodottoId: cr2.json.prodotto?.id, stato: "pubblicato" });
    c("…con la foto e i dati di «Salva bozza» (prezzo 1990, categoria, Unica attiva) si pubblica", [200, true, "pubblicato"], [pub2.stato, pub2.json.ok, righeDi(dbF, "shop_prodotti").find((x) => x.id === cr2.json.prodotto?.id)?.stato]);
    // creare un prodotto con prezzo 0 non lo rende pubblicabile
    const zero = fintoDb({ tabelle: tab() });
    const cz = await POST(zero, nuovo({ campi: { descrizioneBreve: "Una descrizione breve inventata.", canali: completa.campi.canali }, categorie: [CAT], variante: { giacenza: 3 } }));
    righeDi(zero, "shop_media").push(mediaProva({ id: uuid(0x4f1), prodotto_id: cz.json.prodotto?.id }));
    const pz = await POST(zero, { azione: "prodotto_stato", prodottoId: cz.json.prodotto?.id, stato: "pubblicato" });
    c("prezzo 0 (non scritto) → non si pubblica, come oggi: manca solo il prezzo", [422, ["prezzo"]], [pz.stato, pz.json.bloccanti?.map((b) => b.campo)]);
  }

  // ── il sorgente: nessuna cancellazione, il costo solo nel server del CRM, `rpc` nella porta ──
  {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const fonte = readFileSync(join(process.cwd(), "src/crm/negozio/prodotti.server.ts"), "utf8");
    c("sorgente: nessun `.delete(`, nessun `console` (il resto lo guarda prodotti-server.mjs)", [false, false], [/\.delete\(/.test(fonte), /console\./.test(fonte)]);
    c("sorgente: il carico passa dalla funzione SQL (`shop_giacenza_muovi`), mai da una scrittura diretta della giacenza", [true, false], [fonte.includes('"shop_giacenza_muovi"'), /giacenza:\s*(delta|v\.giacenza \+)/.test(fonte)]);
    c("sorgente: `p_chi` è il nome di chi chiama (`c.chi`), mai il corpo", true, /p_chi:\s*c\.chi/.test(fonte));
  }
}
