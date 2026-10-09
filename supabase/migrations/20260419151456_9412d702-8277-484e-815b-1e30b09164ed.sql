-- user_settings: permessi e accesso schede per ogni utente del CRM
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin boolean NOT NULL DEFAULT false,
  scheme_access text[] NOT NULL DEFAULT ARRAY['dashboard']::text[],
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Funzione security-definer per evitare ricorsione RLS
CREATE OR REPLACE FUNCTION public.is_app_admin(_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_settings
    WHERE user_id = _user AND is_admin = true
  );
$$;

-- Ogni utente legge il proprio record
CREATE POLICY "users read own settings"
ON public.user_settings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Admin legge tutti
CREATE POLICY "admins read all settings"
ON public.user_settings
FOR SELECT
TO authenticated
USING (public.is_app_admin(auth.uid()));

-- Insert: ogni utente può creare il proprio record (bootstrap)
CREATE POLICY "users insert own settings"
ON public.user_settings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Update: ogni utente può aggiornare il proprio display_name
-- (admin può aggiornare tutto)
CREATE POLICY "users update own settings"
ON public.user_settings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND is_admin = (SELECT is_admin FROM public.user_settings WHERE user_id = auth.uid()));

CREATE POLICY "admins update any settings"
ON public.user_settings
FOR UPDATE
TO authenticated
USING (public.is_app_admin(auth.uid()))
WITH CHECK (public.is_app_admin(auth.uid()));

-- Delete solo admin
CREATE POLICY "admins delete settings"
ON public.user_settings
FOR DELETE
TO authenticated
USING (public.is_app_admin(auth.uid()));

-- Trigger updated_at
CREATE TRIGGER trg_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();