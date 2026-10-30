-- ─────────────────────────────────────────────────────────────────────────────
-- IL PONTE WHATSAPP · TUTTE LE CHAT, ANCHE GLI SCONOSCIUTI
--
-- Commessa 2026-10-30-ponte-tutte-le-chat (Blocco 1, T1). Il titolare vuole
-- ogni chat individuale di WhatsApp Business nel CRM, anche dei numeri che il
-- CRM non conosce («Sconosciuto»), e vuole che un'entrata portata solo dal
-- ponte conti come non letto e come «Da rispondere». Cambiano due regole della
-- migrazione 20261029120000_ponte_whatsapp.sql:
--   · D7 «solo numeri del CRM»: la toglie il CODICE (la rotta non chiama più
--     ponte_wa_noti, che resta qui sotto, non usata, perché la migrazione è
--     solo aggiuntiva e non cancella niente). Niente da fare in SQL.
--   · D9 «solo da vedere»: cambia qui, con due colonne e due funzioni.
--
-- COSA AGGIUNGE (solo aggiunte: nessuna riga esistente viene riscritta)
--   · whatsapp_messages.attesa_dal — scritta da ponte_wa_scrivi nell'INSERT di
--     una riga IN ENTRATA, di un lotto vivo, senza pari, degli ultimi 7 giorni.
--     È l'ora (del database) in cui il ponte l'ha portata: da lì partono i
--     120 secondi di attesa del pari (ManyChat o Meta). Lo storico non ce l'ha
--     MAI: per questo non può sembrare nuovo.
--   · whatsapp_messages.promosso_il — quando la riga è diventata un'entrata
--     vera (+1 non letti). Serve a non contarla due volte e a ritirarla.
--   · idx_wa_messages_da_promuovere — indice parziale per cercarle.
--   · ponte_wa_promuovi(p_user_id, p_attesa_s) — la rotta la chiama dopo ogni
--     lotto vivo e a ogni battito (60 s), dopo l'abbinamento dei pari. Le righe
--     con attesa_dal più vecchio di p_attesa_s (120) e ancora senza pari
--     diventano entrate vere: sul CONTATTO +1 non letti, ultimo_in_entrata_il
--     = ora VERA del messaggio (in avanti, mai indietro), anteprima se è la più
--     recente, last_message_at in avanti, updated_at. MAI: lead_id,
--     subscriber_id, non_scrivere_dal, display_name, risposto_il. Se il titolare
--     ha già risposto dal telefono (risposto_il >= ora del messaggio) la riga
--     non si conta. FOR UPDATE SKIP LOCKED: due richieste insieme contano una
--     volta sola. Al più 500 righe per chiamata.
--   · ponte_wa_ritira(p_user_id, p_msg) — se il pari arriva DOPO la promozione
--     e il pari è una riga ManyChat (che ha fatto il suo +1 con
--     whatsapp_registra_entrata), toglie 1 ai non letti (mai sotto zero) e
--     rimette promosso_il a vuoto: la stessa entrata non conta due volte. Il
--     pari del Cloud non si ritira: il webhook scrive unread_count = 1 assoluto.
--   · ponte_wa_scrivi — RIDEFINITA (CREATE OR REPLACE, stessa firma): il corpo
--     è quello di 20261029120000 con TRE sole modifiche, ognuna marcata nel
--     testo da «-- TUTTE LE CHAT:» (a: attesa_dal nell'INSERT senza pari;
--     b: il ritiro nel passo dei pari; c: il nome del profilo non si salva per
--     gli sconosciuti). Una prova (prove/ponte/tutte-migrazione.mjs) confronta
--     il corpo con quello vecchio e fallisce se differisce in altro.
--
-- ⚠️ NOME DEL PROFILO (decisione del titolare: «niente nome profilo»): per un
--    contatto con origine 'baileys' e senza lead_id il nome NON si scrive. Il
--    controllo è lead_id IS NULL, mentre la chat lega la scheda per telefono:
--    un contatto del ponte con scheda ma lead_id vuoto non avrà il nome
--    (la chat mostra comunque la scheda). Le notifiche push continuano a
--    mostrare il nome del profilo, che arriva dal ponte e non si salva.
-- ⚠️ IL PONTE NON SCRIVE MAI lead_id né il giro: uno sconosciuto non riceve
--    niente in automatico. Le due funzioni nuove scrivono sui contatti solo le
--    colonne dette sopra.
-- ⚠️ CHI PUÒ CHIAMARLE: si fidano di p_user_id, quindi SOLO il server (REVOKE
--    da PUBLIC, anon e authenticated; GRANT a service_role). Nessun indirizzo
--    scritto a mano.
-- ⚠️ ORDINE: dopo 20261029120000_ponte_whatsapp.sql (ponte_wa_scrivi,
--    duplicato_di) e dopo 20261028120000_chat_whatsapp_crm.sql (le colonne dei
--    contatti).
-- ⚠️ Applicarla due volte non fa danni (IF NOT EXISTS, OR REPLACE).
-- ⚠️ Il codice pubblicato funziona anche SENZA questa migrazione: la promozione
--    dà «funzioni_assenti» nel log una volta, il ponte importa come prima e le
--    entrate vive non si promuovono finché non si applica. Applicata DOPO il
--    codice, nessun danno.
-- ⚠️ NON la lancia la squadra: la applica il titolare (o il capo progetto su
--    sua richiesta), dopo averla letta e dopo il collaudo
--    prove/sql/ponte-tutte.sql su un database di prova.
--
-- QUERY DI VERIFICA (dopo l'applicazione)
--   select column_name from information_schema.columns
--    where table_name = 'whatsapp_messages' and column_name in ('attesa_dal', 'promosso_il');   -- 2 righe
--   select proname from pg_proc where proname in ('ponte_wa_promuovi', 'ponte_wa_ritira') and pronamespace = 'public'::regnamespace;   -- 2 righe
--   select has_function_privilege('anon', 'public.ponte_wa_promuovi(uuid, int)', 'EXECUTE');   -- false
-- QUERY «RIGHE PROMOSSE» (quante entrate ha portato avanti la promozione)
--   select count(*) from public.whatsapp_messages where promosso_il is not null;
--   (ognuna ha dato +1 ai non letti del suo contatto: un unread_count portato
--   avanti non torna indietro da solo)
--
-- COME SI ANNULLA (solo se serve davvero; MAI eseguito dalla squadra):
--   1. Rimettere il corpo vecchio di ponte_wa_scrivi: rilanciare il blocco
--      «CREATE OR REPLACE FUNCTION public.ponte_wa_scrivi» (sezione 5c) di
--      20261029120000_ponte_whatsapp.sql. Le sue autorizzazioni restano.
--   2. DROP FUNCTION public.ponte_wa_promuovi(uuid, integer);
--      DROP FUNCTION public.ponte_wa_ritira(uuid, uuid);
--   3. DROP INDEX public.idx_wa_messages_da_promuovere;
--      ALTER TABLE public.whatsapp_messages DROP COLUMN attesa_dal;
--      ALTER TABLE public.whatsapp_messages DROP COLUMN promosso_il;
--   4. I contatti origine 'baileys' senza scheda si cancellano con la query
--      già scritta nel «COME SI ANNULLA» di 20261029120000.
--   Resta un limite: i non letti portati avanti dalle promozioni non si
--   riportano indietro da soli (la query «righe promosse» dice quante sono).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Le due colonne e il loro indice ───────────────────────────────────────
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS attesa_dal timestamptz;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS promosso_il timestamptz;

CREATE INDEX IF NOT EXISTS idx_wa_messages_da_promuovere
  ON public.whatsapp_messages (user_id, attesa_dal)
  WHERE attesa_dal IS NOT NULL AND promosso_il IS NULL AND duplicato_di IS NULL;

-- ── 2. Scrive un lotto del ponte (v2: come la v1 + TRE modifiche marcate) ────
-- Il commento lungo della v1 (sezione 5c di 20261029120000) vale ancora. In più:
--   a. un'entrata viva senza pari, degli ultimi 7 giorni, nasce con
--      attesa_dal = now(): la promuoverà ponte_wa_promuovi dopo l'attesa;
--   b. un pari trovato dopo (passo 2) chiama ponte_wa_ritira, che toglie il +1
--      se la riga era già stata promossa e il pari è di ManyChat;
--   c. il nome del profilo non si scrive per i contatti del ponte senza scheda.
CREATE OR REPLACE FUNCTION public.ponte_wa_scrivi(
  p_user_id uuid,
  p_righe jsonb,
  p_pari jsonb,
  p_nomi jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_adesso   constant double precision := extract(epoch FROM now());
  v_mappa    jsonb := '{}'::jsonb;
  v_tentate  text[] := '{}'::text[];
  v_inseriti uuid[] := '{}'::uuid[];
  v_effetto  uuid[] := '{}'::uuid[];
  r          record;
  g          record;
  v_crm      uuid;
  v_id       uuid;
  -- TUTTE LE CHAT: (b) la riga del ponte a cui il passo 2 ha appena dato un pari.
  v_riga     uuid;
  v_k        text;
  v_n        int;
  v_nome     text;
  v_risp     timestamptz;
  v_prima    timestamptz;
  v_creato   boolean;
  v_nuovi    int := 0;
  v_gia      int := 0;
  v_doppioni int := 0;
  v_persi    int := 0;
  v_contatti int := 0;
  v_risposto int := 0;
BEGIN
  IF p_user_id IS NOT NULL THEN
    -- I pari validi, una voce per chiave.
    SELECT coalesce(jsonb_object_agg(q.k, q.crm), '{}'::jsonb) INTO v_mappa
      FROM (
        SELECT DISTINCT ON (p.k) p.k, p.crm
          FROM jsonb_to_recordset(CASE WHEN jsonb_typeof(p_pari) = 'array' THEN p_pari ELSE '[]'::jsonb END)
               AS p(k text, crm text)
         WHERE p.k IS NOT NULL
           AND p.crm ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
         ORDER BY p.k
      ) q
      JOIN public.whatsapp_messages c ON c.id = q.crm::uuid
     WHERE c.user_id = p_user_id
       AND c.canale IS DISTINCT FROM 'baileys'
       AND c.duplicato_di IS NULL
       AND c.status IS DISTINCT FROM 'failed';

    -- (1) Le righe.
    FOR r IN
      SELECT q.k, q.n, q.d, q.t, q.x, coalesce(q.e, false) AS e, q.m, q.s
        FROM jsonb_to_recordset(CASE WHEN jsonb_typeof(p_righe) = 'array' THEN p_righe ELSE '[]'::jsonb END)
             AS q(k text, n text, d text, t double precision, x text, e boolean, m text, s text)
       WHERE q.n ~ '^[0-9]{8,15}$'
         AND q.d IN ('in', 'out')
         AND q.k LIKE 'bw:' || q.n || ':_%' AND length(q.k) <= 160
         AND q.t >= 1230768000 AND q.t <= v_adesso + 600
         AND coalesce(q.x, '') <> ''
       ORDER BY q.t, q.k
    LOOP
      v_crm := (v_mappa ->> r.k)::uuid;
      v_id := NULL;
      IF v_crm IS NOT NULL THEN
        BEGIN
          INSERT INTO public.whatsapp_messages (
            user_id, wa_message_id, direction, from_number, to_number, body,
            media_type, status, canale, created_at, raw_payload, duplicato_di
          ) VALUES (
            p_user_id, r.k,
            CASE WHEN r.d = 'in' THEN 'inbound' ELSE 'outbound' END,
            CASE WHEN r.d = 'in' THEN '+' || r.n ELSE 'baileys' END,
            CASE WHEN r.d = 'in' THEN 'baileys' ELSE '+' || r.n END,
            left(r.x, 4000),
            CASE WHEN r.m IN ('foto', 'vocale', 'audio', 'video', 'documento', 'sticker', 'posizione', 'contatto', 'altro') THEN r.m END,
            CASE WHEN r.d = 'in' THEN 'delivered'
                 WHEN r.s IN ('sent', 'delivered', 'read', 'failed') THEN r.s
                 ELSE 'sent' END,
            'baileys', to_timestamp(r.t), '{}'::jsonb, v_crm
          )
          ON CONFLICT (wa_message_id) DO NOTHING
          RETURNING id INTO v_id;
          IF v_id IS NOT NULL THEN
            v_tentate := v_tentate || r.k;
            v_doppioni := v_doppioni + 1;
          END IF;
        EXCEPTION WHEN unique_violation THEN
          v_persi := v_persi + 1;
          v_tentate := v_tentate || r.k;
          v_crm := NULL;
        END;
      END IF;
      IF v_crm IS NULL THEN
        INSERT INTO public.whatsapp_messages (
          user_id, wa_message_id, direction, from_number, to_number, body,
          media_type, status, canale, created_at, raw_payload, attesa_dal
        ) VALUES (
          p_user_id, r.k,
          CASE WHEN r.d = 'in' THEN 'inbound' ELSE 'outbound' END,
          CASE WHEN r.d = 'in' THEN '+' || r.n ELSE 'baileys' END,
          CASE WHEN r.d = 'in' THEN 'baileys' ELSE '+' || r.n END,
          left(r.x, 4000),
          CASE WHEN r.m IN ('foto', 'vocale', 'audio', 'video', 'documento', 'sticker', 'posizione', 'contatto', 'altro') THEN r.m END,
          CASE WHEN r.d = 'in' THEN 'delivered'
               WHEN r.s IN ('sent', 'delivered', 'read', 'failed') THEN r.s
               ELSE 'sent' END,
          'baileys', to_timestamp(r.t), '{}'::jsonb,
          -- TUTTE LE CHAT: (a) solo un'entrata viva, mai nata con un pari (nemmeno uno perso), degli ultimi 7 giorni.
          CASE WHEN r.e AND r.d = 'in' AND (v_mappa ->> r.k) IS NULL AND r.t >= v_adesso - 7 * 86400 THEN now() END
        )
        ON CONFLICT (wa_message_id) DO NOTHING
        RETURNING id INTO v_id;
      END IF;
      IF v_id IS NULL THEN
        v_gia := v_gia + 1;
      ELSE
        v_nuovi := v_nuovi + 1;
        v_inseriti := v_inseriti || v_id;
        -- D8: solo un'uscita viva senza pari, degli ultimi 7 giorni.
        IF r.e AND r.d = 'out' AND v_crm IS NULL AND r.t >= v_adesso - 7 * 86400 THEN
          v_effetto := v_effetto || v_id;
        END IF;
      END IF;
    END LOOP;

    -- (2) I pari delle righe già presenti.
    FOR v_k, v_crm IN
      SELECT e.key, e.value::uuid
        FROM jsonb_each_text(v_mappa) AS e
       WHERE NOT (e.key = ANY (v_tentate))
       ORDER BY e.key
    LOOP
      BEGIN
        UPDATE public.whatsapp_messages w
           SET duplicato_di = v_crm
         WHERE w.user_id = p_user_id
           AND w.wa_message_id = v_k
           AND w.canale = 'baileys'
           AND w.duplicato_di IS NULL
        RETURNING w.id INTO v_riga;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_doppioni := v_doppioni + v_n;
        -- TUTTE LE CHAT: (b) la riga era già stata promossa? Il ritiro lo decide la funzione.
        IF v_riga IS NOT NULL THEN
          PERFORM public.ponte_wa_ritira(p_user_id, v_riga);
        END IF;
      EXCEPTION WHEN unique_violation THEN
        v_persi := v_persi + 1;
      END;
    END LOOP;

    -- (3) I contatti delle righe inserite adesso.
    FOR g IN
      SELECT regexp_replace(CASE WHEN w.direction = 'inbound' THEN w.from_number ELSE w.to_number END, '\D', '', 'g') AS n,
             max(w.created_at) AS ultimo,
             max(w.created_at) FILTER (WHERE w.id = ANY (v_effetto)) AS risposta
        FROM public.whatsapp_messages w
       WHERE w.id = ANY (v_inseriti)
       GROUP BY 1
       ORDER BY 1
    LOOP
      v_nome := nullif(btrim(left(p_nomi ->> g.n, 80)), '');
      v_risp := CASE WHEN g.risposta IS NOT NULL THEN least(g.risposta, now()) END;
      v_id := NULL;
      SELECT x.id, x.risposto_il INTO v_id, v_prima
        FROM public.whatsapp_contacts x
       WHERE x.user_id = p_user_id
         AND x.phone_e164 IN ('+' || g.n, g.n)
       ORDER BY (x.phone_e164 = '+' || g.n) DESC
       LIMIT 1
       FOR UPDATE;
      IF v_id IS NOT NULL THEN
        UPDATE public.whatsapp_contacts x
           SET last_message_at = greatest(x.last_message_at, g.ultimo),
               -- TUTTE LE CHAT: (c) il nome del profilo non si salva per un contatto del ponte senza scheda.
               display_name    = CASE WHEN x.origine = 'baileys' AND x.lead_id IS NULL THEN x.display_name
                                      ELSE coalesce(x.display_name, v_nome) END,
               risposto_il     = CASE WHEN v_risp IS NULL THEN x.risposto_il
                                      ELSE greatest(coalesce(x.risposto_il, '-infinity'), v_risp) END,
               updated_at      = now()
         WHERE x.id = v_id;
        IF v_risp IS NOT NULL AND coalesce(v_prima, '-infinity') < v_risp THEN
          v_risposto := v_risposto + 1;
        END IF;
      ELSE
        INSERT INTO public.whatsapp_contacts AS w (user_id, phone_e164, display_name, last_message_at, risposto_il, origine)
        -- TUTTE LE CHAT: (c) un contatto nuovo del ponte nasce senza nome (è uno sconosciuto).
        VALUES (p_user_id, '+' || g.n, NULL, g.ultimo, v_risp, 'baileys')
        ON CONFLICT (user_id, phone_e164) DO UPDATE
           SET last_message_at = greatest(w.last_message_at, excluded.last_message_at),
               -- TUTTE LE CHAT: (c) lo stesso se il contatto è nato nel frattempo da un'altra richiesta.
               display_name    = CASE WHEN w.origine = 'baileys' AND w.lead_id IS NULL THEN w.display_name
                                      ELSE coalesce(w.display_name, v_nome) END,
               risposto_il     = CASE WHEN excluded.risposto_il IS NULL THEN w.risposto_il
                                      ELSE greatest(coalesce(w.risposto_il, '-infinity'), excluded.risposto_il) END,
               updated_at      = now()
        RETURNING (xmax = 0) INTO v_creato;
        IF v_creato THEN
          v_contatti := v_contatti + 1;
        END IF;
        IF v_risp IS NOT NULL THEN
          v_risposto := v_risposto + 1;
        END IF;
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'nuovi',          v_nuovi,
    'gia_presenti',   v_gia,
    'doppioni',       v_doppioni,
    'pari_persi',     v_persi,
    'contatti_nuovi', v_contatti,
    'risposto',       v_risposto
  );
END $$;

-- ── 3. Il pari è arrivato DOPO la promozione: si ritira il +1 ────────────────
-- Lavora solo se la riga del ponte è stata promossa (promosso_il) e il suo pari
-- è una riga ManyChat dello stesso utente. Una volta sola: dopo il ritiro
-- promosso_il torna vuoto, quindi una seconda chiamata non fa niente. Non letti
-- mai sotto zero. Pari del Cloud (canale vuoto) o riga mai promossa: false.
CREATE OR REPLACE FUNCTION public.ponte_wa_ritira(p_user_id uuid, p_msg uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_n text;
BEGIN
  IF p_user_id IS NULL OR p_msg IS NULL THEN
    RETURN false;
  END IF;

  SELECT regexp_replace(coalesce(w.from_number, ''), '\D', '', 'g') INTO v_n
    FROM public.whatsapp_messages w
    JOIN public.whatsapp_messages p ON p.id = w.duplicato_di
   WHERE w.id = p_msg
     AND w.user_id = p_user_id
     AND w.canale = 'baileys'
     AND w.direction = 'inbound'
     AND w.promosso_il IS NOT NULL
     AND p.user_id = p_user_id
     AND p.canale = 'manychat'
     FOR UPDATE OF w;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.whatsapp_contacts c
     SET unread_count = greatest(c.unread_count - 1, 0),
         updated_at   = now()
   WHERE c.id = (
           SELECT x.id FROM public.whatsapp_contacts x
            WHERE x.user_id = p_user_id
              AND x.phone_e164 IN ('+' || v_n, v_n)
            ORDER BY (x.phone_e164 = '+' || v_n) DESC
            LIMIT 1
         );

  UPDATE public.whatsapp_messages w SET promosso_il = NULL WHERE w.id = p_msg;
  RETURN true;
END $$;

-- ── 4. Dopo l'attesa, un'entrata solo del ponte diventa un'entrata vera ──────
-- Righe: dell'utente, del ponte, in entrata, senza pari, non ancora promosse,
-- con attesa_dal fra 1 giorno fa e p_attesa_s secondi fa (oltre il giorno si
-- lasciano perdere). Le più vecchie un numero alla volta: l'ordine per numero
-- è lo stesso di ponte_wa_scrivi sui contatti, così due richieste insieme non
-- si bloccano a vicenda. Per ciascuna: il contatto con le cifre di from_number
-- (col «+» o senza, meglio col «+»); contatto assente → la riga resta (si
-- ritenta); risposto_il già dopo il messaggio → non si conta (attesa_dal
-- svuotato, saltate+1); altrimenti +1 e promosso_il = now().
-- p_attesa_s nullo vale 120. Restituisce {promosse, saltate}.
CREATE OR REPLACE FUNCTION public.ponte_wa_promuovi(p_user_id uuid, p_attesa_s int)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  r          record;
  v_cid      uuid;
  v_risp     timestamptz;
  v_promosse int := 0;
  v_saltate  int := 0;
BEGIN
  IF p_user_id IS NOT NULL THEN
    FOR r IN
      SELECT w.id, w.created_at, w.body,
             regexp_replace(coalesce(w.from_number, ''), '\D', '', 'g') AS n
        FROM public.whatsapp_messages w
       WHERE w.user_id = p_user_id
         AND w.canale = 'baileys'
         AND w.direction = 'inbound'
         AND w.duplicato_di IS NULL
         AND w.promosso_il IS NULL
         AND w.attesa_dal IS NOT NULL
         AND w.attesa_dal >= now() - interval '1 day'
         AND w.attesa_dal <= now() - make_interval(secs => greatest(coalesce(p_attesa_s, 120), 0))
       ORDER BY regexp_replace(coalesce(w.from_number, ''), '\D', '', 'g'), w.created_at, w.id
       LIMIT 500
       FOR UPDATE OF w SKIP LOCKED
    LOOP
      v_cid := NULL;
      SELECT x.id, x.risposto_il INTO v_cid, v_risp
        FROM public.whatsapp_contacts x
       WHERE x.user_id = p_user_id
         AND x.phone_e164 IN ('+' || r.n, r.n)
       ORDER BY (x.phone_e164 = '+' || r.n) DESC
       LIMIT 1
       FOR UPDATE;
      IF v_cid IS NULL THEN
        CONTINUE;
      END IF;

      IF v_risp IS NOT NULL AND v_risp >= r.created_at THEN
        UPDATE public.whatsapp_messages SET attesa_dal = NULL WHERE id = r.id;
        v_saltate := v_saltate + 1;
        CONTINUE;
      END IF;

      UPDATE public.whatsapp_contacts x
         SET unread_count                = x.unread_count + 1,
             ultimo_in_entrata_anteprima = CASE WHEN x.ultimo_in_entrata_il IS NULL OR r.created_at >= x.ultimo_in_entrata_il
                                                THEN left(r.body, 100) ELSE x.ultimo_in_entrata_anteprima END,
             ultimo_in_entrata_il        = greatest(coalesce(x.ultimo_in_entrata_il, '-infinity'), r.created_at),
             last_message_at             = greatest(coalesce(x.last_message_at, '-infinity'), r.created_at),
             updated_at                  = now()
       WHERE x.id = v_cid;
      UPDATE public.whatsapp_messages SET promosso_il = now() WHERE id = r.id;
      v_promosse := v_promosse + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('promosse', v_promosse, 'saltate', v_saltate);
END $$;

-- ── 5. Chi può chiamare cosa: SOLO il server ─────────────────────────────────
REVOKE ALL ON FUNCTION public.ponte_wa_scrivi(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ponte_wa_ritira(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ponte_wa_promuovi(uuid, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ponte_wa_scrivi(uuid, jsonb, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ponte_wa_ritira(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ponte_wa_promuovi(uuid, int) TO service_role;

NOTIFY pgrst, 'reload schema';
