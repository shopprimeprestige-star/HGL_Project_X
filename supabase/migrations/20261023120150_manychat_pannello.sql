-- ─────────────────────────────────────────────────────────────────────────────
-- WHATSAPP CON MANYCHAT · IL RIQUADRO (compito 4)
--
-- Commessa 2026-10-23. Una sola aggiunta: la colonna dove il riquadro in
-- Impostazioni → WhatsApp ricorda l'ultimo «Collegamento ok» e l'esito della
-- «Prova creazione contatto». Contiene solo righe di stato (frasi e date): mai
-- chiavi, mai numeri di telefono, mai nomi.
--
-- Sta in manychat_config (e non in manychat_giro.stato) perché quello lo
-- riscrive il giro a ogni minuto.
--
-- ⚠️ ORDINE: dopo 20261023120000_manychat_base.sql (serve manychat_config).
-- ⚠️ Applicarla due volte non fa danni (IF NOT EXISTS). Senza questa colonna il
--    riquadro funziona lo stesso: il risultato della prova si vede ma non si
--    ricorda alla riga di prima.
-- ⚠️ La tabella resta chiusa (RLS accesa, nessuna policy, tolto tutto ad anon e
--    authenticated da M1): la colonna nuova eredita le stesse chiusure.
--
-- COME SI ANNULLA (non serve quasi mai):
--   ALTER TABLE public.manychat_config DROP COLUMN controlli;
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.manychat_config ADD COLUMN IF NOT EXISTS controlli jsonb NOT NULL DEFAULT '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
