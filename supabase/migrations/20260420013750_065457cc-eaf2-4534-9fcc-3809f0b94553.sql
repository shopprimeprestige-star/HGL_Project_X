ALTER TABLE public.tracking_config
  ADD COLUMN IF NOT EXISTS fatigue_freq_threshold numeric NOT NULL DEFAULT 3.5,
  ADD COLUMN IF NOT EXISTS fatigue_scroll_threshold integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS fatigue_time_threshold integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS fatigue_alerts_enabled boolean NOT NULL DEFAULT true;