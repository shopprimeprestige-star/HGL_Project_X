/** ── LE PROVE DELLA CONTABILITÀ ────────────────────────────────────────────
 *
 *  `npm test`. Nessuna dipendenza nuova: esbuild c'è già (lo porta vite) e
 *  fa da ponte fra il TypeScript con gli alias e Node, che li ignora.
 *
 *  ── ⚠️ PERCHÉ QUESTO FILE ESISTE ──────────────────────────────────────────
 *  Perché una correzione si è persa. La lettura degli importi incolonnati —
 *  l'etichetta sopra, la cifra sotto — era stata scritta, funzionava, ed è
 *  stata sovrascritta ripristinando da git un blocco vicino. Nessuna prova la
 *  copriva, e a trovarla è stato il committente su una sua fattura, due
 *  giorni dopo. Un controllo che vive solo nella testa di chi ha scritto il
 *  codice non è un controllo.
 *
 *  ── COSA COPRE, E COSA NO ─────────────────────────────────────────────────
 *  Copre le regole: come si legge un documento, cosa porta in contabilità un
 *  regime, quando cade una scadenza, come tornano i conti. NON copre il
 *  disegno delle schermate né l'archivio su Supabase: quelli si guardano
 *  aprendo la pagina, e questo file non fa finta di sostituirla.
 *  ───────────────────────────────────────────────────────────────────────── */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pdfFontRitagliato, pdfProtetto, pdfScansione, pdfStampato } from "./pdf-finti.mjs";

const qui = dirname(fileURLToPath(import.meta.url));
const radice = join(qui, "..");
/** ── ⚠️ LO SCHEMA UFFICIALE, DENTRO IL PROGETTO ───────────────────────────
 *  `xmllint --noout` dice solo che il file si APRE. Lo schema dice se lo SDI
 *  lo accetterebbe — e la differenza non e' teorica: la prima autofattura era
 *  ben formata, si apriva, e sarebbe stata scartata perche' mancava un
 *  elemento obbligatorio (`RegimeFiscale` del cedente). Ce l'ha detto lo
 *  schema, non una rilettura.
 *  Il file e' la versione 1.2.2 pubblicata dall'Agenzia. Sta qui dentro perche'
 *  una prova che dipende da un file che qualcuno deve procurarsi non gira mai. */
const SCHEMA = join(qui, "fatturapa-v1.2.2.xsd");
const dove = join(tmpdir(), "prove-contabilita");

/* ── 1. SI IMPACCHETTA IL CODICE VERO ─────────────────────────────────────
   Non una copia delle regole: i moduli di `src/crm`, quelli che vanno in
   produzione. Una prova scritta contro una riscrittura delle stesse regole
   passa sempre, e non dice niente. */
const MODULI = [
  "contabilita",
  "contabilita-regimi",
  "contabilita-regole",
  "contabilita-tracciabilita",
  "contabilita-scadenze",
  "contabilita-fornitori",
  "contabilita-raccolta",
  "contabilita-consigli",
  "contabilita-foglio",
  "contabilita-periodo",
  "contabilita-pdf",
  //  ⚠️ L'XML della fattura elettronica sta qui dentro, ed è l'uscita più
  //   delicata di tutto il CRM: quel file lo riceve lo SdI, e uno sbagliato
  //   torna indietro — o peggio, passa con i numeri storti.
  "fatture/xml",
  "contabilita-pacchetto",
  "contabilita-esporta",
  "contabilita-DaSistemare",
  "contabilita-AvvisoScadenza",
  "costi-mese",
  "contabilita-f24",
  "contabilita-autofattura",
  "contabilita-f24-foglio",
  "contabilita-registri",
  "contabilita-registri-foglio",
  "contabilita-ritenute",
  "contabilita-xls",
  //  ⚠️ Serve a una prova sola ma importante: vedi proveDelRitornoPosa.
  "types",
  //  ⚠️ Quali stati promettono un momento, e in che campo finisce la data:
  //   una promessa senza giorno esce dalle code di lavoro e non ci rientra.
  //   Vedi proveDelQuandoPerStato.
  "quando-per-stato",
  "costi-pratica",
  "kpi-netto",
  "kpi-calcoli",
  //  ⚠️ Non sta in `src/crm` ma in `src/webinar`: vedi il ramo qui sotto sul
  //   percorso. È l'unica regola del webinar che decide una cosa che si vede,
  //   e vale la pena tenerla ferma.
  "webinar/tipi",
  "ricerca-lead",
  //  ⚠️ Decide se una vendita viene annunciata a Meta: vedi provePosaAggiunta.
  "lead-analytics",
  "fatture/messaggio-dati",
  //  ⚠️ Acconto, saldo o fattura intera: vedi proveDelTipoProposto. Una
  //   proposta sbagliata si accetta senza guardarla, ed e' finita al cliente.
  "fatture/conti",
  //  ⚠️ Spogliare una fattura di quello che la rende emessa: vedi
  //   proveDelRitornoInBozza. E' quello che succede eliminando una fattura —
  //   torna bozza invece di sparire — e un campo dimenticato qui vuol dire una
  //   bozza che si porta addosso un numero che intanto ha preso un'altra.
  "fatture/tipi",
  //  ⚠️ Come ha pagato, e che cosa chiedere di conseguenza: la causale è la
  //   parola del bonifico, al POS serve il codice dell'operazione. Vedi
  //   proveDeiModiDiIncasso.
  "fatture/modi-di-incasso",
  //  ⚠️ I dati letti dalla fotografia di un documento: vedi
  //   proveDellaLetturaDocumento. Finiscono su una fattura vera, e un codice
  //   fiscale storto la fa scartare dallo SDI giorni dopo.
  "fatture/lettura-documento",
  //  ⚠️ Fatturato contro incassato su una scheda: vedi proveDelDivario. Due
  //   cifre che vengono da due mondi — la cassa e i documenti — e la
  //   differenza fra loro è un lavoro da fare che prima non vedeva nessuno.
  "fatture/conto-lead",
  //  ⚠️ Tracciato e contanti di una pratica: vedi proveDelCanale. È la regola
  //   che tiene insieme due dichiarazioni fatte in due momenti diversi — la
  //   vendita e la posa — senza che i contanti diventino più del prezzo.
  "canale-incasso",
  //  ⚠️ Cosa dice davvero un codice fiscale: vedi proveDelCodiceFiscale. Da
  //   qui escono la data di nascita e l'eta' che finiscono sulla scheda del
  //   cliente, e il controllo che dice se nome e cognome combaciano.
  "codice-fiscale",
  //  ⚠️ Il foglio delle installazioni, letto e riscritto: vedi
  //   proveDelFoglioInstallazioni. Le colonne di quel foglio non si possono
  //   credere — la data compare in tre posizioni diverse — e un lettore che si
  //   fida della posizione importa l'indirizzo dentro la data.
  "installazioni-csv",
  "webinar/griglia",
  "webinar/messaggio-invito",
  "webinar/segui-parole",
  //  ⚠️ Il diario di bordo della sala: vedi proveDelDiario.
  "webinar/diario",
  //  ⚠️ Distingue i sei modi in cui una camera «non si vede»: vedi provePalco.
  "webinar/diagnostica-palco",
  //  ⚠️ L'aggancio delle risposte in chat: vedi proveDelleMenzioni.
  "webinar/menzioni",
  //  ⚠️ Come si incastrano le persone sul palco: vedi proveDelTetris.
  "webinar/palco-tetris",
  "webinar/schermo",
  "webinar/regole-chat",
  "webinar/ritmo",
  "webinar/camera-buia",
  "webinar/fotogrammi",
  "webinar/errori-media",
  "webinar/regia-palco",
  "webinar/stato-palco",
  "webinar/versione",
  "webinar/misura-diretta",
  "webinar/iscrizione",
  "webinar/sfu",
  //  ⚠️ Il conto alla rovescia della sala d'attesa: vedi proveDelConto.
  "webinar/conto-alla-rovescia",
  //  ⚠️ L'elenco che si apre scrivendo «@»: vedi proveDelTag.
  "webinar/tag-chat",
  //  ⚠️ I messaggi pronti, uno per stato della trattativa: vedi
  //   proveDeiMessaggiPerStato. Sono i testi che partono decine di volte al
  //   giorno, e finora nessuna prova li guardava.
  "whatsapp",
  //  Le righe della pagina «Da fare oggi»: vedi proveDelleRigheDaFare.
  "dafare/righe",
  //  ⚠️ La tabella del gesto successivo per stato: vedi proveDelGestoPerStato.
  "ui",
  //  ⚠️ Il testo con cui si chiede l'immagine della prova capelli: vedi
  //   proveDellaProvaCapelli. È l'unico pezzo di quella pagina che si può
  //   provare, ed è anche quello che sbaglia senza fallire.
  "prova/tagli",
  //  ⚠️ I contatori della classifica dei tagli: vedi proveDellaClassifica.
  "prova/classifica",
  //  ⚠️ I codici d'accesso e i pacchetti: vedi proveDeiCodici.
  "prova/codici",
  "prova/pacchetti",
  //  ⚠️ La pagina che il consulente mostra al cliente: vedi
  //   provePaginaCondivisa. È la riga che ha lasciato un cliente davanti a una
  //   schermata vuota mentre il consulente gli parlava.
  "shop/pagina-condivisa",
  //  ⚠️ Lo specchio fra il telefono del cliente e lo schermo del consulente:
  //   vedi proveDelloSpecchio. Le regole di eco e di passo mostrabile sono la
  //   parte che, sbagliata, fa rimbalzare le due schermate all'infinito.
  "prova/specchio",
  //  ⚠️ I ritocchi al taglio scelto: vedi proveDeiRitocchi. Sono istruzioni che
  //   finiscono dentro il testo mandato al modello, e una riga scritta male
  //   basta a fargli reinventare il taglio invece di ritoccarlo.
  "prova/ritocchi",
  //  ⚠️ La misura della camerina tonda: vedi proveDellaCamerina. È il conto
  //   che fa combaciare quello che vede il consulente con quello che ha in
  //   mano il cliente, e sbagliandolo non si rompe niente — viene solo un
  //   cerchio della misura sbagliata.
  "shop/pip-misure",
  //  ⚠️ «NASCONDI GLI SCONTI» DEVE TOGLIERLI DAVVERO: vedi proveDelListino.
  //   Prima toglieva solo il barrato e lasciava lo sconto nel prezzo.
  "shop/quote-menu",
  //  ⚠️ Di quale consulenza è questo dispositivo: vedi proveDelCodiceDiretta.
  "shop/codice-diretta",
  //  ⚠️ Di chi è il listino che sto leggendo: vedi proveDellAmbito.
  "shop/ambito-listino",
  //  ⚠️ La modifica si compone sulla riga vera: vedi proveDellaModifica.
  "patch-scheda",
  //  ⚠️ La traduzione di un modulo Meta in una riga dei contatti arrivati:
  //   vedi proveDeiLeadDiMeta.
  "meta-leadgen",
  //  ⚠️ Il conto del preventivo tipo: vedi provePreselezione.
  "shop/listino-condiviso",
  //  ⚠️ IL ROSSO DEGLI ORARI PRESI: vedi proveDegliOrariPresi. Un orario
  //   occupato spariva dall'elenco, e l'occupato si calcolava sull'ora di
  //   inizio invece che su tutta la durata.
  "booking-utils",
  //  ⚠️ DI CHI È LA STANZA: vedi proveDellaStanza. Due consulenti sullo
  //   stesso lead finivano nella stessa stanza, e al secondo cliente veniva
  //   rifiutato l'ingresso.
  "stanza-consulenza",
  //  ⚠️ L'ECO CHE APRIVA IL MICROFONO: vedi proveDellaSogliaVoce. Mentre
  //   parlava l'altro, la sua voce rientrava dal nostro microfono e gliela
  //   rimandavamo indietro spezzettata.
  "shop/soglia-voce",
  //  ⚠️ LA LINEA SPARTITA: vedi proveDellaBanda. Con due interlocutori si
  //   chiedeva il 170% della linea, e il video si impuntava da tutte e due le
  //   parti.
  "shop/banda",
  //  ⚠️ LO ZOOM CHE NON TORNAVA: vedi proveDelloZoom. 1 + 0,4 − 0,4 non fa 1,
  //   e quel residuo teneva l'immagine "ingrandita" per sempre.
  "shop/zoom-passi",
  //  ⚠️ IL LAVORO LASCIATO A METÀ: vedi proveDellaBozza. Riprendendo un
  //   preventivo il codice sconto spariva e andava riscritto davanti al
  //   cliente, col prezzo risalito nel frattempo.
  "shop/bozza",
  //  ⚠️ UNA CONSULENZA, UNA RIGA: vedi proveDellaChiaveSessione. Tre stati
  //   della videoconsulenza stavano in una casella sola per tutti, e due
  //   consulenti in diretta insieme si scambiavano cliente e preventivo.
  "shop/chiave-sessione",
  //  ⚠️ CHI PARLA, senza far tremare lo schermo: vedi proveDellOratore. La
  //   decisione si prendeva sessanta volte al secondo, e il cliente vedeva la
  //   camerina cambiare faccia di continuo.
  "shop/oratore",
  //  ⚠️ I laterali e il taglio composto: vedi proveDeiLaterali e
  //   proveDelComposto. Sono le due strade nuove per dire che taglio si vuole,
  //   e finiscono dentro il testo mandato al modello: una riga vuota dove
  //   doveva esserci un'istruzione vuol dire una generazione pagata per il
  //   taglio sbagliato.
  "prova/laterali",
  "prova/composto",
  //  ⚠️ Quale taglio vero somiglia a quello composto: vedi proveDellaSomiglianza.
  //   È la fotografia che si allega come esempio di realismo, e sbagliarla è
  //   peggio che non allegarne nessuna — il modello guarda quella.
  "prova/somiglianza",
  //  ⚠️ Le cose da fare che si prendono un pezzo di giornata: vedi
  //   proveDellAgendaDeiTask. «Occupa l'agenda» non è un'etichetta — se quel
  //   tempo non viene tolto davvero, il calendario continua a offrirlo ai
  //   clienti e il doppio appuntamento si scopre con due persone davanti.
  "dafare/agenda-task",
  //  ⚠️ Il link ai lavori che si allega ai messaggi: vedi proveDeiLavori. Un
  //   indirizzo scritto a mano dentro venti testi porta venti clienti su una
  //   pagina che non c'è più il giorno che cambia.
  "lavori",
  //  ⚠️ L'interruttore dei lavori vale per tutto il giro: vedi
  //   proveDellInterruttoreLavori. Acceso su una riga si accende su tutte
  //   quelle dello STESSO STATO — e sbagliare il raggio vuol dire allegare un
  //   secondo link a una conferma d'appuntamento che ne ha già uno.
  "lavori-attivi",
  //  ⚠️ A chi ho gia' scritto oggi: vedi proveDeiGiaScritti. Il segno deve
  //   cadere da solo quando cambia lo stato o il giorno — una riga segnata
  //   ieri, stamattina, direbbe una cosa falsa nel modo piu' insidioso:
  //   sembrando vera.
  "scritti",
  //  ⚠️ CHI PUÒ FARE CHE COSA. È il file che decide se una persona apre una
  //   schermata o trova una porta chiusa, e finora non lo provava nessuno: un
  //   permesso di troppo non fallisce niente, si vede il giorno in cui qualcuno
  //   apre una pagina che non doveva.
  "permessi",
  //  ⚠️ COME SI LEGGE UN FILE DI CONTATTI. Da qui entrano le liste vere: un
  //   errore non fallisce niente, importa trenta schede con l'email nel campo
  //   del telefono — e si scopre chiamando.
  "import-backup",
  //  ⚠️ Le risposte del modulo di un'inserzione: vedi proveDelModulo.
  "modulo-lead",
  //  ⚠️ La rete che impedisce ai clic di morire: vedi proveDeiClicLiberi.
  "clic-liberi",
  //  ⚠️ Il tasso di conversione per risposta: vedi proveDelCvrPerRisposta.
  "kpi/risposte-lead",
  //  ⚠️ DA QUANDO una scheda e' nello stato in cui sta: il giorno LOCALE, non
  //   quello di Greenwich. Un «segreteria» messo all'una di notte finiva
  //   catalogato il giorno prima.
  "quando-stato",
  //  ⚠️ «L'appuntamento si è spostato?»: da questa risposta dipende se il
  //   cliente riceve un link nuovo o se ne conia uno a ogni salvataggio.
  "spostamento-meet",
  //  ⚠️ Chi ricompare in una lista già importata: regola dell'altra sessione,
  //   rimessa qui dopo che un ripristino di questo file l'aveva tolta.
  "doppioni",
  "importa/ricarico",
  "importa/ripesca",
  //  ⚠️ La riga appena sistemata non sparisce sotto le dita. Vedi
  //   proveDellElencoStabile.
  "importa/elenco-stabile",
  //  ⚠️ Il pezzo di nota che si legge di sfuggita fuori dalla scheda. Vedi
  //   proveDellaNotaInBreve.
  "importa/nota-breve",
  //  ⚠️ Chi si telefona oggi e chi aspetta la sua data di richiamo. Vedi
  //   proveDiChiSiTelefonaOggi.
  "importa/da-telefonare",
  //  ⚠️ Lo stesso numero scritto in dieci modi è lo stesso numero. Vedi
  //   proveDelTelefonoDoppio.
  "telefono-doppio",
  //  ⚠️ Quanto vive una sessione aperta col PIN: due scadenze, e perché
  //   servono tutte e due. Vedi proveDellaSessioneConPin.
  "sessione-pin",
  //  ⚠️ Quanto dura una consulenza quando nessuno lo dice: UN numero per tutto
  //   il CRM. Vedi proveDellaDurataDiSerie.
  "invito",
  //  ⚠️ Le frasi con cui i browser dicono «non ho scaricato un pezzo»: è la
  //   differenza fra un telefono che si riprende da solo e uno con «Try
  //   again» in faccia. Vedi proveDeiPezziMancanti.
  "versione-aperta",
  //  ⚠️ Di chi è una cosa da fare: la stessa domanda se la fanno due schermate
  //   (Da fare oggi e la linguetta «Oggi» dei lead importati) e la risposta sta
  //   in un file solo. Vedi proveDiChi.
  "dafare/di-chi",
  //  ⚠️ Riaprire un preventivo com'era (nomi salvati → voci del listino) e
  //   duplicarlo: vedi proveDellaRiapertura e proveDelDuplicato.
  "shop/riapri-preventivo",
  //  ⚠️ I due link «solo una cosa» che si seguono a vicenda: vedi
  //   proveDelLinkCheSegue.
  "shop/segue-contenuto",
  //  ⚠️ La camera del consulente sui due link «solo una cosa»: le regole di chi
  //   offre a chi. Si prova QUI perché una connessione WebRTC vera vuole due
  //   browser e due reti: vedi proveDellaCameraSuiLink.
  "shop/camera-link-protocollo",
  //  ⚠️ Chi bussa è nuovo o è sempre lui: da questa risposta dipende se la
  //   campana suona una volta o ogni quattro secondi. Vedi proveDellaBussata.
  "shop/bussata",
  "preventivi/duplica",
  //  ⚠️ Quale preventivo cita la fattura: senza questa regola tre fatture su
  //   quattro uscivano senza numero. Vedi proveDelPreventivoCitato.
  "preventivi/dati",
  //  ⚠️ Chi sta rallentando la videochiamata — tu, il cliente, il ponte o il
  //   tuo computer. Si prova QUI perché in una chiamata vera non si può
  //   ordinare al cliente di perdere il 9% dei pacchetti: vedi
  //   proveDellaDiagnosiLinea.
  "shop/diagnosi-linea",
  //  ⚠️ Più di un ospite nella stessa consulenza: chi è l'ospite di
  //   riferimento (la forma dello schermo e «la camera del cliente» devono
  //   seguire lo STESSO), e il conto della linea divisa fra tutti. Vedi
  //   proveDegliOspiti.
  "shop/ospiti",
  //  ⚠️ Una consulenza aperta resta aperta anche se la scheda del consulente si
  //   ricarica: senza questa ripresa il battito si fermava e il cliente non
  //   riusciva nemmeno a bussare. Vedi proveDellaConsulenzaAperta.
  "shop/consulenza-aperta",
  //  ⚠️ Dove compare «fai entrare»: sulle schermate della consulenza sempre,
  //   sul gestionale solo se non la sta guardando nessun altro. Vedi
  //   proveDiDoveSiAmmette.
  "shop/dove-si-ammette",
  //  ⚠️ Come si dispongono le camere in videochiamata: da qui dipende se lo
  //   schermo è pieno o mezzo vuoto. Vedi proveDellaGrigliaCamere.
  "shop/griglia-camere",
  //  ⚠️ Che cosa si prova quando la camera non si apre: senza questa scala una
  //   webcam scollegata portava via anche la voce. Vedi proveDellAperturaCamera.
  "shop/apertura-camera",
  //  ⚠️ Le condizioni con cui un preventivo è nato: il documento consegnato
  //   non cambia da solo, e «modifica preventivo» riparte da quelle di oggi.
  //   Vedi proveDelleCondizioni.
  "shop/condizioni-preventivo",
  //  ⚠️ Il numero di un preventivo finisce nei link e nelle chiavi di
  //   configurazione, la causale è la riga che il cliente copia nel bonifico.
  //   Vedi proveDelNumeroEDellaCausale.
  "shop/numero-preventivo",
  "shop/causale-bonifico",
  "shop/causale-di-un-preventivo",
  //  ⚠️ Quali registrazioni sono di questo cliente: due fili dichiarati (il
  //   lead e il suo preventivo) e nessuna ipotesi sul nome. Vedi
  //   proveDelleRegistrazioni.
  "registrazioni-del-lead",
  //  ⚠️ La porta d'ingresso della consulenza: chi bussa, chi entra, e chi non
  //   si fa più vivo. Vedi proveDellaSalaAttesa.
  "shop/sala-attesa",
  //  ⚠️ Che cosa si può scrivere in un preventivo da una rotta aperta (non ha
  //   credenziali e non può averne): vedi proveDellaRigaPulita.
  "shop/riga-preventivo",
  //  ⚠️ Perché una registrazione esce vuota: tre cause, tre rimedi diversi.
  //   Vedi proveDellaRegistrazione.
  "shop/registrazione",
  //  ⚠️ Chi se n'è andato esce dal pannello, chi deve ancora arrivare no.
  //   Vedi proveDiChiEAncoraDentro.
  "shop/chi-e-ancora-dentro",
  //  ⚠️ Quale sia «l'altra camera» quando si preme «gira»: davanti ⇄ dietro.
  //   Vedi proveDelGiraCamera.
  "shop/gira-camera",
  //  ⚠️ Che cosa entra in una copia dei dati e che cosa non ne esce MAI: lo
  //   leggono il gestionale e lo strumento che esporta tutto. Vedi
  //   proveDelleSezioniDiCopia.
  "copia-sezioni",
  //  ⚠️ Per quanto tempo si tiene l'anteprima di un link mandato su WhatsApp:
  //   il messaggio la perdeva dopo un giorno. Vedi proveDellAnteprimaCheDura.
  "shop/anteprima-quanto-dura",
  //  ⚠️ Quale preventivo finisce nel messaggio a chi sta decidendo, e quali
  //   non ci vanno mai. Vedi proveDeiLinkNeiMessaggi.
  "preventivi/link-nei-messaggi",
  //  ⚠️ Più persone nella stessa consulenza: quando due appuntamenti sono la
  //   stessa stanza, e chi è atteso dentro. Vedi proveDellaFascia.
  "fascia-consulenza",
  //  ⚠️ I preventivi quando sono in più di uno: le stanze, la penna, e che
  //   cosa vede ciascuno. Vedi proveDeiPreventiviDiGruppo.
  "shop/preventivi-di-gruppo",
  "shop/errori-esterni",
  //  ⚠️ La precedenza del preventivo personale: chi la alza, chi la ascolta.
  //   Vedi proveDellaPrecedenza.
  "shop/mio-preventivo",
  //  ⚠️ Chi ha il microfono spento dal consulente: una memoria sola per i due
  //   posti che la mostrano. Vedi proveDeiMuti.
  "shop/ospiti-muti",
  //  ⚠️ La scheda del cliente rimasta a ieri: come se ne accorge da sola.
  //   Vedi proveDellaVersioneVecchia.
  "shop/versione-vecchia",
  //  ⚠️ Il disegno della registrazione: una catena sola, mai due.
  //   Vedi proveDellaTela.
  "shop/tela-registrazione",
  //  ⚠️ Dove si blocca, detto dall'applicazione stessa. Vedi proveDellaLentezza.
  "shop/lentezza",
  //  ⚠️ L'archivio del CRM non si riscarica tutto a ogni apertura.
  //   Vedi proveDellaCopiaArchivio.
  "copia-archivio",
  //  ⚠️ Quando serve il motore della consulenza (400 kB): vedi proveDelMotore.
  "shop/link-ospite",
  //  ⚠️ Un link per ciascuno dentro la stessa stanza. Vedi
  //   proveDelLinkPerCiascuno.
  "shop/chi-dal-link",
  "shop/stanza-ancora-vuota",
  "shop/conta-suoni",
  "chi-ha-fissato",
  "importa/reparti",
  //  ⚠️ Il riquadro del cliente che spariva e tornava ogni pochi secondi:
  //   vedi proveDelRestaInLista.
  "shop/resta-in-lista",
  //  ⚠️ La garanzia 15 mesi: o è compresa e sconta il 35%, o la vende un codice
  //   a cifra fissa. Vedi proveDellaGaranzia.
  "shop/garanzia-codici",
  "shop/promo-garanzia",
];
rmSync(dove, { recursive: true, force: true });
mkdirSync(dove, { recursive: true });
for (const m of MODULI) {
  mkdirSync(dirname(join(dove, `${m}.cjs`)), { recursive: true });
  execFileSync(
    "npx",
    [
      "esbuild",
      //  `webinar/` sta in `src/`, `fatture/` dentro `src/crm/`: due rami
      //  diversi, e confonderli fa fallire il bundle di TUTTE le prove.
      m.startsWith("webinar/") || m.startsWith("prova/")
        ? `src/${m}.ts`
        : m.startsWith("shop/") || m === "versione-aperta"
          ? `src/${m}.ts`
        : m.startsWith("fatture/")
          ? `src/crm/${m}.ts`
        : m.startsWith("contabilita-Da") || m.startsWith("contabilita-Avviso")
          ? `src/crm/${m}.tsx`
        //  `dafare/agenda-task` è l'eccezione dichiarata: un .ts puro dentro
        //  la cartella della pagina, perché non tocca niente di React.
        : m === "dafare/agenda-task" || m === "dafare/di-chi" || m === "preventivi/duplica" || m === "preventivi/dati"
          ? `src/crm/${m}.ts`
        //  `dafare/righe` è un .tsx: costruisce righe, non disegna niente, ma
        //  vive nella cartella della pagina e ne segue l'estensione.
        : m.startsWith("dafare/") || m === "ui"
          ? `src/crm/${m}.tsx`

          : `src/crm/${m}.ts`,
      "--bundle",
      "--format=cjs",
      `--outfile=${join(dove, `${m}.cjs`)}`,
      "--loader:.tsx=tsx",
      "--alias:@=./src",
      "--log-level=error",
    ],
    { cwd: radice, stdio: ["ignore", "ignore", "inherit"] },
  );
}
const chiedi = createRequire(import.meta.url);
const mod = Object.fromEntries(MODULI.map((m) => [m, chiedi(join(dove, `${m}.cjs`))]));
const X = mod["fatture/xml"];
const Z = mod["contabilita-pacchetto"];
const E = mod["contabilita-esporta"];
const DS = mod["contabilita-DaSistemare"];
const AV = mod["contabilita-AvvisoScadenza"];
const CM = mod["costi-mese"];
const F24 = mod["contabilita-f24"];
const AF = mod["contabilita-autofattura"];
const FF = mod["contabilita-f24-foglio"];
const RG = mod["contabilita-registri"];
const RGF = mod["contabilita-registri-foglio"];
const RIT = mod["contabilita-ritenute"];

const C = mod["contabilita"];
const REG = mod["contabilita-regimi"];
const R = mod["contabilita-regole"];
const T = mod["contabilita-tracciabilita"];
const S = mod["contabilita-scadenze"];
const F = mod["contabilita-fornitori"];
const RC = mod["contabilita-raccolta"];
const CO = mod["contabilita-consigli"];
const FO = mod["contabilita-foglio"];
const P = mod["contabilita-periodo"];
const PDF = mod["contabilita-pdf"];
const XLS = mod["contabilita-xls"];
const TY = mod["types"];
const QPS = mod["quando-per-stato"];
const CP = mod["costi-pratica"];
const KN = mod["kpi-netto"];
const KC = mod["kpi-calcoli"];
const LA = mod["lead-analytics"];
const DI = mod["webinar/diario"];
const DP = mod["webinar/diagnostica-palco"];
const ME = mod["webinar/menzioni"];
const PT = mod["webinar/palco-tetris"];
const SC = mod["webinar/schermo"];
const CH = mod["webinar/regole-chat"];
const RT = mod["webinar/ritmo"];
const CB = mod["webinar/camera-buia"];
const FG = mod["webinar/fotogrammi"];
const EM = mod["webinar/errori-media"];
const RP = mod["webinar/regia-palco"];
const STP = mod["webinar/stato-palco"];
const VE = mod["webinar/versione"];
const MD2 = mod["webinar/misura-diretta"];
const IS = mod["webinar/iscrizione"];
const SF = mod["webinar/sfu"];
const CR = mod["webinar/conto-alla-rovescia"];
const TG = mod["webinar/tag-chat"];
const WA = mod["whatsapp"];
const DF = mod["dafare/righe"];
const UI = mod["ui"];
const CL = mod["prova/classifica"];
const CD = mod["prova/codici"];
const PK = mod["prova/pacchetti"];
const PGC = mod["shop/pagina-condivisa"];
const SPC = mod["prova/specchio"];
const RTC = mod["prova/ritocchi"];
const PIP = mod["shop/pip-misure"];
const ORA = mod["shop/oratore"];
const CHS = mod["shop/chiave-sessione"];
const BZZ = mod["shop/bozza"];
const ZOM = mod["shop/zoom-passi"];
const BND = mod["shop/banda"];
const SGV = mod["shop/soglia-voce"];
const STZ = mod["stanza-consulenza"];
const BKG = mod["booking-utils"];
const QMN = mod["shop/quote-menu"];
const CDR = mod["shop/codice-diretta"];
const AMB = mod["shop/ambito-listino"];
const PSC = mod["patch-scheda"];
const VER = mod["versione-aperta"];
const CHI = mod["dafare/di-chi"];
const RIA = mod["shop/riapri-preventivo"];
const SEG = mod["shop/segue-contenuto"];
const CML = mod["shop/camera-link-protocollo"];
const BUS = mod["shop/bussata"];
const CAP = mod["shop/consulenza-aperta"];
const DSA = mod["shop/dove-si-ammette"];
const GRC = mod["shop/griglia-camere"];
const APC = mod["shop/apertura-camera"];
const CND = mod["shop/condizioni-preventivo"];
const NUM = mod["shop/numero-preventivo"];
const CAU = mod["shop/causale-bonifico"];
const CDP = mod["shop/causale-di-un-preventivo"];
const SAL = mod["shop/sala-attesa"];
const FAS = mod["fascia-consulenza"];
const PDG = mod["shop/preventivi-di-gruppo"];
const MUTI = mod["shop/ospiti-muti"];
const EXT = mod["shop/errori-esterni"];
const MIO = mod["shop/mio-preventivo"];
const VEC = mod["shop/versione-vecchia"];
const TELA = mod["shop/tela-registrazione"];
const LEN = mod["shop/lentezza"];
const COP = mod["copia-archivio"];
const LNK = mod["shop/link-ospite"];
const RIL = mod["shop/resta-in-lista"];
const GAR = mod["shop/garanzia-codici"];
const PGA = mod["shop/promo-garanzia"];
const RGP = mod["shop/riga-preventivo"];
const RGZ = mod["shop/registrazione"];
const DENTRO = mod["shop/chi-e-ancora-dentro"];
const GIRA = mod["shop/gira-camera"];
const LINKCHI = mod["shop/chi-dal-link"];
const VUOTA = mod["shop/stanza-ancora-vuota"];
const SUONI = mod["shop/conta-suoni"];
const FISSA = mod["chi-ha-fissato"];
const REP = mod["importa/reparti"];
const COPIA = mod["copia-sezioni"];
const ANT = mod["shop/anteprima-quanto-dura"];
const LNM = mod["preventivi/link-nei-messaggi"];
const RDL = mod["registrazioni-del-lead"];
const DUP = mod["preventivi/duplica"];
const PDT = mod["preventivi/dati"];
const DGL = mod["shop/diagnosi-linea"];
const OSP = mod["shop/ospiti"];
const SPM = mod["spostamento-meet"];
const DOPPI = mod["doppioni"];
const RIC = mod["importa/ricarico"];
const RIP = mod["importa/ripesca"];
const STAB = mod["importa/elenco-stabile"];
const NOTA = mod["importa/nota-breve"];
const TELEF = mod["importa/da-telefonare"];
const TEL = mod["telefono-doppio"];
const SESS = mod["sessione-pin"];
const INVITO = mod["invito"];
const MTL = mod["meta-leadgen"];
const LSC = mod["shop/listino-condiviso"];
const LAT = mod["prova/laterali"];
const CMP = mod["prova/composto"];
const SOM = mod["prova/somiglianza"];
const AGT = mod["dafare/agenda-task"];
const LAV = mod["lavori"];
const PRM = mod["permessi"];
const IMP = mod["import-backup"];
const MDL = mod["modulo-lead"];
const CLC = mod["clic-liberi"];
const RSL = mod["kpi/risposte-lead"];
const QST = mod["quando-stato"];
const LVA = mod["lavori-attivi"];
const SCR = mod["scritti"];
const PC = mod["prova/tagli"];
const WB = mod["webinar/tipi"];
const RL = mod["ricerca-lead"];
const MD = mod["fatture/messaggio-dati"];
const MODI = mod["fatture/modi-di-incasso"];
const FC = mod["fatture/conti"];
const FT = mod["fatture/tipi"];
const LD = mod["fatture/lettura-documento"];
const FCL = mod["fatture/conto-lead"];
const CIN = mod["canale-incasso"];
const CF = mod["codice-fiscale"];
const ICS = mod["installazioni-csv"];
const GR = mod["webinar/griglia"];
const MI = mod["webinar/messaggio-invito"];
const SP = mod["webinar/segui-parole"];

/** ── LA VALIDAZIONE CONTRO LO SCHEMA ──────────────────────────────────────
 *  Torna `"ok"`, oppure il motivo per cui lo SDI lo scarterebbe. Se sul
 *  sistema non c'e' xmllint torna `"ok"` dicendolo: meglio una prova saltata e
 *  dichiarata che una prova che finge. */
function validaSchema(xml, nome) {
  const f = join(dove, nome);
  writeFileSync(f, xml, "utf8");
  try {
    execFileSync("xmllint", ["--noout", "--schema", SCHEMA, f], {
      stdio: ["ignore", "ignore", "pipe"],
    });
    return "ok";
  } catch (e) {
    if (e?.code === "ENOENT") {
      console.log("       (xmllint non installato: validazione contro lo schema saltata)");
      return "ok";
    }
    return String(e.stderr ?? e.message)
      .split("\n")
      .find((r) => r.includes("Schemas validity error") || r.includes("fails to validate"))
      ?.slice(0, 160);
  }
}

/* ── 2. IL MINIMO PER DIRE SÌ O NO ────────────────────────────────────── */
let fatti = 0;
let rotti = 0;
const gruppo = (t) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 62 - t.length))}`);
const uguali = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function c(nome, atteso, letto) {
  fatti++;
  const bene =
    typeof atteso === "number" && typeof letto === "number"
      ? Math.abs(atteso - letto) < 0.005
      : uguali(atteso, letto);
  if (!bene) rotti++;
  console.log(
    (bene ? "  ok  " : "  NO  ") +
      nome.padEnd(54) +
      (bene ? "" : `atteso ${JSON.stringify(atteso)}, letto ${JSON.stringify(letto)}`),
  );
}

const fattura = (x) => ({
  id: "x",
  fornitore: "F",
  partitaIva: "",
  data: "2026-07-01",
  numero: "1",
  imponibile: 0,
  imposta: 0,
  totale: 0,
  righe: [],
  originale: "",
  nomeFile: "",
  aMano: true,
  caricataIl: "",
  ...x,
});

/* ═══ LEGGERE UN PDF ═══════════════════════════════════════════════════ */
const leggi = async (buf) => {
  const l = await PDF.leggiPdf(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  return l;
};
const NOSTRI = { partitaIva: "18486531009", codiceFiscale: "18486531009" };

async function proveDelPdf() {
  gruppo("LEGGERE UN PDF");

  const meta = await leggi(
    pdfStampato([
      "Meta Platforms Ireland Limited",
      "Merrion Road, Dublin 4, Ireland",
      "VAT Reg. No. IE9692928F",
      "Invoice number 250918473921",
      "Invoice date Jul 31, 2026",
      "Description Facebook Ads",
      "Amount (excl. VAT) EUR 1.842,30",
      "VAT 0,00",
      "Total EUR 1.842,30",
      "Reverse charge - VAT to be accounted by the customer",
    ]),
  );
  c("il testo esce come si vede a schermo", true, meta.testo.startsWith("Meta Platforms Ireland"));
  const m = PDF.proponiDalTesto(meta.testo, NOSTRI);
  c("fornitore", "Meta Platforms Ireland Limited", m.fornitore);
  c("partita IVA europea", "IE9692928F", m.partitaIva);
  c("paese", "IE", m.paese);
  c("regime, dal fornitore noto", "ue_servizi", m.regime);
  c("data all'inglese: Jul 31, 2026", "2026-07-31", m.data);
  c("numero", "250918473921", m.numero);
  c("imponibile", 1842.3, m.imponibile);
  c("nessuna imposta: e' in inversione contabile", undefined, m.imposta);
  c("cosa e' stato comprato", "Facebook Ads", m.descrizione);

  /*  ⚠️ IL CASO CHE SI ERA PERSO: etichetta sopra, cifra sotto. È come stampa
      questo CRM le sue fatture, ed è quello che il committente ha dovuto
      segnalare due volte. */
  const colonne = await leggi(
    pdfFontRitagliato([
      "Studio Rossi Commercialisti S.t.p.",
      "Via Nazionale 4, 00184 Roma",
      "P. IVA 09876543210",
      "FATTURA",
      "412/2026",
      "DATA FATTURA",
      "12 agosto 2026",
      "Consulenza contabile trimestre",
      "Imponibile",
      "800,00",
      "IVA",
      "176,00",
      "Totale",
      "976,00",
    ]),
  );
  c("un font ritagliato dentro un ObjStm si legge", true, colonne.ok);
  const k = PDF.proponiDalTesto(colonne.testo, NOSTRI);
  c("numero con l'etichetta sopra e il valore sotto", "412/2026", k.numero);
  c("imponibile incolonnato", 800, k.imponibile);
  c("imposta incolonnata", 176, k.imposta);
  c("partita IVA italiana, senza sigla davanti", "09876543210", k.partitaIva);
  c("regime italiano", "italiana", k.regime);
  c("«DATA FATTURA» non diventa il numero", true, k.numero !== "12");

  const nc = PDF.proponiDalTesto(
    (
      await leggi(
        pdfStampato([
          "Meta Platforms Ireland Limited",
          "VAT Reg. No. IE9692928F",
          "Credit Note",
          "Credit note number 250918999001",
          "Date Jul 31, 2026",
          "Advertising credit - account 8891",
          "Amount (excl. VAT) EUR 240,00",
        ]),
      )
    ).testo,
  );
  c("la nota di credito si riconosce", true, nc.notaDiCredito);
  c("e il suo numero pure", "250918999001", nc.numero);

  const nostra = PDF.proponiDalTesto(
    (
      await leggi(
        pdfStampato([
          "EMESSA DA",
          "HAIR GENIUS LABS S.R.L.S.",
          "P.IVA 18486531009",
          "INTESTATA A",
          "Enrico Livono",
          "C.F. LVNNRC80A01H501X",
          "Totale",
          "2350,00",
        ]),
      )
    ).testo,
    NOSTRI,
  );
  c("una NOSTRA fattura si riconosce", true, nostra.emessaDaNoi);

  const dogana = PDF.proponiDalTesto(
    (
      await leggi(
        pdfStampato([
          "Shenzhen Hair Technology Co., Ltd",
          "Alibaba.com order 88213004",
          "Invoice No. SZ-2026-0417",
          "Date 24/06/2026",
          "Human hair bundles 200 pcs",
          "Weight 22 kg - Shipping DHL",
          "Subtotal USD 3,450.00",
          "Total USD 3,730.00",
        ]),
      )
    ).testo,
  );
  c("merce cinese: importazione", "importazione", dogana.regime);
  /*  ⚠️ E NON DIVENTA UNA FATTURA DI CORRIERE per via del «Shipping DHL»
      scritto fra le righe. È successo davvero appena aggiunti i corrieri
      all'elenco dei fornitori noti, e la conseguenza non era piccola: il
      regime spariva, e un'importazione dalla Cina veniva trattata come una
      fattura italiana con l'IVA da detrarre. Chi EMETTE sta scritto in cima;
      chi compare in mezzo è roba comprata. */
  c("e non la scambia per una fattura DHL", true, !/dhl/i.test(dogana.fornitore ?? ""));

  const corriere = PDF.proponiDalTesto(
    (
      await leggi(
        pdfStampato([
          "FedEx Express Italy S.r.l.",
          "Via Zanica 3, Bergamo",
          "Fattura n. 8842119 del 12/08/2026",
          "Trasporto internazionale non imponibile art. 9",
          "Anticipazione IVA doganale art. 15",
          "Totale EUR 214,60",
        ]),
      )
    ).testo,
    NOSTRI,
  );
  //  ⚠️ Si riconosce dall'AVVERTENZA, non dal nome: l'entrata dei corrieri
  //   lascia il nome vuoto apposta (ce ne sono dieci e li scrive il documento).
  //   Quello che aggiunge e' il richiamo a guardare le righe.
  c(
    "un corriere che emette DAVVERO si riconosce",
    true,
    /corriere/i.test(corriere.spiega.join(" ")),
  );
  c(
    "e avvisa dell'IVA doganale anticipata",
    true,
    /art\. 15|anticipat/i.test(corriere.spiega.join(" ")),
  );
  //  ⚠️ Il regime resta «italiana», che per un corriere italiano e' giusto:
  //   quello che NON si fa e' scriverlo nell'elenco dei noti, perche sulla
  //   stessa fattura convivono trasporti con IVA, trasporti non imponibili
  //   (art. 9) e anticipazioni fuori campo (art. 15). Lo decide chi legge.
  c("il regime resta quello di una fattura italiana", "italiana", corriere.regime);
  c("l'importo resta in valuta, non in euro", 3450, dogana.importoValuta);
  c("e il campo in euro resta vuoto", undefined, dogana.imponibile);

  /*  Le date che si scrivono uguali e vogliono dire cose diverse. */
  c(
    "05/03 su una fattura italiana e' il 5 marzo",
    "2026-03-05",
    PDF.proponiDalTesto("Rossi Srl\nP. IVA 09876543210\nFattura del 05/03/2026\nTotale 10,00").data,
  );
  c(
    "05/03 su una americana e' il 3 maggio",
    "2026-05-03",
    PDF.proponiDalTesto(
      "Acme Inc\n500 Market St\nUnited States\nInvoice 7781\nDate 05/03/2026\nTotal USD 900.00",
    ).data,
  );
  c(
    "senza paese non si indovina",
    undefined,
    PDF.proponiDalTesto("Trading\nInvoice 998\nDate 05/03/2026\nTotal 900.00").data,
  );

  const protetto = await leggi(pdfProtetto());
  c("un PDF protetto viene rifiutato", false, protetto.ok);
  c("e lo dice, invece di chiamarlo scansione", true, protetto.motivo.includes("protetto"));
  const scan = await leggi(pdfScansione());
  c("una scansione viene rifiutata", false, scan.ok);
  c("e lo dice", true, scan.motivo.includes("scansione"));
}

/* ═══ I REGIMI ═════════════════════════════════════════════════════════ */
function proveDeiRegimi() {
  gruppo("COSA PORTA IN CONTABILITÀ UN REGIME");
  const meta = fattura({ regime: "ue_servizi", imponibile: 1842.3, aliquotaReverse: 22 });
  c("servizi UE: costo al netto", 1842.3, F.effettiContabili(meta).costo);
  c("servizi UE: niente detrazione dal documento", 0, F.effettiContabili(meta).ivaDetraibile);
  c("servizi UE: autoliquida il 22%", 405.31, F.effettiContabili(meta).ivaAutoliquidata);
  c("servizi UE: TD17 e INTRASTAT", true, REG.adempimento("ue_servizi").includes("TD17"));
  c("beni UE: TD18", true, REG.adempimento("ue_beni").includes("TD18"));
  c(
    "beni esteri gia' in Italia: TD19",
    true,
    REG.adempimento("estero_beni_italia").includes("TD19"),
  );
  c("inversione interna: TD16", true, REG.adempimento("reverse_interno").includes("TD16"));

  const cina = fattura({ regime: "importazione", imponibile: 3730, totale: 3730 });
  c("importazione: costo intero", 3730, F.effettiContabili(cina).costo);
  c("importazione: nessuna IVA detraibile", 0, F.effettiContabili(cina).ivaDetraibile);
  c("importazione: non autoliquida", 0, F.effettiContabili(cina).ivaAutoliquidata);

  const ita = fattura({ regime: "italiana", imponibile: 800, imposta: 176, totale: 976 });
  c("italiana: costo lordo", 976, F.effettiContabili(ita).costo);
  c("italiana: detrae l'imposta scritta", 176, F.effettiContabili(ita).ivaDetraibile);

  c(
    "il vecchio «reverse» autoliquida ancora",
    110,
    F.effettiContabili(fattura({ regime: "reverse", imponibile: 500 })).ivaAutoliquidata,
  );
  c("ma chiede di essere precisato", true, REG.adempimento("reverse").includes("precisare"));
  const ignoto = fattura({ regime: "marziano", imponibile: 100, imposta: 22, totale: 122 });
  c("un regime sconosciuto non fa detrarre", 0, F.effettiContabili(ignoto).ivaDetraibile);

  c("IE con importazione extra-UE stona", true, REG.stonatura("IE", "importazione").length > 0);
  c("IE con servizi UE no", "", REG.stonatura("IE", "ue_servizi"));
  c("il Regno Unito e' fuori dall'Unione", false, REG.PAESI_UE.has("GB"));

  gruppo("LE NOTE DI CREDITO");
  const nc = fattura({
    regime: "italiana",
    imponibile: 200,
    imposta: 44,
    totale: 244,
    notaDiCredito: true,
  });
  c("costo negativo", -244, F.effettiContabili(nc).costo);
  c("toglie anche IVA a credito", -44, F.effettiContabili(nc).ivaDetraibile);
  const ncUe = fattura({
    regime: "ue_servizi",
    imponibile: 500,
    totale: 500,
    aliquotaReverse: 22,
    notaDiCredito: true,
  });
  c(
    "in inversione contabile toglie da tutti e due i lati",
    -110,
    F.effettiContabili(ncUe).ivaAutoliquidata,
  );
  c(
    "e sull'importazione",
    -300,
    F.effettiContabili(
      fattura({ regime: "importazione", imponibile: 300, totale: 300, notaDiCredito: true }),
    ).costo,
  );

  gruppo("COME HAI PAGATO, SOLO DOVE CONTA");
  c("consulenza: non lo chiede", false, T.serveIlMetodo("Studio Rossi", "consulenza").serve);
  c("pubblicita': non lo chiede", false, T.serveIlMetodo("Meta Platforms Ireland", "Ads").serve);
  c(
    "il gas del contatore: non lo chiede",
    false,
    T.serveIlMetodo("Italgas", "fornitura gas metano").serve,
  );
  c("rifornimento: lo chiede", true, T.serveIlMetodo("Q8 Easy", "rifornimento").serve);
  c(
    "hotel in trasferta: lo chiede",
    true,
    T.serveIlMetodo("Hotel Excelsior", "pernottamento").serve,
  );
  c(
    "carburante in contanti: bloccato",
    true,
    T.bloccoDiLegge("contanti", "Q8 rifornimento").length > 0,
  );
  c("carburante con carta: libero", "", T.bloccoDiLegge("carta", "Q8 rifornimento"));
  c("metodo mai chiesto: nessun blocco", "", T.bloccoDiLegge(undefined, "Q8 rifornimento"));
}

/* ═══ IL CONTO ═════════════════════════════════════════════════════════ */
/* ═══ TORNARE INDIETRO SU UNA POSA ESEGUITA ════════════════════════════
   ⚠️ Il committente: «faccio tornare un'installazione completata allo stato
   precedente e il lead si cancella». Non si cancellava, ma spariva dalle
   installazioni — e da dove guardava lui e' la stessa cosa.
   Il motivo: chiudere una posa NON cambia lo stato, scrive `completataIl`.
   Quindi `statoPrecedente` non e' lo stato di prima della CHIUSURA, e' quello
   di prima della VENDITA. Tornarci sopra toglieva la pratica dai vinti.
   Qui si tiene ferma la regola su cui poggia la correzione. */
function proveDelRitornoPosa() {
  gruppo("TORNARE INDIETRO SU UNA POSA ESEGUITA");
  const venduto = {
    stato: "posa_in_sede",
    statoPrecedente: "appuntamento_fissato",
    installazione: { dataInstallazione: "2026-08-01", completataIl: "2026-08-01" },
  };
  c("una posa con completataIl risulta eseguita", true, TY.posaFatta(venduto));
  //  ⚠️ Togliendo SOLO completataIl la posa torna da fare e lo stato resta
  //   quello della vendita: e' esattamente quello che ora fa il pulsante.
  const riaperta = {
    ...venduto,
    installazione: { dataInstallazione: "2026-08-01" },
  };
  c("togliendo completataIl torna da fare", false, TY.posaFatta(riaperta));
  c("e lo stato della vendita non si tocca", "posa_in_sede", riaperta.stato);
  c("quindi resta fra i vinti", true, TY.STATI_VINTI.includes(riaperta.stato));
  /*  ⚠️ LA PROVA DEL DANNO EVITATO: se invece si fosse scritto lo stato
      PRECEDENTE, la pratica sarebbe uscita dai vinti — cioe' dalle
      installazioni, dai conti del mese e dall'attribuzione della campagna. */
  c(
    "mentre lo stato precedente NON e' un vinto",
    false,
    TY.STATI_VINTI.includes(venduto.statoPrecedente),
  );
}

/* ═══ UN PACCO NON HA UN INSTALLATORE ══════════════════════════════════
   ⚠️ Chiesto dal committente. Non e un vezzo contabile: i costi di
   installatore e parrucchiere restavano scritti da quando la pratica era una
   posa, il margine continuava a sottrarli, e ogni pacco risultava meno
   redditizio del vero. Su un impianto spedito a 240 con 50 di installatore e
   25 di parrucchiere sono 75 euro di utile che non esistono. */
/* ═══ QUANDO SI E CHIUSA, E COSA CONTA COME CHIUSURA ═══════════════════
   ⚠️ Chiesto dal committente: «deve tracciare tutte le chiusure reali in base
   al filtro tempo» e «per chiusure si intende basta che l'acconto sia
   incassato». Sono due cambi diversi e tutti e due toccano il fatturato. */
function proveDelleChiusure() {
  gruppo("QUANDO UNA VENDITA CONTA");

  /*  ── DA DOVE SONO ENTRATI I SOLDI ──────────────────────────────────────
      E' informazione di CASSA: quanto e' passato dalla banca e quanto dal
      cassetto, che e' la domanda di chi a fine mese deve far quadrare i due.
      ⚠️ NON SI DEDUCE NIENTE: una scheda su cui nessuno ha registrato il
       canale non si legge come «tutto tracciato» ne' come «tutto contanti» —
       un numero inventato in un riepilogo di cassa e' peggio di uno mancante. */
  const canale = KN.canaleIncasso;
  c("legge i due canali", 200, canale({ data: { payment: { incassoTracciato: 200, incassoContanti: 100 } } }).tracciato);
  c("e i contanti", 100, canale({ data: { payment: { incassoTracciato: 200, incassoContanti: 100 } } }).contanti);
  c("dice che e' stato registrato", true, canale({ data: { payment: { incassoContanti: 0 } } }).registrato);
  c("e quando non lo e'", false, canale({ data: { payment: { accontoPagato: 500 } } }).registrato);
  c("una scheda senza pagamenti non rompe niente", false, canale({ data: {} }).registrato);
  c("e non inventa cifre", 0, canale({ data: {} }).tracciato);

  //  1. LA DATA: prima vinceva l'ingresso del lead, adesso la chiusura.
  const l = (d) => ({ id: "x", data: d });
  c(
    "vince convertedAt",
    "2026-08-20",
    KN.dataChiusura(l({ createdAt: "2026-03-01", convertedAt: "2026-08-20T10:00:00Z" })),
  );
  //  ⚠️ Il ripiego serve alle schede chiuse prima che convertedAt esistesse:
  //   senza, sparirebbero da tutti i periodi.
  c(
    "poi il giorno del pagamento",
    "2026-06-02",
    KN.dataChiusura(l({ createdAt: "2026-03-01", payment: { dataPagamento: "2026-06-02" } })),
  );
  c(
    "e solo dopo la posa fatta",
    "2026-07-11",
    KN.dataChiusura(l({ createdAt: "2026-03-01", installazione: { completataIl: "2026-07-11" } })),
  );
  /*  ⚠️ LA PROVA DELL'ERRORE GIA FATTO, e vale piu delle altre. Il caso vero:
      pagata il 30 luglio, montata il 1 settembre. La data della posa e una
      data di CONSEGNA, non di cassa — attribuirci l'incasso gonfia il mese in
      cui si lavora e svuota quello in cui si e venduto. Il committente se n'e
      accorto in mezz'ora: 1.980 euro dentro «oggi» che erano di luglio. */
  c(
    "il pagamento batte la posa, sempre",
    "2026-07-30",
    KN.dataChiusura(
      l({
        createdAt: "2026-07-17",
        payment: { dataPagamento: "2026-07-30" },
        installazione: { completataIl: "2026-09-01" },
      }),
    ),
  );
  c("e solo in ultimo l'ingresso", "2026-03-01", KN.dataChiusura(l({ createdAt: "2026-03-01" })));

  //  2. COSA CONTA: basta l'acconto incassato.
  c("uno stato vinto e' una chiusura", true, KC.eConversione(l({ stato: "posa_in_sede" })));
  /*  ⚠️ LA RIGA CHE MANCAVA: una scheda con dei soldi incassati ma in uno
      stato che l'automatismo non ha toccato — importata, o scritta prima che
      quella regola esistesse — non compariva in nessun periodo. Nessuna somma
      la smentiva, e il fatturato usciva piu basso del vero. */
  c(
    "e lo e' anche un acconto incassato, in qualunque stato",
    true,
    KC.eConversione(l({ stato: "appuntamento_fissato", payment: { accontoPagato: 100 } })),
  );
  c(
    "ma senza soldi e senza stato vinto no",
    false,
    KC.eConversione(l({ stato: "appuntamento_fissato", payment: { accontoPagato: 0 } })),
  );
}

function proveDeiCostiSpedizione() {
  gruppo("I COSTI DI UN PACCO");
  const pacco = {
    stato: "posa_da_spedire",
    installazione: { spedizione: { modo: "spedizione" } },
    payment: { costi: { costoProdotto: 100, costoInstallatore: 50, costoTaglio: 25 } },
  };
  const dopo = TY.applyAutoStatus(pacco);
  c("l'installatore si azzera", 0, dopo.payment.costi.costoInstallatore);
  c("il parrucchiere pure", 0, dopo.payment.costi.costoTaglio);
  c("e ci va il costo del corriere", 8, dopo.payment.costi.costoSpedizione);
  c("l'impianto invece resta", 100, dopo.payment.costi.costoProdotto);
  c("il totale dei costi", 108, CP.totaleCostiPratica(dopo));

  /*  ⚠️ CHI HA GIA CORRETTO IL CORRIERE NON SE LO RITROVA RIPORTATO A 8 al
      salvataggio dopo: e la differenza fra proporre e imporre. */
  const corretto = TY.applyAutoStatus({
    ...pacco,
    payment: { costi: { costoProdotto: 100, costoSpedizione: 12 } },
  });
  c("un corriere gia corretto non si tocca", 12, corretto.payment.costi.costoSpedizione);

  //  ⚠️ E su una POSA non si tocca niente: i due costi ci sono e contano.
  const posa = TY.applyAutoStatus({
    stato: "posa_in_sede",
    installazione: { spedizione: { modo: "sede" } },
    payment: { costi: { costoProdotto: 100, costoInstallatore: 50, costoTaglio: 25 } },
  });
  c("su una posa l'installatore resta", 50, posa.payment.costi.costoInstallatore);
  c("e il parrucchiere pure", 25, posa.payment.costi.costoTaglio);
  c("totale della posa", 175, CP.totaleCostiPratica(posa));
}

function proveDelConto() {
  gruppo("IL CONTO DI UN TRIMESTRE");
  const fornitori = [
    fattura({
      id: "a",
      fornitore: "Meta",
      regime: "ue_servizi",
      imponibile: 1842.3,
      totale: 1842.3,
      aliquotaReverse: 22,
    }),
    fattura({
      id: "b",
      fornitore: "Shenzhen",
      regime: "importazione",
      imponibile: 3730,
      totale: 3730,
    }),
    fattura({
      id: "c",
      fornitore: "Studio Rossi",
      regime: "italiana",
      imponibile: 800,
      imposta: 176,
      totale: 976,
    }),
  ];
  const conto = C.calcolaContoFiscale({
    fatture: [{ imponibile: 20000, imposta: 4400 }],
    costi: RC.costiDaiFornitori(fornitori, () => true),
    regole: {},
    aliquote: C.ALIQUOTE_PREDEFINITE,
  });
  c("autoliquidata", 405.31, conto.ivaAutoliquidata);
  c("a debito = emesse + autoliquidata", 4805.31, conto.ivaADebito);
  c("a credito = detraibile + autoliquidata", 581.31, conto.ivaACredito);
  c("da versare", 4224, conto.ivaDaVersare);
  /*  ⚠️ L'identita' su cui si appoggiano le due righe della pagina: quella che
      hanno pagato i CLIENTI e' il debito meno l'autoliquidata. Se un giorno
      `ivaADebito` smettesse di comprendere l'autoliquidata, la riga «IVA
      incassata dai clienti» direbbe una cifra piu' bassa del vero senza che
      nessuna somma lo smentisca. */
  c(
    "l'IVA dei clienti e' il debito meno l'autoliquidata",
    4400,
    conto.ivaADebito - conto.ivaAutoliquidata,
  );
  c("i costi deducibili non contengono l'IVA detratta", 1842.3 + 3730 + 800, conto.costiDeducibili);
  c("utile = fatturato - costi", 20000 - (1842.3 + 3730 + 800), conto.utileImponibile);
  c(
    "imposte = 27,9% dell'utile",
    Math.round(conto.utileImponibile * 0.279 * 100) / 100,
    conto.imposte,
  );

  gruppo("QUANDO LA LEGGE NE FA DEDURRE SOLO UNA PARTE");
  /*  ⚠️ ⁠Il pranzo di lavoro: 100 euro pagati, 75 dedotti (art. 109 c. 5 TUIR).
      Prima il CRM ne deduceva 100, ed e' un errore SEMPRE dalla stessa parte —
      la propria — cioe' quello che in una verifica si paga con le sanzioni.
      Su cinquanta pranzi l'anno sono milleduecento euro di imponibile. */
  const pranzo = C.calcolaContoFiscale({
    fatture: [{ imponibile: 10000, imposta: 2200 }],
    costi: RC.costiDaiFornitori(
      [
        fattura({
          id: "r",
          fornitore: "Trattoria",
          regime: "italiana",
          imponibile: 100,
          imposta: 0,
          totale: 100,
          percentualeDeducibile: 75,
        }),
      ],
      () => true,
    ),
    regole: {},
    aliquote: C.ALIQUOTE_PREDEFINITE,
  });
  c("del pranzo si deduce il 75%", 75, pranzo.costiDeducibili);
  c("il resto non sparisce: e' costo non deducibile", 25, pranzo.costiNonDeducibili);
  c("l'imponibile scende di 75, non di 100", 10000 - 75, pranzo.utileImponibile);
  /*  ⚠️ E L'UTILE REALE TIENE CONTO DI TUTTI E 100: i soldi sono usciti, e
      questa e' la riga che dice quanto resta davvero in cassa. Se il 25 non
      tornasse qui, il conto direbbe che si e' speso meno di quanto si e'
      speso. */
  c(
    "ma dalla cassa sono usciti tutti e 100",
    Math.round((pranzo.utileDopoLeImposte - 25) * 100) / 100,
    pranzo.utileReale,
  );

  /*  ⚠️ E SENZA percentuale il conto e' identico a prima: era la condizione
      per aggiungere le percentuali senza spostare nessun conto gia' chiuso. */
  const intero = C.calcolaContoFiscale({
    fatture: [{ imponibile: 10000, imposta: 2200 }],
    costi: RC.costiDaiFornitori(
      [
        fattura({
          id: "r",
          fornitore: "Trattoria",
          regime: "italiana",
          imponibile: 100,
          imposta: 0,
          totale: 100,
        }),
      ],
      () => true,
    ),
    regole: {},
    aliquote: C.ALIQUOTE_PREDEFINITE,
  });
  c("senza percentuale si deduce tutto, come prima", 100, intero.costiDeducibili);
  c("e non c'e' niente di non deducibile", 0, intero.costiNonDeducibili);

  /*  ── ⚠️ L'AUTO: I DUE NUMERI SONO DIVERSI, ED E' TUTTO IL PUNTO ────────
      Il costo si deduce al 20% (art. 164 TUIR), l'IVA si detrae al 40%
      (art. 19-bis1 lett. c DPR 633/72). Due articoli diversi, scritti in due
      anni diversi per due ragioni diverse. Un solo numero per tutti e due
      sembra una semplificazione e sbaglia sempre uno dei due conti. */
  const auto = C.calcolaContoFiscale({
    fatture: [{ imponibile: 10000, imposta: 2200 }],
    costi: RC.costiDaiFornitori(
      [
        fattura({
          id: "auto",
          fornitore: "Distributore",
          regime: "italiana",
          imponibile: 100,
          imposta: 22,
          totale: 122,
          percentualeDeducibile: 20,
          percentualeIva: 40,
        }),
      ],
      () => true,
    ),
    regole: { distributore: [{ da: "0000-00", scaricabile: true, ivaDetraibile: true }] },
    aliquote: C.ALIQUOTE_PREDEFINITE,
  });
  //  22 di IVA nel documento, se ne detrae il 40% = 8,80.
  c("dell'IVA dell'auto se ne detrae il 40%", 8.8, auto.ivaACredito);
  /*  ⚠️ E I 13,20 CHE NON SI DETRAGGONO NON SPARISCONO: restano dentro il
      costo, dove la legge li vuole. Il costo pieno diventa 122 - 8,80 =
      113,20, e di quello si deduce il 20% = 22,64. Se l'IVA indetraibile
      finisse in un conto a parte, quei 13,20 non sarebbero ne' detratti ne'
      dedotti — cioe' persi due volte. */
  c("l'IVA non detratta resta dentro il costo", 22.64, auto.costiDeducibili);
  c("e il resto del costo non e' deducibile", 90.56, auto.costiNonDeducibili);
  //  ⚠️ La somma torna: dalla cassa sono usciti 122, e 8,80 tornano dall'IVA.
  c(
    "in tutto dalla cassa restano fuori 113,20",
    113.2,
    Math.round((auto.costiDeducibili + auto.costiNonDeducibili) * 100) / 100,
  );

  gruppo("IL CREDITO IVA CHE AVANZA");
  /*  ⚠️ Il trimestre in cui si compra molto e si fattura poco — il magazzino
      prima della stagione. Non si versa niente, ma quel credito NON sparisce:
      si porta al periodo dopo, e dimenticarlo e' denaro dell'azienda che resta
      allo Stato. */
  const inCredito = C.calcolaContoFiscale({
    fatture: [{ imponibile: 1000, imposta: 220 }],
    costi: RC.costiDaiFornitori(
      [
        fattura({
          id: "m",
          fornitore: "Magazzino",
          regime: "italiana",
          imponibile: 5000,
          imposta: 1100,
          totale: 6100,
        }),
      ],
      () => true,
    ),
    regole: {},
    aliquote: C.ALIQUOTE_PREDEFINITE,
  });
  c("non si versa niente", 0, inCredito.ivaDaVersare);
  c("ma il credito che avanza si dice", 880, inCredito.creditoIvaDaRiportare);
  const inDebito = C.calcolaContoFiscale({
    fatture: [{ imponibile: 10000, imposta: 2200 }],
    costi: [],
    regole: {},
    aliquote: C.ALIQUOTE_PREDEFINITE,
  });
  c("e quando si versa, di credito non ne avanza", 0, inDebito.creditoIvaDaRiportare);
  c(
    "le due cose non sono mai vere insieme",
    true,
    [inCredito, inDebito].every((x) => x.ivaDaVersare === 0 || x.creditoIvaDaRiportare === 0),
  );
  const foglioCredito = FO.costruisciFoglio(
    inCredito,
    C.ALIQUOTE_PREDEFINITE,
    P.costruisciPeriodo("trimestre", 2026, 2),
    AZIENDA,
    {},
  );
  c(
    "e il foglio per il commercialista lo scrive",
    true,
    foglioCredito.includes("Credito IVA che avanza"),
  );

  gruppo("IL CREDITO CHE ARRIVA DAL PERIODO PRIMA");
  /*  ⚠️ Ogni periodo si calcolava da solo, come se prima non fosse successo
      niente. Un trimestre chiuso con 880 € di credito e il successivo con
      4.224 € da versare fanno 3.344, non 4.224: la differenza si versava allo
      Stato per niente, ogni trimestre. */
  const conCredito = (prima) =>
    C.calcolaContoFiscale({
      fatture: [{ imponibile: 20000, imposta: 4400 }],
      costi: [],
      creditoPrecedente: prima,
      regole: {},
      aliquote: C.ALIQUOTE_PREDEFINITE,
    });
  c("senza credito si versa tutto", 4400, conCredito(0).ivaDaVersare);
  c("con 880 di credito si versa 3.520", 3520, conCredito(880).ivaDaVersare);
  c("e il credito usato si vede nel conto", 880, conCredito(880).creditoPrecedente);
  //  ⚠️ Un credito piu' grande del debito non fa un versamento negativo: si
  //   porta avanti quello che resta.
  const tanto = conCredito(6000);
  c("un credito piu' grande del debito non si versa", 0, tanto.ivaDaVersare);
  c("e quello che avanza si riporta", 1600, tanto.creditoIvaDaRiportare);
  c("un credito negativo non si accetta", 4400, conCredito(-500).ivaDaVersare);
  //  ⚠️ E non tocca le imposte sul reddito: l'IVA non e' un costo.
  c("le imposte non cambiano", conCredito(0).imposte, conCredito(880).imposte);

  gruppo("IL DIVIETO DI LEGGE VINCE SULLA SPUNTA");
  const benzina = fattura({
    id: "d",
    fornitore: "Q8 Easy rifornimento",
    regime: "italiana",
    imponibile: 100,
    imposta: 22,
    totale: 122,
    metodoPagamento: "contanti",
  });
  const conto2 = C.calcolaContoFiscale({
    fatture: [{ imponibile: 10000, imposta: 2200 }],
    costi: RC.costiDaiFornitori([benzina], () => true),
    regole: R.conRegola({}, "Q8 Easy rifornimento", {
      da: "0000-00",
      scaricabile: true,
      ivaDetraibile: true,
    }),
    aliquote: C.ALIQUOTE_PREDEFINITE,
  });
  c("non entra fra i deducibili nemmeno se spuntato", 0, conto2.costiDeducibili);
  c("entra fra i non deducibili", 122, conto2.costiNonDeducibili);
  c("nessun credito IVA", 0, conto2.ivaACredito);
  c("abbassa comunque l'utile reale", 10000 - 2790 - 122, conto2.utileReale);

  /*  ⚠️ L'INVARIANTE SU CUI SI APPOGGIA LA PASTIGLIA DELLA PAGINA. La voce
      «vietata per legge» si disegna guardando le righe: se una riga fosse
      bloccata ma ancora `scaricabile`, la pastiglia direbbe verde su un costo
      che il conto esclude. Le due cose devono muoversi insieme. */
  const righeBenzina = conto2.righe.filter((r) => r.bloccoDiLegge);
  c("la riga bloccata porta il perche'", 1, righeBenzina.length);
  c(
    "e non e' scaricabile",
    true,
    righeBenzina.every((r) => r.scaricabile === false),
  );
  c(
    "e la sua IVA non si detrae",
    0,
    righeBenzina.reduce((s2, r) => s2 + r.ivaDetraibile, 0),
  );
  c(
    "nessuna riga e' bloccata E scaricabile insieme",
    0,
    conto2.righe.filter((r) => r.bloccoDiLegge && r.scaricabile).length,
  );

  gruppo("LE REGOLE NEL TEMPO");
  const regole = R.conRegola({}, "Installatore", {
    da: "2026-03",
    a: R.fineDelMese("2026-06"),
    scaricabile: false,
    ivaDetraibile: false,
  });
  const dentro = (d) =>
    C.calcolaContoFiscale({
      fatture: [],
      costi: [{ id: "x", titolo: "Installatore", importo: 500, data: d, origine: "pratica" }],
      regole,
      aliquote: C.ALIQUOTE_PREDEFINITE,
    });
  c("prima dell'intervallo si scarica", 500, dentro("2026-02-10").costiDeducibili);
  c("dentro l'intervallo no", 0, dentro("2026-04-10").costiDeducibili);
  c("dopo l'intervallo torna a scaricarsi", 500, dentro("2026-08-10").costiDeducibili);

  gruppo("IL FOGLIO PER IL COMMERCIALISTA");
  const az = {
    denominazione: "HAIR GENIUS LABS S.R.L.S.",
    partitaIva: "18486531009",
    codiceFiscale: "18486531009",
    indirizzo: "Via",
    civico: "1",
    cap: "00192",
    comune: "Roma",
    provincia: "RM",
    nazione: "IT",
    reaUfficio: "RM",
    reaNumero: "1",
    pec: "x@x.it",
    iban: "IT80",
    regimeFiscale: "RF01",
    serie: "",
    primoNumero: 1,
    annoNumerazione: 2026,
    aliquotaPredefinita: 22,
  };
  const misto = C.calcolaContoFiscale({
    fatture: [{ imponibile: 10000, imposta: 2200 }],
    costi: [
      ...RC.costiDaiFornitori([benzina], () => true),
      { id: "e", titolo: "Installatore", importo: 630, data: "2026-07-10", origine: "pratica" },
    ],
    regole: R.conRegola({}, "Installatore", {
      da: "0000-00",
      scaricabile: false,
      ivaDetraibile: false,
    }),
    aliquote: C.ALIQUOTE_PREDEFINITE,
  });
  const foglio = FO.costruisciFoglio(
    misto,
    C.ALIQUOTE_PREDEFINITE,
    P.costruisciPeriodo("trimestre", 2026, 2),
    az,
    {},
  );
  c(
    "i costi esclusi per legge stanno in una lista loro",
    true,
    foglio.includes("Esclusi per legge"),
  );
  /*  Il credito riportato deve comparire anche sul foglio: senza, il
      commercialista rifa' il conto e trova un'altra cifra. */
  const conRiporto = FO.costruisciFoglio(
    C.calcolaContoFiscale({
      fatture: [{ imponibile: 20000, imposta: 4400 }],
      costi: [],
      creditoPrecedente: 880,
      regole: {},
      aliquote: C.ALIQUOTE_PREDEFINITE,
    }),
    C.ALIQUOTE_PREDEFINITE,
    P.costruisciPeriodo("trimestre", 2026, 2),
    AZIENDA,
    {},
  );
  c("il foglio scrive il credito riportato", true, /Credito IVA riportato/.test(conRiporto));
  c("e senza credito non lo scrive", false, /Credito IVA riportato/.test(foglio));
  c("con la norma accanto", true, foglio.includes("164 c. 1-bis"));
  c(
    "e la frase «per scelta» non li copre",
    false,
    /Q8 Easy[\s\S]{0,300}per scelta del titolare/.test(foglio),
  );
  c("nessun segnaposto rimasto", 0, (foglio.match(/\$\{/g) ?? []).length);
  c("il foglio si chiude", true, foglio.trim().endsWith("</html>"));

  gruppo("I CONSIGLI");
  const consigli = CO.consigli(misto, C.ALIQUOTE_PREDEFINITE, { mesiDelPeriodo: 3 });
  c(
    "ognuno porta norma e controindicazione",
    true,
    consigli.every((x) => x.norma && x.attenzione),
  );
  c("nessun id ripetuto", consigli.length, new Set(consigli.map((x) => x.id)).size);
  c(
    "nessuna stima negativa o NaN",
    true,
    consigli.every((x) => x.vale == null || (Number.isFinite(x.vale) && x.vale >= 0)),
  );
}

/* ═══ IL CALENDARIO ════════════════════════════════════════════════════ */
function proveDelleScadenze() {
  gruppo("IL CALENDARIO FISCALE");
  c("16/05/2026 e' sabato: slitta a lunedi'", "2026-05-18", S.primoGiornoUtile("2026-05-16"));
  c("31/10/2026 sabato e 1/11 festa: slitta al 2", "2026-11-02", S.primoGiornoUtile("2026-10-31"));
  c("28/02/2027 e' domenica", "2027-03-01", S.primoGiornoUtile("2027-02-28"));
  c("Pasquetta 2026 e' il 6 aprile", "2026-04-07", S.primoGiornoUtile("2026-04-06"));
  c("un mercoledi' resta dov'e'", "2026-09-16", S.primoGiornoUtile("2026-09-16"));

  const anno = S.scadenzeDellAnno(2026, "trimestrale");
  c(
    "quattro liquidazioni trimestrali",
    ["2026-05-18", "2026-08-20", "2026-11-16", "2027-03-16"],
    anno.filter((x) => x.tipo === "iva").map((x) => x.giorno),
  );
  c(
    "dodici, se la liquidazione e' mensile",
    12,
    S.scadenzeDellAnno(2026, "mensile").filter((x) => x.tipo === "iva").length,
  );
  c("dodici invii esteri, il 15 di ogni mese", 12, anno.filter((x) => x.tipo === "estero").length);
  c("nessun id ripetuto", anno.length, new Set(anno.map((x) => x.id)).size);
  c(
    "ognuna dice cosa fare in parole normali",
    true,
    anno.every((x) => x.cosa.length > 20),
  );

  c("a 93 giorni il badge e' spento", null, S.badgeScadenza("2026-05-19", "trimestrale"));
  c("a 90 si accende", 90, S.badgeScadenza("2026-05-22", "trimestrale").giorni);
  c("ed e' calmo", "info", S.badgeScadenza("2026-05-22", "trimestrale").urgenza);
  c("a 25 diventa giallo", "oggi", S.badgeScadenza("2026-07-26", "trimestrale").urgenza);
  c("a 7 diventa rosso", "ritardo", S.badgeScadenza("2026-08-13", "trimestrale").urgenza);
  c("il giorno stesso dice zero", 0, S.badgeScadenza("2026-08-20", "trimestrale").giorni);
  c(
    "si avvisa fitto alla fine e rado all'inizio",
    [0, 1, 2, 3, 4, 5, 6, 7, 10, 15, 20, 25],
    Array.from({ length: 31 }, (_, g) => g).filter((g) => S.toccaAvvisare(g)),
  );
  c(
    "nessuna scadenza nel passato",
    true,
    S.prossimeScadenze("2026-08-31", "trimestrale", 20).every((x) => x.mancano >= 0),
  );

  gruppo("QUANDO SI ANNUNCIA UNA SCADENZA");
  /*  Due finestre diverse: venticinque giorni per la liquidazione, che chiude
      un periodo e vuole giorni di lavoro prima; sette per tutte le altre —
      l'invio degli esteri torna il 15 di OGNI mese, e una striscia accesa
      meta' mese si smette di vedere entro la seconda settimana. */
  const annuncio = (g) => AV.daAnnunciare(g, "trimestrale");
  /*  Il 20 luglio non c'e' niente in vista: l'invio degli esteri e' il 17
      agosto (28 giorni, fuori dai sette) e la liquidazione il 20 (31, fuori
      dai venticinque). ⚠️ Non si scelga una data «lontana» a occhio: l'invio
      degli esteri torna il 15 di OGNI mese, e a undici giorni dalla
      liquidazione ce n'e' sempre uno a quattro giorni. */
  c("quando non c'e' niente in vista, non si dice niente", null, annuncio("2026-07-20"));
  c("a 25 si comincia", "iva", annuncio("2026-07-26")?.tipo);
  c("e si dice quale", "IVA 2° trimestre", annuncio("2026-07-26")?.titolo);
  c("l'invio degli esteri si annuncia a 7 giorni", "estero", annuncio("2026-09-09")?.tipo);
  c("a 10 giorni dagli esteri ancora no", null, annuncio("2026-09-05"));
  //  Il 12 agosto: l'invio degli esteri e' il 17, la liquidazione il 20.
  c("fra due, si annuncia la piu' vicina", "estero", annuncio("2026-08-12")?.tipo);
  c("il giorno stesso si annuncia ancora", 0, annuncio("2026-08-20")?.mancano);
  c("il giorno dopo si passa alla prossima", true, (annuncio("2026-08-21")?.mancano ?? 99) > 0);

  gruppo("UNA SCADENZA GIA' FATTA NON INSISTE PIU'");
  /*  ⚠️ Un promemoria che continua a suonare dopo che la cosa e' stata fatta
      smette di essere un promemoria: diventa rumore, e dopo due trimestri lo
      si guarda come un adesivo sul muro. */
  const fatta = { "iva-2026-t2": "2026-08-12" };
  c("prima di segnarla, il badge conta", 15, S.badgeScadenza("2026-08-05", "trimestrale")?.giorni);
  c(
    "segnata, il badge non conta piu' quella",
    true,
    (S.badgeScadenza("2026-08-05", "trimestrale", fatta)?.giorni ?? 999) > 15,
  );
  c(
    "e la striscia passa a un'altra cosa",
    "estero",
    AV.daAnnunciare("2026-08-12", "trimestrale", fatta)?.tipo,
  );
  c(
    "senza segnarla, la striscia direbbe l'IVA",
    "iva",
    AV.daAnnunciare("2026-08-18", "trimestrale")?.tipo,
  );
  c(
    "segnata, il giorno prima non dice piu' niente",
    null,
    AV.daAnnunciare("2026-08-19", "trimestrale", fatta),
  );
  //  ⚠️ Nell'ELENCO della pagina restano: sapere che una cosa e' stata fatta e'
  //   un'informazione, e una scadenza che sparisce fa dubitare di averla spuntata.
  c(
    "ma l'elenco della pagina le mostra ancora",
    true,
    S.prossimeScadenze("2026-08-05", "trimestrale", 10).some((x) => x.id === "iva-2026-t2"),
  );
  c(
    "una scadenza segnata che non esiste non fa danni",
    15,
    S.badgeScadenza("2026-08-05", "trimestrale", { "iva-1999-t9": "2026-01-01" })?.giorni,
  );
}

/* ═══ L'XML CHE VA ALLO SDI ════════════════════════════════════════════ */
const AZIENDA = {
  denominazione: "HAIR GENIUS LABS S.R.L.S.",
  partitaIva: "18486531009",
  codiceFiscale: "18486531009",
  indirizzo: "Via degli Scipioni",
  civico: "132",
  cap: "00192",
  comune: "Roma",
  provincia: "RM",
  nazione: "IT",
  reaUfficio: "RM",
  reaNumero: "1788996",
  pec: "hairlabssrls@pec.it",
  iban: "IT80M3688801600100000029556",
  regimeFiscale: "RF01",
  serie: "",
  primoNumero: 653,
  annoNumerazione: 2026,
  aliquotaPredefinita: 22,
};
const CLIENTE = {
  azienda: false,
  nome: "Enrico",
  cognome: "Livono",
  denominazione: "",
  partitaIva: "",
  codiceFiscale: "LVNNRC80A01H501X",
  indirizzo: "Via Roma",
  civico: "12",
  cap: "00100",
  comune: "Roma",
  provincia: "RM",
  nazione: "IT",
  pec: "",
  codiceDestinatario: "",
};
const EMESSA = {
  cliente: CLIENTE,
  righe: [
    {
      descrizione: "Fornitura impianto capillare",
      quantita: 1,
      prezzoUnitario: 1926.23,
      aliquota: 22,
    },
  ],
  imponibile: 1926.23,
  imposta: 423.77,
  totale: 2350,
  stato: "emessa",
  numero: 653,
  anno: 2026,
  serie: "",
  data: "2026-08-30",
  dataPagamento: "2026-08-30",
  causale: "Conferma ordine - IDS8X4B",
  preventivoRef: "IDS8X4B",
  leadNome: "",
};

function proveDellXml() {
  gruppo("L'XML CHE VA ALLO SDI");
  const xml = X.costruisciXml(EMESSA, AZIENDA);

  /*  ⚠️ BEN FORMATO SUL SERIO, non «sembra a posto». Se il sistema ha
      xmllint — su macOS e su quasi ogni Linux c'è — si fa controllare a lui:
      un XML che non si apre lo SdI lo rifiuta prima ancora di guardarlo. */
  c("passa lo schema ufficiale dell'Agenzia", "ok", validaSchema(xml, "fattura.xml"));

  c("dichiara il tracciato FPR12", true, xml.includes('versione="FPR12"'));
  c("porta il totale del documento", true, xml.includes("<ImportoTotaleDocumento>2350.00<"));
  c("l'imponibile del riepilogo", true, xml.includes("<ImponibileImporto>1926.23<"));
  c("l'imposta del riepilogo", true, xml.includes("<Imposta>423.77<"));
  c("il nostro codice fiscale", true, xml.includes("<IdCodice>18486531009<"));
  c("il codice fiscale del cliente", true, xml.includes("<CodiceFiscale>LVNNRC80A01H501X<"));
  c("la causale", true, xml.includes("Conferma ordine"));

  /*  ── ⚠️ IL MODO DI PAGAMENTO, E L'IBAN SOLO SE C'ENTRA ───────────────
      Segnalazione del committente: «se seleziono POS non deve uscire pagamento
      tramite bonifico sulla fattura». Questo è il file che va all'Agenzia e al
      commercialista: portava l'IBAN del centro su OGNI fattura, anche su un
      incasso al POS o in contanti, ed è il campo con cui i gestionali
      riconciliano gli estratti conto. */
  const xmlPos = X.costruisciXml(
    { ...EMESSA, metodoPagamento: "pos", riferimentoPagamento: "TEUB4XR2M9" },
    AZIENDA,
  );
  c("il POS viaggia come MP08", true, xmlPos.includes("<ModalitaPagamento>MP08<"));
  c("e il codice dell'operazione ha il suo campo", true, xmlPos.includes("<CodicePagamento>TEUB4XR2M9<"));
  c("⚠️ e NON c'è l'IBAN", false, xmlPos.includes("<IBAN>"));
  c("il file resta valido per lo schema", "ok", validaSchema(xmlPos, "fattura-pos.xml"));

  const xmlContanti = X.costruisciXml({ ...EMESSA, metodoPagamento: "contanti" }, AZIENDA);
  c("i contanti viaggiano come MP01", true, xmlContanti.includes("<ModalitaPagamento>MP01<"));
  c("e nemmeno lì c'è l'IBAN", false, xmlContanti.includes("<IBAN>"));

  const xmlBonifico = X.costruisciXml({ ...EMESSA, metodoPagamento: "bonifico" }, AZIENDA);
  c("sul bonifico l'IBAN c'è", true, xmlBonifico.includes("<IBAN>"));
  //  ⚠️ E una fattura vecchia, senza modo, resta un bonifico: non deve
  //   cambiare significato a posteriori.
  c("senza modo scelto l'IBAN resta", true, xml.includes("<IBAN>"));
  /*  ⚠️ Senza PEC e senza codice destinatario il tracciato vuole sette zeri:
      è il caso di ogni privato, cioè quasi tutti i clienti di questo CRM. */
  c(
    "sette zeri quando il cliente non ha un canale",
    true,
    xml.includes("<CodiceDestinatario>0000000<"),
  );

  //  ⚠️ I DECIMALI SI SCRIVONO COL PUNTO, sempre: la virgola è il modo più
  //   veloce per farsi rifiutare il file.
  c("nessuna virgola dentro un importo", 0, (xml.match(/>\d+,\d+</g) ?? []).length);
  c(
    "il nome del file segue il tracciato",
    true,
    /^IT18486531009_[A-Z0-9]{5}\.xml$/.test(X.nomeFileXml(EMESSA, AZIENDA)),
  );

  gruppo("QUELLO CHE LO SDI RIFIUTEREBBE");
  const ok = X.problemiXml(EMESSA, AZIENDA);
  c("una fattura a posto non ha bloccanti", 0, ok.bloccanti.length);

  const cfCorto = X.problemiXml(
    { ...EMESSA, cliente: { ...CLIENTE, codiceFiscale: "F32234234" } },
    AZIENDA,
  );
  c(
    "un codice fiscale di nove caratteri e' bloccante",
    true,
    cfCorto.bloccanti.some((r) => /codice fiscale/i.test(r)),
  );

  const senzaNumero = X.problemiXml({ ...EMESSA, numero: 0 }, AZIENDA);
  c(
    "una fattura senza numero e' bloccante",
    true,
    senzaNumero.bloccanti.some((r) => /numero/i.test(r)),
  );

  const senzaRighe = X.problemiXml({ ...EMESSA, righe: [] }, AZIENDA);
  c("una fattura senza righe e' bloccante", true, senzaRighe.bloccanti.length > 0);

  const pivaStorta = X.problemiXml(EMESSA, { ...AZIENDA, partitaIva: "1234567890" });
  c(
    "una partita IVA di dieci cifre e' bloccante",
    true,
    pivaStorta.bloccanti.some((r) => /partita IVA/i.test(r)),
  );

  /*  ⚠️ IL CASO CHE HA FATTO PERDERE MEZZ'ORA: la partita IVA incollata da un
      PDF si porta dietro dei caratteri invisibili (U+202D, U+202C). A occhio è
      identica, e il controllo la rifiutava. Si giudica la stringa PULITA. */
  const invisibili = X.problemiXml(EMESSA, {
    ...AZIENDA,
    partitaIva: "\u202d18486531009\u202c",
  });
  c("i caratteri invisibili non fanno fallire il controllo", 0, invisibili.bloccanti.length);
  c(
    "e non finiscono nel file",
    false,
    X.costruisciXml(EMESSA, { ...AZIENDA, partitaIva: "\u202d18486531009\u202c" }).includes(
      "\u202d",
    ),
  );

  gruppo("GLI ARROTONDAMENTI");
  const tre = {
    ...EMESSA,
    righe: [
      { descrizione: "A", quantita: 3, prezzoUnitario: 33.333, aliquota: 22 },
      { descrizione: "B", quantita: 1, prezzoUnitario: 0.005, aliquota: 22 },
    ],
  };
  const x2 = X.costruisciXml(tre, AZIENDA);
  const somma = [...x2.matchAll(/<ImponibileImporto>([\d.]+)</g)].reduce(
    (s, m) => s + Number(m[1]),
    0,
  );
  const totale = Number(x2.match(/<ImportoTotaleDocumento>([\d.]+)</)?.[1] ?? 0);
  const imposte = [...x2.matchAll(/<Imposta>([\d.]+)</g)].reduce((s, m) => s + Number(m[1]), 0);
  c(
    "imponibile + imposta = totale, al centesimo",
    true,
    Math.abs(somma + imposte - totale) < 0.005,
  );
  c("nessun importo con piu' di due decimali", 0, (x2.match(/>\d+\.\d{3,}</g) ?? []).length);
}

/* ═══ COSA ENTRA IN CONTABILITÀ DALLE PRATICHE ═════════════════════════ */
function proveDellePratiche() {
  gruppo("I COSTI DELLE PRATICHE");
  const pratica = (id, stato, costi, giorno = "2026-07-10") => ({
    id,
    data: {
      nome: id,
      cognome: "Rossi",
      stato,
      createdAt: `${giorno}T09:00:00Z`,
      payment: { costi },
    },
  });
  const costi = { costoProdotto: 1200, costoInstallatore: 630, costoTaglio: 180 };
  const leads = [
    pratica("venduta", "venduto", costi),
    pratica("acconto", "acconto", costi),
    //  ⚠️ LA SCHEDA NON CONVERTITA È IL CUORE DI QUESTA PROVA. Le sue voci di
    //   costo esistono lo stesso — il preventivo le mette di default su TUTTE
    //   le schede — ma quei soldi non sono mai usciti. Contandole, un giorno,
    //   sono comparsi 139.000 € di costi che non c'erano, su ottocento
    //   trattative aperte. Il filtro è `eConversione`: chi lo toglie fa
    //   risultare una perdita a una società che sta guadagnando.
    pratica("solo_contattata", "da_contattare", costi),
    pratica("persa", "perso", costi),
  ];
  const dentro = () => true;
  const raccolti = RC.costiDallePratiche(leads, dentro);
  c(
    "entrano solo le pratiche vinte",
    ["venduta", "acconto"],
    [...new Set(raccolti.map((x) => x.leadId))],
  );
  c("tre voci per pratica", 6, raccolti.length);
  c("l'impianto c'e'", 1200, raccolti.find((x) => x.titolo === "Impianto")?.importo);
  c("il costo porta la data della pratica", "2026-07-10", raccolti[0].data);
  c("e il nome del cliente, per sapere di chi e'", "venduta Rossi", raccolti[0].dettaglio);
  c(
    "in tutto: due pratiche, non quattro",
    (1200 + 630 + 180) * 2,
    raccolti.reduce((s, x) => s + x.importo, 0),
  );

  //  Il filtro del periodo taglia prima del filtro sulle vinte.
  const soloLuglio = RC.costiDallePratiche(
    [...leads, pratica("vecchia", "venduto", costi, "2025-01-04")],
    (d) => String(d ?? "").startsWith("2026-07"),
  );
  c("una vendita di un altro anno resta fuori", 6, soloLuglio.length);

  gruppo("GLI INCASSI REGISTRATI SENZA IVA");
  const registro = [
    {
      id: "1",
      data: "2026-07-05",
      importo: 1000,
      modoIva: "inclusa",
      aliquota: 22,
      imposta: 180.33,
    },
    { id: "2", data: "2026-07-06", importo: 500, modoIva: "senza", aliquota: 0, imposta: 0 },
    { id: "3", data: "2026-09-01", importo: 300, modoIva: "senza", aliquota: 0, imposta: 0 },
  ];
  const diLuglio = (d) => String(d ?? "").startsWith("2026-07");
  c("solo quelli senza IVA, e solo del periodo", 500, C.incassiSenzaIvaDi(registro, diLuglio));
  c("una scheda senza registro vale zero", 0, C.incassiSenzaIvaDi(undefined, diLuglio));

  /*  ⚠️ Non gonfiano l'imponibile — su quei soldi non si pagano imposte — ma
      tornano interi dentro l'utile reale. È tutto il senso di come sono stati
      registrati, e le due cose vanno controllate insieme. */
  const senza = C.calcolaContoFiscale({
    fatture: [{ imponibile: 10000, imposta: 2200 }],
    costi: [],
    incassiSenzaIva: 500,
    regole: {},
    aliquote: C.ALIQUOTE_PREDEFINITE,
  });
  const con = C.calcolaContoFiscale({
    fatture: [{ imponibile: 10000, imposta: 2200 }],
    costi: [],
    regole: {},
    aliquote: C.ALIQUOTE_PREDEFINITE,
  });
  c("non cambiano l'utile imponibile", con.utileImponibile, senza.utileImponibile);
  c("ne' le imposte", con.imposte, senza.imposte);
  c("ne' l'IVA da versare", con.ivaDaVersare, senza.ivaDaVersare);
  c("ma entrano interi nell'utile reale", con.utileReale + 500, senza.utileReale);
}

/* ═══ IL PACCHETTO PER IL COMMERCIALISTA ═══════════════════════════════ */
async function provePacchetto() {
  gruppo("IL CSV CHE SI APRE CON EXCEL");
  const righe = Z.csv([
    ["Fornitore", "Imponibile"],
    ["Meta Platforms Ireland", 1842.3],
    ['Studio Rossi; "detto" & C.', 800],
  ]);
  //  ⚠️ Su un computer italiano Excel separa le colonne con il punto e
  //   virgola: con la virgola si apre tutto in una colonna sola.
  c("le colonne si separano col punto e virgola", true, righe.includes("Fornitore;Imponibile"));
  c("i decimali con la virgola, o non si sommano", true, righe.includes(";1842,30"));
  c("il BOM davanti, o gli accenti diventano geroglifici", true, righe.startsWith("\ufeff"));
  c("le virgolette si raddoppiano", true, righe.includes('""detto""'));
  c("il campo con dentro il separatore sta fra virgolette", true, righe.includes('"Studio Rossi;'));

  gruppo("LO ZIP");
  const usati = new Set();
  c(
    "le cartelle restano cartelle",
    "originali/fattura.pdf",
    Z.nomeLibero(usati, "originali/fattura.pdf"),
  );
  c(
    "due file con lo stesso nome non si sovrascrivono",
    "originali/fattura (2).pdf",
    Z.nomeLibero(usati, "originali/fattura.pdf"),
  );
  c(
    "via gli accenti dai nomi, li legge anche Windows",
    "originali/Amazon EU S.a r.l..pdf",
    Z.nomeLibero(usati, "originali/Amazon EU S.à r.l..pdf"),
  );

  const pdfFinto = Buffer.from(pdfStampato(["Prova Srl", "Totale 10,00"]));
  const zip = Z.componiZip([
    { nome: "originali/uno.pdf", dati: new Uint8Array(pdfFinto), quando: new Date(2026, 6, 31) },
    { nome: "elenco.csv", dati: new TextEncoder().encode(righe), quando: new Date(2026, 7, 31) },
  ]);
  const fzip = join(dove, "pacco.zip");
  writeFileSync(fzip, Buffer.from(await zip.arrayBuffer()));
  let apribile = "saltato";
  try {
    execFileSync("unzip", ["-t", fzip], { stdio: ["ignore", "pipe", "pipe"] });
    apribile = "ok";
  } catch (e) {
    apribile = e?.code === "ENOENT" ? "saltato" : "rotto";
  }
  c(
    apribile === "saltato" ? "unzip non c'e': controllo saltato" : "unzip apre l'archivio",
    true,
    apribile !== "rotto",
  );

  gruppo("COSA C'È DENTRO IL PACCHETTO");
  const forn = [
    fattura({
      id: "a",
      fornitore: "Studio Rossi",
      paese: "IT",
      regime: "italiana",
      data: "2026-08-12",
      imponibile: 800,
      imposta: 176,
      totale: 976,
      originale: '<?xml version="1.0"?><FatturaElettronica/>',
    }),
    fattura({
      id: "b",
      fornitore: "Meta",
      partitaIva: "IE9692928F",
      paese: "IE",
      regime: "ue_servizi",
      data: "2026-07-31",
      numero: "250918473921",
      imponibile: 1842.3,
      totale: 1842.3,
      aliquotaReverse: 22,
    }),
    //  ⚠️ Una estera SENZA partita IVA: l'autofattura non si puo' costruire, e
    //   il LEGGIMI deve dirlo invece di lasciare un file in meno e basta.
    fattura({
      id: "b2",
      fornitore: "Fornitore senza partita IVA",
      paese: "US",
      regime: "estero_servizi",
      data: "2026-07-20",
      numero: "77",
      imponibile: 300,
      totale: 300,
      aliquotaReverse: 22,
    }),
    fattura({
      id: "c",
      fornitore: "Vecchio",
      regime: "reverse",
      data: "2026-07-01",
      imponibile: 200,
      totale: 200,
    }),
  ];
  const conto = C.calcolaContoFiscale({
    fatture: [],
    costi: RC.costiDaiFornitori(forn, () => true),
    regole: {},
    aliquote: C.ALIQUOTE_PREDEFINITE,
  });
  const p = await E.costruisciPacchetto({
    periodo: P.costruisciPeriodo("trimestre", 2026, 2),
    azienda: AZIENDA,
    fatture: [],
    fornitori: forn,
    conto,
    aliquote: C.ALIQUOTE_PREDEFINITE,
    regole: {},
  });
  c("il nome dice il periodo", "contabilita-3-trimestre-2026.zip", p.nome);
  c("le righe senza documento si dicono una per una", 3, p.senzaOriginale.length);

  //  Si riapre davvero, e si guarda cosa c'è dentro.
  const f2 = join(dove, "pacchetto.zip");
  writeFileSync(f2, Buffer.from(await p.zip.arrayBuffer()));
  let elenco = "";
  try {
    elenco = execFileSync("unzip", ["-Z1", f2], { encoding: "utf8" });
  } catch (e) {
    if (e?.code !== "ENOENT") throw e;
  }
  if (elenco) {
    c("c'e' il riepilogo", true, elenco.includes("riepilogo.html"));
    c("c'e' il LEGGIMI", true, elenco.includes("LEGGIMI.txt"));
    c("c'e' l'elenco delle ricevute", true, elenco.includes("fatture-ricevute.csv"));
    //  ⚠️ Il foglio degli esteri è quello che risponde alla domanda che il
    //   commercialista fa sempre: «degli esteri cosa mi manca?».
    c(
      "c'e' il foglio da trasmettere allo SDI",
      true,
      elenco.includes("da-trasmettere-allo-sdi.csv"),
    );
    c("e l'XML originale di chi ce l'ha", true, elenco.includes("originali/ricevute/"));
    const leggimi = execFileSync("unzip", ["-p", f2, "LEGGIMI.txt"], { encoding: "utf8" });
    c("il LEGGIMI dice anche cosa NON c'e' dentro", true, leggimi.includes("COSA NON C'È"));
    c("e segnala le fatture da precisare", true, leggimi.includes("inversione contabile"));
    const sdi = execFileSync("unzip", ["-p", f2, "da-trasmettere-allo-sdi.csv"], {
      encoding: "utf8",
    });
    c("nel foglio degli esteri c'e' il TD17 di Meta", true, sdi.includes("TD17"));
    //  ⚠️ E adesso c'e' anche il FILE, non solo la riga che dice di farlo.
    c("le autofatture sono dentro il pacchetto", true, elenco.includes("da-trasmettere-allo-sdi/"));
    c(
      "una per ogni estera che si puo' costruire",
      1,
      (elenco.match(/da-trasmettere-allo-sdi\//g) ?? []).length,
    );
    c(
      "e quella che non si puo' fare e' scritta nel LEGGIMI col motivo",
      true,
      /non si e' potuta costruire[\s\S]*partita IVA del fornitore/.test(leggimi),
    );
    //  Il 15 agosto è Ferragosto e cade di sabato: si va al primo giorno utile.
    c("con la data entro cui trasmettere, gia' slittata", true, sdi.includes("2026-08-17"));
    c(
      "la fattura generica non ci finisce: non si sa che documento sia",
      false,
      sdi.includes("Vecchio"),
    );
  } else {
    c("unzip non c'e': contenuto del pacchetto non controllato", true, true);
  }
}

/* ═══ QUELLO CHE C'È DA SISTEMARE ══════════════════════════════════════ */
function proveDaSistemare() {
  gruppo("QUELLO CHE C'È DA SISTEMARE");
  const forn = [
    fattura({
      id: "a",
      fornitore: "Vecchio fornitore",
      regime: "reverse",
      imponibile: 200,
      totale: 200,
      conAllegato: true,
    }),
    fattura({
      id: "b",
      fornitore: "Q8 Easy rifornimento",
      regime: "italiana",
      imponibile: 100,
      imposta: 22,
      totale: 122,
      metodoPagamento: "contanti",
      conAllegato: true,
    }),
    fattura({
      id: "c",
      fornitore: "Shenzhen",
      regime: "importazione",
      imponibile: 3730,
      totale: 3730,
      conAllegato: true,
    }),
    fattura({
      id: "d",
      fornitore: "Senza carte",
      regime: "italiana",
      imponibile: 500,
      totale: 500,
    }),
    /*  ⚠️ Estera con un regime preciso ma SENZA partita IVA: l'autofattura non
        si costruisce, e la sanzione per la mancata trasmissione e' per
        documento. La riga "a" invece ha il regime generico ed e' gia'
        segnalata da «precisare»: le due cose non si sovrappongono. */
    fattura({
      id: "f",
      fornitore: "Agenzia di Parigi",
      paese: "FR",
      regime: "ue_servizi",
      data: "2026-07-04",
      numero: "12",
      imponibile: 400,
      totale: 400,
      conAllegato: true,
    }),
  ];
  const conto = C.calcolaContoFiscale({
    fatture: [],
    costi: RC.costiDaiFornitori(forn, () => true),
    regole: {},
    aliquote: C.ALIQUOTE_PREDEFINITE,
  });
  const p = DS.problemiDelPeriodo(forn, conto.righe);
  c("li trova tutti e quattro", 4, p.length);
  c(
    "i piu' gravi in cima",
    ["alta", "alta", "media", "media"],
    p.map((x) => x.peso),
  );
  c(
    "la fattura da precisare e' collegata",
    ["a"],
    p.find((x) => x.chiave === "precisare").fatture.map((x) => x.id),
  );
  c(
    "quella senza documento pure",
    ["d"],
    p.find((x) => x.chiave === "documento").fatture.map((x) => x.id),
  );

  //  Con la bolletta doganale caricata, l'avviso sulla dogana sparisce.
  const conDogana = [
    ...forn,
    fattura({
      id: "e",
      fornitore: "Spedizioniere",
      note: "bolletta doganale",
      regime: "italiana",
      imponibile: 820,
      imposta: 820,
      totale: 1640,
      originale: "<x/>",
    }),
  ];
  const c2 = C.calcolaContoFiscale({
    fatture: [],
    costi: RC.costiDaiFornitori(conDogana, () => true),
    regole: {},
    aliquote: C.ALIQUOTE_PREDEFINITE,
  });
  c(
    "caricata la bolletta, non avvisa piu'",
    undefined,
    DS.problemiDelPeriodo(conDogana, c2.righe).find((x) => x.chiave === "dogana"),
  );

  //  ⚠️ E le NOSTRE fatture che lo SdI rifiuterebbe: prima si sapeva solo
  //   «2 restano indietro», senza sapere quali.
  const rotta = { ...EMESSA, numero: 654, cliente: { ...CLIENTE, codiceFiscale: "F32234234" } };
  const conNostre = DS.problemiDelPeriodo(forn, conto.righe, {
    fatture: [EMESSA, rotta],
    azienda: AZIENDA,
  });
  //  ⚠️ E gli acquisti esteri che non si possono trasmettere: la sanzione e'
  //   per documento, e il rimedio e' un clic — si scrive la partita IVA.
  const senzaAf = conNostre.find((x) => x.chiave === "autofattura");
  c("l'estera senza partita IVA viene segnalata", 1, senzaAf?.fatture.length);
  c("ed e' quella giusta", "f", senzaAf?.fatture[0].id);
  //  Quella col regime generico e' gia' fra le «da precisare»: non si conta due volte.
  c(
    "la generica non finisce anche qui",
    false,
    senzaAf?.fatture.some((x) => x.id === "a"),
  );
  c("il motivo parla dello SDI", true, /trasmettere allo SDI/.test(senzaAf?.titolo ?? ""));
  const emesse = conNostre.find((x) => x.chiave === "emesse");
  c("la nostra fattura rotta viene segnalata", 1, emesse?.emesse?.length);
  c("con il numero e il nome del cliente", true, emesse.emesse[0].chi.includes("654"));
  c("e il motivo scritto accanto", true, /codice fiscale/i.test(emesse.emesse[0].perche));
  c(
    "quella a posto non compare",
    false,
    emesse.emesse.some((x) => x.chi.includes("653")),
  );
  c(
    "senza fatture nostre non si dice niente",
    undefined,
    DS.problemiDelPeriodo(forn, conto.righe, { fatture: [EMESSA], azienda: AZIENDA }).find(
      (x) => x.chiave === "emesse",
    ),
  );

  gruppo("QUANDO NON C'È NIENTE DA SISTEMARE");
  const pulite = [
    fattura({
      id: "z",
      fornitore: "Studio Rossi",
      regime: "italiana",
      imponibile: 800,
      imposta: 176,
      totale: 976,
      originale: "<x/>",
    }),
  ];
  const c3 = C.calcolaContoFiscale({
    fatture: [],
    costi: RC.costiDaiFornitori(pulite, () => true),
    regole: {},
    aliquote: C.ALIQUOTE_PREDEFINITE,
  });
  c("la scheda non ha proprio niente da dire", 0, DS.problemiDelPeriodo(pulite, c3.righe).length);
}

/* ═══ LE SPESE FISSE DEL MESE ══════════════════════════════════════════ */
function proveDelleSpeseFisse() {
  gruppo("LE VOCI CHE TORNANO DA SOLE");
  const salvati = {
    "2026-05": [
      { id: "a", titolo: "Affitto", importo: 900, fissa: true },
      { id: "b", titolo: "Luce", importo: 210 },
    ],
    "2026-07": [
      { id: "c", titolo: "Affitto", importo: 950, fissa: true },
      { id: "d", titolo: "Luce", importo: 180 },
      { id: "e", titolo: "Manutenzione caldaia", importo: 320 },
    ],
  };
  const mesi = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"];
  const fuori = CM.conLeFisse(salvati, mesi, "2026-08");

  c("un mese salvato resta com'era", 2, fuori["2026-05"].length);
  c(
    "e i suoi importi non si toccano",
    210,
    fuori["2026-05"].find((v) => v.titolo === "Luce").importo,
  );
  //  ⚠️ Giugno non ha un elenco: torna la sola fissa di maggio, con l'importo
  //   di maggio — non quello di luglio, che a giugno non era ancora vero.
  c(
    "un mese non compilato prende le fisse di prima",
    ["Affitto"],
    (fuori["2026-06"] ?? []).map((v) => v.titolo),
  );
  c("con l'importo in vigore allora", 900, fuori["2026-06"][0].importo);
  c("segnata come messa in automatico", true, fuori["2026-06"][0].automatica);
  c(
    "con un id suo, o tre mesi di affitto sarebbero la stessa riga",
    true,
    fuori["2026-06"][0].id !== "a",
  );
  //  Agosto viene dopo luglio: prende l'affitto aggiornato a 950.
  c("agosto prende l'affitto aggiornato", 950, fuori["2026-08"][0].importo);
  c("e non la luce, che fissa non e'", 1, fuori["2026-08"].length);

  gruppo("QUELLO CHE NON SI INVENTA");
  //  ⚠️ Aprile e' PRIMA di ogni mese compilato: inventarci un affitto vorrebbe
  //   dire riscrivere un conto gia' guardato.
  c("prima del primo mese compilato, niente", undefined, fuori["2026-04"]);
  //  ⚠️ Settembre non e' ancora cominciato.
  c("dopo il mese corrente, niente", undefined, fuori["2026-09"]);
  //  ⚠️ Un mese svuotato a mano resta vuoto: e' una scelta, non un buco.
  const svuotato = CM.conLeFisse({ ...salvati, "2026-06": [] }, ["2026-06"], "2026-08");
  c("un mese svuotato a mano resta vuoto", 0, svuotato["2026-06"].length);
  //  Senza nessuna fissa non compare niente.
  const senzaFisse = CM.conLeFisse(
    { "2026-05": [{ id: "x", titolo: "Luce", importo: 100 }] },
    ["2026-06"],
    "2026-08",
  );
  c("senza voci fisse, un mese vuoto resta vuoto", undefined, senzaFisse["2026-06"]);
  //  Una fissa a zero non conta: e' una riga rimasta li'.
  const aZero = CM.conLeFisse(
    { "2026-05": [{ id: "x", titolo: "Fibra", importo: 0, fissa: true }] },
    ["2026-06"],
    "2026-08",
  );
  c("una fissa a zero non si ripropone", undefined, aZero["2026-06"]);

  gruppo("LA PROPOSTA PER IL MESE NUOVO");
  const proposta = CM.propostaDa(salvati["2026-07"]);
  c("propone tutte le voci del mese prima", 3, proposta.length);
  c(
    "con i loro importi",
    [950, 180, 320],
    proposta.map((v) => v.importo),
  );
  c("«fissa» si porta dietro", true, proposta[0].fissa);
  c(
    "ma nessuna resta «automatica»: qui le conferma una persona",
    true,
    proposta.every((v) => !v.automatica),
  );
  c(
    "e con id nuovi",
    true,
    proposta.every((v) => !["c", "d", "e"].includes(v.id)),
  );

  gruppo("COME ENTRANO IN CONTABILITÀ");
  const costi = RC.costiDaiMesi(fuori);
  const giugno = costi.filter((x) => x.data === "2026-06-01");
  c("il costo automatico ha la data del suo mese", 1, giugno.length);
  c(
    "e il dettaglio dice che nessuno l'ha confermato",
    true,
    /in automatico/.test(giugno[0].dettaglio),
  );
  c(
    "mentre uno salvato no",
    false,
    /in automatico/.test(costi.find((x) => x.data === "2026-07-01").dettaglio),
  );
  const conto = C.calcolaContoFiscale({
    fatture: [{ imponibile: 10000, imposta: 2200 }],
    costi,
    regole: {},
    aliquote: C.ALIQUOTE_PREDEFINITE,
  });
  //  900 (giugno, automatico) + 900+210 (maggio) + 950+180+320 (luglio) + 950 (agosto)
  c("e contano nel conto, IVA scorporata", true, conto.costiDeducibili > 0);
  c("nessun NaN", true, Number.isFinite(conto.utileReale));
}

/* ═══ L'F24 DA COMPILARE ═══════════════════════════════════════════════ */
function proveDellF24() {
  gruppo("LE RIGHE DELL'F24");
  const conConto = (iva, credito = 0) => ({
    ivaDaVersare: iva,
    creditoIvaDaRiportare: credito,
  });

  const t2 = P.costruisciPeriodo("trimestre", 2026, 1);
  const righe = F24.righeF24(conConto(4224), t2, "trimestrale");
  c("il secondo trimestre e' il 6032", "6032", righe[0].codice);
  c("con il periodo di riferimento", "0002", righe[0].periodo);
  c("l'anno", "2026", righe[0].anno);
  c("l'importo", 4224, righe[0].importo);
  //  ⚠️ L'1% e' il prezzo dell'opzione trimestrale, e ha un codice suo.
  c("e l'1% di interessi, con il 1668", "1668", righe[1].codice);
  c("che fa 42,24", 42.24, righe[1].importo);
  c("in tutto", 4266.24, F24.totaleF24(righe));

  /*  ⚠️ IL QUARTO TRIMESTRE NON HA UN CODICE TRIMESTRALE. Chi liquida ogni tre
      mesi per opzione lo versa dentro il conguaglio annuale, con il 6099: il
      6034 esiste ma e' dei trimestrali speciali dell'art. 74 (benzinai,
      autotrasportatori), e usarlo manderebbe i soldi su un altro tributo. */
  const t4 = F24.righeF24(conConto(1000), P.costruisciPeriodo("trimestre", 2026, 3), "trimestrale");
  c("il quarto trimestre va nel conguaglio annuale", "6099", t4[0].codice);
  c("e non porta interessi", 1, t4.length);

  gruppo("LA LIQUIDAZIONE MENSILE");
  const m = F24.righeF24(conConto(800), P.costruisciPeriodo("mese", 2026, 6), "mensile");
  c("luglio e' il 6007", "6007", m[0].codice);
  c("con il periodo 0007", "0007", m[0].periodo);
  c("e nessun interesse: quelli sono dell'opzione trimestrale", 1, m.length);

  gruppo("IL FOGLIO DA STAMPARE");
  const foglio = FF.costruisciFoglioF24(conConto(4224), t2, "trimestrale", AZIENDA, "2026-07-20");
  c("porta il codice tributo", true, foglio.includes("6032"));
  c("e gli interessi", true, foglio.includes("1668"));
  c("gli importi con i centesimi", true, foglio.includes("42,24"));
  /*  ⚠️ Il punto delle migliaia si scrive o no a seconda dell'ICU che ha
      Node: in un browser «4.266,24», qui a volte «4266,24». La prova guarda
      il numero, non come lo raggruppa la libreria di sistema — altrimenti
      passerebbe o fallirebbe a seconda di dove gira. */
  c("il totale", true, /4\.?266,24/.test(foglio));
  c("dice di chi e'", true, foglio.includes("HAIR GENIUS LABS"));
  //  ⚠️ Deve dire chiaramente che NON e' un modello F24: un foglio che sembra
  //   ufficiale e non lo e' fa piu' danno di uno scritto a mano.
  c("dice che non e' un modello F24", true, /non è un modello F24/.test(foglio));
  c("e come si versa davvero", true, /Entratel|home banking/.test(foglio));
  c("con la data entro cui versare", true, /agosto 2026/.test(foglio));
  c("nessun segnaposto rimasto", 0, (foglio.match(/\$\{/g) ?? []).length);
  c("si chiude", true, foglio.trim().endsWith("</html>"));
  const vuoto = FF.costruisciFoglioF24(conConto(0), t2, "trimestrale", AZIENDA, "2026-07-20");
  c(
    "senza niente da versare lo dice invece di una tabella vuota",
    true,
    /non c.è niente da versare/i.test(vuoto),
  );

  gruppo("QUANDO NON C'E' NESSUN F24");
  c("niente da versare, nessuna riga", 0, F24.righeF24(conConto(0), t2, "trimestrale").length);
  c(
    "e lo dice",
    true,
    /non devi niente|niente da versare/i.test(F24.perchePerNiente(conConto(0), t2, "trimestrale")),
  );
  //  ⚠️ Il credito NON diventa una riga: compensarlo ha regole sue.
  const inCredito = conConto(0, 880);
  c("un credito non diventa una riga", 0, F24.righeF24(inCredito, t2, "trimestrale").length);
  c(
    "e si spiega che si porta avanti",
    true,
    /porta al periodo dopo/.test(F24.perchePerNiente(inCredito, t2, "trimestrale")),
  );
  //  ⚠️ L'F24 lo fa il periodo di LIQUIDAZIONE, non la finestra che si guarda.
  const anno = P.costruisciPeriodo("anno", 2026, 0);
  c(
    "sull'anno intero non si propone nessun versamento",
    0,
    F24.righeF24(conConto(4224), anno, "trimestrale").length,
  );
  c(
    "e si dice quale periodo scegliere",
    true,
    /trimestre/.test(F24.perchePerNiente(conConto(4224), anno, "trimestrale")),
  );
  c(
    "un mese mentre si liquida per trimestri: niente",
    0,
    F24.righeF24(conConto(500), P.costruisciPeriodo("mese", 2026, 6), "trimestrale").length,
  );
}

/* ═══ LE AUTOFATTURE PER LO SDI ════════════════════════════════════════ */
function proveDelleAutofatture() {
  gruppo("L'AUTOFATTURA TD17");
  const meta = fattura({
    id: "IE9692928F-2026-07-31-250918473921",
    fornitore: "Meta Platforms Ireland Limited",
    partitaIva: "IE9692928F",
    paese: "IE",
    regime: "ue_servizi",
    data: "2026-07-31",
    numero: "250918473921",
    imponibile: 1842.3,
    totale: 1842.3,
    aliquotaReverse: 22,
    righe: [
      {
        descrizione: "Facebook Ads",
        quantita: 1,
        prezzoUnitario: 1842.3,
        aliquota: 0,
        totale: 1842.3,
      },
    ],
  });
  c("niente impedisce di costruirla", 0, AF.problemiAutofattura(meta, AZIENDA).length);
  const xml = AF.costruisciAutofattura(meta, AZIENDA);

  /*  ⚠️ CONTRO LO SCHEMA, non solo «si apre». La prima versione di questo
      file era ben formata e sarebbe stata scartata dallo SDI: mancava il
      `RegimeFiscale` del cedente, obbligatorio anche per un fornitore estero.
      L'ha trovato lo schema. */
  c("passa lo schema ufficiale dell'Agenzia", "ok", validaSchema(xml, "af-td17.xml"));

  c("e' un TD17", true, xml.includes("<TipoDocumento>TD17</TipoDocumento>"));
  /*  ⚠️ IL CONTROLLO CHE VALE PIU' DI TUTTI: chi sta da che parte. Scambiati,
      il file e' formalmente valido e dichiara una VENDITA all'estero mai
      avvenuta. */
  const cedente = xml.slice(
    xml.indexOf("<CedentePrestatore>"),
    xml.indexOf("</CedentePrestatore>"),
  );
  const cessionario = xml.slice(
    xml.indexOf("<CessionarioCommittente>"),
    xml.indexOf("</CessionarioCommittente>"),
  );
  c("il cedente e' il FORNITORE", true, cedente.includes("Meta Platforms Ireland Limited"));
  c(
    "con la sua partita IVA, senza il paese doppio",
    true,
    cedente.includes("<IdPaese>IE</IdPaese><IdCodice>9692928F</IdCodice>"),
  );
  c("il cessionario siamo NOI", true, cessionario.includes("HAIR GENIUS LABS"));
  c("con la nostra partita IVA", true, cessionario.includes("<IdCodice>18486531009</IdCodice>"));
  c("e il fornitore non compare fra i cessionari", false, cessionario.includes("Meta"));

  c("l'imponibile", true, xml.includes("<ImponibileImporto>1842.30</ImponibileImporto>"));
  c("l'imposta che ci autoliquidiamo", true, xml.includes("<Imposta>405.31</Imposta>"));
  c("l'aliquota", true, xml.includes("<AliquotaIVA>22.00</AliquotaIVA>"));
  c(
    "il totale del documento",
    true,
    xml.includes("<ImportoTotaleDocumento>2247.61</ImportoTotaleDocumento>"),
  );
  c("cosa e' stato comprato", true, xml.includes("Facebook Ads"));
  //  ⚠️ Il file si manda a NOI: il destinatario e' il cessionario.
  c(
    "destinatario: i sette zeri e la nostra PEC",
    true,
    xml.includes("<CodiceDestinatario>0000000</CodiceDestinatario>") &&
      xml.includes("hairlabssrls@pec.it"),
  );
  c("nessuna virgola dentro un importo", 0, (xml.match(/>\d+,\d+</g) ?? []).length);

  gruppo("IL NUMERO E IL NOME DEL FILE");
  c("il numero sta in un sezionale suo", true, AF.numeroAutofattura(meta).startsWith("AF2026-"));
  c("non supera i venti caratteri del tracciato", true, AF.numeroAutofattura(meta).length <= 20);
  c(
    "lo stesso acquisto da' sempre lo stesso numero",
    AF.numeroAutofattura(meta),
    AF.numeroAutofattura({ ...meta }),
  );
  c(
    "due acquisti diversi, numeri diversi",
    true,
    AF.numeroAutofattura(meta) !== AF.numeroAutofattura({ ...meta, numero: "999" }),
  );
  c(
    "il nome del file segue il tracciato",
    true,
    /^IT18486531009_[A-Z0-9]{5}\.xml$/.test(AF.nomeFileAutofattura(meta, AZIENDA)),
  );

  gruppo("IL PROGRESSIVO D'INVIO, CHE DEVE ESSERE UNICO");
  /*  ⚠️ Lo SDI rifiuta un secondo file con lo stesso progressivo dello stesso
      trasmittente. Prima erano «le ultime cinque cifre del numero», e la
      fattura Meta n. 250918473921, una n. INV-9873921 e una n. 73921 finivano
      TUTTE su «73921»: la prima passava, le altre due tornavano indietro come
      duplicate — e a scoprirlo si e' il 15 del mese. */
  const conNumero = (n, piva) => ({ ...meta, id: `id-${n}-${piva}`, numero: n, partitaIva: piva });
  const tre = [
    AF.progressivoAutofattura(conNumero("250918473921", "IE9692928F")),
    AF.progressivoAutofattura(conNumero("INV-9873921", "DE811907980")),
    AF.progressivoAutofattura(conNumero("73921", "FR123456789")),
  ];
  c("tre documenti diversi, tre progressivi diversi", 3, new Set(tre).size);
  c(
    "lo stesso documento da' sempre lo stesso",
    AF.progressivoAutofattura(meta),
    AF.progressivoAutofattura({ ...meta }),
  );
  c(
    "cinque caratteri, come vuole il tracciato",
    true,
    tre.every((x) => /^[A-Z0-9]{5}$/.test(x)),
  );
  const tanti = new Set();
  for (let i = 0; i < 2000; i++) {
    tanti.add(AF.progressivoAutofattura(conNumero(`INV-${i}`, `IE${9000000 + (i % 37)}`)));
  }
  c("duemila documenti, duemila progressivi", 2000, tanti.size);
  c(
    "e finisce anche nel nome del file",
    true,
    AF.nomeFileAutofattura(meta, AZIENDA).includes(AF.progressivoAutofattura(meta)),
  );

  gruppo("GLI ALTRI TIPI, E QUELLO CHE SI RIFIUTA");
  const beniUE = { ...meta, regime: "ue_beni" };
  c("i beni UE fanno un TD18", true, AF.costruisciAutofattura(beniUE, AZIENDA).includes("TD18"));
  //  Tutti e quattro i tipi devono passare lo schema, non solo il primo.
  c(
    "il TD18 passa lo schema",
    "ok",
    validaSchema(AF.costruisciAutofattura(beniUE, AZIENDA), "af-td18.xml"),
  );
  c(
    "il TD19 passa lo schema",
    "ok",
    validaSchema(
      AF.costruisciAutofattura(
        { ...meta, regime: "estero_beni_italia", paese: "CN", partitaIva: "CN9111" },
        AZIENDA,
      ),
      "af-td19.xml",
    ),
  );
  c(
    "e il TD17 extra-UE",
    "ok",
    validaSchema(
      AF.costruisciAutofattura(
        { ...meta, regime: "estero_servizi", paese: "US", partitaIva: "US12345678" },
        AZIENDA,
      ),
      "af-usa.xml",
    ),
  );
  c(
    "i beni esteri gia' in Italia un TD19",
    true,
    AF.costruisciAutofattura({ ...meta, regime: "estero_beni_italia" }, AZIENDA).includes("TD19"),
  );
  c(
    "i servizi extra-UE un TD17",
    true,
    AF.costruisciAutofattura({ ...meta, regime: "estero_servizi", paese: "US" }, AZIENDA).includes(
      "TD17",
    ),
  );

  //  ⚠️ Senza partita IVA del fornitore NON si costruisce: il tracciato la
  //   pretende, e inventarla vorrebbe dire trasmettere un dato falso.
  const senzaPiva = AF.problemiAutofattura({ ...meta, partitaIva: "" }, AZIENDA);
  c(
    "senza partita IVA del fornitore ci si ferma",
    true,
    senzaPiva.some((x) => /partita IVA del fornitore/.test(x)),
  );
  const italiana = AF.problemiAutofattura({ ...meta, regime: "italiana" }, AZIENDA);
  c(
    "su una fattura italiana non c'e' niente da trasmettere",
    true,
    italiana.some((x) => /non richiede/.test(x)),
  );
  const generica = AF.problemiAutofattura({ ...meta, regime: "reverse" }, AZIENDA);
  c(
    "sul regime generico si chiede di precisarlo",
    true,
    generica.some((x) => /beni o servizi/.test(x)),
  );
  c(
    "senza data ci si ferma",
    true,
    AF.problemiAutofattura({ ...meta, data: "" }, AZIENDA).some((x) => /data/.test(x)),
  );
  c(
    "con imponibile a zero anche",
    true,
    AF.problemiAutofattura({ ...meta, imponibile: 0, totale: 0 }, AZIENDA).some((x) =>
      /imponibile/.test(x),
    ),
  );
}

/* ═══ I REGISTRI IVA ═══════════════════════════════════════════════════ */
function proveDeiRegistri() {
  gruppo("IL PROTOCOLLO DEGLI ACQUISTI");
  /*  ⚠️ L'art. 25 chiede un numero NOSTRO, progressivo, nell'ordine in cui i
      documenti sono stati RICEVUTI — non quello del fornitore, e non l'ordine
      delle date dei documenti. */
  const ric = (id, data, caricataIl, extra = {}) =>
    fattura({
      id,
      fornitore: "F" + id,
      data,
      caricataIl,
      imponibile: 100,
      imposta: 22,
      totale: 122,
      regime: "italiana",
      ...extra,
    });
  const tutte = [
    ric("b", "2026-03-02", "2026-03-10T09:00:00Z"),
    ric("a", "2026-01-15", "2026-02-01T09:00:00Z"),
    //  ⚠️ Documento di marzo caricato a settembre: prende il protocollo di
    //   settembre, che e' quando e' entrata in contabilita'.
    ric("c", "2026-03-20", "2026-09-01T09:00:00Z"),
    ric("d", "2025-11-04", "2025-11-05T09:00:00Z"),
  ];
  const n = RG.protocolli(tutte);
  c("numera per data di CARICAMENTO", "2026/0001", n.get("a"));
  c("il secondo caricato e' il 2", "2026/0002", n.get("b"));
  c("quello caricato in ritardo va in fondo", "2026/0003", n.get("c"));
  c("e riparte da 1 ogni anno", "2025/0001", n.get("d"));
  c("nessun protocollo ripetuto", 4, new Set([...n.values()]).size);

  gruppo("IL REGISTRO DELLE VENDITE");
  const emessa = {
    ...EMESSA,
    righe: [
      { descrizione: "A", quantita: 1, prezzoUnitario: 1000, aliquota: 22 },
      { descrizione: "B", quantita: 2, prezzoUnitario: 50, aliquota: 10 },
    ],
  };
  const v = RG.righeVendite([emessa]);
  //  ⚠️ Una riga per ALIQUOTA: l'art. 23 vuole imponibile e imposta distinti.
  c("una riga per aliquota", 2, v.length);
  c("la 22% con il suo imponibile", 1000, v[0].imponibile);
  c("e la sua imposta", 220, v[0].imposta);
  c("la 10% sotto", 100, v[1].imponibile);
  c("con la sua", 10, v[1].imposta);
  c("stesso numero di fattura su tutte e due", true, v[0].riferimento === v[1].riferimento);
  const totV = RG.totaliPerAliquota(v);
  c(
    "i totali si chiudono per aliquota",
    [22, 10],
    totV.map((x) => x.aliquota),
  );

  gruppo("IL REGISTRO DEGLI ACQUISTI");
  const acq = [
    ric("a", "2026-01-15", "2026-02-01T09:00:00Z"),
    ric("m", "2026-02-01", "2026-02-02T09:00:00Z", {
      fornitore: "Meta",
      regime: "ue_servizi",
      imponibile: 1000,
      imposta: 0,
      totale: 1000,
      aliquotaReverse: 22,
    }),
    ric("nc", "2026-02-10", "2026-02-11T09:00:00Z", { notaDiCredito: true }),
  ];
  const numeri = RG.protocolli(acq);
  const a = RG.righeAcquisti(acq, numeri);
  c(
    "ordinate per protocollo",
    ["2026/0001", "2026/0002", "2026/0003"],
    a.map((x) => x.riferimento),
  );
  c(
    "porta anche il numero del documento del fornitore",
    true,
    a.every((x) => x.numeroDocumento !== undefined),
  );
  //  ⚠️ Sull'inversione contabile l'imposta non e' nel documento: e' quella
  //   calcolata, ed e' quella che va nel registro.
  const meta = a.find((x) => x.chi === "Meta");
  c("l'inversione contabile porta l'imposta calcolata", 220, meta.imposta);
  c("e lo dice nella nota", true, /inversione contabile/.test(meta.nota));
  c("con il tipo documento", true, /TD17/.test(meta.nota));
  //  ⚠️ Una nota di credito nel registro va col segno meno, o i totali non
  //   tornano con la liquidazione.
  const nc = a.find((x) => x.chi === "Fnc");
  c("la nota di credito e' negativa", -100, nc.imponibile);
  c("anche nell'imposta", -22, nc.imposta);
  c("le integrazioni si possono isolare", 1, RG.soloIntegrazioni(a).length);
  //  ⚠️ Nel registro ci va l'imposta DEL DOCUMENTO, non quella detraibile:
  //   se un carburante pagato in contanti non si detrae, e' la liquidazione a
  //   non portarla, non il registro a nasconderla.
  const benzinaReg = RG.righeAcquisti(
    [
      fattura({
        id: "q",
        fornitore: "Q8 Easy rifornimento",
        data: "2026-02-20",
        caricataIl: "2026-02-21T09:00:00Z",
        regime: "italiana",
        imponibile: 100,
        imposta: 22,
        totale: 122,
        metodoPagamento: "contanti",
      }),
    ],
    RG.protocolli([
      fattura({ id: "q", fornitore: "Q8", data: "2026-02-20", caricataIl: "2026-02-21T09:00:00Z" }),
    ]),
  );
  c("un'imposta non detraibile resta scritta nel registro", 22, benzinaReg[0].imposta);

  gruppo("IL FOGLIO DEI REGISTRI");
  const foglio = RGF.costruisciRegistri(
    [emessa],
    acq,
    numeri,
    P.costruisciPeriodo("trimestre", 2026, 0),
    AZIENDA,
  );
  c(
    "passa i due libri con le loro norme",
    true,
    /art\. 23 DPR 633\/72/.test(foglio) && /art\. 25 DPR 633\/72/.test(foglio),
  );
  c("porta i protocolli", true, foglio.includes("2026/0002"));
  //  ⚠️ L'avviso sulle integrazioni: un commercialista che legge solo il
  //   registro acquisti non le vedrebbe, e la liquidazione non tornerebbe.
  c(
    "avvisa che le integrazioni vanno anche fra le vendite",
    true,
    /anche nel registro delle vendite/.test(foglio),
  );
  c("dice che i registri digitali sono regolari", true, /357\/1994/.test(foglio));
  c("nessun segnaposto rimasto", 0, (foglio.match(/\$\{/g) ?? []).length);
  c("si chiude", true, foglio.trim().endsWith("</html>"));
  const vuoto = RGF.costruisciRegistri(
    [],
    [],
    new Map(),
    P.costruisciPeriodo("trimestre", 2026, 0),
    AZIENDA,
  );
  c(
    "senza documenti lo dice invece di una tabella vuota",
    true,
    /Nessun documento registrato/.test(vuoto),
  );
}

/* ═══ LA RITENUTA D'ACCONTO ════════════════════════════════════════════ */
function proveDelleRitenute() {
  gruppo("SOSTITUTO D'IMPOSTA");
  const parcella = (id, data, importo, ritenuta, chi) =>
    fattura({
      id,
      fornitore: chi,
      data,
      regime: "italiana",
      imponibile: importo,
      imposta: importo * 0.22,
      totale: importo * 1.22,
      ritenuta,
    });
  const forn = [
    parcella("a", "2026-07-10", 1000, 200, "Studio Rossi"),
    parcella("b", "2026-07-28", 500, 100, "Ing. Bianchi"),
    parcella("c", "2026-08-05", 800, 160, "Studio Rossi"),
    fattura({
      id: "d",
      fornitore: "Italgas",
      data: "2026-07-15",
      regime: "italiana",
      imponibile: 90,
      imposta: 19.8,
      totale: 109.8,
    }),
  ];
  const v = RIT.versamentiRitenuta(forn);
  /*  ⚠️ UN VERSAMENTO PER MESE, non uno per trimestre: le scadenze sono
      diverse, e sommarli farebbe fare un F24 unico fuori tempo per due terzi
      dell'importo. */
  c(
    "un versamento per mese",
    ["2026-07", "2026-08"],
    v.map((x) => x.mese),
  );
  c("luglio somma le due parcelle", 300, v[0].importo);
  c("agosto la sua", 160, v[1].importo);
  //  Il 16 agosto 2026 e' domenica: slitta al 17.
  c("si versa entro il 16 del mese dopo, gia' slittato", "2026-08-17", v[0].entro);
  c("e per agosto entro il 16 settembre", "2026-09-16", v[1].entro);
  c("porta i nomi, per ritrovarle", ["Studio Rossi", "Ing. Bianchi"], v[0].chi);
  c("in tutto", 460, RIT.totaleRitenute(v));
  c(
    "una fattura senza ritenuta non entra",
    false,
    v.some((x) => x.chi.includes("Italgas")),
  );
  c("senza ritenute non c'e' niente da versare", 0, RIT.versamentiRitenuta([forn[3]]).length);

  gruppo("LA RITENUTA NON TOCCA IL COSTO NE' L'IVA");
  /*  ⚠️ E' l'errore piu' facile: il professionista quel denaro lo ha guadagnato
      tutto, e l'IVA si detrae per intero. Sottrarla dai costi farebbe pagare
      piu' imposte del dovuto. */
  const conto = C.calcolaContoFiscale({
    fatture: [],
    costi: RC.costiDaiFornitori(
      [parcella("x", "2026-07-10", 1000, 200, "Studio Rossi")],
      () => true,
    ),
    regole: {},
    aliquote: C.ALIQUOTE_PREDEFINITE,
  });
  c("il costo resta l'imponibile intero", 1000, conto.costiDeducibili);
  c("e l'IVA si detrae tutta", 220, conto.ivaACredito);

  gruppo("GLI ADEMPIMENTI DELL'ANNO");
  const ad = RIT.adempimentiAnnuali(2026);
  c("la Certificazione Unica entro il 16 marzo", "2027-03-16", ad[0].entro);
  c("e il 770 entro il 31 ottobre, slittato", "2027-11-02", ad[1].entro);
  c(
    "con scritto cosa costa non farli",
    true,
    ad.every((x) => x.perche.length > 40),
  );
}

/* ── 3. VIA ───────────────────────────────────────────────────────────── */
/* ═══ LEGGERE UN FOGLIO DI CALCOLO ═════════════════════════════════════
   ⚠️ SI PROVA SUL FILE VERO, non su uno costruito qui. Il .xls che ha fatto
   nascere questo lettore è una proforma di un fornitore cinese salvata con
   WPS Office: dentro ha una tabella di stringhe spezzata su nove record, i
   numeri in forma «RK» compressa, e la valuta scritta a parole CON UN ERRORE
   DI BATTITURA («US DOLLAS»). Nessuno di questi tre casi verrebbe in mente a
   chi costruisce un file di prova — e tutti e tre hanno rotto qualcosa.
   Se il file non c'è, le prove si saltano dicendolo: non si finge che siano
   passate. */
async function proveDelFoglio() {
  gruppo("LEGGERE UN FOGLIO DI CALCOLO");
  const vero = "/Users/admin/Downloads/Hair Genius Labs Invoice 2026.8.7.xls";
  if (!existsSync(vero)) {
    console.log("     (saltate: il file di esempio non è su questa macchina)");
    return;
  }
  const b = readFileSync(vero);
  const r = await XLS.leggiFoglio(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength),
    "prova.xls",
  );
  c("si apre un .xls del 1997", true, !!(r.ok === true));
  c(
    "riconosce l'estensione",
    true,
    !!(XLS.eFoglioDiCalcolo("x.xls") && XLS.eFoglioDiCalcolo("x.xlsx")),
  );
  c("e non scambia un PDF per un foglio", true, !!(XLS.eFoglioDiCalcolo("x.pdf") === false));

  //  ⚠️ Le stringhe DOPO il primo taglio fra due record: è lì che si rompeva.
  c("legge le stringhe oltre il primo record", true, !!r.testo.includes("SKIN KNOT #320"));
  c("e arriva fino in fondo", true, !!r.testo.includes("SIGNATURE & DATE"));
  //  ⚠️ I numeri: venivano tutti zero perché i byte erano girati.
  c("i numeri non sono zero", true, !!/\n81\n/.test(r.testo));
  c("il totale è quello scritto sul documento", true, !!r.testo.includes("729.24"));
  c("e le spese accessorie", true, !!r.testo.includes("21.24"));

  const p = PDF.proponiDalTesto(r.testo, NOSTRI);
  c("la riconosce come PROFORMA", true, !!(p.proforma === true));
  c("e lo scrive a chi carica", true, !!p.spiega.some((s) => /PROFORMA/.test(s)));
  c("paese cinese", true, !!(p.paese === "CN"));
  //  ⚠️ Importazione, NON reverse charge: sui beni extra-UE l'IVA si paga in
  //   dogana. Proporre TD19 qui sarebbe l'errore più caro di tutta la pagina.
  c("regime: importazione di beni", true, !!(p.regime === "importazione"));
  c("non propone nessuna autofattura", true, !!!p.tipoDocumento);
  c("fornitore", true, !!/Qingdao Richhair/.test(p.fornitore ?? ""));
  c("data", true, !!(p.data === "2026-08-07"));
  c("numero", true, !!(p.numero === "260808"));
  //  ⚠️ «US DOLLAS», con l'errore del fornitore.
  c("valuta USD anche scritta a parole e sbagliata", true, !!(p.valuta === "USD"));
  c("l'importo va nel campo della valuta", true, !!(p.importoValuta === 729.24));
  //  ⚠️ E il campo degli euro resta VUOTO: 729,24 dollari non sono 729,24 euro.
  c("l'importo in euro NON viene proposto", true, !!!p.imponibile);
  //  ⚠️ La descrizione dev'essere quello che si è comprato, non il destinatario.
  c("la descrizione non è il nome del cliente", true, !!!/Hair Genius/.test(p.descrizione ?? ""));
  c("ma una riga di prodotto", true, !!/Custom Products/.test(p.descrizione ?? ""));

  /*  ── ⚠️ E ORA LA PARTE CHE COSTA SOLDI SE SBAGLIA ────────────────────
      Una proforma registrata è un documento inesistente dentro numeri che
      devono quadrare con quelli dell'Agenzia. Queste tre prove ci sono
      perché è l'errore che nessuno vedrebbe: il totale del trimestre resta
      plausibile, e la differenza la trova il commercialista mesi dopo. */
  const prof = fattura({
    proforma: true,
    regime: "estero_servizi",
    imponibile: 1000,
    totale: 1000,
    aliquotaReverse: 22,
  });
  const eff = F.effettiContabili(prof);
  c("il costo di una proforma resta", 1000, eff.costo);
  c("ma non autoliquida niente", 0, eff.ivaAutoliquidata);
  c("e non fa detrarre niente", 0, eff.ivaDetraibile);
  c("e non entra nel registro acquisti", 0, RG.righeAcquisti([prof], new Map([["x", "1"]])).length);
  //  ⚠️ La stessa senza la spunta ci entra: la prova serve a dimostrare che a
  //   tenerla fuori è la proforma, non un filtro che scarta tutto.
  c(
    "una fattura vera invece sì",
    1,
    RG.righeAcquisti([{ ...prof, proforma: false }], new Map([["x", "1"]])).length,
  );

  /*  ── ⚠️ LA BOLLETTA DOGANALE: L'ERRORE DA MIGLIAIA DI EURO ────────────
      Il costo della merce sta già sulla fattura del fornitore. Se la riga
      della bolletta lo portasse di nuovo, lo stesso acquisto starebbe due
      volte fra i costi: utile più basso del vero, cioè una dichiarazione
      sbagliata a proprio favore. Nessuna somma a schermo lo smentirebbe. */
  const merce = fattura({ regime: "importazione", imponibile: 3000, totale: 3000 });
  const bolletta = fattura({
    regime: "italiana",
    soloImposta: true,
    imponibile: 3200,
    imposta: 704,
    totale: 3904,
  });
  const em = F.effettiContabili(merce);
  const eb = F.effettiContabili(bolletta);
  c("la merce importata porta il costo", 3000, em.costo);
  c("e nessuna IVA detraibile", 0, em.ivaDetraibile);
  c("la bolletta NON porta un secondo costo", 0, eb.costo);
  c("ma porta l'IVA in detrazione", 704, eb.ivaDetraibile);
  c("il costo totale resta quello della merce", 3000, em.costo + eb.costo);
  //  ⚠️ Nel REGISTRO invece ci va, con il valore doganale: è quello che l'art.
  //   25 fa annotare, ed è diverso dal totale della fattura del fornitore.
  const reg = RG.righeAcquisti([bolletta], new Map([["x", "1"]]));
  c("nel registro degli acquisti però c'è", 1, reg.length);
  c("con il valore doganale, non quello della fattura", 3200, reg[0].imponibile);
}

/** ── NESSUN HOOK SOTTO UN'USCITA ANTICIPATA ────────────────────────────────
 *  ⚠️ QUESTA PROVA ESISTE PERCHE' E' GIA' COSTATA UNA SCHERMATA «Qualcosa si e'
 *   rotto» SULLA POSTAZIONE DEL PRESENTATORE - cioe' sull'interfaccia da cui si
 *   fanno le consulenze - e ci sono ricascato una seconda volta lo stesso
 *   giorno, nello stesso file.
 *  React conta gli hook a ogni disegno e pretende sempre lo stesso numero: un
 *  `useEffect` scritto DOPO un `if (...) return null` viene eseguito solo in
 *  certi disegni, e al primo in cui il conto cambia l'interfaccia muore
 *  (errore #310). Non lo vede il compilatore, non lo vedono i tipi: si vede
 *  solo cliccando, e in produzione.
 *  Qui si legge il sorgente e si controlla a mano. E' grezzo, ed e' esattamente
 *  il genere di controllo che serve: brutale e impossibile da aggirare
 *  distrattamente. */
function proveDegliHook() {
  //  ⚠️ SI RICONOSCONO DUE FORME DI USCITA, e la seconda mi era sfuggita:
  //     if (x) return null;              ← su una riga
  //     if (x) { ... return <.../>; }    ← a blocco, ed e' quella che usa la
  //                                       schermata del nome
  //   Con solo la prima, il controllo passava mentre il difetto c'era. E' gia'
  //   successo, due volte.
  //  ⚠️ E il nome dell'hook puo' avere i TIPI in mezzo — `useState<"a"|"b">(` —
  //   quindi dopo il nome si accetta qualunque cosa che non sia una parentesi.
  /*  ⚠️ QUALUNQUE COSA CHE COMINCI PER `use` SEGUITO DA MAIUSCOLA, e non più
      un elenco di nomi noti. L'elenco è stato un buco vero: ci ho messo
      dentro `useAttesiDelConsulente` — un aggancio nuovo, non nell'elenco —
      sotto l'uscita anticipata di PresenterBar, la prova è passata verde e la
      barra del consulente è sparita. Un controllo che conosce solo i nomi di
      ieri non protegge da quello che scrivi oggi. */
  const HOOK = /^\s{2}(?:const [^=]*= )?(use[A-Z][A-Za-z0-9_]*)[^(]*\(/;
  const APRE_FUNZIONE = /^(export )?(function|const) [A-Za-z]/;
  const IF_IN_CIMA = /^\s{2}if \(/;
  const CHIUDE_BLOCCO = /^\s{2}\}/;

  const file = [
    "src/webinar/DaMeetly.tsx",
    "src/webinar/Anteprime.tsx",
    "src/webinar/ChatSala.tsx",
    "src/webinar/Regia.tsx",
    "src/webinar/Teleprompter.tsx",
    "src/webinar/PannelloPersona.tsx",
    "src/webinar/FasciaRelatori.tsx",
    "src/routes/webinar_.$code.tsx",
    "src/routes/regia_.$codice.tsx",
    "src/crm/fatture/BadgeDaFatturare.tsx",
    //  ⚠️ AGGIUNTO DOPO AVERCI SBATTUTO CONTRO. Questo file ha un cartello
    //   dentro che dice «tutti gli hook stanno sopra questa riga, è già
    //   successo una volta»: ci ho messo un useState sotto lo stesso, e la
    //   barra è morta con «Qualcosa si è rotto» nell'istante in cui il
    //   presentatore entrava — cioè davanti a un cliente. Un cartello nel
    //   codice avvisa chi lo legge; una prova ferma anche chi non lo legge.
    "src/shop/PresenterBar.tsx",
    "src/routes/prova-capelli.tsx",
    "src/routes/CRM.prova-capelli.tsx",
  ];
  const colpevoli = [];
  for (const f of file) {
    const righe = readFileSync(f, "utf8").split("\n");
    let uscitaVista = false;
    let dentroUnIf = false;
    for (const r of righe) {
      //  Una funzione nuova azzera tutto: un `return` in un componente non dice
      //  niente sugli hook di quello dopo.
      if (APRE_FUNZIONE.test(r)) { uscitaVista = false; dentroUnIf = false; }
      if (IF_IN_CIMA.test(r)) {
        dentroUnIf = true;
        if (/\breturn\b/.test(r)) { uscitaVista = true; dentroUnIf = false; }
      } else if (dentroUnIf) {
        if (/\breturn\b/.test(r)) uscitaVista = true;
        if (CHIUDE_BLOCCO.test(r)) dentroUnIf = false;
      }
      if (uscitaVista && HOOK.test(r)) colpevoli.push(`${f}: ${r.trim().slice(0, 46)}`);
    }
  }
  c("nessun hook sotto un'uscita anticipata", "", colpevoli.join(" | "));
}

/** ── NESSUNA CHIAMATA AL CRM SENZA CREDENZIALI ─────────────────────────────
 *
 *  ⚠️ QUESTA PROVA NASCE DA UN GUASTO SEGNALATO PIÙ VOLTE E MAI CHIUSO.
 *  Premendo la spunta «tengo quest'ora per una persona sola» usciva «Non sono
 *  riuscito a cambiarla — Serve l'accesso al CRM: rientra col tuo PIN», e
 *  rientrare col PIN non serviva a niente: la sessione era validissima.
 *  La causa non era la sessione. Era che quella chiamata partiva con `fetch`
 *  nudo — `headers: { "Content-Type": "application/json" }` e basta — mentre il
 *  gettone del PIN viaggia in `x-crm-token` e quello del titolare in
 *  `Authorization`. Non ne partiva nessuno dei due. Il server, che non ha altro
 *  modo di sapere chi chiede, rispondeva 401 con quella frase: diceva l'unica
 *  cosa vera che poteva dire, e mandava a cercare il guasto nel posto sbagliato.
 *
 *  Correggere quel file sarebbe durato fino alla schermata successiva. Qui si
 *  chiude la CLASSE: si leggono dalle rotte stesse quali possono rispondere
 *  «rientra col tuo PIN» (cioè quelle che chiamano `nonAutenticatoCRM`), e si
 *  pretende che nessuno le chiami senza credenziali.
 *
 *  ⚠️ LE ECCEZIONI SONO SCRITTE A MANO, UNA PER UNA, CON IL MOTIVO. Sono
 *   chiamate che partono da pagine PUBBLICHE, dove una sessione non c'è e non
 *   deve esserci: la pagina del preventivo che il cliente apre dal link, la
 *   sala del webinar, e l'accesso stesso — che è la porta, e non si può
 *   chiedere il permesso alla porta per bussare.
 *  ⚠️ SE QUESTA PROVA SI ACCENDE SU UNA RIGA NUOVA, quasi sempre la risposta è
 *   `fetchCRM` al posto di `fetch` (crm/AuthContext): attacca le intestazioni
 *   di chi è collegato adesso e, se arriva un 401, rinfresca la sessione e
 *   riprova una volta. Aggiungere la riga all'elenco qui sotto è la risposta
 *   SOLO se quella chiamata parte davvero da una pagina pubblica. */
function proveDelleChiamateCRM() {
  gruppo("NESSUNA CHIAMATA AL CRM SENZA CREDENZIALI");

  /** Le chiamate che partono da pagine pubbliche: niente sessione, apposta. */
  const PUBBLICHE = new Set([
    //  La porta: si bussa senza avere ancora le chiavi.
    "src/crm/AdminLogin.tsx",
    "src/crm/AuthContext.tsx",
    //  La pagina del preventivo che il cliente apre dal link di WhatsApp.
    "src/routes/preventivo.tsx",
    "src/shop/QuotesPanel.tsx",
    //  La sala del webinar e il contatore: li apre il pubblico.
    "src/routes/regia_.$codice.tsx",
    "src/webinar/ComAndata.tsx",
    "src/webinar/registrazione.ts",
  ]);

  const tutti = [];
  (function giro(d) {
    for (const n of readdirSync(d)) {
      const p = `${d}/${n}`;
      if (!/\./.test(n)) giro(p);
      else if (/\.tsx?$/.test(n)) tutti.push(p);
    }
  })("src");

  //  ── 1. QUALI ROTTE CHIEDONO IL PIN ────────────────────────────────────
  //   Si legge dalle rotte, non da un elenco scritto a mano: una rotta nuova
  //   che mette la guardia entra in questo conto da sola.
  const chiedonoIlPin = new Set();
  for (const f of tutti) {
    if (!/\/routes\/api\.crm\./.test(f)) continue;
    if (!/nonAutenticatoCRM\s*\(/.test(readFileSync(f, "utf8"))) continue;
    const nome = f.split("/").pop().replace(/^api\./, "").replace(/\.ts$/, "").replace(/\./g, "/");
    chiedonoIlPin.add("/api/" + nome);
  }
  c("le rotte che chiedono il PIN si leggono da sole", true, chiedonoIlPin.size >= 5);
  c("fra queste c'è quella delle fasce", true, chiedonoIlPin.has("/api/crm/fascia-modo"));

  //  ── 2. CHI LE CHIAMA SENZA NIENTE ─────────────────────────────────────
  const nude = [];
  for (const f of tutti) {
    const t = readFileSync(f, "utf8");
    const re = /\bfetch\s*\(/g;
    let m;
    while ((m = re.exec(t))) {
      //  `fetchCRM(` e simili: la lettera prima fa parte del nome.
      if (/[A-Za-z0-9_$]/.test(t.slice(Math.max(0, m.index - 1), m.index))) continue;
      const corpo = t.slice(m.index, m.index + 700);
      if (![...chiedonoIlPin].some((r) => corpo.slice(0, 220).includes(r))) continue;
      const credenziali =
        /intestazioniCRM|x-crm-token|Authorization|token:|[?&]token=/.test(corpo) ||
        /headers\s*[,}]/.test(corpo) ||
        /headers\s*:\s*[A-Za-z_$]/.test(corpo);
      if (credenziali || PUBBLICHE.has(f)) continue;
      nude.push(`${f}:${t.slice(0, m.index).split("\n").length}`);
    }
  }
  //  ⚠️ IL CUORE: se questa riga si accende, da qualche parte una persona
  //   vedrà «rientra col tuo PIN» con una sessione perfettamente valida.
  c("nessuna chiamata al CRM parte senza credenziali", "", nude.join(" | "));

  //  ── 3. E LA SPUNTA DELLE FASCE, PER NOME ──────────────────────────────
  //   Il file che ha originato tutto: si controlla a parte, perché un elenco
  //   che passa a vuoto (nessun file letto) passerebbe lo stesso.
  const fasce = readFileSync("src/crm/ModoDellaFascia.tsx", "utf8");
  c("la spunta «una persona sola» chiede con le credenziali", 2,
    (fasce.match(/fetchCRM\(/g) || []).length);
  c("e non resta nessun fetch nudo lì dentro", 0,
    (fasce.match(/(?<![A-Za-z0-9_$])fetch\s*\(/g) || []).length);
}


/** ── IL TELEPROMPTER CHE SEGUE CHI PARLA ───────────────────────────────────
 *  Si rompe in silenzio, e in due modi opposti: il copione che salta a meta'
 *  pagina alla prima parola comune, o che resta fermo mentre parli. Ci si
 *  accorge dell'uno e dell'altro solo in diretta, davanti a duecento persone. */
function proveDelTeleprompter() {
  const copione = SP.parole("Benvenuti, sono Filippo. Stasera parliamo dell'impianto e di quanto dura davvero.");

  //  Avanza leggendo quello che c'e' scritto.
  c("avanza sulle parole dette", 3, SP.avanza(0, copione, "benvenuti sono filippo"));

  //  ⚠️ NON SALTA A META' PAGINA. «di» e «e» tornano piu' volte: cercandole in
  //   tutto il testo la prima manderebbe il segno all'ultima riga, e da li'
  //   non tornerebbe piu' indietro. Sotto le tre lettere si ignorano.
  c("le parole corte non fanno saltare", 0, SP.avanza(0, copione, "e di il la"));

  //  ⚠️ Il riconoscimento vocale tronca e italianizza: «impianto» esce
  //   «impiant», «protocollo» esce «protocol». Senza l'aggancio approssimato
  //   il copione si pianterebbe li'.
  const pos = SP.avanza(0, copione, "benvenuti sono filippo stasera parliamo dellimpiant");
  c("aggancia anche le parole troncate", true, pos >= 6);

  //  ⚠️ MAI INDIETRO: un teleprompter che torna su da solo e' peggio di uno
  //   fermo, perche' rileggi due volte la stessa frase in diretta.
  c("non torna mai indietro", 5, SP.avanza(5, copione, "benvenuti"));

  //  Una parola saltata si perdona; mezza pagina no.
  c("perdona una parola saltata", 3, SP.avanza(0, copione, "benvenuti filippo"));
  c("non salta oltre la finestra", 0, SP.avanza(0, copione, "davvero"));

  //  Non deve mai uscire dai bordi: `scrollIntoView` su un indice fuori
  //  intervallo e' una schermata che non scorre piu'.
  c("non supera la fine del copione", copione.length, SP.avanza(copione.length + 10, copione, "qualcosa"));
  c("un copione vuoto non rompe", 0, SP.avanza(0, [], "parole a caso"));
  //  Accenti e maiuscole non contano: «perché» detto e «Perche» scritto sono
  //  la stessa parola.
  c("accenti e maiuscole non contano", 1, SP.avanza(0, SP.parole("Perché"), "perche"));
}

/** ── L'INVITO A UNA DIRETTA ────────────────────────────────────────────────
 *  Esce dal gestionale e arriva su WhatsApp a una persona che sta valutando un
 *  trattamento. Un errore qui non e' un pixel storto. */
function proveDellInvito() {
  const base = { titolo: "Domande e risposte", link: "https://hair-genius-hub.hair/webinar/bcd-fghj-kmn" };
  const m = MI.messaggioInvitoWebinar({ ...base, nome: "marco rossi" });

  c("saluta col solo nome, maiuscolo", true, m.startsWith("Ciao Marco,"));
  c("dice come si chiama la diretta", true, m.includes("Domande e risposte"));
  //  ⚠️ IL LINK DEVE STARE DA SOLO SU UNA RIGA: in mezzo a un paragrafo
  //   WhatsApp lo attacca alla punteggiatura, e certi telefoni si portano
  //   dentro il punto finale aprendo un indirizzo che non esiste.
  const righe = m.split("\n");
  c("il link sta da solo su una riga", true, righe.includes(base.link));
  //  ⚠️ Si dice cosa ci guadagna LUI, non cosa facciamo noi: a «facciamo un
  //   webinar» si risponde «ok» e non ci si va.
  c("dice perche' dovrebbe esserci", true, m.includes("domande"));
  //  L'orario quando c'e' entra nella prima frase, non in coda.
  //  ⚠️ Chi scrive il quando nel gestionale lo scrive MAIUSCOLO, perche' li'
  //   e' un'etichetta a se'. Qui e' meta' di una frase che comincia con «Ciao
  //   Marco,»: lasciarlo maiuscolo e' l'errore che fa sembrare il messaggio
  //   incollato da un modulo.
  const conOrario = MI.messaggioInvitoWebinar({ ...base, nome: "Ada", quando: "Giovedi' alle 21" });
  c("l'orario entra nella frase, in minuscolo", true, conOrario.includes("giovedi' alle 21 faccio una diretta"));
  c("dopo la virgola non ricomincia in maiuscolo", false, conOrario.includes("Ciao Ada,\nGiovedi'"));
  //  Senza nome non si saluta con la virgola sospesa.
  c("senza nome saluta e basta", true, MI.messaggioInvitoWebinar(base).startsWith("Ciao,"));
  //  Deve stare in una schermata di telefono, o non lo legge nessuno.
  c("resta corto abbastanza da essere letto", true, m.length < 450);
}

/** ── CHI VA IN ONDA ────────────────────────────────────────────────────────
 *  La regia del palco: il presentatore sceglie chi si vede e chi sta grande.
 *  ⚠️ La stessa funzione la usano la console E la sala: se sbaglia, il
 *   presentatore vede un montaggio e gli spettatori un altro — e se ne accorge
 *   solo riguardando la registrazione. */
function proveDellaRegiaPalco() {
  const f = WB.chiVaInOnda;
  const palco = ["ada", "bruno", "carla"];

  //  Senza regia si vedono tutti, col presentatore per primo.
  const tutti = f(undefined, palco);
  c("senza regia vanno in onda tutti", "io,ada,bruno,carla", tutti.elenco.join(","));
  c("senza regia nessuno in primo piano", null, tutti.primoPiano);

  //  Primo piano su chi ha fatto la domanda.
  c("il primo piano vale", "bruno", f({ primoPiano: "bruno" }, palco).primoPiano);

  //  ⚠️ IL PRESENTATORE C'E' SEMPRE. Una regia che lo lascia fuori e' una sala
  //   che non sa piu' chi sta parlando: la voce continua ad arrivare da nessuno.
  const soloDue = f({ mostrati: ["io", "bruno"] }, palco);
  c("in due si vedono in due", "io,bruno", soloDue.elenco.join(","));

  //  ⚠️ CHI E' SCESO NON RESTA UN RIQUADRO NERO: si filtra su chi e'
  //   DAVVERO sul palco adesso, non su chi c'era quando hai scelto.
  c("chi e' sceso sparisce dal montaggio", "io,ada", f({ mostrati: ["io", "ada", "sparito"] }, palco).elenco.join(","));

  //  ⚠️ «TUTTI» E «NESSUNO» SONO DUE COSE DIVERSE: assente = tutti, vuoto =
  //   nessuno. E nessuno non deve dare uno schermo vuoto: resta il relatore.
  c("una lista vuota lascia comunque il relatore", "io", f({ mostrati: [] }, palco).elenco.join(","));

  //  Un primo piano su chi NON e' in onda non deve restare appiccicato: si
  //  vedrebbe il bordo acceso su un riquadro che non c'e'.
  c(
    "il primo piano di uno fuori campo non vale",
    null,
    f({ primoPiano: "carla", mostrati: ["io", "ada"] }, palco).primoPiano,
  );

  //  Palco vuoto: resta il relatore, e la sala non va in nero.
  c("palco vuoto: resta il relatore", "io", f(undefined, []).elenco.join(","));
}

/** ── QUANTE CAMERE STANNO AFFIANCATE ───────────────────────────────────────
 *  Decide cosa si vede su un telefono durante un salotto. Sbagliata in un
 *  senso da' francobolli in cui non si riconosce nessuno; sbagliata nell'altro
 *  da' una colonna sola su un monitor da 27 pollici. */
function proveDellaGriglia() {
  const col = GR.colonnePerCamere;
  //  ── SENZA LARGHEZZA: la regola di Meetly, tale e quale ──
  //   E' quella che usa la console del presentatore, dove i riquadri sono
  //   miniature di servizio.
  c("una camera, una colonna", 1, col(1));
  c("due camere, due colonne", 2, col(2));
  c("tre camere, tre colonne", 3, col(3));
  //  ⚠️ Quattro fanno DUE colonne, non quattro: due per due e' un quadrato,
  //   quattro in fila e' una striscia di francobolli. E' la scelta di Meetly.
  c("quattro camere, due colonne (un quadrato)", 2, col(4));
  c("sei camere, tre colonne", 3, col(6));
  c("sedici camere, la radice", 4, col(16));

  //  ── CON LA LARGHEZZA: il tetto del dispositivo ──
  const TELEFONO = 390, TABLET = 834, DESKTOP = 1440;
  c("tre camere su un telefono: due colonne", 2, col(3, TELEFONO));
  c("sei camere su un telefono: due colonne", 2, col(6, TELEFONO));
  c("tre camere su un tablet: tre colonne", 3, col(3, TABLET));
  c("sedici camere su un desktop: quattro", 4, col(16, DESKTOP));
  //  ⚠️ IL TETTO LIMITA, NON SOSTITUISCE: due camere su un telefono restano
  //   due colonne, perche' ci stanno. Se il tetto sostituisse la regola, un
  //   telefono darebbe sempre il massimo consentito anche a due persone.
  c("due camere su un telefono restano due", 2, col(2, TELEFONO));
  c("una camera resta una anche sul desktop", 1, col(1, DESKTOP));
  //  ⚠️ LA SOGLIA E' 340 E NON 400, e questa prova esiste per tenerla li':
  //   un iPhone in verticale e' 390-393 e un Android comune 360-412, quindi
  //   con la soglia a 400 QUALUNQUE telefono sarebbe finito a colonna singola.
  //   Sotto i 340 ci stanno solo i telefoni davvero piccoli.
  c("iPhone in verticale: due colonne, non una", 2, col(4, 393));
  c("Android comune: due colonne", 2, col(4, 360));
  c("telefono davvero piccolo: una colonna", 1, col(4, 320));
  //  Nessuno sul palco non deve dare zero colonne (griglia rotta).
  c("nessuna camera non da' zero colonne", 1, col(0, TELEFONO));

  // ── NASCONDERE CHI NON PARLA ─────────────────────────────────────────
  const vede = GR.chiSiVede;
  const tre = [{ n: "a", parla: false }, { n: "b", parla: true }, { n: "c", parla: false }];
  c("spento: si vedono tutti", 3, vede(tre, false).length);
  c("acceso: resta solo chi parla", "b", vede(tre, true).map((x) => x.n).join(","));
  //  Se parlano in due si vedono in due: accavallarsi succede, e mostrarne uno
  //  solo farebbe sparire chi sta rispondendo.
  const dueVoci = [{ n: "a", parla: true }, { n: "b", parla: true }, { n: "c", parla: false }];
  c("se parlano in due, si vedono in due", "a,b", vede(dueVoci, true).map((x) => x.n).join(","));
  //  ⚠️ LA REGOLA CHE SALVA LA FUNZIONE: fra una frase e l'altra si respira, e
  //   in quel mezzo secondo lo schermo resterebbe VUOTO - nero, ogni volta che
  //   qualcuno prende fiato.
  const muti = [{ n: "a", parla: false }, { n: "b", parla: false }];
  c("se non parla nessuno non si svuota lo schermo", 2, vede(muti, true).length);
  c("elenco vuoto resta vuoto senza rompere", 0, vede([], true).length);

  // ── COME SI DISPONE LA FASCIA DEI RELATORI ───────────────────────────
  const disp = GR.disposizioneRelatori;
  //  Su un computer due o tre relatori stanno in FILA, e chi parla si allarga
  //  senza che la fascia cambi mai altezza.
  c("due su desktop: una riga", "riga", disp(2, DESKTOP).modo);
  c("tre su desktop: una riga", "riga", disp(3, DESKTOP).modo);
  //  ⚠️ Su un telefono tre affiancati sarebbero tre francobolli larghi due
  //   centimetri: si passa alla griglia, con chi parla sulla prima riga intera.
  c("tre su telefono: griglia", "griglia", disp(3, TELEFONO).modo);
  c("telefono: mai piu' di due affiancati", 2, disp(4, TELEFONO).colonne);
  c("due su telefono: ci stanno in riga", "riga", disp(2, TELEFONO).modo);
  c("tablet: al massimo tre affiancati", 3, disp(5, TABLET).colonne);
  //  ⚠️ Il tetto vale anche quando lo spazio ci sarebbe: cinque relatori su un
  //   monitor grande stanno in quattro colonne, non in cinque - le facce
  //   vogliono aria.
  c("desktop: al massimo quattro affiancati", 4, disp(6, DESKTOP).colonne);
  //  Uno solo occupa tutto, su qualunque schermo.
  c("uno solo: sempre una riga", "riga", disp(1, TELEFONO).modo);
  c("schermo strettissimo: almeno una colonna", 1, disp(3, 200).colonne);
}




/** ── IL FOGLIO DELLE INSTALLAZIONI ─────────────────────────────────────────
 *  ⚠️ MISURATO SUL FOGLIO VERO del committente, non supposto: l'intestazione
 *   dichiara otto colonne, ma la data dell'installazione compare nella settima
 *   su una riga e nella tredicesima su un'altra. Un lettore che si fida della
 *   posizione importa l'indirizzo dentro la data e il prezzo dentro le note.
 */
function proveDelFoglioInstallazioni() {
  const { leggiCsv, scriviCsv, soldiDaCella, dataDaCella, oraDaCella, telefonoDaCella, interpretaRiga, importaCsv, esportaCsv } = ICS;
  gruppo("IL FOGLIO DELLE INSTALLAZIONI");

  /*  ── ⚠️ UN `split(",")` NON BASTA ──────────────────────────────────────
      Dentro le celle ci sono virgole («0,03» e' uno spessore), virgolette e
      perfino a capo: una nota lunga tre righe dentro una cella sola. */
  const righe = leggiCsv('a,"b,c",d\n"riga\ncon a capo",2,3');
  c("la virgola dentro le virgolette non spezza", "b,c", righe[0][1]);
  c("l'a capo dentro le virgolette non spezza", 2, righe.length);
  c("e la cella lo tiene", true, righe[1][0].includes("\n"));
  c("le virgolette doppie diventano una", 'lui ha detto "si"',
    leggiCsv('"lui ha detto ""si"""')[0][0]);
  //  Andata e ritorno: un export che l'import non sa rileggere e' un viaggio
  //  di sola andata, e il guaio si scopre rimettendolo dentro.
  const giroTondo = leggiCsv(scriviCsv([["a", 'b"c', "d,e"], ["1", "2", "3"]]));
  c("quello che si scrive si rilegge", 'b"c', giroTondo[0][1]);
  c("anche con la virgola dentro", "d,e", giroTondo[0][2]);

  /*  ── I SOLDI, SCRITTI COME CAPITA ───────────────────────────────────── */
  c("«€589» sono 589", 589, soldiDaCella("€589").valore);
  c("«350€» sono 350", 350, soldiDaCella("350€").valore);
  c("«€1.100» sono milleccento", 1100, soldiDaCella("€1.100").valore);
  //  «50 + 350» sono due versamenti, non due prezzi.
  c("«50 + 350» fa 400", 400, soldiDaCella("50 + 350").valore);
  //  «289 x2» sono due impianti.
  c("«289 x2» fa 578", 578, soldiDaCella("289 x2").valore);
  //  «ora» vince: e' il prezzo aggiornato.
  c("«€369 - ora €219» sono 219", 219, soldiDaCella("€369 - ora €219").valore);
  /*  ⚠️ E quello che non si capisce si DICE: il numero giusto dentro «589
      forse 650» non lo sa nemmeno chi l'ha scritto, e importarlo in silenzio
      vuol dire fatturare la cifra sbagliata. */
  c("«589 forse 650» alza la mano", true, soldiDaCella("589 forse 650").dubbio);
  c("«589 - sconto 550 - 300 carta» alza la mano", true,
    soldiDaCella("589 - sconto 550 - 300 carta").dubbio);
  c("una cifra sola non alza niente", false, soldiDaCella("€589").dubbio);
  c("una cella vuota vale zero", 0, soldiDaCella("").valore);

  /*  ── LE DATE, ALL'ITALIANA ──────────────────────────────────────────── */
  //  ⚠️ Il giorno viene PRIMA del mese: leggerlo all'americana sposterebbe
  //   meta' delle pose di mesi interi.
  c("«19/04/26» e' il 19 aprile", "2026-04-19", dataDaCella("19/04/26"));
  c("«03/05/26» e' il 3 maggio", "2026-05-03", dataDaCella("03/05/26"));
  c("«27.11.25» si legge coi punti", "2025-11-27", dataDaCella("27.11.25"));
  c("«16/02 ALLE ORE» non e' una data", "", dataDaCella("16/02 ALLE ORE: QUALSIASI"));
  c("il 31 febbraio non esiste", "", dataDaCella("31/02/26"));
  c("una nota non e' una data", "", dataDaCella("gia portatore"));

  /*  ── ⚠️ SOLO I DUE PUNTI PER L'ORA ──────────────────────────────────────
      Accettando anche il punto, «27.11.05» — che e' una data — veniva letto
      come le 11:05: la posa finiva in agenda a un orario che nessuno aveva
      mai detto. */
  c("«alle 10:00» sono le dieci", "10:00", oraDaCella("alle 10:00"));
  c("«Ore 12:00» sono le dodici", "12:00", oraDaCella("27.11.05 - Ore 12:00"));
  c("una data col punto non e' un'ora", "", oraDaCella("27.11.05"));

  /*  ── IL TELEFONO ────────────────────────────────────────────────────── */
  c("un numero e' un numero", "351 324 4425", telefonoDaCella("351 324 4425"));
  //  ⚠️ Almeno otto cifre: «0,03» e' uno spessore e «20» un prezzo, e presi
  //   per telefono farebbero nascere schede fantasma.
  c("uno spessore non e' un telefono", "", telefonoDaCella("0,03"));
  c("una frase non e' un telefono", "", telefonoDaCella("comunicato nuovo prezzo"));

  /*  ── UNA RIGA INTERA ────────────────────────────────────────────────── */
  const r = interpretaRiga([
    "Maurizio Baio", "3494110105", "maurizio.baio@gmail.com", "189", "€589",
    "7.1 40% di bianco 0.04mm", "", "19/04/26", "14:00", "", "", "", "", "", "",
  ]);
  c("prende il nome", "Maurizio Baio", r.nome);
  c("prende il telefono", "3494110105", r.telefono);
  c("prende l'email", "maurizio.baio@gmail.com", r.email);
  c("prende l'acconto", 189, r.pagato);
  c("prende il prezzo", 589, r.totale);
  c("trova la data dove capita", "2026-04-19", r.dataInstallazione);
  c("e l'ora", "14:00", r.ora);
  //  Tutto il resto finisce nelle note: e' quello che il committente ha
  //  chiesto di non perdere.
  c("il modello finisce nelle note", true, r.note.includes("7.1 40% di bianco"));
  c("e i dati gia' presi non ci finiscono", false, r.note.includes("3494110105"));

  //  ⚠️ La data puo' stare in fondo alla riga: sul foglio vero e' nella
  //   tredicesima colonna su certe righe e nella settima su altre.
  const tardi = interpretaRiga([
    "Maurizio Montemagno", "331 577 2594", "", "100", "€589", "", "", "", "", "",
    "16/02 ALLE ORE: QUALSIASI", "", "16/03/26", "dare kit provvisorio", "",
  ]);
  c("la data si trova anche in fondo", "2026-03-16", tardi.dataInstallazione);
  c("e la nota resta nota", true, tardi.note.includes("dare kit provvisorio"));

  //  Una riga senza nome non e' una pratica: sul foglio vero sono le righe
  //  vuote che separano i blocchi.
  c("una riga vuota non diventa una pratica", null, interpretaRiga(["", "", "", ""]));
  c("e nemmeno l'intestazione", null, interpretaRiga(["Nome e Cognome", "Telefono"]));

  /*  ── IL FOGLIO INTERO ───────────────────────────────────────────────── */
  const foglio = [
    "Nome e Cognome,Telefono,E-mail,Pagato,Importo Totale,Modello/Prodotto,Nota",
    "Mario Rossi,3491112223,,100,€589,1b40,,19/04/26,10:00",
    ",,,,,,",
    "Luigi Bianchi,3492223334,,50 + 350,289 x2,castano,,",
  ].join("\n");
  const esito = importaCsv(foglio);
  c("legge due pratiche", 2, esito.righe.length);
  c("salta la riga vuota", 1, esito.saltate);
  c("l'intestazione non diventa una riga", "Mario Rossi", esito.righe[0].nome);
  c("i due versamenti si sommano", 400, esito.righe[1].pagato);

  const fuori = esportaCsv([{ nome: "Mario Rossi", telefono: "349", pagato: 100, totale: 589, data: "2026-04-19", ora: "10:00", note: "1b40, con virgola" }]);
  c("l'export ha l'intestazione", true, fuori.startsWith("Nome e Cognome"));
  c("e la nota con la virgola non spezza il file", 2, leggiCsv(fuori).length);
  c("che si rilegge intera", "1b40, con virgola", leggiCsv(fuori)[1][7]);
}

/** ── COSA DICE DAVVERO UN CODICE FISCALE ───────────────────────────────────
 *  ⚠️ Il nome e il cognome NON si ricavano: il codice ne porta le consonanti
 *   spremute in tre lettere, e da tre consonanti non si torna a una parola.
 *   Quello che si puo' fare e' il controllo. Data di nascita, sesso e comune
 *   invece ci sono per intero.
 */
function proveDelCodiceFiscale() {
  const { cfValido, datiDaCodiceFiscale, anniCompiuti, codiceNome, codiceCognome, combaciaConNome } = CF;
  gruppo("IL CODICE FISCALE");

  const oggi = new Date("2026-09-17T12:00:00Z");

  c("un codice vero passa", true, cfValido("RSSMRA80A01H501U"));
  c("una lettera cambiata non passa", false, cfValido("RSSMRA80A01H501X"));
  c("gli spazi e il minuscolo non contano", true, cfValido(" rss mra 80a01 h501u "));

  /*  ── LA DATA E IL SESSO ───────────────────────────────────────────────── */
  const uomo = datiDaCodiceFiscale("RSSMRA80A01H501U", oggi);
  c("legge la data di nascita", "1980-01-01", uomo.dataNascita);
  c("conta gli anni compiuti", 46, uomo.eta);
  c("riconosce il maschile", "M", uomo.sesso);
  c("tiene il codice del comune", "H501", uomo.comuneNascita);

  //  ⚠️ Nelle donne al giorno si sommano 40: leggerlo male sposta la data di
  //   un mese e mezzo.
  const donna = datiDaCodiceFiscale("RSSMRA80A41H501Y", oggi);
  c("toglie i 40 del femminile", "1980-01-01", donna.dataNascita);
  c("e riconosce il femminile", "F", donna.sesso);

  /*  ── ⚠️ L'OMOCODIA ────────────────────────────────────────────────────
      Quando due persone farebbero lo stesso codice, le cifre diventano
      lettere. Un lettore che non lo sa legge «V» dove c'e' un 9 e sbaglia
      l'anno di novant'anni, in silenzio. */
  const omo = datiDaCodiceFiscale("RSSMRAULA01H501C", oggi);
  c("l'omocodia si ritraduce in cifre", "1980-01-01", omo.dataNascita);

  /*  ── ⚠️ QUALE SECOLO ──────────────────────────────────────────────────
      «80» e' il 1980 o il 2080: si sceglie il passato. Ma con la sola regola
      «se l'anno e' maggiore di oggi togli cento» un bambino del 2019 verrebbe
      letto 1919 — si confronta la data INTERA. */
  const bimbo = datiDaCodiceFiscale("RSSMRA19A01H501K", oggi);
  c("un bambino del 2019 non diventa del 1919", "2019-01-01", bimbo.dataNascita);
  c("e ha l'eta' giusta", 7, bimbo.eta);

  //  Gli anni si contano sul calendario, non dividendo per 365.
  c("chi compie gli anni domani non li ha ancora", 45, anniCompiuti("1980-09-18", oggi));
  c("chi li compie oggi li ha", 46, anniCompiuti("1980-09-17", oggi));
  c("una data storta non da' un'eta'", undefined, anniCompiuti("domani", oggi));

  c("un codice non valido non inventa una data", false, datiDaCodiceFiscale("XXX", oggi).valido);

  /*  ── IL CONTROLLO SU NOME E COGNOME ──────────────────────────────────── */
  c("le tre lettere del cognome", "RSS", codiceCognome("Rossi"));
  //  ⚠️ Con quattro o piu' consonanti si prendono la prima, la TERZA e la
  //   quarta: «Francesco» fa FNC e non FRN, e chi non lo sa dichiara sbagliato
  //   un codice giusto.
  c("il nome con quattro consonanti salta la seconda", "FNC", codiceNome("Francesco"));
  c("un nome corto si riempie con le vocali", "MRA", codiceNome("Mario"));
  c("un cognome cortissimo si riempie di X", "FOX", codiceCognome("Fo"));
  c("gli accenti non contano", "DNG", codiceCognome("D'Angiò"));

  c("nome e cognome che combaciano", "si", combaciaConNome("RSSMRA80A01H501U", "Mario", "Rossi"));
  c("un cognome diverso non combacia", "no", combaciaConNome("RSSMRA80A01H501U", "Mario", "Bianchi"));
  //  ⚠️ Tre risposte e non due: dire «non combacia» a chi non ha ancora
  //   scritto il cognome e' un allarme per una cosa che non e' successa.
  c("senza cognome non si giudica", "non_verificabile", combaciaConNome("RSSMRA80A01H501U", "Mario", ""));
  c("con un codice storto non si giudica", "non_verificabile", combaciaConNome("XXX", "Mario", "Rossi"));
}


/** ── FATTURATO CONTRO INCASSATO ────────────────────────────────────────────
 *  ⚠️ Due numeri da due mondi: quello che il cliente ha pagato e quello che gli
 *   e' stato fatturato. Quando non coincidono la differenza e' un lavoro da
 *   fare — un acconto incassato e mai fatturato — e finora non la vedeva
 *   nessuno finche' non la chiedeva il commercialista.
 */
function proveDelDivario() {
  const { fatturatoDelLead, divarioFattura } = FCL;
  gruppo("FATTURATO CONTRO INCASSATO");

  const fatture = [
    { leadId: "a", totale: 300 },
    { leadId: "a", totale: 250 },
    { leadId: "b", totale: 100 },
  ];
  c("somma solo le fatture di quella scheda", 550, fatturatoDelLead(fatture, "a").totale);
  c("e le conta", 2, fatturatoDelLead(fatture, "a").quante);
  c("una scheda senza fatture vale zero", 0, fatturatoDelLead(fatture, "c").totale);
  c("senza id non si somma niente", 0, fatturatoDelLead(fatture, "").totale);

  c("pari quando coincidono", "pari", divarioFattura(550, 550).stato);
  c("da fatturare quando si e' incassato di piu'", "da_fatturare", divarioFattura(550, 300).stato);
  c("e dice di quanto", 250, divarioFattura(550, 300).differenza);
  //  ⚠️ «Oltre» NON e' un errore: si fattura anche prima di incassare — una
  //   fattura a saldo emessa il giorno prima del bonifico — e chiamarlo guaio
  //   farebbe suonare un allarme su una cosa normale.
  c("oltre quando si e' fatturato di piu'", "oltre", divarioFattura(300, 550).stato);
  //  ⚠️ Un euro di tolleranza: fra l'arrotondamento dell'IVA e i centesimi di
  //   un bonifico, due cifre che sono «la stessa cosa» differiscono di poco — e
  //   un avviso che compare per due centesimi si smette di guardare in una
  //   settimana.
  c("due centesimi non sono un divario", "pari", divarioFattura(550, 549.98).stato);
  c("dieci euro si'", "da_fatturare", divarioFattura(560, 550).stato);
  c("una scheda senza niente non dice niente", "niente", divarioFattura(0, 0).stato);
}

/** ── LO STATO SCELTO A MANO VINCE SULLA REGOLA AUTOMATICA ─────────────────
 *  ⚠️ Segnalazione del committente: da «Acconto incassato» non si riusciva a
 *   passare a nessun altro stato. La conferma compariva — «Michele Porrozzi →
 *   Cliente assente» — e la riga restava com'era: la scrittura partiva e
 *   `applyAutoStatus` la riportava indietro perche' in cassa c'erano dei soldi.
 *   Un guasto cosi' non si vede da nessuna parte: nessun errore, nessuna riga
 *   rossa, solo un gesto che non fa niente.
 */
function proveDelloStatoScelto() {
  const { applyAutoStatus } = TY;
  gruppo("LO STATO SCELTO A MANO");

  const conAcconto = (stato) => ({ stato, payment: { accontoPagato: 100, prezzoFinaleVendita: 500 } });

  //  Senza scelta la regola vale come sempre: chi scrive un acconto su una
  //  trattativa in corso la vede diventare vinta, ed e' il motivo per cui la
  //  regola esiste.
  c("un acconto scritto da solo porta a «acconto»", "acconto", applyAutoStatus(conAcconto("consulenza_fatta")).stato);
  c("e vale anche senza opzioni", "acconto", applyAutoStatus(conAcconto("nuovo")).stato);

  //  ⚠️ Il caso del committente.
  c("scelto a mano, lo stato resta quello scelto", "cliente_assente", applyAutoStatus(conAcconto("cliente_assente"), { statoScelto: true }).stato);
  c("vale per qualunque stato", "da_ricontattare", applyAutoStatus(conAcconto("da_ricontattare"), { statoScelto: true }).stato);
  c("anche tornando indietro del tutto", "nuovo", applyAutoStatus(conAcconto("nuovo"), { statoScelto: true }).stato);

  //  Le tre eccezioni ritagliate a mano prima continuano a funzionare: chi
  //  passa di qui senza dire niente non deve accorgersi di niente.
  c("una chiusura vinta resta dov'e'", "posa_da_spedire", applyAutoStatus(conAcconto("posa_da_spedire")).stato);
  c("«ripensamento» resta", "ripensamento", applyAutoStatus(conAcconto("ripensamento")).stato);
  c("«concluso» resta", "concluso", applyAutoStatus(conAcconto("concluso")).stato);

  //  ⚠️ Il resto delle regole vale SEMPRE, scelta o no: mettono in ordine i
  //   numeri di quello che e' stato deciso, non contraddicono nessuno.
  const perso = applyAutoStatus({ stato: "perdi_tempo", payment: { accontoPagato: 100, prezzoFinaleVendita: 500 } }, { statoScelto: true });
  c("«perdi tempo» azzera gli importi anche se scelto", 0, perso.payment.accontoPagato);
  c("e lo stato del pagamento", "nessun_pagamento", perso.payment.statoPagamento);
  const saldo = applyAutoStatus({ stato: "cliente_assente", payment: { accontoPagato: 100, prezzoFinaleVendita: 500 } }, { statoScelto: true });
  c("il saldo si ricalcola comunque", 400, saldo.payment.saldoRimanente);
  c("senza acconto non cambia niente", "cliente_assente", applyAutoStatus({ stato: "cliente_assente", payment: { accontoPagato: 0 } }).stato);
}

/** ── TRACCIATO E CONTANTI, SENZA CONTARLI DUE VOLTE ───────────────────────
 *  ⚠️ Il CRM chiede «quanto e' in contanti» in due momenti: registrando la
 *   vendita (e allora parla del TOTALE, mentre in cassa c'e' solo l'acconto) e
 *   registrando la posa (e allora parla del saldo appena incassato). Sommarle
 *   farebbe piu' contanti del prezzo della pratica — un numero che poi legge
 *   la contabilita'. Qui si tiene ferma la regola che le mette insieme.
 */
/** ── LO SCONTO FATTO ALLA CONSEGNA ────────────────────────────────────────
 *  ⚠️ Abbassa il prezzo della pratica, quindi da lui dipendono margine, IVA
 *   scorporata e tasse. Una sottrazione sbagliata qui non si vede: si vede il
 *   mese dopo, nel totale che non torna.
 */
function proveDelloSconto() {
  const { prezzoScontato } = CP;
  gruppo("LO SCONTO ALLA CONSEGNA");

  c("toglie la cifra scritta", 600, prezzoScontato(650, 50));
  c("senza sconto non cambia niente", 650, prezzoScontato(650, 0));
  c("e nemmeno con uno sconto non detto", 650, prezzoScontato(650, undefined));
  //  ⚠️ Uno sconto piu' grande del prezzo darebbe una pratica di valore
  //   negativo: nelle KPI diventerebbe un ricavo che si sottrae agli altri.
  c("piu' del prezzo azzera, non va sotto", 0, prezzoScontato(650, 900));
  c("uno sconto negativo non e' un aumento", 650, prezzoScontato(650, -50));
  c("i centesimi restano in ordine", 599.9, prezzoScontato(650, 50.1));
  c("un prezzo illeggibile vale zero", 0, prezzoScontato("boh", 50));
}

function proveDelCanale() {
  const { divisioneMovimento, canaleDopoIncasso, ripartisciCanale } = CIN;
  gruppo("COME SONO ENTRATI I SOLDI");

  /*  ── UN MOVIMENTO SOLO ────────────────────────────────────────────── */
  c("il tracciato e' il resto", 200, divisioneMovimento(430, 230).tracciato);
  c("e il contante quello detto", 230, divisioneMovimento(430, 230).contanti);
  c("zero contanti = tutto tracciato", 430, divisioneMovimento(430, 0).tracciato);
  //  ⚠️ Vuoto e zero sono due cose diverse: zero e' una dichiarazione, vuoto e'
  //   un silenzio — e un silenzio non deve riscrivere niente in archivio.
  c("non detto non e' zero", null, divisioneMovimento(430, undefined));
  //  ⚠️ Una battitura non deve produrre un tracciato negativo: «-170 tracciati»
  //   resta scritto e nessuno sa piu' da dove viene.
  c("piu' del movimento si taglia", 430, divisioneMovimento(430, 600).contanti);
  c("e il tracciato non va sotto zero", 0, divisioneMovimento(430, 600).tracciato);

  /*  ── ⚠️ IL CASO CHE HA FATTO NASCERE QUESTO FILE ───────────────────────
      Michele Porrozzi: prezzo 530, versati 100, alla vendita dichiarati 250 in
      contanti sul totale. Adesso salda 430, tutti in contanti. Sommando le due
      dichiarazioni verrebbero 680 di contanti su una pratica da 530. */
  const mp = canaleDopoIncasso({
    versatoPrima: 100,
    tracciatoPrima: 280,
    contantiPrima: 250,
    incassato: 430,
    contantiOra: 430,
  });
  c("i contanti non superano il prezzo", true, mp.contanti + mp.tracciato <= 530.01);
  c("della vendita vale solo la quota gia' entrata", 100, Math.round((mp.contanti + mp.tracciato - 430) * 100) / 100);
  c("e il saldo di adesso vale per intero", true, mp.contanti >= 430);

  /*  ── SENZA DICHIARAZIONE ALLA VENDITA ──────────────────────────────────
      La parte gia' in cassa resta NON attribuita: nessuno ha mai detto com'e'
      entrata, e inventare «tutto tracciato» sarebbe una dichiarazione falsa. */
  const senza = canaleDopoIncasso({ versatoPrima: 100, incassato: 430, contantiOra: 200 });
  c("resta solo quello che si e' dichiarato adesso", 430, senza.tracciato + senza.contanti);
  c("con il contante al posto giusto", 200, senza.contanti);

  //  Se adesso non si dice niente non si tocca l'archivio.
  c("niente detto adesso, niente scritto", null, canaleDopoIncasso({ versatoPrima: 100, contantiPrima: 250, tracciatoPrima: 280, incassato: 430 }));

  //  Quando l'acconto copre gia' tutto il dichiarato, la vendita vale per
  //  intero: non c'era nessuna previsione da sostituire.
  const tutto = canaleDopoIncasso({ versatoPrima: 530, tracciatoPrima: 280, contantiPrima: 250, incassato: 100, contantiOra: 0 });
  c("dichiarazione intera quando era tutto entrato", 250, tutto.contanti);
  c("e il nuovo movimento si aggiunge", 380, tutto.tracciato);

  /*  ── L'INCASSO DIVISO IN PIU' RIGHE ────────────────────────────────── */
  const righe = ripartisciCanale([300, 100], 200);
  c("il contante si spalma in proporzione", 150, righe[0].contanti);
  //  ⚠️ L'ultima riga chiude la somma: arrotondando riga per riga i centesimi
  //   si perdono, e le righe non tornerebbero piu' con la cifra dichiarata.
  c("e le righe tornano con il dichiarato", 200, righe[0].contanti + righe[1].contanti);
  //  400 incassati, 200 dichiarati in contanti: il tracciato e' l'altra meta'.
  c("il tracciato e' il resto di ogni riga", 200, righe[0].tracciato + righe[1].tracciato);
  c("non detto: nessuna riga porta il taglio", null, ripartisciCanale([300, 100], undefined)[0]);
}

/** ── LA FOTOGRAFIA DEL DOCUMENTO ───────────────────────────────────────────
 *  ⚠️ Il codice fiscale battuto a mano e' il campo che si sbaglia piu' spesso
 *   di tutto il gestionale, e una fattura con un codice fiscale sbagliato
 *   viene scartata dallo SDI giorni dopo — quando quella persona non risponde
 *   piu' al telefono. Qui si controlla che quello che arriva dalla fotografia
 *   sia vero prima di metterlo su un documento fiscale.
 */
function proveDellaLetturaDocumento() {
  const { codiceFiscaleValido, comeUnNome, leggiJsonDocumento, normalizzaDocumento, innestaDocumento } = LD;
  gruppo("I DATI LETTI DA UN DOCUMENTO");

  /*  ── IL CARATTERE DI CONTROLLO ─────────────────────────────────────────
      Esiste apposta: una lettura sbagliata di un solo carattere — «0» e «O»,
      «1» e «I» — passa inosservata a occhio. */
  c("un codice fiscale vero passa", true, codiceFiscaleValido("RSSMRA80A01H501U"));
  c("una lettera cambiata non passa", false, codiceFiscaleValido("RSSMRA80A01H501X"));
  c("uno corto non passa", false, codiceFiscaleValido("RSSMRA80A01H50"));
  c("gli spazi non contano", true, codiceFiscaleValido(" rssmra80a01h501u "));
  c("il vuoto non passa", false, codiceFiscaleValido(""));

  //  «MARIO ROSSI» sulla tessera, «Mario Rossi» in fattura.
  c("il maiuscolo diventa un nome", "Mario Rossi", comeUnNome("MARIO ROSSI"));
  c("i pezzi restano separati", "De Luca", comeUnNome("DE LUCA"));
  c("l'apostrofo alza la lettera dopo", "Sant'Elia", comeUnNome("SANT'ELIA"));

  /*  ── IL JSON ARRIVA COME CAPITA ────────────────────────────────────── */
  const dentro = leggiJsonDocumento('```json\n{"nome":"MARIO","cognome":"ROSSI","codiceFiscale":"RSSMRA80A01H501U","cap":"70100","comune":"BARI","provincia":"ba","indirizzo":"VIA ROMA 1"}\n```');
  c("il recinto non da' fastidio", "Mario", dentro.nome);
  c("il codice fiscale resta maiuscolo", "RSSMRA80A01H501U", dentro.codiceFiscale);
  c("la provincia diventa due lettere maiuscole", "BA", dentro.provincia);
  c("il comune si legge come un nome", "Bari", dentro.comune);
  c("una risposta a parole non rompe niente", 0, Object.keys(leggiJsonDocumento("Non riesco a leggere")).length);
  c("e nemmeno il vuoto", 0, Object.keys(leggiJsonDocumento("")).length);

  /*  ── ⚠️ QUELLO CHE NON SUPERA IL CONTROLLO NON ENTRA ──────────────────
      Un dato storto in un campo vuoto e' peggio del campo vuoto, perche'
      nessuno lo va piu' a guardare. */
  const storto = normalizzaDocumento({ codiceFiscale: "RSSMRA80A01H501X", cap: "7010", provincia: "BARI" });
  c("un codice fiscale che non torna non entra", undefined, storto.codiceFiscale);
  c("un CAP di quattro cifre non entra", undefined, storto.cap);
  c("una provincia di quattro lettere non entra", undefined, storto.provincia);

  /*  ── ⚠️ NON SI SOVRASCRIVE MAI QUELLO CHE C'E' GIA' ───────────────────
      Chi ha scritto quel dato puo' averlo corretto apposta — un cliente che ha
      cambiato casa — e vedersi riscrivere sopra da una fotografia e' il modo
      piu' veloce per smettere di fidarsi del pulsante. */
  const esito = innestaDocumento(
    { nome: "Marco", cognome: "", codiceFiscale: "", comune: "Roma" },
    { nome: "Mario", cognome: "Rossi", codiceFiscale: "RSSMRA80A01H501U", comune: "Bari" },
  );
  c("il nome scritto a mano resta", "Marco", esito.dati.nome);
  c("il cognome vuoto si riempie", "Rossi", esito.dati.cognome);
  c("il codice fiscale vuoto si riempie", "RSSMRA80A01H501U", esito.dati.codiceFiscale);
  c("si dice cosa e' stato riempito", true, esito.riempiti.includes("codice fiscale"));
  c("e cosa e' stato lasciato stare", true, esito.giaPresenti.includes("nome"));
  c("il comune diverso non si tocca", "Roma", esito.dati.comune);
  //  Un dato identico a quello che c'e' gia' non e' un conflitto: e' una
  //  conferma, e dirlo sarebbe rumore.
  const uguale = innestaDocumento({ nome: "Mario" }, { nome: "mario" });
  c("un dato uguale non si segnala", 0, uguale.giaPresenti.length);
  c("e nemmeno si conta fra i riempiti", 0, uguale.riempiti.length);

  /*  ── COSA SI PUO' CARICARE ────────────────────────────────────────────
      La tessera fotografata col telefono arriva come immagine, quella mandata
      dal commercialista o scaricata dallo SPID arriva come PDF. Chiedere di
      convertirla vuol dire non usare il tasto. */
  const { documentoAccettabile } = LD;
  const finta = (mime, kb) => `data:${mime};base64,${"A".repeat(Math.round((kb * 1024 * 4) / 3))}`;
  c("una foto passa", true, documentoAccettabile(finta("image/jpeg", 300)).ok);
  c("un PDF passa", true, documentoAccettabile(finta("application/pdf", 300)).ok);
  c("e si sa che e' un PDF", "pdf", documentoAccettabile(finta("application/pdf", 300)).tipo);
  c("un HEIC di iPhone passa", true, documentoAccettabile(finta("image/heic", 300)).ok);
  c("un video no", false, documentoAccettabile(finta("video/mp4", 300)).ok);
  c("un foglio di calcolo no", false, documentoAccettabile(finta("application/vnd.ms-excel", 30)).ok);
  //  ⚠️ Il minimo e' basso apposta: un PDF di solo testo — una tessera
  //   scaricata, non fotografata — pesa pochi kilobyte ed e' leggibilissimo.
  c("un PDF piccolo ma vero passa", true, documentoAccettabile(finta("application/pdf", 20)).ok);
  c("un file vuoto no", false, documentoAccettabile(finta("image/png", 1)).ok);
  c("un file enorme no", false, documentoAccettabile(finta("image/jpeg", 9000)).ok);
  c("una stringa a caso no", false, documentoAccettabile("ciao").ok);

  /*  ── CHE DOCUMENTO ERA ────────────────────────────────────────────────
      Dirlo a schermo e' il modo piu' rapido per accorgersi di aver caricato il
      file sbagliato. */
  const doc = normalizzaDocumento({ documenti: ["Tessera Sanitaria", "carta d'identità"] });
  c("riconosce la tessera", true, doc.documenti.includes("tessera sanitaria"));
  c("e la carta d'identita'", true, doc.documenti.includes("carta d'identità"));
  //  ⚠️ Solo i nomi conosciuti: quello che arriva e' testo di un modello e
  //   finisce a schermo. «Altro» dice la stessa cosa senza far pensare che il
  //   programma sappia qualcosa che non sa.
  c("un documento inventato diventa «altro»", true,
    normalizzaDocumento({ documenti: ["carta regionale dei servizi"] }).documenti.includes("altro"));
  c("i doppioni si contano una volta", 1,
    normalizzaDocumento({ documenti: ["patente", "patente"] }).documenti.length);
  c("senza documenti non si inventa un elenco", undefined, normalizzaDocumento({}).documenti);
  //  ⚠️ «documenti» non e' un campo del cliente: innestarlo vorrebbe dire
  //   provare a scriverlo dentro l'intestazione della fattura.
  const conDoc = innestaDocumento({ nome: "" }, { nome: "Mario", documenti: ["patente"] });
  c("l'elenco dei documenti non entra nell'intestazione", undefined, conDoc.dati.documenti);
}

/** ── ACCONTO, SALDO O FATTURA INTERA ───────────────────────────────────────
 *  ⚠️ DIFETTO SEGNALATO: a clienti che avevano versato SOLO l'acconto la
 *   finestra proponeva «saldo». La vecchia regola guardava una cosa sola —
 *   quanto resta da incassare — e su una pratica senza prezzo scritto quel
 *   numero e' zero: niente da incassare, quindi saldo. Ma zero perche' il
 *   prezzo non c'e' non e' «pagato tutto», e' «non lo sappiamo».
 */
function proveDelTipoProposto() {
  const { tipoProposto } = FC;
  gruppo("ACCONTO, SALDO O FATTURA INTERA");

  //  ⚠️ IL CASO DEL DIFETTO: acconto versato, prezzo mai scritto.
  c("solo acconto e prezzo ignoto: acconto", "acconto", tipoProposto({ versato: 750, prezzo: 0 }));
  c("acconto su prezzo noto: acconto", "acconto", tipoProposto({ versato: 750, prezzo: 2500 }));
  c("niente incassato: acconto", "acconto", tipoProposto({ versato: 0, prezzo: 2500 }));
  //  Pagato tutto e prezzo noto: un documento solo per tutta l'operazione.
  c("pagato tutto: fattura intera", "unica", tipoProposto({ versato: 2500, prezzo: 2500 }));
  c("un centesimo di scarto resta intera", "unica", tipoProposto({ versato: 2499.995, prezzo: 2500 }));
  //  ⚠️ «Saldo» ha senso SOLO dopo una fattura di acconto: e' il documento che
  //   scomputa quello che e' gia' stato fatturato. Senza, non salda niente.
  c("dopo un acconto gia' fatturato: saldo", "saldo",
    tipoProposto({ versato: 750, prezzo: 2500, accontoGiaFatturato: true }));
  c("e vale anche se nel frattempo ha pagato tutto", "saldo",
    tipoProposto({ versato: 2500, prezzo: 2500, accontoGiaFatturato: true }));
  //  Senza niente in mano non si propone «saldo»: si propone la cosa che non
  //  fa danni.
  c("pratica vuota: acconto", "acconto", tipoProposto({ versato: 0, prezzo: 0 }));
}

/** ── QUANDO UNA FATTURA TORNA BOZZA ──────────────────────────────────────
 *  Richiesta del committente: «se elimino una fattura torna in bozza
 *  precompilata con stessi dati».
 *
 *  ⚠️ PERCHE' QUESTE PROVE ESISTONO. Il guasto che possono prendere non si
 *   vede a schermo. `comeBozza` deve togliere ESATTAMENTE i campi che dicono
 *   «questo documento e' stato emesso» e non uno di piu':
 *    · ne toglie uno in meno (per esempio si dimentica `numero`) → la bozza si
 *      porta addosso «2026/0007», che intanto e' stato riassegnato a un'altra
 *      fattura: due documenti con lo stesso numero sotto gli occhi;
 *    · ne toglie uno in piu' (per esempio azzera `cliente`) → la bozza
 *      «precompilata» e' vuota, cioe' il contrario di quello che e' stata
 *      chiesta, e il codice fiscale si ribatte a mano.
 *   Per questo l'ultima prova non elenca i campi tenuti: confronta TUTTE le
 *   chiavi e pretende che le uniche cambiate siano le nove dichiarate. Un
 *   campo aggiunto domani alla fattura e azzerato per sbaglio la fa fallire.
 */
function proveDelRitornoInBozza() {
  const { comeBozza } = FT;
  gruppo("UNA FATTURA ELIMINATA TORNA BOZZA");

  const emessa = {
    id: "2026-0007",
    stato: "emessa",
    numero: 7,
    anno: 2026,
    serie: "A",
    data: "2026-08-28",
    dataPagamento: "2026-08-28",
    tipo: "acconto",
    leadId: "lead-42",
    leadNome: "Mario Rossi",
    preventivoRef: "PR-9",
    cliente: { denominazione: "", nome: "Mario", cognome: "Rossi", codiceFiscale: "RSSMRA80A01H501U", pec: "m@r.it" },
    righe: [{ descrizione: "Acconto impianto", quantita: 1, prezzoUnitario: 1000, aliquota: 22 }],
    causale: "Conferma d'ordine",
    imponibile: 1000,
    imposta: 220,
    totale: 1220,
    creataIl: "2026-08-20T10:00:00.000Z",
    emessaIl: "2026-08-30T09:00:00.000Z",
    emailOrigine: "mario@rossi.it",
    metodoPagamento: "bonifico",
  };
  const b = comeBozza(emessa);

  //  ── QUELLO CHE SE NE VA: e' il documento emesso, non i dati.
  c("torna in stato bozza", "bozza", b.stato);
  //  ⚠️ Il numero e' la cosa piu' pericolosa da tenere: la numerazione si
  //   ricava dall'archivio, quindi il 7 lo prendera' un'altra fattura.
  c("il numero torna a zero", 0, b.numero);
  c("la serie si svuota", "", b.serie);
  c("la data del documento si svuota", "", b.data);
  c("la data dell'incasso si svuota", "", b.dataPagamento);
  c("il momento dell'emissione si svuota", "", b.emessaIl);
  //  L'id di una bozza e' la sua chiave in archivio: `bozza:<idLead>`.
  c("l'id diventa quello di una bozza", "bozza:lead-42", b.id);

  //  ── QUELLO CHE RESTA: tutto il lavoro raccolto.
  c("il cliente resta intero", "RSSMRA80A01H501U", b.cliente.codiceFiscale);
  c("le righe restano", "Acconto impianto", b.righe[0].descrizione);
  c("la causale resta", "Conferma d'ordine", b.causale);
  c("gli importi restano", 1220, b.totale);
  //  ⚠️ `tipo` DEVE sopravvivere: «acconto» dice al saldo che quell'imponibile
  //   e' gia' fatturato. Perso qui, il saldo lo fattura una seconda volta.
  c("acconto resta acconto", "acconto", b.tipo);
  c("il metodo di pagamento resta", "bonifico", b.metodoPagamento);
  c("la scheda cliente resta", "lead-42", b.leadId);
  c("l'email con cui era nata resta", "mario@rossi.it", b.emailOrigine);

  //  ⚠️ LE BOZZE SI ORDINANO PER `creataIl`: tenendo quella vecchia, una
  //   fattura di agosto rimessa in bozza oggi rinascerebbe in fondo
  //   all'elenco, dove chi l'ha appena eliminata non la cerca.
  c("torna in cima alle bozze", true, b.creataIl > emessa.creataIl);

  //  ⚠️ NON TOCCA L'ORIGINALE: `rimettiInBozza` scrive la bozza e SOLO DOPO
  //   cancella la fattura. Se la trasformazione mutasse l'oggetto, fra le due
  //   scritture la fattura in memoria sarebbe gia' senza numero.
  c("l'originale resta emesso", "emessa", emessa.stato);
  c("l'originale tiene il suo numero", 7, emessa.numero);

  //  Rifarlo su una bozza non cambia niente: il gesto si puo' ripetere.
  const due = comeBozza(b);
  c("rifarlo su una bozza non cambia lo stato", "bozza", due.stato);
  c("rifarlo non cambia l'id", b.id, due.id);

  //  ── ⚠️ NESSUN ALTRO CAMPO SI MUOVE ────────────────────────────────────
  //   La prova che vale per i campi che non esistono ancora.
  const CAMBIATI = ["id", "stato", "numero", "serie", "anno", "data", "dataPagamento", "emessaIl", "creataIl"];
  const mossi = Object.keys(emessa).filter(
    (k) => !CAMBIATI.includes(k) && JSON.stringify(emessa[k]) !== JSON.stringify(b[k]),
  );
  c("non tocca nient'altro", [], mossi);
  //  E non ne inventa: le chiavi sono le stesse.
  c("non aggiunge campi", Object.keys(emessa).sort(), Object.keys(b).sort());

  //  ⚠️ SENZA SCHEDA LA CHIAVE SAREBBE IL PREFISSO STESSO: `rimettiInBozza` si
  //   rifiuta di salvarla (e la finestra lo dice prima), ma qui si fissa che
  //   l'id degenere e' riconoscibile invece di sembrare una bozza qualunque.
  c("senza scheda l'id resta spoglio", "bozza:", comeBozza({ ...emessa, leadId: "" }).id);
}

/** ── DA QUANDO UNA SCHEDA E' IN QUESTO STATO ──────────────────────────────
 *  ⚠️ Segnalazione del committente: «se metto segreteria dev'essere
 *   categorizzato nel giorno corretto, e il giorno dopo devo poter filtrare
 *   per quando ho messo quello stato».
 *   L'istante lo scrive `updateLead` in UTC; tagliarne i primi dieci caratteri
 *   da' il giorno SBAGLIATO per tutta la fascia in cui in Italia e' gia'
 *   domani e a Greenwich no.
 */
function proveDelQuandoStato() {
  const { giornoLocale, giornoDelloStato, giorniFa, dentroLaFetta } = QST;
  gruppo("DA QUANDO E' IN QUESTO STATO");

  /*  ── ⚠️ IL GUASTO, IN UNA RIGA ─────────────────────────────────────────
      Un istante che in Italia e' l'una di notte del 23 settembre, a Greenwich
      e' ancora il 22 (ora legale: +2). Tagliando la stringa si ottiene il 22.
      Qui si vuole il giorno in cui la telefonata e' stata fatta DAVVERO. */
  const notte = "2026-09-22T23:30:00.000Z";       // in Italia: 23/09 all'1:30
  c("il taglio della stringa darebbe il giorno prima", "2026-09-22", notte.slice(0, 10));
  //  ⚠️ La prova gira nel fuso della macchina: si verifica che il giorno locale
  //   sia quello che il browser stesso calcola, non un numero scritto a mano —
  //   altrimenti passerebbe solo in Italia e fallirebbe su un server a Londra.
  const atteso = (() => {
    const d = new Date(notte);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  c("si legge il giorno locale", atteso, giornoLocale(notte));

  //  ⚠️ Un valore che e' GIA' un giorno non passa da Date: una data senza ora
  //   vale mezzanotte UTC, e in Italia mezzanotte UTC e' il giorno prima.
  c("un giorno resta quel giorno", "2026-09-22", giornoLocale("2026-09-22"));
  c("niente in entrata, niente in uscita", "", giornoLocale(""));
  c("una data illeggibile non inventa un giorno", "", giornoLocale("boh"));

  /*  ── IL RIPIEGO: CHI NON E' MAI STATO TOCCATO ──────────────────────────
      Una lista appena importata non ha nessun cambio di stato: quelle schede
      sono «da contattare» da quando sono arrivate. Rispondere «non si sa» le
      farebbe sparire da ogni filtro sul tempo, cioe' proprio le liste nuove. */
  c("senza cambi vale il giorno d'arrivo", "2026-09-20",
    giornoDelloStato({ createdAt: "2026-09-20T09:00:00.000Z" }));
  c("col cambio vale il cambio", "2026-09-22",
    giornoDelloStato({ statoPrecedenteIl: "2026-09-22T09:00:00.000Z", createdAt: "2026-09-20T09:00:00.000Z" }));
  c("senza niente non si inventa", "", giornoDelloStato({}));

  /*  ── QUANTI GIORNI FA ──────────────────────────────────────────────── */
  const OGGI = "2026-09-22";
  c("oggi e' zero giorni fa", 0, giorniFa("2026-09-22", OGGI));
  c("ieri e' uno", 1, giorniFa("2026-09-21", OGGI));
  //  ⚠️ Il conto deve reggere il cambio di mese: e' il giorno in cui una prova
  //   scritta con la sottrazione dei numeri si rompe.
  c("e regge il cambio di mese", 1, giorniFa("2026-08-31", "2026-09-01"));
  c("una data storta non e' un numero", null, giorniFa("boh", OGGI));

  /*  ── LE FETTE ──────────────────────────────────────────────────────── */
  const ieri = { statoPrecedenteIl: "2026-09-21T10:00:00.000Z" };
  const oggiStato = { statoPrecedenteIl: "2026-09-22T10:00:00.000Z" };
  const vecchio = { statoPrecedenteIl: "2026-09-01T10:00:00.000Z" };
  c("«oggi» prende quelli di oggi", true, dentroLaFetta(oggiStato, "oggi", OGGI));
  c("e non quelli di ieri", false, dentroLaFetta(ieri, "oggi", OGGI));
  c("«ieri» prende quelli di ieri", true, dentroLaFetta(ieri, "ieri", OGGI));
  c("la settimana comprende oggi", true, dentroLaFetta(oggiStato, "settimana", OGGI));
  c("e anche ieri", true, dentroLaFetta(ieri, "settimana", OGGI));
  c("ma non tre settimane fa", false, dentroLaFetta(vecchio, "settimana", OGGI));

  /*  ── ⚠️ «SEMPRE» NON NASCONDE NESSUNO ──────────────────────────────────
      Una scheda di cui non si sa niente non va nascosta dal filtro che
      dichiara di non filtrare. Le altre fette invece la escludono: «oggi» deve
      voler dire oggi, non «oggi e quelli che non sappiamo». */
  c("«sempre» prende anche chi non ha date", true, dentroLaFetta({}, "sempre", OGGI));
  c("«oggi» no", false, dentroLaFetta({}, "oggi", OGGI));
  c("e nemmeno la settimana", false, dentroLaFetta({}, "settimana", OGGI));
}

/** ── LEGGERE UNA LISTA DI CONTATTI ────────────────────────────────────────
 *  ⚠️ Il file che ha fatto nascere queste prove e' una lista Meta passata da
 *   Fogli Google: diciannove colonne di intestazione, diciannove valori per
 *   riga, e dalla dodicesima in poi NON COMBACIANO — sotto «phone_number» c'e'
 *   l'email, sotto «email» il nome, sotto «full_name» la risposta a una
 *   domanda del modulo. A occhio il file sembra a posto.
 *   Fidandosi dell'intestazione si importano trenta schede con l'email nel
 *   campo del telefono, e il guasto si scopre chiamando.
 */
function proveDellaListaImportata() {
  const { traduciCsv } = IMP;
  gruppo("LEGGERE UNA LISTA DI CONTATTI");

  /*  ── CHI È GIÀ IN ARCHIVIO: UNA REGOLA SOLA ────────────────────────────
      `chiaveLead` aveva una sua idea di «stesso numero» (almeno 8 cifre)
      diversa da quella dell'avviso del campo rosso (6, crm/telefono-doppio):
      sulla stessa riga l'avviso diceva «ce l'abbiamo già» e l'importazione
      creava una scheda nuova. E senza telefono la chiave era `n:|` anche a
      campi vuoti, cioè due schede incomplete erano «la stessa persona». */
  const { chiaveLead, separaRitorni } = IMP;
  c("lo stesso numero scritto in due modi fa una chiave sola",
    chiaveLead({ telefono: "+39 333 1234567" }), chiaveLead({ telefono: "3331234567" }));
  c("e anche con lo zero zero davanti",
    chiaveLead({ telefono: "00393331234567" }), chiaveLead({ telefono: "333-1234567" }));
  //  ⚠️ La soglia è quella di telefono-doppio, non una seconda scritta qui.
  c("sette cifre bastano, come per l'avviso del campo rosso", true,
    chiaveLead({ telefono: "0612345" }).startsWith("t:"));
  //  Senza numero: nome E cognome, tutti e due.
  c("senza numero valgono nome e cognome", "n:mario|rossi",
    chiaveLead({ nome: " Mario ", cognome: "ROSSI" }));
  c("col solo nome non si riconosce nessuno", "", chiaveLead({ nome: "Mario" }));
  c("e a campi vuoti nemmeno", "", chiaveLead({}));
  //  ⚠️ IL CUORE: due schede senza niente dentro NON sono la stessa persona.
  const esito = separaRitorni(
    [{ nome: "", cognome: "", telefono: "" }, { nome: "", cognome: "", telefono: "" }],
    [],
  );
  c("due righe senza identità restano due", 2, esito.nuovi.length);
  c("e nessuna delle due risulta «ripetuta»", 0, esito.ripetute);
  //  Mentre lo stesso numero scritto diverso è davvero una persona sola.
  const esito2 = separaRitorni(
    [{ nome: "Ada", telefono: "+39 333 1234567" }, { nome: "Ada", telefono: "3331234567" }],
    [],
  );
  c("lo stesso numero due volte nel file: una scheda sola", 1, esito2.nuovi.length);
  c("e la seconda è contata come ripetuta", 1, esito2.ripetute);
  //  E ritrova la scheda in archivio anche se lì il numero è scritto in un
  //  altro modo: è il contatto di ritorno.
  const esito3 = separaRitorni(
    [{ nome: "Ada", telefono: "3331234567" }],
    [{ id: "a1", data: { nome: "Ada", telefono: "+39 333 1234567" } }],
  );
  c("la scheda in archivio si ritrova col numero scritto diverso", 1, esito3.ritorni.length);
  c("e non si crea niente di nuovo", 0, esito3.nuovi.length);

  //  Il file vero, ridotto a tre righe: stessa intestazione, stesso scarto.
  const META_STORTO = [
    "  ,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,form_name,is_organic,platform,quanto_ti_infastidisce_la_calvizie?,cosa_hai_gia_fatto?,full_name,email,phone_number,lead_status,che_problematica_hai?",
    'l:2055445158436359,2026-09-21T01:33:01-05:00,ag:1202518,589\u20ac - 001 - ok,as:1202518,BROAD | ITALIA,c:1202518,Hair Genius | Copy 2,f:928920,"Modulo senza titolo 30/11/24, 01:36",false,fb,alopecia_androgenetica,abbastanza_,nulla,Michele Ruggiero,leleruggiero@gmail.com,p:+393473478192,',
    'l:1116838917697560,2026-09-21T01:37:25-05:00,ag:1202518,589\u20ac - 001 - ok,as:1202518,BROAD | ITALIA,c:1202518,Hair Genius | Copy 2,f:928920,"Modulo senza titolo 30/11/24, 01:36",false,ig,alopecia_areata,abbastanza_,trapianto,Valter Ciaparrone,valtercia06@gmail.com,p:+393883733705,',
    'l:1682429130145308,2026-09-21T01:37:38-05:00,ag:1202518,589\u20ac - 001 - ok,as:1202518,BROAD | ITALIA,c:1202518,Hair Genius | Copy 2,f:928920,"Modulo senza titolo 30/11/24, 01:36",false,fb,alopecia_areata,poco,nulla,antonio,ingrassiaa528@gmail.com,p:0277002845,',
  ].join("\n");
  const m = traduciCsv(META_STORTO);
  c("legge tutte le righe, non ne scarta nessuna", 3, m.leads.length);
  c("nessuna scartata", 0, m.scartate);

  //  ⚠️ IL NOME. L'intestazione lo mette sotto «email»; guardando i dati si
  //   trova dov'e' davvero. E «full_name» e' una casella sola: si divide.
  c("il nome arriva giusto", "Michele", m.leads[0].nome);
  c("e il cognome pure", "Ruggiero", m.leads[0].cognome);
  //  Un nome di una parola sola resta una persona: «antonio» e' in quel file.
  c("un nome solo resta un nome", "antonio", m.leads[2].nome);

  //  ⚠️ IL TELEFONO. L'intestazione lo mette sotto «lead_status», e il prefisso
  //   «p:» e' di Meta: lasciato dentro non si chiama e non si cerca piu'.
  c("il telefono arriva giusto", "+393473478192", m.leads[0].telefono);
  c("il prefisso p: sparisce", true, !/^p:/.test(m.leads[1].telefono));
  //  ⚠️ E un fisso senza prefisso internazionale e' un telefono lo stesso.
  c("anche un numero fisso", "0277002845", m.leads[2].telefono);
  //  ⚠️ Le due prove che tengono in piedi tutto il resto: nella colonna del
  //   telefono NON deve finire ne' l'identificativo di Facebook (sedici cifre)
  //   ne' il nome del modulo (che di cifre ne ha dieci).
  c("nessun identificativo di Facebook come telefono", 0,
    m.leads.filter((l) => /^l:/.test(l.telefono || "")).length);
  c("nessun nome di modulo come telefono", 0,
    m.leads.filter((l) => /[A-Za-z]/.test(l.telefono || "")).length);

  c("l'email arriva giusta", "leleruggiero@gmail.com", m.leads[0].email);
  c("nessuna email finita nel telefono", 0,
    m.leads.filter((l) => /@/.test(l.telefono || "")).length);

  //  ⚠️ «fb» e «ig» sono inserzioni: senza questa riga ogni lead pagato
  //   entrava come «Organico» e il costo per contatto risultava sbagliato.
  c("una lista Meta e' pubblicita'", "ADV", m.leads[0].fonte);
  c("anche da Instagram", "ADV", m.leads[1].fonte);
  c("la data del modulo diventa la data d'arrivo", true, /^2026-09-21/.test(m.leads[0].createdAt));

  //  Le risposte del modulo finiscono nelle note: chi telefona sa gia' con chi
  //  sta parlando. ⚠️ Senza l'etichetta della domanda, perche' su questo file
  //   l'intestazione e' spostata e scriverla sarebbe stampare una bugia.
  c("le risposte del modulo restano", true, /alopecia androgenetica/.test(m.leads[0].note || ""));
  c("e non ci finisce il nome del modulo", false, /Modulo senza titolo/.test(m.leads[0].note || ""));
  c("ne' il nome della campagna", false, /BROAD|Hair Genius/.test(m.leads[0].note || ""));

  /*  ── ⚠️ E UN FILE NORMALE NON DEVE CAMBIARE ────────────────────────────
      Il controllo sui dati scatta solo quando l'intestazione e' smentita: su
      un file scritto bene non tocca niente, o «riparerebbe» quello che era
      gia' giusto. */
  const normale = traduciCsv(
    "nome;cognome;telefono;email;citta\nMario;Rossi;3331234567;m@r.it;Bari\nLucia;Bianchi;3339876543;l@b.it;Roma",
  );
  c("un file normale si legge come prima", 2, normale.leads.length);
  c("nome", "Mario", normale.leads[0].nome);
  c("cognome", "Rossi", normale.leads[0].cognome);
  c("telefono", "3331234567", normale.leads[0].telefono);
  c("citta'", "Bari", normale.leads[0].citta);
  c("e non si inventa nessuna nota", undefined, normale.leads[0].note);

  //  Un'intestazione Meta scritta bene: niente da indovinare, stesso esito.
  const dritto = traduciCsv(
    "created_time,full_name,email,phone_number\n2026-09-21T01:33:01-05:00,Anna Verdi,a@v.it,p:+393331112223",
  );
  c("intestazione giusta: nome", "Anna", dritto.leads[0].nome);
  c("intestazione giusta: cognome", "Verdi", dritto.leads[0].cognome);
  c("intestazione giusta: telefono", "+393331112223", dritto.leads[0].telefono);

  //  Una riga senza niente di utile non diventa una scheda vuota in archivio.
  const vuote = traduciCsv("nome;telefono\nMario;3331234567\n;");
  c("le righe vuote si scartano", 1, vuote.leads.length);
  c("e si contano", 1, vuote.scartate);
}

/*  ═══════════════════════════════════════════════════════════════════════
    LE RISPOSTE DEL MODULO DIVENTANO VOCI DELLA SCHEDA
    ───────────────────────────────────────────────────────────────────────
    Richiesta del committente: «se carico questo CSV lo importa e capisce che
    è questo; e in base alle domande dentro al lead, ci siano anche queste
    info, ma non nelle note, ma proprio come voce a sé stante — così posso
    tenere traccia bene».
    Il file di prova è quello vero («LEAD - HGL - Ads Accese 01.csv»), ridotto
    a tre righe: stessa intestazione, stesse risposte, stessi accenti.
    Il rischio da coprire non è che non legga: è che legga MALE e lo dica lo
    stesso — una zona messa al posto di un orario è una voce che si crede.
    ═══════════════════════════════════════════════════════════════════════ */
/*  ═══════════════════════════════════════════════════════════════════════
    I CLIC NON DEVONO POTER MORIRE
    ───────────────────────────────────────────────────────────────────────
    Segnalazione del committente: «su Chrome il CRM va male, si blocca, non
    clicca bene». Misurato: chiudendo una finestra mentre Chrome non dipinge,
    l'animazione di uscita non parte, il dialogo non si smonta e il <body>
    resta con `pointer-events: none` — da lì nessun clic raggiunge più niente.
    ⚠️ La prova che conta non è «libera»: è «NON libera quando c'è davvero una
     finestra aperta». Una rete che sbaglia lì farebbe passare i clic
     attraverso il velo, sulla pagina dietro: un guasto peggiore di quello che
     ripara, e molto più difficile da vedere.
    ═══════════════════════════════════════════════════════════════════════ */
/*  ═══════════════════════════════════════════════════════════════════════
    QUALE RISPOSTA COMPRA — il tasso di conversione per risposta
    ───────────────────────────────────────────────────────────────────────
    Richiesta del committente: «aggiungi su KPI il tasso di CVR in base alle
    risposte».
    ⚠️ Le prove che contano qui non sono le percentuali: sono i DENOMINATORI.
     Una scheda contata due volte, o una scheda senza questionario finita nel
     conto, danno una percentuale che sembra misurata e non lo è — e su quella
     si decide dove mettere i soldi della pubblicità.
    ═══════════════════════════════════════════════════════════════════════ */
/*  ═══════════════════════════════════════════════════════════════════════
    «NON C'È L'OPZIONE» QUANDO L'OPZIONE C'È
    ───────────────────────────────────────────────────────────────────────
    Segnalazione del committente: «non riesco a modificare il prezzo dopo 15
    mesi, non c'è opzione su listino». C'era, ed era al suo posto: ma la
    ricerca del pannello guardava solo fra le voci del listino, e l'assistenza
    dopo la consegna non è una voce — è un riquadro a parte. Chi cercava
    «manutenzione» si sentiva rispondere «nessuna voce», cioè che quella cosa
    non esisteva.
    ⚠️ La prova che conta non è «trova»: è «NON trova quando si cerca altro».
     Un evidenziatore che si accende sempre non indica più niente.
    ═══════════════════════════════════════════════════════════════════════ */
function proveDellaRicercaManutenzione() {
  const { parlaDiManutenzione } = LSC;
  gruppo("CERCARE IL PREZZO DOPO I 15 MESI");

  const valori = { prezzo: 450, mesi: 15 };
  //  Le parole che uno digita davvero.
  for (const q of ["manutenzione", "assistenza", "rigenerazione", "sostituzione", "dopo",
                   "quanto paga dopo", "mesi", "450", "15", "garanzia"]) {
    c(`«${q}» porta alla manutenzione`, true, parlaDiManutenzione(q, valori));
  }
  //  Accenti e maiuscole non contano: si cerca come viene.
  c("«MANUTENZIONE» in maiuscolo", true, parlaDiManutenzione("MANUTENZIONE", valori));
  c("«Assistènza» con l'accento storto", true, parlaDiManutenzione("Assistènza", valori));

  //  ⚠️ E QUI SI DEVE TACERE: cercare una voce del listino non deve accendere
  //   il riquadro dell'assistenza.
  for (const q of ["patch", "innesto rinforzato", "colore", "trapianto", "xyz", "installazione"]) {
    c(`«${q}» non la riguarda`, false, parlaDiManutenzione(q, valori));
  }
  //  Una lettera sola accenderebbe qualunque cosa: si risponde da due in su.
  c("una lettera sola non basta", false, parlaDiManutenzione("m", valori));
  c("e nemmeno il vuoto", false, parlaDiManutenzione("", valori));
  c("nemmeno uno spazio", false, parlaDiManutenzione("   ", valori));

  //  I numeri VIGENTI, non quelli di casa: chi ha messo 470 cerca «470».
  c("il prezzo di casa si trova", true, parlaDiManutenzione("450", valori));
  c("e quello cambiato pure", true, parlaDiManutenzione("470", { prezzo: 470, mesi: 18 }));
  c("ma il vecchio non si trova piu'", false, parlaDiManutenzione("450", { prezzo: 470, mesi: 18 }));
  //  Senza valori non esplode: il riquadro c'è lo stesso.
  c("senza numeri risponde comunque alle parole", true, parlaDiManutenzione("manutenzione"));
}

function proveDelCvrPerRisposta() {
  const { domandeDeiLead, rispostaMigliore } = RSL;
  gruppo("QUALE RISPOSTA COMPRA");

  const scheda = (risposte, vinto) => ({ data: { modulo: { risposte }, vinto } });
  const vinto = (l) => !!l.data.vinto;
  const D = "Come vive il problema";
  const leads = [
    scheda([{ domanda: D, risposta: "Lo sta valutando sul serio" }], true),
    scheda([{ domanda: D, risposta: "Lo sta valutando sul serio" }], true),
    scheda([{ domanda: D, risposta: "Lo sta valutando sul serio" }], false),
    scheda([{ domanda: D, risposta: "Lo sta valutando sul serio" }], false),
    scheda([{ domanda: D, risposta: "Si sta solo informando" }], false),
    scheda([{ domanda: D, risposta: "Si sta solo informando" }], false),
    //  Una scheda senza questionario: non deve entrare in nessun conto.
    { data: {} },
  ];
  const [d] = domandeDeiLead(leads, vinto);
  c("una domanda sola", 1, domandeDeiLead(leads, vinto).length);
  c("conta solo chi ha risposto", 6, d.lead);
  c("due risposte", 2, d.righe.length);
  c("prima la piu' data", "Lo sta valutando sul serio", d.righe[0].risposta);
  c("il denominatore e' giusto", 4, d.righe[0].lead);
  c("e il numeratore pure", 2, d.righe[0].clienti);
  c("50% su chi valuta", 50, d.righe[0].cvrPct);
  c("0% su chi si informa", 0, d.righe[1].cvrPct);
  c("i clienti della domanda", 2, d.clienti);

  //  ⚠️ UNA SCHEDA CONTA UNA VOLTA SOLA PER DOMANDA. Un file storto puo'
  //   portare due risposte alla stessa domanda: contandole entrambe, il
  //   denominatore diventerebbe piu' grande del numero di schede esistenti.
  const doppia = [scheda([{ domanda: D, risposta: "A" }, { domanda: D, risposta: "B" }], true)];
  const [dd] = domandeDeiLead(doppia, vinto);
  c("due risposte alla stessa domanda contano per una", 1, dd.lead);
  c("e vince la prima", "A", dd.righe[0].risposta);

  //  Piu' domande: ordinate per quante risposte hanno, non per nome.
  const varie = [
    scheda([{ domanda: "Zona", risposta: "Sud e isole" }], false),
    scheda([{ domanda: "Zona", risposta: "Nord Italia" }], true),
    scheda([{ domanda: "Zona", risposta: "Nord Italia" }], false),
    scheda([{ domanda: "Ci conosce", risposta: "Ci segue gia'" }], true),
  ];
  const elenco = domandeDeiLead(varie, vinto);
  c("la domanda piu' risposta viene prima", "Zona", elenco[0].domanda);
  c("e le altre restano", 2, elenco.length);

  //  La domanda lunga si accorcia per stare in una linguetta, ma il
  //  raggruppamento resta sul testo intero.
  const lunga = "quando preferiresti ricevere una telefonata per concordare l'appuntamento di consulenza gratuita";
  const [dl] = domandeDeiLead([scheda([{ domanda: lunga, risposta: "Sera" }], false)], vinto);
  c("la domanda intera resta la chiave", lunga, dl.domanda);
  c("il titolo e' accorciato", true, dl.titolo.length < lunga.length && dl.titolo.endsWith("\u2026"));

  /*  ── ⚠️ LA RIGA MIGLIORE SI INDICA SOLO SE E' STATA CONFRONTATA ────────
      Con una riga sola sopra la soglia non esiste un «migliore»: esiste
      l'unica misurata, e il grassetto direbbe una cosa mai confrontata. */
  const soglia = 5;
  const pochi = domandeDeiLead(leads, vinto)[0];
  c("sotto la soglia non si indica niente", null, rispostaMigliore(pochi, soglia));
  const tanti = domandeDeiLead(
    [
      ...Array.from({ length: 6 }, (_, i) => scheda([{ domanda: D, risposta: "Valuta" }], i < 3)),
      ...Array.from({ length: 6 }, (_, i) => scheda([{ domanda: D, risposta: "Informa" }], i < 1)),
    ],
    vinto,
  )[0];
  c("sopra la soglia si indica la migliore", "Valuta", rispostaMigliore(tanti, soglia));
  //  Due righe identiche non hanno una migliore.
  const pari = domandeDeiLead(
    [
      ...Array.from({ length: 6 }, (_, i) => scheda([{ domanda: D, risposta: "A" }], i < 3)),
      ...Array.from({ length: 6 }, (_, i) => scheda([{ domanda: D, risposta: "B" }], i < 3)),
    ],
    vinto,
  )[0];
  c("a pari merito non si indica niente", null, rispostaMigliore(pari, soglia));
  c("senza domanda non esplode", null, rispostaMigliore(undefined, soglia));

  //  Righe senza domanda o senza risposta non entrano: sono rumore di file.
  const rotte = [scheda([{ domanda: "", risposta: "boh" }, { domanda: "X", risposta: "" }], true)];
  c("le righe rotte non fanno una domanda", 0, domandeDeiLead(rotte, vinto).length);
  c("nessuna scheda, nessuna domanda", 0, domandeDeiLead([], vinto).length);
}

function proveDeiClicLiberi() {
  const { liberaIClic, qualcosaDiAperto } = CLC;
  gruppo("I CLIC NON DEVONO MORIRE");

  //  Un documento finto: basta quello che la funzione guarda davvero.
  const finto = (bloccato, aperti = []) => ({
    body: {
      style: {
        pointerEvents: bloccato ? "none" : "",
        removeProperty(k) { if (k === "pointer-events") this.pointerEvents = ""; },
      },
    },
    querySelector: (sel) => aperti.find((a) => sel.includes(a)) ?? null,
  });

  const libero = finto(false);
  c("una pagina sana non si tocca", false, liberaIClic(libero));

  const bloccato = finto(true);
  c("una pagina bloccata senza finestre si libera", true, liberaIClic(bloccato));
  c("e i clic tornano a passare", "", bloccato.body.style.pointerEvents);
  c("una seconda volta non c'e' piu' niente da fare", false, liberaIClic(bloccato));

  /*  ── ⚠️ LA PROVA CHE PROTEGGE IL VELO ─────────────────────────────────
      Con una finestra APERTA il blocco è giusto: è quello che impedisce di
      cliccare la pagina dietro mentre si sta decidendo qualcosa. */
  const conFinestra = finto(true, ['[data-state="open"][role="dialog"]']);
  c("con una finestra aperta non si libera niente", false, liberaIClic(conFinestra));
  c("e il blocco resta dov'era", "none", conFinestra.body.style.pointerEvents);

  //  Non solo i dialoghi: anche un menu o un elenco a tendina aperto blocca la
  //  pagina di proposito, e liberarla sotto di loro vorrebbe dire far passare
  //  i clic attraverso il menu.
  for (const aperto of [
    '[data-state="open"][role="menu"]',
    '[data-state="open"][role="listbox"]',
    '[data-state="open"][role="alertdialog"]',
    '[data-radix-popper-content-wrapper] [data-state="open"]',
  ]) {
    c(`${aperto.slice(0, 34)}… tiene il blocco`, false, liberaIClic(finto(true, [aperto])));
  }

  c("riconosce che c'e' qualcosa di aperto", true,
    qualcosaDiAperto(finto(true, ['[data-state="open"][role="dialog"]'])));
  c("e che non c'e' niente", false, qualcosaDiAperto(finto(true)));

  //  ⚠️ Un blocco che arriva da un foglio di stile non è affar nostro: si
  //   guarda solo quello scritto sull'elemento.
  const daCss = finto(false);
  daCss.body.style.pointerEvents = "";
  c("un blocco che non viene dall'elemento non si tocca", false, liberaIClic(daCss));

  //  Un documento senza corpo (rendering sul server) non deve far esplodere
  //  niente: la rete vive anche lì dentro, e lì `document.body` non c'è.
  c("senza corpo non succede niente", false, liberaIClic({ body: null, querySelector: () => null }));
}

function proveDelModulo() {
  const { traduciCsv } = IMP;
  const { riconosciRisposta, leggiRisposte, vociModulo, etichettaRisposta } = MDL;
  gruppo("LE RISPOSTE DEL MODULO");

  const D1 = "come_consideri_il_tuo_problema?";
  const D2 = "conosci_hair_genius_labs_e_il_mondo_dell'infoltimento_capelli_non_chirurgico?";
  const D3 = "in_quale_zona_d'italia_ti_trovi?";
  const D4 = "quando_preferiresti_ricevere_una_telefonata_per_concordare_l'appuntamento_di_consulenza_gratuita_e_ottenere_maggiori_informazioni?_(indica_giorno_e_ora_indicativi)";
  const FILE = [
    `id,created_time,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id,form_name,is_organic,platform,${D1},${D2},${D3},${D4},full_name,email,phone_number,lead_status`,
    'l:1103256495617278,2026-09-24T05:36:57-05:00,ag:120253730513900721,589\u20ac - 001 - ok,as:120253730513890721,BROAD | ITALIA,c:120253730513880721,Hair Genius Labs | 24 giugno - Copy 3,f:1623446622641118,"Modulo senza titolo 30/11/24, 01:36-copy",false,fb,"non_lo_considero_ancora_un_problema,_ma_voglio_informazioni_sui_nuovi_sistemi_",per_me_\u00e8_un_mondo_tutto_nuovo.,sud_italia_e_isole,pausa_pranzo_(12:00\u201314:00),Malpasso Luca,lucamalpasso@libero.it,p:+393334651639,CREATED',
    'l:1475300417840584,2026-09-24T05:39:38-05:00,ag:120253730513900721,589\u20ac - 001 - ok,as:120253730513890721,BROAD | ITALIA,c:120253730513880721,Hair Genius Labs | 24 giugno - Copy 3,f:1623446622641118,"Modulo senza titolo 30/11/24, 01:36-copy",false,fb,\u00e8_importante:_sto_valutando_seriamente_di_prendere_provvedimenti_nel_breve-medio_termine.,s\u00ec:_vi_seguo_da_un_po\u2019.,nord_italia,mattina_(9:00\u201312:00),Gianni Mellino,mellinogiovanni7@gmail.com,p:+393471388386,CREATED',
    'l:2172570616997524,2026-09-24T05:39:56-05:00,ag:120253730513900721,589\u20ac - 001 - ok,as:120253730513890721,BROAD | ITALIA,c:120253730513880721,Hair Genius Labs | 24 giugno - Copy 3,f:1623446622641118,"Modulo senza titolo 30/11/24, 01:36-copy",false,fb,"non_lo_considero_ancora_un_problema,_ma_voglio_informazioni_sui_nuovi_sistemi_",per_me_\u00e8_un_mondo_tutto_nuovo.,sud_italia_e_isole,sera_(dopo_le_18:00),Amos Amorigi,amosamorigi@hotmail.it,p:+393384492970,CREATED',
  ].join("\n");

  const r = traduciCsv(FILE);
  c("il file si legge tutto", 3, r.leads.length);
  c("nessuna riga scartata", 0, r.scartate);
  c("il telefono arriva pulito", "+393334651639", r.leads[0].telefono);

  //  ── LE QUATTRO RISPOSTE, COME VOCI ──────────────────────────────────
  const uno = r.leads[0].modulo ?? {};
  c("come vive il problema", "informativo", uno.urgenza);
  c("se ci conosce", "nuovo", uno.conoscenza);
  c("la zona", "sud", uno.zona);
  c("quando chiamarlo", "pranzo", uno.quando);
  const due = r.leads[1].modulo ?? {};
  c("chi sta valutando sul serio si riconosce", "valutando", due.urgenza);
  c("e chi ci segue gia'", "segue", due.conoscenza);
  c("il nord non diventa sud", "nord", due.zona);
  c("la mattina non diventa sera", "mattina", due.quando);
  c("e la sera nemmeno", "sera", (r.leads[2].modulo ?? {}).quando);

  /*  ── ⚠️ IL PUNTO DELLA RICHIESTA: NON PIU' NELLE NOTE ─────────────────
      «non nelle note, ma proprio come voce a sé stante». Se restassero anche
      lì sarebbero scritte in due posti: il giorno in cui una delle due si
      corregge non si sa più quale vale. */
  c("le risposte non finiscono piu' nelle note", undefined, r.leads[0].note);
  c("e nemmeno lo stato di Meta (CREATED)", false, /CREATED/.test(r.leads[0].note || ""));

  //  Le risposte restano leggibili come le ha date, per chi vuole rileggerle.
  c("si conservano anche in chiaro", 4, (uno.risposte ?? []).length);
  c("con la nostra domanda, non quella del file", "Zona",
    (uno.risposte ?? []).find((x) => /Sud/.test(x.risposta))?.domanda);

  /*  ── ⚠️ DA DOVE ARRIVA IL CONTATTO ────────────────────────────────────
      Inserzione, gruppo e campagna prima si buttavano: la spesa era nei conti
      delle campagne, i lead che aveva prodotto no. E l'identificativo va
      SENZA la sigla di Meta, o non combacia con quello che arriva dalle API. */
  const t = r.leads[0].tracking ?? {};
  c("l'inserzione viaggia con la scheda", "120253730513900721", t.ad_id);
  c("senza la sigla ag:", false, /^ag:/.test(t.ad_id || ""));
  c("il nome dell'inserzione", "589\u20ac - 001 - ok", t.ad_name);
  c("la campagna", "Hair Genius Labs | 24 giugno - Copy 3", t.campaign_name);
  c("e si sa che e' Meta", "meta", t.source);
  c("anche sulla scheda", "meta", r.leads[0].piattaformaAds);

  /*  ── ⚠️ «COLONNA IGNORATA» DEVE VOLER DIRE IGNORATA ───────────────────
      Le quattro domande adesso si leggono: continuare a elencarle fra le
      ignorate manderebbe chi guarda l'anteprima a cercare un guasto che non
      c'e'. */
  c("le domande non risultano piu' ignorate", false,
    r.colonneIgnorate.some((x) => /consideri|conosci|zona|quando/.test(x)));
  c("la campagna nemmeno", false, r.colonneIgnorate.some((x) => /campaign|ad_name/.test(x)));

  /*  ── ⚠️ LE PAROLE ESATTE DEL MODULO SONO REGISTRATE ───────────────────
      Il committente ha mandato il file dicendo «l'elenco ce l'hai nel CSV,
      aggiungilo»: le opzioni così come Meta le scrive stanno adesso dentro
      `testi`, e si confrontano ESATTE prima di qualunque riconoscitore largo.
      Un confronto esatto non può sbagliare; il riconoscitore resta come rete
      per il giorno in cui una parola dell'opzione viene riscritta. */
  const ESATTE = [
    ["è importante: sto valutando seriamente di prendere provvedimenti nel breve-medio termine.", "urgenza", "valutando"],
    ["non lo considero ancora un problema, ma voglio informazioni sui nuovi sistemi", "urgenza", "informativo"],
    ["per me è un mondo tutto nuovo.", "conoscenza", "nuovo"],
    ["sì: vi seguo da un po'.", "conoscenza", "segue"],
    ["sud italia e isole", "zona", "sud"],
    ["nord italia", "zona", "nord"],
    ["mattina (9:00–12:00)", "quando", "mattina"],
    ["pausa pranzo (12:00–14:00)", "quando", "pranzo"],
    ["sera (dopo le 18:00)", "quando", "sera"],
  ];
  for (const [testo, campo, id] of ESATTE) {
    const t = riconosciRisposta(testo);
    c(`«${testo.slice(0, 30)}…» → ${campo}`, `${campo}/${id}`, `${t?.campo}/${t?.opzione.id}`);
  }
  //  ⚠️ E come le scrive Meta: trattini bassi al posto degli spazi, maiuscole
  //   e accenti come capita. Il confronto è ripulito da entrambe le parti.
  const comeNelFile = riconosciRisposta("Per_Me_È_Un_Mondo_Tutto_Nuovo.");
  c("le parole del file si riconoscono comunque", "nuovo", comeNelFile?.opzione.id);

  //  La frase per intero non si perde: il nome corto è nostro, quello che la
  //  persona ha scelto resta leggibile.
  const conTesto = leggiRisposte([D1], ["sud_italia_e_isole"], new Set());
  c("la frase scelta si conserva", "Sud italia e isole", conTesto.risposte[0].testo);
  c("e il nome corto resta il nostro", "Sud e isole", conTesto.risposte[0].risposta);

  //  ── SI RICONOSCE LA RISPOSTA, NON LA DOMANDA ────────────────────────
  //   È la scelta portante: sui file veri l'intestazione può essere spostata
  //   di una colonna. Le risposte, mischiate a caso, devono finire lo stesso
  //   al loro posto.
  const mischiate = leggiRisposte(
    ["a", "b", "c", "d"],
    ["sera_(dopo_le_18:00)", "nord_italia", "per_me_\u00e8_un_mondo_tutto_nuovo.", "\u00e8_importante:_sto_valutando_seriamente"],
    new Set(),
  );
  c("l'orario resta un orario", "sera", mischiate.quando);
  c("la zona resta una zona", "nord", mischiate.zona);
  c("e le altre due al loro posto", "nuovo|valutando",
    `${mischiate.conoscenza}|${mischiate.urgenza}`);

  //  ⚠️ E NON SI INVENTA NIENTE: un valore che non somiglia a nessuna
  //   risposta non diventa una voce. Una voce sbagliata si crede.
  c("un valore qualunque non diventa una voce", undefined, riconosciRisposta("Michele Ruggiero"));
  c("nemmeno un identificativo", undefined, riconosciRisposta("l:2055445158436359"));
  c("nemmeno il nome di una campagna", undefined, riconosciRisposta("BROAD | ITALIA"));
  c("nemmeno una riga vuota", undefined, riconosciRisposta(""));
  c("una riga senza risposte non fa un modulo", undefined,
    leggiRisposte(["nome", "telefono"], ["Mario Rossi", "3331234567"], new Set()));

  //  Le colonne gia' prese da qualcun altro non si guardano nemmeno: il nome
  //  di una citta' non deve poter diventare una zona.
  const presa = leggiRisposte(["citta"], ["nord italia"], new Set([0]));
  c("le colonne gia' lette si saltano", undefined, presa);

  /*  ── ⚠️ UNA COLONNA, UNA DOMANDA — ANCHE QUANDO L'OPZIONE È NUOVA ─────
      I moduli si riscrivono: basta un'opzione che non conosciamo («mi pesa
      molto da anni e non so da dove iniziare») perché quella risposta non
      venga riconosciuta dal valore. Deve finire comunque sotto la SUA
      domanda: se finisse nel sacco delle domande sconosciute, nei KPI la
      stessa domanda comparirebbe due volte — una col nostro nome e una con
      quello del file — ciascuna con metà dei lead. */
  const nuovaOpzione = traduciCsv(
    [
      "come_consideri_il_tuo_problema?,full_name,phone_number",
      "\u00e8_importante:_sto_valutando_seriamente,Anna Verdi,p:+393330000001",
      "mi_pesa_molto_da_anni_e_non_so_da_dove_iniziare,Mario Rossi,p:+393330000002",
    ].join("\n"),
  );
  const domandeDelle2 = nuovaOpzione.leads.map((l) => l.modulo.risposte[0].domanda);
  c("l'opzione che non conosciamo resta sotto la sua domanda",
    "Come vive il problema|Come vive il problema", domandeDelle2.join("|"));
  c("e si legge come l'ha scritta la persona", "Mi pesa molto da anni e non so da dove iniziare",
    nuovaOpzione.leads[1].modulo.risposte[0].risposta);
  //  ⚠️ Senza campo nostro: non sappiamo che cosa voglia dire, e darle un
  //   colore sarebbe un giudizio inventato.
  c("ma senza un campo nostro", undefined, nuovaOpzione.leads[1].modulo.risposte[0].campo);
  c("e senza inventare un'urgenza", undefined, nuovaOpzione.leads[1].modulo.urgenza);

  //  ── LA RISPOSTA SCRITTA A MANO ──────────────────────────────────────
  //   La domanda dice «indica giorno e ora indicativi»: chi scrive «giovedi'
  //   dopo le 19» ha risposto, e la sua risposta vale quanto una fascia.
  const mano = leggiRisposte([D4], ["gioved\u00ec dopo le 19, non prima"], new Set());
  c("il giorno scritto a mano si tiene", "Giovedì dopo le 19, non prima", mano.quandoTesto);
  c("e si legge come le altre", "Quando chiamarlo", vociModulo(mano)[0].titolo);
  //  ⚠️ Ma solo sotto QUELLA domanda: un testo qualunque sotto una colonna
  //   qualunque non diventa un orario.
  c("un testo sotto un'altra domanda no", undefined,
    leggiRisposte(["note"], ["gioved\u00ec dopo le 19"], new Set()));

  //  ── COME SI LEGGONO NELLA SCHEDA ────────────────────────────────────
  const voci = vociModulo(uno);
  c("quattro voci da mostrare", 4, voci.length);
  c("nell'ordine delle domande", "Come vive il problema", voci[0].titolo);
  c("con la risposta in chiaro", "Sud e isole", voci.find((v) => v.campo === "zona").valore);
  c("chi vale una telefonata prima si vede", "buono",
    vociModulo(due).find((v) => v.campo === "urgenza").tono);
  c("senza modulo non c'e' niente da mostrare", 0, vociModulo(undefined).length);
  //  Un id che non conosciamo piu' (modulo riscritto, scheda vecchia) non fa
  //  sparire la voce: si mostra com'e'.
  c("un id sconosciuto si mostra com'e'", "chissa", etichettaRisposta("zona", "chissa"));

  /*  ── ⚠️ TUTTE LE RISPOSTE, ANCHE QUELLE DI DOMANDE CHE NON CONOSCIAMO ──
      Richiesta del committente: «sulla scheda lead ci siano TUTTE le risposte
      che danno nel questionario».
      Le domande di un altro modulo («quanto ti infastidisce la calvizie?») non
      si possono prevedere: la loro domanda si legge dall'intestazione, e la
      risposta diventa una voce come le altre invece di finire nelle note. */
  const altre = traduciCsv(
    "full_name,phone_number,quanto_ti_infastidisce_la_calvizie?\nMichele Ruggiero,p:+393473478192,alopecia_androgenetica",
  );
  c("una domanda che non conosciamo diventa una voce", "quanto ti infastidisce la calvizie?",
    altre.leads[0].modulo.risposte[0].domanda);
  c("con la sua risposta", "Alopecia androgenetica", altre.leads[0].modulo.risposte[0].risposta);
  c("e non resta anche nelle note", undefined, altre.leads[0].note);
  //  Senza `campo`: non è una delle quattro che sappiamo interpretare, e la
  //  scheda non deve darle un colore che sarebbe un giudizio inventato.
  c("e senza un campo nostro", undefined, altre.leads[0].modulo.risposte[0].campo);

  /*  ── ⚠️ MA SOLO SE ALL'INTESTAZIONE SI PUÒ CREDERE ─────────────────────
      Sul file con le colonne spostate di uno, scrivere la domanda accanto
      alla risposta vorrebbe dire stampare una bugia dentro una scheda. Lì la
      risposta resta dov'era: nelle note, senza domanda. */
  const storto = traduciCsv(
    [
      "  ,created_time,ad_id,quanto_ti_infastidisce?,full_name,email,phone_number",
      "l:1,2026-09-21T01:33:01-05:00,ag:12,alopecia_androgenetica,leleruggiero@gmail.com,Michele Ruggiero,p:+393473478192",
    ].join("\n"),
  );
  c("con l'intestazione spostata non si inventa nessuna domanda", undefined, storto.leads[0].modulo);
  c("e la risposta resta nelle note", true,
    /alopecia androgenetica/.test(storto.leads[0].note || ""));
  c("mentre il telefono e' comunque quello giusto", "+393473478192", storto.leads[0].telefono);
}

/** ── CHI PUÒ FARE CHE COSA ────────────────────────────────────────────────
 *  ⚠️ Nessuno provava questo file, ed è quello che apre e chiude le porte del
 *   CRM. Un permesso di troppo non rompe niente e non fallisce niente: si vede
 *   il giorno in cui una persona apre una schermata che non doveva.
 */
function proveDeiPermessi() {
  const { PERMESSI_RUOLO, PERMESSI_MESTIERE, permessiDeiMestieri, permessoDiPagina, TUTTI_I_PERMESSI } = PRM;
  gruppo("CHI PUO' FARE CHE COSA");

  const ha = (elenco, p) => elenco.includes(p);
  const setter = PERMESSI_RUOLO.setter;

  /*  ── ⚠️ IL SETTER FA IL MESTIERE DEL SETTER, PER INTERO ────────────────
      Richiesta del committente. Gli mancava `lead.crea`: il suo mestiere E'
      lavorare una lista, e la lista si carica da un file — senza quel permesso
      la scheda «Importa lead» non gli compariva nemmeno. */
  c("il setter lavora i propri lead", true, ha(setter, "lead.propri"));
  c("il setter fissa gli appuntamenti", true, ha(setter, "agenda"));
  c("il setter carica le liste", true, ha(setter, "lead.crea"));

  //  ⚠️ E NIENT'ALTRO. Sono le due cose che, sbagliate da chi non le fa di
  //   mestiere, si vedono in cassa — piu' le chiavi di casa.
  for (const vietato of ["preventivi", "pagamenti", "lead.tutti", "lead.elimina",
                         "marketing", "installazioni", "listino", "archivio",
                         "consulenti", "impostazioni"]) {
    c(`al setter non tocca «${vietato}»`, false, ha(setter, vietato));
  }

  //  Sotto ogni livello c'e' quello del livello inferiore: promuovere qualcuno
  //  non deve MAI togliergli qualcosa.
  c("il consulente ha tutto quello del setter", true, setter.every((p) => ha(PERMESSI_RUOLO.consulente, p)));
  c("e in piu' i preventivi", true, ha(PERMESSI_RUOLO.consulente, "preventivi"));
  c("e gli incassi", true, ha(PERMESSI_RUOLO.consulente, "pagamenti"));
  c("l'admin ha tutto", TUTTI_I_PERMESSI.length, PERMESSI_RUOLO.admin.length);

  //  Il mestiere «fa il setter» deve dare ESATTAMENTE quello che dava il
  //  livello: e' la sola prova che il passaggio ai mestieri non regala e non
  //  toglie niente a chi fa un mestiere solo.
  c("mestiere setter = livello setter", setter.join(","), PERMESSI_MESTIERE.faSetter.join(","));
  c("mestiere consulente = livello consulente", PERMESSI_RUOLO.consulente.join(","), PERMESSI_MESTIERE.faConsulente.join(","));

  //  Chi entra senza nessun mestiere acceso vede almeno le proprie schede, o
  //  il CRM si apre e non fa niente.
  c("senza mestieri resta solo il proprio", "lead.propri", permessiDeiMestieri({}).join(","));
  //  Due mestieri danno la somma, non il piu' alto.
  const doppio = permessiDeiMestieri({ faSetter: true, faInstallatore: true });
  c("due mestieri si sommano", true, ha(doppio, "agenda") && ha(doppio, "installazioni"));

  /*  ── ⚠️ NESSUN MESTIERE CONSEGNA LE CHIAVI DI CASA ────────────────────
      E' l'invariante che tiene in piedi la protezione contro il CRM chiuso a
      chiave dall'interno: i mestieri si scrivono dal BROWSER, questi quattro
      permessi no. Scritta come prova perche' una riga aggiunta con leggerezza
      a PERMESSI_MESTIERE la romperebbe in silenzio. */
  for (const chiave of ["consulenti", "impostazioni", "listino", "archivio"]) {
    const dentro = Object.values(PERMESSI_MESTIERE).some((l) => l.includes(chiave));
    c(`nessun mestiere regala «${chiave}»`, false, dentro);
  }

  /*  ── LA SCHEDA CHE IMPORTA I CONTATTI ──────────────────────────────────
      ⚠️ Non eredita da «/CRM/importa»: il confronto vuole il percorso esatto o
      un sotto-percorso con la barra, e senza una riga sua cadrebbe sulla
      regola generica del CRM — aprendosi a chiunque sia entrato. */
  c("la scheda «Importa lead» vuole il permesso di creare", "lead.crea", permessoDiPagina("/CRM/importa-lead"));
  c("e la coda di chiamata resta aperta a tutti quelli entrati", "lead.propri", permessoDiPagina("/CRM/importa"));
  c("il setter puo' aprire la scheda che importa", true, ha(setter, permessoDiPagina("/CRM/importa-lead")));

  /*  ── ⚠️ LE PAGINE CHE AL SETTER NON SERVONO ────────────────────────────
      Segnalazione del committente: «appuntamento in sede il setter non deve
      vederlo». Lo schema «sede» non aveva un permesso suo, quindi quella
      pagina si apriva a chiunque fosse entrato: chi viene in sede ci viene per
      una CONSULENZA — la pagina conta chi e' atteso, chi ha un esito da
      mettere e quanto c'e' da incassare quel giorno. Il setter fissa e
      telefona. */
  c("la sede vuole il permesso della consulenza", "preventivi", permessoDiPagina("/CRM/sede"));
  c("al setter la sede resta chiusa", false, ha(setter, permessoDiPagina("/CRM/sede")));
  c("al consulente no", true, ha(PERMESSI_RUOLO.consulente, permessoDiPagina("/CRM/sede")));
  //  ⚠️ E la coda di chiamata resta aperta al setter: e' il suo lavoro, e una
  //   correzione sui permessi non deve chiudergli la porta di casa.
  c("ma la sua postazione resta sua", true, ha(setter, permessoDiPagina("/CRM/importa")));

  /*  ── DOVE SI ATTERRA APPENA ENTRATI ────────────────────────────────────
      ⚠️ Segnalazione del committente: il setter entrava e finiva su una
      schermata che non gli apparteneva — la giornata di chi fa consulenze — e
      il primo gesto della sua mattina diventava cercare nel menu la riga
      giusta. La postazione del setter e' la coda di chiamata: e' il lavoro,
      non una preferenza. */
  const { paginaIniziale } = PRM;
  const con = (elenco) => (p) => elenco.includes(p);
  c("il setter entra dalla coda di chiamata", "/CRM/importa", paginaIniziale(con(setter)));
  c("il consulente entra dalla sua giornata", "/CRM", paginaIniziale(con(PERMESSI_RUOLO.consulente)));
  c("e l'admin pure", "/CRM", paginaIniziale(con(PERMESSI_RUOLO.admin)));
  //  ⚠️ SI DECIDE DAI PERMESSI, NON DAL LIVELLO: chi fa il setter E il
  //   consulente non e' «un setter», ed entra dalla porta grande.
  c("chi fa tutti e due entra dalla porta grande", "/CRM",
    paginaIniziale(con(permessiDeiMestieri({ faSetter: true, faConsulente: true }))));
  //  ⚠️ E chi non puo' nemmeno quello resta su /CRM, che non chiede nessun
  //   permesso: mandare qualcuno su una schermata vietata per «aiutarlo»
  //   sarebbe il guasto di partenza, al contrario.
  c("chi non ha niente non viene mandato in un vicolo cieco", "/CRM", paginaIniziale(() => false));

  /*  ── LA BASE È «VEDE TUTTO», POI SI RESTRINGE DAI COLLABORATORI ─────────
      Richiesta del committente: chi non ha ancora un livello scritto parte da
      tutto. Un livello scritto, o scritto male, non cambia. */
  const { risolviAccesso } = PRM;
  const tutti = TUTTI_I_PERMESSI.length;
  c("senza livello vede tutto", tutti, risolviAccesso(undefined).elenco.length);
  c("anche la riga di serie della colonna", tutti,
    risolviAccesso({ canChangeStatus: true, canDeleteLead: false, canAddLead: false, canChangePayment: false }).elenco.length);
  c("e le impostazioni comprese", true, risolviAccesso({}).puo("impostazioni"));
  c("un setter scritto resta setter", "setter", risolviAccesso({ ruolo: "setter" }).ruolo);
  c("un livello illeggibile resta il minimo", "setter", risolviAccesso({ ruolo: "boh" }).ruolo);
  c("una voce spenta a mano si spegne anche sulla base", false,
    risolviAccesso({ extra: { impostazioni: false } }).puo("impostazioni"));
}

/** ── OGNI STATO, OGNI MESSAGGIO: IL GIRO COMPLETO ─────────────────────────
 *  ⚠️ Chiesto dal committente: «controlla tutti i messaggi». Questa prova e'
 *   quel controllo reso PERMANENTE: percorre tutti gli stati esistenti e per
 *   ognuno compone il messaggio vero, come lo riceverebbe un cliente.
 *   Serve a impedire che il giorno in cui si aggiunge uno stato nuovo ci si
 *   dimentichi il suo testo — e allora parte il ripiego, «Ciao Mario,» e
 *   basta, a una persona vera — o che un ritocco lasci un segnaposto a vuoto.
 */
function proveDiTuttiIMessaggi() {
  const { MODELLI_ORIGINALI, componiMessaggio, valoriDaLead, segnapostiResidui, SOGLIA_LUNGO } = WA;
  gruppo("TUTTI I MESSAGGI, UNO PER UNO");

  const scheda = {
    nome: "Marco", cognome: "Bianchi", telefono: "+393331234567",
    dataMeeting: "2026-09-22", oraMeeting: "15:30",
    dataRicontatto: "2026-09-22", oraRicontatto: "11:00",
    dataVieneInSede: "2026-09-23", oraVieneInSede: "10:00",
    linkMeeting: "https://hair-genius-hub.hair/meetly/kfr-mbqd-tzp",
  };
  //  ⚠️ Gli emoji si buggano su WhatsApp Business e il committente li ha fatti
  //   togliere tutti: questa riga impedisce che rientrino da una modifica.
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;

  let senzaTesto = 0, conResidui = 0, conEmoji = 0, troppoLunghi = 0, colLei = 0;
  for (const stato of TY.ALL_LEAD_STATUSES) {
    const modello = MODELLI_ORIGINALI[stato];
    if (!modello) { senzaTesto++; console.log("      stato senza messaggio:", stato); continue; }
    const testo = componiMessaggio(modello, valoriDaLead({ id: "x", data: { ...scheda, stato } }, stato));
    //  ⚠️ Un segnaposto rimasto nel testo finisce nel messaggio COSI' COM'E':
    //   «Ciao {nome}» arrivato a un cliente vero.
    if (segnapostiResidui(testo).length) { conResidui++; console.log("      segnaposto a vuoto:", stato, segnapostiResidui(testo)); }
    if (EMOJI.test(testo)) { conEmoji++; console.log("      emoji:", stato); }
    if (testo.length > SOGLIA_LUNGO) { troppoLunghi++; console.log("      lungo:", stato, testo.length); }
    //  Si da' del TU a tutti: una riga col «Lei» in mezzo agli altri si sente.
    if (/\bLa aspettiamo\b|\bLa ringrazio\b|\bnon esiti\b/.test(testo)) { colLei++; console.log("      da' del lei:", stato); }
  }
  c("ogni stato ha il suo messaggio", 0, senzaTesto);
  c("nessun segnaposto resta a vuoto", 0, conResidui);
  c("nessun emoji", 0, conEmoji);
  c("nessuno troppo lungo per WhatsApp", 0, troppoLunghi);
  c("si da' del tu a tutti", 0, colLei);

  //  ⚠️ E il ripiego resta quello che e': una riga corretta, non un messaggio
  //   vuoto che parte per sbaglio. Non dovrebbe uscire mai — ed e' proprio per
  //   questo che nessuno lo guarda.
  const sconosciuto = WA.getWhatsAppMessageForStatus({ id: "x", data: { ...scheda, stato: "stato_mai_visto" } });
  c("uno stato mai visto non manda un messaggio vuoto", true, sconosciuto.trim().length > 0);
  c("e nemmeno un segnaposto a vuoto", 0, segnapostiResidui(sconosciuto).length);
}

/** ── QUALE MESSAGGIO PARTE: LO DECIDE LO STATO, NON LA DATA ───────────────
 *  ⚠️ Segnalazione del committente: «quando lo stato e' appuntamento fissato,
 *   o altri stati, i pulsanti devono essere per quello stato con il messaggio
 *   corretto. Ora invece mostra sempre il messaggio del ricontatto».
 *   Il tasto guardava SOLO se la scheda avesse una data di consulenza — e
 *   quella data ce l'hanno anche gli appuntamenti che devono ancora succedere:
 *   a chi aveva un incontro fissato per domani partiva «abbiamo fatto la
 *   consulenza venerdi' 25 settembre». Il messaggio piu' sbagliato possibile,
 *   alle schede piu' delicate che abbiamo.
 */
function proveDelMessaggioGiusto() {
  const { consulenzaAlleSpalle, conLinkLavori, LINK_LAVORI } = LAV;
  gruppo("QUALE MESSAGGIO PARTE");

  const OGGI = "2026-09-20";

  //  ⚠️ IL CASO DEL COMMITTENTE: appuntamento fissato, data in agenda.
  c("appuntamento fissato: la consulenza NON e' alle spalle", false,
    consulenzaAlleSpalle("appuntamento_fissato", "2026-09-25", OGGI));
  c("nemmeno se la data e' passata: e' pur sempre un appuntamento", false,
    consulenzaAlleSpalle("appuntamento_fissato", "2026-09-10", OGGI));
  c("e nemmeno se e' rifissato", false,
    consulenzaAlleSpalle("appuntamento_rifissato", "2026-09-10", OGGI));

  //  Gli stati che dicono che la consulenza non si e' svolta: ricordarla
  //  sarebbe una bugia, e di quelle che si vedono.
  c("cliente assente: non si e' svolta", false, consulenzaAlleSpalle("no_show", "2026-09-10", OGGI));
  c("da spostare: non si e' svolta", false, consulenzaAlleSpalle("da_spostare", "2026-09-10", OGGI));

  //  Dopo la consulenza, con il giorno passato: si riprende il filo.
  c("in valutazione con la consulenza fatta: si riprende", true,
    consulenzaAlleSpalle("sta_valutando", "2026-09-10", OGGI));
  c("ricontatto fissato dopo la consulenza: si riprende", true,
    consulenzaAlleSpalle("da_ricontattare", "2026-09-19", OGGI));
  c("richiamo concordato: si riprende", true,
    consulenzaAlleSpalle("richiamo", "2026-09-19", OGGI));
  /*  ── ⚠️ NON TUTTI GLI STATI DOPO LA CONSULENZA ─────────────────────────
      «Attesa acconto» viene dopo una consulenza ma ha il SUO testo — dice
      dove versare — e scrivergli «come stai? abbiamo fatto la consulenza il
      tal giorno» vuol dire buttare via il messaggio scritto apposta. E' la
      meta' della segnalazione del committente. */
  c("attesa acconto tiene il suo messaggio", false,
    consulenzaAlleSpalle("in_attesa_acconto", "2026-09-10", OGGI));
  c("e anche una vendita", false, consulenzaAlleSpalle("posa_in_sede", "2026-09-10", OGGI));
  c("e anche il non interessato", false, consulenzaAlleSpalle("non_interessato", "2026-09-10", OGGI));
  //  ⚠️ Anche oggi conta: la consulenza di stamattina e' alle spalle.
  c("la consulenza di oggi e' alle spalle", true,
    consulenzaAlleSpalle("sta_valutando", OGGI, OGGI));
  //  ⚠️ Ma una consulenza ancora da fare no, qualunque sia lo stato: esiste la
  //   scheda «in valutazione» con un secondo incontro gia' in calendario.
  c("consulenza nel futuro: non si parla al passato", false,
    consulenzaAlleSpalle("sta_valutando", "2026-09-25", OGGI));

  c("senza data non si riprende niente", false, consulenzaAlleSpalle("sta_valutando", "", OGGI));
  c("una data illeggibile non e' una consulenza", false,
    consulenzaAlleSpalle("sta_valutando", "boh", OGGI));

  /*  ── IL LINK SI AGGIUNGE, NON SOSTITUISCE ───────────────────────────────
      «Allego i nostri lavori» non ha mai voluto dire «manda un'altra cosa»:
      su uno stato che ha il suo testo, il link va in fondo. */
  const conf = "Ciao Marco, ci vediamo domani alle 15?";
  c("il testo dello stato resta", true, conLinkLavori(conf).startsWith(conf));
  c("e il link finisce in fondo", true, conLinkLavori(conf).trimEnd().endsWith(LINK_LAVORI));
  c("un link gia' allegato non si ripete", conLinkLavori(conf), conLinkLavori(conLinkLavori(conf)));
  c("un messaggio vuoto non diventa due righe vuote", LINK_LAVORI, conLinkLavori(""));
}

/** ── IL MESSAGGIO CHE CHIEDE I DATI PER LA FATTURA ────────────────────────
 *  Esce dal gestionale e arriva a un cliente vero, su WhatsApp. Un errore qui
 *  non e' un pixel storto: e' una frase sgrammaticata mandata a una persona
 *  che ci ha appena dato dei soldi. */
function proveDelMessaggioDati() {
  const priv = { azienda: false, nome: "marco", cognome: "Rossi", indirizzo: "Via Roma 1", cap: "70100", comune: "Bari" };

  //  Il nome si scrive come si scrive un nome, non com'e' finito nel database.
  const m1 = MD.messaggioDatiFattura({ ...priv, codiceFiscale: "" });
  c("saluta per nome, con l'iniziale maiuscola", true, m1.startsWith("Ciao Marco,"));
  c("chiede il codice fiscale", true, m1.includes("codice fiscale"));
  //  ⚠️ La scorciatoia della tessera vale piu' di tutto il resto: copiare un
  //   codice fiscale dal telefono e' noioso e ci si sbaglia.
  c("offre la foto della tessera sanitaria", true, m1.includes("tessera sanitaria"));
  //  ⚠️ E NON CHIEDE QUELLO CHE ABBIAMO GIA': un elenco di sei voci di cui
  //   quattro superflue e' il modo piu' sicuro di non ricevere risposta.
  c("non richiede l'indirizzo che gia' c'e'", false, m1.toLowerCase().includes("indirizzo"));

  //  Singolare e plurale: «mi mancano un paio di dati» per una cosa sola
  //  suona come un modulo, non come una persona.
  //  ⚠️ Qui i dati sono DUE: il codice fiscale che manca e la conferma di nome
  //   e cognome, che si chiede sempre (vedi `datiDaChiedere`). Il singolare si
  //   prova sul caso che lo produce davvero: un'azienda a cui manca una cosa
  //   sola — alle aziende non si chiede nessun nome da confermare.
  c("piu' dati: plurale anche con un solo campo vuoto", true, m1.includes("mancano un paio di dati"));
  const soloUno = MD.messaggioDatiFattura({
    azienda: true, denominazione: "Rossi Srl", partitaIva: "01234567890",
    indirizzo: "Via Roma 1", cap: "70100", comune: "Bari",
  });
  c("un dato solo: singolare", true, soloUno.includes("manca un dato"));

  /*  ── ⚠️ NOME E COGNOME SI CHIEDONO SEMPRE ──────────────────────────────
      Richiesta del committente. Il nome in scheda e' quello battuto su un
      modulo o sentito al telefono; in fattura serve quello dei DOCUMENTI, e
      una «Anna» che in anagrafe e' «Annamaria» fa scartare il documento dallo
      SDI settimane dopo. Si fa CONFERMARE, pero': chiederlo secco a una
      persona che si e' appena salutata per nome suona come non conoscerla. */
  //  ⚠️ Maiuscola: nell'elenco ogni voce comincia con la lettera grande.
  c("chiede comunque nome e cognome", true, /Nome e cognome esatti/.test(m1));
  c("e dice che li sappiamo gia'", true, m1.includes("li so gi") && m1.includes("in fattura devono combaciare"));
  c("all'azienda non chiede nessun nome", false, /nome e cognome/.test(soloUno));
  //  L'elenco dei dati MANCANTI resta quello vero: da li' leggono anche i
  //  cartellini «dati incompleti», e una scheda piena non deve restare segnata
  //  come da completare per una conferma che non e' un buco.
  c("la conferma non conta come dato mancante", 0,
    MD.cosaManca({ ...priv, codiceFiscale: "RSSMRC80A01H501U" }).length);
  c("ma finisce fra quelli da chiedere", 1,
    MD.datiDaChiedere({ ...priv, codiceFiscale: "RSSMRC80A01H501U" }).length);
  const m2 = MD.messaggioDatiFattura({ azienda: false, nome: "Ada" });
  c("piu' dati: plurale", true, m2.includes("mancano un paio di dati"));
  //  ⚠️ «Ciao Anna, mandami nome e cognome» e' la frase che fa pensare che
  //   dall'altra parte non ci sia nessuno che ti conosce.
  c("saluta Ada e non le chiede come si chiama", false, m2.includes("Nome e cognome"));
  c("le chiede solo il cognome", true, m2.includes("Il cognome"));

  //  Un'azienda ha bisogno di altre cose, e la tessera sanitaria non c'entra.
  const az = MD.messaggioDatiFattura({ azienda: true, denominazione: "Rossi Srl" });
  c("all'azienda chiede la partita IVA", true, az.includes("partita IVA"));
  c("all'azienda chiede dove recapitarla", true, az.includes("codice destinatario"));
  c("all'azienda non parla di tessera sanitaria", false, az.includes("tessera sanitaria"));
  //  «Ciao Rossi Srl» non lo scriverebbe nessuno.
  c("non saluta una ragione sociale", false, az.includes("Ciao Rossi Srl"));
  c("senza referente saluta e basta", true, az.startsWith("Ciao,"));

  //  Senza nome non si saluta con la virgola sospesa.
  const senzaNome = MD.messaggioDatiFattura({ azienda: false });
  c("senza nome saluta e basta", true, senzaNome.startsWith("Ciao,"));

  //  Non manca niente: il pulsante non deve nemmeno comparire, ma il testo
  //  non deve comunque uscire rotto.
  const pieno = { ...priv, codiceFiscale: "RSSMRC80A01H501U" };
  c("a dati completi non manca niente", 0, MD.cosaManca(pieno).length);

  //  ⚠️ WhatsApp taglia i messaggi lunghi e nessuno legge un muro di testo:
  //   questo deve stare in una schermata di telefono.
  c("resta corto abbastanza da essere letto", true, m2.length < 500);

  /*  ── ⚠️ DI CHE FATTURA STIAMO PARLANDO ────────────────────────────────
      «Sto preparando la tua fattura» scritto a chi ha versato 750 su 2.500 fa
      una promessa che il documento non mantiene: quando arriva, l'importo non
      e' quello della pratica e il cliente chiama per chiedere se c'e' un
      errore. Dirlo prima costa tre parole e toglie quella telefonata. */
  const { tipoDellaFattura } = MD;
  c("l'acconto dichiarato resta acconto", "acconto", tipoDellaFattura({ tipo: "acconto" }));
  c("il saldo dichiarato resta saldo", "saldo", tipoDellaFattura({ tipo: "saldo" }));
  //  ⚠️ La regola e' quella dell'IVA, la stessa che rende diverse le due
  //   fatture: se l'imponibile copre TUTTO il prezzo e' la fattura di tutto,
  //   se ne copre una parte e' un acconto.
  c("una parte del prezzo e' un acconto", "acconto", tipoDellaFattura({ importo: 750, prezzo: 2500 }));
  c("tutto il prezzo e' la fattura intera", "unica", tipoDellaFattura({ importo: 2500, prezzo: 2500 }));
  //  Gli arrotondamenti dell'IVA non devono trasformare una fattura intera in
  //  un acconto.
  c("un centesimo di scarto non fa un acconto", "unica",
    tipoDellaFattura({ importo: 2499.995, prezzo: 2500 }));
  //  ⚠️ Nessun incasso ancora registrato NON e' «tutto»: e' la fattura di un
  //   acconto che deve ancora arrivare, ed e' il caso in cui dirlo serve di piu'.
  c("senza incassi e' comunque un acconto", "acconto", tipoDellaFattura({ importo: 0, prezzo: 2500 }));
  //  Senza il prezzo non si puo' dire niente: il generico e' la frase che non
  //  sbaglia mai.
  c("senza prezzo si resta sul generico", "unica", tipoDellaFattura({ importo: 750 }));
  c("senza contesto si resta sul generico", "unica", tipoDellaFattura(undefined));

  const acc = MD.messaggioDatiFattura(priv, "Hair Genius Labs", { tipo: "acconto" });
  c("il messaggio dice che e' l'acconto", true, /fattura dell'acconto che hai versato/.test(acc));
  const sal = MD.messaggioDatiFattura(priv, "Hair Genius Labs", { tipo: "saldo" });
  c("e che e' il saldo", true, /fattura a saldo/.test(sal));
  c("mentre la fattura intera resta «la tua fattura»", true,
    /la tua fattura/.test(MD.messaggioDatiFattura(priv, "Hair Genius Labs", { tipo: "unica" })));
  //  Anche quando non manca niente il messaggio deve dire di che fattura parla.
  const completo = MD.messaggioDatiFattura(
    { ...priv, codiceFiscale: "RSSMRC80A01H501U" }, "Hair Genius Labs", { tipo: "acconto" },
  );
  //  ⚠️ Anche a dati completi il messaggio deve dire DI CHE FATTURA parla:
  //   «sto preparando la tua fattura» a chi ha versato un acconto di 750 su
  //   2.500 promette un documento che poi non arriva, e il cliente telefona.
  c("lo dice anche a dati completi", true, /fattura dell'acconto/.test(completo));
}

/** ── «DA SALDARE» NON CONTA I LAVORI GIA' FINITI ───────────────────────────
 *  Il numero diceva 12 dove ce n'erano 5: era l'unica lente che non escludeva
 *  le pose completate, quindi sommava sette lavori finiti col saldo mai
 *  segnato a quelli ancora in coda. Chi organizza la giornata leggeva un
 *  numero e ne trovava meta'. */
function proveDelDaSaldare() {
  //  La regola della lente e' `!fatta && saldoAllaConsegna(l) > 0`. Qui si
  //  prova il pezzo che decide il numero: il saldo. E' la funzione VERA, presa
  //  da `costi-pratica` — se non ci fosse, `c` fallirebbe invece di passare.
  const conSaldo = { data: { payment: { prezzoTotale: 580, accontoPagato: 100 } } };
  c("il saldo e' prezzo meno incassato", 480, CP.saldoAllaConsegna(conSaldo));

  //  ⚠️ Il prezzo FINALE (quello dopo lo sconto) vince sul totale: e' la cifra
  //   che il cliente ha in mente, e sbagliarla vuol dire chiedergli alla porta
  //   piu' di quanto ha concordato.
  const scontato = { data: { payment: { prezzoTotale: 750, prezzoFinaleVendita: 580, accontoPagato: 100 } } };
  c("lo sconto vince sul prezzo di listino", 480, CP.saldoAllaConsegna(scontato));

  //  ⚠️ Un saldo a zero non e' «da saldare»: chi ha gia' pagato tutto non deve
  //   comparire in una coda di incassi.
  const saldato = { data: { payment: { prezzoTotale: 580, accontoPagato: 580 } } };
  c("chi ha pagato tutto non e' da saldare", 0, CP.saldoAllaConsegna(saldato));

  //  ⚠️ E chi ha versato PIU' del dovuto non genera un credito a suo favore in
  //   una colonna di incassi: resta zero.
  const troppo = { data: { payment: { prezzoTotale: 580, accontoPagato: 700 } } };
  c("chi ha versato di piu' resta a zero", 0, CP.saldoAllaConsegna(troppo));

  //  ⚠️ IL RIPIEGO SULL'ARCHIVIO. Meta' delle pratiche importate non ha il
  //   prezzo ma porta il saldo gia' calcolato: senza questo ripiego uscirebbero
  //   dal totale e il tecnico partirebbe senza sapere cosa ritirare.
  const archivio = { data: { payment: { saldoRimanente: 300 } } };
  c("la pratica d'archivio usa il saldo gia' calcolato", 300, CP.saldoAllaConsegna(archivio));

  //  Una pratica senza niente non inventa cifre.
  c("senza dati il saldo e' zero", 0, CP.saldoAllaConsegna({ data: {} }));
}

/** ── LA POSA AGGIUNTA A MANO NON DEVE SPORCARE I NUMERI DI NESSUNO ────────
 *  `crm/NuovaPosaDialog` fa esistere un cliente che non e' mai passato dalla
 *  trattativa: il passaparola che si presenta e compra. Due promesse fatte a
 *  voce nella finestra, e quindi due che vanno tenute ferme qui.
 *
 *  ⚠️ SONO PROMESSE SUI SOLDI DI ALTRI, non dettagli. La prima riguarda il tasso
 *   di conversione, cioe' il numero su cui si giudica il lavoro di una persona;
 *   la seconda il ROAS di una campagna, cioe' il numero su cui si decide quanto
 *   spendere il mese dopo. Sbagliarne una non da' nessun errore a schermo. */
function provePosaAggiunta() {
  //  Esattamente cio' che scrive la finestra, caso passaparola.
  const dati = {
    nome: "Mario", cognome: "Rossi", telefono: "3331112233", citta: "Bari",
    fonte: "Passa parola", consulenteId: null, stato: "venduto",
    createdAt: "2026-09-01T10:00:00.000Z", note: "mandato da un altro cliente",
    payment: { prezzoTotale: 1500, accontoPagato: 500 },
  };
  const dopo = TY.applyAutoStatus(dati);
  //  Lo stato deve restare una chiusura VINTA: e' cio' che fa comparire la
  //  pratica in Installazioni senza altri passaggi.
  c("la posa aggiunta resta una vendita", true, TY.eChiusuraVinta(dopo.stato));
  //  ⚠️ E il consulente resta vuoto. Se un domani qualcosa qui dentro ci
  //   scrivesse un valore «di comodo», quella posa entrerebbe nel tasso di
  //   conversione di una persona che non l'ha venduta.
  c("senza consulente resta senza consulente", true, !dopo.consulenteId);

  //  ⚠️ NIENTE ACQUISTO ANNUNCIATO A META per una vendita che nessuna campagna
  //   ha prodotto: gonfierebbe il ROAS con denaro che la pubblicita' non ha
  //   portato, e su quel numero si decide il budget del mese dopo.
  c("il passaparola non finisce nel ROAS", false, LA.shouldDispatchLeadToAds({ data: dopo }));
  c("nemmeno il cliente arrivato da se'", false, LA.shouldDispatchLeadToAds({ data: { ...dopo, fonte: "Store" } }));
  //  La controprova: scegliendo «Pubblicita» l'evento DEVE partire, altrimenti
  //  la prova qui sopra passerebbe anche con la funzione rotta a «sempre no».
  c("ma una vendita da campagna si', ", true, LA.shouldDispatchLeadToAds({ data: { ...dopo, fonte: "ADV" } }));

  //  ── E NON TOCCA NESSUNA RIGA DELLA TABELLA CONSULENTI ─────────────────
  const consulenti = [
    { id: "c1", data: { nome: "Uno" } },
    { id: "c2", data: { nome: "Due" } },
  ];
  const base = [
    { id: "l1", data: { nome: "A", stato: "venduto", consulenteId: "c1", createdAt: "2026-08-01T10:00:00.000Z", payment: { prezzoTotale: 1000, accontoPagato: 1000 } } },
    { id: "l2", data: { nome: "B", stato: "perso", consulenteId: "c2", createdAt: "2026-08-02T10:00:00.000Z" } },
  ];
  const dentro = KC.creaFiltroPeriodo("tutto");
  const prima = JSON.stringify(KC.calcolaMetricheConsulenti(base, consulenti, [], dentro));
  const orfana = { id: "l3", data: { ...dopo } };
  const conOrfana = JSON.stringify(KC.calcolaMetricheConsulenti(base.concat([orfana]), consulenti, [], dentro));
  c("la posa senza consulente non cambia nessuna riga", prima, conOrfana);
  //  Controprova: assegnata a qualcuno DEVE cambiare qualcosa, altrimenti la
  //  riga sopra proverebbe solo che la funzione non guarda i lead.
  const assegnata = { id: "l4", data: { ...dopo, consulenteId: "c1" } };
  const conAssegnata = JSON.stringify(KC.calcolaMetricheConsulenti(base.concat([assegnata]), consulenti, [], dentro));
  c("assegnata a qualcuno invece si'", true, conAssegnata !== prima);
}

/** ── IL DIARIO DI BORDO DELLA SALA ────────────────────────────────────────
 *  Serve a distinguere sei guasti che hanno tutti lo stesso sintomo — un
 *  rettangolo nero. Se sbaglia a riconoscere l'apparecchio o perde le prime
 *  righe, non distingue piu' niente e torna a essere un rettangolo nero. */
function proveDelDiario() {
  //  ── ⚠️ L'ORDINE DEI CONTROLLI SUL BROWSER ─────────────────────────────
  //   Dentro Chrome su iPhone la stringa contiene «CriOS» E «Safari»; dentro
  //   Edge contiene «Chrome». Cercando Safari o Chrome per primi si direbbe il
  //   browser sbagliato — e su un guasto che dipende dal browser e' proprio
  //   l'informazione che si stava cercando.
  const chromeIos = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120 Mobile/15E148 Safari/604.1";
  c("Chrome su iPhone non e' Safari", "iOS · Chrome · 390px", DI.apparecchio(chromeIos, 390));
  const safariIos = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
  c("Safari su iPhone e' Safari", "iOS · Safari · 390px", DI.apparecchio(safariIos, 390));
  const edge = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36 Edg/120";
  c("Edge non e' Chrome", "Windows · Edge · 1440px", DI.apparecchio(edge, 1440));
  const android = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36";
  c("Android con Chrome", "Android · Chrome · 412px", DI.apparecchio(android, 412));
  c("una stringa vuota non rompe", "altro · altro · 0px", DI.apparecchio("", 0));

  //  ── IL GUASTO CHE SI MOSTRA E' L'ULTIMO ────────────────────────────────
  const d = new DI.Diario(1000);
  c("un diario appena nato e' vuoto", true, d.vuoto());
  c("senza guasti non c'e' niente da mostrare", null, d.ultimoGuasto());
  d.segna(1000, "apertura");
  d.segna(3500, "chiedo la sala", "W03", "errore 502");
  d.segna(5000, "riprovo");
  d.segna(6000, "collegato", "W08");
  c("i tempi sono relativi all'apertura", 2500, d.tutte()[1].ms);
  c("si mostra l'ultimo guasto, non il primo", "W08", d.ultimoGuasto());
  //  ⚠️ Ogni codice DEVE avere il suo testo: un codice senza spiegazione a
  //   schermo e' un numero e basta, cioe' di nuovo niente.
  for (const cod of Object.keys(DI.GUASTI)) {
    c(`${cod} ha un testo per chi guarda`, true, !!DI.GUASTI[cod].che && !!DI.GUASTI[cod].fai);
    //  ⚠️ Anche qui niente firma: chi legge un guasto vuole sapere cosa fare,
    //   non chi ha fatto cosa. E niente gergo: sono frasi che una persona
    //   ripete al telefono.
    c(`${cod} non e' firmato`, false, /chi conduce|il relatore/i.test(`${DI.GUASTI[cod].che} ${DI.GUASTI[cod].fai}`));
  }

  //  ── ⚠️ SI BUTTA VIA DAL CENTRO, NON DALL'INIZIO ───────────────────────
  //   Le prime righe raccontano COME E' COMINCIATA, ed e' li' che sta quasi
  //   ogni guasto: buttando le piu' vecchie si perderebbe proprio l'inizio.
  const lungo = new DI.Diario(0, 10);
  for (let i = 0; i < 40; i++) lungo.segna(i * 100, `passo ${i}`);
  const righe = lungo.tutte();
  c("il diario resta corto", true, righe.length <= 10);
  c("la prima riga e' ancora la prima", "passo 0", righe[0].passo);
  c("l'ultima riga e' ancora l'ultima", "passo 39", righe[righe.length - 1].passo);
  c("e si dice che in mezzo manca qualcosa", true, righe.some((r) => /saltate/.test(r.passo)));

  //  Una nota lunghissima non deve riempire il diario.
  const lungoTesto = new DI.Diario(0);
  lungoTesto.segna(0, "x", "W05", "e".repeat(5000));
  c("le note tecniche si accorciano", true, lungoTesto.tutte()[0].nota.length <= 300);

  //  Il testo del file: deve essere leggibile da una persona, senza strumenti.
  const testo = DI.inTesto({ apparecchio: "iOS · Safari · 390px", quando: "2026-09-02 10:00", righe: d.tutte() });
  c("il file dice l'apparecchio", true, testo.includes("iOS · Safari"));
  c("il file dice il codice e cosa vuol dire", true, testo.includes("[W08]") && testo.includes("il video non arriva"));
}

/** ── I SEI MODI IN CUI UNA CAMERA «NON SI VEDE» ───────────────────────────
 *  Da fuori sono identici, e per tre volte la risposta e' stata un'ipotesi.
 *  Se questa funzione sbaglia a distinguerli, il pannello di diagnosi dice una
 *  bugia con l'aria di un fatto — che e' peggio di non dire niente. */
function proveDelRiquadro() {
  //  Il riquadro 16:9 dentro uno spazio qualunque.
  //  Lo spazio largo: comanda l'altezza, e resta del margine ai lati.
  const { riquadroDentro } = PT;
  const largo = riquadroDentro(1600, 500);
  c("spazio largo: altezza tutta", 500, largo.altezza);
  c("spazio largo: larghezza dal rapporto", 888, largo.larghezza);
  //  Lo spazio alto: comanda la larghezza.
  const alto = riquadroDentro(800, 900);
  c("spazio alto: larghezza tutta", 800, alto.larghezza);
  c("spazio alto: altezza dal rapporto", 450, alto.altezza);
  //  ⚠️ IL CASO DELLA CONSOLE: 870×578 era il riquadro sbagliato che usciva
  //   dal CSS. Il conto giusto tiene 16:9 e taglia l'altezza, non il video.
  const console = riquadroDentro(870, 578);
  c("console: larghezza tenuta", 870, console.larghezza);
  c("console: altezza rifatta", 489, console.altezza);
  c("console: sta nelle proporzioni", "1.78", (console.larghezza / console.altezza).toFixed(2));
  //  Non deve mai sforare lo spazio che gli è stato dato.
  for (const [l, a] of [[100, 100], [1, 900], [900, 1], [1920, 1080], [333, 777]]) {
    const r = riquadroDentro(l, a);
    c(`${l}x${a}: non sfora in larghezza`, true, r.larghezza <= l);
    c(`${l}x${a}: non sfora in altezza`, true, r.altezza <= a);
  }
  //  ── DOVE STA IL SECONDO RIQUADRO ────────────────────────────────────
  const due = { ospiti: 1, inPrimoPiano: true };
  //  ⚠️ IL CASO DELLA CONSOLE: scena 872x590. Affiancati verrebbero 433,
  //   impilati 519 — quindi impilati, anche se la scena è più larga che alta.
  c("scena 872x590: uno sopra l'altro", "sopra",
    PT.disponiPalco({ larghezza: 1280, altezza: 600, ...due, scena: { larghezza: 872, altezza: 590 } }).orientamento);
  //  Una scena molto larga e bassa: lì affiancati vince davvero.
  c("scena 1600x420: affiancati", "fianco",
    PT.disponiPalco({ larghezza: 1600, altezza: 420, ...due, scena: { larghezza: 1600, altezza: 420 } }).orientamento);
  //  Il telefono in piedi: uno sopra l'altro, come sempre.
  c("telefono 390x620: uno sopra l'altro", "sopra",
    PT.disponiPalco({ larghezza: 390, altezza: 620, ...due, scena: { larghezza: 390, altezza: 620 } }).orientamento);
  //  ⚠️ La scelta è sempre quella che dà la faccia più grande: lo verifico
  //   rifacendo il conto, non ricopiando la risposta attesa.
  for (const [l, a] of [[872, 590], [1600, 420], [390, 620], [1280, 720], [700, 700], [1100, 300]]) {
    const d = PT.disponiPalco({ larghezza: l, altezza: a, ...due, scena: { larghezza: l, altezza: a } });
    const fianco = Math.min((l - 6) / 2, a * (16 / 9));
    const sopra = Math.min(l, ((a - 6) / 2) * (16 / 9));
    c(`${l}x${a}: sceglie la faccia più grande`, fianco >= sopra ? "fianco" : "sopra", d.orientamento);
  }
  //  Senza misura vera resta la finestra: nessuno si rompe se non è misurata.
  c("senza misura non esplode", true,
    ["fianco", "sopra"].includes(PT.disponiPalco({ larghezza: 1280, altezza: 600, ...due }).orientamento));

  //  Senza misura torna zero, così chi chiama sa di dover usare la riserva.
  c("non misurato: zero", 0, riquadroDentro(0, 500).larghezza);
  c("misura assurda: zero", 0, riquadroDentro(800, -3).altezza);
}

function proveDellaTracciaSola() {
  const { soloLUltima } = SF;
  //  Un flusso finto con la stessa faccia di `MediaStream`, quel tanto che
  //  basta: qui si prova la REGOLA, non il browser.
  const flusso = () => {
    const dentro = [];
    return {
      dentro,
      getTracks: () => dentro.slice(),
      addTrack: (x) => dentro.push(x),
      removeTrack: (x) => { const i = dentro.indexOf(x); if (i >= 0) dentro.splice(i, 1); },
    };
  };
  const v = (n) => ({ kind: "video", id: n });
  const a = (n) => ({ kind: "audio", id: n });

  //  ⚠️ IL CASO SEGNALATO: chi conduce si ricollega tre volte e nel flusso
  //   restavano tre video e tre audio. L'elemento disegna il PRIMO, quindi
  //   quello di una sessione finita: schermo nero.
  const f = flusso();
  soloLUltima(f, a("a1")); soloLUltima(f, v("v1"));
  soloLUltima(f, v("v2")); soloLUltima(f, v("v3"));
  soloLUltima(f, a("a2"));
  c("resta una traccia per tipo", 2, f.getTracks().length);
  c("il video è l'ultimo arrivato", "v3", f.getTracks().find((x) => x.kind === "video").id);
  c("l'audio è l'ultimo arrivato", "a2", f.getTracks().find((x) => x.kind === "audio").id);

  //  ⚠️ Un tipo non tocca l'altro: mandare video non deve zittire l'audio.
  const g = flusso();
  soloLUltima(g, a("solo-audio"));
  soloLUltima(g, v("solo-video"));
  c("il video non caccia l'audio", 2, g.getTracks().length);

  //  Rimandare la STESSA traccia non la fa sparire né la duplica.
  const h = flusso();
  const stessa = v("uguale");
  soloLUltima(h, stessa); soloLUltima(h, stessa); soloLUltima(h, stessa);
  c("la stessa traccia non si duplica", 1, h.getTracks().length);
  c("e resta lei", "uguale", h.getTracks()[0].id);

  //  Su un flusso vuoto funziona come un semplice «aggiungi».
  const k = flusso();
  soloLUltima(k, v("prima"));
  c("flusso vuoto: la prende e basta", 1, k.getTracks().length);
}

function proveDelleRegoleDellaChat() {
  const { regolaChat, PERSONE_PER_IL_TASTO, PERSONE_PER_CHIUDERLA } = CH;
  const q = (persone, contenuti = false, scelta = null) => regolaChat({ persone, contenuti, scelta });
  const largo = (persone, contenuti = false, scelta = null) =>
    regolaChat({ persone, contenuti, scelta, largo: true });

  //  ── ⚠️ SUL COMPUTER LA CHAT È FISSA ─────────────────────────────────
  //   Le regole nascono dallo SPAZIO, e su un computer lo spazio c'è: la chat
  //   prende ventun rem e alla diretta resta tutto il resto. Non c'è niente da
  //   contendersi, quindi non si chiude — nemmeno con un contenuto in onda,
  //   nemmeno in una sala da mille persone, nemmeno se qualcuno l'aveva chiusa
  //   quando era su uno schermo stretto.
  c("computer: sempre aperta", true, largo(0).aperta);
  c("computer: nessun tasto", false, largo(0).tasto);
  c("computer con contenuti: resta aperta", true, largo(50, true).aperta);
  c("computer in mille: resta aperta", true, largo(1000).aperta);
  c("computer: una vecchia scelta non la chiude", true, largo(50, true, false).aperta);


  //  ⚠️ SOLO CHI CONDUCE: la chat resta aperta e il tasto non c'è. Chiuderla
  //   vorrebbe dire restare da soli davanti a un video senza modo di tornare
  //   indietro.
  c("da solo: chat aperta", true, q(0).aperta);
  c("da solo: nessun tasto", false, q(0).tasto);
  //  ⚠️ MA CON UN CONTENUTO IN ONDA SI CHIUDE LO STESSO, e il tasto compare.
  //   Una slide su un telefono con la chat aperta si legge a metà: quella è la
  //   cosa da guardare e si prende lo schermo. E il tasto DEVE esserci, perché
  //   è l'unica regola che chiude la chat da sola: senza, resterebbe chiusa
  //   per tutta la diretta.
  c("da solo, con contenuti: si chiude", false, q(0, true).aperta);
  c("da solo, con contenuti: il tasto compare", true, q(0, true).tasto);
  c("in tre, con contenuti: si chiude", false, q(3, true).aperta);
  c("in tre, con contenuti: si può riaprire", true, q(3, true).tasto);
  c("in tre, con contenuti, riaperta a mano: resta aperta", true, q(3, true, true).aperta);

  //  Poche persone: uguale. La chat è la sala, non un ingombro.
  c("in tre: aperta", true, q(3).aperta);
  c("in tre: nessun tasto", false, q(3).tasto);
  c("in nove: ancora nessun tasto", false, q(PERSONE_PER_IL_TASTO - 1).tasto);

  //  Da dieci compare il tasto, e la chat parte comunque aperta.
  c("in dieci: compare il tasto", true, q(PERSONE_PER_IL_TASTO).tasto);
  c("in dieci: parte aperta", true, q(PERSONE_PER_IL_TASTO).aperta);

  //  Con un contenuto in onda si fa spazio, a qualunque numero di persone.
  c("in dieci, con contenuti: parte chiusa", false, q(PERSONE_PER_IL_TASTO, true).aperta);
  c("in dieci, con contenuti: il tasto resta", true, q(PERSONE_PER_IL_TASTO, true).tasto);

  //  Da quaranta parte chiusa anche senza contenuti.
  c("in trentanove: ancora aperta", true, q(PERSONE_PER_CHIUDERLA - 1).aperta);
  c("in quaranta: parte chiusa", false, q(PERSONE_PER_CHIUDERLA).aperta);
  c("in quaranta: il tasto c'è", true, q(PERSONE_PER_CHIUDERLA).tasto);

  //  ⚠️ LA SCELTA DI CHI GUARDA VINCE SEMPRE: una chat che si richiude da sola
  //   dopo che l'hai aperta è una chat rotta.
  c("aperta a mano con contenuti: resta aperta", true, q(20, true, true).aperta);
  c("chiusa a mano senza contenuti: resta chiusa", false, q(20, false, false).aperta);
  c("aperta a mano in una sala da mille: resta aperta", true, q(1000, true, true).aperta);
  //  ⚠️ Ma non può scavalcare il caso «non c'è il tasto»: senza tasto quella
  //   scelta non ha potuto farla nessuno, e onorarla vorrebbe dire fidarsi di
  //   una scelta rimasta in memoria da quando la sala era piena.
  c("senza tasto la scelta non conta", true, q(2, false, false).aperta);

  //  Numeri storti non rompono niente.
  c("numero assurdo: si comporta come zero", false, q(-5).tasto);
  c("numero mancante: si comporta come zero", true, regolaChat({ persone: NaN, contenuti: false, scelta: null }).aperta);
}

function proveDellIscrizione() {
  const { numeroPerWhatsApp, numeroLeggibile, testoPromemoria } = IS;

  //  ⚠️ LO STESSO TELEFONO SCRITTO IN CINQUE MODI DEVE DARE UNA RIGA SOLA.
  //   Senza, diventano cinque persone: cinque promemoria allo stesso numero e
  //   un conto degli iscritti gonfiato che nessuno saprebbe spiegare.
  const stesso = ["3391234567", "339 123 4567", "339-123-4567", "+39 3391234567", "0039 339 1234567"];
  const usciti = new Set(stesso.map(numeroPerWhatsApp));
  c("cinque modi, un numero solo", 1, usciti.size);
  c("ed e' quello internazionale", "393391234567", [...usciti][0]);

  //  ⚠️ Il caso piu' comune di tutti: il cellulare italiano scritto senza
  //   prefisso. Rifiutarlo vorrebbe dire perdere meta' delle iscrizioni per una
  //   formalita'.
  c("cellulare senza prefisso", "393391234567", numeroPerWhatsApp("3391234567"));
  c("cellulare a dieci cifre", "393401234567", numeroPerWhatsApp("3401234567"));
  //  ⚠️ Undici cifre che cominciano per 3 NON sono un cellulare italiano: non
  //   si mette il prefisso a caso, si lascia com'è e si accetta come numero
  //   internazionale. Mettere «39» davanti a tutto quello che comincia per 3
  //   vorrebbe dire spedire messaggi a numeri che non esistono.
  c("undici cifre: nessun prefisso inventato", "34012345678", numeroPerWhatsApp("34012345678"));

  //  Numeri stranieri gia' completi restano com'erano.
  c("numero straniero col piu'", "447700900123", numeroPerWhatsApp("+44 7700 900123"));
  c("numero straniero con 00", "447700900123", numeroPerWhatsApp("0044 7700 900123"));

  //  ⚠️ Quello che non e' un telefono NON si salva: meglio dire «controlla il
  //   numero» che raccogliere un contatto che non rispondera' mai.
  c("troppo corto: niente", "", numeroPerWhatsApp("12345"));
  c("troppo lungo: niente", "", numeroPerWhatsApp("1234567890123456789"));
  c("vuoto: niente", "", numeroPerWhatsApp(""));
  c("solo lettere: niente", "", numeroPerWhatsApp("non lo dico"));
  c("niente al posto del numero: non esplode", "", numeroPerWhatsApp(null));

  //  Come si rimostra a chi l'ha scritto.
  c("si rilegge raggruppato", "+39 339 123 4567", numeroLeggibile("393391234567"));
  c("straniero: almeno il piu'", "+447700900123", numeroLeggibile("447700900123"));
  c("vuoto resta vuoto", "", numeroLeggibile(""));

  //  ── IL TESTO ────────────────────────────────────────────────────────
  const fra = testoPromemoria({ tipo: "manca-poco", titolo: "Tre strade", link: "https://x.it/w/abc", nome: "Marco Rossi" });
  const ora = testoPromemoria({ tipo: "in-diretta", titolo: "Tre strade", link: "https://x.it/w/abc", nome: "Marco Rossi" });

  //  ⚠️ IL LINK C'E' SEMPRE E PER INTERO: un promemoria che costringe a cercare
  //   il link nella cronologia e' un promemoria che non fa venire nessuno.
  for (const [nome, testo] of [["manca poco", fra], ["in diretta", ora]]) {
    c(`${nome}: c'e' il link`, true, testo.includes("https://x.it/w/abc"));
    c(`${nome}: c'e' il titolo`, true, testo.includes("Tre strade"));
    c(`${nome}: chiama per nome`, true, testo.includes("Marco"));
    c(`${nome}: solo il nome, non il cognome`, false, testo.includes("Rossi"));
    //  ⚠️ Nessuna promessa che non possiamo mantenere: chi ci casca una volta
    //   non apre piu' il secondo messaggio.
    c(`${nome}: niente posti limitati`, false, /posti limitati|ultima occasione|affrettati/i.test(testo));
  }
  //  ⚠️ I due momenti chiedono cose diverse: «manca un'ora» invita a
  //   organizzarsi, «siamo in diretta» invita a toccare adesso.
  c("i due testi sono diversi", true, fra !== ora);
  c("in diretta dice adesso", true, /adesso/i.test(ora));

  //  Senza nome non si scrive «Ciao ,».
  const anonimo = testoPromemoria({ tipo: "in-diretta", titolo: "Tre strade", link: "https://x.it/w/abc" });
  c("senza nome: nessun saluto monco", false, anonimo.includes("Ciao ,"));
  c("senza nome: il link c'e' lo stesso", true, anonimo.includes("https://x.it/w/abc"));
  //  Senza titolo non si scrive «con .»
  const senzaTitolo = testoPromemoria({ tipo: "in-diretta", titolo: "", link: "https://x.it/w/abc" });
  c("senza titolo: una parola al posto suo", true, senzaTitolo.includes("la diretta"));
}

function proveDellaMisura() {
  const { misuraDiretta } = MD2;
  const M = 60_000;
  const t0 = 1_700_000_000_000;
  //  Una diretta di un'ora con tre persone: una resta tutta, una se ne va al
  //  dieci, una arriva al venti e resta fino alla fine.
  const presenze = [
    { entrata: t0, uscita: t0 + 60 * M },
    { entrata: t0, uscita: t0 + 10 * M },
    { entrata: t0 + 20 * M, uscita: t0 + 60 * M },
  ];
  const m = misuraDiretta({ presenze, inizio: t0, fine: t0 + 60 * M, conversioni: 1 });

  c("entrati", 3, m.entrati);
  c("picco", 2, m.picco);
  //  60 + 10 + 40 = 110 su tre persone.
  c("permanenza media", 36.7, m.permanenzaMedia);
  //  ⚠️ La mediana e' un'altra cosa dalla media, e serve: qui dice 40 contro
  //   36,7 — chi sta nel mezzo e' rimasto quaranta minuti, mentre la media e'
  //   tirata giu' da chi se n'e' andato dopo dieci. Su una sala vera la
  //   distanza fra le due e' il primo segnale che il pubblico si spacca in
  //   due: chi resta fino in fondo e chi se ne va subito.
  c("permanenza mediana", 40, m.permanenzaMediana);
  c("conversioni", 1, m.conversioni);
  c("tasso su chi e' entrato", 33.3, m.tassoConversione);

  //  ── LA CURVA ────────────────────────────────────────────────────────
  c("un punto per minuto piu' lo zero", 61, m.curva.length);
  c("al minuto 0 ce ne sono due", 2, m.curva[0].presenti);
  c("al minuto 5 ancora due", 2, m.curva[5].presenti);
  //  ⚠️ Al minuto 11 la seconda persona se n'e' andata: la curva lo vede.
  c("al minuto 11 ne resta una", 1, m.curva[11].presenti);
  c("al minuto 25 sono due", 2, m.curva[25].presenti);
  c("al minuto 60 sono due", 2, m.curva[60].presenti);

  //  ⚠️ IL PEGGIOR MINUTO SI CERCA DOPO IL PICCO. Qui il picco e' al minuto 0
  //   (due persone) e l'abbandono al minuto 11.
  c("peggior minuto", 11, m.peggiorMinuto.minuto);
  c("quanti persi", 1, m.peggiorMinuto.persi);

  //  ⚠️ Prima del picco la gente STA ARRIVANDO: un calo li' dentro sarebbe
  //   un'onda di arrivi, non un abbandono. Con tutti che entrano a scaglioni e
  //   nessuno che esce, non deve esserci nessun «peggior minuto».
  const soloArrivi = misuraDiretta({
    presenze: [
      { entrata: t0, uscita: t0 + 30 * M },
      { entrata: t0 + 5 * M, uscita: t0 + 30 * M },
      { entrata: t0 + 10 * M, uscita: t0 + 30 * M },
    ],
    inizio: t0, fine: t0 + 30 * M,
  });
  c("nessuno se n'e' andato: nessun peggior minuto", null, soloArrivi.peggiorMinuto);
  c("il picco e' quando ci sono tutti", 10, soloArrivi.minutoDelPicco);

  //  ── I CASI STORTI NON SPORCANO NIENTE ───────────────────────────────
  //  ⚠️ Una presenza che finisce prima di cominciare e' un orologio sbagliato:
  //   contarla darebbe permanenze NEGATIVE dentro una media.
  const conStorta = misuraDiretta({
    presenze: [...presenze, { entrata: t0 + 10 * M, uscita: t0 + 5 * M }],
    inizio: t0, fine: t0 + 60 * M,
  });
  c("la riga storta si butta", 3, conStorta.entrati);
  c("la media resta sana", true, conStorta.permanenzaMedia > 0);

  //  ⚠️ Il tasso non puo' superare cento: un numero impossibile toglie fiducia
  //   a tutti gli altri della schermata.
  c("tasso mai oltre cento", 100,
    misuraDiretta({ presenze, inizio: t0, fine: t0 + 60 * M, conversioni: 99 }).tassoConversione);
  c("conversioni negative valgono zero", 0,
    misuraDiretta({ presenze, inizio: t0, conversioni: -5 }).conversioni);

  //  Sala vuota: zero dappertutto, non un errore.
  const vuota = misuraDiretta({ presenze: [], inizio: t0 });
  c("sala vuota: zero entrati", 0, vuota.entrati);
  c("sala vuota: nessuna curva", 0, vuota.curva.length);
  c("sala vuota: tasso zero", 0, vuota.tassoConversione);
  c("senza inizio non si inventa niente", 0, misuraDiretta({ presenze, inizio: NaN }).entrati);

  //  ⚠️ Una diretta di quaranta secondi non deve dare una curva vuota, che si
  //   leggerebbe come «non e' entrato nessuno».
  const lampo = misuraDiretta({
    presenze: [{ entrata: t0, uscita: t0 + 40_000 }], inizio: t0, fine: t0 + 40_000,
  });
  c("diretta lampo: la curva c'e'", true, lampo.curva.length >= 2);
  c("diretta lampo: uno dentro", 1, lampo.curva[0].presenti);

  //  Senza «fine» si prende l'ultima uscita, e il conto torna lo stesso.
  const senzaFine = misuraDiretta({ presenze, inizio: t0 });
  c("senza fine: stessa curva", m.curva.length, senzaFine.curva.length);
}

function proveDellaVersione() {
  const { ingressoDaHtml, versioneVecchia } = VE;

  const html = '<!DOCTYPE html><html><head><link rel="modulepreload" href="/assets/index-DxOHUInT.js"/>'
    + '<link rel="modulepreload" href="/assets/webinar_._code-k5z0fxL4.js"/></head></html>';
  c("trova il file d'ingresso", "index-DxOHUInT.js", ingressoDaHtml(html));
  //  ⚠️ Il PRIMO, e non uno qualunque: nella pagina ci sono anche i pezzi delle
  //   singole rotte, che cambiano per conto loro.
  c("non prende un pezzo qualunque", true, !ingressoDaHtml(html).includes("webinar"));
  c("pagina senza assets: non si conclude niente", "", ingressoDaHtml("<html></html>"));
  c("pagina vuota: non esplode", "", ingressoDaHtml(""));
  c("niente al posto della pagina: non esplode", "", ingressoDaHtml(null));

  //  ⚠️ Si accende SOLO quando si sa davvero che sono diversi: un avviso che
  //   compare per sbaglio insegna a ignorarlo, e quando serve non lo guarda
  //   piu' nessuno.
  c("uguali: nessun avviso", false, versioneVecchia("index-A.js", "index-A.js"));
  c("diversi: avviso", true, versioneVecchia("index-A.js", "index-B.js"));
  c("non so cosa gira qui: nessun avviso", false, versioneVecchia("", "index-B.js"));
  c("non so cosa e' pubblicato: nessun avviso", false, versioneVecchia("index-A.js", ""));
  c("non so niente: nessun avviso", false, versioneVecchia("", ""));
}

/* ═══════════════════════════════════════════════════════════════════════════
   I MESSAGGI PRONTI, UNO PER STATO
   ═════════════════════════════════════════════════════════════════════════ */

/** ── ⚠️ NESSUNA PROVA LI GUARDAVA, E PARTONO DECINE DI VOLTE AL GIORNO ─────
 *  Sono i testi che arrivano davvero sul telefono dei clienti. Un errore qui
 *  non fa fallire niente: parte, e basta. Queste prove tengono le tre regole
 *  che il committente ha chiesto e che si perdono alla prima riscrittura
 *  distratta — ogni stato ha il SUO testo, nessuno e' firmato, e nessuno da'
 *  del Lei mentre gli altri danno del tu.
 */
function proveDeiMessaggiPerStato() {
  const { MODELLI_ORIGINALI, componiMessaggio, controllaModello, SOGLIA_LUNGO } = WA;
  const stati = TY.ALL_LEAD_STATUSES;

  //  ⚠️ UNO PER STATO, SENZA BUCHI. Uno stato senza testo non da' errore: fa
  //   partire il ripiego, cioe' «Ciao Mario,» e basta, a un cliente che
  //   aspettava una risposta.
  for (const s of stati) {
    const m = MODELLI_ORIGINALI[s];
    c(`${s}: ha un messaggio`, true, typeof m === "string" && m.length > 20);
  }
  c("nessuno stato senza testo", 0, stati.filter((s) => !MODELLI_ORIGINALI[s]).length);

  for (const s of stati) {
    const m = MODELLI_ORIGINALI[s];
    //  ⚠️ NIENTE FIRMA. Su WhatsApp il nome di chi scrive sta gia' in cima
    //   alla chat: ripeterlo in fondo fa una lettera, non un messaggio.
    c(`${s}: non e' firmato`, false, /\{firma\}|Hair Genius Labs\s*$|A presto[,.]?\s*$|Cordiali|Un saluto/i.test(m));
    //  ⚠️ SI DA' DEL TU, in tutti. Due registri diversi fra la voce e la chat
    //   si notano: al telefono ci si da' del tu da settimane.
    c(`${s}: da' del tu`, false, /\bGentile\b|\bLei\b|\bLe va bene\b|\bmi conferma\b/.test(m));
    //  Chiama la persona per nome: senza, si legge come un invio di massa.
    c(`${s}: chiama per nome`, true, m.includes("{nome}"));
    //  Entra in una schermata di telefono: oltre, viene letto a meta'.
    c(`${s}: sta in una schermata`, true, m.length <= SOGLIA_LUNGO);
    //  E non lascia problemi bloccanti (segnaposto inventati, graffe spaiate).
    c(`${s}: nessun errore nel modello`, 0,
      controllaModello(s, m).filter((p) => p.livello === "errore").length);
  }

  //  ⚠️ SULLE CHIUSURE NON SI FA DOMANDE. Chi ha detto no, o e' sparito, o ha
  //   gia' comprato tutto: una domanda li' e' l'unica vera scortesia, ed e' il
  //   motivo per cui una persona blocca il numero.
  for (const s of ["annullato", "ripensamento", "irreperibile", "perdi_tempo", "concluso"]) {
    c(`${s}: non insiste con una domanda`, false, MODELLI_ORIGINALI[s].includes("?"));
  }

  //  ⚠️ E DOVE C'E' UN PASSO DOPO, LA DOMANDA C'E' — ed e' CHIUSA: «domani alle
  //   15 va bene?» ottiene un si' o un no, «quando ti fa comodo?» non ottiene
  //   niente e la trattativa si ferma li'.
  for (const s of ["non_risponde", "segreteria", "non_fatto", "da_spostare", "no_show",
                   "fissa_meet_dopo", "in_attesa_acconto", "posa_a_domicilio"]) {
    c(`${s}: chiede il passo dopo`, true, MODELLI_ORIGINALI[s].includes("?"));
  }

  //  ⚠️ OGNI TESTO DEVE DIRE LA COSA VERA DEL SUO STATO. Questa e' la prova che
  //   avrebbe preso il difetto vero gia' successo: «Ricontatto fissato» viene
  //   DOPO la consulenza, e il testo di allora parlava come se non ci fossimo
  //   mai visti.
  //  ⚠️ E questo si manda IL GIORNO del ricontatto — e' il giorno in cui la
  //   scheda compare fra le cose da fare — quindi mantiene la promessa invece
  //   di annunciarla: «come d'accordo ci sentiamo giovedi'» mandato giovedi'
  //   suona come se ci fossimo dimenticati di chiamare.
  c("da_ricontattare: ricorda che ci si e' gia' parlati", true,
    /consulenza|eravamo rimasti|risentiamo|pensarci/i.test(MODELLI_ORIGINALI.da_ricontattare));
  /*  ── ⚠️ I QUATTRO STATI DI CHI STA DECIDENDO DICONO LA STESSA COSA ────
      Richiesta del committente: «da ricontattare, in chat, ci deve pensare,
      ecc ecc: tutti questi stati devono avere lo stesso messaggio». Per il
      cliente sono lo stesso momento — consulenza fatta, preventivo in mano,
      deve decidere — e quattro testi diversi erano quattro modi di dire la
      stessa cosa.
      ⚠️ E devono portare IL PREVENTIVO: e' il motivo per cui quel messaggio
       esiste, e in nessuno dei quattro c'era. */
  for (const s of ["da_ricontattare", "sta_valutando", "gestire_in_chat", "fissa_meet_dopo"]) {
    c(`${s}: e' il messaggio di chi sta decidendo`, MODELLI_ORIGINALI.da_ricontattare,
      MODELLI_ORIGINALI[s]);
    c(`${s}: porta il preventivo`, true, MODELLI_ORIGINALI[s].includes("{preventivi}"));
  }
  //  ⚠️ E NON il link alla raccolta dei lavori: vale per chi non ci conosce,
  //   a chi ha appena fatto la consulenza dice «non mi ricordo chi sei».
  c("chi sta decidendo non riceve la raccolta dei lavori", false,
    MODELLI_ORIGINALI.da_ricontattare.includes("/media/"));
  //  Chi lo corregge dal pannello li corregge tutti e quattro (vedi modelloDi).
  c("gli altri tre seguono il testo del ricontatto", "da_ricontattare",
    WA.SEGUE_IL_TESTO_DI("gestire_in_chat"));
  c("e il capofila non segue nessuno", null, WA.SEGUE_IL_TESTO_DI("da_ricontattare"));
  c("da_ricontattare: non annuncia un richiamo futuro", false,
    MODELLI_ORIGINALI.da_ricontattare.includes("{quando}"));
  //  ⚠️ «Richiamo concordato» si manda dopo aver provato a chiamare all'ora
  //   che aveva chiesto LUI: dice che ci abbiamo provato e rimette a lui
  //   l'orario, che e' l'unica cosa che serve per riprovare bene.
  c("richiamo: dice che si e' provato a chiamare", true,
    /chiamato|raggiungerti/i.test(MODELLI_ORIGINALI.richiamo));
  c("richiamo: chiede quando richiamare", true,
    /quando/i.test(MODELLI_ORIGINALI.richiamo));
  //  «In valutazione»: chiede a che punto e' il pensiero, senza rivendere.
  c("sta_valutando: chiede come vuole procedere", true,
    /deciso|procedere|chiarimenti/i.test(MODELLI_ORIGINALI.sta_valutando));

  /*  ── ⚠️ QUANDO IL PROMEMORIA HA SENSO ──────────────────────────────────
      Mandato dopo, ricorda un incontro gia' avvenuto e lo fa sembrare saltato.
      Data e stato si leggono INSIEME: su un appuntamento quello di oggi va
      ricordato (e' il promemoria della mattina stessa); su una consulenza gia'
      fatta la data di oggi e' quella dell'incontro appena concluso. */
  const { promemoriaUtile } = WA;
  const app = { stato: "appuntamento_fissato", dataMeeting: "2026-09-15" };
  c("appuntamento di oggi: si ricorda", true, promemoriaUtile(app, "2026-09-15"));
  c("appuntamento di domani: si ricorda", true, promemoriaUtile(app, "2026-09-14"));
  c("appuntamento di ieri: non si ricorda", false, promemoriaUtile(app, "2026-09-16"));
  const dopo = { stato: "sta_valutando", dataMeeting: "2026-09-15" };
  c("consulenza appena fatta: niente promemoria", false, promemoriaUtile(dopo, "2026-09-15"));
  c("ma un appuntamento nuovo piu' avanti si ricorda", true,
    promemoriaUtile({ stato: "sta_valutando", dataMeeting: "2026-09-20" }, "2026-09-15"));
  c("senza data non si ricorda niente", false, promemoriaUtile({ stato: "appuntamento_fissato" }, "2026-09-15"));
  c("senza scheda non si rompe", false, promemoriaUtile(undefined, "2026-09-15"));
  //  ⚠️ Le date arrivano anche come ISO intero: il confronto va fatto sui
  //   primi dieci caratteri, se no «2026-09-15T14:00» risulta dopo «2026-09-15».
  c("una data con l'ora dentro conta come il suo giorno", true,
    promemoriaUtile({ stato: "appuntamento_fissato", dataMeeting: "2026-09-15T14:00:00" }, "2026-09-15"));

  /*  ── ⚠️ TRE PROMEMORIA, NON UNO ────────────────────────────────────────
      Il promemoria parlava SEMPRE di videochiamata: «ti ricordo il nostro
      appuntamento, ecco il LINK, collegati da un posto tranquillo». A chi
      deve VENIRE in studio mandava un link invece dell'indirizzo; a chi
      aspetta una TELEFONATA chiedeva di «esserci» da qualche parte. E
      guardava solo `dataMeeting`: su una scheda con un richiamo fissato per
      domani il tasto non compariva nemmeno. */
  const { promemoriaDi, buildMeetReminderMessage, INDIRIZZO_SEDE } = WA;
  const OGGIP = "2026-09-15";

  //  Chi viene da noi: la data e' quella della visita, e il testo e' un altro.
  const inSede = { stato: "viene_in_sede", dataVieneInSede: "2026-09-16", oraVieneInSede: "10:00" };
  c("visita in studio: il suo promemoria", "promemoria_sede", promemoriaDi(inSede, OGGIP));
  const testoSede = buildMeetReminderMessage({ data: { ...inSede, nome: "Marco" } }, "", OGGIP);
  c("dice dove presentarsi", true, testoSede.includes(INDIRIZZO_SEDE));
  /*  ⚠️ NIENTE LINK DELLA STANZA: questa persona prende la macchina, non apre
      una videochiamata, e un indirizzo da toccare le farebbe credere il
      contrario.
      ⚠️ Il link dei RISULTATI invece c'è, ed è un'altra cosa — richiesta del
       committente: «deve sempre integrare il link dei media a tutti i
       messaggi». Non si può scambiare per un invito a collegarsi: la riga
       sopra dice che sono i risultati di altri clienti. Per questo la prova
       guarda la STANZA, non un `http` qualunque: guardando «nessun link»
       vieterebbe anche quello che il committente ha chiesto di mettere. */
  c("e non manda il link della stanza", false, /meetly|videochiamata/i.test(testoSede));
  c("ma i risultati sì", true, testoSede.includes("/media/"));
  c("nemmeno «collegati»", false, /collegat/i.test(testoSede));
  //  ⚠️ E cita il giorno GIUSTO: quello della visita, non un meet mai fatto.
  c("cita il giorno della visita", true, /mercoled/i.test(testoSede));

  //  Chi aspetta una telefonata: la data e' quella del ricontatto.
  const daChiamare = { stato: "da_ricontattare", dataRicontatto: "2026-09-16", oraRicontatto: "11:00", dataMeeting: "2026-07-20" };
  c("richiamo fissato: il suo promemoria", "promemoria_richiamo", promemoriaDi(daChiamare, OGGIP));
  //  ⚠️ IL CASO CHE NON COMPARIVA AFFATTO: prima si guardava solo dataMeeting,
  //   che qui e' la consulenza di luglio — il tasto non usciva, o usciva
  //   citando una data vecchia.
  c("prima questo tasto non compariva nemmeno", true, promemoriaUtile(daChiamare, OGGIP));
  const testoRichiamo = buildMeetReminderMessage({ data: { ...daChiamare, nome: "Marco" } }, "", OGGIP);
  c("dice che chiamiamo noi", true, /ti chiamo io/i.test(testoRichiamo));
  //  Stessa regola del promemoria in studio: niente stanza, i risultati sì.
  c("e non parla di appuntamenti con un link", false, /meetly|videochiamata/i.test(testoRichiamo));
  c("ma i risultati ci sono anche qui", true, testoRichiamo.includes("/media/"));
  //  ⚠️ E NON cita la consulenza di luglio: cita il richiamo di domani.
  c("cita il giorno del richiamo", true, /mercoled/i.test(testoRichiamo));
  c("non la consulenza gia' fatta", false, /luglio/i.test(testoRichiamo));

  //  La consulenza online resta com'era: il link ci vuole.
  c("consulenza online: il promemoria di sempre", "promemoria", promemoriaDi(app, OGGIP));
  const testoMeet = buildMeetReminderMessage(
    { data: { ...app, nome: "Marco", linkMeeting: "https://hairgeniuslabs.it/stanza/m" } }, "", OGGIP,
  );
  c("manda il link della stanza", true, /http/i.test(testoMeet));

  //  Niente da ricordare: nessuna delle tre date e' davanti a noi.
  c("niente da ricordare: nessun promemoria", null,
    promemoriaDi({ stato: "da_ricontattare", dataRicontatto: "2026-09-10" }, OGGIP));
  //  ⚠️ Lo stato comanda anche qui: una data di visita su una scheda che in
  //   studio non ci deve venire non fa comparire il promemoria della sede.
  c("la data da sola non basta", null,
    promemoriaDi({ stato: "gestire_in_chat", dataVieneInSede: "2026-09-16" }, OGGIP));
  /*  ── ⚠️ UN MESSAGGIO NON PROMETTE UN LINK CHE NON HA ───────────────────
      Il promemoria diceva «Link:» e poi, su una scheda senza stanza, quella
      riga spariva — ma restava «collegati da un posto tranquillo»: si chiede
      a una persona di collegarsi a niente. Adesso la riga resta e dice la
      verita': il link arriva poco prima. */
  const senzaStanza = { id: "x", data: { nome: "Marco", stato: "appuntamento_fissato", dataMeeting: "2026-09-16", oraMeeting: "15:30" } };
  const promSenza = buildMeetReminderMessage(senzaStanza, "", OGGIP);
  c("senza stanza il promemoria non lascia «Link:» a vuoto", true, /poco prima/.test(promSenza));
  c("e non resta nessun segnaposto nel testo", 0, WA.segnapostiResidui(promSenza).length);
  //  Con la stanza, il link c'e' davvero.
  const conStanza = { id: "x", data: { ...senzaStanza.data, linkMeeting: "https://hair-genius-hub.hair/meetly/abc-def-ghi" } };
  c("con la stanza il link e' quello vero", true, /meetly\/abc-def-ghi/.test(buildMeetReminderMessage(conStanza, "", OGGIP)));

  /*  ── ⚠️ I NOMI DEI GIORNI SONO ITALIANI SEMPRE ──────────────────────────
      Venivano da `toLocaleDateString("it-IT")`: in un browser va bene, in un
      Worker la lingua non e' garantita e quello che esce e' «Thursday» in
      mezzo a un messaggio italiano. Adesso arrivano dalla lista scritta a
      mano di crm/lavori, come gia' faceva il messaggio di ripresa. */
  const fraDueGiorni = { id: "x", data: { nome: "Marco", stato: "appuntamento_fissato", dataMeeting: "2026-09-17", oraMeeting: "15:30" } };
  const testoGiorno = WA.getWhatsAppMessageForStatus(fraDueGiorni);
  c("entro la settimana basta il giorno, in italiano", true, /gioved/i.test(testoGiorno));
  c("e non esce nessun nome inglese", false, /monday|tuesday|wednesday|thursday|friday|saturday|sunday/i.test(testoGiorno));
  //  ⚠️ Oltre la settimana serve anche il giorno del mese: «martedì» da solo
  //   puo' essere uno qualsiasi dei martedì che verranno.
  const fraUnMese = { id: "x", data: { nome: "Marco", stato: "appuntamento_fissato", dataMeeting: "2026-10-20", oraMeeting: "15:30" } };
  c("oltre la settimana si dice anche la data", true, /20 ottobre/.test(WA.getWhatsAppMessageForStatus(fraUnMese)));

  c("sede_disdetta: parla della visita, non del meet", true,
    /visita|passare/i.test(MODELLI_ORIGINALI.sede_disdetta));
  c("posa_in_sede: dice dove si va", true, MODELLI_ORIGINALI.posa_in_sede.includes("Scipioni"));
  c("posa_a_domicilio: chiede l'indirizzo", true,
    MODELLI_ORIGINALI.posa_a_domicilio.includes("indirizzo"));
  //  ⚠️ La prova guarda la COSA VERA di quello stato — che l'impianto viaggia
  //   e dove deve arrivare — non le parole esatte: i testi li riscrive il
  //   committente quando vuole, e una prova incollata a una frase si rompe a
  //   ogni ritocco senza che niente sia peggiorato davvero.
  c("posa_da_spedire: dice che si spedisce", true,
    /spedi/i.test(MODELLI_ORIGINALI.posa_da_spedire));
  c("posa_da_spedire: chiede dove mandarlo", true,
    /indirizzo/i.test(MODELLI_ORIGINALI.posa_da_spedire));
  //  ⚠️ Le tre chiusure vinte non promettono una data: quando si chiude la
  //   vendita il giorno della posa non c'e' ancora, e {quando} ripiegherebbe
  //   su quello della CONSULENZA — una data gia' passata.
  for (const s of ["posa_in_sede", "posa_a_domicilio", "posa_da_spedire"]) {
    c(`${s}: non promette una data`, false, MODELLI_ORIGINALI[s].includes("{quando}"));
  }
  //  Il link sta solo dove una stanza esiste davvero.
  for (const s of stati) {
    if (s === "appuntamento_fissato" || s === "appuntamento_rifissato") continue;
    c(`${s}: niente link a vuoto`, false, MODELLI_ORIGINALI[s].includes("{link}"));
  }

  //  E il primo messaggio in assoluto dice chi scrive: arriva da un numero che
  //  il telefono non conosce, e senza un nome davanti si legge come spam.
  c("da_contattare: chi scrive si presenta", true,
    MODELLI_ORIGINALI.da_contattare.includes("{consulente"));

  //  Composto con dati veri, non resta nessuna graffa: e' l'errore che vale
  //  piu' di dieci messaggi ben scritti, in negativo.
  const valori = { nome: "Marco", cognome: "Bianchi", consulente: "Luca", quando: "domani alle 15", link: "https://x.it/s/marco" };
  for (const s of stati) {
    const fuori = componiMessaggio(MODELLI_ORIGINALI[s], valori);
    c(`${s}: nessuna graffa in uscita`, false, /[{}]/.test(fuori));
    c(`${s}: comincia col nome`, true, fuori.includes("Marco"));
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   LE RIGHE DI «DA FARE OGGI»
   ═════════════════════════════════════════════════════════════════════════ */

/** ── ⚠️ NESSUNO STATO PUÒ RESTARE SENZA GESTO ─────────────────────────────
 *  Uno stato che manca dalla tabella non rompe niente: esce col trattino e col
 *  tono «chiuso», cioè una trattativa viva si legge come archivio e sprofonda
 *  in fondo a tutte le code. È esattamente com'erano spariti «Appuntamento
 *  rifissato» e «Visita in sede disdetta».
 */
/* ═══════════════════════════════════════════════════════════════════════════
   LA PROVA CAPELLI
   ═════════════════════════════════════════════════════════════════════════ */

/** ── ⚠️ UN PROMPT STORTO NON FALLISCE: RESTITUISCE UNA FACCIA DIVERSA ──────
 *  E' il motivo per cui queste prove esistono. Se sparisce una riga di quelle
 *  che dicono «non toccare il viso», niente si rompe e nessuno se ne accorge:
 *  torna semplicemente una persona un po' piu' magra, un po' piu' giovane, con
 *  il naso un po' diverso — e chi si guarda non si riconosce. Qui si controlla
 *  che quelle righe ci siano tutte, per ogni taglio e per ogni colore.
 */
function proveDellaProvaCapelli() {
  const { TAGLI, COLORI, FAMIGLIE, tagliDi, costruisciPrompt, righeCanizie, fotoAccettabile, tagliaDa, coloreDa } = PC;

  //  ⚠️ Il numero non e' scritto a mano: e' quello che esce dalle fotografie
  //   scelte, tolti i doppioni. Si controlla che siano TANTI ABBASTANZA — sotto
  //   i dodici la griglia non copre i casi veri — e che nessuno sia orfano.
  c("almeno dodici tagli", true, TAGLI.length >= 12);
  //  E ognuno deve avere la sua fotografia: una chiave senza file vuol dire un
  //  riquadro col disegno di ripiego in mezzo a venti fotografie.
  for (const t of TAGLI) {
    c(`${t.chiave}: ha la sua fotografia`, true,
      existsSync(join(radice, "public", "tagli", `${t.chiave}.jpg`)));
  }
  //  ⚠️ E OGNUNO STA IN UNA FAMIGLIA. Ventitre' riquadri in fila sono un muro:
  //   chi cerca «qualcosa di mosso» li guarderebbe tutti uno per uno. Un taglio
  //   senza famiglia non finirebbe in nessun gruppo — cioe' sparirebbe dalla
  //   pagina senza che niente si rompa.
  //  ⚠️ Cinque: «Corti» e' uscito quando il catalogo e' passato alle
  //   fotografie vere, perche' fra quelle scelte non c'era nessun rasato. Il
  //   numero si controlla lo stesso — una famiglia sparita per sbaglio si
  //   porterebbe dietro i suoi tagli senza che niente si rompa.
  c("cinque famiglie", 5, FAMIGLIE.length);
  const conosciute = new Set(FAMIGLIE.map((f) => f.chiave));
  for (const t of TAGLI) {
    c(`${t.chiave}: sta in una famiglia vera`, true, conosciute.has(t.famiglia));
  }
  //  ⚠️ NESSUNA FAMIGLIA VUOTA: un titolo con niente sotto e' un pezzo di
  //   pagina che sembra rotto. E' la prova che ha preso «Corti» quando il
  //   catalogo e' passato alle fotografie vere — fra quelle scelte non c'era
  //   nessun rasato, e la famiglia era rimasta li' a intestare il nulla.
  for (const f of FAMIGLIE) {
    c(`famiglia ${f.chiave}: ha almeno due tagli`, true, tagliDi(f.chiave).length >= 2);
  }
  //  I gruppi coprono TUTTO l'elenco: se la somma non torna, qualche taglio
  //  esiste nel codice e non si vede a schermo.
  c("i gruppi coprono tutti i tagli", TAGLI.length,
    FAMIGLIE.reduce((n, f) => n + tagliDi(f.chiave).length, 0));
  /*  ── I COLORI: QUATTRO FAMIGLIE, QUATTRO TONI ─────────────────────────
      ⚠️ Sedici e non sessantatre: l'anello del fornitore serve a ORDINARE il
      capello, e messo davanti a chi vuole solo vedersi con i capelli diventa
      un muro di quadretti quasi uguali. Qui ci sono i colori che la gente si
      riconosce addosso.
      ⚠️ E i capelli bianchi NON sono una tinta: sono una quantita', e la
      decidono i due cursori. Ripeterli come tinte a se' vorrebbe dire
      moltiplicare la griglia per otto e chiedere due volte la stessa cosa. */
  const tinte = COLORI.filter((x) => x.codice);
  c("sedici tinte", 16, tinte.length);
  c("nessun nome interno doppio", 16, new Set(tinte.map((x) => x.codice)).size);
  for (const fam of ["NERO", "CASTANO", "BIONDO", "ROSSO"]) {
    c(`${fam}: quattro toni`, 4, tinte.filter((x) => x.codice.startsWith(fam)).length);
  }
  //  ⚠️ Nessuna tinta porta canizie propria: se ne portasse, il cursore e la
  //   tinta direbbero due cose diverse sullo stesso capello.
  c("nessuna tinta porta grigio di suo", true, tinte.every((x) => (x.grigi ?? 0) === 0));

  const luce = (h) => {
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    return 0.299 * r + 0.587 * g + 0.114 * b;
  };
  const saturazione = (h) => {
    const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    return max === 0 ? 0 : (max - min) / max;
  };
  //  ⚠️ Dentro ogni famiglia i quattro toni DEVONO salire: quattro quadretti
  //   che si somigliano non sono quattro scelte, sono una scelta e tre dubbi.
  for (const fam of ["NERO", "CASTANO", "BIONDO", "ROSSO"]) {
    const q = tinte.filter((x) => x.codice.startsWith(fam));
    for (let i = 1; i < q.length; i += 1) {
      c(`${q[i].codice} e' piu' chiaro di ${q[i - 1].codice}`, true,
        luce(q[i].campione) > luce(q[i - 1].campione));
    }
  }
  //  E le famiglie si distinguono fra loro: il rosso e' piu' caldo del castano
  //  pari chiarezza, il nero e' quasi senza colore.
  const dammi = (cod) => tinte.find((x) => x.codice === cod).campione;
  c("il rosso e' piu' caldo del castano", true, saturazione(dammi("ROSSO3")) > saturazione(dammi("CASTANO3")));
  c("il nero corvino e' quasi senza colore", true, saturazione(dammi("NERO1")) < 0.08);
  c("il biondo platino e' il piu' chiaro di tutti", true,
    tinte.every((x) => x.codice === "BIONDO4" || luce(x.campione) < luce(dammi("BIONDO4"))));

  //  Ogni colore porta il suo codice, che si vede sotto al campione: senza,
  //  «castano chiaro» e «castano dorato» sono due parole indistinguibili.
  for (const col of COLORI) {
    if (col.chiave === "come_barba") continue;
    c(`${col.chiave}: ha un codice colore`, true, /^#[0-9a-f]{6}$/i.test(col.campione));
  }
  //  Chiavi tutte diverse: due tagli con la stessa chiave vorrebbero dire che
  //  sceglierne uno ne applica un altro.
  c("nessuna chiave doppia fra i tagli", TAGLI.length, new Set(TAGLI.map((t) => t.chiave)).size);
  c("nessuna chiave doppia fra i colori", COLORI.length, new Set(COLORI.map((x) => x.chiave)).size);
  //  Ogni taglio si presenta con un nome e con una riga che dice a chi sta
  //  bene: senza, la griglia e' un elenco di parole da indovinare.
  for (const t of TAGLI) {
    c(`${t.chiave}: ha un nome`, true, t.nome.length > 3);
    c(`${t.chiave}: dice a chi sta bene`, true, t.descrizione.length > 20);
    c(`${t.chiave}: ha la descrizione per il modello`, true, t.inglese.length > 30);
  }

  //  ⚠️ IL CUORE: per OGNI taglio e OGNI colore il testo deve difendere il viso.
  for (const t of TAGLI) {
    for (const col of COLORI) {
      const p = costruisciPrompt({ taglio: t.chiave, colore: col.chiave });
      c(`${t.chiave}/${col.chiave}: dice di non toccare il viso`, true,
        /Do NOT change the face/.test(p));
      c(`${t.chiave}/${col.chiave}: difende la barba`, true, /Do NOT change the beard/.test(p));
      c(`${t.chiave}/${col.chiave}: solo i capelli`, true, /Edit ONLY the hair/.test(p));
      c(`${t.chiave}/${col.chiave}: niente abbellimenti`, true,
        /beautify|rejuvenate/.test(p));
      c(`${t.chiave}/${col.chiave}: tiene la luce`, true, /lighting/.test(p));
      c(`${t.chiave}/${col.chiave}: chiede questo taglio`, true, p.includes(t.inglese));
    }
  }

  //  ⚠️ SENZA COLORE SCELTO, IL COLORE LO DICE LA BARBA. E' la richiesta del
  //   committente: un castano acceso su una barba bianca si vede al primo
  //   sguardo, ed e' la cosa che fa dire «finto».
  const senzaColore = costruisciPrompt({ taglio: TAGLI[0].chiave });
  c("nessun colore scelto: si copia dalla barba", true, /beard/.test(senzaColore));
  c("nessun colore scelto: si copia anche il grigio", true, /grey/.test(senzaColore));
  c("nessun colore scelto: non si inventa un colore piu' giovane", true,
    /Do not invent a younger or darker colour/.test(senzaColore));
  //  E il vuoto vale come «come la barba»: e' il predefinito, non un errore.
  c("colore vuoto = come la barba", senzaColore, costruisciPrompt({ taglio: TAGLI[0].chiave, colore: "" }));
  c("colore sconosciuto = come la barba", senzaColore,
    costruisciPrompt({ taglio: TAGLI[0].chiave, colore: "verde-fluo" }));

  //  ⚠️ CALVO E NON CALVO SONO DUE LAVORI DIVERSI: su una testa calva i capelli
  //   vanno fatti nascere dalla pelle, altrimenti torna una parrucca appoggiata
  //   sopra, con un bordo netto che si vede subito.
  const calvo = costruisciPrompt({ taglio: TAGLI[0].chiave, calvo: true });
  const conCapelli = costruisciPrompt({ taglio: TAGLI[0].chiave, calvo: false });
  c("calvo: si fanno nascere i capelli", true, /GROW a full, natural head of hair/.test(calvo));
  c("calvo: nessuna parrucca", true, /No wig/.test(calvo));
  /*  ⚠️ Su una testa CON i capelli non si «sostituisce»: si toglie tutto e si
      rifa'. Il difetto visto era mezza testa grigia e mezza scura — i capelli
      veri sopravvissuti sotto i nuovi, col colore nuovo posato sopra a
      chiazze. «Replace the hairstyle» per un modello vuol dire ritoccare
      quello che c'e', e quello che c'e' vince sempre. */
  c("non calvo: prima si toglie tutto", true, /REMOVE every single hair/.test(conCapelli));
  c("e poi si ricostruisce da zero", true, /build a brand new head of hair/.test(conCapelli));
  c("il colore vecchio non deve sopravvivere", true, /no old colour showing at the roots/.test(conCapelli));
  c("e si ricontrolla in fondo", true, /no leftovers/.test(conCapelli));
  c("i due casi dicono cose diverse", true, calvo !== conCapelli);

  /*  ── LA CANIZIE IN PERCENTUALE ────────────────────────────────────────
      ⚠️ Chiesta dal committente e impossibile da verificare a occhio: una
      percentuale sbagliata non fa fallire niente, fa solo uscire una testa
      che non somiglia alla persona. */
  //  ⚠️ Si parte da un codice PIENO dell'anello (nessuna canizie sua): su
  //   `1B30` la riga «niente grigio» non ci deve essere, perche' quel codice il
  //   grigio ce l'ha per definizione.
  const senza = costruisciPrompt({ taglio: TAGLI[0].chiave, colore: "castano_scuro" });
  const conCanizie = costruisciPrompt({ taglio: TAGLI[0].chiave, colore: "castano_scuro", bianchi: 20, grigi: 30 });
  c("senza percentuali: nessun grigio da nessuna parte", true, /NO grey, NO white/.test(senza));
  c("senza percentuali non si parla di canizie", false, /GREYING/.test(senza));
  c("con le percentuali: il bianco e' scritto in cifre", true, /20% of the strands must be PURE WHITE/.test(conCanizie));
  c("e il grigio pure", true, /30% must be MID GREY/.test(conCanizie));
  c("il resto tiene il colore scelto", true, /remaining 50%/.test(conCanizie));
  //  ⚠️ Le due righe si escludono: chiedere «20% bianchi» e insieme «niente
  //   grigio da nessuna parte» e' un'istruzione che si contraddice, e il
  //   modello ne sceglie una a caso.
  c("chiedendo canizie non si dice piu' «niente grigio»", false, /NO grey, NO white/.test(conCanizie));
  c("si ricontrolla contando in fondo", true, /count the strands/.test(conCanizie));
  //  Una percentuale si scrive anche in ciocche: «il 20%» non si disegna,
  //  «2 ciocche su 10» si'.
  c("la percentuale e' anche in ciocche", true, /strands out of every 10|1 strand in every/.test(conCanizie));

  //  Somme impossibili: il grigio si taglia a quello che resta.
  const troppo = righeCanizie(80, 60).join(" ");
  c("insieme non superano il cento", true, /remaining 0%/.test(troppo));
  c("e il grigio prende solo quello che avanza", true, /20% must be MID GREY/.test(troppo));
  c("zero e zero non dicono niente", 0, righeCanizie(0, 0).length);

  /*  ── IL COLORE PRESO DA UNA FOTOGRAFIA ────────────────────────────────
      ⚠️ DIFETTO VISTO: riferimento grigio, risultato scuro in cima e grigio
      ai lati — un compromesso fra la foto e i capelli veri. Nasceva da un
      buco preciso: con il colore da fotografia il controllo finale non
      nominava MAI il colore, quindi l'ultima parola non ce l'aveva nessuno. */
  const colorePresoDaFoto = costruisciPrompt({ taglio: TAGLI[0].chiave, colore: "da_foto" });
  c("si guarda il riferimento, e solo il colore", true, /take it from the colour reference image/.test(colorePresoDaFoto));
  c("il grigio del riferimento va rispettato", true, /grey, silver or white to the same degree/.test(colorePresoDaFoto));
  c("vince sui capelli che la persona ha", true, /OVERRIDES every colour cue/.test(colorePresoDaFoto));
  c("e il controllo finale nomina il colore", true, /hold your result next to the colour reference/.test(colorePresoDaFoto));
  //  ⚠️ La riga che descrive il difetto per nome: senza, «la cima scura e i
  //   lati grigi» resta una cosa che il modello non sa di dover evitare.
  c("dice che cima scura e lati grigi e' sbagliato", true, /dark on top and grey at the sides is WRONG/.test(colorePresoDaFoto));
  c("valori assurdi non rompono", 0, righeCanizie(-5, NaN).length);

  /*  ── ⚠️ LA CANIZIE SU UNA BASE CHIARA ─────────────────────────────────
      DIFETTO SEGNALATO: biondo con 30% bianchi e 30% grigi, ed e' uscito un
      colore senza senso. Il testo era coerente — il difetto e' fisico: su una
      testa bionda i capelli bianchi quasi non si distinguono, e chiedere
      «grigio medio» su un biondo lascia al modello una sola strada, passarci
      sopra il grigio. Viene fuori una massa sporca. */
  const suScuro = righeCanizie(30, 30, false).join(" ");
  const suChiaro = righeCanizie(30, 30, true).join(" ");
  c("su base scura non si dice niente di speciale", false, /already very light/.test(suScuro));
  c("su base chiara si avverte il modello", true, /already very light/.test(suChiaro));
  c("e gli si vieta di dipingerci sopra il grigio", true, /do NOT paint grey over it/.test(suChiaro));
  c("la canizie diventa un tono piu' freddo", true, /COOLER, ASHIER/.test(suChiaro));
  c("mai una massa grigia o sporca", true, /never as a grey or dirty mass/.test(suChiaro));
  //  Le percentuali restano quelle chieste: cambia COME si rendono, non quante.
  c("le percentuali non cambiano", true, /30% of the strands must be PURE WHITE/.test(suChiaro));

  /*  ── ⚠️ TRE COLORI, NON QUATTRO ───────────────────────────────────────
      DIFETTO VISTO: biondo con una percentuale di bianchi e grigi, e in mezzo
      sono comparse ciocche NERE — il colore vero della persona. «Una parte
      bianca, una parte grigia, il resto del colore scelto» lascia l'idea di
      una testa a piu' toni, e il tono scuro piu' a portata di mano e' quello
      che il modello ha gia' davanti nella fotografia. */
  c("dentro ci sono tre colori e basta", true, /exactly three colours and nothing else/.test(suScuro));
  c("mai il colore vero della persona", true, /never the person's original hair colour/.test(suScuro));
  c("ne' un quarto tono preso dalla foto", true, /never a fourth tone/.test(suScuro));
  const conGrigi = costruisciPrompt({ taglio: TAGLI[0].chiave, colore: "biondo_medio", bianchi: 30, grigi: 30 });
  c("e si ricontrolla in fondo", true, /only three colours/.test(conGrigi));

  /*  ── ⚠️ I LATERALI ────────────────────────────────────────────────────
      Altro difetto visto nella stessa immagine: lati corti e GRIGI — quelli
      veri della persona — sotto una sommità bionda, e sfumati a zero su un
      taglio che sfumato non e'. */
  const { righeLaterali } = PC;
  const lati = righeLaterali("scissor-cut short at the sides", false).join(" ");
  const latiSfum = righeLaterali("faded to skin at the sides", false).join(" ");
  c("i lati sono parte del taglio nuovo", true, /PART OF THE NEW HAIRCUT/.test(lati));
  c("e non sopravvivono quelli veri", true, /must not survive/.test(lati));
  c("su un taglio non sfumato la sfumatura e' vietata", true, /is NOT a fade/.test(lati));
  c("su un taglio sfumato invece si chiede", true, /IS faded\/tapered/.test(latiSfum));
  //  ⚠️ E se la sfumatura la chiede la PERSONA con un ritocco, si fa: e' una
  //   scelta esplicita, non un'iniziativa del modello.
  c("il ritocco «piu' corto ai lati» concede la sfumatura", true,
    /IS faded\/tapered/.test(righeLaterali("scissor-cut short", true).join(" ")));
  c("il controllo finale nomina i lati", true, /· the sides and the back/.test(conGrigi));

  //  ⚠️ E la soglia si applica DAVVERO nel testo finale: un biondo chiaro la
  //   passa, un castano scuro no. Senza questa prova la nota potrebbe non
  //   arrivare mai al modello e nessuno se ne accorgerebbe.
  const biondoConGrigi = costruisciPrompt({ taglio: TAGLI[0].chiave, colore: "biondo_platino", bianchi: 30, grigi: 30 });
  const castanoConGrigi = costruisciPrompt({ taglio: TAGLI[0].chiave, colore: "castano_scuro", bianchi: 30, grigi: 30 });
  c("il platino riceve l'avvertimento", true, /already very light/.test(biondoConGrigi));
  c("il castano scuro no", false, /already very light/.test(castanoConGrigi));

  //  Un taglio che non esiste non produce un testo a meta': non produce niente,
  //  e la porta lo rifiuta prima di spendere una generazione.
  c("taglio inventato: nessun testo", "", costruisciPrompt({ taglio: "cresta-punk" }));
  c("taglio inventato: non si trova", undefined, tagliaDa("cresta-punk"));
  c("colore inventato: non si trova", undefined, coloreDa("verde-fluo"));

  //  ⚠️ IL CAPELLO DEVE REGGERE UNO SGUARDO RAVVICINATO. Lasciato a se', il
  //   modello disegna un casco: massa unica, colore piatto, bordo netto come un
  //   ritaglio. Queste righe sono le cose che il vero ha e il finto non ha, e
  //   spariscono con una riscrittura distratta senza che niente si rompa.
  for (const t of TAGLI) {
    const p = costruisciPrompt({ taglio: t.chiave });
    c(`${t.chiave}: chiede i fili singoli`, true, /individual strands/.test(p));
    c(`${t.chiave}: chiede i capelli ribelli`, true, /flyaway/.test(p));
    c(`${t.chiave}: la cute si intravede`, true, /scalp must be faintly visible/.test(p));
    c(`${t.chiave}: il colore cambia da ciocca a ciocca`, true, /Vary the colour strand by strand/.test(p));
    c(`${t.chiave}: l'attaccatura non e' simmetrica`, true, /ASYMMETRIC/.test(p));
    //  ⚠️ L'attaccatura e' dove si vede il falso: il resto puo' essere
    //   perfetto, ma se la linea davanti e' netta la foto si legge come una
    //   parrucca in un decimo di secondo.
    c(`${t.chiave}: l'attaccatura non e' una linea`, true, /NEVER be a drawn line/.test(p));
    c(`${t.chiave}: la pelle si vede sotto i primi capelli`, true, /skin still readable/.test(p));
    c(`${t.chiave}: le tempie arretrano come a quell'eta'`, true, /temples must recede/.test(p));
    c(`${t.chiave}: stessa grana della foto`, true, /same grain and noise/.test(p));
    c(`${t.chiave}: niente plastica`, true, /No glossy plastic sheen/.test(p));
  }

  //  ⚠️ IL COLORE PRESO DA UNA FOTO: con due immagini davanti la tentazione del
  //   modello e' di copiare anche il taglio e la faccia della seconda. Sarebbe
  //   l'errore peggiore possibile qui — una persona diversa con i capelli
  //   giusti — e queste righe sono l'unica cosa che lo impedisce.
  const daFoto = costruisciPrompt({ taglio: TAGLI[0].chiave, colore: "da_foto" });
  c("da foto: dice che la seconda immagine e' solo un colore", true,
    /COLOUR REFERENCE ONLY/.test(daFoto));
  c("da foto: vieta di copiare il taglio", true, /Do NOT copy image \d's haircut/.test(daFoto));
  c("da foto: vieta di copiare la faccia", true, /influence image 1's face/.test(daFoto));
  //  ⚠️ E ogni immagine allegata e' dichiarata per NUMERO. «La seconda
  //   immagine» voleva dire due cose diverse a seconda di cosa si allegava, e
  //   il ruolo sbagliato applicato alla faccia della persona e' l'errore
  //   peggiore che questa pagina possa fare.
  c("da foto: la persona e' l'immagine 1", true, /IMAGE 1 is THE PERSON/.test(daFoto));
  c("da foto: chiede comunque il taglio scelto", true,
    daFoto.includes(TAGLI[0].inglese));
  c("da foto: il colore e' l'immagine 2", true, /IMAGE 2 is a COLOUR REFERENCE/.test(daFoto));
  //  E non si dice anche un colore fisso: due istruzioni sul colore in un testo
  //  solo vogliono dire che una delle due viene ignorata, a caso.
  c("da foto: nessun colore fisso", false, /Hair colour: /.test(daFoto));
  c("da foto: diverso dal «come la barba»", true,
    daFoto !== costruisciPrompt({ taglio: TAGLI[0].chiave }));

  //  ⚠️ IL DIFETTO SEGNALATO: scelto «castano», e' uscito un castano
  //   BRIZZOLATO. Il modello prendeva il grigio dalla barba perche' gli
  //   diciamo di guardarla — e «castano» e «castano coi grigi», per lui, sono
  //   lo stesso colore. Per chi si guarda no.
  for (const col of COLORI) {
    if (col.chiave === "come_barba") continue;
    const p = costruisciPrompt({ taglio: TAGLI[0].chiave, colore: col.chiave });
    c(`${col.chiave}: il colore scelto vince sulla barba`, true, /OVERRIDES every colour cue/.test(p));
    c(`${col.chiave}: il codice colore arriva al modello`, true, p.includes(col.campione));
    //  ⚠️ E si ripete in fondo: l'ultima riga di un prompt pesa piu' delle
    //   altre, ed e' li' che il colore si perdeva.
    c(`${col.chiave}: ripetuto in fondo`, true, /· the colour: the hair must read/.test(p));
    //  ⚠️ «Voluto» adesso e' un DATO: ogni codice dell'anello dice quanta
    //   canizie porta (`1B30` = 30%). Cercarlo nel nome della chiave, coi
    //   codici veri, non troverebbe piu' niente — e la riga «niente grigio»
    //   finirebbe anche su una tinta che di grigio ne ha l'ottanta per cento.
    const grigioVoluto = (col.grigi ?? 0) > 0;
    c(`${col.chiave}: il grigio ${grigioVoluto ? "e' ammesso" : "e' vietato"}`,
      !grigioVoluto, /Absolutely NO grey/.test(p));
  }
  //  «Come la mia barba» e' l'unico che DEVE guardare la barba: se anche lui
  //  la ignorasse, il predefinito non funzionerebbe piu'.
  const daBarba = costruisciPrompt({ taglio: TAGLI[0].chiave, colore: "come_barba" });
  c("come la barba: nessun divieto di grigio", false, /Absolutely NO grey/.test(daBarba));
  c("come la barba: guarda la barba", true, /beard/.test(daBarba));

  //  ⚠️ IL TAGLIO PORTATO IN FOTOGRAFIA. Stessa trappola del colore: con due
  //   facce davanti il modello prende anche quello che non deve.
  const tagliaFoto = costruisciPrompt({ taglio: "", taglioDaFoto: true, colore: "castano_medio" });
  c("taglio da foto: si copia il taglio per intero", true, /Reproduce its haircut EXACTLY/.test(tagliaFoto));
  //  ⚠️ ELENCATO PUNTO PER PUNTO, e non e' pedanteria: con la sola foto il
  //   taglio usciva somigliante ma non uguale — il ciuffo c'era, i LATI RASATI
  //   no. Nel dubbio il modello conserva quello che trova gia' sulla testa, e
  //   l'unica cosa che glielo impedisce e' nominare ogni pezzo.
  for (const pezzo of ["the length at the SIDES", "the length on TOP", "the DIRECTION",
                       "the PARTING", "the TEXTURE", "the FRINGE"]) {
    c(`taglio da foto: nomina ${pezzo}`, true, tagliaFoto.includes(pezzo));
  }
  //  E la descrizione letta a parole entra nel testo, quando c'e'.
  const conDescrizione = costruisciPrompt({
    taglio: "", taglioDaFoto: true, colore: "castano",
    descrizioneTaglio: "faded to skin at the sides, 6 cm swept back on top",
  });
  c("taglio da foto: la descrizione letta entra nel testo", true,
    conDescrizione.includes("faded to skin at the sides"));
  //  ⚠️ E senza descrizione non resta una frase monca: si torna alla sola
  //   fotografia, che e' come funzionava prima.
  c("taglio da foto: senza descrizione nessuna frase a meta'", false,
    /That haircut is:\s*$/m.test(tagliaFoto));
  c("taglio da foto: non si copia il colore", true, /its hair COLOUR/.test(tagliaFoto));
  c("taglio da foto: il colore scelto vince lo stesso", true, /OVERRIDES every colour cue/.test(tagliaFoto));
  c("taglio da foto: si adatta alla sua testa", true, /THEIR head/.test(tagliaFoto));
  //  ⚠️ LA SFUMATURA È LA COSA CHE SI PERDE SEMPRE: visto otto volte su otto
  //   mettendo le repliche accanto alle foto. Quasi tutte le foto di taglio
  //   sono di tre quarti, dove la sfumatura si vede; il risultato e' frontale,
  //   e nel dubbio il modello tiene i capelli che trova.
  //  ⚠️ «Confronta» ottiene piu' di «copia»: «fallo uguale» si accontenta
  //   della somiglianza, «guarda se e' uguale e correggi» costringe a un
  //   secondo passaggio sulla fotografia. Ed e' l'ultima riga, la piu' pesante.
  c("taglio da foto: si confronta prima di finire", true,
    /compare your result with the haircut reference image/.test(tagliaFoto));
  //  ⚠️ UN SOLO controllo finale: due «controlla alla fine» uno dietro l'altro
  //   vogliono dire che uno dei due diventa penultimo — e quale, a caso.
  c("un solo controllo finale", 1, (tagliaFoto.match(/FINAL CHECK/g) || []).length);
  //  ⚠️ Il controllo finale è l'ULTIMA cosa del testo: è la riga che pesa di
  //   più, e qualunque cosa scritta dopo se la mangia.
  c("il controllo finale chiude il testo", true,
    /· the beard: /.test(tagliaFoto.trim().split("\n").slice(-1)[0]));
  //  E c'e' SEMPRE, anche su un taglio del catalogo col colore della barba —
  //  che e' il caso piu' comune di tutti, ed era quello rimasto scoperto.
  c("il controllo finale c'e' sempre", true,
    /FINAL CHECK/.test(costruisciPrompt({ taglio: TAGLI[0].chiave })));
  c("nel controllo finale c'e' il taglio", true, /· the haircut: compare/.test(tagliaFoto));
  c("nel controllo finale c'e' il colore", true, /· the colour: the hair must read/.test(tagliaFoto));
  //  ⚠️ E c'e' la faccia: e' l'unica cosa che non deve MAI cambiare, ed e'
  //   quella che il modello ritocca per abitudine quando rifa' un'immagine.
  c("nel controllo finale c'e' la faccia", true, /· the face: it must still be exactly/.test(tagliaFoto));
  //  E su un taglio dell'elenco quella riga NON c'e': non c'e' niente da
  //  confrontare, e chiedere un confronto con un'immagine che non esiste e' il
  //  modo di far inventare qualcosa al modello.
  c("taglio dell'elenco: nessun confronto da fare", false,
    /compare your result with the haircut reference/.test(costruisciPrompt({ taglio: TAGLI[0].chiave })));
  c("taglio da foto: la sfumatura va vista di fronte", true,
    /MUST show that same fade clearly IN THIS FRONTAL VIEW/.test(tagliaFoto));
  c("taglio da foto: la persona resta l'immagine 1", true, /IMAGE 1 is THE PERSON/.test(tagliaFoto));
  //  Con taglio E colore da foto sono tre immagini, e i due ruoli non si
  //  scambiano: la 2 e' il taglio, la 3 e' il colore.
  const due = costruisciPrompt({ taglio: "", taglioDaFoto: true, colore: "da_foto" });
  c("due riferimenti: il taglio e' l'immagine 2", true, /IMAGE 2 is a HAIRCUT REFERENCE/.test(due));
  c("due riferimenti: il colore e' l'immagine 3", true, /IMAGE 3 is a COLOUR REFERENCE/.test(due));
  //  E senza foto, un taglio vuoto resta niente: la porta lo rifiuta prima.
  c("taglio vuoto e nessuna foto: niente testo", "", costruisciPrompt({ taglio: "" }));

  //  ⚠️ LA BARBA SI TOCCA SOLO SE LO CHIEDE. Difetto visto: la barba veniva
  //   aggiunta da sola a chi non ce l'aveva — il modello, guardando una foto
  //   di riferimento barbuta, se la porta dietro. Spenta di suo, e detto due
  //   volte: nell'elenco e nel controllo finale, dove pesa.
  {
    const senza = costruisciPrompt({ taglio: TAGLI[0].chiave });
    const con = costruisciPrompt({ taglio: TAGLI[0].chiave, barba: true });
    c("di suo la barba non si tocca", true, /do NOT add one/.test(senza));
    c("e non si copia da chi fa da riferimento", true, /it belongs to that other/.test(senza));
    c("lo dice anche in fondo", true, /· the beard: exactly as in image 1/.test(senza));
    c("chiedendola, la barba si fa", true, /may also be given facial hair/.test(con));
    c("e in fondo cambia riga", true, /· the beard: it must suit the cut/.test(con));
    c("chiedendola, sparisce il divieto", false, /do NOT add one/.test(con));
    //  ⚠️ E non resta MAI in silenzio: senza una delle due righe, con una foto
    //   barbuta davanti, il modello decide da solo — e decide sempre di sì.
    c("una delle due righe c'e' sempre", true,
      /beard/.test(senza) && /facial hair|beard/.test(con));
  }

  //  ── LA FOTO ────────────────────────────────────────────────────────────
  const finta = (n) => `data:image/jpeg;base64,${"A".repeat(n)}`;
  c("foto buona", true, fotoAccettabile(finta(40_000)).ok);
  c("png va bene", true, fotoAccettabile(`data:image/png;base64,${"A".repeat(40_000)}`).ok);
  c("un pdf no", false, fotoAccettabile(`data:application/pdf;base64,${"A".repeat(40_000)}`).ok);
  c("una scritta qualsiasi no", false, fotoAccettabile("la mia foto").ok);
  c("niente non esplode", false, fotoAccettabile(null).ok);
  //  ⚠️ Troppo piccola: sotto gli 8 kB non c'e' una faccia riconoscibile, e la
  //   generazione partirebbe per niente.
  c("miniatura: si dice prima", false, fotoAccettabile(finta(1000)).ok);
  c("troppo pesante: si dice prima", false, fotoAccettabile(finta(9_000_000)).ok);
  //  E il perche' si dice sempre: un «no» senza motivo si legge come un guasto.
  for (const cattiva of ["la mia foto", finta(1000), finta(9_000_000)]) {
    c("ogni rifiuto dice il perche'", true, (fotoAccettabile(cattiva).perche || "").length > 20);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   LA CLASSIFICA DEI TAGLI
   ═════════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════
   I CODICI D'ACCESSO E I PACCHETTI
   ═════════════════════════════════════════════════════════════════════════ */

/** ── LA PAGINA CHE IL CLIENTE DEVE SEGUIRE ────────────────────────────────
 *  ⚠️ Queste prove nascono da un difetto visto in una consulenza vera:
 *   aprendo l'anteprima capelli, il cliente restava fermo su una pagina vuota.
 *   La schermata registrata dal consulente era `/prova-capelli?meet=…&c=…` e
 *   veniva passata TUTTA come percorso — una rotta che non esiste.
 */
/** ── LE MISURE DELLA CAMERINA ─────────────────────────────────────────────
 *  ⚠️ Segnalazione del committente: «quando allargo la schermata della
 *   videocamera si allarga ma poi non si stringe piu'». Le tre misure vengono
 *   tenute dentro gli estremi, e su uno schermo stretto il tetto le schiaccia
 *   una sull'altra: il giro del tocco passava da un valore all'altro senza che
 *   il cerchio cambiasse di un pixel.
 */
/** ── CHI PARLA, SENZA FAR TREMARE LO SCHERMO ──────────────────────────────
 *  ⚠️ Segnalazione del committente: «all'ospite si sposta sopra e sotto il
 *   cerchio della mia camera» e «la camera si spegne e si accende di continuo,
 *   come se si allargasse e si stringesse».
 *   Una causa sola: chi parla veniva deciso a OGNI FOTOGRAMMA e senza
 *   esitazione — il piu' forte dell'istante prendeva la scena e partiva pure
 *   un messaggio sul canale. In una conversazione vera il piu' forte cambia di
 *   continuo, e la camerina del cliente cambiava faccia decine di volte al
 *   secondo.
 */
/*  ── OGNI CONSULENZA LA SUA RIGA ──────────────────────────────────────────
    Segnalazione del committente: «se allo stesso orario due o più consulenti
    fanno Meetly e hanno trasmissione attiva non devono andare a fare
    conflitto». Facevano conflitto perché sessione, pagina seguita dal cliente
    e preventivo rispecchiato stavano in tre caselle condivise da tutti.
    Qui si prova il pezzo che separa le caselle — e le due proprietà che
    contano: consulenze diverse non si toccano mai, e lo stesso codice trova
    sempre la sua roba. */
/*  ── IL PREVENTIVO LASCIATO A METÀ ────────────────────────────────────────
    Segnalazione del committente: «quando faccio recupera preventivo, se
    applico il codice sconto si elimina appena lo recupero e devo
    reinserirlo». La bozza salvava le scelte ma non il codice. */
/*  ── LO ZOOM SUI MEDIA ────────────────────────────────────────────────────
    Segnalazione del committente: «sui media quando faccio zoom non torna
    indietro, si bugga e continua a zoomare». */
/*  ── QUANTA BANDA PRENDERSI ───────────────────────────────────────────────
    Segnalazione del committente: «se trasmettono più persone insieme va lento
    a scatti, sia a me che all'altro che trasmette». */
/*  ── DI CHI È LA STANZA DI UNA CONSULENZA ─────────────────────────────────
    Segnalazione del committente: «quando due consulenti diversi trasmettono
    contemporaneamente allo stesso lead, al secondo compare "il consulente sta
    trasmettendo un'altra consulenza"». */
/*  ── GLI ORARI GIÀ PRENOTATI ──────────────────────────────────────────────
    Richiesta del committente: «quando uno slot è prenotato deve essere
    contrassegnato in rosso e restare selezionabile; e il rosso deve tenere
    conto della DURATA — una consulenza dalle 15:00 alle 16:30 tiene occupati
    anche gli slot in mezzo, e solo dopo le 16:30 si torna liberi». */
/*  ── «NASCONDI GLI SCONTI DEL LISTINO» ────────────────────────────────────
    Segnalazione del committente: «metto nascondi e in automatico deve mettere
    i prezzi del prezzo intero, ignorando quelli scontati». */
function proveDelListino() {
  const { buildMenu } = QMN;
  gruppo("NASCONDI GLI SCONTI DEL LISTINO");

  const voci = (m) => [
    ...m.base,
    ...m.sections.flatMap((s) => s.items),
    ...(m.simulation ? [m.simulation] : []),
  ];
  //  Una voce che nel catalogo ha davvero un listino più alto del prezzo: è
  //  su quelle che l'interruttore deve mordere.
  const scontata = (m) => voci(m).find((v) => v.id === "base-hyper");

  const acceso = buildMenu({});
  const spento = buildMenu({ upsellSconti: false });

  //  Con gli sconti accesi non cambia niente rispetto a sempre.
  c("a sconti accesi il barrato c'è", true, typeof scontata(acceso).wasPrice === "number");
  c("e il prezzo è quello scontato", true, scontata(acceso).price < scontata(acceso).wasPrice);

  /*  ── ⚠️ IL CUORE DELLA CORREZIONE ──────────────────────────────────────
      Spegnendo, il prezzo diventa il LISTINO. Prima restava quello scontato e
      spariva solo il barrato: chi spegneva credeva di aver tolto lo sconto e
      continuava a regalarlo, senza più nemmeno la riga che glielo ricordava. */
  c("a sconti spenti si vende al listino", scontata(acceso).wasPrice, scontata(spento).price);
  c("e il barrato sparisce", undefined, scontata(spento).wasPrice);

  //  ⚠️ NESSUNA voce resta scontata, in nessuna sezione: se ne bastasse una
  //   sfuggita, il totale sarebbe sbagliato e nessuno lo vedrebbe.
  c("nessun barrato rimasto in giro", 0, voci(spento).filter((v) => typeof v.wasPrice === "number").length);
  const scesi = voci(spento).filter((v) => {
    const prima = voci(acceso).find((x) => x.id === v.id);
    return prima && v.price < prima.price;
  });
  c("e nessun prezzo è sceso", 0, scesi.length);

  //  Le voci senza listino non si toccano: non avevano sconto da togliere.
  const senzaListino = voci(acceso).filter((v) => typeof v.wasPrice !== "number");
  c("le voci senza listino restano al loro prezzo", true, senzaListino.every((v) => {
    const dopo = voci(spento).find((x) => x.id === v.id);
    return dopo && dopo.price === v.price;
  }));

  //  ⚠️ Assente = acceso: le configurazioni già in giro non hanno il campo e
  //   devono comportarsi come prima.
  c("il campo assente vale acceso", scontata(acceso).price, scontata(buildMenu({ upsellSconti: undefined })).price);

  //  Il prezzo scritto a mano nel pannello vince comunque: è il prezzo di
  //  oggi, non un ribasso da togliere.
  const aMano = buildMenu({ upsellSconti: false, prices: { "base-hyper": 999 }, was: { "base-hyper": 0 } });
  c("un prezzo scritto a mano resta quello", 999, scontata(aMano).price);

  /*  ── SPEGNERE UNA SEZIONE INTERA ───────────────────────────────────────
      Richiesta del committente: «fai che posso disattivare le opzioni del
      preventivo dalle impostazioni presentazione». Le singole voci si
      nascondevano già; una sezione intera no — per spegnerla bisognava
      nasconderne le voci una alla volta. */
  const { PARTI_PREVENTIVO, chiaveSezione, chiaveParte, parteAccesa } = QMN;
  const tutte = buildMenu({});
  const unaSezione = tutte.sections[0];
  const senzaUna = buildMenu({ spente: { [chiaveSezione(unaSezione.num)]: true } });
  c("la sezione spenta non c'è più", true, !senzaUna.sections.some((s) => s.num === unaSezione.num));
  c("e le altre restano tutte", tutte.sections.length - 1, senzaUna.sections.length);
  //  ⚠️ E le sue voci non entrano in nessun conto: se restassero nel menu, il
  //   totale conterebbe roba che il cliente non ha mai visto.
  const vociDi = (m) => m.sections.flatMap((s) => s.items).map((v) => v.id);
  c("nessuna voce della sezione spenta resta in giro", true,
    unaSezione.items.every((i) => !vociDi(senzaUna).includes(i.id)));

  //  Assente = acceso: i listini salvati prima non hanno questo campo.
  c("senza l'elenco è tutto acceso", tutte.sections.length, buildMenu({}).sections.length);
  c("un elenco vuoto non spegne niente", tutte.sections.length, buildMenu({ spente: {} }).sections.length);
  //  «false» non è «spento»: solo ciò che è scritto true sparisce.
  c("scritto false resta acceso", tutte.sections.length,
    buildMenu({ spente: { [chiaveSezione(unaSezione.num)]: false } }).sections.length);

  //  Le parti fisse della pagina: stessa domanda, stessa risposta.
  //  Cinque da quando anche l'assistenza dopo la consegna si può spegnere
  //  (vedi proveDellAccontoEGaranzia): erano quattro.
  c("le parti fisse sono cinque", 5, PARTI_PREVENTIVO.length);
  for (const parte of PARTI_PREVENTIVO) {
    c(`«${parte.nome}» di suo è accesa`, true, parteAccesa({}, chiaveParte(parte.id)));
    c(`«${parte.nome}» si può spegnere`, false,
      parteAccesa({ spente: { [chiaveParte(parte.id)]: true } }, chiaveParte(parte.id)));
  }
  //  ⚠️ Spegnere una parte non spegne una sezione con lo stesso nome: le due
  //   chiavi vivono nello stesso elenco e devono restare distinte.
  c("parti e sezioni non si confondono", true,
    parteAccesa({ spente: { [chiaveParte("dove")]: true } }, chiaveSezione("install")));
}

/*  ═══════════════════════════════════════════════════════════════════════
    COSA È GIÀ SPUNTATO, E QUANTO COSTA LA STRADA "FINO A QUI"
    ───────────────────────────────────────────────────────────────────────
    Due richieste del committente, che sono la stessa cosa vista dai due lati:
     · «fai che il prezzo di ogni servizio all'inizio del preventivo scriva il
       prezzo totale fino a quel momento, in base ai prodotti aggiuntivi già
       preselezionati»;
     · «fai che dalle impostazioni listino posso selezionare anche quali
       opzioni sono già preselezionate».
    Il rischio da coprire con le prove non è la grafica: è che la spunta e il
    prezzo non siano d'accordo. Una voce spuntata che il cliente non vede — o
    due spunte nello stesso gruppo a scelta unica — vogliono dire un totale che
    non si spiega con nessuna riga a schermo.
    ═══════════════════════════════════════════════════════════════════════ */
/*  ═══════════════════════════════════════════════════════════════════════
    I LEAD DEI MODULI META
    ───────────────────────────────────────────────────────────────────────
    Richiesta del committente: «come posso integrare i lead del form di Meta
    direttamente su questo CRM?» → recupero periodico.
    Quello che si rompe qui non fa rumore: un lead arriva, viene scritto, e
    nessuno lo chiama. Le prove guardano le tre cose che lo rendono muto —
    il telefono non trovato perché la domanda si chiamava in italiano, il
    contatto già assegnato che sparisce da «Nuovi contatti», e il doppione
    che fa chiamare due volte la stessa persona.
    ═══════════════════════════════════════════════════════════════════════ */
/*  ═══════════════════════════════════════════════════════════════════════
    OGNI CONSULENTE HA IL SUO LISTINO
    ───────────────────────────────────────────────────────────────────────
    Richiesta del committente: «fai che tutte le modifiche del listino che
    faccio io come consulente si salvano al consulente, e gli altri consulenti
    hanno le loro modifiche — codici sconto, listino, eccetera».
    Qui si prova la regola, non il database: quale riga si legge, quale si
    scrive, e chi vede quale codice sconto. Il guasto da tenere fuori è
    silenzioso — un consulente che crede di cambiare i suoi prezzi e li cambia
    a tutti, o un cliente che si applica il codice di un'altra trattativa.
    ═══════════════════════════════════════════════════════════════════════ */
/*  ═══════════════════════════════════════════════════════════════════════
    LA MODIFICA SI COMPONE SU QUELLO CHE C'È ADESSO
    ───────────────────────────────────────────────────────────────────────
    `updateLead` rilegge la riga dall'archivio prima di salvare, quindi la
    scheda intera non riporta più indietro il lavoro di un collega. Restava la
    variante stretta: chi scrive un SOTTO-oggetto lo componeva sulla copia in
    memoria, e la rilettura non serviva a niente perché l'oggetto vecchio era
    già dentro il pezzo da scrivere — mettere una posa in cima cancellava il
    tecnico scritto da un altro un minuto prima. Nessun errore, nessuna riga
    in console: il solito «non si salva».
    ═══════════════════════════════════════════════════════════════════════ */
function proveDellaModifica() {
  const { risolviModifica, fondiSotto, cambiaSotto } = PSC;
  gruppo("LA MODIFICA SI COMPONE SUL FRESCO");

  //  Com'è la scheda in archivio ADESSO: un collega ha appena scritto il
  //  tecnico e il giorno dentro `installazione`.
  const fresca = {
    stato: "venduto",
    installazione: { dataInstallazione: "2026-10-02", tecnico: "Marco", priorita: false },
    payment: { prezzoFinaleVendita: 1000, accontoPagato: 300 },
  };
  //  Com'era quando il browser l'ha letta l'ultima volta: senza tecnico e
  //  senza giorno. È la copia vecchia da cui nascevano i guasti.
  const vecchia = { stato: "venduto", installazione: { priorita: false }, payment: {} };

  //  Un oggetto passa com'è: le modifiche semplici non cambiano comportamento.
  c("un oggetto resta quello che è", "richiamare", risolviModifica({ stato: "richiamare" }, fresca).stato);

  /*  ── ⚠️ IL CUORE ─────────────────────────────────────────────────────
      La stessa modifica, composta sulla copia vecchia e sulla riga vera. */
  const allaVecchia = { installazione: { ...vecchia.installazione, priorita: true } };
  c("composta sulla copia vecchia, il tecnico sparisce", undefined, allaVecchia.installazione.tecnico);
  c("e anche il giorno della posa", undefined, allaVecchia.installazione.dataInstallazione);

  const giusta = risolviModifica(fondiSotto("installazione", { priorita: true }), fresca);
  c("composta sul fresco, la priorità c'è", true, giusta.installazione.priorita);
  c("e il tecnico resta", "Marco", giusta.installazione.tecnico);
  c("e il giorno della posa pure", "2026-10-02", giusta.installazione.dataInstallazione);

  //  Le altre parti della scheda non si toccano: si scrive UN campo.
  c("gli altri campi non entrano nella modifica", undefined, giusta.payment);
  c("e nemmeno lo stato", undefined, giusta.stato);

  /*  ── SI RICOMPONE A OGNI TENTATIVO ───────────────────────────────────
      Se la scheda cambia mentre la salviamo, `updateLead` rilegge e richiama
      la funzione sul valore nuovo: è tutto il senso di passarla invece di
      passare un oggetto. Qui si simula chiamandola due volte con due schede
      diverse. */
  const modifica = fondiSotto("installazione", { priorita: true });
  const primo = risolviModifica(modifica, vecchia);
  const secondo = risolviModifica(modifica, fresca);
  c("il primo giro vede la scheda di prima", undefined, primo.installazione.tecnico);
  c("il secondo vede quella nuova", "Marco", secondo.installazione.tecnico);

  //  ⚠️ La fusione è SUPERFICIALE di proposito: andando più a fondo, togliere
  //   un campo diventerebbe impossibile e «togli la data desiderata» non
  //   funzionerebbe più.
  const sovrascritto = risolviModifica(
    fondiSotto("installazione", { tecnico: "Luca" }),
    fresca,
  );
  c("un campo passato per esteso sovrascrive", "Luca", sovrascritto.installazione.tecnico);
  c("e gli altri restano", "2026-10-02", sovrascritto.installazione.dataInstallazione);

  //  Un sotto-oggetto che non c'è ancora non fa esplodere niente: la scheda di
  //  un lead nuovo non ha `installazione`.
  const daZero = risolviModifica(fondiSotto("installazione", { priorita: true }), { stato: "nuovo" });
  c("su una scheda senza quel pezzo si parte da vuoto", true, daZero.installazione.priorita);

  //  `cambiaSotto` serve quando il pezzo dipende da com'è adesso: una spunta
  //  in un elenco, una riga aggiunta.
  const conta = risolviModifica(
    cambiaSotto("payment", (p) => ({ accontoPagato: (p?.accontoPagato ?? 0) + 200 })),
    fresca,
  );
  c("il pezzo può dipendere da com'è adesso", 500, conta.payment.accontoPagato);
  c("e il resto del pezzo resta", 1000, conta.payment.prezzoFinaleVendita);
}

function proveDellAmbito() {
  const { chiaveAmbito, idAmbito, codiceSuo, codiciVisibili, BASE_LISTINO, BASE_QUANTITA,
          BASE_SESSIONE_DI } = AMB;
  gruppo("IL LISTINO DI OGNI CONSULENTE");

  const ANNA = "0d3f9a10-1111-2222-3333-444455556666";
  const LUCA = "9c1e2b70-aaaa-bbbb-cccc-ddddeeeeffff";

  //  ── LA RIGA GIUSTA ──────────────────────────────────────────────────
  c("senza consulente resta la riga di casa", BASE_LISTINO, chiaveAmbito(BASE_LISTINO, ""));
  c("e anche con un id vuoto o nullo", BASE_LISTINO, chiaveAmbito(BASE_LISTINO, null));
  c("col consulente la riga è sua", `${BASE_LISTINO}:${ANNA}`, chiaveAmbito(BASE_LISTINO, ANNA));
  c("due consulenti, due righe", false, chiaveAmbito(BASE_LISTINO, ANNA) === chiaveAmbito(BASE_LISTINO, LUCA));
  //  ⚠️ Righe diverse per cose diverse dello stesso consulente: il listino non
  //   deve finire dentro gli sconti quantità.
  c("listino e sconti quantità non si mescolano", false,
    chiaveAmbito(BASE_LISTINO, ANNA) === chiaveAmbito(BASE_QUANTITA, ANNA));

  /*  ── ⚠️ L'ID FINISCE IN UNA CHIAVE DI DATABASE ────────────────────────
      Arriva da un cookie o da un indirizzo, cioè da fuori. Se passasse com'è,
      basterebbe un id costruito a mano per scrivere in una riga altrui. */
  c("i due punti non passano", "quote_pricing:abc", chiaveAmbito(BASE_LISTINO, "ab:c"));
  c("gli spazi non passano", "quote_pricing:annarossi", chiaveAmbito(BASE_LISTINO, " Anna Rossi "));
  c("le maiuscole si appiattiscono", idAmbito(ANNA.toUpperCase()), idAmbito(ANNA));
  c("un id di sole virgole non fa una riga", BASE_LISTINO, chiaveAmbito(BASE_LISTINO, ",,,"));

  /*  ── ⚠️ DI CHI È UNA CONSULENZA, ANCHE QUANDO NON È PIÙ VIVA ──────────
      Segnalazione del committente: «quando apro il preventivo a me mostra il
      prezzo nuovo che ho impostato e al cliente ne mostra un altro».
      Il listino che il cliente legge si sceglie traducendo il codice della sua
      consulenza in «chi è il suo consulente». Quella traduzione leggeva solo la
      riga della sessione VIVA, che però non esiste quando si manda il solo link
      del preventivo e viene azzerata alla chiusura della chiamata: in tutti e
      due i casi il cliente ricadeva sul listino di casa mentre il consulente
      leggeva il proprio. Adesso la traduzione ha una riga sua, che non muore
      con la chiamata. */
  c("la traduzione codice → consulente ha una riga sua", "sessione_di", BASE_SESSIONE_DI);
  c("una per consulenza", `${BASE_SESSIONE_DI}:abc-defg-hij`,
    chiaveAmbito(BASE_SESSIONE_DI, "ABC-DEFG-HIJ"));
  //  ⚠️ Non si mescola con il listino: sono due cose diverse dello stesso
  //   codice, e una chiave sola vorrebbe dire un listino letto come un id.
  c("e non si confonde col listino", false,
    chiaveAmbito(BASE_SESSIONE_DI, "abc") === chiaveAmbito(BASE_LISTINO, "abc"));
  //  Anche qui il codice arriva da fuori (sta nell'indirizzo del cliente).
  c("il codice viene ripulito come tutto il resto", `${BASE_SESSIONE_DI}:abc`,
    chiaveAmbito(BASE_SESSIONE_DI, "a b:c"));

  /*  ── I CODICI SCONTO ─────────────────────────────────────────────────
      Un codice senza proprietario è di casa, e lo vedono tutti: è quello che
      sono TUTTI i codici esistenti oggi: nessuno deve sparire il giorno della
      pubblicazione. */
  c("un codice senza proprietario è di tutti", true, codiceSuo(undefined, ANNA));
  c("anche per chi non è nessuno", true, codiceSuo("", ""));
  c("il mio codice è mio", true, codiceSuo(ANNA, ANNA));
  c("il codice di un altro non è mio", false, codiceSuo(LUCA, ANNA));
  //  ⚠️ Chi entra con le chiavi di casa NON eredita i codici dei consulenti:
  //   sono trattative loro, e un codice creato per un cliente di Luca non deve
  //   comparire in una consulenza di nessun altro.
  c("le chiavi di casa non vedono i codici altrui", false, codiceSuo(LUCA, ""));

  const codici = [
    { code: "CASA10" },
    { code: "ANNA20" },
    { code: "LUCA30" },
  ];
  const proprietari = { anna20: ANNA, luca30: LUCA };
  const diAnna = codiciVisibili(codici, proprietari, ANNA).map((x) => x.code);
  c("Anna vede il suo e quello di casa", "CASA10,ANNA20", diAnna.join(","));
  c("e non vede quello di Luca", false, diAnna.includes("LUCA30"));
  c("Luca vede il suo e quello di casa", "CASA10,LUCA30",
    codiciVisibili(codici, proprietari, LUCA).map((x) => x.code).join(","));
  c("senza proprietari si vede tutto", 3, codiciVisibili(codici, {}, ANNA).length);
  //  I codici si scrivono a mano: «ANNA20» e «anna20» sono lo stesso codice.
  c("il confronto non guarda le maiuscole", "CASA10,ANNA20",
    codiciVisibili(codici, { ANNA20: ANNA, LUCA30: LUCA }, ANNA).map((x) => x.code).join(","));
}

/*  ═══════════════════════════════════════════════════════════════════════
    QUANTO PAGA DOPO
    ───────────────────────────────────────────────────────────────────────
    Richiesta del committente: «fai che posso modificare anche quanto paga
    dopo 12 mesi da listino». Era l'unica cifra del preventivo scritta nel
    codice. Il pezzo delicato è la RIGA che la spiega: se resta scritta a mano
    promette una cosa mentre il prezzo sopra ne dice un'altra.
    ═══════════════════════════════════════════════════════════════════════ */
function proveDellaManutenzione() {
  const { manutenzioneDi, MAINTENANCE, buildMenu } = QMN;
  gruppo("QUANTO PAGA DOPO");

  const casa = manutenzioneDi({});
  c("senza impostazioni vale quella di casa", MAINTENANCE.price, casa.price);
  c("e i mesi pure", MAINTENANCE.everyMonths, casa.everyMonths);
  c("un campo vuoto non azzera il prezzo", MAINTENANCE.price, manutenzioneDi({ manutenzione: {} }).price);

  const mia = manutenzioneDi({ manutenzione: { prezzo: 600, mesi: 12 } });
  c("il prezzo si cambia", 600, mia.price);
  c("e i mesi anche", 12, mia.everyMonths);
  //  ⚠️ La frase in fondo si RICOSTRUISCE dai due numeri: scritta a mano
  //   resterebbe indietro al primo ritocco, e il cliente leggerebbe 450 € sotto
  //   un prezzo di 600.
  c("la frase porta il prezzo nuovo", true, mia.foot.includes("600"));
  c("e i mesi nuovi", true, mia.foot.includes("12 mesi"));
  c("e non quelli vecchi", false, mia.foot.includes("450"));

  //  Solo uno dei due: l'altro resta quello di casa, non si azzera.
  c("solo il prezzo", MAINTENANCE.everyMonths, manutenzioneDi({ manutenzione: { prezzo: 600 } }).everyMonths);
  c("solo i mesi", MAINTENANCE.price, manutenzioneDi({ manutenzione: { mesi: 24 } }).price);
  //  Valori impossibili: si torna a casa invece di scrivere assurdità nel
  //  preventivo di un cliente.
  c("zero mesi non esiste", MAINTENANCE.everyMonths, manutenzioneDi({ manutenzione: { mesi: 0 } }).everyMonths);
  c("mesi negativi nemmeno", MAINTENANCE.everyMonths, manutenzioneDi({ manutenzione: { mesi: -3 } }).everyMonths);
  c("un prezzo non numerico non passa", MAINTENANCE.price,
    manutenzioneDi({ manutenzione: { prezzo: Number.NaN } }).price);
  //  Zero invece è una scelta legittima: l'assistenza compresa. E allora la
  //  frase non deve dire «0 € per una rigenerazione».
  const gratis = manutenzioneDi({ manutenzione: { prezzo: 0 } });
  c("zero è una scelta, non un errore", 0, gratis.price);
  c("e la frase cambia di conseguenza", false, gratis.foot.includes("0 € per"));

  //  Chi ha il menu ha già la manutenzione giusta: andarsela a prendere
  //  altrove è il modo in cui due schermate dicono due cifre diverse.
  c("il menu se la porta dietro", 600, buildMenu({ manutenzione: { prezzo: 600 } }).manutenzione.price);
  c("e senza impostazioni resta quella di casa", MAINTENANCE.price, buildMenu({}).manutenzione.price);
}

function proveDeiLeadDiMeta() {
  const { schedaDaLead, soloNuovi, idEsterno, spezzaNome, scegli, rispostePerNome } = MTL;
  gruppo("I LEAD DEI MODULI META");

  const lead = (campi, extra = {}) => ({
    id: "990011",
    created_time: "2026-09-24T08:30:00+0000",
    campaign_name: "Infoltimento — Settembre",
    ad_id: "111", adset_id: "222", campaign_id: "333", ad_name: "Video testimonianza",
    field_data: Object.entries(campi).map(([name, v]) => ({ name, values: [v] })),
    ...extra,
  });

  //  ── IL MODULO DI SERIE DI META ──────────────────────────────────────
  const serie = schedaDaLead(lead({
    full_name: "Mario Rossi", email: "mario@esempio.it", phone_number: "+39 333 1234567", city: "Bari",
  }));
  c("nome e cognome si separano", "Mario|Rossi", `${serie.nome}|${serie.cognome}`);
  c("l'email arriva", "mario@esempio.it", serie.email);
  c("il telefono arriva", "+39 333 1234567", serie.telefono);
  c("la città arriva", "Bari", serie.citta);

  /*  ── ⚠️ IL MODULO SCRITTO IN ITALIANO ─────────────────────────────────
      Le domande di serie hanno nomi fissi, quelle scritte a mano arrivano
      com'erano scritte. Cercare solo il nome esatto vuol dire un lead senza
      numero: cioè un lead che non si può chiamare. */
  const italiano = schedaDaLead(lead({
    "Nome e cognome": "Luca De Santis",
    "Qual è la tua email?": "luca@esempio.it",
    "Numero di telefono (cellulare)": "3401112223",
    "In quale città vivi?": "Torino",
  }));
  c("il nome scritto in italiano si trova", "Luca", italiano.nome);
  c("e il cognome pure", "De Santis", italiano.cognome);
  c("l'email con la domanda per esteso si trova", "luca@esempio.it", italiano.email);
  c("il telefono con la domanda per esteso si trova", "3401112223", italiano.telefono);
  c("e la città", "Torino", italiano.citta);

  //  Il nome esatto vince su quello che somiglia: due campi con dentro la
  //  stessa parola, e quello di serie deve restare il primo.
  const due = rispostePerNome(lead({ "email": "giusta@esempio.it", "email_aziendale": "sbagliata@esempio.it" }));
  c("il nome esatto batte la somiglianza", "giusta@esempio.it", scegli(due, "email"));

  //  ── I CAMPI CHE A DATABASE NON POSSONO ESSERE VUOTI ─────────────────
  //   Un modulo può legittimamente non chiedere la città: se qui uscisse
  //   vuoto o nullo, la scrittura fallirebbe e il lead si perderebbe.
  const magro = schedaDaLead(lead({ email: "solo@esempio.it" }));
  for (const campo of ["nome", "cognome", "email", "telefono", "citta", "status"]) {
    c(`«${campo}» non è mai vuoto`, true, typeof magro[campo] === "string" && magro[campo].length > 0);
  }
  c("chi manca è un trattino", "—", magro.telefono);
  c("e le voci di dolore sono un elenco vuoto, non nulla", true, Array.isArray(magro.pain_points));

  /*  ── ⚠️ LA RIGA NON NASCE GIÀ ASSEGNATA ──────────────────────────────
      «Nuovi contatti» mostra SOLO le righe senza consulente: è la definizione
      della pagina. Scrivendoci dentro il proprietario dell'account — come si
      faceva — il lead entrava nel database e non compariva da nessuna parte.
      Arrivato, invisibile, mai richiamato. */
  c("il lead nuovo non è di nessuno", undefined, serie.assigned_to_user_id);
  c("e nemmeno di un consulente", undefined, serie.assigned_consultant_id);
  c("lo stato è «nuovo»", "nuovo", serie.status);

  //  ── DA DOVE ARRIVA ─────────────────────────────────────────────────
  c("la fonte è Meta", "meta|paid", `${serie.utm_source}|${serie.utm_medium}`);
  c("la campagna resta attaccata", "Infoltimento — Settembre", serie.utm_campaign);
  c("l'inserzione resta attaccata", "111|222|333", `${serie.ad_id}|${serie.adset_id}|${serie.campaign_id}`);
  c("il primo contatto è datato quando l'ha compilato", Date.parse("2026-09-24T08:30:00+0000"), serie.touch_history[0].ts);
  //  L'indizio del webhook riempie i buchi, ma non sovrascrive ciò che ha detto
  //  la Graph API: quello è il dato buono.
  const conIndizio = schedaDaLead({ id: "7", field_data: [] }, { ad_id: "A", adgroup_id: "B", campaign_id: "C" });
  c("senza dati, l'indizio del webhook riempie", "A|B|C",
    `${conIndizio.ad_id}|${conIndizio.adset_id}|${conIndizio.campaign_id}`);
  c("con i dati, l'indizio non sovrascrive", "111",
    schedaDaLead(lead({}), { ad_id: "A" }).ad_id);

  /*  ── ⚠️ LO STESSO LEAD DA DUE PORTE ───────────────────────────────────
      Il webhook lo prende appena arriva, il recupero periodico ripassa
      comunque gli ultimi giorni. Senza la chiave esterna lo stesso cliente
      finisce in elenco due volte, e qualcuno lo chiama due volte. */
  c("la chiave esterna è il numero di Meta", "meta_lead:990011", serie.external_id);
  const trovati = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "2" }];
  const nuovi = soloNuovi(trovati, [idEsterno("1")]);
  c("quello già dentro non si riscrive", false, nuovi.some((l) => l.id === "1"));
  c("il doppione nella stessa risposta conta una volta", 1, nuovi.filter((l) => l.id === "2").length);
  c("gli altri passano", 2, nuovi.length);
  c("senza niente dentro passano tutti", 3, soloNuovi(trovati, []).length);

  //  Il nome intero con una parola sola non deve inventare un cognome.
  c("un nome solo non inventa il cognome", "Mario|—",
    `${spezzaNome("Mario").nome}|${spezzaNome("Mario").cognome}`);
  c("gli spazi in più non contano", "Anna|Maria Bianchi",
    `${spezzaNome("  Anna   Maria Bianchi ").nome}|${spezzaNome("  Anna   Maria Bianchi ").cognome}`);
}

function provePreselezione() {
  const { preselezione, prezzoDiPartenza, vociPreselezionate, buildMenu, DEFAULT_SELECTED,
          chiaveSezione, TRANSPLANT_ID } = QMN;
  gruppo("LE OPZIONI GIA' SPUNTATE");

  const insieme = (a) => [...a].sort().join(",");

  //  ── ASSENTE = COME SEMPRE ────────────────────────────────────────────
  //   È la prova che protegge tutti i listini salvati prima di oggi: senza il
  //   campo, il preventivo si deve aprire esattamente come si apriva ieri.
  c("senza impostazioni vale la combinazione di serie",
    insieme(DEFAULT_SELECTED), insieme(preselezione({})));
  c("un elenco vuoto non cambia niente",
    insieme(DEFAULT_SELECTED), insieme(preselezione({ preselezionate: {} })));

  //  ── TOGLIERE UNA SPUNTA DI SERIE ─────────────────────────────────────
  //   ⚠️ Serve il `false` scritto per esteso: se il server lo scartasse (come
  //    fa con `spente`), questa spunta tornerebbe su al salvataggio dopo.
  const senzaColore = preselezione({ preselezionate: { "signature-colour-match": false } });
  c("una spunta di serie si può togliere", false, senzaColore.includes("signature-colour-match"));
  c("e le altre restano", DEFAULT_SELECTED.length - 1, senzaColore.length);

  //  ── AGGIUNGERNE UNA ─────────────────────────────────────────────────
  const conBianchi = preselezione({ preselezionate: { "grey-hair-integration": true } });
  c("una voce si può preselezionare", true, conBianchi.includes("grey-hair-integration"));
  //  ⚠️ «Con i tuoi bianchi» sta nel gruppo del colore, che è a scelta unica:
  //   la spunta di serie dello stesso gruppo deve farsi da parte, o il
  //   preventivo si apre con due pallini accesi e due prezzi nel totale.
  c("nel gruppo a scelta unica ne resta una sola",
    false, conBianchi.includes("signature-colour-match"));

  //  E vince quella scelta a mano, non quella di serie: è la più recente
  //  delle due volontà.
  const conRinforzato = preselezione({ preselezionate: { "base-hyper": true } });
  c("la scelta a mano vince su quella di serie", true, conRinforzato.includes("base-hyper"));
  c("e la voce di serie del gruppo esce", false, conRinforzato.includes("base-light"));

  //  ── QUELLO CHE IL CLIENTE NON VEDE NON RESTA SPUNTATO ───────────────
  const vocNascosta = preselezione({
    preselezionate: { "grey-hair-integration": true },
    disabled: { "grey-hair-integration": true },
  });
  c("una voce nascosta non resta spuntata", false, vocNascosta.includes("grey-hair-integration"));
  const sezSpenta = preselezione({ spente: { [chiaveSezione("02")]: true } });
  c("una sezione spenta non lascia spunte in giro",
    false, sezSpenta.includes("signature-colour-match"));
  c("e le spunte delle altre sezioni restano",
    true, sezSpenta.includes("shape-liscio") && sezSpenta.includes("base-light"));

  //  ── LE SOTTO-SEZIONI SEGUONO LA LORO CONDIZIONE ─────────────────────
  //   «Tenuta del colore» esiste solo se un tipo di capello è scelto: senza il
  //   capello, la sua spunta non si porta dietro nessun prezzo.
  const senzaCapello = preselezione({ preselezionate: { "hair-indian": false } });
  c("senza il tipo di capello cade anche la sua sotto-scelta",
    false, senzaCapello.includes("hair-treated"));
  const capelloEuropeo = preselezione({
    preselezionate: { "hair-indian": false, "hair-european": true },
  });
  c("con un altro capello la sotto-scelta torna valida",
    true, capelloEuropeo.includes("hair-treated"));

  /*  ── IL PREZZO SCRITTO SULLA SCHEDA ────────────────────────────────────
      «Patch Cutanea 389 €» era il prezzo della base sola, mentre nel totale in
      fondo entravano anche le voci già spuntate: il numero cresceva scorrendo
      e non si capiva da dove. */
  const menu = buildMenu({});
  /*  ⚠️ LA PATCH NON SI CONFIGURA PIÙ, e queste prove dicevano il contrario.
      Richiesta del committente: «la patch cutanea nel riepilogo mostra le
      opzioni dell'Invisible Derm Protocol, non deve mostrarle». Prima la patch
      vedeva tutte le sezioni generiche: sullo schermo non si disegnavano — la
      pagina sapeva già che non si personalizza — ma restavano vive nel conto,
      e le preselezioni del pannello finivano nel riepilogo di un prodotto che
      quelle opzioni non le ha. Adesso la risposta è una sola, e sta in
      `sectionsFor`: la scheda della patch dice il prezzo della patch. */
  const diSerie = prezzoDiPartenza(menu, "patch-standard", preselezione({}));
  c("la patch non porta nessuna voce", 0, diSerie.voci.length);
  c("e il prezzo è quello della base", 389, diSerie.totale);
  c("niente da aggiungere", 0, diSerie.extra);
  c("niente barrato dove non c'è sconto", undefined, diSerie.listino);

  //  Le stesse prove sul prodotto che SI configura: lì una voce a pagamento
  //  entra nel prezzo della scheda, ed è il punto della richiesta di allora.
  //  589 + 164,67 dell'innesto rinforzato.
  const impostato = { preselezionate: { "base-hyper": true } };
  const conRinf = prezzoDiPartenza(buildMenu(impostato), "invisible-derm", preselezione(impostato));
  c("una voce a pagamento entra nel prezzo della scheda", 753.67, conRinf.totale);
  c("e si vede quanto pesa", 164.67, conRinf.extra);
  //  Il barrato è il conto ai prezzi PIENI: 589 (senza listino proprio) + 390.
  //  ⚠️ Sommare `wasPrice ?? 0` farebbe uscire un "prima" più basso del "dopo".
  c("il barrato è il conto ai prezzi pieni", 979, conRinf.listino);
  c("e il barrato sta sempre sopra il totale", true, conRinf.listino > conRinf.totale);

  //  A sconti spenti si vende al listino: il prezzo della scheda sale e il
  //  barrato sparisce, senza che nessuno debba ricordarselo qui.
  const spenti = { ...impostato, upsellSconti: false };
  const conRinfPieno = prezzoDiPartenza(buildMenu(spenti), "invisible-derm", preselezione(spenti));
  c("a sconti spenti la scheda mostra il pieno", 979, conRinfPieno.totale);
  c("e non c'è più niente da barrare", undefined, conRinfPieno.listino);

  /*  ── IL TRAPIANTO È UN PRODOTTO A SÉ ──────────────────────────────────
      Le voci degli impianti non lo riguardano: se entrassero nel suo conto, la
      sua scheda mostrerebbe un prezzo che non esiste. */
  const tx = prezzoDiPartenza(buildMenu(impostato), TRANSPLANT_ID, preselezione(impostato));
  c("le voci degli impianti non entrano nel trapianto", 2350, tx.totale);
  const conKit = { preselezionate: { "tx-kit": true } };
  const txKit = prezzoDiPartenza(buildMenu(conKit), TRANSPLANT_ID, preselezione(conKit));
  c("le sue voci invece sì", 2900, txKit.totale);
  c("e non toccano gli impianti", 389,
    prezzoDiPartenza(buildMenu(conKit), "patch-standard", preselezione(conKit)).totale);

  //  ⚠️ Anche se arriva uno stato vecchio con due voci dello stesso gruppo a
  //   scelta unica (un preventivo ripreso, uno stato dalla diretta), nel conto
  //   ne entra UNA: il totale non deve poter contare due basi.
  //  (sul prodotto che si configura: la patch non ha sezioni, vedi sopra)
  const doppie = vociPreselezionate(menu.sections, "invisible-derm", ["base-hyper", "base-light"]);
  c("due voci dello stesso gruppo contano per una", 1,
    doppie.filter((v) => v.id === "base-hyper" || v.id === "base-light").length);

  //  Le sezioni della lunghezza e della zona sono solo dell'Invisible Derm:
  //  spuntandole, la patch non deve cambiare prezzo.
  const conLungo = { preselezionate: { "len-30": true } };
  c("una voce di un'altra soluzione non entra nella patch", 389,
    prezzoDiPartenza(buildMenu(conLungo), "patch-standard", preselezione(conLungo)).totale);
  c("ma entra nella sua", 589 + 180,
    prezzoDiPartenza(buildMenu(conLungo), "invisible-derm", preselezione(conLungo)).totale);

  /*  ── OGNI SOLUZIONE HA LE SUE SPUNTE ──────────────────────────────────
      Richiesta del committente: «posso preselezionare gli upsell sui prodotti:
      seleziono il prodotto — Invisible Derm, Patch — e decido cosa è
      preselezionato e cosa no». Il rischio da coprire è che una scelta fatta
      su una strada ne cambi un'altra: chi tara il top di gamma si troverebbe
      il più economico cambiato sotto, senza aver toccato niente. */
  const perProdotto = {
    preselezionatePerBase: {
      "invisible-derm": { "base-hyper": true },
      "patch-standard": { "base-light": false },
    },
  };
  c("la scelta vale per la sua soluzione",
    true, preselezione(perProdotto, "invisible-derm").includes("base-hyper"));
  c("e non tocca le altre",
    false, preselezione(perProdotto, "patch-standard").includes("base-hyper"));
  c("una spunta di serie si toglie su una sola strada",
    false, preselezione(perProdotto, "patch-standard").includes("base-light"));
  c("e resta dov'era sulle altre",
    true, preselezione(perProdotto, TRANSPLANT_ID).length >= 0 &&
      preselezione({ preselezionatePerBase: { "patch-standard": { "base-light": false } } },
        "invisible-derm").includes("base-light"));

  //  La regola generale resta il ripiego: vale dove la soluzione non ha detto
  //  niente, e perde dove l'ha detto. ⚠️ Senza questo, il pannello di ieri —
  //  che scriveva solo la regola generale — smetterebbe di valere.
  //  ⚠️ Le due prove che seguono guardavano la PATCH, che da oggi non ha
  //   opzioni (vedi `sectionsFor`): la regola non è cambiata — una spunta per
  //   soluzione vince sulla regola generale — ma per vederla serve una
  //   soluzione che le opzioni ce le abbia.
  const generale = { preselezionate: { "grey-hair-integration": true } };
  c("la regola generale vale dove la soluzione tace",
    true, preselezione(generale, "invisible-derm").includes("grey-hair-integration"));
  const misto = {
    preselezionate: { "grey-hair-integration": true },
    preselezionatePerBase: { "invisible-derm": { "signature-colour-match": true } },
  };
  c("e la soluzione vince dove parla",
    true, preselezione(misto, "invisible-derm").includes("signature-colour-match"));
  c("(e nel gruppo a scelta unica resta una sola)",
    false, preselezione(misto, "invisible-derm").includes("grey-hair-integration"));

  //  ⚠️ Chiedendo le spunte di una soluzione non devono uscire quelle di
  //   un'altra strada: sarebbero id che nessuna schermata può mostrare e che
  //   nessuno potrebbe più togliere.
  const kitOvunque = { preselezionate: { "tx-kit": true } };
  c("le voci del trapianto non escono dagli impianti",
    false, preselezione(kitOvunque, "patch-standard").includes("tx-kit"));
  c("ma escono dal trapianto",
    true, preselezione(kitOvunque, TRANSPLANT_ID).includes("tx-kit"));
  c("e senza soluzione si vede tutto (com'era prima)",
    true, preselezione(kitOvunque).includes("tx-kit"));

  //  Il prezzo della scheda cambia di conseguenza: è il punto della richiesta.
  const soloTop = { preselezionatePerBase: { "invisible-derm": { "base-hyper": true } } };
  const menuTop = buildMenu(soloTop);
  c("la scheda del top di gamma lo conta", 589 + 164.67,
    prezzoDiPartenza(menuTop, "invisible-derm", preselezione(soloTop, "invisible-derm")).totale);
  c("e quella della patch no", 389,
    prezzoDiPartenza(menuTop, "patch-standard", preselezione(soloTop, "patch-standard")).totale);

  //  ── IL PREVENTIVO TIPO DEL PANNELLO DICE LA STESSA COSA ─────────────
  //   Se qui restasse la combinazione scritta nel codice, il pannello
  //   prometterebbe un totale che il cliente non avrebbe mai visto.
  const sconti = { auto: [], quantita: {} };
  //  Sul prodotto che si configura: sulla patch non ci sono preselezioni da
  //  seguire, perché non ci sono opzioni (vedi `sectionsFor`).
  const tipoSerie = LSC.calcolaPreventivoTipo({}, sconti, "invisible-derm", 1);
  const tipoRinf = LSC.calcolaPreventivoTipo(impostato, sconti, "invisible-derm", 1);
  c("il preventivo tipo segue le preselezioni",
    164.67, tipoRinf.perImpianto - tipoSerie.perImpianto);
  c("e non conta due basi",
    1, tipoRinf.voci.filter((v) => /^Innesto/.test(v.nome)).length);
}

/*  ═══════════════════════════════════════════════════════════════════════
    «NON SONO RIUSCITO A SCARICARE UN PEZZO DELL'APP»
    ───────────────────────────────────────────────────────────────────────
    Segnalazione del committente: «su mobile dà errore, carica all'infinito e
    dice try again» — da iPhone.
    Quando un pezzo dell'app non arriva, l'unico rimedio è ricaricare, e
    l'app lo fa da sé. Ma prima deve RICONOSCERE l'errore, e ogni browser lo
    racconta con parole sue: l'elenco conosceva solo quelle di Chrome, quindi
    su iPhone il rimedio non partiva mai e restava la schermata tecnica.
    Queste prove sono l'elenco delle frasi vere, browser per browser.
    ═══════════════════════════════════════════════════════════════════════ */
/*  ═══════════════════════════════════════════════════════════════════════
    SPOSTARE UN APPUNTAMENTO RIFÀ IL LINK
    ───────────────────────────────────────────────────────────────────────
    Richiesta del committente: «se sposto un appuntamento a un cliente,
    l'anteprima la cambia: genera un nuovo link di Meetly, con la nuova
    anteprima aggiornata con il nuovo giorno e orario».
    Qui si prova la domanda da cui dipende tutto. Sbagliare in un senso vuol
    dire un cliente che riceve un'anteprima con la data vecchia; sbagliare
    nell'altro vuol dire coniare un codice nuovo a ogni salvataggio di una
    scheda — cioè invalidare il link che una persona ha già in mano.
    ═══════════════════════════════════════════════════════════════════════ */
function proveDelloSpostamento() {
  const { momentoConsulenza, consulenzaSpostata, anteprimaDaRifare, chiaveRinvio } = SPM;
  gruppo("L'APPUNTAMENTO SPOSTATO");

  const alle = (data, ora, durata) => ({ dataMeeting: data, oraMeeting: ora, durataMeeting: durata });

  //  ── IL MOMENTO, LETTO DALLE FORME VERE DELL'ARCHIVIO ────────────────
  c("giorno e ora fanno il momento", "2026-09-30T15:00", momentoConsulenza(alle("2026-09-30", "15:00")));
  //  Gli archivi importati scrivono la data con l'ora attaccata e l'ora in
  //  tre forme diverse: sono lo stesso momento, e devono leggersi uguale.
  c("la data con l'ora attaccata è la stessa", "2026-09-30T15:00",
    momentoConsulenza(alle("2026-09-30T00:00:00", "15:00:00")));
  c("le 9 e le 09 sono la stessa ora", "2026-09-30T09:00", momentoConsulenza(alle("2026-09-30", "9.00")));
  c("senza ora non c'è nessun momento", "", momentoConsulenza(alle("2026-09-30", "")));
  c("senza giorno nemmeno", "", momentoConsulenza(alle("", "15:00")));
  c("una data che non esiste non è un momento", "", momentoConsulenza(alle("2026-13-45", "15:00")));

  //  ── LO SPOSTAMENTO VERO ─────────────────────────────────────────────
  c("cambia l'ora: è uno spostamento", true,
    consulenzaSpostata(alle("2026-09-30", "15:00"), alle("2026-09-30", "18:00")));
  c("cambia il giorno: è uno spostamento", true,
    consulenzaSpostata(alle("2026-09-30", "15:00"), alle("2026-10-02", "15:00")));

  /*  ⚠️ LE TRE COSE CHE NON SONO UNO SPOSTAMENTO. Ognuna, presa per tale,
      conia un codice nuovo e brucia il link che il cliente ha in mano. */
  c("il primo appuntamento non è uno spostamento", false,
    consulenzaSpostata({}, alle("2026-09-30", "15:00")));
  c("nemmeno se prima c'era solo il giorno", false,
    consulenzaSpostata(alle("2026-09-30", ""), alle("2026-09-30", "15:00")));
  c("una disdetta non è uno spostamento", false,
    consulenzaSpostata(alle("2026-09-30", "15:00"), {}));
  c("salvare la scheda senza toccare l'orario non sposta niente", false,
    consulenzaSpostata(alle("2026-09-30", "15:00"), alle("2026-09-30", "15:00")));
  //  ⚠️ E la stessa ora scritta in due forme diverse NON è un cambio: senza
  //   questa riga bastava un salvataggio da una schermata che scrive
  //   "15:00:00" per rifare il link a tutti.
  c("la stessa ora scritta diversamente non sposta niente", false,
    consulenzaSpostata(alle("2026-09-30", "15:00"), alle("2026-09-30T00:00", "15:00:00")));
  //  La durata non è lo spostamento: un quarto d'ora in più non vale il link.
  c("allungare la consulenza non è uno spostamento", false,
    consulenzaSpostata(alle("2026-09-30", "15:00", 45), alle("2026-09-30", "15:00", 60)));

  //  ── IL BIGLIETTO, INVECE, LA DURATA LA SCRIVE ───────────────────────
  c("spostato: il biglietto va rifatto", true,
    anteprimaDaRifare(alle("2026-09-30", "15:00"), alle("2026-09-30", "18:00")));
  c("durata cambiata: il biglietto va rifatto lo stesso", true,
    anteprimaDaRifare(alle("2026-09-30", "15:00", 45), alle("2026-09-30", "15:00", 90)));
  c("niente cambiato: niente da rifare", false,
    anteprimaDaRifare(alle("2026-09-30", "15:00", 45), alle("2026-09-30", "15:00", 45)));
  //  45 e "45" sono la stessa durata: altrimenti ogni salvataggio ridisegna.
  c("la durata scritta come testo è la stessa", false,
    anteprimaDaRifare(alle("2026-09-30", "15:00", 45), alle("2026-09-30", "15:00", "45")));
  /*  Una durata fuori scala vale quella di serie: non è un cambio.
      ⚠️ IL CONFRONTO USA LA COSTANTE, non un numero scritto qui: il giorno in
       cui la durata di serie è passata da 45 a 60 (richiesta del committente)
       questa prova è diventata rossa pur essendo la regola intatta — diceva
       «45 e 0 sono la stessa cosa», che è vero solo finché il ripiego è 45. */
  c("una durata impossibile vale quella di serie", false,
    anteprimaDaRifare(
      alle("2026-09-30", "15:00", INVITO.DURATA_PREDEFINITA),
      alle("2026-09-30", "15:00", 0),
    ));
  c("senza appuntamento non c'è biglietto da rifare", false,
    anteprimaDaRifare(alle("2026-09-30", "15:00"), {}));

  //  ── LA CHIAVE DEL RINVIO ────────────────────────────────────────────
  //   La scrivono in due (la rotta che conia il codice nuovo e quella che
  //   risponde all'ospite): se le due forme divergessero, il cliente col link
  //   vecchio resterebbe fuori dalla stanza.
  c("la chiave del rinvio ha una forma sola", "meet-rinvio:kfr-mbqd-tzp", chiaveRinvio("kfr-mbqd-tzp"));
  c("e non si porta dietro gli spazi", "meet-rinvio:abc", chiaveRinvio("  abc  "));
}

/*  ═══════════════════════════════════════════════════════════════════════
    QUANDO UNA PERSONA RICOMPARE IN UNA LISTA GIÀ CARICATA
    ───────────────────────────────────────────────────────────────────────
    Richiesta del committente: «quando è duplicato dove va? Voglio che sposta
    il lead duplicato dentro la scheda importati, mantenendo stato attuale,
    note e tutto, e posso cliccare su conferma e rimane così com'è e torna tra
    i lead normali dove stava; oppure un pulsante che lo sposta in da
    contattare e resetta lo stato, ma aggiunge delle note interne che è stato
    duplicato e ci sta scritto anche il numero di volte».
    Le due cose da non sbagliare mai, e sono quelle che queste prove tengono
    ferme: che segnare un ritorno NON tocchi niente della scheda, e che il
    contatore delle volte non riparta da capo — è il numero che il committente
    vuole leggere, e una spia che dice sempre «una» non serve a niente.
    ═══════════════════════════════════════════════════════════════════════ */
function proveDellaDurataDiSerie() {
  const { DURATA_PREDEFINITA, durataPulita } = INVITO;
  gruppo("QUANTO DURA UNA CONSULENZA DI SERIE");

  /*  Richiesta del committente: «fai che di default, quando fisso consulenze,
      in tutti i campi — sia lead importati sia nuovo lead — sia 60 minuti,
      ovviamente sempre che si può cambiare». */
  c("di serie dura un'ora", 60, DURATA_PREDEFINITA);
  c("senza niente scritto vale quella", 60, durataPulita(undefined));
  c("uno zero in archivio vale quella", 60, durataPulita(0));
  c("una durata vera resta quella scritta", 30, durataPulita(30));
  c("si può cambiare in più", 90, durataPulita(90));
  //  Numeri impossibili (secondi scambiati per minuti, zeri degli archivi
  //  importati) tornano al valore di serie invece di sfondare l'agenda.
  c("una durata assurda torna a quella di serie", 60, durataPulita(99999));

  /*  ── ⚠️ IL NUMERO È UNO SOLO, E QUESTA PROVA LO TIENE TALE ───────────
      Erano quattro, scritti in quattro file (45 qui, 30 nella scheda del lead,
      30 nella finestra veloce, 30 nella giornata dell'agenda) più due «45»
      scritti a mano nel salvataggio: lo stesso appuntamento durava 30, 45 o 60
      minuti a seconda della schermata da cui era stato fissato. Qui si legge il
      codice e si fallisce se qualcuno ne riscrive uno a mano. */
  const dove = [
    "src/crm/LeadDialog.tsx",
    "src/crm/QuickStatusDialog.tsx",
    "src/crm/agenda/AgendaDaySheet.tsx",
    "src/crm/CRMContext.tsx",
    "src/crm/SlotDisponibili.tsx",
    "src/crm/MeetGiornalieri.tsx",
    "src/crm/AgendaTuttiConsulenti.tsx",
    "src/crm/booking-utils.ts",
  ];
  const colpevoli = [];
  for (const f of dove) {
    for (const riga of readFileSync(f, "utf8").split("\n")) {
      //  ⚠️ Si guardano le RIGHE DI CODICE, non i cartelli: in un commento il
      //   numero vecchio ci sta, e anzi serve a raccontare cosa è cambiato.
      if (/^\s*(\/\/|\*|\/\*)/.test(riga)) continue;
      /*  ⚠️ SOLO LA DURATA DELLA CONSULENZA: la visita in sede e
          l'installazione hanno la loro, e sessanta lì dentro è un numero
          giusto. E `|| 0` non è un ripiego: vuol dire «non impostata». */
      if (/durataMeeting\s*\|\|\s*[1-9]/.test(riga) || /DURATA_(MEETING|STD|CONSULENZA)\s*=\s*\d+/.test(riga))
        colpevoli.push(`${f}: ${riga.trim().slice(0, 60)}`);
    }
  }
  c("nessuna durata scritta a mano", "", colpevoli.join(" | "));
}

function proveDellaSessioneConPin() {
  const { statoSessione, daRinfrescare, INATTIVITA_MS, VECCHIAIA_MS, RINFRESCO_MS } = SESS;
  gruppo("QUANTO VIVE UNA SESSIONE APERTA COL PIN");

  const ORA = Date.parse("2026-10-06T15:00:00Z");
  const fa = (ms) => new Date(ORA - ms).toISOString();

  //  ⚠️ LA FINESTRA SCORRE: chi entra alle otto del mattino e lavora tutto il
  //   giorno non deve essere buttato fuori alle otto di sera. Era la
  //   segnalazione del committente.
  c("appena entrata è viva", "viva", statoSessione({ at: fa(0), creataIl: fa(0) }, ORA));
  c("dopo undici ore di lavoro è ancora viva", "viva",
    statoSessione({ at: fa(60_000), creataIl: fa(11 * 3600_000) }, ORA));
  c("ferma da dodici ore si chiude", "ferma-da-troppo",
    statoSessione({ at: fa(INATTIVITA_MS + 1000), creataIl: fa(INATTIVITA_MS + 1000) }, ORA));

  /*  ⚠️ E L'ALTRA SCADENZA, quella che il controllo di sicurezza ha chiesto:
      una finestra che scorre e basta non muore mai — basta usarla una volta
      ogni dodici ore — e un gettone rubato diventerebbe una chiave eterna.
      Sette giorni dall'ingresso, qualunque cosa succeda: è l'unica scadenza
      che chi lo usa non può rimandare. */
  c("usata di continuo ma vecchia di otto giorni: si chiude", "troppo-vecchia",
    statoSessione({ at: fa(1000), creataIl: fa(VECCHIAIA_MS + 1000) }, ORA));
  c("di sei giorni e usata adesso: viva", "viva",
    statoSessione({ at: fa(1000), creataIl: fa(6 * 24 * 3600_000) }, ORA));

  //  ⚠️ Le righe nate prima che la data di nascita esistesse: si prende quella
  //   che c'è, e chi era dentro non viene buttato fuori da un aggiornamento.
  c("riga vecchia senza nascita: vale l'ultimo lavoro", "viva", statoSessione({ at: fa(3600_000) }, ORA));
  c("riga illeggibile non è viva", "illeggibile", statoSessione({ at: "boh" }, ORA));
  c("riga assente non è viva", "illeggibile", statoSessione(null, ORA));

  //  Il rinfresco: non a ogni clic, se no è una scrittura per ogni richiesta.
  c("appena lavorata non si rinfresca", false, daRinfrescare({ at: fa(60_000), creataIl: fa(60_000) }, ORA));
  c("dopo mezz'ora sì", true,
    daRinfrescare({ at: fa(RINFRESCO_MS + 1000), creataIl: fa(RINFRESCO_MS + 1000) }, ORA));
  //  ⚠️ Una sessione morta non si rinfresca: la si cancella.
  c("una morta non si rinfresca", false,
    daRinfrescare({ at: fa(INATTIVITA_MS + 1000), creataIl: fa(INATTIVITA_MS + 1000) }, ORA));
  c("nemmeno una troppo vecchia", false,
    daRinfrescare({ at: fa(RINFRESCO_MS + 1000), creataIl: fa(VECCHIAIA_MS + 1000) }, ORA));
}

function proveDelTelefonoDoppio() {
  const { chiaveTelefono, stessoNumero, schedeConLoStessoNumero, avvisoDoppione, CIFRE_MINIME } = TEL;
  gruppo("QUESTO NUMERO CE L'ABBIAMO GIÀ");

  /*  ⚠️ LO STESSO TELEFONO, IN ARCHIVIO, È SCRITTO IN ALMENO SEI MODI. Se non
      si riconoscono tutti, lo stesso cliente si sdoppia e la storia vecchia —
      note, tentativi, preventivo — non la guarda più nessuno. */
  const modi = [
    "3391234567",
    "339 1234567",
    "+39 339 1234567",
    "+39-339-1234567",
    "0039 339 1234567",
    "39 339 1234567",
  ];
  const chiavi = new Set(modi.map((m) => chiaveTelefono(m)));
  c("sei modi di scrivere, una sola impronta", 1, chiavi.size);
  c("ed è fatta di nove cifre", 9, chiaveTelefono(modi[0]).length);
  c("due modi diversi sono lo stesso numero", true, stessoNumero("339 1234567", "+393391234567"));
  c("due numeri diversi no", false, stessoNumero("3391234567", "3397654321"));

  /*  ⚠️ MENTRE SI SCRIVE NON SI DICE NIENTE: tre cifre somigliano a mezzo
      archivio, e un campo rosso che non significa niente dopo due volte non lo
      guarda più nessuno. */
  c("tre cifre non bastano", "", chiaveTelefono("339"));
  c("sotto il minimo non si dice niente", "", chiaveTelefono("1".repeat(CIFRE_MINIME - 1)));
  c("al minimo si comincia", true, chiaveTelefono("1".repeat(CIFRE_MINIME)).length > 0);
  c("niente numero, niente impronta", "", chiaveTelefono(null));
  c("solo lettere non sono un numero", "", chiaveTelefono("non lo so"));

  const archivio = [
    { id: "A", data: { telefono: "+39 339 1234567", nome: "Mario", cognome: "Rossi" } },
    { id: "B", data: { telefono: "3397654321", nome: "Lucia", cognome: "Bianchi" } },
    { id: "C", data: { telefono: "339 123 45 67", nome: "Mario", cognome: "R." } },
  ];
  c("trova chi ha già quel numero", "A,C",
    schedeConLoStessoNumero({ telefono: "3391234567", schede: archivio }).map((l) => l.id).join(","));
  /*  ⚠️ UNA SCHEDA NON È DOPPIA DI SÉ STESSA: aprendo un lead esistente il suo
      numero è già in archivio, ed è il suo. Senza questa riga ogni scheda
      aperta si dichiarerebbe doppia. */
  c("la scheda aperta non conta sé stessa", "C",
    schedeConLoStessoNumero({ telefono: "3391234567", schede: archivio, escludiId: "A" }).map((l) => l.id).join(","));
  c("un numero nuovo non trova niente", 0,
    schedeConLoStessoNumero({ telefono: "3330000000", schede: archivio }).length);
  c("senza archivio non trova niente", 0, schedeConLoStessoNumero({ telefono: "3391234567" }).length);
  c("mentre si scrive non trova niente", 0,
    schedeConLoStessoNumero({ telefono: "339", schede: archivio }).length);

  //  La frase sotto il campo rosso: un rosso senza nome è un allarme che non
  //  si può usare.
  c("con una scheda dice chi è", true, /Mario Rossi/.test(avvisoDoppione(1, "Mario Rossi")));
  c("con più schede dice quante", true, /2 schede/.test(avvisoDoppione(2, "Mario Rossi")));
  c("senza nome non lascia il buco", true, /senza nome/.test(avvisoDoppione(1, "")));
  c("senza doppioni non si dice niente", "", avvisoDoppione(0, "Mario Rossi"));
}

function proveDiChiSiTelefonaOggi() {
  const { daTelefonareOggi, promessaPerDopo, giornoPromesso, etichettaAttesa } = TELEF;
  gruppo("CHI SI TELEFONA OGGI, E CHI ASPETTA");

  const OGGI = new Date("2026-10-06T10:00:00");
  const fra = (g) => {
    const d = new Date(OGGI);
    d.setDate(d.getDate() + g);
    return d.toISOString().slice(0, 10);
  };

  /*  Segnalazione del committente: «se lo metto da ricontattare fra due
      settimane deve uscire fino a quella data; ora continua a mostrarlo». */
  c("un richiamo fra due settimane non si telefona oggi", false,
    daTelefonareOggi({ stato: "richiamo", dataRicontatto: fra(14) }, OGGI));
  c("ed è in attesa", true, promessaPerDopo({ stato: "richiamo", dataRicontatto: fra(14) }, OGGI));
  //  ⚠️ IL GIORNO DELLA PROMESSA SI CHIAMA: «ti chiamo giovedì» vuol dire
  //   giovedì, non venerdì.
  c("il giorno della promessa si telefona", true,
    daTelefonareOggi({ stato: "richiamo", dataRicontatto: fra(0) }, OGGI));
  c("e se è scaduto, a maggior ragione", true,
    daTelefonareOggi({ stato: "richiamo", dataRicontatto: fra(-3) }, OGGI));
  //  Vale anche per «vi ricontatto io»: chiamarlo prima è fare l'opposto di
  //  quello che ha chiesto.
  c("«ci ricontatta lui» fra una settimana: si aspetta", false,
    daTelefonareOggi({ stato: "ci_ricontatta_lui", dataRicontatto: fra(7) }, OGGI));
  //  Gli altri stati della coda non hanno promesse: si chiamano sempre.
  c("chi non ha mai risposto si chiama", true, daTelefonareOggi({ stato: "non_risponde" }, OGGI));
  c("da contattare si chiama", true, daTelefonareOggi({ stato: "da_contattare" }, OGGI));
  //  ⚠️ Una data sul campo sbagliato non rimanda niente: la promessa è legata
  //   allo stato, se no un appuntamento fissato sembrerebbe un richiamo.
  c("un appuntamento fissato non è in coda", false,
    daTelefonareOggi({ stato: "appuntamento_fissato", dataRicontatto: fra(5) }, OGGI));

  /*  ⚠️ UNA DATA STORTA NON RIMANDA NIENTE: negli archivi importati le date
      illeggibili sono centinaia, e trattarle come «promessa per dopo»
      vorrebbe dire centinaia di schede che non si telefonano più. */
  c("data illeggibile: si chiama", true,
    daTelefonareOggi({ stato: "richiamo", dataRicontatto: "boh" }, OGGI));
  c("data assente: si chiama", true, daTelefonareOggi({ stato: "richiamo" }, OGGI));
  c("data storta, nessun giorno promesso", "",
    giornoPromesso({ stato: "richiamo", dataRicontatto: "31/12/2026" }));
  c("una data vera si legge", fra(3), giornoPromesso({ stato: "richiamo", dataRicontatto: `${fra(3)}T09:00:00Z` }));

  //  Che cosa si scrive su chi aspetta: una riga che compare solo con
  //  l'interruttore acceso, senza spiegazione, sembra «sistemata».
  c("domani si dice domani", "torna domani", etichettaAttesa({ stato: "richiamo", dataRicontatto: fra(1) }, OGGI));
  c("entro due settimane si contano i giorni", "torna fra 9 giorni",
    etichettaAttesa({ stato: "richiamo", dataRicontatto: fra(9) }, OGGI));
  c("più in là si scrive la data", true,
    /torna il \d{2}\/\d{2}\/\d{4}/.test(etichettaAttesa({ stato: "richiamo", dataRicontatto: fra(40) }, OGGI)));
  c("chi non aspetta non dice niente", "", etichettaAttesa({ stato: "da_contattare" }, OGGI));
}

function proveDellaNotaInBreve() {
  const { notaInBreve, CARATTERI_IN_BREVE } = NOTA;
  gruppo("LA NOTA DEL LEAD, LETTA DA FUORI");

  c("niente nota, niente da mostrare", "", notaInBreve("").breve);
  c("nota assente idem", "", notaInBreve(null).breve);
  c("una nota corta si legge tutta", "Lavora fino alle 18", notaInBreve("Lavora fino alle 18").breve);
  c("e non è tagliata", false, notaInBreve("Lavora fino alle 18").tagliata);

  //  ⚠️ GLI A CAPO DIVENTANO SPAZI: nell'elenco la nota sta su una riga, e un
  //   a capo lasciato lì manda fuori quadro la riga sotto.
  c("gli a capo diventano spazi", "Prima riga seconda riga",
    notaInBreve("Prima riga\n\nseconda riga").breve);
  c("gli spazi doppi si stringono", "a b", notaInBreve("a    b").breve);

  const lunga = "Ha già un preventivo da un altro centro e vuole confrontare i prezzi prima di decidere, chiede di essere richiamato dopo le diciotto perché lavora";
  const b = notaInBreve(lunga);
  c("una nota lunga si taglia", true, b.tagliata);
  c("e si vede che continua", true, b.breve.endsWith("…"));
  //  ⚠️ NON SI TAGLIA A METÀ PAROLA: «ha già un preven…» sembra un guasto.
  c("non taglia a metà parola", true, / …$|[^ ]…$/.test(b.breve) && !b.breve.includes("  "));
  c("il pezzo sta nel limite", true, b.breve.length <= CARATTERI_IN_BREVE + 1);
  c("l'intera resta intera", true, b.intera.length > b.breve.length);
  //  Una parola lunghissima non può lasciare tre lettere: lì si taglia dove
  //  capita, che è l'unica cosa sensata.
  const parolone = "a".repeat(300);
  c("una parola lunghissima si taglia comunque", true, notaInBreve(parolone).breve.length <= CARATTERI_IN_BREVE + 1);
  c("e si vede che continua", true, notaInBreve(parolone).tagliata);
}

function proveDellElencoStabile() {
  const { restaNellElenco, targhettaSistemato } = STAB;
  gruppo("UNA RIGA NON SPARISCE SOTTO LE DITA");

  /*  Segnalazione del committente: «qualsiasi cosa faccio su quel contatto
      scompare; se metto appuntamento fissato e chiudo il popup deve rimanere
      lì, perché significa che devo selezionare altro». */
  c("chi è ancora da chiamare si vede", true, restaNellElenco({ daChiamare: true }));
  c("chi è stato sistemato prima no", false, restaNellElenco({ daChiamare: false }));
  //  ⚠️ IL CUORE: l'ho appena sistemato io, da questa schermata. Resta.
  c("chi ho appena sistemato resta", true, restaNellElenco({ daChiamare: false, appenaSistemato: true }));
  //  Con l'interruttore «mostra anche i già sistemati» non si nasconde niente.
  c("con tutti visibili si vede comunque", true, restaNellElenco({ daChiamare: false, tuttiVisibili: true }));
  c("senza sapere niente non si vede", false, restaNellElenco({}));

  /*  La targhetta: serve a non far sembrare rotto il filtro. */
  c("su chi è da chiamare non si scrive niente", "",
    targhettaSistemato({ daChiamare: true, appenaSistemato: true }));
  c("su chi resta si scrive perché", true,
    /resta finché sei qui/.test(targhettaSistemato({ daChiamare: false, appenaSistemato: true })));
  //  ⚠️ Con tutti visibili la riga c'è comunque: dire «resta qui» sarebbe falso.
  c("con tutti visibili la frase cambia", "appena sistemato",
    targhettaSistemato({ daChiamare: false, appenaSistemato: true, tuttiVisibili: true }));
  c("su chi non ho toccato, niente", "", targhettaSistemato({ daChiamare: false }));
}

function proveDellAttesaWhatsApp() {
  const { attesaWhatsApp, giorniDa, eSiFaVivoLui, ATTESA_AMBRA_GG, ATTESA_ROSSA_GG } = RIC;
  gruppo("DA QUANTO ASPETTA UNA RISPOSTA");

  const ADESSO = new Date("2026-10-06T10:00:00Z");
  const scritto = (giorniFa, confermato) => ({
    data: {
      ricarico: {
        volte: 1,
        ultimo: "2026-10-01T10:00:00Z",
        daDecidere: true,
        whatsappIl: new Date(ADESSO.getTime() - giorniFa * 86400000).toISOString(),
        ...(confermato ? { whatsappConfermatoIl: ADESSO.toISOString() } : {}),
      },
    },
  });

  //  ⚠️ Mai negativo: una data nel futuro è l'orologio di un altro computer,
  //   non un'attesa al contrario.
  c("i giorni si contano interi", 3, giorniDa("2026-10-03T10:00:00Z", ADESSO));
  c("oggi sono zero giorni", 0, giorniDa("2026-10-06T09:00:00Z", ADESSO));
  c("una data nel futuro vale zero", 0, giorniDa("2026-10-09T10:00:00Z", ADESSO));
  c("una data illeggibile non è un'attesa", -1, giorniDa("boh", ADESSO));

  //  Chi non è stato scritto non ha nessuna attesa da raccontare: nella
  //  linguetta «Vedi dopo» un'etichetta in più sarebbe rumore.
  c("senza WhatsApp niente attesa", null, attesaWhatsApp({ data: { ricarico: { volte: 1, ultimo: "x", daDecidere: true } } }, ADESSO));
  c("senza scheda niente attesa", null, attesaWhatsApp(null, ADESSO));

  const fresco = attesaWhatsApp(scritto(0, true), ADESSO);
  c("scritto oggi: tono neutro", "neutro", fresco.tono);
  c("e lo dice in italiano", true, /oggi/.test(fresco.testo));
  c("ieri si dice «da ieri»", true, /da ieri/.test(attesaWhatsApp(scritto(1, true), ADESSO).testo));

  //  ⚠️ IL COLORE NON SPOSTA NIENTE: dice soltanto chi è stato dimenticato.
  //   Niente torna in coda da solo — è una scelta esplicita del committente.
  c("sotto la soglia resta neutro", "neutro", attesaWhatsApp(scritto(ATTESA_AMBRA_GG - 1, true), ADESSO).tono);
  c("alla soglia diventa ambra", "ambra", attesaWhatsApp(scritto(ATTESA_AMBRA_GG, true), ADESSO).tono);
  c("fra le due soglie resta ambra", "ambra", attesaWhatsApp(scritto(ATTESA_ROSSA_GG - 1, true), ADESSO).tono);
  c("alla seconda soglia diventa rosso", "rosso", attesaWhatsApp(scritto(ATTESA_ROSSA_GG, true), ADESSO).tono);
  c("e più in là resta rosso", "rosso", attesaWhatsApp(scritto(30, true), ADESSO).tono);
  c("i giorni si leggono nel testo", true, /da 6 giorni/.test(attesaWhatsApp(scritto(6, true), ADESSO).testo));

  /*  ⚠️ «SCRITTO» E «FORSE SCRITTO» NON SI LEGGONO UGUALI. Premere il tasto
      apre soltanto WhatsApp: in mezzo c'è una persona che può ripensarci o
      sbagliare chat. Finché nessuno conferma col ✓, la riga lo dice. */
  const nonConfermato = attesaWhatsApp(scritto(1, false), ADESSO);
  c("senza il ✓ risulta non confermato", false, nonConfermato.confermato);
  c("e la riga lo scrive", true, /non confermato/.test(nonConfermato.testo));
  c("col ✓ risulta confermato", true, attesaWhatsApp(scritto(1, true), ADESSO).confermato);
  c("e allora parla di attesa", true, /Aspetta risposta/.test(attesaWhatsApp(scritto(1, true), ADESSO).testo));

  /*  «Di ritorno» non è solo chi ricompare in una lista: è anche chi ha detto
      che richiama lui. Stesso reparto, fascia diversa — su di lui le due
      decisioni del contatto di ritorno non scriverebbero niente. */
  c("chi ha detto che richiama lui è di ritorno", true, eSiFaVivoLui({ data: { stato: "ci_ricontatta_lui" } }));
  c("un richiamo nostro no", false, eSiFaVivoLui({ data: { stato: "richiamo" } }));
  c("una scheda senza stato no", false, eSiFaVivoLui({ data: {} }));
  c("niente scheda, niente", false, eSiFaVivoLui(null));
}

function proveDeiDoppioni() {
  const { doppioniPerTelefono, principaleDi, pesoDiStoria, patchUnione, patchAssorbita,
          patchNonDoppione, dichiarateDiverse, eAssorbita } = DOPPI;
  gruppo("LA STESSA PERSONA, DUE SCHEDE");

  /*  Misurato in archivio il 7/10/2026: ventinove numeri con due schede a
      testa. *Cristiano Sibilia* stava sia in «da ricontattare» che in «acconto
      incassato»: due storie della stessa persona, e chi chiama ne legge una a
      caso. In tutto il programma non esisteva nessun modo di unirle. */
  const scheda = (id, data, creata = "2026-01-01T00:00:00Z") => ({
    id, created_at: creata, updated_at: creata, data,
  });
  const vecchia = scheda("A", {
    nome: "Cristiano", cognome: "Sibilia", telefono: "+39 333 1234567",
    stato: "acconto", note: "Vuole la posa di sabato", citta: "Napoli",
  }, "2026-01-01T00:00:00Z");
  const nuova = scheda("B", {
    nome: "Cristiano", telefono: "3331234567",
    stato: "da_ricontattare", note: "Chiede il preventivo via mail", email: "c@x.it",
  }, "2026-09-01T00:00:00Z");

  //  ⚠️ Lo stesso numero scritto in due modi: è la stessa regola del campo
  //   rosso e dell'importazione, non una terza scritta qui.
  const gruppi = doppioniPerTelefono([vecchia, nuova]);
  c("due schede, un numero: un gruppo", 1, gruppi.length);
  c("e dentro ci sono tutte e due", 2, gruppi[0].schede.length);

  /*  ⚠️ Resta quella con la STORIA PIÙ AVANTI, non la più recente: una scheda
      creata ieri da un modulo è vuota, e tenerla al posto di quella con
      l'acconto versato vorrebbe dire unire al contrario. */
  c("resta quella che ha comprato", "A", principaleDi([nuova, vecchia]).id);
  c("ed è la prima del gruppo", "A", gruppi[0].schede[0].id);
  c("chi ha comprato pesa di più", true, pesoDiStoria(vecchia) > pesoDiStoria(nuova));

  const patch = patchUnione(vecchia, nuova);
  //  ⚠️ Solo i buchi: quello che c'è già non si tocca MAI.
  c("si prende l'email che mancava", "c@x.it", patch.email);
  c("la città non si sovrascrive", undefined, patch.citta);
  //  ⚠️ LO STATO NON SI COPIA MAI: due schede sono due discorsi, e prenderlo
  //   dall'altra farebbe tornare indietro una trattativa con un clic che
  //   prometteva solo di «unire i dati».
  c("lo stato non si tocca", undefined, patch.stato);
  //  ⚠️ Le note si SOMMANO: sono il motivo per cui si unisce.
  c("le note si mettono in fila", true, String(patch.note).includes("Vuole la posa di sabato"));
  c("e ci sono anche quelle dell'altra", true, String(patch.note).includes("preventivo via mail"));
  c("con scritto da dove arrivano", true, String(patch.note).includes("scheda unita"));

  /*  ⚠️ NON SI CANCELLA NIENTE: un'unione è un'ipotesi, e due fratelli con lo
      stesso numero di casa sono due persone. L'assorbita si mette da parte —
      reversibile — e si segna dov'è andata. */
  const dopo = patchAssorbita(vecchia, "Filippo", new Date("2026-10-07T10:00:00Z"));
  c("l'assorbita dice dov'è andata", "A", dopo.unitoIn);
  c("ed esce dagli elenchi", true, !!dopo.saltatoIl);
  c("ma non si cancella niente", undefined, dopo.stato);
  c("e si riconosce", true, eAssorbita({ id: "B", data: { ...nuova.data, ...dopo } }));
  //  Una già unita non torna mai nei gruppi.
  c("una già unita non si ripropone", 0,
    doppioniPerTelefono([vecchia, { ...nuova, data: { ...nuova.data, ...dopo } }]).length);

  /*  ⚠️ «Non è la stessa persona» è una risposta e va ricordata su TUTTE E DUE
      le schede: la coppia si può ritrovare da una parte o dall'altra. */
  const no = patchNonDoppione(vecchia, nuova);
  c("la risposta si segna", true, (no.nonDoppioneDi || []).includes("B"));
  const vecchiaNo = { ...vecchia, data: { ...vecchia.data, ...no } };
  c("e la coppia risulta dichiarata diversa", true, dichiarateDiverse(vecchiaNo, nuova));
  c("anche guardandola dall'altra parte", true, dichiarateDiverse(nuova, vecchiaNo));
  c("quella coppia non si ripropone più", 0, doppioniPerTelefono([vecchiaNo, nuova]).length);
  c("e non si segna due volte", undefined, patchNonDoppione(vecchiaNo, nuova).nonDoppioneDi);

  //  Un numero solo non è un doppione, e senza numero non si riconosce niente.
  c("una scheda sola non è un gruppo", 0, doppioniPerTelefono([vecchia]).length);
  c("senza telefono non si accoppia nessuno", 0,
    doppioniPerTelefono([scheda("C", { nome: "Ada" }), scheda("D", { nome: "Ada" })]).length);
}

function proveDellaRipesca() {
  const { STATI_DORMIENTI, SILENZIO_PREDEFINITO_GG, giorniDiSilenzio, eDormiente, dormienti,
          contiPerStato, etichettaSilenzio, patchRipescato, volteRipescato } = RIP;
  gruppo("RIPESCA: LE SCHEDE FERME CHE NESSUNO RIAPRE");

  /*  Il numero che ha fatto nascere questo modulo: su 1.081 schede, 823 ferme
      in «annullato», «non si è presentato» o «da ricontattare», e diciassette
      in coda. Il lavoro vero stava in un magazzino che nessuna schermata
      apriva. */
  const OGGI = new Date("2026-10-07T12:00:00Z");
  const quando = (giorni) =>
    new Date(OGGI.getTime() - giorni * 24 * 3600 * 1000).toISOString();
  const scheda = (stato, giorni, altro = {}) => ({
    id: `${stato}-${giorni}`,
    updated_at: quando(giorni),
    created_at: quando(giorni + 10),
    data: { nome: "Ada", stato, ...altro },
  });

  c("il silenzio si conta sui giorni", 40, giorniDiSilenzio(scheda("no_show", 40), OGGI));
  //  ⚠️ «Non si sa» non vale come «da sempre»: una data illeggibile non deve
  //   far comparire una persona in cima all'elenco dei dimenticati.
  c("una data illeggibile non è un silenzio", -1,
    giorniDiSilenzio({ updated_at: "non una data" }, OGGI));
  c("e quella scheda resta fuori", false,
    eDormiente({ id: "x", updated_at: "boh", data: { stato: "no_show" } }, {}, OGGI));

  c("una scheda ferma da 40 giorni c'è", true, eDormiente(scheda("no_show", 40), {}, OGGI));
  c("una ferma da 3 giorni no", false, eDormiente(scheda("no_show", 3), {}, OGGI));
  c("la soglia di serie è un mese", 30, SILENZIO_PREDEFINITO_GG);

  /*  ⚠️ CHI HA COMPRATO NON SI RIPESCA: riscrivere «riprendiamo da dove
      eravamo» a chi ha versato un acconto è il modo di sembrare un call
      center. E chi è in coda si telefona, non si ripesca. */
  c("chi ha versato l'acconto non si ripesca", false, eDormiente(scheda("acconto", 200), {}, OGGI));
  c("chi ha comprato nemmeno", false, eDormiente(scheda("venduto", 200), {}, OGGI));
  c("e chi è da chiamare ha già la sua strada", false,
    eDormiente(scheda("da_contattare", 200), {}, OGGI));
  //  ⚠️ `non_interessato` è l'unico che ha detto di no a NOI: riscrivergli
  //   vuol dire farsi bloccare il numero, e un numero bloccato non torna.
  c("chi ha detto di no resta fuori", false, STATI_DORMIENTI.includes("non_interessato"));
  c("chi non si è presentato invece sì", true, STATI_DORMIENTI.includes("no_show"));

  const archivio = [
    scheda("no_show", 90),
    scheda("annullato", 200),
    scheda("da_ricontattare", 45),
    scheda("no_show", 2),
    scheda("venduto", 300),
    scheda("da_contattare", 300),
  ];
  const fermi = dormienti(archivio, {}, OGGI);
  c("si pescano solo le ferme davvero", 3, fermi.length);
  //  ⚠️ In cima la più dimenticata: è la riga che non tornerà mai a galla da
  //   sola.
  c("in cima la più dimenticata", 200, giorniDiSilenzio(fermi[0], OGGI));
  c("e in fondo la più recente", 45, giorniDiSilenzio(fermi[2], OGGI));
  //  Il filtro per stato restringe, non allarga.
  c("filtrando per stato", 1, dormienti(archivio, { stati: ["annullato"] }, OGGI).length);
  //  Alzando la soglia del silenzio ne restano meno.
  c("alzando la soglia a 100 giorni", 2, dormienti(archivio, { giorniMin: 60 }, OGGI).length);

  const conti = contiPerStato(archivio, 30, OGGI);
  c("i conti per stato", 1, conti.get("annullato"));
  c("e uno stato senza ferme non compare", undefined, conti.get("venduto"));

  c("da quanto tace, in parole", "ferma da 3 mesi", etichettaSilenzio(95));
  c("un mese solo si dice così", "ferma da un mese", etichettaSilenzio(31));
  c("sotto il mese si contano i giorni", "ferma da 12 giorni", etichettaSilenzio(12));
  c("e un anno si dice un anno", "ferma da un anno", etichettaSilenzio(400));

  /*  ⚠️ Senza il segno la stessa persona torna in cima ogni volta che si apre
      la pagina — scriverle non cambia il suo stato, e non deve — e le si
      riscrive fra una settimana. */
  const primo = patchRipescato({}, "Filippo", OGGI);
  c("la prima ripescata conta uno", 1, primo.ripescatoVolte);
  c("e porta chi l'ha fatto", "Filippo", primo.ripescatoDa);
  c("la seconda conta due", 2, patchRipescato(primo, "Filippo", OGGI).ripescatoVolte);
  c("mai ripescata: zero", 0, volteRipescato({}));
  c("e si rilegge", 2, volteRipescato(patchRipescato(primo, "Filippo", OGGI)));
}

function proveDelRicarico() {
  const { ricaricoDi, volteRicaricato, eDaDecidere, patchRicarico, patchConferma,
          patchRimettiInCoda, righeRicarico, etichettaRicarico, STATO_RIMESSO } = RIC;
  gruppo("CHI RICOMPARE IN UNA LISTA");

  /*  ── IN UN ELENCO SOLO, E UNO SOLO ─────────────────────────────────────
      La regola stava nei cartelli e non in nessuna funzione: ogni elenco si
      filtrava a mano nella pagina, e i filtri si sono scollati — «Di ritorno»
      toglieva i messi da parte, «Vedi dopo» e «Scritti su WhatsApp» no. Un
      contatto di ritorno messo da parte spariva da tutti e tre.
      ⚠️ Queste prove esistono perché quel giorno i casi veri erano ZERO: senza
       una prova, una regola che non si vede fallire non si vede nemmeno
       tornare. */
  const { repartoDelRitorno, chiedeAncoraUnaDecisione } = RIC;
  const con = (ric, altro = {}) => ({ id: "x", data: { nome: "Ada", ...altro, ricarico: ric } });
  const APERTA = { volte: 1, ultimo: "2026-09-20T10:00:00Z", daDecidere: true };
  c("decidi adesso", "ritorno", repartoDelRitorno(con(APERTA)));
  c("rimandato", "rimandato", repartoDelRitorno(con({ ...APERTA, rimandatoIl: "2026-09-21T10:00:00Z" })));
  c("scritto su WhatsApp", "whatsapp", repartoDelRitorno(con({ ...APERTA, whatsappIl: "2026-09-22T10:00:00Z" })));
  //  ⚠️ Il messaggio è più recente del rinvio: vince lui, o la scheda starebbe
  //   in due elenchi e si deciderebbe due volte (o nessuna).
  c("scritto DOPO essere stato rimandato: conta il messaggio", "whatsapp",
    repartoDelRitorno(con({ ...APERTA, rimandatoIl: "2026-09-21T10:00:00Z", whatsappIl: "2026-09-22T10:00:00Z" })));
  //  ⚠️ IL CUORE: messo da parte vince su tutto. Prima spariva e basta.
  c("messo da parte: sta lì, non altrove", "daparte",
    repartoDelRitorno(con(APERTA, { saltatoIl: "2026-09-22T10:00:00Z" })));
  c("messo da parte anche se gli era stato scritto", "daparte",
    repartoDelRitorno(con({ ...APERTA, whatsappIl: "2026-09-22T10:00:00Z" }, { saltatoIl: "2026-09-22T10:00:00Z" })));
  //  …e la domanda non si perde: la riga lo dice.
  c("e la riga dice che la domanda è ancora aperta", true,
    chiedeAncoraUnaDecisione(con(APERTA, { saltatoIl: "2026-09-22T10:00:00Z" })));
  c("chi non è messo da parte non ha quella targhetta", false,
    chiedeAncoraUnaDecisione(con(APERTA)));
  //  Deciso = fuori da tutti gli elenchi.
  c("una decisione presa non sta in nessun elenco", null,
    repartoDelRitorno(con({ ...APERTA, daDecidere: undefined })));
  c("e chi non è mai ricomparso nemmeno", null, repartoDelRitorno({ id: "y", data: { nome: "Ada" } }));
  //  ⚠️ I quattro reparti si escludono: è tutta la regola, e si prova così.
  const casi = [
    con(APERTA),
    con({ ...APERTA, rimandatoIl: "2026-09-21T10:00:00Z" }),
    con({ ...APERTA, whatsappIl: "2026-09-22T10:00:00Z" }),
    con(APERTA, { saltatoIl: "2026-09-22T10:00:00Z" }),
  ];
  c("ogni scheda sta in un elenco solo", 4, new Set(casi.map(repartoDelRitorno)).size);


  const IERI = new Date("2026-09-23T10:00:00Z");
  const OGGI = new Date("2026-09-24T10:00:00Z");
  //  Una scheda vera: ha uno stato, note e un appuntamento. Sono esattamente
  //  le cose che il committente ha chiesto di NON perdere.
  const scheda = {
    nome: "Mario", cognome: "Rossi", telefono: "+393331234567",
    stato: "appuntamento_fissato",
    note: "Ha chiesto di essere richiamato di sera",
    dataMeeting: "2026-10-01", oraMeeting: "15:00", consulenteId: "C1",
    noRispondeCount: 4,
  };

  /*  ── QUANTE VOLTE GLI ABBIAMO SCRITTO ──────────────────────────────────
      `whatsappIl` è l'ULTIMA volta e si sovrascrive apposta (è «da quanto
      aspetta»): senza un conto a parte, una persona scritta tre volte senza
      mai una risposta si legge come una scritta stamattina, e si continua a
      riscrivere a chi non risponderà. */
  const { volteScritto, patchContattatoWhatsApp: scrivi, patchWhatsappNonInviato: nonMandato } = RIC;
  const UNA = { volte: 1, ultimo: "2026-09-20T10:00:00Z", daDecidere: true };
  c("mai scritto: zero", 0, volteScritto({ ricarico: UNA }));
  const dopoUna = { ricarico: UNA, ...scrivi({ ricarico: UNA }, "Ada", OGGI) };
  c("scritto una volta", 1, volteScritto(dopoUna));
  const dopoDue = { ...dopoUna, ...scrivi(dopoUna, "Ada", OGGI) };
  c("scritto due volte", 2, volteScritto(dopoDue));
  //  ⚠️ Una data senza conto vale UNO: sono le schede scritte prima che il
  //   contatore esistesse, e «zero volte» su una scheda che porta la data del
  //   messaggio è una bugia che si legge a schermo.
  c("le schede vecchie valgono una", 1,
    volteScritto({ ricarico: { ...UNA, whatsappIl: "2026-09-28T10:35:00Z" } }));
  //  ⚠️ La X dice «QUESTO non l'ho mandato», non «non gliene ho mai scritto».
  const dopoLaX = { ...dopoDue, ...nonMandato(dopoDue, OGGI) };
  c("la X toglie uno, non azzera", 1, Number(dopoLaX.ricarico.whatsappVolte));
  c("e la data del messaggio se ne va", undefined, dopoLaX.ricarico.whatsappIl);
  const unaSola = { ricarico: UNA, ...scrivi({ ricarico: UNA }, "Ada", OGGI) };
  c("con una sola volta la X non lascia conti dietro", undefined,
    nonMandato(unaSola, OGGI).ricarico.whatsappVolte);
  //  E dalla seconda in su la riga lo dice.
  c("la storia racconta quante volte", true,
    RIC.righeRicarico(dopoDue).some((r) => r.includes("2 volte")));

  //  ── UNA SCHEDA MAI RICARICATA NON DICE NIENTE ───────────────────────
  c("una scheda normale non ha ricarichi", null, ricaricoDi(scheda));
  c("e non ne ha contati", 0, volteRicaricato(scheda));
  c("e non aspetta nessuna decisione", false, eDaDecidere({ data: scheda }));
  c("niente scheda, niente ricarico", 0, volteRicaricato(null));
  c("nessuna riga da mostrare", 0, righeRicarico(scheda).length);

  //  ── LA PRIMA VOLTA CHE TORNA ────────────────────────────────────────
  const p1 = patchRicarico(scheda, "Ads Accese 01.csv", IERI);
  c("la prima volta conta uno", 1, p1.ricarico.volte);
  c("e chiede una decisione", true, p1.ricarico.daDecidere);
  c("si ricorda da quale lista", "Ads Accese 01.csv", p1.ricarico.lista);
  c("e in che stato l'ha trovato", "appuntamento_fissato", p1.ricarico.statoAllora);

  /*  ⚠️ LA PROVA PIÙ IMPORTANTE DI TUTTE: la modifica tocca UN campo solo.
      «Mantenendo stato attuale, note e tutto» vuol dire che qui dentro non
      deve comparire nient'altro — un file di lista sa meno dell'archivio, e
      scriverci sopra cancellerebbe mesi di storia per aggiungere zero. */
  c("non tocca nient'altro della scheda", "ricarico", Object.keys(p1).join(","));

  const dopo1 = { ...scheda, ...p1 };
  c("adesso aspetta una decisione", true, eDaDecidere({ data: dopo1 }));
  c("lo stato non si è mosso", "appuntamento_fissato", dopo1.stato);
  c("le note nemmeno", scheda.note, dopo1.note);
  c("e l'appuntamento è ancora lì", "2026-10-01", dopo1.dataMeeting);

  //  ── «CONFERMA»: RESTA COM'È ─────────────────────────────────────────
  const confermato = { ...dopo1, ...patchConferma(dopo1) };
  c("confermato, non chiede più niente", false, eDaDecidere({ data: confermato }));
  c("ma resta scritto che è tornato", 1, volteRicaricato(confermato));
  c("e lo stato è sempre il suo", "appuntamento_fissato", confermato.stato);

  //  ── E SE TORNA ANCORA ───────────────────────────────────────────────
  //   ⚠️ Il contatore NON riparte: è il numero che si legge sulla scheda.
  const dopo2 = { ...confermato, ...patchRicarico(confermato, "Ads Accese 02.csv", OGGI) };
  c("la seconda volta conta due", 2, volteRicaricato(dopo2));
  c("e chiede di nuovo una decisione", true, eDaDecidere({ data: dopo2 }));
  c("con la lista nuova", "Ads Accese 02.csv", ricaricoDi(dopo2).lista);

  //  ── «RIMETTILO FRA I DA CONTATTARE» ─────────────────────────────────
  const rimesso = { ...dopo2, ...patchRimettiInCoda(dopo2, OGGI) };
  c("lo stato riparte da capo", STATO_RIMESSO, rimesso.stato);
  c("«da capo» vuol dire da contattare", "da_contattare", STATO_RIMESSO);
  c("i tentativi a vuoto si azzerano", 0, rimesso.noRispondeCount);
  c("non chiede più una decisione", false, eDaDecidere({ data: rimesso }));
  c("il conto delle volte resta", 2, volteRicaricato(rimesso));
  c("e si segna quando è stato rimesso", true, !!ricaricoDi(rimesso).rimessoIl);
  //  ⚠️ NON si cancellano appuntamenti e note: «resetta lo stato» è una frase
  //   sullo stato. Cancellare un appuntamento fissato sarebbe una perdita che
  //   nessun pulsante di quella pagina può permettersi.
  c("le note non si toccano", scheda.note, rimesso.note);
  c("l'appuntamento non si tocca", "2026-10-01", rimesso.dataMeeting);
  //  Chi era stato messo da parte deve rientrare DAVVERO: senza questo, il
  //  pulsante direbbe «rimesso in mezzo agli altri» e non lo rimetterebbe da
  //  nessuna parte (i saltati escono dalla coda, vedi eSaltato).
  const saltato = { ...scheda, saltatoIl: "2026-09-20T09:00:00Z", saltatoDa: "Luca" };
  const tornato = { ...saltato, ...patchRimettiInCoda(saltato, OGGI) };
  c("e chi era saltato rientra", undefined, tornato.saltatoIl);
  c("senza lasciarsi dietro chi l'aveva saltato", undefined, tornato.saltatoDa);

  //  ── LE RIGHE NON MODIFICABILI ───────────────────────────────────────
  //   Non sono un campo: si calcolano. Il numero delle volte deve leggersi.
  const righe = righeRicarico(rimesso).join(" | ");
  c("le righe dicono quante volte", true, /2 volte/.test(righe));
  c("dicono da quale lista", true, /Ads Accese 02\.csv/.test(righe));
  c("dicono in che stato era", true, /Appuntamento fissato/i.test(righe));
  c("e che è stato rimesso a mano", true, /Rimesso fra i/.test(righe));
  c("alla prima volta non dice «1 volte»", false, /1 volte/.test(righeRicarico(dopo1).join(" ")));

  //  ── QUELLO CHE ARRIVA DAGLI ARCHIVI IMPORTATI ───────────────────────
  //   ⚠️ In `crm_leads.data` c'è dentro di tutto: un campo storto non deve far
  //    cadere la scheda che lo mostra, deve valere «non c'è».
  c("un ricarico senza numero non conta", 0, volteRicaricato({ ricarico: { volte: "tre" } }));
  c("nemmeno a zero", 0, volteRicaricato({ ricarico: { volte: 0 } }));
  c("nemmeno se non è un oggetto", 0, volteRicaricato({ ricarico: "sì" }));
  c("un numero con la virgola si tronca", 2, volteRicaricato({ ricarico: { volte: 2.7 } }));

  //  ── IL DISTINTIVO ───────────────────────────────────────────────────
  c("alla prima volta è «Di ritorno»", "Di ritorno", etichettaRicarico(dopo1));
  c("dalla seconda si conta", "Di ritorno · 2ª volta", etichettaRicarico(dopo2));
  c("e su una scheda normale non c'è", "", etichettaRicarico(scheda));
}

/*  ═══════════════════════════════════════════════════════════════════════
    «VEDI DOPO» E IL MESSAGGIO PER RIFISSARE
    ───────────────────────────────────────────────────────────────────────
    Richieste del committente: una terza via sul contatto di ritorno («vedi
    dopo»), una scheda con tutti i rimandati e le stesse due opzioni, e un
    pulsante WhatsApp che ricordi l'appuntamento che c'era — con la sua data —
    chiedendo quando rifissare.
    Il rischio da coprire è uno solo, ma è grosso: che «rimandare» diventi
    «deciso». Se `daDecidere` si spegnesse premendo «Vedi dopo», quelle schede
    uscirebbero dalla coda E dalla linguetta, cioè sparirebbero — che è il modo
    peggiore di perdere un duplicato.
    ═══════════════════════════════════════════════════════════════════════ */
function proveDelVediDopo() {
  const { patchRicarico, patchVediDopo, patchConferma, patchRimettiInCoda, eDaDecidere,
          eRimandato, aspettaUnaDecisione, ricaricoDi, righeRicarico,
          daRifissare, messaggioRifissa, STATI_DA_RIFISSARE, LINK_RISULTATI } = RIC;
  gruppo("VEDI DOPO, E IL MESSAGGIO PER RIFISSARE");

  const OGGI = new Date("2026-09-24T10:00:00Z");
  const scheda = {
    nome: "Mario", cognome: "Rossi", telefono: "+393331234567",
    stato: "appuntamento_fissato", note: "Richiamare di sera",
    dataMeeting: "2026-09-10", oraMeeting: "15:00",
  };
  const daDecidere = { ...scheda, ...patchRicarico(scheda, "Lista 01.csv", OGGI) };

  //  ── PRIMA: LA DOMANDA È IN CIMA ALLA CODA ───────────────────────────
  c("appena torna, chiede una decisione adesso", true, eDaDecidere({ data: daDecidere }));
  c("e non è fra i rimandati", false, eRimandato({ data: daDecidere }));

  //  ── «VEDI DOPO» ─────────────────────────────────────────────────────
  const rimandato = { ...daDecidere, ...patchVediDopo(daDecidere, "Luca", OGGI) };
  c("rimandato, non chiede più adesso", false, eDaDecidere({ data: rimandato }));
  c("ma finisce fra i «Vedi dopo»", true, eRimandato({ data: rimandato }));
  /*  ⚠️ LA PROVA CHE CONTA: la domanda resta APERTA. Se questa dicesse false,
      la scheda uscirebbe dalla cima della coda e dalla linguetta insieme —
      cioè «Vedi dopo» sarebbe un modo silenzioso di buttare via un duplicato. */
  c("e la domanda resta aperta", true, aspettaUnaDecisione({ data: rimandato }));
  c("si segna chi l'ha rimandata", "Luca", ricaricoDi(rimandato).rimandatoDa);
  c("e quando", true, !!ricaricoDi(rimandato).rimandatoIl);
  //  ⚠️ Rimandare non è un esito: lo stato, le note e l'appuntamento non si
  //   toccano. È la differenza fra mettere da parte la DOMANDA e mettere da
  //   parte la PERSONA.
  c("lo stato non si muove", "appuntamento_fissato", rimandato.stato);
  c("le note nemmeno", "Richiamare di sera", rimandato.note);
  c("e l'appuntamento resta", "2026-09-10", rimandato.dataMeeting);
  c("il rinvio si legge nelle righe", true, /Vedi dopo/.test(righeRicarico(rimandato).join(" ")));
  c("con il nome di chi l'ha premuto", true, /da Luca/.test(righeRicarico(rimandato).join(" ")));

  //  ── E POI SI DECIDE, DA LÌ ──────────────────────────────────────────
  //   Le due opzioni della scheda «Vedi dopo» sono le stesse del riquadro, e
  //   devono chiudere la domanda: altrimenti la riga resterebbe nell'elenco
  //   anche dopo essere stata decisa.
  const confermato = { ...rimandato, ...patchConferma(rimandato) };
  c("confermato da lì, esce dall'elenco", false, eRimandato({ data: confermato }));
  c("e non chiede più niente", false, aspettaUnaDecisione({ data: confermato }));
  const rimesso = { ...rimandato, ...patchRimettiInCoda(rimandato, OGGI) };
  c("rimesso da lì, esce dall'elenco", false, eRimandato({ data: rimesso }));
  c("e non chiede più niente", false, aspettaUnaDecisione({ data: rimesso }));
  c("ed è tornato da contattare", "da_contattare", rimesso.stato);

  //  Una scheda senza ricarico non si può rimandare: non c'è nessuna domanda.
  c("senza ricarico non c'è niente da rimandare", 0, Object.keys(patchVediDopo(scheda)).length);

  /*  ── «GLI HO SCRITTO SU WHATSAPP» ────────────────────────────────────
      Richiesta del committente: «quando clicco contatta su WhatsApp ai lead
      duplicati importati, fai che si spostano dentro contattati su WhatsApp».
      Il messaggio partiva senza lasciare traccia: la scheda restava in cima
      alla coda come se nessuno avesse fatto niente, e il giorno dopo non si
      sapeva se era stato mandato. */
  const { patchContattatoWhatsApp, eContattatoWhatsApp } = RIC;
  const scritto = { ...daDecidere, ...patchContattatoWhatsApp(daDecidere, "Marilù", OGGI) };
  c("scritto, non chiede più adesso", false, eDaDecidere({ data: scritto }));
  c("ed entra fra gli scritti su WhatsApp", true, eContattatoWhatsApp({ data: scritto }));
  //  ⚠️ La prova che conta, la stessa del «vedi dopo»: scrivere NON è decidere.
  //   Se questa dicesse false, la scheda uscirebbe dalla coda e dalla
  //   linguetta insieme — cioè il tasto di WhatsApp farebbe sparire un
  //   duplicato senza che nessuno l'abbia guardato.
  c("ma la domanda resta aperta", true, aspettaUnaDecisione({ data: scritto }));
  c("si segna chi ha scritto", "Marilù", ricaricoDi(scritto).whatsappDa);
  c("e quando", true, !!ricaricoDi(scritto).whatsappIl);
  c("lo stato non si muove", "appuntamento_fissato", scritto.stato);
  //  ⚠️ FINCHÉ NON LO CONFERMA UNA PERSONA È «APERTO», NON «MANDATO»: il tasto
  //   apre WhatsApp, non lo manda, e scrivere «mandato» sarebbe una bugia
  //   scritta in archivio.
  c("si legge nelle righe, e dice la verità", true,
    /WhatsApp aperto il/.test(righeRicarico(scritto).join(" ")));

  /*  ── IL CHECK E LA X ──────────────────────────────────────────────────
      Richiesta del committente: «quando clicco contatta su WhatsApp spostalo
      su contattati su WhatsApp, e lì posso cliccare un check se è stato
      contattato oppure una X se non ho inviato il messaggio».
      Fra il clic e il messaggio c'è una persona: può ripensarci, sbagliare
      chat, non trovare il numero. La scheda si sposta subito — il lavoro
      fatto si vede — ma resta in attesa di una conferma, e la conferma la dà
      una persona da lì. */
  const { patchWhatsappConfermato, patchWhatsappNonInviato, eWhatsappConfermato } = RIC;

  //  Il check: resta dov'è, ma adesso lo sappiamo per certo.
  const waConfermato = { ...scritto, ...patchWhatsappConfermato(scritto, "Marilù", OGGI) };
  c("waConfermato resta fra gli scritti", true, eContattatoWhatsApp({ data: waConfermato }));
  c("e risulta waConfermato", true, eWhatsappConfermato({ data: waConfermato }));
  c("con chi l'ha waConfermato", "Marilù", ricaricoDi(waConfermato).whatsappConfermatoDa);
  c("la domanda resta aperta: si aspetta la risposta", true, aspettaUnaDecisione({ data: waConfermato }));
  c("e le righe lo dicono", true, /Scritto su WhatsApp .*confermato/.test(righeRicarico(waConfermato).join(" ")));

  //  ⚠️ LA X È LA PROVA CHE CONTA: torna in coda com'era, e la data «gli
  //   abbiamo scritto» sparisce — perché è falsa. Se restasse, ogni elenco e
  //   ogni conteggio dovrebbero ricordarsi di guardarci accanto, e prima o poi
  //   uno se ne dimentica: quella persona resterebbe in un limbo senza che
  //   nessuno le scriva più.
  const waAnnullato = { ...scritto, ...patchWhatsappNonInviato(scritto, OGGI) };
  c("non mandato: esce dagli scritti", false, eContattatoWhatsApp({ data: waAnnullato }));
  c("e torna a chiedere adesso", true, eDaDecidere({ data: waAnnullato }));
  c("la data dello scritto sparisce", undefined, ricaricoDi(waAnnullato).whatsappIl);
  c("e resta la smentita, per la storia", true, !!ricaricoDi(waAnnullato).whatsappAnnullatoIl);
  c("che si legge nelle righe", true, /NON è stato mandato/.test(righeRicarico(waAnnullato).join(" ")));
  c("lo stato del lead non si muove", "appuntamento_fissato", waAnnullato.stato);

  //  Ci si può ricredere: dopo la X si riscrive, dopo il check si smentisce.
  const riscrittoDopoLaX = { ...waAnnullato, ...patchContattatoWhatsApp(waAnnullato, "Luca", OGGI) };
  c("dopo la X si può riscrivere", true, eContattatoWhatsApp({ data: riscrittoDopoLaX }));
  c("e non risulta waConfermato di nuovo da solo", false, eWhatsappConfermato({ data: riscrittoDopoLaX }));
  const smentitoDopoIlCheck = { ...waConfermato, ...patchWhatsappNonInviato(waConfermato, OGGI) };
  c("dopo il check si può smentire", false, eWhatsappConfermato({ data: smentitoDopoIlCheck }));
  c("e la conferma sparisce con lo scritto", undefined, ricaricoDi(smentitoDopoIlCheck).whatsappConfermatoIl);

  //  ⚠️ Niente ricarico, niente da confermare: i tasti non hanno nulla su cui
  //   scrivere e non devono inventarsi una riga.
  c("senza ricarico il check non scrive niente", undefined, patchWhatsappConfermato(scheda, "Marilù", OGGI).ricarico);
  c("e nemmeno la X", undefined, patchWhatsappNonInviato(scheda, OGGI).ricarico);
  //  E il check non si dà a chi non è mai stato scritto: sarebbe una conferma
  //  di un messaggio che nessuno ha nemmeno aperto.
  c("il check vuole uno scritto", undefined, patchWhatsappConfermato(daDecidere, "Marilù", OGGI).ricarico);

  //  ⚠️ Il messaggio vince sul rinvio: è più recente, e una scheda in due
  //   elenchi è una scheda che si decide due volte (o mai).
  const rimandatoPoiScritto = { ...rimandato, ...patchContattatoWhatsApp(rimandato, "Luca", OGGI) };
  c("chi era rimandato esce dai rimandati", false, eRimandato({ data: rimandatoPoiScritto }));
  c("e sta fra gli scritti", true, eContattatoWhatsApp({ data: rimandatoPoiScritto }));

  //  Riscrivendo, la data buona è l'ultima: è quella che dice da quanto si
  //  aspetta una risposta.
  const DOMANI = new Date("2026-09-25T10:00:00Z");
  const riscritto = { ...scritto, ...patchContattatoWhatsApp(scritto, "Marilù", DOMANI) };
  c("riscrivendo si aggiorna la data", DOMANI.toISOString(), ricaricoDi(riscritto).whatsappIl);

  //  ── E LE DUE DECISIONI LO CHIUDONO ──────────────────────────────────
  const chiusoDaLi = { ...scritto, ...patchConferma(scritto) };
  c("confermato da lì, esce dall'elenco", false, eContattatoWhatsApp({ data: chiusoDaLi }));
  c("e non chiede più niente", false, aspettaUnaDecisione({ data: chiusoDaLi }));
  const rimessoDaLi = { ...scritto, ...patchRimettiInCoda(scritto, OGGI) };
  c("rimesso da lì, esce dall'elenco", false, eContattatoWhatsApp({ data: rimessoDaLi }));
  c("ed è tornato da contattare", "da_contattare", rimessoDaLi.stato);
  //  Senza ricarico non c'è niente da segnare: il tasto non compare nemmeno.
  c("senza ricarico non si segna niente", 0, Object.keys(patchContattatoWhatsApp(scheda)).length);

  /*  ── IL MESSAGGIO PER RIFISSARE ──────────────────────────────────────
      ⚠️ Solo a chi un appuntamento ce l'aveva davvero: a chiunque altro
       racconterebbe una cosa mai successa. */
  c("gli stati buoni sono cinque", 5, STATI_DA_RIFISSARE.length);
  c("a chi non ha mai avuto un appuntamento non si nomina un giorno", false,
    daRifissare({ ...scheda, stato: "da_contattare" }));
  /*  ⚠️ MA IL MESSAGGIO SI SCRIVE LO STESSO — deciso dal committente: il
      contatto di ritorno lo si ricontatta anche se un appuntamento non l'ha
      mai avuto. Cambia la PRIMA RIGA, non il resto: a chi aveva una
      consulenza si nomina il giorno, agli altri si dice soltanto che ci
      eravamo già sentiti. Nominare una data a chi non ha mai preso un
      appuntamento sarebbe raccontargli una cosa mai successa. */
  const senzaAppuntamento = messaggioRifissa({ ...scheda, stato: "da_contattare" });
  c("ma un messaggio ce l'ha anche lui", true, senzaAppuntamento.length > 0);
  c("e non gli si nomina nessun giorno", false, /settembre|ottobre|gioved/i.test(senzaAppuntamento));
  /*  ⚠️ E GLI SI DICE DA DOVE ARRIVA IL SUO NUMERO. Richiesta del committente:
      «nel messaggio specifica che ha richiesto di essere ricontattato tramite
      il form online». È la riga che regge tutto il messaggio — chi legge non
      si ricorda di noi, e la prima domanda che si fa chiunque davanti a un
      numero sconosciuto è «questi come mi hanno trovato?». Prima si diceva
      solo «ci eravamo già sentiti», che a chi non ricorda non spiega niente. */
  c("gli si dice da dove arriva il suo numero", true,
    /modulo sul nostro sito/.test(senzaAppuntamento));
  c("a chi non si è presentato sì", true, daRifissare({ ...scheda, stato: "no_show" }));
  c("a chi è da riprogrammare sì", true, daRifissare({ ...scheda, stato: "da_spostare" }));

  /*  ⚠️ E ANCHE A CHI È STATO RIMESSO FRA I DA CONTATTARE: quel pulsante
      azzera lo stato, ma l'appuntamento mancato è successo lo stesso ed è
      proprio quello di cui gli si vuole scrivere. Senza `statoAllora` il
      messaggio sparirebbe esattamente per le schede rimesse in circolo. */
  c("e a chi è stato rimesso in coda, per lo stato di allora", true, daRifissare(rimesso));

  const passato = messaggioRifissa({ ...scheda, stato: "no_show" }, OGGI);
  c("il messaggio chiama per nome", true, /^Ciao Mario, /.test(passato));
  c("dice il giorno dell'appuntamento", true, /giovedì 10 settembre/.test(passato));
  c("e l'ora", true, /alle 15:00/.test(passato));
  c("dice che è saltata", true, /è saltata/.test(passato));
  //  Chi scrive si presenta: un messaggio da un numero sconosciuto che dà per
  //  scontato un rapporto è il modo più rapido per farsi bloccare.
  c("e chi scrive si presenta", true, /Hair Genius Labs/.test(passato));
  /*  ⚠️ E DICE CHE COSA FACCIAMO, in tutti e quattro. Richiesta del
      committente: «specifica nel messaggio sempre "per la soluzione non
      chirurgica contro la calvizie"». Chi ha compilato un modulo mesi fa si
      ricorda del problema, non del nome dell'azienda: un nome da solo lo
      obbliga a cercare chi siamo prima di decidere se rispondere. E «non
      chirurgica» è la prima obiezione di chi ha paura del trapianto, tolta
      dalla prima riga invece che da una frase in fondo. */
  for (const k of ["ritorno_sospeso", "ritorno_futuro", "ritorno_mai", "ritorno_fatta"])
    c(`«${k}» dice che cosa facciamo`, true,
      /soluzione non chirurgica contro la calvizie/.test(WA.MODELLI_ORIGINALI[k]));
  c("e chiede le sue disponibilità", true, /Dimmi le tue disponibilità/.test(passato));
  c("e dice che controlliamo noi in agenda", true, /controllo in agenda/.test(passato));
  /*  ⚠️ IL SEGNAPOSTO NON DEVE ARRIVARE AL CLIENTE. I modelli del CRM hanno
      «{nome}» e lo sostituisce chi li manda; questo esce già scritto, e una
      graffa in una chat è la figuraccia più facile da fare. */
  c("niente segnaposti nel testo", false, /[{}]/.test(passato));

  /*  ── ⚠️ IL MESSAGGIO SEGUE IL MOTIVO DEL RITORNO ────────────────────
      Richiesta del committente: «in base alla motivazione del ritorno deve
      mettere il messaggio corretto», e in particolare «se ho già fatto
      consulenza deve dire che l'abbiamo già fatta e se vuole altre info
      possiamo risentirci».
      Era il buco più grosso: a chi si era seduto un'ora con un consulente
      arrivava «la consulenza non l'abbiamo ancora fatta» — cioè la prova, in
      una riga, che dall'altra parte nessuno si ricorda di lui.
      ⚠️ CHI NON SI È PRESENTATO SONO SOLO GLI ASSENTI E I DA RIPROGRAMMARE
       («quelli che non si presentano sono solo quelli assenti o da spostare»,
       parole del committente), e lo dice `eStatoNonSvolta` — la stessa regola
       con cui il CRM conta le consulenze svolte della giornata. Tutto il
       resto, dopo una data passata, È una consulenza avvenuta. */
  const passatoFatto = (stato) => messaggioRifissa({ ...scheda, stato }, OGGI);
  for (const stato of ["da_ricontattare", "gestire_in_chat", "sta_valutando", "fatto", "venduto", "acconto"])
    c(`«${stato}»: gli si dice che l'abbiamo già fatta`, true,
      /l'abbiamo già fatta/.test(passatoFatto(stato)));
  c("e gli si offre di risentirsi, non di farla", true,
    /possiamo risentirci/.test(passatoFatto("da_ricontattare")));
  //  ⚠️ E niente ora per una cosa passata: «l'abbiamo già fatta giovedì 10
  //   settembre alle 15:00» suona come una convocazione.
  c("il giorno sì, l'ora no", true,
    /già fatta giovedì 10 settembre,/.test(passatoFatto("da_ricontattare")));

  //  I due che NON si sono presentati, e sono solo questi due.
  for (const stato of ["no_show", "non_fatto", "da_spostare"])
    c(`«${stato}»: gli si dice che è saltata`, true, /è saltata/.test(passatoFatto(stato)));
  //  ⚠️ La prova che tiene insieme le due righe qui sopra: a un assente non si
  //   dice «l'abbiamo già fatta», e a chi l'ha fatta non si dice «è saltata».
  c("a un assente non si dice che l'abbiamo fatta", false,
    /l'abbiamo già fatta/.test(passatoFatto("no_show")));
  c("e a chi l'ha fatta non si dice che è saltata", false,
    /è saltata/.test(passatoFatto("da_ricontattare")));

  //  L'appuntamento ancora davanti resta il suo caso, qualunque sia lo stato.
  const ancoraDavanti = messaggioRifissa(
    { ...scheda, stato: "appuntamento_fissato", dataMeeting: "2026-09-30", oraMeeting: "15:00" },
    OGGI,
  );
  c("chi ce l'ha davanti se lo sente confermare", true,
    /hai già una consulenza fissata/.test(ancoraDavanti));
  c("e non gli si dice né saltata né fatta", false, /è saltata|già fatta/.test(ancoraDavanti));

  //  ⚠️ E SI GUARDA LO STATO DI ALLORA: chi è stato rimesso fra i «da
  //   contattare» ha lo stato azzerato, ma la consulenza l'ha fatta lo stesso.
  const rimessoDopoLaConsulenza = {
    ...scheda,
    stato: "da_contattare",
    ricarico: { volte: 1, ultimo: OGGI.toISOString(), daDecidere: true, statoAllora: "da_ricontattare" },
  };
  c("rimesso in coda, ma la consulenza l'aveva fatta", true,
    /l'abbiamo già fatta/.test(messaggioRifissa(rimessoDopoLaConsulenza, OGGI)));

  /*  ── ⚠️ IL LINK DEI RISULTATI, E LA FIRMA ────────────────────────────
      Richiesta del committente: «allega il link dei nostri risultati, e fai
      anche una breve presentazione prima». Il link è una sola riga, scritta in
      un posto solo (`LINK_RISULTATI`): il giorno in cui la raccolta cambia si
      cambia lì e non dentro una frase. */
  c("allega la raccolta dei risultati", true, passato.includes(LINK_RISULTATI));
  /*  ── ⚠️ I TESTI SI MODIFICANO DAL PANNELLO ──────────────────────────
      Richiesta del committente: «fai che tutti i messaggi posso modificarli da
      una scheda nelle impostazioni». Da qui in avanti il testo NON sta più nel
      codice di `messaggioRifissa`: sta nei modelli, e un modello personalizzato
      deve vincere su quello di partenza — altrimenti il pannello scrive e il
      cliente riceve dell'altro. */
  const { impostaModelliPersonalizzati, modelloDi, componiMessaggio, MODELLI_ORIGINALI } = WA;
  c("i tre modelli di partenza esistono", true,
    !!MODELLI_ORIGINALI.ritorno_sospeso && !!MODELLI_ORIGINALI.ritorno_futuro &&
    !!MODELLI_ORIGINALI.ritorno_mai);
  /*  ⚠️ La prova si fa sul modulo dei messaggi e non su `messaggioRifissa`:
      nelle prove i due file sono impacchettati separatamente, quindi ognuno ha
      la SUA copia dei modelli personalizzati e una scritta di qua non si
      vedrebbe di là. Nel programma vero il modulo è uno solo. Quello che conta
      qui è la regola: un testo riscritto dal pannello vince su quello di
      partenza, e `messaggioRifissa` non fa altro che chiedere `modelloDi`. */
  impostaModelliPersonalizzati({ ritorno_sospeso: "Ciao {nome}, testo riscritto dal pannello." });
  c("il testo riscritto dal pannello vince",
    "Ciao Mario, testo riscritto dal pannello.",
    componiMessaggio(modelloDi("ritorno_sospeso"), { nome: "Mario" }));
  //  ⚠️ E non trascina gli altri due: si riscrive quello che si è riscritto.
  c("e gli altri due restano quelli di partenza", true,
    modelloDi("ritorno_mai").includes(LINK_RISULTATI));
  impostaModelliPersonalizzati({});
  c("e togliendolo si torna a quello di partenza", true,
    modelloDi("ritorno_sospeso").includes("è saltata"));
  c("ed è quella giusta", true, /media\/DPKW-3JHV-RC77/.test(LINK_RISULTATI));
  //  Il link sta su una riga sua: incollato in mezzo a una frase, WhatsApp lo
  //  attacca alla parola che segue e l'anteprima non parte.
  c("il link sta su una riga sua", true, passato.split("\n").includes(LINK_RISULTATI));
  /*  ⚠️ L'ORDINE SI È ROVESCIATO, ED È VOLUTO: «rendi breve ma che si
      capisce, non scrivere troppo testo». WhatsApp mostra le prime righe in
      anteprima e il resto lo apre chi è già interessato: con i risultati in
      mezzo, la domanda — l'unica cosa che chiede una risposta — finiva sotto
      il link, cioè dove si legge per ultima. Adesso: chi sono, cosa chiedo,
      e il link in fondo per chi vuole guardare. */
  c("la domanda viene prima del link", true,
    passato.indexOf("Dimmi giorno e ora") < passato.indexOf(LINK_RISULTATI));
  //  ⚠️ E resta corto: sopra i 500 caratteri WhatsApp lo taglia con «altro»,
  //   e un messaggio che va aperto per essere letto è un messaggio in meno.
  c("il messaggio resta corto", true, passato.length < 400);
  //  Anche a chi un appuntamento non l'ha mai avuto.
  c("il link c'è anche senza appuntamento", true, senzaAppuntamento.includes(LINK_RISULTATI));

  //  La firma è il consulente della SCHEDA: è la persona che quel cliente
  //  ricorda di aver sentito.
  const firmato = messaggioRifissa({ ...scheda, stato: "no_show" }, OGGI, "Filippo Cona");
  c("si firma col nome del consulente", true, /sono Filippo di Hair Genius Labs/.test(firmato));
  //  Solo il nome di battesimo: «sono Filippo Cona di…» in una chat suona come
  //  un modulo, non come una persona.
  c("e col solo nome di battesimo", false, /Filippo Cona di/.test(firmato));
  /*  ⚠️ SENZA IL NOME NON SI INVENTA NESSUNO, e non resta nemmeno un buco: il
      modello porta il testo di riserva (`{consulente|un consulente}`), che è
      il meccanismo già usato dagli altri messaggi della casa. Senza riserva
      sparirebbe l'INTERA prima riga — saluto e presentazione — perché
      `{consulente}` è un segnaposto facoltativo (vedi la regola 1 in
      crm/whatsapp). */
  c("senza consulente si scrive la riserva", true, /sono un consulente di Hair Genius Labs/.test(passato));
  c("e la prima riga non sparisce", true, /^Ciao Mario, /.test(passato));
  c("e non resta un «sono» a vuoto", false, /sono\s+di/.test(passato));
  //  ⚠️ E il segnaposto non arriva mai al cliente: né scritto, né a metà.
  c("niente graffe nemmeno senza consulente", false, /[{}]/.test(passato));

  /*  ⚠️ PASSATO E FUTURO NON SI RACCONTANO UGUALE. Fra i contatti di ritorno
      ci sono anche appuntamenti ancora da fare: scrivere «non siamo riusciti a
      farla» a chi ce l'ha fra tre giorni è una figuraccia, e capita davvero. */
  const futuro = messaggioRifissa({ ...scheda, dataMeeting: "2026-10-02" }, OGGI);
  c("all'appuntamento futuro non si dice che è saltato", false,
    /è saltata/.test(futuro));
  c("gli si chiede se gli va ancora bene", true, /Ti va ancora bene/.test(futuro));
  c("e se no, le sue disponibilità", true, /dimmi le tue disponibilità/i.test(futuro));
  c("e i risultati glieli si allegano lo stesso", true, futuro.includes(LINK_RISULTATI));

  //  Senza data non si inventa un giorno: si parla della consulenza e basta.
  const senzaData = messaggioRifissa({ ...scheda, dataMeeting: "", oraMeeting: "" }, OGGI);
  c("senza data, nessun giorno inventato", true, senzaData.length > 0);
  c("e nessuna «Invalid Date»", false, /Invalid|NaN|undefined/.test(senzaData));
  //  Senza nome il messaggio non comincia con una virgola sospesa.
  c("senza nome non resta la virgola", false,
    /^,/.test(messaggioRifissa({ ...scheda, nome: "", stato: "no_show" }, OGGI)));
}

/*  ═══════════════════════════════════════════════════════════════════════
    DI CHI È UNA COSA DA FARE
    ───────────────────────────────────────────────────────────────────────
    Segnalazione del committente: «da fare oggi, nella scheda ci sia filtro per
    setter e per consulenti — correggi perché ora mette tutto insieme».
    Il difetto vero non era l'assenza del filtro (in una delle due schermate
    c'era): era che non teneva conto di TUTTI. Chi sulla sua scheda non ha
    spuntato nessuno dei due mestieri non entrava in nessun mucchio e non aveva
    nemmeno una tessera sua — le sue cose da fare esistevano solo dentro
    l'elenco di tutti. E chi non ha mai spuntato niente veniva contato fra i
    consulenti per ripiego, cioè il filtro affermava una cosa che nessuno aveva
    mai detto.
    ═══════════════════════════════════════════════════════════════════════ */
function proveDiChi() {
  const { rigaDiChi, rigaPassaChi, contaDiChi, personeDelFiltro, mappaMestieri,
          CHI_SETTER, CHI_CONSULENTE, CHI_SENZA_MESTIERE, CHI_NESSUNO } = CHI;
  gruppo("DI CHI E' UNA COSA DA FARE");

  //  Le quattro situazioni vere del centro, prese dall'archivio di produzione:
  //  chi ha spuntato consulente, chi ha spuntato setter, chi ha spuntato
  //  ESPLICITAMENTE nessuno dei due, e chi non ha mai aperto la sua scheda.
  const squadra = mappaMestieri([
    { id: "filippo", data: { nome: "Filippo", faSetter: false, faConsulente: true } },
    { id: "marilu", data: { nome: "Marilù", faSetter: true, faConsulente: false } },
    { id: "luca", data: { nome: "Luca", faSetter: false, faConsulente: false } },
    { id: "ale", data: { nome: "Alessandro" } },
  ]);
  c("la squadra è di quattro", 4, squadra.size);
  c("chi ha spuntato consulente è dichiarato", true, squadra.get("filippo").dichiarato);
  c("chi non ha spuntato niente NON è dichiarato", false, squadra.get("ale").dichiarato);
  /*  ⚠️ E il ripiego lo dice consulente: è giusto che `mestieriDi` risponda
      qualcosa, ed è per questo che serve `dichiarato` — senza, «Consulenti»
      comprenderebbe chi non si sa cosa faccia. */
  c("ma il ripiego lo chiama consulente", true, squadra.get("ale").consulente);

  const riga = (id) => ({ id: `lead:${id}`, tipo: "ricontatto", lead: { id, data: { consulenteId: id } } });
  const righe = [riga("filippo"), riga("marilu"), riga("luca"), riga("ale"),
                 { id: "lead:x", tipo: "ricontatto", lead: { id: "x", data: {} } }];

  c("la riga sa di chi è", "marilu", rigaDiChi(riga("marilu")));
  c("e una scheda non assegnata non è di nessuno", "", rigaDiChi(righe[4]));

  //  ── I MUCCHI ────────────────────────────────────────────────────────
  const conti = contaDiChi(righe, squadra);
  c("le righe in tutto sono cinque", 5, conti.tutte);
  c("un setter dichiarato", 1, conti.setter);
  c("un consulente dichiarato", 1, conti.consulente);
  /*  ⚠️ LA PROVA DELLA SEGNALAZIONE: Luca (nessun mestiere spuntato) e
      Alessandro (scheda mai compilata) NON spariscono. Prima non stavano in
      nessuna casella: si vedevano solo dentro «tutte», mescolati — cioè
      «tutto insieme». */
  c("e due senza mestiere", 2, conti.senzaMestiere);
  c("più una scheda di nessuno", 1, conti.nessuno);
  //  I conti tornano: è quello che rende il filtro verificabile a occhio.
  c("i conti tornano", conti.tutte,
    conti.setter + conti.consulente + conti.senzaMestiere + conti.nessuno);

  //  ── IL FILTRO ───────────────────────────────────────────────────────
  const passano = (chi) => righe.filter((r) => rigaPassaChi(r, chi, squadra)).length;
  c("senza filtro passano tutte", 5, passano(""));
  c("«Setter» ne lascia una", 1, passano(CHI_SETTER));
  c("«Consulenti» ne lascia una", 1, passano(CHI_CONSULENTE));
  c("«Mestiere non indicato» ne lascia due", 2, passano(CHI_SENZA_MESTIERE));
  c("«Senza assegnazione» ne lascia una", 1, passano(CHI_NESSUNO));
  c("e per persona una sola", 1, passano("luca"));
  /*  ⚠️ Alessandro NON deve passare per «Consulenti»: il suo è un ripiego, e un
      filtro che lo conta afferma una cosa che nessuno ha mai detto. */
  c("il ripiego non entra fra i consulenti", false, rigaPassaChi(riga("ale"), CHI_CONSULENTE, squadra));
  c("ma sta fra i non indicati", true, rigaPassaChi(riga("ale"), CHI_SENZA_MESTIERE, squadra));
  //  Chi fa tutti e due i mestieri conta in tutti e due i mucchi.
  const doppio = mappaMestieri([{ id: "d", data: { nome: "Due", faSetter: true, faConsulente: true } }]);
  const contiDoppio = contaDiChi([riga("d")], doppio);
  c("chi fa due mestieri sta in due mucchi", true,
    contiDoppio.setter === 1 && contiDoppio.consulente === 1);
  c("ma la riga resta una", 1, contiDoppio.tutte);

  //  ── L'ELENCO DELLE PERSONE ──────────────────────────────────────────
  //   ⚠️ CI SONO TUTTI, anche chi non ha un mestiere: prima si scartavano, e
  //    una persona che manca dall'elenco non si può cercare.
  const persone = personeDelFiltro(squadra);
  c("nell'elenco ci sono tutti", 4, persone.length);
  c("compreso chi non ha mestiere", true, persone.some((p) => p.id === "luca"));
  c("in ordine alfabetico", "Alessandro", persone[0].nome);

  //  Una cosa scritta a mano è di chi l'ha scritta, non di un consulente.
  c("la nota è di chi l'ha scritta", "marilu",
    rigaDiChi({ id: "task:1", tipo: "task", task: { aId: "marilu", di: "Marilù" } }));
}

/*  ═══════════════════════════════════════════════════════════════════════
    RIAPRIRE UN PREVENTIVO COM'ERA
    ───────────────────────────────────────────────────────────────────────
    Segnalazione del committente: «se clicco modifica preventivo da dentro il
    preventivo, mi deve rimettere tutto settato come era prima, e non che
    riparte da capo».
    Il preventivo salvato non contiene gli id delle voci: contiene i NOMI, come
    il cliente li ha letti. Qui si prova il cammino inverso — e la prova che
    conta è quella sulla sotto-scelta, perché il nome salvato è «Mosso — onda
    media» e il trattino compare anche DENTRO i nomi veri.
    ═══════════════════════════════════════════════════════════════════════ */
function proveDellaRiapertura() {
  const { configurazioneDa } = RIA;
  const { buildMenu } = QMN;
  gruppo("RIAPRIRE UN PREVENTIVO COM'ERA");

  const menu = buildMenu({});
  const nomeDi = (id) => {
    for (const s of menu.sections) {
      const i = s.items.find((x) => x.id === id);
      if (i) return i.name;
    }
    return "";
  };

  //  Un preventivo vero: Invisible Derm, innesto rinforzato, capello europeo,
  //  forma mossa con l'onda media, simulazione e calibrazione.
  const salvato = {
    baseId: "invisible-derm",
    baseName: "Invisible Derm Protocol",
    items: [
      { name: nomeDi("base-hyper") },
      { name: nomeDi("hair-european") },
      { name: `${nomeDi("shape-mosso")} — onda media` },
      { name: menu.simulation.name },
      { name: menu.installation.name },
    ],
  };
  const conf = configurazioneDa(salvato, menu);

  c("torna la soluzione giusta", "invisible-derm", conf.baseId);
  c("e le voci scelte", true,
    conf.selected.includes("base-hyper") && conf.selected.includes("hair-european"));
  c("compresa la forma", true, conf.selected.includes("shape-mosso"));
  /*  ⚠️ LA PROVA CHE CONTA: la sotto-scelta. Il nome salvato è «Mosso — onda
      media», e il trattino compare anche DENTRO i nomi veri («Innesto
      rinforzato — la più duratura»): tagliare al primo trattino
      restituirebbe «la più duratura» come se fosse una sotto-scelta. */
  c("e l'intensità dell'onda", "onda-media", conf.varianti["shape-mosso"]);
  c("l'innesto non si porta dietro una falsa sotto-scelta", undefined,
    conf.varianti["base-hyper"]);
  c("la simulazione torna accesa", true, conf.simOn);
  c("e la calibrazione pure", true, conf.installOn);
  //  La simulazione e la calibrazione NON sono voci da spuntare nell'elenco:
  //  hanno i loro interruttori. Ritrovarsele lì dentro vorrebbe dire contarle
  //  due volte nel totale.
  c("e nessuna delle due finisce fra le voci", false,
    conf.selected.includes("simulation") || conf.selected.includes("installation"));
  c("niente voci perse", 0, conf.perse.length);

  //  ── QUELLO CHE NON C'È PIÙ SI DICE ──────────────────────────────────
  //   Una voce tolta dal listino non può tornare: chi riapre deve saperlo,
  //   invece di scoprirlo dal totale davanti al cliente.
  const conFantasma = configurazioneDa(
    { ...salvato, items: [...salvato.items, { name: "Trattamento che non esiste più" }] },
    menu,
  );
  c("la voce sparita si segnala", 1, conFantasma.perse.length);
  c("e si dice quale", true, /non esiste più/.test(conFantasma.perse[0]));
  c("ma il resto torna lo stesso", true, conFantasma.selected.includes("base-hyper"));

  //  ── LE RIGHE VECCHIE, SENZA L'ID DELLA SOLUZIONE ────────────────────
  //   Prima che lo si scrivesse nel riepilogo c'era solo il nome: deve bastare.
  c("senza id vale il nome", "patch-standard",
    configurazioneDa({ baseName: "Patch Cutanea", items: [] }, menu).baseId);
  //  E se non si riconosce nemmeno il nome non si resta senza soluzione: una
  //  pagina senza base non si disegna affatto.
  c("con un nome sconosciuto si ripiega sulla prima", menu.base[0].id,
    configurazioneDa({ baseName: "Soluzione di dieci anni fa", items: [] }, menu).baseId);
  c("e un preventivo senza voci non rompe niente", 0,
    configurazioneDa({ baseId: "patch-standard" }, menu).selected.length);

  /*  ── DOVE SI FA L'INSTALLAZIONE ──────────────────────────────────────
      Segnalazione del committente: «fai che il luogo dell'installazione si
      salvi e torni». Il posto viaggia dentro la voce, ed è la sua casa
      naturale: è una proprietà dell'installazione, non del preventivo. */
  c("senza indicazione vale il centro", "studio", conf.installLoc);
  const aCasa = configurazioneDa(
    { ...salvato, items: [{ name: menu.installation.name, dove: "home" }] },
    menu,
  );
  c("a casa sua torna a casa sua", "home", aCasa.installLoc);
  c("e l'installazione resta accesa", true, aCasa.installOn);
  const alCentro = configurazioneDa(
    { ...salvato, items: [{ name: menu.installation.name, dove: "studio" }] },
    menu,
  );
  c("nel centro torna nel centro", "studio", alCentro.installLoc);
  //  ⚠️ In una colonna JSON può esserci finito qualunque cosa: un posto
  //   inventato non deve mandare la scheda su un pulsante che non esiste.
  const storto = configurazioneDa(
    { ...salvato, items: [{ name: menu.installation.name, dove: "sulla luna" }] },
    menu,
  );
  c("un posto inventato non passa", "studio", storto.installLoc);
  //  E senza installazione il posto non si inventa: resta quello di partenza.
  c("niente installazione, niente posto", "studio",
    configurazioneDa({ ...salvato, items: [] }, menu).installLoc);
  c("e l'installazione risulta spenta", false,
    configurazioneDa({ ...salvato, items: [] }, menu).installOn);
}

/*  ═══════════════════════════════════════════════════════════════════════
    DUPLICARE UN PREVENTIVO
    ───────────────────────────────────────────────────────────────────────
    Richiesta del committente: «fai che un preventivo posso duplicarlo dalla
    lista preventivi con un pulsante».
    Le prove qui sotto guardano soprattutto quello che NON si copia: numero,
    data, stato e percorso. Copiare il numero vorrebbe dire due documenti che
    per il link del cliente, per la causale del bonifico e per la fattura sono
    lo stesso documento; copiare la data farebbe nascere un preventivo già
    scaduto, cioè esattamente quello che si sta rifacendo.
    ═══════════════════════════════════════════════════════════════════════ */
function proveDelDuplicato() {
  const { rigaDuplicata, spiegazioneDuplicato } = DUP;
  gruppo("DUPLICARE UN PREVENTIVO");

  const q = {
    id: "riga-1",
    created_at: "2026-08-01T10:00:00Z",
    quote_ref: "IDW5KL7",
    nome: "Mario", cognome: "Rossi", email: "m@r.it", telefono: "+393331234567",
    eta: 45, grey_pct: 30, color_code: "4/0", problemi: "nessuno", note: "richiamato il 3",
    base_choice: "Invisible Derm Protocol",
    base_system: { id: "invisible-derm", name: "Invisible Derm Protocol", price: 589 },
    upsells: [{ name: "Innesto rinforzato — la più duratura", price: 164.67 }],
    discount_code: "VIDEO50", discount_eur: 50, total: 1392,
    qty: 2, fitting_mode: "sede",
    status: "confermato",
    timeline_start: "2026-08-02", timeline_steps: { selfie: true, colore: true },
  };
  const copia = rigaDuplicata(q);

  //  ── QUELLO CHE SI PORTA DIETRO: l'offerta, tutta ────────────────────
  c("stesso cliente", "Mario", copia.nome);
  c("stesso telefono", "+393331234567", copia.telefono);
  c("stessa soluzione", "Invisible Derm Protocol", copia.base_choice);
  c("con il suo id, per poterlo riaprire com'era", "invisible-derm", copia.base_system.id);
  c("stesse voci", 1, copia.upsells.length);
  c("stessa quantità", 2, copia.qty);
  c("stesso modo di analisi", "sede", copia.fitting_mode);
  c("stesso sconto", "VIDEO50", copia.discount_code);
  c("e stesso totale", 1392, copia.total);
  c("anche le note interne", "richiamato il 3", copia.note);

  //  ── QUELLO CHE NON SI COPIA, ED È IL PUNTO ──────────────────────────
  c("il numero NON si copia", undefined, copia.quote_ref);
  c("la data di creazione nemmeno", undefined, copia.created_at);
  c("né l'id della riga", undefined, copia.id);
  c("lo stato riparte da «nuovo»", "nuovo", copia.status);
  c("il percorso non si porta dietro le tappe", undefined, copia.timeline_steps);
  c("né la sua data d'inizio", undefined, copia.timeline_start);

  //  Un preventivo senza niente dentro non deve far esplodere la copia.
  const vuota = rigaDuplicata({});
  c("una riga vuota si copia lo stesso", "nuovo", vuota.status);
  c("con la quantità a uno", 1, vuota.qty);
  c("l'analisi da remoto", "remoto", vuota.fitting_mode);
  c("e senza soluzione inventata", undefined, vuota.base_system);

  //  ── E SI DICE COSA È CAMBIATO ───────────────────────────────────────
  //   Il duplicato di un preventivo confermato risulta «nuovo»: se non lo si
  //   dice sembra un errore del programma.
  const detto = spiegazioneDuplicato(q);
  c("si dice che il numero è nuovo", true, /numero nuovo/.test(detto));
  c("e la scadenza pure", true, /scadenza nuova/.test(detto));
  c("si avvisa del cambio di stato", true, /nuovo»/.test(detto));
  c("e del percorso da rifare", true, /percorso da rifare/.test(detto));
  //  Su un preventivo che era già «nuovo» e senza tappe non si dice altro.
  const semplice = spiegazioneDuplicato({ status: "nuovo" });
  c("su un preventivo nuovo non si dice altro", false, /stato|percorso/.test(semplice));
}

/*  ═══════════════════════════════════════════════════════════════════════
    QUALCUNO BUSSA: È NUOVO O È SEMPRE LUI?
    ───────────────────────────────────────────────────────────────────────
    Segnalazione del committente: «le persone ospiti sentono un suono come un
    campanello ogni 5 secondi».
    Chi aspetta in sala d'attesa ribussa da solo ogni quattro secondi — serve,
    perché il consulente può arrivare dopo di lui. La campana però deve suonare
    SOLO la prima volta: il riconoscimento si faceva sul codice del
    dispositivo, e quando quel codice manca (iPhone in navigazione privata,
    archiviazione del sito bloccata) non riconosceva più nessuno. Ogni bussata
    risultava nuova, la campana suonava, e il cliente — che i suoni del
    consulente se li sente rigenerare sul proprio telefono — sentiva un
    campanello ogni quattro secondi. Ad annunciare sé stesso.
    ═══════════════════════════════════════════════════════════════════════ */
/** ── UNA CONSULENZA APERTA RESTA APERTA ────────────────────────────────────
 *  Segnalazione del committente: «fai che quando entrano le persone funziona;
 *  ora quando la gente entra non li ammette».
 *  Misurato in produzione locale: consulenza avviata, il consulente passa al
 *  CRM, la scheda si ricarica → il battito si ferma, e sei minuti dopo la riga
 *  del server diceva ancora `live: true` ma `callActive: false`. Da lì il
 *  cliente leggeva «In attesa che il consulente avvii la sessione» e non poteva
 *  nemmeno BUSSARE: nessuna richiesta arrivava, e non c'era niente da accettare.
 *  Qui si fissa quando una postazione si riprende la consulenza che è sua. */
/** ── LE CAMERE, QUADRATE E GRANDI QUANTO SI PUÒ ────────────────────────────
 *  Richiesta del committente: «il layout della videochiamata sia quadrato, sia
 *  per gli ospiti che per il presentatore, e che occupi più spazio possibile».
 *  Prima ogni riquadro prendeva la forma della sua camera: due forme opposte
 *  (telefono 9:16 e computer 16:9) non si incastrano, e sullo schermo restava
 *  una striscia, un rettangolo basso e metà sfondo vuoto. */
function proveDellaGrigliaCamere() {
  const { disposizioneQuadrata } = GRC;
  gruppo("LE CAMERE QUADRATE");

  //  ── TELEFONO IN VERTICALE, DUE PERSONE ──────────────────────────────
  //   È la schermata della segnalazione: due quadrati impilati che riempiono
  //   l'altezza. (390−0)/1 = 390 di larghezza, (700−6)/2 = 347 di altezza:
  //   vince il vincolo dell'altezza.
  const tel = disposizioneQuadrata(2, 390, 700);
  c("telefono: una colonna", 1, tel.colonne);
  c("telefono: due righe", 2, tel.righe);
  c("telefono: il lato lo detta l'altezza", 347, Math.round(tel.lato));

  //  ── MONITOR LARGO, DUE PERSONE ──────────────────────────────────────
  //   Due quadrati affiancati: (2000−6)/2 = 997, contro 1240 di altezza.
  const desk = disposizioneQuadrata(2, 2000, 1240);
  c("monitor: due colonne", 2, desk.colonne);
  c("monitor: una riga", 1, desk.righe);
  c("monitor: il lato lo detta la larghezza", 997, Math.round(desk.lato));

  //  ── UNO SOLO PRENDE TUTTO IL LATO CORTO ─────────────────────────────
  c("una persona sola, schermo alto", 390, Math.round(disposizioneQuadrata(1, 390, 700).lato));
  c("una persona sola, schermo largo", 600, Math.round(disposizioneQuadrata(1, 900, 600).lato));

  //  ── IN TRE E IN QUATTRO ─────────────────────────────────────────────
  /*  In tre su 1200×800 non vincono tre colonne affiancate (lato 396) ma due
      colonne su due righe (lato 397): l'ultima riga ha una camera sola, in
      mezzo. Un punto di differenza, ma la regola è sempre la stessa — vince il
      quadrato più grande — e non si fa un'eccezione per l'estetica. */
  const tre = disposizioneQuadrata(3, 1200, 800);
  c("in tre su schermo largo: due colonne", 2, tre.colonne);
  c("in tre: il quadrato più grande possibile", 397, Math.round(tre.lato));
  const quattro = disposizioneQuadrata(4, 1000, 1000);
  c("in quattro su schermo quadro: 2×2", 2, quattro.colonne);
  c("…e due righe", 2, quattro.righe);
  c("in quattro: lato = metà meno lo spazio", 497, Math.round(quattro.lato));
  //  Colonna stretta del presentatore: in tre restano impilati.
  c("colonna stretta: una colonna sola", 1, disposizioneQuadrata(3, 300, 1000).colonne);

  //  ── LA DISPOSIZIONE NON DEVE BALLARE ────────────────────────────────
  /*  ⚠️ A parità di lato vince la disposizione con MENO colonne: senza questa
      soglia un arrotondamento faceva cambiare griglia a ogni ridisegno, e le
      camere si spostavano da sole mentre si parlava. */
  const pari = disposizioneQuadrata(2, 1000, 2006);
  c("a parità di lato vince meno colonne", 1, pari.colonne);

  //  ── QUANDO NON SI SA ANCORA QUANTO SPAZIO C'È ───────────────────────
  //   Area non misurata: lato 0 = «non lo so», e chi disegna si allarga da sé.
  c("area non misurata: lato zero", 0, disposizioneQuadrata(2, 0, 0).lato);
  c("area non misurata: una colonna", 1, disposizioneQuadrata(2, 0, 0).colonne);
  c("nessuna camera: non si divide niente", 0, disposizioneQuadrata(0, 400, 400).lato);
  //  Area microscopica: mai un lato negativo (sarebbe una misura impossibile).
  c("area più piccola dello spazio: mai negativo", 0, disposizioneQuadrata(3, 4, 4).lato);
}

/** ── QUANDO LA CAMERA NON SI APRE ──────────────────────────────────────────
 *  Segnalazione del committente: «la camera del presentatore sul dispositivo
 *  dell'ospite non funziona più».
 *  La camera si chiedeva con `deviceId: { exact: … }`, cioè «quella e nessun
 *  altra»: se la webcam scelta non c'è più il browser non ripiega, dà errore —
 *  e l'errore cadeva in un `catch` muto. Peggio: camera e microfono si chiedono
 *  insieme, quindi una webcam scollegata portava via anche la voce. */
function proveDellAperturaCamera() {
  const { tentativiMedia, spiegaErroreMedia, esitoApertura } = APC;
  gruppo("QUANDO LA CAMERA NON SI APRE");

  const video = { width: { ideal: 1280 } };
  const audio = { echoCancellation: true };

  //  ── NESSUN DISPOSITIVO SCELTO A MANO ────────────────────────────────
  //   Due gradini soli: tutto, e poi la sola voce. Un gradino «senza i
  //   dispositivi scelti» sarebbe identico al primo.
  const semplice = tentativiMedia({ video, audio });
  c("senza scelte: due gradini", 2, semplice.length);
  c("il primo chiede tutto", "niente", semplice[0].rinuncia);
  c("nessun deviceId nel primo", undefined, semplice[0].video.deviceId);
  c("l'ultimo è la sola voce", false, semplice[1].video);
  c("…e l'audio resta", true, !!semplice[1].audio);

  //  ── CON LA CAMERA SCELTA A MANO ─────────────────────────────────────
  const conCam = tentativiMedia({ video, audio, camId: "CAM-1" });
  c("con camera scelta: tre gradini", 3, conCam.length);
  c("il primo chiede QUELLA camera", "CAM-1", conCam[0].video.deviceId.exact);
  c("il secondo la lascia cadere", undefined, conCam[1].video.deviceId);
  c("…e se la dimentica", "camera", conCam[1].scorda.join(","));
  c("il terzo è la sola voce", false, conCam[2].video);

  /*  ⚠️ PRIMA SI MOLLA LA CAMERA, POI IL MICROFONO: nove volte su dieci a
      mancare è la webcam, e buttare subito anche il microfono scelto a mano
      farebbe perdere un'impostazione che funzionava. */
  const due = tentativiMedia({ video, audio, camId: "CAM-1", micId: "MIC-1" });
  c("camera + microfono scelti: quattro gradini", 4, due.length);
  c("il primo chiede tutti e due", "CAM-1|MIC-1", `${due[0].video.deviceId.exact}|${due[0].audio.deviceId.exact}`);
  c("il secondo molla solo la camera", "MIC-1", due[1].audio.deviceId.exact);
  c("…e il microfono resta scelto", undefined, due[1].video.deviceId);
  c("il terzo molla anche il microfono", undefined, due[2].audio.deviceId);
  c("…e li dimentica entrambi", "camera,microfono", due[2].scorda.join(","));

  //  ── IL MICROFONO SCELTO NON C'ENTRA CON UNA RICHIESTA DI SOLO VIDEO ──
  const soloVideo = tentativiMedia({ video, audio: false, camId: "CAM-1", micId: "MIC-1" });
  c("solo video: due gradini", 2, soloVideo.length);
  c("solo video: niente gradino «sola voce»", "dispositivi-scelti", soloVideo[1].rinuncia);
  c("solo video: non si tocca il microfono", "camera", soloVideo[1].scorda.join(","));

  //  ── LE FRASI: DEVONO DIRE A CHI TOCCA ───────────────────────────────
  c("permesso negato", true, /permesso/i.test(spiegaErroreMedia({ name: "NotAllowedError" })));
  c("nessuna camera collegata", true, /nessuna camera/i.test(spiegaErroreMedia({ name: "NotFoundError" })));
  c("camera occupata da un'altra app", true, /occupata/i.test(spiegaErroreMedia({ name: "NotReadableError" })));
  c("la camera scelta non c'è più", true, /non è più collegata/i.test(spiegaErroreMedia({ name: "OverconstrainedError" })));
  c("errore sconosciuto: si dice comunque qualcosa", true, spiegaErroreMedia(null).length > 10);

  //  ── E CHE COSA SI DICE DOPO ─────────────────────────────────────────
  c("tutto riuscito: non si dice niente", "", esitoApertura({ rinuncia: "niente" }));
  c("ripiegati sui dispositivi di serie", true, /di serie/i.test(esitoApertura({ rinuncia: "dispositivi-scelti" })));
  c("sola voce: lo dice, e dice perché", true,
    /sola voce/i.test(esitoApertura({ rinuncia: "video", errore: { name: "NotReadableError" } }))
    && /occupata/i.test(esitoApertura({ rinuncia: "video", errore: { name: "NotReadableError" } })));
}

/** ── L'ACCONTO, E LA GARANZIA CHE SI PUÒ TOGLIERE ──────────────────────────
 *  Tre richieste del committente, dalla stessa schermata:
 *   · «quando cambio il prezzo della garanzia 15 mesi non si cambia»;
 *   · «fai che posso disattivare questa garanzia dal preventivo»;
 *   · «fai che posso cambiare anche l'importo dell'acconto».
 *  Qui si fissano le tre regole: che cosa di un listino riletto si applica a
 *  preventivo già fatto, quanto vale l'acconto, e che la garanzia è una parte
 *  spegnibile della pagina come le altre. */
/** ── LE CONDIZIONI CON CUI UN PREVENTIVO È NATO ────────────────────────────
 *  Richiesta del committente: «se un preventivo lo faccio con le opzioni
 *  accese o con determinati prezzi rimangono quei prezzi e quelle
 *  impostazioni, a meno che non faccia modifica preventivo e allora si
 *  aggiorna con le nuove condizioni» — e «se faccio modifica preventivo,
 *  riseleziona tutte le opzioni che avevo selezionato».
 *  Il documento consegnato non cambia da solo: il listino di quel momento
 *  viaggia con lui, insieme alle scelte fatte, per ID. */
/** ── IL NUMERO DEL PREVENTIVO E LA CAUSALE DEL BONIFICO ────────────────────
 *  Richiesta del committente: «fai che posso cambiare l'ID del preventivo e la
 *  causale del preventivo».
 *  Sono la stessa cosa vista da due parti: il numero è come il documento si
 *  chiama, la causale è come lo chiama il cliente quando paga — e la seconda
 *  cita il primo. Per questo la causale si salva come MODELLO: un preventivo
 *  rinumerato continua a citare il numero giusto. */
/** ── LE REGISTRAZIONI DI QUESTO CLIENTE ────────────────────────────────────
 *  Segnalazione del committente: «ora non salva le registrazioni delle
 *  consulenze dentro al CRM».
 *  Si salvavano: in archivio (26/09) c'erano dodici schede e i video nella
 *  Storage, l'ultimo di quel giorno. Mancava il FILO per ritrovarle dal CRM —
 *  l'unico era il numero dell'ultimo preventivo creato in quel browser, e
 *  quattro delle ultime sei consulenze non avevano nessun preventivo. */
function proveDelleRegistrazioni() {
  const { registrazioniDelLead, durataLeggibile } = RDL;
  gruppo("LE REGISTRAZIONI DI UN CLIENTE");

  const archivio = [
    { id: "a", url: "u/a", date: "2026-09-26T15:26:00Z", duration: 114, leadId: "lead-1", quoteRef: "IDJ5CRZ" },
    { id: "b", url: "u/b", date: "2026-09-23T12:24:00Z", duration: 12, leadId: "lead-1" },
    { id: "c", url: "u/c", date: "2026-09-22T13:21:00Z", duration: 30 },
    { id: "d", url: "u/d", date: "2026-09-20T17:13:00Z", duration: 54, quoteRef: "IDQY6EF" },
    { id: "e", url: "u/e", date: "2026-09-07T21:42:00Z", duration: 120, leadId: "lead-2", quoteRef: "IDP5901" },
  ];

  //  ── IL FILO NUOVO: IL CLIENTE ───────────────────────────────────────
  //   È il caso che prima non esisteva: consulenza senza preventivo.
  const sue = registrazioniDelLead(archivio, { leadId: "lead-1", quoteRefs: [] });
  c("le sue sono due", 2, sue.length);
  c("anche quella senza preventivo", true, sue.some((r) => r.id === "b"));
  c("e il filo si sa qual è", "lead", sue[0].filo);

  //  ── IL FILO VECCHIO: IL PREVENTIVO ──────────────────────────────────
  //   Le registrazioni di prima non hanno il cliente scritto dentro: si
  //   ritrovano dal numero del preventivo, che è suo.
  const conRif = registrazioniDelLead(archivio, { leadId: "", quoteRefs: ["IDQY6EF"] });
  c("si ritrova dal preventivo", 1, conRif.length);
  c("…e si dice da dove arriva", "preventivo", conRif[0].filo);
  c("il numero non è sensibile alle maiuscole", 1,
    registrazioniDelLead(archivio, { quoteRefs: ["idqy6ef"] }).length);

  //  ── I DUE FILI INSIEME, SENZA DOPPIONI ──────────────────────────────
  const tutti = registrazioniDelLead(archivio, { leadId: "lead-1", quoteRefs: ["IDJ5CRZ", "IDQY6EF"] });
  c("due fili, tre registrazioni", 3, tutti.length);
  c("nessun doppione", 3, new Set(tutti.map((r) => r.id)).size);
  //  La più recente in cima: chi apre la scheda cerca quasi sempre l'ultima.
  c("la più recente per prima", "a", tutti[0].id);

  /*  ⚠️ NON SI INDOVINA PER NOME: in consulenza il cliente scrive quello che
      vuole, e far comparire il video di una persona nella scheda di un'altra è
      un danno che non si ripara. Chi non ha nessuno dei due fili resta fuori. */
  c("quella di nessuno resta fuori", false, tutti.some((r) => r.id === "c"));
  c("…e quella di un altro cliente pure", false, tutti.some((r) => r.id === "e"));
  c("senza fili non torna niente", 0, registrazioniDelLead(archivio, {}).length);

  //  ── DIFESE ──────────────────────────────────────────────────────────
  c("un elenco vuoto non rompe", 0, registrazioniDelLead([], { leadId: "lead-1" }).length);
  //  Una riga senza indirizzo non è una registrazione: aprirla darebbe una
  //  scheda vuota al consulente davanti al cliente.
  c("senza indirizzo non si mostra", 0,
    registrazioniDelLead([{ id: "x", url: "", date: "2026-01-01", duration: 1, leadId: "lead-1" }], { leadId: "lead-1" }).length);
  //  Una data illeggibile va in fondo invece di far saltare l'ordine.
  const storte = registrazioniDelLead(
    [{ id: "z", url: "u/z", date: "domani", duration: 1, leadId: "lead-1" }, archivio[0]],
    { leadId: "lead-1" },
  );
  c("la data illeggibile non scompagina", "a", storte[0].id);

  //  ── QUANTO È DURATA, COME SI DICE A VOCE ────────────────────────────
  c("meno di un minuto", "40 s", durataLeggibile(40));
  c("i minuti", "4 min", durataLeggibile(230));
  c("l'ora e i minuti", "1 h 12 min", durataLeggibile(72 * 60));
  c("l'ora tonda", "2 h", durataLeggibile(120 * 60));
  c("un valore assurdo non stampa numeri assurdi", "0 s", durataLeggibile(-5));
}

/** ── LA SALA D'ATTESA CHE NON DIPENDE DAL CANALE ───────────────────────────
 *  Segnalazione del committente: «quando una persona entra rimane in attesa e
 *  non entra mai».
 *  La porta d'ingresso viveva solo sul canale in tempo reale e nella memoria
 *  della scheda del consulente: bastava che uno dei due capi tacesse — canale
 *  caduto, telefono che mette in pausa la scheda, pagina ricaricata — perché il
 *  cliente restasse fuori per sempre. Adesso bussata e via libera passano anche
 *  dal server, e queste sono le regole di quella lista. */
/** ── QUALE PREVENTIVO CITA LA FATTURA ──────────────────────────────────────
 *  Misurato in archivio: su 71 preventivi solo 19 hanno il legame dichiarato
 *  sulla scheda, e la finestra della fattura guardava SOLO quel campo — tre
 *  fatture su quattro uscivano senza il numero del preventivo, cioè senza il
 *  filo che lega il bonifico del cliente al documento. */
function proveDelPreventivoCitato() {
  const { preventivoDaCitare } = PDT;
  gruppo("QUALE PREVENTIVO CITA LA FATTURA");

  const scheda = (extra = {}) => ({ id: "L1", data: { telefono: "+39 331 260 6318", ...extra } });
  const p = (ref, giorno, extra = {}) => ({
    quote_ref: ref, telefono: "331 2606318", created_at: `2026-09-${giorno}T10:00:00Z`, ...extra,
  });

  //  ── IL LEGAME DICHIARATO COMANDA ────────────────────────────────────
  const conRif = preventivoDaCitare(scheda({ quoteRef: "IDVECCHIO" }), [p("IDNUOVO", 20), p("IDVECCHIO", 10)]);
  c("se la scheda lo dichiara, si cita quello", "IDVECCHIO", conRif.q.quote_ref);
  c("…e si sa che è un legame certo", "riferimento", conRif.via);

  //  ── ALTRIMENTI IL TELEFONO ──────────────────────────────────────────
  const perTel = preventivoDaCitare(scheda(), [p("IDVECCHIO", 10), p("IDNUOVO", 20)]);
  c("senza riferimento si cita il più recente dello stesso numero", "IDNUOVO", perTel.q.quote_ref);
  //  ⚠️ E si dice che è un'IPOTESI: su un numero di famiglia può essere il
  //   preventivo del figlio, e chi emette la fattura deve poterlo vedere.
  c("…dichiarandolo un aggancio per telefono", "telefono", perTel.via);
  c("…e dicendo quanti sono, per poter scegliere", 2, perTel.quanti);

  /*  ⚠️ I SOSTITUITI SI SCARTANO: un preventivo rifatto non è più il documento
      di quella trattativa, e citarlo manderebbe il cliente a un prezzo che non
      vale più. */
  const conSostituito = preventivoDaCitare(scheda(), [p("IDRIFATTO", 21, { status: "sostituito" }), p("IDVALIDO", 20)]);
  c("un preventivo sostituito non si cita", "IDVALIDO", conSostituito.q.quote_ref);
  //  …ma se ci sono solo quelli, meglio un numero vecchio che nessun numero.
  const soloSostituiti = preventivoDaCitare(scheda(), [p("IDA", 19, { status: "sostituito" }), p("IDB", 21, { status: "sostituito" })]);
  c("se ci sono solo sostituiti si prende il più recente", "IDB", soloSostituiti.q.quote_ref);

  //  ── QUANDO NON SI SA, NON SI INVENTA ────────────────────────────────
  c("nessun preventivo, nessuna citazione", null, preventivoDaCitare(scheda(), []));
  c("numero di un altro: non si cita", null, preventivoDaCitare(scheda({ telefono: "333 1112223" }), [p("IDX", 20)]));
  //  ⚠️ Poche cifre non bastano: con quattro in comune si attribuirebbe a
  //   questo cliente mezzo archivio.
  c("un telefono troppo corto non aggancia niente", null,
    preventivoDaCitare({ id: "L2", data: { telefono: "318" } }, [p("IDX", 20)]));
  //  Il riferimento dichiarato che punta a un preventivo cancellato non blocca
  //  tutto: si ripiega sul telefono, che è meglio di niente.
  const rifMorto = preventivoDaCitare(scheda({ quoteRef: "IDSPARITO" }), [p("IDVIVO", 20)]);
  c("un riferimento a un preventivo sparito ripiega sul telefono", "IDVIVO", rifMorto.q.quote_ref);
}

/** ── PIÙ PERSONE NELLA STESSA CONSULENZA ───────────────────────────────────
 *  Richiesta del committente: «gli slot dove aggiungo più persone in un'unica
 *  consulenza, il link lo genera uguale per tutti e 3 e tutti e 3 hanno
 *  accesso» — e «se entra solo 1 rimane così com'è».
 *  Tre persone nella stessa ora oggi sono tre lead, quindi erano tre stanze e
 *  tre link: il consulente ne conduceva una e gli altri due aspettavano in una
 *  stanza vuota. */
/** ── LA PRECEDENZA DEL SUO PREVENTIVO ─────────────────────────────────────
 *  Seconda segnalazione sulla stessa cosa: «se passo ai media, al cliente con
 *  il preventivo attivo passa ai media uguale». La regola era giusta, ma stava
 *  dentro una schermata che si smontava a ogni velo — e cadeva. Da qui nasce
 *  l'avviso: chi disegna non la tiene, la ASCOLTA. */
/** ── LA SCHEDA RIMASTA A IERI ─────────────────────────────────────────────
 *  Quattro segnalazioni di fila sulla stessa cosa, e all'ultimo giro la causa
 *  era che il dispositivo del cliente girava col codice di prima. Qui si prova
 *  il modo in cui se ne accorge da solo. */
/** ── IL DISEGNO DELLA REGISTRAZIONE ───────────────────────────────────────
 *  Questa è la prova che avrebbe risparmiato al committente giorni di «Chrome
 *  dice non risponde»: il disegno accodava un fotogramma nuovo a OGNI
 *  chiamata, e siccome lo chiamava anche un orologio ogni 250 ms, ogni giro
 *  dell'orologio faceva nascere una catena che si rialimentava da sola.
 *  Qui l'orologio si fa girare a mano, e si conta. */
function proveDellaTela() {
  const { avviaTela } = TELA;
  gruppo("IL DISEGNO DELLA REGISTRAZIONE");
  //  Un browser finto: le richieste di fotogramma e l'orologio si fanno
  //  scattare a mano, così si vede esattamente quante catene restano vive.
  const finto = () => {
    const raf = new Map();
    const timer = new Map();
    let id = 0;
    return {
      o: {
        rAF: (cb) => { raf.set(++id, cb); return id; },
        annullaRAF: (i) => { raf.delete(i); },
        ogni: (cb, ms) => { timer.set(++id, { cb, ms }); return id; },
        fermaOgni: (i) => { timer.delete(i); },
      },
      fotogramma: () => { const c = [...raf.entries()]; raf.clear(); for (const [, cb] of c) cb(); },
      scattaOrologio: () => { for (const { cb } of [...timer.values()]) cb(); },
      inCoda: () => raf.size,
      orologi: () => timer.size,
    };
  };

  const f = finto();
  let disegni = 0;
  const m = avviaTela(() => { disegni++; }, f.o, 250);
  c("parte disegnando subito", 1, disegni);
  c("e con una catena sola", 1, f.inCoda());
  //  ⚠️ IL CUORE: l'orologio disegna, ma non accoda NIENTE.
  f.scattaOrologio(); f.scattaOrologio(); f.scattaOrologio();
  c("l'orologio disegna", 4, disegni);
  c("ma non accoda catene", 1, f.inCoda());
  //  Dieci fotogrammi del browser, intervallati dall'orologio: la coda resta
  //  di uno. Col codice di prima qui ce ne sarebbero state quattordici.
  for (let i = 0; i < 10; i++) { f.fotogramma(); f.scattaOrologio(); }
  c("dopo dieci giri la catena è ancora una", 1, f.inCoda());
  c("e i disegni sono quelli attesi", 24, disegni);
  c("le catene dichiarate sono una", 1, m.catene());
  c("e i disegni contati combaciano", disegni, m.disegni());

  //  ── FERMARSI VUOL DIRE FERMARSI ────────────────────────────────────
  m.ferma();
  c("da fermo non resta niente in coda", 0, f.inCoda());
  c("né orologi accesi", 0, f.orologi());
  c("e nessuna catena viva", 0, m.catene());
  const prima = disegni;
  f.fotogramma(); f.scattaOrologio();
  c("e non disegna più", prima, disegni);

  //  ⚠️ Riavviare non deve lasciare in giro quello di prima: è l'altro modo
  //   di accumulare catene (registrazione fermata e ripresa più volte).
  const g = finto();
  const m2 = avviaTela(() => {}, g.o, 250);
  for (let i = 0; i < 5; i++) g.fotogramma();
  c("una registrazione ripresa non somma catene", 1, g.inCoda());
  m2.ferma();
}

/** ── DOVE SI BLOCCA ───────────────────────────────────────────────────────
 *  La misura che l'applicazione fa di sé stessa: serve perché «va lento» da
 *  fuori non si può indovinare (provato: la pagina ferma non blocca mai). */
/** ── L'ARCHIVIO DEL CRM, SENZA RISCARICARLO OGNI VOLTA ────────────────────
 *  «La dashboard del CRM è molto lenta»: misurato, 1.033 schede e 1,17 MB
 *  riscaricati per intero a ogni apertura, con la pagina che non disegnava
 *  niente fino all'ultimo blocco. */
/** ── QUANDO SERVE IL MOTORE DELLA CONSULENZA ──────────────────────────────
 *  Misurato: il pezzo d'avvio pesava 849 kB e 400 erano il motore, caricato su
 *  OGNI pagina — CRM compreso, dove non disegna niente. Adesso arriva a parte,
 *  e questa è la regola che decide se subito o dopo il primo disegno. */
function proveDelMotore() {
  const { linkDaCliente, motoreSubito } = LNK;
  gruppo("QUANDO SERVE IL MOTORE DELLA CONSULENZA");
  c("una stanza è un link da cliente", true, linkDaCliente({ percorso: "/meetly/abc-defg-hij" }));
  //  ⚠️ Il nome storico continua a girare nei link già mandati.
  c("…anche col nome vecchio", true, linkDaCliente({ percorso: "/videochiamata/abc-defg-hij" }));
  c("e anche il parametro `watch`", true, linkDaCliente({ percorso: "/preventivo", ricerca: "?watch=abc-defg-hij" }));
  c("il CRM no", false, linkDaCliente({ percorso: "/CRM" }));
  c("il preventivo del consulente nemmeno", false, linkDaCliente({ percorso: "/preventivo" }));
  //  ⚠️ Dentro l'anteprima dispositivo NON è un cliente: lì la pagina gira
  //   dentro lo schermo del consulente, e trattarla da cliente vorrebbe dire
  //   disegnarci sopra la sala d'attesa.
  c("dentro l'anteprima no", false, linkDaCliente({ percorso: "/preventivo", ricerca: "?watch=abc&embed=1" }));
  c("e nemmeno dentro una cornice", false, linkDaCliente({ percorso: "/preventivo", ricerca: "?watch=abc", inCornice: true }));

  c("al cliente il motore serve subito", true, motoreSubito({ percorso: "/meetly/abc-defg-hij" }));
  //  ⚠️ E al consulente che ha una consulenza aperta: è il motore a ricevere
  //   le bussate, e farlo aspettare vuol dire una porta che non suona.
  c("e a chi ha una consulenza aperta", true, motoreSubito({ percorso: "/CRM", consulenzaAperta: true }));
  c("nel CRM senza consulenza può aspettare", false, motoreSubito({ percorso: "/CRM" }));
  c("e così sulle pagine pubbliche", false, motoreSubito({ percorso: "/" }));
}

function proveDellaCopiaArchivio() {
  const { filoDellArchivio, fondiSchede, copiaAttendibile } = COP;
  gruppo("L'ARCHIVIO DEL CRM, SENZA RISCARICARLO");
  const s1 = { id: "a", created_at: "2026-01-03", updated_at: "2026-02-01T10:00:00Z", nome: "Anna" };
  const s2 = { id: "b", created_at: "2026-01-02", updated_at: "2026-02-05T09:00:00Z", nome: "Bruno" };
  const s3 = { id: "c", created_at: "2026-01-01", updated_at: "2026-01-20T08:00:00Z", nome: "Carla" };
  c("il filo è l'ultima modifica vista", "2026-02-05T09:00:00Z", filoDellArchivio([s1, s2, s3]));
  c("senza schede non c'è filo", "", filoDellArchivio([]));
  c("e nemmeno senza elenco", "", filoDellArchivio(null));
  //  ⚠️ Le nuove vincono: sono la versione più fresca della stessa riga.
  const bCambiato = { ...s2, nome: "Bruno Neri", updated_at: "2026-03-01T09:00:00Z" };
  const fuse = fondiSchede([s1, s2, s3], [bCambiato]);
  c("la scheda cambiata sostituisce la vecchia", "Bruno Neri", fuse.find((x) => x.id === "b").nome);
  c("e non si duplica", 3, fuse.length);
  //  ⚠️ L'ordine resta quello dell'archivio: se no le schede ballano sotto le
  //   dita a ogni aggiornamento.
  c("l'ordine resta dalla più recente", "a,b,c", fuse.map((x) => x.id).join(","));
  c("una scheda nuova entra al posto giusto", "d,a,b,c",
    fondiSchede([s1, s2, s3], [{ id: "d", created_at: "2026-01-09", updated_at: "2026-03-02" }]).map((x) => x.id).join(","));
  c("righe senza id non entrano", 3, fondiSchede([s1, s2, s3], [{ nome: "boh" }]).length);
  //  ⚠️ Le cancellazioni non si vedono nel «cambiato dopo»: le vede solo il
  //   conteggio, ed è l'unico motivo per cui si riscarica tutto.
  c("il conteggio che combacia vale", true, copiaAttendibile({ quante: 3, sulServer: 3 }));
  c("una in meno sul server = si riscarica", false, copiaAttendibile({ quante: 3, sulServer: 2 }));
  c("una copia vuota non vale", false, copiaAttendibile({ quante: 0, sulServer: 0 }));
  //  ⚠️ Se il conteggio non si sa, la copia si mostra lo stesso: meglio
  //   dell'archivio vuoto, e il «cambiato dopo» la tiene aggiornata.
  c("conteggio ignoto: la copia si usa", true, copiaAttendibile({ quante: 3, sulServer: null }));
}

function proveDellaLentezza() {
  const { staFacendo, segnaBlocco, riassunto, inParole, daRaccontare, bloccati, SOGLIA_MS } = LEN;
  gruppo("DOVE SI BLOCCA, DETTO DALL'APPLICAZIONE");
  c("un blocco breve non è una notizia", false, segnaBlocco(SOGLIA_MS - 1, 10));
  staFacendo("disegno del preventivo");
  c("uno lungo sì", true, segnaBlocco(1200, 30));
  staFacendo("registrazione");
  segnaBlocco(3000, 40);
  segnaBlocco(600, 41);
  const r = riassunto(bloccati());
  c("si contano i blocchi", 3, r.quanti);
  c("si ricorda il peggiore", 3000, r.peggiore);
  //  ⚠️ I reparti si ordinano per TEMPO, non per numero: dieci blocchi da
  //   mezzo secondo pesano come uno da cinque.
  c("e il reparto che pesa di più viene primo", "registrazione", r.reparti[0].cosa);
  c("con il suo tempo sommato", 3600, r.reparti[0].ms);
  c("si legge in italiano", true, inParole(r).includes("registrazione"));
  c("senza blocchi non si dice niente di allarmante", "nessun blocco sopra mezzo secondo", inParole({ quanti: 0, peggiore: 0, totale: 0, reparti: [] }));
  //  ⚠️ Una diagnostica che chiacchiera è un altro pezzo di lentezza.
  c("non si racconta se non c'è niente", false, daRaccontare({ quanti: 0, adesso: 10_000_000 }));
  c("la prima volta sì", true, daRaccontare({ quanti: 2, ultimoInvioMs: 0, adesso: 10_000_000 }));
  c("ma non due volte in un minuto", false, daRaccontare({ quanti: 2, ultimoInvioMs: 10_000_000 - 30_000, adesso: 10_000_000 }));
  c("dopo il minuto sì", true, daRaccontare({ quanti: 2, ultimoInvioMs: 10_000_000 - 61_000, adesso: 10_000_000 }));
}

function proveDellaVersioneVecchia() {
  const { programmiDellaPagina, versioneVecchia, improntaDeiProgrammi } = VEC;
  gruppo("LA SCHEDA DEL CLIENTE RIMASTA A IERI");
  /*  ⚠️ LA PAGINA VERA NON HA UN `<script src>`, E QUESTA È LA RIGA CHE LO
      RICORDA. Copiata dal fondo dell'HTML di produzione: l'avvio è un
      `import(...)` dentro un modulo scritto nella pagina, e i pezzi della
      rotta sono soltanto SUGGERITI (preloads) — una scheda può non averli
      mai scaricati. La prima versione di questa funzione cercava `src=` e
      sulla pagina vera non trovava niente: il rimedio sarebbe rimasto
      inerte, senza dare segno di sé. */
  const html = `<!doctype html><html><head><title>x</title></head><body>
    <script>$_TSR.router=({preloads:["/assets/index-AAAA.js"],"/meetly_/$code":{preloads:["/assets/rotta-ZZZZ.js"]}})<\/script>
    <link rel="modulepreload" href="/assets/tardi-YYYY.js">
    <script type="module" async="">import("/assets/index-AAAA.js")<\/script>
    <script src="https://esterno.example/tag.js"><\/script>
    </body></html>`;
  c("si leggono i pezzi che la pagina nomina", "/assets/index-AAAA.js,/assets/rotta-ZZZZ.js,/assets/tardi-YYYY.js", programmiDellaPagina(html).join(","));
  //  ⚠️ Nell'HTML vero l'avvio compare due volte, una con le virgolette
  //   protette dentro la mappa delle rotte: non deve contarsi due volte.
  c("le virgolette protette non lo sdoppiano", "/assets/index-AAAA.js",
    programmiDellaPagina(`<script>children:"import(\\"/assets/index-AAAA.js\\")"<\/script><script type="module">import("/assets/index-AAAA.js")<\/script>`).join(","));
  c("e la forma classica vale lo stesso", "/assets/index-BBBB.js",
    programmiDellaPagina(`<script type="module" src="/assets/index-BBBB.js"><\/script>`).join(","));
  //  ⚠️ Solo i nostri: un indirizzo esterno non dice niente sulla versione.
  c("gli indirizzi di fuori non contano", "", programmiDellaPagina(`<script src="https://esterno.example/assets/a-XXXX.js"><\/script>`).join(","));
  c("una pagina senza programmi non dice niente", "", programmiDellaPagina("<html></html>").join(","));
  /*  ⚠️ SI CONFRONTA LA PAGINA CON SÉ STESSA NEL TEMPO. Due strade più
      furbe, provate e buttate: «la pagina nomina un pezzo che non ho» (ne
      nomina cinquanta, quelli che POTREBBERO servirle: uno mai aperto non
      dimostra niente) e «lo stesso pezzo con un'altra sigla» (per sapere
      qual è «lo stesso» bisogna tagliare la sigla, e sui nomi veri —
      `arrow-right-C-2Lc2vo.js` — qualunque taglio confonde due pezzi
      diversi). L'impronta non ha falsi: le sigle le riscrive solo una
      pubblicazione. */
  const ieri = improntaDeiProgrammi(["/assets/index-AAAA.js", "/assets/preventivo-BBBB.js"]);
  const oggi = improntaDeiProgrammi(["/assets/index-AAAA.js", "/assets/preventivo-NUOVO1.js"]);
  c("l'ordine non cambia l'impronta", true,
    improntaDeiProgrammi(["/assets/b-2.js", "/assets/a-1.js"]) === improntaDeiProgrammi(["/assets/a-1.js", "/assets/b-2.js"]));
  c("una pagina illeggibile non ha impronta", "", improntaDeiProgrammi([]));
  c("stessa pubblicazione: non si fa niente", "", versioneVecchia({ adesso: ieri, vista: ieri }));
  //  ⚠️ Il caso vero: pubblicato mentre il cliente era aperto.
  c("pubblicazione nuova: ci si aggiorna", oggi, versioneVecchia({ adesso: oggi, vista: ieri }));
  //  ⚠️ La prima volta su una pagina non si conclude niente: il cliente
  //   cambia pagina seguendo il consulente, e i pezzi cambiano con lei.
  c("la prima volta si prende solo nota", "", versioneVecchia({ adesso: oggi, vista: "" }));
  c("e una pagina illeggibile non ricarica niente", "", versioneVecchia({ adesso: "", vista: ieri }));
  c("ma una volta sola", "", versioneVecchia({ adesso: oggi, vista: ieri, giaRicaricate: [oggi] }));
  const domani = improntaDeiProgrammi(["/assets/index-AAAA.js", "/assets/preventivo-NUOVO2.js"]);
  c("e se ne esce un'altra ci si aggiorna di nuovo", domani,
    versioneVecchia({ adesso: domani, vista: oggi, giaRicaricate: [oggi] }));
  c("e nemmeno una pagina mai chiesta", "", versioneVecchia({}));
}

function proveDellaPrecedenza() {
  const { segnaMioPreventivo, restaSulMioPreventivo, ascoltaMioPreventivo } = MIO;
  gruppo("LA PRECEDENZA DEL SUO PREVENTIVO");
  c("si parte spenta", false, restaSulMioPreventivo());
  const visti = [];
  const basta = ascoltaMioPreventivo((v) => visti.push(v));
  segnaMioPreventivo(true);
  c("chi ascolta lo sa subito", "true", visti.join(","));
  c("e chi chiede lo trova alzata", true, restaSulMioPreventivo());
  //  ⚠️ Lo stesso valore non è una notizia: senza questo, ogni giro del
  //   guardiano (uno ogni due secondi) riaprirebbe la pagina del preventivo.
  segnaMioPreventivo(true);
  c("lo stesso valore non si annuncia", 1, visti.length);
  segnaMioPreventivo(false);
  c("e lo spegnimento sì", "true,false", visti.join(","));
  basta();
  segnaMioPreventivo(true);
  c("chi ha smesso di ascoltare non riceve più", 2, visti.length);
  c("ma la bandierina resta la verità", true, restaSulMioPreventivo());
  //  ⚠️ Un ascoltatore che esplode non deve zittire gli altri: qui dentro
  //   passa il momento in cui il cliente viene riportato sul suo preventivo.
  const buoni = [];
  const stop1 = ascoltaMioPreventivo(() => { throw new Error("rotto"); });
  const stop2 = ascoltaMioPreventivo((v) => buoni.push(v));
  segnaMioPreventivo(false);
  c("un ascoltatore rotto non ferma gli altri", "false", buoni.join(","));
  stop1(); stop2();
  segnaMioPreventivo(false);   // si lascia l'archivio come lo si è trovato
  c("si finisce spenta", false, restaSulMioPreventivo());
}

function proveDeiPreventiviDiGruppo() {
  const { leggiRegia, scriviRegia, pennaDi, conLaPenna, conComune, conAperto,
          conIndividuale, haIlSuo, stanzaDelPreventivo, personaDellaStanza,
          hoLaPenna, siScriveInDue, cosaVede, MAX_STANZE,
          personaDaAdottare, firmaDegliAttesi, paginaDiQuestoCliente,
          statoDelloSchermo, chiEInLinea, statoDiQuestaPersona, conStatoPersona,
          riassuntoInParole, senzaDatiPersonali } = PDG;
  gruppo("I PREVENTIVI QUANDO SONO IN PIÙ DI UNO");

  //  ── LE STANZE ───────────────────────────────────────────────────────
  //  Il codice nudo è il preventivo comune: una consulenza con una persona
  //  sola deve restare esattamente com'era.
  c("senza gettone è la stanza di sempre", "abc-defg-hij", stanzaDelPreventivo("abc-defg-hij"));
  c("con il gettone è la sua stanza", "abc-defg-hij--p1e5b2eba", stanzaDelPreventivo("abc-defg-hij", "p1e5b2eba"));
  /*  ⚠️ DUE TRATTINI: con uno solo, «abc-def--p1» e «abc-def-p1» sarebbero la
      stessa cosa, e il preventivo di una persona finirebbe in una stanza che
      può esistere per conto suo. */
  c("la stanza dice di chi è", "p1e5b2eba", personaDellaStanza("abc-defg-hij--p1e5b2eba"));
  c("il comune non è di nessuno", "", personaDellaStanza("abc-defg-hij"));
  c("i segni strani non entrano nella chiave", "abc-defg-hij--p1", stanzaDelPreventivo("abc-defg-hij", "P1!/.."));

  //  ── LA PENNA ────────────────────────────────────────────────────────
  const vuota = leggiRegia(null);
  c("si parte con il comune spento", false, vuota.comune);
  //  ⚠️ Il riposo è il cliente: quel preventivo è il suo.
  c("la penna nasce in mano al cliente", "cliente", pennaDi(vuota, "p1"));
  const presa = conLaPenna(vuota, "p1", "consulente", 1000);
  c("il consulente la prende", "consulente", pennaDi(presa, "p1"));
  c("e solo nella stanza di quella persona", "cliente", pennaDi(presa, "p2"));
  //  ⚠️ «Quando prendi la penna, può riprendersela»: la regola del committente.
  const resa = conLaPenna(presa, "p1", "cliente", 2000);
  c("il cliente se la riprende", "cliente", pennaDi(resa, "p1"));
  //  Restituirla TOGLIE la voce, invece di scrivere "cliente": la riga non
  //  deve crescere di una voce a ogni scambio.
  c("e la riga non si gonfia", 0, Object.keys(resa.penne).length);
  c("un gettone vuoto non tocca niente", presa, conLaPenna(presa, "", "cliente"));

  //  ── CHI SCRIVE ──────────────────────────────────────────────────────
  //  Il comune è sempre del consulente: per i clienti è «solo visuale».
  c("il comune lo scrive il consulente", true, hoLaPenna({ regia: resa, io: "consulente", chi: "" }));
  c("e il cliente lo guarda e basta", false, hoLaPenna({ regia: resa, io: "cliente", chi: "" }));
  /*  ⚠️ QUI PRIMA C'ERANO TRE PROVE CHE DICEVANO IL CONTRARIO: «mentre lo
      scrive lui il consulente no», «con la penna presa si invertono». Erano
      giuste per il selettore a tre stati, che il committente ha chiesto di
      togliere («rimuovi quello che non serve come solo lui o solo io»). Le
      ho tolte con la funzione che provavano: sul preventivo di una persona
      adesso scrivono tutti e due, e quelle righe non descrivono più niente.
      (Le prove nuove stanno qui sotto: «chi lo vede lo può toccare».) */

  /*  ── CHI LO VEDE LO PUÒ TOCCARE ──────────────────────────────────────
      Il selettore a tre stati non c'è più: «rimuovi quello che non serve come
      solo lui o solo io». Il preventivo di una persona lo scrivono tutti e
      due — è il suo, e tu lo compili con lui. */
  c("il suo lo scrive lui", true, hoLaPenna({ regia: presa, io: "cliente", chi: "p1" }));
  c("e anche il consulente, nello stesso momento", true, hoLaPenna({ regia: presa, io: "consulente", chi: "p1" }));
  /*  ⚠️ «Si scrive in due» non è più una scelta: è il fatto che il preventivo
      sia ACCESO PER LUI. Se lo stai solo preparando tu, dall'altra parte non
      c'è nessuno che scrive e non c'è niente da conciliare. */
  const suoAcceso = conIndividuale(vuota, "p1", true, 1500);
  c("acceso per lui: si scrive in due", true, siScriveInDue(suoAcceso, "p1"));
  c("spento per lui: scrivi solo tu", false, siScriveInDue(vuota, "p1"));
  c("e vale per la sua stanza soltanto", false, siScriveInDue(suoAcceso, "p2"));
  //  ⚠️ Il comune resta del consulente: «solo visuale per loro» era la
  //   richiesta, e non cambia.
  c("il comune non diventa di tutti", false, hoLaPenna({ regia: suoAcceso, io: "cliente", chi: "" }));
  c("il comune lo scrive solo il consulente", true, hoLaPenna({ regia: suoAcceso, io: "consulente", chi: "" }));
  /*  ⚠️ APRIRE NON È PRENDERE LA PENNA. Guardare il preventivo di Anna mentre
      lei lo compila è la cosa normale; scriverci sopra è un'altra, e si fa
      apposta. */
  const guardando = conAperto(presa, "p2", 3000);
  c("guardare non cambia la penna", "cliente", pennaDi(guardando, "p2"));
  c("e si sa che cosa sta guardando", "p2", guardando.aperto);

  //  ── CHE COSA VEDE CIASCUNO ──────────────────────────────────────────
  /*  ⚠️ IL COMUNE NON SI ACCENDE PIÙ, E QUESTA PROVA DICEVA IL CONTRARIO.
      Decisione del committente: «quando clicco nuovo preventivo, quel
      preventivo non è di nessuno degli utenti, ma è di tutti; se attivo
      "segue me" loro vedranno quello che sto facendo io». I due stati sono
      due mestieri — «segue me» guarda me lavorare, «il suo» lo compila lui —
      e un terzo interruttore «adesso puoi guardare» non ha più senso: finché
      restava, chi seguiva vedeva un velo al posto del preventivo che il
      consulente gli stava spiegando.
      La regola è cambiata in `cosaVede`; questa riga era rimasta a prima, ed
      è l'unico controllo che falliva su 7685. Una prova vecchia che resta
      rossa insegna solo a non guardare più il colore. */
  c("anche col comune «spento» il cliente lo vede: è quello che gli stai mostrando",
    "comune", cosaVede({ regia: vuota, io: "p1", gruppo: true }));
  /*  ⚠️ E QUESTA È LA PROVA CHE VALE PIÙ DI TUTTE: con una persona sola non
      si nasconde niente. Da quando ogni cliente ha un gettone — anche da
      solo — senza questa regola la consulenza di tutti i giorni mostrerebbe
      il velo «sto preparando» invece del preventivo. */
  c("da solo, il preventivo si vede come sempre", "comune", cosaVede({ regia: vuota, io: "p1" }));
  c("…anche con la regia mai toccata", "comune", cosaVede({ regia: null, io: "p1" }));
  const acceso = conComune(vuota, true, 4000);
  c("acceso: lo vedono tutti", "comune", cosaVede({ regia: acceso, io: "p1", gruppo: true }));
  //  ⚠️ Il preventivo individuale non è automatico: lo apre il consulente.
  c("il suo non c'è finché non lo apri", false, haIlSuo(acceso, "p1"));
  const suo = conIndividuale(acceso, "p1", true, 5000);
  c("aperto il suo, ce l'ha", true, haIlSuo(suo, "p1"));
  //  ⚠️ Il suo viene prima: non gli si cambia la pagina sotto le mani.
  c("ma il suo viene prima del comune", "mio", cosaVede({ regia: suo, io: "p1", gruppo: true }));
  c("e vale solo per lui", "comune", cosaVede({ regia: suo, io: "p2", gruppo: true }));
  c("chi non è in elenco vede solo il comune", "comune", cosaVede({ regia: suo, io: "", gruppo: true }));
  //  Il preventivo individuale vale anche per chi è solo: è il consulente a
  //  deciderlo, e non c'entra con quante persone ci sono.
  c("il suo vale anche da solo", "mio", cosaVede({ regia: suo, io: "p1" }));
  //  ⚠️ Richiuderlo non cancella niente: la stanza resta, e riaprendola si
  //   ritrova quello che aveva compilato.
  c("richiuso, torna al comune", "comune", cosaVede({ regia: conIndividuale(suo, "p1", false, 6000), io: "p1", gruppo: true }));
  c("i suoi si rileggono dall'archivio", true, haIlSuo(leggiRegia(scriviRegia(suo)), "p1"));
  c("e non si duplicano", 1, conIndividuale(suo, "p1", true).individuali.length);

  /*  ── CHI SONO, QUANDO NON C'È DUBBIO ────────────────────────────────
      La regola con cui il cliente senza gettone smette di essere «di
      nessuno»: è quello che rendeva inutile tutto il resto — il consulente
      accendeva «lo vede lui» e sul telefono del cliente non c'era nessuno a
      cui quell'interruttore parlasse. Vedi personaDaAdottare. */
  const uno = [{ gettone: "pa0f63cb9", nome: "Bruno Neri" }];
  const due = [...uno, { gettone: "p33562954", nome: "Daniele Ferlazzo" }];
  c("una persona sola attesa: sono io", "pa0f63cb9", personaDaAdottare("", uno));
  c("…anche se l'elenco arriva dopo", "pa0f63cb9", personaDaAdottare(null, uno));
  c("in due non si indovina", "", personaDaAdottare("", due));
  c("in tre nemmeno", "", personaDaAdottare("", [...due, { gettone: "pz9" }]));
  c("nessun atteso: niente da adottare", "", personaDaAdottare("", []));
  c("elenco mai arrivato: niente", "", personaDaAdottare("", null));
  //  ⚠️ Chi ha già toccato il proprio nome NON viene riscritto: sarebbe il
  //   modo di mettere una persona dentro il preventivo di un'altra.
  c("chi ha già un nome non lo cambia", "", personaDaAdottare("p33562954", uno));
  c("e il gettone adottato è normalizzato", "pa0f63cb9", personaDaAdottare("", [{ gettone: " PA0F63CB9 " }]));
  c("una riga senza gettone non adotta niente", "", personaDaAdottare("", [{ nome: "Chi?" }]));

  /*  ── DOVE DEVE STARE QUESTO CLIENTE (LO DECIDE IL SERVER) ───────────
      Terza segnalazione sulla stessa cosa: «passo ai media e il cliente con
      il preventivo attivo passa ai media uguale». Le prime due volte il
      rimedio stava sul telefono del cliente — e misurando il canale della
      stanza vera quel telefono annunciava `persona: ""`: non sapeva chi era.
      Questa è la stessa regola, ma dove non si può perdere. */
  const solo = [{ gettone: "pa0f63cb9" }];
  const inTre = [{ gettone: "pa0f63cb9" }, { gettone: "p33562954" }, { gettone: "pzzz1111" }];
  const acceso1 = conIndividuale(vuota, "pa0f63cb9", true);
  c("il suo preventivo batte i media", "/preventivo?persona=pa0f63cb9",
    paginaDiQuestoCliente({ pagina: "/presenta", regia: acceso1, io: "pa0f63cb9" }));
  c("…e dice anche in quale stanza", true,
    paginaDiQuestoCliente({ pagina: "/presenta", regia: acceso1, io: "pa0f63cb9" }).includes("persona=pa0f63cb9"));
  //  ⚠️ Il cuore del rimedio: il cliente NON sa chi è, e la stanza aspetta
  //   una persona sola. È il caso misurato sul vero.
  c("una persona sola: non serve che lo sappia lui", "/preventivo?persona=pa0f63cb9",
    paginaDiQuestoCliente({ pagina: "/presenta", regia: acceso1, io: "", attesi: solo }));
  //  ⚠️ In tre non si indovina: seguire il consulente è l'unico riposo sicuro.
  c("in tre, chi non sa chi è segue il consulente", "/presenta",
    paginaDiQuestoCliente({ pagina: "/presenta", regia: acceso1, io: "", attesi: inTre }));
  c("e chi lo sa va sul suo", "/preventivo?persona=p33562954",
    paginaDiQuestoCliente({ pagina: "/presenta", regia: conIndividuale(vuota, "p33562954", true), io: "p33562954", attesi: inTre }));
  c("spento: si segue il consulente", "/presenta",
    paginaDiQuestoCliente({ pagina: "/presenta", regia: vuota, io: "pa0f63cb9", attesi: solo }));
  c("regia mai scritta: si segue il consulente", "/presenta",
    paginaDiQuestoCliente({ pagina: "/presenta", regia: null, io: "pa0f63cb9", attesi: solo }));
  //  ⚠️ «Non lo so» resta «non lo so»: una pagina vuota non si inventa (vedi
  //   api.presenter.curpage), ma un preventivo acceso vale di più del vuoto.
  c("nessuna pagina scelta e niente acceso: niente", "",
    paginaDiQuestoCliente({ pagina: "", regia: vuota, io: "pa0f63cb9", attesi: solo }));
  c("nessuna pagina scelta ma il suo è acceso: il suo", "/preventivo?persona=pa0f63cb9",
    paginaDiQuestoCliente({ pagina: "", regia: acceso1, io: "", attesi: solo }));
  //  ⚠️ Il preventivo COMUNE non sposta nessuno: è il consulente a portarli
  //   sul preventivo scegliendo quella schermata, come sempre.
  c("il comune acceso non è una precedenza", "/presenta",
    paginaDiQuestoCliente({ pagina: "/presenta", regia: acceso, io: "pa0f63cb9", attesi: solo }));

  /*  ── UNO STATO SOLO PER PERSONA ──────────────────────────────────────
      Il pannello aveva due interruttori che sembravano simmetrici e non lo
      erano, e sotto una frase che ripeteva quello che dicevano loro. La
      domanda vera è una: che cosa ha davanti LUI. E le risposte sono DUE: il
      terzo stato («solo io», il suo preventivo davanti a me e lui fermo) è
      stato tolto su indicazione del committente — «solo io non serve» — ed
      era anche l'unico che nasceva da una combinazione invece che da una
      decisione. Guardare il suo preventivo mentre lo compila resta, ma è una
      cosa che riguarda il mio schermo, non il suo. */
  const regiaVuota = leggiRegia("{}");
  c("di serie segue il consulente", "segue", statoDiQuestaPersona(regiaVuota, "p1"));
  const suoDiP1 = conStatoPersona(regiaVuota, "p1", "suo", 1000);
  c("«il suo» si accende", "suo", statoDiQuestaPersona(suoDiP1, "p1"));
  c("…e vale davvero per lui", true, haIlSuo(suoDiP1, "p1"));
  //  ⚠️ Accendendo «il suo» la stanza aperta sul MIO schermo non si muove: è
  //   l'altra domanda, e la decide un altro comando.
  c("non mi trascina nella sua stanza", "", suoDiP1.aperto);
  c("e se ci ero già ci resto", "p1", conStatoPersona(conAperto(regiaVuota, "p1", 500), "p1", "suo", 1000).aperto);
  const tornaP1 = conStatoPersona(conAperto(suoDiP1, "p1", 1500), "p1", "segue", 3000);
  c("«segue me» lo spegne per lui", false, haIlSuo(tornaP1, "p1"));
  c("e si legge come «segue me»", "segue", statoDiQuestaPersona(tornaP1, "p1"));
  //  ⚠️ …e chiude la sua stanza dal mio schermo: se restasse aperta resterei a
  //   guardare un preventivo che per lui non esiste più.
  c("…e non resta una stanza aperta a vuoto", "", tornaP1.aperto);
  //  ⚠️ Ma la stanza di un ALTRO non si tocca: due persone, due decisioni.
  const conAltroAperto = conStatoPersona(conAperto(regiaVuota, "p2", 1000), "p1", "segue", 2000);
  c("la stanza di un altro resta aperta", "p2", conAltroAperto.aperto);
  c("uno stato senza persona non muove niente", "segue", statoDiQuestaPersona(conStatoPersona(regiaVuota, "", "suo"), ""));
  //  ⚠️ Idempotenza: premere due volte lo stesso stato non cambia niente.
  c("due volte «il suo» è come una", true, haIlSuo(conStatoPersona(suoDiP1, "p1", "suo", 2000), "p1"));
  c("e due volte «segue me» pure", false, haIlSuo(conStatoPersona(tornaP1, "p1", "segue", 4000), "p1"));

  /*  ── IL PREVENTIVO DI UNA PERSONA, IN UNA RIGA ────────────────────────
      La cosa che il pannello non ha mai detto: quanto fa, e se l'ha toccato. */
  const adesso = 1_000_000_000;
  c("mai toccato si dice", "non l'ha ancora toccato", riassuntoInParole({ toccato: false, totale: 0 }, adesso));
  c("niente da leggere = non toccato", "non l'ha ancora toccato", riassuntoInParole(null, adesso));
  //  ⚠️ In italiano i numeri di quattro cifre non si puntano: «4200 €». Con
  //   cinque sì, e questa prova lo fissa perché è il genere di dettaglio che
  //   qualcuno "sistema" a mano rompendo la coerenza col resto delle schermate.
  //  ⚠️ E lo spazio prima di € è UNITO (Intl): il numero e la valuta non
  //   devono poter andare a capo separati in una riga stretta.
  c("cinquemila si punta", "42.000\u00a0€ · adesso", riassuntoInParole({ toccato: true, totale: 42000, quando: adesso }, adesso));
  c("totale e voci in italiano", "4200\u00a0€ · 3 voci · adesso",
    riassuntoInParole({ toccato: true, totale: 4200, voci: 3, quando: adesso }, adesso));
  c("una voce sola non diventa «1 voci»", "4200\u00a0€ · 1 voce · adesso",
    riassuntoInParole({ toccato: true, totale: 4200, voci: 1, quando: adesso }, adesso));
  c("da quanto non si muove", "4200\u00a0€ · 3 voci · 2 minuti fa",
    riassuntoInParole({ toccato: true, totale: 4200, voci: 3, quando: adesso - 120_000 }, adesso));
  c("un minuto è singolare", "iniziato · 1 minuto fa", riassuntoInParole({ toccato: true, quando: adesso - 61_000 }, adesso));
  //  ⚠️ Toccato ma a zero euro esiste: ha scelto una base e poi l'ha tolta.
  //  ⚠️ Visto uscire in locale: «più di un'ora fa», e basta — una riga che
  //   non dice di che cosa. Un preventivo cominciato e poi svuotato è
  //   «iniziato», e il tempo non resta solo.
  c("toccato senza numeri si chiama iniziato", "iniziato · adesso", riassuntoInParole({ toccato: true, totale: 0, voci: 0, quando: adesso }, adesso));
  c("e con l'ora vecchia pure", "iniziato · più di un'ora fa", riassuntoInParole({ toccato: true, quando: adesso - 3_700_000 }, adesso));

  /*  ── IL PREVENTIVO DI UNO NON PORTA I SUOI DATI A TUTTI ──────────────
      Trovato provando «Rendilo il preventivo della consulenza» con due
      persone in stanza: la copia nel comune si portava dietro nome, cognome,
      telefono ed email di chi l'aveva compilato — e il comune lo vedono
      tutti. Cioè Anna avrebbe letto i dati di Bruno, davanti a Bruno. */
  const suoStato = {
    v: 2, baseId: "trapianto", selected: ["a", "b"], qty: 1,
    profile: { nome: "Bruno", cognome: "Neri", telefono: "333", email: "b@x.it" },
    result: { total: 4200, gross: 4600, acconto: 1000, nome: "Bruno", cognome: "Neri", email: "b@x.it", telefono: "333", eta: "40" },
  };
  const pulito = senzaDatiPersonali(suoStato);
  c("la scheda personale non passa", undefined, pulito.profile);
  c("né dentro il risultato", undefined, pulito.result.nome);
  c("né il telefono", undefined, pulito.result.telefono);
  c("né la mail", undefined, pulito.result.email);
  //  ⚠️ …ma il preventivo resta un preventivo: i numeri non si toccano.
  c("il totale resta", 4200, pulito.result.total);
  c("l'acconto resta", 1000, pulito.result.acconto);
  c("le voci restano", "a,b", pulito.selected.join(","));
  c("e la base pure", "trapianto", pulito.baseId);
  //  ⚠️ E non si tocca l'originale: la stanza di Bruno resta com'era.
  c("l'originale non si tocca", "Bruno", suoStato.profile.nome);
  c("un preventivo senza risultato non rompe", undefined, senzaDatiPersonali({ v: 2 }).result);

  /*  ── CHE COSA DICE IL SUO SCHERMO ────────────────────────────────────
      Quarta segnalazione sulla stessa cosa: «passo da contenuti a videocamera
      e gli cambia schermata ugualmente». La pagina la decide il server ed è
      al sicuro; la MODALITÀ la rifiuta il dispositivo del cliente, e una
      scheda aperta da prima di un aggiornamento non sa come farlo. Non si
      indovina da qui: lo dichiara lui. */
  c("spento: non c'è niente da confermare", "spento", statoDelloSchermo({ acceso: false, collegato: true, lodice: true }));
  c("acceso e lui lo conferma: è sul suo", "suo", statoDelloSchermo({ acceso: true, collegato: true, lodice: true }));
  //  ⚠️ In linea ma muto = versione vecchia (o non si è riconosciuto): è il
  //   caso che faceva sembrare rotta la regola.
  c("in linea ma non lo conferma", "non-conferma", statoDelloSchermo({ acceso: true, collegato: true, lodice: false }));
  //  ⚠️ Chi non è dentro viene prima: «aggiorna lo schermo» a chi non ha
  //   nessuno schermo aperto è un consiglio inutile.
  c("non collegato viene prima di tutto", "non-collegato", statoDelloSchermo({ acceso: true, collegato: false, lodice: false }));
  c("…anche se dicesse di esserci", "non-collegato", statoDelloSchermo({ acceso: true, collegato: false, lodice: true }));
  //  ⚠️ `null` = da questa finestra non si sa chi è collegato (il pannello
  //   aperto fuori dalla videochiamata): non si accusa nessuno di non esserci.
  c("senza notizie non si dice «non è dentro»", "non-conferma", statoDelloSchermo({ acceso: true, collegato: null, lodice: false }));
  c("e se lo conferma vale la sua parola", "suo", statoDelloSchermo({ acceso: true, collegato: null, lodice: true }));

  /*  ── CHI È IN LINEA, ANCHE SE NON SI È PRESENTATO ───────────────────
      Fotografia del committente: «Daniele Francesco Ferlazzo · non ancora»
      mentre Daniele era collegato e guardava la videochiamata. Senza
      riconoscerlo il pannello non offriva nemmeno il pulsante per
      aggiornargli lo schermo — che era l'unica cosa che gli serviva. */
  const bruno = { gettone: "pa0f63cb9", leadId: "a0f63cb9-1111" };
  const dani = { gettone: "p33562954", leadId: "33562954-2222" };
  c("chi si presenta è in linea", "a0f63cb9-1111", chiEInLinea({ attesi: [bruno], ospiti: [{ leadId: "a0f63cb9-1111" }] }).join(","));
  //  ⚠️ Il cuore: una persona attesa, un ospite senza nome = è lui.
  c("una persona sola: l'ospite senza nome è lei", "a0f63cb9-1111", chiEInLinea({ attesi: [bruno], ospiti: [{}] }).join(","));
  c("nessun ospite, nessuno in linea", "", chiEInLinea({ attesi: [bruno], ospiti: [] }).join(","));
  //  ⚠️ In due non si assegna niente: due righe senza nome non si sa di chi
  //   siano, e sbagliare vuol dire dire «è in linea» di chi non c'è.
  c("in due non si indovina", "", chiEInLinea({ attesi: [bruno, dani], ospiti: [{}] }).join(","));
  c("…ma chi si presenta si vede lo stesso", "33562954-2222",
    chiEInLinea({ attesi: [bruno, dani], ospiti: [{}, { leadId: "33562954-2222" }] }).join(","));
  c("nessuno atteso: nessun nome da dare", "", chiEInLinea({ attesi: [], ospiti: [{}] }).join(","));
  c("senza notizie non si inventa niente", "", chiEInLinea({}).join(","));

  //  ── L'ELENCO È CAMBIATO? ────────────────────────────────────────────
  //   Contarli non bastava: due persone diverse sono due, come prima — e il
  //   consulente restava con l'elenco della consulenza precedente.
  c("elenco uguale, firma uguale", true, firmaDegliAttesi(uno) === firmaDegliAttesi([{ gettone: "pa0f63cb9", nome: "altro nome" }]));
  c("persone diverse, firma diversa", true, firmaDegliAttesi(uno) !== firmaDegliAttesi([{ gettone: "p33562954" }]));
  c("stesso numero, persone diverse: si accorge", true,
    firmaDegliAttesi(due) !== firmaDegliAttesi([{ gettone: "pa0f63cb9" }, { gettone: "pzzz" }]));
  c("l'ordine non conta", true, firmaDegliAttesi(due) === firmaDegliAttesi([...due].reverse()));
  c("vuoto e mai arrivato hanno la stessa firma", true, firmaDegliAttesi([]) === firmaDegliAttesi(null));

  //  ── ANDATA E RITORNO DALL'ARCHIVIO ──────────────────────────────────
  const riletta = leggiRegia(scriviRegia(guardando));
  c("la regia si rilegge com'era", "consulente", pennaDi(riletta, "p1"));
  c("con il comune spento", false, riletta.comune);
  c("e con la stanza aperta", "p2", riletta.aperto);
  c("una riga rotta non ferma la consulenza", false, leggiRegia("{non json").comune);
  //  ⚠️ Un valore che non è «consulente» vale come «la penna è del cliente»:
  //   il riposo sicuro è che il preventivo resti di chi è.
  c("un valore strano vale come cliente", "cliente", pennaDi(leggiRegia('{"penne":{"p1":"chissa"}}'), "p1"));
  //  ⚠️ E la riga non cresce senza fine: ci finisce dentro una consulenza, non
  //   un archivio.
  let tante = leggiRegia(null);
  for (let i = 0; i < MAX_STANZE + 5; i++) tante = conLaPenna(tante, `p${i}`, "consulente");
  c("le stanze hanno un tetto", MAX_STANZE, Object.keys(tante.penne).length);
}

/*  ═══════════════════════════════════════════════════════════════════════
    COM'È MESSA QUESTA MEZZ'ORA — quattro risposte, non due
    ───────────────────────────────────────────────────────────────────────
    Segnalazione del committente: «quando devo spostare una consulenza mi dà
    disponibilità che sono già occupate, e non mi dà gli slot 1/3 2/3. Se uno
    slot — esempio 9:45 — è occupato ed è 1/3, le 10:00 non devono essere
    disponibili a prescindere: l'orario lo deve dare ma sbarrato».
    ⚠️ Il conto di prima contava chiunque si SOVRAPPONESSE, ma due persone
     finiscono nella stessa consulenza solo se hanno lo STESSO MINUTO di
     inizio — è così che nasce la stanza condivisa. Le 10:00 che si accavallano
     alle 9:45 risultavano «1/3, c'è posto»: prenotandole non si aggiungeva
     nessuno a quella consulenza, se ne creava una SECONDA sovrapposta, con un
     altro link, mentre il consulente era già impegnato.
    ═══════════════════════════════════════════════════════════════════════ */
function proveDelloSlot() {
  const { statoDellaFascia, slotScegliibile } = FAS;
  gruppo("COM'È MESSA QUESTA MEZZ'ORA");

  const alle = (h, m = 0) => h * 60 + m;
  const base = { durata: 60, capienza: 3 };

  //  Nessuno: si sceglie.
  c("nessuno: libera", "libero", statoDellaFascia({ ...base, inizio: alle(10), occupati: [] }).stato);
  c("e si può scegliere", true,
    slotScegliibile(statoDellaFascia({ ...base, inizio: alle(10), occupati: [] })));

  //  Stessa ora: si sta INSIEME, e il contatore dice a che punto siamo.
  const unoAlle10 = [{ da: alle(10), a: alle(11), chi: "Mario", consulenza: true }];
  const insieme = statoDellaFascia({ ...base, inizio: alle(10), occupati: unoAlle10 });
  c("stessa ora: si sta insieme", "insieme", insieme.stato);
  c("il contatore dice uno", 1, insieme.presi);
  c("su tre posti", 3, insieme.posti);
  c("e si sa con chi", "Mario", insieme.chi);
  c("si può scegliere", true, slotScegliibile(insieme));

  //  ⚠️ IL CUORE: un'ora DIVERSA che si accavalla non è «insieme», è coperta.
  const copre = statoDellaFascia({ ...base, inizio: alle(10, 30), occupati: unoAlle10 });
  c("un'ora diversa che si accavalla: coperta", "coperto", copre.stato);
  c("NON si può scegliere", false, slotScegliibile(copre));
  c("e si dice da cosa è coperta", alle(10), copre.copertoDa);
  c("e fino a quando", alle(11), copre.fino);
  //  Il caso esatto del committente: 9:45 presa, 10:00 sbarrata.
  const noveTreQuarti = [{ da: alle(9, 45), a: alle(10, 45), chi: "Mario", consulenza: true }];
  c("le 10:00 dopo una consulenza delle 9:45", "coperto",
    statoDellaFascia({ ...base, inizio: alle(10), occupati: noveTreQuarti }).stato);
  //  E un'ora che NON si tocca resta libera: la sovrapposizione è vera, non
  //  «lo stesso mattino».
  c("un'ora che non si tocca resta libera", "libero",
    statoDellaFascia({ ...base, inizio: alle(11), occupati: noveTreQuarti }).stato);

  //  Piena: rosso, e non si sceglie.
  const treAlle10 = [0, 1, 2].map(() => ({ da: alle(10), a: alle(11), chi: "Mario", consulenza: true }));
  const piena = statoDellaFascia({ ...base, inizio: alle(10), occupati: treAlle10 });
  c("tre su tre: piena", "pieno", piena.stato);
  c("e non si sceglie", false, slotScegliibile(piena));

  //  ⚠️ Una fascia tenuta per UNA persona sola ha un posto, non tre: se qui
  //   uscisse «1/3» chi guarda leggerebbe posto su un'ora che non ne ha più.
  const solo = statoDellaFascia({ ...base, inizio: alle(10), occupati: unoAlle10, modo: "solo" });
  c("tenuta per uno: un posto solo", 1, solo.posti);
  c("e con quello dentro è piena", "pieno", solo.stato);
  //  Ma vuota resta scegliibile: «il primo che entra la occupa tutta».
  c("tenuta per uno ma vuota: libera", "libero",
    statoDellaFascia({ ...base, inizio: alle(10), occupati: [], modo: "solo" }).stato);

  //  ⚠️ Un impegno ESCLUSIVO (posa, ritorno, visita in sede) copre e basta:
  //   non si somma e non si condivide, nemmeno alla stessa ora.
  const posa = [{ da: alle(10), a: alle(12), chi: "Posa da Luca", consulenza: false }];
  c("una posa alla stessa ora copre", "coperto",
    statoDellaFascia({ ...base, inizio: alle(10), occupati: posa }).stato);

  //  La pausa copre: si mostra sbarrata come il resto, non sparisce.
  c("la pausa copre", "coperto",
    statoDellaFascia({ ...base, inizio: alle(13), occupati: [], inPausa: true }).stato);

  //  Robustezza: senza elenco non si rompe niente.
  c("senza occupati non si rompe", "libero", statoDellaFascia({ ...base, inizio: alle(10) }).stato);
  c("né con null", "libero", statoDellaFascia({ ...base, inizio: alle(10), occupati: null }).stato);
}

function proveDellaFascia() {
  const { minutoDi, chiaveFascia, chiaveAttesi, unisciAttesi, leggiAttesi, scriviAttesi,
          nomeBreve, gettoneDi, attesoDalGettone, consulenzaDiGruppo, MAX_ATTESI } = FAS;
  gruppo("PIÙ PERSONE NELLA STESSA CONSULENZA");

  //  ── QUANDO DUE APPUNTAMENTI SONO LA STESSA CONSULENZA ───────────────
  c("l'ora si riduce al minuto", "2026-09-30T15:00", minutoDi("2026-09-30T15:00:00.000Z"));
  //  Due prenotazioni sulla stessa fascia possono arrivare scritte diverse:
  //  con i secondi, senza, con i millesimi. È la stessa consulenza.
  c("secondi e millesimi non contano", minutoDi("2026-09-30T15:00:00Z"), minutoDi("2026-09-30T15:00:59.999Z"));
  c("un'ora diversa è un'altra consulenza", false, minutoDi("2026-09-30T15:00:00Z") === minutoDi("2026-09-30T16:00:00Z"));
  c("una data illeggibile non è una fascia", "", minutoDi("quando capita"));

  const A = "3ba730db-fda7-4f42-a09c-5d5213ea9390", B = "altro-consulente";
  c("stesso consulente e stessa ora: stessa chiave", chiaveFascia(A, "2026-09-30T15:00:00Z"), chiaveFascia(A, "2026-09-30T15:00:30Z"));
  //  ⚠️ Due colleghi alla stessa ora sono due consulenze, come è sempre stato.
  c("due consulenti non si mescolano", false, chiaveFascia(A, "2026-09-30T15:00:00Z") === chiaveFascia(B, "2026-09-30T15:00:00Z"));
  /*  ⚠️ SENZA ORARIO NON SI RAGGRUPPA: una consulenza aperta al volo non ha
      una fascia, e mettere insieme «tutte quelle senza orario» vorrebbe dire
      due clienti che non si conoscono nella stessa stanza. */
  c("senza orario non si raggruppa", "", chiaveFascia(A, ""));
  c("senza consulente nemmeno", "", chiaveFascia("", "2026-09-30T15:00:00Z"));

  //  ── L'ELENCO DEGLI ATTESI ───────────────────────────────────────────
  let attesi = unisciAttesi([], { leadId: "L1", nome: "Mario", cognome: "Rossi" });
  attesi = unisciAttesi(attesi, { leadId: "L2", nome: "Luca", cognome: "Bianchi" });
  c("due persone attese", 2, attesi.length);
  //  Salvare dieci volte lo stesso appuntamento non fa dieci persone.
  attesi = unisciAttesi(attesi, { leadId: "L1", nome: "Mario", cognome: "Rossi" });
  c("salvare di nuovo non duplica", 2, attesi.length);
  //  Il nome corretto sulla scheda arriva fin qui.
  attesi = unisciAttesi(attesi, { leadId: "L1", nome: "Mario Antonio", cognome: "Rossi" });
  c("il nome si aggiorna", "Mario Antonio", attesi[0].nome);
  //  ⚠️ L'ordine è quello di arrivo: è l'ordine dei pulsanti che il cliente
  //   sta per toccare, e non deve ballare a ogni salvataggio.
  c("l'ordine non cambia", "L1,L2", attesi.map((p) => p.leadId).join(","));
  let tanti = [];
  for (let i = 0; i < MAX_ATTESI + 4; i++) tanti = unisciAttesi(tanti, { leadId: `L${i}`, nome: `N${i}` });
  c("c'è un tetto", MAX_ATTESI, tanti.length);

  //  ── UNA PERSONA SOLA: TUTTO COM'ERA ─────────────────────────────────
  c("zero attesi non è un gruppo", false, consulenzaDiGruppo([]));
  c("una persona non è un gruppo", false, consulenzaDiGruppo([{ leadId: "L1", nome: "Mario" }]));
  c("due lo sono", true, consulenzaDiGruppo(attesi));

  //  ── COME SI CHIAMANO DAVANTI AGLI ALTRI ─────────────────────────────
  /*  ⚠️ Nella schermata «chi sei?» i nomi li leggono tutti e tre: il nome e
      l'iniziale bastano a riconoscersi e non consegnano il cognome di un
      cliente a chi gli sta seduto accanto. */
  c("nome e iniziale, non il cognome intero", "Luca B.", nomeBreve({ leadId: "L2", nome: "Luca", cognome: "Bianchi" }));
  c("senza cognome resta il nome", "Luca", nomeBreve({ leadId: "L2", nome: "Luca" }));

  //  ── IL GETTONE ──────────────────────────────────────────────────────
  /*  ⚠️ Chi entra dice «sono io» con un gettone, non con l'id della scheda:
      quello finirebbe nell'indirizzo del browser di un cliente, ed è la
      chiave con cui nel CRM si aprono le sue cose. */
  const p1 = { leadId: "98c87c9a-c2ca-40b7-91da-ff828006bbe7", nome: "Mario" };
  c("il gettone non è l'id della scheda", false, gettoneDi(p1).includes("c2ca"));
  c("…ed è sempre lo stesso per la stessa persona", gettoneDi(p1), gettoneDi({ ...p1, nome: "Mario Antonio" }));
  c("dal gettone si risale alla persona", "Mario", attesoDalGettone([p1], gettoneDi(p1)).nome);
  c("un gettone di un'altra stanza non apre niente", null, attesoDalGettone([p1], "pzzzzzzzz"));

  //  ── SI RILEGGE DIFENDENDOSI ─────────────────────────────────────────
  c("una riga illeggibile vale elenco vuoto", 0, leggiAttesi("{rotto").length);
  c("si riscrive e si rilegge uguale", "Luca", leggiAttesi(scriviAttesi(attesi))[1].nome);
  c("una voce senza scheda si scarta", 0, leggiAttesi(JSON.stringify({ persone: [{ nome: "boh" }] })).length);
  c("la chiave dell'elenco è una sola", "attesi:abc-def", chiaveAttesi("ABC-DEF"));
}

function proveDellaSalaAttesa() {
  const { bussa, decidi, statoDi, inAttesa, ripulisci, leggiSala, scriviSala,
          ATTESA_TTL_MS, DECISIONE_TTL_MS, RIFIUTO_TTL_MS, MAX_PERSONE } = SAL;
  gruppo("LA SALA D'ATTESA SUL SERVER");

  const T0 = 1_700_000_000_000;

  //  ── SI BUSSA, E SI RIBUSSA ──────────────────────────────────────────
  let sala = bussa([], { pid: "p1", nome: "Mario", dev: "D1" }, T0);
  c("chi bussa entra in lista", 1, sala.length);
  c("…in attesa", "attesa", statoDi(sala, { pid: "p1" }, T0));
  //  Ribussare non duplica: aggiorna l'ora, così la riga non scade.
  sala = bussa(sala, { pid: "p1", nome: "Mario", dev: "D1" }, T0 + 4000);
  c("ribussare non duplica", 1, sala.length);
  c("…e tiene viva la riga", T0 + 4000, sala[0].at);

  /*  ⚠️ RICARICARE LA PAGINA CAMBIA IL PID, NON IL DISPOSITIVO. Senza questo
      riconoscimento la stessa persona comparirebbe due volte al consulente,
      che ne farebbe entrare una e lascerebbe l'altra alla porta. */
  sala = bussa(sala, { pid: "p2", nome: "Mario", dev: "D1" }, T0 + 8000);
  c("stesso dispositivo, pid nuovo: resta una persona", 1, sala.length);
  c("…con il pid nuovo", "p2", sala[0].pid);

  //  ── IL VIA LIBERA ───────────────────────────────────────────────────
  sala = decidi(sala, "p2", "ammesso", T0 + 9000);
  c("il consulente fa entrare", "ammesso", statoDi(sala, { pid: "p2" }, T0 + 9000));
  c("…e non è più «in attesa»", 0, inAttesa(sala, T0 + 9000).length);
  /*  ⚠️ CHI È ENTRATO CONTINUA A BUSSARE PER QUALCHE SECONDO (il via libera e
      la sua bussata si incrociano): trattare quella bussata come nuova lo
      rimetterebbe in sala d'attesa dopo che era già dentro. */
  sala = bussa(sala, { pid: "p2", nome: "Mario", dev: "D1" }, T0 + 10_000);
  c("bussare dopo essere entrati non annulla il via libera", "ammesso",
    statoDi(sala, { pid: "p2" }, T0 + 10_000));
  //  E vale per la PERSONA: ricaricando dopo essere stato ammesso, entra.
  c("il via libera vale anche col pid nuovo", "ammesso",
    statoDi(bussa(sala, { pid: "p3", nome: "Mario", dev: "D1" }, T0 + 11_000), { pid: "p3" }, T0 + 11_000));

  //  ── DECIDERE PRIMA CHE LA BUSSATA ARRIVI ────────────────────────────
  /*  Il canale è più veloce del server: il consulente può premere «fai
      entrare» prima che la prima bussata sia stata scritta. Se la decisione
      non si scrivesse, quella persona resterebbe fuori. */
  c("si può far entrare uno che non ha ancora bussato qui", "ammesso",
    statoDi(decidi([], "px", "ammesso", T0), { pid: "px" }, T0));

  /*  ══ IL GUASTO VERO: «LI ACCETTO E CONTINUA A DIRGLI SEI IN ATTESA» ══
      Segnalazione del committente: «c'è chi entra senza problemi e ci sono
      altri che anche se li accetto continua a dirgli sei in attesa, come se
      non avessi mai accettato; anche cambiando link».
      Il pid è di una PAGINA e cambia a ogni ricaricamento. L'elenco del
      consulente può tenerne uno vecchio, e «fai entrare» finiva su quello. In
      archivio la firma è una riga di troppo, senza nome e senza dispositivo:
          {pid:'8e68t9um', nome:'Antonio P.', dev:'7b93…', stato:'ammesso'}
          {pid:'p0ehn42n', nome:'Ospite',                  stato:'ammesso'}
      Il via libera c'era: non era per nessuno. */
  //  Il cliente bussa, ricarica la pagina (pid nuovo, stesso dispositivo) e
  //  ribussa: nella stanza resta UNA riga, con il pid di adesso.
  let ric = bussa([], { pid: "vecchio", nome: "Simone", dev: "DX" }, T0);
  ric = bussa(ric, { pid: "nuovo", nome: "Simone", dev: "DX" }, T0 + 5000);
  c("chi ricarica non si sdoppia", 1, ric.length);
  //  Il consulente preme «fai entrare» con il pid di PRIMA — è quello che ha
  //  in elenco — ma manda anche il dispositivo.
  const conDev = decidi(ric, "vecchio", "ammesso", T0 + 6000, "DX");
  c("il via libera arriva alla persona, non alla pagina", "ammesso",
    statoDi(conDev, { pid: "nuovo", dev: "DX" }, T0 + 6000));
  c("…e non lascia righe di nessuno", 1, conDev.length);
  //  ⚠️ Com'era prima: senza dispositivo la decisione si posa su una riga che
  //   non è di nessuno, e il cliente resta alla porta. Questo controllo
  //   descrive il guasto, e serve a non rifarlo.
  const senzaDev = decidi(ric, "vecchio", "ammesso", T0 + 6000);
  c("senza dispositivo nasce la riga di nessuno", 2, senzaDev.length);
  c("…e in quel caso il via libera vale solo per quel pid", "ammesso",
    statoDi(senzaDev, { pid: "vecchio" }, T0 + 6000));

  /*  ── UNA DECISIONE VALE PIÙ DI UN'ATTESA ─────────────────────────────
      Di una persona possono restare due righe (la pagina di prima e quella di
      adesso). Prima si prendeva la prima che capitava: se capitava quella che
      diceva ancora «attesa», il cliente restava alla porta con il suo via
      libera scritto due righe più sotto. */
  const due = [
    { pid: "vecchio", nome: "Simone", dev: "DX", stato: "ammesso", at: T0 + 6000 },
    { pid: "nuovo", nome: "Simone", dev: "DX", stato: "attesa", at: T0 + 9000 },
  ];
  c("fra le sue righe vince il via libera", "ammesso", statoDi(due, { pid: "nuovo", dev: "DX" }, T0 + 9000));
  //  ⚠️ Fra DUE decisioni vince la più recente: è l'ultima cosa che il
  //   consulente ha voluto (prima l'ho fatto entrare, poi l'ho rifiutato).
  const ripensato = [
    { pid: "p", nome: "X", dev: "DY", stato: "ammesso", at: T0 },
    { pid: "p2", nome: "X", dev: "DY", stato: "rifiutato", at: T0 + 1000 },
  ];
  c("fra due decisioni vince la più recente", "rifiutato", statoDi(ripensato, { pid: "p", dev: "DY" }, T0 + 2000));
  //  Si può decidere conoscendo SOLO il dispositivo (il pid non lo si ha).
  c("si decide anche col solo dispositivo", "ammesso",
    statoDi(decidi(ric, "", "ammesso", T0 + 6000, "DX"), { pid: "nuovo", dev: "DX" }, T0 + 6000));
  //  …e chi non c'è ancora: la riga si scrive e il suo primo giro la trova.
  c("il via libera può precedere la bussata anche col dispositivo", "ammesso",
    statoDi(decidi([], "", "ammesso", T0, "DZ"), { pid: "qualunque", dev: "DZ" }, T0));

  //  ── CHI NON SI FA PIÙ VIVO ──────────────────────────────────────────
  const vecchia = [{ pid: "p9", nome: "Andato", stato: "attesa", at: T0 }];
  c("una bussata di un minuto fa non conta più", 0, ripulisci(vecchia, T0 + ATTESA_TTL_MS + 1).length);
  c("…mezzo minuto sì", 1, ripulisci(vecchia, T0 + 30_000).length);
  /*  ⚠️ LE DECISIONI DURANO DI PIÙ: il cliente deve poter leggere il suo via
      libera anche se in quel momento aveva il telefono in tasca. */
  const decisa = [{ pid: "p8", nome: "Dentro", stato: "ammesso", at: T0 }];
  c("un via libera di dieci minuti fa vale ancora", 1, ripulisci(decisa, T0 + 10 * 60_000).length);
  c("…dopo mezz'ora no", 0, ripulisci(decisa, T0 + DECISIONE_TTL_MS + 1).length);
  /*  ⚠️ UN «NON ORA» NON DURA MEZZ'ORA. La schermata del rifiuto dice
      «riprova fra poco con lo stesso link»: con la vita di una decisione
      normale quella frase era falsa, perché per trenta minuti chi riapriva il
      link riceveva «rifiutato» dal server prima ancora di bussare, e il
      consulente non vedeva nessuna richiesta. */
  const respinta = [{ pid: "p7", nome: "Respinto", dev: "DR", stato: "rifiutato", at: T0 }];
  c("un «non ora» vale ancora dopo un minuto", 1, ripulisci(respinta, T0 + 60_000).length);
  c("…e dopo due minuti si può bussare di nuovo", 0, ripulisci(respinta, T0 + RIFIUTO_TTL_MS + 1).length);
  c("e chi era stato respinto torna sconosciuto, non rifiutato", "sconosciuto",
    statoDi(respinta, { pid: "p7", dev: "DR" }, T0 + RIFIUTO_TTL_MS + 1));
  //  ⚠️ Il blocco è un'altra cosa e non passa di qui: non scade.
  c("due minuti sono due minuti", 120000, RIFIUTO_TTL_MS);

  //  ── «SCONOSCIUTO» NON È «RIFIUTATO» ─────────────────────────────────
  //   Di chi non si sa niente non si dice «no»: si continua a bussare.
  c("di chi non c'è non si sa niente", "sconosciuto", statoDi([], { pid: "mai-visto" }, T0));

  //  ── L'ORDINE, E IL TETTO ────────────────────────────────────────────
  let coda = bussa(bussa([], { pid: "a", nome: "Primo" }, T0), { pid: "b", nome: "Secondo" }, T0 + 1000);
  c("il primo che ha bussato è il primo della lista", "a", inAttesa(coda, T0 + 1000)[0].pid);
  let tanti = [];
  for (let i = 0; i < MAX_PERSONE + 5; i++) tanti = bussa(tanti, { pid: `p${i}` }, T0 + i);
  c("oltre il tetto restano i più recenti", MAX_PERSONE, tanti.length);
  c("…e i primi arrivati sono quelli usciti", false, tanti.some((p) => p.pid === "p0"));

  //  ── SI RILEGGE DIFENDENDOSI ─────────────────────────────────────────
  c("una riga illeggibile vale sala vuota", 0, leggiSala("{rotto").length);
  c("una riga vuota vale sala vuota", 0, leggiSala("").length);
  c("si riscrive e si rilegge uguale", "Mario",
    leggiSala(scriviSala([{ pid: "p1", nome: "Mario", stato: "attesa", at: T0 }]))[0].nome);
  c("una voce senza pid si scarta", 0, leggiSala(JSON.stringify({ persone: [{ nome: "boh" }] })).length);
  c("uno stato inventato vale «attesa»", "attesa",
    leggiSala(JSON.stringify({ persone: [{ pid: "p1", stato: "chissà" }] }))[0].stato);
}

/** ── CHE COSA SI PUÒ SCRIVERE DA UNA ROTTA APERTA ──────────────────────────
 *  `/api/public/quote-create` non ha credenziali e non può averne: il
 *  preventivo lo crea la pagina del cliente. Prendeva il corpo della richiesta
 *  e lo infilava nella tabella così com'era — chiunque conoscesse l'indirizzo
 *  poteva scrivere nell'archivio di un'azienda quello che voleva, nei campi
 *  che voleva. Qui si fissa che cosa passa. */
/** ── QUANDO UNA REGISTRAZIONE È VUOTA ──────────────────────────────────────
 *  Segnalazione del committente, con la schermata sotto gli occhi:
 *  «Registrazione vuota — il registratore non ha prodotto alcun dato».
 *  Le cause sono tre e i rimedi sono diversi: qui si fissa come si riconoscono
 *  e che cosa si dice a chi ha appena finito una consulenza. */
function proveDellaRegistrazione() {
  const { catturaUsabile, cÈQualcosaDaRegistrare, perchéVuota, staScrivendo, vivaESana, rischioStallo, audioRegistrabile, vociDaCollegare, ATTESA_PRIMO_PEZZO_MS } = RGZ;
  gruppo("QUANDO UNA REGISTRAZIONE È VUOTA");

  const viva = (kind) => ({ kind, readyState: "live" });
  const morta = (kind) => ({ kind, readyState: "ended" });
  const muta = (kind) => ({ kind, readyState: "live", muted: true });

  //  ── LA CATTURA SCHERMO ──────────────────────────────────────────────
  c("con l'immagine viva si usa", true, catturaUsabile([viva("video"), viva("audio")]));
  /*  ⚠️ IL CUORE DEL CONTROLLO SBAGLIATO: premendo «Interrompi condivisione»
      finisce la traccia VIDEO, ma quella audio del sistema resta viva. Il
      controllo di prima guardava «una traccia qualsiasi» e la dichiarava
      buona: si registrava un fermo immagine nero, che sembra una
      registrazione riuscita ed è peggio di ripiegare sulle camere. */
  c("condivisione interrotta: non si usa", false, catturaUsabile([morta("video"), viva("audio")]));
  c("un'immagine muta non conta", false, catturaUsabile([muta("video")]));
  c("senza tracce non si usa", false, catturaUsabile([]));
  c("nemmeno con l'elenco assente", false, catturaUsabile(null));

  //  ── C'È QUALCOSA DA REGISTRARE? ─────────────────────────────────────
  //   Basta una traccia viva: una consulenza con le camere spente ma la voce
  //   accesa è una registrazione legittima, ed è il caso più comune.
  c("la sola voce basta", true, cÈQualcosaDaRegistrare([morta("video"), viva("audio")]));
  c("tutto morto: non si parte", false, cÈQualcosaDaRegistrare([morta("video"), morta("audio")]));
  c("una traccia muta non basta", false, cÈQualcosaDaRegistrare([muta("audio")]));
  c("viva e sana", true, vivaESana(viva("audio")));

  //  ── COSA SI DICE, E A CHI ───────────────────────────────────────────
  const niente = perchéVuota({ cera: false, secondi: 300 });
  c("niente da registrare: si dice quello", true, /nessuna camera|nessun microfono/i.test(niente.motivo));
  c("…e il titolo non parla di «vuota»", "Non c'era niente da registrare", niente.titolo);
  const corta = perchéVuota({ cera: true, secondi: 1 });
  c("un secondo: si dice che è troppo breve", "Registrazione troppo breve", corta.titolo);
  c("…al singolare", true, /1 secondo\b/.test(corta.motivo));
  const boh = perchéVuota({ cera: true, secondi: 600 });
  c("dieci minuti e niente: si guarda la condivisione", true, /condivisione/i.test(boh.motivo));

  /*  ── ⚠️ LA CAUSA VERA, MISURATA ──────────────────────────────────────
      Replicato il percorso «CAMERE» in Chrome (tela 1280×720 disegnata a ogni
      fotogramma, tracce vive, AudioContext in funzione, sette secondi):
      senza nessuna sorgente collegata alla destinazione audio → 0 byte; con
      una sorgente → 98.632 byte. Il registratore aspetta l'audio promesso e
      non consegna nemmeno il video. È il caso normale dei primi minuti di una
      consulenza, e il rimedio è il filo di silenzio in shop/call. */
  c("traccia audio senza sorgenti: stallo", true, rischioStallo({ tracceAudio: 1, sorgentiCollegate: 0 }));
  c("con il filo di silenzio: niente stallo", false, rischioStallo({ tracceAudio: 1, sorgentiCollegate: 1 }));
  //  ⚠️ Un video muto non è uno stallo: è una registrazione legittima. Lo
  //   stallo è la PROMESSA non mantenuta, non l'assenza di audio.
  c("nessuna traccia audio: nessuno stallo", false, rischioStallo({ tracceAudio: 0, sorgentiCollegate: 0 }));

  /*  ── IL CONTESTO AUDIO SOSPESO ──────────────────────────────────────
      Misurato in Chrome, stesso percorso, unica differenza lo stato del
      contesto: in funzione → 117.019 byte; sospeso → 0 byte, con la tela che
      disegnava regolarmente. Un contesto sospeso non produce campioni, quindi
      la traccia audio nel miscuglio è viva e immobile: la stessa trappola del
      filo mancante, per un'altra ragione. Vale «running» e NIENTE ALTRO —
      «suspended» e «interrupted» (iOS, chiamata in arrivo) non registrano. */
  c("contesto in funzione: si registra l'audio", true, audioRegistrabile("running"));
  c("contesto sospeso: l'audio si lascia fuori", false, audioRegistrabile("suspended"));
  c("contesto chiuso: l'audio si lascia fuori", false, audioRegistrabile("closed"));
  c("contesto interrotto (iOS): l'audio si lascia fuori", false, audioRegistrabile("interrupted"));
  c("stato sconosciuto: non si rischia", false, audioRegistrabile(undefined));

  /*  ── LE VOCI CHE ARRIVANO DOPO ───────────────────────────────────────
      Segnalazione del committente: «registra le consulenze ma non l'audio
      degli ospiti». La registrazione parte quando l'ospite ENTRA, e la sua
      voce arriva secondi dopo (la connessione deve finire di negoziare): il
      miscuglio era già chiuso, e per tutta la consulenza si registrava il solo
      consulente. Il banco adesso resta aperto, e queste sono le regole di chi
      ci si attacca. */
  const voce = (id, readyState = "live") => ({ kind: "audio", readyState, id });
  const nomi = (l) => l.map((t) => t.id).join(",");
  c("una voce nuova si attacca", "ospite1", nomi(vociDaCollegare([voce("ospite1")], [])));
  c("una voce già attaccata no", "", nomi(vociDaCollegare([voce("ospite1")], ["ospite1"])));
  //  ⚠️ Due sorgenti sulla stessa traccia raddoppiano il volume: lo stesso
  //   flusso passato due volte nella stessa chiamata non vale due.
  c("due volte nella stessa chiamata vale una", "ospite1",
    nomi(vociDaCollegare([voce("ospite1"), voce("ospite1")], [])));
  //  ⚠️ Il microfono spento e riacceso è una traccia NUOVA: deve rientrare.
  c("il microfono riacceso è una voce nuova", "mic2", nomi(vociDaCollegare([voce("mic2")], ["mic1"])));
  c("una traccia finita non si attacca", "", nomi(vociDaCollegare([voce("mic1", "ended")], [])));
  c("il video non è una voce", "", nomi(vociDaCollegare([{ kind: "video", readyState: "live", id: "cam" }], [])));
  c("una traccia senza identificativo non si attacca", "", nomi(vociDaCollegare([{ kind: "audio", readyState: "live" }], [])));
  c("niente tracce: niente da fare", 0, vociDaCollegare(null, null).length);
  c("si attaccano tutte quelle nuove", "a,b",
    nomi(vociDaCollegare([voce("a"), voce("b"), voce("vecchia")], ["vecchia"])));

  //  ── LA SPIA DEL PRIMO PEZZO ─────────────────────────────────────────
  //   Scoprire il vuoto dopo quaranta minuti è la notizia peggiore nel momento
  //   peggiore: si guarda dopo qualche secondo, mentre si può ancora rimediare.
  c("appena avviata non si allarma", true, staScrivendo({ pezzi: 0, msDallAvvio: 1000 }));
  c("con i pezzi va bene comunque", true, staScrivendo({ pezzi: 3, msDallAvvio: 60000 }));
  c("dopo l'attesa senza pezzi: si allarma", false, staScrivendo({ pezzi: 0, msDallAvvio: ATTESA_PRIMO_PEZZO_MS + 1 }));
}

function proveDeiModiDiIncasso() {
  const { MODI_INCASSO, modoDi, codiceDelModo, pagamentoInChiaro, causaleSuggerita, vuoleIban } = MODI;
  gruppo("COME HA PAGATO, E COSA SCRIVERE DI CONSEGUENZA");

  /*  ⚠️ I CODICI DEL TRACCIATO NON SI INVENTANO: da qui esce
      `ModalitaPagamento` del file dell'Agenzia. MP01 contanti, MP05 bonifico,
      MP08 carta — e il POS È una carta: per l'Agenzia sono la stessa modalità,
      quello che cambia è dove si va a prendere il riferimento. */
  c("bonifico è MP05", "MP05", codiceDelModo("bonifico"));
  c("contanti è MP01", "MP01", codiceDelModo("contanti"));
  c("carta è MP08", "MP08", codiceDelModo("carta"));
  c("il POS è una carta: MP08", "MP08", codiceDelModo("pos"));
  //  ⚠️ ASSENTE = BONIFICO: è quello che il programma scriveva prima che
  //   questo campo esistesse, e le fatture già emesse non devono cambiare
  //   significato.
  c("senza modo scelto: bonifico", "MP05", codiceDelModo(undefined));
  c("un modo sconosciuto non rompe niente", "MP05", codiceDelModo("boh"));
  c("ci sono tutti e quattro i modi", 4, MODI_INCASSO.length);

  /*  ── ⚠️ L'IBAN SOLO SE SI ASPETTA UN BONIFICO ────────────────────────
      Segnalazione del committente: «se seleziono POS non deve uscire pagamento
      tramite bonifico sulla fattura». Sul foglio era già sistemato; nel FILE
      dell'Agenzia no — `DettaglioPagamento` portava l'IBAN del centro su OGNI
      fattura, contanti compresi. È il campo con cui i gestionali riconciliano
      gli estratti conto: un contante con l'IBAN accanto lo si cerca in banca,
      dove non c'è. */
  c("il bonifico vuole l'IBAN", true, vuoleIban("bonifico"));
  c("il POS no", false, vuoleIban("pos"));
  c("i contanti no", false, vuoleIban("contanti"));
  c("la carta a distanza no", false, vuoleIban("carta"));
  //  ⚠️ Senza modo resta bonifico: le fatture già emesse non cambiano
  //   significato (è la stessa regola del codice del tracciato).
  c("senza modo scelto: come il bonifico", true, vuoleIban(undefined));

  /*  ── IL NUMERO HA UN NOME DIVERSO PER OGNI MODO ──────────────────────
      «Operazione 42» su un pagamento in contanti è una parola che in cassa non
      esiste: lì quel numero è la ricevuta, in banca è il CRO. */
  c("al POS si chiama operazione", true, /operazione TEUB4XR2M9/.test(pagamentoInChiaro({ metodo: "pos", riferimento: "TEUB4XR2M9" })));
  c("in contanti si chiama ricevuta", true, /ricevuta 42/.test(pagamentoInChiaro({ metodo: "contanti", riferimento: "42" })));
  c("sul bonifico si chiama CRO", true, /CRO 12345/.test(pagamentoInChiaro({ metodo: "bonifico", riferimento: "12345" })));
  //  ⚠️ E al POS non si nomina il bonifico, mai: è la segnalazione.
  c("al POS non si parla di bonifico", false, /bonifico/i.test(pagamentoInChiaro({ metodo: "pos", riferimento: "X1" })));
  c("in contanti nemmeno", false, /bonifico/i.test(pagamentoInChiaro({ metodo: "contanti" })));
  //  ⚠️ E l'IBAN non compare nella riga di un incasso al POS, nemmeno se c'è.
  c("l'IBAN non esce al POS", false, /IT60/.test(pagamentoInChiaro({ metodo: "pos", iban: "IT60X0542811101000000123456" })));
  c("sul bonifico sì", true, /IT60/.test(pagamentoInChiaro({ metodo: "bonifico", iban: "IT60X0542811101000000123456" })));
  //  Senza riferimento si dice comunque come ha pagato: mezza riga è meglio di
  //  una riga falsa.
  c("senza numero si dice lo stesso come ha pagato", "Pagamento con POS", pagamentoInChiaro({ metodo: "pos" }));

  /*  La guida: ogni modo dice CHE COSA chiedere e DOVE si trova. È la
      richiesta del committente, ed è la differenza fra un campo che si compila
      e un campo davanti al quale ci si ferma. */
  for (const m of MODI_INCASSO) {
    c(`${m.chiave}: ha un titolo`, true, !!m.titolo);
    c(`${m.chiave}: dice che dato chiedere`, true, !!m.dato?.etichetta);
    c(`${m.chiave}: dice dove trovarlo`, true, (m.dato?.dove || "").length > 40);
  }
  //  ⚠️ IL NOME DEL CAMPO CAUSALE CAMBIA: «Causale del bonifico» su un incasso
  //   al POS è la domanda che ha fatto fermare il committente.
  c("sul bonifico si chiama causale del bonifico", true, /bonifico/i.test(modoDi("bonifico").etichettaCausale));
  c("al POS non si parla più di bonifico", false, /bonifico/i.test(modoDi("pos").etichettaCausale));
  c("e la guida del POS parla di SumUp", true, /sumup/i.test(modoDi("pos").dato.dove));

  /*  ── LA RIGA SUL DOCUMENTO ──────────────────────────────────────────
      ⚠️ L'IBAN SOLO A CHI DEVE FARE UN BONIFICO: scritto su una fattura già
      pagata al POS è l'invito a pagare due volte. */
  c("bonifico: si scrive l'IBAN", true,
    /IT60X/.test(pagamentoInChiaro({ metodo: "bonifico", iban: "IT60X0542811101000000123456" })));
  c("POS: niente IBAN", false,
    /IT60X/.test(pagamentoInChiaro({ metodo: "pos", riferimento: "TEUB4XR2M9", iban: "IT60X0542811101000000123456" })));
  c("POS: si dice com'è stato pagato", "Pagamento con POS · operazione TEUB4XR2M9",
    pagamentoInChiaro({ metodo: "pos", riferimento: "TEUB4XR2M9" }));
  c("contanti: in italiano corretto", "Pagamento in contanti",
    pagamentoInChiaro({ metodo: "contanti" }));
  c("senza riferimento non resta un pezzo di frase", "Pagamento con POS",
    pagamentoInChiaro({ metodo: "pos", riferimento: "   " }));

  /*  ── LA CAUSALE PROPOSTA ────────────────────────────────────────────
      ⚠️ SUL BONIFICO NON SI TOCCA NIENTE: è la frase che il cliente ha copiato
      nel pagamento, e cambiarla romperebbe il filo con l'accredito in banca. */
  const base = "Conferma d'ordine n. IDAB123";
  c("bonifico: la causale resta quella", base, causaleSuggerita({ metodo: "bonifico", base }));
  c("POS: si dice come ha pagato", `${base} · pagato al POS · operazione TEUB4XR2M9`,
    causaleSuggerita({ metodo: "pos", base, riferimento: "TEUB4XR2M9" }));
  c("contanti senza riferimento", `${base} · pagato in contanti`,
    causaleSuggerita({ metodo: "contanti", base }));
  c("senza modo scelto resta com'era", base, causaleSuggerita({ base }));
}

/*  ═══════════════════════════════════════════════════════════════════════
    DENTRO LE MIGRAZIONI NON CI VANNO NÉ INDIRIZZI NÉ CHIAVI
    ───────────────────────────────────────────────────────────────────────
    Trovato scaricando l'archivio della sorgente e leggendolo, dopo che il
    committente ha chiesto di poter portare via tutto per installarlo altrove:
    due migrazioni si portavano dentro, scritti a mano, l'indirizzo di questa
    installazione e la chiave pubblica del progetto. Non erano segreti — la
    chiave `anon` la riceve ogni browser — ma chi clonava il sistema si
    ritrovava dei lavori periodici che chiamavano il SITO VECCHIO, e non aveva
    modo di accorgersene. Una delle due, per giunta, chiamava da mesi un
    indirizzo che non esiste più.
    Le migrazioni adesso leggono i due valori da `app_config`. Questa prova
    serve perché non ci tornino: un cartello avvisa chi legge, una prova ferma
    anche chi non legge.
    ⚠️ VALE SU TUTTE LE MIGRAZIONI, anche quelle che verranno: si legge la
     cartella, non un elenco scritto a mano.
    ═══════════════════════════════════════════════════════════════════════ */
function proveDelleSezioniDiCopia() {
  const { SEZIONI, esportabile } = COPIA;
  gruppo("CHE COSA ESCE IN UNA COPIA, E CHE COSA NO");

  /*  ⚠️ LE CREDENZIALI NON ESCONO MAI. Questo file gira per email, finisce su
      chiavette e adesso anche dentro il pacchetto «porta via tutto»: una copia
      con dentro i PIN dei consulenti non è un backup, è una fuga di dati.
      Queste righe sono il contratto. */
  c("il PIN di un presentatore non esce", false, esportabile("presenters"));
  c("una sessione consulente non esce", false, esportabile("csess:abc123"));
  c("i tentativi di PIN non escono", false, esportabile("accpin:3391234567"));
  c("le credenziali del server video non escono", false, esportabile("turn_config"));
  c("qualunque cosa con «token» dentro non esce", false, esportabile("meta_access_token"));
  c("né con «secret»", false, esportabile("whatsapp_secret"));
  c("né con «password»", false, esportabile("smtp_password"));
  c("né quello che finisce per «key»", false, esportabile("openrouter_key"));
  /*  ⚠️ E NON ESCE L'INDIRIZZO DEI LAVORI PERIODICI: non è un segreto, ma
      portarselo dietro vuol dire che il sistema nuovo, appena importa i dati,
      programma i suoi lavori contro il SITO VECCHIO. */
  c("l'indirizzo dei lavori periodici non esce", false, esportabile("cron_sito"));
  c("né la sua chiave", false, esportabile("cron_chiave"));

  //  E quello che DEVE uscire, esce: senza questa metà si potrebbe chiudere
  //  tutto e dire «sicuro».
  c("il listino esce", true, esportabile("listino"));
  c("le pagine della landing escono", true, esportabile("landing_sezioni"));
  c("i titoli dei preventivi escono", true, esportabile("preventivo_condizioni:ID1"));

  //  Le sezioni: ognuna con la sua tabella e la sua chiave, se no una copia
  //  non si può nemmeno rimettere dentro.
  c("le sezioni ci sono tutte", true, Array.isArray(SEZIONI) && SEZIONI.length >= 13);
  const senzaChiave = SEZIONI.filter((s) => !s.campo || !s.tabella || !s.chiave);
  c("ogni sezione dice tabella e chiave", "", senzaChiave.map((s) => s.campo || "?").join(","));
  const doppi = SEZIONI.map((s) => s.campo).filter((v, i, a) => a.indexOf(v) !== i);
  c("nessuna sezione ripetuta", "", doppi.join(","));
  //  ⚠️ `impostazioni` non è una sezione: è app_config, che si legge a parte e
  //   si filtra chiave per chiave. Metterla fra le sezioni la esporterebbe
  //   INTERA, PIN compresi.
  c("«impostazioni» non è fra le sezioni", false, SEZIONI.some((s) => s.campo === "impostazioni"));
}

function proveDelleMigrazioni() {
  gruppo("NELLE MIGRAZIONI NIENTE INDIRIZZI NÉ CHIAVI");
  const cartella = "supabase/migrations";
  const file = readdirSync(cartella).filter((n) => n.endsWith(".sql"));
  c("le migrazioni ci sono", true, file.length > 20);

  const conChiave = [];
  const conIndirizzo = [];
  for (const n of file) {
    const testo = readFileSync(join(cartella, n), "utf8");
    //  Un gettone JWT: comincia per eyJ e ha i tre pezzi separati dal punto.
    if (/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(testo)) conChiave.push(n);
    //  Un indirizzo di questa o di un'altra installazione, scritto a mano.
    //  ⚠️ `supabase.co` da solo non basta a condannare: un commento può
    //   nominarlo. Si cercano gli indirizzi INTERI, che sono quelli che
    //   finiscono dentro un comando.
    if (/https?:\/\/[a-z0-9.-]*(workers\.dev|lovable\.app|supabase\.co|hair-genius)[a-z0-9./-]*/i.test(testo))
      conIndirizzo.push(n);
  }
  c("nessuna chiave scritta a mano", "", conChiave.join(", "));
  c("nessun indirizzo scritto a mano", "", conIndirizzo.join(", "));

  //  E i due valori si leggono da app_config: se qualcuno togliesse la lettura
  //  i lavori periodici resterebbero senza indirizzo e nessuno se ne
  //  accorgerebbe fino al giorno dopo.
  const cron = readFileSync(join(cartella, "20261005150000_cron_senza_indirizzi_fissi.sql"), "utf8");
  c("l'indirizzo si legge da app_config", true, cron.includes("'cron_sito'"));
  c("la chiave si legge da app_config", true, cron.includes("'cron_chiave'"));
  //  ⚠️ Mai la chiave di servizio dentro un comando di cron: resta scritta in
  //   chiaro in cron.job, leggibile da chiunque entri nel database.
  c("niente chiave di servizio nei lavori periodici", false, /service_role_key|SERVICE_ROLE_KEY/.test(cron));
}

function proveDelLinkPerCiascuno() {
  const { gettoneDalLink, linkPerPersona, CHIAVE_CHI } = LINKCHI;
  const { getWhatsAppMessageForStatus } = WA;
  gruppo("UN LINK PER CIASCUNO, NELLA STESSA STANZA");

  /*  ⚠️ QUESTA PROVA ESISTE PER UN ERRORE VERO, ED È IL PEZZO CHE CONTA.
      La regola l'avevo scritta e provata, ma la riga che la USA nel messaggio
      non è mai finita nel file (uno script si è fermato prima di salvare, e i
      tipi non se ne sono accorti: l'import restava, semplicemente inutile).
      Il committente ha riprovato e ha trovato lo stesso link di prima: «continua
      a non generare link univoco». Una regola provata da sola non basta — qui
      si prova il MESSAGGIO che parte davvero. */
  const stessaStanza = "https://hair-genius-hub.hair/meetly/abc-defg-hij";
  const scheda = (id, nome) => ({
    id,
    data: {
      nome, cognome: "Rossi", telefono: "+39333",
      stato: "appuntamento_fissato",
      dataMeeting: "2026-12-01", oraMeeting: "15:00",
      linkMeeting: stessaStanza,
    },
  });
  const messaggioA = getWhatsAppMessageForStatus(scheda("4f2a1b9c-1111", "Anna"), "Luca");
  const messaggioB = getWhatsAppMessageForStatus(scheda("7c3d2e8a-2222", "Bruno"), "Luca");
  const linkDi = (t) => (t.match(/https?:\/\/\S+/g) || []).find((x) => x.includes("/meetly/")) || "";
  c("nel messaggio c'è il link della stanza", true, linkDi(messaggioA).includes("/meetly/"));
  c("e porta il gettone di chi lo riceve", true, linkDi(messaggioA).includes(`${CHIAVE_CHI}=`));
  //  ⚠️ IL CUORE: due persone della STESSA consulenza, due link diversi.
  c("due persone della stessa stanza, due link diversi", true, linkDi(messaggioA) !== linkDi(messaggioB));
  c("ma la stanza è la stessa", true,
    linkDi(messaggioA).split("?")[0] === linkDi(messaggioB).split("?")[0]);
  //  E il gettone che arriva è quello che il cliente sa rileggere.
  c("il gettone si rilegge dal link mandato", true,
    !!gettoneDalLink(linkDi(messaggioA).split("?")[1] || ""));


  const stanza = "https://hair-genius-hub.hair/meetly/abc-defg-hij";

  /*  Segnalazione del committente: «quando invio il link alle 3 persone della
      consulenza deve generare un link univoco per ogni persona, perché ora
      mette a tutti lo stesso nome». La stanza resta una, cambia chi entra. */
  c("il link porta il gettone", `${stanza}?${CHIAVE_CHI}=p3f91a2c`,
    linkPerPersona(stanza, "p3f91a2c"));
  c("e si rilegge dall'indirizzo", "p3f91a2c", gettoneDalLink(`?${CHIAVE_CHI}=p3f91a2c`));
  //  Due persone, due link diversi: è tutta la richiesta.
  c("due persone, due link", true,
    linkPerPersona(stanza, "pa1") !== linkPerPersona(stanza, "pb2"));

  //  ⚠️ Se il link ha già una domanda, la si conserva.
  c("una domanda che c'era resta", `${stanza}?watch=x&${CHIAVE_CHI}=pz9`,
    linkPerPersona(`${stanza}?watch=x`, "pz9"));
  //  ⚠️ L'ancora resta in fondo: con la domanda dopo il cancelletto non
  //   arriva al programma.
  c("l'ancora resta in fondo", `${stanza}?${CHIAVE_CHI}=pz9#giu`,
    linkPerPersona(`${stanza}#giu`, "pz9"));
  //  ⚠️ Non si sovrascrive: chi l'ha composto sapeva per chi era.
  c("un gettone già scritto non si tocca", `${stanza}?${CHIAVE_CHI}=primo`,
    linkPerPersona(`${stanza}?${CHIAVE_CHI}=primo`, "secondo"));

  /*  ⚠️ SOLO SULLE STANZE NOSTRE: su un Meet scritto a mano in scheda una
      nostra domanda in coda non vuol dire niente, e in certi casi lo rompe. */
  c("un link esterno non si tocca", "https://meet.google.com/abc-defg-hij",
    linkPerPersona("https://meet.google.com/abc-defg-hij", "pz9"));
  c("il vecchio indirizzo delle stanze vale ancora", true,
    linkPerPersona("https://x.it/videochiamata/abc-def", "pz9").includes(CHIAVE_CHI));

  //  Senza gettone, o senza link, non si inventa niente.
  c("senza gettone il link resta com'era", stanza, linkPerPersona(stanza, ""));
  c("senza link non esce niente", "", linkPerPersona("", "pz9"));
  c("un gettone sporco si ripulisce", `${stanza}?${CHIAVE_CHI}=pab12`,
    linkPerPersona(stanza, " P-AB/12 "));
  c("e si rilegge ripulito", "pab12", gettoneDalLink("?chi=%20P-AB%2F12%20"));
  c("senza domanda, nessun gettone", "", gettoneDalLink(""));
  c("un'altra domanda non è il gettone", "", gettoneDalLink("?watch=abc"));

  /*  ── L'ANTEPRIMA È DI CHI RICEVE IL LINK ───────────────────────────────
      Segnalazione del committente: «ora l'anteprima mostra il nome del primo
      che ho assegnato a quell'orario, invece deve mostrare il nome corretto a
      ogni persona sul suo link». Il biglietto si deposita e si cerca sotto un
      codice: con una persona sola è la stanza, con tre è la stanza PIÙ chi la
      riceve. */
  const { codiceAnteprimaDi, spezzaCodiceAnteprima, SEGNO_CHI } = LINKCHI;
  c("il codice del biglietto porta chi lo riceve", `jqj-ypdd-pzt${SEGNO_CHI}pb4b5c685`,
    codiceAnteprimaDi("jqj-ypdd-pzt", "pb4b5c685"));
  //  ⚠️ IL CUORE: tre persone nella stessa stanza, tre biglietti diversi.
  c("tre persone, tre biglietti", 3,
    new Set(["p24c82eaa", "pa6041da3", "pb4b5c685"].map((g) =>
      codiceAnteprimaDi("jqj-ypdd-pzt", g))).size);
  //  Una persona sola: tutto com'era, e i biglietti già depositati valgono.
  c("senza gettone il codice resta la stanza", "jqj-ypdd-pzt",
    codiceAnteprimaDi("jqj-ypdd-pzt", ""));
  //  ⚠️ Due giri dello stesso lavoro non devono depositare sotto due codici.
  c("il gettone non si prende due volte", `jqj-ypdd-pzt${SEGNO_CHI}pb4b5c685`,
    codiceAnteprimaDi(`jqj-ypdd-pzt${SEGNO_CHI}pb4b5c685`, "pb4b5c685"));
  //  E si rilegge: è il passaggio che fa servire il biglietto giusto.
  c("si rilegge la stanza", "jqj-ypdd-pzt",
    spezzaCodiceAnteprima(`jqj-ypdd-pzt${SEGNO_CHI}pb4b5c685`).codice);
  c("si rilegge chi lo riceve", "pb4b5c685",
    spezzaCodiceAnteprima(`jqj-ypdd-pzt${SEGNO_CHI}pb4b5c685`).gettone);
  c("un codice di stanza normale resta intero", "jqj-ypdd-pzt",
    spezzaCodiceAnteprima("jqj-ypdd-pzt").codice);
  c("e non porta nessun gettone", "", spezzaCodiceAnteprima("jqj-ypdd-pzt").gettone);
  /*  ⚠️ La coda si riconosce dalla FORMA del gettone: un codice d'invito con
      un trattino basso dentro non si deve spezzare in due pezzi che non sono
      né una stanza né una persona. */
  c("una coda che non è un gettone non spezza", "A3AK-X6DV_RTDN",
    spezzaCodiceAnteprima("A3AK-X6DV_RTDN").codice);
  c("e non diventa un gettone", "", spezzaCodiceAnteprima("A3AK-X6DV_RTDN").gettone);
  //  ⚠️ Il segno deve sopravvivere a `codicePulito` di api.anteprima, se no il
  //   deposito finisce di nuovo sotto la sola stanza, senza dire niente.
  c("il segno sopravvive alla ripulitura del codice",
    `jqj-ypdd-pzt${SEGNO_CHI}pb4b5c685`,
    `jqj-ypdd-pzt${SEGNO_CHI}pb4b5c685`.replace(/[^a-zA-Z0-9._-]/g, ""));
  //  ⚠️ E non può essere il trattino: i codici di stanza ne sono pieni.
  c("il segno non è il trattino", true, SEGNO_CHI !== "-");
}

function proveDelleTrePorte() {
  const { REPARTI, repartoDi, contoReparto, sottoViste, repartiDaMostrare, vistaDiIngresso } = REP;
  gruppo("TRE PORTE, NON OTTO");

  /*  Segnalazione del committente: «riorganizza tutto da 0, ora è troppo
      caotico e si perdono funzioni importanti». Otto linguette sulla stessa
      riga chiedono di scegliere fra otto cose ogni volta. */
  const tutte = REPARTI.flatMap((r) => r.viste.map((v) => v.vista));
  c("le porte sono tre", 3, REPARTI.length);
  //  ⚠️ IL CUORE: nessuna vista è stata persa per strada — né le otto di
  //   allora, né le due del magazzino aggiunte il 7/10 (Ripesca, Doppioni).
  //   Il numero si aggiorna quando una stanza nasce; quello che NON deve
  //   cambiare è che siano tutte dentro una porta e una sola.
  c("ogni stanza sta in una porta e una sola", tutte.length, new Set(tutte).size);
  for (const v of [
    "coda", "oggi", "ritorno", "tutti", "whatsapp", "rimandati", "saltati", "miei",
    "ripesca", "doppioni",
  ]) {
    c(`«${v}» ha ancora una porta`, true, tutte.includes(v));
  }

  const conti = { coda: 17, oggi: 2, ritorno: 21, tutti: 17, whatsapp: 16, rimandati: 7, saltati: 7, miei: 128 };
  /*  ⚠️ IL NUMERO SULLA PORTA NON È LA SOMMA: i contatti di ritorno e i
      richiami scaduti stanno GIÀ in coda, e sommarli direbbe che c'è il doppio
      del lavoro che c'è. */
  c("la porta «adesso» conta solo la coda", 17, contoReparto("adesso", conti));
  c("«in attesa» invece somma le sue tre stanze", 30, contoReparto("attesa", conti));
  c("«il mio lavoro» porta il suo numero", 128, contoReparto("mio", conti));

  c("una vista sa in che porta sta", "attesa", repartoDi("whatsapp"));
  c("e anche quella del setter", "mio", repartoDi("miei"));

  //  Le stanze vuote non si mostrano...
  const vuoto = { coda: 0, oggi: 0, miei: 0 };
  c("una stanza vuota non compare", false,
    sottoViste("attesa", vuoto, "coda").some((v) => v.vista === "saltati"));
  //  ...ma quelle di tutti i giorni sì, anche a zero.
  c("la coda c'è anche quando sei in pari", true,
    sottoViste("adesso", vuoto, "coda").some((v) => v.vista === "coda"));
  //  ⚠️ E quella APERTA non sparisce sotto le dita quando si svuota.
  c("la stanza aperta non sparisce mai", true,
    sottoViste("attesa", vuoto, "saltati").some((v) => v.vista === "saltati"));
  c("nemmeno la sua porta", true,
    repartiDaMostrare(vuoto, "saltati").some((r) => r.reparto === "attesa"));
  c("ma a porta chiusa e stanze vuote la porta non c'è", false,
    repartiDaMostrare(vuoto, "coda").some((r) => r.reparto === "attesa"));

  /*  Premendo una porta si entra dove c'è da lavorare, non sulla prima stanza
      per ordine alfabetico. */
  c("si entra dove c'è qualcosa", "whatsapp", vistaDiIngresso("attesa", conti, "coda"));
  c("a porta tutta vuota si entra nella stanza di sempre", "coda",
    vistaDiIngresso("adesso", vuoto, "miei"));
  //  ⚠️ Ripremere la porta che si sta già guardando non sposta nessuno.
  c("ripremere la porta aperta non sposta niente", "rimandati",
    vistaDiIngresso("attesa", conti, "rimandati"));
}

function proveDiChiHaFissato() {
  const { chiHaFissato, fissataDa, patchChiFissa, esitoFissato } = FISSA;
  gruppo("CHI HA FISSATO QUESTA CONSULENZA");

  /*  Segnalazione del committente: «il setter dopo che fissa le consulenze non
      può più vedere la lista di quello che ha fissato». Erano due difetti in
      uno: `statoDa` si riscrive al primo esito, e l'elenco chiedeva che fosse
      ANCORA un appuntamento. */
  const SETTER = "s-111";
  const CONSULENTE = "c-222";

  //  Si prende l'appuntamento: il nome si scrive.
  const presa = patchChiFissa({
    prima: { stato: "da_contattare" },
    statoNuovo: "appuntamento_fissato",
    chi: SETTER,
  });
  c("chi fissa resta scritto", SETTER, presa.fissatoDa);
  c("e con la data in cui l'ha presa", true, !!presa.fissatoIl);

  //  ⚠️ IL CUORE: il consulente segna l'esito, e la consulenza resta del setter.
  const dopoEsito = { stato: "no_show", fissatoDa: SETTER, fissatoIl: "2026-10-01T09:00:00Z", statoDa: CONSULENTE };
  c("dopo il no show resta di chi l'ha presa", SETTER, chiHaFissato(dopoEsito).id);
  c("e il setter la ritrova", true, fissataDa(dopoEsito, SETTER));
  c("il consulente non se la prende", false, fissataDa(dopoEsito, CONSULENTE));

  //  ⚠️ Si scrive UNA VOLTA SOLA: spostare l'ora non ruba la consulenza.
  c("spostare l'appuntamento non cambia di chi è", undefined,
    patchChiFissa({
      prima: { stato: "appuntamento_fissato", fissatoDa: SETTER },
      statoNuovo: "appuntamento_rifissato",
      chi: CONSULENTE,
    }).fissatoDa);

  //  Niente appuntamento, niente nome: non è una presa.
  c("un cambio di stato qualunque non fissa niente", undefined,
    patchChiFissa({ prima: { stato: "da_contattare" }, statoNuovo: "no_risposta", chi: SETTER }).fissatoDa);
  //  ⚠️ Senza sapere chi sta lavorando non si inventa un nome.
  c("senza consulente collegato non si scrive niente", undefined,
    patchChiFissa({ prima: {}, statoNuovo: "appuntamento_fissato", chi: "" }).fissatoDa);

  /*  ── IL RIPIEGO PER LE SCHEDE DI PRIMA ───────────────────────────────
      Non hanno il campo: si deduce da `statoDa`, ma SOLO se un appuntamento
      c'è stato davvero — se no l'elenco del setter si riempirebbe di gente
      che non ha mai visto. E si dice che è dedotto. */
  const vecchia = { stato: "appuntamento_fissato", statoDa: SETTER };
  c("una scheda di prima si attribuisce lo stesso", SETTER, chiHaFissato(vecchia).id);
  c("ma si sa che è dedotta", "dedotta", chiHaFissato(vecchia).fonte);
  c("quella scritta è certa", "certa", chiHaFissato({ fissatoDa: SETTER }).fonte);
  c("chi non ha mai avuto un appuntamento non è di nessuno", "",
    chiHaFissato({ stato: "da_contattare", statoDa: SETTER }).id);
  c("e lo dice", "ignota", chiHaFissato({ stato: "da_contattare", statoDa: SETTER }).fonte);
  //  Il ripiego vale anche quando l'appuntamento è nel passato dello stato.
  c("vale anche se l'appuntamento è nello stato precedente", SETTER,
    chiHaFissato({ stato: "venduto", statoPrecedente: "appuntamento_fissato", statoDa: SETTER }).id);

  /*  Com'è finita è una COLONNA, non un motivo per far sparire la riga. */
  c("un appuntamento in piedi", "in piedi", esitoFissato({ stato: "appuntamento_fissato" }));
  c("una vendita", "andata", esitoFissato({ stato: "venduto" }));
  c("un assente si recupera", "da recuperare", esitoFissato({ stato: "no_show" }));
  c("un annullato è perso", "persa", esitoFissato({ stato: "annullato" }));
  //  ⚠️ Uno stato sconosciuto non è una perdita: è roba da riprendere in mano.
  c("uno stato che non conosciamo non si dichiara perso", "da recuperare",
    esitoFissato({ stato: "zzz_mai_visto" }));
}

function proveDelContaSuoni() {
  const { conta, quanti, riassunto } = SUONI;
  gruppo("CHE COSA STA SUONANDO SUL TELEFONO DEL CLIENTE");

  /*  Segnalazione del committente: «l'utente quando sta dentro sente bip bip
      bip», lato CLIENTE e in continuazione. Il diario serve a dire QUALE dei
      suoni possibili si ripete, invece di tentarne uno alla volta. */
  const cn = {};
  conta(cn, "audio-ripreso");
  conta(cn, "audio-ripreso");
  conta(cn, "joined");
  c("due volte lo stesso suono fanno due", 2, cn["audio-ripreso"]);
  c("e il totale li somma tutti", 3, quanti(cn));
  //  ⚠️ Il primo della riga è il sospettato: si legge quello e si va lì.
  c("il più frequente viene per primo", true,
    riassunto(cn, 20).includes("audio-ripreso×2, joined×1"));
  c("la riga dice su quanto tempo", true, riassunto(cn, 20).includes("ultimi 20s"));
  //  ⚠️ Niente da dire = nessuna riga: un diario che scrive anche quando non è
  //   successo niente è un diario che nessuno legge.
  c("senza suoni non si scrive niente", "", riassunto({}, 20));
  c("e nemmeno con dei conteggi a zero", "", riassunto({ joined: 0 }, 20));
  //  Un nome vuoto non deve creare una voce senza nome nella riga.
  c("un nome vuoto non conta", 0, quanti(conta({}, "   ")));
}

function proveDellaStanzaVuota() {
  const { stanzaAncoraVuota, eLaStanzaNuda } = VUOTA;
  gruppo("«L'HO ACCETTATO E NON RIESCE A ENTRARE»");

  /*  Provato dal browser l'8/10/2026: l'ingresso funziona (il via libera si
      scrive e la pagina lo legge), ma subito dopo il corpo della pagina era
      questo e basta:
          <div id="hg-outlet"><div class="bg-blueprint min-h-screen"></div></div>
      La persona è DENTRO e vede il nulla. Dalla sua parte si dice in un modo
      solo: «non riesco a entrare». */
  c("entrato, niente video, sulla stanza nuda → si copre", true,
    stanzaAncoraVuota({ entrato: true, flussiRemoti: 0, percorso: "/meetly/abc-defg-hij" }));
  //  ⚠️ Appena c'è qualcosa da vedere, il velo se ne va DA SOLO: non c'è
  //   nessuno stato da chiudere e nessun pulsante.
  c("col video del consulente non si copre niente", false,
    stanzaAncoraVuota({ entrato: true, flussiRemoti: 1, percorso: "/meetly/abc-defg-hij" }));
  c("e nemmeno su una pagina da seguire", false,
    stanzaAncoraVuota({ entrato: true, flussiRemoti: 0, percorso: "/preventivo" }));
  //  ⚠️ SOLO A CHI È ENTRATO: prima ci sono già le sue schermate (attesa, sala
  //   d'attesa, rifiutato), e due schermate per lo stesso momento sono una di
  //   troppo.
  c("chi non è ancora entrato ha già le sue schermate", false,
    stanzaAncoraVuota({ entrato: false, flussiRemoti: 0, percorso: "/meetly/abc-defg-hij" }));

  //  Quali indirizzi sono «la stanza nuda», cioè quelli che non disegnano
  //  niente da soli.
  c("la stanza nuova è nuda", true, eLaStanzaNuda("/meetly/abc-defg-hij"));
  c("e anche il vecchio indirizzo", true, eLaStanzaNuda("/videochiamata/abc-defg-hij"));
  c("il preventivo no", false, eLaStanzaNuda("/preventivo"));
  c("le slide no", false, eLaStanzaNuda("/presenta"));
  //  ⚠️ `/meetlyqualcosa` non è la stanza: senza l'ancoraggio una pagina che
  //   comincia per «meetly» si coprirebbe di velo pur avendo contenuti.
  c("un indirizzo che somiglia non basta", false, eLaStanzaNuda("/meetlyfinto"));
  c("senza indirizzo non si copre niente", false, eLaStanzaNuda(""));
}

function proveDelGiraCamera() {
  const { versoCamera, siPuoGirare, prossimaCamera } = GIRA;
  gruppo("GIRARE LA CAMERA: DAVANTI ⇄ DIETRO");

  /*  I nomi veri, come li scrivono i browser. */
  c("iPhone: la frontale", "fronte", versoCamera("Front Camera"));
  c("iPhone: la posteriore", "retro", versoCamera("Back Dual Wide Camera"));
  c("portatile Apple", "fronte", versoCamera("FaceTime HD Camera (Built-in)"));
  c("in italiano", "retro", versoCamera("Fotocamera posteriore"));
  //  ⚠️ Su Android il nome dice «facing front» / «facing back»: le parole del
  //   retro vincono, se no «facing back» verrebbe letto come frontale.
  c("Android: facing back", "retro", versoCamera("camera2 0, facing back"));
  c("Android: facing front", "fronte", versoCamera("camera2 1, facing front"));
  c("un nome che non dice niente", "", versoCamera("USB Video Device"));
  c("senza nome non si indovina", "", versoCamera(""));

  //  ⚠️ Con una camera sola non si gira niente, e il pulsante deve poterlo
  //   dire: un pulsante che non fa niente è peggio di un pulsante spento.
  c("una camera sola: non si gira", false, siPuoGirare([{ id: "a", nome: "Front" }]));
  c("nessuna camera: non si gira", false, siPuoGirare([]));
  c("due camere: si gira", true, siPuoGirare([{ id: "a" }, { id: "b" }]));
  c("elenco assente: non si gira", false, siPuoGirare(null));

  const telefono = [
    { id: "f", nome: "Front Camera" },
    { id: "r", nome: "Back Camera" },
  ];
  c("dalla frontale si passa a quella dietro", "r", prossimaCamera({ camere: telefono, attuale: "f" }));
  c("e viceversa", "f", prossimaCamera({ camere: telefono, attuale: "r" }));
  /*  ⚠️ «Quella di serie» è la prima dell'elenco: senza questa regola il primo
      tocco sceglieva proprio la camera già accesa, cioè non girava niente —
      ed è il caso NORMALE, perché nessuno ha mai scelto una camera a mano. */
  c("senza nessuna scelta si parte dalla prima", "r", prossimaCamera({ camere: telefono, attuale: "" }));

  //  Tre camere dietro (i telefoni di oggi): premendo si continua a girare.
  const tre = [
    { id: "f", nome: "Front Camera" },
    { id: "r1", nome: "Back Camera" },
    { id: "r2", nome: "Back Ultra Wide Camera" },
  ];
  c("dalla frontale si va alla prima di dietro", "r1", prossimaCamera({ camere: tre, attuale: "f" }));
  c("da dietro si torna davanti", "f", prossimaCamera({ camere: tre, attuale: "r1" }));

  //  Nomi assenti (permesso non ancora dato, o browser che li nasconde): si
  //  passa semplicemente alla camera dopo, in giro.
  const senzaNomi = [{ id: "1" }, { id: "2" }];
  c("senza nomi: la camera dopo", "2", prossimaCamera({ camere: senzaNomi, attuale: "1" }));
  c("e si torna in giro", "1", prossimaCamera({ camere: senzaNomi, attuale: "2" }));
  //  Un dispositivo scelto che non esiste più (webcam staccata): non si resta
  //  fermi, si riparte dalla prima.
  c("scelta sparita: si riparte", "2", prossimaCamera({ camere: senzaNomi, attuale: "sparita" }));
  c("una camera sola: niente da girare", "", prossimaCamera({ camere: [{ id: "a" }], attuale: "a" }));
  c("nessuna camera: niente da girare", "", prossimaCamera({ camere: null, attuale: "" }));
}

function proveDiChiEAncoraDentro() {
  const { segnaChiCÈ, seNeÈAndato, ancoraDentro, GRAZIA_USCITA_MS } = DENTRO;
  gruppo("CHI SE N'È ANDATO ESCE DAL PANNELLO");
  const T0 = 1_700_000_000_000;

  /*  La memoria: si segna chi c'è, e non si ridisegna per niente. */
  const m1 = segnaChiCÈ({}, ["a", "b"], T0);
  c("segna chi è in linea", T0, m1.a);
  c("segna tutti quelli in linea", T0, m1.b);
  //  ⚠️ Stessa memoria, stesso oggetto: il pannello non si ridisegna a ogni
  //   giro di lettura solo perché non è cambiato niente.
  c("nessuno in linea: la memoria è la stessa", true, segnaChiCÈ(m1, [], T0 + 5) === m1);
  c("chi torna aggiorna l'ora", T0 + 900, segnaChiCÈ(m1, ["a"], T0 + 900).a);
  c("e non cancella gli altri", T0, segnaChiCÈ(m1, ["a"], T0 + 900).b);

  /*  ── LE TRE PARTI DELLA REGOLA ──────────────────────────────────────
      Chi non è mai entrato RESTA (è la sala d'attesa), chi c'è resta, e chi
      c'era se ne va — ma non prima che sia passata la grazia, se no si
      toglie chi sta ricaricando la pagina. */
  const dopo = T0 + GRAZIA_USCITA_MS + 1;
  c("mai visto dentro: resta (deve ancora arrivare)", false,
    seNeÈAndato({ leadId: "z", memoria: m1, inLinea: [], adesso: dopo }));
  c("è dentro adesso: resta", false,
    seNeÈAndato({ leadId: "a", memoria: m1, inLinea: ["a"], adesso: dopo }));
  c("uscito da poco: resta (sta ricaricando)", false,
    seNeÈAndato({ leadId: "a", memoria: m1, inLinea: [], adesso: T0 + 5_000 }));
  c("uscito da un pezzo: se ne va", true,
    seNeÈAndato({ leadId: "a", memoria: m1, inLinea: [], adesso: dopo }));
  //  ⚠️ Non si sa chi è collegato (una finestra fuori dalla consulenza): non
  //   si toglie nessuno. Togliere al buio è peggio che lasciare.
  c("non si sa chi c'è: non si toglie nessuno", false,
    seNeÈAndato({ leadId: "a", memoria: m1, inLinea: null, adesso: dopo }));
  /*  ⚠️ IL COLLEGATO CHE NON SI SA RICONOSCERE. Una scheda aperta da prima di
      un aggiornamento non annuncia il gettone: si vede il riquadro e non si sa
      chi sia. Finché in stanza c'è uno così, «quella persona se n'è andata»
      non si può dire — potrebbe essere proprio lui. */
  c("c'è un collegato ignoto: non si toglie nessuno", false,
    seNeÈAndato({ leadId: "a", memoria: m1, inLinea: [], ignoti: 1, adesso: dopo }));
  c("stanza di gente riconosciuta: si decide", true,
    seNeÈAndato({ leadId: "a", memoria: m1, inLinea: ["b"], ignoti: 0, adesso: dopo }));
  c("senza leadId non si decide niente", false,
    seNeÈAndato({ leadId: "", memoria: m1, inLinea: [], adesso: dopo }));

  /*  Il filtro sull'elenco. */
  const gente = [
    { leadId: "a", nome: "Chi se n'è andato" },
    { leadId: "z", nome: "Chi deve ancora arrivare" },
    { leadId: "b", nome: "Chi è qui" },
  ];
  const rimasti = ancoraDentro(gente, { memoria: m1, inLinea: ["b"], adesso: dopo }).map((x) => x.leadId);
  c("esce solo chi se n'è andato", "z,b", rimasti.join(","));
  //  ⚠️ Le righe senza scheda nascono dai riquadri di chi è collegato adesso:
  //   esistono solo finché la persona c'è, e non si filtrano una seconda volta.
  c("la riga senza scheda non si tocca", 1,
    ancoraDentro([{ leadId: "", senzaScheda: true }], { memoria: m1, inLinea: [], adesso: dopo }).length);
  c("elenco vuoto: nessun errore", 0, ancoraDentro(null, { memoria: m1, inLinea: [], adesso: dopo }).length);
}

function proveDellAnteprimaCheDura() {
  const { quantoDuraImmagine, èUnLettoreDiAnteprime, paginaCondivisa, cacheDellaPagina,
          RISTAMPA_MS, DURATA_LUNGA_S, DURATA_BREVE_S } = ANT;
  gruppo("QUANTO DURA L'ANTEPRIMA DI UN LINK");
  const T0 = 1_700_000_000_000;

  /*  ── L'IMMAGINE ──────────────────────────────────────────────────────
      Cinque minuti solo finché il biglietto si può ristampare; dopo, trenta
      giorni — che è la risposta alla segnalazione «dopo 24 ore l'anteprima si
      toglie dal messaggio». */
  c("trenta giorni sono trenta giorni", 2592000, DURATA_LUNGA_S);
  c("appena depositata: cache corta (si può ristampare)", DURATA_BREVE_S,
    quantoDuraImmagine({ depositataIl: T0, adesso: T0 + 60_000 }));
  c("passata la ristampa: cache lunga", DURATA_LUNGA_S,
    quantoDuraImmagine({ depositataIl: T0, adesso: T0 + RISTAMPA_MS + 1 }));
  c("depositata ieri: cache lunga", DURATA_LUNGA_S,
    quantoDuraImmagine({ depositataIl: T0, adesso: T0 + 24 * 3600_000 }));
  //  ⚠️ Un deposito «nel futuro» è l'orologio che non coincide, non un
  //   impossibile: vale come appena fatto.
  c("ora del deposito nel futuro: cache corta", DURATA_BREVE_S,
    quantoDuraImmagine({ depositataIl: T0 + 60_000, adesso: T0 }));
  c("ora del deposito ignota: cache lunga", DURATA_LUNGA_S,
    quantoDuraImmagine({ depositataIl: 0, adesso: T0 }));

  /*  ── CHI FA LE ANTEPRIME ─────────────────────────────────────────────
      ⚠️ Un browser vero NON deve mai cadere in questo elenco: a lui la pagina
      si dà sempre fresca, se no un aggiornamento appena pubblicato non
      arriva. */
  c("WhatsApp è un lettore", true, èUnLettoreDiAnteprime("WhatsApp/2.23.20.0 A"));
  c("il lettore di Facebook lo è", true,
    èUnLettoreDiAnteprime("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)"));
  c("Telegram lo è", true, èUnLettoreDiAnteprime("Mozilla/5.0 (compatible; TelegramBot)"));
  c("Chrome NON lo è", false,
    èUnLettoreDiAnteprime("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"));
  c("Safari su iPhone NON lo è", false,
    èUnLettoreDiAnteprime("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"));
  c("senza nome non si indovina", false, èUnLettoreDiAnteprime(""));

  /*  ── LE PAGINE CHE SI MANDANO ────────────────────────────────────────── */
  c("il preventivo si manda", true, paginaCondivisa("/preventivo"));
  c("la stanza della consulenza si manda", true, paginaCondivisa("/meetly/gmn-pcdg-mkc"));
  c("l'invito si manda", true, paginaCondivisa("/invito/A3AK-X6DV-RTDN"));
  //  ⚠️ Il gestionale NON si tiene in cassetto per trenta giorni, mai.
  c("il gestionale no", false, paginaCondivisa("/CRM/agenda"));
  c("la radice no", false, paginaCondivisa("/"));

  /*  ── LA DECISIONE INTERA ─────────────────────────────────────────────── */
  const lettore = "WhatsApp/2.23.20.0 A";
  c("lettore + pagina mandata: si tiene trenta giorni", `public, max-age=${DURATA_LUNGA_S}`,
    cacheDellaPagina({ ua: lettore, percorso: "/preventivo", metodo: "GET", stato: 200, tipoContenuto: "text/html; charset=utf-8" }));
  c("anche in sola intestazione", `public, max-age=${DURATA_LUNGA_S}`,
    cacheDellaPagina({ ua: lettore, percorso: "/meetly/abc", metodo: "HEAD", stato: 200, tipoContenuto: "text/html" }));
  c("browser vero: non si tocca niente", null,
    cacheDellaPagina({ ua: "Mozilla/5.0 Chrome/140.0", percorso: "/preventivo", metodo: "GET", stato: 200, tipoContenuto: "text/html" }));
  c("pagina del gestionale: non si tocca niente", null,
    cacheDellaPagina({ ua: lettore, percorso: "/CRM/preventivi", metodo: "GET", stato: 200, tipoContenuto: "text/html" }));
  //  ⚠️ Un errore tenuto trenta giorni è un'anteprima rotta per trenta giorni.
  c("pagina non riuscita: non si tiene", null,
    cacheDellaPagina({ ua: lettore, percorso: "/preventivo", metodo: "GET", stato: 500, tipoContenuto: "text/html" }));
  c("non è una pagina: non si tiene", null,
    cacheDellaPagina({ ua: lettore, percorso: "/preventivo", metodo: "GET", stato: 200, tipoContenuto: "application/json" }));
  c("scrittura: non si tiene", null,
    cacheDellaPagina({ ua: lettore, percorso: "/preventivo", metodo: "POST", stato: 200, tipoContenuto: "text/html" }));
}

function proveDeiLinkNeiMessaggi() {
  const { preventiviDaMandare, linkDelPreventivo, bloccoDeiLink, bloccoPerIlMessaggio,
          linkPerOgniCliente, ETICHETTA_UNO, ETICHETTA_PIU, MAX_LINK } = LNM;
  gruppo("IL PREVENTIVO DENTRO IL MESSAGGIO");
  const SITO = "https://hair-genius-hub.hair";

  const q = (ref, tel, status = "nuovo", creato = "2026-09-01") => ({
    quote_ref: ref, telefono: tel, status, created_at: creato,
  });

  //  ── DI CHI È UN PREVENTIVO ──────────────────────────────────────────
  const righe = [
    q("IDAAA", "333 111 2222", "nuovo", "2026-09-20"),
    q("IDBBB", "+39 333 1112222", "nuovo", "2026-09-25"),
    q("IDZZZ", "347 999 0000", "nuovo", "2026-09-26"),
  ];
  c("si riconoscono dal telefono, dal più recente",
    "IDBBB,IDAAA", preventiviDaMandare(righe, { telefono: "3331112222" }).join(","));
  c("il preventivo di un altro non entra mai", false,
    preventiviDaMandare(righe, { telefono: "3331112222" }).includes("IDZZZ"));
  /*  ⚠️ IL NUMERO SCRITTO SULLA SCHEDA VIENE PRIMA, anche se è più vecchio: è
      l'unico legame che qualcuno ha AFFERMATO, il telefono è un'ipotesi. */
  c("il numero dichiarato sulla scheda viene per primo", "IDAAA",
    preventiviDaMandare(righe, { quoteRef: "idaaa", telefono: "3331112222" })[0]);
  //  ⚠️ Con poche cifre non si aggancia niente: si manderebbe a questa persona
  //   il preventivo di mezzo archivio.
  c("quattro cifre non bastano ad agganciare", 0,
    preventiviDaMandare(righe, { telefono: "2222" }).length);
  c("senza niente in mano non si manda niente", 0, preventiviDaMandare(righe, {}).length);

  /*  ── QUELLO CHE NON SI MANDA MAI ─────────────────────────────────────
      Un preventivo sostituito o perso porta a un prezzo che non vale più:
      mandarlo è peggio che non mandare niente, perché il cliente legge quella
      cifra e si aspetta quella. */
  const chiusi = [
    q("IDVEC", "333 111 2222", "sostituito", "2026-09-27"),
    q("IDPER", "333 111 2222", "perso", "2026-09-28"),
    q("IDBUO", "333 111 2222", "confermato", "2026-09-10"),
  ];
  c("il sostituito e il perso restano fuori", "IDBUO",
    preventiviDaMandare(chiusi, { telefono: "3331112222" }).join(","));

  //  ── QUANTI, E SENZA DOPPIONI ────────────────────────────────────────
  const tanti = [];
  for (let i = 0; i < 6; i++) tanti.push(q(`ID${i}`, "333 111 2222", "nuovo", `2026-09-0${i + 1}`));
  c("non più di tre link in un messaggio", MAX_LINK,
    preventiviDaMandare(tanti, { telefono: "3331112222" }).length);
  c("…e sono i più recenti", "ID5,ID4,ID3",
    preventiviDaMandare(tanti, { telefono: "3331112222" }).join(","));
  c("niente doppioni", 1,
    preventiviDaMandare([q("IDX", "3331112222"), q("idx", "3331112222")], { telefono: "3331112222" }).length);

  //  ── L'INDIRIZZO CHE RICEVE IL CLIENTE ───────────────────────────────
  //   ⚠️ `client=1`: è la stessa forma che si copia dal preventivo aperto, e
  //    dice alla pagina che dall'altra parte c'è il cliente.
  c("il link è quello del cliente", `${SITO}/preventivo?id=IDHGUKT&client=1`,
    linkDelPreventivo("idhgukt", SITO));
  c("una barra di troppo non si porta dietro", `${SITO}/preventivo?id=IDA&client=1`,
    linkDelPreventivo("IDA", `${SITO}/`));
  c("senza numero non c'è link", "", linkDelPreventivo("", SITO));

  //  ── IL BLOCCO NEL MESSAGGIO ─────────────────────────────────────────
  c("un link per riga", 2, bloccoDeiLink(["IDA", "IDB"], SITO).split("\n").length);
  //  ⚠️ La riga che li presenta cambia da sola: «il preventivo» o «i
  //   preventivi». Nel modello sarebbe una frase fissa.
  c("con un preventivo si dice «il preventivo»", ETICHETTA_UNO,
    bloccoPerIlMessaggio(["IDA"], SITO).split("\n")[0]);
  c("con due si dice «i preventivi»", ETICHETTA_PIU,
    bloccoPerIlMessaggio(["IDA", "IDB"], SITO).split("\n")[0]);
  c("senza preventivi il blocco è vuoto (e la riga sparisce)", "",
    bloccoPerIlMessaggio([], SITO));

  //  ── LA MAPPA PER TUTTO IL CRM ───────────────────────────────────────
  const mappa = linkPerOgniCliente(righe, [
    { id: "L1", telefono: "3331112222" },
    { id: "L2", telefono: "3479990000" },
    { id: "L3", telefono: "3480000000" },
  ], SITO);
  c("ognuno ha i suoi", true, mappa.L1.includes("IDBBB") && mappa.L2.includes("IDZZZ"));
  c("il preventivo di uno non finisce all'altro", false, mappa.L2.includes("IDBBB"));
  //  ⚠️ Chi non ha preventivi NON entra nella mappa: una voce vuota e una voce
  //   assente devono essere la stessa cosa per chi legge.
  c("chi non ne ha non entra nella mappa", false, "L3" in mappa);
}

function proveDellaRigaPulita() {
  const { rigaPulita } = RGP;
  gruppo("COSA SI PUÒ SCRIVERE IN UN PREVENTIVO");

  const buona = rigaPulita({
    nome: "  Mario ", cognome: "Rossi", email: "m@r.it", telefono: "+39 000",
    total: 1234.567, qty: 2, eta: 42, upsells: [{ name: "Voce", price: 10.005 }],
    base_system: { id: "invisible-derm", name: "Invisible Derm", price: 860 },
  });
  c("i testi si ripuliscono", "Mario", buona.riga.nome);
  c("gli importi si arrotondano ai centesimi", 1234.57, buona.riga.total);
  c("le quantità sono intere", 2, buona.riga.qty);
  c("le voci passano", 1, buona.riga.upsells.length);
  c("…con il loro prezzo", 10.01, buona.riga.upsells[0].price);
  c("la soluzione base passa", "invisible-derm", buona.riga.base_system.id);
  c("niente di strano da segnalare", 0, buona.scartati.length);

  //  ── ⚠️ I CAMPI NON PREVISTI NON ENTRANO ────────────────────────────
  //   E si DICONO: se domani la pagina manda un campo nuovo, deve essere
  //   possibile capire perché non arriva.
  const strana = rigaPulita({ nome: "X", id: "00000000-0000-0000-0000-000000000000", timeline_steps: { a: true }, pippo: 1 });
  c("un id imposto da fuori non entra", undefined, strana.riga.id);
  c("nemmeno le tappe del lavoro", undefined, strana.riga.timeline_steps);
  c("e si sa che cosa è stato scartato", "id,timeline_steps,pippo", strana.scartati.join(","));

  //  ── I LIMITI ────────────────────────────────────────────────────────
  c("un nome lunghissimo si accorcia", 120, rigaPulita({ nome: "a".repeat(5000) }).riga.nome.length);
  /*  ⚠️ Un totale negativo finirebbe nei conti come uno sconto regalato; uno
      da un miliardo come una vendita mai avvenuta. */
  c("niente importi negativi", 0, rigaPulita({ total: -500 }).riga.total);
  c("niente importi assurdi", 1000000, rigaPulita({ total: 9e12 }).riga.total);
  c("un numero illeggibile non diventa zero", undefined, rigaPulita({ total: "molto" }).riga.total);
  c("l'elenco delle voci ha un tetto", 60, rigaPulita({ upsells: new Array(500).fill({ name: "x", price: 1 }) }).riga.upsells.length);
  c("un elenco che non è un elenco diventa vuoto", 0, rigaPulita({ upsells: "tutto" }).riga.upsells.length);
  c("le voci ci sono sempre, anche vuote", true, Array.isArray(rigaPulita({}).riga.upsells));

  //  ── LO STATO LO DECIDIAMO NOI ───────────────────────────────────────
  //   Un preventivo nasce «nuovo»: se lo decidesse chi chiama, dall'esterno si
  //   potrebbero creare preventivi già «confermati».
  c("nasce sempre nuovo", "nuovo", rigaPulita({ status: "confermato" }).riga.status);
  //  Il posto dell'installazione viaggia dentro la voce, e solo nei due valori
  //  buoni: un posto inventato manderebbe la scheda su un pulsante che non c'è.
  c("il posto dell'installazione, se è uno dei due", "home",
    rigaPulita({ upsells: [{ name: "Installazione", price: 70, dove: "home" }] }).riga.upsells[0].dove);
  c("…altrimenti si lascia fuori", undefined,
    rigaPulita({ upsells: [{ name: "Installazione", price: 70, dove: "luna" }] }).riga.upsells[0].dove);
}

function proveDelNumeroEDellaCausale() {
  const { normalizzaNumero, perchéNonVa, numeroValido, stessoNumero, NUMERO_MAX } = NUM;
  const { causaleDi, MODELLO_DI_CASA } = CAU;
  const { leggiCausaleSalvata, BASE_CAUSALE } = CDP;
  gruppo("NUMERO DEL PREVENTIVO E CAUSALE");

  //  ── IL NUMERO SI RIPULISCE PRIMA DI QUALSIASI CONFRONTO ─────────────
  //   «idp 1234» e «IDP1234» sono lo stesso numero scritto da due persone.
  c("maiuscolo e senza spazi", "IDP1234", normalizzaNumero(" idp 1234 "));
  c("i trattini restano", "PREV-2026-15", normalizzaNumero("prev-2026-15"));
  /*  ⚠️ Quel numero finisce nell'indirizzo del link e dentro le chiavi di
      configurazione: barre, accenti e punti lì non ci possono stare. */
  c("via quello che romperebbe un indirizzo", "AB12", normalizzaNumero("a/b.1 2é"));
  c("due scritture dello stesso numero", true, stessoNumero("idp1234", "IDP 1234"));
  c("…e due numeri diversi no", false, stessoNumero("IDP1234", "IDP1235"));

  //  ── COSA SI PUÒ SCRIVERE ────────────────────────────────────────────
  c("un numero normale va bene", true, numeroValido("IDP1234"));
  c("vuoto no", false, numeroValido("   "));
  c("troppo corto no", false, numeroValido("A1"));
  c("troppo lungo no", false, numeroValido("A".repeat(NUMERO_MAX + 1)));
  //  Solo trattini: passerebbe la lunghezza ed è un indirizzo che non si può
  //  né dettare né riconoscere.
  c("soli trattini no", false, numeroValido("-----"));
  c("e si dice perché", true, /corto/i.test(perchéNonVa("A1")));

  //  ── LA CAUSALE ──────────────────────────────────────────────────────
  c("senza modello vale quella di casa", "Conferma ordine - IDP1234",
    causaleDi({ numero: "IDP1234" }));
  c("quella di casa è una sola", "Conferma ordine - {numero}", MODELLO_DI_CASA);
  c("i segnaposto si riempiono", "Acconto Mario Rossi IDP1234",
    causaleDi({ modello: "Acconto {nome} {numero}", numero: "IDP1234", nome: "Mario Rossi" }));
  c("anche il totale", "IDP1234 · 1.200,00 €",
    causaleDi({ modello: "{numero} · {totale}", numero: "IDP1234", totale: "1.200,00 €" }));
  /*  ⚠️ IL NUMERO CI DEVE ESSERE: una causale senza numero è un bonifico che
      arriva in banca e non si sa di chi è. Se il modello non lo nomina, si
      aggiunge in coda — meglio una causale più lunga di un incasso da
      rintracciare a mano. */
  c("senza numero, il numero si aggiunge", "Acconto impianto IDP1234",
    causaleDi({ modello: "Acconto impianto", numero: "IDP1234" }));
  c("ma se c'è già non si ripete", "Acconto IDP1234",
    causaleDi({ modello: "Acconto {numero}", numero: "IDP1234" }));
  c("…e non conta la forma", true,
    causaleDi({ modello: "acconto idp1234", numero: "IDP1234" }) === "acconto idp1234");
  //  Un segnaposto vuoto non lascia due spazi in mezzo alla frase.
  c("niente spazi doppi", "Acconto IDP1234",
    causaleDi({ modello: "Acconto {nome} {numero}", numero: "IDP1234", nome: "" }));
  c("un modello di soli spazi torna a quella di casa", "Conferma ordine - IDP1234",
    causaleDi({ modello: "   ", numero: "IDP1234" }));

  //  ── LA RIGA SALVATA PER UN PREVENTIVO ───────────────────────────────
  c("la chiave è una sola", "preventivo_causale", BASE_CAUSALE);
  c("si rilegge il modello", "Acconto {numero}",
    leggiCausaleSalvata(JSON.stringify({ modello: "Acconto {numero}" })));
  //  Una riga rotta non deve lasciare il cliente senza causale: si torna al
  //  modello del listino, cioè al comportamento di prima.
  c("una riga rotta non vale", "", leggiCausaleSalvata("{rotto"));
  c("una riga vuota non vale", "", leggiCausaleSalvata(""));
}

function proveDelleCondizioni() {
  const { condizioniDa, leggiCondizioni, listinoDelPreventivo, BASE_CONDIZIONI } = CND;
  const { configurazioneDa } = RIA;
  const { buildMenu } = QMN;
  gruppo("LE CONDIZIONI DI UN PREVENTIVO");

  const listinoAllora = { prices: { "patch-standard": 589 }, manutenzione: { prezzo: 450 }, acconto: 100 };
  const listinoOggi = { prices: { "patch-standard": 999 }, manutenzione: { prezzo: 1650 }, acconto: 300 };

  //  ── LA FOTOGRAFIA COMANDA SUL LISTINO DI OGGI ───────────────────────
  const foto = condizioniDa(listinoAllora);
  c("il documento si disegna con la sua fotografia", 450,
    listinoDelPreventivo(foto, listinoOggi).manutenzione.prezzo);
  c("…e con i suoi prezzi", 589, listinoDelPreventivo(foto, listinoOggi).prices["patch-standard"]);
  /*  ⚠️ NIENTE FOTOGRAFIA = LISTINO DI OGGI, in tutti e due i casi in cui
      capita: un preventivo emesso prima che questa cosa esistesse, e un
      preventivo che si sta modificando apposta. */
  c("senza fotografia vale oggi", 1650, listinoDelPreventivo(null, listinoOggi).manutenzione.prezzo);
  c("la fotografia porta la data", true, typeof foto.il === "string" && foto.il.includes("T"));
  c("la chiave è una sola", "preventivo_condizioni", BASE_CONDIZIONI);

  /*  ── ⚠️ I PREVENTIVI NATI PRIMA DELLA FOTOGRAFIA ────────────────────
      Segnalazione del committente: «quando l'opzione garanzia 15 mesi è
      spenta, dai preventivi già creati CON la garanzia la toglie: deve
      lasciarla lì. Solo su quelli creati senza quell'opzione non deve
      comparire». E: «anche l'acconto deve restare quello del momento della
      creazione».
      Quei documenti non hanno una fotografia, e la pagina ricadeva sul
      listino di adesso: spegnendo l'assistenza spariva anche da un documento
      già consegnato al cliente. Due cose però si sanno per certo: non
      potevano essere stati emessi con l'assistenza spenta (l'interruttore non
      esisteva), e l'acconto era cento (era scritto nel codice). */
  const oggiSpento = { ...listinoOggi, spente: { "parte:garanzia": true, "parte:codice": true } };
  const vecchio = listinoDelPreventivo(null, oggiSpento, true);
  c("documento vecchio: l'assistenza resta", false, !!vecchio.spente["parte:garanzia"]);
  c("…e nessuna parte si toglie all'indietro", false, !!vecchio.spente["parte:codice"]);
  c("…e l'acconto è quello di allora", 100, vecchio.acconto);
  //  Le cifre che non si possono sapere restano quelle di oggi: è come questa
  //  pagina si è sempre comportata.
  c("…mentre l'assistenza costa come oggi", 1650, vecchio.manutenzione.prezzo);
  /*  ⚠️ NEL CONFIGURATORE NO: lì il preventivo si sta ancora costruendo, e le
      impostazioni nuove devono vedersi subito. */
  c("nel configuratore lo spegnimento vale", true,
    !!listinoDelPreventivo(null, oggiSpento, false).spente["parte:garanzia"]);
  c("…e l'acconto è quello di oggi", 300, listinoDelPreventivo(null, oggiSpento, false).acconto);
  /*  E un documento CON la fotografia comanda su tutto: se è nato con
      l'assistenza spenta resta spenta, se è nato accesa resta accesa. */
  const natoSpento = condizioniDa({ ...listinoAllora, spente: { "parte:garanzia": true } });
  c("nato spento, resta spento", true,
    !!listinoDelPreventivo(natoSpento, oggiSpento, true).spente["parte:garanzia"]);
  //  ⚠️ Una fotografia può non avere affatto la voce `spente` (un listino in
  //   cui non si è mai spento niente): «assente» vuol dire acceso, ed è la
  //   stessa lettura difensiva che fa `parteAccesa`.
  c("nato acceso, resta acceso", false,
    !!(listinoDelPreventivo(condizioniDa(listinoAllora), oggiSpento, true).spente ?? {})["parte:garanzia"]);
  c("e l'acconto è quello scritto nella sua fotografia", 100,
    listinoDelPreventivo(condizioniDa({ ...listinoAllora, acconto: 100 }), oggiSpento, true).acconto);

  //  ── SI RILEGGE DIFENDENDOSI ─────────────────────────────────────────
  c("una riga illeggibile non vale", null, leggiCondizioni("{rotto"));
  c("una riga vuota non vale", null, leggiCondizioni(""));
  c("una riga senza listino non vale", null, leggiCondizioni(JSON.stringify({ scelte: {} })));
  const riletta = leggiCondizioni(JSON.stringify(condizioniDa(listinoAllora, {
    baseId: "patch-standard",
    voci: [{ id: "base-hyper", nome: "Innesto rinforzato" }, { id: "", nome: "senza id" }],
    varianti: { "shape-mosso": "onda-media" },
    simOn: true, installOn: false, installLoc: "home", fitting: "sede", qty: 3,
  })));
  c("le voci senza id si scartano", 1, riletta.scelte.voci.length);
  c("la quantità torna", 3, riletta.scelte.qty);
  c("il posto dell'installazione torna", "home", riletta.scelte.installLoc);
  //  ⚠️ L'installazione di serie è ACCESA: una fotografia scritta male non
  //   deve togliere dal preventivo riaperto una voce che c'era (e si paga).
  c("installazione: assente vuol dire accesa", true,
    leggiCondizioni(JSON.stringify({ listino: {}, scelte: { voci: [] } })).scelte.installOn);
  c("un posto inventato diventa «da noi»", "studio",
    leggiCondizioni(JSON.stringify({ listino: {}, scelte: { voci: [], installLoc: "luna" } })).scelte.installLoc);

  //  ── RIAPRIRE DAGLI ID ───────────────────────────────────────────────
  const menu = buildMenu({});
  const sezioni = menu.sections.flatMap((s) => s.items);
  const uno = sezioni[0], due = sezioni[1];
  const scelte = {
    baseId: "invisible-derm",
    voci: [{ id: uno.id, nome: uno.name }, { id: due.id, nome: due.name }],
    varianti: {}, simOn: false, installOn: false, installLoc: "studio", fitting: "remoto", qty: 1,
  };
  //  Il preventivo salvato NON contiene le voci (o le contiene con nomi
  //  cambiati): con gli id tornano lo stesso. È il cuore della richiesta.
  const conId = configurazioneDa({ baseId: "invisible-derm", items: [] }, menu, scelte);
  c("con gli id le voci tornano tutte", 2, conId.selected.length);
  c("…nessuna persa", 0, conId.perse.length);
  c("…e la soluzione base è la sua", "invisible-derm", conId.baseId);
  //  Senza id si torna al cammino dai nomi, che sui preventivi vecchi è
  //  l'unico possibile: un preventivo senza voci riapre vuoto.
  c("senza id e senza nomi non torna niente", 0,
    configurazioneDa({ baseId: "invisible-derm", items: [] }, menu).selected.length);

  /*  ⚠️ UNA VOCE TOLTA DAL LISTINO NON TORNA, E SI DICE QUALE: è il motivo
      per cui accanto all'id si salva anche il nome. Scoprirlo dal totale,
      davanti al cliente, è il modo peggiore. */
  const conSparita = configurazioneDa({ baseId: "invisible-derm", items: [] }, menu, {
    ...scelte,
    voci: [...scelte.voci, { id: "voce-che-non-esiste-piu", nome: "Trattamento speciale" }],
  });
  c("la voce sparita non torna", 2, conSparita.selected.length);
  c("…e si sa qual è", "Trattamento speciale", conSparita.perse[0]);

  //  Le sotto-scelte tornano solo se la voce è ancora selezionata e l'opzione
  //  esiste ancora: una scelta appesa a una voce che non c'è più non si rimette.
  const conVariante = sezioni.find((i) => i.variants);
  if (conVariante) {
    const opz = conVariante.variants.options[conVariante.variants.options.length - 1];
    const cv = configurazioneDa({ items: [] }, menu, {
      ...scelte,
      voci: [{ id: conVariante.id, nome: conVariante.name }],
      varianti: { [conVariante.id]: opz.id, "voce-morta": "opzione-morta" },
    });
    c("la sotto-scelta torna", opz.id, cv.varianti[conVariante.id]);
    c("…e quella di una voce morta no", undefined, cv.varianti["voce-morta"]);
  }
}

function proveDellAccontoEGaranzia() {
  const { accontoDi, ACCONTO_DI_CASA, buildMenu, PARTI_PREVENTIVO, parteAccesa, chiaveParte } = QMN;
  gruppo("L'ACCONTO E LA GARANZIA DEL PREVENTIVO");

  //  ── L'ACCONTO ───────────────────────────────────────────────────────
  c("senza listino vale quello di casa", 100, accontoDi({}));
  c("e quello di casa è cento", 100, ACCONTO_DI_CASA);
  c("il listino comanda", 250, accontoDi({ acconto: 250 }));
  c("i centesimi restano", 149.5, accontoDi({ acconto: 149.5 }));
  /*  ⚠️ ZERO È UNA DECISIONE, NON UN CAMPO VUOTO: vuol dire «su questi
      preventivi non si chiede acconto», e trattarlo come assente lo
      rimetterebbe a cento — cioè chiederebbe soldi che nessuno voleva. */
  c("zero vuol dire «nessun acconto»", 0, accontoDi({ acconto: 0 }));
  //  Valori impossibili: si torna a quello di casa, mai una cifra assurda.
  c("un acconto negativo non esiste", 100, accontoDi({ acconto: -50 }));
  c("un valore non numerico non conta", 100, accontoDi({ acconto: Number.NaN }));
  c("l'acconto viaggia dentro il menu", 250, buildMenu({ acconto: 250 }).acconto);

  //  ── LA GARANZIA SI PUÒ SPEGNERE COME LE ALTRE PARTI ─────────────────
  c("la garanzia è fra le parti spegnibili", true, PARTI_PREVENTIVO.some((p) => p.id === "garanzia"));
  c("di serie è accesa", true, parteAccesa({}, chiaveParte("garanzia")));
  c("spenta, è spenta", false, parteAccesa({ spente: { "parte:garanzia": true } }, chiaveParte("garanzia")));
  //  ⚠️ Spegnere la garanzia non tocca le altre parti: una spunta sola non
  //   deve poter far sparire la quantità o il campo del codice sconto.
  c("e non tocca le altre", true, parteAccesa({ spente: { "parte:garanzia": true } }, chiaveParte("quantita")));

}

function proveDellaConsulenzaAperta() {
  const { siChiudeLaConsulenza, siRiprendeLaConsulenza, RIPRESA_MAX_MS } = CAP;
  gruppo("UNA CONSULENZA APERTA RESTA APERTA");

  const ADESSO = Date.parse("2026-09-25T19:08:00.000Z");
  const fa = (ms) => new Date(ADESSO - ms).toISOString();
  const riga = (extra = {}) => ({
    live: true,
    code: "gmn-pcdg-mkc",
    presenterId: "filippo",
    hb: fa(30_000),
    ...extra,
  });
  const chiedi = (p) => siRiprendeLaConsulenza({ adesso: ADESSO, giaAperta: false, mioCodice: "gmn-pcdg-mkc", ioSono: "filippo", ...p });

  //  ── IL CASO DELLA SEGNALAZIONE ──────────────────────────────────────
  c("la scheda si è ricaricata: me la riprendo", true, chiedi({ riga: riga() }));

  /*  ── ⚠️ LA CONSULENZA CHE NESSUNO HA CHIUSO ─────────────────────────
      Misurato in archivio: 13 righe dichiarate «vive», ferme da 4 a 102 ore.
      Chi legge la riga la chiude, ma solo dopo un silenzio che una ricarica
      non può produrre. */
  const { consulenzaDaChiudere, SILENZIO_FINE_MS } = CAP;
  c("il silenzio che chiude è un quarto d'ora", 900000, SILENZIO_FINE_MS);
  c("una consulenza che batte adesso non si chiude", false,
    consulenzaDaChiudere({ live: true, hb: fa(5_000) }, ADESSO));
  //  ⚠️ Cinque minuti sono una scheda in secondo piano, non una finita: il
  //   battito rallentato dal browser arriva anche una volta al minuto.
  c("cinque minuti di silenzio non bastano", false,
    consulenzaDaChiudere({ live: true, hb: fa(5 * 60_000) }, ADESSO));
  c("mezz'ora sì", true, consulenzaDaChiudere({ live: true, hb: fa(30 * 60_000) }, ADESSO));
  c("cento ore, ovviamente sì", true, consulenzaDaChiudere({ live: true, hb: fa(100 * 3600_000) }, ADESSO));
  //  Una riga già chiusa non si tocca (né si riscrive a ogni lettura).
  c("una chiusa resta chiusa e basta", false,
    consulenzaDaChiudere({ live: false, hb: fa(100 * 3600_000) }, ADESSO));
  //  Righe vecchie senza battito: vale l'ora di apertura.
  c("senza battito vale quando è nata", true,
    consulenzaDaChiudere({ live: true, startedAt: fa(60 * 60_000) }, ADESSO));
  c("…e se è nata adesso, no", false,
    consulenzaDaChiudere({ live: true, startedAt: fa(10_000) }, ADESSO));
  //  ⚠️ Una riga viva senza nessuna data è rotta: non deve tenere aperta una
  //   stanza per sempre.
  c("una riga viva senza date si chiude", true, consulenzaDaChiudere({ live: true }, ADESSO));

  //  ── QUANDO NON C'È NIENTE DA RIPRENDERE ─────────────────────────────
  c("niente riga, niente ripresa", false, chiedi({ riga: null }));
  c("sessione chiusa sul server: si resta fuori", false, chiedi({ riga: riga({ live: false }) }));
  c("già aperta qui dentro: non si fa nulla", false, chiedi({ riga: riga(), giaAperta: true }));

  /*  ⚠️ NON SI CAMBIA STANZA SOTTO A CHI STA BUSSANDO: il codice deve essere lo
      stesso. Adottare quello del server era il guasto vecchio in cui «Accetta»
      mandava il via libera in una stanza dove il cliente non c'era. */
  c("un'altra consulenza non è la mia", false, chiedi({ riga: riga({ code: "altra-stanza" }) }));
  c("senza codice in mano non si riprende niente", false, chiedi({ riga: riga(), mioCodice: "" }));

  //  ⚠️ E NON SI RUBA QUELLA DI UN COLLEGA.
  c("la consulenza di un collega si lascia stare", false, chiedi({ riga: riga({ presenterId: "marco" }) }));
  //  Le righe delle versioni vecchie non hanno il nome: scartarle vorrebbe dire
  //  non riprendere niente proprio nel giorno della pubblicazione.
  c("riga senza nome: vale comunque", true, chiedi({ riga: riga({ presenterId: "" }) }));
  c("e vale anche se non so chi sono io", true, chiedi({ riga: riga(), ioSono: "" }));

  /*  ⚠️ NON SI RESUSCITA LA CONSULENZA DI IERI: il caso vero è una ricarica, e
      lì il battito ha pochi secondi. Una sessione lasciata aperta chiudendo il
      portatile non deve riaprirsi da sola — rimetterebbe in funzione un link
      che il consulente crede scaduto. In mezzo c'è il pulsante «Rientra». */
  c("battito di due minuti: si riprende", true, chiedi({ riga: riga({ hb: fa(120_000) }) }));
  c("battito di mezz'ora: no", false, chiedi({ riga: riga({ hb: fa(30 * 60_000) }) }));
  c("battito di ieri: no", false, chiedi({ riga: riga({ hb: fa(24 * 3600_000) }) }));
  c("nessun battito scritto: no", false, chiedi({ riga: riga({ hb: null }) }));
  c("battito illeggibile: no", false, chiedi({ riga: riga({ hb: "domani" }) }));
  //  L'orologio del computer non coincide con quello del server: un battito
  //  «nel futuro» è fresco, non impossibile.
  c("orologio avanti di un minuto: fresco", true, chiedi({ riga: riga({ hb: fa(-60_000) }) }));
  c("la finestra è di dieci minuti", 600000, RIPRESA_MAX_MS);
  /*  ── E QUANDO NON È PIÙ APERTA? ─────────────────────────────────────
      Trovato provando il pannello in locale: chiusa la consulenza sul server,
      la scheda del consulente continuava a mostrare «Cosa vede il cliente»
      col nome del cliente dentro — perché `sessionLive`, una volta acceso, lo
      spegneva solo chi chiudeva DA QUELLA scheda. */
  const mia = "abc-defg-hij";
  const viva = { live: true, code: mia, presenterId: "io", hb: new Date().toISOString() };
  const morta = { live: false, code: null, presenterId: "", hb: null };
  c("viva non si chiude", false, siChiudeLaConsulenza({ riga: viva, mioCodice: mia, negativeDiFila: 9 }));
  //  ⚠️ Mai sulla PRIMA lettura negativa: una rete che manca o la riga non
  //   ancora scritta non sono una chiusura, e spegnere per sbaglio vuol dire
  //   fermare il battito a metà consulenza.
  c("una lettura negativa non basta", false, siChiudeLaConsulenza({ riga: morta, mioCodice: mia, negativeDiFila: 1 }));
  c("due di fila sì", true, siChiudeLaConsulenza({ riga: morta, mioCodice: mia, negativeDiFila: 2 }));
  c("niente risposta non conclude niente", false, siChiudeLaConsulenza({ riga: null, mioCodice: mia, negativeDiFila: 5 }));
  c("senza il mio codice non si decide", false, siChiudeLaConsulenza({ riga: morta, mioCodice: "", negativeDiFila: 5 }));
  //  ⚠️ Una riga VIVA di un'altra stanza non parla di me: non è una chiusura.
  c("la diretta di un altro non mi chiude", false,
    siChiudeLaConsulenza({ riga: { ...viva, code: "zzz-zzzz-zzz" }, mioCodice: mia, negativeDiFila: 5 }));

}

/** ── DOVE COMPARE «FAI ENTRARE» ────────────────────────────────────────────
 *  Due segnalazioni opposte del committente, e la seconda è arrivata perché la
 *  prima era stata sistemata male:
 *   1. «la richiesta di accettare esce anche sul CRM: deve uscire solo sul
 *      Meetly del consulente che sta facendo il Meetly»;
 *   2. «quando entrano le persone non li ammette» — perché mentre aspetta il
 *      cliente il consulente sta NEL CRM, e la richiesta compariva su una
 *      pagina che in quel momento non era davanti a nessuno.
 *  La domanda giusta non è «che pagina è», è «la sta guardando qualcun altro?». */
function proveDiDoveSiAmmette() {
  const { siAmmetteQui, faroDaScrivere, leggiFaro, unAltraSchermataLaMostra, FARO_TTL_MS } = DSA;
  gruppo("DOVE COMPARE «FAI ENTRARE»");

  const ADESSO = 1_700_000_000_000;
  const faro = (p) => faroDaScrivere({ scheda: "scheda-A", code: "abc", adesso: ADESSO, ...p });
  const qui = (p) => siAmmetteQui({ adesso: ADESSO, miaScheda: "scheda-B", codice: "abc", ...p });

  //  ── SULLA SCHERMATA DELLA CONSULENZA: SEMPRE ────────────────────────
  c("sul Meetly la richiesta c'è", true, qui({ paginaDellaConsulenza: true, grezzo: faro() }));

  //  ── ALTROVE: DIPENDE SE LA GUARDA QUALCUNO ──────────────────────────
  c("il Meetly è aperto di là: sul CRM non compare", false,
    qui({ paginaDellaConsulenza: false, grezzo: faro() }));
  /*  ⚠️ IL CUORE DELLA SECONDA SEGNALAZIONE: nessun altro la sta guardando, e
      allora la richiesta compare dove c'è il consulente — gestionale compreso.
      Una richiesta che nessuno può vedere è peggio di una richiesta nel posto
      sbagliato: il cliente resta alla porta. */
  c("nessuno la guarda: sul CRM compare", true, qui({ paginaDellaConsulenza: false, grezzo: null }));
  c("faro illeggibile: compare", true, qui({ paginaDellaConsulenza: false, grezzo: "{rotto" }));

  //  ⚠️ IL FARO SCADE: una scheda chiusa non fa in tempo a spegnerlo.
  c("faro di 4 secondi: vale ancora", false,
    qui({ paginaDellaConsulenza: false, grezzo: faro({ adesso: ADESSO - 4000 }) }));
  c("faro di 8 secondi: scaduto, compare", true,
    qui({ paginaDellaConsulenza: false, grezzo: faro({ adesso: ADESSO - 8000 }) }));
  c("la scadenza è di sei secondi", 6000, FARO_TTL_MS);

  /*  ⚠️ IL FARO PROPRIO NON CONTA: passando da /presenta al CRM la scheda si
      ricarica e ritrova quello che aveva accesso lei stessa un istante prima.
      Preso per buono, la richiesta non comparirebbe dove ormai si sta
      guardando — cioè il guasto, di nuovo. */
  c("il faro di questa stessa scheda si ignora", true,
    siAmmetteQui({ adesso: ADESSO, miaScheda: "scheda-A", codice: "abc", paginaDellaConsulenza: false, grezzo: faro() }));

  //  ⚠️ E DEVE PARLARE DELLA STESSA CONSULENZA.
  c("un Meetly su un'altra consulenza non conta", true,
    qui({ paginaDellaConsulenza: false, grezzo: faro({ code: "altra" }) }));
  c("faro senza consulenza: non conta", true,
    qui({ paginaDellaConsulenza: false, grezzo: faro({ code: "" }) }));

  //  ── IL FARO SI SCRIVE E SI RILEGGE ──────────────────────────────────
  const letto = leggiFaro(faro());
  c("il faro dice chi l'ha accesso", "scheda-A", letto.scheda);
  c("e quale consulenza", "abc", letto.code);
  c("e quando", ADESSO, letto.t);
  c("un faro vuoto non si legge", null, leggiFaro(null));
  c("un faro senza scheda non vale", null, leggiFaro(JSON.stringify({ code: "abc", t: ADESSO })));
  c("un faro senza ora non vale", null, leggiFaro(JSON.stringify({ scheda: "A", code: "abc" })));
  c("la domanda diretta: la guarda un altro?", true,
    unAltraSchermataLaMostra({ grezzo: faro(), miaScheda: "scheda-B", codice: "abc", adesso: ADESSO }));
}

function proveDellaBussata() {
  const { esitoBussata, chiaveBussata } = BUS;
  gruppo("QUALCUNO BUSSA");

  //  ── LA PRIMA VOLTA SUONA ────────────────────────────────────────────
  c("una persona mai vista è nuova", "nuovo",
    esitoBussata({ dev: "D1", pid: "p1", inAttesa: [] }));

  //  ── E LE VOLTE DOPO NO ──────────────────────────────────────────────
  const inAttesa = [{ pid: "p1", dev: "D1" }];
  c("chi sta già aspettando non risuona", "giaInAttesa",
    esitoBussata({ dev: "D1", pid: "p1", inAttesa }));
  //  Ricaricando la pagina il pid cambia, il dispositivo no: è sempre lui.
  c("e nemmeno se ricarica la pagina", "giaInAttesa",
    esitoBussata({ dev: "D1", pid: "p2-nuovo", inAttesa }));

  /*  ⚠️ IL CUORE DELLA SEGNALAZIONE: senza codice del dispositivo.
      Prima qui rispondeva «nuovo» ogni volta — cioè una campana ogni quattro
      secondi, sul telefono di chi stava aspettando. */
  const senzaDev = [{ pid: "p9", dev: "" }];
  c("senza dispositivo, la prima volta suona", "nuovo",
    esitoBussata({ dev: "", pid: "p9", inAttesa: [] }));
  c("ma la seconda NO", "giaInAttesa",
    esitoBussata({ dev: "", pid: "p9", inAttesa: senzaDev }));
  c("e nemmeno la terza", "giaInAttesa",
    esitoBussata({ dev: "", pid: "p9", inAttesa: senzaDev }));
  //  Due persone diverse restano due persone diverse: la seconda deve suonare,
  //  o il consulente non si accorge che è arrivato qualcun altro.
  c("un'altra persona suona lo stesso", "nuovo",
    esitoBussata({ dev: "", pid: "p10", inAttesa: senzaDev }));

  //  ── CHI È GIÀ STATO FATTO ENTRARE ───────────────────────────────────
  //   Dopo l'ingresso la riga sparisce dall'elenco: senza questa memoria la
  //   bussata successiva sarebbe di nuovo «nuova» (ed è l'altra metà del
  //   guasto, perché chi entra continua a bussare finché non è dentro).
  c("chi è già ammesso rientra in silenzio", "giaAmmesso",
    esitoBussata({ dev: "D1", pid: "p1", ammessi: new Set(["D1"]), inAttesa: [] }));
  c("e vale anche senza dispositivo", "giaAmmesso",
    esitoBussata({ dev: "", pid: "p9", ammessi: new Set(["p9"]), inAttesa: [] }));

  //  ── I BLOCCATI ──────────────────────────────────────────────────────
  c("un dispositivo bloccato non entra", "bloccato",
    esitoBussata({ dev: "D-CATTIVO", pid: "p1", bloccati: new Set(["D-CATTIVO"]) }));
  /*  ⚠️ Il blocco vale SOLO sul dispositivo: un pid è una scheda del browser,
      e al ricaricamento successivo è già un'altra — cioè una porta che si
      riaprirebbe da sola. Meglio non prometterlo affatto. */
  c("ma un pid non si blocca", "nuovo",
    esitoBussata({ dev: "", pid: "p-cattivo", bloccati: new Set(["p-cattivo"]) }));

  //  ── LA CHIAVE ───────────────────────────────────────────────────────
  c("la chiave è il dispositivo, se c'è", "D1", chiaveBussata("D1", "p1"));
  c("altrimenti il pid", "p1", chiaveBussata("", "p1"));
  c("e gli spazi non contano", "D1", chiaveBussata("  D1  ", "p1"));
  c("senza niente, nessuna chiave", "", chiaveBussata("", ""));
}

/*  ═══════════════════════════════════════════════════════════════════════
    CHE COS'ERA PRIMA QUESTO CONTATTO DI RITORNO
    ───────────────────────────────────────────────────────────────────────
    Richiesta del committente: «sui lead di ritorno esca un distintivo: se è
    stata fatta una consulenza — e questo si vede dal tipo di stato del lead —
    oppure se è solo stato caricato, e se non risponde, o quello che è».
    Il rischio da coprire è uno: dire «mai chiamato» a chi la consulenza l'ha
    fatta. Succede a chi è stato rimesso fra i «da contattare», perché quel
    pulsante azzera lo stato — e allora lo stato di adesso non racconta più
    niente, mentre `statoAllora` racconta tutto.
    ═══════════════════════════════════════════════════════════════════════ */
function proveDellaStoriaDelRitorno() {
  const { storiaDelRitorno, patchRimettiInCoda } = RIC;
  gruppo("CHE COS'ERA PRIMA UN CONTATTO DI RITORNO");

  const con = (stato, extra = {}) => storiaDelRitorno({ stato, ...extra });

  c("chi ha comprato si riconosce", "Ha già comprato", con("posa_in_sede").etichetta);
  c("e anche chi ha versato l'acconto", "Ha già comprato", con("acconto").etichetta);
  c("la consulenza fatta si dice", "Consulenza già fatta", con("fatto").etichetta);
  c("e anche chi sta valutando l'ha fatta", "Consulenza già fatta", con("sta_valutando").etichetta);
  c("il cliente assente è una consulenza saltata", "Consulenza saltata", con("no_show").etichetta);
  c("l'appuntamento fissato si dice", "Aveva un appuntamento", con("appuntamento_fissato").etichetta);
  c("chi non risponde si dice", "Non ha mai risposto", con("non_risponde").etichetta);
  c("con i tentativi, quando ce ne sono", "Non ha mai risposto · 3 tentativi",
    con("non_risponde", { noRispondeCount: 3 }).etichetta);
  c("chi ha detto no si dice", "Aveva detto di no", con("annullato").etichetta);
  //  ⚠️ E chi non è mai stato chiamato lo DICHIARA: il silenzio si legge «non
  //   lo so», e chi telefona resta a indovinare.
  c("e chi è solo stato caricato pure", "Solo caricato, mai chiamato",
    con("da_contattare").etichetta);
  c("se è stato provato senza risposta, lo dice", true,
    /mai risposto/.test(con("da_contattare", { noRispondeCount: 2 }).etichetta));

  /*  ⚠️ LA PROVA CHE CONTA: dopo «rimettilo fra i da contattare» lo stato è
      azzerato, ma la storia no. Guardando solo lo stato di adesso, a uno che
      aveva fatto la consulenza si direbbe «mai chiamato» — e chi telefona gli
      rispiegherebbe il prodotto da capo. */
  const OGGI = new Date("2026-09-25T10:00:00Z");
  const avevaFatto = {
    stato: "fatto",
    ricarico: { volte: 1, ultimo: OGGI.toISOString(), daDecidere: true, statoAllora: "fatto" },
  };
  const rimesso = { ...avevaFatto, ...patchRimettiInCoda(avevaFatto, OGGI) };
  c("rimesso in coda, lo stato è azzerato", "da_contattare", rimesso.stato);
  c("ma la storia resta quella vera", "Consulenza già fatta", storiaDelRitorno(rimesso).etichetta);
  //  Ogni distintivo porta la sua riga di spiegazione: senza, il colore e due
  //  parole vanno interpretati.
  c("ogni distintivo si spiega", true,
    ["fatto", "no_show", "non_risponde", "da_contattare", "annullato", "acconto"].every(
      (st) => con(st).nota.length > 20,
    ));
  //  Una scheda vuota non fa cadere niente: risponde «mai chiamato».
  c("una scheda vuota non rompe", "Solo caricato, mai chiamato", storiaDelRitorno(null).etichetta);
}

/*  ═══════════════════════════════════════════════════════════════════════
    OGNI MESSAGGIO DICE CHI SIAMO
    ───────────────────────────────────────────────────────────────────────
    Richiesta del committente: «deve sempre integrare il link dei media a tutti
    i messaggi e fare capire chi siamo, perché sono persone che non si
    ricordano».
    Questa prova è una rete per il futuro: il giorno in cui qualcuno aggiunge un
    modello nuovo e si dimentica la presentazione, il messaggio parte da un
    numero sconosciuto a una persona che non ci ricorda — ed è il modo più
    rapido per farsi bloccare.
    ═══════════════════════════════════════════════════════════════════════ */
function proveDeiMessaggiConNome() {
  const { MODELLI_ORIGINALI, componiMessaggio } = WA;
  gruppo("OGNI MESSAGGIO DICE CHI SIAMO");

  const chiavi = Object.keys(MODELLI_ORIGINALI).filter((k) => k !== "firma");
  const senzaCasa = chiavi.filter((k) => !/Hair Genius Labs/.test(MODELLI_ORIGINALI[k]));
  c("nessun messaggio senza il nome della casa", "", senzaCasa.join(", "));

  /*  ⚠️ IL LINK DEI RISULTATI NON STA IN QUATTRO MESSAGGI, ED È VOLUTO: sono
      quelli il cui unico scopo è far toccare il link della consulenza
      (conferma, promemoria, link della stanza). Due collegamenti nello stesso
      messaggio vogliono dire un cliente che apre la galleria mentre il
      consulente lo aspetta nella stanza. */
  /*  ⚠️ E NON STA NEI QUATTRO DI CHI STA DECIDENDO, per la ragione opposta:
      lì il link che conta è il PREVENTIVO del cliente, e la raccolta dei
      lavori — che serve a farsi conoscere — a chi ha appena passato un'ora in
      consulenza dice «non mi ricordo chi sei». */
  const SENZA_RISULTATI = [
    "appuntamento_fissato", "appuntamento_rifissato", "link_consulenza", "promemoria",
    "da_ricontattare", "fissa_meet_dopo", "gestire_in_chat", "sta_valutando",
  ];
  const senzaLink = chiavi.filter((k) => !MODELLI_ORIGINALI[k].includes("/media/"));
  c("il link dei risultati manca solo dove c'è quello della consulenza",
    SENZA_RISULTATI.sort().join(","), senzaLink.sort().join(","));
  /*  ⚠️ Ognuno porta l'ALTRO link, non nessuno: i quattro dell'appuntamento
      quello della stanza, i quattro di chi sta decidendo quello del suo
      preventivo. Un messaggio senza nessuno dei due è un messaggio che non
      chiede di toccare niente. */
  c("e chi non ha i risultati porta l'altro link", "",
    SENZA_RISULTATI.filter((k) => !/\{link|\{preventivi\}/.test(MODELLI_ORIGINALI[k])).join(","));

  //  Composto con i valori veri: niente graffe rimaste in giro, e il nome del
  //  consulente entra nella presentazione.
  const testo = componiMessaggio(MODELLI_ORIGINALI.non_risponde, { nome: "Mario", consulente: "Filippo" });
  c("il messaggio si presenta col nome di chi scrive", true, /sono Filippo di Hair Genius Labs/.test(testo));
  c("e senza consulente si firma la casa", true,
    /un consulente di Hair Genius Labs/.test(componiMessaggio(MODELLI_ORIGINALI.non_risponde, { nome: "Mario" })));
  c("niente segnaposti rimasti", false, /[{}]/.test(testo));
  c("e i risultati sono allegati", true, testo.includes("/media/"));
}

/*  ═══════════════════════════════════════════════════════════════════════
    IL LINK «SOLO UNA COSA» SEGUE QUELLO CHE MOSTRI
    ───────────────────────────────────────────────────────────────────────
    Richiesta del committente: «mentre condivido il preventivo, se seleziono
    media deve mostrare i media; se condivido solo il link dei media e clicco
    su preventivo, deve mostrare il preventivo».
    Il rischio da coprire non è la navigazione: è mandare il cliente su una
    pagina che non è fatta per il suo link — una qualunque delle schermate del
    consulente — e ritrovarselo davanti a una richiesta di entrare in
    videochiamata, che è esattamente ciò che questo link promette di evitare.
    Per questo le mete sono due e l'elenco è chiuso.
    ═══════════════════════════════════════════════════════════════════════ */
function proveDelLinkCheSegue() {
  const { paginaPerIlLink, deveAndareSu, indirizzoDelLink, PAGINA_PREVENTIVO, PAGINA_MEDIA } = SEG;
  gruppo("IL LINK CHE SEGUE QUELLO CHE MOSTRI");

  c("il preventivo porta al preventivo", PAGINA_PREVENTIVO, paginaPerIlLink("/preventivo"));
  /*  ⚠️ `/presenta` è la POSTAZIONE dei media: al cliente si manda
      `/media-diretta`, che mostra lo stesso media senza i comandi. Mandarlo
      sulla postazione vorrebbe dire dargli in mano la libreria. */
  c("la postazione dei media porta alla pagina del cliente", PAGINA_MEDIA, paginaPerIlLink("/presenta"));
  c("e la pagina del cliente resta sé stessa", PAGINA_MEDIA, paginaPerIlLink("/media-diretta"));
  //  I parametri non contano: la postazione registra anche indirizzi interi.
  c("i parametri non cambiano la meta", PAGINA_PREVENTIVO, paginaPerIlLink("/preventivo?id=IDW5KL7&x=1"));

  //  ⚠️ L'ELENCO È CHIUSO: tutto il resto vale «resta dove sei».
  for (const altrove of ["/slide", "/web", "/prova-capelli?meet=1", "/CRM/importa", "/meetly/abc"])
    c(`«${altrove}» non sposta nessuno`, null, paginaPerIlLink(altrove));
  c("e nemmeno il vuoto", null, paginaPerIlLink(""));

  //  ── QUANDO SI CAMBIA DAVVERO ────────────────────────────────────────
  c("dal preventivo ai media si va", PAGINA_MEDIA, deveAndareSu("/presenta", "/preventivo"));
  c("dai media al preventivo pure", PAGINA_PREVENTIVO, deveAndareSu("/preventivo", "/media-diretta"));
  //  ⚠️ Se si è già dove si deve essere non si naviga: una navigazione per
  //   ogni battito vorrebbe dire una pagina che si rimonta ogni secondo e mezzo
  //   — cioè il canale che si richiude e il media che sparisce a ogni giro.
  c("ma se ci sei già non si fa niente", null, deveAndareSu("/preventivo", "/preventivo"));
  c("nemmeno sui media", null, deveAndareSu("/presenta", "/media-diretta"));

  //  ── L'IDENTITÀ DEL LINK NON SI PERDE ────────────────────────────────
  //   Senza `client=1` la pagina si comporta da postazione, senza `sess` non
  //   segue più nessuno: in tutti e due i casi il cliente resta davanti a una
  //   schermata muta.
  const url = indirizzoDelLink(PAGINA_MEDIA, "abc-def-ghi");
  c("il link porta client=1", true, /[?&]client=1/.test(url));
  c("e il codice della consulenza", true, /[?&]sess=abc-def-ghi/.test(url));
}

/*  ═══ LA CAMERA DEL CONSULENTE SUI LINK «SOLO UNA COSA» ═══════════════════
    Richiesta del committente: «fai che posso attivare e disattivare anche la
    mia camera anche su questi link».
    Il rischio da coprire non è il video — quello lo fa il browser — ma le tre
    cose che, sbagliate, si vedono solo con un cliente davanti:
     · aprire DUE connessioni alla stessa persona (due annunci ravvicinati) e
       non chiudere più la negoziazione: è già successo nel motore della
       chiamata, sta scritto lì;
     · applicare un annuncio destinato a un ALTRO cliente;
     · aprire una connessione a camera SPENTA, cioè mandare un rettangolo nero.
    ═══════════════════════════════════════════════════════════════════════ */
function proveDellaCameraSuiLink() {
  const { canaleCamera, CAM, perMe, deveOffrire, deveRiannunciarsi, candidatoApplicabile, deveRichiedere,
    connessioneDaRifare, posizioneValida, frazioneValida } = CML;
  gruppo("LA CAMERA SUI LINK «SOLO UNA COSA»");

  /*  ⚠️ IL CANALE È SUO. Se fosse quello della chiamata (`qcall-`) il cliente
      comparirebbe nell'elenco dei presenti come un ospite vero, con il bussare
      e il far entrare, davanti a una persona che non ha chiesto di entrare da
      nessuna parte. Se fosse quello dei media (`qvid-`) si mescolerebbero due
      protocolli sullo stesso filo. */
  c("il canale è tutto suo", "qcam-abc-def", canaleCamera("abc-def"));
  c("non è quello della chiamata", false, canaleCamera("x").startsWith("qcall-"));
  c("né quello dei media", false, canaleCamera("x").startsWith("qvid-"));

  //  I nomi degli annunci stanno in un posto solo: due parti che scrivono la
  //  stessa parola in due modi diversi non si sentono, e non se ne accorge
  //  nessuno finché non c'è un cliente davanti.
  c("ogni annuncio ha il suo nome, senza doppioni", Object.keys(CAM).length, new Set(Object.values(CAM)).size);

  //  ── A CHI È DESTINATO ───────────────────────────────────────────────
  c("l'annuncio mirato arriva a chi deve", true, perMe({ to: "io", from: "lui" }, "io"));
  c("e non a un altro cliente", false, perMe({ to: "altro" }, "io"));
  c("senza destinatario non è di nessuno", false, perMe({}, "io"));
  c("e chi non ha nome non prende niente", false, perMe({ to: "" }, ""));

  //  ── SERVE APRIRE UNA CONNESSIONE? ───────────────────────────────────
  c("cliente nuovo a camera accesa: sì", true, deveOffrire("pid1", { accesa: true, giaCollegati: [] }));
  /*  ⚠️ A CAMERA SPENTA NO: una connessione senza tracce vuol dire un
      rettangolo nero in un angolo dello schermo del cliente, che è peggio di
      nessun rettangolo — non si distingue da un guasto. */
  c("a camera spenta no", false, deveOffrire("pid1", { accesa: false, giaCollegati: [] }));
  /*  ⚠️ DUE ANNUNCI RAVVICINATI, UNA SOLA CONNESSIONE: il cliente ricarica, o
      la rete duplica l'annuncio. La seconda offerta arriverebbe mentre la
      prima sta ancora negoziando, e non si chiuderebbe più nessuna delle due. */
  c("a chi è già collegato non si riofre", false, deveOffrire("pid1", { accesa: true, giaCollegati: ["pid0", "pid1"] }));
  c("ma a un secondo cliente sì", true, deveOffrire("pid2", { accesa: true, giaCollegati: ["pid1"] }));
  c("un annuncio senza mittente non si serve", false, deveOffrire("", { accesa: true, giaCollegati: [] }));
  c("e nemmeno uno di soli spazi", false, deveOffrire("   ", { accesa: true, giaCollegati: [] }));

  //  ── IL CLIENTE SI RIANNUNCIA ────────────────────────────────────────
  //   Il link si apre quasi sempre PRIMA che il consulente accenda: senza
  //   questo riannuncio il cliente resterebbe a guardare il preventivo senza
  //   vedere mai la faccia di chi gliene sta parlando.
  c("camera accesa: il cliente si rifà vivo", true, deveRiannunciarsi({ on: true }));
  c("camera spenta: nessun annuncio a vuoto", false, deveRiannunciarsi({ on: false }));
  //  ⚠️ Solo il vero `true`: un annuncio malformato non deve valere «accesa».
  c("un «on» che non è vero non conta", false, deveRiannunciarsi({ on: "true" }));
  c("e nemmeno un annuncio vuoto", false, deveRiannunciarsi({}));

  /*  ── ⚠️ LO SCHERMO NERO ─────────────────────────────────────────────
      Segnalazione del committente: «non funziona, non mostra l'immagine della
      videocamera del presentatore ma schermo nero».
      Era questo: i candidati di rete arrivano PRIMA che la descrizione
      dell'altro lato sia applicata — tanto più che la prima offerta aspetta
      anche le credenziali TURN, che sono una chiamata di rete. Applicarli lì
      fallisce, e buttarli via vuol dire una strada in meno per far passare il
      video: la connessione si negozia, sembra tutto a posto, e l'immagine non
      arriva mai. Chi risponde «no» qui NON butta niente: mette da parte. */
  c("candidato applicabile: c'è la descrizione dell'altro", true,
    candidatoApplicabile({ remoteDescription: { type: "answer" } }));
  c("descrizione non ancora applicata: si mette da parte", false,
    candidatoApplicabile({ remoteDescription: null }));
  c("descrizione senza tipo: non vale", false, candidatoApplicabile({ remoteDescription: {} }));
  c("connessione non ancora aperta: si mette da parte", false, candidatoApplicabile(null));

  //  ── IL RICHIAMO SI SPEGNE DA SÉ ─────────────────────────────────────
  //   ⚠️ Richiamare a immagine già arrivata vorrebbe dire una connessione
  //    rifatta da capo ogni quattro secondi: la faccia del consulente che si
  //    spegne e si riaccende mentre sta parlando.
  c("niente immagine e camera accesa: si richiede", true,
    deveRichiedere({ vivo: true, riceve: false, accesaLaggiu: true }));
  c("immagine arrivata: si smette", false,
    deveRichiedere({ vivo: true, riceve: true, accesaLaggiu: true }));
  c("camera spenta: non si chiede a vuoto", false,
    deveRichiedere({ vivo: true, riceve: false, accesaLaggiu: false }));
  c("canale non ancora pronto: nessuno sentirebbe", false,
    deveRichiedere({ vivo: false, riceve: false, accesaLaggiu: true }));

  /*  ── ⚠️ «OGNI TANTO SI NASCONDE DA SOLA» ────────────────────────────
      Segnalazione del committente. Il cliente si riannuncia quando non vede
      niente, e da questa parte si buttava tutto quello che non fosse già
      `connected` o `connecting` — ma una connessione appena creata sta in
      `new`. Ogni annuncio la faceva ricominciare da capo: il cerchio compariva,
      spariva e ridiventava nero mentre il consulente parlava.
      Si rifà solo quello che è davvero morto. `disconnected` quasi sempre si
      riprende da sé: il rimedio dev'essere più lento del guasto. */
  c("connessione appena nata: non si tocca", false, connessioneDaRifare("new"));
  c("sta negoziando: non si tocca", false, connessioneDaRifare("connecting"));
  c("collegata: non si tocca", false, connessioneDaRifare("connected"));
  c("morta: si rifà", true, connessioneDaRifare("failed"));
  c("chiusa: si rifà", true, connessioneDaRifare("closed"));
  c("un colpo di rete: si aspetta", false, connessioneDaRifare("disconnected"));
  c("ma se chiede da un pezzo, si rifà", true, connessioneDaRifare("disconnected", { insistente: true }));
  //  ⚠️ Uno stato che non conosciamo vale «lasciala stare»: il danno di
  //   riaprire a sproposito si vede, quello di aspettare no.
  c("stato sconosciuto: si lascia stare", false, connessioneDaRifare("boh"));
  c("nessuno stato: si lascia stare", false, connessioneDaRifare(null));

  /*  ── DOVE STA E QUANTO È GRANDE, DETTO DALL'ALTRO LATO ──────────────
      «Dove posiziono il riquadro si deve spostare, dove lo metto e la
      grandezza che metto»: i due lati se lo dicono. Arriva da un messaggio di
      rete, quindi si controlla: una posizione assurda metterebbe la camerina
      fuori dallo schermo, cioè la farebbe sparire senza che nessuno capisca
      perché. */
  c("posizione buona", JSON.stringify({ x: 0.5, y: 0.25 }), JSON.stringify(posizioneValida({ x: 0.5, y: 0.25 })));
  c("fuori scala si riporta dentro", JSON.stringify({ x: 1, y: 0 }), JSON.stringify(posizioneValida({ x: 4, y: -2 })));
  c("posizione a metà: non vale", null, posizioneValida({ x: 0.5 }));
  c("niente posizione: niente da applicare", null, posizioneValida(null));
  c("misura condivisa buona", 0.28, frazioneValida(0.28));
  c("misura zero: non vale", null, frazioneValida(0));
  //  Una frazione di 12 vorrebbe dire una camerina dodici volte lo schermo.
  c("misura assurda: non vale", null, frazioneValida(12));
  c("misura non numerica: non vale", null, frazioneValida("grande"));
}

function proveDeiPezziMancanti() {
  const { erroreDiVersione } = VER;
  gruppo("IL PEZZO DELL'APP CHE NON ARRIVA");

  //  Chrome / Edge
  c("Chrome: modulo importato dinamicamente", true,
    erroreDiVersione({ message: "Failed to fetch dynamically imported module: https://…/assets/CRM-abc.js" }));
  c("Chrome: richiesta caduta", true, erroreDiVersione({ name: "TypeError", message: "Failed to fetch" }));
  c("Chrome: pezzo non caricato", true, erroreDiVersione({ name: "ChunkLoadError", message: "Loading chunk 42 failed" }));

  /*  ⚠️ WEBKIT, cioè OGNI browser su iPhone — anche Chrome per iPhone, che
      sotto è Safari. Sono le tre frasi che mancavano. */
  c("iPhone: errore sconosciuto scaricando lo script", true,
    erroreDiVersione({ message: "An unknown error occurred when fetching the script." }));
  c("iPhone: script non caricabile", true, erroreDiVersione({ message: "Unable to load script" }));
  c("iPhone: richiesta caduta", true, erroreDiVersione({ name: "TypeError", message: "Load failed" }));
  //  Safari dice anche questa, ed era l'unica già riconosciuta delle sue.
  c("iPhone: importazione del modulo fallita", true,
    erroreDiVersione({ message: "Importing a module script failed." }));

  //  ⚠️ E NON DEVE RICONOSCERE TUTTO: un errore vero del programma va
  //   mostrato, non nascosto sotto un ricaricamento che non risolve niente.
  c("un errore del programma non si ricarica", false,
    erroreDiVersione({ name: "TypeError", message: "undefined is not a function" }));
  c("nemmeno un guasto del database", false,
    erroreDiVersione({ message: "new row violates row-level security policy" }));
  c("niente errore, niente ricaricamento", false, erroreDiVersione(null));
  c("un errore senza messaggio non basta", false, erroreDiVersione({}));

  /*  ── QUANTE VOLTE SI RICARICA ─────────────────────────────────────────
      Segnalazione del committente, due sere di fila: entrando come
      presentatore, «Importing a module script failed». Il sito stava bene —
      i 68 pezzi della pagina rispondevano tutti — era la sua scheda, aperta
      da prima di una pubblicazione, che chiedeva un pezzo col nome di ieri.
      E il soccorso NON partiva, perché il segno «ho già ricaricato» era un
      sì/no che restava scritto proprio nei casi in cui l'applicazione non
      riusciva a partire (a cancellarlo era l'applicazione che parte). Una
      volta speso, per sempre: schermata tecnica e un pulsante «Try again»
      che ritentava lo stesso pezzo mancante.
      Qui si prova il conteggio nuovo. È la parte che può sbagliare: il
      ricaricamento in sé è una riga. */
  const { decidiTentativo, TENTATIVI_MAX, FINESTRA_MS } = VER;
  gruppo("QUANTE VOLTE SI RICARICA PER UN PEZZO MANCANTE");
  const T0 = 1_700_000_000_000;

  //  Prima volta: nessun segno, si ricarica.
  const primo = decidiTentativo(null, T0);
  c("la prima volta si ricarica", true, primo.ricarica);
  c("e si scrive il primo tentativo", { n: 1, da: T0 }, JSON.parse(primo.segno));

  //  Seconda, subito dopo: si concede ancora (è il caso normale — la seconda
  //  schermata chiede un altro pezzo della stessa versione vecchia).
  const secondo = decidiTentativo(primo.segno, T0 + 2_000);
  c("la seconda volta si ricarica ancora", true, secondo.ricarica);
  //  ⚠️ LA FINESTRA NON SI SPOSTA: `da` resta quello del primo tentativo. Se
  //   si rinnovasse, due ricaricamenti a catena la porterebbero avanti in
  //   eterno e il conteggio non scadrebbe mai.
  c("la finestra parte dal primo tentativo", T0, JSON.parse(secondo.segno).da);
  c("e il conteggio è a due", TENTATIVI_MAX, JSON.parse(secondo.segno).n);

  //  ⚠️ IL FRENO: alla terza si smette. Se una pubblicazione è rotta davvero,
  //   la scheda non deve girare a vuoto: si mostra la schermata col pulsante.
  c("alla terza si smette", false, decidiTentativo(secondo.segno, T0 + 3_000).ricarica);
  c("e non si smette per sempre: passata la finestra si riparte", true,
    decidiTentativo(secondo.segno, T0 + FINESTRA_MS + 1).ricarica);
  c("riparte da capo, non da due", 1,
    JSON.parse(decidiTentativo(secondo.segno, T0 + FINESTRA_MS + 1).segno).n);
  //  Sul bordo esatto la finestra vale ancora: dentro è dentro.
  c("sul bordo della finestra il conteggio vale ancora", false,
    decidiTentativo(secondo.segno, T0 + FINESTRA_MS).ricarica);

  //  Un segno illeggibile non deve bloccare il soccorso: si riparte da zero.
  for (const storto of ["", "{", "null", '{"n":2}', '{"n":"tanti","da":0}', "[]"])
    c(`segno storto «${storto}»: si ricarica`, true, decidiTentativo(storto, T0).ricarica);

  //  ⚠️ E NON SI SCRIVE MAI UN SEGNO QUANDO NON SI RICARICA: sarebbe un modo
  //   silenzioso di spegnere il soccorso per sempre.
  c("se non si ricarica non si scrive niente", undefined, decidiTentativo(secondo.segno, T0 + 3_000).segno);

  /*  ── QUALI PEZZI SI RICHIEDONO SCAVALCANDO LA CACHE ────────────────────
      Segnalazione del committente, davanti alla schermata nuova: «dice così
      ma non va». Ricaricava e tornava lo stesso errore — e non poteva essere
      altrimenti: i pezzi sono serviti `immutable` (public/_headers), quindi
      una copia arrivata storta resta in pancia al browser per un anno e ogni
      ricaricamento la ripesca identica. Adesso prima di ricaricare li si
      richiede con `cache: "reload"`, che va in rete e SOSTITUISCE la copia.
      Qui si prova la scelta degli indirizzi: è la parte che sbaglia. */
  const { pezziDaRinfrescare } = VER;
  gruppo("QUALI PEZZI SI RICHIEDONO");

  c("si prendono i pezzi dell'app", ["/assets/index-abc.js", "/assets/stili-abc.css"],
    pezziDaRinfrescare(["/assets/index-abc.js", "/assets/stili-abc.css"]));

  //  ⚠️ L'ULTIMO FALLITO VA PER PRIMO: se la rete è lenta e il tempo scade,
  //   dev'essere quello che abbiamo fatto in tempo a richiedere.
  c("l'ultimo fallito apre la fila", "/assets/call-zzz.js",
    pezziDaRinfrescare(["/assets/index-abc.js"], "/assets/call-zzz.js")[0]);
  c("e non ci finisce due volte", 2,
    pezziDaRinfrescare(["/assets/a-1.js", "/assets/b-2.js"], "/assets/a-1.js").length);
  //  Lo stesso file può arrivare scritto in due modi: è sempre lui.
  c("indirizzo intero e percorso sono lo stesso pezzo", 1,
    pezziDaRinfrescare(["https://sito.it/assets/a-1.js", "/assets/a-1.js"]).length);
  c("la query non fa un pezzo nuovo", 1,
    pezziDaRinfrescare(["/assets/a-1.js?v=2", "/assets/a-1.js"]).length);

  //  ⚠️ E NON SI RICHIEDE TUTTO IL RICHIEDIBILE: chiedere immagini, font o
  //   file di altri domini sarebbe traffico inutile fra l'utente e il rimedio.
  for (const fuori of ["/tagli/foto.jpg", "https://altro.it/assets/a-1.js".replace("/assets/a-1.js", "/roba.js"),
                       "/assets/logo-abc.png", "/api/versione", "", null, undefined, 42])
    c(`fuori dall'elenco: ${String(fuori)}`, 0, pezziDaRinfrescare([fuori]).length);
  //  Un pezzo su un altro dominio, invece, è un pezzo: lo si richiede.
  c("un pezzo servito da un altro dominio ci sta", 1,
    pezziDaRinfrescare(["https://cdn.sito.it/assets/a-1.js"]).length);

  //  Il tetto: una pagina del CRM ne dichiara più di cento.
  c("non più di quaranta per volta", 40,
    pezziDaRinfrescare(Array.from({ length: 120 }, (_, i) => `/assets/p-${i}.js`)).length);
}

/*  ═══════════════════════════════════════════════════════════════════════
    DI QUALE CONSULENZA È QUESTO DISPOSITIVO
    ───────────────────────────────────────────────────────────────────────
    Segnalazione del committente: «quando creo il preventivo non gli mostra il
    preventivo creato, ma solo mentre lo creo».
    La pagina si faceva questa domanda in due punti con due risposte diverse:
    il canale in tempo reale usava il codice del link dell'ospite, il controllo
    periodico usava quello della consulenza CONDOTTA dal dispositivo — che sul
    telefono del cliente non esiste. Partiva senza codice, il server rispondeva
    con la riga condivisa, e quella riga (riscritta di continuo, con orologio
    fresco) sorpassava ogni secondo lo stato vero: il preventivo creato spariva
    e tornava il configuratore.
    Qui si prova la regola, una volta sola e per tutti e due i punti.
    ═══════════════════════════════════════════════════════════════════════ */
/*  ═══════════════════════════════════════════════════════════════════════
    DOVE SI CONDUCE UNA CONSULENZA
    ───────────────────────────────────────────────────────────────────────
    Segnalazione del committente: «quando un cliente entra su Meetly, la
    richiesta di accettarlo esce anche sul CRM; deve uscire solo sul Meetly del
    consulente che sta facendo il Meetly».
    Il motore della consulenza è montato su tutta l'applicazione — serve, la
    chiamata non deve cadere quando il consulente cambia schermata — quindi chi
    ha una consulenza viva ne è il padrone di casa anche mentre guarda l'elenco
    dei lead, e il riquadro «fai entrare» compariva lì sopra.
    ═══════════════════════════════════════════════════════════════════════ */
/*  ═══════════════════════════════════════════════════════════════════════
    CHI METTERE NEL PANNELLO DEI PREVENTIVI
    ───────────────────────────────────────────────────────────────────────
    Segnalazione del committente, in piena consulenza: «manca tutto regie del
    preventivo». Spariva il pannello INTERO, e la regola che lo faceva sparire
    era «si mostra solo se c'è almeno una persona ATTESA» — cioè una riga di
    appuntamento in archivio. Ma una consulenza si apre anche mandando il
    link: quello scrive il suo nome alla porta ed entra, attesi zero, e il
    consulente resta senza preventivo, senza interruttori, senza niente.
    ═══════════════════════════════════════════════════════════════════════ */
/*  ═══════════════════════════════════════════════════════════════════════
    QUESTO ERRORE È NOSTRO?
    ───────────────────────────────────────────────────────────────────────
    Segnalazione del committente, in mezzo a una consulenza: il riquadro
    arancione «Problema sul dispositivo del cliente — Promise non gestita:
    Cannot read properties of undefined» con «Ricarica il dispositivo del
    cliente». Nel diario degli errori del cliente lo stack c'è per intero:
      at Y (chrome-extension://eppiocemhmnl…/executors/200.js:1:761)
    Era un'ESTENSIONE del browser del cliente, che inciampa da sola ogni
    minuto. Ricaricare non poteva servire a niente.
    ═══════════════════════════════════════════════════════════════════════ */
function proveDegliErroriEsterni() {
  const { erroreDaMostrare, daUnEstensione } = EXT;
  gruppo("QUESTO ERRORE È NOSTRO?");

  //  ⚠️ IL CASO VERO, copiato dal diario parola per parola.
  const veroStack = "TypeError: Cannot read properties of undefined (reading 'M_ID')\n    at Y (chrome-extension://eppiocemhmnlbhjplcgkofciiegomcon/executors/200.js:1:761)";
  c("l'errore vero dell'estensione non si mostra", false,
    erroreDaMostrare("Promise non gestita: Cannot read properties of undefined (reading 'M_ID')", veroStack));
  c("e si riconosce da dove viene", true, daUnEstensione("", veroStack));

  //  Ogni browser ha il suo indirizzo per le estensioni.
  for (const schema of ["chrome-extension", "moz-extension", "safari-web-extension", "edge-extension", "opera-extension"])
    c(`${schema} non è nostro`, false, erroreDaMostrare("boom", `at X (${schema}://abc/f.js:1:1)`));

  //  «Script error.» senza traccia: il browser non dice niente a nessuno.
  c("«Script error.» muto non si mostra", false, erroreDaMostrare("Script error.", ""));
  c("nemmeno dentro una promessa", false, erroreDaMostrare("Promise non gestita: Script error.", ""));
  //  ⚠️ Ma con una traccia è un errore vero, e si mostra.
  c("con una traccia invece sì", true, erroreDaMostrare("Script error.", "at q (/assets/call-abc.js:9:1)"));

  c("un errore senza niente dentro non è una notizia", false, erroreDaMostrare("", ""));
  c("né con spazi al posto del messaggio", false, erroreDaMostrare("   ", "  "));

  /*  ⚠️ E NEL DUBBIO È NOSTRO: un errore vero nascosto costa una consulenza,
      un avviso di troppo costa una riga letta. */
  c("un errore nostro si mostra", true,
    erroreDaMostrare("Cannot read properties of undefined (reading 'gettone')", "at PlanciaGruppo (/assets/call-abc.js:1:1)"));
  c("anche senza traccia, se il messaggio dice qualcosa", true,
    erroreDaMostrare("quotestate: 500", ""));
  //  Una parola che SOMIGLIA a un'estensione non basta: si guarda l'indirizzo.
  c("«extension» dentro al testo non scarta niente", true,
    erroreDaMostrare("errore nella extension della garanzia", "at f (/assets/x.js:1:1)"));
}

/*  ═══════════════════════════════════════════════════════════════════════
    CHI HA IL MICROFONO SPENTO DAL CONSULENTE
    ───────────────────────────────────────────────────────────────────────
    Lo stato del microfono di un ospite non viaggia nel roster: il consulente
    manda l'ordine e il dispositivo obbedisce, ma nessuno lo racconta
    indietro. Se ne deve ricordare chi disegna l'interruttore — e da quando i
    comandi stanno in DUE posti (il pannello «Partecipanti» e il menu che si
    apre tenendo premuto sulla camera) la memoria dev'essere una sola, se no
    i due si contraddicono in faccia al consulente.
    ═══════════════════════════════════════════════════════════════════════ */
function proveDeiMuti() {
  const { eMuto, segnaMuto, scambiaMuto, soloQuestiRestano, elencoMuti } = MUTI;
  gruppo("CHI HA IL MICROFONO SPENTO");

  //  Si parte con tutti che parlano.
  soloQuestiRestano([]);
  c("all'inizio non è muto nessuno", 0, elencoMuti().length);

  c("silenziato", true, segnaMuto("a1", true));
  c("e lo risulta", true, eMuto("a1"));
  c("gli altri no", false, eMuto("b2"));

  //  ⚠️ È UN INTERRUTTORE, non un bottone che spegne due volte: è tutta la
  //   ragione per cui questa memoria esiste.
  c("il secondo colpo lo riattiva", false, scambiaMuto("a1"));
  c("e il terzo lo rimuta", true, scambiaMuto("a1"));

  //  Silenziare due volte non cambia niente, e non si sdoppia in elenco.
  segnaMuto("a1", true);
  c("niente doppioni", 1, elencoMuti().length);

  //  ⚠️ CHI ESCE DALLA STANZA NON RESTA MUTO. Se rientra comanda lui il suo
  //   microfono, e mostrare «muto» su una persona che ti sta parlando è il
  //   genere di bugia che fa premere il pulsante sbagliato.
  segnaMuto("b2", true);
  soloQuestiRestano(["b2"]);
  c("chi è uscito esce anche da qui", false, eMuto("a1"));
  c("chi è rimasto resta com'era", true, eMuto("b2"));

  //  Un pid vuoto non è nessuno: non si segna, e non sporca l'elenco.
  c("un pid vuoto non si segna", false, segnaMuto("", true));
  c("l'elenco non cambia", ["b2"], elencoMuti());

  //  Chi ascolta viene avvisato SOLO quando cambia davvero.
  let avvisi = 0;
  const basta = MUTI.ascoltaMuti(() => { avvisi += 1; });
  segnaMuto("b2", true);   // era già muto: niente da dire
  c("nessun avviso se non cambia niente", 0, avvisi);
  segnaMuto("b2", false);
  c("un avviso quando cambia", 1, avvisi);
  basta();
  segnaMuto("b2", true);
  c("e chi ha smesso di ascoltare non riceve più niente", 1, avvisi);
  soloQuestiRestano([]);
}

/*  ═══════════════════════════════════════════════════════════════════════
    CHI RESTA NEI RIQUADRI DELLA VIDEOCHIAMATA
    ───────────────────────────────────────────────────────────────────────
    Segnalazione del committente, con due fotografie a quattro secondi di
    distanza: nella prima il riquadro del cliente non c'è, nella seconda c'è.
    «Continuamente mi scollega la camera dell'utente e la rimette».
    Il riquadro si toglieva per tre motivi che a quel cliente capitavano tutti
    insieme — nessun saluto da 10s (ma i saluti li manda la SUA scheda, che
    stando in secondo piano il browser rallenta o ferma), nessuna connessione
    dopo 12s, connessione mai arrivata a «collegato» dopo 45. Con la camera
    spenta non arriva nessun flusso, quindi la connessione resta a
    «connessione…» e quei tagli scattano su una persona che è lì.
    ═══════════════════════════════════════════════════════════════════════ */
/*  ═══════════════════════════════════════════════════════════════════════
    LA GARANZIA 15 MESI: O IL 35%, O IL CODICE
    ───────────────────────────────────────────────────────────────────────
    Richiesta del committente, in due tempi: «di default la garanzia 15 mesi è
    con sconto del 35% sul totale», e «se metto codice promozionale dei 450
    invece si toglie il discorso 35% e rimane l'importo fisso del codice».
    Le due non possono sommarsi: il 35% ESISTE perché la garanzia è dentro il
    prezzo, e un codice che la vende a parte a cifra fissa la toglie da lì.
    Sommarle non è «più generoso»: è un preventivo che non sa più cosa sta
    vendendo, e a fine mese un conto che non torna.
    ═══════════════════════════════════════════════════════════════════════ */
/*  ═══════════════════════════════════════════════════════════════════════
    LA PATCH NON SI CONFIGURA, E HA UN ACCONTO SUO
    ───────────────────────────────────────────────────────────────────────
    Due segnalazioni del committente, nello stesso giorno e sullo stesso
    prodotto: «la patch cutanea nel riepilogo mostra le opzioni dell'Invisible
    Derm Protocol, non deve mostrarle» e «per la patch l'acconto sia diverso».
    ═══════════════════════════════════════════════════════════════════════ */
function provePatchCutanea() {
  const { sectionsFor, siPersonalizza, accontoDi, ACCONTO_DI_CASA } = QMN;
  gruppo("LA PATCH NON SI CONFIGURA");

  const sezioni = [
    { nome: "generica" },
    { nome: "solo derm", onlyFor: ["invisible-derm"] },
    { nome: "solo trapianto", onlyFor: ["trapianto"] },
  ];

  //  ⚠️ IL GUASTO: la patch vedeva tutte le sezioni generiche. Sullo schermo
  //   non si disegnavano (la pagina lo sapeva), ma restavano VIVE nel conto:
  //   le preselezioni del pannello finivano nel riepilogo di un prodotto che
  //   quelle opzioni non le ha.
  c("la patch non ha nessuna sezione", 0, sectionsFor(sezioni, "patch-standard").length);
  c("il top di gamma ha la generica e la sua", 2, sectionsFor(sezioni, "invisible-derm").length);
  c("il trapianto vede solo la sua", 1, sectionsFor(sezioni, "trapianto").length);
  c("e non quella generica", false,
    sectionsFor(sezioni, "trapianto").some((x) => x.nome === "generica"));
  //  La domanda ha una risposta sola, ed è questa: la pagina la fa a lei.
  c("la patch non si personalizza", false, siPersonalizza("patch-standard"));
  c("il top di gamma sì", true, siPersonalizza("invisible-derm"));
  c("il trapianto sì (ha i suoi accessori)", true, siPersonalizza("trapianto"));
  c("una base sconosciuta non si personalizza", false, siPersonalizza("roba-nuova"));

  //  ── L'ACCONTO PER SOLUZIONE
  gruppo("L'ACCONTO DI OGNI SOLUZIONE");
  c("senza listino vale quello di casa", ACCONTO_DI_CASA, accontoDi({}, "patch-standard"));
  c("il listino generale vale per tutte", 200, accontoDi({ acconto: 200 }, "patch-standard"));
  //  ⚠️ Il cuore: la patch può averne uno suo, e vince su quello generale.
  c("la patch può averne uno suo", 50,
    accontoDi({ acconto: 200, accontoPerBase: { "patch-standard": 50 } }, "patch-standard"));
  c("e non tocca le altre", 200,
    accontoDi({ acconto: 200, accontoPerBase: { "patch-standard": 50 } }, "invisible-derm"));
  //  ⚠️ Zero è una decisione («questo prodotto non chiede acconto»), non un
  //   campo vuoto: deve restare dicibile.
  c("zero vuol dire zero", 0,
    accontoDi({ acconto: 200, accontoPerBase: { "patch-standard": 0 } }, "patch-standard"));
  //  Un numero storto non deve poter azzerare l'acconto di nascosto.
  c("un valore illeggibile torna a quello generale", 200,
    accontoDi({ acconto: 200, accontoPerBase: { "patch-standard": NaN } }, "patch-standard"));
  c("e uno negativo pure", 200,
    accontoDi({ acconto: 200, accontoPerBase: { "patch-standard": -10 } }, "patch-standard"));
  c("senza base si usa quello generale", 200, accontoDi({ acconto: 200 }));
}

function proveDellaGaranzia() {
  const { leggiMappa, garanziaDa } = GAR;
  const { prezzoDalSecondo, tipoOfferta, offertaDelCodice, limiteInParole, offertaValida,
    giornoDellaScadenza, scadenzaEffettiva, frasiCodiceApplicato } = PGA;
  gruppo("LA PROMO DEL SECONDO IMPIANTO");

  const OGGI = new Date("2026-10-01T10:00:00");

  /*  ⚠️ NIENTE PIÙ PROMOZIONI AUTOMATICHE. Richiesta del committente: «fai che
      in automatico non c'è nessuna garanzia dei 15 mesi, rimuovila». Senza un
      codice non esiste nessuna offerta: il preventivo è il preventivo. */
  c("senza codice non c'è nessuna offerta", null, prezzoDalSecondo({ pieno: 2000 }));
  c("e nemmeno con un codice che non dice niente", null,
    prezzoDalSecondo({ pieno: 2000, offerta: { mostra: true, importo: 0 } }));
  c("un codice che nasconde la garanzia non è un'offerta", null,
    tipoOfferta({ mostra: false, importo: 250 }));

  //  ── I DUE MODI: prezzo fisso, oppure percentuale sull'importo.
  const fisso = { mostra: true, importo: 550 };
  c("prezzo fisso: è di quel tipo", "fisso", tipoOfferta(fisso));
  c("il secondo costa quella cifra", 550, prezzoDalSecondo({ pieno: 2000, offerta: fisso }).prezzo);
  c("e si vede quanto risparmia", 1450, prezzoDalSecondo({ pieno: 2000, offerta: fisso }).risparmio);
  c("in percentuale, per la frase", 73, prezzoDalSecondo({ pieno: 2000, offerta: fisso }).percento);

  const percento = { mostra: true, importo: 0, sconto: 30 };
  c("percentuale: è di quel tipo", "percento", tipoOfferta(percento));
  c("il secondo costa il 30% in meno", 1400, prezzoDalSecondo({ pieno: 2000, offerta: percento }).prezzo);
  c("e il risparmio è quello", 600, prezzoDalSecondo({ pieno: 2000, offerta: percento }).risparmio);
  //  ⚠️ LA PERCENTUALE SI CALCOLA SUL PREZZO, e questo è il motivo per cui NON
  //   si converte in euro al momento di salvarla: su un preventivo da 800 e uno
  //   da 1.200 «meno 30%» sono due cifre diverse, ed è quello che vuol dire.
  c("su un preventivo più piccolo vale meno", 560,
    prezzoDalSecondo({ pieno: 800, offerta: percento }).prezzo);
  //  Con tutti e due scritti comanda la percentuale: è l'ultima cosa impostata.
  c("la percentuale vince sul fisso", "percento", tipoOfferta({ mostra: true, importo: 550, sconto: 30 }));

  //  ⚠️ E non si scende mai sotto zero: una percentuale sbagliata non deve
  //   poter promettere di RIDARE dei soldi.
  c("oltre il 100% il prezzo resta zero", 0,
    prezzoDalSecondo({ pieno: 2000, offerta: { mostra: true, importo: 0, sconto: 150 } }).prezzo);
  c("e un fisso più alto del pieno non regala niente", 0,
    prezzoDalSecondo({ pieno: 500, offerta: { mostra: true, importo: 900 } }).risparmio);
  //  Si arrotonda al centesimo: questa cifra finisce su un documento.
  c("si arrotonda al centesimo", 1527.5,
    prezzoDalSecondo({ pieno: 2350, offerta: { mostra: true, importo: 0, sconto: 35 } }).prezzo);

  /*  ── IL PERCHÉ, E NE ESISTONO DUE ──────────────────────────────────────
      Testi del committente, uno per tipo di offerta. Con un PREZZO FISSO si
      spiegano due cose — il lavoro già fatto e la finestra del laboratorio (25
      impianti in 14 giorni) — perché è quella finestra a rendere possibile
      proprio quella cifra adesso. Con una PERCENTUALE resta solo la prima: una
      percentuale è una condizione che si tiene nel tempo, e appiccicarle sopra
      un'urgenza che non c'entra vorrebbe dire prometterne la scadenza senza
      averla. */
  const { disclaimerDi } = PGA;
  c("col prezzo fisso si spiega anche la finestra del laboratorio", true,
    /25 impianti entro 14 giorni/.test(disclaimerDi(fisso)));
  c("e il lavoro già fatto c'è in tutti e due", true,
    /attaccatura, densità, direzione e misure della calotta/.test(disclaimerDi(fisso)) &&
    /attaccatura, densità, direzione e misure della calotta/.test(disclaimerDi(percento)));
  //  ⚠️ Alla percentuale NON si attacca l'urgenza del laboratorio: quella
  //   spiega una cifra messa lì adesso, non una condizione che resta.
  c("alla percentuale non si attacca l'urgenza", false,
    /laboratorio/.test(disclaimerDi(percento)));
  c("senza offerta vale la spiegazione piena", true,
    /laboratorio/.test(disclaimerDi(null)));

  //  ⚠️ Le due spiegazioni dicono tutte e due la cosa che conta — da quando
  //   vale il prezzo — perché è la riga che il cliente cerca per prima.
  c("tutte e due dicono da quando vale", true,
    /dal secondo impianto/.test(disclaimerDi(fisso)) &&
    /dal secondo impianto/.test(disclaimerDi(percento)));

  //  ── Le parole del limite: si scrive solo quello che è vero.
  c("senza limiti non si promette niente", "", limiteInParole(fisso, OGGI));
  /*  ⚠️ I POSTI SI DICONO DALLA PARTE GIUSTA. Richiesta del committente: «fai
      che i posti siano 9/12 occupati, ne rimangono 3». Un numero solo non dice
      niente — «3 su quanti? su mille?» — mentre 9 su 12 racconta che la
      maggior parte è già andata, e lo DIMOSTRA invece di affermarlo. */
  const { postiInParole, quotaPostiPresi } = PGA;
  c("nove su dodici", "9 di 12 posti già assegnati · ne restano 3",
    postiInParole({ ...fisso, posti: 3, postiTotali: 12 }));
  c("e l'ultimo si dice al singolare", "11 di 12 posti già assegnati · ne resta 1",
    postiInParole({ ...fisso, posti: 1, postiTotali: 12 }));
  //  Senza il totale non si inventa: si dice quello che si sa.
  c("senza totale, solo quelli che restano", "restano 3 posti", postiInParole({ ...fisso, posti: 3 }));
  c("un totale più piccolo dei rimasti non si usa", "restano 3 posti",
    postiInParole({ ...fisso, posti: 3, postiTotali: 2 }));
  c("zero posti: niente", "", postiInParole({ ...fisso, posti: 0 }));
  //  La barra che mostra quanto è già andato, invece di dirlo.
  c("tre quarti presi", 0.75, quotaPostiPresi({ ...fisso, posti: 3, postiTotali: 12 }));
  c("senza totale niente barra", null, quotaPostiPresi({ ...fisso, posti: 3 }));
  c("e la frase entra nel limite", "9 di 12 posti già assegnati · ne restano 3",
    limiteInParole({ ...fisso, posti: 3, postiTotali: 12 }, OGGI));
  c("la data si dice come si dice a voce", "valida fino al 5 ottobre",
    limiteInParole({ ...fisso, scadenza: "2026-10-05" }, OGGI));
  c("zero posti: niente frase", "", limiteInParole({ ...fisso, posti: 0 }, OGGI));

  /*  ── LA SCADENZA CHE VIVE, E QUELLA CHE RESTA ────────────────────────
      «Entro quanti giorni scade, e poi dà la data; in dinamico ogni giorno
      mette data dinamica, ma quando il preventivo è creato rimane quella del
      giorno in cui è stato generato.» */
  const aGiorni = { ...fisso, giorni: 7 };
  c("sette giorni da oggi", "2026-10-08", scadenzaEffettiva(aGiorni, OGGI));
  c("un preventivo vecchio tiene la sua", "2026-09-27",
    scadenzaEffettiva(aGiorni, new Date("2026-09-20T10:00:00")));
  //  ⚠️ Numeri LOCALI, non toISOString: quello passa per UTC e in Italia, di
  //   sera, sposta la scadenza al giorno prima.
  c("la sera non slitta al giorno prima", "2026-10-08",
    scadenzaEffettiva(aGiorni, new Date("2026-10-01T23:30:00")));
  c("i giorni vincono sulla data fissa", "2026-10-08",
    scadenzaEffettiva({ ...aGiorni, scadenza: "2026-12-31" }, OGGI));
  c("una scadenza passata non si nomina", "", giornoDellaScadenza("2026-09-30", OGGI));
  /*  ⚠️ E LA DATA SI DICE CON IL GIORNO DELLA SETTIMANA. Segnalazione del
      committente sul testo «prezzo bloccato fino al…»: con il giorno della
      settimana la scadenza smette di essere un'insegna e diventa una data
      d'agenda — si capisce quanto tempo c'è senza contarlo.
      ⚠️ In italiano il mese resta minuscolo: si alza solo la prima lettera. */
  const { giornoEsteso } = PGA;
  c("giovedì 8 ottobre", "Giovedì 8 ottobre", giornoEsteso("2026-10-08", OGGI));
  c("e una passata non si nomina nemmeno qui", "", giornoEsteso("2026-09-01", OGGI));
  c("una data storta non rompe niente", "", giornoEsteso("8 ottobre", OGGI));

  //  ── Validità: un prezzo che non si può più dare non si mostra.
  c("con posti e data buona è valida", true,
    offertaValida({ ...fisso, posti: 2, scadenza: "2026-10-05" }, OGGI));
  c("posti finiti: non valida", false, offertaValida({ ...fisso, posti: 0 }, OGGI));
  c("data passata: non valida", false, offertaValida({ ...fisso, scadenza: "2026-09-01" }, OGGI));
  c("senza limiti resta valida", true, offertaValida(fisso, OGGI));

  /*  ── LA RIGA SOTTO IL CODICE, E LE DUE PROMOZIONI CHE NON SI MESCOLANO ──
      Richiesta del committente: «non si vada ad unificare con codice sconto
      delle testimonianze: sono due promo diverse, devono essere applicabili e
      differenziate anche come voce». Una toglie euro dal totale di OGGI,
      l'altra fissa il prezzo del SECONDO impianto: una riga che le chiama con
      lo stesso nome è una riga che, fra un anno, non permette più a nessuno di
      sapere cosa era stato promesso. */
  const frase = (p) => frasiCodiceApplicato({ oggi: OGGI, pieno: 2000, ...p });
  c("solo sconto sul totale", "Codice H7135X applicato: 450\u00a0€ in meno sul totale.",
    frase({ codice: "h7135x", sconto: 450 }));
  c("solo il secondo impianto", "Codice GAR550 applicato: dal secondo impianto 550\u00a0€.",
    frase({ codice: "GAR550", offerta: fisso }));
  c("tutte e due, distinte",
    "Codice DUE applicato: 450\u00a0€ in meno sul totale e dal secondo impianto 550\u00a0€.",
    frase({ codice: "DUE", sconto: 450, offerta: fisso }));
  c("col limite in una frase sua",
    "Codice GAR550 applicato: dal secondo impianto 550\u00a0€. 7 di 10 posti già assegnati · ne restano 3.",
    frase({ codice: "GAR550", offerta: { ...fisso, posti: 3, postiTotali: 10 } }));
  c("il messaggio scritto a mano vince", "Sconto amico di Luca",
    frase({ codice: "X", sconto: 450, suo: "Sconto amico di Luca" }));

  //  ── La mappa letta dall'archivio: tutto sopravvive al giro.
  const mappa = leggiMappa(JSON.stringify({
    promo: { mostra: true, importo: 550, posti: 3, postiTotali: 10, giorni: 7, titolo: "Offerta lancio" },
    pct: { mostra: true, importo: 0, sconto: 30 },
    storta: { mostra: true, importo: 250, posti: "tre", scadenza: "5 ottobre" },
  }));
  c("i limiti si rileggono", 3, mappa.PROMO.posti);
  c("i giorni pure", 7, mappa.PROMO.giorni);
  c("e la percentuale", 30, mappa.PCT.sconto);
  c("posti illeggibili: nessun limite", undefined, mappa.STORTA.posti);
  c("data illeggibile: nessuna scadenza", undefined, mappa.STORTA.scadenza);
  c("comanda il primo che parla", 550, garanziaDa(["ALTRO", "PROMO"], mappa).importo);
}

function proveDelRestaInLista() {
  const { verdettoSuOspite, SALUTO_VIVO_MS } = RIL;
  gruppo("CHI RESTA NEI RIQUADRI");
  const T = 1_000_000_000;

  //  Collegato: non c'è niente da decidere.
  c("collegato resta", "resta", verdettoSuOspite({ adesso: T, ultimoSaluto: T, stato: "connected" }));
  c("e resta anche se non salutava da un pezzo", "resta",
    verdettoSuOspite({ adesso: T, ultimoSaluto: T - 10 * 60_000, stato: "connected" }));
  //  Media che arriva = è lì, qualunque cosa dica lo stato.
  c("con media che arriva resta", "resta",
    verdettoSuOspite({ adesso: T, ultimoSaluto: T - 5_000, stato: "disconnected", haMedia: true }));

  /*  ⚠️ IL CUORE DELLA CORREZIONE: camera spenta, nessuna connessione, ma sta
      dicendo «ci sono» da due secondi. Prima spariva (nessuna connessione
      dopo 12s / mai collegato dopo 45s); adesso si riprova il filo e il
      riquadro resta dov'è. */
  c("saluta ma il filo non c'è: si riprova, non si toglie", "riprova",
    verdettoSuOspite({ adesso: T, ultimoSaluto: T - 2_000, stato: "assente" }));
  c("…e nemmeno col filo chiuso", "riprova",
    verdettoSuOspite({ adesso: T, ultimoSaluto: T - 2_000, stato: "closed" }));
  c("mentre si sta ancora collegando si aspetta", "resta",
    verdettoSuOspite({ adesso: T, ultimoSaluto: T - 2_000, stato: "connecting" }));
  //  ⚠️ E UN SALUTO IN RITARDO NON È UN'USCITA: dieci secondi erano il taglio
  //   vecchio, e una scheda in secondo piano li supera senza essersi mossa.
  c("un saluto di quindici secondi fa vale ancora", "resta",
    verdettoSuOspite({ adesso: T, ultimoSaluto: T - 15_000, stato: "disconnected" }));

  /*  ⚠️ APPENA ARRIVATO NON SI TOCCA, ED È IL GUASTO CHE HA MISURATO IL
      COMMITTENTE: «quando ammetto un utente, sia io che l'utente rimane che
      vede me con camera spenta e senza audio per circa 60 secondi, poi entra».
      Nella prima versione di questa regola una persona appena comparsa, senza
      connessione ancora creata, riceveva «riprova»: chi conduce rifaceva
      l'offerta ogni pochi secondi, e rifare l'offerta MENTRE la prima è in
      corso non ripara niente — la disturba, e la trattativa ricomincia da
      capo. Quel minuto era fatto di quei tentativi. */
  const { GRAZIA_AVVIO_MS } = RIL;
  c("appena arrivato si aspetta", "resta",
    verdettoSuOspite({ adesso: T, ultimoSaluto: T - 1_000, stato: "assente", primaVolta: T - 3_000 }));
  c("…anche se il filo è chiuso", "resta",
    verdettoSuOspite({ adesso: T, ultimoSaluto: T - 1_000, stato: "closed", primaVolta: T - 3_000 }));
  //  ⚠️ Ma passata la grazia si riprova davvero: se dopo dodici secondi non
  //   c'è ancora niente, quella connessione non si sta formando da sola.
  c("passata la grazia si riprova", "riprova",
    verdettoSuOspite({ adesso: T, ultimoSaluto: T - 1_000, stato: "assente", primaVolta: T - GRAZIA_AVVIO_MS - 1 }));
  //  E chi è collegato non aspetta nessuna grazia: sta già parlando.
  c("collegato non aspetta niente", "resta",
    verdettoSuOspite({ adesso: T, ultimoSaluto: T - 1_000, stato: "connected", primaVolta: T }));

  //  Guasto conclamato ma recente: si aspetta invece di accanirsi.
  c("guasto da poco: si aspetta", "resta",
    verdettoSuOspite({ adesso: T, ultimoSaluto: T - 2_000, stato: "failed", guastoDa: T - 5_000 }));
  c("guasto da mezzo minuto: si riprova", "riprova",
    verdettoSuOspite({ adesso: T, ultimoSaluto: T - 2_000, stato: "failed", guastoDa: T - 31_000 }));

  //  ⚠️ E SI TOGLIE DAVVERO CHI NON C'È PIÙ: chi non ha mai salutato è una
  //   voce fantasma, chi tace da troppo se n'è andato senza dirlo (chi chiude
  //   la scheda manda «bye» e sparisce all'istante, senza aspettare niente).
  c("chi non ha mai salutato va via", "via", verdettoSuOspite({ adesso: T, ultimoSaluto: 0, stato: "assente" }));
  c("chi tace da un minuto va via", "via",
    verdettoSuOspite({ adesso: T, ultimoSaluto: T - 60_000, stato: "assente" }));
  c("sul bordo dei quarantacinque secondi resta ancora", "riprova",
    verdettoSuOspite({ adesso: T, ultimoSaluto: T - SALUTO_VIVO_MS, stato: "assente" }));
  //  Un collegato non si toglie mai per silenzio: la prova che il saluto non
  //  è l'unica cosa che conta.
  c("un collegato muto non si toglie", "resta",
    verdettoSuOspite({ adesso: T, ultimoSaluto: T - 10 * 60_000, stato: "connected" }));
}

/*  ═══════════════════════════════════════════════════════════════════════
    CHI SI FA SPOSTARE LA PAGINA SOTTO GLI OCCHI
    ───────────────────────────────────────────────────────────────────────
    Segnalazione del committente: «il preventivo mentre lo compilo
    continuamente torna sopra, e devo riscorrere verso il punto».
    Lo scorrimento viaggia insieme allo stato — ed è giusto: mentre il
    consulente presenta, il cliente deve guardare il punto che gli sta
    spiegando. Ma da quando si compila IN DUE nella stessa stanza quello stato
    arriva anche a chi sta scrivendo, e ogni fotografia (una al secondo) gli
    riportava la pagina dove stava l'altro.
    ═══════════════════════════════════════════════════════════════════════ */
/*  ═══════════════════════════════════════════════════════════════════════
    UNA FASCIA PER UNO SOLO, OPPURE APERTA
    ───────────────────────────────────────────────────────────────────────
    Richiesta del committente: «quando fisso un appuntamento posso selezionare
    se bloccare la fascia per solo quella persona, oppure se rimane aperta; e
    quando ho già messo una persona "aperta", gli altri entrano aperti fino a
    3».
    La capienza (crm/booking-utils) è UN numero per tutte le fasce: o tengono
    tutte tre persone o nessuna. Mancava la cosa che si fa davvero in agenda —
    «questa mezz'ora la tengo per lui» — e l'unico modo era abbassare la
    capienza per tutti.
    ═══════════════════════════════════════════════════════════════════════ */
function proveDelModoFascia() {
  const {
    leggiModoFascia, scriviModoFascia, postiDellaFascia, fasciaLibera,
    siPuoChiudere, codiceDellaRiga, spuntaSoloUno,
  } = FAS;
  gruppo("UNA FASCIA PER UNO SOLO, OPPURE APERTA");

  //  ⚠️ ASSENTE = APERTA: tutte le fasce nate prima che questa scelta
  //   esistesse tenevano fino alla capienza, e il ripiego deve lasciare
  //   l'agenda esattamente com'era.
  c("una riga che non c'è è aperta", "aperta", leggiModoFascia(null));
  c("una riga vuota anche", "aperta", leggiModoFascia(""));
  c("una riga solo col codice è aperta", "aperta", leggiModoFascia('{"code":"abc-def-ghi"}'));
  //  ⚠️ E una riga ILLEGGIBILE non chiude l'ora: sarebbe un buco in agenda
  //   che nessuno ha deciso e che nessuno sa spiegare.
  c("una riga storta non chiude niente", "aperta", leggiModoFascia("{rotta"));
  c("e «solo» si legge", "solo", leggiModoFascia('{"modo":"solo"}'));
  c("un modo sconosciuto vale aperta", "aperta", leggiModoFascia('{"modo":"boh"}'));

  /*  ⚠️ IL CODICE DELLA STANZA NON SI PERDE: è il link che i clienti di quella
      fascia hanno già in mano, e riscriverlo via vorrebbe dire mandarli in una
      stanza vuota — il guasto peggiore che questo programma abbia avuto. */
  const conCodice = '{"code":"zsm-hjfm-jvn"}';
  const chiusa = scriviModoFascia(conCodice, "solo");
  c("chiudendola il codice resta", "zsm-hjfm-jvn", codiceDellaRiga(chiusa));
  c("e il modo è scritto", "solo", leggiModoFascia(chiusa));
  const riaperta = scriviModoFascia(chiusa, "aperta");
  c("riaprendola il codice resta ancora", "zsm-hjfm-jvn", codiceDellaRiga(riaperta));
  c("e torna aperta", "aperta", leggiModoFascia(riaperta));
  c("senza codice non se ne inventa uno", "", codiceDellaRiga(scriviModoFascia(null, "solo")));

  //  I posti: uno se è «solo», la capienza se è aperta.
  c("aperta: i posti sono la capienza", 3, postiDellaFascia({ modo: "aperta", capienza: 3 }));
  c("solo: il posto è uno", 1, postiDellaFascia({ modo: "solo", capienza: 3 }));
  c("senza sapere niente, un posto", 1, postiDellaFascia({}));
  //  Una capienza storta non deve azzerare i posti: sarebbe un'agenda chiusa.
  c("capienza zero vale uno", 1, postiDellaFascia({ modo: "aperta", capienza: 0 }));

  //  Libera o no.
  c("aperta e vuota: libera", true, fasciaLibera({ presi: 0, modo: "aperta", capienza: 3 }));
  c("aperta con due: ancora libera", true, fasciaLibera({ presi: 2, modo: "aperta", capienza: 3 }));
  c("aperta con tre: piena", false, fasciaLibera({ presi: 3, modo: "aperta", capienza: 3 }));
  //  ⚠️ IL CUORE: una fascia «solo» con una persona è piena, anche se la
  //   capienza generale dice tre. È tutta la funzione, in una riga.
  c("solo, con uno dentro: piena", false, fasciaLibera({ presi: 1, modo: "solo", capienza: 3 }));
  c("solo e vuota: libera", true, fasciaLibera({ presi: 0, modo: "solo", capienza: 3 }));
  //  La pausa vince su tutto: lì non si prenota comunque.
  c("in pausa non è libera", false, fasciaLibera({ presi: 0, modo: "aperta", capienza: 3, inPausa: true }));

  /*  ⚠️ CHIUDERE UNA FASCIA CON DUE PERSONE DENTRO VORREBBE DIRE BUTTARNE
      FUORI UNA, e quella ha già il link in mano. Aprire invece si può sempre:
      non toglie niente a nessuno. */
  c("con nessuno si può chiudere", true, siPuoChiudere(0));
  c("con uno si può ancora", true, siPuoChiudere(1));
  c("con due non si chiude", false, siPuoChiudere(2));

  /*  ── LA SPUNTA, UGUALE IN TUTTO IL CRM ──────────────────────────────
      Richiesta del committente: «quando importo lead mi dà solo l'opzione di
      3 persone su quello slot; invece deve esserci una spunta che blocca
      quello slot per una persona sola. E mettilo in tutto il CRM».
      La decisione è una sola — com'è messa, se si può toccare, cosa dire se
      no — e la usano la scheda del cliente, la coda dei lead importati e
      l'agenda: tre copie sarebbero tre comportamenti diversi. */
  const vuota = spuntaSoloUno({ modo: "aperta", presi: 0, capienza: 3 });
  c("ora vuota: spunta non messa", false, vuota.spuntata);
  c("e si può mettere", true, vuota.attiva);
  c("con la spunta non messa i posti sono tre", 3, vuota.posti);
  c("e lo dice", true, /fino a 3/.test(vuota.nota));

  const tenuta = spuntaSoloUno({ modo: "solo", presi: 1, capienza: 3 });
  c("ora tenuta: spunta messa", true, tenuta.spuntata);
  c("e il posto è uno", 1, tenuta.posti);
  //  ⚠️ Si può SEMPRE riaprire: il divieto riguarda solo il chiudere.
  c("riaprire si può sempre", true, tenuta.attiva);
  c("e dice che nessun altro entra", true, /nessun altro/i.test(tenuta.nota));

  //  Il caso vero: fisso l'appuntamento e nello stesso gesto tengo l'ora.
  c("con una persona dentro si può ancora chiudere", true,
    spuntaSoloUno({ modo: "aperta", presi: 1, capienza: 3 }).attiva);
  /*  ⚠️ CON DUE DENTRO LA SPUNTA SI SPEGNE E DICE PERCHÉ: chiudere vorrebbe
      dire buttare fuori qualcuno che ha già il link in mano. Una spunta che
      non fa niente quando la premi è peggio di una spunta spenta. */
  const piena = spuntaSoloUno({ modo: "aperta", presi: 2, capienza: 3 });
  c("con due dentro non si può più tenere", false, piena.attiva);
  c("e il motivo è scritto", true, /già 2 persone/.test(piena.nota));
  c("una capienza storta non azzera i posti", 1, spuntaSoloUno({ capienza: 0 }).posti);
}

function proveDelQuandoPerStato() {
  const { QUANDO_PER_STATO, STATI_CON_DATA, chiedeUnaData } = QPS;
  gruppo("GLI STATI CHE PROMETTONO UN MOMENTO");

  /*  ⚠️ OGNI VOCE NOMINA IL SUO CAMPO, e sono solo tre: è la garanzia contro
      il guasto storico della vecchia barra — la data finiva in un campo
      diverso da quello che l'elenco leggeva, e sembrava «non si salva». */
  const campiData = new Set(["dataMeeting", "dataRicontatto", "dataVieneInSede"]);
  const campiOra = new Set(["oraMeeting", "oraRicontatto", "oraVieneInSede"]);
  let storti = 0;
  for (const [stato, r] of Object.entries(QUANDO_PER_STATO)) {
    if (!campiData.has(r.chiaveData) || !campiOra.has(r.chiaveOra)) { storti++; console.log("      campo storto:", stato); }
    if (!r.titolo || !r.nomeCampo) { storti++; console.log("      senza parole:", stato); }
  }
  c("ogni stato con data nomina campi veri", 0, storti);

  /*  ── CI RICONTATTA LUI ───────────────────────────────────────────────
      Richiesta del committente: «aggiungi come stato ci ricontatta lui, e
      segna la data di quando lo ha detto — quella di oggi, sempre — e quando
      dice che ricontatta».
      Le due date sono diverse e devono restare diverse: QUESTA è la seconda,
      cioè entro quando ha detto che si fa vivo. La prima la scrive il
      programma da sé (`ciRicontattaDettoIl`, vedi updateLead).
      ⚠️ Il giorno è OBBLIGATORIO anche se la palla ce l'ha lui: è quello che
       riporta la scheda in coda se passa in silenzio. L'ora no: «ti faccio
       sapere io» non ha un orario, e inventarne uno è peggio di lasciarlo
       vuoto. */
  c("«ci ricontatta lui» chiede una data", true, chiedeUnaData("ci_ricontatta_lui"));
  c("e la scrive fra i ricontatti", "dataRicontatto", QUANDO_PER_STATO.ci_ricontatta_lui.chiaveData);
  c("con l'ora facoltativa", false, QUANDO_PER_STATO.ci_ricontatta_lui.oraObbligatoria);
  //  ⚠️ NON è una consulenza: non deve aprire l'agenda della squadra.
  c("non occupa l'agenda di nessuno", undefined, QUANDO_PER_STATO.ci_ricontatta_lui.conOrariLiberi);
  c("sta nell'elenco derivato", true, STATI_CON_DATA.has("ci_ricontatta_lui"));
  //  Gli stati del giro di telefonate NON chiedono una data: una finestrella
  //  a ogni tocco renderebbe il lavoro più lento invece che più sicuro.
  c("«non risponde» non chiede niente", false, chiedeUnaData("non_risponde"));
  c("uno stato sconosciuto non rompe", false, chiedeUnaData("boh"));
  c("e nemmeno il niente", false, chiedeUnaData(null));
}

function proveDelloScorrimento() {
  const { loScorrimentoMiRiguarda } = PDG;
  gruppo("CHI SI FA SPOSTARE LA PAGINA");

  //  Chi guarda e basta segue: è tutto il senso della diretta.
  c("chi guarda segue", true, loScorrimentoMiRiguarda({ guardo: true, scrivo: false }));
  //  ⚠️ IL CUORE: chi scrive tiene la sua posizione, anche se guarda.
  c("chi scrive non si fa spostare", false, loScorrimentoMiRiguarda({ guardo: true, scrivo: true }));
  c("e chi non guarda nemmeno", false, loScorrimentoMiRiguarda({ guardo: false, scrivo: false }));
  c("né chi scrive e basta", false, loScorrimentoMiRiguarda({ guardo: false, scrivo: true }));
  //  Robustezza: chiamata senza niente non deve spostare nessuno.
  c("senza sapere niente non si sposta nessuno", false, loScorrimentoMiRiguarda({}));
}

function provePersoneDelPannello() {
  const { personeDelPannello } = PDG;
  gruppo("CHI METTERE NEL PANNELLO");

  const atteso = { gettone: "p1", nome: "Marco Rossi", leadId: "L1" };

  //  Con gli attesi non cambia niente: sono loro, con le loro stanze.
  c("gli attesi restano gli attesi", [atteso], personeDelPannello({ attesi: [atteso], ospiti: [] }));
  c("e non si aggiunge nessuno se c'è già chi aspettavi", 1,
    personeDelPannello({ attesi: [atteso], ospiti: [{ name: "Ed" }] }).length);

  //  ⚠️ IL CUORE DELLA CORREZIONE: nessun atteso ma qualcuno collegato.
  const soloOspite = personeDelPannello({ attesi: [], ospiti: [{ name: "ed" }] });
  c("chi è entrato dal link compare lo stesso", 1, soloOspite.length);
  c("col nome che ha scritto alla porta", "ed", soloOspite[0].nome);
  c("senza gettone: il suo preventivo è quello comune", "", soloOspite[0].gettone);
  c("e si sa che non ha una scheda", true, soloOspite[0].senzaScheda);

  //  Il nome vero dell'archivio batte quello digitato, quando c'è.
  c("il nome dell'archivio ha la precedenza", "Daniele Ferlazzo",
    personeDelPannello({ attesi: [], ospiti: [{ name: "dani", nomeVero: "Daniele Ferlazzo" }] })[0].nome);

  /*  ⚠️ UNA RIGA SOLA ANCHE IN DUE. Senza gettone non hanno un preventivo per
      uno: vedono tutti lo stesso. Due righe direbbero che si possono governare
      separatamente — e sarebbe una bugia con due interruttori sopra. */
  const inDue = personeDelPannello({ attesi: [], ospiti: [{ name: "Ed" }, { name: "Ada" }] });
  c("due ospiti senza scheda: una riga sola", 1, inDue.length);
  c("e il nome li nomina tutti e due", "Ed e Ada", inDue[0].nome);
  c("in tre si accorcia", "Ed e altri 2",
    personeDelPannello({ attesi: [], ospiti: [{ name: "Ed" }, { name: "Ada" }, { name: "Bo" }] })[0].nome);

  //  Un collegato che non ha detto come si chiama è comunque una persona.
  c("senza nome si chiama «Il cliente»", "Il cliente",
    personeDelPannello({ attesi: [], ospiti: [{}] })[0].nome);

  //  ⚠️ E CON LA STANZA VUOTA NON SI INVENTA NESSUNO: il pannello sparisce, ed
  //   è giusto — non c'è nessuno di cui governare lo schermo.
  c("nessun atteso e nessun collegato: niente pannello", 0,
    personeDelPannello({ attesi: [], ospiti: [] }).length);
}

function proveDoveSiConduce() {
  const { quiSiConduce } = PGC;
  gruppo("DOVE SI CONDUCE UNA CONSULENZA");

  //  Le schermate della consulenza: qui il riquadro «fai entrare» ci sta.
  for (const p of ["/presenta", "/meetly/abc-def-ghi", "/videochiamata/abc", "/preventivo", "/slide", "/media", "/web", "/prova-capelli"])
    c(`«${p}» è una schermata di consulenza`, true, quiSiConduce(p));

  //  ⚠️ IL CUORE DELLA CORREZIONE: il gestionale non lo è. Nessuna sua pagina.
  for (const p of ["/CRM", "/CRM/agenda", "/CRM/trattative", "/CRM/impostazioni", "/CRM/preventivi"])
    c(`«${p}» non lo è`, false, quiSiConduce(p));

  //  E nemmeno il resto della casa.
  c("la home non è una consulenza", false, quiSiConduce("/"));
  c("il sito pubblico nemmeno", false, quiSiConduce("/shop/checkout"));

  //  ⚠️ Un percorso che COMINCIA come uno buono non basta: «/mediateca» non è
  //   «/media», e «/CRM/media» resta gestionale.
  c("un nome che somiglia non passa", false, quiSiConduce("/mediateca"));
  c("né una sotto-pagina del gestionale", false, quiSiConduce("/CRM/media"));

  //  La domanda si risponde con lo STESSO elenco di «cosa può vedere un
  //  cliente»: due elenchi vorrebbero dire due idee di «siamo in consulenza».
  for (const p of ["/presenta", "/CRM", "/preventivo", "/CRM/agenda", "/mediateca"])
    c(`«${p}»: stessa risposta dei due`, PGC.paginaMostrabile(p), quiSiConduce(p));
}

function proveDelCodiceDiretta() {
  const { codiceDiretta } = CDR;
  gruppo("DI CHI E' QUESTO DISPOSITIVO");

  //  Chi conduce: il codice è quello che ha in memoria.
  c("chi conduce usa il suo", "abc",
    codiceDiretta({ isViewer: false, isClient: false, hostId: "abc" }));

  /*  ⚠️ IL CUORE DELLA CORREZIONE: il cliente NON usa il codice di chi
      conduce. Sul suo telefono non c'è; e se c'è — perché quel dispositivo ha
      condotto una consulenza prima — sarebbe quello sbagliato. */
  c("il cliente usa il codice del suo link", "sua",
    codiceDiretta({ isViewer: false, isClient: true, clientSess: "sua", hostId: "mia" }));
  c("l'ospite di sola visione idem", "sua",
    codiceDiretta({ isViewer: true, isClient: false, watchId: "sua", hostId: "mia" }));

  //  Per l'ospite vince la sessione VIVA su quella scritta nel link: se il
  //  consulente ricomincia, chi ha il link di prima deve seguire quella nuova
  //  invece di restare su un canale morto.
  c("la sessione viva vince sul link", "nuova",
    codiceDiretta({ isViewer: true, isClient: false, guestChan: "nuova", watchId: "vecchia" }));
  c("senza sessione viva resta il link", "vecchia",
    codiceDiretta({ isViewer: true, isClient: false, guestChan: null, watchId: "vecchia" }));

  /*  ⚠️ NESSUN CODICE = NESSUNO DA RISPECCHIARE, mai «prendi quello
      condiviso». Era questa la risposta che faceva vedere al cliente lo stato
      scritto da un altro contesto — e che, con un cliente diverso davanti,
      sarebbe stato il preventivo di un'altra persona. */
  c("il cliente senza codice non rispecchia nessuno", null,
    codiceDiretta({ isViewer: false, isClient: true, clientSess: "", hostId: "mia" }));
  c("nemmeno l'ospite senza codice", null,
    codiceDiretta({ isViewer: true, isClient: false, guestChan: "", watchId: null, hostId: "mia" }));
  c("e chi non conduce niente non ha codice", null,
    codiceDiretta({ isViewer: false, isClient: false, hostId: null }));

  //  Spazi: un codice fatto di spazi non è un codice.
  c("gli spazi non fanno un codice", null,
    codiceDiretta({ isViewer: false, isClient: true, clientSess: "   " }));

  /*  ── LA STESSA DOMANDA DA UNA PAGINA SENZA STATO ────────────────────────
      Le chiamate che partono da fuori dal componente (il listino pubblico, i
      codici sconto) hanno in mano solo l'indirizzo e la memoria. Da quando
      ogni consulente ha il suo listino, sbagliare qui vuol dire due prezzi
      diversi per la stessa consulenza: il consulente legge il suo, il cliente
      quello di casa. */
  const { codiceDaPagina } = CDR;
  c("il link del cliente porta il codice", "sua",
    codiceDaPagina({ pathname: "/preventivo", search: "?client=1&sess=sua", hostId: null }));
  //  ⚠️ L'INDIRIZZO BATTE LA MEMORIA: un dispositivo che ha condotto una
  //   consulenza, e poi apre il link di un cliente, è quel cliente.
  c("l'indirizzo batte la memoria", "sua",
    codiceDaPagina({ pathname: "/preventivo", search: "?client=1&sess=sua", hostId: "mia" }));
  c("chi conduce non ha codice nell'indirizzo: vale la memoria", "mia",
    codiceDaPagina({ pathname: "/preventivo", search: "?id=IDP1234", hostId: "mia" }));
  c("la stanza lo porta nel percorso", "abc-def-ghi",
    codiceDaPagina({ pathname: "/meetly/abc-def-ghi", search: "", hostId: null }));
  c("e anche il vecchio nome della stanza", "abc-def-ghi",
    codiceDaPagina({ pathname: "/videochiamata/abc-def-ghi", search: "", hostId: null }));
  c("il link di sola visione idem", "sua",
    codiceDaPagina({ pathname: "/preventivo", search: "?watch=sua", hostId: null }));
  c("senza niente, nessun codice", null,
    codiceDaPagina({ pathname: "/preventivo", search: "", hostId: null }));
}

function proveDellOraTenutaPerUnoSolo() {
  const { generateAvailability, slotDelGiorno } = BKG;
  gruppo("UN'ORA TENUTA PER UNA PERSONA SOLA NON SI OFFRE PIÙ");

  /*  Segnalazione del committente: «clicco la spunta che vuole stare solo, ma
      l'orario continua a essere disponibile per 3».
      La spunta scriveva davvero in archivio, ma il motore che calcola gli
      orari liberi non la leggeva: quell'ora restava fra le libere con la
      capienza generale, e la si poteva offrire a un secondo cliente. */
  const oggi = new Date();
  const fra = (g) => {
    const d = new Date(oggi);
    d.setDate(d.getDate() + g);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  //  Un giorno lavorativo qualunque, abbastanza avanti da non essere passato.
  let giorno = "";
  for (let i = 1; i <= 8 && !giorno; i++) {
    const d = new Date(oggi);
    d.setDate(d.getDate() + i);
    if (d.getDay() >= 1 && d.getDay() <= 5) giorno = fra(i);
  }
  const consulente = {
    id: "C1",
    data: {
      nome: "Anna", attivo: true,
      giorniLavorativi: [1, 2, 3, 4, 5],
      fasceOrarie: [{ inizio: "14:00", fine: "16:00" }],
      pause: [],
    },
  };
  const unCliente = [{
    id: "L1",
    data: { consulenteId: "C1", dataMeeting: giorno, oraMeeting: "14:00", durataMeeting: 30, nome: "Mario" },
  }];

  //  Com'era: un'ora con uno dentro ha ancora posto, e si offre.
  const aperta = generateAvailability(consulente, 30, unCliente, 8).find((g) => g.date === giorno);
  c("aperta: l'ora con una persona si offre ancora", true, (aperta?.slots ?? []).includes("14:00"));
  c("e dice 1 di 3", 3, (aperta?.ore ?? []).find((o) => o.ora === "14:00")?.capienza);

  //  ⚠️ IL CUORE: la stessa ora tenuta per uno solo esce dalle libere.
  const modi = { [`${giorno} 14:00`]: "solo" };
  const tenuta = generateAvailability(consulente, 30, unCliente, 8, undefined, undefined, undefined, modi)
    .find((g) => g.date === giorno);
  c("tenuta: l'ora con una persona NON si offre più", false, (tenuta?.slots ?? []).includes("14:00"));
  c("e dice 1 di 1", 1, (tenuta?.ore ?? []).find((o) => o.ora === "14:00")?.capienza);
  //  ⚠️ E le altre ore del giorno non c'entrano niente: una spunta su un'ora
  //   non deve chiudere la giornata.
  c("le altre ore restano libere", true, (tenuta?.slots ?? []).includes("15:00"));
  c("e con la capienza di sempre", 3, (tenuta?.ore ?? []).find((o) => o.ora === "15:00")?.capienza);

  //  Un'ora tenuta e ANCORA VUOTA si offre: è tenuta per il primo che arriva.
  const vuota = generateAvailability(consulente, 30, [], 8, undefined, undefined, undefined, modi)
    .find((g) => g.date === giorno);
  c("tenuta e vuota: si offre ancora", true, (vuota?.slots ?? []).includes("14:00"));
  c("ma con un posto solo", 1, (vuota?.ore ?? []).find((o) => o.ora === "14:00")?.capienza);

  //  I modi di un ALTRO giorno non toccano questo.
  const altrove = { [`${fra(60)} 14:00`]: "solo" };
  const indenne = generateAvailability(consulente, 30, unCliente, 8, undefined, undefined, undefined, altrove)
    .find((g) => g.date === giorno);
  c("un'ora tenuta in un altro giorno non c'entra", 3,
    (indenne?.ore ?? []).find((o) => o.ora === "14:00")?.capienza);

  //  La griglia del giorno continua a dire la stessa cosa (stessa regola).
  const griglia = slotDelGiorno(consulente, giorno, 30, unCliente, undefined, undefined, new Map([["14:00", "solo"]]));
  c("la griglia del giorno dice pieno", "pieno", griglia.find((o) => o.ora === "14:00")?.stato);
}

function proveDegliOrariPresi() {
  const { slotDelGiorno } = BKG;
  gruppo("GLI ORARI GIA' PRENOTATI");

  const GIORNO = "2026-09-24";   // un giovedì
  const consulente = {
    id: "C1",
    data: {
      nome: "Anna",
      attivo: true,
      giorniLavorativi: [1, 2, 3, 4, 5],
      fasceOrarie: [{ inizio: "14:00", fine: "18:00" }],
      pause: [],
    },
  };
  //  Una consulenza dalle 15:00, lunga un'ora e mezza: finisce alle 16:30.
  const leads = [{
    id: "L1",
    data: {
      consulenteId: "C1", dataMeeting: GIORNO, oraMeeting: "15:00",
      durataMeeting: 90, nome: "Mario", cognome: "Rossi",
    },
  }];

  const ore = slotDelGiorno(consulente, GIORNO, 30, leads);
  const stato = (h) => ore.find((o) => o.ora === h);

  //  ⚠️ PRIMA DI TUTTO: gli orari presi CI SONO ancora. Prima sparivano, e chi
  //   guardava non distingueva «non si lavora» da «c'è già un cliente».
  c("l'orario preso resta nell'elenco", true, !!stato("15:00"));
  c("e l'elenco copre tutta la fascia", 8, ore.length);   // 14:00→17:30 ogni 30'

  /*  ── ⚠️ IL CONTATORE SEGUE LA DURATA ──────────────────────────────────
      15:00 → 16:30 presa da una persona. Con slot da mezz'ora: 15:00, 15:30 e
      16:00 la contano; 16:30 no.
      ⚠️ E «una dentro» NON vuol più dire «chiusa»: richiesta del committente,
       «fino a 3 persone nella stessa ora per consulente, con il contatore, e
       poi quello slot non è più disponibile». Con una sola dentro c'è ancora
       posto per due, e la fascia resta scegliibile. */
  c("l'inizio conta una persona", 1, stato("15:00").presi);
  c("con una dentro si può ancora fissare", true, stato("15:00").libero);
  c("ed è «insieme»", "insieme", stato("15:00").stato);
  c("e la capienza è tre", 3, stato("15:00").capienza);

  /*  ── ⚠️ LE MEZZ'ORE DOPO NON SONO «INSIEME»: SONO COPERTE ─────────────
      Questa prova diceva il contrario, e diceva la cosa sbagliata.
      Segnalazione del committente: «se uno slot — esempio 9:45 — è occupato ed
      è 1/3, le 10:00 non devono essere disponibili a prescindere: l'orario lo
      deve dare ma sbarrato».
      Ha ragione, e non è una questione di colori: due persone finiscono nella
      STESSA consulenza solo se hanno lo stesso minuto di inizio — è così che
      nasce la stanza condivisa e il link unico. Le 15:30, che si accavallano
      alla consulenza delle 15:00, contavano «1 su 3, c'è ancora posto»:
      prenotandole non si aggiungeva nessuno a quella consulenza, se ne creava
      una SECONDA sovrapposta, con un altro link, mentre il consulente era già
      occupato. Da fuori: «mi dà disponibilità che sono già occupate». */
  c("la mezz'ora dopo è coperta", "coperto", stato("15:30").stato);
  c("e NON si può scegliere", false, stato("15:30").libero);
  c("non conta nessuno «insieme»", 0, stato("15:30").presi);
  c("e dice da che ora è coperta", "15:00", stato("15:30").copertoDa);
  c("anche quella dopo ancora", "coperto", stato("16:00").stato);
  c("alle 16:30 si torna liberi", "libero", stato("16:30").stato);
  c("le 14:30 restano vuote", 0, stato("14:30").presi);
  //  ⚠️ Le 14:30 durano mezz'ora e finiscono alle 15:00: NON si accavallano
  //   (l'una comincia dove l'altra finisce), quindi restano scegliibili.
  c("e scegliibili", true, stato("14:30").libero);

  //  Chi lo tiene e fino a quando: è quello che si legge passando sopra.
  c("dice di chi è", "Mario Rossi", stato("15:30").chi);
  c("e fino a quando", "16:30", stato("15:30").fino);
  c("un orario libero non dice niente", undefined, stato("14:00").chi);

  /*  ── LA DURATA DI QUELLO CHE SI STA FISSANDO CONTA ANCH'ESSA ──────────
      Gli orari proposti hanno il passo della durata scelta: con un'ora sono
      14:00, 15:00, 16:00, 17:00. Le 16:00 finirebbero alle 17:00, quindi
      entrano nella consulenza presa fino alle 16:30 — rosse anche loro. */
  const oreLunghe = slotDelGiorno(consulente, GIORNO, 60, leads);
  const lungo = (h) => oreLunghe.find((o) => o.ora === h);
  c("col passo di un'ora gli orari sono quattro", 4, oreLunghe.length);
  //  Le 16:00 finirebbero alle 17:00 e pescano nella consulenza delle 15:00:
  //  un'ora diversa che si accavalla, quindi coperta — non «insieme».
  c("le 16:00 pescano ancora nella prenotazione", "coperto", lungo("16:00").stato);
  c("e non si scelgono", false, lungo("16:00").libero);
  c("le 17:00 no", "libero", lungo("17:00").stato);
  c("e le 14:00 nemmeno", "libero", lungo("14:00").stato);

  /*  ══ FINO A TRE, POI LA FASCIA SI CHIUDE ═══════════════════════════════
      È la richiesta, per intero: «fino a 3 persone nella stessa ora di
      consulenza per singolo consulente, con un contatore 1/3, 2/3, 3/3, e poi
      non dà più disponibile quello slot». */
  const consulenza = (id, ora, nome) => ({
    id,
    data: { consulenteId: "C1", dataMeeting: GIORNO, oraMeeting: ora, durataMeeting: 30, nome, cognome: "" },
  });
  const conDue = slotDelGiorno(consulente, GIORNO, 30, [consulenza("A", "14:00", "Uno"), consulenza("B", "14:00", "Due")]);
  const due = conDue.find((o) => o.ora === "14:00");
  c("due persone: il contatore dice due", 2, due.presi);
  c("e c'è ancora posto", true, due.libero);

  const conTre = slotDelGiorno(consulente, GIORNO, 30, [
    consulenza("A", "14:00", "Uno"), consulenza("B", "14:00", "Due"), consulenza("C", "14:00", "Tre"),
  ]);
  const tre = conTre.find((o) => o.ora === "14:00");
  c("tre persone: il contatore dice tre", 3, tre.presi);
  //  ⚠️ IL CUORE: alla terza la fascia non è più disponibile.
  c("e la fascia si chiude", false, tre.libero);
  c("le altre ore restano libere", true, conTre.find((o) => o.ora === "15:00").libero);

  //  ⚠️ Il pieno vale per la FASCIA, non per l'orario esatto: tre consulenze
  //   che si sovrappongono chiudono anche gli slot che ci finiscono dentro.
  const sovrapposte = slotDelGiorno(consulente, GIORNO, 30, [
    consulenza("A", "14:00", "Uno"), consulenza("B", "14:15", "Due"), consulenza("C", "14:20", "Tre"),
  ]);
  c("tre sovrapposte chiudono la fascia", false, sovrapposte.find((o) => o.ora === "14:00").libero);

  /*  ⚠️ E LA CAPIENZA VALE SOLO PER LE CONSULENZE. Una visita in sede è una
      persona in carne e ossa davanti al consulente: quella chiude la fascia da
      sola, come ha sempre fatto. Lo stesso vale per pose e ritorni. */
  const inSede = slotDelGiorno(consulente, GIORNO, 30, [{
    id: "S1",
    data: { consulenteId: "C1", dataVieneInSede: GIORNO, oraVieneInSede: "14:00", durataVieneInSede: 60, nome: "Ada", cognome: "Neri" },
  }]);
  c("una visita in sede chiude la fascia da sola", false, inSede.find((o) => o.ora === "14:00").libero);
  c("e non si conta fra le tre", 0, inSede.find((o) => o.ora === "14:00").presi);
  c("ma dice di chi è", "Ada Neri", inSede.find((o) => o.ora === "14:00").chi);

  //  ⚠️ La scheda che si sta modificando non si dichiara occupata da sé, o
  //   riaprendola per cambiarle ora sparirebbe proprio l'ora che ha adesso.
  const senzaSe = slotDelGiorno(consulente, GIORNO, 30, leads, "L1");
  c("la propria consulenza non si occupa da sola", true, senzaSe.find((o) => o.ora === "15:00").libero);

  //  Giornata senza impegni: tutti liberi, e nessuno dice niente.
  const vuoto = slotDelGiorno(consulente, GIORNO, 30, []);
  c("senza impegni sono tutti liberi", true, vuoto.every((o) => o.libero));
  c("e il contatore è a zero", true, vuoto.every((o) => o.presi === 0));

  /*  ── ⚠️ UN APPUNTAMENTO SALTATO NON TIENE PIÙ IL SUO POSTO ────────────
      Segnalazione del committente: «quando metto “da spostare” si deve
      liberare anche lo slot di quell'orario».
      L'orario veniva dichiarato occupato solo perché la scheda aveva una data
      e un'ora, senza guardare lo stato: una consulenza rinviata alle 15:00 si
      teneva il posto per sempre — la data vecchia nessuno la cancella, è la
      memoria di quando doveva essere — e con tre rinvii in una settimana la
      giornata risultava piena senza avere un appuntamento. */
  const { tieneLoSlot } = BKG;
  const conStato = (stato) =>
    slotDelGiorno(consulente, GIORNO, 30, [{ ...leads[0], data: { ...leads[0].data, stato } }]);
  //  ⚠️ Adesso la domanda si fa sul CONTATORE, non su «libero»: con la
  //   capienza, una consulenza sola lascia la fascia scegliibile — quindi
  //   «libero» non distingue più «nessuno» da «uno su tre».
  const quanti = (stato, ora = "15:00") => conStato(stato).find((o) => o.ora === ora).presi;

  c("da riprogrammare libera l'orario", 0, quanti("da_spostare"));
  //  E lo libera TUTTO, non solo il primo mezzo passo: la fascia era 15:00→16:30.
  c("e lo libera per intero", 0, quanti("da_spostare", "16:00"));
  c("cliente assente lo libera", 0, quanti("no_show"));
  c("anche il vecchio «non fatto»", 0, quanti("non_fatto"));
  c("non interessato lo libera", 0, quanti("annullato"));
  c("irreperibile lo libera", 0, quanti("irreperibile"));
  c("chiuso lo libera", 0, quanti("concluso"));
  c("«meet da fissare» lo libera", 0, quanti("fissa_meet_dopo"));

  /*  ⚠️ E QUELLO CHE DEVE ANCORA SUCCEDERE OCCUPA UN POSTO: l'elenco è di
      stati in cui non succede più niente, non di stati «brutti». */
  c("un appuntamento fissato occupa un posto", 1, quanti("appuntamento_fissato"));
  c("e anche uno rifissato", 1, quanti("appuntamento_rifissato"));
  c("chi ha comprato pure", 1, quanti("acconto"));
  c("e chi sta valutando", 1, quanti("sta_valutando"));
  //  ⚠️ Uno stato mai visto TIENE l'orario: negli archivi importati c'è di
  //   tutto, e mostrare occupato un orario libero si corregge guardando —
  //   mostrarne libero uno occupato mette due clienti alla stessa ora.
  c("uno stato sconosciuto tiene l'orario", 1, quanti("stato-mai-visto"));
  c("e una scheda senza stato pure", 1, quanti(undefined));

  //  La regola da sola, che è quella che leggono le due schermate dell'agenda.
  c("tieneLoSlot: da riprogrammare no", false, tieneLoSlot("da_spostare"));
  c("tieneLoSlot: appuntamento fissato sì", true, tieneLoSlot("appuntamento_fissato"));
  c("tieneLoSlot: sconosciuto sì", true, tieneLoSlot("boh"));
}

/*  ═══════════════════════════════════════════════════════════════════════
    IL NUMERO DI PERSONE PER FASCIA SI CAMBIA DALLE IMPOSTAZIONI
    ───────────────────────────────────────────────────────────────────────
    Richiesta del committente: «fai che posso cambiare il numero dalle
    impostazioni». Tre era scritto nel codice.
    Il rischio da coprire non è leggere il numero: è quello che succede quando
    la riga è illeggibile o scritta male. Un campo svuotato che diventasse zero
    chiuderebbe l'agenda di TUTTI, e nessuno collegherebbe la cosa a questo
    campo.
    ═══════════════════════════════════════════════════════════════════════ */
function proveDellaCapienza() {
  const { leggiCapienzaDaJson, impostaCapienza, capienzaConsulenza, CAPIENZA_PREDEFINITA, slotDelGiorno } = BKG;
  gruppo("QUANTE PERSONE PER FASCIA");

  c("di serie sono tre", 3, CAPIENZA_PREDEFINITA);

  //  Le due forme che può avere la riga salvata.
  c("legge la forma salvata dal pannello", 5, leggiCapienzaDaJson('{"v":1,"capienza":5}'));
  c("e anche il numero scritto a mano", 4, leggiCapienzaDaJson("4"));

  /*  ⚠️ QUELLO CHE NON DEVE POTER SUCCEDERE: una riga storta che chiude
      l'agenda. In tutti questi casi si torna al predefinito. */
  c("riga assente → predefinito", 3, leggiCapienzaDaJson(null));
  c("riga vuota → predefinito", 3, leggiCapienzaDaJson(""));
  c("JSON rotto → predefinito", 3, leggiCapienzaDaJson("{capienza:"));
  c("zero → predefinito", 3, leggiCapienzaDaJson('{"capienza":0}'));
  c("negativo → predefinito", 3, leggiCapienzaDaJson('{"capienza":-2}'));
  c("testo → predefinito", 3, leggiCapienzaDaJson('{"capienza":"tante"}'));
  c("numero enorme → predefinito", 3, leggiCapienzaDaJson('{"capienza":900}'));
  //  Un decimale è un errore di battitura, non una scelta: si arrotonda.
  c("decimale arrotondato", 3, leggiCapienzaDaJson('{"capienza":2.6}'));
  c("il massimo è dieci", 10, leggiCapienzaDaJson('{"capienza":10}'));

  //  Lo stesso filtro vale scrivendo nel registro, non solo leggendo: il
  //  pannello salva il valore RIPULITO, mai quello digitato.
  c("impostando zero resta il predefinito", 3, impostaCapienza(0));
  c("impostando undefined idem", 3, impostaCapienza(undefined));
  c("impostando due vale due", 2, impostaCapienza(2));
  c("e il registro lo dice", 2, capienzaConsulenza());

  /*  ── ⚠️ E IL CALCOLO DEGLI ORARI LO SEGUE ─────────────────────────────
      È la prova che tiene insieme le due cose: cambiare il numero nelle
      impostazioni deve chiudere la fascia PRIMA. Con due, due persone bastano
      a riempirla. */
  const GIORNO = "2026-09-24";
  const consulente = {
    id: "C1",
    data: { nome: "Anna", attivo: true, giorniLavorativi: [1, 2, 3, 4, 5], fasceOrarie: [{ inizio: "14:00", fine: "18:00" }], pause: [] },
  };
  const due = [
    { id: "A", data: { consulenteId: "C1", dataMeeting: GIORNO, oraMeeting: "14:00", durataMeeting: 30, nome: "Uno" } },
    { id: "B", data: { consulenteId: "C1", dataMeeting: GIORNO, oraMeeting: "14:00", durataMeeting: 30, nome: "Due" } },
  ];
  const conDue = slotDelGiorno(consulente, GIORNO, 30, due).find((o) => o.ora === "14:00");
  c("con la capienza a due, due riempiono", false, conDue.libero);
  c("e il contatore dice due su due", "2/2", `${conDue.presi}/${conDue.capienza}`);

  //  Rimesso com'era: il registro è condiviso da tutte le prove, e lasciarlo
  //  a due farebbe fallire gruppi che non c'entrano niente.
  impostaCapienza(CAPIENZA_PREDEFINITA);
  c("rimesso a tre", 3, capienzaConsulenza());
}

function proveDellaStanza() {
  const { chiaveStanza, chiaveStanzaStorica, stanzaStoricaSua } = STZ;
  gruppo("DI CHI E' LA STANZA");

  const lead = "L-77", anna = "C-ANNA", bruno = "C-BRUNO";

  /*  ── ⚠️ IL CUORE DELLA CORREZIONE ──────────────────────────────────────
      Due consulenti sulla STESSA persona sono due consulenze diverse: due
      stanze, due codici, due link. Prima era una sola, e i due finivano nello
      stesso canale. */
  c("due consulenti, due stanze", false, chiaveStanza(lead, anna) === chiaveStanza(lead, bruno));
  c("lo stesso consulente ritrova la sua", chiaveStanza(lead, anna), chiaveStanza(lead, anna));
  c("e due lead diversi restano separati", false, chiaveStanza("L-1", anna) === chiaveStanza("L-2", anna));
  c("la stanza porta lead e consulente", "meet:L-77:C-ANNA", chiaveStanza(lead, anna));
  c("la storica porta solo il lead", "meet:L-77", chiaveStanzaStorica(lead));

  //  Senza consulente si ricade sulla storica: è il presentatore dentro
  //  Meetly, che non ha una sessione del CRM.
  c("senza consulente vale la storica", "meet:L-77", chiaveStanza(lead, ""));
  c("e gli spazi non fanno una stanza nuova", "meet:L-77", chiaveStanza(" L-77 ", "  "));

  /*  ── ⚠️ LA STANZA DELL'APPUNTAMENTO VALE PER TUTTI ────────────────────
      Segnalazione del committente, il giorno dopo: «le persone non riescono
      più a entrare in Meetly».
      La regola di prima diceva che la riga storica era di UN consulente solo:
      un collega che apriva quella consulenza non la trovava, ne faceva coniare
      una nuova, e il cliente — che aveva in mano il link con il codice vecchio
      — restava sulla schermata d'attesa mentre il consulente trasmetteva
      altrove.
      La regola giusta è più semplice e non si può violare: il codice di un
      appuntamento è l'unica cosa che il cliente ha in mano, ed è già partito
      per WhatsApp. Se una stanza esiste, si riusa — di chiunque sia. */
  c("la stanza dell'appuntamento è di chi la chiede", true, stanzaStoricaSua({ consultantId: anna }, bruno));
  c("anche senza nome scritto sopra", true, stanzaStoricaSua({ consultantId: "" }, anna));
  c("e anche a chi non ha un nome", true, stanzaStoricaSua({ consultantId: anna }, ""));
  c("una riga che non c'è non è di nessuno", false, stanzaStoricaSua(null, anna));
}

/*  ── LA SOGLIA DELLA VOCE QUANDO PARLA ANCHE L'ALTRO ──────────────────────
    Segnalazione del committente: «quando uno parla si rovina la trasmissione
    audio dell'altro». */
function proveDellaSogliaVoce() {
  const { sogliaApertura, valvolaPuoSpegnere, MARGINE_ECO_DB } = SGV;
  gruppo("LA VOCE QUANDO PARLA L'ALTRO");

  const SOGLIA = -45;   // l'impostazione consigliata

  //  Da soli non cambia niente rispetto a sempre.
  c("in silenzio la soglia resta quella scelta", SOGLIA, sogliaApertura(SOGLIA, false));

  /*  ── ⚠️ IL CUORE DELLA CORREZIONE ──────────────────────────────────────
      Mentre parla l'altro serve una voce più forte per aprire: l'eco che
      torna da un altoparlante è molto più debole di chi parla davanti al
      microfono, e questa differenza è tutto ciò che serve a distinguerli. */
  c("mentre parla l'altro serve di più", SOGLIA + MARGINE_ECO_DB, sogliaApertura(SOGLIA, true));
  c("ed è più severa, non più permissiva", true, sogliaApertura(SOGLIA, true) > sogliaApertura(SOGLIA, false));

  //  Un'eco da altoparlante di portatile sta sotto i -40 dB: non apre più.
  const eco = -40;
  c("l'eco apriva prima", true, eco >= sogliaApertura(SOGLIA, false));
  c("e adesso non apre", false, eco >= sogliaApertura(SOGLIA, true));

  //  ⚠️ Ma chi parla DAVVERO continua a passare: una voce a un braccio dal
  //   microfono sta fra -30 e -15 dB.
  for (const voce of [-30, -22, -15]) {
    c(`una voce a ${voce} dB passa comunque`, true, voce >= sogliaApertura(SOGLIA, true));
  }

  //  Un'impostazione storta non manda tutto all'aria.
  c("una soglia non numerica non rompe niente", -45, sogliaApertura(NaN, false));

  /*  ── LA VALVOLA DI SICUREZZA ───────────────────────────────────────────
      «C'è voce ma la porta non si apre da tre secondi → spengo la soglia».
      Serve a non restare muti mentre si parla. */
  c("con voce e porta chiusa la valvola può scattare", true,
    valvolaPuoSpegnere({ livelloDb: -30, gateAperta: false, altriParlano: false }));
  c("a porta aperta non serve", false,
    valvolaPuoSpegnere({ livelloDb: -30, gateAperta: true, altriParlano: false }));
  c("col silenzio nemmeno", false,
    valvolaPuoSpegnere({ livelloDb: -70, gateAperta: false, altriParlano: false }));

  //  ⚠️ E QUI STAVA IL DANNO PEGGIORE: mentre parla l'altro, quella «voce»
  //   che non riesce ad aprire è la sua eco. Spegnere la soglia voleva dire
  //   rimandargliela indietro per tutta la consulenza.
  c("mentre parla l'altro la valvola NON scatta", false,
    valvolaPuoSpegnere({ livelloDb: -30, gateAperta: false, altriParlano: true }));
}

/** ── DI CHI È LA COLPA QUANDO LAGGA ────────────────────────────────────────
 *
 *  Richiesta del committente: «mostrami se quando lagga sta laggando il server,
 *  la mia connessione o la connessione dell'utente».
 *
 *  ⚠️ PERCHÉ SI PROVA QUI E NON IN CHIAMATA. In una videochiamata vera non si
 *   può ordinare al cliente di perdere il 9% dei pacchetti, né al ponte di
 *   metterci 400 ms: le combinazioni che contano sono proprio quelle che non si
 *   riescono a riprodurre a comando. Qui il giudizio è una funzione pura che
 *   riceve cinque numeri, e ogni caso si scrive in una riga.
 *  ⚠️ E SBAGLIARE COSTA UNA FIGURA: la frase la si legge al cliente ad alta
 *   voce («è la tua linea»). Dare la colpa a lui quando è la nostra è il modo
 *   più veloce di perdere una consulenza.
 */
function proveDellaDiagnosiLinea() {
  const { diagnosiLinea, percento, PERSI_TANTI, PERSI_SOSPETTI, RTT_ALTO_MS } = DGL;
  gruppo("CHI STA RALLENTANDO LA CHIAMATA");

  //  Linea sana: NON si accusa nessuno. Una spia che accusa sempre qualcuno non
  //  la guarda piu' nessuno.
  const sana = diagnosiLinea({ kbit: 4000, rttMs: 30, persiSu: 0, persiGiu: 0, limite: "" });
  c("con la linea sana non si accusa nessuno", "nessuno", sana.chi);
  c("e il tono e' tranquillo", "ok", sana.tono);
  c("nemmeno con un filo di perdita", "nessuno",
    diagnosiLinea({ kbit: 4000, rttMs: 40, persiSu: 0.004, persiGiu: 0.008 }).chi);

  //  1. L'encoder si dichiara limitato dalla CPU: e' il computer, e nessun
  //     intervento sulla rete lo toglie. Vale PRIMA di tutto il resto.
  const cpu = diagnosiLinea({ kbit: 4000, rttMs: 20, persiSu: 0, limite: "cpu" });
  c("se l'encoder dice cpu la colpa e' del computer", "computer", cpu.chi);
  c("e lo dice anche se la linea perde", "computer",
    diagnosiLinea({ kbit: 300, rttMs: 900, persiSu: 0.4, persiGiu: 0.4, limite: "cpu" }).chi);
  c("il consiglio parla di chiudere roba", true, /chiud/i.test(cpu.cosa));

  //  2. Il cliente perde quello che gli mandiamo, MA la nostra salita e' larga
  //     e l'encoder non e' limitato: e' la sua discesa.
  const suoi = diagnosiLinea({ kbit: 5000, rttMs: 40, persiSu: 0.12, persiGiu: 0 });
  c("perdita verso il cliente con la nostra linea larga = e' lui", "cliente", suoi.chi);
  c("e si dice quanto perde", true, suoi.cosa.includes("12%"));
  c("con tanta perdita il tono e' grave", "grave", suoi.tono);

  //  …e se invece la nostra salita e' al limite, la colpa e' NOSTRA: e' lo
  //  stesso sintomo con due cause opposte, ed e' il caso che si sbagliava a
  //  occhio piu' spesso.
  const mia = diagnosiLinea({ kbit: 300, rttMs: 40, persiSu: 0.12, persiGiu: 0 });
  c("la stessa perdita con la nostra linea stretta e' colpa nostra", "tu", mia.chi);
  c("e il consiglio e' spegnere la camera", true, /camera/i.test(mia.cosa));
  //  Anche l'encoder che si dichiara limitato dalla rete accusa noi: e' il
  //  nostro encoder a dire che non ha banda.
  c("encoder limitato dalla rete = colpa nostra", "tu",
    diagnosiLinea({ kbit: 5000, rttMs: 40, persiSu: 0.04, limite: "rete" }).chi);

  //  3. Perdiamo NOI quello che manda lui: e' la sua linea in salita.
  const giu = diagnosiLinea({ kbit: 5000, rttMs: 40, persiSu: 0, persiGiu: 0.09 });
  c("perdita in entrata = linea del cliente", "cliente", giu.chi);
  c("e si dice che e' la sua salita", true, /salita/i.test(giu.cosa));
  c("appena sopra la soglia il tono e' attenzione", "attenzione",
    diagnosiLinea({ kbit: 5000, persiGiu: PERSI_SOSPETTI }).tono);

  //  4. Il ponte si accusa SOLO con il ritardo alto E il relay: su un percorso
  //     diretto un ritardo alto e' distanza, e accusare il server sarebbe
  //     un'accusa senza prove.
  c("ritardo alto col ponte = colpa del ponte", "ponte",
    diagnosiLinea({ kbit: 4000, rttMs: 500, ponte: true }).chi);
  c("ritardo alto senza ponte non accusa il server", "nessuno",
    diagnosiLinea({ kbit: 4000, rttMs: 500, ponte: false }).chi);
  c("ma lo dice comunque", "attenzione", diagnosiLinea({ kbit: 4000, rttMs: 500 }).tono);
  //  ⚠️ Il ponte da solo, senza ritardo, non e' un guasto: passare da un relay
  //   e' normalissimo su parecchie reti aziendali e si vede benissimo.
  c("il ponte da solo non e' una colpa", "nessuno",
    diagnosiLinea({ kbit: 4000, rttMs: 40, ponte: true }).chi);
  //  E le perdite vengono PRIMA del ponte: se si perde, il ritardo e' un
  //  dettaglio.
  c("la perdita conta piu' del ritardo", "cliente",
    diagnosiLinea({ kbit: 5000, rttMs: 800, ponte: true, persiGiu: 0.2 }).chi);

  //  Le soglie sono quelle dichiarate, e sotto non si accusa nessuno.
  c("appena sotto la soglia di perdita non si accusa", "nessuno",
    diagnosiLinea({ kbit: 5000, persiGiu: PERSI_SOSPETTI - 0.001 }).chi);
  c("appena sotto il ritardo alto non si dice niente", "ok",
    diagnosiLinea({ kbit: 5000, rttMs: RTT_ALTO_MS - 1 }).tono);
  c("le soglie sono in ordine", true, PERSI_SOSPETTI < PERSI_TANTI);

  //  Ogni verdetto ha un titolo corto e una frase che dice cosa fare: sono le
  //  due cose che finiscono davanti agli occhi durante una consulenza.
  for (const caso of [
    { limite: "cpu" }, { kbit: 300, persiSu: 0.2 }, { kbit: 5000, persiSu: 0.2 },
    { persiGiu: 0.2 }, { rttMs: 600, ponte: true }, { rttMs: 600 }, { kbit: 4000 },
  ]) {
    const d = diagnosiLinea(caso);
    c(`verdetto con titolo breve (${d.chi})`, true, d.titolo.length > 0 && d.titolo.length <= 34);
    c(`verdetto con una frase utile (${d.chi})`, true, d.cosa.length > 30);
  }

  //  ⚠️ Numeri sporchi non devono produrre frasi sporche: questi arrivano da
  //   getStats(), che su qualche browser risponde `undefined` o NaN.
  c("misure vuote non rompono niente", "nessuno", diagnosiLinea({}).chi);
  c("NaN vale come zero", "nessuno", diagnosiLinea({ kbit: NaN, rttMs: NaN, persiSu: NaN }).chi);

  //  La percentuale si dice come si dice a voce.
  c("la percentuale si legge", "3%", percento(0.03));
  c("sotto il dieci si tiene un decimale", "1.2%", percento(0.012));
  c("sopra il dieci si arrotonda", "24%", percento(0.2361));
  c("zero e' zero", "0%", percento(0));
}

/** ── PIÙ OSPITI NELLA STESSA CONSULENZA ────────────────────────────────────
 *
 *  Richiesta del committente: «fai che possono entrare anche 3 ospiti o più
 *  nella consulenza». Entrare si poteva già; quello che non funzionava è ciò
 *  che si VEDE quando sono più di uno, e sono due cose che qui si tengono
 *  ferme: l'ospite di riferimento (uno solo, e sempre lo stesso per tutti
 *  quelli che lo chiedono) e il conto della linea che si divide.
 */
function proveDegliOspiti() {
  const { ospitiDi, ospiteDiRiferimento, pidDiRiferimento, statoCamereOspiti,
    consiglioPerTantiOspiti, BANDA_PER_OSPITE_KBIT } = OSP;
  gruppo("PIU' OSPITI NELLA CONSULENZA");

  const R = [
    { pid: "h1", name: "Consulente", role: "host", camOn: true },
    { pid: "a", name: "Anna", role: "viewer", camOn: true },
    { pid: "b", name: "Bruno", role: "viewer", camOn: true },
    { pid: "c", name: "Carla", role: "viewer", camOn: false },
  ];

  //  Gli ospiti sono gli ospiti: il presentatore non e' un ospite.
  c("il presentatore non conta come ospite", 3, ospitiDi(R).length);
  c("e l'ordine e' quello di arrivo", "a,b,c", ospitiDi(R).map((o) => o.pid).join(","));
  c("una lista vuota non rompe niente", 0, ospitiDi(null).length);
  c("le voci senza pid si scartano", 1, ospitiDi([{ role: "viewer" }, { pid: "x", role: "viewer" }]).length);

  /*  ── UN SOLO OSPITE DI RIFERIMENTO ──────────────────────────────────────
      La forma dello schermo (per l'anteprima «come lo vede lui») e «la camera
      del cliente» devono seguire la STESSA persona: se seguissero due persone
      diverse si guarderebbe una faccia dentro la cornice di un'altra. */
  c("senza focus vale il primo arrivato", "a", pidDiRiferimento(R));
  c("il focus del presentatore comanda", "b", pidDiRiferimento(R, { focusPid: "b" }));
  //  ⚠️ Un focus appeso a chi e' uscito NON deve far seguire un fantasma.
  c("un focus che non e' piu' collegato si ignora", "a", pidDiRiferimento(R, { focusPid: "fuori" }));
  //  ⚠️ Nemmeno il presentatore puo' essere «l'ospite» di riferimento: la sua
  //   forma di schermo non e' quella del cliente.
  c("il presentatore non diventa riferimento", "a", pidDiRiferimento(R, { focusPid: "h1" }));
  c("senza ospiti non c'e' riferimento", "", pidDiRiferimento([R[0]]));
  c("e nemmeno con la lista vuota", null, ospiteDiRiferimento([]));
  //  Con UN ospite solo si comporta come si e' sempre comportato: e' la prova
  //  che questa modifica non cambia niente per le consulenze normali.
  c("con un ospite solo e' quello", "a", pidDiRiferimento([R[0], R[1]]));

  /*  ── L'INTERRUTTORE UNICO DELLE CAMERE ──────────────────────────────────
      Con tre ospiti spegnere una per una sono tre clic davanti al cliente. */
  const st = statoCamereOspiti(R);
  c("conta gli ospiti", 3, st.quanti);
  c("conta le camere accese", 2, st.accese);
  c("e quelle spente", 1, st.spente);
  c("finche' ne resta una accesa il pulsante spegne", false, st.prossimaAzione);
  const tutteSpente = statoCamereOspiti([R[0], { pid: "a", role: "viewer", camOn: false }]);
  c("con tutte spente il pulsante accende", true, tutteSpente.prossimaAzione);
  c("e lo dice", true, tutteSpente.tutteSpente);
  //  ⚠️ Chi non ha ancora mandato il suo annuncio non ha `camOn`: vale ACCESA,
  //   altrimenti comparirebbe «accendi le camere» mentre sono accese.
  c("camera non dichiarata vale accesa", 1, statoCamereOspiti([{ pid: "z", role: "viewer" }]).accese);
  c("senza ospiti non c'e' niente da accendere", false, statoCamereOspiti([R[0]]).prossimaAzione);

  /*  ── LA LINEA NON SI MOLTIPLICA ─────────────────────────────────────────
      La camera parte una volta per ciascuno: in quattro si manda quattro
      volte, sulla stessa linea. */
  c("con un ospite solo non si dice niente", null, consiglioPerTantiOspiti(1, 4000));
  c("e nemmeno con zero", null, consiglioPerTantiOspiti(0, 4000));
  const larga = consiglioPerTantiOspiti(3, 8000);
  c("linea larga: tre ospiti ci stanno", false, larga.grave);
  c("e dice quanto resta a testa", true, /2266|22\d\d/.test(larga.testo));
  const stretta = consiglioPerTantiOspiti(4, 2000);
  c("linea stretta con quattro ospiti: avviso", true, stretta.grave);
  c("e dice cosa fare", true, /Media|spegni/i.test(stretta.testo));
  //  Senza misura della linea si dice la regola, non un numero inventato.
  const albuio = consiglioPerTantiOspiti(3, 0);
  c("senza misura si dice solo la regola", false, albuio.grave);
  c("e non si inventano kbit", false, /kbit/.test(albuio.testo));
  c("la soglia per ospite e' quella dichiarata", true, BANDA_PER_OSPITE_KBIT >= 700);
  //  Il numero degli ospiti entra nella frase: e' la prima cosa che si guarda.
  c("la frase dice quanti sono", true, consiglioPerTantiOspiti(5, 3000).testo.startsWith("5 ospiti"));

  /*  ── ACCENDERE LA CAMERA DELL'OSPITE PUO' NON RIUSCIRE ──────────────────
      Segnalazione: «fai che posso attivare e disattivare la camera degli
      ospiti». Spegnere riesce sempre; riaccendere e' `getUserMedia`, e il
      browser la concede solo col permesso valido, la camera libera e — su
      iPhone — spesso solo dopo un TOCCO. Un comando arrivato dal canale non e'
      un tocco: quando il browser rifiuta, l'ospite deve VEDERE la richiesta
      (il suo dito e' cio' che manca) e il presentatore deve SAPERLO. Qui si
      prova quale delle due righe vede l'ospite. */
  const { avvisoCameraOspite } = OSP;
  const dentro = { joined: true };
  c("camera accesa: nessun avviso", "niente", avvisoCameraOspite({ ...dentro, camOn: true }));
  //  ⚠️ Nemmeno se un minuto prima l'aveva spenta il consulente: il fatto e'
  //   compiuto, e un avviso che resta appeso insegna a ignorare gli avvisi.
  c("accesa dopo uno spegnimento: comunque niente", "niente",
    avvisoCameraOspite({ ...dentro, camOn: true, spentaDalConsulente: true }));
  c("spenta dal consulente: lo dice", "spenta-dal-consulente",
    avvisoCameraOspite({ ...dentro, camOn: false, spentaDalConsulente: true }));
  c("richiesta di accendere: chiede il tocco", "chiesta-dal-consulente",
    avvisoCameraOspite({ ...dentro, camOn: false, chiestaDalConsulente: true }));
  //  ⚠️ La richiesta di ACCENDERE viene dopo lo spegnimento che l'ha
  //   preceduta, e chiede un'azione: vince lei.
  c("la richiesta batte lo spegnimento", "chiesta-dal-consulente",
    avvisoCameraOspite({ ...dentro, camOn: false, spentaDalConsulente: true, chiestaDalConsulente: true }));
  //  Camera spenta da LUI (non dal consulente): non e' affar nostro, niente riga.
  c("spenta da lui: nessun avviso", "niente", avvisoCameraOspite({ ...dentro, camOn: false }));
  //  ⚠️ Fuori dalla consulenza non si dice niente a nessuno: la schermata
  //   d'attesa non e' il posto per un avviso sulla camera.
  c("prima di entrare non si dice niente", "niente",
    avvisoCameraOspite({ joined: false, camOn: false, chiestaDalConsulente: true }));
  c("uno stato vuoto non rompe niente", "niente", avvisoCameraOspite({}));

  /*  ── E IL MICROFONO ───────────────────────────────────────────────────
      Richiesta del committente: «un pulsante sopra la schermata di
      quell'utente per inviare di nuovo la richiesta di camera E microfono, e
      all'utente arriva di nuovo la notifica dove puo' autorizzare». Prima di
      qui passava solo la camera: «non ti sento» non aveva nessuna richiesta
      da mandare, e si risolveva a voce. */
  c("chiesto il microfono: lo dice", "chiesto-microfono",
    avvisoCameraOspite({ ...dentro, camOn: true, micOn: false, micChiestoDalConsulente: true }));
  //  ⚠️ IL MICROFONO SI CHIEDE ANCHE A CAMERA ACCESA: sono due permessi
  //   separati, e si resta senza voce con la faccia perfettamente visibile.
  //   Questo e' il controllo che tiene in piedi quella riga.
  c("tutti e due mancanti: una frase sola", "chiesti-camera-e-microfono",
    avvisoCameraOspite({ ...dentro, camOn: false, micOn: false, chiestaDalConsulente: true, micChiestoDalConsulente: true }));
  c("chiesta la camera, microfono gia' aperto: solo la camera", "chiesta-dal-consulente",
    avvisoCameraOspite({ ...dentro, camOn: false, micOn: true, chiestaDalConsulente: true, micChiestoDalConsulente: true }));
  //  ⚠️ Quello che e' GIA' aperto non si chiede: un avviso che resta appeso
  //   dopo che il problema e' passato insegna a ignorare gli avvisi.
  c("tutti e due gia' aperti: niente", "niente",
    avvisoCameraOspite({ ...dentro, camOn: true, micOn: true, chiestaDalConsulente: true, micChiestoDalConsulente: true }));
  c("microfono chiuso ma nessuno l'ha chiesto: niente", "niente",
    avvisoCameraOspite({ ...dentro, camOn: true, micOn: false }));
  c("prima di entrare, nemmeno il microfono", "niente",
    avvisoCameraOspite({ joined: false, camOn: true, micOn: false, micChiestoDalConsulente: true }));
}

function proveDellaBanda() {
  const { tettoInvio, scalaMesh, fotogrammiMesh, TETTO_MINIMO, QUOTA_LINEA } = BND;
  gruppo("QUANTA BANDA PRENDERSI");

  const ALTA = 2_500_000;
  const linea = 4_000_000;   // quattro megabit in salita: una linea normale

  //  Da solo con un interlocutore: si manda quello che si è scelto, se la
  //  linea lo regge.
  const solo = tettoInvio({ listino: ALTA, disponibile: linea, riceventi: 1 });
  c("se la linea basta si manda il listino", ALTA, solo);
  //  Se invece la linea è stretta, comanda lei — meno il respiro per i picchi,
  //  l'audio e i rinvii dei pacchetti persi.
  c("se la linea è stretta comanda la linea", Math.round(2_000_000 * QUOTA_LINEA),
    tettoInvio({ listino: ALTA, disponibile: 2_000_000, riceventi: 1 }));

  /*  ── ⚠️ IL CUORE DELLA CORREZIONE ──────────────────────────────────────
      Con due interlocutori si chiedeva a CIASCUNO l'85% della linea: il 170%
      in totale. Si spinge oltre quello che passa, i pacchetti si perdono e
      l'immagine si impunta — da tutte e due le parti. */
  const due = tettoInvio({ listino: ALTA, disponibile: linea, riceventi: 2 });
  c("in due la linea si sparte", true, due * 2 <= Math.round(linea * QUOTA_LINEA) + 2);
  c("e non si chiede piu' di quanto passa", true, due * 2 <= linea);
  const tre = tettoInvio({ listino: ALTA, disponibile: linea, riceventi: 3 });
  c("in tre nemmeno", true, tre * 3 <= linea);

  //  Più interlocutori = fetta più piccola, sempre.
  c("piu' interlocutori, fetta piu' piccola", true, due < solo && tre < due);

  //  ⚠️ Ma mai sotto il minimo: meglio un'immagine povera che nessuna.
  const stretta = tettoInvio({ listino: ALTA, disponibile: 300_000, riceventi: 4 });
  c("sotto il minimo non si scende", TETTO_MINIMO, stretta);
  c("nemmeno con una linea a zero misurata", TETTO_MINIMO, tettoInvio({ listino: ALTA, disponibile: 1, riceventi: 9 }));

  //  Linea non ancora misurata: si parte prudenti ma non muti.
  const buio = tettoInvio({ listino: ALTA, disponibile: 0, riceventi: 1 });
  c("al buio si parte dal listino", ALTA, buio);
  c("al buio in tre si sparte lo stesso", true, tettoInvio({ listino: ALTA, disponibile: 0, riceventi: 3 }) < ALTA);

  //  Il listino resta un tetto: una linea enorme non fa mandare piu' del dovuto.
  c("la linea grande non sfonda il listino", ALTA, tettoInvio({ listino: ALTA, disponibile: 99_000_000, riceventi: 1 }));

  /*  ── SI SCENDE SUBITO, SI SALE PIANO ───────────────────────────────────
      Un tetto che rimbalza su e giu' fa piu' danni di uno basso: l'encoder
      insegue e il video pulsa. */
  const crollo = tettoInvio({ listino: ALTA, disponibile: 800_000, riceventi: 1, precedente: 2_000_000 });
  c("la linea crolla e il tetto scende subito", Math.round(800_000 * QUOTA_LINEA), crollo);
  const risalita = tettoInvio({ listino: ALTA, disponibile: linea, riceventi: 1, precedente: 700_000 });
  c("la linea torna e il tetto sale a passi", 805_000, risalita);
  c("ma non oltre quello che serve", true, risalita < Math.round(linea * QUOTA_LINEA));

  /*  ── SE LA LINEA È PULITA SI RISALE IN FRETTA ──────────────────────────
      Il passo prudente si pagava sempre: da 600 kbit a 2,5 Mbit sono dieci
      giri di sonda, cioè venticinque secondi di immagine povera dopo ogni
      singhiozzo. La prudenza serve a non spingere oltre la linea, e se non si
      perde un pacchetto non c'è niente da cui guardarsi. */
  const { PASSO_PULITO, PASSO_IN_SALITA } = BND;
  c("il passo pulito e' piu' largo di quello prudente", true, PASSO_PULITO > PASSO_IN_SALITA);
  const veloce = tettoInvio({ listino: ALTA, disponibile: linea, riceventi: 1, precedente: 700_000, pulita: true });
  c("con la linea pulita si risale piu' in fretta", true, veloce > risalita);
  c("e il passo e' esattamente quello dichiarato", Math.round(700_000 * PASSO_PULITO), veloce);
  //  ⚠️ Ma il TETTO non cambia: la fretta non fa mai chiedere piu' della linea.
  c("la fretta non sfonda la quota della linea", true,
    tettoInvio({ listino: ALTA, disponibile: 900_000, riceventi: 1, precedente: 800_000, pulita: true })
      <= Math.round(900_000 * QUOTA_LINEA));
  c("ne' il listino", ALTA, tettoInvio({ listino: ALTA, disponibile: linea, riceventi: 1, precedente: 2_400_000, pulita: true }));
  //  ⚠️ E scendere resta immediato anche con la linea «pulita»: la discesa non
  //   passa dal passo, mai — e' lì che il video si impunta.
  c("si scende subito anche se pulita", Math.round(800_000 * QUOTA_LINEA),
    tettoInvio({ listino: ALTA, disponibile: 800_000, riceventi: 1, precedente: 2_000_000, pulita: true }));
  //  Nel dubbio (nessuna misura) vale il passo prudente.
  c("senza misure vale la prudenza", risalita,
    tettoInvio({ listino: ALTA, disponibile: linea, riceventi: 1, precedente: 700_000, pulita: undefined }));

  //  L'immagine si rimpicciolisce solo quando le copie sono piu' d'una.
  c("da solo l'immagine resta intera", 1, scalaMesh(1));
  c("in due si rimpicciolisce", 1.5, scalaMesh(2));
  c("in tre di piu'", 2, scalaMesh(3));
  c("e non oltre", 2.5, scalaMesh(9));

  /*  ── MENO BIT SENZA MENO PIXEL È IL PEGGIO DEI DUE MONDI ──────────────
      È il caso di due trasmissioni sulla stessa linea: la banda si dimezza.
      Descrivere 1280×720 con la banda di un francobollo significa buttare
      fotogrammi — cioè «va lento a scatti». */
  const { scalaPerTetto } = BND;
  c("con banda piena l'immagine resta intera", 1, scalaPerTetto(ALTA, ALTA));
  c("a meta' banda si rimpicciolisce", 1.5, scalaPerTetto(ALTA * 0.4, ALTA));
  c("con pochissima banda di piu'", 2, scalaPerTetto(ALTA * 0.15, ALTA));
  c("e sopra il 60% non si tocca niente", 1, scalaPerTetto(ALTA * 0.7, ALTA));
  c("un listino a zero non rompe niente", 1, scalaPerTetto(500_000, 0));

  /*  ── «POSSIAMO STARE ENTRAMBI SU ALTA?» ───────────────────────────────
      Sì, e il conto è questo. «Alta» è la RISOLUZIONE (1280×720): i 2,5 Mbit
      erano il tetto di spesa, dimensionato per un'immagine piena di
      movimento. Un viso che parla sta fermo e costa molto meno. La
      condivisione schermo invece tiene il tetto pieno: lì ci sono testo e
      linee sottili, e abbassarlo significa lettere che sbavano. */
  const { listinoVideo } = BND;
  const cam = listinoVideo(ALTA, false);
  c("la camera chiede meno dello schermo", true, cam < ALTA);
  c("lo schermo tiene il tetto pieno", ALTA, listinoVideo(ALTA, true));
  c("due camere in Alta stanno in 3,4 Mbit", true, cam * 2 <= 3_400_000);
  c("ma una camera in Alta resta sopra il megabit e mezzo", true, cam >= 1_500_000);
  c("e nemmeno qui si scende sotto il minimo", TETTO_MINIMO, listinoVideo(100_000, false));
  c("un listino a zero non rompe niente", TETTO_MINIMO, listinoVideo(0, false));

  //  E il giro completo: due consulenze insieme su una linea da 4 Mbit ora
  //  ci stanno tutte e due, senza chiedere piu' di quanto passa.
  const perUno = tettoInvio({ listino: cam, disponibile: linea / 2, riceventi: 1 });
  c("due consulenze su 4 Mbit stanno entrambe in Alta", true, perUno >= 1_500_000);

  //  I fotogrammi si toccano solo da tre in su.
  c("in due i fotogrammi restano", 30, fotogrammiMesh(30, 2));
  c("in tre scendono", 24, fotogrammiMesh(30, 3));
  c("ma non salgono mai sopra il listino", 15, fotogrammiMesh(15, 4));
}

function proveDelloZoom() {
  const { scalaLimitata, passoDoppioClick, ingrandita, SCALA_MIN, SCALA_MAX } = ZOM;
  gruppo("LO ZOOM SUI MEDIA");

  c("si parte dall'immagine intera", 1, scalaLimitata(1));
  c("non si scende sotto l'intera", 1, scalaLimitata(0.2));
  c("e non si sale oltre il massimo", SCALA_MAX, scalaLimitata(99));

  /*  ── ⚠️ IL CUORE DELLA CORREZIONE ──────────────────────────────────────
      Il giro dei pulsanti: tre volte "+" e tre volte "−" deve riportare
      ESATTAMENTE all'immagine intera. Prima restava un residuo invisibile
      che teneva la vista ingrandita. */
  let s = 1;
  for (let i = 0; i < 3; i++) s = scalaLimitata(s + 0.4);
  for (let i = 0; i < 3; i++) s = scalaLimitata(s - 0.4);
  c("avanti e indietro si torna all'intera", 1, s);
  c("e il programma lo sa", false, ingrandita(s));
  c("un residuo invisibile vale intera", false, ingrandita(1.0000000000000002));
  c("mentre un ingrandimento vero si vede", true, ingrandita(1.4));

  //  La rotella: passi qualsiasi, stessa proprietà.
  let r = 1;
  r = scalaLimitata(r + 0.37); r = scalaLimitata(r + 0.63);
  c("la rotella si ferma sui centesimi", 2, r);
  r = scalaLimitata(r - 1.5);
  c("e tornando giù non sfonda l'intera", 1, r);

  /*  ── IL DOPPIO CLICK ───────────────────────────────────────────────────
      Sale di un passo per volta fino al massimo, poi torna giù. */
  let d = { scala: 1, verso: 1 };
  d = passoDoppioClick(d.scala, d.verso);
  c("il primo doppio click ingrandisce", 2, d.scala);

  //  ⚠️ Arrivati al massimo con i PULSANTI, il verso ricordato diceva ancora
  //   "sali": il primo doppio click non faceva niente e sembrava rotto.
  const pieno = passoDoppioClick(SCALA_MAX, 1);
  c("dal massimo il doppio click scende", 4, pieno.scala);
  c("e ricorda di scendere", -1, pieno.verso);

  //  ⚠️ E dal fondo risale, qualunque cosa dicesse la memoria.
  const fondo = passoDoppioClick(SCALA_MIN, -1);
  c("dall'intera il doppio click ingrandisce", 2, fondo.scala);
  c("e ricorda di salire", 1, fondo.verso);

  //  Il giro completo torna sempre all'intera, senza restare a mezz'aria.
  let g = { scala: 1, verso: 1 };
  for (let i = 0; i < 8; i++) g = passoDoppioClick(g.scala, g.verso);
  c("otto doppi click: si torna all'intera", 1, g.scala);
  c("e si riparte in salita", 1, g.verso);
}

function proveDellaBozza() {
  const { bozzaUtile, PARTENZA } = BZZ;
  gruppo("IL PREVENTIVO LASCIATO A META'");

  c("una schermata mai toccata non si propone", false, bozzaUtile({ ...PARTENZA }, PARTENZA));
  c("niente bozza, niente da proporre", false, bozzaUtile(null, PARTENZA));

  //  ⚠️ IL PUNTO DELLA CORREZIONE: un codice applicato È lavoro fatto, anche
  //   se non si è toccato nient'altro. Prima questa tornava `false` e la
  //   bozza non veniva nemmeno offerta.
  c("un codice applicato vale da solo", true, bozzaUtile({ ...PARTENZA, codice: "H7135X" }, PARTENZA));
  c("il campo vuoto non conta", false, bozzaUtile({ ...PARTENZA, codice: "" }, PARTENZA));

  //  Le altre porte d'ingresso restano quelle di prima.
  c("una scelta diversa basta", true, bozzaUtile({ ...PARTENZA, qty: 2 }, PARTENZA));
  c("e anche il nome del cliente", true, bozzaUtile({ ...PARTENZA, profile: { nome: "Mario" } }, PARTENZA));

  //  ⚠️ La calibrazione adesso parte SPENTA: una bozza che la porta accesa è
  //   una scelta fatta, e va offerta.
  c("la calibrazione parte spenta", false, PARTENZA.installOn);
  c("accenderla è una scelta", true, bozzaUtile({ ...PARTENZA, installOn: true }, PARTENZA));

  /*  ── ⚠️ «CHIEDE DI RECUPERARLO ANCHE SE NON C'È NIENTE DA RECUPERARE» ──
      Segnalazione del committente, e il motivo era un confronto impossibile
      da vincere: le spunte di partenza le decide il LISTINO, che arriva dal
      server un istante dopo l'apertura. La bozza veniva salvata con le spunte
      del listino e alla riapertura la si confrontava col ripiego di serie:
      due liste diverse = «hai toccato qualcosa» = scheda gialla, ogni volta,
      su una pagina mai sfiorata.
      Adesso la pagina DICHIARA se le scelte sono state toccate a mano. */
  const conListino = { ...PARTENZA, selected: ["base", "extra-del-listino"] };

  //  Il caso della segnalazione: spunte diverse dalla partenza, ma nessuno le
  //  ha toccate — è il listino che le ha messe lì.
  c("spunte del listino, mai toccate: niente scheda", false,
    bozzaUtile({ ...conListino, toccato: false }, PARTENZA));
  //  E la stessa identica bozza senza dichiarazione (versione vecchia) la
  //  offriva: è la prova che il guasto stava lì.
  c("…la stessa bozza senza dichiarazione la offriva", true,
    bozzaUtile(conListino, PARTENZA));

  //  ⚠️ E NON SI PERDE IL LAVORO VERO: dichiarato «toccato», si offre anche se
  //   le scelte somigliano alla partenza (aggiungi una voce e togli la stessa:
  //   le liste tornano uguali, ma tu hai lavorato).
  c("toccato davvero: si offre", true, bozzaUtile({ ...PARTENZA, toccato: true }, PARTENZA));

  /*  ⚠️ LA DICHIARAZIONE VALE SOLO SULLE SCELTE. Il nome del cliente, la
      quantità, la calibrazione e il codice non dipendono dal listino: lì il
      confronto è affidabile e resta davanti a tutto — se no un «non toccato»
      cancellerebbe dei dati scritti a mano. */
  c("il nome scritto vale anche con toccato falso", true,
    bozzaUtile({ ...conListino, toccato: false, profile: { nome: "Mario" } }, PARTENZA));
  c("e la quantità pure", true, bozzaUtile({ ...conListino, toccato: false, qty: 3 }, PARTENZA));
  c("e il codice sconto pure", true, bozzaUtile({ ...conListino, toccato: false, codice: "H7135X" }, PARTENZA));
  c("e la calibrazione accesa pure", true,
    bozzaUtile({ ...conListino, toccato: false, installOn: true }, PARTENZA));
}

function proveDellaChiaveSessione() {
  const { chiaveSessione, codiceChiave } = CHS;
  gruppo("UNA CONSULENZA, UNA RIGA");

  c("il codice fa parte della chiave", "session_live:kfr-mbqd-tzp", chiaveSessione("session_live", "kfr-mbqd-tzp"));
  c("ogni stato ha la sua base", "quote_state:kfr-mbqd-tzp", chiaveSessione("quote_state", "kfr-mbqd-tzp"));
  c("e la pagina seguita pure", "presenter_page:kfr-mbqd-tzp", chiaveSessione("presenter_page", "kfr-mbqd-tzp"));

  //  ⚠️ IL PUNTO DI TUTTO: due consulenze non devono MAI finire nella stessa
  //   casella, per nessuno dei tre stati.
  for (const base of ["session_live", "presenter_page", "quote_state"]) {
    c(`${base}: due consulenze, due righe`, false,
      chiaveSessione(base, "kfr-mbqd-tzp") === chiaveSessione(base, "wnp-zzcq-rdk"));
  }
  //  ...e lo stesso codice deve ritrovare la SUA, scritto come capita.
  c("stesso codice, stessa riga", chiaveSessione("session_live", "kfr-mbqd-tzp"), chiaveSessione("session_live", " KFR-MBQD-TZP "));

  //  Senza codice si torna alla riga storica: è il ripiego per chi è già in
  //  consulenza nel momento in cui si pubblica, non il modo normale.
  c("senza codice resta la riga di prima", "session_live", chiaveSessione("session_live", ""));
  c("e nemmeno il nulla la cambia", "quote_state", chiaveSessione("quote_state", null));
  c("né una cosa che non è un codice", "quote_state", chiaveSessione("quote_state", undefined));

  /*  ⚠️ IL CODICE ARRIVA DALL'INDIRIZZO, cioè da fuori, e finisce in una
      chiave di database: ciò che non è lettera, cifra o trattino non passa. */
  c("niente due punti nel codice", "session_live:abc", chiaveSessione("session_live", "a:b:c"));
  c("niente percentuali né spazi", "session_live:abc", chiaveSessione("session_live", "a% b c"));
  //  Le maiuscole si abbassano, le lettere accentate cadono: nei codici non ce
  //  ne sono (l'alfabeto è di sole consonanti), quindi non si perde nulla.
  c("le maiuscole si abbassano", "bcd", codiceChiave("BCD"));
  c("le lettere accentate cadono", "bc", codiceChiave("ÀBC"));
  c("un codice fatto di soli segni non vale", "", codiceChiave("%%%"));
  c("e allora si ricade sulla riga storica", "presenter_page", chiaveSessione("presenter_page", "%%%"));
  //  ⚠️ Un codice lunghissimo viene tagliato: è lungo undici caratteri, chi ne
  //   manda duecento non sta aprendo una consulenza. Il taglio tiene la TESTA,
  //   che è la parte che distingue un codice vero da un altro.
  c("un codice lunghissimo viene tagliato", 40, codiceChiave("k".repeat(200)).length);
  c("il taglio tiene la testa", "kfr-mbqd-tzp", codiceChiave("kfr-mbqd-tzp" + "x".repeat(200)).slice(0, 12));
}

function proveDellOratore() {
  const { passoOratore, statoOratoreVuoto, SOGLIA_VOCE, MARGINE, ATTESA_CAMBIO_MS, ATTESA_SILENZIO_MS } = ORA;
  gruppo("CHI PARLA");

  const A = "aaa", B = "bbb";
  let st = statoOratoreVuoto();
  c("all'inizio non parla nessuno", "", st.attuale);

  //  Il primo che parla si prende la scena subito: non c'e' niente da far
  //  tremare, e aspettare un secondo qui sarebbe solo un ritardo.
  st = passoOratore(st, [{ pid: A, rms: 0.4 }], 1000);
  c("il primo che parla la prende subito", A, st.attuale);

  /*  ── ⚠️ IL CUORE DELLA CORREZIONE ──────────────────────────────────────
      B supera A di pochissimo, per un istante: prima bastava questo per
      cambiare camera. Adesso non basta ne' il sorpasso di una virgola ne' un
      istante solo. */
  st = passoOratore(st, [{ pid: B, rms: 0.41 }, { pid: A, rms: 0.4 }], 1100);
  c("un sorpasso di una virgola non cambia niente", A, st.attuale);

  //  Anche superandolo di un margine vero, serve TEMPO.
  st = passoOratore(st, [{ pid: B, rms: 0.7 }, { pid: A, rms: 0.3 }], 1200);
  c("un istante solo non basta", A, st.attuale);
  st = passoOratore(st, [{ pid: B, rms: 0.7 }, { pid: A, rms: 0.3 }], 1200 + ATTESA_CAMBIO_MS - 50);
  c("e nemmeno poco prima della scadenza", A, st.attuale);
  st = passoOratore(st, [{ pid: B, rms: 0.7 }, { pid: A, rms: 0.3 }], 1200 + ATTESA_CAMBIO_MS + 10);
  c("ma se insiste la scena passa", B, st.attuale);

  //  ⚠️ E se molla a meta' strada, il conto riparte: due che si accavallano
  //   non devono rubarsi la scena a vicenda.
  let st2 = passoOratore(statoOratoreVuoto(), [{ pid: A, rms: 0.4 }], 0);
  st2 = passoOratore(st2, [{ pid: B, rms: 0.8 }, { pid: A, rms: 0.2 }], 100);
  st2 = passoOratore(st2, [{ pid: A, rms: 0.8 }, { pid: B, rms: 0.2 }], 700);   // B molla
  st2 = passoOratore(st2, [{ pid: B, rms: 0.8 }, { pid: A, rms: 0.2 }], 800);   // B riprova
  st2 = passoOratore(st2, [{ pid: B, rms: 0.8 }, { pid: A, rms: 0.2 }], 800 + ATTESA_CAMBIO_MS - 50);
  c("chi molla a meta' ricomincia da capo", A, st2.attuale);

  /*  ── IL SILENZIO NON LIBERA SUBITO ─────────────────────────────────────
      Fra una frase e l'altra si respira: una camerina che sparisce a ogni
      virgola e' peggio di una che resta. */
  let st3 = passoOratore(statoOratoreVuoto(), [{ pid: A, rms: 0.4 }], 0);
  st3 = passoOratore(st3, [], 500);
  c("una pausa non libera la scena", A, st3.attuale);
  st3 = passoOratore(st3, [], 500 + ATTESA_SILENZIO_MS + 10);
  c("il silenzio lungo si'", "", st3.attuale);

  //  ⚠️ Il respiro non e' voce: sotto la soglia non conta nessuno.
  const piano = passoOratore(statoOratoreVuoto(), [{ pid: A, rms: SOGLIA_VOCE - 0.01 }], 0);
  c("sotto la soglia non parla nessuno", "", piano.attuale);
  c("il margine e' dichiarato, non un numero a caso", true, MARGINE > 0 && MARGINE < 0.2);

  //  Robustezza: righe storte dall'altro capo non devono far cadere il conto.
  const storte = passoOratore(statoOratoreVuoto(), [null, { pid: "", rms: 9 }, { pid: A, rms: NaN }], 0);
  c("misure storte non rompono niente", "", storte.attuale);
}

function proveDelleMisureCamerina() {
  const { pipMisure, pipLimiti } = PIP;
  gruppo("LE MISURE DELLA CAMERINA");

  //  Uno schermo largo: le tre misure ci stanno tutte e sono diverse.
  const largo = pipMisure({ w: 1440, h: 900 });
  c("su uno schermo largo le misure sono tre", 3, largo.length);
  c("e sono in ordine crescente", true, largo[0] < largo[1] && largo[1] < largo[2]);

  //  ⚠️ IL CASO DEL GUASTO: uno schermo stretto. Qualunque cosa succeda, non
  //   devono esserci DOPPIONI — se due misure sono lo stesso numero, toccare
  //   per cambiarla non cambia niente e il cerchio sembra bloccato.
  for (const schermo of [{ w: 320, h: 480 }, { w: 360, h: 640 }, { w: 390, h: 844 }, { w: 280, h: 400 }]) {
    const m = pipMisure(schermo);
    c(`nessun doppione su ${schermo.w}x${schermo.h}`, m.length, new Set(m).size);
    //  E ogni misura resta dentro gli estremi di quello schermo.
    const { min, max } = pipLimiti(schermo);
    c(`e stanno tutte dentro i limiti (${schermo.w})`, true, m.every((x) => x >= min && x <= max));
    //  ⚠️ Almeno una misura c'e' sempre: un elenco vuoto farebbe fallire il
    //   giro del tocco con una divisione per zero.
    c(`almeno una misura (${schermo.w})`, true, m.length >= 1);
  }
}

function provePagineDelCliente() {
  const { paginaMostrabile } = PGC;
  gruppo("COSA PUO' VEDERE UN CLIENTE");

  /*  ── ⚠️ IL GUASTO ──────────────────────────────────────────────────────
      Segnalazione del committente: «il cliente vede la lista degli utenti di
      login». La pagina condivisa si registra anche con l'indirizzo in cui il
      consulente si trova quando AVVIA la consulenza: se in quel momento e' sul
      cancello dei presentatori, quel cancello diventa la pagina che il cliente
      segue — e le schermate interne non hanno una modalita' cliente, quindi si
      aprono come sono: elenco dei nomi e campo del PIN. */
  c("il cancello dei presentatori NON si condivide", false, paginaMostrabile("/presentatore"));
  c("e nemmeno il CRM", false, paginaMostrabile("/CRM"));
  c("nemmeno una sua pagina interna", false, paginaMostrabile("/CRM/trattative"));
  c("nemmeno le impostazioni", false, paginaMostrabile("/impostazioni"));
  //  ⚠️ Un indirizzo che COMINCIA come una pagina buona ma non lo e': il
  //   confronto e' sul percorso intero o su un sotto-percorso con la barra.
  c("«/preventivopippo» non e' «/preventivo»", false, paginaMostrabile("/preventivointerno"));

  //  Le pagine fatte per essere guardate, quelle si.
  for (const buona of ["/slide", "/preventivo", "/presenta", "/web", "/prova-capelli", "/meetly"]) {
    c(`${buona} si condivide`, true, paginaMostrabile(buona));
  }
  //  ⚠️ Con la domanda dietro: l'anteprima capelli porta il suo codice, e il
  //   controllo deve guardare il percorso, non la stringa intera.
  c("anche con i parametri dietro", true, paginaMostrabile("/prova-capelli?meet=abc&c=xyz"));
  //  ⚠️ E i sotto-percorsi: la stanza di una consulenza e la raccolta media.
  c("la stanza di una consulenza", true, paginaMostrabile("/meetly/kfr-mbqd-tzp"));
  c("una raccolta di media", true, paginaMostrabile("/media/F7MJ-A9WH-HVAW"));

  c("un indirizzo vuoto non si condivide", false, paginaMostrabile(""));
  c("e nemmeno uno che non comincia con la barra", false, paginaMostrabile("presentatore"));
}

function provePaginaCondivisa() {
  const { pezziPagina } = PGC;
  gruppo("LA PAGINA CHE IL CLIENTE DEVE SEGUIRE");

  const secca = pezziPagina("/preventivo");
  c("un indirizzo secco resta com'e'", "/preventivo", secca.percorso);
  c("e non porta niente con se'", 0, Object.keys(secca.extra).length);

  const capelli = pezziPagina("/prova-capelli?meet=gsq-psnb-vjf&c=3QF9-TNTQ");
  c("il percorso si ferma prima del punto interrogativo", "/prova-capelli", capelli.percorso);
  c("il codice della consulenza si conserva", "gsq-psnb-vjf", capelli.extra.meet);
  //  ⚠️ Senza `c` il cliente si vede chiedere un codice che non ha: e' la
  //   ragione per cui questa parte non si puo' buttare via.
  c("e il codice della prova pure", "3QF9-TNTQ", capelli.extra.c);

  //  ⚠️ Il `watch` e' di chi guarda, non del consulente: se arrivasse da qui
  //   sovrascriverebbe quello del cliente e lo scollegherebbe dalla sua
  //   consulenza.
  const conWatch = pezziPagina("/slide?watch=altro&x=1");
  c("il watch del consulente non passa al cliente", undefined, conWatch.extra.watch);
  c("il resto invece si'", "1", conWatch.extra.x);

  //  Robustezza: dal server puo' arrivare vuoto, e non deve far cadere niente.
  c("un indirizzo vuoto non rompe", "", pezziPagina("").percorso);
  c("ne' uno nullo", "", pezziPagina(null).percorso);

  /*  ── È GIÀ DOVE LO STIAMO PORTANDO? ───────────────────────────────────
      Segnalazione del committente: «se mostro il preventivo della consulenza
      e poi clicco "il suo — lo compila lui" non funziona più, rimane sempre
      quello della consulenza».
      ⚠️ Il percorso era lo stesso — `/preventivo` — e bastava quello a
       fermare la navigazione. Ma è il parametro `persona` a dire alla pagina
       in quale stanza entrare: senza quel salto il cliente restava sul
       comune, e l'interruttore sembrava morto. Solo in quell'ordine, però:
       se non gli avevi già mostrato il preventivo, lui non era su
       `/preventivo` e il salto avveniva. Ecco il «non funziona PIÙ». */
  const { stessaSchermata } = PGC;
  gruppo("È GIÀ DOVE LO STIAMO PORTANDO?");

  c("stessa pagina, stessa persona: è già lì", true,
    stessaSchermata({ percorso: "/preventivo", extra: { persona: "p1" }, quiPercorso: "/preventivo", quiRicerca: "?watch=abc&persona=p1" }));

  //  ⚠️ IL CUORE: stessa pagina, persona NUOVA. Prima si rispondeva «è già
  //   lì» e il cliente non entrava mai nella sua stanza.
  c("stessa pagina, persona diversa: si va", false,
    stessaSchermata({ percorso: "/preventivo", extra: { persona: "p1" }, quiPercorso: "/preventivo", quiRicerca: "?watch=abc" }));
  c("e si torna indietro quando la persona sparisce", false,
    stessaSchermata({ percorso: "/preventivo", extra: {}, quiPercorso: "/preventivo", quiRicerca: "?watch=abc&persona=p1" }));

  //  Pagine diverse: non c'è niente da discutere.
  c("pagina diversa", false,
    stessaSchermata({ percorso: "/slide", extra: {}, quiPercorso: "/preventivo", quiRicerca: "" }));

  //  `watch` e `debug` sono di chi guarda: non devono provocare un salto.
  c("il watch non conta", true,
    stessaSchermata({ percorso: "/preventivo", extra: { watch: "altro" }, quiPercorso: "/preventivo", quiRicerca: "?watch=mio" }));
  c("nemmeno il debug", true,
    stessaSchermata({ percorso: "/preventivo", extra: { debug: "1" }, quiPercorso: "/preventivo", quiRicerca: "" }));

  //  Un altro parametro che cambia è un movimento vero (le slide, per dire).
  c("un parametro diverso è un movimento", false,
    stessaSchermata({ percorso: "/slide", extra: { p: "3" }, quiPercorso: "/slide", quiRicerca: "?p=2" }));
  c("…e uguale non lo è", true,
    stessaSchermata({ percorso: "/slide", extra: { p: "2" }, quiPercorso: "/slide", quiRicerca: "?p=2" }));

  //  Robustezza: senza ricerca e senza extra non deve cadere niente.
  c("senza parametri da nessuna parte", true,
    stessaSchermata({ percorso: "/media", quiPercorso: "/media" }));

  /*  ── COSA SI REGISTRA COME «PAGINA DA MOSTRARE» ─────────────────────────
      Segnalazione del committente: «apro Meetly e va in automatico sul
      preventivo; poi vado su Media e resta sul preventivo». La schermata
      adesso si registra da sola dove il consulente si trova — e allora
      l'indirizzo non e' piu' un pulsante scelto da noi ma quello VERO della
      barra del browser, con dentro anche roba del consulente. */
  const { indirizzoPerIlCliente } = PGC;
  c("un indirizzo pulito resta identico", "/presenta", indirizzoPerIlCliente("/presenta"));
  c("il numero del preventivo si conserva", "/preventivo?id=IDP1234", indirizzoPerIlCliente("/preventivo?id=IDP1234"));
  c("e il codice della prova capelli pure", "/prova-capelli?meet=abc&c=3QF9", indirizzoPerIlCliente("/prova-capelli?meet=abc&c=3QF9"));

  //  ⚠️ QUESTE NO: cambiano come la pagina si disegna sul dispositivo di chi
  //   la apre, o sono credenziali del consulente.
  c("il codice di sblocco non viaggia", "/slide", indirizzoPerIlCliente("/slide?unlock=SEGRETO"));
  c("ne' la sessione da riprendere", "/slide", indirizzoPerIlCliente("/slide?session=kfr-mbqd-tzp"));
  c("ne' il segno dell'anteprima dispositivo", "/preventivo", indirizzoPerIlCliente("/preventivo?embed=1"));
  c("ne' quello della modalita' cliente", "/preventivo", indirizzoPerIlCliente("/preventivo?client=1"));
  c("ne' il watch di un altro", "/slide", indirizzoPerIlCliente("/slide?watch=altro"));
  c("si toglie solo il di troppo", "/preventivo?id=IDP1", indirizzoPerIlCliente("/preventivo?id=IDP1&unlock=X&debug=1"));
  c("un indirizzo vuoto non rompe nemmeno qui", "", indirizzoPerIlCliente(""));
}

/** ── LE DUE SCHERMATE DELLA PROVA IN CONSULENZA ───────────────────────────
 *  ⚠️ Il difetto da evitare non è «non si aggiorna»: è il contrario. Due
 *   schermate che si raccontano a vicenda quello che hanno appena sentito
 *   dall'altra girano per sempre, e su un telefono si vede — lampeggia.
 */
function proveDelloSpecchio() {
  const { firmaStato, daApplicare, passoDaMostrare, deveGenerare } = SPC;
  gruppo("LO SPECCHIO FRA CONSULENTE E CLIENTE");

  const base = { passo: "taglio", taglio: "rasato", colore: "castano_scuro", barba: false, esito: "", carico: false, genera: 0 };
  c("la firma non cambia se non cambia niente", firmaStato(base), firmaStato({ ...base }));
  c("cambia se cambia il taglio", true, firmaStato(base) !== firmaStato({ ...base, taglio: "altro" }));
  c("cambia se parte la generazione", true, firmaStato(base) !== firmaStato({ ...base, carico: true }));

  //  ⚠️ L'eco: quello che ho appena mandato mi torna indietro dal server.
  const mio = { ...base, da: "guida", v: 100 };
  c("non si applica quello che ho mandato io", false,
    daApplicare(mio, { ruolo: "guida", ultimaVersione: 0, firmaLocale: "" }));
  c("ma dall'altra parte si'", true,
    daApplicare(mio, { ruolo: "ospite", ultimaVersione: 0, firmaLocale: "" }));
  //  ⚠️ Fuori ordine: una notizia vecchia rimetterebbe indietro la schermata.
  c("una notizia piu' vecchia non torna indietro", false,
    daApplicare({ ...mio, v: 50 }, { ruolo: "ospite", ultimaVersione: 80, firmaLocale: "" }));
  c("ne' una identica a quello che gia' vedo", false,
    daApplicare(mio, { ruolo: "ospite", ultimaVersione: 0, firmaLocale: firmaStato(mio) }));
  c("e senza notizia non si fa niente", false,
    daApplicare(null, { ruolo: "ospite", ultimaVersione: 0, firmaLocale: "" }));

  //  ⚠️ Il consulente e' sul risultato, il telefono non ha ancora niente da
  //   mostrare: portarlo li' sarebbe una schermata vuota col titolo pieno.
  c("senza risultato non si va sul risultato", "colore",
    passoDaMostrare("risultato", { ruolo: "guida", haEsito: false, haFoto: true }));
  c("col risultato invece ci si va", "risultato",
    passoDaMostrare("risultato", { ruolo: "guida", haEsito: true, haFoto: false }));
  //  ⚠️ Il consulente non deve finire sulla fotocamera: la foto la fa il
  //   cliente, e quella schermata gli toglie di vista quello che sta scegliendo.
  c("il consulente non finisce sulla fotocamera", "taglio",
    passoDaMostrare("foto", { ruolo: "guida", haEsito: false, haFoto: false }));
  //  ⚠️ E il cliente che non si e' ancora fotografato non si sposta: e' l'unica
  //   cosa che deve fare, e senza quella non parte niente.
  c("il cliente senza foto resta a farla", "foto",
    passoDaMostrare("taglio", { ruolo: "ospite", haEsito: false, haFoto: false }));
  c("ma se il risultato c'e' lo guarda lo stesso", "risultato",
    passoDaMostrare("risultato", { ruolo: "ospite", haEsito: true, haFoto: false }));
  c("col la foto invece segue il consulente", "taglio",
    passoDaMostrare("taglio", { ruolo: "ospite", haEsito: false, haFoto: true }));
  c("gli altri passi passano com'e' sono", "colore",
    passoDaMostrare("colore", { ruolo: "guida", haEsito: false, haFoto: true }));

  //  ⚠️ Chi genera davvero: due generazioni per un gesto solo si pagano due
  //   volte, e la foto ce l'ha solo il telefono del cliente.
  c("genera il telefono del cliente", true, deveGenerare("ospite", true));
  c("non il consulente", false, deveGenerare("guida", true));
  c("e nemmeno il cliente senza foto", false, deveGenerare("ospite", false));
}

/** ── LA CAMERINA TONDA: STESSA MISURA DALLE DUE PARTI ─────────────────────
 *  ⚠️ Chiesto dal committente e non verificabile a occhio senza due
 *   dispositivi in mano: quello che il consulente vede nel suo specchio deve
 *   essere grande quanto il cerchio che il cliente ha davvero sul telefono.
 */

/** ── A CHI HO GIA' SCRITTO, OGGI ───────────────────────────────────────────
 *  ⚠️ Il segno deve cadere da solo: se cambia lo stato e' successo qualcosa e
 *   quel messaggio appartiene a una conversazione finita; se cambia il giorno,
 *   «gli ho scritto» diventa falso restando verde.
 */
function proveDeiGiaScritti() {
  const { segna, risulta, potaScritti } = SCR;
  gruppo("A CHI HO GIA' SCRITTO");

  const vuota = {};
  const dopo = segna(vuota, "lead1", "sta_valutando", "2026-09-15");
  c("segna la riga", true, risulta(dopo, "lead1", "sta_valutando", "2026-09-15"));
  c("non tocca la mappa di prima", false, risulta(vuota, "lead1", "sta_valutando", "2026-09-15"));
  c("le altre righe restano da fare", false, risulta(dopo, "lead2", "sta_valutando", "2026-09-15"));

  //  ⚠️ Cambiato stato, il segno cade: e' successo qualcosa — ha risposto, ha
  //   fissato, ha detto no — e la riga torna da lavorare.
  c("cambiando stato il segno cade", false, risulta(dopo, "lead1", "da_ricontattare", "2026-09-15"));
  //  ⚠️ Cambiato giorno, idem: «gli ho scritto» vuol dire oggi.
  c("cambiando giorno il segno cade", false, risulta(dopo, "lead1", "sta_valutando", "2026-09-16"));

  c("una riga senza id non si segna", 0, Object.keys(segna(vuota, "", "x", "2026-09-15")).length);
  c("e nemmeno senza giorno", 0, Object.keys(segna(vuota, "lead1", "x", "")).length);

  /*  ⚠️ La potatura non e' solo per la memoria: un segno di ieri tenuto da
      parte tornerebbe buono se lo stato tornasse indietro — «ha gia' ricevuto»
      non deve poter resuscitare. */
  const ieri = segna(dopo, "lead2", "richiamo", "2026-09-14");
  const potata = potaScritti(ieri, "2026-09-15");
  c("le righe di ieri si buttano", false, "lead2" in potata);
  c("quelle di oggi restano", true, "lead1" in potata);
}

/** ── L'INTERRUTTORE DEI LAVORI ─────────────────────────────────────────────
 *  ⚠️ Acceso su una riga si accende su tutte quelle dello stesso stato: e' il
 *   giro di telefonate, non la singola riga. Sbagliare il raggio vuol dire
 *   allegare un secondo link a una conferma d'appuntamento che ne ha gia' uno.
 */
function proveDellInterruttoreLavori() {
  const { commuta } = LVA;
  gruppo("L'INTERRUTTORE DEI LAVORI");

  const vuoto = new Set();
  const acceso = commuta(vuoto, "sta_valutando");
  c("si accende", true, acceso.has("sta_valutando"));
  c("e non tocca l'insieme di prima", false, vuoto.has("sta_valutando"));
  c("si rispegne", false, commuta(acceso, "sta_valutando").has("sta_valutando"));
  //  ⚠️ Gli stati sono giri diversi: chi e' «In valutazione» sta decidendo,
  //   chi ha «Appuntamento fissato» riceve una conferma che un link ce l'ha
  //   gia' — e due link nello stesso messaggio fanno aprire quello sbagliato.
  c("un altro stato resta spento", false, acceso.has("appuntamento_fissato"));
  const due = commuta(acceso, "appuntamento_fissato");
  c("due stati possono essere accesi insieme", 2, due.size);
  c("e spegnerne uno non tocca l'altro", true, commuta(due, "sta_valutando").has("appuntamento_fissato"));
  //  Uno stato vuoto sarebbe un interruttore per «tutte le schede senza
  //  stato», cioe' per righe che non c'entrano niente fra loro.
  c("uno stato vuoto non si accende", 0, commuta(vuoto, "").size);
  c("e nemmeno uno fatto di spazi", 0, commuta(vuoto, "   ").size);
}

/** ── IL MESSAGGIO PER CHI LA CONSULENZA L'HA GIA' FATTA ───────────────────
 *  ⚠️ Sono persone con cui abbiamo gia' passato un'ora, e poi e' passato del
 *   tempo. A loro non si spiega di nuovo che cos'e': si ricorda, si chiede
 *   come stanno, e si lascia qualcosa da guardare.
 */
function proveDeiLavori() {
  const { LINK_LAVORI, messaggioLavori, giornoEsteso } = LAV;
  gruppo("IL MESSAGGIO CON I NOSTRI LAVORI");

  /*  ── IL GIORNO DELLA CONSULENZA, DETTO COME LO DIREBBE UNA PERSONA ──── */
  const oggi = new Date("2026-09-15T12:00:00");
  c("il giorno si scrive per esteso", "venerdì 24 luglio", giornoEsteso("2026-07-24", oggi));
  //  ⚠️ L'anno si scrive solo se non e' questo: «giovedi' 24 luglio» detto a
  //   settembre si capisce, la stessa frase per una consulenza di due anni fa
  //   sarebbe una bugia involontaria — e sono proprio le schede vecchie quelle
  //   che questo messaggio va a riprendere.
  c("l'anno compare solo se e' un altro", true, /2024$/.test(giornoEsteso("2024-07-24", oggi)));
  c("e non compare per quest'anno", false, /2026/.test(giornoEsteso("2026-07-24", oggi)));
  c("una data storta non inventa un giorno", "", giornoEsteso("domani", oggi));
  c("e nemmeno una vuota", "", giornoEsteso("", oggi));

  const m = messaggioLavori("Mario", "2026-07-24");
  //  ⚠️ Prima la persona: a chi non sente da mesi si scrive per sapere come
  //   sta, non per mandargli materiale.
  c("apre col nome e chiede come sta", true, /^Ciao Mario, come stai\?/.test(m));
  //  ⚠️ `\w` non prende gli accenti: «venerdì» non passa, e la prova
  //   fallirebbe su un messaggio corretto.
  c("dice QUANDO e' stata la consulenza", true, /Abbiamo fatto la consulenza \S+ 24 luglio\./.test(m));
  //  Non si spiega da capo: «te li avevo gia' mostrati» e' quello che
  //  distingue un ricordo da una presentazione.
  c("ricorda che i lavori li aveva gia' visti", true, /te li avevo già mostrati/.test(m));
  c("dice cosa NON e'", true, /non è un patch/.test(m));
  c("e cosa e'", true, /Invisible Derm Protocol/.test(m));
  c("il link sta su una riga sua", true, /\n\S*F7MJ-A9WH-HVAW\n/.test(m));

  /*  ── ⚠️ LA DOMANDA STA IN FONDO ──────────────────────────────────────
      E' la sola riga che chiede una risposta: messa prima del link verrebbe
      letta mentre il pollice sta gia' andando sul link. */
  c("chiude chiedendo cosa ha deciso", true, /Hai deciso qualcosa\?/.test(m));
  //  ⚠️ La chiusura CHIEDE invece di aspettare: senza «fammi sapere» un
  //   messaggio gentile si chiude da solo e la risposta resta facoltativa.
  c("e chiede esplicitamente una risposta", true, /fammi sapere\.$/.test(m.trimEnd()));
  c("rinomina il telefono in chiusura", true, /al telefono/.test(m));
  c("la domanda viene dopo il link", true, m.indexOf("Hai deciso") > m.indexOf(LINK_LAVORI));
  /*  ⚠️ L'offerta di rispiegare sta attaccata alla frase delle differenze, e
      non in fondo: e' li' che nasce il dubbio («patch, protesi, evoluzione: e
      quindi?»), e un aiuto offerto tre righe dopo arriva quando la persona ha
      gia' smesso di chiederselo. */
  c("offre di rispiegare", true, /possiamo sentirci: te le rispiego/.test(m));
  c("e lo offre prima del link", true, m.indexOf("rispiego") < m.indexOf(LINK_LAVORI));
  //  «Rispiego», non «spiego»: gliel'abbiamo gia' raccontato di persona.
  c("parla di RIspiegare, non di spiegare da capo", false, /te le spiego/.test(m));

  //  Senza data la frase resta sensata: «abbiamo fatto la consulenza» senza
  //  dire quando, a distanza di mesi, fa chiedere «quale?».
  const senzaData = messaggioLavori("Mario", "");
  c("senza data non lascia la frase a meta'", true, /È passato un po' dalla nostra consulenza\./.test(senzaData));
  c("senza data non scrive «undefined»", false, /undefined|NaN/.test(senzaData));
  //  Senza nome: capita con le schede importate, e «Ciao ,» e' peggio di
  //  nessun nome.
  c("senza nome non lascia una virgola sospesa", true, /^Ciao, come stai\?/.test(messaggioLavori("")));
  c("si puo' passare un altro indirizzo", true,
    messaggioLavori("Mario", "2026-07-24", "https://x.it/a").includes("https://x.it/a"));

  /*  ── ⚠️ LA VERSIONE SENZA LAVORI NON E' UN MESSAGGIO DIMEZZATO ────────
      E' lo stesso messaggio a cui manca un paragrafo: saluto, il giorno in cui
      ci siamo visti, l'offerta di risentirsi, la domanda. Scritti come due
      testi separati sarebbero divergiti al primo ritocco, e la stessa persona
      a distanza di giorni avrebbe letto due voci diverse dello stesso centro. */
  const { messaggioRipresa } = LAV;
  const senza = messaggioRipresa("Mario", "2026-07-24", false);
  c("senza lavori non c'e' il link", false, senza.includes(LINK_LAVORI));
  c("ma resta la data", true, /24 luglio/.test(senza));
  c("resta il saluto", true, /^Ciao Mario, come stai\?/.test(senza));
  c("resta l'offerta di rispiegare", true, /te le rispiego volentieri/.test(senza));
  c("resta la domanda finale", true, /Hai deciso qualcosa\?/.test(senza));
  c("e chiede comunque una risposta", true, /fammi sapere\.$/.test(senza.trimEnd()));
  //  ⚠️ Il nome del sistema va detto anche senza le fotografie: la frase «se
  //   non ricordi le differenze» senza di lui resterebbe appesa a niente.
  c("nomina comunque il protocollo", true, /Invisible Derm Protocol/.test(senza));
  c("non promette lavori che non manda", false, /Ti lascio qualche nostro lavoro/.test(senza));
  //  Le due versioni restano lo stesso messaggio: stessa apertura, stessa
  //  chiusura.
  const con = messaggioRipresa("Mario", "2026-07-24", true);
  c("le due versioni aprono uguale", con.split("\n")[0], senza.split("\n")[0]);
  c("e chiudono uguale", con.trimEnd().split("\n").pop(), senza.trimEnd().split("\n").pop());
}

/** ── LE COSE DA FARE CHE OCCUPANO L'AGENDA ─────────────────────────────────
 *  ⚠️ Un blocco scritto dove non doveva chiude un'ora che nessuno voleva
 *   chiudere — e nessuno sa piu' perche' quel martedi' alle 15 non si prenota.
 *   Uno NON scritto lascia il calendario aperto su un'ora gia' occupata.
 */
function proveDellAgendaDeiTask() {
  const { bloccoDaTask, fineOrario, minutiDi, DURATA_PREDEFINITA } = AGT;
  gruppo("LE COSE DA FARE CHE OCCUPANO L'AGENDA");

  c("un orario si legge in minuti", 570, minutiDi("09:30"));
  c("un orario storto non e' mezzanotte", null, minutiDi("banana"));
  c("un'ora impossibile non passa", null, minutiDi("25:00"));
  c("la fine si calcola", "16:00", fineOrario("15:00", 60));
  //  ⚠️ Un blocco che finisce alle 25:30 non lo capisce ne' il calcolo degli
  //   slot ne' chi lo legge: una posa alle 23:30 finisce a mezzanotte.
  c("la fine resta dentro la giornata", "00:00", fineOrario("23:30", 120));

  const base = {
    id: "t1", testo: "Posa da Rossi", data: "2026-09-15",
    ora: "15:00", durata: 60, occupaAgenda: true, aId: "c1",
  };
  const b = bloccoDaTask(base);
  c("si scrive un blocco", true, !!b);
  c("sul consulente giusto", "c1", b.consulenteId);
  c("nel giorno giusto", "2026-09-15", b.data);
  c("dall'ora all'ora", "15:00", b.inizio);
  c("fino alla fine", "16:00", b.fine);
  c("acceso", true, b.attivo);
  c("e il motivo dice da dove viene", true, /Da fare: Posa da Rossi/.test(b.motivo));
  //  ⚠️ L'id lega le due cose: cancellando la riga si toglie anche il blocco,
  //   se no il calendario resta chiuso per una cosa che non esiste piu'.
  c("l'id lega il blocco alla riga", "task-t1", b.id);

  c("senza spunta non si blocca niente", null, bloccoDaTask({ ...base, occupaAgenda: false }));
  //  «In giornata» non e' un pezzo di agenda: non si sa QUALE ora togliere.
  c("senza ora non si blocca niente", null, bloccoDaTask({ ...base, ora: "" }));
  //  ⚠️ In crm/blocchi un blocco SENZA consulente vale per tutti: una cosa da
  //   fare di nessuno chiuderebbe l'agenda dell'intero centro.
  c("senza assegnatario non si blocca niente", null, bloccoDaTask({ ...base, aId: "" }));
  c("con una data storta non si blocca niente", null, bloccoDaTask({ ...base, data: "domani" }));
  const senzaDurata = bloccoDaTask({ ...base, durata: 0 });
  c("senza durata vale un'ora", "16:00", senzaDurata.fine);
  c("e l'ora predefinita e' sessanta minuti", 60, DURATA_PREDEFINITA);
  //  Una durata che sfora la mezzanotte non deve produrre un blocco al
  //  contrario (fine <= inizio), che toglierebbe l'intera giornata o niente.
  c("a mezzanotte non nasce un blocco rovesciato", null,
    bloccoDaTask({ ...base, ora: "23:59", durata: 120 }));
}

/** ── L'ESEMPIO DI CAPELLI VERI ─────────────────────────────────────────────
 *  ⚠️ DIFETTO VISTO CON GLI OCCHI: i tagli composti uscivano come parrucche,
 *   quelli del catalogo no — e la differenza non e' il testo, e' che loro
 *   hanno accanto una fotografia vera. Qui si sceglie quale allegare, e una
 *   fotografia sbagliata e' peggio di nessuna fotografia.
 */
function proveDellaSomiglianza() {
  const { caratteristicheDi, somiglianza, taglioPiuVicino } = SOM;
  gruppo("L'ESEMPIO DI CAPELLI VERI");

  /*  ── LE CARATTERISTICHE SI LEGGONO DALLE SCHEDE ─────────────────────── */
  const k = caratteristicheDi(
    "High fade on the sides and back, blending into approximately 10cm of wavy hair on top, "
    + "styled back with significant volume; no defined parting or fringe.",
  );
  c("i centimetri dicono la lunghezza", "medio", k.lunghezza);
  c("l'onda si riconosce", "mosso", k.texture);
  c("la direzione si riconosce", "indietro", k.direzione);
  //  ⚠️ «no defined parting or fringe» CONTIENE la parola fringe: cercarla e
  //   basta faceva risultare un ciuffo dove la scheda dice che non c'e'.
  c("il ciuffo negato non conta come ciuffo", false, k.ciuffo);
  c("la sfumatura si riconosce", true, k.sfumatura);

  //  ⚠️ «medium taper» e «medium-length top» sono la stessa parola per due
  //   cose diverse: senza i centimetri, un taglio con i lati sfumati medi
  //   passava per un taglio medio.
  const corto = caratteristicheDi(
    "A medium taper on the sides blending into approximately 4cm on top, straight, styled forward "
    + "with a short fringe.",
  );
  c("i centimetri vincono sulle parole", "corto", corto.lunghezza);
  c("il ciuffo dichiarato conta", true, corto.ciuffo);
  c("il liscio si riconosce", "liscio", corto.texture);
  c("in avanti si riconosce", "avanti", corto.direzione);

  /*  ── IL PUNTEGGIO ───────────────────────────────────────────────────── */
  const composto = { lunghezza: "medio", texture: "mosso", ciuffo: "corto", direzione: "indietro" };
  c("stessa lunghezza e stessa texture pesano di piu'", true, somiglianza(composto, k) >= 6);
  c("un taglio diverso vale meno", true, somiglianza(composto, corto) < somiglianza(composto, k));

  /*  ── LA SCELTA ──────────────────────────────────────────────────────── */
  const scelto = taglioPiuVicino(composto);
  c("si sceglie un taglio vero del catalogo", true,
    PC.TAGLI.some((t) => t.chiave === scelto));
  //  ⚠️ La scelta dev'essere STABILE: la stessa composizione deve dare sempre
  //   lo stesso esempio, se no due prove uguali escono diverse e non si
  //   capisce perche'.
  c("e la scelta non cambia a parita' di composizione", scelto, taglioPiuVicino(composto));
  c("un composto a meta' non sceglie niente", "", taglioPiuVicino({ lunghezza: "medio" }));
  c("niente non sceglie niente", "", taglioPiuVicino(null));

  //  Il riccio deve tirare un riccio: e' la caratteristica che si vede da
  //  lontano e che rende credibile l'esempio.
  const riccio = taglioPiuVicino({ lunghezza: "medio", texture: "riccio" });
  c("al riccio si allega un taglio riccio", "riccio",
    caratteristicheDi(PC.TAGLI.find((t) => t.chiave === riccio).inglese).texture);
  /*  ── ⚠️ DIFETTO VISTO PROVANDO: A «CORTO» VENIVA ALLEGATA UNA CHIOMA ──
      Texture e direzione insieme pesavano piu' della lunghezza, e a «corto,
      liscio, all'indietro» toccava la fotografia di capelli lunghi pettinati
      indietro. La lunghezza e' la prima cosa che si vede: una vicina vale
      poco, una lontana costa. */
  const cortoLiscio = taglioPiuVicino({ lunghezza: "corto", texture: "liscio", direzione: "indietro" });
  c("a un taglio corto non si allega una chioma lunga", true,
    ["corto", "medio"].includes(caratteristicheDi(PC.TAGLI.find((t) => t.chiave === cortoLiscio).inglese).lunghezza));
  //  ⚠️ E «naturale» non e' una direzione: e' quello che resta quando la
  //   scheda non ne nomina nessuna. Contandola come somiglianza vinceva un
  //   taglio di media lunghezza su uno della lunghezza giusta.
  const lungoRiccio = taglioPiuVicino({ lunghezza: "lungo", texture: "riccio", direzione: "naturale" });
  c("a un taglio lungo si allega un taglio lungo", "lungo",
    caratteristicheDi(PC.TAGLI.find((t) => t.chiave === lungoRiccio).inglese).lunghezza);

  const lungo = taglioPiuVicino({ lunghezza: "molto_lungo", texture: "liscio" });
  c("al molto lungo si allega un taglio lungo", "lungo",
    caratteristicheDi(PC.TAGLI.find((t) => t.chiave === lungo).inglese).lunghezza);

  /*  ── DENTRO IL TESTO: L'ESEMPIO NON E' IL TAGLIO ─────────────────────── */
  const testo = PC.costruisciPrompt({
    taglio: "", esempioReale: true,
    composto: { lunghezza: "medio", texture: "mosso" }, colore: "castano_medio",
  });
  c("l'esempio si dichiara come immagine 2", true, /IMAGE 2 is NOT the haircut to reproduce/.test(testo));
  c("e si dice che il testo vince", true, /THE WORDS WIN/.test(testo));
  c("la proporzione entra nel controllo finale", true, /without making the head bigger/i.test(testo));
  //  ⚠️ Con una fotografia di taglio vera l'esempio NON deve comparire: due
  //   fotografie di taglio insieme sono due ordini, e il modello ne sceglie una.
  const conFoto = PC.costruisciPrompt({
    taglio: "", taglioDaFoto: true, esempioReale: true,
    descrizioneTaglio: "a short fade", colore: "castano_medio",
  });
  c("con una foto vera del taglio l'esempio tace", false, /NOT the haircut to reproduce/.test(conFoto));
}

/** ── I LATERALI SCELTI A PARTE ─────────────────────────────────────────────
 *  ⚠️ Il difetto che queste prove tengono chiuso: la scelta della persona
 *   deve SCAVALCARE le parole del taglio. Su un taglio che si chiama «sfumato
 *   alto», chi sceglie «sfumatura bassa» deve ottenere una sfumatura bassa —
 *   e di due frasi che si contraddicono un modello ne inventa una terza.
 */
function proveDeiLaterali() {
  const { LATERALI, LATERALI_COME_IL_TAGLIO, lateraliPer, rigaLaterali, trovaLaterale } = LAT;
  gruppo("I LATERALI");

  c("il predefinito e' il primo della lista", LATERALI_COME_IL_TAGLIO, LATERALI[0].chiave);
  c("«come il taglio» non dice niente al modello", "", rigaLaterali(LATERALI_COME_IL_TAGLIO));
  c("una chiave inventata non dice niente", "", rigaLaterali("sfumatura_a_zigzag"));
  c("le chiavi sono tutte diverse", LATERALI.length, new Set(LATERALI.map((l) => l.chiave)).size);

  /*  ⚠️ La riga deve DICHIARARE che scavalca: senza, il modello legge prima la
      descrizione del taglio e tiene quella. */
  const bassa = rigaLaterali("sfumatura_bassa");
  c("la riga dichiara che scavalca il taglio", true, /OVERRIDES/.test(bassa));
  c("e nomina la sfumatura bassa", true, /LOW taper fade/.test(bassa));

  /*  ── «FINO ALLA PELLE» E' L'INTENSITA', NON IL PUNTO ───────────────── */
  c("la pelle si aggiunge alla sfumatura", true, /BARE SKIN/.test(rigaLaterali("sfumatura_alta", true)));
  c("senza pelle si dice che la pelle non si vede", true,
    /not shave down to bare skin/.test(rigaLaterali("sfumatura_alta", false)));
  //  ⚠️ Su chi non ha sfumatura «fino alla pelle» non vuol dire niente, e
  //   scriverlo lo stesso sarebbe un ordine che contraddice il taglio scelto.
  c("sui laterali a forbice la pelle non compare", false, /BARE SKIN/.test(rigaLaterali("forbice", true)));
  c("e nemmeno la riga della pelle al contrario", false, /bare skin/.test(rigaLaterali("forbice", false)));

  /*  ── COERENTI CON LA FAMIGLIA ───────────────────────────────────────── */
  const suLungo = lateraliPer("lunghi").map((l) => l.chiave);
  c("sui lunghi niente sfumatura alta", false, suLungo.includes("sfumatura_alta"));
  c("sui lunghi niente lati corti uniformi", false, suLungo.includes("corti_uniformi"));
  c("sui lunghi restano i lunghi dietro le orecchie", true, suLungo.includes("lunghi_dietro"));
  c("sugli sfumati c'e' la sfumatura alta", true, lateraliPer("sfumati").map((l) => l.chiave).includes("sfumatura_alta"));
  for (const f of ["sfumati", "classici", "mossi", "ricci", "lunghi"]) {
    c(`«${f}» ha almeno quattro laterali`, true, lateraliPer(f).length >= 4);
    c(`«${f}» tiene il predefinito`, true, lateraliPer(f).some((l) => l.chiave === LATERALI_COME_IL_TAGLIO));
  }
  //  Senza famiglia — una foto caricata, un taglio composto — si offrono i
  //  larghi: nel dubbio il meno specifico, mai il piu' rischioso.
  c("senza famiglia si offre comunque una scelta vera", true, lateraliPer("").length >= 6);
  c("solo le sfumature accettano la pelle", true,
    LATERALI.filter((l) => l.sfumatura).every((l) => /fade/i.test(l.inglese)));
  c("trovaLaterale trova per chiave", "Sfumatura bassa", trovaLaterale("sfumatura_bassa").nome);
}

/** ── IL TAGLIO COMPOSTO ────────────────────────────────────────────────────
 *  ⚠️ Il difetto che queste prove tengono chiuso: un composto a meta'. Senza
 *   lunghezza e capello non c'e' un taglio — c'e' un elenco di dettagli
 *   attorno al niente — e il buco il modello lo riempie con i capelli che la
 *   persona ha gia', che e' il difetto per cui la pagina esiste.
 */
function proveDelComposto() {
  const { GRUPPI, compostoPieno, descrizioneComposta, nomeComposto, trovaVoce } = CMP;
  gruppo("IL TAGLIO SU MISURA");

  c("i gruppi sono quattro", 4, GRUPPI.length);
  c("le chiavi dei gruppi sono tutte diverse", 4, new Set(GRUPPI.map((g) => g.chiave)).size);
  for (const g of GRUPPI) {
    c(`«${g.chiave}» ha almeno tre voci`, true, g.voci.length >= 3);
    c(`«${g.chiave}» ha voci tutte diverse`, g.voci.length, new Set(g.voci.map((v) => v.chiave)).size);
    //  ⚠️ Ogni voce porta la sua misura: «medio» da solo, per un modello, non
    //   vuol dire niente — e «corto» e «medio» tornerebbero identici.
    c(`«${g.chiave}» ha tutte le istruzioni scritte`, true, g.voci.every((v) => v.inglese.trim().length > 12));
  }

  const meta = { lunghezza: "medio" };
  const pieno = { lunghezza: "medio", texture: "mosso", ciuffo: "corto", direzione: "avanti" };
  c("mezzo composto non basta", false, compostoPieno(meta));
  c("niente non basta", false, compostoPieno(null));
  c("lunghezza e capello bastano", true, compostoPieno({ lunghezza: "corto", texture: "liscio" }));
  c("un composto a meta' non produce descrizione", "", descrizioneComposta(meta));
  //  ⚠️ Una voce inventata non deve passare per buona: qui dentro finisce una
  //   riga scritta a un modello.
  c("una lunghezza inventata non vale", false, compostoPieno({ lunghezza: "gigante", texture: "liscio" }));

  const d = descrizioneComposta(pieno);
  c("la descrizione nomina i centimetri", true, /7-8cm/.test(d));
  c("la descrizione nomina il capello", true, /WAVY/.test(d));
  /*  ── ⚠️ IL DIFETTO DEI TAGLI BRUTTI ────────────────────────────────────
      Un elenco di misure produce un casco di capelli della lunghezza giusta e
      senza mestiere dentro. La descrizione deve chiedere un taglio VERO, e
      deve vietare per nome le due forme sbagliate che uscivano. */
  c("chiede un taglio fatto da un barbiere", true, /professional barber/.test(d));
  c("vieta la parrucca e il casco", true, /never a wig/.test(d) && /bowl/.test(d));
  c("la descrizione nomina il ciuffo", true, /SHORT fringe/.test(d));
  c("la descrizione nomina la direzione", true, /FORWARD/.test(d));
  //  Le voci non scelte non devono comparire: sarebbero un taglio diverso.
  c("non nomina quello che non e' stato scelto", false, /BACKWARD/.test(d));

  c("il nome si legge in italiano", "Medio mosso, ciuffo corto, in avanti", nomeComposto(pieno));
  c("senza ciuffo il nome non lo nomina", "Corto liscio, all'indietro",
    nomeComposto({ lunghezza: "corto", texture: "liscio", ciuffo: "senza", direzione: "indietro" }));
  c("a meta' il nome resta generico", "Taglio su misura", nomeComposto(meta));
  c("trovaVoce trova la voce", "Medio", trovaVoce("lunghezza", "medio").nome);
  c("trovaVoce non inventa", undefined, trovaVoce("lunghezza", "gigantesco"));

  /*  ── ⚠️ DENTRO IL TESTO VERO ───────────────────────────────────────────
      Le prove qui sopra guardano i pezzi; queste guardano il testo che parte
      davvero. E' li' che il difetto costa: una generazione pagata per un
      taglio che nessuno ha chiesto. */
  /*  ── ⚠️ I LATERALI PREDEFINITI: E' QUI CHE NASCEVA IL CASCO ───────────
      Un composto non nomina nessuna sfumatura; senza un predefinito, la regola
      generale vietava di accorciare i lati e usciva un sopra corto con i lati
      lunghi uguali. */
  const { lateraliPredefiniti, famigliaDelComposto, vociPer, ripulisci } = CMP;
  const corti = lateraliPredefiniti({ lunghezza: "corto", texture: "liscio" });
  c("sul corto i lati si accorciano", true, /SHORTER than the top/.test(corti));
  c("e il casco e' vietato per nome", true, /one round bowl/.test(corti));
  c("sul molto lungo i lati restano lunghi", true,
    /left LONG to match the top/.test(lateraliPredefiniti({ lunghezza: "molto_lungo", texture: "mosso" })));
  c("e li' niente macchinetta", true,
    /No fade, no clipper work/.test(lateraliPredefiniti({ lunghezza: "lungo", texture: "mosso" })));

  /*  ── COERENZA FRA I GRUPPI ──────────────────────────────────────────────
      Un ciuffo non puo' essere piu' lungo dei capelli. */
  const ciuffiSuCorto = vociPer("ciuffo", { lunghezza: "corto" }).map((v) => v.chiave);
  c("sul corto niente ciuffo fino alle sopracciglia", false, ciuffiSuCorto.includes("lungo"));
  c("sul corto niente ciuffo medio", false, ciuffiSuCorto.includes("medio"));
  c("sul lungo il ciuffo lungo c'e'", true,
    vociPer("ciuffo", { lunghezza: "lungo" }).map((v) => v.chiave).includes("lungo"));
  c("sulle spalle niente ciuffo alzato", false,
    vociPer("direzione", { lunghezza: "molto_lungo" }).map((v) => v.chiave).includes("alzato"));
  //  ⚠️ E la scelta diventata impossibile si toglie, non resta spuntata dove
  //   non si vede piu'.
  c("cambiando lunghezza il ciuffo impossibile sparisce", undefined,
    ripulisci({ lunghezza: "corto", texture: "liscio", ciuffo: "lungo" }).ciuffo);
  c("ma quello possibile resta", "corto",
    ripulisci({ lunghezza: "corto", texture: "liscio", ciuffo: "corto" }).ciuffo);
  c("la famiglia la decide la lunghezza", "lunghi", famigliaDelComposto({ lunghezza: "molto_lungo" }));
  c("e sul corto sono gli sfumati", "sfumati", famigliaDelComposto({ lunghezza: "corto" }));

  const { costruisciPrompt } = PC;
  const conComposto = costruisciPrompt({ taglio: "", composto: pieno, colore: "castano_medio" });
  c("il composto da' un testo anche senza taglio dell'elenco", true, conComposto.length > 200);
  c("e il taglio nel testo e' quello composto", true, /custom men's haircut/.test(conComposto));
  //  ⚠️ Senza scelta esplicita dei laterali, nel testo ci deve essere comunque
  //   il predefinito: e' la riga che impedisce il casco.
  c("i laterali predefiniti entrano nel testo", true, /SHORTER than the top/.test(conComposto));
  c("e la vecchia regola generale non parla", false, /This haircut is NOT a fade/.test(conComposto));
  c("un composto a meta' non produce nessun testo", "",
    costruisciPrompt({ taglio: "", composto: meta, colore: "castano_medio" }));

  /*  ⚠️ IL DIFETTO PRINCIPALE: la scelta dei laterali deve vincere sulle
      parole del taglio. «Sfumato con ciuffo» e' descritto come high fade; chi
      chiede la sfumatura bassa deve trovarsela nel testo, e non deve trovarci
      la riga che vieta di sfumare. */
  const conLati = costruisciPrompt({
    taglio: "sfumato_mosso", laterali: "sfumatura_bassa", colore: "castano_medio",
  });
  c("i laterali scelti entrano nel testo", true, /LOW taper fade/.test(conLati));
  c("e dichiarano di scavalcare il taglio", true, /OVERRIDES whatever the haircut description/.test(conLati));
  c("la vecchia deduzione non parla piu'", false, /This haircut IS faded\/tapered/.test(conLati));

  //  Senza scelta, la deduzione dalle parole del taglio resta com'era: e' il
  //  comportamento di prima, e non deve essere cambiato di straforo.
  const senzaLati = costruisciPrompt({ taglio: "sfumato_mosso", colore: "castano_medio" });
  c("senza scelta il taglio decide ancora", true, /This haircut IS faded\/tapered/.test(senzaLati));
  //  ⚠️ E su un taglio NON sfumato, senza scelta, resta il divieto: e' la riga
  //   che impedisce al modello di rasare i lati di sua iniziativa.
  const lungo = costruisciPrompt({ taglio: "lungo_mosso_di_lato", colore: "castano_medio" });
  c("su un taglio non sfumato resta il divieto", true, /This haircut is NOT a fade/.test(lungo));
}

/** ── I RITOCCHI AL TAGLIO ──────────────────────────────────────────────────
 *  ⚠️ Il pericolo di questa funzione e' che il modello, ricevuto un elenco di
 *   aggiustamenti, si senta autorizzato a reinventare il taglio — e la persona
 *   si ritrovi qualcosa che col riquadro che ha toccato non c'entra piu'.
 */
function proveDeiRitocchi() {
  const { RITOCCHI, righeRitocchi, controlloRitocchi, notaPulita, NOTA_MASSIMA } = RTC;
  gruppo("I RITOCCHI AL TAGLIO");

  const { ritocchiPer } = RTC;
  c("sono sette in tutto", 7, RITOCCHI.length);

  /*  ── ⚠️ COERENTI COL TAGLIO ───────────────────────────────────────────
      Offrire un'opzione impossibile e' peggio che non offrirla: la persona la
      spunta, il risultato non cambia, e da fuori sembra che il programma
      ignori quello che le si chiede. */
  const suRasato = ritocchiPer("sfumati").map((r) => r.chiave);
  const suLungo = ritocchiPer("lunghi").map((r) => r.chiave);
  const suRiccio = ritocchiPer("ricci").map((r) => r.chiave);
  c("sui lunghi non si offre «piu' corto ai lati»", false, suLungo.includes("lati_corti"));
  c("sui ricci non si offre la riga di lato", false, suRiccio.includes("riga_laterale"));
  c("il riccio definito si offre solo dove un riccio c'e'", false, ritocchiPer("classici").includes("riccio_definito"));
  c("e sui ricci si'", true, suRiccio.includes("riccio_definito"));
  c("il ciuffo alto vuole capelli sopra da alzare", false, suLungo.includes("ciuffo_alto"));
  c("sugli sfumati si'", true, suRasato.includes("ciuffo_alto"));
  //  ⚠️ Nessuna famiglia resta senza scelte: un popup con zero opzioni e' un
  //   popup che non doveva aprirsi.
  for (const f of ["sfumati", "classici", "mossi", "ricci", "lunghi"]) {
    c(`«${f}» ha almeno tre ritocchi`, true, ritocchiPer(f).length >= 3);
  }
  //  Senza famiglia — un taglio aggiunto a mano — si offre solo quello che
  //  vale per tutti: nel dubbio il meno specifico, mai il piu' rischioso.
  //  ⚠️ Senza famiglia — una foto caricata dalla persona — si offrono i
  //   ritocchi LARGHI: restare ai soli universali lasciava due voci in croce,
  //   cioe' un popup che non serve a niente. Fuori restano i due specifici.
  c("senza famiglia si offre comunque una scelta vera", true, ritocchiPer("").length >= 5);
  c("ma niente riccio da definire su un taglio sconosciuto", false,
    ritocchiPer("").some((r) => r.chiave === "riccio_definito"));
  c("ne' il ciuffo da alzare", false, ritocchiPer("").some((r) => r.chiave === "ciuffo_alto"));
  c("ognuno ha una chiave sua", RITOCCHI.length, new Set(RITOCCHI.map((r) => r.chiave)).size);
  //  ⚠️ Ogni ritocco deve dire cosa NON cambia: e' quello che impedisce al
  //   modello di rifare il taglio da capo.
  for (const r of RITOCCHI) {
    c(`«${r.nome}» dice anche cosa resta`, true, /keep|without changing|same |only tidier|change nothing/.test(r.inglese));
  }

  c("senza scelte non si dice niente", 0, righeRitocchi([], "").length);
  c("ne' col nulla al posto dell'elenco", 0, righeRitocchi(null, undefined).length);

  const due = righeRitocchi(["lati_corti", "sopra_lungo"], "").join("\n");
  c("il taglio scelto resta il punto di partenza", true, /STARTING POINT and it stays/.test(due));
  c("i due ritocchi ci sono tutti e due", true, /shorter and cleaner/.test(due) && /more length and more volume ON TOP/.test(due));
  //  ⚠️ La riga finale e' quella che tiene insieme tutto: senza, un elenco di
  //   modifiche e' indistinguibile da un elenco di istruzioni per un taglio
  //   nuovo.
  c("e si ripete che non e' un taglio nuovo", true, /NOT a new hairstyle/.test(due));
  c("chiavi inventate si ignorano", true, !/undefined/.test(righeRitocchi(["non_esiste"], "x").join(" ")));

  //  ── LA NOTA SCRITTA A MANO ──────────────────────────────────────────
  const conNota = righeRitocchi([], "un po' piu' corto sulla nuca").join("\n");
  c("la nota compare fra virgolette", true, /in their own words: "un po' piu' corto sulla nuca"/.test(conNota));
  //  ⚠️ E' dichiarata come RICHIESTA DELLA PERSONA, non come istruzione: una
  //   frase scritta di getto, mescolata alle regole, peserebbe come una regola.
  c("ed e' dichiarata come richiesta della persona", true, /the person also asked/.test(conNota));
  //  ⚠️ La difesa: una nota che chiede un altro taglio o tocca il viso va
  //   ignorata, altrimenti questa riga diventa la porta da cui passa tutto.
  c("una nota fuori tema si ignora", true, /ignore it if it asks for a different haircut/.test(conNota));

  c("gli a capo spariscono", "a b", notaPulita("a\n\n  b"));
  c("e la nota ha un tetto", NOTA_MASSIMA, notaPulita("x".repeat(500)).length);
  c("niente nota, niente righe", 0, righeRitocchi([], "   ").length);

  //  Il controllo finale c'e' solo quando c'e' qualcosa da controllare.
  c("il controllo finale segue i ritocchi", 1, controlloRitocchi(["lati_corti"], "").length);
  c("senza ritocchi non c'e'", 0, controlloRitocchi([], "").length);
  c("e chiede tutte e due le cose", true,
    /clearly visible/.test(controlloRitocchi([], "nota").join("")) 
    && /still read as the one you were asked/.test(controlloRitocchi([], "nota").join("")));
}

function proveDellaCamerina() {
  const { pipLarghezzaDefault, pipLimiti, misuraDaFrazione, frazioneDaMisura } = PIP;
  gruppo("LA CAMERINA TONDA");

  const telefono = { w: 390, h: 844 };
  const monitor = { w: 1440, h: 900 };

  c("sul telefono parte dal 30% del lato corto", 117, pipLarghezzaDefault(telefono));
  c("sul monitor il 22% della larghezza", 317, pipLarghezzaDefault(monitor));

  //  ⚠️ IL PUNTO DI TUTTO: la misura scelta da una parte torna IDENTICA
  //   dall'altra, perche' il metro e' lo stesso — il dispositivo del cliente.
  for (const punti of [96, 110, 150, 200]) {
    const f = frazioneDaMisura(punti, telefono);
    c(`${punti} punti sul telefono restano ${punti} nello specchio`, punti, misuraDaFrazione(f, telefono));
  }

  //  ⚠️ E il difetto che questo impedisce: col monitor come metro, gli stessi
  //   110 punti diventavano un cerchio da centinaia di punti.
  c("misurando sul monitor verrebbe tutt'altra cosa", true,
    misuraDaFrazione(frazioneDaMisura(110, telefono), monitor) > 200);

  c("sul telefono il tetto e' il 60% della larghezza", 234, pipLimiti(telefono).max);
  c("e il minimo non scende mai sotto 80", 80, pipLimiti(telefono).min);
  c("una frazione enorme resta dentro il tetto", 234, misuraDaFrazione(9, telefono));
  c("una frazione nulla resta sopra il minimo", 80, misuraDaFrazione(0.0001, telefono));
  c("e un valore non numerico non rompe niente", 80, misuraDaFrazione(NaN, telefono));

  /*  ── ⚠️ «ALLARGO IO E SI ALLARGA ANCHE A LUI» ──────────────────────────
      Segnalazione del committente: cambiando la misura della camerina, sul
      dispositivo del cliente non rispondeva. Il giro completo è questo: il
      consulente misura sul METRO del cliente, manda la frazione, il cliente
      la riconverte sulla PROPRIA finestra. Se i due metri coincidono — ed è
      il caso normale, perché il metro È lo schermo del cliente — il numero
      deve tornare identico, e ogni passo diverso deve restare diverso. */
  const giro = (punti, metroConsulente, finestraCliente) =>
    misuraDaFrazione(frazioneDaMisura(punti, metroConsulente), finestraCliente);
  for (const punti of [80, 117, 187, 234]) {
    c(`il cliente riceve gli stessi ${punti} punti`, punti, giro(punti, telefono, telefono));
  }
  //  ⚠️ E passi diversi devono restare diversi: se il giro li schiacciasse
  //   tutti sullo stesso numero, di là sembrerebbe che non risponde.
  const arrivati = [80, 117, 187].map((n) => giro(n, telefono, telefono));
  c("tre misure restano tre misure", 3, new Set(arrivati).size);

  //  Cliente su un monitor, consulente che misura su un telefono presunto:
  //  il cerchio cresce in proporzione, ma resta dentro il tetto di là.
  const suMonitor = [80, 117, 187].map((n) => giro(n, telefono, monitor));
  c("anche su un monitor le misure restano distinte", 3, new Set(suMonitor).size);
  c("e nessuna sfonda il tetto del monitor", true, suMonitor.every((n) => n <= pipLimiti(monitor).max));
}

function proveDeiCodici() {
  const { nuovoCodice, normalizza, leggibile, formaValida, puoProvare, PROVE_COMPRESE } = CD;

  //  ⚠️ NIENTE CARATTERI CHE SI CONFONDONO. Un codice si detta al telefono e
  //   si ricopia da una foto di uno schermo: O contro 0 e I contro 1 sono un
  //   cliente che scrive «non funziona» e aspetta.
  let tutti = "";
  for (let i = 0; i < 200; i += 1) tutti += nuovoCodice();
  for (const brutto of ["O", "I", "S", "Z", "B"]) {
    c(`nessuna «${brutto}» nei codici generati`, false, tutti.includes(brutto));
  }
  const uno = nuovoCodice();
  c("otto caratteri piu' il trattino", 9, uno.length);
  c("il trattino sta in mezzo", "-", uno[4]);
  c("un codice appena fatto e' valido", true, formaValida(uno));

  //  ⚠️ Chi lo copia da WhatsApp si porta dietro spazi, minuscole e a volte
  //   perde il trattino. Tutte e tre le volte deve entrare.
  c("minuscolo", "ACDE1234", normalizza("acde1234"));
  c("con gli spazi", "ACDE1234", normalizza(" acde 1234 "));
  c("senza trattino", "ACDE1234", normalizza("acde1234"));
  c("col trattino", "ACDE1234", normalizza("ACDE-1234"));
  //  E gli scambi tipici si CORREGGONO invece di far fallire: quei caratteri
  //  nei nostri codici non esistono, quindi chi li scrive sta sbagliando a
  //  ricopiare — non sta inventando un altro codice.
  c("O diventa zero", "ACDE0123", normalizza("ACDEO123"));
  c("I diventa uno", "ACDE1234", normalizza("ACDEI234"));
  c("S diventa cinque", "ACDE5234", normalizza("ACDES234"));
  c("si rilegge a gruppi di quattro", "ACDE-1234", leggibile("acde1234"));
  c("troppo corto non e' valido", false, formaValida("ACDE"));
  c("vuoto non e' valido", false, formaValida(""));
  c("niente al posto del codice: non esplode", false, formaValida(null));

  //  ── QUANTE PROVE RESTANO ────────────────────────────────────────────
  c("tre comprese", 3, PROVE_COMPRESE);
  c("nuovo di zecca: puo'", true, puoProvare({ totali: 3, usate: 0 }).ok);
  c("nuovo di zecca: tre restano", 3, puoProvare({ totali: 3, usate: 0 }).restano);
  c("a meta': puo' ancora", true, puoProvare({ totali: 3, usate: 2 }).ok);
  c("finite: non puo'", false, puoProvare({ totali: 3, usate: 3 }).ok);
  //  ⚠️ «FINITE» E «BLOCCATO» SONO DUE NO DIVERSI: dal primo si esce
  //   comprando, dal secondo no. Un solo messaggio per entrambi manderebbe a
  //   pagare una persona bloccata — cioe' un problema trasformato in rimborso.
  c("finite: puo' comprare", true, puoProvare({ totali: 3, usate: 3 }).puoComprare);
  c("bloccato: non puo'", false, puoProvare({ totali: 10, usate: 0, bloccato: true }).ok);
  c("bloccato: NON lo mandiamo a pagare", undefined,
    puoProvare({ totali: 10, usate: 0, bloccato: true }).puoComprare);
  //  ⚠️ IL CODICE ADMIN NON HA TETTO: e' chi vende, e sta mostrando i tagli a
  //   un cliente seduto davanti. Fermarlo alla terza prova durante una
  //   consulenza sarebbe una figura, non un risparmio.
  c("admin: puo' sempre", true, puoProvare({ totali: 3, usate: 99, admin: true }).ok);
  c("admin: non si contano", -1, puoProvare({ totali: 3, usate: 99, admin: true }).restano);
  //  Ma un admin BLOCCATO resta bloccato: il blocco e' l'unica cosa che deve
  //  valere anche per chi ha tutti i permessi.
  c("admin bloccato: fermo lo stesso", false,
    puoProvare({ totali: 3, usate: 0, admin: true, bloccato: true }).ok);
  c("codice che non esiste: non esplode", false, puoProvare(null).ok);
  c("codice che non esiste: non lo manda a pagare", undefined, puoProvare(null).puoComprare);
  //  Comprare aggiunge, non azzera: chi ne aveva ancora una non la perde.
  c("dopo l'acquisto si sommano", 11, puoProvare({ totali: 13, usate: 2 }).restano);
}

function provePacchetti() {
  const { PACCHETTI, pacchettoDa, inEuro, alPezzo, risparmio } = PK;

  c("tre pacchetti", 3, PACCHETTI.length);
  //  ⚠️ Gli importi sono INTERI in centesimi: un prezzo in virgola mobile
  //   prima o poi diventa 5.899999999 e finisce in una ricevuta.
  for (const p of PACCHETTI) {
    c(`${p.chiave}: prezzo intero`, true, Number.isInteger(p.centesimi));
    c(`${p.chiave}: prove intere`, true, Number.isInteger(p.prove) && p.prove > 0);
    c(`${p.chiave}: ha un gancio`, true, p.gancio.length > 20);
  }
  c("i prezzi chiesti", "5,90 €", inEuro(590));
  c("i centesimi si vedono", "9,90 €", inEuro(990));
  c("zero centesimi", "14,00 €", inEuro(1400));
  c("il piu' grande", "14,90 €", inEuro(PACCHETTI[2].centesimi));

  //  ⚠️ IL PREZZO PER PROVA DEVE CALARE, sempre: e' l'unica ragione per cui
  //   qualcuno prende il pacchetto grande. Se un giorno qualcuno cambia un
  //   prezzo e la scala si rompe, il listino comincia a lavorare contro.
  const perProva = PACCHETTI.map((p) => p.centesimi / p.prove);
  c("il medio costa meno del piccolo, a prova", true, perProva[1] < perProva[0]);
  c("il grande costa meno del medio, a prova", true, perProva[2] < perProva[1]);
  c("si dice quanto viene una prova", "59 centesimi a prova", alPezzo(PACCHETTI[0]));
  c("sul piccolo non si vanta nessuno sconto", 0, risparmio(PACCHETTI[0]));
  c("sul medio lo sconto e' vero", true, risparmio(PACCHETTI[1]) > 20);
  c("sul grande lo sconto e' piu' grande", true, risparmio(PACCHETTI[2]) > risparmio(PACCHETTI[1]));

  //  Uno solo e' consigliato: due «il piu' scelto» non li crede nessuno.
  c("un solo consigliato", 1, PACCHETTI.filter((p) => p.consigliato).length);
  c("il consigliato e' quello di mezzo", "p25", PACCHETTI.find((p) => p.consigliato).chiave);
  c("si ritrova per chiave", 25, pacchettoDa("p25").prove);
  c("una chiave inventata non esiste", undefined, pacchettoDa("p999"));
}

function proveDellaClassifica() {
  const { conta, classifica, classificaColori, VUOTO } = CL;
  const T = "2026-09-07T10:00:00.000Z";
  const T2 = "2026-09-08T10:00:00.000Z";
  const catalogo = [{ chiave: "a", nome: "Uno" }, { chiave: "b", nome: "Due" }, { chiave: "c", nome: "Tre" }];

  //  ⚠️ NON MODIFICA QUELLO CHE RICEVE. Se contasse dentro l'oggetto di
  //   partenza, due richieste che arrivano insieme si mangerebbero i dati a
  //   vicenda dentro allo stesso processo — e nessuno se ne accorgerebbe.
  const uno = conta(VUOTO, { taglio: "a", colore: "castano" }, T);
  c("il vuoto resta vuoto", 0, VUOTO.totale);
  c("primo conteggio", 1, uno.totale);
  c("il taglio e' contato", 1, uno.tagli.a);
  c("il colore e' contato", 1, uno.colori.castano);

  const due = conta(uno, { taglio: "a", colore: "nero" }, T2);
  c("si somma", 2, due.tagli.a);
  //  ⚠️ La prima data non si sposta mai: «43 scelte» senza sapere da quando
  //   non vuol dire niente, e il «dal» che si aggiorna cancella proprio quello.
  c("il «dal» resta il primo", T, due.dal);
  c("l'«al» segue l'ultimo", T2, due.al);

  //  ⚠️ IL TAGLIO PORTATO IN FOTOGRAFIA HA UNA CASELLA SUA: fra quelli del
  //   catalogo, con la chiave vuota, sarebbe una riga senza nome in cima alla
  //   classifica e nessuno saprebbe cos'e'.
  const conFoto = conta(due, { taglio: "", daFoto: true, colore: "castano" }, T2);
  c("da foto: contato a parte", 1, conFoto.daFoto);
  c("da foto: non finisce fra i tagli", undefined, conFoto.tagli[""]);
  c("da foto: conta nel totale", 3, conFoto.totale);
  //  Anche senza il flag, un taglio vuoto non inventa una riga.
  c("taglio vuoto: come una foto", 2, conta(conFoto, { taglio: "" }, T2).daFoto);

  //  ⚠️ CI SONO ANCHE QUELLI A ZERO. Sapere che un taglio non l'ha scelto MAI
  //   nessuno e' un'informazione che si puo' usare; una classifica dei primi
  //   cinque non dice niente sugli altri venti.
  const cl = classifica(conFoto, catalogo);
  c("in classifica ci sono tutti", 3, cl.length);
  c("primo il piu' scelto", "a", cl[0].chiave);
  c("quante volte", 2, cl[0].quante);
  c("la quota e' sul totale", 67, cl[0].quota);
  c("gli altri restano, a zero", 0, cl[2].quante);

  //  Su zero prove non si divide per zero e non escono percentuali assurde.
  const vuota = classifica(VUOTO, catalogo);
  c("classifica vuota: nessuno esplode", 3, vuota.length);
  c("classifica vuota: zero per cento", 0, vuota[0].quota);
  c("colori vuoti: nessuno esplode", 0, classificaColori(null, [{ chiave: "x", nome: "X" }])[0].quante);
}

function proveDelGestoPerStato() {
  const stati = TY.ALL_LEAD_STATUSES;
  //  Gli stati chiusi non hanno un gesto, e non devono averlo: quelli sono
  //  archivio davvero.
  const chiusi = new Set(["concluso", "annullato", "perdi_tempo", "ripensamento"]);
  for (const s of stati) {
    if (chiusi.has(s)) {
      c(`${s}: nessun gesto, ed e' giusto`, undefined, UI.AZIONE_PER_STATO[s]);
      continue;
    }
    const g = UI.AZIONE_PER_STATO[s];
    c(`${s}: ha un gesto`, true, typeof g === "string" && g.length > 3);
    //  ⚠️ E' UN ORDINE, NON UN'ETICHETTA: «Riprova a chiamare» dice cosa fare,
    //   «Non risponde» ripete lo stato che si sta gia' leggendo due colonne
    //   piu' in la'.
    c(`${s}: dice un gesto, non lo stato`, false, /^(Non |In attesa|Da )/.test(String(g)));
  }
  //  Chi ha disdetto la visita non va richiamato per un meet.
  c("visita disdetta: si rifissa la visita", true,
    /visita/i.test(String(UI.AZIONE_PER_STATO.sede_disdetta)));
  //  Un pacco non si «installa».
  c("spedizione: si prepara, non si installa", true,
    /spedizione/i.test(String(UI.AZIONE_PER_STATO.posa_da_spedire)));

  /*  ── «L'HA DETTO IL …» NELLE LISTE ───────────────────────────────────
      Richiesta del committente: «fai che si vede anche nella lista lead la
      data». Le liste mostravano una data sola — entro quando si fa vivo — e
      l'altra, il giorno in cui l'ha detto, stava solo dentro la scheda: per
      sapere da quanto si aspetta bisognava aprirle una per una.
      ⚠️ SOLO SU QUELLO STATO: su ottocento righe una data in più è rumore, e
       le liste di questo CRM si reggono su quello che NON c'è scritto. */
  const oggi = new Date();
  const iso = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, "0")}-${String(oggi.getDate()).padStart(2, "0")}`;
  c("su «ci ricontatta lui» si legge quando l'ha detto", true,
    /^detto il \S+/.test(UI.dettoIlInChiaro({ stato: "ci_ricontatta_lui", ciRicontattaDettoIl: iso })));
  c("su un altro stato non si scrive niente", "",
    UI.dettoIlInChiaro({ stato: "da_ricontattare", ciRicontattaDettoIl: iso }));
  //  ⚠️ «detto il —» è peggio del silenzio: senza la data non si scrive nulla.
  c("senza la data non si scrive niente", "",
    UI.dettoIlInChiaro({ stato: "ci_ricontatta_lui" }));
  c("con una data illeggibile nemmeno", "",
    UI.dettoIlInChiaro({ stato: "ci_ricontatta_lui", ciRicontattaDettoIl: "boh" }));
  c("senza scheda non esplode", "", UI.dettoIlInChiaro(null));
}

function proveDelleRigheDaFare() {
  const { verboRiga, META_RIGA } = DF;

  //  ⚠️ IL DIFETTO: tre stati diversi finivano nella stessa frase «Rifissare la
  //   consulenza con…», e per chi aveva disdetto la VISITA IN SEDE era falsa —
  //   quella persona doveva venire in negozio, non collegarsi. Chi la
  //   richiamava le parlava di un meet che non e' mai esistito.
  c("visita disdetta: si parla di visita", true,
    verboRiga("meet_da_rifissare", "sede_disdetta").includes("visita"));
  c("visita disdetta: non si parla di consulenza", false,
    verboRiga("meet_da_rifissare", "sede_disdetta").includes("consulenza"));
  //  Gli altri due stati dello stesso gruppo restano una consulenza.
  c("da spostare: resta la consulenza", true,
    verboRiga("meet_da_rifissare", "da_spostare").includes("consulenza"));
  c("assente: resta la consulenza", true,
    verboRiga("meet_da_rifissare", "no_show").includes("consulenza"));
  //  Segreteria: chi chiama sa gia' come aprire.
  c("segreteria: dice che il messaggio c'e' gia'", true,
    verboRiga("richiamo_setter", "segreteria").includes("messaggio"));

  //  ⚠️ IL RIPIEGO ESISTE E DICE UNA COSA VERA: uno stato che arriva domani non
  //   deve lasciare la riga senza frase.
  c("stato senza frase sua: verbo del tipo", META_RIGA.ricontatto.verbo,
    verboRiga("ricontatto", "sta_valutando"));
  c("senza stato: verbo del tipo", META_RIGA.chat.verbo, verboRiga("chat"));
}

function proveDelloStatoSulPalco() {
  const { statoSulPalco } = STP;
  const q = (microfono, camera, conCamera = true) => statoSulPalco({ microfono, camera, conCamera });

  //  ⚠️ IL DIFETTO: diceva «ti sentono tutti» anche col microfono chiuso, e la
  //   persona parlava. Una frase che dice il contrario di quello che sta
  //   succedendo toglie anche il dubbio che avrebbe fatto controllare.
  c("tutto acceso: verde", "verde", q(true, true).tono);
  c("tutto acceso: lo dice", true, q(true, true).spiega.includes("vedono e ti sentono"));

  c("microfono chiuso: ambra", "ambra", q(false, true).tono);
  c("microfono chiuso: non promette che ti sentano", false,
    q(false, true).spiega.includes("Ti sentono tutti"));
  c("microfono chiuso: dice che si vede", true, q(false, true).titolo.includes("vedono"));

  c("camera chiusa: ambra", "ambra", q(true, false).tono);
  c("camera chiusa: la voce esce ancora", true, q(true, false).spiega.includes("Ti sentono tutti"));
  //  ⚠️ E si dice DI CHI è la colpa: senza, la persona si mette a cercare il
  //   permesso del browser mentre dovrebbe parlare.
  c("camera chiusa: non e' un guasto suo", true, q(true, false).spiega.includes("non è un guasto tuo"));

  //  ⚠️ Il caso peggiore va detto piu' forte: da fuori sembra in diretta e
  //   invece non esce niente.
  c("tutto chiuso: spento", "spento", q(false, false).tono);
  c("tutto chiuso: lo dice chiaro", true,
    q(false, false).spiega.includes("non ti vedono e non ti sentono"));

  //  ⚠️ «NON HAI LA CAMERA» e «TI HANNO CHIUSO LA CAMERA» sono due cose
  //   diverse: chi e' salito apposta in sola voce non deve leggere che
  //   qualcuno gliel'ha spenta.
  const soloVoce = q(true, false, false);
  c("sola voce: verde, non ambra", "verde", soloVoce.tono);
  c("sola voce: nessuna colpa a chi conduce", false, soloVoce.spiega.includes("l'ha chiusa"));
  c("sola voce: lo dice", true, soloVoce.spiega.includes("senza camera"));
  //  E se gli chiudono anche il microfono, non si parla di camera.
  c("sola voce e microfono chiuso: spento", "spento", q(false, false, false).tono);
  c("sola voce e microfono chiuso: niente camera nella frase", false,
    q(false, false, false).spiega.includes("camera"));

  //  Ogni stato ha un titolo e una spiegazione veri, non vuoti.
  for (const m of [true, false]) for (const cam of [true, false]) for (const cc of [true, false]) {
    const s = q(m, cam, cc);
    c(`${m}/${cam}/${cc}: titolo`, true, s.titolo.length > 8);
    c(`${m}/${cam}/${cc}: spiegazione`, true, s.spiega.length > 15);
    c(`${m}/${cam}/${cc}: tono valido`, true, ["verde", "ambra", "spento"].includes(s.tono));
    //  ⚠️ NESSUNA FIRMA E NESSUN DITO PUNTATO. Le frasi erano «chi conduce ha
    //   chiuso il tuo microfono»: chi sta per parlare davanti a duecento
    //   persone deve leggere COSA esce di lui, non per mano di chi — e piu'
    //   corta e' la riga, prima la legge. Che non sia un guasto suo si dice
    //   lo stesso, perche' quello cambia cosa fa.
    c(`${m}/${cam}/${cc}: non firmata`, false, /chi conduce|il relatore|presentatore/i.test(`${s.titolo} ${s.spiega}`));
    //  E nessuna riga chilometrica: si legge di sfuggita, mentre si parla.
    c(`${m}/${cam}/${cc}: sta in una riga`, true, s.spiega.length <= 90);
  }
}

function proveDellaRegiaDelPalco() {
  const { elencoRegia, conInOnda, conGrande, conTutti, conSoloIo, tuttiSulPalco, IO } = RP;
  const palco = [
    { spettatore: "a", nome: "Anna", stato: "video" },
    { spettatore: "b", nome: "Bruno", stato: "video" },
    { spettatore: "z", nome: "Zeno", stato: "attesa" },
  ];

  //  ⚠️ Chi e' in attesa non e' sul palco: gli e' stata data la parola ma non
  //   ha ancora acceso niente, e metterlo in onda vorrebbe dire un riquadro
  //   nero col suo nome.
  c("in attesa non conta", "io,a,b", tuttiSulPalco(palco).join(","));

  //  ── SENZA NIENTE SCELTO: SI VEDONO TUTTI ────────────────────────────
  const zero = elencoRegia(undefined, palco);
  c("tre righe", 3, zero.length);
  c("chi conduce e' il primo", true, zero[0].sonoIo);
  c("tutti in onda", true, zero.every((r) => r.inOnda));
  c("nessuno grande", true, zero.every((r) => !r.grande));
  c("i nomi ci sono", "Tu,Anna,Bruno", zero.map((r) => r.nome).join(","));

  //  ── TOGLIERE UNO ────────────────────────────────────────────────────
  const senzaAnna = conInOnda(undefined, palco, "a", false);
  c("togliere uno scrive la lista", "io,b", senzaAnna.mostrati.join(","));
  c("Anna e' fuori", false, elencoRegia(senzaAnna, palco).find((r) => r.chiave === "a").inOnda);
  c("Bruno resta dentro", true, elencoRegia(senzaAnna, palco).find((r) => r.chiave === "b").inOnda);

  //  ⚠️ RIMETTENDOLO SI TORNA AD «ASSENTE», e non a una lista che per caso li
  //   contiene tutti: con la lista fissa il PROSSIMO che sale non comparirebbe
  //   mai, e chi conduce non avrebbe modo di sospettarlo perche' in quel
  //   momento a schermo tornano proprio tutti.
  const rimessa = conInOnda(senzaAnna, palco, "a", true);
  c("rimettendo tutti si torna al caso normale", undefined, rimessa.mostrati);
  //  E infatti chi sale DOPO si vede da solo.
  const conCarla = [...palco, { spettatore: "c", nome: "Carla", stato: "video" }];
  c("chi sale dopo si vede", true,
    elencoRegia(rimessa, conCarla).find((r) => r.chiave === "c").inOnda);
  //  Mentre con una lista fissa no: e' esattamente il difetto che si evita.
  c("con la lista fissa non si vedrebbe", false,
    elencoRegia({ mostrati: ["io", "a", "b"] }, conCarla).find((r) => r.chiave === "c").inOnda);

  //  ⚠️ CHI CONDUCE NON SI PUO' TOGLIERE: una sala senza nessuno in onda e'
  //   una sala nera.
  c("chi conduce non si toglie", undefined, conInOnda(undefined, palco, IO, false).mostrati);
  c("resta in onda comunque", true,
    elencoRegia(conInOnda({ mostrati: ["io"] }, palco, IO, false), palco)[0].inOnda);

  //  ── IL RIQUADRO GRANDE ──────────────────────────────────────────────
  const grandeAnna = conGrande(undefined, palco, "a");
  c("Anna e' grande", true, elencoRegia(grandeAnna, palco).find((r) => r.chiave === "a").grande);
  c("una sola grande", 1, elencoRegia(grandeAnna, palco).filter((r) => r.grande).length);
  //  ⚠️ Metterla grande la manda anche in onda: «voglio vedere bene questa
  //   persona» non puo' convivere con «questa persona non si vede». E' il
  //   difetto trovato sulla sala vera.
  const grandeDaFuori = conGrande({ mostrati: ["io"] }, palco, "a");
  c("grande implica in onda", true,
    elencoRegia(grandeDaFuori, palco).find((r) => r.chiave === "a").inOnda);
  //  Ripremendo si spegne.
  c("ripremendo si toglie", false,
    elencoRegia(conGrande(grandeAnna, palco, "a"), palco).find((r) => r.chiave === "a").grande);

  //  ⚠️ Togliere dalla diretta chi era grande spegne anche il montaggio: un
  //   quadrato su una persona che la sala non vede sarebbe nero, nel posto piu'
  //   visibile dello schermo.
  const toltaDaGrande = conInOnda(grandeAnna, palco, "a", false);
  c("chi esce non resta grande", true, !toltaDaGrande.primoPiano && !toltaDaGrande.facciaAFaccia);

  //  ── I DUE GESTI RAPIDI ──────────────────────────────────────────────
  const solo = conSoloIo(grandeAnna);
  c("solo io: lista di uno", "io", solo.mostrati.join(","));
  c("solo io: niente montaggio a due", true, !solo.primoPiano && !solo.facciaAFaccia);
  c("solo io: gli altri sono fuori ma ci sono ancora", 3, elencoRegia(solo, palco).length);
  c("tutti: si torna ad assente", undefined, conTutti(solo).mostrati);
  c("tutti: non azzera altro", true, conTutti({ maniAperte: true }).maniAperte);
}

function proveDegliErroriMedia() {
  const { spiegaErroreMedia } = EM;

  //  ⚠️ IL DIFETTO SEGNALATO: tutto quello che non era «hai negato» diventava
  //   «controlla che non li stia usando un'altra applicazione» — vero in UN
  //   caso su sei. Adesso ogni causa ha la sua frase e il suo codice.
  const codici = new Set();
  for (const nome of ["NotAllowedError", "NotFoundError", "NotReadableError",
                      "OverconstrainedError", "SecurityError", "AbortError",
                      "SenzaSupporto", "TypeError", "NotSupportedError",
                      "BohNonSoCosaSia"]) {
    const s = spiegaErroreMedia(nome, true);
    c(`${nome}: ha un codice`, true, /^C\d\d$/.test(s.codice));
    c(`${nome}: ha una frase`, true, s.testo.length > 20);
    codici.add(s.codice);
  }
  c("dieci cause, dieci codici diversi", 10, codici.size);

  //  ⚠️ `TypeError` vuol dire che abbiamo chiesto male NOI: la frase non deve
  //   mandare la persona a controllare la sua camera.
  c("TypeError: non da' la colpa a lui", true,
    spiegaErroreMedia("TypeError", true).testo.includes("da parte nostra"));
  //  ⚠️ I browser dentro le applicazioni: l'unica cosa che funziona e' aprire
  //   il link nel browser vero, e va detto.
  c("NotSupportedError: manda al browser vero", true,
    spiegaErroreMedia("NotSupportedError", true).testo.includes("Chrome o Safari"));

  //  ⚠️ «Un'altra applicazione» si dice SOLO quando è vero.
  c("solo NotReadable parla di altre applicazioni", true,
    spiegaErroreMedia("NotReadableError", true).testo.includes("un'altra applicazione"));
  for (const nome of ["NotFoundError", "OverconstrainedError", "SecurityError", "AbortError"]) {
    c(`${nome}: non incolpa altre applicazioni`, false,
      spiegaErroreMedia(nome, true).testo.includes("un'altra applicazione"));
  }

  //  ⚠️ Chi entra in sola voce non si sente dire «camera negata»: la camera
  //   non l'ha mai chiesta, e sentirsela nominare fa cercare un problema che
  //   non c'è.
  c("sola voce: non parla di camera", false,
    spiegaErroreMedia("NotAllowedError", false).testo.toLowerCase().includes("camera"));
  c("con video: parla di camera", true,
    spiegaErroreMedia("NotAllowedError", true).testo.toLowerCase().includes("camera"));
  c("sola voce senza microfono: lo dice", true,
    spiegaErroreMedia("NotFoundError", false).testo.includes("microfono"));

  //  ⚠️ Quando manca la camera si offre la voce: è l'unica cosa che si può
  //   fare, e senza dirlo la persona resta ferma.
  c("niente camera: propone la voce", true,
    spiegaErroreMedia("NotFoundError", true).testo.includes("solo con la voce"));

  //  Un errore che non conosciamo non inventa una causa.
  const ignoto = spiegaErroreMedia("QualcosaDiNuovo", true);
  c("errore ignoto: nessuna colpa data", false, ignoto.testo.includes("negato"));
  c("errore ignoto: propone comunque una via", true, ignoto.testo.includes("voce"));
  c("nome vuoto: non esplode", true, spiegaErroreMedia("", true).codice.length === 3);
}

function proveDeiFotogrammi() {
  const { qualcunoAvanza } = FG;

  //  Il caso normale: un flusso solo che continua a decodificare.
  c("un flusso che avanza", true, qualcunoAvanza({ a: 100 }, { a: 130 }));
  c("un flusso fermo", false, qualcunoAvanza({ a: 100 }, { a: 100 }));

  //  ⚠️ IL DIFETTO SEGNALATO CON LA FOTO. Il flusso «b» teneva il massimo
  //   (500) e se ne va; restano «a» a 200 che continua ad avanzare. Col
  //   massimo il conto leggeva 200 < 500 e diceva «fermo» PER SEMPRE, sopra un
  //   video che si vedeva benissimo. Adesso conta che «a» è avanzato.
  c("chi teneva il massimo se ne va: si guarda chi resta", true,
    qualcunoAvanza({ a: 200, b: 500 }, { a: 260 }));
  //  E se davvero non avanza più nessuno, lo si dice.
  c("resta uno solo ed è fermo", false, qualcunoAvanza({ a: 200, b: 500 }, { a: 200 }));

  //  Basta che UNO avanzi: gli altri possono essere fermi (camera coperta,
  //  ospite in pausa) senza che la sala gridi al guasto.
  c("uno avanza e gli altri no", true, qualcunoAvanza({ a: 10, b: 20 }, { a: 10, b: 21 }));
  c("nessuno avanza", false, qualcunoAvanza({ a: 10, b: 20 }, { a: 10, b: 20 }));

  //  ⚠️ Un flusso NUOVO fermo a zero non è una buona notizia: appena agganciato
  //   non ha ancora decodificato niente, e contarlo vorrebbe dire dire «va
  //   tutto bene» nell'istante in cui non è arrivato ancora nulla.
  c("flusso nuovo a zero: non conta", false, qualcunoAvanza({}, { nuovo: 0 }));
  c("flusso nuovo che ha già decodificato: conta", true, qualcunoAvanza({}, { nuovo: 7 }));

  //  Nessuna statistica video = non arriva niente, e non «non lo so»: è il caso
  //  di chi conduce andato in onda senza camera.
  c("nessun flusso: non arriva niente", false, qualcunoAvanza({ a: 5 }, {}));
  c("niente e niente", false, qualcunoAvanza({}, {}));

  //  Numeri storti non fanno dire di sì per sbaglio.
  c("valori assurdi: ignorati", false, qualcunoAvanza({ a: 5 }, { a: NaN }));
  c("senza il conto di prima si parte da zero", true, qualcunoAvanza(undefined, { a: 3 }));
}

function proveDellaCameraBuia() {
  const { cameraSpenta, SOGLIA_LUCE, CAMPIONI_AL_BUIO } = CB;

  //  ⚠️ IL CASO MISURATO IN SALA: luminanza massima zero, per tre campioni.
  c("tutto nero: camera spenta", true, cameraSpenta([0, 0, 0]));
  c("neri di compressione: comunque spenta", true, cameraSpenta([1, 3, 2]));

  //  ⚠️ Una stanza in penombra NON si spegne: basta un riflesso. È il motivo
  //   per cui si guarda il pixel più chiaro e non la media.
  c("penombra con un riflesso: si vede", false, cameraSpenta([0, 0, 40]));
  c("appena sopra la soglia: si vede", false, cameraSpenta([5, 5, 5]));
  c("luce piena: si vede", false, cameraSpenta([200, 190, 210]));

  //  ⚠️ Pochi campioni = non si decide. Il primo fotogramma dopo l'aggancio è
  //   nero quasi sempre, e decidere su quello farebbe lampeggiare l'avatar a
  //   ogni persona che sale sul palco.
  c("nessun campione: non si decide", false, cameraSpenta([]));
  c("un campione solo: non si decide", false, cameraSpenta([0]));
  c("due campioni: non si decide", false, cameraSpenta([0, 0]));
  c("serve la soglia esatta", CAMPIONI_AL_BUIO, 3);

  //  ⚠️ Contano gli ULTIMI, non tutti: una camera coperta e poi scoperta deve
  //   tornare a vedersi, e una che si spegne adesso deve accorgersene anche se
  //   prima andava.
  c("era buia e adesso c'è luce: si vede", false, cameraSpenta([0, 0, 0, 0, 150, 160, 170]));
  c("andava e adesso è buia: spenta", true, cameraSpenta([150, 160, 0, 0, 0]));

  //  Valori storti non fanno spegnere niente: nel dubbio si mostra il video.
  c("valori assurdi: non si decide", false, cameraSpenta([NaN, NaN, NaN]));
  c("non è un elenco: non si decide", false, cameraSpenta(null));
  c("soglia dichiarata", SOGLIA_LUCE, 4);
}

function proveDelRitmo() {
  const { ritmoDelGiro, RITMO } = RT;
  const q = (fase, visibile = true) => ritmoDelGiro({ fase, visibile });

  //  ⚠️ IL CASO CHE CONTA: in onda, con la pagina davanti. È l'unico momento in
  //   cui un ritardo si vede, e deve essere il ritmo più svelto di tutti.
  c("in onda e davanti: il più svelto", RITMO.ondaDavanti, q("onda"));
  c("sotto il secondo", true, q("onda") < 1000);

  //  ⚠️ Con la pagina dietro si rallenta MOLTO: il telefono in tasca durante
  //   un'ora di diretta è il caso più comune, e lì ogni richiesta aggiorna uno
  //   schermo spento.
  c("in onda ma dietro: si rallenta", RITMO.ondaDietro, q("onda", false));
  c("dietro costa almeno otto volte meno", true, q("onda", false) >= q("onda") * 8);

  //  Prima che cominci si aspetta l'unica cosa che può succedere.
  for (const f of ["attesa", "pronto", "cerco", "collego"]) {
    c(`${f}: ritmo d'attesa`, RITMO.attesa, q(f));
    c(`${f} dietro: rallenta`, RITMO.ondaDietro, q(f, false));
  }

  //  Quando non c'è più niente da vedere cambiare, si smette di correre.
  c("finita: ritmo fermo", RITMO.fermo, q("finito"));
  c("rimossa: ritmo fermo", RITMO.fermo, q("rimossa"));
  c("errore: ritmo fermo", RITMO.fermo, q("errore"));

  //  ⚠️ Nessun ritmo può scendere sotto il mezzo secondo: sarebbe una
  //   richiesta ogni due fotogrammi per ogni persona in sala, e la cache del
  //   bordo non farebbe in tempo a servire a niente.
  for (const f of ["onda", "attesa", "finito", "boh"]) {
    for (const v of [true, false]) {
      c(`${f}/${v}: mai sotto mezzo secondo`, true, ritmoDelGiro({ fase: f, visibile: v }) >= 500);
    }
  }
}

function proveDelVestitoDelTasto() {
  const { vestitoDelTasto } = CH;
  //  ⚠️ Queste quattro righe sono il chiodo. La combinazione si è ribaltata
  //   tre volte fra una richiesta e l'altra, e ogni volta bisognava andare a
  //   leggere un ternario dentro una classe CSS per sapere com'era messa.
  //   Adesso c'è scritto qui, e cambiarla senza chiederlo fa fallire le prove.
  const chiusa = vestitoDelTasto(false);
  c("chat chiusa: il tasto è verde", "verde", chiusa.colore);
  c("chat chiusa: fumetto pieno", "pieno", chiusa.icona);
  c("chat chiusa: dice «Apri chat»", "Apri chat", chiusa.scritta);

  const aperta = vestitoDelTasto(true);
  c("chat aperta: il tasto è grigio", "grigio", aperta.colore);
  c("chat aperta: fumetto barrato", "barrato", aperta.icona);
  c("chat aperta: dice «Chiudi chat»", "Chiudi chat", aperta.scritta);

  //  ⚠️ E i due stati non possono mai combaciare: se un giorno qualcuno
  //   semplificasse la funzione e tornasse sempre la stessa cosa, il tasto
  //   diventerebbe muto e nessuna delle prove qui sopra se ne accorgerebbe.
  c("i due stati si distinguono", true,
    chiusa.colore !== aperta.colore && chiusa.icona !== aperta.icona && chiusa.scritta !== aperta.scritta);
}

function proveDelDuello() {
  const { duello } = PT;

  //  Computer: affiancati, e il lato è metà larghezza perché l'altezza avanza.
  const pc = duello(1200, 700);
  c("computer: affiancati", "fianco", pc.orientamento);
  c("computer: lato da metà larghezza", 597, pc.lato);
  c("computer: due quadrati ci stanno in larghezza", true, pc.lato * 2 + 6 <= 1200);
  c("computer: e in altezza", true, pc.lato <= 700);

  //  ⚠️ TELEFONO IN PIEDI: affiancati verrebbero due francobolli. La regola
  //   sceglie da sé di impilarli, e il quadrato raddoppia abbondantemente.
  const tel = duello(375, 700);
  c("telefono: uno sopra l'altro", "sopra", tel.orientamento);
  c("telefono: lato tutta la larghezza", 347, tel.lato);
  c("telefono: impilati battono affiancati", true, tel.lato > (375 - 6) / 2);

  //  ⚠️ In nessuna forma di schermo i due quadrati possono sforare: è tutta la
  //   promessa, e vale la pena provarla su misure a caso e non su due comode.
  for (const [l, a] of [[1200, 700], [375, 700], [1600, 400], [700, 700], [320, 900], [1920, 1080], [500, 260]]) {
    const d = duello(l, a);
    const larghi = d.orientamento === "fianco" ? d.lato * 2 + 6 : d.lato;
    const alti = d.orientamento === "fianco" ? d.lato : d.lato * 2 + 6;
    c(`${l}x${a}: non sfora in larghezza`, true, larghi <= l + 1);
    c(`${l}x${a}: non sfora in altezza`, true, alti <= a + 1);
    //  ⚠️ E la scelta è sempre quella che dà il quadrato più grande: lo
    //   verifico rifacendo il conto, non ricopiando la risposta attesa.
    const f = Math.min((l - 6) / 2, a), s = Math.min(l, (a - 6) / 2);
    c(`${l}x${a}: sceglie il quadrato più grande`, f >= s ? "fianco" : "sopra", d.orientamento);
  }

  //  Senza misura torna zero, così chi chiama sa di dover usare la riserva.
  c("non misurato: lato zero", 0, duello(0, 500).lato);
  c("misura assurda: lato zero", 0, duello(800, -3).lato);
  //  Uno spazio più stretto del margine non produce un lato negativo.
  c("spazio minuscolo: mai sotto zero", true, duello(4, 4).lato >= 0);
}

function proveDelPercorsoInOnda() {
  // ── QUALE PAGINA VIENE MANDATA ALLA SALA ──────────────────────────────
  const { percorsoDaMandare } = SC;
  //  ⚠️ IL DIFETTO SEGNALATO: nella pagina /regia il contenuto sta in un
  //   riquadro incorporato e l'indirizzo del browser resta /regia/<codice>.
  //   Mandandolo alla sala, premere «Mostra» su una foto non cambiava niente
  //   per chi guarda — e sembrava che i media non partissero.
  c("regia: manda il contenuto, non l'indirizzo", "/presenta", percorsoDaMandare({
    pagina: true, contenuto: "/presenta", browser: "/regia/gfr-tzmt-drr" }));
  c("regia: cambiando media cambia quello che arriva", "/preventivo", percorsoDaMandare({
    pagina: true, contenuto: "/preventivo", browser: "/regia/gfr-tzmt-drr" }));
  //  Dentro la postazione delle consulenze si naviga davvero: lì vale il browser.
  c("barra: vale l'indirizzo vero", "/slide", percorsoDaMandare({
    pagina: false, contenuto: "/presenta", browser: "/slide" }));
  //  ⚠️ Un indirizzo di regia non arriva MAI alla sala, da nessuna delle due
  //   strade: meglio non cambiare niente che mandare la sala sulla regia.
  c("regia: mai mandato l'indirizzo della regia", "", percorsoDaMandare({
    pagina: false, contenuto: "", browser: "/regia/abc-def-ghi" }));
  c("regia: nemmeno la regia nuda", "", percorsoDaMandare({
    pagina: false, contenuto: "", browser: "/regia" }));
  //  Una pagina che comincia per «regi» ma non è la regia deve passare.
  c("non confonde /regione con /regia", "/regione", percorsoDaMandare({
    pagina: true, contenuto: "/regione", browser: "/regia/x" }));
}

function provePalco() {
  const base = {
    nome: "M", spettatore: "s1", stato: "video",
    sessionId: "S1", tracciaAudio: "a-s1", tracciaVideo: "v-s1",
    agganciate: ["S1/a-s1", "S1/v-s1"],
    arrivate: [
      { kind: "audio", enabled: true, muted: false, readyState: "live" },
      { kind: "video", enabled: true, muted: false, readyState: "live" },
    ],
    flusso: true,
  };
  c("col video a posto lo dice", true, DP.aPosto(base));

  //  ⚠️ OGNI CASO DEVE DARE UNA RISPOSTA DIVERSA: se due situazioni diverse
  //   producessero la stessa frase, il pannello non distinguerebbe piu' niente
  //   ed sarebbe tornato a essere un rettangolo nero con piu' parole.
  const casi = {
    "sola voce": { ...base, stato: "audio" },
    "non salito": { ...base, sessionId: "" },
    "senza traccia video": { ...base, tracciaVideo: "" },
    "non agganciata": { ...base, agganciate: ["S1/a-s1"] },
    "nessun flusso": { ...base, flusso: false },
    "flusso senza video": { ...base, arrivate: [{ kind: "audio", enabled: true, muted: false, readyState: "live" }] },
    "video spento": { ...base, arrivate: [{ kind: "video", enabled: false, muted: false, readyState: "live" }] },
    "video finito": { ...base, arrivate: [{ kind: "video", enabled: true, muted: false, readyState: "ended" }] },
    "senza fotogrammi": { ...base, arrivate: [{ kind: "video", enabled: true, muted: true, readyState: "live" }] },
  };
  const viste = new Set();
  for (const [nome, caso] of Object.entries(casi)) {
    const d = DP.diagnosi(caso);
    c(`«${nome}» non risulta a posto`, false, DP.aPosto(caso));
    c(`«${nome}» ha una sua frase`, false, viste.has(d));
    viste.add(d);
  }

  //  ── LE MISURE DEL RIQUADRO ────────────────────────────────────────────
  //  ⚠️ Ci si confronta con LA SORGENTE e non con 16:9 fisso: la camera di un
  //   telefono in verticale e' 9:16, e pretendere da lei un 16:9 vorrebbe dire
  //   dichiarare sbagliato proprio il caso piu' comune.
  const stretto = DP.misuraRiquadro({ larghezza: 1444, altezza: 376 }, { larghezza: 1280, altezza: 720 });
  c("la fascia larga e bassa taglia", true, stretto.taglia);
  c("e dice quanto se ne perde", true, /% dell'inquadratura/.test(stretto.descrizione));
  const giusto = DP.misuraRiquadro({ larghezza: 656, altezza: 370 }, { larghezza: 1280, altezza: 720 });
  c("il riquadro corretto non taglia", false, giusto.taglia);
  const verticale = DP.misuraRiquadro({ larghezza: 270, altezza: 480 }, { larghezza: 720, altezza: 1280 });
  c("una camera verticale nel suo riquadro non taglia", false, verticale.taglia);
  const verticaleInOrizzontale = DP.misuraRiquadro({ larghezza: 640, altezza: 360 }, { larghezza: 720, altezza: 1280 });
  c("ma una verticale in un riquadro orizzontale si'", true, verticaleInOrizzontale.taglia);
  //  Niente misure ancora: non si inventa un verdetto.
  c("senza misure non si sentenzia", false, DP.misuraRiquadro({ larghezza: 0, altezza: 0 }, { larghezza: 0, altezza: 0 }).taglia);
}

/** ── RISPONDERE A QUALCUNO IN CHAT ────────────────────────────────────────
 *  L'aggancio viaggia DENTRO il testo del messaggio. E' una scelta che si paga
 *  con una regola sola da rispettare: quello che si scrive si deve poter
 *  rileggere. Se sciogliere un messaggio fallisse anche una volta su mille, in
 *  chat comparirebbe un marcatore grezzo davanti a duecento persone. */
function proveDelleMenzioni() {
  const a = { id: "s1", nome: "Mario Rossi" };
  const composto = ME.conRisposta("ciao come stai", a);
  const sciolto = ME.sciogli(composto);
  c("il testo torna intero", "ciao come stai", sciolto.testo);
  c("e si sa a chi", "s1", sciolto.aId);
  c("col nome di allora", "Mario Rossi", sciolto.aNome);

  //  Senza destinatario non si porta dietro niente: e' il caso normale.
  c("un messaggio normale resta identico", "ciao", ME.conRisposta("ciao", null));
  c("e si scioglie in se stesso", "ciao", ME.sciogli("ciao").testo);
  c("senza destinatario non c'e' destinatario", "", ME.sciogli("ciao").aId);

  //  ⚠️ I NOMI VERI CONTENGONO DI TUTTO. Una barra verticale o una quadra
  //   dentro il nome spezzerebbero il marcatore a meta', e da li' in poi il
  //   messaggio si leggerebbe storto.
  const cattivo = ME.conRisposta("test", { id: "s2", nome: "Anna | Bianchi] X" });
  const s2 = ME.sciogli(cattivo);
  c("un nome con caratteri storti non rompe niente", "test", s2.testo);
  c("e l'identificativo resta giusto", "s2", s2.aId);

  //  ⚠️ NON FALLISCE MAI. Un marcatore malformato si legge come testo
  //   normale: in chat non si puo' mostrare un errore al posto di una frase.
  for (const rotto of ["↩[senza chiusura ciao", "↩[soloid] ciao", "↩[|soloNome] ciao", "↩[", "↩[]"]) {
    const r = ME.sciogli(rotto);
    c(`«${rotto.slice(0, 14)}» non sparisce`, rotto, r.testo);
    c(`«${rotto.slice(0, 14)}» non inventa un destinatario`, "", r.aId);
  }
  //  Niente testo, niente aggancio: non si spedisce un marcatore da solo.
  c("un testo vuoto non diventa un marcatore", "", ME.conRisposta("   ", a));

  //  ── I TRE TONI ────────────────────────────────────────────────────────
  c("rivolto a me", "a-me", ME.tono({ aId: "io1" }, "io1"));
  c("una mia risposta a un altro", "mio", ME.tono({ aId: "s9", autoreId: "io1" }, "io1"));
  c("fra altri due", "ad-altri", ME.tono({ aId: "s9", autoreId: "s8" }, "io1"));
  c("un messaggio senza risposta non ha tono", "nessuno", ME.tono({ aId: "" }, "io1"));
  //  ⚠️ «a me» vince su «mio»: rispondendo a se stessi conta di piu' il fatto
  //   che quel messaggio e' indirizzato a te.
  c("a me stesso resta «a me»", "a-me", ME.tono({ aId: "io1", autoreId: "io1" }, "io1"));
  //  Senza sapere chi sono io, non si puo' dire che sia rivolto a me.
  c("senza identita' non e' rivolto a me", "ad-altri", ME.tono({ aId: "s9" }, ""));
}

/** ── COME SI INCASTRANO LE PERSONE SUL PALCO ──────────────────────────────
 *  Una regola sola per la console e per la sala. Se sbaglia, sbaglia su TUTTI
 *  e tre gli schermi contemporaneamente — ed e' il genere di difetto che si
 *  vede solo quando c'e' gente collegata, cioe' quando non si puo' correggere. */
function proveDelTetris() {
  const D = PT.disponiPalco;

  //  ── METÀ SCHERMO A CHI CONDUCE, MA SOLO SE C'E' QUALCUNO NELL'ALTRA ────
  c("da solo prende tutto", "solo", D({ larghezza: 1440, altezza: 800, ospiti: 0, inPrimoPiano: false }).modo);
  c("con uno in primo piano si divide", "duo", D({ larghezza: 1440, altezza: 800, ospiti: 1, inPrimoPiano: true }).modo);
  //  ⚠️ Nessuno sul palco e «primo piano» acceso: mezza schermata nera. Non
  //   deve succedere — la promessa di un secondo riquadro senza nessuno dentro
  //   toglie meta' spazio a chi conduce per mostrare il nulla.
  c("primo piano senza nessuno non divide", "solo", D({ larghezza: 1440, altezza: 800, ospiti: 0, inPrimoPiano: true }).modo);
  c("ospiti ma nessuno in primo piano non divide", "solo", D({ larghezza: 1440, altezza: 800, ospiti: 3, inPrimoPiano: false }).modo);

  //  ── LA FORMA DELLO SCHERMO, NON L'APPARECCHIO ─────────────────────────
  c("computer: affiancati", "fianco", D({ larghezza: 1440, altezza: 800, ospiti: 2, inPrimoPiano: true }).orientamento);
  c("telefono in piedi: uno sopra l'altro", "sopra", D({ larghezza: 375, altezza: 812, ospiti: 2, inPrimoPiano: true }).orientamento);
  //  ⚠️ Un telefono GIRATO e' largo come un tablet: decide la forma.
  c("telefono girato: affiancati", "fianco", D({ larghezza: 812, altezza: 375, ospiti: 2, inPrimoPiano: true }).orientamento);
  c("tablet in piedi: uno sopra l'altro", "sopra", D({ larghezza: 768, altezza: 1024, ospiti: 2, inPrimoPiano: true }).orientamento);

  //  ── LA FILA: SEI AL MASSIMO, E QUANTI NE RESTANO FUORI SI DICE ────────
  const tanti = D({ larghezza: 1440, altezza: 800, ospiti: 12, inPrimoPiano: true });
  c("non piu' di sei in fila", 6, tanti.inFila);
  //  12 ospiti, uno e' grande nell'altra meta': ne restano 11, sei in fila.
  c("e si dice quanti restano fuori", 5, tanti.fuori);
  c("sei piu' cinque fanno gli undici piccoli", 11, tanti.inFila + tanti.fuori);

  //  ⚠️ QUANTI CE NE STANNO LO DECIDE LA LARGHEZZA. Sei riquadri su un telefono
  //   da 375 punti sarebbero larghi sessanta: non sono facce, sono puntini.
  const stretto = D({ larghezza: 375, altezza: 812, ospiti: 8, inPrimoPiano: true });
  c("sul telefono ce ne stanno meno di sei", true, stretto.inFila < 6);
  c("ma almeno uno si vede", true, stretto.inFila >= 1);
  c("e gli altri sono contati", 7, stretto.inFila + stretto.fuori);

  //  ── SENZA NESSUNO DA METTERE, LA FILA NON ESISTE ──────────────────────
  //  ⚠️ Altezza ZERO e non «piccola»: una striscia vuota e' spazio rubato a chi
  //   conduce, tutte le volte.
  const nessuno = D({ larghezza: 1440, altezza: 800, ospiti: 0, inPrimoPiano: false });
  c("senza ospiti niente fila", 0, nessuno.inFila);
  c("e la fila non occupa niente", 0, nessuno.altezzaFila);
  //  Un ospite solo, gia' grande: non resta nessuno da mettere in fila.
  const unoSolo = D({ larghezza: 1440, altezza: 800, ospiti: 1, inPrimoPiano: true });
  c("l'unico ospite e' gia' grande, la fila e' vuota", 0, unoSolo.inFila);
  c("e non occupa niente", 0, unoSolo.altezzaFila);

  //  ── L'ALTEZZA DELLA FILA STA IN UN INTERVALLO ─────────────────────────
  const alta = D({ larghezza: 1440, altezza: 2000, ospiti: 4, inPrimoPiano: true });
  c("su uno schermo altissimo la fila non dilaga", true, alta.altezzaFila <= 148);
  const bassa = D({ larghezza: 1440, altezza: 300, ospiti: 4, inPrimoPiano: true });
  c("su uno schermo bassissimo resta riconoscibile", true, bassa.altezzaFila >= 72);

  //  ── CHI SI TAGLIA E CHI NO ────────────────────────────────────────────
  //  ⚠️ Chi conduce NON si taglia mai: tagliarlo e' stato il primo difetto
  //   segnalato — si vedeva una fetta di soffitto al posto di una persona.
  //  ⚠️ La domanda non e' «chi e'», e' «quanto spazio ha».
  c("chi conduce DA SOLO non si taglia", "contain", PT.riempimento("conduce", "solo"));
  //  ⚠️ In due la cella diventa quasi quadrata: un 16:9 intero ci lascia
  //   dentro due bande che sono un terzo dello spazio. Meglio tagliare i lati
  //   che regalare un terzo di meta' schermo al nero — ed e' il caso indicato
  //   dal committente.
  c("chi conduce IN DUE riempie la sua meta'", "cover", PT.riempimento("conduce", "duo"));
  c("chi parla riempie", "cover", PT.riempimento("parla", "duo"));
  c("le miniature riempiono sempre", "cover", PT.riempimento("miniatura", "solo"));

  //  Misure assurde non devono far esplodere niente.
  const zero = D({ larghezza: 0, altezza: 0, ospiti: 3, inPrimoPiano: true });
  c("a schermo zero non si rompe", true, zero.inFila >= 1);
}

/** ── UN ERRORE VERO NON DEVE NASCONDERSI FRA I RUMORI ─────────────────────
 *
 *  ⚠️ QUESTA PROVA NASCE DA UN GUASTO IN PRODUZIONE. In `api.public.webinar`
 *   era finito `s?.whatsapp` invece di `stanza?.whatsapp`: un nome che non
 *   esiste. Il compilatore l'aveva detto — «Cannot find name 's'» — ma in
 *   questo progetto `tsc` stampa CENTOSETTANTA errori preesistenti (i tipi
 *   generati di Supabase non conoscono la tabella `app_config`), e quello vero
 *   e' passato inosservato in mezzo agli altri. `vite build` non controlla i
 *   tipi, quindi e' stato pubblicato: la porta pubblica rispondeva 500, la sala
 *   leggeva «non trovata» e a chiunque aprisse il link diceva che la diretta
 *   non c'era piu'.
 *
 *  Qui si separano le due cose. Il rumore noto e' UNA SOLA famiglia — le
 *  chiamate a Supabase su tabelle che i tipi generati non conoscono — e si
 *  riconosce dal messaggio. Tutto il resto e' un errore vero e fa fallire le
 *  prove.
 *  ⚠️ NON si contano gli errori (170 «e' andato bene», 171 «male»): il numero
 *   cambia ogni volta che si tocca una query, e una prova che dipende da un
 *   numero cosi' si spegne da sola dopo due settimane. Si guarda il TIPO.
 */
function proveDeiTipi() {
  let uscita = "";
  try {
    uscita = execFileSync("npx", ["tsc", "--noEmit"], { cwd: radice, encoding: "utf8" });
  } catch (e) {
    uscita = String(e.stdout || "") + String(e.stderr || "");
  }
  //  Il rumore noto: le tabelle che i tipi generati di Supabase non conoscono.
  const RUMORE = [
    /No overload matches this call/,
    /Argument of type '"[a-z_]+"' is not assignable to parameter of type/,
    /Overload \d of \d/,
    /may be a mistake because neither type sufficiently overlaps/,
    /Conversion of type/,
    /^\s/,           // le righe di continuazione di un errore multilinea
  ];
  const veri = uscita
    .split("\n")
    .filter((r) => /^src\/.*error TS/.test(r))
    .filter((r) => !RUMORE.some((x) => x.test(r)));

  if (veri.length) {
    for (const r of veri.slice(0, 8)) console.log("   " + r);
  }
  c("nessun errore di tipo oltre al rumore noto di Supabase", 0, veri.length);
}

/** ── IL CONTO ALLA ROVESCIA DELLA SALA D'ATTESA ───────────────────────────
 *  ⚠️ Si chiama `proveDelContoWebinar` e non `proveDelConto`: quel nome era
 *   gia' preso dalla contabilita', e due funzioni con lo stesso nome nello
 *   stesso file non fanno partire NIENTE — nemmeno le altre seicento prove.
 *  La parte difficile non e' sottrarre due date: e' decidere COSA MOSTRARE.
 *  Un conto che dice «0 giorni · 0 ore · 12 minuti» fa sembrare lontana una
 *  cosa che comincia fra dodici minuti — l'occhio legge il primo numero, e il
 *  primo numero e' zero. */
function proveDelContoWebinar() {
  const T = (s) => Date.parse("2026-09-10T10:00:00.000Z") - s * 1000;
  const meta = "2026-09-10T10:00:00.000Z";
  const q = (secondiPrima) => CR.quantoManca(meta, T(secondiPrima));

  //  ── QUALI VOCI SI MOSTRANO ────────────────────────────────────────────
  //  ⚠️ Dalla piu' grande che vale qualcosa in giu'.
  c("a giorni si mostrano tutte", "giorni,ore,minuti,secondi", q(2 * 86400 + 3700).voci.join(","));
  //  ⚠️ Sotto il giorno la voce «giorni» SPARISCE: «0 giorni» e' esattamente
  //   il numero che fa sembrare lontana una cosa vicina.
  c("sotto il giorno niente giorni", "ore,minuti,secondi", q(5 * 3600).voci.join(","));
  c("sotto l'ora niente ore", "minuti,secondi", q(12 * 60).voci.join(","));
  //  ⚠️ Minuti e secondi ci sono SEMPRE: a quaranta secondi dalla partenza un
  //   numero solo che scende non si riconosce nemmeno come un orologio.
  c("sotto il minuto restano minuti e secondi", "minuti,secondi", q(43).voci.join(","));
  c("e i minuti sono zero, non spariti", 0, q(43).minuti);
  c("i secondi ci sono", 43, q(43).secondi);

  //  ⚠️ MA GLI ZERI IN MEZZO RESTANO: «2 giorni · 5 minuti» si legge male e per
  //   un istante sembra dire un'altra cosa.
  const conZeroInMezzo = q(2 * 86400 + 5 * 60);
  c("lo zero in mezzo non si toglie", "giorni,ore,minuti,secondi", conZeroInMezzo.voci.join(","));
  c("e vale davvero zero", 0, conZeroInMezzo.ore);

  //  ── I NUMERI ──────────────────────────────────────────────────────────
  const due = q(2 * 86400 + 3 * 3600 + 4 * 60 + 5);
  c("giorni", 2, due.giorni);
  c("ore", 3, due.ore);
  c("minuti", 4, due.minuti);
  c("secondi", 5, due.secondi);

  //  ── L'ORA PASSATA NON CONTA ALL'INSU' ─────────────────────────────────
  //  ⚠️ Un webinar che comincia con dieci minuti di ritardo — cioe' quasi
  //   sempre — mostrerebbe «-00:10:23», che dice a duecento persone in attesa
  //   che qualcosa non ha funzionato.
  const tardi = CR.quantoManca(meta, Date.parse(meta) + 10 * 60000);
  c("l'ora passata si dichiara", true, tardi.passato);
  c("e non ci sono numeri negativi", true, [tardi.giorni, tardi.ore, tardi.minuti, tardi.secondi].every((n) => n >= 0));
  c("e la frase non promette «adesso»", true, /fra poco|sta per/i.test(CR.frase(tardi)));

  //  Un orario assente o illeggibile non inventa un conto.
  c("senza orario niente conto", null, CR.quantoManca(null, Date.now()));
  c("un orario illeggibile non inventa", null, CR.quantoManca("domani mattina", Date.now()));
  c("e la frase regge lo stesso", true, CR.frase(null).length > 10);

  //  ── COME SI SCRIVONO ──────────────────────────────────────────────────
  //  ⚠️ Ore, minuti e secondi a DUE cifre: senza, la riga cambia larghezza a
  //   ogni secondo e balla.
  c("i secondi hanno due cifre", "05", CR.valore(due, "secondi"));
  c("le ore hanno due cifre", "03", CR.valore(due, "ore"));
  //  ⚠️ I giorni no: «03 giorni» sembra il numero di serie di qualcosa.
  c("i giorni no", "2", CR.valore(due, "giorni"));

  //  ⚠️ «1 giorni» e' la scritta che fa capire che nessuno ci ha guardato.
  const uno = q(86400 + 3600 + 60 + 1);
  c("un giorno solo", "giorno", CR.etichetta(uno, "giorni"));
  c("un'ora sola", "ora", CR.etichetta(uno, "ore"));
  c("un minuto solo", "minuto", CR.etichetta(uno, "minuti"));
  c("un secondo solo", "secondo", CR.etichetta(uno, "secondi"));
  c("al plurale invece", "giorni", CR.etichetta(due, "giorni"));

  //  ── LA FRASE CAMBIA CON LA DISTANZA ───────────────────────────────────
  //  A giorni si torna dopo e va detto; a minuti si resta.
  c("a giorni si dice di segnarsi il giorno", true, /giorno|link/i.test(CR.frase(q(3 * 86400))));
  c("a minuti si dice di restare", true, /resta/i.test(CR.frase(q(120))));
  c("le tre frasi sono diverse", 3,
    new Set([CR.frase(q(3 * 86400)), CR.frase(q(5 * 3600)), CR.frase(q(120))]).size);
}

/** ── SCRIVERE «@» E TROVARE UNA PERSONA ───────────────────────────────────
 *  Il difetto tipico di questi elenchi e' restare aperti quando non servono
 *  piu': uno scrive «@mario ciao come stai» e l'elenco cerca ancora
 *  «mario ciao come stai» fra i presenti, coprendo la conversazione. */
function proveDelTag() {
  const ap = TG.tagAperto;

  //  ── QUANDO L'ELENCO E' APERTO ─────────────────────────────────────────
  c("appena scritta la chiocciola", "", ap("ciao @", 6).cerca);
  c("e si sa dov'e'", 5, ap("ciao @", 6).inizio);
  c("scrivendo il nome", "mar", ap("ciao @mar", 9).cerca);
  c("anche a inizio messaggio", "an", ap("@an", 3).cerca);

  //  ⚠️ UNO SPAZIO CHIUDE IL TAG. Senza, l'elenco resta aperto per tutto il
  //   resto del messaggio e copre la conversazione.
  c("dopo uno spazio si chiude", null, ap("ciao @mario come stai", 21));
  c("e anche a capo", null, ap("ciao @mario\nsecondo me", 22));

  //  ⚠️ LA CHIOCCIOLA DEVE COMINCIARE UNA PAROLA: in «mario@posta.it» non si
  //   sta citando nessuno, si sta scrivendo un indirizzo.
  c("un indirizzo non apre l'elenco", null, ap("scrivimi a mario@posta.it", 25));
  c("nemmeno a meta' parola", null, ap("ab@cd", 5));

  //  Il cursore PRIMA della chiocciola non apre niente.
  c("col cursore prima non e' aperto", null, ap("ciao @mario", 3));

  //  ── CHI VIENE PRIMA ───────────────────────────────────────────────────
  const gente = [{ nome: "Gianmaria" }, { nome: "Marco" }, { nome: "Marta" }, { nome: "Anna" }];
  //  ⚠️ Chi COMINCIA col pezzo scritto sta sopra chi lo contiene in mezzo:
  //   trovarsi in cima uno che non si cercava fa premere la persona sbagliata,
  //   cioe' mandare a un estraneo una risposta destinata a un altro.
  c("chi inizia cosi' viene prima", "Marco,Marta,Gianmaria", TG.trovaPersone(gente, "ma").map((p) => p.nome).join(","));
  c("il nome intero trova quello giusto", "Marco", TG.trovaPersone(gente, "marco").map((p) => p.nome).join(","));
  c("senza niente scritto si vedono tutti", 4, TG.trovaPersone(gente, "").length);
  c("e non piu' del massimo", 2, TG.trovaPersone(gente, "", 2).length);
  c("chi non c'e' non si trova", 0, TG.trovaPersone(gente, "zzz").length);

  //  ⚠️ Accenti e maiuscole non contano: nessuno scrive «@Nicolo'» con
  //   l'accento giusto mentre segue una diretta.
  const accenti = [{ nome: "Nicolò" }, { nome: "MARTA" }];
  c("l'accento non conta", "Nicolò", TG.trovaPersone(accenti, "nicolo").map((p) => p.nome).join(","));
  c("le maiuscole nemmeno", "MARTA", TG.trovaPersone(accenti, "mar").map((p) => p.nome).join(","));

  //  ── SCEGLIENDO DALL'ELENCO ────────────────────────────────────────────
  const testo = "ciao @mar";
  const scelto = TG.scegliPersona(testo, ap(testo, 9), "Marco");
  c("il nome sostituisce il pezzo scritto", "ciao @Marco ", scelto.testo);
  //  ⚠️ LO SPAZIO IN FONDO CI VUOLE: senza, la parola dopo si incolla al nome
  //   («@Marcociao») e il tag resta aperto, perche' manca proprio lo spazio
  //   che lo chiude.
  c("con lo spazio in fondo", true, scelto.testo.endsWith(" "));
  c("e il cursore sta dopo", 12, scelto.cursore);
  //  Scelto il nome, l'elenco DEVE essere chiuso.
  c("dopo la scelta l'elenco si chiude", null, ap(scelto.testo, scelto.cursore));

  //  Un nome con lo spazio dentro si scrive per intero.
  const due = TG.scegliPersona("ciao @an", ap("ciao @an", 8), "Anna Bianchi");
  c("un nome con lo spazio ci sta tutto", "ciao @Anna Bianchi ", due.testo);
  //  ⚠️ E in mezzo a un messaggio non mangia quello che viene dopo.
  const mezzo = TG.scegliPersona("ciao @mar come stai", { inizio: 5, cerca: "mar" }, "Marco");
  c("quello che viene dopo resta", "ciao @Marco  come stai", mezzo.testo);
}

/** ── DA QUANDO SI CONTA L'ATTESA ───────────────────────────────────────────
 *  «In attesa da 33 giorni» è la frase che decide chi sta in cima alla coda
 *  delle pose. Se conta dal giorno sbagliato, la coda mette davanti la persona
 *  sbagliata — e quella ferma da un mese resta in fondo.
 *  Qui si prova la REGOLA (`dataChiusura`), che è quella che `giorniDiAttesa`
 *  usa per scegliere il giorno da cui partire. */
function proveDellAttesa() {
  const q = (d) => KN.dataChiusura({ data: d });
  //  Il caso vero: consulenza il 1º luglio, acconto (stato → vinto) il 20
  //  luglio, saldo alla consegna il 30 agosto. L'attesa comincia il 20 luglio.
  c(
    "conta dall'acconto, non dalla consulenza",
    "2026-07-20",
    q({ createdAt: "2026-07-01", convertedAt: "2026-07-20", payment: { dataPagamento: "2026-08-30" } }),
  );
  //  ⚠️ IL SALDO NON DEVE VINCERE: arriva spesso alla consegna, cioè DOPO
  //   l'attesa che si vuole misurare. Contando da lì, le pratiche rimaste
  //   ferme di più darebbero zero giorni proprio quando il ritardo è massimo.
  c(
    "il saldo non sovrascrive l'acconto",
    "2026-07-20",
    q({ createdAt: "2026-01-01", convertedAt: "2026-07-20", payment: { dataPagamento: "2026-12-31" } }),
  );
  //  Schede vecchie senza `convertedAt`: si ripiega sul pagamento, che è
  //  comunque piu' vicino al vero dell'ingresso.
  c(
    "senza data di conversione vale il pagamento",
    "2026-08-30",
    q({ createdAt: "2026-01-01", payment: { dataPagamento: "2026-08-30" } }),
  );
  c("in mancanza di tutto resta l'ingresso", "2026-01-01", q({ createdAt: "2026-01-01" }));
}

/** ── CERCARE UN LEAD ───────────────────────────────────────────────────────
 *  La regola con cui si decide se una scheda risponde a quello che si scrive.
 *  Si rompe senza rumore — basta dimenticare un campo — e il guasto si
 *  manifesta come «questo cliente non esiste» davanti a un cliente che esiste. */
function proveDellaRicerca() {
  const cerca = (l, testo) => RL.trovaNelLead(l, RL.normalizza(testo).trim(), String(testo).replace(/\D/g, ""));
  const tizio = {
    data: {
      nome: "Nicolò", cognome: "D'Amico", telefono: "+39 333 12 34 567",
      email: "n.damico@esempio.it", citta: "Bari",
      note: "L'ha chiamato la sorella. Richiamare dopo le 18.",
      notePostCall: "Interessato al protocollo, valuta con la moglie",
      installazione: { noteInstallazione: "Citofono rotto, chiamare dal portone" },
      chiusura: { note: "Paga il resto alla consegna" },
    },
  };
  c("trova per cognome", true, cerca(tizio, "d'amico"));
  //  Senza questa, «Nicolo» scritto senza accento non troverebbe «Nicolò» —
  //  e nessuno scrive gli accenti in una casella di ricerca.
  c("trova senza accenti", true, cerca(tizio, "nicolo"));
  //  Il telefono si scrive in mille modi: la ricerca non deve pretendere
  //  quello giusto.
  c("trova per telefono scritto senza spazi", true, cerca(tizio, "3331234567"));
  c("trova per pezzo di telefono", true, cerca(tizio, "1234567"));
  //  ── LE NOTE, che sono il motivo per cui questa funzione esiste ──
  c("trova una parola nelle note", true, cerca(tizio, "sorella"));
  c("trova nelle note della consulenza", true, cerca(tizio, "moglie"));
  c("trova nelle note dell'installazione", true, cerca(tizio, "citofono"));
  c("trova nelle note dell'accordo", true, cerca(tizio, "alla consegna"));
  //  ── QUELLO CHE NON DEVE TROVARE ──
  c("non trova quello che non c'e'", false, cerca(tizio, "brindisi"));
  //  ⚠️ Sotto le tre cifre un numero sta dentro QUALUNQUE telefono: «12»
  //   restituirebbe mezzo archivio, ed e' il modo piu' veloce di far credere
  //   che la ricerca sia rotta.
  c("due cifre non pescano mezzo archivio", false, cerca(tizio, "12"));
  //  Una scheda vuota non deve far esplodere niente: nel database ci sono lead
  //  importati con quasi tutti i campi assenti.
  c("una scheda vuota non rompe", false, cerca({ data: {} }, "qualcosa"));
  c("un lead senza data non rompe", false, cerca({}, "qualcosa"));
  //  Casella vuota = si vede tutto, non zero risultati.
  c("senza testo passano tutti", true, cerca(tizio, ""));
}

/** ── IL NUMERO CHE VEDE LA SALA ────────────────────────────────────────────
 *  Una regola sola, ma è quella che decide cosa legge in cima allo schermo chi
 *  sta valutando se fidarsi. Due errori possibili e opposti: scrivere «0» al
 *  primo arrivato (che legge «non c'è nessuno, me compreso» e se ne va), e
 *  scrivere un numero che non è quello vero. Il secondo qui non è nemmeno
 *  rappresentabile — la funzione restituisce `presenti` o niente — e questa
 *  prova serve a tenerlo così. */
function proveDelContatore() {
  c("sala vuota: non si scrive niente", null, WB.numeroDaMostrare({ presenti: 0, sogliaVisibile: 0 }));
  c("primo arrivato: si comincia da 1", 1, WB.numeroDaMostrare({ presenti: 1, sogliaVisibile: 0 }));
  c("sotto la soglia si tace", null, WB.numeroDaMostrare({ presenti: 7, sogliaVisibile: 20 }));
  c("sopra la soglia esce il numero VERO", 40, WB.numeroDaMostrare({ presenti: 40, sogliaVisibile: 20 }));
  //  ⚠️ Il cuore della prova: qualunque sala, il numero mostrato o è quello
  //   reale o non c'è. Se un giorno qualcuno aggiungesse un "gonfiaggio", è
  //   questo controllo che si accende.
  const inventato = [0, 1, 5, 40, 500].some((p) => {
    const v = WB.numeroDaMostrare({ presenti: p, sogliaVisibile: 3 });
    return v !== null && v !== p;
  });
  c("il numero mostrato non e' mai diverso da quello reale", false, inventato);
}

await proveDelPdf();
proveDeiRegimi();
proveDelRitornoPosa();
proveDelleChiusure();
proveDeiCostiSpedizione();
proveDelConto();
proveDelleScadenze();
proveDellXml();
proveDellePratiche();
await provePacchetto();
proveDaSistemare();
proveDelleSpeseFisse();
proveDellF24();
proveDelleAutofatture();
proveDeiRegistri();
proveDelleRitenute();
await proveDelFoglio();
proveDelContatore();
proveDellaRicerca();
proveDellAttesa();
proveDelDaSaldare();
provePosaAggiunta();
proveDelDiario();
provePalco();
  proveDelRiquadro();
  proveDelDuello();
  proveDelPercorsoInOnda();
  proveDelleRegoleDellaChat();
  proveDelVestitoDelTasto();
  proveDelRitmo();
  proveDellaCameraBuia();
  proveDeiFotogrammi();
  proveDegliErroriMedia();
  proveDellaRegiaDelPalco();
  proveDelloStatoSulPalco();
  proveDeiMessaggiPerStato();
  proveDelleRigheDaFare();
  proveDelGestoPerStato();
  proveDellaClassifica();
  proveDeiCodici();
  proveDelListino();
  provePreselezione();
  proveDelCodiceDiretta();
  proveDegliErroriEsterni();
  proveDeiMuti();
  provePatchCutanea();
  proveDellaGaranzia();
  proveDelRestaInLista();
  proveDelModoFascia();
  proveDelQuandoPerStato();
  proveDelloScorrimento();
  provePersoneDelPannello();
  proveDoveSiConduce();
  proveDiChi();
  proveDellaStoriaDelRitorno();
  proveDeiMessaggiConNome();
  proveDellaRiapertura();
  proveDelLinkCheSegue();
  proveDellaCameraSuiLink();
  proveDellaBussata();
  proveDellaConsulenzaAperta();
  proveDiDoveSiAmmette();
  proveDellaGrigliaCamere();
  proveDellAperturaCamera();
  proveDellAccontoEGaranzia();
  proveDelleCondizioni();
  proveDelNumeroEDellaCausale();
  proveDellaRigaPulita();
  proveDellaRegistrazione();
  proveDiChiEAncoraDentro();
  proveDelleTrePorte();
  proveDiChiHaFissato();
  proveDelContaSuoni();
  proveDellaStanzaVuota();
  proveDelGiraCamera();
  proveDelLinkPerCiascuno();
  proveDelleMigrazioni();
  proveDelleSezioniDiCopia();
  proveDeiModiDiIncasso();
  proveDellAnteprimaCheDura();
  proveDeiLinkNeiMessaggi();
  proveDellaSalaAttesa();
  proveDelloSlot();
  proveDellaFascia();
  proveDeiPreventiviDiGruppo();
  proveDellaPrecedenza();
  proveDellaVersioneVecchia();
  proveDellaTela();
  proveDellaLentezza();
  proveDellaCopiaArchivio();
  proveDelMotore();
  proveDelPreventivoCitato();
  proveDelleRegistrazioni();
  proveDelDuplicato();
  proveDeiPezziMancanti();
  proveDelloSpostamento();
  proveDeiDoppioni();
  proveDellaRipesca();
  proveDelleChiamateCRM();
  proveDelRicarico();
  proveDellAttesaWhatsApp();
  proveDellElencoStabile();
  proveDellaNotaInBreve();
  proveDiChiSiTelefonaOggi();
  proveDelTelefonoDoppio();
  proveDellaSessioneConPin();
  proveDellaDurataDiSerie();
  proveDelVediDopo();
  proveDeiLeadDiMeta();
  proveDellAmbito();
  proveDellaModifica();
  proveDellaManutenzione();
  proveDegliOrariPresi();
  proveDellOraTenutaPerUnoSolo();
  proveDellaCapienza();
  proveDellaStanza();
  proveDellaSogliaVoce();
  proveDellaBanda();
  proveDellaDiagnosiLinea();
  proveDegliOspiti();
  proveDelloZoom();
  proveDellaBozza();
  proveDellaChiaveSessione();
  proveDellOratore();
  proveDelleMisureCamerina();
  provePagineDelCliente();
  provePaginaCondivisa();
  proveDellaCamerina();
  proveDeiRitocchi();
  proveDeiLaterali();
  proveDelComposto();
  proveDellaSomiglianza();
  proveDellAgendaDeiTask();
  proveDeiLavori();
  proveDellInterruttoreLavori();
  proveDeiGiaScritti();
  proveDelloSpecchio();
  provePacchetti();
  proveDellaProvaCapelli();
  proveDellaVersione();
  proveDellaMisura();
  proveDellIscrizione();
  proveDellaTracciaSola();
  proveDelModulo();
  proveDeiClicLiberi();
  proveDelCvrPerRisposta();
  proveDellaRicercaManutenzione();
proveDelleMenzioni();
proveDelTetris();
proveDelContoWebinar();
proveDelTag();
proveDeiTipi();
proveDelFoglioInstallazioni();
proveDelCodiceFiscale();
proveDelDivario();
proveDelloSconto();
proveDelCanale();
proveDelloStatoScelto();
proveDellaLetturaDocumento();
proveDelTipoProposto();
proveDelRitornoInBozza();
proveDelQuandoStato();
proveDellaListaImportata();
proveDeiPermessi();
proveDiTuttiIMessaggi();
proveDelMessaggioGiusto();
proveDelMessaggioDati();
proveDellaGriglia();
proveDellaRegiaPalco();
proveDellInvito();
proveDelTeleprompter();
proveDegliHook();
rmSync(dove, { recursive: true, force: true });

console.log("");
console.log(
  rotti ? `✖ ${rotti} controlli falliti su ${fatti}` : `✓ tutti i ${fatti} controlli passano`,
);
process.exit(rotti ? 1 : 0);
