ALTER TABLE public.public_leads
  ADD COLUMN IF NOT EXISTS slot_pending boolean NOT NULL DEFAULT false;