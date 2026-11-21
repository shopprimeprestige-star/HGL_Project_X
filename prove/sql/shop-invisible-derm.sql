-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DELLA MIGRAZIONE D40 (INVISIBLE DERM SENZA PREZZO) SU UN POSTGRES VERO
-- (commessa 2026-11-20-shop-completo, T32 fase 2)
--
-- NON entra in `npm test` e NON si lancia MAI sul database di produzione: serve un database
-- USA-E-GETTA il cui nome contiene «prova» (lo script si ferma se non è così). Applica S1 e poi
-- la migrazione D40 (due volte) e prova il trigger di pubblicazione con prodotti inventati.
--
--   createdb prova_derm
--   psql prova_derm -v ON_ERROR_STOP=1 -f prove/sql/shop-invisible-derm.sql   (dalla radice del repo)
--
-- Serve un utente superutente del database di prova. Il database può essere vuoto: lo script crea i
-- ruoli finti `anon`, `authenticated`, `service_role` e lo schema `storage` finto che S1 si aspetta.
--
-- Cosa prova (ogni controllo stampa `ok  <nome>`, al primo sbagliato si ferma con `KO <nome>`):
--   · PRIMA della migrazione: Invisible Derm a prezzo 0 NON si pubblica (è il blocco che D40 toglie);
--   · la migrazione si applica due volte; i dati restano quelli (nessuna riga cambia, i due trigger sono ancora due);
--   · DOPO: «Invisible Derm» (e «Invisibile Derm», maiuscole e trattini) a prezzo 0 si pubblica; un prodotto con
--     slug «invisible-derm-…» pure; «Solvente per Invisible Derm», «Kit Invisible Derm», «Invisible Dermatologico»
--     e un prodotto qualunque a prezzo 0 NO (stessa frase di S1);
--   · anche Invisible Derm resta rifiutato senza descrizione, senza categoria, senza foto principale, senza variante
--     attiva con SKU: l'unico controllo tolto è il prezzo;
--   · la funzione resta chiusa ad anon e authenticated; nessun dato di prova resta (il database si butta).
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
\if :{?d40}
\else
\set d40 'supabase/migrations/20261121120000_shop_invisible_derm.sql'
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

-- Un prodotto pronto in tutto (descrizione, categoria, foto principale con alt, variante attiva con SKU) tranne il prezzo: 0.
-- `stato` resta «bozza»; i test lo portano a «pubblicato» e leggono l'esito.
CREATE FUNCTION pg_temp.prodotto(nome text, slug text, sku text) RETURNS uuid
LANGUAGE plpgsql AS $f$
DECLARE p uuid := gen_random_uuid();
BEGIN
  INSERT INTO public.shop_prodotti (id, sku, slug, nome, tipo, descrizione_breve, prezzo_cent) VALUES (p, sku, slug, nome, 'cura', 'Breve', 0);
  INSERT INTO public.shop_prodotti_categorie VALUES (p, '00000000-0000-4000-8000-00000000c001');
  INSERT INTO public.shop_media (prodotto_id, slot, path_480, alt) VALUES (p, 'principale', 'prova/' || sku || '-480.jpg', 'Testo alternativo');
  INSERT INTO public.shop_varianti (prodotto_id, sku, prezzo_cent, giacenza, attiva) VALUES (p, sku, NULL, 0, true);
  RETURN p;
END $f$;
CREATE FUNCTION pg_temp.pubblica(p uuid) RETURNS text
LANGUAGE sql AS $f$ SELECT pg_temp.errore(format('UPDATE public.shop_prodotti SET stato = ''pubblicato'' WHERE id = %L', p)) $f$;

-- ── 1. S1, poi il mondo di prova ──────────────────────────────────────────────
\i :s1
INSERT INTO public.shop_categorie (id, slug, nome, visibile) VALUES ('00000000-0000-4000-8000-00000000c001', 'prova-categoria', 'Categoria di prova', true);

CREATE TEMP TABLE prodotti_prova AS
SELECT k, pg_temp.prodotto(nome, slug, sku) AS id FROM (VALUES
  ('id1',    'Invisible Derm',               'prova-id-uno',                  'PROVA-ID1'),
  ('id2',    'invisibile  DERM',             'prova-id-due',                  'PROVA-ID2'),
  ('id3',    'Invisible-Derm Nero',          'prova-id-tre',                  'PROVA-ID3'),
  ('slug',   'Altro nome qualunque',         'invisible-derm-bianco',         'PROVA-ID4'),
  ('solv',   'Solvente per Invisible Derm',  'prova-solvente',                'PROVA-NO1'),
  ('kit',    'Kit Invisible Derm',           'prova-kit',                     'PROVA-NO2'),
  ('dermat', 'Invisible Dermatologico',      'prova-dermatologico',           'PROVA-NO3'),
  ('slugko', 'Shampoo',                      'kit-invisible-derm',            'PROVA-NO4'),
  ('altro',  'Shampoo qualunque',            'prova-shampoo',                 'PROVA-NO5')
) AS t(k, nome, slug, sku);
CREATE FUNCTION pg_temp.id(k text) RETURNS uuid LANGUAGE sql AS $f$ SELECT id FROM prodotti_prova WHERE k = $1 $f$;

-- ── 2. PRIMA della migrazione: il blocco di S1 ────────────────────────────────
SELECT pg_temp.uguale('PRIMA di D40: Invisible Derm a prezzo 0 NON si pubblica (è il blocco da togliere)', '23514 shop_pubblicazione_negata: manca una variante attiva con SKU e prezzo', pg_temp.pubblica(pg_temp.id('id1')));

-- ── 3. La migrazione, DUE volte ───────────────────────────────────────────────
CREATE TEMP TABLE prima AS SELECT p.id, p.nome, p.slug, p.stato, p.prezzo_cent, (SELECT count(*) FROM public.shop_varianti v WHERE v.prodotto_id = p.id) AS varianti FROM public.shop_prodotti p;
\i :d40
\i :d40
\echo 'ok  D40 applicata due volte senza errori'
SELECT pg_temp.uguale('nessun dato è cambiato: stesse righe, stessi nomi, stati e prezzi', '0',
  (SELECT count(*)::text FROM (
     SELECT id, nome, slug, stato, prezzo_cent, (SELECT count(*) FROM public.shop_varianti v WHERE v.prodotto_id = p.id) FROM public.shop_prodotti p
     EXCEPT SELECT id, nome, slug, stato, prezzo_cent, varianti FROM prima) x));
SELECT pg_temp.uguale('i trigger di pubblicazione sono ancora due (in inserimento e in cambio di stato) e nessuno è nuovo', '2',
  (SELECT count(*)::text FROM pg_trigger WHERE tgname IN ('shop_controlla_pubblicazione_nuovo', 'shop_controlla_pubblicazione_stato') AND NOT tgisinternal));
SELECT pg_temp.uguale('le funzioni shop_* sono quattro, come in S1 (nessuna in più, nessuna in meno)', '4',
  (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname LIKE 'shop\_%'));
SELECT pg_temp.uguale('la funzione del trigger resta chiusa: anon e authenticated non la eseguono', 'false|false',
  has_function_privilege('anon', 'public.shop_controlla_pubblicazione()', 'EXECUTE')::text || '|' ||
  has_function_privilege('authenticated', 'public.shop_controlla_pubblicazione()', 'EXECUTE')::text);
SELECT pg_temp.uguale('è ancora SECURITY DEFINER con search_path = public', 'true|{search_path=public}',
  (SELECT prosecdef::text || '|' || proconfig::text FROM pg_proc WHERE proname = 'shop_controlla_pubblicazione'));

-- ── 4. DOPO: chi passa e chi no ───────────────────────────────────────────────
SELECT pg_temp.uguale('«Invisible Derm» a prezzo 0 si pubblica', '', pg_temp.pubblica(pg_temp.id('id1')));
SELECT pg_temp.uguale('«invisibile  DERM» (maiuscole, due spazi, «Invisibile») si pubblica', '', pg_temp.pubblica(pg_temp.id('id2')));
SELECT pg_temp.uguale('«Invisible-Derm Nero» si pubblica', '', pg_temp.pubblica(pg_temp.id('id3')));
SELECT pg_temp.uguale('un nome qualunque con slug «invisible-derm-bianco» si pubblica', '', pg_temp.pubblica(pg_temp.id('slug')));
SELECT pg_temp.uguale('«Solvente per Invisible Derm» a prezzo 0: rifiutato come prima', '23514 shop_pubblicazione_negata: manca una variante attiva con SKU e prezzo', pg_temp.pubblica(pg_temp.id('solv')));
SELECT pg_temp.uguale('«Kit Invisible Derm» a prezzo 0: rifiutato', '23514 shop_pubblicazione_negata: manca una variante attiva con SKU e prezzo', pg_temp.pubblica(pg_temp.id('kit')));
SELECT pg_temp.uguale('«Invisible Dermatologico» a prezzo 0: rifiutato (derm non è una parola intera)', '23514 shop_pubblicazione_negata: manca una variante attiva con SKU e prezzo', pg_temp.pubblica(pg_temp.id('dermat')));
SELECT pg_temp.uguale('slug «kit-invisible-derm» (non comincia con invisible-derm): rifiutato', '23514 shop_pubblicazione_negata: manca una variante attiva con SKU e prezzo', pg_temp.pubblica(pg_temp.id('slugko')));
SELECT pg_temp.uguale('un prodotto qualunque a prezzo 0: rifiutato', '23514 shop_pubblicazione_negata: manca una variante attiva con SKU e prezzo', pg_temp.pubblica(pg_temp.id('altro')));
UPDATE public.shop_prodotti SET prezzo_cent = 1500 WHERE id = pg_temp.id('altro');
SELECT pg_temp.uguale('lo stesso prodotto qualunque con un prezzo > 0 si pubblica ancora', '', pg_temp.pubblica(pg_temp.id('altro')));

-- ── 5. Invisible Derm: il prezzo è l'UNICO controllo tolto ────────────────────
-- (si usa lo slug per scegliere un caso nuovo ogni volta: il trigger parte solo al passaggio a «pubblicato»)
CREATE TEMP TABLE derm_incompleti AS
SELECT k, pg_temp.prodotto('Invisible Derm ' || k, 'prova-derm-' || k, 'PROVA-D-' || k) AS id FROM (VALUES ('senza-descrizione'), ('senza-categoria'), ('senza-foto'), ('foto-persona'), ('senza-variante'), ('variante-spenta')) AS t(k);
CREATE FUNCTION pg_temp.d(k text) RETURNS uuid LANGUAGE sql AS $f$ SELECT id FROM derm_incompleti WHERE k = $1 $f$;
UPDATE public.shop_prodotti SET descrizione_breve = '   ' WHERE id = pg_temp.d('senza-descrizione');
DELETE FROM public.shop_prodotti_categorie WHERE prodotto_id = pg_temp.d('senza-categoria');
DELETE FROM public.shop_media WHERE prodotto_id = pg_temp.d('senza-foto');
UPDATE public.shop_media SET ritrae_persone = true, liberatoria_ok = false WHERE prodotto_id = pg_temp.d('foto-persona');
DELETE FROM public.shop_varianti WHERE prodotto_id = pg_temp.d('senza-variante');
UPDATE public.shop_varianti SET attiva = false WHERE prodotto_id = pg_temp.d('variante-spenta');
SELECT pg_temp.uguale('Invisible Derm senza descrizione breve: rifiutato', '23514 shop_pubblicazione_negata: manca la descrizione breve', pg_temp.pubblica(pg_temp.d('senza-descrizione')));
SELECT pg_temp.uguale('Invisible Derm senza categoria: rifiutato', '23514 shop_pubblicazione_negata: manca la categoria', pg_temp.pubblica(pg_temp.d('senza-categoria')));
SELECT pg_temp.uguale('Invisible Derm senza foto principale: rifiutato', '23514 shop_pubblicazione_negata: manca la foto principale con il testo alternativo', pg_temp.pubblica(pg_temp.d('senza-foto')));
SELECT pg_temp.uguale('Invisible Derm con foto principale di una persona senza liberatoria: rifiutato', '23514 shop_pubblicazione_negata: manca la foto principale con il testo alternativo', pg_temp.pubblica(pg_temp.d('foto-persona')));
SELECT pg_temp.uguale('Invisible Derm senza varianti: rifiutato (resta il controllo della variante, senza il prezzo)', '23514 shop_pubblicazione_negata: manca una variante attiva con SKU', pg_temp.pubblica(pg_temp.d('senza-variante')));
SELECT pg_temp.uguale('Invisible Derm con la sola variante spenta: rifiutato', '23514 shop_pubblicazione_negata: manca una variante attiva con SKU', pg_temp.pubblica(pg_temp.d('variante-spenta')));

-- ── 6. Nasce già «pubblicato» (il trigger in inserimento) ─────────────────────
SELECT pg_temp.uguale('Invisible Derm che nasce già «pubblicato» ma senza niente: rifiutato per la categoria, non per il prezzo', '23514 shop_pubblicazione_negata: manca la categoria',
  pg_temp.errore($q$INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, descrizione_breve, prezzo_cent) VALUES ('PROVA-NASCE', 'prova-nasce', 'Invisible Derm', 'cura', 'pubblicato', 'Breve', 0)$q$));
SELECT pg_temp.uguale('i quattro Invisible Derm sono pubblicati e non hanno ricevuto nessun prezzo (resta 0)', '4|0',
  (SELECT count(*) FILTER (WHERE stato = 'pubblicato')::text || '|' || coalesce(sum(prezzo_cent), 0)::text FROM public.shop_prodotti WHERE id IN (pg_temp.id('id1'), pg_temp.id('id2'), pg_temp.id('id3'), pg_temp.id('slug'))));

\echo 'TUTTI I CONTROLLI DI D40 PASSANO'
