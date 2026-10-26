# Lead dal foglio Google al CRM · guida passo passo

Cosa fa: quando Meta scrive un lead nuovo nel tuo foglio Google, uno script lo manda al CRM. In meno di un minuto la scheda compare in **Lead importati → Altro → Lead da Google Sheets**, con nome, telefono, risposte del modulo e temperatura. Se lo stesso numero è già in archivio non nasce una scheda doppia: diventa un **contatto di ritorno**.

Tempo: circa 20 minuti, una volta sola.

## Una cosa da sapere prima: lo script è tuo, non del foglio

Lo script **non si crea dentro il foglio** (Estensioni → Apps Script). Si crea come progetto a sé, con il tuo account Google, su script.google.com. Il motivo è la chiave segreta: le impostazioni di uno script che sta dentro il foglio le può leggere **chiunque possa modificare il foglio**, e il foglio lo usano anche le persone che lavorano ai lead. Con uno script tuo, la chiave la vedi solo tu. Lo script apre il foglio per il suo codice (l'ID) e funziona anche se nessuno ha il foglio aperto.

Regola: la chiave non va **mai** scritta nel foglio, in una chat, in un'email o nel codice. Solo nelle impostazioni dello script e nei segreti del CRM.

## Prima di cominciare

Servono tre cose, che prepara il capo progetto:

1. **L'aggiornamento del database `sheets_ingresso` (S1)** applicato. Se manca, lo script non perde niente: il CRM risponde «non pronto» e lo script riprova da solo fra qualche minuto.
2. **Il CRM pubblicato** con la novità dei lead dal foglio.
3. **La configurazione di ManyChat** già fatta (il CRM sa a chi intestare le schede). Se manca, stessa cosa: «non pronto», si riprova.

## Passo 1 · La chiave segreta

Sul tuo Mac, nel Terminale:

```
openssl rand -hex 32
```

Esce una riga di 64 lettere e numeri: è la chiave. Copiala (non incollarla da nessuna parte per ora).

Poi mettila nei segreti del CRM, dalla cartella del progetto:

```
npx wrangler secret put SHEETS_INGRESSO_TOKEN
```

Ti chiede il valore: incolla la chiave e premi Invio. Il nome deve essere esattamente `SHEETS_INGRESSO_TOKEN`.

## Passo 2 · Crea lo script

1. Vai su **script.google.com**, con il tuo account Google (quello che sei disposto a usare per questo lavoro: vedi più sotto «Il tempo che lo script può usare»).
2. Premi **Nuovo progetto**. In alto dagli un nome, per esempio «Lead HGL al CRM».
3. Nel file `Codice.gs` cancella tutto quello che c'è e **incolla il contenuto del file `strumenti/google-sheets/ingresso-crm.gs`** del progetto.
4. Premi l'icona del dischetto (Salva).

## Passo 3 · Le impostazioni dello script

1. A sinistra premi l'ingranaggio **Impostazioni progetto**.
2. In fondo, **Proprietà dello script** → **Aggiungi proprietà dello script**. Aggiungine una alla volta:

| Proprietà | Valore |
|---|---|
| `FOGLIO_ID` | l'ID del foglio: apri il foglio, guarda l'indirizzo, è la parte fra `/d/` e `/edit` |
| `CRM_URL` | `https://<indirizzo del tuo CRM>/api/public/sheets-ingresso` (deve cominciare con `https://`) |
| `CRM_TOKEN` | la chiave del Passo 1 |
| `OGNI_MINUTI` | `1` (vedi «Ogni minuto o ogni 5 minuti») |
| `SCHEDA` | solo se i lead stanno in una scheda del foglio che **non** è la prima: il nome di quella scheda |

3. Premi **Salva proprietà dello script**.

## Passo 4 · Le righe che ci sono già (importante)

Se nel foglio ci sono già dei lead che **sono già nel CRM** (caricati da file o a mano), devi dire allo script di non mandarli di nuovo. Altrimenti arriverebbero tutti come «contatto di ritorno».

1. In alto, nel menu a tendina delle funzioni, scegli **`segnaGiaPresenti`**.
2. Premi **Esegui**.
3. La prima volta Google chiede i permessi: vedi il Passo 5.

Lo script scrive «già presente prima del collegamento» per tutte le righe che ci sono adesso, nella scheda a parte **«Invii al CRM»**. Non manda niente al CRM.

Se invece il foglio è vuoto o nuovo, salta questo passo. Per sicurezza, se ci sono **più di 20 righe senza segno**, il passo dopo (`installa`) si rifiuta di partire finché non lanci `segnaGiaPresenti`: è una protezione contro l'invio di centinaia di righe vecchie per sbaglio.

## Passo 5 · Accendi

1. Nel menu a tendina scegli **`installa`** e premi **Esegui**.
2. Google chiede l'autorizzazione («Revisione autorizzazioni»). Scegli il tuo account.
3. Compare «Google non ha verificato questa app». È normale: lo script lo hai creato tu. Premi **Avanzate** → **Vai a Lead HGL al CRM (non sicuro)** → **Consenti**. Lo script chiede solo di leggere e scrivere i fogli Google e di collegarsi a un indirizzo esterno (il tuo CRM).
4. Premi di nuovo **Esegui** su `installa`, se la prima volta si è fermato per i permessi.

`installa` mette i controlli automatici (scatta quando il foglio cambia, e controlla da solo ogni minuto) e fa subito un primo giro. Si può rilanciare quando vuoi: non raddoppia niente.

## Passo 6 · Prova

1. **Prima assicurati che le sequenze automatiche WhatsApp siano spente** (Impostazioni → WhatsApp con ManyChat: «Lead nuovo» spento). La riga di prova è un lead vero per il CRM, con il consenso del modulo: con «Lead nuovo» acceso il primo messaggio potrebbe partire verso il numero finto prima che tu cancelli la scheda. Poi aggiungi nel foglio una riga di prova (nome e telefono finti, per esempio «Prova Esempio», un numero che non esiste) oppure usa lo strumento di prova dei Lead Ads di Meta.
2. Entro un minuto, nella scheda **Invii al CRM** compare una riga con la data e **nuova scheda**.
3. Nel CRM, **Lead importati → Altro → Lead da Google Sheets**: c'è la scheda, con l'origine «Google Sheets · nome del foglio».
4. Aggiungi una seconda riga con **lo stesso numero**: la colonna dice **contatto di ritorno**, e nel CRM non c'è una scheda nuova ma il contatore di ritorno sale di uno.
5. Cancella la scheda di prova dal CRM.

## La scheda «Invii al CRM»

⚠️ **Lo script non scrive mai nella scheda di Meta.** Una colonna in più nella riga dei titoli confonde l'integrazione di Meta (il 27/10 ha scritto un lead sopra i titoli). I segni stanno in una scheda a parte, «Invii al CRM», che lo script crea da solo: una riga per lead (chiave · ultimo invio · esito). La riga dei titoli della scheda di Meta lo script la cerca (quella con `created_time`), anche se non è la prima.

## Cosa scrive nella colonna «Esito»

La scheda la scrive lo script. **Non scriverci tu**: un lead con un segno non viene più mandato. Per rimandarne uno, cancella la sua riga in «Invii al CRM».

| Frase | Che cosa vuol dire |
|---|---|
| `nuova scheda` | È nata una scheda in «Da contattare». |
| `contatto di ritorno` | Stesso numero già in archivio: segnato come ritorno (contatore, risposte e provenienza si aggiornano); **stato e note non cambiano**. |
| `già ricevuto` | Il CRM aveva già questa riga (succede se il foglio è stato riordinato o lo script ha ripetuto). Va bene così. |
| `già nel CRM` | Questo lead (stesso ID di Meta) era già stato caricato da file. Niente doppioni. |
| `scartata: senza nome né telefono` | Riga vuota o senza dati utili. |
| `non inviata: riga troppo lunga` / `riga non leggibile` | Il CRM ha rifiutato la riga (troppe colonne o celle enormi). Va guardata a mano. |
| `errore: da guardare (500)` | Il CRM ha dato errore per questa riga 5 volte di fila. Le altre righe non sono bloccate. Fai caricare la riga a mano e avvisa il capo progetto. |
| `già presente prima del collegamento` | Riga che c'era prima: non è stata mandata (Passo 4). |
| vuota | Non è ancora stata mandata (al prossimo giro) oppure il CRM non è pronto. |

## Ogni minuto o ogni 5 minuti

Lo script parte in due modi: quando il foglio cambia, e con un controllo a tempo che ripassa a vedere se manca qualche riga. Non è certo che il primo modo scatti quando a scrivere nel foglio è l'integrazione di Meta (scrive con le API di Google, ed è proprio il caso in cui Google non lo garantisce). Per questo **di serie si usa il controllo ogni minuto** (`OGNI_MINUTI = 1`): il lead arriva nel CRM entro un minuto in ogni caso.

Se vuoi risparmiare tempo di calcolo, prova così:

1. Metti `OGNI_MINUTI = 5` e rilancia `installa`.
2. Aggiungi un lead di prova con lo strumento di prova di Meta e guarda l'orologio.
3. Se in «Invii al CRM» compare la riga **entro un minuto**, l'avvio automatico scatta con Meta: puoi tenere 5. Se ci mette fino a 5 minuti, rimetti `1` e rilancia `installa`.

## Il tempo che lo script può usare

Google dà ai trigger un tempo massimo al giorno: circa **90 minuti** per un account Gmail normale, circa **6 ore** per Google Workspace. Un controllo ogni minuto che non trova niente da fare dura 1-2 secondi: in un giorno sono circa **25-50 minuti**. In più c'è il trigger «quando il foglio cambia»: scatta a **ogni modifica di chiunque** nel foglio (anche quando le persone che lavorano ai lead scrivono note o cambiano colonne) e ogni volta conta qualche secondo. Con tante modifiche il totale sale. Se si superano i limiti, Google ferma i trigger dell'account fino al giorno dopo. Va bene da solo, ma se usi **lo stesso account** per altri script, meglio un account Workspace, oppure `OGNI_MINUTI = 5`. Per vedere quanto usi: script.google.com → **Esecuzioni**.

## Limiti di sicurezza (non servono a te, ma è bene saperli)

- Il CRM accetta **al massimo 300 righe al giorno** dal foglio. Oltre, il CRM risponde «tetto»: lo script riprova a ogni giro e le righe passano dopo la mezzanotte di Roma. Il numero si vede nelle Impostazioni → WhatsApp con ManyChat → «Foglio Google».
- Chi ha la chiave potrebbe creare schede finte, ma solo fino a quel limite. Se pensi che la chiave sia uscita: cambiala (sotto).
- Il CRM non salva mai l'ID del foglio Google, solo il suo nome.
- Chi **ricompila il modulo** con un numero già in archivio diventa un contatto di ritorno: lo richiama la setter da «Di ritorno» e **non riceve** il primo messaggio automatico.

## Se qualcosa non va

| Sintomo | Che cosa fare |
|---|---|
| La colonna resta vuota | Su script.google.com guarda **Esecuzioni**: se c'è un errore, leggilo. «Manca CRM_TOKEN…» o «CRM_URL deve cominciare con https://»: correggi le proprietà. |
| Nei registri compare «Chiave rifiutata dal CRM» | `CRM_TOKEN` non è uguale al segreto `SHEETS_INGRESSO_TOKEN` del CRM. Rimettili uguali (stessa chiave, senza spazi). Lo script si ferma e non segna niente. |
| «CRM non pronto o tetto del giorno raggiunto» | Il database non ha ancora l'aggiornamento S1, o mancano la configurazione di ManyChat o la pubblicazione, oppure sono arrivate 300 righe oggi. Lo script riprova da solo. |
| «Ci sono più di 20 righe senza segno» | Lancia prima `segnaGiaPresenti` (Passo 4). |
| Una riga ha il segno ma non c'è la scheda | Cerca per il numero in «Tutta la lista»: se esisteva già è un ritorno. |
| Hai ordinato il foglio e la colonna sembra sbagliata | Lo script scrive il segno solo se la riga è ancora quella; se è cambiata la rimanda al giro dopo e il CRM risponde «già ricevuto». Nessun lead si perde e nessuno si raddoppia. |

## Cambiare la chiave, o spegnere

**Cambiare la chiave:** rifai il Passo 1 (nuova chiave, nuovo `wrangler secret put`), poi nello script cambia la proprietà `CRM_TOKEN`. Fra i due passaggi lo script riceve «chiave rifiutata» e aspetta: non perde righe.

**Spegnere:** nel menu a tendina scegli **`disinstalla`** ed Esegui. Toglie i controlli automatici. Il foglio e le schede già nel CRM non cambiano. Per riaccendere: `installa`.
