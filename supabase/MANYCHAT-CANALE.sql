-- ─────────────────────────────────────────────────────────────────────────────
-- MANYCHAT · METTI IL CANALE SU «manychat» E COLLEGA IL FLUSSO DELLA CONFERMA
--
-- Questo NON è una migrazione: la lancia il titolare a mano, dopo averla letta,
-- nell'editor SQL di Supabase, SOLO dopo:
--   1. la migrazione 20261023120000_manychat_base.sql,
--   2. il codice pubblicato,
--   3. i due segreti di ManyChat messi sul sito (la chiave dell'area di lavoro e
--      quella del ritorno delle risposte),
--   4. il modello «consulenza_conferma_presenza» approvato dentro ManyChat e il
--      flusso «CRM · Conferma consulenza» creato (modello + attesa della
--      risposta + External Request).
--
-- COSA FA: scrive la riga unica di configurazione (id = 1). Da quel momento la
-- porta degli invii WhatsApp passa da ManyChat. Non accende nessun interruttore
-- del promemoria 25' né dei ricontatti (restano spenti).
--
-- L'ns del flusso lo copi da ManyChat (non è un segreto) e lo scrivi al posto di
-- <ns del flusso>, senza lasciare le parentesi. Se lo cambi, rilancia
-- questa riga: il flusso nuovo sostituisce quello vecchio con lo stesso nome e
-- gli altri flussi restano.
--
-- PRIMA: guarda quante installazioni ci sono. Se la query dice una riga sola,
-- vai avanti; se ne dice di più, scegli tu l'user_id giusto e scrivilo al posto
-- della sottoquery:
--   SELECT user_id, created_at FROM public.whatsapp_settings ORDER BY created_at;
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO public.manychat_config (id, user_id, canale, flussi, aggiornato_da)
VALUES (
  1,
  (SELECT user_id FROM public.whatsapp_settings ORDER BY created_at LIMIT 1),
  'manychat',
  '{"consulenza_conferma_presenza":"<ns del flusso>"}'::jsonb,
  'sql titolare'
)
ON CONFLICT (id) DO UPDATE
   SET canale = excluded.canale,
       user_id = coalesce(public.manychat_config.user_id, excluded.user_id),
       flussi = public.manychat_config.flussi || excluded.flussi,
       aggiornato_da = excluded.aggiornato_da,
       aggiornato_il = now();

-- PER TORNARE INDIETRO (la porta torna sulla Cloud API; non cancella niente):
--   UPDATE public.manychat_config SET canale = 'cloud' WHERE id = 1;
