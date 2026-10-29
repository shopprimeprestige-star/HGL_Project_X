-- ─────────────────────────────────────────────────────────────────────────────
-- IL PONTE WHATSAPP (Baileys) · le chat dell'app WhatsApp Business nel CRM
--
-- Commessa 2026-10-29-ponte-whatsapp-baileys (T1, PIANO §e). Il servizio sul
-- Mac del titolare legge le chat dell'app e le manda alla rotta
-- /api/public/ponte-whatsapp; la rotta scrive SOLO con le tre funzioni qui
-- sotto. Le righe del ponte stanno in whatsapp_messages con canale = 'baileys'
-- e sono SOLO DA MOSTRARE: nessuna regola (giro, «Da rispondere», non letti,
-- finestra 24 h, «Da chiamare») le legge.
--
-- COSA AGGIUNGE (solo aggiunte: nessuna riga esistente viene riscritta)
--   · whatsapp_messages.duplicato_di — la riga del ponte che ha già un «pari»
--     nel CRM (ManyChat o Cloud) punta a quella riga e la chat la nasconde.
--     Indice UNICO parziale: un messaggio del CRM è pari di UNA sola riga del
--     ponte, anche se due richieste girano insieme. Senza, «Ok» e «Ok» a 30 s
--     con un solo «Ok» nel CRM sparirebbero tutti e due.
--   · tre indici per cercare i candidati e le righe recenti del ponte.
--   · whatsapp_contacts.origine — 'baileys' sui contatti che crea il ponte (serve
--     a riconoscerli e ad annullare l'import; un contatto così NON rende «noto»
--     un numero).
--   · ponte_wa_stato — una riga per utente con lo stato del ponte (il battito).
--     L'utente la legge, scrive solo il server.
--   · ponte_wa_noti, ponte_wa_candidati, ponte_wa_scrivi — le forme JSON dei
--     parametri e dei risultati sono quelle CONGELATE in src/crm/ponte/tipi.ts
--     (RigaScrittura, Pari, NomiScrittura, RichiestaCandidato, CandidatoCrm,
--     EsitoScrittura, NumeriNoti).
--
-- ⚠️ IL PONTE NON TOCCA LE DECISIONI: sui contatti scrive solo una riga nuova
--    (non letti 0, nessuna scheda), last_message_at in avanti, il nome se manca
--    e risposto_il in avanti (D8: un messaggio uscito dal telefono negli ultimi
--    7 giorni, con l'orario vero). Mai i non letti, l'ultima entrata, la scheda,
--    l'id ManyChat, lo STOP. Non chiama nessuna funzione esistente.
-- ⚠️ NON rilanciare `manychat_giro` (§7) né `manychat_cron` dopo l'import dello storico:
--    i loro UPDATE una tantum su risposta_il leggono whatsapp_messages
--    e sbloccherebbero il freno con messaggi vecchi (T2 ci ha messo il filtro
--    canale IS DISTINCT FROM 'baileys', ma non si rilanciano comunque).
-- ⚠️ CHI PUÒ CHIAMARLE: le tre funzioni si fidano di p_user_id, quindi SOLO il
--    server (REVOKE da PUBLIC, anon e authenticated; GRANT a service_role).
-- ⚠️ ORDINE: dopo 20261028120000_chat_whatsapp_crm.sql (risposto_il) e dopo
--    20261023120000_manychat_base.sql (whatsapp_messages.canale).
-- ⚠️ Applicarla due volte non fa danni (IF NOT EXISTS, OR REPLACE).
-- ⚠️ Il codice pubblicato funziona anche SENZA questa migrazione: la chat non
--    filtra i doppioni e la rotta del ponte risponde 500 «database» (il ponte
--    aspetta e ritenta).
-- ⚠️ NON la lancia la squadra: la applica il titolare, dopo averla letta e dopo
--    il collaudo prove/sql/ponte-wa.sql su un database di prova.
--
-- COME SI ANNULLA (solo se serve davvero; MAI eseguito dalla squadra):
--   DELETE FROM public.whatsapp_messages WHERE canale = 'baileys';
--   DELETE FROM public.whatsapp_contacts c WHERE c.origine = 'baileys'
--     AND c.lead_id IS NULL AND c.unread_count = 0 AND c.ultimo_in_entrata_il IS NULL
--     AND c.non_scrivere_dal IS NULL
--     AND NOT EXISTS (SELECT 1 FROM public.whatsapp_messages w WHERE w.user_id = c.user_id
--       AND regexp_replace(CASE WHEN w.direction = 'inbound' THEN w.from_number ELSE w.to_number END, '\D', '', 'g')
--         = regexp_replace(c.phone_e164, '\D', '', 'g'));
--   DROP FUNCTION public.ponte_wa_noti(uuid, text[]);
--   DROP FUNCTION public.ponte_wa_candidati(uuid, jsonb);
--   DROP FUNCTION public.ponte_wa_scrivi(uuid, jsonb, jsonb, jsonb);
--   DROP TABLE public.ponte_wa_stato;
--   DROP INDEX public.idx_wa_messages_duplicato, public.idx_wa_messages_from_tempo,
--     public.idx_wa_messages_to_tempo, public.idx_wa_messages_baileys;
--   ALTER TABLE public.whatsapp_messages DROP COLUMN duplicato_di;
--   ALTER TABLE public.whatsapp_contacts DROP COLUMN origine;
--   Resta un limite: un risposto_il portato avanti dal ponte non torna indietro
--   (effetto lieve: una chat uscita da «Da rispondere»).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. I doppioni: duplicato_di e il suo indice UNICO ───────────────────────
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS duplicato_di uuid;

CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_messages_duplicato
  ON public.whatsapp_messages (duplicato_di)
  WHERE duplicato_di IS NOT NULL;

-- ── 2. Gli indici di ricerca ─────────────────────────────────────────────────
-- Il cliente sta in from_number per le entrate e in to_number per le uscite.
CREATE INDEX IF NOT EXISTS idx_wa_messages_from_tempo
  ON public.whatsapp_messages (user_id, from_number, created_at);
CREATE INDEX IF NOT EXISTS idx_wa_messages_to_tempo
  ON public.whatsapp_messages (user_id, to_number, created_at);
CREATE INDEX IF NOT EXISTS idx_wa_messages_baileys
  ON public.whatsapp_messages (user_id, created_at DESC)
  WHERE canale = 'baileys';

-- ── 3. Chi ha creato il contatto ─────────────────────────────────────────────
ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS origine text;

-- ── 4. Lo stato del ponte (il battito, una riga per utente) ──────────────────
-- storico e contatori arrivano già ripuliti dal server: solo numeri, al più 20
-- chiavi. Il QR non c'è mai.
CREATE TABLE IF NOT EXISTS public.ponte_wa_stato (
  user_id uuid PRIMARY KEY,
  stato text NOT NULL,
  collegato_dal timestamptz,
  ultimo_messaggio_il timestamptz,
  storico jsonb,
  contatori jsonb,
  versione text,
  aggiornato_il timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ponte_wa_stato ENABLE ROW LEVEL SECURITY;

-- Una sola policy, di lettura. Nessuna di scrittura: scrive il server con la
-- chiave di servizio, che non passa dalla RLS.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'ponte_wa_stato'
       AND policyname = 'users read own ponte stato'
  ) THEN
    CREATE POLICY "users read own ponte stato"
      ON public.ponte_wa_stato FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $do$;

-- ── 5a. Quali numeri il CRM conosce (D7) ─────────────────────────────────────
-- Delle cifre chieste, quelle con una riga contatto (col «+» o senza) NON creata
-- dal ponte, oppure con una scheda crm_leads che finisce con le stesse 9 cifre.
-- Solo lettura.
CREATE OR REPLACE FUNCTION public.ponte_wa_noti(p_user_id uuid, p_numeri text[])
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH chiesti AS (
    SELECT DISTINCT u.n
      FROM unnest(coalesce(p_numeri, '{}'::text[])) AS u(n)
     WHERE u.n ~ '^[0-9]{8,15}$'
  ), schede AS (
    SELECT DISTINCT right(regexp_replace(coalesce(l.data ->> 'telefono', ''), '\D', '', 'g'), 9) AS nove
      FROM public.crm_leads l
     WHERE l.user_id = p_user_id
  )
  SELECT coalesce(array_agg(c.n ORDER BY c.n), '{}'::text[])
    FROM chiesti c
   WHERE p_user_id IS NOT NULL
     AND (EXISTS (SELECT 1 FROM public.whatsapp_contacts x
                   WHERE x.user_id = p_user_id
                     AND x.phone_e164 IN ('+' || c.n, c.n)
                     AND x.origine IS DISTINCT FROM 'baileys')
       OR EXISTS (SELECT 1 FROM schede s
                   WHERE length(s.nove) = 9 AND s.nove = right(c.n, 9)))
$$;

-- ── 5b. I candidati «pari» di un gruppo di righe del ponte (§c1, regole 1-4) ─
-- È la stessa regola di ammessoCome e clienteCrm in src/crm/ponte/pari.ts (T3):
-- le due devono dire la stessa cosa.
-- Per ogni {k, n, d, t}: le righe CRM dello stesso utente e dello stesso
-- cliente (le cifre intere del lato cliente, comunque sia scritto: «+», spazi,
-- niente «+»; mai il lato del canale), stessa
-- direzione, entro 180 s, non del ponte, non già doppioni, non fallite (un
-- invio fallito non è mai arrivato) e non già prese da un'altra riga del ponte.
-- L'uno a uno lo decide abbinaPari (TypeScript). Solo lettura.
-- Il controllo «non già presa» è in lettura: contro due richieste insieme
-- decide l'indice unico del punto 1, dentro ponte_wa_scrivi.
CREATE OR REPLACE FUNCTION public.ponte_wa_candidati(p_user_id uuid, p_righe jsonb)
RETURNS TABLE (k text, id uuid, created_at timestamptz, direction text, body text, canale text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH r AS MATERIALIZED (
    SELECT q.k, q.n, q.d,
           to_timestamp(CASE WHEN q.t BETWEEN 1230768000 AND 4102444800 THEN q.t END) AS il
      FROM jsonb_to_recordset(CASE WHEN jsonb_typeof(p_righe) = 'array' THEN p_righe ELSE '[]'::jsonb END)
           AS q(k text, n text, d text, t double precision)
     WHERE q.k IS NOT NULL AND q.n ~ '^[0-9]{8,15}$' AND q.d IN ('in', 'out')
  )
  SELECT r.k, w.id, w.created_at, w.direction, left(w.body, 1200), w.canale
    FROM r
    JOIN public.whatsapp_messages w
      ON w.user_id = p_user_id
     AND w.created_at BETWEEN r.il - interval '180 seconds' AND r.il + interval '180 seconds'
     AND ((r.d = 'in'  AND w.direction = 'inbound'  AND regexp_replace(coalesce(w.from_number, ''), '\D', '', 'g') = r.n)
       OR (r.d = 'out' AND w.direction = 'outbound' AND regexp_replace(coalesce(w.to_number, ''),   '\D', '', 'g') = r.n))
   WHERE r.il IS NOT NULL
     AND w.canale IS DISTINCT FROM 'baileys'
     AND w.duplicato_di IS NULL
     AND w.status IS DISTINCT FROM 'failed'
     AND NOT EXISTS (SELECT 1 FROM public.whatsapp_messages x WHERE x.duplicato_di = w.id)
   ORDER BY r.k, w.created_at, w.id
$$;

-- ── 5c. Scrive un lotto del ponte, in una transazione (§e.5) ─────────────────
-- (1) Le righe, in ordine di orario: INSERT … ON CONFLICT (wa_message_id) DO
--     NOTHING (lo stesso lotto dieci volte scrive una volta). Una riga col pari
--     in p_pari nasce con duplicato_di; se quel candidato l'ha già preso
--     un'altra riga (unique_violation, anche da un'altra richiesta che gira
--     insieme) la riga si scrive VISIBILE e si conta in pari_persi: un messaggio
--     in più è meglio di un messaggio vero nascosto.
-- (2) I pari delle righe già presenti (ritentativo, controllo tardivo del
--     battito con righe vuote): UPDATE … WHERE duplicato_di IS NULL, con la
--     stessa regola per la unique_violation.
-- (3) I contatti delle righe inserite ADESSO: last_message_at in avanti, nome
--     se manca, risposto_il in avanti (D8); se il contatto non c'è nasce con
--     origine 'baileys'. updated_at = now() per OGNI contatto con una riga
--     inserita adesso, anche se la riga è più vecchia di last_message_at: il
--     controllo della chat ogni 15 s legge updated_at, e un messaggio vivo
--     arrivato in ritardo (Mac riacceso) deve comparire. Le righe già presenti
--     (ritentativo) non toccano il contatto.
-- Un pari vale solo se punta a una riga CRM dello stesso utente, non del ponte,
-- non doppione e non fallita; altrimenti si ignora. Le righe non valide (che il
-- server ha già scartato) si saltano: il database non salva mai spazzatura.
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
          media_type, status, canale, created_at, raw_payload
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
          'baileys', to_timestamp(r.t), '{}'::jsonb
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
           AND w.duplicato_di IS NULL;
        GET DIAGNOSTICS v_n = ROW_COUNT;
        v_doppioni := v_doppioni + v_n;
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
               display_name    = coalesce(x.display_name, v_nome),
               risposto_il     = CASE WHEN v_risp IS NULL THEN x.risposto_il
                                      ELSE greatest(coalesce(x.risposto_il, '-infinity'), v_risp) END,
               updated_at      = now()
         WHERE x.id = v_id;
        IF v_risp IS NOT NULL AND coalesce(v_prima, '-infinity') < v_risp THEN
          v_risposto := v_risposto + 1;
        END IF;
      ELSE
        INSERT INTO public.whatsapp_contacts AS w (user_id, phone_e164, display_name, last_message_at, risposto_il, origine)
        VALUES (p_user_id, '+' || g.n, v_nome, g.ultimo, v_risp, 'baileys')
        ON CONFLICT (user_id, phone_e164) DO UPDATE
           SET last_message_at = greatest(w.last_message_at, excluded.last_message_at),
               display_name    = coalesce(w.display_name, excluded.display_name),
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

-- ── 6. Chi può chiamare cosa: SOLO il server ─────────────────────────────────
-- Su Supabase `authenticated` ha il permesso di serie, quindi va tolto in modo
-- esplicito.
REVOKE ALL ON FUNCTION public.ponte_wa_noti(uuid, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ponte_wa_candidati(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ponte_wa_scrivi(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ponte_wa_noti(uuid, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.ponte_wa_candidati(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.ponte_wa_scrivi(uuid, jsonb, jsonb, jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
