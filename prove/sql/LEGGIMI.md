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

## `ponte-chat-flag.sql` (commessa 2026-11-13-chat-baileys, filo A, T1: il segno «ha_messaggio_ponte»)

Serve un database di prova con **tutte** le migrazioni applicate in ordine (la migrazione nuova, `20261113120000_ponte_chat_flag.sql`, la applica lo script stesso, più volte: due di seguito all'inizio, e una terza volta dopo aver aggiunto un contatto con una cronologia del ponte già scritta, per provare il riempimento una tantum). Lo stesso comando di `ponte-tutte.sql`, con `prove/sql/ponte-chat-flag.sql`. Gira in una transazione che finisce con `ROLLBACK`. Uscita attesa: tutte righe `ok` e in fondo `TUTTI I CONTROLLI DEL SEGNO HA_MESSAGGIO_PONTE PASSANO`.

Cosa prova: `ponte_wa_scrivi` segna `ha_messaggio_ponte` sia per un contatto che esiste già sia per un numero che nasce SOLO dal ponte (messaggi scritti prima del contatto, lo scenario dello storico); `ponte_wa_invio_esito` segna il contatto della chat su cui si è "scritto dal telefono" (ramo UPDATE e ramo INSERT); una chat solo ManyChat resta `false`; un altro utente (stesso numero) non viene toccato; un numero senza «+» combacia con un messaggio che ha il «+»; rilanciare la migrazione non spegne un segno già acceso; il riempimento una tantum segna un contatto con una cronologia baileys scritta PRIMA della migrazione; il trigger (seconda rete) segna un contatto esistente con un `INSERT` diretto su `whatsapp_messages`, e NON scatta per un messaggio non-baileys; `anon`/`authenticated` senza `EXECUTE` sul trigger; **`ponte_wa_scrivi`, chiamata con 50.000 righe di cronologia già presenti per un numero NON toccato dalla chiamata, non fa una scansione** (verificato con `EXPLAIN (ANALYZE, BUFFERS)`: il piano non mostra `Seq Scan` né `Index Scan` su `whatsapp_messages` per la parte nuova).

Il confronto del testo di `ponte_wa_scrivi`/`ponte_wa_invio_esito` con le versioni già in produzione (che questa commessa non tocca) lo fa `prove/ponte/chat-flag-migrazione.mjs` (entra in `npm test`).

Se un controllo dice `KO`, **la migrazione del segno non va applicata in produzione**: l'uscita va in LAVAGNA.

Eseguito il 13/11/2026 su un Postgres 16 locale usa-e-getta con tutte le 89 migrazioni (`pg-prova.sh`): tutte le righe `ok`, compreso il controllo `EXPLAIN (ANALYZE, BUFFERS)` (nessun `Seq Scan`/`Index Scan` su `whatsapp_messages`, solo `Buffers: shared hit=129`).

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

## `eco-entrata.sql` (commessa 2026-10-30-eco-manychat-entrata, l'eco non resta sul contatto)

Serve un database di prova con tutte le migrazioni di prima applicate in ordine (`p8_controllo_notte` per `wa_segna_eco_doppioni`, `p1-chat-veloce` per `ultimo_messaggio_*`, `ponte_tutte_le_chat` per `promosso_il`). La migrazione nuova, `20261030230000_eco_entrata_contatti.sql`, la applica lo script stesso, **due volte**. Dalla radice del repo:

```sh
psql "$DB" -f prove/sql/eco-entrata.sql
```

Gira in una transazione che finisce con `ROLLBACK`; ogni controllo stampa `ok  <nome>`, al primo sbagliato si ferma con `KO <nome>: atteso …, avuto …`. Uscita attesa: 9 `ok` e in fondo `FINE: tutti i controlli ok (ROLLBACK)`.

Cosa prova: la sequenza vera del 28/10 (uscite dal telefono, ognuna seguita 2-21 secondi dopo dall'eco del vecchio testo, con la rotta che scrive il contatto): il contatto è sporco (entrata = eco, ultimo messaggio = eco, 5 non letti); la pulizia della notte segna 4 eco; a fine transazione l'ultima entrata torna a quella vera, l'ultimo messaggio al nostro delle 17:59:56, `last_message_at` non è più l'ora dell'eco, i non letti scendono a 1; un'entrata vera arrivata dopo l'eco non si tocca; la funzione su una riga non segnata non fa niente; `anon`/`authenticated` senza `EXECUTE`.

Dentro la transazione il riallineo (trigger differito) si forza con `SET CONSTRAINTS trg_wa_eco_segnata IMMEDIATE`, come farebbe il `COMMIT`.

Eseguito il 30/10/2026 su un Postgres 16 locale usa-e-getta con tutte le migrazioni (estensioni e `storage` finti): 9 `ok`.

## `ponte-revoche.sql` (commessa 2026-10-31, ponte-revoche: un messaggio nostro eliminato dal telefono sparisce dalla chat)

Serve un database di prova con **tutte** le migrazioni applicate in ordine (la migrazione nuova, `20261031090000_ponte_revoche.sql`, la riapplica lo script, due volte). Lo stesso comando di `ponte-immagini.sql`, con `prove/sql/ponte-revoche.sql`. Gira in una transazione che finisce con `ROLLBACK`. Uscita attesa: 28 `ok` (più `migrazioni ok=N ko=0` dello script) e in fondo `TUTTI I CONTROLLI DELLE REVOCHE PASSANO`.

Cosa prova: `ponte_wa_revoca` marca eliminata la riga del ponte con la chiave `bw:` **solo se è una nostra uscita** (una riga in entrata con quella chiave resta intatta; l'eco in entrata che punta a una nostra uscita non si marca) e il suo pari ManyChat/CRM nei due versi di `duplicato_di`; non cancella niente (stesso numero di righe); una riga già marcata non si ritocca (seconda volta: trovate 2, marcate 0); `cambiato_il` delle righe marcate si muove (realtime e lettura a pezzi); l'anteprima del contatto, `last_message_at` e `risposto_il` tornano all'ultimo messaggio / all'ultima uscita rimasti **solo se erano proprio il messaggio eliminato** (un «Fatto» a mano e un'anteprima più recente non si toccano; senza messaggi rimasti l'anteprima si svuota); numeri con e senza «+»; un altro utente con la stessa chiave non è toccato; chiave inesistente = 0 e 0; chiavi o parametri storti → errore 22023; `anon`/`authenticated` senza `EXECUTE`, SECURITY DEFINER con `search_path` fisso.

Eseguito il 31/10/2026 su un Postgres 16 usa-e-getta con tutte le 81 migrazioni: `migrazioni ok=81 ko=0`, 28 `ok`.

## `ecommerce-ordini.sql` (commessa 2026-11-17-crm-ecommerce, T2: M1 e M2 degli ordini)

Serve un database **usa-e-getta il cui nome contiene «prova»** (lo script si ferma da solo se non è così): non si lancia mai sul database di produzione. Può essere vuoto: lo script crea i ruoli finti `anon`/`authenticated`, `auth.role()` finto, la tabella `shop_orders` com'è oggi (migrazione `20260722160000`), poi applica `20261117120000_ecommerce_ordini.sql` (M1) **due volte** e `supabase/ORDINI-SOLO-SERVER.sql` (M2) **due volte**. Dalla radice del repo (con Postgres 16 locale; nome socket breve, e `LC_ALL=C` se il locale dà noie):

```sh
createdb prova_ordini
psql prova_ordini -v ON_ERROR_STOP=1 -f prove/sql/ecommerce-ordini.sql
```

Non c'è `ROLLBACK`: M1 e M2 hanno il loro `BEGIN/COMMIT`, quindi il database resta modificato e si butta (`dropdb prova_ordini`). Ogni controllo stampa `ok  <nome>`; al primo sbagliato si ferma con `KO <nome>: atteso …, avuto …`. Uscita attesa: 44 `ok` e in fondo `TUTTI I CONTROLLI DI M1 E M2 PASSANO`.

Cosa prova: una riga «vecchia» di prima di M1 resta intatta (colonne nuove vuote, `senza_lead` false) e le righe non cambiano di numero; dopo la doppia applicazione le policy di `shop_orders` sono tre (la larga «anyone can insert shop order» è sparita, `shop_orders_insert_checkout` c'è una volta); `shop_order_eventi` ha la protezione per riga accesa e nessuna policy. L'**anonimo**: la riga del checkout (senza `created_at`) passa, anche con `senza_lead=false` o `created_at=now()`; lo stesso `id` due volte dà `23505`; **rifiutati (42501)** `pagato_il`, `pagato_importo`, `metodo_pagamento`, `lead_id`, `senza_lead=true`, `tracking`, `note_interne`, `aggiornato_il`, stato `pagato`/`spedito`, `created_at` di ieri, di 11 minuti fa, tra un'ora, tra 2 minuti; non legge, non modifica, non cancella (0 righe); non vede né scrive il registro eventi. **authenticated** dopo M1: legge e aggiorna ancora (M1 non tocca le sue policy), ma non inserisce un ordine già pagato e non vede il registro eventi; il proprietario del database (il server) lo scrive. **Dopo M2**: resta una sola policy (l'inserimento), authenticated non legge né aggiorna più, l'anonimo inserisce ancora, nessun dato toccato.

## `shop-catalogo.sql` (commessa 2026-11-20-shop-completo, T02: S1, il catalogo dello shop)

Serve un database **usa-e-getta il cui nome contiene «prova»** (lo script si ferma da solo se non è così): non si lancia mai sul database di produzione. Serve un utente **superutente** di quel database (crea ruoli ed estensione `dblink`) e un Postgres 15 o 16 normale con `dblink` (Homebrew e i pacchetti ufficiali ce l'hanno; non serve `supabase start`). Il database può essere vuoto: lo script crea i ruoli finti `anon`/`authenticated`/`service_role`, uno schema `storage` finto (solo `buckets` e `objects`), imita i privilegi larghi che Supabase dà di default agli oggetti nuovi di `public` (è ciò che i `REVOKE` di S1 devono annullare), poi applica `supabase/migrations/20261120120000_shop_catalogo.sql` **due volte** (e una terza dopo aver cambiato un interruttore). Dalla radice del repo:

```sh
createdb prova_shop
psql -q prova_shop -v ON_ERROR_STOP=1 -f prove/sql/shop-catalogo.sql
dropdb prova_shop
```

Se `dblink` non riesce a collegarsi (nessuna socket locale, Postgres solo su TCP), passa la stringa a mano: `-v conn='dbname=prova_shop host=127.0.0.1 port=5432 user=postgres'`. Con `-v s1=<file>` si prova un'altra copia della migrazione (serve a verificare che le prove si accorgano di un guasto). Non c'è `ROLLBACK`: due sessioni vere vedono solo ciò che l'altra ha confermato, quindi il database resta modificato e si butta. Ogni controllo stampa `ok  <nome>`; al primo sbagliato si ferma con `KO <nome>: atteso …, avuto …` (uscita di `psql` diversa da 0). Uscita attesa: 71 `ok` e in fondo `TUTTI I CONTROLLI DI S1 PASSANO`.

Cosa prova:

- **Rilancio:** S1 due volte senza errori; una tabella che esisteva (finta `shop_orders`) resta intatta; un interruttore già cambiato e un bucket `shop-media` già presente (con altri valori) **non** vengono riscritti; senza bucket, S1 lo crea (pubblico, 25 MB, sei tipi).
- **Chiusura:** protezione per riga accesa sulle otto tabelle e **nessuna policy** (nemmeno su `storage.objects`); `anon` e `authenticated` non leggono né scrivono nessuna tabella, **nessuna delle quattro viste** (errore `42501`, anche quando le viste hanno righe) e non eseguono le quattro funzioni; `service_role` sì.
- **Giacenza:** mai sotto zero (`giacenza_negativa`), il movimento nasce nella stessa operazione (con motivo sbagliato non resta niente a metà), `shop_giacenza_imposta` calcola il delta sotto blocco, e **due sessioni vere** insieme: con 1 pezzo la seconda **aspetta** e poi riceve `giacenza_negativa` (giacenza 0, un solo movimento); con 2 pezzi riescono entrambe (due movimenti, somma -2).
- **Registri:** `service_role` su movimenti di giacenza e storico ha solo SELECT e INSERT; UPDATE, DELETE e TRUNCATE sono rifiutati (42501): «nessuna cancellazione» la garantisce il database.
- **Pubblicazione (trigger):** senza descrizione breve, categoria, foto principale con alt (non rimossa, e con liberatoria se ritrae persone) o variante attiva con SKU e prezzo effettivo > 0 il prodotto **non passa a pubblicato**, né in aggiornamento né se nasce già pubblicato; prezzo prodotto 0 con variante vuota no; prodotto > 0 con variante vuota sì; prodotto 0 con variante > 0 sì; un prodotto già pubblicato si salva anche se nel frattempo non sarebbe più pubblicabile.
- **Viste:** esce solo il pubblicato; la **foto di una bozza** (e quella di un archiviato) non esce, né come riga né come percorso; non escono foto rimosse o di persone senza liberatoria; le foto di una categoria escono solo se la categoria è visibile e ha un pubblicato; la variante di una bozza non esce; mai la giacenza (c'è solo `disponibile`), mai `bozza_modifiche`, note, fornitore, canali, origine; le caratteristiche «da confermare» non escono; il correlato in bozza non esce.
- **Interruttori:** `shop_impostazione_imposta` con valore atteso sbagliato, uguale, vuoto o chiave inesistente non scrive; col valore giusto scrive e lascia **una** riga di storico (prima, dopo, chi).

Cosa non prova: le trasformazioni di immagine o i limiti veri del bucket (qui `storage` è finto: lo schema vero lo mette Supabase), `pg_policies` su `storage.objects` di un Supabase vero (la query di controllo è nell'intestazione della migrazione), e le viste lette tramite PostgREST (qui con `SET ROLE`).

Se un controllo dice `KO`, **S1 non va applicata in produzione**: l'uscita va in LAVAGNA.

### Per chi applica S1 (il titolare)

1. **Prima:** Supabase → Storage: controlla se esiste già un bucket `shop-media`. Se c'è, S1 **non lo cambia**: verifica tu che sia pubblico, con limite 25 MB e solo jpeg/png/webp/avif/mp4/quicktime.
   Controlla anche, in sola lettura: `SELECT policyname, cmd, roles, qual, with_check FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';` (la stessa query è nell'intestazione della migrazione). Di solito non ci sono righe; se ce n'è una che vale per TUTTI i bucket (nessun `bucket_id` nel `qual` o nel `with_check`) per `public`/`anon`, fermati e avvisa la squadra.
2. **Applica** il file nel SQL Editor (si può rilanciare senza danni). **Dopo**, in sola lettura: `SELECT chiave, valore FROM public.shop_impostazioni;` deve dire `catalogo_sito = "codice"` e `giacenza_bassa = 3`. Lo shop **non cambia**: il sito continua a usare il catalogo del codice.
3. **Come si ritira una foto** (liberatoria revocata, richiesta di cancellazione di una persona ritratta): «Rimuovi» dal pannello toglie la foto dal sito ma **il file resta nello Storage**, e il bucket è pubblico: chi ha l'indirizzo la vede ancora. Quindi: Supabase → Storage → `shop-media` → cerca i **tre** file della foto (480, 960, 1600: i percorsi sono nella scheda del prodotto) → elimina; poi, nel pannello, togli la spunta «liberatoria». L'originale non si conserva: non c'è altro da cancellare.
