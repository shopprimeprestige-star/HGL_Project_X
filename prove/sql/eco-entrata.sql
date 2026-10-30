-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DELL'ECO DI MANYCHAT SUL CONTATTO, SU UN POSTGRES VERO (30/10/2026)
-- Commessa 2026-10-30-eco-manychat-entrata. Migrazione:
-- supabase/migrations/20261030230000_eco_entrata_contatti.sql
--
-- NON entra in `npm test` e NON si lancia sul database di produzione: serve un
-- database di prova con le migrazioni applicate in ordine (come ponte-tutte.sql).
-- La migrazione nuova la applica lo script stesso, DUE volte.
--
--   psql "$DB" -f prove/sql/eco-entrata.sql        (dalla radice del repo)
--
-- Tutto gira dentro UNA transazione che finisce con ROLLBACK. Al primo
-- controllo sbagliato si ferma con «KO <nome>: atteso …, avuto …».
-- Riproduce la sequenza vera del 28/10 (orari UTC): ogni messaggio mandato dal
-- telefono torna da ManyChat come «entrata» e la rotta ha già scritto il contatto.
-- Dati inventati: utente, numeri e testi non esistono.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
\set migrazione 'supabase/migrations/20261030230000_eco_entrata_contatti.sql'
\set U '00000000-0000-4000-8000-0000000000d1'

BEGIN;
SET LOCAL TIME ZONE 'UTC';
\i :migrazione
\i :migrazione
\echo 'ok  migrazione applicata due volte senza errori'

CREATE TEMP TABLE esito (nome text, atteso text, avuto text);
CREATE FUNCTION pg_temp.verifica(p_nome text, p_atteso text, p_avuto text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_atteso IS DISTINCT FROM p_avuto THEN
    RAISE EXCEPTION 'KO %: atteso %, avuto %', p_nome, p_atteso, p_avuto;
  END IF;
  RAISE NOTICE 'ok  %', p_nome;
END $$;

-- Un nostro utente e il contatto: il cliente ha scritto davvero alle 17:40:00 (ManyChat), non letto 1.
INSERT INTO auth.users (id) VALUES (:'U') ON CONFLICT DO NOTHING;
INSERT INTO public.whatsapp_messages (user_id, direction, from_number, to_number, body, wa_message_id, canale, status, created_at)
VALUES (:'U', 'inbound', '+39333000201', 'manychat', 'Va bene, grazie', 'mc-in:vera0', 'manychat', 'delivered', '2026-10-28 17:40:00+00');
INSERT INTO public.whatsapp_contacts (user_id, phone_e164, unread_count, last_message_at, ultimo_in_entrata_il, ultimo_in_entrata_anteprima)
VALUES (:'U', '+39333000201', 1, '2026-10-28 17:40:01+00', '2026-10-28 17:40:01+00', 'Va bene, grazie');

-- La sequenza vera: uscite dal telefono (baileys) e, 2-21 secondi dopo, l'eco del vecchio testo.
-- Ogni eco: la riga (il trigger dell'ultimo messaggio la scrive sul contatto) e poi la rotta
-- (whatsapp_registra_entrata) con l'ora del database: qui l'ora dell'eco + 1 secondo.
CREATE FUNCTION pg_temp.uscita(p_alle text, p_canale text) RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.whatsapp_messages (user_id, direction, from_number, to_number, body, wa_message_id, canale, status, created_at)
  VALUES ('00000000-0000-4000-8000-0000000000d1', 'outbound', 'manychat', '+39333000201', 'Messaggio nostro ' || p_alle,
          'out:' || p_alle, p_canale, 'sent', ('2026-10-28 ' || p_alle || '+00')::timestamptz);
$$;
CREATE FUNCTION pg_temp.eco(p_alle text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE t timestamptz := ('2026-10-28 ' || p_alle || '+00')::timestamptz;
BEGIN
  INSERT INTO public.whatsapp_messages (user_id, direction, from_number, to_number, body, wa_message_id, canale, status, created_at)
  VALUES ('00000000-0000-4000-8000-0000000000d1', 'inbound', '+39333000201', 'manychat', 'Va bene, grazie',
          'mc-in:eco' || p_alle, 'manychat', 'delivered', t);
  UPDATE public.whatsapp_contacts
     SET unread_count = unread_count + 1, last_message_at = t + interval '1 second',
         ultimo_in_entrata_il = t + interval '1 second', ultimo_in_entrata_anteprima = 'Va bene, grazie'
   WHERE user_id = '00000000-0000-4000-8000-0000000000d1';
END $$;

SELECT pg_temp.uscita('17:45:02', 'manychat');
SELECT pg_temp.uscita('17:45:49', 'baileys');
SELECT pg_temp.eco('17:45:51');
SELECT pg_temp.uscita('17:45:52', 'baileys');
SELECT pg_temp.uscita('17:56:18', 'baileys');
SELECT pg_temp.eco('17:56:39');
SELECT pg_temp.uscita('17:58:43', 'baileys');
SELECT pg_temp.eco('17:58:51');
SELECT pg_temp.uscita('17:59:56', 'baileys');
SELECT pg_temp.eco('18:00:04');

SELECT pg_temp.verifica('prima: il contatto è sporco (entrata = eco, ultimo messaggio = eco)',
  '2026-10-28 18:00:05+00|2026-10-28 18:00:04+00|inbound|5',
  (SELECT ultimo_in_entrata_il::text || '|' || ultimo_messaggio_il::text || '|' || ultimo_messaggio_direzione || '|' || unread_count
     FROM public.whatsapp_contacts WHERE user_id = :'U'));

-- La pulizia della notte (p8): segna le eco con duplicato_di. Il riallineo è differito a fine
-- transazione: qui lo si forza come farebbe il COMMIT.
SELECT pg_temp.verifica('la pulizia segna 4 eco', '4',
  (public.wa_segna_eco_doppioni(:'U', '2026-10-28 00:00:00+00') ->> 'eco')::text);
SET CONSTRAINTS trg_wa_eco_segnata IMMEDIATE;

SELECT pg_temp.verifica('dopo: l''ultima entrata è la vera (17:40:00), con la sua anteprima',
  '2026-10-28 17:40:00+00|Va bene, grazie',
  (SELECT ultimo_in_entrata_il::text || '|' || ultimo_in_entrata_anteprima FROM public.whatsapp_contacts WHERE user_id = :'U'));
SELECT pg_temp.verifica('dopo: l''ultimo messaggio è il nostro delle 17:59:56',
  '2026-10-28 17:59:56+00|outbound',
  (SELECT ultimo_messaggio_il::text || '|' || ultimo_messaggio_direzione FROM public.whatsapp_contacts WHERE user_id = :'U'));
SELECT pg_temp.verifica('dopo: last_message_at non è più l''ora dell''eco', '2026-10-28 17:59:56+00',
  (SELECT last_message_at::text FROM public.whatsapp_contacts WHERE user_id = :'U'));
SELECT pg_temp.verifica('dopo: non letti = 1 (quello vero), 4 eco tolte', '1',
  (SELECT unread_count::text FROM public.whatsapp_contacts WHERE user_id = :'U'));

-- Un'entrata vera arrivata DOPO l'eco non si tocca: l'eco segnata più tardi non riporta indietro niente.
INSERT INTO public.whatsapp_messages (user_id, direction, from_number, to_number, body, wa_message_id, canale, status, created_at)
VALUES (:'U', 'inbound', '+39333000201', 'manychat', 'Posso spostare?', 'mc-in:vera1', 'manychat', 'delivered', '2026-10-28 18:30:00+00');
UPDATE public.whatsapp_contacts SET unread_count = unread_count + 1, ultimo_in_entrata_il = '2026-10-28 18:30:01+00',
       ultimo_in_entrata_anteprima = 'Posso spostare?' WHERE user_id = :'U';
SELECT pg_temp.eco('18:30:20');
UPDATE public.whatsapp_contacts SET ultimo_in_entrata_il = '2026-10-28 18:40:00+00', ultimo_in_entrata_anteprima = 'Altro vero' WHERE user_id = :'U';
UPDATE public.whatsapp_messages SET duplicato_di = (SELECT id FROM public.whatsapp_messages WHERE wa_message_id = 'mc-in:vera1')
 WHERE wa_message_id = 'mc-in:eco18:30:20';
SET CONSTRAINTS trg_wa_eco_segnata IMMEDIATE;
SELECT pg_temp.verifica('entrata più tarda dell''eco (oltre 1 minuto): non si tocca', '2026-10-28 18:40:00+00|Altro vero',
  (SELECT ultimo_in_entrata_il::text || '|' || ultimo_in_entrata_anteprima FROM public.whatsapp_contacts WHERE user_id = :'U'));

-- Una riga che non è ManyChat (ponte) o non è in entrata non fa partire niente; la funzione chiamata a mano
-- su una riga non segnata non fa niente.
SELECT pg_temp.verifica('riga non segnata: la funzione non fa niente', 'false',
  public.wa_riallinea_entrata_eco((SELECT id FROM public.whatsapp_messages WHERE wa_message_id = 'mc-in:vera1'), true)::text);

-- Nessuno dal browser può chiamarla.
SELECT pg_temp.verifica('anon/authenticated non eseguono la funzione', 'false|false',
  has_function_privilege('anon', 'public.wa_riallinea_entrata_eco(uuid, boolean)', 'EXECUTE')::text || '|' ||
  has_function_privilege('authenticated', 'public.wa_riallinea_entrata_eco(uuid, boolean)', 'EXECUTE')::text);

\echo 'FINE: tutti i controlli ok (ROLLBACK)'
ROLLBACK;
