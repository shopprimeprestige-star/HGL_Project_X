-- ─────────────────────────────────────────────────────────────────────────────
-- SHOP R1 · S3 · TRACCIAMENTO: GLI ID DI GOOGLE, LA TRACCIA DEL CONSENSO SUL
-- LEAD, IL REGISTRO DEGLI ESITI DEGLI EVENTI
--
-- Commessa 2026-11-20-shop-completo (PIANO.md §4 S3, compito T03).
-- La applica il TITOLARE, a mano, dal SQL Editor di Supabase, DOPO S1 (e S2 se
-- l'ha voluta). La squadra non la lancia mai e non usa «supabase db push».
--
-- COSA FA (solo aggiunte: nessuna riga esistente viene toccata o riscritta)
--   1. Aggiunge a public.tracking_config quattro colonne di testo, vuote sulle
--      righe di oggi: google_ga4_id, google_ads_id, google_ads_label_acquisto,
--      google_merchant_id. Sono gli ID pubblici di Google che il titolare
--      inserisce dalle Impostazioni, accanto a quelli di Meta e TikTok.
--      (tiktok_test_event_code NON si aggiunge: esiste già.)
--   2. Aggiunge a public.public_leads due colonne, vuote sui lead di oggi e
--      senza valore predefinito: consenso_marketing (sì/no) e consenso_ts (quando
--      è stato dato). Le scrive il modulo di consulenza del sito; il CRM invia
--      un lead a Meta/TikTok SOLO se qui c'è «sì». Vuoto = consenso ignoto =
--      non parte niente: è la direzione sicura. Il valore lo dichiara il browser:
--      è un'attestazione, non una prova.
--   3. Crea public.tracciamento_esiti, il registro degli esiti degli eventi
--      mandati dal server (piattaforma, evento, event_id, un codice di esito).
--      Nessun dato personale: niente email, telefono, nome, indirizzo IP.
--      Protezione per riga accesa, NESSUNA policy, permessi tolti ad anon e
--      authenticated: dal browser non si legge e non si scrive niente, ci arriva
--      solo il server (che la protezione per riga la salta per costruzione).
--   4. Crea un indice (piattaforma, creato_il) per la pagina «Salute del
--      tracciamento».
--   5. Chiede a PostgREST di ricaricare lo schema.
--
-- COSA NON FA
--   · Non crea né cambia policy: né su tracking_config né su public_leads (quella
--     di inserimento del modulo di consulenza resta com'è e vale anche per le
--     due colonne nuove).
--   · Non cancella, non rinomina, non modifica niente di esistente; non scrive
--     dati; non cambia il tipo di nessuna colonna.
--   · Non apre transazioni (il SQL Editor ne usa già una).
--
-- ORDINE E RILANCIO
--   · Si può lanciare prima o dopo la pubblicazione del codice: il sito regge
--     anche senza (il modulo di consulenza ritenta l'inserimento senza le due
--     colonne del consenso, e il lead nasce con consenso ignoto).
--   · Si può rilanciare quante volte si vuole: ogni istruzione ha «IF NOT EXISTS».
--
-- COME SI ANNULLA (a mano, solo se serve: le colonne vuote non fanno male)
--   alter table public.tracking_config drop column google_ga4_id, ...;
--   alter table public.public_leads drop column consenso_marketing, drop column consenso_ts;
--   drop table public.tracciamento_esiti;
--   Prima di toglierle, il sito va rimesso alla versione che non le usa.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.tracking_config
  ADD COLUMN IF NOT EXISTS google_ga4_id text,
  ADD COLUMN IF NOT EXISTS google_ads_id text,
  ADD COLUMN IF NOT EXISTS google_ads_label_acquisto text,
  ADD COLUMN IF NOT EXISTS google_merchant_id text;

ALTER TABLE public.public_leads
  ADD COLUMN IF NOT EXISTS consenso_marketing boolean,
  ADD COLUMN IF NOT EXISTS consenso_ts timestamptz;

CREATE TABLE IF NOT EXISTS public.tracciamento_esiti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  piattaforma text NOT NULL,
  evento text NOT NULL,
  event_id text,
  esito text NOT NULL,
  creato_il timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tracciamento_esiti ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tracciamento_esiti FROM anon, authenticated;

CREATE INDEX IF NOT EXISTS tracciamento_esiti_piattaforma_creato_il_idx
  ON public.tracciamento_esiti (piattaforma, creato_il DESC);

NOTIFY pgrst, 'reload schema';
