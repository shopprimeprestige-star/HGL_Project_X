-- ─────────────────────────────────────────────────────────────────────────────
-- SHOP · S4 · PAGAMENTI E ORDINI (CASSA STRIPE, ORDINI VERI, RIMBORSI)
--
-- Commessa 2026-11-20-shop-completo (PIANO-R2.md §4 «S4», compito T41, Rilascio 2).
-- La applica il TITOLARE, a mano, dal SQL Editor di Supabase. La squadra non la
-- lancia mai e non usa «supabase db push» su questo file.
--
-- ORDINE DELLE MIGRAZIONI: M1 → S1 / S2 / D40 / S3 (Rilascio 1) → S4 (questa) → S4b → S5 → S6.
--
-- COSA FA (solo aggiunte)
--   0. CONTROLLO INIZIALE: se M1 (20261117120000_ecommerce_ordini.sql, che dà a
--      shop_orders la colonna pagato_il) o S1 (20261120120000_shop_catalogo.sql)
--      non sono applicate, il file SI FERMA con un messaggio chiaro, senza scrivere
--      niente.
--   1. Aggiunge 28 colonne a public.shop_orders, tutte vuote o con un valore
--      costante sulle righe di oggi (nessuna riga esistente cambia): lo stato di
--      pagamento (D41: vuoto = ordine di prima, lo stato si deduce nel CRM),
--      la sessione Stripe corrente, il totale in centesimi, i rimborsi, la
--      scadenza, la giacenza da verificare, la spedizione, l'annullo, la fattura
--      richiesta, le email inviate, gli avvisi. Nessuna è NOT NULL.
--   1b. Toglie ad anon e authenticated il permesso di SCRIVERE le 28 colonne nuove (REVOKE INSERT, UPDATE su shop_orders e GRANT di
--      INSERT e UPDATE sulle sole colonne che c'erano prima). Il checkout di oggi e ciò che fa un account autenticato oggi restano identici;
--      ma finché non c'è S4b nessun browser può scrivere stato_pagamento, canale, totale_cent, stripe_*… (ordini finti «pagati»).
--      Nessuna policy cambia. Se un domani servisse tornare indietro: GRANT INSERT, UPDATE ON public.shop_orders TO anon, authenticated.
--   2. Crea tre indici su shop_orders: la sessione corrente (unica), il riferimento
--      d'ordine (unico SOLO per gli ordini del sito: nessun ordine vecchio ha il
--      canale, quindi non può fallire) e lo stato di pagamento.
--   3. Crea cinque tabelle nuove, vuote, CHIUSE: shop_ordini_riservati (dati
--      fiscali, attribuzione, consensi, IP: D42), shop_stripe_sessioni,
--      shop_stripe_eventi, shop_rimborsi, shop_limiti. Protezione per riga accesa,
--      NESSUNA policy, tolto OGNI permesso ad anon e authenticated e, per questi
--      «registri dei soldi», anche a service_role (REVOKE ALL): il server le LEGGE
--      (solo SELECT) ma le SCRIVE soltanto con le funzioni qui sotto.
--   4. Crea 14 funzioni (SECURITY DEFINER, solo service_role) e tre aiuti interni
--      (shop_s4_avviso, shop_s4_evento, shop_s4_scadenza):
--        shop_ordine_crea              ordine + riservati in una transazione, con una LISTA BIANCA di colonne
--        shop_ordine_sessione_registra una sessione Stripe in più per l'ordine (la corrente è l'ultima)
--        shop_ordine_pagato            L'UNICO punto in cui un ordine diventa pagato (D44): blocco di riga,
--                                      importo e valuta, giacenza riga per riga, doppio pagamento, sessione sconosciuta
--        shop_ordine_chiudi            in_attesa → fallito / scaduto (solo la sessione corrente)
--        shop_ordine_riapri            «Riprova il pagamento»: fallito/scaduto → in_attesa, riprova_n + 1, nuova scadenza (D66)
--        shop_stripe_evento_registra   idempotenza degli eventi del webhook (nuovo / già elaborato / da rielaborare)
--        shop_stripe_evento_chiudi
--        shop_rimborso_prenota         massimo = pagato − rimborsi richiesti o riusciti, sotto blocco; chiave unica
--        shop_rimborso_riconcilia      aggiorna i rimborsi dall'elenco letto da Stripe (D46) e porta lo stato dell'ordine
--        shop_ordine_giacenza_rimetti  rimette in magazzino SOLO ciò che i movimenti dell'ordine dicono, una volta sola
--        shop_limite_consuma           limite per impronta, INSERT … ON CONFLICT DO UPDATE (D49)
--        shop_cassa_righe              l'unica lettura della giacenza fuori dal CRM (sku, slug, prezzo, attiva, giacenza)
--        shop_rimborso_rifiuta         un rimborso che Stripe ha rifiutato davvero: «richiesto» senza id Stripe → «fallito», con un evento (T53b)
--        shop_ordine_riattiva          «annullato → nuovo» con un motivo, rifiutato se c'è un rimborso richiesto o riuscito; lo storico lo scrive lei (T53b)
--      LA SCADENZA DELL'ORDINE la decide il database, in un punto solo (shop_s4_scadenza): adesso + 60 MINUTI, sia alla creazione
--      (shop_ordine_crea) sia alla riapertura (shop_ordine_riapri). Un valore proposto dal chiamante non conta. Stripe accetta sessioni di
--      almeno 30 minuti: con una scadenza più corta una riprova dopo pochi minuti verrebbe rifiutata (errore non ritentabile). Nessuna
--      giacenza è riservata prima del pagamento (D52), quindi una finestra più lunga non costa niente. Per cambiarla: UNA riga, qui.
--   5. Semina tre interruttori (mai riscritti se già presenti): cassa_sito = «vecchia»,
--      pagamento_sicuro = false, metodi_pagamento = [].
--   6. Chiede a PostgREST di ricaricare lo schema.
--
-- COSA NON FA
--   · NON contiene il trigger di protezione di shop_orders (la lista bianca sulle colonne VECCHIE e il blocco dell'insert anonimo con
--     cassa Stripe attiva): sta in S4b. Per questo S4 DA SOLA È INERTE: il checkout di oggi continua a inserire ordini come prima
--     e un account autenticato continua a poter fare ciò che fa oggi (finché non
--     c'è S4b, e poi M2).
--   · Non cambia nessuna policy su shop_orders né su nessuna tabella già esistente, e nessun permesso di LETTURA; i permessi di
--     scrittura del browser su shop_orders restano gli stessi per le colonne di prima (vedi 1b) e non coprono le colonne nuove. Nessuna riga esistente viene riscritta: niente UPDATE
--     fuori dalle funzioni, e dentro le funzioni solo sulle tabelle del Rilascio 2
--     e su shop_orders.
--   · NESSUN DELETE, DROP o TRUNCATE in nessun punto del file, funzioni comprese
--     (decisione del capo progetto: i registri dei soldi non si cancellano). Anche
--     i limiti per impronta non si ripuliscono: la finestra scaduta si azzera con
--     INSERT … ON CONFLICT DO UPDATE sulla stessa riga.
--   · Non apre la cassa Stripe: cassa_sito resta «vecchia». Lo accende il server,
--     solo con chiavi presenti, tariffa attiva e S4 applicata.
--
-- LANCIARLA DUE VOLTE NON FA DANNI (ADD COLUMN IF NOT EXISTS, CREATE … IF NOT EXISTS,
-- OR REPLACE, semi con ON CONFLICT DO NOTHING: ciò che il titolare ha già cambiato resta).
--
-- PUÒ ESSERE LANCIATA PRIMA O DOPO LA PUBBLICAZIONE DEL CODICE: il codice di Rilascio 1
-- non legge niente di ciò che aggiunge, e il codice del Rilascio 2 ripiega sulla cassa
-- vecchia se manca.
--
-- VERIFICA, dopo averla applicata (tutte in sola lettura):
--   SELECT chiave, valore FROM public.shop_impostazioni ORDER BY chiave;
--      → cassa_sito = "vecchia", metodi_pagamento = [], pagamento_sicuro = false (e le chiavi di S1)
--   SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shop_orders' AND column_name IN ('stato_pagamento', 'totale_cent', 'avvisi');
--      → 3
--   SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shop_orders';
--      → le tre di prima, nessuna in più (S4 non cambia le policy)
--   SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename IN ('shop_ordini_riservati', 'shop_stripe_sessioni', 'shop_stripe_eventi', 'shop_rimborsi', 'shop_limiti');
--      → 0
--
-- COME SI ANNULLA: non serve. Le colonne e le tabelle nuove sono vuote e innocue, e la
-- cassa vecchia non le legge. Per «spegnere» il Rilascio 2 basta che cassa_sito resti
-- «vecchia» (è già così). Non esiste uno script che cancella: se un domani servisse, si
-- scrive a parte e si legge prima.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 0. Controllo iniziale: M1 e S1 devono esserci, altrimenti non si scrive niente ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'shop_orders' AND column_name = 'pagato_il'
  ) THEN
    RAISE EXCEPTION 'S4 si ferma: manca la migrazione M1 (supabase/migrations/20261117120000_ecommerce_ordini.sql), che dà a shop_orders la colonna pagato_il. Applicala prima; questo file non ha scritto niente.';
  END IF;
  IF to_regclass('public.shop_varianti') IS NULL OR to_regclass('public.shop_giacenza_movimenti') IS NULL
     OR to_regclass('public.shop_storico') IS NULL OR to_regclass('public.shop_impostazioni') IS NULL
     OR to_regclass('public.shop_prodotti') IS NULL OR to_regclass('public.shop_order_eventi') IS NULL THEN
    RAISE EXCEPTION 'S4 si ferma: manca S1 (supabase/migrations/20261120120000_shop_catalogo.sql) o M1 (20261117120000_ecommerce_ordini.sql, che crea shop_order_eventi). Applicale prima; questo file non ha scritto niente.';
  END IF;
END
$$;

-- ── 1. Le colonne nuove di shop_orders (vuote o a valore costante per tutte le righe di oggi) ──
ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS stato_pagamento text CHECK (stato_pagamento IS NULL OR stato_pagamento = '' OR stato_pagamento IN ('in_attesa', 'pagato', 'fallito', 'scaduto', 'rimborsato_in_parte', 'rimborsato', 'da_incassare')),
  ADD COLUMN IF NOT EXISTS stripe_sessione_id text,
  ADD COLUMN IF NOT EXISTS stripe_pagamento_id text,
  ADD COLUMN IF NOT EXISTS metodo_dettaglio text,
  ADD COLUMN IF NOT EXISTS prova boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS canale text,
  ADD COLUMN IF NOT EXISTS totale_cent integer CHECK (totale_cent IS NULL OR totale_cent >= 0),
  ADD COLUMN IF NOT EXISTS rimborsato_cent integer DEFAULT 0 CHECK (rimborsato_cent >= 0),
  ADD COLUMN IF NOT EXISTS chiave_pubblica_hash text,
  ADD COLUMN IF NOT EXISTS firma_tentativo text,
  ADD COLUMN IF NOT EXISTS scade_il timestamptz,
  ADD COLUMN IF NOT EXISTS riprova_n integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS provincia text,
  ADD COLUMN IF NOT EXISTS nazione text,
  ADD COLUMN IF NOT EXISTS giacenza_da_verificare boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS giacenza_scalata_il timestamptz,
  ADD COLUMN IF NOT EXISTS giacenza_rimessa_il timestamptz,
  ADD COLUMN IF NOT EXISTS spedito_il timestamptz,
  ADD COLUMN IF NOT EXISTS corriere text,
  ADD COLUMN IF NOT EXISTS tracking_url text,
  ADD COLUMN IF NOT EXISTS senza_tracking boolean,
  ADD COLUMN IF NOT EXISTS annullo_motivo text,
  ADD COLUMN IF NOT EXISTS annullato_il timestamptz,
  ADD COLUMN IF NOT EXISTS fattura_richiesta boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS fattura_emessa_il timestamptz,
  ADD COLUMN IF NOT EXISTS fattura_nota text,
  ADD COLUMN IF NOT EXISTS email_inviate jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS avvisi jsonb DEFAULT '[]'::jsonb;

-- ── 1b. Le colonne nuove NON si scrivono dal browser (revisione di sicurezza) ──
-- Finché non c'è S4b (il trigger), la policy di inserimento stretta di M1 non guarda le colonne nuove: un anonimo potrebbe inserire un ordine
-- «pagato» (stato_pagamento, canale, totale_cent, stripe_*, avvisi, …) e un account del CRM cambiarne lo stato. Quindi qui si tolgono ad anon e
-- authenticated i permessi di INSERT e UPDATE su shop_orders e si ridanno SOLO sulle colonne che c'erano PRIMA di S4 (M1 compresa): il checkout di
-- oggi e ciò che un account autenticato può fare oggi restano IDENTICI; le 28 colonne nuove le scrive solo il server (service_role e funzioni).
-- Così `canale = 'sito'` e `stato_pagamento` su una riga sono affidabili: li mette solo shop_ordine_crea. (Una colonna aggiunta in futuro a shop_orders
-- nasce senza permessi di scrittura per il browser: va chiesta apposta.) Rilanciabile: il calcolo delle colonne è rifatto ogni volta.
REVOKE INSERT, UPDATE ON TABLE public.shop_orders FROM anon, authenticated;
DO $$
DECLARE
  v_colonne text;
BEGIN
  SELECT string_agg(quote_ident(attname), ', ' ORDER BY attnum) INTO v_colonne
    FROM pg_attribute
   WHERE attrelid = 'public.shop_orders'::regclass AND attnum > 0 AND NOT attisdropped
     AND attname <> ALL (ARRAY['stato_pagamento', 'stripe_sessione_id', 'stripe_pagamento_id', 'metodo_dettaglio', 'prova', 'canale', 'totale_cent', 'rimborsato_cent',
       'chiave_pubblica_hash', 'firma_tentativo', 'scade_il', 'riprova_n', 'provincia', 'nazione', 'giacenza_da_verificare', 'giacenza_scalata_il', 'giacenza_rimessa_il',
       'spedito_il', 'corriere', 'tracking_url', 'senza_tracking', 'annullo_motivo', 'annullato_il', 'fattura_richiesta', 'fattura_emessa_il', 'fattura_nota',
       'email_inviate', 'avvisi']);
  EXECUTE format('GRANT INSERT (%s), UPDATE (%s) ON TABLE public.shop_orders TO anon, authenticated', v_colonne, v_colonne);
END
$$;

-- ── 2. Gli indici ─────────────────────────────────────────────────────────────
-- La sessione corrente è di UN solo ordine. Il riferimento d'ordine è unico solo per gli ordini del sito
-- (canale = 'sito'): nessuna riga vecchia ha il canale, quindi l'indice non può fallire su dati di oggi.
CREATE UNIQUE INDEX IF NOT EXISTS ux_shop_orders_stripe_sessione ON public.shop_orders (stripe_sessione_id) WHERE stripe_sessione_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_shop_orders_ref_sito ON public.shop_orders (order_ref) WHERE canale = 'sito';
CREATE INDEX IF NOT EXISTS idx_shop_orders_stato_pagamento ON public.shop_orders (stato_pagamento);

-- ── 3. Le cinque tabelle chiuse (i registri dei soldi) ────────────────────────
-- I dati fiscali e l'attribuzione NON stanno su shop_orders (che finché non c'è M2 si legge dal browser di un account del CRM): D42.
CREATE TABLE IF NOT EXISTS public.shop_ordini_riservati (
  ordine_id   uuid PRIMARY KEY REFERENCES public.shop_orders (id),
  fattura     jsonb,
  attribuzione jsonb,
  consensi    jsonb,
  ip          text,
  user_agent  text,
  creato_il   timestamptz NOT NULL DEFAULT now()
);

-- Ogni sessione Stripe creata per un ordine (la corrente è shop_orders.stripe_sessione_id): il webhook accetta l'evento di una qualunque (D44).
CREATE TABLE IF NOT EXISTS public.shop_stripe_sessioni (
  sessione_id text PRIMARY KEY,
  ordine_id   uuid NOT NULL REFERENCES public.shop_orders (id),
  creata_il   timestamptz NOT NULL DEFAULT now(),
  scade_il    timestamptz,
  stato       text NOT NULL DEFAULT 'aperta' CHECK (stato IN ('aperta', 'pagata', 'doppia', 'scaduta', 'fallita'))
);

-- Gli eventi del webhook già visti (id evt_…). L'ordine può non esistere (un client_reference_id qualunque): niente chiave esterna.
CREATE TABLE IF NOT EXISTS public.shop_stripe_eventi (
  id          text PRIMARY KEY,
  tipo        text,
  ricevuto_il timestamptz NOT NULL DEFAULT now(),
  elaborato_il timestamptz,
  esito       text,
  ordine_id   uuid
);

CREATE TABLE IF NOT EXISTS public.shop_rimborsi (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ordine_id          uuid NOT NULL REFERENCES public.shop_orders (id),
  importo_cent       integer NOT NULL CHECK (importo_cent > 0),
  motivo             text NOT NULL CHECK (btrim(motivo) <> ''),
  stato              text NOT NULL DEFAULT 'richiesto' CHECK (stato IN ('richiesto', 'riuscito', 'fallito')),
  stripe_rimborso_id text UNIQUE,
  chiave_richiesta   text UNIQUE,
  origine            text NOT NULL DEFAULT 'crm' CHECK (origine IN ('crm', 'stripe')),
  chi                text,
  creato_il          timestamptz NOT NULL DEFAULT now(),
  aggiornato_il      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shop_rimborsi_ordine ON public.shop_rimborsi (ordine_id);
CREATE INDEX IF NOT EXISTS idx_shop_stripe_sessioni_ordine ON public.shop_stripe_sessioni (ordine_id);

-- Una riga per chiave (impronta dell'indirizzo + uso): la finestra scaduta si azzera con INSERT … ON CONFLICT DO UPDATE, mai con una cancellazione.
CREATE TABLE IF NOT EXISTS public.shop_limiti (
  chiave          text PRIMARY KEY,
  finestra_inizio timestamptz NOT NULL DEFAULT now(),
  conteggio       integer NOT NULL DEFAULT 1
);

ALTER TABLE public.shop_ordini_riservati ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_stripe_sessioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_stripe_eventi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_rimborsi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_limiti ENABLE ROW LEVEL SECURITY;

-- Nessun permesso al browser; e nemmeno una scrittura diretta col ruolo del server: si legge e basta, si scrive con le funzioni (come shop_storico in S1).
REVOKE ALL ON TABLE public.shop_ordini_riservati FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.shop_stripe_sessioni FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.shop_stripe_eventi FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.shop_rimborsi FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.shop_limiti FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.shop_ordini_riservati TO service_role;
GRANT SELECT ON TABLE public.shop_stripe_sessioni TO service_role;
GRANT SELECT ON TABLE public.shop_stripe_eventi TO service_role;
GRANT SELECT ON TABLE public.shop_rimborsi TO service_role;
GRANT SELECT ON TABLE public.shop_limiti TO service_role;

-- ── 4. Aiuti interni: un avviso e una riga di registro sull'ordine ────────────
-- Un avviso sull'ordine; lo stesso (codice, riferimento) non si scrive due volte: lo stesso evento ripetuto da Stripe non lo moltiplica.
CREATE OR REPLACE FUNCTION public.shop_s4_avviso(
  p_ordine  uuid,
  p_codice  text,
  p_gravita text,
  p_rif     text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.shop_orders
     SET avvisi = COALESCE(avvisi, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('codice', p_codice, 'gravita', p_gravita, 'rif', p_rif, 'il', now())),
         aggiornato_il = now()
   WHERE id = p_ordine
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(COALESCE(avvisi, '[]'::jsonb)) a
        WHERE a ->> 'codice' = p_codice AND COALESCE(a ->> 'rif', '') = COALESCE(p_rif, '')
     );
END
$$;

-- La scadenza di un ordine in attesa di pagamento: adesso + 60 minuti. L'UNICA costante: la usano shop_ordine_crea e shop_ordine_riapri,
-- e la sessione Stripe scade nello stesso istante (expires_at = scade_il, mai ricalcolato dal server).
CREATE OR REPLACE FUNCTION public.shop_s4_scadenza() RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT now() + interval '60 minutes'
$$;

-- Una riga nel registro dei cambi dell'ordine (shop_order_eventi, di M1).
CREATE OR REPLACE FUNCTION public.shop_s4_evento(
  p_ordine uuid,
  p_tipo   text,
  p_chi    text,
  p_prima  jsonb,
  p_dopo   jsonb
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.shop_order_eventi (order_id, order_ref, tipo, chi, prima, dopo)
  SELECT o.id, o.order_ref, p_tipo, left(COALESCE(NULLIF(btrim(p_chi), ''), 'sconosciuto'), 80), p_prima, p_dopo
    FROM public.shop_orders o WHERE o.id = p_ordine;
END
$$;

-- ── 5. L'ordine nasce: ordine e riservati in UNA transazione, con una lista bianca ──
-- Del p_ordine si copiano SOLO le colonne elencate qui sotto; ogni altra chiave si ignora. Lo stato lo decide la funzione, non il chiamante:
-- status «nuovo», stato_pagamento «in_attesa», canale «sito», rimborsato 0, niente data di pagamento, scade_il = adesso + 60 minuti (shop_s4_scadenza:
-- il «scade_il» eventualmente mandato nel p_ordine si ignora). Lo stesso id due volte → una riga («esistente»). Risponde anche con la scadenza.
-- order_ref è unico fra gli ordini del sito (23505 sul secondo). Le colonne NOT NULL di shop_orders (nome, cognome, email, telefono, indirizzo, citta, cap)
-- le valida la cassa PRIMA di chiamare: qui, se mancano, risponde il database (23502).
CREATE OR REPLACE FUNCTION public.shop_ordine_crea(
  p_ordine    jsonb,
  p_riservati jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id    uuid;
  v_righe integer;
  v_scade timestamptz := public.shop_s4_scadenza();
BEGIN
  IF p_ordine IS NULL OR jsonb_typeof(p_ordine) <> 'object' OR jsonb_typeof(p_ordine -> 'id') IS DISTINCT FROM 'string' THEN
    RAISE EXCEPTION 'ordine_non_valido' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  BEGIN
    v_id := (p_ordine ->> 'id')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'ordine_non_valido' USING ERRCODE = 'invalid_parameter_value';
  END;

  IF NOT EXISTS (SELECT 1 FROM public.shop_orders WHERE id = v_id) THEN
  INSERT INTO public.shop_orders (
    id, order_ref, nome, cognome, email, telefono, indirizzo, citta, cap, provincia, nazione, note, items,
    subtotal, shipping, total, totale_cent, scade_il, chiave_pubblica_hash, firma_tentativo, prova, fattura_richiesta,
    status, stato_pagamento, canale, rimborsato_cent
  ) VALUES (
    v_id, p_ordine ->> 'order_ref', p_ordine ->> 'nome', p_ordine ->> 'cognome', p_ordine ->> 'email', p_ordine ->> 'telefono',
    p_ordine ->> 'indirizzo', p_ordine ->> 'citta', p_ordine ->> 'cap', p_ordine ->> 'provincia', p_ordine ->> 'nazione', p_ordine ->> 'note',
    COALESCE(p_ordine -> 'items', '[]'::jsonb),
    COALESCE((p_ordine ->> 'subtotal')::numeric, 0), COALESCE((p_ordine ->> 'shipping')::numeric, 0), COALESCE((p_ordine ->> 'total')::numeric, 0),
    (p_ordine ->> 'totale_cent')::integer, v_scade, p_ordine ->> 'chiave_pubblica_hash', p_ordine ->> 'firma_tentativo',
    COALESCE((p_ordine ->> 'prova')::boolean, false), COALESCE((p_ordine ->> 'fattura_richiesta')::boolean, false),
    'nuovo', 'in_attesa', 'sito', 0
  )
  ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_righe = ROW_COUNT;
  IF v_righe = 1 THEN
    INSERT INTO public.shop_ordini_riservati (ordine_id, fattura, attribuzione, consensi, ip, user_agent)
    VALUES (
      v_id,
      NULLIF(p_riservati -> 'fattura', 'null'::jsonb), NULLIF(p_riservati -> 'attribuzione', 'null'::jsonb), NULLIF(p_riservati -> 'consensi', 'null'::jsonb),
      p_riservati ->> 'ip', p_riservati ->> 'user_agent'
    );
    PERFORM public.shop_s4_evento(v_id, 'creato', 'cassa', NULL, NULL);
    RETURN jsonb_build_object('esito', 'creato', 'id', v_id, 'scade_il', v_scade);
  END IF;
  END IF;

  -- L'id c'era già (prima, o per una corsa con un'altra richiesta uguale): «esistente» SOLO se è davvero lo stesso ordine del sito
  -- (canale «sito», stesso riferimento, stessa email, stesso totale). Una riga vecchia o altrui con quell'id non si spaccia per la creazione appena fatta.
  SELECT scade_il INTO v_scade FROM public.shop_orders
   WHERE id = v_id AND canale = 'sito' AND order_ref IS NOT DISTINCT FROM (p_ordine ->> 'order_ref')
     AND email IS NOT DISTINCT FROM (p_ordine ->> 'email') AND totale_cent IS NOT DISTINCT FROM (p_ordine ->> 'totale_cent')::integer;
  IF FOUND THEN
    RETURN jsonb_build_object('esito', 'esistente', 'id', v_id, 'scade_il', v_scade);
  END IF;
  RAISE EXCEPTION 'ordine_id_gia_usato' USING ERRCODE = 'unique_violation';
END
$$;

-- ── 6. Le sessioni Stripe dell'ordine ─────────────────────────────────────────
-- Registra la sessione fra quelle dell'ordine e, se l'ordine è «in_attesa», la fa diventare la corrente. La stessa sessione su un ALTRO ordine: 23505.
CREATE OR REPLACE FUNCTION public.shop_ordine_sessione_registra(
  p_ordine   uuid,
  p_sessione text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ordine public.shop_orders%ROWTYPE;
  v_righe  integer;
BEGIN
  SELECT * INTO v_ordine FROM public.shop_orders WHERE id = p_ordine FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ordine_non_trovato' USING ERRCODE = 'no_data_found';
  END IF;
  IF p_sessione IS NULL OR btrim(p_sessione) = '' THEN
    RAISE EXCEPTION 'parametro_non_valido' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO public.shop_stripe_sessioni (sessione_id, ordine_id, scade_il)
  VALUES (p_sessione, v_ordine.id, v_ordine.scade_il)
  ON CONFLICT (sessione_id) DO NOTHING;
  GET DIAGNOSTICS v_righe = ROW_COUNT;
  IF v_righe = 0 AND EXISTS (SELECT 1 FROM public.shop_stripe_sessioni WHERE sessione_id = p_sessione AND ordine_id <> v_ordine.id) THEN
    RAISE EXCEPTION 'sessione_di_un_altro_ordine' USING ERRCODE = 'unique_violation';
  END IF;

  IF v_ordine.stato_pagamento = 'in_attesa' THEN
    UPDATE public.shop_orders SET stripe_sessione_id = p_sessione, aggiornato_il = now() WHERE id = v_ordine.id;
  END IF;
  RETURN jsonb_build_object('esito', CASE WHEN v_righe = 0 THEN 'gia_registrata' ELSE 'registrata' END);
END
$$;

-- ── 7. Pagato: l'UNICO punto in cui un ordine lo diventa (D44) ────────────────
-- Una transazione. Blocco di riga sull'ordine; la sessione dell'evento deve essere una di quelle dell'ordine (se no: avviso, nessun cambio);
-- già pagato → «gia_pagato» (stessa sessione) o avviso rosso «doppio_pagamento» (un'altra); importo ≠ totale_cent o valuta ≠ eur → NON paga, avviso;
-- paga SOLO da in_attesa, scaduto, fallito (da altri stati: errore ordine_non_valido); la giacenza scende riga per riga, ognuna in un SOTTO-BLOCCO:
-- se una riga non basta o lo SKU non si risolve più, l'ordine è pagato lo stesso e finisce «da verificare» (mai un errore che butti la transazione);
-- ordine già annullato → pagato con avviso «pagato_dopo_annullo», giacenza non toccata; da scaduto → avviso «pagato_dopo_scadenza».
-- Risposta: {esito: pagato_ora | gia_pagato | doppio_pagamento | importo_diverso | sessione_sconosciuta | non_trovato, giacenza_da_verificare?}.
CREATE OR REPLACE FUNCTION public.shop_ordine_pagato(
  p_ordine        uuid,
  p_sessione      text,
  p_importo_cent  integer,
  p_valuta        text,
  p_metodo        text,
  p_pagamento_id  text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ordine       public.shop_orders%ROWTYPE;
  v_sess         public.shop_stripe_sessioni%ROWTYPE;
  v_prima        text;
  v_annullato    boolean;
  v_da_verificare boolean;
  v_scalate      integer := 0;
  v_riga         record;
  v_variante     uuid;
  v_qty          integer;
  v_codice       text;
BEGIN
  SELECT * INTO v_ordine FROM public.shop_orders WHERE id = p_ordine FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('esito', 'non_trovato');
  END IF;

  SELECT * INTO v_sess FROM public.shop_stripe_sessioni WHERE sessione_id = p_sessione AND ordine_id = v_ordine.id FOR UPDATE;
  IF NOT FOUND THEN
    PERFORM public.shop_s4_avviso(v_ordine.id, 'sessione_sconosciuta', 'rosso', p_sessione);
    PERFORM public.shop_s4_evento(v_ordine.id, 'sessione_sconosciuta', 'stripe', NULL, jsonb_build_object('sessione', p_sessione));
    RETURN jsonb_build_object('esito', 'sessione_sconosciuta');
  END IF;

  IF v_ordine.stato_pagamento IN ('pagato', 'rimborsato_in_parte', 'rimborsato') THEN
    IF v_sess.stato = 'pagata' THEN
      RETURN jsonb_build_object('esito', 'gia_pagato');
    END IF;
    IF v_sess.stato <> 'doppia' THEN
      UPDATE public.shop_stripe_sessioni SET stato = 'doppia' WHERE sessione_id = v_sess.sessione_id;
      PERFORM public.shop_s4_avviso(v_ordine.id, 'doppio_pagamento', 'rosso', v_sess.sessione_id);
      PERFORM public.shop_s4_evento(v_ordine.id, 'doppio_pagamento', 'stripe', NULL, jsonb_build_object('sessione', v_sess.sessione_id, 'importo_cent', p_importo_cent));
    END IF;
    RETURN jsonb_build_object('esito', 'doppio_pagamento');
  END IF;

  IF v_ordine.stato_pagamento IS NULL OR v_ordine.stato_pagamento NOT IN ('in_attesa', 'scaduto', 'fallito') THEN
    RAISE EXCEPTION 'ordine_non_valido' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_importo_cent IS DISTINCT FROM v_ordine.totale_cent OR lower(COALESCE(p_valuta, '')) <> 'eur' THEN
    v_codice := CASE WHEN p_importo_cent IS DISTINCT FROM v_ordine.totale_cent THEN 'importo_diverso' ELSE 'valuta_diversa' END;
    PERFORM public.shop_s4_avviso(v_ordine.id, v_codice, 'rosso', v_sess.sessione_id);
    PERFORM public.shop_s4_evento(v_ordine.id, v_codice, 'stripe', jsonb_build_object('totale_cent', v_ordine.totale_cent), jsonb_build_object('importo_cent', p_importo_cent, 'valuta', p_valuta));
    RETURN jsonb_build_object('esito', 'importo_diverso');
  END IF;

  v_prima := v_ordine.stato_pagamento;
  v_annullato := v_ordine.status = 'annullato';
  v_da_verificare := v_annullato;

  IF NOT v_annullato THEN
    -- righe in ordine di SKU: due ordini con gli stessi prodotti prendono i blocchi nello stesso ordine
    FOR v_riga IN
      SELECT it ->> 'product_id' AS sku, it -> 'qty' AS qty
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_ordine.items) = 'array' THEN v_ordine.items ELSE '[]'::jsonb END) it
       ORDER BY it ->> 'product_id'
    LOOP
      SELECT id INTO v_variante FROM public.shop_varianti WHERE sku = v_riga.sku;
      IF NOT FOUND OR jsonb_typeof(v_riga.qty) IS DISTINCT FROM 'number' OR (v_riga.qty #>> '{}') !~ '^[0-9]+$' OR (v_riga.qty #>> '{}')::integer < 1 THEN
        v_da_verificare := true;
        CONTINUE;
      END IF;
      v_qty := (v_riga.qty #>> '{}')::integer;
      BEGIN
        PERFORM public.shop_giacenza_muovi(v_variante, -v_qty, 'ordine', NULL, 'stripe', v_ordine.order_ref);
        v_scalate := v_scalate + 1;
      EXCEPTION WHEN OTHERS THEN
        v_da_verificare := true;
      END;
    END LOOP;
  END IF;

  UPDATE public.shop_orders
     SET stato_pagamento = 'pagato',
         pagato_il = now(),
         pagato_importo = p_importo_cent / 100.0,
         metodo_pagamento = 'stripe',
         metodo_dettaglio = p_metodo,
         stripe_sessione_id = v_sess.sessione_id,
         stripe_pagamento_id = COALESCE(NULLIF(p_pagamento_id, ''), stripe_pagamento_id),
         giacenza_da_verificare = v_da_verificare OR COALESCE(giacenza_da_verificare, false),
         giacenza_scalata_il = CASE WHEN v_scalate > 0 THEN now() ELSE giacenza_scalata_il END,
         aggiornato_il = now()
   WHERE id = v_ordine.id;
  UPDATE public.shop_stripe_sessioni SET stato = 'pagata' WHERE sessione_id = v_sess.sessione_id;

  IF v_annullato THEN
    PERFORM public.shop_s4_avviso(v_ordine.id, 'pagato_dopo_annullo', 'rosso', v_sess.sessione_id);
  ELSIF v_da_verificare THEN
    PERFORM public.shop_s4_avviso(v_ordine.id, 'giacenza_da_verificare', 'arancio', v_sess.sessione_id);
  END IF;
  IF v_prima = 'scaduto' THEN
    PERFORM public.shop_s4_avviso(v_ordine.id, 'pagato_dopo_scadenza', 'arancio', v_sess.sessione_id);
  END IF;
  PERFORM public.shop_s4_evento(v_ordine.id, 'pagato', 'stripe', jsonb_build_object('stato_pagamento', v_prima),
    jsonb_build_object('stato_pagamento', 'pagato', 'importo_cent', p_importo_cent, 'sessione', v_sess.sessione_id));
  RETURN jsonb_build_object('esito', 'pagato_ora', 'giacenza_da_verificare', v_da_verificare);
END
$$;

-- ── 8. Chiudere un pagamento non concluso: fallito o scaduto ──────────────────
-- Solo da «in_attesa» e solo per la sessione corrente: l'evento «scaduta» tardivo di una sessione già sostituita dalla riprova NON chiude
-- l'ordine. p_sessione vuota (o nulla) = decisione della cassa: chiude SOLO se `scade_il` è già passato (T53b, nota 1 della revisione di T51). Finché `scade_il`
-- è nel futuro risponde «ignorato»: un secondo clic non richiude l'ordine che il primo ha appena riaperto (due sessioni aperte, n+1 e n+2).
-- Una sessione che non è dell'ordine → «ignorato».
CREATE OR REPLACE FUNCTION public.shop_ordine_chiudi(
  p_ordine   uuid,
  p_sessione text,
  p_stato    text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ordine public.shop_orders%ROWTYPE;
  v_sess   public.shop_stripe_sessioni%ROWTYPE;
  v_con_sessione boolean := p_sessione IS NOT NULL AND btrim(p_sessione) <> '';
BEGIN
  IF p_stato IS NULL OR p_stato NOT IN ('fallito', 'scaduto') THEN
    RAISE EXCEPTION 'stato_non_valido' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT * INTO v_ordine FROM public.shop_orders WHERE id = p_ordine FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('esito', 'non_trovato');
  END IF;

  IF v_con_sessione THEN
    SELECT * INTO v_sess FROM public.shop_stripe_sessioni WHERE sessione_id = p_sessione AND ordine_id = v_ordine.id FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('esito', 'ignorato');
    END IF;
    IF v_sess.stato = 'aperta' THEN
      UPDATE public.shop_stripe_sessioni SET stato = CASE WHEN p_stato = 'fallito' THEN 'fallita' ELSE 'scaduta' END WHERE sessione_id = v_sess.sessione_id;
    END IF;
  END IF;

  IF v_ordine.stato_pagamento IS DISTINCT FROM 'in_attesa'
     OR (v_con_sessione AND v_ordine.stripe_sessione_id IS NOT NULL AND p_sessione <> v_ordine.stripe_sessione_id)
     OR (NOT v_con_sessione AND (v_ordine.scade_il IS NULL OR v_ordine.scade_il >= now())) THEN
    RETURN jsonb_build_object('esito', 'ignorato');
  END IF;

  UPDATE public.shop_orders SET stato_pagamento = p_stato, aggiornato_il = now() WHERE id = v_ordine.id;
  PERFORM public.shop_s4_evento(v_ordine.id, p_stato, 'stripe', jsonb_build_object('stato_pagamento', 'in_attesa'), jsonb_build_object('stato_pagamento', p_stato));
  RETURN jsonb_build_object('esito', 'chiuso');
END
$$;

-- ── 9. «Riprova il pagamento» (D66): riaprire PRIMA di creare la sessione ─────
-- Solo da fallito o scaduto → in_attesa, riprova_n + 1, nuova scadenza; risponde con n e con la scadenza. Un secondo clic insieme trova l'ordine
-- già in attesa (sotto blocco) → «riprova_in_corso». Pagato, rimborsato, da_incassare, vuoto, e QUALUNQUE ordine annullato → ordine_non_riapribile.
-- La nuova scadenza è adesso + 60 minuti (shop_s4_scadenza), come alla creazione: la decide il database, la funzione ha UN solo argomento
-- (chi la chiama con un secondo argomento, come il vecchio p_nuova_scade, riceve «function … does not exist»: nessuna scadenza decisa fuori).
CREATE OR REPLACE FUNCTION public.shop_ordine_riapri(
  p_ordine       uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ordine public.shop_orders%ROWTYPE;
  v_n      integer;
  v_scade  timestamptz;
BEGIN
  SELECT * INTO v_ordine FROM public.shop_orders WHERE id = p_ordine FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ordine_non_trovato' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_ordine.status = 'annullato' THEN
    RAISE EXCEPTION 'ordine_non_riapribile' USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;
  IF v_ordine.stato_pagamento = 'in_attesa' THEN
    RETURN jsonb_build_object('esito', 'riprova_in_corso');
  END IF;
  IF v_ordine.stato_pagamento IS NULL OR v_ordine.stato_pagamento NOT IN ('fallito', 'scaduto') THEN
    RAISE EXCEPTION 'ordine_non_riapribile' USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  UPDATE public.shop_orders
     SET stato_pagamento = 'in_attesa', riprova_n = COALESCE(riprova_n, 0) + 1, scade_il = public.shop_s4_scadenza(), aggiornato_il = now()
   WHERE id = v_ordine.id
  RETURNING riprova_n, scade_il INTO v_n, v_scade;
  PERFORM public.shop_s4_evento(v_ordine.id, 'riaperto', 'cassa', jsonb_build_object('stato_pagamento', v_ordine.stato_pagamento), jsonb_build_object('riprova_n', v_n));
  RETURN jsonb_build_object('esito', 'riaperto', 'n', v_n, 'scade_il', v_scade);
END
$$;

-- ── 10. Gli eventi del webhook: idempotenza ───────────────────────────────────
-- «nuovo» (mai visto), «da_rielaborare» (ricevuto ma non chiuso: crash a metà, si rielabora: le funzioni sono idempotenti), «gia_elaborato».
CREATE OR REPLACE FUNCTION public.shop_stripe_evento_registra(
  p_id     text,
  p_tipo   text,
  p_ordine uuid
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_righe integer;
  v_fatto timestamptz;
BEGIN
  IF p_id IS NULL OR btrim(p_id) = '' THEN
    RAISE EXCEPTION 'parametro_non_valido' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  INSERT INTO public.shop_stripe_eventi (id, tipo, ordine_id) VALUES (p_id, p_tipo, p_ordine) ON CONFLICT (id) DO NOTHING;
  GET DIAGNOSTICS v_righe = ROW_COUNT;
  IF v_righe = 1 THEN
    RETURN 'nuovo';
  END IF;
  SELECT elaborato_il INTO v_fatto FROM public.shop_stripe_eventi WHERE id = p_id;
  RETURN CASE WHEN v_fatto IS NOT NULL THEN 'gia_elaborato' ELSE 'da_rielaborare' END;
END
$$;

-- true se l'evento c'era (e ora è chiuso con la sua data e il suo esito), false se non l'abbiamo mai visto.
CREATE OR REPLACE FUNCTION public.shop_stripe_evento_chiudi(
  p_id    text,
  p_esito text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_righe integer;
BEGIN
  UPDATE public.shop_stripe_eventi SET elaborato_il = now(), esito = p_esito WHERE id = p_id;
  GET DIAGNOSTICS v_righe = ROW_COUNT;
  RETURN v_righe > 0;
END
$$;

-- ── 11. Rimborsi ──────────────────────────────────────────────────────────────
-- Prenota un rimborso SOTTO BLOCCO dell'ordine: il massimo è pagato − (rimborsi «richiesto» + «riuscito»); due richieste insieme che insieme
-- superano il pagato → una sola passa. La stessa chiave_richiesta (doppio clic) rimanda alla riga che c'è, ma SOLO se è di questo ordine:
-- la chiave di un altro ordine è un errore. Solo su ordini pagati (anche già rimborsati in parte o del tutto).
CREATE OR REPLACE FUNCTION public.shop_rimborso_prenota(
  p_ordine       uuid,
  p_importo_cent integer,
  p_motivo       text,
  p_chiave       text,
  p_chi          text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ordine   public.shop_orders%ROWTYPE;
  v_gia      public.shop_rimborsi%ROWTYPE;
  v_impegnato integer;
  v_pagato   integer;
  v_id       uuid;
BEGIN
  SELECT * INTO v_ordine FROM public.shop_orders WHERE id = p_ordine FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ordine_non_trovato' USING ERRCODE = 'no_data_found';
  END IF;
  IF p_importo_cent IS NULL OR p_importo_cent <= 0 OR btrim(COALESCE(p_motivo, '')) = '' OR btrim(COALESCE(p_chiave, '')) = '' THEN
    RAISE EXCEPTION 'rimborso_importo_non_valido' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT * INTO v_gia FROM public.shop_rimborsi WHERE chiave_richiesta = p_chiave;
  IF FOUND THEN
    IF v_gia.ordine_id <> v_ordine.id THEN
      RAISE EXCEPTION 'rimborso_chiave_altro_ordine' USING ERRCODE = 'unique_violation';
    END IF;
    RETURN jsonb_build_object('esito', 'esistente', 'id', v_gia.id);
  END IF;

  IF v_ordine.stato_pagamento IS NULL OR v_ordine.stato_pagamento NOT IN ('pagato', 'rimborsato_in_parte', 'rimborsato') THEN
    RAISE EXCEPTION 'ordine_non_pagato' USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  SELECT COALESCE(sum(importo_cent), 0) INTO v_impegnato FROM public.shop_rimborsi WHERE ordine_id = v_ordine.id AND stato IN ('richiesto', 'riuscito');
  v_pagato := round(COALESCE(v_ordine.pagato_importo, 0) * 100)::integer;
  IF p_importo_cent > v_pagato - v_impegnato THEN
    RAISE EXCEPTION 'rimborso_oltre_pagato' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.shop_rimborsi (ordine_id, importo_cent, motivo, stato, chiave_richiesta, origine, chi)
  VALUES (v_ordine.id, p_importo_cent, p_motivo, 'richiesto', p_chiave, 'crm', left(COALESCE(NULLIF(btrim(p_chi), ''), 'sconosciuto'), 80))
  RETURNING id INTO v_id;
  PERFORM public.shop_s4_evento(v_ordine.id, 'rimborso_richiesto', p_chi, NULL, jsonb_build_object('importo_cent', p_importo_cent, 'riga', v_id));
  RETURN jsonb_build_object('esito', 'prenotato', 'id', v_id);
END
$$;

-- Riconcilia dall'ELENCO che Stripe dà (D46): p_rimborsi = [{id, amount, status, metadata: {riga_id}}]. Una riga nostra si aggancia per stripe_rimborso_id o per
-- metadata.riga_id; un rimborso che non conosciamo (fatto dal pannello di Stripe) diventa una riga con origine «stripe». rimborsato_cent = somma dei «riuscito»;
-- lo stato dell'ordine segue (rimborsato_in_parte / rimborsato / di nuovo pagato). Con p_chiudi_orfane: una riga «richiesto» senza rimborso su Stripe da più di
-- 10 minuti diventa «fallito» (libera il massimo).
CREATE OR REPLACE FUNCTION public.shop_rimborso_riconcilia(
  p_ordine         uuid,
  p_rimborsi       jsonb,
  p_chiudi_orfane  boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ordine      public.shop_orders%ROWTYPE;
  v_s           jsonb;
  v_id_stripe   text;
  v_importo     integer;
  v_stato       text;
  v_riga        uuid;
  v_agganciate  uuid[] := ARRAY[]::uuid[];
  v_rimborsato  integer;
  v_pagato      integer;
  v_nuovo       text;
BEGIN
  SELECT * INTO v_ordine FROM public.shop_orders WHERE id = p_ordine FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ordine_non_trovato' USING ERRCODE = 'no_data_found';
  END IF;
  IF p_rimborsi IS NULL OR jsonb_typeof(p_rimborsi) <> 'array' THEN
    RAISE EXCEPTION 'parametro_non_valido' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOR v_s IN SELECT x FROM jsonb_array_elements(p_rimborsi) x LOOP
    IF jsonb_typeof(v_s -> 'id') IS DISTINCT FROM 'string' OR jsonb_typeof(v_s -> 'amount') IS DISTINCT FROM 'number'
       OR (v_s ->> 'amount') !~ '^[0-9]+$' OR (v_s ->> 'amount')::integer <= 0 THEN
      CONTINUE;
    END IF;
    v_id_stripe := v_s ->> 'id';
    v_importo := (v_s ->> 'amount')::integer;
    v_stato := CASE v_s ->> 'status' WHEN 'succeeded' THEN 'riuscito' WHEN 'failed' THEN 'fallito' WHEN 'canceled' THEN 'fallito' ELSE 'richiesto' END;

    SELECT id INTO v_riga FROM public.shop_rimborsi
     WHERE ordine_id = v_ordine.id AND (stripe_rimborso_id = v_id_stripe OR (((v_s -> 'metadata') ->> 'riga_id') IS NOT NULL AND id::text = ((v_s -> 'metadata') ->> 'riga_id')))
     ORDER BY (stripe_rimborso_id = v_id_stripe) DESC NULLS LAST
     LIMIT 1;
    IF FOUND THEN
      v_agganciate := v_agganciate || v_riga;
      UPDATE public.shop_rimborsi SET stripe_rimborso_id = v_id_stripe, stato = v_stato, aggiornato_il = now() WHERE id = v_riga;
    ELSE
      INSERT INTO public.shop_rimborsi (ordine_id, importo_cent, motivo, stato, chiave_richiesta, stripe_rimborso_id, origine, chi)
      VALUES (v_ordine.id, v_importo, 'Rimborso fatto dal pannello di Stripe', v_stato, NULL, v_id_stripe, 'stripe', 'stripe');
    END IF;
  END LOOP;

  IF p_chiudi_orfane IS TRUE THEN
    UPDATE public.shop_rimborsi SET stato = 'fallito', aggiornato_il = now()
     WHERE ordine_id = v_ordine.id AND stato = 'richiesto' AND stripe_rimborso_id IS NULL
       AND id <> ALL (v_agganciate) AND now() - creato_il > interval '10 minutes';
  END IF;

  SELECT COALESCE(sum(importo_cent), 0) INTO v_rimborsato FROM public.shop_rimborsi WHERE ordine_id = v_ordine.id AND stato = 'riuscito';
  v_pagato := round(COALESCE(v_ordine.pagato_importo, 0) * 100)::integer;
  v_nuovo := CASE
    WHEN v_ordine.stato_pagamento IS NULL OR v_ordine.stato_pagamento NOT IN ('pagato', 'rimborsato_in_parte', 'rimborsato') THEN v_ordine.stato_pagamento
    WHEN v_rimborsato >= v_pagato AND v_rimborsato > 0 THEN 'rimborsato'
    WHEN v_rimborsato > 0 THEN 'rimborsato_in_parte'
    ELSE 'pagato'
  END;
  IF v_ordine.rimborsato_cent IS DISTINCT FROM v_rimborsato OR v_ordine.stato_pagamento IS DISTINCT FROM v_nuovo THEN
    UPDATE public.shop_orders SET rimborsato_cent = v_rimborsato, stato_pagamento = v_nuovo, aggiornato_il = now() WHERE id = v_ordine.id;
  END IF;
  RETURN jsonb_build_object('rimborsato_cent', v_rimborsato, 'stato_pagamento', v_nuovo);
END
$$;

-- ── 12. Rimettere in magazzino (annullo con «rimetti») ────────────────────────
-- Rimette SOLO ciò che i movimenti dell'ordine (ordine_ref, motivo «ordine») dicono di aver tolto: mai tutte le righe, così nessuna scorta fantasma dopo
-- un annullo con una riga non scalata. Una volta sola (giacenza_rimessa_il): il tasto premuto due volte non rimette due volte.
CREATE OR REPLACE FUNCTION public.shop_ordine_giacenza_rimetti(
  p_ordine uuid,
  p_chi    text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ordine public.shop_orders%ROWTYPE;
  v_riga   record;
  v_pezzi  integer := 0;
BEGIN
  SELECT * INTO v_ordine FROM public.shop_orders WHERE id = p_ordine FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ordine_non_trovato' USING ERRCODE = 'no_data_found';
  END IF;
  IF v_ordine.giacenza_rimessa_il IS NOT NULL THEN
    RETURN jsonb_build_object('esito', 'gia_rimessa', 'pezzi', 0);
  END IF;

  FOR v_riga IN
    SELECT variante_id, (-sum(delta))::integer AS qty
      FROM public.shop_giacenza_movimenti
     WHERE ordine_ref = v_ordine.order_ref AND motivo = 'ordine'
     GROUP BY variante_id
    HAVING -sum(delta) > 0
     ORDER BY variante_id
  LOOP
    PERFORM public.shop_giacenza_muovi(v_riga.variante_id, v_riga.qty, 'annullo_ordine', NULL, p_chi, v_ordine.order_ref);
    v_pezzi := v_pezzi + v_riga.qty;
  END LOOP;

  UPDATE public.shop_orders SET giacenza_rimessa_il = now(), aggiornato_il = now() WHERE id = v_ordine.id;
  PERFORM public.shop_s4_evento(v_ordine.id, 'giacenza_rimessa', p_chi, NULL, jsonb_build_object('pezzi', v_pezzi));
  RETURN jsonb_build_object('esito', 'rimessa', 'pezzi', v_pezzi);
END
$$;

-- ── 12b. Un rimborso che Stripe ha rifiutato davvero (T53b) ───────────────────
-- Il CRM ha prenotato la riga («richiesto») e ha chiesto il rimborso a Stripe, che ha detto no (richiesta rifiutata: nessun rimborso esiste). La riga passa a
-- «fallito» (il massimo si libera) SENZA scrivere un id Stripe (non ce n'è uno: un id inventato sarebbe un falso nel registro dei soldi) e con un evento nello
-- storico. Agisce SOLO su una riga «richiesto» che non ha ancora un id Stripe: un rimborso «riuscito», o «richiesto» ma già conosciuto da Stripe (ha un id: potrebbe
-- riuscire), non si tocca mai. Ripetuta: «ignorato», nessun evento in più. Stesso ordine di blocco di prenota e riconcilia: prima l'ordine, poi la riga.
-- Il codice di Stripe si scrive nello storico solo se è un codice (lettere, cifre, «_», «.», «-», al massimo 64): ogni altra cosa diventa «sconosciuto», così nello
-- storico non può finire testo libero. Non ricalcola lo stato di pagamento: contano solo i rimborsi «riusciti».
CREATE OR REPLACE FUNCTION public.shop_rimborso_rifiuta(
  p_rimborso uuid,
  p_codice   text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ordine_id uuid;
  v_riga      public.shop_rimborsi%ROWTYPE;
  v_codice    text;
BEGIN
  SELECT ordine_id INTO v_ordine_id FROM public.shop_rimborsi WHERE id = p_rimborso;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rimborso_non_trovato' USING ERRCODE = 'no_data_found';
  END IF;
  PERFORM 1 FROM public.shop_orders WHERE id = v_ordine_id FOR UPDATE;
  SELECT * INTO v_riga FROM public.shop_rimborsi WHERE id = p_rimborso FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'rimborso_non_trovato' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_riga.stato = 'richiesto' AND v_riga.stripe_rimborso_id IS NULL THEN
    v_codice := CASE WHEN p_codice IS NOT NULL AND p_codice ~ '^[A-Za-z0-9_.-]{1,64}$' THEN p_codice ELSE 'sconosciuto' END;
    UPDATE public.shop_rimborsi SET stato = 'fallito', aggiornato_il = now() WHERE id = v_riga.id;
    PERFORM public.shop_s4_evento(v_riga.ordine_id, 'rimborso_rifiutato', 'stripe', NULL, jsonb_build_object('riga', v_riga.id, 'codice', v_codice));
    RETURN jsonb_build_object('esito', 'rifiutato', 'id', v_riga.id);
  END IF;
  RETURN jsonb_build_object('esito', 'ignorato', 'stato', v_riga.stato);
END
$$;

-- ── 12c. Riattivare un ordine annullato (T53b) ────────────────────────────────
-- «annullato → nuovo» con un motivo. Sotto il blocco dell'ordine, lo stesso di prenota: se un rimborso è «richiesto» o «riuscito», o `rimborsato_cent` è maggiore di zero,
-- o lo stato di pagamento è già rimborsato (anche in parte), NON si riattiva (`rimborso_attivo`): o il rimborso c'è e la riattivazione è rifiutata, o l'ordine è già
-- «nuovo» e il rimborso nasce dopo; mai un ordine annullato con un rimborso nato dopo la lettura. Un ordine che non è (più) annullato → «cambiato», niente scritto.
-- Riporta `status` a «nuovo», azzera motivo e data di annullo; `giacenza_da_verificare` diventa vero solo se i pezzi erano stati rimessi in magazzino (l'ordine
-- annullato li aveva ridati: chi lo riattiva deve ricontare). Non tocca pagamento, sessioni, giacenza né email. Lo storico (`stato_corretto`, con chi e motivo) lo
-- scrive la funzione, nella stessa transazione.
CREATE OR REPLACE FUNCTION public.shop_ordine_riattiva(
  p_ordine  uuid,
  p_motivo  text,
  p_chi     text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ordine public.shop_orders%ROWTYPE;
  v_da_verificare boolean;
BEGIN
  SELECT * INTO v_ordine FROM public.shop_orders WHERE id = p_ordine FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ordine_non_trovato' USING ERRCODE = 'no_data_found';
  END IF;
  IF btrim(COALESCE(p_motivo, '')) = '' THEN
    RAISE EXCEPTION 'motivo_obbligatorio' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_ordine.status IS DISTINCT FROM 'annullato' THEN
    RETURN jsonb_build_object('esito', 'cambiato');
  END IF;
  IF EXISTS (SELECT 1 FROM public.shop_rimborsi WHERE ordine_id = v_ordine.id AND stato IN ('richiesto', 'riuscito'))
     OR COALESCE(v_ordine.rimborsato_cent, 0) > 0
     OR v_ordine.stato_pagamento IN ('rimborsato', 'rimborsato_in_parte') THEN
    RAISE EXCEPTION 'rimborso_attivo' USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;

  v_da_verificare := COALESCE(v_ordine.giacenza_da_verificare, false) OR v_ordine.giacenza_rimessa_il IS NOT NULL;
  UPDATE public.shop_orders
     SET status = 'nuovo', annullo_motivo = NULL, annullato_il = NULL, giacenza_da_verificare = v_da_verificare, aggiornato_il = now()
   WHERE id = v_ordine.id;
  PERFORM public.shop_s4_evento(v_ordine.id, 'stato_corretto', p_chi, jsonb_build_object('stato', 'annullato'),
    jsonb_build_object('stato', 'nuovo', 'motivo', left(btrim(p_motivo), 500)));
  RETURN jsonb_build_object('esito', 'riattivato', 'giacenza_da_verificare', v_da_verificare);
END
$$;

-- ── 13. Il limite per impronta (D49): atomico, una riga per chiave, NESSUNA cancellazione ──
-- true se la richiesta passa. Finestra scaduta → la stessa riga riparte da 1 (INSERT … ON CONFLICT DO UPDATE). Oltre il massimo → false e il conteggio non cresce.
CREATE OR REPLACE FUNCTION public.shop_limite_consuma(
  p_chiave     text,
  p_finestra_s integer,
  p_max        integer
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ora      timestamptz := now();
  v_finestra interval;
  v_righe    integer;
BEGIN
  IF p_chiave IS NULL OR btrim(p_chiave) = '' OR p_finestra_s IS NULL OR p_finestra_s <= 0 OR p_max IS NULL OR p_max <= 0 THEN
    RAISE EXCEPTION 'limite_non_valido' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  v_finestra := make_interval(secs => p_finestra_s);

  INSERT INTO public.shop_limiti AS l (chiave, finestra_inizio, conteggio)
  VALUES (p_chiave, v_ora, 1)
  ON CONFLICT (chiave) DO UPDATE SET
    finestra_inizio = CASE WHEN l.finestra_inizio <= v_ora - v_finestra THEN v_ora ELSE l.finestra_inizio END,
    conteggio = CASE WHEN l.finestra_inizio <= v_ora - v_finestra THEN 1 ELSE l.conteggio + 1 END
  WHERE l.finestra_inizio <= v_ora - v_finestra OR l.conteggio < p_max;
  GET DIAGNOSTICS v_righe = ROW_COUNT;
  RETURN v_righe > 0;
END
$$;

-- ── 14. La lettura della cassa: l'UNICA che vede la giacenza fuori dal CRM ────
-- Per ogni SKU di VARIANTE chiesto: sku, slug del prodotto, nome, nome della variante, prezzo effettivo in centesimi (la variante, o in mancanza il prodotto),
-- se la variante è attiva, se il prodotto è pubblicato, la giacenza. Nell'ordine chiesto, senza doppioni; gli SKU che non ci sono mancano.
CREATE OR REPLACE FUNCTION public.shop_cassa_righe(
  p_skus text[]
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_skus IS NULL THEN
    RAISE EXCEPTION 'parametro_non_valido' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'sku', v.sku, 'slug', p.slug, 'nome', p.nome, 'nome_variante', v.nome,
             'prezzo_cent', COALESCE(v.prezzo_cent, p.prezzo_cent), 'attiva', v.attiva, 'pubblicato', p.stato = 'pubblicato', 'giacenza', v.giacenza
           ) ORDER BY x.posto)
      FROM (SELECT u.sku, min(u.posto) AS posto FROM unnest(p_skus) WITH ORDINALITY AS u(sku, posto) WHERE u.sku IS NOT NULL GROUP BY u.sku) x
      JOIN public.shop_varianti v ON v.sku = x.sku
      JOIN public.shop_prodotti p ON p.id = v.prodotto_id
  ), '[]'::jsonb);
END
$$;

-- ── 15. Le funzioni le esegue solo il server (service_role) ───────────────────
REVOKE ALL ON FUNCTION public.shop_s4_avviso(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_s4_evento(uuid, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_s4_scadenza() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_ordine_crea(jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_ordine_sessione_registra(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_ordine_pagato(uuid, text, integer, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_ordine_chiudi(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_ordine_riapri(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_stripe_evento_registra(text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_stripe_evento_chiudi(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_rimborso_prenota(uuid, integer, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_rimborso_riconcilia(uuid, jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_ordine_giacenza_rimetti(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_limite_consuma(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_cassa_righe(text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_rimborso_rifiuta(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_ordine_riattiva(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_s4_avviso(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_s4_evento(uuid, text, text, jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_s4_scadenza() TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_ordine_crea(jsonb, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_ordine_sessione_registra(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_ordine_pagato(uuid, text, integer, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_ordine_chiudi(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_ordine_riapri(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_stripe_evento_registra(text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_stripe_evento_chiudi(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_rimborso_prenota(uuid, integer, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_rimborso_riconcilia(uuid, jsonb, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_ordine_giacenza_rimetti(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_limite_consuma(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_cassa_righe(text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_rimborso_rifiuta(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_ordine_riattiva(uuid, text, text) TO service_role;

-- ── 16. I tre interruttori di partenza (mai riscritti se già presenti) ───────
INSERT INTO public.shop_impostazioni (chiave, valore)
VALUES ('cassa_sito', '"vecchia"'::jsonb), ('pagamento_sicuro', 'false'::jsonb), ('metodi_pagamento', '[]'::jsonb)
ON CONFLICT (chiave) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
