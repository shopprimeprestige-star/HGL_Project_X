ALTER TABLE public.meta_ad_spend
  ADD COLUMN IF NOT EXISTS video_3_sec_watched integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_15_sec_watched integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_avg_time_watched numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_continuous_2_sec_watched integer NOT NULL DEFAULT 0;