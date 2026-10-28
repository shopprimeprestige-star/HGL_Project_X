-- ─────────────────────────────────────────────────────────────────────────────
-- WHATSAPP CON MANYCHAT · IL MESSAGGIO DI RITORNO E IL TETTO «TUTTI OGGI»
--
-- Commessa 2026-10-28 (WhatsApp a tutti gli importati e ai lead di ritorno). Il
-- titolare vuole il primo contatto a TUTTI gli importati «da contattare» non
-- ancora scritti, e un messaggio apposito (`hgl_ritorno`) ai contatti di ritorno.
--
-- COSA FA (due cose, entrambe rilanciabili)
--   · manychat_invii.tipo   — il CHECK accetta anche 'ritorno'. Senza questo il
--                             registro rifiuta la riga e il messaggio di ritorno
--                             non parte.
--   · manychat_prenota_giro — SOSTITUITA (stessa firma, stesso ordine dei passi
--                             di S2) con: il tipo 'ritorno' fra i dieci del giro,
--                             contato fra i LEAD NUOVI (con primo_contatto e
--                             richiamo_24h) e sotto la RISERVA di 30 posti per gli
--                             appuntamenti; e il tetto dei lead nuovi alzato da
--                             30 a 100 (= il totale: «tutti oggi»). Il tetto vero
--                             per i lead nuovi resta totale − riserva = 70 al
--                             giorno, e il riquadro può solo ABBASSARLO.
--                             Il TOTALE resta 100, la riserva 30, i ricontatti 20.
--
-- ⚠️ Uguale a `quando.ts` (TETTO_LEAD_NUOVI = TETTO_TOTALE = 100): i due valori si
--    cambiano insieme.
-- ⚠️ ORDINE: dopo 20261025120100_manychat_sequenze.sql. Va applicata a mano dal
--    titolare, DOPO la pubblicazione del codice (il codice nuovo senza questa
--    migrazione: il giro prenota un 'ritorno' e l'SQL risponde «tipo non valido»,
--    l'errore è un codice nei log e il messaggio di ritorno non parte; i primi
--    contatti continuano, ma col tetto vecchio di 30).
-- ⚠️ Applicarla due volte non fa danni: il CHECK si allarga solo se non contiene già
--    'ritorno', la funzione è CREATE OR REPLACE.
-- ⚠️ L'ALTER TABLE prende un ACCESS EXCLUSIVE su manychat_invii: `SET LOCAL
--    lock_timeout = '5s'` fa fallire la migrazione (pulita, senza bloccare il giro
--    di ogni minuto) se non ottiene il lucchetto in 5 secondi. Si rilancia.
--
-- COME SI ANNULLA (solo se serve davvero, DOPO aver spento il giro e senza righe
-- di tipo 'ritorno' nel registro): rimettere il CHECK della migrazione S2 e la
-- funzione di S2 (tetto lead nuovi 30, senza 'ritorno').
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Il CHECK su `tipo` accetta anche 'ritorno' ────────────────────────────
-- Si legge la DEFINIZIONE del vincolo che riguarda la colonna `tipo`: se contiene già
-- 'ritorno' non si fa niente. Altrimenti UN SOLO comando toglie il vincolo trovato e
-- rimette quello largo: la tabella non resta mai senza vincolo.
DO $$
DECLARE
  v_nome text;
  v_def  text;
BEGIN
  SELECT c.conname, pg_get_constraintdef(c.oid)
    INTO v_nome, v_def
    FROM pg_constraint c
   WHERE c.conrelid = 'public.manychat_invii'::regclass
     AND c.contype = 'c'
     AND c.conkey = ARRAY[(
           SELECT a.attnum FROM pg_attribute a
            WHERE a.attrelid = c.conrelid AND a.attname = 'tipo' AND NOT a.attisdropped
         )]
   LIMIT 1;

  IF v_def IS NOT NULL AND v_def LIKE '%''ritorno''%' THEN
    RETURN; -- già allargato: niente da fare
  END IF;

  SET LOCAL lock_timeout = '5s';

  IF v_nome IS NULL THEN
    -- nessun vincolo sul tipo (qualcuno l'ha tolto): si rimette soltanto
    ALTER TABLE public.manychat_invii
      ADD CONSTRAINT manychat_invii_tipo_check
      CHECK (tipo IN ('promemoria', 'ricontatto', 'conferma', 'chat', 'webinar', 'prova',
                      'primo_contatto', 'richiamo_24h', 'meet_oggi', 'meet_domani',
                      'meet_adesso', 'promemoria_chiamata', 'promemoria_sede', 'ritorno'));
  ELSE
    EXECUTE format(
      'ALTER TABLE public.manychat_invii DROP CONSTRAINT %I, ADD CONSTRAINT manychat_invii_tipo_check CHECK (tipo IN (%s))',
      v_nome,
      '''promemoria'', ''ricontatto'', ''conferma'', ''chat'', ''webinar'', ''prova'', '
      '''primo_contatto'', ''richiamo_24h'', ''meet_oggi'', ''meet_domani'', '
      '''meet_adesso'', ''promemoria_chiamata'', ''promemoria_sede'', ''ritorno'''
    );
  END IF;
END $$;

-- ── 2. La prenotazione di un invio del giro, con 'ritorno' e il tetto alzato ──
-- Risponde {id} se l'invio è prenotato, o {motivo} se no: tetto_totale ·
-- tetto_ricontatti · tetto_lead_nuovi · stop · pausa_contatto · ritmo · gia_preso ·
-- dati_mancanti · manca_riga_giro. L'ordine dei passi è quello di S2 e non si cambia.
-- Il ritmo di 27-33' lo prendono e lo aspettano solo `ricontatto` e `richiamo_24h`:
-- il ritorno, come il primo contatto, non lo tocca.
CREATE OR REPLACE FUNCTION public.manychat_prenota_giro(
  p_user_id uuid,
  p jsonb,
  p_tetti jsonb,
  p_intervallo_min integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pausa_s     constant int := 120;
  v_tetto_ric   constant int := 20;
  v_tetto_ln    constant int := 100;
  v_tetto_tot   constant int := 100;
  v_tetto_prima constant int := 10;
  v_riserva     constant int := 30;
  v_tel       text := regexp_replace(coalesce(p->>'telefono', ''), '\D', '', 'g');
  v_tipo      text := p->>'tipo';
  v_chiave    text := nullif(p->>'chiave', '');
  v_oggi      date := (now() AT TIME ZONE 'Europe/Rome')::date;
  v_da        timestamptz;
  v_a         timestamptz;
  v_prima     timestamptz;
  v_max_ric   int;
  v_max_ln    int;
  v_max_tot   int;
  v_ric       int;
  v_ln        int;
  v_tot       int;
  v_limite    int;
  v_ritmo     timestamptz;
  v_i         int;
  v_id        uuid;
BEGIN
  IF p_user_id IS NULL OR v_tel = '' THEN
    RETURN jsonb_build_object('motivo', 'dati_mancanti');
  END IF;
  IF v_tipo IS NULL OR v_tipo NOT IN (
       'promemoria', 'ricontatto', 'primo_contatto', 'richiamo_24h', 'ritorno',
       'meet_oggi', 'meet_domani', 'meet_adesso', 'promemoria_chiamata',
       'promemoria_sede') THEN
    RAISE EXCEPTION 'manychat_prenota_giro: tipo non valido';
  END IF;

  -- 1. in fila sulla riga del giro; poi il «prenotato» vecchio diventa «incerto»
  SELECT prossimo_ricontatto_dopo INTO v_ritmo FROM public.manychat_giro WHERE id = 1 FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('motivo', 'manca_riga_giro');
  END IF;

  UPDATE public.manychat_invii
     SET stato = 'incerto', motivo = coalesce(motivo, 'prenotato_scaduto')
   WHERE user_id = p_user_id
     AND stato = 'prenotato'
     AND prenotato_il < now() - interval '10 minutes';

  -- 2. i tetti di oggi (giorno di Roma)
  v_da := v_oggi::timestamp AT TIME ZONE 'Europe/Rome';
  v_a  := (v_oggi + 1)::timestamp AT TIME ZONE 'Europe/Rome';
  SELECT prima_accensione INTO v_prima FROM public.manychat_config WHERE id = 1;

  -- Il riquadro può solo ABBASSARE: testo, negativi e valori enormi non contano.
  v_max_ric := v_tetto_ric;
  IF coalesce(p_tetti->>'ricontatti', '') ~ '^\d{1,6}$' THEN
    v_max_ric := LEAST(v_tetto_ric, (p_tetti->>'ricontatti')::int);
  END IF;
  v_max_ln := v_tetto_ln;
  IF coalesce(p_tetti->>'leadNuovi', '') ~ '^\d{1,6}$' THEN
    v_max_ln := LEAST(v_tetto_ln, (p_tetti->>'leadNuovi')::int);
  END IF;
  v_max_tot := v_tetto_tot;
  IF coalesce(p_tetti->>'totale', '') ~ '^\d{1,6}$' THEN
    v_max_tot := LEAST(v_tetto_tot, (p_tetti->>'totale')::int);
  END IF;
  IF now() < coalesce(v_prima, now()) + interval '7 days' THEN
    v_max_ric := LEAST(v_max_ric, v_tetto_prima);
  END IF;

  SELECT count(*) FILTER (WHERE tipo = 'ricontatto'),
         count(*) FILTER (WHERE tipo IN ('primo_contatto', 'richiamo_24h', 'ritorno')),
         count(*)
    INTO v_ric, v_ln, v_tot
    FROM public.manychat_invii
   WHERE user_id = p_user_id
     AND tipo IN ('promemoria', 'ricontatto', 'primo_contatto', 'richiamo_24h', 'ritorno',
                  'meet_oggi', 'meet_domani', 'meet_adesso', 'promemoria_chiamata',
                  'promemoria_sede')
     AND stato IN ('prenotato', 'inviato', 'incerto')
     AND prenotato_il >= v_da AND prenotato_il < v_a;

  -- La RISERVA: primo contatto, richiamo e ricontatto contano contro il totale
  -- meno 30 posti, che restano agli appuntamenti (mai sotto zero).
  v_limite := v_max_tot;
  IF v_tipo IN ('primo_contatto', 'richiamo_24h', 'ritorno', 'ricontatto') THEN
    v_limite := GREATEST(v_max_tot - v_riserva, 0);
  END IF;
  IF v_tot >= v_limite THEN
    RETURN jsonb_build_object('motivo', 'tetto_totale');
  END IF;
  IF v_tipo = 'ricontatto' AND v_ric >= v_max_ric THEN
    RETURN jsonb_build_object('motivo', 'tetto_ricontatti');
  END IF;
  IF v_tipo IN ('primo_contatto', 'richiamo_24h', 'ritorno') AND v_ln >= v_max_ln THEN
    RETURN jsonb_build_object('motivo', 'tetto_lead_nuovi');
  END IF;

  -- 3. STOP
  IF EXISTS (
    SELECT 1 FROM public.whatsapp_contacts c
     WHERE c.user_id = p_user_id
       AND c.non_scrivere_dal IS NOT NULL
       AND (c.phone_e164 = '+' || v_tel OR ltrim(c.phone_e164, '+') = v_tel)
  ) THEN
    RETURN jsonb_build_object('motivo', 'stop');
  END IF;

  -- 4. la pausa per contatto
  IF EXISTS (
    SELECT 1 FROM public.manychat_invii i
     WHERE i.user_id = p_user_id
       AND i.telefono = v_tel
       AND i.stato IN ('prenotato', 'inviato', 'incerto')
       AND coalesce(i.inviato_il, i.prenotato_il) > now() - make_interval(secs => v_pausa_s)
  ) THEN
    RETURN jsonb_build_object('motivo', 'pausa_contatto');
  END IF;

  -- 5. il ritmo, solo in lettura (il posto si prende al passo 7): lo aspettano
  --    soltanto il ricontatto e il richiamo a 24 ore
  IF v_tipo IN ('ricontatto', 'richiamo_24h')
     AND coalesce(v_ritmo, '-infinity'::timestamptz) > now() THEN
    RETURN jsonb_build_object('motivo', 'ritmo');
  END IF;

  -- 6. l'inserimento: la chiave unica è l'ultimo cancello
  INSERT INTO public.manychat_invii (user_id, lead_id, tipo, chiave, telefono, flow_ns, previsto_il)
  VALUES (p_user_id, nullif(p->>'lead_id', '')::uuid, v_tipo, v_chiave, v_tel,
          nullif(p->>'flow_ns', ''), nullif(p->>'previsto_il', '')::timestamptz)
  ON CONFLICT (chiave) WHERE chiave IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('motivo', 'gia_preso');
  END IF;

  -- 7. SOLO ORA il posto del ritmo (27-33 minuti, qualunque cosa chieda il giro),
  --    e solo per i due tipi che lo aspettano
  IF v_tipo IN ('ricontatto', 'richiamo_24h') THEN
    v_i := GREATEST(27, LEAST(33, coalesce(p_intervallo_min, 30)));
    UPDATE public.manychat_giro
       SET prossimo_ricontatto_dopo = now() + make_interval(mins => v_i)
     WHERE id = 1;
  END IF;

  RETURN jsonb_build_object('id', v_id);
END $$;

-- ── 3. Solo il server la chiama ──────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.manychat_prenota_giro(uuid, jsonb, jsonb, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manychat_prenota_giro(uuid, jsonb, jsonb, integer) TO service_role;

RESET lock_timeout;

-- Il server la trova subito, senza aspettare che la cache dello schema si rinnovi da sola.
NOTIFY pgrst, 'reload schema';
