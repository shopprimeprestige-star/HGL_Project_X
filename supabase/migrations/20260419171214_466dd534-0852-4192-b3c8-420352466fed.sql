ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS can_accept_leads boolean NOT NULL DEFAULT true;

-- Backfill: admin sempre true, gli altri ereditano lo stato attuale (true di default)
UPDATE public.user_settings SET can_accept_leads = true WHERE is_admin = true;