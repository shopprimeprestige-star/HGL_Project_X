-- ── RISPOSTE SCRITTE DALL'AI, DAL MAC (29/10/2026) ───────────────────────────
--
-- Richiesta del titolare: nella chat WhatsApp del CRM si scelgono 1-4
-- messaggi e il CRM prepara la risposta. La scrive Claude (Haiku) sul Mac
-- del titolare, con le informazioni dell'azienda che stanno in AIOS: funziona
-- anche dal telefono, basta che il Mac sia acceso.
--
-- Il giro: il CRM mette una riga «in_coda» (RLS: solo le proprie). Il servizio
-- sul Mac (strumenti/risposte-ai) chiede lavoro a POST /api/public/risposte-ai
-- con la chiave del ponte; la rotta prende la riga con `risposte_ai_prendi`
-- (service_role) e poi scrive la risposta o l'errore. Il CRM legge la riga.
-- La risposta va SOLO nella casella: non si invia mai da sola.
--
-- Solo cose nuove: una tabella e una funzione. Nessun dato esistente cambia.
--
-- COME SI ANNULLA:
--   DROP FUNCTION IF EXISTS public.risposte_ai_prendi(uuid);
--   DROP TABLE IF EXISTS public.wa_risposte_ai;
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.wa_risposte_ai (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  -- il numero della chat, come in whatsapp_contacts («+39…»)
  telefono text NOT NULL CHECK (char_length(telefono) BETWEEN 8 AND 20),
  lead_id uuid,
  -- i messaggi scelti (id di whatsapp_messages), da 1 a 8
  messaggi uuid[] NOT NULL CHECK (cardinality(messaggi) BETWEEN 1 AND 8),
  -- un'indicazione facoltativa («più breve», «proponi giovedì»…)
  indicazione text CHECK (indicazione IS NULL OR char_length(indicazione) <= 500),
  stato text NOT NULL DEFAULT 'in_coda'
    CHECK (stato IN ('in_coda', 'in_lavoro', 'pronta', 'errore')),
  risposta text CHECK (risposta IS NULL OR char_length(risposta) <= 4000),
  errore text CHECK (errore IS NULL OR char_length(errore) <= 200),
  creata_il timestamptz NOT NULL DEFAULT now(),
  presa_il timestamptz,
  finita_il timestamptz
);

CREATE INDEX IF NOT EXISTS idx_wa_risposte_ai_coda
  ON public.wa_risposte_ai (user_id, stato, creata_il);

ALTER TABLE public.wa_risposte_ai ENABLE ROW LEVEL SECURITY;

-- Chi è collegato vede e chiede solo le sue. Lo stato e la risposta li
-- scrive solo il server (niente UPDATE per gli utenti): una richiesta nasce
-- sempre «in_coda» e vuota.
DROP POLICY IF EXISTS "risposte ai: leggo le mie" ON public.wa_risposte_ai;
CREATE POLICY "risposte ai: leggo le mie"
  ON public.wa_risposte_ai FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "risposte ai: chiedo per me" ON public.wa_risposte_ai;
CREATE POLICY "risposte ai: chiedo per me"
  ON public.wa_risposte_ai FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND stato = 'in_coda'
    AND risposta IS NULL
    AND errore IS NULL
    AND presa_il IS NULL
    AND finita_il IS NULL
  );

-- Prende la richiesta più vecchia ancora valida (ultimi 10 minuti): quella in
-- coda, o una presa da più di 3 minuti e mai finita (il Mac si era fermato a
-- metà). Una sola alla volta, senza doppioni anche con due Mac.
CREATE OR REPLACE FUNCTION public.risposte_ai_prendi(p_user_id uuid)
RETURNS SETOF public.wa_risposte_ai
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.wa_risposte_ai r
     SET stato = 'in_lavoro', presa_il = now()
   WHERE r.id = (
     SELECT x.id FROM public.wa_risposte_ai x
      WHERE x.user_id = p_user_id
        AND x.creata_il > now() - interval '10 minutes'
        AND (x.stato = 'in_coda'
             OR (x.stato = 'in_lavoro' AND x.presa_il < now() - interval '3 minutes'))
      ORDER BY x.creata_il
      LIMIT 1
      FOR UPDATE SKIP LOCKED
   )
  RETURNING r.*;
END;
$$;

REVOKE ALL ON FUNCTION public.risposte_ai_prendi(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.risposte_ai_prendi(uuid) TO service_role;
