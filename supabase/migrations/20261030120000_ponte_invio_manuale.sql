-- ─────────────────────────────────────────────────────────────────────────────
-- IL PONTE WHATSAPP · INVIO A MANO DOPO LE 24 ORE · la coda e le sue regole
--
-- Commessa 2026-10-30-ponte-invio-manuale (T1, PIANO §2). Dalla casella della
-- chat, dopo le 24 ore, una persona scrive a mano un testo: il CRM lo mette in
-- una CODA (ponte_wa_invii); il ponte sul Mac la legge, manda il messaggio col
-- suo collegamento e riporta l'esito. Questa migrazione crea la coda e le tre
-- funzioni che la governano. Il codice che le chiama sta in src/crm/ponte/
-- (invio-giro.ts, invio.server.ts).
--
-- COSA AGGIUNGE (solo aggiunte: nessuna riga esistente viene riscritta)
--   · ponte_wa_invii — una riga per messaggio: stato in_attesa → in_invio →
--     inviato | non_inviato. L'utente la LEGGE (RLS, solo le sue righe); scrive
--     solo il server con la chiave di servizio.
--   · ponte_wa_invio_fatti — solo lettura: «ha già una chat» (un messaggio in
--     entrata, qualunque canale), STOP, stato del ponte, quanti prelievi nelle
--     ultime 24 ore e quante righe aperte. Il server la chiama prima di accodare.
--   · ponte_wa_invii_prendi — il prelievo ATOMICO: sotto un lucchetto per utente
--     scade ciò che è vecchio, ricontrolla intervallo, tetto giornaliero, STOP e
--     «ha già una chat», e porta UNA riga da in_attesa a in_invio. Una riga
--     in_invio non viene MAI riofferta: un doppio invio è peggio di un invio perso.
--   · ponte_wa_invio_esito — il Mac riporta l'esito. Se è «inviato» scrive, nella
--     STESSA transazione, la riga del messaggio in whatsapp_messages con la stessa
--     chiave bw:<numero>:<id> che avrà l'eco del ponte (ON CONFLICT DO NOTHING:
--     nessun doppione in nessuno dei due ordini) e porta avanti, sul contatto,
--     last_message_at e risposto_il (la chat esce da «Da rispondere», come per
--     ogni uscita dal telefono). Mai i non letti, l'ultima entrata, la scheda,
--     l'id ManyChat, lo STOP.
--
-- I NUMERI DEI LIMITI (20 secondi, 20 al giorno, 10 minuti, 3 minuti) NON stanno
-- qui: arrivano come parametri da src/crm/ponte/invio-tipi.ts (LIMITI_INVIO), un
-- posto solo. «Al giorno» = finestra mobile di 24 ore sui prelievi (preso_il);
-- un prelievo conta anche se poi fallisce.
--
-- ⚠️ CHI PUÒ CHIAMARE: le tre funzioni si fidano di p_user_id, quindi SOLO il
--    server (REVOKE da PUBLIC, anon e authenticated; GRANT a service_role).
-- ⚠️ La tabella contiene il TESTO dei messaggi dei clienti: REVOKE ALL da anon e
--    authenticated (su Supabase ricevono di serie anche INSERT, UPDATE e DELETE;
--    la sola RLS non basta), poi GRANT SELECT ad authenticated.
-- ⚠️ ORDINE: dopo 20261029120000_ponte_whatsapp.sql (ponte_wa_stato,
--    whatsapp_contacts.origine) e 20261028120000_chat_whatsapp_crm.sql.
-- ⚠️ Applicarla due volte non fa danni (IF NOT EXISTS, OR REPLACE).
-- ⚠️ Il codice pubblicato funziona anche SENZA questa migrazione: la rotta del
--    browser risponde 503 «migrazione», il tasto «Scrivi dal telefono» non
--    compare e il ponte già online continua a importare i messaggi come oggi.
-- ⚠️ NON la lancia la squadra: la applica il titolare, dopo averla letta e dopo
--    il collaudo prove/sql/ponte-invio.sql su un database di prova.
--
-- COME SI ANNULLA (solo se serve davvero; MAI eseguito dalla squadra):
--   DROP FUNCTION public.ponte_wa_invio_esito(uuid, uuid, text, text, double precision, text);
--   DROP FUNCTION public.ponte_wa_invii_prendi(uuid, integer, integer, integer, integer);
--   DROP FUNCTION public.ponte_wa_invio_fatti(uuid, text);
--   DROP TABLE public.ponte_wa_invii;
--   Le righe bw: già scritte in whatsapp_messages restano: sono messaggi veri.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. La coda ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ponte_wa_invii (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  -- scelta dal browser: un doppio tocco con la stessa chiave è la stessa riga
  chiave text NOT NULL CHECK (chiave ~ '^[A-Za-z0-9_-]{8,64}$'),
  numero text NOT NULL CHECK (numero ~ '^[0-9]{8,15}$'),
  testo text NOT NULL CHECK (char_length(testo) BETWEEN 1 AND 2000),
  stato text NOT NULL DEFAULT 'in_attesa'
    CHECK (stato IN ('in_attesa', 'in_invio', 'inviato', 'non_inviato')),
  -- solo con non_inviato; l'elenco chiuso è MOTIVI_INVIO in invio-tipi.ts
  motivo text CHECK (motivo IS NULL OR motivo ~ '^[a-z_]+$'),
  creato_da text CHECK (creato_da IS NULL OR char_length(creato_da) <= 80),
  wa_message_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  preso_il timestamptz,
  inviato_il timestamptz,
  aggiornato_il timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ponte_invii_chiave
  ON public.ponte_wa_invii (user_id, chiave);
CREATE INDEX IF NOT EXISTS idx_ponte_invii_aperti
  ON public.ponte_wa_invii (user_id, created_at)
  WHERE stato IN ('in_attesa', 'in_invio');
CREATE INDEX IF NOT EXISTS idx_ponte_invii_presi
  ON public.ponte_wa_invii (user_id, preso_il DESC)
  WHERE preso_il IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ponte_invii_chat
  ON public.ponte_wa_invii (user_id, numero, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ponte_invii_wa_id
  ON public.ponte_wa_invii (user_id, wa_message_id)
  WHERE wa_message_id IS NOT NULL;

ALTER TABLE public.ponte_wa_invii ENABLE ROW LEVEL SECURITY;

-- Una sola policy, di lettura. Nessuna di scrittura: scrive il server con la
-- chiave di servizio, che non passa dalla RLS. Chi entra col PIN usa la sessione
-- Supabase del titolare, quindi legge le sue righe come legge whatsapp_messages.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'ponte_wa_invii'
       AND policyname = 'users read own ponte invii'
  ) THEN
    CREATE POLICY "users read own ponte invii"
      ON public.ponte_wa_invii FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $do$;

-- Prima si toglie tutto (i permessi di serie di Supabase includono la scrittura),
-- poi si dà la sola lettura.
REVOKE ALL ON public.ponte_wa_invii FROM anon, authenticated;
GRANT SELECT ON public.ponte_wa_invii TO authenticated;
GRANT ALL ON public.ponte_wa_invii TO service_role;

-- ── 2a. I fatti di una chat (solo lettura) ───────────────────────────────────
-- entrata: il cliente ci ha scritto almeno una volta, da qualunque canale
-- (anche il ponte stesso), oppure il contatto ha un'ultima entrata.
-- stop: il contatto ha chiesto di non essere contattato.
-- Il numero è in cifre, come in ponte_wa_invii.numero; i messaggi e i contatti
-- possono averlo col «+» o senza.
CREATE OR REPLACE FUNCTION public.ponte_wa_invio_fatti(p_user_id uuid, p_numero text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_entrata boolean := false;
  v_stop    boolean := false;
  v_stato   text;
  v_battito timestamptz;
  v_attivi  boolean := false;
  v_ultime  int := 0;
  v_coda    int := 0;
BEGIN
  IF p_user_id IS NOT NULL THEN
    IF p_numero ~ '^[0-9]{8,15}$' THEN
      SELECT EXISTS (
               SELECT 1 FROM public.whatsapp_messages w
                WHERE w.user_id = p_user_id
                  AND w.direction = 'inbound'
                  AND w.from_number IN ('+' || p_numero, p_numero))
          OR EXISTS (
               SELECT 1 FROM public.whatsapp_contacts x
                WHERE x.user_id = p_user_id
                  AND x.phone_e164 IN ('+' || p_numero, p_numero)
                  AND x.ultimo_in_entrata_il IS NOT NULL)
        INTO v_entrata;
      SELECT EXISTS (
               SELECT 1 FROM public.whatsapp_contacts x
                WHERE x.user_id = p_user_id
                  AND x.phone_e164 IN ('+' || p_numero, p_numero)
                  AND x.non_scrivere_dal IS NOT NULL)
        INTO v_stop;
    END IF;

    SELECT s.stato, s.aggiornato_il,
           CASE WHEN jsonb_typeof(s.contatori -> 'invii_attivi') = 'number'
                THEN (s.contatori ->> 'invii_attivi')::numeric = 1
                ELSE false END
      INTO v_stato, v_battito, v_attivi
      FROM public.ponte_wa_stato s
     WHERE s.user_id = p_user_id;

    SELECT count(*) FILTER (WHERE i.preso_il > now() - interval '24 hours'),
           count(*) FILTER (WHERE i.stato IN ('in_attesa', 'in_invio'))
      INTO v_ultime, v_coda
      FROM public.ponte_wa_invii i
     WHERE i.user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'entrata',       coalesce(v_entrata, false),
    'stop',          coalesce(v_stop, false),
    'ponte_stato',   v_stato,
    'ponte_battito', v_battito,
    'invii_attivi',  coalesce(v_attivi, false),
    'ultime24h',     coalesce(v_ultime, 0),
    'in_coda',       coalesce(v_coda, 0)
  );
END $$;

-- ── 2b. Il prelievo atomico ──────────────────────────────────────────────────
-- Nell'ordine, sotto un lucchetto per utente (due richieste insieme si mettono
-- in fila, quindi non c'è bisogno di nient'altro):
--   1. in_attesa più vecchie di p_scadenza_min → non_inviato «scaduto»;
--   2. in_invio con preso_il più vecchio di p_incerto_min → non_inviato
--      «esito_incerto» (il Mac non ha riportato: non si sa se è partito);
--   3. nessuna in_attesa → coda vuota, il Mac si ferma (attendi_s 0);
--   4. l'ultimo prelievo è più recente di p_intervallo_s → aspetta;
--   5. i prelievi delle ultime 24 ore sono già p_al_giorno → aspetta (al più 1 ora);
--   6. prende la più vecchia in_attesa: STOP → non_inviato «stop», mai scritto →
--      non_inviato «mai_scritto» (e passa alla successiva); altrimenti in_invio.
-- Nessuna pulizia delle righe vecchie qui: la fa l'accodamento (azione rara).
CREATE OR REPLACE FUNCTION public.ponte_wa_invii_prendi(
  p_user_id uuid,
  p_intervallo_s int,
  p_al_giorno int,
  p_scadenza_min int,
  p_incerto_min int
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_scaduti  int := 0;
  v_incerti  int := 0;
  v_respinti int := 0;
  v_ultimo   timestamptz;
  v_vecchio  timestamptz;
  v_presi    int;
  v_attendi  int;
  v_fatti    jsonb;
  r          public.ponte_wa_invii%ROWTYPE;
BEGIN
  IF p_user_id IS NULL OR p_intervallo_s IS NULL OR p_al_giorno IS NULL
     OR p_scadenza_min IS NULL OR p_incerto_min IS NULL
     OR p_intervallo_s < 0 OR p_al_giorno < 1 OR p_scadenza_min < 1 OR p_incerto_min < 1 THEN
    RAISE EXCEPTION 'parametri_non_validi';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('ponte_invii:' || p_user_id::text, 0));

  -- 1. Ciò che è rimasto in attesa troppo a lungo non parte più.
  UPDATE public.ponte_wa_invii i
     SET stato = 'non_inviato', motivo = 'scaduto', aggiornato_il = now()
   WHERE i.user_id = p_user_id
     AND i.stato = 'in_attesa'
     AND i.created_at < now() - make_interval(mins => p_scadenza_min);
  GET DIAGNOSTICS v_scaduti = ROW_COUNT;

  -- 2. Ciò che è rimasto in invio senza esito: non si sa se è partito. Non viene
  --    mai riofferto; riprovare è una scelta di una persona.
  UPDATE public.ponte_wa_invii i
     SET stato = 'non_inviato', motivo = 'esito_incerto', aggiornato_il = now()
   WHERE i.user_id = p_user_id
     AND i.stato = 'in_invio'
     AND coalesce(i.preso_il, i.created_at) < now() - make_interval(mins => p_incerto_min);
  GET DIAGNOSTICS v_incerti = ROW_COUNT;

  -- 3. Coda vuota.
  IF NOT EXISTS (SELECT 1 FROM public.ponte_wa_invii i WHERE i.user_id = p_user_id AND i.stato = 'in_attesa') THEN
    RETURN jsonb_build_object('invio', NULL, 'attendi_s', 0, 'limite', false,
                              'scaduti', v_scaduti, 'incerti', v_incerti, 'respinti', 0);
  END IF;

  -- 4. L'intervallo fra due prelievi.
  SELECT max(i.preso_il) INTO v_ultimo
    FROM public.ponte_wa_invii i
   WHERE i.user_id = p_user_id AND i.preso_il IS NOT NULL;
  IF v_ultimo IS NOT NULL AND v_ultimo > now() - make_interval(secs => p_intervallo_s) THEN
    v_attendi := greatest(1, ceil(extract(epoch FROM (v_ultimo + make_interval(secs => p_intervallo_s) - now()))))::int;
    RETURN jsonb_build_object('invio', NULL, 'attendi_s', v_attendi, 'limite', false,
                              'scaduti', v_scaduti, 'incerti', v_incerti, 'respinti', 0);
  END IF;

  -- 5. Il tetto delle ultime 24 ore (finestra mobile sui prelievi).
  SELECT count(*), min(i.preso_il) INTO v_presi, v_vecchio
    FROM public.ponte_wa_invii i
   WHERE i.user_id = p_user_id AND i.preso_il > now() - interval '24 hours';
  IF v_presi >= p_al_giorno THEN
    v_attendi := least(3600, greatest(1, ceil(extract(epoch FROM (v_vecchio + interval '24 hours' - now())))))::int;
    RETURN jsonb_build_object('invio', NULL, 'attendi_s', v_attendi, 'limite', true,
                              'scaduti', v_scaduti, 'incerti', v_incerti, 'respinti', 0);
  END IF;

  -- 6. La più vecchia in attesa, ricontrollando STOP e «ha già una chat».
  LOOP
    SELECT * INTO r
      FROM public.ponte_wa_invii i
     WHERE i.user_id = p_user_id AND i.stato = 'in_attesa'
     ORDER BY i.created_at, i.id
     LIMIT 1;
    EXIT WHEN NOT FOUND;

    v_fatti := public.ponte_wa_invio_fatti(p_user_id, r.numero);
    IF (v_fatti ->> 'stop')::boolean THEN
      UPDATE public.ponte_wa_invii SET stato = 'non_inviato', motivo = 'stop', aggiornato_il = now() WHERE id = r.id;
      v_respinti := v_respinti + 1;
    ELSIF NOT (v_fatti ->> 'entrata')::boolean THEN
      UPDATE public.ponte_wa_invii SET stato = 'non_inviato', motivo = 'mai_scritto', aggiornato_il = now() WHERE id = r.id;
      v_respinti := v_respinti + 1;
    ELSE
      UPDATE public.ponte_wa_invii SET stato = 'in_invio', preso_il = now(), aggiornato_il = now() WHERE id = r.id;
      RETURN jsonb_build_object(
        'invio', jsonb_build_object('id', r.id, 'numero', r.numero, 'testo', r.testo),
        'attendi_s', 0, 'limite', false,
        'scaduti', v_scaduti, 'incerti', v_incerti, 'respinti', v_respinti);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('invio', NULL, 'attendi_s', 0, 'limite', false,
                            'scaduti', v_scaduti, 'incerti', v_incerti, 'respinti', v_respinti);
END $$;

-- ── 2c. L'esito riportato dal Mac ────────────────────────────────────────────
-- «inviato» è ammesso da in_invio e da non_inviato/esito_incerto (la verità vince
-- sul dubbio); NON da una riga tornata in_attesa dopo un riprova (un esito tardivo
-- del primo tentativo non deve chiudere il secondo). Ripetuto: ok, nuovo=false.
-- «errore» è ammesso solo da in_invio. L'ora vera è p_ts se cade fra un minuto
-- prima del prelievo e dieci minuti nel futuro, altrimenti quella del database.
CREATE OR REPLACE FUNCTION public.ponte_wa_invio_esito(
  p_user_id uuid,
  p_id uuid,
  p_esito text,
  p_wa_id text,
  p_ts double precision,
  p_motivo text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  r        public.ponte_wa_invii%ROWTYPE;
  v_ora    timestamptz;
  v_motivo text;
  v_cid    uuid;
  v_valido boolean;
BEGIN
  IF p_user_id IS NULL OR p_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'stato', NULL, 'nuovo', false);
  END IF;

  SELECT * INTO r
    FROM public.ponte_wa_invii i
   WHERE i.id = p_id AND i.user_id = p_user_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'stato', NULL, 'nuovo', false);
  END IF;

  IF p_esito = 'inviato' THEN
    IF r.stato = 'inviato' THEN
      RETURN jsonb_build_object('ok', true, 'stato', r.stato, 'nuovo', false);
    END IF;
    IF coalesce(p_wa_id, '') !~ '^[A-Za-z0-9_.-]{1,128}$'
       OR NOT (r.stato = 'in_invio' OR (r.stato = 'non_inviato' AND r.motivo = 'esito_incerto')) THEN
      RETURN jsonb_build_object('ok', false, 'stato', r.stato, 'nuovo', false);
    END IF;

    v_ora := now();
    -- (CASE: il controllo dell'intervallo viene prima, to_timestamp non vede mai NaN)
    v_valido := CASE WHEN p_ts BETWEEN 1230768000 AND 4102444800
                     THEN to_timestamp(p_ts) BETWEEN coalesce(r.preso_il, r.created_at) - interval '60 seconds'
                                                 AND now() + interval '10 minutes'
                     ELSE false END;
    IF v_valido THEN
      v_ora := to_timestamp(p_ts);
    END IF;

    UPDATE public.ponte_wa_invii
       SET stato = 'inviato', motivo = NULL, wa_message_id = p_wa_id,
           inviato_il = v_ora, aggiornato_il = now()
     WHERE id = r.id;

    -- La riga del messaggio, con la chiave che avrà anche l'eco del ponte: chi
    -- arriva per primo scrive, l'altro trova ON CONFLICT e non fa niente.
    INSERT INTO public.whatsapp_messages (
      user_id, wa_message_id, direction, from_number, to_number, body,
      status, canale, created_at, raw_payload
    ) VALUES (
      p_user_id, 'bw:' || r.numero || ':' || p_wa_id, 'outbound', 'baileys', '+' || r.numero, r.testo,
      'sent', 'baileys', v_ora, '{}'::jsonb
    )
    ON CONFLICT (wa_message_id) DO NOTHING;

    -- Il contatto: ultimo messaggio e «risposto» in avanti (orario vero, mai nel
    -- futuro). Se manca nasce come quelli del ponte.
    SELECT x.id INTO v_cid
      FROM public.whatsapp_contacts x
     WHERE x.user_id = p_user_id AND x.phone_e164 IN ('+' || r.numero, r.numero)
     ORDER BY (x.phone_e164 = '+' || r.numero) DESC
     LIMIT 1
       FOR UPDATE;
    IF v_cid IS NOT NULL THEN
      UPDATE public.whatsapp_contacts x
         SET last_message_at = greatest(x.last_message_at, v_ora),
             risposto_il     = greatest(coalesce(x.risposto_il, '-infinity'), least(v_ora, now())),
             updated_at      = now()
       WHERE x.id = v_cid;
    ELSE
      INSERT INTO public.whatsapp_contacts AS w (user_id, phone_e164, last_message_at, risposto_il, origine)
      VALUES (p_user_id, '+' || r.numero, v_ora, least(v_ora, now()), 'baileys')
      ON CONFLICT (user_id, phone_e164) DO UPDATE
         SET last_message_at = greatest(w.last_message_at, excluded.last_message_at),
             risposto_il     = greatest(coalesce(w.risposto_il, '-infinity'), excluded.risposto_il),
             updated_at      = now();
    END IF;

    RETURN jsonb_build_object('ok', true, 'stato', 'inviato', 'nuovo', true);
  END IF;

  IF p_esito = 'errore' THEN
    IF r.stato = 'non_inviato' THEN
      RETURN jsonb_build_object('ok', true, 'stato', r.stato, 'nuovo', false);
    END IF;
    IF r.stato <> 'in_invio' THEN
      RETURN jsonb_build_object('ok', false, 'stato', r.stato, 'nuovo', false);
    END IF;
    v_motivo := CASE WHEN p_motivo = ANY (ARRAY[
                          'mai_scritto', 'stop', 'scaduto', 'non_collegato', 'numero_non_valido',
                          'testo_non_valido', 'limite_ponte', 'esito_incerto', 'errore_invio'])
                     THEN p_motivo ELSE 'errore_invio' END;
    UPDATE public.ponte_wa_invii
       SET stato = 'non_inviato', motivo = v_motivo, aggiornato_il = now()
     WHERE id = r.id;
    RETURN jsonb_build_object('ok', true, 'stato', 'non_inviato', 'nuovo', true);
  END IF;

  RETURN jsonb_build_object('ok', false, 'stato', r.stato, 'nuovo', false);
END $$;

-- ── 3. Chi può chiamare cosa: SOLO il server ─────────────────────────────────
-- Su Supabase `authenticated` ha il permesso di serie, quindi va tolto in modo
-- esplicito.
REVOKE ALL ON FUNCTION public.ponte_wa_invio_fatti(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ponte_wa_invii_prendi(uuid, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ponte_wa_invio_esito(uuid, uuid, text, text, double precision, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ponte_wa_invio_fatti(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.ponte_wa_invii_prendi(uuid, integer, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.ponte_wa_invio_esito(uuid, uuid, text, text, double precision, text) TO service_role;

NOTIFY pgrst, 'reload schema';
