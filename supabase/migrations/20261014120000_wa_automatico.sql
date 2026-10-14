-- ─────────────────────────────────────────────────────────────────────────────
-- WHATSAPP AUTOMATICO AI LEAD — tabelle, consenso e lucchetto del giro
--
-- Solo cose AGGIUNTIVE: tabelle nuove, colonne nuove con IF NOT EXISTS, nessuna
-- riga esistente toccata. Si applica a mano (titolare), mai dal codice.
--
-- Il motore parte SPENTO e SIMULATO (whatsapp_settings.auto_attivo = false,
-- auto_simulato = true): finché il titolare non lo accende, scrive solo il
-- registro, non manda niente a nessuno.
--
-- Ordine consigliato: prima questa migrazione, poi il «pubblica». Se il codice
-- va online prima, il modulo di prenotazione ritenta senza il consenso e il
-- lead arriva comunque (il consenso di quel lead si perde, il lead no).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Regole: una riga per messaggio, modificabili dal titolare ─────────────
--  `riferimento` dice a quale data guarda la regola:
--     'ricontatto' → data/ora di ricontatto del lead (crm_leads.data)
--     'consulenza' → data/ora della consulenza
--  La scadenza si calcola così: giorno di riferimento meno `giorni_prima`,
--  all'ora fissa `ora_fissa` (HH:MM, Europe/Rome) oppure `minuti_prima`
--  l'appuntamento. La fascia `ora_da`..`ora_a` (HH:MM, Europe/Rome) dice
--  quando è permesso mandare: fuori fascia il messaggio si salta e si registra.
CREATE TABLE IF NOT EXISTS public.wa_auto_regole (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  codice       text NOT NULL,
  descrizione  text NOT NULL DEFAULT '',
  attiva       boolean NOT NULL DEFAULT true,
  riferimento  text NOT NULL,
  stato_lead   text,
  giorni_prima integer NOT NULL DEFAULT 0,
  ora_fissa    text,
  minuti_prima integer,
  template     text NOT NULL,
  ora_da       text NOT NULL DEFAULT '09:00',
  ora_a        text NOT NULL DEFAULT '20:00',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, codice)
);

ALTER TABLE public.wa_auto_regole ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin legge le proprie regole wa auto"
  ON public.wa_auto_regole FOR SELECT
  USING (auth.uid() = user_id AND public.is_app_admin(auth.uid()));
CREATE POLICY "admin crea le proprie regole wa auto"
  ON public.wa_auto_regole FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_app_admin(auth.uid()));
CREATE POLICY "admin modifica le proprie regole wa auto"
  ON public.wa_auto_regole FOR UPDATE
  USING (auth.uid() = user_id AND public.is_app_admin(auth.uid()))
  WITH CHECK (auth.uid() = user_id AND public.is_app_admin(auth.uid()));

CREATE OR REPLACE TRIGGER trg_wa_auto_regole_updated
  BEFORE UPDATE ON public.wa_auto_regole
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 2. Registro degli invii (anche quelli simulati) ──────────────────────────
--  La riga si PRENOTA prima dell'invio e l'esito si scrive dopo. L'indice unico
--  (lead_id, regola, scadenza) è ciò che impedisce l'invio doppio: due giri
--  che si sovrappongono non possono prenotare la stessa cosa. Un invio fallito
--  non si ritenta da solo.
--  stato: 'prenotato' | 'inviato' | 'simulato' | 'fallito' | 'saltato'
CREATE TABLE IF NOT EXISTS public.wa_auto_invii (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id        uuid NOT NULL,
  regola         text NOT NULL,
  scadenza       timestamptz NOT NULL,
  telefono_e164  text NOT NULL,
  template       text,
  stato          text NOT NULL DEFAULT 'prenotato',
  motivo         text,
  simulato       boolean NOT NULL DEFAULT true,
  wa_message_id  text,
  prenotato_il   timestamptz NOT NULL DEFAULT now(),
  esito_il       timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS wa_auto_invii_unico
  ON public.wa_auto_invii (lead_id, regola, scadenza);
--  Silenzio di 20 minuti sullo stesso numero (anche con lead diversi).
CREATE INDEX IF NOT EXISTS wa_auto_invii_telefono
  ON public.wa_auto_invii (user_id, telefono_e164, prenotato_il DESC);
--  Tetto giornaliero: righe prenotate oggi.
CREATE INDEX IF NOT EXISTS wa_auto_invii_prenotazione
  ON public.wa_auto_invii (user_id, prenotato_il DESC);

ALTER TABLE public.wa_auto_invii ENABLE ROW LEVEL SECURITY;

--  Il motore scrive con la chiave di servizio (che salta la RLS): dal browser
--  l'admin può solo leggere.
CREATE POLICY "admin legge il proprio registro wa auto"
  ON public.wa_auto_invii FOR SELECT
  USING (auth.uid() = user_id AND public.is_app_admin(auth.uid()));

-- ── 3. Esclusi: chi ha risposto STOP o è stato fermato ───────────────────────
--  Per NUMERO normalizzato, non per lead: lo stesso numero su due lead resta
--  escluso. Li scrive il webhook (solo con firma verificata). «Riattiva» è il
--  pulsante dell'admin nel pannello: toglie la riga.
CREATE TABLE IF NOT EXISTS public.wa_auto_esclusi (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telefono_e164  text NOT NULL,
  motivo         text NOT NULL DEFAULT 'stop',
  testo          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, telefono_e164)
);

ALTER TABLE public.wa_auto_esclusi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin legge i propri esclusi wa auto"
  ON public.wa_auto_esclusi FOR SELECT
  USING (auth.uid() = user_id AND public.is_app_admin(auth.uid()));
CREATE POLICY "admin riattiva i propri esclusi wa auto"
  ON public.wa_auto_esclusi FOR DELETE
  USING (auth.uid() = user_id AND public.is_app_admin(auth.uid()));

-- ── 4. Lucchetto del giro ────────────────────────────────────────────────────
--  Una riga per utente con una scadenza di 50 secondi. Chi la prende
--  (INSERT o UPDATE condizionato alla scadenza passata, in un colpo solo,
--  quindi senza corse) fa il giro; chi non la prende risponde «occupato».
--  Se un giro muore a metà, il lucchetto scade da solo.
CREATE TABLE IF NOT EXISTS public.wa_auto_giro (
  user_id  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  scade_il timestamptz NOT NULL
);

ALTER TABLE public.wa_auto_giro ENABLE ROW LEVEL SECURITY;
--  Nessuna policy: lo toccano solo la funzione qui sotto e la chiave di servizio.

CREATE OR REPLACE FUNCTION public.wa_auto_prendi_giro(p_user uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  preso uuid;
BEGIN
  INSERT INTO public.wa_auto_giro AS g (user_id, scade_il)
  VALUES (p_user, now() + interval '50 seconds')
  ON CONFLICT (user_id) DO UPDATE
    SET scade_il = now() + interval '50 seconds'
    WHERE g.scade_il < now()
  RETURNING g.user_id INTO preso;
  RETURN preso IS NOT NULL;
END
$fn$;

REVOKE ALL ON FUNCTION public.wa_auto_prendi_giro(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_auto_prendi_giro(uuid) TO service_role;

-- ── 5. Consenso a WhatsApp sul modulo del sito ───────────────────────────────
--  Nessun CHECK: la versione è un testo libero (è la prova di cosa ha accettato
--  il lead) e la valida il motore con VERSIONI_CONSENSO_WA. Testo nuovo della
--  casella = versione nuova, mai sovrascritta.
ALTER TABLE public.public_leads
  ADD COLUMN IF NOT EXISTS consenso_whatsapp boolean,
  ADD COLUMN IF NOT EXISTS consenso_whatsapp_il timestamptz,
  ADD COLUMN IF NOT EXISTS consenso_whatsapp_versione text;

--  L'ora del consenso la scrive il database, non il browser (l'inserimento
--  anonimo accetta qualsiasi valore): se arriva `true` è now(), altrimenti
--  null. NON FALLISCE MAI e non fa RAISE: un lead perso costa più di un
--  consenso mancato.
CREATE OR REPLACE FUNCTION public.wa_consenso_ora()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF NEW.consenso_whatsapp IS TRUE THEN
    NEW.consenso_whatsapp_il := now();
  ELSE
    NEW.consenso_whatsapp_il := NULL;
  END IF;
  RETURN NEW;
END
$fn$;

CREATE OR REPLACE TRIGGER wa_consenso_ora
  BEFORE INSERT ON public.public_leads
  FOR EACH ROW EXECUTE FUNCTION public.wa_consenso_ora();

-- ── 6. Interruttori del motore, accanto alle credenziali già esistenti ───────
--  Si parte spenti e simulati. `auto_qualita` e `auto_sospeso_*` li scrive il
--  webhook quando la qualità del numero non è GREEN (e spegne auto_attivo).
ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS auto_attivo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_simulato boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_tetto_giorno integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS auto_qualita text,
  ADD COLUMN IF NOT EXISTS auto_sospeso_motivo text,
  ADD COLUMN IF NOT EXISTS auto_sospeso_il timestamptz;
