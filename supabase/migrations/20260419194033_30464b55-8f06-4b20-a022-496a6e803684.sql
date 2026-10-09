-- 1) Aggiungi costo_prodotto a tracking_config
ALTER TABLE public.tracking_config
ADD COLUMN IF NOT EXISTS costo_prodotto numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.tracking_config.costo_prodotto IS 'Costo unitario del prodotto/servizio (es. costo protesi). Usato per Break-even reale: ricavo - costo_prodotto - spesa_ads';

-- 2) Indici per query veloci sulle spese Meta per range date
CREATE INDEX IF NOT EXISTS idx_meta_ad_spend_user_date 
  ON public.meta_ad_spend(user_id, spend_date DESC);

CREATE INDEX IF NOT EXISTS idx_meta_ad_spend_user_ad_date 
  ON public.meta_ad_spend(user_id, ad_id, spend_date);

-- 3) Constraint unico per upsert atomico (user_id, spend_date, ad_id)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'meta_ad_spend_user_date_ad_unique'
  ) THEN
    ALTER TABLE public.meta_ad_spend
    ADD CONSTRAINT meta_ad_spend_user_date_ad_unique 
    UNIQUE (user_id, spend_date, ad_id);
  END IF;
END $$;