-- Richieste di preventivo dal configuratore "Custom Hair System".
-- Insert aperto (form pubblico); lettura/gestione ai soli admin autenticati.
CREATE TABLE IF NOT EXISTS public.quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  quote_ref TEXT NOT NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT NOT NULL,
  eta INTEGER,
  grey_pct INTEGER,
  color_code TEXT,
  problemi TEXT,
  note TEXT,
  base_choice TEXT,
  base_system JSONB,
  upsells JSONB NOT NULL DEFAULT '[]',
  discount_code TEXT,
  discount_eur NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'nuovo'
);

ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can insert quote" ON public.quote_requests;
CREATE POLICY "anyone can insert quote" ON public.quote_requests FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated can read quotes" ON public.quote_requests;
CREATE POLICY "authenticated can read quotes" ON public.quote_requests FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "authenticated can update quotes" ON public.quote_requests;
CREATE POLICY "authenticated can update quotes" ON public.quote_requests FOR UPDATE USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_quote_requests_created_at ON public.quote_requests (created_at DESC);
