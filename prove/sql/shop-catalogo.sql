-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DI S1 (CATALOGO DELLO SHOP) SU UN POSTGRES VERO (commessa
-- 2026-11-20-shop-completo, T02)
--
-- NON entra in `npm test` e NON si lancia MAI sul database di produzione: serve
-- un database USA-E-GETTA il cui nome contiene «prova» (lo script si ferma se
-- non è così). Niente transazione di annullamento (la giacenza si prova con due
-- sessioni vere, e una sessione vede solo ciò che l'altra ha confermato): il
-- database resta modificato e poi si butta. Istruzioni: prove/sql/LEGGIMI.md.
--
--   createdb prova_shop
--   psql prova_shop -v ON_ERROR_STOP=1 -f prove/sql/shop-catalogo.sql   (dalla radice del repo)
--
-- Serve un utente che sia superutente del database di prova (crea ruoli ed
-- estensione dblink) e un Postgres 15 o 16 normale con l'estensione `dblink`
-- (Homebrew e i pacchetti ufficiali la hanno). Il database può essere vuoto: lo
-- script crea i ruoli finti `anon`, `authenticated`, `service_role`, uno schema
-- `storage` finto con la sola tabella `buckets`, e IMITA i privilegi larghi che
-- Supabase dà di default agli oggetti nuovi di `public` (è proprio quello che il
-- REVOKE di S1 deve annullare). Se la socket del server non è raggiungibile con
-- host/porta letti dalle impostazioni, passa la stringa a mano:
--   psql prova_shop -v conn='dbname=prova_shop host=/tmp port=5432' -f …
--
-- Cosa prova (ogni controllo stampa `ok  <nome>`, al primo sbagliato si ferma con
-- `KO <nome>: atteso …, avuto …`):
--   · S1 applicata DUE volte senza errori; un interruttore già cambiato e un
--     bucket già presente non vengono riscritti dalla seconda applicazione;
--   · una tabella che esiste già (finta shop_orders) non viene toccata;
--   · RLS accesa e NESSUNA policy sulle otto tabelle; anon e authenticated non
--     leggono né scrivono tabelle, viste, né eseguono le funzioni; service_role sì;
--   · la giacenza: non scende sotto zero, il movimento è nella stessa transazione,
--     un motivo sbagliato non lascia mezza modifica, «imposta» calcola il delta
--     sotto blocco, e DUE SESSIONI insieme non la portano mai sotto zero;
--   · il trigger di pubblicazione: senza descrizione, categoria, foto principale
--     (con alt, non rimossa) o variante attiva con prezzo effettivo > 0 NON passa;
--   · le viste: solo i pubblicati; la foto di una BOZZA, la variante di una bozza,
--     le foto rimosse e quelle di persone senza liberatoria NON escono; mai la
--     giacenza né le colonne riservate; le categorie vuote o nascoste non escono;
--   · l'interruttore con confronto-e-scambio e il suo storico;
--   · il bucket shop-media (creato come previsto) e nessuna policy su storage.
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

-- ── Freno: solo su un database di prova ───────────────────────────────────────
DO $f$
BEGIN
  IF current_database() NOT ILIKE '%prova%' THEN
    RAISE EXCEPTION 'STOP: il database si chiama «%», non contiene «prova». Questo script NON va lanciato qui.', current_database();
  END IF;
END $f$;

\if :{?conn}
\else
SELECT format('dbname=%s port=%s host=%s', current_database(), current_setting('port'), split_part(current_setting('unix_socket_directories'), ',', 1)) AS conn \gset
\endif

-- ── Il mondo minimo di Supabase (solo se manca) ───────────────────────────────
DO $f$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
END $f$;
CREATE EXTENSION IF NOT EXISTS dblink;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
-- Come in Supabase: ogni oggetto nuovo di `public` nasce leggibile e scrivibile da tutti i ruoli.
-- S1 deve toglierlo con REVOKE; se non lo facesse, i controlli sotto lo vedono.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (
  id text PRIMARY KEY,
  name text NOT NULL,
  public boolean DEFAULT false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
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

-- Righe che un ruolo vede in una tabella o vista: il numero, o il codice dell'errore (42501 = niente permesso).
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

-- Esegue un'istruzione come il proprietario: '' se va, altrimenti «CODICE messaggio».
CREATE FUNCTION pg_temp.errore(istruzione text) RETURNS text
LANGUAGE plpgsql AS $f$
BEGIN
  EXECUTE istruzione;
  RETURN '';
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE || ' ' || SQLERRM;
END $f$;

-- Due sessioni vere (dblink). A apre una transazione e muove la giacenza di -1 (tiene il blocco
-- di riga); B prova lo stesso movimento e DEVE aspettare; A conferma; B poi riceve il suo esito.
-- Ritorna «<B era in attesa: 1>|<esito di B>».
CREATE FUNCTION pg_temp.corsa(v uuid, conn text) RETURNS text
LANGUAGE plpgsql AS $f$
DECLARE
  occupato integer;
  esito text;
  x integer;
  q text := format('SELECT public.shop_giacenza_muovi(%L, -1, ''ordine'', NULL, ''prova'', NULL)', v);
BEGIN
  PERFORM dblink_connect('a', conn);
  PERFORM dblink_connect('b', conn);
  PERFORM dblink_exec('a', 'BEGIN');
  SELECT t.r INTO x FROM dblink('a', q) AS t(r integer);
  PERFORM dblink_send_query('b', q);
  PERFORM pg_sleep(1);
  occupato := dblink_is_busy('b');
  PERFORM dblink_exec('a', 'COMMIT');
  BEGIN
    SELECT t.r INTO x FROM dblink_get_result('b') AS t(r integer);
    esito := 'ok';
  EXCEPTION WHEN OTHERS THEN
    esito := SQLERRM;
  END;
  PERFORM dblink_disconnect('a');
  PERFORM dblink_disconnect('b');
  RETURN occupato::text || '|' || esito;
END $f$;

-- ── 0. Una tabella che esiste già: S1 non la deve toccare ────────────────────
CREATE TABLE public.shop_orders (id integer PRIMARY KEY, nota text);
INSERT INTO public.shop_orders VALUES (1, 'esistente');
-- Un bucket shop-media GIÀ presente, con valori diversi da quelli di S1.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shop-media', 'shop-media', false, 1000, ARRAY['image/png']);

-- ── 1. S1, DUE volte ──────────────────────────────────────────────────────────
\i :s1
\i :s1
\echo 'ok  S1 applicata due volte senza errori'

SELECT pg_temp.uguale('una tabella che esisteva (shop_orders) è intatta e senza nuovi permessi per anon', 'esistente|0',
  (SELECT nota FROM public.shop_orders WHERE id = 1) || '|' ||
  (SELECT count(*) FROM information_schema.role_table_grants WHERE table_name = 'shop_orders' AND grantee = 'PUBLIC'));
SELECT pg_temp.uguale('il bucket shop-media che c''era già NON è stato cambiato (privato, 1000 byte, solo png)', 'false|1000|{image/png}',
  (SELECT public::text || '|' || file_size_limit || '|' || allowed_mime_types::text FROM storage.buckets WHERE id = 'shop-media'));

-- ── 2. Protezione per riga accesa, nessuna policy, nessun permesso ai ruoli ───
SELECT pg_temp.uguale('le otto tabelle hanno la protezione per riga accesa', '8',
  (SELECT count(*)::text FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
      AND c.relname IN ('shop_impostazioni','shop_categorie','shop_prodotti','shop_prodotti_categorie','shop_varianti','shop_media','shop_giacenza_movimenti','shop_storico')));
SELECT pg_temp.uguale('NESSUNA policy sulle tabelle shop_* nuove, nessuna su storage.objects', '0',
  (SELECT count(*)::text FROM pg_policies WHERE (schemaname = 'public' AND tablename LIKE 'shop\_%' AND tablename <> 'shop_orders') OR (schemaname = 'storage' AND tablename = 'objects')));
SELECT pg_temp.uguale('anon: né tabelle né viste né funzioni (42501 su tutte e 12 le letture)', '',
  coalesce((SELECT string_agg(o, ',') FROM unnest(ARRAY[
    'shop_impostazioni','shop_categorie','shop_prodotti','shop_prodotti_categorie','shop_varianti','shop_media','shop_giacenza_movimenti','shop_storico',
    'shop_v_prodotti','shop_v_varianti','shop_v_media','shop_v_categorie']) o WHERE pg_temp.vede('anon', 'public.' || o) <> '42501'), ''));
SELECT pg_temp.uguale('authenticated: né tabelle né viste né funzioni (42501 su tutte e 12 le letture)', '',
  coalesce((SELECT string_agg(o, ',') FROM unnest(ARRAY[
    'shop_impostazioni','shop_categorie','shop_prodotti','shop_prodotti_categorie','shop_varianti','shop_media','shop_giacenza_movimenti','shop_storico',
    'shop_v_prodotti','shop_v_varianti','shop_v_media','shop_v_categorie']) o WHERE pg_temp.vede('authenticated', 'public.' || o) <> '42501'), ''));
SELECT pg_temp.uguale('anon e authenticated non scrivono su nessuna tabella (INSERT, UPDATE, DELETE → 42501)', '',
  coalesce((SELECT string_agg(r || '/' || o, ',') FROM unnest(ARRAY['anon','authenticated']) r, unnest(ARRAY[
    'shop_impostazioni','shop_categorie','shop_prodotti','shop_prodotti_categorie','shop_varianti','shop_media','shop_giacenza_movimenti','shop_storico']) o
    WHERE has_table_privilege(r, 'public.' || o, 'INSERT') OR has_table_privilege(r, 'public.' || o, 'UPDATE')
       OR has_table_privilege(r, 'public.' || o, 'DELETE') OR has_table_privilege(r, 'public.' || o, 'TRUNCATE')
       OR has_table_privilege(r, 'public.' || o, 'REFERENCES') OR has_table_privilege(r, 'public.' || o, 'TRIGGER')), ''));
SELECT pg_temp.uguale('anon, authenticated e PUBLIC non eseguono nessuna delle quattro funzioni; service_role le esegue tutte', '|||',
  (SELECT string_agg(
     CASE WHEN has_function_privilege('anon', f, 'EXECUTE') OR has_function_privilege('authenticated', f, 'EXECUTE')
            OR EXISTS (SELECT 1 FROM pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a WHERE p.oid = f::regprocedure AND a.grantee = 0)
          THEN 'APERTA:' || f
          WHEN NOT has_function_privilege('service_role', f, 'EXECUTE') THEN 'CHIUSA:' || f
          ELSE '' END, '|' ORDER BY f)
     FROM unnest(ARRAY[
       'public.shop_giacenza_muovi(uuid, integer, text, text, text, text)',
       'public.shop_giacenza_imposta(uuid, integer, text, text)',
       'public.shop_impostazione_imposta(text, jsonb, jsonb, text)',
       'public.shop_controlla_pubblicazione()']) f));
SELECT pg_temp.uguale('service_role legge tabelle e viste (il server funziona)', '',
  coalesce((SELECT string_agg(o, ',') FROM unnest(ARRAY[
    'shop_impostazioni','shop_categorie','shop_prodotti','shop_prodotti_categorie','shop_varianti','shop_media','shop_giacenza_movimenti','shop_storico',
    'shop_v_prodotti','shop_v_varianti','shop_v_media','shop_v_categorie']) o WHERE pg_temp.vede('service_role', 'public.' || o) !~ '^\d+$'), ''));
SELECT pg_temp.uguale('le funzioni sono SECURITY DEFINER con search_path = public', '4',
  (SELECT count(*)::text FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('shop_giacenza_muovi','shop_giacenza_imposta','shop_impostazione_imposta','shop_controlla_pubblicazione')
      AND p.prosecdef AND 'search_path=public' = ANY (p.proconfig)));

-- ── 3. Il seme, e una seconda applicazione che non lo riscrive ────────────────
SELECT pg_temp.uguale('il seme: catalogo_sito = "codice", giacenza_bassa = 3', '"codice"|3',
  (SELECT (SELECT valore::text FROM public.shop_impostazioni WHERE chiave = 'catalogo_sito') || '|' || (SELECT valore::text FROM public.shop_impostazioni WHERE chiave = 'giacenza_bassa')));
SELECT pg_temp.uguale('shop_impostazione_imposta con valore atteso SBAGLIATO: false, nessuna scrittura, nessuna riga di storico', 'false|"codice"|0',
  public.shop_impostazione_imposta('catalogo_sito', '"cms"'::jsonb, '"codice"'::jsonb, 'prova')::text || '|' ||
  (SELECT valore::text FROM public.shop_impostazioni WHERE chiave = 'catalogo_sito') || '|' || (SELECT count(*) FROM public.shop_storico));
SELECT pg_temp.uguale('valore uguale, valore vuoto e chiave inesistente: tutti false', 'false|false|false',
  public.shop_impostazione_imposta('catalogo_sito', '"codice"'::jsonb, '"codice"'::jsonb, 'prova')::text || '|' ||
  public.shop_impostazione_imposta('catalogo_sito', '"codice"'::jsonb, NULL, 'prova')::text || '|' ||
  public.shop_impostazione_imposta('non_esiste', '1'::jsonb, '2'::jsonb, 'prova')::text);
-- (la funzione cambia dati: si chiama in una istruzione a parte, perché le sottoselect della stessa istruzione non vedono le sue scritture)
SELECT public.shop_impostazione_imposta('catalogo_sito', '"codice"'::jsonb, '"cms"'::jsonb, '  Prova  ')::text AS r \gset
SELECT pg_temp.uguale('shop_impostazione_imposta col valore giusto: true, valore nuovo, UNA riga di storico con prima, dopo e chi (senza spazi)', 'true|"cms"|1|"codice"->"cms"|Prova',
  :'r' || '|' ||
  (SELECT valore::text FROM public.shop_impostazioni WHERE chiave = 'catalogo_sito') || '|' ||
  (SELECT count(*) FROM public.shop_storico WHERE entita = 'impostazione' AND entita_id = 'catalogo_sito') || '|' ||
  (SELECT prima::text || '->' || dopo::text FROM public.shop_storico WHERE entita_id = 'catalogo_sito') || '|' ||
  (SELECT chi FROM public.shop_storico WHERE entita_id = 'catalogo_sito'));
\i :s1
SELECT pg_temp.uguale('una terza applicazione NON riscrive l''interruttore già cambiato (resta "cms")', '"cms"|2',
  (SELECT valore::text FROM public.shop_impostazioni WHERE chiave = 'catalogo_sito') || '|' || (SELECT count(*) FROM public.shop_impostazioni));
SELECT public.shop_impostazione_imposta('catalogo_sito', '"cms"'::jsonb, '"codice"'::jsonb, 'prova')::text AS r \gset
SELECT pg_temp.uguale('rimesso a "codice" con la funzione (cambio con confronto)', 'true|"codice"',
  :'r' || '|' || (SELECT valore::text FROM public.shop_impostazioni WHERE chiave = 'catalogo_sito'));

-- ── 4. Il bucket: se non c'è, viene creato come da piano ─────────────────────
DELETE FROM storage.buckets WHERE id = 'shop-media';   -- solo nel database di prova
\i :s1
SELECT pg_temp.uguale('senza bucket, S1 crea shop-media: pubblico, 25 MB, sei tipi', 'true|26214400|{image/jpeg,image/png,image/webp,image/avif,video/mp4,video/quicktime}',
  (SELECT public::text || '|' || file_size_limit || '|' || allowed_mime_types::text FROM storage.buckets WHERE id = 'shop-media'));

-- ── 5. Il mondo di prova: categorie, prodotti, varianti, foto ────────────────
INSERT INTO public.shop_categorie (id, slug, nome, visibile) VALUES
  ('00000000-0000-4000-8000-00000000c001', 'prova-con-prodotti', 'Con prodotti', true),
  ('00000000-0000-4000-8000-00000000c002', 'prova-vuota',        'Vuota',        true),
  ('00000000-0000-4000-8000-00000000c003', 'prova-nascosta',     'Nascosta',     false);

-- PT: il prodotto del trigger (bozza, prezzo 0 finché non lo decidiamo noi).
INSERT INTO public.shop_prodotti (id, sku, slug, nome, tipo, descrizione_breve, prezzo_cent)
VALUES ('00000000-0000-4000-8000-00000000a001', 'PROVA-T', 'prova-trigger', 'Prodotto del trigger', 'cura', 'Breve', 0);

SELECT pg_temp.uguale('nasce già «pubblicato» ma senza niente: rifiutato (la regola vale anche in inserimento)', '23514 shop_pubblicazione_negata: manca la categoria',
  pg_temp.errore($q$INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, descrizione_breve, prezzo_cent) VALUES ('PROVA-X', 'prova-x', 'X', 'cura', 'pubblicato', 'Breve', 100)$q$));
SELECT pg_temp.uguale('senza descrizione breve: rifiutato', '23514 shop_pubblicazione_negata: manca la descrizione breve',
  pg_temp.errore($q$INSERT INTO public.shop_prodotti (sku, slug, nome, tipo, stato, descrizione_breve, prezzo_cent) VALUES ('PROVA-Y', 'prova-y', 'Y', 'cura', 'pubblicato', '   ', 100)$q$));
SELECT pg_temp.uguale('il prodotto del trigger passa a pubblicato SENZA categoria: rifiutato', '23514 shop_pubblicazione_negata: manca la categoria',
  pg_temp.errore($q$UPDATE public.shop_prodotti SET stato = 'pubblicato' WHERE id = '00000000-0000-4000-8000-00000000a001'$q$));
INSERT INTO public.shop_prodotti_categorie VALUES ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000c001');
SELECT pg_temp.uguale('con la categoria ma SENZA foto principale: rifiutato', '23514 shop_pubblicazione_negata: manca la foto principale con il testo alternativo',
  pg_temp.errore($q$UPDATE public.shop_prodotti SET stato = 'pubblicato' WHERE id = '00000000-0000-4000-8000-00000000a001'$q$));
-- Una foto principale senza alt e una rimossa: nessuna delle due vale.
INSERT INTO public.shop_media (id, prodotto_id, slot, path_480, alt) VALUES
  ('00000000-0000-4000-8000-00000000e001', '00000000-0000-4000-8000-00000000a001', 'principale', 'prova/t-senza-alt-480.jpg', '   ');
INSERT INTO public.shop_media (id, prodotto_id, slot, path_480, alt, rimosso_il) VALUES
  ('00000000-0000-4000-8000-00000000e002', '00000000-0000-4000-8000-00000000a001', 'principale', 'prova/t-rimossa-480.jpg', 'Testo alternativo', now());
SELECT pg_temp.uguale('foto principale senza alt, o rimossa: rifiutato', '23514 shop_pubblicazione_negata: manca la foto principale con il testo alternativo',
  pg_temp.errore($q$UPDATE public.shop_prodotti SET stato = 'pubblicato' WHERE id = '00000000-0000-4000-8000-00000000a001'$q$));
INSERT INTO public.shop_media (id, prodotto_id, slot, path_480, alt) VALUES
  ('00000000-0000-4000-8000-00000000e003', '00000000-0000-4000-8000-00000000a001', 'principale', 'prova/t-buona-480.jpg', 'Testo alternativo');
SELECT pg_temp.uguale('foto buona ma NESSUNA variante: rifiutato', '23514 shop_pubblicazione_negata: manca una variante attiva con SKU e prezzo',
  pg_temp.errore($q$UPDATE public.shop_prodotti SET stato = 'pubblicato' WHERE id = '00000000-0000-4000-8000-00000000a001'$q$));
INSERT INTO public.shop_varianti (id, prodotto_id, sku, prezzo_cent, giacenza, attiva) VALUES
  ('00000000-0000-4000-8000-00000000b001', '00000000-0000-4000-8000-00000000a001', 'PROVA-T', NULL, 5, false);
SELECT pg_temp.uguale('variante NON attiva: rifiutato', '23514 shop_pubblicazione_negata: manca una variante attiva con SKU e prezzo',
  pg_temp.errore($q$UPDATE public.shop_prodotti SET stato = 'pubblicato' WHERE id = '00000000-0000-4000-8000-00000000a001'$q$));
UPDATE public.shop_varianti SET attiva = true WHERE id = '00000000-0000-4000-8000-00000000b001';
SELECT pg_temp.uguale('prezzo del prodotto 0 e prezzo della variante vuoto: rifiutato', '23514 shop_pubblicazione_negata: manca una variante attiva con SKU e prezzo',
  pg_temp.errore($q$UPDATE public.shop_prodotti SET stato = 'pubblicato' WHERE id = '00000000-0000-4000-8000-00000000a001'$q$));
UPDATE public.shop_varianti SET prezzo_cent = 0 WHERE id = '00000000-0000-4000-8000-00000000b001';
UPDATE public.shop_prodotti SET prezzo_cent = 1000 WHERE id = '00000000-0000-4000-8000-00000000a001';
SELECT pg_temp.uguale('prezzo della variante 0 (esplicito) vale 0, anche se il prodotto costa 1000: rifiutato', '23514 shop_pubblicazione_negata: manca una variante attiva con SKU e prezzo',
  pg_temp.errore($q$UPDATE public.shop_prodotti SET stato = 'pubblicato' WHERE id = '00000000-0000-4000-8000-00000000a001'$q$));
UPDATE public.shop_varianti SET prezzo_cent = NULL WHERE id = '00000000-0000-4000-8000-00000000b001';
SELECT pg_temp.uguale('prezzo prodotto > 0 e variante vuota: PASSA', '',
  pg_temp.errore($q$UPDATE public.shop_prodotti SET stato = 'pubblicato' WHERE id = '00000000-0000-4000-8000-00000000a001'$q$));
SELECT pg_temp.uguale('il prodotto del trigger risulta pubblicato', 'pubblicato',
  (SELECT stato FROM public.shop_prodotti WHERE id = '00000000-0000-4000-8000-00000000a001'));
UPDATE public.shop_varianti SET attiva = false WHERE id = '00000000-0000-4000-8000-00000000b001';
SELECT pg_temp.uguale('un prodotto GIÀ pubblicato si salva anche se nel frattempo non sarebbe più pubblicabile (il trigger parte solo al passaggio)', '',
  pg_temp.errore($q$UPDATE public.shop_prodotti SET nome = 'Nome nuovo' WHERE id = '00000000-0000-4000-8000-00000000a001'$q$));
UPDATE public.shop_prodotti SET stato = 'archiviato' WHERE id = '00000000-0000-4000-8000-00000000a001';
SELECT pg_temp.uguale('da archiviato a pubblicato il controllo riparte (variante spenta: rifiutato)', '23514 shop_pubblicazione_negata: manca una variante attiva con SKU e prezzo',
  pg_temp.errore($q$UPDATE public.shop_prodotti SET stato = 'pubblicato' WHERE id = '00000000-0000-4000-8000-00000000a001'$q$));
UPDATE public.shop_varianti SET attiva = true, prezzo_cent = 500 WHERE id = '00000000-0000-4000-8000-00000000b001';
UPDATE public.shop_prodotti SET prezzo_cent = 0 WHERE id = '00000000-0000-4000-8000-00000000a001';
SELECT pg_temp.uguale('prodotto a 0 ma variante a 500: il prezzo effettivo è quello della variante, PASSA', '',
  pg_temp.errore($q$UPDATE public.shop_prodotti SET stato = 'pubblicato' WHERE id = '00000000-0000-4000-8000-00000000a001'$q$));
SELECT pg_temp.uguale('le regole del database: prezzo negativo, giacenza negativa, slot sconosciuto, foto di prodotto E categoria insieme, stato strano → tutti 23514',
  '23514|23514|23514|23514|23514',
  concat_ws('|',
    left(pg_temp.errore($q$UPDATE public.shop_prodotti SET prezzo_cent = -1 WHERE id = '00000000-0000-4000-8000-00000000a001'$q$), 5),
    left(pg_temp.errore($q$UPDATE public.shop_varianti SET giacenza = -1 WHERE id = '00000000-0000-4000-8000-00000000b001'$q$), 5),
    left(pg_temp.errore($q$INSERT INTO public.shop_media (prodotto_id, slot) VALUES ('00000000-0000-4000-8000-00000000a001', 'inventato')$q$), 5),
    left(pg_temp.errore($q$INSERT INTO public.shop_media (prodotto_id, categoria_id, slot) VALUES ('00000000-0000-4000-8000-00000000a001', '00000000-0000-4000-8000-00000000c001', 'foto2')$q$), 5),
    left(pg_temp.errore($q$UPDATE public.shop_prodotti SET stato = 'strano' WHERE id = '00000000-0000-4000-8000-00000000a001'$q$), 5)));

-- ── 6. La giacenza ────────────────────────────────────────────────────────────
-- Tre varianti nuove, tutte del prodotto del trigger (che non conta più: ormai si guarda la giacenza).
INSERT INTO public.shop_varianti (id, prodotto_id, sku, giacenza) VALUES
  ('00000000-0000-4000-8000-00000000b101', '00000000-0000-4000-8000-00000000a001', 'PROVA-G1', 5),
  ('00000000-0000-4000-8000-00000000b102', '00000000-0000-4000-8000-00000000a001', 'PROVA-G2', 1),
  ('00000000-0000-4000-8000-00000000b103', '00000000-0000-4000-8000-00000000a001', 'PROVA-G3', 2);

SELECT pg_temp.uguale('muovi -2 da 5: ritorna 3', '3', public.shop_giacenza_muovi('00000000-0000-4000-8000-00000000b101', -2, 'ordine', 'prova', 'Mario', 'HG-PROVA1')::text);
SELECT pg_temp.uguale('il movimento è scritto nella stessa operazione: delta -2, dopo 3, motivo, chi, ordine', '-2|3|ordine|Mario|HG-PROVA1',
  (SELECT delta || '|' || giacenza_dopo || '|' || motivo || '|' || chi || '|' || ordine_ref FROM public.shop_giacenza_movimenti WHERE variante_id = '00000000-0000-4000-8000-00000000b101'));
SELECT pg_temp.uguale('muovi -4 da 3: errore giacenza_negativa (23514), giacenza ancora 3, ancora UN movimento', '23514 giacenza_negativa|3|1',
  pg_temp.errore($q$SELECT public.shop_giacenza_muovi('00000000-0000-4000-8000-00000000b101', -4, 'ordine', NULL, 'Mario', NULL)$q$) || '|' ||
  (SELECT giacenza FROM public.shop_varianti WHERE id = '00000000-0000-4000-8000-00000000b101') || '|' ||
  (SELECT count(*) FROM public.shop_giacenza_movimenti WHERE variante_id = '00000000-0000-4000-8000-00000000b101'));
SELECT pg_temp.uguale('muovi esattamente fino a zero (-3): permesso, ritorna 0', '0', public.shop_giacenza_muovi('00000000-0000-4000-8000-00000000b101', -3, 'ordine', NULL, 'Mario', NULL)::text);
SELECT pg_temp.uguale('un motivo sconosciuto fallisce e NON lascia la giacenza cambiata a metà', '23514|0',
  left(pg_temp.errore($q$SELECT public.shop_giacenza_muovi('00000000-0000-4000-8000-00000000b101', 7, 'regalo', NULL, 'Mario', NULL)$q$), 5) || '|' ||
  (SELECT giacenza FROM public.shop_varianti WHERE id = '00000000-0000-4000-8000-00000000b101'));
SELECT pg_temp.uguale('delta vuoto e variante inesistente: errori chiari, niente scritto', '22023 giacenza_delta_vuoto|P0002 variante_non_trovata',
  pg_temp.errore($q$SELECT public.shop_giacenza_muovi('00000000-0000-4000-8000-00000000b101', NULL, 'carico', NULL, 'Mario', NULL)$q$) || '|' ||
  pg_temp.errore($q$SELECT public.shop_giacenza_muovi('00000000-0000-4000-8000-0000000000ff', 1, 'carico', NULL, 'Mario', NULL)$q$));
SELECT pg_temp.uguale('muovi +10 (carico): ritorna 10', '10', public.shop_giacenza_muovi('00000000-0000-4000-8000-00000000b101', 10, 'carico', NULL, '   ', NULL)::text);
SELECT pg_temp.uguale('chi vuoto diventa «sconosciuto»; delta 0 non scrive niente', 'sconosciuto|10|3',
  (SELECT chi FROM public.shop_giacenza_movimenti WHERE variante_id = '00000000-0000-4000-8000-00000000b101' AND delta = 10) || '|' ||
  public.shop_giacenza_muovi('00000000-0000-4000-8000-00000000b101', 0, 'rettifica', NULL, 'Mario', NULL) || '|' ||
  (SELECT count(*) FROM public.shop_giacenza_movimenti WHERE variante_id = '00000000-0000-4000-8000-00000000b101'));
SELECT public.shop_giacenza_imposta('00000000-0000-4000-8000-00000000b101', 7, 'rettifica', 'Anna')::text AS r \gset
SELECT pg_temp.uguale('imposta 7 da 10: ritorna 7, e il delta (-3) lo ha calcolato il database', '7|-3|7|rettifica',
  :'r' || '|' ||
  (SELECT delta || '|' || giacenza_dopo || '|' || motivo FROM public.shop_giacenza_movimenti WHERE variante_id = '00000000-0000-4000-8000-00000000b101' ORDER BY creato_il DESC, giacenza_dopo LIMIT 1));
SELECT pg_temp.uguale('imposta lo stesso valore: nessun movimento nuovo (4 in tutto)', '7|4',
  public.shop_giacenza_imposta('00000000-0000-4000-8000-00000000b101', 7, 'rettifica', 'Anna')::text || '|' ||
  (SELECT count(*) FROM public.shop_giacenza_movimenti WHERE variante_id = '00000000-0000-4000-8000-00000000b101'));
SELECT pg_temp.uguale('imposta -1 e imposta NULL: 23514, giacenza ancora 7', '23514 giacenza_negativa|23514 giacenza_negativa|7',
  pg_temp.errore($q$SELECT public.shop_giacenza_imposta('00000000-0000-4000-8000-00000000b101', -1, 'rettifica', 'Anna')$q$) || '|' ||
  pg_temp.errore($q$SELECT public.shop_giacenza_imposta('00000000-0000-4000-8000-00000000b101', NULL, 'rettifica', 'Anna')$q$) || '|' ||
  (SELECT giacenza FROM public.shop_varianti WHERE id = '00000000-0000-4000-8000-00000000b101'));
SELECT pg_temp.uguale('la giacenza iniziale (5) più la somma dei movimenti dà la giacenza di adesso (7)', '7',
  (SELECT (5 + sum(delta))::text FROM public.shop_giacenza_movimenti WHERE variante_id = '00000000-0000-4000-8000-00000000b101'));

-- Due sessioni vere: la prima tiene il blocco, la seconda aspetta e poi rilegge.
SELECT pg_temp.uguale('DUE SESSIONI su 1 pezzo: la seconda ASPETTA il blocco (era in attesa) e poi riceve giacenza_negativa', '1|giacenza_negativa',
  pg_temp.corsa('00000000-0000-4000-8000-00000000b102', :'conn'));
SELECT pg_temp.uguale('… la giacenza è 0 (mai sotto zero) e c''è UN solo movimento', '0|1',
  (SELECT giacenza FROM public.shop_varianti WHERE id = '00000000-0000-4000-8000-00000000b102') || '|' ||
  (SELECT count(*) FROM public.shop_giacenza_movimenti WHERE variante_id = '00000000-0000-4000-8000-00000000b102'));
SELECT pg_temp.uguale('DUE SESSIONI su 2 pezzi: la seconda aspetta e poi riesce', '1|ok',
  pg_temp.corsa('00000000-0000-4000-8000-00000000b103', :'conn'));
SELECT pg_temp.uguale('… giacenza 0, DUE movimenti, somma dei delta -2 (nessun movimento perso o doppio)', '0|2|-2',
  (SELECT giacenza FROM public.shop_varianti WHERE id = '00000000-0000-4000-8000-00000000b103') || '|' ||
  (SELECT count(*) FROM public.shop_giacenza_movimenti WHERE variante_id = '00000000-0000-4000-8000-00000000b103') || '|' ||
  (SELECT sum(delta) FROM public.shop_giacenza_movimenti WHERE variante_id = '00000000-0000-4000-8000-00000000b103'));

-- ── 7. Le viste: solo i pubblicati, mai la giacenza, mai la foto di una bozza ─
-- P1 pubblicato (con tutto), P2 bozza con foto e variante «segrete», P3 archiviato.
-- (Il prodotto del trigger è archiviato: non conta e non deve uscire.)
UPDATE public.shop_prodotti SET stato = 'archiviato' WHERE id = '00000000-0000-4000-8000-00000000a001';
INSERT INTO public.shop_prodotti (id, sku, slug, nome, tipo, prezzo_cent, descrizione_breve, caratteristiche, contenuto, canali, note_interne, fornitore, nota_titolare, bozza_modifiche, origine, id_codice) VALUES
  ('00000000-0000-4000-8000-00000000a010', 'PROVA-1', 'prova-uno', 'Prodotto uno', 'kit', 2500, 'Breve uno',
   '[{"etichetta":"Misura","valore":"S","stato":"confermato","fonte":"scheda"},{"etichetta":"Peso","valore":"1 kg","stato":"da_confermare","fonte":"vecchio"}]',
   '{"passi":["uno"],"confezione":["scatola"],"avvertenze":[],"faq":[],"segreto":"x"}', '{"sito":true}', 'NOTA-SEGRETA', 'FORNITORE-SEGRETO', 'NOTA-TITOLARE-SEGRETA', '{"nome":"BOZZA-SEGRETA"}', 'codice', 'p1'),
  ('00000000-0000-4000-8000-00000000a020', 'PROVA-2', 'prova-bozza', 'Prodotto bozza', 'cura', 1500, 'Breve due', '[]', '{}', '{}', NULL, NULL, NULL, NULL, NULL, NULL),
  ('00000000-0000-4000-8000-00000000a030', 'PROVA-3', 'prova-archiviato', 'Prodotto archiviato', 'cura', 1500, 'Breve tre', '[]', '{}', '{}', NULL, NULL, NULL, NULL, NULL, NULL);
UPDATE public.shop_prodotti SET stato = 'archiviato' WHERE id = '00000000-0000-4000-8000-00000000a030';
UPDATE public.shop_prodotti SET correlato_id = '00000000-0000-4000-8000-00000000a020' WHERE id = '00000000-0000-4000-8000-00000000a010';  -- correlato: una bozza
INSERT INTO public.shop_prodotti_categorie VALUES
  ('00000000-0000-4000-8000-00000000a010', '00000000-0000-4000-8000-00000000c001'),
  ('00000000-0000-4000-8000-00000000a010', '00000000-0000-4000-8000-00000000c003'),
  ('00000000-0000-4000-8000-00000000a020', '00000000-0000-4000-8000-00000000c002'),
  ('00000000-0000-4000-8000-00000000a030', '00000000-0000-4000-8000-00000000c002');
INSERT INTO public.shop_varianti (id, prodotto_id, sku, nome, prezzo_cent, giacenza, attiva, ordine) VALUES
  ('00000000-0000-4000-8000-00000000b201', '00000000-0000-4000-8000-00000000a010', 'PROVA-1-A', 'Con pezzi', NULL, 12, true, 1),
  ('00000000-0000-4000-8000-00000000b202', '00000000-0000-4000-8000-00000000a010', 'PROVA-1-B', 'Esaurita', 2800, 0, true, 2),
  ('00000000-0000-4000-8000-00000000b203', '00000000-0000-4000-8000-00000000a010', 'PROVA-1-C', 'Spenta', 2800, 9, false, 3),
  ('00000000-0000-4000-8000-00000000b204', '00000000-0000-4000-8000-00000000a020', 'PROVA-2-A', 'Variante di una bozza', 1500, 9, true, 1),
  ('00000000-0000-4000-8000-00000000b205', '00000000-0000-4000-8000-00000000a030', 'PROVA-3-A', 'Variante di un archiviato', 1500, 9, true, 1);
INSERT INTO public.shop_media (id, prodotto_id, categoria_id, slot, path_480, alt, ritrae_persone, liberatoria_ok, rimosso_il) VALUES
  ('00000000-0000-4000-8000-00000000e101', '00000000-0000-4000-8000-00000000a010', NULL, 'principale', 'prova/uno-principale-480.jpg', 'Prodotto uno', false, false, NULL),
  ('00000000-0000-4000-8000-00000000e102', '00000000-0000-4000-8000-00000000a010', NULL, 'foto2',      'prova/uno-rimossa-480.jpg',    'Rimossa',      false, false, now()),
  ('00000000-0000-4000-8000-00000000e103', '00000000-0000-4000-8000-00000000a010', NULL, 'foto3',      'prova/uno-persona-senza-480.jpg', 'Persona senza liberatoria', true, false, NULL),
  ('00000000-0000-4000-8000-00000000e104', '00000000-0000-4000-8000-00000000a010', NULL, 'foto4',      'prova/uno-persona-ok-480.jpg', 'Persona con liberatoria', true, true, NULL),
  ('00000000-0000-4000-8000-00000000e201', '00000000-0000-4000-8000-00000000a020', NULL, 'principale', 'prova/BOZZA-SEGRETA-480.jpg', 'Foto di una bozza', false, false, NULL),
  ('00000000-0000-4000-8000-00000000e301', '00000000-0000-4000-8000-00000000a030', NULL, 'principale', 'prova/ARCHIVIATO-480.jpg', 'Foto di un archiviato', false, false, NULL),
  ('00000000-0000-4000-8000-00000000e401', NULL, '00000000-0000-4000-8000-00000000c001', 'principale', 'prova/categoria-con-prodotti-480.jpg', 'Categoria con prodotti', false, false, NULL),
  ('00000000-0000-4000-8000-00000000e402', NULL, '00000000-0000-4000-8000-00000000c002', 'principale', 'prova/categoria-vuota-480.jpg', 'Categoria vuota', false, false, NULL),
  ('00000000-0000-4000-8000-00000000e403', NULL, '00000000-0000-4000-8000-00000000c003', 'principale', 'prova/categoria-nascosta-480.jpg', 'Categoria nascosta', false, false, NULL);
-- P1 si pubblica davvero: categoria, foto con alt, variante attiva, prezzo > 0.
SELECT pg_temp.uguale('P1 si pubblica (ha tutto)', '', pg_temp.errore($q$UPDATE public.shop_prodotti SET stato = 'pubblicato' WHERE id = '00000000-0000-4000-8000-00000000a010'$q$));

SELECT pg_temp.uguale('shop_v_prodotti: esce SOLO il pubblicato (non la bozza, non gli archiviati)', 'prova-uno',
  (SELECT string_agg(slug, ',' ORDER BY slug) FROM public.shop_v_prodotti));
SELECT pg_temp.uguale('shop_v_prodotti: le caratteristiche sono solo «confermato»; il contenuto ha solo le quattro chiavi (niente «segreto»)', 'Misura|passi,confezione,avvertenze,faq',
  (SELECT (caratteristiche -> 0 ->> 'etichetta') || '|' ||
          (SELECT string_agg(k, ',' ORDER BY CASE k WHEN 'passi' THEN 1 WHEN 'confezione' THEN 2 WHEN 'avvertenze' THEN 3 ELSE 4 END) FROM jsonb_object_keys(contenuto) k)
     FROM public.shop_v_prodotti) || '' );
SELECT pg_temp.uguale('shop_v_prodotti: UNA sola caratteristica esce (quella da confermare no)', '1',
  (SELECT jsonb_array_length(caratteristiche)::text FROM public.shop_v_prodotti));
SELECT pg_temp.uguale('shop_v_prodotti: le categorie sono solo quelle VISIBILI (la nascosta no); un correlato in bozza non esce', 'prova-con-prodotti|',
  (SELECT string_agg(c ->> 'slug', ',') || '|' || coalesce(correlato_id::text, '') FROM public.shop_v_prodotti, jsonb_array_elements(categorie) c GROUP BY correlato_id));
SELECT pg_temp.uguale('le viste NON hanno colonne riservate (giacenza, bozza_modifiche, note, fornitore, canali, origine, id_codice…)', '',
  coalesce((SELECT string_agg(table_name || '.' || column_name, ',') FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN ('shop_v_prodotti','shop_v_varianti','shop_v_media','shop_v_categorie')
      AND (column_name ~* 'giacenza|bozza|nota|note|fornitore|canali|origine|id_codice|costo|scheda_tecnica|spedizione|categoria_google|mpn')), ''));
SELECT pg_temp.uguale('i valori riservati non compaiono in nessuna riga di nessuna vista (ricerca nel testo)', '0',
  (SELECT count(*)::text FROM (
     SELECT to_jsonb(v)::text AS t FROM public.shop_v_prodotti v UNION ALL
     SELECT to_jsonb(v)::text FROM public.shop_v_varianti v UNION ALL
     SELECT to_jsonb(v)::text FROM public.shop_v_media v UNION ALL
     SELECT to_jsonb(v)::text FROM public.shop_v_categorie v) x
    WHERE t ~ 'SEGRETA|SEGRETO|BOZZA-SEGRETA|NOTA-'));

SELECT pg_temp.uguale('shop_v_varianti: solo quelle del pubblicato (non la variante di una bozza né di un archiviato)', 'PROVA-1-A,PROVA-1-B,PROVA-1-C',
  (SELECT string_agg(sku, ',' ORDER BY sku) FROM public.shop_v_varianti));
SELECT pg_temp.uguale('shop_v_varianti: «disponibile» = giacenza > 0 e attiva (12 → sì, 0 → no, spenta con 9 → no); prezzo effettivo variante o prodotto',
  'PROVA-1-A:t:2500,PROVA-1-B:f:2800,PROVA-1-C:f:2800',
  (SELECT string_agg(sku || ':' || (CASE WHEN disponibile THEN 't' ELSE 'f' END) || ':' || prezzo_effettivo_cent, ',' ORDER BY sku) FROM public.shop_v_varianti));

SELECT pg_temp.uguale('shop_v_media: la foto di una BOZZA non esce (né quella di un archiviato); non escono rimosse né persone senza liberatoria',
  'prova/categoria-con-prodotti-480.jpg,prova/uno-persona-ok-480.jpg,prova/uno-principale-480.jpg',
  (SELECT string_agg(path_480, ',' ORDER BY path_480) FROM public.shop_v_media));
SELECT pg_temp.uguale('shop_v_media: il percorso della bozza non compare nemmeno come testo in nessuna riga', '0',
  (SELECT count(*)::text FROM public.shop_v_media v WHERE to_jsonb(v)::text ~ 'BOZZA-SEGRETA|ARCHIVIATO|rimossa|persona-senza|categoria-vuota|categoria-nascosta'));
SELECT pg_temp.uguale('le foto di una categoria escono solo se la categoria è visibile E ha un pubblicato (vuota e nascosta no)', '1',
  (SELECT count(*)::text FROM public.shop_v_media WHERE categoria_id IS NOT NULL));
SELECT pg_temp.uguale('shop_v_categorie: solo la visibile con almeno un pubblicato, con il conteggio', 'prova-con-prodotti:1',
  (SELECT string_agg(slug || ':' || quanti, ',') FROM public.shop_v_categorie));

SELECT pg_temp.uguale('letto come service_role (il server): le viste rispondono con le stesse righe', '1|3|3|1',
  pg_temp.vede('service_role', 'public.shop_v_prodotti') || '|' || pg_temp.vede('service_role', 'public.shop_v_varianti') || '|' ||
  pg_temp.vede('service_role', 'public.shop_v_media') || '|' || pg_temp.vede('service_role', 'public.shop_v_categorie'));
SELECT pg_temp.uguale('anon e authenticated, ora che le viste hanno righe: ancora 42501 sulle quattro', '42501|42501|42501|42501|42501|42501|42501|42501',
  concat_ws('|',
    pg_temp.vede('anon', 'public.shop_v_prodotti'), pg_temp.vede('anon', 'public.shop_v_varianti'), pg_temp.vede('anon', 'public.shop_v_media'), pg_temp.vede('anon', 'public.shop_v_categorie'),
    pg_temp.vede('authenticated', 'public.shop_v_prodotti'), pg_temp.vede('authenticated', 'public.shop_v_varianti'), pg_temp.vede('authenticated', 'public.shop_v_media'), pg_temp.vede('authenticated', 'public.shop_v_categorie')));
SELECT pg_temp.uguale('anon non chiama le funzioni (42501)', '42501|42501|42501',
  concat_ws('|',
    pg_temp.come('anon', $q$SELECT public.shop_giacenza_muovi('00000000-0000-4000-8000-00000000b201', 1, 'carico', NULL, 'x', NULL)$q$),
    pg_temp.come('authenticated', $q$SELECT public.shop_giacenza_imposta('00000000-0000-4000-8000-00000000b201', 1, 'rettifica', 'x')$q$),
    pg_temp.come('anon', $q$SELECT public.shop_impostazione_imposta('catalogo_sito', '"codice"'::jsonb, '"cms"'::jsonb, 'x')$q$)));

-- Il pubblicato torna in bozza o si archivia: sparisce da tutte le viste, con le sue foto e varianti.
UPDATE public.shop_prodotti SET stato = 'archiviato' WHERE id = '00000000-0000-4000-8000-00000000a010';
SELECT pg_temp.uguale('archiviato P1: sparisce da prodotti, varianti, media e categorie (e la categoria resta senza pubblicati)', '0|0|0|0',
  (SELECT count(*) FROM public.shop_v_prodotti) || '|' || (SELECT count(*) FROM public.shop_v_varianti) || '|' ||
  (SELECT count(*) FROM public.shop_v_media) || '|' || (SELECT count(*) FROM public.shop_v_categorie));

-- ── 8. Alla fine: niente è sparito, nessuna policy è comparsa ────────────────
SELECT pg_temp.uguale('nessun DELETE nel collaudo salvo il bucket di prova: i movimenti ci sono tutti e la tabella esistente è intatta', 'esistente',
  (SELECT nota FROM public.shop_orders WHERE id = 1));
SELECT pg_temp.uguale('ancora NESSUNA policy sulle tabelle del catalogo e su storage.objects', '0',
  (SELECT count(*)::text FROM pg_policies WHERE (schemaname = 'public' AND tablename LIKE 'shop\_%' AND tablename <> 'shop_orders') OR (schemaname = 'storage' AND tablename = 'objects')));

\echo 'TUTTI I CONTROLLI DI S1 PASSANO'
