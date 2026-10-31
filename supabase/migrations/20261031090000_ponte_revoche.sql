-- ─────────────────────────────────────────────────────────────────────────────
-- LE REVOCHE DEL PONTE: UN MESSAGGIO NOSTRO ELIMINATO DAL TELEFONO SPARISCE DALLA CHAT (31/10/2026)
--
-- Commessa 2026-10-31, ponte-revoche. Richiesta del titolare: «se elimino un messaggio da WhatsApp
-- nativo, deve sparire anche dalla chat del CRM. Solo quelli che elimino io, non quelli dei clienti.»
-- Caso reale: un promemoria nostro «eliminato per tutti» dal telefono restava visibile nel CRM.
-- Il ponte (Mac) riconosce la cancellazione per tutti di un messaggio NOSTRO (key.fromMe) e la manda
-- alla rotta con la chiave bw:<cifre>:<id>; la rotta chiama la funzione di questo file.
--
-- COSA AGGIUNGE (solo aggiunte: niente DELETE, i dati restano)
--   · whatsapp_messages.eliminato_il (timestamptz) — quando il messaggio è stato eliminato dal
--     telefono. La chat e i calcoli sull'«ultima uscita» non mostrano né contano le righe con
--     eliminato_il. La scrive SOLO ponte_wa_revoca.
--   · ponte_wa_revoca(p_user_id, p_chiave) → jsonb {trovate, marcate} — SECURITY DEFINER,
--     search_path fisso, EXECUTE solo a service_role. Trova la riga del ponte con quella chiave
--     (canale baileys, direzione OUTBOUND: un messaggio di un cliente non si nasconde mai) e marca
--     eliminata lei E la riga ManyChat/CRM di cui è il doppione (duplicato_di), nei due versi:
--     la riga puntata dalla sua duplicato_di e le righe nostre che puntano a lei. Altrimenti il
--     messaggio resterebbe visibile tramite l'originale. Una riga già marcata non si ritocca
--     (eliminato_il resta la prima ora): ripassare è innocuo; il Mac ripassa a 5 min, 30 min, 2 ore.
--   · L'anteprima del contatto: se l'ultimo messaggio salvato sul contatto (ultimo_messaggio_*) o
--     last_message_at erano proprio il messaggio eliminato, tornano all'ultimo messaggio rimasto
--     (senza doppioni né eliminati; senza messaggi, vuoti). Se risposto_il era l'ora di quel
--     messaggio nostro, torna all'ultima nostra uscita rimasta (o vuoto): un messaggio eliminato non
--     conta più come risposta. «Fatto» (risposto_il = ora) e le colonne d'entrata NON si toccano.
--     updated_at del contatto si muove, così la lettura a pezzi della chat lo vede.
--   · cambiato_il della riga lo scrive già il trigger trg_wa_messaggi_cambiato_il (p1-chat-veloce) a
--     ogni UPDATE: la chat in tempo reale e quella incrementale ricevono la riga con eliminato_il.
--
-- ⚠️ ORDINE: dopo 20261029120000_ponte_whatsapp.sql (canale, duplicato_di) e
--    20261030101100_p1-chat-veloce.sql (cambiato_il, ultimo_messaggio_*).
-- ⚠️ Applicarla due volte non fa danni (IF NOT EXISTS, OR REPLACE).
-- ⚠️ Il codice pubblicato funziona anche SENZA questa migrazione: la rotta risponde 500 (il Mac
--    ritenta per 24 ore) e la chat ripiega sulla lettura senza il filtro (colonna assente).
-- ⚠️ NON la lancia la squadra: la applica il capo progetto con l'OK del titolare.
--    Collaudo su un Postgres di prova: prove/sql/ponte-revoche.sql.
--
-- COME SI ANNULLA (solo se serve davvero; il codice ripiega da solo):
--   DROP FUNCTION public.ponte_wa_revoca(uuid, text);
--   ALTER TABLE public.whatsapp_messages DROP COLUMN eliminato_il;
--   (i messaggi marcati tornano visibili; per riaverli prima: UPDATE … SET eliminato_il = NULL).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS eliminato_il timestamptz;

CREATE OR REPLACE FUNCTION public.ponte_wa_revoca(p_user_id uuid, p_chiave text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_cifre   text;
  v_b       record;
  v_ids     uuid[];
  v_quando  timestamptz[];
  v_trovate int;
  v_marcate int;
  v_c       record;
  v_ult     record;
  v_prec    timestamptz;
BEGIN
  IF p_user_id IS NULL OR p_chiave IS NULL
     OR p_chiave !~ '^bw:[0-9]{8,15}:[A-Za-z0-9_.-]{1,128}$' THEN
    RAISE EXCEPTION 'ponte_wa_revoca: parametri non validi' USING ERRCODE = '22023';
  END IF;
  v_cifre := split_part(p_chiave, ':', 2);

  -- La riga del ponte: solo una NOSTRA uscita. Un messaggio di un cliente non si nasconde mai.
  SELECT w.id, w.duplicato_di INTO v_b
    FROM public.whatsapp_messages w
   WHERE w.user_id = p_user_id
     AND w.wa_message_id = p_chiave
     AND w.canale = 'baileys'
     AND w.direction = 'outbound';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('trovate', 0, 'marcate', 0);
  END IF;

  -- Lei, la riga di cui è il doppione, e le righe nostre che sono doppioni di lei.
  SELECT array_agg(x.id), array_agg(x.created_at), count(*)::int INTO v_ids, v_quando, v_trovate
    FROM (
      SELECT w.id, w.created_at
        FROM public.whatsapp_messages w
       WHERE w.user_id = p_user_id
         AND w.direction = 'outbound'
         AND (w.id = v_b.id OR w.id = v_b.duplicato_di OR w.duplicato_di = v_b.id)
    ) x;

  UPDATE public.whatsapp_messages w
     SET eliminato_il = now()
   WHERE w.id = ANY (v_ids)
     AND w.eliminato_il IS NULL;
  GET DIAGNOSTICS v_marcate = ROW_COUNT;
  IF v_marcate = 0 THEN
    RETURN jsonb_build_object('trovate', v_trovate, 'marcate', 0);
  END IF;

  -- Il contatto: anteprima, ordine e «risposto» non devono più contare il messaggio eliminato.
  SELECT k.id INTO v_c
    FROM public.whatsapp_contacts k
   WHERE k.user_id = p_user_id
     AND k.phone_e164 IN ('+' || v_cifre, v_cifre)
   ORDER BY (k.phone_e164 = '+' || v_cifre) DESC
   LIMIT 1
   FOR UPDATE;
  IF FOUND THEN
    -- L'ultimo messaggio rimasto, di qualunque direzione, senza doppioni né eliminati.
    SELECT m.created_at, m.body, m.direction INTO v_ult
      FROM public.whatsapp_messages m
     WHERE m.user_id = p_user_id
       AND m.duplicato_di IS NULL
       AND m.eliminato_il IS NULL
       AND (   (m.direction = 'inbound'  AND m.from_number IN ('+' || v_cifre, v_cifre))
            OR (m.direction <> 'inbound' AND m.to_number   IN ('+' || v_cifre, v_cifre)))
     ORDER BY m.created_at DESC
     LIMIT 1;
    -- L'ultima nostra uscita rimasta, partita (non failed).
    SELECT max(m.created_at) INTO v_prec
      FROM public.whatsapp_messages m
     WHERE m.user_id = p_user_id
       AND m.direction <> 'inbound'
       AND m.to_number IN ('+' || v_cifre, v_cifre)
       AND m.duplicato_di IS NULL
       AND m.eliminato_il IS NULL
       AND m.status IS DISTINCT FROM 'failed';

    UPDATE public.whatsapp_contacts k
       SET ultimo_messaggio_il        = CASE WHEN k.ultimo_messaggio_il = ANY (v_quando)
                                             THEN v_ult.created_at ELSE k.ultimo_messaggio_il END,
           ultimo_messaggio_anteprima = CASE WHEN k.ultimo_messaggio_il = ANY (v_quando)
                                             THEN left(v_ult.body, 200) ELSE k.ultimo_messaggio_anteprima END,
           ultimo_messaggio_direzione = CASE WHEN k.ultimo_messaggio_il = ANY (v_quando)
                                             THEN v_ult.direction ELSE k.ultimo_messaggio_direzione END,
           last_message_at            = CASE WHEN k.last_message_at = ANY (v_quando)
                                             THEN coalesce(v_ult.created_at, k.last_message_at)
                                             ELSE k.last_message_at END,
           risposto_il                = CASE WHEN k.risposto_il = ANY (v_quando)
                                             THEN v_prec ELSE k.risposto_il END,
           updated_at                 = now()
     WHERE k.id = v_c.id;
  END IF;

  RETURN jsonb_build_object('trovate', v_trovate, 'marcate', v_marcate);
END $$;

-- Si fida di p_user_id: SOLO il server (la rotta del ponte, con la chiave di servizio).
REVOKE ALL ON FUNCTION public.ponte_wa_revoca(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ponte_wa_revoca(uuid, text) TO service_role;
