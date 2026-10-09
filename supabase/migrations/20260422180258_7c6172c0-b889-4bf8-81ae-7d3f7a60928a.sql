CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
  user_id uuid PRIMARY KEY,
  phone_number_id text,
  business_account_id text,
  access_token text,
  webhook_verify_token text,
  app_secret text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users view own whatsapp settings"
  ON public.whatsapp_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own whatsapp settings"
  ON public.whatsapp_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own whatsapp settings"
  ON public.whatsapp_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "users delete own whatsapp settings"
  ON public.whatsapp_settings FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_whatsapp_settings_updated_at
  BEFORE UPDATE ON public.whatsapp_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();