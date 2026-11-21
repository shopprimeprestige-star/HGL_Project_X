/** ── SHOP R2 · T42 · S5 SPEDIZIONI: TESTO SQL (21/11/2026) ──────────────────────────────────────────────────
 *  Qui NON gira un Postgres: si legge il testo di `20261122130000_shop_spedizioni.sql` (COMMENTI TOLTI prima, e
 *  distinguendo il testo FUORI dai corpi delle funzioni da quello DENTRO). Il comportamento vero sta in
 *  `prove/sql/shop-spedizioni.sql` (Postgres usa-e-getta), che rifà gli scenari di `_scenari-soldi.json`.
 *  Cosa deve valere (PIANO-R2 §4 «S5», D51, D62):
 *   · una tabella nuova `shop_spedizioni_tariffe` con le colonne di `tariffaSeme()` del finto (T40): se il finto e il SQL divergono
 *     le prove di T50 mentono; paese solo `IT`, costo ≥ 0, una sola tariffa attiva per paese (indice unico PARZIALE);
 *   · RLS accesa e nessuna policy; niente ad anon/authenticated; a service_role solo la lettura (si scrive con la funzione);
 *   · il seme: id fisso, «Spedizione tracciata in Italia», 490, attiva, provvisoria, `ON CONFLICT (id) DO NOTHING`;
 *   · `shop_tariffa_imposta(p_id, p_atteso, p_campi, p_conferma, p_chi)`: SECURITY DEFINER, search_path, blocco di riga,
 *     confronto-e-scambio, errori col messaggio e il codice del finto, riga di storico, chiusa ad anon/authenticated;
 *   · i due semi di `shop_impostazioni` (`corrieri` senza indirizzi, `resi_confermati = false`), mai riscritti;
 *   · solo aggiunte: nessun DELETE, DROP, TRUNCATE in nessun punto (corpi compresi, anche nei commenti: li cerca il revisore con grep);
 *     nessun UPDATE fuori dai corpi; dentro, solo `shop_spedizioni_tariffe`; nessun trigger. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ERRORI_SQL_R2, FUNZIONI_R2 } from "./_finto-db.mjs";
import { ID_TARIFFA_SEME, tariffaSeme } from "./_dati-r2.mjs";

const FILE = "20261122130000_shop_spedizioni.sql";
const senzaCommenti = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").replace(/[ \t]+\n/g, "\n");
const piatto = (s) => s.replace(/\s+/g, " ").trim();

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("SHOP R2 · T42 · S5 SPEDIZIONI: TESTO SQL (21/11/2026)");
  const percorso = join(radice, "supabase/migrations", FILE);
  const migrazioni = join(radice, "supabase/migrations");
  c("S5 esiste col nome del piano e viene dopo S1 e dopo ogni altra migrazione del R1", [true, true], [
    existsSync(percorso),
    existsSync(percorso) && ["20261120120000_shop_catalogo.sql", "20261120140000_tracciamento.sql", "20261121120000_shop_invisible_derm.sql"].every((f) => FILE > f && existsSync(join(migrazioni, f))),
  ]);
  c("il collaudo su Postgres usa-e-getta esiste e il suo testo non lancia mai sul database vero (si ferma se il nome non contiene «prova»)", [true, true], [
    existsSync(join(radice, "prove/sql/shop-spedizioni.sql")),
    existsSync(join(radice, "prove/sql/shop-spedizioni.sql")) && /current_database\(\) NOT ILIKE '%prova%'/.test(readFileSync(join(radice, "prove/sql/shop-spedizioni.sql"), "utf8")),
  ]);
  if (!existsSync(percorso)) return;

  const grezzo = readFileSync(percorso, "utf8");
  const sql = senzaCommenti(grezzo);
  const corpi = [...sql.matchAll(/\$\$([\s\S]*?)\$\$/g)].map((m) => m[1]);
  const fuori = sql.replace(/\$\$[\s\S]*?\$\$/g, () => "$$…$$");
  const stmt = fuori.split(";").map(piatto).filter(Boolean);

  /* ── l'intestazione in italiano ── */
  c("in testa: cosa fa, cosa non fa, come si annulla, in che ordine si applica", [true, true, true, true], [/COSA FA/.test(grezzo), /COSA NON FA/.test(grezzo), /COME SI ANNULLA/.test(grezzo), /ORDINE/.test(grezzo)]);

  /* ── solo aggiunte ── */
  c("nessun DELETE, DROP, TRUNCATE in nessun punto del file, corpo della funzione e commenti compresi", [0, 0, 0], [/\bDELETE\b/i, /\bDROP\b/i, /\bTRUNCATE\b/i].map((r) => (r.test(grezzo) ? 1 : 0)));
  c("nessun ALTER … RENAME, nessun ALTER COLUMN, nessun trigger (S5 non ne ha), nessuna policy", [0, 0, 0, 0], [/\bRENAME\b/i, /ALTER\s+COLUMN/i, /CREATE\s+(OR\s+REPLACE\s+)?TRIGGER/i, /\bPOLICY\b/i].map((r) => (r.test(sql) ? 1 : 0)));
  c("nessun UPDATE fuori dal corpo della funzione", 0, (fuori.match(/\bUPDATE\b/gi) || []).length);
  c("dentro il corpo, l'unico UPDATE è su shop_spedizioni_tariffe", [1, 1], [(corpi.join("\n").match(/(?<!FOR )\bUPDATE\b/gi) || []).length, (corpi.join("\n").match(/\bUPDATE\s+public\.shop_spedizioni_tariffe\b/gi) || []).length]);
  c("dentro il corpo, l'unico INSERT è lo storico (riga per campo cambiato)", [true, 0], [
    [...corpi.join("\n").matchAll(/\bINSERT\s+INTO\s+(\S+)/gi)].every((m) => m[1] === "public.shop_storico"),
    [...corpi.join("\n").matchAll(/\bINSERT\s+INTO\s+(\S+)/gi)].filter((m) => m[1] !== "public.shop_storico").length,
  ]);
  const ammessa = (s) =>
    /^(BEGIN|COMMIT)$/.test(s) ||
    /^DO \$\$…\$\$$/.test(s) ||
    /^CREATE TABLE IF NOT EXISTS public\.shop_spedizioni_tariffe \(/.test(s) ||
    /^CREATE UNIQUE INDEX IF NOT EXISTS \w+ ON public\.shop_spedizioni_tariffe \(paese\) WHERE attiva$/.test(s) ||
    s === "ALTER TABLE public.shop_spedizioni_tariffe ENABLE ROW LEVEL SECURITY" ||
    s === "REVOKE ALL ON TABLE public.shop_spedizioni_tariffe FROM PUBLIC, anon, authenticated" ||
    s === "REVOKE ALL ON TABLE public.shop_spedizioni_tariffe FROM service_role" ||
    s === "GRANT SELECT ON TABLE public.shop_spedizioni_tariffe TO service_role" ||
    /^INSERT INTO public\.shop_spedizioni_tariffe \(/.test(s) ||
    /^INSERT INTO public\.shop_impostazioni \(chiave, valore\)/.test(s) ||
    /^CREATE OR REPLACE FUNCTION public\.shop_tariffa_imposta\(.*\) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS \$\$…\$\$$/.test(s) ||
    /^REVOKE ALL ON FUNCTION public\.shop_tariffa_imposta\(uuid, timestamptz, jsonb, boolean, text\) FROM PUBLIC, anon, authenticated$/.test(s) ||
    s === "GRANT EXECUTE ON FUNCTION public.shop_tariffa_imposta(uuid, timestamptz, jsonb, boolean, text) TO service_role" ||
    s === "NOTIFY pgrst, 'reload schema'";
  c("ogni istruzione fuori dal corpo è tra quelle ammesse (tabella, indice, RLS, REVOKE/GRANT, due INSERT di semi, funzione, NOTIFY)", [], stmt.filter((s) => !ammessa(s)));
  c("il file è una transazione sola: BEGIN all'inizio e COMMIT prima del NOTIFY (come S1)", true, stmt[0] === "BEGIN" && stmt.indexOf("COMMIT") === stmt.length - 2 && stmt.at(-1) === "NOTIFY pgrst, 'reload schema'");

  /* ── il controllo iniziale: senza S1 si ferma senza scrivere ── */
  const guardia = piatto(corpi[0] ?? "");
  c("controllo iniziale (DO): senza S1 (shop_storico e shop_impostazioni) il file si ferma con un messaggio chiaro, prima di scrivere", [true, true, true], [
    /to_regclass\('public\.shop_storico'\) IS NULL/.test(guardia) && /to_regclass\('public\.shop_impostazioni'\) IS NULL/.test(guardia),
    /RAISE EXCEPTION '[^']*S1[^']*'/.test(guardia),
    stmt.findIndex((s) => /^DO \$\$/.test(s)) === 1,
  ]);

  /* ── la tabella ── */
  const tabella = piatto(grezzo.length ? (sql.match(/CREATE TABLE IF NOT EXISTS public\.shop_spedizioni_tariffe \(([\s\S]*?)\);/)?.[1] ?? "") : "");
  const colonne = [...tabella.matchAll(/(?:^|, )(\w+) (?:uuid|text|integer|boolean|timestamptz)\b/g)].map((m) => m[1]);
  c("le colonne sono quelle del finto di T40 (`tariffaSeme`), né una di più né una di meno", Object.keys(tariffaSeme()).sort(), [...colonne].sort());
  c("paese ammette solo IT; costo, soglia e giorni non negativi (i giorni da 1 in su); il nome non è vuoto", [true, true, true, true], [
    /paese text NOT NULL DEFAULT 'IT' CHECK \(paese = 'IT'\)/.test(tabella), /costo_cent integer NOT NULL CHECK \(costo_cent >= 0\)/.test(tabella),
    /gratis_da_cent integer CHECK \(gratis_da_cent >= 0\)/.test(tabella) && /giorni_min integer CHECK \(giorni_min >= 1\)/.test(tabella) && /giorni_max integer CHECK \(giorni_max >= 1\)/.test(tabella),
    /nome text NOT NULL CHECK \(btrim\(nome\) <> ''\)/.test(tabella),
  ]);
  c("attiva e provvisoria hanno un valore di partenza e ci sono le due date (creato_il, aggiornato_il)", [true, true, true], [
    /attiva boolean NOT NULL DEFAULT true/.test(tabella), /provvisoria boolean NOT NULL DEFAULT true/.test(tabella),
    /creato_il timestamptz NOT NULL DEFAULT now\(\)/.test(tabella) && /aggiornato_il timestamptz NOT NULL DEFAULT now\(\)/.test(tabella),
  ]);
  c("una sola tariffa attiva per paese: indice unico PARZIALE su (paese) WHERE attiva", true, /CREATE UNIQUE INDEX IF NOT EXISTS \w+ ON public\.shop_spedizioni_tariffe \(paese\) WHERE attiva;/.test(sql.replace(/\s+/g, " ")));
  c("RLS accesa, nessuna policy, niente ad anon/authenticated, a service_role prima si toglie tutto e poi solo SELECT (si scrive con la funzione)", [true, true, true, true, true, 1], [
    stmt.includes("ALTER TABLE public.shop_spedizioni_tariffe ENABLE ROW LEVEL SECURITY"),
    stmt.includes("REVOKE ALL ON TABLE public.shop_spedizioni_tariffe FROM PUBLIC, anon, authenticated"),
    stmt.indexOf("REVOKE ALL ON TABLE public.shop_spedizioni_tariffe FROM service_role") > -1 && stmt.indexOf("REVOKE ALL ON TABLE public.shop_spedizioni_tariffe FROM service_role") < stmt.indexOf("GRANT SELECT ON TABLE public.shop_spedizioni_tariffe TO service_role"),
    stmt.includes("GRANT SELECT ON TABLE public.shop_spedizioni_tariffe TO service_role"),
    !/GRANT\s+(ALL|INSERT|UPDATE)[^;]*shop_spedizioni_tariffe/i.test(sql),
    (sql.match(/\bGRANT\s+SELECT\b/gi) || []).length,
  ]);

  /* ── il seme ── */
  const seme = stmt.find((s) => /^INSERT INTO public\.shop_spedizioni_tariffe \(/.test(s)) ?? "";
  c("il seme: id fisso del finto, «Spedizione tracciata in Italia», 490, attiva, provvisoria; niente soglia, tempi o corriere (vuoti: non si mostrano); mai riscritto (ON CONFLICT (id) DO NOTHING)", true,
    seme === `INSERT INTO public.shop_spedizioni_tariffe (id, paese, nome, costo_cent, attiva, provvisoria) VALUES ('${ID_TARIFFA_SEME}', 'IT', 'Spedizione tracciata in Italia', 490, true, true) ON CONFLICT (id) DO NOTHING`);
  c("490 compare una volta sola nel file", 1, (sql.match(/\b490\b/g) || []).length);

  /* ── i semi delle impostazioni ── */
  const impo = stmt.find((s) => /^INSERT INTO public\.shop_impostazioni \(chiave, valore\)/.test(s)) ?? "";
  c("semi di shop_impostazioni: `corrieri` (elenco di nomi con indirizzo vuoto) e `resi_confermati` = false, mai riscritti", [true, true, true, true], [
    /'corrieri'/.test(impo), /'resi_confermati', 'false'::jsonb/.test(impo), /ON CONFLICT \(chiave\) DO NOTHING$/.test(impo),
    (() => { // il JSON dei corrieri è valido, ogni voce ha un nome e un modello di link VUOTO
      const m = impo.match(/'corrieri', '(\[.*?\])'::jsonb/);
      if (!m) return false;
      try { const v = JSON.parse(m[1]); return Array.isArray(v) && v.length > 0 && v.length <= 20 && v.every((x) => typeof x.nome === "string" && x.nome.trim() !== "" && x.nome.length <= 40 && x.modello === "" && Object.keys(x).length === 2); } catch { return false; }
    })(),
  ]);

  /* ── la funzione ── */
  const corpo = corpi[1] ?? "";
  const cor = piatto(corpo);
  const firma = piatto(sql.match(/CREATE OR REPLACE FUNCTION public\.shop_tariffa_imposta\(([\s\S]*?)\)\s*RETURNS boolean/)?.[1] ?? "");
  c("la funzione c'è, è una sola, ha i parametri `p_…` del finto e risponde boolean", [["shop_tariffa_imposta"], 1, "p_id uuid, p_atteso timestamptz, p_campi jsonb, p_conferma boolean, p_chi text"], [FUNZIONI_R2.S5, (sql.match(/CREATE OR REPLACE FUNCTION/g) || []).length, firma]);
  c("SECURITY DEFINER con search_path = public; REVOKE ad anon/authenticated/PUBLIC; EXECUTE solo a service_role", [true, true, 1], [
    stmt.some((s) => /^CREATE OR REPLACE FUNCTION public\.shop_tariffa_imposta\(.*SECURITY DEFINER SET search_path = public AS/.test(s)),
    stmt.includes("REVOKE ALL ON FUNCTION public.shop_tariffa_imposta(uuid, timestamptz, jsonb, boolean, text) FROM PUBLIC, anon, authenticated") &&
      stmt.includes("GRANT EXECUTE ON FUNCTION public.shop_tariffa_imposta(uuid, timestamptz, jsonb, boolean, text) TO service_role"),
    (sql.match(/\bGRANT\s+EXECUTE\b/gi) || []).length,
  ]);
  c("la riga si blocca prima di leggerla (FOR UPDATE) e il valore visto si confronta con quello di adesso (alla fine dei millisecondi, come il finto)", [true, true], [
    /SELECT \* INTO v_t FROM public\.shop_spedizioni_tariffe WHERE id = p_id FOR UPDATE/.test(cor),
    /date_trunc\('milliseconds', p_atteso\) IS DISTINCT FROM date_trunc\('milliseconds', v_t\.aggiornato_il\)/.test(cor),
  ]);
  // Gli errori: stesso messaggio e stesso nome di codice del finto
  const errori = [...corpo.matchAll(/RAISE EXCEPTION '(\w+)'\s*USING ERRCODE = '(\w+)'/g)].map((m) => [m[1], m[2]]);
  c("errori: `tariffa_inesistente` e `tariffa_campo_non_valido` col messaggio e il codice del finto", [["no_data_found", "invalid_parameter_value"], true], [
    ["tariffa_inesistente", "tariffa_campo_non_valido"].map((n) => errori.find((e) => e[0] === n)?.[1]),
    errori.every(([n, k]) => ERRORI_SQL_R2[n]?.errcode === k),
  ]);
  const ammessi = [...cor.matchAll(/WHEN v_campo IN \(([^)]*)\)/g)].flatMap((m) => [...m[1].matchAll(/'(\w+)'/g)].map((x) => x[1])).concat([...cor.matchAll(/WHEN v_campo = '(\w+)'/g)].map((m) => m[1])).sort();
  c("i campi ammessi sono quelli del finto: nome, corriere, costo_cent, gratis_da_cent, giorni_min, giorni_max, attiva (non paese, non provvisoria, non confermata_il); ogni altro → ELSE false", ["attiva,corriere,costo_cent,giorni_max,giorni_min,gratis_da_cent,nome", true], [
    ammessi.join(","), /ELSE false\s+END;\s+IF NOT v_ok THEN\s+RAISE EXCEPTION 'tariffa_campo_non_valido'/.test(cor),
  ]);
  c("confermare toglie `provvisoria` e scrive `confermata_il` SOLO con p_conferma; ogni scrittura aggiorna `aggiornato_il` con l'orologio vero (clock_timestamp: non torna indietro)", [true, true, true], [
    /provvisoria = CASE WHEN p_conferma IS TRUE THEN false ELSE provvisoria END/.test(cor),
    /confermata_il = CASE WHEN p_conferma IS TRUE THEN clock_timestamp\(\) ELSE confermata_il END/.test(cor),
    /aggiornato_il = clock_timestamp\(\)/.test(cor),
  ]);
  c("ogni campo cambiato lascia una riga in shop_storico (entita 'tariffa'), e la conferma una riga col campo 'confermata'; `chi` mai vuoto, al massimo 80 segni", [true, true, true], [
    /INSERT INTO public\.shop_storico \(entita, entita_id, campo, prima, dopo, chi\)/.test(cor) && /'tariffa'/.test(cor),
    /'confermata'/.test(cor),
    /left\(COALESCE\(NULLIF\(btrim\(p_chi\), ''\), 'sconosciuto'\), 80\)/.test(cor),
  ]);
  c("`NOTIFY pgrst` in fondo e nessun GRANT/REVOKE ad anon o authenticated oltre al REVOKE", 0, (sql.match(/GRANT[^;]*\b(anon|authenticated)\b/gi) || []).length);
}
