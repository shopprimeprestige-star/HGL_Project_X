ALTER TABLE public.funnel_settings
  ADD COLUMN IF NOT EXISTS slots_mode text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS weekly_slots jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.funnel_settings
  DROP CONSTRAINT IF EXISTS funnel_settings_slots_mode_check;
ALTER TABLE public.funnel_settings
  ADD CONSTRAINT funnel_settings_slots_mode_check CHECK (slots_mode IN ('daily','weekly'));