ALTER TABLE public.public_leads
  ADD COLUMN IF NOT EXISTS touch_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS touch_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_channel text,
  ADD COLUMN IF NOT EXISTS last_channel text,
  ADD COLUMN IF NOT EXISTS journey_type text,
  ADD COLUMN IF NOT EXISTS days_to_convert integer,
  ADD COLUMN IF NOT EXISTS hours_to_convert integer;

CREATE INDEX IF NOT EXISTS idx_public_leads_journey_type ON public.public_leads(journey_type);
CREATE INDEX IF NOT EXISTS idx_public_leads_first_channel ON public.public_leads(first_channel);
CREATE INDEX IF NOT EXISTS idx_public_leads_last_channel ON public.public_leads(last_channel);