-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DELLE REVOCHE DEL PONTE, SU UN POSTGRES VERO (31/10/2026)
-- Commessa 2026-10-31, ponte-revoche. Migrazione:
-- supabase/migrations/20261031090000_ponte_revoche.sql
--
-- NON entra in `npm test` e NON si lancia sul database di produzione: serve un
-- database di prova con TUTTE le migrazioni applicate in ordine (come ponte-tutte.sql;
-- la migrazione nuova la applica lo script stesso, altre DUE volte). Dalla radice del repo:
--
--   bash "<commesse>/2026-10-30-ottimizzazioni/strumenti/pg-prova.sh" "$PWD" prove/sql/ponte-revoche.sql
--   oppure, su un database già pronto:  psql "$DB" -f prove/sql/ponte-revoche.sql
--
-- Tutto gira dentro UNA transazione che finisce con ROLLBACK. Al primo controllo
-- sbagliato si ferma con «KO <nome>: atteso …, avuto …». Dati inventati: utenti,
-- numeri (39333000 7xx) e testi non esistono.
--
-- IL MONDO
--   701  promemoria nostro dal ponte (B1) con il suo pari ManyChat (X1, B1.duplicato_di = X1): è
--        l'ultimo messaggio e l'ultima risposta. Un'uscita più vecchia (O0) e un'entrata (M1).
--   702  il verso inverso: una riga nostra (R2) che ha duplicato_di = la riga del ponte (B2).
--   703  una riga del ponte IN ENTRATA (di un cliente) con una chiave bw: che nessuno deve poter nascondere.
--   704  l'uscita revocata NON è l'ultimo messaggio (dopo c'è un'entrata); era l'unica risposta.
--   705  «Fatto» a mano: risposto_il non è l'ora del messaggio revocato.
--   706  l'unico messaggio della chat: dopo la revoca non resta niente.
--   707  numeri senza il «+» (contatto e righe).
--   un secondo utente con la stessa chiave.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
\set migrazione 'supabase/migrations/20261031090000_ponte_revoche.sql'
\set U  '00000000-0000-4000-8000-0000000000a1'
\set U2 '00000000-0000-4000-8000-0000000000a2'

BEGIN;
SET LOCAL TIME ZONE 'UTC';
\i :migrazione
\i :migrazione
\echo 'ok  migrazione applicata due volte senza errori'

CREATE FUNCTION pg_temp.verifica(p_nome text, p_atteso text, p_avuto text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_atteso IS DISTINCT FROM p_avuto THEN
    RAISE EXCEPTION 'KO %: atteso %, avuto %', p_nome, p_atteso, p_avuto;
  END IF;
  RAISE NOTICE 'ok  %', p_nome;
END $$;

-- Una riga di messaggio; restituisce l'id. `p_pari` = duplicato_di.
CREATE FUNCTION pg_temp.msg(p_utente uuid, p_dir text, p_num text, p_testo text, p_wa text, p_canale text, p_alle text,
                            p_pari uuid DEFAULT NULL, p_stato text DEFAULT 'sent') RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v uuid;
BEGIN
  INSERT INTO public.whatsapp_messages (user_id, direction, from_number, to_number, body, wa_message_id, canale, status, created_at, duplicato_di)
  VALUES (p_utente, p_dir,
          CASE WHEN p_dir = 'inbound' THEN p_num ELSE CASE WHEN p_canale = 'baileys' THEN 'baileys' ELSE 'manychat' END END,
          CASE WHEN p_dir = 'inbound' THEN CASE WHEN p_canale = 'baileys' THEN 'baileys' ELSE 'manychat' END ELSE p_num END,
          p_testo, p_wa, p_canale, p_stato, ('2026-10-31 ' || p_alle || '+00')::timestamptz, p_pari)
  RETURNING id INTO v;
  RETURN v;
END $$;

INSERT INTO auth.users (id) VALUES (:'U'), (:'U2') ON CONFLICT DO NOTHING;

-- ── 701: promemoria nostro con il suo pari ──────────────────────────────────
SELECT pg_temp.msg(:'U', 'outbound', '+393330007010', 'Vecchia risposta', 'bw:393330007010:OLD0', 'baileys', '09:00:00');
SELECT pg_temp.msg(:'U', 'inbound',  '+393330007010', 'Ciao', 'mc-in:m1', 'manychat', '10:00:00');
SELECT pg_temp.msg(:'U', 'outbound', '+393330007010', 'Promemoria domani', 'mc-out:x1', 'manychat', '10:05:00');
SELECT pg_temp.msg(:'U', 'outbound', '+393330007010', 'Promemoria domani', 'bw:393330007010:B1', 'baileys', '10:05:03',
                   (SELECT id FROM public.whatsapp_messages WHERE wa_message_id = 'mc-out:x1'));
INSERT INTO public.whatsapp_contacts (user_id, phone_e164, unread_count, last_message_at, ultimo_in_entrata_il, ultimo_in_entrata_anteprima,
                                      risposto_il, ultimo_messaggio_il, ultimo_messaggio_anteprima, ultimo_messaggio_direzione, non_scrivere_dal)
VALUES (:'U', '+393330007010', 3, '2026-10-31 10:05:03+00', '2026-10-31 10:00:01+00', 'Ciao',
        '2026-10-31 10:05:03+00', '2026-10-31 10:05:00+00', 'Promemoria domani', 'outbound', NULL);

-- cambiato_il vecchio (il trigger lo riscrive a ogni UPDATE: lo si spegne un attimo per invecchiarlo)
ALTER TABLE public.whatsapp_messages DISABLE TRIGGER trg_wa_messaggi_cambiato_il;
UPDATE public.whatsapp_messages SET cambiato_il = '2020-01-01 00:00:00+00';
ALTER TABLE public.whatsapp_messages ENABLE TRIGGER trg_wa_messaggi_cambiato_il;
UPDATE public.whatsapp_contacts SET updated_at = '2020-01-01 00:00:00+00';

CREATE TEMP TABLE prima AS SELECT count(*) AS righe FROM public.whatsapp_messages;

SELECT pg_temp.verifica('701: prima, nessuna riga è eliminata', '0',
  (SELECT count(*)::text FROM public.whatsapp_messages WHERE eliminato_il IS NOT NULL));

SELECT pg_temp.verifica('701: la revoca trova 2 righe (la sua e il pari ManyChat) e le marca', '{"marcate": 2, "trovate": 2}',
  public.ponte_wa_revoca(:'U', 'bw:393330007010:B1')::text);
SELECT pg_temp.verifica('701: marcate B1 e X1, nient''altro', 'B1,X1',
  (SELECT string_agg(CASE WHEN wa_message_id LIKE 'bw:%' THEN 'B1' ELSE 'X1' END, ',' ORDER BY wa_message_id)
     FROM public.whatsapp_messages WHERE eliminato_il IS NOT NULL AND user_id = :'U'));
SELECT pg_temp.verifica('701: le altre righe (entrata M1, vecchia uscita) restano visibili', '2',
  (SELECT count(*)::text FROM public.whatsapp_messages WHERE user_id = :'U' AND eliminato_il IS NULL));
SELECT pg_temp.verifica('701: niente DELETE (stesso numero di righe), i dati restano', (SELECT righe::text FROM prima),
  (SELECT count(*)::text FROM public.whatsapp_messages));
SELECT pg_temp.verifica('701: cambiato_il delle due righe marcate si è mosso (realtime e lettura a pezzi), le altre no', '2|2',
  (SELECT count(*) FILTER (WHERE cambiato_il > '2021-01-01' AND eliminato_il IS NOT NULL)::text || '|' ||
          count(*) FILTER (WHERE cambiato_il < '2021-01-01' AND eliminato_il IS NULL)::text
     FROM public.whatsapp_messages WHERE user_id = :'U'));
SELECT pg_temp.verifica('701: l''anteprima torna all''ultimo messaggio rimasto (l''entrata M1)', '2026-10-31 10:00:00+00|Ciao|inbound',
  (SELECT ultimo_messaggio_il::text || '|' || ultimo_messaggio_anteprima || '|' || ultimo_messaggio_direzione
     FROM public.whatsapp_contacts WHERE phone_e164 = '+393330007010' AND user_id = :'U'));
SELECT pg_temp.verifica('701: last_message_at torna all''ultimo messaggio rimasto', '2026-10-31 10:00:00+00',
  (SELECT last_message_at::text FROM public.whatsapp_contacts WHERE phone_e164 = '+393330007010' AND user_id = :'U'));
SELECT pg_temp.verifica('701: risposto_il torna all''ultima uscita rimasta (09:00): il messaggio eliminato non conta come risposta', '2026-10-31 09:00:00+00',
  (SELECT risposto_il::text FROM public.whatsapp_contacts WHERE phone_e164 = '+393330007010' AND user_id = :'U'));
SELECT pg_temp.verifica('701: del contatto si muove solo updated_at; non letti, ultima entrata, STOP identici', '3|2026-10-31 10:00:01+00|Ciao|true',
  (SELECT unread_count::text || '|' || ultimo_in_entrata_il::text || '|' || ultimo_in_entrata_anteprima || '|' || (updated_at > '2021-01-01' AND non_scrivere_dal IS NULL)::text
     FROM public.whatsapp_contacts WHERE phone_e164 = '+393330007010' AND user_id = :'U'));

-- Ripassare è innocuo: la riga già marcata non si ritocca (il Mac ripassa a 5 min, 30 min e 2 ore).
UPDATE public.whatsapp_messages SET eliminato_il = '2026-10-31 11:00:00+00' WHERE user_id = :'U' AND eliminato_il IS NOT NULL;
SELECT pg_temp.verifica('701: seconda volta: trova 2, marca 0', '{"marcate": 0, "trovate": 2}',
  public.ponte_wa_revoca(:'U', 'bw:393330007010:B1')::text);
SELECT pg_temp.verifica('701: …e l''ora di eliminazione resta la prima', '2',
  (SELECT count(*)::text FROM public.whatsapp_messages WHERE user_id = :'U' AND eliminato_il = '2026-10-31 11:00:00+00'));
SELECT pg_temp.verifica('701: …e il contatto non si riscrive (risposto_il resta 09:00)', '2026-10-31 09:00:00+00',
  (SELECT risposto_il::text FROM public.whatsapp_contacts WHERE phone_e164 = '+393330007010' AND user_id = :'U'));

-- ── 702: il verso inverso ───────────────────────────────────────────────────
SELECT pg_temp.msg(:'U', 'outbound', '+393330007020', 'Conferma appuntamento', 'bw:393330007020:B2', 'baileys', '12:00:00');
SELECT pg_temp.msg(:'U', 'outbound', '+393330007020', 'Conferma appuntamento', 'mc-out:r2', 'manychat', '12:00:02',
                   (SELECT id FROM public.whatsapp_messages WHERE wa_message_id = 'bw:393330007020:B2'));
SELECT pg_temp.verifica('702: la riga nostra che punta a quella del ponte si marca anch''essa', '{"marcate": 2, "trovate": 2}',
  public.ponte_wa_revoca(:'U', 'bw:393330007020:B2')::text);

-- ── 703: un messaggio di un CLIENTE non si nasconde mai ─────────────────────
SELECT pg_temp.msg(:'U', 'inbound', '+393330007030', 'Posso spostare?', 'bw:393330007030:IN1', 'baileys', '13:00:00');
SELECT pg_temp.verifica('703: una riga in entrata con quella chiave: 0 trovate, 0 marcate', '{"marcate": 0, "trovate": 0}',
  public.ponte_wa_revoca(:'U', 'bw:393330007030:IN1')::text);
SELECT pg_temp.verifica('703: …e la riga del cliente è intatta', 'NULL',
  (SELECT coalesce(eliminato_il::text, 'NULL') FROM public.whatsapp_messages WHERE wa_message_id = 'bw:393330007030:IN1'));
-- Il pari di una riga del ponte in entrata non c'entra: neanche una riga di un cliente che punta a una nostra.
SELECT pg_temp.msg(:'U', 'outbound', '+393330007031', 'Ecco il listino', 'bw:393330007031:B9', 'baileys', '13:10:00');
SELECT pg_temp.msg(:'U', 'inbound',  '+393330007031', 'Ecco il listino', 'mc-in:eco9', 'manychat', '13:10:05',
                   (SELECT id FROM public.whatsapp_messages WHERE wa_message_id = 'bw:393330007031:B9'));
SELECT pg_temp.verifica('703: l''eco in entrata che punta a una nostra uscita NON si marca (solo le nostre uscite)', '{"marcate": 1, "trovate": 1}|NULL',
  public.ponte_wa_revoca(:'U', 'bw:393330007031:B9')::text || '|' ||
  (SELECT coalesce(eliminato_il::text, 'NULL') FROM public.whatsapp_messages WHERE wa_message_id = 'mc-in:eco9'));

-- ── 704: la revoca non è l'ultimo messaggio ─────────────────────────────────
SELECT pg_temp.msg(:'U', 'inbound',  '+393330007040', 'Buongiorno', 'mc-in:p1', 'manychat', '09:00:00');
SELECT pg_temp.msg(:'U', 'outbound', '+393330007040', 'Buongiorno a lei', 'bw:393330007040:B3', 'baileys', '10:05:00');
SELECT pg_temp.msg(:'U', 'inbound',  '+393330007040', 'Grazie, a domani', 'mc-in:p2', 'manychat', '11:00:00');
INSERT INTO public.whatsapp_contacts (user_id, phone_e164, unread_count, last_message_at, ultimo_in_entrata_il, ultimo_in_entrata_anteprima,
                                      risposto_il, ultimo_messaggio_il, ultimo_messaggio_anteprima, ultimo_messaggio_direzione)
VALUES (:'U', '+393330007040', 1, '2026-10-31 11:00:00+00', '2026-10-31 11:00:00+00', 'Grazie, a domani',
        '2026-10-31 10:05:00+00', '2026-10-31 11:00:00+00', 'Grazie, a domani', 'inbound');
SELECT public.ponte_wa_revoca(:'U', 'bw:393330007040:B3');
SELECT pg_temp.verifica('704: l''anteprima e l''ordine non cambiano (l''ultimo resta l''entrata delle 11)', '2026-10-31 11:00:00+00|Grazie, a domani|inbound|2026-10-31 11:00:00+00',
  (SELECT ultimo_messaggio_il::text || '|' || ultimo_messaggio_anteprima || '|' || ultimo_messaggio_direzione || '|' || last_message_at::text
     FROM public.whatsapp_contacts WHERE phone_e164 = '+393330007040' AND user_id = :'U'));
SELECT pg_temp.verifica('704: era l''unica risposta: risposto_il torna vuoto (il cliente aspetta di nuovo)', 'NULL',
  (SELECT coalesce(risposto_il::text, 'NULL') FROM public.whatsapp_contacts WHERE phone_e164 = '+393330007040' AND user_id = :'U'));

-- ── 705: «Fatto» a mano non si tocca ────────────────────────────────────────
SELECT pg_temp.msg(:'U', 'outbound', '+393330007050', 'Ok', 'bw:393330007050:B4', 'baileys', '15:00:00');
INSERT INTO public.whatsapp_contacts (user_id, phone_e164, risposto_il, last_message_at, ultimo_messaggio_il, ultimo_messaggio_anteprima, ultimo_messaggio_direzione)
VALUES (:'U', '+393330007050', '2026-10-31 16:00:00+00', '2026-10-31 15:00:00+00', '2026-10-31 15:00:00+00', 'Ok', 'outbound');
SELECT public.ponte_wa_revoca(:'U', 'bw:393330007050:B4');
SELECT pg_temp.verifica('705: risposto_il che non è l''ora del messaggio (un «Fatto») resta com''è', '2026-10-31 16:00:00+00',
  (SELECT risposto_il::text FROM public.whatsapp_contacts WHERE phone_e164 = '+393330007050' AND user_id = :'U'));

-- ── 706: non resta nessun messaggio ─────────────────────────────────────────
SELECT pg_temp.msg(:'U', 'outbound', '+393330007060', 'Ciao!', 'bw:393330007060:B5', 'baileys', '17:00:00');
INSERT INTO public.whatsapp_contacts (user_id, phone_e164, last_message_at, ultimo_messaggio_il, ultimo_messaggio_anteprima, ultimo_messaggio_direzione)
VALUES (:'U', '+393330007060', '2026-10-31 17:00:00+00', '2026-10-31 17:00:00+00', 'Ciao!', 'outbound');
SELECT public.ponte_wa_revoca(:'U', 'bw:393330007060:B5');
SELECT pg_temp.verifica('706: senza messaggi rimasti l''anteprima si svuota; last_message_at resta (il contatto non sparisce dall''ordine)', 'NULL|NULL|NULL|2026-10-31 17:00:00+00',
  (SELECT coalesce(ultimo_messaggio_il::text, 'NULL') || '|' || coalesce(ultimo_messaggio_anteprima, 'NULL') || '|' || coalesce(ultimo_messaggio_direzione, 'NULL') || '|' || last_message_at::text
     FROM public.whatsapp_contacts WHERE phone_e164 = '+393330007060' AND user_id = :'U'));

-- ── 707: numeri senza il «+» ────────────────────────────────────────────────
SELECT pg_temp.msg(:'U', 'inbound',  '393330007070', 'Salve', 'mc-in:s1', 'manychat', '18:00:00');
SELECT pg_temp.msg(:'U', 'outbound', '393330007070', 'Salve a lei', 'bw:393330007070:B6', 'baileys', '18:05:00');
INSERT INTO public.whatsapp_contacts (user_id, phone_e164, last_message_at, ultimo_messaggio_il, ultimo_messaggio_anteprima, ultimo_messaggio_direzione)
VALUES (:'U', '393330007070', '2026-10-31 18:05:00+00', '2026-10-31 18:05:00+00', 'Salve a lei', 'outbound');
SELECT public.ponte_wa_revoca(:'U', 'bw:393330007070:B6');
SELECT pg_temp.verifica('707: contatto e righe senza «+»: l''anteprima torna a «Salve»', 'Salve|inbound',
  (SELECT ultimo_messaggio_anteprima || '|' || ultimo_messaggio_direzione FROM public.whatsapp_contacts WHERE phone_e164 = '393330007070' AND user_id = :'U'));

-- ── Altro utente, chiave sconosciuta, parametri storti ──────────────────────
SELECT pg_temp.msg(:'U2', 'outbound', '+393330007080', 'Di un altro', 'bw:393330007080:B7', 'baileys', '19:00:00');
SELECT pg_temp.verifica('un utente non revoca le righe di un altro (stessa chiave, altro user_id)', '{"marcate": 0, "trovate": 0}|NULL',
  public.ponte_wa_revoca(:'U', 'bw:393330007080:B7')::text || '|' ||
  (SELECT coalesce(eliminato_il::text, 'NULL') FROM public.whatsapp_messages WHERE wa_message_id = 'bw:393330007080:B7'));
SELECT pg_temp.verifica('chiave che non esiste (messaggio non ancora arrivato): 0 e 0, nessun errore', '{"marcate": 0, "trovate": 0}',
  public.ponte_wa_revoca(:'U', 'bw:393330009999:NONESISTE')::text);
SELECT pg_temp.msg(:'U', 'outbound', '+393330007090', 'X', 'bw:393330007090:M', 'manychat', '19:30:00');
SELECT pg_temp.verifica('una riga NON del ponte (canale manychat) con quella forma di chiave non si tocca', '{"marcate": 0, "trovate": 0}',
  public.ponte_wa_revoca(:'U', 'bw:393330007090:M')::text);
DO $$
DECLARE v text;
BEGIN
  FOREACH v IN ARRAY ARRAY['', 'x', 'bw:123:ABC', 'bw:393330007010:', 'bw:39333000701a:AB', 'bw:393330007010:A B', 'mc-out:x1'] LOOP
    BEGIN
      PERFORM public.ponte_wa_revoca('00000000-0000-4000-8000-0000000000a1', v);
      RAISE EXCEPTION 'KO parametri: la chiave «%» doveva essere rifiutata', v;
    EXCEPTION WHEN sqlstate '22023' THEN NULL;
    END;
  END LOOP;
  BEGIN
    PERFORM public.ponte_wa_revoca(NULL, 'bw:393330007010:B1');
    RAISE EXCEPTION 'KO parametri: utente nullo doveva essere rifiutato';
  EXCEPTION WHEN sqlstate '22023' THEN NULL;
  END;
  BEGIN
    PERFORM public.ponte_wa_revoca('00000000-0000-4000-8000-0000000000a1', NULL);
    RAISE EXCEPTION 'KO parametri: chiave nulla doveva essere rifiutata';
  EXCEPTION WHEN sqlstate '22023' THEN NULL;
  END;
  RAISE NOTICE 'ok  parametri storti (chiave vuota, senza bw:, cifre sbagliate, id vuoto o con spazio, utente o chiave nulli): errore 22023, niente scritto';
END $$;

-- ── La funzione è chiusa al browser ─────────────────────────────────────────
SELECT pg_temp.verifica('anon/authenticated non eseguono la funzione; service_role sì', 'false|false|true',
  has_function_privilege('anon', 'public.ponte_wa_revoca(uuid, text)', 'EXECUTE')::text || '|' ||
  has_function_privilege('authenticated', 'public.ponte_wa_revoca(uuid, text)', 'EXECUTE')::text || '|' ||
  has_function_privilege('service_role', 'public.ponte_wa_revoca(uuid, text)', 'EXECUTE')::text);
SELECT pg_temp.verifica('SECURITY DEFINER con search_path fisso', 'true|{"search_path=public, pg_temp"}',
  (SELECT p.prosecdef::text || '|' || p.proconfig::text FROM pg_proc p WHERE p.oid = 'public.ponte_wa_revoca(uuid, text)'::regprocedure));
\echo 'TUTTI I CONTROLLI DELLE REVOCHE PASSANO'
ROLLBACK;
