-- ─────────────────────────────────────────────────────────────────────────────
-- LA CHAT WHATSAPP VELOCE · INDICI PER LEGGERE UNA CHAT
--
-- Commessa 2026-10-30-chat-veloce. Dopo l'importazione dello storico (37.000+ righe
-- del ponte) aprire una chat legge i suoi messaggi con
--   WHERE user_id = … AND (from_number = '+39…' OR to_number = '+39…' OR from_number = '39…' OR to_number = '39…')
--   ORDER BY created_at DESC LIMIT 500
-- e l'unico indice utile era (from_number, to_number): le condizioni su `to_number` non lo
-- usavano, e il database scorreva tutte le righe dell'utente.
--
-- COSA AGGIUNGE (solo aggiunte, niente si cancella, nessuna colonna cambia)
--   · idx_wa_messages_user_from_creato (user_id, from_number, created_at DESC)
--   · idx_wa_messages_user_to_creato   (user_id, to_number,   created_at DESC)
--   Il database le unisce da solo (BitmapOr) per le quattro condizioni della chat.
--
-- ⚠️ Il codice pubblicato funziona anche SENZA questa migrazione (è solo più lento).
-- ⚠️ Applicarla due volte non fa danni (IF NOT EXISTS).
-- ⚠️ NON la lancia la squadra: la applica il titolare. Una `CREATE INDEX` normale blocca per
--    qualche secondo le scritture su whatsapp_messages mentre si costruisce (50-200k righe: pochi
--    secondi). Se si preferisce non bloccare niente, dall'editor SQL di Supabase (NON dentro una
--    transazione) si possono lanciare le due righe con `CREATE INDEX CONCURRENTLY IF NOT EXISTS`.
--
-- COME SI ANNULLA (solo se serve davvero):
--   DROP INDEX public.idx_wa_messages_user_from_creato;
--   DROP INDEX public.idx_wa_messages_user_to_creato;
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_wa_messages_user_from_creato
  ON public.whatsapp_messages (user_id, from_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_messages_user_to_creato
  ON public.whatsapp_messages (user_id, to_number, created_at DESC);
