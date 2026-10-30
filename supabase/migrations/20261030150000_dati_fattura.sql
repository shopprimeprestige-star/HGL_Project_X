-- ── DATI PER LA FATTURA DOPO L'ACCONTO (30/10/2026) ─────────────────────────────
-- Commessa 2026-10-30-oggi-e-fatture, parte B. SOLO AGGIUNTIVA, NON APPLICATA DA CHI L'HA SCRITTA.
--   1. il bucket PRIVATO `dati-fattura` per le foto dei documenti che il cliente manda
--      (nessuna policy: ci scrive e legge solo la chiave di servizio; il CRM le mostra con
--      indirizzi firmati a scadenza breve, dietro il permesso «pagamenti»);
--   2. il cron `dati-fattura-5min` (stessa funzione degli altri hook). Il giro è SPENTO finché
--      il titolare non lo accende da Impostazioni: programmarlo non fa partire niente.
-- Nessuna fattura, incasso, costo o F24 viene toccato. Nessun UPDATE/DELETE.
-- Come si spegne:  SELECT cron.unschedule('dati-fattura-5min');

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('dati-fattura', 'dati-fattura', false, 10485760)
ON CONFLICT (id) DO NOTHING;

SELECT public.programma_hook_cron('dati-fattura-5min', '*/5 * * * *', '/hooks/dati-fattura');
