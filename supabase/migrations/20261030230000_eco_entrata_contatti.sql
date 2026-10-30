-- ─────────────────────────────────────────────────────────────────────────────
-- L'ECO DI MANYCHAT NON RESTA SUL CONTATTO COME «ULTIMA ENTRATA» (30/10/2026)
--
-- Guasto del titolare (30/10, 22:22): chat con gli ultimi messaggi tutti nostri
-- restavano in «Da rispondere». Ogni messaggio mandato dal telefono torna da
-- ManyChat dopo pochi secondi come «entrata» (eco). La rotta ha già scritto
-- whatsapp_contacts.ultimo_in_entrata_il (whatsapp_registra_entrata) con l'ora
-- dell'eco, che è DOPO il nostro ultimo messaggio. Poi la pulizia (p8
-- wa_segna_eco_doppioni, o la PROPOSTA manuale del 29/10) segna la riga
-- «duplicato_di» e la chat la nasconde, ma NON ricalcola il contatto.
--
-- La VISTA (src/crm/chatwa/stato.ts) ora ignora quell'eco anche sui dati già
-- sporchi: questa migrazione NON è necessaria per «Da rispondere» né per il
-- numeretto del menu. Serve perché il contatto resti giusto anche per chi lo
-- legge senza la vista: riepiloghi, bozze dell'AI, controllo della notte,
-- finestra di 24 ore, ordine di «Tutte».
--
-- COSA AGGIUNGE (solo aggiunte, nessun dato cancellato)
--   · wa_riallinea_entrata_eco(p_msg, p_non_letti) — se l'ultima entrata del
--     contatto coincide con QUELLA eco (stessa ora, entro 1 minuto dopo), la
--     riporta all'ultima entrata vera (messaggio in entrata, non doppione; le
--     righe del ponte solo se promosse): ultimo_in_entrata_il e
--     ultimo_in_entrata_anteprima; senza entrate vere, vuote. Se l'ultimo
--     messaggio salvato sul contatto (ultimo_messaggio_*) e last_message_at
--     erano proprio l'eco, tornano all'ultimo messaggio non doppione di
--     qualunque direzione. Se dopo l'eco è già arrivato altro (entrata più
--     tarda di 1 minuto) NON tocca queste colonne. -1 ai non letti (mai sotto
--     zero) per ogni eco più nuova dell'ultima entrata vera, se p_non_letti.
--   · trigger trg_wa_eco_segnata — la chiama da solo quando una riga ManyChat
--     in entrata («mc-in:…») riceve duplicato_di (pulizia della notte, proposta
--     manuale, qualunque altra via). È DIFFERITO a fine transazione: la pulizia
--     segna una serie di eco una dopo l'altra, e il riallineo deve vedere tutta
--     la serie già segnata. Un errore qui NON ferma la pulizia: finisce in un
--     WARNING del database con il solo codice.
--
-- ⚠️ ORDINE: dopo 20261030101100_p1-chat-veloce.sql (ultimo_messaggio_*),
--    20261030160000_ponte_tutte_le_chat.sql (promosso_il) e
--    20261029120000_ponte_whatsapp.sql (duplicato_di).
-- ⚠️ Applicarla due volte non fa danni (OR REPLACE, DROP TRIGGER IF EXISTS).
-- ⚠️ NON la lancia la squadra: la applica il capo progetto con l'OK del titolare.
--    Collaudo su un Postgres di prova: prove/sql/eco-entrata.sql.
--
-- COME SI TOGLIE: DROP TRIGGER trg_wa_eco_segnata ON public.whatsapp_messages;
--   DROP FUNCTION public.wa_eco_segnata(); DROP FUNCTION public.wa_riallinea_entrata_eco(uuid, boolean);
--   (i contatti già riallineati restano com'erano: nessuna tabella è stata toccata nella struttura).
--
-- RIPULITURA UNA TANTUM DEI CONTATTI GIÀ SPORCHI (FACOLTATIVA, non parte da sola):
-- la vista non ne ha bisogno. Se il titolare la vuole, dopo aver letto l'elenco:
--   SELECT public.wa_riallinea_entrata_eco(w.id, false)
--     FROM public.whatsapp_messages w
--    WHERE w.direction = 'inbound' AND w.wa_message_id LIKE 'mc-in:%'
--      AND w.duplicato_di IS NOT NULL
--    ORDER BY w.created_at;
-- (false = i non letti non si toccano: per lo storico non si sa quante volte sono stati azzerati.)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.wa_riallinea_entrata_eco(p_msg uuid, p_non_letti boolean DEFAULT true)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  e       record;
  c       record;
  v_vera  record;
  v_ult   record;
  v_cifre text;
  v_meno  boolean;
  v_coincide boolean;
BEGIN
  SELECT w.user_id, w.created_at,
         regexp_replace(coalesce(w.from_number, ''), '\D', '', 'g') AS n
    INTO e
    FROM public.whatsapp_messages w
   WHERE w.id = p_msg
     AND w.direction = 'inbound'
     AND w.duplicato_di IS NOT NULL
     AND w.wa_message_id LIKE 'mc-in:%';
  IF NOT FOUND OR e.n = '' THEN
    RETURN false;
  END IF;
  v_cifre := e.n;

  SELECT x.id, x.ultimo_in_entrata_il, x.ultimo_messaggio_il, x.last_message_at
    INTO c
    FROM public.whatsapp_contacts x
   WHERE x.user_id = e.user_id
     AND x.phone_e164 IN ('+' || v_cifre, v_cifre)
   ORDER BY (x.phone_e164 = '+' || v_cifre) DESC
   LIMIT 1
   FOR UPDATE;
  IF NOT FOUND OR c.ultimo_in_entrata_il IS NULL THEN
    RETURN false;
  END IF;

  -- L'ultima entrata vera: non doppione/eco; le righe del ponte solo se promosse.
  SELECT m.created_at, m.body INTO v_vera
    FROM public.whatsapp_messages m
   WHERE m.user_id = e.user_id
     AND m.direction = 'inbound'
     AND m.duplicato_di IS NULL
     AND m.id <> p_msg
     AND regexp_replace(coalesce(m.from_number, ''), '\D', '', 'g') = v_cifre
     AND (m.canale IS DISTINCT FROM 'baileys' OR m.promosso_il IS NOT NULL)
   ORDER BY m.created_at DESC
   LIMIT 1;

  -- L'ultimo messaggio di qualunque direzione, senza doppioni (come wa_contatto_anteprima).
  SELECT m.created_at, m.body, m.direction INTO v_ult
    FROM public.whatsapp_messages m
   WHERE m.user_id = e.user_id
     AND m.duplicato_di IS NULL
     AND m.id <> p_msg
     AND (   (m.direction = 'inbound'  AND regexp_replace(coalesce(m.from_number, ''), '\D', '', 'g') = v_cifre)
          OR (m.direction <> 'inbound' AND regexp_replace(coalesce(m.to_number, ''), '\D', '', 'g') = v_cifre))
   ORDER BY m.created_at DESC
   LIMIT 1;

  -- Non letti: ogni eco più nuova dell'ultima entrata vera ha dato +1 sopra il suo
  -- vero numero. (Un'eco più vecchia di una entrata vera: non si sa se i non letti
  -- sono stati azzerati nel frattempo, e si lascia stare.)
  v_meno := p_non_letti AND (v_vera.created_at IS NULL OR e.created_at > v_vera.created_at);
  -- L'ultima entrata del contatto è proprio questa eco? La rotta scrive l'ora del
  -- database DOPO il messaggio: mai prima, e di poco dopo. Altrimenti è un'altra
  -- cosa (o un'entrata arrivata dopo) e le colonne d'entrata non si toccano.
  v_coincide := c.ultimo_in_entrata_il >= e.created_at
            AND c.ultimo_in_entrata_il <= e.created_at + interval '1 minute';

  UPDATE public.whatsapp_contacts k
     SET ultimo_in_entrata_il        = CASE WHEN v_coincide THEN v_vera.created_at ELSE k.ultimo_in_entrata_il END,
         ultimo_in_entrata_anteprima = CASE WHEN v_coincide THEN left(v_vera.body, 200) ELSE k.ultimo_in_entrata_anteprima END,
         unread_count                = CASE WHEN v_meno THEN greatest(k.unread_count - 1, 0) ELSE k.unread_count END,
         -- l'ultimo messaggio salvato sul contatto, solo se era proprio l'eco
         ultimo_messaggio_il         = CASE WHEN k.ultimo_messaggio_il = e.created_at
                                            THEN v_ult.created_at ELSE k.ultimo_messaggio_il END,
         ultimo_messaggio_anteprima  = CASE WHEN k.ultimo_messaggio_il = e.created_at
                                            THEN left(v_ult.body, 200) ELSE k.ultimo_messaggio_anteprima END,
         ultimo_messaggio_direzione  = CASE WHEN k.ultimo_messaggio_il = e.created_at
                                            THEN v_ult.direction ELSE k.ultimo_messaggio_direzione END,
         -- last_message_at, solo se lo aveva spostato l'eco (entro 1 minuto dopo di lei)
         last_message_at             = CASE WHEN k.last_message_at >= e.created_at
                                             AND k.last_message_at <= e.created_at + interval '1 minute'
                                            THEN coalesce(v_ult.created_at, v_vera.created_at, k.last_message_at)
                                            ELSE k.last_message_at END,
         updated_at                  = now()
   WHERE k.id = c.id;
  RETURN true;
END $$;

-- La funzione si fida di p_msg: SOLO il server e il trigger.
REVOKE ALL ON FUNCTION public.wa_riallinea_entrata_eco(uuid, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_riallinea_entrata_eco(uuid, boolean) TO service_role;

-- Il trigger: una riga ManyChat in entrata riceve duplicato_di → il suo contatto si riallinea.
CREATE OR REPLACE FUNCTION public.wa_eco_segnata()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  BEGIN
    PERFORM public.wa_riallinea_entrata_eco(NEW.id, true);
  EXCEPTION WHEN OTHERS THEN
    -- Mai fermare la pulizia per questo: solo il codice, nessun dato del cliente.
    RAISE WARNING 'wa_eco_segnata: riallineo del contatto non riuscito (%)', SQLSTATE;
  END;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION public.wa_eco_segnata() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_wa_eco_segnata ON public.whatsapp_messages;
CREATE CONSTRAINT TRIGGER trg_wa_eco_segnata
  AFTER UPDATE OF duplicato_di ON public.whatsapp_messages
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  WHEN (OLD.duplicato_di IS NULL AND NEW.duplicato_di IS NOT NULL
        AND NEW.direction = 'inbound' AND NEW.wa_message_id LIKE 'mc-in:%')
  EXECUTE FUNCTION public.wa_eco_segnata();
