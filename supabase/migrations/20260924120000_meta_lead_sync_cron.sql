-- ─────────────────────────────────────────────────────────────────────────────
-- RECUPERO PERIODICO DEI LEAD DEI MODULI META — ogni 5 minuti
--
-- Chiama /hooks/meta-lead-sync, che chiede alla Graph API i lead degli ultimi
-- giorni e scrive in public_leads quelli che non ci sono ancora. I doppioni li
-- riconosce da external_id, quindi ripassare sugli stessi lead non costa nulla.
--
-- ⚠️ QUI DENTRO NON C'È PIÙ NESSUN INDIRIZZO E NESSUNA CHIAVE SCRITTI A MANO.
--    Prima c'erano: l'indirizzo del sito e la chiave pubblica di QUESTA
--    installazione. Non erano un segreto (la chiave `anon` la riceve ogni
--    browser), ma chi clonava il sistema su un altro database si ritrovava un
--    lavoro periodico che chiamava il SITO VECCHIO — e non aveva modo di
--    accorgersene. Trovato scaricando l'archivio della sorgente e leggendolo.
--    Adesso i due valori si leggono da `app_config`:
--        cron_sito    → https://il-tuo-indirizzo
--        cron_chiave  → la chiave pubblica (anon) del progetto
--    Senza quelle due righe il lavoro NON si programma, e lo dice: meglio un
--    lavoro che non parte di un lavoro che chiama casa d'altri.
--
-- ⚠️ La chiave da mettere è la PUBBLICABILE (anon), mai quella di servizio:
--    il comando di un lavoro periodico resta scritto in chiaro dentro
--    cron.job, leggibile da chiunque abbia accesso al database.
--
-- Per cambiare frequenza: rilanciare cron.schedule con lo stesso nome.
-- Per spegnerlo:  SELECT cron.unschedule('meta-lead-sync-5min');
-- Per vedere se gira:  SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- ─────────────────────────────────────────────────────────────────────────────
DO $cron$
DECLARE
  sito   text;
  chiave text;
BEGIN
  --  ⚠️ Su un database appena creato queste cose possono non esserci ancora
  --   (app_config nasce in una migrazione successiva, e le estensioni le
  --   accende chi installa): si salta con un avviso invece di far fallire
  --   tutta l'installazione per un lavoro periodico.
  IF to_regclass('cron.job') IS NULL OR to_regclass('public.app_config') IS NULL THEN
    RAISE NOTICE 'cron «meta-lead-sync-5min» saltato: manca pg_cron o app_config. Lo riprogramma la migrazione 20261005.';
    RETURN;
  END IF;
  SELECT value INTO sito   FROM public.app_config WHERE key = 'cron_sito';
  SELECT value INTO chiave FROM public.app_config WHERE key = 'cron_chiave';
  IF coalesce(sito, '') = '' OR coalesce(chiave, '') = '' THEN
    RAISE NOTICE 'cron «meta-lead-sync-5min» NON programmato: scrivi in app_config le righe cron_sito e cron_chiave, poi rilancia questa migrazione.';
    RETURN;
  END IF;
  PERFORM cron.schedule(
    'meta-lead-sync-5min',
    '*/5 * * * *',
    format(
      'SELECT net.http_post(url := %L, headers := %L::jsonb, body := ''{}''::jsonb);',
      rtrim(sito, '/') || '/hooks/meta-lead-sync',
      json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || chiave)::text
    )
  );
END
$cron$;
