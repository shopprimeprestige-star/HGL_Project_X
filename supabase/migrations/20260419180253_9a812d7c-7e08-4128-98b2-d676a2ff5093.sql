-- Tabella tassi di cambio rispetto a EUR (base = EUR, da Frankfurter API)
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rate_date DATE NOT NULL,
  currency TEXT NOT NULL,
  rate_vs_eur NUMERIC NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rate_date, currency)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_currency ON public.exchange_rates (currency);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON public.exchange_rates (rate_date DESC);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Lettura pubblica (i tassi non sono dati sensibili)
CREATE POLICY "anyone can read exchange rates"
ON public.exchange_rates
FOR SELECT
USING (true);

-- Scrittura: nessuno via client (solo edge function/cron via service role bypassa RLS)
CREATE POLICY "no client writes on exchange rates"
ON public.exchange_rates
FOR ALL
USING (false)
WITH CHECK (false);