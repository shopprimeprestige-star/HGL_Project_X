/** ── VETRINA V1 · T76 · LA CARD LEGGERA (D79, D86, V1-C1, V1-T6) ─────────────
 *  `src/shop/cms/vetrina-card.ts`: da `ProdottoPubblico` a `CardLeggera` (solo i campi della card), l'azione del bottone
 *  («scegli» / «aggiungi» / «scopri») e il badge «Pronta consegna». Dati inventati di `_dati-vetrina.mjs`, nessuna rete.
 *  Si prova ogni caso del piano: prodotto con scelte, senza scelte, tutto esaurito, Invisible Derm (nessun prezzo nemmeno se
 *  il dato lo porta per errore), foto assenti, ingressi storti, nessuna parola vietata, nessuna modifica all'ingresso. */
import { join } from "node:path";
import { build } from "esbuild";
import { CATALOGO, CATALOGO_SENZA_FOTO, CATALOGO_UNA_FOTO, INVISIBLE_DERM, fotoDi, trovaParoleVietate } from "./_dati-vetrina.mjs";

const carica = async (radice, percorso) => {
  const r = await build({ entryPoints: [join(radice, percorso)], bundle: true, write: false, format: "esm", alias: { "@": join(radice, "src") }, logLevel: "silent" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};

const per = (slug, catalogo = CATALOGO) => catalogo.find((p) => p.slug === slug);
const copia = (x) => structuredClone(x);

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T76 · LA CARD LEGGERA (23/11/2026)");
  const K = mod["shop/cms/vetrina-card"];
  const { TESTI_SHOP, TESTI_PROVVISORI } = await carica(radice, "src/landing/testi-shop.ts");
  c("il modulo esporta le quattro funzioni del contratto più il badge e l'etichetta dei colori", ["azioneCard", "badgeProntaConsegna", "cardDaPubblico", "etichettaColori", "soloLeggere"], Object.keys(K).sort());

  // ── la forma ──
  const CHIAVI = ["slug", "nome", "riga", "prezzoCent", "prezziDiversi", "foto", "fotoAlt", "nColori", "conVarianti", "aggiungibile", "disponibile", "senzaPrezzo", "skuVarianti"];
  const alfa = K.cardDaPubblico(per("patch-prova-alfa"));
  c("la card ha esattamente i campi del contratto, nell'ordine", CHIAVI, Object.keys(alfa));
  c("la card è un oggetto semplice: la copia JSON è uguale", alfa, JSON.parse(JSON.stringify(alfa)));
  c("nessun testo lungo né prezzi di variante nella card (descrizioni, FAQ, passi, media, opzioni)", [], ["descrizioneBreve", "descrizioneLunga", "faq", "passi", "media", "opzioni", "varianti", "caratteristiche", "correlato", "seo", "reso"].filter((k) => k in alfa));

  // ── patch con scelte (3 colori, prezzi crescenti) ──
  c("patch con 3 colori: nome, indirizzo e riga", ["Patch di prova Alfa", "patch-prova-alfa", "Riga di presentazione di prova per Patch di prova Alfa."], [alfa.nome, alfa.slug, alfa.riga]);
  c("prezzo = il più basso (prezzoDaCent), in centesimi", 28900, alfa.prezzoCent);
  c("le tre varianti costano 289, 290, 291: prezzi diversi", true, alfa.prezziDiversi);
  c("foto = la principale, solo le due misure della card", { w480: fotoDi("patch-prova-alfa-principale").w480, w960: fotoDi("patch-prova-alfa-principale").w960 }, alfa.foto);
  c("l'alt della foto è quello del CMS", "Patch di prova Alfa: foto principale", alfa.fotoAlt);
  c("3 colori, con scelte, non si aggiunge con un clic, è disponibile, ha prezzo", [3, true, false, true, false], [alfa.nColori, alfa.conVarianti, alfa.aggiungibile, alfa.disponibile, alfa.senzaPrezzo]);
  c("gli SKU delle varianti, nell'ordine del server", ["PAT-ALFA-01", "PAT-ALFA-02", "PAT-ALFA-03"], alfa.skuVarianti);
  c("azione: «scegli»", "scegli", K.azioneCard(alfa));

  // ── colori e opzioni ──
  const beta = K.cardDaPubblico(per("patch-prova-beta"));
  c("Colore + Lunghezza: i colori sono 2 (non le 4 combinazioni)", 2, beta.nColori);
  const delta = K.cardDaPubblico(per("patch-prova-delta"));
  c("solo Misura: nessun colore, ma ci sono scelte", [0, true, "scegli"], [delta.nColori, delta.conVarianti, K.azioneCard(delta)]);
  const conNomeStorto = copia(per("patch-prova-alfa"));
  conNomeStorto.opzioni[0].nome = "  COLORE ";
  c("il nome dell'opzione «Colore» si riconosce senza badare a maiuscole e spazi", 3, K.cardDaPubblico(conNomeStorto).nColori);
  c("etichetta «{n} colori»: da 2 colori in su, con la costante del copy", [TESTI_PROVVISORI.card.nColori.replace("{n}", "3"), TESTI_PROVVISORI.card.nColori.replace("{n}", "2")], [K.etichettaColori(3), K.etichettaColori(2)]);
  c("etichetta «{n} colori»: con 0 o 1 colore non c'è (mai «1 colori»)", [null, null, null, null], [K.etichettaColori(0), K.etichettaColori(1), K.etichettaColori(-1), K.etichettaColori(NaN)]);
  c("la patch con un solo colore «Unico» ha nColori 1: la card non lo scrive", [1, null], [K.cardDaPubblico(per("patch-prova-epsilon")).nColori, K.etichettaColori(K.cardDaPubblico(per("patch-prova-epsilon")).nColori)]);

  // ── prezzo: uguale o diverso ──
  const balsamo = K.cardDaPubblico(per("balsamo-prova"));
  c("una sola variante: prezzo 16,90, prezzi non diversi", [1690, false], [balsamo.prezzoCent, balsamo.prezziDiversi]);
  const stessiPrezzi = copia(per("patch-prova-alfa"));
  for (const v of stessiPrezzi.varianti) v.prezzoCent = 28900;
  c("varianti tutte allo stesso prezzo: prezzi non diversi", false, K.cardDaPubblico(stessiPrezzi).prezziDiversi);

  // ── senza scelte: «Aggiungi» ──
  c("balsamo (nessuna opzione, una variante disponibile): si aggiunge con un clic", [0, false, true, true, false, "aggiungi", ["CUR-BALSAMO-01"]], [balsamo.nColori, balsamo.conVarianti, balsamo.aggiungibile, balsamo.disponibile, balsamo.senzaPrezzo, K.azioneCard(balsamo), balsamo.skuVarianti]);
  c("kit (una variante): «aggiungi»", "aggiungi", K.azioneCard(K.cardDaPubblico(per("kit-prova"))));
  const conUnaOpzione = copia(per("balsamo-prova"));
  conUnaOpzione.opzioni = [{ nome: "Misura", valori: [{ valore: "Unica", campione: null }] }];
  const cardUnaOpzione = K.cardDaPubblico(conUnaOpzione);
  c("una variante ma con un'opzione (come la scheda): non si aggiunge dalla card, si va alla scheda", [true, false, "scegli"], [cardUnaOpzione.conVarianti, cardUnaOpzione.aggiungibile, K.azioneCard(cardUnaOpzione)]);
  const dueVariantiSenzaOpzioni = copia(per("balsamo-prova"));
  dueVariantiSenzaOpzioni.varianti.push({ ...dueVariantiSenzaOpzioni.varianti[0], sku: "CUR-BALSAMO-02" });
  const card2v = K.cardDaPubblico(dueVariantiSenzaOpzioni);
  c("due varianti senza opzioni: «scegli» (non si indovina quale)", [true, false, "scegli"], [card2v.conVarianti, card2v.aggiungibile, K.azioneCard(card2v)]);
  const senzaVarianti = copia(per("balsamo-prova"));
  senzaVarianti.varianti = [];
  const cardSenzaVarianti = K.cardDaPubblico(senzaVarianti);
  c("nessuna variante (dato storto): non disponibile, non si aggiunge, «scegli»", [false, false, [], "scegli"], [cardSenzaVarianti.disponibile, cardSenzaVarianti.aggiungibile, cardSenzaVarianti.skuVarianti, K.azioneCard(cardSenzaVarianti)]);

  // ── esaurito ──
  const gamma = K.cardDaPubblico(per("patch-prova-gamma"));
  c("8 varianti, due esaurite: la card è disponibile", [8, true], [gamma.skuVarianti.length, gamma.disponibile]);
  const epsilon = K.cardDaPubblico(per("patch-prova-epsilon"));
  c("tutta esaurita: non disponibile, non si aggiunge, il bottone porta alla scheda («scegli»)", [false, false, "scegli", false], [epsilon.disponibile, epsilon.aggiungibile, K.azioneCard(epsilon), epsilon.senzaPrezzo]);
  const esauritoSenzaScelte = copia(per("balsamo-prova"));
  esauritoSenzaScelte.varianti[0].disponibile = false;
  const cardEsaurita = K.cardDaPubblico(esauritoSenzaScelte);
  c("senza scelte ma esaurito: niente «aggiungi», si va alla scheda che dice «Esaurito»", [false, false, "scegli"], [cardEsaurita.disponibile, cardEsaurita.aggiungibile, K.azioneCard(cardEsaurita)]);
  const senzaPrezzoDiVariante = copia(per("balsamo-prova"));
  senzaPrezzoDiVariante.varianti[0].prezzoCent = null;
  c("una variante con prezzo mancante non si aggiunge dalla card", false, K.cardDaPubblico(senzaPrezzoDiVariante).aggiungibile);

  // ── Invisible Derm (D39, V1-T6): nessuna cifra, bottone «Scopri» ──
  const derm = K.cardDaPubblico(INVISIBLE_DERM);
  c("Invisible Derm: senza prezzo, azione «scopri»", [true, null, false, "scopri"], [derm.senzaPrezzo, derm.prezzoCent, derm.prezziDiversi, K.azioneCard(derm)]);
  c("Invisible Derm: non disponibile e non si aggiunge, anche se ha scelte", [false, false], [derm.disponibile, derm.aggiungibile]);
  c("Invisible Derm: nella card l'unico numero è il conteggio dei colori (nessun prezzo, nessuna cifra)", [["nColori", 0]], Object.entries(derm).filter(([, v]) => typeof v === "number"));
  c("Invisible Derm: tolti SKU, indirizzo e foto (identificatori), nella card non c'è nessuna cifra", false, (() => {
    const s = JSON.stringify({ ...derm, skuVarianti: [], slug: "", foto: null });
    return /\d/.test(s.replace(/"nColori":0/, ""));
  })());
  const dermConPrezzoPerErrore = copia(INVISIBLE_DERM);
  dermConPrezzoPerErrore.acquistabile = true;
  dermConPrezzoPerErrore.prezzoDaCent = 12300;
  for (const v of dermConPrezzoPerErrore.varianti) { v.prezzoCent = 12300; v.disponibile = true; }
  const dermStorta = K.cardDaPubblico(dermConPrezzoPerErrore);
  c("Invisible Derm con un prezzo arrivato per errore: la card non lo porta, resta «scopri», non si aggiunge", [null, true, false, false, "scopri"], [dermStorta.prezzoCent, dermStorta.senzaPrezzo, dermStorta.prezziDiversi, dermStorta.aggiungibile, K.azioneCard(dermStorta)]);
  c("…e nemmeno la card come testo contiene 12300", false, JSON.stringify(dermStorta).includes("12300"));
  for (const nome of ["Invisibile Derm", "Invisible-Derm", "invisible_derm", "InvisibleDerm Protocol"]) {
    const p = copia(INVISIBLE_DERM);
    p.nome = nome; p.slug = "altro-slug"; p.acquistabile = true; p.prezzoDaCent = 9900;
    c(`riconosciuto dal nome «${nome}»: senza prezzo, «scopri»`, [true, null, "scopri"], [K.cardDaPubblico(p).senzaPrezzo, K.cardDaPubblico(p).prezzoCent, K.azioneCard(K.cardDaPubblico(p))]);
  }
  const dermDalloSlug = copia(per("patch-prova-alfa"));
  dermDalloSlug.slug = "invisible-derm-altro"; dermDalloSlug.nome = "Un altro nome";
  c("riconosciuto dallo slug: senza prezzo", [true, null], [K.cardDaPubblico(dermDalloSlug).senzaPrezzo, K.cardDaPubblico(dermDalloSlug).prezzoCent]);
  const solventeDerm = copia(per("balsamo-prova"));
  solventeDerm.nome = "Solvente per Invisible Derm"; solventeDerm.slug = "solvente-per-invisible-derm";
  c("un prodotto che nomina Invisible Derm ma non lo è (il nome non comincia così) conserva il prezzo", [false, 1690], [K.cardDaPubblico(solventeDerm).senzaPrezzo, K.cardDaPubblico(solventeDerm).prezzoCent]);
  const nonAcquistabile = copia(per("balsamo-prova"));
  nonAcquistabile.acquistabile = false;
  c("un prodotto non acquistabile (qualunque sia il nome) non mostra il prezzo e non si aggiunge", [true, null, false, "scopri"], [K.cardDaPubblico(nonAcquistabile).senzaPrezzo, K.cardDaPubblico(nonAcquistabile).prezzoCent, K.cardDaPubblico(nonAcquistabile).aggiungibile, K.azioneCard(K.cardDaPubblico(nonAcquistabile))]);
  for (const [nome, valore] of [["null", null], ["zero", 0], ["negativo", -5], ["decimale", 12.5], ["testo", "100"], ["NaN", NaN]]) {
    const p = copia(per("balsamo-prova"));
    p.prezzoDaCent = valore;
    const k = K.cardDaPubblico(p);
    c(`prezzoDaCent «${nome}» (dato storto): nessun prezzo inventato, «scopri»`, [true, null, "scopri"], [k.senzaPrezzo, k.prezzoCent, K.azioneCard(k)]);
  }

  // ── foto ──
  c("nessuna foto: foto e alt sono null (la card sa che non c'è)", [null, null], [K.cardDaPubblico(per("patch-prova-alfa", CATALOGO_SENZA_FOTO)).foto, K.cardDaPubblico(per("patch-prova-alfa", CATALOGO_SENZA_FOTO)).fotoAlt]);
  c("una sola foto (la principale): c'è", true, K.cardDaPubblico(per("patch-prova-alfa", CATALOGO_UNA_FOTO)).foto !== null);
  const soloScala = copia(per("patch-prova-alfa"));
  soloScala.media = soloScala.media.filter((m) => m.slot === "scala");
  c("senza la principale ma con la foto di scala: nessuna foto (la scala non è una foto da card)", null, K.cardDaPubblico(soloScala).foto);
  const principaleSenzaSrc = copia(per("patch-prova-alfa"));
  principaleSenzaSrc.media[0].src = null;
  c("principale senza file: nessuna foto", [null, null], [K.cardDaPubblico(principaleSenzaSrc).foto, K.cardDaPubblico(principaleSenzaSrc).fotoAlt]);
  const senzaMediaCampo = copia(per("patch-prova-alfa"));
  delete senzaMediaCampo.media;
  c("senza l'elenco dei media (dato storto): nessuna foto, nessun errore", null, K.cardDaPubblico(senzaMediaCampo).foto);
  const riga = (v) => K.cardDaPubblico({ ...copia(per("balsamo-prova")), rigaPresentazione: v }).riga;
  c("riga: null, vuota o di soli spazi → null; altrimenti il testo senza spazi attorno", [null, null, null, "Una riga."], [riga(null), riga(""), riga("   "), riga("  Una riga.  ")]);

  // ── tutto il catalogo ──
  const tutte = CATALOGO.map(K.cardDaPubblico);
  c("tutto il catalogo di prova si legge senza errori e ogni card ha le 13 chiavi", 9, tutte.filter((k) => Object.keys(k).length === CHIAVI.length).length);
  c("l'unica card «scopri» è Invisible Derm", ["invisible-derm-prova"], tutte.filter((k) => K.azioneCard(k) === "scopri").map((k) => k.slug));
  c("le azioni di tutto il catalogo (lo shampoo ha due misure: «scegli»)", ["scegli", "scegli", "scegli", "scegli", "scegli", "scegli", "aggiungi", "aggiungi", "scopri"], tutte.map(K.azioneCard));
  c("nessuna parola vietata, nessun segnaposto aperto in nessuna card", [], tutte.flatMap((k) => trovaParoleVietate(JSON.stringify(k))));
  c("la funzione non cambia l'ingresso (i dati sono congelati: modificarli lancerebbe)", 9, CATALOGO.map(K.cardDaPubblico).length);
  const prima = JSON.stringify(per("patch-prova-gamma"));
  K.cardDaPubblico(per("patch-prova-gamma"));
  c("…e il prodotto è identico a prima", prima, JSON.stringify(per("patch-prova-gamma")));

  // ── azioneCard sulle sole card (anche a mano) ──
  const base = { senzaPrezzo: false, aggiungibile: false, conVarianti: false };
  c("azioneCard: senza prezzo vince su tutto (anche se la card dice «aggiungibile»)", "scopri", K.azioneCard({ ...base, senzaPrezzo: true, aggiungibile: true, conVarianti: true }));
  c("azioneCard: aggiungibile → «aggiungi»", "aggiungi", K.azioneCard({ ...base, aggiungibile: true }));
  c("azioneCard: né l'uno né l'altro → «scegli»", "scegli", K.azioneCard(base));
  c("azioneCard: con scelte → «scegli»", "scegli", K.azioneCard({ ...base, conVarianti: true }));

  // ── soloLeggere ──
  const elenco = K.soloLeggere(CATALOGO);
  c("soloLeggere: una card per prodotto, nello stesso ordine", CATALOGO.map((p) => p.slug), elenco.map((k) => k.slug));
  c("soloLeggere: ogni card è quella di cardDaPubblico", CATALOGO.map(K.cardDaPubblico), elenco);
  c("soloLeggere: la copia JSON è uguale (si può mandare al browser)", elenco, JSON.parse(JSON.stringify(elenco)));
  c("soloLeggere: il peso è una frazione dell'elenco completo", true, JSON.stringify(elenco).length * 4 < JSON.stringify(CATALOGO).length);
  c("soloLeggere: ingressi che non sono elenchi → vuoto", [[], [], []], [K.soloLeggere(null), K.soloLeggere(undefined), K.soloLeggere("patch")]);
  c("soloLeggere: salta le voci senza nome o senza indirizzo, tiene le altre", ["balsamo-prova"], K.soloLeggere([null, 3, {}, { slug: "x" }, { nome: "y" }, per("balsamo-prova")]).map((k) => k.slug));
  c("soloLeggere: elenco vuoto → vuoto", [], K.soloLeggere([]));
  c("soloLeggere: Invisible Derm nell'elenco leggero non ha prezzo e nessuna cifra di prezzo", [null, false], [elenco.at(-1).prezzoCent, JSON.stringify(elenco.at(-1)).includes("12300")]);

  // ── badge «Pronta consegna» (D86) ──
  const B = K.badgeProntaConsegna;
  const testo = TESTI_SHOP.card.prontaConsegna;
  c("badge: testo confermato + disponibile → la costante del copy", testo, B({ pronta_consegna: "Testo di prova sulla pronta consegna." }, true));
  c("badge: il testo del titolare non compare (serve solo da interruttore)", false, String(B({ pronta_consegna: "Spediamo in giornata davvero" }, true)).includes("giornata"));
  c("badge: testo confermato ma non disponibile → nessun badge", null, B({ pronta_consegna: "Vero." }, false));
  c("badge: disponibile ma testo non confermato (null, vuoto, spazi, segnaposto, assente) → nessun badge", [null, null, null, null, null, null, null], [B({ pronta_consegna: null }, true), B({ pronta_consegna: "" }, true), B({ pronta_consegna: "   " }, true), B({ pronta_consegna: "{{da confermare}}" }, true), B({}, true), B(null, true), B(undefined, true)]);
  c("badge: né l'uno né l'altro → nessun badge", null, B({ pronta_consegna: null }, false));
  c("badge: «disponibile» deve essere proprio vero (un valore storto non basta)", [null, null, null], [B({ pronta_consegna: "Vero." }, "true"), B({ pronta_consegna: "Vero." }, 1), B({ pronta_consegna: "Vero." }, undefined)]);
  c("badge: il testo del titolare non di tipo testo (numero) → nessun badge", null, B({ pronta_consegna: 5 }, true));
  c("badge sulle card: con tutto confermato si accende solo dove c'è una variante disponibile (non Invisible Derm, non l'esaurita)", ["balsamo-prova", "kit-prova", "patch-prova-alfa", "patch-prova-beta", "patch-prova-delta", "patch-prova-gamma", "shampoo-prova"], tutte.filter((k) => B({ pronta_consegna: "Vero." }, k.disponibile)).map((k) => k.slug).sort());
  c("badge: senza nessun testo confermato nessuna card ha il badge", 0, tutte.filter((k) => B({}, k.disponibile)).length);
  c("badge e costanti: nessuna parola vietata", [], trovaParoleVietate(`${testo} ${TESTI_PROVVISORI.card.nColori} ${TESTI_PROVVISORI.card.scopri}`));
}
