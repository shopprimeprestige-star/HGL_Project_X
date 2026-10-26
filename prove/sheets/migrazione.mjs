/** ── PROVE: LA MIGRAZIONE S1 (TESTO) ───────────────────────────────────────────────
 *
 *  Commessa 2026-10-25 (Sheets e sequenze WhatsApp), compito S. Qui NON gira un
 *  Postgres: si legge il testo di `20261025120000_sheets_ingresso.sql` e si
 *  controlla che dica quello che il piano vuole (solo aggiunte, tabella e
 *  funzioni chiuse, i passi nell'ordine giusto, nessun dato personale nel
 *  registro). Il lucchetto vero, il tetto e la doppia applicazione si provano
 *  su un Postgres vero con `prove/sql/sheets-lucchetto.sql` (vedi
 *  `prove/sql/LEGGIMI.md`): il database finto prova il TypeScript, non
 *  `pg_advisory_xact_lock`.
 *
 *  ⚠️ Nei controlli i commenti si TOLGONO prima: «come si annulla» contiene dei
 *   DROP, scritti apposta nel commento e mai eseguiti.
 *  Dati inventati: nessun numero vero.
 *
 *  `mod`: i moduli impacchettati. `aiuti`: `{ c, gruppo, radice }`. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const senzaCommenti = (sql) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "")
    .replace(/[ \t]+\n/g, "\n");

/** Il corpo di una funzione: dal suo CREATE al `$$;` che la chiude. */
const corpoFunzione = (sql, nome) => {
  const da = sql.indexOf(`FUNCTION public.${nome}(`);
  if (da < 0) return "";
  const fine = sql.indexOf("END $$;", da);
  return sql.slice(da, fine < 0 ? undefined : fine + 7);
};

export async function proveMigrazioneSheets(mod, { c, gruppo, radice }) {
  gruppo("SHEETS · S1, LA MIGRAZIONE (TESTO)");

  const percorso = join(radice, "supabase/migrations/20261025120000_sheets_ingresso.sql");
  c("S1 esiste col nome del piano", true, existsSync(percorso));
  if (!existsSync(percorso)) return;
  const grezzo = readFileSync(percorso, "utf8");
  const sql = senzaCommenti(grezzo);
  const alto = sql.toUpperCase();

  /* ── solo aggiunte ─────────────────────────────────────────────────────── */
  c(
    "niente DROP, DELETE, TRUNCATE fuori dai commenti",
    [false, false, false],
    [/\bDROP\b/.test(alto), /\bDELETE\b/.test(alto), /\bTRUNCATE\b/.test(alto)],
  );
  c("niente ALTER sulle tabelle che ci sono già (solo tabella nuova + RLS)", ["sheets_ingressi"], [...new Set([...alto.matchAll(/ALTER TABLE (?:PUBLIC\.)?(\w+)/g)].map((m) => m[1].toLowerCase()))]);
  c("«come si annulla» c'è, ma solo nel commento", [true, false], [/COME SI ANNULLA/.test(grezzo), /\bDROP\b/.test(alto)]);
  c(
    "si applica due volte senza errori: CREATE solo con IF NOT EXISTS o OR REPLACE",
    [0, 0],
    [
      (sql.match(/CREATE TABLE(?! IF NOT EXISTS)/gi) ?? []).length + (sql.match(/CREATE (?:UNIQUE )?INDEX(?! IF NOT EXISTS)/gi) ?? []).length,
      (sql.match(/CREATE FUNCTION/gi) ?? []).length,
    ],
  );

  /* ── il registro: niente dati personali ────────────────────────────────── */
  const tabella = (sql.match(/CREATE TABLE IF NOT EXISTS public\.sheets_ingressi \(([\s\S]*?)\n\);/) ?? [])[1] ?? "";
  const colonne = tabella
    .split("\n")
    .map((r) => r.trim().match(/^([a-z_]+)\s+(?:text|uuid|int|timestamptz)\b/)?.[1])
    .filter(Boolean);
  c(
    "sheets_ingressi: solo chiave, utente, scheda, esito, foglio, riga, due date",
    ["chiave", "user_id", "lead_id", "esito", "foglio", "riga", "ricevuto_il", "aggiornato_il"],
    colonne,
  );
  c("…nessuna colonna di telefono, nome, email o testo", false, colonne.some((k) => /tel|nome|cognome|mail|testo|data$|valori|riga_|corpo/.test(k)));
  c("chiave è la chiave primaria", true, /chiave\s+text PRIMARY KEY/.test(tabella));
  c(
    "gli esiti ammessi sono i sei del piano",
    ["in_corso", "nuovo", "ritorno_da_segnare", "ritorno", "gia_presente", "scartata"],
    [...(tabella.match(/CHECK \(esito IN \(([^)]*)\)/) ?? [, ""])[1].matchAll(/'(\w+)'/g)].map((m) => m[1]),
  );
  c("indice (user_id, ricevuto_il DESC)", true, /CREATE INDEX IF NOT EXISTS \w+ ON public\.sheets_ingressi \(user_id, ricevuto_il DESC\)/.test(sql));

  /* ── tutto chiuso ──────────────────────────────────────────────────────── */
  c("RLS accesa sulla tabella, nessuna policy", [true, false], [/ALTER TABLE public\.sheets_ingressi ENABLE ROW LEVEL SECURITY/.test(sql), /CREATE POLICY/i.test(sql)]);
  c("tolto tutto a PUBLIC, anon e authenticated sulla tabella", true, /REVOKE ALL ON TABLE public\.sheets_ingressi FROM PUBLIC, anon, authenticated/.test(sql));
  c("la tabella la può usare solo il server", true, /GRANT ALL ON TABLE public\.sheets_ingressi TO service_role/.test(sql));
  const FIRME = {
    sheets_ingresso_scrivi: "uuid, text, text, text, text, integer, jsonb",
    sheets_ingresso_esito: "uuid, text, text",
  };
  for (const [nome, firma] of Object.entries(FIRME)) {
    c(`${nome}: REVOKE da PUBLIC, anon, authenticated`, true, sql.includes(`REVOKE ALL ON FUNCTION public.${nome}(${firma}) FROM PUBLIC, anon, authenticated`));
    c(`${nome}: GRANT EXECUTE solo al server`, true, sql.includes(`GRANT EXECUTE ON FUNCTION public.${nome}(${firma}) TO service_role`));
    const f = corpoFunzione(sql, nome);
    c(`${nome}: SECURITY DEFINER con search_path fisso`, true, /SECURITY DEFINER SET search_path = public/.test(f));
    c(`${nome}: CREATE OR REPLACE`, true, new RegExp(`CREATE OR REPLACE FUNCTION public\\.${nome}\\(`).test(sql));
  }
  c("il server trova le funzioni subito (NOTIFY pgrst)", true, /NOTIFY pgrst, 'reload schema'/.test(sql));

  /* ── l'ordine dei passi di sheets_ingresso_scrivi ──────────────────────── */
  const f = corpoFunzione(sql, "sheets_ingresso_scrivi");
  const pos = (re) => f.search(re);
  const P = {
    giaRicevuta: pos(/WHERE s\.chiave = p_chiave AND s\.user_id = p_user_id/),
    lucchettoTetto: pos(/pg_advisory_xact_lock\(hashtextextended\('sheets-tetto\|'/),
    conto: pos(/SELECT count\(\*\) INTO v_n/),
    tetto: pos(/IF v_n >= v_tetto THEN/),
    registro: pos(/INSERT INTO public\.sheets_ingressi/),
    conflitto: pos(/ON CONFLICT \(chiave\) DO NOTHING/),
    lucchettoNumero: pos(/pg_advisory_xact_lock\(hashtextextended\('sheets\|'/),
    idMeta: pos(/l\.data->>'metaLeadId' = p_meta_id/),
    numero: pos(/right\(regexp_replace/),
    nuova: pos(/INSERT INTO public\.crm_leads/),
  };
  c("tutti i passi ci sono", [], Object.entries(P).filter(([, v]) => v < 0).map(([k]) => k));
  const inOrdine = (...chiavi) => chiavi.every((k, i) => i === 0 || P[chiavi[i - 1]] < P[k]);
  c("0. la chiave già ricevuta si guarda per prima", true, inOrdine("giaRicevuta", "lucchettoTetto"));
  c("0b. il tetto: lucchetto, conto, confronto, e SOLO POI il registro", true, inOrdine("lucchettoTetto", "conto", "tetto", "registro"));
  c("1. ON CONFLICT (chiave) DO NOTHING prima del lucchetto sul numero", true, inOrdine("conflitto", "lucchettoNumero"));
  c("2. il lucchetto sul numero prima di ogni ricerca", true, inOrdine("lucchettoNumero", "idMeta", "numero"));
  c("3. la ricerca per id Meta prima di quella per numero", true, inOrdine("idMeta", "numero"));
  c("4. la scheda nuova si crea per ultima", true, inOrdine("numero", "nuova"));
  c("l'id Meta si cerca su metaLeadId e su datiFile.id (schede da file)", true, /l\.data->>'metaLeadId' = p_meta_id OR l\.data->'datiFile'->>'id' = p_meta_id/.test(f));
  c("il numero: [^0-9] come \\D di JavaScript, almeno 6 cifre, le ultime 9", [true, true, true], [f.includes("'[^0-9]'"), />= 6/.test(f), /right\(regexp_replace\(coalesce\(l\.data->>'telefono', ''\), '\[\^0-9\]', '', 'g'\), 9\) = p_tel9/.test(f)]);
  c("il ritorno e l'id Meta cercano la scheda PIÙ VECCHIA dell'utente", [2, 2], [(f.match(/ORDER BY l\.created_at, l\.id/g) ?? []).length, (f.match(/l\.user_id = p_user_id/g) ?? []).length]);
  c("il tetto è nel giorno di Roma", true, /AT TIME ZONE 'Europe\/Rome'/.test(f));
  c("ogni lettura e scrittura del registro porta user_id (o parte da chiave unica)", true, (f.match(/s\.user_id = p_user_id/g) ?? []).length >= 2);

  /* ── il tetto è 300, scritto una volta, uguale al TypeScript ───────────── */
  const tetti = [...f.matchAll(/v_tetto constant int := (\d+)/g)].map((m) => Number(m[1]));
  c("TETTO_RIGHE_GIORNO: 300 una volta sola nel codice SQL", [300], tetti);
  c("…uguale a quello del TypeScript (che lo mostra nel riquadro)", tetti[0], mod["sheets/ingresso"].TETTO_RIGHE_GIORNO);
  c("…e il nome sta nel commento", true, /TETTO_RIGHE_GIORNO/.test(grezzo));

  /* ── nessun errore con il contenuto della scheda ───────────────────────── */
  c("nessun RAISE, nessun SQLERRM: gli errori restano quelli di Postgres, di cui la rotta tiene il codice", [false, false], [/\bRAISE\b/i.test(sql), /SQLERRM/i.test(sql)]);
  c("la scheda (p_data) entra solo nell'INSERT di crm_leads", 1, (sql.match(/p_data/g) ?? []).length - (sql.match(/p_data\s+jsonb/g) ?? []).length);

  /* ── il modello della ricerca del numero è quello del CRM ─────────────── */
  const TEL = mod["telefono-doppio"];
  const campioni = ["+39 333 0000101", "333.000.0101", "(0)39-333/0000101", "٣٣٣0000101", "tel 3330000101 int. 5", "12345", ""];
  const sqlCome = (t) => {
    const cifre = String(t).replace(/[^0-9]/g, "");
    return cifre.length >= 6 ? cifre.slice(-9) : "";
  };
  c("la chiave del numero in SQL ([^0-9]) = chiaveTelefono del CRM, su sette scritture", campioni.map((t) => TEL.chiaveTelefono(t)), campioni.map(sqlCome));

  /* ── il collaudo su Postgres vero è pronto (non si lancia qui) ─────────── */
  c("prove/sql/sheets-lucchetto.sql e il suo LEGGIMI ci sono", [true, true], [existsSync(join(radice, "prove/sql/sheets-lucchetto.sql")), existsSync(join(radice, "prove/sql/LEGGIMI.md"))]);
}
