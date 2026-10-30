-- ── RISPOSTE AI: BOZZE PRONTE E ORARI LIBERI (30/10/2026) ────────────────────
--
-- Due idee approvate dal titolare per la «Risposta AI» (tabella
-- `wa_risposte_ai`, migrazione 20261029200000):
--
--   • BOZZE PRONTE SU «DA RISPONDERE»: quando il Mac chiede lavoro e la coda è
--     vuota, la rotta può preparare UNA bozza per una chat che aspetta risposta.
--     La riga la crea il server e si riconosce da `automatica = true`; la chat
--     la mostra sopra la casella («Bozza AI pronta», «Usa», «Scarta»). Non
--     parte mai da sola.
--   • ORARI LIBERI NELLA RISPOSTA: il CRM scrive nella richiesta gli orari
--     liberi veri dei prossimi giorni (`orari`, una riga di testo), e il Mac li
--     mette nella domanda per Haiku, che può proporre solo quelli.
--
-- Solo aggiunte: due colonne con valore di partenza. Nessuna riga esistente
-- cambia, nessuna policy o funzione viene toccata (la funzione
-- `risposte_ai_prendi` restituisce `r.*`, quindi le colonne nuove passano da
-- sole). Si può rilanciare senza danni (IF NOT EXISTS).
--
-- SENZA QUESTA MIGRAZIONE tutto funziona come prima: il CRM chiede senza orari,
-- e la rotta non prepara bozze (colonna mancante: 42703 / PGRST204, tace).
--
-- COME SI ANNULLA (le due colonne si perdono; le richieste restano):
--   ALTER TABLE public.wa_risposte_ai DROP COLUMN IF EXISTS automatica;
--   ALTER TABLE public.wa_risposte_ai DROP COLUMN IF EXISTS orari;
-- ─────────────────────────────────────────────────────────────────────────────

-- true = bozza preparata dal server, non chiesta da una persona in chat
ALTER TABLE public.wa_risposte_ai
  ADD COLUMN IF NOT EXISTS automatica boolean NOT NULL DEFAULT false;

-- gli orari liberi veri dei prossimi giorni, in una riga («oggi 15:00, 17:30 · domani 10:00 …»)
ALTER TABLE public.wa_risposte_ai
  ADD COLUMN IF NOT EXISTS orari text CHECK (orari IS NULL OR char_length(orari) <= 600);
