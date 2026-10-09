-- ── LA SALA DEL WEBINAR ─────────────────────────────────────────────────────
--  Quattro tavoli. Stanno qui e non in `app_config` come la stanza, per una
--  ragione sola ma decisiva: `app_config` è UNA RIGA per chiave, e cinquecento
--  spettatori che dicono «ci sono ancora» ogni venti secondi sono venticinque
--  scritture al secondo sulla stessa riga. L'ultima vince e le altre spariscono:
--  il contatore direbbe numeri a caso.
--  Con una riga per persona, invece, non si pestano i piedi.
--
--  ⚠️ RLS ACCESO E NESSUNA POLICY, ED È VOLUTO. A questi tavoli si arriva solo
--   dalle rotte del server, che usano la chiave di servizio e passano sopra
--   l'RLS. Un browser che provasse a leggerli in diretta con la chiave pubblica
--   non vedrebbe niente — e non deve: la chat di un webinar di vendita contiene
--   nomi e domande di persone che stanno valutando un trattamento.

-- Chi c'è adesso. Una riga per spettatore, riscritta a ogni battito.
create table if not exists public.webinar_presenze (
  codice      text        not null,
  spettatore  text        not null,
  nome        text,
  visto_il    timestamptz not null default now(),
  primary key (codice, spettatore)
);
create index if not exists webinar_presenze_freschi
  on public.webinar_presenze (codice, visto_il desc);

-- La chat.
create table if not exists public.webinar_messaggi (
  id         uuid        primary key default gen_random_uuid(),
  codice     text        not null,
  spettatore text,
  autore     text        not null,
  --  'presentatore' = lo studio · 'palco' = chi sta parlando in diretta ·
  --  'ospite' = chi guarda. Decide colore ed evidenziazione nella lista.
  ruolo      text        not null default 'ospite',
  testo      text        not null,
  fissato    boolean     not null default false,
  creato_il  timestamptz not null default now()
);
create index if not exists webinar_messaggi_recenti
  on public.webinar_messaggi (codice, creato_il desc);

-- Il palco: chi, oltre al presentatore, sta parlando in diretta.
create table if not exists public.webinar_palco (
  codice        text        not null,
  spettatore    text        not null,
  nome          text        not null default 'Ospite',
  --  'attesa' = ha alzato la mano · 'audio' = parla · 'video' = parla e si vede
  stato         text        not null default 'attesa',
  --  il microfono aperto o chiuso: lo comanda il presentatore dalla chat
  microfono     boolean     not null default false,
  --  sta parlando ADESSO: lo scrive il suo browser, serve all'icona che si
  --  illumina. È l'unico campo che si aggiorna spesso, per questo sta qui e
  --  non insieme al resto della stanza.
  parla         boolean     not null default false,
  --  il lasciapassare per pubblicare: lo conia il presentatore quando fa salire
  --  qualcuno, e senza di questo nessuno può mandare audio o video nella sala.
  pass          text,
  session_id    text,
  traccia_audio text,
  traccia_video text,
  salito_il     timestamptz not null default now(),
  primary key (codice, spettatore)
);

-- I messaggi che partono da soli al minuto stabilito.
--  ⚠️ SONO MESSAGGI DELLO STUDIO, non di finti spettatori: `autore` viene
--   sempre riscritto col nome del presentatore quando il messaggio parte.
create table if not exists public.webinar_programmati (
  id         uuid        primary key default gen_random_uuid(),
  codice     text        not null,
  minuto     integer     not null default 0,
  testo      text        not null,
  fissa      boolean     not null default false,
  inviato_il timestamptz,
  creato_il  timestamptz not null default now()
);
create index if not exists webinar_programmati_ordine
  on public.webinar_programmati (codice, minuto);

alter table public.webinar_presenze    enable row level security;
alter table public.webinar_messaggi    enable row level security;
alter table public.webinar_palco       enable row level security;
alter table public.webinar_programmati enable row level security;
