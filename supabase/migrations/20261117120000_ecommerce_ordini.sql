-- ─────────────────────────────────────────────────────────────────────────────
-- E-COMMERCE NEL CRM · M1 · LE COLONNE DEGLI ORDINI, IL REGISTRO DEI CAMBI,
-- LA POLICY DI INSERIMENTO STRETTA
--
-- Commessa 2026-11-17-crm-ecommerce (PIANO.md §3.1, compito T2, rilascio R2).
-- La applica il TITOLARE, a mano, dal SQL Editor di Supabase. La squadra non la
-- lancia mai e non usa «supabase db push» su questo file.
--
-- ⚠️ PRIMA DI LANCIARLA: LEGGI LE POLICY CHE ESISTONO GIÀ. Incolla questa query
--    nel SQL Editor, premi Run e guarda il risultato:
--
--      select policyname, cmd, roles, qual, with_check
--        from pg_policies
--       where schemaname = 'public' and tablename = 'shop_orders';
--
--    Devi trovare SOLO tre righe:
--      · «anyone can insert shop order»      (INSERT, with_check = true)
--      · «authenticated can read shop orders» (SELECT)
--      · «authenticated can update shop orders» (UPDATE)
--    Se c'è un'ALTRA policy di inserimento (per esempio creata dal pannello
--    «Authentication > Policies»), NON lanciare: le policy permissive si
--    SOMMANO, quindi un'altra INSERT «larga» lascerebbe passare tutto anche con
--    la policy stretta di questo file. Fermati e dillo alla squadra.
--    La stessa query va RILETTA dopo l'applicazione e nel collaudo: devono
--    restare le tre di sopra, con «anyone can insert shop order» sostituita da
--    «shop_orders_insert_checkout».
--
-- COSA FA (solo aggiunte: nessuna riga esistente viene toccata o riscritta)
--   1. Aggiunge a public.shop_orders otto colonne, tutte vuote sulle righe
--      di oggi: lead_id, senza_lead, pagato_il, pagato_importo,
--      metodo_pagamento, tracking, note_interne, aggiornato_il.
--   2. Crea due indici (lead_id parziale, status).
--   3. Crea public.shop_order_eventi, il registro di chi ha cambiato che cosa.
--      Ha la protezione per riga accesa e NESSUNA policy: dal browser non si
--      legge e non si scrive niente; ci arriva solo la rotta del server (che
--      salta la protezione per costruzione).
--   4. Sostituisce la policy di inserimento «aperta a tutto» con una stretta,
--      in UNA transazione: prima crea la nuova, poi toglie la vecchia. Chi
--      ordina dal sito (anonimo) può inserire SOLO un ordine «nuovo», non
--      collegato, non pagato, senza note interne né tracking, e con
--      created_at = adesso (la finestra è di 10 minuti nel passato e 1 nel
--      futuro: serve a non poter retrodatare un ordine e falsare i periodi).
--      Il checkout non manda created_at (lo mette il database), quindi non ne
--      risente: lo provano le prove del repo (prove/ecommerce/migrazione.mjs).
--   5. Chiede a PostgREST di ricaricare lo schema.
--   Le policy di lettura e aggiornamento per «authenticated» NON si toccano qui
--   (le chiude, se vuoi, ORDINI-SOLO-SERVER.sql, a fine collaudo).
--   crm_leads non si tocca.
--
-- ORDINE: può essere lanciata prima o dopo la pubblicazione del codice di R2
-- (il codice funziona anche senza). Il checkout di oggi continua a funzionare.
-- Subito dopo: fai un ORDINE DI PROVA da una finestra anonima del browser (nome
-- «PROVA-ELIMINARE», dati inventati) e controlla che compaia in Table Editor;
-- se NON compare, esegui il RIPRISTINO in fondo a questo file.
--
-- LANCIARLA DUE VOLTE NON FA DANNI (ADD COLUMN/CREATE ... IF NOT EXISTS; la
-- policy nuova viene tolta e ricreata con lo stesso nome).
--
-- COME SI ANNULLA: vedi in fondo, il ripristino della policy larga (le colonne e
-- la tabella nuove sono vuote e innocue: non serve toglierle).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Le colonne nuove (vuote per tutte le righe di oggi) ────────────────────
ALTER TABLE public.shop_orders
  ADD COLUMN IF NOT EXISTS lead_id          UUID,
  ADD COLUMN IF NOT EXISTS senza_lead       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS pagato_il        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pagato_importo   NUMERIC,
  ADD COLUMN IF NOT EXISTS metodo_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS tracking         TEXT,
  ADD COLUMN IF NOT EXISTS note_interne     TEXT,
  ADD COLUMN IF NOT EXISTS aggiornato_il    TIMESTAMPTZ;

-- ── 2. Gli indici ─────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_shop_orders_lead_id ON public.shop_orders (lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON public.shop_orders (status);

-- ── 3. Il registro dei cambi: protezione accesa, nessuna policy ───────────────
CREATE TABLE IF NOT EXISTS public.shop_order_eventi (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  order_id   UUID NOT NULL,
  order_ref  TEXT,
  tipo       TEXT NOT NULL,
  chi        TEXT,
  prima      JSONB,
  dopo       JSONB
);
CREATE INDEX IF NOT EXISTS idx_shop_order_eventi_ordine ON public.shop_order_eventi (order_id, created_at DESC);
ALTER TABLE public.shop_order_eventi ENABLE ROW LEVEL SECURITY;

-- ── 4. La policy stretta, poi via la larga (una sola transazione) ─────────────
BEGIN;

DROP POLICY IF EXISTS "shop_orders_insert_checkout" ON public.shop_orders;
CREATE POLICY "shop_orders_insert_checkout"
  ON public.shop_orders FOR INSERT
  WITH CHECK (
    status = 'nuovo'
    AND lead_id IS NULL
    AND pagato_il IS NULL
    AND pagato_importo IS NULL
    AND metodo_pagamento IS NULL
    AND tracking IS NULL
    AND note_interne IS NULL
    AND COALESCE(senza_lead, false) = false
    AND aggiornato_il IS NULL
    AND created_at > now() - interval '10 minutes'
    AND created_at <= now() + interval '1 minute'
  );

DROP POLICY IF EXISTS "anyone can insert shop order" ON public.shop_orders;

COMMIT;

-- ── 5. PostgREST ricarica lo schema ───────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- RIPRISTINO (solo se l'ordine di prova NON arriva): togli i due trattini e
-- lancia SOLO queste righe, poi chiedi alla squadra di guardare cosa è andato
-- storto. Rimette la policy larga di prima; le colonne nuove restano e sono
-- innocue.
--
-- BEGIN;
-- DROP POLICY IF EXISTS "anyone can insert shop order" ON public.shop_orders;
-- CREATE POLICY "anyone can insert shop order"
--   ON public.shop_orders FOR INSERT
--   WITH CHECK (true);
-- DROP POLICY IF EXISTS "shop_orders_insert_checkout" ON public.shop_orders;
-- COMMIT;
-- NOTIFY pgrst, 'reload schema';
-- ─────────────────────────────────────────────────────────────────────────────
