-- ─────────────────────────────────────────────────────────────────────────────
-- PRENOTA LA CONSULENZA DENTRO LA CHAT WHATSAPP · ACCENDI / SPEGNI / CONTROLLA
--
-- Questo NON è una migrazione: non cambia lo schema e non sta in
-- supabase/migrations. La lancia il titolare a mano, dopo averla letta,
-- nell'editor SQL di Supabase, come MANYCHAT-CANALE.sql. Scrive UNA sola riga
-- di configurazione in app_config (chiave «prenota_chat»).
--
-- FUNZIONA COSÌ: la funzione è SPENTA di serie. Senza la riga, con la riga
-- illeggibile o con "acceso":false la rotta risponde sempre «nessuno» e non
-- scrive niente. Si accende SOLO con "acceso":true (esatto).
--
-- ⚠️ I comandi che SCRIVONO (1 accendi, 2 spegni) sono commentati con «-- » di
-- proposito: se lanci tutto il file per sbaglio, vengono eseguite solo le
-- letture (3-7) e non cambia niente. Per scrivere togli i due trattini DAVANTI
-- A UN SOLO comando, selezionalo e premi Run.
--
-- QUANDO: accendi SOLO dopo che il codice è pubblicato, la configurazione di
-- ManyChat è finita (PIANO §9) e hai scelto il momento del collaudo (PIANO §10).
-- Dopo il collaudo, se non procedi subito, SPEGNI.
--
-- I valori: "preavvisoOre" 1-48 (predefinito 3), "giorniAvanti" 1-30 (14),
-- "durataMin" 15-180 (60). Fuori scala tornano al predefinito.
-- "consulenteId" è l'id del consulente da preferire (lo trovi con il comando 4);
-- lasciato vuoto vale «chi si chiama Filippo» (se ce n'è uno solo).
-- ─────────────────────────────────────────────────────────────────────────────


-- 1 · ACCENDI (togli i due trattini davanti a INSERT … e alle righe sotto, poi Run)
-- INSERT INTO public.app_config (key, value, updated_at)
-- VALUES (
--   'prenota_chat',
--   '{"v":1,"acceso":true,"consulenteId":"","preavvisoOre":3,"giorniAvanti":14,"durataMin":60}',
--   now()
-- )
-- ON CONFLICT (key) DO UPDATE
--    SET value = excluded.value,
--        updated_at = now();


-- 2 · SPEGNI (stessa riga con "acceso":false: la rotta torna a rispondere «nessuno»
--     e non scrive più niente; le prenotazioni già fatte restano valide)
-- INSERT INTO public.app_config (key, value, updated_at)
-- VALUES (
--   'prenota_chat',
--   '{"v":1,"acceso":false,"consulenteId":"","preavvisoOre":3,"giorniAvanti":14,"durataMin":60}',
--   now()
-- )
-- ON CONFLICT (key) DO UPDATE
--    SET value = excluded.value,
--        updated_at = now();


-- 3 · CONTROLLO: com'è adesso. Nessuna riga = spenta (mai accesa). Se vedi
--     "acceso":true la funzione è accesa.
SELECT key, value, updated_at FROM public.app_config WHERE key = 'prenota_chat';


-- 4 · L'ID DI FILIPPO (e degli altri consulenti), per "consulenteId". Se c'è un
--     solo Filippo attivo non serve scriverlo: la rotta lo trova per nome.
SELECT id,
       data->>'nome'     AS nome,
       data->>'priorita' AS priorita,
       data->>'attivo'   AS attivo
  FROM public.crm_consultants
 ORDER BY 2;


-- 5 · COSA HA FISSATO LA CHAT: le schede con il marcatore «prenotatoChat»
--     (quando e quale orario). ⚠️ Si cerca per il marcatore, non per
--     "fissatoDa": nelle riprenotazioni (meet da fissare, da riprogrammare,
--     cliente assente) "fissatoDa" resta quello della setter. Se la setter ha
--     spostato l'orario, giorno e ora qui sono i nuovi e non combaciano più con
--     il marcatore.
SELECT id,
       data->>'nome'                    AS nome,
       data->>'stato'                   AS stato,
       data->>'dataMeeting'             AS giorno,
       data->>'oraMeeting'              AS ora,
       data->>'consulenteId'            AS consulente,
       data->'prenotatoChat'->>'il'     AS prenotato_il,
       data->'prenotatoChat'->>'g'      AS prenotato_giorno,
       data->'prenotatoChat'->>'o'      AS prenotato_ora
  FROM public.crm_leads
 WHERE data->'prenotatoChat' IS NOT NULL
 ORDER BY updated_at DESC
 LIMIT 100;


-- 6 · LUCCHETTI RIMASTI: ognuno scade da solo dopo 20 secondi. Dopo un minuto
--     senza traffico questa query deve dare ZERO righe. Se ne resta una vecchia
--     di ore, scrivilo sulla lavagna (non toccarla a mano: non blocca niente
--     oltre i 20 secondi, la rotta la riprende da sola).
SELECT key, value, updated_at
  FROM public.app_config
 WHERE starts_with(key, 'prenota_chat_lock:')
 ORDER BY updated_at DESC;


-- 7 · QUANTI NUMERI HANNO UNA PROPOSTA APERTA (una riga per numero, la chiave
--     porta l'impronta del numero e non il numero; qui si conta soltanto).
SELECT count(*) AS proposte_ricordate
  FROM public.app_config
 WHERE starts_with(key, 'prenota_chat:')
   AND NOT starts_with(key, 'prenota_chat_lock:');


-- PER TORNARE INDIETRO
--   · In emergenza, senza toccare il CRM: in ManyChat scollega la External
--     Request verso /api/public/manychat-prenota (PIANO §5, rollback).
--   · Poi lancia il comando 2 (SPEGNI).
--   · Una singola prenotazione sbagliata si annulla dalla scheda nel CRM, come
--     qualunque appuntamento (stato «Da riprogrammare» o annullato): trovi le
--     schede con il comando 5.
