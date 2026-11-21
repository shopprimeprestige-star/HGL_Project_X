/** ── SHOP R1 · T32 fase 2 · D40 · LA MIGRAZIONE CHE ESENTA INVISIBLE DERM DAL PREZZO (TESTO SQL) ──────────
 *  Qui NON gira un Postgres: si legge il testo di `20261121120000_shop_invisible_derm.sql` (COMMENTI TOLTI prima).
 *  Il comportamento vero sta in `prove/sql/shop-invisible-derm.sql` (Postgres usa-e-getta). La applica il TITOLARE.
 *  Cosa deve valere:
 *   · viene DOPO S1 e fa una cosa sola: `CREATE OR REPLACE FUNCTION public.shop_controlla_pubblicazione()` (+ REVOKE come S1);
 *     nessun DROP, DELETE, UPDATE, INSERT, TRUNCATE, ALTER, nuovo trigger: nessun dato cambia;
 *   · gli altri controlli di S1 restano IDENTICI (descrizione, categoria, foto principale, variante attiva con SKU);
 *   · il prezzo > 0 si chiede a tutti TRANNE a Invisible Derm, riconosciuto come `eInvisibleDerm` di `pubblico.ts`
 *     (nome ancorato all'inizio o slug che comincia con `invisible-derm`): l'espressione del database, tradotta in JS,
 *     dà gli stessi sì e no della funzione del sito su una lista di nomi. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FILE = "20261121120000_shop_invisible_derm.sql";
const S1 = "20261120120000_shop_catalogo.sql";
const senzaCommenti = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").replace(/[ \t]+\n/g, "\n");
const piatto = (s) => s.replace(/\s+/g, " ").trim();

export async function prove(mod, { c, gruppo, radice }) {
  gruppo("SHOP R1 · T32 f2 · D40 · INVISIBLE DERM SENZA PREZZO NEL TRIGGER: TESTO SQL (21/11/2026)");
  const percorso = join(radice, "supabase/migrations", FILE);
  c("la migrazione esiste col nome deciso e viene dopo S1 e dopo ogni altra", [true, true], [
    existsSync(percorso),
    existsSync(percorso) && FILE > S1,
  ]);
  c("l'impalcatura SQL c'è: il collaudo su Postgres usa-e-getta e il LEGGIMI lo nomina", [true, true], [
    existsSync(join(radice, "prove/sql/shop-invisible-derm.sql")),
    existsSync(join(radice, "prove/sql/LEGGIMI.md")) && /shop-invisible-derm\.sql/.test(readFileSync(join(radice, "prove/sql/LEGGIMI.md"), "utf8")),
  ]);
  if (!existsSync(percorso)) return;

  const grezzo = readFileSync(percorso, "utf8");
  const sql = senzaCommenti(grezzo);
  const corpi = [...sql.matchAll(/\$\$([\s\S]*?)\$\$/g)].map((m) => m[1]);
  const fuori = sql.replace(/\$\$[\s\S]*?\$\$/g, () => "$$…$$");
  const stmt = fuori.split(";").map(piatto).filter(Boolean);
  const corpo = corpi[0] ?? "";
  const s1 = senzaCommenti(readFileSync(join(radice, "supabase/migrations", S1), "utf8"));
  const corpoS1 = [...s1.matchAll(/\$\$([\s\S]*?)\$\$/g)].map((m) => m[1]).find((b) => /shop_pubblicazione_negata/.test(b)) ?? "";

  /* ── solo la funzione, nessun dato ── */
  c("una sola funzione (un solo corpo $$…$$) e nient'altro che CREATE OR REPLACE FUNCTION, REVOKE e NOTIFY", [1, []], [
    corpi.length,
    stmt.filter((s) => !(/^CREATE OR REPLACE FUNCTION public\.shop_controlla_pubblicazione\(\) RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS \$\$…\$\$$/.test(s) ||
      s === "REVOKE ALL ON FUNCTION public.shop_controlla_pubblicazione() FROM PUBLIC, anon, authenticated" ||
      /^(BEGIN|COMMIT)$/.test(s) || s === "NOTIFY pgrst, 'reload schema'")),
  ]);
  c("nessun DROP, TRUNCATE, DELETE, UPDATE, INSERT, ALTER, RENAME, CREATE TRIGGER, GRANT (corpo compreso): nessun dato e nessun permesso cambia", Array(9).fill(0),
    [/\bDROP\b/i, /\bTRUNCATE\b/i, /\bDELETE\b/i, /\bUPDATE\b/i, /\bINSERT\b/i, /\bALTER\b/i, /\bRENAME\b/i, /CREATE\s+(OR\s+REPLACE\s+)?TRIGGER/i, /\bGRANT\b/i].map((r) => (r.test(sql) ? 1 : 0)));
  c("la funzione è del database (nessun GRANT) e il REVOKE c'è, come in S1", true, /REVOKE ALL ON FUNCTION public\.shop_controlla_pubblicazione\(\) FROM PUBLIC, anon, authenticated/.test(piatto(sql)));

  /* ── gli altri controlli di S1 restano IDENTICI ── */
  const frasi = (b) => [...b.matchAll(/RAISE EXCEPTION '([^']*)'/g)].map((m) => m[1]);
  const pezzo = (b, da, a) => piatto(b.slice(b.indexOf(da), b.indexOf(a)));
  c("le quattro frasi di rifiuto di S1 ci sono ancora, nello stesso ordine (la quarta può dire «SKU» senza il prezzo per Invisible Derm)", true,
    frasi(corpoS1).slice(0, 3).every((f, i) => frasi(corpo)[i] === f) && frasi(corpo).length >= 4 && frasi(corpo).every((f) => /^shop_pubblicazione_negata: manca /.test(f)));
  c("descrizione breve, categoria e foto principale (alt, non rimossa, liberatoria se ritrae persone): i tre controlli sono uguali a S1", true,
    pezzo(corpo, "IF btrim(COALESCE(NEW.descrizione_breve", "IF NOT EXISTS (\n    SELECT 1 FROM public.shop_varianti") === pezzo(corpoS1, "IF btrim(COALESCE(NEW.descrizione_breve", "IF NOT EXISTS (\n    SELECT 1 FROM public.shop_varianti") &&
    /m\.slot = 'principale'[\s\S]*m\.rimosso_il IS NULL[\s\S]*btrim\(COALESCE\(m\.alt, ''\)\) <> ''[\s\S]*NOT m\.ritrae_persone OR m\.liberatoria_ok/.test(corpo));
  c("la variante resta: ATTIVA, con SKU non vuoto, sullo stesso prodotto", [true, true, true], [/v\.prodotto_id = NEW\.id/.test(corpo), /v\.attiva/.test(corpo), /btrim\(COALESCE\(v\.sku, ''\)\) <> ''/.test(corpo)]);
  c("il prezzo effettivo > 0 resta per tutti gli altri: COALESCE(v.prezzo_cent, NEW.prezzo_cent) > 0 dentro il controllo della variante", true,
    /\(v_senza_prezzo OR COALESCE\(v\.prezzo_cent, NEW\.prezzo_cent\) > 0\)/.test(corpo));
  c("l'errore resta check_violation e il trigger restituisce NEW", [true, true], [(corpo.match(/ERRCODE = 'check_violation'/g) || []).length === frasi(corpo).length, /RETURN NEW;/.test(corpo)]);

  /* ── l'esenzione è la stessa di `eInvisibleDerm` ── */
  const nome = /NEW\.nome ~\* '([^']+)'/.exec(corpo)?.[1] ?? "";
  const slug = /NEW\.slug ~\* '([^']+)'/.exec(corpo)?.[1] ?? "";
  c("il nome si confronta senza maiuscole (~*), ancorato all'inizio (^), con `derm` a parola intera e senza «atolog»", [true, true, true, true], [
    nome.startsWith("^"), /\\y/.test(nome), /\(\?!atolog\)/.test(nome), /invisibi\?l\[ei\]/.test(nome),
  ]);
  c("lo slug comincia con `invisible-derm`", true, /^\^\[\[:space:\]\]\*invisible-derm$/.test(slug));
  c("l'espressione è calcolata sul prodotto stesso (NEW.nome, NEW.slug), non su altri campi", true, /v_senza_prezzo :=\s*NEW\.nome ~\*[^;]*NEW\.slug ~\*/.test(corpo));
  // POSIX (database) → JS: `[:space:]` = `\s`, `\y` = `\b`
  const aJs = (re) => new RegExp(re.replace(/\[:space:\]/g, "\\s").replace(/\\y/g, "\\b"), "i");
  const reNome = aJs(nome);
  const reSlug = aJs(slug);
  const eDelDb = (n, s) => reNome.test(n) || reSlug.test(s);
  const E = mod["shop/cms/pubblico"]?.eInvisibleDerm;
  const NOMI = [
    "Invisible Derm", "invisible derm", "INVISIBLE DERM", "Invisible-Derm", "Invisible_Derm", "InvisibleDerm", "  Invisible Derm", "Invisible Derm Nero",
    "Invisibile Derm", "Invisible & Derm", "Invisible. Derm", "Invisible/Derm", "Invisible Derm®",
    "Solvente per Invisible Derm", "Kit Invisible Derm", "Colla Invisible Derm", "Invisible Dermatologico", "Invisible Dermatologic",
    "Shampoo", "", "Derm Invisible", "Invisible", "Invisiblederm Pro",
  ];
  const SLUGS = ["invisible-derm", "invisible-derm-nero", "Invisible-Derm", " invisible-derm", "kit-invisible-derm", "solvente-invisible-derm", "shampoo", "invisible", "invisible-dermatologico"];
  const diversi = [];
  for (const n of NOMI) if (eDelDb(n, "x") !== E(n, "x")) diversi.push(["nome", n, eDelDb(n, "x"), E(n, "x")]);
  for (const s of SLUGS) if (eDelDb("Prodotto", s) !== E("Prodotto", s)) diversi.push(["slug", s, eDelDb("Prodotto", s), E("Prodotto", s)]);
  c("lo stesso riconoscimento di `eInvisibleDerm` (pubblico.ts) su 23 nomi e 9 slug: nessuna differenza", [], diversi);
  c("…e i casi che contano: «Invisible Derm» sì, «Solvente per Invisible Derm» no, «Invisible Dermatologico» no, slug «invisible-derm-nero» sì, slug «kit-invisible-derm» no", [true, false, false, true, false], [
    eDelDb("Invisible Derm", "x"), eDelDb("Solvente per Invisible Derm", "x"), eDelDb("Invisible Dermatologico", "x"), eDelDb("Prodotto", "invisible-derm-nero"), eDelDb("Prodotto", "kit-invisible-derm"),
  ]);
  c("la regex di POSTGRES non usa niente che non esista in Postgres: niente `\\b` (là è il backspace), niente `\\s`, niente `(?i)`, niente `\\/`", [false, false, false, false], [/\\b/.test(nome + slug), /\\s/.test(nome + slug), /\(\?i\)/.test(nome + slug), /\\\//.test(nome + slug)]);
}
