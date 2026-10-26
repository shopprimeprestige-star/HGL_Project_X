-- ─────────────────────────────────────────────────────────────────────────────
-- COLLAUDO DI S1 SU UN POSTGRES VERO (compito S, commessa 2026-10-25)
--
-- NON entra in `npm test`: serve un Postgres con M1 e la tabella crm_leads
-- (supabase start, oppure un Postgres 15 con le migrazioni applicate in ordine).
-- Istruzioni e uscita attesa: prove/sql/LEGGIMI.md.
--
-- Si lancia con psql, in PIÙ passi (variabile `passo`):
--   psql "$DB" -v passo=prepara   -f prove/sql/sheets-lucchetto.sql
--   psql "$DB" -v passo=A         -f prove/sql/sheets-lucchetto.sql   (terminale 1)
--   psql "$DB" -v passo=B         -f prove/sql/sheets-lucchetto.sql   (terminale 2, entro 5 secondi)
--   psql "$DB" -v passo=controlla -f prove/sql/sheets-lucchetto.sql
--   psql "$DB" -v passo=tetto     -f prove/sql/sheets-lucchetto.sql
--   psql "$DB" -v passo=doppia    -f prove/sql/sheets-lucchetto.sql
--   psql "$DB" -v passo=pulisci   -f prove/sql/sheets-lucchetto.sql
--
-- Dati inventati: l'utente di prova, i numeri e i nomi non esistono. Tutto
-- quello che il collaudo scrive ha la chiave che comincia per «prova-» o l'id
-- utente fisso qui sotto, e `pulisci` toglie solo quello.
-- ─────────────────────────────────────────────────────────────────────────────
\set ON_ERROR_STOP on
\set utente '''00000000-0000-4000-8000-0000000000a1'''
\set migrazione 'supabase/migrations/20261025120000_sheets_ingresso.sql'

\if :{?passo}
\else
  \echo 'Manca -v passo=prepara|A|B|controlla|tetto|doppia|pulisci'
  \quit
\endif
-- psql non confronta stringhe dentro \if: si calcola un vero/falso per passo.
SELECT :'passo' = 'prepara'   AS p_prepara,
       :'passo' = 'A'         AS p_a,
       :'passo' = 'B'         AS p_b,
       :'passo' = 'controlla' AS p_controlla,
       :'passo' = 'tetto'     AS p_tetto,
       :'passo' = 'doppia'    AS p_doppia,
       :'passo' = 'pulisci'   AS p_pulisci \gset

-- ── prepara: S1 applicata, un utente di prova ────────────────────────────────
\if :p_prepara
  \i :migrazione
  INSERT INTO auth.users (id, email)
  VALUES (:utente::uuid, 'prova-sheets@example.invalid') ON CONFLICT (id) DO NOTHING;
  \echo 'preparato: S1 applicata e utente di prova creato'
\endif

-- ── A: la prima richiesta tiene il lucchetto del numero 10 secondi ───────────
-- Lancia A, poi B subito dopo. B deve aspettare che A finisca, e trovare la
-- scheda di A: risponde «ritorno». Senza il lucchetto risponderebbe «nuovo» e
-- ci sarebbero due schede per lo stesso numero.
\if :p_a
  BEGIN;
  SELECT public.sheets_ingresso_scrivi(
    :utente, 'm:prova-lucchetto-A', '330000171', 'l:900000171', 'Prova', 2,
    '{"nome":"Mario","cognome":"Esempio","telefono":"+393330000171","stato":"da_contattare","importato":true}'::jsonb
  ) AS risposta_A;
  SELECT pg_sleep(10);
  COMMIT;
  \echo 'A finito (atteso: esito nuovo)'
\endif

-- ── B: stesso numero, altro id: aspetta A ────────────────────────────────────
\if :p_b
  \timing on
  SELECT public.sheets_ingresso_scrivi(
    :utente, 'm:prova-lucchetto-B', '330000171', 'l:900000172', 'Prova', 3,
    '{"nome":"Mario","cognome":"Esempio","telefono":"+393330000171","stato":"da_contattare","importato":true}'::jsonb
  ) AS risposta_B;
  \echo 'B finito (atteso: esito ritorno, dopo circa 10 secondi di attesa; Time: > 8000 ms)'
\endif

-- ── controlla: una scheda e un ritorno ───────────────────────────────────────
\if :p_controlla
  SELECT count(*) AS schede_con_quel_numero
    FROM public.crm_leads
   WHERE user_id = :utente AND right(regexp_replace(data->>'telefono', '[^0-9]', '', 'g'), 9) = '330000171';
  \echo '  atteso: 1'
  SELECT chiave, esito FROM public.sheets_ingressi WHERE chiave LIKE 'm:prova-lucchetto-%' ORDER BY chiave;
  \echo '  atteso: A = nuovo, B = ritorno_da_segnare'
  SELECT public.sheets_ingresso_esito(:utente, 'm:prova-lucchetto-B', 'ritorno') AS chiuso;
  \echo '  atteso: t (poi una seconda volta f)'
  SELECT public.sheets_ingresso_esito(:utente, 'm:prova-lucchetto-B', 'ritorno') AS richiuso;
  SELECT public.sheets_ingresso_scrivi(
    :utente, 'm:prova-lucchetto-A', '330000171', 'l:900000171', 'Prova', 2, '{}'::jsonb
  ) AS stessa_chiave_di_nuovo;
  \echo '  atteso: esito gia_ricevuto, stato nuovo'
  SELECT public.sheets_ingresso_scrivi(
    :utente, 'm:prova-idmeta', '', 'l:900000171', 'Prova', 4, '{"nome":"X"}'::jsonb
  ) AS stesso_id_meta_altro_numero;
  \echo '  atteso: esito gia_presente'
\endif

-- ── tetto: la 301ª riga del giorno ───────────────────────────────────────────
\if :p_tetto
  INSERT INTO public.sheets_ingressi (chiave, user_id, esito)
  SELECT 'prova-tetto-' || g, :utente::uuid, 'nuovo' FROM generate_series(1, 300) g
  ON CONFLICT (chiave) DO NOTHING;
  SELECT count(*) AS righe_di_oggi FROM public.sheets_ingressi
   WHERE user_id = :utente AND (ricevuto_il AT TIME ZONE 'Europe/Rome')::date = (now() AT TIME ZONE 'Europe/Rome')::date;
  SELECT public.sheets_ingresso_scrivi(
    :utente, 'm:prova-tetto-301', '330000999', 'l:900000999', 'Prova', 5, '{"nome":"Y"}'::jsonb
  ) AS la_301;
  \echo '  atteso: esito tetto, e nessuna riga m:prova-tetto-301 nel registro'
  SELECT count(*) AS scritta_per_errore FROM public.sheets_ingressi WHERE chiave = 'm:prova-tetto-301';
  \echo '  atteso: 0'
  SELECT public.sheets_ingresso_scrivi(
    :utente, 'm:prova-lucchetto-A', '330000171', 'l:900000171', 'Prova', 2, '{}'::jsonb
  ) AS riga_gia_entrata_a_tetto_pieno;
  \echo '  atteso: gia_ricevuto (una riga già entrata risponde anche a tetto raggiunto)'
\endif

-- ── doppia: S1 applicata due volte di fila ───────────────────────────────────
\if :p_doppia
  \i :migrazione
  \i :migrazione
  \echo 'S1 applicata due volte di fila senza errori (se qui non c''è un errore sopra, è passata)'
  SELECT has_function_privilege('anon', 'public.sheets_ingresso_scrivi(uuid, text, text, text, text, integer, jsonb)', 'EXECUTE') AS anon_puo,
         has_function_privilege('authenticated', 'public.sheets_ingresso_scrivi(uuid, text, text, text, text, integer, jsonb)', 'EXECUTE') AS authenticated_puo,
         has_function_privilege('service_role', 'public.sheets_ingresso_scrivi(uuid, text, text, text, text, integer, jsonb)', 'EXECUTE') AS service_role_puo;
  \echo '  atteso: f | f | t'
  SELECT has_table_privilege('anon', 'public.sheets_ingressi', 'SELECT') AS anon_legge,
         has_table_privilege('authenticated', 'public.sheets_ingressi', 'SELECT') AS authenticated_legge;
  \echo '  atteso: f | f'
\endif

-- ── pulisci: toglie SOLO quello che ha scritto il collaudo ───────────────────
\if :p_pulisci
  DELETE FROM public.sheets_ingressi WHERE user_id = :utente;
  DELETE FROM public.crm_leads WHERE user_id = :utente;
  DELETE FROM auth.users WHERE id = :utente;
  \echo 'pulito'
\endif
