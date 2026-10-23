-- ─────────────────────────────────────────────────────────────────────────────
-- WHATSAPP CON MANYCHAT · IL CRON DEL GIRO (M3, per ULTIMA)
--
-- Commessa 2026-10-23. Fa partire ogni minuto il giro dei promemoria 25' e dei
-- ricontatti (`/hooks/manychat-giro`). Usa `programma_hook_cron_attesa` nata in
-- M1: pg_net aspetta 45 secondi la risposta (con i 5 di serie il giro verrebbe
-- tagliato a metà).
--
-- ⚠️ DA LANCIARE PER ULTIMA, solo dopo: M1, M2, la pubblicazione del codice con
--    la rotta /hooks/manychat-giro, i segreti, e le righe di configurazione.
--    Anche con il cron acceso NON parte niente finché i tre interruttori in
--    Impostazioni → WhatsApp → «WhatsApp con ManyChat» sono spenti (di serie).
-- ⚠️ Serve `cron_sito` e `cron_chiave` in app_config, come tutti gli altri
--    lavori: se mancano non programma niente e lo dice.
-- ⚠️ Rilanciarla non fa danni: stesso nome del lavoro, `cron.schedule` lo aggiorna.
--
-- ⚠️ IN PIÙ: RIPETE il riempimento di `risposta_il` di M2. L'ordine di messa in
--    opera è «M2, pubblicazione, M3»: le conferme a cui il cliente risponde fra
--    M2 e la pubblicazione restano senza `risposta_il` (il codice vecchio non lo
--    scrive), e all'accensione il freno «mai due volte senza risposta» bloccherebbe
--    il promemoria proprio a chi ha risposto «SÌ». Lo stesso UPDATE di M2: tocca
--    solo righe con `risposta_il` vuoto, non cancella niente, rilanciarlo non cambia
--    nulla. Va PRIMA della riga di cron.
--
-- PER VEDERLO GIRARE (ultime 10 esecuzioni):
--   SELECT status, return_message, start_time FROM cron.job_run_details
--    WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'manychat-giro-1min')
--    ORDER BY start_time DESC LIMIT 10;
--
-- PER SPEGNERLO (il giro smette di essere chiamato; non cancella niente):
--   SELECT cron.unschedule('manychat-giro-1min');
-- ─────────────────────────────────────────────────────────────────────────────

-- Le risposte arrivate fra M2 e la pubblicazione (vedi sopra).
UPDATE public.manychat_invii i
   SET risposta_il = r.primo
  FROM (
    SELECT i2.id, min(w.created_at) AS primo
      FROM public.manychat_invii i2
      JOIN public.whatsapp_messages w
        ON w.user_id = i2.user_id
       AND w.direction = 'inbound'
       AND ltrim(w.from_number, '+') = i2.telefono
       AND w.created_at > coalesce(i2.inviato_il, i2.prenotato_il)
       AND w.created_at <= coalesce(i2.inviato_il, i2.prenotato_il) + interval '7 days'
     WHERE i2.risposta_il IS NULL
       AND i2.stato IN ('inviato', 'incerto')
     GROUP BY i2.id
  ) r
 WHERE i.id = r.id
   AND i.risposta_il IS NULL;

-- Il cron del giro.
SELECT public.programma_hook_cron_attesa('manychat-giro-1min', '* * * * *', '/hooks/manychat-giro', 45000);
