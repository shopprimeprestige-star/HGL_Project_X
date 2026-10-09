
-- Mappa stato lead → nome template WA approvato e valori default per popup quick-action.
ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS status_template_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS default_values jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.whatsapp_settings.status_template_map IS
  'Mappa { leadStatus: { name: string, lang: string } } usata per inviare template WA in base allo stato del lead.';
COMMENT ON COLUMN public.whatsapp_settings.default_values IS
  'Valori default per popup quick-action lead (acconto, vendita, prodotto, taglio, costi installazione ecc).';
