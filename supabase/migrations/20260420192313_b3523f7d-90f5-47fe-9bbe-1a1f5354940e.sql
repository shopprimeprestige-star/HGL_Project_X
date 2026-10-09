-- Group 3: tabella tiktok_ad_spend (gemella di meta_ad_spend) per sync con TikTok Business API
CREATE TABLE public.tiktok_ad_spend (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  spend_date date NOT NULL,
  ad_id text NOT NULL,
  adset_id text,
  campaign_id text,
  ad_name text,
  campaign_name text,
  spend numeric NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  reach integer NOT NULL DEFAULT 0,
  frequency numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'EUR',
  -- Video metrics (TikTok native)
  video_views integer NOT NULL DEFAULT 0,
  video_views_p25 integer NOT NULL DEFAULT 0,
  video_views_p50 integer NOT NULL DEFAULT 0,
  video_views_p75 integer NOT NULL DEFAULT 0,
  video_views_p100 integer NOT NULL DEFAULT 0,
  video_play_actions integer NOT NULL DEFAULT 0,
  video_watched_2s integer NOT NULL DEFAULT 0,
  video_watched_6s integer NOT NULL DEFAULT 0,
  average_video_play numeric NOT NULL DEFAULT 0,
  -- Engagement
  likes integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  follows integer NOT NULL DEFAULT 0,
  profile_visits integer NOT NULL DEFAULT 0,
  -- Conversions
  conversions integer NOT NULL DEFAULT 0,
  cost_per_conversion numeric NOT NULL DEFAULT 0,
  conversion_rate numeric NOT NULL DEFAULT 0,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tiktok_ad_spend_unique_daily UNIQUE (user_id, ad_id, spend_date)
);

CREATE INDEX idx_tiktok_ad_spend_user_date ON public.tiktok_ad_spend (user_id, spend_date DESC);
CREATE INDEX idx_tiktok_ad_spend_ad ON public.tiktok_ad_spend (ad_id);

ALTER TABLE public.tiktok_ad_spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin select own tiktok ad spend"
  ON public.tiktok_ad_spend FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admin insert own tiktok ad spend"
  ON public.tiktok_ad_spend FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admin update own tiktok ad spend"
  ON public.tiktok_ad_spend FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admin delete own tiktok ad spend"
  ON public.tiktok_ad_spend FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Group 2: aggiungi colonne per spesa manuale TikTok e Organico (override opzionali)
ALTER TABLE public.tracking_config
  ADD COLUMN IF NOT EXISTS daily_spend_organico numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tiktok_advertiser_id text;
