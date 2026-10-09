
CREATE TABLE public.notification_prefs (
  user_id UUID NOT NULL PRIMARY KEY,
  muted_kinds TEXT[] NOT NULL DEFAULT '{}',
  lps_min_threshold NUMERIC NOT NULL DEFAULT 4,
  cpl_over_budget_pct NUMERIC NOT NULL DEFAULT 30,
  no_lead_hours INTEGER NOT NULL DEFAULT 24,
  email_target TEXT,
  email_critical_enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own notif prefs" ON public.notification_prefs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users insert own notif prefs" ON public.notification_prefs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own notif prefs" ON public.notification_prefs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own notif prefs" ON public.notification_prefs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
