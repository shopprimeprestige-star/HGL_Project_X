-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DELL'INVIO A MANO DAL PONTE SU UN POSTGRES VERO (T1, commessa
-- 2026-10-30-ponte-invio-manuale, PIANO §2 e T1)
--
-- NON entra in `npm test` e NON si lancia sul database di produzione: serve un
-- database di prova con le migrazioni applicate in ordine FINO a
-- 20261029200000_risposte_ai.sql (`supabase start` va bene: ha già auth.users,
-- auth.uid() e i ruoli anon, authenticated, service_role). Istruzioni e uscita
-- attesa: prove/sql/LEGGIMI.md.
--
--   psql "$DB" -f prove/sql/ponte-invio.sql        (dalla radice del repo)
--
-- Tutto gira dentro UNA transazione che finisce con ROLLBACK: la migrazione
-- (applicata due volte) e i dati di prova spariscono alla fine. Al primo
-- controllo sbagliato si ferma con «KO <nome>: atteso …, avuto …».
-- Dentro la transazione now() è fermo: gli orari si spostano riscrivendo le
-- colonne delle righe di prova (created_at, preso_il), mai l'orologio.
--
-- Dati inventati: utenti, numeri, testi e id non esistono.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
\set migrazione 'supabase/migrations/20261030120000_ponte_invio_manuale.sql'
\set U  '00000000-0000-4000-8000-0000000000b1'
\set U2 '00000000-0000-4000-8000-0000000000b2'

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

-- I parametri sono quelli di LIMITI_INVIO (src/crm/ponte/invio-tipi.ts): 20 s,
-- 20 al giorno, 10 minuti di scadenza, 3 di incertezza.
CREATE FUNCTION pg_temp.prendi() RETURNS jsonb LANGUAGE sql AS $f$
  SELECT public.ponte_wa_invii_prendi('00000000-0000-4000-8000-0000000000b1'::uuid, 20, 20, 10, 3) $f$;
CREATE FUNCTION pg_temp.fatti(n text) RETURNS jsonb LANGUAGE sql AS $f$
  SELECT public.ponte_wa_invio_fatti('00000000-0000-4000-8000-0000000000b1'::uuid, n) $f$;
CREATE FUNCTION pg_temp.esito(id uuid, esito text, wa text, ts double precision, motivo text) RETURNS jsonb LANGUAGE sql AS $f$
  SELECT public.ponte_wa_invio_esito('00000000-0000-4000-8000-0000000000b1'::uuid, id, esito, wa, ts, motivo) $f$;
-- Una riga di prova: chiave, numero, stato, da quanti secondi è stata creata, da quanti è stata presa.
CREATE FUNCTION pg_temp.riga(p_chiave text, p_numero text, p_stato text, p_creata_s int DEFAULT 0, p_presa_s int DEFAULT NULL, p_testo text DEFAULT 'Ciao, ti rispondo da qui') RETURNS uuid
LANGUAGE sql AS $f$
  INSERT INTO public.ponte_wa_invii (user_id, chiave, numero, testo, stato, created_at, preso_il)
  VALUES ('00000000-0000-4000-8000-0000000000b1', p_chiave, p_numero, p_testo, p_stato,
          now() - make_interval(secs => p_creata_s),
          CASE WHEN p_presa_s IS NULL THEN NULL ELSE now() - make_interval(secs => p_presa_s) END)
  RETURNING id $f$;
CREATE FUNCTION pg_temp.stato(p_chiave text) RETURNS text LANGUAGE sql AS $f$
  SELECT stato || '|' || coalesce(motivo, '-') FROM public.ponte_wa_invii WHERE chiave = p_chiave $f$;

SELECT extract(epoch FROM date_trunc('second', now()))::bigint AS adesso \gset

-- ── Il mondo di prova ────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email) VALUES
  (:'U'::uuid,  'prova-invio-1@example.invalid'),
  (:'U2'::uuid, 'prova-invio-2@example.invalid')
ON CONFLICT (id) DO NOTHING;
-- 393330000101: contatto ManyChat con TUTTI i campi che l'invio non deve toccare.
-- 393330000103: STOP. 393330000105: entrata del Cloud scritta senza «+».
INSERT INTO public.whatsapp_contacts
  (user_id, phone_e164, lead_id, display_name, last_message_at, unread_count,
   ultimo_in_entrata_il, ultimo_in_entrata_anteprima, risposto_il, subscriber_id, non_scrivere_dal)
VALUES
  (:'U'::uuid, '+393330000101', '00000000-0000-4000-8000-00000000c101', 'Cliente Uno', '2026-10-01 10:00+00', 3,
   '2026-10-01 10:00+00', 'ciao', NULL, 'sub-prova', NULL),
  (:'U'::uuid, '+393330000103', NULL, 'Cliente Tre', '2026-10-01 10:00+00', 0,
   '2026-10-01 10:00+00', 'basta', NULL, NULL, '2026-10-02 10:00+00');
INSERT INTO public.whatsapp_messages (user_id, wa_message_id, direction, from_number, to_number, body, status, canale, created_at) VALUES
  (:'U'::uuid,  'mc-in:prova-1',  'inbound',  '+393330000101', 'manychat',      'Buongiorno',    'delivered', 'manychat', now() - interval '3 days'),
  (:'U'::uuid,  'bw:393330000102:PROVAIN2', 'inbound', '+393330000102', 'baileys', 'Dal telefono', 'delivered', 'baileys', now() - interval '3 days'),
  (:'U'::uuid,  'mc-in:prova-3',  'inbound',  '+393330000103', 'manychat',      'Stop',          'delivered', 'manychat', now() - interval '3 days'),
  (:'U'::uuid,  'mc:prova-4',     'outbound', 'manychat',      '+393330000104', 'Ciao, scrivici', 'sent',      'manychat', now() - interval '3 days'),
  (:'U'::uuid,  'wamid.prova-5',  'inbound',  '393330000105',  '1234567890',    'Ok',            'delivered', NULL,       now() - interval '3 days'),
  (:'U2'::uuid, 'mc-in:prova-6',  'inbound',  '+393330000101', 'manychat',      'Altro utente',  'delivered', 'manychat', now() - interval '3 days');
INSERT INTO public.ponte_wa_stato (user_id, stato, contatori) VALUES (:'U'::uuid, 'collegato', '{"invii_attivi": 1, "invii_ok": 0}');
CREATE TEMP TABLE prima AS SELECT * FROM public.whatsapp_contacts WHERE user_id = :'U'::uuid;

-- ── ponte_wa_invio_fatti ─────────────────────────────────────────────────────
SELECT pg_temp.uguale('fatti: cliente con entrata e contatto, ponte collegato e invii attivi',
  'true|false|collegato|true|0|0',
  (SELECT concat_ws('|', f->>'entrata', f->>'stop', f->>'ponte_stato', f->>'invii_attivi', f->>'ultime24h', f->>'in_coda') FROM pg_temp.fatti('393330000101') f));
SELECT pg_temp.uguale('fatti: il battito è quello di ponte_wa_stato',
  'true',
  (SELECT ((f->>'ponte_battito')::timestamptz = (SELECT aggiornato_il FROM public.ponte_wa_stato WHERE user_id = :'U'::uuid))::text FROM pg_temp.fatti('393330000101') f));
SELECT pg_temp.uguale('fatti: una sola entrata del ponte (canale baileys) basta per «ha già una chat»',
  'true', (SELECT f->>'entrata' FROM pg_temp.fatti('393330000102') f));
SELECT pg_temp.uguale('fatti: entrata del Cloud scritta senza «+»', 'true', (SELECT f->>'entrata' FROM pg_temp.fatti('393330000105') f));
SELECT pg_temp.uguale('fatti: STOP (e l''entrata c''è)', 'true|true',
  (SELECT (f->>'stop') || '|' || (f->>'entrata') FROM pg_temp.fatti('393330000103') f));
SELECT pg_temp.uguale('fatti: solo uscite verso quel numero → mai scritto', 'false|false',
  (SELECT (f->>'entrata') || '|' || (f->>'stop') FROM pg_temp.fatti('393330000104') f));
SELECT pg_temp.uguale('fatti: un numero che non conosciamo', 'false', (SELECT f->>'entrata' FROM pg_temp.fatti('393330000999') f));
SELECT pg_temp.uguale('fatti: un altro utente non vede le entrate di questo (e non ha il ponte)', 'false|null|false',
  (SELECT concat_ws('|', f->>'entrata', coalesce(f->>'ponte_stato', 'null'), f->>'invii_attivi')
     FROM (SELECT public.ponte_wa_invio_fatti(:'U2'::uuid, '393330000102') AS f) x));
SELECT pg_temp.uguale('fatti: …ma le sue entrate (stesso numero di un altro utente) le vede', 'true',
  (SELECT f->>'entrata' FROM (SELECT public.ponte_wa_invio_fatti(:'U2'::uuid, '393330000101') AS f) x));
SELECT pg_temp.uguale('fatti: numero non valido → niente di niente, nessun errore', 'false|false',
  (SELECT (f->>'entrata') || '|' || (f->>'stop') FROM pg_temp.fatti('12; drop') f));
UPDATE public.ponte_wa_stato SET contatori = '{"invii_ok": 0}' WHERE user_id = :'U'::uuid;
SELECT pg_temp.uguale('fatti: il ponte che non dichiara invii_attivi → false', 'false', (SELECT f->>'invii_attivi' FROM pg_temp.fatti('393330000101') f));
UPDATE public.ponte_wa_stato SET contatori = '{"invii_attivi": "si"}' WHERE user_id = :'U'::uuid;
SELECT pg_temp.uguale('fatti: invii_attivi non numerico → false, nessun errore', 'false', (SELECT f->>'invii_attivi' FROM pg_temp.fatti('393330000101') f));
UPDATE public.ponte_wa_stato SET contatori = '{"invii_attivi": 0}' WHERE user_id = :'U'::uuid;
SELECT pg_temp.uguale('fatti: invii_attivi = 0 → false', 'false', (SELECT f->>'invii_attivi' FROM pg_temp.fatti('393330000101') f));
UPDATE public.ponte_wa_stato SET contatori = NULL WHERE user_id = :'U'::uuid;
SELECT pg_temp.uguale('fatti: contatori assenti → false', 'false', (SELECT f->>'invii_attivi' FROM pg_temp.fatti('393330000101') f));
UPDATE public.ponte_wa_stato SET contatori = '{"invii_attivi": 1}' WHERE user_id = :'U'::uuid;

SELECT pg_temp.riga('conta-0001', '393330000101', 'in_attesa') AS _r \gset
SELECT pg_temp.riga('conta-0002', '393330000101', 'in_invio', 60, 30) AS _r \gset
SELECT pg_temp.riga('conta-0003', '393330000101', 'inviato', 7200, 7000) AS _r \gset
SELECT pg_temp.riga('conta-0004', '393330000101', 'non_inviato', 100000, 100000) AS _r \gset
SELECT pg_temp.uguale('fatti: in_coda conta in_attesa e in_invio; ultime24h i prelievi delle 24 ore (non quello di 100000 s)',
  '2|2', (SELECT (f->>'in_coda') || '|' || (f->>'ultime24h') FROM pg_temp.fatti('393330000101') f));
DELETE FROM public.ponte_wa_invii;

-- ── ponte_wa_invii_prendi ────────────────────────────────────────────────────
SELECT pg_temp.uguale('prendi: coda vuota → niente, attendi_s 0, nessun limite',
  'null|0|false|0|0|0',
  (SELECT concat_ws('|', coalesce(p->>'invio', 'null'), p->>'attendi_s', p->>'limite', p->>'scaduti', p->>'incerti', p->>'respinti') FROM pg_temp.prendi() p));

SELECT pg_temp.riga('uno-00001', '393330000101', 'in_attesa', 40, NULL, 'Primo messaggio') AS id_uno \gset
SELECT pg_temp.riga('due-00002', '393330000102', 'in_attesa', 30, NULL, 'Secondo messaggio') AS id_due \gset
SELECT pg_temp.prendi()->'invio'->>'id' AS preso1 \gset
SELECT pg_temp.uguale('prendi: con due righe prende la più vecchia, una sola', :'id_uno', :'preso1');
SELECT pg_temp.uguale('prendi: la prima è in_invio con preso_il, la seconda aspetta ancora', 'in_invio|in_attesa|true',
  concat_ws('|', (SELECT stato FROM public.ponte_wa_invii WHERE id = :'id_uno'::uuid),
                 (SELECT stato FROM public.ponte_wa_invii WHERE id = :'id_due'::uuid),
                 (SELECT (preso_il = now())::text FROM public.ponte_wa_invii WHERE id = :'id_uno'::uuid)));
SELECT pg_temp.uguale('prendi: subito dopo, la seconda NON parte: attendi_s = 20 (l''intervallo), nessun limite',
  'null|20|false', (SELECT concat_ws('|', coalesce(p->>'invio', 'null'), p->>'attendi_s', p->>'limite') FROM pg_temp.prendi() p));
UPDATE public.ponte_wa_invii SET preso_il = now() - interval '15 seconds' WHERE id = :'id_uno'::uuid;
SELECT pg_temp.uguale('prendi: dopo 15 secondi mancano 5', 'null|5', (SELECT concat_ws('|', coalesce(p->>'invio', 'null'), p->>'attendi_s') FROM pg_temp.prendi() p));
UPDATE public.ponte_wa_invii SET preso_il = now() - interval '21 seconds' WHERE id = :'id_uno'::uuid;
SELECT pg_temp.prendi()->'invio' AS preso2 \gset
SELECT pg_temp.uguale('prendi: dopo 21 secondi parte la seconda, con numero e testo', 'Secondo messaggio|393330000102',
  concat_ws('|', :'preso2'::jsonb->>'testo', :'preso2'::jsonb->>'numero'));
SELECT pg_temp.uguale('prendi: con la coda vuota di nuovo, nessuna delle due righe in_invio viene riofferta', 'null|0',
  (SELECT concat_ws('|', coalesce(p->>'invio', 'null'), p->>'attendi_s') FROM pg_temp.prendi() p));
DELETE FROM public.ponte_wa_invii;

-- Il tetto delle 24 ore: 19 prelievi passano, il 20° pure, dal 21° si ferma.
INSERT INTO public.ponte_wa_invii (user_id, chiave, numero, testo, stato, created_at, preso_il, inviato_il, wa_message_id)
SELECT :'U'::uuid, 'fill-' || lpad(g::text, 5, '0'), '393330000101', 'x', 'inviato',
       now() - interval '2 hours' - make_interval(mins => g), now() - interval '1 hour' - make_interval(mins => g), now() - interval '1 hour', 'PF' || g
  FROM generate_series(1, 19) g;
SELECT pg_temp.riga('tetto-0001', '393330000101', 'in_attesa', 5) AS id_t1 \gset
SELECT pg_temp.uguale('prendi: con 19 prelievi nelle ultime 24 ore il 20° parte', :'id_t1', pg_temp.prendi()->'invio'->>'id');
UPDATE public.ponte_wa_invii SET preso_il = now() - interval '5 minutes' WHERE id = :'id_t1'::uuid;
SELECT pg_temp.riga('tetto-0002', '393330000101', 'in_attesa', 5) AS _r \gset
SELECT pg_temp.uguale('prendi: con 20 prelievi il 21° NON parte, limite=true, attendi_s ≤ 3600', 'null|true|true',
  (SELECT concat_ws('|', coalesce(p->>'invio', 'null'), p->>'limite', ((p->>'attendi_s')::int BETWEEN 1 AND 3600)::text) FROM pg_temp.prendi() p));
UPDATE public.ponte_wa_invii SET preso_il = now() - interval '23 hours 59 minutes 30 seconds' WHERE chiave = 'fill-00019';
SELECT pg_temp.uguale('prendi: attendi_s = i secondi che mancano al più vecchio per uscire dalla finestra', '30',
  pg_temp.prendi()->>'attendi_s');
UPDATE public.ponte_wa_invii SET preso_il = now() - interval '25 hours' WHERE chiave = 'fill-00019';
SELECT pg_temp.prendi() AS _p \gset
SELECT pg_temp.uguale('prendi: uscito il più vecchio dalla finestra (25 ore), il messaggio parte', 'tetto-0002',
  (SELECT chiave FROM public.ponte_wa_invii WHERE stato = 'in_invio' AND chiave = 'tetto-0002'));
DELETE FROM public.ponte_wa_invii;

-- Scaduti e incerti.
SELECT pg_temp.riga('scad-00001', '393330000101', 'in_attesa', 11 * 60) AS _r \gset
SELECT pg_temp.riga('scad-00002', '393330000101', 'in_attesa', 9 * 60) AS _r \gset
SELECT pg_temp.riga('scad-00003', '393330000101', 'in_invio', 20 * 60, 4 * 60) AS _r \gset
SELECT pg_temp.riga('scad-00004', '393330000101', 'in_invio', 20 * 60, 2 * 60) AS _r \gset
SELECT pg_temp.prendi() AS giro \gset
SELECT pg_temp.uguale('prendi: «in_attesa» di 11 minuti → non_inviato · scaduto', 'non_inviato|scaduto', pg_temp.stato('scad-00001'));
SELECT pg_temp.uguale('prendi: «in_attesa» di 9 minuti resta (anzi, parte: è la più vecchia rimasta)', 'in_invio|-', pg_temp.stato('scad-00002'));
SELECT pg_temp.uguale('prendi: «in_invio» di 4 minuti → non_inviato · esito_incerto, mai riofferta', 'non_inviato|esito_incerto', pg_temp.stato('scad-00003'));
SELECT pg_temp.uguale('prendi: «in_invio» di 2 minuti resta in_invio', 'in_invio|-', pg_temp.stato('scad-00004'));
SELECT pg_temp.uguale('prendi: i contatori del giro', '1|1', (:'giro'::jsonb->>'scaduti') || '|' || (:'giro'::jsonb->>'incerti'));
DELETE FROM public.ponte_wa_invii;

-- STOP e «mai scritto» ricontrollati al prelievo, poi passa alla successiva.
SELECT pg_temp.riga('stop-00001', '393330000103', 'in_attesa', 50) AS _r \gset
SELECT pg_temp.riga('mai-000002', '393330000104', 'in_attesa', 40) AS _r \gset
SELECT pg_temp.riga('buon-00003', '393330000105', 'in_attesa', 30) AS _r \gset
SELECT pg_temp.prendi() AS giro \gset
SELECT pg_temp.uguale('prendi: STOP → non_inviato · stop', 'non_inviato|stop', pg_temp.stato('stop-00001'));
SELECT pg_temp.uguale('prendi: mai scritto → non_inviato · mai_scritto', 'non_inviato|mai_scritto', pg_temp.stato('mai-000002'));
SELECT pg_temp.uguale('prendi: …e va avanti: parte la successiva valida; respinti = 2', 'in_invio|-|2', pg_temp.stato('buon-00003') || '|' || (:'giro'::jsonb->>'respinti'));
DELETE FROM public.ponte_wa_invii;
SELECT pg_temp.riga('solo-00001', '393330000103', 'in_attesa', 30) AS _r \gset
SELECT pg_temp.uguale('prendi: se rimangono solo righe respinte → niente da inviare, attendi_s 0', 'null|0|1',
  (SELECT concat_ws('|', coalesce(p->>'invio', 'null'), p->>'attendi_s', p->>'respinti') FROM pg_temp.prendi() p));
DELETE FROM public.ponte_wa_invii;

-- Parametri non validi: errore, non limiti inventati.
DO $d$
BEGIN
  BEGIN
    PERFORM public.ponte_wa_invii_prendi('00000000-0000-4000-8000-0000000000b1'::uuid, NULL, 20, 10, 3);
    RAISE EXCEPTION 'KO prendi accetta un parametro nullo';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'parametri_non_validi' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.ponte_wa_invii_prendi('00000000-0000-4000-8000-0000000000b1'::uuid, 20, 0, 10, 3);
    RAISE EXCEPTION 'KO prendi accetta al_giorno = 0';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'parametri_non_validi' THEN RAISE; END IF;
  END;
END $d$;
\echo 'ok  prendi: parametri nulli o a zero → errore'

-- ── ponte_wa_invio_esito ─────────────────────────────────────────────────────
SELECT pg_temp.riga('esit-00001', '393330000101', 'in_invio', 60, 30, 'Ci vediamo domani') AS id_e1 \gset
SELECT (:adesso - 10)::double precision AS ts1 \gset
SELECT pg_temp.esito(:'id_e1'::uuid, 'inviato', 'PROVAE1', :ts1, NULL) AS e1 \gset
SELECT pg_temp.uguale('esito inviato: ok, stato inviato, nuovo', 'true|inviato|true',
  concat_ws('|', :'e1'::jsonb->>'ok', :'e1'::jsonb->>'stato', :'e1'::jsonb->>'nuovo'));
SELECT pg_temp.uguale('esito: la riga porta id WhatsApp, ora vera e niente motivo', 'inviato|PROVAE1|true|-',
  (SELECT concat_ws('|', stato, wa_message_id, (inviato_il = to_timestamp(:ts1))::text, coalesce(motivo, '-')) FROM public.ponte_wa_invii WHERE id = :'id_e1'::uuid));
SELECT pg_temp.uguale('esito: nasce UNA riga del messaggio, chiave bw:, uscita baileys, testo e ora vera', '1|outbound|baileys|+393330000101|Ci vediamo domani|sent|baileys|true',
  (SELECT concat_ws('|', count(*), min(direction), min(from_number), min(to_number), min(body), min(status), min(canale), bool_and(created_at = to_timestamp(:ts1))::text)
     FROM public.whatsapp_messages WHERE wa_message_id = 'bw:393330000101:PROVAE1'));
SELECT pg_temp.uguale('esito: la riga del messaggio non ha scheda (lead_id vuoto)', 'null',
  (SELECT coalesce(lead_id::text, 'null') FROM public.whatsapp_messages WHERE wa_message_id = 'bw:393330000101:PROVAE1'));
SELECT pg_temp.uguale('esito: il contatto — risposto_il all''orario vero, last_message_at in avanti', 'true|true',
  (SELECT concat_ws('|', (risposto_il = to_timestamp(:ts1))::text, (last_message_at = to_timestamp(:ts1))::text) FROM public.whatsapp_contacts WHERE user_id = :'U'::uuid AND phone_e164 = '+393330000101'));
SELECT pg_temp.uguale('esito: non letti, ultima entrata, scheda, id ManyChat, STOP del contatto INVARIATI', '0',
  (SELECT count(*)::text FROM public.whatsapp_contacts c JOIN prima p ON p.id = c.id
    WHERE (c.unread_count, c.ultimo_in_entrata_il, c.ultimo_in_entrata_anteprima, c.lead_id, c.subscriber_id, c.non_scrivere_dal, c.display_name)
          IS DISTINCT FROM (p.unread_count, p.ultimo_in_entrata_il, p.ultimo_in_entrata_anteprima, p.lead_id, p.subscriber_id, p.non_scrivere_dal, p.display_name)));
-- Ripetuto: nessun effetto.
SELECT risposto_il AS risp_prima FROM public.whatsapp_contacts WHERE user_id = :'U'::uuid AND phone_e164 = '+393330000101' \gset
SELECT pg_temp.esito(:'id_e1'::uuid, 'inviato', 'PROVAE1', :ts1, NULL) AS e1b \gset
SELECT pg_temp.uguale('esito ripetuto: ok, nuovo=false', 'true|inviato|false', concat_ws('|', :'e1b'::jsonb->>'ok', :'e1b'::jsonb->>'stato', :'e1b'::jsonb->>'nuovo'));
SELECT pg_temp.uguale('esito ripetuto: sempre una sola riga bw:, risposto_il non si muove', '1|true',
  concat_ws('|', (SELECT count(*) FROM public.whatsapp_messages WHERE wa_message_id = 'bw:393330000101:PROVAE1'),
                 (SELECT (risposto_il = :'risp_prima'::timestamptz)::text FROM public.whatsapp_contacts WHERE user_id = :'U'::uuid AND phone_e164 = '+393330000101')));

-- ECO PRIMA DELL'ESITO: l'eco del ponte (lotto vivo, uscita) entra per prima, poi arriva l'esito.
SELECT pg_temp.riga('esit-00002', '393330000102', 'in_invio', 60, 30, 'Eco prima') AS id_e2 \gset
SELECT (:adesso - 20)::double precision AS ts2 \gset
SELECT public.ponte_wa_scrivi(:'U'::uuid,
  jsonb_build_array(jsonb_build_object('k', 'bw:393330000102:PROVAE2', 'n', '393330000102', 'd', 'out', 't', :ts2, 'x', 'Eco prima', 'e', true, 'm', NULL, 's', 'sent')),
  '[]'::jsonb, '{}'::jsonb)->>'nuovi' AS eco_nuovi \gset
SELECT pg_temp.uguale('eco prima: l''eco entra come riga normale e porta risposto_il', '1', :'eco_nuovi');
SELECT risposto_il AS risp_eco FROM public.whatsapp_contacts WHERE user_id = :'U'::uuid AND phone_e164 = '+393330000102' \gset
SELECT pg_temp.esito(:'id_e2'::uuid, 'inviato', 'PROVAE2', :ts2, NULL) AS e2 \gset
SELECT pg_temp.uguale('eco prima: l''esito dopo NON dà errore e chiude la riga', 'true|inviato', concat_ws('|', :'e2'::jsonb->>'ok', :'e2'::jsonb->>'stato'));
SELECT pg_temp.uguale('eco prima: una sola riga bw:, risposto_il una volta sola (uguale a quello dell''eco)', '1|true',
  concat_ws('|', (SELECT count(*) FROM public.whatsapp_messages WHERE wa_message_id = 'bw:393330000102:PROVAE2'),
                 (SELECT (risposto_il = :'risp_eco'::timestamptz)::text FROM public.whatsapp_contacts WHERE user_id = :'U'::uuid AND phone_e164 = '+393330000102')));

-- ESITO PRIMA DELL'ECO: poi l'eco trova la riga (gia_presenti), nessun doppione.
SELECT pg_temp.riga('esit-00003', '393330000105', 'in_invio', 60, 30, 'Esito prima') AS id_e3 \gset
SELECT (:adesso - 30)::double precision AS ts3 \gset
SELECT pg_temp.esito(:'id_e3'::uuid, 'inviato', 'PROVAE3', :ts3, NULL) AS e3 \gset
SELECT public.ponte_wa_scrivi(:'U'::uuid,
  jsonb_build_array(jsonb_build_object('k', 'bw:393330000105:PROVAE3', 'n', '393330000105', 'd', 'out', 't', :ts3, 'x', 'Esito prima', 'e', true, 'm', NULL, 's', 'sent')),
  '[]'::jsonb, '{}'::jsonb) AS eco3 \gset
SELECT pg_temp.uguale('esito prima: l''eco dopo trova la riga: nuovi 0, gia_presenti 1, risposto 0', '0|1|0',
  concat_ws('|', :'eco3'::jsonb->>'nuovi', :'eco3'::jsonb->>'gia_presenti', :'eco3'::jsonb->>'risposto'));
SELECT pg_temp.uguale('esito prima: una sola riga bw:', '1', (SELECT count(*)::text FROM public.whatsapp_messages WHERE wa_message_id = 'bw:393330000105:PROVAE3'));

-- Esito dopo esito_incerto: la verità vince sul dubbio.
SELECT pg_temp.riga('esit-00004', '393330000101', 'non_inviato', 600, 400, 'Era partito') AS id_e4 \gset
UPDATE public.ponte_wa_invii SET motivo = 'esito_incerto' WHERE id = :'id_e4'::uuid;
SELECT pg_temp.esito(:'id_e4'::uuid, 'inviato', 'PROVAE4', NULL, NULL) AS e4 \gset
SELECT pg_temp.uguale('esito inviato dopo esito_incerto → inviato', 'true|inviato|true', concat_ws('|', :'e4'::jsonb->>'ok', :'e4'::jsonb->>'stato', :'e4'::jsonb->>'nuovo'));
SELECT pg_temp.uguale('…senza ts il messaggio porta l''ora del database', 'true',
  (SELECT (created_at = now())::text FROM public.whatsapp_messages WHERE wa_message_id = 'bw:393330000101:PROVAE4'));
-- NOTA 2 del revisore: un esito tardivo contro una riga tornata in_attesa dopo il riprova NON la chiude.
SELECT pg_temp.riga('esit-00005', '393330000101', 'in_attesa', 5, 4000, 'Riprovato') AS id_e5 \gset
SELECT pg_temp.esito(:'id_e5'::uuid, 'inviato', 'PROVAE5', NULL, NULL) AS e5 \gset
SELECT pg_temp.uguale('esito inviato su riga tornata in_attesa → ok:false, la riga resta in_attesa, nessuna riga bw:', 'false|in_attesa|false|in_attesa|0',
  concat_ws('|', :'e5'::jsonb->>'ok', :'e5'::jsonb->>'stato', :'e5'::jsonb->>'nuovo', (SELECT stato FROM public.ponte_wa_invii WHERE id = :'id_e5'::uuid),
                 (SELECT count(*) FROM public.whatsapp_messages WHERE wa_message_id = 'bw:393330000101:PROVAE5')));
SELECT pg_temp.riga('esit-00006', '393330000101', 'non_inviato', 600, 400, 'Scaduto') AS id_e6 \gset
UPDATE public.ponte_wa_invii SET motivo = 'scaduto' WHERE id = :'id_e6'::uuid;
SELECT pg_temp.uguale('esito inviato su non_inviato con altro motivo (non esito_incerto) → ok:false', 'false|non_inviato',
  concat_ws('|', pg_temp.esito(:'id_e6'::uuid, 'inviato', 'PROVAE6', NULL, NULL)->>'ok', pg_temp.esito(:'id_e6'::uuid, 'inviato', 'PROVAE6', NULL, NULL)->>'stato'));
-- Id WhatsApp storto, ts fuori misura.
SELECT pg_temp.riga('esit-00007', '393330000101', 'in_invio', 60, 30) AS id_e7 \gset
SELECT pg_temp.uguale('esito inviato con wa_id storto → ok:false, riga ancora in_invio', 'false|in_invio',
  concat_ws('|', pg_temp.esito(:'id_e7'::uuid, 'inviato', 'a b', NULL, NULL)->>'ok', (SELECT stato FROM public.ponte_wa_invii WHERE id = :'id_e7'::uuid)));
SELECT pg_temp.uguale('esito inviato senza wa_id → ok:false', 'false', pg_temp.esito(:'id_e7'::uuid, 'inviato', NULL, NULL, NULL)->>'ok');
SELECT pg_temp.esito(:'id_e7'::uuid, 'inviato', 'PROVAE7', (:adesso + 3600)::double precision, NULL) AS e7 \gset
SELECT pg_temp.uguale('esito con ts nel futuro (+1 ora) → si usa l''ora del database', 'true',
  (SELECT (inviato_il = now() AND (SELECT created_at = now() FROM public.whatsapp_messages WHERE wa_message_id = 'bw:393330000101:PROVAE7'))::text FROM public.ponte_wa_invii WHERE id = :'id_e7'::uuid));
SELECT pg_temp.riga('esit-00008', '393330000101', 'in_invio', 600, 300) AS id_e8 \gset
SELECT pg_temp.esito(:'id_e8'::uuid, 'inviato', 'PROVAE8', (:adesso - 400)::double precision, NULL) AS e8 \gset
SELECT pg_temp.uguale('esito con ts di 100 s prima del prelievo (oltre il minuto di tolleranza) → ora del database', 'true',
  (SELECT (inviato_il = now())::text FROM public.ponte_wa_invii WHERE id = :'id_e8'::uuid));
SELECT pg_temp.riga('esit-00009', '393330000101', 'in_invio', 600, 300) AS id_e9 \gset
SELECT pg_temp.esito(:'id_e9'::uuid, 'inviato', 'PROVAE9', 'NaN'::double precision, NULL) AS e9 \gset
SELECT pg_temp.uguale('esito con ts NaN → nessun errore, ora del database', 'true',
  (SELECT (inviato_il = now())::text FROM public.ponte_wa_invii WHERE id = :'id_e9'::uuid));
-- Il contatto che non c'è nasce come quelli del ponte.
SELECT pg_temp.riga('esit-00010', '393330000106', 'in_invio', 60, 30) AS id_e10 \gset
SELECT pg_temp.esito(:'id_e10'::uuid, 'inviato', 'PROVAEA', (:adesso - 5)::double precision, NULL) AS e10 \gset
SELECT pg_temp.uguale('esito: contatto mancante → nasce con origine baileys, risposto_il e nessun non letto', 'baileys|0|true',
  (SELECT concat_ws('|', origine, unread_count, (risposto_il IS NOT NULL)::text) FROM public.whatsapp_contacts WHERE user_id = :'U'::uuid AND phone_e164 = '+393330000106'));
-- Esito errore.
SELECT pg_temp.riga('erro-00001', '393330000101', 'in_invio', 60, 30) AS id_r1 \gset
SELECT pg_temp.esito(:'id_r1'::uuid, 'errore', NULL, NULL, 'non_collegato') AS r1 \gset
SELECT pg_temp.uguale('esito errore: non_inviato col motivo della lista', 'true|non_inviato|true|non_inviato|non_collegato',
  concat_ws('|', :'r1'::jsonb->>'ok', :'r1'::jsonb->>'stato', :'r1'::jsonb->>'nuovo', (SELECT stato FROM public.ponte_wa_invii WHERE id = :'id_r1'::uuid), (SELECT motivo FROM public.ponte_wa_invii WHERE id = :'id_r1'::uuid)));
SELECT pg_temp.uguale('esito errore ripetuto: ok, nuovo=false, motivo invariato', 'true|false|non_collegato',
  concat_ws('|', pg_temp.esito(:'id_r1'::uuid, 'errore', NULL, NULL, 'stop')->>'ok', pg_temp.esito(:'id_r1'::uuid, 'errore', NULL, NULL, 'stop')->>'nuovo', (SELECT motivo FROM public.ponte_wa_invii WHERE id = :'id_r1'::uuid)));
SELECT pg_temp.riga('erro-00002', '393330000101', 'in_invio', 60, 30) AS id_r2 \gset
SELECT pg_temp.esito(:'id_r2'::uuid, 'errore', NULL, NULL, 'motivo inventato; DROP') AS r2 \gset
SELECT pg_temp.uguale('esito errore con motivo fuori lista → errore_invio', 'errore_invio', (SELECT motivo FROM public.ponte_wa_invii WHERE id = :'id_r2'::uuid));
SELECT pg_temp.riga('erro-00003', '393330000101', 'in_attesa', 5) AS id_r3 \gset
SELECT pg_temp.uguale('esito errore su una riga in_attesa → ok:false, resta in_attesa', 'false|in_attesa',
  concat_ws('|', pg_temp.esito(:'id_r3'::uuid, 'errore', NULL, NULL, 'stop')->>'ok', (SELECT stato FROM public.ponte_wa_invii WHERE id = :'id_r3'::uuid)));
SELECT pg_temp.uguale('esito inviato dopo un errore con motivo stop → ok:false (solo l''incertezza si corregge)', 'false|non_inviato',
  concat_ws('|', pg_temp.esito(:'id_r1'::uuid, 'inviato', 'PROVAR1', NULL, NULL)->>'ok', pg_temp.esito(:'id_r1'::uuid, 'inviato', 'PROVAR1', NULL, NULL)->>'stato'));
SELECT pg_temp.uguale('esito di tipo sconosciuto → ok:false', 'false', pg_temp.esito(:'id_r3'::uuid, 'forse', NULL, NULL, NULL)->>'ok');
SELECT pg_temp.uguale('esito di una riga che non c''è o di un altro utente → ok:false, stato null', 'false|null|false|null',
  concat_ws('|', pg_temp.esito('00000000-0000-4000-8000-00000000ffff'::uuid, 'inviato', 'PROVAZ', NULL, NULL)->>'ok',
                 coalesce(pg_temp.esito('00000000-0000-4000-8000-00000000ffff'::uuid, 'inviato', 'PROVAZ', NULL, NULL)->>'stato', 'null'),
                 public.ponte_wa_invio_esito(:'U2'::uuid, :'id_r3'::uuid, 'errore', NULL, NULL, 'stop')->>'ok',
                 coalesce(public.ponte_wa_invio_esito(:'U2'::uuid, :'id_r3'::uuid, 'errore', NULL, NULL, 'stop')->>'stato', 'null')));
DELETE FROM public.ponte_wa_invii;

-- ── La tabella: vincoli ──────────────────────────────────────────────────────
DO $d$
DECLARE
  prove text[][] := ARRAY[
    ARRAY['testo vuoto', $q$INSERT INTO public.ponte_wa_invii (user_id, chiave, numero, testo) VALUES ('00000000-0000-4000-8000-0000000000b1', 'chiave-ok-1', '393330000101', '')$q$],
    ARRAY['testo di 2001 caratteri', $q$INSERT INTO public.ponte_wa_invii (user_id, chiave, numero, testo) VALUES ('00000000-0000-4000-8000-0000000000b1', 'chiave-ok-2', '393330000101', repeat('a', 2001))$q$],
    ARRAY['numero di 7 cifre', $q$INSERT INTO public.ponte_wa_invii (user_id, chiave, numero, testo) VALUES ('00000000-0000-4000-8000-0000000000b1', 'chiave-ok-3', '3933300', 'ciao')$q$],
    ARRAY['numero con il +', $q$INSERT INTO public.ponte_wa_invii (user_id, chiave, numero, testo) VALUES ('00000000-0000-4000-8000-0000000000b1', 'chiave-ok-4', '+393330000101', 'ciao')$q$],
    ARRAY['chiave di 7 caratteri', $q$INSERT INTO public.ponte_wa_invii (user_id, chiave, numero, testo) VALUES ('00000000-0000-4000-8000-0000000000b1', 'corta-7', '393330000101', 'ciao')$q$],
    ARRAY['stato sconosciuto', $q$INSERT INTO public.ponte_wa_invii (user_id, chiave, numero, testo, stato) VALUES ('00000000-0000-4000-8000-0000000000b1', 'chiave-ok-5', '393330000101', 'ciao', 'boh')$q$],
    ARRAY['motivo con maiuscole', $q$INSERT INTO public.ponte_wa_invii (user_id, chiave, numero, testo, motivo) VALUES ('00000000-0000-4000-8000-0000000000b1', 'chiave-ok-6', '393330000101', 'ciao', 'Errore')$q$]
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(prove, 1) LOOP
    BEGIN
      EXECUTE prove[i][2];
      RAISE EXCEPTION 'KO la tabella accetta: %', prove[i][1];
    EXCEPTION WHEN check_violation THEN NULL;
    END;
  END LOOP;
  -- 2000 emoji (8000 byte, 2000 caratteri) passano: char_length conta i caratteri.
  INSERT INTO public.ponte_wa_invii (user_id, chiave, numero, testo)
  VALUES ('00000000-0000-4000-8000-0000000000b1', 'emoji-0001', '393330000101', repeat(chr(128512), 2000));
  INSERT INTO public.ponte_wa_invii (user_id, chiave, numero, testo)
  VALUES ('00000000-0000-4000-8000-0000000000b1', 'doppio-001', '393330000101', 'ciao');
  BEGIN
    INSERT INTO public.ponte_wa_invii (user_id, chiave, numero, testo)
    VALUES ('00000000-0000-4000-8000-0000000000b1', 'doppio-001', '393330000101', 'ciao');
    RAISE EXCEPTION 'KO la stessa chiave dello stesso utente entra due volte';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  INSERT INTO public.ponte_wa_invii (user_id, chiave, numero, testo)
  VALUES ('00000000-0000-4000-8000-0000000000b2', 'doppio-001', '393330000101', 'ciao');
END $d$;
\echo 'ok  vincoli: testo 1-2000 caratteri (2000 emoji passano), numero 8-15 cifre, chiave 8-64, stato e motivo in lista, chiave unica per utente'
DELETE FROM public.ponte_wa_invii;

-- ── Chi può fare cosa ────────────────────────────────────────────────────────
SELECT pg_temp.uguale('anon e authenticated non eseguono le tre funzioni; service_role sì',
  'false false false false false false true true true',
  concat_ws(' ',
    has_function_privilege('anon', 'public.ponte_wa_invio_fatti(uuid, text)', 'EXECUTE')::text,
    has_function_privilege('anon', 'public.ponte_wa_invii_prendi(uuid, integer, integer, integer, integer)', 'EXECUTE')::text,
    has_function_privilege('anon', 'public.ponte_wa_invio_esito(uuid, uuid, text, text, double precision, text)', 'EXECUTE')::text,
    has_function_privilege('authenticated', 'public.ponte_wa_invio_fatti(uuid, text)', 'EXECUTE')::text,
    has_function_privilege('authenticated', 'public.ponte_wa_invii_prendi(uuid, integer, integer, integer, integer)', 'EXECUTE')::text,
    has_function_privilege('authenticated', 'public.ponte_wa_invio_esito(uuid, uuid, text, text, double precision, text)', 'EXECUTE')::text,
    has_function_privilege('service_role', 'public.ponte_wa_invio_fatti(uuid, text)', 'EXECUTE')::text,
    has_function_privilege('service_role', 'public.ponte_wa_invii_prendi(uuid, integer, integer, integer, integer)', 'EXECUTE')::text,
    has_function_privilege('service_role', 'public.ponte_wa_invio_esito(uuid, uuid, text, text, double precision, text)', 'EXECUTE')::text));

-- I permessi di serie di Supabase (anon e authenticated scrivono) si ripristinano
-- PRIMA di tentare, poi si riapplica la migrazione: deve toglierli.
GRANT ALL ON public.ponte_wa_invii TO anon, authenticated;
\i :migrazione
SELECT pg_temp.uguale('tabella: dopo la migrazione authenticated può solo leggere, anon niente, service_role tutto',
  'true false false false false false false false true',
  concat_ws(' ',
    has_table_privilege('authenticated', 'public.ponte_wa_invii', 'SELECT')::text,
    has_table_privilege('authenticated', 'public.ponte_wa_invii', 'INSERT')::text,
    has_table_privilege('authenticated', 'public.ponte_wa_invii', 'UPDATE')::text,
    has_table_privilege('authenticated', 'public.ponte_wa_invii', 'DELETE')::text,
    has_table_privilege('anon', 'public.ponte_wa_invii', 'SELECT')::text,
    has_table_privilege('anon', 'public.ponte_wa_invii', 'INSERT')::text,
    has_table_privilege('anon', 'public.ponte_wa_invii', 'UPDATE')::text,
    has_table_privilege('anon', 'public.ponte_wa_invii', 'DELETE')::text,
    has_table_privilege('service_role', 'public.ponte_wa_invii', 'INSERT')::text));
SELECT pg_temp.uguale('tabella: una sola policy, di sola lettura, per authenticated', 'users read own ponte invii|SELECT|{authenticated}',
  (SELECT string_agg(policyname || '|' || cmd || '|' || roles::text, ',') FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ponte_wa_invii'));

SELECT pg_temp.riga('legg-00001', '393330000101', 'in_attesa', 5, NULL, 'Del primo utente') AS _r \gset
INSERT INTO public.ponte_wa_invii (user_id, chiave, numero, testo) VALUES (:'U2'::uuid, 'legg-00002', '393330000101', 'Del secondo utente');
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true),
       set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b1', true) \gset
SET LOCAL ROLE authenticated;
SELECT count(*) AS vede_suo FROM public.ponte_wa_invii \gset
SELECT count(*) AS vede_altrui FROM public.ponte_wa_invii WHERE user_id = '00000000-0000-4000-8000-0000000000b2' \gset
-- authenticated non scrive nemmeno con i GRANT di serie (tolti dalla migrazione) e non chiama le funzioni.
DO $d$
DECLARE n int;
BEGIN
  BEGIN
    INSERT INTO public.ponte_wa_invii (user_id, chiave, numero, testo) VALUES ('00000000-0000-4000-8000-0000000000b1', 'scrit-0001', '393330000101', 'ciao');
    RAISE EXCEPTION 'KO authenticated scrive in ponte_wa_invii';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.ponte_wa_invii SET stato = 'inviato';
    RAISE EXCEPTION 'KO authenticated aggiorna ponte_wa_invii';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.ponte_wa_invii;
    RAISE EXCEPTION 'KO authenticated cancella da ponte_wa_invii';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.ponte_wa_invio_fatti('00000000-0000-4000-8000-0000000000b1', '393330000101');
    RAISE EXCEPTION 'KO authenticated chiama ponte_wa_invio_fatti';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.ponte_wa_invii_prendi('00000000-0000-4000-8000-0000000000b1', 20, 20, 10, 3);
    RAISE EXCEPTION 'KO authenticated chiama ponte_wa_invii_prendi';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.ponte_wa_invio_esito('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-00000000ffff', 'errore', NULL, NULL, NULL);
    RAISE EXCEPTION 'KO authenticated chiama ponte_wa_invio_esito';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $d$;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true),
       set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-0000000000b2', true) \gset
SELECT count(*) AS vede_secondo FROM public.ponte_wa_invii \gset
SELECT count(*) AS vede_del_primo FROM public.ponte_wa_invii WHERE user_id = '00000000-0000-4000-8000-0000000000b1' \gset
RESET ROLE;
SELECT pg_temp.uguale('RLS: ognuno vede solo le sue righe', '1|0|1|0',
  concat_ws('|', :vede_suo, :vede_altrui, :vede_secondo, :vede_del_primo));
SELECT pg_temp.uguale('…e le prove non hanno scritto niente di nascosto', '2', (SELECT count(*)::text FROM public.ponte_wa_invii));

\echo 'TUTTI I CONTROLLI DELL''INVIO A MANO PASSANO (ora ROLLBACK: nel database non resta niente)'
ROLLBACK;
