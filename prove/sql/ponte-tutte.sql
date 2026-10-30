-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DI «TUTTE LE CHAT» SU UN POSTGRES VERO (commessa
-- 2026-10-30-ponte-tutte-le-chat, Blocco 1, T4)
--
-- NON entra in `npm test` e NON si lancia sul database di produzione: serve un
-- database di prova con le migrazioni applicate in ordine (`supabase start` va
-- bene). La migrazione nuova la applica lo script stesso, DUE volte, dopo
-- quella del ponte. Istruzioni e uscita attesa: prove/sql/LEGGIMI.md.
--
--   psql "$DB" -f prove/sql/ponte-tutte.sql        (dalla radice del repo)
--
-- Tutto gira dentro UNA transazione che finisce con ROLLBACK. Al primo
-- controllo sbagliato si ferma con «KO <nome>: atteso …, avuto …».
-- Dentro la transazione now() è FERMO: l'attesa dei 120 secondi si prova con
-- p_attesa_s = 0 (promuove subito) e riscrivendo attesa_dal.
--
-- Dati inventati: utenti, numeri, nomi e id non esistono.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
\set mig_ponte 'supabase/migrations/20261029120000_ponte_whatsapp.sql'
\set migrazione 'supabase/migrations/20261030160000_ponte_tutte_le_chat.sql'
\set U  '00000000-0000-4000-8000-0000000000c1'
\set U2 '00000000-0000-4000-8000-0000000000c2'
\set M2 '00000000-0000-4000-8000-00000000e002'
\set M3 '00000000-0000-4000-8000-00000000e003'
\set M4 '00000000-0000-4000-8000-00000000e004'
\set M7 '00000000-0000-4000-8000-00000000e007'

BEGIN;

-- ── Le migrazioni: quella del ponte, poi la nuova DUE volte ──────────────────
\i :mig_ponte
\i :migrazione
\i :migrazione
\echo 'ok  migrazione applicata due volte senza errori'

-- Gli oggetti JSON dentro un testo si confrontano nella forma canonica di jsonb
-- (l'ordine delle chiavi non conta): atteso e avuto passano da qui.
CREATE FUNCTION pg_temp.norma(t text) RETURNS text
LANGUAGE plpgsql AS $f$
DECLARE
  m text[];
  r text := t;
BEGIN
  FOR m IN SELECT regexp_matches(t, '\{[^{}]*\}', 'g') LOOP
    r := replace(r, m[1], m[1]::jsonb::text);
  END LOOP;
  RETURN r;
END $f$;

CREATE FUNCTION pg_temp.uguale(nome text, atteso text, avuto text) RETURNS text
LANGUAGE plpgsql AS $f$
BEGIN
  IF pg_temp.norma(atteso) IS DISTINCT FROM pg_temp.norma(avuto) THEN
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

-- Il contatto di un numero (col «+»), per i controlli.
CREATE FUNCTION pg_temp.contatto(n text) RETURNS public.whatsapp_contacts
LANGUAGE sql AS $f$
  SELECT c FROM public.whatsapp_contacts c
   WHERE c.user_id = '00000000-0000-4000-8000-0000000000c1'::uuid AND c.phone_e164 = '+' || n
$f$;

SELECT extract(epoch FROM date_trunc('second', now()))::bigint - 3600 AS t0,
       extract(epoch FROM date_trunc('second', now()))::bigint - 60   AS t_in,
       extract(epoch FROM date_trunc('second', now()))::bigint - 30   AS t_out \gset

-- ── Il mondo di prova ────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email) VALUES
  (:'U'::uuid,  'prova-tutte-1@example.invalid'),
  (:'U2'::uuid, 'prova-tutte-2@example.invalid')
ON CONFLICT (id) DO NOTHING;
-- 101: lead con scheda e tutti i campi che il ponte NON deve toccare; il nome è vuoto.
-- 106 e 107: già contatti del ponte (origine baileys, senza scheda), uno col nome già scritto.
INSERT INTO public.whatsapp_contacts
  (user_id, phone_e164, lead_id, display_name, last_message_at, unread_count,
   ultimo_in_entrata_il, ultimo_in_entrata_anteprima, risposto_il, subscriber_id, non_scrivere_dal, origine)
VALUES
  (:'U'::uuid, '+393330000101', '00000000-0000-4000-8000-00000000c101', NULL, '2026-10-01 10:00+00', 2,
   '2026-10-01 10:00+00', 'ciao', NULL, 'sub-prova', '2026-09-01 00:00+00', NULL),
  (:'U'::uuid, '+393330000106', NULL, NULL, '2026-10-01 10:00+00', 0, NULL, NULL, NULL, NULL, NULL, 'baileys'),
  (:'U'::uuid, '+393330000107', NULL, 'Già Nominato', '2026-10-01 10:00+00', 0, NULL, NULL, NULL, NULL, NULL, 'baileys');
-- Le righe del CRM che faranno da pari: ManyChat per 502 e 503, il Cloud (canale vuoto) per 504.
INSERT INTO public.whatsapp_messages (id, user_id, wa_message_id, direction, from_number, to_number, body, status, canale, created_at) VALUES
  (:'M2'::uuid, :'U'::uuid, 'mc-in:tutte-2', 'inbound', '+393330000502', 'manychat', 'Ok', 'delivered', 'manychat', to_timestamp(:t_in)),
  (:'M3'::uuid, :'U'::uuid, 'mc-in:tutte-3', 'inbound', '+393330000503', 'manychat', 'Ok', 'delivered', 'manychat', to_timestamp(:t_in)),
  (:'M4'::uuid, :'U'::uuid, 'wamid.tutte-4', 'inbound', '393330000504',  '1234567890', 'Ok', 'delivered', NULL,       to_timestamp(:t_in));
CREATE TEMP TABLE prima AS SELECT * FROM public.whatsapp_contacts WHERE user_id = :'U'::uuid;

-- ═════ 1. Uno sconosciuto che scrive adesso (D7 tolta, D9 cambiata) ══════════
SELECT pg_temp.uguale('1 scrivi: vivo in da un numero MAI visto → 1 riga, 1 contatto nuovo',
  '{"nuovi": 1, "doppioni": 0, "risposto": 0, "pari_persi": 0, "gia_presenti": 0, "contatti_nuovi": 1}'::jsonb::text,
  public.ponte_wa_scrivi(:'U'::uuid,
    jsonb_build_array(pg_temp.riga('bw:393330000501:T1', '393330000501', 'in', :t_in, 'Buongiorno, ci siete?', true)),
    '[]'::jsonb, jsonb_build_object('393330000501', 'Mario Profilo'))::text);
SELECT pg_temp.uguale('1 contatto: origine baileys, senza scheda, 0 non letti, nessuna entrata, NOME NON SALVATO (E7)',
  '+393330000501|baileys|-|0|-|-|-',
  (SELECT concat_ws('|', c.phone_e164, c.origine, coalesce(c.lead_id::text, '-'), c.unread_count,
                    coalesce(c.ultimo_in_entrata_il::text, '-'), coalesce(c.display_name, '-'), coalesce(c.risposto_il::text, '-'))
     FROM pg_temp.contatto('393330000501') c));
SELECT pg_temp.uguale('1 riga: attesa_dal = adesso, non ancora promossa, senza pari',
  'true|true|true',
  (SELECT concat_ws('|', (w.attesa_dal = now())::text, (w.promosso_il IS NULL)::text, (w.duplicato_di IS NULL)::text)
     FROM public.whatsapp_messages w WHERE w.wa_message_id = 'bw:393330000501:T1'));
SELECT pg_temp.uguale('1 promuovi(120) subito dopo: nulla (non sono passati 120 secondi)',
  '{"promosse": 0, "saltate": 0}'::jsonb::text, public.ponte_wa_promuovi(:'U'::uuid, 120)::text);
UPDATE public.whatsapp_messages SET attesa_dal = now() - interval '100 seconds' WHERE wa_message_id = 'bw:393330000501:T1';
SELECT pg_temp.uguale('1 promuovi(120) a 100 secondi: ancora nulla',
  '{"promosse": 0, "saltate": 0}'::jsonb::text, public.ponte_wa_promuovi(:'U'::uuid, 120)::text);
UPDATE public.whatsapp_messages SET attesa_dal = now() - interval '130 seconds' WHERE wa_message_id = 'bw:393330000501:T1';
SELECT pg_temp.uguale('1 promuovi(120) a 130 secondi: 1 promossa',
  '{"promosse": 1, "saltate": 0}'::jsonb::text, public.ponte_wa_promuovi(:'U'::uuid, 120)::text);
SELECT pg_temp.uguale('1 contatto dopo: +1 non letti, entrata all''ora VERA del messaggio, anteprima, last_message_at, updated_at; nessuna scheda, nessun nome',
  '1|true|Buongiorno, ci siete?|true|true|-|-',
  (SELECT concat_ws('|', c.unread_count, (c.ultimo_in_entrata_il = to_timestamp(:t_in))::text, c.ultimo_in_entrata_anteprima,
                    (c.last_message_at = to_timestamp(:t_in))::text, (c.updated_at = now())::text,
                    coalesce(c.lead_id::text, '-'), coalesce(c.display_name, '-'))
     FROM pg_temp.contatto('393330000501') c));
SELECT pg_temp.uguale('1 la riga è promossa (promosso_il = adesso)', 'true',
  (SELECT (w.promosso_il = now())::text FROM public.whatsapp_messages w WHERE w.wa_message_id = 'bw:393330000501:T1'));
SELECT pg_temp.uguale('1 promuovi di nuovo: 0 (idempotente), non letti ancora 1',
  '{"promosse": 0, "saltate": 0}|1',
  public.ponte_wa_promuovi(:'U'::uuid, 0)::text || '|' || (SELECT c.unread_count FROM pg_temp.contatto('393330000501') c));
SELECT public.ponte_wa_scrivi(:'U'::uuid,
  jsonb_build_array(pg_temp.riga('bw:393330000501:T1', '393330000501', 'in', :t_in, 'Buongiorno, ci siete?', true)),
  '[]'::jsonb, '{}'::jsonb)::text AS esito \gset
SELECT pg_temp.uguale('1 lo stesso lotto di nuovo: già presente, attesa_dal NON riscritto, non si ripromuove',
  '{"nuovi": 0, "doppioni": 0, "risposto": 0, "pari_persi": 0, "gia_presenti": 1, "contatti_nuovi": 0}|true|{"promosse": 0, "saltate": 0}',
  :'esito'
  || '|' || (SELECT (w.attesa_dal = now() - interval '130 seconds')::text FROM public.whatsapp_messages w WHERE w.wa_message_id = 'bw:393330000501:T1')
  || '|' || public.ponte_wa_promuovi(:'U'::uuid, 0)::text);

-- ═════ 2. Il pari ManyChat trovato PRIMA: mai promossa ═══════════════════════
SELECT public.ponte_wa_scrivi(:'U'::uuid,
  jsonb_build_array(pg_temp.riga('bw:393330000502:T2', '393330000502', 'in', :t_in, 'Ok', true)),
  jsonb_build_array(jsonb_build_object('k', 'bw:393330000502:T2', 'crm', :'M2')), '{}'::jsonb)::text AS esito \gset
SELECT pg_temp.uguale('2 scrivi con pari ManyChat: nasce doppione, senza attesa_dal',
  '{"nuovi": 1, "doppioni": 1, "risposto": 0, "pari_persi": 0, "gia_presenti": 0, "contatti_nuovi": 1}|true',
  :'esito'
  || '|' || (SELECT (w.attesa_dal IS NULL AND w.duplicato_di = :'M2'::uuid)::text FROM public.whatsapp_messages w WHERE w.wa_message_id = 'bw:393330000502:T2'));
SELECT pg_temp.uguale('2 promuovi(0): niente; il contatto resta a 0 non letti, senza entrata',
  '{"promosse": 0, "saltate": 0}|0|-',
  public.ponte_wa_promuovi(:'U'::uuid, 0)::text || '|' || (SELECT c.unread_count FROM pg_temp.contatto('393330000502') c)
  || '|' || (SELECT coalesce(c.ultimo_in_entrata_il::text, '-') FROM pg_temp.contatto('393330000502') c));

-- ═════ 3. Il pari ManyChat arriva DOPO la promozione: ritiro −1, una volta ═══
SELECT public.ponte_wa_scrivi(:'U'::uuid,
  jsonb_build_array(pg_temp.riga('bw:393330000503:T3', '393330000503', 'in', :t_in, 'Ok', true)), '[]'::jsonb, '{}'::jsonb) AS ignora \gset
SELECT pg_temp.uguale('3 promossa prima del pari: non letti 1',
  '{"promosse": 1, "saltate": 0}|1',
  public.ponte_wa_promuovi(:'U'::uuid, 0)::text || '|' || (SELECT c.unread_count FROM pg_temp.contatto('393330000503') c));
-- ManyChat scrive la sua riga (già in M3) e poi fa +1 con la funzione vera.
SELECT public.whatsapp_registra_entrata(:'U'::uuid, '+393330000503', NULL, now(), 'Ok', NULL, NULL) AS ignora \gset
SELECT pg_temp.uguale('3 dopo ManyChat: non letti 2 (la stessa entrata contata due volte)', '2',
  (SELECT c.unread_count::text FROM pg_temp.contatto('393330000503') c));
SELECT public.ponte_wa_scrivi(:'U'::uuid, '[]'::jsonb,
  jsonb_build_array(jsonb_build_object('k', 'bw:393330000503:T3', 'crm', :'M3')), '{}'::jsonb)::text AS esito \gset
SELECT pg_temp.uguale('3 il pari tardivo (controllo del battito): doppione scritto, ritiro → non letti 1, promosso_il vuoto',
  '{"nuovi": 0, "doppioni": 1, "risposto": 0, "pari_persi": 0, "gia_presenti": 0, "contatti_nuovi": 0}|1|true',
  :'esito'
  || '|' || (SELECT c.unread_count FROM pg_temp.contatto('393330000503') c)
  || '|' || (SELECT (w.promosso_il IS NULL AND w.duplicato_di = :'M3'::uuid)::text FROM public.whatsapp_messages w WHERE w.wa_message_id = 'bw:393330000503:T3'));
SELECT public.ponte_wa_scrivi(:'U'::uuid, '[]'::jsonb,
  jsonb_build_array(jsonb_build_object('k', 'bw:393330000503:T3', 'crm', :'M3')), '{}'::jsonb)::text AS esito \gset
SELECT pg_temp.uguale('3 il controllo tardivo rilanciato: nessun secondo −1',
  '{"nuovi": 0, "doppioni": 0, "risposto": 0, "pari_persi": 0, "gia_presenti": 0, "contatti_nuovi": 0}|1',
  :'esito'
  || '|' || (SELECT c.unread_count FROM pg_temp.contatto('393330000503') c));
SELECT pg_temp.uguale('3 ponte_wa_ritira direttamente sulla stessa riga: false, niente cambia',
  'false|1', public.ponte_wa_ritira(:'U'::uuid, (SELECT w.id FROM public.whatsapp_messages w WHERE w.wa_message_id = 'bw:393330000503:T3'))::text
  || '|' || (SELECT c.unread_count FROM pg_temp.contatto('393330000503') c));
SELECT pg_temp.uguale('3 e la riga non viene più promossa (ha il pari)',
  '{"promosse": 0, "saltate": 0}', public.ponte_wa_promuovi(:'U'::uuid, 0)::text);

-- ═════ 4. Il pari è del CLOUD (canale vuoto): nessun ritiro ══════════════════
SELECT public.ponte_wa_scrivi(:'U'::uuid,
  jsonb_build_array(pg_temp.riga('bw:393330000504:T4', '393330000504', 'in', :t_in, 'Ok', true)), '[]'::jsonb, '{}'::jsonb) AS ignora \gset
SELECT public.ponte_wa_promuovi(:'U'::uuid, 0) AS ignora \gset
-- Il webhook Cloud scrive unread_count = 1 ASSOLUTO (non +1): qui il contatto è già a 1.
SELECT public.ponte_wa_scrivi(:'U'::uuid, '[]'::jsonb,
  jsonb_build_array(jsonb_build_object('k', 'bw:393330000504:T4', 'crm', :'M4')), '{}'::jsonb)::text AS esito \gset
SELECT pg_temp.uguale('4 pari Cloud dopo la promozione: doppione scritto, NESSUN ritiro (non letti 1, promosso_il resta)',
  '{"nuovi": 0, "doppioni": 1, "risposto": 0, "pari_persi": 0, "gia_presenti": 0, "contatti_nuovi": 0}|1|true',
  :'esito'
  || '|' || (SELECT c.unread_count FROM pg_temp.contatto('393330000504') c)
  || '|' || (SELECT (w.promosso_il IS NOT NULL AND w.duplicato_di = :'M4'::uuid)::text FROM public.whatsapp_messages w WHERE w.wa_message_id = 'bw:393330000504:T4'));
SELECT pg_temp.uguale('4 ritira su una riga col pari Cloud: false', 'false',
  public.ponte_wa_ritira(:'U'::uuid, (SELECT w.id FROM public.whatsapp_messages w WHERE w.wa_message_id = 'bw:393330000504:T4'))::text);

-- ═════ 5. Lo storico e il resto non diventano mai «nuovi» ════════════════════
SELECT public.ponte_wa_scrivi(:'U'::uuid,
  jsonb_build_array(
    pg_temp.riga('bw:393330000505:S1', '393330000505', 'in',  :t0,     'storico uno', false),
    pg_temp.riga('bw:393330000505:S2', '393330000505', 'out', :t0 + 5, 'storico due', false)),
  '[]'::jsonb, '{}'::jsonb)::text AS esito \gset
SELECT pg_temp.uguale('5 storico (e=false) di un numero mai visto: scritto, contatto nuovo a 0 non letti, nessuna attesa',
  '{"nuovi": 2, "doppioni": 0, "risposto": 0, "pari_persi": 0, "gia_presenti": 0, "contatti_nuovi": 1}|0|-|0',
  :'esito'
  || '|' || (SELECT c.unread_count FROM pg_temp.contatto('393330000505') c)
  || '|' || (SELECT coalesce(c.ultimo_in_entrata_il::text, '-') FROM pg_temp.contatto('393330000505') c)
  || '|' || (SELECT count(*) FROM public.whatsapp_messages w WHERE w.wa_message_id LIKE 'bw:393330000505:%' AND w.attesa_dal IS NOT NULL));
SELECT pg_temp.uguale('5 data vera dello storico (created_at = ts), non adesso',
  'true', (SELECT (w.created_at = to_timestamp(:t0))::text FROM public.whatsapp_messages w WHERE w.wa_message_id = 'bw:393330000505:S1'));
-- e=true ma più vecchio di 7 giorni (entrata), e un'uscita viva (e=true): in nessun caso attesa_dal.
SELECT public.ponte_wa_scrivi(:'U'::uuid,
  jsonb_build_array(
    pg_temp.riga('bw:393330000505:V1', '393330000505', 'in',  extract(epoch FROM now())::bigint - 8 * 86400, 'troppo vecchio', true),
    pg_temp.riga('bw:393330000505:V2', '393330000505', 'out', :t_out, 'risposta dal telefono', true)),
  '[]'::jsonb, '{}'::jsonb) AS ignora \gset
SELECT pg_temp.uguale('5 entrata vecchia di 8 giorni e uscita viva, anche con e=true: scritte, ma senza attesa_dal',
  '2|0',
  (SELECT count(*) FROM public.whatsapp_messages w WHERE w.wa_message_id IN ('bw:393330000505:V1', 'bw:393330000505:V2'))::text
  || '|' || (SELECT count(*) FROM public.whatsapp_messages w WHERE w.wa_message_id IN ('bw:393330000505:V1', 'bw:393330000505:V2') AND w.attesa_dal IS NOT NULL));
SELECT pg_temp.uguale('5 promuovi(0) non muove niente di tutto questo (505 resta a 0 non letti)',
  '{"promosse": 0, "saltate": 0}|0',
  public.ponte_wa_promuovi(:'U'::uuid, 0)::text || '|' || (SELECT c.unread_count FROM pg_temp.contatto('393330000505') c));

-- ═════ 6. Il titolare ha già risposto dal telefono: non si conta ══════════════
SELECT public.ponte_wa_scrivi(:'U'::uuid,
  jsonb_build_array(pg_temp.riga('bw:393330000506:T6', '393330000506', 'in', :t_in, 'domanda', true)), '[]'::jsonb, '{}'::jsonb) AS ignora \gset
UPDATE public.whatsapp_contacts SET risposto_il = to_timestamp(:t_out) WHERE user_id = :'U'::uuid AND phone_e164 = '+393330000506';
SELECT public.ponte_wa_promuovi(:'U'::uuid, 0)::text AS esito \gset
SELECT pg_temp.uguale('6 risposto_il successivo al messaggio: saltata, nessun +1, attesa_dal svuotato',
  '{"promosse": 0, "saltate": 1}|0|-',
  :'esito' || '|' || (SELECT c.unread_count FROM pg_temp.contatto('393330000506') c)
  || '|' || (SELECT coalesce(w.attesa_dal::text, '-') FROM public.whatsapp_messages w WHERE w.wa_message_id = 'bw:393330000506:T6'));

-- ═════ 7. I non letti non scendono mai sotto zero ════════════════════════════
INSERT INTO public.whatsapp_contacts (user_id, phone_e164, last_message_at, unread_count, origine)
VALUES (:'U'::uuid, '+393330000507', now(), 0, 'baileys');
INSERT INTO public.whatsapp_messages (id, user_id, wa_message_id, direction, from_number, to_number, body, status, canale, created_at)
VALUES (:'M7'::uuid, :'U'::uuid, 'mc-in:tutte-7', 'inbound', '+393330000507', 'manychat', 'x', 'delivered', 'manychat', to_timestamp(:t_in));
INSERT INTO public.whatsapp_messages (user_id, wa_message_id, direction, from_number, to_number, body, status, canale, created_at, raw_payload, duplicato_di, promosso_il)
VALUES (:'U'::uuid, 'bw:393330000507:T7', 'inbound', '+393330000507', 'baileys', 'x', 'delivered', 'baileys', to_timestamp(:t_in), '{}'::jsonb, :'M7'::uuid, now());
SELECT public.ponte_wa_ritira(:'U'::uuid, (SELECT w.id FROM public.whatsapp_messages w WHERE w.wa_message_id = 'bw:393330000507:T7'))::text AS esito \gset
SELECT pg_temp.uguale('7 ritiro con non letti già a 0 (il titolare aveva letto): resta 0, mai negativo; promosso_il vuoto',
  'true|0|true',
  :'esito'
  || '|' || (SELECT c.unread_count FROM pg_temp.contatto('393330000507') c)
  || '|' || (SELECT (w.promosso_il IS NULL)::text FROM public.whatsapp_messages w WHERE w.wa_message_id = 'bw:393330000507:T7'));
SELECT pg_temp.uguale('7 ritira su una riga mai promossa o inesistente: false',
  'false|false',
  public.ponte_wa_ritira(:'U'::uuid, (SELECT w.id FROM public.whatsapp_messages w WHERE w.wa_message_id = 'bw:393330000501:T1'))::text
  || '|' || public.ponte_wa_ritira(:'U'::uuid, '00000000-0000-4000-8000-0000000fffff'::uuid)::text);

-- ═════ 8. Il nome del profilo non si salva per gli sconosciuti (E7) ══════════
SELECT public.ponte_wa_scrivi(:'U'::uuid,
  jsonb_build_array(
    pg_temp.riga('bw:393330000106:N1', '393330000106', 'in', :t0, 'ciao', false),
    pg_temp.riga('bw:393330000107:N2', '393330000107', 'in', :t0, 'ciao', false),
    pg_temp.riga('bw:393330000101:N3', '393330000101', 'in', :t0, 'ciao', false)),
  '[]'::jsonb,
  jsonb_build_object('393330000106', 'Nome Profilo', '393330000107', 'Altro Nome', '393330000101', 'Nome Scheda')) AS ignora \gset
SELECT pg_temp.uguale('8 contatto del ponte senza scheda e senza nome (106): il nome NON si scrive', '-',
  (SELECT coalesce(c.display_name, '-') FROM pg_temp.contatto('393330000106') c));
SELECT pg_temp.uguale('8 contatto del ponte che il nome ce l''ha già (107): resta com''è', 'Già Nominato',
  (SELECT c.display_name FROM pg_temp.contatto('393330000107') c));
SELECT pg_temp.uguale('8 contatto con scheda e nome vuoto (101): il nome si scrive come oggi', 'Nome Scheda',
  (SELECT c.display_name FROM pg_temp.contatto('393330000101') c));

-- ═════ 9. La promozione di un lead con scheda: tocca solo le colonne di E3 ═══
-- 101 ha già 2 non letti, un'entrata del 1/10, una scheda, un id ManyChat, uno STOP.
SELECT public.ponte_wa_scrivi(:'U'::uuid,
  jsonb_build_array(pg_temp.riga('bw:393330000101:L1', '393330000101', 'in', :t_in, 'Posso spostare?', true)), '[]'::jsonb, '{}'::jsonb) AS ignora \gset
SELECT pg_temp.uguale('9 lead: promossa', '{"promosse": 1, "saltate": 0}', public.ponte_wa_promuovi(:'U'::uuid, 0)::text);
SELECT pg_temp.uguale('9 lead: non letti 2 → 3, entrata e anteprima all''ora vera del messaggio nuovo',
  '3|true|Posso spostare?',
  (SELECT concat_ws('|', c.unread_count, (c.ultimo_in_entrata_il = to_timestamp(:t_in))::text, c.ultimo_in_entrata_anteprima)
     FROM pg_temp.contatto('393330000101') c));
SELECT pg_temp.uguale('9 lead: scheda, id ManyChat, STOP e risposto_il IDENTICI (il nome l''ha scritto il punto 8, come oggi)',
  (SELECT concat_ws('|', p.lead_id, p.subscriber_id, p.non_scrivere_dal, coalesce(p.risposto_il::text, '-'))
     FROM prima p WHERE p.phone_e164 = '+393330000101'),
  (SELECT concat_ws('|', c.lead_id, c.subscriber_id, c.non_scrivere_dal, coalesce(c.risposto_il::text, '-'))
     FROM pg_temp.contatto('393330000101') c));
-- Una promozione di un messaggio PIÙ VECCHIO dell'ultima entrata già nota: +1 ma entrata e anteprima non tornano indietro.
SELECT public.ponte_wa_scrivi(:'U'::uuid,
  jsonb_build_array(pg_temp.riga('bw:393330000101:L2', '393330000101', 'in', :t_in - 600, 'messaggio più vecchio', true)), '[]'::jsonb, '{}'::jsonb) AS ignora \gset
SELECT public.ponte_wa_promuovi(:'U'::uuid, 0) AS ignora \gset
SELECT pg_temp.uguale('9 un messaggio più vecchio dell''ultima entrata: +1 non letti (4), entrata e anteprima NON tornano indietro',
  '4|true|Posso spostare?',
  (SELECT concat_ws('|', c.unread_count, (c.ultimo_in_entrata_il = to_timestamp(:t_in))::text, c.ultimo_in_entrata_anteprima)
     FROM pg_temp.contatto('393330000101') c));

-- ═════ 10. Contatto assente, attesa scaduta, tetto di 500 ════════════════════
INSERT INTO public.whatsapp_messages (user_id, wa_message_id, direction, from_number, to_number, body, status, canale, created_at, raw_payload, attesa_dal)
VALUES (:'U'::uuid, 'bw:393330000508:A1', 'inbound', '+393330000508', 'baileys', 'senza contatto', 'delivered', 'baileys', to_timestamp(:t_in), '{}'::jsonb, now()),
       (:'U'::uuid, 'bw:393330000509:A2', 'inbound', '+393330000509', 'baileys', 'scaduta', 'delivered', 'baileys', to_timestamp(:t_in), '{}'::jsonb, now() - interval '2 days');
INSERT INTO public.whatsapp_contacts (user_id, phone_e164, last_message_at, unread_count, origine)
VALUES (:'U'::uuid, '+393330000509', now(), 0, 'baileys');
SELECT pg_temp.uguale('10 contatto assente: la riga resta (si ritenta); attesa di 2 giorni fa: mai promossa',
  '{"promosse": 0, "saltate": 0}|true|0',
  public.ponte_wa_promuovi(:'U'::uuid, 0)::text
  || '|' || (SELECT (w.attesa_dal IS NOT NULL AND w.promosso_il IS NULL)::text FROM public.whatsapp_messages w WHERE w.wa_message_id = 'bw:393330000508:A1')
  || '|' || (SELECT c.unread_count FROM pg_temp.contatto('393330000509') c));
-- La riga senza contatto (508) lasciata lì occuperebbe un posto dei 500: la tolgo.
DELETE FROM public.whatsapp_messages WHERE wa_message_id = 'bw:393330000508:A1';
INSERT INTO public.whatsapp_contacts (user_id, phone_e164, last_message_at, unread_count, origine)
VALUES (:'U'::uuid, '+393330000600', now(), 0, 'baileys');
INSERT INTO public.whatsapp_messages (user_id, wa_message_id, direction, from_number, to_number, body, status, canale, created_at, raw_payload, attesa_dal)
SELECT :'U'::uuid, 'bw:393330000600:B' || g, 'inbound', '+393330000600', 'baileys', 'm' || g, 'delivered', 'baileys',
       to_timestamp(:t_in - g), '{}'::jsonb, now()
  FROM generate_series(1, 600) g;
SELECT public.ponte_wa_promuovi(:'U'::uuid, 0)::text AS prima_chiamata \gset
SELECT public.ponte_wa_promuovi(:'U'::uuid, 0)::text AS seconda_chiamata \gset
SELECT pg_temp.uguale('10 600 in attesa: la prima chiamata ne promuove al più 500, la seconda le altre 100',
  '{"promosse": 500, "saltate": 0}|{"promosse": 100, "saltate": 0}|600',
  :'prima_chiamata' || '|' || :'seconda_chiamata'
  || '|' || (SELECT c.unread_count FROM pg_temp.contatto('393330000600') c));
SELECT pg_temp.uguale('10 parametri nulli: nessun errore, nessuna promozione',
  '{"promosse": 0, "saltate": 0}|{"promosse": 0, "saltate": 0}',
  public.ponte_wa_promuovi(NULL, 120)::text || '|' || public.ponte_wa_promuovi(:'U2'::uuid, NULL)::text);
SELECT pg_temp.uguale('10 un altro utente non promuove le righe del primo',
  '{"promosse": 0, "saltate": 0}', public.ponte_wa_promuovi(:'U2'::uuid, 0)::text);

-- ═════ 11. Chi può fare cosa ═════════════════════════════════════════════════
SELECT pg_temp.uguale('11 anon e authenticated non eseguono promuovi e ritira; service_role sì',
  'false false false false true true',
  concat_ws(' ',
    has_function_privilege('anon', 'public.ponte_wa_promuovi(uuid, int)', 'EXECUTE')::text,
    has_function_privilege('anon', 'public.ponte_wa_ritira(uuid, uuid)', 'EXECUTE')::text,
    has_function_privilege('authenticated', 'public.ponte_wa_promuovi(uuid, int)', 'EXECUTE')::text,
    has_function_privilege('authenticated', 'public.ponte_wa_ritira(uuid, uuid)', 'EXECUTE')::text,
    has_function_privilege('service_role', 'public.ponte_wa_promuovi(uuid, int)', 'EXECUTE')::text,
    has_function_privilege('service_role', 'public.ponte_wa_ritira(uuid, uuid)', 'EXECUTE')::text));
SELECT pg_temp.uguale('11 ponte_wa_scrivi resta chiusa a anon e authenticated e aperta a service_role',
  'false false true',
  concat_ws(' ',
    has_function_privilege('anon', 'public.ponte_wa_scrivi(uuid, jsonb, jsonb, jsonb)', 'EXECUTE')::text,
    has_function_privilege('authenticated', 'public.ponte_wa_scrivi(uuid, jsonb, jsonb, jsonb)', 'EXECUTE')::text,
    has_function_privilege('service_role', 'public.ponte_wa_scrivi(uuid, jsonb, jsonb, jsonb)', 'EXECUTE')::text));
SET LOCAL ROLE authenticated;
DO $d$
BEGIN
  BEGIN
    PERFORM public.ponte_wa_promuovi('00000000-0000-4000-8000-0000000000c1', 0);
    RAISE EXCEPTION 'KO authenticated chiama ponte_wa_promuovi';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.ponte_wa_ritira('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000fffff');
    RAISE EXCEPTION 'KO authenticated chiama ponte_wa_ritira';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $d$;
RESET ROLE;
\echo 'ok  authenticated non chiama promuovi né ritira (permesso negato)'

-- ═════ 12. Le colonne nuove e l'indice ═══════════════════════════════════════
SELECT pg_temp.uguale('12 colonne attesa_dal e promosso_il (timestamptz) e indice parziale',
  'attesa_dal:timestamp with time zone,promosso_il:timestamp with time zone|1',
  (SELECT string_agg(column_name || ':' || data_type, ',' ORDER BY column_name)
     FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'whatsapp_messages' AND column_name IN ('attesa_dal', 'promosso_il'))
  || '|' || (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_wa_messages_da_promuovere')::text);

\echo 'TUTTI I CONTROLLI DI «TUTTE LE CHAT» PASSANO (ora ROLLBACK: nel database non resta niente)'
ROLLBACK;
