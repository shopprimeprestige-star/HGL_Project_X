
-- public_leads: granular ad attribution
ALTER TABLE public.public_leads
  ADD COLUMN IF NOT EXISTS ad_id text,
  ADD COLUMN IF NOT EXISTS adset_id text,
  ADD COLUMN IF NOT EXISTS campaign_id text,
  ADD COLUMN IF NOT EXISTS ad_name text,
  ADD COLUMN IF NOT EXISTS creative_name text,
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE INDEX IF NOT EXISTS idx_public_leads_ad_id ON public.public_leads(ad_id);
CREATE INDEX IF NOT EXISTS idx_public_leads_external_id ON public.public_leads(external_id);

-- lp_events: granular ad attribution
ALTER TABLE public.lp_events
  ADD COLUMN IF NOT EXISTS ad_id text,
  ADD COLUMN IF NOT EXISTS adset_id text,
  ADD COLUMN IF NOT EXISTS campaign_id text,
  ADD COLUMN IF NOT EXISTS ad_name text,
  ADD COLUMN IF NOT EXISTS creative_name text,
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE INDEX IF NOT EXISTS idx_lp_events_ad_id ON public.lp_events(ad_id);
CREATE INDEX IF NOT EXISTS idx_lp_events_external_id ON public.lp_events(external_id);

-- tracking_config: Meta Ad Account ID for Marketing API
ALTER TABLE public.tracking_config
  ADD COLUMN IF NOT EXISTS meta_ad_account_id text;

-- meta_ad_spend: daily spend per ad, synced via Marketing API
CREATE TABLE IF NOT EXISTS public.meta_ad_spend (
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
  currency text DEFAULT 'EUR',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, spend_date, ad_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_ad_spend_user_date ON public.meta_ad_spend(user_id, spend_date);
CREATE INDEX IF NOT EXISTS idx_meta_ad_spend_ad ON public.meta_ad_spend(ad_id);

ALTER TABLE public.meta_ad_spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin select own meta ad spend"
  ON public.meta_ad_spend FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admin insert own meta ad spend"
  ON public.meta_ad_spend FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admin update own meta ad spend"
  ON public.meta_ad_spend FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admin delete own meta ad spend"
  ON public.meta_ad_spend FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
