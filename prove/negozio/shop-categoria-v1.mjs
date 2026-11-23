/** ── VETRINA V1 · T95 · LA PAGINA DI CATEGORIA ────────────────────────────────────────────────────────────
 *  `src/routes/shop.c.$slug.tsx` (loader, `validateSearch`, `head`) e `src/components/shop/pagine/PaginaCategoria.tsx` (disegno). Criteri V1-C1, V1-C2, V1-C3, V1-T8, V1-T15.
 *  Cosa deve valere: con `codice` niente cambia (`notFound`, zero chiamate); senza prodotti pubblicati rimanda a `/shop`; il loader dà card LEGGERE
 *  (niente descrizioni, FAQ, media); `validateSearch` lascia passare le chiavi dei filtri e non c'è `loaderDeps`; contenitore `px-4 min-[360px]:px-6`
 *  e nessun antenato con `overflow` sopra la barra «Filtra»; la foto 4:3 solo da 768 px; «Non sai quale scegliere?» è un link, mai pieno; un solo H1;
 *  nessuna parola vietata, nessun «da confermare», nessun indirizzo dello studio; il guscio non si monta qui (T93).
 *  Due modi: il MARCHIO reso (`_rende.mjs`) e il sorgente per ciò che gli effetti non mostrano (`ViewContent`). Dati inventati. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as D from "./_dati-vetrina.mjs";
import { rendi, rendiComponente } from "./_rende.mjs";

const PAGINA = "src/components/shop/pagine/PaginaCategoria.tsx";
const ROTTA = "src/routes/shop.c.$slug.tsx";
const senzaCommenti = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const testo = (h) => h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const conta = (t, ago) => t.split(ago).length - 1;

/** Le classi di tutti gli antenati di un elemento (il primo tag che contiene `segno`), con un piccolo contatore di tag aperti. */
function antenati(html, segno) {
  const i = html.indexOf(segno);
  if (i < 0) return null;
  const pila = [];
  for (const m of html.slice(0, i).matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)([^>]*?)(\/?)>/g)) {
    const [, chiude, nome, resto, auto] = m;
    if (/^(img|br|hr|input|link|meta|path|circle|rect|line)$/i.test(nome) || auto) continue;
    if (chiude) pila.pop();
    else pila.push({ nome, classi: (resto.match(/class="([^"]*)"/) ?? [, ""])[1] });
  }
  return pila;
}

/** La riga leggera che il loader deve dare (la stessa forma di `leggeroDaPubblico`). */
const leggero = (CARD, p) => ({ sku: p.sku, card: CARD.cardDaPubblico(p), varianti: p.varianti, opzioni: p.opzioni });

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("VETRINA V1 · T95 · LA PAGINA DI CATEGORIA (23/11/2026)");
  const leggi = (f) => (existsSync(join(radice, f)) ? readFileSync(join(radice, f), "utf8") : "");
  const pagina = senzaCommenti(leggi(PAGINA));
  const rotta = senzaCommenti(leggi(ROTTA));
  const CARD = mod["shop/cms/vetrina-card"];
  const SEO = mod["shop/cms/vetrina-seo"];
  const EVT = mod["shop/cms/vetrina-eventi"];
  const ELE = mod["shop/cms/elenco"];
  c("i due file ci sono", [true, true], [pagina !== "", rotta !== ""]);

  const patch = D.CATALOGO.filter((p) => p.categorie.some((x) => x.slug === "patch-pronte"));
  const cura = D.CATALOGO.filter((p) => p.categorie.some((x) => x.slug === "cura"));
  const categorie = structuredClone(D.CATEGORIE);
  const contenuto = { testi: {}, media: {} };
  const server = (extra = {}) => ({
    elencoProdotti: ({ data }) => D.CATALOGO.filter((p) => p.categorie.some((x) => x.slug === data.categoria)),
    elencoCategorie: () => categorie,
    contenutoShop: () => contenuto,
    tariffaSpedizione: () => D.TARIFFA_OK,
    ...extra,
  });
  const dalloStato = (extra, modalita = "cms") => ({ context: { modalita }, loaderData: { categoria: categorie[0], meta: SEO.metaCategorie(categorie)[0], prodotti: patch.map((p) => leggero(CARD, p)), contenuto, tariffa: D.TARIFFA_OK }, server: server(extra), ...(extra?.__stato ?? {}) });
  const { route, pagina: reg } = await rendi(radice, ROTTA, { ...dalloStato(), params: { slug: "patch-pronte" } });
  const carica = async (slug, extra, modalita = "cms") => {
    const p = { ...dalloStato(extra), params: { slug } };
    globalThis.__pagina.server = p.server;
    globalThis.__pagina.chiamate.length = 0;
    return Promise.resolve(route.loader({ params: { slug }, context: { modalita } })).then((r) => ({ r, chiamate: [...reg.chiamate] }), (e) => ({ e, chiamate: [...reg.chiamate] }));
  };

  /* ── il loader ── */
  const cod = await carica("patch-pronte", {}, "codice");
  c("codice: `notFound` e nessuna chiamata al server (come oggi)", ["notFound", []], [cod.e?.message, cod.chiamate]);
  const ok = await carica("patch-pronte");
  c("cms: categoria, prodotti leggeri (uno per prodotto, nell'ordine ricevuto), contenuto e tariffa", [6, "patch-prova-alfa", "Patch pronte di prova", D.TARIFFA_OK.stato], [ok.r?.prodotti?.length, ok.r?.prodotti?.[0]?.card?.slug, ok.r?.categoria?.nome, ok.r?.tariffa?.stato]);
  c("cms: ogni riga è `leggeroDaPubblico` (card, SKU, varianti, opzioni) e basta", true, JSON.stringify(ok.r?.prodotti) === JSON.stringify(patch.map((p) => leggero(CARD, p))) && ok.r.prodotti.every((p) => Object.keys(p).sort().join() === "card,opzioni,sku,varianti"));
  const grezzo = JSON.stringify(ok.r?.prodotti ?? []);
  c("cms: nel loader non viaggiano descrizioni, FAQ, media né il prezzo di Invisible Derm", false, /descrizioneLunga|"faq"|"media"|perChi|"seo"/.test(grezzo));
  c("cms: il loader chiede i quattro dati e nient'altro", ["contenutoShop", "tariffaSpedizione", "elencoProdotti", "elencoCategorie"], ok.chiamate);
  const inesist = await carica("non-esiste");
  c("categoria che non esiste → rimanda a /shop", "/shop", inesist.e?.redirect?.to);
  const vuota = await carica("senza-prodotti");
  c("categoria senza prodotti pubblicati → rimanda a /shop (V1-C3)", "/shop", vuota.e?.redirect?.to);
  const guasto = await carica("patch-pronte", { elencoProdotti: () => { throw new Error("giù"); } });
  c("se il server dei prodotti non risponde non è un errore al pubblico: rimanda a /shop", "/shop", guasto.e?.redirect?.to);
  const guastoAltri = await carica("patch-pronte", { contenutoShop: () => { throw new Error("giù"); }, tariffaSpedizione: () => { throw new Error("giù"); } });
  c("contenuto o tariffa che non rispondono: la pagina c'è, con contenuto vuoto e tariffa assente", [{ testi: {}, media: {} }, { stato: "assente" }], [guastoAltri.r?.contenuto, guastoAltri.r?.tariffa]);

  /* ── l'indirizzo: i filtri passano, nessun `loaderDeps` ── */
  const chiavi = { colore: "nero", lunghezza: "30-cm", misura: 40, base: "lace", taglia: "m", disp: 1, utm_source: "ads" };
  c("`validateSearch` lascia passare colore, lunghezza, misura, base, altre opzioni, disp e gli utm", chiavi, route.validateSearch?.(chiavi));
  c("nessun `loaderDeps` (un filtro non rifà il loader)", false, /loaderDeps/.test(rotta) || "loaderDeps" in route);

  /* ── la `head` ── */
  const testa = route.head({ loaderData: ok.r, params: { slug: "patch-pronte" } });
  const meta = (n) => testa.meta.find((m) => m.name === n || m.property === n)?.content;
  c("head: senza dati (codice) solo `meta` vuoto", { meta: [] }, route.head({ params: { slug: "x" } }));
  c("head: titolo e descrizione sono quelli del CMS (D97), suffisso «| Hair Genius Shop» come scheda e carrello, canonical senza parametri", ["Patch pronte di prova | titolo di prova | Hair Genius Shop", "Descrizione di prova della categoria Patch pronte di prova.", "https://hair-genius-hub.hair/shop/c/patch-pronte"], [testa.meta.find((m) => m.title)?.title, meta("description"), testa.links[0].href]);
  c("head: un titolo del CMS che ha già «Hair Genius» non si raddoppia", "Patch | Hair Genius Labs", route.head({ loaderData: { ...ok.r, meta: { titolo: "Patch | Hair Genius Labs", descrizione: "d" } }, params: { slug: "patch-pronte" } }).meta.find((m) => m.title)?.title);
  //  due categorie che nel CMS hanno lo STESSO testo SEO: il loader dà meta diversi (T77 `metaCategorie`, D97 «mai uguali», V1-C3)
  const doppie = [{ ...categorie[0], seo: { titolo: "Stesso titolo", descrizione: "Stessa descrizione" } }, { ...categorie[1], seo: { titolo: "Stesso titolo", descrizione: "Stessa descrizione" } }];
  const dA = await carica("patch-pronte", { elencoCategorie: () => doppie });
  const dB = await carica("cura", { elencoCategorie: () => doppie });
  c("loader: due categorie con lo stesso testo SEO nel CMS hanno meta diversi; la prima tiene il suo", [true, true, "Stesso titolo"], [dA.r?.meta.titolo !== dB.r?.meta.titolo && dA.r?.meta.descrizione !== dB.r?.meta.descrizione, dB.r?.meta.titolo.length > 0, dA.r?.meta.titolo]);
  const slugDoc = ["patch-pronte", "shampoo-e-balsami", "districanti", "colle-e-remover", "spazzole", "kit"];
  const sei = slugDoc.map((x) => ({ slug: x, nome: x, tipo: "categoria", frase: null, foto: null, fotoAlt: null, seo: { titolo: null, descrizione: null }, ordine: 0, quanti: 1 }));
  const metaSei = SEO.metaCategorie(sei);
  c("meta delle sei categorie del documento tutti diversi (titolo e descrizione)", [6, 6], [new Set(metaSei.map((m) => m.titolo)).size, new Set(metaSei.map((m) => m.descrizione)).size]);
  const ostile = route.head({ loaderData: { ...ok.r, prodotti: ok.r.prodotti.map((p, i) => (i === 0 ? { ...p, card: { ...p.card, nome: "</script><script>alert(1)</script>" } } : p)) }, params: { slug: "patch-pronte" } });
  const json = ostile.scripts[0].children;
  c("head: dati strutturati ItemList con tutti i prodotti; un nome con `</script>` non chiude il tag e si rilegge identico", [6, false, "</script><script>alert(1)</script>"], (() => { try { const j = JSON.parse(json); return [j.itemListElement.length, /</.test(json), j.itemListElement[0].name]; } catch { return ["non si rilegge", null, null]; } })());
  const conImg = route.head({ loaderData: { ...ok.r, contenuto: { testi: {}, media: { "shop.condivisione": "https://prova.test/c.jpg" } } }, params: { slug: "patch-pronte" } });
  c("head: immagine di condivisione solo se c'è (nessuna inventata)", ["https://prova.test/c.jpg", undefined], [conImg.meta.find((m) => m.property === "og:image")?.content, testa.meta.find((m) => m.property === "og:image")?.content]);

  /* ── il disegno ── */
  const dati = (extra = {}) => ({ categoria: categorie[0], meta: SEO.metaCategorie(categorie)[0], prodotti: patch.map((p) => leggero(CARD, p)), contenuto, tariffa: D.TARIFFA_OK, ...extra });
  const disegna = async (d, search = {}) => (await rendiComponente(radice, PAGINA, "PaginaCategoria", { dati: d, search }, { server: {}, context: { modalita: "cms" } })).html;
  const h = await disegna(dati());
  const t = testo(h);
  c("un solo H1, col nome della categoria; la sua frase", [1, true, true], [conta(h, "<h1"), /<h1[^>]*>Patch pronte di prova<\/h1>/.test(h), t.includes("Frase di prova delle patch.")]);
  const nome0 = categorie[0];
  const hDoc = await disegna(dati({ categoria: { ...nome0, slug: "districanti", nome: "Districanti", frase: null } }));
  c("senza frase del CMS vale quella del documento (D97)", true, testo(hDoc).includes("Per sciogliere i nodi dei capelli della patch quando li pettini."));
  c("percorso: «Lo shop» è un link a /shop e la categoria è la pagina corrente", [true, true], [/<a [^>]*href="\/shop"[^>]*>Lo shop<\/a>/.test(h), /aria-current="page"[^>]*>Patch pronte di prova</.test(h)]);
  c("la fascia di fiducia ha le sole voci vere (studio, spedizione, consulenza), mai «da confermare»", [true, true, false], [t.includes("Studio a Roma"), /Spedizione: /.test(t), /da confermare/i.test(t)]);
  const iFoto = h.indexOf("categoria-patch-pronte-960");
  const antF = antenati(h, "categoria-patch-pronte-960") ?? [];
  c("foto della categoria: dal CMS, 4:3, dentro un riquadro `hidden md:block` (solo da 768 px), non `eager`", [true, true, true, false], [iFoto > 0, /aspect-ratio:\s*4\s*\/\s*3/.test(h), antF.some((a) => /\bhidden\b/.test(a.classi) && /\bmd:block\b/.test(a.classi)), /loading="eager"[^>]*categoria-patch-pronte|categoria-patch-pronte[^>]*loading="eager"/.test(h)]);
  const hSenzaFoto = await disegna(dati({ categoria: { ...nome0, foto: null, fotoAlt: null } }));
  c("senza foto della categoria la fascia è solo testo (nessun riquadro)", false, /categoria-patch-pronte-960/.test(hSenzaFoto));
  const altUno = await disegna(dati({ categoria: { ...nome0, fotoAlt: null }, prodotti: [dati().prodotti[0]] }));
  const altSei = await disegna(dati({ categoria: { ...nome0, fotoAlt: null } }));
  c("alt di ripiego (senza descrizione del CMS): «1 prodotto» al singolare, «6 prodotti» al plurale", [true, true, false], [/alt="Patch pronte di prova: 1 prodotto in fila/.test(altUno), /alt="Patch pronte di prova: 6 prodotti in fila/.test(altSei), /1 prodotti/.test(altUno)]);
  c("fondo dei prodotti con trama (`bg-white-trama`), come la vetrina della home", true, /<section class="bg-white-trama text-ink">/.test(h));
  const nCard = conta(h, "<article");
  c("una card per prodotto, titoli al livello h2 (sotto l'H1); nessuna stella, barrato, sconto", [6, 6, 0, false], [nCard, conta(h, "<h2 class=\"line-clamp-2"), conta(h, "lucide-star"), /line-through/.test(h)]);
  const hCura = await disegna(dati({ categoria: categorie[1], prodotti: cura.map((p) => leggero(CARD, p)) }));
  const derm = hCura.slice(hCura.indexOf("invisible-derm-prova") - 200);
  c("Invisible Derm: nessuna cifra nella pagina e «Scopri»", [false, true], [/3[.,]?900|390000/.test(hCura), /Scopri/.test(derm)]);
  c("la prima card ha la foto `eager` con priorità alta, le altre `lazy` (D98)", [1, true], [(h.match(/<img[^>]*fetchPriority="high"/g) ?? []).length, conta(h, 'loading="lazy"') >= 5]);
  c("contenitore dei prodotti `px-4 min-[360px]:px-6`; la barra «Filtra» è `sticky` e nessun suo antenato ha `overflow` (T90, punto 4)", [true, true, []], (() => {
    const ant = antenati(h, "data-fuoco=\"filtri-tasto\"") ?? [];
    return [ant.some((a) => /max-w-7xl/.test(a.classi) && /(^|\s)px-4(\s|$)/.test(a.classi) && /min-\[360px\]:px-6/.test(a.classi)), /sticky top-14/.test(h), ant.filter((a) => /overflow/.test(a.classi)).map((a) => a.nome)];
  })());
  c("i filtri veri ci sono (barra «Filtra (0)» e colonna), senza filtri non c'è nemmeno la barra (V1-C2)", [true, false], [t.includes("Filtra (0)"), /Filtra \(/.test(testo(await disegna(dati({ prodotti: patch.filter((p) => p.opzioni.length === 0).map((p) => leggero(CARD, p)) }))))]);
  //  una scelta che nessun prodotto soddisfa: due valori che non stanno mai nella stessa variante (la lettura dell'indirizzo è di T77)
  const FIL = mod["shop/cms/vetrina-filtri"];
  const righe = patch.map((p) => leggero(CARD, p));
  const gruppi = FIL.gruppiDaProdotti(righe).filter((g) => g.tipo !== "interruttore");
  let nessuno = null;
  for (const a of gruppi) for (const b of gruppi) for (const va of a.valori) for (const vb of b.valori) {
    if (nessuno || a.chiave >= b.chiave) continue;
    const stato = { valori: { [a.chiave]: [va.chiave], [b.chiave]: [vb.chiave] }, disponibile: false };
    if (FIL.applicaFiltri(righe, stato).length === 0) nessuno = Object.fromEntries(new URLSearchParams(FIL.scriviFiltri(stato)));
  }
  const hFiltro = await disegna(dati(), { ...nessuno, colore_ignoto: "x" });
  c("un filtro dell'indirizzo che toglie tutto → stato vuoto con «Azzera filtri», zero card; un parametro estraneo non rompe", [true, 0, true, true], [!!nessuno, conta(hFiltro, "<article"), /Con questi filtri non c.è niente/.test(testo(hFiltro)), /Azzera filtri/.test(testo(hFiltro))]);
  c("il blocco finale: titolo, testo, e «Consulenza gratuita →» è un bottone-link (mai pieno), non c'è alcun pieno nella pagina", [true, true, false], [/Non sai quale scegliere\?/.test(t) && /Una videochiamata con noi/.test(t), />Consulenza gratuita →<\/button>/.test(h) && /underline/.test(h.slice(h.indexOf("Consulenza gratuita →") - 400, h.indexOf("Consulenza gratuita →"))), /bg-\[#0A1430\][^"]*"[^>]*>\s*Consulenza gratuita/.test(h)]);
  const hSvuotato = await disegna(dati({ contenuto: { testi: { "shop.cat.blocco.titolo": "", "shop.cat.blocco.testo": "", "shop.cat.blocco.link": "" }, media: {} } }));
  c("un testo svuotato nel CRM non si disegna: senza i tre testi il blocco sparisce (V1-T16)", false, /Non sai quale scegliere|Consulenza gratuita →/.test(hSvuotato));
  c("nessuna parola vietata, nessun «da confermare», nessun `{{`, nessun indirizzo dello studio", [[], false, false], [D.trovaParoleVietate(t), /da confermare|\{\{/i.test(h), /Scipioni|Via degli/i.test(h)]);

  /* ── il sorgente ── */
  c("la pagina non monta il guscio (header, piè di pagina, barre: T93) e non legge il server da sé", [false, false], [/ShopHeader|FooterShop|BarreFisse|BarraConsulenza|GuscioShop/.test(pagina), /createServerFn|\.functions"/.test(pagina)]);
  c("la fascia di fiducia viene solo da `vociDellaFascia` (mai `vociFiducia` con `fascia:` a mano)", [true, false], [/vociDellaFascia\(/.test(pagina), /vociFiducia\(|fascia:\s*\{/.test(pagina + rotta)]);
  c("la rotta ha `notFound()` con `codice` e `redirect({ to: \"/shop\" })`", [true, true], [/notFound\(\)/.test(rotta), /redirect\(\{\s*to:\s*"\/shop"/.test(rotta)]);
  c("`ViewContent` di lista: `product_group`, una volta per visita (`emettiUnaVolta`), riprova dopo la scelta sul banner (`suScelta`) e la pulizia è restituita", [true, true, true, true], [/emettiEvento\(\s*"ViewContent",\s*\{\s*contentType:\s*"product_group"/.test(pagina), /emettiUnaVolta\(/.test(pagina), /suScelta\(window, EVENTO_CONSENSO/.test(pagina), /return\s+suScelta\(/.test(pagina)]);
  // gli SKU dell'evento = quelli di `eventoListaCategoria` (T79) sugli stessi prodotti
  const voci = mod["shop/cms/elenco"].vociDaPubblici(patch);
  const atteso = EVT.eventoListaCategoria(voci, "Patch pronte di prova")?.dati?.contentIds;
  c("gli SKU di `ViewContent` sono quelli di `eventoListaCategoria` (senza Invisible Derm)", true, JSON.stringify(atteso) === JSON.stringify(patch.filter((p) => !/invisible/i.test(p.nome + p.slug)).map((p) => p.sku)) && !!ELE);
  c("i testi della pagina non sono scritti nel sorgente (solo `testi-shop` e il contenuto dello shop)", false, /Non sai quale scegliere|Consulenza gratuita|Una videochiamata|Filtra\b/.test(pagina));
}
