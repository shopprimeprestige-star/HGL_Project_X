-- ─────────────────────────────────────────────────────────────────────────────
-- I LAVORI PERIODICI NON SANNO PIÙ A MEMORIA DOV'È IL SITO
--
-- Com'è nato questo file: il committente ha chiesto di poter scaricare TUTTO
-- per installarlo altrove; scaricando l'archivio della sorgente e leggendolo
-- sono saltate fuori due migrazioni che si portavano dentro, scritti a mano,
-- l'indirizzo di questa installazione e la chiave pubblica del progetto. Non
-- sono segreti — la chiave `anon` la riceve ogni browser — ma un sistema
-- clonato si sarebbe ritrovato dei lavori periodici che chiamano il sito
-- vecchio. E uno dei due (`touch-history-backfill-daily`) chiamava da mesi un
-- indirizzo che non esiste più, senza che nessuno se ne accorgesse.
--
-- Da qui in avanti i due valori stanno in `app_config`:
--     cron_sito    → l'indirizzo del sito (https://…, senza barra finale)
--     cron_chiave  → la chiave PUBBLICA (anon) del progetto Supabase
-- e si cambiano con due righe di SQL, senza toccare il codice.
--
-- ⚠️ QUESTA MIGRAZIONE RIPROGRAMMA I LAVORI GIÀ ESISTENTI con i valori presi
--    da lì: è il pezzo che rimette a posto l'installazione di oggi. Se le due
--    righe non ci sono NON TOCCA NIENTE — non spegne i lavori che stanno
--    funzionando — e dice cosa fare.
-- ⚠️ MAI LA CHIAVE DI SERVIZIO: il comando di un lavoro periodico resta
--    scritto in chiaro dentro `cron.job`, leggibile da chiunque entri nel
--    database.
-- ─────────────────────────────────────────────────────────────────────────────

--  Una funzione sola, perché i lavori sono due e domani saranno tre: scrivere
--  tre volte lo stesso `format()` è il modo in cui due lavori finiscono per
--  autenticarsi in modi diversi.
CREATE OR REPLACE FUNCTION public.programma_hook_cron(
  nome text,
  quando text,
  percorso text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $fn$
DECLARE
  sito   text;
  chiave text;
BEGIN
  IF to_regclass('cron.job') IS NULL OR to_regclass('public.app_config') IS NULL THEN
    RAISE NOTICE 'cron «%» saltato: manca pg_cron o app_config.', nome;
    RETURN false;
  END IF;
  SELECT value INTO sito   FROM public.app_config WHERE key = 'cron_sito';
  SELECT value INTO chiave FROM public.app_config WHERE key = 'cron_chiave';
  IF coalesce(sito, '') = '' OR coalesce(chiave, '') = '' THEN
    RAISE NOTICE 'cron «%» NON programmato: scrivi in app_config le righe cron_sito e cron_chiave.', nome;
    RETURN false;
  END IF;
  PERFORM cron.schedule(
    nome,
    quando,
    format(
      'SELECT net.http_post(url := %L, headers := %L::jsonb, body := ''{}''::jsonb);',
      rtrim(sito, '/') || percorso,
      json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || chiave)::text
    )
  );
  RAISE NOTICE 'cron «%» programmato su %', nome, rtrim(sito, '/') || percorso;
  RETURN true;
END
$fn$;

--  Non la chiama nessuno da fuori: la usano le migrazioni e chi amministra.
REVOKE ALL ON FUNCTION public.programma_hook_cron(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.programma_hook_cron(text, text, text) TO service_role;

--  E adesso i due lavori, con i valori di QUESTA installazione.
SELECT public.programma_hook_cron('meta-lead-sync-5min', '*/5 * * * *', '/hooks/meta-lead-sync');
SELECT public.programma_hook_cron('touch-history-backfill-daily', '15 3 * * *', '/hooks/touch-history-backfill');
