/** ── PROVA S1 · I DATI DELLA LANDING «TRE SOLUZIONI» ──────────────────────
 *  `landing-content.ts` (sezione v3), `soluzioni/{cancello,regole,contenuti,anteprima}.ts`.
 *  Funzioni pure e un client finto: niente rete, niente database.
 *  La fotografia G1 qui sotto è quella di `d42e5d9` (chiavi, tipi e predefiniti di oggi):
 *  se cambia una riga, la home e l'editor non sono più gli stessi.
 *  ───────────────────────────────────────────────────────────────────────── */
import { carica, leggi, nuovaProva } from "./_comune.mjs";

const { c, vero, finisci } = nuovaProva("dati della landing «Tre soluzioni»");

//  Fotografia G1 da d42e5d9: sezioni [id, [[chiave, tipo]]], DEFAULT_TEXTS, DEFAULT_MEDIA.
const FOTO_G1 = {"schema":[["hero",[["hero.eyebrow1","text"],["hero.eyebrow2","text"],["hero.h1","textarea"],["hero.errorPill","text"],["hero.body","textarea"],["hero.priceLabel","text"],["hero.priceOld","text"],["hero.priceNew","text"],["hero.priceHighlight","text"],["hero.calendarTopLabel","text"],["hero.calendarBottomLabel","text"]]],["s02",[["s02.eyebrow","text"],["s02.h2","textarea"],["s02.body","textarea"],["s02.note","textarea"],["s02.media","video"]]],["s03",[["s03.eyebrowL","text"],["s03.h3L","textarea"],["s03.media","video"],["s03.bodyL1","textarea"],["s03.bodyL2","textarea"],["s03.h2R","textarea"],["s03.stat1Big","text"],["s03.stat1Sub","text"],["s03.stat2Big","text"],["s03.stat2Sub","text"],["s03.stat3Big","text"],["s03.stat3Sub","text"]]],["s04",[["s04.eyebrow","text"],["s04.h2","textarea"],["s04.intro","textarea"],["s04.pill1","text"],["s04.pill2","text"],["s04.pill3","text"],["s04.pill4","text"],["s04.p1Title","text"],["s04.p1Hook","text"],["s04.p1Kicker","text"],["s04.p1Desc","textarea"],["s04.p2Title","text"],["s04.p2Hook","text"],["s04.p2Kicker","text"],["s04.p2Desc","textarea"],["s04.p3Title","text"],["s04.p3Hook","text"],["s04.p3Kicker","text"],["s04.p3Desc","textarea"]]],["s05",[["s05.eyebrow","text"],["s05.h2","text"],["s05.body","textarea"],["s05.beforeImage","image"],["s05.afterImage","image"]]],["banner",[["banner.eyebrow","text"],["banner.h2","textarea"]]],["faq",[["faq.eyebrow","text"],["faq.h2","text"],["faq.sub","text"]]],["s08",[["s08.eyebrow","text"],["s08.h2","text"],["s08.hook","text"],["s08.body","textarea"],["s08.urgency","text"],["s08.priceLabel","text"],["s08.cta","text"]]],["slogan",[["slogan.eyebrow","text"],["slogan.h2","textarea"],["slogan.body","text"]]]],"texts":{"hero.eyebrow1":"Il problema non è averlo.","hero.eyebrow2":"È che non si noti.","hero.h1":"Invisible Derm: il [a]nuovo[/a]\nimpianto 2026.\n[a]Invisibile[/a]. Davvero!","hero.errorPill":"Una patch cutanea si vede sempre.","hero.body":"Il [a]Invisible Derm[/a] no. Ho fuso l'invisibilità di una [a]0.03mm[/a] con la resistenza di una [a]0.08mm[/a]. Un impianto che non tradisce mai — neanche a distanza di contatto.","hero.priceLabel":"Valutazione professionale","hero.priceOld":"47€","hero.priceNew":"Oggi:","hero.priceHighlight":"GRATIS","hero.calendarTopLabel":"Candidati per l'analisi tecnica","hero.calendarBottomLabel":"Analisi tecnica [a]gratuita[/a] · slot limitati mensili","s02.eyebrow":"02 · Resistenza & Tecnologia","s02.h2":"Invisibilità Skin.\nForza HD.\nSenza compromessi.","s02.body":"La [a]Reticolazione Molecolare[/a] del [a]Invisible Derm[/a] permette alla membrana skin di scomparire sulla pelle pur mantenendo una forza di trazione mai vista.","s02.note":"[a]Non è Lace.[/a] È una membrana continua: zero reti, zero nodi. Invisibilità totale. Resistenza da 0.08. Questo si che è assurdo.","s03.eyebrowL":"03 · Test della Verità","s03.h3L":"Vedilo da vicino.\n[a]In alta definizione.[/a]","s03.bodyL1":"Nessun nodo. Nessun riflesso sintetico. Il trattamento [a]Derm-Sync[/a] rende l'impianto indistinguibile dalla tua cute anche a distanza di contatto.","s03.bodyL2":"Questa è la distanza a cui ti guarda una persona. Guardala tu per primo.","s03.h2R":"Patch cutanea vs Invisible Derm.\n[a]La differenza è misurabile.[/a]","s03.stat1Big":"INVISIBILE","s03.stat1Sub":"Attaccatura\ninvisibile","s03.stat2Big":"X5","s03.stat2Sub":"Forza\nreticolata","s03.stat3Big":"120 MIN","s03.stat3Sub":"Installazione\ncompleta","s04.eyebrow":"04 · I 3 Pilastri","s04.h2":"Vivi la tua vita.\nL'impianto resta invisibile.","s04.intro":"Sport, sudore, mare, sole o doccia: il [a]Invisible Derm[/a] resta naturale e indistinguibile in ogni condizione.","s04.pill1":"Sport intenso","s04.pill2":"Sudore prolungato","s04.pill3":"Mare e piscina","s04.pill4":"Luce diretta","s04.p1Title":"Corri. Suda. Non cambia niente.","s04.p1Hook":"Sei a metà di una gara. Non puoi fermarti a controllare.","s04.p1Kicker":"TENUTA HD ANCHE SOTTO SFORZO.","s04.p1Desc":"Corsa, palestra, crossfit, ciclismo: spingi al massimo. Non cede.","s04.p2Title":"Mare, piscina, sauna. Resta invisibile.","s04.p2Hook":"Stai per tuffarti. Gli altri ti guardano. Non ci pensi nemmeno.","s04.p2Kicker":"RESISTENTE A SALE E CLORO.","s04.p2Desc":"Tuffi, nuotate, sauna, sudorazione prolungata: tuffati. La membrana non si muove.","s04.p3Title":"In spiaggia, sotto il sole diretto. Nessuno lo vede.","s04.p3Hook":"La luce più crudele. E nessuno vede niente.","s04.p3Kicker":"ZERO RIFLESSI, ZERO SCALINI.","s04.p3Desc":"Sotto la luce diretta, in spiaggia o in piscina: esci al sole. Non ci pensare.","s05.eyebrow":"05 · Il Confronto","s05.h2":"Patch cutanea vs Invisible Derm.","s05.body":"A sinistra la patch cutanea comune. A destra la nostra attaccatura ad effetto cute viva — [a]Zero-Edge del Invisible Derm[/a].","banner.eyebrow":"— Hair Genius Labs —","banner.h2":"Il segreto è che\n[a]non deve sembrare un segreto.[/a]","faq.eyebrow":"07 · FAQ","faq.h2":"Tutto quello che vuoi sapere.","faq.sub":"Tocca una domanda per espandere la risposta.","s08.eyebrow":"08 · Posti Limitati","s08.h2":"Prenota la tua analisi tecnica.","s08.hook":"Se ci sei arrivato fin qui, la risposta la sai già.","s08.body":"Accettiamo pochi nuovi casi al mese. Analisi [a]gratuita[/a] fino a esaurimento posti.","s08.urgency":"Hai già aspettato abbastanza.","s08.priceLabel":"Valutazione professionale","s08.cta":"Verifica disponibilità e blocca lo slot [a]gratuito[/a]","slogan.eyebrow":"— Invisible Derm —","slogan.h2":"Se non si vede,\n[a]è reale.[/a]","slogan.body":"Indistinguibile dalla cute. Anche a distanza di contatto."},"media":{"s02.media":"","s03.media":"","s05.beforeImage":"","s05.afterImage":""}};

/* ── Strumenti ─────────────────────────────────────────────────────────── */
const L = await carica("src/landing/landing-content.ts", "landing-content-s1");
const R = await carica("src/landing/sito/soluzioni/regole.ts", "regole-s1");
const K = await carica("src/landing/sito/soluzioni/cancello.ts", "cancello-s1");

/* ── S1.0 · le chiavi di oggi non cambiano (E2: solo aggiunte) ─────────── */
{
  const oggi = L.LANDING_SCHEMA.slice(0, FOTO_G1.schema.length).map((s) => [s.id, s.fields.map((f) => [f.key, f.type])]);
  c("le 9 sezioni di oggi: id, chiavi e tipi identici alla fotografia G1", FOTO_G1.schema, oggi);
  const testiOggi = Object.fromEntries(Object.keys(FOTO_G1.texts).map((k) => [k, L.DEFAULT_TEXTS[k]]));
  c("DEFAULT_TEXTS di oggi identici (stesse chiavi, stessi valori)", FOTO_G1.texts, testiOggi);
  const mediaOggi = Object.fromEntries(Object.keys(FOTO_G1.media).map((k) => [k, L.DEFAULT_MEDIA[k]]));
  c("DEFAULT_MEDIA di oggi identici", FOTO_G1.media, mediaOggi);
  const nuoveTesti = Object.keys(L.DEFAULT_TEXTS).filter((k) => !(k in FOTO_G1.texts));
  const nuoveMedia = Object.keys(L.DEFAULT_MEDIA).filter((k) => !(k in FOTO_G1.media));
  vero("le chiavi nuove stanno solo nella sezione v3", [...nuoveTesti, ...nuoveMedia].every((k) => L.LANDING_SCHEMA.at(-1).fields.some((f) => f.key === k)));
  c("la sezione v3 è l'ultima", ["v3", "Landing «Tre soluzioni»"], [L.LANDING_SCHEMA.at(-1).id, L.LANDING_SCHEMA.at(-1).title]);
  c("le sezioni sono 10", 10, L.LANDING_SCHEMA.length);
}

/* ── S1.0 · la sezione v3 (tabella 4.6, nell'ordine della pagina) ──────── */
const ND = "Invisible Derm";
const ALT_VIDEO = `Il titolare di Hair Genius Labs ti guarda in camera, nello studio di Roma, e sta per spiegarti ${ND}.`;
const ALT_RITRATTO = "Il titolare di Hair Genius Labs, in studio, ti guarda e sorride.";
const ALT_TRAPIANTO = "Il titolare di Hair Genius Labs in consulenza: ti guarda in camera, con una mano aperta, nello studio di Roma.";
const ALT_PATCH = "Una patch tenuta in mano su fondo chiaro.";
const ALT_CLIP = "Il pettine solleva l'attaccatura in primo piano, alla luce dello studio.";
const ALT_MACRO = "Primo piano dell'attaccatura frontale di un uomo, con un pettine che solleva i capelli. Video breve senza audio.";
const AIUTO_LIBERATORIA = "Accendilo solo se la liberatoria firmata è in 14-legale o nella scheda del cliente.";
const OPZIONI_CHI = [
  { valore: "titolare", etichetta: "Solo il titolare o un collaboratore" },
  { valore: "cliente", etichetta: "C'è un cliente" },
];
//  chiave, tipo, formato, pesoMax, predefinito
const TABELLA_46 = [
  ["v3.invisibleVideo", "video", "9:16", "10 MB", ""],
  ["v3.invisiblePoster", "image", "4:5", "120 KB", ""],
  ["v3.invisibleVideoAlt", "text", undefined, undefined, ALT_VIDEO],
  ["v3.invisibleSottotitoli", "interruttore", undefined, undefined, ""],
  ["v3.invisibleTrascrizione", "textarea", undefined, undefined, ""],
  ["protocol.titolareFoto", "image", "4:5", undefined, ""],
  ["protocol.titolareFotoAlt", "text", undefined, undefined, ALT_RITRATTO],
  ["v3.trapiantoFoto", "image", "3:2", "80 KB", ""],
  ["v3.trapiantoFotoAlt", "text", undefined, undefined, ALT_TRAPIANTO],
  ["v3.trapiantoChi", "scelta", undefined, undefined, ""],
  ["v3.trapiantoLiberatoria", "interruttore", undefined, undefined, ""],
  ["home.cartaCatalogoFoto", "image", "4:3", undefined, ""],
  ["home.cartaCatalogoFotoAlt", "text", undefined, undefined, ALT_PATCH],
  ["v3.invisibleMiniatura", "image", "3:2", "80 KB", ""],
  ["v3.invisibleMiniaturaAlt", "text", undefined, undefined, ALT_CLIP],
  ["protocol.macroVideo", "video", "4:5", "1,5 MB", ""],
  ["protocol.macroPoster", "image", "4:5", undefined, ""],
  ["protocol.macroVideoAlt", "text", undefined, undefined, ALT_MACRO],
  ["v3.macroChi", "scelta", undefined, undefined, ""],
  ["v3.macroLiberatoria", "interruttore", undefined, undefined, ""],
  ["v3.condivisioneImmagine", "image", "1200x630", "200 KB", ""],
];
{
  const campi = L.LANDING_SCHEMA.at(-1).fields;
  c("v3: le chiavi nell'ordine della pagina", TABELLA_46.map((r) => r[0]), campi.map((f) => f.key));
  for (const [chiave, tipo, formato, peso, predefinito] of TABELLA_46) {
    const f = campi.find((x) => x.key === chiave);
    c(`${chiave}: tipo, formato, peso, predefinito`, [tipo, formato, peso, predefinito], [f?.type, f?.formato, f?.pesoMax, f?.default]);
    vero(`${chiave}: ha un'etichetta`, typeof f?.label === "string" && f.label.length > 3);
    //  I media dicono formato (e peso, dove la 4.6 lo dà) sotto il campo: l'editor li legge da `hint`.
    if (tipo === "image" || tipo === "video") vero(`${chiave}: l'aiuto dice il formato`, typeof f.hint === "string" && /\d/.test(f.hint));
  }
  for (const chi of ["v3.trapiantoChi", "v3.macroChi"]) {
    const f = campi.find((x) => x.key === chi);
    c(`${chi}: le due opzioni, prima il titolare`, OPZIONI_CHI, f.opzioni);
    vero(`${chi}: un aiuto che dice cosa vale se non scegli`, /C'è un cliente/.test(f.hint ?? ""));
  }
  c("sottotitoli: etichetta della 4.6", "Ho controllato: i sottotitoli sono impressi nel video", campi.find((x) => x.key === "v3.invisibleSottotitoli").label);
  for (const k of ["v3.trapiantoLiberatoria", "v3.macroLiberatoria"]) {
    const f = campi.find((x) => x.key === k);
    c(`${k}: etichetta e aiuto della 4.6`, ["Ho la liberatoria scritta", AIUTO_LIBERATORIA], [f.label, f.hint]);
  }
  vero("«Invisible Derm» viene da NOME_PRODOTTO, non è scritto a mano", !/Invisible Derm/.test(leggi("src/landing/landing-content.ts").replace(/NOME_PRODOTTO/g, "")));
}
/* ── Interruttori e scelte vanno in texts (predefinito ""), i media in media ── */
{
  for (const [chiave, tipo] of TABELLA_46) {
    const inTesti = ["text", "textarea", "interruttore", "scelta"].includes(tipo);
    c(`${chiave}: sta in ${inTesti ? "DEFAULT_TEXTS" : "DEFAULT_MEDIA"}`, [inTesti, !inTesti], [chiave in L.DEFAULT_TEXTS, chiave in L.DEFAULT_MEDIA]);
  }
  const m = L.mergeLandingContent({ texts: { "v3.invisibleSottotitoli": "1" } });
  c("un interruttore salvato come «1» sopravvive all'unione", "1", m.texts["v3.invisibleSottotitoli"]);
  c("un interruttore mai salvato vale «»", "", L.mergeLandingContent({}).texts["v3.invisibleSottotitoli"]);
}

/* ── S1.0 · i tipi e i vuoti del cancello e della vista ────────────────── */
{
  vero("VISTA_VUOTA: non pubblicabile, non in anteprima", R.VISTA_VUOTA.pubblicabile === false && R.VISTA_VUOTA.anteprima === false);
  c("VISTA_VUOTA: tutto null", [null, null, null, null, null], [R.VISTA_VUOTA.ritratto, R.VISTA_VUOTA.miniature, R.VISTA_VUOTA.video, R.VISTA_VUOTA.macro, R.VISTA_VUOTA.ogImage]);
  c("VISTA_VUOTA: manca tutto", ["video", "copertina", "sottotitoli"], R.VISTA_VUOTA.mancanti);
  vero("VISTA_VUOTA non si può cambiare per sbaglio (congelata)", Object.isFrozen(R.VISTA_VUOTA));
  for (const f of ["mancantiSoluzioni", "soluzioniPubblicabile", "fraseSemaforo"]) vero(`cancello.ts esporta ${f}`, typeof K[f] === "function");
  for (const f of ["urlMedia", "mostrabile", "vistaSoluzioni", "campo", "destinazioneCancello", "apriDaRicerca", "avvisiFile"]) vero(`regole.ts esporta ${f}`, typeof R[f] === "function");
}

/* ══ S1.1 · le regole ═══════════════════════════════════════════════════ */
const ORIGINE = "https://progetto.supabase.co";
const BUCKET = `${ORIGINE}/storage/v1/object/public/landing-media/`;
const f = (nome) => BUCKET + nome;

/* ── urlMedia: solo https del nostro storage, solo il bucket landing-media ── */
{
  c("un file del bucket passa, com'è", f("video.mp4"), R.urlMedia(f("video.mp4"), ORIGINE));
  c("anche con un parametro di versione", f("a.webp") + "?t=123", R.urlMedia(f("a.webp") + "?t=123", ORIGINE));
  c("spazi ai bordi tolti", f("a.webp"), R.urlMedia("  " + f("a.webp") + " \n", ORIGINE));
  c("sottocartella del bucket", f("v3/a.webp"), R.urlMedia(f("v3/a.webp"), ORIGINE));
  c("l'origine può arrivare con una barra o un percorso: conta solo l'origine", f("a.webp"), R.urlMedia(f("a.webp"), ORIGINE + "/"));
  const NO = {
    "javascript:": "javascript:alert(1)",
    "javascript: col bucket nel testo": "javascript:alert('" + f("a.webp") + "')",
    "data:": "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    "blob:": "blob:" + f("a.webp"),
    "http: (storage vero)": f("a.webp").replace("https:", "http:"),
    "//altro (senza schema)": "//altro.example/storage/v1/object/public/landing-media/a.webp",
    "https://altro-host": "https://altro.example/storage/v1/object/public/landing-media/a.webp",
    "il nostro host come prefisso di un altro": "https://progetto.supabase.co.altro.example/storage/v1/object/public/landing-media/a.webp",
    "il nostro host come utente": "https://progetto.supabase.co@altro.example/storage/v1/object/public/landing-media/a.webp",
    "utente e password": "https://utente:segreto@progetto.supabase.co/storage/v1/object/public/landing-media/a.webp",
    "altro bucket": f("a.webp").replace("landing-media", "anteprime"),
    "bucket con lo stesso inizio": f("a.webp").replace("landing-media/", "landing-media-privato/"),
    "bucket privato (non public)": f("a.webp").replace("/public/", "/sign/"),
    "uscita dal bucket con ..": f("../anteprime/x.jpg"),
    "uscita dal bucket con %2e%2e": f("%2e%2e/anteprime/x.jpg"),
    "uscita dal bucket con %2E%2E": f("%2E%2E/anteprime/x.jpg"),
    "uscita dal bucket con .%2e": f(".%2e/anteprime/x.jpg"),
    "barra rovesciata": f("..\\anteprime\\x.jpg"),
    "barra codificata": f("a%2f..%2f..%2fx.jpg"),
    "solo il bucket, nessun file": BUCKET,
    "uno spazio dentro": f("a b.webp"),
    "un a-capo dentro": f("a\nb.webp"),
    "vuoto": "",
    "solo spazi": "   ",
  };
  for (const [nome, u] of Object.entries(NO)) c(`urlMedia rifiuta: ${nome}`, "", R.urlMedia(u, ORIGINE));
  for (const [nome, u] of Object.entries({ null: null, undefined: undefined, numero: 42, oggetto: {}, lista: [f("a.webp")], booleano: true }))
    c(`urlMedia rifiuta un valore non testo: ${nome}`, "", R.urlMedia(u, ORIGINE));
  //  Storage non valido o ignoto: il cancello resta chiuso.
  for (const o of ["", "non è un indirizzo", "javascript:alert(1)", undefined, null]) c(`origine dello storage ${JSON.stringify(o)} → niente passa`, "", R.urlMedia(f("a.webp"), o));
  //  La deroga: solo la Supabase finta del collaudo (127.0.0.1 o localhost), e solo per il suo host.
  const LOCALE = "http://127.0.0.1:54321";
  const fl = (n) => `${LOCALE}/storage/v1/object/public/landing-media/${n}`;
  c("deroga: http su 127.0.0.1 passa se è l'origine dello storage", fl("a.webp"), R.urlMedia(fl("a.webp"), LOCALE));
  c("deroga: http su localhost passa se è l'origine dello storage", "http://localhost:54321/storage/v1/object/public/landing-media/a.webp", R.urlMedia("http://localhost:54321/storage/v1/object/public/landing-media/a.webp", "http://localhost:54321"));
  c("deroga: un altro host http non passa nemmeno con lo storage locale", "", R.urlMedia("http://altro.example/storage/v1/object/public/landing-media/a.webp", LOCALE));
  c("deroga: un'altra porta non passa", "", R.urlMedia(fl("a.webp").replace("54321", "9999"), LOCALE));
  c("nessuna deroga per un http che non è locale", "", R.urlMedia("http://progetto.example/storage/v1/object/public/landing-media/a.webp", "http://progetto.example"));
  c("https su 127.0.0.1 con storage http locale non passa (altra origine)", "", R.urlMedia(fl("a.webp").replace("http:", "https:"), LOCALE));
}

/* ── mostrabile: la regola della liberatoria ───────────────────────────── */
c("«titolare» → si vede, anche con la liberatoria spenta", true, R.mostrabile("titolare", ""));
c("«titolare» → si vede con la liberatoria accesa", true, R.mostrabile("titolare", "1"));
c("«cliente» + spenta → nascosto", false, R.mostrabile("cliente", ""));
c("«cliente» + accesa → si vede", true, R.mostrabile("cliente", "1"));
c("vuoto vale «cliente»: spenta → nascosto", false, R.mostrabile("", ""));
c("vuoto vale «cliente»: accesa → si vede", true, R.mostrabile("", "1"));
c("un valore strano non apre niente", false, R.mostrabile("Titolare", "true"));

/* ── Contenuti di prova ─────────────────────────────────────────────────── */
const media = (extra = {}) => ({
  "v3.invisibleVideo": f("video.mp4"),
  "v3.invisiblePoster": f("copertina.webp"),
  "protocol.titolareFoto": f("ritratto.webp"),
  "v3.trapiantoFoto": f("trapianto.webp"),
  "home.cartaCatalogoFoto": f("patch.webp"),
  "v3.invisibleMiniatura": f("miniatura.webp"),
  "protocol.macroVideo": f("macro.mp4"),
  "protocol.macroPoster": f("macro-copertina.webp"),
  "v3.condivisioneImmagine": f("og.webp"),
  ...extra,
});
const contenuto = ({ m = {}, t = {} } = {}) => L.mergeLandingContent({ media: media(m), texts: { "v3.invisibleSottotitoli": "1", ...t } });
const OPZ = { origineStorage: ORIGINE, fotoPatchRipiego: null, macroRipiegoOk: false, anteprima: false };
const LIBERE = { "v3.trapiantoChi": "titolare", "v3.macroChi": "titolare" };

/* ── Il cancello (E1) ──────────────────────────────────────────────────── */
{
  c("tutto presente → nessun mancante", [], K.mancantiSoluzioni(contenuto(), ORIGINE));
  c("tutto presente → pubblicabile", true, K.soluzioniPubblicabile(contenuto(), ORIGINE));
  const casi = [
    ["niente video", { m: { "v3.invisibleVideo": "" } }, ["video"]],
    ["niente copertina", { m: { "v3.invisiblePoster": "" } }, ["copertina"]],
    ["sottotitoli spenti", { t: { "v3.invisibleSottotitoli": "" } }, ["sottotitoli"]],
    ["video e copertina", { m: { "v3.invisibleVideo": "", "v3.invisiblePoster": "" } }, ["video", "copertina"]],
    ["video e sottotitoli", { m: { "v3.invisibleVideo": "" }, t: { "v3.invisibleSottotitoli": "" } }, ["video", "sottotitoli"]],
    ["copertina e sottotitoli", { m: { "v3.invisiblePoster": "" }, t: { "v3.invisibleSottotitoli": "" } }, ["copertina", "sottotitoli"]],
    ["niente di niente", { m: { "v3.invisibleVideo": "", "v3.invisiblePoster": "" }, t: { "v3.invisibleSottotitoli": "" } }, ["video", "copertina", "sottotitoli"]],
  ];
  for (const [nome, over, atteso] of casi) {
    c(`mancanti: ${nome}`, atteso, K.mancantiSoluzioni(contenuto(over), ORIGINE));
    c(`non pubblicabile: ${nome}`, false, K.soluzioniPubblicabile(contenuto(over), ORIGINE));
  }
  c("il contenuto di fabbrica non è pubblicabile", false, K.soluzioniPubblicabile(L.DEFAULT_LANDING, ORIGINE));
  c("il contenuto di fabbrica manca di tutto", ["video", "copertina", "sottotitoli"], K.mancantiSoluzioni(L.DEFAULT_LANDING, ORIGINE));
  //  Un indirizzo che urlMedia non lascia passare vale «manca»: il cancello e la vista non si contraddicono mai.
  for (const u of ["javascript:alert(1)", "https://altro.example/video.mp4", f("../x.mp4"), "http://progetto.supabase.co/storage/v1/object/public/landing-media/v.mp4"]) {
    c(`video che non passa urlMedia (${u.slice(0, 30)}…) → manca il video`, ["video"], K.mancantiSoluzioni(contenuto({ m: { "v3.invisibleVideo": u } }), ORIGINE));
    c(`copertina che non passa urlMedia (${u.slice(0, 30)}…) → manca la copertina`, ["copertina"], K.mancantiSoluzioni(contenuto({ m: { "v3.invisiblePoster": u } }), ORIGINE));
  }
  for (const v of ["true", "si", "on", " 1", "1 ", "0", "2"]) c(`sottotitoli «${v}» non è «1» → manca`, ["sottotitoli"], K.mancantiSoluzioni(contenuto({ t: { "v3.invisibleSottotitoli": v } }), ORIGINE));
  c("storage ignoto → il cancello resta chiuso", ["video", "copertina"], K.mancantiSoluzioni(contenuto(), ""));
  c("la frase: pronta", "Pronta per andare online", K.fraseSemaforo([]));
  c("la frase: i tre mancanti (testo del documento)", "Non va online: manca il video, la copertina e la conferma dei sottotitoli", K.fraseSemaforo(["video", "copertina", "sottotitoli"]));
  c("la frase: uno solo", "Non va online: manca il video", K.fraseSemaforo(["video"]));
  c("la frase: due", "Non va online: manca la copertina e la conferma dei sottotitoli", K.fraseSemaforo(["copertina", "sottotitoli"]));
}

/* ── campo ─────────────────────────────────────────────────────────────── */
{
  const cc = L.mergeLandingContent({ texts: { "x.a": "  ciao  ", "x.b": "   ", "x.c": "da {{il tuo numero}}", "x.d": "{{da confermare}}" }, media: { "x.m": " https://a/b " } });
  c("campo: toglie gli spazi", "ciao", R.campo(cc, "x.a"));
  c("campo: solo spazi → null", null, R.campo(cc, "x.b"));
  c("campo: con «{{» → null", null, R.campo(cc, "x.c"));
  c("campo: «{{da confermare}}» → null", null, R.campo(cc, "x.d"));
  c("campo: chiave che non c'è → null", null, R.campo(cc, "x.zzz"));
  c("campo: legge anche i media", "https://a/b", R.campo(cc, "x.m"));
  c("campo: un testo di fabbrica", "", R.campo(L.DEFAULT_LANDING, "v3.invisibleTrascrizione") ?? "");
}

/* ── vistaSoluzioni ────────────────────────────────────────────────────── */
{
  const v = R.vistaSoluzioni(contenuto(), OPZ);
  c("pubblicabile, non in anteprima, nessun mancante", [true, false, []], [v.pubblicabile, v.anteprima, v.mancanti]);
  c("il video: indirizzo, copertina, descrizione di fabbrica", [f("video.mp4"), f("copertina.webp"), L.DEFAULT_TEXTS["v3.invisibleVideoAlt"]], [v.video?.slot.src, v.video?.slot.poster, v.video?.slot.alt]);
  c("senza trascrizione → null", null, v.video?.trascrizione);
  c("il ritratto, con la sua descrizione", [f("ritratto.webp"), L.DEFAULT_TEXTS["protocol.titolareFotoAlt"]], [v.ritratto?.src, v.ritratto?.alt]);
  c("immagine di condivisione: la sua", f("og.webp"), v.ogImage);
  c("miniature: «chi si vede» vuoto e liberatorie spente → nascoste (tutte e tre)", null, v.miniature);
  c("macro: «chi si vede» vuoto e liberatoria spenta → nascosta", null, v.macro);
  c("trascrizione: le parole del CRM, ripulite", "Ciao. Sono io.", R.vistaSoluzioni(contenuto({ t: { "v3.invisibleTrascrizione": "  Ciao. Sono io.  " } }), OPZ).video?.trascrizione);
  c("trascrizione con «{{» → null", null, R.vistaSoluzioni(contenuto({ t: { "v3.invisibleTrascrizione": "{{da scrivere}}" } }), OPZ).video?.trascrizione);
  c("ritratto mancante → null", null, R.vistaSoluzioni(contenuto({ m: { "protocol.titolareFoto": "" } }), OPZ).ritratto);
  c("ritratto con indirizzo ostile → null", null, R.vistaSoluzioni(contenuto({ m: { "protocol.titolareFoto": "javascript:alert(1)" } }), OPZ).ritratto);
  c("ritratto: descrizione cancellata → vuota (il ripiego sulla frase di fabbrica lo fa il server, in contenuti.ts)", "", R.vistaSoluzioni(contenuto({ t: { "protocol.titolareFotoAlt": "  " } }), OPZ).ritratto?.alt);
  c("condivisione mancante → la copertina", f("copertina.webp"), R.vistaSoluzioni(contenuto({ m: { "v3.condivisioneImmagine": "" } }), OPZ).ogImage);
  c("condivisione ostile → la copertina", f("copertina.webp"), R.vistaSoluzioni(contenuto({ m: { "v3.condivisioneImmagine": "https://altro.example/og.jpg" } }), OPZ).ogImage);
}
{
  //  Miniature e macro con le liberatorie a posto.
  const t = LIBERE;
  const v = R.vistaSoluzioni(contenuto({ t }), { ...OPZ });
  c("miniature: le tre, in ordine", [f("trapianto.webp"), f("patch.webp"), f("miniatura.webp")], [v.miniature?.trapianto.src, v.miniature?.patch.src, v.miniature?.invisibile.src]);
  c("miniature: gli alt di fabbrica", [L.DEFAULT_TEXTS["v3.trapiantoFotoAlt"], L.DEFAULT_TEXTS["home.cartaCatalogoFotoAlt"], L.DEFAULT_TEXTS["v3.invisibleMiniaturaAlt"]], [v.miniature?.trapianto.alt, v.miniature?.patch.alt, v.miniature?.invisibile.alt]);
  c("macro: video, copertina e descrizione", [f("macro.mp4"), f("macro-copertina.webp"), L.DEFAULT_TEXTS["protocol.macroVideoAlt"]], [v.macro?.src, v.macro?.poster, v.macro?.alt]);

  //  «Cliente» con liberatoria accesa: si vede. Senza: no.
  const cliente = (lib) => R.vistaSoluzioni(contenuto({ t: { "v3.trapiantoChi": "cliente", "v3.trapiantoLiberatoria": lib, "v3.macroChi": "cliente", "v3.macroLiberatoria": lib } }), OPZ);
  c("cliente + liberatoria accesa → miniature e macro", [true, true], [!!cliente("1").miniature, !!cliente("1").macro]);
  c("cliente + liberatoria spenta → né miniature né macro", [false, false], [!!cliente("").miniature, !!cliente("").macro]);

  //  Tutte o nessuna (4.2): tolta una qualunque delle tre, spariscono tutte.
  const senza = (over, opz = {}) => R.vistaSoluzioni(contenuto({ t, ...over }), { ...OPZ, ...opz }).miniature;
  c("manca la foto del trapianto → nessuna miniatura", null, senza({ m: { "v3.trapiantoFoto": "" } }));
  c("foto del trapianto ostile → nessuna miniatura", null, senza({ m: { "v3.trapiantoFoto": "javascript:alert(1)" } }));
  c("liberatoria del trapianto mancante → nessuna miniatura", null, senza({ t: { "v3.trapiantoChi": "cliente", "v3.trapiantoLiberatoria": "" } }));
  c("manca la patch e il ripiego → nessuna miniatura", null, senza({ m: { "home.cartaCatalogoFoto": "" } }));
  c("manca la miniatura di Invisible Derm e anche la copertina della macro → nessuna miniatura", null, senza({ m: { "v3.invisibleMiniatura": "", "protocol.macroPoster": "" } }));
  c("liberatoria della macro mancante → nessuna miniatura (la miniatura segue «chi si vede» della macro)", null, senza({ t: { "v3.macroChi": "cliente", "v3.macroLiberatoria": "" } }));
  //  I ripieghi.
  const ripiegoPatch = senza({ m: { "home.cartaCatalogoFoto": "" } }, { fotoPatchRipiego: "/assets/shop/patch.webp" });
  c("ripiego della patch: la foto del primo articolo (valore del codice, non passa da urlMedia)", "/assets/shop/patch.webp", ripiegoPatch?.patch.src);
  c("ripiego della patch: alt di fabbrica", L.DEFAULT_TEXTS["home.cartaCatalogoFotoAlt"], ripiegoPatch?.patch.alt);
  c("la foto della patch scelta nel CRM vince sul ripiego", f("patch.webp"), senza({}, { fotoPatchRipiego: "/assets/shop/altro.webp" })?.patch.src);
  c("patch del CRM ostile e ripiego presente → usa il ripiego", "/assets/shop/patch.webp", senza({ m: { "home.cartaCatalogoFoto": "https://altro.example/p.webp" } }, { fotoPatchRipiego: "/assets/shop/patch.webp" })?.patch.src);
  c("ripiego della miniatura: la copertina della macro", f("macro-copertina.webp"), senza({ m: { "v3.invisibleMiniatura": "" } })?.invisibile.src);
  c("ripiego della miniatura: alt della miniatura", L.DEFAULT_TEXTS["v3.invisibleMiniaturaAlt"], senza({ m: { "v3.invisibleMiniatura": "" } })?.invisibile.alt);
  //  Macro: video + copertina + liberatoria; ripiego s03.media solo con macroRipiegoOk.
  const macro = (m, opz = {}, tt = t) => R.vistaSoluzioni(contenuto({ t: tt, m }), { ...OPZ, ...opz }).macro;
  c("macro senza copertina → niente macro (la copertina è obbligatoria)", null, macro({ "protocol.macroPoster": "" }));
  c("macro senza video e senza ripiego → niente", null, macro({ "protocol.macroVideo": "" }));
  c("ripiego s03.media NON ammesso (macroRipiegoOk falso) → niente", null, macro({ "protocol.macroVideo": "", "s03.media": f("s03.mp4") }));
  c("ripiego s03.media ammesso → il video di s03", f("s03.mp4"), macro({ "protocol.macroVideo": "", "s03.media": f("s03.mp4") }, { macroRipiegoOk: true })?.src);
  c("ripiego s03.media ammesso ma senza copertina → niente", null, macro({ "protocol.macroVideo": "", "s03.media": f("s03.mp4"), "protocol.macroPoster": "" }, { macroRipiegoOk: true }));
  c("ripiego s03.media ostile → niente, anche se ammesso", null, macro({ "protocol.macroVideo": "", "s03.media": "https://altro.example/s.mp4" }, { macroRipiegoOk: true }));
  c("il video della macro vince sul ripiego", f("macro.mp4"), macro({ "s03.media": f("s03.mp4") }, { macroRipiegoOk: true })?.src);
  c("macro con indirizzo ostile → niente", null, macro({ "protocol.macroVideo": "javascript:alert(1)" }));
}
{
  //  Cancello chiuso: nessun file esce, nemmeno il ritratto (condizione 2 del revisore).
  const chiuso = { m: { "v3.invisibleVideo": "" } };
  const v = R.vistaSoluzioni(contenuto({ ...chiuso, t: LIBERE }), OPZ);
  c("cancello chiuso e niente anteprima → la vista vuota, con i mancanti", { ...R.VISTA_VUOTA, mancanti: ["video"] }, v);
  c("cancello chiuso: nessun indirizzo di file nel testo", false, /landing-media/.test(JSON.stringify(v)));
  const a = R.vistaSoluzioni(contenuto({ ...chiuso, t: LIBERE }), { ...OPZ, anteprima: true });
  c("anteprima col cancello chiuso: si vede il resto, il video è null", [false, true, ["video"], null, true], [a.pubblicabile, a.anteprima, a.mancanti, a.video, !!a.ritratto]);
  const b = R.vistaSoluzioni(contenuto({ t: { "v3.invisibleSottotitoli": "" } }), { ...OPZ, anteprima: true });
  c("anteprima con video e copertina ma sottotitoli spenti: il video SI VEDE (la riga dirà cosa manca)", [f("video.mp4"), ["sottotitoli"], false], [b.video?.slot.src, b.mancanti, b.pubblicabile]);
  const d = R.vistaSoluzioni(contenuto({ m: { "v3.invisiblePoster": "" } }), { ...OPZ, anteprima: true });
  c("anteprima con il video ma senza copertina: niente video (la copertina è obbligatoria)", null, d.video);
  c("pubblicabile + anteprima: la vista piena, con anteprima vera", [true, true, true], [R.vistaSoluzioni(contenuto(), { ...OPZ, anteprima: true }).pubblicabile, R.vistaSoluzioni(contenuto(), { ...OPZ, anteprima: true }).anteprima, !!R.vistaSoluzioni(contenuto(), { ...OPZ, anteprima: true }).video]);
  c("il contenuto di fabbrica, senza anteprima → la vista vuota", JSON.stringify(R.VISTA_VUOTA), JSON.stringify(R.vistaSoluzioni(L.DEFAULT_LANDING, OPZ)));
}

/* ── ripiegoMacroDaVerificare: la HEAD si fa solo quando serve (nota (a) del revisore) ── */
{
  const v = (m, t = LIBERE) => R.ripiegoMacroDaVerificare(contenuto({ t, m: { "protocol.macroVideo": "", "s03.media": f("s03.mp4"), ...m } }), ORIGINE);
  c("clip propria assente, copertina, «chi si vede» ok, s03 valido → l'indirizzo da controllare", f("s03.mp4"), v({}));
  c("la clip propria c'è → niente da controllare", null, R.ripiegoMacroDaVerificare(contenuto({ t: LIBERE, m: { "s03.media": f("s03.mp4") } }), ORIGINE));
  c("manca la copertina → niente", null, v({ "protocol.macroPoster": "" }));
  c("«chi si vede» vuoto e liberatoria spenta (come oggi in produzione) → niente: nessuna HEAD", null, v({}, {}));
  c("s03.media assente → niente", null, v({ "s03.media": "" }));
  c("s03.media ostile → niente", null, v({ "s03.media": "https://altro.example/s.mp4" }));
}

/* ── Cosa NON deve finire nell'HTML (V11, M8, Rischi 5) ────────────────── */
{
  const VIETATE = ["Verificato", "1326", "€", "47", "{{", "da confermare", "invisibile", "Indistinguibile", "indistinguibile", "GRATIS", "0.03", "Reticolazione", "Bio-Mimetic"];
  const TESTI_VECCHI = Object.entries(L.DEFAULT_TEXTS).filter(([k]) => /^(hero|s0\d|faq|banner|slogan)\./.test(k)).map(([, valore]) => valore);
  const guarda = (nome, vista, nascosti = []) => {
    const j = JSON.stringify(vista);
    for (const parola of VIETATE) vero(`${nome}: niente «${parola}»`, !j.includes(parola));
    vero(`${nome}: nessun testo hero.* / s0* / faq.* / banner / slogan`, TESTI_VECCHI.every((t) => !t || !j.includes(t.slice(0, 25))));
    for (const u of nascosti) vero(`${nome}: l'indirizzo nascosto non c'è (${u.slice(-24)})`, !j.includes(u));
  };
  guarda("contenuto di fabbrica", R.vistaSoluzioni(L.DEFAULT_LANDING, OPZ));
  //  Contenuto pieno ma con le liberatorie spente: i file con una persona non ci sono.
  const pieno = contenuto({ t: { "v3.invisibleTrascrizione": "Ciao, sono io." } });
  guarda("contenuto pieno, liberatorie spente", R.vistaSoluzioni(pieno, OPZ), [f("trapianto.webp"), f("miniatura.webp"), f("macro.mp4"), f("macro-copertina.webp")]);
  //  Un testo ostile del CRM resta testo: la vista lo tiene com'è (lo scrive React come testo), ma non inventa niente in più.
  const ostile = R.vistaSoluzioni(contenuto({ t: { "v3.invisibleTrascrizione": "</script><img src=x onerror=alert(1)>" } }), OPZ);
  c("trascrizione ostile: arriva come semplice testo, intera", "</script><img src=x onerror=alert(1)>", ostile.video?.trascrizione);
  //  Il giro completo: JSON e ritorno, nessun valore che non sia serializzabile.
  const j = JSON.parse(JSON.stringify(R.vistaSoluzioni(pieno, OPZ)));
  c("la vista passa da JSON senza perdere niente", JSON.stringify(R.vistaSoluzioni(pieno, OPZ)), JSON.stringify(j));
  //  Le chiavi della vista sono quelle del contratto, né una di più (non scappa mai un LandingContent).
  c("chiavi della vista", ["anteprima", "macro", "mancanti", "miniature", "ogImage", "pubblicabile", "ritratto", "video"], Object.keys(R.vistaSoluzioni(pieno, OPZ)).sort());
  vero("regole.ts è puro: niente window, document, supabase, fetch", !/\b(window|document|localStorage|sessionStorage|fetch)\b|supabase/i.test(leggi("src/landing/sito/soluzioni/regole.ts").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")));
  vero("cancello.ts è puro: niente window, document, supabase, fetch", !/\b(window|document|localStorage|sessionStorage|fetch)\b|supabase/i.test(leggi("src/landing/sito/soluzioni/cancello.ts").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "")));
}

/* ── destinazioneCancello: "/" e basta, con la sola fonte dell'annuncio ── */
{
  const tutti = "utm_source=ig&utm_medium=cpc&utm_campaign=autunno&utm_content=a1&utm_term=capelli&utm_id=77&fbclid=FB1&gclid=G1&ttclid=T1&ad_id=11&adset_id=22&campaign_id=33";
  c("tiene i parametri di tracciamento, nell'ordine", "/?" + tutti, R.destinazioneCancello("?apri=invisible-derm&" + tutti + "&anteprima=ABC&x=1&y=2"));
  c("senza «?» davanti", "/?utm_source=ig", R.destinazioneCancello("utm_source=ig"));
  c("toglie «apri» e «anteprima»", "/", R.destinazioneCancello("?apri=invisible-derm&anteprima=ABC"));
  c("vuoto → «/»", "/", R.destinazioneCancello(""));
  c("solo «?» → «/»", "/", R.destinazioneCancello("?"));
  c("un parametro vuoto non si porta dietro", "/?utm_source=ig", R.destinazioneCancello("?utm_source=ig&utm_medium=&fbclid="));
  c("una chiave che finge di essere utm_ ma ha caratteri strani non passa", "/", R.destinazioneCancello("?utm_<script>=1&utm_a.b=2&UTM_x=3&utm_=4"));
  c("un valore troppo lungo non passa", "/?fbclid=ok", R.destinazioneCancello("?utm_source=" + "a".repeat(300) + "&fbclid=ok"));
  const ostile = R.destinazioneCancello("?utm_source=a%0d%0aSet-Cookie:x=1&utm_medium=%2F%2Faltro.example");
  vero("a-capo nel valore → codificato, mai un'intestazione in più", !/[\r\n]/.test(ostile) && ostile.startsWith("/?"));
  for (const s of ["//altro.example", "?//altro.example", "https://altro.example", "\\\\altro.example", "?utm_source=//altro.example"]) vero(`mai fuori dal sito: ${JSON.stringify(s)}`, /^\/(\?|$)/.test(R.destinazioneCancello(s)) && !R.destinazioneCancello(s).startsWith("//"));
  c("valori con spazi e accenti restano codificati", "/?utm_campaign=autunno+2026&utm_content=caff%C3%A8", R.destinazioneCancello("?utm_campaign=autunno%202026&utm_content=caffè"));
  c("non c'è il #: il browser non lo manda al server", "/", R.destinazioneCancello("#invisible-derm"));
}

/* ── apriDaRicerca ─────────────────────────────────────────────────────── */
{
  c("{apri: invisible-derm}", true, R.apriDaRicerca({ apri: "invisible-derm" }));
  c("«?apri=invisible-derm»", true, R.apriDaRicerca("?apri=invisible-derm"));
  c("«apri=invisible-derm&utm_source=ig»", true, R.apriDaRicerca("apri=invisible-derm&utm_source=ig"));
  for (const [nome, v] of Object.entries({ "altro valore": { apri: "altro" }, maiuscole: { apri: "Invisible-Derm" }, "lista": { apri: ["invisible-derm"] }, numero: { apri: 1 }, vuoto: {}, undefined: undefined, null: null, testo: "invisible-derm", "un'altra chiave": "?apri2=invisible-derm", "valore con coda": "?apri=invisible-derm-2" })) c(`no: ${nome}`, false, R.apriDaRicerca(v));
}

/* ── avvisiFile: avvisi che non bloccano, per l'editor ─────────────────── */
{
  const MB = 1024 * 1024;
  const video = { type: "video", formato: "9:16", pesoMax: "10 MB" };
  const ok = { tipo: "video/mp4", larghezza: 720, altezza: 1280, byte: 5 * MB };
  c("video giusto → nessun avviso", [], R.avvisiFile(ok, video));
  const a1 = R.avvisiFile({ ...ok, tipo: "video/quicktime" }, video);
  c("video non mp4 → un avviso che dice MP4", [1, true], [a1.length, /MP4/.test(a1[0] ?? "")]);
  const a2 = R.avvisiFile({ ...ok, byte: 11 * MB }, video);
  c("video troppo pesante → un avviso col massimo", [1, true], [a2.length, /10 MB/.test(a2[0] ?? "")]);
  const a3 = R.avvisiFile({ ...ok, larghezza: 1920, altezza: 1080 }, video);
  c("video orizzontale al posto di 9:16 → un avviso col formato", [1, true], [a3.length, /9:16/.test(a3[0] ?? "")]);
  c("9:16 con qualche pixel di scarto va bene", [], R.avvisiFile({ ...ok, larghezza: 718, altezza: 1280 }, video));
  const imm = { type: "image", formato: "4:5", pesoMax: "120 KB" };
  const io = { tipo: "image/webp", larghezza: 800, altezza: 1000, byte: 100 * 1024 };
  c("immagine giusta → nessun avviso", [], R.avvisiFile(io, imm));
  for (const t of ["image/webp", "image/jpeg", "image/png"]) c(`immagine ${t} ammessa`, [], R.avvisiFile({ ...io, tipo: t }, imm));
  for (const t of ["image/gif", "image/svg+xml", "video/mp4", "application/pdf", ""]) c(`immagine ${JSON.stringify(t)} → avviso`, 1, R.avvisiFile({ ...io, tipo: t }, imm).length);
  c("un video con tipo da immagine → avviso", 1, R.avvisiFile({ ...ok, tipo: "image/webp" }, video).length);
  c("immagine quadrata al posto di 4:5 → avviso", 1, R.avvisiFile({ ...io, larghezza: 1000, altezza: 1000 }, imm).length);
  c("immagine 130 KB su 120 KB → avviso col massimo", [1, true], [R.avvisiFile({ ...io, byte: 130 * 1024 }, imm).length, /120 KB/.test(R.avvisiFile({ ...io, byte: 130 * 1024 }, imm)[0])]);
  c("peso a virgola («1,5 MB»): 1,4 MB va bene", [], R.avvisiFile({ ...ok, larghezza: 800, altezza: 1000, byte: 1.4 * MB }, { type: "video", formato: "4:5", pesoMax: "1,5 MB" }));
  c("peso a virgola («1,5 MB»): 1,6 MB → avviso", 1, R.avvisiFile({ ...ok, larghezza: 800, altezza: 1000, byte: 1.6 * MB }, { type: "video", formato: "4:5", pesoMax: "1,5 MB" }).length);
  const og = { type: "image", formato: "1200x630", pesoMax: "200 KB" };
  c("1200×630 esatto → nessun avviso", [], R.avvisiFile({ tipo: "image/jpeg", larghezza: 1200, altezza: 630, byte: 150 * 1024 }, og));
  c("1200×800 al posto di 1200×630 → avviso", 1, R.avvisiFile({ tipo: "image/jpeg", larghezza: 1200, altezza: 800, byte: 150 * 1024 }, og).length);
  c("tre cose storte insieme → tre avvisi", 3, R.avvisiFile({ tipo: "image/gif", larghezza: 1000, altezza: 1000, byte: 500 * 1024 }, imm).length);
  c("senza misure note (0 o NaN) le proporzioni non si giudicano", [], R.avvisiFile({ ...io, larghezza: 0, altezza: 0 }, imm));
  c("senza misure note (NaN) neanche", [], R.avvisiFile({ ...io, larghezza: NaN, altezza: NaN }, imm));
  c("un campo di testo non ha avvisi", [], R.avvisiFile({ tipo: "", larghezza: 0, altezza: 0, byte: 0 }, { type: "text" }));
  c("senza formato né peso: solo il tipo", [], R.avvisiFile(io, { type: "image" }));
  vero("gli avvisi sono frasi in italiano, non codici", R.avvisiFile({ tipo: "image/gif", larghezza: 1000, altezza: 1000, byte: 500 * 1024 }, imm).every((x) => typeof x === "string" && x.length > 15 && /[a-z]{3}/.test(x)));
  //  Il formato di ogni media dello schema è un formato che l'avviso sa leggere.
  for (const campo of L.LANDING_SCHEMA.at(-1).fields.filter((x) => x.formato))
    c(`${campo.key}: un file giusto non dà avvisi`, [], R.avvisiFile({ tipo: campo.type === "video" ? "video/mp4" : "image/webp", larghezza: campo.formato === "1200x630" ? 1200 : campo.formato.split(":")[0] * 100, altezza: campo.formato === "1200x630" ? 630 : campo.formato.split(":")[1] * 100, byte: 1024 }, campo));
}

/* ══ S1.2 · il codice d'anteprima ═══════════════════════════════════════ */
const A = await carica("src/landing/sito/soluzioni/anteprima.ts", "anteprima-s1");
{
  const ADESSO = new Date("2026-10-14T10:00:00.000Z");
  c("la chiave in app_config", "anteprima-soluzioni", A.CHIAVE_ANTEPRIMA);
  const n = A.nuovoCodice(ADESSO);
  c("nuovoCodice: 32 caratteri esadecimali", true, /^[0-9a-f]{32}$/.test(n.codice));
  c("nuovoCodice: scade fra 30 minuti (ISO)", "2026-10-14T10:30:00.000Z", n.scade);
  c("nuovoCodice: usa i byte che gli dà il generatore sicuro", "ab".repeat(16), A.nuovoCodice(ADESSO, (b) => b.fill(0xab)).codice);
  //  Mai Math.random: il codice è una chiave, non un numero da lotteria.
  const vero_random = Math.random;
  Math.random = () => { throw new Error("Math.random non si usa per il codice"); };
  let codici;
  try { codici = new Set(Array.from({ length: 200 }, () => A.nuovoCodice().codice)); } finally { Math.random = vero_random; }
  c("200 codici, 200 diversi, senza toccare Math.random", 200, codici.size);
  const sorgenteA = leggi("src/landing/sito/soluzioni/anteprima.ts").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  vero("anteprima.ts nasce da crypto.getRandomValues", /crypto\.getRandomValues/.test(sorgenteA));
  vero("anteprima.ts non nomina Math.random", !/Math\.random/.test(sorgenteA));

  const salvato = { codice: "a".repeat(32), scade: "2026-10-14T10:30:00.000Z" };
  const giusto = "a".repeat(32);
  c("valido: codice giusto, non scaduto", true, A.codiceValido(salvato, giusto, ADESSO));
  c("valido: il valore salvato come testo JSON (app_config.value è testo)", true, A.codiceValido(JSON.stringify(salvato), giusto, ADESSO));
  c("valido fino all'ultimo istante", true, A.codiceValido(salvato, giusto, new Date("2026-10-14T10:29:59.999Z")));
  c("scaduto allo scadere", false, A.codiceValido(salvato, giusto, new Date("2026-10-14T10:30:00.000Z")));
  c("scaduto dopo", false, A.codiceValido(salvato, giusto, new Date("2026-10-14T11:00:00.000Z")));
  c("sbagliato di un carattere", false, A.codiceValido(salvato, "a".repeat(31) + "b", ADESSO));
  c("sbagliato di lunghezza", false, A.codiceValido(salvato, "a".repeat(31), ADESSO));
  c("con uno spazio in fondo", false, A.codiceValido(salvato, giusto + " ", ADESSO));
  c("maiuscolo non è lo stesso codice", false, A.codiceValido({ ...salvato, codice: "ab".repeat(16) }, "AB".repeat(16), ADESSO));
  for (const dato of ["", undefined, null, 1, {}, [giusto], true]) c(`assente o non testo (${JSON.stringify(dato)})`, false, A.codiceValido(salvato, dato, ADESSO));
  for (const rotto of [null, undefined, "", "non json", "[]", "42", {}, [], { codice: giusto }, { scade: salvato.scade }, { codice: 1, scade: salvato.scade }, { codice: giusto, scade: "ieri" }, { codice: giusto, scade: 12 }, { codice: "corto", scade: salvato.scade }])
    c(`salvato rotto (${JSON.stringify(rotto)}) → mai valido`, false, A.codiceValido(rotto, giusto, ADESSO));
  c("un salvato corto con un dato corto uguale non apre", false, A.codiceValido({ codice: "", scade: salvato.scade }, "", ADESSO));
  //  Riuso: titolare e collaboratore che guardano insieme non si annullano a vicenda.
  c("riuso: un codice ancora valido si ricorda com'è", salvato, A.codiceDaRiusare(salvato, ADESSO));
  c("riuso: anche dal testo JSON", salvato, A.codiceDaRiusare(JSON.stringify(salvato), ADESSO));
  c("riuso: scaduto → null (se ne fa uno nuovo)", null, A.codiceDaRiusare(salvato, new Date("2026-10-14T10:31:00.000Z")));
  c("riuso: rotto → null", null, A.codiceDaRiusare("non json", ADESSO));
  c("riuso: assente → null", null, A.codiceDaRiusare(null, ADESSO));
}

/* ══ S1.2 · leggiSoluzioni, con un client finto ═════════════════════════ */
const C = await carica("src/landing/sito/soluzioni/contenuti.ts", "contenuti-s1");
{
  const ADESSO = new Date("2026-10-14T10:00:00.000Z");
  const CODICE = "c".repeat(32);
  const CONFIG = JSON.stringify({ codice: CODICE, scade: "2026-10-14T10:30:00.000Z" });
  const avvisi = [];
  const veraWarn = console.warn;
  console.warn = (...a) => avvisi.push(a.join(" "));

  /** Un client finto che somiglia a quello vero e registra cosa gli viene chiesto. */
  function cliente({ landing = { data: { data: null }, error: null }, config = { data: { value: CONFIG }, error: null }, comportamento = "risponde" } = {}) {
    const reg = { letture: [], segnali: [] };
    return {
      reg,
      from(tabella) {
        if (comportamento === "lancia") throw new Error("client rotto");
        return {
          select(colonne) {
            return {
              eq(k, v) {
                return {
                  abortSignal(segnale) {
                    reg.segnali.push(segnale);
                    return {
                      maybeSingle() {
                        reg.letture.push({ tabella, colonne, k, v });
                        if (comportamento === "muto") return new Promise(() => {});
                        if (comportamento === "muto-ma-abortisce")
                          return new Promise((_, no) => segnale.addEventListener("abort", () => no(new Error("abortito")), { once: true }));
                        return Promise.resolve(tabella === "app_config" ? config : landing);
                      },
                    };
                  },
                };
              },
            };
          },
        };
      },
    };
  }
  const dati = (m = {}, t = {}) => ({ media: media(m), texts: { "v3.invisibleSottotitoli": "1", ...t } });
  const conLanding = (m, t) => ({ data: { data: dati(m, t) }, error: null });
  const dip = (cl, extra = {}) => ({ client: cl, origineStorage: ORIGINE, fotoPatchRipiego: null, verificaClip: async () => false, adesso: () => ADESSO, ...extra });
  const chiusa = (mancanti) => ({ ...R.VISTA_VUOTA, mancanti });

  //  Una pagina pronta, senza codice: nessuna lettura di app_config.
  {
    const cl = cliente({ landing: conLanding() });
    const v = await C.leggiVista(dip(cl), "");
    c("pagina pronta: pubblicabile, non anteprima, con il video", [true, false, f("video.mp4")], [v.pubblicabile, v.anteprima, v.video?.slot.src]);
    c("una sola lettura: landing_content, id = default, solo la colonna data", [{ tabella: "landing_content", colonne: "data", k: "id", v: "default" }], cl.reg.letture);
    c("la lettura porta un AbortSignal", [true], cl.reg.segnali.map((s) => s instanceof AbortSignal));
  }
  //  Il cancello chiuso, con tutti i modi di bussare.
  {
    const chiuso = { m: { "v3.invisibleVideo": "" }, t: LIBERE };
    const lettura = () => conLanding(chiuso.m, chiuso.t);
    c("cancello chiuso, nessun codice → vista vuota, con i mancanti, nemmeno il ritratto", chiusa(["video"]), await C.leggiVista(dip(cliente({ landing: lettura() })), ""));
    c("cancello chiuso, codice sbagliato → vista vuota", chiusa(["video"]), await C.leggiVista(dip(cliente({ landing: lettura() })), "d".repeat(32)));
    c("cancello chiuso, codice giusto ma scaduto → vista vuota", chiusa(["video"]), await C.leggiVista(dip(cliente({ landing: lettura() }), { adesso: () => new Date("2026-10-14T11:00:00.000Z") }), CODICE));
    c("cancello chiuso, app_config senza il codice → vista vuota", chiusa(["video"]), await C.leggiVista(dip(cliente({ landing: lettura(), config: { data: null, error: null } })), CODICE));
    c("cancello chiuso, app_config con un valore rotto → vista vuota", chiusa(["video"]), await C.leggiVista(dip(cliente({ landing: lettura(), config: { data: { value: "non json" }, error: null } })), CODICE));
    c("cancello chiuso, lettura del codice in errore → vista vuota", chiusa(["video"]), await C.leggiVista(dip(cliente({ landing: lettura(), config: { data: null, error: { message: "boom" } } })), CODICE));
    const buona = await C.leggiVista(dip(cliente({ landing: lettura() })), CODICE);
    c("cancello chiuso, codice giusto → anteprima: il resto si vede, il video no", [false, true, ["video"], null, true], [buona.pubblicabile, buona.anteprima, buona.mancanti, buona.video, !!buona.ritratto]);
    const cl2 = cliente({ landing: lettura() });
    await C.leggiVista(dip(cl2), CODICE);
    c("col codice si legge anche app_config, alla chiave giusta", [{ tabella: "app_config", colonne: "value", k: "key", v: "anteprima-soluzioni" }], cl2.reg.letture.filter((l) => l.tabella === "app_config"));
    //  Cancello aperto: un codice sbagliato non cambia niente, uno giusto accende l'anteprima.
    c("cancello aperto, codice sbagliato → pagina normale, non anteprima", [true, false], ((v) => [v.pubblicabile, v.anteprima])(await C.leggiVista(dip(cliente({ landing: conLanding() })), "d".repeat(32))));
    c("cancello aperto, codice giusto → anteprima", [true, true], ((v) => [v.pubblicabile, v.anteprima])(await C.leggiVista(dip(cliente({ landing: conLanding() })), CODICE)));
    c("cancello aperto, lettura del codice in errore → pagina normale", [true, false], ((v) => [v.pubblicabile, v.anteprima])(await C.leggiVista(dip(cliente({ landing: conLanding(), config: { data: null, error: { message: "boom" } } })), CODICE)));
  }
  //  Errori, righe che mancano, storage ignoto: sempre la vista vuota, mai un'eccezione.
  {
    c("riga mancante (data nulla) → vista vuota", R.VISTA_VUOTA, await C.leggiVista(dip(cliente({ landing: { data: null, error: null } })), ""));
    c("errore del database → vista vuota", R.VISTA_VUOTA, await C.leggiVista(dip(cliente({ landing: { data: null, error: { message: "boom" } } })), ""));
    c("client che lancia → vista vuota", R.VISTA_VUOTA, await C.leggiVista(dip(cliente({ comportamento: "lancia" })), ""));
    c("storage ignoto → il cancello resta chiuso", chiusa(["video", "copertina"]), await C.leggiVista(dip(cliente({ landing: conLanding() }), { origineStorage: "" }), ""));
    vero("gli errori si dicono in una riga, senza segreti", avvisi.length >= 3 && avvisi.every((a) => a.length < 200 && !/service|secret|key/i.test(a)));
  }
  //  Il tetto: Supabase che non risponde non tiene la pagina appesa.
  {
    const partenza = Date.now();
    const clMuto = cliente({ comportamento: "muto" });
    const clAbort = cliente({ comportamento: "muto-ma-abortisce" });
    const [a, b] = await Promise.all([C.leggiVista(dip(clMuto), ""), C.leggiVista(dip(clAbort), "")]);
    const durata = Date.now() - partenza;
    c("lettura che non risponde (ignora l'abort) → vista vuota", R.VISTA_VUOTA, a);
    c("lettura che non risponde (rispetta l'abort) → vista vuota", R.VISTA_VUOTA, b);
    vero(`il tetto regge: ${durata} ms < 1600`, durata < 1600);
    vero(`…e non scatta prima di 1,4 s (${durata} ms): una lettura lenta ma viva ha il suo tempo`, durata >= 1400);
    await new Promise((r) => setTimeout(r, 120));
    c("l'abort è arrivato alla lettura", [true, true], [clMuto.reg.segnali[0].aborted, clAbort.reg.segnali[0].aborted]);
    vero("il tetto è 1500 ms", C.TETTO_MS === 1500);
    vero("la lettura vera usa .abortSignal(AbortSignal.timeout(…))", /AbortSignal\.timeout\(TETTO_MS\)/.test(leggi("src/landing/sito/soluzioni/contenuti.ts")) && /\.abortSignal\(/.test(leggi("src/landing/sito/soluzioni/contenuti.ts")));
  }
  //  I testi di descrizione cancellati nel CRM tornano quelli di fabbrica (accessibilità).
  {
    const v = await C.leggiVista(dip(cliente({ landing: conLanding({}, { "protocol.titolareFotoAlt": "  ", "v3.invisibleVideoAlt": "" }) })), "");
    c("ritratto: descrizione cancellata → quella di fabbrica", L.DEFAULT_TEXTS["protocol.titolareFotoAlt"], v.ritratto?.alt);
    c("video: descrizione cancellata → quella di fabbrica", L.DEFAULT_TEXTS["v3.invisibleVideoAlt"], v.video?.slot.alt);
    c("una descrizione scritta dal titolare resta sua", "Una mia descrizione", (await C.leggiVista(dip(cliente({ landing: conLanding({}, { "protocol.titolareFotoAlt": "Una mia descrizione" }) })), "")).ritratto?.alt);
  }
  //  La foto di ripiego della patch passa com'è.
  {
    const v = await C.leggiVista(dip(cliente({ landing: conLanding({ "home.cartaCatalogoFoto": "" }, LIBERE) }), { fotoPatchRipiego: "/assets/shop/patch.webp" }), "");
    c("fotoPatchRipiego arriva alla miniatura della patch", "/assets/shop/patch.webp", v.miniature?.patch.src);
  }
  //  La HEAD della clip: solo quando serve, dentro un tetto suo.
  {
    const base = { "protocol.macroVideo": "", "s03.media": f("s03.mp4") };
    let teste = [];
    const verifica = (esito) => async (url, segnale) => { teste.push([url, segnale instanceof AbortSignal]); return esito; };
    const vai = async (m, t, esito, opz = {}, codice = "") => { teste = []; return C.leggiVista(dip(cliente({ landing: conLanding(m, t) }), { verificaClip: verifica(esito), ...opz }), codice); };
    const si = await vai(base, LIBERE, true);
    c("ripiego s03 controllato e buono → la clip c'è", [f("s03.mp4"), [[f("s03.mp4"), true]]], [si.macro?.src, teste]);
    c("…ma senza la copertina della macro, niente clip", null, (await vai({ ...base, "protocol.macroPoster": "" }, LIBERE, true)).macro);
    c("ripiego s03 controllato e cattivo (troppo grande, non video) → niente clip", null, (await vai(base, LIBERE, false)).macro);
    await vai({ "s03.media": f("s03.mp4") }, LIBERE, true);
    c("la clip propria c'è → nessuna HEAD", 0, teste.length);
    await vai(base, {}, true);
    c("«chi si vede» vuoto (come oggi in produzione) → nessuna HEAD", 0, teste.length);
    await vai({ ...base, "v3.invisibleVideo": "" }, LIBERE, true);
    c("cancello chiuso e niente anteprima → nessuna HEAD", 0, teste.length);
    await vai({ ...base, "v3.invisibleVideo": "" }, LIBERE, true, {}, CODICE);
    c("cancello chiuso ma anteprima → la HEAD si fa", 1, teste.length);
    //  HEAD che non risponde: ha un tetto suo (500 ms) e la pagina esce lo stesso.
    const partenza = Date.now();
    const lenta = await C.leggiVista(dip(cliente({ landing: conLanding(base, LIBERE) }), { verificaClip: () => new Promise(() => {}) }), "");
    const durata = Date.now() - partenza;
    c("HEAD muta → la pagina c'è, senza la clip", [true, null], [lenta.pubblicabile, lenta.macro]);
    vero(`HEAD muta: tetto suo (${durata} ms fra 450 e 900)`, durata >= 450 && durata < 900);
    c("HEAD che lancia → la pagina c'è, senza la clip", [true, null], await (async () => { const v = await C.leggiVista(dip(cliente({ landing: conLanding(base, LIBERE) }), { verificaClip: async () => { throw new Error("rete"); } }), ""); return [v.pubblicabile, v.macro]; })());
  }
  console.warn = veraWarn;
}

/* ── I pezzi del server che si provano da soli ─────────────────────────── */
{
  c("input: il codice si ripulisce (testo, al massimo 64 caratteri)", ["abc", "", "", ""], [C.codiceDaInput({ anteprima: "abc" }), C.codiceDaInput({ anteprima: 5 }), C.codiceDaInput(undefined), C.codiceDaInput({})]);
  c("input: un codice enorme si taglia", 64, C.codiceDaInput({ anteprima: "z".repeat(5000) }).length);
  c("ricerca per il cancello: testo, al massimo 1000", ["?a=1", "", 1000], [C.ricercaDaInput({ search: "?a=1" }), C.ricercaDaInput({ search: 7 }), C.ricercaDaInput({ search: "x".repeat(4000) }).length]);
  c("ripiego della patch: il primo articolo in stock con una foto", "/assets/b.webp", C.fotoPatchRipiegoDa([{ stock: 0, image: "/assets/a.webp" }, { stock: 3 }, { stock: 2, image: "/assets/b.webp" }, { stock: 9, image: "/assets/c.webp" }]));
  c("ripiego della patch: nessun articolo con foto (oggi) → null", null, C.fotoPatchRipiegoDa([{ stock: 5 }, { stock: 0, image: "/x.webp" }]));
  c("ripiego della patch: un'immagine vuota non vale", null, C.fotoPatchRipiegoDa([{ stock: 5, image: "  " }]));
}
/* ── La HEAD vera della clip (fetch finto) ─────────────────────────────── */
{
  const risposta = (over = {}) => ({ ok: true, headers: new Headers({ "content-type": "video/mp4", "content-length": String(1024 * 1024), ...(over.headers ?? {}) }), ...over, headers: new Headers({ "content-type": "video/mp4", "content-length": String(1024 * 1024), ...(over.headers ?? {}) }) });
  const chiamate = [];
  const finto = (r) => async (url, opz) => { chiamate.push([url, opz?.method, opz?.signal instanceof AbortSignal]); if (r instanceof Error) throw r; return r; };
  const url = f("s03.mp4");
  const seg = AbortSignal.timeout(1000);
  c("video mp4 da 1 MB → buono", true, await C.headClip(url, seg, finto(risposta())));
  c("la richiesta è una HEAD, con il segnale", [[url, "HEAD", true]], chiamate);
  c("esattamente 1,5 MB → buono", true, await C.headClip(url, seg, finto(risposta({ headers: { "content-length": String(1.5 * 1024 * 1024) } }))));
  c("più di 1,5 MB → no", false, await C.headClip(url, seg, finto(risposta({ headers: { "content-length": String(1.5 * 1024 * 1024 + 1) } }))));
  c("non è un video → no", false, await C.headClip(url, seg, finto(risposta({ headers: { "content-type": "text/html" } }))));
  c("peso ignoto → no (prudente)", false, await C.headClip(url, seg, finto({ ok: true, headers: new Headers({ "content-type": "video/mp4" }) })));
  c("peso zero → no", false, await C.headClip(url, seg, finto(risposta({ headers: { "content-length": "0" } }))));
  c("peso che non è un numero → no", false, await C.headClip(url, seg, finto(risposta({ headers: { "content-length": "molto" } }))));
  c("risposta non ok (404) → no", false, await C.headClip(url, seg, finto(risposta({ ok: false }))));
  c("rete caduta → no, senza eccezione", false, await C.headClip(url, seg, finto(new Error("rete"))));
}
/* ── Le visite fermate dal cancello (decisione 15) ─────────────────────── */
{
  const riga = C.rigaCancello("?apri=invisible-derm&utm_source=ig&utm_campaign=autunno&fbclid=FB1&ad_id=11&adset_id=22&campaign_id=33&gclid=G&email=a@b.it&telefono=3331234567", "sess-1");
  c("evento e voce", ["soluzioni_cancello", { voce: "cancello", pagina: "/soluzioni" }, "sess-1", null], [riga.event_name, riga.payload, riga.session_id, riga.step]);
  c("la fonte dell'annuncio", ["ig", "autunno", "FB1", "11", "22", "33"], [riga.utm_source, riga.utm_campaign, riga.fbclid, riga.ad_id, riga.adset_id, riga.campaign_id]);
  c("nessun dato personale, nessun «apri»", false, /a@b\.it|3331234567|invisible-derm/.test(JSON.stringify(riga)));
  c("senza fonte: utm_source nullo", null, C.rigaCancello("", "s").utm_source);
  //  Le stesse colonne di trackEvent (BookingFunnel/tracking.ts): se là ne nasce una, la prova lo dice.
  const sorgente = leggi("src/landing/booking/tracking.ts");
  const blocco = sorgente.match(/from\("lp_events"\)\.insert\(\{([\s\S]*?)\n    \}\);/);
  vero("trovo l'insert di trackEvent", !!blocco);
  const colonne = [...(blocco ? blocco[1] : "").matchAll(/^      ([a-z_]+)\s*[:,]/gm)].map((x) => x[1]).sort();
  vero("trackEvent scrive una ventina di colonne", colonne.length >= 18);
  c("rigaCancello ha le stesse colonne di trackEvent", colonne, Object.keys(riga).sort());
  c("nessun IP, nessun user agent", [null, null], [riga.user_agent, riga.ip_hash ?? null]);

  const scritture = [];
  const clienteScrive = (comportamento) => ({
    from(t) {
      return {
        insert(r) {
          scritture.push([t, r]);
          if (comportamento === "muto") return new Promise(() => {});
          if (comportamento === "errore") return Promise.resolve({ error: { message: "boom" } });
          if (comportamento === "lancia") throw new Error("rotto");
          return Promise.resolve({ error: null });
        },
      };
    },
  });
  await C.scriviCancello(clienteScrive("ok"), "?utm_source=ig", "sess-2");
  c("scrive una riga in lp_events", [["lp_events", "soluzioni_cancello", "ig"]], scritture.map(([t, r]) => [t, r.event_name, r.utm_source]));
  const veraWarn = console.warn;
  console.warn = () => {};
  for (const comportamento of ["errore", "lancia"]) {
    let lanciata = false;
    try { await C.scriviCancello(clienteScrive(comportamento), "", "s"); } catch { lanciata = true; }
    c(`scrittura in ${comportamento}: nessuna eccezione, il 302 parte lo stesso`, false, lanciata);
  }
  const partenza = Date.now();
  await C.scriviCancello(clienteScrive("muto"), "", "s");
  const durata = Date.now() - partenza;
  console.warn = veraWarn;
  vero(`scrittura che non risponde: ritarda al più 300 ms (${durata} ms)`, durata >= 250 && durata < 450);
  vero("il tetto della scrittura è 300 ms", C.TETTO_CANCELLO_MS === 300);
}
/* ── Il codice va dove deve ────────────────────────────────────────────── */
{
  const src = leggi("src/landing/sito/soluzioni/contenuti.ts").replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  vero("supabaseAdmin si importa dentro la funzione, non in cima", /await import\("@\/integrations\/supabase\/client\.server"\)/.test(src) && !/^import .*client\.server/m.test(src));
  vero("il catalogo si importa dentro la funzione", /await import\("@\/shop\/catalog"\)/.test(src) && !/^import .*shop\/catalog/m.test(src));
  vero("leggiSoluzioni è una funzione del server in GET", /export const leggiSoluzioni = createServerFn\(\{ method: "GET" \}\)/.test(src));
  vero("registraCancello è una funzione del server (può girare anche dal browser nel passaggio fra pagine)", /export const registraCancello = createServerFn\(\{ method: "POST" \}\)/.test(src));
  vero("nessun log del codice d'anteprima", !/console\.\w+\([^)]*(anteprima|codice)/.test(src));
}

finisci();
