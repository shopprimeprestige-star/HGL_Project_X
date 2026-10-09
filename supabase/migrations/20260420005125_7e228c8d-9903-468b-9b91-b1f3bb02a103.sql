-- ============================================================
-- MIGRATION 1: tabelle CRM admin (crm_leads, crm_consultants, crm_ad_spending, consultant_pins, consultant_google_tokens)
-- ============================================================
create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_consultants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_ad_spending (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.consultant_pins (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete cascade,
  consultant_id uuid not null references public.crm_consultants(id) on delete cascade,
  pin text not null unique,
  permissions jsonb not null default '{
    "canChangeStatus": true,
    "canChangeTime": true,
    "canAddNotes": true,
    "canAddPostCallNotes": true,
    "canChangePayment": false,
    "canDeleteLead": false,
    "canAddLead": false
  }'::jsonb,
  commission_percentage numeric not null default 10,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.consultant_google_tokens (
  id uuid primary key default gen_random_uuid(),
  consultant_id uuid not null references public.crm_consultants(id) on delete cascade,
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_crm_leads_user on public.crm_leads(user_id);
create index if not exists idx_crm_consultants_user on public.crm_consultants(user_id);
create index if not exists idx_crm_ad_spending_user on public.crm_ad_spending(user_id);
create index if not exists idx_consultant_pins_admin on public.consultant_pins(admin_user_id);
create index if not exists idx_consultant_pins_active on public.consultant_pins(active) where active = true;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_crm_leads_updated on public.crm_leads;
create trigger trg_crm_leads_updated before update on public.crm_leads
for each row execute function public.set_updated_at();

drop trigger if exists trg_crm_consultants_updated on public.crm_consultants;
create trigger trg_crm_consultants_updated before update on public.crm_consultants
for each row execute function public.set_updated_at();

drop trigger if exists trg_crm_ad_spending_updated on public.crm_ad_spending;
create trigger trg_crm_ad_spending_updated before update on public.crm_ad_spending
for each row execute function public.set_updated_at();

drop trigger if exists trg_consultant_google_tokens_updated on public.consultant_google_tokens;
create trigger trg_consultant_google_tokens_updated before update on public.consultant_google_tokens
for each row execute function public.set_updated_at();

alter table public.crm_leads enable row level security;
alter table public.crm_consultants enable row level security;
alter table public.crm_ad_spending enable row level security;
alter table public.consultant_pins enable row level security;
alter table public.consultant_google_tokens enable row level security;

drop policy if exists "admin_select_leads" on public.crm_leads;
create policy "admin_select_leads" on public.crm_leads for select using (auth.uid() = user_id);
drop policy if exists "admin_insert_leads" on public.crm_leads;
create policy "admin_insert_leads" on public.crm_leads for insert with check (auth.uid() = user_id);
drop policy if exists "admin_update_leads" on public.crm_leads;
create policy "admin_update_leads" on public.crm_leads for update using (auth.uid() = user_id);
drop policy if exists "admin_delete_leads" on public.crm_leads;
create policy "admin_delete_leads" on public.crm_leads for delete using (auth.uid() = user_id);

drop policy if exists "admin_select_consultants" on public.crm_consultants;
create policy "admin_select_consultants" on public.crm_consultants for select using (auth.uid() = user_id);
drop policy if exists "admin_insert_consultants" on public.crm_consultants;
create policy "admin_insert_consultants" on public.crm_consultants for insert with check (auth.uid() = user_id);
drop policy if exists "admin_update_consultants" on public.crm_consultants;
create policy "admin_update_consultants" on public.crm_consultants for update using (auth.uid() = user_id);
drop policy if exists "admin_delete_consultants" on public.crm_consultants;
create policy "admin_delete_consultants" on public.crm_consultants for delete using (auth.uid() = user_id);

drop policy if exists "admin_select_ads" on public.crm_ad_spending;
create policy "admin_select_ads" on public.crm_ad_spending for select using (auth.uid() = user_id);
drop policy if exists "admin_insert_ads" on public.crm_ad_spending;
create policy "admin_insert_ads" on public.crm_ad_spending for insert with check (auth.uid() = user_id);
drop policy if exists "admin_update_ads" on public.crm_ad_spending;
create policy "admin_update_ads" on public.crm_ad_spending for update using (auth.uid() = user_id);
drop policy if exists "admin_delete_ads" on public.crm_ad_spending;
create policy "admin_delete_ads" on public.crm_ad_spending for delete using (auth.uid() = user_id);

drop policy if exists "admin_manage_pins" on public.consultant_pins;
create policy "admin_manage_pins" on public.consultant_pins
  for all using (auth.uid() = admin_user_id) with check (auth.uid() = admin_user_id);

drop policy if exists "deny_all_google_tokens" on public.consultant_google_tokens;
create policy "deny_all_google_tokens" on public.consultant_google_tokens
  for all to authenticated, anon
  using (false) with check (false);

-- ============================================================
-- MIGRATION 2: tabelle pubbliche (landing) — public_leads, lp_events, tracking_config, consultant_applications, lead_google_events, funnel_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.public_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT NOT NULL,
  citta TEXT NOT NULL,
  data_slot DATE,
  ora_slot TEXT,
  disagio_score INTEGER CHECK (disagio_score BETWEEN 1 AND 10),
  pain_points TEXT[] NOT NULL DEFAULT '{}',
  urgenza TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  fbp TEXT,
  fbc TEXT,
  ttclid TEXT,
  ip_hash TEXT,
  user_agent TEXT,
  event_id TEXT,
  status TEXT NOT NULL DEFAULT 'nuovo',
  assigned_to_user_id UUID,
  assigned_consultant_id UUID,
  meet_link TEXT,
  notes TEXT,
  slot_released BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.public_leads
  DROP CONSTRAINT IF EXISTS public_leads_urgenza_check;
ALTER TABLE public.public_leads
  ADD CONSTRAINT public_leads_urgenza_check
  CHECK (urgenza IS NULL OR urgenza = ANY (ARRAY['subito','1mese','convince','2_3mesi','valuto','si','valutando']::text[]));

ALTER TABLE public.public_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can insert public lead" ON public.public_leads;
CREATE POLICY "anyone can insert public lead"
  ON public.public_leads FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read slot availability" ON public.public_leads;
CREATE POLICY "Anyone can read slot availability"
  ON public.public_leads FOR SELECT USING (true);

DROP POLICY IF EXISTS "authenticated admins update public leads" ON public.public_leads;
CREATE POLICY "authenticated admins update public leads"
  ON public.public_leads FOR UPDATE TO authenticated
  USING (assigned_to_user_id IS NULL OR assigned_to_user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated admins delete public leads" ON public.public_leads;
CREATE POLICY "authenticated admins delete public leads"
  ON public.public_leads FOR DELETE TO authenticated
  USING (assigned_to_user_id IS NULL OR assigned_to_user_id = auth.uid());

DROP TRIGGER IF EXISTS public_leads_updated_at ON public.public_leads;
CREATE TRIGGER public_leads_updated_at
  BEFORE UPDATE ON public.public_leads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DO $wrap$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.public_leads; EXCEPTION WHEN duplicate_object THEN NULL; END $wrap$;

CREATE INDEX IF NOT EXISTS public_leads_created_at_idx ON public.public_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS public_leads_status_idx ON public.public_leads (status);
CREATE INDEX IF NOT EXISTS public_leads_slot_lookup
  ON public.public_leads (data_slot, ora_slot)
  WHERE slot_released = false;

CREATE TABLE IF NOT EXISTS public.lp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_name TEXT NOT NULL,
  session_id TEXT NOT NULL,
  step INTEGER,
  payload JSONB NOT NULL DEFAULT '{}',
  utm_source TEXT,
  ip_hash TEXT,
  city TEXT,
  device TEXT,
  is_bot BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.lp_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can insert lp event" ON public.lp_events;
CREATE POLICY "anyone can insert lp event"
  ON public.lp_events FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated admins read lp events" ON public.lp_events;
CREATE POLICY "authenticated admins read lp events"
  ON public.lp_events FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated admins delete lp events" ON public.lp_events;
CREATE POLICY "authenticated admins delete lp events"
  ON public.lp_events FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS lp_events_session_idx ON public.lp_events (session_id);
CREATE INDEX IF NOT EXISTS lp_events_created_idx ON public.lp_events (created_at DESC);
CREATE INDEX IF NOT EXISTS lp_events_created_at_idx ON public.lp_events (created_at DESC);
CREATE INDEX IF NOT EXISTS lp_events_is_bot_idx ON public.lp_events (is_bot);
CREATE INDEX IF NOT EXISTS lp_events_session_id_idx ON public.lp_events (session_id);

CREATE TABLE IF NOT EXISTS public.tracking_config (
  user_id UUID PRIMARY KEY,
  meta_pixel_id TEXT,
  meta_access_token TEXT,
  meta_test_event_code TEXT,
  tiktok_pixel_id TEXT,
  tiktok_access_token TEXT,
  daily_spend_meta NUMERIC NOT NULL DEFAULT 0,
  daily_spend_tiktok NUMERIC NOT NULL DEFAULT 0,
  iva_included BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tracking_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin manage own tracking config" ON public.tracking_config;
CREATE POLICY "admin manage own tracking config"
  ON public.tracking_config FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS tracking_config_updated_at ON public.tracking_config;
CREATE TRIGGER tracking_config_updated_at
  BEFORE UPDATE ON public.tracking_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.consultant_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  email text NOT NULL,
  telefono text,
  citta text,
  esperienza text,
  motivazione text,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  consultant_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.consultant_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_can_apply" ON public.consultant_applications;
CREATE POLICY "anyone_can_apply"
ON public.consultant_applications FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "admins_read_applications" ON public.consultant_applications;
CREATE POLICY "admins_read_applications"
ON public.consultant_applications FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "admins_update_applications" ON public.consultant_applications;
CREATE POLICY "admins_update_applications"
ON public.consultant_applications FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "admins_delete_applications" ON public.consultant_applications;
CREATE POLICY "admins_delete_applications"
ON public.consultant_applications FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS consultant_applications_updated_at ON public.consultant_applications;
CREATE TRIGGER consultant_applications_updated_at
BEFORE UPDATE ON public.consultant_applications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.lead_google_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL,
  consultant_id uuid NOT NULL,
  google_event_id text NOT NULL,
  meet_link text,
  event_start timestamp with time zone,
  event_end timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (lead_id, consultant_id)
);

ALTER TABLE public.lead_google_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_all_lead_google_events" ON public.lead_google_events;
CREATE POLICY "deny_all_lead_google_events"
ON public.lead_google_events FOR ALL TO anon, authenticated
USING (false) WITH CHECK (false);

DROP TRIGGER IF EXISTS lead_google_events_updated_at ON public.lead_google_events;
CREATE TRIGGER lead_google_events_updated_at
BEFORE UPDATE ON public.lead_google_events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.funnel_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  time_slots TEXT[] NOT NULL DEFAULT ARRAY['10:00','11:00','12:00','15:00','16:00','17:00','18:00']::text[],
  blocked_weekdays integer[] NOT NULL DEFAULT '{}'::integer[],
  blocked_dates date[] NOT NULL DEFAULT '{}'::date[],
  blocked_slots jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.funnel_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read funnel time slots" ON public.funnel_settings;
CREATE POLICY "Anyone can read funnel time slots"
  ON public.funnel_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users manage own funnel settings" ON public.funnel_settings;
CREATE POLICY "Authenticated users manage own funnel settings"
  ON public.funnel_settings FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_funnel_settings_updated_at ON public.funnel_settings;
CREATE TRIGGER update_funnel_settings_updated_at
  BEFORE UPDATE ON public.funnel_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- MIGRATION 3: user_settings
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_admin boolean NOT NULL DEFAULT false,
  scheme_access text[] NOT NULL DEFAULT ARRAY['dashboard']::text[],
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

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

DROP POLICY IF EXISTS "users read own settings" ON public.user_settings;
CREATE POLICY "users read own settings"
ON public.user_settings FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admins read all settings" ON public.user_settings;
CREATE POLICY "admins read all settings"
ON public.user_settings FOR SELECT TO authenticated
USING (public.is_app_admin(auth.uid()));

DROP POLICY IF EXISTS "users insert own settings" ON public.user_settings;
CREATE POLICY "users insert own settings"
ON public.user_settings FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users update own settings" ON public.user_settings;
CREATE POLICY "users update own settings"
ON public.user_settings FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND is_admin = (SELECT is_admin FROM public.user_settings WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "admins update any settings" ON public.user_settings;
CREATE POLICY "admins update any settings"
ON public.user_settings FOR UPDATE TO authenticated
USING (public.is_app_admin(auth.uid()))
WITH CHECK (public.is_app_admin(auth.uid()));

DROP POLICY IF EXISTS "admins delete settings" ON public.user_settings;
CREATE POLICY "admins delete settings"
ON public.user_settings FOR DELETE TO authenticated
USING (public.is_app_admin(auth.uid()));

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER trg_user_settings_updated_at
BEFORE UPDATE ON public.user_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- MIGRATION 4: funnel_settings — slots_mode + weekly_slots
-- ============================================================
ALTER TABLE public.funnel_settings
  ADD COLUMN IF NOT EXISTS slots_mode text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS weekly_slots jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.funnel_settings
  DROP CONSTRAINT IF EXISTS funnel_settings_slots_mode_check;
ALTER TABLE public.funnel_settings
  ADD CONSTRAINT funnel_settings_slots_mode_check CHECK (slots_mode IN ('daily','weekly'));

-- ============================================================
-- MIGRATION 5: public_leads — slot_pending, accept flow, reminder
-- ============================================================
ALTER TABLE public.public_leads
  ADD COLUMN IF NOT EXISTS slot_pending boolean NOT NULL DEFAULT false;
ALTER TABLE public.public_leads
  ADD COLUMN IF NOT EXISTS portatore boolean,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by_consultant_id uuid,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_public_leads_accepted ON public.public_leads(accepted_at) WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_public_leads_reminder ON public.public_leads(data_slot, ora_slot) WHERE reminder_sent_at IS NULL AND accepted_by_consultant_id IS NOT NULL;

ALTER TABLE public.consultant_pins
  ALTER COLUMN permissions SET DEFAULT '{"canAddLead": false, "canAddNotes": true, "canChangeTime": true, "canDeleteLead": false, "canChangeStatus": true, "canChangePayment": false, "canAddPostCallNotes": true, "canAcceptLeads": true}'::jsonb;
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS can_accept_leads boolean NOT NULL DEFAULT true;

UPDATE public.user_settings SET can_accept_leads = true WHERE is_admin = true;

-- ============================================================
-- MIGRATION 6: exchange_rates
-- ============================================================
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rate_date DATE NOT NULL,
  currency TEXT NOT NULL,
  rate_vs_eur NUMERIC NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rate_date, currency)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_currency ON public.exchange_rates (currency);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_date ON public.exchange_rates (rate_date DESC);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can read exchange rates" ON public.exchange_rates;
CREATE POLICY "anyone can read exchange rates"
ON public.exchange_rates FOR SELECT USING (true);

DROP POLICY IF EXISTS "no client writes on exchange rates" ON public.exchange_rates;
CREATE POLICY "no client writes on exchange rates"
ON public.exchange_rates FOR ALL USING (false) WITH CHECK (false);

-- ============================================================
-- MIGRATION 7: granular ad attribution + meta_ad_spend
-- ============================================================
ALTER TABLE public.public_leads
  ADD COLUMN IF NOT EXISTS ad_id text,
  ADD COLUMN IF NOT EXISTS adset_id text,
  ADD COLUMN IF NOT EXISTS campaign_id text,
  ADD COLUMN IF NOT EXISTS ad_name text,
  ADD COLUMN IF NOT EXISTS creative_name text,
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE INDEX IF NOT EXISTS idx_public_leads_ad_id ON public.public_leads(ad_id);
CREATE INDEX IF NOT EXISTS idx_public_leads_external_id ON public.public_leads(external_id);

ALTER TABLE public.lp_events
  ADD COLUMN IF NOT EXISTS ad_id text,
  ADD COLUMN IF NOT EXISTS adset_id text,
  ADD COLUMN IF NOT EXISTS campaign_id text,
  ADD COLUMN IF NOT EXISTS ad_name text,
  ADD COLUMN IF NOT EXISTS creative_name text,
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE INDEX IF NOT EXISTS idx_lp_events_ad_id ON public.lp_events(ad_id);
CREATE INDEX IF NOT EXISTS idx_lp_events_external_id ON public.lp_events(external_id);

ALTER TABLE public.tracking_config
  ADD COLUMN IF NOT EXISTS meta_ad_account_id text;

CREATE TABLE IF NOT EXISTS public.meta_ad_spend (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  spend_date date NOT NULL,
  ad_id text NOT NULL,
  adset_id text,
  campaign_id text,
  ad_name text,
  campaign_name text,
  spend numeric NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  currency text DEFAULT 'EUR',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, spend_date, ad_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_ad_spend_user_date ON public.meta_ad_spend(user_id, spend_date);
CREATE INDEX IF NOT EXISTS idx_meta_ad_spend_ad ON public.meta_ad_spend(ad_id);

ALTER TABLE public.meta_ad_spend ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin select own meta ad spend" ON public.meta_ad_spend;
CREATE POLICY "admin select own meta ad spend"
  ON public.meta_ad_spend FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin insert own meta ad spend" ON public.meta_ad_spend;
CREATE POLICY "admin insert own meta ad spend"
  ON public.meta_ad_spend FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin update own meta ad spend" ON public.meta_ad_spend;
CREATE POLICY "admin update own meta ad spend"
  ON public.meta_ad_spend FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin delete own meta ad spend" ON public.meta_ad_spend;
CREATE POLICY "admin delete own meta ad spend"
  ON public.meta_ad_spend FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- MIGRATION 8-15: tracking_config + meta_ad_spend extensions, public_leads/lp_events tracking
-- ============================================================
ALTER TABLE public.tracking_config
ADD COLUMN IF NOT EXISTS margine_profitto_pct NUMERIC NOT NULL DEFAULT 40;

COMMENT ON COLUMN public.tracking_config.margine_profitto_pct IS 'Margine di profitto % usato per calcolare il Break-even ROAS teorico (1 / margine).';

ALTER TABLE public.tracking_config
ADD COLUMN IF NOT EXISTS costo_prodotto numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.tracking_config.costo_prodotto IS 'Costo unitario del prodotto/servizio (es. costo protesi). Usato per Break-even reale: ricavo - costo_prodotto - spesa_ads';

CREATE INDEX IF NOT EXISTS idx_meta_ad_spend_user_date ON public.meta_ad_spend(user_id, spend_date DESC);
CREATE INDEX IF NOT EXISTS idx_meta_ad_spend_user_ad_date ON public.meta_ad_spend(user_id, ad_id, spend_date);

DO $cstr$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meta_ad_spend_user_date_ad_unique'
  ) THEN
    ALTER TABLE public.meta_ad_spend
    ADD CONSTRAINT meta_ad_spend_user_date_ad_unique
    UNIQUE (user_id, spend_date, ad_id);
  END IF;
END $cstr$;

ALTER TABLE public.meta_ad_spend
  ADD COLUMN IF NOT EXISTS video_plays INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_p25_watched INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_p50_watched INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_p75_watched INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_p100_watched INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_thruplays INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outbound_clicks INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS link_clicks INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS post_engagement INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS landing_page_views INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.public_leads
  ADD COLUMN IF NOT EXISTS fbclid text,
  ADD COLUMN IF NOT EXISTS utm_id text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text;

ALTER TABLE public.lp_events
  ADD COLUMN IF NOT EXISTS fbclid text,
  ADD COLUMN IF NOT EXISTS fbc text,
  ADD COLUMN IF NOT EXISTS fbp text,
  ADD COLUMN IF NOT EXISTS utm_id text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS time_on_page integer,
  ADD COLUMN IF NOT EXISTS max_scroll integer,
  ADD COLUMN IF NOT EXISTS capi_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS user_agent text;

CREATE INDEX IF NOT EXISTS idx_lp_events_ad_id ON public.lp_events(ad_id) WHERE ad_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lp_events_event_name ON public.lp_events(event_name);
CREATE INDEX IF NOT EXISTS idx_lp_events_created_at ON public.lp_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_leads_ad_id ON public.public_leads(ad_id) WHERE ad_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_public_leads_created_at ON public.public_leads(created_at DESC);

ALTER TABLE public.public_leads
  ADD COLUMN IF NOT EXISTS capi_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS capi_sent_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_public_leads_capi_sent ON public.public_leads(capi_sent);
CREATE INDEX IF NOT EXISTS idx_public_leads_created_capi ON public.public_leads(created_at DESC, capi_sent);

ALTER TABLE public.meta_ad_spend
  ADD COLUMN IF NOT EXISTS reach integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frequency numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_meta_ad_spend_user_date ON public.meta_ad_spend(user_id, spend_date);
CREATE INDEX IF NOT EXISTS idx_meta_ad_spend_ad ON public.meta_ad_spend(ad_id, spend_date);
CREATE INDEX IF NOT EXISTS idx_lp_events_ad_session ON public.lp_events(ad_id, session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_public_leads_session ON public.public_leads(ad_id, created_at);

ALTER TABLE public.tracking_config ADD COLUMN IF NOT EXISTS ads_history_start DATE;
