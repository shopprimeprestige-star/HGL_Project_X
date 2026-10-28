-- ─────────────────────────────────────────────────────────────────────────────
-- RECUPERO UNA TANTUM · I GIÀ CONTATTATI PASSANO AD «ATTESA WHATSAPP» (28/10/2026)
--
-- Commessa 2026-10-28 (wa-stato-dopo-primo). «Ordina anche questo»: le schede ancora «da
-- contattare» a cui ManyChat ha GIÀ mandato un primo contatto o un ritorno passano a
-- «attesa_whatsapp», come farà il giro d'ora in poi.
--
-- ⚠️ NON È UNA MIGRAZIONE: sta fuori da `supabase/migrations/`, non parte da sola. Si lancia
--    a mano nell'editor SQL di Supabase, UNA volta, DOPO la migrazione
--    20261028170000_manychat_attesa_whatsapp.sql (e dopo la pubblicazione del codice, così
--    il giro non ne rifà il lavoro a metà).
-- ⚠️ ORDINE DEI PASSI: prima il PASSO 1 (conteggio, non scrive niente), si guardano i numeri,
--    poi il PASSO 2 (l'UPDATE). Nessun dato viene cancellato; il PASSO 2 si può rilanciare:
--    non trova più nessuno da portare.
--
-- CHI PASSA: schede con `data->>'stato' = 'da_contattare'` e almeno un invio in
-- `manychat_invii` di tipo 'primo_contatto' o 'ritorno', stesso `user_id`, in stato
-- 'inviato' (il solo esito che dice «è partito davvero»), abbinato alla scheda per
-- `lead_id` oppure per le ultime 9 cifre del telefono.
-- ⚠️ DIFFERENZA DA `STATI_ARRIVATI` del codice (prenotato, inviato, incerto): qui solo
--    'inviato'. 'incerto' e 'prenotato' non dicono che il messaggio sia arrivato; il PASSO 1
--    li conta a parte, e se il titolare vuole portare anche loro basta aggiungere
--    'incerto' alla lista `i.stato IN (...)` nei due passi.
-- ⚠️ `statoDal` = l'ora dell'ULTIMO invio che qualifica la scheda (`inviato_il`, o
--    `prenotato_il` se manca), non «adesso»: è il momento vero in cui la scheda ha smesso di
--    essere da contattare. Nessun messaggio «per stato» parte per «attesa_whatsapp».
-- ⚠️ Non tocca `contattoWa`, né altri stati, né altri campi di `data` (solo jsonb_set sui
--    quattro campi del cambio di stato).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── PASSO 1 · PROVA A SECCO: quante schede passerebbero (non scrive niente) ──
WITH qualificate AS (
  SELECT l.id,
         bool_or(i.stato = 'inviato') AS con_inviato
    FROM public.crm_leads l
    JOIN public.manychat_invii i
      ON i.user_id = l.user_id
     AND i.tipo IN ('primo_contatto', 'ritorno')
     AND i.stato IN ('inviato', 'incerto', 'prenotato')
     AND (
           i.lead_id = l.id
        OR (
             length(regexp_replace(coalesce(l.data->>'telefono', ''), '\D', '', 'g')) >= 9
         AND right(regexp_replace(coalesce(l.data->>'telefono', ''), '\D', '', 'g'), 9)
           = right(regexp_replace(i.telefono, '\D', '', 'g'), 9)
        )
     )
   WHERE l.data->>'stato' = 'da_contattare'
   GROUP BY l.id
)
SELECT count(*) FILTER (WHERE con_inviato)      AS passeranno_con_invio_inviato,
       count(*) FILTER (WHERE NOT con_inviato)  AS restano_solo_incerto_o_prenotato,
       (SELECT count(*) FROM public.crm_leads WHERE data->>'stato' = 'da_contattare') AS da_contattare_oggi
  FROM qualificate;

-- ── PASSO 2 · L'UPDATE (si lancia solo dopo aver guardato il PASSO 1) ────────
WITH ultimo AS (
  SELECT l.id,
         max(coalesce(i.inviato_il, i.prenotato_il)) AS il
    FROM public.crm_leads l
    JOIN public.manychat_invii i
      ON i.user_id = l.user_id
     AND i.tipo IN ('primo_contatto', 'ritorno')
     AND i.stato IN ('inviato')
     AND (
           i.lead_id = l.id
        OR (
             length(regexp_replace(coalesce(l.data->>'telefono', ''), '\D', '', 'g')) >= 9
         AND right(regexp_replace(coalesce(l.data->>'telefono', ''), '\D', '', 'g'), 9)
           = right(regexp_replace(i.telefono, '\D', '', 'g'), 9)
        )
     )
   WHERE l.data->>'stato' = 'da_contattare'
   GROUP BY l.id
)
UPDATE public.crm_leads l
   SET data = jsonb_set(
                jsonb_set(
                  jsonb_set(
                    jsonb_set(l.data, '{stato}', to_jsonb('attesa_whatsapp'::text), true),
                    '{statoDal}', to_jsonb(to_char(u.il AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), true),
                  '{statoPrecedente}', to_jsonb('da_contattare'::text), true),
                '{statoPrecedenteIl}', to_jsonb(to_char(u.il AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')), true)
  FROM ultimo u
 WHERE l.id = u.id
   AND l.data->>'stato' = 'da_contattare';
