/** ── PROVE: INVIO A MANO DAL PONTE · LA MIGRAZIONE (testo SQL, compito T1) ──
 *
 *  Commessa 2026-10-30-ponte-invio-manuale. Come `migrazione.mjs`: qui NON gira
 *  un Postgres. Si legge il testo di `20261030120000_ponte_invio_manuale.sql`
 *  (i commenti si TOLGONO prima: il «come si annulla» ha DROP scritti apposta e
 *  mai eseguiti) e si controlla il §2 del PIANO: solo aggiunte, la tabella e i
 *  suoi permessi (qui c'è il testo dei clienti), le tre funzioni chiuse a tutti
 *  salvo `service_role`, i limiti SOLO come parametri, nessun nome vietato nei
 *  corpi. Il comportamento vero lo prova `prove/sql/ponte-invio.sql` su un
 *  Postgres (vedi `prove/sql/LEGGIMI.md`).
 *  Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs`. `aiuti`: `{ c, gruppo, radice }`. */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FILE = "20261030120000_ponte_invio_manuale.sql";

/** Il SQL senza commenti (`-- …` e il blocco slash-asterisco). */
const senzaCommenti = (sql) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "")
    .replace(/[ \t]+\n/g, "\n");

/** Il corpo di una funzione: dal suo CREATE al `$$;` che la chiude. */
const corpoFunzione = (sql, nome) => {
  const da = sql.indexOf(`FUNCTION public.${nome}(`);
  if (da < 0) return "";
  const fine = sql.indexOf("$$;", da);
  return sql.slice(da, fine < 0 ? undefined : fine + 3);
};

/** Le tre funzioni con la firma che usano REVOKE e GRANT. */
const FIRME = {
  ponte_wa_invio_fatti: "uuid, text",
  ponte_wa_invii_prendi: "uuid, integer, integer, integer, integer",
  ponte_wa_invio_esito: "uuid, uuid, text, text, double precision, text",
};

/** Nomi che il ponte non scrive né legge (I1/I2), salvo i due che `fatti` legge per STOP e «ha già una chat». */
const VIETATI = ["unread_count", "ultimo_in_entrata_il", "ultimo_in_entrata_anteprima", "lead_id", "subscriber_id", "non_scrivere_dal", "manychat_"];
const LETTI_DA_FATTI = ["ultimo_in_entrata_il", "non_scrivere_dal"];

export async function provePonteInvioMigrazione(mod, { c, gruppo, radice }) {
  gruppo("PONTE · INVIO A MANO · T1, LA MIGRAZIONE (TESTO)");
  const T = mod["ponte/invio-tipi"];
  const cartella = join(radice, "supabase/migrations");
  const percorso = join(cartella, FILE);
  c("il file della migrazione esiste", true, existsSync(percorso));
  if (!existsSync(percorso)) return;
  const grezzo = readFileSync(percorso, "utf8");
  const sql = senzaCommenti(grezzo);
  const fatti = corpoFunzione(sql, "ponte_wa_invio_fatti");
  const prendi = corpoFunzione(sql, "ponte_wa_invii_prendi");
  const esito = corpoFunzione(sql, "ponte_wa_invio_esito");

  //  ── Solo aggiunte ──
  c("niente che cancelli o riscriva, fuori dai commenti (la pulizia dei 30 giorni è in TypeScript)", false, /\bDROP\b|\bDELETE\b|\bTRUNCATE\b|ALTER TABLE[^;]*\bDROP\b/i.test(sql));
  c("non altera tabelle esistenti", false, /ALTER TABLE\s+(?!public\.ponte_wa_invii\b)/i.test(sql));
  c("la tabella nasce con IF NOT EXISTS", 1, (sql.match(/CREATE TABLE IF NOT EXISTS public\.ponte_wa_invii \(/g) || []).length);
  c("ogni indice con IF NOT EXISTS (5)", [5, 0], [(sql.match(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS/g) || []).length, (sql.match(/CREATE (?:UNIQUE )?INDEX (?!IF NOT EXISTS)/g) || []).length]);
  c("le funzioni sono tre, tutte OR REPLACE", [3, 0], [(sql.match(/CREATE OR REPLACE FUNCTION public\./g) || []).length, (sql.match(/CREATE FUNCTION/g) || []).length]);
  c("le tre funzioni sono quelle del piano", Object.keys(FIRME).sort(), [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)/g)].map((x) => x[1]).sort());

  //  ── La tabella ──
  const colonne = ["id", "user_id", "chiave", "numero", "testo", "stato", "motivo", "creato_da", "wa_message_id", "created_at", "preso_il", "inviato_il", "aggiornato_il"];
  const tabella = sql.slice(sql.indexOf("CREATE TABLE IF NOT EXISTS public.ponte_wa_invii"), sql.indexOf(");", sql.indexOf("CREATE TABLE IF NOT EXISTS public.ponte_wa_invii")));
  c("le colonne del piano (§2.1), in ordine", colonne, [...tabella.matchAll(/^  (\w+) (?:uuid|text|timestamptz)/gm)].map((x) => x[1]));
  c("le colonne di RigaCoda esistono tutte nella tabella", [], ["id", "chiave", "numero", "testo", "stato", "motivo", "created_at", "preso_il", "inviato_il", "wa_message_id"].filter((x) => !colonne.includes(x)));
  c("l'identificativo si genera da solo", true, /id uuid PRIMARY KEY DEFAULT gen_random_uuid\(\)/.test(tabella));
  c("il testo: 1 .. LIMITI_INVIO.caratteri caratteri (char_length, non byte)", `CHECK (char_length(testo) BETWEEN 1 AND ${T.LIMITI_INVIO.caratteri})`, tabella.match(/CHECK \(char_length\(testo\)[^)]*\)\)?/)?.[0].replace(/\)\)$/, ")") ?? null);
  c("la chiave: LIMITI_INVIO.chiaveMin .. chiaveMax, solo [A-Za-z0-9_-]", `{${T.LIMITI_INVIO.chiaveMin},${T.LIMITI_INVIO.chiaveMax}}`, tabella.match(/chiave ~ '\^\[A-Za-z0-9_-\]\{(\d+,\d+)\}\$'/)?.[1] ? `{${tabella.match(/chiave ~ '\^\[A-Za-z0-9_-\]\{(\d+,\d+)\}\$'/)[1]}}` : null);
  c("il numero: solo cifre, 8-15", true, /numero text NOT NULL CHECK \(numero ~ '\^\[0-9\]\{8,15\}\$'\)/.test(tabella));
  c("lo stato: la lista chiusa STATI_CODA, di serie in_attesa", [[...T.STATI_CODA], "in_attesa"], [[...(tabella.match(/stato IN \(([^)]*)\)/)?.[1] ?? "").matchAll(/'(\w+)'/g)].map((x) => x[1]), tabella.match(/stato text NOT NULL DEFAULT '(\w+)'/)?.[1]]);
  c("il motivo: solo [a-z_]", true, /motivo text CHECK \(motivo IS NULL OR motivo ~ '\^\[a-z_\]\+\$'\)/.test(tabella));
  c("indice unico (user_id, chiave): un doppio tocco è la stessa riga", true, /CREATE UNIQUE INDEX IF NOT EXISTS idx_ponte_invii_chiave\s+ON public\.ponte_wa_invii \(user_id, chiave\)/.test(sql));
  c("indice unico (user_id, wa_message_id) dove c'è", true, /CREATE UNIQUE INDEX IF NOT EXISTS idx_ponte_invii_wa_id\s+ON public\.ponte_wa_invii \(user_id, wa_message_id\)\s+WHERE wa_message_id IS NOT NULL/.test(sql));
  c("indici delle righe aperte, dei prelievi e della chat", [true, true, true], [
    /idx_ponte_invii_aperti\s+ON public\.ponte_wa_invii \(user_id, created_at\)\s+WHERE stato IN \('in_attesa', 'in_invio'\)/.test(sql),
    /idx_ponte_invii_presi\s+ON public\.ponte_wa_invii \(user_id, preso_il DESC\)\s+WHERE preso_il IS NOT NULL/.test(sql),
    /idx_ponte_invii_chat\s+ON public\.ponte_wa_invii \(user_id, numero, created_at DESC\)/.test(sql),
  ]);

  //  ── RLS e permessi: qui c'è il testo dei clienti ──
  c("RLS accesa", true, /ALTER TABLE public\.ponte_wa_invii ENABLE ROW LEVEL SECURITY;/.test(sql));
  c("UNA sola policy, di lettura, per authenticated, sulle sue righe", [1, true], [(sql.match(/CREATE POLICY/g) || []).length, /CREATE POLICY "users read own ponte invii"\s+ON public\.ponte_wa_invii FOR SELECT\s+TO authenticated\s+USING \(auth\.uid\(\) = user_id\);/.test(sql)]);
  c("nessuna policy di scrittura", false, /CREATE POLICY[^;]*FOR (INSERT|UPDATE|DELETE|ALL)/i.test(sql));
  const revoke = sql.indexOf("REVOKE ALL ON public.ponte_wa_invii FROM anon, authenticated;");
  const grant = sql.indexOf("GRANT SELECT ON public.ponte_wa_invii TO authenticated;");
  c("REVOKE ALL da anon e authenticated PRIMA del GRANT SELECT (i permessi di serie di Supabase scrivono)", true, revoke > 0 && grant > revoke);
  c("service_role: tutto", true, /GRANT ALL ON public\.ponte_wa_invii TO service_role;/.test(sql));
  c("authenticated riceve solo SELECT sulla tabella", ["SELECT"], [...sql.matchAll(/GRANT (\w+(?:, \w+)*) ON public\.ponte_wa_invii TO authenticated/g)].map((x) => x[1]));
  c("anon non riceve niente", false, /GRANT[^;]*ON public\.ponte_wa_invii TO[^;]*\banon\b/.test(sql));

  //  ── Le funzioni ──
  c("SECURITY DEFINER con search_path fisso, tre volte", 3, (sql.match(/SECURITY DEFINER SET search_path = public, pg_temp/g) || []).length);
  for (const [nome, firma] of Object.entries(FIRME)) {
    c(`${nome}: chiusa a PUBLIC, anon e authenticated; aperta a service_role`, [true, true], [
      sql.includes(`REVOKE ALL ON FUNCTION public.${nome}(${firma}) FROM PUBLIC, anon, authenticated;`),
      sql.includes(`GRANT EXECUTE ON FUNCTION public.${nome}(${firma}) TO service_role;`),
    ]);
  }
  c("nessun GRANT EXECUTE a chi non è service_role", [], [...sql.matchAll(/GRANT EXECUTE ON FUNCTION[^;]*TO ([^;]*);/g)].map((x) => x[1]).filter((x) => x !== "service_role"));

  //  ── I limiti arrivano dal TypeScript, non stanno nel SQL ──
  c("prendi: i quattro limiti sono parametri", true, ["p_intervallo_s", "p_al_giorno", "p_scadenza_min", "p_incerto_min"].every((p) => prendi.includes(p)));
  c("prendi: nessun numero di limite scritto nel corpo (20, 2000, 10, 3, 180, 600)", [], (prendi.replace(/interval '24 hours'/g, "").match(/(?<![\w.])(20|2000|10|3|180|600)(?![\w.])/g) || []));
  c("prendi: un lucchetto per utente", true, /pg_advisory_xact_lock\(hashtextextended\('ponte_invii:' \|\| p_user_id::text, 0\)\)/.test(prendi));
  c("niente SKIP LOCKED (basta il lucchetto)", false, /SKIP\s+LOCKED/i.test(sql));
  c("prendi: l'ordine del piano (scaduto → incerto → coda vuota → intervallo → tetto → riga)", true, (() => {
    const pos = ["motivo = 'scaduto'", "motivo = 'esito_incerto'", "IF NOT EXISTS (SELECT 1 FROM public.ponte_wa_invii", "make_interval(secs => p_intervallo_s)", "v_presi >= p_al_giorno", "ORDER BY i.created_at, i.id"].map((x) => prendi.indexOf(x));
    return pos.every((p, i) => p > 0 && (i === 0 || p > pos[i - 1]));
  })());
  c("prendi: ricontrolla STOP e «ha già una chat» con la funzione dei fatti", true, prendi.includes("public.ponte_wa_invio_fatti(p_user_id, r.numero)") && prendi.includes("motivo = 'stop'") && prendi.includes("motivo = 'mai_scritto'"));
  c("prendi: una riga in_invio non viene mai riofferta (si legge solo in_attesa)", false, /WHERE[^;]*stato = 'in_invio'[^;]*ORDER BY/.test(prendi.slice(prendi.indexOf("LOOP"))));
  c("prendi: nessuna pulizia (la fa l'accodamento)", false, /DELETE/i.test(prendi));
  c("fatti: legge soltanto (nessun INSERT/UPDATE/DELETE)", false, /\b(INSERT|UPDATE|DELETE)\b/.test(fatti));
  c("fatti: STABLE", true, /LANGUAGE plpgsql STABLE SECURITY DEFINER/.test(fatti));
  c("fatti: le chiavi del JSON sono quelle di FattiInvio", ["entrata", "stop", "ponte_stato", "ponte_battito", "invii_attivi", "ultime24h", "in_coda"], [...fatti.slice(fatti.indexOf("jsonb_build_object")).matchAll(/'(\w+)',/g)].map((x) => x[1]));
  c("prendi: ogni risposta ha le sei chiavi di EsitoPrendi", true, (() => {
    const risposte = prendi.split("RETURN jsonb_build_object(").slice(1).map((x) => x.slice(0, x.indexOf(");")));
    return risposte.length === 5 && risposte.every((r) => ["'invio'", "'attendi_s'", "'limite'", "'scaduti'", "'incerti'", "'respinti'"].every((k) => r.includes(k)));
  })());
  c("esito: le chiavi del JSON sono quelle di EsitoEsitoSql", true, [...esito.matchAll(/jsonb_build_object\(([^)]*)\)/g)].every((x) => /^'ok', (true|false), 'stato', [^,]+, 'nuovo', (true|false)$/.test(x[1].trim())));

  //  ── L'esito: nessun doppione, nessuna decisione toccata ──
  c("esito: ON CONFLICT (wa_message_id) DO NOTHING (l'eco può essere già arrivata)", true, /ON CONFLICT \(wa_message_id\) DO NOTHING/.test(esito));
  c("esito: la chiave della riga è quella dell'eco (bw:<numero>:<id>)", true, /'bw:' \|\| r\.numero \|\| ':' \|\| p_wa_id/.test(esito));
  c("esito: l'id WhatsApp è controllato", true, /\^\[A-Za-z0-9_\.-\]\{1,128\}\$/.test(esito));
  c("esito: «inviato» ammesso da in_invio e da non_inviato/esito_incerto, NON da in_attesa", true, /r\.stato = 'in_invio' OR \(r\.stato = 'non_inviato' AND r\.motivo = 'esito_incerto'\)/.test(esito) && !/r\.stato = 'in_attesa'/.test(esito));
  c("esito: i motivi ammessi sono MOTIVI_INVIO", [...T.MOTIVI_INVIO].sort(), [...(esito.match(/ARRAY\[([^\]]*)\]/)?.[1] ?? "").matchAll(/'(\w+)'/g)].map((x) => x[1]).sort());
  c("esito: l'ora vera è limitata (da un minuto prima del prelievo a dieci minuti nel futuro)", true, /interval '60 seconds'/.test(esito) && /interval '10 minutes'/.test(esito));
  c("esito: sul contatto si portano avanti solo last_message_at, risposto_il, updated_at", [["last_message_at", "risposto_il", "updated_at"]], [
    [...esito.matchAll(/UPDATE public\.whatsapp_contacts x\s+SET([\s\S]*?)WHERE/g)].flatMap((x) => [...x[1].matchAll(/^\s*(\w+)\s*=/gm)].map((y) => y[1])),
  ]);
  c("esito: dentro le funzioni si scrivono solo ponte_wa_invii, whatsapp_messages (INSERT) e whatsapp_contacts", ["INSERT INTO whatsapp_contacts", "INSERT INTO whatsapp_messages", "UPDATE ponte_wa_invii", "UPDATE whatsapp_contacts"], (() => {
    const corpi = [fatti, prendi, esito].join("\n");
    return [...new Set([...corpi.matchAll(/(?<!DO |FOR )\b(INSERT INTO|UPDATE|DELETE FROM)\s+(?:public\.)?(\w+)/g)].map((x) => `${x[1]} ${x[2]}`))].sort();
  })());
  for (const [nome, corpo, ammessi] of [["esito", esito, []], ["prendi", prendi, []], ["fatti", fatti, LETTI_DA_FATTI]]) {
    c(`${nome}: non nomina i nomi vietati (I1/I2)${ammessi.length ? `, salvo ${ammessi.join(" e ")} in lettura` : ""}`, [], VIETATI.filter((v) => !ammessi.includes(v) && corpo.includes(v)));
  }
  c("tutta la migrazione non scrive lead_id né subscriber_id", false, /lead_id|subscriber_id/.test(sql));
  c("la tabella non ha FOREIGN KEY (come ponte_wa_stato)", false, /REFERENCES/i.test(sql));

  //  ── Intestazione, ordine, annullamento ──
  c("le parentesi tonde si chiudono", 0, (sql.match(/\(/g) || []).length - (sql.match(/\)/g) || []).length);
  c("i delimitatori tra dollari si aprono e si chiudono", true, Object.values((sql.match(/\$\w*\$/g) ?? []).reduce((o, t) => ((o[t] = (o[t] ?? 0) + 1), o), {})).every((n) => n % 2 === 0));
  c("NOTIFY pgrst per ricaricare lo schema", true, /NOTIFY pgrst, 'reload schema'\s*;/.test(sql));
  c(
    "l'intestazione dice: NON la lancia la squadra, ordine, due volte, il codice funziona anche senza, come si annulla",
    [true, true, true, true, true],
    [
      /NON la lancia la squadra/.test(grezzo),
      /ORDINE[^\n]*20261029120000_ponte_whatsapp\.sql/.test(grezzo),
      /due volte non fa danni/i.test(grezzo),
      /funziona anche SENZA questa migrazione[\s\S]{0,200}503 «migrazione»/.test(grezzo),
      /COME SI ANNULLA[\s\S]*DROP TABLE public\.ponte_wa_invii;/.test(grezzo),
    ],
  );
  c("«come si annulla» elenca le tre DROP FUNCTION, solo nei commenti", [3, 0], [(grezzo.match(/--\s+DROP FUNCTION public\.ponte_wa_/g) || []).length, (sql.match(/DROP FUNCTION/g) || []).length]);
  const altre = readdirSync(cartella).filter((n) => n.endsWith(".sql") && n !== FILE && !n.startsWith("20261030") && !n.startsWith("20261031")).sort(); // le altre del 30/10 (pacchetti della commessa) hanno il loro ordine
  c("il nome viene dopo l'ultima migrazione esistente", true, FILE > altre.at(-1));
  c("…e dopo quella del ponte", true, FILE > "20261029120000_ponte_whatsapp.sql");

  //  ── Il collaudo su Postgres vero c'è e dice cosa prova ──
  const collaudo = join(radice, "prove/sql/ponte-invio.sql");
  c("il collaudo su Postgres vero esiste", true, existsSync(collaudo));
  if (existsSync(collaudo)) {
    const q = readFileSync(collaudo, "utf8");
    c("…applica la migrazione due volte e finisce con ROLLBACK", [true, true], [(q.match(/^\\i :migrazione$/gm) || []).length >= 2, /^ROLLBACK;$/m.test(q)]);
    c("…prova i casi del piano: eco prima e dopo l'esito, esito dopo esito_incerto, esito su riga tornata in_attesa, tetto, scadenza, incertezza, STOP, GRANT di serie, RLS", true, [
      /eco prima:/, /esito prima:/, /esito inviato dopo esito_incerto/, /riga tornata in_attesa/, /20 prelievi il 21°/, /11 minuti → non_inviato · scaduto/, /4 minuti → non_inviato · esito_incerto/, /STOP → non_inviato/, /GRANT ALL ON public\.ponte_wa_invii TO anon, authenticated/, /RLS: ognuno vede solo le sue righe/,
    ].every((r) => r.test(q)));
    c("…usa i valori di LIMITI_INVIO come parametri (20, 20, 10, 3)", true, /ponte_wa_invii_prendi\('00000000-0000-4000-8000-0000000000b1'::uuid, 20, 20, 10, 3\)/.test(q) && T.LIMITI_INVIO.intervalloS === 20 && T.LIMITI_INVIO.alGiorno === 20 && T.LIMITI_INVIO.scadenzaMin === 10 && T.LIMITI_INVIO.incertoMin === 3);
  }
  const leggimi = readFileSync(join(radice, "prove/sql/LEGGIMI.md"), "utf8");
  c("prove/sql/LEGGIMI.md dice come lanciare il collaudo dell'invio", true, /psql "\$DB" -f prove\/sql\/ponte-invio\.sql/.test(leggimi));
}
