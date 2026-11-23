/** ── VETRINA V1 · T85 · CARD, GRIGLIA, FIDUCIA, «TI SERVE ANCHE» ─────────────
 *  Parte 2: i quattro componenti DISEGNATI davvero (esbuild + react-dom/server, aiuti di `_rende.mjs`) con i dati inventati: foto 1:1 con
 *  `FotoShop`, badge solo se vero, nome 2 righe, prezzo sotto il nome, bottone di contorno da 44 px, un solo punto di tabulazione, nessuna
 *  stella/barrato/ombra, Invisible Derm senza cifra, «Aggiunto» con `statoAggiunta`, fiducia (`montaBlocco`/`montaFascia`), «Ti serve anche».
 *  `FotoShop` è quello VERO (T70c: `_rende.mjs` definisce `import.meta.env`, di base produzione).
 *  Parte 1 (commit a parte): `SnapRiga.foto` accetta le misure della card (480 e 960, senza 1600): la card mette nel carrello una riga la
 *  cui foto non ha la 1600, e le righe già salvate (con la 1600) devono restare valide (nota del revisore di T76, osservazione 1).
 *  Dati inventati di `_dati-vetrina.mjs`, nessuna rete. */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { CARRELLO_NUOVO, CATALOGO, CATALOGO_SENZA_FOTO, INVISIBLE_DERM, TARIFFA_ASSENTE, TARIFFA_OK, TESTI_CONFERMATI_PIENI, TESTI_CONFERMATI_VUOTI, carrelloFinto, righeServerDi, rigaCms, trovaParoleVietate } from "./_dati-vetrina.mjs";
import { gestore, rendiComponente } from "./_rende.mjs";

const requireQui = createRequire(import.meta.url);

const copia = (x) => structuredClone(x);

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T85 · LA RIGA DEL CARRELLO CON LA FOTO DELLA CARD (23/11/2026)");
  const K = mod["shop/cms/carrello"];
  const V = mod["shop/cms/vetrina-carrello"];

  // ── il tipo: SnapRiga.foto = MisureFoto | null (nel sorgente: i tipi non esistono quando gira la prova) ──
  const sorgente = readFileSync(join(radice, "src/shop/cms/carrello.ts"), "utf8");
  const snap = sorgente.match(/export interface SnapRiga \{[\s\S]*?\n\}/)?.[0] ?? "";
  c("SnapRiga.foto è MisureFoto | null (la card non ha la 1600)", true, /foto: MisureFoto \| null;/.test(snap));
  c("…e non pretende più SrcFoto per la foto della riga", false, /SrcFoto/.test(snap));

  // ── una riga come la mette la card: foto solo 480 e 960 ──
  const alfa = CATALOGO.find((p) => p.slug === "patch-prova-alfa");
  const principale = alfa.media.find((m) => m.slot === "principale").src;
  const dallaCard = { ...rigaCms(alfa, 0, 1), snap: { ...rigaCms(alfa, 0, 1).snap, foto: { w480: principale.w480, w960: principale.w960 } } };
  const vecchiaSalvata = copia(CARRELLO_NUOVO[0]); // salvata prima: ha la 1600
  c("la riga già salvata ha la foto con la 1600", true, typeof vecchiaSalvata.snap.foto.w1600 === "string");
  const server = righeServerDi([dallaCard.sku]);
  const pulita = K.ripulisciRighe([vecchiaSalvata, dallaCard], [...server, ...righeServerDi([vecchiaSalvata.sku])]);
  c("ripulisciRighe: tutte e due restano, nessuna rimossa", [2, 0], [pulita.righe.length, pulita.rimosse]);
  const vista = V.righeVista([vecchiaSalvata, dallaCard], "ok");
  c("la vista: la foto della riga vecchia resta intera, con la 1600", principale, vista.righe[0].foto);
  c("la vista: la foto della riga della card è quella della card, senza una 1600 inventata", { w480: principale.w480, w960: principale.w960 }, vista.righe[1].foto);
  c("il totale non cambia per la foto", K.totaleDaRighe([vecchiaSalvata]), K.totaleDaRighe([{ ...vecchiaSalvata, snap: { ...vecchiaSalvata.snap, foto: { w480: principale.w480, w960: principale.w960 } } }]));

  // ════ PARTE 2 · I COMPONENTI DISEGNATI ═══════════════════════════════════════
  await componenti(mod, { c, gruppo, radice });
}

const per = (slug, catalogo = CATALOGO) => catalogo.find((p) => p.slug === slug);
/** Il testo che si legge: senza marcatura, con lo spazio fisso dell'euro come spazio. */
const leggibile = (html) => html.replace(/<[^>]*>/g, " ").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
const conta = (html, re) => (html.match(re) ?? []).length;
const attr = (html, nome) => (html.match(new RegExp(`\\s${nome}="([^"]*)"`, "i")) ?? [])[1];
/** Gli elementi che si raggiungono con Tab: link, bottoni, tabindex non negativo (i nodi `aria-hidden` non contano: nessuno li legge né li raggiunge). */
const punti = (html) => conta(html, /<(a|button)\b/g) + conta(html, /tabindex="(?!-)/g);

async function componenti(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T85 · CARD, GRIGLIA, FIDUCIA, «TI SERVE ANCHE» (23/11/2026)");
  const KC = mod["shop/cms/vetrina-card"];
  const KF = mod["shop/cms/vetrina-fiducia"];
  const KS = mod["shop/cms/vetrina-scheda"];
  const dir = (f) => join(radice, "src/components/shop", f);
  const registro = () => { const aggiunte = []; return { aggiunte, carrello: carrelloFinto([], { add: (...a) => aggiunte.push(a) }) }; };
  const disegna = (file, nome, props, extra = {}) => rendiComponente(radice, dir(file), nome, props, extra);
  const card = (slug, catalogo = CATALOGO) => KC.cardDaPubblico(per(slug, catalogo));
  const disegnaCard = async (cardo, props = {}, extra = {}) => (await disegna("CardProdotto.tsx", "CardProdotto", { card: cardo, ...props }, extra)).html;

  // ── la card con scelte (3 colori, prezzi diversi) ──
  const alfa = card("patch-prova-alfa");
  const hAlfa = await disegnaCard(alfa);
  const tAlfa = leggibile(hAlfa);
  c("foto: un solo <img> quadrato (960×960) con l'alt del CMS, dal componente `FotoShop`", [1, "960", "960", alfa.fotoAlt], [conta(hAlfa, /<img\b/g), attr(hAlfa, "width"), attr(hAlfa, "height"), attr(hAlfa, "alt")]);
  c("foto: riquadro 1:1, fondo azzurro tenue (brand-velo-10), srcset 480+960 senza 1600, lazy", [true, true, `${alfa.foto.w480} 480w, ${alfa.foto.w960} 960w`, "lazy"], [/aspect-ratio:\s*1\s*\/\s*1/.test(hAlfa), /brand-velo-10/.test(hAlfa), attr(hAlfa, "srcset"), attr(hAlfa, "loading")]);
  c("il nome è un link alla scheda, dentro un titolo (h3) che taglia a 2 righe", [`/shop/prodotto/${alfa.slug}`, true, true], [attr(hAlfa.match(/<a\b[^>]*>/)?.[0] ?? "", "href"), /<h3\b[^>]*line-clamp-2/.test(hAlfa), hAlfa.includes(`>${alfa.nome}</a>`)]);
  c("area estesa: il link copre tutta la card (after:inset-0, card relative)", [true, true], [/<a\b[^>]*after:absolute after:inset-0/.test(hAlfa), /<article\b[^>]*\brelative\b/.test(hAlfa)]);
  c("un solo punto di tabulazione per card con «Scegli» (nessun bottone, nessun secondo link)", [1, 0], [punti(hAlfa), conta(hAlfa, /<button\b/g)]);
  c("«Scegli» è il disegno del bottone: contorno 2 px, 44 px, non letto né tabulabile (aria-hidden), non pieno", [true, true, false], [/<span\b(?=[^>]*aria-hidden="true")(?=[^>]*min-h-11)(?=[^>]*border-2)[^>]*>Scegli<\/span>/.test(hAlfa), />Scegli</.test(hAlfa), /\bbg-(brand|\[#0A1430\])\b/.test(hAlfa)]);
  c("la riga di presentazione (2 righe) e «3 colori»", [true, true], [tAlfa.includes(alfa.riga) && /<p\b[^>]*line-clamp-2[^>]*>/.test(hAlfa), tAlfa.includes("3 colori")]);
  c("prezzi diversi: «Da 289,00 €» (la parola è provvisoria)", true, tAlfa.includes("Da 289,00 €"));
  c("il prezzo sta SOTTO il nome (mai sopra) e SOPRA il bottone", [true, true], [tAlfa.indexOf(alfa.nome) < tAlfa.indexOf("289,00"), tAlfa.indexOf("289,00") < tAlfa.indexOf("Scegli")]);
  c("il prezzo 18 px / 600, cifre tabulari", true, /<p\b[^>]*text-lg[^>]*font-semibold[^>]*tabular-nums|<p\b[^>]*tabular-nums[^>]*text-lg/.test(hAlfa) || /<p\b(?=[^>]*text-lg)(?=[^>]*font-semibold)(?=[^>]*tabular-nums)/.test(hAlfa));
  c("la card è bianca, con bordo ink/10, raggio 14, hover/fuoco bordo brand/35; la foto +3 % solo al passaggio", [true, true, true], [/<article\b(?=[^>]*bg-white)(?=[^>]*border-ink\/10)(?=[^>]*rounded-\[14px\])/.test(hAlfa), /hover:border-brand\/35/.test(hAlfa) && /focus-within:border-brand\/35/.test(hAlfa), /group-hover:\[&amp;_img\]:scale-\[1\.03\]/.test(hAlfa)]);
  c("nessuna stella, nessun «recensioni», nessun barrato (<del>, <s>, line-through), nessuna ombra, nessun gradiente", [[], false], [trovaParoleVietate(hAlfa), /star|recension|★|shadow|gradient|backdrop/i.test(hAlfa)]);
  c("il badge non c'è senza testi confermati", false, /Pronta consegna/.test(hAlfa));

  // ── badge «Pronta consegna» (D86) ──
  const hBadge = await disegnaCard(alfa, { testi: TESTI_CONFERMATI_PIENI });
  c("badge: testo confermato + variante disponibile → «Pronta consegna», pillola bianca in alto a sinistra, 12 px", [true, true], [/<span\b(?=[^>]*absolute)(?=[^>]*left-2)(?=[^>]*top-2)(?=[^>]*rounded-full)(?=[^>]*bg-white)(?=[^>]*text-xs)[^>]*>Pronta consegna</.test(hBadge), conta(hBadge, /Pronta consegna/g) === 1]);
  c("badge: testo confermato ma TUTTO esaurito → niente badge", false, /Pronta consegna/.test(await disegnaCard(card("patch-prova-epsilon"), { testi: TESTI_CONFERMATI_PIENI })));
  c("badge: nessun testo confermato (`{}`, null) → niente badge", [false, false], [/Pronta consegna/.test(await disegnaCard(alfa, { testi: TESTI_CONFERMATI_VUOTI })), /Pronta consegna/.test(await disegnaCard(alfa, { testi: null }))]);
  c("badge: il testo del titolare non finisce sulla card (serve solo da interruttore)", false, hBadge.includes(TESTI_CONFERMATI_PIENI.pronta_consegna));

  // ── «Aggiungi»: un solo formato, senza scelte ──
  const balsamo = card("balsamo-prova");
  const r1 = registro();
  const { html: hBalsamo, pagina: pBalsamo } = await disegna("CardProdotto.tsx", "CardProdotto", { card: balsamo }, { carrello: r1.carrello });
  c("«Aggiungi»: un bottone vero (type=button) di contorno, 44 px, sopra l'area estesa (z-10); più il link del nome = 2 punti", [1, true, true, true, 2], [conta(hBalsamo, /<button\b/g), /<button\b(?=[^>]*type="button")(?=[^>]*min-h-11)(?=[^>]*border-2)(?=[^>]*z-10)/.test(hBalsamo), /<button\b[^>]*>Aggiungi<span class="sr-only"> Balsamo di prova<\/span>/.test(hBalsamo), !/colori/.test(hBalsamo), punti(hBalsamo)]);
  c("«Aggiungi»: prezzo semplice (nessun «Da») e la regione di stato c'è, vuota", [true, false, true], [leggibile(hBalsamo).includes("16,90 €"), /Da 16,90/.test(leggibile(hBalsamo)), /<span role="status" class="sr-only"><\/span>/.test(hBalsamo)]);
  gestore(pBalsamo, "button", "Aggiungi")();
  const [prodotto, qty, variante, cms] = r1.aggiunte[0] ?? [];
  c("clic su «Aggiungi»: una riga, quantità 1, SKU della variante, nome, indirizzo e prezzo in centesimi", [1, 1, undefined, balsamo.skuVarianti[0], balsamo.nome, balsamo.slug, balsamo.prezzoCent], [r1.aggiunte.length, qty, variante, cms?.sku, cms?.snap.nome, cms?.snap.slug, cms?.snap.prezzoCent]);
  c("clic: la foto della riga è quella della card (480 e 960), senza una 1600 finta; nessuna variante da nominare", [{ w480: balsamo.foto.w480, w960: balsamo.foto.w960 }, null, balsamo.skuVarianti[0]], [cms?.snap.foto, cms?.snap.varianteNome, prodotto?.id]);
  c("clic: parte AddToCart con lo SKU della variante e il valore in centesimi", [["AddToCart", { contentIds: [balsamo.skuVarianti[0]], contentName: balsamo.nome, contentType: "product", valueCent: balsamo.prezzoCent, numItems: 1 }]], pBalsamo.eventi);
  const r2 = registro();
  const sporca = { ...balsamo, skuVarianti: [] };
  const { pagina: pSenzaSku } = await disegna("CardProdotto.tsx", "CardProdotto", { card: sporca }, { carrello: r2.carrello });
  gestore(pSenzaSku, "button", "Aggiungi")();
  c("una card «aggiungi» senza SKU non mette niente nel carrello e non emette niente", [0, 0], [r2.aggiunte.length, pSenzaSku.eventi.length]);

  // ── il bottone «Aggiunto» (T105: `statoAggiunta`, al timer CAMBIA uno stato) ──
  const comp = (await disegna("CardProdotto.tsx", "PulsanteAggiungi", { nome: "Balsamo di prova", aggiunto: false, onAggiungi() {} })).html;
  const dopo = (await disegna("CardProdotto.tsx", "PulsanteAggiungi", { nome: "Balsamo di prova", aggiunto: true, onAggiungi() {} })).html;
  c("prima del clic: «Aggiungi», niente spunta, regione di stato vuota", [true, false, true], [/>Aggiungi</.test(comp), /shop-pop/.test(comp), /<span role="status" class="sr-only"><\/span>/.test(comp)]);
  c("dopo il clic: «Aggiunto» con la spunta (shop-pop) e la regione dice «{nome} è nel carrello»; il bottone resta un bottone attivo", [true, true, true, false], [/Aggiunto/.test(dopo) && !/>Aggiungi</.test(dopo), /shop-pop/.test(dopo), /<span role="status" class="sr-only">Balsamo di prova è nel carrello<\/span>/.test(dopo), /disabled/.test(dopo)]);
  const sorg = readFileSync(dir("CardProdotto.tsx"), "utf8");
  c("lo stato viene da `statoAggiunta`; il timer dura `DURATA_AGGIUNTO_MS` e CAMBIA lo stato (`setAggiuntoIl(null)`), non un numero scritto a mano", [true, true, true, false], [/statoAggiunta\(aggiuntoIl, Date\.now\(\)\)/.test(sorg), /setTimeout\(\(\) => setAggiuntoIl\(null\), DURATA_AGGIUNTO_MS\)/.test(sorg), /import \{ DURATA_AGGIUNTO_MS, statoAggiunta \} from "@\/shop\/cms\/vetrina-interazioni"/.test(sorg), /\b2000\b/.test(sorg)]);
  c("il timer si ferma allo smontaggio e riparte a ogni clic", [true, true], [/useEffect\(\(\) => \(\) => void \(timer\.current && clearTimeout\(timer\.current\)\), \[\]\)/.test(sorg), /if \(timer\.current\) clearTimeout\(timer\.current\);\s*timer\.current = setTimeout/.test(sorg)]);

  // ── Invisible Derm: nessuna cifra, nessun «Aggiungi» ──
  const derm = KC.cardDaPubblico(INVISIBLE_DERM);
  const hDerm = await disegnaCard(derm);
  const tDerm = leggibile(hDerm);
  c("Invisible Derm: «Scopri», nessuna cifra, nessun euro, nessun «Aggiungi», nessun bottone", [true, false, false, false, 0, 1], [tDerm.includes("Scopri"), /\d/.test(tDerm), /€|euro/i.test(tDerm), /Aggiungi/.test(hDerm), conta(hDerm, /<button\b/g), punti(hDerm)]);
  const dermConCifra = { ...derm, prezzoCent: 12300, prezziDiversi: true, aggiungibile: true };
  c("Invisible Derm con una cifra arrivata per errore: se la card dice `senzaPrezzo` la cifra non si disegna", [false, false], [/12[.,]?300?|123/.test(leggibile(await disegnaCard({ ...dermConCifra, senzaPrezzo: true }))), />Aggiungi</.test(await disegnaCard({ ...dermConCifra, senzaPrezzo: true }))]);

  // ── foto assente, prima foto, livello del titolo ──
  const hSenzaFoto = await disegnaCard(KC.cardDaPubblico(per("balsamo-prova", CATALOGO_SENZA_FOTO)));
  c("senza foto: nessun <img>, nessun riquadro vuoto di sfondo", [0, false], [conta(hSenzaFoto, /<img\b/g), /brand-velo-10/.test(hSenzaFoto)]);
  const senzaFotoCard = KC.cardDaPubblico(per("balsamo-prova", CATALOGO_SENZA_FOTO));
  const hBadgeSenzaFoto = await disegnaCard(senzaFotoCard, { testi: TESTI_CONFERMATI_PIENI });
  c("senza foto con il badge vero: «Pronta consegna» nel flusso, prima del nome, non posato in assoluto sopra il nome", [1, false, true], [conta(hBadgeSenzaFoto, /Pronta consegna/g), /absolute left-2/.test(hBadgeSenzaFoto), hBadgeSenzaFoto.indexOf("Pronta consegna") < hBadgeSenzaFoto.indexOf(senzaFotoCard.nome)]);
  c("con la foto il badge resta posato sulla foto, una volta sola", [1, true], [conta(hBadge, /Pronta consegna/g), /absolute left-2/.test(hBadge)]);
  const hPrima = await disegnaCard(alfa, { prima: true });
  c("`prima`: la foto è eager con priorità alta (sopra la piega); le altre no", [["eager", "high"], [undefined]], [[attr(hPrima, "loading"), attr(hPrima, "fetchpriority")], [attr(hAlfa, "fetchpriority")]]);
  c("`livello=\"h2\"`: il titolo è un h2 (sotto l'H1 della pagina)", [true, false], [/<h2\b/.test(await disegnaCard(alfa, { livello: "h2" })), /<h3\b/.test(await disegnaCard(alfa, { livello: "h2" }))]);
  c("un solo colore: niente «1 colori»", false, /colori/.test(await disegnaCard(card("patch-prova-epsilon"))));
  c("esaurito senza scelte: «Scegli» (la scheda dice «Esaurito»), mai «Aggiungi»", [true, false], [/>Scegli</.test(await disegnaCard(card("patch-prova-epsilon"))), /Aggiungi/.test(await disegnaCard(card("patch-prova-epsilon")))]);

  // ── la griglia ──
  const tutte = KC.soloLeggere(CATALOGO);
  const gr = (props, extra) => disegna("GrigliaCard.tsx", "GrigliaCard", props, { carrello: registro().carrello, ...extra });
  const { html: hGriglia } = await gr({ card: tutte });
  c("griglia: una lista con una voce per prodotto (9), ognuna con la sua card; 2 colonne sul telefono, 3 dal tablet", [1, tutte.length, tutte.length, true], [conta(hGriglia, /<ul\b[^>]*role="list"/g), conta(hGriglia, /<li\b/g), conta(hGriglia, /<article\b/g), /<ul\b[^>]*grid-cols-2 md:grid-cols-3/.test(hGriglia)]);
  c("griglia: le card sono nell'ordine ricevuto", tutte.map((x) => x.nome), [...hGriglia.matchAll(/<h3\b[^>]*><a\b[^>]*>([^<]*)</g)].map((m) => m[1]));
  c("griglia: `colonne` 2, 3 e 4 dal computer", [true, true, true], [!/md:grid-cols-3/.test((await gr({ card: tutte, colonne: 2 })).html), /md:grid-cols-3/.test((await gr({ card: tutte, colonne: 3 })).html) && !/lg:grid-cols-4/.test((await gr({ card: tutte, colonne: 3 })).html), /lg:grid-cols-4/.test((await gr({ card: tutte, colonne: 4 })).html)]);
  c("griglia: solo la prima foto è sopra la piega con `prima`; di norma nessuna", [1, 0], [conta((await gr({ card: tutte, prima: true })).html, /<img\b[^>]*fetchPriority="high"/g), conta(hGriglia, /<img\b[^>]*fetchPriority="high"/g)]);
  c("griglia: senza card non disegna niente; un elenco non valido nemmeno", ["", ""], [(await gr({ card: [] })).html, (await gr({ card: null })).html]);
  const cardDerm = (hGriglia.match(/<article\b(?:(?!<\/article>)[\s\S])*Invisible Derm di prova(?:(?!<\/article>)[\s\S])*<\/article>/) ?? [""])[0];
  c("griglia con Invisible Derm dentro: la sua card c'è, senza cifra né euro; le altre hanno un prezzo", [true, false, 8], [cardDerm.length > 0, /\d|€/.test(leggibile(cardDerm)), conta(hGriglia, /<p\b[^>]*tabular-nums/g)]);
  c("la griglia con tutto il catalogo (Invisible Derm compreso) non porta parole vietate", [], trovaParoleVietate(hGriglia));
  c("griglia: un link per card (9) e un bottone solo per le card «aggiungi»", [tutte.length, tutte.filter((x) => KC.azioneCard(x) === "aggiungi").length], [conta(hGriglia, /<a\b/g), conta(hGriglia, /<button\b/g)]);

  // ── la fiducia ──
  const voci = KF.vociFiducia({ tariffa: TARIFFA_OK, testi: TESTI_CONFERMATI_PIENI, cassa: null });
  const bf = (props) => disegna("BloccoFiducia.tsx", "BloccoFiducia", props).then((r) => r.html);
  const hBlocco = await bf({ voci });
  const attese = KF.montaBlocco(voci);
  const righeBlocco = [...hBlocco.matchAll(/<span>([^<]*)<\/span>/g)].map((m) => m[1].replace(/&#x27;/g, "'"));
  c("blocco: una voce per riga, quelle di `montaBlocco` (spedizione, reso, WhatsApp), nell'ordine, con il loro testo", [["spedizione", "reso", "whatsapp"], attese.map((v) => v.testo)], [attese.map((v) => v.id), righeBlocco]);
  c("blocco: studio e consulenza non ci sono (sono della fascia)", [false, false], [voci.filter((v) => v.id === "studio" || v.id === "consulenza").some((v) => hBlocco.includes(v.testo)), /Studio a Roma|Consulenza gratuita/.test(hBlocco)]);
  c("blocco: icone decorative (aria-hidden), nessun «da confermare», nessun segnaposto, nessuna parola vietata", [attese.length, false, false, []], [conta(hBlocco, /<svg\b[^>]*aria-hidden="true"/g), /da confermare/i.test(hBlocco), /\{\{|\{[a-z]+\}/.test(hBlocco), trovaParoleVietate(hBlocco)]);
  c("blocco: zero voci (solo studio e consulenza, tariffa assente) → non si monta (niente nodo)", "", await bf({ voci: KF.vociFiducia({ tariffa: TARIFFA_ASSENTE, testi: {}, cassa: null }) }));
  c("blocco: elenco rotto o vuoto → niente, senza lanciare", ["", "", ""], [await bf({ voci: [] }), await bf({ voci: null }), await bf({ voci: [{ id: "spedizione", testo: "" }] })]);
  const hFascia = await bf({ voci, tipo: "fascia" });
  const fascia = KF.montaFascia(voci);
  c("fascia: le voci di `montaFascia` (studio, spedizione, reso, consulenza) a pillole", [fascia.length, fascia.length], [conta(hFascia, /<li\b/g), conta(hFascia, /rounded-full/g)]);
  c("fascia: una voce sola → non si monta; chiara = bordo ink, scura = bordo e testo bianchi", ["", true, true], [await bf({ voci: [voci[0]], tipo: "fascia" }), /border-ink\/15/.test(hFascia) && !/text-white/.test(hFascia), /border-white\/20[^"]*text-white/.test(await bf({ voci, tipo: "fascia", scuro: true }))]);
  c("fascia: niente parole vietate né segnaposto", [[], false], [trovaParoleVietate(hFascia), /\{\{|da confermare/i.test(hFascia)]);

  // ── «Ti serve anche» ──
  const patchAlfa = per("patch-prova-alfa");
  const blocco = KS.bloccheScheda(patchAlfa, { tariffa: TARIFFA_OK }).find((b) => b.id === "tiServeAnche");
  const ts = (props, extra = {}) => disegna("TiServeAnche.tsx", "TiServeAnche", props, { carrello: registro().carrello, ...extra });
  const { html: hTs } = await ts({ correlato: blocco.correlato });
  const tTs = leggibile(hTs);
  c("«Ti serve anche»: un titolo, UNA card con la sua foto (72 px), nome-link, prezzo e «Scegli» (il correlato non porta SKU)", [1, 1, 1, true, true, true, true], [conta(hTs, /<h2\b/g), conta(hTs, /<img\b/g), conta(hTs, /<a\b/g), /Ti serve anche/.test(tTs), /w-\[72px\]/.test(hTs), tTs.includes(`${blocco.correlato.nome}`) && tTs.includes("14,90 €"), />Scegli</.test(hTs)]);
  c("«Ti serve anche»: la foto è decorativa (il nome è lì accanto: alt vuoto), il prezzo sta sotto il nome, un solo punto di tabulazione", [true, true, 1], [attr(hTs, "alt") === "", tTs.indexOf(blocco.correlato.nome) < tTs.indexOf("14,90"), punti(hTs)]);
  const cardCorr = KC.cardDaPubblico(per("balsamo-prova"));
  //  T100a: la card la fa sempre `correlato` (T88b: `sku`, `prezziDiversi`, `aggiungibile`); la proprietà `card` non c'è più
  const corr = { slug: cardCorr.slug, nome: cardCorr.nome, prezzoDaCent: cardCorr.prezzoCent, foto: per("balsamo-prova").media[0].src, sku: cardCorr.skuVarianti[0], prezziDiversi: false, aggiungibile: true };
  const rTs = registro();
  const { html: hTs2, pagina: pTs2 } = await ts({ correlato: corr }, { carrello: rTs.carrello });
  c("con un `correlato` che si compra con un clic (SKU, `aggiungibile`): «Aggiungi» (bottone di contorno) e il clic mette lo SKU nel carrello", [true, true, 1, cardCorr.skuVarianti[0]], [/>Aggiungi</.test(hTs2), /<button\b[^>]*border-2/.test(hTs2), (gestore(pTs2, "button", "Aggiungi")(), rTs.aggiunte.length), rTs.aggiunte[0]?.[3]?.sku]);
  c("`correlato` con `aggiungibile` ma SENZA SKU: mai uno SKU inventato, resta «Scegli»", [true, false], [/>Scegli</.test((await ts({ correlato: { ...corr, sku: undefined } })).html), /Aggiungi/.test((await ts({ correlato: { ...corr, sku: undefined } })).html)]);
  c("la proprietà `card` non c'è più: una `card` passata non cambia niente (resta «Scegli») e il sorgente non la dichiara", [true, false, false], [/>Scegli</.test((await ts({ correlato: blocco.correlato, card: cardCorr })).html), /Aggiungi/.test((await ts({ correlato: blocco.correlato, card: cardCorr })).html) || /\bcard\??:\s*CardLeggera/.test(readFileSync(dir("TiServeAnche.tsx"), "utf8")), /\bcard\b[^=\n]*\?\s*card\s*:/.test(readFileSync(dir("TiServeAnche.tsx"), "utf8"))]);
  c("(vecchio) una `card` di un altro prodotto si ignora (resta «Scegli»)", [true, false], [/>Scegli</.test((await ts({ correlato: blocco.correlato, card: cardCorr })).html), /Aggiungi/.test((await ts({ correlato: blocco.correlato, card: cardCorr })).html)]);
  c("titolo diverso (il carrello): il titolo passato, non quello della scheda", true, leggibile((await ts({ correlato: corr, titolo: "Ti serve anche: Balsamo" })).html).startsWith("Ti serve anche: Balsamo"));
  const dermCorr = { slug: INVISIBLE_DERM.slug, nome: INVISIBLE_DERM.nome, prezzoDaCent: 12300, foto: null };
  c("«Ti serve anche» non disegna: Invisible Derm (anche con un prezzo), correlato senza prezzo, assente", ["", "", "", ""], [(await ts({ correlato: dermCorr })).html, (await ts({ correlato: { ...corr, prezzoDaCent: null } })).html, (await ts({ correlato: null })).html, (await ts({ correlato: undefined })).html]);
  c("«Ti serve anche»: nessuna parola vietata, nessuna ombra", [[], false], [trovaParoleVietate(hTs + hTs2), /shadow|star|gradient/i.test(hTs + hTs2)]);

  // ── sorgente dei quattro file (V1-T3, V1-T4, V1-T6, V1-T16) ──
  const ts_ = requireQui("typescript");
  const FILE = ["CardProdotto.tsx", "GrigliaCard.tsx", "BloccoFiducia.tsx", "TiServeAnche.tsx"];
  const testi = [];
  const lettere = (t) => /[A-Za-zÀ-ÿ]{2,}/.test(t);
  for (const f of FILE) {
    const sf = ts_.createSourceFile(f, readFileSync(dir(f), "utf8"), ts_.ScriptTarget.Latest, true, ts_.ScriptKind.TSX);
    const visita = (n) => {
      if (n.kind === ts_.SyntaxKind.JsxText && lettere(n.getText())) testi.push(`${f}: testo «${n.getText().trim()}»`);
      if (n.kind === ts_.SyntaxKind.JsxAttribute && ["aria-label", "alt", "title", "placeholder"].includes(n.name.getText()) && n.initializer && n.initializer.kind === ts_.SyntaxKind.StringLiteral && lettere(n.initializer.text)) testi.push(`${f}: ${n.name.getText()}="${n.initializer.text}"`);
      ts_.forEachChild(n, visita);
    };
    visita(sf);
  }
  c("nessun testo scritto a mano nei quattro componenti (né fra i tag né in alt/aria-label/title)", [], testi);
  const tutto = FILE.map((f) => readFileSync(dir(f), "utf8")).join("\n");
  c("sorgente: nessuna parola vietata nei quattro componenti (V1-T6)", [], trovaParoleVietate(tutto.replaceAll("={{", "={ {")));
  // (il doppio graffa di `params={{ … }}` è JSX, non un segnaposto: lo si separa prima di cercare)
  c("sorgente: niente ombra, niente barrato, niente stelle, niente gradienti né sfocature, niente rosso del marchio", false, /shadow|line-through|\bStar\b|gradient|backdrop|#FF3B3B|destructive|<del|<s>/.test(tutto));
  c("sorgente: nessun segnaposto di illustrazione (V1-T4) e nessun toast; la card vecchia non c'è", false, /PlaceholderBox|HairSystemVisual|ShopVisual|sonner|toast|GrigliaProdotti|ProductCard/.test(tutto));
  c("sorgente: nessun bottone pieno nelle card (V1-T3: né notte né blu pieni)", false, /\bbg-(brand|\[#0A1430\]|primary|ink)\b(?!\/)/.test(tutto));
  c("sorgente: le card non tracciano con fbq/ttq/gtag (solo `emettiEvento`, D90)", [false, true], [/fbq|ttq|gtag/.test(tutto), /emettiEvento\("AddToCart"/.test(tutto)]);
  c("sorgente: nessun cast del prodotto (`add` vuole solo l'identità) e «Da» in `TESTI_PROVVISORI.card`", [false, true, false], [/as Product/.test(tutto), /TESTI_PROVVISORI\.card\.da/.test(tutto), /TESTI_CARD_PROVVISORI/.test(tutto)]);
  c("sorgente: `CartContext.add` prende `Pick<Product, \"id\">`", true, /add: \(product: Pick<Product, "id">, qty/.test(readFileSync(join(radice, "src/shop/CartContext.tsx"), "utf8")));
  c("sorgente: la «Da» provvisoria è in `testi-shop.ts`", true, /da: "Da \{prezzo\}"/.test(readFileSync(join(radice, "src/landing/testi-shop.ts"), "utf8")));
  c("sorgente: la foto è sempre `FotoShop` (nessun <img> scritto a mano)", [false, true], [/<img\b/.test(tutto), /from "@\/components\/shop\/FotoShop"/.test(tutto)]);
}
