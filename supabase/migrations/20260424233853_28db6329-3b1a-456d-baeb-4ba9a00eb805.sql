ALTER TABLE public.whatsapp_settings 
ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'live';

ALTER TABLE public.whatsapp_settings
ADD CONSTRAINT whatsapp_settings_mode_check CHECK (mode IN ('live','sandbox'));