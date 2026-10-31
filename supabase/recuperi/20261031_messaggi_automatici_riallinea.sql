-- ─────────────────────────────────────────────────────────────────────────────
-- RIALLINEA · IL REGISTRO TORNA UGUALE AI VECCHI INTERRUTTORI (31/10/2026)
--
-- Commessa 2026-10-31-interruttori-automatici. Ricopia nel registro `messaggi_automatici`
-- i valori di OGGI dei vecchi interruttori (manychat_config e i JSON di app_config),
-- con le stesse regole di lettura del seme della migrazione 20261031160000.
--
-- QUANDO SERVE: tra l'applicazione della migrazione e la pubblicazione del codice sono
-- passate ore, e nel frattempo qualcuno ha acceso o spento qualcosa dai vecchi pannelli
-- (il codice vecchio non legge il registro, quindi il registro è rimasto indietro).
-- ⚠️ SOLO PRIMA DELLA PUBBLICAZIONE. Dopo, il registro è la sola verità e i vecchi valori
--    sono congelati: lanciarlo allora RIPORTEREBBE il registro a valori vecchi e
--    accenderebbe o spegnerebbe messaggi per errore. Per tornare indietro dopo la
--    pubblicazione si usa «ripristina», non questo.
-- ⚠️ NON È UNA MIGRAZIONE: sta fuori da `supabase/migrations/`, non parte da sola. Si lancia a
--    mano nell'editor SQL di Supabase, dopo la migrazione, e il risultato si controlla con
--    20261031_messaggi_automatici_controllo.sql (le due colonne devono essere uguali).
-- ⚠️ Cambia SOLO le righe che differiscono (e le mostra in uscita); non crea né toglie righe;
--    non scrive nel log delle modifiche (non è un cambio fatto da una persona). Lanciarlo due
--    volte di fila è innocuo: la seconda non trova differenze.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── LE REGOLE DI LETTURA DEI VECCHI INTERRUTTORI (funzioni temporanee) ──────
-- Spariscono alla fine della seduta. Il testo di questo blocco è IDENTICO in
-- migrazione, «riallinea» e «controllo» (lo verifica una prova): leggono i vecchi
-- valori con le STESSE regole con cui li leggeva il codice, non con altre.
--   · un interruttore booleano è acceso solo se il valore è `true` (IS TRUE);
--   · uno stato è acceso solo se ha un'ora che si legge (NULLIF(…,'') e una data
--     vera), non solo se la chiave c'è;
--   · un valore storto (testo che non è JSON o non è una data) vale «spento» e non
--     fa fallire niente (EXCEPTION WHEN others);
--   · una tabella o una colonna che manca vale «spento».
CREATE OR REPLACE FUNCTION pg_temp.hgl_ts(t text) RETURNS timestamptz LANGUAGE plpgsql AS $f$
BEGIN
  RETURN NULLIF(btrim(t), '')::timestamptz;
EXCEPTION WHEN others THEN
  RETURN NULL;
END
$f$;

CREATE OR REPLACE FUNCTION pg_temp.hgl_json(t text) RETURNS jsonb LANGUAGE plpgsql AS $f$
BEGIN
  RETURN NULLIF(btrim(t), '')::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END
$f$;

-- La riga di `app_config` per chiave, già letta come JSON (NULL se manca o è storta).
CREATE OR REPLACE FUNCTION pg_temp.hgl_app(k text) RETURNS jsonb LANGUAGE plpgsql AS $f$
DECLARE
  r jsonb;
BEGIN
  IF to_regclass('public.app_config') IS NULL THEN
    RETURN NULL;
  END IF;
  EXECUTE 'SELECT pg_temp.hgl_json(value) FROM public.app_config WHERE key = $1' INTO r USING k;
  RETURN r;
EXCEPTION WHEN others THEN
  RETURN NULL;
END
$f$;

-- L'ora di accensione di uno stato dentro `manychat_config.stati`; NULL = spento.
CREATE OR REPLACE FUNCTION pg_temp.hgl_stato(m jsonb, nome text) RETURNS timestamptz LANGUAGE sql AS $f$
  SELECT CASE
    WHEN jsonb_typeof(m -> 'stati' -> nome) = 'string' THEN pg_temp.hgl_ts(NULLIF(m -> 'stati' ->> nome, ''))
  END
$f$;

-- I valori di oggi, una riga per messaggio: la chiave, se è acceso, da quando.
CREATE OR REPLACE FUNCTION pg_temp.hgl_vecchi() RETURNS TABLE (chiave text, acceso boolean, acceso_dal timestamptz) LANGUAGE plpgsql AS $f$
DECLARE
  m          jsonb;        -- la riga di manychat_config come JSON: una colonna che manca è NULL
  v_ln       boolean;      -- «Lead nuovo»: primo contatto, richiamo, ritorno, casi reali
  v_ln_dal   timestamptz;
  v_gm       boolean;      -- «Giorno del meet»: mattina e giorno prima
  v_pm       boolean;      -- «Promemoria» 20 minuti prima
  v_ri       boolean;      -- «Ricontatti dei consulenti»
  v_ri_dal   timestamptz;
  v_as       boolean;      -- «Cliente assente»: no_show E non_fatto
BEGIN
  IF to_regclass('public.manychat_config') IS NOT NULL THEN
    BEGIN
      EXECUTE 'SELECT to_jsonb(c) FROM public.manychat_config c WHERE c.id = 1' INTO m;
    EXCEPTION WHEN others THEN
      m := NULL;
    END;
  END IF;

  v_ln := ((m -> 'lead_nuovo') = 'true'::jsonb) IS TRUE;
  v_ln_dal := CASE WHEN v_ln THEN pg_temp.hgl_ts(m ->> 'lead_nuovo_dal') END;
  v_gm := ((m -> 'giorno_meet') = 'true'::jsonb) IS TRUE;
  v_pm := ((m -> 'promemoria') = 'true'::jsonb) IS TRUE;
  v_ri := ((m -> 'ricontatti') = 'true'::jsonb) IS TRUE;
  v_ri_dal := CASE WHEN v_ri THEN pg_temp.hgl_ts(m ->> 'ultima_accensione') END;
  v_as := pg_temp.hgl_stato(m, 'no_show') IS NOT NULL AND pg_temp.hgl_stato(m, 'non_fatto') IS NOT NULL;

  RETURN QUERY VALUES
    ('primo_contatto', v_ln, v_ln_dal),
    ('richiamo_24h', v_ln, v_ln_dal),
    ('ritorno', v_ln, v_ln_dal),
    ('casi_reali', v_ln, v_ln_dal),
    ('ricontatto_fissato', v_ri, v_ri_dal),
    ('stato:sta_valutando', pg_temp.hgl_stato(m, 'sta_valutando') IS NOT NULL, pg_temp.hgl_stato(m, 'sta_valutando')),
    ('stato:gestire_in_chat', pg_temp.hgl_stato(m, 'gestire_in_chat') IS NOT NULL, pg_temp.hgl_stato(m, 'gestire_in_chat')),
    ('stato:fissa_meet_dopo', pg_temp.hgl_stato(m, 'fissa_meet_dopo') IS NOT NULL, pg_temp.hgl_stato(m, 'fissa_meet_dopo')),
    ('stato:non_risponde', pg_temp.hgl_stato(m, 'non_risponde') IS NOT NULL, pg_temp.hgl_stato(m, 'non_risponde')),
    ('stato:segreteria', pg_temp.hgl_stato(m, 'segreteria') IS NOT NULL, pg_temp.hgl_stato(m, 'segreteria')),
    ('stato:irreperibile', pg_temp.hgl_stato(m, 'irreperibile') IS NOT NULL, pg_temp.hgl_stato(m, 'irreperibile')),
    ('conferma_consulenza', ((pg_temp.hgl_app('promemoria_whatsapp') -> 'acceso') = 'true'::jsonb) IS TRUE, NULL::timestamptz),
    ('meet_domani', v_gm, NULL::timestamptz),
    ('meet_oggi', v_gm, NULL::timestamptz),
    ('promemoria_meet', v_pm, NULL::timestamptz),
    ('meet_adesso', false, NULL::timestamptz),
    ('stato:richiamo', pg_temp.hgl_stato(m, 'richiamo') IS NOT NULL, pg_temp.hgl_stato(m, 'richiamo')),
    ('stato:viene_in_sede', pg_temp.hgl_stato(m, 'viene_in_sede') IS NOT NULL, pg_temp.hgl_stato(m, 'viene_in_sede')),
    ('stato:sede_disdetta', pg_temp.hgl_stato(m, 'sede_disdetta') IS NOT NULL, pg_temp.hgl_stato(m, 'sede_disdetta')),
    ('prenota_chat', ((pg_temp.hgl_app('prenota_chat') -> 'acceso') = 'true'::jsonb) IS TRUE, NULL::timestamptz),
    ('stato:no_show', v_as, CASE WHEN v_as THEN GREATEST(pg_temp.hgl_stato(m, 'no_show'), pg_temp.hgl_stato(m, 'non_fatto')) END),
    ('stato:da_spostare', pg_temp.hgl_stato(m, 'da_spostare') IS NOT NULL, pg_temp.hgl_stato(m, 'da_spostare')),
    ('stato:in_attesa_acconto', false, NULL::timestamptz),
    ('dati_fattura', ((pg_temp.hgl_app('dati_fattura_config') -> 'acceso') = 'true'::jsonb) IS TRUE, NULL::timestamptz),
    ('webinar_in_diretta', true, NULL::timestamptz);
END
$f$;

-- ── Il riallineamento ────────────────────────────────────────────────────────
UPDATE public.messaggi_automatici r
   SET acceso = v.acceso,
       acceso_dal = v.acceso_dal
  FROM pg_temp.hgl_vecchi() v
 WHERE r.chiave = v.chiave
   AND (r.acceso, r.acceso_dal) IS DISTINCT FROM (v.acceso, v.acceso_dal)
RETURNING r.chiave, r.acceso, r.acceso_dal;
