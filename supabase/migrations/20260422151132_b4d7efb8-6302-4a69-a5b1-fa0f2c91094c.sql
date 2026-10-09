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