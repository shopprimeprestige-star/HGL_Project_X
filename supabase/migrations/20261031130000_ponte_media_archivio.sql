-- ─────────────────────────────────────────────────────────────────────────────
-- IL PONTE WHATSAPP · MEDIA IN CHAT · B · TIMER, LIBERAZIONE E PANNELLO «ARCHIVIAZIONE»
--
-- Commessa 2026-10-31-media-e-archiviazione (T1, PIANO (e)). Dopo A (tipi, limiti,
-- richieste) servono le funzioni che fanno sparire i file e quelle che li contano:
--   · il timer di ogni media (Tieni sempre, 5 min, 1 h, 24 h, 7 g, 30 g, Elimina ora);
--   · il cron che libera i file scaduti (rotta del Worker /hooks/media-scadute);
--   · «Libera» dal pannello (per chat, per selezione, tutto);
--   · le tre letture del pannello «Archiviazione».
-- Lo Storage non si svuota da SQL: cancellare è una rotta del Worker con la chiave di
-- servizio (`storage.remove`, con il percorso preso da qui e mai dal browser); SQL segna
-- «liberato» solo DOPO. Per questo le funzioni di servizio sono a coppie: una elenca
-- cosa cancellare (scadute, da_liberare), una segna fatto (liberato).
--
-- ⚠️ ORDINE DI MESSA IN OPERA: codice → A → B → aggiorna il Mac → C. Richiede A (colonne
--    scade_il, liberato_il, categoria; tabella ponte_wa_media_richieste).
--
-- COSA AGGIUNGE (solo funzioni: nessuna tabella, nessuna riga cambia)
--   Servizio — SECURITY DEFINER, search_path fisso, EXECUTE solo a service_role:
--     ponte_wa_media_timer(uuid, text, int) → jsonb
--        secondi NULL o 0 = tieni sempre; solo 300, 3600, 86400, 604800, 2592000 (altro = 22023).
--        {"ok":true,"stato":"pronta","scade_il":"<ts>"|null}      su una riga pronta
--        {"ok":true,"stato":"richiesta"}                            se c'è una richiesta di «Mostra» viva (si cambia il suo timer)
--        {"ok":false,"stato":"assente"}                             riga che non c'è, liberata, in caricamento senza richiesta, di
--                                                                   un altro utente: NESSUN effetto
--     ponte_wa_media_scadute(int) → (user_id, chiave, path)
--        le righe pronta con scade_il passato, le più scadute prima (al più 500, di serie 200).
--     ponte_wa_media_ancora_scadute(uuid, jsonb) → jsonb
--        la corsa «Tieni sempre»: fra la lettura delle scadute e la rimozione da Storage passano secondi, e
--        il titolare può scegliere «Tieni sempre» (o un timer nuovo). Il giro del cron, PRIMA del remove, chiede
--        di queste voci [{"chiave","path"},…] quali sono ANCORA da togliere (pronta, stesso path, scade_il
--        passato) e toglie solo quelle. Sola lettura; vale solo per il cron, non per «Libera» dal pannello.
--     ponte_wa_media_da_liberare(uuid, text, text[], int) → (chiave, path)
--        le sole righe pronta da cancellare: per numero, per chiavi, per entrambi, o tutte
--        (numero e chiavi NULL = «tutto»; un array vuoto NON è «tutto»). Al più 500 per volta.
--     ponte_wa_media_liberato(uuid, jsonb) → int
--        p_voci = [{"chiave":"bw:…","path":"…"},…]. Aggiorna SOLO le righe con stato = 'pronta' E lo stesso
--        path letto da scadute/da_liberare: una «Mostra» fatta fra la rimozione e questo passo (riga
--        rimessa in_caricamento con un percorso nuovo) non si tocca, e l'oggetto nuovo non resta orfano.
--        Segna stato = 'liberato', liberato_il = now(), scade_il = NULL e AZZERA nome e miniatura
--        (restano categoria e peso). Mai un DELETE. Ritorna le righe cambiate.
--     ponte_wa_media_orfani(int) → text[]
--        i nomi degli oggetti di «ponte-media» senza una riga pronta/in_caricamento (rimozioni fallite).
--   Lettura dal browser — authenticated, STABLE, SECURITY DEFINER, filtro m.user_id = auth.uid()
--   (nessun p_user_id: ognuno vede solo le sue righe, come con la RLS). I pesi sono quelli VERI di
--   storage.objects (bucket ponte-media, oggetto con name = path) e contano solo le righe pronta:
--   le liberate e quelle senza oggetto restano fuori dal peso.
--     ponte_wa_archivio_riassunto() → jsonb
--        {"byte_totali","file","senza_file","con_timer","liberati","per_tipo":{"foto":{"n","byte"},"audio":…,"video":…,"documento":…}}
--     ponte_wa_archivio_chat() → (numero, byte, foto, audio, video, documento, ultimo_il)
--        per MB decrescenti, al più 2.000 chat.
--     ponte_wa_archivio_media(numero, limite, prima_il, prima_chiave) → (chiave, categoria, nome, byte, durata_s,
--                                                                          miniatura, scade_il, creato_il)
--        pagine keyset (creato_il, chiave) decrescenti; limite al più 100 (di serie 50, almeno 1);
--        numero validato (^[0-9]{8,15}$, altrimenti 22023).
--
-- ⚠️ CHI PUÒ CHIAMARE: le funzioni di servizio si fidano di p_user_id, quindi SOLO il server
--    (REVOKE da PUBLIC, anon e authenticated; GRANT a service_role). Le tre del pannello
--    sono l'opposto: GRANT a authenticated (REVOKE da PUBLIC e anon) e filtrano da sole.
-- ⚠️ Onestà: la lettura del pannello è solo d'interfaccia (le sessioni PIN dei consulenti sono la
--    sessione del proprietario: si vedono MB e numeri per chat, mai contenuti). La CANCELLAZIONE è
--    protetta dal server (guardiaCRM, permesso «impostazioni»).
-- ⚠️ Applicarla due volte non fa danni (CREATE OR REPLACE).
-- ⚠️ NON la lancia la squadra: la applica il titolare, dopo averla letta e dopo il collaudo
--    prove/sql/ponte-media-archivio.sql su un database di prova.
--
-- COME SI ANNULLA (solo se serve davvero; MAI eseguito dalla squadra):
--   DROP FUNCTION public.ponte_wa_archivio_media(text, integer, timestamptz, text);
--   DROP FUNCTION public.ponte_wa_archivio_chat();
--   DROP FUNCTION public.ponte_wa_archivio_riassunto();
--   DROP FUNCTION public.ponte_wa_media_orfani(integer);
--   DROP FUNCTION public.ponte_wa_media_liberato(uuid, jsonb);
--   DROP FUNCTION public.ponte_wa_media_ancora_scadute(uuid, jsonb);
--   DROP FUNCTION public.ponte_wa_media_da_liberare(uuid, text, text[], integer);
--   DROP FUNCTION public.ponte_wa_media_scadute(integer);
--   DROP FUNCTION public.ponte_wa_media_timer(uuid, text, integer);
--
-- VERIFICA, dopo averla applicata (tutte in sola lettura):
--   SELECT proname, prosecdef, provolatile FROM pg_proc WHERE pronamespace = 'public'::regnamespace
--    AND proname LIKE 'ponte_wa_archivio%' ORDER BY proname;
--      → tre righe, prosecdef = true, provolatile = 's'
--   SELECT has_function_privilege('authenticated', 'public.ponte_wa_media_da_liberare(uuid, text, text[], integer)', 'EXECUTE');
--      → false (solo il server cancella)
--   SELECT public.ponte_wa_media_orfani(100);
--      → i nomi degli oggetti di Storage senza riga (di solito {})
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Il timer ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ponte_wa_media_timer(p_user_id uuid, p_chiave text, p_secondi integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_scade timestamptz;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'ponte_wa_media_timer: utente mancante' USING ERRCODE = '22023';
  END IF;
  IF p_chiave IS NULL OR p_chiave !~ '^bw:[0-9]{8,15}:[A-Za-z0-9_.-]{1,128}$' THEN
    RAISE EXCEPTION 'ponte_wa_media_timer: chiave non valida' USING ERRCODE = '22023';
  END IF;
  IF p_secondi IS NOT NULL AND p_secondi <> 0 AND p_secondi NOT IN (300, 3600, 86400, 604800, 2592000) THEN
    RAISE EXCEPTION 'ponte_wa_media_timer: timer non ammesso' USING ERRCODE = '22023';
  END IF;

  -- Un file pronto: il timer si scrive sulla riga (0 o NULL = tieni sempre).
  UPDATE public.ponte_wa_media
     SET scade_il = CASE WHEN coalesce(p_secondi, 0) = 0 THEN NULL ELSE now() + make_interval(secs => p_secondi) END
   WHERE user_id = p_user_id AND chiave = p_chiave AND stato = 'pronta'
  RETURNING scade_il INTO v_scade;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'stato', 'pronta', 'scade_il', v_scade);
  END IF;

  -- Un file non ancora pronto ma richiesto con «Mostra»: si cambia il timer della richiesta
  -- (parte quando il file è pronto).
  UPDATE public.ponte_wa_media_richieste
     SET timer_s = NULLIF(p_secondi, 0)
   WHERE user_id = p_user_id AND chiave = p_chiave AND stato IN ('in_attesa', 'in_corso');
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'stato', 'richiesta');
  END IF;

  -- Tutto il resto (riga che non c'è, liberata, in caricamento senza richiesta, di un altro
  -- utente): nessun effetto.
  RETURN jsonb_build_object('ok', false, 'stato', 'assente');
END $$;

-- ── 2. Cosa è scaduto (il giro del cron, ogni minuto) ────────────────────────
CREATE OR REPLACE FUNCTION public.ponte_wa_media_scadute(p_limite integer)
RETURNS TABLE (user_id uuid, chiave text, path text)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT m.user_id, m.chiave, m.path
    FROM public.ponte_wa_media m
   WHERE m.stato = 'pronta' AND m.scade_il IS NOT NULL AND m.scade_il <= now()
   ORDER BY m.scade_il, m.chiave
   LIMIT least(greatest(coalesce(p_limite, 200), 0), 500) $$;

-- ── 2b. Cosa è ANCORA scaduto, un attimo prima del remove (la corsa «Tieni sempre») ──
-- Il cron legge scadute(), poi toglie i file da Storage (secondi), poi segna liberato. Se nel frattempo il titolare
-- sceglie «Tieni sempre» o un altro timer, il file non va tolto: qui si rileggono le sole voci che hanno ancora
-- lo stesso percorso, sono pronta e hanno scade_il passato. Resta una finestra di millisecondi, non di secondi.
CREATE OR REPLACE FUNCTION public.ponte_wa_media_ancora_scadute(p_user_id uuid, p_voci jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_user_id IS NULL OR p_voci IS NULL OR jsonb_typeof(p_voci) <> 'array' OR jsonb_array_length(p_voci) > 1000 THEN
    RAISE EXCEPTION 'ponte_wa_media_ancora_scadute: parametri non validi' USING ERRCODE = '22023';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object('chiave', m.chiave, 'path', m.path) ORDER BY m.scade_il, m.chiave)
      FROM public.ponte_wa_media m
      JOIN (SELECT DISTINCT e ->> 'chiave' AS chiave, e ->> 'path' AS path
              FROM jsonb_array_elements(p_voci) e
             WHERE jsonb_typeof(e) = 'object') x ON x.chiave = m.chiave AND x.path = m.path
     WHERE m.user_id = p_user_id AND m.stato = 'pronta' AND m.scade_il IS NOT NULL AND m.scade_il <= now()
  ), '[]'::jsonb);
END $$;

-- ── 3. Cosa liberare dal pannello ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ponte_wa_media_da_liberare(p_user_id uuid, p_numero text, p_chiavi text[], p_limite integer)
RETURNS TABLE (chiave text, path text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
#variable_conflict use_column
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'ponte_wa_media_da_liberare: utente mancante' USING ERRCODE = '22023';
  END IF;
  IF p_numero IS NOT NULL AND p_numero !~ '^[0-9]{8,15}$' THEN
    RAISE EXCEPTION 'ponte_wa_media_da_liberare: numero non valido' USING ERRCODE = '22023';
  END IF;
  -- Solo righe pronta, con il percorso del database. Numero e chiavi NULL = «tutto»; un array vuoto no.
  RETURN QUERY
  SELECT m.chiave, m.path
    FROM public.ponte_wa_media m
   WHERE m.user_id = p_user_id AND m.stato = 'pronta'
     AND (p_numero IS NULL OR m.numero = p_numero)
     AND (p_chiavi IS NULL OR m.chiave = ANY (p_chiavi))
   ORDER BY m.created_at, m.chiave
   LIMIT least(greatest(coalesce(p_limite, 500), 0), 500);
END $$;

-- ── 4. Segnare «liberato» DOPO la rimozione da Storage ───────────────────────
CREATE OR REPLACE FUNCTION public.ponte_wa_media_liberato(p_user_id uuid, p_voci jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_n integer;
BEGIN
  IF p_user_id IS NULL OR p_voci IS NULL OR jsonb_typeof(p_voci) <> 'array' OR jsonb_array_length(p_voci) > 1000 THEN
    RAISE EXCEPTION 'ponte_wa_media_liberato: parametri non validi' USING ERRCODE = '22023';
  END IF;
  -- Solo stato = 'pronta' E lo stesso path letto prima: una riga rimessa in coda da «Mostra» nel frattempo
  -- (percorso nuovo) non cambia. Idempotente: ripetuta, non fa più niente. Mai un DELETE.
  UPDATE public.ponte_wa_media m
     SET stato = 'liberato', liberato_il = now(), scade_il = NULL, nome = NULL, miniatura = NULL
    FROM (SELECT DISTINCT e ->> 'chiave' AS chiave, e ->> 'path' AS path
            FROM jsonb_array_elements(p_voci) e
           WHERE jsonb_typeof(e) = 'object') x
   WHERE m.user_id = p_user_id AND m.chiave = x.chiave AND m.stato = 'pronta' AND m.path = x.path;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END $$;

-- ── 5. Gli oggetti senza riga (rimozioni fallite) ────────────────────────────
CREATE OR REPLACE FUNCTION public.ponte_wa_media_orfani(p_limite integer)
RETURNS text[]
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT coalesce(array_agg(x.name ORDER BY x.name), '{}')
    FROM (SELECT o.name
            FROM storage.objects o
           WHERE o.bucket_id = 'ponte-media'
             AND NOT EXISTS (SELECT 1 FROM public.ponte_wa_media m
                              WHERE m.path = o.name AND m.stato IN ('pronta', 'in_caricamento'))
           ORDER BY o.name
           LIMIT least(greatest(coalesce(p_limite, 100), 0), 500)) x $$;

-- ── 6. Il pannello: il riassunto ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ponte_wa_archivio_riassunto()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH p AS (
    SELECT m.categoria, m.scade_il, (o.name IS NOT NULL) AS ha,
           CASE WHEN o.name IS NOT NULL AND o.metadata ->> 'size' ~ '^[0-9]{1,12}$' THEN (o.metadata ->> 'size')::bigint ELSE 0 END AS b
      FROM public.ponte_wa_media m
      LEFT JOIN storage.objects o ON o.bucket_id = 'ponte-media' AND o.name = m.path
     WHERE m.user_id = auth.uid() AND m.stato = 'pronta'
  ), t AS (
    SELECT c.cat, count(*) FILTER (WHERE p.ha) AS n, coalesce(sum(p.b), 0) AS b
      FROM (VALUES ('foto'), ('audio'), ('video'), ('documento')) c (cat)
      LEFT JOIN p ON p.categoria = c.cat
     GROUP BY c.cat
  )
  SELECT jsonb_build_object(
    'byte_totali', coalesce((SELECT sum(b) FROM p), 0),
    'file', (SELECT count(*) FROM p WHERE ha),
    'senza_file', (SELECT count(*) FROM p WHERE NOT ha),
    'con_timer', (SELECT count(*) FROM p WHERE ha AND scade_il IS NOT NULL),
    'liberati', (SELECT count(*) FROM public.ponte_wa_media m WHERE m.user_id = auth.uid() AND m.stato = 'liberato'),
    'per_tipo', (SELECT jsonb_object_agg(cat, jsonb_build_object('n', n, 'byte', b)) FROM t)
  ) $$;

-- ── 7. Il pannello: le chat per MB decrescenti ───────────────────────────────
CREATE OR REPLACE FUNCTION public.ponte_wa_archivio_chat()
RETURNS TABLE (numero text, byte bigint, foto integer, audio integer, video integer, documento integer, ultimo_il timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT m.numero,
         coalesce(sum(CASE WHEN o.metadata ->> 'size' ~ '^[0-9]{1,12}$' THEN (o.metadata ->> 'size')::bigint ELSE 0 END), 0)::bigint,
         (count(*) FILTER (WHERE m.categoria = 'foto'))::integer,
         (count(*) FILTER (WHERE m.categoria = 'audio'))::integer,
         (count(*) FILTER (WHERE m.categoria = 'video'))::integer,
         (count(*) FILTER (WHERE m.categoria = 'documento'))::integer,
         max(m.created_at)
    FROM public.ponte_wa_media m
    JOIN storage.objects o ON o.bucket_id = 'ponte-media' AND o.name = m.path
   WHERE m.user_id = auth.uid() AND m.stato = 'pronta'
   GROUP BY m.numero
   ORDER BY 2 DESC, m.numero
   LIMIT 2000 $$;

-- ── 8. Il pannello: i media di una chat, a pagine ────────────────────────────
CREATE OR REPLACE FUNCTION public.ponte_wa_archivio_media(p_numero text, p_limite integer, p_prima_il timestamptz, p_prima_chiave text)
RETURNS TABLE (chiave text, categoria text, nome text, byte bigint, durata_s integer, miniatura text, scade_il timestamptz, creato_il timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
#variable_conflict use_column
DECLARE
  v_limite integer;
BEGIN
  IF p_numero IS NULL OR p_numero !~ '^[0-9]{8,15}$' THEN
    RAISE EXCEPTION 'ponte_wa_archivio_media: numero non valido' USING ERRCODE = '22023';
  END IF;
  v_limite := least(greatest(coalesce(p_limite, 50), 1), 100);
  RETURN QUERY
  SELECT m.chiave, m.categoria, m.nome,
         CASE WHEN o.metadata ->> 'size' ~ '^[0-9]{1,12}$' THEN (o.metadata ->> 'size')::bigint ELSE 0 END,
         m.durata_s, m.miniatura, m.scade_il, m.created_at
    FROM public.ponte_wa_media m
    JOIN storage.objects o ON o.bucket_id = 'ponte-media' AND o.name = m.path
   WHERE m.user_id = auth.uid() AND m.numero = p_numero AND m.stato = 'pronta'
     AND (p_prima_il IS NULL OR m.created_at < p_prima_il OR (m.created_at = p_prima_il AND m.chiave < p_prima_chiave))
   ORDER BY m.created_at DESC, m.chiave DESC
   LIMIT v_limite;
END $$;

-- ── 9. Chi può chiamare cosa ─────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.ponte_wa_media_timer(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ponte_wa_media_timer(uuid, text, integer) TO service_role;
REVOKE ALL ON FUNCTION public.ponte_wa_media_scadute(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ponte_wa_media_scadute(integer) TO service_role;
REVOKE ALL ON FUNCTION public.ponte_wa_media_ancora_scadute(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ponte_wa_media_ancora_scadute(uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.ponte_wa_media_da_liberare(uuid, text, text[], integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ponte_wa_media_da_liberare(uuid, text, text[], integer) TO service_role;
REVOKE ALL ON FUNCTION public.ponte_wa_media_liberato(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ponte_wa_media_liberato(uuid, jsonb) TO service_role;
REVOKE ALL ON FUNCTION public.ponte_wa_media_orfani(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ponte_wa_media_orfani(integer) TO service_role;

REVOKE ALL ON FUNCTION public.ponte_wa_archivio_riassunto() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponte_wa_archivio_riassunto() TO authenticated;
REVOKE ALL ON FUNCTION public.ponte_wa_archivio_chat() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponte_wa_archivio_chat() TO authenticated;
REVOKE ALL ON FUNCTION public.ponte_wa_archivio_media(text, integer, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ponte_wa_archivio_media(text, integer, timestamptz, text) TO authenticated;

-- Il server le trova subito, senza aspettare che la cache dello schema si rinnovi da sola.
NOTIFY pgrst, 'reload schema';

COMMIT;
