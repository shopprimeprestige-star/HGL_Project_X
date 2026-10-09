CREATE TABLE public.ad_score_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ad_id TEXT NOT NULL,
  snapshot_date DATE NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  sub_scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, ad_id, snapshot_date)
);

CREATE INDEX idx_ad_score_history_user_ad_date ON public.ad_score_history(user_id, ad_id, snapshot_date DESC);

ALTER TABLE public.ad_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users select own ad score history"
ON public.ad_score_history FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "users insert own ad score history"
ON public.ad_score_history FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own ad score history"
ON public.ad_score_history FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own ad score history"
ON public.ad_score_history FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE TRIGGER update_ad_score_history_updated_at
BEFORE UPDATE ON public.ad_score_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();