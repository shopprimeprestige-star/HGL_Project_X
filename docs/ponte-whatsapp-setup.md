# Ponte WhatsApp · le chat dell'app WhatsApp Business nel CRM · guida passo passo

Cosa fa: un piccolo programma sul tuo Mac (il «ponte») si collega al tuo numero come un dispositivo in più, tipo WhatsApp Web, e porta le chat nel CRM con l'orario vero di ogni messaggio. Sono in **Chat** insieme a quelle di ManyChat: quello che scrivi dall'app del telefono compare nel CRM entro pochi secondi, e così quello che scrivono i clienti. All'inizio arriva anche lo storico (solo dei numeri che il CRM conosce già).

Il ponte **non scrive mai** a nessuno e non manda «letto»: legge e basta. Le righe che porta sono **solo da vedere**: non cambiano «Da rispondere», i messaggi non letti, il giro automatico né le liste «Attesa WhatsApp» e «Da chiamare».

Tempo: circa 45 minuti la prima volta, più il collaudo.

## In cima: come si ferma e come si annulla

**Fermare subito il ponte** (il modo più veloce e più sicuro):
sul telefono, **WhatsApp Business → Impostazioni → Dispositivi collegati**, tocca il dispositivo del ponte (si chiama «Mac OS») e scegli **Scollega**. Da quel momento il ponte non legge più niente. Il CRM e ManyChat non cambiano.

**Fermare il programma sul Mac, senza scollegarlo:**

```bash
launchctl bootout gui/$(id -u)/it.hgl.ponte-whatsapp
```

Resta fermo finché non esci e rientri nel Mac (poi riparte da solo). Per riavviarlo subito: `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/it.hgl.ponte-whatsapp.plist`.

**Fermarlo dal lato CRM:** `npx wrangler secret delete PONTE_WA_TOKEN`. Il CRM smette di accettare i messaggi del ponte (risponde «non configurato») e il ponte aspetta senza perdere niente.

**Disinstallare dal Mac:** dalla cartella `strumenti/ponte-whatsapp` del repo:

```bash
./disinstalla.sh            # toglie il servizio e la copia del codice; tiene la sessione, la chiave e la fila
./disinstalla.sh --tutto    # in più cancella sessione, chiave, fila (con i testi dei clienti) e log; chiede di scrivere CANCELLA
```

Poi togli comunque il dispositivo dal telefono (come sopra): il disinstallatore non lo fa.

**Annullare nel database:** la migrazione ha in cima, nei commenti, la sezione «COME SI ANNULLA» (`supabase/migrations/20261029120000_ponte_whatsapp.sql`). Cancella le righe portate dal ponte e le tre funzioni. Non serve quasi mai: le righe del ponte sono solo da vedere. Un'unica cosa non torna indietro: se hai risposto dal telefono a una chat, quella chat è già uscita da «Da rispondere» (effetto lieve).

## Prima di cominciare: cose da sapere

**Il rischio.** Baileys, la libreria che usa il ponte, **non è ufficiale**: WhatsApp potrebbe non gradire un dispositivo così e **bloccare il numero**. Se succede, si ferma anche ManyChat e quindi tutto il giro automatico. Hai già detto che il rischio lo accetti; tienilo presente, e se il ponte non ti serve più, scollegalo. La versione usata (7.0.0-rc14) è ancora «candidata al rilascio»: se WhatsApp cambia qualcosa, il ponte può smettere di funzionare da un giorno all'altro. Il CRM resta com'è e ti avvisa (vedi «Cosa vedi nel CRM»).

**Non è verificato** che aggiungere questo dispositivo lasci a ManyChat la ricezione e l'invio come prima (numero in «coesistenza» con l'app Business). Lo controlli tu nel collaudo, entro 10 minuti dal primo collegamento: se uno dei due non funziona, scolleghi subito il dispositivo dal telefono.

**Il Mac deve restare acceso e sveglio.** Il ponte è un programma sempre in funzione: se il Mac dorme o si spegne, i messaggi non arrivano nel CRM (WhatsApp li riconsegna al risveglio, ma non per sempre).

- **Sospensione.** Su questo Mac `pmset -g custom` oggi dice `sleep 1` (si addormenta dopo 1 minuto senza attività), sia a batteria sia con l'alimentatore. Il ponte parte con `caffeinate -i` per impedirlo, ma **a coperchio chiuso `caffeinate` non basta**: un portatile con il coperchio chiuso si addormenta comunque, a meno che sia collegato all'alimentatore **e** a uno schermo esterno. Quindi: **lascia il coperchio aperto** (puoi abbassare la luminosità), oppure usa un Mac fisso.
- **Alimentatore.** Tienilo sempre in carica. Per non farlo dormire con l'alimentatore collegato (serve la password dell'amministratore, decidi tu se farlo):
  ```bash
  sudo pmset -c sleep 0
  ```
  E perché riparta da solo dopo un'interruzione di corrente:
  ```bash
  sudo pmset -a autorestart 1
  ```
- **Dopo un riavvio serve il tuo accesso.** Il ponte è un servizio che parte **solo con il tuo utente collegato** (non è un servizio di sistema). Se il Mac si riavvia con **FileVault** acceso, resta fermo sulla schermata di accesso finché non inserisci la password: **il ponte non parte** finché non fai il login. Anche se esci dall'utente (logout) il ponte si ferma. Il CRM te lo segnala dopo qualche minuto.
- **Una cartella a parte.** I dati del ponte stanno in `~/Library/Application Support/HGL/ponte-wa/`, **fuori dal repo**: la sessione di WhatsApp (`auth/`), la chiave (`config.env`), la coda dei messaggi da mandare (`fila/`). Chi entra in quella cartella legge le chat: tienila solo tua (il programma la crea già con i permessi giusti). Il log è in `~/Library/Logs/hgl-ponte-wa.log` e contiene solo codici e numeri, mai testi, nomi o numeri di telefono.
- **Node.** Serve **Node 22 o 24** (le versioni LTS). Il Node 25, che c'è su questo Mac, **non va**. Installa il 24 accanto al tuo, senza sostituirlo:
  ```bash
  brew install node@24
  ```
  Poi `installa.sh` lo trova da solo in `/opt/homebrew/opt/node@24`. Non fare `brew link`.

## Passo 1 · La migrazione del database

La migrazione `supabase/migrations/20261029120000_ponte_whatsapp.sql` **da sola non cambia niente di visibile**: aggiunge una colonna per i doppioni, una per riconoscere i contatti creati dal ponte, la tabella dello stato del ponte e tre funzioni che solo il server può chiamare. La squadra l'ha provata su un database di prova, **non sul tuo**: la applichi tu, dopo averla letta.

1. Apri il file in un editor e leggi i commenti in cima.
2. Vai su **Supabase → il tuo progetto → SQL Editor → New query**.
3. Incolla **tutto** il contenuto del file e premi **Run**. Deve finire senza errori in rosso.
4. Se vedi un errore, **non rilanciare a caso**: copialo e dallo a chi ti assiste. Applicarla due volte non fa danni.
5. Prima di lei devono essere già applicate le migrazioni della chat e di ManyChat (`…chat_whatsapp_crm` e `…manychat_base`): lo sono, se la chat funziona oggi.

⚠️ Non rilanciare mai `manychat_giro` né `manychat_cron` dopo che lo storico del ponte è entrato: hanno un passaggio che leggerebbe i messaggi vecchi.

## Passo 2 · Pubblicare il CRM

Come sempre, con `npm run pubblica` (mai `wrangler deploy`: vedi `DEPLOY.md`). Il CRM funziona anche prima di questo passo e anche senza ponte.

Se pubblichi **prima** del Passo 1, nessun danno: la chat resta com'era e l'ingresso del ponte risponde «errore database» finché la migrazione non c'è.

## Passo 3 · La chiave segreta del ponte

La chiave `PONTE_WA_TOKEN` è la «parola d'ordine» fra il Mac e il CRM. Servono **almeno 32 caratteri**. La metti **tu**, due volte (nel CRM e sul Mac), e non la scrivi mai in una chat, in un'email o nel codice.

1. Genera la chiave e mettila negli appunti, **senza vederla**:
   ```bash
   openssl rand -hex 32 | pbcopy
   ```
2. Dalla cartella del repo, nei segreti del Worker `hair-genius`:
   ```bash
   npx wrangler secret put PONTE_WA_TOKEN
   ```
   Quando lo chiede, **incolla** (⌘V) e premi Invio.
3. Sul Mac, con gli appunti ancora pieni, `installa.sh` te la chiederà al Passo 4 (o con `./installa.sh chiave`). Dopo, svuota gli appunti: `pbcopy < /dev/null`.

Cambiare la chiave (se sospetti che sia uscita): rifai i punti 1-2, poi `./installa.sh chiave`, poi `launchctl kickstart -k gui/$(id -u)/it.hgl.ponte-whatsapp`. Fra un passaggio e l'altro il ponte riceve «chiave rifiutata» e aspetta: non perde messaggi.

## Passo 4 · Installare il ponte sul Mac

Dalla cartella `strumenti/ponte-whatsapp` del repo:

```bash
./installa.sh
```

Cosa fa: cerca un Node 22 o 24, copia il codice in `~/Library/Application Support/HGL/ponte-wa/app`, installa le dipendenze **esatte** del file `package-lock.json` (con `npm ci --ignore-scripts`), poi chiede due cose:

- l'**indirizzo** della rotta del CRM: `https://<il-dominio-del-tuo-CRM>/api/public/ponte-whatsapp` (deve cominciare con `https://`);
- la **chiave**: incolla dagli appunti. Mentre incolli non si vede nulla; è normale. Se è più corta di 32 caratteri lo script la rifiuta.

Scrive `config.env` (solo tuo) e il servizio. **Non lo avvia**: lo avvii tu al Passo 5-6 (se prima esci e rientri nel Mac, parte da solo al login). Se manca il Node giusto si ferma prima di scrivere qualsiasi cosa e ti dice di fare `brew install node@24`.

I comandi di `installa.sh`:

| Comando | Cosa fa |
|---|---|
| `./installa.sh` (o `installa`) | installa o aggiorna il ponte; non tocca la sessione, la fila né `config.env` |
| `./installa.sh stato` | dice se il servizio è avviato, mostra l'ultimo stato e le ultime righe del log |
| `./installa.sh chiave` | riscrive indirizzo e chiave in `config.env` |
| `./installa.sh scollega` | ferma il ponte, mette da parte la sessione e lo riavvia: compare un codice nuovo; chiede di scrivere SCOLLEGA |

Con `scollega` togli anche il vecchio «Mac OS» dal telefono (Dispositivi collegati).

## Passo 5 · La prima prova, senza mandare niente al CRM

`installa.sh` alla fine stampa il comando preciso (con il percorso del Node trovato). È di questa forma:

```bash
cd ~/Library/Application\ Support/HGL/ponte-wa/app
<il node stampato da installa.sh> src/index.mjs --senza-invio
```

Compare un **codice da inquadrare** (anche nel terminale). Si apre da solo anche la figura `qr.png` in Anteprima e arriva una notifica del Mac:

1. Sul telefono: **WhatsApp Business → Impostazioni → Dispositivi collegati → Collega un dispositivo**.
2. Inquadra il codice. Si rinnova ogni 20 secondi circa: se scade, inquadra quello nuovo (l'Anteprima si aggiorna da sola; il file è `~/Library/Application Support/HGL/ponte-wa/qr.png`).
3. Se la notifica non appare, la prima volta macOS può chiederti il permesso: **Impostazioni di Sistema → Notifiche**.
4. Nel terminale compaiono i conteggi: `[senza invio] messaggi letti …, validi …, chat …`. Aspetta che lo storico arrivi (la percentuale sale) e **confronta il numero di chat con quelle del telefono**. WhatsApp decide quanto storico mandare alla prima associazione: può essere meno di quello che vedi sul telefono.
5. Chiudi con **Ctrl-C**.

In questa prova **non parte niente verso il CRM**: i messaggi letti restano in coda sul Mac (`fila/`) e partono quando avvii il ponte per davvero. Non lasciarla aperta per ore.

## Passo 6 · Avvio vero

```bash
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/it.hgl.ponte-whatsapp.plist
```

Il ponte ora resta acceso e riparte da solo se si ferma per un errore. Lo storico arriva a piccoli lotti, piano (circa uno ogni 3 secondi): per una grande quantità di chat ci vuole del tempo. **Meglio farlo la sera** o a CRM chiuso. Controlla con:

```bash
./installa.sh stato
```

⚠️ **Se cambi la configurazione e il ponte non è ripartito, riavvialo a mano:**

```bash
launchctl kickstart -k gui/$(id -u)/it.hgl.ponte-whatsapp
```

Motivo: se manca il Node giusto o `config.env` è sbagliato, il ponte ti avvisa con una notifica ed esce **senza errore**, e il servizio apposta non lo rilancia in continuazione (altrimenti la notifica ti arriverebbe ogni 30 secondi). Dopo aver sistemato la cosa serve questo comando, che lo riavvia anche se è già in funzione. Vale anche dopo ogni `./installa.sh` che aggiorna il codice o `./installa.sh chiave`.

## Cosa vedi nel CRM

In **Chat**, in cima, compare una fascia **solo se qualcosa non va**: «il ponte non risponde da N minuti» (Mac spento, addormentato o ponte fermo), «WhatsApp ha scollegato il ponte» (c'è un codice nuovo da inquadrare sul Mac), «lo storico è ancora in arrivo (62%)». Se non vedi niente, va tutto bene. L'avviso lo vede solo chi apre la Chat: non arriva una notifica sul telefono.

## Collaudo (10 controlli, nell'ordine)

Il numero 5 è il più importante.

1. **Passo 1-4 fatti** e il Passo 5 (prova senza invio) con i conteggi simili al telefono.
2. **Coesistenza con ManyChat (entro 10 minuti dal primo collegamento).** Da **un altro telefono** scrivi al numero: il messaggio deve arrivare in ManyChat/CRM come sempre. Poi **manda un messaggio dal CRM** a quel telefono: deve partire. Se uno dei due non funziona: **scollega subito il dispositivo dal telefono** (vedi «In cima») e dillo a chi ti assiste.
3. **Avvio vero** (Passo 6) e guarda **Chat** nel CRM mentre lo storico arriva.
4. **Orari.** Prendi 5 messaggi vecchi a caso: ora e giorno nel CRM devono essere uguali a quelli del telefono.
5. **Doppioni.** Da un altro telefono scrivi al numero; rispondi dal CRM; rispondi anche dall'app Business. Ogni messaggio deve comparire **una volta sola**, e la chat esce da «Da rispondere» quando rispondi dall'app.
6. **Il giro.** Guarda «Attesa WhatsApp» e «Da chiamare»: devono essere come il giorno prima. Lo storico vecchio non deve farti credere che un cliente abbia appena risposto.
7. **Caduta della rete.** Spegni il Wi-Fi del Mac per 5 minuti: nel CRM compare l'avviso, e alla riaccensione sparisce da solo.
8. **Scollegamento.** Scollega il dispositivo dal telefono: nel CRM compare l'avviso e sul Mac si apre un codice nuovo.
9. **Riavvio del Mac.** Riavvia, fai il login: il ponte deve ripartire da solo (con FileVault, solo dopo il login).
10. **Una settimana dopo:** conta i messaggi dei clienti che compaiono nella chat ma non sono in «Da rispondere» (quelli che ManyChat non porta). Sono «solo da vedere» in questa versione; se sono tanti si può cambiare.

## Quando qualcosa non va

| Cosa vedi | Cosa fare |
|---|---|
| Notifica «Il ponte WhatsApp non parte: serve Node 22 o 24» | `brew install node@24`, `./installa.sh`, poi `launchctl kickstart -k gui/$(id -u)/it.hgl.ponte-whatsapp` |
| Notifica «manca o è sbagliato config.env» | `./installa.sh chiave`, poi il `kickstart` qui sopra |
| Avviso «il ponte non risponde da N minuti» | il Mac dorme, è spento o ha il login non fatto; `./installa.sh stato` |
| Nel CRM «WhatsApp ha scollegato il ponte» | inquadra il codice nuovo sul Mac (`qr.png`); se non compare, `./installa.sh scollega` |
| Messaggi del telefono che non arrivano | `./installa.sh stato`: se parla di chiave o di database, controlla il Passo 1 e il Passo 3 |
| «Il ponte è stato aperto da un'altra parte» | c'è un'altra copia del ponte attiva (per esempio la prova del Passo 5 ancora aperta): chiudila |

Il log: `tail -n 50 ~/Library/Logs/hgl-ponte-wa.log`. Righe tipo `battito_collegato` sono normali.

## Cosa non fa (per ora)

- Non scarica foto, vocali o allegati: compare un segnaposto («📷 Foto», «🎤 Vocale»).
- Non segue le modifiche e le cancellazioni: un messaggio modificato o cancellato per tutti resta com'era nel CRM.
- Importa solo i numeri che il CRM conosce già. Un cliente nuovo entra dopo che ManyChat gli ha creato il contatto (entro circa 10 minuti).
- Non mette il codice da inquadrare nel CRM: sta solo sul Mac.
- Un messaggio del cliente che ManyChat non porta si vede nella chat ma non conta come «da rispondere». E un messaggio «STOP» arrivato solo al telefono non ferma il giro: è come prima.

## Controllo delle dipendenze (npm audit)

Eseguito il 29/10/2026 sul `package-lock.json` del ponte (`npm audit --package-lock-only`): **0 vulnerabilità** su 124 pacchetti (94 usati, 27 facoltativi, 31 «peer»). Il pacchetto è `@whiskeysockets/baileys` alla versione esatta `7.0.0-rc14`; nel file non c'è nessun pacchetto omonimo chiamato solo «baileys». Si installa con `npm ci --ignore-scripts`: due pacchetti (Baileys stesso e `protobufjs`) hanno uno script di installazione e **non viene eseguito**. Ripeti il controllo prima di ogni aggiornamento.
