/** ── PROVE: IMMAGINI DEL PONTE · LA MIGRAZIONE (testo SQL, compito T4) ──
 *
 *  Commessa 2026-10-30-ponte-storico-completo, PIANO (d). Come `invio-migrazione.mjs`:
 *  qui NON gira un Postgres. Si legge il testo di `20261030170000_ponte_immagini.sql`
 *  (i commenti si TOLGONO prima: il «come si annulla» ha DROP scritti apposta e mai
 *  eseguiti) e si controlla che sia solo aggiuntiva, che il bucket sia privato e
 *  stretto, che la tabella si legga solo con la propria riga, che le due funzioni
 *  siano chiuse a tutti salvo `service_role`, che non ci siano lucchetti né indirizzi.
 *  Il comportamento vero lo prova `prove/sql/ponte-immagini.sql` su un Postgres.
 *  Dati inventati: nessun numero né nome vero.
 *
 *  `mod`: i moduli impacchettati da `prove/prove.mjs` (qui non serve). `aiuti`: `{ c, gruppo, radice }`. */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FILE = "20261030170000_ponte_immagini.sql";

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

/** Le due funzioni con la firma che usano REVOKE e GRANT. */
const FIRME = {
  ponte_wa_media_permesso: "uuid, text, text, text, bigint, bigint",
  ponte_wa_media_fatto: "uuid, text",
};

export async function provePonteImmaginiMigrazione(_mod, { c, gruppo, radice }) {
  gruppo("PONTE · IMMAGINI · T4, LA MIGRAZIONE (TESTO)");
  const percorso = join(radice, "supabase/migrations", FILE);
  c("il file della migrazione esiste", true, existsSync(percorso));
  if (!existsSync(percorso)) return;
  const grezzo = readFileSync(percorso, "utf8");
  const sql = senzaCommenti(grezzo);
  const permesso = corpoFunzione(sql, "ponte_wa_media_permesso");
  const fatto = corpoFunzione(sql, "ponte_wa_media_fatto");

  //  ── Solo aggiunte ──
  c("niente DROP, DELETE, TRUNCATE fuori dai commenti", false, /\bDROP\b|\bDELETE\b|\bTRUNCATE\b/i.test(sql));
  c("UPDATE solo sulla tabella nuova (mai app_config, mai le chat)", [], [...sql.matchAll(/\bUPDATE\s+(?:ONLY\s+)?([\w.]+)/gi)].map((x) => x[1]).filter((t) => t !== "public.ponte_wa_media"));
  c("nessun ON CONFLICT … DO UPDATE (non si riscrive niente che esista)", false, /DO\s+UPDATE/i.test(sql));
  c("non altera tabelle esistenti", false, /\bALTER\s+TABLE\s+(?!public\.ponte_wa_media\b)/i.test(sql));
  c("la tabella nasce con IF NOT EXISTS, una sola", 1, (sql.match(/CREATE TABLE IF NOT EXISTS public\.ponte_wa_media \(/g) || []).length);
  c("ogni indice con IF NOT EXISTS", [1, 0], [(sql.match(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS/g) || []).length, (sql.match(/CREATE (?:UNIQUE )?INDEX (?!IF NOT EXISTS)/g) || []).length]);
  c("le funzioni sono due, tutte OR REPLACE", [2, 0], [(sql.match(/CREATE OR REPLACE FUNCTION public\./g) || []).length, (sql.match(/CREATE FUNCTION/g) || []).length]);
  c("le due funzioni sono quelle del piano", Object.keys(FIRME).sort(), [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)/g)].map((x) => x[1]).sort());
  c("le sole tabelle toccate da un INSERT: bucket, tabella nuova, app_config", ["INSERT INTO public.app_config", "INSERT INTO public.ponte_wa_media", "INSERT INTO storage.buckets"], [...new Set([...sql.matchAll(/\bINSERT\s+INTO\s+([\w.]+)/gi)].map((x) => `INSERT INTO ${x[1]}`))].sort());
  c("whatsapp_messages e whatsapp_contacts non compaiono (le foto non scrivono nelle chat)", false, /whatsapp_(messages|contacts)/i.test(sql));

  //  ── Il bucket ──
  c("bucket ponte-media: privato, 8 MiB, solo jpeg, png, webp", true, /INSERT INTO storage\.buckets \(id, name, public, file_size_limit, allowed_mime_types\)\s+VALUES \('ponte-media', 'ponte-media', false, 8388608, ARRAY\['image\/jpeg', 'image\/png', 'image\/webp'\]\)\s+ON CONFLICT \(id\) DO NOTHING;/.test(sql));
  c("niente SVG, HTML né altri tipi nella lista ammessa", [], [...sql.matchAll(/image\/[\w.+-]+|text\/[\w.+-]+|application\/[\w.+-]+/g)].map((x) => x[0]).filter((m) => !["image/jpeg", "image/png", "image/webp"].includes(m)));
  c("non tocca landing-media", false, /landing-media/.test(sql));
  c("nessuna policy su storage.objects (le foto passano solo da URL firmati del server)", false, /(CREATE|ALTER|DROP)\s+POLICY[^;]*storage\.objects|ON\s+storage\.objects/i.test(sql));

  //  ── La tabella ──
  const da = sql.indexOf("CREATE TABLE IF NOT EXISTS public.ponte_wa_media");
  const tabella = sql.slice(da, sql.indexOf("\n);", da));
  const colonne = ["user_id", "chiave", "numero", "path", "mime", "byte", "stato", "created_at"];
  c("le colonne del piano (d), in ordine", colonne, [...tabella.matchAll(/^  (\w+) (?:uuid|text|bigint|timestamptz)/gm)].map((x) => x[1]));
  c("chiave primaria (user_id, chiave): l'idempotenza", true, /PRIMARY KEY \(user_id, chiave\)/.test(tabella));
  c("la chiave è bw:<cifre>:<id>", true, /chiave text NOT NULL CHECK \(chiave ~ '\^bw:\[0-9\]\{8,15\}:\[A-Za-z0-9_\.-\]\{1,128\}\$'\)/.test(tabella));
  c("il numero: solo cifre, 8-15", true, /numero text NOT NULL CHECK \(numero ~ '\^\[0-9\]\{8,15\}\$'\)/.test(tabella));
  c("il tipo: solo i tre del bucket", true, /mime text NOT NULL CHECK \(mime IN \('image\/jpeg', 'image\/png', 'image\/webp'\)\)/.test(tabella));
  c("il peso: da 0 a 8 MiB", true, /byte bigint NOT NULL CHECK \(byte BETWEEN 0 AND 8388608\)/.test(tabella));
  c("lo stato: in_caricamento (di serie) | pronta", [["in_caricamento", "pronta"], "in_caricamento"], [[...(tabella.match(/stato IN \(([^)]*)\)/)?.[1] ?? "").matchAll(/'(\w+)'/g)].map((x) => x[1]), tabella.match(/stato text NOT NULL DEFAULT '(\w+)'/)?.[1]]);
  c("indice (user_id, numero): la chat aperta legge le sue foto", true, /CREATE INDEX IF NOT EXISTS idx_ponte_media_numero\s+ON public\.ponte_wa_media \(user_id, numero\)/.test(sql));

  //  ── RLS e permessi ──
  c("RLS accesa", true, /ALTER TABLE public\.ponte_wa_media ENABLE ROW LEVEL SECURITY;/.test(sql));
  c("UNA sola policy, di lettura, per authenticated, sulle sue righe (stessa forma di whatsapp_messages)", [1, true], [(sql.match(/CREATE POLICY/g) || []).length, /CREATE POLICY "users read own ponte media"\s+ON public\.ponte_wa_media FOR SELECT\s+TO authenticated\s+USING \(auth\.uid\(\) = user_id\);/.test(sql)]);
  c("nessuna policy di scrittura", false, /CREATE POLICY[^;]*FOR (INSERT|UPDATE|DELETE|ALL)/i.test(sql));
  const revoke = sql.indexOf("REVOKE ALL ON public.ponte_wa_media FROM anon, authenticated;");
  const grant = sql.indexOf("GRANT SELECT ON public.ponte_wa_media TO authenticated;");
  c("REVOKE ALL da anon e authenticated PRIMA del GRANT SELECT", true, revoke > 0 && grant > revoke);
  c("service_role: tutto", true, /GRANT ALL ON public\.ponte_wa_media TO service_role;/.test(sql));
  c("authenticated riceve solo SELECT, anon niente", [["SELECT"], false], [[...sql.matchAll(/GRANT (\w+(?:, \w+)*) ON public\.ponte_wa_media TO authenticated/g)].map((x) => x[1]), /GRANT[^;]*ON public\.ponte_wa_media TO[^;]*\banon\b/.test(sql)]);

  //  ── Le funzioni ──
  c("SECURITY DEFINER con search_path fisso, due volte", 2, (sql.match(/SECURITY DEFINER SET search_path = public, pg_temp/g) || []).length);
  for (const [nome, firma] of Object.entries(FIRME)) {
    c(`${nome}: chiusa a PUBLIC, anon e authenticated; aperta a service_role`, [true, true], [
      sql.includes(`REVOKE ALL ON FUNCTION public.${nome}(${firma}) FROM PUBLIC, anon, authenticated;`),
      sql.includes(`GRANT EXECUTE ON FUNCTION public.${nome}(${firma}) TO service_role;`),
    ]);
  }
  c("nessun GRANT EXECUTE a chi non è service_role", [], [...sql.matchAll(/GRANT EXECUTE ON FUNCTION[^;]*TO ([^;]*);/g)].map((x) => x[1]).filter((x) => x !== "service_role"));
  c("nessun lucchetto (pg_advisory): l'idempotenza è la chiave primaria", false, /pg_advisory/i.test(sql));
  c("permesso: il tetto arriva come parametro, il tipo e gli 8 MiB sono controllati", true, permesso.includes("p_tetto_byte") && /8388608/.test(permesso) && /image\/jpeg/.test(permesso));
  c("permesso: il peso usato lo legge da storage.objects del solo bucket ponte-media", true, /FROM storage\.objects[\s\S]*?bucket_id = 'ponte-media'/.test(permesso));
  c("permesso: le righe in_caricamento oltre 2 ore non contano", true, /interval '2 hours'/.test(permesso));
  const assegnaPercorso = permesso.match(/v_path\s*:=[^;]*;/)?.[0] ?? "";
  c("permesso: il percorso sta sotto <user_id>/ e non contiene né numero né chiave", [true, false], [/p_user_id::text \|\| '\/'/.test(assegnaPercorso), /numero|chiave/.test(assegnaPercorso)]);
  c("fatto: il peso è quello di storage.objects (metadata size), non quello dichiarato", true, /metadata ->> 'size'|metadata->>'size'/.test(fatto) && /bucket_id = 'ponte-media'/.test(fatto));
  c("fatto: la riga passa a pronta solo se l'oggetto c'è", true, /stato = 'pronta'/.test(fatto) && /WHERE[^;]*stato = 'in_caricamento'/.test(fatto));

  //  ── Il seme dell'interruttore ──
  c("seme: app_config ponte_immagini, TESTO, spento, 0,8 GB, ON CONFLICT DO NOTHING", true, /INSERT INTO public\.app_config \(key, value\)\s+VALUES \('ponte_immagini', '\{"acceso":false,"tettoGB":0\.8\}'\)\s+ON CONFLICT \(key\) DO NOTHING;/.test(sql));

  //  ── Nessun indirizzo, nessun segreto ──
  c("nessun indirizzo (http/https) nel SQL vivo", false, /https?:\/\//i.test(sql));
  c("nessun indirizzo nemmeno nei commenti", false, /https?:\/\//i.test(grezzo));

  //  ── L'intestazione ──
  c("«come si annulla» c'è, ed è solo in commento", [true, false], [/COME SI ANNULLA/.test(grezzo), /COME SI ANNULLA/.test(sql)]);
  c("il come si annulla nomina le due funzioni, la tabella, la riga di app_config e il bucket", true, ["DROP FUNCTION public.ponte_wa_media_fatto", "DROP FUNCTION public.ponte_wa_media_permesso", "DROP TABLE public.ponte_wa_media", "ponte_immagini", "ponte-media"].every((x) => grezzo.includes(x)));
  c("l'intestazione dice che non la lancia la squadra e dà la query di verifica", true, /NON la lancia la squadra/.test(grezzo) && /VERIFICA/.test(grezzo));
}
