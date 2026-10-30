-- ────────────────────────────────────────────────────────────────────────────
-- DIAGNOSI PER FONTE · messaggi in entrata visti da UNA SOLA fonte
-- Commessa 2026-10-30-messaggi-persi. SOLA LETTURA: solo SELECT, nessun dato di
-- cliente in uscita (né numeri, né nomi, né testi): solo conteggi e ore.
-- Si incolla nel SQL Editor di Supabase e si lancia così com'è. Si cambia solo
-- la finestra qui sotto (params).
--
-- Fonti: 'manychat' (wa_message_id mc-in:…), 'cloud' (canale vuoto), 'ponte' (canale baileys).
--  appaiata    = riga del ponte con duplicato_di (vista da due fonti)
--  solo_ponte  = entrata del ponte senza pari: ManyChat non l'ha mandata, o è un testo ripetuto
--                (colonna ripete_testo) scartato come eco/doppione da ecoDi
--  solo_altra  = entrata ManyChat/Cloud senza riga del ponte, DOPO la prima riga del ponte:
--                il ponte non l'ha vista, oppure è un'eco (colonna dopo_uscita_90s: un'uscita
--                dello studio nei 90 s prima)
-- ────────────────────────────────────────────────────────────────────────────
WITH params AS (
  SELECT timestamptz '2026-10-29 06:00+00' AS dal, timestamptz '2026-10-30 07:00+00' AS al
), base AS (
  SELECT w.id, w.user_id, w.created_at, w.direction, w.duplicato_di, w.media_type,
         CASE WHEN w.canale = 'baileys' THEN 'ponte'
              WHEN w.wa_message_id LIKE 'mc-in:%' OR w.canale = 'manychat' THEN 'manychat'
              ELSE 'cloud' END AS fonte,
         regexp_replace(CASE WHEN w.direction = 'inbound' THEN w.from_number ELSE w.to_number END, '\D', '', 'g') AS numero,
         left(btrim(regexp_replace(lower(coalesce(w.body, '')), '\s+', ' ', 'g')), 1000) AS norma
    FROM public.whatsapp_messages w, params p
   WHERE w.created_at BETWEEN p.dal - interval '7 days' AND p.al
), ponte_dal AS (
  SELECT user_id, min(created_at) AS da FROM base WHERE fonte = 'ponte' GROUP BY user_id
), entrate AS (
  SELECT b.*,
         EXISTS (SELECT 1 FROM base x WHERE x.direction = 'inbound' AND x.user_id = b.user_id AND x.numero = b.numero
                    AND x.id <> b.id AND x.norma <> '' AND x.norma = b.norma AND x.created_at < b.created_at AND x.duplicato_di IS NULL) AS ripete_testo,
         EXISTS (SELECT 1 FROM base u WHERE u.direction = 'outbound' AND u.user_id = b.user_id AND u.numero = b.numero
                    AND u.created_at BETWEEN b.created_at - interval '90 seconds' AND b.created_at) AS dopo_uscita_90s,
         (SELECT extract(epoch FROM b.created_at - max(u.created_at)) / 3600 FROM base u
           WHERE u.direction = 'outbound' AND u.user_id = b.user_id AND u.numero = b.numero AND u.created_at < b.created_at) AS ore_da_uscita,
         EXISTS (SELECT 1 FROM base q WHERE q.duplicato_di = b.id) AS ha_pari_del_ponte
    FROM base b, params p
   WHERE b.direction = 'inbound' AND b.created_at BETWEEN p.dal AND p.al
), classi AS (
  SELECT e.*,
         CASE WHEN e.fonte = 'ponte' AND e.duplicato_di IS NOT NULL THEN 'appaiata'
              WHEN e.fonte = 'ponte' THEN 'solo_ponte'
              WHEN e.duplicato_di IS NULL AND NOT e.ha_pari_del_ponte AND e.created_at >= coalesce(pd.da, 'infinity') THEN 'solo_altra'
              ELSE 'appaiata' END AS classe
    FROM entrate e LEFT JOIN ponte_dal pd USING (user_id)
   WHERE e.duplicato_di IS NULL OR e.fonte = 'ponte'
)
-- RISULTATI · 1. Quante entrate per classe, e quante hanno il segno dell'eco o della ripetizione.
SELECT classe, fonte, count(*) AS entrate,
       count(*) FILTER (WHERE ripete_testo) AS ripete_testo,
       count(*) FILTER (WHERE dopo_uscita_90s) AS dopo_uscita_90s,
       count(*) FILTER (WHERE media_type IS NOT NULL) AS con_media
  FROM classi
 GROUP BY classe, fonte
 ORDER BY classe, fonte;

-- 2. Per ora (UTC) e classe: dove cadono i buchi (rilanciate la parte WITH con questa SELECT).
-- SELECT date_trunc('hour', created_at) AS ora_utc, classe, count(*) FROM classi
--  WHERE classe <> 'appaiata' GROUP BY 1, 2 ORDER BY 1, 2;

-- 3. Dopo quante ore dall'ultima uscita dello studio cade una entrata «solo ponte»:
--    se ManyChat tace per ore dopo una nostra risposta, è la pausa dell'automazione (Live Chat).
-- SELECT CASE WHEN ore_da_uscita IS NULL THEN 'nessuna uscita' WHEN ore_da_uscita < 1 THEN '< 1 h'
--             WHEN ore_da_uscita < 6 THEN '1-6 h' WHEN ore_da_uscita < 24 THEN '6-24 h' ELSE '> 24 h' END AS fascia,
--        count(*) FROM classi WHERE classe = 'solo_ponte' GROUP BY 1 ORDER BY 1;

-- 4. Lo stato del ponte (ultimo battito): contatori di lettura e di scarto.
-- SELECT stato, ultimo_messaggio_il, aggiornato_il, contatori FROM public.ponte_wa_stato;
