-- ─────────────────────────────────────────────────────────────────────────────
-- SHOP · S5 · LE TARIFFE DI SPEDIZIONE (DA TABELLA, NON DA COSTANTI)
--
-- Commessa 2026-11-20-shop-completo (PIANO-R2.md §4 «S5», compito T42, Rilascio 2, decisione D51).
-- La applica il TITOLARE, a mano, dal SQL Editor di Supabase. La squadra non la lancia mai
-- e non usa «supabase db push» su questo file.
--
-- COSA FA (solo aggiunte: nessuna riga e nessuna tabella esistente viene toccata)
--   1. Controlla che S1 sia già applicata (servono shop_storico e shop_impostazioni). Se manca si
--      ferma con un messaggio chiaro, prima di scrivere qualsiasi cosa.
--   2. Crea la tabella shop_spedizioni_tariffe: le tariffe di spedizione, oggi solo Italia. Il costo
--      è in centesimi, mai negativo. Ogni tariffa può avere corriere, soglia di spedizione gratuita
--      e tempi (giorni minimo e massimo, da 1 in su): ciò che è vuoto non si mostra al cliente. Una SOLA tariffa
--      può essere attiva per Paese (indice unico parziale). Protezione per riga accesa, nessuna policy,
--      tolta ad anon e authenticated; a service_role resta la sola lettura: la tariffa si cambia
--      con la funzione qui sotto, così lascia sempre una riga nello storico.
--   3. Semina la tariffa di partenza, con id fisso: «Spedizione tracciata in Italia», 4,90 euro (490
--      centesimi), attiva e PROVVISORIA. Resta provvisoria finché il titolare non preme «Conferma la
--      tariffa» dal CRM. Finché è provvisoria il sito usa la cifra per far pagare, ma non mostra
--      corriere né tempi.
--   4. Crea la funzione shop_tariffa_imposta (solo service_role): cambia i campi della tariffa col
--      confronto-e-scambio sul valore che chi salva ha visto (se nel frattempo l'ha cambiata un altro
--      risponde false e non scrive), e con p_conferma la conferma (toglie «provvisoria», scrive
--      «confermata_il»). Una riga di storico per ogni campo cambiato, e una per la conferma.
--   5. Semina due interruttori in shop_impostazioni: «corrieri» (un elenco di nomi con il modello
--      dell'indirizzo di tracciamento VUOTO: lo compila il titolare dal CRM, con un numero vero in
--      mano) e «resi_confermati» = false.
--   6. Chiede a PostgREST di ricaricare lo schema.
--
-- COSA NON FA
--   Non tocca shop_orders né nessuna tabella che esiste già: l'unico UPDATE sta dentro la funzione e
--   riguarda solo la sua tabella. Nessuna cancellazione di dati, nessuna tabella o colonna tolta,
--   nessun trigger. Non apre la cassa e non cambia il sito: senza il codice del Rilascio 2 la tabella
--   non la legge nessuno. Non mette nessuna soglia di spedizione gratuita (la colonna esiste ed è
--   vuota: vuota vuol dire «mai gratis»).
--
-- ORDINE: M1 → S1 (e le altre del Rilascio 1) → S4 → S4b → S5 → S6. S5 dipende solo da S1: può essere
-- lanciata prima o dopo la pubblicazione del codice (senza S5 la cassa Stripe resta chiusa con la
-- frase «manca la tariffa»; il sito di oggi e la cassa vecchia non cambiano).
--
-- LANCIARLA DUE VOLTE NON FA DANNI (IF NOT EXISTS, OR REPLACE, semi con ON CONFLICT DO NOTHING:
-- ciò che il titolare ha già cambiato resta com'è).
--
-- COME SI ANNULLA: non serve. La tabella è nuova e non la legge nessun codice finora in uso. Per far
-- sparire la tariffa dalla cassa basta metterla «non attiva» dal CRM (senza tariffa attiva la cassa
-- Stripe non si apre e il sito di oggi resta com'è). Se la tabella va proprio tolta, chiedi alla
-- squadra lo script di rimozione: non si improvvisa dal SQL Editor.
--
-- VERIFICA, dopo averla applicata (tutte in sola lettura):
--   SELECT nome, costo_cent, attiva, provvisoria, confermata_il FROM public.shop_spedizioni_tariffe;
--      → una riga: Spedizione tracciata in Italia, 490, true, true, vuota
--   SELECT chiave, valore FROM public.shop_impostazioni WHERE chiave IN ('corrieri', 'resi_confermati');
--      → «corrieri» con i modelli vuoti, «resi_confermati» = false
--   SELECT count(*) FROM pg_policies WHERE tablename = 'shop_spedizioni_tariffe';
--      → 0
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 0. Controllo iniziale: senza S1 si ferma, senza aver scritto niente ──────
DO $$
BEGIN
  IF to_regclass('public.shop_storico') IS NULL OR to_regclass('public.shop_impostazioni') IS NULL THEN
    RAISE EXCEPTION 'S5 si ferma: manca S1 (20261120120000_shop_catalogo.sql). Applica prima S1, poi rilancia questo file. Non ho scritto niente.';
  END IF;
END
$$;

-- ── 1. La tabella delle tariffe ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_spedizioni_tariffe (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paese          text NOT NULL DEFAULT 'IT' CHECK (paese = 'IT'),
  nome           text NOT NULL CHECK (btrim(nome) <> ''),
  corriere       text,
  costo_cent     integer NOT NULL CHECK (costo_cent >= 0),
  gratis_da_cent integer CHECK (gratis_da_cent >= 0),
  giorni_min     integer CHECK (giorni_min >= 1),
  giorni_max     integer CHECK (giorni_max >= 1),
  attiva         boolean NOT NULL DEFAULT true,
  provvisoria    boolean NOT NULL DEFAULT true,
  confermata_il  timestamptz,
  creato_il      timestamptz NOT NULL DEFAULT now(),
  aggiornato_il  timestamptz NOT NULL DEFAULT now()
);

-- Una sola tariffa attiva per Paese: le spente possono essere quante si vuole.
CREATE UNIQUE INDEX IF NOT EXISTS uq_shop_tariffe_una_attiva_per_paese ON public.shop_spedizioni_tariffe (paese) WHERE attiva;

-- ── 2. Tutto chiuso: ci arriva solo il server, e per scrivere passa dalla funzione ──
ALTER TABLE public.shop_spedizioni_tariffe ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.shop_spedizioni_tariffe FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.shop_spedizioni_tariffe FROM service_role;
GRANT SELECT ON TABLE public.shop_spedizioni_tariffe TO service_role;

-- ── 3. Il seme: la tariffa provvisoria di partenza (mai riscritta se c'è già) ──
INSERT INTO public.shop_spedizioni_tariffe (id, paese, nome, costo_cent, attiva, provvisoria)
VALUES ('00000000-0000-4000-8000-000000008001', 'IT', 'Spedizione tracciata in Italia', 490, true, true)
ON CONFLICT (id) DO NOTHING;

-- ── 4. La funzione: confronto-e-scambio, conferma, riga di storico ───────────
-- Risponde true se ha scritto, false se non ha fatto niente: il valore visto (p_atteso = «aggiornato_il»
-- che chi salva ha letto) non è più quello di adesso, oppure non c'è nessun cambio e nessuna conferma.
-- Errori (messaggio e codice, gli stessi del finto delle prove):
--   tariffa_inesistente        (no_data_found)             l'id non c'è
--   tariffa_campo_non_valido   (invalid_parameter_value)   un campo che non si può cambiare (il paese, «provvisoria»…)
--                                                          o un valore del tipo sbagliato; non scrive niente
-- Un valore fuori regola ma del tipo giusto (costo negativo, nome vuoto, seconda tariffa attiva) lo rifiuta la
-- tabella stessa e annulla tutto: la funzione è una transazione sola.
-- shortcut: il valore visto si confronta ai millisecondi (come lo rimanda un browser) / se due salvataggi
--           dovessero cadere nello stesso millisecondo, passare a un numero di versione.
CREATE OR REPLACE FUNCTION public.shop_tariffa_imposta(
  p_id        uuid,
  p_atteso    timestamptz,
  p_campi     jsonb,
  p_conferma  boolean,
  p_chi       text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_t       public.shop_spedizioni_tariffe%ROWTYPE;
  v_n       public.shop_spedizioni_tariffe%ROWTYPE;
  v_campi   jsonb := COALESCE(p_campi, '{}'::jsonb);
  v_chi     text := left(COALESCE(NULLIF(btrim(p_chi), ''), 'sconosciuto'), 80);
  v_campo   text;
  v_ok      boolean;
  v_prima   jsonb;
  v_dopo    jsonb;
  v_cambiati text[] := ARRAY[]::text[];
BEGIN
  -- La riga si blocca prima di leggerla: due «Salva» insieme si mettono in fila e il secondo rilegge il valore nuovo.
  SELECT * INTO v_t FROM public.shop_spedizioni_tariffe WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'tariffa_inesistente' USING ERRCODE = 'no_data_found';
  END IF;

  IF jsonb_typeof(v_campi) <> 'object' THEN
    RAISE EXCEPTION 'tariffa_campo_non_valido' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  FOR v_campo IN SELECT jsonb_object_keys(v_campi) LOOP
    v_dopo := v_campi -> v_campo;
    v_ok := CASE
      WHEN v_campo IN ('nome', 'corriere') THEN jsonb_typeof(v_dopo) IN ('string', 'null')
      WHEN v_campo = 'attiva' THEN jsonb_typeof(v_dopo) = 'boolean'
      WHEN v_campo IN ('costo_cent', 'gratis_da_cent', 'giorni_min', 'giorni_max') THEN
        CASE jsonb_typeof(v_dopo)
          WHEN 'null' THEN true
          WHEN 'number' THEN (v_dopo #>> '{}')::numeric = trunc((v_dopo #>> '{}')::numeric)
                             AND (v_dopo #>> '{}')::numeric BETWEEN -2147483648 AND 2147483647
          ELSE false
        END
      ELSE false
    END;
    IF NOT v_ok THEN
      RAISE EXCEPTION 'tariffa_campo_non_valido' USING ERRCODE = 'invalid_parameter_value';
    END IF;
    IF v_dopo IS DISTINCT FROM to_jsonb(v_t) -> v_campo THEN
      v_cambiati := v_cambiati || v_campo;
    END IF;
  END LOOP;

  -- Il valore visto non è più quello di adesso: l'ha cambiato un altro. Non si scrive niente.
  IF date_trunc('milliseconds', p_atteso) IS DISTINCT FROM date_trunc('milliseconds', v_t.aggiornato_il) THEN
    RETURN false;
  END IF;
  IF cardinality(v_cambiati) = 0 AND p_conferma IS NOT TRUE THEN
    RETURN false;
  END IF;

  v_n := jsonb_populate_record(v_t, v_campi);
  UPDATE public.shop_spedizioni_tariffe
     SET nome = v_n.nome, corriere = v_n.corriere, costo_cent = v_n.costo_cent, gratis_da_cent = v_n.gratis_da_cent,
         giorni_min = v_n.giorni_min, giorni_max = v_n.giorni_max, attiva = v_n.attiva,
         provvisoria = CASE WHEN p_conferma IS TRUE THEN false ELSE provvisoria END,
         confermata_il = CASE WHEN p_conferma IS TRUE THEN clock_timestamp() ELSE confermata_il END,
         aggiornato_il = clock_timestamp()
   WHERE id = p_id;

  FOREACH v_campo IN ARRAY v_cambiati LOOP
    v_prima := to_jsonb(v_t) -> v_campo;
    v_dopo := v_campi -> v_campo;
    INSERT INTO public.shop_storico (entita, entita_id, campo, prima, dopo, chi)
    VALUES ('tariffa', p_id::text, v_campo, NULLIF(v_prima, 'null'::jsonb), NULLIF(v_dopo, 'null'::jsonb), v_chi);
  END LOOP;
  IF p_conferma IS TRUE THEN
    INSERT INTO public.shop_storico (entita, entita_id, campo, prima, dopo, chi)
    VALUES ('tariffa', p_id::text, 'confermata', NULL, 'true'::jsonb, v_chi);
  END IF;
  RETURN true;
END
$$;

REVOKE ALL ON FUNCTION public.shop_tariffa_imposta(uuid, timestamptz, jsonb, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_tariffa_imposta(uuid, timestamptz, jsonb, boolean, text) TO service_role;

-- ── 5. Gli interruttori di partenza (mai riscritti se già presenti) ──────────
-- «corrieri»: i nomi più comuni, con il modello dell'indirizzo di tracciamento VUOTO. Il modello lo scrive il
-- titolare dal CRM (https://… con {numero}) dopo averlo provato con un numero vero: senza modello il cliente
-- riceve solo il numero, mai un link inventato.
INSERT INTO public.shop_impostazioni (chiave, valore)
VALUES
  ('corrieri', '[{"nome":"BRT","modello":""},{"nome":"GLS","modello":""},{"nome":"SDA","modello":""},{"nome":"DHL","modello":""},{"nome":"UPS","modello":""},{"nome":"Poste Italiane","modello":""}]'::jsonb),
  ('resi_confermati', 'false'::jsonb)
ON CONFLICT (chiave) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
