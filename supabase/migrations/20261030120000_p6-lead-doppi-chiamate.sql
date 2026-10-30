-- ── IL RIEPILOGO DEL MATTINO, OGNI GIORNO (30/10/2026, commessa ottimizzazioni p6) ──
-- Ogni consulente riceve sul telefono (push) e per email, se c'è RESEND_API_KEY,
-- i numeri della sua giornata; il titolare i totali, chi non è di nessuno e i
-- numeri doppi. Il giro è la rotta /hooks/riepilogo-mattino: legge e basta,
-- non scrive sulle schede, non manda messaggi ai clienti. Una volta al giorno
-- anche se chiamata più volte (chiave del giorno in `notifications`).
--
-- ⚠️ pg_cron ragiona in UTC: '45 6 * * *' = 7:45 a Roma con l'ora solare,
--    8:45 con l'ora legale. Per spostarlo: rilanciare la riga sotto con un
--    altro orario (stesso nome = lo aggiorna).
-- ⚠️ SOLO AGGIUNTIVA: programma un cron con la funzione degli altri hook.
-- Come si spegne:  SELECT cron.unschedule('riepilogo-mattino-giornaliero');

SELECT public.programma_hook_cron('riepilogo-mattino-giornaliero', '45 6 * * *', '/hooks/riepilogo-mattino');
