-- ── IL RIEPILOGO DELLA SERA, ALLE 20:00 DI ROMA (30/10/2026) ────────────────
-- Richiesta del titolare: ogni sera una notifica push con «Domani N consulenze
-- · X confermate · Y da sentire · Z chat senza risposta», sugli stessi telefoni
-- delle notifiche WhatsApp. Il lavoro è la rotta /hooks/riepilogo-serale: legge
-- soltanto e spedisce la notifica; scrive solo il segno del giorno in
-- app_config (riepilogo_serale_ultimo).
--
-- ⚠️ pg_cron GIRA IN UTC. Le 20:00 di Roma sono le 19:00 UTC d'inverno (ora
--    solare) e le 18:00 UTC d'estate (ora legale): per non toccare il cron a
--    ogni cambio d'ora ne sono programmati DUE, uno per ogni ora UTC. A
--    decidere è la rotta: manda solo se a Roma sono fra le 20:00 e le 20:59, e
--    una volta sola al giorno. L'altro giro, ogni giorno, esce subito senza
--    fare niente.
-- ⚠️ SOLO AGGIUNTIVA: due cron con la stessa funzione degli altri hook
--    (programma_hook_cron: indirizzo e chiave pubblica da app_config). Se
--    cron_sito e cron_chiave non ci sono, non programma niente e lo dice.
--
-- COME SI SPEGNE (tutte e due le righe):
--   SELECT cron.unschedule('riepilogo-serale-18utc');
--   SELECT cron.unschedule('riepilogo-serale-19utc');
-- Per rimandare di una sera basta scrivere in app_config il giorno di oggi:
--   INSERT INTO public.app_config (key, value) VALUES ('riepilogo_serale_ultimo', 'AAAA-MM-GG')
--   ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

SELECT public.programma_hook_cron('riepilogo-serale-18utc', '0 18 * * *', '/hooks/riepilogo-serale');
SELECT public.programma_hook_cron('riepilogo-serale-19utc', '0 19 * * *', '/hooks/riepilogo-serale');
