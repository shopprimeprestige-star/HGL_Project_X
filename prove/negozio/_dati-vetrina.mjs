/** ── DATI INVENTATI PER LE PROVE DELLA VETRINA V1 (T70a) ───────────────────────
 *  Commessa 2026-11-20-shop-completo, PIANO-V1 §5 T70a. Nessun cliente vero, nessun database: tutto è scritto qui, con nomi
 *  chiaramente «di prova». Le prove della vetrina (moduli puri `vetrina-*`, pagine, regole) lo importano tutte: un solo catalogo.
 *  Il nome inizia per «_»: non è una prova, `negozio.mjs` non lo chiama.
 *
 *  Cosa c'è (le forme sono quelle del codice: `ProdottoPubblico`, `CategoriaPubblica`, `RigaCarrello`, `RigaCarrelloServer`,
 *  `SpedizionePubblica`, `TariffaCarrello`, `filtraConfermati`, riga `landing_content`):
 *   · `PRODOTTI` = 8 prodotti (5 patch con 1-3 opzioni, 2 cura, 1 kit), `INVISIBLE_DERM` (senza prezzo), `CATALOGO` = i 9 insieme;
 *   · `CATEGORIE` = 3 (una senza prodotti); `prodottoStress()` (50 varianti); `SCENARIO_50` (50 prodotti);
 *   · media: `catalogo({ media })` con `"piena"` (tutti gli slot), `"una"` (solo la principale), `"vuota"` (nessuna foto);
 *   · tariffa `ok` confermata e `assente`; testi confermati pieni e `{}`; `landing_content` pieno e vuoto;
 *   · carrello nuovo, vecchio e misto; `carrelloFinto` / `rivalidaFinta` per `stato.carrello` / `stato.rivalida` di `_rende.mjs`;
 *   · `PAROLE_VIETATE` (SPEC §12.4.1 n. 11) costruite a pezzi, e `trovaParoleVietate(testo)`.
 *  ⚠️ Le costanti sono congelate (scrivere su di esse lancia): per cambiare qualcosa si parte da `structuredClone(…)` o dalle funzioni.
 *  ⚠️ Nessun testo qui dentro porta una parola vietata: lo prova `rende-aiuti.mjs`. */

const BASE = "https://prova.test/shop-media";
export const AGGIORNATO_IL = "2026-11-01T10:00:00.000Z";

const congela = (x) => {
  if (x && typeof x === "object" && !Object.isFrozen(x)) {
    Object.freeze(x);
    for (const v of Object.values(x)) congela(v);
  }
  return x;
};

/* ── le foto e i media di un prodotto ── */

export const fotoDi = (nome) => ({ w480: `${BASE}/${nome}-480.webp`, w960: `${BASE}/${nome}-960.webp`, w1600: `${BASE}/${nome}-1600.webp` });

/** I media di un prodotto, nell'ordine in cui li dà il server (principale, scala, foto 2-5, video, confezione). */
function mediaDi(slug, nome, quanti) {
  if (quanti === "vuota") return [];
  const foto = (slot, ordine, descr) => ({
    id: `${slug}-${slot}`, slot, sottoRuolo: null, alt: `${nome}: ${descr}`, ordine, src: fotoDi(`${slug}-${slot}`), video: null, copertina: null, testoParlato: null, muto: false,
  });
  const principale = foto("principale", 0, "foto principale");
  if (quanti === "una") return [principale];
  return [
    principale,
    foto("scala", 1, "foto di scala"),
    foto("foto2", 2, "seconda foto"),
    foto("foto3", 3, "terza foto"),
    foto("foto4", 4, "quarta foto"),
    foto("foto5", 5, "quinta foto"),
    { id: `${slug}-video`, slot: "video", sottoRuolo: null, alt: `${nome}: video`, ordine: 6, src: null, video: `${BASE}/${slug}-video.mp4`, copertina: `${BASE}/${slug}-copertina.webp`, testoParlato: "Testo parlato di prova.", muto: false },
    foto("confezione", 7, "confezione"),
  ];
}

/* ── un prodotto ── */

const CATEGORIA_PATCH = { slug: "patch-pronte", nome: "Patch pronte di prova" };
const CATEGORIA_CURA = { slug: "cura", nome: "Cura di prova" };
const CATEGORIA_VUOTA = { slug: "senza-prodotti", nome: "Categoria vuota di prova" };

/** Tutte le combinazioni delle opzioni (l'ultima opzione varia più in fretta). */
const combina = (def) => Object.entries(def).reduce((acc, [nome, valori]) => acc.flatMap((a) => valori.map((v) => ({ ...a, [nome]: v }))), [{}]);

/** Un `ProdottoPubblico` intero. `opzioni` = `{ Colore: ["Nero", …], … }` (nessuna = una sola variante); `base` = prezzo della prima variante,
 *  ogni variante dopo costa 1 euro in più; `esaurite` = indici di variante non disponibili. */
function prodotto({ slug, sku, nome, tipo, categorie, base, opzioni = {}, esaurite = [], media = "piena", extra = {} }) {
  const combinazioni = combina(opzioni);
  const conCampioni = media === "piena";
  return {
    sku,
    slug,
    nome,
    marca: "Marca di prova",
    tipo,
    rigaPresentazione: `Riga di presentazione di prova per ${nome}.`,
    descrizioneBreve: `Descrizione breve di prova per ${nome}.`,
    descrizioneLunga: `Descrizione lunga di prova per ${nome}. Un secondo periodo, per vedere il testo andare a capo.`,
    perChi: `Per chi prova la vetrina: ${nome}.`,
    caratteristiche: [{ etichetta: "Materiale di prova", valore: "Valore di prova" }, { etichetta: "Misura di prova", valore: "10 x 10 cm" }],
    passi: ["Primo passo di prova.", "Secondo passo di prova."],
    confezione: ["Un pezzo di prova", "Un foglio di istruzioni di prova"],
    avvertenze: ["Avvertenza di prova."],
    faq: [{ d: "Domanda di prova uno?", r: "Risposta di prova uno." }, { d: "Domanda di prova due?", r: "Risposta di prova due." }],
    categorie,
    media: mediaDi(slug, nome, media),
    opzioni: Object.entries(opzioni).map(([n, valori]) => ({
      nome: n,
      valori: valori.map((valore) => ({ valore, campione: conCampioni && n === "Colore" ? { w480: `${BASE}/${slug}-campione-${valore.toLowerCase()}-480.webp` } : null })),
    })),
    varianti: combinazioni.map((o, i) => ({
      sku: `${sku}-${String(i + 1).padStart(2, "0")}`,
      nome: Object.values(o).join(" / ") || nome,
      opzioni: o,
      prezzoCent: base + i * 100,
      disponibile: !esaurite.includes(i),
    })),
    prezzoDaCent: base,
    acquistabile: true,
    reso: tipo === "patch" ? { consentito: true, giorni: 14 } : tipo === "cura" ? { consentito: false, giorni: null } : { consentito: null, giorni: null },
    boxConsulenza: tipo === "patch",
    correlato: null,
    seo: { titolo: `${nome} | titolo di prova`, descrizione: `Descrizione per i motori di ricerca di prova: ${nome}.`, immagine: null },
    gtin: null,
    aggiornatoIl: AGGIORNATO_IL,
    ...extra,
  };
}

const conCorrelato = (p, c) => ({ ...p, correlato: { slug: c.slug, nome: c.nome, prezzoDaCent: c.prezzoDaCent, foto: c.media[0]?.src ?? null } });

/** Il catalogo con i media scelti (`"piena"`, `"una"`, `"vuota"`). Ogni chiamata dà oggetti nuovi, non congelati. */
export function catalogo({ media = "piena" } = {}) {
  const m = { media };
  const shampoo = prodotto({ slug: "shampoo-prova", sku: "CUR-SHAMPOO", nome: "Shampoo di prova", tipo: "cura", categorie: [CATEGORIA_CURA], base: 1490, opzioni: { Misura: ["250 ml", "500 ml"] }, ...m });
  const patch = [
    prodotto({ slug: "patch-prova-alfa", sku: "PAT-ALFA", nome: "Patch di prova Alfa", tipo: "patch", categorie: [CATEGORIA_PATCH], base: 28900, opzioni: { Colore: ["Nero", "Castano", "Biondo"] }, ...m }),
    prodotto({ slug: "patch-prova-beta", sku: "PAT-BETA", nome: "Patch di prova Beta", tipo: "patch", categorie: [CATEGORIA_PATCH], base: 32900, opzioni: { Colore: ["Nero", "Castano"], Lunghezza: ["Corta", "Media"] }, ...m }),
    prodotto({ slug: "patch-prova-gamma", sku: "PAT-GAMMA", nome: "Patch di prova Gamma", tipo: "patch", categorie: [CATEGORIA_PATCH], base: 36900, opzioni: { Colore: ["Nero", "Castano"], Lunghezza: ["Corta", "Media"], Misura: ["Piccola", "Grande"] }, esaurite: [0, 5], ...m }),
    prodotto({ slug: "patch-prova-delta", sku: "PAT-DELTA", nome: "Patch di prova Delta", tipo: "patch", categorie: [CATEGORIA_PATCH], base: 24900, opzioni: { Misura: ["Piccola", "Media", "Grande"] }, ...m }),
    // tutta esaurita: l'unica variante non è disponibile
    prodotto({ slug: "patch-prova-epsilon", sku: "PAT-EPSILON", nome: "Patch di prova Epsilon", tipo: "patch", categorie: [CATEGORIA_PATCH], base: 26900, opzioni: { Colore: ["Unico"] }, esaurite: [0], ...m }),
  ];
  const balsamo = prodotto({ slug: "balsamo-prova", sku: "CUR-BALSAMO", nome: "Balsamo di prova", tipo: "cura", categorie: [CATEGORIA_CURA], base: 1690, ...m });
  const kit = prodotto({ slug: "kit-prova", sku: "KIT-PROVA", nome: "Kit di prova", tipo: "kit", categorie: [CATEGORIA_PATCH], base: 41900, ...m });
  // «Ti serve anche»: la prima patch rimanda allo shampoo, la seconda al balsamo (un solo correlato per prodotto)
  patch[0] = conCorrelato(patch[0], shampoo);
  patch[1] = conCorrelato(patch[1], balsamo);
  return { prodotti: [...patch, shampoo, balsamo, kit], invisibleDerm: invisibleDerm(m) };
}

/** Invisible Derm (D39): nessun prezzo, non si compra, le varianti non sono disponibili; il nome e lo slug lo fanno riconoscere a `eInvisibleDerm`. */
function invisibleDerm({ media = "piena" } = {}) {
  const p = prodotto({ slug: "invisible-derm-prova", sku: "INV-DERM", nome: "Invisible Derm di prova", tipo: "cura", categorie: [CATEGORIA_CURA], base: 1, opzioni: { Misura: ["Piccola", "Grande"] }, media });
  return {
    ...p,
    varianti: p.varianti.map((v) => ({ ...v, prezzoCent: null, disponibile: false })),
    prezzoDaCent: null,
    acquistabile: false,
    reso: { consentito: null, giorni: null },
    boxConsulenza: false,
  };
}

const PIENO = catalogo();
export const PRODOTTI = congela(PIENO.prodotti);
export const INVISIBLE_DERM = congela(PIENO.invisibleDerm);
/** Gli 8 prodotti e Invisible Derm, nell'ordine in cui li dà `elencoProdotti` (alfabetico per nome non garantito: le prove ordinano da sé). */
export const CATALOGO = congela([...PIENO.prodotti, PIENO.invisibleDerm]);
export const CATALOGO_UNA_FOTO = congela((() => { const c = catalogo({ media: "una" }); return [...c.prodotti, c.invisibleDerm]; })());
export const CATALOGO_SENZA_FOTO = congela((() => { const c = catalogo({ media: "vuota" }); return [...c.prodotti, c.invisibleDerm]; })());

/** Un prodotto «stress»: 10 colori x 5 lunghezze = 50 varianti (il massimo, `MAX_COMBINAZIONI`). */
export function prodottoStress(media = "piena") {
  return prodotto({
    slug: "prodotto-stress", sku: "STRESS", nome: "Prodotto stress di prova", tipo: "patch", categorie: [CATEGORIA_PATCH], base: 30000, media,
    opzioni: {
      Colore: ["Nero", "Castano", "Biondo", "Rosso", "Grigio", "Bianco", "Miele", "Cenere", "Rame", "Sabbia"],
      Lunghezza: ["XS", "S", "M", "L", "XL"],
    },
  });
}
export const PRODOTTO_STRESS = congela(prodottoStress());

/** Uno scenario da 50 prodotti: nomi numerati, patch e cura alternati, una sola opzione di colore. */
export function scenario50(media = "piena") {
  return Array.from({ length: 50 }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    const patch = i % 2 === 0;
    return prodotto({
      slug: `prodotto-prova-${n}`, sku: `PROVA-${n}`, nome: `Prodotto di prova ${n}`, tipo: patch ? "patch" : "cura", categorie: [patch ? CATEGORIA_PATCH : CATEGORIA_CURA],
      base: 1000 + i * 100, opzioni: { Colore: ["Nero", "Castano"] }, media,
    });
  });
}
export const SCENARIO_50 = congela(scenario50());

/* ── le categorie ── */

/** `CategoriaPubblica[]` con `quanti` contato sul catalogo dato; la terza non ha prodotti (per lo scenario «categoria vuota»). */
export function categorie(prodotti = CATALOGO) {
  const quanti = (slug) => prodotti.filter((p) => p.categorie.some((c) => c.slug === slug)).length;
  const riga = (c, ordine, frase, conFoto) => ({
    slug: c.slug, nome: c.nome, tipo: "categoria", frase, foto: conFoto ? fotoDi(`categoria-${c.slug}`) : null, fotoAlt: conFoto ? `${c.nome}: foto` : null,
    seo: { titolo: `${c.nome} | titolo di prova`, descrizione: `Descrizione di prova della categoria ${c.nome}.` }, ordine, quanti: quanti(c.slug),
  });
  return [riga(CATEGORIA_PATCH, 0, "Frase di prova delle patch.", true), riga(CATEGORIA_CURA, 1, "Frase di prova della cura.", false), riga(CATEGORIA_VUOTA, 2, null, false)];
}
export const CATEGORIE = congela(categorie());

/* ── la spedizione ── */

/** Cosa risponde `tariffaSpedizione()` con una tariffa confermata (`SpedizionePubblica`) e senza tariffa. */
export const TARIFFA_OK = congela({ stato: "ok", costoCent: 490, confermata: true, corriere: "Corriere di prova", tempi: { min: 2, max: 4 }, frase: "Consegna di prova in 2-4 giorni." });
export const TARIFFA_ASSENTE = congela({ stato: "assente" });
/** Cosa dà il gancio `useTariffa` (`TariffaCarrello`) nei due casi: per `stato.tariffa` di `_rende.mjs`. */
export const TARIFFA_CARRELLO_OK = congela({ stato: "ok", costoCent: 490, chiusa: false });
export const TARIFFA_CARRELLO_ASSENTE = congela({ stato: "assente", costoCent: null, chiusa: false });

/* ── i testi confermati dal titolare (R2 · T45) ── */

/** Quello che dà `testiConfermati()` (prima di `filtraConfermati`): con tutte e sei le chiavi scritte, e vuoto. */
export const TESTI_CONFERMATI_PIENI = congela({
  reso: "Testo di prova sul reso.",
  assistenza: "Testo di prova sull'assistenza.",
  assistenza_whatsapp: "Contatto WhatsApp di prova.",
  pronta_consegna: "Testo di prova sulla pronta consegna.",
  garanzia: "Testo di prova sulla copertura del prodotto.",
  firmatario: "Firma di prova",
});
export const TESTI_CONFERMATI_VUOTI = congela({});

/* ── la riga `landing_content` (testi e foto globali dello shop) ── */

/** Le chiavi sono indicative (le definisce `testi-shop.ts`, T72): chi ne ha bisogno di altre costruisce la sua con `landingContent(texts, media)`. */
export const landingContent = (texts = {}, media = {}) => ({ id: "default", texts, media });
export const LANDING_CONTENT_PIENO = congela(
  landingContent(
    { "shop.hero.titolo": "Titolo di prova", "shop.hero.sottotitolo": "Sottotitolo di prova", "shop.vetrina.titolo": "Vetrina di prova" },
    { "shop.hero.foto": `${BASE}/slot-hero.webp`, "shop.consulenza.foto": `${BASE}/slot-consulenza.webp`, "shop.pacco.foto": `${BASE}/slot-pacco.webp` },
  ),
);
export const LANDING_CONTENT_VUOTO = congela(landingContent());

/* ── il carrello ── */

/** Una riga del carrello nuovo (catalogo CMS): `productId` = SKU della variante, con `snap` come lo scrive la pagina. */
export function rigaCms(p, indiceVariante, qty) {
  const v = p.varianti[indiceVariante];
  return {
    productId: v.sku, sku: v.sku, qty, key: v.sku, variant: v.opzioni,
    snap: { nome: p.nome, slug: p.slug, prezzoCent: v.prezzoCent, foto: p.media.find((m) => m.slot === "principale")?.src ?? null, varianteNome: v.nome },
  };
}
const per = (slug) => CATALOGO.find((p) => p.slug === slug);
/** Carrello nuovo: due righe del catalogo CMS. */
export const CARRELLO_NUOVO = congela([rigaCms(per("patch-prova-alfa"), 0, 1), rigaCms(per("patch-prova-beta"), 1, 2)]);
/** Carrello vecchio: righe del catalogo di prima (senza `sku` né `snap`). */
export const CARRELLO_VECCHIO = congela([
  { productId: "prodotto-vecchio-1", qty: 1, key: "prodotto-vecchio-1" },
  { productId: "prodotto-vecchio-2", qty: 2, variant: { Colore: "1B" }, key: "prodotto-vecchio-2|Colore:1B" },
]);
/** Carrello misto: una riga nuova, una vecchia e una di Invisible Derm rimasta con un prezzo di quando non era ancora senza prezzo. */
export const CARRELLO_MISTO = congela([
  CARRELLO_NUOVO[0],
  CARRELLO_VECCHIO[0],
  { productId: "INV-DERM-01", sku: "INV-DERM-01", qty: 1, key: "INV-DERM-01", snap: { nome: "Invisible Derm di prova", slug: "invisible-derm-prova", prezzoCent: 12300, foto: null, varianteNome: "Piccola" } },
]);

/** Il valore di `useCart()` per `stato.carrello`: `subtotal` in euro dalle righe con `snap` (come fa il carrello vero). */
export function carrelloFinto(lines = [], extra = {}) {
  const subtotal = lines.reduce((s, l) => s + (l.snap ? (l.snap.prezzoCent * l.qty) / 100 : 0), 0);
  return { lines, subtotal, count: lines.reduce((s, l) => s + l.qty, 0), setQty() {}, remove() {}, clear() {}, replaceLines() {}, add() {}, ...extra };
}
/** Il valore di `useRivalidaCarrello()` per `stato.rivalida`. */
export const rivalidaFinta = (extra = {}) => ({ stato: "ok", avviso: null, controlla: async () => ({ stato: "non_verificabile" }), ...extra });

/** Cosa risponde `righeCarrello({ data: { skus } })` sul catalogo dato: come `catalogo.server.ts` (Invisible Derm e SKU sconosciuti → «non più disponibile»). */
export function righeServerDi(skus, prodotti = CATALOGO) {
  return skus.map((sku) => {
    for (const p of prodotti) {
      const v = p.varianti.find((x) => x.sku === sku);
      if (v && p.acquistabile && v.prezzoCent !== null)
        return { sku, nome: p.nome, varianteNome: v.nome === v.sku ? null : v.nome, prezzoCent: v.prezzoCent, disponibile: v.disponibile, foto: p.media.find((m) => m.slot === "principale")?.src ?? null, slug: p.slug };
    }
    return { sku, nonPiuDisponibile: true };
  });
}

/* ── le parole vietate (SPEC §12.4.1 n. 11 e §12.5 V1-T6), costruite a pezzi: questo file non le contiene scritte ── */

const J = (...pezzi) => pezzi.join("");
/** Le parole della lista di §12.4.1 n. 11, per la ricerca senza distinguere le maiuscole. */
export const PAROLE_VIETATE = congela([
  J("tou", "pee"), J("indistingui", "bil"), J("invisi", "bile"), J("garan", "tit"), J("pre", "mium"), J("Re", "my"), J("euro", "pe"), J("Best ", "seller"), J("Top ", "rated"),
  J("Ris", "parmi"), J("4,", "8/5"), J("1.", "500"), J("214 ", "recensioni"), J("Bio-", "Mimetic"), J("24", "/48"), J("ulti", "mi"), J("{", "{"), J("da ", "confermare"),
]);
/** Quello che in più non deve esserci nell'HTML (V1-T6, V1-T7): prezzi barrati e la via dello studio. */
export const ALTRE_VIETATE = congela([J("<d", "el>"), J("<", "s>"), J("line", "-through"), J("Scipi", "oni")]);
/** «solo N» (scarsità): non è una parola ma una forma. */
const SOLO_N = new RegExp(J("\\bso", "lo \\d+\\b"), "i");
const PAROLA_INTERA = new Set([J("ulti", "mi")]);

/** Le parole vietate che compaiono in `testo` (elenco vuoto = pulito). `ultimi` conta solo come parola intera. */
export function trovaParoleVietate(testo) {
  const t = String(testo ?? "");
  const trovate = [...PAROLE_VIETATE, ...ALTRE_VIETATE].filter((p) =>
    PAROLA_INTERA.has(p) ? new RegExp(`\\b${p}\\b`, "i").test(t) : t.toLowerCase().includes(p.toLowerCase()),
  );
  if (SOLO_N.test(t)) trovate.push(J("so", "lo N"));
  return trovate;
}
