ALTER TABLE public.tracking_config
  ADD COLUMN IF NOT EXISTS tiktok_test_event_code text,
  ADD COLUMN IF NOT EXISTS tiktok_ads_history_start date;