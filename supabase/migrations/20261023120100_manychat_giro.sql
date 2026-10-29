-- ─────────────────────────────────────────────────────────────────────────────
-- WHATSAPP CON MANYCHAT · IL GIRO E IL SECONDO STATO (M2)
--
-- Commessa 2026-10-23. Il giro a orario (promemoria 25' prima del meet e
-- ricontatti dei consulenti) prenota ogni invio nel registro PRIMA di chiamare
-- ManyChat, con tetti, ritmo, pausa per contatto e STOP decisi in una sola
-- transazione. Qui anche lo scrittore del secondo stato («stato del contatto»).
--
-- COSA AGGIUNGE (solo aggiunte: niente che cancelli o riscriva dati, tranne
-- il riempimento una tantum di `risposta_il`, in fondo, che tocca solo righe
-- con `risposta_il` vuoto)
--   · manychat_prendi_giro / manychat_lascia_giro — il lucchetto del giro:
--     vince uno solo, e scade da sé se il giro muore.
--   · manychat_prenota_giro — prenota un invio del giro, o dice perché no.
--   · manychat_giro_annulla — chiude come «saltato», SENZA chiave, un invio
--     prenotato che il giro ha deciso di non fare più.
--   · manychat_risposta_arrivata — segna l'ora della risposta sull'invio (è ciò
--     che sblocca il freno «mai due volte senza risposta») e sul giro.
--   · contatto_wa_aggiorna — scrive SOLO data.contattoWa di una scheda.
--   · il riempimento una tantum di `risposta_il` per le conferme già partite.
--
-- ⚠️ TABELLE E FUNZIONI CHIUSE: come in M1, le funzioni sono SECURITY DEFINER e
--    le può chiamare solo il server (service_role). Ogni funzione porta
--    `user_id` nel WHERE.
-- ⚠️ ORDINE: dopo 20261023120000_manychat_base.sql (M1). Il cron del giro NON è
--    qui: è l'ultimo file (20261023120200_manychat_cron.sql), da lanciare dopo
--    la pubblicazione del codice.
-- ⚠️ Applicarla due volte non fa danni (OR REPLACE; il riempimento tocca solo
--    righe ancora senza risposta).
-- ⚠️ Il codice pubblicato funziona anche SENZA questa migrazione: il giro
--    dice «manca l'aggiornamento del database» e non manda niente.
--
-- COME SI ANNULLA (solo se serve davvero; prima spegnere il cron del giro):
--   DROP FUNCTION public.manychat_prendi_giro(uuid, integer);
--   DROP FUNCTION public.manychat_lascia_giro(uuid);
--   DROP FUNCTION public.manychat_prenota_giro(uuid, jsonb, jsonb, integer);
--   DROP FUNCTION public.manychat_giro_annulla(uuid, uuid, text);
--   DROP FUNCTION public.manychat_risposta_arrivata(uuid, uuid, timestamptz);
--   DROP FUNCTION public.contatto_wa_aggiorna(uuid, uuid, jsonb, jsonb, text);
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Il lucchetto del giro ─────────────────────────────────────────────────
-- Vince uno solo: chi trova il lucchetto libero (mai preso, o scaduto) se lo
-- prende per p_secondi. Il giro ne chiede 120, più della sua durata massima
-- (45 s): se muore a metà, il lucchetto scade da sé.
CREATE OR REPLACE FUNCTION public.manychat_prendi_giro(p_di uuid, p_secondi integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF p_di IS NULL THEN RETURN false; END IF;
  UPDATE public.manychat_giro
     SET lucchetto_fino = now() + make_interval(secs => GREATEST(1, LEAST(coalesce(p_secondi, 120), 300))),
         lucchetto_di = p_di
   WHERE id = 1
     AND (lucchetto_fino IS NULL OR lucchetto_fino < now());
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END $$;

-- Lascia il lucchetto, ma solo se è ancora il suo (se è scaduto e l'ha preso un
-- altro giro, non glielo toglie).
CREATE OR REPLACE FUNCTION public.manychat_lascia_giro(p_di uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE public.manychat_giro
     SET lucchetto_fino = NULL, lucchetto_di = NULL
   WHERE id = 1 AND lucchetto_di = p_di;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END $$;

-- ── 2. La prenotazione di un invio del giro ──────────────────────────────────
-- Risponde {id} se l'invio è prenotato (e allora si può chiamare ManyChat), o
-- {motivo} se no: tetto_totale · tetto_ricontatti · stop · pausa_contatto ·
-- ritmo · gia_preso · dati_mancanti · manca_riga_giro.
--
-- p = { tipo ('promemoria' | 'ricontatto'), telefono (solo cifre), lead_id?,
--       chiave?, flow_ns?, previsto_il? }
-- p_tetti = { ricontatti?, totale? }: i valori del riquadro. Il server li
--       manda come sono, ma qui valgono sempre al massimo 20 e 40, e 10
--       ricontatti nella prima settimana: le costanti stanno qui, non nel
--       browser.
-- p_intervallo_min = minuti scelti a caso dal giro; qui sempre fra 27 e 33.
--
-- L'ORDINE È QUESTO E NON SI CAMBIA (tutto PRIMA di chiamare ManyChat):
--   1. ci si mette in fila sulla riga del giro (FOR UPDATE), poi le righe
--      «prenotato» di più di 10 minuti diventano «incerto» (mai rimandate);
--   2. i tetti di oggi (ora di Roma), su prenotato/inviato/incerto di tipo
--      promemoria e ricontatto. La prima settimana si decide QUI da
--      manychat_config.prima_accensione (senza data: vale la prima settimana,
--      nel dubbio il tetto più basso);
--   3. STOP (col «+» di whatsapp_contacts e senza, per le righe vecchie);
--   4. la pausa per contatto: 120 s su prenotato/inviato/incerto, mai su
--      saltato o fallito (il telefono non è stato scritto);
--   5. per il ricontatto, il RITMO, SOLO IN LETTURA: è sicuro perché la riga
--      del giro è bloccata dal passo 1;
--   6. l'inserimento: la chiave unica è l'ultimo cancello. Se non inserisce →
--      gia_preso, SENZA consumare il posto del ritmo;
--   7. SOLO ALLA FINE il posto del ritmo, con l'intervallo limitato a 27-33.
--      Il ricontatto lo fissa a adesso + i minuti; il promemoria lo SPOSTA solo
--      in avanti, perché il ritmo conta l'ultimo invio automatico di qualunque
--      tipo.
CREATE OR REPLACE FUNCTION public.manychat_prenota_giro(
  p_user_id uuid,
  p jsonb,
  p_tetti jsonb,
  p_intervallo_min integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pausa_s   constant int := 120;
  v_tetto_ric constant int := 20;
  v_tetto_tot constant int := 40;
  v_tetto_prima constant int := 10;
  v_tel       text := regexp_replace(coalesce(p->>'telefono', ''), '\D', '', 'g');
  v_tipo      text := p->>'tipo';
  v_chiave    text := nullif(p->>'chiave', '');
  v_oggi      date := (now() AT TIME ZONE 'Europe/Rome')::date;
  v_da        timestamptz;
  v_a         timestamptz;
  v_prima     timestamptz;
  v_max_ric   int;
  v_max_tot   int;
  v_ric       int;
  v_tot       int;
  v_ritmo     timestamptz;
  v_i         int;
  v_id        uuid;
BEGIN
  IF p_user_id IS NULL OR v_tel = '' THEN
    RETURN jsonb_build_object('motivo', 'dati_mancanti');
  END IF;
  IF v_tipo IS NULL OR v_tipo NOT IN ('promemoria', 'ricontatto') THEN
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
  v_max_tot := v_tetto_tot;
  IF coalesce(p_tetti->>'totale', '') ~ '^\d{1,6}$' THEN
    v_max_tot := LEAST(v_tetto_tot, (p_tetti->>'totale')::int);
  END IF;
  IF now() < coalesce(v_prima, now()) + interval '7 days' THEN
    v_max_ric := LEAST(v_max_ric, v_tetto_prima);
  END IF;

  SELECT count(*) FILTER (WHERE tipo = 'ricontatto'), count(*)
    INTO v_ric, v_tot
    FROM public.manychat_invii
   WHERE user_id = p_user_id
     AND tipo IN ('promemoria', 'ricontatto')
     AND stato IN ('prenotato', 'inviato', 'incerto')
     AND prenotato_il >= v_da AND prenotato_il < v_a;

  IF v_tot >= v_max_tot THEN
    RETURN jsonb_build_object('motivo', 'tetto_totale');
  END IF;
  IF v_tipo = 'ricontatto' AND v_ric >= v_max_ric THEN
    RETURN jsonb_build_object('motivo', 'tetto_ricontatti');
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

  -- 5. il ritmo, solo in lettura (il posto si prende al passo 7)
  IF v_tipo = 'ricontatto' AND coalesce(v_ritmo, '-infinity'::timestamptz) > now() THEN
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

  -- 7. SOLO ORA il posto del ritmo (27-33 minuti, qualunque cosa chieda il giro)
  v_i := GREATEST(27, LEAST(33, coalesce(p_intervallo_min, 30)));
  IF v_tipo = 'ricontatto' THEN
    UPDATE public.manychat_giro
       SET prossimo_ricontatto_dopo = now() + make_interval(mins => v_i)
     WHERE id = 1;
  ELSE
    UPDATE public.manychat_giro
       SET prossimo_ricontatto_dopo = GREATEST(coalesce(prossimo_ricontatto_dopo, now()), now() + make_interval(mins => v_i))
     WHERE id = 1;
  END IF;

  RETURN jsonb_build_object('id', v_id);
END $$;

-- ── 3. Un invio prenotato che il giro non fa più ─────────────────────────────
-- Due casi: la scheda è cambiata fra la prenotazione e la chiamata a ManyChat
-- (l'appuntamento è stato spostato, il consenso tolto…), oppure ManyChat non ha
-- risposto PRIMA dell'invio (ricerca o scrittura dei campi: è certo che non è
-- partito niente). La riga diventa «saltato» e PERDE LA CHIAVE: una riga
-- saltata non deve tenere occupato il giorno, o il recupero del giorno dopo
-- troverebbe «gia_preso». Si chiude solo se è ancora «prenotato» o «fallito».
-- Il posto del ritmo già preso non si restituisce (meglio mezz'ora di troppo).
CREATE OR REPLACE FUNCTION public.manychat_giro_annulla(p_user_id uuid, p_id uuid, p_motivo text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE public.manychat_invii
     SET stato = 'saltato', chiave = NULL, motivo = left(coalesce(p_motivo, 'annullato'), 80)
   WHERE id = p_id
     AND user_id = p_user_id
     AND stato IN ('prenotato', 'fallito');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END $$;

-- ── 4. Una risposta è arrivata ───────────────────────────────────────────────
-- Scrive l'ora della PRIMA risposta sull'invio (non la sovrascrive): è ciò che
-- sblocca il freno «mai due volte senza risposta», conferma compresa. p_id può
-- mancare (un messaggio che non si abbina a un invio): in quel caso si segna
-- solo l'ora dell'ultima risposta del giro, per l'avviso «nessuna risposta da
-- 48 ore».
CREATE OR REPLACE FUNCTION public.manychat_risposta_arrivata(p_user_id uuid, p_id uuid, p_il timestamptz)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int := 0;
BEGIN
  IF p_id IS NOT NULL THEN
    UPDATE public.manychat_invii
       SET risposta_il = coalesce(risposta_il, p_il)
     WHERE id = p_id AND user_id = p_user_id;
    GET DIAGNOSTICS n = ROW_COUNT;
  END IF;
  UPDATE public.manychat_giro
     SET ultima_risposta_il = GREATEST(coalesce(ultima_risposta_il, p_il), p_il)
   WHERE id = 1;
  RETURN p_id IS NULL OR n = 1;
END $$;

-- ── 5. Il secondo stato della scheda ─────────────────────────────────────────
-- Tocca SOLO data.contattoWa, in un solo UPDATE, con la scheda bloccata: il
-- resto della scheda (che il browser può star scrivendo) non si tocca. È la
-- stessa fusione di `applicaCambio` in contatto.ts:
--   · stato, il, da, motivo, scadeRisposta: quelli nuovi (se la patch non porta
--     motivo o scadeRisposta, si tolgono);
--   · invioId e sbloccatoIl: restano quelli di prima, se la patch non ne porta;
--   · la storia: la voce nuova in testa, al massimo 20.
--
-- DUE GUARDIE, DENTRO LA STESSA TRANSAZIONE:
--   · STOP APPICCICOSO: se la scheda è già in STOP, un cambio AUTOMATICO
--     (da = 'automatico') non si applica. Il giro legge la scheda prima di
--     chiamare ManyChat, che può metterci anche 30 secondi: se nel frattempo
--     una persona ha messo STOP, «In attesa» non deve coprirlo. Solo un cambio
--     a mano (con il nome di chi lo fa) lo toglie.
--   · p_se_invio: il cambio vale solo se la scheda è ancora su quell'invio
--     (`invioId`); e «Non ha risposto» solo se lo stato è ancora «In attesa».
--
-- Vero se ha scritto, falso se la scheda non c'è (o è di un'altra
-- installazione) o se una guardia ha fermato il cambio.
CREATE OR REPLACE FUNCTION public.contatto_wa_aggiorna(
  p_user_id uuid,
  p_id uuid,
  p_patch jsonb,
  p_voce jsonb,
  p_se_invio text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dati   jsonb;
  v_prima  jsonb;
  v_patch  jsonb := jsonb_strip_nulls(coalesce(p_patch, '{}'::jsonb));
  v_nuovo  jsonb;
  v_storia jsonb;
BEGIN
  IF p_user_id IS NULL OR p_id IS NULL THEN RETURN false; END IF;
  IF coalesce(v_patch->>'stato', '') NOT IN
     ('contattato', 'in_attesa', 'ha_risposto', 'non_ha_risposto', 'da_ricontattare', 'stop', 'non_raggiungibile') THEN
    RAISE EXCEPTION 'contatto_wa_aggiorna: stato non valido';
  END IF;

  SELECT data INTO v_dati FROM public.crm_leads
   WHERE id = p_id AND user_id = p_user_id
   FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  v_prima := coalesce(v_dati->'contattoWa', '{}'::jsonb);

  -- STOP appiccicoso: gli automatismi non lo toccano
  IF v_prima->>'stato' = 'stop' AND coalesce(v_patch->>'da', '') = 'automatico' THEN
    RETURN false;
  END IF;
  -- il cambio vale solo sull'invio per cui è stato calcolato
  IF p_se_invio IS NOT NULL THEN
    IF coalesce(v_prima->>'invioId', '') <> p_se_invio THEN RETURN false; END IF;
    IF v_patch->>'stato' = 'non_ha_risposto' AND coalesce(v_prima->>'stato', '') <> 'in_attesa' THEN
      RETURN false;
    END IF;
  END IF;

  SELECT coalesce(jsonb_agg(v ORDER BY n), '[]'::jsonb) INTO v_storia
    FROM (
      SELECT v, n FROM jsonb_array_elements(
        jsonb_build_array(coalesce(p_voce, '{}'::jsonb)) || coalesce(v_prima->'storia', '[]'::jsonb)
      ) WITH ORDINALITY AS t(v, n)
      ORDER BY n LIMIT 20
    ) s;

  v_nuovo := (v_prima - 'stato' - 'il' - 'da' - 'motivo' - 'scadeRisposta')
             || v_patch
             || jsonb_build_object('storia', v_storia);

  UPDATE public.crm_leads
     SET data = jsonb_set(coalesce(v_dati, '{}'::jsonb), '{contattoWa}', v_nuovo, true)
   WHERE id = p_id AND user_id = p_user_id;
  RETURN true;
END $$;

-- ── 6. Solo il server le chiama ──────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.manychat_prendi_giro(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.manychat_lascia_giro(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.manychat_prenota_giro(uuid, jsonb, jsonb, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.manychat_giro_annulla(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.manychat_risposta_arrivata(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.contatto_wa_aggiorna(uuid, uuid, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manychat_prendi_giro(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.manychat_lascia_giro(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.manychat_prenota_giro(uuid, jsonb, jsonb, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.manychat_giro_annulla(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.manychat_risposta_arrivata(uuid, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.contatto_wa_aggiorna(uuid, uuid, jsonb, jsonb, text) TO service_role;

-- ── 7. Riempimento una tantum: le risposte già arrivate ──────────────────────
-- La conferma del 22/10 è già online sul canale ManyChat (pacchetto urgente) e
-- le sue righe nascono SENZA `risposta_il`: chi ha risposto «SÌ» sembrerebbe
-- non aver risposto, e il freno «mai due volte senza risposta» gli bloccherebbe
-- il promemoria. Per ogni invio ancora senza risposta si prende la PRIMA
-- risposta in `whatsapp_messages` dallo stesso numero, arrivata dopo l'invio ed
-- entro 7 giorni (la stessa finestra con cui la rotta abbina le risposte).
-- Solo righe con `risposta_il` vuoto; non cancella niente; rilanciarla non
-- cambia nulla.
-- Esclude i messaggi del ponte WhatsApp (canale 'baileys'): sono storico, non
-- risposte a un invio, e rilanciando questo blocco non devono sbloccare il freno.
UPDATE public.manychat_invii i
   SET risposta_il = r.primo
  FROM (
    SELECT i2.id, min(w.created_at) AS primo
      FROM public.manychat_invii i2
      JOIN public.whatsapp_messages w
        ON w.user_id = i2.user_id
       AND w.direction = 'inbound'
       AND w.canale IS DISTINCT FROM 'baileys'
       AND ltrim(w.from_number, '+') = i2.telefono
       AND w.created_at > coalesce(i2.inviato_il, i2.prenotato_il)
       AND w.created_at <= coalesce(i2.inviato_il, i2.prenotato_il) + interval '7 days'
     WHERE i2.risposta_il IS NULL
       AND i2.stato IN ('inviato', 'incerto')
     GROUP BY i2.id
  ) r
 WHERE i.id = r.id
   AND i.risposta_il IS NULL;

-- Il server le trova subito, senza aspettare che la cache dello schema si
-- rinnovi da sola.
NOTIFY pgrst, 'reload schema';
