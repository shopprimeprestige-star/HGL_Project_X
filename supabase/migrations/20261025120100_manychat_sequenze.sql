-- ─────────────────────────────────────────────────────────────────────────────
-- WHATSAPP CON MANYCHAT · LE SEQUENZE (S2)
--
-- Commessa 2026-10-25 (Lead da Google Sheets + sequenze anti no-show). Il giro
-- a orario impara quattro messaggi in più per i lead e per il giorno del meet
-- (primo contatto, richiamo a 24 ore, mattina del meet, ora esatta col link) e
-- due promemoria legati a un appuntamento preso (chiamata concordata,
-- appuntamento in sede). I messaggi «per stato» restano `tipo = 'ricontatto'`.
--
-- COSA FA
--   · manychat_config   — cinque colonne nuove, tutte spente / vuote di serie:
--                         lead_nuovo, giorno_meet, lead_nuovo_dal, stati (stato →
--                         ora dell'accensione), indirizzo_sede.
--   · manychat_invii    — il CHECK su `tipo` SI ALLARGA da 6 a 12 valori. È l'UNICA
--                         eccezione alla regola «niente DROP» di questa serie: un
--                         solo ALTER TABLE atomico che toglie il vincolo e rimette
--                         lo stesso, più largo. Nessuna riga cambia. Vedi sotto.
--   · manychat_prenota_giro — SOSTITUITA (stessa firma, stesso ordine dei passi
--                         di M2) con: gli otto tipi del giro, il tetto dei lead
--                         nuovi (30), il totale a 100 con una RISERVA di 30 posti
--                         per gli appuntamenti, e il RITMO 27-33' che vale solo
--                         per `ricontatto` e `richiamo_24h`.
--   · manychat_controlli_unisci — scrive UNA parte di `manychat_config.controlli`
--                         in un solo UPDATE, senza riscrivere il resto.
--
-- IL RITMO (scelta del revisore): fino a M2 ogni invio, promemoria compreso,
-- spostava `prossimo_ricontatto_dopo` di 27-33 minuti. Con primi contatti e
-- messaggi del giorno del meet (circa 40 invii in 11 ore) il ritmo resterebbe
-- sempre avanti, e richiami, ricontatti e messaggi a evento scadrebbero in coda.
-- Da qui in poi il ritmo lo prendono e lo aspettano SOLO `ricontatto` e
-- `richiamo_24h`: gli altri sei tipi, promemoria compreso, non lo toccano.
--
-- I TETTI (costanti, il riquadro può solo abbassare; uguali a quando.ts):
--   · ricontatti: 20 al giorno, 10 nella prima settimana (invariati);
--   · lead nuovi (primo_contatto + richiamo_24h): 30 al giorno;
--   · totale degli otto tipi del giro: 100 al giorno (era 40);
--   · RISERVA: primo_contatto, richiamo_24h e ricontatto contano contro
--     `totale - 30`, gli altri cinque contro `totale`. Così, anche con il totale
--     abbassato a 40, i primi contatti del mattino si fermano a 10 e restano 30
--     posti per il messaggio delle 18:00 col link.
--
-- ⚠️ ORDINE: dopo M2 (20261023120100_manychat_giro.sql) e dopo la migrazione del
--    riquadro (20261023120150_manychat_pannello.sql, serve la colonna
--    `controlli`). Va applicata a mano, dopo la pubblicazione del codice.
-- ⚠️ Applicarla due volte non fa danni: ADD COLUMN IF NOT EXISTS, CREATE OR
--    REPLACE e il CHECK si allarga solo se non contiene già 'promemoria_sede'
--    (si legge la DEFINIZIONE del vincolo, non il suo nome).
-- ⚠️ Il codice pubblicato funziona anche SENZA questa migrazione: i due
--    interruttori nuovi e i messaggi per stato risultano spenti, il riquadro dice
--    «manca l'aggiornamento del database» e il giro resta identico a prima.
-- ⚠️ L'ALTER TABLE prende un ACCESS EXCLUSIVE su manychat_invii: `SET LOCAL
--    lock_timeout = '5s'` fa fallire la migrazione (pulita, senza bloccare il
--    giro di ogni minuto) se non ottiene il lucchetto in 5 secondi. Si rilancia.
-- ⚠️ Collaudo su Postgres vero obbligatorio prima della produzione (PIANO §8):
--    questa migrazione e le tre prima, due volte di fila, più una transazione
--    aperta su manychat_invii per vedere il lock_timeout.
--
-- COME SI ANNULLA (solo se serve davvero, e DOPO aver spento il giro; prima
-- non ci devono essere righe dei tipi nuovi in manychat_invii, altrimenti il
-- vincolo non si rimette):
--   -- 1. il CHECK di M1, testuale:
--   ALTER TABLE public.manychat_invii
--     DROP CONSTRAINT manychat_invii_tipo_check,
--     ADD CONSTRAINT manychat_invii_tipo_check
--       CHECK (tipo IN ('promemoria', 'ricontatto', 'conferma', 'chat', 'webinar', 'prova'));
--   -- 2. le colonne:
--   ALTER TABLE public.manychat_config
--     DROP COLUMN lead_nuovo, DROP COLUMN giorno_meet, DROP COLUMN lead_nuovo_dal,
--     DROP COLUMN stati, DROP COLUMN indirizzo_sede;
--   -- 3. la funzione scritta in M2 (testo qui sotto) e questa:
--   DROP FUNCTION public.manychat_controlli_unisci(uuid, jsonb);
--
-- manychat_prenota_giro COM'ERA IN M2 (20261023120100_manychat_giro.sql), per
-- tornare indietro: rilanciare quel file, oppure questo testo.
--   CREATE OR REPLACE FUNCTION public.manychat_prenota_giro(
--     p_user_id uuid, p jsonb, p_tetti jsonb, p_intervallo_min integer
--   ) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
--   DECLARE
--     v_pausa_s   constant int := 120;
--     v_tetto_ric constant int := 20;
--     v_tetto_tot constant int := 40;
--     v_tetto_prima constant int := 10;
--     v_tel       text := regexp_replace(coalesce(p->>'telefono', ''), '\D', '', 'g');
--     v_tipo      text := p->>'tipo';
--     v_chiave    text := nullif(p->>'chiave', '');
--     v_oggi      date := (now() AT TIME ZONE 'Europe/Rome')::date;
--     v_da        timestamptz;
--     v_a         timestamptz;
--     v_prima     timestamptz;
--     v_max_ric   int;
--     v_max_tot   int;
--     v_ric       int;
--     v_tot       int;
--     v_ritmo     timestamptz;
--     v_i         int;
--     v_id        uuid;
--   BEGIN
--     IF p_user_id IS NULL OR v_tel = '' THEN
--       RETURN jsonb_build_object('motivo', 'dati_mancanti');
--     END IF;
--     IF v_tipo IS NULL OR v_tipo NOT IN ('promemoria', 'ricontatto') THEN
--       RAISE EXCEPTION 'manychat_prenota_giro: tipo non valido';
--     END IF;
--     SELECT prossimo_ricontatto_dopo INTO v_ritmo FROM public.manychat_giro WHERE id = 1 FOR UPDATE;
--     IF NOT FOUND THEN
--       RETURN jsonb_build_object('motivo', 'manca_riga_giro');
--     END IF;
--     UPDATE public.manychat_invii
--        SET stato = 'incerto', motivo = coalesce(motivo, 'prenotato_scaduto')
--      WHERE user_id = p_user_id
--        AND stato = 'prenotato'
--        AND prenotato_il < now() - interval '10 minutes';
--     v_da := v_oggi::timestamp AT TIME ZONE 'Europe/Rome';
--     v_a  := (v_oggi + 1)::timestamp AT TIME ZONE 'Europe/Rome';
--     SELECT prima_accensione INTO v_prima FROM public.manychat_config WHERE id = 1;
--     v_max_ric := v_tetto_ric;
--     IF coalesce(p_tetti->>'ricontatti', '') ~ '^\d{1,6}$' THEN
--       v_max_ric := LEAST(v_tetto_ric, (p_tetti->>'ricontatti')::int);
--     END IF;
--     v_max_tot := v_tetto_tot;
--     IF coalesce(p_tetti->>'totale', '') ~ '^\d{1,6}$' THEN
--       v_max_tot := LEAST(v_tetto_tot, (p_tetti->>'totale')::int);
--     END IF;
--     IF now() < coalesce(v_prima, now()) + interval '7 days' THEN
--       v_max_ric := LEAST(v_max_ric, v_tetto_prima);
--     END IF;
--     SELECT count(*) FILTER (WHERE tipo = 'ricontatto'), count(*)
--       INTO v_ric, v_tot
--       FROM public.manychat_invii
--      WHERE user_id = p_user_id
--        AND tipo IN ('promemoria', 'ricontatto')
--        AND stato IN ('prenotato', 'inviato', 'incerto')
--        AND prenotato_il >= v_da AND prenotato_il < v_a;
--     IF v_tot >= v_max_tot THEN
--       RETURN jsonb_build_object('motivo', 'tetto_totale');
--     END IF;
--     IF v_tipo = 'ricontatto' AND v_ric >= v_max_ric THEN
--       RETURN jsonb_build_object('motivo', 'tetto_ricontatti');
--     END IF;
--     IF EXISTS (
--       SELECT 1 FROM public.whatsapp_contacts c
--        WHERE c.user_id = p_user_id
--          AND c.non_scrivere_dal IS NOT NULL
--          AND (c.phone_e164 = '+' || v_tel OR ltrim(c.phone_e164, '+') = v_tel)
--     ) THEN
--       RETURN jsonb_build_object('motivo', 'stop');
--     END IF;
--     IF EXISTS (
--       SELECT 1 FROM public.manychat_invii i
--        WHERE i.user_id = p_user_id
--          AND i.telefono = v_tel
--          AND i.stato IN ('prenotato', 'inviato', 'incerto')
--          AND coalesce(i.inviato_il, i.prenotato_il) > now() - make_interval(secs => v_pausa_s)
--     ) THEN
--       RETURN jsonb_build_object('motivo', 'pausa_contatto');
--     END IF;
--     IF v_tipo = 'ricontatto' AND coalesce(v_ritmo, '-infinity'::timestamptz) > now() THEN
--       RETURN jsonb_build_object('motivo', 'ritmo');
--     END IF;
--     INSERT INTO public.manychat_invii (user_id, lead_id, tipo, chiave, telefono, flow_ns, previsto_il)
--     VALUES (p_user_id, nullif(p->>'lead_id', '')::uuid, v_tipo, v_chiave, v_tel,
--             nullif(p->>'flow_ns', ''), nullif(p->>'previsto_il', '')::timestamptz)
--     ON CONFLICT (chiave) WHERE chiave IS NOT NULL DO NOTHING
--     RETURNING id INTO v_id;
--     IF v_id IS NULL THEN
--       RETURN jsonb_build_object('motivo', 'gia_preso');
--     END IF;
--     v_i := GREATEST(27, LEAST(33, coalesce(p_intervallo_min, 30)));
--     IF v_tipo = 'ricontatto' THEN
--       UPDATE public.manychat_giro
--          SET prossimo_ricontatto_dopo = now() + make_interval(mins => v_i)
--        WHERE id = 1;
--     ELSE
--       UPDATE public.manychat_giro
--          SET prossimo_ricontatto_dopo = GREATEST(coalesce(prossimo_ricontatto_dopo, now()), now() + make_interval(mins => v_i))
--        WHERE id = 1;
--     END IF;
--     RETURN jsonb_build_object('id', v_id);
--   END $$;
-- ─────────────────────────────────────────────────────────────────────────────

-- Anche l'ALTER TABLE delle colonne prende un ACCESS EXCLUSIVE su manychat_config:
-- il lock_timeout vale per tutto il file (si toglie in fondo con RESET).
SET lock_timeout = '5s';

-- ── 1. Le colonne della configurazione ───────────────────────────────────────
-- Tutte spente o vuote di serie: senza che il titolare le accenda dal riquadro,
-- il giro non manda niente di nuovo.
ALTER TABLE public.manychat_config
  ADD COLUMN IF NOT EXISTS lead_nuovo     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS giorno_meet    boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lead_nuovo_dal timestamptz,
  ADD COLUMN IF NOT EXISTS stati          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS indirizzo_sede text;

-- ── 2. Il CHECK su `tipo` si allarga da 6 a 12 valori ────────────────────────
-- Si legge la DEFINIZIONE del vincolo che riguarda la colonna `tipo` (il nome
-- resta manychat_invii_tipo_check, quindi non basta guardare il nome): se
-- contiene già 'promemoria_sede' non si fa niente. Altrimenti UN SOLO comando
-- toglie il vincolo trovato e rimette quello largo: la tabella non resta mai
-- senza vincolo. Il lock_timeout vale fino alla fine della transazione.
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

  IF v_def IS NOT NULL AND v_def LIKE '%''promemoria_sede''%' THEN
    RETURN; -- già allargato: niente da fare
  END IF;

  SET LOCAL lock_timeout = '5s';

  IF v_nome IS NULL THEN
    -- nessun vincolo sul tipo (qualcuno l'ha tolto): si rimette soltanto
    ALTER TABLE public.manychat_invii
      ADD CONSTRAINT manychat_invii_tipo_check
      CHECK (tipo IN ('promemoria', 'ricontatto', 'conferma', 'chat', 'webinar', 'prova',
                      'primo_contatto', 'richiamo_24h', 'meet_oggi', 'meet_adesso',
                      'promemoria_chiamata', 'promemoria_sede'));
  ELSE
    EXECUTE format(
      'ALTER TABLE public.manychat_invii DROP CONSTRAINT %I, ADD CONSTRAINT manychat_invii_tipo_check CHECK (tipo IN (%s))',
      v_nome,
      '''promemoria'', ''ricontatto'', ''conferma'', ''chat'', ''webinar'', ''prova'', '
      '''primo_contatto'', ''richiamo_24h'', ''meet_oggi'', ''meet_adesso'', '
      '''promemoria_chiamata'', ''promemoria_sede'''
    );
  END IF;
END $$;

-- ── 3. La prenotazione di un invio del giro, con i tipi nuovi ────────────────
-- Risponde {id} se l'invio è prenotato (e allora si può chiamare ManyChat), o
-- {motivo} se no: tetto_totale · tetto_ricontatti · tetto_lead_nuovi · stop ·
-- pausa_contatto · ritmo · gia_preso · dati_mancanti · manca_riga_giro.
--
-- p = { tipo, telefono (solo cifre), lead_id?, chiave?, flow_ns?, previsto_il? }
--   tipo: promemoria · ricontatto · primo_contatto · richiamo_24h · meet_oggi ·
--         meet_adesso · promemoria_chiamata · promemoria_sede
-- p_tetti = { ricontatti?, leadNuovi?, totale? }: i valori del riquadro. Il
--       server li manda come sono, ma qui valgono sempre al massimo 20, 30 e
--       100, e 10 ricontatti nella prima settimana: le costanti stanno qui, non
--       nel browser.
-- p_intervallo_min = minuti scelti a caso dal giro; qui sempre fra 27 e 33.
--
-- L'ORDINE È QUELLO DI M2 E NON SI CAMBIA (tutto PRIMA di chiamare ManyChat):
--   1. ci si mette in fila sulla riga del giro (FOR UPDATE), poi le righe
--      «prenotato» di più di 10 minuti diventano «incerto» (mai rimandate);
--   2. i tetti di oggi (ora di Roma) sugli otto tipi del giro, in stato
--      prenotato/inviato/incerto: il totale (con la riserva per gli
--      appuntamenti), i ricontatti, i lead nuovi;
--   3. STOP (col «+» di whatsapp_contacts e senza, per le righe vecchie);
--   4. la pausa per contatto: 120 s su prenotato/inviato/incerto, mai su
--      saltato o fallito (il telefono non è stato scritto);
--   5. il RITMO, SOLO IN LETTURA, per `ricontatto` e `richiamo_24h`: è sicuro
--      perché la riga del giro è bloccata dal passo 1;
--   6. l'inserimento: la chiave unica è l'ultimo cancello. Se non inserisce →
--      gia_preso, SENZA consumare il posto del ritmo;
--   7. SOLO ALLA FINE il posto del ritmo, e solo per `ricontatto` e
--      `richiamo_24h`: adesso + 27-33 minuti. Gli altri sei tipi non lo toccano.
CREATE OR REPLACE FUNCTION public.manychat_prenota_giro(
  p_user_id uuid,
  p jsonb,
  p_tetti jsonb,
  p_intervallo_min integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pausa_s     constant int := 120;
  v_tetto_ric   constant int := 20;
  v_tetto_ln    constant int := 30;
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
       'promemoria', 'ricontatto', 'primo_contatto', 'richiamo_24h',
       'meet_oggi', 'meet_adesso', 'promemoria_chiamata', 'promemoria_sede') THEN
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
         count(*) FILTER (WHERE tipo IN ('primo_contatto', 'richiamo_24h')),
         count(*)
    INTO v_ric, v_ln, v_tot
    FROM public.manychat_invii
   WHERE user_id = p_user_id
     AND tipo IN ('promemoria', 'ricontatto', 'primo_contatto', 'richiamo_24h',
                  'meet_oggi', 'meet_adesso', 'promemoria_chiamata', 'promemoria_sede')
     AND stato IN ('prenotato', 'inviato', 'incerto')
     AND prenotato_il >= v_da AND prenotato_il < v_a;

  -- La RISERVA: primo contatto, richiamo e ricontatto contano contro il totale
  -- meno 30 posti, che restano agli appuntamenti (mai sotto zero).
  v_limite := v_max_tot;
  IF v_tipo IN ('primo_contatto', 'richiamo_24h', 'ricontatto') THEN
    v_limite := GREATEST(v_max_tot - v_riserva, 0);
  END IF;
  IF v_tot >= v_limite THEN
    RETURN jsonb_build_object('motivo', 'tetto_totale');
  END IF;
  IF v_tipo = 'ricontatto' AND v_ric >= v_max_ric THEN
    RETURN jsonb_build_object('motivo', 'tetto_ricontatti');
  END IF;
  IF v_tipo IN ('primo_contatto', 'richiamo_24h') AND v_ln >= v_max_ln THEN
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

-- ── 4. Una parte di `controlli`, scritta senza riscrivere il resto ───────────
-- Il riquadro tiene qui (jsonb) la data della frase del consenso, l'ultimo
-- «Collegamento ok» e l'esito della prova di creazione. Rileggere tutto e
-- riscriverlo, con ManyChat che risponde in secondi nel mezzo, farebbe tornare
-- indietro una data segnata da un'altra scheda nel frattempo (e una data
-- anteriore farebbe valere come consenso moduli che la frase non l'hanno vista).
-- Qui UN solo UPDATE fonde la parte nuova sopra quella che c'è: le chiavi non
-- nominate non si toccano. Vero se ha scritto, falso se la riga non c'è o è di
-- un'altra installazione (user_id diverso).
CREATE OR REPLACE FUNCTION public.manychat_controlli_unisci(p_user_id uuid, p_patch jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF p_user_id IS NULL OR p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RETURN false;
  END IF;
  UPDATE public.manychat_config
     SET controlli = CASE WHEN jsonb_typeof(controlli) = 'object' THEN controlli ELSE '{}'::jsonb END
                     || p_patch
   WHERE id = 1 AND user_id = p_user_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END $$;

-- ── 5. Solo il server le chiama ──────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.manychat_prenota_giro(uuid, jsonb, jsonb, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.manychat_controlli_unisci(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manychat_prenota_giro(uuid, jsonb, jsonb, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.manychat_controlli_unisci(uuid, jsonb) TO service_role;

RESET lock_timeout;

-- Il server le trova subito, senza aspettare che la cache dello schema si
-- rinnovi da sola.
NOTIFY pgrst, 'reload schema';
