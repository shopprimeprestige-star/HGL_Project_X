/** ── PROVE: LA MIGRAZIONE DEL PONTE (testo SQL) ──
 *
 *  File d'area della commessa 2026-10-29-ponte-whatsapp-baileys, compito T1.
 *  Come `prove/manychat/chat-migrazione.mjs`: qui NON gira un Postgres. Si
 *  legge il testo di `20261029120000_ponte_whatsapp.sql` (i commenti si
 *  TOLGONO prima: il «come si annulla» ha DROP e DELETE scritti apposta e mai
 *  eseguiti) e si controlla il §e del PIANO: solo aggiunte, l'indice UNICO su
 *  `duplicato_di`, la `unique_violation` gestita per coppia, `failed` escluso,
 *  le tre funzioni chiuse a tutti salvo `service_role`, nessun nome vietato da
 *  I1/I2 nei corpi, le chiavi JSON di `tipi.ts`. Il comportamento vero lo
 *  prova `prove/sql/ponte-wa.sql` su un Postgres (vedi `prove/sql/LEGGIMI.md`).
 *  I contratti stanno in `src/crm/ponte/tipi.ts` (`mod["ponte/tipi"]`).
 *  Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FILE = "20261029120000_ponte_whatsapp.sql";

/** Il SQL senza commenti (`-- …` e il blocco slash-asterisco). Nessuna stringa del file ha «--» dentro. */
const senzaCommenti = (sql) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "")
    .replace(/[ \t]+\n/g, "\n");

/** Toglie i corpi tra dollari: resta solo il «primo livello». */
const senzaCorpi = (sql) => sql.replace(/\$(\w*)\$[\s\S]*?\$\1\$/g, " ");

/** Il corpo di una funzione: dal suo CREATE al `$$;` che la chiude. */
const corpoFunzione = (sql, nome) => {
  const da = sql.indexOf(`FUNCTION public.${nome}(`);
  if (da < 0) return "";
  const fine = sql.indexOf("$$;", da);
  return sql.slice(da, fine < 0 ? undefined : fine + 3);
};

/** Le tre funzioni con la firma che usano REVOKE e GRANT. */
const FIRME = {
  ponte_wa_noti: "uuid, text[]",
  ponte_wa_candidati: "uuid, jsonb",
  ponte_wa_scrivi: "uuid, jsonb, jsonb, jsonb",
};

/** I1/I2: nomi che nessun corpo può contenere (il ponte non li scrive né li legge). */
const VIETATI = [
  "unread_count",
  "ultimo_in_entrata_il",
  "ultimo_in_entrata_anteprima",
  "lead_id",
  "subscriber_id",
  "non_scrivere_dal",
  "manychat_",
];

export async function provePonteMigrazione(mod, { c, gruppo, radice }) {
  gruppo("PONTE WHATSAPP · T1, LA MIGRAZIONE (TESTO)");
  const T = mod["ponte/tipi"];
  const cartella = join(radice, "supabase/migrations");
  const percorso = join(cartella, FILE);
  c("la migrazione esiste col nome del piano", true, existsSync(percorso));
  if (!existsSync(percorso)) return;

  const grezzo = readFileSync(percorso, "utf8");
  const sql = senzaCommenti(grezzo);
  const alto = sql.toUpperCase();
  const primoLivello = senzaCorpi(sql);

  /* ── solo aggiunte ────────────────────────────────────────────────────── */
  c(
    "niente DROP, DELETE, TRUNCATE fuori dai commenti",
    [false, false, false],
    [/\bDROP\b/.test(alto), /\bDELETE\b/.test(alto), /\bTRUNCATE\b/.test(alto)],
  );
  c(
    "il «come si annulla» c'è, ma solo nel commento (DELETE delle righe baileys, DROP delle tre funzioni, della tabella, delle due colonne)",
    [true, false, true, 3, true, 2],
    [
      /COME SI ANNULLA/i.test(grezzo),
      /COME SI ANNULLA/i.test(sql),
      /^--[^\n]*DELETE FROM public\.whatsapp_messages WHERE canale = 'baileys'/m.test(grezzo),
      (grezzo.match(/^--\s*DROP FUNCTION public\.ponte_wa_/gm) ?? []).length,
      /^--\s*DROP TABLE public\.ponte_wa_stato/m.test(grezzo),
      (grezzo.match(/^--[^\n]*DROP COLUMN (duplicato_di|origine)/gm) ?? []).length,
    ],
  );
  c(
    "primo livello (senza i corpi): nessun UPDATE, INSERT, DELETE (nessun dato vecchio riscritto)",
    [false, false, false],
    [/\bUPDATE\b/i.test(primoLivello), /\bINSERT\b/i.test(primoLivello), /\bDELETE\b/i.test(primoLivello)],
  );
  const alter = [...primoLivello.matchAll(/ALTER TABLE\s+(\S+)\s+([^;]*);/gi)];
  c(
    "ALTER TABLE: le due colonne del piano, ADD COLUMN IF NOT EXISTS, più la RLS della tabella nuova",
    [
      "public.ponte_wa_stato ENABLE ROW LEVEL SECURITY",
      "public.whatsapp_contacts ADD COLUMN IF NOT EXISTS origine text",
      "public.whatsapp_messages ADD COLUMN IF NOT EXISTS duplicato_di uuid",
    ],
    alter.map(([, t, resto]) => `${t} ${resto.replace(/\s+/g, " ").trim()}`).sort(),
  );
  c(
    "una sola tabella nuova, IF NOT EXISTS, con le colonne del §e.4",
    [1, true],
    [
      (sql.match(/CREATE TABLE/gi) ?? []).length,
      /CREATE TABLE IF NOT EXISTS public\.ponte_wa_stato \(\s*user_id uuid PRIMARY KEY,\s*stato text NOT NULL,\s*collegato_dal timestamptz,\s*ultimo_messaggio_il timestamptz,\s*storico jsonb,\s*contatori jsonb,\s*versione text,\s*aggiornato_il timestamptz NOT NULL DEFAULT now\(\)\s*\);/i.test(
        sql,
      ),
    ],
  );
  const policy = [...sql.matchAll(/CREATE POLICY[^;]*;/gi)].map((m) => m[0].replace(/\s+/g, " "));
  c(
    "una sola policy, SELECT per authenticated sulle proprie righe (nessuna scrittura dal browser)",
    [1, true],
    [
      policy.length,
      /ON public\.ponte_wa_stato FOR SELECT TO authenticated USING \(auth\.uid\(\) = user_id\)/i.test(policy[0] ?? ""),
    ],
  );
  c(
    "la policy si crea solo se manca (due volte non fa danni)",
    true,
    /IF NOT EXISTS \(\s*SELECT 1 FROM pg_policies[^)]*ponte_wa_stato/i.test(sql),
  );

  /* ── gli indici ───────────────────────────────────────────────────────── */
  c(
    "ogni CREATE INDEX con IF NOT EXISTS; niente CREATE FUNCTION senza OR REPLACE",
    [0, 0],
    [
      (sql.match(/CREATE (?:UNIQUE )?INDEX(?! IF NOT EXISTS)/gi) ?? []).length,
      (sql.match(/CREATE FUNCTION/gi) ?? []).length,
    ],
  );
  c(
    "indice UNICO e parziale su duplicato_di (obiezione 1: un candidato è pari di una riga sola)",
    true,
    /CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_messages_duplicato\s+ON public\.whatsapp_messages \(duplicato_di\)\s+WHERE duplicato_di IS NOT NULL\s*;/i.test(
      sql,
    ),
  );
  c(
    "gli indici di ricerca dei candidati e delle righe del ponte (§e.2)",
    [true, true, true],
    [
      /CREATE INDEX IF NOT EXISTS idx_wa_messages_from_tempo\s+ON public\.whatsapp_messages \(user_id, from_number, created_at\)\s*;/i.test(sql),
      /CREATE INDEX IF NOT EXISTS idx_wa_messages_to_tempo\s+ON public\.whatsapp_messages \(user_id, to_number, created_at\)\s*;/i.test(sql),
      /CREATE INDEX IF NOT EXISTS idx_wa_messages_baileys\s+ON public\.whatsapp_messages \(user_id, created_at DESC\)\s+WHERE canale = 'baileys'\s*;/i.test(sql),
    ],
  );

  /* ── le tre funzioni: firma, sicurezza, permessi ─────────────────────── */
  for (const [nome, args] of Object.entries(FIRME)) {
    const f = corpoFunzione(sql, nome);
    const esc = args.replace(/[[\]]/g, "\\$&");
    c(`${nome}: CREATE OR REPLACE, SECURITY DEFINER, search_path fisso`, [true, true, true], [
      new RegExp(`CREATE OR REPLACE FUNCTION public\\.${nome}\\(`).test(sql),
      /SECURITY DEFINER/.test(f),
      /SET search_path = public, pg_temp/.test(f),
    ]);
    c(`${nome}: REVOKE da PUBLIC, anon, authenticated e GRANT solo a service_role`, [1, 1, 0], [
      (sql.match(new RegExp(`REVOKE ALL ON FUNCTION public\\.${nome}\\(${esc}\\) FROM PUBLIC, anon, authenticated;`, "g")) ?? []).length,
      (sql.match(new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${nome}\\(${esc}\\) TO service_role;`, "g")) ?? []).length,
      (sql.match(new RegExp(`GRANT[^;]*public\\.${nome}\\([^)]*\\)[^;]*TO (?!service_role;)`, "g")) ?? []).length,
    ]);
    c(
      `${nome}: nel corpo nessuno dei nomi vietati da I1/I2`,
      [],
      VIETATI.filter((v) => f.includes(v)),
    );
  }
  c(
    "I1: nessuna scrittura su manychat_*, crm_leads, whatsapp_settings, app_config",
    false,
    /\b(INSERT INTO|UPDATE|DELETE FROM)\s+(public\.)?(manychat_\w+|crm_leads|whatsapp_settings|app_config)\b/i.test(sql),
  );
  c("nessun indirizzo web", false, /https?:\/\//i.test(sql));

  /* ── ponte_wa_noti (D7) ───────────────────────────────────────────────── */
  const noti = corpoFunzione(sql, "ponte_wa_noti");
  c("noti: restituisce text[]; contatto col «+» o senza, ma non creato dal ponte", [true, true, true], [
    /RETURNS text\[\]/i.test(noti),
    /phone_e164 IN \('\+' \|\| c\.n, c\.n\)/.test(noti),
    /origine IS DISTINCT FROM 'baileys'/.test(noti),
  ]);
  c("noti: oppure una scheda crm_leads con le stesse ultime 9 cifre", [true, true], [
    /FROM public\.crm_leads l/.test(noti),
    /right\(regexp_replace\(coalesce\(l\.data ->> 'telefono', ''\), '\\D', '', 'g'\), 9\)/.test(noti),
  ]);

  /* ── ponte_wa_candidati (§c1.1-4) ─────────────────────────────────────── */
  const cand = corpoFunzione(sql, "ponte_wa_candidati");
  c(
    "candidati: l'uscita ha le colonne di CandidatoCrm, nell'ordine",
    "k text, id uuid, created_at timestamptz, direction text, body text, canale text",
    (cand.match(/RETURNS TABLE \(([^)]*)\)/i)?.[1] ?? "").replace(/\s+/g, " ").trim(),
  );
  c("candidati: legge {k, n, d, t} di RichiestaCandidato", true, /AS q\(k text, n text, d text, t double precision\)/.test(cand));
  c(
    "candidati: finestra di FINESTRA_PARI_S secondi, body tagliato a BODY_CANDIDATI",
    [true, true],
    [
      new RegExp(`interval '${T.FINESTRA_PARI_S} seconds'`).test(cand),
      new RegExp(`left\\(w\\.body, ${T.BODY_CANDIDATI}\\)`).test(cand),
    ],
  );
  c(
    "candidati: mai una riga del ponte, mai una già doppione, mai un invio fallito, mai una già presa (obiezione 10)",
    [true, true, true, true],
    [
      /w\.canale IS DISTINCT FROM 'baileys'/.test(cand),
      /w\.duplicato_di IS NULL/.test(cand),
      /w\.status IS DISTINCT FROM 'failed'/.test(cand),
      /NOT EXISTS \(SELECT 1 FROM public\.whatsapp_messages x WHERE x\.duplicato_di = w\.id\)/.test(cand),
    ],
  );
  c(
    "candidati: come clienteCrm di pari.ts (T3), cifre intere di from_number per le entrate e di to_number per le uscite (mai l'altro lato)",
    [true, true],
    [
      /r\.d = 'in'\s+AND w\.direction = 'inbound'\s+AND regexp_replace\(coalesce\(w\.from_number, ''\), '\\D', '', 'g'\) = r\.n/.test(cand),
      /r\.d = 'out' AND w\.direction = 'outbound' AND regexp_replace\(coalesce\(w\.to_number, ''\),\s+'\\D', '', 'g'\) = r\.n/.test(cand),
    ],
  );
  c("candidati: solo lettura", false, /\b(INSERT|UPDATE|DELETE)\b/i.test(cand));

  /* ── ponte_wa_scrivi (§e.5) ───────────────────────────────────────────── */
  const scr = corpoFunzione(sql, "ponte_wa_scrivi");
  c("scrivi: legge le chiavi di RigaScrittura e di Pari, restituisce jsonb", [true, true, true], [
    /AS q\(k text, n text, d text, t double precision, x text, e boolean, m text, s text\)/.test(scr),
    /AS p\(k text, crm text\)/.test(scr),
    /RETURNS jsonb/i.test(scr),
  ]);
  c(
    "scrivi: l'esito ha i campi di EsitoScrittura",
    ["contatti_nuovi", "doppioni", "gia_presenti", "nuovi", "pari_persi", "risposto"],
    [...scr.matchAll(/'(\w+)',\s*v_\w+/g)].map((m) => m[1]).sort(),
  );
  c(
    "scrivi: inserisce con ON CONFLICT (wa_message_id) DO NOTHING, canale 'baileys', orario vero",
    [2, true, true],
    [
      (scr.match(/ON CONFLICT \(wa_message_id\) DO NOTHING/g) ?? []).length,
      /'baileys'/.test(scr),
      /to_timestamp\(r\.t\)/.test(scr),
    ],
  );
  c(
    "scrivi: unique_violation gestita per coppia, all'inserimento e sulle righe già presenti (obiezione 1)",
    2,
    (scr.match(/EXCEPTION WHEN unique_violation THEN\s+v_persi := v_persi \+ 1;/g) ?? []).length,
  );
  c(
    "scrivi: il pari si scrive solo se la riga del ponte non ne ha già uno",
    true,
    /SET duplicato_di = v_crm[\s\S]*?AND w\.duplicato_di IS NULL/.test(scr),
  );
  c(
    "scrivi: un pari vale solo se è una riga CRM dello stesso utente, non del ponte, non fallita",
    true,
    /c\.user_id = p_user_id\s+AND c\.canale IS DISTINCT FROM 'baileys'\s+AND c\.duplicato_di IS NULL\s+AND c\.status IS DISTINCT FROM 'failed'/.test(scr),
  );
  c(
    "scrivi: il contatto nuovo nasce con origine 'baileys'; per quelli esistenti solo last_message_at in avanti, nome se vuoto, risposto_il in avanti",
    [true, true, true, true],
    [
      /INSERT INTO public\.whatsapp_contacts AS w \(user_id, phone_e164, display_name, last_message_at, risposto_il, origine\)/.test(scr),
      /last_message_at = greatest\(x\.last_message_at, g\.ultimo\)/.test(scr),
      /display_name\s+= coalesce\(x\.display_name, v_nome\)/.test(scr),
      /greatest\(coalesce\(x\.risposto_il, '-infinity'\), v_risp\)/.test(scr),
    ],
  );
  c(
    "scrivi: ogni riga inserita adesso tocca updated_at del contatto, anche se più vecchia di last_message_at (richiesta di T7: il controllo da 15 s legge updated_at)",
    [2, false],
    [
      (scr.match(/updated_at\s+= now\(\)/g) ?? []).length,
      /IS DISTINCT FROM greatest\(x\.last_message_at/.test(scr),
    ],
  );
  c(
    "scrivi: D8 solo per le uscite con effetto, entro EFFETTO_MAX_GIORNI, mai oltre adesso",
    [true, true],
    [
      new RegExp(`r\\.e AND r\\.d = 'out' AND v_crm IS NULL AND r\\.t >= v_adesso - ${T.EFFETTO_MAX_GIORNI} \\* 86400`).test(scr),
      /least\(g\.risposta, now\(\)\)/.test(scr),
    ],
  );
  c(
    "scrivi: ts fra TS_MINIMO e adesso + LIMITI.tsOltreMinuti, testo tagliato a LIMITI.testo",
    [true, true],
    [
      new RegExp(`q\\.t >= ${T.TS_MINIMO} AND q\\.t <= v_adesso \\+ ${T.LIMITI.tsOltreMinuti * 60}`).test(scr),
      new RegExp(`left\\(r\\.x, ${T.LIMITI.testo}\\)`).test(scr),
    ],
  );
  c(
    "scrivi: i tipi di media e gli stati sono quelli di tipi.ts (un valore fuori lista non fa cadere il lotto)",
    [true, true],
    [
      scr.includes(`r.m IN (${T.TIPI_CONTENUTO.filter((t) => t !== "testo").map((t) => `'${t}'`).join(", ")})`),
      scr.includes(`r.s IN (${T.STATI_INVIO.map((t) => `'${t}'`).join(", ")})`),
    ],
  );

  /* ── forma del file ───────────────────────────────────────────────────── */
  c("le parentesi tornano", 0, [...sql].reduce((n, ch) => n + (ch === "(" ? 1 : ch === ")" ? -1 : 0), 0));
  c(
    "i delimitatori tra dollari si aprono e si chiudono",
    true,
    Object.values((sql.match(/\$\w*\$/g) ?? []).reduce((o, t) => ((o[t] = (o[t] ?? 0) + 1), o), {})).every((n) => n % 2 === 0),
  );
  c("NOTIFY pgrst per ricaricare lo schema", true, /NOTIFY pgrst, 'reload schema'\s*;/.test(sql));
  c(
    "l'intestazione dice: NON rilanciare giro §7 e cron dopo l'import, NON la lancia la squadra, ordine, due volte",
    [true, true, true, true],
    [
      /NON rilanciare `manychat_giro` \(§7\) né `manychat_cron` dopo l'import dello storico/.test(grezzo),
      /NON la lancia la squadra/.test(grezzo),
      /ORDINE[^\n]*20261028120000_chat_whatsapp_crm\.sql/.test(grezzo),
      /due volte non fa danni/i.test(grezzo),
    ],
  );
  const altre = readdirSync(cartella).filter((n) => n.endsWith(".sql") && n !== FILE && !n.includes("risposte_ai") && !n.includes("riepilogo_serale") && !n.includes("ponte_invio_manuale") && !n.startsWith("20261030")).sort();
  c("il nome viene dopo l'ultima migrazione esistente", true, FILE > altre.at(-1));
}
