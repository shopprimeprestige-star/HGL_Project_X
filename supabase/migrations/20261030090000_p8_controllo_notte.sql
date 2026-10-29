-- ─────────────────────────────────────────────────────────────────────────────
-- IL CONTROLLO DELLA NOTTE DEL GIRO WHATSAPP E LA PULIZIA DELLE ECO (30/10/2026)
--
-- Commessa 2026-10-30-ottimizzazioni, pacchetto p8, punti (20) e (9).
-- Ogni mattina alle 05:00 UTC (06:00 a Roma d'inverno, 07:00 d'estate) il cron
-- chiama /hooks/controllo-notte: la rotta pulisce eco e doppioni recenti con
-- la funzione qui sotto, legge come è andato il giro (invii falliti, ponte,
-- ManyChat, finestra di 24 ore) e lascia al titolare una notifica nel CRM (e
-- una push se c'è qualcosa da guardare). Il lunedì guarda la settimana.
--
-- COSA AGGIUNGE (solo aggiunte)
--   · wa_pulizia_registro — una riga per ogni messaggio segnato dalla pulizia
--     automatica: serve a sapere chi l'ha segnato e ad annullare.
--   · wa_segna_eco_doppioni(p_user_id, p_dal) — la pulizia, con la regola già
--     provata in commesse/2026-10-29-ponte-whatsapp-baileys/
--     ECO-MANYCHAT-pulizia-PROPOSTA.sql, ma:
--       - SOLO le righe arrivate da p_dal (la rotta passa 48 ore, o 8 giorni il
--         lunedì): lo storico vecchio resta alla proposta, che lancia il
--         titolare a mano dopo aver letto l'elenco;
--       - una riga alla volta: se il ponte prende lo stesso bersaglio nello
--         stesso momento (unique_violation dell'indice idx_wa_messages_duplicato)
--         quella riga resta visibile e si conta in «persi», le altre vanno.
--     NON CANCELLA NIENTE: scrive solo duplicato_di (la chat nasconde la riga).
--     Non ricalcola whatsapp_contacts e non tocca manychat_invii.
--   · il cron «controllo-notte-whatsapp» (programma_hook_cron, come gli altri).
--
-- ⚠️ CHI PUÒ CHIAMARLA: si fida di p_user_id, quindi SOLO il server (REVOKE da
--    PUBLIC, anon e authenticated; GRANT a service_role). Il registro non ha
--    politiche RLS: dal browser non si legge né si scrive.
-- ⚠️ ORDINE: dopo 20261029120000_ponte_whatsapp.sql (duplicato_di e il suo
--    indice unico) e 20261023120000_manychat_base.sql (canale).
-- ⚠️ Applicarla due volte non fa danni (IF NOT EXISTS, OR REPLACE; il cron con
--    lo stesso nome si riprogramma).
-- ⚠️ NON la lancia la squadra: la applica il capo progetto con l'OK del
--    titolare. Collaudo su un Postgres di prova: prove/sql/controllo-notte.sql.
--
-- COME SI SPEGNE (il controllo e la pulizia insieme):
--   SELECT cron.unschedule('controllo-notte-whatsapp');
-- COME SI ANNULLA UNA PULIZIA (es. quella di stamattina): rimette visibili
-- SOLO le righe segnate da qui, il resto (ponte, proposta manuale) non cambia:
--   UPDATE public.whatsapp_messages w SET duplicato_di = NULL
--     FROM public.wa_pulizia_registro r
--    WHERE r.messaggio_id = w.id AND w.duplicato_di = r.verso
--      AND r.segnato_il >= '2026-10-31';
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Il registro dei segni ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wa_pulizia_registro (
  id           bigserial PRIMARY KEY,
  user_id      uuid NOT NULL,
  messaggio_id uuid NOT NULL,
  verso        uuid NOT NULL,
  tipo         text NOT NULL CHECK (tipo IN ('eco', 'doppione')),
  segnato_il   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wa_pulizia_registro_segnato_il_idx
  ON public.wa_pulizia_registro (segnato_il);

ALTER TABLE public.wa_pulizia_registro ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.wa_pulizia_registro FROM anon, authenticated;

-- ── 2. La pulizia ────────────────────────────────────────────────────────────
-- Un'eco/doppione è una riga ManyChat in entrata («mc-in:…») con lo stesso
-- testo ripulito (come normalizzaTesto di src/crm/ponte/pari.ts: NFKC,
-- minuscole, senza caratteri invisibili, spazi uniti, 1000 caratteri) della
-- riga in entrata subito prima dello stesso numero (ManyChat o Cloud, non del
-- ponte, non già doppione, non media). «eco» se arriva 60 secondi o più dopo
-- l'inizio della serie uguale, «doppione» se prima: la stessa regola di ecoDi
-- (src/crm/manychat/risposta.ts), che dal 29/10 le scarta già all'ingresso.
-- Il bersaglio: la riga prima, se nessuno la punta già; se la punta già la
-- riga del ponte, quella riga del ponte (se libera); altrimenti niente.
CREATE OR REPLACE FUNCTION public.wa_segna_eco_doppioni(p_user_id uuid, p_dal timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r           record;
  v_verso     uuid;
  v_n         int;
  v_eco       int := 0;
  v_doppione  int := 0;
  v_senza     int := 0;
  v_persi     int := 0;
BEGIN
  IF p_user_id IS NULL OR p_dal IS NULL THEN
    RETURN jsonb_build_object('eco', 0, 'doppione', 0, 'senza_bersaglio', 0, 'persi', 0);
  END IF;

  FOR r IN
    WITH recenti AS (
      -- solo i numeri con una riga ManyChat nel periodo: non si rilegge tutto
      SELECT DISTINCT regexp_replace(n.from_number, '\D', '', 'g') AS numero
        FROM public.whatsapp_messages n
       WHERE n.user_id = p_user_id
         AND n.direction = 'inbound'
         AND n.created_at >= p_dal
         AND n.wa_message_id LIKE 'mc-in:%'
         AND n.duplicato_di IS NULL
    ), testi AS (
      SELECT w.id, w.wa_message_id, w.created_at,
             regexp_replace(w.from_number, '\D', '', 'g') AS numero,
             left(btrim(regexp_replace(lower(regexp_replace(normalize(coalesce(w.body, ''), NFKC),
                  '[\u200B-\u200D\uFEFF\u2060]', '', 'g')), '\s+', ' ', 'g')), 1000) AS norma
        FROM public.whatsapp_messages w
       WHERE w.user_id = p_user_id
         AND w.direction = 'inbound'
         AND w.canale IS DISTINCT FROM 'baileys'
         AND w.duplicato_di IS NULL
         AND w.media_type IS NULL
         AND btrim(coalesce(w.body, '')) NOT IN ('', '[messaggio senza testo]')
         AND w.body NOT LIKE '%manybot-files%'
         AND w.body !~ '^\s*(\{\{[^}]*\}\}\s*)+$'
         AND regexp_replace(w.from_number, '\D', '', 'g') IN (SELECT numero FROM recenti)
    ), in_fila AS (
      SELECT t.*, lag(t.id) OVER w AS prima_id, lag(t.norma) OVER w AS prima_norma
        FROM testi t
      WINDOW w AS (PARTITION BY t.numero ORDER BY t.created_at, t.id)
    ), corse AS (
      SELECT f.*, sum(CASE WHEN f.norma = f.prima_norma THEN 0 ELSE 1 END) OVER w AS corsa
        FROM in_fila f
      WINDOW w AS (PARTITION BY f.numero ORDER BY f.created_at, f.id)
    ), doppie AS (
      SELECT f.*,
             CASE WHEN f.created_at - min(f.created_at) OVER (PARTITION BY f.numero, f.corsa)
                       >= interval '60 seconds' THEN 'eco' ELSE 'doppione' END AS tipo
        FROM corse f
    )
    SELECT f.id, f.prima_id, f.tipo
      FROM doppie f
     WHERE f.wa_message_id LIKE 'mc-in:%'
       AND f.created_at >= p_dal
       AND f.prima_id IS NOT NULL
       AND f.norma <> ''
       AND f.norma = f.prima_norma
     ORDER BY f.created_at, f.id
  LOOP
    -- In ordine di tempo: la seconda eco di una serie trova la prima già segnata
    -- e si lega a lei (catena), perché l'indice vuole un solo «pari» per riga.
    IF NOT EXISTS (SELECT 1 FROM public.whatsapp_messages x WHERE x.duplicato_di = r.prima_id) THEN
      v_verso := r.prima_id;
    ELSE
      SELECT x.id INTO v_verso
        FROM public.whatsapp_messages x
       WHERE x.duplicato_di = r.prima_id
         AND NOT EXISTS (SELECT 1 FROM public.whatsapp_messages y WHERE y.duplicato_di = x.id)
       ORDER BY x.created_at, x.id
       LIMIT 1;
    END IF;

    IF v_verso IS NULL THEN
      v_senza := v_senza + 1;
      CONTINUE;
    END IF;

    BEGIN
      UPDATE public.whatsapp_messages SET duplicato_di = v_verso WHERE id = r.id AND duplicato_di IS NULL;
      GET DIAGNOSTICS v_n = ROW_COUNT;
      IF v_n = 1 THEN
        INSERT INTO public.wa_pulizia_registro (user_id, messaggio_id, verso, tipo)
        VALUES (p_user_id, r.id, v_verso, r.tipo);
        IF r.tipo = 'eco' THEN v_eco := v_eco + 1; ELSE v_doppione := v_doppione + 1; END IF;
      END IF;
    EXCEPTION WHEN unique_violation THEN
      v_persi := v_persi + 1;
    END;
  END LOOP;

  RETURN jsonb_build_object('eco', v_eco, 'doppione', v_doppione, 'senza_bersaglio', v_senza, 'persi', v_persi);
END
$$;

REVOKE ALL ON FUNCTION public.wa_segna_eco_doppioni(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_segna_eco_doppioni(uuid, timestamptz) TO service_role;

-- ── 3. Il cron, ogni mattina ─────────────────────────────────────────────────
SELECT public.programma_hook_cron('controllo-notte-whatsapp', '0 5 * * *', '/hooks/controllo-notte');
