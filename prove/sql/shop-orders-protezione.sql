-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DI S4b (IL TRIGGER DI PROTEZIONE DI shop_orders) SU UN POSTGRES VERO
-- (commessa 2026-11-20-shop-completo, T41b, Rilascio 2)
--
-- NON entra in `npm test` e NON si lancia MAI sul database di produzione: serve un database
-- USA-E-GETTA il cui nome contiene «prova» (lo script si ferma se non è così). Istruzioni: prove/sql/LEGGIMI.md.
--
--   createdb prova_protezione
--   psql prova_protezione -X -q -v ON_ERROR_STOP=1 -f prove/sql/shop-orders-protezione.sql   (dalla radice del repo)
--
-- Per vedere i casi ROSSI (prima di S4b) si dà al posto di S4b un file vuoto e si lascia andare avanti dopo gli errori:
--   psql prova_protezione -X -q -v ON_ERROR_STOP=0 -v s4b=/dev/null -f prove/sql/shop-orders-protezione.sql
--
-- Serve un utente superutente del database di prova e l'estensione `dblink` (Postgres 15 o 16 normale). Il database può
-- essere vuoto: lo script crea i ruoli finti `anon`, `authenticated`, `service_role`, uno schema `auth` con `auth.role()`
-- COME LO DEFINISCE SUPABASE (legge `request.jwt.claims`, non il ruolo della sessione), la tabella `shop_orders` com'è
-- oggi in produzione, applica M1, S1 e S4 VERA (non simulata), imita i privilegi larghi che Supabase dà di default, poi S4b.
--
-- Chi scrive è simulato COME POSTGREST: `SET LOCAL ROLE <ruolo>` e `request.jwt.claims = {"role": "<ruolo>"}`; l'insert
-- del browser ha la forma `INSERT … SELECT … FROM json_populate_recordset(null::shop_orders, <corpo>)`.
--
-- Due fasi: 1) i permessi di colonna di S4 come sono (il browser non può scrivere le colonne nuove già per i permessi);
-- 2) i permessi di S4 RIDATI per intero, come se il REVOKE non avesse avuto effetto su Supabase (altro «grantor»): lì
-- c'è solo il trigger a fermare il browser, e la prova dice «colonna_protetta» (il messaggio del trigger), non «permission denied».
--
-- Dati inventati: nessun nome, numero o indirizzo vero.
-- ─────────────────────────────────────────────────────────────────────────────
\if :{?ON_ERROR_STOP}
\else
\set ON_ERROR_STOP on
\endif
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
\if :{?s4b}
\else
\set s4b 'supabase/migrations/20261122123000_shop_orders_protezione.sql'
\endif

DO $f$
BEGIN
  IF current_database() NOT ILIKE '%prova%' THEN
    RAISE EXCEPTION 'STOP: il database si chiama «%», non contiene «prova». Questo script NON va lanciato qui.', current_database();
  END IF;
END $f$;

\if :{?conn}
\else
SELECT format('dbname=%s port=%s host=%s user=%s', current_database(), current_setting('port'), COALESCE(NULLIF(split_part(current_setting('unix_socket_directories'), ',', 1), ''), '127.0.0.1'), current_user) AS conn \gset
\endif

SELECT 'Postgres: ' || current_setting('server_version');

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
-- auth.role() COME IN SUPABASE: lo dice il token della richiesta (request.jwt.claims), NON il ruolo della sessione.
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $f$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), (NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text
$f$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;

CREATE FUNCTION pg_temp.uguale(nome text, atteso text, avuto text) RETURNS text LANGUAGE plpgsql AS $f$
BEGIN
  IF atteso IS DISTINCT FROM avuto THEN
    RAISE EXCEPTION 'KO %: atteso «%», avuto «%»', nome, atteso, avuto;
  END IF;
  RETURN 'ok  ' || nome;
END $f$;

-- Esegue un'istruzione COME POSTGREST: ruolo della sessione + request.jwt.claims. Risponde 'ok:<righe>' oppure «SQLSTATE <da chi>»:
-- trigger (colonna_protetta / ordine_non_ammesso), permessi (permission denied: i permessi di colonna), policy (protezione per riga), altro.
CREATE FUNCTION pg_temp.pgrst(ruolo text, istruzione text, claims boolean DEFAULT true) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE n bigint;
BEGIN
  IF claims THEN PERFORM set_config('request.jwt.claims', json_build_object('role', ruolo)::text, true); END IF;
  EXECUTE format('SET LOCAL ROLE %I', ruolo);
  EXECUTE istruzione;
  GET DIAGNOSTICS n = ROW_COUNT;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  RETURN 'ok:' || n;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  RETURN SQLSTATE || ' ' || CASE
    WHEN SQLERRM LIKE 'colonna_protetta%' THEN 'trigger:colonna'
    WHEN SQLERRM LIKE 'ordine_non_ammesso%' THEN 'trigger:cassa'
    WHEN SQLERRM LIKE 'permission denied%' THEN 'permessi'
    WHEN SQLERRM LIKE 'new row violates row-level%' THEN 'policy'
    ELSE SQLERRM END;
END $f$;

-- L'insert del browser come lo fa PostgREST: colonne = le chiavi del corpo, valori da json_populate_recordset.
CREATE FUNCTION pg_temp.inserisci(ruolo text, corpo jsonb, tabella text DEFAULT 'public.shop_orders', claims boolean DEFAULT true) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE colonne text;
BEGIN
  SELECT string_agg(quote_ident(k), ', ') INTO colonne FROM jsonb_object_keys(corpo) k;
  RETURN pg_temp.pgrst(ruolo, format('INSERT INTO %s (%s) SELECT %s FROM json_populate_recordset(null::%s, %L::json)', tabella, colonne, colonne, tabella, jsonb_build_array(corpo)::text), claims);
END $f$;

-- L'ordine di oggi: le 15 chiavi di rigaOrdine (src/shop/invio-ordine.ts), senza created_at. `extra` si somma (o sostituisce).
CREATE FUNCTION pg_temp.oid(n integer) RETURNS uuid LANGUAGE sql IMMUTABLE AS $f$ SELECT ('00000000-0000-4000-8000-' || lpad((9000 + n)::text, 12, '0'))::uuid $f$;
CREATE FUNCTION pg_temp.corpo(n integer, extra jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE sql IMMUTABLE AS $f$
  SELECT jsonb_build_object('id', pg_temp.oid(n), 'order_ref', 'HG-P' || n, 'nome', 'Anna', 'cognome', 'Esempio', 'email', 'anna@example.com', 'telefono', '3330000000',
    'indirizzo', 'Via Prova 1', 'citta', 'Roma', 'cap', '00100', 'note', NULL, 'items', jsonb_build_array(jsonb_build_object('product_id', 'PROVA-V1', 'name', 'Prodotto', 'qty', 1, 'unit_price', 28.9)),
    'subtotal', 28.9, 'shipping', 0, 'total', 28.9, 'status', 'nuovo') || extra
$f$;
-- Un update del browser (la riga n, l'impostazione SET data).
CREATE FUNCTION pg_temp.aggiorna(ruolo text, n integer, impostazione text, claims boolean DEFAULT true) RETURNS text LANGUAGE sql AS $f$
  SELECT pg_temp.pgrst(ruolo, format('UPDATE public.shop_orders SET %s WHERE id = %L', impostazione, pg_temp.oid(n)), claims)
$f$;
-- Come il proprietario: '' se va, altrimenti «SQLSTATE messaggio».
CREATE FUNCTION pg_temp.errore(istruzione text) RETURNS text LANGUAGE plpgsql AS $f$
BEGIN
  EXECUTE istruzione;
  RETURN '';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE || ' ' || SQLERRM;
END $f$;
CREATE FUNCTION pg_temp.val(istruzione text) RETURNS text LANGUAGE plpgsql AS $f$
DECLARE r text;
BEGIN EXECUTE istruzione INTO r; RETURN COALESCE(r, ''); END $f$;
CREATE FUNCTION pg_temp.file_remoto(conn text, testo text) RETURNS text LANGUAGE plpgsql AS $f$
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

-- ── 0. La tabella degli ordini com'è in produzione, M1, S1 ───────────────────
\i :origine
GRANT ALL ON public.shop_orders TO anon, authenticated;
-- Una riga «vecchia» e due ordini su cui provare gli update.
INSERT INTO public.shop_orders (id, order_ref, nome, cognome, email, telefono, indirizzo, citta, cap, items, subtotal, shipping, total, status)
VALUES ('00000000-0000-4000-8000-0000000a0001', 'HG-VECCHIO', 'Anna', 'Esempio', 'vecchio@example.com', '3330000000', 'Via Prova 1', 'Roma', '00100', '[{"product_id":"V","qty":2}]', 20, 0, 20, 'consegnato');
\i :s1
\i :m1

-- ── 1. S4b senza S4: si ferma e non scrive niente ─────────────────────────────
\set s4btesto `cat :s4b`
SELECT pg_temp.uguale('S4b SENZA S4 si ferma col messaggio chiaro (nomina S4 e il suo file)', 'true',
  (pg_temp.file_remoto(:'conn', :'s4btesto') LIKE 'P0001%S4b si ferma%S4%20261122120000%' OR :'s4b' = '/dev/null')::text);
SELECT pg_temp.uguale('… e non ha creato né il trigger né la funzione', '0|0',
  (SELECT count(*)::text FROM pg_trigger WHERE tgname = 'shop_orders_protezione') || '|' || (SELECT count(*)::text FROM pg_proc WHERE proname = 'shop_orders_protezione'));

-- ── 2. S4 VERA, poi la fotografia di policy e righe PRIMA di S4b ──────────────
\i :s4
CREATE TEMP TABLE prima_s4b AS SELECT
  (SELECT md5(string_agg(policyname || cmd || roles::text || COALESCE(qual, '') || COALESCE(with_check, ''), '|' ORDER BY policyname)) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shop_orders') AS policy,
  (SELECT md5(string_agg(to_jsonb(o)::text, '|' ORDER BY o.id)) FROM public.shop_orders o) AS righe,
  (SELECT string_agg(attname || ':' || COALESCE(has_column_privilege('anon', 'public.shop_orders', attname, 'INSERT')::text, ''), ',' ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'public.shop_orders'::regclass AND attnum > 0 AND NOT attisdropped) AS permessi_anon,
  (SELECT string_agg(attname || ':' || COALESCE(has_column_privilege('authenticated', 'public.shop_orders', attname, 'UPDATE')::text, ''), ',' ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'public.shop_orders'::regclass AND attnum > 0 AND NOT attisdropped) AS permessi_auth;
\i :s4b
\i :s4b
\echo 'ok  S4b applicata due volte senza errori'

-- ── 3. Cosa è cambiato con S4b: solo il trigger ───────────────────────────────
SELECT pg_temp.uguale('un solo trigger su shop_orders, quello di S4b (BEFORE, per riga, INSERT e UPDATE)', 'shop_orders_protezione|1',
  (SELECT string_agg(tgname, ',') FROM pg_trigger WHERE tgrelid = 'public.shop_orders'::regclass AND NOT tgisinternal) || '|' ||
  (SELECT count(*)::text FROM pg_trigger WHERE tgrelid = 'public.shop_orders'::regclass AND NOT tgisinternal AND (tgtype & 1) = 1 AND (tgtype & 2) = 2 AND (tgtype & 4) = 4 AND (tgtype & 16) = 16 AND (tgtype & 8) = 0));
SELECT pg_temp.uguale('la funzione è SECURITY DEFINER con search_path = public, e chiusa ad anon, authenticated e PUBLIC', 'true|{search_path=public}|false|false|false',
  (SELECT prosecdef::text || '|' || proconfig::text FROM pg_proc WHERE proname = 'shop_orders_protezione') || '|' ||
  has_function_privilege('anon', 'public.shop_orders_protezione()', 'EXECUTE')::text || '|' || has_function_privilege('authenticated', 'public.shop_orders_protezione()', 'EXECUTE')::text || '|' ||
  (SELECT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.proname = 'shop_orders_protezione' AND a.grantee = 0)::text));
SELECT pg_temp.uguale('le policy di shop_orders sono IDENTICHE a prima (nessuna creata, nessuna tolta, nessuna cambiata)', 'true',
  ((SELECT md5(string_agg(policyname || cmd || roles::text || COALESCE(qual, '') || COALESCE(with_check, ''), '|' ORDER BY policyname)) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shop_orders') = (SELECT policy FROM prima_s4b))::text);
SELECT pg_temp.uguale('le righe di shop_orders sono IDENTICHE a prima (nessun dato toccato)', 'true',
  ((SELECT md5(string_agg(to_jsonb(o)::text, '|' ORDER BY o.id)) FROM public.shop_orders o) = (SELECT righe FROM prima_s4b))::text);
SELECT pg_temp.uguale('i permessi di colonna di S4 sono IDENTICI a prima (S4b non ne cambia)', 'true',
  (((SELECT string_agg(attname || ':' || COALESCE(has_column_privilege('anon', 'public.shop_orders', attname, 'INSERT')::text, ''), ',' ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'public.shop_orders'::regclass AND attnum > 0 AND NOT attisdropped) = (SELECT permessi_anon FROM prima_s4b))
   AND ((SELECT string_agg(attname || ':' || COALESCE(has_column_privilege('authenticated', 'public.shop_orders', attname, 'UPDATE')::text, ''), ',' ORDER BY attnum) FROM pg_attribute WHERE attrelid = 'public.shop_orders'::regclass AND attnum > 0 AND NOT attisdropped) = (SELECT permessi_auth FROM prima_s4b)))::text);
SELECT pg_temp.uguale('il corpo non nomina pagato_il (non si rompe se M1 non c''è) e non contiene DELETE, DROP o TRUNCATE', '0|0',
  (SELECT count(*)::text FROM pg_proc WHERE proname = 'shop_orders_protezione' AND prosrc ~ 'pagato_il') || '|' ||
  (SELECT count(*)::text FROM pg_proc WHERE proname = 'shop_orders_protezione' AND prosrc ~* '\m(delete|drop|truncate)\M'));
-- Il controllo richiesto dal capo progetto (passo del titolare, dopo S4): il browser non scrive stato_pagamento.
SELECT pg_temp.uguale('has_column_privilege(anon, shop_orders, stato_pagamento, INSERT) è FALSE', 'false',
  has_column_privilege('anon', 'public.shop_orders', 'stato_pagamento', 'INSERT')::text);
SELECT pg_temp.uguale('… e anche authenticated non scrive stato_pagamento (INSERT e UPDATE), mentre note_interne sì', 'false|false|true',
  has_column_privilege('authenticated', 'public.shop_orders', 'stato_pagamento', 'INSERT')::text || '|' || has_column_privilege('authenticated', 'public.shop_orders', 'stato_pagamento', 'UPDATE')::text || '|' ||
  has_column_privilege('authenticated', 'public.shop_orders', 'note_interne', 'UPDATE')::text);

-- ── 4. FASE 1: i permessi di colonna di S4 come sono. Il checkout di oggi (cassa vecchia) ─────────────
-- Due ordini su cui l'account del CRM lavora (inseriti dal proprietario).
INSERT INTO public.shop_orders (id, order_ref, nome, cognome, email, telefono, indirizzo, citta, cap, items, subtotal, shipping, total, status, pagato_il, pagato_importo, metodo_pagamento)
VALUES (pg_temp.oid(100), 'HG-P100', 'Anna', 'Esempio', 'anna@example.com', '3330000000', 'Via Prova 1', 'Roma', '00100', '[{"product_id":"PROVA-V1","qty":1}]', 28.9, 0, 28.9, 'in_preparazione', now(), 28.9, 'bonifico');

SELECT pg_temp.uguale('CASSA VECCHIA · anon inserisce l''ordine di oggi (le 15 chiavi di rigaOrdine, forma PostgREST): passa', 'ok:1', pg_temp.inserisci('anon', pg_temp.corpo(1)));
SELECT pg_temp.uguale('CASSA VECCHIA · la riga nasce coi valori di partenza (prova falso, rimborsato 0, canale e stato_pagamento vuoti)', 'f|0|0||',
  (SELECT concat_ws('|', prova, rimborsato_cent, riprova_n, COALESCE(canale, ''), COALESCE(stato_pagamento, '')) FROM public.shop_orders WHERE id = pg_temp.oid(1)));
SELECT pg_temp.uguale('CASSA VECCHIA · anche con created_at = adesso e una nota', 'ok:1', pg_temp.inserisci('anon', pg_temp.corpo(2, jsonb_build_object('created_at', now(), 'note', 'citofono guasto'))));
SELECT pg_temp.uguale('CASSA VECCHIA · l''insert di oggi come authenticated (un account che ordina dal sito): passa', 'ok:1', pg_temp.inserisci('authenticated', pg_temp.corpo(3)));
SELECT pg_temp.uguale('CASSA VECCHIA · anche con `.insert(riga)` senza lista di colonne esplicita non cambia niente: VALUES dritto come anon', 'ok:1',
  pg_temp.pgrst('anon', format($q$INSERT INTO public.shop_orders (id, order_ref, nome, cognome, email, telefono, indirizzo, citta, cap, items, subtotal, shipping, total, status) VALUES (%L, 'HG-P4', 'Anna', 'Esempio', 'a@example.com', '3330000000', 'Via Prova 1', 'Roma', '00100', '[]', 1, 0, 1, 'nuovo')$q$, pg_temp.oid(4))));
SELECT pg_temp.uguale('CASSA VECCHIA · lo stesso id due volte: 23505 (il checkout lo legge come «arrivato»), non un rifiuto del trigger', '23505',
  split_part(pg_temp.inserisci('anon', pg_temp.corpo(1)), ' ', 1));

-- Casi rifiutati: ognuno dà 42501 (o 42501 dalla policy di M1). Fase 1: con S4 i permessi di colonna fermano già le colonne nuove.
SELECT pg_temp.uguale('anon con stato_pagamento = pagato → rifiutato (fase 1: i permessi di colonna di S4)', '42501 permessi', pg_temp.inserisci('anon', pg_temp.corpo(10, '{"stato_pagamento":"pagato"}')));
SELECT pg_temp.uguale('anon con canale = sito → rifiutato', '42501 permessi', pg_temp.inserisci('anon', pg_temp.corpo(11, '{"canale":"sito"}')));
SELECT pg_temp.uguale('anon con prova = true → rifiutato', '42501 permessi', pg_temp.inserisci('anon', pg_temp.corpo(12, '{"prova":true}')));
SELECT pg_temp.uguale('anon con pagato_il → rifiutato (la policy di M1, il trigger o i permessi: comunque 42501)', '42501',
  split_part(pg_temp.inserisci('anon', pg_temp.corpo(13, jsonb_build_object('pagato_il', now()))), ' ', 1));
SELECT pg_temp.uguale('anon con status = pagato → rifiutato dalla policy di M1', '42501', split_part(pg_temp.inserisci('anon', pg_temp.corpo(14, '{"status":"pagato"}')), ' ', 1));

-- ── 5. FASE 1: authenticated (un account del CRM) cambia un ordine dal browser ────────────────────────
SELECT pg_temp.uguale('authenticated cambia note_interne: passa', 'ok:1', pg_temp.aggiorna('authenticated', 100, $s$note_interne = 'chiamare il cliente'$s$));
SELECT pg_temp.uguale('authenticated cambia aggiornato_il: passa', 'ok:1', pg_temp.aggiorna('authenticated', 100, 'aggiornato_il = now()'));
SELECT pg_temp.uguale('authenticated cambia note_interne E aggiornato_il insieme: passa', 'ok:1', pg_temp.aggiorna('authenticated', 100, $s$note_interne = 'richiamato', aggiornato_il = now()$s$));
SELECT pg_temp.uguale('authenticated riscrive lo stesso valore (status = status): passa, non cambia niente', 'ok:1', pg_temp.aggiorna('authenticated', 100, 'status = status'));
SELECT pg_temp.uguale('authenticated cambia pagato_il di un ordine reale → RIFIUTATO (era il bloccante 1: l''«Incassato» lo somma)', '42501 trigger:colonna', pg_temp.aggiorna('authenticated', 100, 'pagato_il = now() - interval ''3 days'''));
SELECT pg_temp.uguale('authenticated cambia pagato_importo → rifiutato', '42501 trigger:colonna', pg_temp.aggiorna('authenticated', 100, 'pagato_importo = 1'));
SELECT pg_temp.uguale('authenticated cambia metodo_pagamento → rifiutato', '42501 trigger:colonna', pg_temp.aggiorna('authenticated', 100, $s$metodo_pagamento = 'contanti'$s$));
SELECT pg_temp.uguale('authenticated cambia status → rifiutato', '42501 trigger:colonna', pg_temp.aggiorna('authenticated', 100, $s$status = 'spedito'$s$));
SELECT pg_temp.uguale('authenticated cambia tracking → rifiutato', '42501 trigger:colonna', pg_temp.aggiorna('authenticated', 100, $s$tracking = 'XX123'$s$));
SELECT pg_temp.uguale('authenticated cambia items → rifiutato', '42501 trigger:colonna', pg_temp.aggiorna('authenticated', 100, $s$items = '[]'::jsonb$s$));
SELECT pg_temp.uguale('authenticated cambia email dopo il pagamento → rifiutato', '42501 trigger:colonna', pg_temp.aggiorna('authenticated', 100, $s$email = 'altro@example.com'$s$));
SELECT pg_temp.uguale('authenticated cambia total → rifiutato', '42501 trigger:colonna', pg_temp.aggiorna('authenticated', 100, 'total = 1'));
SELECT pg_temp.uguale('authenticated cambia note_interne insieme a una colonna protetta → rifiutato (e niente cambia)', '42501 trigger:colonna|richiamato',
  pg_temp.aggiorna('authenticated', 100, $s$note_interne = 'x', pagato_il = now()$s$) || '|' || (SELECT note_interne FROM public.shop_orders WHERE id = pg_temp.oid(100)));
SELECT pg_temp.uguale('authenticated cambia stato_pagamento (colonna nuova) → rifiutato dai permessi di S4 (fase 1)', '42501 permessi', pg_temp.aggiorna('authenticated', 100, $s$stato_pagamento = 'pagato'$s$));
SELECT pg_temp.uguale('dopo i rifiuti l''ordine è com''era (status, pagato_il, email, items)', 'in_preparazione|true|anna@example.com|1',
  (SELECT status || '|' || (pagato_il < now() AND pagato_il > now() - interval '1 hour')::text || '|' || email || '|' || jsonb_array_length(items) FROM public.shop_orders WHERE id = pg_temp.oid(100)));

-- ── 6. Cassa Stripe attiva: nessun insert dal browser; tornando a «vecchia» di nuovo sì ───────────────────
UPDATE public.shop_impostazioni SET valore = '"stripe"' WHERE chiave = 'cassa_sito';
SELECT pg_temp.uguale('CASSA STRIPE · anon inserisce l''ordine di oggi → rifiutato dal trigger (SPEC §13)', '42501 trigger:cassa', pg_temp.inserisci('anon', pg_temp.corpo(20)));
SELECT pg_temp.uguale('CASSA STRIPE · anche authenticated → rifiutato', '42501 trigger:cassa', pg_temp.inserisci('authenticated', pg_temp.corpo(21)));
SELECT pg_temp.uguale('CASSA STRIPE · un update di note_interne continua a passare (la cassa non c''entra)', 'ok:1', pg_temp.aggiorna('authenticated', 100, $s$note_interne = 'ok con stripe'$s$));
SELECT pg_temp.uguale('CASSA STRIPE · il server (service_role) crea l''ordine con la funzione di S4 e passa', 'ok:1',
  pg_temp.pgrst('service_role', format($q$SELECT public.shop_ordine_crea(jsonb_build_object('id', %L, 'order_ref', 'HG-P22', 'nome', 'Anna', 'cognome', 'Esempio', 'email', 'anna@example.com', 'telefono', '3330000000', 'indirizzo', 'Via Prova 1', 'citta', 'Roma', 'cap', '00100', 'totale_cent', 2890), '{}'::jsonb)$q$, pg_temp.oid(22))));
SELECT pg_temp.uguale('CASSA STRIPE · …e la riga c''è, canale sito, in attesa', 'sito|in_attesa', (SELECT canale || '|' || stato_pagamento FROM public.shop_orders WHERE id = pg_temp.oid(22)));
SELECT pg_temp.uguale('CASSA STRIPE · il server inserisce anche a mano (service_role, con stato_pagamento): passa', 'ok:1',
  pg_temp.pgrst('service_role', format($q$INSERT INTO public.shop_orders (id, order_ref, nome, cognome, email, telefono, indirizzo, citta, cap, stato_pagamento, canale) VALUES (%L, 'HG-P23', 'A', 'B', 'a@example.com', '1', 'v', 'c', '1', 'pagato', 'sito')$q$, pg_temp.oid(23))));
SELECT pg_temp.uguale('CASSA STRIPE · il proprietario del database (SQL Editor) inserisce: passa', '',
  pg_temp.errore(format($q$INSERT INTO public.shop_orders (id, order_ref, nome, cognome, email, telefono, indirizzo, citta, cap, stato_pagamento, canale) VALUES (%L, 'HG-P24', 'A', 'B', 'a@example.com', '1', 'v', 'c', '1', 'pagato', 'sito')$q$, pg_temp.oid(24))));
UPDATE public.shop_impostazioni SET valore = '"vecchia"' WHERE chiave = 'cassa_sito';
SELECT pg_temp.uguale('TORNATA A «vecchia» · l''insert di oggi come anon torna a passare', 'ok:1', pg_temp.inserisci('anon', pg_temp.corpo(25)));
-- Valore sconosciuto: blocca SOLO «stripe».
UPDATE public.shop_impostazioni SET valore = '"qualcosa"' WHERE chiave = 'cassa_sito';
SELECT pg_temp.uguale('interruttore con un valore sconosciuto: l''insert di oggi passa (si blocca solo «stripe»)', 'ok:1', pg_temp.inserisci('anon', pg_temp.corpo(26)));
UPDATE public.shop_impostazioni SET valore = '"vecchia"' WHERE chiave = 'cassa_sito';

-- ── 7. L'interruttore illeggibile: l'insert di oggi passa (fallisce APERTO) ───────────────────────────
UPDATE public.shop_impostazioni SET valore = '"stripe"' WHERE chiave = 'cassa_sito';
ALTER TABLE public.shop_impostazioni RENAME TO shop_impostazioni_nascosta;
SELECT pg_temp.uguale('shop_impostazioni illeggibile (tabella assente, interruttore su «stripe»): l''insert di oggi passa, come oggi', 'ok:1', pg_temp.inserisci('anon', pg_temp.corpo(30)));
SELECT pg_temp.uguale('… ma le regole sulle colonne restano CHIUSE anche allora (stato_pagamento → rifiutato)', '42501 permessi', pg_temp.inserisci('anon', pg_temp.corpo(31, '{"stato_pagamento":"pagato"}')));
ALTER TABLE public.shop_impostazioni_nascosta RENAME TO shop_impostazioni;
UPDATE public.shop_impostazioni SET valore = '"vecchia"' WHERE chiave = 'cassa_sito';

-- ── 8. service_role e proprietario: passano sempre, anche le colonne di prima (la cassa vecchia e il CRM) ─
SELECT pg_temp.uguale('service_role cambia pagato_il, status, tracking, items, email (il CRM di oggi, che usa la chiave di servizio)', 'ok:1',
  pg_temp.aggiorna('service_role', 100, $s$pagato_il = now(), status = 'spedito', tracking = 'XX123', items = '[{"product_id":"PROVA-V1","qty":2}]'::jsonb, email = 'nuova@example.com', stato_pagamento = 'pagato', prova = false$s$));
SELECT pg_temp.uguale('il proprietario cambia status (SQL Editor): passa', '', pg_temp.errore(format($q$UPDATE public.shop_orders SET status = 'consegnato' WHERE id = %L$q$, pg_temp.oid(100))));
SELECT pg_temp.uguale('le funzioni di S4 chiamate dal server (pagato, rimborso) con il trigger acceso: passano', 'ok:1|ok:1',
  pg_temp.pgrst('service_role', format($q$SELECT public.shop_ordine_sessione_registra(%L, 'cs_p22')$q$, pg_temp.oid(22))) || '|' ||
  pg_temp.pgrst('service_role', format($q$SELECT public.shop_ordine_pagato(%L, 'cs_p22', 2890, 'eur', 'card', 'pi_p22')$q$, pg_temp.oid(22))));
SELECT pg_temp.uguale('… e l''ordine risulta pagato', 'pagato', (SELECT stato_pagamento FROM public.shop_orders WHERE id = pg_temp.oid(22)));
SELECT pg_temp.uguale('il server senza il token (solo il ruolo della sessione service_role, nessun claim) passa lo stesso', 'ok:1', pg_temp.aggiorna('service_role', 100, $s$status = 'consegnato'$s$, false));

-- ── 9. Il ruolo si legge anche dalla sessione (se il token mancasse): authenticated senza claim è protetto ────
SELECT pg_temp.uguale('anon SENZA request.jwt.claims: stato_pagamento resta fuori (permessi di colonna)', '42501 permessi', pg_temp.inserisci('anon', pg_temp.corpo(40, '{"stato_pagamento":"pagato"}'), 'public.shop_orders', false));
SELECT pg_temp.uguale('il proprietario con un token «anon» finto nella sessione (nessun SET ROLE): protetto (auth.role())', '42501 colonna_protetta',
  split_part(pg_temp.errore(format($q$SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', true); UPDATE public.shop_orders SET email = 'x@example.com' WHERE id = %L$q$, pg_temp.oid(100))), ':', 1));

-- ── 10. Doppia applicazione e colonne FUTURE: una copia della tabella con una colonna in più ──────────
-- (il trigger non nomina colonne: la copia usa la STESSA funzione. La colonna aggiunta a mano nasce protetta.)
CREATE TABLE public.shop_orders_copia (LIKE public.shop_orders INCLUDING ALL);
ALTER TABLE public.shop_orders_copia ADD COLUMN colonna_futura text;
GRANT ALL ON public.shop_orders_copia TO anon, authenticated, service_role;
CREATE TRIGGER shop_orders_copia_protezione BEFORE INSERT OR UPDATE ON public.shop_orders_copia FOR EACH ROW EXECUTE FUNCTION public.shop_orders_protezione();
SELECT pg_temp.uguale('COLONNA FUTURA · anon inserisce l''ordine di oggi nella copia (colonna_futura vuota): passa', 'ok:1', pg_temp.inserisci('anon', pg_temp.corpo(50), 'public.shop_orders_copia'));
SELECT pg_temp.uguale('COLONNA FUTURA · anon con colonna_futura valorizzata → rifiutato dal trigger (nasce protetta)', '42501 trigger:colonna', pg_temp.inserisci('anon', pg_temp.corpo(51, '{"colonna_futura":"x"}'), 'public.shop_orders_copia'));
SELECT pg_temp.uguale('COLONNA FUTURA · authenticated la cambia → rifiutato dal trigger', '42501 trigger:colonna',
  pg_temp.pgrst('authenticated', format($q$UPDATE public.shop_orders_copia SET colonna_futura = 'y' WHERE id = %L$q$, pg_temp.oid(50))));
SELECT pg_temp.uguale('COLONNA FUTURA · authenticated cambia note_interne nella copia: passa', 'ok:1',
  pg_temp.pgrst('authenticated', format($q$UPDATE public.shop_orders_copia SET note_interne = 'n' WHERE id = %L$q$, pg_temp.oid(50))));
SELECT pg_temp.uguale('COLONNA FUTURA · il server la scrive: passa', 'ok:1',
  pg_temp.pgrst('service_role', format($q$UPDATE public.shop_orders_copia SET colonna_futura = 'z' WHERE id = %L$q$, pg_temp.oid(50))));

-- ── 11. FASE 2: il REVOKE di S4 non ha avuto effetto (permessi larghi): resta solo il trigger ─────────
GRANT INSERT, UPDATE ON TABLE public.shop_orders TO anon, authenticated;
SELECT pg_temp.uguale('FASE 2 · (i permessi larghi ci sono: anon può scrivere stato_pagamento per i permessi)', 'true', has_column_privilege('anon', 'public.shop_orders', 'stato_pagamento', 'INSERT')::text);
SELECT pg_temp.uguale('FASE 2 · l''insert di oggi come anon passa ancora', 'ok:1', pg_temp.inserisci('anon', pg_temp.corpo(60)));
SELECT pg_temp.uguale('FASE 2 · anon con stato_pagamento = pagato → rifiutato DAL TRIGGER', '42501 trigger:colonna', pg_temp.inserisci('anon', pg_temp.corpo(61, '{"stato_pagamento":"pagato"}')));
SELECT pg_temp.uguale('FASE 2 · anon SENZA request.jwt.claims (solo il ruolo della sessione): stato_pagamento rifiutato lo stesso dal trigger', '42501 trigger:colonna', pg_temp.inserisci('anon', pg_temp.corpo(64, '{"stato_pagamento":"pagato"}'), 'public.shop_orders', false));
SELECT pg_temp.uguale('FASE 2 · anon con canale = sito → rifiutato dal trigger', '42501 trigger:colonna', pg_temp.inserisci('anon', pg_temp.corpo(62, '{"canale":"sito"}')));
SELECT pg_temp.uguale('FASE 2 · anon con prova = true → rifiutato dal trigger', '42501 trigger:colonna', pg_temp.inserisci('anon', pg_temp.corpo(63, '{"prova":true}')));
SELECT pg_temp.uguale('FASE 2 · anon con rimborsato_cent, totale_cent, scade_il, avvisi, email_inviate, fattura_richiesta, provincia, stripe_sessione_id: tutti rifiutati dal trigger',
  '42501 trigger:colonna|42501 trigger:colonna|42501 trigger:colonna|42501 trigger:colonna|42501 trigger:colonna|42501 trigger:colonna|42501 trigger:colonna|42501 trigger:colonna',
  (SELECT string_agg(pg_temp.inserisci('anon', pg_temp.corpo(70 + n, jsonb_build_object(c, v))), '|' ORDER BY n)
     FROM (VALUES (1, 'rimborsato_cent', to_jsonb(5)), (2, 'totale_cent', to_jsonb(100)), (3, 'scade_il', to_jsonb(now())), (4, 'avvisi', '[{"codice":"x"}]'::jsonb), (5, 'email_inviate', '{"conferma_ordine":"inviata"}'::jsonb),
                  (6, 'fattura_richiesta', to_jsonb(true)), (7, 'provincia', to_jsonb('RM'::text)), (8, 'stripe_sessione_id', to_jsonb('cs_x'::text))) x(n, c, v)));
SELECT pg_temp.uguale('FASE 2 · anon con note_interne, tracking, lead_id, metodo_pagamento, pagato_importo: rifiutati (trigger o policy di M1, comunque 42501)', '42501|42501|42501|42501|42501',
  (SELECT string_agg(split_part(pg_temp.inserisci('anon', pg_temp.corpo(80 + n, jsonb_build_object(c, v))), ' ', 1), '|' ORDER BY n)
     FROM (VALUES (1, 'note_interne', to_jsonb('x'::text)), (2, 'tracking', to_jsonb('x'::text)), (3, 'lead_id', to_jsonb(gen_random_uuid())), (4, 'metodo_pagamento', to_jsonb('x'::text)), (5, 'pagato_importo', to_jsonb(1))) x(n, c, v)));
SELECT pg_temp.uguale('FASE 2 · authenticated cambia stato_pagamento → rifiutato dal trigger', '42501 trigger:colonna', pg_temp.aggiorna('authenticated', 100, $s$stato_pagamento = 'rimborsato'$s$));
SELECT pg_temp.uguale('FASE 2 · authenticated cambia canale, prova, scade_il, avvisi → rifiutati dal trigger', '42501 trigger:colonna|42501 trigger:colonna|42501 trigger:colonna|42501 trigger:colonna',
  pg_temp.aggiorna('authenticated', 100, $s$canale = 'altro'$s$) || '|' || pg_temp.aggiorna('authenticated', 100, 'prova = true') || '|' || pg_temp.aggiorna('authenticated', 100, 'scade_il = now()') || '|' || pg_temp.aggiorna('authenticated', 100, $s$avvisi = '[]'::jsonb || '[{"c":1}]'::jsonb$s$));
SELECT pg_temp.uguale('FASE 2 · authenticated cambia note_interne: passa ancora', 'ok:1', pg_temp.aggiorna('authenticated', 100, $s$note_interne = 'ancora ok'$s$));
SELECT pg_temp.uguale('FASE 2 · un account del CRM non può nemmeno riscrivere un valore diverso di total su un ordine altrui', '42501 trigger:colonna',
  pg_temp.pgrst('authenticated', format($q$UPDATE public.shop_orders SET total = total + 1 WHERE id = %L$q$, '00000000-0000-4000-8000-0000000a0001')));
SELECT pg_temp.uguale('FASE 2 · la riga vecchia (di prima di tutto) è rimasta identica', '20|consegnato', (SELECT total::text || '|' || status FROM public.shop_orders WHERE id = '00000000-0000-4000-8000-0000000a0001'));

SELECT 'TUTTI I CONTROLLI DI S4b PASSANO';
