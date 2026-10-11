/** ── LA REGISTRAZIONE DELLA CONSULENZA: QUANDO È VUOTA, E PERCHÉ ───────────
 *
 *  Segnalazione del committente, con la schermata sotto gli occhi:
 *  «Registrazione vuota — il registratore non ha prodotto alcun dato: non c'è
 *  file da archiviare».
 *
 *  ── LA CAUSA VERA ────────────────────────────────────────────────────────
 *  I pezzi del video si accumulavano in UNA variabile sola di tutto il
 *  programma (`recChunks`), e ogni avvio la svuotava. Fermare una
 *  registrazione non è istantaneo: `stop()` chiede al browser di chiudere il
 *  file, e i suoi ultimi pezzi arrivano un momento DOPO, in `onstop`. Se in
 *  quel momento è già partita un'altra registrazione — e parte da sola
 *  all'ingresso di un ospite, mentre `stopAutoRecording` ha appena rimesso a
 *  zero il segno che lo impediva — la nuova svuota il secchio della vecchia, e
 *  quella si ritrova a chiudere un file senza niente dentro. La consulenza è
 *  stata registrata: è il secchio che gliel'hanno portato via.
 *  Rimedio: OGNI registrazione ha il suo secchio (una variabile sua, nella
 *  chiusura), e nessun'altra può toccarlo. Vedi `startRecordingWith`.
 *
 *  ── LA CAUSA MISURATA: L'AUDIO CHE NON ARRIVA MAI ────────────────────────
 *  Replicando il percorso «CAMERE» in Chrome — tela 1280×720 disegnata a ogni
 *  fotogramma, tracce tutte vive, AudioContext in funzione, sette secondi:
 *      nessuna sorgente audio collegata → 0 pezzi, 0 byte
 *      una sorgente collegata           → 98.632 byte
 *  Non manca il video: il registratore ASPETTA l'audio che gli è stato
 *  promesso — la traccia c'è nel miscuglio — e finché aspetta non consegna
 *  nemmeno il video. La destinazione di un AudioContext senza niente collegato
 *  non produce buffer: una traccia viva e perfettamente immobile.
 *  È il caso normale dei primi minuti di una consulenza: camera e microfono
 *  del consulente ancora chiusi, l'ospite che entra e non parla. Il rimedio è
 *  un filo di silenzio (una sorgente costante a volume zero) collegato SEMPRE
 *  alla destinazione, vedi `startRecordingWith` in shop/call.
 *
 *  ── LA CAUSA MISURATA, SECONDA: IL CONTESTO AUDIO SOSPESO ────────────────
 *  Il filo di silenzio non serve a niente se il contesto che lo contiene è
 *  sospeso: 0 byte contro 117.019, stessa tela, stesse tracce. Sta scritto per
 *  esteso sopra `audioRegistrabile`, in fondo a questo file.
 *
 *  ── E LE ALTRE DUE RAGIONI PER CUI PUÒ USCIRE VUOTA ──────────────────────
 *  · Non c'era niente da registrare: nessuna traccia viva nel miscuglio
 *    (camera spenta, condivisione schermo finita, audio non aperto). Il
 *    registratore parte e non scrive niente.
 *  · È durata un istante: fermata prima che il browser consegnasse il primo
 *    pezzo. Si rimedia chiedendo esplicitamente i dati prima di fermarsi
 *    (`requestData`), ma se la registrazione è durata meno di un secondo non
 *    c'è molto da salvare, e vale la pena dirlo.
 *
 *  ⚠️ QUI NON SI REGISTRA NIENTE: si risponde a «si può registrare?» e «perché
 *   non è uscito niente?». Serve perché la risposta si possa provare senza
 *   aprire un browser e senza fare una consulenza vera (vedi
 *   proveDellaRegistrazione) — e perché il messaggio che legge il consulente
 *   dica la COSA GIUSTA fra tre cause molto diverse fra loro.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Il minimo che serve sapere di una traccia per decidere. È un pezzo di
 *  `MediaStreamTrack`, dichiarato qui in forma ridotta perché questo file non
 *  deve conoscere il browser. */
export interface TracciaMinima {
  kind: string;
  readyState: string;
  /** L'identificativo della traccia: è quello che distingue «questa voce è già
   *  attaccata» da «questa è una voce nuova». */
  id?: string;
  /** Una traccia «muta» arriva dal dispositivo ma non porta dati (camera
   *  coperta da un'altra applicazione, permesso revocato al volo). */
  muted?: boolean;
}

export const vivaESana = (t?: TracciaMinima | null): boolean =>
  !!t && t.readyState === "live" && !t.muted;

/** ── LA CATTURA SCHERMO SI PUÒ ANCORA USARE? ──────────────────────────────
 *  ⚠️ SERVE UNA TRACCIA VIDEO VIVA, non «una traccia qualsiasi». Il controllo
 *   di prima guardava tutte le tracce: con la condivisione interrotta restava
 *   viva quella audio del sistema, la cattura risultava «buona», e si finiva a
 *   registrare un video con dentro un fermo immagine nero — peggio che
 *   ripiegare sulle camere, perché sembra una registrazione riuscita. */
export function catturaUsabile(tracce: TracciaMinima[] | null | undefined): boolean {
  return (tracce ?? []).some((t) => t.kind === "video" && vivaESana(t));
}

/** Nel miscuglio c'è qualcosa da registrare? Basta UNA traccia viva: una
 *  consulenza con le camere spente ma la voce accesa è una registrazione
 *  legittima, ed è anzi il caso più comune. */
export function cÈQualcosaDaRegistrare(tracce: TracciaMinima[] | null | undefined): boolean {
  return (tracce ?? []).some(vivaESana);
}

export interface PerchéVuota {
  /** Il titolo dell'avviso. */
  titolo: string;
  /** La frase che spiega, scritta per chi ha appena finito una consulenza. */
  motivo: string;
}

/** Perché non è uscito niente, detto con la causa giusta. */
export function perchéVuota(p: {
  /** C'era almeno una traccia viva quando si è avviata? */
  cera: boolean;
  /** Quanti secondi è durata. */
  secondi: number;
}): PerchéVuota {
  if (!p.cera)
    return {
      titolo: "Non c'era niente da registrare",
      motivo:
        "quando la registrazione è partita non c'era nessuna camera accesa, nessuna condivisione e nessun microfono aperto: il registratore ha scritto un file vuoto.",
    };
  if (p.secondi < 2)
    return {
      titolo: "Registrazione troppo breve",
      motivo: `è durata ${Math.max(0, Math.round(p.secondi))} second${Math.round(p.secondi) === 1 ? "o" : "i"}: il browser non ha fatto in tempo a consegnare nemmeno un pezzo di video.`,
    };
  return {
    titolo: "Registrazione vuota",
    motivo:
      "il registratore non ha prodotto alcun dato. Se stavi registrando lo schermo, controlla di non aver interrotto la condivisione: la registrazione si ferma lì.",
  };
}

/** ── STA REGISTRANDO DAVVERO? ─────────────────────────────────────────────
 *  Si controlla qualche secondo dopo l'avvio, non alla fine: scoprire il vuoto
 *  dopo quaranta minuti è la notizia peggiore nel momento peggiore, e non si
 *  può più fare niente. Dopo `ATTESA_PRIMO_PEZZO_MS` senza un solo pezzo, c'è
 *  qualcosa che non va e si dice mentre la consulenza è ancora in corso. */
export const ATTESA_PRIMO_PEZZO_MS = 6000;

/** ── IL MISCUGLIO PUÒ STALLARE? ───────────────────────────────────────────
 *  Una traccia audio nel miscuglio SENZA nessuna sorgente che la alimenti
 *  blocca tutto il registratore (vedi la misura in testa). Vale come regola,
 *  non come curiosità: chiunque tocchi il miscuglio deve poterlo verificare.
 *  ⚠️ Zero tracce audio NON è uno stallo: un video muto si registra benissimo.
 *   Lo stallo è la PROMESSA non mantenuta — la traccia c'è e non porta niente. */
export function rischioStallo(p: { tracceAudio: number; sorgentiCollegate: number }): boolean {
  return p.tracceAudio > 0 && p.sorgentiCollegate <= 0;
}

/** ── ⚠️ IL CONTESTO AUDIO DEVE ESSERE «IN FUNZIONE», NON SOLO ESISTERE ────
 *  Terza segnalazione: «continua a non registrare». La scatola nera della
 *  consulenza vera (api.presenter.diario) diceva che tutto era a posto —
 *  modalità CAMERE, tracce audio e video vive, UNA sorgente audio collegata
 *  (il filo di silenzio c'era), scheda in primo piano — e subito dopo:
 *  «NIENTE dopo 6000 ms». Nessuna delle due cause di prima.
 *
 *  Misurato in Chrome, stesso percorso, sette secondi, unica differenza lo
 *  stato del contesto:
 *      contesto in funzione (running)   → 117.019 byte
 *      contesto sospeso   (suspended)   → 0 byte, con la tela che disegnava
 *
 *  Un AudioContext nasce SOSPESO se non lo crea un gesto della persona, e
 *  `resume()` non lo sveglia finché nella pagina non si è toccato niente. La
 *  sua destinazione, sospesa, non produce campioni: la traccia audio nel
 *  miscuglio è viva e immobile — la stessa trappola del filo mancante, per una
 *  ragione diversa. Ed è il caso normale del guasto vero: la scheda del
 *  consulente si ricarica, la consulenza si riprende da sola, entra l'ospite,
 *  la registrazione parte da sola, e da quel caricamento nessuno ha ancora
 *  cliccato.
 *
 *  Rimedio, in due mosse (vedi `startRecordingWith`):
 *   1. si usa il contesto CONDIVISO dell'applicazione, che un tocco qualsiasi
 *      nella pagina risveglia;
 *   2. se malgrado tutto non è in funzione, l'audio si LASCIA FUORI dal
 *      miscuglio: meglio una registrazione muta di una registrazione vuota.
 *  ⚠️ NON BASTA CHIAMARE `resume()`: bisogna GUARDARE lo stato dopo. La
 *   promessa di `resume()` su una pagina mai toccata può non risolversi mai. */
export function audioRegistrabile(statoContesto?: string | null): boolean {
  return statoContesto === "running";
}

/** ── ⚠️ LE VOCI ARRIVANO DOPO, E VANNO AGGIUNTE DOPO ──────────────────────
 *  Segnalazione del committente: «ora registra le consulenze ma non l'audio
 *  degli ospiti: fai che registri anche quello, oltre a quello del
 *  presentatore».
 *
 *  Il miscuglio si compone UNA volta, all'avvio: audio della scheda, microfono
 *  del consulente, voce di ogni partecipante già collegato. Ma la registrazione
 *  parte DA SOLA nell'istante in cui l'ospite entra — ed è l'istante giusto, è
 *  l'inizio della consulenza — mentre la sua voce arriva qualche secondo dopo,
 *  quando la connessione fra i due dispositivi ha finito di negoziare. In quel
 *  momento il miscuglio è già chiuso: la traccia dell'ospite non ci entra più,
 *  e per tutta la consulenza si registra il solo consulente. Lo stesso vale per
 *  il microfono acceso a metà consulenza, o per il secondo ospite che entra
 *  dopo.
 *  Rimedio: il banco di missaggio resta aperto finché si registra, e ogni voce
 *  che compare ci si attacca (vedi `collegaVoceAlRegistratore` in shop/call).
 *
 *  ⚠️ UNA VOCE NON SI ATTACCA DUE VOLTE: due sorgenti sulla stessa traccia
 *   raddoppiano il volume e lo mandano in saturazione. Si riconoscono
 *   dall'identificativo della traccia, non dalla persona: lo stesso ospite può
 *   cambiare traccia (spegne e riaccende il microfono) e quella nuova va
 *   attaccata.
 *  ⚠️ UNA TRACCIA FINITA NON SI ATTACCA: non porta niente, e tenerla in elenco
 *   impedirebbe di attaccare quella che la sostituisce. */
export function vociDaCollegare(
  tracce: TracciaMinima[] | null | undefined,
  già: Iterable<string> | null | undefined,
): TracciaMinima[] {
  const viste = new Set(già ?? []);
  return (tracce ?? []).filter((t) => {
    if (!t || t.kind !== "audio") return false;
    if (t.readyState !== "live") return false;
    const id = String((t as { id?: string }).id || "");
    if (!id || viste.has(id)) return false;
    viste.add(id);   // due volte nella stessa chiamata è lo stesso errore
    return true;
  });
}

export function staScrivendo(p: { pezzi: number; msDallAvvio: number }): boolean {
  return p.pezzi > 0 || p.msDallAvvio < ATTESA_PRIMO_PEZZO_MS;
}
