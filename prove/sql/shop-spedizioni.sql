-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DELLA MIGRAZIONE S5 (SPEDIZIONI) SU UN POSTGRES VERO
-- (commessa 2026-11-20-shop-completo, Rilascio 2, T42)
--
-- NON entra in `npm test` e NON si lancia MAI sul database di produzione: serve un database
-- USA-E-GETTA il cui nome contiene «prova» (lo script si ferma se non è così). Applica S1 e poi S5
-- (due volte) e rifà gli scenari di `prove/negozio/_scenari-soldi.json` col file `shop-spedizioni.sql`,
-- ognuno sotto il suo marcatore; poi le prove che il finto non può fare (permessi, RLS, indice, atomicità).
--
--   createdb prova_spedizioni
--   psql prova_spedizioni -v ON_ERROR_STOP=1 -f prove/sql/shop-spedizioni.sql      (dalla radice del repo)
--
-- Serve un utente superutente del database di prova. Il database può essere vuoto: lo script crea i ruoli
-- finti `anon`, `authenticated`, `service_role` (con i permessi di partenza di Supabase: tutto a tutti, ed è S5 a
-- togliere) e lo schema `storage` finto che S1 si aspetta.
--
-- Cosa prova (ogni controllo stampa `ok  <nome>`, al primo sbagliato si ferma con `KO <nome>`):
--   · S5 si ferma senza scrivere se S1 non c'è; si applica due volte e le cose cambiate dal titolare restano;
--   · il seme (id fisso, 490, attiva, provvisoria) e i due semi delle impostazioni (corrieri senza indirizzi, resi non confermati);
--   · una sola tariffa attiva per Italia; solo Italia; costo non negativo;
--   · `shop_tariffa_imposta`: valore visto vecchio non scrive; conferma; nessun cambio = niente; campi e valori vietati;
--     una scrittura che fallisce a metà non lascia niente (atomica); riga di storico per campo; `chi` mai vuoto;
--   · anon e authenticated non leggono né scrivono né eseguono; service_role legge, esegue, ma non scrive la tabella.
--
-- CONCORRENZA (due terminali, come `sheets-lucchetto`), DOPO la corsa intera qui sopra, sullo stesso database:
--   psql prova_spedizioni -v passo=A         -f prove/sql/shop-spedizioni.sql     # terminale 1: cambia il costo e tiene la transazione 8 secondi
--   psql prova_spedizioni -v passo=B         -f prove/sql/shop-spedizioni.sql     # terminale 2, entro 4 secondi da A
--   psql prova_spedizioni -v passo=controlla -f prove/sql/shop-spedizioni.sql
--   Atteso: A `true`, B `false` dopo circa 6-8 secondi di attesa, costo di A, una sola riga di storico, nessuna di B.
--
-- Dati inventati: nessun nome, numero o percorso vero.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
\pset tuples_only on
\pset format unaligned
SET client_min_messages = warning;
\if :{?passo}
\else
\set passo tutto
\endif
\if :{?s1}
\else
\set s1 'supabase/migrations/20261120120000_shop_catalogo.sql'
\endif
\if :{?s5}
\else
\set s5 'supabase/migrations/20261122130000_shop_spedizioni.sql'
\endif

DO $f$
BEGIN
  IF current_database() NOT ILIKE '%prova%' THEN
    RAISE EXCEPTION 'STOP: il database si chiama «%», non contiene «prova». Questo script NON va lanciato qui.', current_database();
  END IF;
END $f$;

SELECT (:'passo' = 'tutto') AS tutto, (:'passo' = 'A') AS passo_a, (:'passo' = 'B') AS passo_b, (:'passo' = 'controlla') AS passo_c \gset

-- ═════════════════════════════════════════════════════════════════════════════
-- LA CORSA INTERA (una sola sessione)
-- ═════════════════════════════════════════════════════════════════════════════
\if :tutto

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

-- La tariffa di partenza di ogni scenario (id fisso del seme; data vista = 20/11/2026 10:00 UTC, come nell'elenco unico).
CREATE FUNCTION pg_temp.riparti() RETURNS void
LANGUAGE plpgsql AS $f$
BEGIN
  UPDATE public.shop_spedizioni_tariffe
     SET nome = 'Spedizione tracciata in Italia', corriere = NULL, costo_cent = 490, gratis_da_cent = NULL,
         giorni_min = NULL, giorni_max = NULL, attiva = true, provvisoria = true, confermata_il = NULL,
         aggiornato_il = '2026-11-20T10:00:00Z'
   WHERE id = '00000000-0000-4000-8000-000000008001';
END $f$;

-- Chiama la funzione sul seme e dà la risposta come testo (oppure «CODICE messaggio» se lancia).
CREATE FUNCTION pg_temp.imposta(atteso text, campi text, conferma boolean, chi text DEFAULT 'titolare') RETURNS text
LANGUAGE plpgsql AS $f$
BEGIN
  RETURN public.shop_tariffa_imposta('00000000-0000-4000-8000-000000008001', atteso::timestamptz, campi::jsonb, conferma, chi)::text;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE || ' ' || SQLERRM;
END $f$;

-- ── 1. S5 senza S1: si ferma al controllo iniziale e non lascia niente ─────────
\echo '(seguono errori ATTESI: il file si ferma al controllo iniziale perche S1 non e ancora presente)'
\set ON_ERROR_STOP off
\set VERBOSITY terse
\i :s5
\set ON_ERROR_STOP on
SELECT pg_temp.uguale('senza S1 la tabella delle tariffe NON nasce (il file si è fermato prima di scrivere)', 'null', COALESCE(to_regclass('public.shop_spedizioni_tariffe')::text, 'null'));

-- ── 2. S1, poi S5 DUE volte ───────────────────────────────────────────────────
\i :s1
SELECT value AS impostazioni_prima FROM (SELECT count(*)::text AS value FROM public.shop_impostazioni) x \gset
\i :s5
\i :s5
\echo 'ok  S5 applicata due volte di seguito senza errori'
SELECT pg_temp.uguale('il seme c''è ed è uno solo, anche dopo due applicazioni', '1', (SELECT count(*)::text FROM public.shop_spedizioni_tariffe));
SELECT pg_temp.uguale('il seme: «Spedizione tracciata in Italia», 490, Italia, attiva, provvisoria, mai confermata', 'Spedizione tracciata in Italia|IT|490|true|true|null',
  (SELECT concat_ws('|', nome, paese, costo_cent, attiva::text, provvisoria::text, COALESCE(confermata_il::text, 'null')) FROM public.shop_spedizioni_tariffe WHERE id = '00000000-0000-4000-8000-000000008001'));
SELECT pg_temp.uguale('il seme non ha corriere, soglia gratuita né tempi (vuoto = non si mostra)', 'null|null|null|null',
  (SELECT concat_ws('|', COALESCE(corriere, 'null'), COALESCE(gratis_da_cent::text, 'null'), COALESCE(giorni_min::text, 'null'), COALESCE(giorni_max::text, 'null')) FROM public.shop_spedizioni_tariffe));
SELECT pg_temp.uguale('i semi delle impostazioni: due righe in più, i due interruttori di S1 intatti', '2|"codice"|3',
  (SELECT ((SELECT count(*) FROM public.shop_impostazioni) - :impostazioni_prima)::text || '|' || (SELECT valore::text FROM public.shop_impostazioni WHERE chiave = 'catalogo_sito') || '|' || (SELECT valore::text FROM public.shop_impostazioni WHERE chiave = 'giacenza_bassa')));
SELECT pg_temp.uguale('«corrieri»: un elenco di nomi, ognuno con modello di link VUOTO (lo compila il titolare)', 'array|true|true',
  (SELECT jsonb_typeof(valore) || '|' || (jsonb_array_length(valore) > 0)::text || '|' || (SELECT bool_and(e->>'modello' = '' AND length(btrim(e->>'nome')) BETWEEN 1 AND 40 AND (SELECT count(*) FROM jsonb_object_keys(e)) = 2) FROM jsonb_array_elements(valore) e)::text
     FROM public.shop_impostazioni WHERE chiave = 'corrieri'));
SELECT pg_temp.uguale('«resi_confermati» parte da false', 'false', (SELECT valore::text FROM public.shop_impostazioni WHERE chiave = 'resi_confermati'));

-- Ciò che il titolare ha già cambiato NON si riscrive alla seconda applicazione
UPDATE public.shop_spedizioni_tariffe SET costo_cent = 555 WHERE id = '00000000-0000-4000-8000-000000008001';
UPDATE public.shop_impostazioni SET valore = 'true'::jsonb WHERE chiave = 'resi_confermati';
UPDATE public.shop_impostazioni SET valore = '[{"nome":"Corriere di prova","modello":"https://esempio.invalid/?n={numero}"}]'::jsonb WHERE chiave = 'corrieri';
\i :s5
SELECT pg_temp.uguale('rilanciando S5 il costo cambiato dal titolare resta (ON CONFLICT DO NOTHING)', '555', (SELECT costo_cent::text FROM public.shop_spedizioni_tariffe WHERE id = '00000000-0000-4000-8000-000000008001'));
SELECT pg_temp.uguale('rilanciando S5 «resi_confermati» e «corrieri» scritti dal titolare restano', 'true|Corriere di prova',
  (SELECT (SELECT valore::text FROM public.shop_impostazioni WHERE chiave = 'resi_confermati') || '|' || (SELECT valore->0->>'nome' FROM public.shop_impostazioni WHERE chiave = 'corrieri')));
UPDATE public.shop_impostazioni SET valore = 'false'::jsonb WHERE chiave = 'resi_confermati';
SELECT pg_temp.riparti();

-- ── 3. Struttura: indice, controlli, permessi ─────────────────────────────────
SELECT pg_temp.uguale('l''indice unico è PARZIALE: vale solo per le tariffe attive', 'true',
  (SELECT (indexdef ILIKE 'CREATE UNIQUE INDEX%(paese)%WHERE%attiva%')::text FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'shop_spedizioni_tariffe' AND indexdef ILIKE '%UNIQUE%' AND indexname NOT LIKE '%pkey'));
SELECT pg_temp.uguale('solo Italia: un altro paese è rifiutato dalla tabella (23514)', '23514',
  split_part(pg_temp.errore('INSERT INTO public.shop_spedizioni_tariffe (paese, nome, costo_cent, attiva) VALUES (''DE'', ''Germania'', 900, false)'), ' ', 1));
SELECT pg_temp.uguale('un costo negativo è rifiutato dalla tabella (23514)', '23514',
  split_part(pg_temp.errore('INSERT INTO public.shop_spedizioni_tariffe (paese, nome, costo_cent, attiva) VALUES (''IT'', ''Sconto'', -1, false)'), ' ', 1));
SELECT pg_temp.uguale('un nome vuoto è rifiutato dalla tabella (23514)', '23514',
  split_part(pg_temp.errore('INSERT INTO public.shop_spedizioni_tariffe (paese, nome, costo_cent, attiva) VALUES (''IT'', ''  '', 100, false)'), ' ', 1));
SELECT pg_temp.uguale('la protezione per riga è accesa e non c''è NESSUNA policy', 'true|0',
  (SELECT relrowsecurity::text FROM pg_class WHERE oid = 'public.shop_spedizioni_tariffe'::regclass) || '|' || (SELECT count(*)::text FROM pg_policies WHERE tablename = 'shop_spedizioni_tariffe'));
SELECT pg_temp.uguale('anon non legge la tabella (42501)', '42501', split_part(pg_temp.come('anon', 'SELECT * FROM public.shop_spedizioni_tariffe'), ' ', 1));
SELECT pg_temp.uguale('authenticated non legge la tabella (42501)', '42501', split_part(pg_temp.come('authenticated', 'SELECT * FROM public.shop_spedizioni_tariffe'), ' ', 1));
SELECT pg_temp.uguale('anon non scrive (42501)', '42501', split_part(pg_temp.come('anon', 'UPDATE public.shop_spedizioni_tariffe SET costo_cent = 1'), ' ', 1));
SELECT pg_temp.uguale('authenticated non scrive (42501)', '42501', split_part(pg_temp.come('authenticated', 'UPDATE public.shop_spedizioni_tariffe SET costo_cent = 1'), ' ', 1));
SELECT pg_temp.uguale('service_role LEGGE la tabella (la cassa e il CRM la leggono col server)', '', pg_temp.come('service_role', 'SELECT * FROM public.shop_spedizioni_tariffe'));
SELECT pg_temp.uguale('service_role NON scrive direttamente: né UPDATE né INSERT (si passa dalla funzione, che lascia lo storico)', '42501|42501',
  split_part(pg_temp.come('service_role', 'UPDATE public.shop_spedizioni_tariffe SET costo_cent = 1'), ' ', 1) || '|' ||
  split_part(pg_temp.come('service_role', 'INSERT INTO public.shop_spedizioni_tariffe (paese, nome, costo_cent, attiva) VALUES (''IT'', ''X'', 1, false)'), ' ', 1));
SELECT pg_temp.uguale('la funzione è SECURITY DEFINER con search_path = public', 'true|{search_path=public}',
  (SELECT prosecdef::text || '|' || proconfig::text FROM pg_proc WHERE proname = 'shop_tariffa_imposta'));
SELECT pg_temp.uguale('la funzione la esegue solo service_role (anon e authenticated no)', 'false|false|true',
  has_function_privilege('anon', 'public.shop_tariffa_imposta(uuid, timestamptz, jsonb, boolean, text)', 'EXECUTE')::text || '|' ||
  has_function_privilege('authenticated', 'public.shop_tariffa_imposta(uuid, timestamptz, jsonb, boolean, text)', 'EXECUTE')::text || '|' ||
  has_function_privilege('service_role', 'public.shop_tariffa_imposta(uuid, timestamptz, jsonb, boolean, text)', 'EXECUTE')::text);
SELECT pg_temp.uguale('anon che chiama la funzione: negato (42501)', '42501',
  split_part(pg_temp.come('anon', 'SELECT public.shop_tariffa_imposta(''00000000-0000-4000-8000-000000008001'', now(), ''{}''::jsonb, true, ''x'')'), ' ', 1));
SELECT pg_temp.uguale('PUBLIC non esegue la funzione (nessun ruolo qualunque)', 'false',
  (SELECT EXISTS (SELECT 1 FROM pg_proc p, aclexplode(p.proacl) a WHERE p.proname = 'shop_tariffa_imposta' AND a.grantee = 0)::text));
SELECT pg_temp.uguale('S5 non ha creato nessun trigger', '0',
  (SELECT count(*)::text FROM pg_trigger WHERE tgrelid = 'public.shop_spedizioni_tariffe'::regclass AND NOT tgisinternal));

-- ═════ GLI SCENARI DELL'ELENCO UNICO (`_scenari-soldi.json`, file «shop-spedizioni.sql») ═════

-- SCENARIO: tariffa_due_attive
SELECT pg_temp.riparti();
SELECT pg_temp.uguale('una seconda tariffa ATTIVA per Italia fallisce (23505)', '23505',
  split_part(pg_temp.errore('INSERT INTO public.shop_spedizioni_tariffe (id, paese, nome, costo_cent, attiva) VALUES (''00000000-0000-4000-8000-000000008002'', ''IT'', ''Seconda'', 600, true)'), ' ', 1));
SELECT pg_temp.uguale('una tariffa SPENTA si può aggiungere', '',
  pg_temp.errore('INSERT INTO public.shop_spedizioni_tariffe (id, paese, nome, costo_cent, attiva) VALUES (''00000000-0000-4000-8000-000000008003'', ''IT'', ''Spenta'', 600, false)'));
SELECT pg_temp.uguale('due righe in tutto, una sola attiva', '2|1', (SELECT count(*)::text FROM public.shop_spedizioni_tariffe) || '|' || (SELECT count(*)::text FROM public.shop_spedizioni_tariffe WHERE attiva));

-- SCENARIO: tariffa_confronto_e_scambio
SELECT pg_temp.riparti();
SELECT count(*) AS s0 FROM public.shop_storico WHERE entita = 'tariffa' \gset
SELECT pg_temp.uguale('valore visto vecchio (19/11): non scrive, risponde false', 'false', pg_temp.imposta('2026-11-19T10:00:00Z', '{"costo_cent":590}', false));
SELECT pg_temp.uguale('valore visto giusto: scrive, risponde true', 'true', pg_temp.imposta('2026-11-20T10:00:00Z', '{"costo_cent":590}', false));
SELECT pg_temp.uguale('lo stesso valore visto una seconda volta è ormai vecchio: false (una sola scrittura)', 'false', pg_temp.imposta('2026-11-20T10:00:00Z', '{"costo_cent":690}', false));
SELECT pg_temp.uguale('il costo è 590, la tariffa resta provvisoria e non confermata', '590|true|null',
  (SELECT concat_ws('|', costo_cent, provvisoria::text, COALESCE(confermata_il::text, 'null')) FROM public.shop_spedizioni_tariffe WHERE id = '00000000-0000-4000-8000-000000008001'));
SELECT pg_temp.uguale('una riga di storico per il costo (prima 490, dopo 590, chi «titolare»)', '1|490|590|titolare',
  (SELECT count(*)::text FROM public.shop_storico WHERE entita = 'tariffa' AND campo = 'costo_cent') || '|' ||
  (SELECT prima::text || '|' || dopo::text || '|' || chi FROM public.shop_storico WHERE entita = 'tariffa' AND campo = 'costo_cent' ORDER BY creato_il DESC LIMIT 1));
SELECT pg_temp.uguale('lo storico ha una riga sola in più, e parla della tariffa giusta', '1|00000000-0000-4000-8000-000000008001',
  ((SELECT count(*) FROM public.shop_storico WHERE entita = 'tariffa') - :s0)::text || '|' || (SELECT entita_id FROM public.shop_storico WHERE entita = 'tariffa' ORDER BY creato_il DESC LIMIT 1));
SELECT pg_temp.uguale('«aggiornato_il» è andato avanti', 'true', (SELECT (aggiornato_il > '2026-11-20T10:00:00Z')::text FROM public.shop_spedizioni_tariffe WHERE id = '00000000-0000-4000-8000-000000008001'));

-- SCENARIO: tariffa_conferma
SELECT pg_temp.riparti();
SELECT count(*) AS s0 FROM public.shop_storico WHERE entita = 'tariffa' \gset
SELECT pg_temp.uguale('«Conferma la tariffa» (nessun campo, p_conferma = true): risponde true', 'true', pg_temp.imposta('2026-11-20T10:00:00Z', '{}', true));
SELECT pg_temp.uguale('provvisoria tolta, confermata_il scritta (adesso), il costo non si è mosso', 'false|true|490',
  (SELECT provvisoria::text || '|' || (confermata_il IS NOT NULL AND confermata_il > now() - interval '1 minute')::text || '|' || costo_cent FROM public.shop_spedizioni_tariffe WHERE id = '00000000-0000-4000-8000-000000008001'));
SELECT pg_temp.uguale('una riga di storico «confermata» (prima vuoto, dopo true)', '1|true',
  ((SELECT count(*) FROM public.shop_storico WHERE entita = 'tariffa') - :s0)::text || '|' || (SELECT (prima IS NULL AND dopo = 'true'::jsonb AND campo = 'confermata')::text FROM public.shop_storico WHERE entita = 'tariffa' ORDER BY creato_il DESC LIMIT 1));
SELECT pg_temp.riparti();
SELECT pg_temp.imposta('2026-11-20T10:00:00Z', '{"corriere":"Corriere di prova","giorni_min":2,"giorni_max":4}', false) AS r \gset
SELECT pg_temp.uguale('senza p_conferma la tariffa NON si conferma da sola, nemmeno cambiando campi', 'true|true|null',
  :'r' || '|' ||
  (SELECT provvisoria::text || '|' || COALESCE(confermata_il::text, 'null') FROM public.shop_spedizioni_tariffe WHERE id = '00000000-0000-4000-8000-000000008001'));

-- SCENARIO: tariffa_senza_cambi
SELECT pg_temp.riparti();
SELECT count(*) AS s0 FROM public.shop_storico WHERE entita = 'tariffa' \gset
SELECT pg_temp.uguale('lo stesso costo e nessuna conferma: false, niente scritto', 'false', pg_temp.imposta('2026-11-20T10:00:00Z', '{"costo_cent":490}', false));
SELECT pg_temp.uguale('«aggiornato_il» e «provvisoria» non si sono mossi', '2026-11-20T10:00:00+00|true',
  (SELECT to_char(aggiornato_il AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"+00"') || '|' || provvisoria::text FROM public.shop_spedizioni_tariffe WHERE id = '00000000-0000-4000-8000-000000008001'));
SELECT pg_temp.uguale('nessuna riga di storico', '0', ((SELECT count(*) FROM public.shop_storico WHERE entita = 'tariffa') - :s0)::text);

-- SCENARIO: tariffa_valori_vietati
SELECT pg_temp.riparti();
SELECT count(*) AS s0 FROM public.shop_storico WHERE entita = 'tariffa' \gset
SELECT pg_temp.uguale('il paese non si cambia: tariffa_campo_non_valido (22023)', '22023 tariffa_campo_non_valido', pg_temp.imposta('2026-11-20T10:00:00Z', '{"paese":"DE"}', false));
SELECT pg_temp.uguale('un costo negativo: la tabella lo rifiuta (23514), niente scritto', '23514', split_part(pg_temp.imposta('2026-11-20T10:00:00Z', '{"costo_cent":-1}', false), ' ', 1));
SELECT pg_temp.uguale('una tariffa che non c''è: tariffa_inesistente (P0002)', 'P0002 tariffa_inesistente',
  (SELECT (SELECT pg_temp.errore('SELECT public.shop_tariffa_imposta(''00000000-0000-4000-8000-000000008fff'', ''2026-11-20T10:00:00Z'', ''{}''::jsonb, true, ''titolare'')'))));
SELECT pg_temp.uguale('dopo i tre rifiuti la tariffa è quella di prima e lo storico è vuoto', '490|IT|0',
  (SELECT costo_cent::text || '|' || paese FROM public.shop_spedizioni_tariffe WHERE id = '00000000-0000-4000-8000-000000008001') || '|' || ((SELECT count(*) FROM public.shop_storico WHERE entita = 'tariffa') - :s0)::text);

-- ═════ Le prove che il finto non può fare ═════
-- (ogni chiamata della funzione sta in un'istruzione a parte: dentro uno stesso SELECT le sotto-letture partirebbero PRIMA della scrittura)
SELECT pg_temp.riparti();
SELECT pg_temp.imposta('2026-11-20T10:00:00Z', '{"costo_cent":600,"paese":"DE"}', false) AS r \gset
SELECT pg_temp.uguale('un campo valido e uno storto insieme: si rifiuta TUTTO (il campo valido non resta scritto)', '22023 tariffa_campo_non_valido|490',
  :'r' || '|' || (SELECT costo_cent::text FROM public.shop_spedizioni_tariffe WHERE id = '00000000-0000-4000-8000-000000008001'));
SELECT pg_temp.imposta('2026-11-20T10:00:00Z', '{"costo_cent":"abc"}', false) AS r1 \gset
SELECT pg_temp.imposta('2026-11-20T10:00:00Z', '{"costo_cent":4.5}', false) AS r2 \gset
SELECT pg_temp.imposta('2026-11-20T10:00:00Z', '{"costo_cent":true}', false) AS r3 \gset
SELECT pg_temp.uguale('un costo che non è un numero intero (testo, decimale, boolean): tariffa_campo_non_valido', '22023 tariffa_campo_non_valido|22023 tariffa_campo_non_valido|22023 tariffa_campo_non_valido',
  :'r1' || '|' || :'r2' || '|' || :'r3');
SELECT pg_temp.uguale('attiva che non è true/false: tariffa_campo_non_valido', '22023 tariffa_campo_non_valido', pg_temp.imposta('2026-11-20T10:00:00Z', '{"attiva":"si"}', false));
SELECT pg_temp.uguale('nome o corriere che non sono testo: tariffa_campo_non_valido', '22023 tariffa_campo_non_valido|22023 tariffa_campo_non_valido',
  pg_temp.imposta('2026-11-20T10:00:00Z', '{"nome":5}', false) || '|' || pg_temp.imposta('2026-11-20T10:00:00Z', '{"corriere":["BRT"]}', false));
SELECT pg_temp.uguale('p_campi che non è un oggetto (lista o valore): tariffa_campo_non_valido', '22023 tariffa_campo_non_valido|22023 tariffa_campo_non_valido',
  pg_temp.imposta('2026-11-20T10:00:00Z', '[1]', false) || '|' || pg_temp.imposta('2026-11-20T10:00:00Z', '5', false));
SELECT pg_temp.uguale('un nome nullo lo rifiuta la tabella (23502), niente scritto', '23502',
  split_part(pg_temp.imposta('2026-11-20T10:00:00Z', '{"nome":null}', false), ' ', 1));
SELECT pg_temp.imposta('2026-11-20T10:00:00Z', '{"giorni_min":0}', false) AS r1 \gset
SELECT pg_temp.imposta('2026-11-20T10:00:00Z', '{"giorni_max":0}', false) AS r2 \gset
SELECT pg_temp.imposta('2026-11-20T10:00:00Z', '{"giorni_min":-1}', false) AS r3 \gset
SELECT pg_temp.uguale('i tempi si dicono in giorni DA UNO in su: 0 o meno non entrano (23514), così la vetrina non scrive mai «0-3 giorni»', '23514|23514|23514',
  split_part(:'r1', ' ', 1) || '|' || split_part(:'r2', ' ', 1) || '|' || split_part(:'r3', ' ', 1));
SELECT pg_temp.uguale('anche con l''INSERT diretto: giorni_min 0 e giorni_max 0 rifiutati dalla tabella (23514)', '23514|23514',
  split_part(pg_temp.errore('INSERT INTO public.shop_spedizioni_tariffe (paese, nome, costo_cent, attiva, giorni_min) VALUES (''IT'', ''T'', 100, false, 0)'), ' ', 1) || '|' ||
  split_part(pg_temp.errore('INSERT INTO public.shop_spedizioni_tariffe (paese, nome, costo_cent, attiva, giorni_max) VALUES (''IT'', ''T'', 100, false, 0)'), ' ', 1));
SELECT pg_temp.uguale('1 giorno è il minimo ammesso', 'true', pg_temp.imposta('2026-11-20T10:00:00Z', '{"giorni_min":1,"giorni_max":1}', false));
SELECT pg_temp.riparti();
SELECT count(*) AS s0 FROM public.shop_storico WHERE entita = 'tariffa' \gset
SELECT pg_temp.imposta('2026-11-20T10:00:00Z', '{"corriere":"BRT","giorni_min":2,"giorni_max":4}', false) AS r \gset
SELECT pg_temp.uguale('corriere e tempi si scrivono; tre campi = tre righe di storico', 'true|BRT|2|4|3',
  :'r' || '|' || (SELECT corriere || '|' || giorni_min || '|' || giorni_max FROM public.shop_spedizioni_tariffe WHERE id = '00000000-0000-4000-8000-000000008001') || '|' ||
  ((SELECT count(*) FROM public.shop_storico WHERE entita = 'tariffa') - :s0)::text);
SELECT aggiornato_il::text AS visto FROM public.shop_spedizioni_tariffe WHERE id = '00000000-0000-4000-8000-000000008001' \gset
SELECT pg_temp.imposta(:'visto', '{"corriere":null,"giorni_min":null,"giorni_max":null}', false) AS r \gset
SELECT pg_temp.uguale('con null corriere e tempi tornano vuoti (e il valore visto è quello con i microsecondi, come lo legge il CRM)', 'true|null|null|null',
  :'r' || '|' || (SELECT concat_ws('|', COALESCE(corriere, 'null'), COALESCE(giorni_min::text, 'null'), COALESCE(giorni_max::text, 'null')) FROM public.shop_spedizioni_tariffe WHERE id = '00000000-0000-4000-8000-000000008001'));
SELECT aggiornato_il::text AS visto FROM public.shop_spedizioni_tariffe WHERE id = '00000000-0000-4000-8000-000000008001' \gset
SELECT pg_temp.uguale('il valore visto arrotondato ai millisecondi (come lo rimanda un browser) vale ancora «quello visto»', 'true',
  pg_temp.imposta(to_char(date_trunc('milliseconds', :'visto'::timestamptz) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), '{"costo_cent":495}', false));
SELECT pg_temp.riparti();
SELECT aggiornato_il::text AS visto FROM public.shop_spedizioni_tariffe WHERE id = '00000000-0000-4000-8000-000000008003' \gset
SELECT pg_temp.errore(format('SELECT public.shop_tariffa_imposta(%L, %L::timestamptz, %L::jsonb, false, ''titolare'')', '00000000-0000-4000-8000-000000008003', :'visto', '{"attiva":true}')) AS r \gset
SELECT pg_temp.uguale('accendere la tariffa spenta mentre il seme è attivo fallisce (23505) e la spenta resta spenta', '23505|false',
  split_part(:'r', ' ', 1) || '|' || (SELECT attiva::text FROM public.shop_spedizioni_tariffe WHERE id = '00000000-0000-4000-8000-000000008003'));
SELECT pg_temp.imposta('2026-11-20T10:00:00Z', '{"attiva":false}', false) AS r \gset
SELECT pg_temp.uguale('spegnere la tariffa attiva si può; senza tariffa attiva la cassa si chiude (nessuna riga attiva)', 'true|0',
  :'r' || '|' || (SELECT count(*)::text FROM public.shop_spedizioni_tariffe WHERE attiva));
SELECT pg_temp.riparti();
SELECT pg_temp.imposta('2026-11-20T10:00:00Z', '{"costo_cent":500}', false, '   ') AS r \gset
SELECT pg_temp.uguale('chi vuoto → «sconosciuto»', 'true|sconosciuto',
  :'r' || '|' || (SELECT chi FROM public.shop_storico WHERE entita = 'tariffa' ORDER BY creato_il DESC LIMIT 1));
SELECT aggiornato_il::text AS visto FROM public.shop_spedizioni_tariffe WHERE id = '00000000-0000-4000-8000-000000008001' \gset
SELECT pg_temp.imposta(:'visto', '{"costo_cent":501}', false, repeat('x', 200)) AS r \gset
SELECT pg_temp.uguale('chi di 200 segni → 80', 'true|80', :'r' || '|' || (SELECT length(chi)::text FROM public.shop_storico WHERE entita = 'tariffa' ORDER BY creato_il DESC LIMIT 1));
SELECT pg_temp.riparti();
SELECT pg_temp.uguale('S5 non ha toccato nessun''altra tabella: lo storico parla solo di «tariffa»', 'true',
  (SELECT (NOT EXISTS (SELECT 1 FROM public.shop_storico WHERE entita <> 'tariffa'))::text));

\echo 'TUTTI I CONTROLLI DI S5 PASSANO (resta la prova a due terminali: passo=A, passo=B, passo=controlla)'
\endif

-- ═════════════════════════════════════════════════════════════════════════════
-- LA CORSA A DUE TERMINALI: due «Salva» insieme con lo stesso valore visto → ne passa uno solo
-- ═════════════════════════════════════════════════════════════════════════════
\if :passo_a
SELECT aggiornato_il::text AS visto FROM public.shop_spedizioni_tariffe WHERE id = '00000000-0000-4000-8000-000000008001' \gset
BEGIN;
SELECT 'A: esito = ' || public.shop_tariffa_imposta('00000000-0000-4000-8000-000000008001', :'visto'::timestamptz, '{"costo_cent":777}'::jsonb, false, 'terminale-A');
\echo 'A: tengo la transazione aperta 8 secondi...'
SELECT pg_sleep(8);
COMMIT;
\echo 'A: fatto (COMMIT)'
\endif

\if :passo_b
SELECT aggiornato_il::text AS visto FROM public.shop_spedizioni_tariffe WHERE id = '00000000-0000-4000-8000-000000008001' \gset
SELECT clock_timestamp()::text AS t0 \gset
SELECT 'B: esito = ' || public.shop_tariffa_imposta('00000000-0000-4000-8000-000000008001', :'visto'::timestamptz, '{"costo_cent":888}'::jsonb, false, 'terminale-B') AS esito_b;
SELECT 'B: ho aspettato circa ' || round(extract(epoch FROM clock_timestamp() - :'t0'::timestamptz)) || ' secondi (atteso: più di 4 se A era ancora aperta)';
\endif

\if :passo_c
SELECT count(*) FILTER (WHERE chi = 'terminale-A') AS righe_a, count(*) FILTER (WHERE chi = 'terminale-B') AS righe_b FROM public.shop_storico WHERE entita = 'tariffa' \gset
SELECT costo_cent AS costo_finale FROM public.shop_spedizioni_tariffe WHERE id = '00000000-0000-4000-8000-000000008001' \gset
DO $f$
BEGIN
  IF current_database() NOT ILIKE '%prova%' THEN RAISE EXCEPTION 'STOP'; END IF;
END $f$;
SELECT CASE WHEN :costo_finale = 777 AND :righe_a = 1 AND :righe_b = 0
  THEN 'ok  corsa: due «Salva» con lo stesso valore visto, ne è passato UNO (777, una riga di A, nessuna di B)'
  ELSE 'KO corsa: costo ' || :costo_finale || ', righe di A ' || :righe_a || ', righe di B ' || :righe_b || ' (atteso 777, 1, 0)' END AS esito \gset
\echo :esito
SELECT (:costo_finale = 777 AND :righe_a = 1 AND :righe_b = 0)::int AS bene \gset
\if :bene
\echo 'TUTTI I CONTROLLI DELLA CORSA PASSANO'
\else
\echo 'LA CORSA NON PASSA: S5 non va applicata in produzione'
\q 3
\endif
\endif
