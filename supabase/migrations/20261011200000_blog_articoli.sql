-- ── GLI ARTICOLI DEL BLOG ────────────────────────────────────────────────────
--
--  Un articolo nasce BOZZA (lo carica AIOS o lo scrive qualcuno nel CRM),
--  diventa PUBBLICATO solo quando una persona preme «Pubblica» nel CRM, e si
--  può RITIRARE senza cancellarlo.
--
--  ⚠️ IL PUBBLICO LEGGE SOLO I PUBBLICATI. La regola qui sotto è l'unica cosa
--   che il browser di un visitatore può fare su questa tabella: niente bozze,
--   niente note interne, niente scritture. Tutto il resto passa dal server con
--   la chiave di servizio (api/crm/blog e api/blog/bozza), che controlla chi
--   chiede.

create table if not exists public.blog_articoli (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  titolo text not null,
  descrizione text not null default '',
  corpo text not null default '',
  parola_chiave text not null default '',
  autore text not null default 'Hair Genius Labs',
  stato text not null default 'bozza' check (stato in ('bozza', 'pubblicato', 'ritirato')),
  faq jsonb not null default '[]'::jsonb,
  immagine text,
  -- da dove arriva: "aios", "crm"
  fonte text,
  -- note interne per chi approva (fonti, dubbi, cosa verificare): mai pubbliche
  note text,
  creato_il timestamptz not null default now(),
  aggiornato_il timestamptz not null default now(),
  pubblicato_il timestamptz
);

create index if not exists blog_articoli_pubblicati
  on public.blog_articoli (pubblicato_il desc)
  where stato = 'pubblicato';

alter table public.blog_articoli enable row level security;

drop policy if exists "blog: il pubblico legge i pubblicati" on public.blog_articoli;
create policy "blog: il pubblico legge i pubblicati"
  on public.blog_articoli
  for select
  to anon, authenticated
  using (stato = 'pubblicato');

-- ⚠️ La policy filtra le RIGHE, non le colonne: le note interne si tolgono
--  anche dalle colonne leggibili, così un visitatore non le vede nemmeno su un
--  articolo pubblicato.
revoke all on public.blog_articoli from anon, authenticated;
grant select (id, slug, titolo, descrizione, corpo, parola_chiave, autore, stato, faq, immagine, aggiornato_il, pubblicato_il)
  on public.blog_articoli to anon, authenticated;
