-- ─────────────────────────────────────────────────────────────────────────────
-- LEAD DAL FOGLIO GOOGLE · IL REGISTRO E LA FUNZIONE DI INGRESSO (S1)
--
-- Commessa 2026-10-25. Lo script del titolare manda ogni riga nuova del foglio
-- dove Meta Lead Ads scrive i lead alla rotta /api/public/sheets-ingresso. La
-- rotta legge la riga (TypeScript, provato) e chiama QUI una sola funzione che
-- decide tutto in una transazione: già ricevuta? troppe righe oggi? stesso lead
-- già in archivio? stesso numero? Altrimenti crea la scheda.
--
-- COSA AGGIUNGE (solo aggiunte: niente che cancelli o riscriva dati)
--   · sheets_ingressi        — il registro delle righe arrivate: una riga per
--                              chiave (m:<id Meta> oppure f:<impronta>), con
--                              l'esito. ⚠️ NIENTE telefono, NIENTE nome, NIENTE
--                              testo: solo la chiave, l'esito e il nome del
--                              foglio. Serve a non far entrare due volte la
--                              stessa riga e a contare quante ne arrivano oggi.
--   · sheets_ingresso_scrivi — la decisione, in una transazione.
--   · sheets_ingresso_esito  — chiude un ritorno già segnato sulla scheda.
--
-- ⚠️ L'ORDINE DEI PASSI DI sheets_ingresso_scrivi È QUESTO E NON SI CAMBIA:
--   0. la chiave c'è già nel registro? → «gia_ricevuto» (risponde anche a tetto
--      raggiunto: una riga già entrata non è una riga nuova);
--   0b. TETTO DEL GIORNO: righe del registro di oggi (giorno di Roma) >=
--      TETTO_RIGHE_GIORNO (300) → «tetto», senza scrivere niente (la rotta
--      risponde 503 e lo script riprova). Il conto si fa sotto un lucchetto per
--      utente, così è esatto anche con richieste insieme. Con la chiave rubata
--      è il massimo di schede che si possono creare in un giorno;
--   1. si scrive la chiave nel registro (ON CONFLICT (chiave) DO NOTHING): due
--      richieste uguali insieme, una sola passa;
--   2. lucchetto sul NUMERO (pg_advisory_xact_lock): trigger del foglio e giro
--      di sicurezza che arrivano insieme col lead di un numero nuovo non fanno
--      due schede. Dura fino alla fine della transazione, cioè fino alla
--      creazione della scheda;
--   3. l'id del lead Meta è già su una scheda (metaLeadId, oppure datiFile.id
--      per quelle caricate da file) → «gia_presente», niente ritorno finto;
--   4. stesso numero (ultime 9 cifre, almeno 6: è chiaveTelefono del CRM) su
--      una scheda dell'utente → «ritorno»: la scheda più vecchia. Il segno sulla
--      scheda lo scrive il server (patchRicarico) e poi chiama
--      sheets_ingresso_esito;
--   5. altrimenti si crea la scheda.
--
-- ⚠️ TABELLE E FUNZIONI CHIUSE: RLS accesa, nessuna policy, tolto tutto ad anon e
--    authenticated. Le legge e le scrive solo il server (chiave di servizio). Le
--    funzioni sono SECURITY DEFINER e le può chiamare solo il server; ogni
--    ricerca porta user_id.
-- ⚠️ Nessun messaggio d'errore scritto qui dentro porta il contenuto di `data`:
--    il messaggio di Postgres su crm_leads («Failing row contains …») contiene
--    il telefono, e la rotta ne tiene solo il codice.
-- ⚠️ TETTO_RIGHE_GIORNO = 300 sta scritto UNA volta qui sotto, ed è lo stesso
--    di src/crm/sheets/ingresso.ts (lo mostra il riquadro «Foglio Google»).
-- ⚠️ ORDINE: dipende solo da M1 (20261023120000_manychat_base.sql: la rotta
--    legge l'utente da manychat_config) e dalla tabella crm_leads. Si applica
--    anche prima di M2. Applicarla due volte non fa danni (IF NOT EXISTS,
--    CREATE OR REPLACE).
-- ⚠️ Il codice pubblicato funziona anche SENZA questa migrazione: la rotta
--    risponde 503 e lo script riprova fra qualche minuto.
-- ⚠️ La ricerca per numero legge le schede dell'utente (qualche migliaio) a ogni
--    riga nuova: va bene a una riga per lead. Un indice d'espressione non serve
--    ora; se un giorno serve è un file a sé.
--
-- COME SI ANNULLA (solo se serve davvero; prima disinstallare lo script del foglio):
--   DROP FUNCTION public.sheets_ingresso_scrivi(uuid, text, text, text, text, integer, jsonb);
--   DROP FUNCTION public.sheets_ingresso_esito(uuid, text, text);
--   DROP TABLE public.sheets_ingressi;
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Il registro delle righe arrivate ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sheets_ingressi (
  chiave        text PRIMARY KEY,   -- m:<cifre dell'id Meta> oppure f:<impronta>: mai nomi né numeri
  user_id       uuid NOT NULL,
  lead_id       uuid,
  esito         text NOT NULL DEFAULT 'in_corso'
                CHECK (esito IN ('in_corso', 'nuovo', 'ritorno_da_segnare', 'ritorno', 'gia_presente', 'scartata')),
  foglio        text,               -- solo il nome del foglio, mai l'id del file Google
  riga          int,
  ricevuto_il   timestamptz NOT NULL DEFAULT now(),
  aggiornato_il timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sheets_ingressi_utente ON public.sheets_ingressi (user_id, ricevuto_il DESC);

-- ── 2. Tutto chiuso: la tabella la tocca solo il server ──────────────────────
ALTER TABLE public.sheets_ingressi ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.sheets_ingressi FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.sheets_ingressi TO service_role;

-- ── 3. La decisione ──────────────────────────────────────────────────────────
-- p_tel9 = le ultime 9 cifre del numero (chiaveTelefono del CRM), '' se la riga
-- non ha un numero valido. p_meta_id = 'l:<cifre>' o ''. p_data = la scheda già
-- pronta (la costruisce il TypeScript). Risponde:
--   {esito:'gia_ricevuto', stato, lead_id}  la chiave c'era già (stato = esito del registro)
--   {esito:'tetto'}                         troppe righe oggi, niente scritto
--   {esito:'gia_presente', lead_id}         l'id Meta è già su una scheda
--   {esito:'ritorno', lead_id}              stesso numero: la scheda da segnare
--   {esito:'nuovo', lead_id}                scheda creata
CREATE OR REPLACE FUNCTION public.sheets_ingresso_scrivi(
  p_user_id uuid,
  p_chiave  text,
  p_tel9    text,
  p_meta_id text,
  p_foglio  text,
  p_riga    integer,
  p_data    jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tetto constant int := 300;   -- TETTO_RIGHE_GIORNO (src/crm/sheets/ingresso.ts)
  v_stato text;
  v_lead  uuid;
  v_n     int;
BEGIN
  IF p_user_id IS NULL OR coalesce(p_chiave, '') = '' THEN
    RETURN jsonb_build_object('esito', 'dati_mancanti');
  END IF;

  -- 0. La chiave c'è già: la riga è già entrata (anche a tetto raggiunto).
  SELECT s.esito, s.lead_id INTO v_stato, v_lead
    FROM public.sheets_ingressi s
   WHERE s.chiave = p_chiave AND s.user_id = p_user_id;
  IF FOUND THEN
    RETURN jsonb_build_object('esito', 'gia_ricevuto', 'stato', v_stato, 'lead_id', v_lead);
  END IF;

  -- 0b. Il tetto del giorno (giorno di Roma), contato sotto un lucchetto per
  -- utente: due richieste insieme non passano entrambe sulla 300ª.
  PERFORM pg_advisory_xact_lock(hashtextextended('sheets-tetto|' || p_user_id::text, 0));
  SELECT count(*) INTO v_n
    FROM public.sheets_ingressi s
   WHERE s.user_id = p_user_id
     AND (s.ricevuto_il AT TIME ZONE 'Europe/Rome')::date = (now() AT TIME ZONE 'Europe/Rome')::date;
  IF v_n >= v_tetto THEN
    RETURN jsonb_build_object('esito', 'tetto');
  END IF;

  -- 1. Il registro: se due richieste uguali arrivano insieme, passa una sola.
  INSERT INTO public.sheets_ingressi (chiave, user_id, foglio, riga)
  VALUES (p_chiave, p_user_id, left(p_foglio, 100), p_riga)
  ON CONFLICT (chiave) DO NOTHING;
  IF NOT FOUND THEN
    SELECT s.esito, s.lead_id INTO v_stato, v_lead
      FROM public.sheets_ingressi s
     WHERE s.chiave = p_chiave AND s.user_id = p_user_id;
    RETURN jsonb_build_object('esito', 'gia_ricevuto', 'stato', v_stato, 'lead_id', v_lead);
  END IF;

  -- 2. Il lucchetto sul numero, fino alla fine della transazione. (Quello del
  -- tetto dura già fino alla fine e mette in fila tutte le righe dello stesso
  -- utente; questo resta perché dice cosa protegge, e se un giorno il tetto
  -- non serrasse più la fila il numero resta al sicuro.)
  IF coalesce(p_tel9, '') <> '' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('sheets|' || p_user_id::text || '|' || p_tel9, 0));
  END IF;

  -- 3. Lo stesso lead Meta è già su una scheda (anche caricata da file).
  IF coalesce(p_meta_id, '') <> '' THEN
    SELECT l.id INTO v_lead
      FROM public.crm_leads l
     WHERE l.user_id = p_user_id
       AND (l.data->>'metaLeadId' = p_meta_id OR l.data->'datiFile'->>'id' = p_meta_id)
     ORDER BY l.created_at, l.id
     LIMIT 1;
    IF FOUND THEN
      UPDATE public.sheets_ingressi
         SET esito = 'gia_presente', lead_id = v_lead, aggiornato_il = now()
       WHERE chiave = p_chiave;
      RETURN jsonb_build_object('esito', 'gia_presente', 'lead_id', v_lead);
    END IF;
  END IF;

  -- 4. Lo stesso numero: contatto di ritorno (la scheda più vecchia). È
  -- chiaveTelefono del CRM: solo cifre ([^0-9] come \D di JavaScript), almeno 6,
  -- le ultime 9.
  IF coalesce(p_tel9, '') <> '' THEN
    SELECT l.id INTO v_lead
      FROM public.crm_leads l
     WHERE l.user_id = p_user_id
       AND length(regexp_replace(coalesce(l.data->>'telefono', ''), '[^0-9]', '', 'g')) >= 6
       AND right(regexp_replace(coalesce(l.data->>'telefono', ''), '[^0-9]', '', 'g'), 9) = p_tel9
     ORDER BY l.created_at, l.id
     LIMIT 1;
    IF FOUND THEN
      UPDATE public.sheets_ingressi
         SET esito = 'ritorno_da_segnare', lead_id = v_lead, aggiornato_il = now()
       WHERE chiave = p_chiave;
      RETURN jsonb_build_object('esito', 'ritorno', 'lead_id', v_lead);
    END IF;
  END IF;

  -- 5. Una scheda nuova.
  INSERT INTO public.crm_leads (user_id, data)
  VALUES (p_user_id, p_data)
  RETURNING id INTO v_lead;
  UPDATE public.sheets_ingressi
     SET esito = 'nuovo', lead_id = v_lead, aggiornato_il = now()
   WHERE chiave = p_chiave;
  RETURN jsonb_build_object('esito', 'nuovo', 'lead_id', v_lead);
END $$;

-- ── 4. Il ritorno è stato segnato sulla scheda ───────────────────────────────
-- Solo «ritorno_da_segnare» diventa «ritorno». Vero se ha toccato la riga.
CREATE OR REPLACE FUNCTION public.sheets_ingresso_esito(p_user_id uuid, p_chiave text, p_esito text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF p_esito <> 'ritorno' THEN RETURN false; END IF;
  UPDATE public.sheets_ingressi
     SET esito = 'ritorno', aggiornato_il = now()
   WHERE chiave = p_chiave
     AND user_id = p_user_id
     AND esito = 'ritorno_da_segnare';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END $$;

-- ── 5. Solo il server le chiama ──────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.sheets_ingresso_scrivi(uuid, text, text, text, text, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sheets_ingresso_esito(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sheets_ingresso_scrivi(uuid, text, text, text, text, integer, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.sheets_ingresso_esito(uuid, text, text) TO service_role;

-- Il server le trova subito, senza aspettare che la cache dello schema si
-- rinnovi da sola.
NOTIFY pgrst, 'reload schema';
