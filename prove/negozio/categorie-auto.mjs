/** ── EDITOR PRODOTTI · E16 · «METTI LE CATEGORIE»: LA MAPPA, L'AGGIUNTA, LA RIPRESA ──────────────────────────
 *  Il titolare ha importato 82 prodotti da Shopify (il file non ha la colonna «Categories» né «Short Description»): ognuno restava fuori da «Pubblica»
 *  con «Mancano 3 cose» = categoria, descrizione breve, canale acceso. Si prova, con server finto e senza rete:
 *   · i tre bloccanti veri di un prodotto importato (la funzione `controllaPubblicazione` con ciò che scrive l'import);
 *   · la mappa nome → categoria su TUTTI gli 82 titoli del file (solo i titoli e il Type: nessun dato di clienti), nessuno senza proposta;
 *   · le categorie nuove si creano una volta sola, e quelle che esistono già (anche con altro nome) non si ricreano;
 *   · le categorie si AGGIUNGONO a quelle che il prodotto ha già (mai sostituite);
 *   · la descrizione breve e il canale «sito» si riempiono solo dove sono vuoti, e solo sulle bozze;
 *   · barra di avanzamento, gruppi di 5, ripresa dopo un errore solo sui mancanti;
 *   · la finestra e il tasto nell'elenco (sorgente). */
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const carica = async (radice, file) => {
  const r = await build({ entryPoints: [join(radice, file)], bundle: true, format: "esm", write: false, alias: { "@": join(radice, "src") }, logLevel: "silent", platform: "neutral" });
  return import(`data:text/javascript;base64,${Buffer.from(r.outputFiles[0].text).toString("base64")}`);
};

/** I titoli dei 82 prodotti del file di Shopify del titolare, con il suo «Type» (vuoto per 69). Nient'altro del file. */
const TITOLI = [
  ["ECHOSLINE COLOUR CARE MASK/ MASCHERA IDRATANTE", ""],
  ["ECHOSLINE COLOUR CARE SHAMPOO / SHAMPOO IDRATANTE", ""],
  ["BENESSERE CUTE", ""],
  ["ECHOSLINE CURL MOUSSE / MOUSSE MODELLA RICCI", ""],
  ["BANDIDO HAIRSPRAY COCONUT / LACCA PER STYLING", ""],
  ["GOLD BALANCE KIT / 2 PEZZI", "PROTESI CAPELLI"],
  ["ATENA INVISIBLE KIT / 2 PEZZI", "PROTESI CAPELLI"],
  ["GHOST BOND XL WATERMELON 38ml", ""],
  ["PROFESIA CURL CARE / FLUIDO RICCI", ""],
  ["CURL ACTIVATOR / SPRAY ATTIVA RICCI", ""],
  ["MOST LOVED BEST SELLER KIT PROMO", ""],
  ["SUPER GLUE+PENNELLO KIT PROMO", ""],
  ["PULIZIA COMPLETA KIT PROMO", ""],
  ["BRONZE ACTIVE KIT / 2 PEZZI", "PROTESI CAPELLI"],
  ["STYLING DUO KIT PROMO", ""],
  ["EXTENDA BOND (3/4'' x 3yards)", ""],
  ["SUPER STICK (3/4'' x 3yards)", ""],
  ["PROFÉSIA HAIR THERAPY / SHAMPOO IDRATANTE CON OLIO D'ARGAN", ""],
  ["ECHOSLINE HYDRATING WHIPPED CREAM / MOUSSE SENZA RISCIACQUO", ""],
  ["GHOST BOND XL PEACH 38ml", ""],
  ["GHOST BOND XL COCONOUT 38ml", ""],
  ["PROFÉSIA DRY HAIR CARE / MASCHERA CON PROTEINE DEL LATTE", ""],
  ["PROFÉSIA HAIR THERAPY / MASCHERA IDRATANTE CON OLIO D'ARGAN", ""],
  ["ECHOSLINE KI-POWER VEG MASK / MASCHERA NUTRIENTE", ""],
  ["ECHOSLINE KI-POWER VEG SHAMPOO / SHAMPOO IDRATANTE", ""],
  ["BANDIDO PEARLY HAIR GEL CRAZY / GEL PER PROTESI CAPELLI", ""],
  ["BANDIDO CREAMY MOUSSE / MOUSSE SENZA RISCIACQUO", ""],
  ["PROFÉSIA DRY HAIR CARE / SHAMPOO CON PROTEINE DEL LATTE", ""],
  ["ECHOSLINE ARGAN MASK / MASCHERA NUTRIENTE", ""],
  ["MAQUI 3 ALL-IN-OIL / OLIO IDRATANTE", ""],
  ["BANDIDO AQUA WAX 5 / CERA MODELLANTE PER PROTESI CAPELLI", ""],
  ["BANDIDO CLASSIC POMADE / CREMA MODELLANTE PER PROTESI CAPELLI", ""],
  ["BANDIDO CREAM POMADE / CREMA MODELLANTE PER PROTESI CAPELLI", ""],
  ["BANDIDO HAIR GEL ARGAN / GEL PER PROTESI CAPELLI", ""],
  ["BANDIDO PEARLY HAIR GEL CURVY / GEL PER PROTESI CAPELLI", ""],
  ["TOUCH UP PEN / PENNA PER RITOCCHI PER PROTESI CAPELLI", ""],
  ["BYE BYE RED / COLORE SEMIPERMANENTE ANTIROSSO CASTANO SCURO", ""],
  ["Opzione ritaglio impianto", ""],
  ["LACE FRONT (3/4” x 3yards)", ""],
  ["PROFESIA SPRAY / RICOSTRUZIONE MULTIAZIONE HAIR THERAPY 200ml", ""],
  ["ECHOSLINE MAQUI 3 HYDRA-BUTTER / MASCHERA IDRATANTE", ""],
  ["EASY RED TAPE / NASTRO PER PROTESI CAPELLI", ""],
  ["DISCHETTI 100% COTONE", ""],
  ["PROTESI CAPELLI BRONZE", "PROTESI CAPELLI"],
  ["PROTESI CAPELLI GOLD", "PROTESI CAPELLI"],
  ["PERFECT REMOVER / SOLVENTE PER RIMOZIONE DI COLLE E TAPE PER PROTESI CAPELLI", ""],
  ["FAST CLEAN ACTION / SOLVENTE SPRAY MULTIUSO PER PROTESI CAPELLI", ""],
  ["GHOST BOND XL / COLLA ALL'ACQUA PER PROTESI CAPELLI", ""],
  ["GHOST BOND PLATINUM / COLLA ALL'ACQUA PER PROTESI CAPELLI", ""],
  ["ULTRA HOLD (3/4'' x 3yards)", ""],
  ["SUPER GLUE / COLLA ACRILICA PER PROTESI CAPELLI", ""],
  ["PENNELLO 5PZ - Small", ""],
  ["PENNELLO 5PZ - Big", ""],
  ["ARGILLA BIO CARBONE", ""],
  ["HYDRA BOOST / SPRAY DISTRICANTE E IDRATANTE PER PROTESI CAPELLI", ""],
  ["SUPER GLUE MATT / COLLA ACRILICA OPACA PER PROTESI CAPELLI", ""],
  ["ULTRA HOLD (3/4” x 12yards)", ""],
  ["ULTRA HOLD (1” x 3yards)", ""],
  ["ULTRA HOLD (1” x 12yards)", ""],
  ["SENSI-TAK (3/4” x 3yards)", ""],
  ["QUICK AGGRESSIVE (3/4” x 3yards)", ""],
  ["PRO-FLEX (3/4” x 3yards)", ""],
  ["NO SHINE (3/4” x 3yards)", ""],
  ["NO SHINE (1” x 3yards)", ""],
  ["SCALP PROTECTOR", ""],
  ["SCALP PROTECTOR MAX HOLD SPORT", ""],
  ["SCALP PROTECTOR SPRAY", ""],
  ["HYPER HOLD", ""],
  ["LACE FRONT HOLD", ""],
  ["STICK-IT", ""],
  ["SUPER LACE", ""],
  ["LACE FRONT THIN", ""],
  ["ULTRA HOLD MINI'S", ""],
  ["ULTRA HOLD", ""],
  ["PROTESI CAPELLI ZEUS", "PROTESI CAPELLI"],
  ["PROTESI CAPELLI ARTEMIDE", "PROTESI CAPELLI"],
  ["PROTESI CAPELLI AFRODITE", "PROTESI CAPELLI"],
  ["PROTESI CAPELLI EROS", "PROTESI CAPELLI"],
  ["PROTESI CAPELLI POSEIDONE", "PROTESI CAPELLI"],
  ["PROTESI CAPELLI DEMETRA", "PROTESI CAPELLI"],
  ["PROTESI CAPELLI ARES", "PROTESI CAPELLI"],
  ["PROTESI CAPELLI ATENA", "PROTESI CAPELLI"],
];

const leggi = (radice, file) => readFileSync(join(radice, file), "utf8");
const senzaCommenti = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");
const nuovoPronto = (id, o = {}) => ({ id, nome: `Prodotto ${id}`, ...o });

/** Il server finto: tiene i prodotti e le categorie, conta le richieste in volo, rifiuta una versione vecchia (409) come il vero. */
function serverFinto({ prodotti, categorie = [], guasto = () => null }) {
  const db = new Map(
    prodotti.map((p) => [p.id, { stato: "bozza", versione: "v0", categorie: [], breve: "", seo: "", lunga: "", canali: { sito: false, meta: false, google: false, tiktok: false }, bloccanti: [], ...p }]),
  );
  const cat = categorie.map((k) => ({ ...k }));
  const log = [];
  let inVolo = 0;
  let massimo = 0;
  const giro = async (f) => {
    inVolo++;
    massimo = Math.max(massimo, inVolo);
    await new Promise((r) => setTimeout(r, 1));
    try { return f(); } finally { inVolo--; }
  };
  const no = (tipo, messaggio = "Errore del server finto.") => ({ ok: false, errore: { tipo, messaggio } });
  const sale = (p) => { p.versione = `v${Number(p.versione.slice(1)) + 1}`; return p.versione; };
  const esegui = (azione, dati = {}) =>
    giro(() => {
      log.push({ azione, dati });
      const g = guasto(azione, dati, log.length);
      if (g) return g;
      if (azione === "categoria_salva") {
        if (cat.some((k) => k.slug === dati.slug)) return no("duplicato", "Questo indirizzo è già usato da un'altra categoria.");
        const k = { id: `cat-${cat.length + 1}`, slug: dati.slug, nome: dati.nome };
        cat.push(k);
        return { ok: true, dati: { categoria: { id: k.id, slug: k.slug, versione: "2026-11-28T10:00:00Z" } } };
      }
      const p = db.get(dati.prodottoId);
      if (!p) return no("non_trovato");
      if (dati.versione !== p.versione) return no("conflitto", "Il prodotto è stato modificato da qualcun altro.");
      if (azione === "prodotto_categorie") {
        if (!dati.categorie.every((id) => cat.some((k) => k.id === id))) return no("categoria_inesistente");
        p.categorie = [...dati.categorie];
        return { ok: true, dati: { categorie: p.categorie, cambiato: true, versione: sale(p) } };
      }
      if (azione === "prodotto_salva") {
        if ("descrizioneBreve" in dati.campi) p.breve = dati.campi.descrizioneBreve;
        if ("canali" in dati.campi) p.canali = { ...dati.campi.canali };
        return { ok: true, dati: { cambiati: Object.keys(dati.campi), versione: sale(p) } };
      }
      return no("valore");
    });
  const scheda = (id) =>
    giro(() => {
      log.push({ azione: "scheda", dati: { id } });
      const g = guasto("scheda", { id }, log.length);
      if (g) return g;
      const p = db.get(id);
      if (!p) return no("non_trovato");
      return { ok: true, scheda: { prodotto: { stato: p.stato, descrizioneBreve: p.breve, descrizioneLunga: p.lunga, seoDescrizione: p.seo, canali: p.canali }, versione: p.versione, categorie: [...p.categorie], controllo: { bloccanti: p.bloccanti, informativi: [] }, varianti: [], media: [], storico: [] } };
    });
  const categorie_ = () =>
    giro(() => {
      log.push({ azione: "categorie", dati: {} });
      const g = guasto("categorie", {}, log.length);
      return g ?? { ok: true, dati: { categorie: cat.map((k) => ({ ...k })) } };
    });
  return { porte: { esegui, scheda, categorie: categorie_ }, db, cat, log, massimo: () => massimo, scritture: () => log.filter((x) => ["categoria_salva", "prodotto_categorie", "prodotto_salva"].includes(x.azione)) };
}

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("EDITOR PRODOTTI · E16 · METTI LE CATEGORIE (28/11/2026)");
  const A = await carica(radice, "src/crm/ecommerce/prodotti/categorie-auto.ts").catch((e) => ({ errore: String(e) }));
  c("categorie-auto.ts si compila e si carica", undefined, A.errore);
  if (A.errore) return;
  const F = await carica(radice, "src/crm/ecommerce/prodotti/categorie-auto-flusso.ts").catch((e) => ({ errore: String(e) }));
  c("categorie-auto-flusso.ts si compila e si carica", undefined, F.errore);
  if (F.errore) return;

  /* ── 1. I tre bloccanti veri di un prodotto importato da Shopify ── */
  const CSV = await carica(radice, "src/crm/negozio/csv-prodotti.ts");
  const PUB = await carica(radice, "src/shop/cms/pubblicazione.ts");
  const intestazione = ["Handle", "Title", "Body (HTML)", "Vendor", "Product Category", "Type", "Option1 Name", "Option1 Value", "Variant SKU", "Variant Grams", "Variant Inventory Qty", "Variant Price", "Image Src", "Image Alt Text", "SEO Description", "Status"];
  const riga = { Handle: "echosline-argan-mask", Title: "ECHOSLINE ARGAN MASK / MASCHERA NUTRIENTE", "Body (HTML)": "<p>Maschera nutriente. Per capelli secchi.</p>", Vendor: "Echosline", "Option1 Name": "Title", "Option1 Value": "Default Title", "Variant SKU": "ECH-ARG", "Variant Grams": "250", "Variant Inventory Qty": "4", "Variant Price": "19,90", "Image Src": "https://cdn.shopify.com/s/files/1/0001/a.png", "SEO Description": "Maschera nutriente all'argan per capelli secchi.", Status: "active" };
  const lettura = CSV.leggiProdottiCsv([intestazione, intestazione.map((h) => riga[h] ?? "")], { categorie: [] });
  const imp = lettura.prodotti[0];
  c("il file di Shopify entra: nessun errore, nessuna categoria e nessuna descrizione breve nel prodotto importato", [1, 0, [], undefined], [lettura.prodotti.length, lettura.errori.length, imp.categorie, imp.descrizioneBreve]);
  // quello che scrive `shop_import_prodotto` (migrazione 20261128120000): canali non scritti → il valore di partenza della tabella, `{}`
  const prodImportato = { id: "x", sku: imp.sku, nome: imp.titolo, slug: imp.handle, prezzoCent: imp.prezzoCent, rigaPresentazione: null, descrizioneBreve: imp.descrizioneBreve ?? null, descrizioneLunga: imp.descrizioneLunga ?? null, perChi: null, caratteristiche: [], passi: [], confezione: [], avvertenze: [], faq: [], canali: {}, seoTitolo: null, seoDescrizione: imp.seoDescrizione ?? null };
  const fotoIn = [{ id: "m", slot: "principale", tipo: "foto", alt: "Maschera Echosline Argan", muto: true, sottotitoliOk: false, ritraePersone: false, liberatoriaOk: false, rimossoIl: null, pathCopertina: null }];
  const vsIn = imp.varianti.map((v) => ({ sku: v.sku, nome: v.nome, prezzoCent: v.prezzoCent, attiva: true }));
  const esitoIn = PUB.controllaPubblicazione(prodImportato, vsIn, fotoIn, [], { spedizioneImpostata: null, tuttiGliSku: [] });
  c("i TRE bloccanti di un prodotto importato (con la foto già salita): categoria, descrizione breve, canale", ["categoria", "descrizioneBreve", "canali"], esitoIn.bloccanti.map((b) => b.campo));
  c("con le tre cose sistemate il prodotto non ha più bloccanti", [], PUB.controllaPubblicazione({ ...prodImportato, descrizioneBreve: A.proponiBreve(imp.seoDescrizione, imp.descrizioneLunga), canali: { sito: true, meta: false, google: false, tiktok: false } }, vsIn, fotoIn, ["id-categoria"], { spedizioneImpostata: null, tuttiGliSku: [] }).bloccanti);
  const sql = leggi(radice, "supabase/migrations/20261128120000_shop_import_250_varianti.sql");
  const inserisci = /INSERT INTO public\.shop_prodotti \(([\s\S]*?)\) VALUES/.exec(sql)?.[1] ?? "";
  c("la funzione SQL dell'import non scrive i canali (restano quelli di partenza) e le categorie arrivano solo da `p_categorie`", [false, true], [/canali/.test(inserisci), /INSERT INTO public\.shop_prodotti_categorie[\s\S]*unnest\(COALESCE\(p_categorie/.test(sql)]);
  c("la tabella parte con i canali tutti spenti: `canali jsonb NOT NULL DEFAULT '{}'`", true, /canali\s+jsonb NOT NULL DEFAULT '\{\}'::jsonb/.test(leggi(radice, "supabase/migrations/20261120120000_shop_catalogo.sql")));

  /* ── 2. La mappa nome → categoria sugli 82 titoli del file ── */
  const per = {};
  for (const [titolo, tipo] of TITOLI) (per[A.proponiCategoria(titolo, tipo) ?? "nessuna"] ??= []).push(titolo);
  const conta = Object.fromEntries(Object.entries(per).map(([k, v]) => [k, v.length]));
  c("il file ha 82 prodotti", 82, TITOLI.length);
  c("NESSUN titolo resta senza proposta", [], per.nessuna ?? []);
  c("i conteggi per categoria sugli 82 titoli", { "maschere-e-trattamenti": 12, shampoo: 4, styling: 11, toupee: 13, adesivi: 27, kit: 4, accessori: 5, solventi: 3, "protezione-cute": 3 }, conta);
  c("ogni proposta è una categoria dell'elenco", true, Object.keys(per).every((k) => A.CATEGORIE_AUTO.some((x) => x.slug === k)));
  c("i 13 con Type «PROTESI CAPELLI» vanno in Protesi, e sono gli stessi che il nome riconosce da solo", [13, 13], [TITOLI.filter(([, ty]) => ty === "PROTESI CAPELLI").length, TITOLI.filter(([t, ty]) => ty === "PROTESI CAPELLI" && A.proponiCategoria(t, null) === "toupee").length]);
  const prop = (t, ty) => A.proponiCategoria(t, ty);
  c("le parole più specifiche vincono: SCALP PROTECTOR SPRAY e MAX HOLD → Protezione cute (non spray, non colla)", ["protezione-cute", "protezione-cute"], [prop("SCALP PROTECTOR SPRAY"), prop("SCALP PROTECTOR MAX HOLD SPORT")]);
  c("SHAMPOO prima di HAIR THERAPY e di OLIO D'ARGAN", "shampoo", prop("PROFÉSIA HAIR THERAPY / SHAMPOO IDRATANTE CON OLIO D'ARGAN"));
  c("un solvente che cita colle e tape resta un solvente; «per protesi capelli» in coda non fa una protesi", ["solventi", "styling", "accessori"], [prop("PERFECT REMOVER / SOLVENTE PER RIMOZIONE DI COLLE E TAPE PER PROTESI CAPELLI"), prop("BANDIDO HAIR GEL ARGAN / GEL PER PROTESI CAPELLI"), prop("TOUCH UP PEN / PENNA PER RITOCCHI PER PROTESI CAPELLI")]);
  c("KIT PROMO vince su colla e pennello; il KIT / 2 PEZZI è una protesi", ["kit", "toupee"], [prop("SUPER GLUE+PENNELLO KIT PROMO"), prop("GOLD BALANCE KIT / 2 PEZZI")]);
  c("(x yards) è un nastro anche senza altre parole; minuscole e accenti non contano", ["adesivi", "shampoo", "maschere-e-trattamenti"], [prop("Qualcosa (1” x 3yards)"), prop("profésia shampoo"), prop("Maschera")]);
  c("la parola intera: GELATO non è un gel, HOLDER non è HOLD", [null, null], [prop("GELATO"), prop("HOLDER")]);
  c("un nome che nessuna regola riconosce non ha proposta (si sceglie dal menu); nome non testo → nessuna", [null, null, null], [prop("Prodotto misterioso"), prop(undefined), prop("")]);
  c("il tipo «patch» dello shop e il Type di Shopify in minuscolo portano alla Protesi, anche con un nome strano", ["toupee", "toupee"], [prop("Zeus", "patch"), prop("Zeus", "protesi capelli")]);
  c("una maschera «colore» è una maschera (COLORE è la parola più debole)", ["maschere-e-trattamenti", "accessori"], [prop("MASCHERA COLORE"), prop("BYE BYE RED / COLORE SEMIPERMANENTE")]);

  /* ── 3. Le categorie che esistono già e quelle da creare ── */
  const note = [{ id: "k-sh", slug: "shampoo", nome: "Shampoo" }, { id: "k-ma", slug: "maschere", nome: "Maschere e trattamenti" }, { id: "k-x", slug: "altro", nome: "Altro" }];
  c("si riconosce una categoria per indirizzo e, se l'indirizzo è un altro, per nome", ["k-sh", "k-ma", undefined], [A.trovaCategoria("shampoo", note)?.id, A.trovaCategoria("maschere-e-trattamenti", note)?.id, A.trovaCategoria("styling", note)?.id]);
  c("da creare: solo quelle che mancano, una volta sola, nell'ordine di comparsa", ["Styling", "Protezione cute"], A.categorieDaCreare(["shampoo", "styling", null, "protezione-cute", "styling", "maschere-e-trattamenti"], note).map((k) => k.nome));
  c("le categorie del catalogo (Protesi & Toupee, Shampoo, Adesivi & Nastri, Solventi & Remover, Accessori, Kit Completi) hanno gli indirizzi della migrazione", true, ["toupee", "shampoo", "adesivi", "solventi", "accessori", "kit"].every((s) => A.CATEGORIE_AUTO.some((k) => k.slug === s)) && leggi(radice, "supabase/migrations/20261120130000_shop_catalogo_import.sql").includes("'toupee', 'Protesi & Toupee'"));

  /* ── 4. La descrizione breve ── */
  c("breve = la descrizione per Google già salvata", "Shampoo idratante. Ideale per tutti i tipi di capelli.", A.proponiBreve("  Shampoo   idratante. Ideale per tutti i tipi di capelli. ", "Altro testo."));
  c("senza descrizione per Google: la prima frase della descrizione lunga", "Prolunga la durata del colore.", A.proponiBreve("", "Prolunga la durata del colore. Formula 100% Vegan."));
  const lunga = `${"Una frase di prova abbastanza lunga da riempire. ".repeat(5)}${"Seconda frase che fa superare i trecento segni del tetto. ".repeat(2)}Fine.`;
  const tagliata = A.proponiBreve(lunga, "");
  c("oltre 300 segni si taglia a fine frase (mai a metà parola)", [true, true], [tagliata.length <= 300, /[.!?]$/.test(tagliata)]);
  const senzaPunti = A.proponiBreve("parola ".repeat(80), "");
  c("senza fine di frase si taglia sull'ultima parola e finisce con i puntini", [true, true], [senzaPunti.length <= 300, senzaPunti.endsWith("…")]);
  c("niente da proporre → null; un testo che il negozio non pubblica (sconto) → null, non si scrive", [null, null], [A.proponiBreve("", ""), A.proponiBreve("Sconto del 20% oggi.", "")]);

  /* ── 5. Cosa si scrive su un prodotto letto: mai sovrascrivere ── */
  const sch = (o = {}) => ({ prodotto: { stato: "bozza", descrizioneBreve: "", seoDescrizione: "Ottimo prodotto per capelli.", descrizioneLunga: "Lunga.", canali: {}, ...o.prodotto }, versione: "v7", categorie: o.categorie ?? [], controllo: { bloccanti: o.bloccanti ?? [], informativi: [] } });
  const tutto = { breve: true, sito: true };
  const l0 = A.leggiProdotto(sch());
  c("la scheda letta: versione, stato, categorie, canali tutti spenti", ["v7", "bozza", [], false], [l0.versione, l0.stato, l0.categorie, Object.values(l0.canali).some(Boolean)]);
  c("una risposta senza la forma attesa non si indovina → null", [null, null, null], [A.leggiProdotto(null), A.leggiProdotto({ prodotto: {} }), A.leggiProdotto({ prodotto: {}, versione: "" })]);
  c("su una bozza vuota: aggiunge la categoria, scrive la breve, accende il sito", { aggiungi: ["k1"], breve: "Ottimo prodotto per capelli.", sito: true }, A.decidi(l0, "k1", tutto));
  c("con le opzioni spente non scrive né breve né sito", { aggiungi: ["k1"], breve: null, sito: false }, A.decidi(l0, "k1", { breve: false, sito: false }));
  const lPiena = A.leggiProdotto(sch({ prodotto: { descrizioneBreve: "La mia frase.", canali: { sito: false, meta: true, google: false, tiktok: false } }, categorie: ["k1", "k2"] }));
  c("MAI SOVRASCRIVERE: la breve già scritta resta, un canale già acceso blocca la regola, la categoria che c'è non si rimette", { aggiungi: [], breve: null, sito: false }, A.decidi(lPiena, "k1", tutto));
  c("una categoria nuova si aggiunge alle altre (l'insieme resta quello di prima più lei)", ["k3"], A.decidi(lPiena, "k3", tutto).aggiungi);
  c("un prodotto pubblicato non riceve breve né canale (andrebbero nelle «modifiche non pubblicate»)", { breve: null, sito: false }, (({ breve, sito }) => ({ breve, sito }))(A.decidi(A.leggiProdotto(sch({ prodotto: { stato: "pubblicato" } })), null, tutto)));
  c("il canale: anche un solo canale acceso (Meta) lascia il «sito» com'è", false, A.decidi(A.leggiProdotto(sch({ prodotto: { canali: { sito: false, meta: true } } })), null, tutto).sito);

  /* ── 6. «Da fare a mano» ── */
  const vf = (campo) => ({ campo, frase: `Manca ${campo}` });
  const lMano = A.leggiProdotto(sch({ bloccanti: [vf("fotoPrincipale"), vf("categoria"), vf("descrizioneBreve"), vf("canali")] }));
  const dMano = A.decidi(lMano, "k1", tutto);
  c("dopo le tre correzioni resta a mano solo ciò che non si può riempire da soli (la foto)", ["fotoPrincipale"], A.restaAMano(lMano, dMano).map((b) => b.campo));
  c("se la breve non si può proporre, o la categoria non è scelta, quelle restano a mano", ["categoria", "descrizioneBreve"], A.restaAMano(A.leggiProdotto(sch({ prodotto: { seoDescrizione: "", descrizioneLunga: "" }, bloccanti: [vf("categoria"), vf("descrizioneBreve")] })), A.decidi(A.leggiProdotto(sch({ prodotto: { seoDescrizione: "", descrizioneLunga: "" } })), null, tutto)).map((b) => b.campo));
  c("la frase «Da fare a mano»: una voce per campo, col numero di prodotti", "Da fare a mano: la foto principale (2 prodotti), la spedizione del negozio (costo e tempi) (1 prodotto).", A.fraseDaFareAMano([[vf("fotoPrincipale")], [vf("fotoPrincipale"), vf("spedizione")], []]));
  c("niente a mano → nessuna frase", null, A.fraseDaFareAMano([[], []]));

  /* ── 7. La lettura per l'anteprima: gruppi di 5, un errore non ferma gli altri ── */
  {
    const ids = Array.from({ length: 12 }, (_, i) => `p${i + 1}`);
    let guasto4 = true;
    const s = serverFinto({ prodotti: ids.map((id) => nuovoPronto(id)), guasto: (az, d) => (guasto4 && az === "scheda" && d.id === "p4" ? { ok: false, errore: { tipo: "server", messaggio: "Qualcosa non ha funzionato." } } : null) });
    const visti = [];
    const letti = await F.leggiTutti(s.porte, ids, (n, tot) => visti.push([n, tot]));
    c("letti 11 su 12: il quarto non si legge, con la frase del server; gli altri sì", [11, "Qualcosa non ha funzionato."], [Object.values(letti).filter((x) => x.ok).length, letti.p4.frase]);
    c("lettura a gruppi: mai più di 5 richieste insieme, e più di una", [true, true], [s.massimo() <= F.GRUPPO && F.GRUPPO === 5, s.massimo() > 1]);
    c("l'avanzamento della lettura arriva a 12 di 12, sempre in salita", [12, 12, true], [visti.at(-1)[0], visti.at(-1)[1], visti.every((v, i) => i === 0 || v[0] >= visti[i - 1][0])]);
    guasto4 = false;
    const prima = s.log.length;
    const ripresi = await F.leggiTutti(s.porte, ["p4"]);
    c("rileggere solo il mancante: una richiesta sola, e ora si legge", [1, true], [s.log.length - prima, ripresi.p4.ok]);
    const fermi = serverFinto({ prodotti: ids.map((id) => nuovoPronto(id)), guasto: (az, d) => (az === "scheda" && d.id === "p2" ? { ok: false, errore: { tipo: "sessione", messaggio: "La sessione è scaduta: rientra nel CRM." } } : null) });
    const lettiFermi = await F.leggiTutti(fermi.porte, ids);
    c("un errore che ferma tutto (sessione scaduta) ferma le letture dopo il gruppo: chi non è partito ha la stessa frase", [false, "La sessione è scaduta: rientra nel CRM."], [lettiFermi.p12.ok, lettiFermi.p12.frase]);
    c("e non si è chiesto niente oltre il primo gruppo", true, fermi.log.length <= 5);
  }

  /* ── 8. Le scritture: gruppi, aggiunta, categorie create una volta, ripresa ── */
  const note0 = [{ id: "k-sh", slug: "shampoo", nome: "Shampoo" }, { id: "k-vecchia", slug: "altro", nome: "Altro" }];
  const scelteDi = (ids, categoria) => ids.map((id) => ({ id, nome: `Prodotto ${id}`, categoria }));
  {
    const ids = Array.from({ length: 12 }, (_, i) => `p${i + 1}`);
    const s = serverFinto({ prodotti: ids.map((id) => nuovoPronto(id)), categorie: note0 });
    const passi = [];
    const fine = await F.applica(s.porte, scelteDi(ids, "shampoo"), { breve: false, sito: false }, F.corsaVuota(), { aggiorna: (cr) => passi.push(F.avanzamento(cr).fatti) });
    c("12 prodotti nella categoria che esiste: tutti fatti, nessuna categoria creata", [12, 0, 0], [Object.values(fine.esiti).filter((e) => e.stato === "fatto").length, fine.create.length, s.log.filter((x) => x.azione === "categoria_salva").length]);
    c("tutti hanno la categoria", true, ids.every((id) => s.db.get(id).categorie.includes("k-sh")));
    c("MAI 12 richieste tutte insieme: al massimo 5 in volo", [true, true], [s.massimo() <= 5, s.massimo() > 1]);
    c("la barra: fatti sempre in salita, fino a 12; percento 100 alla fine", [true, 12, 100], [passi.every((n, i) => i === 0 || n >= passi[i - 1]), passi.at(-1), F.avanzamento(fine).percento]);
  }
  {
    // AGGIUNGE senza sostituire
    const s = serverFinto({ prodotti: [nuovoPronto("a", { categorie: ["k-vecchia"] }), nuovoPronto("b", { categorie: ["k-sh"] }), nuovoPronto("c", { categorie: ["k-vecchia", "k-sh"] })], categorie: note0 });
    const fine = await F.applica(s.porte, scelteDi(["a", "b", "c"], "shampoo"), { breve: false, sito: false }, F.corsaVuota());
    const cat = s.scritture().filter((x) => x.azione === "prodotto_categorie");
    c("AGGIUNTA: «a» aveva Altro → ora Altro e Shampoo (non solo Shampoo)", ["k-vecchia", "k-sh"], s.db.get("a").categorie);
    c("la richiesta porta l'insieme di prima PIÙ la nuova, mai meno", ["k-vecchia", "k-sh"], cat.find((x) => x.dati.prodottoId === "a").dati.categorie);
    c("chi ha già la categoria (b, c) non riceve nessuna scrittura", [1, ["k-sh"], ["k-vecchia", "k-sh"]], [cat.length, s.db.get("b").categorie, s.db.get("c").categorie]);
    c("e risulta fatto lo stesso, senza categoria nuova", [true, true, false], [fine.esiti.a.categoria, fine.esiti.a.stato === "fatto", fine.esiti.b.categoria]);
  }
  {
    // categorie create UNA volta
    const ids = ["p1", "p2", "p3", "p4", "p5"];
    const scelte = [...scelteDi(["p1", "p2", "p3"], "styling"), ...scelteDi(["p4", "p5"], "protezione-cute")];
    let cadutaFatta = false;
    const s = serverFinto({
      prodotti: ids.map((id) => nuovoPronto(id)),
      categorie: [{ id: "k-ma", slug: "maschere", nome: "Maschere e trattamenti" }],
      guasto: (az, d) => (az === "prodotto_categorie" && d.prodottoId === "p2" && !cadutaFatta ? ((cadutaFatta = true), { ok: false, errore: { tipo: "server", messaggio: "Riprova tra un momento." } }) : null),
    });
    const fine = await F.applica(s.porte, scelte, { breve: false, sito: false }, F.corsaVuota());
    const create = s.log.filter((x) => x.azione === "categoria_salva");
    c("le due categorie nuove si creano UNA volta ciascuna (anche con 3 e 2 prodotti), col loro nome", [2, ["Styling", "Protezione cute"], ["styling", "protezione-cute"]], [create.length, create.map((x) => x.dati.nome), create.map((x) => x.dati.slug)]);
    c("si creano PRIMA di assegnarle; e non si chiede mai di renderle visibili (nascoste, come oggi)", [true, 0], [s.log.findIndex((x) => x.azione === "categoria_salva") < s.log.findIndex((x) => x.azione === "prodotto_categorie"), s.log.filter((x) => x.azione === "categoria_visibile").length]);
    c("la corsa ricorda cosa ha creato", ["styling", "protezione-cute"], fine.create);
    c("un errore su p2: gli altri 4 sono fatti, p2 è in errore con la frase del server", [4, "errore", "Riprova tra un momento."], [Object.values(fine.esiti).filter((e) => e.stato === "fatto").length, fine.esiti.p2.stato, fine.esiti.p2.frase]);
    c("mancanti = solo p2", ["p2"], F.mancanti(scelte, fine).map((x) => x.id));
    const prima = s.log.length;
    const dopo = await F.applica(s.porte, scelte, { breve: false, sito: false }, { ...fine, fermo: null });
    const nuove = s.log.slice(prima);
    c("RIPRENDI: la ripresa tocca solo p2 (nessuna scrittura su p1, p3, p4, p5) e non ricrea le categorie", [["p2"], 0], [[...new Set(nuove.filter((x) => x.dati.prodottoId).map((x) => x.dati.prodottoId))], nuove.filter((x) => x.azione === "categoria_salva").length]);
    c("dopo la ripresa tutti fatti, nessun errore, e il riepilogo lo dice", [5, 0, ["styling", "protezione-cute"]], [Object.values(dopo.esiti).filter((e) => e.stato === "fatto").length, F.riepilogo(scelte, dopo).errori.length, F.riepilogo(scelte, dopo).create]);
  }
  {
    // una categoria che esiste già con un altro nome/indirizzo non si ricrea; e se un altro la crea nel frattempo non si va in doppio
    const s = serverFinto({ prodotti: [nuovoPronto("a"), nuovoPronto("b")], categorie: [{ id: "k-ma", slug: "maschere", nome: "Maschere e trattamenti" }] });
    await F.applica(s.porte, scelteDi(["a", "b"], "maschere-e-trattamenti"), { breve: false, sito: false }, F.corsaVuota());
    c("«Maschere e trattamenti» esiste già (altro indirizzo): si usa quella, nessuna creata", [0, ["k-ma"], ["k-ma"]], [s.log.filter((x) => x.azione === "categoria_salva").length, s.db.get("a").categorie, s.db.get("b").categorie]);
    const s2 = serverFinto({ prodotti: [nuovoPronto("a")], categorie: [] });
    let primo = true;
    const porte2 = { ...s2.porte, categorie: async () => { if (primo) { primo = false; return { ok: true, dati: { categorie: [] } }; } return s2.porte.categorie(); } };
    s2.cat.push({ id: "cat-nata-nel-frattempo", slug: "styling", nome: "Styling" });
    const f2 = await F.applica(porte2, scelteDi(["a"], "styling"), { breve: false, sito: false }, F.corsaVuota());
    c("se la categoria è nata nel frattempo (409 «duplicato») si rilegge l'elenco e si usa quella: niente doppione, niente errore", [["cat-nata-nel-frattempo"], "fatto"], [s2.db.get("a").categorie, f2.esiti.a.stato]);
  }
  {
    // errore che ferma (rete): gli altri gruppi non partono; la ripresa non rifà i fatti
    const ids = Array.from({ length: 12 }, (_, i) => `p${i + 1}`);
    const scelte = scelteDi(ids, "shampoo");
    let cade = true;
    const s = serverFinto({ prodotti: ids.map((id) => nuovoPronto(id)), categorie: note0, guasto: (az, d) => (cade && az === "prodotto_categorie" && d.prodottoId === "p7" ? { ok: false, errore: { tipo: "rete", messaggio: "Non riesco a collegarmi al server." } } : null) });
    const fine = await F.applica(s.porte, scelte, { breve: false, sito: false }, F.corsaVuota());
    c("la rete cade al 7º: il gruppo in corso finisce, il terzo gruppo (p11, p12) NON parte", [true, true, "Non riesco a collegarmi al server."], [fine.esiti.p11 === undefined && fine.esiti.p12 === undefined, ids.slice(0, 5).every((id) => fine.esiti[id].stato === "fatto"), fine.fermo]);
    c("mancanti: p7 (errore) e i due mai partiti", ["p7", "p11", "p12"], F.mancanti(scelte, fine).map((x) => x.id));
    cade = false;
    const prima = s.log.length;
    const dopo = await F.applica(s.porte, scelte, { breve: false, sito: false }, { ...fine, fermo: null });
    const toccati = [...new Set(s.log.slice(prima).filter((x) => x.dati.prodottoId || x.dati.id).map((x) => x.dati.prodottoId ?? x.dati.id))].sort();
    c("la ripresa riguarda solo i 3 mancanti (e p8–p10, fermati col gruppo, che non erano partiti)", true, ["p7", "p11", "p12"].every((id) => toccati.includes(id)) && !ids.slice(0, 5).some((id) => toccati.includes(id)));
    c("alla fine tutti i 12 sono fatti, senza errori e senza «fermo»", [12, 0, null], [Object.values(dopo.esiti).filter((e) => e.stato === "fatto").length, F.riepilogo(scelte, dopo).errori.length, dopo.fermo]);
  }

  /* ── 9. Breve e canale «sito» dentro la stessa scrittura, solo dove vuoti ── */
  {
    const s = serverFinto({
      prodotti: [
        nuovoPronto("vuoto", { seo: "Descrizione per Google del primo.", canali: { sito: false, meta: false, google: false, tiktok: false } }),
        nuovoPronto("conBreve", { breve: "La mia frase.", seo: "Altra descrizione." }),
        nuovoPronto("conMeta", { seo: "Terza descrizione.", canali: { sito: false, meta: true, google: false, tiktok: false } }),
        nuovoPronto("pubblicato", { stato: "pubblicato", seo: "Descrizione del pubblicato." }),
      ],
      categorie: note0,
    });
    const scelte = scelteDi(["vuoto", "conBreve", "conMeta", "pubblicato"], "shampoo");
    await F.applica(s.porte, scelte, { breve: true, sito: true }, F.corsaVuota());
    c("il prodotto vuoto riceve breve (dalla descrizione per Google) e sito acceso, con gli altri tre canali com'erano", ["Descrizione per Google del primo.", { sito: true, meta: false, google: false, tiktok: false }], [s.db.get("vuoto").breve, s.db.get("vuoto").canali]);
    c("la breve già scritta NON si tocca; il canale si accende lo stesso", ["La mia frase.", true], [s.db.get("conBreve").breve, s.db.get("conBreve").canali.sito]);
    c("con Meta già acceso il «sito» resta spento e Meta resta acceso; la breve arriva", [false, true, "Terza descrizione."], [s.db.get("conMeta").canali.sito, s.db.get("conMeta").canali.meta, s.db.get("conMeta").breve]);
    c("un prodotto pubblicato: solo la categoria, né breve né canali", ["", false, ["k-sh"]], [s.db.get("pubblicato").breve, s.db.get("pubblicato").canali.sito, s.db.get("pubblicato").categorie]);
    const salva = s.scritture().filter((x) => x.azione === "prodotto_salva");
    c("breve e canale vanno in UNA sola scrittura per prodotto, con la versione appena avanzata dalle categorie", [true, 3], [salva.filter((x) => x.dati.prodottoId === "vuoto").length === 1 && "descrizioneBreve" in salva.find((x) => x.dati.prodottoId === "vuoto").dati.campi && "canali" in salva.find((x) => x.dati.prodottoId === "vuoto").dati.campi, salva.length]);
    const prima = s.scritture().length;
    await F.applica(s.porte, scelte, { breve: true, sito: true }, F.corsaVuota());
    c("rifare tutto da capo con una corsa nuova non cambia niente (già pieno: nessuna scrittura)", 0, s.scritture().length - prima);
  }
  {
    // solo le opzioni, senza categoria; e niente da fare = nessuna richiesta
    const s = serverFinto({ prodotti: [nuovoPronto("a", { seo: "Testo per Google." }), nuovoPronto("b", { seo: "Altro." })], categorie: note0 });
    const scelte = [{ id: "a", nome: "A", categoria: null }, { id: "b", nome: "B", categoria: null }];
    const nulla = await F.applica(s.porte, scelte, { breve: false, sito: false }, F.corsaVuota());
    c("nessuna categoria e nessuna opzione: nessuna richiesta, nessun prodotto da fare", [0, 0, 0], [s.log.length, F.avanzamento(nulla).totale, Object.keys(nulla.esiti).length]);
    const solo = await F.applica(s.porte, scelte, { breve: true, sito: false }, F.corsaVuota());
    c("senza categoria ma con la breve: la breve si scrive, nessuna categoria", ["Testo per Google.", [], 2], [s.db.get("a").breve, s.db.get("a").categorie, F.avanzamento(solo).totale]);
  }
  {
    // un errore nella lettura di un prodotto: errore suo, gli altri vanno; categoria piena (20) → frase del server
    const s = serverFinto({ prodotti: [nuovoPronto("a"), nuovoPronto("b")], categorie: note0, guasto: (az, d) => (az === "scheda" && d.id === "a" ? { ok: false, errore: { tipo: "non_trovato", messaggio: "Prodotto non trovato." } } : null) });
    const scelte = scelteDi(["a", "b"], "shampoo");
    const fine = await F.applica(s.porte, scelte, { breve: false, sito: false }, F.corsaVuota());
    c("un prodotto che non si legge è un errore suo con la frase; l'altro si fa", ["errore", "Prodotto non trovato.", "fatto"], [fine.esiti.a.stato, fine.esiti.a.frase, fine.esiti.b.stato]);
    c("il riepilogo elenca chi non è riuscito, col nome e la frase", [{ nome: "Prodotto a", frase: "Prodotto non trovato." }], F.riepilogo(scelte, fine).errori);
  }

  /* ── 10. Il sorgente: la finestra, il tasto, le regole di scrittura ── */
  const elenco = senzaCommenti(leggi(radice, "src/crm/ecommerce/prodotti/ElencoProdotti.tsx"));
  const finestra = senzaCommenti(leggi(radice, "src/crm/ecommerce/prodotti/FinestraCategorieAuto.tsx"));
  const flusso = senzaCommenti(leggi(radice, "src/crm/ecommerce/prodotti/categorie-auto-flusso.ts"));
  c("l'elenco ha il tasto «Metti le categorie», che apre la finestra, e non è nel Cestino", [true, true], [/Metti le categorie/.test(elenco) && /<FinestraCategorieAuto/.test(elenco), /segmento === "cestino" \?[\s\S]*?Rimetti in bozza[\s\S]*?\) : \([\s\S]*?Metti le categorie/.test(elenco)]);
  c("la finestra dice «Creo le categorie:», «Da fare a mano» e ha «Riprova»; la barra è una progressbar", [true, true, true, true], [/Creo le categorie:/.test(finestra), /Da fare a mano|fraseDaFareAMano/.test(finestra), /Riprova/.test(finestra), /role="progressbar"/.test(finestra)]);
  c("le caselle della breve e del canale sono già spuntate", true, /useState<Opzioni>\(\{ breve: true, sito: true \}\)|breve: true, sito: true/.test(finestra));
  c("la finestra non si chiude mentre scrive", true, /onOpenChange=\{\(v\) => !v && !occupata/.test(finestra));
  c("niente cancellazioni: né delete né l'azione che toglie categorie da sola; si usa solo l'azione esistente `prodotto_categorie` con l'insieme completo", [false, true, true, true], [/\bdelete\b|prodotto_elimina|categoria_elimina/i.test(flusso + finestra), /"prodotto_categorie"/.test(flusso), /"categoria_salva"/.test(flusso), /\.\.\.l\.categorie|\.\.\.lettura\.categorie/.test(flusso)]);
  c("nessuna rete diretta: né fetch né log", [false, false], [/\bfetch\(/.test(flusso + finestra), /console\./.test(flusso + finestra)]);
}
