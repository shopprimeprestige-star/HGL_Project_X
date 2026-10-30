-- ─────────────────────────────────────────────────────────────────────────────
-- LA CHAT WHATSAPP VELOCE · LETTURE A PEZZI E ANTEPRIMA SUL CONTATTO
--
-- Commessa 2026-10-30-ottimizzazioni, pacchetto p1-chat-veloce.
-- (1) La chat del CRM rileggeva 2000 messaggi e tutti i contatti a ogni evento:
--     ora rilegge solo le righe scritte o cambiate da poco. Per i contatti basta
--     updated_at (c'è già); per i messaggi serve l'ora dell'ultima scrittura.
-- (2) L'elenco mostrava l'anteprima solo se l'ultimo messaggio era fra quelli
--     letti: le chat vecchie restavano senza. Ora l'ultimo messaggio (entrata O
--     uscita) sta sulla riga del contatto.
--
-- COSA AGGIUNGE (solo aggiunte, niente si cancella)
--   · whatsapp_messages.cambiato_il — ora dell'ultima scrittura della riga
--     (insert o update), la scrive il trigger trg_wa_messaggi_cambiato_il.
--     Le righe che ci sono già restano VUOTE (nessuna riscrittura della tabella,
--     nessuna raffica di eventi in tempo reale): la pagina usa created_at.
--   · idx_wa_messages_cambiato_il (user_id, cambiato_il) — la lettura a pezzi.
--   · whatsapp_contacts.ultimo_messaggio_il, ultimo_messaggio_anteprima (max 200
--     caratteri), ultimo_messaggio_direzione ('inbound' | 'outbound').
--   · trg_wa_messaggi_anteprima — dopo ogni messaggio nuovo aggiorna il suo
--     contatto (stesso utente, numero col «+» o senza), SOLO se il messaggio è
--     più recente di quello salvato (lo storico del ponte non la riporta
--     indietro) e MAI per i doppioni del ponte (duplicato_di). Vale per ogni
--     strada: invio dal CRM, Meta, ManyChat, ponte, promemoria.
--   · trg_wa_contatti_anteprima — un contatto creato DOPO il suo primo
--     messaggio (succede: i server scrivono prima il messaggio, poi il
--     contatto) prende l'anteprima dal messaggio più recente.
--   · Riempimento una tantum delle anteprime dei contatti che ci sono già,
--     senza i doppioni e senza le eco di ManyChat salvate prima del 29/10 alle
--     18:40 (stessa regola di src/crm/chatwa/eco.ts, col testo confrontato in
--     minuscolo e senza spazi ai bordi).
--
-- ⚠️ duplicato_di e canale si leggono con to_jsonb(...): i trigger non si
--    rompono se la migrazione del ponte non è applicata.
-- ⚠️ ORDINE: dopo 20261029120000_ponte_whatsapp.sql. Applicarla due volte non
--    fa danni (IF NOT EXISTS, OR REPLACE, DROP TRIGGER IF EXISTS prima di
--    ricrearli, il riempimento tocca solo i contatti ancora vuoti).
-- ⚠️ Il codice pubblicato funziona anche SENZA questa migrazione: la pagina
--    ripiega sulla lettura completa (come prima) e sull'ultimo messaggio letto.
-- ⚠️ NON la lancia la squadra: la applica il capo progetto con l'OK del titolare.
--
-- COME SI ANNULLA (solo se serve davvero; il codice ripiega da solo):
--   DROP TRIGGER trg_wa_messaggi_cambiato_il ON public.whatsapp_messages;
--   DROP TRIGGER trg_wa_messaggi_anteprima ON public.whatsapp_messages;
--   DROP TRIGGER trg_wa_contatti_anteprima ON public.whatsapp_contacts;
--   DROP FUNCTION public.wa_messaggio_cambiato_il();
--   DROP FUNCTION public.wa_messaggio_anteprima();
--   DROP FUNCTION public.wa_contatto_anteprima();
--   DROP INDEX public.idx_wa_messages_cambiato_il;
--   ALTER TABLE public.whatsapp_messages DROP COLUMN cambiato_il;
--   ALTER TABLE public.whatsapp_contacts DROP COLUMN ultimo_messaggio_il;
--   ALTER TABLE public.whatsapp_contacts DROP COLUMN ultimo_messaggio_anteprima;
--   ALTER TABLE public.whatsapp_contacts DROP COLUMN ultimo_messaggio_direzione;
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. L'ora dell'ultima scrittura di un messaggio ───────────────────────────
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS cambiato_il timestamptz;

CREATE INDEX IF NOT EXISTS idx_wa_messages_cambiato_il
  ON public.whatsapp_messages (user_id, cambiato_il);

CREATE OR REPLACE FUNCTION public.wa_messaggio_cambiato_il()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  NEW.cambiato_il := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wa_messaggi_cambiato_il ON public.whatsapp_messages;
CREATE TRIGGER trg_wa_messaggi_cambiato_il
  BEFORE INSERT OR UPDATE ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.wa_messaggio_cambiato_il();

-- ── 2. L'ultimo messaggio sulla riga del contatto ────────────────────────────
ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS ultimo_messaggio_il timestamptz;
ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS ultimo_messaggio_anteprima text;
ALTER TABLE public.whatsapp_contacts ADD COLUMN IF NOT EXISTS ultimo_messaggio_direzione text;

-- Un messaggio nuovo: il suo contatto avanza (mai indietro, mai per un doppione).
-- SECURITY DEFINER: chi scrive il messaggio (utente con la sua RLS o server)
-- aggiorna il contatto dello STESSO user_id del messaggio, nient'altro.
CREATE OR REPLACE FUNCTION public.wa_messaggio_anteprima()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_cifre text;
BEGIN
  IF (to_jsonb(NEW) ->> 'duplicato_di') IS NOT NULL THEN
    RETURN NULL;
  END IF;
  v_cifre := regexp_replace(
    coalesce(CASE WHEN NEW.direction = 'inbound' THEN NEW.from_number ELSE NEW.to_number END, ''),
    '\D', '', 'g');
  IF v_cifre = '' THEN
    RETURN NULL;
  END IF;
  UPDATE public.whatsapp_contacts c
     SET ultimo_messaggio_il         = NEW.created_at,
         ultimo_messaggio_anteprima  = left(NEW.body, 200),
         ultimo_messaggio_direzione  = NEW.direction
   WHERE c.user_id = NEW.user_id
     AND c.phone_e164 IN ('+' || v_cifre, v_cifre)
     AND (c.ultimo_messaggio_il IS NULL OR c.ultimo_messaggio_il <= NEW.created_at);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_wa_messaggi_anteprima ON public.whatsapp_messages;
CREATE TRIGGER trg_wa_messaggi_anteprima
  AFTER INSERT ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.wa_messaggio_anteprima();

-- Un contatto nuovo: l'ultimo messaggio già scritto per quel numero, se c'è.
-- AFTER INSERT: non scatta per un upsert che trova il contatto già esistente.
CREATE OR REPLACE FUNCTION public.wa_contatto_anteprima()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_cifre text := regexp_replace(coalesce(NEW.phone_e164, ''), '\D', '', 'g');
  m record;
BEGIN
  IF v_cifre = '' OR NEW.ultimo_messaggio_il IS NOT NULL THEN
    RETURN NULL;
  END IF;
  SELECT w.created_at, w.body, w.direction INTO m
    FROM public.whatsapp_messages w
   WHERE w.user_id = NEW.user_id
     AND (to_jsonb(w) ->> 'duplicato_di') IS NULL
     AND (   (w.direction = 'inbound'  AND w.from_number IN ('+' || v_cifre, v_cifre))
          OR (w.direction <> 'inbound' AND w.to_number   IN ('+' || v_cifre, v_cifre)))
   ORDER BY w.created_at DESC
   LIMIT 1;
  IF FOUND THEN
    UPDATE public.whatsapp_contacts c
       SET ultimo_messaggio_il        = m.created_at,
           ultimo_messaggio_anteprima = left(m.body, 200),
           ultimo_messaggio_direzione = m.direction
     WHERE c.id = NEW.id
       AND c.ultimo_messaggio_il IS NULL;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_wa_contatti_anteprima ON public.whatsapp_contacts;
CREATE TRIGGER trg_wa_contatti_anteprima
  AFTER INSERT ON public.whatsapp_contacts
  FOR EACH ROW EXECUTE FUNCTION public.wa_contatto_anteprima();

-- Funzioni dei trigger: nessuno le chiama a mano.
REVOKE ALL ON FUNCTION public.wa_messaggio_cambiato_il() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wa_messaggio_anteprima() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wa_contatto_anteprima() FROM PUBLIC, anon, authenticated;

-- ── 3. Riempimento una tantum dei contatti che ci sono già ───────────────────
-- Il più recente per (utente, numero), senza doppioni e senza le eco vecchie di
-- ManyChat: riga «mc-in:» salvata prima della correzione, con lo stesso testo di
-- un'entrata precedente dello stesso numero e un nostro messaggio in mezzo.
WITH messaggi AS (
  SELECT w.user_id,
         regexp_replace(CASE WHEN w.direction = 'inbound' THEN w.from_number ELSE w.to_number END,
                        '\D', '', 'g') AS cifre,
         w.created_at, w.body, w.direction
    FROM public.whatsapp_messages w
   WHERE (to_jsonb(w) ->> 'duplicato_di') IS NULL
     AND NOT (
       w.direction = 'inbound'
       AND coalesce(w.wa_message_id, '') LIKE 'mc-in:%'
       AND w.created_at < timestamptz '2026-10-29 17:40:00+00'
       AND EXISTS (
         SELECT 1
           FROM public.whatsapp_messages p
          WHERE p.user_id = w.user_id
            AND p.direction = 'inbound'
            AND p.from_number = w.from_number
            AND p.created_at < w.created_at
            AND lower(btrim(p.body)) = lower(btrim(w.body))
            AND EXISTS (
              SELECT 1
                FROM public.whatsapp_messages o
               WHERE o.user_id = w.user_id
                 AND o.direction = 'outbound'
                 AND regexp_replace(o.to_number, '\D', '', 'g')
                     = regexp_replace(w.from_number, '\D', '', 'g')
                 AND o.created_at > p.created_at
                 AND o.created_at < w.created_at))
     )
), ultimi AS (
  SELECT DISTINCT ON (user_id, cifre) user_id, cifre, created_at, body, direction
    FROM messaggi
   WHERE cifre <> ''
   ORDER BY user_id, cifre, created_at DESC
)
UPDATE public.whatsapp_contacts c
   SET ultimo_messaggio_il        = u.created_at,
       ultimo_messaggio_anteprima = left(u.body, 200),
       ultimo_messaggio_direzione = u.direction
  FROM ultimi u
 WHERE c.user_id = u.user_id
   AND regexp_replace(c.phone_e164, '\D', '', 'g') = u.cifre
   AND c.ultimo_messaggio_il IS NULL;
