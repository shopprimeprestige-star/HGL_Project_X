// ── COSA DICIAMO DI NOI, IN UN POSTO SOLO ───────────────────────────────────
//  Le stesse frasi servono a due lati diversi che nessuno guarda mai insieme:
//  la pagina pubblica dell'invito (/invito/<codice>, che il cliente apre dal
//  telefono) e il biglietto 1920×1080 che il consulente manda su WhatsApp.
//  Se i testi stessero in due file, fra un mese direbbero due cose diverse
//  sullo stesso prodotto — e il cliente li legge a due minuti di distanza,
//  perché il biglietto viaggia allegato al messaggio che contiene il link.
//
//  ⚠️ QUI DENTRO NON ENTRA NIENTE DI VARIABILE. Nome del cliente, giorno, ora,
//  consulente e durata reale dell'appuntamento vivono sul lead e passano da
//  src/crm/invito.ts. Questo file è quello che diciamo a chiunque, sempre
//  uguale: se una stringa qui dentro cambia da persona a persona, è nel file
//  sbagliato.
//
//  ⚠️ NESSUN NUMERO CHE NESSUNO PUÒ VERIFICARE. Non ci sono percentuali, non
//  c'è quanti clienti, non ci sono anni di attività, non c'è "garantito" e non
//  c'è nessuna promessa medica. Le differenze fra le tre soluzioni sono le sole
//  che si possono dire senza aprire una cartella clinica: se è un intervento o
//  no, quando si vede il risultato, se si può tornare indietro. Il resto lo
//  dice il consulente in videochiamata, guardando il caso.
//
//  Solo dati e tipi: niente React, niente JSX, niente funzioni. Chi disegna
//  (pagina o canvas) decide come renderli; questo file decide solo cosa dicono.
import { DURATA_PREDEFINITA } from "./invito";

// ── LE TRE SOLUZIONI ────────────────────────────────────────────────────────

/** Il concetto di icona, non il disegno. La pagina lo traduce in un'icona
 *  lucide, il biglietto in un tracciato Canvas fatto di archi e segmenti: due
 *  disegni diversi, la stessa idea, e nessuno dei due può cambiare argomento
 *  senza passare da qui.
 *
 *  ⚠️ Nessuna icona "medica". Un bisturi accanto al trapianto e un cerotto
 *  accanto alla patch trasformano un elenco rassicurante in un'ansia, ed è
 *  esattamente il contrario del mestiere di questo materiale. */
export type ConcettoIcona = "trapianto" | "patch" | "protocollo";

/** La sola differenza che vale la pena stampare in grande: se si entra in sala
 *  operatoria o no. È l'unica classificazione verificabile, ed è la prima
 *  domanda che si fa chi ci pensa da mesi.
 *
 *  ⚠️ La patch e il protocollo condividono la stessa categoria, ed è giusto
 *  così: non si inventa un'etichetta diversa per il prodotto di punta solo per
 *  distinguerlo. Lo distingue il nome, e lo distingue il colore con cui lo
 *  disegnano pagina e biglietto — non una parola su un asse diverso dagli
 *  altri due, che sarebbe una classifica travestita da categoria. */
export type CategoriaSoluzione = "CHIRURGICO" | "NON CHIRURGICO";

export interface Soluzione {
  /** Chiave stabile per il codice: non si mostra mai a nessuno. */
  chiave: "trapianto" | "patch" | "protocollo";
  /** Il nome per esteso, per la pagina e per qualunque riga di testo. */
  nome: string;
  /** Lo stesso nome già spezzato in due righe.
   *  ⚠️ Serve al biglietto, dove la Canvas non manda a capo niente da sola e
   *  le tre carte devono avere le linee di base allineate al pixel: se una
   *  carta scrivesse il nome su una riga e le altre su due, tutto quello che
   *  sta sotto scenderebbe di quaranta pixel solo in quella. La seconda riga
   *  può essere vuota, ma allora lo è per tutte e tre. */
  nomeRighe: readonly [string, string];
  categoria: CategoriaSoluzione;
  /** Una riga sola, in parole di tutti i giorni: cos'è, detto a chi non sa
   *  niente. Massimo una trentina di caratteri — è la misura che entra nella
   *  colonna del biglietto senza rimpicciolire il corpo. */
  sottotitolo: string;
  /** Due punti brevissimi, e sempre due.
   *  ⚠️ Sono due e non tre perché il biglietto ha spazio per due e la pagina
   *  deve dire le stesse cose del biglietto. Un terzo punto visibile solo su
   *  un lato è il primo passo verso i due testi che divergono. */
  punti: readonly [string, string];
  icona: ConcettoIcona;
}

/** L'ordine è quello della conversazione, non una classifica: si parte da
 *  quello che il cliente ha già in testa (il trapianto, l'unica parola che
 *  conosce), si passa dall'alternativa storica, e si arriva al nostro. Il terzo
 *  posto non è l'ultimo: è quello su cui si chiude, ed è il motivo per cui non
 *  ci sono numeri "01 02 03" da nessuna parte. */
export const SOLUZIONI: readonly Soluzione[] = [
  {
    chiave: "trapianto",
    nome: "Trapianto di capelli",
    nomeRighe: ["Trapianto", "di capelli"],
    categoria: "CHIRURGICO",
    //  "Si spostano i tuoi capelli" è la cosa vera che lo distingue da tutto il
    //  resto: non si aggiunge niente, si muove quello che c'è già. Detto così
    //  dice anche, senza spaventare, il limite che ha — si può spostare solo
    //  quello che c'è.
    //  ⚠️ Prima qui c'era «I tuoi capelli, dove mancano»: bella riga, ma è un
    //  RISULTATO promesso su un'immagine che resta in chat, e quanti capelli
    //  arrivino davvero dove mancano non lo sa nessuno prima di aver visto la
    //  testa. Il verbo descrive l'intervento; il sostantivo prometteva l'esito.
    sottotitolo: "Si spostano i tuoi capelli.",
    //  ⚠️ Il primo punto era «Un intervento, una volta sola», e non si può
    //  scrivere: una seconda seduta è normale — per la densità, o perché la
    //  calvizie intanto è andata avanti — e chi l'ha letto qui la vive come una
    //  promessa tradita. I due punti ora rispondono alle stesse due domande
    //  delle altre due carte, nello stesso ordine: QUANDO si vede, e SI PUÒ
    //  TORNARE INDIETRO. È l'unico modo perché tre carte affiancate si possano
    //  davvero confrontare invece di leggersi come tre etichette diverse.
    //  "Non si torna indietro" non è un difetto da nascondere: è la ragione per
    //  cui esistono le altre due, e chi la legge sceglie sapendo.
    punti: ["Il risultato cresce nei mesi", "Non si torna indietro"],
    icona: "trapianto",
  },
  {
    chiave: "patch",
    nome: "Patch cutanea",
    nomeRighe: ["Patch", "cutanea"],
    categoria: "NON CHIRURGICO",
    //  "Classica" fa un lavoro preciso: dice che esiste da sempre e che non è
    //  una trovata: chi ne ha sentito parlare male ha in mente questa, e
    //  chiamarla per nome è più onesto che darle un nome nuovo.
    //  ⚠️ "Tricologica" è sparita. Questa riga esiste per chi non sa niente, e
    //  chi non sa niente su quella parola si ferma: è la sola parola di mestiere
    //  che era rimasta in tutto il materiale.
    sottotitolo: "Protesi classica per capelli.",
    //  Le due facce della stessa medaglia, nello stesso ordine delle altre due
    //  carte: quando si vede, e si può tornare indietro. Subito, ma non per
    //  sempre — è la differenza vera con il trapianto.
    //  "Capelli" al posto di "densità": la densità è una misura, e una misura
    //  promessa il primo giorno è un numero che nessuno ha verificato.
    punti: ["Capelli già dal primo giorno", "Si toglie, e va mantenuta"],
    icona: "patch",
  },
  {
    chiave: "protocollo",
    nome: "Invisible Derm Protocol",
    nomeRighe: ["Invisible Derm", "Protocol"],
    categoria: "NON CHIRURGICO",
    //  "Della casa" diceva di chi è, non che cos'è. "Messo a punto da noi" dice
    //  la stessa appartenenza e in più spiega, senza scusarsi, perché di questo
    //  prodotto non si trovi niente scritto in giro: è nostro, non è un nome
    //  commerciale appiccicato a una tecnica che hanno tutti.
    sottotitolo: "Il metodo messo a punto da noi.",
    //  ⚠️ Il primo punto diceva «Nessun bordo a vista». "Nessun" è una garanzia
    //  di risultato — su una faccia, con una luce, a una distanza che qui nessuno
    //  conosce — ed è l'unica frase del materiale che il cliente può smentire da
    //  solo davanti allo specchio. "Studiato perché non si veda" dice la stessa
    //  cosa come INTENZIONE del metodo, che è quello che possiamo garantire
    //  davvero: come è pensato, non come verrà su di lui.
    //  ⚠️ Il secondo punto non è una scappatoia: del nostro protocollo non
    //  esiste nessun dato pubblicato che si possa stampare, e inventarne uno
    //  qui sarebbe l'unica bugia di tutto il materiale. "Te lo mostriamo in
    //  consulenza" è insieme la sola frase vera e la migliore ragione per
    //  presentarsi — il vuoto, qui, lavora a nostro favore.
    //
    //  ⚠️ QUELLO CHE QUESTA CARTA ANCORA NON DICE, E CHE LE ALTRE DUE DICONO:
    //  quando si vede il risultato e se si può tornare indietro. Non è una
    //  dimenticanza ed è l'unico buco rimasto nel confronto fra le tre: quei due
    //  fatti li sa solo chi il protocollo lo esegue, e scriverli qui a
    //  sentimento significherebbe inventare il prodotto di punta. Vanno chiesti
    //  al committente e messi qui — finché mancano, la terza carta incuriosisce
    //  ma non si lascia confrontare.
    punti: ["Studiato perché non si veda", "Te lo mostriamo in consulenza"],
    icona: "protocollo",
  },
];

// ── COME SI SVOLGE ──────────────────────────────────────────────────────────

export interface PassoConsulenza {
  /** 1…5. Sta nel dato e non nell'indice dell'array perché il numero si stampa,
   *  e un elenco riordinato per sbaglio non deve poter rinumerare i passi. */
  n: number;
  titolo: string;
  testo: string;
}

/** I passaggi nell'ordine in cui succedono. Non è un manuale: serve a togliere
 *  l'unica incertezza che resta dopo aver fissato, cioè "e adesso cosa
 *  succede". Chi non se lo sente dire immagina il peggio e rimanda, e rimandare
 *  vuol dire non presentarsi.
 *
 *  Il consenso a telecamera e microfono ha un passo suo (il secondo) e non una
 *  nota in fondo: "mi devo far vedere?" è una paura vera, e detta prima non fa
 *  più paura.
 *
 *  ⚠️ Il quarto passo — le foto e i video di clienti veri — è ANNUNCIATO qui e
 *  non mostrato da nessuna parte. Quelle immagini sono facce di persone vere,
 *  mostrate dentro la chiamata da un consulente, con il consenso dato per quel
 *  contesto: su una pagina pubblica o su un'immagine che si inoltra
 *  viaggerebbero da sole in chat che nessuno controlla. */
export const PASSI_CONSULENZA: readonly PassoConsulenza[] = [
  {
    n: 1,
    titolo: "Apri il link",
    testo: "Si apre nel browser come un sito qualsiasi, dal telefono o dal computer.",
  },
  {
    n: 2,
    titolo: "Dai il consenso a telecamera e microfono",
    testo: "Il dispositivo lo chiede una volta sola, all'ingresso: serve per vedervi e parlarvi.",
  },
  {
    n: 3,
    titolo: "Guardate insieme la tua situazione",
    //  "Con calma" da solo non diceva cosa succede. Qui si nomina il lavoro
    //  vero della chiamata — capire quale delle tre strade riguarda questa
    //  persona — perché è la sola risposta alla domanda che tiene qualcuno a
    //  metà fra il presentarsi e il non presentarsi: «sì, ma a me cosa
    //  diranno?».
    testo: "Con calma: com'è adesso, e quale delle tre strade ha senso per te.",
  },
  {
    n: 4,
    titolo: "Vedi foto e video di clienti veri",
    //  "Che hanno dato il permesso" non è una formalità legale infilata in una
    //  pagina di appuntamento: chi sta per mostrare la propria testa in
    //  videochiamata si sta chiedendo se finirà anche lui in un video mostrato a
    //  qualcun altro. Dire come sono arrivate quelle immagini risponde alla
    //  domanda senza che nessuno debba farla.
    testo: "Li guardate insieme durante la chiamata: sono clienti che hanno dato il permesso.",
  },
  {
    n: 5,
    titolo: "Esci con un preventivo su misura",
    //  ⚠️ La seconda frase è la stessa promessa di "senza impegno", scritta nel
    //  punto in cui la persona teme che salti: la fine della chiamata. Chi teme
    //  di doversi difendere da una firma non si presenta proprio. È anche la
    //  frase più impegnativa di tutto il materiale — vale quanto vale chi
    //  conduce la chiamata (vedi la nota su cosaE).
    testo: "Si compone voce per voce, sotto i tuoi occhi. Poi te lo porti via e ci pensi.",
  },
];

// ── I DUE NUMERI ────────────────────────────────────────────────────────────

/** Quanto dura una consulenza quando sul lead non c'è scritto niente.
 *  ⚠️ Non è un 45 nuovo: è lo stesso ripiego di src/crm/invito.ts, ripreso da
 *  qui perché chi scrive un testo ("dura circa quarantacinque minuti") non deve
 *  andarlo a cercare in un file che parla di date. Due 45 scritti a mano in due
 *  file diventano un 45 e un 30 il giorno che qualcuno ne cambia uno solo. */
export const DURATA_CONSULENZA_MINUTI: number = DURATA_PREDEFINITA;

/** La soglia d'ingresso, e l'unico prezzo che compare da qualche parte.
 *  Serve a dire una cosa sola — «ce n'è per tutte le tasche» — a chi dà per
 *  scontato che roba del genere costi diecimila euro e per questo non si
 *  presenta. Qualunque altro numero sarebbe un preventivo dato prima di aver
 *  visto il caso, cioè esattamente ciò che il quinto passo promette di NON
 *  fare: il materiale non può contraddire il proprio ultimo passo.
 *
 *  ⚠️ QUESTO NUMERO STA SOTTO TRE CARTE, UNA DELLE QUALI È UN INTERVENTO
 *  CHIRURGICO. Chi legge lo attacca alla carta che sta guardando, e nessuna
 *  riga qui dice a quale delle tre appartiene: se 389 è la soglia di UNA sola
 *  soluzione, chi è arrivato pensando al trapianto ha in mano un prezzo che
 *  nessuno gli ha promesso e lo scoprirà in chiamata — cioè nel momento
 *  peggiore. E se 389 fosse una rata e non un totale, la riga sarebbe
 *  direttamente falsa. Le due cose le sa solo il committente: finché non le
 *  dice, l'etichetta qui accanto («Si parte da») e la frase sul preventivo sono
 *  la sola difesa che questo materiale ha. */
export const PREZZO_DA_EURO: number = 389;

/** Lo stesso numero già scritto come va scritto. Esiste per non lasciare a chi
 *  disegna la scelta fra «389 €», «€ 389» e «389€»: su una pagina e su
 *  un'immagine affiancate nella stessa chat, tre forme diverse dello stesso
 *  prezzo si notano. */
export const PREZZO_DA_TESTO: string = "389 €";

// ── LE FRASI FISSE ──────────────────────────────────────────────────────────

export interface FrasiConsulenza {
  /** Il titolo del biglietto: quattro parole che dicono che dall'altra parte
   *  non c'è qualcuno con un solo prodotto da piazzare. Il punto fermo è
   *  voluto — è una constatazione, non uno slogan. */
  titoloBiglietto: string;
  /** Il cappello sopra l'elenco delle soluzioni, sulla pagina. */
  titoloSoluzioni: string;
  /** Il cappello sopra i passaggi, sulla pagina. Parola per parola quello che
   *  la pagina scrive già oggi: si cambia qui, non lì. */
  titoloPassi: string;
  /** Cosa è la consulenza, in una riga. "Gratuita" e "senza impegno" sono le
   *  due parole che tolgono il sospetto di trovarsi dentro una vendita.
   *  ⚠️ Sono anche le due parole che l'azienda deve mantenere in chiamata: se
   *  al minuto quaranta si chiede una firma, questa riga diventa la bugia più
   *  cara del materiale, perché è quella su cui la persona si è fidata per
   *  presentarsi. Non è una scelta di scrittura: è una regola per chi conduce. */
  cosaE: string;
  /** Come finisce, e soprattutto che il prezzo vero non è quello stampato qui.
   *  ⚠️ Deve reggere DA SOLA. Sulla pagina segue la soglia («Si parte da 389 €.
   *  Il prezzo esatto…») e si legge come una precisazione; sul biglietto sta in
   *  testa, a mezzo metro dal prezzo che sta in fondo, e nessuno le legge
   *  insieme. Una frase che cominci con «Dipende» lì non ha soggetto. */
  preventivoSuMisura: string;
  /** L'etichetta davanti al prezzo di partenza.
   *  ⚠️ «Prezzi da» è un modo di dire da vetrina, e in vetrina il numero più
   *  basso è comunque un numero che si paga. «Si parte da» dice che quello è
   *  l'inizio di una salita, che è la verità: sopra c'è dell'altro, e il
   *  materiale non deve far finta di no. */
  prezzoDa: string;
  /** La domanda che si fanno tutti, e la risposta.
   *  ⚠️ È parola per parola la frase della pagina e la prima riga del messaggio
   *  WhatsApp che accompagna il link: chi riceve il biglietto la legge tre
   *  volte identica, e la terza volta ci crede. Non si riscrive "meglio". */
  nienteDaScaricare: string;
  /** La stessa cosa in tre parole, per quando lo spazio è quello che è (una
   *  riga di dettagli su un'immagine). */
  nienteDaScaricareBreve: string;
  /** Dove ci si collega. Toglie l'ultima scusa tecnica. */
  dove: string;
  /** L'invito a disdire per tempo, versione lunga: la pagina ha spazio.
   *  ⚠️ È scritto come un favore che si chiede, non come una regola con una
   *  penale. Chi non può esserci e teme la sfuriata semplicemente sparisce, e
   *  uno slot bruciato in silenzio costa più di uno spostato in tempo. Nessuna
   *  penale, nessun termine di ore: dare un numero ("entro 24 ore") sarebbe una
   *  condizione che nessuno ha mai concordato con il cliente.
   *
   *  ⚠️ E DEVE DIRE DOVE SI SCRIVE. «Avvisa il tuo consulente» su una pagina che
   *  del consulente mostra il solo nome — niente numero, niente tasto, e per
   *  scelta: DatiInvito non porta contatti (vedi invito.ts) — è un invito a fare
   *  una cosa che da lì non si può fare. L'unico canale che esiste di sicuro è
   *  quello da cui il link è arrivato: la persona ha quel messaggio in mano, e
   *  rispondere le costa un tocco. Finché non c'è un tasto per scrivere, quella
   *  frase è il modo per disdire, e va detta con le parole di un'azione, non di
   *  un principio.
   *
   *  ⚠️ E deve nominare anche l'ANNULLARE, non solo lo spostare. Chi ha cambiato
   *  idea e legge solo «si sposta» capisce che dovrà discutere una data che non
   *  vuole, e allora non scrive niente: è il no-show che nessuno vede arrivare.
   *  Un annullamento detto per tempo libera l'ora; un silenzio no. */
  disdettaEstesa: string;
  /** La stessa richiesta in una riga sola, per il biglietto.
   *  ⚠️ Qui "questo messaggio" è quello a cui il biglietto è allegato: l'immagine
   *  viaggia dentro la chat, e il gesto da chiedere è quello che si può fare
   *  senza uscire dalla schermata in cui la si sta guardando. */
  disdettaBreve: string;
  /** Cosa succede a un certo punto della chiamata. Annunciato, mai mostrato:
   *  vedi il commento a PASSI_CONSULENZA. */
  fotoClientiVeri: string;
}

export const FRASI: FrasiConsulenza = {
  titoloBiglietto: "Tre soluzioni, non una.",
  titoloSoluzioni: "Di cosa parliamo",
  titoloPassi: "Come si svolge",
  cosaE: "Videoconsulenza gratuita, senza impegno.",
  //  ⚠️ Diceva «Il prezzo esatto è nel preventivo su misura»: una frase che
  //  parla del prezzo prima ancora di aver detto che un preventivo esiste, e
  //  che al lettore chiede di ricostruire da sé quando lo riceverà. Questa
  //  dice le tre cose nell'ordine in cui servono — QUANDO, CHE COSA, PER CHI —
  //  in sei parole: a fine consulenza, un preventivo, tuo.
  preventivoSuMisura: "A fine consulenza ricevi il tuo preventivo su misura.",
  prezzoDa: "Si parte da",
  nienteDaScaricare: "Non serve scaricare nessuna applicazione.",
  nienteDaScaricareBreve: "Niente da scaricare",
  dove: "Dal telefono o dal computer, dove preferisci",
  disdettaEstesa:
    "Se non riesci a esserci, rispondi al messaggio con cui ti è arrivato questo link: lo spostiamo, o lo annulliamo se preferisci. Basta dirlo.",
  disdettaBreve: "Non puoi? Rispondi a questo messaggio.",
  fotoClientiVeri: "Foto e video di clienti veri",
};
