/** ── IL WEBINAR — TIPI E CONFIGURAZIONE ─────────────────────────────────────
 *
 *  IL WEBINAR NON È UNA CONSULENZA CON PIÙ POSTI A SEDERE.
 *  La videoconsulenza di Meetly (`shop/call.tsx`) collega tutti con tutti:
 *  ognuno apre una connessione verso ogni altro e ci manda il proprio video.
 *  A due persone è la scelta giusta — nessun server in mezzo, nessun costo al
 *  minuto, latenza minima. A duecento è aritmeticamente impossibile: ciascuno
 *  dovrebbe caricare 199 copie del proprio video, ~200 Mbps in salita, con un
 *  codificatore per connessione. Non è "lento": è due ordini di grandezza
 *  fuori portata, e nessun server più grosso lo aggiusta, perché quel traffico
 *  dal server non passa nemmeno.
 *
 *  Qui la forma è un'altra: UNO PARLA, TANTI GUARDANO. Il presentatore carica
 *  il video una volta sola verso l'SFU di Cloudflare, che lo replica a tutti.
 *  Gli spettatori non aprono la camera — non gliela chiediamo nemmeno, ed è
 *  già un pezzo di conversione: cinquecento persone a cui il browser chiede
 *  «vuoi condividere camera e microfono?» sono cinquecento occasioni di
 *  chiudere la scheda.
 *
 *  ── PERCHÉ QUESTA CARTELLA NON TOCCA `shop/call.tsx` ──────────────────────
 *  Meetly funziona, ci passano le consulenze che pagano l'azienda, ed è stato
 *  sistemato una decina di volte su casi reali (schermo nero, glare delle
 *  offerte, cuffie bluetooth che ammutoliscono la traccia, sfocatura che
 *  riscala verso l'alto). Riscriverlo per fargli reggere anche i webinar
 *  vorrebbe dire rimettere in gioco tutte quelle correzioni per una funzione
 *  che con le consulenze non c'entra niente.
 *  Quindi: codice nuovo, cartella nuova, rotte nuove. Meetly resta
 *  esattamente com'è, riga per riga.
 *
 *  ── E SE IL NUOVO NON VA? ─────────────────────────────────────────────────
 *  C'è l'interruttore: `trasporto: "meetly"` fa aprire al pulsante «Avvia
 *  webinar» una normale stanza Meetly, cioè la tecnologia di sempre. Regge
 *  poche persone, ma è quella che sappiamo funzionare, ed è a un clic di
 *  distanza nelle impostazioni senza che nessuno debba pubblicare niente.
 */

/** Quale tecnologia usa il pulsante «Avvia webinar».
 *  · `sfu`    — Cloudflare Realtime: uno carica, il server replica. Centinaia
 *               di spettatori, sotto il secondo di latenza.
 *  · `meetly` — la stanza di sempre, quella delle consulenze. Tutti con tutti:
 *               oltre le 6-8 persone si pianta, ma è la via già collaudata. */
export type TrasportoWebinar = "sfu" | "meetly";

/** Cosa c'è sullo schermo di chi guarda. Vedi la nota su `vista`. */
export type VistaWebinar = "contenuti" | "camera" | "salotto";

/** Chi va in onda, e come. Vedi la nota su `regia` in `DirettaWebinar`. */
export interface RegiaPalco {
  /** ── NASCONDI CHI NON PARLA ─────────────────────────────────────────────
   *  Acceso, nella fascia dei relatori restano solo quelli che hanno la voce.
   *  ⚠️ Se non parla nessuno si vedono TUTTI: vedi `chiSiVede`. Senza quella
   *   regola lo schermo diventerebbe nero a ogni respiro fra una frase e
   *   l'altra. */
  soloChiParla?: boolean;
  /** ⚠️ Chi sta grande. `"io"` = il presentatore; altrimenti l'identificativo
   *  di chi è sul palco. Assente = nessuno in primo piano, tutti alla pari. */
  primoPiano?: string;
  /** ⚠️ Chi si vede, in ordine. ASSENTE (non vuoto!) = si vedono tutti quelli
   *  sul palco: è il caso normale, e va distinto da «ho scelto di non
   *  mostrare nessuno», che è una scelta legittima e diversa.
   *  Contiene `"io"` per il presentatore. */
  mostrati?: string[];
  /** ── SI PUÒ CHIEDERE LA PAROLA? ─────────────────────────────────────────
   *  Lo decide chi conduce, dalla console, e vale per tutta la sala.
   *
   *  ⚠️ ASSENTE = CHIUSO, ed è voluto. Una diretta comincia con una persona che
   *   parla e duecento che ascoltano: se le mani fossero aperte dal primo
   *   minuto, chi conduce si troverebbe la fila piena mentre sta ancora facendo
   *   l'introduzione, e dovrebbe dire di no a gente che aveva solo seguito un
   *   pulsante acceso. Dire «non ancora» a qualcuno che si era fatto avanti
   *   costa più che non avergli mai aperto la porta.
   *
   *  ⚠️ E CHIUSO NON VUOL DIRE NASCOSTO. Il tasto per partecipare resta a
   *   schermo anche adesso: sparire e ricomparire fa perdere il momento a chi
   *   stava per premerlo, e soprattutto toglie l'unica informazione che serve
   *   davvero a chi guarda — che quel momento arriverà. Chiuso, il tasto dice
   *   che non è ancora ora; aperto, si accende. */
  maniAperte?: boolean;
  /** ── IL FACCIA A FACCIA ─────────────────────────────────────────────────
   *  L'identificativo della persona da mettere alla pari con chi conduce: due
   *  quadrati uguali, grandi, in cima allo schermo di tutti. Serve al
   *  dibattito — chi conduce e chi gli risponde — e la forma la spiega
   *  `duello` in `webinar/palco-tetris`.
   *
   *  ⚠️ È DIVERSO DA `primoPiano`, e i due non vanno confusi: il primo piano
   *   dice «guardate soprattutto questo», e chi conduce resta comunque il
   *   riquadro maggiore. Il faccia a faccia dice «questi due sono alla pari»,
   *   e la parità è tutta la ragione per cui esiste: in un dibattito il
   *   riquadro più piccolo ha già perso, prima ancora di parlare.
   *
   *  ⚠️ ASSENTE = nessun dibattito, non «dibattito con nessuno». Chi lo legge
   *   deve anche controllare che quella persona sia DAVVERO ancora sul palco:
   *   chi esce mentre è in faccia a faccia lascerebbe metà schermo a un
   *   quadrato nero. */
  facciaAFaccia?: string;
}

/** Chi va davvero in onda, date la regia e chi c'è sul palco.
 *  ⚠️ REGOLA IN UN POSTO SOLO, usata dalla console E dalla sala: se la console
 *   calcolasse la sua e la sala la sua, il presentatore vedrebbe un montaggio
 *   e la sala un altro — e se ne accorgerebbe solo riguardando la
 *   registrazione. */
export function chiVaInOnda(
  regia: RegiaPalco | undefined,
  suPalco: string[],
): { elenco: string[]; primoPiano: string | null } {
  //  Il presentatore c'è sempre: è lui che conduce, e una regia che lo lascia
  //  fuori dallo schermo è una sala che non sa più chi sta parlando.
  const tutti = ["io", ...suPalco];
  const scelti = regia?.mostrati;
  const elenco = Array.isArray(scelti)
    //  Si filtra su chi è DAVVERO sul palco: uno sceso mentre era in onda non
    //  deve restare come riquadro nero.
    ? scelti.filter((k) => tutti.includes(k))
    : tutti;
  //  Se non c'è nessuno, si torna al presentatore invece di uno schermo vuoto.
  const finale = elenco.length ? elenco : ["io"];
  const pp = regia?.primoPiano && finale.includes(regia.primoPiano) ? regia.primoPiano : null;
  return { elenco: finale, primoPiano: pp };
}

/** Quello che il browser può sapere: nessun segreto qui dentro. */
export interface StatoConfigWebinar {
  trasporto: TrasportoWebinar;
  /** le credenziali Cloudflare ci sono e sono complete */
  pronto: boolean;
  /** manda tre qualità invece di una (vedi `LIVELLI`) */
  simulcast: boolean;
}

/** Quello che sta sul server, e che di qui non esce mai. */
export interface ConfigWebinar extends StatoConfigWebinar {
  appId: string;
  /** ⚠️ NON DEVE MAI FINIRE IN UNA RISPOSTA HTTP. Chi ce l'ha può creare
   *  sessioni sul tuo account e consumarti la banda. Sta solo qui e nelle
   *  chiamate da server a server. */
  appSecret: string;
}

export const CONFIG_PREDEFINITA: ConfigWebinar = {
  trasporto: "sfu",
  pronto: false,
  simulcast: true,
  appId: "",
  appSecret: "",
};

/** ── LE TRE QUALITÀ CHE PARTONO INSIEME ────────────────────────────────────
 *  In mesh questo non serviva: ogni connessione ha la sua stima di banda e il
 *  suo codificatore, quindi chi ha la linea scarsa riceve già meno degli altri
 *  senza che nessuno faccia niente. Con l'SFU quella misura sparisce — mandi
 *  un flusso, il server lo gira uguale a tutti — e chi è in 4G o si becca un
 *  video che non regge, o resta indietro.
 *  Con la simulcast ne parti tre in una volta e il server sceglie per ciascuno.
 *
 *  ⚠️ I NOMI NON SONO A CASO. Cloudflare ordina le qualità in `asciibetical`,
 *  dove «a» è la più alta: chiamarle a/b/c fa sì che, quando la qualità
 *  preferita non è disponibile, il server ripieghi verso il basso e non verso
 *  l'alto.
 *  ⚠️ E VANNO DICHIARATE ALLA NASCITA del transceiver: `setParameters` non può
 *  aggiungerle dopo. `replaceTrack` invece le conserva, quindi cambiare camera
 *  o passare allo schermo non le perde. */
export const LIVELLI: RTCRtpEncodingParameters[] = [
  { rid: "a", scaleResolutionDownBy: 1, maxBitrate: 1_500_000 }, // ~720p
  { rid: "b", scaleResolutionDownBy: 2, maxBitrate: 500_000 },   // ~360p
  { rid: "c", scaleResolutionDownBy: 4, maxBitrate: 150_000 },   // ~180p
];

/** Una stanza da webinar. Sta in `app_config` sotto `webinar:<codice>`. */
export interface StanzaWebinar {
  codice: string;
  titolo: string;
  /** ── IL NUMERO A CUI SCRIVERE QUANDO LA DIRETTA È FINITA ────────────────
   *  ⚠️ STA SULLA STANZA E NON SULLA DIRETTA, ed è la ragione per cui esiste:
   *   la schermata che lo mostra compare QUANDO LA DIRETTA È FINITA, e in quel
   *   momento `diretta` è già null. Messo lì, il numero sparirebbe proprio
   *   nell'istante in cui serve.
   *  ⚠️ E NON È `ConsultantData.telefono`. Quello è il numero interno di una
   *   persona; questo lo si sceglie apposta per essere letto da duecento
   *   sconosciuti. Mostrare per sbaglio il proprio numero personale a una sala
   *   piena è un errore che non si ritira, e l'unico modo di non farlo è non
   *   riusare un campo nato per un'altra cosa.
   *  Il valore predefinito arriva dalla scheda del presentatore e viene
   *  copiato qui quando si va in onda: così vale per tutte le sue dirette
   *  senza doverlo riscrivere ogni volta. */
  whatsapp?: string;
  /** ── QUANDO COMINCIA ────────────────────────────────────────────────────
   *  ISO. Si sceglie creando la sala, e serve a una cosa sola ma importante:
   *  la sala d'attesa smette di essere una schermata muta e diventa un conto
   *  alla rovescia.
   *  ⚠️ ASSENTE È LEGITTIMO, e non va trattato come un errore: si può aprire
   *   una sala e partire subito. In quel caso la sala d'attesa resta quella
   *   semplice — meglio nessun conto che un conto inventato, perché un orario
   *   sbagliato a schermo fa andare via chi sarebbe rimasto.
   *  ⚠️ E NON FA PARTIRE NIENTE DA SOLO: è un'attesa dichiarata, non una
   *   sveglia. La diretta comincia quando il relatore preme «vai in onda», e
   *   se ha dieci minuti di ritardo la sala lo aspetta invece di dire che è
   *   cominciata — vedi `quantoManca`, che quando l'ora è passata non conta
   *   all'insù. */
  inizioPrevisto?: string;
  /** ── IL TEMPLATE CON CUI PARTE IL PROMEMORIA ────────────────────────────
   *  Il nome di un template WhatsApp già approvato da Meta.
   *  ⚠️ SENZA, IL PROMEMORIA NON PARTE QUASI MAI, e non è un dettaglio di
   *   configurazione: Meta accetta un messaggio scritto a mano solo verso chi
   *   ha scritto per primo nelle ultime 24 ore. Chi si iscrive da una pagina
   *   web non ha mai scritto a nessuno — cioè proprio le persone a cui questo
   *   promemoria esiste per arrivare vengono rifiutate una per una.
   *  ⚠️ Il template deve avere tre variabili, in quest'ordine: {{1}} il nome
   *   di chi lo riceve, {{2}} il titolo del webinar, {{3}} il link. Se ne ha
   *   un numero diverso Meta rifiuta l'invio: è il motivo per cui il tasto
   *   riporta anche i falliti invece di dire «fatto».
   *  Vuoto è legittimo: si torna al messaggio scritto a mano, che funziona per
   *  chi ha già una conversazione aperta con lo studio. */
  templatePromemoria?: string;
  /** ── CHE NUMERO VEDE LA SALA ────────────────────────────────────────────
   *  · `adesso`  — quante persone ci sono in questo momento;
   *  · `totale`  — quante ci sono PASSATE dall'inizio. È il numero più grande
   *    dei due, quasi sempre di parecchio: in una diretta la gente entra ed
   *    esce, e chi è arrivato al minuto dieci e uscito al venti ha comunque
   *    seguito. Dice una cosa diversa da «adesso», e la dice per intero;
   *  · `niente`  — non si mostra nessun numero.
   *
   *  ⚠️ TUTTI E DUE I NUMERI SONO VERI, ed è l'unica ragione per cui esiste
   *   questa scelta invece di un campo dove scriverlo a mano. Un contatore
   *   inventato — o vero ma fatto oscillare — è un dato falso mostrato a
   *   persone che stanno decidendo se spendere: chi se ne accorge (e qualcuno
   *   se ne accorge sempre: il numero balla mentre la chat resta deserta) non
   *   pensa «bel webinar», pensa «mi stanno raccontando balle» proprio mentre
   *   gli si chiede di fidarsi per una cosa che gli tocca il corpo. E in
   *   Italia è una pratica commerciale scorretta, non un'opinione di stile.
   *  Assente = `adesso`, che è il comportamento di sempre. */
  contatore?: "adesso" | "totale" | "iscritti" | "niente";
  /** ── QUANTI SI SONO ISCRITTI ────────────────────────────────────────────
   *  Lo scrive chi conduce, perché è l'unico che lo sa: le iscrizioni si
   *  raccolgono fuori di qui — un modulo, una campagna, una lista — e la sala
   *  non ha modo di contarle.
   *
   *  ⚠️ E VIENE MOSTRATO COME «ISCRITTI», mai come «in sala adesso».
   *   Il committente ha chiesto un contatore impostato a mano che oscillasse
   *   dentro un intervallo, per far sembrare piena la sala. Quello no: è un
   *   numero falso letto da persone che stanno decidendo se spendere per una
   *   cosa che gli tocca il corpo.
   *   Questo invece è un numero VERO che il programma non può sapere, detto per
   *   quello che è. Se chi lo scrive ci mette una cifra a caso la responsabilità
   *   è sua e non del programma — ma la parola accanto continuerà a dire
   *   «iscritti», non «collegati adesso», e nessuno leggerà una cosa diversa da
   *   quella che c'è scritto. */
  iscritti?: number;
  creataIl: string;
  /** sotto questo numero di presenti, agli spettatori non si mostra nessun
   *  numero. Vedi `numeroDaMostrare`. */
  sogliaVisibile: number;
  /** ── CHI PUÒ CONDURLA ───────────────────────────────────────────────────
   *  Gli identificativi dei consulenti scelti quando la sala è stata creata.
   *  ⚠️ VUOTO O ASSENTE = TUTTI, e non «nessuno»: le sale create prima che
   *   questa scelta esistesse non devono sparire dalla postazione di chi le
   *   conduceva da sempre. Un elenco pieno invece è una porta: chi non è
   *   dentro non vede nemmeno la sala. */
  presentatori?: string[];
  /** ── CHI NON PUÒ PIÙ ENTRARE ────────────────────────────────────────────
   *  Sta sulla STANZA e non sulla diretta: bandire qualcuno deve valere anche
   *  alla replica di giovedì prossimo. Se stesse sulla diretta, chiudere e
   *  riaprire lo rimetterebbe dentro — e il primo a scoprirlo sarebbe lui. */
  banditi?: string[];
  /** chi la sta trasmettendo adesso; `null` = non è ancora cominciato */
  diretta: DirettaWebinar | null;
}

/** ── UN RELATORE IN ONDA ───────────────────────────────────────────────────
 *  Un webinar può avere più di una voce: il titolare e il consulente, il medico
 *  e chi vende. Ognuno pubblica per conto suo e ognuno ha le sue tracce.
 *
 *  ⚠️ LA CHIAVE È L'IDENTIFICATIVO DEL CONSULENTE, non la sessione: se uno
 *   perde la linea e rientra, la sessione cambia ma la persona no — e senza
 *   una chiave stabile comparirebbe due volte, una delle quali muta per
 *   sempre. */
export interface RelatoreInOnda {
  id: string;
  nome: string;
  sessionId: string;
  tracciaAudio: string;
  tracciaVideo: string;
  /** sta parlando adesso: fa allargare il suo riquadro */
  parla?: boolean;
  /** ── LA CAMERA È ACCESA? ─────────────────────────────────────────────────
   *  ⚠️ SENZA QUESTO CAMPO UNA CAMERA SPENTA È INDISTINGUIBILE DA UN GUASTO.
   *   Spegnere la camera si fa con `enabled = false` (e va bene così: `stop()`
   *   libererebbe il dispositivo e per riaccenderlo il browser richiederebbe il
   *   permesso in mezzo a una diretta). Ma per chi guarda `enabled = false` non
   *   è «niente»: sono FOTOGRAMMI NERI, che arrivano regolarmente e riempiono
   *   lo schermo. Identici a un video rotto.
   *   È il motivo per cui «si vede tutto nero» è stato segnalato tre volte
   *   senza che nessuno potesse dire se fosse un guasto o una camera spenta.
   *  ⚠️ Assente = ACCESA, non spenta: le sale già aperte quando questo campo
   *   non esisteva non devono di colpo dire a tutti che il relatore è al buio. */
  camera?: boolean;
  battitoIl: string;
}

/** I riferimenti che servono a uno spettatore per agganciarsi al presentatore.
 *  Non sono segreti (Cloudflare dice che gli id di sessione e traccia possono
 *  essere pubblici), ma valgono solo finché la diretta è viva: alla chiusura
 *  vengono azzerati, e l'SFU li raccoglie da sé dopo 30 secondi di silenzio. */
export interface DirettaWebinar {
  /** ── ⚠️ TUTTI QUELLI IN ONDA ────────────────────────────────────────────
   *  I campi `sessionId`/`tracciaAudio`/`tracciaVideo` qui sotto restano e
   *  valgono per il PRIMO relatore: c'erano prima che i webinar potessero
   *  averne più d'uno, e ci sono ancora sale e schede aperte che li leggono.
   *  Toglierli avrebbe voluto dire far sparire il video a chi è già collegato
   *  nell'istante del rilascio. Qui c'è l'elenco vero. */
  relatori?: RelatoreInOnda[];
  sessionId: string;
  /** quando è cominciata: è l'orologio da cui si contano i minuti dei messaggi
   *  programmati. Senza, «al minuto 12» non vuol dire niente. */
  iniziataIl: string;
  tracciaVideo: string;
  tracciaAudio: string;
  /** ⚠️ NON È UN DETTAGLIO TECNICO, è un obbligo: chi entra in una sala che
   *  viene registrata deve saperlo PRIMA di parlare, e chi sale sul palco
   *  ancora di più — sta mettendo la propria voce e la propria faccia in un
   *  file che resterà. Da questo campo nasce la scritta in sala. */
  registrando?: boolean;
  /** ── CHE COSA VEDONO ADESSO ─────────────────────────────────────────────
   *  · `contenuti` — seguono le tue pagine: slide, preventivo, media, link.
   *    È la modalità in cui si vende: la faccia resta in un angolo, il posto
   *    grande ce l'ha la cosa di cui stai parlando.
   *  · `camera`    — solo te, grande. Per l'apertura, la chiusura, le storie.
   *  · `salotto`   — te più chi è salito sul palco, alla pari. È il momento
   *    delle domande, e in quel momento la griglia dice «qui si parla in
   *    tanti» meglio di qualunque frase.
   *  ⚠️ Viaggia dentro lo stato della sala, cioè su HTTP con una cache di
   *   pochi secondi — NON sul canale in tempo reale. Cinquecento persone su
   *   quel canale sono lo stesso muro per cui il video non poteva restare in
   *   mesh. Il prezzo è che il cambio si vede con qualche secondo di ritardo;
   *   il guadagno è che si vede a tutti. */
  vista?: VistaWebinar;
  /** la pagina che gli spettatori devono seguire in modalità `contenuti` */
  percorso?: string;
  /** ── DENTRO QUELLA PAGINA, DOVE ────────────────────────────────────────
   *  Quale slide, quale foto, dove si è scorso. Vedere «la pagina delle
   *  slide» non basta: senza questo, la sala guarda la slide 1 mentre tu
   *  parli della 6 — e nessuno te lo dice, perché da fuori sembra solo che
   *  tu stia parlando di cose scollegate da quello che si vede. */
  contenuti?: Record<string, unknown>;
  /** ── LA REGIA DEL PALCO ─────────────────────────────────────────────────
   *  Chi è sul palco può parlare; chi è IN ONDA è chi si vede. Le due cose
   *  coincidono finché non decidi diversamente, ed è il caso normale.
   *  Servono a separarsi nel momento che conta: uno fa una domanda buona e
   *  vuoi lui e te a tutto schermo, senza gli altri tre a guardare. Oppure il
   *  contrario: tenete la parola in tre e il quarto resta collegato ma fuori
   *  campo.
   *  È quello che gli streamer fanno con due programmi appoggiati l'uno
   *  all'altro; qui è un pulsante. */
  regia?: RegiaPalco;
  /** serve a capire se la diretta è morta senza che nessuno l'abbia chiusa */
  battitoIl: string;
}

/** Oltre questo silenzio la diretta si considera finita anche se nessuno ha
 *  premuto «Termina»: la scheda del presentatore può essere stata chiusa di
 *  colpo, e uno spettatore che arriva dopo non deve vedere «in onda» una
 *  stanza vuota. Tre battiti persi. */
export const SCADENZA_BATTITO_MS = 45_000;
export const BATTITO_MS = 15_000;

/** Il link che si manda agli iscritti. */
export const percorsoWebinar = (codice: string) => `/webinar/${encodeURIComponent(codice)}`;

// ══════════════════════════════════════════════════════════════════════════
//  LA SALA: CHI C'È, CHI SCRIVE, CHI PARLA
// ══════════════════════════════════════════════════════════════════════════

/** Chi ha scritto un messaggio. Decide colore e distintivo nella lista. */
export type RuoloInChat = "presentatore" | "palco" | "ospite";

export interface MessaggioChat {
  id: string;
  /** ⚠️ SOLO NELLA RISPOSTA AL PRESENTATORE. Nella sala pubblica questo campo
   *  non c'è: serve alla regia per far salire chi ha scritto, e agli spettatori
   *  non serve a niente se non a sapere chi è chi. */
  spettatoreId?: string;
  autore: string;
  ruolo: RuoloInChat;
  testo: string;
  fissato: boolean;
  creatoIl: string;
}

/** Lo stato di una persona rispetto al palco.
 *  · `attesa` — ha alzato la mano, il presentatore non ha ancora deciso
 *  · `audio`  — sta parlando, si sente e basta
 *  · `video`  — sta parlando e si vede */
export type StatoPalco = "attesa" | "audio" | "video";

export interface InPalco {
  spettatore: string;
  nome: string;
  stato: StatoPalco;
  /** aperto o chiuso: lo comanda il presentatore */
  microfono: boolean;
  /** sta parlando ADESSO — è quello che fa illuminare l'icona */
  parla: boolean;
  /** i riferimenti per sentirlo e vederlo; ci sono solo quando è già salito */
  sessionId?: string;
  tracciaAudio?: string;
  tracciaVideo?: string;
}

/** Un messaggio che parte da solo al minuto stabilito della diretta.
 *
 *  ⚠️ È UN MESSAGGIO DELLO STUDIO, E SI VEDE CHE LO È.
 *  Il nome dell'autore non è configurabile: quando parte gli viene messo il
 *  nome del presentatore e il distintivo del presentatore, come qualunque
 *  altra cosa scritta da chi conduce.
 *  Non è una limitazione tecnica, è la differenza fra automatizzare il proprio
 *  lavoro e fabbricare pubblico. Una finta spettatrice che al minuto 12 scrive
 *  «io l'ho fatto e sono felicissima» è una testimonianza inventata: dal 2023
 *  (D.Lgs. 26/2023, direttiva Omnibus) sta nella lista nera delle pratiche
 *  sempre scorrette, e su un trattamento della persona è la fattispecie da
 *  manuale. Lo stesso messaggio firmato dallo studio è pubblicità, ed è lecito.
 */
export interface MessaggioProgrammato {
  id: string;
  /** a quanti minuti dall'inizio della diretta */
  minuto: number;
  testo: string;
  /** lo lascia anche in cima, fisso, invece che solo scorrere nella chat */
  fissa: boolean;
  inviatoIl: string | null;
}

/** Quello che uno spettatore vede della sala, a ogni giro. */
export interface StatoSala {
  /** ⚠️ IL NUMERO DA MOSTRARE, non «quante persone ci sono». Chi conduce
   *  sceglie fra i collegati adesso, il totale dei passati e gli iscritti, e
   *  quella scelta si applica UNA VOLTA SOLA, sul server (vedi
   *  api.public.webinar). Chi legge questo campo lo scrive a schermo e basta:
   *  non ci si prendono decisioni. */
  presenti: number;
  /** ⚠️ QUANTE PERSONE CI SONO DAVVERO ADESSO, e non si mostra a nessuno.
   *  Serve alle decisioni di disegno — se la chat si può chiudere, per
   *  esempio. Prendendole su `presenti` si finisce a dire «sala affollata» a
   *  una stanza con dentro due persone, solo perché il contatore è impostato
   *  sugli iscritti: è successo. */
  inSalaAdesso?: number;
  /** quante ne sono passate in tutto da quando è cominciata */
  passate: number;
  /** quante persone si sono iscritte a questa diretta. Serve alla schermata
   *  d'attesa, che le mostra accanto a chi c'è già dentro. */
  iscritti?: number;
  /** sotto questa soglia il numero non si mostra a chi guarda: una sala che
   *  dice «2 spettatori» lavora contro di te, e tacere non è mentire. */
  sogliaVisibile: number;
  messaggi: MessaggioChat[];
  fissato: MessaggioChat | null;
  palco: InPalco[];
  /** chi ha alzato la mano, nell'ordine in cui l'ha alzata. Serve a ciascuno
   *  per sapere a che punto della fila è. */
  coda?: string[];
}

/** Oltre questo silenzio uno spettatore si considera uscito. Tre battiti persi,
 *  come per la diretta. */
export const SCADENZA_PRESENZA_MS = 60_000;
export const BATTITO_PRESENZA_MS = 20_000;

/** Quanti messaggi si portano dietro a ogni giro. Oltre, la chat di un webinar
 *  lungo diventerebbe una risposta da centinaia di chilobyte moltiplicata per
 *  cinquecento persone. */
export const MESSAGGI_PER_GIRO = 60;

/** Il numero mostrato agli spettatori: quello vero, oppure niente.
 *  ⚠️ NON ESISTE UNA TERZA POSSIBILITÀ, ed è una scelta.
 *  Gonfiare la sala è dire ai presenti che sono in trecento quando sono in
 *  dodici, e le sale gonfiate si riconoscono: il numero balla mentre la chat
 *  resta deserta. Chi se ne accorge non pensa «bel webinar», pensa «mi stanno
 *  raccontando balle» — proprio nel momento in cui gli stai chiedendo di
 *  fidarsi per una cosa che gli tocca il corpo.
 *  La soglia fa il lavoro utile senza il rischio: sotto, non si dice niente. */
export function numeroDaMostrare(s: { presenti: number; sogliaVisibile: number }): number | null {
  //  ⚠️ MAI ZERO, nemmeno con la soglia a zero. «0 spettatori» scritto in cima
  //   alla sala è peggio di qualsiasi soglia sbagliata: la prima persona che
  //   arriva legge che non c'è nessuno — sé stessa compresa — e se ne va.
  //   Soglia zero vuol dire «mostralo appena c'è qualcuno», non «mostralo
  //   anche quando non c'è nessuno».
  const minimo = Math.max(1, Math.round(s.sogliaVisibile) || 0);
  return s.presenti >= minimo ? s.presenti : null;
}
