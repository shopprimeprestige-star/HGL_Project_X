-- ═══════════════════════════════════════════════════════════════════════════
-- SITO · provenienza del lead, problema, fascia oraria, stesso lead col calendario
--
-- COSA FA (solo aggiunte, nessuna riga esistente viene toccata):
--   1. Aggiunge 7 colonne facoltative a public.public_leads: origine
--      (stock / consulenza), punto_ingresso, problema_principale, problema_altro,
--      fascia_oraria (mattina / pomeriggio / sera), prodotto_stock e
--      chiave_orario_hash (l'impronta della chiave che permette di fissare
--      l'orario sullo stesso lead).
--   2. Aggiunge i controlli sui valori e un indice su origine (per il filtro
--      «Stock / Consulenza» in Nuovi contatti).
--   3. Crea fissa_orario_lead_sito(): dopo il modulo corto il visitatore sceglie
--      giorno e ora e SI AGGIORNA LO STESSO lead, non se ne crea un secondo.
--   4. Crea orari_occupati_sito(): restituisce solo data e ora degli slot gia'
--      presi. Oggi non la usa nessuno: serve a chiudere in seguito la lettura
--      pubblica di public_leads cambiando una sola lettura nel calendario.
--
-- COME SI APPLICA: dal SQL Editor di Supabase, PRIMA di pubblicare il ramo.
-- La esegue il titolare, mai la squadra. E' rieseguibile: ogni passo controlla
-- se esiste gia' (IF NOT EXISTS, CREATE OR REPLACE).
--
-- SE NON E' ANCORA APPLICATA il sito funziona lo stesso, anche senza: il lead
-- si salva con le colonne di oggi, il problema scritto in pain_points, e il
-- calendario dopo il modulo corto non viene proposto (niente doppioni).
--
-- Vietato qui dentro: cancellazioni, valori riscritti, regole di accesso toccate,
-- indici unici, trigger. Le colonne del consenso WhatsApp NON sono qui: le crea
-- la migrazione del cantiere crm-whatsapp-automatico.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Colonne: tutte facoltative, nessun valore predefinito ───────────────
ALTER TABLE public.public_leads
  ADD COLUMN IF NOT EXISTS origine text,
  ADD COLUMN IF NOT EXISTS punto_ingresso text,
  ADD COLUMN IF NOT EXISTS problema_principale text,
  ADD COLUMN IF NOT EXISTS problema_altro text,
  ADD COLUMN IF NOT EXISTS fascia_oraria text,
  ADD COLUMN IF NOT EXISTS prodotto_stock text,
  ADD COLUMN IF NOT EXISTS chiave_orario_hash text;

-- ── 2. Controlli (le righe di oggi hanno tutto nullo e passano) ────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'public_leads_origine_check' AND conrelid = 'public.public_leads'::regclass) THEN
    ALTER TABLE public.public_leads
      ADD CONSTRAINT public_leads_origine_check
      CHECK (origine IS NULL OR origine IN ('stock', 'consulenza'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'public_leads_fascia_oraria_check' AND conrelid = 'public.public_leads'::regclass) THEN
    ALTER TABLE public.public_leads
      ADD CONSTRAINT public_leads_fascia_oraria_check
      CHECK (fascia_oraria IS NULL OR fascia_oraria IN ('mattina', 'pomeriggio', 'sera'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'public_leads_problema_altro_len_check' AND conrelid = 'public.public_leads'::regclass) THEN
    ALTER TABLE public.public_leads
      ADD CONSTRAINT public_leads_problema_altro_len_check
      CHECK (problema_altro IS NULL OR char_length(problema_altro) <= 120);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'public_leads_prodotto_stock_len_check' AND conrelid = 'public.public_leads'::regclass) THEN
    ALTER TABLE public.public_leads
      ADD CONSTRAINT public_leads_prodotto_stock_len_check
      CHECK (prodotto_stock IS NULL OR char_length(prodotto_stock) <= 120);
  END IF;
END $$;

-- ── 3. Indice per il filtro per provenienza ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_public_leads_origine ON public.public_leads(origine) WHERE origine IS NOT NULL;

-- ── 4. Fissa l'orario sullo stesso lead ────────────────────────────────────
-- Il browser inserisce il lead con un id e con l'IMPRONTA (SHA-256) di una chiave
-- casuale di 64 caratteri; poi chiama questa funzione con id e chiave. L'impronta
-- sta nella tabella (leggibile con la chiave pubblica), la chiave no.
--
-- Risposte: 'fissato' · 'occupato' · 'non_valido'.
-- 'non_valido' e' IDENTICO per id inesistente, chiave sbagliata, lead gia' con
-- orario, lead vecchio e lead preso in carico: cosi' non si puo' sondare quali id
-- esistono. 'occupato' si risponde solo DOPO che il lead e' stato riconosciuto.
--
-- "Preso in carico" e' quello che scrive la lista Nuovi contatti quando copia il
-- lead nel CRM (un consulente assegnato, oppure uno stato diverso da 'nuovo').
-- NON conta la finestra «accetta» dell'avviso di nuovo lead: la vede il
-- consulente pochi secondi dopo l'invio, quando il visitatore sta ancora
-- scegliendo l'orario.
--
-- Il lucchetto sullo slot protegge solo funzione contro funzione. Il modulo lungo
-- di /classica inserisce con l'orario senza lucchetto e su data+ora non c'e' un
-- indice unico: due prenotazioni nello stesso istante, una dal modulo lungo e una
-- da quello corto, restano possibili. E' un limite che c'e' gia' oggi fra due
-- moduli lunghi; non si aggiunge un indice unico perche' con doppioni gia'
-- presenti questa migrazione fallirebbe.
CREATE OR REPLACE FUNCTION public.fissa_orario_lead_sito(
  p_id uuid,
  p_chiave text,
  p_data date,
  p_ora text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  -- Gli orari di BookingFunnel quando la riga di funnel_settings manca o e' vuota:
  -- dalle 09:00 alle 21:30 ogni 30 minuti (NON il valore predefinito della colonna).
  v_orari_predefiniti text[] := ARRAY[
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
    '21:00', '21:30'
  ];
  v_impronta text;
  v_lead_id uuid;
  v_time_slots text[];
  v_blocked_weekdays integer[];
  v_blocked_dates date[];
  v_blocked_slots jsonb;
  v_oggi date := (now() AT TIME ZONE 'Europe/Rome')::date;
  v_ora_adesso text := to_char(now() AT TIME ZONE 'Europe/Rome', 'HH24:MI');
BEGIN
  -- (a) Il lead giusto.
  IF p_id IS NULL OR p_chiave IS NULL OR char_length(p_chiave) < 32 THEN
    RETURN 'non_valido';
  END IF;

  v_impronta := encode(sha256(convert_to(p_chiave, 'UTF8')), 'hex');

  SELECT id INTO v_lead_id
    FROM public.public_leads
   WHERE id = p_id
     AND chiave_orario_hash = v_impronta
     AND data_slot IS NULL
     AND ora_slot IS NULL
     AND created_at > now() - interval '2 hours'
     AND assigned_to_user_id IS NULL
     AND status = 'nuovo'
     FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'non_valido';
  END IF;

  -- (b) Un orario valido, con la stessa regola del calendario.
  IF p_data IS NULL OR p_ora IS NULL OR p_ora !~ '^[0-2][0-9]:[0-5][0-9]$' THEN
    RETURN 'non_valido';
  END IF;

  -- La stessa riga che legge il calendario (ORDER BY created_at, la piu' vecchia).
  SELECT time_slots, blocked_weekdays, blocked_dates, blocked_slots
    INTO v_time_slots, v_blocked_weekdays, v_blocked_dates, v_blocked_slots
    FROM public.funnel_settings
   ORDER BY created_at ASC
   LIMIT 1;

  IF NOT FOUND OR v_time_slots IS NULL OR cardinality(v_time_slots) = 0 THEN
    v_time_slots := v_orari_predefiniti;
  END IF;

  IF NOT (p_ora = ANY(v_time_slots)) THEN
    RETURN 'non_valido';
  END IF;

  -- Da oggi in poi sul calendario di Roma; se e' oggi, solo un'ora che deve ancora venire.
  IF p_data < v_oggi OR (p_data = v_oggi AND p_ora <= v_ora_adesso) THEN
    RETURN 'non_valido';
  END IF;

  IF p_data = ANY(v_blocked_dates) THEN
    RETURN 'non_valido';
  END IF;

  -- DOW: 0 = domenica, come getDay() del calendario.
  IF EXTRACT(DOW FROM p_data)::integer = ANY(COALESCE(v_blocked_weekdays, '{}'::integer[])) THEN
    RETURN 'non_valido';
  END IF;

  IF COALESCE(v_blocked_slots -> to_char(p_data, 'YYYY-MM-DD'), '[]'::jsonb) ? p_ora THEN
    RETURN 'non_valido';
  END IF;

  -- (c) L'orario e' libero.
  PERFORM pg_advisory_xact_lock(hashtext('slot:' || p_data || ' ' || p_ora));

  IF EXISTS (
    SELECT 1
      FROM public.public_leads
     WHERE id <> p_id
       AND data_slot = p_data
       AND ora_slot = p_ora
       AND slot_released = false
       AND slot_pending = false
  ) THEN
    RETURN 'occupato';
  END IF;

  UPDATE public.public_leads
     SET data_slot = p_data, ora_slot = p_ora
   WHERE id = p_id;

  RETURN 'fissato';
END;
$fn$;

-- ── 5. Orari gia' presi (pura aggiunta per la sicurezza) ───────────────────
-- Restituisce solo data e ora: la stessa lettura che il calendario fa oggi su
-- public_leads. Nessuna regola di accesso viene toccata da questa migrazione.
CREATE OR REPLACE FUNCTION public.orari_occupati_sito(p_da date)
RETURNS TABLE(data_slot date, ora_slot text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT l.data_slot, l.ora_slot
    FROM public.public_leads l
   WHERE l.data_slot >= p_da
     AND l.slot_released = false
     AND l.slot_pending = false
     AND l.data_slot IS NOT NULL
     AND l.ora_slot IS NOT NULL;
$fn$;

-- ── 6. Chi puo' chiamarle: il sito (anon) e chi e' collegato ───────────────
REVOKE ALL ON FUNCTION public.fissa_orario_lead_sito(uuid, text, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fissa_orario_lead_sito(uuid, text, date, text) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.orari_occupati_sito(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.orari_occupati_sito(date) TO anon, authenticated;
