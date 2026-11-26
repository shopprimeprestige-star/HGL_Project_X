-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DELLA MIGRAZIONE «EDITOR PRODOTTI» SU UN POSTGRES VERO
-- (commessa 2026-11-25-editor-prodotti, compito E1)
--
-- NON entra in `npm test` e NON si lancia MAI sul database di produzione: serve un database
-- USA-E-GETTA il cui nome contiene «prova» (lo script si ferma se non è così). Applica S1 e poi la migrazione
-- `20261125120000_shop_editor_prodotti.sql` (due volte) e rifà gli scenari di `prove/negozio/_scenari-import.json`
-- (il mondo e ogni scenario, sotto il suo marcatore `-- SCENARIO:`), poi le prove che il finto non può fare.
--
--   createdb prova_editor
--   psql prova_editor -v ON_ERROR_STOP=1 -f prove/sql/shop-editor-prodotti.sql      (dalla radice del repo)
--
-- Serve un utente superutente del database di prova. Il database può essere vuoto: lo script crea i ruoli
-- finti `anon`, `authenticated`, `service_role` (con i permessi di partenza di Supabase: tutto a tutti, ed è la
-- migrazione a togliere) e lo schema `storage` finto che S1 si aspetta.
--
-- Cosa prova (ogni controllo stampa `ok  <nome>`, al primo sbagliato si ferma con `KO <nome>`):
--   · la migrazione senza S1 si ferma senza lasciare né la colonna né la funzione;
--   · con dati già dentro (un prodotto e una variante), applicata DUE volte: i dati sono identici (a parte la colonna nuova,
--     vuota), la colonna c'è una sola volta con un solo vincolo, le quattro viste shop_v_* sono identiche e non citano il costo;
--   · la funzione: `has_function_privilege` falso per PUBLIC, anon, authenticated e vero per service_role, `prosecdef`,
--     `proconfig` con `search_path`; chiamata da service_role funziona, da anon e authenticated no;
--   · gli scenari: creato, quattro varianti, indirizzo già presente, SKU di un altro prodotto o di una sua variante, SKU doppio,
--     giacenza zero, categoria inesistente (NIENTE scritto), input con stato «pubblicato», id e origine (ignorati), 51 varianti,
--     giacenza 99999999999, prezzo oltre il tetto, secondo invio, «chi» vuoto, campi vuoti;
--   · il rifiuto per errore del database non fa uscire il messaggio (solo il codice), e non lascia nessuna scrittura.
--
-- Dati inventati: nessun nome, numero o percorso vero.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
SET client_min_messages = warning;
\if :{?s1}
\else
\set s1 'supabase/migrations/20261120120000_shop_catalogo.sql'
\endif
\if :{?e1}
\else
\set e1 'supabase/migrations/20261125120000_shop_editor_prodotti.sql'
\endif

DO $f$
BEGIN
  IF current_database() NOT ILIKE '%prova%' THEN
    RAISE EXCEPTION 'STOP: il database si chiama «%», non contiene «prova». Questo script NON va lanciato qui.', current_database();
  END IF;
END $f$;

-- ── Il mondo minimo di Supabase ───────────────────────────────────────────────
DO $f$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $f$;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE IF NOT EXISTS storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ── Gli aiuti del collaudo (vivono solo in questa sessione) ───────────────────
CREATE FUNCTION pg_temp.uguale(nome text, atteso text, avuto text) RETURNS text
LANGUAGE plpgsql AS $f$
BEGIN
  IF atteso IS DISTINCT FROM avuto THEN
    RAISE EXCEPTION 'KO %: atteso «%», avuto «%»', nome, atteso, avuto;
  END IF;
  RETURN 'ok  ' || nome;
END $f$;

-- Esegue un'istruzione come il proprietario: '' se va, altrimenti «CODICE messaggio».
CREATE FUNCTION pg_temp.errore(istruzione text) RETURNS text
LANGUAGE plpgsql AS $f$
BEGIN
  EXECUTE istruzione;
  RETURN '';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE || ' ' || SQLERRM;
END $f$;

-- Come `errore`, ma col ruolo di PostgREST (anon, authenticated, service_role).
CREATE FUNCTION pg_temp.come(ruolo text, istruzione text) RETURNS text
LANGUAGE plpgsql AS $f$
BEGIN
  EXECUTE format('SET LOCAL ROLE %I', ruolo);
  EXECUTE istruzione;
  RESET ROLE;
  RETURN '';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RETURN SQLSTATE || ' ' || SQLERRM;
END $f$;

-- Chiama la funzione dell'import (come proprietario) e dà la risposta.
CREATE FUNCTION pg_temp.chiama(p jsonb, v jsonb, c uuid[], chi text) RETURNS jsonb
LANGUAGE plpgsql AS $f$ BEGIN RETURN public.shop_import_prodotto(p, v, c, chi); END $f$;

-- La risposta contiene l'atteso (le liste per elemento, come `@>`)?
CREATE FUNCTION pg_temp.contiene(nome text, avuto jsonb, atteso jsonb) RETURNS text
LANGUAGE plpgsql AS $f$
BEGIN
  IF NOT (avuto @> atteso) THEN
    RAISE EXCEPTION 'KO %: atteso «%», avuto «%»', nome, atteso, avuto;
  END IF;
  RETURN 'ok  ' || nome;
END $f$;

-- Righe di una tabella che contengono `dove`: se `conta` c'è, devono essere quelle; altrimenti ne serve UNA e deve contenere `atteso`.
CREATE FUNCTION pg_temp.controlla(nome text, tabella text, dove jsonb, conta integer, atteso jsonb) RETURNS text
LANGUAGE plpgsql AS $f$
DECLARE
  v_n integer;
  v_riga jsonb;
BEGIN
  EXECUTE format('SELECT count(*), min(to_jsonb(t)::text)::jsonb FROM public.%I t WHERE to_jsonb(t) @> %L::jsonb', tabella, dove) INTO v_n, v_riga;
  IF conta IS NOT NULL THEN
    IF v_n <> conta THEN RAISE EXCEPTION 'KO %: attese % righe, trovate %', nome, conta, v_n; END IF;
  ELSE
    IF v_n <> 1 OR NOT (v_riga @> atteso) THEN
      RAISE EXCEPTION 'KO %: atteso «%», trovate % righe, la riga è «%»', nome, atteso, v_n, v_riga;
    END IF;
  END IF;
  RETURN 'ok  ' || nome;
END $f$;

-- Un'impronta delle righe di una tabella SENZA la colonna del costo (per vedere che i dati di prima non cambiano).
CREATE FUNCTION pg_temp.impronta(tabella text) RETURNS text
LANGUAGE plpgsql AS $f$
DECLARE v text;
BEGIN
  EXECUTE format('SELECT md5(COALESCE(string_agg((to_jsonb(t) - ''costo_cent'')::text, ''|'' ORDER BY (to_jsonb(t) - ''costo_cent'')::text), '''')) FROM public.%I t', tabella) INTO v;
  RETURN v;
END $f$;

-- ── 1. La migrazione senza S1: si ferma e non lascia niente ───────────────────
\echo '(seguono errori ATTESI: la migrazione si ferma perche S1 non e ancora presente)'
\set ON_ERROR_STOP off
\set VERBOSITY terse
\i :e1
\set ON_ERROR_STOP on
SELECT pg_temp.uguale('senza S1 la funzione NON nasce (il file si è fermato prima di scrivere)', 'null', COALESCE(to_regprocedure('public.shop_import_prodotto(jsonb, jsonb, uuid[], text)')::text, 'null'));
SELECT pg_temp.uguale('senza S1 non nasce nemmeno una tabella', 'null', COALESCE(to_regclass('public.shop_varianti')::text, 'null'));

-- ── 2. S1, i dati di prima, poi la migrazione DUE volte ───────────────────────
\i :s1
INSERT INTO public.shop_categorie (id, slug, nome) VALUES
  ('00000000-0000-4000-8000-000000000100', 'categoria-prova', 'Categoria di prova'),
  ('00000000-0000-4000-8000-000000000101', 'seconda-categoria-prova', 'Seconda categoria di prova');
INSERT INTO public.shop_prodotti (id, sku, slug, nome, tipo, prezzo_cent, stato) VALUES
  ('00000000-0000-4000-8000-000000000200', 'PROVA-ESISTENTE', 'prodotto-esistente', 'Prodotto esistente', 'cura', 2890, 'bozza');
INSERT INTO public.shop_varianti (id, prodotto_id, sku, nome, opzioni) VALUES
  ('00000000-0000-4000-8000-000000000300', '00000000-0000-4000-8000-000000000200', 'PROVA-ESISTENTE-ROSSO', 'Rosso', '{"Colore":"Rosso"}');
SELECT pg_temp.impronta('shop_prodotti') AS impronta_prodotti, pg_temp.impronta('shop_varianti') AS impronta_varianti,
       (SELECT md5(string_agg(pg_get_viewdef(c.oid), '|' ORDER BY c.relname)) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname LIKE 'shop\_v\_%') AS impronta_viste,
       (SELECT count(*)::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname LIKE 'shop\_v\_%') AS n_viste \gset
\i :e1
\i :e1
\echo 'ok  la migrazione applicata due volte di seguito senza errori'
SELECT pg_temp.uguale('i prodotti di prima sono identici', :'impronta_prodotti', pg_temp.impronta('shop_prodotti'));
SELECT pg_temp.uguale('le varianti di prima sono identiche (a parte la colonna nuova)', :'impronta_varianti', pg_temp.impronta('shop_varianti'));
SELECT pg_temp.uguale('il costo delle righe di prima è vuoto', '0', (SELECT count(*)::text FROM public.shop_varianti WHERE costo_cent IS NOT NULL));
SELECT pg_temp.uguale('il prodotto di prima è uno solo e le sue righe sono quelle di prima', '1|1', (SELECT count(*)::text FROM public.shop_prodotti) || '|' || (SELECT count(*)::text FROM public.shop_varianti));
SELECT pg_temp.uguale('le quattro viste ci sono e sono identiche a prima', :'n_viste' || '|' || :'impronta_viste',
  (SELECT count(*)::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname LIKE 'shop\_v\_%') || '|' ||
  (SELECT md5(string_agg(pg_get_viewdef(c.oid), '|' ORDER BY c.relname)) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname LIKE 'shop\_v\_%'));
SELECT pg_temp.uguale('nessuna vista cita il costo', '0', (SELECT count(*)::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname LIKE 'shop\_v\_%' AND pg_get_viewdef(c.oid) ILIKE '%costo%'));
SELECT pg_temp.uguale('la colonna del costo c''è una volta sola, intera, senza obbligo', 'costo_cent|integer|YES|1',
  (SELECT column_name || '|' || data_type || '|' || is_nullable || '|' || (SELECT count(*)::text FROM pg_constraint k WHERE k.conrelid = 'public.shop_varianti'::regclass AND pg_get_constraintdef(k.oid) ILIKE '%costo_cent%')
     FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shop_varianti' AND column_name = 'costo_cent'));
SELECT pg_temp.uguale('il costo negativo lo rifiuta il database', '23514', left(pg_temp.errore('UPDATE public.shop_varianti SET costo_cent = -1'), 5));
SELECT pg_temp.uguale('il costo zero e il costo vuoto passano', '', pg_temp.errore('UPDATE public.shop_varianti SET costo_cent = 0') || pg_temp.errore('UPDATE public.shop_varianti SET costo_cent = NULL'));
SELECT pg_temp.uguale('la funzione c''è una sola volta (nessun doppione di firma)', '1', (SELECT count(*)::text FROM pg_proc WHERE proname = 'shop_import_prodotto' AND pronamespace = 'public'::regnamespace));

-- ── 3. I permessi e le impostazioni della funzione ────────────────────────────
SELECT pg_temp.uguale('PUBLIC non esegue la funzione', 'false', (SELECT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.proname = 'shop_import_prodotto' AND a.grantee = 0 AND a.privilege_type = 'EXECUTE')::text));
SELECT pg_temp.uguale('anon non esegue la funzione', 'false', has_function_privilege('anon', 'public.shop_import_prodotto(jsonb, jsonb, uuid[], text)', 'EXECUTE')::text);
SELECT pg_temp.uguale('authenticated non esegue la funzione', 'false', has_function_privilege('authenticated', 'public.shop_import_prodotto(jsonb, jsonb, uuid[], text)', 'EXECUTE')::text);
SELECT pg_temp.uguale('service_role esegue la funzione', 'true', has_function_privilege('service_role', 'public.shop_import_prodotto(jsonb, jsonb, uuid[], text)', 'EXECUTE')::text);
SELECT pg_temp.uguale('la funzione gira con i diritti del proprietario (SECURITY DEFINER)', 'true', (SELECT prosecdef::text FROM pg_proc WHERE proname = 'shop_import_prodotto'));
SELECT pg_temp.uguale('la funzione fissa il percorso: search_path = public, pg_temp', 'true', (SELECT (proconfig @> ARRAY['search_path=public, pg_temp'])::text FROM pg_proc WHERE proname = 'shop_import_prodotto'));
SELECT pg_temp.uguale('anon non può chiamarla', '42501', left(pg_temp.come('anon', 'SELECT public.shop_import_prodotto(''{}''::jsonb, ''[]''::jsonb, ARRAY[]::uuid[], ''x'')'), 5));
SELECT pg_temp.uguale('authenticated non può chiamarla', '42501', left(pg_temp.come('authenticated', 'SELECT public.shop_import_prodotto(''{}''::jsonb, ''[]''::jsonb, ARRAY[]::uuid[], ''x'')'), 5));
SELECT pg_temp.uguale('service_role può chiamarla (la sonda con {} risponde senza errori)', '', pg_temp.come('service_role', 'SELECT public.shop_import_prodotto(''{}''::jsonb, ''[]''::jsonb, ARRAY[]::uuid[], ''x'')'));
BEGIN;
SET LOCAL ROLE service_role;
SELECT public.shop_import_prodotto('{"sku":"PROVA-RUOLO","slug":"prodotto-ruolo","nome":"Prodotto ruolo","tipo":"kit","prezzo_cent":100}'::jsonb,
  '[{"sku":"PROVA-RUOLO","giacenza":1}]'::jsonb, ARRAY[]::uuid[], 'prova') ->> 'esito' AS esito_ruolo \gset
RESET ROLE;
SELECT pg_temp.uguale('service_role crea davvero un prodotto, col suo movimento e il suo storico (i registri li scrive la funzione, non il ruolo)', 'creato|1|2',
  :'esito_ruolo' || '|' || (SELECT count(*)::text FROM public.shop_giacenza_movimenti) || '|' || (SELECT count(*)::text FROM public.shop_storico));
SELECT pg_temp.uguale('…e service_role da solo non può scrivere nei registri (nessuna scrittura diretta)', '42501', left(pg_temp.come('service_role', 'UPDATE public.shop_giacenza_movimenti SET delta = 0'), 5));
ROLLBACK;
SELECT pg_temp.uguale('la funzione non usa mai un record preso dall''input: lo stato esce sempre «bozza»', 'true', (SELECT (prosrc !~* 'populate_record|to_record|recordset' AND prosrc ~ '''bozza''')::text FROM pg_proc WHERE proname = 'shop_import_prodotto'));

-- ── 4. Gli scenari dell'elenco unico (ognuno parte dal mondo qui sopra e finisce con ROLLBACK) ──
-- SCENARIO: semplice
-- Un prodotto con la sua variante: bozza, giacenza 10 come movimento «carico» con nota «Import CSV», costo, categoria, storico.
BEGIN;
SELECT pg_temp.contiene('semplice · 1) creato', pg_temp.chiama($j${"sku": "PROVA-NUOVO", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": 450, "giacenza": 10, "ordine": 1}]$j$::jsonb, ARRAY['00000000-0000-4000-8000-000000000100']::uuid[], 'Titolare Prova'), $j${"esito": "creato", "varianti": [{"sku": "PROVA-NUOVO"}]}$j$::jsonb);
SELECT pg_temp.controlla('semplice · shop_prodotti {"slug": "prodotto-nuovo"}', 'shop_prodotti', $j${"slug": "prodotto-nuovo"}$j$::jsonb, NULL, $j${"sku": "PROVA-NUOVO", "nome": "Prodotto di prova", "tipo": "cura", "stato": "bozza", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026", "origine": null, "id_codice": null}$j$::jsonb);
SELECT pg_temp.controlla('semplice · shop_varianti {"sku": "PROVA-NUOVO"}', 'shop_varianti', $j${"sku": "PROVA-NUOVO"}$j$::jsonb, NULL, $j${"nome": "Unica", "prezzo_cent": null, "giacenza": 10, "costo_cent": 450, "attiva": true, "peso_g": null, "gtin": null}$j$::jsonb);
SELECT pg_temp.controlla('semplice · shop_giacenza_movimenti {"motivo": "carico", "nota": "Import CSV", "chi": "Titolare Prova", "delta": 10,', 'shop_giacenza_movimenti', $j${"motivo": "carico", "nota": "Import CSV", "chi": "Titolare Prova", "delta": 10, "giacenza_dopo": 10}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('semplice · shop_giacenza_movimenti {}', 'shop_giacenza_movimenti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('semplice · shop_prodotti_categorie {"categoria_id": "00000000-0000-4000-8000-000000000100"}', 'shop_prodotti_categorie', $j${"categoria_id": "00000000-0000-4000-8000-000000000100"}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('semplice · shop_storico {"entita": "prodotto", "campo": "creato", "chi": "Titolare Prova"}', 'shop_storico', $j${"entita": "prodotto", "campo": "creato", "chi": "Titolare Prova"}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('semplice · shop_storico {"entita": "variante", "campo": "creata", "chi": "Titolare Prova"}', 'shop_storico', $j${"entita": "variante", "campo": "creata", "chi": "Titolare Prova"}$j$::jsonb, 1, NULL);
ROLLBACK;

-- SCENARIO: quattro_varianti
-- Quattro varianti con opzioni: ognuna con il suo SKU, due con giacenza (due movimenti), due categorie.
BEGIN;
SELECT pg_temp.contiene('quattro_varianti · 1) creato', pg_temp.chiama($j${"sku": "PROVA-COL", "slug": "prodotto-colori", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-COL-ROSSO-S", "nome": "Rosso / S", "opzioni": {"Colore": "Rosso", "Taglia": "S"}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 5, "ordine": 1}, {"sku": "PROVA-COL-ROSSO-M", "nome": "Rosso / M", "opzioni": {"Colore": "Rosso", "Taglia": "M"}, "prezzo_cent": 2190, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 2}, {"sku": "PROVA-COL-NERO-S", "nome": "Nero / S", "opzioni": {"Colore": "Nero", "Taglia": "S"}, "prezzo_cent": null, "peso_g": null, "gtin": "8012345678912", "costo_cent": null, "giacenza": 3, "ordine": 3}, {"sku": "PROVA-COL-NERO-M", "nome": "Nero / M", "opzioni": {"Colore": "Nero", "Taglia": "M"}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 4}]$j$::jsonb, ARRAY['00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-000000000101']::uuid[], 'Titolare Prova'), $j${"esito": "creato", "varianti": [{"sku": "PROVA-COL-ROSSO-S"}, {"sku": "PROVA-COL-ROSSO-M"}, {"sku": "PROVA-COL-NERO-S"}, {"sku": "PROVA-COL-NERO-M"}]}$j$::jsonb);
SELECT pg_temp.controlla('quattro_varianti · shop_varianti {}', 'shop_varianti', $j${}$j$::jsonb, 5, NULL);
SELECT pg_temp.controlla('quattro_varianti · shop_varianti {"sku": "PROVA-COL-ROSSO-M"}', 'shop_varianti', $j${"sku": "PROVA-COL-ROSSO-M"}$j$::jsonb, NULL, $j${"prezzo_cent": 2190, "giacenza": 0, "opzioni": {"Colore": "Rosso", "Taglia": "M"}, "ordine": 2}$j$::jsonb);
SELECT pg_temp.controlla('quattro_varianti · shop_varianti {"sku": "PROVA-COL-NERO-S"}', 'shop_varianti', $j${"sku": "PROVA-COL-NERO-S"}$j$::jsonb, NULL, $j${"giacenza": 3, "gtin": "8012345678912"}$j$::jsonb);
SELECT pg_temp.controlla('quattro_varianti · shop_giacenza_movimenti {}', 'shop_giacenza_movimenti', $j${}$j$::jsonb, 2, NULL);
SELECT pg_temp.controlla('quattro_varianti · shop_prodotti_categorie {}', 'shop_prodotti_categorie', $j${}$j$::jsonb, 2, NULL);
SELECT pg_temp.controlla('quattro_varianti · shop_storico {"entita": "variante", "campo": "creata"}', 'shop_storico', $j${"entita": "variante", "campo": "creata"}$j$::jsonb, 4, NULL);
ROLLBACK;

-- SCENARIO: slug_gia_presente
-- L'indirizzo esiste già: «gia_presente» col nome di chi c'è, niente di nuovo scritto.
BEGIN;
SELECT pg_temp.contiene('slug_gia_presente · 1) gia_presente', pg_temp.chiama($j${"sku": "PROVA-ALTRO", "slug": "prodotto-esistente", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-ALTRO", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 4, "ordine": 1}]$j$::jsonb, ARRAY['00000000-0000-4000-8000-000000000100']::uuid[], 'Titolare Prova'), $j${"esito": "gia_presente", "nome": "Prodotto esistente"}$j$::jsonb);
SELECT pg_temp.controlla('slug_gia_presente · shop_prodotti {}', 'shop_prodotti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('slug_gia_presente · shop_varianti {}', 'shop_varianti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('slug_gia_presente · shop_giacenza_movimenti {}', 'shop_giacenza_movimenti', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('slug_gia_presente · shop_storico {}', 'shop_storico', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('slug_gia_presente · shop_prodotti_categorie {}', 'shop_prodotti_categorie', $j${}$j$::jsonb, 0, NULL);
ROLLBACK;

-- SCENARIO: sku_di_altro_prodotto
-- Lo SKU del prodotto è quello di un altro prodotto: «sku_usato» col nome, niente scritto.
BEGIN;
SELECT pg_temp.contiene('sku_di_altro_prodotto · 1) sku_usato', pg_temp.chiama($j${"sku": "PROVA-ESISTENTE", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 4, "ordine": 1}]$j$::jsonb, ARRAY[]::uuid[], 'Titolare Prova'), $j${"esito": "sku_usato", "sku": "PROVA-ESISTENTE", "prodotto_nome": "Prodotto esistente"}$j$::jsonb);
SELECT pg_temp.controlla('sku_di_altro_prodotto · shop_prodotti {}', 'shop_prodotti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('sku_di_altro_prodotto · shop_varianti {}', 'shop_varianti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('sku_di_altro_prodotto · shop_giacenza_movimenti {}', 'shop_giacenza_movimenti', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('sku_di_altro_prodotto · shop_storico {}', 'shop_storico', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('sku_di_altro_prodotto · shop_prodotti_categorie {}', 'shop_prodotti_categorie', $j${}$j$::jsonb, 0, NULL);
ROLLBACK;

-- SCENARIO: sku_variante_di_altro_prodotto
-- Lo SKU di una variante è quello di una variante di un altro prodotto (ROSSO-S): «sku_usato», e il prodotto NON nasce (niente bozza orfana).
BEGIN;
SELECT pg_temp.contiene('sku_variante_di_altro_prodotto · 1) sku_usato', pg_temp.chiama($j${"sku": "PROVA-NUOVO", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 1}, {"sku": "PROVA-ESISTENTE-ROSSO", "nome": "Rosso", "opzioni": {"Colore": "Rosso"}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 2, "ordine": 2}]$j$::jsonb, ARRAY[]::uuid[], 'Titolare Prova'), $j${"esito": "sku_usato", "sku": "PROVA-ESISTENTE-ROSSO", "prodotto_nome": "Prodotto esistente"}$j$::jsonb);
SELECT pg_temp.controlla('sku_variante_di_altro_prodotto · shop_prodotti {}', 'shop_prodotti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('sku_variante_di_altro_prodotto · shop_varianti {}', 'shop_varianti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('sku_variante_di_altro_prodotto · shop_giacenza_movimenti {}', 'shop_giacenza_movimenti', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('sku_variante_di_altro_prodotto · shop_storico {}', 'shop_storico', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('sku_variante_di_altro_prodotto · shop_prodotti_categorie {}', 'shop_prodotti_categorie', $j${}$j$::jsonb, 0, NULL);
ROLLBACK;

-- SCENARIO: sku_prodotto_come_variante_altrui
-- Lo SKU del prodotto è quello di una VARIANTE di un altro prodotto: «sku_usato» col nome del prodotto di quella variante.
BEGIN;
SELECT pg_temp.contiene('sku_prodotto_come_variante_altrui · 1) sku_usato', pg_temp.chiama($j${"sku": "PROVA-ESISTENTE-ROSSO", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 1}]$j$::jsonb, ARRAY[]::uuid[], 'Titolare Prova'), $j${"esito": "sku_usato", "sku": "PROVA-ESISTENTE-ROSSO", "prodotto_nome": "Prodotto esistente"}$j$::jsonb);
SELECT pg_temp.controlla('sku_prodotto_come_variante_altrui · shop_prodotti {}', 'shop_prodotti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('sku_prodotto_come_variante_altrui · shop_varianti {}', 'shop_varianti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('sku_prodotto_come_variante_altrui · shop_giacenza_movimenti {}', 'shop_giacenza_movimenti', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('sku_prodotto_come_variante_altrui · shop_storico {}', 'shop_storico', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('sku_prodotto_come_variante_altrui · shop_prodotti_categorie {}', 'shop_prodotti_categorie', $j${}$j$::jsonb, 0, NULL);
ROLLBACK;

-- SCENARIO: sku_doppio_nel_gruppo
-- Due varianti dello stesso gruppo con lo stesso SKU: «non_valido», niente scritto.
BEGIN;
SELECT pg_temp.contiene('sku_doppio_nel_gruppo · 1) non_valido', pg_temp.chiama($j${"sku": "PROVA-NUOVO", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 3, "ordine": 1}, {"sku": "PROVA-NUOVO", "nome": "Altra", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 2, "ordine": 2}]$j$::jsonb, ARRAY[]::uuid[], 'Titolare Prova'), $j${"esito": "non_valido", "motivo": "sku_doppio"}$j$::jsonb);
SELECT pg_temp.controlla('sku_doppio_nel_gruppo · shop_prodotti {}', 'shop_prodotti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('sku_doppio_nel_gruppo · shop_varianti {}', 'shop_varianti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('sku_doppio_nel_gruppo · shop_giacenza_movimenti {}', 'shop_giacenza_movimenti', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('sku_doppio_nel_gruppo · shop_storico {}', 'shop_storico', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('sku_doppio_nel_gruppo · shop_prodotti_categorie {}', 'shop_prodotti_categorie', $j${}$j$::jsonb, 0, NULL);
ROLLBACK;

-- SCENARIO: giacenza_zero
-- Giacenza 0: la variante nasce a 0 e non c'è nessun movimento.
BEGIN;
SELECT pg_temp.contiene('giacenza_zero · 1) creato', pg_temp.chiama($j${"sku": "PROVA-NUOVO", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 1}]$j$::jsonb, ARRAY[]::uuid[], 'Titolare Prova'), $j${"esito": "creato"}$j$::jsonb);
SELECT pg_temp.controlla('giacenza_zero · shop_varianti {"sku": "PROVA-NUOVO"}', 'shop_varianti', $j${"sku": "PROVA-NUOVO"}$j$::jsonb, NULL, $j${"giacenza": 0}$j$::jsonb);
SELECT pg_temp.controlla('giacenza_zero · shop_giacenza_movimenti {}', 'shop_giacenza_movimenti', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('giacenza_zero · shop_storico {"entita": "variante", "campo": "creata"}', 'shop_storico', $j${"entita": "variante", "campo": "creata"}$j$::jsonb, 1, NULL);
ROLLBACK;

-- SCENARIO: categoria_inesistente
-- Una categoria che non esiste: «non_valido» col codice 23503 e NIENTE scritto, nemmeno il prodotto, le varianti e il movimento di giacenza già fatti (tutto o niente).
BEGIN;
SELECT pg_temp.contiene('categoria_inesistente · 1) non_valido', pg_temp.chiama($j${"sku": "PROVA-NUOVO", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 5, "ordine": 1}]$j$::jsonb, ARRAY['00000000-0000-4000-8000-000000000100','00000000-0000-4000-8000-0000000009ff']::uuid[], 'Titolare Prova'), $j${"esito": "non_valido", "motivo": "23503"}$j$::jsonb);
SELECT pg_temp.controlla('categoria_inesistente · shop_prodotti {}', 'shop_prodotti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('categoria_inesistente · shop_varianti {}', 'shop_varianti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('categoria_inesistente · shop_giacenza_movimenti {}', 'shop_giacenza_movimenti', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('categoria_inesistente · shop_storico {}', 'shop_storico', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('categoria_inesistente · shop_prodotti_categorie {}', 'shop_prodotti_categorie', $j${}$j$::jsonb, 0, NULL);
ROLLBACK;

-- SCENARIO: input_manomesso
-- Un input con stato «pubblicato», id, origine, canali, id_codice e correlato_id: la funzione li ignora, il prodotto nasce in bozza con un id suo.
BEGIN;
SELECT pg_temp.contiene('input_manomesso · 1) creato', pg_temp.chiama($j${"sku": "PROVA-NUOVO", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026", "stato": "pubblicato", "id": "00000000-0000-4000-8000-0000000aaaaa", "origine": "codice", "id_codice": "HG-X1", "canali": {"sito": true, "meta": true, "google": true, "tiktok": true}, "correlato_id": "00000000-0000-4000-8000-000000000001", "pubblicato_il": "2026-11-25T10:00:00Z"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 1, "id": "00000000-0000-4000-8000-0000000bbbbb", "attiva": false}]$j$::jsonb, ARRAY[]::uuid[], 'Titolare Prova'), $j${"esito": "creato"}$j$::jsonb);
SELECT pg_temp.controlla('input_manomesso · shop_prodotti {"slug": "prodotto-nuovo"}', 'shop_prodotti', $j${"slug": "prodotto-nuovo"}$j$::jsonb, NULL, $j${"stato": "bozza", "origine": null, "id_codice": null, "correlato_id": null, "pubblicato_il": null, "canali": {}}$j$::jsonb);
SELECT pg_temp.controlla('input_manomesso · shop_prodotti {"id": "00000000-0000-4000-8000-0000000aaaaa"}', 'shop_prodotti', $j${"id": "00000000-0000-4000-8000-0000000aaaaa"}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('input_manomesso · shop_varianti {"id": "00000000-0000-4000-8000-0000000bbbbb"}', 'shop_varianti', $j${"id": "00000000-0000-4000-8000-0000000bbbbb"}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('input_manomesso · shop_varianti {"sku": "PROVA-NUOVO"}', 'shop_varianti', $j${"sku": "PROVA-NUOVO"}$j$::jsonb, NULL, $j${"attiva": true}$j$::jsonb);
ROLLBACK;

-- SCENARIO: cinquantuno_varianti
-- 51 varianti: «non_valido» (il tetto è 50), niente scritto.
BEGIN;
SELECT pg_temp.contiene('cinquantuno_varianti · 1) non_valido', pg_temp.chiama($j${"sku": "PROVA-NUOVO", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO-1", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 1}, {"sku": "PROVA-NUOVO-2", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 2}, {"sku": "PROVA-NUOVO-3", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 3}, {"sku": "PROVA-NUOVO-4", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 4}, {"sku": "PROVA-NUOVO-5", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 5}, {"sku": "PROVA-NUOVO-6", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 6}, {"sku": "PROVA-NUOVO-7", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 7}, {"sku": "PROVA-NUOVO-8", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 8}, {"sku": "PROVA-NUOVO-9", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 9}, {"sku": "PROVA-NUOVO-10", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 10}, {"sku": "PROVA-NUOVO-11", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 11}, {"sku": "PROVA-NUOVO-12", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 12}, {"sku": "PROVA-NUOVO-13", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 13}, {"sku": "PROVA-NUOVO-14", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 14}, {"sku": "PROVA-NUOVO-15", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 15}, {"sku": "PROVA-NUOVO-16", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 16}, {"sku": "PROVA-NUOVO-17", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 17}, {"sku": "PROVA-NUOVO-18", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 18}, {"sku": "PROVA-NUOVO-19", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 19}, {"sku": "PROVA-NUOVO-20", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 20}, {"sku": "PROVA-NUOVO-21", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 21}, {"sku": "PROVA-NUOVO-22", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 22}, {"sku": "PROVA-NUOVO-23", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 23}, {"sku": "PROVA-NUOVO-24", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 24}, {"sku": "PROVA-NUOVO-25", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 25}, {"sku": "PROVA-NUOVO-26", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 26}, {"sku": "PROVA-NUOVO-27", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 27}, {"sku": "PROVA-NUOVO-28", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 28}, {"sku": "PROVA-NUOVO-29", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 29}, {"sku": "PROVA-NUOVO-30", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 30}, {"sku": "PROVA-NUOVO-31", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 31}, {"sku": "PROVA-NUOVO-32", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 32}, {"sku": "PROVA-NUOVO-33", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 33}, {"sku": "PROVA-NUOVO-34", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 34}, {"sku": "PROVA-NUOVO-35", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 35}, {"sku": "PROVA-NUOVO-36", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 36}, {"sku": "PROVA-NUOVO-37", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 37}, {"sku": "PROVA-NUOVO-38", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 38}, {"sku": "PROVA-NUOVO-39", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 39}, {"sku": "PROVA-NUOVO-40", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 40}, {"sku": "PROVA-NUOVO-41", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 41}, {"sku": "PROVA-NUOVO-42", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 42}, {"sku": "PROVA-NUOVO-43", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 43}, {"sku": "PROVA-NUOVO-44", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 44}, {"sku": "PROVA-NUOVO-45", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 45}, {"sku": "PROVA-NUOVO-46", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 46}, {"sku": "PROVA-NUOVO-47", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 47}, {"sku": "PROVA-NUOVO-48", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 48}, {"sku": "PROVA-NUOVO-49", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 49}, {"sku": "PROVA-NUOVO-50", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 50}, {"sku": "PROVA-NUOVO-51", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 1, "ordine": 51}]$j$::jsonb, ARRAY[]::uuid[], 'Titolare Prova'), $j${"esito": "non_valido", "motivo": "varianti_numero"}$j$::jsonb);
SELECT pg_temp.controlla('cinquantuno_varianti · shop_prodotti {}', 'shop_prodotti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('cinquantuno_varianti · shop_varianti {}', 'shop_varianti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('cinquantuno_varianti · shop_giacenza_movimenti {}', 'shop_giacenza_movimenti', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('cinquantuno_varianti · shop_storico {}', 'shop_storico', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('cinquantuno_varianti · shop_prodotti_categorie {}', 'shop_prodotti_categorie', $j${}$j$::jsonb, 0, NULL);
ROLLBACK;

-- SCENARIO: cinquanta_varianti
-- 50 varianti: il tetto passa.
BEGIN;
SELECT pg_temp.contiene('cinquanta_varianti · 1) creato', pg_temp.chiama($j${"sku": "PROVA-NUOVO", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO-1", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 1}, {"sku": "PROVA-NUOVO-2", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 2}, {"sku": "PROVA-NUOVO-3", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 3}, {"sku": "PROVA-NUOVO-4", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 4}, {"sku": "PROVA-NUOVO-5", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 5}, {"sku": "PROVA-NUOVO-6", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 6}, {"sku": "PROVA-NUOVO-7", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 7}, {"sku": "PROVA-NUOVO-8", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 8}, {"sku": "PROVA-NUOVO-9", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 9}, {"sku": "PROVA-NUOVO-10", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 10}, {"sku": "PROVA-NUOVO-11", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 11}, {"sku": "PROVA-NUOVO-12", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 12}, {"sku": "PROVA-NUOVO-13", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 13}, {"sku": "PROVA-NUOVO-14", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 14}, {"sku": "PROVA-NUOVO-15", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 15}, {"sku": "PROVA-NUOVO-16", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 16}, {"sku": "PROVA-NUOVO-17", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 17}, {"sku": "PROVA-NUOVO-18", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 18}, {"sku": "PROVA-NUOVO-19", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 19}, {"sku": "PROVA-NUOVO-20", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 20}, {"sku": "PROVA-NUOVO-21", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 21}, {"sku": "PROVA-NUOVO-22", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 22}, {"sku": "PROVA-NUOVO-23", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 23}, {"sku": "PROVA-NUOVO-24", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 24}, {"sku": "PROVA-NUOVO-25", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 25}, {"sku": "PROVA-NUOVO-26", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 26}, {"sku": "PROVA-NUOVO-27", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 27}, {"sku": "PROVA-NUOVO-28", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 28}, {"sku": "PROVA-NUOVO-29", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 29}, {"sku": "PROVA-NUOVO-30", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 30}, {"sku": "PROVA-NUOVO-31", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 31}, {"sku": "PROVA-NUOVO-32", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 32}, {"sku": "PROVA-NUOVO-33", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 33}, {"sku": "PROVA-NUOVO-34", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 34}, {"sku": "PROVA-NUOVO-35", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 35}, {"sku": "PROVA-NUOVO-36", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 36}, {"sku": "PROVA-NUOVO-37", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 37}, {"sku": "PROVA-NUOVO-38", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 38}, {"sku": "PROVA-NUOVO-39", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 39}, {"sku": "PROVA-NUOVO-40", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 40}, {"sku": "PROVA-NUOVO-41", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 41}, {"sku": "PROVA-NUOVO-42", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 42}, {"sku": "PROVA-NUOVO-43", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 43}, {"sku": "PROVA-NUOVO-44", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 44}, {"sku": "PROVA-NUOVO-45", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 45}, {"sku": "PROVA-NUOVO-46", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 46}, {"sku": "PROVA-NUOVO-47", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 47}, {"sku": "PROVA-NUOVO-48", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 48}, {"sku": "PROVA-NUOVO-49", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 49}, {"sku": "PROVA-NUOVO-50", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 50}]$j$::jsonb, ARRAY[]::uuid[], 'Titolare Prova'), $j${"esito": "creato"}$j$::jsonb);
SELECT pg_temp.controlla('cinquanta_varianti · shop_varianti {}', 'shop_varianti', $j${}$j$::jsonb, 51, NULL);
ROLLBACK;

-- SCENARIO: giacenza_enorme
-- Giacenza 99999999999: «non_valido» a parole del database (nessun errore del tipo intero), niente scritto.
BEGIN;
SELECT pg_temp.contiene('giacenza_enorme · 1) non_valido', pg_temp.chiama($j${"sku": "PROVA-NUOVO", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 99999999999, "ordine": 1}]$j$::jsonb, ARRAY[]::uuid[], 'Titolare Prova'), $j${"esito": "non_valido", "motivo": "varianti.giacenza"}$j$::jsonb);
SELECT pg_temp.controlla('giacenza_enorme · shop_prodotti {}', 'shop_prodotti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('giacenza_enorme · shop_varianti {}', 'shop_varianti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('giacenza_enorme · shop_giacenza_movimenti {}', 'shop_giacenza_movimenti', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('giacenza_enorme · shop_storico {}', 'shop_storico', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('giacenza_enorme · shop_prodotti_categorie {}', 'shop_prodotti_categorie', $j${}$j$::jsonb, 0, NULL);
ROLLBACK;

-- SCENARIO: prezzo_oltre_tetto
-- Prezzo 2147483648 centesimi (oltre il massimo): «non_valido».
BEGIN;
SELECT pg_temp.contiene('prezzo_oltre_tetto · 1) non_valido', pg_temp.chiama($j${"sku": "PROVA-NUOVO", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 2147483648, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 1}]$j$::jsonb, ARRAY[]::uuid[], 'Titolare Prova'), $j${"esito": "non_valido", "motivo": "prezzo_cent"}$j$::jsonb);
SELECT pg_temp.controlla('prezzo_oltre_tetto · shop_prodotti {}', 'shop_prodotti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('prezzo_oltre_tetto · shop_varianti {}', 'shop_varianti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('prezzo_oltre_tetto · shop_giacenza_movimenti {}', 'shop_giacenza_movimenti', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('prezzo_oltre_tetto · shop_storico {}', 'shop_storico', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('prezzo_oltre_tetto · shop_prodotti_categorie {}', 'shop_prodotti_categorie', $j${}$j$::jsonb, 0, NULL);
ROLLBACK;

-- SCENARIO: costo_negativo
-- Costo negativo: «non_valido».
BEGIN;
SELECT pg_temp.contiene('costo_negativo · 1) non_valido', pg_temp.chiama($j${"sku": "PROVA-NUOVO", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": -5, "giacenza": 0, "ordine": 1}]$j$::jsonb, ARRAY[]::uuid[], 'Titolare Prova'), $j${"esito": "non_valido", "motivo": "varianti.costo_cent"}$j$::jsonb);
SELECT pg_temp.controlla('costo_negativo · shop_prodotti {}', 'shop_prodotti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('costo_negativo · shop_varianti {}', 'shop_varianti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('costo_negativo · shop_giacenza_movimenti {}', 'shop_giacenza_movimenti', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('costo_negativo · shop_storico {}', 'shop_storico', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('costo_negativo · shop_prodotti_categorie {}', 'shop_prodotti_categorie', $j${}$j$::jsonb, 0, NULL);
ROLLBACK;

-- SCENARIO: nome_troppo_lungo
-- Nome di 121 segni (il massimo è 120): «non_valido».
BEGIN;
SELECT pg_temp.contiene('nome_troppo_lungo · 1) non_valido', pg_temp.chiama($j${"sku": "PROVA-NUOVO", "slug": "prodotto-nuovo", "nome": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 1}]$j$::jsonb, ARRAY[]::uuid[], 'Titolare Prova'), $j${"esito": "non_valido", "motivo": "nome"}$j$::jsonb);
SELECT pg_temp.controlla('nome_troppo_lungo · shop_prodotti {}', 'shop_prodotti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('nome_troppo_lungo · shop_varianti {}', 'shop_varianti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('nome_troppo_lungo · shop_giacenza_movimenti {}', 'shop_giacenza_movimenti', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('nome_troppo_lungo · shop_storico {}', 'shop_storico', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('nome_troppo_lungo · shop_prodotti_categorie {}', 'shop_prodotti_categorie', $j${}$j$::jsonb, 0, NULL);
ROLLBACK;

-- SCENARIO: tipo_sconosciuto
-- Tipo «gioiello»: «non_valido».
BEGIN;
SELECT pg_temp.contiene('tipo_sconosciuto · 1) non_valido', pg_temp.chiama($j${"sku": "PROVA-NUOVO", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "gioiello", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 1}]$j$::jsonb, ARRAY[]::uuid[], 'Titolare Prova'), $j${"esito": "non_valido", "motivo": "tipo"}$j$::jsonb);
SELECT pg_temp.controlla('tipo_sconosciuto · shop_prodotti {}', 'shop_prodotti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('tipo_sconosciuto · shop_varianti {}', 'shop_varianti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('tipo_sconosciuto · shop_giacenza_movimenti {}', 'shop_giacenza_movimenti', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('tipo_sconosciuto · shop_storico {}', 'shop_storico', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('tipo_sconosciuto · shop_prodotti_categorie {}', 'shop_prodotti_categorie', $j${}$j$::jsonb, 0, NULL);
ROLLBACK;

-- SCENARIO: undici_categorie
-- 11 categorie (il tetto è 10): «non_valido».
BEGIN;
SELECT pg_temp.contiene('undici_categorie · 1) non_valido', pg_temp.chiama($j${"sku": "PROVA-NUOVO", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 1}]$j$::jsonb, ARRAY['00000000-0000-4000-8000-000000000700','00000000-0000-4000-8000-000000000701','00000000-0000-4000-8000-000000000702','00000000-0000-4000-8000-000000000703','00000000-0000-4000-8000-000000000704','00000000-0000-4000-8000-000000000705','00000000-0000-4000-8000-000000000706','00000000-0000-4000-8000-000000000707','00000000-0000-4000-8000-000000000708','00000000-0000-4000-8000-000000000709','00000000-0000-4000-8000-000000000710']::uuid[], 'Titolare Prova'), $j${"esito": "non_valido", "motivo": "categorie_numero"}$j$::jsonb);
SELECT pg_temp.controlla('undici_categorie · shop_prodotti {}', 'shop_prodotti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('undici_categorie · shop_varianti {}', 'shop_varianti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('undici_categorie · shop_giacenza_movimenti {}', 'shop_giacenza_movimenti', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('undici_categorie · shop_storico {}', 'shop_storico', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('undici_categorie · shop_prodotti_categorie {}', 'shop_prodotti_categorie', $j${}$j$::jsonb, 0, NULL);
ROLLBACK;

-- SCENARIO: quattro_opzioni
-- Quattro opzioni su una variante (il tetto è 3): «non_valido».
BEGIN;
SELECT pg_temp.contiene('quattro_opzioni · 1) non_valido', pg_temp.chiama($j${"sku": "PROVA-NUOVO", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO", "nome": "Unica", "opzioni": {"Colore": "Rosso", "Taglia": "S", "Misura": "1", "Forma": "Tonda"}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 1}]$j$::jsonb, ARRAY[]::uuid[], 'Titolare Prova'), $j${"esito": "non_valido", "motivo": "varianti.opzioni"}$j$::jsonb);
SELECT pg_temp.controlla('quattro_opzioni · shop_prodotti {}', 'shop_prodotti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('quattro_opzioni · shop_varianti {}', 'shop_varianti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('quattro_opzioni · shop_giacenza_movimenti {}', 'shop_giacenza_movimenti', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('quattro_opzioni · shop_storico {}', 'shop_storico', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('quattro_opzioni · shop_prodotti_categorie {}', 'shop_prodotti_categorie', $j${}$j$::jsonb, 0, NULL);
ROLLBACK;

-- SCENARIO: opzione_non_testo
-- Un'opzione il cui valore non è un testo: «non_valido».
BEGIN;
SELECT pg_temp.contiene('opzione_non_testo · 1) non_valido', pg_temp.chiama($j${"sku": "PROVA-NUOVO", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO", "nome": "Unica", "opzioni": {"Colore": 5}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 0, "ordine": 1}]$j$::jsonb, ARRAY[]::uuid[], 'Titolare Prova'), $j${"esito": "non_valido", "motivo": "varianti.opzioni"}$j$::jsonb);
SELECT pg_temp.controlla('opzione_non_testo · shop_prodotti {}', 'shop_prodotti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('opzione_non_testo · shop_varianti {}', 'shop_varianti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('opzione_non_testo · shop_giacenza_movimenti {}', 'shop_giacenza_movimenti', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('opzione_non_testo · shop_storico {}', 'shop_storico', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('opzione_non_testo · shop_prodotti_categorie {}', 'shop_prodotti_categorie', $j${}$j$::jsonb, 0, NULL);
ROLLBACK;

-- SCENARIO: sonda_vuota
-- La sonda del server ({} e nessuna variante): «non_valido», niente scritto.
BEGIN;
SELECT pg_temp.contiene('sonda_vuota · 1) non_valido', pg_temp.chiama($j${}$j$::jsonb, $j$[]$j$::jsonb, ARRAY[]::uuid[], 'Titolare Prova'), $j${"esito": "non_valido", "motivo": "varianti_numero"}$j$::jsonb);
SELECT pg_temp.controlla('sonda_vuota · shop_prodotti {}', 'shop_prodotti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('sonda_vuota · shop_varianti {}', 'shop_varianti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('sonda_vuota · shop_giacenza_movimenti {}', 'shop_giacenza_movimenti', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('sonda_vuota · shop_storico {}', 'shop_storico', $j${}$j$::jsonb, 0, NULL);
SELECT pg_temp.controlla('sonda_vuota · shop_prodotti_categorie {}', 'shop_prodotti_categorie', $j${}$j$::jsonb, 0, NULL);
ROLLBACK;

-- SCENARIO: secondo_invio
-- Lo stesso prodotto due volte (due persone, o un gruppo ripreso): la prima crea, la seconda dice «gia_presente»; un solo prodotto, un solo movimento.
BEGIN;
SELECT pg_temp.contiene('secondo_invio · 1) creato', pg_temp.chiama($j${"sku": "PROVA-NUOVO", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 7, "ordine": 1}]$j$::jsonb, ARRAY[]::uuid[], 'Titolare Prova'), $j${"esito": "creato"}$j$::jsonb);
SELECT pg_temp.contiene('secondo_invio · 2) gia_presente', pg_temp.chiama($j${"sku": "PROVA-NUOVO", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 7, "ordine": 1}]$j$::jsonb, ARRAY[]::uuid[], 'Titolare Prova'), $j${"esito": "gia_presente", "nome": "Prodotto di prova"}$j$::jsonb);
SELECT pg_temp.controlla('secondo_invio · shop_prodotti {"slug": "prodotto-nuovo"}', 'shop_prodotti', $j${"slug": "prodotto-nuovo"}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('secondo_invio · shop_giacenza_movimenti {}', 'shop_giacenza_movimenti', $j${}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('secondo_invio · shop_varianti {"sku": "PROVA-NUOVO"}', 'shop_varianti', $j${"sku": "PROVA-NUOVO"}$j$::jsonb, NULL, $j${"giacenza": 7}$j$::jsonb);
ROLLBACK;

-- SCENARIO: chi_vuoto
-- Chi importa vuoto: nel movimento e nello storico resta «sconosciuto».
BEGIN;
SELECT pg_temp.contiene('chi_vuoto · 1) creato', pg_temp.chiama($j${"sku": "PROVA-NUOVO", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "Marca Finta", "descrizione_breve": "Descrizione breve inventata.", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": "Fornitore Finto", "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": 250, "gtin": "8012345678905", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": null, "costo_cent": null, "giacenza": 2, "ordine": 1}]$j$::jsonb, ARRAY[]::uuid[], '  '), $j${"esito": "creato"}$j$::jsonb);
SELECT pg_temp.controlla('chi_vuoto · shop_giacenza_movimenti {"chi": "sconosciuto"}', 'shop_giacenza_movimenti', $j${"chi": "sconosciuto"}$j$::jsonb, 1, NULL);
SELECT pg_temp.controlla('chi_vuoto · shop_storico {"chi": "sconosciuto"}', 'shop_storico', $j${"chi": "sconosciuto"}$j$::jsonb, 2, NULL);
ROLLBACK;

-- SCENARIO: campi_vuoti
-- Campi facoltativi vuoti o solo spazi: nel database restano vuoti (NULL), non stringhe vuote.
BEGIN;
SELECT pg_temp.contiene('campi_vuoti · 1) creato', pg_temp.chiama($j${"sku": "PROVA-NUOVO", "slug": "prodotto-nuovo", "nome": "Prodotto di prova", "tipo": "cura", "prezzo_cent": 1990, "marca": "  ", "descrizione_breve": "", "descrizione_lunga": "Prima riga.\nSeconda riga.", "categoria_google": "Salute e bellezza", "fornitore": null, "seo_titolo": "Titolo SEO di prova", "seo_descrizione": "Descrizione SEO di prova.", "peso_g": null, "gtin": " ", "nota_titolare": "Importato da CSV il 25/11/2026"}$j$::jsonb, $j$[{"sku": "PROVA-NUOVO", "nome": "Unica", "opzioni": {}, "prezzo_cent": null, "peso_g": null, "gtin": "", "costo_cent": null, "giacenza": 0, "ordine": 1}]$j$::jsonb, ARRAY[]::uuid[], 'Titolare Prova'), $j${"esito": "creato"}$j$::jsonb);
SELECT pg_temp.controlla('campi_vuoti · shop_prodotti {"slug": "prodotto-nuovo"}', 'shop_prodotti', $j${"slug": "prodotto-nuovo"}$j$::jsonb, NULL, $j${"marca": null, "descrizione_breve": null, "fornitore": null, "gtin": null, "peso_g": null}$j$::jsonb);
SELECT pg_temp.controlla('campi_vuoti · shop_varianti {"sku": "PROVA-NUOVO"}', 'shop_varianti', $j${"sku": "PROVA-NUOVO"}$j$::jsonb, NULL, $j${"gtin": null}$j$::jsonb);
ROLLBACK;

-- ── 5. Il rifiuto per errore del database non fa uscire il messaggio ──────────
BEGIN;
SELECT pg_temp.uguale('categoria inesistente: risposta {esito, motivo} senza il testo dell''errore (nessuna parola del database)', '{"esito": "non_valido", "motivo": "23503"}',
  public.shop_import_prodotto('{"sku":"PROVA-FK","slug":"prodotto-fk","nome":"Prodotto fk","tipo":"kit","prezzo_cent":100}'::jsonb, '[{"sku":"PROVA-FK","giacenza":3}]'::jsonb, ARRAY['00000000-0000-4000-8000-0000000009ff']::uuid[], 'prova')::text);
SELECT pg_temp.uguale('…e niente è rimasto: né il prodotto, né la variante, né il movimento, né lo storico', '0|0|0|0',
  (SELECT count(*)::text FROM public.shop_prodotti WHERE slug = 'prodotto-fk') || '|' || (SELECT count(*)::text FROM public.shop_varianti WHERE sku = 'PROVA-FK') || '|' ||
  (SELECT count(*)::text FROM public.shop_giacenza_movimenti) || '|' || (SELECT count(*)::text FROM public.shop_storico));
ROLLBACK;

\echo
\echo 'TUTTI I CONTROLLI DELL''EDITOR PRODOTTI PASSANO'
