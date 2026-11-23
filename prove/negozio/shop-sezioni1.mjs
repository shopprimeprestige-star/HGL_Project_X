/** ── VETRINA V1 · T88a · SEZIONI SOTTO IL BLOCCO D'ACQUISTO, PRIMA PARTE ───────
 *  Il componente VERO `SezioniScheda1` disegnato con esbuild + react-dom/server (aiuti di `_rende.mjs`) con i dati inventati di
 *  `_dati-vetrina.mjs`: «Il colore, alla luce del giorno» (solo patch), «Nella confezione» (kit: «Cosa contiene»), «Come si usa»
 *  (passi numerati), «Scheda tecnica» (tabella, mai una riga «da confermare») e «Avvertenze» (dopo la scheda tecnica, solo con voci).
 *  Regole: slot vuoti = il blocco perde il media e tiene il testo (V1-T5); video senza copertina = non si disegna; nessuna sezione vuota
 *  (testo di riserva se il testo manca); nessuna stella, nessun «da confermare», nessuna parola vietata (V1-S5, V1-T6).
 *  `FotoShop` e `VideoSlot` sono quelli veri. Nessuna rete, nessun browser: fuoco e scorrimento restano [M]. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOGO, CATALOGO_SENZA_FOTO, INVISIBLE_DERM, TARIFFA_OK, trovaParoleVietate } from "./_dati-vetrina.mjs";
import { gestore, rendiComponente } from "./_rende.mjs";

const per = (slug, catalogo = CATALOGO) => catalogo.find((p) => p.slug === slug);
/** Il testo che si legge: senza marcatura, spazi fissi come spazi. */
const leggibile = (html) => html.replace(/<[^>]*>/g, " ").replace(/ /g, " ").replace(/\s+/g, " ").trim();
const conta = (html, re) => (html.match(re) ?? []).length;
const attr = (tag, nome) => (tag?.match(new RegExp(`\\s${nome}="([^"]*)"`, "i")) ?? [])[1];
const copia = (x) => structuredClone(x);
/** Come la scrive il disegno: l'apostrofo diventa `&#x27;` nell'attributo. */
const esc = (t) => String(t).replace(/'/g, "&#x27;");

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T88a · SEZIONI SOTTO IL BLOCCO D'ACQUISTO, PRIMA PARTE (23/11/2026)");
  const KS = mod["shop/cms/vetrina-scheda"];
  const KC = mod["shop/cms/vetrina-contenuto"];
  const file = join(radice, "src/components/shop/scheda/SezioniScheda1.tsx");
  const sorgente = readFileSync(file, "utf8");

  // ── i contenuti dell'editor (T80): testi e media come li dà il server, passati per `testiDi`/`mediaDi` ──
  const BASE = "https://prova.test/slot";
  const SALVATI = {
    testi: { "shop.coloriTrascrizione": "Il testo parlato del video dei colori." },
    media: {
      "shop.pacco": `${BASE}/pacco.webp`,
      "shop.coloriFoto": `${BASE}/colori-foto.webp`,
      "shop.coloriVideo": `${BASE}/colori-video.mp4`,
      "shop.coloriPoster": `${BASE}/colori-poster.webp`,
    },
  };
  const dati = (contenuto = SALVATI) => ({ testi: KC.testiDi(contenuto), media: KC.mediaDi(contenuto) });
  const VUOTO = dati({ testi: {}, media: {} });

  const blocchiDi = (p) => KS.bloccheScheda(p, { tariffa: TARIFFA_OK });
  const disegna = async (p, extra = {}, stato = {}) => {
    const { blocchi = blocchiDi(p), contenuto = dati(), ...resto } = extra;
    return rendiComponente(radice, file, "SezioniScheda1", { prodotto: p, blocchi, testi: contenuto.testi, media: contenuto.media, ...resto }, stato);
  };
  const html = async (p, extra, stato) => (await disegna(p, extra, stato)).html;
  /** Il pezzo di HTML della sezione col titolo `titolo` (dal suo `<section` al `</section>`). */
  const sezione = (h, titolo) => {
    const i = h.indexOf(`>${titolo}</h2>`);
    if (i < 0) return "";
    const da = h.lastIndexOf("<section", i);
    return h.slice(da, h.indexOf("</section>", i) + 10);
  };
  const hTesto = (h, t) => h.includes(`>${t}</h2>`);
  const T = { colore: "Il colore, alla luce del giorno", confezione: "Nella confezione", cosa: "Cosa contiene", uso: "Come si usa", tecnica: "Scheda tecnica", avv: "Avvertenze" };

  const alfa = per("patch-prova-alfa");
  const hAlfa = await html(alfa);
  const tAlfa = leggibile(hAlfa);

  // ════ 1 · LE SEZIONI, L'ORDINE, I TITOLI ═══════════════════════════════════
  c("una patch: i cinque titoli, ognuno un h2", [1, 1, 1, 1, 1], [T.colore, T.confezione, T.uso, T.tecnica, T.avv].map((t) => conta(hAlfa, new RegExp(`<h2\\b[^>]*>${t}</h2>`, "g"))));
  c("ordine: colore, confezione, come si usa, scheda tecnica, avvertenze", true, [T.colore, T.confezione, T.uso, T.tecnica, T.avv].map((t) => hAlfa.indexOf(`>${t}<`)).every((n, i, v) => n > 0 && (i === 0 || n > v[i - 1])));
  c("ogni sezione è una <section> col titolo come nome (aria-labelledby che punta al suo h2)", true, [T.colore, T.confezione, T.uso, T.tecnica, T.avv].every((t) => {
    const s = sezione(hAlfa, t);
    const id = attr(s.match(/^<section\b[^>]*>/)?.[0], "aria-labelledby");
    return !!id && new RegExp(`<h2\\b[^>]*id="${id}"`).test(s);
  }));
  c("i testi vengono da `testi-shop.ts`: nessun titolo scritto nel componente", [false, true], [/Il colore, alla luce del giorno|Nella confezione|Scheda tecnica|Come si usa|Hai dubbi tra due tonalit/.test(sorgente.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")), /TESTI_SHOP\.scheda/.test(sorgente)]);
  c("nessuna stella, recensione, barrato, ombra, gradiente nel disegno e nessuna parola vietata", [[], false], [trovaParoleVietate(hAlfa), /\bstar\b|stell|recension|★|shadow|gradient|backdrop|blur/i.test(hAlfa)]);
  c("nessun «da confermare», nessun segnaposto aperto, nessun «undefined»/«null» nel testo", false, /da confermare|\{\{|undefined|\bnull\b|NaN/i.test(tAlfa));

  // ── i blocchi comandano: senza il blocco la sezione non c'è ──
  const senza = (id) => blocchiDi(alfa).filter((b) => b.id !== id);
  c("senza il blocco `colore` niente colore (decide `bloccheScheda`, non il componente)", [false, true], [hTesto(await html(alfa, { blocchi: senza("colore") }), T.colore), hTesto(await html(alfa, { blocchi: senza("avvertenze") }), T.colore)]);
  c("un blocco che non è suo (galleria, acquisto, faq, box, tiServeAnche) non disegna niente: solo i blocchi di T88a", true, !/Domande frequenti|Non è il prodotto giusto|Ti serve anche|Aggiungi al carrello/.test(tAlfa) && leggibile(await html(alfa, { blocchi: [{ id: "galleria" }, { id: "faq" }, { id: "box" }] })) === "");
  c("nessun blocco suo = nessun nodo (stringa vuota, non un <div> vuoto)", "", await html(alfa, { blocchi: [{ id: "galleria" }, { id: "faq" }] }));

  // ── `parte`: la pagina sul computer mette colore e confezione sotto la galleria e il resto a tutta larghezza ──
  const hMedia = await html(alfa, { parte: "media" });
  const hTesto2 = await html(alfa, { parte: "testo" });
  c("`parte=\"media\"`: solo colore e confezione", [true, true, false, false, false], [T.colore, T.confezione, T.uso, T.tecnica, T.avv].map((t) => hTesto(hMedia, t)));
  c("`parte=\"testo\"`: solo come si usa, scheda tecnica, avvertenze", [false, false, true, true, true], [T.colore, T.confezione, T.uso, T.tecnica, T.avv].map((t) => hTesto(hTesto2, t)));
  c("le due parti insieme dicono quello che dice il disegno intero", leggibile(hAlfa), `${leggibile(hMedia)} ${leggibile(hTesto2)}`);

  // ════ 2 · IL COLORE, ALLA LUCE DEL GIORNO (solo patch) ═════════════════════
  const sColore = sezione(hAlfa, T.colore);
  const tColore = leggibile(sColore);
  c("colore: il testo del documento e la chiusura", [true, true], [tColore.includes("A schermo i colori possono cambiare. Nelle foto vedi il campione alla luce del giorno, vicino a una base vera."), tColore.includes("Hai dubbi tra due tonalità? Scrivici, scegliamo insieme.")]);
  const imgColore = sColore.match(/<img\b[^>]*>/g) ?? [];
  const fotoColore = imgColore.find((i) => attr(i, "src") === SALVATI.media["shop.coloriFoto"]);
  c("colore: la foto dell'anello colori è una <img> vera (FotoShop), 4:3, con la descrizione del CMS, lazy", [true, "960", "720", "lazy", true], [!!fotoColore, attr(fotoColore, "width"), attr(fotoColore, "height"), attr(fotoColore, "loading"), /aspect-ratio:\s*4\s*\/\s*3/.test(sColore)]);
  c("colore: la descrizione della foto è quella dell'editor (non vuota)", true, !!attr(fotoColore, "alt") && attr(fotoColore, "alt") === dati().testi["shop.coloriFoto.alt"]);
  const bottoneVideo = sColore.match(/<button\b[^>]*>/)?.[0];
  c("colore: il video è con la copertina e un bottone «Guarda come si abbina il colore» (un solo <button>), niente <video> prima del clic", [1, "button", true, 0], [conta(sColore, /<button\b/g), "button", attr(bottoneVideo, "aria-label")?.includes("Guarda come si abbina il colore"), conta(sColore, /<video\b/g)]);
  c("colore: la copertina è quella dello slot; il bottone ha il tipo giusto e un nome", [true, "button"], [sColore.includes(SALVATI.media["shop.coloriPoster"]), attr(bottoneVideo, "type") === "button" ? "button" : "?"]);
  c("colore: il testo parlato sta in «Leggi il testo del video» (details/summary), con il testo", [true, true], [/<details\b/.test(sColore) && tColore.includes("Leggi il testo del video"), tColore.includes(SALVATI.testi["shop.coloriTrascrizione"])]);
  c("colore: i media stanno PRIMA del testo nell'ordine del documento (la <img> prima del titolo)", true, sColore.indexOf("<img") < sColore.indexOf(`>${T.colore}</h2>`));
  c("colore: due colonne (media a sinistra) solo se c'è lo spazio per davvero: container query, non la larghezza dello schermo", [true, false], [/@container/.test(sColore) && /@2xl:grid-cols-2/.test(sColore), /\b(md|lg|sm):grid-cols-2/.test(sColore)]);

  // ── slot vuoti (V1-T5) ──
  const hColoreVuoto = await html(alfa, { contenuto: VUOTO });
  const sColoreVuoto = sezione(hColoreVuoto, T.colore);
  c("colore con tutti gli slot vuoti: resta il solo testo, nessuna <img>, nessun bottone, nessun riquadro grigio", [true, 0, 0, false], [leggibile(sColoreVuoto).includes("A schermo i colori possono cambiare"), conta(sColoreVuoto, /<img\b/g), conta(sColoreVuoto, /<button\b/g), /@2xl:grid-cols-2/.test(sColoreVuoto)]);
  const senzaCopertina = dati({ ...SALVATI, media: { ...SALVATI.media, "shop.coloriPoster": "" } });
  const sSenzaCopertina = sezione(await html(alfa, { contenuto: senzaCopertina }), T.colore);
  c("video SENZA copertina = non si disegna (né bottone né testo parlato); la foto resta", [0, 0, false, true], [conta(sSenzaCopertina, /<button\b/g), conta(sSenzaCopertina, /<video\b/g), /Leggi il testo del video/.test(sSenzaCopertina), sSenzaCopertina.includes(SALVATI.media["shop.coloriFoto"])]);
  const soloFoto = dati({ ...SALVATI, media: { "shop.coloriFoto": SALVATI.media["shop.coloriFoto"] } });
  const sSoloFoto = sezione(await html(alfa, { contenuto: soloFoto }), T.colore);
  c("solo la foto: niente video, niente «Guarda come si abbina il colore», niente testo parlato (non c'è il video)", [true, 0, false, false], [sSoloFoto.includes(SALVATI.media["shop.coloriFoto"]), conta(sSoloFoto, /<button\b/g), /Guarda come si abbina/.test(sSoloFoto), /Leggi il testo del video/.test(sSoloFoto)]);
  const senzaAlt = dati({ testi: { "shop.coloriFoto.alt": "" }, media: SALVATI.media });
  c("una foto senza la sua descrizione non si disegna (il video non c'entra: ha la sua)", 0, conta(sezione(await html(alfa, { contenuto: senzaAlt }), T.colore).replace(/<button[\s\S]*?<\/button>/g, ""), /<img\b[^>]*colori-foto/g));

  // ── testo parlato e descrizioni: senza vero non si disegna ──
  const sParlato = async (parlato) => sezione(await html(alfa, { contenuto: { testi: { ...dati().testi, "shop.coloriTrascrizione": parlato }, media: dati().media } }), T.colore);
  c("testo parlato «da confermare» o con segnaposto (passato com'è, senza `testiDi`): niente «Leggi il testo del video», il video resta", [false, false, 1], [/<details\b/.test(await sParlato("Da confermare: il parlato")), /<details\b/.test(await sParlato("Il parlato {{da scrivere}}")), conta(await sParlato("Da confermare"), /<button\b/g)]);
  c("testo parlato vero: «Leggi il testo del video» c'è", true, /<details\b/.test(await sParlato("Il parlato vero.")));
  const conAlt = async (chiave) => sezione(await html(alfa, { contenuto: { testi: { ...dati().testi, [chiave]: "" }, media: dati().media } }), T.colore);
  c("copertina SENZA descrizione: il video non si disegna (né bottone né testo parlato); la foto resta", [0, false, true], [conta(await conAlt("shop.coloriPoster.alt"), /<button\b/g), /<details\b/.test(await conAlt("shop.coloriPoster.alt")), (await conAlt("shop.coloriPoster.alt")).includes(SALVATI.media["shop.coloriFoto"])]);
  c("video SENZA descrizione: il video non si disegna (la descrizione dà il nome al bottone)", [0, false], [conta(await conAlt("shop.coloriVideo.alt"), /<button\b/g), /<details\b/.test(await conAlt("shop.coloriVideo.alt"))]);

  // ── la chiusura: un'azione solo se la pagina la dà ──
  c("colore: senza `onConsulenza` la chiusura è solo testo (nessun <button> oltre al video)", 1, conta(sColore, /<button\b/g));
  let chiamate = 0;
  const prova = await disegna(alfa, { contenuto: VUOTO, onConsulenza: () => (chiamate += 1) });
  const sConsulenza = sezione(prova.html, T.colore);
  c("colore: con `onConsulenza` la frase «Hai dubbi tra due tonalità? Scrivici, scegliamo insieme.» è un bottone da 44 px, un clic = una chiamata", [1, true, true, 1], [conta(sConsulenza, /<button\b/g), /<button\b(?=[^>]*type="button")(?=[^>]*min-h-11)[^>]*>Hai dubbi tra due tonalità\? Scrivici, scegliamo insieme\.<\/button>/.test(sConsulenza), !leggibile(sConsulenza.replace(/<button[\s\S]*?<\/button>/g, "")).includes("Hai dubbi"), (gestore(prova.pagina, "button", "Hai dubbi")(), chiamate)]);

  // ── solo patch ──
  const cura = per("balsamo-prova");
  const kit = per("kit-prova");
  c("sulla cura e sul kit nessun «colore», anche se la pagina passa il blocco per errore", [false, false], [hTesto(await html(cura, { blocchi: [...blocchiDi(cura), { id: "colore" }] }), T.colore), hTesto(await html(kit, { blocchi: [...blocchiDi(kit), { id: "colore" }] }), T.colore)]);
  c("sulla cura nessun testo del colore e nessun video dei colori", false, /alla luce del giorno|tonalità|abbina il colore/i.test(leggibile(await html(cura))));

  // ════ 3 · NELLA CONFEZIONE ═════════════════════════════════════════════════
  const sConf = sezione(hAlfa, T.confezione);
  const proprio = alfa.media.find((m) => m.slot === "confezione");
  c("confezione: le voci sono un elenco di testo (<ul>, un <li> per voce)", [1, 2, true], [conta(sConf, /<ul\b/g), conta(sConf, /<li\b/g), alfa.confezione.every((v) => sConf.includes(`>${v}</li>`))]);
  const imgConf = sConf.match(/<img\b[^>]*>/g) ?? [];
  c("confezione: la foto è QUELLA DEL PRODOTTO (slot confezione) se c'è, con la sua descrizione; non quella globale", [1, proprio.alt, false], [imgConf.length, attr(imgConf[0], "alt"), sConf.includes(SALVATI.media["shop.pacco"])]);
  c("confezione: foto 4:3 (FotoShop, uso «pacco»), lazy, con srcset della foto del prodotto", [true, "lazy", true], [/aspect-ratio:\s*4\s*\/\s*3/.test(sConf), attr(imgConf[0], "loading"), /480w/.test(imgConf[0] ?? "")]);
  const senzaSua = copia(alfa);
  senzaSua.media = senzaSua.media.filter((m) => m.slot !== "confezione");
  const sPacco = sezione(await html(senzaSua), T.confezione);
  const imgPacco = sPacco.match(/<img\b[^>]*>/g) ?? [];
  c("confezione: il prodotto senza la sua foto usa `shop.pacco` (foto globale, un solo file) con la descrizione dell'editor", [1, SALVATI.media["shop.pacco"], esc(dati().testi["shop.pacco.alt"])], [imgPacco.length, attr(imgPacco[0], "src"), attr(imgPacco[0], "alt")]);
  // una foto «confezione» del prodotto senza nessuna misura usabile non conta: o `shop.pacco`, o niente (mai una seconda colonna vuota)
  const sSenzaMisure = copia(alfa);
  sSenzaMisure.media = sSenzaMisure.media.map((m) => (m.slot === "confezione" ? { ...m, src: null } : m));
  const sSenzaMisureConPacco = sezione(await html(sSenzaMisure), T.confezione);
  const sSenzaMisureVuoto = sezione(await html(sSenzaMisure, { contenuto: VUOTO }), T.confezione);
  c("confezione: la foto del prodotto senza misure (`src` nullo) cade su `shop.pacco`", [1, SALVATI.media["shop.pacco"]], [conta(sSenzaMisureConPacco, /<img\b/g), attr(sSenzaMisureConPacco.match(/<img\b[^>]*>/)?.[0], "src")]);
  c("confezione: né foto utilizzabile né `shop.pacco` = una colonna sola (nessuna griglia a due colonne vuota), l'elenco c'è", [false, 0, 2], [/@2xl:grid-cols-2/.test(sSenzaMisureVuoto), conta(sSenzaMisureVuoto, /<img\b/g), conta(sSenzaMisureVuoto, /<li\b/g)]);
  const sSenzaMisure0 = copia(alfa);
  sSenzaMisure0.media = sSenzaMisure0.media.map((m) => (m.slot === "confezione" ? { ...m, src: {} } : m));
  c("confezione: anche una foto con l'oggetto `src` vuoto (nessuna misura) non apre la seconda colonna", false, /@2xl:grid-cols-2/.test(sezione(await html(sSenzaMisure0, { contenuto: VUOTO }), T.confezione)));
  c("confezione: l'<ul> dichiara il suo ruolo (`role=\"list\"`, come i passi)", true, /<ul\b[^>]*role="list"/.test(sConf));
  const sNiente = sezione(await html(senzaSua, { contenuto: VUOTO }), T.confezione);
  c("confezione: né la sua foto né `shop.pacco` = nessuna <img>, resta l'elenco", [0, 2], [conta(sNiente, /<img\b/g), conta(sNiente, /<li\b/g)]);
  const hKit = await html(kit);
  c("kit: «Cosa contiene» al posto di «Nella confezione», sempre un elenco di testo", [true, false, true, 2], [hTesto(hKit, T.cosa), hTesto(hKit, T.confezione), kit.confezione.every((v) => sezione(hKit, T.cosa).includes(`>${v}</li>`)), conta(sezione(hKit, T.cosa), /<li\b/g)]);
  const vuotaConf = copia(alfa);
  vuotaConf.confezione = [];
  c("confezione senza voci: nessuna sezione, nemmeno con la foto (mai un titolo sopra il vuoto)", false, hTesto(await html(vuotaConf, { blocchi: [...blocchiDi(alfa).filter((b) => b.id !== "confezione"), { id: "confezione", titolo: "confezione", voci: [] }] }), T.confezione));
  c("confezione: le voci con un segnaposto aperto o «da confermare» o vuote non si disegnano", [1, false], [conta(sezione(await html(alfa, { blocchi: blocchiDi(alfa).map((b) => (b.id === "confezione" ? { ...b, voci: ["Un pezzo vero", "Da confermare: cosa c'è", "Qualcosa {{da dire}}", "  "] } : b)) }), T.confezione), /<li\b/g), /da confermare|\{\{/i.test(leggibile(await html(alfa, { blocchi: blocchiDi(alfa).map((b) => (b.id === "confezione" ? { ...b, voci: ["Un pezzo vero", "Da confermare: cosa c'è", "Qualcosa {{da dire}}"] } : b)) })))]);

  // ════ 4 · COME SI USA ══════════════════════════════════════════════════════
  const sUso = sezione(hAlfa, T.uso);
  c("come si usa: un elenco ordinato (<ol>) con un <li> per passo, nell'ordine del prodotto", [1, 2, true], [conta(sUso, /<ol\b/g), conta(sUso, /<li\b/g), sUso.indexOf(alfa.passi[0]) > 0 && sUso.indexOf(alfa.passi[0]) < sUso.indexOf(alfa.passi[1])]);
  c("come si usa: il numero grande `ng-pillar__num` (1, 2) su ogni passo, nascosto a chi legge (la lista già numera)", [2, ["1", "2"], 2], [conta(sUso, /class="ng-pillar__num"/g), [...sUso.matchAll(/<span\b[^>]*class="ng-pillar__num"[^>]*>(\d+)<\/span>/g)].map((m) => m[1]), conta(sUso, /<span\b(?=[^>]*aria-hidden="true")[^>]*class="ng-pillar__num"|<span\b(?=[^>]*class="ng-pillar__num")[^>]*aria-hidden="true"/g)]);
  c("come si usa: l'elenco dichiara il suo ruolo (list-none toglie la lista a VoiceOver) e il testo ha spazio per il numero", [true, true], [/<ol\b[^>]*role="list"/.test(sUso), /<li\b[^>]*\bpr-1[4-9]\b|<li\b[^>]*\bpr-2\d\b/.test(sUso)]);
  const tantiPassi = copia(alfa);
  tantiPassi.passi = ["Uno.", "Due.", "Tre.", "Quattro.", "Cinque.", "Sei.", "Sette.", "Otto.", "Nove.", "Dieci.", "Undici."];
  const numeri = [...sezione(await html(tantiPassi), T.uso).matchAll(/ng-pillar__num[^>]*>(\d+)</g)].map((m) => m[1]);
  c("come si usa con 11 passi: i numeri arrivano a 11", ["1", "11", 11], [numeri[0], numeri.at(-1), numeri.length]);
  const passiSporchi = copia(alfa);
  passiSporchi.passi = ["Un passo vero.", "", "Da confermare: il secondo passo", "Un passo con {{segnaposto}}", "Un altro passo vero."];
  const sSporchi = sezione(await html(passiSporchi), T.uso);
  c("come si usa: i passi vuoti o con segnaposto non si disegnano e i numeri restano di fila (1, 2)", [2, ["1", "2"], false], [conta(sSporchi, /<li\b/g), [...sSporchi.matchAll(/ng-pillar__num[^>]*>(\d+)</g)].map((m) => m[1]), /da confermare|\{\{/i.test(sSporchi)]);
  const senzaPassi = copia(alfa);
  senzaPassi.passi = [];
  c("senza passi nessuna sezione «Come si usa» (il blocco non c'è, e un blocco forzato col prodotto vuoto non disegna nulla)", [false, false], [hTesto(await html(senzaPassi), T.uso), hTesto(await html(senzaPassi, { blocchi: [...blocchiDi(alfa)] }), T.uso)]);
  c("come si usa su cura e kit: c'è, con lo stesso titolo", [true, true], [hTesto(await html(cura), T.uso), hTesto(hKit, T.uso)]);

  // ════ 5 · SCHEDA TECNICA ═══════════════════════════════════════════════════
  const sTec = sezione(hAlfa, T.tecnica);
  const righe = alfa.caratteristiche;
  c("scheda tecnica: una tabella a due colonne, una riga per caratteristica (etichetta = th di riga, valore = td)", [1, righe.length, righe.length, righe.length], [conta(sTec, /<table\b/g), conta(sTec, /<tr\b/g), conta(sTec, /<th\b[^>]*scope="row"/g), conta(sTec, /<td\b/g)]);
  c("scheda tecnica: le etichette e i valori sono quelli del prodotto, nell'ordine", true, righe.every((r, i) => sTec.indexOf(`>${r.etichetta}</th>`) > 0 && sTec.indexOf(`>${r.valore}</td>`) > 0 && (i === 0 || sTec.indexOf(`>${r.etichetta}</th>`) > sTec.indexOf(`>${righe[i - 1].etichetta}</th>`))));
  c("scheda tecnica: la tabella ha un nome per chi non vede (caption)", true, /<caption\b[^>]*>Scheda tecnica<\/caption>/.test(sTec));
  const sporco = copia(alfa);
  sporco.caratteristiche = [...alfa.caratteristiche, { etichetta: "Origine", valore: "Da Confermare" }, { etichetta: "Peso {{grammi}}", valore: "12 g" }, { etichetta: "", valore: "senza etichetta" }, { etichetta: "Senza valore", valore: "  " }];
  const hSporco = await html(sporco);
  c("scheda tecnica: nessuna riga «da confermare», con segnaposto o vuota nel DOM (le tre fonti: prodotto, blocchi, disegno)", [righe.length, false], [conta(sezione(hSporco, T.tecnica), /<tr\b/g), /da\s+confermare|\{\{|senza etichetta|Senza valore|Origine/i.test(hSporco)]);
  const sporcoNelBlocco = blocchiDi(alfa).map((b) => (b.id === "schedaTecnica" ? { ...b, righe: [...b.righe, { etichetta: "Origine", valore: "da confermare" }, { etichetta: "Colore {{x}}", valore: "ok" }] } : b));
  c("scheda tecnica: anche se il blocco arriva sporco il disegno la ripulisce (secondo cancello, come T78)", [righe.length, false], [conta(sezione(await html(alfa, { blocchi: sporcoNelBlocco }), T.tecnica), /<tr\b/g), /da\s+confermare|\{\{|Origine/i.test(await html(alfa, { blocchi: sporcoNelBlocco }))]);
  const soloSporche = copia(alfa);
  soloSporche.caratteristiche = [{ etichetta: "Origine", valore: "da confermare" }];
  c("scheda tecnica con sole righe da confermare: nessuna sezione, nessun titolo sopra il vuoto", false, hTesto(await html(soloSporche), T.tecnica));
  c("scheda tecnica: la tabella si legge anche stretta (larga al massimo come il testo, mai oltre lo schermo)", true, /<table\b[^>]*\bw-full\b/.test(sTec));

  // ════ 6 · AVVERTENZE (aggiunta del capo progetto) ═════════════════════════
  const sAvv = sezione(hAlfa, T.avv);
  c("avvertenze: un elenco di testo, una voce per riga, titolo «Avvertenze»", [1, alfa.avvertenze.length, true], [conta(sAvv, /<ul\b/g), conta(sAvv, /<li\b/g), alfa.avvertenze.every((v) => sAvv.includes(`>${v}</li>`))]);
  c("avvertenze: dopo la scheda tecnica (mai prima, mai dopo il resto)", true, hAlfa.indexOf(`>${T.avv}<`) > hAlfa.indexOf(`>${T.tecnica}<`));
  const piene = copia(alfa);
  piene.avvertenze = ["Prima avvertenza.", "Seconda avvertenza.", "Terza avvertenza."];
  c("avvertenze con tre voci: tre righe", 3, conta(sezione(await html(piene), T.avv), /<li\b/g));
  const senzaAvv = copia(alfa);
  senzaAvv.avvertenze = [];
  c("avvertenze vuote: nessun blocco, nessun titolo; il resto c'è", [false, true], [hTesto(await html(senzaAvv), T.avv), hTesto(await html(senzaAvv), T.tecnica)]);
  c("avvertenze: un blocco con voci vuote o con segnaposto non diventa una sezione vuota", [false, 1], [hTesto(await html(alfa, { blocchi: blocchiDi(alfa).map((b) => (b.id === "avvertenze" ? { ...b, voci: ["", "  ", "Da confermare"] } : b)) }), T.avv), conta(sezione(await html(alfa, { blocchi: blocchiDi(alfa).map((b) => (b.id === "avvertenze" ? { ...b, voci: ["Vera.", "{{da scrivere}}"] } : b)) }), T.avv), /<li\b/g)]);
  c("avvertenze anche sulla cura e sul kit", [true, true], [hTesto(await html(cura), T.avv), hTesto(hKit, T.avv)]);
  // il testo di riserva: se il copywriter svuota il titolo provvisorio, la sezione non resta senza nome
  const finto = { "@/landing/testi-shop": `import * as V from ${JSON.stringify(join(radice, "src/landing/testi-shop.ts"))}; export * from ${JSON.stringify(join(radice, "src/landing/testi-shop.ts"))}; export const TESTI_PROVVISORI = { ...V.TESTI_PROVVISORI, scheda: { ...V.TESTI_PROVVISORI.scheda, avvertenze: "", cosaContiene: "  " } };` };
  const hRiserva = await html(alfa, undefined, { finti: finto });
  c("avvertenze: il titolo provvisorio svuotato → testo di riserva «Avvertenze», mai una sezione senza titolo", [true, 1], [hTesto(hRiserva, "Avvertenze"), conta(hRiserva, /<h2\b[^>]*><\/h2>/g) === 0 ? 1 : 0]);
  c("kit: il titolo «Cosa contiene» svuotato → riserva «Cosa contiene», non «Nella confezione» e non vuoto", [true, false], [hTesto(await html(kit, undefined, { finti: finto }), "Cosa contiene"), /<h2\b[^>]*><\/h2>/.test(await html(kit, undefined, { finti: finto }))]);
  c("il disegno con il finto dei titoli è per il resto uguale (stesso testo, stesse sezioni)", leggibile(hAlfa), leggibile(hRiserva));

  // ════ 7 · INVISIBLE DERM: NESSUNA CIFRA, NIENTE DA COMPRARE ═══════════════
  const hDerm = await html(INVISIBLE_DERM);
  c("Invisible Derm: le sezioni di testo ci sono, ma nessun «colore», nessuna cifra, nessun euro", [true, false, false, false], [hTesto(hDerm, T.uso), hTesto(hDerm, T.colore), /€|euro/i.test(leggibile(hDerm)), /\d/.test(leggibile(hDerm).replace(/\b1\b|\b2\b/g, ""))]);

  // ════ 8 · SENZA FOTO, SENZA CONTENUTO ═════════════════════════════════════
  const nuda = per("patch-prova-alfa", CATALOGO_SENZA_FOTO);
  const hNuda = await html(nuda, { contenuto: VUOTO });
  c("tutto vuoto (nessuna foto del prodotto, nessuno slot): nessuna <img>, nessun bottone, nessun riquadro di fondo azzurro, i testi ci sono tutti", [0, 0, false, true], [conta(hNuda, /<img\b/g), conta(hNuda, /<button\b/g), /brand-velo-10/.test(hNuda), [T.colore, T.confezione, T.uso, T.tecnica, T.avv].every((t) => hTesto(hNuda, t))]);
  c("senza `testi`/`media` (props mancanti) il componente non lancia e tiene i testi", true, hTesto(await html(alfa, { contenuto: { testi: undefined, media: undefined } }), T.colore));

  // ════ 9 · FORMA, ACCESSIBILITÀ, MOVIMENTO ═════════════════════════════════
  c("nessun fondo di sezione nuovo fuori dalla scala del documento: colore e confezione su `bg-light-panel`, il resto su fondo pagina", [true, true, false, false], [/bg-light-panel/.test(sColore), /bg-light-panel/.test(sConf), /bg-light-panel/.test(sUso), /bg-light-panel/.test(sTec)]);
  c("nessun contenitore dentro un contenitore: il pannello del colore non contiene altri riquadri con bordo", false, /<section\b[\s\S]*?<(div|figure)\b[^>]*border-ink\/10[\s\S]*?<\/section>/.test(sColore));
  c("nessun movimento scritto qui (animate, transition, hover:translate): le animazioni sono di `styles.css`", false, /animate-|transition|hover:-?translate|motion-/.test(sorgente.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")));
  c("il sorgente non contiene «da confermare» né segnaposto aperti, nemmeno nei commenti, né l'indirizzo dello studio", false, /da confermare|\{\{|Scipioni/i.test(sorgente));
  c("il sorgente usa `FotoShop` per ogni foto (nessun <img> scritto a mano) e importa i testi solo da `testi-shop`", [false, true, true], [/<img\b/.test(sorgente.replace(/\/\*[\s\S]*?\*\//g, "")), /from "@\/components\/shop\/FotoShop"/.test(sorgente), /from "@\/landing\/testi-shop"/.test(sorgente)]);
  c("il componente non è montato in nessuna route (lo monta T97b)", [], await montato(radice));
}

/** I file di `src/routes` e `src/components` che importano `SezioniScheda1` (riga `from …/SezioniScheda1`: una citazione in un commento non conta) (salvo il file stesso). */
async function montato(radice) {
  const { readdirSync, statSync } = await import("node:fs");
  const trovati = [];
  const giro = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) giro(p);
      else if (/\.(tsx?|jsx?)$/.test(f) && !p.endsWith("SezioniScheda1.tsx") && /from\s+["'][^"']*\/SezioniScheda1["']/.test(readFileSync(p, "utf8"))) trovati.push(p.replace(radice, ""));
    }
  };
  for (const d of ["src/routes", "src/components", "src/shop"]) giro(join(radice, d));
  return trovati;
}
