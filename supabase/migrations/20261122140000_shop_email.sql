-- ─────────────────────────────────────────────────────────────────────────────
-- SHOP R2 · S6 · I MODELLI DELLE EMAIL DELLO SHOP (TUTTI SPENTI)
--
-- Commessa 2026-11-20-shop-completo, Rilascio 2 (T43, decisione D53). La applica il TITOLARE, a mano,
-- dal SQL Editor di Supabase, DOPO S4 (quella che porta la colonna `email_inviate` degli ordini).
-- Ordine: M1 → S1/S2/D40/S3 (R1) → S4 → S4b → S5 → S6. La squadra non la lancia mai e non usa
-- «supabase db push». Si può applicare prima o dopo la pubblicazione del codice: da sola non cambia
-- nessun comportamento, perché nessun messaggio nasce acceso.
--
-- COSA FA
--   1. Controlla che S1 (registro `shop_storico`) e S4 (colonna `email_inviate`) ci siano: se no si
--      ferma con un messaggio chiaro, senza scrivere niente.
--   2. Crea la tabella `shop_email_modelli`: un modello per messaggio (conferma_ordine, spedito,
--      pagamento_non_riuscito, rimborso, annullato) con oggetto, testo, interruttore `acceso` e
--      l'approvazione (chi, quando, impronta del testo approvato).
--   3. Inserisce le CINQUE righe di partenza: tutte SPENTE, senza approvazione, con il segnaposto
--      `{{da confermare}}` nell'oggetto e nel testo e la firma «Hair Genius Labs». I testi veri li
--      scrive e li approva il titolare dal CRM. Nei testi non c'è nessun indirizzo dello studio.
--   4. Crea cinque funzioni (le esegue solo il server, con la chiave di servizio):
--        shop_email_modello_salva    salva il testo (solo se il testo visto è ancora quello attuale);
--                                    SPEGNE il messaggio e TOGLIE l'approvazione;
--        shop_email_modello_approva  approva il testo che chi approva ha visto (si confronta l'impronta);
--        shop_email_modello_acceso   accende o spegne; per ACCENDERE il database pretende un testo
--                                    approvato e senza `{{`, anche se il server sbagliasse;
--        shop_email_prenota          «prenota» l'invio di un messaggio per un ordine: vera una sola volta
--                                    (non se è già inviato, né se un invio è in corso da meno di 5 minuti);
--        shop_email_esito            scrive com'è finito l'invio (inviata o errore, con un codice).
--      Ogni modifica ai testi e agli interruttori lascia una riga nel registro `shop_storico`
--      (entita = 'email'); l'esito di un invio una riga con l'id dell'ordine, senza dati del cliente.
--
-- COSA NON FA
--   Non accende niente, non invia niente, non scrive in nessuna tabella che esiste già (le email
--   inviate le scrivono, più avanti, solo le funzioni prenota/esito, solo nella colonna `email_inviate`).
--   Non cancella niente. La tabella è chiusa: nessuna policy, e nemmeno la chiave di servizio la scrive
--   direttamente (può solo leggerla); si scrive solo con le funzioni sopra.
--
-- RILANCIARLA NON FA DANNI: tabella e funzioni con IF NOT EXISTS / OR REPLACE, il seme con
-- ON CONFLICT DO NOTHING (un testo già salvato non viene riscritto).
--
-- COME SI ANNULLA: non serve. Con tutti i messaggi spenti non parte nessuna email; per fermarne uno
-- basta spegnerlo dal CRM. La tabella resta, innocua, e può restare.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. Controllo iniziale ─────────────────────────────────────────────────────
DO $$
BEGIN
  IF to_regclass('public.shop_storico') IS NULL THEN
    RAISE EXCEPTION 'S6 non applicata: manca il registro shop_storico (S1, 20261120120000_shop_catalogo.sql). Applica prima S1.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'shop_orders' AND column_name = 'email_inviate'
  ) THEN
    RAISE EXCEPTION 'S6 non applicata: manca la colonna shop_orders.email_inviate (S4, 20261122120000_shop_pagamenti.sql). Applica prima S4.';
  END IF;
END
$$;

-- ── 1. La tabella ─────────────────────────────────────────────────────────────
-- Il CHECK finale è la rete del database: un modello può essere ACCESO solo se è approvato SUL TESTO
-- ATTUALE (stessa impronta: sha256 di «oggetto, a capo, testo») e se non ha nessun `{{` rimasto.
CREATE TABLE IF NOT EXISTS public.shop_email_modelli (
  chiave         text PRIMARY KEY CHECK (chiave IN ('conferma_ordine', 'spedito', 'pagamento_non_riuscito', 'rimborso', 'annullato')),
  oggetto        text NOT NULL DEFAULT '',
  testo          text NOT NULL DEFAULT '',
  acceso         boolean NOT NULL DEFAULT false,
  approvato_da   text,
  approvato_il   timestamptz,
  approvato_hash text,
  aggiornato_il  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_email_modelli_acceso_ok CHECK (
    NOT acceso OR (
      approvato_hash = encode(sha256(convert_to(oggetto || E'\n' || testo, 'UTF8')), 'hex')
      AND position('{{' IN oggetto) = 0
      AND position('{{' IN testo) = 0
    )
  )
);

-- Tutto chiuso: la tabella la legge il server (service_role) e la scrivono solo le funzioni.
ALTER TABLE public.shop_email_modelli ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shop_email_modelli FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.shop_email_modelli FROM service_role;
GRANT SELECT ON TABLE public.shop_email_modelli TO service_role;

-- ── 2. Le cinque righe di partenza (spente, da confermare) ───────────────────
INSERT INTO public.shop_email_modelli (chiave, oggetto, testo) VALUES
  ('conferma_ordine',
   '{{da confermare}} Conferma del tuo ordine',
   E'{{da confermare}}\n\nQui va il testo della conferma d''ordine: lo scrive e lo approva il titolare dal CRM.\n\nHair Genius Labs'),
  ('spedito',
   '{{da confermare}} Il tuo ordine è in viaggio',
   E'{{da confermare}}\n\nQui va il testo dell''avviso di spedizione: lo scrive e lo approva il titolare dal CRM.\n\nHair Genius Labs'),
  ('pagamento_non_riuscito',
   '{{da confermare}} Il pagamento non è andato a buon fine',
   E'{{da confermare}}\n\nQui va il testo per il pagamento non riuscito: lo scrive e lo approva il titolare dal CRM.\n\nHair Genius Labs'),
  ('rimborso',
   '{{da confermare}} Abbiamo rimborsato il tuo ordine',
   E'{{da confermare}}\n\nQui va il testo del rimborso: lo scrive e lo approva il titolare dal CRM.\n\nHair Genius Labs'),
  ('annullato',
   '{{da confermare}} Il tuo ordine è stato annullato',
   E'{{da confermare}}\n\nQui va il testo dell''annullo: lo scrive e lo approva il titolare dal CRM.\n\nHair Genius Labs')
ON CONFLICT (chiave) DO NOTHING;

-- ── 3. Salvare un testo ───────────────────────────────────────────────────────
-- Vero se ha scritto; falso se il testo nel frattempo è cambiato (p_atteso è l'«aggiornato_il» che chi
-- salva aveva visto) o se p_atteso manca. Salvare spegne il messaggio e toglie l'approvazione.
CREATE OR REPLACE FUNCTION public.shop_email_modello_salva(
  p_chiave  text,
  p_atteso  timestamptz,
  p_oggetto text,
  p_testo   text,
  p_chi     text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_riga public.shop_email_modelli%ROWTYPE;
  v_chi  text := left(COALESCE(NULLIF(btrim(p_chi), ''), 'sconosciuto'), 80);
BEGIN
  SELECT * INTO v_riga FROM public.shop_email_modelli WHERE chiave = p_chiave FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'modello_non_trovato' USING ERRCODE = 'no_data_found';
  END IF;
  IF p_atteso IS NULL OR v_riga.aggiornato_il IS DISTINCT FROM p_atteso THEN
    RETURN false;
  END IF;

  UPDATE public.shop_email_modelli
     SET oggetto = COALESCE(p_oggetto, ''), testo = COALESCE(p_testo, ''), acceso = false,
         approvato_da = NULL, approvato_il = NULL, approvato_hash = NULL, aggiornato_il = now()
   WHERE chiave = p_chiave;

  INSERT INTO public.shop_storico (entita, entita_id, campo, prima, dopo, chi)
  VALUES ('email', p_chiave, 'testo',
          jsonb_build_object('oggetto', v_riga.oggetto, 'testo', v_riga.testo, 'acceso', v_riga.acceso),
          jsonb_build_object('oggetto', COALESCE(p_oggetto, ''), 'testo', COALESCE(p_testo, ''), 'acceso', false),
          v_chi);
  RETURN true;
END
$$;

-- ── 4. Approvare il testo che si è visto ──────────────────────────────────────
-- p_impronta = sha256 esadecimale di «oggetto, a capo, testo» come li ha letti chi approva. Se nel
-- frattempo il testo è cambiato l'impronta non torna e non si approva niente (falso).
CREATE OR REPLACE FUNCTION public.shop_email_modello_approva(
  p_chiave    text,
  p_impronta  text,
  p_chi       text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_impronta text;
  v_chi      text := left(COALESCE(NULLIF(btrim(p_chi), ''), 'sconosciuto'), 80);
BEGIN
  SELECT encode(sha256(convert_to(oggetto || E'\n' || testo, 'UTF8')), 'hex') INTO v_impronta
    FROM public.shop_email_modelli WHERE chiave = p_chiave FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'modello_non_trovato' USING ERRCODE = 'no_data_found';
  END IF;
  IF p_impronta IS DISTINCT FROM v_impronta THEN
    RETURN false;
  END IF;

  UPDATE public.shop_email_modelli
     SET approvato_da = v_chi, approvato_il = now(), approvato_hash = v_impronta, aggiornato_il = now()
   WHERE chiave = p_chiave;

  INSERT INTO public.shop_storico (entita, entita_id, campo, prima, dopo, chi)
  VALUES ('email', p_chiave, 'approvato', NULL, jsonb_build_object('hash', v_impronta), v_chi);
  RETURN true;
END
$$;

-- ── 5. Accendere e spegnere ───────────────────────────────────────────────────
-- Spegnere si può sempre. Accendere: il DATABASE rifiuta se il testo non è approvato (impronta uguale a
-- quella di oggi) o se oggetto o testo hanno ancora un `{{` (anche se approvati). Vero se è cambiato.
CREATE OR REPLACE FUNCTION public.shop_email_modello_acceso(
  p_chiave  text,
  p_acceso  boolean,
  p_chi     text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_riga     public.shop_email_modelli%ROWTYPE;
  v_nuovo    boolean := COALESCE(p_acceso, false);
  v_impronta text;
  v_chi      text := left(COALESCE(NULLIF(btrim(p_chi), ''), 'sconosciuto'), 80);
BEGIN
  SELECT * INTO v_riga FROM public.shop_email_modelli WHERE chiave = p_chiave FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'modello_non_trovato' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_nuovo THEN
    v_impronta := encode(sha256(convert_to(v_riga.oggetto || E'\n' || v_riga.testo, 'UTF8')), 'hex');
    IF v_riga.approvato_hash IS NULL OR v_riga.approvato_hash <> v_impronta THEN
      RAISE EXCEPTION 'modello_non_approvato' USING ERRCODE = 'object_not_in_prerequisite_state';
    END IF;
    IF position('{{' IN v_riga.oggetto) > 0 OR position('{{' IN v_riga.testo) > 0 THEN
      RAISE EXCEPTION 'modello_con_segnaposto' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF v_riga.acceso = v_nuovo THEN
    RETURN false;
  END IF;

  UPDATE public.shop_email_modelli SET acceso = v_nuovo, aggiornato_il = now() WHERE chiave = p_chiave;

  INSERT INTO public.shop_storico (entita, entita_id, campo, prima, dopo, chi)
  VALUES ('email', p_chiave, 'acceso', to_jsonb(NOT v_nuovo), to_jsonb(v_nuovo), v_chi);
  RETURN true;
END
$$;

-- ── 6. Prenotare l'invio (una volta sola per ordine e messaggio) ─────────────
-- Vera solo se quel messaggio per quell'ordine NON è già `inviata` e NON è `in_invio` da meno di 5 minuti
-- (oltre, si presume un invio caduto a metà e si riprenota). Dopo `errore` si può riprenotare. Blocca la riga
-- dell'ordine: due chiamate insieme non possono essere vere tutte e due.
CREATE OR REPLACE FUNCTION public.shop_email_prenota(
  p_ordine  uuid,
  p_chiave  text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inviate jsonb;
  v_stato   text;
  v_il      timestamptz;
BEGIN
  IF p_chiave IS NULL OR btrim(p_chiave) = '' THEN
    RAISE EXCEPTION 'parametro_non_valido' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT CASE WHEN jsonb_typeof(email_inviate) = 'object' THEN email_inviate ELSE '{}'::jsonb END INTO v_inviate
    FROM public.shop_orders WHERE id = p_ordine FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ordine_non_trovato' USING ERRCODE = 'no_data_found';
  END IF;

  v_stato := v_inviate #>> ARRAY[p_chiave, 'stato'];
  v_il    := (v_inviate #>> ARRAY[p_chiave, 'il'])::timestamptz;
  IF v_stato = 'inviata' THEN
    RETURN false;
  END IF;
  IF v_stato = 'in_invio' AND v_il IS NOT NULL AND now() - v_il < interval '5 minutes' THEN
    RETURN false;
  END IF;

  UPDATE public.shop_orders
     SET email_inviate = v_inviate || jsonb_build_object(p_chiave, jsonb_build_object('stato', 'in_invio', 'il', now(), 'codice', NULL)),
         aggiornato_il = now()
   WHERE id = p_ordine;
  RETURN true;
END
$$;

-- ── 7. L'esito dell'invio ─────────────────────────────────────────────────────
-- p_stato: `inviata` oppure `errore` (p_codice = il codice dell'errore del servizio di posta, mai il messaggio).
CREATE OR REPLACE FUNCTION public.shop_email_esito(
  p_ordine  uuid,
  p_chiave  text,
  p_stato   text,
  p_codice  text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inviate jsonb;
  v_codice  text := left(NULLIF(btrim(p_codice), ''), 80);
BEGIN
  SELECT CASE WHEN jsonb_typeof(email_inviate) = 'object' THEN email_inviate ELSE '{}'::jsonb END INTO v_inviate
    FROM public.shop_orders WHERE id = p_ordine FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ordine_non_trovato' USING ERRCODE = 'no_data_found';
  END IF;
  IF p_chiave IS NULL OR btrim(p_chiave) = '' THEN
    RAISE EXCEPTION 'parametro_non_valido' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_stato IS NULL OR p_stato NOT IN ('inviata', 'errore') THEN
    RAISE EXCEPTION 'email_stato_non_valido' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.shop_orders
     SET email_inviate = v_inviate || jsonb_build_object(p_chiave, jsonb_build_object('stato', p_stato, 'il', now(), 'codice', v_codice)),
         aggiornato_il = now()
   WHERE id = p_ordine;

  INSERT INTO public.shop_storico (entita, entita_id, campo, prima, dopo, chi)
  VALUES ('email', p_ordine::text, p_chiave, NULL, jsonb_build_object('stato', p_stato, 'codice', v_codice), 'sistema');
  RETURN true;
END
$$;

-- ── 8. Permessi: le funzioni le esegue solo il server ────────────────────────
REVOKE ALL ON FUNCTION public.shop_email_modello_salva(text, timestamptz, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_email_modello_approva(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_email_modello_acceso(text, boolean, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_email_prenota(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_email_esito(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_email_modello_salva(text, timestamptz, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_email_modello_approva(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_email_modello_acceso(text, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_email_prenota(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_email_esito(uuid, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
