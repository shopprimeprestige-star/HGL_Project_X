/** ── VETRINA V1 · T94 · LA HOME DEL NEGOZIO (`/shop`, 23/11/2026) ───────────────────────────────────────────────────
 *  La rotta VERA `src/routes/shop.index.tsx` con `rendi()` di `_rende.mjs` e «server che lancia» (ogni funzione del server non prevista lancia):
 *  il `loader` si chiama davvero (con il server finto che registra), poi la sua risposta si dà al `component` e si legge il marchio reso.
 *  Si prova: (1) il `loader`: `codice` esce subito senza chiamare niente; `cms` chiama le quattro funzioni, schiaccia i prodotti in `CardLeggera[]`
 *  (dati leggeri), calcola `categorieConProdotti` e `scegliVetrina`; un guasto dà una pagina valida; (2) la pagina: un solo H1, i due bottoni solo con le
 *  categorie piene, la fascia con `vociDellaFascia`, la vetrina solo da 2 patch, gli slot vuoti; (3) `head`: meta e immagine di condivisione (ma `undefined`
 *  con `codice`, come oggi); (4) il `codice` resta com'è (il corpo di `Storefront` è quello del base); (5) le regole del sorgente.
 *  I blocchi (`HeroShop`, `VetrinaHome`…) li prova già `shop-home-blocchi.mjs`: qui si prova ciò che la PAGINA ci fa. Dati inventati, nessuna rete. */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as D from "./_dati-vetrina.mjs";
import { rendi } from "./_rende.mjs";

const FILE_ROTTA = "src/routes/shop.index.tsx";
const FILE_PAGINA = "src/components/shop/pagine/PaginaHome.tsx";
const BASE = "99d94d3";

const leggibile = (html) => html.replace(/<[^>]*>/g, " ").replace(/ /g, " ").replace(/\s+/g, " ").trim();
const conta = (html, re) => (html.match(re) ?? []).length;
const attr = (tag, nome) => (tag.match(new RegExp(`\\s${nome}="([^"]*)"`, "i")) ?? [])[1];
const imgs = (html) => html.match(/<img\b[^>]*>/g) ?? [];
const vero = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));

const NOME = "Nome di Prova";
const HERO = "https://prova.invalid/hero.jpg";
const RITRATTO = "https://prova.invalid/titolare.jpg";
const CONTENUTO_PIENO = { testi: { "shop.conf.firmatario": NOME }, media: { "shop.heroFoto": HERO, "shop.titolareFoto": RITRATTO } };
const CONTENUTO_VUOTO = { testi: {}, media: {} };
const RETE = () => { throw new Error("rete"); };

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T94 · LA HOME DEL NEGOZIO (23/11/2026)");
  const KH = mod["shop/cms/vetrina-home"];
  const KC = mod["shop/cms/vetrina-carrello"];
  const KK = mod["shop/cms/vetrina-card"];
  const KS = mod["shop/cms/vetrina-seo"];
  const SLUG_PATCH = KC.HREF_PATCH_PRONTE.split("/").pop();
  const SLUG_CURA = KC.HREF_CURA.split("/").pop();

  /* ── i dati: il catalogo di prova con le due categorie VERE del documento (quelle dei due bottoni) ── */
  const CAT_PATCH = { slug: SLUG_PATCH, nome: "Patch pronte" };
  const CAT_CURA = { slug: SLUG_CURA, nome: "Shampoo e balsami" };
  const ricat = (p) => ({ ...p, categorie: [p.tipo === "cura" ? CAT_CURA : CAT_PATCH] });
  const PRODOTTI = D.CATALOGO.map(ricat);
  const riga = (cat, ordine, quanti) => ({ slug: cat.slug, nome: cat.nome, tipo: "categoria", frase: null, foto: null, fotoAlt: null, seo: { titolo: null, descrizione: null }, ordine, quanti });
  const quanti = (prodotti, slug) => prodotti.filter((p) => p.categorie.some((x) => x.slug === slug)).length;
  const categorie = (prodotti) => [riga(CAT_PATCH, 0, quanti(prodotti, SLUG_PATCH)), riga(CAT_CURA, 1, quanti(prodotti, SLUG_CURA)), riga({ slug: "senza-prodotti", nome: "Vuota" }, 2, 0)];
  const server = (prodotti = PRODOTTI, cat = categorie(prodotti), contenuto = CONTENUTO_PIENO, tariffa = D.TARIFFA_OK) => ({
    contenutoShop: contenuto, tariffaSpedizione: tariffa, elencoProdotti: () => prodotti, elencoCategorie: () => cat,
  });
  const CMS = { modalita: "cms" };

  /* ── il loader: la rotta vera, il server che registra ── */
  const { route, pagina } = await rendi(radice, FILE_ROTTA, { server: {}, pathname: "/shop", context: { modalita: "codice" }, loaderData: null });
  const carica = async (sv, context = CMS) => {
    Object.assign(pagina, { server: sv });
    pagina.chiamate.length = 0;
    pagina.chiamateArgs.length = 0;
    const esito = {};
    try { esito.dati = await route.loader({ params: {}, context, deps: {} }); } catch (e) { esito.lancia = String(e?.message ?? e); }
    esito.chiamate = [...pagina.chiamate];
    esito.args = vero(pagina.chiamateArgs);
    return esito;
  };
  const pagineDi = async (loaderData, context = CMS, extra = {}) => (await rendi(radice, FILE_ROTTA, { server: {}, pathname: "/shop", context, loaderData, ...extra })).html;

  // ════ IL LOADER ═════════════════════════════════════════════════════════════
  const codice = await carica(server(), { modalita: "codice" });
  c("loader: con `codice` esce subito: null e nemmeno una chiamata al server (come oggi)", [null, []], [codice.dati, codice.chiamate]);
  const senzaModalita = await carica(server(), {});
  c("loader: senza modalità nel contesto esce subito (null, nessuna chiamata)", [null, []], [senzaModalita.dati, senzaModalita.chiamate]);

  const cms = await carica(server());
  const dati = cms.dati;
  c("loader cms: chiama il contenuto, la tariffa, i prodotti (senza filtri) e le categorie, ognuno UNA volta, e nient'altro", [["contenutoShop", "elencoCategorie", "elencoProdotti", "tariffaSpedizione"], [[], [], [{ data: {} }], []]],
    [[...cms.chiamate].sort(), cms.chiamate.map((n, i) => [n, cms.args[i]]).sort(([a], [b]) => (a < b ? -1 : 1)).map(([, a]) => a)]);
  c("loader cms: la risposta ha solo contenuto, tariffa, categorieConProdotti e vetrina", ["categorieConProdotti", "contenuto", "tariffa", "vetrina"], Object.keys(dati ?? {}).sort());
  c("loader cms: il contenuto e la tariffa sono quelli del server, interi (l'hero se li calcola da sé)", [CONTENUTO_PIENO, D.TARIFFA_OK], [dati?.contenuto, dati?.tariffa]);
  c("loader cms: `categorieConProdotti` = gli indirizzi delle categorie che hanno prodotti, non quelle vuote", [[SLUG_PATCH, SLUG_CURA]], [dati?.categorieConProdotti]);
  const attesa = KH.scegliVetrina(PRODOTTI);
  c("loader cms: la vetrina è `scegliVetrina` calcolata nel loader (5 patch, alfabetico), già in card leggere", [5, vero(attesa)], [dati?.vetrina?.length, vero(dati?.vetrina)]);

  // categorie che non tornano coi prodotti: serve l'una E l'altra cosa
  const soloPatch = PRODOTTI.filter((p) => p.tipo !== "cura");
  const senzaCura = await carica(server(soloPatch, categorie(PRODOTTI)));
  c("loader cms: una categoria con `quanti` > 0 ma senza nessun prodotto nell'elenco (dati che non tornano) non si conta", [[SLUG_PATCH]], [senzaCura.dati?.categorieConProdotti]);
  const senzaElenco = await carica(server(PRODOTTI, categorie(PRODOTTI).filter((x) => x.slug !== SLUG_CURA)));
  c("loader cms: una categoria che i prodotti nominano ma `elencoCategorie` non conosce non si conta (la sua pagina non c'è)", [[SLUG_PATCH]], [senzaElenco.dati?.categorieConProdotti]);
  const conZero = await carica(server(PRODOTTI, categorie(PRODOTTI).map((x) => ({ ...x, quanti: 0 }))));
  c("loader cms: con `quanti` a 0 (categoria che non esiste per il pubblico) nessuna categoria piena", [[]], [conZero.dati?.categorieConProdotti]);

  // dati leggeri (V1-T14): niente testo lungo, niente FAQ, niente varianti, niente SKU di varianti, niente clienti
  const json = JSON.stringify(dati);
  const PESANTI = ["descrizioneLunga", "descrizioneBreve", "perChi", "caratteristiche", "passi", "confezione", "avvertenze", "faq", "opzioni", "varianti", "prezzoDaCent", "boxConsulenza", "correlato", "marca"];
  c("dati leggeri: nella risposta nessun campo pesante del prodotto (descrizioni, FAQ, passi, varianti, opzioni, media)", [], PESANTI.filter((k) => json.includes(`"${k}"`)));
  const chiaviCard = new Set(Object.keys(KK.cardDaPubblico(PRODOTTI[0])));
  c("dati leggeri: ogni card della vetrina ha SOLO i campi di `CardLeggera` (e le foto sono le sole due misure della card)", [true, true], [
    dati.vetrina.every((k) => Object.keys(k).every((x) => chiaviCard.has(x))),
    dati.vetrina.every((k) => Object.keys(k.foto).sort().join() === "w480,w960"),
  ]);
  const cinquanta = await carica(server(D.SCENARIO_50.map(ricat), categorie(D.SCENARIO_50.map(ricat))));
  c("dati leggeri: con 50 prodotti la risposta tiene al massimo 6 card e pesa poco (meno di 8 KB di JSON, con i testi dell'hero)", [true, true], [(cinquanta.dati?.vetrina?.length ?? 99) <= 6, JSON.stringify(cinquanta.dati).length < 8000]);
  // Invisible Derm: anche se arrivasse come «patch» con una cifra, non entra nella vetrina e nessuna cifra esce
  const derm = ricat({ ...D.INVISIBLE_DERM, tipo: "patch", prezzoDaCent: 390000, acquistabile: true, varianti: D.INVISIBLE_DERM.varianti.map((v) => ({ ...v, prezzoCent: 390000 })) });
  const conDerm = await carica(server([...PRODOTTI, derm]));
  const jsonDerm = JSON.stringify(conDerm.dati);
  c("Invisible Derm (D39): anche come «patch» con una cifra non entra nella vetrina e nessuna cifra esce dal loader", [false, false, 5], [/Invisible/i.test(jsonDerm), /390000|3[.]?900/.test(jsonDerm), conDerm.dati?.vetrina?.length]);

  // guasto: una pagina valida, mai un errore
  const guasto = await carica({ contenutoShop: RETE, tariffaSpedizione: RETE, elencoProdotti: RETE, elencoCategorie: RETE });
  c("guasto (tutto il server giù): il loader non lancia e dà una home valida: contenuto vuoto, nessuna tariffa, nessuna categoria, nessuna vetrina", [undefined, { contenuto: CONTENUTO_VUOTO, tariffa: null, categorieConProdotti: [], vetrina: null }], [guasto.lancia, vero(guasto.dati)]);
  const guastoProdotti = await carica({ ...server(), elencoProdotti: RETE });
  c("guasto dei soli prodotti: il contenuto e la tariffa restano, categorie e vetrina vuote", [CONTENUTO_PIENO, D.TARIFFA_OK, [], null], [guastoProdotti.dati?.contenuto, guastoProdotti.dati?.tariffa, guastoProdotti.dati?.categorieConProdotti, guastoProdotti.dati?.vetrina]);
  const guastoContenuto = await carica({ ...server(), contenutoShop: RETE, tariffaSpedizione: RETE });
  c("guasto del contenuto e della tariffa: i prodotti restano (vetrina e categorie), il contenuto è vuoto", [CONTENUTO_VUOTO, null, 5, [SLUG_PATCH, SLUG_CURA]], [guastoContenuto.dati?.contenuto, guastoContenuto.dati?.tariffa, guastoContenuto.dati?.vetrina?.length, guastoContenuto.dati?.categorieConProdotti]);
  const storto = await carica({ ...server(), elencoProdotti: () => null, elencoCategorie: () => undefined });
  c("risposte storte (prodotti null, categorie assenti): niente lancia, elenchi vuoti", [undefined, [], null], [storto.lancia, storto.dati?.categorieConProdotti, storto.dati?.vetrina]);
  const prodottoStorto = await carica(server([null, { slug: "x" }, { slug: "y", nome: "Y", categorie: "no" }, ...PRODOTTI], categorie(PRODOTTI)));
  c("un prodotto storto nell'elenco (null, senza categorie) non rompe il loader né le categorie", [undefined, [SLUG_PATCH, SLUG_CURA]], [prodottoStorto.lancia, prodottoStorto.dati?.categorieConProdotti]);

  // ════ LA PAGINA (component) ═════════════════════════════════════════════════
  const h = await pagineDi(dati);
  const t = leggibile(h);
  c("pagina cms: UN SOLO H1 in tutta la pagina (quello dell'hero); la vetrina ha un H2 e le card H3", [1, 1, "PATCH capillari pronte, da chi le applica."], [conta(h, /<h1\b/g), conta(h, /<h2\b/g), leggibile(h.match(/<h1\b[\s\S]*?<\/h1>/)?.[0] ?? "")]);
  const link = (testo) => (h.match(/<a\b[^>]*>[\s\S]*?<\/a>/g) ?? []).find((a) => leggibile(a) === testo);
  c("pagina cms: con le due categorie piene i bottoni sono DUE e portano alle categorie", [KC.HREF_PATCH_PRONTE, KC.HREF_CURA], [attr(link("Patch pronte") ?? "", "href"), attr(link("Cura e manutenzione") ?? "", "href")]);
  c("pagina cms: l'hero viene prima della vetrina e la fascia è dentro l'hero (prima della vetrina)", [true, true], [h.indexOf("<h1") < h.indexOf('id="vetrina"'), h.indexOf("Studio a Roma") > h.indexOf("<h1") && h.indexOf("Studio a Roma") < h.indexOf('id="vetrina"')]);
  c("pagina cms: la vetrina ha le 5 patch (un article per card) con il titolo «Da qui si parte»", [5, true], [conta(h, /<article\b/g), t.includes("Da qui si parte")]);
  c("pagina cms: la fascia dà le voci VERE con la tariffa del server (studio, spedizione, consulenza)", [true, true, true], [t.includes("Studio a Roma"), /Spedizione: 4,90/.test(t), t.includes("Consulenza gratuita, online")]);
  c("pagina cms: la sola foto `eager` è quella dell'hero (LCP); la vetrina e il ritratto sono lazy", [1, true], [conta(h, /loading="eager"/g), imgs(h).filter((i) => attr(i, "src") !== HERO).every((i) => attr(i, "loading") === "lazy")]);
  c("pagina cms: nessun campo di ricerca (l'header ce l'ha), nessuna stella, nessun «4,8», niente testi di oggi (Toupee, indistinguibili, premium)", [0, false, false, false], [conta(h, /<(input|form)\b/g), /lucide-star|★|recension/i.test(h), /\b4[.,]8\b|1\.500/.test(t), /Toupee|indistinguibil|premium/i.test(t)]);
  c("pagina cms: niente «da confermare», niente `{{`, nessun indirizzo dello studio, nessuna parola vietata", [false, false, false, []], [/da confermare/i.test(h), /\{\{/.test(h), /Scipioni|\bVia degli\b|\b\d{5}\s+Roma\b/i.test(h), D.trovaParoleVietate(t)]);
  c("pagina cms: nessun segno di dato guasto (undefined, NaN, [object, null) nel marchio", false, /undefined|NaN|\[object|>null</.test(h));

  // le categorie vuote: nessun bottone, l'hero sta in piedi
  const hVuote = await pagineDi({ ...dati, categorieConProdotti: [] });
  const soloHero = (html) => html.slice(0, html.indexOf('id="vetrina"') >= 0 ? html.indexOf('id="vetrina"') : undefined);
  c("categorie vuote: nessun bottone verso le categorie nell'hero (mai un 404), l'hero (H1, ritratto, fascia) e la vetrina restano", [0, 1, true, true], [conta(soloHero(hVuote), /href="\/shop\/c\//g), conta(hVuote, /<h1\b/g), /Studio a Roma/.test(hVuote), hVuote.includes('id="vetrina"')]);
  const hUna = await pagineDi({ ...dati, categorieConProdotti: [SLUG_CURA] });
  c("solo la cura piena: resta «Cura e manutenzione», senza «Patch pronte» (ma il link «Vedi tutte» della vetrina c'è)", [false, true], [/>Patch pronte</.test(hUna), />Cura e manutenzione</.test(hUna)]);

  // la vetrina: meno di 2 patch
  const unaPatch = await carica(server(PRODOTTI.filter((p) => p.tipo !== "patch" || p.slug === "patch-prova-alfa")));
  const hUnaPatch = await pagineDi(unaPatch.dati);
  c("una sola patch: la vetrina non si monta (null nel loader, nessuna sezione), i bottoni dell'hero restano", [null, false, true, true], [unaPatch.dati?.vetrina, hUnaPatch.includes('id="vetrina"'), />Patch pronte</.test(hUnaPatch), conta(hUnaPatch, /<h1\b/g) === 1]);
  const senzaFoto = await carica(server(D.CATALOGO_SENZA_FOTO.map(ricat)));
  c("catalogo senza foto: nessuna vetrina (V1-T5), nessun riquadro vuoto, la home è valida", [null, 1], [senzaFoto.dati?.vetrina, conta(await pagineDi(senzaFoto.dati), /<h1\b/g)]);

  // V1-T5: slot vuoti e guasto
  const hSlotVuoti = await pagineDi({ ...dati, contenuto: CONTENUTO_VUOTO });
  c("slot vuoti (V1-T5): nessuna immagine nell'hero, una colonna centrata, H1 e fascia ci sono, la vetrina anche", [0, true, false, 1, true], [imgs(hSlotVuoti).filter((i) => attr(i, "src") === HERO || attr(i, "src") === RITRATTO).length, /\bmax-w-3xl\b/.test(hSlotVuoti), /\blg:grid-cols-\[/.test(soloHero(hSlotVuoti)), conta(hSlotVuoti, /<h1\b/g), hSlotVuoti.includes('id="vetrina"')]);
  const hGuasto = await pagineDi(guasto.dati);
  c("guasto: la home si disegna lo stesso (un H1, testi di partenza, fascia con studio e consulenza), senza bottoni né vetrina né «undefined»", [1, 0, false, true, false], [conta(hGuasto, /<h1\b/g), conta(hGuasto, /href="\/shop\/c\//g), hGuasto.includes('id="vetrina"'), /Studio a Roma/.test(hGuasto), /undefined|NaN|\[object/.test(hGuasto)]);
  const hTestoVuoto = await pagineDi({ ...dati, contenuto: { ...CONTENUTO_PIENO, testi: { ...CONTENUTO_PIENO.testi, "shop.vetrina.titolo": "", "shop.vetrina.sottotitolo": "{{da confermare}}" } } });
  c("un testo svuotato nel CRM (titolo della vetrina) o con `{{` non si disegna, la griglia resta e non c'è nessuna graffa", [0, 5, false], [conta(hTestoVuoto, /<h2\b/g), conta(hTestoVuoto, /<article\b/g), /\{\{|da confermare/i.test(hTestoVuoto)]);

  // il codice resta quello di oggi (l'HTML intero lo prova l'oro; qui lo smistatore)
  const hCodice = await pagineDi(null, { modalita: "codice" });
  c("codice: la pagina è lo Storefront di oggi (titolo «Toupee indistinguibili», ricerca, 33 schede), non la home nuova", [true, true, false, false], [/Toupee\s*indistinguibili/.test(leggibile(hCodice)), /<input\b/.test(hCodice), hCodice.includes('id="vetrina"'), conta(hCodice, /<h1\b/g) !== 1]);
  let hCmsSenzaDati;
  try { hCmsSenzaDati = await pagineDi(undefined); } catch (e) { hCmsSenzaDati = `LANCIA ${String(e?.message ?? e).slice(0, 80)}`; }
  c("cms senza dati del loader (non è mai atteso): la pagina si disegna lo stesso, non lancia", false, /^LANCIA/.test(hCmsSenzaDati));

  // ════ HEAD ══════════════════════════════════════════════════════════════════
  //  un `head` che lancia dà un rosso («lancia»), non ferma la suite
  const testa = (loaderData, context = CMS) => { try { return route.head({ match: { context, status: "success" }, loaderData, params: {} }); } catch (e) { return { lancia: String(e?.message ?? e) }; } };
  c("head: con `codice` vale `undefined` (la home di oggi non ha head: l'oro non cambia)", [undefined, undefined, undefined], [testa(undefined, { modalita: "codice" }), testa(null, { modalita: "codice" }), testa(undefined, { modalita: "codice" })]);
  const T = testa(dati);
  const meta = (k) => T?.meta?.find((m) => m.name === k || m.property === k)?.content;
  const MH = KS.metaHome();
  const SITO = (readFileSync(join(radice, "src/lib/sito.ts"), "utf8").match(/SITO\s*=\s*"([^"]+)"/) ?? [])[1];
  c("head cms: titolo e descrizione sono quelli della home del copy (`metaHome`)", [MH.titolo, MH.descrizione], [T?.meta?.find((m) => m.title)?.title, meta("description")]);
  c("head cms: gli stessi testi per le anteprime (og:title, og:description, og:type, og:url)", [MH.titolo, MH.descrizione, "website", `${SITO}/shop`], [meta("og:title"), meta("og:description"), meta("og:type"), meta("og:url")]);
  c("head cms: indirizzo canonico = il sito + /shop", [[{ rel: "canonical", href: `${SITO}/shop` }]], [T?.links]);
  c("head cms: l'immagine di condivisione è la foto dell'hero (https) se non c'è `shop.condivisione`", [HERO, "summary_large_image"], [meta("og:image"), meta("twitter:card")]);
  const CON = "https://prova.invalid/condivisione.jpg";
  c("head cms: lo slot `shop.condivisione` vince sulla foto dell'hero", CON, testa({ ...dati, contenuto: { ...CONTENUTO_PIENO, media: { ...CONTENUTO_PIENO.media, "shop.condivisione": CON } } })?.meta?.find((m) => m.property === "og:image")?.content);
  const senzaImg = testa({ ...dati, contenuto: CONTENUTO_VUOTO });
  c("head cms: senza nessuna foto NESSUN tag immagine (mai il logo, mai un'immagine inventata) e la carta resta piccola", [undefined, undefined, "summary"], [senzaImg?.meta?.find((m) => m.property === "og:image"), senzaImg?.meta?.find((m) => m.name === "twitter:image"), senzaImg?.meta?.find((m) => m.name === "twitter:card")?.content]);
  const nonHttps = testa({ ...dati, contenuto: { ...CONTENUTO_VUOTO, media: { "shop.condivisione": "http://prova.invalid/a.jpg", "shop.heroFoto": "/media/hero.jpg" } } });
  c("head cms: un indirizzo non https (http, relativo) non diventa immagine di condivisione", undefined, nonHttps?.meta?.find((m) => m.property === "og:image"));
  const jsonT = JSON.stringify(T);
  c("head cms: niente `{{`, niente «da confermare», nessun indirizzo dello studio, nessuna parola vietata, nessun prezzo", [false, false, false, [], false], [/\{\{/.test(jsonT), /da confermare/i.test(jsonT), /Scipioni|\bVia degli\b/i.test(jsonT), D.trovaParoleVietate(jsonT), /€|\d,\d{2}/.test(jsonT)]);
  c("head cms: non lancia con dati assenti o storti (loaderData null, contenuto assente)", ["ok", "ok"], [testa({})?.lancia ? "lancia" : "ok", testa({ ...dati, contenuto: undefined })?.lancia ? "lancia" : "ok"]);

  // ════ IL SORGENTE ═══════════════════════════════════════════════════════════
  const leggi = (f) => readFileSync(join(radice, f), "utf8");
  const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  const rotta = leggi(FILE_ROTTA);
  const pag = leggi(FILE_PAGINA);
  const rottaNuda = senzaCommenti(rotta);
  const pagNuda = senzaCommenti(pag);

  // il corpo di `Storefront` è quello del base (regola 9, parte ridotta): le sole differenze ammesse sono gli import e lo smistatore
  let base = null;
  try { base = execFileSync("git", ["show", `${BASE}:${FILE_ROTTA}`], { cwd: radice, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); } catch { /* storia assente */ }
  const dalCorpo = (s) => s.slice(s.indexOf("function Storefront() {"));
  c(`il corpo di \`Storefront\` è IDENTICO a quello del base ${BASE} (e da lì fino a fine file nient'altro); senza la storia git: serve la storia git, rilancia da un clone intero`,
    "identico", base === null ? "serve la storia git: rilancia da un clone intero" : rotta.includes("function Storefront() {") && dalCorpo(rotta) === dalCorpo(base) ? "identico" : "diverso");
  c("`icon` (usata da Storefront) e il resto fra `Route` e `Storefront` restano quelli del base", true, base !== null && rotta.slice(rotta.indexOf("type IconType"), rotta.indexOf("function Storefront() {")) === base.slice(base.indexOf("type IconType"), base.indexOf("function Storefront() {")));
  c("il loader: `codice` esce PRIMA di ogni chiamata al server (la guardia sta prima della prima funzione)", true, (() => {
    const guardia = rottaNuda.search(/context\.modalita\s*!==\s*"cms"\s*\)\s*return null/);
    const prime = ["contenutoShop(", "tariffaSpedizione(", "elencoProdotti(", "elencoCategorie("].map((f) => rottaNuda.indexOf(f)).filter((i) => i >= 0);
    return guardia >= 0 && prime.length >= 4 && prime.every((i) => i > guardia);
  })());
  c("la rotta legge il contenuto con `contenutoShop` (funzione del server) e NON con `contenutoDelServer` né col client del server (finirebbero nel pacchetto del browser)", [true, false, false], [/contenutoShop/.test(rottaNuda), /contenutoDelServer/.test(rotta + pag), /client\.server|supabaseAdmin|catalogo\.server/.test(rotta + pag)]);
  c("lo smistatore guarda la modalità del contesto (`cms`) e dà `PaginaHome` solo con dati; il resto è `Storefront`", [true, true], [/modalita\s*===\s*"cms"/.test(rottaNuda.slice(0, rottaNuda.indexOf("function Storefront() {"))), /<PaginaHome\b/.test(rottaNuda) && /<Storefront\s*\/>/.test(rottaNuda)]);
  c("la fascia si ottiene SOLO da `vociDellaFascia` (dentro l'hero): nessun file di T94 chiama `vociFiducia` né passa `fascia:`", [false, false], [/vociFiducia|\bfascia\s*:/.test(rottaNuda + pagNuda), /FasciaFiducia|BloccoFiducia/.test(rottaNuda + pagNuda)]);
  c("la pagina usa i blocchi di T91 e `scegliVetrina`/`HeroShop`/`VetrinaHome`, non rifà nessuna logica", [true, true, true], [/<HeroShop\b/.test(pagNuda), /<VetrinaHome\b/.test(pagNuda), /scegliVetrina/.test(pagNuda)]);
  c("la pagina passa `categorieConProdotti` all'hero (senza, l'hero non ha bottoni)", true, /categorieConProdotti=\{/.test(pagNuda));
  c("la pagina NON monta il guscio (è di T93) né il carrello, non apre connessioni né legge il contenuto da sé", [false, false, false], [/GuscioShop|ShopHeader|FooterShop|BarraConsulenza|CartProvider|Toaster|<main\b|<header\b|<footer\b/.test(pagNuda + rottaNuda.slice(0, rottaNuda.indexOf("function Storefront() {"))), /\.functions"|useEffect|useState|fetch\(|useLandingContent/.test(pagNuda), /useListaVista|emettiEvento/.test(pagNuda)]);
  c("la rotta non importa i blocchi della home direttamente (li monta la pagina)", 0, conta(rotta, /components\/shop\/home\//g));
  c("nessun «da confermare», nessuna `{{`, nessun indirizzo dello studio e nessuna frase scritta nei due file (i testi sono di `testi-shop.ts`)", [false, false, false], [/da confermare/i.test(rotta.slice(0, rotta.indexOf("function Storefront() {")) + pag), /\{\{/.test(pag + rotta.slice(0, rotta.indexOf("function Storefront() {"))), /Scipioni|\bVia degli\b/i.test(pag)]);
  c("nessun carattere né font a mano, nessun rosso, nessuna `<img` nella pagina nuova", [false, false, false], [/font-family|Anton|Instrument|\bInter\b/.test(pag), /#FF3B3B|bg-destructive|text-destructive/i.test(pag), /<img\b/.test(pag)]);
  c("`routeTree.gen.ts` non è nel lavoro (non si committa)", false, execFileSync("git", ["status", "--porcelain", "--", "src/routeTree.gen.ts"], { cwd: radice, encoding: "utf8" }).trim() !== "");
}
