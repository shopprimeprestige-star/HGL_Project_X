-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DELLA CHAT VELOCE SU UN POSTGRES VERO (commessa
-- 2026-10-30-ottimizzazioni, pacchetto p1-chat-veloce)
--
-- NON entra in `npm test` e NON si lancia sul database di produzione: serve un
-- database di prova con le migrazioni applicate in ordine (`supabase start` va
-- bene). Istruzioni e uscita attesa: prove/sql/LEGGIMI.md.
--
--   psql "$DB" -f prove/sql/chat-veloce.sql        (dalla radice del repo)
--
-- Tutto gira dentro UNA transazione che finisce con ROLLBACK: la migrazione
-- (applicata due volte) e i dati di prova spariscono alla fine. Al primo
-- controllo sbagliato si ferma con «KO <nome>: atteso …, avuto …».
-- Dati inventati: utenti, numeri e testi non esistono.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
\set migrazione 'supabase/migrations/20261030101100_p1-chat-veloce.sql'
\set U  '00000000-0000-4000-8000-0000000000c1'
\set U2 '00000000-0000-4000-8000-0000000000c2'

BEGIN;

CREATE FUNCTION pg_temp.uguale(nome text, atteso text, avuto text) RETURNS text
LANGUAGE plpgsql AS $f$
BEGIN
  IF atteso IS DISTINCT FROM avuto THEN
    RAISE EXCEPTION 'KO %: atteso «%», avuto «%»', nome, atteso, avuto;
  END IF;
  RETURN 'ok  ' || nome;
END $f$;

DO $f$ BEGIN
  IF to_regclass('auth.users') IS NOT NULL THEN
    INSERT INTO auth.users (id, email) VALUES
      ('00000000-0000-4000-8000-0000000000c1', 'prova-chat-1@example.invalid'),
      ('00000000-0000-4000-8000-0000000000c2', 'prova-chat-2@example.invalid')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $f$;

-- ── Prima della migrazione: chat che esistono già ────────────────────────────
-- +393330000301: ultima un'uscita (un modello), con un'entrata prima.
-- 393330000302 (contatto SENZA «+», come quelli del ponte): ultima un'entrata.
-- +393330000303: l'ultima riga è un doppione del ponte (non conta).
-- +393330000304: l'ultima riga è un'eco vecchia di ManyChat (non conta).
INSERT INTO public.whatsapp_contacts (user_id, phone_e164) VALUES
  (:'U', '+393330000301'), (:'U', '393330000302'), (:'U', '+393330000303'), (:'U', '+393330000304'),
  (:'U2', '+393330000301');
INSERT INTO public.whatsapp_messages (user_id, direction, from_number, to_number, body, created_at, wa_message_id, duplicato_di) VALUES
  (:'U', 'inbound',  '+393330000301', 'pnid', 'ciao',                    '2026-09-01 10:00+00', NULL, NULL),
  (:'U', 'outbound', 'pnid', '+393330000301', '[template:hgl_ritorno]',  '2026-09-01 11:00+00', NULL, NULL),
  (:'U', 'inbound',  '393330000302', 'pnid',  'quando possiamo?',        '2026-09-02 10:00+00', NULL, NULL),
  (:'U', 'inbound',  '+393330000303', 'pnid', 'vero',                    '2026-09-03 10:00+00', NULL, NULL),
  (:'U', 'inbound',  '+393330000303', 'pnid', 'vero',                    '2026-09-03 10:01+00', NULL, gen_random_uuid()),
  (:'U', 'inbound',  '+393330000304', 'pnid', 'Va bene',                 '2026-10-20 10:00+00', 'mc-in:1', NULL),
  (:'U', 'outbound', 'pnid', '+393330000304', 'Allora a domani',         '2026-10-20 11:00+00', NULL, NULL),
  (:'U', 'inbound',  '+393330000304', 'pnid', 'va bene ',                '2026-10-20 11:01+00', 'mc-in:2', NULL),
  (:'U2', 'inbound', '+393330000301', 'pnid', 'altro utente',            '2026-10-25 10:00+00', NULL, NULL);

-- ── La migrazione, due volte di seguito ──────────────────────────────────────
\i :migrazione
\i :migrazione
\echo 'ok  migrazione applicata due volte senza errori'

-- ── Il riempimento ───────────────────────────────────────────────────────────
SELECT pg_temp.uguale('riempimento: ultima un''uscita (modello), con direzione',
  '[template:hgl_ritorno]|outbound|2026-09-01 11:00:00+00',
  (SELECT concat_ws('|', ultimo_messaggio_anteprima, ultimo_messaggio_direzione, ultimo_messaggio_il AT TIME ZONE 'UTC' || '+00')
     FROM public.whatsapp_contacts WHERE user_id = :'U' AND phone_e164 = '+393330000301'));
SELECT pg_temp.uguale('riempimento: contatto senza «+» trovato',
  'quando possiamo?|inbound',
  (SELECT concat_ws('|', ultimo_messaggio_anteprima, ultimo_messaggio_direzione)
     FROM public.whatsapp_contacts WHERE phone_e164 = '393330000302'));
SELECT pg_temp.uguale('riempimento: il doppione del ponte non conta',
  '2026-09-03 10:00:00',
  (SELECT (ultimo_messaggio_il AT TIME ZONE 'UTC')::text FROM public.whatsapp_contacts WHERE phone_e164 = '+393330000303'));
SELECT pg_temp.uguale('riempimento: l''eco vecchia di ManyChat non conta (resta la nostra uscita)',
  'Allora a domani|outbound',
  (SELECT concat_ws('|', ultimo_messaggio_anteprima, ultimo_messaggio_direzione)
     FROM public.whatsapp_contacts WHERE phone_e164 = '+393330000304'));
SELECT pg_temp.uguale('riempimento: ogni utente il suo',
  'altro utente',
  (SELECT ultimo_messaggio_anteprima FROM public.whatsapp_contacts WHERE user_id = :'U2'));
SELECT pg_temp.uguale('le righe vecchie restano senza cambiato_il (nessuna riscrittura)',
  '0', (SELECT count(*)::text FROM public.whatsapp_messages WHERE cambiato_il IS NOT NULL));

-- ── Il trigger dei messaggi nuovi ────────────────────────────────────────────
INSERT INTO public.whatsapp_messages (user_id, direction, from_number, to_number, body, created_at)
VALUES (:'U', 'outbound', 'pnid', '+393330000302', repeat('x', 300), now());
SELECT pg_temp.uguale('uscita nuova: anteprima (tagliata a 200), direzione, ora',
  '200|outbound|true',
  (SELECT concat_ws('|', length(ultimo_messaggio_anteprima), ultimo_messaggio_direzione, (ultimo_messaggio_il = now())::text)
     FROM public.whatsapp_contacts WHERE phone_e164 = '393330000302'));
SELECT pg_temp.uguale('…e il contatto è «cambiato» (updated_at), così la pagina lo rilegge',
  'true', (SELECT (updated_at = now())::text FROM public.whatsapp_contacts WHERE phone_e164 = '393330000302'));
SELECT pg_temp.uguale('cambiato_il scritto all''inserimento',
  'true', (SELECT (cambiato_il = now())::text FROM public.whatsapp_messages WHERE body = repeat('x', 300)));

INSERT INTO public.whatsapp_messages (user_id, direction, from_number, to_number, body, created_at, canale)
VALUES (:'U', 'inbound', '393330000301', 'pnid', 'storico vecchio', '2026-08-01 10:00+00', 'baileys');
SELECT pg_temp.uguale('storico più vecchio: l''anteprima NON torna indietro',
  '[template:hgl_ritorno]',
  (SELECT ultimo_messaggio_anteprima FROM public.whatsapp_contacts WHERE user_id = :'U' AND phone_e164 = '+393330000301'));

INSERT INTO public.whatsapp_messages (user_id, direction, from_number, to_number, body, created_at, duplicato_di)
VALUES (:'U', 'inbound', '+393330000301', 'pnid', 'doppione', now() + interval '1 minute', gen_random_uuid());
SELECT pg_temp.uguale('doppione del ponte più nuovo: non tocca l''anteprima',
  '[template:hgl_ritorno]',
  (SELECT ultimo_messaggio_anteprima FROM public.whatsapp_contacts WHERE user_id = :'U' AND phone_e164 = '+393330000301'));

INSERT INTO public.whatsapp_messages (user_id, direction, from_number, to_number, body, created_at)
VALUES (:'U', 'inbound', '+393330000301', 'pnid', 'sono io', now());
SELECT pg_temp.uguale('entrata nuova: tocca solo il contatto del suo utente',
  'sono io|altro utente',
  (SELECT string_agg(ultimo_messaggio_anteprima, '|' ORDER BY user_id) FROM public.whatsapp_contacts WHERE phone_e164 = '+393330000301'));

UPDATE public.whatsapp_messages SET status = 'read', cambiato_il = '2000-01-01' WHERE body = 'sono io';
SELECT pg_temp.uguale('update di un messaggio: cambiato_il è l''ora del database, non quella scritta',
  'true', (SELECT (cambiato_il = now())::text FROM public.whatsapp_messages WHERE body = 'sono io'));

-- ── Il contatto creato dopo il suo primo messaggio ───────────────────────────
INSERT INTO public.whatsapp_messages (user_id, direction, from_number, to_number, body, created_at)
VALUES (:'U', 'outbound', 'pnid', '+393330000309', 'primo messaggio', now());
INSERT INTO public.whatsapp_contacts (user_id, phone_e164) VALUES (:'U', '+393330000309')
ON CONFLICT (user_id, phone_e164) DO UPDATE SET last_message_at = now();
SELECT pg_temp.uguale('contatto nuovo: prende l''anteprima del messaggio già scritto',
  'primo messaggio|outbound',
  (SELECT concat_ws('|', ultimo_messaggio_anteprima, ultimo_messaggio_direzione)
     FROM public.whatsapp_contacts WHERE phone_e164 = '+393330000309'));
INSERT INTO public.whatsapp_contacts (user_id, phone_e164) VALUES (:'U', '+393330000310');
SELECT pg_temp.uguale('contatto nuovo senza messaggi: anteprima vuota',
  NULL, (SELECT ultimo_messaggio_anteprima FROM public.whatsapp_contacts WHERE phone_e164 = '+393330000310'));

-- ── Chi può chiamare le funzioni dei trigger ─────────────────────────────────
SELECT pg_temp.uguale('le tre funzioni non si chiamano dal browser',
  'false|false|false',
  concat_ws('|',
    has_function_privilege('authenticated', 'public.wa_messaggio_cambiato_il()', 'EXECUTE')::text,
    has_function_privilege('authenticated', 'public.wa_messaggio_anteprima()', 'EXECUTE')::text,
    has_function_privilege('anon', 'public.wa_contatto_anteprima()', 'EXECUTE')::text));

\echo 'TUTTI I CONTROLLI DELLA CHAT VELOCE PASSANO'
ROLLBACK;
