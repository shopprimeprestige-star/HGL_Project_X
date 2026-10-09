
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
