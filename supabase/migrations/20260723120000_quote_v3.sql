-- Preventivi v3: quantità, modalità rilievo misure, link corto, timeline, password modifica.

-- ── discount_codes: automatici + testi personalizzati ──
ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS auto_apply BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS apply_message TEXT,      -- testo mostrato quando il codice viene applicato
  ADD COLUMN IF NOT EXISTS scarcity_title TEXT,     -- titolo box scarsità (default "Disponibilità limitata")
  ADD COLUMN IF NOT EXISTS scarcity_text TEXT;      -- messaggio scarsità; placeholder {left} {total} {code}

-- ── quote_requests: quantità, modalità, timeline ──
ALTER TABLE public.quote_requests
  ADD COLUMN IF NOT EXISTS cognome TEXT,
  ADD COLUMN IF NOT EXISTS qty INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fitting_mode TEXT NOT NULL DEFAULT 'remoto',  -- 'remoto' | 'sede'
  ADD COLUMN IF NOT EXISTS timeline_start DATE,
  ADD COLUMN IF NOT EXISTS timeline_steps JSONB NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS idx_quote_requests_ref ON public.quote_requests (quote_ref);

-- ── configurazione app (password modifica preventivo, ecc.) ──
CREATE TABLE IF NOT EXISTS public.app_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth manage config" ON public.app_config;
CREATE POLICY "auth manage config" ON public.app_config FOR ALL
  USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
