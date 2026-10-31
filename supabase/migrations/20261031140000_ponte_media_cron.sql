-- ─────────────────────────────────────────────────────────────────────────────
-- IL PONTE WHATSAPP · MEDIA IN CHAT · C · IL CRON CHE LIBERA I FILE SCADUTI (per ULTIMA)
--
-- Commessa 2026-10-31-media-e-archiviazione (T1, PIANO (e)). Fa partire ogni minuto
-- la rotta del Worker `/hooks/media-scadute`: libera i media il cui timer è scaduto
-- (`ponte_wa_media_scadute` → `storage.remove` → `ponte_wa_media_liberato`) e, nello
-- stesso giro, le pulizie (`ponte_wa_media_pulizia`, e ogni 30 minuti gli orfani).
-- Usa `programma_hook_cron_attesa` nata in 20261023120000_manychat_base.sql: pg_net
-- aspetta 45 secondi la risposta.
--
-- ⚠️ ORDINE DI MESSA IN OPERA: codice → A → B → aggiorna il Mac → C.
-- ⚠️ DA LANCIARE PER ULTIMA, solo dopo: il codice con la rotta pubblicato, A e B, il Mac
--    aggiornato. Prima della rotta il cron prende un 404 ogni minuto: innocuo, ma inutile.
-- ⚠️ Serve `cron_sito` e `cron_chiave` in app_config, come tutti gli altri lavori: se
--    mancano non programma niente e lo dice (NOTICE).
-- ⚠️ Rilanciarla non fa danni: stesso nome del lavoro, `cron.schedule` lo aggiorna.
-- ⚠️ L'hook usa la chiave pubblicabile come gli altri (nessuna protezione vera): è
--    sostenibile perché agisce solo su righe GIÀ scadute, risponde con soli conteggi ed è
--    idempotente. Restano 1.440 chiamate al giorno anche a vuoto: il comando lo costruisce
--    `programma_hook_cron_attesa`, non si può condizionare.
--
-- PER VEDERLO GIRARE (ultime 10 esecuzioni):
--   SELECT status, return_message, start_time FROM cron.job_run_details
--    WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'media-scadute-1min')
--    ORDER BY start_time DESC LIMIT 10;
--
-- PER SPEGNERLO (il giro smette di essere chiamato; non cancella niente; i file con un
-- timer restano finché non lo si riaccende):
--   SELECT cron.unschedule('media-scadute-1min');
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

SELECT public.programma_hook_cron_attesa('media-scadute-1min', '* * * * *', '/hooks/media-scadute', 45000);

COMMIT;
