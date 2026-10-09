-- ─────────────────────────────────────────────────────────────────────────────
-- RECUPERO GIORNALIERO DELLA STORIA DEI CONTATTI — ogni notte alle 3:15
-- Chiama /hooks/touch-history-backfill, che ricostruisce `touch_history` sui
-- lead vecchi (al massimo 500 per volta).
--
-- ⚠️ QUI C'ERANO L'INDIRIZZO E LA CHIAVE DI UN'INSTALLAZIONE CHE NON ESISTE
--    PIÙ (un vecchio indirizzo lovable.app e la chiave pubblica di un progetto
--    poi cancellato): questo lavoro periodico stava chiamando il vuoto da
--    mesi, senza che nessuno se ne accorgesse. Trovato leggendo l'archivio
--    della sorgente.
--    Adesso indirizzo e chiave si leggono da `app_config` (`cron_sito` e
--    `cron_chiave`), come per gli altri lavori: un'installazione nuova mette
--    le sue due righe e tutto parte da sé.
-- ─────────────────────────────────────────────────────────────────────────────
DO $cron$
DECLARE
  sito   text;
  chiave text;
BEGIN
  IF to_regclass('cron.job') IS NULL OR to_regclass('public.app_config') IS NULL THEN
    RAISE NOTICE 'cron «touch-history-backfill-daily» saltato: manca pg_cron o app_config. Lo riprogramma la migrazione 20261005.';
    RETURN;
  END IF;
  SELECT value INTO sito   FROM public.app_config WHERE key = 'cron_sito';
  SELECT value INTO chiave FROM public.app_config WHERE key = 'cron_chiave';
  IF coalesce(sito, '') = '' OR coalesce(chiave, '') = '' THEN
    RAISE NOTICE 'cron «touch-history-backfill-daily» NON programmato: mancano le righe cron_sito e cron_chiave in app_config.';
    RETURN;
  END IF;
  PERFORM cron.schedule(
    'touch-history-backfill-daily',
    '15 3 * * *',
    format(
      'SELECT net.http_post(url := %L, headers := %L::jsonb, body := ''{}''::jsonb);',
      rtrim(sito, '/') || '/hooks/touch-history-backfill',
      json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || chiave)::text
    )
  );
END
$cron$;
