-- ── «ATTESA WHATSAPP» → «DA CHIAMARE», OGNI 15 MINUTI (28/10/2026) ──────────
-- Richiesta del titolare: chi resta in «Attesa WhatsApp» più di 10 ore senza
-- rispondere passa da solo a «Da chiamare». Il giro è la rotta
-- /hooks/attesa-da-chiamare (scrive solo lo stato e la sua storia, e solo se la
-- scheda non è cambiata nel frattempo).
-- ⚠️ SOLO AGGIUNTIVA: programma un cron con la stessa funzione degli altri hook.
-- Come si spegne:  SELECT cron.unschedule('attesa-da-chiamare-15min');

SELECT public.programma_hook_cron('attesa-da-chiamare-15min', '*/15 * * * *', '/hooks/attesa-da-chiamare');
