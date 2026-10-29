-- ── LA NOTIFICA QUANDO UN LEAD RISPONDE: UNA PER NUMERO (30/10/2026) ────────
-- Commessa 2026-10-30-ottimizzazioni, pacchetto p2-push-risposte.
-- Lo stesso messaggio del cliente può arrivare da due strade (ManyChat e il
-- ponte WhatsApp del Mac, o il webhook di Meta). Senza questa porta il telefono
-- suonerebbe due volte. `push_avviso_porta` dice «sì» al più una volta ogni
-- `p_finestra_s` secondi per lo stesso numero (il server passa 180 s,
-- `FINESTRA_AVVISO_S` in src/crm/push/avviso.ts).
--
-- ⚠️ SOLO AGGIUNTIVA: una tabella nuova e una funzione nuova, niente su quelle
--   esistenti.
-- ⚠️ NESSUNA POLITICA RLS = nessun accesso dal browser. La funzione la chiama
--   solo il server (service_role).
-- ⚠️ `chiave` = le ultime 9 cifre del numero (`chiaveTelefono`), la stessa che
--   già sta nel tag della notifica. Nessun nome, nessun testo.
-- ⚠️ Senza questa migrazione il server avvisa comunque (come prima: a volte due
--   volte lo stesso messaggio).
--
-- COME SI ANNULLA (solo a mano, con l'OK del titolare):
--   DROP FUNCTION public.push_avviso_porta(uuid, text, integer);
--   DROP TABLE public.push_avvisi_recenti;

CREATE TABLE IF NOT EXISTS public.push_avvisi_recenti (
  -- l'installazione del CRM (lo stesso user_id di push_iscrizioni)
  user_id uuid NOT NULL,
  -- le ultime 9 cifre del numero del cliente
  chiave text NOT NULL,
  -- l'ultima notifica partita per questo numero
  ultimo_il timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chiave)
);

ALTER TABLE public.push_avvisi_recenti ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_avvisi_recenti FROM anon, authenticated;

-- Vero = si avvisa (e l'ora si segna). Un solo comando: due richieste insieme
-- per lo stesso numero si mettono in fila sulla riga, e la seconda trova l'ora
-- appena scritta, quindi riceve «falso».
CREATE OR REPLACE FUNCTION public.push_avviso_porta(p_user_id uuid, p_chiave text, p_finestra_s integer)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  WITH segnato AS (
    INSERT INTO public.push_avvisi_recenti AS r (user_id, chiave, ultimo_il)
    VALUES (p_user_id, p_chiave, now())
    ON CONFLICT (user_id, chiave) DO UPDATE
      SET ultimo_il = excluded.ultimo_il
      WHERE r.ultimo_il <= excluded.ultimo_il - make_interval(secs => greatest(coalesce(p_finestra_s, 0), 0))
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM segnato);
$$;

REVOKE ALL ON FUNCTION public.push_avviso_porta(uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_avviso_porta(uuid, text, integer) TO service_role;
