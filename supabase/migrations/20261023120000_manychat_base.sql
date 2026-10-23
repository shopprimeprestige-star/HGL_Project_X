-- ─────────────────────────────────────────────────────────────────────────────
-- WHATSAPP CON MANYCHAT · LA BASE (M1, pacchetto urgente della conferma)
--
-- Commessa 2026-10-23. Il numero WhatsApp unico passa da ManyChat: la porta
-- unica degli invii (conferma «risponda SÌ», chat, webinar) registra qui ogni
-- invio PRIMA di chiamare ManyChat, e i freni (STOP, pausa per contatto,
-- chiave unica) si decidono in una sola transazione.
--
-- COSA AGGIUNGE (solo aggiunte: niente che cancelli o riscriva dati)
--   · manychat_config   — la configurazione: riga unica (id = 1), canale
--                         «cloud» di serie, interruttori spenti. Chiusa.
--   · manychat_invii    — il registro degli invii: telefono (solo cifre), mai
--                         nomi né testi. lead_id facoltativo (il webinar non ha
--                         scheda). Chiave unica dove c'è. Chiusa.
--   · manychat_giro     — lo stato del giro automatico: riga unica (id = 1).
--                         La riga si inserisce qui sotto; la usa per prima la
--                         prenotazione, che ci si mette in fila (FOR UPDATE).
--   · manychat_prenota_porta — prenota un invio della porta, o dice perché no.
--   · manychat_esito    — scrive l'esito, ma solo se lo stato è ancora quello
--                         che chi scrive si aspetta.
--   · whatsapp_messages.canale — facoltativa: vuota = la Cloud API di prima.
--   · programma_hook_cron_attesa — come programma_hook_cron, con in più
--                         l'attesa di pg_net (di serie chiude dopo 5 secondi).
--   · UNA riga di cron: il giro della conferma (promemoria-whatsapp-2min) con
--     attesa di 45 secondi, stesso nome del lavoro di prima (lo aggiorna). Con
--     ManyChat ogni conferma fa 4-5 chiamate: a 5 secondi il giro verrebbe
--     tagliato a metà e le conferme resterebbero «incerte».
--
-- ⚠️ TABELLE CHIUSE: RLS accesa, nessuna policy, tolto tutto ad anon e
--    authenticated. Le legge e le scrive solo il server (chiave di servizio),
--    dietro le sue guardie. Le funzioni sono SECURITY DEFINER e le può
--    chiamare solo il server. Il registro tiene il telefono perché serve ai
--    freni; quanto tenerlo lo decide il titolare (qui nessuna cancellazione).
-- ⚠️ MANCA LA RIGA DI CONFIGURAZIONE, APPOSTA: senza riga il canale è «cloud» e
--    non cambia niente. La scrive il titolare con supabase/MANYCHAT-CANALE.sql,
--    dopo averla letta.
-- ⚠️ ORDINE: dopo 20261022140000_promemoria_whatsapp.sql (serve
--    whatsapp_contacts.non_scrivere_dal). La riga del cron in fondo ha bisogno
--    di cron_sito e cron_chiave in app_config, come tutti gli altri lavori:
--    se mancano non programma niente e lo dice.
-- ⚠️ Applicarla due volte non fa danni (IF NOT EXISTS, OR REPLACE, ON CONFLICT).
-- ⚠️ Il codice pubblicato funziona anche SENZA questa migrazione: la porta resta
--    sulla Cloud API come oggi e il riquadro dice «manca l'aggiornamento del
--    database».
-- ⚠️ Il giro automatico di ManyChat (promemoria 25', ricontatti) NON è qui:
--    il suo cron è l'ultimo file di quella serie.
--
-- COME SI ANNULLA (solo se serve davvero; prima riportare il canale su «cloud»):
--   SELECT public.programma_hook_cron('promemoria-whatsapp-2min', '*/2 * * * *', '/hooks/promemoria-whatsapp');
--   DROP FUNCTION public.manychat_prenota_porta(uuid, jsonb);
--   DROP FUNCTION public.manychat_esito(uuid, uuid, jsonb, text);
--   DROP FUNCTION public.programma_hook_cron_attesa(text, text, text, integer);
--   ALTER TABLE public.whatsapp_messages DROP COLUMN canale;
--   DROP TABLE public.manychat_invii, public.manychat_giro, public.manychat_config;
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. La configurazione ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manychat_config (
  id                int PRIMARY KEY CHECK (id = 1),
  user_id           uuid,
  canale            text NOT NULL DEFAULT 'cloud' CHECK (canale IN ('cloud', 'manychat')),
  acceso            boolean NOT NULL DEFAULT false,
  promemoria        boolean NOT NULL DEFAULT false,
  ricontatti        boolean NOT NULL DEFAULT false,
  tetti             jsonb NOT NULL DEFAULT '{}'::jsonb,
  flussi            jsonb NOT NULL DEFAULT '{}'::jsonb,
  prima_accensione  timestamptz,
  ultima_accensione timestamptz,
  fermato_motivo    text,
  aggiornato_da     text,
  aggiornato_il     timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Il registro degli invii ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manychat_invii (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  lead_id       uuid,
  tipo          text NOT NULL CHECK (tipo IN ('promemoria', 'ricontatto', 'conferma', 'chat', 'webinar', 'prova')),
  chiave        text,
  telefono      text NOT NULL,
  subscriber_id bigint,
  flow_ns       text,
  stato         text NOT NULL DEFAULT 'prenotato' CHECK (stato IN ('prenotato', 'inviato', 'fallito', 'saltato', 'incerto')),
  motivo        text,
  previsto_il   timestamptz,
  prenotato_il  timestamptz NOT NULL DEFAULT now(),
  inviato_il    timestamptz,
  risposta_il   timestamptz,
  sbloccato_il  timestamptz
);

CREATE INDEX IF NOT EXISTS manychat_invii_telefono ON public.manychat_invii (telefono, prenotato_il DESC);
CREATE INDEX IF NOT EXISTS manychat_invii_subscriber ON public.manychat_invii (subscriber_id, prenotato_il DESC);
CREATE INDEX IF NOT EXISTS manychat_invii_utente_tipo ON public.manychat_invii (user_id, tipo, prenotato_il DESC);
-- Unica solo dove c'è: gli invii a mano della chat non hanno chiave.
CREATE UNIQUE INDEX IF NOT EXISTS manychat_invii_chiave_unica ON public.manychat_invii (chiave) WHERE chiave IS NOT NULL;

-- ── 3. Lo stato del giro (riga unica) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.manychat_giro (
  id                       int PRIMARY KEY CHECK (id = 1),
  lucchetto_fino           timestamptz,
  lucchetto_di             uuid,
  prossimo_ricontatto_dopo timestamptz,
  falliti_di_fila          int NOT NULL DEFAULT 0,
  ultimo_giro_il           timestamptz,
  stato                    jsonb NOT NULL DEFAULT '{}'::jsonb,
  ultima_risposta_il       timestamptz
);

INSERT INTO public.manychat_giro (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── 4. Tutto chiuso: le tabelle le tocca solo il server ──────────────────────
ALTER TABLE public.manychat_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manychat_invii ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manychat_giro ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.manychat_config FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.manychat_invii FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.manychat_giro FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.manychat_config TO service_role;
GRANT ALL ON TABLE public.manychat_invii TO service_role;
GRANT ALL ON TABLE public.manychat_giro TO service_role;

-- ── 5. Il canale sul messaggio (facoltativo: vuoto = la Cloud API di prima) ──
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS canale text;

-- ── 6. La prenotazione di un invio della porta ───────────────────────────────
-- Risponde {id} se l'invio è prenotato (e allora si può chiamare ManyChat), o
-- {motivo} se no: stop · pausa_contatto · gia_preso · dati_mancanti ·
-- manca_riga_giro. Niente di tutto questo chiama fuori dal database.
--
-- p = { tipo, telefono (solo cifre), lead_id?, chiave?, flow_ns?, previsto_il? }
--
-- L'ORDINE È QUESTO E NON SI CAMBIA:
--   1. ci si mette in fila sulla riga del giro (FOR UPDATE): due prenotazioni
--      insieme si decidono una dopo l'altra, non nello stesso istante;
--   2. «prenotato» da più di 10 minuti diventa «incerto» (un giro tagliato a
--      metà non lascia invii appesi): non si rimanda mai;
--   3. STOP: il numero ha chiesto di non essere scritto (col «+» di
--      whatsapp_contacts e senza, per le righe vecchie). Prima della pausa,
--      altrimenti chi ha detto STOP si sentirebbe dire «riprova fra poco»;
--   4. pausa per contatto: nessun nuovo invio a un telefono che ne ha avuto uno
--      negli ultimi 120 secondi, perché i campi crm_v1…v4 e crm_invio_id stanno
--      sul contatto ManyChat e due invii vicini si pesterebbero. Contano solo
--      prenotato, inviato e incerto: un saltato o un fallito non ha mandato
--      niente;
--   5. si inserisce, e la chiave unica fa da ultimo cancello.
CREATE OR REPLACE FUNCTION public.manychat_prenota_porta(p_user_id uuid, p jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pausa_s constant int := 120;
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

-- ── 7. L'esito di un invio ───────────────────────────────────────────────────
-- Aggiorna solo se lo stato è ancora p_da (di norma «prenotato»): un invio già
-- chiuso da un altro giro non si riscrive. Fonde solo i campi dell'esito che la
-- patch porta (una chiave presente con valore null SVUOTA il campo); il resto
-- della riga (telefono, chiave, scheda, tipo) non si tocca mai da qui.
-- Vero se ha toccato la riga.
CREATE OR REPLACE FUNCTION public.manychat_esito(p_user_id uuid, p_id uuid, p_patch jsonb, p_da text DEFAULT 'prenotato')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE public.manychat_invii
     SET stato         = CASE WHEN p_patch ? 'stato' THEN p_patch->>'stato' ELSE stato END,
         motivo        = CASE WHEN p_patch ? 'motivo' THEN p_patch->>'motivo' ELSE motivo END,
         subscriber_id = CASE WHEN p_patch ? 'subscriber_id' THEN (p_patch->>'subscriber_id')::bigint ELSE subscriber_id END,
         flow_ns       = CASE WHEN p_patch ? 'flow_ns' THEN p_patch->>'flow_ns' ELSE flow_ns END,
         inviato_il    = CASE WHEN p_patch ? 'inviato_il' THEN (p_patch->>'inviato_il')::timestamptz ELSE inviato_il END,
         risposta_il   = CASE WHEN p_patch ? 'risposta_il' THEN (p_patch->>'risposta_il')::timestamptz ELSE risposta_il END,
         sbloccato_il  = CASE WHEN p_patch ? 'sbloccato_il' THEN (p_patch->>'sbloccato_il')::timestamptz ELSE sbloccato_il END
   WHERE id = p_id
     AND user_id = p_user_id
     AND stato = p_da;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END $$;

-- ── 8. Il cron con l'attesa di pg_net ────────────────────────────────────────
-- Identica a programma_hook_cron (stesse letture da app_config, stessa chiave
-- PUBBLICA, mai quella di servizio), più l'attesa in millisecondi. La funzione
-- di prima non si tocca. L'attesa sta fra 1 e 120 secondi.
CREATE OR REPLACE FUNCTION public.programma_hook_cron_attesa(
  nome text,
  quando text,
  percorso text,
  attesa_ms integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
DECLARE
  sito    text;
  chiave  text;
  v_attesa integer := GREATEST(1000, LEAST(coalesce(attesa_ms, 5000), 120000));
BEGIN
  IF to_regclass('cron.job') IS NULL OR to_regclass('public.app_config') IS NULL THEN
    RAISE NOTICE 'cron «%» saltato: manca pg_cron o app_config.', nome;
    RETURN false;
  END IF;
  SELECT value INTO sito   FROM public.app_config WHERE key = 'cron_sito';
  SELECT value INTO chiave FROM public.app_config WHERE key = 'cron_chiave';
  IF coalesce(sito, '') = '' OR coalesce(chiave, '') = '' THEN
    RAISE NOTICE 'cron «%» NON programmato: scrivi in app_config le righe cron_sito e cron_chiave.', nome;
    RETURN false;
  END IF;
  PERFORM cron.schedule(
    nome,
    quando,
    format(
      'SELECT net.http_post(url := %L, headers := %L::jsonb, body := ''{}''::jsonb, timeout_milliseconds := %s);',
      rtrim(sito, '/') || percorso,
      json_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || chiave)::text,
      v_attesa
    )
  );
  RAISE NOTICE 'cron «%» programmato su % (attesa % ms)', nome, rtrim(sito, '/') || percorso, v_attesa;
  RETURN true;
END
$$;

-- ── 9. Solo il server le chiama ──────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.manychat_prenota_porta(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.manychat_esito(uuid, uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.programma_hook_cron_attesa(text, text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.manychat_prenota_porta(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.manychat_esito(uuid, uuid, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.programma_hook_cron_attesa(text, text, text, integer) TO service_role;

-- ── 10. Il giro della conferma, a 45 secondi ─────────────────────────────────
-- Stesso nome del lavoro di prima: cron.schedule con un nome che c'è già lo
-- AGGIORNA, non ne crea un secondo. Se non c'era (la riga del 22/10 non era
-- stata lanciata) lo programma: non accende niente, i messaggi partono solo
-- con l'interruttore in Impostazioni → WhatsApp → «Conferma consulenze».
--
-- Per tornare indietro (attesa di 5 secondi, com'era):
--   SELECT public.programma_hook_cron('promemoria-whatsapp-2min', '*/2 * * * *', '/hooks/promemoria-whatsapp');
SELECT public.programma_hook_cron_attesa('promemoria-whatsapp-2min', '*/2 * * * *', '/hooks/promemoria-whatsapp', 45000);

-- Il server le trova subito, senza aspettare che la cache dello schema si
-- rinnovi da sola.
NOTIFY pgrst, 'reload schema';
