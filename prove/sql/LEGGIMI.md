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

## `ponte-tutte.sql` (Blocco 1 della commessa 2026-10-30-ponte-tutte-le-chat)

Serve un database di prova con le migrazioni applicate in ordine **fino a `20261030140000`** (la migrazione nuova, `20261030160000_ponte_tutte_le_chat.sql`, la applica lo script stesso, **due volte**, dopo quella del ponte). Un solo passo, dalla radice del repo:

```sh
psql "$DB" -f prove/sql/ponte-tutte.sql
```

Gira in una transazione che finisce con `ROLLBACK`; ogni controllo stampa `ok  <nome>`, al primo sbagliato si ferma con `KO <nome>: atteso …, avuto …`. Uscita attesa: 43 righe `ok` e in fondo `TUTTI I CONTROLLI DI «TUTTE LE CHAT» PASSANO`. Dentro la transazione `now()` è fermo: l'attesa dei 120 secondi si prova con `p_attesa_s = 0` e riscrivendo `attesa_dal`.

Cosa prova: uno sconosciuto che scrive adesso (contatto `baileys` senza scheda, 0 non letti, **nome non salvato**; `attesa_dal` scritto; `promuovi(120)` a 0, 100 e 130 secondi; +1 non letti, entrata all'ora vera, anteprima; rilancio = 0; lo stesso lotto di nuovo non riscrive `attesa_dal`); il pari ManyChat trovato **prima** (mai promossa); il pari ManyChat **dopo** la promozione (ritiro −1 una volta sola, `promosso_il` vuoto, rilancio dei pari senza secondo −1); il pari **Cloud** dopo la promozione (nessun ritiro); lo storico, un'entrata di 8 giorni e un'uscita viva (mai `attesa_dal`, nessun non letto); `risposto_il` successivo al messaggio (saltata, nessun +1); non letti già a 0 e ritiro (resta 0); **R1b** vedi sotto; il nome (contatto del ponte senza scheda e senza nome: resta vuoto; con nome: resta; con scheda: si scrive come oggi); la promozione di un lead (scheda, id ManyChat, STOP, `risposto_il` identici; un messaggio più vecchio dell'ultima entrata non la riporta indietro); contatto assente (la riga resta), attesa di 2 giorni fa (mai), tetto di 500 per chiamata (600 → 500 + 100), parametri nulli, altro utente; `anon`/`authenticated` senza `EXECUTE` su `ponte_wa_promuovi`, `ponte_wa_ritira`, `ponte_wa_scrivi`.

**Regressione di `ponte_wa_scrivi` (v2 contro v1).** `ponte-wa.sql` e `ponte-invio.sql` applicano solo le migrazioni vecchie. Per rilanciarli con la migrazione nuova già applicata (dalla radice del repo, file temporanei fuori dal repo):

```sh
for f in ponte-wa ponte-invio; do
  awk '{print} /^\\i :migrazione/ {c++; if (c==2) {print "\\i supabase/migrations/20261030160000_ponte_tutte_le_chat.sql"; print "\\i supabase/migrations/20261030160000_ponte_tutte_le_chat.sql"}}' prove/sql/$f.sql > /tmp/$f-v2.sql
done
sed -i '' "s/|Prova Uno|true'/|true'/" /tmp/ponte-wa-v2.sql      # l'UNICA differenza attesa: il nome del profilo non si salva più (E7)
psql "$DB" -f /tmp/ponte-wa-v2.sql
psql "$DB" -f /tmp/ponte-invio-v2.sql
```

Le due prove vecchie passano **identiche** salvo quel nome: è la conferma che `ponte_wa_scrivi` v2 non ha rotto altro. Il confronto del testo con la v1 lo fa anche `prove/ponte/tutte-migrazione.mjs` (entra in `npm test`).

**R1b, pari che non si abbina.** Se un'entrata viva del ponte e quella di ManyChat sono lo stesso messaggio ma **non si abbinano** (testo diverso, oppure ManyChat arriva oltre i 180 s), il ponte promuove la sua (+1) e ManyChat fa il suo (+1) **senza ritiro**: il contatto conta 2 non letti per un messaggio solo (prima restava una riga doppia visibile e 1 non letto). Raro, accettato, scritto nel piano (R1b). Il ritiro non scende mai sotto 0 (caso 7).

**Cosa non prova lo script da solo:** la corsa vera fra due sessioni. Si prova a mano: con un lotto vivo scritto e committato, sessione 1 `BEGIN; SELECT ponte_wa_promuovi(u, 0); SELECT pg_sleep(4); COMMIT;` e, entro 1 secondo, sessione 2 `SELECT ponte_wa_promuovi(u, 0);`. La seconda **non aspetta** (`SKIP LOCKED`) e risponde `promosse: 0`; alla fine i non letti sono 1. Provato il 30/10/2026 su Postgres 16: sessione 1 `promosse: 1`, sessione 2 `promosse: 0`, non letti 1.

Eseguito il 30/10/2026 su un Postgres 16 locale usa-e-getta con tutte le 74 migrazioni di prima: `ponte-tutte.sql` 43 `ok`; `ponte-wa-v2` 25 `ok`; `ponte-invio-v2` 73 `ok`.

## `ponte-immagini.sql` (T4 della commessa 2026-10-30-ponte-storico-completo, le immagini del ponte)

Serve un database di prova con **tutte** le migrazioni applicate in ordine, compresa `20261030170000_ponte_immagini.sql` (lo script la riapplica altre due volte), e con lo schema `storage` (`buckets` e `objects`: `supabase start` ce l'ha; il banco usa-e-getta `commesse/2026-10-30-ottimizzazioni/strumenti/pg-prova.sh` lo imita). Un solo passo, dalla radice del repo:

```sh
bash "<cartella commesse>/2026-10-30-ottimizzazioni/strumenti/pg-prova.sh" "$PWD" prove/sql/ponte-immagini.sql
# oppure, su un database già pronto:
psql "$DB" -f prove/sql/ponte-immagini.sql
```

Gira in una transazione che finisce con `ROLLBACK`; ogni controllo stampa `ok  <nome>`, al primo sbagliato si ferma con `KO <nome>: atteso …, avuto …`. Uscita attesa: 56 righe `ok` (più `migrazioni ok=N ko=0` dello script) e in fondo `TUTTI I CONTROLLI DELLE IMMAGINI PASSANO`. Gli «oggetti» di Storage sono righe finte in `storage.objects`.

Cosa prova: il bucket `ponte-media` (privato, 8 MiB, solo jpeg/png/webp, né SVG né HTML; la migrazione non aggiunge policy a `storage.objects` e nessuna nomina `ponte-media`); il seme di `app_config` (spento di serie, 0,8 GB, in testo; riapplicata non riscrive una scelta già fatta); `ponte_wa_media_permesso` (tipo e peso fuori lista → rifiuto senza riga; chiave, numero o utente non validi → errore, mai una riga; percorso `<user_id>/<uuid>.<ext>` senza il numero; stessa chiave due volte → stesso percorso e una sola riga; foto già pronta → `gia_presente` anche a tetto zero; **tetto**: solo `ponte-media`, peso vero degli oggetti e non il dichiarato, inclusivo, tetto nullo o zero → rifiuto, un caricamento in corso di 3 ore non conta e uno di 1 ora e 59 sì; **ripresa** di un caricamento riuscito ma non confermato); `ponte_wa_media_fatto` (senza oggetto resta `in_caricamento`; con l'oggetto prende **il peso di `metadata.size`** anche se il dichiarato era 1; altro bucket, peso illeggibile o oltre 8 MiB non valgono; un altro utente non chiude la riga altrui); `anon` e `authenticated` senza `EXECUTE`; `authenticated` legge solo le sue righe e non scrive; la policy ha la stessa forma di quella di `whatsapp_messages`; nessuna scrittura su `whatsapp_messages` né `whatsapp_contacts`.

Se un controllo dice `KO`, **la migrazione delle immagini non va applicata in produzione**: l'uscita va in LAVAGNA.

## `ponte-reimport.sql` (T4, il «secondo import» dopo il ricollegamento)

Serve un database di prova con **tutte** le migrazioni applicate (il file non ne applica: usa `ponte_wa_scrivi` v2, `ponte_wa_ritira`, `ponte_wa_promuovi`, `ponte_wa_candidati`). Lo stesso comando di sopra, con `prove/sql/ponte-reimport.sql`. Uscita attesa: 33 righe `ok` e `TUTTI I CONTROLLI DEL SECONDO IMPORT PASSANO`.

Cosa prova (il mondo è descritto in testa al file): un lotto «storico» con una riga già importata, una già nascosta, una **visibile e già promossa** il cui pari ManyChat compare dopo, un vecchio mai importato uguale a una riga ManyChat (−5 s) e uno a 4 minuti, ripassato **due volte**. La prima volta `nuovi` sono solo i mai visti; il vecchio uguale entra nascosto, quello a 4 minuti visibile; la riga già nascosta mantiene il suo `duplicato_di` (anche se si offre un altro pari); la riga promossa con il pari tardivo prende `duplicato_di`, `promosso_il` si svuota e i non letti scendono di **uno, una volta sola** (2 → 1). La seconda volta tutto `gia_presenti`, nessun secondo −1, nemmeno rilanciando gli stessi pari. Invariati: `lead_id`, `non_scrivere_dal`, `risposto_il`, `ultimo_in_entrata_*`, `subscriber_id`, nome e `last_message_at` di tutti i contatti (l'unico a cambiare è quello della riga promossa, e solo nei non letti); lo storico non scrive `attesa_dal` né `promosso_il`; `ponte_wa_promuovi` dopo il reimport → 0. Le **tre misure di b.4** girano sul mondo inventato: doppioni esterni prima/dopo (1 e 1, ma sono righe diverse: la sonda a 600 s vede quella a 4 minuti, l'abbinamento a 180 s no, di proposito), interni 0 (1 se si inserisce lo stesso id con due numeri), segnaposto `-nd` 0 (1 con un segnaposto).
