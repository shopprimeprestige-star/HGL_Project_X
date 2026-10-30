-- ─────────────────────────────────────────────────────────────────────────────
-- IL PONTE WHATSAPP · LE IMMAGINI · il bucket, la tabella e le due funzioni
--
-- Commessa 2026-10-30-ponte-storico-completo (T4, PIANO (c) e (d)). Il ponte sul
-- Mac porta nel CRM anche le FOTO delle chat, ma senza mai far passare i byte dal
-- Worker e senza dare al Mac nessuna chiave di Supabase: il Mac chiede il
-- permesso, il server risponde con un indirizzo di caricamento monouso (valido
-- per UN solo percorso, per circa due ore, senza sovrascrittura), il Mac carica
-- la foto direttamente in Storage e poi dice «fatto». Questa migrazione crea
-- quello che serve al database; il codice che la chiama sta in src/crm/ponte/
-- (media.server.ts) e in strumenti/ponte-whatsapp/ (immagini.mjs).
--
-- COSA AGGIUNGE (solo aggiunte: nessuna riga e nessuna tabella esistente cambia)
--   · il bucket di Storage «ponte-media»: PRIVATO, 8 MiB per file, ammessi solo
--     jpeg, png e webp (mai SVG o HTML). Nessuna policy su storage.objects: le
--     foto si leggono solo con un indirizzo firmato dal server. Non tocca
--     landing-media.
--   · ponte_wa_media — una riga per foto: (user_id, chiave) è la chiave primaria,
--     quindi chiedere due volte lo stesso permesso è la stessa riga (idempotenza,
--     nessun lucchetto). Stato in_caricamento → pronta. L'utente la LEGGE (RLS,
--     solo le sue righe, con la stessa forma della policy di whatsapp_messages:
--     chi vede le chat vede le foto); scrive solo il server con la chiave di
--     servizio.
--   · ponte_wa_media_permesso — controlla tipo e peso, ricorda le foto già
--     presenti, applica il TETTO e dà il percorso in cui caricare. Risponde:
--       {"esito":"carica","path":"<user_id>/<uuid>.<ext>"}
--       {"esito":"gia_presente"}
--       {"esito":"rifiutato","motivo":"tipo" | "troppo_grande" | "tetto"}
--     L'interruttore (acceso/spento) e il valore del tetto sono del SERVER: legge
--     app_config, fa JSON.parse con riserva sicura e passa p_tetto_byte. Chiave,
--     numero o utente non validi sono un errore (22023), mai un rifiuto.
--   · ponte_wa_media_fatto — il Mac dice «caricata»: la funzione NON si fida del
--     peso dichiarato, guarda storage.objects (bucket ponte-media, metadata.size).
--     Se l'oggetto non c'è la riga resta in_caricamento; se c'è prende il suo peso
--     vero e diventa pronta.
--   · una riga di app_config, «ponte_immagini», con valore in TESTO
--     {"acceso":false,"tettoGB":0.8}: di serie le immagini sono SPENTE.
--
-- IL TETTO. 0,8 GB e non di più: il piano gratuito ha 1 GB per tutti i bucket e
-- c'è già landing-media. Si somma SOLO ponte-media, con i pesi veri di
-- storage.objects; le righe in_caricamento da più di due ore (un caricamento
-- fallito) e quelle senza oggetto non pesano per sempre: contano solo se hanno
-- meno di due ore, col peso dichiarato, finché l'oggetto non c'è.
--
-- COME SI ACCENDE E SI SPEGNE (a mano, dal titolare, quando decide):
--   UPDATE public.app_config SET value = '{"acceso":true,"tettoGB":0.8}' WHERE key = 'ponte_immagini';
--   UPDATE public.app_config SET value = '{"acceso":false,"tettoGB":0.8}' WHERE key = 'ponte_immagini';
--   Spento = niente nuovi download; le foto già salvate restano visibili.
--
-- ⚠️ CHI PUÒ CHIAMARE: le due funzioni si fidano di p_user_id, quindi SOLO il
--    server (REVOKE da PUBLIC, anon e authenticated; GRANT a service_role).
-- ⚠️ La tabella dice chi ha scritto a chi: REVOKE ALL da anon e authenticated (su
--    Supabase ricevono di serie anche INSERT, UPDATE e DELETE; la sola RLS non
--    basta), poi GRANT SELECT ad authenticated.
-- ⚠️ ORDINE: dopo 20261030160000_ponte_tutte_le_chat.sql e dopo la creazione di
--    app_config (20260723120000_quote_v3.sql).
-- ⚠️ Applicarla due volte non fa danni (IF NOT EXISTS, OR REPLACE, ON CONFLICT DO
--    NOTHING). Se il bucket «ponte-media» esistesse già con altre regole, resta
--    com'è: la migrazione non riscrive niente.
-- ⚠️ Il codice pubblicato funziona anche SENZA questa migrazione: media_permesso
--    risponde 503 «migrazione» e il Mac TRATTIENE le foto (fino a 14 giorni)
--    invece di perderle.
-- ⚠️ NON la lancia la squadra: la applica il titolare, dopo averla letta e dopo
--    il collaudo prove/sql/ponte-immagini.sql su un database di prova.
--
-- COME SI ANNULLA (solo se serve davvero; MAI eseguito dalla squadra):
--   DROP FUNCTION public.ponte_wa_media_fatto(uuid, text);
--   DROP FUNCTION public.ponte_wa_media_permesso(uuid, text, text, text, bigint, bigint);
--   DROP TABLE public.ponte_wa_media;
--   DELETE FROM public.app_config WHERE key = 'ponte_immagini';
--   Il bucket «ponte-media» si svuota e si elimina dal pannello di Supabase
--   (Storage); le foto già in Storage non si cancellano da SQL.
--
-- VERIFICA, dopo averla applicata (tutte in sola lettura):
--   SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'ponte-media';
--      → public = false, 8388608, {image/jpeg,image/png,image/webp}
--   SELECT value FROM public.app_config WHERE key = 'ponte_immagini';
--      → {"acceso":false,"tettoGB":0.8}
--   SELECT count(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND (coalesce(qual,'') || coalesce(with_check,'')) ~ 'ponte-media';
--      → 0
--   SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'ponte_wa_media';
--      → una riga: users read own ponte media | SELECT | {authenticated}
--   SELECT coalesce(sum(byte), 0) / 1e9 AS gb FROM public.ponte_wa_media;
--      → lo spazio usato, in GB (il tetto è 0,8)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Il bucket: privato, 8 MiB, solo tre tipi di immagine ─────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('ponte-media', 'ponte-media', false, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp'])
  ON CONFLICT (id) DO NOTHING;

-- ── 2. La tabella ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ponte_wa_media (
  user_id uuid NOT NULL,
  -- la stessa chiave del messaggio in whatsapp_messages.wa_message_id: bw:<numero>:<id>
  chiave text NOT NULL CHECK (chiave ~ '^bw:[0-9]{8,15}:[A-Za-z0-9_.-]{1,128}$'),
  numero text NOT NULL CHECK (numero ~ '^[0-9]{8,15}$'),
  -- <user_id>/<uuid casuale>.<estensione>: né il numero né l'id del messaggio
  path text NOT NULL,
  mime text NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
  -- dichiarato dal Mac finché è in_caricamento; poi il peso vero di Storage
  byte bigint NOT NULL CHECK (byte BETWEEN 0 AND 8388608),
  stato text NOT NULL DEFAULT 'in_caricamento' CHECK (stato IN ('in_caricamento', 'pronta')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chiave)
);

-- la chat aperta legge le foto del suo numero
CREATE INDEX IF NOT EXISTS idx_ponte_media_numero
  ON public.ponte_wa_media (user_id, numero);

ALTER TABLE public.ponte_wa_media ENABLE ROW LEVEL SECURITY;

-- Una sola policy, di lettura, identica nella forma a quella di whatsapp_messages.
-- Nessuna di scrittura: scrive il server con la chiave di servizio.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public' AND tablename = 'ponte_wa_media'
       AND policyname = 'users read own ponte media'
  ) THEN
    CREATE POLICY "users read own ponte media"
      ON public.ponte_wa_media FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $do$;

REVOKE ALL ON public.ponte_wa_media FROM anon, authenticated;
GRANT SELECT ON public.ponte_wa_media TO authenticated;
GRANT ALL ON public.ponte_wa_media TO service_role;

-- ── 3. Il permesso di caricare ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ponte_wa_media_permesso(
  p_user_id uuid, p_chiave text, p_numero text, p_mime text, p_byte bigint, p_tetto_byte bigint)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_riga   public.ponte_wa_media%ROWTYPE;
  v_ext    text;
  v_path   text;
  v_size   bigint;
  v_usato  bigint;
  v_esiste boolean;
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

  -- Il tipo (confronto esatto) e il peso dichiarato: i rifiuti definitivi.
  v_ext := CASE p_mime WHEN 'image/jpeg' THEN 'jpg' WHEN 'image/png' THEN 'png' WHEN 'image/webp' THEN 'webp' END;
  IF v_ext IS NULL THEN
    RETURN jsonb_build_object('esito', 'rifiutato', 'motivo', 'tipo');
  END IF;
  IF p_byte IS NULL OR p_byte < 1 OR p_byte > 8388608 THEN
    RETURN jsonb_build_object('esito', 'rifiutato', 'motivo', 'troppo_grande');
  END IF;

  -- Già nota? Pronta → niente da fare. In caricamento, ma l'oggetto è già in
  -- Storage (il Mac ha caricato e non ha fatto in tempo a dire «fatto»): si chiude
  -- qui con il suo peso vero, altrimenti un secondo caricamento fallirebbe.
  SELECT * INTO v_riga FROM public.ponte_wa_media WHERE user_id = p_user_id AND chiave = p_chiave;
  v_esiste := FOUND;
  IF v_esiste THEN
    IF v_riga.stato = 'pronta' THEN
      RETURN jsonb_build_object('esito', 'gia_presente');
    END IF;
    SELECT (o.metadata ->> 'size')::bigint INTO v_size
      FROM storage.objects o
     WHERE o.bucket_id = 'ponte-media' AND o.name = v_riga.path
       AND o.metadata ->> 'size' ~ '^[0-9]{1,12}$'
       AND (o.metadata ->> 'size')::bigint <= 8388608
     LIMIT 1;
    IF v_size IS NOT NULL THEN
      UPDATE public.ponte_wa_media SET stato = 'pronta', byte = v_size
       WHERE user_id = p_user_id AND chiave = p_chiave AND stato = 'in_caricamento';
      RETURN jsonb_build_object('esito', 'gia_presente');
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
    INSERT INTO public.ponte_wa_media (user_id, chiave, numero, path, mime, byte)
    VALUES (p_user_id, p_chiave, p_numero, v_path, p_mime, p_byte)
    ON CONFLICT (user_id, chiave) DO NOTHING;
    SELECT * INTO v_riga FROM public.ponte_wa_media WHERE user_id = p_user_id AND chiave = p_chiave;
  END IF;
  RETURN jsonb_build_object('esito', 'carica', 'path', v_riga.path);
END $$;

-- ── 4. «Fatto»: il peso è quello di Storage ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.ponte_wa_media_fatto(p_user_id uuid, p_chiave text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_riga public.ponte_wa_media%ROWTYPE;
  v_size bigint;
BEGIN
  SELECT * INTO v_riga FROM public.ponte_wa_media WHERE user_id = p_user_id AND chiave = p_chiave;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'stato', 'assente');
  END IF;
  IF v_riga.stato = 'pronta' THEN
    RETURN jsonb_build_object('ok', true, 'stato', 'pronta', 'byte', v_riga.byte);
  END IF;

  -- Il Mac può dichiarare un peso qualunque: conta quello dell'oggetto in Storage.
  -- Illeggibile o sopra gli 8 MiB (il bucket lo vieta già) non vale come caricato.
  SELECT (o.metadata ->> 'size')::bigint INTO v_size
    FROM storage.objects o
   WHERE o.bucket_id = 'ponte-media' AND o.name = v_riga.path
     AND o.metadata ->> 'size' ~ '^[0-9]{1,12}$'
     AND (o.metadata ->> 'size')::bigint <= 8388608
   LIMIT 1;
  IF v_size IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'stato', 'in_caricamento');
  END IF;

  UPDATE public.ponte_wa_media SET stato = 'pronta', byte = v_size
   WHERE user_id = p_user_id AND chiave = p_chiave AND stato = 'in_caricamento';
  RETURN jsonb_build_object('ok', true, 'stato', 'pronta', 'byte', v_size);
END $$;

REVOKE ALL ON FUNCTION public.ponte_wa_media_permesso(uuid, text, text, text, bigint, bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ponte_wa_media_permesso(uuid, text, text, text, bigint, bigint) TO service_role;
REVOKE ALL ON FUNCTION public.ponte_wa_media_fatto(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ponte_wa_media_fatto(uuid, text) TO service_role;

-- ── 5. L'interruttore, spento di serie ───────────────────────────────────────
-- app_config.value è TESTO: il server fa JSON.parse con riserva sicura
-- (assente o rotto → spento, 0,8 GB). Una scelta già fatta non si riscrive.
INSERT INTO public.app_config (key, value)
  VALUES ('ponte_immagini', '{"acceso":false,"tettoGB":0.8}')
  ON CONFLICT (key) DO NOTHING;
