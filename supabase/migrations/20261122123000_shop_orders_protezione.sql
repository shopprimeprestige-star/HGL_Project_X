-- ─────────────────────────────────────────────────────────────────────────────
-- SHOP · S4b · IL TRIGGER DI PROTEZIONE DI shop_orders (LISTA BIANCA)
--
-- Commessa 2026-11-20-shop-completo (PIANO-R2.md §4 «S4b» e D43, compito T41b, Rilascio 2).
-- La applica il TITOLARE, a mano, dal SQL Editor di Supabase, SUBITO DOPO S4 (nello stesso passo,
-- prima di pubblicare il codice del Rilascio 2). La squadra non la lancia mai e non usa
-- «supabase db push» su questo file.
--
-- ORDINE DELLE MIGRAZIONI: M1 → S1 / S2 / D40 / S3 (Rilascio 1) → S4 → S4b (questa) → S5 → S6.
--
-- ⚠️ SUBITO DOPO AVERLA APPLICATA: fai un ORDINE DI PROVA dalla cassa vecchia, da una finestra anonima
--    del browser (nome «PROVA-ELIMINARE», dati inventati), e guarda che compaia in Table Editor.
--    Se NON compare, esegui il RIPRISTINO qui sotto (una riga) e avvisa la squadra: è l'unica parte del
--    Rilascio 2 che può fermare la cassa di oggi, ed è in un file suo apposta per isolare l'errore.
--
-- COSA FA (solo aggiunte)
--   0. CONTROLLO INIZIALE: se S4 (20261122120000_shop_pagamenti.sql) non è applicata, o il server non è
--      almeno un Postgres 14, il file SI FERMA con un messaggio chiaro, senza scrivere niente.
--   1. Crea la funzione public.shop_orders_protezione() (SECURITY DEFINER, search_path = public) e il trigger
--      shop_orders_protezione (BEFORE INSERT OR UPDATE, per riga) su public.shop_orders. Agisce SOLO quando
--      chi scrive è un browser: ruolo «anon» o «authenticated» (letto da auth.role(), cioè dal token della
--      richiesta, e dal ruolo della sessione). Il server (service_role), le funzioni di S4 chiamate dal server e
--      il proprietario del database (SQL Editor) passano SEMPRE, senza nessun controllo.
--   2. Per il browser, a LISTA BIANCA (il corpo guarda to_jsonb(NEW) e to_jsonb(OLD) chiave per chiave: una
--      colonna aggiunta in futuro nasce protetta, senza toccare questo file):
--        · UPDATE: si possono cambiare SOLO note_interne e aggiornato_il. Qualunque altra colonna, vecchia o
--          nuova o futura (pagato_il, pagato_importo, status, tracking, items, email, stato_pagamento…) →
--          errore 42501 e niente cambia. (Chi riscrive un valore uguale a quello di prima non cambia niente: passa.)
--        · INSERT: passano le colonne che scrive il checkout di oggi (le chiavi di rigaOrdine in
--          src/shop/invio-ordine.ts più created_at: elenco v_ammesse qui sotto). Ogni ALTRA colonna deve valere il suo
--          valore di partenza (tabella v_partenza: vuoto, false, 0, {} o []): un ordine «pagato», «di prova»,
--          del «canale» sito, con un totale in centesimi o con avvisi, scritto da un browser → 42501.
--        · CASSA STRIPE ATTIVA: con l'interruttore cassa_sito = «stripe» nessun insert dal browser (SPEC §13): gli
--          ordini di quella cassa li crea solo il server. Con «vecchia» (o qualunque altro valore) l'insert di
--          oggi torna a passare. Se shop_impostazioni non risponde (tabella assente, errore) l'insert passa come
--          oggi: la lettura dell'interruttore fallisce APERTA; le regole sulle colonne falliscono CHIUSE.
--   3. NON nomina colonne a mano salvo tre punti, tutti qui sotto: note_interne e aggiornato_il (la lista bianca
--      dell'UPDATE), v_ammesse (la lista bianca dell'INSERT, uguale alle chiavi di rigaOrdine: la prova del repo
--      le confronta) e v_partenza (la tabella dei valori di partenza dell'INSERT). Non nomina pagato_il: se M1 non
--      ci fosse la funzione non si romperebbe (S4 si ferma comunque senza M1).
--
-- COSA NON FA
--   · Nessuna policy cambia, né creata né tolta (la policy stretta di M1 sull'insert resta com'è, e lavora insieme a
--     questo trigger). Nessun permesso cambia (i REVOKE e GRANT di colonna di S4 restano). Nessuna riga viene toccata.
--   · Non tocca le letture. Non scatta su DELETE (il browser non può cancellare: nessuna policy). Non scatta per il server.
--   · Non chiude la lettura di shop_orders agli account autenticati: la chiude, se vuoi, M2 (ORDINI-SOLO-SERVER.sql),
--     consigliata a fine collaudo.
--   · Nessun DELETE, DROP o TRUNCATE in nessun punto eseguito (il ripristino è solo nel commento qui sotto).
--
-- LANCIARLA DUE VOLTE NON FA DANNI (CREATE OR REPLACE FUNCTION; CREATE OR REPLACE TRIGGER, che sostituisce il
-- trigger con lo stesso nome senza toglierlo prima). shortcut: CREATE OR REPLACE TRIGGER vuole Postgres 14 o più
-- (Supabase ha 15+): il controllo iniziale lo verifica / se mai servisse un Postgres più vecchio, togliere il trigger
-- a mano e crearlo con CREATE TRIGGER.
--
-- COME SI ANNULLA (una riga, dal SQL Editor; la funzione resta ma senza trigger non fa niente):
--   DROP TRIGGER IF EXISTS shop_orders_protezione ON public.shop_orders;
-- (Senza il trigger, S4 da sola resta quella di prima: il browser non scrive le colonne nuove per i permessi di colonna
--  di S4, ma può di nuovo cambiare le colonne di prima da un account autenticato, come oggi.)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 0. Controllo iniziale: senza S4 non si scrive niente ─────────────────────
DO $$
BEGIN
  IF to_regclass('public.shop_orders') IS NULL
     OR to_regclass('public.shop_ordini_riservati') IS NULL
     OR NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('public.shop_orders') AND attname = 'stato_pagamento' AND NOT attisdropped) THEN
    RAISE EXCEPTION 'S4b si ferma: manca la migrazione S4 (supabase/migrations/20261122120000_shop_pagamenti.sql). Applicala prima; questo file non ha scritto niente.';
  END IF;
  IF current_setting('server_version_num')::integer < 140000 THEN
    RAISE EXCEPTION 'S4b si ferma: serve Postgres 14 o più (CREATE OR REPLACE TRIGGER); questo server è il %. Questo file non ha scritto niente.', current_setting('server_version');
  END IF;
END
$$;

-- ── 1. La funzione del trigger ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.shop_orders_protezione() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  -- Le colonne che il checkout di oggi scrive (= le chiavi di rigaOrdine in src/shop/invio-ordine.ts) più created_at (lo mette il database).
  v_ammesse  text[] := ARRAY['id', 'order_ref', 'nome', 'cognome', 'email', 'telefono', 'indirizzo', 'citta', 'cap', 'note', 'items', 'subtotal', 'shipping', 'total', 'status', 'created_at'];
  -- Il valore che ogni ALTRA colonna deve avere in un insert dal browser: quello di partenza. Le colonne che non stanno qui devono essere vuote (null).
  v_partenza jsonb := '{"senza_lead": false, "prova": false, "rimborsato_cent": 0, "riprova_n": 0, "giacenza_da_verificare": false, "fattura_richiesta": false, "email_inviate": {}, "avvisi": []}'::jsonb;
  v_ruolo    text := auth.role();
  v_cassa    text;
  v_nuovo    jsonb;
  v_vecchio  jsonb;
  v_chiave   text;
BEGIN
  -- Solo il browser: il token dice «anon» o «authenticated» (o, se il token manca, lo dice il ruolo della sessione). Server, funzioni e proprietario passano.
  IF NOT (COALESCE(v_ruolo, '') IN ('anon', 'authenticated') OR COALESCE(current_setting('role', true), '') IN ('anon', 'authenticated')) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- La cassa Stripe è accesa: gli ordini li crea solo il server. La lettura fallisce APERTA: se l'interruttore non si legge, l'insert di oggi passa.
    BEGIN
      SELECT valore #>> '{}' INTO v_cassa FROM public.shop_impostazioni WHERE chiave = 'cassa_sito';
    EXCEPTION WHEN OTHERS THEN
      v_cassa := NULL;
    END;
    IF v_cassa = 'stripe' THEN
      RAISE EXCEPTION 'ordine_non_ammesso: con la cassa Stripe attiva gli ordini li crea solo il server' USING ERRCODE = 'insufficient_privilege';
    END IF;

    v_nuovo := to_jsonb(NEW);
    FOR v_chiave IN SELECT jsonb_object_keys(v_nuovo) LOOP
      IF v_chiave = ANY (v_ammesse) THEN
        CONTINUE;
      END IF;
      IF v_nuovo -> v_chiave IS DISTINCT FROM COALESCE(v_partenza -> v_chiave, 'null'::jsonb) THEN
        RAISE EXCEPTION 'colonna_protetta: «%» non si scrive dal browser', v_chiave USING ERRCODE = 'insufficient_privilege';
      END IF;
    END LOOP;
    RETURN NEW;
  END IF;

  -- UPDATE: dal browser cambiano solo le note interne e la data di aggiornamento. Tutto il resto (anche una colonna di domani) deve restare com'era.
  v_nuovo := to_jsonb(NEW) - 'note_interne' - 'aggiornato_il';
  v_vecchio := to_jsonb(OLD) - 'note_interne' - 'aggiornato_il';
  FOR v_chiave IN SELECT jsonb_object_keys(v_nuovo) LOOP
    IF v_nuovo -> v_chiave IS DISTINCT FROM v_vecchio -> v_chiave THEN
      RAISE EXCEPTION 'colonna_protetta: «%» non si cambia dal browser', v_chiave USING ERRCODE = 'insufficient_privilege';
    END IF;
  END LOOP;
  RETURN NEW;
END
$$;

-- Una funzione di trigger non serve a nessuno da chiamare a mano: nessun permesso di esecuzione. (Il trigger scatta lo stesso: per farlo scattare non serve EXECUTE.)
REVOKE ALL ON FUNCTION public.shop_orders_protezione() FROM PUBLIC, anon, authenticated;

-- ── 2. Il trigger (sostituisce se stesso, non tocca altro) ────────────────────
CREATE OR REPLACE TRIGGER shop_orders_protezione
  BEFORE INSERT OR UPDATE ON public.shop_orders
  FOR EACH ROW EXECUTE FUNCTION public.shop_orders_protezione();

COMMIT;
