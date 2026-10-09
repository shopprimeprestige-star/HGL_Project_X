ALTER TABLE public.tracking_config 
ADD COLUMN IF NOT EXISTS margine_profitto_pct NUMERIC NOT NULL DEFAULT 40;

COMMENT ON COLUMN public.tracking_config.margine_profitto_pct IS 'Margine di profitto % usato per calcolare il Break-even ROAS teorico (1 / margine).';