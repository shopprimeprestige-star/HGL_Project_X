/** ── LA CAMERA DEL CONSULENTE SUI LINK «SOLO UNA COSA» — IL COLLEGAMENTO ────
 *
 *  Le regole (chi parla, quando, e perché un canale tutto suo) stanno in
 *  `camera-link-protocollo.ts`, che si prova da solo. Qui c'è soltanto il
 *  collegamento: la camera, le connessioni, il canale.
 *
 *  ── DUE LATI, UNA DIREZIONE ──────────────────────────────────────────────
 *   · LATO CONSULENTE (`accendiCameraLink` / `spegniCameraLink`): prende la
 *     camera, apre una connessione per ogni cliente che si annuncia e gli manda
 *     il video. Vive a livello di MODULO e non dentro un componente: passando
 *     dal preventivo ai media la barra si ridisegna, e una camera appesa allo
 *     stato di un componente si spegnerebbe da sola a metà consulenza.
 *   · LATO CLIENTE (`seguiCameraLink`): ascolta, risponde all'offerta e
 *     consegna il video. ⚠️ NON CHIEDE MAI la camera né il microfono del
 *     cliente: le tracce sono dichiarate `recvonly`, quindi il browser non
 *     mostra nessun permesso da concedere. È la promessa del link.
 *
 *  ⚠️ SOLO VIDEO, NIENTE MICROFONO. Questi link nascono per chi sta al
 *   telefono: la voce passa già di lì. Aggiungere l'audio qui vorrebbe dire
 *   due voci sfasate nella stessa stanza — e il fischio del ritorno se il
 *   cliente è nella stessa. Se un giorno serve, si aggiunge una traccia sola:
 *   il resto del giro è già pronto.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  CAM,
  canaleCamera,
  candidatoApplicabile,
  connessioneDaRifare,
  deveOffrire,
  deveRiannunciarsi,
  deveRichiedere,
  frazioneValida,
  perMe,
  posizioneValida,
} from "./camera-link-protocollo";

const FALLBACK_ICE: RTCIceServer[] = [
  { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] },
];

/** ⚠️ Le credenziali TURN SCADONO, e senza TURN va tutto bene in ufficio e
 *   niente fra due reti diverse: è lo stesso inganno già documentato nel motore
 *   della chiamata. Si richiedono dopo mezz'ora. */
let iceCache: RTCIceServer[] = FALLBACK_ICE;
let icePreso = 0;
async function serverDiRete(): Promise<RTCIceServer[]> {
  if (iceCache !== FALLBACK_ICE && Date.now() - icePreso < 30 * 60_000) return iceCache;
  try {
    const j = await (await fetch("/api/public/turn", { cache: "no-store" })).json();
    if (Array.isArray(j.iceServers) && j.iceServers.length) {
      iceCache = j.iceServers;
      icePreso = Date.now();
    }
  } catch {
    /* si resta sugli STUN: meglio una chiamata fragile che nessuna */
  }
  return iceCache;
}

const nuovoPid = () => Math.random().toString(36).slice(2, 10);

/* ═══════════════════ DOVE STA E QUANTO È GRANDE ════════════════════════════
 *
 *  Segnalazione del committente: «la grandezza che ho io sulla mia dashboard
 *  non reagisce come su Meetly; dove posiziono il riquadro si deve spostare,
 *  dove lo metto e la grandezza che metto».
 *
 *  In Meetly la camerina è UNA SOLA COSA vista da due parti: il consulente la
 *  sposta sul suo schermo e si sposta anche sul telefono del cliente, e la
 *  misura fa lo stesso. Qui, fuori dalla videochiamata, mancava proprio quel
 *  filo: erano due riquadri indipendenti che si somigliavano.
 *
 *  ── ⚠️ LA MISURA VIAGGIA COME FRAZIONE, NON IN PIXEL ─────────────────────
 *  240 punti sul monitor del consulente sono un francobollo; gli stessi 240
 *  sul telefono del cliente sono mezzo schermo. Il metro comune è lo SCHERMO
 *  DEL CLIENTE — che infatti si annuncia con le sue misure (`vp` dentro
 *  `camhello`) — esattamente come fa lo specchio della PiP in chiamata.
 *  ───────────────────────────────────────────────────────────────────────── */

export interface PipCondiviso {
  /** frazioni 0..1 dello spazio libero */
  x: number;
  y: number;
  /** larghezza come frazione della larghezza dello schermo del cliente.
   *  0 = nessuno l'ha ancora scelta: vale il predefinito. */
  f: number;
}

//  In basso a destra: sul preventivo è l'angolo che copre meno cose, e resta
//  sotto il pollice per spostarla.
let pipStato: PipCondiviso = { x: 0.97, y: 0.9, f: 0 };
const pipSubs = new Set<() => void>();
const avvisaPip = () => pipSubs.forEach((f) => f());

/** Dove sta e quanto è grande, adesso. */
export function usePipCameraLink(): PipCondiviso {
  const [p, setP] = useState<PipCondiviso>(pipStato);
  useEffect(() => {
    const f = () => setP(pipStato);
    pipSubs.add(f);
    f();
    return () => {
      pipSubs.delete(f);
    };
  }, []);
  return p;
}

/** Quando si è detta l'ultima posizione: durante un trascinamento arrivano
 *  decine di eventi al secondo, e mandarli tutti vorrebbe dire intasare il
 *  canale con roba che l'altro lato non fa in tempo a disegnare. */
let ultimoPipDetto = 0;

/** Cambia posizione/misura e lo dice all'altro lato.
 *  `vivo` = siamo in mezzo a un gesto: si manda al massimo otto volte al
 *  secondo, ma l'ULTIMO invio (a gesto finito) non si perde mai. */
export function condividiPip(p: Partial<PipCondiviso>, opts?: { vivo?: boolean }): void {
  const nuovo: PipCondiviso = {
    x: Number.isFinite(p.x as number) ? Math.min(1, Math.max(0, p.x as number)) : pipStato.x,
    y: Number.isFinite(p.y as number) ? Math.min(1, Math.max(0, p.y as number)) : pipStato.y,
    f: Number.isFinite(p.f as number) && (p.f as number) > 0 ? (p.f as number) : pipStato.f,
  };
  pipStato = nuovo;
  avvisaPip();
  const ora = Date.now();
  if (opts?.vivo && ora - ultimoPipDetto < 120) return;
  ultimoPipDetto = ora;
  diciPip(nuovo);
}

/** Lo dice all'altro lato, su qualunque dei due canali sia aperto: il
 *  consulente ne tiene uno solo, il cliente pure, e qui non serve sapere chi
 *  siamo dei due. */
function diciPip(p: PipCondiviso): void {
  const payload = { x: p.x, y: p.y, f: p.f };
  if (canale && canaleVivo) {
    try {
      void canale.send({ type: "broadcast", event: CAM.pip, payload });
    } catch {
      /* */
    }
  }
  if (ascolto && ascolto.vivo) {
    try {
      void ascolto.ch.send({ type: "broadcast", event: CAM.pip, payload });
    } catch {
      /* */
    }
  }
}

/** Applica quello che arriva dall'altro lato. ⚠️ NON si rimanda indietro: due
 *  parti che si rispondono a vicenda fanno un rimpallo che non finisce più. */
function applicaPipRemoto(payload: unknown): void {
  const p = payload as { x?: unknown; y?: unknown; f?: unknown } | null;
  const pos = posizioneValida(p);
  const fr = frazioneValida(p?.f);
  if (!pos && fr === null) return;
  pipStato = { x: pos ? pos.x : pipStato.x, y: pos ? pos.y : pipStato.y, f: fr ?? pipStato.f };
  avvisaPip();
}

/* ═══════════════════ LATO CONSULENTE ═══════════════════════════════════════ */

let flusso: MediaStream | null = null;
let canale: ReturnType<typeof supabase.channel> | null = null;
let canaleVivo = false;
let sessione = "";
let mioPid = "";
let accesa = false;
let occupata = false;
/** Le misure dello schermo del cliente, quando si sanno: è il METRO COMUNE su
 *  cui si calcola la camerina (vedi il blocco sopra). */
let vistaCliente: { w: number; h: number } | null = null;
/** Da quando un cliente sta chiedendo senza ottenere niente: serve a capire se
 *  una connessione `disconnected` si è ripresa da sola o va rifatta. */
const insiste = new Map<string, number>();
const peers = new Map<string, RTCPeerConnection>();
/** ── ⚠️ I CANDIDATI DI RETE ARRIVANO PRIMA DELLA RISPOSTA, E VANNO TENUTI ──
 *  È il guasto dello «schermo nero»: il cliente manda i propri candidati
 *  appena li trova, e quelli arrivano mentre da questa parte la risposta SDP
 *  non è ancora stata applicata. `addIceCandidate` in quel momento fallisce, e
 *  un candidato buttato via è un pezzo di strada in meno: la connessione si
 *  negozia, l'immagine non arriva mai e resta un cerchio nero. Qui si mettono
 *  da parte e si applicano appena c'è il destinatario giusto. È esattamente
 *  quello che fa da anni il motore della chiamata (`pendingIce` in call.tsx):
 *  averlo dimenticato qui è bastato a far sembrare rotta tutta la funzione. */
const cndAttesa = new Map<string, RTCIceCandidateInit[]>();

async function aggiungiCandidato(
  chiave: string,
  pc: RTCPeerConnection | undefined,
  c: RTCIceCandidateInit,
) {
  if (pc && candidatoApplicabile(pc)) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(c));
    } catch {
      /* candidato non valido: non è un guasto */
    }
    return;
  }
  const q = cndAttesa.get(chiave) || [];
  q.push(c);
  cndAttesa.set(chiave, q);
}

/** Applica i candidati messi da parte: si chiama SUBITO dopo aver applicato la
 *  descrizione dell'altro lato. */
async function svuotaCandidati(chiave: string, pc: RTCPeerConnection) {
  const q = cndAttesa.get(chiave);
  if (!q) return;
  cndAttesa.delete(chiave);
  for (const c of q) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(c));
    } catch {
      /* */
    }
  }
}

const iscritti = new Set<() => void>();
const avvisa = () => iscritti.forEach((f) => f());

export interface StatoCameraLink {
  /** La camera sta trasmettendo. */
  accesa: boolean;
  /** Si sta accendendo (il browser sta chiedendo il permesso). */
  occupata: boolean;
  /** Quanti dispositivi stanno ricevendo. Zero significa «nessuno ha ancora
   *  aperto il link»: è un'informazione, non un guasto. */
  collegati: number;
  /** Lo schermo del cliente collegato, quando lo si sa: è il metro su cui si
   *  disegna l'anteprima, così il consulente vede quanto è grande DA LUI. */
  vista: { w: number; h: number } | null;
}

function stato(): StatoCameraLink {
  return { accesa, occupata, collegati: peers.size, vista: vistaCliente };
}

/** Lo stato della camera per la barra del presentatore. */
export function useCameraLink(): StatoCameraLink {
  const [s, setS] = useState<StatoCameraLink>(stato);
  useEffect(() => {
    const f = () => setS(stato());
    iscritti.add(f);
    f();
    return () => {
      iscritti.delete(f);
    };
  }, []);
  return s;
}

function manda(event: string, payload: Record<string, unknown>) {
  if (!canale || !canaleVivo) return;
  try {
    void canale.send({ type: "broadcast", event, payload });
  } catch {
    /* il canale sta cadendo: il prossimo annuncio lo rimette in piedi */
  }
}

function chiudiPeer(pid: string) {
  const p = peers.get(pid);
  if (!p) return;
  peers.delete(pid);
  cndAttesa.delete(pid);
  inCorso.delete(pid);
  try {
    p.close();
  } catch {
    /* */
  }
  avvisa();
}

/** Chi si sta servendo in questo momento. ⚠️ `peers` da solo non basta: fra
 *  l'annuncio e la connessione c'è un'attesa (le credenziali TURN), e due
 *  annunci ravvicinati — il cliente che richiama perché non vede niente —
 *  passerebbero tutti e due il controllo prima che il primo abbia messo la sua
 *  voce in elenco. Verrebbero due connessioni per la stessa persona, e due
 *  offerte che si accavallano non chiudono più la negoziazione. */
const inCorso = new Set<string>();

async function offriA(pid: string) {
  if (inCorso.has(pid)) return;
  if (!deveOffrire(pid, { accesa, giaCollegati: peers.keys() })) return;
  const media = flusso;
  if (!media) return;
  inCorso.add(pid);
  let pc: RTCPeerConnection;
  try {
    pc = new RTCPeerConnection({ iceServers: await serverDiRete() });
  } catch {
    inCorso.delete(pid);
    return;
  }
  //  Da qui in poi la voce è in elenco: il posto è preso.
  peers.set(pid, pc);
  inCorso.delete(pid);
  avvisa();
  pc.onicecandidate = (e) => {
    if (e.candidate) manda(CAM.rete, { to: pid, from: mioPid, c: e.candidate.toJSON() });
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "connected") insiste.delete(pid);
    if (pc.connectionState === "failed" || pc.connectionState === "closed") chiudiPeer(pid);
  };
  for (const t of media.getTracks()) pc.addTrack(t, media);
  try {
    const offerta = await pc.createOffer();
    await pc.setLocalDescription(offerta);
    manda(CAM.offerta, { to: pid, from: mioPid, sdp: pc.localDescription });
  } catch {
    chiudiPeer(pid);
  }
}

function apriCanale(sess: string) {
  if (canale && sessione === sess) return;
  chiudiCanale();
  sessione = sess;
  mioPid = mioPid || nuovoPid();
  const ch = supabase.channel(canaleCamera(sess), { config: { broadcast: { self: false } } });
  ch.on("broadcast", { event: CAM.ciao }, ({ payload }: any) => {
    const pid = String(payload?.pid || "");
    if (!pid) return;
    //  Lo schermo di chi guarda: è il metro della camerina (vedi sopra).
    const vp = payload?.vp;
    if (vp && Number(vp.w) > 0 && Number(vp.h) > 0) {
      const nuova = { w: Math.round(Number(vp.w)), h: Math.round(Number(vp.h)) };
      if (!vistaCliente || vistaCliente.w !== nuova.w || vistaCliente.h !== nuova.h) {
        vistaCliente = nuova;
        avvisa();
      }
    }
    //  Si risponde SEMPRE con lo stato: chi ha aperto il link a camera spenta
    //  deve sapere che non c'è niente da aspettare, invece di restare con un
    //  riquadro vuoto in un angolo.
    manda(CAM.stato, { on: accesa, from: mioPid });
    /*  ── ⚠️ SI RIFÀ SOLO QUELLO CHE È DAVVERO MORTO ────────────────────
        Il cliente si riannuncia quando non vede niente: se da questa parte
        resta appesa una connessione caduta, `deveOffrire` risponde «gli ho già
        offerto» e lui resta davanti a un cerchio nero per sempre.
        Ma il rimedio era peggiore del male: buttavo tutto quello che non fosse
        già `connected` o `connecting` — e una connessione appena creata sta in
        `new`. Ogni annuncio la faceva ricominciare da capo: è il «ogni tanto si
        nasconde da sola, ogni tanto resta nera» segnalato dal committente.
        Adesso decide una regola sola, scritta e provata (`connessioneDaRifare`):
        `failed`/`closed` subito, `disconnected` solo se il cliente sta
        chiedendo da più di qualche secondo — perché quasi sempre si riprende
        da sé. */
    const vecchia = peers.get(pid);
    if (vecchia) {
      const da = insiste.get(pid) || 0;
      if (!da) insiste.set(pid, Date.now());
      const insistente = !!da && Date.now() - da > 6000;
      if (connessioneDaRifare(vecchia.connectionState, { insistente })) {
        chiudiPeer(pid);
        insiste.delete(pid);
      }
    } else {
      insiste.delete(pid);
    }
    void offriA(pid);
  });
  ch.on("broadcast", { event: CAM.pip }, ({ payload }: any) => applicaPipRemoto(payload));
  ch.on("broadcast", { event: CAM.risposta }, async ({ payload }: any) => {
    if (!perMe(payload, mioPid)) return;
    const pc = peers.get(String(payload?.from || ""));
    if (!pc || !payload?.sdp) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      //  ⚠️ Subito dopo: i candidati arrivati nel frattempo aspettano qui.
      await svuotaCandidati(String(payload.from), pc);
    } catch {
      chiudiPeer(String(payload.from));
    }
  });
  ch.on("broadcast", { event: CAM.rete }, ({ payload }: any) => {
    if (!perMe(payload, mioPid) || !payload?.c) return;
    const da = String(payload?.from || "");
    void aggiungiCandidato(da, peers.get(da), payload.c);
  });
  ch.subscribe((s: string) => {
    canaleVivo = s === "SUBSCRIBED";
    //  Appena il canale è pronto si annuncia lo stato: chi era già lì ad
    //  aspettare si fa vivo e riceve l'offerta.
    if (canaleVivo) manda(CAM.stato, { on: accesa, from: mioPid });
  });
  canale = ch;
}

function chiudiCanale() {
  for (const pid of [...peers.keys()]) chiudiPeer(pid);
  if (canale) {
    try {
      supabase.removeChannel(canale);
    } catch {
      /* */
    }
  }
  canale = null;
  canaleVivo = false;
}

/** Accende la camera e la manda a chi ha il link. Torna `false` se il permesso
 *  non è stato dato: chi chiama lo dice a schermo, invece di lasciare un
 *  pulsante acceso che non trasmette niente. */
export async function accendiCameraLink(sess: string): Promise<boolean> {
  const codice = String(sess ?? "").trim();
  if (!codice || occupata) return false;
  occupata = true;
  avvisa();
  try {
    flusso = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch {
    occupata = false;
    avvisa();
    return false;
  }
  occupata = false;
  accesa = true;
  //  Le credenziali TURN si prendono ADESSO, mentre il consulente sta ancora
  //  guardando la propria anteprima: quando arriverà l'annuncio del cliente
  //  l'offerta parte senza aspettare una chiamata di rete.
  void serverDiRete();
  apriCanale(codice);
  manda(CAM.stato, { on: true, from: mioPid });
  avvisa();
  //  ⚠️ La camera non deve restare accesa se la scheda si chiude a metà: il
  //   cliente resterebbe con l'ultimo fotogramma congelato e la spia della
  //   camera accesa sul portatile del consulente.
  if (typeof window !== "undefined") window.addEventListener("pagehide", chiudiCameraLink);
  return true;
}

/** Spegne la camera e avvisa i clienti: il riquadro sparisce dal loro schermo. */
/** Spegne la camera e avvisa i clienti: il cerchio sparisce dal loro schermo.
 *
 *  ⚠️ IL CANALE RESTA APERTO, e sono due difetti evitati in una riga.
 *   · «Spengo» è l'ULTIMA cosa che il cliente deve sapere: chiudendo il canale
 *     nello stesso istante, l'annuncio poteva non partire mai — e al cliente
 *     restava l'ultimo fotogramma congelato, cioè la faccia del consulente
 *     ferma a guardarlo finché la connessione non moriva da sola.
 *   · Riaccendendo subito dopo si rientrerebbe in un canale da cui si sta
 *     ancora uscendo, e due ingressi sullo stesso canale non convivono: il
 *     secondo viene rifiutato, e la camera non si riaccende più.
 *  Il canale si chiude davvero solo quando si chiude la pagina. */
export function spegniCameraLink(): void {
  accesa = false;
  manda(CAM.stato, { on: false, from: mioPid });
  for (const pid of [...peers.keys()]) chiudiPeer(pid);
  if (flusso) {
    for (const t of flusso.getTracks()) {
      try {
        t.stop();
      } catch {
        /* */
      }
    }
  }
  flusso = null;
  avvisa();
}

/** Chiusura vera: camera spenta E canale lasciato. Si usa quando la pagina se
 *  ne va, perché lì non c'è nessun «dopo» in cui riaccendere. */
function chiudiCameraLink(): void {
  spegniCameraLink();
  chiudiCanale();
  if (typeof window !== "undefined") window.removeEventListener("pagehide", chiudiCameraLink);
}

/** Il video da mostrare al consulente stesso (l'anteprima di sé). */
export function flussoCameraLink(): MediaStream | null {
  return flusso;
}

/* ═══════════════════ LATO CLIENTE ══════════════════════════════════════════ */

/** ── ⚠️ UN ASCOLTO SOLO, CHE SOPRAVVIVE AL CAMBIO DI PAGINA ────────────────
 *
 *  Segnalazione del committente: «sul link solo preventivo, se passo ai media
 *  non la mostra proprio».
 *
 *  ERA QUESTO. I due link «solo una cosa» si seguono: quando il consulente
 *  passa ai media, il cliente cambia pagina da solo. Con l'ascolto attaccato
 *  al componente, quel cambio voleva dire lasciare il canale e rientrarci
 *  nello stesso istante — e due ingressi sullo stesso canale, sulla stessa
 *  connessione, non convivono: il secondo veniva rifiutato. Il cliente
 *  arrivava sui media senza più nessuno che ascoltasse, e la camera non
 *  compariva più fino a un ricaricamento a mano.
 *
 *  Adesso l'ascolto vive QUI, fuori dalle pagine, e chi lo usa si iscrive.
 *  Quando l'ultimo se ne va non si chiude subito: si aspetta qualche secondo,
 *  perché nove volte su dieci è un cambio di pagina e fra un istante ci sarà
 *  di nuovo qualcuno. Così la faccia del consulente non sparisce nemmeno per
 *  un fotogramma mentre il cliente passa dal preventivo alle foto.
 *  ───────────────────────────────────────────────────────────────────────── */

type Ascoltatore = (s: MediaStream | null) => void;

interface Ascolto {
  sess: string;
  ch: ReturnType<typeof supabase.channel>;
  pid: string;
  pc: RTCPeerConnection | null;
  flusso: MediaStream | null;
  /** candidati arrivati prima della descrizione dell'altro lato */
  attesa: RTCIceCandidateInit[];
  accesaLaggiu: boolean;
  vivo: boolean;
  ripeti: number;
  chiusura: number;
  iscritti: Set<Ascoltatore>;
}

let ascolto: Ascolto | null = null;
/** Quanto si aspetta prima di chiudere davvero: il tempo di un cambio pagina. */
const ATTESA_CHIUSURA = 6000;

function consegna(a: Ascolto, s: MediaStream | null) {
  a.flusso = s;
  for (const f of a.iscritti) {
    try {
      f(s);
    } catch {
      /* un componente smontato non deve fermare gli altri */
    }
  }
}

function chiudiAscolto(a: Ascolto) {
  clearInterval(a.ripeti);
  if (a.chiusura) clearTimeout(a.chiusura);
  if (a.pc) {
    try {
      a.pc.close();
    } catch {
      /* */
    }
  }
  a.pc = null;
  try {
    supabase.removeChannel(a.ch);
  } catch {
    /* */
  }
  if (ascolto === a) ascolto = null;
}

function apriAscolto(sess: string): Ascolto {
  const pid = nuovoPid();
  const ch = supabase.channel(canaleCamera(sess), { config: { broadcast: { self: false } } });
  const a: Ascolto = {
    sess,
    ch,
    pid,
    pc: null,
    flusso: null,
    attesa: [],
    accesaLaggiu: false,
    vivo: false,
    ripeti: 0,
    chiusura: 0,
    iscritti: new Set(),
  };

  /** Le misure dello schermo di chi guarda: sono il metro su cui si calcola la
   *  camerina, di qua e di là. Si rimandano a ogni annuncio perché il telefono
   *  si gira e la finestra si ridimensiona. */
  const mieMisure = () => ({
    w: typeof window === "undefined" ? 0 : window.innerWidth,
    h: typeof window === "undefined" ? 0 : window.innerHeight,
  });
  const dico = (event: string, payload: Record<string, unknown>) => {
    if (!a.vivo) return;
    try {
      void ch.send({ type: "broadcast", event, payload });
    } catch {
      /* */
    }
  };
  const stacca = () => {
    if (a.pc) {
      try {
        a.pc.close();
      } catch {
        /* */
      }
    }
    a.pc = null;
    a.attesa = [];
    consegna(a, null);
  };

  ch.on("broadcast", { event: CAM.stato }, ({ payload }: any) => {
    a.accesaLaggiu = deveRiannunciarsi(payload);
    if (a.accesaLaggiu) dico(CAM.ciao, { pid, vp: mieMisure() });
    else stacca();
  });

  ch.on("broadcast", { event: CAM.pip }, ({ payload }: any) => applicaPipRemoto(payload));

  ch.on("broadcast", { event: CAM.offerta }, async ({ payload }: any) => {
    if (!perMe(payload, pid) || !payload?.sdp) return;
    /*  Un'offerta nuova sostituisce la vecchia: il consulente ha riacceso, o
        ha cambiato camera. Tenersi quella di prima vorrebbe dire due video, di
        cui uno morto.
        ⚠️ MA L'IMMAGINE NON SI TOGLIE ADESSO: si lascia a schermo quella che
         c'è finché non arriva la traccia nuova. Toglierla qui vuol dire un
         buco nero di un paio di secondi a ogni riconnessione — che è
         esattamente quello che si vedeva. */
    if (a.pc) {
      try {
        a.pc.close();
      } catch {
        /* */
      }
    }
    const conn = new RTCPeerConnection({ iceServers: await serverDiRete() });
    a.pc = conn;
    const da = String(payload.from || "");
    //  ⚠️ `recvonly`: si riceve e basta. È questa riga a fare la differenza fra
    //   «vedi la mia faccia» e «il browser ti chiede la camera» — cioè fra
    //   questo link e una videochiamata.
    try {
      conn.addTransceiver("video", { direction: "recvonly" });
    } catch {
      /* browser vecchio: la direzione la decide comunque l'offerta */
    }
    conn.ontrack = (e) => {
      if (a.pc !== conn) return;
      consegna(a, e.streams[0] || new MediaStream([e.track]));
    };
    conn.onicecandidate = (e) => {
      if (e.candidate) dico(CAM.rete, { to: da, from: pid, c: e.candidate.toJSON() });
    };
    conn.onconnectionstatechange = () => {
      if (a.pc !== conn) return;
      /*  ── ⚠️ NON SI SPEGNE LA CAMERA PER UN SOBBALZO DI RETE ────────────
          Qui bastava un `disconnected` — il telefono che cambia antenna, il
          Wi-Fi che perde un colpo — perché il cerchio sparisse dallo schermo
          del cliente. Quasi sempre la connessione si riprende da sola un
          secondo dopo, e intanto lui ha visto la faccia del consulente
          svanire nel mezzo di una frase: è il «ogni tanto si nasconde da
          sola».
          Adesso l'immagine RESTA. Si chiede una connessione nuova (il
          consulente la rifà solo se è davvero morta, vedi
          `connessioneDaRifare`) e si toglie il cerchio solo quando non c'è
          più niente da mostrare: `failed`, o il consulente che dice «ho
          spento». */
      if (conn.connectionState === "disconnected") {
        dico(CAM.ciao, { pid, vp: mieMisure() });
        return;
      }
      if (conn.connectionState === "failed") {
        consegna(a, null);
        dico(CAM.ciao, { pid, vp: mieMisure() });
      }
    };
    try {
      await conn.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      /*  ── ⚠️ I CANDIDATI MESSI DA PARTE VANNO APPLICATI ADESSO ──────────
          È il guasto dello «schermo nero»: i candidati del consulente arrivano
          mentre qui si sta ancora aspettando (la prima offerta aspetta anche le
          credenziali TURN, che sono una chiamata di rete). Applicarli prima
          della descrizione non si può, e buttarli via vuol dire una strada in
          meno: la connessione si negozia, l'immagine non arriva mai e resta un
          cerchio nero. */
      for (const c of a.attesa) {
        try {
          await conn.addIceCandidate(new RTCIceCandidate(c));
        } catch {
          /* */
        }
      }
      a.attesa = [];
      const risposta = await conn.createAnswer();
      await conn.setLocalDescription(risposta);
      dico(CAM.risposta, { to: da, from: pid, sdp: conn.localDescription });
    } catch {
      stacca();
    }
  });

  ch.on("broadcast", { event: CAM.rete }, async ({ payload }: any) => {
    if (!perMe(payload, pid) || !payload?.c) return;
    const conn = a.pc;
    if (!conn || !candidatoApplicabile(conn)) {
      a.attesa.push(payload.c);
      return;
    }
    try {
      await conn.addIceCandidate(new RTCIceCandidate(payload.c));
    } catch {
      /* */
    }
  });

  ch.subscribe((s: string) => {
    a.vivo = s === "SUBSCRIBED";
    if (a.vivo) dico(CAM.ciao, { pid, vp: mieMisure() });
  });

  /*  ── ⚠️ SI RICHIEDE FINCHÉ NON SI VEDE ──────────────────────────────────
      Un annuncio perso — il canale che si riapre, la scheda tornata davanti, il
      consulente che accende mentre la rete del cliente sta ballando — non deve
      costare tutta la consulenza: senza questo il cliente resterebbe davanti al
      preventivo senza vedere mai la faccia di chi gliene parla, e l'unico
      rimedio sarebbe dirgli di ricaricare la pagina.
      Si chiede SOLO se il consulente ha detto di avere la camera accesa, e solo
      finché non arriva niente: a immagine arrivata smette da sé. */
  a.ripeti = setInterval(() => {
    //  ⚠️ «Riceve» non è «ha un flusso appeso»: un video fermo da più di
    //   qualche secondo è un cerchio nero, e va rifatto come se non ci fosse.
    const vivoDavvero = !!a.flusso && a.pc?.connectionState === "connected";
    if (!deveRichiedere({ vivo: a.vivo, riceve: vivoDavvero, accesaLaggiu: a.accesaLaggiu })) return;
    dico(CAM.ciao, { pid, vp: mieMisure() });
  }, 4000) as unknown as number;

  return a;
}

/** Si mette in ascolto della camera del consulente. Richiama `onFlusso` con il
 *  video quando arriva e con `null` quando il consulente spegne.
 *  Torna la funzione per smettere. */
export function seguiCameraLink(sess: string, onFlusso: Ascoltatore): () => void {
  const codice = String(sess ?? "").trim();
  if (!codice || typeof window === "undefined" || typeof RTCPeerConnection === "undefined")
    return () => {};

  //  Cambio di consulenza (non dovrebbe capitare, ma un link vecchio aperto in
  //  un'altra scheda basta): si chiude l'ascolto di prima.
  if (ascolto && ascolto.sess !== codice) chiudiAscolto(ascolto);
  if (!ascolto) ascolto = apriAscolto(codice);

  const a = ascolto;
  //  Era in chiusura per un cambio di pagina: si annulla, l'ascolto continua.
  if (a.chiusura) {
    clearTimeout(a.chiusura);
    a.chiusura = 0;
  }
  a.iscritti.add(onFlusso);
  //  Chi arriva a video già acceso lo vede SUBITO, senza aspettare il prossimo
  //  annuncio: è il cliente che passa dal preventivo ai media.
  if (a.flusso) {
    try {
      onFlusso(a.flusso);
    } catch {
      /* */
    }
  }

  return () => {
    a.iscritti.delete(onFlusso);
    if (a.iscritti.size > 0 || a.chiusura) return;
    a.chiusura = setTimeout(() => {
      a.chiusura = 0;
      if (a.iscritti.size === 0) chiudiAscolto(a);
    }, ATTESA_CHIUSURA) as unknown as number;
  };
}
