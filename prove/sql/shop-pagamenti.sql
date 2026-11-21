-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DI S4 (PAGAMENTI E ORDINI) SU UN POSTGRES VERO (commessa
-- 2026-11-20-shop-completo, T41, Rilascio 2)
--
-- NON entra in `npm test` e NON si lancia MAI sul database di produzione: serve un database
-- USA-E-GETTA il cui nome contiene «prova» (lo script si ferma se non è così). Niente transazione
-- di annullamento (la concorrenza si prova con sessioni vere, e una sessione vede solo ciò che l'altra
-- ha confermato): il database resta modificato e poi si butta. Istruzioni: prove/sql/LEGGIMI.md.
--
--   createdb prova_pagamenti
--   psql prova_pagamenti -v ON_ERROR_STOP=1 -f prove/sql/shop-pagamenti.sql   (dalla radice del repo)
--
-- Serve un utente superutente del database di prova (crea ruoli ed estensione dblink) e un Postgres
-- 15 o 16 normale con l'estensione `dblink`. Il database può essere vuoto: lo script crea i ruoli finti
-- `anon`, `authenticated`, `service_role`, `auth.role()` finto, uno schema `storage` finto, la tabella
-- `shop_orders` com'è oggi in produzione (migrazione 20260722160000), poi applica M1 e S1, e IMITA i
-- privilegi larghi che Supabase dà di default agli oggetti nuovi di `public` (S4 deve toglierli con
-- REVOKE). Se la socket del server non è raggiungibile con host/porta letti dalle impostazioni
-- (Postgres senza socket Unix), passa la stringa a mano:
--   psql prova_pagamenti -v conn='dbname=prova_pagamenti host=127.0.0.1 port=5432' -f …
--
-- Cosa prova (ogni controllo stampa `ok  <nome>`, al primo sbagliato si ferma con `KO <nome>: atteso …, avuto …`):
--   · SENZA M1 la migrazione si ferma con un messaggio chiaro e NON scrive niente (nessuna tabella, nessuna colonna);
--   · S4 applicata DUE volte; le righe vecchie di `shop_orders` restano identiche (le 28 colonne nuove ai default);
--     un seme già cambiato non viene riscritto; nessuna policy nuova, nessun trigger;
--   · S4 da sola è INERTE per il checkout di oggi (l'insert esatto come `anon` passa, un update di `authenticated` sulle colonne di prima passa) e
--     CHIUSA sulle colonne nuove: anon e authenticated non possono scriverne nessuna (ordini finti «pagati», 42501);
--   · le 5 tabelle chiuse: RLS accesa e nessuna policy; `anon` e `authenticated` non leggono niente; `service_role` legge ma NON
--     scrive (UPDATE, INSERT, DELETE, TRUNCATE rifiutati); le funzioni le eseguono solo `service_role` e il proprietario;
--   · gli scenari dei soldi di `prove/negozio/_scenari-soldi.json` (marcatori `-- SCENARIO: nome`, 35 per questo file):
--     pagato due volte, importo e valuta diversi, ultimo pezzo, SKU che non si risolve, sessione sostituita, doppio pagamento,
--     riprova con due clic, scadenza a 60 minuti (crea e riapri), rimborso oltre il pagato, rimessa dai soli movimenti, limite con finestra scaduta senza DELETE, …;
--   · DUE SESSIONI VERE (dblink) sulle corse che il finto non vede: stesso pagamento consegnato due volte insieme (una
--     sola scalatura), due ordini insieme sull'ultimo pezzo, due rimborsi insieme oltre il pagato (uno solo), due «riprova»
--     insieme (una sola `riprova_n`), la stessa chiave di rimborso insieme (una riga), due richieste insieme sul limite.
--
-- Dati inventati: nessun nome, numero o indirizzo vero.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
SET client_min_messages = warning;
\if :{?origine}
\else
\set origine 'supabase/migrations/20260722160000_shop_orders.sql'
\endif
\if :{?m1}
\else
\set m1 'supabase/migrations/20261117120000_ecommerce_ordini.sql'
\endif
\if :{?s1}
\else
\set s1 'supabase/migrations/20261120120000_shop_catalogo.sql'
\endif
\if :{?s4}
\else
\set s4 'supabase/migrations/20261122120000_shop_pagamenti.sql'
\endif

-- ── Freno: solo su un database di prova ───────────────────────────────────────
DO $f$
BEGIN
  IF current_database() NOT ILIKE '%prova%' THEN
    RAISE EXCEPTION 'STOP: il database si chiama «%», non contiene «prova». Questo script NON va lanciato qui.', current_database();
  END IF;
END $f$;

\if :{?conn}
\else
SELECT format('dbname=%s port=%s host=%s user=%s', current_database(), current_setting('port'), split_part(current_setting('unix_socket_directories'), ',', 1), current_user) AS conn \gset
\endif

-- ── Il mondo minimo di Supabase ───────────────────────────────────────────────
DO $f$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $f$;
CREATE EXTENSION IF NOT EXISTS dblink;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE IF NOT EXISTS storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE SCHEMA IF NOT EXISTS auth;
-- Finto: dice il ruolo con cui si è collegati (in Supabase lo dice il token).
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $f$ SELECT current_user::text $f$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;

CREATE FUNCTION pg_temp.uguale(nome text, atteso text, avuto text) RETURNS text
LANGUAGE plpgsql AS $f$
BEGIN
  IF atteso IS DISTINCT FROM avuto THEN
    RAISE EXCEPTION 'KO %: atteso «%», avuto «%»', nome, atteso, avuto;
  END IF;
  RETURN 'ok  ' || nome;
END $f$;

-- Esegue un'istruzione con il ruolo dato: 'ok:<righe>' o il codice dell'errore.
CREATE FUNCTION pg_temp.come(ruolo text, istruzione text) RETURNS text
LANGUAGE plpgsql AS $f$
DECLARE n bigint;
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', ruolo);
  EXECUTE istruzione;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  RETURN 'ok:' || n;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RETURN SQLSTATE;
END $f$;

-- Righe che un ruolo vede in una tabella: il numero, o il codice dell'errore (42501 = niente permesso).
CREATE FUNCTION pg_temp.vede(ruolo text, oggetto text) RETURNS text
LANGUAGE plpgsql AS $f$
DECLARE n bigint;
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', ruolo);
  EXECUTE format('SELECT count(*) FROM %s', oggetto) INTO n;
  RESET ROLE;
  RETURN n::text;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RETURN SQLSTATE;
END $f$;

-- Esegue un'istruzione come il proprietario: '' se va, altrimenti «CODICE messaggio». Un errore annulla ciò che l'istruzione ha scritto.
CREATE FUNCTION pg_temp.errore(istruzione text) RETURNS text
LANGUAGE plpgsql AS $f$
BEGIN
  EXECUTE istruzione;
  RETURN '';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE || ' ' || SQLERRM;
END $f$;

-- Il primo valore di una SELECT, come testo (vuoto se non c'è).
CREATE FUNCTION pg_temp.val(istruzione text) RETURNS text
LANGUAGE plpgsql AS $f$
DECLARE r text;
BEGIN
  EXECUTE istruzione INTO r;
  RETURN COALESCE(r, '');
END $f$;

-- Esegue un file SQL INTERO su una connessione a parte (dblink): '' se va, altrimenti «CODICE messaggio». Serve a provare un file che si ferma.
CREATE FUNCTION pg_temp.file_remoto(conn text, testo text) RETURNS text
LANGUAGE plpgsql AS $f$
BEGIN
  PERFORM dblink_connect('file', conn);
  BEGIN
    PERFORM dblink_exec('file', testo);
    PERFORM dblink_disconnect('file');
    RETURN '';
  EXCEPTION WHEN OTHERS THEN
    PERFORM dblink_disconnect('file');
    RETURN SQLSTATE || ' ' || SQLERRM;
  END;
END $f$;

-- Due sessioni vere (dblink). A apre una transazione ed esegue `qa` (e TIENE i blocchi); B manda `qb` e, se tocca le stesse
-- righe, DEVE aspettare; A conferma; B poi riceve il suo esito. Ritorna «<B era in attesa: true|false>|<esito di A>|<esito di B>»
-- (ogni esito è il testo restituito dalla SELECT, o «ERR:» + il messaggio).
CREATE FUNCTION pg_temp.corsa(conn text, qa text, qb text) RETURNS text
LANGUAGE plpgsql AS $f$
DECLARE
  occupato boolean;
  ra text;
  rb text;
BEGIN
  PERFORM dblink_connect('a', conn);
  PERFORM dblink_connect('b', conn);
  PERFORM dblink_exec('a', 'BEGIN');
  SELECT t.r INTO ra FROM dblink('a', qa) AS t(r text);
  PERFORM dblink_send_query('b', qb);
  PERFORM pg_sleep(1);
  occupato := dblink_is_busy('b') = 1;
  PERFORM dblink_exec('a', 'COMMIT');
  BEGIN
    SELECT t.r INTO rb FROM dblink_get_result('b') AS t(r text);
  EXCEPTION WHEN OTHERS THEN
    rb := 'ERR:' || SQLERRM;
  END;
  PERFORM dblink_disconnect('a');
  PERFORM dblink_disconnect('b');
  RETURN occupato::text || '|' || COALESCE(ra, '') || '|' || COALESCE(rb, '');
END $f$;

-- ── 0. La tabella degli ordini com'è in produzione, M1 e S1 (S4 viene dopo) ──
\i :origine
-- Come in Supabase: i ruoli hanno i privilegi di tabella, a decidere è la protezione per riga.
GRANT ALL ON public.shop_orders TO anon, authenticated;
-- Una riga «vecchia» (di prima di M1), per vedere che S4 non la tocchi.
INSERT INTO public.shop_orders (id, order_ref, nome, cognome, email, telefono, indirizzo, citta, cap, items, subtotal, shipping, total, status)
VALUES ('00000000-0000-4000-8000-0000000a0001', 'HG-VECCHIO', 'Anna', 'Esempio', 'vecchio@example.com', '3330000000', 'Via Prova 1', 'Roma', '00100',
        '[{"product_id":"VECCHIO","name":"Vecchio","qty":2,"unit_price":10}]', 20, 0, 20, 'consegnato');

-- ── 1. SENZA M1 la migrazione si ferma e non scrive niente ────────────────────
-- (S1 sì, M1 no: manca `pagato_il`.) Il file intero gira su una connessione a parte; ci si aspetta l'errore del controllo iniziale.
\i :s1
\set s4testo `cat :s4`
SELECT pg_temp.uguale('S4 SENZA M1 si ferma col messaggio chiaro (nomina M1 e il suo file)', 'true',
  (pg_temp.file_remoto(:'conn', :'s4testo') LIKE 'P0001%M1%20261117120000%')::text);
SELECT pg_temp.uguale('… e NON ha scritto niente: nessuna tabella nuova, nessuna colonna nuova su shop_orders', '0|0',
  (SELECT count(*) FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname IN ('shop_ordini_riservati', 'shop_stripe_sessioni', 'shop_stripe_eventi', 'shop_rimborsi', 'shop_limiti'))
  || '|' || (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shop_orders' AND column_name IN ('stato_pagamento', 'totale_cent', 'avvisi')));

-- ── 2. M1, poi S4 DUE volte ───────────────────────────────────────────────────
\i :m1
CREATE TEMP TABLE prima_s4 AS SELECT md5(string_agg(to_jsonb(o)::text, '|' ORDER BY o.id)) AS impronta FROM public.shop_orders o;
\i :s4
\i :s4
\echo 'ok  S4 applicata due volte senza errori'

SELECT pg_temp.uguale('le righe vecchie di shop_orders sono IDENTICHE (a parte le 28 colonne nuove, ai loro default)', 'true',
  ((SELECT md5(string_agg((to_jsonb(o) - ARRAY['stato_pagamento', 'stripe_sessione_id', 'stripe_pagamento_id', 'metodo_dettaglio', 'prova', 'canale', 'totale_cent', 'rimborsato_cent', 'chiave_pubblica_hash', 'firma_tentativo', 'scade_il', 'riprova_n', 'provincia', 'nazione', 'giacenza_da_verificare', 'giacenza_scalata_il', 'giacenza_rimessa_il', 'spedito_il', 'corriere', 'tracking_url', 'senza_tracking', 'annullo_motivo', 'annullato_il', 'fattura_richiesta', 'fattura_emessa_il', 'fattura_nota', 'email_inviate', 'avvisi'])::text, '|' ORDER BY o.id)) FROM public.shop_orders o)
   = (SELECT impronta FROM prima_s4))::text);
SELECT pg_temp.uguale('… e le colonne nuove di una riga vecchia valgono i default: prova false, rimborsato_cent 0, riprova_n 0, giacenza_da_verificare false, fattura_richiesta false, email_inviate {}, avvisi [], il resto vuoto',
  'f|0|0|f|f|{}|[]', (SELECT concat_ws('|', stato_pagamento, prova, rimborsato_cent, riprova_n, giacenza_da_verificare, fattura_richiesta, email_inviate, avvisi, canale) FROM public.shop_orders WHERE id = '00000000-0000-4000-8000-0000000a0001'));
SELECT pg_temp.uguale('S4 aggiunge ESATTAMENTE 28 colonne a shop_orders', '28',
  (SELECT count(*)::text FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shop_orders'
    AND column_name = ANY (ARRAY['stato_pagamento', 'stripe_sessione_id', 'stripe_pagamento_id', 'metodo_dettaglio', 'prova', 'canale', 'totale_cent', 'rimborsato_cent', 'chiave_pubblica_hash', 'firma_tentativo', 'scade_il', 'riprova_n', 'provincia', 'nazione', 'giacenza_da_verificare', 'giacenza_scalata_il', 'giacenza_rimessa_il', 'spedito_il', 'corriere', 'tracking_url', 'senza_tracking', 'annullo_motivo', 'annullato_il', 'fattura_richiesta', 'fattura_emessa_il', 'fattura_nota', 'email_inviate', 'avvisi'])));
SELECT pg_temp.uguale('i tre semi ci sono: cassa_sito «vecchia», pagamento_sicuro false, metodi_pagamento []', '"vecchia"|false|[]',
  (SELECT valore::text FROM public.shop_impostazioni WHERE chiave = 'cassa_sito') || '|' || (SELECT valore::text FROM public.shop_impostazioni WHERE chiave = 'pagamento_sicuro') || '|' || (SELECT valore::text FROM public.shop_impostazioni WHERE chiave = 'metodi_pagamento'));
-- Un seme che il titolare ha già cambiato NON si riscrive rilanciando S4.
UPDATE public.shop_impostazioni SET valore = '"stripe"' WHERE chiave = 'cassa_sito';
UPDATE public.shop_impostazioni SET valore = '["carta"]' WHERE chiave = 'metodi_pagamento';
\i :s4
SELECT pg_temp.uguale('rilanciando S4 i semi già cambiati restano come li ha messi il titolare', '"stripe"|["carta"]',
  (SELECT valore::text FROM public.shop_impostazioni WHERE chiave = 'cassa_sito') || '|' || (SELECT valore::text FROM public.shop_impostazioni WHERE chiave = 'metodi_pagamento'));
UPDATE public.shop_impostazioni SET valore = '"vecchia"' WHERE chiave = 'cassa_sito';
UPDATE public.shop_impostazioni SET valore = '[]' WHERE chiave = 'metodi_pagamento';

\set nuove '(ARRAY[''stato_pagamento'', ''stripe_sessione_id'', ''stripe_pagamento_id'', ''metodo_dettaglio'', ''prova'', ''canale'', ''totale_cent'', ''rimborsato_cent'', ''chiave_pubblica_hash'', ''firma_tentativo'', ''scade_il'', ''riprova_n'', ''provincia'', ''nazione'', ''giacenza_da_verificare'', ''giacenza_scalata_il'', ''giacenza_rimessa_il'', ''spedito_il'', ''corriere'', ''tracking_url'', ''senza_tracking'', ''annullo_motivo'', ''annullato_il'', ''fattura_richiesta'', ''fattura_emessa_il'', ''fattura_nota'', ''email_inviate'', ''avvisi''])'
-- ── 3. S4 da sola è INERTE: policy, trigger, comportamento di oggi ────────────
SELECT pg_temp.uguale('nessuna policy sulle tabelle nuove e le tre di shop_orders (M1) restano com''erano', '0|3',
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('shop_ordini_riservati', 'shop_stripe_sessioni', 'shop_stripe_eventi', 'shop_rimborsi', 'shop_limiti'))
  || '|' || (SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shop_orders' AND policyname IN ('shop_orders_insert_checkout', 'authenticated can read shop orders', 'authenticated can update shop orders')));
SELECT pg_temp.uguale('nessun trigger su shop_orders e sulle tabelle nuove (il trigger è di S4b)', '0',
  (SELECT count(*)::text FROM pg_trigger WHERE NOT tgisinternal AND tgrelid IN ('public.shop_orders'::regclass, 'public.shop_ordini_riservati'::regclass, 'public.shop_stripe_sessioni'::regclass, 'public.shop_stripe_eventi'::regclass, 'public.shop_rimborsi'::regclass, 'public.shop_limiti'::regclass)));
SELECT pg_temp.uguale('l''INSERT ESATTO del checkout di oggi come anon passa', 'ok:1',
  pg_temp.come('anon', $q$INSERT INTO public.shop_orders (order_ref, nome, cognome, email, telefono, indirizzo, citta, cap, note, items, subtotal, shipping, total, status)
    VALUES ('HG-CHECKOUT-OGGI', 'Anna', 'Esempio', 'checkout@example.com', '3330000000', 'Via Prova 1', 'Roma', '00100', NULL, '[{"product_id":"X","qty":1}]', 10, 4.9, 14.9, 'nuovo')$q$));
SELECT pg_temp.uguale('un update di authenticated su un ordine passa come oggi (S4 non ha stretto niente: lo fa S4b)', 'ok:1',
  pg_temp.come('authenticated', $q$UPDATE public.shop_orders SET note_interne = 'prova', pagato_il = now() WHERE order_ref = 'HG-CHECKOUT-OGGI'$q$));
-- Le colonne NUOVE non si scrivono dal browser (revisione di sicurezza): senza S4b nessun anonimo può inserire un ordine finto «pagato».
SELECT pg_temp.uguale('anon NON può inserire un ordine con stato_pagamento «pagato» (colonna nuova): 42501', '42501',
  pg_temp.come('anon', $q$INSERT INTO public.shop_orders (order_ref, nome, cognome, email, telefono, indirizzo, citta, cap, items, subtotal, shipping, total, status, stato_pagamento)
    VALUES ('HG-FINTO-1', 'Anna', 'Esempio', 'finto@example.com', '3330000000', 'Via Prova 1', 'Roma', '00100', '[]', 10, 0, 10, 'nuovo', 'pagato')$q$));
SELECT pg_temp.uguale('… né con canale «sito», totale_cent, prova, avvisi, stripe_pagamento_id, rimborsato_cent, fattura_richiesta, scade_il (ognuna: 42501)', '42501|42501|42501|42501|42501|42501|42501|42501',
  (SELECT string_agg(pg_temp.come('anon', format($q$INSERT INTO public.shop_orders (order_ref, nome, cognome, email, telefono, indirizzo, citta, cap, status, %s) VALUES ('HG-FINTO-2', 'A', 'B', 'f@example.com', '1', 'V', 'R', '00100', 'nuovo', %s)$q$, c, v)), '|' ORDER BY n)
   FROM (VALUES (1, 'canale', quote_literal('sito')), (2, 'totale_cent', '1'), (3, 'prova', 'false'), (4, 'avvisi', quote_literal('[]')), (5, 'stripe_pagamento_id', quote_literal('pi_x')), (6, 'rimborsato_cent', '0'), (7, 'fattura_richiesta', 'true'), (8, 'scade_il', 'now()')) x(n, c, v)));
SELECT pg_temp.uguale('authenticated NON può cambiare dal browser le colonne nuove (stato_pagamento, avvisi, canale, rimborsato_cent): 42501', '42501|42501|42501|42501',
  pg_temp.come('authenticated', $q$UPDATE public.shop_orders SET stato_pagamento = 'pagato' WHERE order_ref = 'HG-CHECKOUT-OGGI'$q$) || '|' || pg_temp.come('authenticated', $q$UPDATE public.shop_orders SET avvisi = '[]' WHERE order_ref = 'HG-CHECKOUT-OGGI'$q$)
  || '|' || pg_temp.come('authenticated', $q$UPDATE public.shop_orders SET canale = 'sito' WHERE order_ref = 'HG-CHECKOUT-OGGI'$q$) || '|' || pg_temp.come('authenticated', $q$UPDATE public.shop_orders SET rimborsato_cent = 5 WHERE order_ref = 'HG-CHECKOUT-OGGI'$q$));
SELECT pg_temp.uguale('i permessi di scrittura del browser sono ESATTAMENTE le colonne di prima: nessuna delle 28 nuove, tutte le altre', '0|0',
  (SELECT count(*)::text FROM pg_attribute a, unnest(ARRAY['anon', 'authenticated']) r, unnest(ARRAY['INSERT', 'UPDATE']) p
    WHERE a.attrelid = 'public.shop_orders'::regclass AND a.attnum > 0 AND NOT a.attisdropped AND a.attname = ANY (:nuove) AND has_column_privilege(r, 'public.shop_orders', a.attname, p))
  || '|' || (SELECT count(*)::text FROM pg_attribute a WHERE a.attrelid = 'public.shop_orders'::regclass AND a.attnum > 0 AND NOT a.attisdropped AND a.attname <> ALL (:nuove)
      AND NOT (has_column_privilege('anon', 'public.shop_orders', a.attname, 'INSERT') AND has_column_privilege('authenticated', 'public.shop_orders', a.attname, 'INSERT') AND has_column_privilege('authenticated', 'public.shop_orders', a.attname, 'UPDATE'))));
SELECT pg_temp.uguale('anon non legge ordini (come oggi) e l''ordine di checkout ha le colonne nuove ai default', '0|false|0',
  pg_temp.vede('anon', 'public.shop_orders') || '|' || (SELECT prova::text FROM public.shop_orders WHERE order_ref = 'HG-CHECKOUT-OGGI') || '|' || (SELECT rimborsato_cent::text FROM public.shop_orders WHERE order_ref = 'HG-CHECKOUT-OGGI'));

-- ── 4. Le cinque tabelle chiuse e le dodici funzioni ──────────────────────────
\set chiuse '(''shop_ordini_riservati'', ''shop_stripe_sessioni'', ''shop_stripe_eventi'', ''shop_rimborsi'', ''shop_limiti'')'
\set funzioni '(''shop_ordine_crea'', ''shop_ordine_sessione_registra'', ''shop_ordine_pagato'', ''shop_ordine_chiudi'', ''shop_ordine_riapri'', ''shop_stripe_evento_registra'', ''shop_stripe_evento_chiudi'', ''shop_rimborso_prenota'', ''shop_rimborso_riconcilia'', ''shop_ordine_giacenza_rimetti'', ''shop_limite_consuma'', ''shop_cassa_righe'')'

SELECT pg_temp.uguale('RLS accesa su tutte e 5 le tabelle chiuse', '5',
  (SELECT count(*)::text FROM pg_class WHERE relnamespace = 'public'::regnamespace AND relname IN :chiuse AND relrowsecurity));
SELECT pg_temp.uguale('anon e authenticated non leggono NESSUNA delle 5 tabelle (42501)', '42501|10',
  (SELECT string_agg(DISTINCT pg_temp.vede(r, 'public.' || t), ',') || '|' || count(*) FROM unnest(ARRAY['anon', 'authenticated']) r, unnest(ARRAY['shop_ordini_riservati', 'shop_stripe_sessioni', 'shop_stripe_eventi', 'shop_rimborsi', 'shop_limiti']) t));
SELECT pg_temp.uguale('service_role LEGGE le 5 tabelle (il CRM deve leggere)', '0',
  (SELECT string_agg(DISTINCT pg_temp.vede('service_role', 'public.' || t), ',') FROM unnest(ARRAY['shop_ordini_riservati', 'shop_stripe_sessioni', 'shop_stripe_eventi', 'shop_rimborsi', 'shop_limiti']) t));
SELECT pg_temp.uguale('… ma NON le scrive: INSERT, UPDATE, DELETE, TRUNCATE tolti su ognuna (20 su 20): «nessuna scrittura diretta»', '20',
  (SELECT count(*)::text FROM unnest(ARRAY['shop_ordini_riservati', 'shop_stripe_sessioni', 'shop_stripe_eventi', 'shop_rimborsi', 'shop_limiti']) t, unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) p
    WHERE NOT has_table_privilege('service_role', 'public.' || t, p)));
SELECT pg_temp.uguale('… e anon e authenticated non hanno NESSUN privilegio su nessuna delle 5', '0',
  (SELECT count(*)::text FROM unnest(ARRAY['shop_ordini_riservati', 'shop_stripe_sessioni', 'shop_stripe_eventi', 'shop_rimborsi', 'shop_limiti']) t, unnest(ARRAY['anon', 'authenticated']) r,
    unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) p WHERE has_table_privilege(r, 'public.' || t, p)));
SELECT pg_temp.uguale('… provato con il ruolo del server: INSERT e UPDATE diretti sulle tabelle chiuse → 42501', '42501|42501|42501',
  pg_temp.come('service_role', $q$INSERT INTO public.shop_rimborsi (ordine_id, importo_cent, motivo, chiave_richiesta) VALUES ('00000000-0000-4000-8000-0000000a0001', 100, 'x', 'diretta')$q$) || '|'
  || pg_temp.come('service_role', $q$UPDATE public.shop_limiti SET conteggio = 0$q$) || '|' || pg_temp.come('service_role', $q$INSERT INTO public.shop_stripe_eventi (id) VALUES ('evt_diretto')$q$));
SELECT pg_temp.uguale('le 12 funzioni di S4 esistono, tutte SECURITY DEFINER con search_path = public', '12|12',
  (SELECT count(*)::text FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN :funzioni)
  || '|' || (SELECT count(*)::text FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND prosecdef AND proconfig = ARRAY['search_path=public'] AND proname IN :funzioni));
SELECT pg_temp.uguale('anon e authenticated NON eseguono nessuna funzione nuova; service_role le esegue tutte', '0|0|12',
  (SELECT count(*)::text FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN :funzioni AND has_function_privilege('anon', oid, 'EXECUTE'))
  || '|' || (SELECT count(*)::text FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN :funzioni AND has_function_privilege('authenticated', oid, 'EXECUTE'))
  || '|' || (SELECT count(*)::text FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN :funzioni AND has_function_privilege('service_role', oid, 'EXECUTE')));
SELECT pg_temp.uguale('le funzioni lavorano col ruolo del server, che sulle tabelle chiuse non scrive: il limite si consuma con service_role', 'ok:1',
  pg_temp.come('service_role', $q$SELECT public.shop_limite_consuma('prova:ruolo-server', 3600, 5)$q$));
SELECT pg_temp.uguale('nessun DELETE, DROP o TRUNCATE nel testo di nessuna funzione di S4', '0',
  (SELECT count(*)::text FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN :funzioni AND prosrc ~* '\m(delete|drop|truncate)\M'));

-- ── 5. Aiuti per gli scenari dei soldi ────────────────────────────────────────
-- Il trigger di pubblicazione di S1 non c'entra con i soldi: nel database di prova i prodotti nascono già «pubblicato».
ALTER TABLE public.shop_prodotti DISABLE TRIGGER USER;

-- Id fissi e leggibili: scenario n, ordine k.
CREATE FUNCTION pg_temp.oid(n integer, k integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $f$
  SELECT ('00000000-0000-4000-8000-' || lpad((n * 100 + k)::text, 12, '0'))::uuid
$f$;

-- Un prodotto con una variante SCn-V1 (prezzo 28,90 €) e la giacenza data.
CREATE FUNCTION pg_temp.mondo(n integer, giacenza integer, attiva boolean DEFAULT true, pubblicato boolean DEFAULT true) RETURNS void LANGUAGE plpgsql AS $f$
DECLARE pid uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.shop_prodotti (id, sku, slug, nome, tipo, stato, prezzo_cent)
  VALUES (pid, 'P-SC' || n, 'prodotto-sc' || n, 'Prodotto SC' || n, 'cura', CASE WHEN pubblicato THEN 'pubblicato' ELSE 'bozza' END, 2890);
  INSERT INTO public.shop_varianti (id, prodotto_id, sku, nome, giacenza, attiva) VALUES (gen_random_uuid(), pid, 'SC' || n || '-V1', 'Unica', giacenza, attiva);
END $f$;

-- Un ordine del sito come lo crea la cassa (con la funzione vera), con le sue sessioni registrate (l'ultima è la corrente).
-- `stato` ('-' = vuoto) e `stato_ordine` si portano poi, da proprietario, dove serve allo scenario.
CREATE FUNCTION pg_temp.ordine(n integer, k integer, sessioni text[] DEFAULT NULL, stato text DEFAULT 'in_attesa', stato_ordine text DEFAULT 'nuovo', sku text DEFAULT NULL, qty integer DEFAULT 1) RETURNS uuid LANGUAGE plpgsql AS $f$
DECLARE
  v_id uuid := pg_temp.oid(n, k);
  s text;
BEGIN
  PERFORM public.shop_ordine_crea(jsonb_build_object(
    'id', v_id, 'order_ref', format('HG-T%s%s', n, k), 'nome', 'Anna', 'cognome', 'Esempio', 'email', 'cliente@example.com', 'telefono', '3330000000',
    'indirizzo', 'Via Prova 1', 'citta', 'Roma', 'cap', '00100', 'provincia', 'RM', 'nazione', 'IT',
    'items', jsonb_build_array(jsonb_build_object('product_id', COALESCE(sku, format('SC%s-V1', n)), 'name', 'Prodotto', 'qty', qty, 'unit_price', 28.9)),
    'subtotal', 28.9, 'shipping', 0, 'total', 28.9, 'totale_cent', 2890, 'scade_il', now() + interval '5 minutes'),  -- un valore che il chiamante PROPONE: lo decide il database (+60 minuti), vedi lo scenario scadenza_sessanta_minuti
    jsonb_build_object('consensi', jsonb_build_object('termini', true, 'privacy', true)));
  FOREACH s IN ARRAY COALESCE(sessioni, ARRAY[format('cs_t%s_%s', n, k)]) LOOP
    PERFORM public.shop_ordine_sessione_registra(v_id, s);
  END LOOP;
  IF stato <> 'in_attesa' OR stato_ordine <> 'nuovo' THEN
    UPDATE public.shop_orders SET stato_pagamento = NULLIF(stato, '-'), status = stato_ordine WHERE id = v_id;
  END IF;
  RETURN v_id;
END $f$;

-- Il pagamento di un ordine (importo e valuta a scelta): «esito|giacenza_da_verificare».
CREATE FUNCTION pg_temp.paga(n integer, k integer, sessione text, importo integer DEFAULT 2890, valuta text DEFAULT 'eur') RETURNS text LANGUAGE plpgsql AS $f$
DECLARE r jsonb;
BEGIN
  r := public.shop_ordine_pagato(pg_temp.oid(n, k), sessione, importo, valuta, 'card', format('pi_t%s%s', n, k));
  RETURN (r ->> 'esito') || COALESCE('|' || (r ->> 'giacenza_da_verificare'), '');
END $f$;

-- Giacenza della variante SCn-V1; una colonna (o espressione) di un ordine; quante volte un avviso è sull'ordine; movimenti di un ordine.
CREATE FUNCTION pg_temp.giac(n integer) RETURNS text LANGUAGE sql AS $f$ SELECT giacenza::text FROM public.shop_varianti WHERE sku = 'SC' || n || '-V1' $f$;
CREATE FUNCTION pg_temp.col(n integer, k integer, colonna text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE r text;
BEGIN
  EXECUTE format('SELECT (%s)::text FROM public.shop_orders WHERE id = $1', colonna) INTO r USING pg_temp.oid(n, k);
  RETURN COALESCE(r, '');
END $f$;
CREATE FUNCTION pg_temp.avvisi(n integer, k integer, codice text) RETURNS text LANGUAGE sql AS $f$
  SELECT count(*)::text FROM public.shop_orders o, jsonb_array_elements(o.avvisi) a WHERE o.id = pg_temp.oid(n, k) AND a ->> 'codice' = codice
$f$;
CREATE FUNCTION pg_temp.mov(ref text, mot text) RETURNS text LANGUAGE sql AS $f$
  SELECT count(*)::text FROM public.shop_giacenza_movimenti WHERE ordine_ref = ref AND motivo = mot
$f$;
-- Un esito jsonb letto per chiave, come testo («esito» o «n»…).
CREATE FUNCTION pg_temp.j(r jsonb, chiave text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT COALESCE(r ->> chiave, '') $f$;

-- ══ GLI SCENARI DEI SOLDI (prove/negozio/_scenari-soldi.json) ═════════════════════════════════════════════════════════

-- SCENARIO: pagato_due_volte
SELECT pg_temp.mondo(1, 5);
SELECT pg_temp.ordine(1, 1);
SELECT pg_temp.uguale('pagato_due_volte · il primo pagamento paga e non lascia la giacenza da verificare', 'pagato_ora|false', pg_temp.paga(1, 1, 'cs_t1_1'));
SELECT pg_temp.uguale('pagato_due_volte · lo stesso pagamento consegnato di nuovo (Stripe ritenta): gia_pagato', 'gia_pagato', pg_temp.paga(1, 1, 'cs_t1_1'));
SELECT pg_temp.uguale('pagato_due_volte · UNA sola scalatura (giacenza 4, un solo movimento «ordine»)', '4|1', pg_temp.giac(1) || '|' || pg_temp.mov('HG-T11', 'ordine'));
SELECT pg_temp.uguale('pagato_due_volte · stato, metodo, importo e id del pagamento scritti DENTRO la stessa funzione', 'pagato|stripe|card|pi_t11|2890|false',
  pg_temp.col(1, 1, 'stato_pagamento') || '|' || pg_temp.col(1, 1, 'metodo_pagamento') || '|' || pg_temp.col(1, 1, 'metodo_dettaglio') || '|' || pg_temp.col(1, 1, 'stripe_pagamento_id') || '|' || pg_temp.col(1, 1, 'round(pagato_importo * 100)') || '|' || pg_temp.col(1, 1, 'giacenza_da_verificare'));
SELECT pg_temp.uguale('pagato_due_volte · una data di pagamento, la data della scalatura e UNA riga «pagato» nel registro eventi', 'true|true|1',
  (pg_temp.col(1, 1, 'pagato_il') <> '')::text || '|' || (pg_temp.col(1, 1, 'giacenza_scalata_il') <> '')::text || '|' || (SELECT count(*)::text FROM public.shop_order_eventi WHERE order_id = pg_temp.oid(1, 1) AND tipo = 'pagato'));

-- SCENARIO: importo_diverso
SELECT pg_temp.mondo(2, 5);
SELECT pg_temp.ordine(2, 1);
SELECT pg_temp.uguale('importo_diverso · Stripe dice 20,00 € ma l''ordine vale 28,90 €: NON paga', 'importo_diverso', pg_temp.paga(2, 1, 'cs_t2_1', 2000));
SELECT pg_temp.uguale('importo_diverso · ordine ancora in attesa, senza data, giacenza intatta, nessun movimento', 'in_attesa||5|0',
  pg_temp.col(2, 1, 'stato_pagamento') || '|' || pg_temp.col(2, 1, 'pagato_il') || '|' || pg_temp.giac(2) || '|' || pg_temp.mov('HG-T21', 'ordine'));
SELECT pg_temp.uguale('importo_diverso · un avviso rosso (importo_diverso) e il suo evento', '1|1',
  pg_temp.avvisi(2, 1, 'importo_diverso') || '|' || (SELECT count(*)::text FROM public.shop_order_eventi WHERE order_id = pg_temp.oid(2, 1) AND tipo = 'importo_diverso'));
SELECT pg_temp.paga(2, 1, 'cs_t2_1', 2000);
SELECT pg_temp.uguale('importo_diverso · lo stesso evento ripetuto (Stripe ritenta) non moltiplica l''avviso', '1', pg_temp.avvisi(2, 1, 'importo_diverso'));

-- SCENARIO: valuta_diversa
SELECT pg_temp.mondo(3, 5);
SELECT pg_temp.ordine(3, 1);
SELECT pg_temp.uguale('valuta_diversa · importo giusto ma valuta usd: NON paga', 'importo_diverso', pg_temp.paga(3, 1, 'cs_t3_1', 2890, 'usd'));
SELECT pg_temp.uguale('valuta_diversa · ordine in attesa, giacenza intatta, avviso valuta_diversa una volta', 'in_attesa||5|1',
  pg_temp.col(3, 1, 'stato_pagamento') || '|' || pg_temp.col(3, 1, 'pagato_il') || '|' || pg_temp.giac(3) || '|' || pg_temp.avvisi(3, 1, 'valuta_diversa'));
SELECT pg_temp.uguale('valuta_diversa · «EUR» maiuscolo è la stessa valuta e paga', 'pagato_ora|false', pg_temp.paga(3, 1, 'cs_t3_1', 2890, 'EUR'));

-- SCENARIO: ultimo_pezzo
SELECT pg_temp.mondo(4, 1);
SELECT pg_temp.ordine(4, 1);
SELECT pg_temp.ordine(4, 2);
SELECT pg_temp.uguale('ultimo_pezzo · il primo cliente scala l''ultimo pezzo', 'pagato_ora|false', pg_temp.paga(4, 1, 'cs_t4_1'));
SELECT pg_temp.uguale('ultimo_pezzo · il secondo è PAGATO lo stesso, ma «da verificare»', 'pagato_ora|true', pg_temp.paga(4, 2, 'cs_t4_2'));
SELECT pg_temp.uguale('ultimo_pezzo · giacenza 0 (mai sotto zero), UN solo movimento', '0|1', pg_temp.giac(4) || '|' || (SELECT count(*)::text FROM public.shop_giacenza_movimenti m JOIN public.shop_varianti v ON v.id = m.variante_id WHERE v.sku = 'SC4-V1' AND m.motivo = 'ordine'));
SELECT pg_temp.uguale('ultimo_pezzo · primo ordine pulito, secondo pagato e da verificare con il suo avviso (una volta)', 'pagato|false|pagato|true|1',
  pg_temp.col(4, 1, 'stato_pagamento') || '|' || pg_temp.col(4, 1, 'giacenza_da_verificare') || '|' || pg_temp.col(4, 2, 'stato_pagamento') || '|' || pg_temp.col(4, 2, 'giacenza_da_verificare') || '|' || pg_temp.avvisi(4, 2, 'giacenza_da_verificare'));

-- SCENARIO: sku_non_risolto
SELECT pg_temp.mondo(5, 5);
SELECT pg_temp.ordine(5, 1, sku => 'SC5-NON-ESISTE');
SELECT pg_temp.uguale('sku_non_risolto · lo SKU non esiste più: l''ordine è pagato lo stesso e «da verificare»', 'pagato_ora|true', pg_temp.paga(5, 1, 'cs_t5_1'));
SELECT pg_temp.uguale('sku_non_risolto · giacenza di un altro SKU intatta, nessuna data di scalatura', '5|pagato|true|',
  pg_temp.giac(5) || '|' || pg_temp.col(5, 1, 'stato_pagamento') || '|' || pg_temp.col(5, 1, 'giacenza_da_verificare') || '|' || pg_temp.col(5, 1, 'giacenza_scalata_il'));

-- SCENARIO: sessione_sconosciuta
SELECT pg_temp.mondo(6, 5);
SELECT pg_temp.ordine(6, 1);
SELECT pg_temp.uguale('sessione_sconosciuta · l''evento porta una sessione che non è dell''ordine: non cambia niente, ma lo dice', 'sessione_sconosciuta', pg_temp.paga(6, 1, 'cs_t6_estranea'));
SELECT pg_temp.uguale('sessione_sconosciuta · ordine in attesa, giacenza intatta, avviso scritto UNA volta (e un evento)', 'in_attesa|5|1|1',
  pg_temp.col(6, 1, 'stato_pagamento') || '|' || pg_temp.giac(6) || '|' || pg_temp.avvisi(6, 1, 'sessione_sconosciuta') || '|' || (SELECT count(*)::text FROM public.shop_order_eventi WHERE order_id = pg_temp.oid(6, 1) AND tipo = 'sessione_sconosciuta'));

-- SCENARIO: ordine_non_trovato
SELECT pg_temp.mondo(7, 5);
SELECT pg_temp.ordine(7, 1);
SELECT pg_temp.uguale('ordine_non_trovato · un ordine che non esiste: non_trovato, senza errore e senza scrivere', 'non_trovato', pg_temp.paga(7, 99, 'cs_t7_1'));
SELECT pg_temp.uguale('ordine_non_trovato · l''altro ordine e la giacenza sono intatti', 'in_attesa|5', pg_temp.col(7, 1, 'stato_pagamento') || '|' || pg_temp.giac(7));

-- SCENARIO: sessione_sostituita
SELECT pg_temp.mondo(8, 5);
SELECT pg_temp.ordine(8, 1, ARRAY['cs_t8_a']);
SELECT pg_temp.uguale('sessione_sostituita · la prima sessione scade', 'chiuso', pg_temp.j(public.shop_ordine_chiudi(pg_temp.oid(8, 1), 'cs_t8_a', 'scaduto'), 'esito'));
SELECT pg_temp.uguale('sessione_sostituita · il cliente riprova: riaperto', 'riaperto', pg_temp.j(public.shop_ordine_riapri(pg_temp.oid(8, 1)), 'esito'));
SELECT pg_temp.uguale('sessione_sostituita · riprova_n = 1 e di nuovo in attesa', '1|in_attesa', pg_temp.col(8, 1, 'riprova_n') || '|' || pg_temp.col(8, 1, 'stato_pagamento'));
SELECT pg_temp.uguale('sessione_sostituita · la seconda sessione si registra', 'registrata', pg_temp.j(public.shop_ordine_sessione_registra(pg_temp.oid(8, 1), 'cs_t8_b'), 'esito'));
SELECT pg_temp.uguale('sessione_sostituita · l''evento della PRIMA sessione, arrivato dopo, paga l''ordine (nessuno scarto silenzioso)', 'pagato_ora', pg_temp.j(public.shop_ordine_pagato(pg_temp.oid(8, 1), 'cs_t8_a', 2890, 'eur', 'card', 'pi_t8'), 'esito'));
SELECT pg_temp.uguale('sessione_sostituita · ordine pagato dalla sessione a, riprova_n 1, giacenza 4, sessione a «pagata»', 'pagato|cs_t8_a|1|4|pagata',
  pg_temp.col(8, 1, 'stato_pagamento') || '|' || pg_temp.col(8, 1, 'stripe_sessione_id') || '|' || pg_temp.col(8, 1, 'riprova_n') || '|' || pg_temp.giac(8) || '|' || (SELECT stato FROM public.shop_stripe_sessioni WHERE sessione_id = 'cs_t8_a'));

-- SCENARIO: doppio_pagamento
SELECT pg_temp.mondo(9, 5);
SELECT pg_temp.ordine(9, 1, ARRAY['cs_t9_a', 'cs_t9_b']);
SELECT pg_temp.uguale('doppio_pagamento · paga la prima sessione', 'pagato_ora', pg_temp.j(public.shop_ordine_pagato(pg_temp.oid(9, 1), 'cs_t9_a', 2890, 'eur', 'card', 'pi_t9a'), 'esito'));
SELECT pg_temp.uguale('doppio_pagamento · poi paga anche l''altra: avviso rosso doppio_pagamento', 'doppio_pagamento', pg_temp.j(public.shop_ordine_pagato(pg_temp.oid(9, 1), 'cs_t9_b', 2890, 'eur', 'card', 'pi_t9b'), 'esito'));
SELECT pg_temp.uguale('doppio_pagamento · se Stripe ripete la consegna: ancora doppio_pagamento, ma l''avviso resta UNO', 'doppio_pagamento|1',
  pg_temp.j(public.shop_ordine_pagato(pg_temp.oid(9, 1), 'cs_t9_b', 2890, 'eur', 'card', 'pi_t9b'), 'esito') || '|' || pg_temp.avvisi(9, 1, 'doppio_pagamento'));
SELECT pg_temp.uguale('doppio_pagamento · giacenza scalata UNA volta, l''ordine resta pagato dalla prima sessione e col suo id di pagamento', '4|pagato|cs_t9_a|pi_t9a',
  pg_temp.giac(9) || '|' || pg_temp.col(9, 1, 'stato_pagamento') || '|' || pg_temp.col(9, 1, 'stripe_sessione_id') || '|' || pg_temp.col(9, 1, 'stripe_pagamento_id'));

-- SCENARIO: pagato_dopo_annullo
SELECT pg_temp.mondo(10, 5);
SELECT pg_temp.ordine(10, 1, stato_ordine => 'annullato');
SELECT pg_temp.uguale('pagato_dopo_annullo · ordine già annullato, pagamento in arrivo: pagato e da verificare', 'pagato_ora|true', pg_temp.paga(10, 1, 'cs_t10_1'));
SELECT pg_temp.uguale('pagato_dopo_annullo · giacenza NON toccata, ordine pagato e ancora annullato, da verificare', '5|pagato|annullato|true',
  pg_temp.giac(10) || '|' || pg_temp.col(10, 1, 'stato_pagamento') || '|' || pg_temp.col(10, 1, 'status') || '|' || pg_temp.col(10, 1, 'giacenza_da_verificare'));
SELECT pg_temp.uguale('pagato_dopo_annullo · avviso pagato_dopo_annullo una volta', '1', pg_temp.avvisi(10, 1, 'pagato_dopo_annullo'));

-- SCENARIO: chiudi_sessione_vecchia
SELECT pg_temp.mondo(11, 5);
SELECT pg_temp.ordine(11, 1, ARRAY['cs_t11_a', 'cs_t11_b']);
SELECT pg_temp.uguale('chiudi_sessione_vecchia · «scaduta» della sessione già sostituita: ignorato', 'ignorato', pg_temp.j(public.shop_ordine_chiudi(pg_temp.oid(11, 1), 'cs_t11_a', 'scaduto'), 'esito'));
SELECT pg_temp.uguale('chiudi_sessione_vecchia · quella della sessione corrente chiude', 'chiuso', pg_temp.j(public.shop_ordine_chiudi(pg_temp.oid(11, 1), 'cs_t11_b', 'scaduto'), 'esito'));
SELECT pg_temp.uguale('chiudi_sessione_vecchia · una seconda chiusura è ignorata (solo da in_attesa)', 'ignorato', pg_temp.j(public.shop_ordine_chiudi(pg_temp.oid(11, 1), 'cs_t11_b', 'scaduto'), 'esito'));
SELECT pg_temp.uguale('chiudi_sessione_vecchia · uno stato che non è fallito/scaduto è un errore', '22023 stato_non_valido',
  pg_temp.errore(format($q$SELECT public.shop_ordine_chiudi(%L, 'cs_t11_b', 'pagato')$q$, pg_temp.oid(11, 1))));
SELECT pg_temp.uguale('chiudi_sessione_vecchia · ordine scaduto, la sessione a segnata «scaduta» anche se la chiusura è stata ignorata', 'scaduto|scaduta',
  pg_temp.col(11, 1, 'stato_pagamento') || '|' || (SELECT stato FROM public.shop_stripe_sessioni WHERE sessione_id = 'cs_t11_a'));

-- SCENARIO: riprova_due_clic
SELECT pg_temp.mondo(12, 5);
SELECT pg_temp.ordine(12, 1, stato => 'fallito');
SELECT pg_temp.uguale('riprova_due_clic · il primo clic riapre: riaperto con riprova_n 1', 'riaperto|1',
  (SELECT pg_temp.j(r, 'esito') || '|' || pg_temp.j(r, 'n') FROM (SELECT public.shop_ordine_riapri(pg_temp.oid(12, 1)) AS r) x));
SELECT pg_temp.uguale('riprova_due_clic · il secondo clic trova l''ordine già in attesa: riprova_in_corso', 'riprova_in_corso', pg_temp.j(public.shop_ordine_riapri(pg_temp.oid(12, 1)), 'esito'));
SELECT pg_temp.uguale('riprova_due_clic · in attesa, riprova_n 1, la nuova scadenza è quella del database (+60 minuti, non quella proposta dal chiamante)', 'in_attesa|1|60',
  pg_temp.col(12, 1, 'stato_pagamento') || '|' || pg_temp.col(12, 1, 'riprova_n') || '|' || (SELECT (extract(epoch FROM scade_il - aggiornato_il) / 60)::integer::text FROM public.shop_orders WHERE id = pg_temp.oid(12, 1)));

-- SCENARIO: scadenza_sessanta_minuti
-- Contratto 1 (revisione di T44): `scade_il` = momento dell'ordine + 60 minuti, deciso dal DATABASE (una sola costante: shop_s4_scadenza). Stripe vuole almeno 30 minuti:
-- con +31 bastava una riprova dopo un minuto per un errore «non ritentabile». Il valore che propone il chiamante (qui +5 minuti, o un anno) non conta.
SELECT pg_temp.mondo(50, 5);
SELECT pg_temp.ordine(50, 1);
SELECT pg_temp.uguale('scadenza_sessanta_minuti · crea: scade_il = created_at + 60 minuti, anche se il chiamante ne propone altri', '60',
  (SELECT (extract(epoch FROM scade_il - created_at) / 60)::integer::text FROM public.shop_orders WHERE id = pg_temp.oid(50, 1)));
-- (la funzione scrive in un'istruzione e si legge in quella dopo: nella stessa istruzione la riga appena scritta non si vede)
CREATE TEMP TABLE risposta_scadenza AS SELECT public.shop_ordine_crea(jsonb_build_object('id', pg_temp.oid(50, 2), 'order_ref', 'HG-T502', 'nome', 'Anna', 'cognome', 'Esempio',
  'email', 'cliente@example.com', 'telefono', '3330000000', 'indirizzo', 'Via Prova 1', 'citta', 'Roma', 'cap', '00100', 'totale_cent', 2890, 'scade_il', now() + interval '1 year'), '{}'::jsonb) AS r;
SELECT pg_temp.uguale('scadenza_sessanta_minuti · crea: anche con una scadenza di un anno proposta, +60 minuti', '60',
  (SELECT (extract(epoch FROM scade_il - created_at) / 60)::integer::text FROM public.shop_orders WHERE id = pg_temp.oid(50, 2)));
SELECT pg_temp.uguale('scadenza_sessanta_minuti · la risposta di crea dice la scadenza (la cassa non deve rileggere la riga)', 'true',
  ((SELECT r ->> 'scade_il' FROM risposta_scadenza)::timestamptz = (SELECT scade_il FROM public.shop_orders WHERE id = pg_temp.oid(50, 2)))::text);
SELECT pg_temp.ordine(50, 4, stato => 'fallito');
SELECT pg_temp.ordine(50, 5, stato => 'scaduto');
CREATE TEMP TABLE risposta_riapri AS SELECT public.shop_ordine_riapri(pg_temp.oid(50, 4)) AS r;
SELECT pg_temp.uguale('scadenza_sessanta_minuti · riapri: +60 minuti da adesso, e la risposta lo dice', 'riaperto|60|true',
  (SELECT pg_temp.j(r, 'esito') || '|' || (extract(epoch FROM (r ->> 'scade_il')::timestamptz - aggiornato_il) / 60)::integer::text || '|'
          || ((r ->> 'scade_il')::timestamptz = scade_il)::text
     FROM risposta_riapri, public.shop_orders WHERE id = pg_temp.oid(50, 4)));
SELECT pg_temp.uguale('scadenza_sessanta_minuti · riapri: +60 minuti dall''aggiornamento (anche da «scaduto»)', 'riaperto|60',
  (SELECT pg_temp.j(r, 'esito') || '|' || (extract(epoch FROM (SELECT scade_il - aggiornato_il FROM public.shop_orders WHERE id = pg_temp.oid(50, 5))) / 60)::integer::text
     FROM (SELECT public.shop_ordine_riapri(pg_temp.oid(50, 5)) AS r) x));

SELECT pg_temp.uguale('scadenza_sessanta_minuti · riapri con un secondo argomento (il vecchio p_nuova_scade) NON esiste: nessuna scadenza decisa fuori', '42883',
  split_part(pg_temp.errore(format($q$SELECT public.shop_ordine_riapri(%L, now() + interval '5 minutes')$q$, pg_temp.oid(50, 5))), ' ', 1));

-- SCENARIO: riapri_da_pagato
SELECT pg_temp.mondo(13, 5);
SELECT pg_temp.ordine(13, 1);
SELECT pg_temp.uguale('riapri_da_pagato · paga', 'pagato_ora|false', pg_temp.paga(13, 1, 'cs_t13_1'));
SELECT pg_temp.uguale('riapri_da_pagato · un ordine pagato non si riapre mai', '55000 ordine_non_riapribile',
  pg_temp.errore(format($q$SELECT public.shop_ordine_riapri(%L)$q$, pg_temp.oid(13, 1))));
SELECT pg_temp.uguale('riapri_da_pagato · e niente cambia', 'pagato|0', pg_temp.col(13, 1, 'stato_pagamento') || '|' || pg_temp.col(13, 1, 'riprova_n'));

-- SCENARIO: crea_due_volte
SELECT pg_temp.mondo(14, 5);
SELECT pg_temp.uguale('crea_due_volte · il primo insert crea (e i campi di stato li mette la funzione, non il chiamante)', 'creato',
  pg_temp.j(public.shop_ordine_crea(jsonb_build_object('id', pg_temp.oid(14, 1), 'order_ref', 'HG-T141', 'nome', 'Anna', 'cognome', 'Esempio', 'email', 'cliente0@example.com', 'telefono', '3330000000', 'indirizzo', 'Via Prova 1', 'citta', 'Roma', 'cap', '00100',
    'totale_cent', 2890, 'stato_pagamento', 'pagato', 'pagato_il', '2026-11-20T11:00:00Z', 'rimborsato_cent', 500, 'items', jsonb_build_array(jsonb_build_object('product_id', 'SC14-V1', 'name', 'Prodotto', 'qty', 1, 'unit_price', 28.9))),
    jsonb_build_object('consensi', jsonb_build_object('termini', true, 'privacy', true))), 'esito'));
SELECT pg_temp.uguale('crea_due_volte · la seconda volta con lo stesso id: esistente, e l''id', 'esistente|' || pg_temp.oid(14, 1),
  (SELECT pg_temp.j(r, 'esito') || '|' || pg_temp.j(r, 'id') FROM (SELECT public.shop_ordine_crea(jsonb_build_object('id', pg_temp.oid(14, 1), 'order_ref', 'HG-T141', 'nome', 'Anna', 'cognome', 'Esempio', 'email', 'cliente0@example.com', 'telefono', '3330000000', 'indirizzo', 'Via Prova 1', 'citta', 'Roma', 'cap', '00100', 'totale_cent', 2890), '{}'::jsonb) AS r) x));
SELECT pg_temp.uguale('crea_due_volte · UNA riga d''ordine e UNA riga dei riservati', '1|1',
  (SELECT count(*)::text FROM public.shop_orders WHERE id = pg_temp.oid(14, 1)) || '|' || (SELECT count(*)::text FROM public.shop_ordini_riservati WHERE ordine_id = pg_temp.oid(14, 1)));
SELECT pg_temp.uguale('crea_due_volte · stato deciso dalla funzione: in_attesa, sito, nuovo, senza data di pagamento, rimborsato 0', 'in_attesa|sito|nuovo||0',
  pg_temp.col(14, 1, 'stato_pagamento') || '|' || pg_temp.col(14, 1, 'canale') || '|' || pg_temp.col(14, 1, 'status') || '|' || pg_temp.col(14, 1, 'pagato_il') || '|' || pg_temp.col(14, 1, 'rimborsato_cent'));
SELECT pg_temp.uguale('crea_due_volte · i riservati portano i consensi, e l''ordine un evento «creato»', 'true|1',
  (SELECT (consensi ->> 'termini') FROM public.shop_ordini_riservati WHERE ordine_id = pg_temp.oid(14, 1)) || '|' || (SELECT count(*)::text FROM public.shop_order_eventi WHERE order_id = pg_temp.oid(14, 1) AND tipo = 'creato'));
SELECT pg_temp.uguale('crea_due_volte · senza id valido: ordine_non_valido', '22023 ordine_non_valido', pg_temp.errore($q$SELECT public.shop_ordine_crea('{"order_ref":"X"}'::jsonb, '{}'::jsonb)$q$));

-- SCENARIO: riferimento_doppio
SELECT pg_temp.uguale('riferimento_doppio · il primo ordine con quel riferimento passa', 'creato',
  pg_temp.j(public.shop_ordine_crea(jsonb_build_object('id', pg_temp.oid(15, 1), 'order_ref', 'HG-T151', 'nome', 'Anna', 'cognome', 'Esempio', 'email', 'cliente0@example.com', 'telefono', '3330000000', 'indirizzo', 'Via Prova 1', 'citta', 'Roma', 'cap', '00100', 'totale_cent', 2890), '{}'::jsonb), 'esito'));
SELECT pg_temp.uguale('riferimento_doppio · un secondo ordine del sito con lo stesso riferimento: 23505', '23505',
  split_part(pg_temp.errore($q$SELECT public.shop_ordine_crea(jsonb_build_object('id', '00000000-0000-4000-8000-000000001502', 'order_ref', 'HG-T151', 'nome', 'Anna', 'cognome', 'Esempio', 'email', 'cliente0@example.com', 'telefono', '3330000000', 'indirizzo', 'Via Prova 1', 'citta', 'Roma', 'cap', '00100', 'totale_cent', 2890), '{"consensi":{"termini":true}}'::jsonb)$q$), ' ', 1));
SELECT pg_temp.uguale('riferimento_doppio · niente a metà: una sola riga d''ordine, una sola dei riservati', '1|1',
  (SELECT count(*)::text FROM public.shop_orders WHERE order_ref = 'HG-T151') || '|' || (SELECT count(*)::text FROM public.shop_ordini_riservati WHERE ordine_id IN (pg_temp.oid(15, 1), '00000000-0000-4000-8000-000000001502')));
SELECT pg_temp.uguale('riferimento_doppio · il vincolo vale SOLO per il sito: un ordine vecchio (canale vuoto) con lo stesso riferimento è ammesso', '',
  pg_temp.errore($q$INSERT INTO public.shop_orders (order_ref, nome, cognome, email, telefono, indirizzo, citta, cap) VALUES ('HG-T151', 'Anna', 'Esempio', 'x@example.com', '3330000000', 'Via Prova 1', 'Roma', '00100')$q$));

-- SCENARIO: sessione_registra
SELECT pg_temp.mondo(16, 5);
SELECT pg_temp.ordine(16, 1, ARRAY['cs_t16_a']);
SELECT pg_temp.ordine(16, 2, ARRAY['cs_t16_b']);
SELECT pg_temp.uguale('sessione_registra · una sessione nuova si registra', 'registrata', pg_temp.j(public.shop_ordine_sessione_registra(pg_temp.oid(16, 1), 'cs_t16_c'), 'esito'));
SELECT pg_temp.uguale('sessione_registra · la stessa di nuovo: già registrata', 'gia_registrata', pg_temp.j(public.shop_ordine_sessione_registra(pg_temp.oid(16, 1), 'cs_t16_c'), 'esito'));
SELECT pg_temp.uguale('sessione_registra · la stessa sessione su un ALTRO ordine: 23505', '23505',
  split_part(pg_temp.errore(format($q$SELECT public.shop_ordine_sessione_registra(%L, 'cs_t16_c')$q$, pg_temp.oid(16, 2))), ' ', 1));
SELECT pg_temp.uguale('sessione_registra · la corrente è l''ultima e le sessioni dell''ordine sono due', 'cs_t16_c|2',
  pg_temp.col(16, 1, 'stripe_sessione_id') || '|' || (SELECT count(*)::text FROM public.shop_stripe_sessioni WHERE ordine_id = pg_temp.oid(16, 1)));
SELECT pg_temp.uguale('sessione_registra · un ordine che non c''è: ordine_non_trovato; una sessione vuota: parametro_non_valido', '#P0002 ordine_non_trovato#22023 parametro_non_valido',
  '#' || pg_temp.errore($q$SELECT public.shop_ordine_sessione_registra('00000000-0000-4000-8000-000000009999', 'cs_x')$q$) || '#' || pg_temp.errore(format($q$SELECT public.shop_ordine_sessione_registra(%L, '')$q$, pg_temp.oid(16, 1))));

-- SCENARIO: rimborso_oltre_pagato
SELECT pg_temp.mondo(17, 5);
SELECT pg_temp.ordine(17, 1);
SELECT pg_temp.uguale('rimborso_oltre_pagato · paga', 'pagato_ora|false', pg_temp.paga(17, 1, 'cs_t17_1'));
SELECT pg_temp.uguale('rimborso_oltre_pagato · 20,00 € su 28,90 €: prenotato', 'prenotato', pg_temp.j(public.shop_rimborso_prenota(pg_temp.oid(17, 1), 2000, 'reso', 'chiave-17-1', 'titolare'), 'esito'));
SELECT pg_temp.uguale('rimborso_oltre_pagato · altri 10,00 €: oltre il pagato, rifiutato', '23514 rimborso_oltre_pagato',
  pg_temp.errore(format($q$SELECT public.shop_rimborso_prenota(%L, 1000, 'reso', 'chiave-17-2', 'titolare')$q$, pg_temp.oid(17, 1))));
SELECT pg_temp.uguale('rimborso_oltre_pagato · 8,90 € (il resto esatto): prenotato', 'prenotato', pg_temp.j(public.shop_rimborso_prenota(pg_temp.oid(17, 1), 890, 'reso', 'chiave-17-3', 'titolare'), 'esito'));
SELECT pg_temp.uguale('rimborso_oltre_pagato · un centesimo di più: rifiutato', '23514 rimborso_oltre_pagato',
  pg_temp.errore(format($q$SELECT public.shop_rimborso_prenota(%L, 1, 'reso', 'chiave-17-4', 'titolare')$q$, pg_temp.oid(17, 1))));
SELECT pg_temp.uguale('rimborso_oltre_pagato · due righe «richiesto», una per rimborso prenotato; il rifiutato non lascia niente', '2|2',
  (SELECT count(*)::text FROM public.shop_rimborsi WHERE ordine_id = pg_temp.oid(17, 1)) || '|' || (SELECT count(*)::text FROM public.shop_rimborsi WHERE ordine_id = pg_temp.oid(17, 1) AND stato = 'richiesto'));

-- SCENARIO: rimborso_stessa_chiave
SELECT pg_temp.mondo(18, 5);
SELECT pg_temp.ordine(18, 1);
SELECT pg_temp.uguale('rimborso_stessa_chiave · paga', 'pagato_ora|false', pg_temp.paga(18, 1, 'cs_t18_1'));
SELECT pg_temp.uguale('rimborso_stessa_chiave · il primo clic prenota', 'prenotato', pg_temp.j(public.shop_rimborso_prenota(pg_temp.oid(18, 1), 1000, 'reso', 'chiave-18-1', 'titolare'), 'esito'));
SELECT pg_temp.uguale('rimborso_stessa_chiave · lo stesso clic di nuovo rimanda alla STESSA riga', 'esistente|true',
  (SELECT pg_temp.j(r, 'esito') || '|' || (pg_temp.j(r, 'id') = (SELECT id::text FROM public.shop_rimborsi WHERE chiave_richiesta = 'chiave-18-1'))::text FROM (SELECT public.shop_rimborso_prenota(pg_temp.oid(18, 1), 1000, 'reso', 'chiave-18-1', 'titolare') AS r) x));
SELECT pg_temp.uguale('rimborso_stessa_chiave · UNA riga sola', '1', (SELECT count(*)::text FROM public.shop_rimborsi WHERE ordine_id = pg_temp.oid(18, 1)));

-- SCENARIO: rimborso_non_ammesso
SELECT pg_temp.mondo(19, 5);
SELECT pg_temp.ordine(19, 1);
SELECT pg_temp.uguale('rimborso_non_ammesso · su un ordine NON pagato: ordine_non_pagato', '55000 ordine_non_pagato',
  pg_temp.errore(format($q$SELECT public.shop_rimborso_prenota(%L, 1000, 'reso', 'chiave-19-1', 'titolare')$q$, pg_temp.oid(19, 1))));
SELECT pg_temp.uguale('rimborso_non_ammesso · paga', 'pagato_ora|false', pg_temp.paga(19, 1, 'cs_t19_1'));
SELECT pg_temp.uguale('rimborso_non_ammesso · importo zero: rimborso_importo_non_valido', '22023 rimborso_importo_non_valido',
  pg_temp.errore(format($q$SELECT public.shop_rimborso_prenota(%L, 0, 'reso', 'chiave-19-2', 'titolare')$q$, pg_temp.oid(19, 1))));
SELECT pg_temp.uguale('rimborso_non_ammesso · motivo di soli spazi: rimborso_importo_non_valido', '22023 rimborso_importo_non_valido',
  pg_temp.errore(format($q$SELECT public.shop_rimborso_prenota(%L, 100, '  ', 'chiave-19-3', 'titolare')$q$, pg_temp.oid(19, 1))));
SELECT pg_temp.uguale('rimborso_non_ammesso · un ordine che non c''è: ordine_non_trovato', 'P0002 ordine_non_trovato',
  pg_temp.errore($q$SELECT public.shop_rimborso_prenota('00000000-0000-4000-8000-000000009999', 100, 'reso', 'chiave-19-4', 'titolare')$q$));
SELECT pg_temp.uguale('rimborso_non_ammesso · nessuna riga di rimborso è rimasta', '0', (SELECT count(*)::text FROM public.shop_rimborsi WHERE ordine_id = pg_temp.oid(19, 1)));

-- SCENARIO: rimborsi_riconciliati
SELECT pg_temp.mondo(20, 5);
SELECT pg_temp.ordine(20, 1);
SELECT pg_temp.uguale('rimborsi_riconciliati · paga', 'pagato_ora|false', pg_temp.paga(20, 1, 'cs_t20_1'));
SELECT pg_temp.uguale('rimborsi_riconciliati · prenota 10,00 €', 'prenotato', pg_temp.j(public.shop_rimborso_prenota(pg_temp.oid(20, 1), 1000, 'reso', 'chiave-20-1', 'titolare'), 'esito'));
SELECT pg_temp.uguale('rimborsi_riconciliati · l''elenco di Stripe: il nostro (metadata.riga_id) + uno fatto dal pannello Stripe → 15,00 €, rimborsato in parte', '1500|rimborsato_in_parte',
  (SELECT pg_temp.j(r, 'rimborsato_cent') || '|' || pg_temp.j(r, 'stato_pagamento') FROM (SELECT public.shop_rimborso_riconcilia(pg_temp.oid(20, 1), jsonb_build_array(
    jsonb_build_object('id', 're_t20_1', 'amount', 1000, 'status', 'succeeded', 'metadata', jsonb_build_object('riga_id', (SELECT id FROM public.shop_rimborsi WHERE chiave_richiesta = 'chiave-20-1'))),
    jsonb_build_object('id', 're_t20_2', 'amount', 500, 'status', 'succeeded', 'metadata', '{}'::jsonb)), false) AS r) x));
SELECT pg_temp.uguale('rimborsi_riconciliati · un terzo rimborso dal pannello copre il resto: rimborsato per intero', '2890|rimborsato',
  (SELECT pg_temp.j(r, 'rimborsato_cent') || '|' || pg_temp.j(r, 'stato_pagamento') FROM (SELECT public.shop_rimborso_riconcilia(pg_temp.oid(20, 1), jsonb_build_array(
    jsonb_build_object('id', 're_t20_1', 'amount', 1000, 'status', 'succeeded', 'metadata', jsonb_build_object('riga_id', (SELECT id FROM public.shop_rimborsi WHERE chiave_richiesta = 'chiave-20-1'))),
    jsonb_build_object('id', 're_t20_2', 'amount', 500, 'status', 'succeeded', 'metadata', '{}'::jsonb),
    jsonb_build_object('id', 're_t20_3', 'amount', 1390, 'status', 'succeeded', 'metadata', '{}'::jsonb)), false) AS r) x));
SELECT pg_temp.uguale('rimborsi_riconciliati · rimborsato per intero: un altro rimborso non si prenota', '23514 rimborso_oltre_pagato',
  pg_temp.errore(format($q$SELECT public.shop_rimborso_prenota(%L, 1, 'reso', 'chiave-20-2', 'titolare')$q$, pg_temp.oid(20, 1))));
SELECT pg_temp.uguale('rimborsi_riconciliati · 3 righe, 2 con origine stripe, la nostra agganciata a re_t20_1 e riuscita', '3|2|1',
  (SELECT count(*)::text FROM public.shop_rimborsi WHERE ordine_id = pg_temp.oid(20, 1)) || '|' || (SELECT count(*)::text FROM public.shop_rimborsi WHERE ordine_id = pg_temp.oid(20, 1) AND origine = 'stripe')
  || '|' || (SELECT count(*)::text FROM public.shop_rimborsi WHERE ordine_id = pg_temp.oid(20, 1) AND origine = 'crm' AND stato = 'riuscito' AND stripe_rimborso_id = 're_t20_1'));
SELECT pg_temp.uguale('rimborsi_riconciliati · l''ordine dice rimborsato 2890', 'rimborsato|2890', pg_temp.col(20, 1, 'stato_pagamento') || '|' || pg_temp.col(20, 1, 'rimborsato_cent'));

-- SCENARIO: rimborso_fallito_torna_pagato
SELECT pg_temp.mondo(21, 5);
SELECT pg_temp.ordine(21, 1);
SELECT pg_temp.uguale('rimborso_fallito_torna_pagato · paga', 'pagato_ora|false', pg_temp.paga(21, 1, 'cs_t21_1'));
SELECT pg_temp.uguale('rimborso_fallito_torna_pagato · prenota 10,00 €', 'prenotato', pg_temp.j(public.shop_rimborso_prenota(pg_temp.oid(21, 1), 1000, 'reso', 'chiave-21-1', 'titolare'), 'esito'));
SELECT pg_temp.uguale('rimborso_fallito_torna_pagato · Stripe lo dice riuscito: rimborsato in parte', '1000|rimborsato_in_parte',
  (SELECT pg_temp.j(r, 'rimborsato_cent') || '|' || pg_temp.j(r, 'stato_pagamento') FROM (SELECT public.shop_rimborso_riconcilia(pg_temp.oid(21, 1), jsonb_build_array(
    jsonb_build_object('id', 're_t21_1', 'amount', 1000, 'status', 'succeeded', 'metadata', jsonb_build_object('riga_id', (SELECT id FROM public.shop_rimborsi WHERE chiave_richiesta = 'chiave-21-1')))), false) AS r) x));
SELECT pg_temp.uguale('rimborso_fallito_torna_pagato · poi dice «failed»: la riga diventa fallita, il massimo si libera, l''ordine torna pagato', '0|pagato',
  (SELECT pg_temp.j(r, 'rimborsato_cent') || '|' || pg_temp.j(r, 'stato_pagamento') FROM (SELECT public.shop_rimborso_riconcilia(pg_temp.oid(21, 1), jsonb_build_array(
    jsonb_build_object('id', 're_t21_1', 'amount', 1000, 'status', 'failed', 'metadata', jsonb_build_object('riga_id', (SELECT id FROM public.shop_rimborsi WHERE chiave_richiesta = 'chiave-21-1')))), false) AS r) x));
SELECT pg_temp.uguale('rimborso_fallito_torna_pagato · ora si può rimborsare tutto', 'prenotato', pg_temp.j(public.shop_rimborso_prenota(pg_temp.oid(21, 1), 2890, 'reso', 'chiave-21-2', 'titolare'), 'esito'));
SELECT pg_temp.uguale('rimborso_fallito_torna_pagato · una riga fallita, ordine pagato con rimborsato 0', '1|pagato|0',
  (SELECT count(*)::text FROM public.shop_rimborsi WHERE ordine_id = pg_temp.oid(21, 1) AND stato = 'fallito') || '|' || pg_temp.col(21, 1, 'stato_pagamento') || '|' || pg_temp.col(21, 1, 'rimborsato_cent'));

-- SCENARIO: rimborso_orfano
SELECT pg_temp.mondo(22, 5);
SELECT pg_temp.ordine(22, 1);
SELECT pg_temp.uguale('rimborso_orfano · paga', 'pagato_ora|false', pg_temp.paga(22, 1, 'cs_t22_1'));
SELECT pg_temp.uguale('rimborso_orfano · prenota 28,90 €', 'prenotato', pg_temp.j(public.shop_rimborso_prenota(pg_temp.oid(22, 1), 2890, 'reso', 'chiave-22-1', 'titolare'), 'esito'));
UPDATE public.shop_rimborsi SET creato_il = now() - interval '5 minutes' WHERE chiave_richiesta = 'chiave-22-1';
SELECT pg_temp.uguale('rimborso_orfano · dopo 5 minuti «Controlla con Stripe» NON lo chiude (Stripe può essere in ritardo)', '0|pagato',
  (SELECT pg_temp.j(r, 'rimborsato_cent') || '|' || pg_temp.j(r, 'stato_pagamento') FROM (SELECT public.shop_rimborso_riconcilia(pg_temp.oid(22, 1), '[]'::jsonb, true) AS r) x));
SELECT pg_temp.uguale('rimborso_orfano · e il massimo resta impegnato: un altro rimborso è oltre il pagato', '23514 rimborso_oltre_pagato',
  pg_temp.errore(format($q$SELECT public.shop_rimborso_prenota(%L, 100, 'reso', 'chiave-22-2', 'titolare')$q$, pg_temp.oid(22, 1))));
UPDATE public.shop_rimborsi SET creato_il = now() - interval '11 minutes' WHERE chiave_richiesta = 'chiave-22-1';
SELECT pg_temp.uguale('rimborso_orfano · dopo 11 minuti, senza un rimborso su Stripe, la riga diventa fallita', '0|pagato',
  (SELECT pg_temp.j(r, 'rimborsato_cent') || '|' || pg_temp.j(r, 'stato_pagamento') FROM (SELECT public.shop_rimborso_riconcilia(pg_temp.oid(22, 1), '[]'::jsonb, true) AS r) x));
SELECT pg_temp.uguale('rimborso_orfano · ora il massimo è libero: si rimborsa tutto', 'prenotato', pg_temp.j(public.shop_rimborso_prenota(pg_temp.oid(22, 1), 2890, 'reso', 'chiave-22-3', 'titolare'), 'esito'));
SELECT pg_temp.uguale('rimborso_orfano · una riga fallita e una richiesta', '1|1',
  (SELECT count(*)::text FROM public.shop_rimborsi WHERE ordine_id = pg_temp.oid(22, 1) AND stato = 'fallito') || '|' || (SELECT count(*)::text FROM public.shop_rimborsi WHERE ordine_id = pg_temp.oid(22, 1) AND stato = 'richiesto'));

-- SCENARIO: rimessa_idempotente
SELECT pg_temp.mondo(23, 5);
SELECT pg_temp.ordine(23, 1);
SELECT pg_temp.uguale('rimessa_idempotente · paga (giacenza 4)', 'pagato_ora|false', pg_temp.paga(23, 1, 'cs_t23_1'));
SELECT pg_temp.uguale('rimessa_idempotente · l''annullo con «rimetti in magazzino»: rimessa, 1 pezzo', 'rimessa|1', (SELECT pg_temp.j(r, 'esito') || '|' || pg_temp.j(r, 'pezzi') FROM (SELECT public.shop_ordine_giacenza_rimetti(pg_temp.oid(23, 1), 'titolare') AS r) x));
SELECT pg_temp.uguale('rimessa_idempotente · il tasto premuto due volte: già rimessa, 0 pezzi', 'gia_rimessa|0', (SELECT pg_temp.j(r, 'esito') || '|' || pg_temp.j(r, 'pezzi') FROM (SELECT public.shop_ordine_giacenza_rimetti(pg_temp.oid(23, 1), 'titolare') AS r) x));
SELECT pg_temp.uguale('rimessa_idempotente · giacenza di nuovo 5, due movimenti (uno «ordine», uno «annullo_ordine» di +1), data della rimessa scritta', '5|2|1|true',
  pg_temp.giac(23) || '|' || (SELECT count(*)::text FROM public.shop_giacenza_movimenti WHERE ordine_ref = 'HG-T231') || '|' || (SELECT count(*)::text FROM public.shop_giacenza_movimenti WHERE ordine_ref = 'HG-T231' AND motivo = 'annullo_ordine' AND delta = 1)
  || '|' || (pg_temp.col(23, 1, 'giacenza_rimessa_il') <> '')::text);

-- SCENARIO: rimessa_solo_dai_movimenti
SELECT pg_temp.mondo(24, 1);
SELECT pg_temp.ordine(24, 1);
SELECT pg_temp.ordine(24, 2);
SELECT pg_temp.uguale('rimessa_solo_dai_movimenti · il primo scala l''ultimo pezzo', 'pagato_ora|false', pg_temp.paga(24, 1, 'cs_t24_1'));
SELECT pg_temp.uguale('rimessa_solo_dai_movimenti · il secondo è pagato ma non scalato (da verificare)', 'pagato_ora|true', pg_temp.paga(24, 2, 'cs_t24_2'));
SELECT pg_temp.uguale('rimessa_solo_dai_movimenti · annullo con «rimetti» del secondo: nessun pezzo (i movimenti non dicono niente)', 'rimessa|0', (SELECT pg_temp.j(r, 'esito') || '|' || pg_temp.j(r, 'pezzi') FROM (SELECT public.shop_ordine_giacenza_rimetti(pg_temp.oid(24, 2), 'titolare') AS r) x));
SELECT pg_temp.uguale('rimessa_solo_dai_movimenti · annullo del primo: rimette 1', 'rimessa|1', (SELECT pg_temp.j(r, 'esito') || '|' || pg_temp.j(r, 'pezzi') FROM (SELECT public.shop_ordine_giacenza_rimetti(pg_temp.oid(24, 1), 'titolare') AS r) x));
SELECT pg_temp.uguale('rimessa_solo_dai_movimenti · nessuna scorta fantasma: la giacenza è 1, come all''inizio', '1', pg_temp.giac(24));

-- SCENARIO: evento_idempotenza
SELECT pg_temp.uguale('evento_idempotenza · un evento mai visto è nuovo', 'nuovo', public.shop_stripe_evento_registra('evt_t25_1', 'checkout.session.completed', pg_temp.oid(25, 1)));
SELECT pg_temp.uguale('evento_idempotenza · ricevuto ma non chiuso (crash): da_rielaborare', 'da_rielaborare', public.shop_stripe_evento_registra('evt_t25_1', 'checkout.session.completed', pg_temp.oid(25, 1)));
SELECT pg_temp.uguale('evento_idempotenza · chiuso: la funzione dice che c''era', 'true', public.shop_stripe_evento_chiudi('evt_t25_1', 'ok')::text);
SELECT pg_temp.uguale('evento_idempotenza · dopo la chiusura: gia_elaborato', 'gia_elaborato', public.shop_stripe_evento_registra('evt_t25_1', 'checkout.session.completed', pg_temp.oid(25, 1)));
SELECT pg_temp.uguale('evento_idempotenza · chiudere un evento mai visto: false', 'false', public.shop_stripe_evento_chiudi('evt_t25_mai_visto', 'ok')::text);
SELECT pg_temp.uguale('evento_idempotenza · UNA riga, con esito e data di elaborazione; senza id valido: parametro_non_valido', '1|ok|true|22023 parametro_non_valido',
  (SELECT count(*)::text FROM public.shop_stripe_eventi WHERE id LIKE 'evt\_t25\_%') || '|' || (SELECT esito FROM public.shop_stripe_eventi WHERE id = 'evt_t25_1') || '|' || (SELECT (elaborato_il IS NOT NULL)::text FROM public.shop_stripe_eventi WHERE id = 'evt_t25_1')
  || '|' || pg_temp.errore($q$SELECT public.shop_stripe_evento_registra('', 'x', NULL)$q$));
SELECT pg_temp.uguale('evento_idempotenza · l''ordine dell''evento può non esistere (un client_reference_id qualunque): nessuna chiave esterna', '1',
  (SELECT count(*)::text FROM public.shop_stripe_eventi WHERE id = 'evt_t25_1' AND ordine_id = pg_temp.oid(25, 1)));

-- SCENARIO: limite_finestra
SELECT pg_temp.uguale('limite_finestra · dieci richieste passano', 'true|true|true|true|true|true|true|true|true|true',
  (SELECT string_agg(public.shop_limite_consuma('ordine:impronta-t26', 3600, 10)::text, '|') FROM generate_series(1, 10)));
SELECT pg_temp.uguale('limite_finestra · l''undicesima no', 'false', public.shop_limite_consuma('ordine:impronta-t26', 3600, 10)::text);
SELECT pg_temp.uguale('limite_finestra · e il conteggio non cresce oltre il massimo', '10', (SELECT conteggio::text FROM public.shop_limiti WHERE chiave = 'ordine:impronta-t26'));
UPDATE public.shop_limiti SET finestra_inizio = now() - interval '3601 seconds' WHERE chiave = 'ordine:impronta-t26';
SELECT pg_temp.uguale('limite_finestra · a finestra scaduta la richiesta passa', 'true', public.shop_limite_consuma('ordine:impronta-t26', 3600, 10)::text);
SELECT pg_temp.uguale('limite_finestra · … e si riparte da 1 con la STESSA riga (nessun DELETE)', '1|1',
  (SELECT conteggio::text FROM public.shop_limiti WHERE chiave = 'ordine:impronta-t26') || '|' || (SELECT count(*)::text FROM public.shop_limiti WHERE chiave = 'ordine:impronta-t26'));
SELECT pg_temp.uguale('limite_finestra · una chiave diversa ha il suo conto', 'true', public.shop_limite_consuma('altra:impronta-t26', 3600, 10)::text);
SELECT pg_temp.uguale('limite_finestra · una finestra di zero secondi o un massimo di zero: limite_non_valido', '22023 limite_non_valido|22023 limite_non_valido',
  pg_temp.errore($q$SELECT public.shop_limite_consuma('ordine:impronta-t26', 0, 10)$q$) || '|' || pg_temp.errore($q$SELECT public.shop_limite_consuma('ordine:impronta-t26', 3600, 0)$q$));

-- SCENARIO: cassa_righe
SELECT pg_temp.mondo(27, 5);
SELECT pg_temp.mondo(28, 0, false, false);
UPDATE public.shop_prodotti SET nome = 'Prodotto uno' WHERE sku = 'P-SC27';
UPDATE public.shop_prodotti SET nome = 'Prodotto due' WHERE sku = 'P-SC28';
UPDATE public.shop_varianti SET nome = 'Grande', prezzo_cent = 1500 WHERE sku = 'SC28-V1';
SELECT pg_temp.uguale('cassa_righe · SKU di variante, slug, nome, nome variante, prezzo effettivo (variante o prodotto), attiva, pubblicato, giacenza; nell''ordine chiesto, senza doppioni, senza gli SKU che non ci sono', 'true',
  (public.shop_cassa_righe(ARRAY['SC28-V1', 'PROVA-NON-C-E', 'SC27-V1', 'SC27-V1']) =
   '[{"sku":"SC28-V1","slug":"prodotto-sc28","nome":"Prodotto due","attiva":false,"giacenza":0,"pubblicato":false,"prezzo_cent":1500,"nome_variante":"Grande"},{"sku":"SC27-V1","slug":"prodotto-sc27","nome":"Prodotto uno","attiva":true,"giacenza":5,"pubblicato":true,"prezzo_cent":2890,"nome_variante":"Unica"}]'::jsonb)::text);
SELECT pg_temp.uguale('cassa_righe · nessun SKU: elenco vuoto; senza elenco: parametro_non_valido', '[]|22023 parametro_non_valido',
  public.shop_cassa_righe(ARRAY[]::text[])::text || '|' || pg_temp.errore($q$SELECT public.shop_cassa_righe(NULL)$q$));
SELECT pg_temp.uguale('cassa_righe · anon non la legge; service_role sì (è l''unica lettura della giacenza fuori dal CRM)', '42501|ok:1',
  pg_temp.come('anon', $q$SELECT public.shop_cassa_righe(ARRAY['SC27-V1'])$q$) || '|' || pg_temp.come('service_role', $q$SELECT public.shop_cassa_righe(ARRAY['SC27-V1'])$q$));

-- SCENARIO: pagato_stato_non_pagabile
SELECT pg_temp.mondo(29, 5);
SELECT pg_temp.ordine(29, 1, stato => 'da_incassare');
SELECT pg_temp.ordine(29, 2, stato => '-');
SELECT pg_temp.uguale('pagato_stato_non_pagabile · da «da_incassare»: ordine_non_valido', '22023 ordine_non_valido', pg_temp.errore($q$SELECT pg_temp.paga(29, 1, 'cs_t29_1')$q$));
SELECT pg_temp.uguale('pagato_stato_non_pagabile · da stato vuoto (ordine R1/R2): ordine_non_valido', '22023 ordine_non_valido', pg_temp.errore($q$SELECT pg_temp.paga(29, 2, 'cs_t29_2')$q$));
SELECT pg_temp.uguale('pagato_stato_non_pagabile · niente cambia: stati intatti, nessuna data, giacenza intatta, nessun movimento', 'da_incassare||5|0|',
  pg_temp.col(29, 1, 'stato_pagamento') || '|' || pg_temp.col(29, 1, 'pagato_il') || '|' || pg_temp.giac(29) || '|' || (SELECT count(*)::text FROM public.shop_giacenza_movimenti m JOIN public.shop_varianti v ON v.id = m.variante_id WHERE v.sku = 'SC29-V1')
  || '|' || pg_temp.col(29, 2, 'stato_pagamento'));

-- SCENARIO: pagato_dopo_scadenza
SELECT pg_temp.mondo(30, 5);
SELECT pg_temp.ordine(30, 1, stato => 'scaduto');
SELECT pg_temp.ordine(30, 2, stato => 'fallito');
SELECT pg_temp.uguale('pagato_dopo_scadenza · da «scaduto» paga', 'pagato_ora|false', pg_temp.paga(30, 1, 'cs_t30_1'));
SELECT pg_temp.uguale('pagato_dopo_scadenza · da «fallito» paga', 'pagato_ora|false', pg_temp.paga(30, 2, 'cs_t30_2'));
SELECT pg_temp.uguale('pagato_dopo_scadenza · l''avviso pagato_dopo_scadenza c''è per lo scaduto (una volta) e NON per il fallito', '1|0',
  pg_temp.avvisi(30, 1, 'pagato_dopo_scadenza') || '|' || pg_temp.avvisi(30, 2, 'pagato_dopo_scadenza'));
SELECT pg_temp.uguale('pagato_dopo_scadenza · entrambi scalano la giacenza (3)', '3', pg_temp.giac(30));

-- SCENARIO: riapri_annullato
SELECT pg_temp.mondo(31, 5);
SELECT pg_temp.ordine(31, 1, stato => 'fallito', stato_ordine => 'annullato');
SELECT pg_temp.ordine(31, 2, stato_ordine => 'annullato');
SELECT pg_temp.uguale('riapri_annullato · annullato con pagamento fallito: non si riapre', '55000 ordine_non_riapribile',
  pg_temp.errore(format($q$SELECT public.shop_ordine_riapri(%L)$q$, pg_temp.oid(31, 1))));
SELECT pg_temp.uguale('riapri_annullato · annullato ancora in attesa: non si riapre', '55000 ordine_non_riapribile',
  pg_temp.errore(format($q$SELECT public.shop_ordine_riapri(%L)$q$, pg_temp.oid(31, 2))));
SELECT pg_temp.uguale('riapri_annullato · niente cambia', 'fallito|0|in_attesa|0',
  pg_temp.col(31, 1, 'stato_pagamento') || '|' || pg_temp.col(31, 1, 'riprova_n') || '|' || pg_temp.col(31, 2, 'stato_pagamento') || '|' || pg_temp.col(31, 2, 'riprova_n'));

-- SCENARIO: chiudi_sessione_non_registrata
SELECT pg_temp.mondo(32, 5);
SELECT pg_temp.ordine(32, 1, ARRAY['cs_t32_a']);
SELECT pg_temp.uguale('chiudi_sessione_non_registrata · una sessione che NON è dell''ordine: ignorato', 'ignorato', pg_temp.j(public.shop_ordine_chiudi(pg_temp.oid(32, 1), 'cs_t32_estranea', 'scaduto'), 'esito'));
SELECT pg_temp.uguale('chiudi_sessione_non_registrata · senza sessione (decisione della cassa): chiuso', 'chiuso', pg_temp.j(public.shop_ordine_chiudi(pg_temp.oid(32, 1), NULL, 'scaduto'), 'esito'));
SELECT pg_temp.uguale('chiudi_sessione_non_registrata · ordine scaduto, la sua sessione resta «aperta» (la decisione era della cassa, non di un evento)', 'scaduto|aperta',
  pg_temp.col(32, 1, 'stato_pagamento') || '|' || (SELECT stato FROM public.shop_stripe_sessioni WHERE sessione_id = 'cs_t32_a'));

-- SCENARIO: crea_lista_bianca
SELECT pg_temp.mondo(33, 5);
SELECT pg_temp.uguale('crea_lista_bianca · un chiamante che prova a scrivere anche colonne di stato, di pagamento, di spedizione', 'creato',
  pg_temp.j(public.shop_ordine_crea(jsonb_build_object('id', pg_temp.oid(33, 1), 'order_ref', 'HG-T331', 'nome', 'Anna', 'cognome', 'Esempio', 'email', 'cliente0@example.com', 'telefono', '3330000000', 'indirizzo', 'Via Prova 1', 'citta', 'Roma', 'cap', '00100',
    'provincia', 'RM', 'nazione', 'IT', 'totale_cent', 2890, 'total', 28.9, 'prova', true, 'fattura_richiesta', true, 'status', 'spedito', 'tracking', 'TRACK-FINTO', 'stripe_pagamento_id', 'pi_finto', 'stripe_sessione_id', 'cs_finta',
    'giacenza_da_verificare', true, 'riprova_n', 7, 'avvisi', jsonb_build_array(jsonb_build_object('codice', 'finto')), 'email_inviate', jsonb_build_object('conferma_ordine', jsonb_build_object('stato', 'inviata')),
    'pagato_importo', 99, 'metodo_pagamento', 'stripe', 'note_interne', 'scritta dal chiamante', 'spedito_il', '2026-11-19T10:00:00Z', 'annullo_motivo', 'finto'), '{}'::jsonb), 'esito'));
SELECT pg_temp.uguale('crea_lista_bianca · le colonne ammesse sono copiate (contatti, provincia, nazione, totale, prova, fattura richiesta)', 'Anna|RM|IT|2890|true|true',
  pg_temp.col(33, 1, 'nome') || '|' || pg_temp.col(33, 1, 'provincia') || '|' || pg_temp.col(33, 1, 'nazione') || '|' || pg_temp.col(33, 1, 'totale_cent') || '|' || pg_temp.col(33, 1, 'prova') || '|' || pg_temp.col(33, 1, 'fattura_richiesta'));
SELECT pg_temp.uguale('crea_lista_bianca · TUTTE le altre sono ignorate e valgono il default o il valore deciso dalla funzione', 'nuovo|in_attesa|sito|||false|0|0|||||',
  pg_temp.col(33, 1, 'status') || '|' || pg_temp.col(33, 1, 'stato_pagamento') || '|' || pg_temp.col(33, 1, 'canale') || '|' || pg_temp.col(33, 1, 'tracking') || '|' || pg_temp.col(33, 1, 'stripe_pagamento_id') || '|' || pg_temp.col(33, 1, 'giacenza_da_verificare')
  || '|' || pg_temp.col(33, 1, 'riprova_n') || '|' || pg_temp.col(33, 1, 'jsonb_array_length(avvisi)') || '|' || pg_temp.col(33, 1, 'stripe_sessione_id') || '|' || pg_temp.col(33, 1, 'pagato_importo') || '|' || pg_temp.col(33, 1, 'metodo_pagamento') || '|' || pg_temp.col(33, 1, 'note_interne') || '|' || pg_temp.col(33, 1, 'spedito_il'));
SELECT pg_temp.uguale('crea_lista_bianca · email_inviate resta vuoto e annullo_motivo vuoto', '{}|', pg_temp.col(33, 1, 'email_inviate') || '|' || pg_temp.col(33, 1, 'annullo_motivo'));

-- SCENARIO: crea_id_di_altri
SELECT pg_temp.mondo(35, 5);
-- una riga che NON è del sito (canale vuoto), con l'id che la cassa proverà a usare
INSERT INTO public.shop_orders (id, order_ref, nome, cognome, email, telefono, indirizzo, citta, cap, status, totale_cent)
VALUES (pg_temp.oid(35, 1), 'HG-T351', 'Anna', 'Esempio', 'cliente0@example.com', '3330000000', 'Via Prova 1', 'Roma', '00100', 'consegnato', 2890);
SELECT pg_temp.ordine(35, 2);
SELECT pg_temp.uguale('crea_id_di_altri · l''id è di una riga che NON è del sito: errore (non «esistente»), anche con riferimento, email e totale uguali', '23505 ordine_id_gia_usato',
  pg_temp.errore(format($q$SELECT public.shop_ordine_crea(jsonb_build_object('id', %L, 'order_ref', 'HG-T351', 'nome', 'Anna', 'cognome', 'Esempio', 'email', 'cliente0@example.com', 'telefono', '3330000000', 'indirizzo', 'Via Prova 1', 'citta', 'Roma', 'cap', '00100', 'totale_cent', 2890), '{}'::jsonb)$q$, pg_temp.oid(35, 1))));
SELECT pg_temp.uguale('crea_id_di_altri · l''id è di un ordine del sito ma con un''email diversa: errore', '23505 ordine_id_gia_usato',
  pg_temp.errore(format($q$SELECT public.shop_ordine_crea(jsonb_build_object('id', %L, 'order_ref', 'HG-T352', 'nome', 'Anna', 'cognome', 'Esempio', 'email', 'altro@example.com', 'telefono', '3330000000', 'indirizzo', 'Via Prova 1', 'citta', 'Roma', 'cap', '00100', 'totale_cent', 2890), '{}'::jsonb)$q$, pg_temp.oid(35, 2))));
SELECT pg_temp.uguale('crea_id_di_altri · … o con un totale diverso: errore', '23505 ordine_id_gia_usato',
  pg_temp.errore(format($q$SELECT public.shop_ordine_crea(jsonb_build_object('id', %L, 'order_ref', 'HG-T352', 'nome', 'Anna', 'cognome', 'Esempio', 'email', 'cliente@example.com', 'telefono', '3330000000', 'indirizzo', 'Via Prova 1', 'citta', 'Roma', 'cap', '00100', 'totale_cent', 3000), '{}'::jsonb)$q$, pg_temp.oid(35, 2))));
SELECT pg_temp.uguale('crea_id_di_altri · lo stesso ordine del sito (stesso riferimento, email e totale): esistente', 'esistente',
  pg_temp.j(public.shop_ordine_crea(jsonb_build_object('id', pg_temp.oid(35, 2), 'order_ref', 'HG-T352', 'nome', 'Anna', 'cognome', 'Esempio', 'email', 'cliente@example.com', 'telefono', '3330000000', 'indirizzo', 'Via Prova 1', 'citta', 'Roma', 'cap', '00100', 'totale_cent', 2890), '{}'::jsonb), 'esito'));
SELECT pg_temp.uguale('crea_id_di_altri · la riga vecchia è rimasta com''era (canale vuoto, consegnato, nessun riservato)', '|consegnato|0',
  pg_temp.col(35, 1, 'canale') || '|' || pg_temp.col(35, 1, 'status') || '|' || (SELECT count(*)::text FROM public.shop_ordini_riservati WHERE ordine_id = pg_temp.oid(35, 1)));

-- SCENARIO: rimborso_chiave_altro_ordine
SELECT pg_temp.mondo(34, 5);
SELECT pg_temp.ordine(34, 1);
SELECT pg_temp.ordine(34, 2);
SELECT pg_temp.uguale('rimborso_chiave_altro_ordine · paga il primo', 'pagato_ora|false', pg_temp.paga(34, 1, 'cs_t34_1'));
SELECT pg_temp.uguale('rimborso_chiave_altro_ordine · paga il secondo', 'pagato_ora|false', pg_temp.paga(34, 2, 'cs_t34_2'));
SELECT pg_temp.uguale('rimborso_chiave_altro_ordine · il primo prenota con la sua chiave', 'prenotato', pg_temp.j(public.shop_rimborso_prenota(pg_temp.oid(34, 1), 1000, 'reso', 'chiave-34', 'titolare'), 'esito'));
SELECT pg_temp.uguale('rimborso_chiave_altro_ordine · la STESSA chiave su un altro ordine: rifiutata (non rimanda la riga altrui)', '23505 rimborso_chiave_altro_ordine',
  pg_temp.errore(format($q$SELECT public.shop_rimborso_prenota(%L, 1000, 'reso', 'chiave-34', 'titolare')$q$, pg_temp.oid(34, 2))));
SELECT pg_temp.uguale('rimborso_chiave_altro_ordine · una riga sola, del primo ordine', '1|1',
  (SELECT count(*)::text FROM public.shop_rimborsi WHERE chiave_richiesta = 'chiave-34') || '|' || (SELECT count(*)::text FROM public.shop_rimborsi WHERE ordine_id = pg_temp.oid(34, 1)));

-- ══ DUE SESSIONI VERE (dblink): le corse che il finto non può vedere ═════════════════════════════════════════════════════
-- Sono le stesse funzioni, lanciate da due connessioni: la prima tiene il blocco (transazione aperta), la seconda DEVE aspettare
-- («B era in attesa» = true) e, quando la prima conferma, rilegge lo stato nuovo e risponde di conseguenza.

-- Il pagamento: stessa consegna due volte insieme → una sola scalatura.
SELECT pg_temp.mondo(40, 5);
SELECT pg_temp.ordine(40, 1);
SELECT pg_temp.uguale('CORSA · lo stesso pagamento consegnato due volte INSIEME: la seconda aspetta e poi trova gia_pagato', 'true|pagato_ora|gia_pagato',
  pg_temp.corsa(:'conn',
    format($q$SELECT public.shop_ordine_pagato(%L, 'cs_t40_1', 2890, 'eur', 'card', 'pi_t40') ->> 'esito'$q$, pg_temp.oid(40, 1)),
    format($q$SELECT public.shop_ordine_pagato(%L, 'cs_t40_1', 2890, 'eur', 'card', 'pi_t40') ->> 'esito'$q$, pg_temp.oid(40, 1))));
SELECT pg_temp.uguale('CORSA · … giacenza 4 e UN solo movimento (una sola scalatura)', '4|1', pg_temp.giac(40) || '|' || pg_temp.mov('HG-T401', 'ordine'));

-- L'ultimo pezzo: due ordini diversi insieme.
SELECT pg_temp.mondo(41, 1);
SELECT pg_temp.ordine(41, 1);
SELECT pg_temp.ordine(41, 2);
SELECT pg_temp.uguale('CORSA · due ordini insieme sull''ULTIMO pezzo: il secondo aspetta il blocco della variante, poi è pagato ma da verificare', 'true|pagato_ora|pagato_ora',
  pg_temp.corsa(:'conn',
    format($q$SELECT public.shop_ordine_pagato(%L, 'cs_t41_1', 2890, 'eur', 'card', 'pi_t411') ->> 'esito'$q$, pg_temp.oid(41, 1)),
    format($q$SELECT public.shop_ordine_pagato(%L, 'cs_t41_2', 2890, 'eur', 'card', 'pi_t412') ->> 'esito'$q$, pg_temp.oid(41, 2))));
SELECT pg_temp.uguale('CORSA · … giacenza 0 (mai sotto zero), UN solo movimento, il primo pulito e il secondo «da verificare»', '0|1|false|true',
  pg_temp.giac(41) || '|' || (SELECT count(*)::text FROM public.shop_giacenza_movimenti m JOIN public.shop_varianti v ON v.id = m.variante_id WHERE v.sku = 'SC41-V1' AND m.motivo = 'ordine')
  || '|' || pg_temp.col(41, 1, 'giacenza_da_verificare') || '|' || pg_temp.col(41, 2, 'giacenza_da_verificare'));

-- I rimborsi: due insieme oltre il pagato → uno solo.
SELECT pg_temp.mondo(42, 5);
SELECT pg_temp.ordine(42, 1);
SELECT pg_temp.paga(42, 1, 'cs_t42_1');
SELECT pg_temp.uguale('CORSA · due rimborsi INSIEME (20,00 € e 10,00 € su 28,90 €): il secondo aspetta il blocco dell''ordine e poi è rifiutato', 'true|prenotato|rimborso_oltre_pagato',
  (SELECT split_part(x, '|', 1) || '|' || split_part(x, '|', 2) || '|' || CASE WHEN split_part(x, '|', 3) LIKE '%rimborso_oltre_pagato%' THEN 'rimborso_oltre_pagato' ELSE split_part(x, '|', 3) END
   FROM (SELECT pg_temp.corsa(:'conn',
    format($q$SELECT public.shop_rimborso_prenota(%L, 2000, 'reso', 'chiave-42-a', 'titolare') ->> 'esito'$q$, pg_temp.oid(42, 1)),
    format($q$SELECT public.shop_rimborso_prenota(%L, 1000, 'reso', 'chiave-42-b', 'titolare') ->> 'esito'$q$, pg_temp.oid(42, 1))) AS x) y));
SELECT pg_temp.uguale('CORSA · … UNA sola riga di rimborso, da 20,00 €', '1|2000', (SELECT count(*)::text || '|' || sum(importo_cent)::text FROM public.shop_rimborsi WHERE ordine_id = pg_temp.oid(42, 1)));

-- La stessa chiave di rimborso insieme (doppio clic) → una riga.
SELECT pg_temp.mondo(43, 5);
SELECT pg_temp.ordine(43, 1);
SELECT pg_temp.paga(43, 1, 'cs_t43_1');
SELECT pg_temp.uguale('CORSA · lo stesso clic su «Rimborsa» INSIEME (stessa chiave): il secondo aspetta e riceve la riga del primo', 'true|prenotato|esistente',
  pg_temp.corsa(:'conn',
    format($q$SELECT public.shop_rimborso_prenota(%L, 1000, 'reso', 'chiave-43', 'titolare') ->> 'esito'$q$, pg_temp.oid(43, 1)),
    format($q$SELECT public.shop_rimborso_prenota(%L, 1000, 'reso', 'chiave-43', 'titolare') ->> 'esito'$q$, pg_temp.oid(43, 1))));
SELECT pg_temp.uguale('CORSA · … UNA sola riga', '1', (SELECT count(*)::text FROM public.shop_rimborsi WHERE ordine_id = pg_temp.oid(43, 1)));

-- La riprova: due clic insieme → una sola riprova_n.
SELECT pg_temp.mondo(44, 5);
SELECT pg_temp.ordine(44, 1, stato => 'fallito');
SELECT pg_temp.uguale('CORSA · due «Riprova» INSIEME: il secondo aspetta e trova l''ordine già in attesa (riprova_in_corso)', 'true|riaperto|riprova_in_corso',
  pg_temp.corsa(:'conn',
    format($q$SELECT public.shop_ordine_riapri(%L) ->> 'esito'$q$, pg_temp.oid(44, 1)),
    format($q$SELECT public.shop_ordine_riapri(%L) ->> 'esito'$q$, pg_temp.oid(44, 1))));
SELECT pg_temp.uguale('CORSA · … una sola riprova_n (1) e l''ordine in attesa', '1|in_attesa', pg_temp.col(44, 1, 'riprova_n') || '|' || pg_temp.col(44, 1, 'stato_pagamento'));

-- La creazione: lo stesso ordine (id e riferimento) due volte insieme.
SELECT pg_temp.mondo(45, 5);
SELECT pg_temp.uguale('CORSA · lo stesso ordine creato due volte INSIEME: il secondo aspetta e poi risponde «esistente» (non un errore di chiave doppia)', 'true|creato|esistente',
  pg_temp.corsa(:'conn',
    format($q$SELECT public.shop_ordine_crea(jsonb_build_object('id', %L, 'order_ref', 'HG-T451', 'nome', 'Anna', 'cognome', 'Esempio', 'email', 'cliente0@example.com', 'telefono', '3330000000', 'indirizzo', 'Via Prova 1', 'citta', 'Roma', 'cap', '00100', 'totale_cent', 2890), '{}'::jsonb) ->> 'esito'$q$, pg_temp.oid(45, 1)),
    format($q$SELECT public.shop_ordine_crea(jsonb_build_object('id', %L, 'order_ref', 'HG-T451', 'nome', 'Anna', 'cognome', 'Esempio', 'email', 'cliente0@example.com', 'telefono', '3330000000', 'indirizzo', 'Via Prova 1', 'citta', 'Roma', 'cap', '00100', 'totale_cent', 2890), '{}'::jsonb) ->> 'esito'$q$, pg_temp.oid(45, 1))));
SELECT pg_temp.uguale('CORSA · … UNA riga d''ordine e UNA dei riservati', '1|1',
  (SELECT count(*)::text FROM public.shop_orders WHERE id = pg_temp.oid(45, 1)) || '|' || (SELECT count(*)::text FROM public.shop_ordini_riservati WHERE ordine_id = pg_temp.oid(45, 1)));

-- Il limite: l'ultimo posto conteso da due richieste insieme.
SELECT count(*) FROM (SELECT public.shop_limite_consuma('ordine:corsa-t46', 3600, 10) FROM generate_series(1, 9)) x \gset limite_
SELECT pg_temp.uguale('CORSA · due richieste INSIEME per l''ULTIMO posto del limite (9 su 10): la seconda aspetta, rilegge e riceve false', 'true|true|false',
  pg_temp.corsa(:'conn',
    $q$SELECT public.shop_limite_consuma('ordine:corsa-t46', 3600, 10)::text$q$,
    $q$SELECT public.shop_limite_consuma('ordine:corsa-t46', 3600, 10)::text$q$));
SELECT pg_temp.uguale('CORSA · … il conteggio si ferma a 10', '10', (SELECT conteggio::text FROM public.shop_limiti WHERE chiave = 'ordine:corsa-t46'));

\echo 'TUTTI I CONTROLLI DI S4 PASSANO'
