-- E-commerce Hair Genius: ordini dello shop.
-- Insert aperto (checkout pubblico, come public_leads); lettura/gestione ai soli admin autenticati.
CREATE TABLE IF NOT EXISTS public.shop_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  order_ref TEXT NOT NULL,
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT NOT NULL,
  indirizzo TEXT NOT NULL,
  citta TEXT NOT NULL,
  cap TEXT NOT NULL,
  note TEXT,
  items JSONB NOT NULL DEFAULT '[]',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  shipping NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'nuovo'
);

ALTER TABLE public.shop_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can insert shop order" ON public.shop_orders;
CREATE POLICY "anyone can insert shop order"
  ON public.shop_orders FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated can read shop orders" ON public.shop_orders;
CREATE POLICY "authenticated can read shop orders"
  ON public.shop_orders FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "authenticated can update shop orders" ON public.shop_orders;
CREATE POLICY "authenticated can update shop orders"
  ON public.shop_orders FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_shop_orders_created_at ON public.shop_orders (created_at DESC);
