-- ── DA CHE SCHERMO GUARDANO ─────────────────────────────────────────────────
--  Due numeri per spettatore: la larghezza e l'altezza della sua finestra.
--
--  ⚠️ SI SALVA LA MISURA VERA, non una parola tipo «mobile». Le classi
--   («telefono», «tablet», «schermo grande») le decide chi legge, e le soglie
--   cambiano ogni due anni: un telefono pieghevole aperto è largo come un
--   tablet di sei anni fa. Salvando la parola, il giorno che la soglia cambia
--   i dati vecchi restano classificati con la regola vecchia e nessuno se ne
--   accorge. Salvando il numero, si riclassifica tutto rileggendo.
--
--  Serve al presentatore per una cosa sola ma concreta: sapere che in sala c'è
--  gente col telefono PRIMA di mostrare una tabella che sul telefono non si
--  legge — non dopo, leggendo in chat «non si vede niente».
alter table public.webinar_presenze add column if not exists larghezza integer;
alter table public.webinar_presenze add column if not exists altezza   integer;
