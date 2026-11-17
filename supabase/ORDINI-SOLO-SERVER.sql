-- ─────────────────────────────────────────────────────────────────────────────
-- E-COMMERCE NEL CRM · M2 · GLI ORDINI SI LEGGONO SOLO DAL SERVER
--
-- Commessa 2026-11-17-crm-ecommerce (PIANO.md §3.2, D12, compito T2).
-- ⚠️ È FUORI da supabase/migrations/ APPOSTA: «supabase db push» applica tutto
-- ciò che sta lì (DEPLOY.md), e questo file NON va lanciato in automatico.
-- Lo lancia il TITOLARE, a mano, dal SQL Editor, SOLO quando decide di farlo.
--
-- QUANDO: alla consegna di R2 (la pagina E-commerce), DOPO il collaudo:
--   · M1 (20261117120000_ecommerce_ordini.sql) è applicata e l'ordine anonimo
--     di prova è arrivato;
--   · la pagina E-commerce mostra gli ordini (li legge dalla rotta del server,
--     non dal browser).
-- È CONSIGLIATA. Decisione del titolare: data ____ / ____ / ________.
--
-- PERCHÉ: oggi chi è entrato nel CRM con un account Supabase (non con il PIN)
-- può leggere e modificare TUTTE le righe di shop_orders direttamente dal
-- browser, perché esistono due policy «per gli autenticati». Chi entra col PIN
-- no. La rotta del server rende «solo il permesso pagamenti» una regola vera
-- per tutti; ma finché queste due policy ci sono, un account Supabase può
-- aggirarla. Qui le togli. Nessun codice del sito legge o scrive shop_orders dal
-- browser, tranne l'inserimento del checkout (che resta: la sua policy è un'altra).
--
-- ⚠️ Controlla prima di lanciarlo (Authentication > Settings): la registrazione
-- libera di nuovi account Supabase dovrebbe essere spenta, altrimenti la cosa
-- sensata è spegnerla comunque.
--
-- COSA FA: toglie «authenticated can read shop orders» e «authenticated can
-- update shop orders». Nessun dato viene toccato. Il server (service role) non
-- è soggetto alle policy: continua a leggere e scrivere. L'ordine anonimo dal
-- sito continua ad arrivare.
-- LANCIARLO DUE VOLTE NON FA DANNI (DROP POLICY IF EXISTS).
--
-- QUERY DI CONTROLLO dopo averlo lanciato (deve restare UNA sola riga, l'insert):
--
--   select policyname, cmd from pg_policies
--    where schemaname = 'public' and tablename = 'shop_orders';
--
-- COME SI ANNULLA: vedi in fondo.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

DROP POLICY IF EXISTS "authenticated can read shop orders" ON public.shop_orders;
DROP POLICY IF EXISTS "authenticated can update shop orders" ON public.shop_orders;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- RIPRISTINO (rimette le due policy di prima): togli i due trattini e lancia
-- SOLO queste righe.
--
-- BEGIN;
-- DROP POLICY IF EXISTS "authenticated can read shop orders" ON public.shop_orders;
-- CREATE POLICY "authenticated can read shop orders"
--   ON public.shop_orders FOR SELECT
--   USING (auth.role() = 'authenticated');
-- DROP POLICY IF EXISTS "authenticated can update shop orders" ON public.shop_orders;
-- CREATE POLICY "authenticated can update shop orders"
--   ON public.shop_orders FOR UPDATE
--   USING (auth.role() = 'authenticated');
-- COMMIT;
-- NOTIFY pgrst, 'reload schema';
-- ─────────────────────────────────────────────────────────────────────────────
