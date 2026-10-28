-- ─────────────────────────────────────────────────────────────────────────────
-- WHATSAPP CON MANYCHAT · DOPO IL PRIMO MESSAGGIO LA SCHEDA PASSA AD «ATTESA WHATSAPP»
--
-- Commessa 2026-10-28 (wa-stato-dopo-primo). Il titolare: «quando viene contattato su
-- WhatsApp da ManyChat, manda il messaggio, cambia lo stato… non sta più da contattare».
-- Quando il giro INVIA (esito «inviato») un primo contatto o un ritorno a una scheda
-- ancora «da contattare», la scheda diventa «attesa_whatsapp» (etichetta «Attesa WhatsApp»).
--
-- COSA AGGIUNGE (una funzione nuova, niente tabelle né colonne)
--   · lead_attesa_whatsapp(p_user_id, p_id, p_il) — scrive SOLO `data.stato`,
--     `data.statoDal` (= l'ora dell'invio) e, come fa il CRM a ogni cambio di stato,
--     `data.statoPrecedente` e `data.statoPrecedenteIl` («da dove veniva», serve al tasto
--     «torna indietro»). Il resto di `data` non si tocca: mai riscriverlo tutto da JS.
--
-- LA GUARDIA È DENTRO LA SCRITTURA: l'UPDATE vale solo se `data->>'stato'` è ANCORA
-- 'da_contattare' (nello stesso WHERE, sotto il lucchetto della riga). Se nel frattempo un
-- consulente ha cambiato stato, non si tocca niente e la funzione risponde falso.
-- Vero se ha scritto; falso se la scheda non c'è, è di un'altra installazione o non è
-- più «da contattare».
--
-- ⚠️ SECURITY DEFINER, `user_id` nel WHERE, solo service_role (come `contatto_wa_aggiorna`).
-- ⚠️ ORDINE: dopo 20261023120100_manychat_giro.sql. Va applicata a mano dal titolare. Il
--    codice pubblicato funziona anche SENZA questa migrazione: il giro manda i messaggi
--    come prima, lo stato non cambia, e nei log compare un solo avviso per processo.
-- ⚠️ Applicarla due volte non fa danni (CREATE OR REPLACE). Non cancella né riscrive dati.
-- ⚠️ Le schede GIÀ contattate prima di questa migrazione non cambiano da sole: le porta
--    `supabase/recuperi/20261028_attesa_whatsapp_gia_contattati.sql` (una volta, a parte).
--
-- COME SI ANNULLA (solo se serve davvero; le schede già passate restano «Attesa WhatsApp»):
--   DROP FUNCTION public.lead_attesa_whatsapp(uuid, uuid, timestamptz);
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.lead_attesa_whatsapp(
  p_user_id uuid,
  p_id uuid,
  p_il timestamptz
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  -- la stessa forma di data del CRM (`toISOString()`): 2026-10-28T09:30:00.000Z
  v_il text := to_char(coalesce(p_il, now()) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
BEGIN
  IF p_user_id IS NULL OR p_id IS NULL THEN RETURN false; END IF;

  -- La condizione «ancora da_contattare» sta nello stesso UPDATE: se un collega cambia
  -- lo stato nello stesso istante, Postgres rilegge la riga sotto il lucchetto e il
  -- WHERE non è più vero (nessuna riga toccata, FOUND falso).
  UPDATE public.crm_leads
     SET data = jsonb_set(
                  jsonb_set(
                    jsonb_set(
                      jsonb_set(coalesce(data, '{}'::jsonb), '{stato}', to_jsonb('attesa_whatsapp'::text), true),
                      '{statoDal}', to_jsonb(v_il), true),
                    '{statoPrecedente}', to_jsonb('da_contattare'::text), true),
                  '{statoPrecedenteIl}', to_jsonb(v_il), true)
   WHERE id = p_id
     AND user_id = p_user_id
     AND data->>'stato' = 'da_contattare';
  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.lead_attesa_whatsapp(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lead_attesa_whatsapp(uuid, uuid, timestamptz) TO service_role;
