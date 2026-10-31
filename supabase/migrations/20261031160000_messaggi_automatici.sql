-- ─────────────────────────────────────────────────────────────────────────────
-- MESSAGGI AUTOMATICI · UN REGISTRO CON UN INTERRUTTORE PER OGNUNO (31/10/2026)
--
-- Commessa 2026-10-31-interruttori-automatici (richiesta del titolare: «tutti i
-- messaggi che partono da soli, ognuno con il suo interruttore»). Da qui il REGISTRO
-- è l'UNICA fonte di «acceso / spento» per i 25 messaggi automatici su WhatsApp
-- (l'elenco è in src/crm/messaggi-automatici/catalogo.ts). I vecchi interruttori
-- (manychat_config.promemoria/ricontatti/lead_nuovo/giorno_meet/stati, i JSON
-- «acceso» di app_config) NON si toccano: restano righe che il codice nuovo non legge
-- più, e servono solo per tornare indietro (vedi «ripristina»).
--
-- COSA AGGIUNGE (solo aggiunte: niente che cancelli o riscriva dati esistenti)
--   · messaggi_automatici          — una riga per messaggio: chiave, acceso, acceso_dal
--                                    (l'istante dell'ultima accensione, messo dal
--                                    database a ogni passaggio spento → acceso).
--   · messaggi_automatici_registro — il log delle modifiche, solo aggiunte: chiave,
--                                    prima, dopo, chi (il nome lo mette il server),
--                                    quando. È l'unica memoria di «chi ha spento».
--   · messaggio_automatico_imposta — cambia UN interruttore e scrive la riga di log
--                                    nella stessa transazione, ma solo se il valore è
--                                    ancora quello che chi clicca aveva visto
--                                    (compare-and-set): se nel frattempo l'ha cambiato un
--                                    altro, ritorna false, non scrive niente e la rotta
--                                    risponde 409.
--   · il seme: le 25 righe, con i valori di OGGI dei vecchi interruttori, letti con le
--     stesse regole del codice (vedi il blocco «regole di lettura» più sotto).
--
-- ⚠️ TABELLE CHIUSE: RLS accesa, nessuna policy, tolto tutto ad anon e authenticated. Le
--    legge e le scrive solo il server (chiave di servizio), dietro il permesso «impostazioni».
--    La funzione è SECURITY DEFINER e la può chiamare solo il server.
-- ⚠️ I VALORI DI PARTENZA SI COPIANO DAL DATABASE VIVO: dal repository non si legge lo stato
--    di oggi. Una tabella o una colonna che manca vale «spento»; un valore storto vale
--    «spento» e non fa fallire la migrazione. `meet_adesso` e «Sollecito acconto» partono
--    SPENTI (sono spenti da una costante nel codice); «Webinar in diretta» parte ACCESO
--    (oggi parte sempre). «Cliente assente» parte acceso solo se lo sono entrambi gli stati
--    no_show e non_fatto.
-- ⚠️ ORDINE DI RILASCIO: applicare questa migrazione e SUBITO pubblicare il codice, in una
--    sola seduta. Se tra le due passano ore e qualcuno ha toccato i vecchi pannelli, prima di
--    pubblicare si lancia supabase/recuperi/20261031_messaggi_automatici_riallinea.sql e si
--    controlla con 20261031_messaggi_automatici_controllo.sql. Dopo la pubblicazione il
--    registro è la sola verità e «riallinea» NON si lancia più.
-- ⚠️ Il codice nuovo SENZA questa migrazione funziona: la lettura del registro fallisce, TUTTO
--    risulta spento (nessun messaggio parte) e il pannello dice «Manca l'aggiornamento del
--    database». Per questo si applica PRIMA di pubblicare.
-- ⚠️ Applicarla due volte non fa danni (IF NOT EXISTS, OR REPLACE, ON CONFLICT DO NOTHING): la
--    seconda volta non riscrive nessuna riga del registro.
-- ⚠️ Collaudo su un Postgres vero: strumenti/pg-prova.sh della commessa ottimizzazioni
--    (ko=0, anche con la migrazione lanciata due volte).
--
-- COME SI ANNULLA (solo se serve davvero; PRIMA si lancia «ripristina» e si ripubblica il
-- codice vecchio, altrimenti il codice vecchio rilegge valori congelati):
--   DROP FUNCTION public.messaggio_automatico_imposta(text, boolean, boolean, text);
--   DROP TABLE public.messaggi_automatici_registro, public.messaggi_automatici;
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Il registro: una riga per messaggio ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messaggi_automatici (
  chiave     text PRIMARY KEY,
  acceso     boolean NOT NULL DEFAULT false,
  -- NULL = mai acceso, o dato non usato da quel messaggio
  acceso_dal timestamptz
);

-- ── 2. Il log delle modifiche (solo aggiunte) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messaggi_automatici_registro (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chiave text NOT NULL,
  prima  boolean NOT NULL,
  dopo   boolean NOT NULL,
  -- il nome di chi ha cliccato, preso dal server, mai dal browser
  da     text NOT NULL,
  il     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messaggi_automatici_registro_il ON public.messaggi_automatici_registro (il DESC);
CREATE INDEX IF NOT EXISTS messaggi_automatici_registro_chiave ON public.messaggi_automatici_registro (chiave, il DESC);

-- ── 3. Tutto chiuso: le tabelle le tocca solo il server ──────────────────────
ALTER TABLE public.messaggi_automatici ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaggi_automatici_registro ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.messaggi_automatici FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.messaggi_automatici_registro FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.messaggi_automatici TO service_role;
GRANT ALL ON TABLE public.messaggi_automatici_registro TO service_role;

-- ── 4. Cambiare un interruttore: compare-and-set + log nella stessa transazione ──
-- Ritorna true se ha cambiato (e ha scritto il log), false se non ha fatto niente:
-- la chiave non esiste, `p_prima` non è più il valore di adesso (l'ha cambiato un altro
-- nel frattempo), oppure `p_prima` = `p_dopo` (niente da cambiare, niente log). Due persone
-- che cliccano insieme: la seconda aspetta la prima, rilegge, e non trova più `p_prima`.
CREATE OR REPLACE FUNCTION public.messaggio_automatico_imposta(
  p_chiave text,
  p_prima  boolean,
  p_dopo   boolean,
  p_da     text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_righe int;
BEGIN
  IF p_prima IS NULL OR p_dopo IS NULL OR p_prima = p_dopo THEN
    RETURN false;
  END IF;

  UPDATE public.messaggi_automatici
     SET acceso = p_dopo,
         acceso_dal = CASE WHEN p_dopo AND NOT acceso THEN now() ELSE acceso_dal END
   WHERE chiave = p_chiave
     AND acceso = p_prima;
  GET DIAGNOSTICS v_righe = ROW_COUNT;
  IF v_righe = 0 THEN
    RETURN false;
  END IF;

  INSERT INTO public.messaggi_automatici_registro (chiave, prima, dopo, da)
  VALUES (p_chiave, p_prima, p_dopo, left(COALESCE(NULLIF(btrim(p_da), ''), 'sconosciuto'), 80));
  RETURN true;
END
$$;

REVOKE ALL ON FUNCTION public.messaggio_automatico_imposta(text, boolean, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messaggio_automatico_imposta(text, boolean, boolean, text) TO service_role;

-- ── 5. Le regole di lettura dei vecchi interruttori (per il seme) ───────────
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

-- ── 6. Il seme: i valori di oggi, una riga per messaggio ─────────────────────
-- ON CONFLICT DO NOTHING: una riga che c'è già (seconda esecuzione, o già toccata dal
-- pannello) non si riscrive mai. I vecchi valori non si toccano.
INSERT INTO public.messaggi_automatici (chiave, acceso, acceso_dal)
SELECT v.chiave, v.acceso, v.acceso_dal
  FROM pg_temp.hgl_vecchi() v
ON CONFLICT (chiave) DO NOTHING;
