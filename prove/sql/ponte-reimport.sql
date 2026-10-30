-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DEL «SECONDO IMPORT» SU UN POSTGRES VERO (T4, commessa
-- 2026-10-30-ponte-storico-completo, PIANO b.1, b.4 e f.2)
--
-- Dopo il ricollegamento con il QR nuovo il telefono rimanda lo storico, e il
-- ponte lo ripassa a ponte_wa_scrivi: molti messaggi ci sono già. Qui si prova
-- cosa può cambiare e cosa NO, con la migrazione dell'import e quella di «tutte
-- le chat» (ponte_wa_scrivi v2, ponte_wa_ritira) già applicate.
--
-- NON entra in `npm test` e NON si lancia sul database di produzione: serve un
-- database di prova con TUTTE le migrazioni applicate (non le applica: lo fa
-- `pg-prova.sh`). Istruzioni: prove/sql/LEGGIMI.md.
--
--   bash <pg-prova.sh> <cartella-del-repo> prove/sql/ponte-reimport.sql
--   psql "$DB" -f prove/sql/ponte-reimport.sql        (dalla radice del repo)
--
-- Tutto gira dentro UNA transazione che finisce con ROLLBACK. Al primo controllo
-- sbagliato si ferma con «KO <nome>: atteso …, avuto …». Dentro la transazione
-- now() è fermo.
--
-- IL MONDO (tutto inventato; numeri 39333000060x)
--   601  un contatto con scheda e due messaggi già importati (A1 entrata, A2 uscita).
--   602  una riga NASCOSTA (B1, duplicato_di verso la riga ManyChat M_B).
--   603  una riga VISIBILE e già PROMOSSA (C1, +1 non letti) il cui pari ManyChat
--        (M_C) compare DOPO; ManyChat conta la sua entrata (+1): totale 2.
--   604  due vecchi MAI importati: D1 uguale a una riga ManyChat (stesso testo, 5
--        secondi prima) e D2 uguale a una riga ManyChat ma a 4 minuti.
-- Si ripassa un lotto «storico» con tutti, DUE volte: i pari li dà
-- ponte_wa_candidati (finestra 180 s) come nel flusso vero, con la stessa regola
-- di abbinaPari per il testo.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
\set U  '00000000-0000-4000-8000-0000000000f1'
\set M_B  '00000000-0000-4000-8000-00000000f0b1'
\set M_B2 '00000000-0000-4000-8000-00000000f0b2'
\set M_C  '00000000-0000-4000-8000-00000000f0c1'
\set M_D1 '00000000-0000-4000-8000-00000000f0d1'
\set M_D2 '00000000-0000-4000-8000-00000000f0d2'

BEGIN;

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

-- Il collaudo ha senso solo con la v2 di ponte_wa_scrivi (che chiama il ritiro).
SELECT pg_temp.uguale('prima: ponte_wa_scrivi è la v2 (chiama ponte_wa_ritira) e le tre funzioni di «tutte le chat» ci sono', 'true|3',
  (SELECT concat_ws('|', (SELECT (prosrc LIKE '%ponte_wa_ritira%')::text FROM pg_proc WHERE proname = 'ponte_wa_scrivi' AND pronamespace = 'public'::regnamespace),
                         (SELECT count(*)::text FROM pg_proc WHERE proname IN ('ponte_wa_scrivi', 'ponte_wa_ritira', 'ponte_wa_promuovi') AND pronamespace = 'public'::regnamespace))));

-- Una voce di p_righe nella forma di tipi.ts (RigaScrittura).
CREATE FUNCTION pg_temp.riga(k text, n text, d text, t double precision, x text, e boolean) RETURNS jsonb
LANGUAGE sql AS $f$
  SELECT jsonb_build_object('k', k, 'n', n, 'd', d, 't', t, 'x', x, 'e', e, 'm', NULL,
                            's', CASE WHEN d = 'in' THEN 'delivered' ELSE 'sent' END)
$f$;
-- Il lotto «storico» (e = false per tutti) dalle righe della tabella temporanea.
CREATE TEMP TABLE lotto (k text, n text, d text, t double precision, x text);
CREATE FUNCTION pg_temp.lotto() RETURNS jsonb LANGUAGE sql AS $f$
  SELECT coalesce(jsonb_agg(pg_temp.riga(k, n, d, t, x, false) ORDER BY t, k), '[]'::jsonb) FROM lotto $f$;
-- I pari come li darebbe il flusso vero: i candidati di ponte_wa_candidati (≤ 180 s) con lo stesso testo, uno per riga CRM.
CREATE FUNCTION pg_temp.pari(p_righe jsonb) RETURNS jsonb LANGUAGE sql AS $f$
  SELECT coalesce(jsonb_agg(jsonb_build_object('k', z.k, 'crm', z.id)), '[]'::jsonb)
    FROM (SELECT DISTINCT ON (c.id) c.k, c.id
            FROM public.ponte_wa_candidati('00000000-0000-4000-8000-0000000000f1'::uuid, p_righe) c
            JOIN jsonb_to_recordset(p_righe) AS r(k text, x text) ON r.k = c.k
           WHERE lower(c.body) = lower(r.x)
           ORDER BY c.id, c.k) z $f$;
CREATE FUNCTION pg_temp.contatto(n text) RETURNS public.whatsapp_contacts LANGUAGE sql AS $f$
  SELECT c FROM public.whatsapp_contacts c
   WHERE c.user_id = '00000000-0000-4000-8000-0000000000f1'::uuid AND c.phone_e164 = '+' || n $f$;
CREATE FUNCTION pg_temp.riga_ponte(k text) RETURNS public.whatsapp_messages LANGUAGE sql AS $f$
  SELECT w FROM public.whatsapp_messages w WHERE w.wa_message_id = k $f$;

-- Gli orari, in secondi interi (così to_timestamp(t) torna identico).
SELECT extract(epoch FROM date_trunc('second', now()))::bigint AS ora \gset
SELECT :ora - 10 * 86400 AS t_a, :ora - 9 * 86400 AS t_b, :ora - 8 * 86400 AS t_d1, :ora - 8 * 86400 + 7200 AS t_d2, :ora - 3600 AS t_c \gset

-- ── Il mondo ─────────────────────────────────────────────────────────────────
INSERT INTO auth.users (id, email) VALUES (:'U'::uuid, 'prova-reimport@example.invalid') ON CONFLICT (id) DO NOTHING;
-- 601 e 604: contatti ManyChat con TUTTI i campi che l'import non deve toccare.
INSERT INTO public.whatsapp_contacts
  (user_id, phone_e164, lead_id, display_name, last_message_at, unread_count,
   ultimo_in_entrata_il, ultimo_in_entrata_anteprima, risposto_il, subscriber_id, non_scrivere_dal, origine)
VALUES
  (:'U'::uuid, '+393330000601', '00000000-0000-4000-8000-00000000f601', 'Cliente Sei Uno', to_timestamp(:ora - 86400), 3,
   to_timestamp(:ora - 86400), 'ciao', to_timestamp(:ora - 3 * 86400), 'sub-601', NULL, NULL),
  (:'U'::uuid, '+393330000602', '00000000-0000-4000-8000-00000000f602', 'Cliente Sei Due', to_timestamp(:ora - 86400), 0,
   to_timestamp(:t_b), 'Salve', NULL, 'sub-602', NULL, NULL),
  (:'U'::uuid, '+393330000604', '00000000-0000-4000-8000-00000000f604', 'Cliente Sei Quattro', to_timestamp(:ora - 86400), 2,
   to_timestamp(:t_d2), 'Mi serve un appuntamento', NULL, 'sub-604', '2026-09-01 00:00+00', NULL);
-- Le righe ManyChat (i pari): M_B e M_D1/M_D2 esistono già al primo import; M_C arriverà dopo.
INSERT INTO public.whatsapp_messages (id, user_id, wa_message_id, direction, from_number, to_number, body, status, canale, created_at) VALUES
  (:'M_B'::uuid,  :'U'::uuid, 'mc-in:reimp-b',  'inbound', '+393330000602', 'manychat', 'Salve',                    'delivered', 'manychat', to_timestamp(:t_b)),
  (:'M_D1'::uuid, :'U'::uuid, 'mc-in:reimp-d1', 'inbound', '+393330000604', 'manychat', 'Buongiorno',                'delivered', 'manychat', to_timestamp(:t_d1)),
  (:'M_D2'::uuid, :'U'::uuid, 'mc-in:reimp-d2', 'inbound', '+393330000604', 'manychat', 'Mi serve un appuntamento',  'delivered', 'manychat', to_timestamp(:t_d2));

-- ── Il PRIMO import (quello del 29/10): A1, A2, B1 con il suo pari, C1 viva ──
SELECT public.ponte_wa_scrivi(:'U'::uuid,
  jsonb_build_array(
    pg_temp.riga('bw:393330000601:REIMPA1', '393330000601', 'in',  :t_a, 'Buongiorno, volevo informazioni', false),
    pg_temp.riga('bw:393330000601:REIMPA2', '393330000601', 'out', :t_a + 60, 'Certo, ecco le informazioni', false),
    pg_temp.riga('bw:393330000602:REIMPB1', '393330000602', 'in',  :t_b, 'Salve', false)),
  jsonb_build_array(jsonb_build_object('k', 'bw:393330000602:REIMPB1', 'crm', :'M_B')), '{}'::jsonb)::text AS esito \gset
SELECT pg_temp.uguale('primo import: 3 nuovi (A1, A2, B1), B1 nasce nascosta', '{"nuovi": 3, "doppioni": 1, "risposto": 0, "pari_persi": 0, "gia_presenti": 0, "contatti_nuovi": 0}'::jsonb::text, :'esito');
SELECT public.ponte_wa_scrivi(:'U'::uuid,
  jsonb_build_array(pg_temp.riga('bw:393330000603:REIMPC1', '393330000603', 'in', :t_c, 'Info prezzi', true)),
  '[]'::jsonb, '{}'::jsonb)::text AS esito \gset
SELECT pg_temp.uguale('primo import: C1 viva senza pari → nuovo contatto del ponte, in attesa', '{"nuovi": 1, "doppioni": 0, "risposto": 0, "pari_persi": 0, "gia_presenti": 0, "contatti_nuovi": 1}'::jsonb::text, :'esito');
SELECT public.ponte_wa_promuovi(:'U'::uuid, 0)::text AS esito \gset
SELECT pg_temp.uguale('C1 promossa: +1 non letti', '{"promosse": 1, "saltate": 0}|1',
  :'esito' || '|' || (SELECT c.unread_count FROM pg_temp.contatto('393330000603') c));
SELECT pg_temp.uguale('…ed è visibile e con promosso_il', 'true',
  (SELECT (w.duplicato_di IS NULL AND w.promosso_il IS NOT NULL)::text FROM pg_temp.riga_ponte('bw:393330000603:REIMPC1') w));
SELECT pg_temp.uguale('B1 nasce nascosta verso M_B', :'M_B', (SELECT (pg_temp.riga_ponte('bw:393330000602:REIMPB1')).duplicato_di::text));

-- ── Poi compare M_C (ManyChat, 3 secondi dopo) e conta la sua entrata: 2 ─────
INSERT INTO public.whatsapp_messages (id, user_id, wa_message_id, direction, from_number, to_number, body, status, canale, created_at)
VALUES (:'M_C'::uuid, :'U'::uuid, 'mc-in:reimp-c', 'inbound', '+393330000603', 'manychat', 'Info prezzi', 'delivered', 'manychat', to_timestamp(:t_c + 3));
UPDATE public.whatsapp_contacts SET unread_count = unread_count + 1 WHERE user_id = :'U'::uuid AND phone_e164 = '+393330000603';
SELECT pg_temp.uguale('la stessa entrata contata due volte (ponte + ManyChat): non letti 2', '2', (SELECT c.unread_count::text FROM pg_temp.contatto('393330000603') c));

-- Il lotto che il telefono rimanda: i 4 già importati + D1 e D2, mai importati.
INSERT INTO lotto VALUES
  ('bw:393330000601:REIMPA1', '393330000601', 'in',  :t_a,      'Buongiorno, volevo informazioni'),
  ('bw:393330000601:REIMPA2', '393330000601', 'out', :t_a + 60, 'Certo, ecco le informazioni'),
  ('bw:393330000602:REIMPB1', '393330000602', 'in',  :t_b,      'Salve'),
  ('bw:393330000603:REIMPC1', '393330000603', 'in',  :t_c,      'Info prezzi'),
  ('bw:393330000604:REIMPD1', '393330000604', 'in',  :t_d1 - 5, 'Buongiorno'),
  ('bw:393330000604:REIMPD2', '393330000604', 'in',  :t_d2 + 240, 'Mi serve un appuntamento');

-- Lo stato di tutto, prima.
CREATE TEMP TABLE prima_contatti AS
  SELECT id, phone_e164, lead_id, subscriber_id, non_scrivere_dal, risposto_il, ultimo_in_entrata_il,
         ultimo_in_entrata_anteprima, last_message_at, display_name, unread_count, origine
    FROM public.whatsapp_contacts WHERE user_id = :'U'::uuid;
CREATE TEMP TABLE prima_righe AS
  SELECT wa_message_id, duplicato_di, attesa_dal, promosso_il, body, created_at
    FROM public.whatsapp_messages WHERE user_id = :'U'::uuid AND canale = 'baileys';

-- ── Le tre misure di b.4, PRIMA ──────────────────────────────────────────────
SELECT count(*) AS esterni_prima
  FROM public.whatsapp_messages b
  JOIN public.whatsapp_messages m
    ON m.user_id = b.user_id AND m.id <> b.id AND m.direction = b.direction
   AND m.canale IS DISTINCT FROM 'baileys'
   AND right(regexp_replace(CASE WHEN m.direction = 'inbound' THEN m.from_number ELSE m.to_number END, '\D', '', 'g'), 9)
     = right(regexp_replace(CASE WHEN b.direction = 'inbound' THEN b.from_number ELSE b.to_number END, '\D', '', 'g'), 9)
   AND abs(extract(epoch FROM b.created_at - m.created_at)) <= 600
   AND lower(left(coalesce(b.body, ''), 100)) = lower(left(coalesce(m.body, ''), 100))
 WHERE b.canale = 'baileys' AND b.duplicato_di IS NULL AND m.duplicato_di IS NULL \gset
SELECT count(*) AS interni_prima
  FROM (SELECT split_part(wa_message_id, ':', 3) FROM public.whatsapp_messages
         WHERE canale = 'baileys' GROUP BY 1 HAVING count(*) > 1) x \gset
SELECT count(*) AS nd_prima FROM public.whatsapp_messages WHERE canale = 'baileys' AND wa_message_id LIKE 'bw:%-nd' \gset
SELECT pg_temp.uguale('misure prima: esterni 1 (C1 e M_C, visibili e vicini), interni 0, segnaposto -nd 0', '1|0|0',
  concat_ws('|', :esterni_prima, :interni_prima, :nd_prima));

-- ── Il flusso vero: i pari che darebbe ponte_wa_candidati ────────────────────
SELECT pg_temp.pari(pg_temp.lotto()) AS pari1 \gset
SELECT pg_temp.uguale('candidati: solo C1→M_C e D1→M_D1; B1 no (M_B è già presa), D2 no (240 s > 180), A1/A2 no', 'bw:393330000603:REIMPC1=' || :'M_C' || ',bw:393330000604:REIMPD1=' || :'M_D1',
  (SELECT string_agg(e->>'k' || '=' || (e->>'crm'), ',' ORDER BY e->>'k') FROM jsonb_array_elements(:'pari1'::jsonb) e));

-- ═════ IL SECONDO IMPORT, prima volta ════════════════════════════════════════
SELECT public.ponte_wa_scrivi(:'U'::uuid, pg_temp.lotto(), :'pari1'::jsonb, '{}'::jsonb)::text AS esito1 \gset
SELECT pg_temp.uguale('2° import, 1ª volta: nuovi = solo i mai visti (D1, D2); gia_presenti = 4; doppioni 2 (D1 nasce nascosta, C1 viene abbinata dopo)',
  '{"nuovi": 2, "doppioni": 2, "risposto": 0, "pari_persi": 0, "gia_presenti": 4, "contatti_nuovi": 0}'::jsonb::text, :'esito1');
SELECT pg_temp.uguale('…una sola riga per messaggio (6 righe del ponte, nessuna doppia)', '6|6',
  (SELECT count(*)::text || '|' || count(DISTINCT wa_message_id)::text FROM public.whatsapp_messages WHERE user_id = :'U'::uuid AND canale = 'baileys'));
SELECT pg_temp.uguale('la riga già NASCOSTA (B1) mantiene lo stesso duplicato_di', :'M_B', (SELECT (pg_temp.riga_ponte('bw:393330000602:REIMPB1')).duplicato_di::text));
SELECT pg_temp.uguale('il vecchio uguale a ManyChat (D1, −5 s) entra NASCOSTO', :'M_D1', (SELECT (pg_temp.riga_ponte('bw:393330000604:REIMPD1')).duplicato_di::text));
SELECT pg_temp.uguale('il vecchio a 4 minuti (D2) entra VISIBILE (due bolle: limite dei dati)', 'true',
  (SELECT (w.duplicato_di IS NULL)::text FROM pg_temp.riga_ponte('bw:393330000604:REIMPD2') w));
SELECT pg_temp.uguale('C1 (visibile e promossa) con il pari che compare dopo: duplicato_di valorizzato, promosso_il vuoto', :'M_C' || '|true',
  (SELECT (w).duplicato_di::text || '|' || ((w).promosso_il IS NULL)::text FROM (SELECT pg_temp.riga_ponte('bw:393330000603:REIMPC1') AS w) x));
SELECT pg_temp.uguale('…e i non letti scendono di UNO, una volta (2 → 1), mai sotto zero', '1', (SELECT c.unread_count::text FROM pg_temp.contatto('393330000603') c));

-- ═════ IL SECONDO IMPORT, seconda volta (stesso lotto) ═══════════════════════
SELECT pg_temp.pari(pg_temp.lotto()) AS pari2 \gset
SELECT pg_temp.uguale('2ª volta: i candidati sono vuoti (M_C e M_D1 ormai prese)', '[]', :'pari2');
SELECT public.ponte_wa_scrivi(:'U'::uuid, pg_temp.lotto(), :'pari2'::jsonb, '{}'::jsonb)::text AS esito2 \gset
SELECT pg_temp.uguale('2° import, 2ª volta: nuovi 0, doppioni 0, tutti gia_presenti (6), nessun contatto nuovo',
  '{"nuovi": 0, "doppioni": 0, "risposto": 0, "pari_persi": 0, "gia_presenti": 6, "contatti_nuovi": 0}'::jsonb::text, :'esito2');
SELECT pg_temp.uguale('…non letti ancora 1 (invariati)', '1', (SELECT c.unread_count::text FROM pg_temp.contatto('393330000603') c));
-- Il controllo tardivo rilanciato con gli STESSI pari (il battito, un ritentativo): niente di nuovo.
SELECT public.ponte_wa_scrivi(:'U'::uuid, pg_temp.lotto(), :'pari1'::jsonb, '{}'::jsonb)::text AS esito3 \gset
SELECT pg_temp.uguale('rilancio con gli stessi pari della 1ª volta: nuovi 0, doppioni 0, nessun secondo −1',
  '{"nuovi": 0, "doppioni": 0, "risposto": 0, "pari_persi": 0, "gia_presenti": 6, "contatti_nuovi": 0}'::jsonb::text, :'esito3');
SELECT pg_temp.uguale('…non letti ancora 1', '1', (SELECT c.unread_count::text FROM pg_temp.contatto('393330000603') c));
-- Un pari DIVERSO per la riga già nascosta (B1): non si riscrive.
INSERT INTO public.whatsapp_messages (id, user_id, wa_message_id, direction, from_number, to_number, body, status, canale, created_at)
VALUES (:'M_B2'::uuid, :'U'::uuid, 'mc-in:reimp-b2', 'inbound', '+393330000602', 'manychat', 'Salve', 'delivered', 'manychat', to_timestamp(:t_b + 1));
SELECT public.ponte_wa_scrivi(:'U'::uuid, pg_temp.lotto(),
  jsonb_build_array(jsonb_build_object('k', 'bw:393330000602:REIMPB1', 'crm', :'M_B2')), '{}'::jsonb)::text AS esito4 \gset
SELECT pg_temp.uguale('un altro pari offerto per B1 (già nascosta): doppioni 0 e duplicato_di resta M_B', '0|' || :'M_B',
  (:'esito4'::jsonb->>'doppioni') || '|' || (SELECT (pg_temp.riga_ponte('bw:393330000602:REIMPB1')).duplicato_di::text));

-- ── Cosa NON è cambiato ──────────────────────────────────────────────────────
SELECT pg_temp.uguale('contatti: nessuno nuovo', (SELECT count(*)::text FROM prima_contatti),
  (SELECT count(*)::text FROM public.whatsapp_contacts WHERE user_id = :'U'::uuid));
SELECT pg_temp.uguale('contatti: l''UNICO a cambiare è 603, e solo nei non letti', '+393330000603|0',
  concat_ws('|',
    (SELECT string_agg(phone_e164, ',') FROM (
       SELECT id, phone_e164, lead_id, subscriber_id, non_scrivere_dal, risposto_il, ultimo_in_entrata_il, ultimo_in_entrata_anteprima, last_message_at, display_name, unread_count, origine
         FROM public.whatsapp_contacts WHERE user_id = :'U'::uuid
       EXCEPT SELECT * FROM prima_contatti) x),
    (SELECT count(*)::text FROM (
       SELECT id, phone_e164, lead_id, subscriber_id, non_scrivere_dal, risposto_il, ultimo_in_entrata_il, ultimo_in_entrata_anteprima, last_message_at, display_name, origine
         FROM public.whatsapp_contacts WHERE user_id = :'U'::uuid
       EXCEPT SELECT id, phone_e164, lead_id, subscriber_id, non_scrivere_dal, risposto_il, ultimo_in_entrata_il, ultimo_in_entrata_anteprima, last_message_at, display_name, origine FROM prima_contatti) y)));
SELECT pg_temp.uguale('contatti: lead_id, non_scrivere_dal, risposto_il, ultimo_in_entrata_il/anteprima identici su 601, 602 e 604', '0',
  (SELECT count(*)::text FROM public.whatsapp_contacts c JOIN prima_contatti p ON p.id = c.id
    WHERE c.phone_e164 <> '+393330000603'
      AND (c.lead_id, c.non_scrivere_dal, c.risposto_il, c.ultimo_in_entrata_il, c.ultimo_in_entrata_anteprima, c.unread_count)
          IS DISTINCT FROM (p.lead_id, p.non_scrivere_dal, p.risposto_il, p.ultimo_in_entrata_il, p.ultimo_in_entrata_anteprima, p.unread_count)));
SELECT pg_temp.uguale('righe già presenti: corpo e ora mai riscritti; attesa_dal mai riscritto', '0',
  (SELECT count(*)::text FROM prima_righe p JOIN public.whatsapp_messages w ON w.wa_message_id = p.wa_message_id
    WHERE (w.body, w.created_at, w.attesa_dal) IS DISTINCT FROM (p.body, p.created_at, p.attesa_dal)));
SELECT pg_temp.uguale('righe già presenti: le uniche con duplicato_di diverso sono quelle abbinate dopo (C1)', 'bw:393330000603:REIMPC1',
  (SELECT string_agg(w.wa_message_id, ',') FROM prima_righe p JOIN public.whatsapp_messages w ON w.wa_message_id = p.wa_message_id
    WHERE w.duplicato_di IS DISTINCT FROM p.duplicato_di));
SELECT pg_temp.uguale('le righe nate dallo storico (D1, D2): attesa_dal e promosso_il NON scritti', '0',
  (SELECT count(*)::text FROM public.whatsapp_messages WHERE wa_message_id IN ('bw:393330000604:REIMPD1', 'bw:393330000604:REIMPD2')
      AND (attesa_dal IS NOT NULL OR promosso_il IS NOT NULL)));
SELECT pg_temp.uguale('ponte_wa_promuovi dopo il reimport: 0 promosse, 0 saltate (nessun non letto in più)', '{"promosse": 0, "saltate": 0}'::jsonb::text,
  public.ponte_wa_promuovi(:'U'::uuid, 0)::text);
SELECT pg_temp.uguale('…e i non letti restano quelli di prima (601: 3, 602: 0, 603: 1, 604: 2)', '3|0|1|2',
  (SELECT string_agg(c.unread_count::text, '|' ORDER BY c.phone_e164) FROM public.whatsapp_contacts c WHERE c.user_id = :'U'::uuid));

-- ── Le tre misure di b.4, DOPO ───────────────────────────────────────────────
SELECT count(*) AS esterni_dopo
  FROM public.whatsapp_messages b
  JOIN public.whatsapp_messages m
    ON m.user_id = b.user_id AND m.id <> b.id AND m.direction = b.direction
   AND m.canale IS DISTINCT FROM 'baileys'
   AND right(regexp_replace(CASE WHEN m.direction = 'inbound' THEN m.from_number ELSE m.to_number END, '\D', '', 'g'), 9)
     = right(regexp_replace(CASE WHEN b.direction = 'inbound' THEN b.from_number ELSE b.to_number END, '\D', '', 'g'), 9)
   AND abs(extract(epoch FROM b.created_at - m.created_at)) <= 600
   AND lower(left(coalesce(b.body, ''), 100)) = lower(left(coalesce(m.body, ''), 100))
 WHERE b.canale = 'baileys' AND b.duplicato_di IS NULL AND m.duplicato_di IS NULL \gset
SELECT count(*) AS interni_dopo
  FROM (SELECT split_part(wa_message_id, ':', 3) FROM public.whatsapp_messages
         WHERE canale = 'baileys' GROUP BY 1 HAVING count(*) > 1) x \gset
SELECT count(*) AS nd_dopo FROM public.whatsapp_messages WHERE canale = 'baileys' AND wa_message_id LIKE 'bw:%-nd' \gset
SELECT pg_temp.uguale('misure dopo: esterni 1 (ora è D2, a 4 minuti: la sonda a 600 s lo vede, l''abbinamento a 180 s no — di proposito), interni 0, -nd 0', '1|0|0',
  concat_ws('|', :esterni_dopo, :interni_dopo, :nd_dopo));
SELECT pg_temp.uguale('misure: C1 (prima nel conto degli esterni) ora non conta più: è nascosta', 'true',
  (SELECT ((SELECT (pg_temp.riga_ponte('bw:393330000603:REIMPC1')).duplicato_di) IS NOT NULL)::text));

-- Gli interni: lo stesso id WhatsApp con due numeri (un LID risolto in due modi) → 1. I segnaposto -nd salgono di uno.
INSERT INTO public.whatsapp_messages (user_id, wa_message_id, direction, from_number, to_number, body, status, canale, created_at)
VALUES (:'U'::uuid, 'bw:393330000699:REIMPA1', 'inbound', '+393330000699', 'baileys', 'Buongiorno, volevo informazioni', 'delivered', 'baileys', to_timestamp(:t_a)),
       (:'U'::uuid, 'bw:393330000601:REIMPX-nd', 'inbound', '+393330000601', 'baileys', '⚠️ non leggibile', 'delivered', 'baileys', to_timestamp(:t_a + 5));
SELECT count(*) AS interni_con_lid
  FROM (SELECT split_part(wa_message_id, ':', 3) FROM public.whatsapp_messages
         WHERE canale = 'baileys' GROUP BY 1 HAVING count(*) > 1) x \gset
SELECT count(*) AS nd_con FROM public.whatsapp_messages WHERE canale = 'baileys' AND wa_message_id LIKE 'bw:%-nd' \gset
SELECT pg_temp.uguale('misure con un LID doppio e un segnaposto: interni 1, -nd 1', '1|1', concat_ws('|', :interni_con_lid, :nd_con));

\echo 'TUTTI I CONTROLLI DEL SECONDO IMPORT PASSANO (ora ROLLBACK: nel database non resta niente)'
ROLLBACK;
