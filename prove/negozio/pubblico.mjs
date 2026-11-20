/** ── NEGOZIO · T07 · DAL DATABASE AL PUBBLICO ──────────────────────────────
 *  `src/shop/cms/pubblico.ts` (righe → `ProdottoPubblico`), `json-ld.ts` (dati strutturati), `sitemap.ts`,
 *  `anteprima.ts` (la chiave dell'anteprima, 24 ore, legata allo slug).
 *  Dati inventati (`dati.mjs`). Le righe sono quelle delle VISTE `shop_v_*` (senza giacenza, con `disponibile`)
 *  oppure quelle delle TABELLE (solo in anteprima, con la giacenza vera): il pubblico non deve vedere né una né l'altra
 *  cosa che non è nel contratto. La giacenza ha un numero strano (7341) per poterlo cercare in tutto il JSON. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ISTANTE, categoriaProva, mediaProva, prodottoProva, uuid, varianteProva } from "./dati.mjs";

const BASE = "https://media.prova.test/storage/shop-media";
const CHIAVE = "chiave-di-servizio-di-prova";
const ORA = Date.parse(ISTANTE);
const ORE = 3600 * 1000;

/** Tutte le chiavi di un JSON, a qualunque profondità (con il percorso, per dire dove). */
function chiavi(x, percorso = "", fuori = []) {
  if (Array.isArray(x)) x.forEach((v, i) => chiavi(v, `${percorso}[${i}]`, fuori));
  else if (x && typeof x === "object")
    for (const [k, v] of Object.entries(x)) {
      fuori.push({ k, percorso: `${percorso}.${k}` });
      chiavi(v, `${percorso}.${k}`, fuori);
    }
  return fuori;
}
const VIETATE = new Set([
  "giacenza", "stato", "bozza_modifiche", "bozzaModifiche", "liberatoria_ok", "liberatoriaOk", "note_interne", "noteInterne",
  "fornitore", "scheda_tecnica", "schedaTecnica", "schedaTecnicaPath", "scheda_tecnica_path", "nota_titolare", "notaTitolare",
  "origine", "id_codice", "idCodice", "costo", "canali", "rimosso_il", "rimossoIl", "ritrae_persone", "ritraePersone",
]);
const vietate = (x) => chiavi(x).filter(({ k }) => VIETATE.has(k) || /_id$|[a-z]Id$/.test(k)).map((r) => r.percorso);

/** Una foto con i tre percorsi di quel nome. */
const pf = (n) => ({ path_480: `prova/${n}-480.webp`, path_960: `prova/${n}-960.webp`, path_1600: `prova/${n}-1600.webp` });

/** Le righe come le restituiscono le TABELLE (giacenza vera, tutte le colonne): servono in anteprima. */
function righeTabelle() {
  const P1 = uuid(0x200), P2 = uuid(0x201), P3 = uuid(0x202), P4 = uuid(0x203), P5 = uuid(0x204);
  const V1a = uuid(0x300), V1b = uuid(0x301), V1c = uuid(0x302);
  return {
    prodotti: [
      prodottoProva({
        id: P1, sku: "PROVA-001", slug: "prodotto-di-prova", nome: "Prodotto di prova", correlato_id: P4, costo: 999,
        caratteristiche: [
          { etichetta: "Formato", valore: "100 ml", stato: "confermato", fonte: "prova" },
          { etichetta: "Spessore", valore: "0,03 mm", stato: "da_confermare", fonte: "vecchio catalogo" },
          { etichetta: "Origine", valore: "Altro", stato: "Confermato", fonte: null },
        ],
        contenuto: { passi: ["Passo uno", "Passo due", 7], confezione: ["Un vasetto"], avvertenze: [], faq: [{ d: "Domanda?", r: "Risposta." }, { d: "senza risposta" }] },
        seo_titolo: "Titolo SEO", seo_descrizione: "Descrizione SEO", reso_consentito: true, reso_giorni: 14, box_consulenza: true,
        gtin: "8012345678905", note_interne: "NOTA-INTERNA-SEGRETA", fornitore: "FORNITORE-SEGRETO",
        bozza_modifiche: { nome: "NOME-DELLA-BOZZA", descrizioneBreve: "Testo della bozza", caratteristiche: [{ etichetta: "Nuova", valore: "Sì", stato: "confermato" }] },
      }),
      prodottoProva({ id: P2, sku: "PROVA-002", slug: "prodotto-in-bozza", nome: "Prodotto in bozza", stato: "bozza", pubblicato_il: null,
        caratteristiche: [{ etichetta: "Formato", valore: "50 ml", stato: "da_confermare", fonte: null }, { etichetta: "Colore", valore: "Nero", stato: "da_confermare", fonte: null }] }),
      prodottoProva({ id: P3, sku: "PROVA-003", slug: "prodotto-archiviato", nome: "Prodotto archiviato", stato: "archiviato" }),
      prodottoProva({ id: P4, sku: "PROVA-004", slug: "altro-prodotto", nome: "Altro prodotto", prezzo_cent: 3500 }),
      prodottoProva({ id: P5, sku: "PROVA-005", slug: "altra-bozza", nome: "Un'altra bozza", stato: "bozza", pubblicato_il: null }),
    ],
    varianti: [
      varianteProva({ id: V1a, prodotto_id: P1, sku: "PROVA-001-NE-30", nome: "Nero / 30", opzioni: { Lunghezza: "30", Colore: "Nero" }, prezzo_cent: null, giacenza: 7341, ordine: 1 }),
      varianteProva({ id: V1b, prodotto_id: P1, sku: "PROVA-001-BI-30", nome: "Biondo / 30", opzioni: { Lunghezza: "30", Colore: "Biondo" }, prezzo_cent: 1500, giacenza: 0, ordine: 2 }),
      varianteProva({ id: V1c, prodotto_id: P1, sku: "PROVA-001-RO-40", nome: "Rosso / 40", opzioni: { Lunghezza: "40", Colore: "Rosso" }, prezzo_cent: 100, giacenza: 5, attiva: false, ordine: 3 }),
      varianteProva({ id: uuid(0x303), prodotto_id: P2, sku: "PROVA-002-A", giacenza: 4 }),
      varianteProva({ id: uuid(0x304), prodotto_id: P3, sku: "PROVA-003-A", giacenza: 4 }),
      varianteProva({ id: uuid(0x305), prodotto_id: P4, sku: "PROVA-004-A", prezzo_cent: null, giacenza: 9 }),
      varianteProva({ id: uuid(0x306), prodotto_id: P5, sku: "PROVA-005-A", giacenza: 4 }),
    ],
    categorie: [categoriaProva(), categoriaProva({ id: uuid(0x101), slug: "categoria-nascosta", nome: "Nascosta", visibile: false })],
    prodottiCategorie: [{ prodotto_id: P1, categoria_id: uuid(0x100) }, { prodotto_id: P1, categoria_id: uuid(0x101) }, { prodotto_id: P4, categoria_id: uuid(0x100) }],
    media: [
      mediaProva({ id: uuid(0x410), prodotto_id: P1, slot: "video", tipo: "foto", path_480: null, path_960: null, path_1600: null, path_video: "prova/v.mp4", path_copertina: "prova/c.webp", testo_parlato: "Parlato", ordine: 1, alt: "Video di prova" }),
      mediaProva({ id: uuid(0x411), prodotto_id: P1, slot: "foto4", ...pf("cccccccccccc"), ritrae_persone: true, liberatoria_ok: true, sotto_ruolo: "macro_attaccatura", ordine: 4, alt: "Con persona e liberatoria" }),
      mediaProva({ id: uuid(0x412), prodotto_id: P1, slot: "foto2", ritrae_persone: true, liberatoria_ok: false, ordine: 2, alt: "SENZA-LIBERATORIA" }),
      mediaProva({ id: uuid(0x413), prodotto_id: P1, slot: "foto3", rimosso_il: ISTANTE, ordine: 3, alt: "RIMOSSA" }),
      mediaProva({ id: uuid(0x414), prodotto_id: P1, slot: "scala", ...pf("bbbbbbbbbbbb"), ordine: 5, alt: "Foto di scala" }),
      mediaProva({ id: uuid(0x415), prodotto_id: P1, slot: "principale", ordine: 9, alt: "Foto principale" }),
      mediaProva({ id: uuid(0x416), prodotto_id: P1, variante_id: V1a, slot: "campione", valore_opzione: "Nero", path_960: null, path_1600: null, ordine: 1, alt: "Campione nero" }),
      mediaProva({ id: uuid(0x417), prodotto_id: null, categoria_id: uuid(0x100), slot: "principale", alt: "Foto di una categoria" }),
      mediaProva({ id: uuid(0x418), prodotto_id: P4, slot: "principale", alt: "Foto dell'altro prodotto" }),
    ],
  };
}

/** Le stesse righe come le restituiscono le VISTE: niente giacenza, `disponibile` già calcolato, niente colonne private. */
function righeViste() {
  const t = righeTabelle();
  const PRIVATE = ["costo", "note_interne", "fornitore", "bozza_modifiche", "bozza_modificata_il", "id_codice", "origine", "canali", "mpn", "categoria_google",
    "peso_g", "classe_spedizione", "scheda_tecnica_path", "nota_titolare", "creato_il"];
  return {
    prodotti: t.prodotti.filter((p) => p.stato === "pubblicato").map((p) => {
      const v = { ...p, categorie: [{ slug: "categoria-prova", nome: "Categoria di prova" }] };
      for (const k of PRIVATE) delete v[k];
      return v;
    }),
    varianti: t.varianti
      .filter((v) => t.prodotti.find((p) => p.id === v.prodotto_id).stato === "pubblicato")
      .map(({ giacenza, creato_il, aggiornato_il, peso_g, ...v }) => ({ ...v, disponibile: giacenza > 0 && v.attiva })),
    media: t.media.filter((m) => !m.rimosso_il && (!m.ritrae_persone || m.liberatoria_ok)),
  };
}

export async function prove(mod, { c, gruppo, radice }) {
  const PUB = mod["shop/cms/pubblico"];
  const LD = mod["shop/cms/json-ld"];
  const SM = mod["shop/cms/sitemap"];
  const AN = mod["shop/cms/anteprima"];
  const opz = { baseMedia: BASE };
  const trova = (lista, slug) => lista.find((p) => p.slug === slug);

  // ═════════════════════════════ 1 · costruisciPubblico ═════════════════════════════
  gruppo("NEGOZIO · IL PUBBLICO: SOLO CIÒ CHE È NEL CONTRATTO (20/11/2026)");

  const viste = PUB.costruisciPubblico(righeViste(), opz);
  const tab = PUB.costruisciPubblico(righeTabelle(), opz); // senza anteprima: stessa uscita anche dalle tabelle
  c("tra 1 pubblicato, 1 altro pubblicato, 2 bozze e 1 archiviato escono solo i due pubblicati", ["prodotto-di-prova", "altro-prodotto"], tab.map((p) => p.slug));
  c("dalle viste (senza giacenza) l'uscita è identica a quella dalle tabelle", JSON.stringify(tab), JSON.stringify(viste));
  c("una riga che dice «bozza» o «archiviato» non esce nemmeno se arriva dalle viste per errore", ["altro-prodotto"],
    PUB.costruisciPubblico({ ...righeViste(), prodotti: righeViste().prodotti.map((p) => (p.slug === "prodotto-di-prova" ? { ...p, stato: "bozza" } : p)) }, opz).map((p) => p.slug));

  const P = trova(tab, "prodotto-di-prova");
  const COLONNE = ["sku", "slug", "nome", "marca", "tipo", "rigaPresentazione", "descrizioneBreve", "descrizioneLunga", "perChi", "caratteristiche", "passi", "confezione",
    "avvertenze", "faq", "categorie", "media", "opzioni", "varianti", "prezzoDaCent", "reso", "boxConsulenza", "correlato", "seo", "gtin", "aggiornatoIl"];
  c("le chiavi del prodotto sono ESATTAMENTE quelle del contratto §3.1 (e nessuna `anteprima`)", [...COLONNE].sort(), Object.keys(P).sort());

  // la giacenza e le chiavi vietate, in profondità, in TUTTE le uscite
  const tutto = JSON.stringify(tab);
  c("la giacenza numerica (7341) non compare in nessun punto dell'intero JSON", false, /7341/.test(tutto));
  c("nessuna chiave vietata o «_id» a nessuna profondità (varianti, media, opzioni, categorie, correlato…)", [], vietate(tab));
  c("la variante esaurita ha disponibile:false e nient'altro sulla giacenza", [true, false], P.varianti.map((v) => v.disponibile));
  c("note interne, fornitore e colonne in più delle righe non escono (nemmeno come testo)", [false, false, false], [/NOTA-INTERNA/.test(tutto), /FORNITORE-SEGRETO/.test(tutto), /999/.test(tutto)]);
  c("anche dalle viste: giacenza e chiavi vietate non ci sono", [false, []], [/7341/.test(JSON.stringify(viste)), vietate(viste)]);
  // controllo del metodo: la scansione vede davvero una chiave vietata nascosta in fondo
  c("(la scansione funziona: trova una giacenza nascosta dentro una variante)", ["[0].varianti[0].giacenza"], vietate([{ varianti: [{ giacenza: 1 }] }]));

  // la bozza_modifiche non si legge mai senza chiave
  c("senza chiave la bozza di modifica non esce: né il nome né il testo né la caratteristica nuova", [false, false, false], [/NOME-DELLA-BOZZA/.test(tutto), /Testo della bozza/.test(tutto), /Nuova/.test(tutto)]);
  c("il nome è quello pubblicato", "Prodotto di prova", P.nome);

  // testi e righe
  c("passi: solo testi (il 7 si scarta)", ["Passo uno", "Passo due"], P.passi);
  c("faq: solo coppie domanda e risposta complete", [{ d: "Domanda?", r: "Risposta." }], P.faq);
  c("le caratteristiche da confermare (e «Confermato» scritto storto) non compaiono", [{ etichetta: "Formato", valore: "100 ml" }], P.caratteristiche);
  c("reso, box, gtin, SEO", [{ consentito: true, giorni: 14 }, true, "8012345678905", { titolo: "Titolo SEO", descrizione: "Descrizione SEO", immagine: `${BASE}/prova/aaaaaaaaaaaa-1600.webp` }],
    [P.reso, P.boxConsulenza, P.gtin, P.seo]);
  c("la categoria esce come {slug, nome}", [{ slug: "categoria-prova", nome: "Categoria di prova" }], P.categorie);

  // prezzi
  c("prezzi delle varianti: quello del prodotto se la variante non ne ha, il suo altrimenti", [2890, 1500], P.varianti.map((v) => v.prezzoCent));
  c("la variante spenta (prezzo 100) non compare e non conta: prezzoDaCent = minimo delle sole attive", [2, 1500], [P.varianti.length, P.prezzoDaCent]);
  c("le varianti hanno solo sku, nome, opzioni, prezzo, disponibile", ["sku", "nome", "opzioni", "prezzoCent", "disponibile"], Object.keys(P.varianti[0]));
  c("un prezzo PROPRIO non valido (negativo, con virgola, zero) scarta la variante, e non ripiega sul prodotto: mai un prezzo inventato", [["PROVA-005-X1", "PROVA-005-X5"], 777],
    (() => {
      const r = righeTabelle();
      r.prodotti = [prodottoProva({ id: uuid(0x204), sku: "PROVA-005", slug: "altra", prezzo_cent: 1000 })];
      r.varianti = ["x1", "x2", "x3", "x4", "x5"].map((s, i) =>
        varianteProva({ id: uuid(0x500 + i), prodotto_id: uuid(0x204), sku: `PROVA-005-${s.toUpperCase()}`, prezzo_cent: [null, -5, 12.5, 0, 777][i] }));
      const p = PUB.costruisciPubblico(r, opz)[0];
      return [p.varianti.map((v) => v.sku), p.prezzoDaCent];
    })());
  // prezzoDaCent ignora le varianti non attive (D25): la più economica è spenta
  const conSpente = (attive) => {
    const r = righeTabelle();
    r.prodotti = [prodottoProva({ id: uuid(0x204), sku: "PROVA-005", slug: "altra", prezzo_cent: 2890 })];
    r.varianti = [100, 1500, 2000].map((cent, i) => varianteProva({ id: uuid(0x500 + i), prodotto_id: uuid(0x204), sku: `PROVA-005-V${i}`, prezzo_cent: cent, attiva: attive[i] }));
    const p = PUB.costruisciPubblico(r, opz)[0];
    return [p.varianti.map((v) => v.sku), p.prezzoDaCent];
  };
  c("prezzoDaCent: la più economica è spenta → vale la più economica TRA LE ATTIVE", [["PROVA-005-V1", "PROVA-005-V2"], 1500], conSpente([false, true, true]));
  c("prezzoDaCent: restano spente tutte tranne la più cara → vale quella", [["PROVA-005-V2"], 2000], conSpente([false, false, true]));
  c("prezzoDaCent: nessuna variante attiva → nessuna variante in vendita e il prezzo è quello del prodotto", [[], 2890], conSpente([false, false, false]));
  c("una variante spenta non rende disponibile né fa comparire le sue opzioni", [false, false], [JSON.stringify(P.opzioni).includes("Rosso"), JSON.stringify(P.opzioni).includes('"40"')]);

  // due foto attive nello stesso slot: ne vince UNA, sempre la stessa, in qualunque ordine arrivino (ordine, poi creato_il, poi id)
  const gara = (righe) => {
    const r = righeTabelle();
    r.media = righe.map((x, i) => mediaProva({ id: uuid(0x600 + i), prodotto_id: uuid(0x200), slot: "principale", alt: `gara-${i}`, creato_il: "2026-11-20T09:00:00.000Z", ...x }));
    const alt = (m) => PUB.costruisciPubblico(m, opz)[0].media.map((x) => x.alt);
    const dritto = alt(r), rovescio = alt({ ...r, media: [...r.media].reverse() });
    return [dritto, rovescio];
  };
  c("stesso slot: vince l'`ordine` più basso (e le altre non escono), in qualunque ordine arrivino", [["gara-1"], ["gara-1"]], gara([{ ordine: 5 }, { ordine: 2 }, { ordine: 9 }]));
  c("stesso slot, stesso `ordine`: vince la più vecchia (`creato_il`)", [["gara-2"], ["gara-2"]],
    gara([{ ordine: 1, creato_il: "2026-11-20T09:30:00.000Z" }, { ordine: 1, creato_il: "2026-11-20T09:20:00.000Z" }, { ordine: 1, creato_il: "2026-11-20T09:10:00.000Z" }]));
  c("stesso slot, stesso `ordine` e stesso `creato_il`: vince l'`id` più piccolo (mai l'ordine d'arrivo)", [["gara-0"], ["gara-0"]], gara([{ ordine: 1 }, { ordine: 1 }, { ordine: 1 }]));
  c("una foto rimossa o di persona senza liberatoria non vince nemmeno se ha l'`ordine` più basso", [["gara-2"], ["gara-2"]],
    gara([{ ordine: 0, rimosso_il: ISTANTE }, { ordine: 0, ritrae_persone: true, liberatoria_ok: false }, { ordine: 3 }]));
  c("senza `creato_il` (le viste non lo danno) si decide comunque: `ordine`, poi `id`", [["gara-0"], ["gara-0"]], gara([{ ordine: 4, creato_il: undefined }, { ordine: 4, creato_il: undefined }, { ordine: 9, creato_il: undefined }]));

  // le viste possono perdere le colonne di filtro (`stato`, `attiva`, `liberatoria_ok`, `rimosso_il`): la vista ha già filtrato
  const senzaFiltri = (() => {
    const v = righeViste();
    v.prodotti = v.prodotti.map(({ stato, ...x }) => x);
    v.varianti = v.varianti.map(({ attiva, ...x }) => x);
    v.media = v.media.map(({ liberatoria_ok, rimosso_il, ...x }) => x);
    return v;
  })();
  c("viste senza `stato`: i prodotti escono (la vista è già filtrata)", ["prodotto-di-prova", "altro-prodotto"], PUB.costruisciPubblico(senzaFiltri, opz).map((p) => p.slug));
  c("viste senza `liberatoria_ok` né `rimosso_il`: le foto già filtrate escono tutte e le persone non spariscono", ["principale", "scala", "foto4", "video"],
    PUB.costruisciPubblico(senzaFiltri, opz)[0].media.map((m) => m.slot));
  c("…ma una colonna PRESENTE vale: `stato: bozza` o `liberatoria_ok: false` anche da una vista fanno uscire la riga", [["altro-prodotto"], "Foto principale"],
    (() => {
      const v = righeViste();
      v.prodotti[0].stato = "bozza";
      const w = righeViste();
      w.media.push(mediaProva({ id: uuid(0x6ff), prodotto_id: uuid(0x200), slot: "principale", ordine: -1, ritrae_persone: true, liberatoria_ok: false, alt: "SENZA-LIBERATORIA" }));
      return [PUB.costruisciPubblico(v, opz).map((p) => p.slug), PUB.costruisciPubblico(w, opz)[0].media[0].alt];
    })());

  // opzioni e campioni
  c("opzioni: Colore, poi Lunghezza (l'ordine delle chiavi del JSON non conta); solo valori di varianti attive; il campione c'è solo dove c'è la foto",
    [{ nome: "Colore", valori: [{ valore: "Nero", campione: { w480: `${BASE}/prova/aaaaaaaaaaaa-480.webp` } }, { valore: "Biondo", campione: null }] },
      { nome: "Lunghezza", valori: [{ valore: "30", campione: null }] }], P.opzioni);

  // media
  c("media: principale, scala, foto 4, video; fuori la persona senza liberatoria e la foto rimossa; il campione non è un media del prodotto",
    ["principale", "scala", "foto4", "video"], P.media.map((m) => m.slot));
  c("la foto di una categoria o di un altro prodotto non entra", false, /categoria|altro prodotto/i.test(JSON.stringify(P.media)));
  c("le foto hanno le tre misure con l'indirizzo completo; il sotto-ruolo c'è solo dove vale", [{ w480: `${BASE}/prova/aaaaaaaaaaaa-480.webp`, w960: `${BASE}/prova/aaaaaaaaaaaa-960.webp`, w1600: `${BASE}/prova/aaaaaaaaaaaa-1600.webp` }, "macro_attaccatura", null],
    [P.media[0].src, P.media[2].sottoRuolo, P.media[0].sottoRuolo]);
  c("il video ha l'indirizzo e la copertina, e niente foto", [`${BASE}/prova/v.mp4`, `${BASE}/prova/c.webp`, null, "Parlato", false],
    [P.media[3].video, P.media[3].copertina, P.media[3].src, P.media[3].testoParlato, P.media[3].muto]);
  c("una foto senza tutte e tre le misure non esce", ["principale"],
    PUB.costruisciPubblico({ ...righeTabelle(), media: [mediaProva({ id: uuid(0x430), prodotto_id: uuid(0x200) }), mediaProva({ id: uuid(0x431), prodotto_id: uuid(0x200), slot: "foto2", path_960: null })] }, opz)[0].media.map((m) => m.slot));
  c("senza media i campi restano vuoti e il prodotto esce lo stesso", [[], true],
    (() => { const p = PUB.costruisciPubblico({ ...righeTabelle(), media: [] }, opz)[0]; return [p.media, p.seo.immagine === null]; })());

  // correlato
  c("«Ti serve anche»: slug, nome, prezzo da e foto del prodotto collegato (se pubblicato)", { slug: "altro-prodotto", nome: "Altro prodotto", prezzoDaCent: 3500, foto: { w480: `${BASE}/prova/aaaaaaaaaaaa-480.webp`, w960: `${BASE}/prova/aaaaaaaaaaaa-960.webp`, w1600: `${BASE}/prova/aaaaaaaaaaaa-1600.webp` } }, P.correlato);
  c("il collegamento a una bozza non esce; e un prodotto senza collegamento ha null", [null, null],
    [PUB.costruisciPubblico({ ...righeTabelle(), prodotti: righeTabelle().prodotti.map((p) => (p.slug === "prodotto-di-prova" ? { ...p, correlato_id: uuid(0x201) } : p)) }, opz)[0].correlato,
      trova(tab, "altro-prodotto").correlato]);

  // forma delle righe: mai eccezioni e nessun inventato
  c("righe strane (assenti, nulle, di tipo sbagliato) → elenco vuoto o prodotti puliti, mai un'eccezione", [[], [], []],
    [PUB.costruisciPubblico({}, opz), PUB.costruisciPubblico(null, opz), PUB.costruisciPubblico({ prodotti: [null, 3, "x", {}, { stato: "pubblicato" }], varianti: "x", media: 5 }, opz)]);
  c("senza `baseMedia` i percorsi restano com'erano (non si inventa un dominio)", "prova/aaaaaaaaaaaa-1600.webp", PUB.costruisciPubblico(righeTabelle())[0].media[0].src.w1600);

  // ═════════════════════════════ 2 · anteprima ═════════════════════════════
  gruppo("NEGOZIO · L'ANTEPRIMA: LA BOZZA SOLO CON LA CHIAVE (20/11/2026)");
  const BOZZA = PUB.costruisciPubblico(righeTabelle(), { ...opz, anteprima: { slug: "prodotto-in-bozza" } });
  const B = trova(BOZZA, "prodotto-in-bozza");
  c("con l'anteprima di quel indirizzo la bozza esce, e SOLO quella (l'altra bozza e l'archiviato no)", ["altro-prodotto", "prodotto-di-prova", "prodotto-in-bozza"], BOZZA.map((p) => p.slug).sort());
  c("la bozza porta `anteprima.nascosti`: righe da confermare, slot vuoto, manca la spedizione",
    [{ blocco: "caratteristiche", motivo: "2 righe da confermare" }, { blocco: "foto principale", motivo: "slot vuoto" }, { blocco: "spedizione", motivo: "manca la spedizione" }], B.anteprima?.nascosti);
  c("gli altri prodotti dell'uscita non hanno `anteprima`", [false, false], [trova(BOZZA, "prodotto-di-prova").anteprima !== undefined, trova(BOZZA, "altro-prodotto").anteprima !== undefined]);
  c("anche in anteprima: nessuna giacenza, nessuna chiave vietata", [false, []], [/7341/.test(JSON.stringify(BOZZA)), vietate(BOZZA)]);
  c("una bozza e un archiviato di un ALTRO indirizzo non escono con l'anteprima della prima", [false, false], [BOZZA.some((p) => p.slug === "altra-bozza"), BOZZA.some((p) => p.slug === "prodotto-archiviato")]);
  c("un archiviato non esce nemmeno in anteprima", false, PUB.costruisciPubblico(righeTabelle(), { ...opz, anteprima: { slug: "prodotto-archiviato" } }).some((p) => p.slug === "prodotto-archiviato"));
  const MOD = trova(PUB.costruisciPubblico(righeTabelle(), { ...opz, anteprima: { slug: "prodotto-di-prova" } }), "prodotto-di-prova");
  c("un pubblicato in anteprima mostra le modifiche non pubblicate (nome, testo, caratteristiche)", ["NOME-DELLA-BOZZA", "Testo della bozza", [{ etichetta: "Nuova", valore: "Sì" }]], [MOD.nome, MOD.descrizioneBreve, MOD.caratteristiche]);
  c("…ma lo slug resta quello (non cambia con la bozza) e `canali` non passa dalla bozza", ["prodotto-di-prova", false],
    [MOD.slug, "canali" in MOD]);
  c("una bozza di modifica con campi fuori elenco (prezzo, slug, canali) non cambia nulla", ["prodotto-di-prova", 2890, false],
    (() => {
      const r = righeTabelle();
      r.prodotti[0].bozza_modifiche = { slug: "rubato", prezzoCent: 1, prezzo_cent: 1, canali: { sito: false }, stato: "archiviato", giacenza: 3 };
      const p = trova(PUB.costruisciPubblico(r, { ...opz, anteprima: { slug: "prodotto-di-prova" } }), "prodotto-di-prova");
      return [p?.slug, p?.varianti[0].prezzoCent, p ? "canali" in p : null];
    })());

  // la chiave
  gruppo("NEGOZIO · LA CHIAVE D'ANTEPRIMA: HMAC, 24 ORE, LEGATA ALLO SLUG (20/11/2026)");
  const K = await AN.emettiChiaveAnteprima(CHIAVE, "prodotto-in-bozza", ORA);
  c("la chiave ha la forma «<scadenza>.<64 segni esadecimali>» e scade tra 24 ore", [`${ORA + 24 * ORE}`, true], [K.split(".")[0], /^\d+\.[0-9a-f]{64}$/.test(K)]);
  c("valida adesso, e fino all'ultimo millisecondo delle 24 ore", [true, true], [await AN.verificaChiaveAnteprima(CHIAVE, "prodotto-in-bozza", K, ORA), await AN.verificaChiaveAnteprima(CHIAVE, "prodotto-in-bozza", K, ORA + 24 * ORE)]);
  c("scaduta: +24 ore e 1 ms, e +25 ore", [false, false], [await AN.verificaChiaveAnteprima(CHIAVE, "prodotto-in-bozza", K, ORA + 24 * ORE + 1), await AN.verificaChiaveAnteprima(CHIAVE, "prodotto-in-bozza", K, ORA + 25 * ORE)]);
  c("legata allo slug: quella chiave non apre un altro indirizzo", [false, false], [await AN.verificaChiaveAnteprima(CHIAVE, "altra-bozza", K, ORA), await AN.verificaChiaveAnteprima(CHIAVE, "prodotto-in-bozza-2", K, ORA)]);
  c("un'altra chiave di servizio non la accetta", false, await AN.verificaChiaveAnteprima("altra-chiave", "prodotto-in-bozza", K, ORA));
  c("due slug diversi → due chiavi diverse; lo stesso slug in due istanti → due chiavi diverse", [true, true],
    [K !== (await AN.emettiChiaveAnteprima(CHIAVE, "altra-bozza", ORA)), K !== (await AN.emettiChiaveAnteprima(CHIAVE, "prodotto-in-bozza", ORA + 1))]);
  c("la chiave è stabile (stessi dati, stessa chiave)", K, await AN.emettiChiaveAnteprima(CHIAVE, "prodotto-in-bozza", ORA));
  // un carattere cambiato in QUALUNQUE posizione la fa cadere
  let accettate = [];
  for (let i = 0; i < K.length; i++) {
    const storta = K.slice(0, i) + (K[i] === "0" ? "1" : "0") + K.slice(i + 1);
    if (storta !== K && (await AN.verificaChiaveAnteprima(CHIAVE, "prodotto-in-bozza", storta, ORA))) accettate.push(i);
  }
  c("un segno cambiato in qualunque posizione (scadenza o firma) la fa cadere", [], accettate);
  c("la scadenza spostata in avanti con la stessa firma non vale", false,
    await AN.verificaChiaveAnteprima(CHIAVE, "prodotto-in-bozza", `${ORA + 99 * ORE}.${K.split(".")[1]}`, ORA));
  const strane = [undefined, null, "", ".", "abc", "123.", ".abc", `${K}x`, ` ${K}`, `${K}\n`, K.toUpperCase(), 42, {}, [], `${"9".repeat(40)}.${"a".repeat(64)}`];
  const eccezioni = [];
  const sì = [];
  for (const x of strane) {
    try { if (await AN.verificaChiaveAnteprima(CHIAVE, "prodotto-in-bozza", x, ORA)) sì.push(String(x)); } catch { eccezioni.push(String(x)); }
  }
  c("chiavi strane (vuote, di tipo sbagliato, con segni in più, maiuscole): sempre no, mai un'eccezione", [[], []], [sì, eccezioni]);
  const sbagli = [];
  for (const [ch, sl, ad] of [[undefined, "prodotto-in-bozza", ORA], ["", "prodotto-in-bozza", ORA], [CHIAVE, "", ORA], [CHIAVE, undefined, ORA], [CHIAVE, "prodotto-in-bozza", NaN], [CHIAVE, "prodotto-in-bozza", "ora"], [CHIAVE, "prodotto-in-bozza", undefined]]) {
    try { if (await AN.verificaChiaveAnteprima(ch, sl, K, ad)) sbagli.push([ch, sl, ad]); } catch { sbagli.push(["eccezione", ch, sl, ad]); }
  }
  c("chiave di servizio, slug o istante mancanti o storti: no, mai un'eccezione", [], sbagli);
  const rifiutate = [];
  for (const [ch, sl, ad] of [[undefined, "a", ORA], ["", "a", ORA], [CHIAVE, "", ORA], [CHIAVE, "Maiuscolo", ORA], [CHIAVE, "a b", ORA], [CHIAVE, "a", NaN]]) {
    try { await AN.emettiChiaveAnteprima(ch, sl, ad); } catch { rifiutate.push(1); }
  }
  c("emettere con chiave mancante, slug non valido o istante non numerico lancia (nessuna chiave senza firma)", 6, rifiutate.length);
  // un permesso degli eventi (etichetta `hgl-eventi-v1`, D16) non può valere come chiave d'anteprima (etichetta tutta sua).
  // Le firme si ricalcolano qui con `crypto.subtle`, indipendentemente dal codice provato.
  const hmac = async (segreto, messaggio) => {
    const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(segreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(messaggio))), (x) => x.toString(16).padStart(2, "0")).join("");
  };
  const scad = String(ORA + 10 * 60 * 1000);
  const chiaveEventi = await hmac(CHIAVE, "hgl-eventi-v1");
  const chiaveAnteprima = await hmac(CHIAVE, "hgl-anteprima-v1");
  const permesso = `${scad}.${await hmac(chiaveEventi, scad)}`; // com'è fatto un permesso evento
  const permessoSullaForma = `${scad}.${await hmac(chiaveEventi, `${scad}.prodotto-in-bozza`)}`; // stessa forma e stesso messaggio dell'anteprima, ma chiave degli eventi
  const comeAnteprima = `${scad}.${await hmac(chiaveAnteprima, `${scad}.prodotto-in-bozza`)}`; // controllo del metodo: così com'è fatta una chiave giusta
  c("un permesso degli eventi NON vale come chiave d'anteprima (nemmeno firmando «scadenza.slug» con la chiave degli eventi)", [false, false],
    [await AN.verificaChiaveAnteprima(CHIAVE, "prodotto-in-bozza", permesso, ORA), await AN.verificaChiaveAnteprima(CHIAVE, "prodotto-in-bozza", permessoSullaForma, ORA)]);
  c("(il metodo funziona: con l'etichetta dell'anteprima la stessa costruzione è accettata, e coincide con quella emessa)", [true, true],
    [await AN.verificaChiaveAnteprima(CHIAVE, "prodotto-in-bozza", comeAnteprima, ORA), (await AN.emettiChiaveAnteprima(CHIAVE, "prodotto-in-bozza", ORA + 10 * 60 * 1000 - 24 * ORE)) === comeAnteprima]);
  c("le due etichette sono diverse", [true, "hgl-anteprima-v1"], [AN.ETICHETTA_ANTEPRIMA !== "hgl-eventi-v1", AN.ETICHETTA_ANTEPRIMA]);
  // il confronto della firma è a tempo costante: usa `subtle.verify` (confronto del motore) e non un `===` sulla firma
  const sorgente = readFileSync(join(radice, "src/shop/cms/anteprima.ts"), "utf8");
  c("sorgente: la firma si confronta con `crypto.subtle.verify`, mai con un confronto di testi", [true, false],
    [/subtle\.verify\(/.test(sorgente), /(firma|hex|mac)\w*\s*[!=]==?\s*\w|\w\s*[!=]==?\s*(firma|hex|mac)\w*/i.test(sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, ""))]);
  c("sorgente: nessuna chiave scritta nel codice", false, /(?:service_role|eyJ[A-Za-z0-9_-]{20,})/.test(sorgente));
  // anteprima da capo a fondo: la chiave giusta apre la bozza, quella sbagliata no (il chiamante passa `anteprima` solo se verifica)
  const apre = async (token, slug, ad) => ((await AN.verificaChiaveAnteprima(CHIAVE, slug, token, ad)) ? PUB.costruisciPubblico(righeTabelle(), { ...opz, anteprima: { slug } }) : PUB.costruisciPubblico(righeTabelle(), opz));
  c("da capo a fondo: chiave valida → la bozza; scaduta, alterata o di un altro slug → «non trovata» (stessa uscita del pubblico)",
    [true, false, false, false], [
      !!trova(await apre(K, "prodotto-in-bozza", ORA), "prodotto-in-bozza"),
      !!trova(await apre(K, "prodotto-in-bozza", ORA + 25 * ORE), "prodotto-in-bozza"),
      !!trova(await apre(`${K.slice(0, -1)}${K.endsWith("0") ? "1" : "0"}`, "prodotto-in-bozza", ORA), "prodotto-in-bozza"),
      !!trova(await apre(K, "altra-bozza", ORA), "altra-bozza"),
    ]);

  // ═════════════════════════════ 3 · dati strutturati ═════════════════════════════
  gruppo("NEGOZIO · DATI STRUTTURATI (JSON-LD) PER GOOGLE (20/11/2026)");
  const SITO = "https://sito.prova.test";
  const ld = LD.datiStrutturatiProdotto(P, SITO);
  c("@context, @type, nome, sku, indirizzo", ["https://schema.org", "Product", "Prodotto di prova", "PROVA-001", `${SITO}/shop/prodotto/prodotto-di-prova`], [ld["@context"], ld["@type"], ld.name, ld.sku, ld.url]);
  c("descrizione, marca e gtin (c'è)", ["Una descrizione breve inventata.", { "@type": "Brand", name: "Marca Finta" }, "8012345678905"], [ld.description, ld.brand, ld.gtin]);
  c("un'offerta per ogni variante attiva: sku, prezzo con DUE decimali (testo), euro, indirizzo", [
    { "@type": "Offer", sku: "PROVA-001-NE-30", name: "Nero / 30", url: `${SITO}/shop/prodotto/prodotto-di-prova`, price: "28.90", priceCurrency: "EUR", availability: "https://schema.org/InStock", itemCondition: "https://schema.org/NewCondition" },
    { "@type": "Offer", sku: "PROVA-001-BI-30", name: "Biondo / 30", url: `${SITO}/shop/prodotto/prodotto-di-prova`, price: "15.00", priceCurrency: "EUR", availability: "https://schema.org/OutOfStock", itemCondition: "https://schema.org/NewCondition" },
  ], ld.offers);
  c("le immagini sono solo foto, in https, a 1600 px, nell'ordine dei media", [`${BASE}/prova/aaaaaaaaaaaa-1600.webp`, `${BASE}/prova/bbbbbbbbbbbb-1600.webp`, `${BASE}/prova/cccccccccccc-1600.webp`], ld.image);
  c("il JSON-LD non ha né giacenza né chiavi vietate, a nessuna profondità", [[], false], [vietate(ld), /7341/.test(JSON.stringify(ld))]);
  const senzaGtin = LD.datiStrutturatiProdotto({ ...P, gtin: null, marca: null }, SITO);
  c("senza gtin né marca le due chiavi non ci sono (mai vuote)", [false, false], ["gtin" in senzaGtin, "brand" in senzaGtin]);
  c("un gtin che non è di 8, 12, 13 o 14 cifre non si scrive", false, "gtin" in LD.datiStrutturatiProdotto({ ...P, gtin: "ABC123" }, SITO));
  const http = PUB.costruisciPubblico(righeTabelle(), { baseMedia: "http://media.prova.test" })[0];
  c("immagini non https: non si mettono (Google le scarta)", false, "image" in LD.datiStrutturatiProdotto(http, SITO));
  c("prezzi in centesimi → testo corretto (5 → 0.05, 1005 → 10.05, 28900 → 289.00)", ["0.05", "10.05", "289.00"],
    [5, 1005, 28900].map((cent) => LD.datiStrutturatiProdotto({ ...P, varianti: [{ ...P.varianti[0], prezzoCent: cent }] }, SITO).offers[0].price));
  c("senza varianti non si inventa un'offerta", false, "offers" in LD.datiStrutturatiProdotto({ ...P, varianti: [] }, SITO));
  const testo = LD.serializzaJsonLd(LD.datiStrutturatiProdotto({ ...P, nome: "</script><script>alert(1)</script>" }, SITO));
  c("serializzaJsonLd: un nome con </script> non chiude il tag e si rilegge identico", [false, "</script><script>alert(1)</script>"], [/<\/script/i.test(testo) || /<script/i.test(testo), JSON.parse(testo).name]);
  const lista = LD.datiStrutturatiLista(tab, SITO);
  c("lista: ItemList con posizione, indirizzo e nome", { "@context": "https://schema.org", "@type": "ItemList", itemListElement: [
    { "@type": "ListItem", position: 1, url: `${SITO}/shop/prodotto/prodotto-di-prova`, name: "Prodotto di prova" },
    { "@type": "ListItem", position: 2, url: `${SITO}/shop/prodotto/altro-prodotto`, name: "Altro prodotto" }] }, lista);

  // ═════════════════════════════ 4 · sitemap ═════════════════════════════
  gruppo("NEGOZIO · LA SITEMAP: SOLO I PRODOTTI PUBBLICATI (20/11/2026)");
  const catV = [
    { ...categoriaProva(), quanti: 2 },
    { ...categoriaProva({ id: uuid(0x101), slug: "categoria-vuota", nome: "Vuota" }), quanti: 0 },
    { ...categoriaProva({ id: uuid(0x102), slug: "categoria-nascosta", nome: "Nascosta", visibile: false }), quanti: 3 },
  ];
  const voci = SM.vociSitemapShop({ prodotti: righeTabelle().prodotti, categorie: catV });
  c("solo i due pubblicati e la categoria visibile con prodotti; mai una bozza, un archiviato, una categoria vuota o nascosta",
    ["/shop/prodotto/prodotto-di-prova", "/shop/prodotto/altro-prodotto", "/shop/c/categoria-prova"], voci.map((v) => v.percorso));
  c("la data dell'ultimo aggiornamento viaggia con la voce (come `VoceMappa` di seo/regole)", ISTANTE, voci[0].aggiornato);
  c("nessuna voce porta il nome di una bozza (nemmeno per errore di chiave)", false, /bozza|archiviato|vuota|nascosta/.test(JSON.stringify(voci)));
  c("senza righe o con righe strane: elenco vuoto, mai un'eccezione", [[], [], []], [SM.vociSitemapShop({ prodotti: [], categorie: [] }), SM.vociSitemapShop(null), SM.vociSitemapShop({ prodotti: [null, 4, { stato: "pubblicato" }], categorie: "x" })]);
  c("uno slug non valido non entra in sitemap (niente indirizzi rotti)", [], SM.vociSitemapShop({ prodotti: [prodottoProva({ slug: "Con Spazi/E?Query" })], categorie: [] }));
}
