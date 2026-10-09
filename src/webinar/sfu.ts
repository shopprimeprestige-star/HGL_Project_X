/** ── IL TRASPORTO DEL WEBINAR ───────────────────────────────────────────────
 *
 *  Due funzioni sole: `vaiInOnda` per chi presenta, `guarda` per chi guarda.
 *  Nessuna delle due sa niente di Meetly, e Meetly non sa niente di loro: è
 *  esattamente il punto: la consulenza resta la mesh collaudata, il webinar è
 *  un'altra strada che parte da un altro pulsante.
 *
 *  ── LA DIFFERENZA CHE SPIEGA TUTTO IL RESTO ───────────────────────────────
 *  Nella mesh ognuno tratta con ognuno. Qui si tratta con UN SOLO
 *  interlocutore — l'SFU di Cloudflare — e chi guarda non sa nemmeno quanti
 *  altri ci sono. Ecco perché duecento persone non sono duecento volte il
 *  lavoro di una: per il presentatore sono sempre e solo una connessione.
 *
 *  ── DUE VERSI OPPOSTI, E NON CONFONDERLI ──────────────────────────────────
 *  · PUBBLICARE: siamo noi a mandare roba, quindi facciamo NOI l'offerta e
 *    l'SFU risponde.
 *  · GUARDARE: è l'SFU a mandarci roba, quindi è LUI a fare l'offerta e noi a
 *    rispondere.
 *  Scambiarli è l'errore classico con questa API, e si manifesta come una
 *  connessione che resta appesa su «connecting» senza un solo messaggio
 *  d'errore.
 *
 *  ── NIENTE TRICKLE ICE ────────────────────────────────────────────────────
 *  L'API dell'SFU è HTTP: un'offerta, una risposta, fine. Non c'è un canale
 *  aperto da cui far arrivare i candidati man mano, quindi l'SDP va spedito
 *  COMPLETO. Da qui `attendiCandidati`, che senza sembra funzionare in rete
 *  locale e fallisce sempre sulle reti dei clienti.
 */
import { BATTITO_MS, LIVELLI, type DirettaWebinar, type StatoSala } from "./tipi";

/** Gli stessi STUN/TURN della videoconsulenza: quell'endpoint c'è già, genera
 *  credenziali temporanee e non va toccato. Se non risponde si va di soli
 *  STUN pubblici, che bastano alla stragrande maggioranza delle reti. */
const ICE_RIPIEGO: RTCIceServer[] = [
  { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] },
];
async function iceServers(): Promise<RTCIceServer[]> {
  try {
    const j = await (await fetch("/api/public/turn")).json();
    if (Array.isArray(j?.iceServers) && j.iceServers.length) return j.iceServers;
  } catch { /* si prosegue con i pubblici */ }
  return ICE_RIPIEGO;
}

/** L'SDP non è pronto finché i candidati non sono stati raccolti tutti.
 *  Il limite di tempo non è pignoleria: certe reti hanno un candidato che non
 *  arriva mai, e senza scadenza la diretta non partirebbe mai per colpa di un
 *  indirizzo che non serviva. Meglio partire con quelli che ci sono. */
function attendiCandidati(pc: RTCPeerConnection, msMax = 4000): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((risolvi) => {
    let fatto = false;
    const finisci = () => {
      if (fatto) return;
      fatto = true;
      pc.removeEventListener("icegatheringstatechange", suCambio);
      clearTimeout(orologio);
      risolvi();
    };
    const suCambio = () => { if (pc.iceGatheringState === "complete") finisci(); };
    pc.addEventListener("icegatheringstatechange", suCambio);
    const orologio = setTimeout(finisci, msMax);
  });
}

async function chiediAlServer(url: string, corpo: unknown, intestazioni: Record<string, string> = {}) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...intestazioni },
    body: JSON.stringify(corpo),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(String(j?.error || `errore ${r.status}`));
  return j;
}

// ══════════════════════════════════════════════════════════════════════════
//  CHI PRESENTA
// ══════════════════════════════════════════════════════════════════════════

export interface Onda {
  sessionId: string;
  /** aggiunge alla mappa mid → traccia i riferimenti di chi sale dopo */
  registra: (mappa: Map<string, string>) => void;
  /** chiude la diretta: ferma il battito, avvisa il server, stacca */
  chiudi: () => Promise<void>;
  pc: RTCPeerConnection;
  /** ── SOSTITUISCE LA TRACCIA VIDEO CHE STA ANDANDO IN ONDA ───────────────
   *  ⚠️ SERVE A SPEGNERE LA CAMERA DAVVERO. Fin qui la si spegneva con
   *   `enabled = false`: smette di mandare fotogrammi, ma il DISPOSITIVO resta
   *   aperto — la spia accanto all'obiettivo rimane accesa, e chi ha appena
   *   detto «spengo la camera» si vede la lucina addosso. Segnalato dal
   *   committente: «rimane accesa».
   *   Per spegnerla davvero bisogna fermare la traccia (`stop()`), e a quel
   *   punto il posto che occupava nella connessione va riempito con `null` —
   *   altrimenti la sala continua a ricevere l'ultimo fotogramma congelato.
   *  ⚠️ `replaceTrack` E NON UNA NUOVA CONNESSIONE: rifare la connessione
   *   vorrebbe dire due secondi di nero su TUTTI gli schermi ogni volta che si
   *   tocca il pulsante della camera. E conserva le tre qualità della
   *   simulcast, che si possono dichiarare solo alla nascita del transceiver.
   *  Torna `false` se il browser non lo sostiene: chi chiama può allora
   *  ripiegare su `enabled` invece di lasciare la camera in uno stato che non
   *  corrisponde al pulsante. */
  sostituisciVideo: (traccia: MediaStreamTrack | null) => Promise<boolean>;
}

/** Manda in onda `stream`. Le tracce restano di chi chiama: qui non si apre e
 *  non si chiude nessuna camera, così il pulsante «Termina» non spegne la
 *  webcam di chi magari sta per ricominciare. */
export async function vaiInOnda(
  codice: string,
  stream: MediaStream,
  opzioni: {
    simulcast: boolean;
    intestazioni: Record<string, string>;
    /** ⚠️ SENZA QUESTO IL PRESENTATORE NON SENTE CHI FA SALIRE.
     *  Era il difetto della prima versione: la sua connessione era di sola
     *  andata, quindi poteva dare la parola a qualcuno e poi restare l'unico
     *  in tutta la sala a non sentirlo — mentre duecento persone sì.
     *  Una sessione dell'SFU va in tutte e due le direzioni: la stessa che usa
     *  per trasmettere può ricevere il palco, senza aprirne una seconda e senza
     *  riascoltare la propria voce (che sarebbe larsen). */
    instrada?: (nome: string, traccia: MediaStreamTrack) => void;
  },
): Promise<Onda> {
  const pc = new RTCPeerConnection({ iceServers: await iceServers() });

  const nomeDiMid = new Map<string, string>();
  pc.addEventListener("track", (e) => {
    const nome = nomeDiMid.get(String(e.transceiver?.mid ?? "")) || "";
    opzioni.instrada?.(nome, e.track);
  });

  const audio = stream.getAudioTracks()[0];
  const video = stream.getVideoTracks()[0];
  //  ⚠️ `addTransceiver` e non `addTrack`: le tre qualità della simulcast si
  //  possono dichiarare SOLO alla nascita del transceiver. `setParameters` non
  //  le aggiunge dopo — e chi ci prova ottiene un solo livello e nessun errore.
  const tAudio = audio ? pc.addTransceiver(audio, { direction: "sendonly" }) : null;
  const tVideo = video
    ? pc.addTransceiver(video, {
        direction: "sendonly",
        ...(opzioni.simulcast ? { sendEncodings: LIVELLI.map((l) => ({ ...l })) } : {}),
      })
    : null;

  //  Davanti a poca banda si preferisce restare fluidi e perdere nitidezza:
  //  su un webinar si guarda una persona che parla, e uno scatto si nota molto
  //  più di qualche pixel in meno.
  if (tVideo) {
    try {
      const p = tVideo.sender.getParameters();
      (p as unknown as { degradationPreference?: string }).degradationPreference = "maintain-framerate";
      await tVideo.sender.setParameters(p);
    } catch { /* il browser non lo sostiene: nessun danno */ }
    //  «motion»: dice al codificatore che è una persona che si muove, non un
    //  foglio di testo fermo — cambia come spende i bit.
    if (tVideo.sender.track) (tVideo.sender.track as unknown as { contentHint: string }).contentHint = "motion";
  }

  await pc.setLocalDescription(await pc.createOffer());
  await attendiCandidati(pc);

  const r = await chiediAlServer("/api/crm/webinar", {
    azione: "pubblica",
    codice,
    offerSdp: pc.localDescription?.sdp || "",
    //  Il server deve sapere quale «corsia» dell'SDP porta quale traccia: i mid
    //  esistono solo dopo setLocalDescription, per questo si leggono qui.
    midAudio: tAudio?.mid || "",
    midVideo: tVideo?.mid || "",
  }, opzioni.intestazioni);

  await pc.setRemoteDescription({ type: "answer", sdp: String(r.answerSdp || "") });

  //  Il battito dice al server «la scheda è ancora aperta». Senza, una finestra
  //  chiusa di colpo lascerebbe la stanza «in onda» per sempre e chi arriva
  //  dopo aspetterebbe un video che non arriva.
  const battito = setInterval(() => {
    void chiediAlServer("/api/crm/webinar", { azione: "battito", codice }, opzioni.intestazioni).catch(() => { /* riproverà fra poco */ });
  }, BATTITO_MS);

  return {
    sessionId: String(r.sessionId || ""),
    pc,
    sostituisciVideo: async (traccia) => {
      try {
        //  Si cerca il mittente del VIDEO fra quelli aperti: è quello nato dal
        //  transceiver qui sopra, e resta lo stesso per tutta la diretta.
        const sender = pc.getSenders().find((s) => s.track?.kind === "video")
          ?? (tVideo ? tVideo.sender : null);
        if (!sender) return false;
        await sender.replaceTrack(traccia);
        return true;
      } catch {
        return false;
      }
    },
    registra: (m: Map<string, string>) => { m.forEach((v, k) => nomeDiMid.set(k, v)); },
    chiudi: async () => {
      clearInterval(battito);
      try { pc.close(); } catch { /* già chiusa */ }
      await chiediAlServer("/api/crm/webinar", { azione: "termina", codice }, opzioni.intestazioni).catch(() => { /* la stanza scadrà da sola col battito */ });
    },
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  CHI GUARDA
// ══════════════════════════════════════════════════════════════════════════

export interface Visione {
  /** la PROPRIA sessione sull'SFU: serve per agganciare dopo le tracce di chi
   *  sale sul palco, senza rifare la connessione da capo */
  sessionId: string;
  stream: MediaStream;
  chiudi: () => void;
  pc: RTCPeerConnection;
  /** aggiunge alla mappa mid → traccia i riferimenti di chi è salito dopo */
  registra: (mappa: Map<string, string>) => void;
}

/** Si aggancia alla diretta e restituisce il flusso da dare a un <video>.
 *  ⚠️ Qui NON si chiama `getUserMedia`: lo spettatore non pubblica niente,
 *  quindi il browser non gli chiede camera e microfono. Su cinquecento
 *  persone, quella richiesta sarebbe cinquecento occasioni di chiudere la
 *  scheda prima ancora di aver visto la faccia di chi parla. */
/** ── ⚠️ UNA TRACCIA PER TIPO, E LA PIÙ RECENTE ─────────────────────────────
 *
 *  Qui c'era `stream.addTrack(...)` e basta. Ogni volta che chi conduce si
 *  ricollega — riavvia la regia, passa alla condivisione, riapre la pagina —
 *  il server manda una traccia nuova, e quella vecchia restava dentro. Su una
 *  sala aperta da un po' ne ho contate SEI: tre audio e tre video, tutte
 *  dichiarate «live» dal browser, con una sola che portava davvero immagini.
 *
 *  Un elemento `<video>` disegna LA PRIMA traccia video del flusso. Con tre
 *  dentro, quale si vede è un caso: se in cima resta quella di una sessione
 *  finita, lo spettatore vede nero mentre tutto il resto dice che va bene —
 *  ed è esattamente la segnalazione «quando attivo la condivisione la camera
 *  del presentatore rimane nera». Non si vedeva sempre perché non sempre
 *  toccava alla traccia morta stare per prima.
 *
 *  ⚠️ Si toglie PRIMA di aggiungere: se si aggiungesse prima, per un istante
 *   ci sarebbero due tracce e l'elemento potrebbe agganciarsi ancora alla
 *   vecchia — cioè il difetto, con un passaggio in più.
 *  ⚠️ Le vecchie NON si fermano: sono tracce remote, chiuderle vorrebbe dire
 *   dire al motore che quel flusso non serve più mentre magari sta ancora
 *   arrivando. Basta che escano dal flusso che si guarda.
 */
export function soloLUltima(
  flusso: { getTracks(): { kind: string }[]; removeTrack(t: never): void; addTrack(t: never): void },
  nuova: { kind: string },
): void {
  for (const vecchia of flusso.getTracks()) {
    if (vecchia.kind === nuova.kind && vecchia !== nuova) flusso.removeTrack(vecchia as never);
  }
  if (!flusso.getTracks().includes(nuova)) flusso.addTrack(nuova as never);
}

export async function guarda(
  codice: string,
  diretta: DirettaWebinar | { sessionId: string },
  /** chiamata a ogni traccia che arriva, col NOME della traccia: «audio» e
   *  «video» sono il relatore, «a-xxx» e «v-xxx» sono chi è salito sul palco.
   *  Senza questo aggancio ci si ritrova con quattro flussi e nessuna idea di
   *  chi sia chi. */
  instrada?: (nome: string, traccia: MediaStreamTrack) => void,
): Promise<Visione> {
  void diretta; // il server risale da sé alle tracce vive: qui serve solo il codice
  const pc = new RTCPeerConnection({ iceServers: await iceServers() });

  const stream = new MediaStream();
  //  ⚠️ LA MAPPA VA RIEMPITA PRIMA che l'offerta venga applicata: `track`
  //   scatta DENTRO `setRemoteDescription`, e se a quel punto non sappiamo
  //   ancora quale mid è quale, la traccia arriva anonima e non si recupera.
  const nomeDiMid = new Map<string, string>();
  pc.addEventListener("track", (e) => {
    const nome = nomeDiMid.get(String(e.transceiver?.mid ?? "")) || "";
    if (instrada) instrada(nome, e.track);
    //  Il relatore va comunque nel flusso principale: è quello che finisce nel
    //  <video> grande e non deve dipendere da chi lo instrada.
    if (!nome || nome === "audio" || nome === "video") soloLUltima(stream, e.track);
  });

  const r = await chiediAlServer("/api/public/webinar", { azione: "guarda", codice });
  for (const t of (r.tracce as { mid: string; trackName: string }[] | undefined) ?? []) {
    if (t.mid) nomeDiMid.set(String(t.mid), String(t.trackName));
  }
  //  ⚠️ QUI L'OFFERTA È LA SUA: siamo noi a rispondere. È il verso opposto
  //  della pubblicazione (vedi la nota in testa al file).
  await pc.setRemoteDescription({ type: "offer", sdp: String(r.offerSdp || "") });
  await pc.setLocalDescription(await pc.createAnswer());
  await attendiCandidati(pc);

  await chiediAlServer("/api/public/webinar", {
    azione: "rinegozia",
    codice,
    sessionId: String(r.sessionId || ""),
    answerSdp: pc.localDescription?.sdp || "",
  });

  return {
    sessionId: String(r.sessionId || ""),
    stream, pc,
    //  chi aggiunge tracce dopo (il palco) registra qui i nuovi mid, così
    //  l'instradamento continua a funzionare per tutta la diretta
    registra: (m: Map<string, string>) => { m.forEach((v, k) => nomeDiMid.set(k, v)); },
    chiudi: () => { try { pc.close(); } catch { /* già chiusa */ } },
  };
}

/** Chiede al server se la diretta è cominciata. Volutamente povera: è la
 *  chiamata che cinquecento persone ripetono a ciclo, e ogni campo in più è
 *  cinquecento volte in più sul filo. */
export async function statoDiretta(codice: string): Promise<{
  trovata: boolean; titolo?: string; inOnda?: boolean; iniziataIl?: string | null; registrando?: boolean;
  vista?: "contenuti" | "camera" | "salotto"; percorso?: string;
  regia?: { primoPiano?: string; mostrati?: string[]; soloChiParla?: boolean; maniAperte?: boolean } | null;
  /** il numero a cui scrivere quando la diretta è finita */
  whatsapp?: string;
  /** quando è previsto l'inizio, per il conto alla rovescia della sala */
  inizioPrevisto?: string;
  /** quale numero mostra la sala: vedi StanzaWebinar.contatore */
  contatore?: string;
  relatori?: { id: string; nome: string; sessionId: string; audio: string; video: string; parla: boolean; camera?: boolean }[];
  contenuti?: Record<string, unknown> | null;
  diretta?: { sessionId: string; audio: string; video: string } | null;
  sala?: StatoSala;
  coda?: string[];
}> {
  try {
    const r = await fetch(`/api/public/webinar?codice=${encodeURIComponent(codice)}`);
    return (await r.json()) as never;
  } catch {
    return { trovata: false };
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  IL PALCO
// ══════════════════════════════════════════════════════════════════════════

/** Uno spettatore prende la parola. Stessa forma di `vaiInOnda`, con due
 *  differenze che contano: passa dalla porta PUBBLICA (chi guarda non ha un
 *  accesso al gestionale) e deve esibire il lasciapassare che il presentatore
 *  gli ha coniato facendolo salire. */
export async function salgoSulPalco(
  codice: string,
  chi: { spettatore: string; pass: string; conVideo: boolean },
  stream: MediaStream,
): Promise<{ sessionId: string; pc: RTCPeerConnection; chiudi: () => void }> {
  const pc = new RTCPeerConnection({ iceServers: await iceServers() });
  const audio = stream.getAudioTracks()[0];
  const video = chi.conVideo ? stream.getVideoTracks()[0] : null;

  const tAudio = audio ? pc.addTransceiver(audio, { direction: "sendonly" }) : null;
  //  ⚠️ NIENTE SIMULCAST QUI, ed è voluto. Chi sale dal pubblico è quasi sempre
  //   al telefono: tre codificatori sul suo dispositivo lo scaldano, gli
  //   mangiano la batteria e gli fanno saltare l'audio, che è la cosa per cui
  //   l'hai fatto salire. Le tre qualità servono al relatore, che sta seduto a
  //   una scrivania e lo guardano in cinquecento.
  const tVideo = video ? pc.addTransceiver(video, { direction: "sendonly" }) : null;

  await pc.setLocalDescription(await pc.createOffer());
  await attendiCandidati(pc);

  const r = await chiediAlServer("/api/public/webinar", {
    azione: "salgo",
    codice,
    spettatore: chi.spettatore,
    pass: chi.pass,
    offerSdp: pc.localDescription?.sdp || "",
    midAudio: tAudio?.mid || "",
    midVideo: tVideo?.mid || "",
  });
  await pc.setRemoteDescription({ type: "answer", sdp: String(r.answerSdp || "") });
  return { sessionId: String(r.sessionId || ""), pc, chiudi: () => { try { pc.close(); } catch { /* già chiusa */ } } };
}

/** Aggancia le tracce di chi è appena salito, SENZA rifare la connessione.
 *  Rifarla vorrebbe dire due secondi di schermo nero sul relatore ogni volta
 *  che una persona prende la parola — cioè proprio nel momento in cui la sala
 *  sta guardando.
 *
 *  Restituisce la mappa mid → nome della traccia, da registrare PRIMA che
 *  l'evento `track` arrivi: è l'unico modo per sapere quale flusso è di chi. */
export async function aggiungiTracce(
  codice: string,
  sessionId: string,
  pc: RTCPeerConnection,
  tracce: { sessionId: string; trackName: string }[],
  registra: (mappa: Map<string, string>) => void,
): Promise<void> {
  if (!tracce.length) return;
  const r = await chiediAlServer("/api/public/webinar", { azione: "aggiungi", codice, sessionId, tracce });

  const mappa = new Map<string, string>();
  for (const t of (r.tracce as { mid: string; trackName: string }[] | undefined) ?? []) {
    if (t.mid) mappa.set(String(t.mid), String(t.trackName));
  }
  registra(mappa);

  if (!r.offerSdp) return;
  await pc.setRemoteDescription({ type: "offer", sdp: String(r.offerSdp) });
  await pc.setLocalDescription(await pc.createAnswer());
  await attendiCandidati(pc);
  await chiediAlServer("/api/public/webinar", {
    azione: "rinegozia", codice, sessionId, answerSdp: pc.localDescription?.sdp || "",
  });
}

/** ── L'ICONA CHE SI ILLUMINA ───────────────────────────────────────────────
 *  Misura il proprio microfono e avvisa quando si comincia e si smette di
 *  parlare. Non manda un aggiornamento a ogni fotogramma — sarebbero cinquanta
 *  richieste al secondo per un pallino che si accende — ma solo ai CAMBI, e
 *  con una coda: la voce ha dei buchi naturali fra una parola e l'altra, e
 *  senza attesa l'icona lampeggerebbe come una sirena.
 *
 *  Restituisce la funzione per smettere. */
export function sorvegliaVoce(
  stream: MediaStream,
  quandoCambia: (parla: boolean) => void,
  opzioni: { sogliaDb?: number; codaMs?: number } = {},
): () => void {
  const soglia = opzioni.sogliaDb ?? -50;
  const coda = opzioni.codaMs ?? 600;
  const traccia = stream.getAudioTracks()[0];
  if (!traccia) return () => { /* niente da sorvegliare */ };

  const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  let ctx: AudioContext;
  try { ctx = new Ctx(); } catch { return () => { /* audio non disponibile */ }; }

  const sorgente = ctx.createMediaStreamSource(new MediaStream([traccia]));
  const analizzatore = ctx.createAnalyser();
  analizzatore.fftSize = 512;
  sorgente.connect(analizzatore);
  const campioni = new Float32Array(analizzatore.fftSize);

  let parla = false;
  let ultimaVoce = 0;
  let vivo = true;
  let disegno = 0;

  const giro = () => {
    if (!vivo) return;
    analizzatore.getFloatTimeDomainData(campioni);
    //  Valore efficace, non il picco: un colpo sulla scrivania supera qualsiasi
    //  soglia di picco e accenderebbe l'icona senza che nessuno abbia parlato.
    let somma = 0;
    for (let i = 0; i < campioni.length; i++) somma += campioni[i] * campioni[i];
    const db = 20 * Math.log10(Math.sqrt(somma / campioni.length) || 1e-8);

    const ora = Date.now();
    if (db > soglia) ultimaVoce = ora;
    const adessoParla = ora - ultimaVoce < coda;
    if (adessoParla !== parla) { parla = adessoParla; quandoCambia(parla); }
    disegno = requestAnimationFrame(giro);
  };
  disegno = requestAnimationFrame(giro);

  return () => {
    vivo = false;
    cancelAnimationFrame(disegno);
    try { sorgente.disconnect(); } catch { /* già staccato */ }
    try { analizzatore.disconnect(); } catch { /* già staccato */ }
    try { void ctx.close(); } catch { /* già chiuso */ }
  };
}
