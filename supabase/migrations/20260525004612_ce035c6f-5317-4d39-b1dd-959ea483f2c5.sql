
-- Landing content (single global row, public read)
CREATE TABLE IF NOT EXISTS public.landing_content (
  id text PRIMARY KEY DEFAULT 'default',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.landing_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads landing content"
  ON public.landing_content FOR SELECT
  USING (true);

CREATE POLICY "authenticated insert landing content"
  ON public.landing_content FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "authenticated update landing content"
  ON public.landing_content FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

INSERT INTO public.landing_content (id, data) VALUES ('default', '{}'::jsonb)
  ON CONFLICT (id) DO NOTHING;

-- Storage bucket for landing media
INSERT INTO storage.buckets (id, name, public)
  VALUES ('landing-media', 'landing-media', true)
  ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read landing media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'landing-media');

CREATE POLICY "authenticated upload landing media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'landing-media');

CREATE POLICY "authenticated update landing media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'landing-media');

CREATE POLICY "authenticated delete landing media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'landing-media');
