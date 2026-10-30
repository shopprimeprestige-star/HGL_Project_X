-- ── ASSENZA ALLA CONSULENZA → «DA RIPROGRAMMARE», OGNI 5 MINUTI (30/10/2026) ──
-- Commessa 2026-10-30 (ottimizzazioni), pacchetto p5-consulenze, punto (12).
-- 15 minuti dopo l'inizio, se nessuno ha bussato alla stanza Meetly della
-- consulenza, la scheda passa da sola a «Da riprogrammare». Il giro è la rotta
-- /hooks/assenza-meet (regola in src/crm/manychat/consulenze.ts, provata): scrive
-- solo stato, sua storia, una riga di nota e il segno `assenzaAuto`, e solo se la
-- scheda non è cambiata nel frattempo. Il messaggio lo manda il giro ManyChat col
-- modello dello stato (hgl_da_riprogrammare), se il suo interruttore è acceso.
-- ⚠️ SOLO AGGIUNTIVA: programma un cron con la stessa funzione degli altri hook.
--   Questo cron È l'interruttore: finché non c'è, niente si sposta da solo.
-- Come si spegne:  SELECT cron.unschedule('assenza-meet-5min');

SELECT public.programma_hook_cron('assenza-meet-5min', '*/5 * * * *', '/hooks/assenza-meet');
