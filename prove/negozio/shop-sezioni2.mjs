/** ── VETRINA V1 · T88b · SEZIONI DELLA SCHEDA, SECONDA PARTE (23/11/2026) ──────────────────────────────────────────
 *  `SezioniScheda2.tsx`: domande frequenti, box «Non è il prodotto giusto per te?», «Ti serve anche», «Cosa contiene» del kit.
 *  Criteri V1-S5, V1-T8, V1-T5. Il componente non è montato in nessuna rotta (lo monta T97b).
 *  Due parti:
 *   1. `correlato` di `pubblico.ts` porta anche `sku`, `prezziDiversi`, `aggiungibile` (decisione del capo progetto dopo T85): uguali a ciò che dice
 *      `cardDaPubblico` del prodotto collegato (la regola è UNA sola, non copiata), le quattro chiavi di prima invariate, nessun ciclo che rompa
 *      i due moduli (si impacchettano in tutti e due gli ordini).
 *   2. il componente, disegnato davvero con `rendiComponente` (aiuti di `_rende.mjs`): ordine, FAQ, box dopo le FAQ, una sola card con «Aggiungi»
 *      che sa lo SKU, `content-visibility`, nessun testo scritto a mano, nessuna recensione.
 *  Dati inventati (`dati.mjs`, `_dati-vetrina.mjs`), nessuna rete, nessun database. */
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prodottoProva, uuid, varianteProva, mediaProva } from "./dati.mjs";
import { CATALOGO, INVISIBLE_DERM, carrelloFinto, trovaParoleVietate } from "./_dati-vetrina.mjs";
import { gestore, rendiComponente } from "./_rende.mjs";

const requireQui = createRequire(import.meta.url);
const BASE = "https://media.prova.test/storage/shop-media";
const copia = (x) => structuredClone(x);
// le frasi «non pronte» si compongono qui: nel file non ci devono essere né il segnaposto né la formula scritti per intero
const SEGNAPOSTO = "{" + "{nome}}";
const IN_ATTESA = "da " + "confermare";
const NON_PRONTO = new RegExp(`${IN_ATTESA}|\\{\\{`, "i");
// le doppie graffe di un attributo JSX non sono un segnaposto: le si separa prima di cercare
const senzaJsx = (t) => t.replaceAll("={" + "{", "={ {");
const per = (slug) => CATALOGO.find((p) => p.slug === slug);
const leggibile = (html) => html.replace(/<[^>]*>/g, " ").replace(/ /g, " ").replace(/\s+/g, " ").trim();
const conta = (html, re) => (html.match(re) ?? []).length;

export async function prove(mod, { c, gruppo, radice }) {
  await correlatoArricchito(mod, { c, gruppo, radice });
  await componente(mod, { c, gruppo, radice });
}

/* ═════════════════════════ 1 · `correlato` di pubblico.ts ═════════════════════════ */

/** Un negozio finto di due prodotti: «Principale» (consiglia X) e X, con le varianti e le opzioni date. */
function righe({ nome = "Collegato", slug = "collegato", prezzo = 1690, varianti, opzioniDelleVarianti = [{}], media = true }) {
  const P = uuid(0x500), X = uuid(0x501);
  const v = (varianti ?? [{ giacenza: 5 }]).map((x, i) =>
    varianteProva({ id: uuid(0x600 + i), prodotto_id: X, sku: `COLL-${i + 1}`, nome: `Variante ${i + 1}`, opzioni: opzioniDelleVarianti[i] ?? opzioniDelleVarianti[0] ?? {}, prezzo_cent: x.prezzo ?? null, giacenza: x.giacenza ?? 5, ordine: i + 1 }),
  );
  return {
    prodotti: [
      prodottoProva({ id: P, sku: "PRIN-1", slug: "principale", nome: "Principale", tipo: "patch", prezzo_cent: 28900, correlato_id: X }),
      prodottoProva({ id: X, sku: "COLL-0", slug, nome, tipo: "cura", prezzo_cent: prezzo }),
    ],
    varianti: [varianteProva({ id: uuid(0x5f0), prodotto_id: P, sku: "PRIN-1-A", giacenza: 3 }), ...v],
    categorie: [],
    prodottiCategorie: [],
    media: media ? [mediaProva({ id: uuid(0x700), prodotto_id: X, slot: "principale", alt: "Foto del collegato" })] : [],
  };
}

async function correlatoArricchito(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T88b · `correlato` PORTA SKU, «DA» E «SI COMPRA CON UN CLIC» (23/11/2026)");
  const PUB = mod["shop/cms/pubblico"];
  const CARD = mod["shop/cms/vetrina-card"];
  const opz = { baseMedia: BASE };
  const costruisci = (r) => PUB.costruisciPubblico(r, opz);
  const chiavi = (o) => Object.keys(o).sort();

  // ── i sei casi: la regola è quella di `cardDaPubblico` del prodotto collegato ──
  const CASI = [
    ["una variante, senza opzioni, disponibile", righe({}), { sku: "COLL-1", aggiungibile: true, prezziDiversi: false }],
    ["due varianti con prezzi diversi", righe({ varianti: [{ prezzo: 1000 }, { prezzo: 1500 }] }), { sku: null, aggiungibile: false, prezziDiversi: true }],
    ["due varianti con lo stesso prezzo (nessuna cifra «Da»)", righe({ varianti: [{}, {}] }), { sku: null, aggiungibile: false, prezziDiversi: false }],
    ["una variante ma con un'opzione da scegliere", righe({ opzioniDelleVarianti: [{ Colore: "Nero" }] }), { sku: null, aggiungibile: false, prezziDiversi: false }],
    ["una sola variante, esaurita", righe({ varianti: [{ giacenza: 0 }] }), { sku: null, aggiungibile: false, prezziDiversi: false }],
    ["Invisible Derm: nessun prezzo, non si compra", righe({ nome: "Invisible Derm", slug: "invisible-derm" }), { sku: null, aggiungibile: false, prezziDiversi: false }],
  ];
  for (const [nome, r, atteso] of CASI) {
    const pubblici = costruisci(r);
    const principale = pubblici.find((p) => p.slug === "principale");
    const collegato = pubblici.find((p) => p.slug !== "principale");
    const k = principale?.correlato;
    c(`${nome}: sku, prezziDiversi, aggiungibile`, atteso, k ? { sku: k.sku, aggiungibile: k.aggiungibile, prezziDiversi: k.prezziDiversi } : null);
    const card = CARD.cardDaPubblico(collegato);
    c(`${nome}: uguali a quelli di cardDaPubblico (stessa regola)`, { aggiungibile: card.aggiungibile, prezziDiversi: card.prezziDiversi, sku: card.aggiungibile ? card.skuVarianti[0] : null }, { aggiungibile: k?.aggiungibile, prezziDiversi: k?.prezziDiversi, sku: k?.sku });
  }

  // ── le quattro chiavi di prima non cambiano; le nuove sono solo quelle tre ──
  const [uno] = costruisci(righe({}));
  c("le chiavi di `correlato` sono le quattro di prima più le tre nuove, e nessun'altra", ["aggiungibile", "foto", "nome", "prezziDiversi", "prezzoDaCent", "sku", "slug"], chiavi(uno.correlato));
  c("le quattro di prima hanno gli stessi valori di prima (indirizzo, nome, prezzo da, foto)", { slug: "collegato", nome: "Collegato", prezzoDaCent: 1690, foto: { w480: `${BASE}/prova/aaaaaaaaaaaa-480.webp`, w960: `${BASE}/prova/aaaaaaaaaaaa-960.webp`, w1600: `${BASE}/prova/aaaaaaaaaaaa-1600.webp` } }, (({ slug, nome, prezzoDaCent, foto }) => ({ slug, nome, prezzoDaCent, foto }))(uno.correlato));
  c("senza foto del collegato: `foto` è null e il resto resta com'è", [null, "COLL-1"], [costruisci(righe({ media: false }))[0].correlato.foto, costruisci(righe({ media: false }))[0].correlato.sku]);
  c("senza collegamento (o verso una bozza) `correlato` resta null", [null, null], [
    costruisci({ ...righe({}), prodotti: righe({}).prodotti.map((p) => (p.slug === "principale" ? { ...p, correlato_id: null } : p)) })[0].correlato,
    costruisci({ ...righe({}), prodotti: righe({}).prodotti.map((p) => (p.slug === "collegato" ? { ...p, stato: "bozza" } : p)) })[0].correlato,
  ]);
  const conGiacenza = JSON.stringify(costruisci(righe({ varianti: [{ giacenza: 7341 }] })));
  c("la giacenza non esce: né il numero né la parola nel JSON, nemmeno nel collegato", false, /7341|giacenza/i.test(conGiacenza));

  // ── la regola non è copiata, e il ciclo di importazione non rompe nessuno dei due moduli ──
  const sorgente = readFileSync(join(radice, "src/shop/cms/pubblico.ts"), "utf8");
  c("pubblico.ts importa `cardDaPubblico` da vetrina-card e non riscrive la regola (niente «unica variante», niente confronto dei prezzi, niente conteggio delle opzioni)", [true, false, false], [/import \{ cardDaPubblico \} from "\.\/vetrina-card"/.test(sorgente), /const unica\b|prezzi\.size|varianti\.length === 1/.test(sorgente), /opzioni\.length/.test(sorgente)]);
  const esbuild = requireQui("esbuild");
  const dir = mkdtempSync(join(tmpdir(), "prova-ciclo-"));
  try {
    const esiti = [];
    for (const [nome, entrata] of [
      ["pubblico per primo", `import * as P from "@/shop/cms/pubblico"; import * as V from "@/shop/cms/vetrina-card"; export const r = () => [P.eInvisibleDerm("Invisible Derm"), V.cardDaPubblico({ slug: "a", nome: "A", prezzoDaCent: 100, acquistabile: true, varianti: [], opzioni: [], media: [] }).slug];`],
      ["vetrina-card per prima", `import * as V from "@/shop/cms/vetrina-card"; import * as P from "@/shop/cms/pubblico"; export const r = () => [P.eInvisibleDerm("Invisible Derm"), V.cardDaPubblico({ slug: "a", nome: "A", prezzoDaCent: 100, acquistabile: true, varianti: [], opzioni: [], media: [] }).slug];`],
    ]) {
      const file = join(dir, `${esiti.length}.tsx`);
      writeFileSync(file, entrata);
      const r = await esbuild.build({ entryPoints: [file], bundle: true, write: false, platform: "node", format: "cjs", alias: { "@": join(radice, "src") }, absWorkingDir: radice, nodePaths: [join(radice, "node_modules")], logLevel: "silent" });
      const fuori = join(dir, `${esiti.length}.cjs`);
      writeFileSync(fuori, r.outputFiles[0].text);
      esiti.push([nome, requireQui(fuori).r()]);
    }
    c("i due moduli si caricano e rispondono in tutti e due gli ordini di importazione", [[true, "a"], [true, "a"]], esiti.map(([, r]) => r));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  c("la rotta di oggi legge solo le quattro chiavi di prima (slug, nome, prezzoDaCent, foto)", [[], true], (() => {
    const rotta = readFileSync(join(radice, "src/routes/shop.prodotto.$slug.tsx"), "utf8");
    const usate = [...new Set([...rotta.matchAll(/correlato\.(\w+)/g)].map((m) => m[1]))];
    return [usate.filter((k) => !["slug", "nome", "prezzoDaCent", "foto"].includes(k)), usate.length > 0];
  })());
}

/* ═════════════════════════ 2 · il componente ═════════════════════════ */

/** Il correlato come lo darebbe il server con le tre chiavi nuove, preso dalla card del prodotto collegato. */
function correlatoDa(mod, slug) {
  const p = per(slug);
  const card = mod["shop/cms/vetrina-card"].cardDaPubblico(p);
  return { slug: p.slug, nome: p.nome, prezzoDaCent: p.prezzoDaCent, foto: p.media[0]?.src ?? null, sku: card.aggiungibile ? card.skuVarianti[0] : null, prezziDiversi: card.prezziDiversi, aggiungibile: card.aggiungibile };
}

async function componente(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T88b · SEZIONI DELLA SCHEDA: FAQ, BOX, «TI SERVE ANCHE», KIT (23/11/2026)");
  const KS = mod["shop/cms/vetrina-scheda"];
  const FILE = join(radice, "src/components/shop/scheda/SezioniScheda2.tsx");
  // il box è finto (ripete le proprietà che riceve) salvo dove si vuole quello vero
  const BOX_ECO = { "@/components/landing/consulenza/BoxProdottoGiusto": 'export const BoxProdottoGiusto = (p) => "[box variante=" + p.variante + " prodotto=" + p.prodotto + "]";' };
  const registro = () => { const aggiunte = []; return { aggiunte, carrello: carrelloFinto([], { add: (...a) => aggiunte.push(a) }) }; };
  const disegna = (props, extra = {}) => rendiComponente(radice, FILE, "SezioniScheda2", props, { finti: BOX_ECO, ...extra });
  /** La scheda: i blocchi dati da `bloccheScheda` (T78) sul prodotto; `correlato` e `faq` si possono sostituire. */
  const scheda = (slug, cambi = {}) => {
    const p = { ...copia(per(slug)), ...cambi };
    return { prodotto: p, blocchi: KS.bloccheScheda(p, { tariffa: { stato: "ok" } }) };
  };
  const alfa = (cambi = {}) => scheda("patch-prova-alfa", { correlato: correlatoDa(mod, "balsamo-prova"), ...cambi });

  // ── ordine: FAQ, poi il box, poi «Ti serve anche» ──
  const { html: h } = await disegna(alfa());
  const t = leggibile(h);
  c("una patch con tutto: titoli nell'ordine «Domande frequenti» → box → «Ti serve anche»", [true, true], [t.indexOf("Domande frequenti") < t.indexOf("[box"), t.indexOf("[box") < t.indexOf("Ti serve anche")]);
  c("i tre titoli sono H2 (uno solo ciascuno); il box è disegnato con `variante=\"chiara\"` e il nome del prodotto", [2, 1, 1, "[box variante=chiara prodotto=Patch di prova Alfa]"], [conta(h, /<h2\b/g), conta(t, /Domande frequenti/g), conta(t, /Ti serve anche/g), t.match(/\[box[^\]]*\]/)?.[0]]);

  // ── FAQ ──
  c("FAQ: ogni domanda è un H3 con un bottone da accordion (aria-expanded=false di partenza), le risposte non sono nel disegno chiuso", [2, 2, false], [conta(h, /<h3\b/g), conta(h, /<button\b[^>]*aria-expanded="false"/g), /Risposta di prova uno/.test(h)]);
  c("FAQ: le domande sono quelle del prodotto, nell'ordine", true, t.indexOf("Domanda di prova uno?") < t.indexOf("Domanda di prova due?") && t.indexOf("Domanda di prova uno?") > 0);
  c("FAQ: righe da 56 px o più (riempimento 16 + 16 e numero da 28 = 60)", true, /<button\b(?=[^>]*\bpy-4\b)[^>]*>[\s\S]*?\bh-7\b/.test(h));
  c("FAQ: allineata a sinistra, sotto il titolo (non centrata); il blu del marchio scende di un gradino sul fondo chiaro", [true, true], [/\[&amp;&gt;div\]:mx-0/.test(h), /\[--brand:var\(--brand-su-chiaro\)\]/.test(h)]);
  const sporche = alfa({ faq: [{ d: "Buona domanda?", r: "Buona risposta." }, { d: `Con segnaposto ${SEGNAPOSTO}?`, r: "Risposta." }, { d: "Domanda?", r: `Risposta ${IN_ATTESA}.` }, { d: "  ", r: "x" }, { d: "Senza risposta?", r: "" }] });
  const hSporche = (await disegna(sporche)).html;
  c("FAQ: le righe con segnaposto, in attesa del titolare, vuote o senza risposta non si disegnano", [1, true, false], [conta(hSporche, /<h3\b/g), hSporche.includes("Buona domanda?"), NON_PRONTO.test(hSporche) || /Senza risposta/.test(hSporche)]);
  const hSenzaFaq = (await disegna(alfa({ faq: [] }))).html;
  c("FAQ vuote: niente titolo e niente sezione (il blocco non c'è)", [false, true], [/Domande frequenti/.test(hSenzaFaq), /\[box/.test(hSenzaFaq)]);
  // il blocco c'è ma tutte le righe sono sporche: niente titolo sopra il vuoto
  const hTutteSporche = (await disegna({ ...alfa(), prodotto: { ...alfa().prodotto, faq: [{ d: `${SEGNAPOSTO}?`, r: "a" }] } })).html;
  c("FAQ: se dopo la pulizia non resta nulla, nemmeno il titolo", false, /Domande frequenti/.test(hTutteSporche));

  // ── box ──
  c("box: solo se c'è il blocco `box` (patch in vendita con box consulenza)", [true, false, false], [/\[box/.test(h), /\[box/.test((await disegna(scheda("balsamo-prova"))).html), /\[box/.test((await disegna(scheda("kit-prova"))).html)]);
  c("box: senza `boxConsulenza` non c'è, anche con le FAQ", false, /\[box/.test((await disegna(alfa({ boxConsulenza: false }))).html));
  c("box: a differenza delle FAQ non sparisce se mancano le FAQ, e resta DOPO di esse quando ci sono", [true, true], [/\[box/.test(hSenzaFaq), t.indexOf("Domande frequenti") < t.indexOf("[box")]);
  const hBoxVero = (await disegna(alfa(), { senzaFinti: ["@/components/landing/consulenza/BoxProdottoGiusto"] })).html;
  c("box vero: «Non è il prodotto giusto per te?», card chiara con bordo notte, bottone di contorno «Parlane con noi, gratis», nessun blu pieno", [true, true, true, false], [/Non è il prodotto giusto per te\?/.test(hBoxVero), /rounded-xl border border-\[#0A1430\]\/15 bg-white/.test(hBoxVero), /border-2 border-\[#0A1430\][^>]*>Parlane con noi, gratis/.test(hBoxVero), /bg-brand-scuro/.test(hBoxVero)]);

  // ── «Ti serve anche»: una card, con [Aggiungi] se si compra con un clic ──
  c("«Ti serve anche» (balsamo, una variante senza opzioni): UNA card con «Aggiungi» (bottone vero) e il prezzo, nessun «Scegli»", [1, 1, true, true, false], [conta(h, /Ti serve anche/g), conta(h, /<button\b[^>]*>Aggiungi</g), /16,90/.test(t), />Aggiungi</.test(h), />Scegli</.test(h)]);
  const corr = correlatoDa(mod, "balsamo-prova");
  const r1 = registro();
  const { pagina: p1 } = await disegna(alfa(), { carrello: r1.carrello });
  gestore(p1, "button", "Aggiungi")();
  c("clic su «Aggiungi»: il carrello riceve lo SKU del collegato (una sola riga) e parte UN SOLO AddToCart (lo emette la card, la sezione no)", [1, corr.sku, 1, "AddToCart", [corr.sku]], [r1.aggiunte.length, r1.aggiunte[0]?.[3]?.sku, p1.eventi.length, p1.eventi[0]?.[0], p1.eventi[0]?.[1]?.contentIds]);
  const hShampoo = (await disegna(alfa({ correlato: correlatoDa(mod, "shampoo-prova") }))).html;
  c("collegato con scelte (shampoo: misura): «Scegli», nessun «Aggiungi», nessun bottone; il prezzo ha «Da»", [true, false, 0, true], [/>Scegli</.test(hShampoo), /Aggiungi/.test(hShampoo), conta(hShampoo, /<button\b/g) - conta(hShampoo, /<button\b[^>]*aria-expanded/g), /Da 14,90/.test(leggibile(hShampoo))]);
  const vecchio = (({ sku, prezziDiversi, aggiungibile, ...resto }) => resto)(corr);
  const rVecchio = registro();
  const hVecchio = (await disegna(alfa({ correlato: vecchio }), { carrello: rVecchio.carrello })).html;
  c("un `correlato` del server di prima (senza le tre chiavi nuove): la card c'è e porta alla scheda («Scegli»), niente «Aggiungi» e niente errore", [true, false], [/>Scegli</.test(hVecchio), /Aggiungi/.test(hVecchio)]);
  c("`aggiungibile` senza SKU (dato sporco): non si inventa uno SKU, «Scegli»", [true, false], [/>Scegli</.test((await disegna(alfa({ correlato: { ...corr, sku: null } }))).html), /Aggiungi/.test((await disegna(alfa({ correlato: { ...corr, sku: "" } }))).html)]);
  c("la foto del collegato è decorativa (alt vuoto) e il nome è il link alla sua scheda", [true, true], [/<img\b[^>]*\balt=""/.test(h), new RegExp(`href="/shop/prodotto/${corr.slug}"[^>]*>${corr.nome}<`).test(h)]);
  const hDerm = (await disegna({ prodotto: alfa().prodotto, blocchi: [{ id: "tiServeAnche", correlato: { slug: INVISIBLE_DERM.slug, nome: INVISIBLE_DERM.nome, prezzoDaCent: 12300, foto: null, sku: "X", prezziDiversi: false, aggiungibile: true } }] })).html;
  c("Invisible Derm come collegato (anche a forza, con prezzo e SKU): nessuna card, nessun titolo", "", hDerm.trim());
  c("senza il blocco `tiServeAnche` (nessun collegato, o senza prezzo): niente titolo", [false, false], [/Ti serve anche/.test((await disegna(alfa({ correlato: null }))).html), /Ti serve anche/.test((await disegna(alfa({ correlato: { ...corr, prezzoDaCent: null } }))).html)]);

  // ── kit: «Cosa contiene» è di T88a (blocco `confezione`): qui il blocco `confezione` non produce niente ──
  const kit = scheda("kit-prova");
  const hKit = (await disegna(kit)).html;
  c("kit: il blocco `confezione` (del kit o normale) non disegna niente qui (lo disegna T88a: mai due volte); il kit ha le sue FAQ e nessun box", [true, true, false, false, false], [kit.blocchi.some((b) => b.id === "confezione" && b.titolo === "cosaContiene"), /Domande frequenti/.test(hKit), /Cosa contiene|Nella confezione/.test(hKit), /\[box/.test(hKit), (await disegna({ prodotto: kit.prodotto, blocchi: [{ id: "confezione", titolo: "cosaContiene", voci: ['Una patch'] }, { id: "confezione", titolo: "confezione", voci: ['Un vasetto'] }] })).html.trim() !== ""]);

  // ── i blocchi che non sono di questo componente si ignorano; poca cosa = niente ──
  const hAltri = (await disegna({ prodotto: alfa().prodotto, blocchi: [{ id: "galleria" }, { id: "colore" }, { id: "comeSiUsa" }, { id: "schedaTecnica", righe: [] }, { id: "avvertenze", voci: ["x"] }] })).html;
  c("galleria, colore, come si usa, scheda tecnica, avvertenze: non sono qui (nessun marchio)", "", hAltri.trim());
  c("nessun blocco, o un valore sbagliato al posto dell'elenco: niente, senza lanciare", ["", "", ""], [(await disegna({ prodotto: alfa().prodotto, blocchi: [] })).html.trim(), (await disegna({ prodotto: alfa().prodotto, blocchi: null })).html.trim(), (await disegna({ prodotto: alfa().prodotto, blocchi: [null, {}, { id: 5 }] })).html.trim()]);

  // ── sotto la piega: `content-visibility:auto` su FAQ, box, «Ti serve anche» ──
  c("FAQ, box e «Ti serve anche» stanno ognuno in un contenitore con `content-visibility:auto`, una misura di riserva e 4 px di respiro per l'anello del fuoco", [3, 3], [conta(h, /\[content-visibility:auto\][^"]*\[contain-intrinsic-size:auto_\d+px\]/g), conta(h, /class="[^"]*-m-1 p-1 \[content-visibility:auto\]/g)]);

  // ── ogni `aria-labelledby` punta a un `id` che esiste nel disegno ──
  const senzaBersaglio = (html) => [...html.matchAll(/aria-labelledby="([^"]+)"/g)].map((m) => m[1]).filter((id) => !html.includes(`id="${id}"`));
  const hVuote = [h, hKit, hShampoo, hBoxVero];
  c("ogni `aria-labelledby` ha il suo `id` (FAQ, box, «Ti serve anche»), e ce n'è almeno uno per sezione", [[], [], [], [], true], [...hVuote.map(senzaBersaglio), conta(hBoxVero, /aria-labelledby=/g) === 3]);
  c("fuoco da tastiera sui bottoni delle FAQ: anello azzurro 2 px con scarto 2 (come `shop-anello`), senza toccare `FaqAccordion`", true, /\[&amp;_button:focus-visible\]:outline-2/.test(h) && /outline-offset-2/.test(h) && /outline-\[#006CC4\]/.test(h));

  // ── nessuna recensione, nessuna stella, niente di vietato ──
  const tutto = h + hKit + hShampoo + hBoxVero;
  c("nessuna recensione, stella, «Nuovo», barrato né ombra nel disegno", [[], false], [trovaParoleVietate(tutto), /recension|★|\bstar|nuovo|shadow|gradient|backdrop|line-through/i.test(tutto)]);
  c("nessun segnaposto né formula «in attesa» nel disegno", false, NON_PRONTO.test(tutto));
  c("nessun tracciamento diretto (fbq, ttq, gtag) nel disegno né nel sorgente", false, /fbq|ttq|gtag/.test(tutto + readFileSync(FILE, "utf8")));

  // ── il sorgente ──
  const sorgente = readFileSync(FILE, "utf8");
  const ts = requireQui("typescript");
  const sf = ts.createSourceFile("SezioniScheda2.tsx", sorgente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const testi = [];
  const visita = (n) => {
    if (n.kind === ts.SyntaxKind.JsxText && /[A-Za-zÀ-ÿ]{2,}/.test(n.getText())) testi.push(`testo «${n.getText().trim()}»`);
    if (n.kind === ts.SyntaxKind.JsxAttribute && ["aria-label", "alt", "title", "placeholder"].includes(n.name.getText()) && n.initializer?.kind === ts.SyntaxKind.StringLiteral && /[A-Za-zÀ-ÿ]{2,}/.test(n.initializer.text)) testi.push(`${n.name.getText()} «${n.initializer.text}»`);
    ts.forEachChild(n, visita);
  };
  visita(sf);
  c("nessun testo scritto a mano nei tag né in alt/aria-label/title: tutto viene da `testi-shop.ts`", [], testi);
  c("sorgente: nessun AddToCart, nessun carrello, nessun `emettiEvento` (lo fa la card di T85)", false, /AddToCart|useCart|emettiEvento|CartContext/.test(sorgente));
  c("sorgente: usa `TiServeAnche` (T85), `FaqAccordion` con `voci`, `BoxProdottoGiusto` con `variante=\"chiara\"`; nessuna card disegnata a mano", [true, true, true, false], [/from "@\/components\/shop\/TiServeAnche"/.test(sorgente), /<FaqAccordion voci=/.test(sorgente), /variante="chiara"/.test(sorgente), /CardProdotto|<img\b/.test(sorgente)]);
  c("sorgente: nessuna parola vietata, nessun segnaposto e nessuna formula «in attesa» (nemmeno nei commenti)", [[], false], [trovaParoleVietate(senzaJsx(sorgente)), NON_PRONTO.test(senzaJsx(sorgente))]);
  c("sorgente: nessun rosso del marchio, nessuna sfocatura, nessun bottone pieno", false, /#FF3B3B|destructive|backdrop|\bbg-(brand|\[#0A1430\])\b(?!\/)/.test(sorgente));
  const montato = readdirSync(join(radice, "src/routes")).filter((f) => /\.tsx?$/.test(f) && /SezioniScheda2/.test(readFileSync(join(radice, "src/routes", f), "utf8")));
  c("non è montato in nessuna rotta né nell'albero delle rotte (lo monta T97b)", [[], false], [montato, /SezioniScheda2/.test(readFileSync(join(radice, "src/routeTree.gen.ts"), "utf8"))]);
}
