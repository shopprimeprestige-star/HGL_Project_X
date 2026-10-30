-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DELLA PULIZIA DELLE ECO SU UN POSTGRES VERO (p8-controllo-notte,
-- commessa 2026-10-30-ottimizzazioni, punto 9)
--
-- NON entra in `npm test` e NON si lancia sul database di produzione: serve un
-- database di prova con le migrazioni applicate in ordine (`supabase start` va
-- bene). Istruzioni e uscita attesa: prove/sql/LEGGIMI.md.
--
--   psql "$DB" -f prove/sql/controllo-notte.sql        (dalla radice del repo)
--
-- Tutto dentro UNA transazione che finisce con ROLLBACK: la migrazione
-- (applicata due volte) e i dati di prova spariscono. Al primo controllo
-- sbagliato si ferma con «KO <nome>: atteso …, avuto …».
-- Dati inventati: utenti, numeri e id non esistono.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
\set migrazione 'supabase/migrations/20261030090000_p8_controllo_notte.sql'
\set U  '00000000-0000-4000-8000-0000000000c1'
\set U2 '00000000-0000-4000-8000-0000000000c2'

BEGIN;

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

-- Una riga in entrata: id fisso (per i controlli), numero, testo, quando, canale, id WhatsApp.
CREATE FUNCTION pg_temp.entra(p_id text, p_user uuid, p_num text, p_testo text, p_fa interval,
                              p_canale text, p_wa text, p_dup text DEFAULT NULL) RETURNS void
LANGUAGE sql AS $f$
  INSERT INTO public.whatsapp_messages (id, user_id, wa_message_id, direction, from_number, to_number,
                                        body, status, canale, created_at, duplicato_di)
  VALUES (('00000000-0000-4000-8000-' || lpad(p_id, 12, '0'))::uuid, p_user, p_wa, 'inbound', p_num,
          '390000000000', p_testo, 'delivered', p_canale, now() - p_fa,
          CASE WHEN p_dup IS NULL THEN NULL ELSE ('00000000-0000-4000-8000-' || lpad(p_dup, 12, '0'))::uuid END);
$f$;
CREATE FUNCTION pg_temp.id(p text) RETURNS uuid LANGUAGE sql AS $f$
  SELECT ('00000000-0000-4000-8000-' || lpad(p, 12, '0'))::uuid $f$;
CREATE FUNCTION pg_temp.dup(p text) RETURNS text LANGUAGE sql AS $f$
  SELECT coalesce((SELECT right(duplicato_di::text, 12)::bigint::text
                     FROM public.whatsapp_messages WHERE id = pg_temp.id(p)), '-') $f$;

-- ── Il mondo ─────────────────────────────────────────────────────────────────
-- Numero A: l'originale (Cloud), la sua copia del ponte, due eco ManyChat ore
-- dopo (la seconda con maiuscole, spazi doppi e un carattere invisibile), poi
-- un testo diverso e vero.
SELECT pg_temp.entra('101', :'U', '+39 333 000 0001', 'Sì, va bene', interval '20 hours', 'cloud', 'wamid.prova101');
SELECT pg_temp.entra('102', :'U', '393330000001', 'Sì, va bene', interval '20 hours', 'baileys', 'bw:prova102', '101');
SELECT pg_temp.entra('103', :'U', '393330000001', 'Sì, va bene', interval '18 hours', NULL, 'mc-in:prova103');
SELECT pg_temp.entra('104', :'U', '393330000001', E'S\u00cc,\u200b va  bene', interval '17 hours', NULL, 'mc-in:prova104');
SELECT pg_temp.entra('105', :'U', '393330000001', 'a che ora?', interval '16 hours', NULL, 'mc-in:prova105');
-- Numero B: lo stesso messaggio da flusso e Default Reply a 20 secondi: doppione.
SELECT pg_temp.entra('201', :'U', '393330000002', 'ciao', interval '10 hours', NULL, 'mc-in:prova201');
SELECT pg_temp.entra('202', :'U', '393330000002', 'ciao', interval '10 hours' - interval '20 seconds', NULL, 'mc-in:prova202');
-- Numero C: un'eco VECCHIA (4 giorni): fuori dal periodo, resta com'è,
SELECT pg_temp.entra('301', :'U', '393330000003', 'grazie', interval '5 days', 'cloud', 'wamid.prova301');
SELECT pg_temp.entra('302', :'U', '393330000003', 'grazie', interval '4 days', NULL, 'mc-in:prova302');
-- …e un messaggio nuovo e diverso dello stesso numero: la pulizia ci passa, ma l'eco vecchia resta.
SELECT pg_temp.entra('303', :'U', '393330000003', 'a domani', interval '2 hours', NULL, 'mc-in:prova303');
-- Numero D: originale e copia del ponte già presi tutti e due: senza bersaglio.
SELECT pg_temp.entra('401', :'U', '393330000004', 'ok', interval '30 hours', 'cloud', 'wamid.prova401');
SELECT pg_temp.entra('402', :'U', '393330000004', 'ok', interval '30 hours', 'baileys', 'bw:prova402', '401');
SELECT pg_temp.entra('403', :'U', '393330000004', 'altro', interval '29 hours', 'baileys', 'bw:prova403', '402');
SELECT pg_temp.entra('404', :'U', '393330000004', 'ok', interval '5 hours', NULL, 'mc-in:prova404');
-- Numero E: un vocale (link di ManyChat) ripetuto: i media non si toccano.
SELECT pg_temp.entra('501', :'U', '393330000005', 'https://manybot-files.example/a.ogg', interval '9 hours', NULL, 'mc-in:prova501');
SELECT pg_temp.entra('502', :'U', '393330000005', 'https://manybot-files.example/a.ogg', interval '8 hours', NULL, 'mc-in:prova502');
-- Numero F: due righe Cloud uguali (il cliente ha riscritto davvero): solo
-- le righe ManyChat possono essere eco.
SELECT pg_temp.entra('701', :'U', '393330000006', 'perfetto', interval '12 hours', 'cloud', 'wamid.prova701');
SELECT pg_temp.entra('702', :'U', '393330000006', 'perfetto', interval '11 hours', 'cloud', 'wamid.prova702');
SELECT pg_temp.entra('703', :'U', '393330000006', 'grazie mille', interval '10 hours', NULL, 'mc-in:prova703');
-- Numero G: una riga del ponte senza pari, poi ManyChat con lo stesso testo:
-- le righe del ponte non contano come «ultima entrata» (come ecoDi).
SELECT pg_temp.entra('801', :'U', '393330000007', 'arrivo', interval '7 hours', 'baileys', 'bw:prova801');
SELECT pg_temp.entra('802', :'U', '393330000007', 'arrivo', interval '6 hours', NULL, 'mc-in:prova802');
-- Un altro utente con la stessa situazione di B: non si tocca.
SELECT pg_temp.entra('601', :'U2', '393330000002', 'ciao', interval '10 hours', NULL, 'mc-in:prova601');
SELECT pg_temp.entra('602', :'U2', '393330000002', 'ciao', interval '9 hours', NULL, 'mc-in:prova602');
-- Una riga del ponte uguale e più nuova sul numero A: il ponte non si segna mai.
SELECT pg_temp.entra('106', :'U', '393330000001', 'a che ora?', interval '15 hours', 'baileys', 'bw:prova106');

SELECT count(*) AS righe_prima FROM public.whatsapp_messages \gset

-- ── La prima pulizia (ultime 48 ore) ─────────────────────────────────────────
SELECT public.wa_segna_eco_doppioni(:'U', now() - interval '48 hours')::text AS esito1 \gset
SELECT pg_temp.uguale('prima pulizia: 2 eco, 1 doppione, 1 senza bersaglio',
  '{"eco": 2, "persi": 0, "doppione": 1, "senza_bersaglio": 1}', :'esito1');
SELECT pg_temp.uguale('eco 1: originale preso dal ponte → si lega alla riga del ponte', '102', pg_temp.dup('103'));
SELECT pg_temp.uguale('eco 2 (maiuscole, spazi, invisibile): in catena sulla prima', '103', pg_temp.dup('104'));
SELECT pg_temp.uguale('il testo diverso resta visibile', '-', pg_temp.dup('105'));
SELECT pg_temp.uguale('doppione a 20 secondi: legato al primo', '201', pg_temp.dup('202'));
SELECT pg_temp.uguale('il primo dei due resta visibile', '-', pg_temp.dup('201'));
SELECT pg_temp.uguale('eco di 4 giorni fa: fuori dal periodo, intatta', '-', pg_temp.dup('302'));
SELECT pg_temp.uguale('senza bersaglio libero: resta visibile', '-', pg_temp.dup('404'));
SELECT pg_temp.uguale('i media non si toccano', '-', pg_temp.dup('502'));
SELECT pg_temp.uguale('due righe Cloud uguali: nessuna si segna', '--', pg_temp.dup('701') || pg_temp.dup('702'));
SELECT pg_temp.uguale('ManyChat dopo una riga del ponte senza pari: resta visibile', '-', pg_temp.dup('802'));
SELECT pg_temp.uguale('l''eco vecchia resta anche se il numero ha un messaggio nuovo', '-', pg_temp.dup('303'));
SELECT pg_temp.uguale('un altro utente non si tocca', '-', pg_temp.dup('602'));
SELECT pg_temp.uguale('le righe del ponte non si segnano', '-', pg_temp.dup('106'));
SELECT pg_temp.uguale('le righe del ponte già legate restano come sono', '101', pg_temp.dup('102'));
SELECT pg_temp.uguale('nessuna riga cancellata', :'righe_prima',
  (SELECT count(*)::text FROM public.whatsapp_messages));
SELECT pg_temp.uguale('il registro ha i 3 segni, col tipo',
  'doppione:202>201,eco:103>102,eco:104>103',
  (SELECT string_agg(tipo || ':' || right(messaggio_id::text, 3) || '>' || right(verso::text, 3), ',' ORDER BY tipo, messaggio_id)
     FROM public.wa_pulizia_registro WHERE user_id = :'U'));

-- ── La seconda pulizia: niente di nuovo ──────────────────────────────────────
SELECT public.wa_segna_eco_doppioni(:'U', now() - interval '48 hours')::text AS esito2 \gset
SELECT pg_temp.uguale('rilanciata: non segna niente di nuovo',
  '{"eco": 0, "persi": 0, "doppione": 0, "senza_bersaglio": 1}', :'esito2');
SELECT pg_temp.uguale('…e il registro non cresce', '3',
  (SELECT count(*)::text FROM public.wa_pulizia_registro WHERE user_id = :'U'));
SELECT pg_temp.uguale('parametri vuoti: niente', '{"eco": 0, "persi": 0, "doppione": 0, "senza_bersaglio": 0}',
  public.wa_segna_eco_doppioni(NULL, now())::text);

-- ── L'annullamento scritto nella migrazione ──────────────────────────────────
UPDATE public.whatsapp_messages w SET duplicato_di = NULL
  FROM public.wa_pulizia_registro r
 WHERE r.messaggio_id = w.id AND w.duplicato_di = r.verso
   AND r.segnato_il >= now() - interval '1 hour';
SELECT pg_temp.uguale('annullata: le tre righe tornano visibili', '---',
  pg_temp.dup('103') || pg_temp.dup('104') || pg_temp.dup('202'));
SELECT pg_temp.uguale('annullata: i segni del ponte restano', '101', pg_temp.dup('102'));

-- ── Chi può chiamarla ────────────────────────────────────────────────────────
SELECT pg_temp.uguale('anon, authenticated: no; service_role: sì', 'f f t',
  concat_ws(' ',
    has_function_privilege('anon', 'public.wa_segna_eco_doppioni(uuid, timestamptz)', 'EXECUTE'),
    has_function_privilege('authenticated', 'public.wa_segna_eco_doppioni(uuid, timestamptz)', 'EXECUTE'),
    has_function_privilege('service_role', 'public.wa_segna_eco_doppioni(uuid, timestamptz)', 'EXECUTE')));
SELECT pg_temp.uguale('il registro non si legge dal browser', 'f f',
  concat_ws(' ',
    has_table_privilege('anon', 'public.wa_pulizia_registro', 'SELECT'),
    has_table_privilege('authenticated', 'public.wa_pulizia_registro', 'SELECT')));

\echo 'TUTTI I CONTROLLI DELLA PULIZIA PASSANO'
ROLLBACK;
