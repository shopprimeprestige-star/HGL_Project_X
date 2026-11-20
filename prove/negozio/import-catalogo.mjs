/** ── SHOP R1 · T04 · LA MIGRAZIONE S2: I 33 ARTICOLI DEL VECCHIO CATALOGO (TESTO SQL) ─
 *  Qui NON gira un Postgres: si legge `20261120130000_shop_catalogo_import.sql` (COMMENTI TOLTI) e lo si
 *  confronta con `src/shop/catalog.ts` (caricato con esbuild dallo stesso strumento che genera il file).
 *  Il file COMMITTATO deve essere uguale a quello che lo strumento rigenera: se `catalog.ts` cambia e S2
 *  no, questa prova diventa rossa. La doppia applicazione vera (dopo S1, su Postgres usa-e-getta) non si
 *  fa qui: è descritta in LAVAGNA (T04) e si ripete con `psql` sul database di prova. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const S1 = "20261120120000_shop_catalogo.sql";
const S2 = "20261120130000_shop_catalogo_import.sql";

const senzaCommenti = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").replace(/[ \t]+\n/g, "\n");
const piatto = (s) => s.replace(/\s+/g, " ").trim();
const q = (s) => String(s).replace(/'/g, "''");
/** La regola di T04: protesi → patch, kit → kit, tutto il resto (cura, adesivi, accessori…) → cura. */
const tipoAtteso = (cat) => (cat === "toupee" ? "patch" : cat === "kit" ? "kit" : "cura");

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("SHOP R1 · T04 · MIGRAZIONE S2: I 33 ARTICOLI (TESTO SQL, 20/11/2026)");
  const percorso = join(radice, "supabase/migrations", S2);
  const strumento = join(radice, "strumenti/genera-import-catalogo.mjs");
  c("S2 esiste, dopo S1, e lo strumento che la genera pure", [true, true, true], [
    existsSync(percorso),
    S2 > S1,
    existsSync(strumento),
  ]);
  if (!existsSync(percorso) || !existsSync(strumento)) return;

  const { genera, caricaCatalogo } = await import(pathToFileURL(strumento).href);
  const { PRODUCTS, CATEGORIES } = await caricaCatalogo(radice);
  const grezzo = readFileSync(percorso, "utf8");
  const sql = senzaCommenti(grezzo);
  const stmt = sql.split(/;\s*\n/).map(piatto).filter(Boolean);

  /* ── il file committato è quello che lo strumento rigenera ── */
  const rigenerato = await genera(radice);
  c("il file committato è UGUALE a quello che lo strumento rigenera (stesso input → stesso file)", true, grezzo === rigenerato);
  c("rigenerato due volte è identico (nessuna data, nessun caso)", true, (await genera(radice)) === rigenerato);
  c("il catalogo del codice ha 33 articoli e 9 categorie (la prova legge davvero catalog.ts)", [33, 9], [PRODUCTS.length, CATEGORIES.length]);

  /* ── solo aggiunte, e rilanciabile ── */
  const ammessa = (s) =>
    /^(BEGIN|COMMIT)$/.test(s) ||
    /^INSERT INTO public\.shop_(categorie|prodotti|varianti|prodotti_categorie|giacenza_movimenti) \(/.test(s);
  c("ogni istruzione è BEGIN/COMMIT o un INSERT in una tabella di S1", [], stmt.filter((s) => !ammessa(s)));
  const inserti = stmt.filter((s) => s.startsWith("INSERT"));
  c("ogni INSERT finisce con ON CONFLICT … DO NOTHING (si applica due volte senza doppioni)", [], inserti.filter((s) => !/ON CONFLICT (\([\w, ]+\) )?DO NOTHING$/.test(s)));
  c("nessun UPDATE, DELETE, TRUNCATE, DROP, ALTER, CREATE, DO UPDATE, GRANT, REVOKE", 0,
    (sql.match(/\b(UPDATE|DELETE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE)\b/gi) ?? []).length);
  c("un solo BEGIN e un solo COMMIT, in testa e in coda", [1, 1, "BEGIN", "COMMIT"], [
    stmt.filter((s) => s === "BEGIN").length, stmt.filter((s) => s === "COMMIT").length, stmt[0], stmt.at(-1),
  ]);
  c("nessuna chiave, nessun indirizzo, nessun riferimento ad altre tabelle (orders, leads, auth, storage)", false,
    /https?:\/\/|eyJ|sbp_|shop_orders|crm_|public_leads|\bauth\.|storage\./i.test(sql));
  c("l'intestazione dice: facoltativa, dopo S1, rilanciabile, la applica il titolare, non riscrive ciò che è stato modificato", [true, true, true, true, true], [
    /FACOLTATIVA/.test(grezzo), /DOPO S1/i.test(grezzo), /DUE VOLTE NON FA DANNI/i.test(grezzo), /TITOLARE/.test(grezzo), /non si riscrive/i.test(grezzo),
  ]);

  /* ── i 33 prodotti ── */
  const prodotti = inserti.filter((s) => s.startsWith("INSERT INTO public.shop_prodotti ("));
  c("33 INSERT in shop_prodotti, uno per articolo, nell'ordine del catalogo", 33, prodotti.length);
  c("33 slug identici a PRODUCTS, nello stesso ordine", PRODUCTS.map((p) => p.slug),
    prodotti.map((s) => (s.match(/VALUES \('[^']*', '([^']*)'/) ?? [])[1]));
  const skuAttesi = PRODUCTS.map((p) => `HG-${p.id.toUpperCase()}`);
  c("33 SKU unici «HG-» + id maiuscolo (HG-T01…)", [skuAttesi, 33], [
    prodotti.map((s) => (s.match(/VALUES \('([^']*)'/) ?? [])[1]),
    new Set(skuAttesi).size,
  ]);
  c("ogni SKU rispetta la regola del modello (^[A-Z0-9][A-Z0-9._-]{1,39}$)", [], skuAttesi.filter((s) => !/^[A-Z0-9][A-Z0-9._-]{1,39}$/.test(s)));
  c("la chiave id_codice di ogni riga è l'id del catalogo (t01…), unica", PRODUCTS.map((p) => p.id),
    prodotti.map((s) => (s.match(/, '([a-z]\d+)'\) ON CONFLICT/) ?? [])[1]));
  const riga = (p) => prodotti.find((s) => s.includes(`'HG-${p.id.toUpperCase()}', '${p.slug}'`)) ?? "";
  c("ogni articolo: stato 'bozza', origine 'codice', tipo secondo la regola, prezzo = round(price*100)", [],
    PRODUCTS.filter((p) => !riga(p).includes(`'${q(p.name)}', '${tipoAtteso(p.category)}', 'bozza', 'codice', ${Math.round(p.price * 100)}, `)).map((p) => p.id));
  c("regola dei tipi: 16 patch (toupee), 2 kit, 15 cura (shampoo, balsami, districanti, solventi, adesivi, spazzole, accessori)", [16, 2, 15], [
    PRODUCTS.filter((p) => tipoAtteso(p.category) === "patch").length,
    PRODUCTS.filter((p) => tipoAtteso(p.category) === "kit").length,
    PRODUCTS.filter((p) => tipoAtteso(p.category) === "cura").length,
  ]);
  c("tutti i tipi usati sono quelli ammessi dal database (patch, cura, kit)", [], [...new Set(prodotti.map((s) => (s.match(/', '(\w+)', 'bozza'/) ?? [])[1]))].filter((t) => !["patch", "cura", "kit"].includes(t)));
  c("descrizione breve (short) e lunga (description) sono quelle del catalogo, senza cambiare una parola", [], PRODUCTS.filter((p) => {
    const r = riga(p);
    return !r.includes(`'${q(p.short)}', '${q(p.description)}'`);
  }).map((p) => p.id));
  c("la nota per il titolare dice che testo e prezzo vanno verificati", [], PRODUCTS.filter((p) => !riga(p).includes("'Importato dal catalogo nel codice: testo e prezzo da verificare.'")).map((p) => p.id));
  c("nessun prezzo con virgola o decimali: sempre centesimi interi", false, /\b\d+\.\d+\b(?![^']*')/.test(prodotti.join(" ").replace(/'(?:[^']|'')*'/g, "''")));

  /* ── niente di ciò che non si migra ── */
  c("nessuna occorrenza di rating, reviews, compareAt, badge, «Best seller», tone, icon, image, baseStyle", [], [
    "rating", "reviews", "compareat", "badge", "best seller", "bestseller", "tone", "icon", "image", "basestyle", "hairColorHex".toLowerCase(),
  ].filter((k) => new RegExp(`\\b${k}\\b`).test(sql.toLowerCase())));
  c("nessun numero di recensioni né voto in forma di stelle (★, ⭐, «4.8»)", false, /★|⭐|\b[1-5]\.\d\b.*recension/i.test(sql));

  /* ── le caratteristiche: tutte «da_confermare» ── */
  const json = (r) => {
    const m = r.match(/'((?:[^']|'')*)'::jsonb/g) ?? [];
    return m.map((x) => JSON.parse(x.slice(1, x.lastIndexOf("'::jsonb")).replace(/''/g, "'")));
  };
  const caratt = prodotti.map((r) => json(r)[0] ?? null);
  c("ogni articolo ha le sue caratteristiche come array JSON valido", 33, caratt.filter((a) => Array.isArray(a) && a.length > 0).length);
  c("OGNI caratteristica di OGNI articolo è «da_confermare» (nessuna è pubblica finché il titolare non la conferma)", [], caratt.flat().filter((x) => x.stato !== "da_confermare"));
  c("ogni caratteristica ha etichetta, valore e fonte non vuoti", 0, caratt.flat().filter((x) => !x.etichetta || !x.valore || !x.fonte).length);
  c("il numero di righe = specs + bullets + (1 se ha le opzioni del vecchio catalogo)", [], PRODUCTS.filter((p, i) =>
    caratt[i].length !== (p.specs?.length ?? 0) + p.bullets.length + (p.variants?.length ? 1 : 0)).map((p) => p.id));
  c("le combinazioni colore × lunghezza × misura NON diventano varianti: una riga «Opzioni del vecchio catalogo» da confermare", [], PRODUCTS.filter((p, i) =>
    !!p.variants?.length !== caratt[i].some((x) => x.etichetta === "Opzioni del vecchio catalogo")).map((p) => p.id));

  /* ── categorie: 9, tutte NON visibili ── */
  const cat = inserti.find((s) => s.startsWith("INSERT INTO public.shop_categorie (")) ?? "";
  c("le 9 categorie del catalogo, con lo stesso slug, tipo «categoria», NON visibili", [], CATEGORIES.filter((k) =>
    !cat.includes(`('${k.key}', '${q(k.label)}', 'categoria', '${q(k.tagline)}', `) || !new RegExp(`'${k.key}', [^)]*false\\)`).test(cat)).map((k) => k.key));
  c("nessuna categoria visibile (true) e nessun «pubblicato» in tutto il file", [false, false], [/\btrue\b/i.test(cat), /pubblicato/i.test(sql.replace(/pubblicat[ao]_il/g, ""))]);
  const legami = inserti.find((s) => s.startsWith("INSERT INTO public.shop_prodotti_categorie (")) ?? "";
  c("ogni articolo è legato alla sua categoria (33 legami) e solo se non ne ha già una", [[], true], [
    PRODUCTS.filter((p) => !legami.includes(`('${p.id}', '${p.category}')`)).map((p) => p.id),
    /NOT EXISTS \(SELECT 1 FROM public\.shop_prodotti_categorie/.test(legami),
  ]);

  /* ── variante unica, giacenza 0, movimento di migrazione ── */
  const varianti = inserti.find((s) => s.startsWith("INSERT INTO public.shop_varianti (")) ?? "";
  c("una variante «unica» per articolo: SKU = SKU del prodotto, prezzo VUOTO (= quello del prodotto), giacenza 0, attiva", [true, true, true, true], [
    /SELECT p\.id, p\.sku, 'Unica', '\{\}'::jsonb, NULL, 0, true /.test(varianti),
    /FROM public\.shop_prodotti p WHERE p\.id_codice IS NOT NULL/.test(varianti),
    /AND NOT EXISTS \(SELECT 1 FROM public\.shop_varianti v WHERE v\.prodotto_id = p\.id\)/.test(varianti),
    !/giacenza[^,]*[1-9]/.test(varianti.replace(/\(prodotto_id[^)]*\)/, "")),
  ]);
  const mov = inserti.find((s) => s.startsWith("INSERT INTO public.shop_giacenza_movimenti (")) ?? "";
  c("un movimento «migrazione» a giacenza 0 (delta 0) per ogni variante che non ne ha, scritto una volta sola", [true, true], [
    /SELECT v\.id, 0, 0, 'migrazione', /.test(mov),
    /NOT EXISTS \(SELECT 1 FROM public\.shop_giacenza_movimenti m WHERE m\.variante_id = v\.id\)/.test(mov),
  ]);
  c("la giacenza del vecchio catalogo (campo stock) non entra: ogni variante nasce a 0 e nessun altro INSERT scrive giacenza", [0, 0], [
    (varianti.match(/, 0, true /g) ?? []).length === 1 ? 0 : 1,
    inserti.filter((x) => !x.startsWith("INSERT INTO public.shop_varianti (") && /\bgiacenza\b(?!_dopo)/.test(x.split(" VALUES")[0].split(" SELECT")[0])).length,
  ]);
}
