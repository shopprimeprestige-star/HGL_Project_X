-- ── IL CONTO DELLA CORNETTA ANCHE PER I NUMERI SENZA SCHEDA (04/11/2026) ──
-- Segnalazione del titolare: un numero senza scheda contava le chiamate solo
-- dalla seconda volta. Il conto stava solo sulla scheda (crm_leads.data.chiamate):
-- il primo tocco, prima che la scheda esistesse, si perdeva.
-- Adesso il conto sta anche sul contatto WhatsApp e passa alla scheda quando si crea.
-- Solo aggiuntiva: una colonna nuova, vuota, niente dati toccati.
ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS chiamate jsonb;
