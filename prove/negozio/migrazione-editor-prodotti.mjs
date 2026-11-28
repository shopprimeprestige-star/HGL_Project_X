/** ── EDITOR PRODOTTI · E1 · LA MIGRAZIONE «COSTO + IMPORT» (TESTO SQL) ───────────────────────────────────────────
 *  Qui NON gira un Postgres: si legge il testo di `20261125120000_shop_editor_prodotti.sql` (COMMENTI TOLTI prima, e
 *  distinguendo il testo FUORI dal corpo della funzione da quello DENTRO). Il comportamento vero (permessi, doppia applicazione,
 *  gli scenari, il tutto-o-niente) è `prove/sql/shop-editor-prodotti.sql` su un Postgres usa-e-getta, che rifà gli scenari di
 *  `_scenari-import.json`. Cosa deve valere (PIANO editor prodotti §1.1 e §4, rev. 1 p. 4):
 *   · solo aggiunte: `ADD COLUMN IF NOT EXISTS costo_cent` (intero, vuoto o ≥ 0) e `CREATE OR REPLACE FUNCTION`, più REVOKE/GRANT,
 *     BEGIN/COMMIT e NOTIFY; nessun DELETE, DROP, TRUNCATE (nemmeno nei commenti), nessun UPDATE, nessuna vista, nessun trigger;
 *   · la colonna prima della funzione (funzione presente ⇒ colonna presente);
 *   · la funzione: SECURITY DEFINER, `search_path = public, pg_temp`, chiusa a PUBLIC/anon/authenticated e aperta solo a service_role;
 *   · i campi si leggono UNO PER UNO (mai `jsonb_populate_record`, `jsonb_to_record`…): né `stato`, né `id`, `origine`, `canali`,
 *     `id_codice`, `correlato_id` dall'input; lo stato scritto è il letterale «bozza»;
 *   · i due duplicati si distinguono dal nome del vincolo; ogni altro errore esce col solo codice (mai SQLERRM); la giacenza passa da
 *     `shop_giacenza_muovi` come «carico» con nota «Import CSV»; i tetti sono quelli della scheda (prodotti.server). */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FILE = "20261125120000_shop_editor_prodotti.sql";
const senzaCommenti = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").replace(/[ \t]+\n/g, "\n");
const piatto = (s) => s.replace(/\s+/g, " ").trim();
const FIRMA = "public.shop_import_prodotto(jsonb, jsonb, uuid[], text)";
/** Le uniche chiavi che la funzione può leggere dal prodotto (e dalla variante): tutto il resto dell'input è ignorato. */
const CHIAVI_PRODOTTO = ["nome", "slug", "sku", "tipo", "marca", "descrizione_breve", "descrizione_lunga", "categoria_google", "fornitore", "seo_titolo", "seo_descrizione", "gtin", "nota_titolare", "prezzo_cent", "peso_g"];
const CHIAVI_VARIANTE = ["sku", "nome", "gtin", "prezzo_cent", "peso_g", "costo_cent", "giacenza", "ordine", "opzioni"];

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("EDITOR PRODOTTI · E1 · MIGRAZIONE DEL COSTO E DELL'IMPORT: TESTO SQL (25/11/2026)");
  const cartella = join(radice, "supabase/migrations");
  const percorso = join(cartella, FILE);
  c("la migrazione esiste col nome del piano e viene dopo ogni altra migrazione che c'è già", [true, []], [
    existsSync(percorso),
    existsSync(cartella) ? readdirSync(cartella).filter((f) => f.endsWith(".sql") && f !== FILE && f > FILE && f !== "20261128120000_shop_import_250_varianti.sql") /* la ricrea col tetto di 250: viene dopo apposta */ : [],
  ]);
  const collaudo = join(radice, "prove/sql/shop-editor-prodotti.sql");
  c("il collaudo su Postgres usa-e-getta c'è e il LEGGIMI lo spiega", [true, true], [
    existsSync(collaudo),
    existsSync(join(radice, "prove/sql/LEGGIMI.md")) && /shop-editor-prodotti\.sql/.test(readFileSync(join(radice, "prove/sql/LEGGIMI.md"), "utf8")),
  ]);
  if (!existsSync(percorso)) return;

  const grezzo = readFileSync(percorso, "utf8");
  const sql = senzaCommenti(grezzo);
  const corpi = [...sql.matchAll(/\$\$([\s\S]*?)\$\$/g)].map((m) => m[1]);
  const corpo = corpi.join("\n");
  const fuori = sql.replace(/\$\$[\s\S]*?\$\$/g, () => "$$…$$");
  const stmt = fuori.split(";").map(piatto).filter(Boolean);

  /* ── l'intestazione in italiano ── */
  c("in testa: cosa fa, cosa non fa, come si annulla, l'ordine, la verifica", [true, true, true, true, true],
    [/COSA FA/.test(grezzo), /COSA NON FA/.test(grezzo), /COME SI ANNULLA/.test(grezzo), /ORDINE/.test(grezzo), /VERIFICA/.test(grezzo)]);
  c("la verifica in sola lettura dice 33 prodotti e 0 costi, e ha le tre prove dei permessi", [true, true, true], [
    /count\(\*\) FROM public\.shop_prodotti;\s+→ 33/.test(grezzo), /costo_cent IS NOT NULL;\s+→ 0/.test(grezzo), (grezzo.match(/has_function_privilege\(/g) || []).length === 3,
  ]);

  /* ── solo aggiunte ── */
  c("nessun DELETE, DROP, TRUNCATE in nessun punto del file, commenti compresi", [0, 0, 0], [/\bDELETE\b/i, /\bDROP\b/i, /\bTRUNCATE\b/i].map((r) => (r.test(grezzo) ? 1 : 0)));
  c("nessun UPDATE, nessuna vista, nessun trigger, nessuna policy, nessun RENAME, nessun ALTER COLUMN", [0, 0, 0, 0, 0, 0],
    [/\bUPDATE\b/i, /\bVIEW\b/i, /\bTRIGGER\b/i, /\bPOLICY\b/i, /\bRENAME\b/i, /ALTER\s+COLUMN/i].map((r) => (r.test(sql) ? 1 : 0)));
  c("nessun ON CONFLICT … DO UPDATE e nessun SELECT … FOR UPDATE (la funzione non riscrive niente e non blocca righe)", 0, (corpo.match(/ON\s+CONFLICT|FOR\s+UPDATE/gi) || []).length);
  const ammessa = (s) =>
    /^(BEGIN|COMMIT)$/.test(s) ||
    s === "NOTIFY pgrst, 'reload schema'" ||
    s === "ALTER TABLE public.shop_varianti ADD COLUMN IF NOT EXISTS costo_cent integer CHECK (costo_cent IS NULL OR costo_cent >= 0)" ||
    /^CREATE OR REPLACE FUNCTION public\.shop_import_prodotto\( p_prodotto jsonb, p_varianti jsonb, p_categorie uuid\[\], p_chi text \) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS \$\$…\$\$$/.test(s) ||
    s === `REVOKE ALL ON FUNCTION ${FIRMA} FROM PUBLIC, anon, authenticated` ||
    s === `GRANT EXECUTE ON FUNCTION ${FIRMA} TO service_role`;
  c("ogni istruzione fuori dal corpo della funzione è tra quelle ammesse (e sono sette)", [[], 7], [stmt.filter((s) => !ammessa(s)), stmt.length]);
  c("comincia con BEGIN, finisce con COMMIT e poi NOTIFY pgrst", [true, true], [stmt[0] === "BEGIN", stmt[stmt.length - 2] === "COMMIT" && stmt[stmt.length - 1] === "NOTIFY pgrst, 'reload schema'"]);
  c("funzione presente ⇒ colonna presente: la colonna viene PRIMA della funzione", true, sql.indexOf("ADD COLUMN IF NOT EXISTS costo_cent") > 0 && sql.indexOf("ADD COLUMN IF NOT EXISTS costo_cent") < sql.indexOf("CREATE OR REPLACE FUNCTION"));
  c("una sola funzione, e il corpo usa un'etichetta $$ sola (un solo corpo)", [1, 1], [(sql.match(/CREATE OR REPLACE FUNCTION/g) || []).length, corpi.length]);

  /* ── permessi: l'ultima riga di difesa è che nessun altro la chiami ── */
  c("il solo GRANT è a service_role (mai ad anon, authenticated o PUBLIC)", [1, ["service_role"]], [(sql.match(/\bGRANT\b/g) || []).length, (sql.match(/\bGRANT\b[^;]*;/g) || []).map((x) => x.replace(/^[\s\S]*\bTO\s+/, "").replace(/;$/, "").trim())]);
  c("il REVOKE precede il GRANT", true, sql.indexOf("REVOKE ALL ON FUNCTION") < sql.indexOf("GRANT EXECUTE ON FUNCTION"));

  /* ── la funzione non si fida dell'input ── */
  c("niente estrazione a record: mai jsonb_populate_record, jsonb_to_record, jsonb_populate_recordset, jsonb_to_recordset, json_populate…", 0, (corpo.match(/jsonb?_(populate|to)_record/gi) || []).length);
  const lette = (varNome) => new Set([...corpo.matchAll(new RegExp(`${varNome}\\s*->>?\\s*'(\\w+)'`, "g"))].map((m) => m[1]));
  c("dal prodotto legge solo le chiavi ammesse, e le legge tutte (nessuna in più: né stato, né id, origine, canali, id_codice, correlato_id)", [[], []], [
    [...lette("p_prodotto")].filter((k) => !CHIAVI_PRODOTTO.includes(k)), CHIAVI_PRODOTTO.filter((k) => !lette("p_prodotto").has(k)),
  ]);
  const dellaVariante = new Set([...corpo.matchAll(/\b(?:v_var|e\.x)\s*->>?\s*'(\w+)'/g)].map((m) => m[1]));
  c("dalla variante legge solo le chiavi ammesse (nessun id, nessun attiva, nessun prodotto_id)", [[], []], [[...dellaVariante].filter((k) => !CHIAVI_VARIANTE.includes(k)), CHIAVI_VARIANTE.filter((k) => !dellaVariante.has(k))]);
  c("lo stato di un prodotto nuovo è il letterale «bozza», scritto dalla funzione", [true, 0], [/INSERT INTO public\.shop_prodotti \([^)]*\bstato\b[^)]*\)\s+VALUES\s*\([^;]*'bozza'/.test(corpo), (corpo.match(/'stato'/g) || []).length]);
  c("la giacenza nasce a 0 e arriva con shop_giacenza_muovi: motivo «carico», nota «Import CSV», chi dato dalla guardia", [true, true, true], [
    /INSERT INTO public\.shop_varianti[\s\S]*?\(\s*v_prodotto_id,[^;]*?,\s*0,\s*\(v_var ->> 'peso_g'\)/.test(corpo),
    /PERFORM public\.shop_giacenza_muovi\(v_variante_id, \(v_var ->> 'giacenza'\)::integer, 'carico', 'Import CSV', v_chi, NULL\)/.test(corpo),
    /v_chi\s+text := left\(COALESCE\(NULLIF\(btrim\(p_chi\), ''\), 'sconosciuto'\), 80\)/.test(corpo),
  ]);
  c("nel corpo si scrive solo in prodotti, varianti, legami con le categorie e storico", [true, 4], [
    [...corpo.matchAll(/\bINSERT\s+INTO\s+(\S+)/gi)].every((m) => ["public.shop_prodotti", "public.shop_varianti", "public.shop_prodotti_categorie", "public.shop_storico"].includes(m[1])),
    new Set([...corpo.matchAll(/\bINSERT\s+INTO\s+(\S+)/gi)].map((m) => m[1])).size,
  ]);
  c("lo storico di un prodotto e di una variante: «creato» e «creata» (le stesse righe che scrive il server)", [true, true], [/'prodotto', v_prodotto_id::text, 'creato'/.test(corpo), /'variante', v_variante_id::text, 'creata'/.test(corpo)]);

  /* ── gli esiti e gli errori ── */
  c("i quattro esiti ci sono: creato, gia_presente, sku_usato, non_valido", [true, true, true, true], ["creato", "gia_presente", "sku_usato", "non_valido"].map((e) => corpo.includes(`'esito', '${e}'`)));
  c("i due duplicati si distinguono dal nome del vincolo (GET STACKED DIAGNOSTICS … CONSTRAINT_NAME)", [true, true, true, true], [
    /GET STACKED DIAGNOSTICS v_vincolo = CONSTRAINT_NAME/.test(corpo), /'shop_prodotti_slug_key'/.test(corpo), /'shop_prodotti_sku_key'/.test(corpo), /'shop_varianti_sku_key'/.test(corpo),
  ]);
  c("il nome di chi ha già lo SKU si rilegge DOPO l'errore (nel gestore), e un solo WHEN OTHERS finale", [true, 1, true], [
    /WHEN unique_violation THEN[\s\S]*SELECT x\.nome INTO v_nome/.test(corpo), (corpo.match(/WHEN OTHERS THEN/g) || []).length, corpo.lastIndexOf("WHEN OTHERS") > corpo.indexOf("WHEN unique_violation"),
  ]);
  c("l'errore del database esce col solo codice: SQLSTATE sì, SQLERRM e il messaggio mai", [true, 0, 0], [
    /'motivo', SQLSTATE/.test(corpo), (corpo.match(/SQLERRM|MESSAGE_TEXT|PG_EXCEPTION_DETAIL.*'motivo'/g) || []).length, (corpo.match(/RAISE\s+EXCEPTION/gi) || []).length,
  ]);
  c("una sola importazione alla volta (blocco di consultazione per la transazione)", true, /pg_advisory_xact_lock\(hashtext\('shop_import_prodotto'\)\)/.test(corpo));

  /* ── i tetti: gli stessi della scheda (prodotti.server) ── */
  const tetti = [["nome", 120], ["marca", 80], ["descrizione_breve", 300], ["descrizione_lunga", 5000], ["categoria_google", 200], ["fornitore", 200], ["seo_titolo", 300], ["seo_descrizione", 500], ["gtin", 20], ["nota_titolare", 2000], ["prezzo_cent", 2147483647], ["peso_g", 1000000]];
  c("tetti del prodotto come VALIDA di prodotti.server", [], tetti.filter(([k, n]) => !new RegExp(`\\('${k}',\\s+p_prodotto -> '${k}',\\s+(true|false),\\s+'[tn]',\\s+${n}\\b`).test(corpo)).map(([k]) => k));
  c("tetti della variante: nome 120, gtin 20, prezzo e costo 2147483647, peso e giacenza 1000000, ordine 1000", [], [["nome", 120], ["gtin", 20], ["prezzo_cent", 2147483647], ["peso_g", 1000000], ["costo_cent", 2147483647], ["giacenza", 1000000], ["ordine", 1000]]
    .filter(([k, n]) => !new RegExp(`\\('${k}',\\s+e\\.x -> '${k}',\\s+(true|false),\\s+'[tn]',\\s+${n}\\b`).test(corpo)).map(([k]) => k));
  c("al più 50 varianti (e almeno 1), al più 10 categorie, un SKU unico nel gruppo", [true, true, true], [/v_n < 1 OR v_n > 50/.test(corpo), /cardinality\(p_categorie\), 0\) > 10/.test(corpo), /sku_doppio/.test(corpo)]);
  c("SKU e indirizzo con la forma di oggi (SKU maiuscolo 2-40 segni, indirizzo minuscolo con trattini)", [true, true, true], [
    corpo.includes("'^[A-Z0-9][A-Z0-9._-]{1,39}$'"), corpo.includes("'^[a-z0-9]+(-[a-z0-9]+)*$'"), corpo.includes("'^(patch|cura|kit)$'"),
  ]);

  /* ── le quattro viste del sito non si toccano e il costo non entra in nessuna ── */
  const altre = readdirSync(cartella).filter((f) => f.endsWith(".sql") && f !== FILE);
  const vistePrima = altre.flatMap((f) => [...senzaCommenti(readFileSync(join(cartella, f), "utf8")).matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?VIEW\s+public\.shop_v_\w+[\s\S]*?;/gi)].map((m) => m[0]));
  c("le viste shop_v_* delle altre migrazioni sono quattro e nessuna cita il costo", [true, 0], [vistePrima.length >= 4, vistePrima.filter((v) => /costo/i.test(v)).length]);
  c("questa migrazione non ne ridefinisce nessuna e non nomina shop_v_ nel codice", 0, (sql.match(/shop_v_/g) || []).length);
}
