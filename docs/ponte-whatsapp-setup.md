# Ponte WhatsApp · le chat dell'app WhatsApp Business nel CRM · guida passo passo

Cosa fa: un piccolo programma sul tuo Mac (il «ponte») si collega al tuo numero come un dispositivo in più, tipo WhatsApp Web, e porta le chat nel CRM con l'orario vero di ogni messaggio. Sono in **Chat** insieme a quelle di ManyChat: quello che scrivi dall'app del telefono compare nel CRM entro pochi secondi, e così quello che scrivono i clienti. All'inizio arriva anche lo storico. **Entrano tutte le chat individuali, anche dei numeri che il CRM non conosce** (dal 30/10/2026): nascono come «Sconosciuto», col numero al posto del nome. Restano fuori solo gruppi, stati, broadcast e newsletter.

Il ponte **non manda «letto»** e, di serie, **non scrive a nessuno**: legge e basta. Solo se lo accendi tu (sezione «Rispondere dopo le 24 ore», più sotto) può mandare, a mano e uno alla volta, un messaggio a chi ti ha già scritto. Lo **storico** è solo da vedere: non cambia «Da rispondere», i messaggi non letti, il giro automatico né le liste «Attesa WhatsApp» e «Da chiamare». Un messaggio **nuovo** che ManyChat non porta (arrivato solo sull'app) conta invece come non letto e come «Da rispondere» dopo circa 2 minuti, senza doppio conteggio se ManyChat lo porta poco dopo. Il giro automatico, i promemoria e le regole che scrivono ai clienti **non cambiano**: uno sconosciuto non riceve mai niente in automatico.

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

**Annullare nel database:** la migrazione ha in cima, nei commenti, la sezione «COME SI ANNULLA» (`supabase/migrations/20261029120000_ponte_whatsapp.sql`). Cancella le righe portate dal ponte e le tre funzioni. Non serve quasi mai: lo storico del ponte è solo da vedere. Due cose non tornano indietro: se hai risposto dal telefono a una chat, quella chat è già uscita da «Da rispondere» (effetto lieve); e i non letti già portati avanti dalle entrate nuove promosse dal ponte (dal 30/10) restano al loro posto.

**Annullare «tutte le chat»:** `supabase/migrations/20261030160000_ponte_tutte_le_chat.sql` ha la sua sezione «COME SI ANNULLA»; i passi della messa in opera sono in `commesse/2026-10-30-ponte-tutte-le-chat/PASSI-TITOLARE.md`.

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

(Dal 30/10/2026 c'è anche `20261030160000_ponte_tutte_le_chat.sql`, che si applica **dopo** questa: vedi «Tutte le chat» più sotto.)

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
4. Nel terminale compaiono i conteggi: `[senza invio] messaggi letti …, validi …, chat …`. Aspetta che lo storico arrivi (la percentuale sale) e **confronta il numero di chat con quelle del telefono**. WhatsApp decide quanto storico mandare alla prima associazione: può essere meno di quello che vedi sul telefono. Per riaverlo dopo, vedi «Riavere tutto lo storico (ricollegare)».
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

## Rispondere dopo le 24 ore (scrivere dal telefono)

Passate le 24 ore, in una chat compare accanto a «Invia un modello» il tasto **Scrivi dal telefono**: scrivi un testo libero e parte dal tuo numero WhatsApp Business, senza modello e senza il costo del modello. Entro le 24 ore non cambia niente: il testo libero parte come sempre.

**Quando compare il tasto** (tutte insieme): il ponte è collegato e ha battuto negli ultimi 3 minuti; sul Mac hai acceso gli invii; il cliente ci ha già scritto almeno una volta; il cliente non ha chiesto STOP.

**Limiti, contro il rischio di blocco del numero:** solo testo (niente foto), al massimo 2000 caratteri, un messaggio alla volta, **1 ogni 20 secondi**, **20 ogni 24 ore** in tutto. Un messaggio che non è partito entro **10 minuti** non parte più (compare «Non inviato» con «Riprova»). Il giro automatico, i promemoria e «Da rispondere» non usano mai questa strada.

**Attesa:** il Mac guarda la coda a ogni controllo del ponte (circa un minuto) e poi ogni pochi secondi. Un messaggio parte quindi dopo circa un minuto, a volte meno. Nella chat vedi «In invio dal telefono…», poi la spunta.

**Rischio:** WhatsApp può bloccare un numero che manda messaggi da un dispositivo non ufficiale. Un blocco ferma anche ManyChat. Per questo è spento di serie e va acceso apposta.

**Come si accende:** nel file `config.env` del ponte (sul Mac) aggiungi la riga `INVII_ATTIVI=1` e riavvia il ponte.
**Come si spegne subito:** togli la riga `INVII_ATTIVI=1` e riavvia il ponte (il tasto sparisce dal CRM entro 3 minuti); oppure scollega «Mac OS» da Dispositivi collegati.
**Come si annulla nel database:** i `DROP` nel commento in cima a `supabase/migrations/20261030120000_ponte_invio_manuale.sql`.

I passi per applicare la migrazione, aggiornare il ponte e fare il collaudo sono in `commesse/2026-10-30-ponte-invio-manuale/PASSI-TITOLARE.md`.

## Tutte le chat, anche gli sconosciuti (dal 30/10/2026)

Decisione del titolare: ogni chat individuale di WhatsApp Business entra nel CRM, anche dei numeri che il CRM non conosce. Dal 30/10 il CRM non scarta più nessun numero (prima valeva «solo i numeri del CRM»): storico e messaggi nuovi, in entrata e in uscita, nascono come contatto senza scheda («Sconosciuto»). In **Tutte** si vedono, in **Sconosciuti** stanno da soli, in **Non letti** ci sono con gli altri. Il Mac non cambia in questo: la cache cifrata dei numeri tenuti da parte si svuota da sola al primo controllo dopo la pubblicazione.

Come si aggiorna, in ordine: migrazione `20261030160000_ponte_tutte_le_chat.sql` (SQL Editor, come al Passo 1), pubblicazione del CRM (Passo 2), `./installa.sh` + `launchctl kickstart -k gui/$(id -u)/it.hgl.ponte-whatsapp` sul Mac, prova con un numero sconosciuto. Il testo completo, con i controlli, è in `commesse/2026-10-30-ponte-tutte-le-chat/PASSI-TITOLARE.md`.

I messaggi già nella cache del Mac e quelli arrivati durante un ricollegamento entrano **come storico**: ci sono nella chat con la data vera, ma non fanno non letti né «Da rispondere».

## Riavere tutto lo storico (ricollegare)

WhatsApp manda lo storico al Mac **solo quando si collega un dispositivo nuovo**. Per riaverlo si ricollega il Mac con un codice QR nuovo, **una volta, la sera**: il telefono rimanda lo storico e il ponte lo porta nel CRM con le funzioni di oggi (nessun doppione: la chiave `bw:<cifre>:<id>` è unica). Non si costruisce niente di nuovo: è una riga di `config.env`, un ricollegamento e dei controlli. **Non ricollegare più di una volta al giorno.** Il testo per il titolare, con le condizioni passo per passo, è `PASSI-TITOLARE.md` (Parte A) della commessa `2026-10-30-ponte-storico-completo`.

**Un'ipotesi, non una prova:** il README di Baileys dice che il collegamento «Desktop» riceve più storico di quello «Chrome» (di serie). Il 29/10 il ponte era «Chrome» e non registrava il tipo di storico ricevuto, quindi non sappiamo se il telefono avesse già mandato tutto. Il log dice l'esito (punto 4).

### Prima del codice QR (tutte, nell'ordine)

1. Il ponte del ramo con `IDENTITA` è sul Mac (`./installa.sh`).
2. È sera, Mac acceso, **in carica, coperchio aperto**, nessun follow-up da fare ai clienti fino a domani.
3. Nel SQL Editor: `select count(*) from public.whatsapp_contacts;`. Se è **oltre 3000, fermati**: il CRM legge al massimo 5000 contatti (5 pagine da 1000) e oltre taglia. Annota anche «Non letti» e il numeretto di «Da rispondere».
4. Lancia e **salva** le tre misure dei doppioni e le due SELECT sulla chat di un numero (qui sotto): è il «prima». Sono pesanti: una volta sola prima e una dopo, fuori orario; se si fermano per il tempo massimo, metti in testa `set statement_timeout = '120s';` o fai un numero alla volta.
5. **Il telefono suona**: da un altro telefono scrivi al numero; il tuo telefono deve suonare. È la base di «normale».
6. In `~/Library/Application Support/HGL/ponte-wa/config.env` (permessi 600): cambia la riga `INVII_ATTIVI=1` in `INVII_ATTIVI=0` (non aggiungerne una seconda: vale l'ultima, ma poi il «rimetti 1» sbaglia). Se c'è già una riga `IDENTITA`, cambiala in `IDENTITA=Desktop`; se non c'è, aggiungila. Gli invii a mano dal CRM restano fermi fino ai controlli: un dispositivo appena collegato che scarica lo storico e intanto manda messaggi è il comportamento peggiore agli occhi di WhatsApp.

### I passi

1. Nella cartella `strumenti/ponte-whatsapp`: `./installa.sh scollega`, scrivi `SCOLLEGA`, inquadra il codice (WhatsApp Business → Impostazioni → Dispositivi collegati → Collega un dispositivo). **Non togliere ancora il vecchio «Mac OS»** dal telefono: serve per tornare indietro.
2. **Aspetta, senza spegnere il Mac.** Nel CRM compare «storico ancora in arrivo»; poi guarda `./installa.sh stato` (`in_coda` scende a 0: circa 14 messaggi al secondo, 100.000 messaggi sono circa 2 ore; il tetto della coda è 10.000 file e 1 GiB, cioè 500.000 messaggi).
3. **Leggi il tipo di storico** nel log: `grep " storico " ~/Library/Logs/hgl-ponte-wa.log`. Ogni riga ha `letti`, `validi` e `tipo=<numero>` (il tipo di sincronizzazione scelto dal telefono: `0` primo scarico, `2` completo, `3` recente, altri numeri possibili). **Se non compare mai `tipo=2` il telefono non ha mandato lo storico completo**: nemmeno con `Desktop` si può forzare. Per confronto, il primo giro del 29/10 ebbe 11.792 messaggi letti, 9.374 validi, 826 chat; `grep battito_collegato ~/Library/Logs/hgl-ponte-wa.log | tail -1` dà i totali (`storico_rifiutati` deve restare 0; se compare **«coda piena»** fermati: `launchctl bootout gui/$(id -u)/it.hgl.ponte-whatsapp`).
4. **Controlla**, a coda vuota: i contatti sotto 3000; rilancia le misure di «prima»; i doppioni interni **uguali** a prima, gli esterni non in forte salita; «Non letti» e «Da rispondere» **non devono salire, salvo messaggi veri arrivati stasera** (possono scendere di qualche unità: è normale, il ponte nasconde un doppione trovato in ritardo); le righe del numero di prova hanno date più vecchie di oggi.
5. **Il telefono suona ancora?** Da un altro telefono scrivi al numero. Se non suona, o se i numeri salgono, **fermati** e chiedi a chi ti assiste: non togliere niente.
6. **Il giorno dopo**: rifai il test del suono; se tutto va bene, cambia `INVII_ATTIVI=0` in `INVII_ATTIVI=1`, `launchctl kickstart -k gui/$(id -u)/it.hgl.ponte-whatsapp`, e solo allora togli dal telefono il «Mac OS» **più vecchio**.

**Se il codice non compare o si richiude subito (errore 428):** cambia la riga `IDENTITA` in `IDENTITA=Chrome` e rilancia il passo 1; lo storico sarà quello «recente». **Se con `Desktop` il telefono non suona più:** `IDENTITA=Chrome` e ricollega (lo storico resta nel CRM).

**Per tornare alla sessione di prima** (se hai ancora il vecchio «Mac OS» sul telefono): `launchctl bootout gui/$(id -u)/it.hgl.ponte-whatsapp`, `mv auth auth.nuovo-fallito`, `mv auth.scollegato-<data> auth`, `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/it.hgl.ponte-whatsapp.plist` (nella cartella `~/Library/Application Support/HGL/ponte-wa`).

### Le misure del «prima» e del «dopo»

Solo contatori e date: niente testi. Negli esempi c'è un numero **finto** (`393331234567`): al suo posto metti quello vero **solo nel tuo SQL Editor**, mai in un documento del repo.

```sql
-- 1) esterni: righe del ponte che hanno un gemello ManyChat/Cloud ancora visibile.
--    Sonda di proposito più larga dell'abbinamento vero (600 s e 100 caratteri contro 180 s e 1000 caratteri).
select count(*) as possibili_doppioni_esterni
  from public.whatsapp_messages b
  join public.whatsapp_messages m
    on m.user_id = b.user_id and m.id <> b.id and m.direction = b.direction
   and m.canale is distinct from 'baileys'
   and right(regexp_replace(case when m.direction = 'inbound' then m.from_number else m.to_number end, '\D', '', 'g'), 9)
     = right(regexp_replace(case when b.direction = 'inbound' then b.from_number else b.to_number end, '\D', '', 'g'), 9)
   and abs(extract(epoch from b.created_at - m.created_at)) <= 600
   and lower(left(coalesce(b.body, ''), 100)) = lower(left(coalesce(m.body, ''), 100))
 where b.canale = 'baileys' and b.duplicato_di is null and m.duplicato_di is null;

-- 2) interni: lo stesso id WhatsApp con due chiavi diverse (un LID risolto in modo diverso). Deve restare INVARIATO.
select count(*) as doppioni_interni
  from (select split_part(wa_message_id, ':', 3) from public.whatsapp_messages
         where canale = 'baileys' group by 1 having count(*) > 1) x;

-- 3) segnaposto «non leggibile» ancora presenti (…-nd). Può solo restare uguale o salire di poco.
select count(*) as segnaposto_nd from public.whatsapp_messages where canale = 'baileys' and wa_message_id like 'bw:%-nd';
```

Regola: la 2) non deve cambiare; la 1) non deve crescere in modo sensibile (due «Ok» veri ravvicinati contano in entrambe le letture); se una delle due cresce molto, fermati e chiedi a chi ti assiste. **Mai cancellazioni automatiche:** decide il titolare.

Per **una chat sola** (il caso «lead noto con solo i messaggi di oggi»), prima e dopo, con il numero finto al posto di quello vero:

```sql
-- righe di quella chat per canale e direzione, dalla più vecchia alla più recente
select m.canale, m.direction, count(*) n, min(m.created_at) dal, max(m.created_at) al
  from public.whatsapp_messages m
 where right(regexp_replace(case when m.direction = 'inbound' then m.from_number else m.to_number end, '\D', '', 'g'), 9) = right('393331234567', 9)
 group by 1, 2 order by 1, 2;
-- quando è nata la scheda (nata dopo il 2026-10-29 14:57 UTC? Allora il suo storico di quel giorno fu scartato)
select created_at from public.crm_leads
 where right(regexp_replace(coalesce(data ->> 'telefono', ''), '\D', '', 'g'), 9) = right('393331234567', 9);
```

Come leggere l'esito: righe `baileys` con date **prima di oggi** dopo l'esportazione = lo storico è arrivato; ancora solo oggi **e** nel log è comparso `tipo=2` = la chat inizia davvero oggi; ancora solo oggi e **nessun** `tipo=2` = il telefono non ha mandato lo storico completo (non dice niente su quella chat).

### Cosa può non arrivare

Lo decide il telefono: anche con `Desktop` può mandare meno di quello che vedi sul telefono. Sono esclusi per scelta gruppi, stati, canali, reazioni, modifiche e sondaggi. Nel secondo import le righe già presenti non si riscrivono; ogni messaggio ripassa però dall'abbinamento con ManyChat: se per una riga già visibile compare adesso il suo gemello ManyChat, la riga si nasconde e i «Non letti» scendono di 1 (una volta sola). Per questo possono scendere, mai salire.

## Cosa vedi nel CRM

In **Chat**, in cima, compare una fascia **solo se qualcosa non va**: «il ponte non risponde da N minuti» (Mac spento, addormentato o ponte fermo), «WhatsApp ha scollegato il ponte» (c'è un codice nuovo da inquadrare sul Mac), «lo storico è ancora in arrivo (62%)». Se non vedi niente, va tutto bene. L'avviso lo vede solo chi apre la Chat: non arriva una notifica sul telefono.

## Collaudo (10 controlli, nell'ordine)

Il numero 5 è il più importante.

1. **Passo 1-4 fatti** e il Passo 5 (prova senza invio) con i conteggi simili al telefono.
2. **Coesistenza con ManyChat (entro 10 minuti dal primo collegamento).** Da **un altro telefono** scrivi al numero: il messaggio deve arrivare in ManyChat/CRM come sempre. Poi **manda un messaggio dal CRM** a quel telefono: deve partire. Se uno dei due non funziona: **scollega subito il dispositivo dal telefono** (vedi «In cima») e dillo a chi ti assiste.
3. **Avvio vero** (Passo 6) e guarda **Chat** nel CRM mentre lo storico arriva.
4. **Orari.** Prendi 5 messaggi vecchi a caso: ora e giorno nel CRM devono essere uguali a quelli del telefono.
5. **Doppioni.** Da un altro telefono scrivi al numero; rispondi dal CRM; rispondi anche dall'app Business. Ogni messaggio deve comparire **una volta sola**, e la chat esce da «Da rispondere» quando rispondi dall'app.
6. **Il giro.** Guarda «Attesa WhatsApp» e «Da chiamare»: devono essere come il giorno prima. Lo storico vecchio non deve farti credere che un cliente abbia appena risposto, e i non letti non devono salire per i messaggi vecchi.
7. **Caduta della rete.** Spegni il Wi-Fi del Mac per 5 minuti: nel CRM compare l'avviso, e alla riaccensione sparisce da solo.
8. **Scollegamento.** Scollega il dispositivo dal telefono: nel CRM compare l'avviso e sul Mac si apre un codice nuovo.
9. **Riavvio del Mac.** Riavvia, fai il login: il ponte deve ripartire da solo (con FileVault, solo dopo il login).
10. **Numero sconosciuto (dal 30/10):** da un telefono che il CRM non conosce scrivi al numero Business. Entro circa 3 minuti la chat compare in Tutte, Sconosciuti, Non letti (+1) e Da rispondere, col numero al posto del nome; se rispondi dall'app esce da «Da rispondere».

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

- Non scarica foto, vocali o allegati: compare un segnaposto («📷 Foto», «🎤 Vocale»). Non ne manda nemmeno: scrivendo dal telefono si manda solo testo.
- Non segue le modifiche e le cancellazioni: un messaggio modificato o cancellato per tutti resta com'era nel CRM.
- Non salva il nome del profilo WhatsApp degli sconosciuti: si vedono col numero.
- Non mette il codice da inquadrare nel CRM: sta solo sul Mac.
- Un messaggio nuovo che ManyChat non porta conta come non letto e «Da rispondere» dopo circa 2 minuti (non subito). Se ManyChat lo porta con un testo diverso o oltre 3 minuti dopo, può contare 2 non letti (raro). Un messaggio «STOP» arrivato solo al telefono non ferma il giro: è come prima.

## Controllo delle dipendenze (npm audit)

Eseguito il 29/10/2026 sul `package-lock.json` del ponte (`npm audit --package-lock-only`): **0 vulnerabilità** su 124 pacchetti (94 usati, 27 facoltativi, 31 «peer»). Il pacchetto è `@whiskeysockets/baileys` alla versione esatta `7.0.0-rc14`; nel file non c'è nessun pacchetto omonimo chiamato solo «baileys». Si installa con `npm ci --ignore-scripts`: due pacchetti (Baileys stesso e `protobufjs`) hanno uno script di installazione e **non viene eseguito**. Ripeti il controllo prima di ogni aggiornamento.
