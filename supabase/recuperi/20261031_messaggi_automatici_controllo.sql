-- ─────────────────────────────────────────────────────────────────────────────
-- CONTROLLO · I VECCHI INTERRUTTORI CONTRO IL REGISTRO (31/10/2026)
--
-- Commessa 2026-10-31-interruttori-automatici. UNA sola SELECT (l'editor SQL di Supabase
-- mostra solo l'ultimo risultato): 25 righe, una per messaggio, con il valore dei vecchi
-- interruttori («vecchio»), quello del registro («registro»), e se coincidono. Non scrive
-- niente.
--
-- QUANDO: subito prima di pubblicare il codice (devono essere TUTTE uguali: se no, si lancia
-- 20261031_messaggi_automatici_riallinea.sql e si rilancia questo), e dopo un «ripristina».
-- DOPO la pubblicazione i vecchi valori sono congelati e il registro è la sola verità: la
-- SELECT serve solo a vedere cosa tornerebbe indietro con «ripristina».
--
-- DOPO «ripristina» restano DIVERSO i messaggi spenti da soli dentro una famiglia («Lead nuovo»,
-- «Giorno del meet»): il vecchio interruttore è uno solo per tutti, ed è acceso se ne basta uno.
--
-- LE NOTE: «meet_adesso» e «Sollecito acconto» sono spenti da una costante nel codice (il
-- «vecchio» è sempre spento); «Webinar in diretta» non aveva un interruttore (il «vecchio» è
-- sempre acceso). «Cliente assente» (no_show) in registro è acceso solo se lo sono ENTRAMBI
-- gli stati no_show e non_fatto: la nota mostra i due valori vecchi, così si vede se ne
-- manca uno (e in quel caso la differenza è voluta).
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

-- ── Il controllo ─────────────────────────────────────────────────────────────
SELECT v.chiave,
       v.acceso AS vecchio,
       r.acceso AS registro,
       CASE
         WHEN r.chiave IS NULL THEN 'MANCA nel registro'
         WHEN v.acceso = r.acceso THEN 'uguale'
         ELSE 'DIVERSO'
       END AS esito,
       v.acceso_dal AS vecchio_dal,
       r.acceso_dal AS registro_dal,
       CASE v.chiave
         WHEN 'meet_adesso' THEN 'spento da una costante nel codice'
         WHEN 'stato:in_attesa_acconto' THEN 'spento da una costante nel codice'
         WHEN 'webinar_in_diretta' THEN 'non aveva un interruttore: parte sempre'
         WHEN 'stato:no_show' THEN (
           SELECT 'no_show = ' || COALESCE(c.stati ->> 'no_show', 'spento')
               || ' · non_fatto = ' || COALESCE(c.stati ->> 'non_fatto', 'spento')
             FROM public.manychat_config c
            WHERE c.id = 1
         )
       END AS nota
  FROM pg_temp.hgl_vecchi() v
  LEFT JOIN public.messaggi_automatici r ON r.chiave = v.chiave
 ORDER BY (v.acceso IS DISTINCT FROM r.acceso) DESC, v.chiave;
