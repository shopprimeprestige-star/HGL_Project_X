-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DI MEDIA E ARCHIVIAZIONE DEL PONTE, SU UN POSTGRES VERO (T1, commessa
-- 2026-10-31-media-e-archiviazione, PIANO (e) e (g.2))
--
-- Migrazioni provate:
--   20261031120000_ponte_media_tipi.sql      (A: tipi, limiti, richieste)
--   20261031130000_ponte_media_archivio.sql  (B: timer, liberazione, pannello)
--   20261031140000_ponte_media_cron.sql      (C: il cron, per ultima)
--
-- NON entra in `npm test` e NON si lancia sul database di produzione: serve un
-- database di prova con TUTTE le migrazioni applicate in ordine e con lo schema
-- `storage` (lo script `pg-prova.sh` della commessa 2026-10-30-ottimizzazioni lo
-- imita). Dalla radice del repo:
--
--   bash "<commesse>/2026-10-30-ottimizzazioni/strumenti/pg-prova.sh" "$PWD" prove/sql/ponte-media-archivio.sql
--
-- Tutto gira dentro UNA transazione che finisce con ROLLBACK. Le tre migrazioni sono
-- scritte con il loro BEGIN/COMMIT: per riapplicarle qui dentro (una transazione
-- dentro la transazione) se ne usa una copia SENZA le due righe BEGIN; e COMMIT;
-- (scritta in /tmp con un nome di questo collaudo); che quelle due righe ci siano nei
-- file originali lo controlla il primo blocco. Al primo controllo sbagliato si ferma
-- con «KO <nome>: atteso …, avuto …».
-- Dentro la transazione now() è fermo: gli orari si spostano riscrivendo le colonne
-- delle righe di prova, mai l'orologio.
--
-- Dati inventati: utenti, numeri (39333000 9xx), chiavi e pesi non esistono. Nessun
-- file vero: gli «oggetti» di Storage sono righe finte in storage.objects.
-- Limite noto: la concorrenza vera di `ponte_wa_media_prendi` (due sessioni insieme,
-- FOR UPDATE SKIP LOCKED) non si prova in una sola transazione; qui si prova la
-- non-duplicazione in sequenza e il testo della funzione lo controlla media-migrazione.mjs.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
\set mA 'supabase/migrations/20261031120000_ponte_media_tipi.sql'
\set mB 'supabase/migrations/20261031130000_ponte_media_archivio.sql'
\set mC 'supabase/migrations/20261031140000_ponte_media_cron.sql'
\set U  '00000000-0000-4000-8000-0000000000b1'
\set U2 '00000000-0000-4000-8000-0000000000b2'
\set U3 '00000000-0000-4000-8000-0000000000b3'

-- BEGIN; e COMMIT; nei file originali (uno e uno, ciascuno)
\set begin_a `grep -c '^BEGIN;$' supabase/migrations/20261031120000_ponte_media_tipi.sql`
\set commit_a `grep -c '^COMMIT;$' supabase/migrations/20261031120000_ponte_media_tipi.sql`
\set begin_b `grep -c '^BEGIN;$' supabase/migrations/20261031130000_ponte_media_archivio.sql`
\set commit_b `grep -c '^COMMIT;$' supabase/migrations/20261031130000_ponte_media_archivio.sql`
\set begin_c `grep -c '^BEGIN;$' supabase/migrations/20261031140000_ponte_media_cron.sql`
\set commit_c `grep -c '^COMMIT;$' supabase/migrations/20261031140000_ponte_media_cron.sql`
-- le copie senza BEGIN/COMMIT, per riapplicarle dentro la transazione di prova
\! sed '/^BEGIN;$/d;/^COMMIT;$/d' supabase/migrations/20261031120000_ponte_media_tipi.sql > /tmp/hgl-media-t1-A.sql
\! sed '/^BEGIN;$/d;/^COMMIT;$/d' supabase/migrations/20261031130000_ponte_media_archivio.sql > /tmp/hgl-media-t1-B.sql
\! sed '/^BEGIN;$/d;/^COMMIT;$/d' supabase/migrations/20261031140000_ponte_media_cron.sql > /tmp/hgl-media-t1-C.sql

BEGIN;
SET LOCAL TIME ZONE 'UTC';

CREATE FUNCTION pg_temp.uguale(nome text, atteso text, avuto text) RETURNS text
LANGUAGE plpgsql AS $f$
BEGIN
  IF atteso IS DISTINCT FROM avuto THEN
    RAISE EXCEPTION 'KO %: atteso «%», avuto «%»', nome, atteso, avuto;
  END IF;
  RETURN 'ok  ' || nome;
END $f$;

-- Confronto fra due jsonb (l'ordine delle chiavi non conta).
CREATE FUNCTION pg_temp.json_uguale(nome text, atteso jsonb, avuto jsonb) RETURNS text
LANGUAGE plpgsql AS $f$
BEGIN
  IF atteso IS DISTINCT FROM avuto THEN
    RAISE EXCEPTION 'KO %: atteso «%», avuto «%»', nome, atteso, avuto;
  END IF;
  RETURN 'ok  ' || nome;
END $f$;

-- Esegue un'istruzione e dice com'è finita: lo SQLSTATE dell'errore, o 'nessun errore'.
CREATE FUNCTION pg_temp.esito_di(p_sql text) RETURNS text
LANGUAGE plpgsql AS $f$
BEGIN
  EXECUTE p_sql;
  RETURN 'nessun errore';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE;
END $f$;

-- ── Il mondo prima ───────────────────────────────────────────────────────────
SELECT count(*) AS policy_prima FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' \gset
SELECT count(*) AS cron_prima FROM cron.job WHERE jobname = 'media-scadute-1min' \gset
SELECT pg_temp.uguale('A, B, C: ciascuna dentro un solo BEGIN; … COMMIT;', '1|1|1|1|1|1',
  concat_ws('|', :begin_a, :commit_a, :begin_b, :commit_b, :begin_c, :commit_c));

-- ── Le migrazioni, altre due volte di seguito (pg-prova.sh le ha già applicate una) ──
SELECT count(*) AS check_prima FROM pg_constraint WHERE conrelid = 'public.ponte_wa_media'::regclass AND contype = 'c' \gset
SELECT count(*) AS indici_prima FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('ponte_wa_media', 'ponte_wa_media_richieste') \gset
\i /tmp/hgl-media-t1-A.sql
\i /tmp/hgl-media-t1-A.sql
\i /tmp/hgl-media-t1-B.sql
\i /tmp/hgl-media-t1-B.sql
\echo 'ok  A e B applicate due volte senza errori'
SELECT pg_temp.uguale('ripetibilità: i CHECK e gli indici non si sono moltiplicati', :'check_prima' || '|' || :'indici_prima',
  (SELECT count(*)::text FROM pg_constraint WHERE conrelid = 'public.ponte_wa_media'::regclass AND contype = 'c') || '|' ||
  (SELECT count(*)::text FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('ponte_wa_media', 'ponte_wa_media_richieste')));

-- C: il collaudo imita pg_cron (cron.schedule con un nome che c'è già lo AGGIORNA: lo stub di pg-prova.sh
-- invece inserisce sempre) e dà a programma_hook_cron_attesa le due righe di configurazione che chiede.
CREATE OR REPLACE FUNCTION cron.schedule(nome text, quando text, comando text) RETURNS bigint LANGUAGE plpgsql AS $f$
DECLARE v bigint;
BEGIN
  UPDATE cron.job SET schedule = quando, command = comando WHERE jobname = nome RETURNING jobid INTO v;
  IF v IS NULL THEN
    INSERT INTO cron.job (jobname, schedule, command) VALUES (nome, quando, comando) RETURNING jobid INTO v;
  END IF;
  RETURN v;
END $f$;
DELETE FROM cron.job WHERE jobname = 'media-scadute-1min';
INSERT INTO public.app_config (key, value) VALUES ('cron_sito', 'https://sito-finto.example.invalid'), ('cron_chiave', 'chiave-finta')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
\i /tmp/hgl-media-t1-C.sql
\i /tmp/hgl-media-t1-C.sql
SELECT pg_temp.uguale('cron: dopo C (due volte) esiste media-scadute-1min, una sola volta, ogni minuto, su /hooks/media-scadute', '1|* * * * *|true',
  (SELECT concat_ws('|', count(*)::text, min(schedule), bool_and(command LIKE '%/hooks/media-scadute%' AND command LIKE '%45000%')::text) FROM cron.job WHERE jobname = 'media-scadute-1min'));
SELECT pg_temp.uguale('cron: C non programma altro (nessun altro lavoro con media nel nome)', '1',
  (SELECT count(*)::text FROM cron.job WHERE command LIKE '%media%'));

-- ── Il bucket ────────────────────────────────────────────────────────────────
SELECT pg_temp.uguale('bucket: ponte-media privato, 45 MiB, i 16 tipi di a.1', 'false|47185920|{image/jpeg,image/png,image/webp,audio/ogg,audio/mp4,audio/mpeg,audio/aac,audio/amr,video/mp4,video/3gpp,video/quicktime,video/webm,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation}',
  (SELECT concat_ws('|', public::text, file_size_limit::text, allowed_mime_types::text) FROM storage.buckets WHERE id = 'ponte-media'));
SELECT pg_temp.uguale('bucket: uno solo', '1', (SELECT count(*)::text FROM storage.buckets WHERE id = 'ponte-media'));
SELECT pg_temp.uguale('bucket: né SVG, né HTML, né ZIP, né OLE, né testo tra i tipi ammessi', 'false',
  (SELECT (allowed_mime_types && ARRAY['image/svg+xml', 'text/html', 'application/zip', 'application/msword', 'application/vnd.ms-excel', 'text/plain', 'text/csv', 'image/gif'])::text FROM storage.buckets WHERE id = 'ponte-media'));
-- Un bucket personalizzato resta com'è (l'UPDATE ha un WHERE stretto).
UPDATE storage.buckets SET file_size_limit = 1234, allowed_mime_types = ARRAY['image/jpeg'] WHERE id = 'ponte-media';
\i /tmp/hgl-media-t1-A.sql
SELECT pg_temp.uguale('bucket: personalizzato (limite e tipi diversi) → A non lo tocca', '1234|{image/jpeg}',
  (SELECT file_size_limit::text || '|' || allowed_mime_types::text FROM storage.buckets WHERE id = 'ponte-media'));
UPDATE storage.buckets SET file_size_limit = 8388608, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'], public = true WHERE id = 'ponte-media';
\i /tmp/hgl-media-t1-A.sql
SELECT pg_temp.uguale('bucket: com''era di serie ma PUBBLICO → A non lo tocca', '8388608|true',
  (SELECT file_size_limit::text || '|' || public::text FROM storage.buckets WHERE id = 'ponte-media'));
UPDATE storage.buckets SET public = false WHERE id = 'ponte-media';
\i /tmp/hgl-media-t1-A.sql
SELECT pg_temp.uguale('bucket: com''era di serie e privato → A lo allarga (45 MiB, 16 tipi)', '47185920|16',
  (SELECT file_size_limit::text || '|' || (array_length(allowed_mime_types, 1))::text FROM storage.buckets WHERE id = 'ponte-media'));
SELECT pg_temp.uguale('storage.objects: le migrazioni non hanno aggiunto policy', :'policy_prima',
  (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'));
SELECT pg_temp.uguale('storage.objects: nessuna policy nomina ponte-media', '0',
  (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (coalesce(qual, '') || coalesce(with_check, '') || policyname) ~ 'ponte-media'));

-- ── Funzioni: tabelle dei tipi e firme ───────────────────────────────────────
SELECT pg_temp.uguale('categoria(): foto|audio|video|documento|NULL', 'foto|audio|video|documento|foto|audio|video|documento|documento|documento|NULL|NULL|NULL|NULL',
  concat_ws('|',
    public.ponte_wa_media_categoria('image/jpeg'), public.ponte_wa_media_categoria('audio/ogg'),
    public.ponte_wa_media_categoria('video/mp4'), public.ponte_wa_media_categoria('application/pdf'),
    public.ponte_wa_media_categoria('image/webp'), public.ponte_wa_media_categoria('audio/amr'),
    public.ponte_wa_media_categoria('video/webm'),
    public.ponte_wa_media_categoria('application/vnd.openxmlformats-officedocument.wordprocessingml.document'),
    public.ponte_wa_media_categoria('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
    public.ponte_wa_media_categoria('application/vnd.openxmlformats-officedocument.presentationml.presentation'),
    coalesce(public.ponte_wa_media_categoria('image/svg+xml'), 'NULL'), coalesce(public.ponte_wa_media_categoria('Image/JPEG'), 'NULL'),
    coalesce(public.ponte_wa_media_categoria('application/msword'), 'NULL'), coalesce(public.ponte_wa_media_categoria(NULL), 'NULL')));
SELECT pg_temp.uguale('limite(): foto 8, audio 16, documento 25, video 45 MiB; altro NULL', '8388608|16777216|47185920|26214400|NULL',
  concat_ws('|', public.ponte_wa_media_limite('foto'), public.ponte_wa_media_limite('audio'), public.ponte_wa_media_limite('video'),
    public.ponte_wa_media_limite('documento'), coalesce(public.ponte_wa_media_limite('gif')::text, 'NULL')));
SELECT pg_temp.uguale('categoria() e limite(): IMMUTABLE', 'i|i',
  (SELECT string_agg(provolatile::text, '|' ORDER BY proname) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('ponte_wa_media_categoria', 'ponte_wa_media_limite')));
SELECT pg_temp.uguale('fatto e permesso: UN solo sovraccarico ciascuna, con le firme di prima', 'p_user_id uuid, p_chiave text|p_user_id uuid, p_chiave text, p_numero text, p_mime text, p_byte bigint, p_tetto_byte bigint',
  (SELECT string_agg(pg_get_function_identity_arguments(oid), '|' ORDER BY proname) FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('ponte_wa_media_permesso', 'ponte_wa_media_fatto')));
SELECT pg_temp.uguale('le funzioni nuove hanno le firme del PIANO (e)', 'p_user_id uuid, p_chiave text, p_nome text, p_durata_s integer, p_larghezza integer, p_altezza integer, p_miniatura text|p_user_id uuid, p_chiave text, p_timer_s integer|p_user_id uuid, p_max integer|p_user_id uuid, p_chiave text, p_esito text|(nessun argomento)',
  (SELECT string_agg(a, '|' ORDER BY n) FROM (VALUES
     (1, (SELECT pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname = 'ponte_wa_media_dettagli')),
     (2, (SELECT pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname = 'ponte_wa_media_richiedi')),
     (3, (SELECT pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname = 'ponte_wa_media_prendi')),
     (4, (SELECT pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname = 'ponte_wa_media_richiesta_esito')),
     (5, (SELECT CASE WHEN pg_get_function_identity_arguments(oid) = '' THEN '(nessun argomento)' ELSE pg_get_function_identity_arguments(oid) END FROM pg_proc WHERE proname = 'ponte_wa_media_pulizia'))) v(n, a)));
SELECT pg_temp.uguale('le funzioni di B hanno le firme del PIANO (e)', 'p_user_id uuid, p_chiave text, p_secondi integer|p_limite integer|p_user_id uuid, p_numero text, p_chiavi text[], p_limite integer|p_user_id uuid, p_voci jsonb|p_limite integer|(nessun argomento)|(nessun argomento)|p_numero text, p_limite integer, p_prima_il timestamp with time zone, p_prima_chiave text',
  (SELECT string_agg(a, '|' ORDER BY n) FROM (VALUES
     (1, (SELECT pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname = 'ponte_wa_media_timer')),
     (2, (SELECT pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname = 'ponte_wa_media_scadute')),
     (3, (SELECT pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname = 'ponte_wa_media_da_liberare')),
     (4, (SELECT pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname = 'ponte_wa_media_liberato')),
     (5, (SELECT pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname = 'ponte_wa_media_orfani')),
     (6, (SELECT CASE WHEN pg_get_function_identity_arguments(oid) = '' THEN '(nessun argomento)' END FROM pg_proc WHERE proname = 'ponte_wa_archivio_riassunto')),
     (7, (SELECT CASE WHEN pg_get_function_identity_arguments(oid) = '' THEN '(nessun argomento)' END FROM pg_proc WHERE proname = 'ponte_wa_archivio_chat')),
     (8, (SELECT pg_get_function_identity_arguments(oid) FROM pg_proc WHERE proname = 'ponte_wa_archivio_media'))) v(n, a)));
SELECT pg_temp.uguale('ogni funzione di B esiste una sola volta (nessun sovraccarico)', '13',
  (SELECT count(*)::text FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN
    ('ponte_wa_media_permesso', 'ponte_wa_media_fatto', 'ponte_wa_media_dettagli', 'ponte_wa_media_richiedi', 'ponte_wa_media_prendi',
     'ponte_wa_media_richiesta_esito', 'ponte_wa_media_pulizia', 'ponte_wa_media_timer', 'ponte_wa_media_scadute', 'ponte_wa_media_da_liberare',
     'ponte_wa_media_liberato', 'ponte_wa_media_orfani', 'ponte_wa_media_ancora_scadute')));

-- ── Aiuti ────────────────────────────────────────────────────────────────────
CREATE FUNCTION pg_temp.permesso(p_chiave text, p_numero text, p_mime text, p_byte bigint, p_tetto bigint DEFAULT 100000000000, p_user uuid DEFAULT '00000000-0000-4000-8000-0000000000b1')
RETURNS jsonb LANGUAGE sql AS $f$
  SELECT public.ponte_wa_media_permesso(p_user, p_chiave, p_numero, p_mime, p_byte, p_tetto) $f$;
CREATE FUNCTION pg_temp.fatto(p_chiave text, p_user uuid DEFAULT '00000000-0000-4000-8000-0000000000b1')
RETURNS jsonb LANGUAGE sql AS $f$ SELECT public.ponte_wa_media_fatto(p_user, p_chiave) $f$;
-- Un «oggetto» finto in Storage: bucket, percorso, peso, tipo che Storage ha registrato.
CREATE FUNCTION pg_temp.oggetto(p_bucket text, p_path text, p_size bigint, p_mime text DEFAULT 'image/jpeg') RETURNS void LANGUAGE sql AS $f$
  INSERT INTO storage.objects (bucket_id, name, metadata) VALUES (p_bucket, p_path, jsonb_build_object('size', p_size, 'mimetype', p_mime)) $f$;
CREATE FUNCTION pg_temp.riga(p_chiave text) RETURNS text LANGUAGE sql AS $f$
  SELECT concat_ws('|', stato, byte::text, mime, categoria) FROM public.ponte_wa_media WHERE user_id = '00000000-0000-4000-8000-0000000000b1' AND chiave = p_chiave $f$;
-- Un messaggio del ponte in whatsapp_messages (le richieste di «Mostra» lo cercano).
CREATE FUNCTION pg_temp.msg(p_utente uuid, p_chiave text) RETURNS void LANGUAGE sql AS $f$
  INSERT INTO public.whatsapp_messages (user_id, direction, from_number, to_number, body, wa_message_id, canale, status)
  VALUES (p_utente, 'inbound', split_part(p_chiave, ':', 2), 'baileys', '📷 Foto', p_chiave, 'baileys', 'sent') $f$;
-- Una riga di ponte_wa_media scritta a mano (come la lascerebbe il flusso vero).
CREATE FUNCTION pg_temp.media(p_chiave text, p_stato text, p_mime text, p_byte bigint DEFAULT 100, p_user uuid DEFAULT '00000000-0000-4000-8000-0000000000b1', p_path text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $f$
DECLARE v_path text := coalesce(p_path, p_user::text || '/' || gen_random_uuid()::text || '.bin');
BEGIN
  INSERT INTO public.ponte_wa_media (user_id, chiave, numero, path, mime, byte, stato, categoria)
  VALUES (p_user, p_chiave, split_part(p_chiave, ':', 2), v_path, p_mime, p_byte, p_stato, public.ponte_wa_media_categoria(p_mime));
  RETURN v_path;
END $f$;

INSERT INTO auth.users (id, email) VALUES
  (:'U'::uuid,  'prova-media-1@example.invalid'),
  (:'U2'::uuid, 'prova-media-2@example.invalid'),
  (:'U3'::uuid, 'prova-media-3@example.invalid')
ON CONFLICT (id) DO NOTHING;

-- I messaggi che le richieste cercheranno (tutti prima dell'istantanea).
SELECT pg_temp.msg(:'U'::uuid, 'bw:393330009301:M1');
SELECT pg_temp.msg(:'U'::uuid, 'bw:393330009301:M2');
SELECT pg_temp.msg(:'U'::uuid, 'bw:393330009301:M3');
SELECT pg_temp.msg(:'U'::uuid, 'bw:393330009301:M4');
SELECT pg_temp.msg(:'U'::uuid, 'bw:393330009301:M5');
SELECT pg_temp.msg(:'U'::uuid, 'bw:393330009301:M6');
SELECT pg_temp.msg(:'U'::uuid, 'bw:393330009301:M7');
SELECT pg_temp.msg(:'U'::uuid, 'bw:393330009301:M8');
SELECT pg_temp.msg(:'U'::uuid, 'bw:393330009301:M9');
SELECT pg_temp.msg(:'U2'::uuid, 'bw:393330009302:N1');   -- wa_message_id è unico in tutta la tabella
SELECT pg_temp.msg(:'U'::uuid, 'bw:393330009702:S1');
SELECT pg_temp.msg(:'U'::uuid, 'bw:393330009801:TM4');
SELECT pg_temp.msg(:'U'::uuid, 'bw:393330009920:R1');
SELECT pg_temp.msg(:'U'::uuid, 'bw:393330009920:R2');
SELECT pg_temp.msg(:'U'::uuid, 'bw:393330009920:R3');

-- L'istantanea delle chat: le funzioni non devono scriverci mai (si confronta alla fine).
SELECT md5(coalesce((SELECT string_agg(m::text, '|' ORDER BY m.id) FROM public.whatsapp_messages m), '') ||
           coalesce((SELECT string_agg(k::text, '|' ORDER BY k.id) FROM public.whatsapp_contacts k), '')) AS chat_prima \gset
INSERT INTO public.ponte_wa_media (user_id, chiave, numero, path, mime, byte, stato)
VALUES (:'U'::uuid, 'bw:393330009301:VECCHIA', '393330009301', :'U' || '/00000000-0000-4000-8000-000000000001.jpg', 'image/jpeg', 12345, 'pronta');
SELECT pg_temp.uguale('compatibilità: la riga del 30/10 vale; categoria foto di serie, i campi nuovi vuoti', 'pronta|12345|image/jpeg|foto|null',
  (SELECT concat_ws('|', stato, byte::text, mime, categoria, coalesce(scade_il::text, 'null') ) FROM public.ponte_wa_media WHERE chiave = 'bw:393330009301:VECCHIA'));
SELECT pg_temp.uguale('compatibilità: nome, durata, dimensioni, miniatura, liberato_il vuoti', 'true',
  (SELECT (nome IS NULL AND durata_s IS NULL AND larghezza IS NULL AND altezza IS NULL AND miniatura IS NULL AND liberato_il IS NULL)::text FROM public.ponte_wa_media WHERE chiave = 'bw:393330009301:VECCHIA'));
DELETE FROM public.ponte_wa_media;

-- ── permesso: ogni tipo, ogni limite, ogni rifiuto ──────────────────────────
DO $d$
DECLARE
  r record;
  v jsonb;
  n int := 0;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('image/jpeg', 'jpg', 'foto', 8388608::bigint), ('image/png', 'png', 'foto', 8388608), ('image/webp', 'webp', 'foto', 8388608),
    ('audio/ogg', 'ogg', 'audio', 16777216), ('audio/mp4', 'm4a', 'audio', 16777216), ('audio/mpeg', 'mp3', 'audio', 16777216),
    ('audio/aac', 'aac', 'audio', 16777216), ('audio/amr', 'amr', 'audio', 16777216),
    ('video/mp4', 'mp4', 'video', 47185920), ('video/3gpp', '3gp', 'video', 47185920), ('video/quicktime', 'mov', 'video', 47185920), ('video/webm', 'webm', 'video', 47185920),
    ('application/pdf', 'pdf', 'documento', 26214400),
    ('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx', 'documento', 26214400),
    ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx', 'documento', 26214400),
    ('application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx', 'documento', 26214400)
  ) t(mime, ext, cat, lim) LOOP
    n := n + 1;
    -- esattamente al limite: carica; il percorso ha l'estensione giusta e niente numero né chiave
    v := public.ponte_wa_media_permesso('00000000-0000-4000-8000-0000000000b1', 'bw:393330009401:T' || n, '393330009401', r.mime, r.lim, 100000000000);
    IF v->>'esito' <> 'carica' THEN RAISE EXCEPTION 'KO % al limite: %', r.mime, v; END IF;
    IF (v->>'path') !~ ('^00000000-0000-4000-8000-0000000000b1/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.' || r.ext || '$')
       OR (v->>'path') LIKE '%393330009401%' THEN
      RAISE EXCEPTION 'KO % percorso: %', r.mime, v->>'path';
    END IF;
    IF (SELECT categoria || '|' || mime || '|' || stato FROM public.ponte_wa_media WHERE chiave = 'bw:393330009401:T' || n) <> r.cat || '|' || r.mime || '|in_caricamento' THEN
      RAISE EXCEPTION 'KO % riga: categoria o tipo sbagliati', r.mime;
    END IF;
    -- un byte oltre il limite: troppo_grande, nessuna riga
    v := public.ponte_wa_media_permesso('00000000-0000-4000-8000-0000000000b1', 'bw:393330009401:G' || n, '393330009401', r.mime, r.lim + 1, 100000000000);
    IF v <> '{"esito":"rifiutato","motivo":"troppo_grande"}'::jsonb THEN RAISE EXCEPTION 'KO % a +1 byte: %', r.mime, v; END IF;
    IF EXISTS (SELECT 1 FROM public.ponte_wa_media WHERE chiave = 'bw:393330009401:G' || n) THEN RAISE EXCEPTION 'KO % rifiutato ma con una riga', r.mime; END IF;
  END LOOP;
  IF n <> 16 THEN RAISE EXCEPTION 'KO attesi 16 tipi, provati %', n; END IF;
END $d$;
\echo 'ok  permesso: i 16 tipi (a.1) passano al loro limite con l''estensione giusta e a +1 byte sono troppo_grande'
DELETE FROM public.ponte_wa_media;

SELECT pg_temp.uguale('permesso: i limiti sono per categoria (un video da 20 MiB sì, una foto da 20 MiB no)', 'carica|troppo_grande',
  (pg_temp.permesso('bw:393330009402:V1', '393330009402', 'video/mp4', 20971520)->>'esito') || '|' || (pg_temp.permesso('bw:393330009402:F1', '393330009402', 'image/jpeg', 20971520)->>'motivo'));
SELECT pg_temp.uguale('permesso: video 45 MiB = 47.185.920 byte', '47185920', public.ponte_wa_media_limite('video')::text);
DO $d$
DECLARE m text;
BEGIN
  -- Fuori elenco: tipo, mai una riga (ZIP, eseguibili, HTML, SVG, XML, script, OLE, testo, GIF, maiuscole, vuoto).
  FOREACH m IN ARRAY ARRAY['application/zip', 'application/x-msdownload', 'text/html', 'image/svg+xml', 'application/xml', 'text/javascript',
    'application/msword', 'application/vnd.ms-excel', 'application/vnd.ms-powerpoint', 'text/plain', 'text/csv', 'image/gif', 'Image/JPEG',
    'application/PDF', 'audio/ogg; codecs=opus', 'audio/webm', 'video/x-matroska', 'application/octet-stream', 'image/heic', ''] LOOP
    IF public.ponte_wa_media_permesso('00000000-0000-4000-8000-0000000000b1', 'bw:393330009403:X1', '393330009403', m, 1000, 100000000000)
       <> '{"esito":"rifiutato","motivo":"tipo"}'::jsonb THEN
      RAISE EXCEPTION 'KO tipo fuori elenco accettato: %', m;
    END IF;
  END LOOP;
  IF public.ponte_wa_media_permesso('00000000-0000-4000-8000-0000000000b1', 'bw:393330009403:X1', '393330009403', NULL, 1000, 100000000000)
     <> '{"esito":"rifiutato","motivo":"tipo"}'::jsonb THEN RAISE EXCEPTION 'KO tipo nullo accettato'; END IF;
END $d$;
\echo 'ok  permesso: 21 tipi fuori elenco (ZIP, exe, HTML, SVG, XML, script, OLE, txt, csv, gif, maiuscole, con parametri, vuoto, NULL) → rifiutato · tipo'
SELECT pg_temp.uguale('permesso: 0 byte, negativo e NULL → troppo_grande', 'troppo_grande|troppo_grande|troppo_grande',
  (pg_temp.permesso('bw:393330009403:Z1', '393330009403', 'video/mp4', 0)->>'motivo') || '|' || (pg_temp.permesso('bw:393330009403:Z2', '393330009403', 'audio/ogg', -5)->>'motivo') || '|' || (pg_temp.permesso('bw:393330009403:Z3', '393330009403', 'application/pdf', NULL)->>'motivo'));
SELECT pg_temp.uguale('permesso: i rifiuti non lasciano righe (c''è solo la V1, che era buona)', '1',
  (SELECT count(*)::text FROM public.ponte_wa_media WHERE chiave LIKE 'bw:39333000940_:%'));
DELETE FROM public.ponte_wa_media;

-- Dati sbagliati dal chiamante: errore chiaro (22023), nessuna riga.
SELECT pg_temp.uguale('permesso: utente nullo, chiave e numero non validi → 22023', '22023|22023|22023|22023|22023',
  concat_ws('|',
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_permesso(NULL, 'bw:393330009404:A', '393330009404', 'image/jpeg', 10, 1000000) $q$),
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_permesso('00000000-0000-4000-8000-0000000000b1', 'senza-prefisso', '393330009404', 'image/jpeg', 10, 1000000) $q$),
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_permesso('00000000-0000-4000-8000-0000000000b1', 'bw:393330009405:A', '393330009404', 'image/jpeg', 10, 1000000) $q$),
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_permesso('00000000-0000-4000-8000-0000000000b1', 'bw:393330009404:A', '12; drop', 'image/jpeg', 10, 1000000) $q$),
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_permesso('00000000-0000-4000-8000-0000000000b1', 'bw:393330009404:con spazio', '393330009404', 'image/jpeg', 10, 1000000) $q$)));
SELECT pg_temp.uguale('permesso: …e nessuna riga è nata', '0', (SELECT count(*)::text FROM public.ponte_wa_media));

-- Idempotenza, già presente, tetto (come il 30/10, ora anche per le altre categorie).
SELECT pg_temp.permesso('bw:393330009406:A1', '393330009406', 'audio/ogg', 200000) AS p1 \gset
SELECT pg_temp.permesso('bw:393330009406:A1', '393330009406', 'audio/ogg', 200000) AS p1b \gset
SELECT pg_temp.uguale('permesso: la stessa chiave due volte → stesso percorso, una sola riga', 'carica|true|1',
  concat_ws('|', :'p1b'::jsonb->>'esito', ((:'p1b'::jsonb->>'path') = (:'p1'::jsonb->>'path'))::text, (SELECT count(*)::text FROM public.ponte_wa_media WHERE chiave = 'bw:393330009406:A1')));
SELECT pg_temp.permesso('bw:393330009406:A1', '393330009406', 'audio/ogg', 200000, 100000000000, :'U2'::uuid) AS p2 \gset
SELECT pg_temp.uguale('permesso: un altro utente con la stessa chiave ha la sua riga e il suo percorso', 'carica|true|2',
  concat_ws('|', :'p2'::jsonb->>'esito', ((:'p2'::jsonb->>'path') LIKE :'U2' || '/%')::text, (SELECT count(*)::text FROM public.ponte_wa_media WHERE chiave = 'bw:393330009406:A1')));
DELETE FROM public.ponte_wa_media WHERE user_id = :'U2'::uuid;
UPDATE public.ponte_wa_media SET stato = 'pronta' WHERE chiave = 'bw:393330009406:A1';
SELECT pg_temp.uguale('permesso: già pronta → gia_presente, senza percorso, anche con il tetto a zero', 'gia_presente|false|gia_presente',
  (SELECT concat_ws('|', p->>'esito', (p ? 'path')::text, pg_temp.permesso('bw:393330009406:A1', '393330009406', 'audio/ogg', 200000, 0)->>'esito') FROM pg_temp.permesso('bw:393330009406:A1', '393330009406', 'audio/ogg', 200000) p));
DELETE FROM public.ponte_wa_media;

SELECT pg_temp.oggetto('ponte-media', 'x/uno.jpg', 600000);
SELECT pg_temp.oggetto('landing-media', 'x/altro-bucket.jpg', 900000000);
SELECT pg_temp.uguale('tetto: 600.000 usati + 500.000 > 1.000.000 → tetto (un video, uguale alle foto); solo ponte-media pesa', 'rifiutato|tetto',
  (SELECT concat_ws('|', p->>'esito', p->>'motivo') FROM pg_temp.permesso('bw:393330009407:T1', '393330009407', 'video/mp4', 500000, 1000000) p));
SELECT pg_temp.uguale('tetto: 600.000 + 400.000 = il tetto → carica (inclusivo)', 'carica',
  pg_temp.permesso('bw:393330009407:T2', '393330009407', 'application/pdf', 400000, 1000000)->>'esito');
SELECT pg_temp.uguale('tetto: la riga in_caricamento (400.000, senza oggetto) pesa: un byte in più → tetto', 'tetto',
  pg_temp.permesso('bw:393330009407:T3', '393330009407', 'audio/ogg', 1, 1000000)->>'motivo');
UPDATE public.ponte_wa_media SET created_at = now() - interval '3 hours' WHERE chiave = 'bw:393330009407:T2';
SELECT pg_temp.uguale('tetto: la riga in_caricamento di 3 ore non conta più', 'carica',
  pg_temp.permesso('bw:393330009407:T3', '393330009407', 'audio/ogg', 400000, 1000000)->>'esito');
SELECT pg_temp.uguale('tetto: tetto nullo e zero → rifiutato', 'tetto|tetto',
  (pg_temp.permesso('bw:393330009407:T4', '393330009407', 'image/png', 1, NULL)->>'motivo') || '|' || (pg_temp.permesso('bw:393330009407:T5', '393330009407', 'image/png', 1, 0)->>'motivo'));
DELETE FROM public.ponte_wa_media;
DELETE FROM storage.objects;

-- Il liberato non si riscarica da solo.
SELECT pg_temp.media('bw:393330009408:L1', 'liberato', 'image/jpeg', 5000);
SELECT pg_temp.uguale('permesso: su una riga liberato → rifiutato · liberato (le ripassate automatiche non riscaricano)', 'rifiutato|liberato',
  (SELECT concat_ws('|', p->>'esito', p->>'motivo') FROM pg_temp.permesso('bw:393330009408:L1', '393330009408', 'image/jpeg', 5000) p));
SELECT pg_temp.uguale('permesso: …e la riga non cambia', 'liberato|5000|image/jpeg|foto', pg_temp.riga('bw:393330009408:L1'));
DELETE FROM public.ponte_wa_media;

-- Ripresa: l'oggetto è già in Storage ma il Mac non ha detto «fatto».
SELECT pg_temp.permesso('bw:393330009409:R1', '393330009409', 'image/png', 1) AS pr \gset
SELECT pg_temp.oggetto('ponte-media', :'pr'::jsonb->>'path', 54321, 'image/png');
SELECT pg_temp.uguale('ripresa: oggetto già in Storage → gia_presente (niente secondo PUT)', 'gia_presente',
  pg_temp.permesso('bw:393330009409:R1', '393330009409', 'image/png', 1)->>'esito');
SELECT pg_temp.uguale('ripresa: …la riga è pronta col peso vero', 'pronta|54321|image/png|foto', pg_temp.riga('bw:393330009409:R1'));
-- …ma se Storage ha un tipo fuori categoria, la ripresa non lo promuove: rifiuta e libera.
SELECT pg_temp.permesso('bw:393330009409:R2', '393330009409', 'audio/ogg', 1) AS pr2 \gset
SELECT pg_temp.oggetto('ponte-media', :'pr2'::jsonb->>'path', 1000, 'text/html');
SELECT concat_ws('|', p->>'esito', p->>'motivo') AS rr FROM pg_temp.permesso('bw:393330009409:R2', '393330009409', 'audio/ogg', 1) p \gset
SELECT pg_temp.uguale('ripresa: oggetto di tipo fuori categoria → rifiutato · tipo, riga liberato', 'rifiutato|tipo|liberato',
  :'rr' || '|' || (SELECT stato FROM public.ponte_wa_media WHERE chiave = 'bw:393330009409:R2'));
DELETE FROM public.ponte_wa_media;
DELETE FROM storage.objects;

-- ── fatto ────────────────────────────────────────────────────────────────────
SELECT pg_temp.uguale('fatto: chiave sconosciuta → ok=false, assente, nessun errore', 'false|assente',
  (SELECT concat_ws('|', f->>'ok', f->>'stato') FROM pg_temp.fatto('bw:393330009501:NONC') f));
SELECT pg_temp.permesso('bw:393330009501:F1', '393330009501', 'audio/ogg', 1) AS pf \gset
SELECT pg_temp.uguale('fatto: senza oggetto in Storage → resta in_caricamento', 'true|in_caricamento|in_caricamento|1',
  (SELECT concat_ws('|', f->>'ok', f->>'stato', (SELECT stato FROM public.ponte_wa_media WHERE chiave = 'bw:393330009501:F1'), (SELECT byte::text FROM public.ponte_wa_media WHERE chiave = 'bw:393330009501:F1'))
     FROM pg_temp.fatto('bw:393330009501:F1') f));
SELECT pg_temp.oggetto('ponte-media', :'pf'::jsonb->>'path', 7777777, 'audio/ogg');
SELECT pg_temp.fatto('bw:393330009501:F1') AS rf \gset
SELECT pg_temp.json_uguale('fatto: con l''oggetto → pronta; peso = metadata.size (7.777.777), tipo = quello di Storage',
  '{"ok":true,"stato":"pronta","byte":7777777,"mime":"audio/ogg"}'::jsonb, :'rf'::jsonb);
SELECT pg_temp.uguale('fatto: la riga dice lo stesso', 'pronta|7777777|audio/ogg|audio', pg_temp.riga('bw:393330009501:F1'));
SELECT pg_temp.json_uguale('fatto: richiamata non cambia niente', '{"ok":true,"stato":"pronta","byte":7777777,"mime":"audio/ogg"}'::jsonb, pg_temp.fatto('bw:393330009501:F1'));

-- Il tipo lo decide Storage: il dichiarato (audio/ogg) cede a quello registrato (audio/mpeg, stessa categoria).
SELECT pg_temp.permesso('bw:393330009501:F2', '393330009501', 'audio/ogg', 1) AS pf2 \gset
SELECT pg_temp.oggetto('ponte-media', :'pf2'::jsonb->>'path', 4000, 'audio/mpeg');
SELECT pg_temp.json_uguale('fatto: dichiarato audio/ogg, Storage audio/mpeg → pronta e mime riscritto con quello di Storage',
  '{"ok":true,"stato":"pronta","byte":4000,"mime":"audio/mpeg"}'::jsonb, pg_temp.fatto('bw:393330009501:F2'));
SELECT pg_temp.uguale('fatto: …nella riga', 'pronta|4000|audio/mpeg|audio', pg_temp.riga('bw:393330009501:F2'));

-- Tipo fuori categoria: non diventa pronta; esito tipo, riga liberato con nome e miniatura azzerati, percorso da rimuovere.
SELECT pg_temp.permesso('bw:393330009501:F3', '393330009501', 'application/pdf', 1) AS pf3 \gset
SELECT public.ponte_wa_media_dettagli(:'U'::uuid, 'bw:393330009501:F3', 'fattura.pdf', NULL, 600, 800, '/9j/AAAA');
SELECT pg_temp.oggetto('ponte-media', :'pf3'::jsonb->>'path', 4000, 'text/html');
SELECT pg_temp.fatto('bw:393330009501:F3') AS rf3 \gset
SELECT pg_temp.json_uguale('fatto: PUT con tipo fuori elenco (text/html) → tipo, con il percorso da rimuovere',
  jsonb_build_object('ok', true, 'stato', 'tipo', 'path', :'pf3'::jsonb->>'path'), :'rf3'::jsonb);
SELECT pg_temp.uguale('fatto: …la riga non è pronta: liberato, nome e miniatura NULL, categoria e byte restano', 'liberato|1|application/pdf|documento|true',
  (SELECT concat_ws('|', stato, byte::text, mime, categoria, (nome IS NULL AND miniatura IS NULL AND liberato_il IS NOT NULL)::text) FROM public.ponte_wa_media WHERE chiave = 'bw:393330009501:F3'));
-- …anche un tipo valido ma di un'ALTRA categoria (una foto caricata al posto di un vocale).
SELECT pg_temp.permesso('bw:393330009501:F4', '393330009501', 'audio/ogg', 1) AS pf4 \gset
SELECT pg_temp.oggetto('ponte-media', :'pf4'::jsonb->>'path', 4000, 'image/jpeg');
SELECT pg_temp.fatto('bw:393330009501:F4')->>'stato' AS st4 \gset
SELECT pg_temp.uguale('fatto: PUT image/jpeg per una riga audio → tipo (altra categoria), riga liberato', 'tipo|liberato',
  :'st4' || '|' || (SELECT stato FROM public.ponte_wa_media WHERE chiave = 'bw:393330009501:F4'));
-- …e un tipo assente nei metadati di Storage.
SELECT pg_temp.permesso('bw:393330009501:F5', '393330009501', 'audio/ogg', 1) AS pf5 \gset
INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('ponte-media', :'pf5'::jsonb->>'path', '{"size":4000}'::jsonb);
SELECT pg_temp.uguale('fatto: oggetto senza mimetype → tipo', 'tipo', pg_temp.fatto('bw:393330009501:F5')->>'stato');
-- Oggetto sopra il limite della categoria: troppo_grande.
SELECT pg_temp.permesso('bw:393330009501:F6', '393330009501', 'image/png', 1) AS pf6 \gset
SELECT pg_temp.oggetto('ponte-media', :'pf6'::jsonb->>'path', 8388609, 'image/png');
SELECT pg_temp.json_uguale('fatto: foto da 8 MiB + 1 → troppo_grande col percorso; riga liberato',
  jsonb_build_object('ok', true, 'stato', 'troppo_grande', 'path', :'pf6'::jsonb->>'path'), pg_temp.fatto('bw:393330009501:F6'));
SELECT pg_temp.uguale('fatto: …riga liberato', 'liberato', (SELECT stato FROM public.ponte_wa_media WHERE chiave = 'bw:393330009501:F6'));
SELECT pg_temp.permesso('bw:393330009501:F7', '393330009501', 'video/mp4', 1) AS pf7 \gset
SELECT pg_temp.oggetto('ponte-media', :'pf7'::jsonb->>'path', 47185920, 'video/mp4');
SELECT pg_temp.fatto('bw:393330009501:F7')->>'stato' AS st7 \gset
SELECT pg_temp.uguale('fatto: video da 45 MiB esatti → pronta', 'pronta|47185920',
  :'st7' || '|' || (SELECT byte::text FROM public.ponte_wa_media WHERE chiave = 'bw:393330009501:F7'));
-- Altro bucket, peso illeggibile, altro utente, riga liberata.
SELECT pg_temp.permesso('bw:393330009501:F8', '393330009501', 'image/jpeg', 100) AS pf8 \gset
SELECT pg_temp.oggetto('landing-media', :'pf8'::jsonb->>'path', 555);
SELECT pg_temp.uguale('fatto: l''oggetto è in un altro bucket → resta in_caricamento', 'in_caricamento', pg_temp.fatto('bw:393330009501:F8')->>'stato');
DELETE FROM storage.objects WHERE bucket_id = 'landing-media';
INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('ponte-media', :'pf8'::jsonb->>'path', '{"size":"abc","mimetype":"image/jpeg"}'::jsonb);
SELECT pg_temp.uguale('fatto: peso illeggibile → resta in_caricamento', 'in_caricamento', pg_temp.fatto('bw:393330009501:F8')->>'stato');
SELECT pg_temp.uguale('fatto: un altro utente con quella chiave → assente, la riga resta com''è', 'assente|in_caricamento',
  (pg_temp.fatto('bw:393330009501:F8', :'U2'::uuid)->>'stato') || '|' || (SELECT stato FROM public.ponte_wa_media WHERE chiave = 'bw:393330009501:F8'));
SELECT pg_temp.json_uguale('fatto: su una riga liberato → assente, nessun effetto', '{"ok":false,"stato":"assente"}'::jsonb, pg_temp.fatto('bw:393330009501:F4'));
DELETE FROM public.ponte_wa_media;
DELETE FROM storage.objects;

-- ── dettagli ─────────────────────────────────────────────────────────────────
SELECT pg_temp.permesso('bw:393330009601:D1', '393330009601', 'video/mp4', 1000) AS pd \gset
SELECT public.ponte_wa_media_dettagli(:'U'::uuid, 'bw:393330009601:D1', 'Video del salone.mp4', 42, 1280, 720, '/9j/4AAQSkZJRgABAQ==');
SELECT pg_temp.uguale('dettagli: nome, durata, dimensioni e miniatura valida si scrivono', 'Video del salone.mp4|42|1280|720|/9j/4AAQSkZJRgABAQ==',
  (SELECT concat_ws('|', nome, durata_s::text, larghezza::text, altezza::text, miniatura) FROM public.ponte_wa_media WHERE chiave = 'bw:393330009601:D1'));
-- Valori fuori misura → NULL, mai errore (e il vecchio resta: nessun azzeramento per sbaglio).
SELECT public.ponte_wa_media_dettagli(:'U'::uuid, 'bw:393330009601:D1', repeat('x', 300), -3, 0, 99999, '/9j/<script>alert(1)</script>');
SELECT pg_temp.uguale('dettagli: nome troppo lungo, durata negativa, dimensioni fuori misura, miniatura con caratteri strani → ignorati, nessun errore, il valore di prima resta', 'Video del salone.mp4|42|1280|720|/9j/4AAQSkZJRgABAQ==',
  (SELECT concat_ws('|', nome, durata_s::text, larghezza::text, altezza::text, miniatura) FROM public.ponte_wa_media WHERE chiave = 'bw:393330009601:D1'));
SELECT pg_temp.permesso('bw:393330009601:D2', '393330009601', 'image/jpeg', 1000) AS pd2 \gset
SELECT public.ponte_wa_media_dettagli(:'U'::uuid, 'bw:393330009601:D2', NULL, NULL, NULL, NULL, 'data:image/svg+xml;base64,AAAA');
SELECT public.ponte_wa_media_dettagli(:'U'::uuid, 'bw:393330009601:D2', 'x', NULL, 10, 10, '/9j/' || repeat('A', 12000));
SELECT pg_temp.uguale('dettagli: miniatura che non comincia per /9j/ o più lunga di 12.000 caratteri → NULL', 'NULL',
  (SELECT coalesce(miniatura, 'NULL') FROM public.ponte_wa_media WHERE chiave = 'bw:393330009601:D2'));
SELECT public.ponte_wa_media_dettagli(:'U'::uuid, 'bw:393330009601:D2', 'x', NULL, 10, 10, '/9j/' || repeat('A', 11996));
SELECT pg_temp.uguale('dettagli: miniatura di esattamente 12.000 caratteri → si scrive', '12000',
  (SELECT length(miniatura)::text FROM public.ponte_wa_media WHERE chiave = 'bw:393330009601:D2'));
SELECT pg_temp.uguale('dettagli: chiave assente o altro utente → nessun effetto, nessun errore', 'nessun errore|nessun errore',
  pg_temp.esito_di($q$ SELECT public.ponte_wa_media_dettagli('00000000-0000-4000-8000-0000000000b1', 'bw:393330009601:NONC', 'a', 1, 1, 1, NULL) $q$) || '|' ||
  pg_temp.esito_di($q$ SELECT public.ponte_wa_media_dettagli('00000000-0000-4000-8000-0000000000b2', 'bw:393330009601:D1', 'altrui', 1, 1, 1, NULL) $q$));
SELECT pg_temp.uguale('dettagli: …l''altro utente non ha cambiato la riga', 'Video del salone.mp4',
  (SELECT nome FROM public.ponte_wa_media WHERE chiave = 'bw:393330009601:D1'));
-- Non scrive sulle righe liberate.
UPDATE public.ponte_wa_media SET stato = 'liberato', nome = NULL, miniatura = NULL WHERE chiave = 'bw:393330009601:D1';
SELECT public.ponte_wa_media_dettagli(:'U'::uuid, 'bw:393330009601:D1', 'ricompare.mp4', 5, 5, 5, '/9j/AAAA');
SELECT pg_temp.uguale('dettagli: su una riga liberato non scrive niente', 'NULL|NULL',
  (SELECT coalesce(nome, 'NULL') || '|' || coalesce(miniatura, 'NULL') FROM public.ponte_wa_media WHERE chiave = 'bw:393330009601:D1'));
SELECT pg_temp.uguale('dettagli: chiave non valida → 22023', '22023',
  pg_temp.esito_di($q$ SELECT public.ponte_wa_media_dettagli('00000000-0000-4000-8000-0000000000b1', 'sbagliata', 'a', 1, 1, 1, NULL) $q$));
-- Il CHECK della tabella è l'ultima difesa (vale anche per chi scrive a mano).
SELECT pg_temp.uguale('CHECK miniatura: caratteri fuori base64, data: e < sono rifiutati; base64 valido con = finale passa', '23514|23514|23514|nessun errore',
  concat_ws('|',
    pg_temp.esito_di($q$ UPDATE public.ponte_wa_media SET miniatura = '/9j/AA"onerror="x' WHERE chiave = 'bw:393330009601:D2' $q$),
    pg_temp.esito_di($q$ UPDATE public.ponte_wa_media SET miniatura = 'data:image/png;base64,AAAA' WHERE chiave = 'bw:393330009601:D2' $q$),
    pg_temp.esito_di($q$ UPDATE public.ponte_wa_media SET miniatura = '/9j/' || repeat('A', 11997) WHERE chiave = 'bw:393330009601:D2' $q$),
    pg_temp.esito_di($q$ UPDATE public.ponte_wa_media SET miniatura = '/9j/AAAA==' WHERE chiave = 'bw:393330009601:D2' $q$)));
SELECT pg_temp.uguale('CHECK categoria e mime: valori fuori elenco rifiutati', '23514|23514|23514|23514',
  concat_ws('|',
    pg_temp.esito_di($q$ UPDATE public.ponte_wa_media SET categoria = 'gif' WHERE chiave = 'bw:393330009601:D2' $q$),
    pg_temp.esito_di($q$ UPDATE public.ponte_wa_media SET mime = 'text/html' WHERE chiave = 'bw:393330009601:D2' $q$),
    pg_temp.esito_di($q$ UPDATE public.ponte_wa_media SET mime = 'application/zip' WHERE chiave = 'bw:393330009601:D2' $q$),
    pg_temp.esito_di($q$ UPDATE public.ponte_wa_media SET byte = 47185921 WHERE chiave = 'bw:393330009601:D2' $q$)));
SELECT pg_temp.uguale('CHECK stato: liberato ammesso, altro no; byte a 45 MiB ammesso', 'nessun errore|23514|nessun errore',
  concat_ws('|',
    pg_temp.esito_di($q$ UPDATE public.ponte_wa_media SET stato = 'liberato' WHERE chiave = 'bw:393330009601:D2' $q$),
    pg_temp.esito_di($q$ UPDATE public.ponte_wa_media SET stato = 'cancellata' WHERE chiave = 'bw:393330009601:D2' $q$),
    pg_temp.esito_di($q$ UPDATE public.ponte_wa_media SET byte = 47185920 WHERE chiave = 'bw:393330009601:D2' $q$)));
DELETE FROM public.ponte_wa_media;

-- ── Liberazione ──────────────────────────────────────────────────────────────
-- Tre righe pronte con dettagli, un timer; poi liberato().
SELECT pg_temp.media('bw:393330009701:P1', 'pronta', 'image/jpeg', 3000) AS pa1 \gset
SELECT pg_temp.media('bw:393330009701:P2', 'pronta', 'video/mp4', 9000) AS pa2 \gset
SELECT pg_temp.media('bw:393330009701:P3', 'pronta', 'application/pdf', 100) AS pa3 \gset
UPDATE public.ponte_wa_media SET nome = 'segreto.pdf', miniatura = '/9j/AAAA', scade_il = now() + interval '1 day', durata_s = 9, larghezza = 4, altezza = 3 WHERE numero = '393330009701';
SELECT count(*) AS righe_prima FROM public.ponte_wa_media \gset
SELECT public.ponte_wa_media_liberato(:'U'::uuid, jsonb_build_array(
  jsonb_build_object('chiave', 'bw:393330009701:P1', 'path', :'pa1'),
  jsonb_build_object('chiave', 'bw:393330009701:P3', 'path', :'pa3'))) AS lib \gset
SELECT pg_temp.uguale('liberato(): ritorna le righe cambiate (2)', '2', :'lib');
SELECT pg_temp.uguale('liberato(): stato liberato, nome e miniatura NULL, scade_il NULL, liberato_il messo; categoria e byte restano', 'liberato|3000|foto|true|true|true',
  (SELECT concat_ws('|', stato, byte::text, categoria, (nome IS NULL AND miniatura IS NULL)::text, (scade_il IS NULL)::text, (liberato_il IS NOT NULL)::text) FROM public.ponte_wa_media WHERE chiave = 'bw:393330009701:P1'));
SELECT pg_temp.uguale('liberato(): mai DELETE (le righe sono le stesse di prima)', :'righe_prima', (SELECT count(*)::text FROM public.ponte_wa_media));
SELECT pg_temp.uguale('liberato(): la terza, non nominata, resta pronta con i suoi dati', 'pronta|true',
  (SELECT stato || '|' || (nome IS NOT NULL AND miniatura IS NOT NULL AND scade_il IS NOT NULL)::text FROM public.ponte_wa_media WHERE chiave = 'bw:393330009701:P2'));
SELECT pg_temp.uguale('liberato(): ripetuto è idempotente (0 righe)', '0',
  public.ponte_wa_media_liberato(:'U'::uuid, jsonb_build_array(jsonb_build_object('chiave', 'bw:393330009701:P1', 'path', :'pa1')))::text);
SELECT public.ponte_wa_media_liberato(:'U'::uuid, jsonb_build_array(jsonb_build_object('chiave', 'bw:393330009701:P2', 'path', :'U' || '/altro.mp4')))::text AS n_alt \gset
SELECT pg_temp.uguale('liberato(): percorso diverso da quello letto → 0 righe, la riga non cambia', '0|pronta',
  :'n_alt' || '|' || (SELECT stato FROM public.ponte_wa_media WHERE chiave = 'bw:393330009701:P2'));
SELECT pg_temp.uguale('liberato(): un altro utente non libera le righe altrui', '0',
  public.ponte_wa_media_liberato(:'U2'::uuid, jsonb_build_array(jsonb_build_object('chiave', 'bw:393330009701:P2', 'path', :'pa2')))::text);
SELECT pg_temp.uguale('liberato(): voce mal formata o non array → senza danni / 22023', '0|22023|22023',
  concat_ws('|',
    public.ponte_wa_media_liberato(:'U'::uuid, '[{"chiave":5},{"path":null},[],"x"]'::jsonb)::text,
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_liberato('00000000-0000-4000-8000-0000000000b1', '{"chiave":"a"}'::jsonb) $q$),
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_liberato(NULL, '[]'::jsonb) $q$)));

-- Lo scambio «Mostra» / liberato (PIANO c.1): il giro del cron legge le scadute, un'altra liberazione passa per prima, il
-- titolare preme «Mostra» (la riga torna in_caricamento con un percorso nuovo), poi arriva la liberato() con le voci
-- vecchie: non deve toccare la riga rimessa, e l'oggetto nuovo non è orfano.
SELECT pg_temp.media('bw:393330009702:S1', 'pronta', 'image/jpeg', 2000) AS ps \gset
UPDATE public.ponte_wa_media SET scade_il = now() - interval '1 minute' WHERE chiave = 'bw:393330009702:S1';
CREATE TEMP TABLE letto AS SELECT * FROM public.ponte_wa_media_scadute(200) WHERE chiave = 'bw:393330009702:S1';
SELECT pg_temp.uguale('scambio: scadute() ha letto la riga con il suo percorso', :'ps', (SELECT path FROM letto));
-- (un altro giro la libera per prima)
UPDATE public.ponte_wa_media SET stato = 'liberato', nome = NULL, miniatura = NULL, scade_il = NULL, liberato_il = now() WHERE chiave = 'bw:393330009702:S1';
SELECT public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009702:S1', NULL) AS rich \gset
SELECT pg_temp.uguale('scambio: «Mostra» → in_attesa, riga in_caricamento con un percorso NUOVO', 'in_attesa|in_caricamento|true',
  concat_ws('|', :'rich'::jsonb->>'esito', (SELECT stato FROM public.ponte_wa_media WHERE chiave = 'bw:393330009702:S1'),
    ((SELECT path FROM public.ponte_wa_media WHERE chiave = 'bw:393330009702:S1') <> :'ps')::text));
SELECT path AS nuovo_path FROM public.ponte_wa_media WHERE chiave = 'bw:393330009702:S1' \gset
SELECT pg_temp.oggetto('ponte-media', :'nuovo_path', 2000);
SELECT pg_temp.uguale('scambio: la liberato() con le voci vecchie non cambia niente', '0',
  public.ponte_wa_media_liberato(:'U'::uuid, (SELECT jsonb_agg(jsonb_build_object('chiave', chiave, 'path', path)) FROM letto))::text);
SELECT pg_temp.uguale('scambio: la riga resta in_caricamento col percorso nuovo', 'in_caricamento|true',
  (SELECT stato || '|' || (path = :'nuovo_path')::text FROM public.ponte_wa_media WHERE chiave = 'bw:393330009702:S1'));
SELECT pg_temp.uguale('scambio: l''oggetto nuovo non è orfano', 'false',
  (:'nuovo_path' = ANY (public.ponte_wa_media_orfani(500)))::text);
-- Variante: la riga rimessa è già pronta di nuovo (percorso nuovo), arriva la liberato() vecchia: ancora niente.
UPDATE public.ponte_wa_media SET stato = 'pronta' WHERE chiave = 'bw:393330009702:S1';
SELECT public.ponte_wa_media_liberato(:'U'::uuid, (SELECT jsonb_agg(jsonb_build_object('chiave', chiave, 'path', path)) FROM letto))::text AS n_var \gset
SELECT pg_temp.uguale('scambio (variante): riga di nuovo pronta col percorso nuovo + voce vecchia → 0 righe, resta pronta', '0|pronta',
  :'n_var' || '|' || (SELECT stato FROM public.ponte_wa_media WHERE chiave = 'bw:393330009702:S1'));
DROP TABLE letto;
DELETE FROM public.ponte_wa_media;
DELETE FROM public.ponte_wa_media_richieste;
DELETE FROM storage.objects;

-- orfani
SELECT pg_temp.media('bw:393330009703:O1', 'pronta', 'image/jpeg', 10) AS po1 \gset
SELECT pg_temp.media('bw:393330009703:O2', 'in_caricamento', 'image/jpeg', 10) AS po2 \gset
SELECT pg_temp.media('bw:393330009703:O3', 'liberato', 'image/jpeg', 10) AS po3 \gset
SELECT pg_temp.oggetto('ponte-media', :'po1', 10);
SELECT pg_temp.oggetto('ponte-media', :'po2', 10);
SELECT pg_temp.oggetto('ponte-media', :'po3', 10);                       -- riga liberato: la rimozione era fallita
SELECT pg_temp.oggetto('ponte-media', :'U' || '/senza-riga.jpg', 10);    -- nessuna riga
SELECT pg_temp.oggetto('landing-media', 'x/altro-bucket.jpg', 10);       -- altro bucket
SELECT pg_temp.uguale('orfani: trova l''oggetto senza riga e quello di una riga liberato; non quelli di righe pronta/in_caricamento né di altri bucket',
  ARRAY[:'po3', :'U' || '/senza-riga.jpg']::text[]::text,
  (SELECT (SELECT array_agg(x ORDER BY x) FROM unnest(public.ponte_wa_media_orfani(100)) x)::text));
SELECT pg_temp.uguale('orfani: p_limite rispettato (1 → un solo nome) e limitato a 500', '1|true',
  array_length(public.ponte_wa_media_orfani(1), 1)::text || '|' || (public.ponte_wa_media_orfani(100000) IS NOT NULL)::text);
DELETE FROM storage.objects;
SELECT pg_temp.uguale('orfani: niente da pulire → array vuoto, non NULL', '{}', public.ponte_wa_media_orfani(100)::text);
DELETE FROM public.ponte_wa_media;

-- ── Richieste di «Mostra» ────────────────────────────────────────────────────
DELETE FROM public.ponte_wa_media_richieste;
SELECT pg_temp.json_uguale('richiedi: messaggio che esiste → in_attesa', '{"esito":"in_attesa"}'::jsonb, public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009301:M1', NULL));
SELECT pg_temp.json_uguale('richiedi: la seconda volta → ancora in_attesa', '{"esito":"in_attesa"}'::jsonb, public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009301:M1', NULL));
SELECT pg_temp.uguale('richiedi: due richieste = UNA riga (in_attesa, numero dalla chiave, tieni sempre = NULL)', '1|in_attesa|393330009301|NULL',
  (SELECT concat_ws('|', count(*)::text, min(stato), min(numero), coalesce(min(timer_s)::text, 'NULL')) FROM public.ponte_wa_media_richieste WHERE chiave = 'bw:393330009301:M1' AND user_id = :'U'::uuid));
SELECT pg_temp.json_uguale('richiedi: chiave che non è in whatsapp_messages → non_trovata (il segnaposto si riconosce dal testo, la richiesta no)',
  '{"esito":"non_trovata"}'::jsonb, public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009301:NESSUNO', NULL));
SELECT pg_temp.json_uguale('richiedi: …e il messaggio di un ALTRO utente non vale', '{"esito":"non_trovata"}'::jsonb, public.ponte_wa_media_richiedi(:'U3'::uuid, 'bw:393330009301:M1', NULL));
SELECT pg_temp.uguale('richiedi: …nessuna riga per le non trovate', '0', (SELECT count(*)::text FROM public.ponte_wa_media_richieste WHERE chiave = 'bw:393330009301:NESSUNO' OR user_id = :'U3'::uuid));
SELECT pg_temp.uguale('richiedi: chiave non valida, utente nullo, timer non ammesso → 22023', '22023|22023|22023|22023|22023',
  concat_ws('|',
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_richiedi('00000000-0000-4000-8000-0000000000b1', 'cosa', NULL) $q$),
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_richiedi(NULL, 'bw:393330009301:M1', NULL) $q$),
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_richiedi('00000000-0000-4000-8000-0000000000b1', 'bw:393330009301:M1', 60) $q$),
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_richiedi('00000000-0000-4000-8000-0000000000b1', 'bw:393330009301:M1', -1) $q$),
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_richiedi('00000000-0000-4000-8000-0000000000b1', 'bw:393330009301:M1', 604801) $q$)));
-- timer: 0 = tieni sempre (NULL); un valore ammesso si ricorda; ripetere con un altro timer lo aggiorna (una riga sola)
SELECT public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009301:M2', 3600);
SELECT public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009301:M3', 0);
SELECT pg_temp.uguale('richiedi: il timer si ricorda (3600); 0 → NULL', '3600|NULL',
  (SELECT concat_ws('|', (SELECT timer_s::text FROM public.ponte_wa_media_richieste WHERE chiave = 'bw:393330009301:M2' AND user_id = :'U'::uuid),
                         (SELECT coalesce(timer_s::text, 'NULL') FROM public.ponte_wa_media_richieste WHERE chiave = 'bw:393330009301:M3' AND user_id = :'U'::uuid))));
SELECT public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009301:M2', 86400);
SELECT pg_temp.uguale('richiedi: di nuovo con un altro timer → stessa riga, timer aggiornato, ancora in_attesa', '1|86400|in_attesa',
  (SELECT concat_ws('|', count(*)::text, min(timer_s)::text, min(stato)) FROM public.ponte_wa_media_richieste WHERE chiave = 'bw:393330009301:M2' AND user_id = :'U'::uuid));

-- Riga liberato → in_caricamento con percorso nuovo; lo stato di creazione riparte da ora; estensione dal tipo.
SELECT pg_temp.media('bw:393330009301:M4', 'liberato', 'image/jpeg', 5000) AS vecchio_m4 \gset
UPDATE public.ponte_wa_media SET created_at = now() - interval '10 days', liberato_il = now() - interval '5 days' WHERE chiave = 'bw:393330009301:M4';
SELECT pg_temp.json_uguale('richiedi: su una riga liberato → in_attesa', '{"esito":"in_attesa"}'::jsonb, public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009301:M4', NULL));
SELECT pg_temp.uguale('richiedi: …la riga torna in_caricamento, percorso NUOVO con estensione .jpg, liberato_il vuoto, created_at = ora (non scade subito per la pulizia dei 3 giorni)', 'in_caricamento|true|true|true|true',
  (SELECT concat_ws('|', stato, (path <> :'vecchio_m4')::text, (path ~ ('^' || :'U' || '/[0-9a-f-]{36}\.jpg$'))::text, (liberato_il IS NULL)::text, (created_at = now())::text) FROM public.ponte_wa_media WHERE chiave = 'bw:393330009301:M4'));
-- pronta → gia_pronta, nessuna richiesta
SELECT pg_temp.media('bw:393330009301:M5', 'pronta', 'application/pdf', 5000);
SELECT pg_temp.json_uguale('richiedi: su una riga pronta → gia_pronta', '{"esito":"gia_pronta"}'::jsonb, public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009301:M5', NULL));
SELECT pg_temp.uguale('richiedi: …e non nasce nessuna richiesta', '0', (SELECT count(*)::text FROM public.ponte_wa_media_richieste WHERE chiave = 'bw:393330009301:M5'));
-- in_caricamento (un automatico in corso) resta com'è
SELECT pg_temp.media('bw:393330009301:M6', 'in_caricamento', 'audio/ogg', 5000) AS p_m6 \gset
SELECT public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009301:M6', NULL);
SELECT pg_temp.uguale('richiedi: su una riga in_caricamento → la riga non cambia (stesso percorso)', 'in_caricamento|true',
  (SELECT stato || '|' || (path = :'p_m6')::text FROM public.ponte_wa_media WHERE chiave = 'bw:393330009301:M6'));
-- Condizione 3 del revisore: una richiesta non_disponibile («Riprova») torna in_attesa, non resta com'è.
SELECT public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009301:M7', 300);
UPDATE public.ponte_wa_media_richieste SET stato = 'non_disponibile', motivo = 'errore', presa_il = now() - interval '1 hour', creata_il = now() - interval '2 hours' WHERE chiave = 'bw:393330009301:M7' AND user_id = :'U'::uuid;
SELECT pg_temp.json_uguale('richiedi: su una richiesta non_disponibile → in_attesa', '{"esito":"in_attesa"}'::jsonb, public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009301:M7', 86400));
SELECT pg_temp.uguale('richiedi: …stato in_attesa, motivo e presa_il vuoti, timer nuovo, creata_il = ora, una sola riga', 'in_attesa|NULL|true|86400|true|1',
  (SELECT concat_ws('|', stato, coalesce(motivo, 'NULL'), (presa_il IS NULL)::text, timer_s::text, (creata_il = now())::text, (SELECT count(*)::text FROM public.ponte_wa_media_richieste WHERE chiave = 'bw:393330009301:M7' AND user_id = :'U'::uuid))
     FROM public.ponte_wa_media_richieste WHERE chiave = 'bw:393330009301:M7' AND user_id = :'U'::uuid));
DELETE FROM public.ponte_wa_media;
DELETE FROM public.ponte_wa_media_richieste;

-- ── prendi ───────────────────────────────────────────────────────────────────
SELECT public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009301:M' || n, NULL) FROM generate_series(1, 7) n;
SELECT public.ponte_wa_media_richiedi(:'U2'::uuid, 'bw:393330009302:N1', NULL);
UPDATE public.ponte_wa_media_richieste SET creata_il = now() - ((10 - substr(chiave, 18)::int) || ' minutes')::interval WHERE user_id = :'U'::uuid;   -- M1 la più vecchia
SELECT pg_temp.uguale('prendi: p_max 10 → al più 5 chiavi, le più vecchie prima', '{bw:393330009301:M1,bw:393330009301:M2,bw:393330009301:M3,bw:393330009301:M4,bw:393330009301:M5}',
  public.ponte_wa_media_prendi(:'U'::uuid, 10)::text);
SELECT pg_temp.uguale('prendi: le cinque sono in_corso con presa_il', '5|5',
  (SELECT count(*)::text || '|' || count(presa_il)::text FROM public.ponte_wa_media_richieste WHERE user_id = :'U'::uuid AND stato = 'in_corso'));
SELECT pg_temp.uguale('prendi: la seconda chiamata dà solo le restanti, nessun doppione', '{bw:393330009301:M6,bw:393330009301:M7}',
  public.ponte_wa_media_prendi(:'U'::uuid, 5)::text);
SELECT pg_temp.uguale('prendi: la terza non dà niente (array vuoto, non NULL)', '{}', public.ponte_wa_media_prendi(:'U'::uuid, 5)::text);
SELECT pg_temp.uguale('prendi: p_max 0 e negativo → niente', '{}|{}', public.ponte_wa_media_prendi(:'U'::uuid, 0)::text || '|' || public.ponte_wa_media_prendi(:'U'::uuid, -3)::text);
SELECT pg_temp.uguale('prendi: le richieste di un altro utente non si toccano', 'in_attesa',
  (SELECT stato FROM public.ponte_wa_media_richieste WHERE user_id = :'U2'::uuid));
UPDATE public.ponte_wa_media_richieste SET presa_il = now() - interval '9 minutes' WHERE chiave = 'bw:393330009301:M1' AND user_id = :'U'::uuid;
SELECT pg_temp.uguale('prendi: una in_corso da 9 minuti non rientra', '{}', public.ponte_wa_media_prendi(:'U'::uuid, 5)::text);
UPDATE public.ponte_wa_media_richieste SET presa_il = now() - interval '11 minutes' WHERE chiave = 'bw:393330009301:M1' AND user_id = :'U'::uuid;
SELECT pg_temp.uguale('prendi: una in_corso da 11 minuti rientra (si riassegna)', '{bw:393330009301:M1}', public.ponte_wa_media_prendi(:'U'::uuid, 5)::text);
SELECT pg_temp.uguale('prendi: …e non rientra due volte', '{}', public.ponte_wa_media_prendi(:'U'::uuid, 5)::text);
UPDATE public.ponte_wa_media_richieste SET stato = 'non_disponibile', motivo = 'errore', presa_il = now() - interval '1 hour' WHERE chiave = 'bw:393330009301:M2' AND user_id = :'U'::uuid;
SELECT pg_temp.uguale('prendi: le non_disponibile non si riprendono, per quanto vecchie', '{}', public.ponte_wa_media_prendi(:'U'::uuid, 5)::text);
DELETE FROM public.ponte_wa_media_richieste;

-- ── richiesta_esito ──────────────────────────────────────────────────────────
DO $d$
DECLARE
  e text;
  n int := 0;
  r jsonb;
BEGIN
  FOREACH e IN ARRAY ARRAY['non_catalogato', 'scaduta', 'troppo_grande', 'tipo', 'tetto', 'spenta', 'errore'] LOOP
    n := n + 1;
    PERFORM public.ponte_wa_media_richiedi('00000000-0000-4000-8000-0000000000b1', 'bw:393330009301:M' || n, NULL);
    r := public.ponte_wa_media_richiesta_esito('00000000-0000-4000-8000-0000000000b1', 'bw:393330009301:M' || n, e);
    IF r <> '{"ok":true}'::jsonb THEN RAISE EXCEPTION 'KO esito % → %', e, r; END IF;
    IF (SELECT stato || '|' || motivo FROM public.ponte_wa_media_richieste WHERE chiave = 'bw:393330009301:M' || n AND user_id = '00000000-0000-4000-8000-0000000000b1') <> 'non_disponibile|' || e THEN
      RAISE EXCEPTION 'KO esito %: la richiesta non è non_disponibile con il motivo', e;
    END IF;
  END LOOP;
END $d$;
\echo 'ok  richiesta_esito: i 7 esiti ammessi chiudono la richiesta come non_disponibile col motivo, e rispondono {"ok":true}'
SELECT public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009301:M8', NULL);
SELECT pg_temp.uguale('richiesta_esito: un esito non ammesso, vuoto, NULL o con SQL dentro → 22023', '22023|22023|22023|22023',
  concat_ws('|',
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_richiesta_esito('00000000-0000-4000-8000-0000000000b1', 'bw:393330009301:M8', 'boh') $q$),
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_richiesta_esito('00000000-0000-4000-8000-0000000000b1', 'bw:393330009301:M8', '') $q$),
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_richiesta_esito('00000000-0000-4000-8000-0000000000b1', 'bw:393330009301:M8', NULL) $q$),
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_richiesta_esito('00000000-0000-4000-8000-0000000000b1', 'bw:393330009301:M8', 'errore''; drop table x; --') $q$)));
SELECT pg_temp.uguale('richiesta_esito: …e la richiesta resta in_attesa', 'in_attesa', (SELECT stato FROM public.ponte_wa_media_richieste WHERE chiave = 'bw:393330009301:M8' AND user_id = :'U'::uuid));
SELECT pg_temp.json_uguale('richiesta_esito: su una richiesta che non c''è → {"ok":true}, nessuna riga', '{"ok":true}'::jsonb,
  public.ponte_wa_media_richiesta_esito(:'U'::uuid, 'bw:393330009301:NESSUNA', 'errore'));
SELECT pg_temp.uguale('richiesta_esito: …nessuna riga nata', '0', (SELECT count(*)::text FROM public.ponte_wa_media_richieste WHERE chiave = 'bw:393330009301:NESSUNA'));
-- La riga rimessa in_caricamento da «Mostra», senza oggetto, se il lavoro fallisce torna liberato (senza oggetto).
DELETE FROM public.ponte_wa_media_richieste;
SELECT pg_temp.media('bw:393330009301:M8', 'liberato', 'video/mp4', 5000);
SELECT public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009301:M8', NULL);
SELECT pg_temp.uguale('richiesta_esito: prima dell''esito la riga è in_caricamento', 'in_caricamento', (SELECT stato FROM public.ponte_wa_media WHERE chiave = 'bw:393330009301:M8'));
SELECT public.ponte_wa_media_richiesta_esito(:'U'::uuid, 'bw:393330009301:M8', 'scaduta');
SELECT pg_temp.uguale('richiesta_esito: scaduta → la riga torna liberato (nome e miniatura NULL, liberato_il messo); la richiesta è non_disponibile · scaduta', 'liberato|true|non_disponibile|scaduta',
  (SELECT concat_ws('|', m.stato, (m.nome IS NULL AND m.miniatura IS NULL AND m.liberato_il IS NOT NULL)::text, r.stato, r.motivo)
     FROM public.ponte_wa_media m, public.ponte_wa_media_richieste r WHERE m.chiave = 'bw:393330009301:M8' AND r.chiave = m.chiave AND r.user_id = m.user_id));
-- …e Riprova la rimette in coda, riga e richiesta.
SELECT public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009301:M8', NULL);
SELECT pg_temp.uguale('richiedi dopo il fallimento (Riprova) → richiesta in_attesa e riga di nuovo in_caricamento', 'in_attesa|in_caricamento',
  (SELECT r.stato || '|' || m.stato FROM public.ponte_wa_media m, public.ponte_wa_media_richieste r WHERE m.chiave = 'bw:393330009301:M8' AND r.chiave = m.chiave AND r.user_id = m.user_id));
-- Se l'oggetto c'è già, la riga non si tocca.
SELECT pg_temp.media('bw:393330009301:M9', 'liberato', 'image/jpeg', 5000);
SELECT public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009301:M9', NULL);
SELECT path AS p_m9 FROM public.ponte_wa_media WHERE chiave = 'bw:393330009301:M9' \gset
SELECT pg_temp.oggetto('ponte-media', :'p_m9', 1000);
SELECT public.ponte_wa_media_richiesta_esito(:'U'::uuid, 'bw:393330009301:M9', 'errore');
SELECT pg_temp.uguale('richiesta_esito: con l''oggetto già in Storage la riga resta in_caricamento (verrà chiusa da fatto)', 'in_caricamento',
  (SELECT stato FROM public.ponte_wa_media WHERE chiave = 'bw:393330009301:M9'));
DELETE FROM public.ponte_wa_media;
DELETE FROM public.ponte_wa_media_richieste;
DELETE FROM storage.objects;

-- ── Il timer parte quando il file è pronto (fatto lo prende dalla richiesta) ─
SELECT public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009301:M1', 3600);
SELECT public.ponte_wa_media_prendi(:'U'::uuid, 5);
SELECT pg_temp.permesso('bw:393330009301:M1', '393330009301', 'video/mp4', 1000) AS pt \gset
SELECT pg_temp.uguale('fatto con richiesta: prima del fatto scade_il è vuoto (il timer non è partito)', 'NULL',
  (SELECT coalesce(scade_il::text, 'NULL') FROM public.ponte_wa_media WHERE chiave = 'bw:393330009301:M1'));
SELECT pg_temp.oggetto('ponte-media', :'pt'::jsonb->>'path', 1000, 'video/mp4');
SELECT pg_temp.fatto('bw:393330009301:M1')->>'stato' AS st \gset
SELECT pg_temp.uguale('fatto con richiesta di 3600 s: pronta, scade_il = ora + 1 ora, la richiesta è chiusa (cancellata)', 'pronta|true|0',
  (SELECT concat_ws('|', :'st', (scade_il = now() + interval '1 hour')::text, (SELECT count(*)::text FROM public.ponte_wa_media_richieste WHERE chiave = 'bw:393330009301:M1' AND user_id = :'U'::uuid))
     FROM public.ponte_wa_media WHERE chiave = 'bw:393330009301:M1'));
-- senza richiesta, o con «tieni sempre»: nessuna scadenza
SELECT public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009301:M2', NULL);
SELECT pg_temp.permesso('bw:393330009301:M2', '393330009301', 'image/png', 1000) AS pt2 \gset
SELECT pg_temp.oggetto('ponte-media', :'pt2'::jsonb->>'path', 1000, 'image/png');
SELECT pg_temp.fatto('bw:393330009301:M2');
SELECT pg_temp.permesso('bw:393330009301:M3', '393330009301', 'image/png', 1000) AS pt3 \gset
SELECT pg_temp.oggetto('ponte-media', :'pt3'::jsonb->>'path', 1000, 'image/png');
SELECT pg_temp.fatto('bw:393330009301:M3');
SELECT pg_temp.uguale('fatto: richiesta «tieni sempre» o nessuna richiesta → scade_il NULL', 'NULL|NULL',
  (SELECT string_agg(coalesce(scade_il::text, 'NULL'), '|' ORDER BY chiave) FROM public.ponte_wa_media WHERE chiave IN ('bw:393330009301:M2', 'bw:393330009301:M3')));
DELETE FROM public.ponte_wa_media;
DELETE FROM public.ponte_wa_media_richieste;
DELETE FROM storage.objects;

-- ── ponte_wa_media_timer ─────────────────────────────────────────────────────
SELECT pg_temp.media('bw:393330009801:TM1', 'pronta', 'image/jpeg', 100) AS ptm1 \gset
SELECT public.ponte_wa_media_timer(:'U'::uuid, 'bw:393330009801:TM1', 3600) AS tt \gset
SELECT pg_temp.uguale('timer: su una pronta → {"ok":true,"stato":"pronta","scade_il": ora + 1 h}', 'true|pronta|true',
  concat_ws('|', :'tt'::jsonb->>'ok', :'tt'::jsonb->>'stato', ((:'tt'::jsonb->>'scade_il')::timestamptz = now() + interval '1 hour')::text));
SELECT pg_temp.uguale('timer: …e la colonna dice lo stesso', 'true',
  (SELECT (scade_il = now() + interval '1 hour')::text FROM public.ponte_wa_media WHERE chiave = 'bw:393330009801:TM1'));
DO $d$
DECLARE s int; r jsonb;
BEGIN
  FOREACH s IN ARRAY ARRAY[300, 3600, 86400, 604800, 2592000] LOOP
    r := public.ponte_wa_media_timer('00000000-0000-4000-8000-0000000000b1', 'bw:393330009801:TM1', s);
    IF (r->>'scade_il')::timestamptz <> now() + make_interval(secs => s) THEN RAISE EXCEPTION 'KO timer % → %', s, r; END IF;
  END LOOP;
END $d$;
\echo 'ok  timer: i 5 valori ammessi (300, 3600, 86400, 604800, 2592000) impostano ora + N secondi'
SELECT pg_temp.json_uguale('timer: 0 = tieni sempre → scade_il null', '{"ok":true,"stato":"pronta","scade_il":null}'::jsonb, public.ponte_wa_media_timer(:'U'::uuid, 'bw:393330009801:TM1', 0));
SELECT public.ponte_wa_media_timer(:'U'::uuid, 'bw:393330009801:TM1', 300);
SELECT pg_temp.json_uguale('timer: NULL = tieni sempre → toglie il timer', '{"ok":true,"stato":"pronta","scade_il":null}'::jsonb, public.ponte_wa_media_timer(:'U'::uuid, 'bw:393330009801:TM1', NULL));
SELECT pg_temp.uguale('timer: …la colonna è NULL', 'NULL', (SELECT coalesce(scade_il::text, 'NULL') FROM public.ponte_wa_media WHERE chiave = 'bw:393330009801:TM1'));
SELECT public.ponte_wa_media_timer(:'U'::uuid, 'bw:393330009801:TM1', 3600);
SELECT pg_temp.uguale('timer: qualunque altro valore → 22023, e il timer di prima resta', '22023|22023|22023|22023|22023|22023|true',
  concat_ws('|',
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_timer('00000000-0000-4000-8000-0000000000b1', 'bw:393330009801:TM1', 1) $q$),
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_timer('00000000-0000-4000-8000-0000000000b1', 'bw:393330009801:TM1', 60) $q$),
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_timer('00000000-0000-4000-8000-0000000000b1', 'bw:393330009801:TM1', 3601) $q$),
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_timer('00000000-0000-4000-8000-0000000000b1', 'bw:393330009801:TM1', -300) $q$),
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_timer('00000000-0000-4000-8000-0000000000b1', 'bw:393330009801:TM1', 2592001) $q$),
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_timer(NULL, 'bw:393330009801:TM1', 300) $q$),
    (SELECT (scade_il = now() + interval '1 hour')::text FROM public.ponte_wa_media WHERE chiave = 'bw:393330009801:TM1')));
SELECT pg_temp.json_uguale('timer: chiave che non c''è → {"ok":false,"stato":"assente"}', '{"ok":false,"stato":"assente"}'::jsonb, public.ponte_wa_media_timer(:'U'::uuid, 'bw:393330009801:NONC', 300));
SELECT pg_temp.json_uguale('timer: la riga è di un altro utente → assente', '{"ok":false,"stato":"assente"}'::jsonb, public.ponte_wa_media_timer(:'U2'::uuid, 'bw:393330009801:TM1', 300));
-- Condizione 3 del revisore: la riga LIBERATO ha un esito definito: assente, nessun effetto.
SELECT pg_temp.media('bw:393330009801:TM2', 'liberato', 'image/jpeg', 100);
SELECT md5(m::text) AS riga_prima FROM public.ponte_wa_media m WHERE chiave = 'bw:393330009801:TM2' \gset
SELECT pg_temp.json_uguale('timer: su una riga liberato → {"ok":false,"stato":"assente"}', '{"ok":false,"stato":"assente"}'::jsonb, public.ponte_wa_media_timer(:'U'::uuid, 'bw:393330009801:TM2', 300));
SELECT pg_temp.uguale('timer: …la riga liberato non è cambiata (nessun effetto, nessuna richiesta nata)', :'riga_prima' || '|0',
  (SELECT md5(m::text) FROM public.ponte_wa_media m WHERE chiave = 'bw:393330009801:TM2') || '|' || (SELECT count(*)::text FROM public.ponte_wa_media_richieste));
SELECT pg_temp.media('bw:393330009801:TM3', 'in_caricamento', 'image/jpeg', 100);
SELECT pg_temp.json_uguale('timer: su una riga in_caricamento senza richiesta → assente', '{"ok":false,"stato":"assente"}'::jsonb, public.ponte_wa_media_timer(:'U'::uuid, 'bw:393330009801:TM3', 300));
SELECT pg_temp.uguale('timer: …e scade_il non è stato scritto', 'NULL', (SELECT coalesce(scade_il::text, 'NULL') FROM public.ponte_wa_media WHERE chiave = 'bw:393330009801:TM3'));
-- Con una richiesta in corso il timer si cambia sulla richiesta.
SELECT public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009801:TM4', NULL);
SELECT pg_temp.json_uguale('timer: su una richiesta in attesa → {"ok":true,"stato":"richiesta"}', '{"ok":true,"stato":"richiesta"}'::jsonb, public.ponte_wa_media_timer(:'U'::uuid, 'bw:393330009801:TM4', 604800));
SELECT pg_temp.uguale('timer: …il timer della richiesta è aggiornato', '604800|in_attesa',
  (SELECT timer_s::text || '|' || stato FROM public.ponte_wa_media_richieste WHERE chiave = 'bw:393330009801:TM4' AND user_id = :'U'::uuid));
UPDATE public.ponte_wa_media_richieste SET stato = 'non_disponibile', motivo = 'errore' WHERE chiave = 'bw:393330009801:TM4' AND user_id = :'U'::uuid;
SELECT pg_temp.json_uguale('timer: su una richiesta non_disponibile → assente (nessun file, nessuna richiesta viva)', '{"ok":false,"stato":"assente"}'::jsonb, public.ponte_wa_media_timer(:'U'::uuid, 'bw:393330009801:TM4', 300));
DELETE FROM public.ponte_wa_media;
DELETE FROM public.ponte_wa_media_richieste;

-- ── scadute ──────────────────────────────────────────────────────────────────
SELECT pg_temp.media('bw:393330009901:S1', 'pronta', 'image/jpeg') AS s1 \gset
SELECT pg_temp.media('bw:393330009901:S2', 'pronta', 'image/jpeg') AS s2 \gset
SELECT pg_temp.media('bw:393330009901:S3', 'pronta', 'image/jpeg') AS s3 \gset
SELECT pg_temp.media('bw:393330009901:S4', 'in_caricamento', 'image/jpeg') AS s4 \gset
SELECT pg_temp.media('bw:393330009901:S5', 'liberato', 'image/jpeg') AS s5 \gset
SELECT pg_temp.media('bw:393330009901:S6', 'pronta', 'audio/ogg', 100, :'U2'::uuid) AS s6 \gset
SELECT pg_temp.media('bw:393330009901:S7', 'pronta', 'video/mp4') AS s7 \gset
UPDATE public.ponte_wa_media SET scade_il = now() - interval '10 minutes' WHERE chiave IN ('bw:393330009901:S1', 'bw:393330009901:S4', 'bw:393330009901:S5', 'bw:393330009901:S6');
UPDATE public.ponte_wa_media SET scade_il = now() - interval '20 minutes' WHERE chiave = 'bw:393330009901:S7';
UPDATE public.ponte_wa_media SET scade_il = now() + interval '1 hour' WHERE chiave = 'bw:393330009901:S2';
SELECT pg_temp.uguale('scadute: solo pronta con scade_il passato (S1, S6 di U2, S7), mai future, senza timer, in_caricamento o liberato', 'bw:393330009901:S1,bw:393330009901:S6,bw:393330009901:S7',
  (SELECT string_agg(chiave, ',' ORDER BY chiave) FROM public.ponte_wa_media_scadute(200)));
SELECT pg_temp.uguale('scadute: ogni riga porta il suo utente e il suo percorso (mai mescolati)', 'true',
  (SELECT bool_and(s.path LIKE s.user_id::text || '/%' AND s.path = (SELECT m.path FROM public.ponte_wa_media m WHERE m.user_id = s.user_id AND m.chiave = s.chiave))::text FROM public.ponte_wa_media_scadute(200) s));
SELECT pg_temp.uguale('scadute: le più scadute prima; p_limite 1 → una sola (S7)', 'bw:393330009901:S7',
  (SELECT string_agg(chiave, ',') FROM public.ponte_wa_media_scadute(1)));
SELECT pg_temp.uguale('scadute: p_limite 0 → niente; NULL → il predefinito (3 righe)', '0|3',
  (SELECT count(*)::text FROM public.ponte_wa_media_scadute(0)) || '|' || (SELECT count(*)::text FROM public.ponte_wa_media_scadute(NULL)));

-- La corsa «Tieni sempre» (nota del revisore sul T3): il giro del cron legge le scadute, il titolare sceglie «Tieni sempre»
-- (o un nuovo timer) PRIMA che il file sia tolto da Storage. Prima del `remove` il giro chiede quali voci sono ANCORA scadute
-- (scadute: percorso uguale, stato pronta, scade_il passato): le altre non si toccano.
CREATE TEMP TABLE voci_giro AS
  SELECT jsonb_agg(jsonb_build_object('chiave', chiave, 'path', path) ORDER BY chiave) AS voci
    FROM public.ponte_wa_media_scadute(200) WHERE user_id = :'U'::uuid;
SELECT pg_temp.uguale('ancora_scadute: le voci appena lette dalle scadute sono ancora tutte scadute (S1, S7)', 'bw:393330009901:S1,bw:393330009901:S7',
  (SELECT string_agg(e->>'chiave', ',' ORDER BY e->>'chiave') FROM jsonb_array_elements(public.ponte_wa_media_ancora_scadute(:'U'::uuid, (SELECT voci FROM voci_giro))) e));
SELECT pg_temp.uguale('ancora_scadute: il percorso viene dal database (le voci tornano con chiave e path)', 'true',
  (SELECT bool_and(e->>'path' = (SELECT m.path FROM public.ponte_wa_media m WHERE m.user_id = :'U'::uuid AND m.chiave = e->>'chiave'))::text FROM jsonb_array_elements(public.ponte_wa_media_ancora_scadute(:'U'::uuid, (SELECT voci FROM voci_giro))) e));
SELECT pg_temp.uguale('ancora_scadute: voci non scadute o non pronte (S2 futura, S3 senza timer, S4 in_caricamento, S5 liberato) → niente', '[]',
  public.ponte_wa_media_ancora_scadute(:'U'::uuid, jsonb_build_array(
    jsonb_build_object('chiave', 'bw:393330009901:S2', 'path', :'s2'), jsonb_build_object('chiave', 'bw:393330009901:S3', 'path', :'s3'),
    jsonb_build_object('chiave', 'bw:393330009901:S4', 'path', :'s4'), jsonb_build_object('chiave', 'bw:393330009901:S5', 'path', :'s5')))::text);
SELECT pg_temp.uguale('ancora_scadute: percorso diverso da quello del database (riga rimessa in coda da «Mostra») → niente', '[]',
  public.ponte_wa_media_ancora_scadute(:'U'::uuid, jsonb_build_array(jsonb_build_object('chiave', 'bw:393330009901:S1', 'path', :'U' || '/00000000-0000-4000-8000-00000000aaaa.jpg')))::text);
SELECT pg_temp.uguale('ancora_scadute: un altro utente non vede le righe altrui (S6 è di U2)', '[]|1',
  public.ponte_wa_media_ancora_scadute(:'U'::uuid, jsonb_build_array(jsonb_build_object('chiave', 'bw:393330009901:S6', 'path', :'s6')))::text || '|' ||
  jsonb_array_length(public.ponte_wa_media_ancora_scadute(:'U2'::uuid, jsonb_build_array(jsonb_build_object('chiave', 'bw:393330009901:S6', 'path', :'s6'))))::text);
-- Il titolare sceglie «Tieni sempre» sul video S7 dopo la lettura delle scadute (la stessa funzione che chiama la rotta).
SELECT public.ponte_wa_media_timer(:'U'::uuid, 'bw:393330009901:S7', 0) AS tieni \gset
SELECT pg_temp.uguale('corsa «Tieni sempre»: dopo la scelta S7 non è più fra le voci da togliere, S1 sì', 'bw:393330009901:S1',
  (SELECT string_agg(e->>'chiave', ',') FROM jsonb_array_elements(public.ponte_wa_media_ancora_scadute(:'U'::uuid, (SELECT voci FROM voci_giro))) e));
-- …o un timer nuovo, nel futuro.
SELECT public.ponte_wa_media_timer(:'U'::uuid, 'bw:393330009901:S1', 3600) AS nuovo_timer \gset
SELECT pg_temp.uguale('corsa «nuovo timer»: con un timer nel futuro nessuna voce è più da togliere', '[]',
  public.ponte_wa_media_ancora_scadute(:'U'::uuid, (SELECT voci FROM voci_giro))::text);
SELECT pg_temp.uguale('ancora_scadute non cambia niente (sola lettura): le righe sono come prima', 'pronta|pronta',
  (SELECT string_agg(stato, '|' ORDER BY chiave) FROM public.ponte_wa_media WHERE chiave IN ('bw:393330009901:S1', 'bw:393330009901:S7')));
SELECT pg_temp.uguale('ancora_scadute: parametri non validi → 22023; array vuoto → []', '22023|22023|22023|[]',
  concat_ws('|',
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_ancora_scadute(NULL, '[]'::jsonb) $q$),
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_ancora_scadute('00000000-0000-4000-8000-0000000000b1', NULL) $q$),
    pg_temp.esito_di($q$ SELECT public.ponte_wa_media_ancora_scadute('00000000-0000-4000-8000-0000000000b1', '{"chiave":"a"}'::jsonb) $q$),
    public.ponte_wa_media_ancora_scadute(:'U'::uuid, '[]'::jsonb)::text));
DROP TABLE voci_giro;
DELETE FROM public.ponte_wa_media;

-- ── da_liberare ──────────────────────────────────────────────────────────────
SELECT pg_temp.media('bw:393330009911:D1', 'pronta', 'image/jpeg') AS d1 \gset
SELECT pg_temp.media('bw:393330009911:D2', 'pronta', 'video/mp4') AS d2 \gset
SELECT pg_temp.media('bw:393330009911:D3', 'pronta', 'audio/ogg') AS d3 \gset
SELECT pg_temp.media('bw:393330009911:D4', 'in_caricamento', 'image/jpeg') AS d4 \gset
SELECT pg_temp.media('bw:393330009911:D5', 'liberato', 'image/jpeg') AS d5 \gset
SELECT pg_temp.media('bw:393330009912:E1', 'pronta', 'application/pdf') AS e1 \gset
SELECT pg_temp.media('bw:393330009912:E2', 'pronta', 'image/png') AS e2 \gset
SELECT pg_temp.media('bw:393330009911:D1', 'pronta', 'image/jpeg', 100, :'U2'::uuid) AS z1 \gset
SELECT pg_temp.uguale('da_liberare: per numero → le sole pronta di quel numero, col percorso del database', 'bw:393330009911:D1=' || :'d1' || ',bw:393330009911:D2=' || :'d2' || ',bw:393330009911:D3=' || :'d3',
  (SELECT string_agg(chiave || '=' || path, ',' ORDER BY chiave) FROM public.ponte_wa_media_da_liberare(:'U'::uuid, '393330009911', NULL, 500)));
SELECT pg_temp.uguale('da_liberare: per chiavi → solo le pronta fra quelle nominate (non in_caricamento, non liberato)', 'bw:393330009911:D1,bw:393330009912:E1',
  (SELECT string_agg(chiave, ',' ORDER BY chiave) FROM public.ponte_wa_media_da_liberare(:'U'::uuid, NULL, ARRAY['bw:393330009911:D1', 'bw:393330009911:D4', 'bw:393330009911:D5', 'bw:393330009912:E1', 'bw:393330009999:NONC'], 500)));
SELECT pg_temp.uguale('da_liberare: numero E chiavi → entrambi i filtri', 'bw:393330009911:D1',
  (SELECT string_agg(chiave, ',' ORDER BY chiave) FROM public.ponte_wa_media_da_liberare(:'U'::uuid, '393330009911', ARRAY['bw:393330009911:D1', 'bw:393330009912:E1'], 500)));
SELECT pg_temp.uguale('da_liberare: «tutto» (numero e chiavi NULL) → tutte le pronta dell''utente, mai quelle di un altro', '5|0',
  (SELECT count(*)::text FROM public.ponte_wa_media_da_liberare(:'U'::uuid, NULL, NULL, 500)) || '|' ||
  (SELECT count(*)::text FROM public.ponte_wa_media_da_liberare(:'U'::uuid, NULL, NULL, 500) WHERE path LIKE :'U2' || '/%'));
SELECT pg_temp.uguale('da_liberare: un array vuoto di chiavi non vuol dire «tutto»', '0',
  (SELECT count(*)::text FROM public.ponte_wa_media_da_liberare(:'U'::uuid, NULL, ARRAY[]::text[], 500)));
SELECT pg_temp.uguale('da_liberare: p_limite 2 → 2; l''utente 2 vede solo la sua', '2|1',
  (SELECT count(*)::text FROM public.ponte_wa_media_da_liberare(:'U'::uuid, NULL, NULL, 2)) || '|' || (SELECT count(*)::text FROM public.ponte_wa_media_da_liberare(:'U2'::uuid, NULL, NULL, 500)));
SELECT pg_temp.uguale('da_liberare: numero non valido o utente nullo → 22023', '22023|22023|22023',
  concat_ws('|',
    pg_temp.esito_di($q$ SELECT * FROM public.ponte_wa_media_da_liberare('00000000-0000-4000-8000-0000000000b1', '12; drop', NULL, 10) $q$),
    pg_temp.esito_di($q$ SELECT * FROM public.ponte_wa_media_da_liberare('00000000-0000-4000-8000-0000000000b1', '123', NULL, 10) $q$),
    pg_temp.esito_di($q$ SELECT * FROM public.ponte_wa_media_da_liberare(NULL, NULL, NULL, 10) $q$)));
-- il limite massimo è 500, qualunque cosa si chieda
INSERT INTO public.ponte_wa_media (user_id, chiave, numero, path, mime, byte, stato)
SELECT :'U'::uuid, 'bw:393330009913:B' || i, '393330009913', :'U' || '/' || md5('b' || i)::uuid || '.jpg', 'image/jpeg', 10, 'pronta' FROM generate_series(1, 600) i;
SELECT pg_temp.uguale('da_liberare: p_limite 100000 → al più 500', '500', (SELECT count(*)::text FROM public.ponte_wa_media_da_liberare(:'U'::uuid, '393330009913', NULL, 100000)));
DELETE FROM public.ponte_wa_media;

-- ── pulizia ──────────────────────────────────────────────────────────────────
SELECT public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009920:R1', NULL);   -- verrà resa vecchia e chiusa
SELECT public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009920:R2', NULL);   -- vecchia ma ancora in_attesa
SELECT public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009920:R3', NULL);   -- chiusa da 6 giorni: resta
UPDATE public.ponte_wa_media_richieste SET stato = 'non_disponibile', motivo = 'scaduta', creata_il = now() - interval '8 days' WHERE chiave = 'bw:393330009920:R1';
UPDATE public.ponte_wa_media_richieste SET creata_il = now() - interval '8 days' WHERE chiave = 'bw:393330009920:R2';
UPDATE public.ponte_wa_media_richieste SET stato = 'non_disponibile', motivo = 'errore', creata_il = now() - interval '6 days' WHERE chiave = 'bw:393330009920:R3';
SELECT pg_temp.media('bw:393330009921:C1', 'in_caricamento', 'image/jpeg') AS c1 \gset
SELECT pg_temp.media('bw:393330009921:C2', 'in_caricamento', 'audio/ogg') AS c2 \gset
SELECT pg_temp.media('bw:393330009921:C3', 'in_caricamento', 'image/jpeg') AS c3 \gset
SELECT pg_temp.media('bw:393330009921:C4', 'pronta', 'image/jpeg') AS c4 \gset
UPDATE public.ponte_wa_media SET created_at = now() - interval '4 days', nome = 'x.jpg', miniatura = '/9j/AAAA' WHERE chiave IN ('bw:393330009921:C1', 'bw:393330009921:C2');
UPDATE public.ponte_wa_media SET created_at = now() - interval '2 days' WHERE chiave = 'bw:393330009921:C3';
UPDATE public.ponte_wa_media SET created_at = now() - interval '30 days' WHERE chiave = 'bw:393330009921:C4';
SELECT pg_temp.oggetto('ponte-media', :'c1', 100);
SELECT pg_temp.oggetto('ponte-media', :'c3', 100);
SELECT public.ponte_wa_media_pulizia() AS pul \gset
SELECT pg_temp.json_uguale('pulizia: 2 richieste cancellate (le vecchie di 7 giorni, chiuse o no), 2 righe in_caricamento liberate, e il solo percorso che ha un oggetto da rimuovere',
  jsonb_build_object('richieste', 2, 'liberate', 2, 'path', jsonb_build_array(:'c1')), :'pul'::jsonb);
SELECT pg_temp.uguale('pulizia: resta la richiesta di 6 giorni e basta', 'bw:393330009920:R3',
  (SELECT string_agg(chiave, ',') FROM public.ponte_wa_media_richieste));
SELECT pg_temp.uguale('pulizia: C1 e C2 liberato con nome e miniatura NULL; C3 e la pronta vecchia intatte', 'liberato,true|liberato,true|in_caricamento|pronta',
  (SELECT string_agg(
     CASE WHEN chiave IN ('bw:393330009921:C1', 'bw:393330009921:C2') THEN stato || ',' || (nome IS NULL AND miniatura IS NULL AND liberato_il IS NOT NULL)::text ELSE stato END, '|' ORDER BY chiave)
     FROM public.ponte_wa_media));
SELECT pg_temp.json_uguale('pulizia: ripetuta non fa più niente', '{"richieste":0,"liberate":0,"path":[]}'::jsonb, public.ponte_wa_media_pulizia());
SELECT pg_temp.uguale('pulizia: l''oggetto di C1 ora è orfano (rete di sicurezza se la rimozione fallisce) e quello di C3 no', 'true|false',
  (:'c1' = ANY (public.ponte_wa_media_orfani(500)))::text || '|' || (:'c3' = ANY (public.ponte_wa_media_orfani(500)))::text);
DELETE FROM public.ponte_wa_media;
DELETE FROM public.ponte_wa_media_richieste;
DELETE FROM storage.objects;

-- ── Il pannello «Archiviazione» (funzioni di lettura, con auth.uid()) ───────
-- U: N1 = foto 1000 + foto 2000 + video 5000 · N2 = vocale 500 + una liberata + una pronta senza oggetto · N3 = documento 9000 con timer.
-- Il peso dichiarato in riga è sempre 1: i pesi veri vengono da storage.objects. U2 ha una foto da 123.456 sullo stesso numero N1.
SELECT pg_temp.media('bw:393330009201:A1', 'pronta', 'image/jpeg', 1) AS a1 \gset
SELECT pg_temp.media('bw:393330009201:A2', 'pronta', 'image/png', 1) AS a2 \gset
SELECT pg_temp.media('bw:393330009201:A3', 'pronta', 'video/mp4', 1) AS a3 \gset
SELECT pg_temp.media('bw:393330009202:B1', 'pronta', 'audio/ogg', 1) AS b1 \gset
SELECT pg_temp.media('bw:393330009202:B2', 'liberato', 'image/jpeg', 99999) AS b2 \gset
SELECT pg_temp.media('bw:393330009202:B3', 'pronta', 'image/jpeg', 777) AS b3 \gset
SELECT pg_temp.media('bw:393330009203:C1', 'pronta', 'application/pdf', 1) AS c1 \gset
SELECT pg_temp.media('bw:393330009201:Z1', 'pronta', 'image/jpeg', 1, :'U2'::uuid) AS z1 \gset
SELECT pg_temp.oggetto('ponte-media', :'a1', 1000, 'image/jpeg');
SELECT pg_temp.oggetto('ponte-media', :'a2', 2000, 'image/png');
SELECT pg_temp.oggetto('ponte-media', :'a3', 5000, 'video/mp4');
SELECT pg_temp.oggetto('ponte-media', :'b1', 500, 'audio/ogg');
SELECT pg_temp.oggetto('ponte-media', :'b2', 99999, 'image/jpeg');     -- un oggetto che la riga liberato non conta
SELECT pg_temp.oggetto('ponte-media', :'c1', 9000, 'application/pdf');
SELECT pg_temp.oggetto('ponte-media', :'z1', 123456, 'image/jpeg');
SELECT pg_temp.oggetto('landing-media', :'a1', 888888);                 -- altro bucket, stesso nome: non conta
UPDATE public.ponte_wa_media SET created_at = '2026-10-31 10:00:00+00' WHERE chiave IN ('bw:393330009201:A1', 'bw:393330009201:A2');
UPDATE public.ponte_wa_media SET created_at = '2026-10-31 11:00:00+00', nome = 'clip.mp4', durata_s = 12, larghezza = 640, altezza = 360, miniatura = '/9j/AAAA', scade_il = '2026-11-01 00:00:00+00' WHERE chiave = 'bw:393330009201:A3';
UPDATE public.ponte_wa_media SET created_at = '2026-10-31 09:00:00+00' WHERE chiave LIKE 'bw:393330009202:%';
UPDATE public.ponte_wa_media SET created_at = '2026-10-30 08:00:00+00', nome = 'listino.pdf', scade_il = '2026-12-01 00:00:00+00' WHERE chiave = 'bw:393330009203:C1';

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b1', true) \gset
SELECT public.ponte_wa_archivio_riassunto()::text AS riass \gset
SELECT coalesce(string_agg(numero || ':' || byte || ':' || foto || ':' || audio || ':' || video || ':' || documento || '@' || ultimo_il, ',' ORDER BY byte DESC), 'NESSUNA') AS chat FROM public.ponte_wa_archivio_chat() \gset
SELECT coalesce(string_agg(chiave, ',' ORDER BY ord), 'NESSUNA') AS n1_tutti FROM (SELECT chiave, row_number() OVER () AS ord FROM public.ponte_wa_archivio_media('393330009201', 50, NULL, NULL)) q \gset
SELECT coalesce(string_agg(chiave || '|' || categoria || '|' || coalesce(nome, '-') || '|' || byte || '|' || coalesce(durata_s::text, '-') || '|' || coalesce(miniatura, '-') || '|' || coalesce(scade_il::text, '-') || '|' || creato_il, ';'), 'NESSUNA') AS n1_primo
  FROM (SELECT * FROM public.ponte_wa_archivio_media('393330009201', 1, NULL, NULL)) q \gset
SELECT coalesce(string_agg(chiave, ','), 'NESSUNA') AS n1_pag1 FROM public.ponte_wa_archivio_media('393330009201', 2, NULL, NULL) \gset
SELECT coalesce(string_agg(chiave, ','), 'NESSUNA') AS n1_pag2 FROM public.ponte_wa_archivio_media('393330009201', 2, '2026-10-31 10:00:00+00', 'bw:393330009201:A2') \gset
SELECT coalesce(string_agg(chiave, ','), 'NESSUNA') AS n2_lista FROM public.ponte_wa_archivio_media('393330009202', 50, NULL, NULL) \gset
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b2', true) \gset
SELECT public.ponte_wa_archivio_riassunto()::text AS riass2 \gset
SELECT coalesce(string_agg(numero || ':' || byte, ','), 'NESSUNA') AS chat2 FROM public.ponte_wa_archivio_chat() \gset
SELECT coalesce(string_agg(chiave || ':' || byte, ','), 'NESSUNA') AS n1_di_u2 FROM public.ponte_wa_archivio_media('393330009201', 50, NULL, NULL) \gset
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b3', true) \gset
SELECT public.ponte_wa_archivio_riassunto()::text AS riass3 \gset
SELECT coalesce(string_agg(numero, ','), 'NESSUNA') AS chat3 FROM public.ponte_wa_archivio_chat() \gset
SELECT coalesce(string_agg(chiave, ','), 'NESSUNA') AS n1_di_u3 FROM public.ponte_wa_archivio_media('393330009201', 50, NULL, NULL) \gset
SELECT set_config('request.jwt.claim.sub', '', true) \gset
SELECT public.ponte_wa_archivio_riassunto()::text AS riass_anon \gset
SELECT coalesce(string_agg(numero, ','), 'NESSUNA') AS chat_anon FROM public.ponte_wa_archivio_chat() \gset
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b1', true) \gset
DO $d$
DECLARE n text;
BEGIN
  FOREACH n IN ARRAY ARRAY['abc', '123', '1234567890123456', '3933300092; drop', ''] LOOP
    BEGIN
      PERFORM * FROM public.ponte_wa_archivio_media(n, 10, NULL, NULL);
      RAISE EXCEPTION 'KO numero non valido accettato: %', n;
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
  END LOOP;
  BEGIN
    PERFORM * FROM public.ponte_wa_archivio_media(NULL, 10, NULL, NULL);
    RAISE EXCEPTION 'KO numero nullo accettato';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END $d$;
RESET ROLE;

SELECT pg_temp.json_uguale('archivio · riassunto: pesi da storage.objects (non dalla riga), liberati e senza oggetto fuori dal peso, un timer, per tipo',
  '{"byte_totali":17500,"file":5,"senza_file":1,"con_timer":2,"liberati":1,"per_tipo":{"foto":{"n":2,"byte":3000},"audio":{"n":1,"byte":500},"video":{"n":1,"byte":5000},"documento":{"n":1,"byte":9000}}}'::jsonb, :'riass'::jsonb);
SELECT pg_temp.uguale('archivio · chat: per MB decrescenti, conteggi per tipo (foto:audio:video:documento), ultimo_il; la liberata e quella senza oggetto non contano',
  '393330009203:9000:0:0:0:1@2026-10-30 08:00:00+00,393330009201:8000:2:0:1:0@2026-10-31 11:00:00+00,393330009202:500:0:1:0:0@2026-10-31 09:00:00+00', :'chat');
SELECT pg_temp.uguale('archivio · media: più recenti prima, a parità di data per chiave decrescente', 'bw:393330009201:A3,bw:393330009201:A2,bw:393330009201:A1', :'n1_tutti');
SELECT pg_temp.uguale('archivio · media: i campi (peso di Storage, nome, durata, miniatura, timer, data)', 'bw:393330009201:A3|video|clip.mp4|5000|12|/9j/AAAA|2026-11-01 00:00:00+00|2026-10-31 11:00:00+00', :'n1_primo');
SELECT pg_temp.uguale('archivio · keyset: due pagine da 2 senza buchi né doppioni', 'bw:393330009201:A3,bw:393330009201:A2 + bw:393330009201:A1',
  :'n1_pag1' || ' + ' || :'n1_pag2');
SELECT pg_temp.uguale('archivio · media di N2: solo la pronta con oggetto (non la liberata, non quella senza file)', 'bw:393330009202:B1', :'n2_lista');
SELECT pg_temp.json_uguale('archivio · l''altro utente vede solo il suo (riassunto)',
  '{"byte_totali":123456,"file":1,"senza_file":0,"con_timer":0,"liberati":0,"per_tipo":{"foto":{"n":1,"byte":123456},"audio":{"n":0,"byte":0},"video":{"n":0,"byte":0},"documento":{"n":0,"byte":0}}}'::jsonb, :'riass2'::jsonb);
SELECT pg_temp.uguale('archivio · …le sue chat e i suoi media (stesso numero N1, solo la sua foto)', '393330009201:123456|bw:393330009201:Z1:123456', :'chat2' || '|' || :'n1_di_u2');
SELECT pg_temp.json_uguale('archivio · un utente senza media non vede niente: riassunto a zero',
  '{"byte_totali":0,"file":0,"senza_file":0,"con_timer":0,"liberati":0,"per_tipo":{"foto":{"n":0,"byte":0},"audio":{"n":0,"byte":0},"video":{"n":0,"byte":0},"documento":{"n":0,"byte":0}}}'::jsonb, :'riass3'::jsonb);
SELECT pg_temp.uguale('archivio · …nessuna chat e nessun media (anche chiedendo il numero di un altro)', 'NESSUNA|NESSUNA', :'chat3' || '|' || :'n1_di_u3');
SELECT pg_temp.json_uguale('archivio · senza utente (auth.uid() nullo) → a zero', :'riass3'::jsonb, :'riass_anon'::jsonb);
SELECT pg_temp.uguale('archivio · …e nessuna chat', 'NESSUNA', :'chat_anon');
\echo 'ok  archivio · p_numero non valido (lettere, corto, lungo, SQL, vuoto, NULL) → 22023'

-- p_limite: massimo 100, NULL → 50
INSERT INTO public.ponte_wa_media (user_id, chiave, numero, path, mime, byte, stato)
SELECT :'U'::uuid, 'bw:393330009204:L' || lpad(i::text, 3, '0'), '393330009204', :'U' || '/' || md5('l' || i)::uuid || '.jpg', 'image/jpeg', 1, 'pronta' FROM generate_series(1, 130) i;
INSERT INTO storage.objects (bucket_id, name, metadata)
SELECT 'ponte-media', path, '{"size":10,"mimetype":"image/jpeg"}'::jsonb FROM public.ponte_wa_media WHERE numero = '393330009204';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b1', true) \gset
SELECT count(*) AS lim_1000 FROM public.ponte_wa_archivio_media('393330009204', 1000, NULL, NULL) \gset
SELECT count(*) AS lim_nullo FROM public.ponte_wa_archivio_media('393330009204', NULL, NULL, NULL) \gset
SELECT count(*) AS lim_zero FROM public.ponte_wa_archivio_media('393330009204', 0, NULL, NULL) \gset
SELECT count(*) AS lim_dieci FROM public.ponte_wa_archivio_media('393330009204', 10, NULL, NULL) \gset
RESET ROLE;
SELECT pg_temp.uguale('archivio · p_limite 1000 → al più 100; NULL → 50; 0 → 1; 10 → 10', '100|50|1|10', concat_ws('|', :lim_1000, :lim_nullo, :lim_zero, :lim_dieci));
DELETE FROM public.ponte_wa_media WHERE numero = '393330009204';
DELETE FROM storage.objects WHERE name LIKE '%' AND metadata->>'size' = '10';

-- ── Permessi ─────────────────────────────────────────────────────────────────
SELECT pg_temp.uguale('funzioni del Worker (13): anon e authenticated senza EXECUTE, service_role con EXECUTE', '13|0|0|13',
  (SELECT concat_ws('|', count(*)::text,
      count(*) FILTER (WHERE has_function_privilege('anon', p.oid, 'EXECUTE'))::text || '',
      count(*) FILTER (WHERE has_function_privilege('authenticated', p.oid, 'EXECUTE'))::text || '',
      count(*) FILTER (WHERE has_function_privilege('service_role', p.oid, 'EXECUTE'))::text)
     FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN
    ('ponte_wa_media_permesso', 'ponte_wa_media_fatto', 'ponte_wa_media_dettagli', 'ponte_wa_media_richiedi', 'ponte_wa_media_prendi',
     'ponte_wa_media_richiesta_esito', 'ponte_wa_media_pulizia', 'ponte_wa_media_timer', 'ponte_wa_media_scadute', 'ponte_wa_media_da_liberare',
     'ponte_wa_media_liberato', 'ponte_wa_media_orfani', 'ponte_wa_media_ancora_scadute')));
SELECT pg_temp.uguale('funzioni del Worker: tutte SECURITY DEFINER con lo stesso search_path fisso', 'true|1|{"search_path=public, pg_temp"}',
  (SELECT concat_ws('|', bool_and(p.prosecdef)::text, count(DISTINCT p.proconfig::text)::text, min(p.proconfig::text))
     FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname LIKE 'ponte\_wa\_media\_%' AND p.proname NOT IN ('ponte_wa_media_categoria', 'ponte_wa_media_limite', 'ponte_wa_media_estensione')));
SELECT pg_temp.uguale('le tre funzioni del pannello: authenticated con EXECUTE, anon senza; SECURITY DEFINER, STABLE, search_path fisso', 'true|false|true|s|{"search_path=public, pg_temp"}|3',
  (SELECT concat_ws('|',
     bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE'))::text,
     bool_or(has_function_privilege('anon', p.oid, 'EXECUTE'))::text,
     bool_and(p.prosecdef)::text, min(p.provolatile::text), min(p.proconfig::text), count(*)::text)
     FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname IN ('ponte_wa_archivio_riassunto', 'ponte_wa_archivio_chat', 'ponte_wa_archivio_media')));
SELECT pg_temp.uguale('authenticated ha EXECUTE SOLO sulle tre del pannello (fra tutte le ponte_wa_media_* e ponte_wa_archivio_*, escluse le due tabelle dei tipi, pure)', 'ponte_wa_archivio_chat,ponte_wa_archivio_media,ponte_wa_archivio_riassunto',
  (SELECT string_agg(DISTINCT p.proname, ',' ORDER BY p.proname) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
      AND (p.proname LIKE 'ponte\_wa\_media\_%' OR p.proname LIKE 'ponte\_wa\_archivio\_%')
      AND p.proname NOT IN ('ponte_wa_media_categoria', 'ponte_wa_media_limite', 'ponte_wa_media_estensione')
      AND has_function_privilege('authenticated', p.oid, 'EXECUTE')));
SELECT pg_temp.uguale('tabella richieste: RLS accesa, UNA policy di lettura per authenticated sulle sue righe', 'true|users read own ponte media richieste|SELECT|{authenticated}|(auth.uid() = user_id)',
  (SELECT concat_ws('|', (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.ponte_wa_media_richieste'::regclass),
                    string_agg(policyname || '|' || cmd || '|' || roles::text || '|' || qual, ',')) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ponte_wa_media_richieste'));
SELECT pg_temp.uguale('tabella richieste: authenticated solo SELECT; anon niente; service_role scrive', 'true|false|false|false|false|false|false|false|true',
  concat_ws('|',
    has_table_privilege('authenticated', 'public.ponte_wa_media_richieste', 'SELECT')::text,
    has_table_privilege('authenticated', 'public.ponte_wa_media_richieste', 'INSERT')::text,
    has_table_privilege('authenticated', 'public.ponte_wa_media_richieste', 'UPDATE')::text,
    has_table_privilege('authenticated', 'public.ponte_wa_media_richieste', 'DELETE')::text,
    has_table_privilege('anon', 'public.ponte_wa_media_richieste', 'SELECT')::text,
    has_table_privilege('anon', 'public.ponte_wa_media_richieste', 'INSERT')::text,
    has_table_privilege('anon', 'public.ponte_wa_media_richieste', 'UPDATE')::text,
    has_table_privilege('anon', 'public.ponte_wa_media_richieste', 'DELETE')::text,
    has_table_privilege('service_role', 'public.ponte_wa_media_richieste', 'INSERT')::text));
SELECT pg_temp.uguale('tabella media: authenticated ancora solo SELECT (dopo A e B)', 'true|false|false|false|false',
  concat_ws('|',
    has_table_privilege('authenticated', 'public.ponte_wa_media', 'SELECT')::text,
    has_table_privilege('authenticated', 'public.ponte_wa_media', 'INSERT')::text,
    has_table_privilege('authenticated', 'public.ponte_wa_media', 'UPDATE')::text,
    has_table_privilege('authenticated', 'public.ponte_wa_media', 'DELETE')::text,
    has_table_privilege('anon', 'public.ponte_wa_media', 'SELECT')::text));
-- richieste: ognuno vede le sue; authenticated non scrive; non chiama le funzioni del Worker
SELECT public.ponte_wa_media_richiedi(:'U'::uuid, 'bw:393330009301:M1', NULL);
SELECT public.ponte_wa_media_richiedi(:'U2'::uuid, 'bw:393330009302:N1', NULL);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b1', true) \gset
SELECT count(*) AS r_suo FROM public.ponte_wa_media_richieste \gset
SELECT count(*) AS r_altrui FROM public.ponte_wa_media_richieste WHERE user_id = '00000000-0000-4000-8000-0000000000b2' \gset
DO $d$
BEGIN
  BEGIN
    INSERT INTO public.ponte_wa_media_richieste (user_id, chiave, numero) VALUES ('00000000-0000-4000-8000-0000000000b1', 'bw:393330009301:X9', '393330009301');
    RAISE EXCEPTION 'KO authenticated scrive in ponte_wa_media_richieste';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.ponte_wa_media_richieste SET stato = 'in_corso';
    RAISE EXCEPTION 'KO authenticated aggiorna ponte_wa_media_richieste';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.ponte_wa_media_richieste;
    RAISE EXCEPTION 'KO authenticated cancella da ponte_wa_media_richieste';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.ponte_wa_media SET stato = 'liberato';
    RAISE EXCEPTION 'KO authenticated aggiorna ponte_wa_media';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.ponte_wa_media_timer('00000000-0000-4000-8000-0000000000b1', 'bw:393330009801:TM1', 300);
    RAISE EXCEPTION 'KO authenticated chiama ponte_wa_media_timer';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM * FROM public.ponte_wa_media_da_liberare('00000000-0000-4000-8000-0000000000b1', NULL, NULL, 500);
    RAISE EXCEPTION 'KO authenticated chiama ponte_wa_media_da_liberare';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.ponte_wa_media_richiedi('00000000-0000-4000-8000-0000000000b2', 'bw:393330009302:N1', NULL);
    RAISE EXCEPTION 'KO authenticated chiama ponte_wa_media_richiedi';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $d$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $d$
BEGIN
  BEGIN
    PERFORM public.ponte_wa_archivio_riassunto();
    RAISE EXCEPTION 'KO anon chiama ponte_wa_archivio_riassunto';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM * FROM public.ponte_wa_archivio_chat();
    RAISE EXCEPTION 'KO anon chiama ponte_wa_archivio_chat';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $d$;
RESET ROLE;
SELECT pg_temp.uguale('richieste: ognuno vede le sue (1 e 0)', '1|0', :'r_suo' || '|' || :'r_altrui');
SELECT pg_temp.uguale('storage.objects: nessuna policy in più, nessuna che nomini ponte-media', :'policy_prima' || '|0',
  (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects') || '|' ||
  (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND (coalesce(qual, '') || coalesce(with_check, '') || policyname) ~ 'ponte-media'));
DELETE FROM public.ponte_wa_media_richieste;
DELETE FROM public.ponte_wa_media;
DELETE FROM storage.objects;

-- ── Prestazioni: 20.000 righe e 20.000 oggetti ──────────────────────────────
-- Il finto Storage di pg-prova.sh non ha l'indice unico (bucket_id, name) del vero: si crea qui (nella transazione).
CREATE UNIQUE INDEX hgl_prova_objects_bucket_name ON storage.objects (bucket_id, name);
INSERT INTO public.ponte_wa_media (user_id, chiave, numero, path, mime, byte, stato, categoria, scade_il)
SELECT :'U'::uuid, 'bw:39334' || lpad((i % 400)::text, 5, '0') || ':P' || i, '39334' || lpad((i % 400)::text, 5, '0'),
       :'U' || '/' || md5(i::text)::uuid || '.' || (ARRAY['jpg', 'ogg', 'mp4', 'pdf'])[1 + i % 4],
       (ARRAY['image/jpeg', 'audio/ogg', 'video/mp4', 'application/pdf'])[1 + i % 4], 1000 + i % 5000, 'pronta',
       (ARRAY['foto', 'audio', 'video', 'documento'])[1 + i % 4],
       CASE WHEN i % 10 = 0 THEN now() - interval '1 minute' END
  FROM generate_series(1, 20000) i;
INSERT INTO storage.objects (bucket_id, name, metadata)
SELECT 'ponte-media', path, jsonb_build_object('size', byte, 'mimetype', mime) FROM public.ponte_wa_media;
ANALYZE public.ponte_wa_media;
ANALYZE storage.objects;
CREATE TEMP TABLE tempi (nome text, ms numeric);
DO $d$
DECLARE
  t0 timestamptz;
  v jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b1', true);
  t0 := clock_timestamp(); PERFORM public.ponte_wa_archivio_riassunto();
  INSERT INTO tempi VALUES ('riassunto', extract(epoch FROM clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); PERFORM count(*) FROM public.ponte_wa_archivio_chat();
  INSERT INTO tempi VALUES ('elenco chat', extract(epoch FROM clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); PERFORM count(*) FROM public.ponte_wa_archivio_media('3933400001', 50, NULL, NULL);
  INSERT INTO tempi VALUES ('pagina media', extract(epoch FROM clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); PERFORM public.ponte_wa_media_permesso('00000000-0000-4000-8000-0000000000b1', 'bw:393339999999:NUOVA', '393339999999', 'image/jpeg', 100000, 100000000000);
  INSERT INTO tempi VALUES ('permesso', extract(epoch FROM clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); PERFORM count(*) FROM public.ponte_wa_media_scadute(200);
  INSERT INTO tempi VALUES ('scadute', extract(epoch FROM clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); PERFORM count(*) FROM public.ponte_wa_media_da_liberare('00000000-0000-4000-8000-0000000000b1', NULL, NULL, 500);
  INSERT INTO tempi VALUES ('da liberare (tutto)', extract(epoch FROM clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); PERFORM public.ponte_wa_media_orfani(100);
  INSERT INTO tempi VALUES ('orfani', extract(epoch FROM clock_timestamp() - t0) * 1000);
  t0 := clock_timestamp(); PERFORM public.ponte_wa_media_pulizia();
  INSERT INTO tempi VALUES ('pulizia', extract(epoch FROM clock_timestamp() - t0) * 1000);
END $d$;
SELECT pg_temp.uguale('prestazioni (20.000 righe e oggetti): riassunto, elenco chat, pagina media e permesso sotto 500 ms', 'true|true|true|true',
  (SELECT string_agg((ms < 500)::text, '|' ORDER BY ord) FROM (SELECT ms, CASE nome WHEN 'riassunto' THEN 1 WHEN 'elenco chat' THEN 2 WHEN 'pagina media' THEN 3 WHEN 'permesso' THEN 4 END AS ord FROM tempi WHERE nome IN ('riassunto', 'elenco chat', 'pagina media', 'permesso')) q));
SELECT pg_temp.uguale('prestazioni: anche scadute, da liberare, orfani e pulizia sotto 500 ms', 'true|true|true|true',
  (SELECT string_agg((ms < 500)::text, '|' ORDER BY ord) FROM (SELECT ms, CASE nome WHEN 'scadute' THEN 1 WHEN 'da liberare (tutto)' THEN 2 WHEN 'orfani' THEN 3 WHEN 'pulizia' THEN 4 END AS ord FROM tempi WHERE nome IN ('scadute', 'da liberare (tutto)', 'orfani', 'pulizia')) q));
SELECT string_agg('       ' || nome || ': ' || round(ms)::text || ' ms', E'\n' ORDER BY ms DESC) AS misure FROM tempi \gset
\echo 'misure (ms):'
\echo :misure
DO $d$
DECLARE
  r record;
  piano text := '';
BEGIN
  FOR r IN EXECUTE 'EXPLAIN SELECT path FROM public.ponte_wa_media WHERE user_id = ''00000000-0000-4000-8000-0000000000b1'' AND path = ''00000000-0000-4000-8000-0000000000b1/' || md5('777')::uuid || '.ogg'' AND stato = ''pronta''' LOOP
    piano := piano || ' ' || r."QUERY PLAN";
  END LOOP;
  IF piano !~ 'idx_ponte_media_path' THEN RAISE EXCEPTION 'KO percorsoPronto non usa idx_ponte_media_path: %', piano; END IF;
END $d$;
\echo 'ok  EXPLAIN di percorsoPronto (user_id, path, stato) usa idx_ponte_media_path'
DO $d$
DECLARE
  r record;
  piano text := '';
BEGIN
  FOR r IN EXECUTE 'EXPLAIN SELECT chiave FROM public.ponte_wa_media WHERE stato = ''pronta'' AND scade_il IS NOT NULL AND scade_il <= now()' LOOP
    piano := piano || ' ' || r."QUERY PLAN";
  END LOOP;
  -- con il 10% delle righe scadute il planner può preferire la scansione: ci interessa che l'indice parziale ESISTA e sia usabile
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_ponte_media_scadenza' AND indexdef ~ 'WHERE') THEN
    RAISE EXCEPTION 'KO manca l''indice parziale su scade_il';
  END IF;
END $d$;
SELECT pg_temp.uguale('indici nuovi: solo (user_id, path) e il parziale su scade_il (più quelli di prima)', 'idx_ponte_media_numero,idx_ponte_media_path,idx_ponte_media_scadenza,ponte_wa_media_pkey,ponte_wa_media_richieste_pkey',
  (SELECT string_agg(indexname, ',' ORDER BY indexname) FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('ponte_wa_media', 'ponte_wa_media_richieste')));
DELETE FROM public.ponte_wa_media;
DELETE FROM storage.objects;
DROP INDEX storage.hgl_prova_objects_bucket_name;

-- ── Le chat non si toccano ───────────────────────────────────────────────────
SELECT pg_temp.uguale('nessuna scrittura su whatsapp_messages né su whatsapp_contacts (contenuto identico a prima di provare le funzioni)', :'chat_prima',
  md5(coalesce((SELECT string_agg(m::text, '|' ORDER BY m.id) FROM public.whatsapp_messages m), '') ||
      coalesce((SELECT string_agg(k::text, '|' ORDER BY k.id) FROM public.whatsapp_contacts k), '')));

\echo 'TUTTI I CONTROLLI DI MEDIA E ARCHIVIAZIONE PASSANO (ora ROLLBACK: nel database non resta niente)'
ROLLBACK;
