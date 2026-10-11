-- Codici sconto per il configuratore di preventivo, gestiti dal CRM.
-- Ogni codice ha un importo di sconto in € e una scarcity (disponibili / rimanenti).
CREATE TABLE IF NOT EXISTS public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  code TEXT NOT NULL UNIQUE,
  label TEXT,
  discount_eur NUMERIC NOT NULL DEFAULT 0,
  stock_total INTEGER,   -- quanti disponibili in totale (null = illimitato)
  stock_left INTEGER,    -- quanti ne rimangono
  active BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- Lettura pubblica solo dei codici attivi (per validare e mostrare la scarcity).
DROP POLICY IF EXISTS "public read active discount" ON public.discount_codes;
CREATE POLICY "public read active discount" ON public.discount_codes FOR SELECT USING (active = true);

-- Gestione completa ai soli admin autenticati.
DROP POLICY IF EXISTS "auth manage discount" ON public.discount_codes;
CREATE POLICY "auth manage discount" ON public.discount_codes FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON public.discount_codes (upper(code));
