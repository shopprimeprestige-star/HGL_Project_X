-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DEL SEGNO «HA_MESSAGGIO_PONTE» SU UN POSTGRES VERO (commessa
-- 2026-11-13-chat-baileys, filo A, T1)
--
-- NON entra in `npm test` e NON si lancia sul database di produzione: serve
-- un database di prova con TUTTE le migrazioni applicate in ordine
-- (`supabase start` va bene). La migrazione nuova la applica lo script
-- stesso, DUE volte, per ultima. Istruzioni e uscita attesa: prove/sql/LEGGIMI.md.
--
--   psql "$DB" -f prove/sql/ponte-chat-flag.sql        (dalla radice del repo)
--
-- Tutto gira dentro UNA transazione che finisce con ROLLBACK. Al primo
-- controllo sbagliato si ferma con «KO <nome>: atteso …, avuto …».
--
-- Dati inventati: utenti, numeri, nomi e id non esistono.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
\set migrazione 'supabase/migrations/20261113120000_ponte_chat_flag.sql'
\set U  '00000000-0000-4000-8000-0000000000f1'
\set U2 '00000000-0000-4000-8000-0000000000f2'
\set MC '00000000-0000-4000-8000-00000000f003'

BEGIN;

-- ── La migrazione nuova, DUE volte (tutte le precedenti sono già nel database) ─
\i :migrazione
\i :migrazione
\echo 'ok  migrazione applicata due volte senza errori'

CREATE FUNCTION pg_temp.uguale(nome text, atteso text, avuto text) RETURNS text
LANGUAGE plpgsql AS $f$
BEGIN
  IF atteso IS DISTINCT FROM avuto THEN
    RAISE EXCEPTION 'KO %: atteso «%», avuto «%»', nome, atteso, avuto;
  END IF;
  RETURN 'ok  ' || nome;
END $f$;

-- Una voce di p_righe nella forma di tipi.ts (RigaScrittura).
CREATE FUNCTION pg_temp.riga(k text, n text, d text, t double precision, x text, e boolean) RETURNS jsonb
LANGUAGE sql AS $f$
  SELECT jsonb_build_object('k', k, 'n', n, 'd', d, 't', t, 'x', x, 'e', e, 'm', NULL,
                            's', CASE WHEN d = 'in' THEN 'delivered' ELSE 'sent' END)
$f$;

-- Il contatto di un numero (col «+»), per l'utente U.
CREATE FUNCTION pg_temp.contatto(n text) RETURNS public.whatsapp_contacts
LANGUAGE sql AS $f$
  SELECT c FROM public.whatsapp_contacts c
   WHERE c.user_id = '00000000-0000-4000-8000-0000000000f1'::uuid AND c.phone_e164 = '+' || n
$f$;

SELECT extract(epoch FROM date_trunc('second', now()))::bigint - 60 AS t_in \gset

-- ── Il mondo di prova ────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email) VALUES
  (:'U'::uuid,  'prova-flag-1@example.invalid'),
  (:'U2'::uuid, 'prova-flag-2@example.invalid')
ON CONFLICT (id) DO NOTHING;
-- 201: contatto GIÀ esistente (lead con scheda), senza nessun messaggio del ponte ancora.
-- 202: solo ManyChat, nessun messaggio baileys: deve restare false per sempre.
-- 203: un altro utente, stesso numero di 201: non va toccato dalle scritture di U.
INSERT INTO public.whatsapp_contacts (user_id, phone_e164, lead_id, last_message_at, ha_messaggio_ponte)
VALUES
  (:'U'::uuid,  '+393330000201', '00000000-0000-4000-8000-00000000f201', '2026-10-01 10:00+00', false),
  (:'U'::uuid,  '+393330000202', NULL,                                   '2026-10-01 10:00+00', false),
  (:'U2'::uuid, '+393330000201', NULL,                                   '2026-10-01 10:00+00', false);
INSERT INTO public.whatsapp_messages (id, user_id, wa_message_id, direction, from_number, to_number, body, status, canale, created_at)
VALUES (:'MC'::uuid, :'U'::uuid, 'mc-in:flag-202', 'inbound', '+393330000202', 'manychat', 'solo manychat', 'delivered', 'manychat', to_timestamp(:t_in));

-- ═════ 1. ponte_wa_scrivi segna un contatto che esiste GIÀ ═══════════════════
SELECT public.ponte_wa_scrivi(:'U'::uuid,
  jsonb_build_array(pg_temp.riga('bw:393330000201:F1', '393330000201', 'in', :t_in, 'ciao dal ponte', true)),
  '[]'::jsonb, '{}'::jsonb) AS ignora \gset
SELECT pg_temp.uguale('1 ponte_wa_scrivi: contatto già esistente (201) → ha_messaggio_ponte true',
  'true', (SELECT c.ha_messaggio_ponte::text FROM pg_temp.contatto('393330000201') c));
SELECT pg_temp.uguale('1 l''altro utente (203, stesso numero) NON è toccato', 'false',
  (SELECT c.ha_messaggio_ponte::text FROM public.whatsapp_contacts c WHERE c.user_id = :'U2'::uuid AND c.phone_e164 = '+393330000201'));

-- ═════ 2. Un numero che nasce SOLO dal ponte (storico: messaggi prima del contatto) ═
-- Il lotto scrive la riga ANCHE prima che esista un contatto: ponte_wa_scrivi crea
-- il contatto nello stesso giro (passo 3) e lo segna lì, non dal trigger.
SELECT public.ponte_wa_scrivi(:'U'::uuid,
  jsonb_build_array(pg_temp.riga('bw:393330000204:F2', '393330000204', 'in', :t_in, 'uno sconosciuto', true)),
  '[]'::jsonb, '{}'::jsonb) AS ignora \gset
SELECT pg_temp.uguale('2 numero MAI visto prima: contatto nuovo nasce con ha_messaggio_ponte true',
  'true', (SELECT c.ha_messaggio_ponte::text FROM pg_temp.contatto('393330000204') c));

-- ═════ 3. ponte_wa_invio_esito segna il contatto della chat su cui si è scritto ══
-- Riproduce il prelievo e l'esito come farebbero invii-giro.ts/invio.server.ts.
INSERT INTO public.ponte_wa_invii (id, user_id, chiave, numero, testo, stato, preso_il)
VALUES ('00000000-0000-4000-8000-00000000f301'::uuid, :'U'::uuid, 'chiave-flag-301', '393330000301', 'Ci vediamo domani', 'in_invio', now());
SELECT public.ponte_wa_invio_esito(:'U'::uuid, '00000000-0000-4000-8000-00000000f301'::uuid, 'inviato', 'WAID-FLAG-301', extract(epoch FROM now())::double precision, NULL) AS ignora \gset
SELECT pg_temp.uguale('3 ponte_wa_invio_esito: il contatto della chat (301, nato ora) ha_messaggio_ponte true',
  'true', (SELECT c.ha_messaggio_ponte::text FROM pg_temp.contatto('393330000301') c));
-- Stesso scenario con un contatto GIÀ esistente (201): il ramo UPDATE deve segnarlo anche lì.
INSERT INTO public.ponte_wa_invii (id, user_id, chiave, numero, testo, stato, preso_il)
VALUES ('00000000-0000-4000-8000-00000000f302'::uuid, :'U2'::uuid, 'chiave-flag-302', '393330000201', 'Risposta dal telefono', 'in_invio', now());
UPDATE public.whatsapp_contacts SET ha_messaggio_ponte = false WHERE user_id = :'U2'::uuid AND phone_e164 = '+393330000201';
SELECT public.ponte_wa_invio_esito(:'U2'::uuid, '00000000-0000-4000-8000-00000000f302'::uuid, 'inviato', 'WAID-FLAG-302', extract(epoch FROM now())::double precision, NULL) AS ignora \gset
SELECT pg_temp.uguale('3b ponte_wa_invio_esito sul ramo UPDATE (contatto 201 di U2, già esistente): ha_messaggio_ponte true',
  'true', (SELECT c.ha_messaggio_ponte::text FROM public.whatsapp_contacts c WHERE c.user_id = :'U2'::uuid AND c.phone_e164 = '+393330000201'));

-- ═════ 4. Una chat SOLO ManyChat resta false ═════════════════════════════════
SELECT pg_temp.uguale('4 contatto 202 (solo ManyChat, nessun messaggio baileys): resta false', 'false',
  (SELECT c.ha_messaggio_ponte::text FROM pg_temp.contatto('393330000202') c));

-- ═════ 5. Un numero senza «+» combacia con un messaggio che ha il «+» ═══════
INSERT INTO public.whatsapp_contacts (user_id, phone_e164, last_message_at, ha_messaggio_ponte)
VALUES (:'U'::uuid, '393330000205', now(), false);
SELECT public.ponte_wa_scrivi(:'U'::uuid,
  jsonb_build_array(pg_temp.riga('bw:393330000205:F5', '393330000205', 'in', :t_in, 'senza più', true)),
  '[]'::jsonb, '{}'::jsonb) AS ignora \gset
SELECT pg_temp.uguale('5 contatto salvato senza «+» combacia col messaggio (che ha il «+»): ha_messaggio_ponte true',
  'true', (SELECT c.ha_messaggio_ponte::text FROM public.whatsapp_contacts c WHERE c.user_id = :'U'::uuid AND c.phone_e164 = '393330000205'));

-- ═════ 6. Rilanciare la migrazione non spegne un segno già acceso ═══════════
\i :migrazione
SELECT pg_temp.uguale('6 dopo un''altra applicazione della migrazione, i segni accesi restano accesi (201, 204, 301, 205)',
  'true|true|true|true',
  concat_ws('|',
    (SELECT c.ha_messaggio_ponte::text FROM pg_temp.contatto('393330000201') c),
    (SELECT c.ha_messaggio_ponte::text FROM pg_temp.contatto('393330000204') c),
    (SELECT c.ha_messaggio_ponte::text FROM pg_temp.contatto('393330000301') c),
    (SELECT c.ha_messaggio_ponte::text FROM public.whatsapp_contacts c WHERE c.user_id = :'U'::uuid AND c.phone_e164 = '393330000205')));

-- ═════ 7. Il riempimento una tantum segna chi aveva GIÀ messaggi prima della migrazione ═
-- Un contatto nato PRIMA di questa migrazione, con una cronologia baileys scritta
-- direttamente (senza passare da ponte_wa_scrivi): simula un numero che aveva
-- già messaggi del ponte quando questa migrazione è stata applicata la prima volta.
INSERT INTO public.whatsapp_contacts (user_id, phone_e164, last_message_at, ha_messaggio_ponte)
VALUES (:'U'::uuid, '+393330000206', now(), false);
INSERT INTO public.whatsapp_messages (user_id, wa_message_id, direction, from_number, to_number, body, status, canale, created_at)
VALUES (:'U'::uuid, 'bw:393330000206:F7', 'inbound', '+393330000206', 'baileys', 'storico pre-migrazione', 'delivered', 'baileys', now());
\i :migrazione
SELECT pg_temp.uguale('7 riempimento una tantum: un contatto con cronologia baileys già scritta (206) viene segnato',
  'true', (SELECT c.ha_messaggio_ponte::text FROM pg_temp.contatto('393330000206') c));

-- ═════ 8. Il trigger (seconda rete): un INSERT diretto su whatsapp_messages ═════
-- segna un contatto che esiste GIÀ, senza passare da ponte_wa_scrivi.
INSERT INTO public.whatsapp_contacts (user_id, phone_e164, last_message_at, ha_messaggio_ponte)
VALUES (:'U'::uuid, '+393330000207', now(), false);
INSERT INTO public.whatsapp_messages (user_id, wa_message_id, direction, from_number, to_number, body, status, canale, created_at)
VALUES (:'U'::uuid, 'bw:393330000207:F8', 'inbound', '+393330000207', 'baileys', 'diretto', 'delivered', 'baileys', now());
SELECT pg_temp.uguale('8 trigger (seconda rete): INSERT diretto su whatsapp_messages segna il contatto 207 già esistente',
  'true', (SELECT c.ha_messaggio_ponte::text FROM pg_temp.contatto('393330000207') c));
-- Un messaggio normale (canale <> 'baileys') non fa scattare il trigger: nessun contatto toccato per errore.
INSERT INTO public.whatsapp_contacts (user_id, phone_e164, last_message_at, ha_messaggio_ponte)
VALUES (:'U'::uuid, '+393330000208', now(), false);
INSERT INTO public.whatsapp_messages (user_id, wa_message_id, direction, from_number, to_number, body, status, canale, created_at)
VALUES (:'U'::uuid, 'mc-in:flag-208', 'inbound', '+393330000208', 'manychat', 'normale', 'delivered', 'manychat', now());
SELECT pg_temp.uguale('8b un messaggio NON baileys non fa scattare il trigger: 208 resta false', 'false',
  (SELECT c.ha_messaggio_ponte::text FROM pg_temp.contatto('393330000208') c));

-- ═════ 9. anon/authenticated non chiamano il trigger a mano ═════════════════
-- Stesso schema di wa_messaggio_anteprima/wa_contatto_anteprima (chat-veloce.sql):
-- una funzione trigger non ha bisogno di un GRANT a service_role (la invoca il
-- motore a ogni INSERT, non una chiamata SQL diretta); REVOKE da PUBLIC, anon e
-- authenticated basta a impedire che qualcuno la chiami a mano dal browser.
SELECT pg_temp.uguale('9 anon/authenticated non chiamano wa_messaggio_ponte_segno a mano',
  'false false',
  concat_ws(' ',
    has_function_privilege('anon', 'public.wa_messaggio_ponte_segno()', 'EXECUTE')::text,
    has_function_privilege('authenticated', 'public.wa_messaggio_ponte_segno()', 'EXECUTE')::text));

-- ═════ 10. Nessuna scansione nuova: 50.000 righe di cronologia di un numero NON toccato ═
-- Il numero 209 ha 50.000 messaggi baileys storici; la chiamata di prova scrive
-- la chat di un numero DIVERSO (210). Il piano d'esecuzione non deve mostrare
-- un Seq Scan o un Index Scan su whatsapp_messages per la parte nuova (il
-- trigger fa solo un UPDATE sull'indice unico di whatsapp_contacts; la query
-- del passo 3 di ponte_wa_scrivi lavora su v_inseriti, non su tutta la tabella).
INSERT INTO public.whatsapp_messages (user_id, wa_message_id, direction, from_number, to_number, body, status, canale, created_at)
SELECT :'U'::uuid, 'bw:393330000209:H' || g, 'inbound', '+393330000209', 'baileys', 'storico ' || g, 'delivered', 'baileys',
       now() - (g || ' seconds')::interval
  FROM generate_series(1, 50000) g;
CREATE TEMP TABLE _piano (testo text);
DO $do$
DECLARE
  riga  text;
  tutto text := '';
  v_u   uuid := '00000000-0000-4000-8000-0000000000f1';
  v_righe jsonb := jsonb_build_array(pg_temp.riga('bw:393330000210:F10', '393330000210', 'in', extract(epoch FROM now()), 'numero nuovo', true));
BEGIN
  FOR riga IN EXECUTE 'EXPLAIN (ANALYZE, BUFFERS) SELECT public.ponte_wa_scrivi($1, $2, ''[]''::jsonb, ''{}''::jsonb)'
              USING v_u, v_righe
  LOOP
    tutto := tutto || riga || E'\n';
  END LOOP;
  INSERT INTO _piano VALUES (tutto);
END $do$;
SELECT testo AS piano FROM _piano \gset
\echo :piano
SELECT pg_temp.uguale('10 nessun Seq Scan né Index Scan su whatsapp_messages nel piano (la tabella da 50.000 righe non viene scandita)',
  'false', (:'piano' ~ '(Seq Scan|Index Scan)[^\n]*whatsapp_messages')::text);
SELECT pg_temp.uguale('10 il numero 209 (toccato per niente da questa chiamata) resta con la sua cronologia intatta',
  '50000', (SELECT count(*)::text FROM public.whatsapp_messages WHERE wa_message_id LIKE 'bw:393330000209:%'));

\echo 'TUTTI I CONTROLLI DEL SEGNO HA_MESSAGGIO_PONTE PASSANO (ora ROLLBACK: nel database non resta niente)'
ROLLBACK;
