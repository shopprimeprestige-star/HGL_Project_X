-- ─────────────────────────────────────────────────────────────────────────────
-- CRUSCOTTO WHATSAPP · le impostazioni (pacchetto p4-cruscotto-wa, 30/10/2026)
--
-- SOLO UNA TABELLA NUOVA, niente tocca i dati esistenti (lead, messaggi, invii,
-- spese): il cruscotto li legge e basta. Qui stanno le due cose che il titolare
-- può cambiare dalla pagina:
--   · le tariffe stimate dei messaggi a pagamento (€ a messaggio, Marketing e
--     Utility); vuote = valgono quelle di listino Meta Italia scritte nel codice
--     (src/crm/chatwa/costi-whatsapp.ts);
--   · i minuti oltre i quali un lead nuovo senza risposta è «in ritardo» (10 di serie).
--
-- ⚠️ TABELLA CHIUSA: RLS accesa, nessuna policy, tolto tutto ad anon e
--    authenticated. La legge e la scrive solo il server (chiave di servizio), dietro
--    `guardiaCRM`.
-- ⚠️ Il codice funziona anche SENZA questa migrazione: la pagina usa i valori di
--    serie e, provando a salvare, dice «manca l'aggiornamento del database».
-- ⚠️ Applicarla due volte non fa danni (IF NOT EXISTS). NON la lancia la squadra:
--    la applica il capo progetto con l'OK del titolare.
--
-- COME SI ANNULLA (solo se serve davvero; si perdono solo le due impostazioni):
--   DROP TABLE public.cruscotto_wa_impostazioni;
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cruscotto_wa_impostazioni (
  user_id           uuid PRIMARY KEY,
  tariffa_marketing numeric(8, 5) CHECK (tariffa_marketing IS NULL OR (tariffa_marketing >= 0 AND tariffa_marketing <= 5)),
  tariffa_utility   numeric(8, 5) CHECK (tariffa_utility IS NULL OR (tariffa_utility >= 0 AND tariffa_utility <= 5)),
  soglia_minuti     integer CHECK (soglia_minuti IS NULL OR (soglia_minuti >= 1 AND soglia_minuti <= 240)),
  aggiornato_il     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cruscotto_wa_impostazioni ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.cruscotto_wa_impostazioni FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.cruscotto_wa_impostazioni TO service_role;
