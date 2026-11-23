/** ── VETRINA V1 · T91 · I BLOCCHI DELLA HOME: HERO, FASCIA DI FIDUCIA, VETRINA (23/11/2026) ───────────────────────────
 *  I tre componenti (`src/components/shop/home/*`) DISEGNATI davvero (esbuild + react-dom/server, aiuti di `_rende.mjs`) con i dati inventati di
 *  `_dati-vetrina.mjs`; i controlli leggono il marchio reso. `FotoShop`, `CardProdotto`, `GrigliaCard`, `BloccoFiducia` sono quelli VERI.
 *  Si prova: l'hero (H1 con una sola parola in accento, due bottoni, un solo pieno, ritratto e riga dello studio, niente ricerca, la sola foto `eager`,
 *  fascia dopo la foto, una colonna senza foto), la fascia (meno di due voci = niente), la vetrina (2 colonne sul telefono, 4/3 sul computer, meno di 2 = niente,
 *  nessuna foto `eager`), gli slot vuoti (V1-T5), i fondi (V1-T2), un solo pieno (V1-T3) e le regole del codice nuovo (nessun font a mano, nessun rosso, nessuna `<img>`).
 *  Il primo prodotto della vetrina (D78): con i dati di prova non è uno scarto (patch vera, con foto e prezzo, disponibile). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOGO, CATALOGO_SENZA_FOTO, CATALOGO_UNA_FOTO, INVISIBLE_DERM, TARIFFA_ASSENTE, TARIFFA_OK, TESTI_CONFERMATI_PIENI, trovaParoleVietate } from "./_dati-vetrina.mjs";
import { rendiComponente } from "./_rende.mjs";

/** Il testo che si legge: senza marcatura, con lo spazio fisso come spazio. */
const leggibile = (html) => html.replace(/<[^>]*>/g, " ").replace(/ /g, " ").replace(/\s+/g, " ").trim();
const conta = (html, re) => (html.match(re) ?? []).length;
const attr = (tag, nome) => (tag.match(new RegExp(`\\s${nome}="([^"]*)"`, "i")) ?? [])[1];
const imgs = (html) => html.match(/<img\b[^>]*>/g) ?? [];
const link = (html, testo) => (html.match(/<a\b[^>]*>[\s\S]*?<\/a>/g) ?? []).find((a) => leggibile(a).includes(testo));

/** Un elemento con riempimento pieno: bianco (sul blueprint), notte o blu (sul chiaro). `hover:bg-…` e `bg-white/10` non contano. */
const classePiena = (tag, colori) => new RegExp(`(?<![:\\w-])bg-(${colori})(?![/\\w-])`).test(tag);
const tagAperti = (html, nome) => html.match(new RegExp(`<${nome}\\b[^>]*>`, "g")) ?? [];

const NOME = "Nome di Prova";
const HERO = "https://prova.invalid/hero.jpg";
const RITRATTO = "https://prova.invalid/titolare.jpg";
const CONTENUTO_PIENO = { testi: { "shop.conf.firmatario": NOME }, media: { "shop.heroFoto": HERO, "shop.titolareFoto": RITRATTO } };
const CONTENUTO_VUOTO = { testi: {}, media: {} };
const con = (testi = {}, media = {}, base = CONTENUTO_PIENO) => ({ testi: { ...base.testi, ...testi }, media: { ...base.media, ...media } });

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T91 · HERO, FASCIA DI FIDUCIA, VETRINA DELLA HOME (23/11/2026)");
  const KH = mod["shop/cms/vetrina-home"];
  const KF = mod["shop/cms/vetrina-fiducia"];
  const KC = mod["shop/cms/vetrina-carrello"];
  const dir = join(radice, "src/components/shop/home");
  const disegna = async (file, nome, props, extra = {}) => (await rendiComponente(radice, join(dir, file), nome, props, extra)).html;
  const SLUG_PATCH = KC.HREF_PATCH_PRONTE.split("/").pop();
  const SLUG_CURA = KC.HREF_CURA.split("/").pop();
  const hero = (contenuto = CONTENUTO_PIENO, tariffa = TARIFFA_OK, categorieConProdotti = [SLUG_PATCH, SLUG_CURA]) => disegna("HeroShop.tsx", "HeroShop", { contenuto, tariffa, categorieConProdotti });
  const vetrina = (card, contenuto = CONTENUTO_PIENO) => disegna("VetrinaHome.tsx", "VetrinaHome", { card, contenuto });
  const patch = KH.scegliVetrina(CATALOGO);

  // ════ HERO ═══════════════════════════════════════════════════════════════════
  const hH = await hero();
  const tH = leggibile(hH);
  const h1 = hH.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/)?.[0] ?? "";
  c("hero: un solo H1, 30 px sul telefono e 60 sul computer (text-3xl, lg:text-6xl), interlinea 1,08, grassetto", [1, true, true, true], [conta(hH, /<h1\b/g), /\btext-3xl\b/.test(h1) && /\blg:text-6xl\b/.test(h1), /leading-\[1\.08\]/.test(h1), /\bfont-bold\b/.test(h1)]);
  c("hero: l'H1 dice «PATCH capillari pronte, da chi le applica.» e UNA sola parola è in accento (text-aurora)", ["PATCH capillari pronte, da chi le applica.", ["PATCH"]], [leggibile(h1), [...h1.matchAll(/<span\b[^>]*text-aurora[^>]*>([^<]*)<\/span>/g)].map((m) => m[1])]);
  c("hero: sopratitolo (eyebrow), sottotitolo del documento", [true, true], [/<p\b[^>]*\beyebrow\b[^>]*>HAIR GENIUS SHOP · ROMA<\/p>/.test(hH), tH.includes("Scegli, ordina, ricevi. Se non sai quale scegliere, chiedilo prima: la consulenza è gratuita e online.")]);
  c("hero: fondo blueprint con la deriva del riflettore (spotlight-drift, 12 s) spenta col movimento ridotto", [true, true, true], [/<section\b[^>]*\bbg-blueprint\b/.test(hH), /spotlight-drift_12s/.test(hH), /motion-reduce:before:animate-none/.test(hH)]);

  const patchPronte = link(hH, "Patch pronte");
  const cura = link(hH, "Cura e manutenzione");
  c("hero: «Patch pronte» → la categoria delle patch pronte, «Cura e manutenzione» → la categoria della cura (gli stessi indirizzi del carrello vuoto)", [KC.HREF_PATCH_PRONTE, KC.HREF_CURA], [attr(patchPronte ?? "", "href"), attr(cura ?? "", "href")]);
  // i bottoni portano solo a categorie con prodotti (revisore T91, punto 1): vuota o inesistente = nessun bottone; prop assente = nessun bottone
  const bottoni = async (cat) => { const h = await (cat === "assente" ? disegna("HeroShop.tsx", "HeroShop", { contenuto: CONTENUTO_PIENO, tariffa: TARIFFA_OK }) : hero(CONTENUTO_PIENO, TARIFFA_OK, cat)); return [!!link(h, "Patch pronte"), !!link(h, "Cura e manutenzione"), /<h1\b/.test(h), /<a\b[^>]*\bmin-h-12/.test(h)]; };
  c("bottoni: categorie piene (patch e cura) → tutti e due", [true, true, true, true], await bottoni([SLUG_PATCH, SLUG_CURA]));
  c("bottoni: la categoria della cura vuota (non nell'elenco) → resta solo «Patch pronte»", [true, false, true, true], await bottoni([SLUG_PATCH]));
  c("bottoni: la categoria delle patch vuota → resta solo «Cura e manutenzione»", [false, true, true, true], await bottoni([SLUG_CURA]));
  c("bottoni: elenco vuoto o storto → nessun bottone, l'hero sta in piedi (H1, ritratto, fascia)", [[false, false, true, false], [false, false, true, false]], [await bottoni([]), await bottoni("patch-pronte")]);
  // T102 A2 (rifatta): se le patch pronte non hanno prodotti il pieno ripiega sulla prima categoria DOCUMENTATA con prodotti (non la cura) e dice il NOME di quella
  // categoria (mai «Patch pronte» sopra un'altra destinazione); uno slug non documentato non dà nessun bottone. Gli indirizzi li dà `hrefCategoria`.
  const SLUG_ALTRA = "districanti"; // documentata (§3.4): nome «Districanti»
  const pieni = (html) => (html.match(/<a\b[^>]*>[\s\S]*?<\/a>/g) ?? []).filter((a) => classePiena(a, "white")); // i bottoni pieni dell'hero
  const hAltra = await hero(CONTENUTO_PIENO, TARIFFA_OK, [SLUG_ALTRA]);
  const pienoAltra = pieni(hAltra);
  c("bottoni: patch senza prodotti, categoria documentata (districanti) → il pieno porta lì e porta il NOME di quella categoria, non «Patch pronte»", [1, KC.hrefCategoria({ slug: SLUG_ALTRA }), "Districanti", false], [pienoAltra.length, attr(pienoAltra[0] ?? "", "href"), leggibile(pienoAltra[0] ?? ""), !!link(hAltra, "Patch pronte")]);
  c("bottoni: l'indirizzo del ripiego viene da `hrefCategoria` (una sola funzione per le categorie)", ["/shop/c/districanti", typeof KC.hrefCategoria], [KC.hrefCategoria({ slug: SLUG_ALTRA }), "function"]);
  const hSconosciuta = await hero(CONTENUTO_PIENO, TARIFFA_OK, ["altra", "patch", "patch-prova"]);
  c("bottoni: slug non documentati (altra, patch, patch-prova) → nessun bottone, come prima di T102", [0, false, true], [pieni(hSconosciuta).length, !!link(hSconosciuta, "Cura e manutenzione"), /<h1\b/.test(hSconosciuta)]);
  const hSalta = await hero(CONTENUTO_PIENO, TARIFFA_OK, ["altra", SLUG_CURA, SLUG_ALTRA]);
  c("bottoni: il ripiego salta gli slug non documentati e la categoria della cura (niente due bottoni verso lo stesso posto)", [KC.hrefCategoria({ slug: SLUG_ALTRA }), KC.HREF_CURA], [attr(pieni(hSalta)[0] ?? "", "href"), attr(link(hSalta, "Cura e manutenzione") ?? "", "href")]);
  c("bottoni: con le patch piene il pieno resta «Patch pronte» anche se ci sono altre categorie", ["Patch pronte", KC.HREF_PATCH_PRONTE], [leggibile(pieni(await hero(CONTENUTO_PIENO, TARIFFA_OK, [SLUG_ALTRA, SLUG_PATCH]))[0] ?? ""), attr(pieni(await hero(CONTENUTO_PIENO, TARIFFA_OK, [SLUG_ALTRA, SLUG_PATCH]))[0] ?? "", "href")]);
  c("bottoni: ripiego con slug storti (vuoto, numero, null) o solo la cura → nessun pieno, nessun lancio", [0, 0], [pieni(await hero(CONTENUTO_PIENO, TARIFFA_OK, ["", 7, null])).length, pieni(await hero(CONTENUTO_PIENO, TARIFFA_OK, [SLUG_CURA])).length]);
  c("bottoni: prop assente (default sicuro) → nessun bottone, mai un 404", [false, false, true, false], await bottoni("assente"));
  const hSenzaBottoni = await hero(CONTENUTO_PIENO, TARIFFA_OK, []);
  c("bottoni: senza bottoni restano il ritratto, la riga dello studio e la fascia, e non resta un contenitore vuoto", [true, true, false], [leggibile(hSenzaBottoni).includes("Applichiamo patch a Roma ogni giorno.") && /Studio a Roma/.test(hSenzaBottoni), imgs(hSenzaBottoni).length === 2, /sm:flex-row/.test(hSenzaBottoni)]);
  c("hero: «Patch pronte» è PIENO chiaro (bianco con testo notte), 48 px (56 dal computer)", [true, true, true], [classePiena(patchPronte ?? "", "white"), /text-\[#0A1430\]/.test(patchPronte ?? ""), /\bmin-h-12\b/.test(patchPronte ?? "") && /\blg:min-h-14\b/.test(patchPronte ?? "")]);
  c("hero: «Cura e manutenzione» è di CONTORNO bianco (bordo 2 px, testo bianco, nessun riempimento), 48 px", [true, true, false, true], [/\bborder-2\b/.test(cura ?? "") && /\bborder-white\b/.test(cura ?? ""), /\btext-white\b/.test(cura ?? ""), classePiena(cura ?? "", "white|brand|\\[#0A1430\\]"), /\bmin-h-12\b/.test(cura ?? "")]);
  c("hero: un SOLO pieno (V1-T3): un solo elemento con fondo pieno bianco o blu, nessun blu di consulenza, nessun rosso", [1, false], [tagAperti(hH, "a").filter((t) => classePiena(t, "white|brand|\\[#0A1430\\]|brand-scuro")).length, /#FF3B3B|bg-destructive|text-destructive|bg-brand-scuro/i.test(hH)]);
  c("hero: niente ricerca (nessun campo, nessun «Cerca», nessun role=search)", [0, false, false], [conta(hH, /<(input|form)\b/g), /Cerca/i.test(hH), /role="search"/.test(hH)]);
  c("hero: i bottoni sono link veri raggiungibili (anello di fuoco bianco su scuro)", true, /shop-anello-scuro/.test(patchPronte ?? "") && /shop-anello-scuro/.test(cura ?? ""));

  // il ritratto
  const tag = imgs(hH);
  const tagRitratto = tag.find((i) => attr(i, "src") === RITRATTO) ?? "";
  const tagHero = tag.find((i) => attr(i, "src") === HERO) ?? "";
  const riquadroRitratto = hH.slice(0, hH.indexOf(tagRitratto)).match(/<span\b[^>]*>(?![\s\S]*<span\b)/)?.[0] ?? "";
  c("ritratto: tondo, 56 px (w-14), con la descrizione del titolare col suo nome; l'immagine è quella dello slot", [true, true, `${NOME} di Hair Genius Labs in studio, a Roma`], [/\brounded-full\b/.test(riquadroRitratto), /\bw-14\b/.test(riquadroRitratto), attr(tagRitratto, "alt")]);
  c("ritratto: didascalia «{nome}, Hair Genius Labs» (14 px) e la riga dello studio sotto", [true, true, true], [tH.includes(`${NOME}, Hair Genius Labs`), tH.indexOf(`${NOME}, Hair Genius Labs`) < tH.indexOf("Applichiamo patch a Roma ogni giorno."), /<p\b[^>]*\btext-sm\b[^>]*>Applichiamo patch a Roma ogni giorno\.<\/p>/.test(hH)]);
  c("ritratto: i testi con `{nome}` sono riempiti: nessuna graffa nel disegno", false, /[{}]/.test(hH));

  // D96: senza foto del titolare o senza nome confermato spariscono ritratto e nome, resta la riga dello studio
  for (const [titolo, contenuto] of [
    ["senza nome confermato", con({ "shop.conf.firmatario": "" })],
    ["con nome non confermato (segnaposto aperto)", con({ "shop.conf.firmatario": "{{da confermare: nome}}" })],
    ["senza foto del titolare", con({}, { "shop.titolareFoto": "" })],
  ]) {
    const h = await hero(contenuto);
    c(`D96 ${titolo}: né ritratto né nome né didascalia, resta «Applichiamo patch a Roma ogni giorno.»`, [0, false, false, true], [imgs(h).filter((i) => attr(i, "src") === RITRATTO).length, h.includes(NOME), /,\s*Hair Genius Labs/.test(leggibile(h)), leggibile(h).includes("Applichiamo patch a Roma ogni giorno.")]);
  }

  // la foto: la sola eager (LCP), niente salti di layout
  c("foto: quella dell'hero è la SOLA `eager` con priorità alta, 4:5, con larghezza e altezza dichiarate e riquadro azzurro tenue", ["eager", true, "880", "1100", true, true], [attr(tagHero, "loading"), /fetchpriority="high"/i.test(tagHero), attr(tagHero, "width"), attr(tagHero, "height"), /aspect-ratio:\s*4\s*\/\s*5/.test(hH), /brand-velo-10/.test(hH)]);
  c("foto: nessun'altra immagine dell'hero è `eager` né ha priorità alta (il ritratto è lazy)", [1, 1, "lazy"], [conta(hH, /loading="eager"/g), tag.filter((i) => /fetchpriority="high"/i.test(i)).length, attr(tagRitratto, "loading")]);
  c("foto: descrizione dello slot (alt) letta dal contenuto, cornice con gli angoli a mirino", [true, true], [attr(tagHero, "alt")?.startsWith("Patch capillare pronta") ?? false, /\bbrackets\b/.test(hH) && /\bbr-tr\b/.test(hH) && /\bbr-bl\b/.test(hH)]);
  c("foto: sul computer la foto sta a destra in due colonne; sul telefono la fascia viene DOPO la foto", [true, true], [/\blg:grid-cols-\[1\.05fr_1fr\]/.test(hH), hH.indexOf("hero.jpg") > 0 && hH.indexOf("hero.jpg") < hH.indexOf("Studio a Roma")]);

  const hVuotoLayout = await hero(CONTENUTO_VUOTO);
  const fasciaUl = hH.match(/<ul\b[^>]*>/)?.[0] ?? "";
  const cornice = hH.match(/<div\b[^>]*\bbrackets\b[^>]*>/)?.[0] ?? "";
  c("layout hero: la fascia occupa le due colonne sul computer (lg:col-span-2); la foto sta nel riquadro dichiarato (max-w-[440px], a destra sul computer)", [true, true, true], [/\blg:col-span-2\b/.test(fasciaUl), /\bmax-w-\[440px\]/.test(cornice), /\blg:ml-auto\b/.test(cornice)]);
  c("layout hero: senza foto la fascia è centrata, ha la sua distanza dal blocco sopra (mt-8, T102 A1) e NON ha lg:col-span-2", [true, true, false], [/justify-center/.test((hVuotoLayout.match(/<ul\b[^>]*>/) ?? [""])[0]), /\bmt-8\b/.test((hVuotoLayout.match(/<ul\b[^>]*>/) ?? [""])[0]), /lg:col-span-2/.test(hVuotoLayout)]);
  // la fascia nell'hero
  c("fascia nell'hero: con la tariffa vera: studio, spedizione, consulenza (pillole scure), dopo la foto", [true, true, true], [tH.includes("Studio a Roma"), tH.includes("Consulenza gratuita, online"), /Spedizione: 4,90/.test(tH)]);
  c("fascia: senza tariffa restano le due voci confermate (studio e consulenza); la spedizione non c'è", [true, true, false], [tH.includes("Studio a Roma"), (await hero(CONTENUTO_PIENO, TARIFFA_ASSENTE)).includes("Consulenza gratuita, online"), /Spedizione/.test(await hero(CONTENUTO_PIENO, TARIFFA_ASSENTE))]);
  const hUna = await hero(con({ "shop.fascia.consulenza": "" }), TARIFFA_ASSENTE);
  c("fascia: UNA sola voce vera = la fascia non si monta (V1-H2); l'hero resta", [false, true], [/Studio a Roma/.test(hUna), /<h1\b/.test(hUna)]);
  const hStudioVuoto = await hero(con({ "shop.fascia.studio": "" }), TARIFFA_ASSENTE);
  c("fascia: un testo svuotato nel CRM resta vuoto (non torna quello di partenza) e un segnaposto aperto non si disegna", [false, false], [/Studio a Roma/.test(hStudioVuoto), /Studio a Roma/.test(await hero(con({ "shop.fascia.studio": "{{da confermare}}" }), TARIFFA_ASSENTE))]);

  // testi svuotati: la riga non si disegna
  const hSenza = await hero(con({ "shop.hero.eyebrow": "", "shop.hero.sottotitolo": "  ", "shop.hero.cta2": "", "shop.hero.riga": "" }));
  c("testi svuotati nel CRM: sopratitolo, sottotitolo, secondo bottone e riga non si disegnano; il resto resta", [false, false, false, false, true, true], [/<p\b[^>]*\beyebrow\b/.test(hSenza), /Scegli, ordina/.test(hSenza), /Cura e manutenzione/.test(hSenza), /Applichiamo patch/.test(hSenza), /<h1\b/.test(hSenza), /Patch pronte/.test(hSenza)]);
  c("testo con segnaposto aperto nel titolo: la riga non si disegna (mai `{{`)", [false, false], [/<h1\b/.test(await hero(con({ "shop.hero.h1": "{{da confermare}}" }))), /\{\{/.test(await hero(con({ "shop.hero.h1": "{{da confermare}}" })))]);

  // V1-T5: slot vuoti → una colonna centrata, senza salti
  const hV = await hero(CONTENUTO_VUOTO);
  c("slot vuoti (V1-T5): nessuna immagine, nessuna cornice vuota, una colonna centrata (niente griglia a due colonne)", [0, false, false, true], [imgs(hV).length, /\bbrackets\b|aspect-ratio/.test(hV), /\blg:grid-cols-/.test(hV), /\btext-center\b/.test(hV)]);
  c("slot vuoti: la colonna è stretta (max-w-3xl) e NON ha anche max-w-7xl (ne vincerebbe uno a caso)", [true, false], [/\bmax-w-3xl\b/.test(hV), /<div\b[^>]*\bmax-w-3xl\b[^>]*\bmax-w-7xl\b|<div\b[^>]*\bmax-w-7xl\b[^>]*\bmax-w-3xl\b/.test(hV)]);
  c("slot vuoti: H1, bottoni, riga dello studio e fascia ci sono ancora", [true, true, true, true, true], [/<h1\b/.test(hV), /Patch pronte/.test(hV), /Cura e manutenzione/.test(hV), leggibile(hV).includes("Applichiamo patch a Roma ogni giorno."), /Studio a Roma/.test(hV)]);
  c("slot vuoti: contenuto assente o storto non rompe l'hero", [true, true], [/<h1\b/.test(await hero(undefined)), /<h1\b/.test(await hero(null))]);
  const hSenzaAlt = await hero(con({ "shop.heroFoto.alt": "" }));
  c("la foto dell'hero senza descrizione (alt svuotato) non si disegna: una colonna", [0, false], [imgs(hSenzaAlt).filter((i) => attr(i, "src") === HERO).length, /\blg:grid-cols-/.test(hSenzaAlt)]);
  c("indirizzo non sicuro nello slot (javascript:) → nessuna foto", 0, imgs(await hero(con({}, { "shop.heroFoto": "javascript:alert(1)" }))).filter((i) => /javascript/.test(i)).length);

  // regole: niente di vietato nel marchio reso
  c("hero: nessuna parola vietata, nessun indirizzo dello studio, nessuna stella né numero di clienti, nessun «da confermare»", [[], false, false], [trovaParoleVietate(hH), /\b(via|viale|piazza|corso)\s+[A-Z]\w+|\b\d{5}\b\s+Roma|\bcivico\b/.test(tH), /★|stell|recension|clienti/i.test(hH)]);

  // ════ FASCIA ═════════════════════════════════════════════════════════════════
  const voci = KF.vociFiducia({ tariffa: TARIFFA_OK, testi: {} });
  const hF = await disegna("FasciaFiducia.tsx", "FasciaFiducia", { voci });
  c("fascia: elenco di pillole con le voci della fascia (studio, spedizione, consulenza), non quelle del blocco sotto il bottone", [3, true, false], [conta(hF, /<li\b/g), /Studio a Roma/.test(hF) && /Consulenza gratuita, online/.test(hF), /Pagamenti|WhatsApp/.test(hF)]);
  c("fascia: pillole scure sul blueprint (bordo white/20, fondo white/5, testo bianco, 14 px)", true, /border-white\/20/.test(hF) && /bg-white\/5/.test(hF) && /text-white/.test(hF) && /text-sm/.test(hF));
  c("fascia: pillole chiare se `scuro` è falso", true, /border-ink\/15/.test(await disegna("FasciaFiducia.tsx", "FasciaFiducia", { voci, scuro: false })));
  c("fascia: con una sola voce, con nessuna o con dati storti non si monta (stringa vuota)", ["", "", "", ""], [await disegna("FasciaFiducia.tsx", "FasciaFiducia", { voci: voci.slice(0, 1) }), await disegna("FasciaFiducia.tsx", "FasciaFiducia", { voci: [] }), await disegna("FasciaFiducia.tsx", "FasciaFiducia", { voci: undefined }), await disegna("FasciaFiducia.tsx", "FasciaFiducia", { voci: [{ id: "studio", testo: "" }, { id: "reso", testo: "x" }] })]);
  c("fascia: nessuna indirizzo né cifra di Invisible Derm, nessuna parola vietata", [], trovaParoleVietate(hF));

  // ════ VETRINA ════════════════════════════════════════════════════════════════
  c("D78 (dati di prova): le patch in ordine alfabetico, il PRIMO non è uno scarto: patch vera, con foto e prezzo, disponibile, mai Invisible Derm", ["Patch di prova Alfa", true, true, true, false], [patch[0].nome, !!patch[0].foto, patch[0].prezzoCent > 0, patch[0].disponibile, patch.some((k) => k.slug === INVISIBLE_DERM.slug)]);
  const hV5 = await vetrina(patch);
  c("vetrina: sezione su fondo chiaro con trama (bg-white-trama), titolo «Da qui si parte» (H2) e sottotitolo del documento", [true, "Da qui si parte", true, false], [/<section\b[^>]*\bbg-white-trama\b/.test(hV5), leggibile(hV5.match(/<h2\b[^>]*>[\s\S]*?<\/h2>/)?.[0] ?? ""), leggibile(hV5).includes("Le nostre patch pronte"), /\bbg-blueprint\b|<h1\b/.test(hV5)]);
  c("vetrina: una card per prodotto, nell'ordine di `scegliVetrina`, ciascuna con il titolo a livello 3 sotto l'H2", [patch.length, patch.map((k) => k.nome)], [conta(hV5, /<article\b/g), [...hV5.matchAll(/<h3\b[^>]*>[\s\S]*?<\/h3>/g)].map((m) => leggibile(m[0]))]);
  c("vetrina: link «Vedi tutte le patch pronte →» alla categoria delle patch pronte", [KC.HREF_PATCH_PRONTE, true], [attr(link(hV5, "Vedi tutte le patch pronte →") ?? "", "href"), /min-h-11/.test(link(hV5, "Vedi tutte") ?? "")]);
  c("vetrina: 5 prodotti = 3 colonne sul computer; sempre 2 sul telefono", [true, true, false], [/\bgrid-cols-2\b/.test(hV5), /\bmd:grid-cols-3\b/.test(hV5), /\blg:grid-cols-4\b/.test(hV5)]);
  c("vetrina: `colonneVetrina` decide: 4 prodotti = 4 colonne (lg:grid-cols-4), 3 = 3, 2 = 2", [true, true, true], [/\blg:grid-cols-4\b/.test(await vetrina(patch.slice(0, 4))), (await vetrina(patch.slice(0, 3))).includes("md:grid-cols-3") && !(await vetrina(patch.slice(0, 3))).includes("lg:grid-cols-4"), !/md:grid-cols-3/.test(await vetrina(patch.slice(0, 2)))]);
  const grigliaUl = hV5.match(/<ul\b[^>]*grid[^>]*>/)?.[0] ?? "";
  const vediTutte = link(hV5, "Vedi tutte") ?? "";
  c("layout vetrina: sul computer il titolo sta a sinistra, il link a destra (colonna 2, riga 1, in basso), la griglia sotto a tutta larghezza (due colonne, riga 2)", [true, true, true, true, true, true], [/\blg:col-span-2\b/.test(grigliaUl), /\blg:row-start-2\b/.test(grigliaUl), /\blg:col-start-2\b/.test(vediTutte), /\blg:row-start-1\b/.test(vediTutte), /\blg:self-end\b/.test(vediTutte), /\blg:grid-cols-\[1fr_auto\]/.test(hV5)]);
  c("vetrina: nessuna foto `eager` (la sola `eager` della home è quella dell'hero), tutte lazy con larghezza e altezza", [0, true, true], [conta(hV5, /loading="eager"/g), imgs(hV5).every((i) => attr(i, "loading") === "lazy"), imgs(hV5).every((i) => attr(i, "width") && attr(i, "height"))]);
  c("vetrina: i titoli e i bottoni sono quelli della card (Scegli / Aggiungi), nessun secondo pieno (V1-T3)", [0, 0], [[...tagAperti(hV5, "button"), ...tagAperti(hV5, "a")].filter((t) => classePiena(t, "brand|\\[#0A1430\\]|brand-scuro")).length, [...tagAperti(hV5, "span")].filter((t) => classePiena(t, "brand|\\[#0A1430\\]|brand-scuro")).length]);
  c("vetrina: nessuna stella, nessun barrato, nessuna parola vietata, nessun Invisible Derm, nessun rosso", [[], false, false], [trovaParoleVietate(hV5), /Invisible Derm|★|stell/i.test(hV5), /#FF3B3B|bg-destructive/i.test(hV5)]);
  c("vetrina: senza testi confermati niente badge; con «pronta consegna» confermata il badge compare sulle card disponibili", [false, true], [/Pronta consegna/.test(hV5), /Pronta consegna/.test(await vetrina(patch, con({ "shop.conf.pronta_consegna": TESTI_CONFERMATI_PIENI.pronta_consegna })))]);
  c("vetrina: titolo, sottotitolo o link svuotati nel CRM non si disegnano e la griglia resta; con `{{` idem", [false, false, false, true], [/<h2\b/.test(await vetrina(patch, con({ "shop.vetrina.titolo": "" }))), /Le nostre patch pronte/.test(await vetrina(patch, con({ "shop.vetrina.sottotitolo": "  " }))), /Vedi tutte/.test(await vetrina(patch, con({ "shop.vetrina.link": "{{da confermare}}" }))), /<article\b/.test(await vetrina(patch, con({ "shop.vetrina.titolo": "" })))]);
  c("vetrina: l'H2 si può raggiungere col fuoco (tabindex -1, per «Resta qui e scegli») e la sezione ha l'ancora", [true, true], [/<h2\b[^>]*tabindex="-1"/.test(hV5), /<section\b[^>]*\bid="vetrina"/.test(hV5)]);

  // V1-T5: meno di 2 prodotti, senza foto, dati storti → la vetrina non si monta
  const senzaFoto = KH.scegliVetrina(CATALOGO_SENZA_FOTO);
  const unaFoto = KH.scegliVetrina(CATALOGO_UNA_FOTO);
  c("vetrina: meno di 2 prodotti (null, [], 1) o dati storti: non si monta (stringa vuota)", ["", "", "", "", ""], [await vetrina(null), await vetrina([]), await vetrina(patch.slice(0, 1)), await vetrina(undefined), await vetrina("no")]);
  c("vetrina (slot vuoti): un catalogo senza foto non dà vetrina; con la sola foto principale sì", [null, true], [senzaFoto, (await vetrina(unaFoto)).includes("Da qui si parte")]);
  c("vetrina: contenuto assente o storto non la rompe (testi di partenza)", [true, true], [(await vetrina(patch, undefined)).includes("Da qui si parte"), (await vetrina(patch, null)).includes("Da qui si parte")]);

  // ════ LE REGOLE DEL CODICE NUOVO ═════════════════════════════════════════════
  const file = (f) => readFileSync(join(dir, f), "utf8");
  const sorg = { hero: file("HeroShop.tsx"), fascia: file("FasciaFiducia.tsx"), vetrina: file("VetrinaHome.tsx") };
  const tutti = Object.values(sorg).join("\n");
  c("regole: nessun Anton, Instrument, font-family a mano, nessun rosso, nessun `backdrop-`, nessuna ombra, nessun gradiente nuovo (il solo è il riflettore radiale della landing)", [false, false, false, false, false, false], [/Anton|Instrument/.test(tutti), /font-family/.test(tutti), /#FF3B3B|bg-destructive|text-destructive/i.test(tutti), /backdrop-/.test(tutti), /\bshadow-/.test(tutti), /linear-gradient|conic-gradient/.test(tutti)]);
  c("regole: niente «da confermare» né `{{` nei file (nemmeno nei commenti)", [false, false], [/da confermare/i.test(tutti), /\{\{/.test(tutti)]);
  c("regole: nessuna `<img` scritta a mano, nessun `loading=` o `fetchPriority` a mano: le foto passano da `FotoShop`", [false, false, true], [/<img\b/.test(tutti), /loading=|fetchPriority/i.test(tutti), /import \{ FotoShop \} from "@\/components\/shop\/FotoShop"/.test(sorg.hero)]);
  const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c("regole: la sola `prima` è nell'hero (la vetrina e la fascia non la nominano nemmeno)", [true, false, false], [/\bprima\b/.test(senzaCommenti(sorg.hero)), /\bprima\b/.test(senzaCommenti(sorg.vetrina)), /\bprima\b/.test(senzaCommenti(sorg.fascia))]);
  c("regole: nessuna logica rifatta: usano `pianoHero`, `colonneVetrina`, `vociFiducia`, `testiDi`, `confermatiDa`, `slotUsabile`, `GrigliaCard`, `BloccoFiducia`", [true, true, true, true, true, true, true, true], [/\bpianoHero\b/.test(sorg.hero), /\bcolonneVetrina\b/.test(sorg.vetrina), /\bvociFiducia\b/.test(sorg.fascia), /\btestiDi\b/.test(sorg.hero) && /\btestiDi\b/.test(sorg.vetrina), /\bconfermatiDa\b/.test(sorg.hero) && /\bconfermatiDa\b/.test(sorg.vetrina), /\bslotUsabile\b/.test(sorg.hero), /\bGrigliaCard\b/.test(sorg.vetrina), /\bBloccoFiducia\b/.test(sorg.fascia)]);
  c("regole: gli indirizzi dei due bottoni e del link non sono riscritti (HREF_PATCH_PRONTE, HREF_CURA)", [true, false], [/HREF_PATCH_PRONTE/.test(sorg.hero) && /HREF_CURA/.test(sorg.hero) && /HREF_PATCH_PRONTE/.test(sorg.vetrina), /\/shop\/c\//.test(tutti)]);
  c("regole: nessuna rotta toccata: i tre file sono montati da nessuno (T94 li monta)", 0, conta(readFileSync(join(radice, "src/routes/shop.index.tsx"), "utf8"), /components\/shop\/home\//g));
}
