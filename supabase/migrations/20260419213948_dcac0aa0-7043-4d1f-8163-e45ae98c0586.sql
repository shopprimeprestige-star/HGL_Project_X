-- Estensione tracking full-stack: parametri Meta + UTM granulari + qualità landing

-- 1) public_leads: aggiungi fbclid, utm_id (campaign), utm_content (ad), utm_term (adset)
ALTER TABLE public.public_leads
  ADD COLUMN IF NOT EXISTS fbclid text,
  ADD COLUMN IF NOT EXISTS utm_id text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text;

-- 2) lp_events: aggiungi fbclid, fbc, fbp, utm_id/content/term, time_on_page, max_scroll, capi_sent
ALTER TABLE public.lp_events
  ADD COLUMN IF NOT EXISTS fbclid text,
  ADD COLUMN IF NOT EXISTS fbc text,
  ADD COLUMN IF NOT EXISTS fbp text,
  ADD COLUMN IF NOT EXISTS utm_id text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS time_on_page integer,
  ADD COLUMN IF NOT EXISTS max_scroll integer,
  ADD COLUMN IF NOT EXISTS capi_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS user_agent text;

-- 3) Indici per analytics Ads Manager: query rapide per ad_id e per evento
CREATE INDEX IF NOT EXISTS idx_lp_events_ad_id ON public.lp_events(ad_id) WHERE ad_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lp_events_event_name ON public.lp_events(event_name);
CREATE INDEX IF NOT EXISTS idx_lp_events_created_at ON public.lp_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_leads_ad_id ON public.public_leads(ad_id) WHERE ad_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_public_leads_created_at ON public.public_leads(created_at DESC);