-- ─────────────────────────────────────────────────────────────────────────────
-- SHOP · IMPORT PRODOTTI · RICARICARE UN FILE SOVRASCRIVE I PRODOTTI GIÀ PRESENTI
--
-- La applica il titolare, a mano, dal SQL Editor di Supabase (mai «supabase db push»).
--
-- PERCHÉ: ricaricando un CSV di Shopify i prodotti con lo stesso indirizzo (handle) venivano saltati come «già presenti»,
--   anche quelli spostati nel Cestino. Il titolare vuole che il file li rimetta a posto.
--
-- COSA FA: crea UNA funzione nuova, shop_import_sovrascrivi, con gli stessi argomenti e gli stessi controlli di
--   shop_import_prodotto (che resta com'è). Trova il prodotto per indirizzo e, tutto o niente:
--   · scrive i campi del file (nome, tipo, prezzo, SKU; i testi facoltativi solo se il file li ha: un campo vuoto NON cancella);
--   · un prodotto nel Cestino (archiviato) torna in bozza; uno pubblicato resta pubblicato; le modifiche in bozza non pubblicate
--     si scartano (vince il file);
--   · varianti per SKU: quella che c'è si aggiorna e si riaccende, quella nuova si crea (con la giacenza del file come «carico»),
--     quella che il file non ha più si SPEGNE (attiva = false), mai cancellata: ordini e movimenti la citano;
--   · la giacenza delle varianti che c'erano NON si tocca (la tengono ordini e movimenti; un file senza quantità la azzererebbe);
--   · le categorie del file si AGGIUNGONO, nessuna si toglie; la nota del titolare non si tocca;
--   · ogni cambio lascia una riga in shop_storico.
--   Esiti: aggiornato {prodotto_id, varianti, spente} · non_trovato · sku_usato {sku, prodotto_nome} · non_valido {motivo}.
--   Nessuna tabella, colonna o riga cambia applicandola. Solo service_role la esegue.
--
-- ORDINE: si può applicare prima o dopo il codice. Senza questa funzione il codice nuovo si comporta come prima (salta i già presenti).
--
-- LANCIARLA DUE VOLTE NON FA DANNI (CREATE OR REPLACE).
--
-- VERIFICA (sola lettura):
--   SELECT has_function_privilege('anon', 'public.shop_import_sovrascrivi(jsonb, jsonb, uuid[], text)', 'EXECUTE');          → false
--   SELECT has_function_privilege('service_role', 'public.shop_import_sovrascrivi(jsonb, jsonb, uuid[], text)', 'EXECUTE');  → true
--
-- COME SI ANNULLA: DROP FUNCTION public.shop_import_sovrascrivi(jsonb, jsonb, uuid[], text);  (il codice torna a saltare i già presenti)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION public.shop_import_sovrascrivi(
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
  v_vecchio     public.shop_prodotti%ROWTYPE;
  v_vecchia     public.shop_varianti%ROWTYPE;
  v_var         jsonb;
  v_n           integer;
  v_spente      integer;
  v_varianti    jsonb := '[]'::jsonb;
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
    IF v_n < 1 OR v_n > 250 THEN
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

    -- ── una importazione alla volta (lo stesso lucchetto di shop_import_prodotto) ──
    PERFORM pg_advisory_xact_lock(hashtext('shop_import_prodotto'));

    -- ── il prodotto da sovrascrivere: per indirizzo, bloccato fino alla fine ──
    SELECT * INTO v_vecchio FROM public.shop_prodotti p WHERE p.slug = v_slug FOR UPDATE;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('esito', 'non_trovato');
    END IF;
    v_prodotto_id := v_vecchio.id;

    -- ── uno SKU del file è di un ALTRO prodotto? (i suoi li può riusare) ──
    SELECT x.sku, x.nome INTO v_sku, v_nome FROM (
      SELECT p.sku, p.nome, 1 AS o FROM public.shop_prodotti p WHERE p.sku = ANY (v_skus || v_sku) AND p.id <> v_prodotto_id
      UNION ALL
      SELECT v.sku, pv.nome, 2 FROM public.shop_varianti v JOIN public.shop_prodotti pv ON pv.id = v.prodotto_id
       WHERE v.sku = ANY (v_skus || v_sku) AND v.prodotto_id <> v_prodotto_id
    ) AS x ORDER BY x.o, x.sku LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('esito', 'sku_usato', 'sku', v_sku, 'prodotto_nome', v_nome);
    END IF;
    v_sku := p_prodotto ->> 'sku';

    -- ── il prodotto: i campi obbligatori si scrivono, i facoltativi solo se il file li ha ──
    UPDATE public.shop_prodotti SET
      sku               = v_sku,
      nome              = p_prodotto ->> 'nome',
      tipo              = p_prodotto ->> 'tipo',
      prezzo_cent       = (p_prodotto ->> 'prezzo_cent')::integer,
      marca             = COALESCE(NULLIF(btrim(p_prodotto ->> 'marca'), ''), marca),
      descrizione_breve = COALESCE(NULLIF(btrim(p_prodotto ->> 'descrizione_breve'), ''), descrizione_breve),
      descrizione_lunga = COALESCE(NULLIF(btrim(p_prodotto ->> 'descrizione_lunga'), ''), descrizione_lunga),
      categoria_google  = COALESCE(NULLIF(btrim(p_prodotto ->> 'categoria_google'), ''), categoria_google),
      fornitore         = COALESCE(NULLIF(btrim(p_prodotto ->> 'fornitore'), ''), fornitore),
      seo_titolo        = COALESCE(NULLIF(btrim(p_prodotto ->> 'seo_titolo'), ''), seo_titolo),
      seo_descrizione   = COALESCE(NULLIF(btrim(p_prodotto ->> 'seo_descrizione'), ''), seo_descrizione),
      peso_g            = COALESCE((p_prodotto ->> 'peso_g')::integer, peso_g),
      gtin              = COALESCE(NULLIF(btrim(p_prodotto ->> 'gtin'), ''), gtin),
      stato             = CASE WHEN stato = 'archiviato' THEN 'bozza' ELSE stato END,
      bozza_modifiche     = NULL,
      bozza_modificata_il = NULL,
      aggiornato_il     = now()
    WHERE id = v_prodotto_id;

    INSERT INTO public.shop_storico (entita, entita_id, campo, prima, dopo, chi)
    VALUES ('prodotto', v_prodotto_id::text, 'sovrascritto da import',
            jsonb_build_object('sku', v_vecchio.sku, 'nome', v_vecchio.nome, 'tipo', v_vecchio.tipo, 'prezzo_cent', v_vecchio.prezzo_cent,
                               'stato', v_vecchio.stato, 'bozza_modifiche', v_vecchio.bozza_modifiche IS NOT NULL),
            jsonb_build_object('sku', v_sku, 'nome', p_prodotto ->> 'nome', 'tipo', p_prodotto ->> 'tipo',
                               'prezzo_cent', (p_prodotto ->> 'prezzo_cent')::integer), v_chi);
    IF v_vecchio.stato = 'archiviato' THEN
      INSERT INTO public.shop_storico (entita, entita_id, campo, prima, dopo, chi)
      VALUES ('prodotto', v_prodotto_id::text, 'stato', to_jsonb('archiviato'::text), to_jsonb('bozza'::text), v_chi);
    END IF;

    -- ── le varianti, per SKU ──
    v_n := 0;
    FOR v_var IN SELECT e.x FROM jsonb_array_elements(p_varianti) AS e(x) LOOP
      v_n := v_n + 1;
      SELECT * INTO v_vecchia FROM public.shop_varianti v WHERE v.prodotto_id = v_prodotto_id AND v.sku = v_var ->> 'sku' FOR UPDATE;
      IF FOUND THEN
        -- c'era: si aggiorna e si riaccende; la giacenza resta quella che è
        UPDATE public.shop_varianti SET
          nome        = COALESCE(v_var ->> 'nome', ''),
          opzioni     = CASE WHEN jsonb_typeof(v_var -> 'opzioni') = 'object' THEN v_var -> 'opzioni' ELSE '{}'::jsonb END,
          prezzo_cent = (v_var ->> 'prezzo_cent')::integer,
          peso_g      = COALESCE((v_var ->> 'peso_g')::integer, peso_g),
          gtin        = COALESCE(NULLIF(btrim(v_var ->> 'gtin'), ''), gtin),
          costo_cent  = COALESCE((v_var ->> 'costo_cent')::integer, costo_cent),
          ordine      = COALESCE((v_var ->> 'ordine')::integer, v_n),
          attiva      = true,
          aggiornato_il = now()
        WHERE id = v_vecchia.id;
        INSERT INTO public.shop_storico (entita, entita_id, campo, prima, dopo, chi)
        VALUES ('variante', v_vecchia.id::text, 'sovrascritta da import',
                jsonb_build_object('nome', v_vecchia.nome, 'opzioni', v_vecchia.opzioni, 'prezzo_cent', v_vecchia.prezzo_cent, 'attiva', v_vecchia.attiva),
                jsonb_build_object('nome', COALESCE(v_var ->> 'nome', ''), 'opzioni', v_var -> 'opzioni', 'prezzo_cent', (v_var ->> 'prezzo_cent')::integer, 'attiva', true),
                v_chi);
        v_varianti := v_varianti || jsonb_build_object('sku', v_var ->> 'sku', 'id', v_vecchia.id, 'esito', 'aggiornata');
      ELSE
        -- nuova: come nell'import, la giacenza arriva col movimento «carico»
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
        v_varianti := v_varianti || jsonb_build_object('sku', v_var ->> 'sku', 'id', v_variante_id, 'esito', 'creata');
      END IF;
    END LOOP;

    -- ── le varianti che il file non ha più: spente, mai cancellate ──
    WITH spente AS (
      UPDATE public.shop_varianti SET attiva = false, aggiornato_il = now()
       WHERE prodotto_id = v_prodotto_id AND attiva AND NOT (sku = ANY (v_skus))
      RETURNING id
    ), scritte AS (
      INSERT INTO public.shop_storico (entita, entita_id, campo, prima, dopo, chi)
      SELECT 'variante', s.id::text, 'attiva', 'true'::jsonb, 'false'::jsonb, v_chi FROM spente s
      RETURNING 1
    )
    SELECT count(*) INTO v_spente FROM scritte;

    -- ── le categorie del file si aggiungono, nessuna si toglie ──
    INSERT INTO public.shop_prodotti_categorie (prodotto_id, categoria_id)
    SELECT DISTINCT v_prodotto_id, c FROM unnest(COALESCE(p_categorie, ARRAY[]::uuid[])) AS c WHERE c IS NOT NULL
    ON CONFLICT (prodotto_id, categoria_id) DO NOTHING;

    RETURN jsonb_build_object('esito', 'aggiornato', 'prodotto_id', v_prodotto_id, 'varianti', v_varianti, 'spente', v_spente);

  EXCEPTION
    -- Una corsa con la scheda o con un altro import: le scritture di questo blocco sono già annullate.
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_vincolo = CONSTRAINT_NAME, v_dettaglio = PG_EXCEPTION_DETAIL;
      IF v_vincolo IN ('shop_prodotti_sku_key', 'shop_varianti_sku_key') THEN
        v_sku := substring(v_dettaglio FROM '\(sku\)=\(([^)]*)\)');
        SELECT x.nome INTO v_nome FROM (
          SELECT p.nome FROM public.shop_prodotti p WHERE p.sku = v_sku
          UNION ALL
          SELECT pv.nome FROM public.shop_varianti v JOIN public.shop_prodotti pv ON pv.id = v.prodotto_id WHERE v.sku = v_sku
        ) AS x LIMIT 1;
        RETURN jsonb_build_object('esito', 'sku_usato', 'sku', v_sku, 'prodotto_nome', v_nome);
      END IF;
      RETURN jsonb_build_object('esito', 'non_valido', 'motivo', SQLSTATE);
    -- Tutto il resto: solo il codice, mai il messaggio, e niente di scritto.
    WHEN OTHERS THEN
      RETURN jsonb_build_object('esito', 'non_valido', 'motivo', SQLSTATE);
  END;
END
$$;

-- La chiama solo il server con la chiave di servizio (come shop_import_prodotto).
REVOKE ALL ON FUNCTION public.shop_import_sovrascrivi(jsonb, jsonb, uuid[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_import_sovrascrivi(jsonb, jsonb, uuid[], text) TO service_role;

COMMIT;
