-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DEL PONTE WHATSAPP SU UN POSTGRES VERO (T1, commessa
-- 2026-10-29-ponte-whatsapp-baileys, PIANO §e e §g)
--
-- NON entra in `npm test` e NON si lancia sul database di produzione: serve un
-- database di prova con le migrazioni applicate in ordine (`supabase start`
-- va bene: ha già auth.users, auth.uid() e i ruoli anon, authenticated,
-- service_role). Istruzioni e uscita attesa: prove/sql/LEGGIMI.md.
--
--   psql "$DB" -f prove/sql/ponte-wa.sql        (dalla radice del repo)
--
-- Tutto gira dentro UNA transazione che finisce con ROLLBACK: la migrazione
-- (applicata due volte) e i dati di prova spariscono alla fine. Al primo
-- controllo sbagliato si ferma con «KO <nome>: atteso …, avuto …».
-- Le funzioni si chiamano con le forme JSON CONGELATE in src/crm/ponte/tipi.ts:
-- p_righe = [{k, n, d, t, x, e, m, s}], p_pari = [{k, crm}], p_nomi = {cifre:
-- nome}, ingresso dei candidati = [{k, n, d, t}].
--
-- Dati inventati: utenti, numeri, nomi e id non esistono.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
\set migrazione 'supabase/migrations/20261029120000_ponte_whatsapp.sql'
\set U  '00000000-0000-4000-8000-0000000000b1'
\set U2 '00000000-0000-4000-8000-0000000000b2'
\set C_OK    '00000000-0000-4000-8000-00000000d001'
\set C_FAIL  '00000000-0000-4000-8000-00000000d002'
\set C_CLOUD '00000000-0000-4000-8000-00000000d003'
\set C_ALTRO '00000000-0000-4000-8000-00000000d004'

BEGIN;

-- ── La migrazione, due volte di seguito ──────────────────────────────────────
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

-- Orari: t0 = un'ora fa; t_out = un minuto fa (D8 vale solo per gli ultimi 7 giorni).
SELECT extract(epoch FROM date_trunc('second', now()))::bigint - 3600 AS t0,
       extract(epoch FROM date_trunc('second', now()))::bigint - 60   AS t_out \gset

-- ── Il mondo di prova ────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email) VALUES
  (:'U'::uuid,  'prova-ponte-1@example.invalid'),
  (:'U2'::uuid, 'prova-ponte-2@example.invalid')
ON CONFLICT (id) DO NOTHING;
-- 393330000101: noto solo per la scheda (ultime 9 cifre, scritte con spazi).
INSERT INTO public.crm_leads (user_id, data)
VALUES (:'U'::uuid, '{"nome":"Prova","cognome":"Uno","telefono":"+39 333 000 0101"}');
-- 393330000202: contatto ManyChat con tutti i campi che il ponte NON deve toccare.
-- 393330000303: contatto creato dal ponte → NON noto. 393330000404: senza «+» → noto.
INSERT INTO public.whatsapp_contacts
  (user_id, phone_e164, lead_id, display_name, last_message_at, unread_count,
   ultimo_in_entrata_il, ultimo_in_entrata_anteprima, risposto_il, subscriber_id, non_scrivere_dal, origine)
VALUES
  (:'U'::uuid, '+393330000202', '00000000-0000-4000-8000-00000000c202', NULL, '2026-10-01 10:00+00', 3,
   '2026-10-01 10:00+00', 'ciao', NULL, 'sub-prova', '2026-09-01 00:00+00', NULL),
  (:'U'::uuid, '+393330000303', NULL, 'Fornitore', '2026-10-01 10:00+00', 0, NULL, NULL, NULL, NULL, NULL, 'baileys'),
  (:'U'::uuid, '393330000404',  NULL, NULL, '2026-10-01 10:00+00', 0, NULL, NULL, NULL, NULL, NULL, NULL);
-- Le righe del CRM: ManyChat «Ok», un invio fallito, il Cloud senza «+» (l'altro
-- lato è il phone_number_id), e un «Ok» di un altro utente.
INSERT INTO public.whatsapp_messages (id, user_id, wa_message_id, direction, from_number, to_number, body, status, canale, created_at) VALUES
  (:'C_OK'::uuid,    :'U'::uuid,  'mc-in:prova-1', 'inbound',  '+393330000202', 'manychat',      'Ok',   'delivered', 'manychat', to_timestamp(:t0)),
  (:'C_FAIL'::uuid,  :'U'::uuid,  'mc:prova-2',    'outbound', 'manychat',      '+393330000202', 'Ciao', 'failed',    'manychat', to_timestamp(:t0 + 10)),
  (:'C_CLOUD'::uuid, :'U'::uuid,  'wamid.prova-3', 'inbound',  '393330000202',  '1234567890',    'Ok',   'delivered', NULL,       to_timestamp(:t0 + 20)),
  (:'C_ALTRO'::uuid, :'U2'::uuid, 'mc-in:prova-4', 'inbound',  '+393330000202', 'manychat',      'Ok',   'delivered', 'manychat', to_timestamp(:t0));
CREATE TEMP TABLE prima AS SELECT * FROM public.whatsapp_contacts WHERE user_id = :'U'::uuid;

-- ── ponte_wa_noti (D7) ───────────────────────────────────────────────────────
SELECT pg_temp.uguale('noti: scheda (9 cifre), contatto col «+» e senza; mai quello creato dal ponte, mai uno sconosciuto o non cifre',
  '{393330000101,393330000202,393330000404}',
  public.ponte_wa_noti(:'U'::uuid, ARRAY['393330000101', '393330000202', '393330000303', '393330000404', '393330000505', 'abc'])::text);
SELECT pg_temp.uguale('noti: un altro utente non conosce questi numeri', '{}',
  public.ponte_wa_noti(:'U2'::uuid, ARRAY['393330000101', '393330000404'])::text);

-- ── ponte_wa_candidati (§c1.1-4) ─────────────────────────────────────────────
SELECT pg_temp.uguale('candidati: A1 trova ManyChat e Cloud senza «+»; il fallito, l''altro utente e un orario a 6 minuti no',
  'bw:393330000202:PROVAA1=' || :'C_OK' || ',bw:393330000202:PROVAA1=' || :'C_CLOUD',
  (SELECT string_agg(c.k || '=' || c.id, ',' ORDER BY c.k, c.id)
     FROM public.ponte_wa_candidati(:'U'::uuid, jsonb_build_array(
       jsonb_build_object('k', 'bw:393330000202:PROVAA1', 'n', '393330000202', 'd', 'in',  't', :t0 + 5),
       jsonb_build_object('k', 'bw:393330000202:PROVAA3', 'n', '393330000202', 'd', 'out', 't', :t0 + 10),
       jsonb_build_object('k', 'bw:393330000202:PROVAA9', 'n', '393330000202', 'd', 'in',  't', :t0 + 400))) c));
-- Come clienteCrm di pari.ts: le cifre intere, anche se il numero è salvato con spazi.
INSERT INTO public.whatsapp_messages (user_id, wa_message_id, direction, from_number, to_number, body, status, canale, created_at)
VALUES (:'U'::uuid, 'wamid.prova-5', 'outbound', '1234567890', '+39 333 000 0202', repeat('x', 1500), 'sent', NULL, to_timestamp(:t0 + 1000));
SELECT pg_temp.uguale('candidati: numero salvato con spazi trovato (cifre intere), body tagliato a 1200; un numero che finisce uguale no',
  'bw:393330000202:PROVAA8=1200|',
  (SELECT string_agg(c.k || '=' || length(c.body), ',' ORDER BY c.k)
     FROM public.ponte_wa_candidati(:'U'::uuid, jsonb_build_array(
       jsonb_build_object('k', 'bw:393330000202:PROVAA8', 'n', '393330000202', 'd', 'out', 't', :t0 + 1000),
       jsonb_build_object('k', 'bw:3330000202:PROVAA7',   'n', '3330000202',   'd', 'out', 't', :t0 + 1000))) c) || '|');
SELECT pg_temp.uguale('candidati: le colonne di CandidatoCrm, body tagliato a 1200',
  'inbound|Ok|manychat',
  (SELECT c.direction || '|' || c.body || '|' || c.canale
     FROM public.ponte_wa_candidati(:'U'::uuid, jsonb_build_array(
       jsonb_build_object('k', 'bw:393330000202:PROVAA1', 'n', '393330000202', 'd', 'in', 't', :t0 + 5))) c
    WHERE c.id = :'C_OK'::uuid));

-- ── ponte_wa_scrivi, primo lotto ─────────────────────────────────────────────
-- A1 e A2 hanno lo STESSO pari (C_OK): la prima lo prende, la seconda trova
-- l'indice unico, resta visibile e conta in pari_persi. A3 è uscita dal
-- telefono un minuto fa (effetto D8). A4 è di un numero noto solo per la scheda.
CREATE TEMP TABLE lotto AS SELECT
  jsonb_build_array(
    jsonb_build_object('k', 'bw:393330000202:PROVAA1', 'n', '393330000202', 'd', 'in',  't', :t0 + 5,  'x', 'Ok',            'e', false, 'm', NULL,   's', 'delivered'),
    jsonb_build_object('k', 'bw:393330000202:PROVAA2', 'n', '393330000202', 'd', 'in',  't', :t0 + 30, 'x', 'Ok',            'e', false, 'm', NULL,   's', 'delivered'),
    jsonb_build_object('k', 'bw:393330000202:PROVAA3', 'n', '393330000202', 'd', 'out', 't', :t_out,   'x', 'Arrivo alle 5', 'e', true,  'm', NULL,   's', 'sent'),
    jsonb_build_object('k', 'bw:393330000101:PROVAA4', 'n', '393330000101', 'd', 'in',  't', :t0 + 40, 'x', '📷 Foto',       'e', false, 'm', 'foto', 's', 'delivered')
  ) AS righe,
  jsonb_build_array(
    jsonb_build_object('k', 'bw:393330000202:PROVAA1', 'crm', :'C_OK'),
    jsonb_build_object('k', 'bw:393330000202:PROVAA2', 'crm', :'C_OK')
  ) AS pari,
  jsonb_build_object('393330000202', 'Prova Due', '393330000101', 'Prova Uno') AS nomi;

SELECT pg_temp.uguale('scrivi 1: 4 nuove, 1 doppione, 1 pari perso, 1 contatto nuovo, 1 risposto',
  '{"nuovi": 4, "doppioni": 1, "risposto": 1, "pari_persi": 1, "gia_presenti": 0, "contatti_nuovi": 1}'::jsonb::text,
  (SELECT public.ponte_wa_scrivi(:'U'::uuid, l.righe, l.pari, l.nomi)::text FROM lotto l));

SELECT pg_temp.uguale('A1 nascosta come doppione di C_OK; A2 (stesso candidato) resta visibile',
  :'C_OK' || '|-',
  (SELECT string_agg(coalesce(w.duplicato_di::text, '-'), '|' ORDER BY w.wa_message_id)
     FROM public.whatsapp_messages w
    WHERE w.wa_message_id IN ('bw:393330000202:PROVAA1', 'bw:393330000202:PROVAA2')));
SELECT pg_temp.uguale('le righe come nel §0: lato cliente col «+», l''altro «baileys», canale, stato, media, orario vero',
  'bw:393330000101:PROVAA4 inbound +393330000101>baileys baileys delivered foto true'
  || ',bw:393330000202:PROVAA1 inbound +393330000202>baileys baileys delivered - true'
  || ',bw:393330000202:PROVAA3 outbound baileys>+393330000202 baileys sent - true',
  (SELECT string_agg(concat_ws(' ', w.wa_message_id, w.direction, w.from_number || '>' || w.to_number, w.canale,
                               w.status, coalesce(w.media_type, '-'),
                               (w.created_at = to_timestamp(CASE w.wa_message_id
                                  WHEN 'bw:393330000101:PROVAA4' THEN :t0 + 40
                                  WHEN 'bw:393330000202:PROVAA1' THEN :t0 + 5
                                  ELSE :t_out END))::text), ',' ORDER BY w.wa_message_id)
     FROM public.whatsapp_messages w
    WHERE w.wa_message_id IN ('bw:393330000101:PROVAA4', 'bw:393330000202:PROVAA1', 'bw:393330000202:PROVAA3')));
SELECT pg_temp.uguale('contatto esistente: non letti, ultima entrata, anteprima, scheda, id ManyChat, STOP, origine IDENTICI',
  (SELECT concat_ws('|', p.unread_count, p.ultimo_in_entrata_il, p.ultimo_in_entrata_anteprima, p.lead_id,
                    p.subscriber_id, p.non_scrivere_dal, coalesce(p.origine, '-'))
     FROM prima p WHERE p.phone_e164 = '+393330000202'),
  (SELECT concat_ws('|', c.unread_count, c.ultimo_in_entrata_il, c.ultimo_in_entrata_anteprima, c.lead_id,
                    c.subscriber_id, c.non_scrivere_dal, coalesce(c.origine, '-'))
     FROM public.whatsapp_contacts c WHERE c.user_id = :'U'::uuid AND c.phone_e164 = '+393330000202'));
SELECT pg_temp.uguale('contatto esistente: last_message_at e risposto_il all''orario vero dell''uscita (D8), nome solo perché era vuoto',
  'true|true|Prova Due',
  (SELECT concat_ws('|', (c.last_message_at = to_timestamp(:t_out))::text, (c.risposto_il = to_timestamp(:t_out))::text, c.display_name)
     FROM public.whatsapp_contacts c WHERE c.user_id = :'U'::uuid AND c.phone_e164 = '+393330000202'));
SELECT pg_temp.uguale('contatto nuovo: col «+», origine baileys, 0 non letti, nessuna scheda, nessuna entrata, nessun risposto',
  '+393330000101|baileys|0|-|-|-|Prova Uno|true',
  (SELECT concat_ws('|', c.phone_e164, c.origine, c.unread_count, coalesce(c.lead_id::text, '-'),
                    coalesce(c.ultimo_in_entrata_il::text, '-'), coalesce(c.risposto_il::text, '-'), c.display_name,
                    (c.last_message_at = to_timestamp(:t0 + 40))::text)
     FROM public.whatsapp_contacts c WHERE c.user_id = :'U'::uuid AND c.phone_e164 IN ('+393330000101', '393330000101')));
SELECT pg_temp.uguale('noti dopo il lotto: 101 resta noto per la scheda, 303 (creato dal ponte) resta non noto',
  '{393330000101}',
  public.ponte_wa_noti(:'U'::uuid, ARRAY['393330000101', '393330000303'])::text);
SELECT pg_temp.uguale('le righe del ponte non sono mai candidate; C_OK ormai preso da A1 non torna',
  'bw:393330000202:PROVAA1=' || :'C_CLOUD',
  (SELECT string_agg(c.k || '=' || c.id, ',' ORDER BY c.k, c.id)
     FROM public.ponte_wa_candidati(:'U'::uuid, jsonb_build_array(
       jsonb_build_object('k', 'bw:393330000202:PROVAA1', 'n', '393330000202', 'd', 'in',  't', :t0 + 5),
       jsonb_build_object('k', 'bw:393330000202:PROVAA3', 'n', '393330000202', 'd', 'out', 't', :t_out))) c));

-- ── Lo stesso lotto di nuovo (ritentativo dopo un timeout) ───────────────────
CREATE TEMP TABLE dopo1 AS SELECT ctid AS riga, * FROM public.whatsapp_contacts WHERE user_id = :'U'::uuid;
SELECT pg_temp.uguale('scrivi 2 (stesso lotto): niente di nuovo; il pari di A2 resta perso',
  '{"nuovi": 0, "doppioni": 0, "risposto": 0, "pari_persi": 1, "gia_presenti": 4, "contatti_nuovi": 0}'::jsonb::text,
  (SELECT public.ponte_wa_scrivi(:'U'::uuid, l.righe, l.pari, l.nomi)::text FROM lotto l));
SELECT pg_temp.uguale('scrivi 2: righe del ponte sempre 4, contatti non riscritti (stessa versione della riga)',
  '4|0',
  (SELECT count(*) FROM public.whatsapp_messages WHERE user_id = :'U'::uuid AND canale = 'baileys')::text || '|' ||
  (SELECT count(*) FROM (SELECT d.riga FROM dopo1 d EXCEPT SELECT c.ctid FROM public.whatsapp_contacts c WHERE c.user_id = :'U'::uuid) x)::text);

-- ── Due coppie sullo stesso candidato, in due richieste ──────────────────────
-- (la corsa del revisore: un'altra richiesta ha già preso C_OK)
SELECT pg_temp.uguale('scrivi 3: A5 col pari già preso da A1 → scritta visibile, pari_persi 1',
  '{"nuovi": 1, "doppioni": 0, "risposto": 0, "pari_persi": 1, "gia_presenti": 0, "contatti_nuovi": 0}'::jsonb::text,
  public.ponte_wa_scrivi(:'U'::uuid,
    jsonb_build_array(jsonb_build_object('k', 'bw:393330000202:PROVAA5', 'n', '393330000202', 'd', 'in', 't', :t0 + 10,
                                         'x', 'Ok', 'e', false, 'm', NULL, 's', 'delivered')),
    jsonb_build_array(jsonb_build_object('k', 'bw:393330000202:PROVAA5', 'crm', :'C_OK')),
    '{}'::jsonb)::text);
SELECT pg_temp.uguale('C_OK è pari di una riga sola; A5 visibile',
  '1|-',
  (SELECT count(*) FROM public.whatsapp_messages WHERE duplicato_di = :'C_OK'::uuid)::text || '|' ||
  (SELECT coalesce(duplicato_di::text, '-') FROM public.whatsapp_messages WHERE wa_message_id = 'bw:393330000202:PROVAA5'));

SELECT pg_temp.uguale('A5 è più vecchia di last_message_at ma il contatto si riscrive (updated_at, richiesta di T7); last_message_at non torna indietro',
  'true|true|true',
  (SELECT concat_ws('|',
     (c.ctid <> (SELECT d.riga FROM dopo1 d WHERE d.phone_e164 = '+393330000202'))::text,
     (c.updated_at = now())::text,
     (c.last_message_at = to_timestamp(:t_out))::text)
     FROM public.whatsapp_contacts c WHERE c.user_id = :'U'::uuid AND c.phone_e164 = '+393330000202'));

-- ── Il controllo tardivo (righe vuote, solo pari) ────────────────────────────
-- A2 ↔ C_CLOUD vale; A3 ↔ C_FAIL (invio fallito) e A4 ↔ C_ALTRO (altro utente) no.
SELECT pg_temp.uguale('scrivi 4: un pari tardivo scritto; fallito e altro utente ignorati',
  '{"nuovi": 0, "doppioni": 1, "risposto": 0, "pari_persi": 0, "gia_presenti": 0, "contatti_nuovi": 0}'::jsonb::text,
  public.ponte_wa_scrivi(:'U'::uuid, '[]'::jsonb,
    jsonb_build_array(
      jsonb_build_object('k', 'bw:393330000202:PROVAA2', 'crm', :'C_CLOUD'),
      jsonb_build_object('k', 'bw:393330000202:PROVAA3', 'crm', :'C_FAIL'),
      jsonb_build_object('k', 'bw:393330000101:PROVAA4', 'crm', :'C_ALTRO')),
    '{}'::jsonb)::text);
SELECT pg_temp.uguale('A2 → C_CLOUD; A3 e A4 restano visibili; C_FAIL non è mai pari',
  :'C_CLOUD' || '|-|-|0',
  (SELECT coalesce(duplicato_di::text, '-') FROM public.whatsapp_messages WHERE wa_message_id = 'bw:393330000202:PROVAA2') || '|' ||
  (SELECT coalesce(duplicato_di::text, '-') FROM public.whatsapp_messages WHERE wa_message_id = 'bw:393330000202:PROVAA3') || '|' ||
  (SELECT coalesce(duplicato_di::text, '-') FROM public.whatsapp_messages WHERE wa_message_id = 'bw:393330000101:PROVAA4') || '|' ||
  (SELECT count(*) FROM public.whatsapp_messages WHERE duplicato_di = :'C_FAIL'::uuid)::text);

-- ── Righe storte: si saltano o si correggono, il lotto passa ─────────────────
SELECT pg_temp.uguale('scrivi 5: ts nel futuro, numero non di cifre, chiave d''un altro numero e testo vuoto saltati; stato e tipo fuori lista corretti',
  '{"nuovi": 1, "doppioni": 0, "risposto": 0, "pari_persi": 0, "gia_presenti": 0, "contatti_nuovi": 0}'::jsonb::text,
  public.ponte_wa_scrivi(:'U'::uuid, jsonb_build_array(
      jsonb_build_object('k', 'bw:393330000202:PROVAB1', 'n', '393330000202', 'd', 'out', 't', :t_out + 7200, 'x', 'futuro', 'e', false, 'm', NULL, 's', 'sent'),
      jsonb_build_object('k', 'bw:3933abc:PROVAB2',      'n', '3933abc',      'd', 'in',  't', :t0,          'x', 'no',     'e', false, 'm', NULL, 's', 'delivered'),
      jsonb_build_object('k', 'bw:393330000999:PROVAB3', 'n', '393330000202', 'd', 'in',  't', :t0,          'x', 'no',     'e', false, 'm', NULL, 's', 'delivered'),
      jsonb_build_object('k', 'bw:393330000202:PROVAB4', 'n', '393330000202', 'd', 'in',  't', :t0,          'x', '',       'e', false, 'm', NULL, 's', 'delivered'),
      jsonb_build_object('k', 'bw:393330000202:PROVAB5', 'n', '393330000202', 'd', 'out', 't', :t0 + 50,     'x', 'strano', 'e', false, 'm', 'boh', 's', 'boh')),
    '[]'::jsonb, '{}'::jsonb)::text);
SELECT pg_temp.uguale('B5: stato «sent», nessun media_type', 'sent|-',
  (SELECT status || '|' || coalesce(media_type, '-') FROM public.whatsapp_messages WHERE wa_message_id = 'bw:393330000202:PROVAB5'));

-- ── Chi può fare cosa ────────────────────────────────────────────────────────
SELECT pg_temp.uguale('anon e authenticated non eseguono le tre funzioni; service_role sì',
  'false false false false false false true true true',
  concat_ws(' ',
    has_function_privilege('anon', 'public.ponte_wa_noti(uuid, text[])', 'EXECUTE')::text,
    has_function_privilege('anon', 'public.ponte_wa_candidati(uuid, jsonb)', 'EXECUTE')::text,
    has_function_privilege('anon', 'public.ponte_wa_scrivi(uuid, jsonb, jsonb, jsonb)', 'EXECUTE')::text,
    has_function_privilege('authenticated', 'public.ponte_wa_noti(uuid, text[])', 'EXECUTE')::text,
    has_function_privilege('authenticated', 'public.ponte_wa_candidati(uuid, jsonb)', 'EXECUTE')::text,
    has_function_privilege('authenticated', 'public.ponte_wa_scrivi(uuid, jsonb, jsonb, jsonb)', 'EXECUTE')::text,
    has_function_privilege('service_role', 'public.ponte_wa_noti(uuid, text[])', 'EXECUTE')::text,
    has_function_privilege('service_role', 'public.ponte_wa_candidati(uuid, jsonb)', 'EXECUTE')::text,
    has_function_privilege('service_role', 'public.ponte_wa_scrivi(uuid, jsonb, jsonb, jsonb)', 'EXECUTE')::text));

INSERT INTO public.ponte_wa_stato (user_id, stato) VALUES (:'U'::uuid, 'collegato');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true),
       set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b1', true) \gset
SET LOCAL ROLE authenticated;
SELECT count(*) AS vede_suo FROM public.ponte_wa_stato \gset
-- authenticated non scrive in ponte_wa_stato e non chiama le funzioni.
DO $d$
DECLARE n int;
BEGIN
  BEGIN
    INSERT INTO public.ponte_wa_stato (user_id, stato) VALUES ('00000000-0000-4000-8000-0000000000b1', 'errore');
    RAISE EXCEPTION 'KO authenticated scrive in ponte_wa_stato';
  EXCEPTION WHEN insufficient_privilege OR unique_violation THEN NULL;
  END;
  BEGIN
    INSERT INTO public.ponte_wa_stato (user_id, stato) VALUES ('00000000-0000-4000-8000-0000000000b2', 'errore');
    RAISE EXCEPTION 'KO authenticated crea righe in ponte_wa_stato';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.ponte_wa_stato SET stato = 'errore';
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN RAISE EXCEPTION 'KO authenticated aggiorna ponte_wa_stato'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.ponte_wa_scrivi('00000000-0000-4000-8000-0000000000b1', '[]'::jsonb, '[]'::jsonb, '{}'::jsonb);
    RAISE EXCEPTION 'KO authenticated chiama ponte_wa_scrivi';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $d$;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true),
       set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b2', true) \gset
SELECT count(*) AS vede_altrui FROM public.ponte_wa_stato \gset
RESET ROLE;
SELECT pg_temp.uguale('ponte_wa_stato: authenticated vede la sua riga, non quella di un altro, non scrive',
  '1|0|collegato|1',
  concat_ws('|', :vede_suo, :vede_altrui,
            (SELECT stato FROM public.ponte_wa_stato WHERE user_id = :'U'::uuid),
            (SELECT count(*) FROM public.ponte_wa_stato)));

\echo 'TUTTI I CONTROLLI DEL PONTE PASSANO (ora ROLLBACK: nel database non resta niente)'
ROLLBACK;
