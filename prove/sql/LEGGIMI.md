# Collaudo su Postgres vero

`npm test` prova il TypeScript con un database finto e legge il testo delle migrazioni. **Non prova** `pg_advisory_xact_lock`, il tetto contato sotto lucchetto e la doppia applicazione di una migrazione: per quelli serve un Postgres vero. Questa cartella contiene gli script; **non entrano in `npm test`** e non si lanciano sul database di produzione.

## `sheets-lucchetto.sql` (S1, ingresso dal foglio Google)

Serve un Postgres 15 o un `supabase start` con le migrazioni applicate in ordine fino a M1 (`20261023120000_manychat_base.sql`), più la tabella `crm_leads`. `DB` è l'indirizzo di quel database di prova.

```sh
psql "$DB" -v passo=prepara   -f prove/sql/sheets-lucchetto.sql     # applica S1, crea l'utente di prova
# due terminali, B entro 5 secondi da A:
psql "$DB" -v passo=A         -f prove/sql/sheets-lucchetto.sql     # terminale 1
psql "$DB" -v passo=B         -f prove/sql/sheets-lucchetto.sql     # terminale 2
psql "$DB" -v passo=controlla -f prove/sql/sheets-lucchetto.sql
psql "$DB" -v passo=tetto     -f prove/sql/sheets-lucchetto.sql
psql "$DB" -v passo=doppia    -f prove/sql/sheets-lucchetto.sql
psql "$DB" -v passo=pulisci   -f prove/sql/sheets-lucchetto.sql
```

Uscita attesa (ogni passo la scrive in `\echo` sotto il risultato):

| Passo | Atteso |
|---|---|
| `A` | `esito: nuovo`, poi tiene il lucchetto 10 secondi |
| `B` | aspetta circa 10 secondi (`Time: > 8000 ms`), poi `esito: ritorno` e il `lead_id` della scheda di A |
| `controlla` | 1 scheda con quel numero; registro A = `nuovo`, B = `ritorno_da_segnare`; `sheets_ingresso_esito` `t` e poi `f`; la stessa chiave di nuovo = `gia_ricevuto`; stesso id Meta = `gia_presente` |
| `tetto` | con 300 righe di oggi la 301ª risponde `tetto` e non scrive niente; una riga già entrata risponde ancora `gia_ricevuto` |
| `doppia` | S1 due volte di seguito senza errori; `anon` e `authenticated` non eseguono la funzione né leggono la tabella |

**Cosa prova e cosa no:** il lucchetto del tetto (per utente) mette già in fila tutte le richieste dello stesso utente, quindi la prova A/B **non distingue** il lucchetto sul numero da quello del tetto. Prova che non nascono doppioni, ed è quello che conta.

Se `B` risponde `nuovo` invece di `ritorno`, o se `controlla` conta 2 schede, il lucchetto non funziona: **S1 non va applicata in produzione**.

## `ponte-wa.sql` (T1, ponte WhatsApp Baileys)

Serve un database di prova con TUTTE le migrazioni applicate in ordine (`supabase start` va bene: crea `auth.users`, `auth.uid()` e i ruoli `anon`, `authenticated`, `service_role`). Un solo passo, dalla radice del repo:

```sh
psql "$DB" -f prove/sql/ponte-wa.sql
```

Gira tutto in una transazione che finisce con `ROLLBACK`: applica `20261029120000_ponte_whatsapp.sql` **due volte**, crea un mondo inventato, chiama le tre funzioni con le forme JSON di `src/crm/ponte/tipi.ts` e non lascia niente. Ogni controllo stampa `ok  <nome>`; al primo sbagliato si ferma con `KO <nome>: atteso …, avuto …` (uscita di `psql` diversa da 0). Uscita attesa: tutte righe `ok` e in fondo `TUTTI I CONTROLLI DEL PONTE PASSANO`.

Cosa prova: `ponte_wa_noti` (scheda sulle ultime 9 cifre, contatto col «+» o senza, mai un contatto con `origine='baileys'`); `ponte_wa_candidati` (stesso cliente e direzione, 180 s, mai `failed`, mai un altro utente, mai righe del ponte o già prese); `ponte_wa_scrivi` con **due coppie sullo stesso candidato** nella stessa chiamata e in due chiamate (la seconda riga resta visibile, `pari_persi` = 1: è l'indice unico che lavora davvero); lo stesso lotto due volte (niente di nuovo, contatti non riscritti); `unread_count`, `ultimo_in_entrata_*`, `lead_id`, `subscriber_id`, `non_scrivere_dal` identici; `risposto_il` all'orario vero (D8); `updated_at` del contatto toccato anche da una riga più vecchia di `last_message_at`; pari tardivi; righe storte saltate; `anon`/`authenticated` senza `EXECUTE`, `authenticated` che legge solo la sua riga di `ponte_wa_stato` e non scrive.

**Cosa non prova:** la corsa vera fra due sessioni. La seconda chiamata sullo stesso candidato usa lo stesso meccanismo (con due sessioni la seconda aspetta il `COMMIT` della prima sull'indice unico e poi riceve la stessa `unique_violation`), ma non è la stessa cosa di due terminali.

Se un controllo dice `KO`, **la migrazione del ponte non va applicata in produzione**: l'uscita va in LAVAGNA.

## `chat-veloce.sql` (p1-chat-veloce, commessa 2026-10-30-ottimizzazioni)

Serve un database di prova con TUTTE le migrazioni applicate in ordine (`supabase start` va bene). Un solo passo, dalla radice del repo:

```sh
psql "$DB" -f prove/sql/chat-veloce.sql
```

Gira in una transazione che finisce con `ROLLBACK`: crea chat inventate, applica `20261030101100_p1-chat-veloce.sql` **due volte** e controlla il riempimento delle anteprime (uscite comprese, contatto col «+» o senza, doppioni del ponte ed eco vecchie di ManyChat escluse, un utente non tocca l'altro), il trigger dei messaggi nuovi (anteprima tagliata a 200 caratteri, mai indietro con lo storico, mai per un doppione, `updated_at` del contatto mosso), `cambiato_il` scritto dal database all'inserimento e a ogni modifica, il contatto creato dopo il suo primo messaggio, le funzioni chiuse a `anon` e `authenticated`. Uscita attesa: tutte righe `ok` e in fondo `TUTTI I CONTROLLI DELLA CHAT VELOCE PASSANO`.


`sheets-lucchetto.sql`: scritto insieme alla migrazione S1 ma **non ancora eseguito** (nella postazione dove sono stati scritti non c'era un Postgres). Li lancia chi ha il database di prova, e la loro uscita va in LAVAGNA prima di applicare S1.

`ponte-wa.sql`: scritto con T1 (29/10) ma **non ancora eseguito**: nella postazione dello sviluppatore non c'è Postgres (`which postgres psql` vuoto). Va lanciato prima di applicare la migrazione.

`chat-veloce.sql`: eseguito il 30/10 su un Postgres 16 locale usa-e-getta con le sole tabelle `whatsapp_messages` e `whatsapp_contacts` (non tutte le migrazioni): tutte righe `ok`. La migrazione è stata provata anche su tabelle SENZA le colonne del ponte (`canale`, `duplicato_di`): si applica e il trigger lavora. Il 30/10 il capo progetto l'ha lanciato con TUTTE le 66 migrazioni (`commesse/2026-10-30-ottimizzazioni/strumenti/pg-prova.sh`): il controllo delle eco falliva perché i trigger della migrazione, già applicata, scattavano mentre si creava il mondo «di prima»; lo script ora li toglie prima (dentro la transazione). Rilanciato: tutte le 17 righe `ok` e `TUTTI I CONTROLLI DELLA CHAT VELOCE PASSANO`.

## `ponte-invio.sql` (T1, invio a mano dal ponte dopo le 24 ore)

Serve un database di prova con le migrazioni applicate in ordine **fino a `20261029200000_risposte_ai.sql`** (la migrazione dell'invio la applica lo script stesso, due volte). Un solo passo, dalla radice del repo:

```sh
psql "$DB" -f prove/sql/ponte-invio.sql
```

Gira tutto in una transazione che finisce con `ROLLBACK`; ogni controllo stampa `ok  <nome>`, al primo sbagliato si ferma con `KO <nome>: atteso …, avuto …`. Uscita attesa: tutte righe `ok` e in fondo `TUTTI I CONTROLLI DELL'INVIO A MANO PASSANO`. Dentro la transazione `now()` è fermo: gli orari si spostano riscrivendo `created_at` e `preso_il` delle righe di prova.

Cosa prova: `ponte_wa_invio_fatti` (entrata da ManyChat, dal ponte e dal Cloud senza «+»; STOP; numero mai scritto; altro utente; `invii_attivi` assente, non numerico, 0, 1); `ponte_wa_invii_prendi` (coda vuota; due righe → una sola `in_invio`, la seconda aspetta 20 s; il 20° prelievo passa e il 21° no con `attendi_s` esatto; riga di 11 minuti → `scaduto`; `in_invio` di 4 minuti → `esito_incerto`, mai riofferta; STOP e «mai scritto» respinti e si passa alla successiva; parametri nulli → errore); `ponte_wa_invio_esito` (una sola riga `bw:` e `nuovo=false` alla ripetizione; **eco prima dell'esito** e **esito prima dell'eco**: una riga, `risposto_il` una volta; esito dopo `esito_incerto` → `inviato`; **esito `inviato` su riga tornata `in_attesa` → `ok:false`**; `wa_id` storto; `ts` nel futuro, troppo vecchio, `NaN`; contatto che manca; errore con motivo della lista, fuori lista, ripetuto, su riga non `in_invio`); `unread_count`, `ultimo_in_entrata_*`, `lead_id`, `subscriber_id`, `non_scrivere_dal` del contatto identici; i vincoli della tabella (2000 emoji passano, 2001 caratteri no); `anon` e `authenticated` senza `EXECUTE`; **`authenticated` non scrive la tabella nemmeno dopo aver ripristinato i GRANT di serie di Supabase** (lo script li rimette prima di riapplicare la migrazione); un secondo utente non legge le righe del primo.

**Cosa non prova lo script da solo:** la corsa vera fra due sessioni. Il lucchetto `pg_advisory_xact_lock` si prova a mano con due terminali: nel primo `BEGIN; SELECT public.ponte_wa_invii_prendi(…); SELECT pg_sleep(6); COMMIT;`, nel secondo la stessa chiamata entro 2 secondi: deve aspettare la fine del primo e poi rispondere `invio: null` con `attendi_s` > 0 (provato il 30/10/2026 su Postgres 16: la seconda sessione ha aspettato 4 secondi, nessun doppio prelievo).

Se un controllo dice `KO`, **la migrazione dell'invio non va applicata in produzione**: l'uscita va in LAVAGNA.
