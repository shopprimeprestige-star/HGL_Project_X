-- ════════════════════════════════════════════════════════════════════════
--  HGL WebApp — PREPARAZIONE COMPLETA DEL DATABASE, IN UN COLPO SOLO
--
--  Come si usa: Supabase → SQL Editor → New query → incolla TUTTO questo
--  file → Run. Su un progetto appena creato fa, in ordine:
--    1. le estensioni dei lavori periodici (pg_cron, pg_net)
--    2. tutte le migrazioni di supabase/migrations/, in ordine di nome
--    3. i contenitori dei file (Storage)
--    4. gli amministratori: chi si è già registrato vede TUTTO il menu
--
--  ⚠️ Il punto 4 è il motivo per cui il menu del gestionale «spariva»: le voci
--   si vedono solo se in user_settings la persona è is_admin (o ha la scheda
--   in scheme_access). Senza tabelle, o con la riga creata quando le tabelle
--   non c'erano, resta solo la Dashboard.
--
--  File generato da supabase/migrations/ — non va modificato a mano.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. ESTENSIONI ────────────────────────────────────────────────────────
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;


-- ── MIGRAZIONE 20260419145616_e8699ecf-f566-421c-858e-53fd44dc663a.sql ──
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

-- updated_at trigger function (search_path safe)
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
-- MIGRATION 3+ : public_leads, lp_events, tracking_config, consultant_applications, lead_google_events, funnel_settings
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

ALTER PUBLICATION supabase_realtime ADD TABLE public.public_leads;

CREATE INDEX IF NOT EXISTS public_leads_created_at_idx ON public.public_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS public_leads_status_idx ON public.public_leads (status);
CREATE INDEX IF NOT EXISTS public_leads_slot_lookup
  ON public.public_leads (data_slot, ora_slot)
  WHERE slot_released = false;

-- lp_events
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

-- tracking_config
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

-- consultant_applications
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

-- lead_google_events
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

-- funnel_settings
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

-- ── MIGRAZIONE 20260419151456_9412d702-8277-484e-815b-1e30b09164ed.sql ──
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

-- ── MIGRAZIONE 20260419153148_1c03b863-ff59-4337-b853-6085fdbcc7c3.sql ──
-- ============================================================
-- MIGRATION 1: tabelle CRM admin
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
-- MIGRATION 2: tabelle pubbliche (landing)
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

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.public_leads;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS public_leads_created_at_idx ON public.public_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS public_leads_status_idx ON public.public_leads (status);
CREATE INDEX IF NOT EXISTS public_leads_slot_lookup
  ON public.public_leads (data_slot, ora_slot)
  WHERE slot_released = false;

-- lp_events
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
CREATE INDEX IF NOT EXISTS lp_events_is_bot_idx ON public.lp_events (is_bot);

-- tracking_config
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

-- consultant_applications
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

-- lead_google_events
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

-- funnel_settings
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

-- ── MIGRAZIONE 20260419154430_764dd6e3-61ae-4c88-8e0d-e202908d59c8.sql ──
ALTER TABLE public.funnel_settings
  ADD COLUMN IF NOT EXISTS slots_mode text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS weekly_slots jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.funnel_settings
  DROP CONSTRAINT IF EXISTS funnel_settings_slots_mode_check;
ALTER TABLE public.funnel_settings
  ADD CONSTRAINT funnel_settings_slots_mode_check CHECK (slots_mode IN ('daily','weekly'));

-- ── MIGRAZIONE 20260419154655_aea563b6-ce00-491c-adc7-d11255bbe850.sql ──
ALTER TABLE public.public_leads
  ADD COLUMN IF NOT EXISTS slot_pending boolean NOT NULL DEFAULT false;

-- ── MIGRAZIONE 20260419155931_f238b817-7559-472f-aeca-af19210aebb6.sql ──

ALTER TABLE public.public_leads
  ADD COLUMN IF NOT EXISTS portatore boolean,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by_consultant_id uuid,
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_public_leads_accepted ON public.public_leads(accepted_at) WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_public_leads_reminder ON public.public_leads(data_slot, ora_slot) WHERE reminder_sent_at IS NULL AND accepted_by_consultant_id IS NOT NULL;

-- Update consultant_pins permissions default to include canAcceptLeads
ALTER TABLE public.consultant_pins
  ALTER COLUMN permissions SET DEFAULT '{"canAddLead": false, "canAddNotes": true, "canChangeTime": true, "canDeleteLead": false, "canChangeStatus": true, "canChangePayment": false, "canAddPostCallNotes": true, "canAcceptLeads": true}'::jsonb;


-- ── MIGRAZIONE 20260419171214_466dd534-0852-4192-b3c8-420352466fed.sql ──
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS can_accept_leads boolean NOT NULL DEFAULT true;

-- Backfill: admin sempre true, gli altri ereditano lo stato attuale (true di default)
UPDATE public.user_settings SET can_accept_leads = true WHERE is_admin = true;

-- ── MIGRAZIONE 20260419180253_9a812d7c-7e08-4128-98b2-d676a2ff5093.sql ──
-- Tabella tassi di cambio rispetto a EUR (base = EUR, da Frankfurter API)
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

-- Lettura pubblica (i tassi non sono dati sensibili)
CREATE POLICY "anyone can read exchange rates"
ON public.exchange_rates
FOR SELECT
USING (true);

-- Scrittura: nessuno via client (solo edge function/cron via service role bypassa RLS)
CREATE POLICY "no client writes on exchange rates"
ON public.exchange_rates
FOR ALL
USING (false)
WITH CHECK (false);

-- ── MIGRAZIONE 20260419182325_c82f6608-1a26-47c0-9e45-ce202af0b7ab.sql ──

-- public_leads: granular ad attribution
ALTER TABLE public.public_leads
  ADD COLUMN IF NOT EXISTS ad_id text,
  ADD COLUMN IF NOT EXISTS adset_id text,
  ADD COLUMN IF NOT EXISTS campaign_id text,
  ADD COLUMN IF NOT EXISTS ad_name text,
  ADD COLUMN IF NOT EXISTS creative_name text,
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE INDEX IF NOT EXISTS idx_public_leads_ad_id ON public.public_leads(ad_id);
CREATE INDEX IF NOT EXISTS idx_public_leads_external_id ON public.public_leads(external_id);

-- lp_events: granular ad attribution
ALTER TABLE public.lp_events
  ADD COLUMN IF NOT EXISTS ad_id text,
  ADD COLUMN IF NOT EXISTS adset_id text,
  ADD COLUMN IF NOT EXISTS campaign_id text,
  ADD COLUMN IF NOT EXISTS ad_name text,
  ADD COLUMN IF NOT EXISTS creative_name text,
  ADD COLUMN IF NOT EXISTS external_id text;

CREATE INDEX IF NOT EXISTS idx_lp_events_ad_id ON public.lp_events(ad_id);
CREATE INDEX IF NOT EXISTS idx_lp_events_external_id ON public.lp_events(external_id);

-- tracking_config: Meta Ad Account ID for Marketing API
ALTER TABLE public.tracking_config
  ADD COLUMN IF NOT EXISTS meta_ad_account_id text;

-- meta_ad_spend: daily spend per ad, synced via Marketing API
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

CREATE POLICY "admin select own meta ad spend"
  ON public.meta_ad_spend FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admin insert own meta ad spend"
  ON public.meta_ad_spend FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admin update own meta ad spend"
  ON public.meta_ad_spend FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admin delete own meta ad spend"
  ON public.meta_ad_spend FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- ── MIGRAZIONE 20260419190938_310ceb48-8594-4d35-9557-74340ac37e96.sql ──
ALTER TABLE public.tracking_config 
ADD COLUMN IF NOT EXISTS margine_profitto_pct NUMERIC NOT NULL DEFAULT 40;

COMMENT ON COLUMN public.tracking_config.margine_profitto_pct IS 'Margine di profitto % usato per calcolare il Break-even ROAS teorico (1 / margine).';

-- ── MIGRAZIONE 20260419194033_30464b55-8f06-4b20-a022-496a6e803684.sql ──
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

-- ── MIGRAZIONE 20260419203007_7c6d1e53-a950-4a69-9708-144e6566b7c5.sql ──
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

-- ── MIGRAZIONE 20260419213948_dcac0aa0-7043-4d1f-8163-e45ae98c0586.sql ──
-- Estensione tracking full-stack: parametri Meta + UTM granulari + qualità landing

-- 1) public_leads: aggiungi fbclid, utm_id (campaign), utm_content (ad), utm_term (adset)
ALTER TABLE public.public_leads
  ADD COLUMN IF NOT EXISTS fbclid text,
  ADD COLUMN IF NOT EXISTS utm_id text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text;

-- 2) lp_events: aggiungi fbclid, fbc, fbp, utm_id/content/term, time_on_page, max_scroll, capi_sent
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

-- 3) Indici per analytics Ads Manager: query rapide per ad_id e per evento
CREATE INDEX IF NOT EXISTS idx_lp_events_ad_id ON public.lp_events(ad_id) WHERE ad_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lp_events_event_name ON public.lp_events(event_name);
CREATE INDEX IF NOT EXISTS idx_lp_events_created_at ON public.lp_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_leads_ad_id ON public.public_leads(ad_id) WHERE ad_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_public_leads_created_at ON public.public_leads(created_at DESC);

-- ── MIGRAZIONE 20260419215936_eed3d946-2c02-41b6-970c-f70bc827b3b9.sql ──
-- Aggiunge colonna capi_sent su public_leads per tracciare l'invio del Lead a Meta CAPI
ALTER TABLE public.public_leads
  ADD COLUMN IF NOT EXISTS capi_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS capi_sent_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_public_leads_capi_sent ON public.public_leads(capi_sent);
CREATE INDEX IF NOT EXISTS idx_public_leads_created_capi ON public.public_leads(created_at DESC, capi_sent);

-- ── MIGRAZIONE 20260419225037_383be790-bc3b-4fcb-a7dd-553de79dfb6e.sql ──
ALTER TABLE public.meta_ad_spend
  ADD COLUMN IF NOT EXISTS reach integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS frequency numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_meta_ad_spend_user_date ON public.meta_ad_spend(user_id, spend_date);
CREATE INDEX IF NOT EXISTS idx_meta_ad_spend_ad ON public.meta_ad_spend(ad_id, spend_date);
CREATE INDEX IF NOT EXISTS idx_lp_events_ad_session ON public.lp_events(ad_id, session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_public_leads_session ON public.public_leads(ad_id, created_at);

-- ── MIGRAZIONE 20260419231224_36481b13-7ecc-43f0-9cd8-1c9910c8ff79.sql ──
ALTER TABLE public.tracking_config ADD COLUMN IF NOT EXISTS ads_history_start DATE;

-- ── MIGRAZIONE 20260420005125_7e228c8d-9903-468b-9b91-b1f3bb02a103.sql ──
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


-- ── MIGRAZIONE 20260420013750_065457cc-eaf2-4534-9fcc-3809f0b94553.sql ──
ALTER TABLE public.tracking_config
  ADD COLUMN IF NOT EXISTS fatigue_freq_threshold numeric NOT NULL DEFAULT 3.5,
  ADD COLUMN IF NOT EXISTS fatigue_scroll_threshold integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS fatigue_time_threshold integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS fatigue_alerts_enabled boolean NOT NULL DEFAULT true;

-- ── MIGRAZIONE 20260420035245_ec68e8e3-611c-4f58-877e-3eb5ebc93808.sql ──
ALTER TABLE public.meta_ad_spend
  ADD COLUMN IF NOT EXISTS video_3_sec_watched integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_15_sec_watched integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_avg_time_watched numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_continuous_2_sec_watched integer NOT NULL DEFAULT 0;

-- ── MIGRAZIONE 20260420103554_8353be15-bee6-4022-8e7e-108d300ba9a2.sql ──
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

-- ── MIGRAZIONE 20260420134049_222c5fb7-b5ce-43af-8ef8-3bd3d2577c94.sql ──

CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  dedupe_key TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX notifications_user_dedupe_idx ON public.notifications(user_id, dedupe_key);
CREATE INDEX notifications_user_unread_idx ON public.notifications(user_id, read_at, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "users insert own notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);


-- ── MIGRAZIONE 20260420134214_d2cd535c-9ec6-4734-8ade-e8f4eefcd883.sql ──
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ── MIGRAZIONE 20260420134510_c9207673-7d69-49ad-ac09-8286e04db693.sql ──

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


-- ── MIGRAZIONE 20260420153009_bce24758-2027-43bd-afc6-1134d14046a4.sql ──
CREATE OR REPLACE FUNCTION public.get_meta_sync_cron_history()
RETURNS TABLE (
  jobid bigint,
  runid bigint,
  status text,
  return_message text,
  start_time timestamptz,
  end_time timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT d.jobid, d.runid, d.status, d.return_message, d.start_time, d.end_time
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
  WHERE j.jobname = 'meta-spend-sync-daily'
  ORDER BY d.start_time DESC
  LIMIT 10;
$$;

REVOKE ALL ON FUNCTION public.get_meta_sync_cron_history() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_meta_sync_cron_history() TO service_role;

-- ── MIGRAZIONE 20260420192313_b3523f7d-90f5-47fe-9bbe-1a1f5354940e.sql ──
-- Group 3: tabella tiktok_ad_spend (gemella di meta_ad_spend) per sync con TikTok Business API
CREATE TABLE public.tiktok_ad_spend (
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
  reach integer NOT NULL DEFAULT 0,
  frequency numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'EUR',
  -- Video metrics (TikTok native)
  video_views integer NOT NULL DEFAULT 0,
  video_views_p25 integer NOT NULL DEFAULT 0,
  video_views_p50 integer NOT NULL DEFAULT 0,
  video_views_p75 integer NOT NULL DEFAULT 0,
  video_views_p100 integer NOT NULL DEFAULT 0,
  video_play_actions integer NOT NULL DEFAULT 0,
  video_watched_2s integer NOT NULL DEFAULT 0,
  video_watched_6s integer NOT NULL DEFAULT 0,
  average_video_play numeric NOT NULL DEFAULT 0,
  -- Engagement
  likes integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  follows integer NOT NULL DEFAULT 0,
  profile_visits integer NOT NULL DEFAULT 0,
  -- Conversions
  conversions integer NOT NULL DEFAULT 0,
  cost_per_conversion numeric NOT NULL DEFAULT 0,
  conversion_rate numeric NOT NULL DEFAULT 0,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT tiktok_ad_spend_unique_daily UNIQUE (user_id, ad_id, spend_date)
);

CREATE INDEX idx_tiktok_ad_spend_user_date ON public.tiktok_ad_spend (user_id, spend_date DESC);
CREATE INDEX idx_tiktok_ad_spend_ad ON public.tiktok_ad_spend (ad_id);

ALTER TABLE public.tiktok_ad_spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin select own tiktok ad spend"
  ON public.tiktok_ad_spend FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admin insert own tiktok ad spend"
  ON public.tiktok_ad_spend FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admin update own tiktok ad spend"
  ON public.tiktok_ad_spend FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admin delete own tiktok ad spend"
  ON public.tiktok_ad_spend FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Group 2: aggiungi colonne per spesa manuale TikTok e Organico (override opzionali)
ALTER TABLE public.tracking_config
  ADD COLUMN IF NOT EXISTS daily_spend_organico numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tiktok_advertiser_id text;


-- ── MIGRAZIONE 20260420211126_e9e87cd4-981d-49bf-ac38-fba2abfa50a6.sql ──
ALTER TABLE public.public_leads
  ADD COLUMN IF NOT EXISTS touch_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS touch_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_channel text,
  ADD COLUMN IF NOT EXISTS last_channel text,
  ADD COLUMN IF NOT EXISTS journey_type text,
  ADD COLUMN IF NOT EXISTS days_to_convert integer,
  ADD COLUMN IF NOT EXISTS hours_to_convert integer;

CREATE INDEX IF NOT EXISTS idx_public_leads_journey_type ON public.public_leads(journey_type);
CREATE INDEX IF NOT EXISTS idx_public_leads_first_channel ON public.public_leads(first_channel);
CREATE INDEX IF NOT EXISTS idx_public_leads_last_channel ON public.public_leads(last_channel);

-- ── MIGRAZIONE 20260420213257_1cf9649a-ab0c-4647-97ca-c000e9704759.sql ──
-- ─────────────────────────────────────────────────────────────────────────────
-- RECUPERO GIORNALIERO DELLA STORIA DEI CONTATTI — ogni notte alle 3:15
-- Chiama /hooks/touch-history-backfill, che ricostruisce `touch_history` sui
-- lead vecchi (al massimo 500 per volta).
--
-- ⚠️ QUI C'ERANO L'INDIRIZZO E LA CHIAVE DI UN'INSTALLAZIONE CHE NON ESISTE
--    PIÙ (un vecchio indirizzo lovable.app e la chiave pubblica di un progetto
--    poi cancellato): questo lavoro periodico stava chiamando il vuoto da
--    mesi, senza che nessuno se ne accorgesse. Trovato leggendo l'archivio
--    della sorgente.
--    Adesso indirizzo e chiave si leggono da `app_config` (`cron_sito` e
--    `cron_chiave`), come per gli altri lavori: un'installazione nuova mette
--    le sue due righe e tutto parte da sé.
-- ─────────────────────────────────────────────────────────────────────────────
DO $cron$
DECLARE
  sito   text;
  chiave text;
BEGIN
  IF to_regclass('cron.job') IS NULL OR to_regclass('public.app_config') IS NULL THEN
    RAISE NOTICE 'cron «touch-history-backfill-daily» saltato: manca pg_cron o app_config. Lo riprogramma la migrazione 20261005.';
    RETURN;
  END IF;
  SELECT value INTO sito   FROM public.app_config WHERE key = 'cron_sito';
  SELECT value INTO chiave FROM public.app_config WHERE key = 'cron_chiave';
  IF coalesce(sito, '') = '' OR coalesce(chiave, '') = '' THEN
    RAISE NOTICE 'cron «touch-history-backfill-daily» NON programmato: mancano le righe cron_sito e cron_chiave in app_config.';
    RETURN;
  END IF;
  PERFORM cron.schedule(
    'touch-history-backfill-daily',
    '15 3 * * *',
    format(
      'SELECT net.http_post(url := %L, headers := %L::jsonb, body := ''{}''::jsonb);',
      rtrim(sito, '/') || '/hooks/touch-history-backfill',
      json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || chiave)::text
    )
  );
END
$cron$;


-- ── MIGRAZIONE 20260422151132_b4d7efb8-6302-4a69-a5b1-fa0f2c91094c.sql ──
-- Tabella messaggi WhatsApp
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lead_id uuid,
  wa_message_id text UNIQUE,
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  from_number text NOT NULL,
  to_number text NOT NULL,
  body text,
  media_url text,
  media_type text,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('queued','sent','delivered','read','failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  read_at timestamptz,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_wa_messages_user ON public.whatsapp_messages(user_id, created_at DESC);
CREATE INDEX idx_wa_messages_lead ON public.whatsapp_messages(lead_id, created_at DESC);
CREATE INDEX idx_wa_messages_numbers ON public.whatsapp_messages(from_number, to_number);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own wa messages"
  ON public.whatsapp_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users insert own wa messages"
  ON public.whatsapp_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users update own wa messages"
  ON public.whatsapp_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users delete own wa messages"
  ON public.whatsapp_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Tabella mappatura numero → lead
CREATE TABLE public.whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  phone_e164 text NOT NULL,
  lead_id uuid,
  display_name text,
  last_message_at timestamptz,
  unread_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, phone_e164)
);

CREATE INDEX idx_wa_contacts_user ON public.whatsapp_contacts(user_id, last_message_at DESC NULLS LAST);

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage own wa contacts"
  ON public.whatsapp_contacts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER trg_wa_contacts_updated
  BEFORE UPDATE ON public.whatsapp_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_contacts;

-- ── MIGRAZIONE 20260422180258_7c6172c0-b889-4bf8-81ae-7d3f7a60928a.sql ──
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

-- ── MIGRAZIONE 20260423124234_00ee5d56-6b89-4048-a14f-1d71d77ff8b6.sql ──
ALTER TABLE public.tracking_config
  ADD COLUMN IF NOT EXISTS tiktok_test_event_code text,
  ADD COLUMN IF NOT EXISTS tiktok_ads_history_start date;

-- ── MIGRAZIONE 20260423124537_27fa3a70-b374-491f-8dc0-3f962cf9f5ba.sql ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'whatsapp_contacts_user_phone_unique'
  ) THEN
    ALTER TABLE public.whatsapp_contacts
      ADD CONSTRAINT whatsapp_contacts_user_phone_unique UNIQUE (user_id, phone_e164);
  END IF;
END $$;

-- Realtime su messaggi e contatti per UI live
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_contacts REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='whatsapp_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='whatsapp_contacts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_contacts;
  END IF;
END $$;

-- ── MIGRAZIONE 20260424233853_28db6329-3b1a-456d-baeb-4ba9a00eb805.sql ──
ALTER TABLE public.whatsapp_settings 
ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live';

ALTER TABLE public.whatsapp_settings
ADD CONSTRAINT whatsapp_settings_mode_check CHECK (mode IN ('live','sandbox'));

-- ── MIGRAZIONE 20260425002909_601aec86-e39f-4ed1-b177-a3c7df9f4851.sql ──

-- Mappa stato lead → nome template WA approvato e valori default per popup quick-action.
ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS status_template_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS default_values jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.whatsapp_settings.status_template_map IS
  'Mappa { leadStatus: { name: string, lang: string } } usata per inviare template WA in base allo stato del lead.';
COMMENT ON COLUMN public.whatsapp_settings.default_values IS
  'Valori default per popup quick-action lead (acconto, vendita, prodotto, taglio, costi installazione ecc).';


-- ── MIGRAZIONE 20260525004612_ce035c6f-5317-4d39-b1dd-959ea483f2c5.sql ──

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


-- ── MIGRAZIONE 20260528183055_3e8758b7-91ef-4b97-9b67-5a3a6e4be60e.sql ──
ALTER TABLE public.whatsapp_settings ADD COLUMN IF NOT EXISTS disabled_template_statuses text[] NOT NULL DEFAULT '{}'::text[];

-- ── MIGRAZIONE 20260722130000_meta_leadgen.sql ──
-- Meta Lead Ads (leadgen) — credenziali per-utente sul tracking_config.
-- Il webhook /api/public/meta-leadgen-webhook risolve il tenant dal meta_page_id,
-- verifica la firma con meta_app_secret e scarica il lead con meta_page_access_token.
ALTER TABLE public.tracking_config
  ADD COLUMN IF NOT EXISTS meta_page_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_page_access_token TEXT,
  ADD COLUMN IF NOT EXISTS meta_leadgen_verify_token TEXT,
  ADD COLUMN IF NOT EXISTS meta_app_secret TEXT;

-- Indice per lookup veloce del tenant dal page_id in arrivo dal webhook.
CREATE INDEX IF NOT EXISTS idx_tracking_config_meta_page_id
  ON public.tracking_config (meta_page_id);


-- ── MIGRAZIONE 20260722160000_shop_orders.sql ──
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


-- ── MIGRAZIONE 20260722180000_quote_requests.sql ──
-- Richieste di preventivo dal configuratore "Custom Hair System".
-- Insert aperto (form pubblico); lettura/gestione ai soli admin autenticati.
CREATE TABLE IF NOT EXISTS public.quote_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  quote_ref TEXT NOT NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefono TEXT NOT NULL,
  eta INTEGER,
  grey_pct INTEGER,
  color_code TEXT,
  problemi TEXT,
  note TEXT,
  base_choice TEXT,
  base_system JSONB,
  upsells JSONB NOT NULL DEFAULT '[]',
  discount_code TEXT,
  discount_eur NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'nuovo'
);

ALTER TABLE public.quote_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone can insert quote" ON public.quote_requests;
CREATE POLICY "anyone can insert quote" ON public.quote_requests FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "authenticated can read quotes" ON public.quote_requests;
CREATE POLICY "authenticated can read quotes" ON public.quote_requests FOR SELECT USING (auth.role() = 'authenticated');
DROP POLICY IF EXISTS "authenticated can update quotes" ON public.quote_requests;
CREATE POLICY "authenticated can update quotes" ON public.quote_requests FOR UPDATE USING (auth.role() = 'authenticated');

CREATE INDEX IF NOT EXISTS idx_quote_requests_created_at ON public.quote_requests (created_at DESC);


-- ── MIGRAZIONE 20260723090000_discount_codes.sql ──
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


-- ── MIGRAZIONE 20260723120000_quote_v3.sql ──
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


-- ── MIGRAZIONE 20260901120000_webinar_sala.sql ──
-- ── LA SALA DEL WEBINAR ─────────────────────────────────────────────────────
--  Quattro tavoli. Stanno qui e non in `app_config` come la stanza, per una
--  ragione sola ma decisiva: `app_config` è UNA RIGA per chiave, e cinquecento
--  spettatori che dicono «ci sono ancora» ogni venti secondi sono venticinque
--  scritture al secondo sulla stessa riga. L'ultima vince e le altre spariscono:
--  il contatore direbbe numeri a caso.
--  Con una riga per persona, invece, non si pestano i piedi.
--
--  ⚠️ RLS ACCESO E NESSUNA POLICY, ED È VOLUTO. A questi tavoli si arriva solo
--   dalle rotte del server, che usano la chiave di servizio e passano sopra
--   l'RLS. Un browser che provasse a leggerli in diretta con la chiave pubblica
--   non vedrebbe niente — e non deve: la chat di un webinar di vendita contiene
--   nomi e domande di persone che stanno valutando un trattamento.

-- Chi c'è adesso. Una riga per spettatore, riscritta a ogni battito.
create table if not exists public.webinar_presenze (
  codice      text        not null,
  spettatore  text        not null,
  nome        text,
  visto_il    timestamptz not null default now(),
  primary key (codice, spettatore)
);
create index if not exists webinar_presenze_freschi
  on public.webinar_presenze (codice, visto_il desc);

-- La chat.
create table if not exists public.webinar_messaggi (
  id         uuid        primary key default gen_random_uuid(),
  codice     text        not null,
  spettatore text,
  autore     text        not null,
  --  'presentatore' = lo studio · 'palco' = chi sta parlando in diretta ·
  --  'ospite' = chi guarda. Decide colore ed evidenziazione nella lista.
  ruolo      text        not null default 'ospite',
  testo      text        not null,
  fissato    boolean     not null default false,
  creato_il  timestamptz not null default now()
);
create index if not exists webinar_messaggi_recenti
  on public.webinar_messaggi (codice, creato_il desc);

-- Il palco: chi, oltre al presentatore, sta parlando in diretta.
create table if not exists public.webinar_palco (
  codice        text        not null,
  spettatore    text        not null,
  nome          text        not null default 'Ospite',
  --  'attesa' = ha alzato la mano · 'audio' = parla · 'video' = parla e si vede
  stato         text        not null default 'attesa',
  --  il microfono aperto o chiuso: lo comanda il presentatore dalla chat
  microfono     boolean     not null default false,
  --  sta parlando ADESSO: lo scrive il suo browser, serve all'icona che si
  --  illumina. È l'unico campo che si aggiorna spesso, per questo sta qui e
  --  non insieme al resto della stanza.
  parla         boolean     not null default false,
  --  il lasciapassare per pubblicare: lo conia il presentatore quando fa salire
  --  qualcuno, e senza di questo nessuno può mandare audio o video nella sala.
  pass          text,
  session_id    text,
  traccia_audio text,
  traccia_video text,
  salito_il     timestamptz not null default now(),
  primary key (codice, spettatore)
);

-- I messaggi che partono da soli al minuto stabilito.
--  ⚠️ SONO MESSAGGI DELLO STUDIO, non di finti spettatori: `autore` viene
--   sempre riscritto col nome del presentatore quando il messaggio parte.
create table if not exists public.webinar_programmati (
  id         uuid        primary key default gen_random_uuid(),
  codice     text        not null,
  minuto     integer     not null default 0,
  testo      text        not null,
  fissa      boolean     not null default false,
  inviato_il timestamptz,
  creato_il  timestamptz not null default now()
);
create index if not exists webinar_programmati_ordine
  on public.webinar_programmati (codice, minuto);

alter table public.webinar_presenze    enable row level security;
alter table public.webinar_messaggi    enable row level security;
alter table public.webinar_palco       enable row level security;
alter table public.webinar_programmati enable row level security;


-- ── MIGRAZIONE 20260901180000_webinar_schermi.sql ──
-- ── DA CHE SCHERMO GUARDANO ─────────────────────────────────────────────────
--  Due numeri per spettatore: la larghezza e l'altezza della sua finestra.
--
--  ⚠️ SI SALVA LA MISURA VERA, non una parola tipo «mobile». Le classi
--   («telefono», «tablet», «schermo grande») le decide chi legge, e le soglie
--   cambiano ogni due anni: un telefono pieghevole aperto è largo come un
--   tablet di sei anni fa. Salvando la parola, il giorno che la soglia cambia
--   i dati vecchi restano classificati con la regola vecchia e nessuno se ne
--   accorge. Salvando il numero, si riclassifica tutto rileggendo.
--
--  Serve al presentatore per una cosa sola ma concreta: sapere che in sala c'è
--  gente col telefono PRIMA di mostrare una tabella che sul telefono non si
--  legge — non dopo, leggendo in chat «non si vede niente».
alter table public.webinar_presenze add column if not exists larghezza integer;
alter table public.webinar_presenze add column if not exists altezza   integer;


-- ── MIGRAZIONE 20260906090000_webinar_misura.sql ──
-- ── LA MISURA DI UNA DIRETTA ────────────────────────────────────────────────
--
--  Serve a rispondere a quattro domande che oggi non hanno risposta: quante
--  persone sono entrate, quanto sono rimaste, A CHE MINUTO se ne sono andate, e
--  quante hanno fatto il gesto che conta alla fine.
--
--  ⚠️ LA TERZA È LA PIÙ PREZIOSA E NON COSTA NIENTE IN PIÙ. Con l'istante in
--   cui una persona è entrata e quello in cui l'abbiamo vista l'ultima volta si
--   sa, per ogni minuto della diretta, quante persone c'erano: basta contare
--   chi era già dentro e non era ancora uscito. Il minuto in cui la curva crolla
--   è il punto in cui il discorso perde, ed è l'unica informazione che dice
--   DOVE intervenire invece che «è andata male».

-- Quando una persona è entrata. ⚠️ `default now()` e MAI scritta a mano: il
-- valore di partenza vale solo all'inserimento, quindi i battiti successivi —
-- che riscrivono la riga ogni venti secondi — non lo toccano. Scrivendola dal
-- programma si sovrascriverebbe a ogni battito, e ogni permanenza risulterebbe
-- di zero secondi.
alter table public.webinar_presenze
  add column if not exists entrato_il timestamptz not null default now();

-- ── I GESTI CHE CONTANO ─────────────────────────────────────────────────────
--  Non «tutti i clic»: solo quelli che dicono qualcosa sull'esito. Oggi uno
--  solo — chi tocca il tasto WhatsApp alla fine — ma la forma regge anche gli
--  altri senza migrazioni nuove.
--
--  ⚠️ UNA RIGA PER PERSONA E PER GESTO, non una per clic: la domanda è «quante
--   persone l'hanno fatto», non «quante volte è stato premuto». Chi torna
--   indietro e ripreme non deve contare due volte, altrimenti il tasso di
--   conversione può superare il cento per cento — e un numero impossibile
--   toglie fiducia a tutti gli altri.
create table if not exists public.webinar_azioni (
  codice     text        not null,
  spettatore text        not null,
  azione     text        not null,
  quando     timestamptz not null default now(),
  primary key (codice, spettatore, azione)
);
create index if not exists webinar_azioni_per_sala
  on public.webinar_azioni (codice, azione);

alter table public.webinar_azioni enable row level security;


-- ── MIGRAZIONE 20260906120000_webinar_iscritti.sql ──
-- ── CHI SI È ISCRITTO A UNA DIRETTA ─────────────────────────────────────────
--
--  ⚠️ FINO A OGGI GLI ISCRITTI ERANO UN NUMERO SCRITTO A MANO. Si poteva
--   mostrarlo in sala, e basta: non esisteva una lista. Senza lista non si può
--   avvisare nessuno che si comincia, non si può ricontattare chi si era
--   iscritto e non è venuto, e non si può ricontattare chi è venuto, è rimasto
--   quaranta minuti e non ha scritto. In un webinar quelle tre cose sono la
--   maggior parte del fatturato.
--
--  ⚠️ UNA RIGA PER PERSONA E PER SALA, non una per iscrizione: chi apre il
--   link due volte e si iscrive di nuovo non deve ricevere due promemoria né
--   contare due volte. La chiave è (codice, contatto).
create table if not exists public.webinar_iscritti (
  codice     text        not null,
  -- Il numero già pronto da chiamare, in forma internazionale (39…): la
  -- normalizzazione si fa PRIMA di scrivere, perché un numero scritto in
  -- quattro modi diversi diventa quattro persone.
  contatto   text        not null,
  nome       text,
  quando     timestamptz not null default now(),
  -- ⚠️ Quando gli abbiamo mandato l'ultimo avviso. Serve a non mandarne due:
  --  un promemoria doppio è il modo più veloce di farsi bloccare il numero, e
  --  su WhatsApp un blocco non si toglie.
  avvisato_il timestamptz,
  primary key (codice, contatto)
);
create index if not exists webinar_iscritti_per_sala
  on public.webinar_iscritti (codice, quando desc);

alter table public.webinar_iscritti enable row level security;


-- ── MIGRAZIONE 20260924120000_meta_lead_sync_cron.sql ──
-- ─────────────────────────────────────────────────────────────────────────────
-- RECUPERO PERIODICO DEI LEAD DEI MODULI META — ogni 5 minuti
--
-- Chiama /hooks/meta-lead-sync, che chiede alla Graph API i lead degli ultimi
-- giorni e scrive in public_leads quelli che non ci sono ancora. I doppioni li
-- riconosce da external_id, quindi ripassare sugli stessi lead non costa nulla.
--
-- ⚠️ QUI DENTRO NON C'È PIÙ NESSUN INDIRIZZO E NESSUNA CHIAVE SCRITTI A MANO.
--    Prima c'erano: l'indirizzo del sito e la chiave pubblica di QUESTA
--    installazione. Non erano un segreto (la chiave `anon` la riceve ogni
--    browser), ma chi clonava il sistema su un altro database si ritrovava un
--    lavoro periodico che chiamava il SITO VECCHIO — e non aveva modo di
--    accorgersene. Trovato scaricando l'archivio della sorgente e leggendolo.
--    Adesso i due valori si leggono da `app_config`:
--        cron_sito    → https://il-tuo-indirizzo
--        cron_chiave  → la chiave pubblica (anon) del progetto
--    Senza quelle due righe il lavoro NON si programma, e lo dice: meglio un
--    lavoro che non parte di un lavoro che chiama casa d'altri.
--
-- ⚠️ La chiave da mettere è la PUBBLICABILE (anon), mai quella di servizio:
--    il comando di un lavoro periodico resta scritto in chiaro dentro
--    cron.job, leggibile da chiunque abbia accesso al database.
--
-- Per cambiare frequenza: rilanciare cron.schedule con lo stesso nome.
-- Per spegnerlo:  SELECT cron.unschedule('meta-lead-sync-5min');
-- Per vedere se gira:  SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- ─────────────────────────────────────────────────────────────────────────────
DO $cron$
DECLARE
  sito   text;
  chiave text;
BEGIN
  --  ⚠️ Su un database appena creato queste cose possono non esserci ancora
  --   (app_config nasce in una migrazione successiva, e le estensioni le
  --   accende chi installa): si salta con un avviso invece di far fallire
  --   tutta l'installazione per un lavoro periodico.
  IF to_regclass('cron.job') IS NULL OR to_regclass('public.app_config') IS NULL THEN
    RAISE NOTICE 'cron «meta-lead-sync-5min» saltato: manca pg_cron o app_config. Lo riprogramma la migrazione 20261005.';
    RETURN;
  END IF;
  SELECT value INTO sito   FROM public.app_config WHERE key = 'cron_sito';
  SELECT value INTO chiave FROM public.app_config WHERE key = 'cron_chiave';
  IF coalesce(sito, '') = '' OR coalesce(chiave, '') = '' THEN
    RAISE NOTICE 'cron «meta-lead-sync-5min» NON programmato: scrivi in app_config le righe cron_sito e cron_chiave, poi rilancia questa migrazione.';
    RETURN;
  END IF;
  PERFORM cron.schedule(
    'meta-lead-sync-5min',
    '*/5 * * * *',
    format(
      'SELECT net.http_post(url := %L, headers := %L::jsonb, body := ''{}''::jsonb);',
      rtrim(sito, '/') || '/hooks/meta-lead-sync',
      json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || chiave)::text
    )
  );
END
$cron$;


-- ── MIGRAZIONE 20261005150000_cron_senza_indirizzi_fissi.sql ──
-- ─────────────────────────────────────────────────────────────────────────────
-- I LAVORI PERIODICI NON SANNO PIÙ A MEMORIA DOV'È IL SITO
--
-- Com'è nato questo file: il committente ha chiesto di poter scaricare TUTTO
-- per installarlo altrove; scaricando l'archivio della sorgente e leggendolo
-- sono saltate fuori due migrazioni che si portavano dentro, scritti a mano,
-- l'indirizzo di questa installazione e la chiave pubblica del progetto. Non
-- sono segreti — la chiave `anon` la riceve ogni browser — ma un sistema
-- clonato si sarebbe ritrovato dei lavori periodici che chiamano il sito
-- vecchio. E uno dei due (`touch-history-backfill-daily`) chiamava da mesi un
-- indirizzo che non esiste più, senza che nessuno se ne accorgesse.
--
-- Da qui in avanti i due valori stanno in `app_config`:
--     cron_sito    → l'indirizzo del sito (https://…, senza barra finale)
--     cron_chiave  → la chiave PUBBLICA (anon) del progetto Supabase
-- e si cambiano con due righe di SQL, senza toccare il codice.
--
-- ⚠️ QUESTA MIGRAZIONE RIPROGRAMMA I LAVORI GIÀ ESISTENTI con i valori presi
--    da lì: è il pezzo che rimette a posto l'installazione di oggi. Se le due
--    righe non ci sono NON TOCCA NIENTE — non spegne i lavori che stanno
--    funzionando — e dice cosa fare.
-- ⚠️ MAI LA CHIAVE DI SERVIZIO: il comando di un lavoro periodico resta
--    scritto in chiaro dentro `cron.job`, leggibile da chiunque entri nel
--    database.
-- ─────────────────────────────────────────────────────────────────────────────

--  Una funzione sola, perché i lavori sono due e domani saranno tre: scrivere
--  tre volte lo stesso `format()` è il modo in cui due lavori finiscono per
--  autenticarsi in modi diversi.
CREATE OR REPLACE FUNCTION public.programma_hook_cron(
  nome text,
  quando text,
  percorso text
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $fn$
DECLARE
  sito   text;
  chiave text;
BEGIN
  IF to_regclass('cron.job') IS NULL OR to_regclass('public.app_config') IS NULL THEN
    RAISE NOTICE 'cron «%» saltato: manca pg_cron o app_config.', nome;
    RETURN false;
  END IF;
  SELECT value INTO sito   FROM public.app_config WHERE key = 'cron_sito';
  SELECT value INTO chiave FROM public.app_config WHERE key = 'cron_chiave';
  IF coalesce(sito, '') = '' OR coalesce(chiave, '') = '' THEN
    RAISE NOTICE 'cron «%» NON programmato: scrivi in app_config le righe cron_sito e cron_chiave.', nome;
    RETURN false;
  END IF;
  PERFORM cron.schedule(
    nome,
    quando,
    format(
      'SELECT net.http_post(url := %L, headers := %L::jsonb, body := ''{}''::jsonb);',
      rtrim(sito, '/') || percorso,
      json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || chiave)::text
    )
  );
  RAISE NOTICE 'cron «%» programmato su %', nome, rtrim(sito, '/') || percorso;
  RETURN true;
END
$fn$;

--  Non la chiama nessuno da fuori: la usano le migrazioni e chi amministra.
REVOKE ALL ON FUNCTION public.programma_hook_cron(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.programma_hook_cron(text, text, text) TO service_role;

--  E adesso i due lavori, con i valori di QUESTA installazione.
SELECT public.programma_hook_cron('meta-lead-sync-5min', '*/5 * * * *', '/hooks/meta-lead-sync');
SELECT public.programma_hook_cron('touch-history-backfill-daily', '15 3 * * *', '/hooks/touch-history-backfill');


-- ── 3. CONTENITORI DEI FILE ──────────────────────────────────────────────
insert into storage.buckets (id, name, public) values
  ('registrazioni', 'registrazioni', false),
  ('media',         'media',         false),
  ('documenti',     'documenti',     false),
  ('prova-capelli', 'prova-capelli', false),
  ('copie',         'copie',         false),
  ('sorgente',      'sorgente',      false),
  ('anteprime',     'anteprime',     true)
on conflict (id) do nothing;

-- ── 4. AMMINISTRATORI: TUTTO IL MENU A CHI È GIÀ REGISTRATO ─────────────
--  Fallo girare dopo esserti registrato nel gestionale (rilanciare questa
--  parte da sola va bene). Ogni account già presente diventa amministratore
--  con tutte le schede: sul database nuovo c'è solo il titolare.
insert into public.user_settings (user_id, is_admin, scheme_access, display_name, can_accept_leads)
select u.id, true,
       array['dashboard','nuovi','leads','pipeline','sede','installazioni','installazioni_oggi',
             'consulenti','kpi','performance','ads','agenda','impostazioni'],
       u.email, true
from auth.users u
on conflict (user_id) do update
  set is_admin = true,
      scheme_access = excluded.scheme_access,
      can_accept_leads = true;
