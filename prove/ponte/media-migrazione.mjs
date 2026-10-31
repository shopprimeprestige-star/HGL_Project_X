/** ── PROVE: MEDIA E ARCHIVIAZIONE · LE TRE MIGRAZIONI (testo SQL, compito T1) ──
 *
 *  Commessa 2026-10-31-media-e-archiviazione, PIANO (e) e (g.2). Come `immagini-migrazione.mjs`:
 *  qui NON gira un Postgres. Si legge il testo delle tre migrazioni
 *    A `20261031120000_ponte_media_tipi.sql`      (tipi, limiti, richieste di «Mostra»)
 *    B `20261031130000_ponte_media_archivio.sql`  (timer, liberazione, pannello)
 *    C `20261031140000_ponte_media_cron.sql`      (il cron, per ultima)
 *  (i commenti si TOLGONO prima: il «come si annulla» ha DROP scritti apposta e mai eseguiti) e si
 *  controlla che siano solo aggiuntive, dentro BEGIN/COMMIT, con le firme esatte del PIANO, chiuse a chi
 *  non deve chiamarle. Il comportamento vero lo prova `prove/sql/ponte-media-archivio.sql` su un Postgres
 *  (con `pg-prova.sh`). Dati inventati: nessun numero né nome vero.
 *
 *  Questa prova NON è registrata in `prove.mjs`/`ponte.mjs`: lo fa T11.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs` (qui non serve). `aiuti`: `{ c, gruppo, radice }`. */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const A = "20261031120000_ponte_media_tipi.sql";
const B = "20261031130000_ponte_media_archivio.sql";
const C = "20261031140000_ponte_media_cron.sql";

/** Il SQL senza commenti (`-- …` e il blocco slash-asterisco). */
const senzaCommenti = (sql) =>
  sql
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/--[^\n]*/g, "")
    .replace(/[ \t]+\n/g, "\n");

/** Spazi uniformi, per confrontare un testo senza badare agli a capo. */
const compatto = (t) => t.replace(/\s+/g, " ").replace(/\( /g, "(").replace(/ \)/g, ")").trim();

/** Il corpo di una funzione: dal suo CREATE al `$$;` che la chiude. */
const corpoFunzione = (sql, nome) => {
  const da = sql.indexOf(`FUNCTION public.${nome}(`);
  if (da < 0) return "";
  const fine = sql.indexOf("$$;", sql.indexOf("$$", da) + 2);
  return sql.slice(da, fine < 0 ? undefined : fine + 3);
};

/** Le firme del PIANO (e): nome → [argomenti nella forma di CREATE, ritorno]. Le stesse che usano T2 e T3. */
const FIRME_A = {
  ponte_wa_media_permesso: ["p_user_id uuid, p_chiave text, p_numero text, p_mime text, p_byte bigint, p_tetto_byte bigint", "jsonb"],
  ponte_wa_media_fatto: ["p_user_id uuid, p_chiave text", "jsonb"],
  ponte_wa_media_dettagli: ["p_user_id uuid, p_chiave text, p_nome text, p_durata_s integer, p_larghezza integer, p_altezza integer, p_miniatura text", "void"],
  ponte_wa_media_richiedi: ["p_user_id uuid, p_chiave text, p_timer_s integer", "jsonb"],
  ponte_wa_media_prendi: ["p_user_id uuid, p_max integer", "text[]"],
  ponte_wa_media_richiesta_esito: ["p_user_id uuid, p_chiave text, p_esito text", "jsonb"],
  ponte_wa_media_pulizia: ["", "jsonb"],
};
/** Il tipo di ritorno così com'è scritto nella migrazione (la funzione di tabella ha RETURNS TABLE). */
const FIRME_B_SERVIZIO = {
  ponte_wa_media_timer: ["p_user_id uuid, p_chiave text, p_secondi integer", "jsonb"],
  ponte_wa_media_scadute: ["p_limite integer", "TABLE (user_id uuid, chiave text, path text)"],
  ponte_wa_media_ancora_scadute: ["p_user_id uuid, p_voci jsonb", "jsonb"],
  ponte_wa_media_da_liberare: ["p_user_id uuid, p_numero text, p_chiavi text[], p_limite integer", "TABLE (chiave text, path text)"],
  ponte_wa_media_liberato: ["p_user_id uuid, p_voci jsonb", "integer"],
  ponte_wa_media_orfani: ["p_limite integer", "text[]"],
};
const FIRME_B_BROWSER = {
  ponte_wa_archivio_riassunto: ["", "jsonb"],
  ponte_wa_archivio_chat: ["", "TABLE (numero text, byte bigint, foto integer, audio integer, video integer, documento integer, ultimo_il timestamptz)"],
  ponte_wa_archivio_media: [
    "p_numero text, p_limite integer, p_prima_il timestamptz, p_prima_chiave text",
    "TABLE (chiave text, categoria text, nome text, byte bigint, durata_s integer, miniatura text, scade_il timestamptz, creato_il timestamptz)",
  ],
};
/** Gli argomenti per REVOKE/GRANT (solo i tipi). */
const tipi = (args) => args.split(",").map((x) => x.trim().split(/\s+/).slice(1).join(" ")).filter(Boolean).join(", ");

/** La tabella dei tipi del PIANO (a.1): mime → [categoria, estensione]. */
const TIPI = {
  "image/jpeg": ["foto", "jpg"], "image/png": ["foto", "png"], "image/webp": ["foto", "webp"],
  "audio/ogg": ["audio", "ogg"], "audio/mp4": ["audio", "m4a"], "audio/mpeg": ["audio", "mp3"], "audio/aac": ["audio", "aac"], "audio/amr": ["audio", "amr"],
  "video/mp4": ["video", "mp4"], "video/3gpp": ["video", "3gp"], "video/quicktime": ["video", "mov"], "video/webm": ["video", "webm"],
  "application/pdf": ["documento", "pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["documento", "docx"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["documento", "xlsx"],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ["documento", "pptx"],
};
const LIMITI = { foto: 8388608, audio: 16777216, video: 47185920, documento: 26214400 };

export async function provePonteMediaMigrazione(_mod, { c, gruppo, radice }) {
  gruppo("PONTE · MEDIA E ARCHIVIAZIONE · T1, LE TRE MIGRAZIONI (TESTO)");
  const cartella = join(radice, "supabase/migrations");
  const file = (n) => join(cartella, n);
  c("i tre file esistono coi nomi del piano", [true, true, true], [existsSync(file(A)), existsSync(file(B)), existsSync(file(C))]);
  if (![A, B, C].every((n) => existsSync(file(n)))) return;
  const grezzo = { A: readFileSync(file(A), "utf8"), B: readFileSync(file(B), "utf8"), C: readFileSync(file(C), "utf8") };
  const vivo = { A: senzaCommenti(grezzo.A), B: senzaCommenti(grezzo.B), C: senzaCommenti(grezzo.C) };
  const tutto = vivo.A + vivo.B + vivo.C;

  //  ── Ordine e transazione ──
  const altre = readdirSync(cartella).filter((n) => n.endsWith(".sql") && ![A, B, C].includes(n));
  c("A, B, C vengono in quest'ordine e dopo tutte le altre", [true, true], [A < B && B < C, altre.every((n) => n < A)]);
  for (const k of ["A", "B", "C"]) {
    const righe = vivo[k].split("\n").map((r) => r.trim()).filter(Boolean);
    c(`${k}: dentro UN solo BEGIN; … COMMIT; (la prima e l'ultima istruzione)`, [true, true, 1, 1], [
      righe[0] === "BEGIN;", righe.at(-1) === "COMMIT;", righe.filter((r) => r === "BEGIN;").length, righe.filter((r) => r === "COMMIT;").length,
    ]);
  }

  //  ── Solo aggiunte ──
  c("niente DROP TABLE, DROP FUNCTION, DROP COLUMN, TRUNCATE fuori dai commenti", false, /\bDROP\s+(TABLE|FUNCTION|COLUMN|INDEX|TRIGGER|POLICY|SCHEMA)\b|\bTRUNCATE\b/i.test(tutto));
  c("l'unico DROP è DROP CONSTRAINT IF EXISTS sui tre CHECK allargati (nome fisso)", ["ponte_wa_media_byte_check", "ponte_wa_media_mime_check", "ponte_wa_media_stato_check"],
    [...tutto.matchAll(/\bDROP\s+CONSTRAINT\s+IF\s+EXISTS\s+(\w+)/gi)].map((x) => x[1]).sort());
  c("nessun DROP CONSTRAINT senza IF EXISTS", [], [...tutto.matchAll(/\bDROP\s+CONSTRAINT\s+(?!IF\s+EXISTS)\w+/gi)].map((x) => x[0]));
  c("mai un DELETE su ponte_wa_media (le righe restano: «liberato» è uno stato)", false, /\bDELETE\s+FROM\s+(?:ONLY\s+)?public\.ponte_wa_media\b(?!_)/i.test(tutto));
  c("i soli DELETE sono sulle richieste (compiute da «fatto», vecchie da «pulizia»)", ["public.ponte_wa_media_richieste"], [...new Set([...tutto.matchAll(/\bDELETE\s+FROM\s+([\w.]+)/gi)].map((x) => x[1]))]);
  c("gli UPDATE toccano solo il bucket, ponte_wa_media e le richieste", ["public.ponte_wa_media", "public.ponte_wa_media_richieste", "storage.buckets"],
    [...new Set([...tutto.matchAll(/(?<!FOR )(?<!DO )\bUPDATE\s+(?:ONLY\s+)?([\w.]+)/gi)].map((x) => x[1]))].sort());
  c("gli INSERT toccano solo ponte_wa_media e le richieste", ["public.ponte_wa_media", "public.ponte_wa_media_richieste"],
    [...new Set([...tutto.matchAll(/\bINSERT\s+INTO\s+([\w.]+)/gi)].map((x) => x[1]))].sort());
  c("whatsapp_messages: solo letta (un EXISTS in richiedi), mai scritta", [true, false], [
    /EXISTS \(SELECT 1 FROM public\.whatsapp_messages w WHERE w\.user_id = p_user_id AND w\.wa_message_id = p_chiave\)/.test(vivo.A),
    /(INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(public\.)?whatsapp_messages/i.test(tutto),
  ]);
  c("whatsapp_contacts non compare (i media non scrivono nelle chat)", false, /whatsapp_contacts/i.test(tutto));
  c("nessun lucchetto (pg_advisory), nessun indirizzo (http/https) nemmeno nei commenti", [false, false], [/pg_advisory/i.test(tutto), /https?:\/\//i.test(grezzo.A + grezzo.B + grezzo.C)]);
  c("nessuna policy su storage.objects (i file si leggono solo con un indirizzo firmato dal server)", false, /(CREATE|ALTER|DROP)\s+POLICY[^;]*storage\.objects|ON\s+storage\.objects/i.test(tutto));
  c("non tocca landing-media", false, /landing-media/.test(tutto));
  c("nessun trigger, nessuna vista, nessuna estensione", false, /\bCREATE\s+(TRIGGER|VIEW|MATERIALIZED|EXTENSION|SCHEMA)\b/i.test(tutto));

  //  ── A · il bucket ──
  const bucket = vivo.A.match(/UPDATE storage\.buckets[\s\S]*?;/)?.[0] ?? "";
  c("A · bucket: UPDATE solo se è ancora com'era (id, privato, 8 MiB, esattamente i tre tipi)", true,
    /WHERE id = 'ponte-media'\s+AND public = false\s+AND file_size_limit = 8388608\s+AND allowed_mime_types = ARRAY\['image\/jpeg', 'image\/png', 'image\/webp'\];/.test(bucket));
  c("A · bucket: nuovo limite 47.185.920 (45 MiB) e i 16 tipi del PIANO, in ordine", [47185920, Object.keys(TIPI)], [
    Number(bucket.match(/file_size_limit = (\d+),/)?.[1]),
    [...(bucket.match(/allowed_mime_types = ARRAY\[([\s\S]*?)\]\s+WHERE/)?.[1] ?? "").matchAll(/'([^']+)'/g)].map((x) => x[1]),
  ]);
  c("A · bucket: non lo rende pubblico, non lo crea (nessun INSERT su storage.buckets)", [false, false], [/public = true/.test(bucket), /INSERT\s+INTO\s+storage\.buckets/i.test(tutto)]);

  //  ── A · la tabella dei tipi (funzioni IMMUTABLE) ──
  for (const [nome, campo] of [["ponte_wa_media_categoria", 0], ["ponte_wa_media_estensione", 1]]) {
    const f = corpoFunzione(vivo.A, nome);
    const trovati = Object.fromEntries([...f.matchAll(/WHEN '([^']+)' THEN '([^']+)'/g)].map((x) => [x[1], x[2]]));
    c(`A · ${nome}(): IMMUTABLE e tutta la tabella a.1 (16 tipi)`, [true, Object.fromEntries(Object.entries(TIPI).map(([m, v]) => [m, v[campo]]))], [/LANGUAGE sql IMMUTABLE/.test(f), trovati]);
  }
  const lim = corpoFunzione(vivo.A, "ponte_wa_media_limite");
  c("A · ponte_wa_media_limite(): IMMUTABLE, foto 8 · audio 16 · video 45 · documento 25 MiB", [true, LIMITI], [
    /LANGUAGE sql IMMUTABLE/.test(lim),
    Object.fromEntries([...lim.matchAll(/WHEN '(\w+)' THEN (\d+)::bigint/g)].map((x) => [x[1], Number(x[2])])),
  ]);
  c("A · il CHECK di mime ha gli stessi 16 tipi", Object.keys(TIPI), [...(vivo.A.match(/ADD CONSTRAINT ponte_wa_media_mime_check CHECK \(mime IN \(([\s\S]*?)\)\);/)?.[1] ?? "").matchAll(/'([^']+)'/g)].map((x) => x[1]));
  c("A · il CHECK di stato ha anche «liberato»; quello di byte arriva a 47.185.920", [true, true], [
    /ADD CONSTRAINT ponte_wa_media_stato_check CHECK \(stato IN \('in_caricamento', 'pronta', 'liberato'\)\)/.test(vivo.A),
    /ADD CONSTRAINT ponte_wa_media_byte_check CHECK \(byte BETWEEN 0 AND 47185920\)/.test(vivo.A),
  ]);
  c("A · i CHECK si allargano solo se non lo sono già, e se i nomi sono inattesi si ferma (RAISE EXCEPTION)", [3, true], [
    (vivo.A.match(/IF NOT EXISTS \(SELECT 1 FROM pg_constraint WHERE conrelid = 'public\.ponte_wa_media'::regclass AND conname = 'ponte_wa_media_(?:mime|stato|byte)_check'/g) ?? []).length,
    /RAISE EXCEPTION 'ponte_wa_media: i CHECK della colonna/.test(vivo.A),
  ]);

  //  ── A · le colonne e gli indici ──
  const alter = compatto(vivo.A.match(/ALTER TABLE public\.ponte_wa_media\s+ADD COLUMN[\s\S]*?;/)?.[0] ?? "");
  c("A · colonne nuove, tutte IF NOT EXISTS (categoria, nome, durata_s, larghezza, altezza, miniatura, scade_il, liberato_il)", ["categoria", "nome", "durata_s", "larghezza", "altezza", "miniatura", "scade_il", "liberato_il"],
    [...alter.matchAll(/ADD COLUMN IF NOT EXISTS (\w+)/g)].map((x) => x[1]));
  c("A · categoria: di serie 'foto' (le righe del 30/10 restano valide) e CHECK sulle quattro", true, /categoria text NOT NULL DEFAULT 'foto' CHECK \(categoria IN \('foto', 'audio', 'video', 'documento'\)\)/.test(alter));
  c("A · miniatura: CHECK su lunghezza (≤ 12.000) e SOLO caratteri base64 che cominciano per /9j/", true,
    /miniatura text CHECK \(miniatura IS NULL OR \(length\(miniatura\) <= 12000 AND miniatura ~ '\^\/9j\/\[A-Za-z0-9\+\/\]\*=\{0,2\}\$'\)\)/.test(alter));
  c("A · gli altri ALTER TABLE: nessuno (solo ponte_wa_media, e quello è l'ADD COLUMN)", [], [...vivo.A.matchAll(/ALTER TABLE\s+(?:ONLY\s+)?([\w.]+)\s+(\w+)/gi)]
    .filter((x) => !(x[1] === "public.ponte_wa_media" && ["ADD", "DROP"].includes(x[2].toUpperCase())) && !(x[1] === "public.ponte_wa_media_richieste" && x[2].toUpperCase() === "ENABLE")).map((x) => `${x[1]} ${x[2]}`));
  c("A · gli indici sono due, IF NOT EXISTS: (user_id, path) e il parziale su scade_il", [
    "CREATE INDEX IF NOT EXISTS idx_ponte_media_path ON public.ponte_wa_media (user_id, path)",
    "CREATE INDEX IF NOT EXISTS idx_ponte_media_scadenza ON public.ponte_wa_media (scade_il) WHERE stato = 'pronta' AND scade_il IS NOT NULL",
  ], [...vivo.A.matchAll(/CREATE INDEX[^;]*;/g)].map((x) => compatto(x[0]).replace(/;$/, "")));

  //  ── A · la tabella delle richieste ──
  const t = vivo.A.slice(vivo.A.indexOf("CREATE TABLE IF NOT EXISTS public.ponte_wa_media_richieste"));
  const tabella = t.slice(0, t.indexOf("\n);"));
  c("A · richieste: le colonne del PIANO, in ordine", ["user_id", "chiave", "numero", "timer_s", "stato", "motivo", "creata_il", "presa_il"], [...tabella.matchAll(/^  (\w+) (?:uuid|text|integer|timestamptz)/gm)].map((x) => x[1]));
  c("A · richieste: chiave primaria (user_id, chiave): due «Mostra» = una riga", true, /PRIMARY KEY \(user_id, chiave\)/.test(tabella));
  c("A · richieste: stato in_attesa | in_corso | non_disponibile (di serie in_attesa)", [["in_attesa", "in_corso", "non_disponibile"], "in_attesa"], [
    [...(tabella.match(/stato text NOT NULL DEFAULT '(\w+)' CHECK \(stato IN \(([^)]*)\)/)?.[2] ?? "").matchAll(/'(\w+)'/g)].map((x) => x[1]), tabella.match(/stato text NOT NULL DEFAULT '(\w+)'/)?.[1]]);
  c("A · richieste: timer ammessi 5 min, 1 h, 24 h, 7 g, 30 g (o NULL = tieni sempre)", [300, 3600, 86400, 604800, 2592000], [...(tabella.match(/timer_s IN \(([^)]*)\)/)?.[1] ?? "").matchAll(/\d+/g)].map((x) => Number(x[0])));
  c("A · richieste: motivi = gli 7 esiti ammessi", ["non_catalogato", "scaduta", "troppo_grande", "tipo", "tetto", "spenta", "errore"], [...(tabella.match(/motivo IN \(([^)]*)\)/)?.[1] ?? "").matchAll(/'(\w+)'/g)].map((x) => x[1]));
  c("A · richieste: RLS accesa, UNA policy di lettura per authenticated sulle sue righe, nessuna di scrittura", [true, 1, true, false], [
    /ALTER TABLE public\.ponte_wa_media_richieste ENABLE ROW LEVEL SECURITY;/.test(vivo.A),
    (vivo.A.match(/CREATE POLICY/g) ?? []).length,
    /CREATE POLICY "users read own ponte media richieste"\s+ON public\.ponte_wa_media_richieste FOR SELECT\s+TO authenticated\s+USING \(auth\.uid\(\) = user_id\);/.test(vivo.A),
    /CREATE POLICY[^;]*FOR (INSERT|UPDATE|DELETE|ALL)/i.test(vivo.A),
  ]);
  const rev = vivo.A.indexOf("REVOKE ALL ON public.ponte_wa_media_richieste FROM anon, authenticated;");
  const gra = vivo.A.indexOf("GRANT SELECT ON public.ponte_wa_media_richieste TO authenticated;");
  c("A · richieste: REVOKE ALL da anon e authenticated PRIMA del GRANT SELECT; service_role tutto", [true, true, false], [
    rev > 0 && gra > rev, /GRANT ALL ON public\.ponte_wa_media_richieste TO service_role;/.test(vivo.A), /GRANT[^;]*ON public\.ponte_wa_media_richieste TO[^;]*\banon\b/.test(vivo.A),
  ]);

  //  ── Le funzioni: firme esatte del PIANO, chiuse a tutti salvo service_role (A e B) ──
  const controllaServizio = (sql, firme, etichetta) => {
    for (const [nome, [args, ritorno]] of Object.entries(firme)) {
      const testa = compatto(`CREATE OR REPLACE FUNCTION public.${nome}(${args.replace(/\s*,\s*/g, ", ")}) RETURNS ${ritorno}`);
      c(`${etichetta} · ${nome}: firma del PIANO, SECURITY DEFINER, search_path fisso`, [true, true], [
        compatto(sql).includes(testa),
        new RegExp(`FUNCTION public\\.${nome}\\([\\s\\S]*?SECURITY DEFINER SET search_path = public, pg_temp AS \\$\\$`).test(sql),
      ]);
      const t = tipi(args);
      c(`${etichetta} · ${nome}: chiusa a PUBLIC, anon e authenticated; aperta a service_role`, [true, true], [
        sql.includes(`REVOKE ALL ON FUNCTION public.${nome}(${t}) FROM PUBLIC, anon, authenticated;`),
        sql.includes(`GRANT EXECUTE ON FUNCTION public.${nome}(${t}) TO service_role;`),
      ]);
    }
  };
  controllaServizio(vivo.A, FIRME_A, "A");
  controllaServizio(vivo.B, FIRME_B_SERVIZIO, "B");
  c("A, B · nessun GRANT EXECUTE a chi non è service_role, salvo le tre del pannello", ["authenticated", "authenticated", "authenticated"],
    [...tutto.matchAll(/GRANT EXECUTE ON FUNCTION[^;]*TO ([^;]*);/g)].map((x) => x[1]).filter((x) => x !== "service_role"));
  c("A · il numero delle funzioni: 3 di servizio (IMMUTABLE) + 7 del Worker", [3, 7], [
    (vivo.A.match(/LANGUAGE sql IMMUTABLE/g) ?? []).length, Object.keys(FIRME_A).length]);
  c("A · permesso e fatto: CREATE OR REPLACE con la stessa firma, mai un sovraccarico; nessun CREATE FUNCTION senza OR REPLACE", [0, 2], [
    (tutto.match(/CREATE FUNCTION/g) ?? []).length, (vivo.A.match(/FUNCTION public\.ponte_wa_media_(permesso|fatto)\(/g) ?? []).length - (vivo.A.match(/(REVOKE|GRANT)[^;]*FUNCTION public\.ponte_wa_media_(permesso|fatto)\(/g) ?? []).length]);

  //  ── A · il contenuto delle funzioni ──
  const permesso = corpoFunzione(vivo.A, "ponte_wa_media_permesso");
  const fatto = corpoFunzione(vivo.A, "ponte_wa_media_fatto");
  const richiedi = corpoFunzione(vivo.A, "ponte_wa_media_richiedi");
  const prendi = corpoFunzione(vivo.A, "ponte_wa_media_prendi");
  const esito = corpoFunzione(vivo.A, "ponte_wa_media_richiesta_esito");
  const pulizia = corpoFunzione(vivo.A, "ponte_wa_media_pulizia");
  c("permesso: tipo e limite dalla tabella del database (categoria + limite), mai numeri sparsi", [true, false], [/ponte_wa_media_categoria\(p_mime\)/.test(permesso) && /ponte_wa_media_limite\(v_cat\)/.test(permesso), /8388608|16777216|47185920|26214400/.test(permesso)]);
  c("permesso: una riga «liberato» → rifiutato · liberato (non si riscarica da sola)", true, /v_riga\.stato = 'liberato' THEN\s+RETURN jsonb_build_object\('esito', 'rifiutato', 'motivo', 'liberato'\)/.test(permesso));
  c("permesso: il percorso sta sotto <user_id>/, estensione dal tipo, senza numero né chiave", [true, false], [
    /v_path := p_user_id::text \|\| '\/' \|\| gen_random_uuid\(\)::text \|\| '\.' \|\| v_ext;/.test(permesso), /v_path :=[^;]*(numero|chiave)/.test(permesso)]);
  c("permesso: il tetto somma il solo bucket ponte-media (pesi veri) e i caricamenti in corso da meno di 2 ore", true, /bucket_id = 'ponte-media'/.test(permesso) && /interval '2 hours'/.test(permesso) && /p_tetto_byte/.test(permesso));
  c("permesso: se l'oggetto c'è già chiude con le regole di «fatto» (stesso controllo di tipo)", true, /v_chiuso := public\.ponte_wa_media_fatto\(p_user_id, p_chiave\)/.test(permesso));
  c("fatto: peso e tipo da storage.objects (metadata size e mimetype) del solo bucket ponte-media", true, /metadata ->> 'size'/.test(fatto) && /metadata ->> 'mimetype'/.test(fatto) && /bucket_id = 'ponte-media'/.test(fatto));
  c("fatto: il tipo di Storage deve stare nella categoria della riga; altrimenti «tipo» con il percorso e riga liberato (nome e miniatura NULL)", true,
    /ponte_wa_media_categoria\(v_mime\) IS DISTINCT FROM v_riga\.categoria/.test(fatto) && /'stato', 'tipo', 'path', v_riga\.path/.test(fatto) && /stato = 'liberato'[^;]*nome = NULL, miniatura = NULL/.test(fatto));
  c("fatto: sopra il limite della categoria → «troppo_grande» con il percorso", true, /v_size > public\.ponte_wa_media_limite\(v_riga\.categoria\)/.test(fatto) && /'stato', 'troppo_grande', 'path', v_riga\.path/.test(fatto));
  c("fatto: riscrive `mime` con quello di Storage e prende il timer dalla richiesta", true, /mime = v_mime/.test(fatto) && /FROM public\.ponte_wa_media_richieste r/.test(fatto) && /make_interval\(secs => v_timer\)/.test(fatto));
  c("fatto: una riga liberato o assente → {ok:false, stato:assente}", true, /v_riga\.stato = 'liberato' THEN\s+RETURN jsonb_build_object\('ok', false, 'stato', 'assente'\)/.test(fatto));
  c("richiedi: controlla che la chiave sia in whatsapp_messages dell'utente (non_trovata)", true, /'esito', 'non_trovata'/.test(richiedi));
  c("richiedi: una riga liberato torna in_caricamento con un percorso NUOVO e created_at = now()", true,
    /stato = 'liberato' THEN\s+UPDATE public\.ponte_wa_media\s+SET stato = 'in_caricamento',\s+path = p_user_id::text \|\| '\/' \|\| gen_random_uuid\(\)::text/.test(richiedi) && /created_at = now\(\)/.test(richiedi));
  c("richiedi (condizione 3): una richiesta non_disponibile torna in_attesa (stato, motivo, creata_il, presa_il)", true,
    ["stato", "motivo", "creata_il", "presa_il"].every((k) => new RegExp(`${k} = CASE WHEN r\\.stato = 'non_disponibile' THEN`).test(richiedi)) && /THEN 'in_attesa'/.test(richiedi));
  c("richiedi: pronta → gia_pronta; ON CONFLICT (user_id, chiave): due richieste = una riga", true, /'esito', 'gia_pronta'/.test(richiedi) && /ON CONFLICT \(user_id, chiave\) DO UPDATE/.test(richiedi));
  c("prendi: FOR UPDATE SKIP LOCKED, al più 5, una in_corso da più di 10 minuti rientra", true, /FOR UPDATE SKIP LOCKED/.test(prendi) && /least\(greatest\(coalesce\(p_max, 5\), 0\), 5\)/.test(prendi) && /interval '10 minutes'/.test(prendi));
  c("richiesta_esito: i 7 esiti, altro 22023; riporta a liberato la riga in_caricamento senza oggetto", true,
    /p_esito NOT IN \('non_catalogato', 'scaduta', 'troppo_grande', 'tipo', 'tetto', 'spenta', 'errore'\)/.test(esito) && /ERRCODE = '22023'/.test(esito) && /m\.stato = 'in_caricamento'\s+AND NOT EXISTS \(SELECT 1 FROM storage\.objects/.test(esito));
  c("pulizia: richieste da più di 7 giorni cancellate; in_caricamento da più di 3 giorni liberate (al più 200); restituisce solo i percorsi con un oggetto", true,
    /DELETE FROM public\.ponte_wa_media_richieste WHERE creata_il < now\(\) - interval '7 days'/.test(pulizia) && /interval '3 days'/.test(pulizia) && /LIMIT 200/.test(pulizia) && /FILTER \(WHERE x\.ha\)/.test(pulizia));

  //  ── B · il contenuto delle funzioni ──
  const timer = corpoFunzione(vivo.B, "ponte_wa_media_timer");
  const scadute = corpoFunzione(vivo.B, "ponte_wa_media_scadute");
  const daLib = corpoFunzione(vivo.B, "ponte_wa_media_da_liberare");
  const liberato = corpoFunzione(vivo.B, "ponte_wa_media_liberato");
  const orfani = corpoFunzione(vivo.B, "ponte_wa_media_orfani");
  c("timer: solo i 5 valori (e 0/NULL = tieni sempre), altro 22023", true, /p_secondi NOT IN \(300, 3600, 86400, 604800, 2592000\)/.test(timer) && /ERRCODE = '22023'/.test(timer));
  c("timer: pronta → scade_il; richiesta viva → il suo timer; tutto il resto (anche liberato) → assente senza effetti", true,
    /stato = 'pronta'\s+RETURNING scade_il INTO v_scade/.test(timer) && /'stato', 'richiesta'/.test(timer) && /jsonb_build_object\('ok', false, 'stato', 'assente'\)/.test(timer) && (timer.match(/\bUPDATE\b/g) ?? []).length === 2);
  c("scadute: solo pronta con scade_il passato, le più scadute prima, al più 500 (di serie 200)", true,
    /m\.stato = 'pronta' AND m\.scade_il IS NOT NULL AND m\.scade_il <= now\(\)/.test(scadute) && /ORDER BY m\.scade_il/.test(scadute) && /least\(greatest\(coalesce\(p_limite, 200\), 0\), 500\)/.test(scadute));
  const ancora = corpoFunzione(vivo.B, "ponte_wa_media_ancora_scadute");
  c("ancora_scadute (corsa «Tieni sempre»): solo pronta, stesso path, scade_il passato, utente dato; sola lettura", true,
    /m\.user_id = p_user_id AND m\.stato = 'pronta' AND m\.scade_il IS NOT NULL AND m\.scade_il <= now\(\)/.test(ancora) && /x\.chiave = m\.chiave AND x\.path = m\.path/.test(ancora) && !/\b(UPDATE|DELETE|INSERT)\b/i.test(ancora) && /ERRCODE = '22023'/.test(ancora));
  c("da_liberare: solo pronta, percorso del database, «tutto» solo con numero e chiavi NULL, al più 500", true,
    /m\.stato = 'pronta'/.test(daLib) && /p_numero IS NULL OR m\.numero = p_numero/.test(daLib) && /p_chiavi IS NULL OR m\.chiave = ANY \(p_chiavi\)/.test(daLib) && /LIMIT least\(greatest\(coalesce\(p_limite, 500\), 0\), 500\)/.test(daLib) && /p_numero !~ '\^\[0-9\]\{8,15\}\$'/.test(daLib));
  c("liberato: aggiorna SOLO stato = 'pronta' E path uguale a quello letto", true, /m\.stato = 'pronta' AND m\.path = x\.path/.test(liberato));
  c("liberato: stato liberato, liberato_il, scade_il NULL, nome e miniatura NULL (restano categoria e peso)", true, /SET stato = 'liberato', liberato_il = now\(\), scade_il = NULL, nome = NULL, miniatura = NULL/.test(liberato));
  c("liberato: non cancella righe, non tocca categoria né byte", [false, false, false], [/\bDELETE\b/i.test(liberato), /\bbyte\s*=/.test(liberato), /\bcategoria\s*=/.test(liberato)]);
  c("orfani: oggetti del bucket ponte-media senza riga pronta/in_caricamento, al più 500", true, /o\.bucket_id = 'ponte-media'/.test(orfani) && /m\.stato IN \('pronta', 'in_caricamento'\)/.test(orfani) && /least\(greatest\(coalesce\(p_limite, 100\), 0\), 500\)/.test(orfani));

  //  ── B · il pannello (lettura dal browser) ──
  controllaBrowser(vivo.B, c);

  //  ── C · il cron ──
  const istruzioniC = vivo.C.split(";").map((x) => compatto(x)).filter((x) => x && x !== "BEGIN" && x !== "COMMIT");
  c("C · una sola istruzione: programma_hook_cron_attesa('media-scadute-1min', ogni minuto, '/hooks/media-scadute', 45000)", ["SELECT public.programma_hook_cron_attesa('media-scadute-1min', '* * * * *', '/hooks/media-scadute', 45000)"], istruzioniC);

  //  ── Le intestazioni ──
  for (const [k, nome] of [["A", "A"], ["B", "B"], ["C", "C"]]) {
    c(`${nome} · intestazione: commessa, ordine di messa in opera e «NON la lancia la squadra» (A, B) / «per ULTIMA» (C)`, true,
      /2026-10-31-media-e-archiviazione/.test(grezzo[k]) && /codice → A → B → aggiorna il Mac → C/.test(grezzo[k]) && (k === "C" ? /per ULTIMA/i.test(grezzo[k]) : /NON la lancia la squadra/.test(grezzo[k])));
  }
  c("A, B · «Applicarla due volte non fa danni», «COME SI ANNULLA» (solo in commento), «VERIFICA» con le query di sola lettura", [true, true, false, true], [
    /Applicarla due volte non fa danni/.test(grezzo.A) && /Applicarla due volte non fa danni/.test(grezzo.B),
    /COME SI ANNULLA/.test(grezzo.A) && /COME SI ANNULLA/.test(grezzo.B),
    /COME SI ANNULLA/.test(vivo.A + vivo.B),
    /VERIFICA/.test(grezzo.A) && /VERIFICA/.test(grezzo.B) && /pg_policies/.test(grezzo.A),
  ]);
  c("A · il «come si annulla» nomina le funzioni nuove, la tabella, l'UPDATE inverso del bucket e le colonne lasciate", true,
    ["DROP FUNCTION public.ponte_wa_media_pulizia", "DROP FUNCTION public.ponte_wa_media_richiesta_esito", "DROP FUNCTION public.ponte_wa_media_prendi", "DROP FUNCTION public.ponte_wa_media_richiedi",
      "DROP FUNCTION public.ponte_wa_media_dettagli", "DROP TABLE public.ponte_wa_media_richieste", "UPDATE storage.buckets SET file_size_limit = 8388608", "colonne nuove"].every((x) => grezzo.A.includes(x)));
  c("B · il «come si annulla» nomina tutte le funzioni di B", true, [...Object.keys(FIRME_B_SERVIZIO), ...Object.keys(FIRME_B_BROWSER)].every((n) => grezzo.B.includes(`DROP FUNCTION public.${n}(`)));
  c("C · «per spegnerlo» con cron.unschedule", true, /cron\.unschedule\('media-scadute-1min'\)/.test(grezzo.C));
}

/** Le tre letture del pannello: STABLE, SECURITY DEFINER, filtro auth.uid(), nessun p_user_id, aperte solo a authenticated. */
function controllaBrowser(sql, c) {
  for (const [nome, [args, ritorno]] of Object.entries(FIRME_B_BROWSER)) {
    const testa = compatto(`CREATE OR REPLACE FUNCTION public.${nome}(${args.replace(/\s*,\s*/g, ", ")}) RETURNS ${ritorno}`);
    const corpo = corpoFunzione(sql, nome);
    c(`B · ${nome}: firma del PIANO, STABLE, SECURITY DEFINER, search_path fisso`, [true, true], [
      compatto(sql).includes(testa), /\bSTABLE SECURITY DEFINER SET search_path = public, pg_temp AS \$\$/.test(corpo)]);
    c(`B · ${nome}: filtra su auth.uid() e non ha p_user_id`, [true, false], [/m\.user_id = auth\.uid\(\)/.test(corpo), /p_user_id/.test(corpo)]);
    const t = tipi(args);
    c(`B · ${nome}: REVOKE da PUBLIC e anon, GRANT a authenticated`, [true, true], [
      sql.includes(`REVOKE ALL ON FUNCTION public.${nome}(${t}) FROM PUBLIC, anon;`), sql.includes(`GRANT EXECUTE ON FUNCTION public.${nome}(${t}) TO authenticated;`)]);
    c(`B · ${nome}: sola lettura (nessun INSERT, UPDATE, DELETE)`, false, /\b(INSERT|UPDATE|DELETE)\b/i.test(corpo));
  }
  const media = corpoFunzione(sql, "ponte_wa_archivio_media");
  const chat = corpoFunzione(sql, "ponte_wa_archivio_chat");
  const riass = corpoFunzione(sql, "ponte_wa_archivio_riassunto");
  c("B · archivio_media: limite al più 100 (di serie 50, almeno 1), numero validato 22023, keyset (creato_il, chiave) decrescente", true,
    /least\(greatest\(coalesce\(p_limite, 50\), 1\), 100\)/.test(media) && /p_numero !~ '\^\[0-9\]\{8,15\}\$'/.test(media) && /ERRCODE = '22023'/.test(media) && /ORDER BY m\.created_at DESC, m\.chiave DESC/.test(media));
  c("B · archivio_chat: per MB decrescenti, al più 2.000, solo pronta, peso dall'oggetto di Storage (join sul nome)", true,
    /ORDER BY 2 DESC/.test(chat) && /LIMIT 2000/.test(chat) && /m\.stato = 'pronta'/.test(chat) && /o\.bucket_id = 'ponte-media' AND o\.name = m\.path/.test(chat));
  c("B · archivio_riassunto: pesi solo delle pronta (liberati e senza oggetto fuori), le chiavi del PIANO", true,
    /m\.stato = 'pronta'/.test(riass) && ["byte_totali", "file", "senza_file", "con_timer", "liberati", "per_tipo"].every((k) => riass.includes(`'${k}'`)) && /LEFT JOIN storage\.objects o ON o\.bucket_id = 'ponte-media' AND o\.name = m\.path/.test(riass));
}
