-- ── RISPOSTE AI: «RISPIEGA CON AI» (30/10/2026) ──────────────────────────────
--
-- Richiesta del titolare: quando un cliente non capisce una risposta, nella chat
-- si sceglie la NOSTRA risposta e una o più domande del cliente, e il Mac scrive
-- una nuova spiegazione, più semplice e chiara, che va nella casella come bozza
-- (non si invia mai da sola). Stessa strada di «Rispondi con AI» (tabella
-- `wa_risposte_ai`, migrazioni 20261029200000 e 20261030100000), con un prompt
-- suo: la colonna `modo` dice quale dei due.
--
--   • 'rispondi' (di partenza): la risposta AI di sempre, e le bozze automatiche.
--   • 'rispiega': solo i testi scelti e il nome del cliente vanno al modello.
--
-- Solo un'aggiunta: una colonna con valore di partenza. Nessuna riga esistente
-- cambia, nessuna policy o funzione viene toccata (`risposte_ai_prendi`
-- restituisce `r.*`, quindi la colonna passa da sola). Si può rilanciare senza
-- danni (IF NOT EXISTS). I messaggi scelti restano al massimo 8, come prima.
--
-- SENZA QUESTA MIGRAZIONE «Rispondi con AI» funziona come sempre; «Rispiega con
-- AI» lo dice in chiaro (colonna mancante: 42703 / PGRST204) e non parte.
--
-- COME SI ANNULLA (le richieste restano):
--   ALTER TABLE public.wa_risposte_ai DROP COLUMN IF EXISTS modo;
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.wa_risposte_ai
  ADD COLUMN IF NOT EXISTS modo text NOT NULL DEFAULT 'rispondi'
  CHECK (modo IN ('rispondi', 'rispiega'));
