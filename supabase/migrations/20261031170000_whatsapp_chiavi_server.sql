-- ─────────────────────────────────────────────────────────────────────────────
-- LE CHIAVI META STANNO SOLO SUL SERVER (31/10/2026)
--
-- Commessa 2026-10-31-anteprima-link (revisione). `whatsapp_settings` tiene in chiaro il token
-- permanente di Meta (`access_token`), l'`app_secret` e il `webhook_verify_token`, e la policy
-- «users view own whatsapp settings» li rendeva leggibili dal browser: col PIN la sessione Supabase
-- è quella del titolare per tutti, quindi una setter con la sessione aperta poteva leggerli dalla
-- console. Da qui il browser (anon, authenticated) non li legge né li scrive: passano dalla rotta
-- `/api/crm/whatsapp-chiavi` (service_role, dietro il permesso «impostazioni»).
--
-- COSA FA (solo permessi: nessun dato cambia, nessuna riga si tocca)
--   · toglie al browser SELECT, INSERT e UPDATE sull'INTERA tabella;
--   · li rida COLONNA PER COLONNA, escludendo access_token, app_secret e webhook_verify_token.
--   Colonna per colonna perché una REVOKE di colonna non vale se resta la GRANT di tabella.
--   Le policy RLS restano. `service_role` non cambia (salta i permessi).
--   Chi legge/scrive dal browser le colonne non segrete (default_values, status_template_map,
--   disabled_template_statuses…) continua a funzionare.
--
-- ⚠️ ORDINE DI PUBBLICAZIONE: PRIMA il codice (funziona con e senza questa migrazione), POI questa.
--   Al contrario il vecchio pannello, con la `select("*")` negata, si apre vuoto e un «Salva» azzera
--   le chiavi di adesso.
-- ⚠️ Le colonne che si aggiungeranno in futuro NON sono leggibili dal browser finché non le si
--   concede qui sotto.
-- ⚠️ SE NEL DATABASE C'ERA GIÀ UN TOKEN, va considerato esposto: rigenerarlo in Business Manager
--   dopo questa migrazione e reinserirlo dal pannello.
--
-- COME SI ANNULLA (solo se serve davvero):
--   GRANT SELECT, INSERT, UPDATE ON public.whatsapp_settings TO authenticated;
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE SELECT, INSERT, UPDATE ON public.whatsapp_settings FROM anon, authenticated;

GRANT SELECT (user_id, phone_number_id, business_account_id, mode, status_template_map,
              default_values, disabled_template_statuses, created_at, updated_at)
  ON public.whatsapp_settings TO authenticated;

GRANT INSERT (user_id, phone_number_id, business_account_id, mode, status_template_map,
              default_values, disabled_template_statuses)
  ON public.whatsapp_settings TO authenticated;

GRANT UPDATE (phone_number_id, business_account_id, mode, status_template_map,
              default_values, disabled_template_statuses, updated_at)
  ON public.whatsapp_settings TO authenticated;
