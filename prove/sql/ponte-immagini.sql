-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DELLE IMMAGINI DEL PONTE SU UN POSTGRES VERO (T4, commessa
-- 2026-10-30-ponte-storico-completo, PIANO (d) e (f.2))
--
-- NON entra in `npm test` e NON si lancia sul database di produzione: serve un
-- database di prova con TUTTE le migrazioni applicate in ordine (la nuova è
-- applicata qui altre due volte) e con lo schema `storage` (buckets e objects:
-- `supabase start` lo ha; lo script `pg-prova.sh` della commessa
-- 2026-10-30-ottimizzazioni lo imita). Istruzioni: prove/sql/LEGGIMI.md.
--
--   bash <pg-prova.sh> <cartella-del-repo> prove/sql/ponte-immagini.sql
--   psql "$DB" -f prove/sql/ponte-immagini.sql        (dalla radice del repo)
--
-- Tutto gira dentro UNA transazione che finisce con ROLLBACK: la migrazione
-- (riapplicata due volte) e i dati di prova spariscono alla fine. Al primo
-- controllo sbagliato si ferma con «KO <nome>: atteso …, avuto …».
-- Dentro la transazione now() è fermo: gli orari si spostano riscrivendo le
-- colonne delle righe di prova (created_at), mai l'orologio.
--
-- Dati inventati: utenti, numeri, chiavi e pesi non esistono. Nessun file vero:
-- gli «oggetti» di Storage sono righe finte in storage.objects.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
\set migrazione 'supabase/migrations/20261030170000_ponte_immagini.sql'
\set U  '00000000-0000-4000-8000-0000000000e1'
\set U2 '00000000-0000-4000-8000-0000000000e2'

BEGIN;

CREATE FUNCTION pg_temp.uguale(nome text, atteso text, avuto text) RETURNS text
LANGUAGE plpgsql AS $f$
BEGIN
  IF atteso IS DISTINCT FROM avuto THEN
    RAISE EXCEPTION 'KO %: atteso «%», avuto «%»', nome, atteso, avuto;
  END IF;
  RETURN 'ok  ' || nome;
END $f$;

-- Il mondo prima: quante policy ha storage.objects e quante righe ha il Mac in whatsapp_*.
SELECT count(*) AS policy_prima FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' \gset
SELECT (SELECT count(*) FROM public.whatsapp_messages) AS msg_prima, (SELECT count(*) FROM public.whatsapp_contacts) AS con_prima \gset

-- ── La migrazione, altre due volte di seguito (pg-prova.sh l'ha già applicata una) ──
\i :migrazione
\i :migrazione
\echo 'ok  migrazione applicata due volte senza errori'

-- ── Il bucket ────────────────────────────────────────────────────────────────
SELECT pg_temp.uguale('bucket: ponte-media privato, 8 MiB, solo jpeg/png/webp', 'false|8388608|{image/jpeg,image/png,image/webp}',
  (SELECT concat_ws('|', public::text, file_size_limit::text, allowed_mime_types::text) FROM storage.buckets WHERE id = 'ponte-media'));
SELECT pg_temp.uguale('bucket: uno solo, mai applicato due volte', '1', (SELECT count(*)::text FROM storage.buckets WHERE id = 'ponte-media'));
SELECT pg_temp.uguale('bucket: né SVG né HTML tra i tipi ammessi', 'false',
  (SELECT (allowed_mime_types && ARRAY['image/svg+xml', 'text/html', 'image/gif'])::text FROM storage.buckets WHERE id = 'ponte-media'));
SELECT pg_temp.uguale('storage.objects: la migrazione non ha aggiunto policy', :'policy_prima',
  (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'));
SELECT pg_temp.uguale('storage.objects: nessuna policy nomina ponte-media', '0',
  (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (coalesce(qual, '') || coalesce(with_check, '') || policyname) ~ 'ponte-media'));
SELECT pg_temp.uguale('storage.objects: nessuna policy senza il vincolo sul bucket (altrimenti vedrebbe anche le foto)', '0',
  (SELECT count(*)::text FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (coalesce(qual, '') || coalesce(with_check, '')) !~ 'bucket_id'));

-- ── Il seme dell'interruttore ────────────────────────────────────────────────
SELECT pg_temp.uguale('seme: app_config ponte_immagini spento di serie, 0,8 GB, in TESTO', '{"acceso":false,"tettoGB":0.8}|text',
  (SELECT value || '|' || pg_typeof(value)::text FROM public.app_config WHERE key = 'ponte_immagini'));
UPDATE public.app_config SET value = '{"acceso":true,"tettoGB":0.8}' WHERE key = 'ponte_immagini';
\i :migrazione
SELECT pg_temp.uguale('seme: riapplicata, non riscrive la scelta del titolare (ON CONFLICT DO NOTHING)', '{"acceso":true,"tettoGB":0.8}',
  (SELECT value FROM public.app_config WHERE key = 'ponte_immagini'));
UPDATE public.app_config SET value = '{"acceso":false,"tettoGB":0.8}' WHERE key = 'ponte_immagini';

-- ── Aiuti ────────────────────────────────────────────────────────────────────
-- I parametri: l'utente U, il numero e la chiave; tetto di default 1.000.000 di byte.
CREATE FUNCTION pg_temp.permesso(p_chiave text, p_numero text, p_mime text, p_byte bigint, p_tetto bigint DEFAULT 1000000, p_user uuid DEFAULT '00000000-0000-4000-8000-0000000000e1')
RETURNS jsonb LANGUAGE sql AS $f$
  SELECT public.ponte_wa_media_permesso(p_user, p_chiave, p_numero, p_mime, p_byte, p_tetto) $f$;
CREATE FUNCTION pg_temp.fatto(p_chiave text, p_user uuid DEFAULT '00000000-0000-4000-8000-0000000000e1')
RETURNS jsonb LANGUAGE sql AS $f$ SELECT public.ponte_wa_media_fatto(p_user, p_chiave) $f$;
-- Un «oggetto» finto in Storage: bucket, percorso, peso.
CREATE FUNCTION pg_temp.oggetto(p_bucket text, p_path text, p_size bigint) RETURNS void LANGUAGE sql AS $f$
  INSERT INTO storage.objects (bucket_id, name, metadata) VALUES (p_bucket, p_path, jsonb_build_object('size', p_size, 'mimetype', 'image/jpeg')) $f$;
CREATE FUNCTION pg_temp.riga(p_chiave text) RETURNS text LANGUAGE sql AS $f$
  SELECT concat_ws('|', stato, byte::text, mime) FROM public.ponte_wa_media WHERE user_id = '00000000-0000-4000-8000-0000000000e1' AND chiave = p_chiave $f$;

INSERT INTO auth.users (id, email) VALUES
  (:'U'::uuid,  'prova-immagini-1@example.invalid'),
  (:'U2'::uuid, 'prova-immagini-2@example.invalid')
ON CONFLICT (id) DO NOTHING;

-- ── ponte_wa_media_permesso: i rifiuti ───────────────────────────────────────
SELECT pg_temp.uguale('permesso: SVG → rifiutato · tipo', 'rifiutato|tipo',
  (SELECT concat_ws('|', p->>'esito', p->>'motivo') FROM pg_temp.permesso('bw:393330000201:SVG1', '393330000201', 'image/svg+xml', 1000) p));
SELECT pg_temp.uguale('permesso: HTML e GIF → rifiutato · tipo', 'tipo|tipo',
  (pg_temp.permesso('bw:393330000201:HTML1', '393330000201', 'text/html', 1000)->>'motivo') || '|' || (pg_temp.permesso('bw:393330000201:GIF1', '393330000201', 'image/gif', 1000)->>'motivo'));
SELECT pg_temp.uguale('permesso: il tipo ha la maiuscola → rifiutato (confronto esatto)', 'tipo',
  pg_temp.permesso('bw:393330000201:MAI1', '393330000201', 'Image/JPEG', 1000)->>'motivo');
SELECT pg_temp.uguale('permesso: 8 MiB + 1 byte → rifiutato · troppo_grande', 'rifiutato|troppo_grande',
  (SELECT concat_ws('|', p->>'esito', p->>'motivo') FROM pg_temp.permesso('bw:393330000201:BIG1', '393330000201', 'image/jpeg', 8388609, 100000000) p));
SELECT pg_temp.uguale('permesso: 0 byte e peso negativo → rifiutato · troppo_grande', 'troppo_grande|troppo_grande',
  (pg_temp.permesso('bw:393330000201:ZERO1', '393330000201', 'image/jpeg', 0)->>'motivo') || '|' || (pg_temp.permesso('bw:393330000201:NEG1', '393330000201', 'image/jpeg', -5)->>'motivo'));
SELECT pg_temp.uguale('permesso: i rifiuti non lasciano righe', '0', (SELECT count(*)::text FROM public.ponte_wa_media));

-- ── …e i dati sbagliati dal chiamante: errore chiaro, nessuna riga ──────────
DO $d$
DECLARE c text;
BEGIN
  FOREACH c IN ARRAY ARRAY['senza-prefisso', 'bw:393330000201:', 'bw:abc:ID1', 'bw:393330000201:con spazio', 'bw:393330000202:ID1'] LOOP
    BEGIN
      PERFORM public.ponte_wa_media_permesso('00000000-0000-4000-8000-0000000000e1', c, '393330000201', 'image/jpeg', 1000, 1000000);
      RAISE EXCEPTION 'KO chiave non valida accettata: %', c;
    EXCEPTION WHEN invalid_parameter_value THEN NULL;
    END;
  END LOOP;
  BEGIN
    PERFORM public.ponte_wa_media_permesso('00000000-0000-4000-8000-0000000000e1', 'bw:393330000201:ID1', '12; drop', 'image/jpeg', 1000, 1000000);
    RAISE EXCEPTION 'KO numero non valido accettato';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  BEGIN
    PERFORM public.ponte_wa_media_permesso(NULL, 'bw:393330000201:ID1', '393330000201', 'image/jpeg', 1000, 1000000);
    RAISE EXCEPTION 'KO utente nullo accettato';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
END $d$;
\echo 'ok  permesso: chiave, numero e utente non validi → errore, mai una riga'
SELECT pg_temp.uguale('permesso: …e nessuna riga è nata', '0', (SELECT count(*)::text FROM public.ponte_wa_media));

-- ── ponte_wa_media_permesso: il via libera ───────────────────────────────────
SELECT pg_temp.permesso('bw:393330000201:FOTO1', '393330000201', 'image/jpeg', 200000) AS p1 \gset
SELECT pg_temp.uguale('permesso: foto buona → carica', 'carica', :'p1'::jsonb->>'esito');
SELECT pg_temp.uguale('permesso: il percorso sta sotto <user_id>/ ed è un nome casuale .jpg, senza cifre del numero né della chiave', 'true',
  ((:'p1'::jsonb->>'path') ~ ('^' || :'U' || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$')
    AND (:'p1'::jsonb->>'path') NOT LIKE '%393330000201%' AND (:'p1'::jsonb->>'path') NOT LIKE '%FOTO1%')::text);
SELECT pg_temp.uguale('permesso: nasce una riga in_caricamento col peso dichiarato e il tipo', 'in_caricamento|200000|image/jpeg', pg_temp.riga('bw:393330000201:FOTO1'));
SELECT pg_temp.uguale('permesso: la riga porta numero e percorso', '393330000201|true',
  (SELECT numero || '|' || (path = :'p1'::jsonb->>'path')::text FROM public.ponte_wa_media WHERE chiave = 'bw:393330000201:FOTO1'));
SELECT pg_temp.permesso('bw:393330000201:FOTO1', '393330000201', 'image/jpeg', 200000) AS p1b \gset
SELECT pg_temp.uguale('permesso: la stessa chiave due volte → stesso percorso, una sola riga', 'carica|true|1',
  concat_ws('|', :'p1b'::jsonb->>'esito', ((:'p1b'::jsonb->>'path') = (:'p1'::jsonb->>'path'))::text, (SELECT count(*)::text FROM public.ponte_wa_media WHERE chiave = 'bw:393330000201:FOTO1')));
SELECT pg_temp.uguale('permesso: png → .png, webp → .webp', 'true|true',
  ((pg_temp.permesso('bw:393330000201:FOTO2', '393330000201', 'image/png', 1000)->>'path') LIKE '%.png')::text || '|' ||
  ((pg_temp.permesso('bw:393330000201:FOTO3', '393330000201', 'image/webp', 1000)->>'path') LIKE '%.webp')::text);
SELECT pg_temp.uguale('permesso: esattamente 8 MiB è ammesso', 'carica',
  pg_temp.permesso('bw:393330000201:FOTO4', '393330000201', 'image/jpeg', 8388608, 100000000)->>'esito');
DELETE FROM public.ponte_wa_media WHERE chiave IN ('bw:393330000201:FOTO2', 'bw:393330000201:FOTO3', 'bw:393330000201:FOTO4');
SELECT pg_temp.permesso('bw:393330000201:FOTO1', '393330000201', 'image/jpeg', 200000, 1000000, :'U2'::uuid) AS p2 \gset
SELECT pg_temp.uguale('permesso: un altro utente con la stessa chiave ha la sua riga e il suo percorso', 'carica|true|2',
  concat_ws('|', :'p2'::jsonb->>'esito', ((:'p2'::jsonb->>'path') LIKE :'U2' || '/%')::text, (SELECT count(*)::text FROM public.ponte_wa_media WHERE chiave = 'bw:393330000201:FOTO1')));
DELETE FROM public.ponte_wa_media WHERE user_id = :'U2'::uuid;

-- ── Già presente ─────────────────────────────────────────────────────────────
UPDATE public.ponte_wa_media SET stato = 'pronta' WHERE chiave = 'bw:393330000201:FOTO1';
SELECT pg_temp.uguale('permesso: foto già pronta → gia_presente, senza percorso', 'gia_presente|false',
  (SELECT concat_ws('|', p->>'esito', (p ? 'path')::text) FROM pg_temp.permesso('bw:393330000201:FOTO1', '393330000201', 'image/jpeg', 200000) p));
SELECT pg_temp.uguale('permesso: …anche con il tetto a zero (una foto che c''è non pesa di nuovo)', 'gia_presente',
  pg_temp.permesso('bw:393330000201:FOTO1', '393330000201', 'image/jpeg', 200000, 0)->>'esito');
DELETE FROM public.ponte_wa_media;

-- ── Il tetto: solo ponte-media, pesi da storage.objects ──────────────────────
SELECT pg_temp.oggetto('ponte-media', 'x/uno.jpg', 600000);
SELECT pg_temp.oggetto('landing-media', 'x/altro-bucket.jpg', 900000000);   -- un altro bucket non pesa
SELECT pg_temp.uguale('tetto: 600.000 usati + 500.000 > 1.000.000 → rifiutato · tetto', 'rifiutato|tetto',
  (SELECT concat_ws('|', p->>'esito', p->>'motivo') FROM pg_temp.permesso('bw:393330000201:T1', '393330000201', 'image/jpeg', 500000) p));
SELECT pg_temp.uguale('tetto: …e non lascia la riga', '0', (SELECT count(*)::text FROM public.ponte_wa_media));
SELECT pg_temp.uguale('tetto: 600.000 + 400.000 = il tetto → carica (il tetto è inclusivo)', 'carica',
  pg_temp.permesso('bw:393330000201:T2', '393330000201', 'image/jpeg', 400000)->>'esito');
SELECT pg_temp.uguale('tetto: la riga in_caricamento (400.000, senza oggetto) pesa: un ulteriore byte → tetto', 'tetto',
  pg_temp.permesso('bw:393330000201:T3', '393330000201', 'image/jpeg', 1)->>'motivo');
UPDATE public.ponte_wa_media SET created_at = now() - interval '3 hours' WHERE chiave = 'bw:393330000201:T2';
SELECT pg_temp.uguale('tetto: la riga in_caricamento di 3 ore non conta più', 'carica',
  pg_temp.permesso('bw:393330000201:T3', '393330000201', 'image/jpeg', 400000)->>'esito');
UPDATE public.ponte_wa_media SET created_at = now() - interval '1 hour 59 minutes' WHERE chiave = 'bw:393330000201:T2';
SELECT pg_temp.uguale('tetto: …quella di 1 ora e 59 minuti sì (insieme a T3: 600.000 + 400.000 + 400.000)', 'tetto',
  pg_temp.permesso('bw:393330000201:T4', '393330000201', 'image/jpeg', 1)->>'motivo');
SELECT pg_temp.uguale('tetto: tetto nullo → rifiutato (sicuro in caso di dimenticanza)', 'tetto',
  pg_temp.permesso('bw:393330000201:T5', '393330000201', 'image/jpeg', 1, NULL)->>'motivo');
SELECT pg_temp.uguale('tetto: tetto zero → rifiutato', 'tetto',
  pg_temp.permesso('bw:393330000201:T5', '393330000201', 'image/jpeg', 1, 0)->>'motivo');
-- Il peso vero dell'oggetto, non il dichiarato: una riga con l'oggetto già in Storage pesa size, una volta sola.
DELETE FROM public.ponte_wa_media;
DELETE FROM storage.objects;
SELECT pg_temp.permesso('bw:393330000201:V1', '393330000201', 'image/jpeg', 1) AS pv \gset
SELECT pg_temp.oggetto('ponte-media', :'pv'::jsonb->>'path', 900000);
SELECT pg_temp.uguale('tetto: dichiarato 1 byte ma in Storage ne pesa 900.000 → pesa 900.000, non uno', 'tetto',
  pg_temp.permesso('bw:393330000201:V2', '393330000201', 'image/jpeg', 100001)->>'motivo');
SELECT pg_temp.uguale('tetto: …900.000 + 100.000 ci sta', 'carica',
  pg_temp.permesso('bw:393330000201:V2', '393330000201', 'image/jpeg', 100000)->>'esito');
DELETE FROM public.ponte_wa_media;
DELETE FROM storage.objects;

-- ── Ripresa: l'oggetto è già in Storage ma il Mac non ha detto «fatto» ───────
SELECT pg_temp.permesso('bw:393330000201:R1', '393330000201', 'image/png', 1) AS pr \gset
SELECT pg_temp.oggetto('ponte-media', :'pr'::jsonb->>'path', 54321);
SELECT pg_temp.uguale('ripresa: il Mac ripropone la foto già caricata → gia_presente (niente secondo PUT che fallirebbe)', 'gia_presente',
  pg_temp.permesso('bw:393330000201:R1', '393330000201', 'image/png', 1)->>'esito');
SELECT pg_temp.uguale('ripresa: …e la riga è pronta col peso vero', 'pronta|54321|image/png', pg_temp.riga('bw:393330000201:R1'));
DELETE FROM public.ponte_wa_media;
DELETE FROM storage.objects;

-- ── ponte_wa_media_fatto ─────────────────────────────────────────────────────
SELECT pg_temp.uguale('fatto: chiave sconosciuta → ok=false, assente, nessun errore', 'false|assente',
  (SELECT concat_ws('|', f->>'ok', f->>'stato') FROM pg_temp.fatto('bw:393330000201:NONC') f));
SELECT pg_temp.permesso('bw:393330000201:F1', '393330000201', 'image/jpeg', 1) AS pf \gset
SELECT pg_temp.uguale('fatto: senza oggetto in Storage → resta in_caricamento', 'true|in_caricamento|in_caricamento|1',
  (SELECT concat_ws('|', f->>'ok', f->>'stato', (SELECT stato FROM public.ponte_wa_media WHERE chiave = 'bw:393330000201:F1'), (SELECT byte::text FROM public.ponte_wa_media WHERE chiave = 'bw:393330000201:F1'))
     FROM pg_temp.fatto('bw:393330000201:F1') f));
SELECT pg_temp.oggetto('ponte-media', :'pf'::jsonb->>'path', 7777777);
SELECT pg_temp.fatto('bw:393330000201:F1') AS rf \gset
SELECT pg_temp.uguale('fatto: con l''oggetto → pronta, e il peso è metadata.size (7.777.777), non il byte dichiarato (1)', 'true|pronta|7777777|pronta|7777777',
  concat_ws('|', :'rf'::jsonb->>'ok', :'rf'::jsonb->>'stato', :'rf'::jsonb->>'byte', (SELECT stato FROM public.ponte_wa_media WHERE chiave = 'bw:393330000201:F1'), (SELECT byte::text FROM public.ponte_wa_media WHERE chiave = 'bw:393330000201:F1')));
SELECT pg_temp.uguale('fatto: richiamata, non cambia niente (pronta resta pronta)', 'pronta|7777777',
  (SELECT concat_ws('|', f->>'stato', f->>'byte') FROM pg_temp.fatto('bw:393330000201:F1') f));
-- Un oggetto con lo stesso nome in un altro bucket non vale.
SELECT pg_temp.permesso('bw:393330000201:F2', '393330000201', 'image/jpeg', 100, 1000000000) AS pf2 \gset
SELECT pg_temp.oggetto('landing-media', :'pf2'::jsonb->>'path', 555);
SELECT pg_temp.uguale('fatto: l''oggetto è in un altro bucket → resta in_caricamento', 'in_caricamento',
  pg_temp.fatto('bw:393330000201:F2')->>'stato');
-- Un peso illeggibile (assente o non numerico) non vale come «caricato».
DELETE FROM storage.objects;
SELECT pg_temp.permesso('bw:393330000201:F3', '393330000201', 'image/jpeg', 100, 1000000000) AS pf3 \gset
INSERT INTO storage.objects (bucket_id, name, metadata) VALUES ('ponte-media', :'pf3'::jsonb->>'path', '{"size":"abc"}'::jsonb);
SELECT pg_temp.uguale('fatto: peso illeggibile → resta in_caricamento', 'in_caricamento', pg_temp.fatto('bw:393330000201:F3')->>'stato');
-- Il peso sopra gli 8 MiB non si accetta (il bucket lo vieta, ma la funzione non si fida).
DELETE FROM storage.objects;
SELECT pg_temp.permesso('bw:393330000201:F4', '393330000201', 'image/jpeg', 100, 1000000000) AS pf4 \gset
SELECT pg_temp.oggetto('ponte-media', :'pf4'::jsonb->>'path', 8388609);
SELECT pg_temp.uguale('fatto: oggetto oltre 8 MiB → resta in_caricamento (il vincolo della tabella non scatta)', 'in_caricamento', pg_temp.fatto('bw:393330000201:F4')->>'stato');
-- Un altro utente non chiude la riga altrui.
DELETE FROM storage.objects;
SELECT pg_temp.oggetto('ponte-media', :'pf2'::jsonb->>'path', 100);
SELECT pg_temp.uguale('fatto: un altro utente con quella chiave → assente, la riga resta com''è', 'assente|in_caricamento',
  (pg_temp.fatto('bw:393330000201:F2', :'U2'::uuid)->>'stato') || '|' || (SELECT stato FROM public.ponte_wa_media WHERE chiave = 'bw:393330000201:F2'));
DELETE FROM public.ponte_wa_media;
DELETE FROM storage.objects;

-- ── Permessi: chi può chiamare, chi può leggere ──────────────────────────────
SELECT pg_temp.uguale('funzioni: anon e authenticated senza EXECUTE, service_role sì', 'false|false|false|false|true|true',
  concat_ws('|',
    has_function_privilege('anon', 'public.ponte_wa_media_permesso(uuid, text, text, text, bigint, bigint)', 'EXECUTE')::text,
    has_function_privilege('anon', 'public.ponte_wa_media_fatto(uuid, text)', 'EXECUTE')::text,
    has_function_privilege('authenticated', 'public.ponte_wa_media_permesso(uuid, text, text, text, bigint, bigint)', 'EXECUTE')::text,
    has_function_privilege('authenticated', 'public.ponte_wa_media_fatto(uuid, text)', 'EXECUTE')::text,
    has_function_privilege('service_role', 'public.ponte_wa_media_permesso(uuid, text, text, text, bigint, bigint)', 'EXECUTE')::text,
    has_function_privilege('service_role', 'public.ponte_wa_media_fatto(uuid, text)', 'EXECUTE')::text));
SELECT pg_temp.uguale('funzioni: SECURITY DEFINER con search_path fisso (public, pg_temp)', 'true|true|{"search_path=public, pg_temp"}|{"search_path=public, pg_temp"}',
  (SELECT concat_ws('|', bool_and(prosecdef)::text, (count(*) = 2)::text, min(proconfig::text), max(proconfig::text))
     FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('ponte_wa_media_permesso', 'ponte_wa_media_fatto')));
SELECT pg_temp.uguale('tabella: authenticated solo SELECT; anon niente; service_role scrive', 'true|false|false|false|false|false|false|false|true',
  concat_ws('|',
    has_table_privilege('authenticated', 'public.ponte_wa_media', 'SELECT')::text,
    has_table_privilege('authenticated', 'public.ponte_wa_media', 'INSERT')::text,
    has_table_privilege('authenticated', 'public.ponte_wa_media', 'UPDATE')::text,
    has_table_privilege('authenticated', 'public.ponte_wa_media', 'DELETE')::text,
    has_table_privilege('anon', 'public.ponte_wa_media', 'SELECT')::text,
    has_table_privilege('anon', 'public.ponte_wa_media', 'INSERT')::text,
    has_table_privilege('anon', 'public.ponte_wa_media', 'UPDATE')::text,
    has_table_privilege('anon', 'public.ponte_wa_media', 'DELETE')::text,
    has_table_privilege('service_role', 'public.ponte_wa_media', 'INSERT')::text));
SELECT pg_temp.uguale('tabella: RLS accesa, una sola policy, di lettura, per authenticated', 'true|users read own ponte media|SELECT|{authenticated}',
  (SELECT concat_ws('|', (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.ponte_wa_media'::regclass),
                    string_agg(policyname || '|' || cmd || '|' || roles::text, ',')) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ponte_wa_media'));
-- La stessa forma della policy di whatsapp_messages: sola lettura, authenticated, auth.uid() = user_id.
SELECT pg_temp.uguale('tabella: la policy ha la stessa forma di quella di whatsapp_messages (cmd, ruoli, condizione)', 'true',
  (SELECT (a.cmd = b.cmd AND a.roles = b.roles AND a.qual = b.qual)::text
     FROM pg_policies a, pg_policies b
    WHERE a.schemaname = 'public' AND a.tablename = 'ponte_wa_media' AND a.policyname = 'users read own ponte media'
      AND b.schemaname = 'public' AND b.tablename = 'whatsapp_messages' AND b.policyname = 'users read own wa messages'));
SELECT pg_temp.uguale('tabella: chiave primaria (user_id, chiave) e indice (user_id, numero)', 'user_id,chiave|true',
  (SELECT concat_ws('|',
     (SELECT string_agg(a.attname, ',' ORDER BY k.ord) FROM pg_constraint c, unnest(c.conkey) WITH ORDINALITY k(attnum, ord), pg_attribute a
       WHERE c.conrelid = 'public.ponte_wa_media'::regclass AND c.contype = 'p' AND a.attrelid = c.conrelid AND a.attnum = k.attnum),
     (SELECT (count(*) = 1)::text FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'ponte_wa_media' AND indexdef ~ '\(user_id, numero\)'))));

-- authenticated legge solo le sue righe e non scrive.
INSERT INTO public.ponte_wa_media (user_id, chiave, numero, path, mime, byte, stato) VALUES
  (:'U'::uuid,  'bw:393330000201:L1', '393330000201', 'a/1.jpg', 'image/jpeg', 10, 'pronta'),
  (:'U'::uuid,  'bw:393330000201:L2', '393330000201', 'a/2.jpg', 'image/jpeg', 10, 'in_caricamento'),
  (:'U2'::uuid, 'bw:393330000202:L3', '393330000202', 'b/3.jpg', 'image/jpeg', 10, 'pronta');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true),
       set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000e1', true) \gset
SELECT count(*) AS vede_suo FROM public.ponte_wa_media \gset
SELECT count(*) AS vede_altrui FROM public.ponte_wa_media WHERE user_id = '00000000-0000-4000-8000-0000000000e2' \gset
DO $d$
BEGIN
  BEGIN
    INSERT INTO public.ponte_wa_media (user_id, chiave, numero, path, mime, byte) VALUES ('00000000-0000-4000-8000-0000000000e1', 'bw:393330000201:X9', '393330000201', 'z.jpg', 'image/jpeg', 1);
    RAISE EXCEPTION 'KO authenticated scrive in ponte_wa_media';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.ponte_wa_media SET stato = 'pronta';
    RAISE EXCEPTION 'KO authenticated aggiorna ponte_wa_media';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.ponte_wa_media;
    RAISE EXCEPTION 'KO authenticated cancella da ponte_wa_media';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.ponte_wa_media_permesso('00000000-0000-4000-8000-0000000000e1', 'bw:393330000201:X9', '393330000201', 'image/jpeg', 1, 1000000);
    RAISE EXCEPTION 'KO authenticated chiama ponte_wa_media_permesso';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.ponte_wa_media_fatto('00000000-0000-4000-8000-0000000000e1', 'bw:393330000201:L1');
    RAISE EXCEPTION 'KO authenticated chiama ponte_wa_media_fatto';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $d$;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true),
       set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000e2', true) \gset
SELECT count(*) AS vede_secondo FROM public.ponte_wa_media \gset
SELECT count(*) AS vede_del_primo FROM public.ponte_wa_media WHERE user_id = '00000000-0000-4000-8000-0000000000e1' \gset
RESET ROLE;
SELECT pg_temp.uguale('RLS: ognuno vede solo le sue righe (2 e 0; 1 e 0)', '2|0|1|0', concat_ws('|', :vede_suo, :vede_altrui, :vede_secondo, :vede_del_primo));
SELECT pg_temp.uguale('…e le prove di scrittura non hanno cambiato niente', '3|0',
  (SELECT count(*)::text FROM public.ponte_wa_media) || '|' || (SELECT count(*)::text FROM public.ponte_wa_media WHERE chiave = 'bw:393330000201:X9'));

-- ── Le chat non si toccano ───────────────────────────────────────────────────
SELECT pg_temp.uguale('nessuna scrittura su whatsapp_messages né su whatsapp_contacts', :'msg_prima' || '|' || :'con_prima',
  (SELECT count(*)::text FROM public.whatsapp_messages) || '|' || (SELECT count(*)::text FROM public.whatsapp_contacts));

\echo 'TUTTI I CONTROLLI DELLE IMMAGINI PASSANO (ora ROLLBACK: nel database non resta niente)'
ROLLBACK;
