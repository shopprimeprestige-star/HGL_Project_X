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

## Stato

Scritti insieme alla migrazione S1 ma **non ancora eseguiti** (nella postazione dove sono stati scritti non c'era un Postgres). Li lancia chi ha il database di prova, e la loro uscita va in LAVAGNA prima di applicare S1.
