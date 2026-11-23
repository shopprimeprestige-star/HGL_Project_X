/** ── VETRINA V1 · T77 · I META, L'IMMAGINE DI CONDIVISIONE, L'INDIRIZZO CANONICO (D97) ───────────────────────
 *  `src/shop/cms/vetrina-seo.ts`: funzioni pure. Si prova: il meta di ogni categoria è diverso da quello di tutte le altre (V1-C3), quello del
 *  CMS vince sulla riga del documento §3.4 e questa sul modello con il nome; titoli ≤ 60 e descrizioni ≤ 155; nessuna parola vietata,
 *  nessun segnaposto, mai l'indirizzo dello studio; l'immagine di condivisione è solo https; l'indirizzo canonico non porta filtri e non esce dal sito;
 *  la ricerca è `noindex`. Il confronto con il documento è con `_testi-documento.json`, copiato a mano (non con il codice stesso). */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CATALOGO, CATALOGO_SENZA_FOTO, CATEGORIE, trovaParoleVietate } from "./_dati-vetrina.mjs";

export async function prove(mod, { c, gruppo, radice }) {
  const S = mod["shop/cms/vetrina-seo"];
  gruppo("VETRINA V1 · T77 · SEO (23/11/2026)");

  const doc = Object.fromEntries(JSON.parse(readFileSync(join(radice, "prove/negozio/_testi-documento.json"), "utf8")).testi.map((t) => [t.chiave, t.doc]));
  const SEI = [0, 1, 2, 3, 4, 5].map((i) => ({ slug: doc[`categorie.${i}.slug`], nome: doc[`categorie.${i}.nome`], metaTitolo: doc[`categorie.${i}.metaTitolo`], metaDescrizione: doc[`categorie.${i}.metaDescrizione`] }));
  const cat = (slug, nome, seo = { titolo: null, descrizione: null }) => ({ slug, nome, seo });
  const nude = SEI.map((x) => cat(x.slug, x.nome));
  const tuttiDiversi = (lista) => new Set(lista).size === lista.length;

  c("(controllo dei dati) il documento ha sei categorie con slug, meta title e meta description", [6, true], [SEI.length, SEI.every((x) => x.slug && x.metaTitolo && x.metaDescrizione)]);

  // ── la riga del documento, per ogni categoria ──
  const m6 = nude.map((x) => S.metaCategoria(x));
  c("senza testi nel CMS: titolo e descrizione sono quelli del documento §3.4, uno per categoria", SEI.map((x) => ({ titolo: x.metaTitolo, descrizione: x.metaDescrizione })), m6);
  c("META DELLE 6 CATEGORIE TUTTI DIVERSI (titoli e descrizioni)", [true, true], [tuttiDiversi(m6.map((m) => m.titolo)), tuttiDiversi(m6.map((m) => m.descrizione))]);
  c("titolo ≤ 60 e descrizione ≤ 155 segni (regola del documento)", [true, true], [m6.every((m) => m.titolo.length <= 60), m6.every((m) => m.descrizione.length <= 155)]);
  c("nessuna parola vietata, nessun segnaposto, mai l'indirizzo dello studio, nessun prezzo", [], m6.flatMap((m) => trovaParoleVietate(`${m.titolo} ${m.descrizione}`)).concat(m6.filter((m) => /€|\beuro\b|\d\s?,\s?\d\d/i.test(`${m.titolo} ${m.descrizione}`)).map((m) => m.titolo)));

  // ── il CMS vince ──
  c("il titolo scritto nel CMS vince; la descrizione, non scritta, torna alla riga del documento",
    { titolo: "Le nostre patch, scelte una per una", descrizione: SEI[0].metaDescrizione }, S.metaCategoria(cat(SEI[0].slug, SEI[0].nome, { titolo: "Le nostre patch, scelte una per una", descrizione: null })));
  c("descrizione del CMS vince su quella del documento, titolo del documento", { titolo: SEI[1].metaTitolo, descrizione: "Descrizione scritta dal titolare." },
    S.metaCategoria(cat(SEI[1].slug, SEI[1].nome, { titolo: null, descrizione: "Descrizione scritta dal titolare." })));
  c("testo vuoto, di soli spazi o con un segnaposto a doppia graffa non vale: si torna al documento", { titolo: SEI[2].metaTitolo, descrizione: SEI[2].metaDescrizione },
    S.metaCategoria(cat(SEI[2].slug, SEI[2].nome, { titolo: "   ", descrizione: `Da ${"{" + "{"}confermare}}` })));
  c("il testo del CMS è tolto dagli spazi agli estremi", "Titolo con spazi", S.metaCategoria(cat("x-y", "X", { titolo: "  Titolo con spazi \n", descrizione: null })).titolo);
  c("seo mancante o nulla (categoria senza campo) non lancia", [SEI[3].metaTitolo, SEI[3].metaTitolo], [S.metaCategoria({ slug: SEI[3].slug, nome: SEI[3].nome }).titolo, S.metaCategoria({ slug: SEI[3].slug, nome: SEI[3].nome, seo: null }).titolo]);

  // ── il modello con il nome ──
  const m1 = S.metaCategoria(cat("trecce", "Trecce"));
  const m2 = S.metaCategoria(cat("extension", "Extension"));
  c("slug che il documento non ha: il modello con il nome (nome nel titolo e nella descrizione)", [true, true, true, true], [m1.titolo.includes("Trecce"), m1.descrizione.includes("Trecce"), m2.titolo.includes("Extension"), m2.descrizione.includes("Extension")]);
  c("il modello non ha parole vietate, segnaposto o indirizzo, ed entra nei limiti con un nome normale", [[], true], [trovaParoleVietate(`${m1.titolo} ${m1.descrizione}`), m1.titolo.length <= 60 && m1.descrizione.length <= 155]);
  c("due categorie con nomi diversi hanno meta diversi anche con il modello", [true, true], [m1.titolo !== m2.titolo, m1.descrizione !== m2.descrizione]);
  c("il modello vale per ogni titolo e descrizione che manca, anche se solo uno è del CMS", { titolo: "Solo il titolo", descrizione: m1.descrizione }, S.metaCategoria(cat("trecce", "Trecce", { titolo: "Solo il titolo", descrizione: null })));
  const otto = [...m6, m1, m2];
  c("sei del documento e due fuori documento: otto meta tutti diversi", [true, true], [tuttiDiversi(otto.map((m) => m.titolo)), tuttiDiversi(otto.map((m) => m.descrizione))]);

  // ── le categorie dei dati inventati ──
  const dati = CATEGORIE.map((x) => S.metaCategoria(x));
  c("le tre categorie di prova (con il loro testo SEO) → diverse fra loro e uguali al testo scritto", [true, true, true], [tuttiDiversi(dati.map((m) => m.titolo)), tuttiDiversi(dati.map((m) => m.descrizione)), dati.every((m, i) => m.titolo === CATEGORIE[i].seo.titolo && m.descrizione === CATEGORIE[i].seo.descrizione)]);
  const senzaSeo = CATEGORIE.map((x) => S.metaCategoria({ ...x, seo: { titolo: null, descrizione: null } }));
  c("le stesse senza testo SEO: tutte diverse (modello con il nome), nessuna parola vietata", [true, true, []], [tuttiDiversi(senzaSeo.map((m) => m.titolo)), tuttiDiversi(senzaSeo.map((m) => m.descrizione)), senzaSeo.flatMap((m) => trovaParoleVietate(`${m.titolo} ${m.descrizione}`))]);
  c("non modifica la categoria (congelata: se scrivesse, lancerebbe)", 3, CATEGORIE.map((x) => S.metaCategoria(x)).length);

  // ── la home ──
  const h = S.metaHome();
  c("meta della home = quello del documento §3.14", { titolo: doc["meta.home.titolo"], descrizione: doc["meta.home.descrizione"] }, h);
  c("home: titolo ≤ 60, descrizione ≤ 155, nessuna parola vietata", [true, true, []], [h.titolo.length <= 60, h.descrizione.length <= 155, trovaParoleVietate(`${h.titolo} ${h.descrizione}`)]);
  c("la home non ha lo stesso meta di nessuna categoria", true, m6.every((m) => m.titolo !== h.titolo && m.descrizione !== h.descrizione));

  // ── l'immagine di condivisione ──
  const per = (slug, lista = CATALOGO) => lista.find((p) => p.slug === slug);
  const alfa = per("patch-prova-alfa");
  const principale = alfa.media.find((m) => m.slot === "principale").src.w1600;
  c("scheda: l'immagine scelta nel CMS (https) vince", "https://prova.test/seo/condivisione.jpg", S.immagineCondivisione({ prodotto: { ...alfa, seo: { ...alfa.seo, immagine: "https://prova.test/seo/condivisione.jpg" } } }));
  c("scheda: senza immagine SEO, la foto principale a 1600 (mai il logo)", principale, S.immagineCondivisione({ prodotto: alfa }));
  c("scheda: un'immagine SEO non https (http, relativa, vuota) si salta: si torna alla foto principale", [principale, principale, principale], ["http://prova.test/a.jpg", "/a.jpg", ""].map((u) => S.immagineCondivisione({ prodotto: { ...alfa, seo: { ...alfa.seo, immagine: u } } })));
  c("scheda senza foto e senza immagine SEO → nessuna immagine (null)", null, S.immagineCondivisione({ prodotto: per("patch-prova-alfa", CATALOGO_SENZA_FOTO) }));
  c("scheda con la foto principale solo come video → null (il video non è un'immagine)", null, S.immagineCondivisione({ prodotto: { ...alfa, media: alfa.media.filter((m) => m.slot === "video") } }));
  c("home: l'immagine di condivisione dello slot vince", "https://prova.test/slot/condivisione.jpg", S.immagineCondivisione({ condivisione: "https://prova.test/slot/condivisione.jpg", heroFoto: "https://prova.test/slot/hero.jpg" }));
  c("home: senza quella, la foto dell'hero (SLOT_SHOP: «senza: si usa la foto dell'hero»)", "https://prova.test/slot/hero.jpg", S.immagineCondivisione({ condivisione: null, heroFoto: "https://prova.test/slot/hero.jpg" }));
  c("home: condivisione non https → l'hero; niente di valido → null", ["https://prova.test/slot/hero.jpg", null, null, null], [
    S.immagineCondivisione({ condivisione: "http://x.test/a.jpg", heroFoto: "https://prova.test/slot/hero.jpg" }),
    S.immagineCondivisione({ condivisione: "", heroFoto: undefined }),
    S.immagineCondivisione({}),
    S.immagineCondivisione(undefined),
  ]);
  c("l'indirizzo dell'immagine non viene alterato", "https://prova.test/slot/hero.jpg?v=2", S.immagineCondivisione({ heroFoto: "https://prova.test/slot/hero.jpg?v=2" }));

  // ── l'indirizzo canonico ──
  const SITO = "https://sito.prova.test";
  c("pagina normale", `${SITO}/shop/c/patch-pronte`, S.canonical("/shop/c/patch-pronte", SITO));
  c("i filtri e ogni parametro non fanno parte dell'indirizzo canonico (una categoria filtrata punta alla categoria)", `${SITO}/shop/c/patch-pronte`, S.canonical("/shop/c/patch-pronte?colore=nero,castano&disp=1", SITO));
  c("niente ancora (#)", `${SITO}/shop/prodotto/alfa`, S.canonical("/shop/prodotto/alfa#recensioni", SITO));
  c("senza barra finale e senza barre doppie", [`${SITO}/shop`, `${SITO}/shop/c/x`], [S.canonical("/shop/", SITO), S.canonical("/shop//c///x/", SITO)]);
  c("senza barra iniziale la si mette; la radice resta «/»", [`${SITO}/shop`, `${SITO}/`, `${SITO}/`], [S.canonical("shop", SITO), S.canonical("/", SITO), S.canonical("", SITO)]);
  c("il sito con la barra finale non la raddoppia", `${SITO}/shop`, S.canonical("/shop", `${SITO}/`));
  c("NON ESCE DAL SITO: un indirizzo completo o «//altro.test» tiene solo il percorso; uno schema strano resta dentro il sito", [`${SITO}/shop`, `${SITO}/shop`, true],
    [S.canonical("https://altro.test/shop", SITO), S.canonical("//altro.test/shop", SITO), S.canonical("javascript:alert(1)", SITO).startsWith(`${SITO}/`)]);
  c("la codifica del percorso resta com'è", `${SITO}/shop/c/colle%20e-remover`, S.canonical("/shop/c/colle%20e-remover?x=1", SITO));

  // ── la ricerca non si indicizza ──
  c("la ricerca è noindex", { name: "robots", content: "noindex" }, S.robotsCerca());
  c("ogni chiamata dà un oggetto nuovo (nessuno può rovinare quello di un altro)", false, S.robotsCerca() === S.robotsCerca());

  // ── il sorgente ──
  const sorgente = readFileSync(join(radice, "src/shop/cms/vetrina-seo.ts"), "utf8");
  const senzaCommenti = sorgente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  c("il modulo è puro: niente window, document, fetch, Date, Math.random, console, storage", [], senzaCommenti.match(/\b(window|document|fetch|localStorage|sessionStorage|navigator|Date|console)\b|Math\.random/g) ?? []);
  c("importa solo i testi dello shop e i tipi", [], (senzaCommenti.match(/^\s*import\s.*$/gm) ?? []).filter((r) => !/from "@\/landing\/testi-shop"/.test(r) && !/^\s*import type\b/.test(r)));
  c("l'indirizzo dello studio non è scritto nel modulo", [], trovaParoleVietate(sorgente).filter((p) => /scipioni/i.test(p)));
}
