/** ── NEGOZIO · T07 · DALLE RIGHE DEL DATABASE AI TIPI DEL MODELLO ───────────
 *  `src/shop/cms/righe.ts`: l'UNICO punto in cui le colonne snake_case di S1 diventano i tipi camelCase del modello.
 *  Valgono per le righe delle tabelle (tutte le colonne) e per quelle delle viste (meno colonne).
 *  ⚠️ Le colonne di FILTRO (`stato`, `attiva`, `visibile`, `liberatoria_ok`, `ritrae_persone`, `rimosso_il`) fanno CHIUDERE la
 *  riga se mancano: una dimenticata non deve mai far uscire una bozza, una variante spenta o una foto senza liberatoria.
 *  Una prova legge la migrazione S1 e controlla che le viste le abbiano tutte. Dati inventati (`dati.mjs`). */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ISTANTE, categoriaProva, mediaProva, prodottoProva, uuid, varianteProva } from "./dati.mjs";

export async function prove(mod, { c, gruppo, radice }) {
  const R = mod["shop/cms/righe"];
  gruppo("NEGOZIO · LE RIGHE DEL DATABASE → I TIPI DEL MODELLO (20/11/2026)");

  // ── prodotto ──
  const tab = R.prodottoDaRiga(prodottoProva({
    reso_consentito: true, reso_giorni: 14, box_consulenza: true, gtin: "8012345678905", correlato_id: uuid(0x201), peso_g: 120, classe_spedizione: "piccola",
    canali: { sito: true, meta: true, google: "sì", tiktok: false }, seo_titolo: "T", origine: "codice", id_codice: "vecchio-1",
    contenuto: { passi: ["Uno", " ", 3], confezione: ["Vasetto"], avvertenze: [], faq: [{ d: "D?", r: "R." }, { d: "solo domanda" }] },
    bozza_modifiche: { nome: "Nuovo" }, bozza_modificata_il: ISTANTE,
    caratteristiche: [{ etichetta: "A", valore: "1", stato: "confermato", fonte: "x" }, { etichetta: "B", valore: "2", stato: "boh" }, { etichetta: "", valore: "3" }],
  }));
  c("prodotto (tabella): identità, stato, prezzo", ["00000000-0000-4000-8000-000000000200", "PROVA-001", "prodotto-di-prova", "Prodotto di prova", "cura", "pubblicato", 2890],
    [tab.id, tab.sku, tab.slug, tab.nome, tab.tipo, tab.stato, tab.prezzoCent]);
  c("prodotto: le colonne snake_case diventano camelCase", ["Marca Finta", null, "Una descrizione breve inventata.", true, 14, true, uuid(0x201), 120, "piccola", "8012345678905", "T", "codice", "vecchio-1", "Fornitore Finto", "nota interna inventata"],
    [tab.marca, tab.rigaPresentazione, tab.descrizioneBreve, tab.resoConsentito, tab.resoGiorni, tab.boxConsulenza, tab.correlatoId, tab.pesoG, tab.classeSpedizione, tab.gtin, tab.seoTitolo, tab.origine, tab.idCodice, tab.fornitore, tab.noteInterne]);
  c("prodotto: il contenuto si apre in passi, confezione, avvertenze, faq (solo testi e coppie complete)", [["Uno"], ["Vasetto"], [], [{ d: "D?", r: "R." }]], [tab.passi, tab.confezione, tab.avvertenze, tab.faq]);
  c("prodotto: caratteristiche con lo stato («boh» = da confermare; senza etichetta = scartata)", [{ etichetta: "A", valore: "1", stato: "confermato", fonte: "x" }, { etichetta: "B", valore: "2", stato: "da_confermare", fonte: null }], tab.caratteristiche);
  c("prodotto: i canali sono booleani veri (solo `true` è sì)", { sito: true, meta: true, google: false, tiktok: false }, tab.canali);
  c("prodotto: la bozza di modifica passa com'è, e la data", [{ nome: "Nuovo" }, ISTANTE], [tab.bozzaModifiche, tab.bozzaModificataIl]);

  // una vista: meno colonne (ma `stato` c'è: è una colonna di filtro)
  const vista = { id: uuid(0x200), sku: "PROVA-001", slug: "prodotto-di-prova", nome: "Prodotto di prova", tipo: "cura", stato: "pubblicato", prezzo_cent: 2890, descrizione_breve: "x", aggiornato_il: ISTANTE };
  const v = R.prodottoDaRiga(vista);
  c("prodotto (vista): le colonne private che non porta sono neutre", ["pubblicato", null, null, null, null, "", false, true],
    [v.stato, v.fornitore, v.noteInterne, v.bozzaModifiche, v.idCodice, v.creatoIl, v.canali.sito, v.canali.sito === v.canali.meta]);
  const { stato: _s, ...senzaStato } = vista;
  c("prodotto SENZA `stato` (colonna di filtro dimenticata) → null: mai «pubblicato» per default", [null, null], [R.prodottoDaRiga(senzaStato), R.prodottoDaRiga({ ...vista, stato: undefined })]);
  c("prodotto: lo stato scritto conta (bozza e archiviato restano tali)", ["bozza", "archiviato"], [R.prodottoDaRiga({ ...vista, stato: "bozza" }).stato, R.prodottoDaRiga({ ...vista, stato: "archiviato" }).stato]);
  const storti = [
    ["non è un oggetto", null], ["non è un oggetto (testo)", "x"], ["non è un oggetto (lista)", []],
    ["senza id", { ...vista, id: undefined }], ["senza SKU", { ...vista, sku: "" }], ["senza nome", { ...vista, nome: "  " }],
    ["slug non valido", { ...vista, slug: "Con Spazi" }], ["tipo sconosciuto", { ...vista, tipo: "x" }],
    ["stato fuori elenco", { ...vista, stato: "x" }], ["stato nullo (non è «manca»)", { ...vista, stato: null }],
    ["prezzo mancante", { ...vista, prezzo_cent: null }], ["prezzo negativo", { ...vista, prezzo_cent: -1 }], ["prezzo con la virgola", { ...vista, prezzo_cent: 12.5 }], ["prezzo testo", { ...vista, prezzo_cent: "1000" }],
  ];
  c("prodotto: righe inservibili → null, mai un'eccezione", storti.map(() => null), storti.map(([, riga]) => R.prodottoDaRiga(riga)));
  c("prodotto: un prezzo 0 è un prezzo (la bozza può averlo)", 0, R.prodottoDaRiga({ ...vista, prezzo_cent: 0 }).prezzoCent);

  // ── variante ──
  const va = R.varianteDaRiga(varianteProva({ giacenza: 5, opzioni: { Colore: "Nero", Vuota: "  ", Numero: 3 }, prezzo_cent: 1500, peso_g: 30 }));
  c("variante (tabella): campi in camelCase, opzioni solo con testo, giacenza vera", [uuid(0x200), "PROVA-001-A", "Unica", { Colore: "Nero" }, 1500, 5, 30, true, true],
    [va.prodottoId, va.sku, va.nome, va.opzioni, va.prezzoCent, va.giacenza, va.pesoG, va.attiva, va.disponibile]);
  c("variante: giacenza 0 → non disponibile; spenta con giacenza → non disponibile", [false, false],
    [R.varianteDaRiga(varianteProva({ giacenza: 0 })).disponibile, R.varianteDaRiga(varianteProva({ giacenza: 9, attiva: false })).disponibile]);
  c("variante: senza prezzo proprio → `null` (vale quello del prodotto)", null, R.varianteDaRiga(varianteProva({ prezzo_cent: null })).prezzoCent);
  const dallaVista = (({ giacenza, ...resto }) => resto)(varianteProva());
  c("variante (vista): senza giacenza → `null` e `disponibile` dalla colonna; mai un numero inventato", [null, true, false],
    [R.varianteDaRiga({ ...dallaVista, disponibile: true }).giacenza, R.varianteDaRiga({ ...dallaVista, disponibile: true }).disponibile, R.varianteDaRiga({ ...dallaVista, disponibile: false }).disponibile]);
  c("variante SENZA `attiva` (colonna dimenticata): spenta e non disponibile, anche se la vista dice `disponibile`; solo `true` accende", [false, false, false, false, true],
    [R.varianteDaRiga({ ...dallaVista, attiva: undefined, disponibile: true }).attiva, R.varianteDaRiga({ ...dallaVista, attiva: undefined, disponibile: true }).disponibile,
      R.varianteDaRiga({ ...dallaVista, attiva: null, disponibile: true }).attiva, R.varianteDaRiga({ ...dallaVista, attiva: "true", disponibile: true }).attiva, R.varianteDaRiga({ ...dallaVista, attiva: true, disponibile: true }).attiva]);
  c("variante: un prezzo PROPRIO storto (negativo, con virgola, testo) → null, non ripiega sul prodotto", [null, null, null],
    [-5, 12.5, "10"].map((p) => R.varianteDaRiga(varianteProva({ prezzo_cent: p }))));
  c("variante: senza id, prodotto o SKU → null; e non lancia con righe strane", [null, null, null, null, null],
    [varianteProva({ id: undefined }), varianteProva({ prodotto_id: null }), varianteProva({ sku: "" }), 7, undefined].map((x) => R.varianteDaRiga(x)));

  // ── media ──
  const m = R.mediaDaRiga(mediaProva({ slot: "foto2", sotto_ruolo: "macro_attaccatura", ritrae_persone: true, liberatoria_ok: true, valore_opzione: "Nero", ordine: 3, creato_il: ISTANTE, sottotitoli_ok: true }));
  c("media (tabella): campi in camelCase", ["foto2", "macro_attaccatura", "foto", "prova/aaaaaaaaaaaa-480.webp", "Foto di prova del prodotto", true, true, "Nero", 3, null, null, uuid(0x200)],
    [m.slot, m.sottoRuolo, m.tipo, m.path480, m.alt, m.ritraePersone, m.liberatoriaOk, m.valoreOpzione, m.ordine, m.rimossoIl, null, m.prodottoId]);
  c("media: il video è video anche se `tipo` dice altro; un sotto-ruolo sconosciuto → null", ["video", null],
    [R.mediaDaRiga(mediaProva({ slot: "video", tipo: "foto" })).tipo, R.mediaDaRiga(mediaProva({ sotto_ruolo: "boh" })).sottoRuolo]);
  // le colonne di filtro dei media, una alla volta: se una manca la foto resta fuori
  const senza = (...colonne) => { const r = mediaProva(); for (const k of colonne) delete r[k]; return r; };
  c("media SENZA `rimosso_il` (colonna dimenticata) → null: vale come rimossa", [null, null], [R.mediaDaRiga(senza("rimosso_il")), R.mediaDaRiga({ ...mediaProva(), rimosso_il: undefined })]);
  c("media SENZA `ritrae_persone`: ritrae (e senza liberatoria non esce); `false` scritto la libera; `null` o testo non la liberano", [true, false, true, true],
    [R.mediaDaRiga(senza("ritrae_persone")).ritraePersone, R.mediaDaRiga(mediaProva({ ritrae_persone: false })).ritraePersone, R.mediaDaRiga(mediaProva({ ritrae_persone: null })).ritraePersone, R.mediaDaRiga(mediaProva({ ritrae_persone: "false" })).ritraePersone]);
  c("media SENZA `liberatoria_ok`: non c'è liberatoria; solo `true` scritto vale", [false, false, false, true],
    [R.mediaDaRiga(senza("liberatoria_ok")).liberatoriaOk, R.mediaDaRiga(mediaProva({ liberatoria_ok: null })).liberatoriaOk, R.mediaDaRiga(mediaProva({ liberatoria_ok: "true" })).liberatoriaOk, R.mediaDaRiga(mediaProva({ liberatoria_ok: true })).liberatoriaOk]);
  const { creato_il, ...dallaVistaMedia } = mediaProva();
  c("media (vista com'è: con tutte le colonne di filtro, senza `creato_il`): si legge, non è rimosso, la liberatoria c'è solo se scritta", [true, null, false], [R.mediaDaRiga(dallaVistaMedia) !== null, R.mediaDaRiga(dallaVistaMedia).rimossoIl, R.mediaDaRiga(dallaVistaMedia).liberatoriaOk]);
  c("media: `liberatoria_ok:false` scritto resta falso (anche `null`)", [false, false], [R.mediaDaRiga(mediaProva({ liberatoria_ok: false })).liberatoriaOk, R.mediaDaRiga(mediaProva({ liberatoria_ok: null })).liberatoriaOk]);
  c("media: la rimozione si vede", ISTANTE, R.mediaDaRiga(mediaProva({ rimosso_il: ISTANTE })).rimossoIl);
  c("media: slot sconosciuto, senza id o non oggetto → null", [null, null, null], [mediaProva({ slot: "boh" }), mediaProva({ id: "" }), "x"].map((x) => R.mediaDaRiga(x)));

  // ── categoria ──
  const ca = R.categoriaDaRiga(categoriaProva({ tipo: "collezione", frase: "Una frase", foto_path: "prova/c.webp", ordine: 4, pubblicata_il: ISTANTE }));
  c("categoria (tabella): campi in camelCase", ["categoria-prova", "Categoria di prova", "collezione", "Una frase", "prova/c.webp", 4, true, ISTANTE],
    [ca.slug, ca.nome, ca.tipo, ca.frase, ca.fotoPath, ca.ordine, ca.visibile, ca.pubblicataIl]);
  c("categoria: `visibile` vale solo se è `true`; mancante, `false`, `null` o testo → nascosta", [false, false, false, false, true],
    [R.categoriaDaRiga(categoriaProva({ visibile: false })).visibile, R.categoriaDaRiga(categoriaProva({ visibile: undefined })).visibile, R.categoriaDaRiga(categoriaProva({ visibile: null })).visibile, R.categoriaDaRiga(categoriaProva({ visibile: "true" })).visibile, R.categoriaDaRiga(categoriaProva({ visibile: true })).visibile]);
  c("categoria: tipo strano → «categoria»; slug non valido, senza nome o non oggetto → null", ["categoria", null, null, null],
    [R.categoriaDaRiga(categoriaProva({ tipo: "x" })).tipo, R.categoriaDaRiga(categoriaProva({ slug: "A B" })), R.categoriaDaRiga(categoriaProva({ nome: "" })), R.categoriaDaRiga(5)]);

  // ── le viste di S1 portano TUTTE le colonne di filtro (altrimenti questa chiusura le farebbe sparire) ──
  const FILE = "supabase/migrations/20261120120000_shop_catalogo.sql";
  let sql = null;
  if (existsSync(join(radice, FILE))) sql = readFileSync(join(radice, FILE), "utf8");
  else {
    try { sql = execFileSync("git", ["show", `shop-r1-b:${FILE}`], { cwd: radice, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { /* ramo assente */ }
  }
  if (sql === null) console.log(`  --  SALTATA: le viste di S1 hanno le colonne di filtro (${FILE} non c'è su questo ramo né su shop-r1-b)`);
  else {
    const FILTRO = { shop_v_prodotti: ["stato"], shop_v_varianti: ["attiva"], shop_v_media: ["ritrae_persone", "liberatoria_ok", "rimosso_il"], shop_v_categorie: ["visibile"] };
    const mancanti = [];
    for (const [vista, colonne] of Object.entries(FILTRO)) {
      const m = new RegExp(`CREATE OR REPLACE VIEW public\\.${vista} AS\\s+SELECT([\\s\\S]*?)\\nFROM`).exec(sql);
      if (!m) { mancanti.push(`${vista}: vista non trovata`); continue; }
      for (const col of colonne) if (!new RegExp(`(\\.${col}\\b|\\bAS ${col}\\b)`).test(m[1])) mancanti.push(`${vista}.${col}`);
    }
    c("la migrazione S1: ognuna delle 4 viste espone TUTTE le sue colonne di filtro (stato, attiva, ritrae_persone, liberatoria_ok, rimosso_il, visibile)", [], mancanti);
    c("(il metodo funziona: una vista senza `rimosso_il` verrebbe segnalata)", ["shop_v_media.rimosso_il"],
      (() => { const finta = sql.replace(/\n\s*m\.rimosso_il\n/, "\n"); const m = /CREATE OR REPLACE VIEW public\.shop_v_media AS\s+SELECT([\s\S]*?)\nFROM/.exec(finta); return /(\.rimosso_il\b|\bAS rimosso_il\b)/.test(m[1]) ? [] : ["shop_v_media.rimosso_il"]; })());
  }
}
