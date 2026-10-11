-- ── LA MISURA DI UNA DIRETTA ────────────────────────────────────────────────
--
--  Serve a rispondere a quattro domande che oggi non hanno risposta: quante
--  persone sono entrate, quanto sono rimaste, A CHE MINUTO se ne sono andate, e
--  quante hanno fatto il gesto che conta alla fine.
--
--  ⚠️ LA TERZA È LA PIÙ PREZIOSA E NON COSTA NIENTE IN PIÙ. Con l'istante in
--   cui una persona è entrata e quello in cui l'abbiamo vista l'ultima volta si
--   sa, per ogni minuto della diretta, quante persone c'erano: basta contare
--   chi era già dentro e non era ancora uscito. Il minuto in cui la curva crolla
--   è il punto in cui il discorso perde, ed è l'unica informazione che dice
--   DOVE intervenire invece che «è andata male».

-- Quando una persona è entrata. ⚠️ `default now()` e MAI scritta a mano: il
-- valore di partenza vale solo all'inserimento, quindi i battiti successivi —
-- che riscrivono la riga ogni venti secondi — non lo toccano. Scrivendola dal
-- programma si sovrascriverebbe a ogni battito, e ogni permanenza risulterebbe
-- di zero secondi.
alter table public.webinar_presenze
  add column if not exists entrato_il timestamptz not null default now();

-- ── I GESTI CHE CONTANO ─────────────────────────────────────────────────────
--  Non «tutti i clic»: solo quelli che dicono qualcosa sull'esito. Oggi uno
--  solo — chi tocca il tasto WhatsApp alla fine — ma la forma regge anche gli
--  altri senza migrazioni nuove.
--
--  ⚠️ UNA RIGA PER PERSONA E PER GESTO, non una per clic: la domanda è «quante
--   persone l'hanno fatto», non «quante volte è stato premuto». Chi torna
--   indietro e ripreme non deve contare due volte, altrimenti il tasso di
--   conversione può superare il cento per cento — e un numero impossibile
--   toglie fiducia a tutti gli altri.
create table if not exists public.webinar_azioni (
  codice     text        not null,
  spettatore text        not null,
  azione     text        not null,
  quando     timestamptz not null default now(),
  primary key (codice, spettatore, azione)
);
create index if not exists webinar_azioni_per_sala
  on public.webinar_azioni (codice, azione);

alter table public.webinar_azioni enable row level security;
