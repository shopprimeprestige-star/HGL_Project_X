/** ── NEGOZIO · V1 · T72 · I TESTI DELLO SHOP (D75, D77) ─────────────────────
 *  `src/landing/testi-shop.ts`: tutti i testi del documento §3 per le pagine V1, parola per parola, come costanti.
 *  Il confronto è con `_testi-documento.json`, copiato a mano dal documento (non generato dal codice, altrimenti sarebbe
 *  il codice che si confronta con se stesso). Si prova anche che:
 *   · ogni testo di TESTI_SHOP ha il suo riscontro nel documento (un testo senza riscontro va in TESTI_PROVVISORI, visibile);
 *   · nessuna parola vietata (SPEC 12.4.1 n. 11), nessun segnaposto aperto, nessun indirizzo dello studio, nessuna cifra di Invisible Derm;
 *   · i campi dell'editor (testi di pagina, media, testi confermati) sono quelli del piano e quelli confermati derivano da CHIAVI_TESTI.
 *  Dati inventati, nessuna rete. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { build } from "esbuild";

const carica = async (radice, percorso) => {
  const r = await build({ entryPoints: [join(radice, percorso)], bundle: true, write: false, format: "esm", alias: { "@": join(radice, "src") }, logLevel: "silent" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};

/** Il testo come lo legge una persona: senza grassetti, senza [a]…[/a], con ogni segnaposto ridotto a «{}». */
const norma = (s) =>
  String(s)
    .replace(/\*\*/g, "")
    .replace(/\[\/?a\]/g, "")
    .replace(/\{\{[^}]*\}\}/g, "{}")
    .replace(/\{[^}]*\}/g, "{}")
    .replace(/\s+/g, " ")
    .trim();
const senzaPunto = (s) => s.replace(/\.$/, "");
const prendi = (o, percorso) => percorso.split(".").reduce((x, k) => (x == null ? undefined : x[k]), o);
/** Tutte le stringhe di un oggetto, con il loro percorso («categorie.0.titolo»). */
const foglie = (o, base = "") =>
  typeof o === "string"
    ? [[base, o]]
    : o && typeof o === "object"
      ? Object.entries(o).flatMap(([k, v]) => foglie(v, base ? `${base}.${k}` : k))
      : [];

/** SPEC 12.4.1 n. 11, più i segnaposto aperti. «invisibil» è più stretto della SPEC (che dice «invisibile come promessa»):
 *  qui non c'è nessun caso in cui serva, e «Invisible» (il nome del prodotto) non lo contiene. */
const VIETATE = [/toupee/i, /indistinguibil/i, /invisibil/i, /garantit/i, /premium/i, /\bremy\b/i, /europe/i, /best seller/i, /top rated/i, /risparmi/i, /4,8\/5/, /1\.500/, /214 recensioni/i, /bio-mimetic/i, /24\/48/, /ultimi/i, /\{\{/, /da confermare/i];
/** L'indirizzo dello studio: la via, un civico dopo un nome di via, un CAP. */
const INDIRIZZO = [/scipioni/i, /\bvia\s+[\p{L}' ]{2,40}\s\d{1,4}\b/iu, /\b\d{5}\b/, /civico/i];

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("NEGOZIO · V1 · T72 · I TESTI DELLO SHOP (23/11/2026)");
  const doc = JSON.parse(readFileSync(join(radice, "prove/negozio/_testi-documento.json"), "utf8"));
  c("l'elenco del documento è pieno (testi, alt, modello alt)", true, doc.testi.length === 134 && doc.alt.length === 5 && doc.altModelli.length === 1);

  let T;
  try {
    T = await carica(radice, "src/landing/testi-shop.ts");
  } catch (e) {
    return c("src/landing/testi-shop.ts si carica", true, `no: ${String(e.message).split("\n")[0]}`);
  }
  const ATTESI = ["TESTI_SHOP", "TESTI_PROVVISORI", "CAMPI_TESTO_SHOP", "SLOT_SHOP", "ALT_SHOP", "ALT_MODELLI_SHOP", "CAMPI_CONFERMATI", "liberatoriaOk", "riempi"];
  c("esporta tutto quello che il piano promette (D75, D77)", [], ATTESI.filter((n) => T[n] === undefined));
  if (ATTESI.some((n) => T[n] === undefined)) return;
  const { TESTI_SHOP, TESTI_PROVVISORI, CAMPI_TESTO_SHOP, SLOT_SHOP, ALT_SHOP, ALT_MODELLI_SHOP, CAMPI_CONFERMATI } = T;

  /* ── 1 · parola per parola dal documento ───────────────────────────────── */
  const storte = [];
  for (const v of doc.testi) {
    const letto = prendi(TESTI_SHOP, v.chiave);
    if (typeof letto !== "string") { storte.push(`${v.chiave}: manca`); continue; }
    if (v.modo === "parte") {
      const bene = letto === v.costante && norma(v.doc).includes(senzaPunto(norma(v.costante)));
      if (!bene) storte.push(`${v.chiave}: «${letto}» non è «${v.costante}» presa dal documento`);
    } else if (norma(letto) !== norma(v.doc)) {
      storte.push(`${v.chiave}: «${letto}» ≠ «${v.doc}»`);
    }
  }
  c("ogni testo del documento è nel codice, parola per parola", [], storte);

  const senzaRiscontro = foglie(TESTI_SHOP).map(([p]) => p).filter((p) => !doc.testi.some((v) => v.chiave === p));
  c("nessun testo di TESTI_SHOP senza riscontro nel documento (gli altri stanno in TESTI_PROVVISORI)", [], senzaRiscontro);
  c("le chiavi dell'elenco del documento sono uniche", [], doc.testi.map((v) => v.chiave).filter((k, i, a) => a.indexOf(k) !== i));
  const doppiProvvisori = foglie(TESTI_PROVVISORI).filter(([p]) => doc.testi.some((v) => v.chiave === p));
  c("TESTI_PROVVISORI non contiene niente che il documento già dà", [], doppiProvvisori);
  c("i testi provvisori ci sono e sono costanti non vuote", true, foglie(TESTI_PROVVISORI).length >= 15 && foglie(TESTI_PROVVISORI).every(([, s]) => s.trim() !== ""));

  /* ── 2 · alt ───────────────────────────────────────────────────────────── */
  const altStorti = doc.alt.filter((v) => norma(ALT_SHOP[v.chiave] ?? "") !== norma(v.doc)).map((v) => v.chiave);
  c("gli alt del documento sono in ALT_SHOP, parola per parola", [], altStorti);
  c("il modello dell'alt della foto di categoria è quello del documento", true, norma(ALT_MODELLI_SHOP.categoria) === norma(doc.altModelli[0].doc));

  /* ── 3 · parole vietate, segnaposto, indirizzo, Invisible Derm ─────────── */
  const tutte = [
    ...foglie(TESTI_SHOP, "TESTI_SHOP"),
    ...foglie(TESTI_PROVVISORI, "TESTI_PROVVISORI"),
    ...foglie(CAMPI_TESTO_SHOP, "CAMPI_TESTO_SHOP"),
    ...foglie(SLOT_SHOP, "SLOT_SHOP"),
    ...foglie(ALT_SHOP, "ALT_SHOP"),
    ...foglie(ALT_MODELLI_SHOP, "ALT_MODELLI_SHOP"),
  ];
  const conParola = (res) => tutte.filter(([, s]) => res.some((r) => r.test(s))).map(([p, s]) => `${p}: «${s}»`);
  c("nessuna parola vietata (SPEC 12.4.1 n. 11) in nessuna costante, campo, etichetta o alt", [], conParola(VIETATE));
  c("nessun indirizzo dello studio (via, civico, CAP)", [], conParola(INDIRIZZO));
  // I numeri di Invisible Derm (prezzi, millimetri, percentuali, euro) non ci sono: il nome del prodotto non sta mai accanto a una cifra.
  c("nessuna cifra vicino a Invisible Derm", [], tutte.filter(([, s]) => /invisible/i.test(s) && /[\d€%]/.test(s)).map(([p]) => p));
  c("nessun prezzo scritto nelle costanti", [], tutte.filter(([, s]) => /€|\beuro\b/i.test(s)).map(([p]) => p));
  c("il testo lungo di Invisible Derm dice il costo «in consulenza», senza cifre", true, /Il costo lo vedi in consulenza\./.test(TESTI_SHOP.scheda.boxTesto) && !/\d/.test(TESTI_SHOP.scheda.boxTesto));
  c("«Scopri» per Invisible Derm c'è fra i provvisori (il documento non lo dà)", "Scopri", TESTI_PROVVISORI.card.scopri);

  /* ── 4 · una sola parola in accento nel titolo della home ──────────────── */
  const accenti = [...TESTI_SHOP.hero.h1.matchAll(/\[a\]([^[]*)\[\/a\]/g)].map((m) => m[1]);
  c("il titolo della home ha una sola parola in accento", ["PATCH"], accenti);
  c("nessun altro titolo del documento porta [a]", [], foglie(TESTI_SHOP).filter(([p, s]) => p !== "hero.h1" && /\[\/?a\]/.test(s)).map(([p]) => p));

  /* ── 5 · categorie e meta ──────────────────────────────────────────────── */
  const cat = TESTI_SHOP.categorie;
  c("le sei categorie del documento, nell'ordine del documento", ["patch-pronte", "shampoo-e-balsami", "districanti", "colle-e-remover", "spazzole", "kit"], cat.map((x) => x.slug));
  c("meta title ≤ 60 e description ≤ 155 (3.14), per le sei categorie e per la home", [], [
    ...cat.flatMap((x) => [x.metaTitolo.length > 60 && `${x.slug} title`, x.metaDescrizione.length > 155 && `${x.slug} description`]),
    TESTI_SHOP.meta.home.titolo.length > 60 && "home title",
    TESTI_SHOP.meta.home.descrizione.length > 155 && "home description",
  ].filter(Boolean));
  c("i meta delle sei categorie sono tutti diversi (V1-C3)", 12, new Set(cat.flatMap((x) => [x.metaTitolo, x.metaDescrizione])).size);
  c("colle e spazzole: la frase è quella accorciata (D97), senza «adatti alla tua base» né «senza tirare»", [false, false], [/adatti alla tua base/.test(cat[3].frase), /senza tirare/.test(cat[4].frase)]);
  c("nessun prezzo nei meta (3.14: «nessun prezzo nel meta description»)", [], foglie(TESTI_SHOP.meta).concat(cat.flatMap((x) => [["t", x.metaTitolo], ["d", x.metaDescrizione]])).filter(([, s]) => /€|\d+[,.]\d{2}/.test(s)).map(([p]) => p));

  /* ── 6 · i testi confermati derivano da CHIAVI_TESTI (D77) ─────────────── */
  const { CHIAVI_TESTI } = await carica(radice, "src/shop/cms/testi-confermati.ts");
  c("CAMPI_CONFERMATI = «shop.conf.» + CHIAVI_TESTI, nello stesso ordine", CHIAVI_TESTI.map((k) => `shop.conf.${k}`), [...CAMPI_CONFERMATI]);
  const campiConf = CAMPI_TESTO_SHOP.filter((f) => f.chiave.startsWith("shop.conf."));
  c("i campi `shop.conf.*` dell'editor sono esattamente quelli, nello stesso ordine", [...CAMPI_CONFERMATI], campiConf.map((f) => f.chiave));
  c("i testi confermati partono VUOTI (il titolare li scrive: nessun testo di servizio nel codice)", [], campiConf.filter((f) => f.default !== "").map((f) => f.chiave));

  /* ── 7 · i campi dell'editor ───────────────────────────────────────────── */
  const MODIFICABILI = [
    "shop.hero.eyebrow", "shop.hero.h1", "shop.hero.sottotitolo", "shop.hero.cta1", "shop.hero.cta2", "shop.hero.riga", "shop.hero.didascalia",
    "shop.fascia.studio", "shop.fascia.consulenza",
    "shop.vetrina.titolo", "shop.vetrina.sottotitolo", "shop.vetrina.link",
    "shop.cat.blocco.titolo", "shop.cat.blocco.testo", "shop.cat.blocco.link",
    "shop.carrello.vuoto.titolo", "shop.carrello.vuoto.testo", "shop.carrello.vuoto.link",
    "shop.err404.titolo", "shop.err404.testo", "shop.err500.titolo", "shop.err500.testo",
  ];
  const chiaviCampi = CAMPI_TESTO_SHOP.map((f) => f.chiave);
  c("i testi di pagina modificabili sono quelli del piano (3.2), poi i confermati, poi i campi di servizio", [...MODIFICABILI, ...CAMPI_CONFERMATI, "shop.coloriTrascrizione", "shop.curaTrascrizione", "shop.clienti.liberatoria"], chiaviCampi);
  c("ogni campo ha chiave `shop.*`, etichetta e tipo valido", [], CAMPI_TESTO_SHOP.filter((f) => !f.chiave.startsWith("shop.") || !f.label.trim() || !["text", "textarea"].includes(f.tipo)).map((f) => f.chiave));
  c("il valore di partenza di ogni testo di pagina è la costante del codice (una sola fonte)", [], MODIFICABILI.filter((k) => {
    const mappa = {
      "shop.hero.eyebrow": TESTI_SHOP.hero.eyebrow, "shop.hero.h1": TESTI_SHOP.hero.h1, "shop.hero.sottotitolo": TESTI_SHOP.hero.sottotitolo, "shop.hero.cta1": TESTI_SHOP.hero.cta1, "shop.hero.cta2": TESTI_SHOP.hero.cta2, "shop.hero.riga": TESTI_SHOP.hero.riga, "shop.hero.didascalia": TESTI_SHOP.hero.didascalia,
      "shop.fascia.studio": TESTI_SHOP.fascia.studio, "shop.fascia.consulenza": TESTI_SHOP.fascia.consulenza,
      "shop.vetrina.titolo": TESTI_SHOP.vetrina.titolo, "shop.vetrina.sottotitolo": TESTI_SHOP.vetrina.sottotitolo, "shop.vetrina.link": TESTI_SHOP.vetrina.link,
      "shop.cat.blocco.titolo": TESTI_SHOP.categoria.bloccoTitolo, "shop.cat.blocco.testo": TESTI_SHOP.categoria.bloccoTesto, "shop.cat.blocco.link": TESTI_SHOP.categoria.bloccoLink,
      "shop.carrello.vuoto.titolo": TESTI_SHOP.carrello.vuotoTitolo, "shop.carrello.vuoto.testo": TESTI_SHOP.carrello.vuotoTesto, "shop.carrello.vuoto.link": TESTI_SHOP.carrello.vuotoLink,
      "shop.err404.titolo": TESTI_SHOP.err404.titolo, "shop.err404.testo": TESTI_SHOP.err404.testo, "shop.err500.titolo": TESTI_SHOP.err500.titolo, "shop.err500.testo": TESTI_SHOP.err500.testo,
    };
    return CAMPI_TESTO_SHOP.find((f) => f.chiave === k)?.default !== mappa[k];
  }));
  c("nessun campo ha un valore di partenza con segnaposto aperto", [], CAMPI_TESTO_SHOP.filter((f) => /\{\{|da confermare/i.test(f.default)).map((f) => f.chiave));

  /* ── 8 · slot dei media (D95) e descrizioni ────────────────────────────── */
  const SLOT = ["shop.heroFoto", "shop.titolareFoto", "shop.pacco", "shop.coloriFoto", "shop.coloriVideo", "shop.coloriPoster", "shop.curaVideo", "shop.curaPoster", "shop.condivisione"];
  c("gli slot sono quelli di D95 (solo quelli di V1)", SLOT, SLOT_SHOP.map((s) => s.chiave));
  c("ogni slot ha etichetta e tipo immagine o video; i video sono solo i due di D95", [["shop.coloriVideo", "shop.curaVideo"], []], [SLOT_SHOP.filter((s) => s.tipo === "video").map((s) => s.chiave), SLOT_SHOP.filter((s) => !s.label.trim() || !["image", "video"].includes(s.tipo)).map((s) => s.chiave)]);
  c("ogni descrizione (alt) appartiene a uno slot che esiste", [], Object.keys(ALT_SHOP).filter((k) => !SLOT_SHOP.some((s) => `${s.chiave}.alt` === k)));
  c("gli slot con un'immagine che ritrae persone o un prodotto hanno la descrizione di partenza (il CMS non pubblica senza)", [], ["shop.heroFoto", "shop.titolareFoto", "shop.pacco", "shop.coloriFoto", "shop.coloriVideo", "shop.curaVideo"].filter((k) => !ALT_SHOP[`${k}.alt`]));
  const tutteChiavi = [...chiaviCampi, ...SLOT_SHOP.map((s) => s.chiave), ...Object.keys(ALT_SHOP)];
  c("nessuna chiave doppia nell'editor", [], tutteChiavi.filter((k, i, a) => a.indexOf(k) !== i));
  c("nessuna chiave tocca la landing (`id.*`) o la home vecchia", [], tutteChiavi.filter((k) => !k.startsWith("shop.")));

  /* ── 9 · gli aiuti ─────────────────────────────────────────────────────── */
  // Due pacchetti diversi non danno la stessa funzione: si guarda che il file la RIESPORTI dalla landing, non che la riscriva.
  const sorgente = readFileSync(join(radice, "src/landing/testi-shop.ts"), "utf8");
  c("`liberatoriaOk` è quella della landing (riesportata, una sola regola)", true, /export\s*\{\s*liberatoriaOk\s*\}\s*from\s*"@\/landing\/testi-invisible-derm"/.test(sorgente) && !/function liberatoriaOk/.test(sorgente));
  c("«sì», «Si», « SÌ » valgono; vuoto e altro no", [true, true, true, false, false], ["sì", "Si", " SÌ ", "", "forse"].map(T.liberatoriaOk));
  const { riempi } = T;
  c("riempi sostituisce ogni segnaposto, anche ripetuto", "Di questo prodotto ne abbiamo 3. Abbiamo portato la quantità a 3.", riempi(TESTI_SHOP.carrello.quantitaRidotta, { n: 3 }));
  c("riempi: «{nome} è nel carrello» e «{colore} · {misura}»", ["Lace Front è nel carrello", "Nero · M"], [riempi(TESTI_SHOP.scheda.nelCarrello, { nome: "Lace Front" }), riempi(TESTI_SHOP.scheda.sceltaVariante, { colore: "Nero", misura: "M" })]);
  c("riempi lascia intatto un segnaposto senza valore (si vede nella prova, mai «undefined»)", "Filtra ({n})", riempi(TESTI_SHOP.categoria.filtri.filtra, {}));
  c("riempi non reinterpreta il valore («$&», «{n}» dentro il valore)", ["Ciao $& {n}", "Carrello (0)"], [riempi("Ciao {x}", { x: "$& {n}" }), riempi(TESTI_SHOP.header.carrello, { n: 0 })]);
  c("riempi non tocca chiavi ereditate («constructor»)", "{constructor}", riempi("{constructor}", {}));
}
