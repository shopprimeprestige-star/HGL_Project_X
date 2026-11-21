-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DELLA MIGRAZIONE S6 (MODELLI EMAIL DELLO SHOP) SU UN POSTGRES VERO
-- (commessa 2026-11-20-shop-completo, Rilascio 2, T43)
--
-- NON entra in `npm test` e NON si lancia MAI sul database di produzione: serve un database
-- USA-E-GETTA il cui nome contiene «prova» (lo script si ferma se non è così).
--
--   createdb prova_email
--   psql prova_email -X -q -v ON_ERROR_STOP=1 -f prove/sql/shop-email.sql      (dalla radice del repo)
-- (con `-v ON_ERROR_STOP=0` lo script va avanti anche dopo un errore di SQL: serve a vedere TUTTI i rossi quando la
-- migrazione manca o è incompleta; per il collaudo vero si usa `1`)
--
-- Per i due casi di concorrenza (due terminali, qui due client lanciati dallo script stesso) servono le variabili
-- d'ambiente di connessione già impostate (PGHOST, PGPORT, PGUSER, se non sono quelle di default), perché i due client
-- si collegano da soli allo stesso database. Serve un utente superutente del database di prova.
--
-- Il database può essere vuoto: lo script crea i ruoli finti `anon`, `authenticated`, `service_role`, uno schema `auth`
-- minimo, applica la tabella ordini (M1) e S1 (il registro `shop_storico`), poi la migrazione S6 (due volte).
-- S4 (che porta la colonna `email_inviate` di `shop_orders`) è di un altro compito: lo script aggiunge SOLO quella
-- colonna, come la dichiara il piano (`jsonb DEFAULT '{}'`), nel database di prova (S4 usa `ADD COLUMN IF NOT EXISTS`:
-- non ci sarebbe conflitto).
--
-- Come si leggono i risultati: ogni controllo stampa `ok  <nome>` oppure `KO  <nome> · atteso … · avuto …` e lo script
-- NON si ferma al primo KO: stampa tutti i rossi e alla fine, se ce n'è almeno uno, esce con un errore.
-- I casi che il piano chiede per nome portano il marcatore `-- SCENARIO: <nome>` (gli stessi di
-- prove/negozio/_scenari-soldi.json: una prova controlla che coincidano); quelli in più sono `-- EXTRA:`.
--
-- Dati inventati: nessun nome, mail, numero o percorso vero.
-- ─────────────────────────────────────────────────────────────────────────────
\if :{?ON_ERROR_STOP}
\else
\set ON_ERROR_STOP on
\endif
\pset tuples_only on
\pset format unaligned
SET client_min_messages = warning;
\if :{?m1a}
\else
\set m1a 'supabase/migrations/20260722160000_shop_orders.sql'
\endif
\if :{?m1b}
\else
\set m1b 'supabase/migrations/20261117120000_ecommerce_ordini.sql'
\endif
\if :{?s1}
\else
\set s1 'supabase/migrations/20261120120000_shop_catalogo.sql'
\endif
\if :{?s6}
\else
\set s6 'supabase/migrations/20261122140000_shop_email.sql'
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
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $f$ SELECT current_user::text $f$;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE TABLE IF NOT EXISTS storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean DEFAULT false, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE IF NOT EXISTS storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ── Gli attrezzi ──────────────────────────────────────────────────────────────
CREATE TEMP TABLE esiti (n serial, nome text, ok boolean);

-- Registra un controllo e stampa la riga. Confronta come testo; NULL e '' sono cose diverse.
CREATE FUNCTION pg_temp.prova(nome text, atteso text, avuto text) RETURNS text
LANGUAGE plpgsql AS $f$
BEGIN
  INSERT INTO pg_temp.esiti (nome, ok) VALUES (nome, atteso IS NOT DISTINCT FROM avuto);
  IF atteso IS NOT DISTINCT FROM avuto THEN RETURN 'ok  ' || nome; END IF;
  RETURN 'KO  ' || nome || ' · atteso «' || COALESCE(atteso, 'NULL') || '» · avuto «' || COALESCE(avuto, 'NULL') || '»';
END $f$;

-- Esegue una SELECT che dà un solo valore e lo restituisce come testo; se va in errore: «ERR SQLSTATE messaggio».
-- `ruolo` non vuoto = come quel ruolo (anon, authenticated, service_role), poi si torna se stessi.
CREATE FUNCTION pg_temp.chiama(istruzione text, ruolo text DEFAULT '') RETURNS text
LANGUAGE plpgsql AS $f$
DECLARE r text;
BEGIN
  IF ruolo <> '' THEN EXECUTE format('SET LOCAL ROLE %I', ruolo); END IF;
  EXECUTE istruzione INTO r;
  IF ruolo <> '' THEN RESET ROLE; END IF;
  RETURN COALESCE(r, 'NULL');
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RETURN 'ERR ' || SQLSTATE || ' ' || SQLERRM;
END $f$;

-- Come `chiama`, ma esegue un'istruzione qualunque (anche multipla) e dà '' se va, «ERR SQLSTATE messaggio» se no.
CREATE FUNCTION pg_temp.esegui(istruzione text, ruolo text DEFAULT '') RETURNS text
LANGUAGE plpgsql AS $f$
BEGIN
  IF ruolo <> '' THEN EXECUTE format('SET LOCAL ROLE %I', ruolo); END IF;
  EXECUTE istruzione;
  IF ruolo <> '' THEN RESET ROLE; END IF;
  RETURN '';
EXCEPTION WHEN OTHERS THEN
  RESET ROLE;
  RETURN 'ERR ' || SQLSTATE || ' ' || SQLERRM;
END $f$;

-- Le chiamate alle funzioni di S6 con la stessa forma degli scenari (p_… come nel contratto del finto).
CREATE FUNCTION pg_temp.salva(chiave text, atteso text, oggetto text, testo text) RETURNS text LANGUAGE sql AS $f$
  SELECT pg_temp.chiama(format('SELECT public.shop_email_modello_salva(%L, %L::timestamptz, %L, %L, %L)', chiave, atteso, oggetto, testo, 'titolare')) $f$;
CREATE FUNCTION pg_temp.approva(chiave text, impronta text) RETURNS text LANGUAGE sql AS $f$
  SELECT pg_temp.chiama(format('SELECT public.shop_email_modello_approva(%L, %L, %L)', chiave, impronta, 'titolare')) $f$;
CREATE FUNCTION pg_temp.accendi(chiave text, acceso boolean) RETURNS text LANGUAGE sql AS $f$
  SELECT pg_temp.chiama(format('SELECT public.shop_email_modello_acceso(%L, %L::boolean, %L)', chiave, acceso, 'titolare')) $f$;
CREATE FUNCTION pg_temp.prenota(ordine uuid, chiave text) RETURNS text LANGUAGE sql AS $f$
  SELECT pg_temp.chiama(format('SELECT public.shop_email_prenota(%L::uuid, %L)', ordine, chiave)) $f$;
CREATE FUNCTION pg_temp.esito(ordine uuid, chiave text, stato text, codice text) RETURNS text LANGUAGE sql AS $f$
  SELECT pg_temp.chiama(format('SELECT public.shop_email_esito(%L::uuid, %L, %L, %L)', ordine, chiave, stato, codice)) $f$;


-- ── 1. Il database di prova: ordini (M1), registro (S1) ───────────────────────
\i :m1a
\i :m1b
\i :s1
\echo 'ok  base di prova applicata (ordini M1, registro dello shop S1)'

-- ── 2. S6 senza S4 (manca la colonna `email_inviate`): si ferma e NON scrive ───
\set s6testo `cat :s6`
SELECT pg_temp.prova('senza S4 la migrazione si ferma con un errore (il controllo iniziale)', 'ERR', left(pg_temp.esegui(:'s6testo'), 3));
SELECT pg_temp.prova('…e non ha lasciato niente: nessuna tabella dei modelli', 'NULL', COALESCE(to_regclass('public.shop_email_modelli')::text, 'NULL'));
SELECT pg_temp.prova('…e nessuna funzione di S6', '0', (SELECT count(*)::text FROM pg_proc WHERE proname LIKE 'shop\_email\_%'));

-- Ora la sola colonna di S4 che serve, e due ordini inventati: uno «vecchio» (S6 non deve toccarlo) e uno per l'invio.
ALTER TABLE public.shop_orders ADD COLUMN IF NOT EXISTS email_inviate jsonb DEFAULT '{}'::jsonb;
INSERT INTO public.shop_orders (id, order_ref, nome, cognome, email, telefono, indirizzo, citta, cap, items, subtotal, shipping, total)
VALUES ('00000000-0000-4000-8000-000000006000', 'HG-VECCHIO', 'Prova', 'Uno', 'prova.uno@example.invalid', '3000000000', 'Via Inventata 1', 'Cittaprova', '00000', '[]', 10, 5, 15);
INSERT INTO public.shop_orders (id, order_ref, nome, cognome, email, telefono, indirizzo, citta, cap, items, subtotal, shipping, total)
VALUES ('00000000-0000-4000-8000-000000006001', 'HG-S001', 'Prova', 'Due', 'prova.due@example.invalid', '3000000001', 'Via Inventata 2', 'Cittaprova', '00000', '[]', 28.9, 0, 28.9);
CREATE TEMP TABLE prima AS
SELECT (SELECT md5(string_agg(o::text, '|' ORDER BY o.id)) FROM public.shop_orders o) AS ordini,
       (SELECT count(*) FROM public.shop_storico) AS storico,
       (SELECT count(*) FROM pg_policies WHERE tablename = 'shop_orders') AS policy;

-- ── 3. S6, DUE volte ──────────────────────────────────────────────────────────
\i :s6
\echo 'ok  S6 applicata la prima volta'
SELECT pg_temp.prova('dopo S6: cinque righe seme', '5', (SELECT count(*)::text FROM public.shop_email_modelli));
SELECT pg_temp.prova('…le cinque chiavi del piano', 'annullato,conferma_ordine,pagamento_non_riuscito,rimborso,spedito', (SELECT string_agg(chiave, ',' ORDER BY chiave) FROM public.shop_email_modelli));
SELECT pg_temp.prova('…tutte SPENTE', '5', (SELECT count(*)::text FROM public.shop_email_modelli WHERE acceso = false));
SELECT pg_temp.prova('…tutte con {{da confermare}} sia nell''oggetto sia nel testo', '5', (SELECT count(*)::text FROM public.shop_email_modelli WHERE oggetto LIKE '%{{da confermare}}%' AND testo LIKE '%{{da confermare}}%'));
SELECT pg_temp.prova('…nessuna approvata (approvato_da, approvato_il, approvato_hash vuoti)', '0', (SELECT count(*)::text FROM public.shop_email_modelli WHERE approvato_da IS NOT NULL OR approvato_il IS NOT NULL OR approvato_hash IS NOT NULL));
SELECT pg_temp.prova('…firmate «Hair Genius Labs»', '5', (SELECT count(*)::text FROM public.shop_email_modelli WHERE testo LIKE '%Hair Genius Labs%'));
SELECT pg_temp.prova('…nessun indirizzo dello studio nei testi (nessuna via, nessun CAP)', '0', (SELECT count(*)::text FROM public.shop_email_modelli WHERE oggetto || testo ~* '(\mvia|viale|piazza|corso)\s+[A-Z0-9]' OR oggetto || testo ~ '\m[0-9]{5}\M'));
SELECT pg_temp.prova('S6 non tocca gli ordini esistenti', (SELECT ordini FROM prima), (SELECT md5(string_agg(o::text, '|' ORDER BY o.id)) FROM public.shop_orders o));
SELECT pg_temp.prova('S6 non scrive niente nel registro e non cambia le policy degli ordini', (SELECT storico || '/' || policy FROM prima), (SELECT (SELECT count(*) FROM public.shop_storico) || '/' || (SELECT count(*) FROM pg_policies WHERE tablename = 'shop_orders')));
SELECT pg_temp.prova('un testo salvato a mano (modello «annullato») prima della seconda applicazione', 'true', pg_temp.salva('annullato', (SELECT aggiornato_il::text FROM public.shop_email_modelli WHERE chiave = 'annullato'), 'Oggetto salvato a mano', 'Testo salvato a mano'));
CREATE TEMP TABLE dopo_salva AS SELECT md5(string_agg(m::text, '|' ORDER BY m.chiave)) AS tutto FROM public.shop_email_modelli m;
\i :s6
\echo 'ok  S6 applicata la seconda volta'
SELECT pg_temp.prova('doppia applicazione: ancora cinque righe', '5', (SELECT count(*)::text FROM public.shop_email_modelli));
SELECT pg_temp.prova('doppia applicazione: il seme non sovrascrive niente (nemmeno il testo salvato a mano)', (SELECT tutto FROM dopo_salva), (SELECT md5(string_agg(m::text, '|' ORDER BY m.chiave)) FROM public.shop_email_modelli m));
SELECT pg_temp.prova('doppia applicazione: il testo salvato a mano c''è ancora', 'Oggetto salvato a mano', (SELECT oggetto FROM public.shop_email_modelli WHERE chiave = 'annullato'));
SELECT pg_temp.prova('le cinque funzioni di S6 ci sono, una per nome', '5', (SELECT count(*)::text FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('shop_email_modello_salva', 'shop_email_modello_approva', 'shop_email_modello_acceso', 'shop_email_prenota', 'shop_email_esito')));
SELECT pg_temp.prova('…tutte SECURITY DEFINER con search_path fissato', '5', (SELECT count(*)::text FROM pg_proc WHERE proname LIKE 'shop\_email\_%' AND prosecdef AND proconfig @> ARRAY['search_path=public']));

-- ── 4. I modelli: gli scenari del piano (_scenari-soldi.json, file shop-email.sql) ──
-- Ogni scenario riparte dalla riga «conferma_ordine» come la descrive la sua `partenza`.
CREATE FUNCTION pg_temp.parti(ogg text, tes text, acc boolean, da text, il text, hash text, agg text) RETURNS void LANGUAGE sql AS $f$
  UPDATE public.shop_email_modelli SET oggetto = ogg, testo = tes, acceso = acc, approvato_da = da, approvato_il = il::timestamptz, approvato_hash = hash, aggiornato_il = agg::timestamptz
   WHERE chiave = 'conferma_ordine' $f$;
CREATE FUNCTION pg_temp.modello(colonna text) RETURNS text LANGUAGE sql AS $f$
  SELECT pg_temp.chiama(format('SELECT %I::text FROM public.shop_email_modelli WHERE chiave = ''conferma_ordine''', colonna)) $f$;
CREATE FUNCTION pg_temp.storico_email(chiave text) RETURNS bigint LANGUAGE sql AS $f$
  SELECT count(*) FROM public.shop_storico WHERE entita = 'email' AND entita_id = chiave $f$;

-- SCENARIO: modello_non_approvato
SELECT pg_temp.parti('Oggetto vecchio', 'Testo vecchio', false, NULL, NULL, NULL, '2026-11-20T10:00:00Z') \g /dev/null
SELECT pg_temp.prova('modello_non_approvato · accendere un modello non approvato: lo rifiuta il DATABASE (55000, modello_non_approvato)', 'ERR 55000 modello_non_approvato', pg_temp.accendi('conferma_ordine', true));
SELECT pg_temp.prova('modello_non_approvato · spegnere (già spento) non cambia niente: false', 'false', pg_temp.accendi('conferma_ordine', false));
SELECT pg_temp.prova('modello_non_approvato · resta spento', 'false', pg_temp.modello('acceso'));

-- SCENARIO: modello_con_segnaposto
SELECT pg_temp.parti('Oggetto con {{da confermare}}', 'Testo di prova', false, NULL, NULL, NULL, '2026-11-20T10:00:00Z') \g /dev/null
SELECT pg_temp.prova('modello_con_segnaposto · l''approvazione sull''impronta giusta passa', 'true', pg_temp.approva('conferma_ordine', '4c84bbfc983234377a924b2a1623103bc5031633eeef8be6077c6ac567f11e23'));
SELECT pg_temp.prova('modello_con_segnaposto · …ma con {{da confermare}} non si accende nemmeno approvato (23514, modello_con_segnaposto)', 'ERR 23514 modello_con_segnaposto', pg_temp.accendi('conferma_ordine', true));
SELECT pg_temp.prova('modello_con_segnaposto · resta spento', 'false', pg_temp.modello('acceso'));
SELECT pg_temp.prova('modello_con_segnaposto · l''approvazione è registrata (chi e impronta)', 'titolare/4c84bbfc983234377a924b2a1623103bc5031633eeef8be6077c6ac567f11e23', pg_temp.modello('approvato_da') || '/' || pg_temp.modello('approvato_hash'));

-- SCENARIO: modello_approvato_si_accende
SELECT pg_temp.parti('Oggetto pulito', 'Testo pulito senza segnaposto', false, NULL, NULL, NULL, '2026-11-20T10:00:00Z') \g /dev/null
SELECT pg_temp.prova('modello_approvato_si_accende · approvare l''impronta giusta', 'true', pg_temp.approva('conferma_ordine', 'e3e40d3c961db6c140d139a7a01316fa19ae2efbe52b768c31464e07c509c33a'));
SELECT pg_temp.prova('modello_approvato_si_accende · accendere: true', 'true', pg_temp.accendi('conferma_ordine', true));
SELECT pg_temp.prova('modello_approvato_si_accende · accendere di nuovo: false (non è cambiato)', 'false', pg_temp.accendi('conferma_ordine', true));
SELECT pg_temp.prova('modello_approvato_si_accende · è acceso', 'true', pg_temp.modello('acceso'));
SELECT pg_temp.prova('modello_approvato_si_accende · spegnere è sempre ammesso: true', 'true', pg_temp.accendi('conferma_ordine', false));
SELECT pg_temp.prova('modello_approvato_si_accende · da spento resta approvato, con la stessa impronta', 'false/e3e40d3c961db6c140d139a7a01316fa19ae2efbe52b768c31464e07c509c33a', pg_temp.modello('acceso') || '/' || pg_temp.modello('approvato_hash'));

-- SCENARIO: modello_impronta_vecchia
SELECT pg_temp.parti('Oggetto pulito', 'Testo pulito senza segnaposto', false, NULL, NULL, NULL, '2026-11-20T10:00:00Z') \g /dev/null
SELECT pg_temp.prova('modello_impronta_vecchia · approvare l''impronta di un testo vecchio: false', 'false', pg_temp.approva('conferma_ordine', '3cdee624fe2ef819e77f45e052bcf3ca736f167084675891709889923f287343'));
SELECT pg_temp.prova('modello_impronta_vecchia · …e non è approvato', 'NULL/NULL', pg_temp.modello('approvato_hash') || '/' || pg_temp.modello('approvato_da'));

-- SCENARIO: modello_salva_spegne
SELECT pg_temp.parti('Oggetto pulito', 'Testo pulito senza segnaposto', true, 'titolare', '2026-11-20T10:30:00Z', 'e3e40d3c961db6c140d139a7a01316fa19ae2efbe52b768c31464e07c509c33a', '2026-11-20T10:00:00Z') \g /dev/null
CREATE TEMP TABLE conta AS SELECT pg_temp.storico_email('conferma_ordine') AS n;
SELECT pg_temp.prova('modello_salva_spegne · chi salva con la data vista vecchia non scrive: false', 'false', pg_temp.salva('conferma_ordine', '2026-11-19T10:00:00Z', 'X', 'Y'));
SELECT pg_temp.prova('modello_salva_spegne · con la data giusta scrive: true', 'true', pg_temp.salva('conferma_ordine', '2026-11-20T10:00:00Z', 'Oggetto nuovo', 'Testo nuovo'));
SELECT pg_temp.prova('modello_salva_spegne · accendere ora: non è più approvato (55000)', 'ERR 55000 modello_non_approvato', pg_temp.accendi('conferma_ordine', true));
SELECT pg_temp.prova('modello_salva_spegne · il testo nuovo c''è, spento, senza approvazione', 'Oggetto nuovo/Testo nuovo/false/NULL/NULL/NULL', pg_temp.modello('oggetto') || '/' || pg_temp.modello('testo') || '/' || pg_temp.modello('acceso') || '/' || pg_temp.modello('approvato_hash') || '/' || pg_temp.modello('approvato_da') || '/' || pg_temp.modello('approvato_il'));
SELECT pg_temp.prova('modello_salva_spegne · una sola riga nuova nel registro (entita ''email'')', '1', (pg_temp.storico_email('conferma_ordine') - (SELECT n FROM conta))::text);
SELECT pg_temp.prova('modello_salva_spegne · …con il prima (acceso, testo vecchio) e il dopo (spento, testo nuovo)', 'true/Oggetto pulito/false/Oggetto nuovo', (SELECT (prima->>'acceso') || '/' || (prima->>'oggetto') || '/' || (dopo->>'acceso') || '/' || (dopo->>'oggetto') FROM public.shop_storico WHERE entita = 'email' AND entita_id = 'conferma_ordine' AND campo = 'testo' ORDER BY creato_il DESC LIMIT 1));

-- ── 5. L'invio una sola volta (shop_email_prenota / shop_email_esito) ────────
CREATE FUNCTION pg_temp.invii(chiave text) RETURNS text LANGUAGE sql AS $f$
  SELECT COALESCE(email_inviate #>> ARRAY[chiave, 'stato'], 'NULL') FROM public.shop_orders WHERE id = '00000000-0000-4000-8000-000000006001' $f$;
CREATE TEMP TABLE ordine_prima AS SELECT (to_jsonb(o) - 'email_inviate' - 'aggiornato_il')::text AS resto FROM public.shop_orders o WHERE id = '00000000-0000-4000-8000-000000006001';

-- SCENARIO: email_prenota_una_volta
SELECT pg_temp.prova('email_prenota_una_volta · la prima prenotazione è vera', 'true', pg_temp.prenota('00000000-0000-4000-8000-000000006001', 'conferma_ordine'));
SELECT pg_temp.prova('email_prenota_una_volta · la seconda è falsa (l''invio è in corso)', 'false', pg_temp.prenota('00000000-0000-4000-8000-000000006001', 'conferma_ordine'));
SELECT pg_temp.prova('email_prenota_una_volta · esito «errore» con il codice', 'true', pg_temp.esito('00000000-0000-4000-8000-000000006001', 'conferma_ordine', 'errore', 'resend_429'));
SELECT pg_temp.prova('email_prenota_una_volta · dopo un errore si può riprenotare', 'true', pg_temp.prenota('00000000-0000-4000-8000-000000006001', 'conferma_ordine'));
SELECT pg_temp.prova('email_prenota_una_volta · esito «inviata»', 'true', pg_temp.esito('00000000-0000-4000-8000-000000006001', 'conferma_ordine', 'inviata', NULL));
SELECT pg_temp.prova('email_prenota_una_volta · dopo «inviata» mai più', 'false', pg_temp.prenota('00000000-0000-4000-8000-000000006001', 'conferma_ordine'));
SELECT pg_temp.prova('email_prenota_una_volta · uno stato che non esiste («boh») è rifiutato (22023)', 'ERR 22023 email_stato_non_valido', pg_temp.esito('00000000-0000-4000-8000-000000006001', 'conferma_ordine', 'boh', NULL));
SELECT pg_temp.prova('email_prenota_una_volta · l''ordine dice «inviata»', 'inviata', pg_temp.invii('conferma_ordine'));

-- SCENARIO: email_in_invio_scade
SELECT pg_temp.prova('email_in_invio_scade · prima prenotazione di «spedito»: vera', 'true', pg_temp.prenota('00000000-0000-4000-8000-000000006001', 'spedito'));
UPDATE public.shop_orders SET email_inviate = jsonb_set(email_inviate, '{spedito,il}', to_jsonb(now() - interval '4 minutes')) WHERE id = '00000000-0000-4000-8000-000000006001';
SELECT pg_temp.prova('email_in_invio_scade · «in_invio» da 4 minuti: ancora bloccata (false)', 'false', pg_temp.prenota('00000000-0000-4000-8000-000000006001', 'spedito'));
UPDATE public.shop_orders SET email_inviate = jsonb_set(email_inviate, '{spedito,il}', to_jsonb(now() - interval '6 minutes')) WHERE id = '00000000-0000-4000-8000-000000006001';
SELECT pg_temp.prova('email_in_invio_scade · «in_invio» da 6 minuti (crash): si riprenota (true)', 'true', pg_temp.prenota('00000000-0000-4000-8000-000000006001', 'spedito'));
SELECT pg_temp.prova('email_in_invio_scade · …e subito dopo di nuovo bloccata (false)', 'false', pg_temp.prenota('00000000-0000-4000-8000-000000006001', 'spedito'));
SELECT pg_temp.prova('email_in_invio_scade · lo stato è «in_invio», con l''ora di adesso', 'in_invio/true', pg_temp.invii('spedito') || '/' || (SELECT ((email_inviate #>> '{spedito,il}')::timestamptz > now() - interval '1 minute')::text FROM public.shop_orders WHERE id = '00000000-0000-4000-8000-000000006001'));

-- ── 6. Più casi (non sono scenari del piano) ─────────────────────────────────
-- EXTRA: salva, approva, errori
SELECT pg_temp.parti('Oggetto pulito', 'Testo pulito senza segnaposto', false, NULL, NULL, NULL, '2026-11-20T10:00:00Z') \g /dev/null
SELECT pg_temp.prova('extra · salva senza la data vista (NULL): false, non scrive', 'false', pg_temp.chiama('SELECT public.shop_email_modello_salva(''conferma_ordine'', NULL, ''A'', ''B'', ''titolare'')'));
SELECT pg_temp.prova('extra · approva con impronta vuota (NULL): false', 'false', pg_temp.chiama('SELECT public.shop_email_modello_approva(''conferma_ordine'', NULL, ''titolare'')'));
SELECT pg_temp.prova('extra · approvare l''impronta giusta: true', 'true', pg_temp.approva('conferma_ordine', 'e3e40d3c961db6c140d139a7a01316fa19ae2efbe52b768c31464e07c509c33a'));
SELECT pg_temp.prova('extra · …approvare cambia aggiornato_il: salvare con la data vista PRIMA dell''approvazione non scrive (false)', 'false', pg_temp.salva('conferma_ordine', '2026-11-20T10:00:00Z', 'A', 'B'));
SELECT pg_temp.prova('extra · il modello che non esiste: salva, approva, acceso rifiutano (P0002, modello_non_trovato)', 'ERR P0002 modello_non_trovato/ERR P0002 modello_non_trovato/ERR P0002 modello_non_trovato',
  pg_temp.salva('inventata', '2026-11-20T10:00:00Z', 'A', 'B') || '/' || pg_temp.approva('inventata', 'x') || '/' || pg_temp.accendi('inventata', true));
SELECT pg_temp.prova('extra · prenota e esito su un ordine che non esiste: P0002 ordine_non_trovato', 'ERR P0002 ordine_non_trovato/ERR P0002 ordine_non_trovato',
  pg_temp.prenota('00000000-0000-4000-8000-0000000099ff', 'conferma_ordine') || '/' || pg_temp.esito('00000000-0000-4000-8000-0000000099ff', 'conferma_ordine', 'inviata', NULL));
SELECT pg_temp.prova('extra · prenota con la chiave vuota: 22023 parametro_non_valido', 'ERR 22023 parametro_non_valido', pg_temp.prenota('00000000-0000-4000-8000-000000006001', ''));
SELECT pg_temp.prova('extra · il registro dell''esito ha solo stato e codice, scritto da «sistema»', 'codice,stato/sistema', (
  SELECT (SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(dopo) k) || '/' || chi FROM public.shop_storico WHERE entita = 'email' AND entita_id = '00000000-0000-4000-8000-000000006001' AND campo = 'conferma_ordine' ORDER BY creato_il DESC, id DESC LIMIT 1));
SELECT pg_temp.prova('extra · …e nessuna riga del registro delle email contiene la mail, il telefono o l''indirizzo dell''ordine', '0', (SELECT count(*)::text FROM public.shop_storico WHERE entita = 'email' AND (dopo::text ~* 'example\.invalid|Via Inventata|3000000001' OR prima::text ~* 'example\.invalid|Via Inventata|3000000001')));
SELECT pg_temp.prova('extra · prenota e esito toccano SOLO email_inviate (e aggiornato_il): il resto dell''ordine è identico', (SELECT resto FROM ordine_prima), (SELECT (to_jsonb(o) - 'email_inviate' - 'aggiornato_il')::text FROM public.shop_orders o WHERE id = '00000000-0000-4000-8000-000000006001'));

-- EXTRA: il database rifiuta anche la scrittura diretta
SELECT pg_temp.prova('extra · scrivendo a mano «acceso» su un modello non approvato: 23514 (il CHECK della tabella)', 'ERR 23514', left(pg_temp.esegui('UPDATE public.shop_email_modelli SET acceso = true WHERE chiave = ''spedito'''), 9));
SELECT pg_temp.prova('extra · …con un''impronta sbagliata: 23514', 'ERR 23514', left(pg_temp.esegui('UPDATE public.shop_email_modelli SET acceso = true, approvato_hash = repeat(''0'', 64), approvato_da = ''x'' WHERE chiave = ''spedito'''), 9));
SELECT pg_temp.prova('extra · …con l''impronta giusta ma con {{ nel testo: 23514', 'ERR 23514', left(pg_temp.esegui('UPDATE public.shop_email_modelli SET acceso = true, approvato_da = ''x'', approvato_hash = encode(sha256(convert_to(oggetto || E''\n'' || testo, ''UTF8'')), ''hex'') WHERE chiave = ''spedito'''), 9));
SELECT pg_temp.prova('extra · una chiave che non è fra le cinque: 23514', 'ERR 23514', left(pg_temp.esegui('INSERT INTO public.shop_email_modelli (chiave) VALUES (''inventata'')'), 9));
SELECT pg_temp.prova('extra · nessun modello è rimasto acceso per sbaglio (i rifiuti non hanno scritto)', '0', (SELECT count(*)::text FROM public.shop_email_modelli WHERE acceso));

-- EXTRA: i permessi, come PostgREST (ruoli)
SELECT pg_temp.prova('extra · anon non legge la tabella (42501)', 'ERR 42501', left(pg_temp.chiama('SELECT count(*)::text FROM public.shop_email_modelli', 'anon'), 9));
SELECT pg_temp.prova('extra · authenticated non legge la tabella (42501)', 'ERR 42501', left(pg_temp.chiama('SELECT count(*)::text FROM public.shop_email_modelli', 'authenticated'), 9));
SELECT pg_temp.prova('extra · service_role legge la tabella', '5', pg_temp.chiama('SELECT count(*)::text FROM public.shop_email_modelli', 'service_role'));
SELECT pg_temp.prova('extra · service_role NON scrive direttamente (UPDATE e INSERT: 42501)', 'ERR 42501/ERR 42501',
  left(pg_temp.esegui('UPDATE public.shop_email_modelli SET testo = ''x''', 'service_role'), 9) || '/' || left(pg_temp.esegui('INSERT INTO public.shop_email_modelli (chiave) VALUES (''conferma_ordine'')', 'service_role'), 9));
CREATE TEMP TABLE chiamate (f text);
INSERT INTO chiamate VALUES
  ('shop_email_modello_salva(''conferma_ordine'', NULL, ''A'', ''B'', ''x'')'), ('shop_email_modello_approva(''conferma_ordine'', ''0'', ''x'')'), ('shop_email_modello_acceso(''conferma_ordine'', false, ''x'')'),
  ('shop_email_prenota(''00000000-0000-4000-8000-0000000099ff'', ''conferma_ordine'')'), ('shop_email_esito(''00000000-0000-4000-8000-0000000099ff'', ''conferma_ordine'', ''errore'', NULL)');
SELECT pg_temp.prova('extra · anon e authenticated non eseguono nessuna delle cinque funzioni (42501): 10 rifiuti su 10', '10', (
  SELECT count(*)::text FROM unnest(ARRAY['anon', 'authenticated']) r, chiamate c
   WHERE left(pg_temp.chiama('SELECT public.' || c.f || '::text', r), 9) = 'ERR 42501'));
SELECT pg_temp.prova('extra · service_role le esegue tutte e cinque (nessun errore di permesso)', '5', (
  SELECT count(*)::text FROM chiamate c WHERE left(pg_temp.chiama('SELECT public.' || c.f || '::text', 'service_role'), 9) <> 'ERR 42501'));

-- ── 7. Due terminali insieme (concorrenza): due client veri sullo stesso database ──
-- A tiene la riga bloccata 2 secondi DOPO aver scritto; B parte 1 secondo dopo e deve ASPETTARE e poi vedere il lavoro di A.
\set cartella `mktemp -d`
\set client 'psql -X -qAt -h ' :HOST ' -p ' :PORT ' -U ' :USER ' -d ' :DBNAME
UPDATE public.shop_orders SET email_inviate = '{}' WHERE id = '00000000-0000-4000-8000-000000006001';
\set _ `( :client -c "SELECT public.shop_email_prenota('00000000-0000-4000-8000-000000006001'::uuid, 'rimborso')::text, pg_sleep(2)" > :cartella/a1 2>&1 & ) ; sleep 1 ; :client -c "SELECT public.shop_email_prenota('00000000-0000-4000-8000-000000006001'::uuid, 'rimborso')::text" > :cartella/b1 2>&1 ; sleep 2`
\set a1 `cat :cartella/a1`
\set b1 `cat :cartella/b1`
SELECT pg_temp.prova('concorrenza · due prenotazioni insieme dello stesso messaggio: UNA sola è vera (A vera, B falsa)', 'true|/false', :'a1' || '/' || :'b1');
SELECT pg_temp.prova('concorrenza · l''ordine ha una sola prenotazione «in_invio»', 'in_invio', pg_temp.invii('rimborso'));

SELECT aggiornato_il::text AS att FROM public.shop_email_modelli WHERE chiave = 'pagamento_non_riuscito' \gset
\set _ `( :client -c "SELECT public.shop_email_modello_salva('pagamento_non_riuscito', ':att'::timestamptz, 'Oggetto A', 'Testo A', 'prova-a')::text, pg_sleep(2)" > :cartella/a2 2>&1 & ) ; sleep 1 ; :client -c "SELECT public.shop_email_modello_salva('pagamento_non_riuscito', ':att'::timestamptz, 'Oggetto B', 'Testo B', 'prova-b')::text" > :cartella/b2 2>&1 ; sleep 2`
\set a2 `cat :cartella/a2`
\set b2 `cat :cartella/b2`
SELECT pg_temp.prova('concorrenza · due salvataggi insieme con la stessa data vista: UNO solo scrive (A vero, B falso)', 'true|/false', :'a2' || '/' || :'b2');
SELECT pg_temp.prova('concorrenza · vince il primo: nel modello c''è il testo di A', 'Oggetto A', (SELECT oggetto FROM public.shop_email_modelli WHERE chiave = 'pagamento_non_riuscito'));
\set _ `rm -rf :cartella`

-- ── 8. Il verdetto ────────────────────────────────────────────────────────────
SELECT count(*) FILTER (WHERE ok) || ' controlli ok, ' || count(*) FILTER (WHERE NOT ok) || ' KO' FROM pg_temp.esiti;
DO $f$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_temp.esiti WHERE NOT ok) THEN
    RAISE EXCEPTION 'KO: % controlli sbagliati (sopra, le righe che cominciano con KO)', (SELECT count(*) FROM pg_temp.esiti WHERE NOT ok);
  END IF;
END $f$;
