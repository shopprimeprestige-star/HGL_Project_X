/** ── NEGOZIO · T15 · LA SCHEDA PRODOTTO: LE REGOLE SENZA SCHERMO ────────────
 *  `src/crm/ecommerce/prodotti/scheda-pura.ts`: dal prodotto al modulo che si scrive, dal modulo ai campi che il server
 *  accetta, SOLO i campi cambiati (uno SKU o un indirizzo uguale rifiutato su un pubblicato), il pannello «Prima di
 *  pubblicare» in tempo reale (stessa `controllaPubblicazione` del server), a quale sezione porta ogni voce, le frasi
 *  «a posto / da sistemare (n)», l'indirizzo dell'anteprima, e le regole delle varianti (opzioni, prezzo vuoto, stock).
 *  Il modulo importa codice (`@/shop/cms/…`): qui lo si impacchetta con esbuild. Dati inventati, nessun cliente. */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildSync } from "esbuild";

const caricaBundle = (percorso, radice) => {
  const r = buildSync({
    entryPoints: [percorso],
    bundle: true,
    format: "esm",
    write: false,
    alias: { "@": join(radice, "src") },
    logLevel: "silent",
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`
  );
};

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO · T15 · SCHEDA PRODOTTO: REGOLE PURE (20/11/2026)");
  const percorso = join(radice, "src/crm/ecommerce/prodotti/scheda-pura.ts");
  const S = existsSync(percorso) ? await caricaBundle(percorso, radice) : {};
  const f = (n) => typeof S[n] === "function";
  c(
    "scheda-pura.ts esporta le funzioni della scheda",
    true,
    [
      "moduloDaProdotto",
      "campiDaModulo",
      "patchCampi",
      "controlloLive",
      "sezioneDi",
      "statoSezione",
      "avvisiCampi",
      "eInvisibleDerm",
      "indirizzoAnteprima",
      "haBozza",
      "prezzoInTesto",
      "opzioniDaVarianti",
      "prezzoVarianteDaTesto",
      "quantitaDaTesto",
      "anteprimaCombinazioni",
      "conteggiPerSezione",
    ].every(f),
  );
  if (!f("moduloDaProdotto")) return;

  // ── dati inventati ──
  const prodotto = (extra = {}) => ({
    id: "p1",
    sku: "PROVA-001",
    slug: "prova-uno",
    nome: "Prodotto di prova",
    tipo: "patch",
    marca: null,
    stato: "bozza",
    origine: null,
    rigaPresentazione: "Per sciogliere i nodi.",
    descrizioneBreve: "Una descrizione breve inventata.",
    descrizioneLunga: null,
    perChi: null,
    caratteristiche: [
      { etichetta: "Formato", valore: "100 ml", stato: "confermato", fonte: "scheda" },
    ],
    passi: ["Applica", "Lascia in posa"],
    confezione: [],
    avvertenze: [],
    faq: [{ d: "Si lava?", r: "Sì." }],
    resoConsentito: true,
    resoGiorni: 14,
    boxConsulenza: false,
    correlatoId: null,
    canali: { sito: true, meta: false, google: false, tiktok: false },
    seoTitolo: null,
    seoDescrizione: null,
    seoMediaId: null,
    prezzoCent: 2890,
    bozzaModifiche: null,
    pubblicatoIl: null,
    aggiornatoIl: "2026-11-20T10:00:00.000Z",
    ...extra,
  });
  const variante = (extra = {}) => ({
    id: "v1",
    prodottoId: "p1",
    sku: "PROVA-001",
    nome: "Unica",
    opzioni: {},
    prezzoCent: null,
    giacenza: 0,
    pesoG: null,
    attiva: true,
    gtin: null,
    ordine: 1,
    ...extra,
  });
  const media = (extra = {}) => ({
    id: "m1",
    slot: "principale",
    tipo: "foto",
    alt: "Foto di prova",
    muto: false,
    sottotitoliOk: false,
    ritraePersone: false,
    liberatoriaOk: false,
    rimossoIl: null,
    pathCopertina: null,
    ...extra,
  });

  // ── le sezioni ──
  c(
    "le sezioni sono 11, con id diversi",
    [11, 11],
    [S.SEZIONI.length, new Set(S.SEZIONI.map((s) => s.id)).size],
  );

  // ── prezzo in testo ──
  c("2890 centesimi si scrivono «28,90»", "28,90", S.prezzoInTesto(2890));
  c(
    "zero centesimi: il campo resta vuoto (un prodotto nuovo non ha ancora un prezzo)",
    "",
    S.prezzoInTesto(0),
  );
  c("1000 centesimi: «10,00»", "10,00", S.prezzoInTesto(1000));

  // ── dal prodotto al modulo ──
  const m0 = S.moduloDaProdotto(prodotto());
  c(
    "il modulo porta i testi, il prezzo in euro, le liste una voce per riga",
    ["Prodotto di prova", "28,90", "Applica\nLascia in posa", "si", "14"],
    [m0.nome, m0.prezzo, m0.passi, m0.reso, m0.resoGiorni],
  );
  const pub = prodotto({
    stato: "pubblicato",
    pubblicatoIl: "2026-11-19T09:00:00.000Z",
    bozzaModifiche: {
      nome: "Nome in bozza",
      canali: { sito: true, meta: true, google: false, tiktok: false },
    },
  });
  const mp = S.moduloDaProdotto(pub);
  c(
    "un pubblicato mostra la bozza di modifica sopra i valori vivi",
    ["Nome in bozza", true, "28,90"],
    [mp.nome, mp.canali.meta, mp.prezzo],
  );
  c(
    "un reso non deciso resta vuoto, non «no»",
    "",
    S.moduloDaProdotto(prodotto({ resoConsentito: null, resoGiorni: null })).reso,
  );

  // ── dal modulo ai campi ──
  const conv = (extra = {}, p = prodotto()) =>
    S.campiDaModulo({ ...S.moduloDaProdotto(p), ...extra });
  const base = conv();
  c("un modulo a posto non ha errori", {}, base.errori);
  c(
    "i campi tornano come li vuole il server (prezzo in centesimi, liste, reso)",
    [2890, ["Applica", "Lascia in posa"], true, 14],
    [base.campi.prezzoCent, base.campi.passi, base.campi.resoConsentito, base.campi.resoGiorni],
  );
  c("prezzo «19,9» → 1990 centesimi", 1990, conv({ prezzo: "19,9" }).campi.prezzoCent);
  c("prezzo «19.90 €» → 1990", 1990, conv({ prezzo: "19.90 €" }).campi.prezzoCent);
  c(
    "prezzo vuoto → 0 (bozza senza prezzo), nessun errore",
    [0, undefined],
    [conv({ prezzo: "" }).campi.prezzoCent, conv({ prezzo: "" }).errori.prezzo],
  );
  c(
    "prezzo «abc» → errore sul prezzo e il prezzo non parte",
    [true, false],
    [
      typeof conv({ prezzo: "abc" }).errori.prezzo === "string",
      "prezzoCent" in conv({ prezzo: "abc" }).campi,
    ],
  );
  c(
    "prezzo con frazioni di centesimo → errore",
    true,
    typeof conv({ prezzo: "19,999" }).errori.prezzo === "string",
  );
  c("prezzo negativo → errore", true, typeof conv({ prezzo: "-5" }).errori.prezzo === "string");
  c("nome vuoto → errore sul nome", true, typeof conv({ nome: "   " }).errori.nome === "string");
  c(
    "slug storto → errore sullo slug",
    true,
    typeof conv({ slug: "Ciao Mondo" }).errori.slug === "string",
  );
  c(
    "SKU minuscolo → errore sullo SKU",
    true,
    typeof conv({ sku: "hg t01" }).errori.sku === "string",
  );
  c(
    "righe vuote e spazi nelle liste spariscono",
    ["a", "b"],
    conv({ passi: "a\n\n  b  \n" }).campi.passi,
  );
  c(
    "più di 30 voci in una lista → errore",
    true,
    typeof conv({ passi: Array.from({ length: 31 }, (_, k) => `p${k}`).join("\n") }).errori
      .passi === "string",
  );
  c(
    "una caratteristica «confermata» senza fonte → errore (il server la rifiuterebbe)",
    true,
    typeof conv({
      caratteristiche: [{ etichetta: "Peso", valore: "5 g", stato: "confermato", fonte: null }],
    }).errori.caratteristiche === "string",
  );
  c(
    "una caratteristica «da confermare» senza fonte va bene",
    {},
    conv({
      caratteristiche: [{ etichetta: "Peso", valore: "5 g", stato: "da_confermare", fonte: null }],
    }).errori,
  );
  c(
    "una riga di caratteristica con solo l'etichetta → errore; tutta vuota → si scarta",
    [true, []],
    [
      typeof conv({
        caratteristiche: [{ etichetta: "Peso", valore: "", stato: "da_confermare", fonte: null }],
      }).errori.caratteristiche === "string",
      conv({
        caratteristiche: [{ etichetta: "", valore: "", stato: "da_confermare", fonte: null }],
      }).campi.caratteristiche,
    ],
  );
  c(
    "una domanda senza risposta → errore; tutta vuota → si scarta",
    [true, []],
    [
      typeof conv({ faq: [{ d: "Quanto dura?", r: "" }] }).errori.faq === "string",
      conv({ faq: [{ d: "", r: "" }] }).campi.faq,
    ],
  );
  c(
    "il box consulenza su un kit → errore (solo patch)",
    true,
    typeof conv({ boxConsulenza: true, tipo: "kit" }).errori.boxConsulenza === "string",
  );
  c(
    "giorni di reso «abc» → errore; «30» → 30",
    [true, 30],
    [
      typeof conv({ reso: "si", resoGiorni: "abc" }).errori.resoGiorni === "string",
      conv({ reso: "si", resoGiorni: "30" }).campi.resoGiorni,
    ],
  );
  c(
    "con «no» al reso i giorni non contano",
    [false, null],
    [
      conv({ reso: "no", resoGiorni: "30" }).campi.resoConsentito,
      conv({ reso: "no", resoGiorni: "30" }).campi.resoGiorni,
    ],
  );
  c(
    "reso non deciso → nullo, senza giorni",
    [null, null],
    [
      conv({ reso: "", resoGiorni: "30" }).campi.resoConsentito,
      conv({ reso: "", resoGiorni: "30" }).campi.resoGiorni,
    ],
  );
  c(
    "una cifra vicino a «Invisible Derm» → errore sul campo e il campo non parte",
    [true, false],
    [
      typeof conv({ descrizioneBreve: "Invisible Derm a 3.900 €" }).errori.descrizioneBreve ===
        "string",
      "descrizioneBreve" in conv({ descrizioneBreve: "Invisible Derm a 3.900 €" }).campi,
    ],
  );
  c(
    "«sconto del» in un testo → errore sul campo",
    true,
    typeof conv({ descrizioneLunga: "Sconto del 20% solo oggi" }).errori.descrizioneLunga ===
      "string",
  );
  c(
    "la descrizione breve oltre 300 segni → errore",
    true,
    typeof conv({ descrizioneBreve: "x".repeat(301) }).errori.descrizioneBreve === "string",
  );
  c(
    "una parola da non usare NON è un errore (solo un avviso)",
    {},
    conv({ descrizioneBreve: "Un prodotto garantito." }).errori,
  );

  // ── solo ciò che è cambiato ──
  c(
    "niente è cambiato: nessun campo da salvare",
    {},
    S.patchCampi(base.campi, conv().campi, { pubblicato: false }),
  );
  c(
    "cambia il nome: parte solo il nome",
    { nome: "Nuovo" },
    S.patchCampi(base.campi, conv({ nome: "Nuovo" }).campi, { pubblicato: false }),
  );
  const camb = conv({ sku: "NUOVO-1", slug: "nuovo-1", prezzo: "30" }).campi;
  c(
    "in bozza partono SKU, indirizzo e prezzo",
    { slug: "nuovo-1", sku: "NUOVO-1", prezzoCent: 3000 },
    S.patchCampi(base.campi, camb, { pubblicato: false }),
  );
  c(
    "su un pubblicato SKU, indirizzo e prezzo NON partono da soli (il prezzo si cambia con il suo tasto)",
    {},
    S.patchCampi(base.campi, camb, { pubblicato: true }),
  );
  c(
    "un campo con errore non parte, gli altri sì",
    { nome: "Nuovo" },
    S.patchCampi(base.campi, conv({ nome: "Nuovo", prezzo: "abc" }).campi, { pubblicato: false }),
  );
  c(
    "le liste si confrontano per contenuto",
    {},
    S.patchCampi(base.campi, conv({ passi: "Applica\nLascia in posa" }).campi, {
      pubblicato: false,
    }),
  );
  c(
    "i canali si confrontano per contenuto",
    { canali: { sito: true, meta: true, google: false, tiktok: false } },
    S.patchCampi(
      base.campi,
      conv({ canali: { sito: true, meta: true, google: false, tiktok: false } }).campi,
      { pubblicato: false },
    ),
  );

  // ── «Prima di pubblicare» in tempo reale ──
  const live = (o = {}) =>
    S.controlloLive({
      base: o.base ?? prodotto(),
      campi: o.campi ?? base.campi,
      errori: o.errori ?? {},
      varianti: o.varianti ?? [variante()],
      media: o.media ?? [media()],
      categorie: o.categorie ?? ["k1"],
      altriSku: o.altriSku ?? [],
      pubblicato: o.pubblicato ?? false,
    });
  const ca = (r) => r.bloccanti.map((b) => b.campo);
  c("tutto a posto: nessun bloccante", [], live().bloccanti);
  c(
    "senza foto principale: «Manca la foto principale: il prodotto resta in bozza.»",
    ["fotoPrincipale", "Manca la foto principale: il prodotto resta in bozza."],
    (() => {
      const r = live({ media: [] });
      return [r.bloccanti[0].campo, r.bloccanti[0].frase];
    })(),
  );
  c(
    "senza categoria: bloccante «categoria»",
    true,
    ca(live({ categorie: [] })).includes("categoria"),
  );
  c(
    "prezzo scritto a 0 e variante senza prezzo: bloccante «prezzo»",
    true,
    ca(live({ campi: conv({ prezzo: "" }).campi })).includes("prezzo"),
  );
  c(
    "variante col suo prezzo: il prezzo del prodotto a 0 non blocca",
    false,
    ca(
      live({ campi: conv({ prezzo: "" }).campi, varianti: [variante({ prezzoCent: 1500 })] }),
    ).includes("prezzo"),
  );
  c(
    "su un pubblicato conta il prezzo vivo, non quello scritto e non ancora applicato",
    false,
    ca(
      live({
        pubblicato: true,
        base: prodotto({ stato: "pubblicato" }),
        campi: conv({ prezzo: "" }).campi,
      }),
    ).includes("prezzo"),
  );
  c(
    "SKU già usato da un altro prodotto: bloccante «sku»",
    true,
    ca(live({ altriSku: [{ sku: "PROVA-001", prodottoId: "p2" }] })).includes("sku"),
  );
  c(
    "lo SKU del prodotto stesso non conta come «già usato»",
    false,
    ca(live({ altriSku: [{ sku: "PROVA-001", prodottoId: "p1" }] })).includes("sku"),
  );
  c(
    "nessun canale acceso: bloccante «canali»",
    true,
    ca(
      live({
        campi: conv({ canali: { sito: false, meta: false, google: false, tiktok: false } }).campi,
      }),
    ).includes("canali"),
  );
  c(
    "un errore del modulo diventa una voce che porta al campo",
    [true, "prezzo"],
    (() => {
      const r = live({ errori: { prezzo: "Scrivi il prezzo in euro, per esempio 19,90." } });
      const v = r.bloccanti.find((b) => b.frase.startsWith("Scrivi il prezzo"));
      return [!!v, v?.campo];
    })(),
  );
  c(
    "la stessa frase non compare due volte",
    1,
    live({
      errori: { descrizioneBreve: "Manca la descrizione breve." },
      campi: conv({ descrizioneBreve: "" }).campi,
    }).bloccanti.filter((b) => b.frase === "Manca la descrizione breve.").length,
  );
  c(
    "«da confermare»: informativo, non bloccante",
    [[], true],
    (() => {
      const r = live({
        campi: conv({
          caratteristiche: [
            { etichetta: "Peso", valore: "5 g", stato: "da_confermare", fonte: null },
          ],
        }).campi,
      });
      return [r.bloccanti, r.informativi.some((i) => i.campo === "caratteristiche")];
    })(),
  );

  // ── a quale sezione porta una voce ──
  const ctx = { nome: "Prodotto di prova", sku: "PROVA-001" };
  const dove = (campo, frase = "") => S.sezioneDi({ campo, frase }, ctx);
  c(
    "foto e video → «foto»",
    ["foto", "foto", "foto", "foto"],
    [dove("fotoPrincipale"), dove("alt"), dove("video"), dove("media")],
  );
  c(
    "prezzo → «prezzo», varianti → «varianti», categoria → «categorie»",
    ["prezzo", "varianti", "categorie"],
    [dove("prezzo"), dove("varianti"), dove("categoria")],
  );
  c(
    "descrizioni → «descrizione»; SEO → «ricerca»; canali → «canali»",
    ["descrizione", "descrizione", "ricerca", "ricerca", "canali"],
    [
      dove("descrizioneBreve"),
      dove("rigaPresentazione"),
      dove("seoTitolo"),
      dove("seoDescrizione"),
      dove("canali"),
    ],
  );
  c(
    "passi, confezione, avvertenze, domande → «uso»; caratteristiche → «caratteristiche»",
    ["uso", "uso", "uso", "uso", "caratteristiche"],
    [dove("passi"), dove("confezione"), dove("avvertenze"), dove("faq"), dove("caratteristiche")],
  );
  c("la spedizione e il reso → «reso»", ["reso", "reso"], [dove("spedizione"), dove("resoGiorni")]);
  c(
    "nome, indirizzo, SKU del prodotto → «identita»",
    ["identita", "identita", "identita"],
    [
      dove("nome"),
      dove("slug"),
      dove("sku", "Lo SKU “PROVA-001” è già usato da un altro prodotto."),
    ],
  );
  c(
    "uno SKU di una variante → «varianti»",
    ["varianti", "varianti"],
    [
      dove("sku", "Lo SKU “PROVA-001-NE” è già usato da un altro prodotto."),
      dove("sku", "Lo SKU “X-1” è scritto su due varianti: ogni variante ha il suo."),
    ],
  );
  c("un campo che non conosco → «identita» (mai un clic nel vuoto)", "identita", dove("boh"));
  c(
    "l'id dell'elemento a cui si va è «f-<campo>» (solo lettere)",
    "f-descrizioneBreve",
    S.idCampo("descrizioneBreve"),
  );

  // ── il segno di ogni sezione ──
  const voci = [
    { campo: "prezzo", frase: "x" },
    { campo: "fotoPrincipale", frase: "y" },
    { campo: "alt", frase: "z" },
  ];
  const n = S.conteggiPerSezione(voci, [{ campo: "caratteristiche", frase: "w" }], ctx);
  c(
    "i conti per sezione: bloccanti e informativi",
    [1, 2, 0, 1],
    [n.prezzo.bloccanti, n.foto.bloccanti, n.identita.bloccanti, n.caratteristiche.informativi],
  );
  c(
    "tutte le sezioni hanno un conto (anche a zero)",
    true,
    S.SEZIONI.every((s) => n[s.id] && n[s.id].bloccanti >= 0),
  );
  c(
    "segno: a posto",
    { tono: "ok", testo: "a posto" },
    S.statoSezione({ bloccanti: 0, informativi: 0 }),
  );
  c(
    "segno: da sistemare (n) conta i bloccanti",
    { tono: "da_sistemare", testo: "da sistemare (2)" },
    S.statoSezione({ bloccanti: 2, informativi: 1 }),
  );
  c(
    "segno: solo informativi → da controllare (n)",
    { tono: "da_controllare", testo: "da controllare (1)" },
    S.statoSezione({ bloccanti: 0, informativi: 1 }),
  );

  // ── gli avvisi accanto al campo ──
  const av = S.avvisiCampi({
    ...m0,
    descrizioneBreve: "Un prodotto garantito e premium.",
    descrizioneLunga: "Invisible Derm da 3.900 €",
    nome: "Patch",
  });
  c(
    "le parole da non usare diventano avvisi accanto al campo",
    2,
    av.descrizioneBreve?.avvisi.length,
  );
  c(
    "una cifra vicino a Invisible Derm è un blocco accanto al campo",
    [1, 0],
    [av.descrizioneLunga?.bloccanti.length, av.descrizioneLunga?.avvisi.length],
  );
  c("un campo pulito non compare", undefined, av.nome);
  c(
    "le caratteristiche e le domande frequenti si controllano",
    [1, 1],
    [
      S.avvisiCampi({
        ...m0,
        caratteristiche: [
          { etichetta: "Tipo", valore: "garantito", stato: "da_confermare", fonte: null },
        ],
      }).caratteristiche?.avvisi.length,
      S.avvisiCampi({ ...m0, faq: [{ d: "Dura?", r: "Sconto del 10%" }] }).faq?.bloccanti.length,
    ],
  );

  // ── Invisible Derm (D39): niente prezzo pubblico ──
  c(
    "Invisible Derm si riconosce dal nome, in qualunque scrittura (D40: ancorato all'inizio; «Kit Invisible Derm» e «Solvente per Invisible Derm» no)",
    [true, true, true, true, false, false, false],
    [
      "Invisible Derm",
      "invisible-derm su misura",
      "INVISIBLE_DERM",
      "Invisibile  Derm",
      "Kit Invisible  Derm",
      "Solvente per Invisible Derm",
      "Patch lace",
    ].map((n) => S.eInvisibleDerm(n)),
  );
  c("un nome che non è una stringa non è Invisible Derm", false, S.eInvisibleDerm(null));
  c("D40: lo slug che comincia con `invisible-derm` basta, con qualunque nome (la scheda non mostra il campo prezzo)", [true, false], [S.eInvisibleDerm("Kit", "invisible-derm-kit"), S.eInvisibleDerm("Kit", "kit-invisible-derm")]);

  // ── l'anteprima ──
  const chiave = `${Date.now() + 86400000}.${"a1".repeat(32)}`;
  c(
    "l'indirizzo dell'anteprima diventa assoluto sull'origine della pagina",
    `https://crm.esempio.it/shop/prodotto/prova-uno?anteprima=${chiave}`,
    S.indirizzoAnteprima("https://crm.esempio.it", `/shop/prodotto/prova-uno?anteprima=${chiave}`),
  );
  c(
    "un indirizzo che non è /shop/prodotto/… non si copia mai",
    [null, null, null, null],
    [
      S.indirizzoAnteprima(
        "https://crm.esempio.it",
        "https://altro.it/shop/prodotto/x?anteprima=" + chiave,
      ),
      S.indirizzoAnteprima(
        "https://crm.esempio.it",
        "//altro.it/shop/prodotto/x?anteprima=" + chiave,
      ),
      S.indirizzoAnteprima("https://crm.esempio.it", "/shop/prodotto/x?anteprima=zzz"),
      S.indirizzoAnteprima("https://crm.esempio.it", 42),
    ],
  );

  // ── la striscia «modifiche non pubblicate» ──
  c(
    "bozza di modifica: nessuna / vuota / piena",
    [false, false, true],
    [S.haBozza(null), S.haBozza({}), S.haBozza({ nome: "x" })],
  );

  // ── varianti ──
  const vs = [
    variante({
      id: "a",
      sku: "P1-NE-30",
      opzioni: { Colore: "Nero", Lunghezza: "30 cm" },
      ordine: 1,
    }),
    variante({
      id: "b",
      sku: "P1-NE-40",
      opzioni: { Colore: "Nero", Lunghezza: "40 cm" },
      ordine: 2,
    }),
    variante({
      id: "c",
      sku: "P1-BI-30",
      opzioni: { Colore: "Biondo", Lunghezza: "30 cm" },
      ordine: 3,
    }),
  ];
  c(
    "le opzioni si ricostruiscono dalle varianti (ordine di comparsa, senza doppioni)",
    [
      { nome: "Colore", valori: ["Nero", "Biondo"] },
      { nome: "Lunghezza", valori: ["30 cm", "40 cm"] },
    ],
    S.opzioniDaVarianti(vs),
  );
  c("varianti senza opzioni: nessuna opzione", [], S.opzioniDaVarianti([variante()]));
  c(
    "prezzo di una variante: vuoto = quello del prodotto",
    { ok: true, cent: null },
    S.prezzoVarianteDaTesto("  "),
  );
  c(
    "prezzo di una variante: «12,5» → 1250",
    { ok: true, cent: 1250 },
    S.prezzoVarianteDaTesto("12,5"),
  );
  c("prezzo di una variante: testo storto → no", { ok: false }, S.prezzoVarianteDaTesto("dodici"));
  c(
    "quantità: intero da 0 in su",
    [
      { ok: true, n: 0 },
      { ok: true, n: 12 },
    ],
    [S.quantitaDaTesto("0"), S.quantitaDaTesto(" 12 ")],
  );
  c(
    "quantità: negativa, con virgola, vuota, enorme → no",
    [false, false, false, false],
    ["-1", "2,5", "", "99999999"].map((t) => S.quantitaDaTesto(t).ok),
  );
  const gen = S.anteprimaCombinazioni(
    "P1",
    [
      { nome: "Colore", valori: ["Nero", "Biondo"] },
      { nome: "Lunghezza", valori: ["30 cm", "40 cm"] },
    ],
    vs,
  );
  c(
    "anteprima delle combinazioni: 4 in tutto, 3 già ci sono, 1 nuova",
    [true, 4, 1, 3],
    [gen.ok, gen.totale, gen.nuove, gen.esistenti],
  );
  const troppe = S.anteprimaCombinazioni(
    "P1",
    [
      { nome: "A", valori: Array.from({ length: 8 }, (_, k) => `a${k}`) },
      { nome: "B", valori: Array.from({ length: 8 }, (_, k) => `b${k}`) },
    ],
    [],
  );
  c(
    "oltre 50 combinazioni: la frase dice il massimo",
    [false, true],
    [troppe.ok, /50/.test(troppe.frase ?? "")],
  );
  c(
    "quattro opzioni: la frase dice il massimo di 3",
    [false, true],
    [
      S.anteprimaCombinazioni(
        "P1",
        ["A", "B", "C", "D"].map((nome) => ({ nome, valori: ["x"] })),
        [],
      ).ok,
      /3/.test(
        S.anteprimaCombinazioni(
          "P1",
          ["A", "B", "C", "D"].map((nome) => ({ nome, valori: ["x"] })),
          [],
        ).frase,
      ),
    ],
  );
}
