-- ─────────────────────────────────────────────────────────────────────────────
-- SHOP · S1 · IL CATALOGO (PRODOTTI, VARIANTI, FOTO, GIACENZA, STORICO)
--
-- Commessa 2026-11-20-shop-completo (PIANO.md §4 «S1», compito T02, Rilascio 1).
-- La applica il TITOLARE, a mano, dal SQL Editor di Supabase. La squadra non la
-- lancia mai e non usa «supabase db push» su questo file.
--
-- COSA FA (solo aggiunte: nessuna riga e nessuna tabella esistente viene toccata)
--   1. Crea otto tabelle nuove, tutte vuote: shop_impostazioni, shop_categorie,
--      shop_prodotti, shop_prodotti_categorie, shop_varianti, shop_media,
--      shop_giacenza_movimenti, shop_storico.
--      Tutte con la protezione per riga accesa e NESSUNA policy, e tolte ad
--      anon/authenticated: dal browser non si legge e non si scrive niente. Ci
--      arriva solo il server (che usa la chiave di servizio).
--   2. Crea le regole al database: la giacenza non scende mai sotto zero, i prezzi
--      sono interi in centesimi, gli stati e gli slot delle foto hanno valori
--      fissi, una foto è di un prodotto OPPURE di una categoria.
--   3. Crea tre funzioni (solo service_role): shop_giacenza_muovi e
--      shop_giacenza_imposta (blocco di riga, mai sotto zero, riga di movimento
--      nella stessa transazione), shop_impostazione_imposta (confronto-e-scambio
--      come messaggio_automatico_imposta, con riga nello storico).
--   4. Crea un trigger sul prodotto: un prodotto passa a «pubblicato» solo se ha
--      descrizione breve, una categoria, la foto principale (non rimossa, con
--      testo alternativo, e se ritrae persone con liberatoria) e una variante attiva con SKU e prezzo effettivo > 0.
--   5. Crea quattro VISTE per il sito pubblico (shop_v_prodotti, shop_v_varianti,
--      shop_v_media, shop_v_categorie): solo le colonne pubbliche, solo prodotti
--      pubblicati, mai la giacenza (la variante porta «disponibile»), mai le foto
--      di una bozza o rimosse o di persone senza liberatoria. Lette solo dal
--      server con la chiave di servizio: anon e authenticated non hanno nessun
--      permesso su tabelle e viste.
--   6. Semina due interruttori: catalogo_sito = «codice» (il sito continua a
--      usare il catalogo scritto nel codice) e giacenza_bassa = 3.
--   7. Crea il bucket pubblico shop-media (25 MB, solo jpeg/png/webp/avif/mp4/
--      quicktime). Nessuna policy su storage.objects: si carica solo con un
--      permesso firmato dal server, si legge dall'indirizzo pubblico.
--   8. Chiede a PostgREST di ricaricare lo schema.
--
-- COSA NON FA
--   Non tocca shop_orders, crm_*, public_leads, tracking_config né nessuna
--   tabella che esiste già. Nessun UPDATE, DELETE, TRUNCATE o DROP su dati
--   esistenti. Non apre lo shop: il sito resta sul catalogo del codice finché il
--   server non accende catalogo_sito = cms (e può farlo solo se tutte le
--   condizioni di uscita sono vere). Non carica prodotti: i 33 articoli
--   vecchi sono la migrazione S2, facoltativa.
--
-- PRIMA DI LANCIARLA: apri Storage e guarda se esiste già un bucket «shop-media».
--   Se c'è, questa migrazione NON lo cambia (ON CONFLICT DO NOTHING): controlla tu
--   che sia pubblico, con limite 25 MB e solo i sei tipi di sopra.
--
-- ORDINE: S1 → S2 (facoltativa) → S3. Può essere lanciata prima o dopo la
-- pubblicazione del codice: il codice regge anche senza (ripiega sul catalogo
-- del codice).
--
-- LANCIARLA DUE VOLTE NON FA DANNI (CREATE … IF NOT EXISTS, OR REPLACE, semi e
-- bucket con ON CONFLICT DO NOTHING: ciò che il titolare ha già cambiato resta).
--
-- VERIFICA, dopo averla applicata (tutte in sola lettura):
--   SELECT chiave, valore FROM public.shop_impostazioni ORDER BY chiave;
--      → catalogo_sito = "codice", giacenza_bassa = 3
--   SELECT count(*) FROM pg_policies WHERE schemaname = 'public' AND tablename LIKE 'shop\_%' AND tablename <> 'shop_orders';
--      → 0 (le policy di shop_orders sono un'altra cosa e restano com'erano)
--   SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';
--      → vedrai le 4 policy «landing-media» (sono di un'altra cosa e non si toccano). Nessuna deve
--        riguardare shop-media, e nessuna deve valere per TUTTI i bucket con ruolo public/anon (cioè
--        senza bucket_id nel qual o nel with_check): una policy così renderebbe leggibile o scrivibile
--        anche shop-media oltre le regole di questo shop. Se la trovi, fermati e dillo alla squadra.
--   SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'shop-media';
--      → public = true, 26214400
--
-- COME SI RITIRA UNA FOTO (liberatoria revocata, richiesta di cancellazione):
--   «Rimuovere» una foto dal pannello la toglie dal sito ma il file resta nello
--   Storage, e il bucket è pubblico: chi ha l'indirizzo la vede ancora. Per
--   RITIRARE UNA FOTO davvero: Supabase → Storage → shop-media → cerca i TRE file
--   della foto (480, 960, 1600: i percorsi sono nella scheda del prodotto) →
--   Delete. Poi, nel pannello, togli la spunta «liberatoria». L'originale non si
--   conserva: non c'è altro da cancellare.
--
-- COME SI ANNULLA: le tabelle e le viste nuove sono vuote e innocue: non serve
-- toglierle. Per spegnere tutto basta che catalogo_sito resti «codice» (è già
-- così). Non esiste uno script che cancella: se un domani servisse, si scrive
-- a parte e si legge prima.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Le tabelle ────────────────────────────────────────────────────────────

-- Gli interruttori del catalogo (valore in JSON). Si cambiano solo con la funzione.
CREATE TABLE IF NOT EXISTS public.shop_impostazioni (
  chiave       text PRIMARY KEY,
  valore       jsonb NOT NULL,
  aggiornato_il timestamptz NOT NULL DEFAULT now(),
  aggiornato_da text
);

CREATE TABLE IF NOT EXISTS public.shop_categorie (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text NOT NULL UNIQUE CHECK (btrim(slug) <> ''),
  nome            text NOT NULL CHECK (btrim(nome) <> ''),
  tipo            text NOT NULL DEFAULT 'categoria' CHECK (tipo IN ('categoria', 'collezione')),
  frase           text,
  foto_path       text,
  seo_titolo      text,
  seo_descrizione text,
  ordine          integer NOT NULL DEFAULT 0,
  visibile        boolean NOT NULL DEFAULT false,
  creato_il       timestamptz NOT NULL DEFAULT now(),
  aggiornato_il   timestamptz NOT NULL DEFAULT now(),
  pubblicata_il   timestamptz
);

-- prezzo_cent: centesimi interi (D2). In bozza può essere 0; per pubblicare serve
-- un prezzo effettivo > 0 (lo controlla il trigger).
-- caratteristiche: [{etichetta, valore, stato, fonte}]; contenuto: {passi, confezione, avvertenze, faq};
-- canali: {sito, meta, google, tiktok} (vuoto = decide il server).
CREATE TABLE IF NOT EXISTS public.shop_prodotti (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku                 text NOT NULL UNIQUE CHECK (btrim(sku) <> ''),
  slug                text NOT NULL UNIQUE CHECK (btrim(slug) <> ''),
  nome                text NOT NULL CHECK (btrim(nome) <> ''),
  tipo                text NOT NULL CHECK (tipo IN ('patch', 'cura', 'kit')),
  stato               text NOT NULL DEFAULT 'bozza' CHECK (stato IN ('bozza', 'pubblicato', 'archiviato')),
  origine             text CHECK (origine IS NULL OR origine = 'codice'),
  prezzo_cent         integer NOT NULL DEFAULT 0 CHECK (prezzo_cent >= 0),
  marca               text,
  riga_presentazione  text,
  descrizione_breve   text,
  descrizione_lunga   text,
  per_chi             text,
  caratteristiche     jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(caratteristiche) = 'array'),
  contenuto           jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(contenuto) = 'object'),
  reso_consentito     boolean,
  reso_giorni         integer CHECK (reso_giorni IS NULL OR reso_giorni >= 0),
  box_consulenza      boolean NOT NULL DEFAULT false,
  correlato_id        uuid REFERENCES public.shop_prodotti (id),
  canali              jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(canali) = 'object'),
  gtin                text,
  mpn                 text,
  categoria_google    text,
  peso_g              integer CHECK (peso_g IS NULL OR peso_g >= 0),
  classe_spedizione   text,
  fornitore           text,
  scheda_tecnica_path text,
  note_interne        text,
  nota_titolare       text,
  seo_titolo          text,
  seo_descrizione     text,
  seo_media_id        uuid,
  bozza_modifiche     jsonb CHECK (bozza_modifiche IS NULL OR jsonb_typeof(bozza_modifiche) = 'object'),
  bozza_modificata_il timestamptz,
  id_codice           text UNIQUE,
  creato_il           timestamptz NOT NULL DEFAULT now(),
  aggiornato_il       timestamptz NOT NULL DEFAULT now(),
  pubblicato_il       timestamptz
);

CREATE TABLE IF NOT EXISTS public.shop_prodotti_categorie (
  prodotto_id  uuid NOT NULL REFERENCES public.shop_prodotti (id),
  categoria_id uuid NOT NULL REFERENCES public.shop_categorie (id),
  PRIMARY KEY (prodotto_id, categoria_id)
);

-- prezzo_cent della variante: vuoto = quello del prodotto. giacenza: solo con le funzioni.
CREATE TABLE IF NOT EXISTS public.shop_varianti (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prodotto_id   uuid NOT NULL REFERENCES public.shop_prodotti (id),
  sku           text NOT NULL UNIQUE CHECK (btrim(sku) <> ''),
  nome          text NOT NULL DEFAULT '',
  opzioni       jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(opzioni) = 'object'),
  prezzo_cent   integer CHECK (prezzo_cent IS NULL OR prezzo_cent >= 0),
  giacenza      integer NOT NULL DEFAULT 0 CHECK (giacenza >= 0),
  peso_g        integer CHECK (peso_g IS NULL OR peso_g >= 0),
  attiva        boolean NOT NULL DEFAULT true,
  gtin          text,
  ordine        integer NOT NULL DEFAULT 0,
  creato_il     timestamptz NOT NULL DEFAULT now(),
  aggiornato_il timestamptz NOT NULL DEFAULT now()
);

-- Una foto o un video di UN prodotto o di UNA categoria (D30). Non si cancella mai:
-- «rimossa» ha rimosso_il. Senza liberatoria una persona non esce nel pubblico.
CREATE TABLE IF NOT EXISTS public.shop_media (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prodotto_id     uuid REFERENCES public.shop_prodotti (id),
  categoria_id    uuid REFERENCES public.shop_categorie (id),
  variante_id     uuid REFERENCES public.shop_varianti (id),
  slot            text NOT NULL CHECK (slot IN ('principale', 'foto2', 'foto3', 'foto4', 'foto5', 'scala', 'video', 'confezione', 'campione')),
  sotto_ruolo     text CHECK (sotto_ruolo IS NULL OR sotto_ruolo IN ('retro_base', 'macro_attaccatura', 'colore_luce', 'altro')),
  tipo            text NOT NULL DEFAULT 'foto' CHECK (tipo IN ('foto', 'video')),
  path_480        text,
  path_960        text,
  path_1600       text,
  path_video      text,
  path_copertina  text,
  durata_s        integer CHECK (durata_s IS NULL OR durata_s >= 0),
  alt             text,
  testo_parlato   text,
  sottotitoli_ok  boolean NOT NULL DEFAULT false,
  muto            boolean NOT NULL DEFAULT false,
  ritrae_persone  boolean NOT NULL DEFAULT false,
  liberatoria_ok  boolean NOT NULL DEFAULT false,
  valore_opzione  text,
  ordine          integer NOT NULL DEFAULT 0,
  rimosso_il      timestamptz,
  creato_il       timestamptz NOT NULL DEFAULT now(),
  CHECK ((prodotto_id IS NOT NULL) <> (categoria_id IS NOT NULL)),
  CHECK (variante_id IS NULL OR slot = 'campione')
);

-- Ogni cambio di giacenza lascia una riga: chi, quando, di quanto, perché.
CREATE TABLE IF NOT EXISTS public.shop_giacenza_movimenti (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variante_id   uuid NOT NULL REFERENCES public.shop_varianti (id),
  delta         integer NOT NULL,
  giacenza_dopo integer NOT NULL CHECK (giacenza_dopo >= 0),
  motivo        text NOT NULL CHECK (motivo IN ('carico', 'rettifica', 'reso', 'ordine', 'annullo_ordine', 'migrazione')),
  nota          text,
  chi           text,
  ordine_ref    text,
  creato_il     timestamptz NOT NULL DEFAULT now()
);

-- Un solo storico per prodotti, varianti, categorie e interruttori (entita_id è
-- testo perché la chiave di un interruttore non è un uuid).
CREATE TABLE IF NOT EXISTS public.shop_storico (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entita    text NOT NULL,
  entita_id text NOT NULL,
  campo     text,
  prima     jsonb,
  dopo      jsonb,
  chi       text,
  creato_il timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Gli indici ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shop_prodotti_stato_slug ON public.shop_prodotti (stato, slug);
CREATE INDEX IF NOT EXISTS idx_shop_prodotti_categorie_categoria ON public.shop_prodotti_categorie (categoria_id);
CREATE INDEX IF NOT EXISTS idx_shop_varianti_prodotto ON public.shop_varianti (prodotto_id);
CREATE INDEX IF NOT EXISTS idx_shop_media_prodotto ON public.shop_media (prodotto_id);
CREATE INDEX IF NOT EXISTS idx_shop_media_categoria ON public.shop_media (categoria_id);
CREATE INDEX IF NOT EXISTS idx_shop_movimenti_variante ON public.shop_giacenza_movimenti (variante_id, creato_il DESC);
CREATE INDEX IF NOT EXISTS idx_shop_storico_entita ON public.shop_storico (entita, entita_id, creato_il DESC);

-- ── 3. Tutto chiuso: le tabelle le tocca solo il server ──────────────────────
ALTER TABLE public.shop_impostazioni ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_categorie ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_prodotti ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_prodotti_categorie ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_varianti ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_giacenza_movimenti ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_storico ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.shop_impostazioni FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.shop_categorie FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.shop_prodotti FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.shop_prodotti_categorie FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.shop_varianti FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.shop_media FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.shop_giacenza_movimenti FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.shop_storico FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.shop_impostazioni TO service_role;
GRANT ALL ON TABLE public.shop_categorie TO service_role;
GRANT ALL ON TABLE public.shop_prodotti TO service_role;
GRANT ALL ON TABLE public.shop_prodotti_categorie TO service_role;
GRANT ALL ON TABLE public.shop_varianti TO service_role;
GRANT ALL ON TABLE public.shop_media TO service_role;
-- Movimenti e storico sono registri: il server può solo leggere e aggiungere (niente UPDATE né
-- DELETE né TRUNCATE nemmeno con la chiave di servizio: «nessuna cancellazione» la garantisce il database).
-- (Supabase dà di default ogni permesso a service_role sugli oggetti nuovi: qui si toglie e si rida solo ciò che serve.)
REVOKE ALL ON TABLE public.shop_giacenza_movimenti FROM service_role;
REVOKE ALL ON TABLE public.shop_storico FROM service_role;
GRANT SELECT, INSERT ON TABLE public.shop_giacenza_movimenti TO service_role;
GRANT SELECT, INSERT ON TABLE public.shop_storico TO service_role;

-- ── 4. La giacenza: blocco di riga, mai sotto zero, movimento nella stessa transazione ──
-- Ritorna la giacenza di DOPO. Con due richieste insieme la seconda aspetta la prima,
-- rilegge il valore nuovo e, se non basta, riceve l'errore «giacenza_negativa».
CREATE OR REPLACE FUNCTION public.shop_giacenza_muovi(
  p_variante   uuid,
  p_delta      integer,
  p_motivo     text,
  p_nota       text,
  p_chi        text,
  p_ordine_ref text
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prima integer;
  v_dopo  integer;
BEGIN
  IF p_delta IS NULL THEN
    RAISE EXCEPTION 'giacenza_delta_vuoto' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  SELECT giacenza INTO v_prima FROM public.shop_varianti WHERE id = p_variante FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'variante_inesistente' USING ERRCODE = 'no_data_found';
  END IF;
  v_dopo := v_prima + p_delta;
  IF v_dopo < 0 THEN
    RAISE EXCEPTION 'giacenza_negativa' USING ERRCODE = 'check_violation';
  END IF;
  IF p_delta = 0 THEN
    RETURN v_prima;
  END IF;

  UPDATE public.shop_varianti SET giacenza = v_dopo, aggiornato_il = now() WHERE id = p_variante;
  INSERT INTO public.shop_giacenza_movimenti (variante_id, delta, giacenza_dopo, motivo, nota, chi, ordine_ref)
  VALUES (p_variante, p_delta, v_dopo, p_motivo, p_nota, left(COALESCE(NULLIF(btrim(p_chi), ''), 'sconosciuto'), 80), p_ordine_ref);
  RETURN v_dopo;
END
$$;

-- Dalla lista: il valore assoluto che la persona ha scritto; il delta lo calcola il
-- database SOTTO BLOCCO (due persone che modificano insieme non si sovrascrivono).
CREATE OR REPLACE FUNCTION public.shop_giacenza_imposta(
  p_variante uuid,
  p_nuovo    integer,
  p_motivo   text,
  p_chi      text
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prima integer;
BEGIN
  SELECT giacenza INTO v_prima FROM public.shop_varianti WHERE id = p_variante FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'variante_inesistente' USING ERRCODE = 'no_data_found';
  END IF;
  IF p_nuovo IS NULL OR p_nuovo < 0 THEN
    RAISE EXCEPTION 'giacenza_negativa' USING ERRCODE = 'check_violation';
  END IF;
  RETURN public.shop_giacenza_muovi(p_variante, p_nuovo - v_prima, p_motivo, NULL, p_chi, NULL);
END
$$;

-- ── 5. Gli interruttori: confronto-e-scambio con riga nello storico ──────────
-- Ritorna true se ha cambiato, false se non ha fatto niente: la chiave non esiste,
-- p_atteso non è più il valore di adesso (l'ha cambiato un altro), il valore nuovo è
-- uguale o vuoto. Le regole di «si può aprire lo shop» sono del server, non di qui.
CREATE OR REPLACE FUNCTION public.shop_impostazione_imposta(
  p_chiave  text,
  p_atteso  jsonb,
  p_nuovo   jsonb,
  p_chi     text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_righe integer;
  v_chi   text := left(COALESCE(NULLIF(btrim(p_chi), ''), 'sconosciuto'), 80);
BEGIN
  IF p_atteso IS NULL OR p_nuovo IS NULL OR p_atteso = p_nuovo THEN
    RETURN false;
  END IF;

  UPDATE public.shop_impostazioni
     SET valore = p_nuovo, aggiornato_il = now(), aggiornato_da = v_chi
   WHERE chiave = p_chiave
     AND valore = p_atteso;
  GET DIAGNOSTICS v_righe = ROW_COUNT;
  IF v_righe = 0 THEN
    RETURN false;
  END IF;

  INSERT INTO public.shop_storico (entita, entita_id, campo, prima, dopo, chi)
  VALUES ('impostazione', p_chiave, 'valore', p_atteso, p_nuovo, v_chi);
  RETURN true;
END
$$;

-- ── 6. Il trigger di pubblicazione (D7) ──────────────────────────────────────
-- Vale «sia dalla schermata sia chiamando il server direttamente». Parte quando un
-- prodotto nasce già pubblicato o quando stato DIVENTA «pubblicato»: salvare altro su
-- un prodotto già pubblicato non lo ricontrolla. Gli altri blocchi (sottotitoli,
-- canale, spedizione) li fa il server. Errore: check_violation, frase «shop_pubblicazione_negata: …».
CREATE OR REPLACE FUNCTION public.shop_controlla_pubblicazione()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF btrim(COALESCE(NEW.descrizione_breve, '')) = '' THEN
    RAISE EXCEPTION 'shop_pubblicazione_negata: manca la descrizione breve' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shop_prodotti_categorie pc WHERE pc.prodotto_id = NEW.id) THEN
    RAISE EXCEPTION 'shop_pubblicazione_negata: manca la categoria' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.shop_media m
     WHERE m.prodotto_id = NEW.id
       AND m.slot = 'principale'
       AND m.rimosso_il IS NULL
       AND btrim(COALESCE(m.alt, '')) <> ''
       AND (NOT m.ritrae_persone OR m.liberatoria_ok)
  ) THEN
    RAISE EXCEPTION 'shop_pubblicazione_negata: manca la foto principale con il testo alternativo' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.shop_varianti v
     WHERE v.prodotto_id = NEW.id
       AND v.attiva
       AND btrim(COALESCE(v.sku, '')) <> ''
       AND COALESCE(v.prezzo_cent, NEW.prezzo_cent) > 0
  ) THEN
    RAISE EXCEPTION 'shop_pubblicazione_negata: manca una variante attiva con SKU e prezzo' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

CREATE OR REPLACE TRIGGER shop_controlla_pubblicazione_nuovo
  BEFORE INSERT ON public.shop_prodotti
  FOR EACH ROW WHEN (NEW.stato = 'pubblicato')
  EXECUTE FUNCTION public.shop_controlla_pubblicazione();

CREATE OR REPLACE TRIGGER shop_controlla_pubblicazione_stato
  BEFORE UPDATE OF stato ON public.shop_prodotti
  FOR EACH ROW WHEN (NEW.stato = 'pubblicato' AND OLD.stato IS DISTINCT FROM 'pubblicato')
  EXECUTE FUNCTION public.shop_controlla_pubblicazione();

-- Le funzioni le chiama solo il server (stessa regola di promemoria_aggancia); la funzione del
-- trigger non la chiama nessuno: la esegue il database da sé, quindi niente GRANT.
REVOKE ALL ON FUNCTION public.shop_giacenza_muovi(uuid, integer, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_giacenza_imposta(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_impostazione_imposta(text, jsonb, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_controlla_pubblicazione() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_giacenza_muovi(uuid, integer, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_giacenza_imposta(uuid, integer, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.shop_impostazione_imposta(text, jsonb, jsonb, text) TO service_role;

-- ── 7. Le viste per il sito pubblico (D1, seconda difesa) ────────────────────
-- Il server pubblico legge SOLO da qui. Sono viste normali (girano con i diritti del
-- proprietario, quindi non le ferma la protezione per riga delle tabelle) e proprio
-- per questo NESSUNO le legge tranne service_role: niente GRANT ad anon/authenticated.
-- Le colonne sono quelle delle tabelle, meno tutto ciò che non è pubblico: mai la
-- giacenza (la variante porta «disponibile»), mai bozza_modifiche, note, fornitore,
-- canali, origine. Le righe: solo prodotti PUBBLICATI; foto e varianti solo se il loro
-- prodotto è pubblicato (la foto di una bozza non esce, nemmeno il suo percorso).
CREATE OR REPLACE VIEW public.shop_v_prodotti AS
SELECT
  p.id,
  p.sku,
  p.slug,
  p.nome,
  p.tipo,
  p.stato,
  p.prezzo_cent,
  p.marca,
  p.riga_presentazione,
  p.descrizione_breve,
  p.descrizione_lunga,
  p.per_chi,
  (SELECT COALESCE(jsonb_agg(x), '[]'::jsonb)
     FROM jsonb_array_elements(p.caratteristiche) AS x
    WHERE x ->> 'stato' = 'confermato') AS caratteristiche,
  jsonb_build_object(
    'passi', p.contenuto -> 'passi',
    'confezione', p.contenuto -> 'confezione',
    'avvertenze', p.contenuto -> 'avvertenze',
    'faq', p.contenuto -> 'faq'
  ) AS contenuto,
  (SELECT COALESCE(jsonb_agg(jsonb_build_object('slug', c.slug, 'nome', c.nome) ORDER BY c.ordine, c.nome), '[]'::jsonb)
     FROM public.shop_prodotti_categorie pc
     JOIN public.shop_categorie c ON c.id = pc.categoria_id
    WHERE pc.prodotto_id = p.id AND c.visibile) AS categorie,
  p.reso_consentito,
  p.reso_giorni,
  p.box_consulenza,
  c2.id AS correlato_id,
  p.gtin,
  p.seo_titolo,
  p.seo_descrizione,
  p.seo_media_id,
  p.aggiornato_il,
  p.pubblicato_il
FROM public.shop_prodotti p
LEFT JOIN public.shop_prodotti c2 ON c2.id = p.correlato_id AND c2.stato = 'pubblicato'
WHERE p.stato = 'pubblicato';

CREATE OR REPLACE VIEW public.shop_v_varianti AS
SELECT
  v.id,
  v.prodotto_id,
  v.sku,
  v.nome,
  v.opzioni,
  v.prezzo_cent,
  COALESCE(v.prezzo_cent, p.prezzo_cent) AS prezzo_effettivo_cent,
  v.attiva,
  (v.giacenza > 0 AND v.attiva) AS disponibile,
  v.gtin,
  v.ordine
FROM public.shop_varianti v
JOIN public.shop_prodotti p ON p.id = v.prodotto_id
WHERE p.stato = 'pubblicato';

CREATE OR REPLACE VIEW public.shop_v_media AS
SELECT
  m.id,
  m.prodotto_id,
  m.categoria_id,
  m.variante_id,
  m.slot,
  m.sotto_ruolo,
  m.tipo,
  m.path_480,
  m.path_960,
  m.path_1600,
  m.path_video,
  m.path_copertina,
  m.durata_s,
  m.alt,
  m.testo_parlato,
  m.sottotitoli_ok,
  m.muto,
  m.ritrae_persone,
  m.liberatoria_ok,
  m.valore_opzione,
  m.ordine,
  m.rimosso_il
FROM public.shop_media m
WHERE m.rimosso_il IS NULL
  AND (NOT m.ritrae_persone OR m.liberatoria_ok)
  AND (
    EXISTS (SELECT 1 FROM public.shop_prodotti p WHERE p.id = m.prodotto_id AND p.stato = 'pubblicato')
    OR EXISTS (
      SELECT 1 FROM public.shop_categorie c
       WHERE c.id = m.categoria_id AND c.visibile
         AND EXISTS (
           SELECT 1 FROM public.shop_prodotti_categorie pc
             JOIN public.shop_prodotti pp ON pp.id = pc.prodotto_id AND pp.stato = 'pubblicato'
            WHERE pc.categoria_id = c.id
         )
    )
  );

CREATE OR REPLACE VIEW public.shop_v_categorie AS
SELECT
  c.id,
  c.slug,
  c.nome,
  c.tipo,
  c.frase,
  c.foto_path,
  c.seo_titolo,
  c.seo_descrizione,
  c.ordine,
  c.visibile,
  q.quanti
FROM public.shop_categorie c
CROSS JOIN LATERAL (
  SELECT count(*)::integer AS quanti
    FROM public.shop_prodotti_categorie pc
    JOIN public.shop_prodotti p ON p.id = pc.prodotto_id AND p.stato = 'pubblicato'
   WHERE pc.categoria_id = c.id
) q
WHERE c.visibile AND q.quanti > 0;

REVOKE ALL ON public.shop_v_prodotti FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.shop_v_varianti FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.shop_v_media FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.shop_v_categorie FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.shop_v_prodotti TO service_role;
GRANT SELECT ON public.shop_v_varianti TO service_role;
GRANT SELECT ON public.shop_v_media TO service_role;
GRANT SELECT ON public.shop_v_categorie TO service_role;

-- ── 8. I due interruttori di partenza (mai riscritti se già presenti) ────────
INSERT INTO public.shop_impostazioni (chiave, valore)
VALUES ('catalogo_sito', '"codice"'::jsonb), ('giacenza_bassa', '3'::jsonb)
ON CONFLICT (chiave) DO NOTHING;

-- ── 9. Il bucket delle foto: pubblico, 25 MB, sei tipi; uno già presente non si cambia ──
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shop-media', 'shop-media', true, 26214400, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4', 'video/quicktime'])
ON CONFLICT (id) DO NOTHING;

COMMIT;

NOTIFY pgrst, 'reload schema';
