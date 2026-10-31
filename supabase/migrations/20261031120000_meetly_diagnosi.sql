-- ─────────────────────────────────────────────────────────────────────────────
-- LA SCATOLA NERA DEI COLLEGAMENTI MEETLY (31/10/2026)
--
-- Commessa 2026-10-31-meetly-connessione, parte A. Quando due persone sono nella stessa stanza
-- Meetly ma entro 15 secondi non c'è media remoto vivo, il browser manda UN rapporto tecnico alla
-- rotta pubblica /api/public/meetly-diagnosi; un secondo rapporto «esito» arriva se poi si
-- collegano. Il gestionale (Impostazioni → Meetly → «Collegamenti falliti») mostra gli ultimi 50.
--
-- COSA CONTIENE UNA RIGA: ruolo (consulente/ospite), browser e sistema ridotti («Chrome 130»,
-- «Android 14»), tipo di rete, stati della connessione, tipi/protocolli/porte dei candidati,
-- contatori della segnalazione, permessi, tracce. MAI nomi, telefoni, email, testi, indirizzi IP
-- (li toglie src/shop/scatola-nera.ts prima dell'invio E la rotta li ripulisce di nuovo).
-- Il codice della stanza NON è salvato: c'è solo un'impronta (12 caratteri di uno SHA-256), che
-- serve a limitare la frequenza per stanza e a raggruppare i rapporti della stessa consulenza.
--
-- CHI PUÒ COSA
--   · RLS attiva e nessun permesso ad anon/authenticated (stesso schema di push_iscrizioni):
--     NESSUN utente del database tocca questa tabella. Scrive e legge solo il server col service
--     role. La lettura passa da GET /api/public/meetly-diagnosi, che chiede le credenziali del
--     gestionale con il permesso «consulenti» (lo stesso che serve per salvare il TURN).
--
-- PULIZIA: la rotta, ogni tanto, butta le righe oltre 60 giorni (nessun cron da programmare).
--
-- ⚠️ Applicarla due volte non fa danni (IF NOT EXISTS).
-- ⚠️ Il codice pubblicato funziona anche SENZA questa migrazione: la rotta ingoia l'errore e il
--    riquadro del gestionale scrive «la tabella non c'è ancora» senza rompersi.
-- ⚠️ NON la lancia la squadra: la applica il capo progetto con l'OK del titolare.
--
-- COME SI ANNULLA (solo se serve davvero; il codice ripiega da solo):
--   DROP TABLE public.meetly_diagnosi;
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.meetly_diagnosi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creato_il timestamptz NOT NULL DEFAULT now(),
  -- impronta del codice stanza (mai il codice)
  stanza text NOT NULL,
  -- identificativo casuale del collegamento: lega il «blocco» al suo «esito»
  rid text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('blocco', 'esito')),
  ruolo text NOT NULL CHECK (ruolo IN ('consulente', 'ospite')),
  browser text NOT NULL DEFAULT '',
  sistema text NOT NULL DEFAULT '',
  rete text NOT NULL DEFAULT '',
  -- il rapporto intero, già ripulito (la frase di diagnosi si ricalcola in lettura)
  dati jsonb NOT NULL
);

-- un rapporto per tipo e collegamento: se il browser ritenta, il doppione viene scartato
CREATE UNIQUE INDEX IF NOT EXISTS meetly_diagnosi_rid_tipo_uidx ON public.meetly_diagnosi (rid, tipo);
CREATE INDEX IF NOT EXISTS meetly_diagnosi_creato_il_idx ON public.meetly_diagnosi (creato_il DESC);
CREATE INDEX IF NOT EXISTS meetly_diagnosi_stanza_idx ON public.meetly_diagnosi (stanza, creato_il DESC);

ALTER TABLE public.meetly_diagnosi ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meetly_diagnosi FROM anon, authenticated;
