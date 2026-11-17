-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DI M1 E M2 DEGLI ORDINI SU UN POSTGRES VERO (commessa
-- 2026-11-17-crm-ecommerce, T2)
--
-- NON entra in `npm test` e NON si lancia MAI sul database di produzione: serve
-- un database USA-E-GETTA il cui nome contiene «prova» (lo script si ferma se
-- non è così). Niente transazione di annullamento: M1 e M2 hanno il loro
-- BEGIN/COMMIT, quindi le modifiche restano nel database di prova, che poi si
-- butta. Istruzioni e uscita attesa: prove/sql/LEGGIMI.md.
--
--   createdb prova_ordini
--   psql prova_ordini -v ON_ERROR_STOP=1 -f prove/sql/ecommerce-ordini.sql   (dalla radice del repo)
--
-- Il database può essere vuoto: lo script crea i ruoli finti `anon` e
-- `authenticated` (se mancano), `auth.role()` finto e la tabella com'è oggi in
-- produzione (la migrazione 20260722160000, applicata qui). Poi:
--   · una riga «vecchia» (di prima di M1) per verificare che M1 non la tocchi;
--   · M1 applicata DUE volte;
--   · l'anonimo prova a inserire: la riga del checkout passa; già pagato, già
--     collegato, con tracking, con note interne, stato diverso da «nuovo»,
--     retrodatato (ieri) o nel futuro (un'ora) NO; lo stesso id due volte → 23505;
--   · l'anonimo non legge, non modifica, non cancella, non tocca il registro eventi;
--   · «authenticated» legge ancora e aggiorna (M1 non le tocca) ma non inserisce
--     un ordine già pagato; non legge il registro eventi;
--   · M2 applicata DUE volte: «authenticated» non legge e non aggiorna più,
--     l'anonimo inserisce ancora, resta UNA sola policy.
--
-- Dati inventati: nessun nome, numero o indirizzo vero.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
\set m1 'supabase/migrations/20261117120000_ecommerce_ordini.sql'
\set m2 'supabase/ORDINI-SOLO-SERVER.sql'
\set origine 'supabase/migrations/20260722160000_shop_orders.sql'

-- ── Freno: solo su un database di prova ───────────────────────────────────────
DO $f$
BEGIN
  IF current_database() NOT ILIKE '%prova%' THEN
    RAISE EXCEPTION 'STOP: il database si chiama «%», non contiene «prova». Questo script NON va lanciato qui.', current_database();
  END IF;
END $f$;

-- ── Il mondo minimo di Supabase (solo se manca) ───────────────────────────────
DO $f$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
END $f$;
CREATE SCHEMA IF NOT EXISTS auth;
-- Finto: dice il ruolo con cui si è collegati (in Supabase lo dice il token).
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $f$ SELECT current_user::text $f$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated;

\i :origine
-- Come in Supabase: i ruoli hanno i privilegi di tabella, a decidere è la protezione per riga.
GRANT ALL ON public.shop_orders TO anon, authenticated;

CREATE FUNCTION pg_temp.uguale(nome text, atteso text, avuto text) RETURNS text
LANGUAGE plpgsql AS $f$
BEGIN
  IF atteso IS DISTINCT FROM avuto THEN
    RAISE EXCEPTION 'KO %: atteso «%», avuto «%»', nome, atteso, avuto;
  END IF;
  RETURN 'ok  ' || nome;
END $f$;

-- Esegue un'istruzione con il ruolo dato e dice com'è andata: 'ok:<righe>' o il codice dell'errore.
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

-- Righe visibili a un ruolo.
CREATE FUNCTION pg_temp.vede(ruolo text, tabella text) RETURNS text
LANGUAGE plpgsql AS $f$
DECLARE n bigint;
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', ruolo);
  EXECUTE format('SELECT count(*) FROM %s', tabella) INTO n;
  RESET ROLE;
  RETURN n::text;
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RETURN SQLSTATE;
END $f$;

-- Una riga come la manda il checkout (src/shop/invio-ordine.ts): niente created_at.
-- `extra` sono colonne in più, già scritte in SQL («, pagato_il» / «, now()»).
CREATE FUNCTION pg_temp.ins(id uuid, extra_col text DEFAULT '', extra_val text DEFAULT '', stato text DEFAULT 'nuovo') RETURNS text
LANGUAGE sql AS $f$
  SELECT format($q$INSERT INTO public.shop_orders (id, order_ref, nome, cognome, email, telefono, indirizzo, citta, cap, note, items, subtotal, shipping, total, status%s)
    VALUES (%L, 'HG-PROVA1', 'Anna', 'Esempio', 'anna.esempio@example.com', '+39 300 000 0001', 'Via Inventata 1', 'Cittàfinta', '00000', NULL, '[]', 20, 4.9, 24.9, %L%s)$q$,
    extra_col, id, stato, extra_val)
$f$;

-- ── 0. Una riga «vecchia», di prima di M1 ─────────────────────────────────────
INSERT INTO public.shop_orders (id, order_ref, nome, cognome, email, telefono, indirizzo, citta, cap, items, total, status, created_at)
VALUES ('00000000-0000-4000-8000-0000000000a1', 'HG-VECCHIO', 'Vecchio', 'Esempio', 'vecchio@example.com', '+39 300 000 0000', 'Via Inventata 0', 'Cittàfinta', '00000', '[]', 10, 'spedito', now() - interval '60 days');
SELECT pg_temp.uguale('prima di M1: la policy larga c''è e l''anonimo inserisce di tutto (già pagato incluso, è il difetto da correggere)',
  'ok:1', pg_temp.come('anon', 'INSERT INTO public.shop_orders (id, order_ref, nome, cognome, email, telefono, indirizzo, citta, cap, items, status) VALUES (''00000000-0000-4000-8000-0000000000a2'', ''HG-X'', ''x'', ''x'', ''x'', ''x'', ''x'', ''x'', ''x'', ''[]'', ''pagato'')'));
DELETE FROM public.shop_orders WHERE id = '00000000-0000-4000-8000-0000000000a2'; -- prova su database usa-e-getta

-- ── 1. M1, DUE volte ──────────────────────────────────────────────────────────
\i :m1
\i :m1
\echo 'ok  M1 applicata due volte senza errori'
-- Come in Supabase (privilegi di default sulle tabelle nuove): a fermare i ruoli è solo la protezione per riga, senza policy.
GRANT ALL ON public.shop_order_eventi TO anon, authenticated;

SELECT pg_temp.uguale('M1: la riga vecchia c''è ancora, intatta, con le colonne nuove vuote',
  'spedito|10|false', (SELECT status || '|' || total || '|' || concat_ws('', lead_id, pagato_il, pagato_importo, metodo_pagamento, tracking, note_interne, aggiornato_il, senza_lead::text) FROM public.shop_orders WHERE id = '00000000-0000-4000-8000-0000000000a1')
  );
SELECT pg_temp.uguale('M1: nessuna riga in più, nessuna in meno', '1', (SELECT count(*)::text FROM public.shop_orders));
SELECT pg_temp.uguale('M1: le policy di shop_orders dopo la doppia applicazione (la larga è sparita, la stretta c''è una volta)',
  'authenticated can read shop orders|authenticated can update shop orders|shop_orders_insert_checkout',
  (SELECT string_agg(policyname, '|' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shop_orders'));
SELECT pg_temp.uguale('M1: shop_order_eventi ha la protezione per riga accesa e nessuna policy',
  'true|0', (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.shop_order_eventi'::regclass) || '|' || (SELECT count(*)::text FROM pg_policies WHERE tablename = 'shop_order_eventi'));
SELECT pg_temp.uguale('M1: gli indici nuovi ci sono (lead_id parziale, status, eventi)',
  'idx_shop_order_eventi_ordine|idx_shop_orders_created_at|idx_shop_orders_lead_id|idx_shop_orders_status',
  (SELECT string_agg(indexname, '|' ORDER BY indexname) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_shop_order%'));

-- ── 2. L'anonimo: cosa passa e cosa no ────────────────────────────────────────
SELECT pg_temp.uguale('anonimo: la riga del checkout (senza created_at) PASSA',
  'ok:1', pg_temp.come('anon', pg_temp.ins('00000000-0000-4000-8000-0000000000b1')));
SELECT pg_temp.uguale('anonimo: la riga del checkout con senza_lead=false esplicito passa',
  'ok:1', pg_temp.come('anon', pg_temp.ins('00000000-0000-4000-8000-0000000000b2', ', senza_lead', ', false')));
SELECT pg_temp.uguale('anonimo: lo STESSO id due volte → 23505 (chiave già presa: il checkout lo legge come «già salvato»)',
  '23505', pg_temp.come('anon', pg_temp.ins('00000000-0000-4000-8000-0000000000b1')));
SELECT pg_temp.uguale('anonimo: con created_at = adesso passa', 'ok:1', pg_temp.come('anon', pg_temp.ins('00000000-0000-4000-8000-0000000000b3', ', created_at', ', now()')));

SELECT pg_temp.uguale('anonimo: «già pagato» (pagato_il) → rifiutato 42501',    '42501', pg_temp.come('anon', pg_temp.ins('00000000-0000-4000-8000-0000000000c1', ', pagato_il', ', now()')));
SELECT pg_temp.uguale('anonimo: pagato_importo → rifiutato',                    '42501', pg_temp.come('anon', pg_temp.ins('00000000-0000-4000-8000-0000000000c2', ', pagato_importo', ', 5')));
SELECT pg_temp.uguale('anonimo: metodo_pagamento → rifiutato',                  '42501', pg_temp.come('anon', pg_temp.ins('00000000-0000-4000-8000-0000000000c3', ', metodo_pagamento', ', ''contanti''')));
SELECT pg_temp.uguale('anonimo: «già collegato» (lead_id) → rifiutato',         '42501', pg_temp.come('anon', pg_temp.ins('00000000-0000-4000-8000-0000000000c4', ', lead_id', ', gen_random_uuid()')));
SELECT pg_temp.uguale('anonimo: senza_lead = true → rifiutato',                 '42501', pg_temp.come('anon', pg_temp.ins('00000000-0000-4000-8000-0000000000c5', ', senza_lead', ', true')));
SELECT pg_temp.uguale('anonimo: tracking → rifiutato',                          '42501', pg_temp.come('anon', pg_temp.ins('00000000-0000-4000-8000-0000000000c6', ', tracking', ', ''XYZ''')));
SELECT pg_temp.uguale('anonimo: note_interne → rifiutato',                      '42501', pg_temp.come('anon', pg_temp.ins('00000000-0000-4000-8000-0000000000c7', ', note_interne', ', ''x''')));
SELECT pg_temp.uguale('anonimo: aggiornato_il → rifiutato',                     '42501', pg_temp.come('anon', pg_temp.ins('00000000-0000-4000-8000-0000000000c8', ', aggiornato_il', ', now()')));
SELECT pg_temp.uguale('anonimo: stato «pagato» → rifiutato',                    '42501', pg_temp.come('anon', pg_temp.ins('00000000-0000-4000-8000-0000000000c9', '', '', 'pagato')));
SELECT pg_temp.uguale('anonimo: stato «spedito» → rifiutato',                   '42501', pg_temp.come('anon', pg_temp.ins('00000000-0000-4000-8000-0000000000ca', '', '', 'spedito')));
SELECT pg_temp.uguale('anonimo: created_at di IERI (retrodatato) → rifiutato',  '42501', pg_temp.come('anon', pg_temp.ins('00000000-0000-4000-8000-0000000000cb', ', created_at', ', now() - interval ''1 day''')));
SELECT pg_temp.uguale('anonimo: created_at di 11 minuti fa → rifiutato',        '42501', pg_temp.come('anon', pg_temp.ins('00000000-0000-4000-8000-0000000000cc', ', created_at', ', now() - interval ''11 minutes''')));
SELECT pg_temp.uguale('anonimo: created_at tra un''ora (nel futuro) → rifiutato', '42501', pg_temp.come('anon', pg_temp.ins('00000000-0000-4000-8000-0000000000cd', ', created_at', ', now() + interval ''1 hour''')));
SELECT pg_temp.uguale('anonimo: created_at tra 2 minuti → rifiutato (la finestra avanti è di 1)', '42501', pg_temp.come('anon', pg_temp.ins('00000000-0000-4000-8000-0000000000ce', ', created_at', ', now() + interval ''2 minutes''')));
SELECT pg_temp.uguale('le righe rifiutate non sono entrate: restano 1 vecchia + 3 del checkout', '4', (SELECT count(*)::text FROM public.shop_orders));

SELECT pg_temp.uguale('anonimo: non legge shop_orders (0 righe visibili)', '0', pg_temp.vede('anon', 'public.shop_orders'));
SELECT pg_temp.uguale('anonimo: UPDATE su shop_orders → 0 righe toccate', 'ok:0', pg_temp.come('anon', 'UPDATE public.shop_orders SET status = ''pagato'''));
SELECT pg_temp.uguale('anonimo: DELETE su shop_orders → 0 righe toccate', 'ok:0', pg_temp.come('anon', 'DELETE FROM public.shop_orders'));
SELECT pg_temp.uguale('i dati sono intatti dopo i tentativi dell''anonimo', '4', (SELECT count(*)::text FROM public.shop_orders WHERE status IN ('nuovo', 'spedito') AND pagato_il IS NULL));
SELECT pg_temp.uguale('anonimo: non legge il registro eventi', '0', pg_temp.vede('anon', 'public.shop_order_eventi'));
SELECT pg_temp.uguale('anonimo: non scrive nel registro eventi (42501)', '42501', pg_temp.come('anon', 'INSERT INTO public.shop_order_eventi (order_id, tipo) VALUES (gen_random_uuid(), ''prova'')'));

-- ── 3. Gli account Supabase («authenticated») dopo M1 ─────────────────────────
SELECT pg_temp.uguale('authenticated dopo M1: legge ancora gli ordini (M1 non tocca le sue policy)', '4', pg_temp.vede('authenticated', 'public.shop_orders'));
SELECT pg_temp.uguale('authenticated dopo M1: aggiorna ancora (pagato_il, tracking)', 'ok:4', pg_temp.come('authenticated', 'UPDATE public.shop_orders SET pagato_il = now(), tracking = ''T1'''));
SELECT pg_temp.uguale('authenticated: non inserisce un ordine già pagato dal browser (la policy stretta vale per tutti i ruoli)', '42501', pg_temp.come('authenticated', pg_temp.ins('00000000-0000-4000-8000-0000000000d1', ', pagato_il', ', now()')));
SELECT pg_temp.uguale('authenticated: non legge il registro eventi', '0', pg_temp.vede('authenticated', 'public.shop_order_eventi'));
SELECT pg_temp.uguale('authenticated: non scrive nel registro eventi (42501)', '42501', pg_temp.come('authenticated', 'INSERT INTO public.shop_order_eventi (order_id, tipo) VALUES (gen_random_uuid(), ''prova'')'));
SELECT pg_temp.uguale('il proprietario del database (il server, che salta le policy) scrive nel registro eventi', 'ok:1',
  pg_temp.come(current_user, 'INSERT INTO public.shop_order_eventi (order_id, order_ref, tipo, chi, prima, dopo) VALUES (gen_random_uuid(), ''HG-PROVA1'', ''pagato'', ''Titolare'', ''{"pagato_il": null}'', ''{"pagato_il": "2026-11-17"}'')'));

-- ── 4. M2, DUE volte ──────────────────────────────────────────────────────────
\i :m2
\i :m2
\echo 'ok  M2 applicata due volte senza errori'
SELECT pg_temp.uguale('M2: resta UNA sola policy su shop_orders, l''inserimento stretto', 'shop_orders_insert_checkout|INSERT',
  (SELECT string_agg(policyname || '|' || cmd, ';' ORDER BY policyname) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shop_orders'));
SELECT pg_temp.uguale('M2: authenticated non legge più gli ordini', '0', pg_temp.vede('authenticated', 'public.shop_orders'));
SELECT pg_temp.uguale('M2: authenticated non aggiorna più (0 righe)', 'ok:0', pg_temp.come('authenticated', 'UPDATE public.shop_orders SET tracking = ''ALTRO'''));
SELECT pg_temp.uguale('M2: l''anonimo continua a inserire l''ordine del checkout', 'ok:1', pg_temp.come('anon', pg_temp.ins('00000000-0000-4000-8000-0000000000e1')));
SELECT pg_temp.uguale('M2: nessun dato toccato (5 righe, tracking dei vecchi ancora T1 per le 4 di prima)', '5|4',
  (SELECT count(*)::text || '|' || count(*) FILTER (WHERE tracking = 'T1')::text FROM public.shop_orders));

\echo 'TUTTI I CONTROLLI DI M1 E M2 PASSANO'
