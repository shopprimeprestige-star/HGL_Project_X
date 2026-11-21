-- ─────────────────────────────────────────────────────────────────────────────
-- SHOP R1 · D40 · INVISIBLE DERM SI PUÒ PUBBLICARE ANCHE SENZA PREZZO
--
-- Commessa 2026-11-20-shop-completo (T32, fase 2). La applica il TITOLARE, a mano, dal
-- SQL Editor di Supabase, DOPO S1 (20261120120000_shop_catalogo.sql). La squadra non la
-- lancia mai e non usa «supabase db push».
--
-- IL PROBLEMA
--   Il trigger di S1 (shop_controlla_pubblicazione) rifiuta di pubblicare un prodotto se
--   non ha una variante attiva con SKU e prezzo effettivo > 0. Il titolare ha deciso (D39)
--   che Invisible Derm è SEMPRE senza prezzo: non si vende dallo shop, e il suo prezzo non
--   esce mai dal server. Con prezzo 0 il pannello e il server lo lasciano pubblicare (D40),
--   ma il database dice di no (errore 23514) e il prodotto non si pubblica mai.
--
-- COSA FA (una sola cosa)
--   Sostituisce il corpo della funzione del trigger (CREATE OR REPLACE: i due trigger che
--   la chiamano restano com'erano e continuano a usarla). Cambia UN controllo: il prezzo
--   > 0 non si chiede a Invisible Derm. Tutto il resto è identico a S1: descrizione breve,
--   categoria, foto principale con testo alternativo (e liberatoria se ritrae persone),
--   variante ATTIVA con SKU.
--
-- COME SI RICONOSCE INVISIBLE DERM (la stessa regola di `eInvisibleDerm`, src/shop/cms/pubblico.ts)
--   · il NOME comincia con «Invisible Derm» (o «Invisibile»), senza maiuscole, con spazio,
--     trattino, trattino basso, punto, barra o «&» fra le due parole, e «derm» è una parola
--     intera che non diventa «dermatolog…»: «Solvente per Invisible Derm» e «Kit Invisible
--     Derm» NON sono Invisible Derm e conservano l'obbligo del prezzo;
--   · oppure lo SLUG comincia con «invisible-derm».
--
-- COSA NON FA
--   Nessuna riga viene toccata, nessuna tabella, vista, colonna o permesso cambia, nessun
--   trigger nuovo, niente viene cancellato. Si può applicare due volte: la seconda
--   riscrive la stessa funzione. Un prodotto già pubblicato non viene ricontrollato (il
--   trigger parte solo quando lo stato DIVENTA «pubblicato»).
--   Il prezzo non lo scrive nessuno: resta 0 e il sito non lo mostra mai.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.shop_controlla_pubblicazione()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_senza_prezzo boolean;
BEGIN
  -- Invisible Derm: la stessa regola di `eInvisibleDerm` (pubblico.ts). `\y` è il confine di parola di Postgres.
  v_senza_prezzo := NEW.nome ~* '^[[:space:]]*invisibi?l[ei][[:space:]_./&-]*derm\y(?!atolog)'
                 OR NEW.slug ~* '^[[:space:]]*invisible-derm';
  IF btrim(COALESCE(NEW.descrizione_breve, '')) = '' THEN
    RAISE EXCEPTION 'shop_pubblicazione_negata: manca la descrizione breve' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shop_prodotti_categorie pc WHERE pc.prodotto_id = NEW.id) THEN
    RAISE EXCEPTION 'shop_pubblicazione_negata: manca la categoria' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.shop_media m
     WHERE m.prodotto_id = NEW.id
       AND m.slot = 'principale'
       AND m.rimosso_il IS NULL
       AND btrim(COALESCE(m.alt, '')) <> ''
       AND (NOT m.ritrae_persone OR m.liberatoria_ok)
  ) THEN
    RAISE EXCEPTION 'shop_pubblicazione_negata: manca la foto principale con il testo alternativo' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.shop_varianti v
     WHERE v.prodotto_id = NEW.id
       AND v.attiva
       AND btrim(COALESCE(v.sku, '')) <> ''
       AND (v_senza_prezzo OR COALESCE(v.prezzo_cent, NEW.prezzo_cent) > 0)
  ) THEN
    IF v_senza_prezzo THEN
      RAISE EXCEPTION 'shop_pubblicazione_negata: manca una variante attiva con SKU' USING ERRCODE = 'check_violation';
    END IF;
    RAISE EXCEPTION 'shop_pubblicazione_negata: manca una variante attiva con SKU e prezzo' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$$;

-- Come in S1: la funzione del trigger la esegue il database da sé, nessuno la chiama (niente GRANT).
REVOKE ALL ON FUNCTION public.shop_controlla_pubblicazione() FROM PUBLIC, anon, authenticated;
