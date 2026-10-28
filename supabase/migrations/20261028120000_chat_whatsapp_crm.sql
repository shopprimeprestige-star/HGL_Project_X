-- ─────────────────────────────────────────────────────────────────────────────
-- LA CHAT WHATSAPP NEL CRM · «DA RISPONDERE», NON LETTI VERI, RISPOSTA DAL CRM
--
-- Commessa 2026-10-28 (T1). Il titolare risponde ai clienti dal CRM e non perde
-- le chat a cui nessuno ha risposto. «Da rispondere» si legge dalla riga del
-- contatto (ultimo_in_entrata_il > risposto_il), non dai messaggi: resta giusto
-- anche con migliaia di messaggi.
--
-- COSA AGGIUNGE (solo aggiunte: nessuna riga esistente viene scritta)
--   · whatsapp_contacts.ultimo_in_entrata_il, ultimo_in_entrata_anteprima,
--     risposto_il, subscriber_id — quattro colonne facoltative, vuote per le
--     chat che ci sono già (nessun riempimento dei dati vecchi).
--   · idx_wa_contacts_da_rispondere — l'indice per l'elenco «Da rispondere».
--   · whatsapp_registra_entrata — un messaggio del cliente è arrivato: +1 ai non
--     letti IN MODO ATOMICO (anche per due messaggi quasi insieme), crea la riga
--     per un numero mai visto. Solo il server la chiama.
--   · whatsapp_segna_risposto — il CRM ha risposto: il cliente esce da «Da
--     rispondere». Solo il server la chiama, dopo un invio riuscito.
--   · whatsapp_segna_fatto — il pulsante «Risposto / Fatto» della pagina. La
--     chiama l'utente loggato, con la sua RLS, sulle sole sue righe.
--   · manychat_prenota_porta — stessa funzione di M1; cambia SOLO la pausa fra
--     due invii allo stesso numero: 2 secondi per il testo libero della chat,
--     120 per tutto il resto (modelli, promemoria, sequenze). STOP prima di
--     tutto e sempre.
--
-- ⚠️ UN SOLO OROLOGIO: quello del database. ultimo_in_entrata_il e
--    last_message_at si scrivono con now(), come risposto_il. Se l'entrata usasse
--    l'ora del server e il server fosse indietro di qualche secondo, un cliente
--    che riscrive subito dopo la risposta NON rientrerebbe in «Da rispondere».
--    Il parametro p_il è solo un ripiego e non entra in nessun confronto.
-- ⚠️ CHI PUÒ CHIAMARLE: registra_entrata e segna_risposto si fidano di p_user_id,
--    quindi le chiama SOLO il server (REVOKE da PUBLIC, anon e authenticated;
--    GRANT a service_role). Se le potesse chiamare un utente loggato qualunque,
--    potrebbe creare chat finte o azzerare «Da rispondere» di un'altra
--    installazione. segna_fatto invece è dell'utente: lavora con auth.uid().
-- ⚠️ ORDINE: dopo 20261023120000_manychat_base.sql (la funzione della pausa) e
--    dopo 20261022140000_promemoria_whatsapp.sql. Se M1 non c'è, la parte della
--    pausa si salta da sola (nessuna funzione orfana) e il resto si applica.
-- ⚠️ Applicarla due volte non fa danni (IF NOT EXISTS, OR REPLACE).
-- ⚠️ Il codice pubblicato funziona anche SENZA questa migrazione: ripiega sul
--    vecchio percorso (contatore non atomico) e sulla pausa di 120 secondi; il
--    pulsante «Fatto» dice «manca l'aggiornamento del database».
-- ⚠️ NON la lancia la squadra: la applica il titolare, dopo averla letta.
--
-- COME SI ANNULLA (solo se serve davvero; il codice ripiega da solo):
--   DROP FUNCTION public.whatsapp_registra_entrata(uuid, text, uuid, timestamptz, text, text, text);
--   DROP FUNCTION public.whatsapp_segna_risposto(uuid, text);
--   DROP FUNCTION public.whatsapp_segna_fatto(text);
--   DROP INDEX public.idx_wa_contacts_da_rispondere;
--   ALTER TABLE public.whatsapp_contacts DROP COLUMN ultimo_in_entrata_il;
--   ALTER TABLE public.whatsapp_contacts DROP COLUMN ultimo_in_entrata_anteprima;
--   ALTER TABLE public.whatsapp_contacts DROP COLUMN risposto_il;
--   ALTER TABLE public.whatsapp_contacts DROP COLUMN subscriber_id;
--   La pausa di prima (120 secondi per tutti): rilanciare il blocco
--   «CREATE OR REPLACE FUNCTION public.manychat_prenota_porta» di
--   20261023120000_manychat_base.sql (sezione 6). Le sue autorizzazioni restano.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Le quattro colonne (tutte facoltative: le righe vecchie restano vuote) ─
ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS ultimo_in_entrata_il timestamptz;
ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS ultimo_in_entrata_anteprima text;
ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS risposto_il timestamptz;
ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS subscriber_id text;

-- ── 2. L'indice per l'elenco «Da rispondere» ─────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_wa_contacts_da_rispondere
  ON public.whatsapp_contacts (user_id, ultimo_in_entrata_il)
  WHERE ultimo_in_entrata_il IS NOT NULL;

-- ── 3. Un messaggio del cliente è arrivato ───────────────────────────────────
-- +1 ai non letti, atomico: un solo UPDATE sulla riga (il numero può stare col
-- «+» o senza, come `formati()` nel codice; se ci sono entrambi vince quella col
-- «+»). Se la riga non c'è, la crea con 1 e, se due messaggi di un numero nuovo
-- arrivano insieme, il secondo cade nel ON CONFLICT e fa +1: nessuno si perde.
-- Orologio: now() del database (vedi in testa). L'anteprima si sovrascrive
-- sempre (l'ultimo messaggio vince). Valore vecchio vince per scheda e nome;
-- il subscriber_id nuovo vince, se c'è.
CREATE OR REPLACE FUNCTION public.whatsapp_registra_entrata(
  p_user_id uuid,
  p_phone text,
  p_lead_id uuid,
  p_il timestamptz,
  p_anteprima text,
  p_subscriber_id text,
  p_nome text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_tel text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_ora timestamptz := coalesce(now(), p_il);
BEGIN
  IF p_user_id IS NULL OR v_tel = '' THEN
    RETURN;
  END IF;

  UPDATE public.whatsapp_contacts c
     SET unread_count                = c.unread_count + 1,
         last_message_at             = v_ora,
         ultimo_in_entrata_il        = v_ora,
         ultimo_in_entrata_anteprima = p_anteprima,
         lead_id                     = coalesce(c.lead_id, p_lead_id),
         display_name                = coalesce(c.display_name, p_nome),
         subscriber_id               = coalesce(p_subscriber_id, c.subscriber_id)
   WHERE c.id = (
           SELECT x.id FROM public.whatsapp_contacts x
            WHERE x.user_id = p_user_id
              AND x.phone_e164 IN ('+' || v_tel, v_tel)
            ORDER BY (x.phone_e164 = '+' || v_tel) DESC
            LIMIT 1
         )
     AND c.user_id = p_user_id;
  IF FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.whatsapp_contacts AS w (
    user_id, phone_e164, lead_id, display_name, unread_count,
    last_message_at, ultimo_in_entrata_il, ultimo_in_entrata_anteprima, subscriber_id
  ) VALUES (
    p_user_id, '+' || v_tel, p_lead_id, p_nome, 1,
    v_ora, v_ora, p_anteprima, p_subscriber_id
  )
  ON CONFLICT (user_id, phone_e164) DO UPDATE
     SET unread_count                = w.unread_count + 1,
         last_message_at             = v_ora,
         ultimo_in_entrata_il        = v_ora,
         ultimo_in_entrata_anteprima = excluded.ultimo_in_entrata_anteprima,
         lead_id                     = coalesce(w.lead_id, excluded.lead_id),
         display_name                = coalesce(w.display_name, excluded.display_name),
         subscriber_id               = coalesce(excluded.subscriber_id, w.subscriber_id);
END $$;

-- ── 4. Il CRM ha risposto (la chiama il server dopo un invio riuscito) ───────
-- risposto_il = il più recente fra adesso e l'ultimo messaggio del cliente, con
-- l'ora del database: il cliente esce da «Da rispondere». Vero se ha trovato
-- la riga.
CREATE OR REPLACE FUNCTION public.whatsapp_segna_risposto(p_user_id uuid, p_phone text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_tel text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  n int;
BEGIN
  IF p_user_id IS NULL OR v_tel = '' THEN
    RETURN false;
  END IF;
  UPDATE public.whatsapp_contacts
     SET risposto_il = greatest(now(), ultimo_in_entrata_il)
   WHERE user_id = p_user_id
     AND phone_e164 IN ('+' || v_tel, v_tel);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;

-- ── 5. «Risposto / Fatto» (la chiama la pagina, con la sessione dell'utente) ──
-- Stesso effetto del punto 4, ma INVOKER: vale la RLS «users manage own wa
-- contacts» e in più il WHERE dice user_id = auth.uid(). Ora del database,
-- perché l'orologio di un telefono indietro lascerebbe la chat in lista per
-- sempre.
CREATE OR REPLACE FUNCTION public.whatsapp_segna_fatto(p_phone text)
RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  v_tel text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  n int;
BEGIN
  IF v_tel = '' THEN
    RETURN false;
  END IF;
  UPDATE public.whatsapp_contacts
     SET risposto_il = greatest(now(), ultimo_in_entrata_il)
   WHERE user_id = auth.uid()
     AND phone_e164 IN ('+' || v_tel, v_tel);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n > 0;
END $$;

-- ── 6. Chi può chiamare cosa ─────────────────────────────────────────────────
-- Le due che si fidano di p_user_id: SOLO il server. Su Supabase `authenticated`
-- ha il permesso di serie, quindi va tolto in modo esplicito.
REVOKE ALL ON FUNCTION public.whatsapp_registra_entrata(uuid, text, uuid, timestamptz, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_segna_risposto(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_registra_entrata(uuid, text, uuid, timestamptz, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_segna_risposto(uuid, text) TO service_role;
-- «Fatto»: l'utente loggato, non chi è anonimo.
REVOKE ALL ON FUNCTION public.whatsapp_segna_fatto(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.whatsapp_segna_fatto(text) TO authenticated;

-- ── 7. La pausa: 2 secondi per il testo libero della chat, 120 per il resto ──
-- IDENTICA a manychat_prenota_porta di M1 (sezione 6), salvo la riga che
-- dichiara la pausa. Perché: la pausa di 120 s protegge i campi dei modelli
-- (crm_v1…v4, crm_invio_id) che stanno sul contatto ManyChat; il testo libero
-- non li usa, e in chat due messaggi di fila devono partire entrambi. Non zero
-- ma 2 s: un doppio clic con la rete lenta non manda due testi. Il tipo lo
-- fissa il server («chat» in api.whatsapp-send); un modello ha sempre un flusso
-- (senza, la porta si ferma prima di prenotare), quindi dal browser non si
-- arriva a «chat + flusso vuoto + modello». STOP resta PRIMA e vale sempre.
-- Dentro un DO: se M1 non è stata applicata, qui non si crea una funzione
-- orfana; REVOKE e GRANT stanno nello stesso DO (su una funzione che non c'è un
-- REVOKE darebbe errore).
DO $do$
BEGIN
  IF to_regprocedure('public.manychat_prenota_porta(uuid, jsonb)') IS NOT NULL THEN
    EXECUTE $f$
CREATE OR REPLACE FUNCTION public.manychat_prenota_porta(p_user_id uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pausa_s constant int := CASE WHEN p->>'tipo' = 'chat' AND coalesce(p->>'flow_ns', '') = '' THEN 2 ELSE 120 END;
  v_tel     text := regexp_replace(coalesce(p->>'telefono', ''), '\D', '', 'g');
  v_chiave  text := nullif(p->>'chiave', '');
  v_id      uuid;
BEGIN
  IF p_user_id IS NULL OR v_tel = '' THEN
    RETURN jsonb_build_object('motivo', 'dati_mancanti');
  END IF;

  PERFORM 1 FROM public.manychat_giro WHERE id = 1 FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('motivo', 'manca_riga_giro');
  END IF;

  UPDATE public.manychat_invii
     SET stato = 'incerto', motivo = coalesce(motivo, 'prenotato_scaduto')
   WHERE user_id = p_user_id
     AND stato = 'prenotato'
     AND prenotato_il < now() - interval '10 minutes';

  IF EXISTS (
    SELECT 1 FROM public.whatsapp_contacts c
     WHERE c.user_id = p_user_id
       AND c.non_scrivere_dal IS NOT NULL
       AND (c.phone_e164 = '+' || v_tel OR ltrim(c.phone_e164, '+') = v_tel)
  ) THEN
    RETURN jsonb_build_object('motivo', 'stop');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.manychat_invii i
     WHERE i.user_id = p_user_id
       AND i.telefono = v_tel
       AND i.stato IN ('prenotato', 'inviato', 'incerto')
       AND coalesce(i.inviato_il, i.prenotato_il) > now() - make_interval(secs => v_pausa_s)
  ) THEN
    RETURN jsonb_build_object('motivo', 'pausa_contatto');
  END IF;

  INSERT INTO public.manychat_invii (user_id, lead_id, tipo, chiave, telefono, flow_ns, previsto_il)
  VALUES (p_user_id, nullif(p->>'lead_id', '')::uuid, p->>'tipo', v_chiave, v_tel,
          nullif(p->>'flow_ns', ''), nullif(p->>'previsto_il', '')::timestamptz)
  ON CONFLICT (chiave) WHERE chiave IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('motivo', 'gia_preso');
  END IF;
  RETURN jsonb_build_object('id', v_id);
END $$;
    $f$;

    REVOKE ALL ON FUNCTION public.manychat_prenota_porta(uuid, jsonb) FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.manychat_prenota_porta(uuid, jsonb) TO service_role;
  END IF;
END $do$;

-- ── 8. PostgREST: ricarica lo schema, vede le funzioni subito ────────────────
NOTIFY pgrst, 'reload schema';
