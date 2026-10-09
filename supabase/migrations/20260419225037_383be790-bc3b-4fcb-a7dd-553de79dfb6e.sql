ALTER TABLE public.meta_ad_spend
  ADD COLUMN IF NOT EXISTS reach integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frequency numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_meta_ad_spend_user_date ON public.meta_ad_spend(user_id, spend_date);
CREATE INDEX IF NOT EXISTS idx_meta_ad_spend_ad ON public.meta_ad_spend(ad_id, spend_date);
CREATE INDEX IF NOT EXISTS idx_lp_events_ad_session ON public.lp_events(ad_id, session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_public_leads_session ON public.public_leads(ad_id, created_at);