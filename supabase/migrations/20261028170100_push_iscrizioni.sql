-- ── LE NOTIFICHE PUSH SUL TELEFONO (28/10/2026) ─────────────────────────────
-- Richiesta del titolare: sapere quando un cliente scrive su WhatsApp anche con
-- il CRM chiuso. Ogni telefono (o computer) che attiva le notifiche lascia qui
-- la sua «iscrizione»: l'indirizzo del servizio push di Apple/Google/Mozilla e
-- le due chiavi per cifrare il messaggio (src/crm/push/webpush.ts).
--
-- ⚠️ SOLO AGGIUNTIVA: una tabella nuova, niente su quelle esistenti.
-- ⚠️ NESSUNA POLITICA RLS = nessun accesso dal browser. Scrive e legge solo il
--   server (service_role) dalla rotta /api/crm/push, dopo aver controllato chi è.
-- ⚠️ Nessun dato dei clienti: solo l'indirizzo push del dispositivo e il nome di
--   chi lo usa nello studio.

CREATE TABLE IF NOT EXISTS public.push_iscrizioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- l'installazione del CRM (lo stesso user_id di whatsapp_messages)
  user_id uuid NOT NULL,
  -- chi l'ha attivata: il consulente (vuoto per il proprietario) e il suo nome
  consulente_id text,
  chi text,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  creata_il timestamptz NOT NULL DEFAULT now(),
  ultimo_invio timestamptz
);

CREATE INDEX IF NOT EXISTS push_iscrizioni_user_id_idx ON public.push_iscrizioni (user_id);

ALTER TABLE public.push_iscrizioni ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_iscrizioni FROM anon, authenticated;
