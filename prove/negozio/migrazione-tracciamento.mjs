/** ── SHOP R1 · T03 · MIGRAZIONE S3 (TRACCIAMENTO): TESTO SQL ───────────────────
 *  Qui NON gira un Postgres: si legge il testo di `20261120140000_tracciamento.sql`, i COMMENTI SI
 *  TOLGONO prima, e si controlla che sia fatta di sole aggiunte. La applica il titolare, a mano.
 *  Dati: nessuno (nomi di colonne e di tabelle, niente persone). */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FILE = "20261120140000_tracciamento.sql";

/** Le colonne che S3 aggiunge, per tabella (PIANO §4 S3, D32, D34). */
const COLONNE = {
  tracking_config: ["google_ga4_id", "google_ads_id", "google_ads_label_acquisto", "google_merchant_id"],
  public_leads: ["consenso_marketing", "consenso_ts"],
};
const ESITI = ["id", "piattaforma", "evento", "event_id", "esito", "creato_il"];

const senzaCommenti = (sql) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "").replace(/[ \t]+\n/g, "\n");
const piatto = (s) => s.replace(/\s+/g, " ").trim();

export async function prove(_mod, { c, gruppo, radice }) {
  gruppo("SHOP R1 · T03 · S3 TRACCIAMENTO: TESTO SQL (20/11/2026)");
  const percorso = join(radice, "supabase/migrations", FILE);
  c("S3 esiste col nome del piano", true, existsSync(percorso));
  if (!existsSync(percorso)) return;

  const grezzo = readFileSync(percorso, "utf8");
  const sql = senzaCommenti(grezzo);
  const stmt = sql.split(";").map(piatto).filter(Boolean);

  /* ── solo aggiunte ── */
  const ammessa = (s) =>
    /^NOTIFY pgrst, 'reload schema'$/.test(s) ||
    /^CREATE TABLE IF NOT EXISTS public\.tracciamento_proprietario \(/.test(s) ||
    /^ALTER TABLE public\.tracciamento_proprietario ENABLE ROW LEVEL SECURITY$/.test(s) ||
    /^REVOKE ALL ON (TABLE )?public\.tracciamento_proprietario FROM (PUBLIC, )?anon, authenticated$/.test(s) ||
    /^GRANT SELECT ON (TABLE )?public\.tracciamento_proprietario TO service_role$/.test(s) ||
    /^CREATE TABLE IF NOT EXISTS public\.tracciamento_esiti \(/.test(s) ||
    /^ALTER TABLE public\.tracciamento_esiti ENABLE ROW LEVEL SECURITY$/.test(s) ||
    /^REVOKE ALL ON (TABLE )?public\.tracciamento_esiti FROM (PUBLIC, )?anon, authenticated$/.test(s) ||
    /^CREATE INDEX IF NOT EXISTS \w+ ON public\.tracciamento_esiti \(/.test(s) ||
    (/^ALTER TABLE public\.(tracking_config|public_leads) ADD COLUMN IF NOT EXISTS /.test(s) &&
      s.split(/,\s*(?=ADD COLUMN)/).every((p) => /^(ALTER TABLE public\.\w+ )?ADD COLUMN IF NOT EXISTS \w+ [a-z]+( \([^)]*\))?$/i.test(p)));
  c("ogni istruzione di S3 è tra quelle ammesse (ADD COLUMN IF NOT EXISTS, le due tabelle nuove con RLS e REVOKE, indice, NOTIFY)", [], stmt.filter((s) => !ammessa(s)));
  c(
    "nessun DROP, TRUNCATE, DELETE, UPDATE, INSERT, ALTER COLUMN, RENAME, CREATE POLICY, CREATE OR REPLACE (fuori dai commenti)",
    Array(9).fill(0),
    [/\bDROP\b/i, /\bINSERT\b/i, /\bTRUNCATE\b/i, /\bDELETE\b/i, /\bUPDATE\b/i, /ALTER\s+COLUMN/i, /\bRENAME\b/i, /\bPOLICY\b/i, /CREATE\s+OR\s+REPLACE/i].map((r) =>
      r.test(sql) ? 1 : 0,
    ),
  );
  c("nessun INSERT su tracciamento_proprietario fuori dai commenti: nessun seme automatico (D35 corretta)", [0, 0], [(sql.match(/INSERT\s+INTO\s+public\.tracciamento_proprietario\b/gi) || []).length, (sql.match(/tracciamento_proprietario[^;]*\bSELECT\b[^;]*tracking_config/gi) || []).length]);
  c("l'unico GRANT è SELECT a service_role su tracciamento_proprietario", [1, 1], [(sql.match(/\bGRANT\b/gi) || []).length, (sql.match(/GRANT\s+SELECT\s+ON\s+public\.tracciamento_proprietario\s+TO\s+service_role/gi) || []).length]);
  c("nessuna transazione aperta dal file (il SQL Editor ne usa già una) e nessun `SET`", [0, 0], [/\b(BEGIN|COMMIT)\b/i, /^\s*SET\b/im].map((r) => (r.test(sql) ? 1 : 0)));

  /* ── le colonne ── */
  for (const [tabella, colonne] of Object.entries(COLONNE)) {
    const trovate = [...sql.matchAll(new RegExp(`ALTER TABLE public\\.${tabella}\\s+([^;]+);`, "gi"))]
      .flatMap((m) => [...m[1].matchAll(/ADD COLUMN IF NOT EXISTS\s+(\w+)/gi)].map((x) => x[1]))
      .sort();
    c(`${tabella}: aggiunge esattamente ${colonne.join(", ")}`, [...colonne].sort(), trovate);
  }
  c("`tiktok_test_event_code` NON è ripetuta (esiste già in tracking_config, D34)", false, /tiktok_test_event_code/i.test(sql));
  c(
    "le due colonne del consenso sono nullable e senza default (nessuna riga esistente cambia, D32)",
    [true, true],
    ["consenso_marketing boolean", "consenso_ts timestamptz"].map((def) => {
      const m = piatto(sql).match(new RegExp(`ADD COLUMN IF NOT EXISTS ${def}(?=,|;|\\s*$)`, "i"));
      return !!m && !/NOT NULL|DEFAULT/i.test(m[0]);
    }),
  );
  c(
    "nessuna colonna nuova di tracking_config o public_leads è NOT NULL o ha un DEFAULT",
    [],
    stmt.filter((s) => /^ALTER TABLE public\.(tracking_config|public_leads)/.test(s) && /NOT NULL|DEFAULT|REFERENCES|UNIQUE/i.test(s)),
  );

  /* ── la tabella nuova ── */
  const creazione = stmt.find((s) => /^CREATE TABLE IF NOT EXISTS public\.tracciamento_esiti/.test(s)) ?? "";
  const dentro = creazione.slice(creazione.indexOf("(") + 1, creazione.lastIndexOf(")"));
  const nomiColonne = dentro.split(/,\s*(?![^()]*\))/).map((p) => p.trim().split(/\s+/)[0]).filter(Boolean);
  c("tracciamento_esiti ha le colonne del piano e nessun dato personale", ESITI, nomiColonne);
  c("`esito` è testo (solo un codice) e `creato_il` ha l'ora di default", [true, true], [/\besito text\b/i.test(dentro), /\bcreato_il timestamptz NOT NULL DEFAULT now\(\)/i.test(dentro)]);
  c("nessuna colonna di tracciamento_esiti può portare email, telefono, nome o indirizzo IP", [], nomiColonne.filter((n) => /mail|telefon|phone|nome|name|ip\b|user_agent|fbp|fbc|ttclid/i.test(n)));
  c(
    "tracciamento_esiti: protezione per riga accesa, REVOKE ad anon e authenticated, nessuna policy",
    [1, 1, 0],
    [/ALTER TABLE public\.tracciamento_esiti ENABLE ROW LEVEL SECURITY/i, /REVOKE ALL ON (TABLE )?public\.tracciamento_esiti FROM (PUBLIC, )?anon, authenticated/i, /CREATE POLICY/i].map(
      (r) => (r.test(sql) ? 1 : 0),
    ),
  );
  c("indice (piattaforma, creato_il desc) su tracciamento_esiti", true, /CREATE INDEX IF NOT EXISTS \w+ ON public\.tracciamento_esiti \(piattaforma, creato_il DESC\)/i.test(piatto(sql)));

  /* ── tracciamento_proprietario (D35) ── */
  const crea = stmt.find((s) => /^CREATE TABLE IF NOT EXISTS public\.tracciamento_proprietario/.test(s)) ?? "";
  const corpoP = crea.slice(crea.indexOf("(") + 1, crea.lastIndexOf(")"));
  c("tracciamento_proprietario: user_id uuid chiave primaria e creato_il con l'ora di default, e basta", [["user_id", "creato_il"], true, true], [
    corpoP.split(/,\s*(?![^()]*\))/).map((p) => p.trim().split(/\s+/)[0]).filter(Boolean),
    /\buser_id uuid PRIMARY KEY\b/i.test(corpoP),
    /\bcreato_il timestamptz NOT NULL DEFAULT now\(\)/i.test(corpoP),
  ]);
  c("tracciamento_proprietario: protezione per riga accesa, REVOKE ad anon e authenticated, GRANT SELECT a service_role, nessuna policy", [1, 1, 1, 0], [
    /ALTER TABLE public\.tracciamento_proprietario ENABLE ROW LEVEL SECURITY/i,
    /REVOKE ALL ON (TABLE )?public\.tracciamento_proprietario FROM (PUBLIC, )?anon, authenticated/i,
    /GRANT SELECT ON public\.tracciamento_proprietario TO service_role/i,
    /CREATE POLICY/i,
  ].map((r) => (r.test(sql) ? 1 : 0)));
  c("l'intestazione dà al titolare, COMMENTATI, il comando che scrive il proprietario (con l'email come segnaposto) e la query di controllo (email da auth.users)", [true, true, true, true], [
    /--\s+INSERT INTO public\.tracciamento_proprietario \(user_id\) SELECT id FROM auth\.users WHERE email = 'EMAIL-DEL-TITOLARE' ON CONFLICT DO NOTHING;/.test(grezzo),
    /select u\.email, p\.creato_il\s+--\s+from public\.tracciamento_proprietario p\s+--\s+join auth\.users u on u\.id = p\.user_id/i.test(grezzo),
    /NASCE VUOTA/.test(grezzo),
    /NON salvare gli ID/i.test(grezzo),
  ]);
  c("la tabella nasce vuota: niente istruzione che la riempie, né da tracking_config né da auth.users", false, /tracciamento_proprietario[^;]*\bFROM\s+(public\.tracking_config|auth\.users)/i.test(sql));

  /* ── tracking_config e public_leads non cambiano permessi ── */
  c("nessun ENABLE/DISABLE ROW LEVEL SECURITY né REVOKE su tracking_config e public_leads", [], stmt.filter((s) => /(tracking_config|public_leads)/.test(s) && /ROW LEVEL SECURITY|REVOKE/i.test(s)));
  c("chiede a PostgREST di ricaricare lo schema (le colonne nuove si vedono subito)", true, /NOTIFY pgrst, 'reload schema'/.test(sql));

  /* ── il file si legge: dice cosa fa, cosa non fa, come si annulla ── */
  c("la spiegazione in testa dice cosa fa, cosa non fa e come si annulla", [true, true, true], [/COSA FA/i, /COSA NON FA/i, /COME SI ANNULLA/i].map((r) => r.test(grezzo)));
  c("il file non contiene chiavi né token (nessuna stringa lunga da segreto)", false, /(eyJ[A-Za-z0-9_-]{20,}|sk_(live|test)_|EAA[A-Za-z0-9]{20,})/.test(grezzo));
}
