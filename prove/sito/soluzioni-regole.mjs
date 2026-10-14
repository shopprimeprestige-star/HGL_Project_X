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

finisci();
