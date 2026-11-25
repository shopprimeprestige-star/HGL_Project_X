-- ─────────────────────────────────────────────────────────────────────────────
-- SHOP · EDITOR PRODOTTI · IL COSTO DELLA VARIANTE E L'IMPORT DA CSV
--
-- Commessa 2026-11-25-editor-prodotti (PIANO.md §1.1 e §4, compito E1).
-- La applica il CAPO PROGETTO (o il titolare), a mano, dal SQL Editor di Supabase. La squadra non la
-- lancia mai e non usa «supabase db push» su questo file.
--
-- COSA FA (solo aggiunte: nessuna riga e nessuna tabella esistente viene toccata)
--   1. Aggiunge la colonna shop_varianti.costo_cent (centesimi interi, vuota o >= 0). Vuota per tutte le
--      righe che ci sono già. È un dato interno: le quattro viste shop_v_* elencano le colonne una per
--      una e NON si toccano, quindi il costo non esce mai sul sito.
--   2. Crea la funzione shop_import_prodotto(p_prodotto, p_varianti, p_categorie, p_chi): UN prodotto con le
--      sue varianti, i legami con le categorie, i movimenti di giacenza e le righe di storico, in UNA
--      transazione. Il progetto non cancella mai niente: un import fermato a metà non si potrebbe
--      riparare, quindi «o entra intero o non entra» lo garantisce il database. Solo service_role.
--
-- REGOLE DELLA FUNZIONE (l'ultima difesa: il server controlla già tutto prima, ma qui non ci si fida)
--   · Lo stato è SEMPRE «bozza», scritto dalla funzione: dall'input non si legge mai (e nemmeno id, canali,
--     origine, id_codice, correlato_id). I campi si leggono UNO PER UNO, mai con un'estrazione a record.
--   · La giacenza entra solo come movimento «carico» con nota «Import CSV» (funzione shop_giacenza_muovi).
--   · Esce sempre un oggetto, mai un errore per i casi attesi:
--       {esito:"creato", prodotto_id, varianti:[{sku, id}]}
--       {esito:"gia_presente", prodotto_id, nome}            l'indirizzo (slug) esiste già
--       {esito:"sku_usato", sku, prodotto_nome}              lo SKU è di un altro prodotto o di un'altra variante
--       {esito:"non_valido", motivo}                         motivo = una sigla; per errori del database il codice SQLSTATE
--     Il messaggio del database NON esce (può contenere valori): niente di scritto resta in nessun caso.
--   · Rifiuta da sola: più di 50 varianti o nessuna, più di 10 categorie, due varianti con lo stesso SKU,
--     prezzo e costo oltre 2147483647, peso e giacenza oltre 1000000, testi oltre i massimi della scheda.
--   · Una sola importazione alla volta (blocco di consultazione): due persone con lo stesso file non fanno doppioni.
--
-- COSA NON FA
--   Non tocca nessuna riga che esiste già, non pubblica, non tocca ordini, lead, indirizzi, foto né le viste.
--   Nessuna cancellazione di dati, nessuna modifica di righe esistenti: solo ADD COLUMN IF NOT EXISTS,
--   CREATE OR REPLACE FUNCTION e i permessi della funzione.
--
-- ORDINE: dopo S1 (20261120120000_shop_catalogo.sql) e dopo tutte le altre migrazioni del negozio.
-- Può essere lanciata prima o dopo la pubblicazione del codice: senza di lei la scheda tiene spento il
-- campo del costo e l'import dice «Per importare serve un aggiornamento del database».
--
-- LANCIARLA DUE VOLTE NON FA DANNI (colonna con IF NOT EXISTS, funzione con OR REPLACE).
--
-- VERIFICA, dopo averla applicata (in sola lettura):
--   SELECT count(*) FROM public.shop_prodotti;                                  → 33 (come prima)
--   SELECT count(*) FROM public.shop_varianti WHERE costo_cent IS NOT NULL;     → 0
--   SELECT has_function_privilege('anon', 'public.shop_import_prodotto(jsonb, jsonb, uuid[], text)', 'EXECUTE');          → false
--   SELECT has_function_privilege('authenticated', 'public.shop_import_prodotto(jsonb, jsonb, uuid[], text)', 'EXECUTE'); → false
--   SELECT has_function_privilege('service_role', 'public.shop_import_prodotto(jsonb, jsonb, uuid[], text)', 'EXECUTE');  → true
--
-- COME SI ANNULLA: non serve. È solo aggiunta: la colonna vuota e la funzione chiusa a tutti tranne al server
-- non cambiano niente di ciò che il sito o il CRM fanno oggi. Non esiste uno script che toglie: se un domani
-- servisse, si scrive a parte e si legge prima.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Il costo della variante ───────────────────────────────────────────────
-- Centesimi interi, come i prezzi. Vuoto = non scritto. Solo il CRM lo legge.
ALTER TABLE public.shop_varianti
  ADD COLUMN IF NOT EXISTS costo_cent integer CHECK (costo_cent IS NULL OR costo_cent >= 0);

-- ── 2. L'import di UN prodotto, tutto o niente ───────────────────────────────
-- p_prodotto: sku, slug, nome, tipo, prezzo_cent, marca, descrizione_breve, descrizione_lunga, categoria_google,
--             fornitore, seo_titolo, seo_descrizione, peso_g, gtin, nota_titolare
-- p_varianti: [{sku, nome, opzioni, prezzo_cent|null, peso_g|null, gtin|null, costo_cent|null, giacenza, ordine}]
-- p_categorie: id di categorie che esistono già (una che non esiste = errore del database = non_valido, niente scritto)
-- p_chi: chi importa, dato dalla guardia del server (mai dal corpo della richiesta del browser)
CREATE OR REPLACE FUNCTION public.shop_import_prodotto(
  p_prodotto   jsonb,
  p_varianti   jsonb,
  p_categorie  uuid[],
  p_chi        text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_chi         text := left(COALESCE(NULLIF(btrim(p_chi), ''), 'sconosciuto'), 80);
  v_motivo      text;
  v_slug        text;
  v_sku         text;
  v_skus        text[];
  v_nome        text;
  v_id          uuid;
  v_prodotto_id uuid;
  v_variante_id uuid;
  v_var         jsonb;
  v_n           integer;
  v_creati      jsonb := '[]'::jsonb;
  v_vincolo     text;
  v_dettaglio   text;
BEGIN
  -- Tutto sta in un blocco con EXCEPTION: è una sotto-transazione, un errore a metà annulla ogni scrittura.
  BEGIN
    -- ── la forma di ciò che è arrivato ──
    IF p_prodotto IS NULL OR jsonb_typeof(p_prodotto) <> 'object' THEN
      RETURN jsonb_build_object('esito', 'non_valido', 'motivo', 'prodotto');
    END IF;
    IF p_varianti IS NULL OR jsonb_typeof(p_varianti) <> 'array' THEN
      RETURN jsonb_build_object('esito', 'non_valido', 'motivo', 'varianti');
    END IF;
    v_n := jsonb_array_length(p_varianti);
    IF v_n < 1 OR v_n > 50 THEN
      RETURN jsonb_build_object('esito', 'non_valido', 'motivo', 'varianti_numero');
    END IF;
    IF COALESCE(cardinality(p_categorie), 0) > 10 THEN
      RETURN jsonb_build_object('esito', 'non_valido', 'motivo', 'categorie_numero');
    END IF;

    -- ── ogni campo: tipo, obbligatorio, lunghezza o tetto, forma (le stesse regole e gli stessi massimi della scheda) ──
    -- t = testo, n = intero non negativo; `modello` = espressione regolare che il testo deve rispettare.
    SELECT t.campo INTO v_motivo
      FROM (
        SELECT * FROM (VALUES
          ('nome',              p_prodotto -> 'nome',              true,  't', 120::numeric, NULL::text),
          ('slug',              p_prodotto -> 'slug',              true,  't', 80,           '^[a-z0-9]+(-[a-z0-9]+)*$'),
          ('sku',               p_prodotto -> 'sku',               true,  't', 40,           '^[A-Z0-9][A-Z0-9._-]{1,39}$'),
          ('tipo',              p_prodotto -> 'tipo',              true,  't', 10,           '^(patch|cura|kit)$'),
          ('marca',             p_prodotto -> 'marca',             false, 't', 80,           NULL),
          ('descrizione_breve', p_prodotto -> 'descrizione_breve', false, 't', 300,          NULL),
          ('descrizione_lunga', p_prodotto -> 'descrizione_lunga', false, 't', 5000,         NULL),
          ('categoria_google',  p_prodotto -> 'categoria_google',  false, 't', 200,          NULL),
          ('fornitore',         p_prodotto -> 'fornitore',         false, 't', 200,          NULL),
          ('seo_titolo',        p_prodotto -> 'seo_titolo',        false, 't', 300,          NULL),
          ('seo_descrizione',   p_prodotto -> 'seo_descrizione',   false, 't', 500,          NULL),
          ('gtin',              p_prodotto -> 'gtin',              false, 't', 20,           NULL),
          ('nota_titolare',     p_prodotto -> 'nota_titolare',     false, 't', 2000,         NULL),
          ('prezzo_cent',       p_prodotto -> 'prezzo_cent',       true,  'n', 2147483647,   NULL),
          ('peso_g',            p_prodotto -> 'peso_g',            false, 'n', 1000000,      NULL)
        ) AS p(campo, val, obbl, tipo, massimo, modello)
        UNION ALL
        SELECT 'varianti.' || f.campo, f.val, f.obbl, f.tipo, f.massimo, f.modello
          FROM jsonb_array_elements(p_varianti) AS e(x)
          CROSS JOIN LATERAL (VALUES
            ('sku',         e.x -> 'sku',         true,  't', 40::numeric, '^[A-Z0-9][A-Z0-9._-]{1,39}$'),
            ('nome',        e.x -> 'nome',        false, 't', 120,         NULL),
            ('gtin',        e.x -> 'gtin',        false, 't', 20,          NULL),
            ('prezzo_cent', e.x -> 'prezzo_cent', false, 'n', 2147483647,  NULL),
            ('peso_g',      e.x -> 'peso_g',      false, 'n', 1000000,     NULL),
            ('costo_cent',  e.x -> 'costo_cent',  false, 'n', 2147483647,  NULL),
            ('giacenza',    e.x -> 'giacenza',    false, 'n', 1000000,     NULL),
            ('ordine',      e.x -> 'ordine',      false, 'n', 1000,        NULL)
          ) AS f(campo, val, obbl, tipo, massimo, modello)
      ) AS t
     WHERE NOT CASE
             WHEN t.val IS NULL OR jsonb_typeof(t.val) = 'null' THEN NOT t.obbl
             WHEN t.tipo = 't' THEN
               jsonb_typeof(t.val) = 'string'
               AND char_length(t.val #>> '{}') <= t.massimo
               AND (NOT t.obbl OR btrim(t.val #>> '{}') <> '')
               AND (t.modello IS NULL OR (t.val #>> '{}') ~ t.modello)
             ELSE
               CASE WHEN jsonb_typeof(t.val) = 'number'
                    THEN (t.val #>> '{}')::numeric = trunc((t.val #>> '{}')::numeric)
                         AND (t.val #>> '{}')::numeric BETWEEN 0 AND t.massimo
                    ELSE false END
           END
     LIMIT 1;
    IF v_motivo IS NOT NULL THEN
      RETURN jsonb_build_object('esito', 'non_valido', 'motivo', v_motivo);
    END IF;

    -- le opzioni di una variante: un oggetto con al massimo tre voci, ognuna con un testo come valore
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_varianti) AS e(x)
       WHERE CASE jsonb_typeof(e.x -> 'opzioni')
               WHEN 'object' THEN (SELECT count(*) FROM jsonb_object_keys(e.x -> 'opzioni')) > 3
                                OR EXISTS (SELECT 1 FROM jsonb_each(e.x -> 'opzioni') AS o WHERE jsonb_typeof(o.value) <> 'string')
               WHEN 'null' THEN false
               ELSE e.x -> 'opzioni' IS NOT NULL
             END
    ) THEN
      RETURN jsonb_build_object('esito', 'non_valido', 'motivo', 'varianti.opzioni');
    END IF;

    -- due varianti con lo stesso SKU nello stesso gruppo
    SELECT array_agg(e.x ->> 'sku') INTO v_skus FROM jsonb_array_elements(p_varianti) AS e(x);
    IF (SELECT count(DISTINCT s) FROM unnest(v_skus) AS s) <> cardinality(v_skus) THEN
      RETURN jsonb_build_object('esito', 'non_valido', 'motivo', 'sku_doppio');
    END IF;

    v_slug := p_prodotto ->> 'slug';
    v_sku := p_prodotto ->> 'sku';

    -- ── una importazione alla volta: il secondo con lo stesso file trova «già presente» ──
    PERFORM pg_advisory_xact_lock(hashtext('shop_import_prodotto'));

    -- ── l'indirizzo o lo SKU esistono già? (nessuna scrittura) ──
    SELECT p.id, p.nome INTO v_id, v_nome FROM public.shop_prodotti p WHERE p.slug = v_slug;
    IF FOUND THEN
      RETURN jsonb_build_object('esito', 'gia_presente', 'prodotto_id', v_id, 'nome', v_nome);
    END IF;
    SELECT x.sku, x.nome INTO v_sku, v_nome FROM (
      SELECT p.sku, p.nome, 1 AS o FROM public.shop_prodotti p WHERE p.sku = ANY (v_skus || v_sku)
      UNION ALL
      SELECT v.sku, pv.nome, 2 FROM public.shop_varianti v JOIN public.shop_prodotti pv ON pv.id = v.prodotto_id WHERE v.sku = ANY (v_skus || v_sku)
    ) AS x ORDER BY x.o, x.sku LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('esito', 'sku_usato', 'sku', v_sku, 'prodotto_nome', v_nome);
    END IF;
    v_sku := p_prodotto ->> 'sku';

    -- ── le scritture: sempre «bozza», campo per campo ──
    INSERT INTO public.shop_prodotti (
      sku, slug, nome, tipo, stato, prezzo_cent, marca, descrizione_breve, descrizione_lunga,
      categoria_google, fornitore, seo_titolo, seo_descrizione, peso_g, gtin, nota_titolare
    ) VALUES (
      v_sku, v_slug, p_prodotto ->> 'nome', p_prodotto ->> 'tipo', 'bozza', (p_prodotto ->> 'prezzo_cent')::integer,
      NULLIF(btrim(p_prodotto ->> 'marca'), ''), NULLIF(btrim(p_prodotto ->> 'descrizione_breve'), ''),
      NULLIF(btrim(p_prodotto ->> 'descrizione_lunga'), ''), NULLIF(btrim(p_prodotto ->> 'categoria_google'), ''),
      NULLIF(btrim(p_prodotto ->> 'fornitore'), ''), NULLIF(btrim(p_prodotto ->> 'seo_titolo'), ''),
      NULLIF(btrim(p_prodotto ->> 'seo_descrizione'), ''), (p_prodotto ->> 'peso_g')::integer,
      NULLIF(btrim(p_prodotto ->> 'gtin'), ''), NULLIF(btrim(p_prodotto ->> 'nota_titolare'), '')
    ) RETURNING id INTO v_prodotto_id;

    INSERT INTO public.shop_storico (entita, entita_id, campo, prima, dopo, chi)
    VALUES ('prodotto', v_prodotto_id::text, 'creato', NULL,
            jsonb_build_object('sku', v_sku, 'slug', v_slug, 'nome', p_prodotto ->> 'nome', 'tipo', p_prodotto ->> 'tipo'), v_chi);

    v_n := 0;
    FOR v_var IN SELECT e.x FROM jsonb_array_elements(p_varianti) AS e(x) LOOP
      v_n := v_n + 1;
      -- la giacenza parte da 0 e arriva con il movimento, mai scritta a mano
      INSERT INTO public.shop_varianti (prodotto_id, sku, nome, opzioni, prezzo_cent, giacenza, peso_g, attiva, gtin, costo_cent, ordine)
      VALUES (
        v_prodotto_id, v_var ->> 'sku', COALESCE(v_var ->> 'nome', ''),
        CASE WHEN jsonb_typeof(v_var -> 'opzioni') = 'object' THEN v_var -> 'opzioni' ELSE '{}'::jsonb END,
        (v_var ->> 'prezzo_cent')::integer, 0, (v_var ->> 'peso_g')::integer, true,
        NULLIF(btrim(v_var ->> 'gtin'), ''), (v_var ->> 'costo_cent')::integer,
        COALESCE((v_var ->> 'ordine')::integer, v_n)
      ) RETURNING id INTO v_variante_id;
      IF COALESCE((v_var ->> 'giacenza')::integer, 0) > 0 THEN
        PERFORM public.shop_giacenza_muovi(v_variante_id, (v_var ->> 'giacenza')::integer, 'carico', 'Import CSV', v_chi, NULL);
      END IF;
      INSERT INTO public.shop_storico (entita, entita_id, campo, prima, dopo, chi)
      VALUES ('variante', v_variante_id::text, 'creata', NULL, jsonb_build_object('sku', v_var ->> 'sku', 'nome', COALESCE(v_var ->> 'nome', '')), v_chi);
      v_creati := v_creati || jsonb_build_object('sku', v_var ->> 'sku', 'id', v_variante_id);
    END LOOP;

    INSERT INTO public.shop_prodotti_categorie (prodotto_id, categoria_id)
    SELECT DISTINCT v_prodotto_id, c FROM unnest(COALESCE(p_categorie, ARRAY[]::uuid[])) AS c WHERE c IS NOT NULL;

    RETURN jsonb_build_object('esito', 'creato', 'prodotto_id', v_prodotto_id, 'varianti', v_creati);

  EXCEPTION
    -- Una corsa fra due importazioni (o con la scheda) che il controllo sopra non ha visto: le scritture di questo
    -- blocco sono già annullate, quindi si rilegge chi ha vinto.
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_vincolo = CONSTRAINT_NAME, v_dettaglio = PG_EXCEPTION_DETAIL;
      IF v_vincolo = 'shop_prodotti_slug_key' THEN
        SELECT p.id, p.nome INTO v_id, v_nome FROM public.shop_prodotti p WHERE p.slug = p_prodotto ->> 'slug';
        RETURN jsonb_build_object('esito', 'gia_presente', 'prodotto_id', v_id, 'nome', v_nome);
      ELSIF v_vincolo IN ('shop_prodotti_sku_key', 'shop_varianti_sku_key') THEN
        -- il dettaglio è «Key (sku)=(VALORE) already exists» (nella lingua del database): lo SKU non ha parentesi, quindi si prende fino alla prima chiusa
        v_sku := substring(v_dettaglio FROM '\(sku\)=\(([^)]*)\)');
        SELECT x.nome INTO v_nome FROM (
          SELECT p.nome FROM public.shop_prodotti p WHERE p.sku = v_sku
          UNION ALL
          SELECT pv.nome FROM public.shop_varianti v JOIN public.shop_prodotti pv ON pv.id = v.prodotto_id WHERE v.sku = v_sku
        ) AS x LIMIT 1;
        RETURN jsonb_build_object('esito', 'sku_usato', 'sku', v_sku, 'prodotto_nome', v_nome);
      END IF;
      RETURN jsonb_build_object('esito', 'non_valido', 'motivo', SQLSTATE);
    -- Tutto il resto (tipo sbagliato, regola della tabella, categoria che non esiste, numero fuori misura…):
    -- solo il codice, mai il messaggio, e niente di scritto.
    WHEN OTHERS THEN
      RETURN jsonb_build_object('esito', 'non_valido', 'motivo', SQLSTATE);
  END;
END
$$;

-- La chiama solo il server con la chiave di servizio (stessa regola di shop_giacenza_muovi).
REVOKE ALL ON FUNCTION public.shop_import_prodotto(jsonb, jsonb, uuid[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_import_prodotto(jsonb, jsonb, uuid[], text) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
