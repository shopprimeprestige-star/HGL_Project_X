-- ─────────────────────────────────────────────────────────────────────────────
-- IL PONTE WHATSAPP · IL SEGNO «HA UN MESSAGGIO DEL PONTE», A COSTO ZERO
--
-- Commessa 2026-11-13-chat-baileys (PIANO.md, filo A, T1, v2 dopo la
-- revisione). La sezione nuova «WhatsApp Baileys» e la terza scelta sul lead
-- devono sapere, per centinaia di chat insieme, se una chat ha almeno un
-- messaggio canale='baileys' — senza una query per chat e, soprattutto, senza
-- una scansione della cronologia del ponte (fino a 100.000 righe per utente)
-- a ogni singolo contatto nuovo del CRM (importazioni lead, ManyChat,
-- `SchedaRipesca`/`SchedaRimandati`), che con quella non hanno niente a
-- vedere.
--
-- COSA AGGIUNGE (solo aggiunte: nessuna riga esistente viene riscritta)
--   · whatsapp_contacts.ha_messaggio_ponte — true appena esiste un messaggio
--     canale='baileys' per quel numero. Non torna mai a false.
--   · Il segno lo scrivono le DUE funzioni che sono le UNICHE a scrivere
--     canale='baileys' lato server (verificato nel codice: nessuna rotta
--     TypeScript inserisce righe a mano), dentro la stessa scrittura sul
--     contatto che fanno GIÀ, nella stessa chiamata in cui inseriscono il
--     messaggio — zero righe lette in più:
--       - ponte_wa_scrivi — RIDEFINITA (CREATE OR REPLACE, stessa firma): il
--         corpo è quello di 20261030160000_ponte_tutte_le_chat.sql con TRE
--         sole aggiunte, ognuna marcata nel testo col commento SEGNO PONTE,
--         datato 2026-11-13 (il ramo UPDATE, il ramo INSERT, il
--         ramo ON CONFLICT ... DO UPDATE del passo 3, il giro sui contatti
--         delle righe appena inserite). Una prova
--         (prove/ponte/chat-flag-migrazione.mjs) confronta il corpo con
--         quello vecchio e fallisce se differisce in altro.
--       - ponte_wa_invio_esito — RIDEFINITA (CREATE OR REPLACE, stessa
--         firma): il corpo è quello di 20261030120000_ponte_invio_manuale.sql
--         con le stesse tre aggiunte marcate, nello stesso blocco («Il
--         contatto»). Stessa prova di confronto testo.
--   · wa_messaggio_ponte_segno + trg_wa_messaggi_ponte_segno — un trigger SU
--     whatsapp_messages (non su whatsapp_contacts), AFTER INSERT, WHEN
--     (NEW.canale = 'baileys'): non scatta per i messaggi normali, e
--     aggiorna con un UPDATE indicizzato (user_id, phone_e164, l'indice unico
--     già esistente) un contatto che esiste GIÀ — zero scansioni, nessuna
--     query nuova non indicizzata. È RIDONDANTE con la correzione nelle due
--     funzioni sopra (che da sole coprono il 100% dei casi, essendo le
--     uniche scritture di canale='baileys'): lo si tiene come seconda rete, a
--     costo pressoché nullo, per il giorno in cui — si spera non succeda —
--     qualcos'altro scrivesse una riga del ponte senza passare da lì.
--   · Riempimento una tantum: i contatti che hanno GIÀ un messaggio del
--     ponte, scritto prima di questa migrazione, vengono segnati una volta.
--
-- ⚠️ NIENTE TRIGGER SU whatsapp_contacts. Il piano v1 di questa commessa ne
--    aveva uno (AFTER INSERT ON whatsapp_contacts, senza WHEN) che per capire
--    se un contatto NUOVO aveva già un messaggio del ponte interrogava
--    whatsapp_messages con un'espressione (regexp_replace) che nessun indice
--    esistente copre: una scansione completa della cronologia del ponte a
--    OGNI contatto nuovo creato nel CRM, non solo quelli del ponte — una
--    tassa su importazioni lead, ManyChat, SchedaRipesca/SchedaRimandati.
--    Bloccato dal revisore (LAVAGNA.md, piano v1). Corretto qui: il segno lo
--    scrivono le due funzioni sopra, dentro una scrittura sul contatto che
--    avviene comunque — zero costo nuovo per quelle strade, perché non
--    chiamano mai queste due funzioni.
-- ⚠️ CHI PUÒ CHIAMARE wa_messaggio_ponte_segno: solo il trigger (SECURITY
--    DEFINER, REVOKE da PUBLIC, anon, authenticated). ponte_wa_scrivi e
--    ponte_wa_invio_esito restano come oggi: SOLO il server (le migrazioni
--    che le hanno create tengono già il REVOKE/GRANT giusto; CREATE OR
--    REPLACE non tocca i privilegi di un oggetto esistente).
-- ⚠️ ORDINE: dopo 20261030160000_ponte_tutte_le_chat.sql (ponte_wa_scrivi v2)
--    e 20261030120000_ponte_invio_manuale.sql (ponte_wa_invio_esito).
-- ⚠️ Applicarla due volte non fa danni (IF NOT EXISTS, OR REPLACE, il
--    riempimento una tantum si ferma da solo su un segno già acceso).
-- ⚠️ Il codice pubblicato funziona anche SENZA questa migrazione: nessuna
--    rotta TypeScript legge ancora ha_messaggio_ponte in questo compito (la
--    legge T2-T4, filo B, su file diversi). Applicata DOPO il codice, nessun
--    danno; applicata PRIMA, le due funzioni scrivono una colonna che nessuno
--    legge ancora.
-- ⚠️ NON la lancia la squadra: la applica il titolare (o il capo progetto su
--    sua richiesta), dopo averla letta e dopo il collaudo
--    prove/sql/ponte-chat-flag.sql su un database di prova.
--
-- QUERY DI VERIFICA (dopo l'applicazione)
--   select column_name from information_schema.columns
--    where table_name = 'whatsapp_contacts' and column_name = 'ha_messaggio_ponte';   -- 1 riga
--   select proname from pg_proc where proname = 'wa_messaggio_ponte_segno' and pronamespace = 'public'::regnamespace;   -- 1 riga
--   select has_function_privilege('anon', 'public.wa_messaggio_ponte_segno()', 'EXECUTE');   -- false
--   select count(*) from public.whatsapp_contacts where ha_messaggio_ponte;   -- quanti contatti hanno già una chat del ponte
--
-- COME SI ANNULLA (solo se serve davvero; MAI eseguito dalla squadra):
--   1. Rimettere i corpi vecchi di ponte_wa_scrivi e ponte_wa_invio_esito:
--      rilanciare i blocchi «CREATE OR REPLACE FUNCTION» di
--      20261030160000_ponte_tutte_le_chat.sql e
--      20261030120000_ponte_invio_manuale.sql. Le loro autorizzazioni restano.
--   2. DROP TRIGGER trg_wa_messaggi_ponte_segno ON public.whatsapp_messages;
--      DROP FUNCTION public.wa_messaggio_ponte_segno();
--   3. ALTER TABLE public.whatsapp_contacts DROP COLUMN ha_messaggio_ponte;
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. La colonna ─────────────────────────────────────────────────────────
-- whatsapp_contacts.ha_messaggio_ponte: true appena esiste un messaggio
-- canale='baileys' per quel numero. Non torna mai a false. Lo scrivono le due
-- funzioni che scrivono 'baileys' (ponte_wa_scrivi, ponte_wa_invio_esito,
-- ridefinite più sotto), più — seconda rete, non il percorso principale — un
-- trigger su whatsapp_messages per un contatto che esiste già.
ALTER TABLE public.whatsapp_contacts
  ADD COLUMN IF NOT EXISTS ha_messaggio_ponte boolean NOT NULL DEFAULT false;

-- ── 2. Il trigger, seconda rete: solo UPDATE, indicizzato, mai una scansione ─
CREATE OR REPLACE FUNCTION public.wa_messaggio_ponte_segno()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_cifre text;
BEGIN
  IF NEW.canale IS DISTINCT FROM 'baileys' THEN RETURN NULL; END IF;
  v_cifre := regexp_replace(
    coalesce(CASE WHEN NEW.direction = 'inbound' THEN NEW.from_number ELSE NEW.to_number END, ''),
    '\D', '', 'g');
  IF v_cifre = '' THEN RETURN NULL; END IF;
  -- Solo UPDATE, indicizzato (user_id, phone_e164): nessuna scansione. Se il
  -- contatto non esiste ancora (il caso comune: lo storico scrive i messaggi
  -- PRIMA del contatto) non fa niente — lo segna ponte_wa_scrivi, sotto.
  UPDATE public.whatsapp_contacts c
     SET ha_messaggio_ponte = true
   WHERE c.user_id = NEW.user_id
     AND c.phone_e164 IN ('+' || v_cifre, v_cifre)
     AND c.ha_messaggio_ponte = false;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_wa_messaggi_ponte_segno ON public.whatsapp_messages;
CREATE TRIGGER trg_wa_messaggi_ponte_segno
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW WHEN (NEW.canale = 'baileys')
  EXECUTE FUNCTION public.wa_messaggio_ponte_segno();

REVOKE ALL ON FUNCTION public.wa_messaggio_ponte_segno() FROM PUBLIC, anon, authenticated;

-- ── 3. ponte_wa_scrivi: stesso corpo della v2 (20261030160000), + 3 righe marcate ──
-- Commento della v2 invariato (vale ancora): il corpo è quello di
-- 20261029120000 con le tre modifiche TUTTE LE CHAT (a/b/c) già applicate, e
-- qui si aggiungono, nel passo 3 (il giro sui contatti delle righe inserite
-- adesso), le tre righe marcate SEGNO PONTE: ramo UPDATE, ramo INSERT, ramo
-- ON CONFLICT ... DO UPDATE.
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
           -- SEGNO PONTE (2026-11-13): il contatto toccato qui ha un messaggio del ponte.
           SET ha_messaggio_ponte = true,
               last_message_at = greatest(x.last_message_at, g.ultimo),
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
        -- SEGNO PONTE (2026-11-13): la colonna nuova, anche quando il contatto nasce ora.
        INSERT INTO public.whatsapp_contacts AS w (user_id, phone_e164, display_name, last_message_at, risposto_il, origine, ha_messaggio_ponte)
        -- TUTTE LE CHAT: (c) un contatto nuovo del ponte nasce senza nome (è uno sconosciuto).
        VALUES (p_user_id, '+' || g.n, NULL, g.ultimo, v_risp, 'baileys', true)
        ON CONFLICT (user_id, phone_e164) DO UPDATE
           -- SEGNO PONTE (2026-11-13): idem, se il contatto esisteva già.
           SET ha_messaggio_ponte = true,
               last_message_at = greatest(w.last_message_at, excluded.last_message_at),
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

-- ── 4. ponte_wa_invio_esito: stesso corpo di 20261030120000, + 3 righe marcate ──
-- Commento della migrazione originale invariato (vale ancora): l'esito del
-- Mac, nel blocco «Il contatto», segna adesso anche ha_messaggio_ponte, nello
-- stesso schema di ponte_wa_scrivi sopra.
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
         -- SEGNO PONTE (2026-11-13): l'invio dal telefono è un messaggio del ponte.
         SET ha_messaggio_ponte = true,
             last_message_at = greatest(x.last_message_at, v_ora),
             risposto_il     = greatest(coalesce(x.risposto_il, '-infinity'), least(v_ora, now())),
             updated_at      = now()
       WHERE x.id = v_cid;
    ELSE
      -- SEGNO PONTE (2026-11-13): colonna nuova, anche quando il contatto nasce ora.
      INSERT INTO public.whatsapp_contacts AS w (user_id, phone_e164, last_message_at, risposto_il, origine, ha_messaggio_ponte)
      VALUES (p_user_id, '+' || r.numero, v_ora, least(v_ora, now()), 'baileys', true)
      ON CONFLICT (user_id, phone_e164) DO UPDATE
         -- SEGNO PONTE (2026-11-13): idem, se il contatto esisteva già.
         SET ha_messaggio_ponte = true,
             last_message_at = greatest(w.last_message_at, excluded.last_message_at),
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

-- ── 5. Riempimento una tantum: chi ha GIÀ un messaggio del ponte ─────────────
-- Senza questo, la sezione nuova si vedrebbe vuota per settimane finché non
-- arriva un messaggio nuovo per ogni numero: i contatti con una cronologia
-- del ponte già scritta prima di questa migrazione vanno segnati subito.
WITH numeri AS (
  SELECT DISTINCT w.user_id,
         regexp_replace(CASE WHEN w.direction = 'inbound' THEN w.from_number ELSE w.to_number END, '\D', '', 'g') AS cifre
    FROM public.whatsapp_messages w WHERE w.canale = 'baileys'
)
UPDATE public.whatsapp_contacts c SET ha_messaggio_ponte = true
  FROM numeri n
 WHERE c.user_id = n.user_id AND regexp_replace(c.phone_e164, '\D', '', 'g') = n.cifre
   AND n.cifre <> '' AND c.ha_messaggio_ponte = false;

NOTIFY pgrst, 'reload schema';
