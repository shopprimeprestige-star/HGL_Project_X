-- Aggiunge colonna capi_sent su public_leads per tracciare l'invio del Lead a Meta CAPI
ALTER TABLE public.public_leads
  ADD COLUMN IF NOT EXISTS capi_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS capi_sent_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_public_leads_capi_sent ON public.public_leads(capi_sent);
CREATE INDEX IF NOT EXISTS idx_public_leads_created_capi ON public.public_leads(created_at DESC, capi_sent);