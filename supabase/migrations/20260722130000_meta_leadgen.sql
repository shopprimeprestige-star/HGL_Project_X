-- Meta Lead Ads (leadgen) — credenziali per-utente sul tracking_config.
-- Il webhook /api/public/meta-leadgen-webhook risolve il tenant dal meta_page_id,
-- verifica la firma con meta_app_secret e scarica il lead con meta_page_access_token.
ALTER TABLE public.tracking_config
  ADD COLUMN IF NOT EXISTS meta_page_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_page_access_token TEXT,
  ADD COLUMN IF NOT EXISTS meta_leadgen_verify_token TEXT,
  ADD COLUMN IF NOT EXISTS meta_app_secret TEXT;

-- Indice per lookup veloce del tenant dal page_id in arrivo dal webhook.
CREATE INDEX IF NOT EXISTS idx_tracking_config_meta_page_id
  ON public.tracking_config (meta_page_id);
