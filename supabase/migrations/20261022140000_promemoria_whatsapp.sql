-- ─────────────────────────────────────────────────────────────────────────────
-- LA CONFERMA AUTOMATICA DELLA CONSULENZA SU WHATSAPP («Rispondi SÌ»)
--
-- Commessa 2026-10-22. Un messaggio solo, subito dopo la prenotazione, con
-- giorno, ora, link e «risponda SÌ per confermare». Lo manda il cron
-- (/hooks/promemoria-whatsapp), lo legge il webhook di WhatsApp.
--
-- COSA AGGIUNGE (solo aggiunte: nessuna tabella nuova, niente che cancelli)
--   · whatsapp_contacts.non_scrivere_dal — chi ha scritto STOP, per NUMERO.
--   · promemoria_aggancia — mette il segno sulla scheda PRIMA dell'invio, e
--     solo se per quell'appuntamento non c'è già: due giri insieme, uno solo
--     vince. È il vincolo «mai due messaggi uguali».
--   · promemoria_aggiorna — fonde un pezzo nel segno (inviato, confermato…),
--     se la scheda è ancora su quell'appuntamento.
--   Le due funzioni toccano SOLO data.promemoria, in un solo UPDATE: il resto
--   della scheda (che il browser può star scrivendo) non si tocca.
--
-- ⚠️ SOLO LA CHIAVE DI SERVIZIO del server le chiama (REVOKE da anon e
--    authenticated): dal browser non si può segnare «confermato» a nessuno.
-- ⚠️ ORDINE: questa per prima; la riga del cron
--    (20261022140100_promemoria_whatsapp_cron.sql) per ultima.
-- ⚠️ Il codice pubblicato funziona anche SENZA questa migrazione: il cron non
--    invia niente e dice «manca l'aggiornamento del database», il webhook fa
--    quello che faceva prima.
--
-- COME SI ANNULLA (solo se serve davvero; prima spegnere il cron):
--   DROP FUNCTION public.promemoria_aggancia(uuid, text, jsonb);
--   DROP FUNCTION public.promemoria_aggiorna(uuid, jsonb, text);
--   ALTER TABLE public.whatsapp_contacts DROP COLUMN non_scrivere_dal;
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS non_scrivere_dal timestamptz;

-- Mette il segno. true = l'hai preso tu; false = c'era già (un altro giro).
-- Il segno «c'è» se la chiave è la stessa E lo stato non è vuoto: con lo
-- stato vuoto il segno è stato tolto dopo un errore tecnico, e si riprova.
CREATE OR REPLACE FUNCTION public.promemoria_aggancia(p_id uuid, p_chiave text, p_patch jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE public.crm_leads
     SET data = jsonb_set(data, '{promemoria}',
           coalesce(data->'promemoria', '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)
           || jsonb_build_object('chiave', p_chiave), true)
   WHERE id = p_id
     AND NOT (coalesce(data->'promemoria'->>'chiave', '') = coalesce(p_chiave, '')
     AND coalesce(data->'promemoria'->>'stato', '') <> '');
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END $$;

-- Fonde un pezzo nel segno. Con p_se_chiave, solo se la scheda è ancora su
-- quell'appuntamento (spostato nel frattempo = non si scrive).
CREATE OR REPLACE FUNCTION public.promemoria_aggiorna(p_id uuid, p_patch jsonb, p_se_chiave text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  UPDATE public.crm_leads
     SET data = jsonb_set(data, '{promemoria}',
           coalesce(data->'promemoria', '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb), true)
   WHERE id = p_id
     AND (p_se_chiave IS NULL OR data->'promemoria'->>'chiave' = p_se_chiave);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n = 1;
END $$;

REVOKE ALL ON FUNCTION public.promemoria_aggancia(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.promemoria_aggiorna(uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promemoria_aggancia(uuid, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.promemoria_aggiorna(uuid, jsonb, text) TO service_role;

-- Il server le trova subito, senza aspettare che la cache dello schema si
-- rinnovi da sola.
NOTIFY pgrst, 'reload schema';
