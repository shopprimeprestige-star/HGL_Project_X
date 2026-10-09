-- ── CHI SI È ISCRITTO A UNA DIRETTA ─────────────────────────────────────────
--
--  ⚠️ FINO A OGGI GLI ISCRITTI ERANO UN NUMERO SCRITTO A MANO. Si poteva
--   mostrarlo in sala, e basta: non esisteva una lista. Senza lista non si può
--   avvisare nessuno che si comincia, non si può ricontattare chi si era
--   iscritto e non è venuto, e non si può ricontattare chi è venuto, è rimasto
--   quaranta minuti e non ha scritto. In un webinar quelle tre cose sono la
--   maggior parte del fatturato.
--
--  ⚠️ UNA RIGA PER PERSONA E PER SALA, non una per iscrizione: chi apre il
--   link due volte e si iscrive di nuovo non deve ricevere due promemoria né
--   contare due volte. La chiave è (codice, contatto).
create table if not exists public.webinar_iscritti (
  codice     text        not null,
  -- Il numero già pronto da chiamare, in forma internazionale (39…): la
  -- normalizzazione si fa PRIMA di scrivere, perché un numero scritto in
  -- quattro modi diversi diventa quattro persone.
  contatto   text        not null,
  nome       text,
  quando     timestamptz not null default now(),
  -- ⚠️ Quando gli abbiamo mandato l'ultimo avviso. Serve a non mandarne due:
  --  un promemoria doppio è il modo più veloce di farsi bloccare il numero, e
  --  su WhatsApp un blocco non si toglie.
  avvisato_il timestamptz,
  primary key (codice, contatto)
);
create index if not exists webinar_iscritti_per_sala
  on public.webinar_iscritti (codice, quando desc);

alter table public.webinar_iscritti enable row level security;
