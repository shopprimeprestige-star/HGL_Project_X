# Shop · Vetrina V1 · i passi che toccano a te

La Vetrina V1 è il disegno nuovo di cinque pagine dello shop: la home (`/shop`), le categorie, la ricerca, la scheda prodotto e il carrello. Cassa, ordine e collaudo restano quelli di oggi.

**Non ci sono migrazioni del database e non ci sono variabili nuove.** Non devi incollare chiavi né lanciare file SQL.

**Cosa cambia per i clienti, subito: quasi niente.** Le pagine nuove le vedi solo tu, con il collaudo con chiave (sezione 2). Il pubblico le vede quando premi «Apri lo shop al pubblico» nel CRM. Finché non lo premi, restano le pagine di oggi, con le due differenze della sezione 4.

## 1. Cosa carichi nel CMS prima di accendere la vetrina nuova

**Le categorie.** Creane almeno due con questi nomi di indirizzo (slug) esatti, scritti così, minuscolo e con i trattini:
- `patch-pronte`
- `shampoo-e-balsami`

Le altre quattro, se le vuoi: `districanti`, `colle-e-remover`, `spazzole`, `kit`. L'elenco esatto sta in `src/landing/testi-shop.ts` (`TESTI_SHOP.categorie`).
- Metti dentro i prodotti. **Una categoria senza prodotti non fa comparire il suo bottone nell'eroe della home**, e la home resta senza bottoni.
- Una categoria nuova nasce nascosta: accendila dall'elenco.

**I titoli.** Nella sezione «Shop (/shop)» dei contenuti:
- il titolo dell'eroe («Home · titolo»);
- il titolo della vetrina («Home · vetrina, titolo»).

**Non svuotarli.** Un titolo svuotato non torna quello di partenza: la pagina resta senza (e l'eroe senza il suo titolo principale).

**Le foto.**
- Nessun cliente riconoscibile in una foto senza la sua **liberatoria** firmata. Vale soprattutto per la foto dell'eroe e per i video dei colori e della cura.
- Se cambi una foto, **riscrivi anche la sua descrizione** («Descrizione per chi non vede»): quella di prima non descrive più la foto nuova.
- Ogni foto di prodotto ha la sua descrizione: senza, il CMS non ti lascia pubblicare.

**Il primo prodotto.** La vetrina della home mostra le patch **in ordine alfabetico** (al massimo 6; con meno di 2 patch pubblicate la vetrina non compare). Quindi il primo della fila è quello con il nome che viene prima nell'alfabeto.
- **Non deve essere un prodotto di prova né uno esaurito** (D78).
- Prima di aprire al pubblico, guarda la home vera con il collaudo con chiave (sezione 2).

## 2. Come vedi le pagine prima di accenderle
**Le pagine nuove.** Il collaudo con chiave, come in `RILASCIO-2-PASSI-DEL-TITOLARE.md` (sezione 7):
1. Nel CRM, scheda **Cassa**, riquadro **Collaudo con chiave**, premi **Crea il link di collaudo** e **Copia**.
2. Mandalo al tuo telefono. **Dura 2 ore**, ma finché dura lo usa chiunque lo abbia: mandalo solo a te.
3. Aprilo: vedi lo shop con le pagine nuove, solo tu, solo su quel telefono. Il pubblico continua a vedere quelle di oggi.
4. Finita la prova, **cancella il messaggio** con il link.

**Le bozze dei prodotti.** Nella scheda del prodotto nel CRM, «Copia il link per il telefono» dà un indirizzo con la chiave di anteprima.
- Dura **24 ore**.
- Mostra la bozza con le modifiche non pubblicate, in una pagina che i motori di ricerca non vedono, **senza bottone d'acquisto**.
- Un riquadro ambra elenca cosa è nascosto e perché.

## 3. Una regola da non rompere: la tariffa di spedizione
**Non cambiare e non disattivare la tariffa di spedizione finché la cassa nuova non è accesa.**
- Il carrello nuovo legge la tariffa dalla scheda **Spedizioni** del CRM. La cassa di oggi usa sempre 4,90 €.
- Se porti la tariffa a 5,90 € (o la spegni), il carrello mostra 5,90 € (o «—») e la cassa di oggi continua a mostrare e a registrare 4,90 €.

## 4. Cosa cambia anche nel modo di oggi (`codice`)
Se non premi «Apri lo shop al pubblico», il pubblico vede ancora le pagine di oggi, con **due differenze**, solo sulle cinque pagine V1 (`/shop`, `/shop/c/…`, `/shop/cerca`, `/shop/prodotto/…`, `/shop/carrello`):
- il **carattere** è Inter;
- la pagina dichiara la lingua italiana (`lang="it"`), prima dichiarava l'inglese.

Cassa, ordine e collaudo restano come sono, anche nel carattere e nella lingua. È una scelta dichiarata: si cambia con la V2.

## 5. Per Vendite: un valore nuovo nel conteggio del pop-up
Nel pop-up d'uscita, il bottone **«Consulenza gratuita»** del pop-up nuovo manda l'evento `consulenza_popup_click` con `azione = "consulenza"`.
- Prima, `azione` valeva `"x"`, `"no_grazie"` o `"problema"` (con la voce scelta).
- Il valore nuovo è diverso da questi tre: chi conta le richieste per Vendite deve **aggiungere** `"consulenza"`, altrimenti i clic su quel bottone non entrano nel conteggio.

## 6. Scelte fatte senza di te, da sapere
- **La home nuova non manda il `ViewContent` di lista.** Il documento non lo chiedeva. Lo mandano la categoria e la scheda. Se lo vuoi anche sulla home, si aggiunge.
- **`stock_vista_scheda` resta come oggi.** È l'evento interno che conta le visite alle schede: la scheda nuova lo manda come la vecchia, anche se il piano degli eventi (D90) non lo prevedeva.
- **Con il guasto della ricerca, «Cerca» è a contorno.** Se la ricerca non si carica, l'unico bottone pieno è «Riprova»: una pagina ha un solo bottone pieno.

## 7. I limiti noti delle prove
- **La regola 8 di `vetrina-regole` segue un solo passo.** Vede un prezzo letto dalla memoria del browser solo se va dritto da lì all'uso. Un giro più lungo le sfugge. Il rischio vero (un carrello alterato nel browser) è coperto da altre due prove.
- **La suite deve girare da un clone intero**, con la storia git. Un clone «leggero» (`--depth 1`) la fa andare in rosso, per costruzione, con la frase «serve la storia git». Se un giorno la suite entra in un controllo automatico di GitHub, quel passo va con la storia intera (`fetch-depth: 0`).
- Nessuna lettura con browser nelle prove automatiche: spazi, colori, tastiera e VoiceOver si guardano con il collaudo a telefono.

## 8. Cosa resta da decidere a te
Ognuna in una riga:
- **«Gratuita»** per la spedizione a 0: la parola la dà il copywriter, oggi è provvisoria.
- **Il nome del percorso «Lo shop»** (la prima voce sopra le categorie): provvisorio, da confermare.
- **La riga di fiducia del carrello**: manca la frase del copywriter; finché non c'è, non compare.
- **L'importo della spedizione (4,90 €)**: è un valore provvisorio, lo confermi o lo cambi (ricorda la sezione 3).
- **I testi di privacy, le note legali e le email**: restano da approvare da te.
- **Il video della cura**: lo slot esiste nel CMS, ma oggi nessuna pagina lo mostra. O si aggiunge un blocco che lo mostra, o si tolgono gli slot.
