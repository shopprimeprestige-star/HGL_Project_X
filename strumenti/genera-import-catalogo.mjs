#!/usr/bin/env node
/** ── SHOP R1 · T04 · GENERA LA MIGRAZIONE S2 (I 33 ARTICOLI DEL VECCHIO CATALOGO) ───
 *  Legge `src/shop/catalog.ts` (lo trasforma con esbuild, come fanno le prove) e scrive
 *  `supabase/migrations/20261120130000_shop_catalogo_import.sql`. Stesso input → stesso file (niente date,
 *  niente casi): la prova `prove/negozio/import-catalogo.mjs` rigenera e confronta, quindi se `catalog.ts`
 *  cambia e S2 no, `npm test` diventa rosso. Per rigenerare:  node strumenti/genera-import-catalogo.mjs
 *  Non tocca il database: scrive solo il file, che poi applica il titolare. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { transformSync } from "esbuild";

const QUI = dirname(fileURLToPath(import.meta.url));
const NOME = "20261120130000_shop_catalogo_import.sql";
const NOTA = "Importato dal catalogo nel codice: testo e prezzo da verificare.";
const FONTE = "catalogo del codice";

/** Le 9 categorie vecchie → i 3 tipi del nuovo catalogo: protesi = patch, kit = kit, il resto = cura. */
const tipoDa = (categoria) => (categoria === "toupee" ? "patch" : categoria === "kit" ? "kit" : "cura");
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const jsonb = (v) => `${q(JSON.stringify(v))}::jsonb`;

/** `{ PRODUCTS, CATEGORIES }` da `src/shop/catalog.ts`. */
export async function caricaCatalogo(radice = join(QUI, "..")) {
  const ts = readFileSync(join(radice, "src/shop/catalog.ts"), "utf8");
  const js = transformSync(ts, { loader: "ts", format: "esm" }).code;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);
}

/** Le caratteristiche di un articolo: tutte «da_confermare» (il titolare le conferma una a una). */
function caratteristiche(p) {
  const riga = (etichetta, valore) => ({ etichetta, valore, stato: "da_confermare", fonte: FONTE });
  return [
    ...(p.specs ?? []).map((s) => riga(s.label, s.value)),
    ...p.bullets.map((b) => riga("In breve", b)),
    ...(p.variants?.length ? [riga("Opzioni del vecchio catalogo", p.variants.map((v) => `${v.label}: ${v.options.join(", ")}`).join("; "))] : []),
  ];
}

export async function genera(radice = join(QUI, "..")) {
  const { PRODUCTS, CATEGORIES } = await caricaCatalogo(radice);
  const righe = [];
  const out = (s) => righe.push(s);

  out(`-- ─────────────────────────────────────────────────────────────────────────────
-- SHOP · S2 · I ${PRODUCTS.length} ARTICOLI DEL VECCHIO CATALOGO (IMPORTAZIONE FACOLTATIVA)
--
-- FILE GENERATO da strumenti/genera-import-catalogo.mjs a partire da src/shop/catalog.ts:
-- NON si modifica a mano (una prova controlla che sia uguale a ciò che lo strumento rigenera).
-- Commessa 2026-11-20-shop-completo (PIANO.md §4 «S2», compito T04, D3 e D28).
-- La applica il TITOLARE, a mano, dal SQL Editor di Supabase, DOPO S1 (20261120120000_shop_catalogo.sql).
-- La squadra non la lancia mai. È FACOLTATIVA: se non la applichi, il resto funziona.
--
-- COSA FA (solo INSERT, tutti con ON CONFLICT DO NOTHING)
--   1. Crea ${CATEGORIES.length} categorie (le chiavi del vecchio catalogo), tutte NON visibili.
--   2. Crea ${PRODUCTS.length} prodotti, TUTTI in «bozza», con origine = 'codice' (stanno nel segmento
--      «Vecchio catalogo» del pannello, non in «Tutti»), stesso slug, SKU = «HG-» + id maiuscolo,
--      prezzo in centesimi, descrizione breve e lunga del codice, e una nota per il titolare.
--      Tipo: protesi (toupee) = patch; kit = kit; tutto il resto (shampoo, balsami, districanti,
--      solventi, adesivi, spazzole, accessori) = cura.
--   3. Le caratteristiche (dati tecnici e punti di forza) sono TUTTE «da_confermare»: non escono
--      sul sito finché il titolare non le conferma. Le combinazioni colore × lunghezza × misura
--      NON diventano varianti: restano scritte in una riga «Opzioni del vecchio catalogo».
--   4. Crea UNA variante «Unica» per prodotto: SKU uguale a quello del prodotto, prezzo vuoto (vale
--      quello del prodotto), giacenza 0, attiva; e un movimento «migrazione» a giacenza 0.
--   5. Lega ogni prodotto alla sua categoria.
--
-- COSA NON FA
--   Nessun UPDATE, DELETE o TRUNCATE. Non porta voti, recensioni, prezzi barrati, etichette
--   «Best seller», disegni né la giacenza finta del codice. Non pubblica niente: i prodotti
--   restano bozze, e le giacenze vere le scrive il titolare con la merce vera.
--
-- LANCIARLA DUE VOLTE NON FA DANNI: i prodotti si riconoscono dalla chiave id_codice; ciò che il
-- titolare ha già modificato non si riscrive; la variante, il legame con la categoria e il
-- movimento si aggiungono solo se il prodotto non li ha già (se hai cambiato lo SKU della
-- variante o la categoria, non tornano quelli di prima). Se S1 manca, si ferma con un errore e
-- non scrive niente (è una sola transazione).
--
-- COME SI ANNULLA: non serve. I prodotti sono bozze invisibili al pubblico; si archiviano dal
-- pannello (non esiste «elimina»).
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Le categorie (non visibili) ───────────────────────────────────────────
INSERT INTO public.shop_categorie (slug, nome, tipo, frase, ordine, visibile) VALUES`);
  out(CATEGORIES.map((k, i) => `  (${q(k.key)}, ${q(k.label)}, 'categoria', ${q(k.tagline)}, ${i}, false)`).join(",\n"));
  out(`ON CONFLICT DO NOTHING;

-- ── 2. I prodotti: tutti in bozza, origine «codice» ──────────────────────────`);
  for (const p of PRODUCTS) {
    out(`INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, origine, prezzo_cent, descrizione_breve, descrizione_lunga, caratteristiche, nota_titolare, id_codice)
VALUES (${q(`HG-${p.id.toUpperCase()}`)}, ${q(p.slug)}, ${q(p.name)}, '${tipoDa(p.category)}', 'bozza', 'codice', ${Math.round(p.price * 100)}, ${q(p.short)}, ${q(p.description)},
  ${jsonb(caratteristiche(p))},
  ${q(NOTA)}, ${q(p.id)})
ON CONFLICT DO NOTHING;`);
  }
  out(`
-- ── 3. La categoria di ogni prodotto (solo se non ne ha già una) ─────────────
INSERT INTO public.shop_prodotti_categorie (prodotto_id, categoria_id)
SELECT p.id, c.id
FROM (VALUES
${PRODUCTS.map((p) => `  (${q(p.id)}, ${q(p.category)})`).join(",\n")}
) AS m (cod, cat)
JOIN public.shop_prodotti p ON p.id_codice = m.cod
JOIN public.shop_categorie c ON c.slug = m.cat
WHERE NOT EXISTS (SELECT 1 FROM public.shop_prodotti_categorie x WHERE x.prodotto_id = p.id)
ON CONFLICT DO NOTHING;

-- ── 4. Una variante «Unica» per prodotto: SKU del prodotto, prezzo vuoto, giacenza 0 ──
INSERT INTO public.shop_varianti (prodotto_id, sku, nome, opzioni, prezzo_cent, giacenza, attiva)
SELECT p.id, p.sku, 'Unica', '{}'::jsonb, NULL, 0, true FROM public.shop_prodotti p WHERE p.id_codice IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.shop_varianti v WHERE v.prodotto_id = p.id)
ON CONFLICT DO NOTHING;

-- ── 5. Il movimento «migrazione» a giacenza 0 (una volta sola per variante) ──
INSERT INTO public.shop_giacenza_movimenti (variante_id, delta, giacenza_dopo, motivo, nota, chi)
SELECT v.id, 0, 0, 'migrazione', 'Importato dal catalogo nel codice: giacenza 0, da contare', 'importazione'
FROM public.shop_varianti v
JOIN public.shop_prodotti p ON p.id = v.prodotto_id
WHERE p.id_codice IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.shop_giacenza_movimenti m WHERE m.variante_id = v.id)
ON CONFLICT DO NOTHING;

COMMIT;`);
  return righe.join("\n") + "\n";
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const radice = join(QUI, "..");
  const sql = await genera(radice);
  writeFileSync(join(radice, "supabase/migrations", NOME), sql);
  console.log(`scritto supabase/migrations/${NOME} (${sql.length} caratteri)`);
}
