-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DELLA PROTEZIONE DELLE CHIAVI META SU UN POSTGRES VERO
-- (commessa 2026-10-31-anteprima-link, migrazione 20261031170000_whatsapp_chiavi_server.sql)
--
-- NON entra in `npm test` e NON si lancia sul database di produzione: serve un database di prova con
-- le migrazioni applicate in ordine (strumenti/pg-prova.sh della commessa ottimizzazioni va bene).
--   psql "$DB" -f prove/sql/whatsapp-chiavi.sql        (dalla radice del repo)
-- Tutto dentro UNA transazione che finisce con ROLLBACK. Dati inventati.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
\set U '00000000-0000-4000-8000-0000000000d1'
BEGIN;
--  Come su Supabase vero: service_role ha tutti i permessi sulle tabelle di public (qui il database di
--  prova non ha i privilegi di default).
GRANT ALL ON public.whatsapp_settings TO service_role;
\i supabase/migrations/20261031170000_whatsapp_chiavi_server.sql
\i supabase/migrations/20261031170000_whatsapp_chiavi_server.sql
\echo 'ok  migrazione applicata due volte senza errori'

INSERT INTO auth.users (id, email) VALUES (:'U', 'prova@esempio.test') ON CONFLICT DO NOTHING;
INSERT INTO public.whatsapp_settings (user_id, phone_number_id, access_token, app_secret, webhook_verify_token)
VALUES (:'U', '111', 'TOKEN-FINTO', 'SEGRETO-FINTO', 'VERIFICA-FINTA')
ON CONFLICT (user_id) DO UPDATE SET access_token = 'TOKEN-FINTO';

CREATE FUNCTION pg_temp.atteso(nome text, q text, voluto boolean) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE riuscita boolean := true;
BEGIN
  BEGIN EXECUTE q; EXCEPTION WHEN insufficient_privilege THEN riuscita := false; END;
  IF riuscita <> voluto THEN RAISE EXCEPTION 'KO %: atteso %, avuto %', nome, voluto, riuscita; END IF;
  RAISE NOTICE 'ok  %', nome;
END $f$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'U', true);
SELECT pg_temp.atteso('il browser legge le colonne non segrete', 'SELECT phone_number_id, mode, default_values FROM public.whatsapp_settings', true);
SELECT pg_temp.atteso('il browser NON legge access_token', 'SELECT access_token FROM public.whatsapp_settings', false);
SELECT pg_temp.atteso('il browser NON legge app_secret', 'SELECT app_secret FROM public.whatsapp_settings', false);
SELECT pg_temp.atteso('il browser NON legge webhook_verify_token', 'SELECT webhook_verify_token FROM public.whatsapp_settings', false);
SELECT pg_temp.atteso('il browser NON legge con select *', 'SELECT * FROM public.whatsapp_settings', false);
SELECT pg_temp.atteso('il browser NON scrive access_token', 'UPDATE public.whatsapp_settings SET access_token = ''x''', false);
SELECT pg_temp.atteso('il browser NON scrive app_secret', 'UPDATE public.whatsapp_settings SET app_secret = ''x''', false);
SELECT pg_temp.atteso('il browser NON scrive webhook_verify_token', 'UPDATE public.whatsapp_settings SET webhook_verify_token = ''x''', false);
SELECT pg_temp.atteso('il browser aggiorna disabled_template_statuses', 'UPDATE public.whatsapp_settings SET disabled_template_statuses = ARRAY[''x''] WHERE user_id = ''' || :'U' || '''', true);
SELECT pg_temp.atteso('il browser aggiorna default_values e status_template_map', 'UPDATE public.whatsapp_settings SET default_values = ''{}'', status_template_map = ''{}'' WHERE user_id = ''' || :'U' || '''', true);
SELECT pg_temp.atteso('il browser fa un upsert delle colonne non segrete', 'INSERT INTO public.whatsapp_settings (user_id, disabled_template_statuses) VALUES (''' || :'U' || ''', ARRAY[''y'']) ON CONFLICT (user_id) DO UPDATE SET disabled_template_statuses = EXCLUDED.disabled_template_statuses', true);
SELECT pg_temp.atteso('il browser fa un upsert che nomina anche updated_at (interruttore dei template per stato)', 'INSERT INTO public.whatsapp_settings (user_id, disabled_template_statuses, updated_at) VALUES (''' || :'U' || ''', ARRAY[''z''], now()) ON CONFLICT (user_id) DO UPDATE SET disabled_template_statuses = EXCLUDED.disabled_template_statuses, updated_at = EXCLUDED.updated_at', true);
RESET ROLE;

SET LOCAL ROLE anon;
SELECT pg_temp.atteso('anon non legge niente', 'SELECT phone_number_id FROM public.whatsapp_settings', false);
RESET ROLE;

SET LOCAL ROLE service_role;
SELECT pg_temp.atteso('il server (service_role) legge ancora il token', 'SELECT access_token, app_secret, webhook_verify_token FROM public.whatsapp_settings', true);
SELECT pg_temp.atteso('il server scrive ancora il token', 'UPDATE public.whatsapp_settings SET access_token = ''NUOVO''', true);
RESET ROLE;
\echo 'ok  FINE: la protezione delle chiavi regge'
ROLLBACK;
