-- ─────────────────────────────────────────────────────────────────────────────
-- IL PONTE WHATSAPP · MEDIA IN CHAT · A · I TIPI, I LIMITI E LE RICHIESTE DI «MOSTRA»
--
-- Commessa 2026-10-31-media-e-archiviazione (T1, PIANO (e)). Il ponte porta in
-- chat, oltre alle foto, anche vocali, video, PDF e documenti Office. Come il
-- 30/10, il Worker non vede mai i byte e il Mac non ha chiavi di Supabase: il Mac
-- chiede il permesso, carica da solo in Storage e dice «fatto». Questa migrazione
-- allarga quello che il database sa (tipi, limiti, colonne per la bolla) e crea la
-- tabella delle richieste di «Mostra» (il segnaposto che il titolare vuole
-- scaricare). Le funzioni di timer, liberazione e pannello stanno nella migrazione
-- B (20261031130000); il cron nella C (20261031140000), per ultima.
--
-- ⚠️ ORDINE DI MESSA IN OPERA: codice → A → B → aggiorna il Mac → C.
--
-- COSA FA (solo aggiunte e allargamenti: nessuna riga esistente cambia)
--   · Il bucket «ponte-media»: da 8 MiB e 3 tipi a 45 MiB e 16 tipi. L'UPDATE scatta
--     SOLO se il bucket è ancora com'era la migrazione del 30/10 (privato, 8 MiB,
--     esattamente jpeg/png/webp): un bucket cambiato a mano resta com'è. 45 MiB
--     (47.185.920 byte) sta sotto il limite globale di Supabase (50 MB): nessun
--     intervento sul pannello Supabase. Nessuna policy su storage.objects.
--   · Tre funzioni di servizio, IMMUTABLE, la sola tabella dei tipi del database:
--       ponte_wa_media_categoria(mime)   → 'foto' | 'audio' | 'video' | 'documento' | NULL
--       ponte_wa_media_limite(categoria) → 8 MiB | 16 MiB | 45 MiB | 25 MiB
--       ponte_wa_media_estensione(mime)  → l'estensione del percorso (jpg, ogg, mp4, pdf…)
--     (la terza non è nel PIANO: serve a permesso e richiedi, evita la tabella doppia.)
--   · ponte_wa_media: colonne nuove categoria (di serie 'foto': le righe del 30/10
--     restano valide), nome, durata_s, larghezza, altezza, miniatura (il
--     jpegThumbnail di WhatsApp: al più 12.000 caratteri, solo base64 JPEG — è testo del
--     mittente e finisce in «data:image/jpeg;base64,»), scade_il (NULL = tieni sempre),
--     liberato_il. Gli stati diventano in_caricamento | pronta | liberato. «liberato» =
--     il file non c'è più e restano solo categoria e peso: nome e miniatura si azzerano.
--     I CHECK di mime, stato e byte si ALLARGANO (stesso nome, dentro BEGIN/COMMIT:
--     non c'è mai un attimo senza CHECK).
--   · Due indici (gli unici): (user_id, path) — la lettura di un file cerca per
--     percorso e oggi non ha indice — e uno parziale su scade_il per il cron.
--   · ponte_wa_media_richieste — una riga per «Mostra» (user_id, chiave). Il Mac la
--     scopre dal battito (60 s), la prende, scarica e la chiude. L'utente la LEGGE
--     (RLS, solo le sue); scrive solo il server con la chiave di servizio.
--   · Le funzioni (tutte SECURITY DEFINER, search_path fisso, EXECUTE solo a service_role):
--       ponte_wa_media_permesso(uuid, text, text, text, bigint, bigint)  [stessa firma del 30/10]
--          {"esito":"carica","path":"<user_id>/<uuid>.<ext>"} | {"esito":"gia_presente"}
--          | {"esito":"rifiutato","motivo":"tipo"|"troppo_grande"|"tetto"|"liberato"}
--          Il tipo e il limite sono quelli della categoria. Una riga «liberato» non si
--          riscarica da sola (solo una richiesta del titolare la rimette in coda).
--       ponte_wa_media_fatto(uuid, text)                                  [stessa firma]
--          {"ok":false,"stato":"assente"} | {"ok":true,"stato":"in_caricamento"}
--          | {"ok":true,"stato":"pronta","byte":n,"mime":"<quello di storage.objects>"}
--          | {"ok":true,"stato":"tipo"|"troppo_grande","path":"<da rimuovere>"}
--          IL TIPO LO DECIDE STORAGE, non il mittente: si legge metadata.mimetype
--          dell'oggetto, lo si accetta solo se sta nella categoria della riga e si
--          RISCRIVE `mime` con quello. Altrimenti la riga passa a «liberato» e il
--          Worker rimuove l'oggetto (`path`). Se la richiesta di «Mostra» aveva un
--          timer, parte ora (scade_il) e la richiesta, compiuta, si cancella.
--       ponte_wa_media_dettagli(uuid, text, text, int, int, int, text) → void
--          nome, durata, dimensioni e miniatura per la bolla; valori fuori misura = NULL,
--          mai un errore; non scrive sulle righe liberate.
--       ponte_wa_media_richiedi(uuid, text, int) → jsonb
--          {"esito":"in_attesa"} | {"esito":"gia_pronta"} | {"esito":"non_trovata"}
--          non_trovata = la chiave non è in whatsapp_messages dell'utente (il segnaposto si
--          riconosce dal testo, che un cliente può scrivere: la richiesta non nasce da lì).
--          Su una riga liberato la rimette in_caricamento con un percorso NUOVO; su una
--          richiesta non_disponibile («Riprova») la riporta a in_attesa.
--       ponte_wa_media_prendi(uuid, int) → text[]
--          fino a 5 chiavi, in_attesa → in_corso (FOR UPDATE SKIP LOCKED); una in_corso
--          da più di 10 minuti si riassegna.
--       ponte_wa_media_richiesta_esito(uuid, text, text) → {"ok":true}
--          esiti: non_catalogato, scaduta, troppo_grande, tipo, tetto, spenta, errore.
--          Altro = 22023. Se «Mostra» aveva riportato una riga liberato a in_caricamento e
--          il lavoro fallisce, la riga torna liberato (senza oggetto).
--       ponte_wa_media_pulizia() → {"richieste":n,"liberate":n,"path":[…]}
--          Le pulizie del cron: richieste di più di 7 giorni (cancellate), righe
--          in_caricamento da più di 3 giorni (liberate: i `path` che hanno ancora un
--          oggetto sono da rimuovere in Storage). Al più 200 righe per volta.
--   · permesso e fatto sono la stessa firma di prima: CREATE OR REPLACE, nessun
--     sovraccarico, nessuna ambiguità per PostgREST. Un Mac vecchio collegato mentre
--     si applica continua a funzionare (le foto passano come prima).
--
-- ⚠️ La tabella dice chi ha scritto a chi: REVOKE ALL da anon e authenticated (su
--    Supabase ricevono di serie anche INSERT, UPDATE e DELETE), poi GRANT SELECT ad
--    authenticated. La nuova tabella e le nuove funzioni non danno al browser NESSUNA
--    scrittura.
-- ⚠️ Applicarla due volte non fa danni (IF NOT EXISTS, OR REPLACE, CHECK saltati se già
--    larghi, UPDATE del bucket che non scatta più). Se un CHECK avesse un nome
--    inatteso la migrazione si FERMA con un errore e annulla tutto (è in una
--    transazione): non lascia due CHECK sovrapposti.
-- ⚠️ Il codice pubblicato funziona anche SENZA questa migrazione: media_permesso
--    risponde 503 «migrazione» e il Mac TRATTIENE i file invece di perderli.
-- ⚠️ NON la lancia la squadra: la applica il titolare, dopo averla letta e dopo il
--    collaudo prove/sql/ponte-media-archivio.sql su un database di prova.
--
-- COME SI ANNULLA (solo se serve davvero; MAI eseguito dalla squadra):
--   DROP FUNCTION public.ponte_wa_media_pulizia();
--   DROP FUNCTION public.ponte_wa_media_richiesta_esito(uuid, text, text);
--   DROP FUNCTION public.ponte_wa_media_prendi(uuid, integer);
--   DROP FUNCTION public.ponte_wa_media_richiedi(uuid, text, integer);
--   DROP FUNCTION public.ponte_wa_media_dettagli(uuid, text, text, integer, integer, integer, text);
--   DROP TABLE public.ponte_wa_media_richieste;
--   -- permesso e fatto tornano com'erano rilanciando 20261030170000_ponte_immagini.sql (CREATE OR REPLACE).
--   -- Il bucket torna a 8 MiB e 3 tipi (prima va rimossa ogni riga/oggetto che non sia una foto):
--   UPDATE storage.buckets SET file_size_limit = 8388608, allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
--    WHERE id = 'ponte-media';
--   -- Le colonne nuove di ponte_wa_media, le tre funzioni di servizio e i CHECK allargati si lasciano
--   -- (non danno fastidio). Gli oggetti già in Storage non si cancellano da SQL.
--
-- VERIFICA, dopo averla applicata (tutte in sola lettura):
--   SELECT id, public, file_size_limit, array_length(allowed_mime_types, 1) FROM storage.buckets WHERE id = 'ponte-media';
--      → public = false, 47185920, 16
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid = 'public.ponte_wa_media'::regclass AND contype = 'c' ORDER BY conname;
--      → mime, stato e byte allargati; categoria e miniatura nuovi
--   SELECT count(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND (coalesce(qual,'') || coalesce(with_check,'')) ~ 'ponte-media';
--      → 0
--   SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'ponte_wa_media_richieste';
--      → una riga: users read own ponte media richieste | SELECT | {authenticated}
--   SELECT public.ponte_wa_media_categoria('audio/ogg'), public.ponte_wa_media_limite('video');
--      → audio | 47185920
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Il bucket: 45 MiB e 16 tipi (solo se è ancora quello di serie) ────────
-- foto: jpeg png webp · audio: ogg mp4 mpeg aac amr · video: mp4 3gpp quicktime webm
-- documento: pdf docx xlsx pptx. Mai SVG, HTML, ZIP, OLE, testo.
UPDATE storage.buckets
   SET file_size_limit = 47185920,
       allowed_mime_types = ARRAY[
         'image/jpeg', 'image/png', 'image/webp',
         'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/amr',
         'video/mp4', 'video/3gpp', 'video/quicktime', 'video/webm',
         'application/pdf',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.openxmlformats-officedocument.presentationml.presentation']
 WHERE id = 'ponte-media'
   AND public = false
   AND file_size_limit = 8388608
   AND allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- ── 2. La tabella dei tipi, una sola, nel database ───────────────────────────
CREATE OR REPLACE FUNCTION public.ponte_wa_media_categoria(p_mime text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_mime
    WHEN 'image/jpeg' THEN 'foto'
    WHEN 'image/png' THEN 'foto'
    WHEN 'image/webp' THEN 'foto'
    WHEN 'audio/ogg' THEN 'audio'
    WHEN 'audio/mp4' THEN 'audio'
    WHEN 'audio/mpeg' THEN 'audio'
    WHEN 'audio/aac' THEN 'audio'
    WHEN 'audio/amr' THEN 'audio'
    WHEN 'video/mp4' THEN 'video'
    WHEN 'video/3gpp' THEN 'video'
    WHEN 'video/quicktime' THEN 'video'
    WHEN 'video/webm' THEN 'video'
    WHEN 'application/pdf' THEN 'documento'
    WHEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' THEN 'documento'
    WHEN 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' THEN 'documento'
    WHEN 'application/vnd.openxmlformats-officedocument.presentationml.presentation' THEN 'documento'
  END $$;

CREATE OR REPLACE FUNCTION public.ponte_wa_media_limite(p_categoria text)
RETURNS bigint
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_categoria
    WHEN 'foto' THEN 8388608::bigint          -- 8 MiB
    WHEN 'audio' THEN 16777216::bigint        -- 16 MiB
    WHEN 'video' THEN 47185920::bigint        -- 45 MiB
    WHEN 'documento' THEN 26214400::bigint    -- 25 MiB
  END $$;

CREATE OR REPLACE FUNCTION public.ponte_wa_media_estensione(p_mime text)
RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_mime
    WHEN 'image/jpeg' THEN 'jpg'
    WHEN 'image/png' THEN 'png'
    WHEN 'image/webp' THEN 'webp'
    WHEN 'audio/ogg' THEN 'ogg'
    WHEN 'audio/mp4' THEN 'm4a'
    WHEN 'audio/mpeg' THEN 'mp3'
    WHEN 'audio/aac' THEN 'aac'
    WHEN 'audio/amr' THEN 'amr'
    WHEN 'video/mp4' THEN 'mp4'
    WHEN 'video/3gpp' THEN '3gp'
    WHEN 'video/quicktime' THEN 'mov'
    WHEN 'video/webm' THEN 'webm'
    WHEN 'application/pdf' THEN 'pdf'
    WHEN 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' THEN 'docx'
    WHEN 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' THEN 'xlsx'
    WHEN 'application/vnd.openxmlformats-officedocument.presentationml.presentation' THEN 'pptx'
  END $$;

-- ── 3. Le colonne nuove di ponte_wa_media ────────────────────────────────────
ALTER TABLE public.ponte_wa_media
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'foto' CHECK (categoria IN ('foto', 'audio', 'video', 'documento')),
  ADD COLUMN IF NOT EXISTS nome text,
  ADD COLUMN IF NOT EXISTS durata_s integer,
  ADD COLUMN IF NOT EXISTS larghezza integer,
  ADD COLUMN IF NOT EXISTS altezza integer,
  ADD COLUMN IF NOT EXISTS miniatura text CHECK (miniatura IS NULL OR (length(miniatura) <= 12000 AND miniatura ~ '^/9j/[A-Za-z0-9+/]*={0,2}$')),
  ADD COLUMN IF NOT EXISTS scade_il timestamptz,
  ADD COLUMN IF NOT EXISTS liberato_il timestamptz;

-- ── 4. I CHECK di mime, stato e byte, allargati (saltati se già larghi) ──────
-- I nomi sono quelli automatici di Postgres (<tabella>_<colonna>_check): il collaudo
-- prove/sql/ponte-media-archivio.sql li verifica. Se dopo il cambio un CHECK avesse un
-- altro nome o ce ne fossero due sulla stessa colonna, si ferma e annulla tutto.
DO $do$
DECLARE
  v_col text;
  v_n   integer;
  v_nome text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.ponte_wa_media'::regclass AND conname = 'ponte_wa_media_mime_check'
                    AND pg_get_constraintdef(oid) LIKE '%audio/ogg%') THEN
    ALTER TABLE public.ponte_wa_media DROP CONSTRAINT IF EXISTS ponte_wa_media_mime_check;
    ALTER TABLE public.ponte_wa_media ADD CONSTRAINT ponte_wa_media_mime_check CHECK (mime IN (
      'image/jpeg', 'image/png', 'image/webp',
      'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/aac', 'audio/amr',
      'video/mp4', 'video/3gpp', 'video/quicktime', 'video/webm',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.ponte_wa_media'::regclass AND conname = 'ponte_wa_media_stato_check'
                    AND pg_get_constraintdef(oid) LIKE '%liberato%') THEN
    ALTER TABLE public.ponte_wa_media DROP CONSTRAINT IF EXISTS ponte_wa_media_stato_check;
    ALTER TABLE public.ponte_wa_media ADD CONSTRAINT ponte_wa_media_stato_check CHECK (stato IN ('in_caricamento', 'pronta', 'liberato'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.ponte_wa_media'::regclass AND conname = 'ponte_wa_media_byte_check'
                    AND pg_get_constraintdef(oid) LIKE '%47185920%') THEN
    ALTER TABLE public.ponte_wa_media DROP CONSTRAINT IF EXISTS ponte_wa_media_byte_check;
    ALTER TABLE public.ponte_wa_media ADD CONSTRAINT ponte_wa_media_byte_check CHECK (byte BETWEEN 0 AND 47185920);
  END IF;
  -- Controllo: per ciascuna colonna UN solo CHECK che la nomini, col nome atteso.
  FOREACH v_col IN ARRAY ARRAY['mime', 'stato', 'byte'] LOOP
    SELECT count(*), min(conname) INTO v_n, v_nome
      FROM pg_constraint
     WHERE conrelid = 'public.ponte_wa_media'::regclass AND contype = 'c'
       AND pg_get_constraintdef(oid) ~ ('\m' || v_col || '\M');
    IF v_n <> 1 OR v_nome <> 'ponte_wa_media_' || v_col || '_check' THEN
      RAISE EXCEPTION 'ponte_wa_media: i CHECK della colonna % non sono quelli attesi (%, %): migrazione annullata', v_col, v_n, v_nome;
    END IF;
  END LOOP;
END $do$;

-- ── 5. Gli indici ────────────────────────────────────────────────────────────
-- La lettura di un file cerca per (user_id, path): oggi senza indice.
CREATE INDEX IF NOT EXISTS idx_ponte_media_path
  ON public.ponte_wa_media (user_id, path);
-- Il cron delle scadenze guarda solo le pronte con un timer.
CREATE INDEX IF NOT EXISTS idx_ponte_media_scadenza
  ON public.ponte_wa_media (scade_il)
  WHERE stato = 'pronta' AND scade_il IS NOT NULL;

-- ── 6. Le richieste di «Mostra» ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ponte_wa_media_richieste (
  user_id uuid NOT NULL,
  -- la stessa chiave del messaggio in whatsapp_messages.wa_message_id: bw:<numero>:<id>
  chiave text NOT NULL CHECK (chiave ~ '^bw:[0-9]{8,15}:[A-Za-z0-9_.-]{1,128}$'),
  numero text NOT NULL CHECK (numero ~ '^[0-9]{8,15}$'),
  -- NULL = tieni sempre; altrimenti uno dei 5 timer (5 min, 1 h, 24 h, 7 g, 30 g)
  timer_s integer CHECK (timer_s IS NULL OR timer_s IN (300, 3600, 86400, 604800, 2592000)),
  stato text NOT NULL DEFAULT 'in_attesa' CHECK (stato IN ('in_attesa', 'in_corso', 'non_disponibile')),
  motivo text CHECK (motivo IS NULL OR motivo IN ('non_catalogato', 'scaduta', 'troppo_grande', 'tipo', 'tetto', 'spenta', 'errore')),
  creata_il timestamptz NOT NULL DEFAULT now(),
  presa_il timestamptz,
  PRIMARY KEY (user_id, chiave)
);

ALTER TABLE public.ponte_wa_media_richieste ENABLE ROW LEVEL SECURITY;

-- Una sola policy, di lettura, della stessa forma di ponte_wa_media. Nessuna di scrittura.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'ponte_wa_media_richieste'
       AND policyname = 'users read own ponte media richieste'
  ) THEN
    CREATE POLICY "users read own ponte media richieste"
      ON public.ponte_wa_media_richieste FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $do$;

REVOKE ALL ON public.ponte_wa_media_richieste FROM anon, authenticated;
GRANT SELECT ON public.ponte_wa_media_richieste TO authenticated;
GRANT ALL ON public.ponte_wa_media_richieste TO service_role;

-- ── 7. Il permesso di caricare (stessa firma del 30/10) ──────────────────────
CREATE OR REPLACE FUNCTION public.ponte_wa_media_permesso(
  p_user_id uuid, p_chiave text, p_numero text, p_mime text, p_byte bigint, p_tetto_byte bigint)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_riga   public.ponte_wa_media%ROWTYPE;
  v_cat    text;
  v_ext    text;
  v_path   text;
  v_usato  bigint;
  v_esiste boolean;
  v_chiuso jsonb;
BEGIN
  -- Dati sbagliati dal chiamante: errore chiaro, non un rifiuto (la rotta li ha già controllati).
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'ponte_wa_media_permesso: utente mancante' USING ERRCODE = '22023';
  END IF;
  IF p_numero IS NULL OR p_numero !~ '^[0-9]{8,15}$' THEN
    RAISE EXCEPTION 'ponte_wa_media_permesso: numero non valido' USING ERRCODE = '22023';
  END IF;
  IF p_chiave IS NULL OR p_chiave !~ '^bw:[0-9]{8,15}:[A-Za-z0-9_.-]{1,128}$'
     OR p_chiave NOT LIKE 'bw:' || p_numero || ':%' THEN
    RAISE EXCEPTION 'ponte_wa_media_permesso: chiave non valida' USING ERRCODE = '22023';
  END IF;

  -- Il tipo (confronto esatto, una sola tabella) e il peso: i rifiuti definitivi, con il limite della categoria.
  v_cat := public.ponte_wa_media_categoria(p_mime);
  IF v_cat IS NULL THEN
    RETURN jsonb_build_object('esito', 'rifiutato', 'motivo', 'tipo');
  END IF;
  IF p_byte IS NULL OR p_byte < 1 OR p_byte > public.ponte_wa_media_limite(v_cat) THEN
    RETURN jsonb_build_object('esito', 'rifiutato', 'motivo', 'troppo_grande');
  END IF;
  v_ext := public.ponte_wa_media_estensione(p_mime);

  -- Già nota? Pronta → niente da fare. Liberata → non si riscarica da sola (solo una richiesta
  -- del titolare la rimette in coda). In caricamento, ma l'oggetto è già in Storage (il Mac ha
  -- caricato e non ha fatto in tempo a dire «fatto»): si chiude con le stesse regole di «fatto»,
  -- altrimenti un secondo caricamento fallirebbe.
  SELECT * INTO v_riga FROM public.ponte_wa_media WHERE user_id = p_user_id AND chiave = p_chiave;
  v_esiste := FOUND;
  IF v_esiste THEN
    IF v_riga.stato = 'pronta' THEN
      RETURN jsonb_build_object('esito', 'gia_presente');
    END IF;
    IF v_riga.stato = 'liberato' THEN
      RETURN jsonb_build_object('esito', 'rifiutato', 'motivo', 'liberato');
    END IF;
    v_chiuso := public.ponte_wa_media_fatto(p_user_id, p_chiave);
    IF v_chiuso ->> 'stato' = 'pronta' THEN
      RETURN jsonb_build_object('esito', 'gia_presente');
    ELSIF v_chiuso ->> 'stato' IN ('tipo', 'troppo_grande') THEN
      -- l'oggetto sbagliato resta in Storage: la riga è «liberato», ci pensa la scopa degli orfani
      RETURN jsonb_build_object('esito', 'rifiutato', 'motivo', v_chiuso ->> 'stato');
    END IF;
  END IF;

  -- Il tetto: peso vero degli oggetti di ponte-media, più i caricamenti in corso
  -- (meno di due ore, senza oggetto ancora) col peso dichiarato; esclusa questa
  -- stessa riga, che si sta riproponendo. Un tetto assente vale zero: rifiuta.
  SELECT coalesce(sum(CASE WHEN o.metadata ->> 'size' ~ '^[0-9]{1,12}$' THEN (o.metadata ->> 'size')::bigint ELSE 0 END), 0)
    INTO v_usato
    FROM storage.objects o
   WHERE o.bucket_id = 'ponte-media';
  v_usato := v_usato + coalesce((
    SELECT sum(m.byte) FROM public.ponte_wa_media m
     WHERE m.stato = 'in_caricamento'
       AND m.created_at > now() - interval '2 hours'
       AND NOT (m.user_id = p_user_id AND m.chiave = p_chiave)
       AND NOT EXISTS (SELECT 1 FROM storage.objects o2 WHERE o2.bucket_id = 'ponte-media' AND o2.name = m.path)
  ), 0);
  IF v_usato + p_byte > coalesce(p_tetto_byte, 0) THEN
    RETURN jsonb_build_object('esito', 'rifiutato', 'motivo', 'tetto');
  END IF;

  -- Via libera. Il percorso nasce una volta sola e si ricorda: la stessa chiave
  -- chiesta due volte torna con lo stesso percorso (due richieste insieme: vince
  -- la prima riga, l'altra la legge).
  IF NOT v_esiste THEN
    v_path := p_user_id::text || '/' || gen_random_uuid()::text || '.' || v_ext;
    INSERT INTO public.ponte_wa_media (user_id, chiave, numero, path, mime, byte, categoria)
    VALUES (p_user_id, p_chiave, p_numero, v_path, p_mime, p_byte, v_cat)
    ON CONFLICT (user_id, chiave) DO NOTHING;
    SELECT * INTO v_riga FROM public.ponte_wa_media WHERE user_id = p_user_id AND chiave = p_chiave;
  END IF;
  RETURN jsonb_build_object('esito', 'carica', 'path', v_riga.path);
END $$;

-- ── 8. «Fatto»: peso e tipo sono quelli di Storage ───────────────────────────
CREATE OR REPLACE FUNCTION public.ponte_wa_media_fatto(p_user_id uuid, p_chiave text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_riga  public.ponte_wa_media%ROWTYPE;
  v_size  bigint;
  v_mime  text;
  v_timer integer;
BEGIN
  SELECT * INTO v_riga FROM public.ponte_wa_media WHERE user_id = p_user_id AND chiave = p_chiave;
  -- Nessuna riga, o una riga liberata (il file non c'è più e non si ripristina da qui): niente da fare.
  IF NOT FOUND OR v_riga.stato = 'liberato' THEN
    RETURN jsonb_build_object('ok', false, 'stato', 'assente');
  END IF;
  IF v_riga.stato = 'pronta' THEN
    RETURN jsonb_build_object('ok', true, 'stato', 'pronta', 'byte', v_riga.byte, 'mime', v_riga.mime);
  END IF;

  -- Il Mac può dichiarare un peso e un tipo qualunque: contano quelli dell'oggetto in Storage.
  -- Un peso illeggibile non vale come «caricato».
  SELECT (o.metadata ->> 'size')::bigint, o.metadata ->> 'mimetype' INTO v_size, v_mime
    FROM storage.objects o
   WHERE o.bucket_id = 'ponte-media' AND o.name = v_riga.path
     AND o.metadata ->> 'size' ~ '^[0-9]{1,12}$'
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'stato', 'in_caricamento');
  END IF;

  -- Il tipo registrato da Storage deve stare nella categoria della riga; il peso entro il suo limite.
  -- Altrimenti la riga non diventa pronta: passa a «liberato» (nome e miniatura via) e il Worker
  -- rimuove l'oggetto.
  IF v_mime IS NULL OR public.ponte_wa_media_categoria(v_mime) IS DISTINCT FROM v_riga.categoria THEN
    UPDATE public.ponte_wa_media
       SET stato = 'liberato', liberato_il = now(), scade_il = NULL, nome = NULL, miniatura = NULL
     WHERE user_id = p_user_id AND chiave = p_chiave AND stato = 'in_caricamento';
    RETURN jsonb_build_object('ok', true, 'stato', 'tipo', 'path', v_riga.path);
  END IF;
  IF v_size > public.ponte_wa_media_limite(v_riga.categoria) THEN
    UPDATE public.ponte_wa_media
       SET stato = 'liberato', liberato_il = now(), scade_il = NULL, nome = NULL, miniatura = NULL
     WHERE user_id = p_user_id AND chiave = p_chiave AND stato = 'in_caricamento';
    RETURN jsonb_build_object('ok', true, 'stato', 'troppo_grande', 'path', v_riga.path);
  END IF;

  -- Il timer scelto con «Mostra» parte ora che il file è pronto.
  SELECT r.timer_s INTO v_timer FROM public.ponte_wa_media_richieste r
   WHERE r.user_id = p_user_id AND r.chiave = p_chiave AND r.stato IN ('in_attesa', 'in_corso');
  UPDATE public.ponte_wa_media
     SET stato = 'pronta', byte = v_size, mime = v_mime,
         scade_il = CASE WHEN v_timer IS NULL THEN NULL ELSE now() + make_interval(secs => v_timer) END
   WHERE user_id = p_user_id AND chiave = p_chiave AND stato = 'in_caricamento';
  -- La richiesta è compiuta: la bolla ora legge la riga pronta. Cancellarla evita che una in_corso
  -- si riassegni dopo 10 minuti per un file già pronto.
  DELETE FROM public.ponte_wa_media_richieste WHERE user_id = p_user_id AND chiave = p_chiave;
  RETURN jsonb_build_object('ok', true, 'stato', 'pronta', 'byte', v_size, 'mime', v_mime);
END $$;

-- ── 9. Nome, durata, dimensioni e miniatura per la bolla ─────────────────────
-- Valori fuori misura = ignorati (NULL → resta quello di prima), mai un errore. Non scrive
-- sulle righe liberate: dopo «Libera» di quel file non resta niente di leggibile.
CREATE OR REPLACE FUNCTION public.ponte_wa_media_dettagli(
  p_user_id uuid, p_chiave text, p_nome text, p_durata_s integer, p_larghezza integer, p_altezza integer, p_miniatura text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'ponte_wa_media_dettagli: utente mancante' USING ERRCODE = '22023';
  END IF;
  IF p_chiave IS NULL OR p_chiave !~ '^bw:[0-9]{8,15}:[A-Za-z0-9_.-]{1,128}$' THEN
    RAISE EXCEPTION 'ponte_wa_media_dettagli: chiave non valida' USING ERRCODE = '22023';
  END IF;
  UPDATE public.ponte_wa_media
     SET nome = coalesce(CASE WHEN length(p_nome) BETWEEN 1 AND 255 THEN p_nome END, nome),
         durata_s = coalesce(CASE WHEN p_durata_s BETWEEN 0 AND 86400 THEN p_durata_s END, durata_s),
         larghezza = coalesce(CASE WHEN p_larghezza BETWEEN 1 AND 20000 THEN p_larghezza END, larghezza),
         altezza = coalesce(CASE WHEN p_altezza BETWEEN 1 AND 20000 THEN p_altezza END, altezza),
         miniatura = coalesce(CASE WHEN length(p_miniatura) <= 12000 AND p_miniatura ~ '^/9j/[A-Za-z0-9+/]*={0,2}$' THEN p_miniatura END, miniatura)
   WHERE user_id = p_user_id AND chiave = p_chiave AND stato <> 'liberato';
END $$;

-- ── 10. «Mostra»: chiedere di scaricare un media che c'è solo come segnaposto ─
CREATE OR REPLACE FUNCTION public.ponte_wa_media_richiedi(p_user_id uuid, p_chiave text, p_timer_s integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_riga public.ponte_wa_media%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'ponte_wa_media_richiedi: utente mancante' USING ERRCODE = '22023';
  END IF;
  IF p_chiave IS NULL OR p_chiave !~ '^bw:[0-9]{8,15}:[A-Za-z0-9_.-]{1,128}$' THEN
    RAISE EXCEPTION 'ponte_wa_media_richiedi: chiave non valida' USING ERRCODE = '22023';
  END IF;
  IF p_timer_s IS NOT NULL AND p_timer_s <> 0 AND p_timer_s NOT IN (300, 3600, 86400, 604800, 2592000) THEN
    RAISE EXCEPTION 'ponte_wa_media_richiedi: timer non ammesso' USING ERRCODE = '22023';
  END IF;

  -- Il messaggio deve esistere davvero fra quelli dell'utente: il segnaposto si riconosce dal testo,
  -- che un cliente può scrivere; la richiesta non nasce da lì.
  IF NOT EXISTS (SELECT 1 FROM public.whatsapp_messages w WHERE w.user_id = p_user_id AND w.wa_message_id = p_chiave) THEN
    RETURN jsonb_build_object('esito', 'non_trovata');
  END IF;

  SELECT * INTO v_riga FROM public.ponte_wa_media WHERE user_id = p_user_id AND chiave = p_chiave;
  IF FOUND THEN
    IF v_riga.stato = 'pronta' THEN
      RETURN jsonb_build_object('esito', 'gia_pronta');
    ELSIF v_riga.stato = 'liberato' THEN
      -- Si rimette in coda con un percorso NUOVO (quello vecchio può avere ancora una rimozione in corso);
      -- created_at riparte da ora, così la pulizia dei 3 giorni e il tetto contano da adesso.
      UPDATE public.ponte_wa_media
         SET stato = 'in_caricamento',
             path = p_user_id::text || '/' || gen_random_uuid()::text || '.' || public.ponte_wa_media_estensione(mime),
             created_at = now(), liberato_il = NULL, scade_il = NULL
       WHERE user_id = p_user_id AND chiave = p_chiave AND stato = 'liberato';
    END IF;
  END IF;

  -- Due richieste = una riga. Una non_disponibile («Riprova») torna in_attesa; una viva resta com'è
  -- (cambia solo il timer, l'ultima scelta vale).
  INSERT INTO public.ponte_wa_media_richieste AS r (user_id, chiave, numero, timer_s)
  VALUES (p_user_id, p_chiave, split_part(p_chiave, ':', 2), NULLIF(p_timer_s, 0))
  ON CONFLICT (user_id, chiave) DO UPDATE
     SET stato = CASE WHEN r.stato = 'non_disponibile' THEN 'in_attesa' ELSE r.stato END,
         motivo = CASE WHEN r.stato = 'non_disponibile' THEN NULL ELSE r.motivo END,
         creata_il = CASE WHEN r.stato = 'non_disponibile' THEN now() ELSE r.creata_il END,
         presa_il = CASE WHEN r.stato = 'non_disponibile' THEN NULL ELSE r.presa_il END,
         timer_s = EXCLUDED.timer_s;
  RETURN jsonb_build_object('esito', 'in_attesa');
END $$;

-- ── 11. Il Mac prende le richieste (al più 5 per volta) ──────────────────────
CREATE OR REPLACE FUNCTION public.ponte_wa_media_prendi(p_user_id uuid, p_max integer)
RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_chiavi text[];
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'ponte_wa_media_prendi: utente mancante' USING ERRCODE = '22023';
  END IF;
  -- SKIP LOCKED: due sessioni insieme non prendono la stessa chiave. Una in_corso da più di
  -- 10 minuti (il Mac non ha risposto) rientra.
  WITH c AS (
    SELECT r.chiave
      FROM public.ponte_wa_media_richieste r
     WHERE r.user_id = p_user_id
       AND (r.stato = 'in_attesa' OR (r.stato = 'in_corso' AND r.presa_il < now() - interval '10 minutes'))
     ORDER BY r.creata_il, r.chiave
     LIMIT least(greatest(coalesce(p_max, 5), 0), 5)
     FOR UPDATE SKIP LOCKED
  ), u AS (
    UPDATE public.ponte_wa_media_richieste r
       SET stato = 'in_corso', presa_il = now()
      FROM c
     WHERE r.user_id = p_user_id AND r.chiave = c.chiave
    RETURNING r.chiave, r.creata_il
  )
  SELECT coalesce(array_agg(u.chiave ORDER BY u.creata_il, u.chiave), '{}') INTO v_chiavi FROM u;
  RETURN v_chiavi;
END $$;

-- ── 12. L'esito di una richiesta che non è andata a buon fine ────────────────
CREATE OR REPLACE FUNCTION public.ponte_wa_media_richiesta_esito(p_user_id uuid, p_chiave text, p_esito text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'ponte_wa_media_richiesta_esito: utente mancante' USING ERRCODE = '22023';
  END IF;
  IF p_chiave IS NULL OR p_chiave !~ '^bw:[0-9]{8,15}:[A-Za-z0-9_.-]{1,128}$' THEN
    RAISE EXCEPTION 'ponte_wa_media_richiesta_esito: chiave non valida' USING ERRCODE = '22023';
  END IF;
  IF p_esito IS NULL OR p_esito NOT IN ('non_catalogato', 'scaduta', 'troppo_grande', 'tipo', 'tetto', 'spenta', 'errore') THEN
    RAISE EXCEPTION 'ponte_wa_media_richiesta_esito: esito non ammesso' USING ERRCODE = '22023';
  END IF;

  UPDATE public.ponte_wa_media_richieste
     SET stato = 'non_disponibile', motivo = p_esito
   WHERE user_id = p_user_id AND chiave = p_chiave;

  -- «Mostra» aveva rimesso in coda una riga liberata: il lavoro è fallito e l'oggetto non c'è,
  -- quindi torna liberata (senza oggetto) invece di restare in caricamento fino alla pulizia.
  UPDATE public.ponte_wa_media m
     SET stato = 'liberato', liberato_il = now(), scade_il = NULL, nome = NULL, miniatura = NULL
   WHERE m.user_id = p_user_id AND m.chiave = p_chiave AND m.stato = 'in_caricamento'
     AND NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'ponte-media' AND o.name = m.path);
  RETURN jsonb_build_object('ok', true);
END $$;

-- ── 13. Le pulizie del cron ──────────────────────────────────────────────────
-- Richieste di più di 7 giorni (chiuse o rimaste appese): cancellate. Righe in_caricamento da più di
-- 3 giorni (un caricamento mai finito): liberate; i percorsi che hanno ancora un oggetto sono da
-- rimuovere in Storage (se la rimozione fallisce, lo trova la scopa degli orfani).
CREATE OR REPLACE FUNCTION public.ponte_wa_media_pulizia()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_richieste integer;
  v_liberate  integer;
  v_path      jsonb;
BEGIN
  DELETE FROM public.ponte_wa_media_richieste WHERE creata_il < now() - interval '7 days';
  GET DIAGNOSTICS v_richieste = ROW_COUNT;

  WITH vecchie AS (
    SELECT m.user_id, m.chiave
      FROM public.ponte_wa_media m
     WHERE m.stato = 'in_caricamento' AND m.created_at < now() - interval '3 days'
     ORDER BY m.created_at
     LIMIT 200
     FOR UPDATE SKIP LOCKED
  ), u AS (
    UPDATE public.ponte_wa_media m
       SET stato = 'liberato', liberato_il = now(), scade_il = NULL, nome = NULL, miniatura = NULL
      FROM vecchie v
     WHERE m.user_id = v.user_id AND m.chiave = v.chiave AND m.stato = 'in_caricamento'
    RETURNING m.path
  )
  SELECT count(*), coalesce(jsonb_agg(x.path ORDER BY x.path) FILTER (WHERE x.ha), '[]'::jsonb)
    INTO v_liberate, v_path
    FROM (SELECT u.path, EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'ponte-media' AND o.name = u.path) AS ha FROM u) x;

  RETURN jsonb_build_object('richieste', v_richieste, 'liberate', v_liberate, 'path', v_path);
END $$;

-- ── 14. Solo il server le chiama ─────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.ponte_wa_media_permesso(uuid, text, text, text, bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ponte_wa_media_permesso(uuid, text, text, text, bigint, bigint) TO service_role;
REVOKE ALL ON FUNCTION public.ponte_wa_media_fatto(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ponte_wa_media_fatto(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.ponte_wa_media_dettagli(uuid, text, text, integer, integer, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ponte_wa_media_dettagli(uuid, text, text, integer, integer, integer, text) TO service_role;
REVOKE ALL ON FUNCTION public.ponte_wa_media_richiedi(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ponte_wa_media_richiedi(uuid, text, integer) TO service_role;
REVOKE ALL ON FUNCTION public.ponte_wa_media_prendi(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ponte_wa_media_prendi(uuid, integer) TO service_role;
REVOKE ALL ON FUNCTION public.ponte_wa_media_richiesta_esito(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ponte_wa_media_richiesta_esito(uuid, text, text) TO service_role;
REVOKE ALL ON FUNCTION public.ponte_wa_media_pulizia() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ponte_wa_media_pulizia() TO service_role;

-- Il server le trova subito, senza aspettare che la cache dello schema si rinnovi da sola.
NOTIFY pgrst, 'reload schema';

COMMIT;
