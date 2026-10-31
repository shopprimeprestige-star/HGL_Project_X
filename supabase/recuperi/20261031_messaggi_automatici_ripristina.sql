-- ─────────────────────────────────────────────────────────────────────────────
-- RIPRISTINA · IL REGISTRO TORNA NEI VECCHI INTERRUTTORI (31/10/2026)
--
-- Commessa 2026-10-31-interruttori-automatici. È il ROLLBACK DEL CODICE: ricopia lo stato
-- del registro `messaggi_automatici` nei vecchi posti (colonne di manychat_config e JSON
-- «acceso» di app_config), così il codice vecchio, ripubblicato dopo, trova gli interruttori
-- come li ha lasciati il pannello nuovo. Senza questo passo il codice vecchio rilegge i
-- valori congelati al giorno della pubblicazione.
--
-- ORDINE: 1) si lancia questo file; 2) si controlla con
-- 20261031_messaggi_automatici_controllo.sql (vecchio e registro devono essere uguali);
-- 3) si ripubblica il codice vecchio. Il registro e il log NON si toccano (restano per un
-- eventuale ritorno al codice nuovo).
-- ⚠️ NON È UNA MIGRAZIONE: sta fuori da `supabase/migrations/`, non parte da sola. Si lancia a
--    mano nell'editor SQL di Supabase, una volta.
-- ⚠️ Cosa NON può riportare: «Webinar in diretta» (nel codice vecchio non ha un interruttore:
--    parte sempre) e le due voci spente da una costante (`meet_adesso`, «Sollecito acconto»).
-- ⚠️ Nel codice vecchio un interruttore valeva per più messaggi («Lead nuovo» per quattro, «Giorno
--    del meet» per due). Se nel registro ne era spento solo uno, il vecchio interruttore resta
--    ACCESO per tutti: il controllo mostra DIVERSO per quel messaggio, ed è giusto così.
-- ⚠️ I VECCHI VALORI CHE SI RISCRIVONO:
--      · promemoria ← «Promemoria 20 minuti prima»; ricontatti ← «Ricontatto fissato»;
--      · lead_nuovo ← acceso se lo è ALMENO UNO dei quattro messaggi del primo contatto;
--        lead_nuovo_dal ← l'accensione più recente fra quelli accesi (come la leggeva il codice
--        nuovo: chi era entrato prima di quella data non riceve niente);
--      · giorno_meet ← acceso se lo è mattina del meet O giorno prima;
--      · stati ← un'ora per ogni messaggio per stato acceso (no_show anche come non_fatto); gli
--        stati spenti si tolgono; le altre chiavi dentro `stati` restano com'erano;
--      · ultima_accensione ← la più recente fra la sua e l'accensione di «Ricontatto fissato»;
--      · conferma, fattura, prenota in chat: nel JSON di app_config cambia SOLO `acceso`
--        (attivoDal, avvio, consulente… restano). Se la riga non c'è, nel codice vecchio era
--        spenta e così resta: il controllo la mostra come DIVERSO se in registro era accesa.
-- ─────────────────────────────────────────────────────────────────────────────

-- Un testo che dovrebbe essere JSON: oggetto o NULL (un valore storto non rompe niente).
CREATE OR REPLACE FUNCTION pg_temp.hgl_json(t text) RETURNS jsonb LANGUAGE plpgsql AS $f$
BEGIN
  RETURN NULLIF(btrim(t), '')::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END
$f$;

-- ── 1. manychat_config: gli interruttori e le date ───────────────────────────
UPDATE public.manychat_config c
   SET promemoria = COALESCE(
         (SELECT r.acceso FROM public.messaggi_automatici r WHERE r.chiave = 'promemoria_meet'),
         c.promemoria),
       ricontatti = COALESCE(
         (SELECT r.acceso FROM public.messaggi_automatici r WHERE r.chiave = 'ricontatto_fissato'),
         c.ricontatti),
       ultima_accensione = GREATEST(
         c.ultima_accensione,
         (SELECT r.acceso_dal FROM public.messaggi_automatici r WHERE r.chiave = 'ricontatto_fissato' AND r.acceso)),
       lead_nuovo = COALESCE(
         (SELECT bool_or(r.acceso) FROM public.messaggi_automatici r
           WHERE r.chiave IN ('primo_contatto', 'richiamo_24h', 'ritorno', 'casi_reali')),
         c.lead_nuovo),
       lead_nuovo_dal = COALESCE(
         (SELECT max(r.acceso_dal) FROM public.messaggi_automatici r
           WHERE r.acceso AND r.chiave IN ('primo_contatto', 'richiamo_24h', 'ritorno', 'casi_reali')),
         c.lead_nuovo_dal),
       giorno_meet = COALESCE(
         (SELECT bool_or(r.acceso) FROM public.messaggi_automatici r
           WHERE r.chiave IN ('meet_oggi', 'meet_domani')),
         c.giorno_meet),
       stati = (
         (CASE WHEN jsonb_typeof(c.stati) = 'object' THEN c.stati ELSE '{}'::jsonb END)
         - ARRAY['sta_valutando', 'gestire_in_chat', 'fissa_meet_dopo', 'non_risponde', 'segreteria',
                 'irreperibile', 'richiamo', 'viene_in_sede', 'sede_disdetta', 'da_spostare',
                 'no_show', 'non_fatto']
       ) || COALESCE((
         SELECT jsonb_object_agg(
                  k.nome,
                  to_char(COALESCE(r.acceso_dal, now()) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
           FROM (VALUES
                  ('sta_valutando', 'stato:sta_valutando'),
                  ('gestire_in_chat', 'stato:gestire_in_chat'),
                  ('fissa_meet_dopo', 'stato:fissa_meet_dopo'),
                  ('non_risponde', 'stato:non_risponde'),
                  ('segreteria', 'stato:segreteria'),
                  ('irreperibile', 'stato:irreperibile'),
                  ('richiamo', 'stato:richiamo'),
                  ('viene_in_sede', 'stato:viene_in_sede'),
                  ('sede_disdetta', 'stato:sede_disdetta'),
                  ('da_spostare', 'stato:da_spostare'),
                  ('no_show', 'stato:no_show'),
                  ('non_fatto', 'stato:no_show')
                ) AS k(nome, chiave)
           JOIN public.messaggi_automatici r ON r.chiave = k.chiave AND r.acceso
       ), '{}'::jsonb)
 WHERE c.id = 1;

-- ── 2. app_config: solo `acceso` dentro il JSON (il resto del JSON com'è) ────
UPDATE public.app_config a
   SET value = (pg_temp.hgl_json(a.value) || jsonb_build_object('acceso', r.acceso))::text,
       updated_at = now()
  FROM public.messaggi_automatici r
 WHERE a.key = 'promemoria_whatsapp'
   AND r.chiave = 'conferma_consulenza'
   AND jsonb_typeof(pg_temp.hgl_json(a.value)) = 'object'
   AND (pg_temp.hgl_json(a.value) -> 'acceso') IS DISTINCT FROM to_jsonb(r.acceso);

UPDATE public.app_config a
   SET value = (pg_temp.hgl_json(a.value) || jsonb_build_object('acceso', r.acceso))::text,
       updated_at = now()
  FROM public.messaggi_automatici r
 WHERE a.key = 'dati_fattura_config'
   AND r.chiave = 'dati_fattura'
   AND jsonb_typeof(pg_temp.hgl_json(a.value)) = 'object'
   AND (pg_temp.hgl_json(a.value) -> 'acceso') IS DISTINCT FROM to_jsonb(r.acceso);

UPDATE public.app_config a
   SET value = (pg_temp.hgl_json(a.value) || jsonb_build_object('acceso', r.acceso))::text,
       updated_at = now()
  FROM public.messaggi_automatici r
 WHERE a.key = 'prenota_chat'
   AND r.chiave = 'prenota_chat'
   AND jsonb_typeof(pg_temp.hgl_json(a.value)) = 'object'
   AND (pg_temp.hgl_json(a.value) -> 'acceso') IS DISTINCT FROM to_jsonb(r.acceso);
