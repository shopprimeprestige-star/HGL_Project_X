// ════════════════════════════════════════════════════════════════════════
//  MEETLY — motore della videochiamata PERSISTENTE (WebRTC 1:1) + overlay.
//  Vive nel <Root>, quindi resta attiva anche cambiando pagina (SPA nav).
//  - audio/video bidirezionale (TURN Cloudflare via /api/public/turn)
//  - camera locale spostabile (PiP) sul dispositivo del cliente
//  - scambio camera: in "presentazione" il cliente vede la camera del
//    presentatore; il cliente può ingrandire la propria; il presentatore
//    decide/vede quale camera è grande sul cliente
//  - auto-duck: quando il presentatore parla, i video abbassano il volume
//  - trascrizione live (Web Speech) di entrambi + export PDF
//  - registrazione della chiamata (webm)
// ════════════════════════════════════════════════════════════════════════
import {
  Component,
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { sfx, primeSfx, setSfxBridge, setSpiaSuoni, suonaRemoto } from "@/shop/sfx";
//  Il conto dei suoni che partono sul dispositivo del cliente, e la riga da
//  lasciare nel diario: la regola sta fuori di qui e si prova senza browser.
import { conta, quanti, riassunto, type Conteggi } from "@/shop/conta-suoni";
//  Chi bussa è nuovo o è sempre lui? La regola — e il perché la campana
//  suonava ogni quattro secondi — sta tutta lì dentro.
import { chiaveBussata, esitoBussata } from "@/shop/bussata";
import { copyLink } from "@/shop/copied";
import { supabase } from "@/integrations/supabase/client";
import {
  frazioneDaMisura,
  misuraDaFrazione,
  pipLarghezzaDefault,
  pipLimiti,
  pipMisure,
  schermoLocale,
  type SchermoBase,
} from "@/shop/pip-misure";
//  Come si sparte la linea fra più flussi: aritmetica provata, vedi shop/banda.ts
import { fotogrammiMesh, listinoVideo, scalaMesh, scalaPerTetto, tettoInvio } from "@/shop/banda";
import { diagnosiLinea, percento } from "@/shop/diagnosi-linea";
import {
  avvisoCameraOspite,
  consiglioPerTantiOspiti,
  ospitiDi,
  pidDiRiferimento,
  statoCamereOspiti,
} from "@/shop/ospiti";
//  La soglia della voce quando parla anche l'altro (eco dagli altoparlanti):
//  aritmetica provata, vedi shop/soglia-voce.ts.
import { sogliaApertura, valvolaPuoSpegnere } from "@/shop/soglia-voce";
import { passoOratore, statoOratoreVuoto, type Misura } from "@/shop/oratore";
import { getQuoteRef } from "@/shop/quote-ref";
//  Dove una consulenza si conduce davvero (e dove invece si sta lavorando al
//  gestionale): vedi `quiSiConduce` e il riquadro «fai entrare».
import { quiSiConduce } from "@/shop/pagina-condivisa";
//  …e dove invece la richiesta di far entrare qualcuno deve comparire comunque,
//  perché non la sta guardando nessun altro: vedi shop/dove-si-ammette.
import {
  CANALE_FARO,
  faroDaScrivere,
  siAmmetteQui,
  unAltraSchermataLaMostra,
} from "@/shop/dove-si-ammette";
//  Una consulenza aperta resta aperta anche se questa scheda si ricarica: vedi
//  shop/consulenza-aperta (era la causa di «la gente entra e non li ammette»).
import {
  siChiudeLaConsulenza,
  siRiprendeLaConsulenza,
  type RigaConsulenza,
} from "@/shop/consulenza-aperta";
//  Quando una registrazione è vuota, e perché: la regola sta in
//  shop/registrazione (provata), qui c'è solo il registratore.
import {
  ATTESA_PRIMO_PEZZO_MS,
  cÈQualcosaDaRegistrare,
  catturaUsabile,
  perchéVuota,
  rischioStallo,
  audioRegistrabile,
  vociDaCollegare,
} from "@/shop/registrazione";
//  La sala d'attesa che non dipende dal canale: chi bussa si scrive sul
//  server, il consulente la legge di lì, e la decisione torna indietro anche
//  se il filo in tempo reale non c'è (shop/sala-attesa).
import type { StatoAttesa } from "@/shop/sala-attesa";
//  Per portare il consulente sulla pagina del preventivo quando apre quello
//  di una persona: è quella pagina che il cliente segue (api.presenter.curpage).
//  ⚠️ Si può usare perché <CallMount> è montato dentro la radice del router
//   (routes/__root): fuori di lì `useNavigate` si ferma.
import { useNavigate } from "@tanstack/react-router";
//  «Glielo preparo senza che lo veda»: l'interruttore sta in un file suo per
//  non chiudere un anello fra shop/call e shop/live (vedi il cartello lì).
//  «Il suo preventivo vince su tutto»: la precedenza sta in un file suo.
import {
  ascoltaMioPreventivo,
  restaSulMioPreventivo,
  segnaMioPreventivo,
} from "@/shop/mio-preventivo";
import { ascoltaMuti, eMuto, scambiaMuto, soloQuestiRestano } from "@/shop/ospiti-muti";
import { erroreDaMostrare } from "@/shop/errori-esterni";
import {
  improntaDeiProgrammi,
  programmiDellaPagina,
  versioneVecchia,
} from "@/shop/versione-vecchia";
import { avviaTela, type MotoreDiDisegno } from "@/shop/tela-registrazione";
import { cosaSta, inParole, segnaBlocco, staFacendo } from "@/shop/lentezza";
import {
  gettoneInMemoria,
  miaPersonaDi,
  ricordaPersona,
  tieniInMemoria,
} from "@/shop/gettone-cliente";
//  Il gettone scritto nel link: un link per ciascuno, nella stessa stanza.
import { gettoneDalLink } from "@/shop/chi-dal-link";
//  ⚠️ «L'ho accettato e non riesce a entrare»: la regola che impedisce lo
//   schermo nero a chi è appena entrato. Il perché, misurato, sta lì dentro.
import { stanzaAncoraVuota } from "@/shop/stanza-ancora-vuota";
import { registraAnnuncioPagina } from "@/shop/annuncio-pagina";
import { registraAzzeraZoom } from "@/shop/zoom-ospite";
import { dimenticaStatoStanza, pubblicaStatoStanza, statoStanzaOra } from "@/shop/stato-stanza";
import { registraAnnuncioRegia } from "@/shop/annuncio-regia";
import {
  chiEInLinea,
  firmaDegliAttesi,
  haIlSuo,
  leggiRegia,
  personaDaAdottare,
  personeDelPannello,
  type RegiaGruppo,
} from "@/shop/preventivi-di-gruppo";
import { PlanciaGruppo, useAttesiDelConsulente } from "@/shop/PlanciaGruppo";
import { ancoraDentro, segnaChiCÈ, type MemoriaPresenze } from "@/shop/chi-e-ancora-dentro";
import { prossimaCamera, siPuoGirare } from "@/shop/gira-camera";
import { verdettoSuOspite } from "@/shop/resta-in-lista";
import { cambiaRegia, useRegiaGruppo } from "@/shop/regia-gruppo";
//  Come si dispongono le camere: quadrate, tutte uguali, grandi quanto l'area
//  lo consente (shop/griglia-camere).
import { disposizioneQuadrata } from "@/shop/griglia-camere";
//  E che cosa provare quando la camera non si apre (shop/apertura-camera).
import {
  esitoApertura,
  spiegaErroreMedia,
  tentativiMedia,
  type Tentativo,
} from "@/shop/apertura-camera";
import { setSpeaking } from "@/shop/duck";
import { getPresenter } from "@/shop/presenter";
import { BrandLogo } from "@/shop/BrandLogo";
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  MonitorUp,
  PhoneCall,
  Circle,
  Square,
  FileDown,
  Users,
  User,
  ScrollText,
  X,
  Layout,
  Minus,
  Plus,
  Check,
  ExternalLink,
  RotateCcw,
  MessageCircle,
  Send,
  Copy,
  Pin,
  PinOff,
  Ban,
  UserX,
  ShieldOff,
  Disc3,
  Sparkles,
  ChevronDown,
  SlidersHorizontal,
  Brush,
  Move,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  Clock3,
  FlipHorizontal,
  Activity,
  SwitchCamera,
  MonitorSmartphone,
  Smartphone,
  Tablet,
  Monitor,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { createPortal } from "react-dom";

/* eslint-disable @typescript-eslint/no-explicit-any */

type Role = "host" | "viewer";
type Primary = "presenter" | "client"; // quale camera è GRANDE sul dispositivo del cliente
// Cosa vede il guest sul suo dispositivo:
//  content       = i contenuti (preventivo/slide/sito) + PiP camera consulente (guest NON può cambiarlo)
//  call          = videochiamata 2 camere (grande + PiP), il guest può toccare per invertire
//  presenter     = SOLO la camera del consulente a tutto schermo
//  client        = SOLO la camera del guest a tutto schermo
type Mode = "content" | "call" | "presenter" | "client";
// Feature 4 — camere piccole (PiP) mostrate al guest mentre il presentatore trasmette contenuti
//  showMine  = mostra la MIA (presentatore) camera piccola sul guest
//  showGuest = mostra anche la camera del CLIENTE (la sua) in piccolo
//  which     = quale è la principale (più in evidenza) quando sono attive entrambe
type ContentCam = { showMine: boolean; showGuest: boolean; which: "me" | "guest" };
export interface TransLine {
  who: Role;
  text: string;
  t: number;
}
export interface Participant {
  pid: string;
  name: string;
  role: Role;
  camOn: boolean;
  /** ── IL NOME DELLA SCHEDA, SOLO PER IL CONSULENTE ────────────────────
   *  `name` è quello che vedono tutti — nome di battesimo e iniziale, o
   *  quello digitato. `nomeVero` è nome e cognome dell'archivio, e resta su
   *  questa scheda: non entra mai in `broadcastRoster`, perché il cognome di
   *  un cliente non si consegna a chi gli siede accanto in videochiamata. */
  nomeVero?: string;
  /** La scheda CRM di questa persona: apre il suo preventivo con un clic. */
  leadId?: string;
  /** Il suo dispositivo dichiara di stare sul PROPRIO preventivo, e quindi di
   *  non seguire più la modalità del consulente. Vedi `statoDelloSchermo`. */
  suo?: boolean;
}
/** Viewport REALE del dispositivo dell'ospite: serve al presentatore per
 *  dimensionare l'anteprima esattamente come il telefono del cliente. */
export interface GuestViewport {
  w: number;
  h: number;
  dpr: number;
  portrait: boolean;
}
// Feature 5 — messaggio di chat privata 1:1 (inviato + ricevuto)
export interface BlockedDevice {
  id: string;
  name: string;
  at: string;
}
export interface ChatMsg {
  from: string;
  fromName: string;
  to: string;
  text: string;
  t: number;
}

interface State {
  role: Role | null;
  sessionId: string | null;
  active: boolean; // chiamata avviata dall'host
  pendingStart: boolean; // l'host sta impostando i nomi prima di avviare
  joined: boolean; // il cliente ha accettato camera/mic
  connected: boolean;
  camOn: boolean;
  micOn: boolean;
  sharing: boolean;
  mode: Mode; // cosa vede il guest
  primary: Primary; // in modalità "call": camera grande sul guest
  clientChose: Primary | null; // scelta esplicita del guest (mostrata all'host)
  contentCam: ContentCam; // Feature 4 — in "content": quali camere piccole (PiP) vede il guest
  presenterName: string;
  guestName: string;
  myQuality: Quality;
  guestQuality: Quality;
  /** ── COM'È MESSA LA LINEA, SCRITTA DOVE SI VEDE ────────────────────────
   *  Questi numeri il programma li misurava già, ma finivano solo in console:
   *  davanti a una consulenza che si impunta nessuno apre la console. Qui
   *  diventano una riga leggibile accanto alla qualità, così si decide sui
   *  fatti invece che a sensazione.
   *   · `kbit`  quanto regge la salita adesso (il peggiore fra gli interlocutori)
   *   · `ponte` il video passa da un server d'appoggio invece che diretto
   *   · `limite` chi sta frenando il video: "cpu", "rete" o niente
   *   · `rttMs` quanto ci mette un pacchetto ad andare e tornare
   *   · `persiSu` la frazione che l'ALTRO dichiara di perdere su quello che
   *     gli mandiamo; `persiGiu` quella che perdiamo NOI su quello che manda
   *     lui. Sono i due percorsi separati, ed è l'unico modo di rispondere
   *     alla domanda «di chi è la colpa» invece di dire «è la linea».
   *     ⚠️ Da questi cinque numeri `shop/diagnosi-linea` ricava il colpevole:
   *      qui si MISURA soltanto, il giudizio sta tutto in quel file, che si
   *      può provare senza una videochiamata vera. */
  linea: {
    kbit: number;
    ponte: boolean;
    limite: "cpu" | "rete" | "";
    rttMs: number;
    persiSu: number;
    persiGiu: number;
  } | null;
  /** ── LATO OSPITE: LA CAMERA L'HA SPENTA IL CONSULENTE ───────────────────
   *  L'ospite non ha comandi suoi: la sua camera la governa il presentatore.
   *  Quando gliela spegne, senza una riga scritta lui vede semplicemente la
   *  propria immagine sparire — e pensa che si sia rotto qualcosa, o che sia
   *  caduta la linea. Questo segno serve solo a poterglielo dire, e a offrirgli
   *  di riaccenderla: è la sua camera. */
  camSpentaDalConsulente: boolean;
  /** ── LA MIA CAMERA NON SI È APERTA, ED È SCRITTO ────────────────────────
   *  Vale per chiunque stia davanti a questo schermo (consulente o cliente).
   *  Prima l'errore finiva in un `catch` muto: ci si vedeva addosso «camera
   *  spenta» senza un perché, e dall'altra parte il rettangolo grigio. Qui c'è
   *  la frase da mostrare, già scritta per una persona (shop/apertura-camera),
   *  oppure `null` quando è tutto a posto. */
  mediaAvviso: string | null;
  /** ── LATO OSPITE: IL CONSULENTE HA CHIESTO DI ACCENDERLA ────────────────
   *  Riaccendere la camera è `getUserMedia`, e il browser la concede a certe
   *  condizioni — permesso ancora valido, camera libera, e su iPhone spesso un
   *  TOCCO della persona. Un comando che arriva dal canale non è un tocco.
   *  Quando l'apertura non riesce resta questa richiesta, e all'ospite si
   *  mostra un pulsante: il suo dito è esattamente quello che mancava. */
  camChiestaDalConsulente: boolean;
  /** Lo stesso, per il microfono: «non ti sento» capita anche con la faccia
   *  perfettamente visibile, ed è una richiesta che prima non esisteva. */
  micChiestoDalConsulente: boolean;
  /** ── LATO PRESENTATORE: LA CAMERA DI QUELL'OSPITE NON SI È APERTA ───────
   *  Senza questo, premere «accendi» e non vedere accadere niente era
   *  indistinguibile da un comando che non funziona — ed è esattamente così
   *  che è stato segnalato. */
  camNegata: { pid: string; at: number } | null;
  recording: boolean;
  autoRecArmed: boolean; // cattura schermo già ottenuta: la registrazione partirà da sola
  recScreen: boolean; // true = sto registrando lo SCHERMO, false = solo le camere (compositor)
  sessionLive: boolean; // true tra "Avvia videochiamata" e chiusura: prima il guest vede l'attesa
  diag: string;
  transcript: TransLine[];
  myPid: string; // id univoco del mio peer (mesh)
  myName: string; // il MIO nome (host=presentatore, viewer=ospite)
  roster: Participant[]; // gli ALTRI partecipanti (self escluso)
  guestViewport: GuestViewport | null; // dimensioni reali dello schermo dell'ospite (lato presentatore)
  focusPid: string | null; // Feature 3 — partecipante mostrato a schermo intero (modalità "client"/target)
  speakerPip: boolean; // Feature 4 — PiP che segue chi parla mentre il presentatore condivide lo schermo
  /** PiP CONDIVISA — posizione NORMALIZZATA (0..1 dell'area libera) della camera
   *  piccola durante i contenuti. È la STESSA su presentatore e ospite: chi la
   *  trascina la sposta anche dall'altra parte (evento `pippos`). Normalizzata
   *  perché schermi diversi hanno pixel diversi: la frazione resta coerente. */
  pipPos: { x: number; y: number };
  /** ── LA MISURA DELLA PiP VIAGGIA IN FRAZIONE, NON IN PIXEL ───────────────
   *  Il presentatore la allarga sul suo monitor e il cliente la vede allargata
   *  sul suo telefono: 320px là e 320px qua vorrebbero dire due cose diverse,
   *  quindi si trasmette la QUOTA DI LARGHEZZA DELLO SCHERMO (0..1) e ognuno la
   *  riconverte nei propri pixel, dentro i propri limiti.
   *  null = nessuno l'ha ancora imposta: vale la misura locale. */
  pipFrazione: number | null;
  activeSpeakerPid: string | null; // Feature 4 — pid del partecipante più "forte" (broadcast ai guest)
  speakingPids: string[]; // chi sta parlando ADESSO — calcolato in locale su OGNI dispositivo
  guestCode: string | null; // codice del canale che l'OSPITE deve usare (link ?watch= oppure sessione viva adottata)
  /** (OSPITE) Sul server c'è una consulenza viva, ma con un codice DIVERSO dal
   *  proprio: l'invito che ha in mano appartiene a un'altra sessione. Prima
   *  restava sulla schermata d'attesa in silenzio, per sempre. */
  superseded: boolean;
  // ── SALA D'ATTESA ────────────────────────────────────────────────────────
  //  L'ospite non entra da solo: bussa, e il presentatore decide.
  shareShape: "auto" | "mobile" | "tablet" | "desktop"; // forma dell'inquadratura dello schermo condiviso
  knocking: boolean; // (ospite) ha bussato, attende il consenso
  refused: boolean; // (ospite) ingresso rifiutato
  /** ── ⚠️ IL CLIENTE SI PREPARA MENTRE ASPETTA ──────────────────────────
   *  Segnalazione del committente: «l'ingresso è troppo lento, lo vorrei
   *  istantaneo». Non era una sensazione: finché il consulente non avviava, il
   *  cliente vedeva SOLO «la tua videoconsulenza sta per iniziare». Tutto il
   *  suo lavoro — scrivere il nome, dare il permesso alla camera, bussare —
   *  cominciava DOPO l'avvio, con il consulente già davanti allo schermo ad
   *  aspettare. Un minuto buono di niente, ogni volta.
   *  Ora il nome e i permessi si danno PRIMA, durante l'attesa: quando la
   *  consulenza si avvia, il cliente bussa da solo e l'ingresso è immediato. */
  pronto: boolean;
  knocks: {
    pid: string;
    name: string;
    dev: string;
    at: number;
    atteso?: boolean;
    leadId?: string;
  }[]; // (presentatore) in attesa
  /** ── LA PORTA LASCIATA APERTA ─────────────────────────────────────────
   *  Richiesta del committente: «fai entrare da solo chi è in elenco… e
   *  possono entrare anche se non sono in elenco».
   *  Con la porta aperta chi bussa entra subito, senza che il consulente
   *  prema niente: è il modo in cui si riceve un gruppo che arriva tutto
   *  insieme mentre si sta già parlando con il primo.
   *  ⚠️ APERTA VUOL DIRE APERTA, anche per chi non era atteso — il link
   *   inoltrato a un amico entra. Per questo chi entra senza essere in
   *   elenco lascia un avviso, con «mandalo fuori» a portata di mano. */
  portaAperta: boolean;
  /** Chi è entrato dalla porta aperta senza essere fra gli attesi. */
  entrateLibere: { pid: string; nome: string; at: number }[];
  /** Chi era atteso in questa stanza, con il nome intero della scheda. */
  attesi: { gettone: string; nome: string; leadId: string }[];
  chat: ChatMsg[]; // Feature 5 — messaggi privati 1:1 (inviati + ricevuti)
  blurOn: boolean; // PRESENTATORE: sfocatura dello sfondo attiva
  blurLevel: 1 | 2 | 3 | 4; // intensità dello sfondo: leggera → massima
  blurSeg: boolean; // true = segmentazione vera attiva (persona nitida); false = sfocatura piena
  /** ── COME MI VEDO IO ────────────────────────────────────────────────────
   *  La MIA camera ribaltata a specchio, come allo specchio di casa: alzo la
   *  mano destra e sullo schermo si alza quella dalla stessa parte.
   *  ⚠️ Vale SOLO per questo dispositivo, ed è una scelta di sola visione: agli
   *  altri l'immagine continua ad arrivare DRITTA. Ribaltarla in partenza
   *  significherebbe mandare al cliente ogni scritta al contrario — un foglio,
   *  un cartellino, il campione che gli mostro davanti alla camera. */
  specchio: boolean;
  audio: AudioPrefs; // PRESENTATORE: soppressione rumore + soglia di attivazione
  guestVeil: boolean; // OSPITE: velo di caricamento attivo (contenuti non ancora pronti)
  kicked: "" | "removed" | "blocked"; // OSPITE: rimosso/bloccato dal presentatore
  blocked: BlockedDevice[]; // PRESENTATORE: dispositivi bloccati (server-side)
  /** PRESENTATORE — ultimo errore di render segnalato dal dispositivo del cliente.
   *  L'ospite NON vede mai una schermata tecnica: mostra il caricamento brandizzato
   *  e si auto-ripristina; è il presentatore a essere avvisato (badge + "Ricarica"). */
  guestError: { msg: string; at: number; from: string; name: string } | null;
}
// ── PREFERENZE AUDIO DEL MICROFONO (per presentatore, salvate sul server) ──
//  ns     = soppressione rumore di fondo (constraint standard getUserMedia)
//  gate   = soglia di attivazione attiva/disattiva
//  gateDb = livello in dBFS sotto il quale il microfono resta CHIUSO
export interface AudioPrefs {
  ns: boolean;
  gate: boolean;
  gateDb: number;
  preset: AudioPreset;
}
export type AudioPreset = "consigliata" | "rumoroso" | "sensibile" | "custom";
// DEFAULT — scelto per la voce parlata in videochiamata:
//  la voce a distanza di braccio da un microfono di laptop sta tra −30 e −15 dBFS,
//  mentre ventola/tastiera/brusio stanno sotto i −50 dBFS. −45 dBFS sta nel mezzo:
//  abbastanza aperto da non tagliare le parole sussurrate o le code di frase,
//  abbastanza chiuso da non trasmettere il rumore di fondo della stanza.
//  Non aggressivo: preferiamo un falso "aperto" a una sillaba tagliata.
export const AUDIO_DEFAULT: AudioPrefs = {
  ns: true,
  gate: true,
  gateDb: -45,
  preset: "consigliata",
};
export const AUDIO_PRESET_DB: Record<Exclude<AudioPreset, "custom">, number> = {
  consigliata: -45, // uso normale (default)
  rumoroso: -35, // ufficio/bar: chiude prima, lascia passare solo la voce vicina
  sensibile: -55, // stanza silenziosa / voce lontana: apre quasi sempre
};
const AUDIO_KEY = "hg_audio_prefs";

type Quality = "low" | "med" | "high";
const QUALITY: Record<Quality, { w: number; h: number; fr: number; br: number }> = {
  low: { w: 640, h: 360, fr: 15, br: 600_000 },
  med: { w: 960, h: 540, fr: 30, br: 1_400_000 },
  high: { w: 1280, h: 720, fr: 30, br: 2_500_000 },
};

const initial: State = {
  role: null,
  sessionId: null,
  active: false,
  pendingStart: false,
  joined: false,
  connected: false,
  camOn: true,
  micOn: true,
  sharing: false,
  mode: "content",
  primary: "presenter",
  clientChose: null,
  contentCam: { showMine: true, showGuest: false, which: "me" },
  presenterName: "",
  guestName: "",
  myQuality: "high",
  guestQuality: "high",
  linea: null,
  camSpentaDalConsulente: false,
  mediaAvviso: null,
  camChiestaDalConsulente: false,
  micChiestoDalConsulente: false,
  camNegata: null,
  recording: false,
  autoRecArmed: false,
  recScreen: false,
  sessionLive: false,
  superseded: false,
  diag: "",
  transcript: [],
  myPid: "",
  myName: "",
  roster: [],
  guestViewport: null,
  focusPid: null,
  speakerPip: false,
  activeSpeakerPid: null,
  speakingPids: [],
  guestCode: null,
  shareShape: "auto",
  knocking: false,
  refused: false,
  pronto: false,
  knocks: [],
  portaAperta: false,
  entrateLibere: [],
  attesi: [],
  pipPos: { x: 0.03, y: 0.03 },
  pipFrazione: null,
  chat: [],
  blurOn: false,
  blurLevel: 2,
  blurSeg: false,
  specchio: true,
  audio: { ...AUDIO_DEFAULT },
  guestVeil: false,
  kicked: "",
  blocked: [],
  guestError: null,
};
/** Specchiatura della PROPRIA immagine: ricordata su QUESTO dispositivo.
 *  Di partenza è accesa perché è così che ci si vede allo specchio (e in tutte
 *  le videochiamate): muovendo una mano ci si aspetta di vederla dalla stessa
 *  parte. Chi preferisce il contrario lo spegne una volta e resta spento. */
const SPECCHIO_KEY = "hg_specchio";
// preferenze sfocatura ricordate tra una chiamata e l'altra
try {
  if (typeof localStorage !== "undefined") {
    initial.blurOn = localStorage.getItem("hg_blur_on") === "1";
    const l = Number(localStorage.getItem("hg_blur_level"));
    if (l === 1 || l === 2 || l === 3 || l === 4) initial.blurLevel = l;
    initial.specchio = localStorage.getItem(SPECCHIO_KEY) !== "0"; // assente = acceso
    // specchio locale delle preferenze audio: valgono SUBITO, poi arrivano dal server
    const a = JSON.parse(localStorage.getItem(AUDIO_KEY) || "null");
    if (a && typeof a === "object") initial.audio = normAudio(a);
  }
} catch {
  /* */
}

// ── singleton ──────────────────────────────────────────────────────────
const S = { ...initial };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
function set(p: Partial<State>) {
  Object.assign(S, p);
  emit();
}

// ── LA FORMA DELLO SCHERMO DEL CLIENTE ARRIVA ANCHE NELL'ANTEPRIMA ─────────
//  Su DESKTOP la pagina dei contenuti (Media, Link, Slide, Preventivo) non gira
//  nella finestra del presentatore: gira DENTRO l'iframe dell'anteprima
//  dispositivo (?embed=1) creato da DeviceFrame. Lì il motore della chiamata è
//  spento di proposito (vedi CallMount: `embed=1` → nessun secondo motore), e
//  quindi `S` resta quello iniziale: `useCall().guestViewport` vale SEMPRE null.
//  Conseguenza concreta e visibile solo su desktop: la pagina Media disegna il
//  riquadro a 16/9 invece che nella forma REALE del telefono del cliente, quindi
//  l'inquadratura che il presentatore vede non è quella che sta mandando
//  (bordi e ritagli diversi da quelli veri).
//  Il valore vero lo conosce solo la finestra ESTERNA: lo rispecchia qui, e
//  l'anteprima lo rilegge — stessa origine, stesso localStorage, e l'evento
//  `storage` avvisa l'iframe a ogni cambio senza bisogno di alcun polling.
const GUEST_VP_KEY = "hg_guest_vp";
/** true se questo contesto è l'anteprima dispositivo del presentatore (iframe interno). */
function inAnteprimaDispositivo(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      new URLSearchParams(window.location.search).get("embed") === "1" || window.self !== window.top
    );
  } catch {
    return true;
  } // window.top inaccessibile = siamo comunque dentro una cornice
}
/** Rilegge il rispecchio validando OGNI campo: quello che sta in archivio può
 *  essere vecchio, incompleto o non avere affatto la forma dichiarata. */
function leggiGuestVpRispecchiato(): GuestViewport | null {
  try {
    const j = JSON.parse(
      localStorage.getItem(GUEST_VP_KEY) || "null",
    ) as Partial<GuestViewport> | null;
    const w = Math.round(Number(j?.w)),
      h = Math.round(Number(j?.h));
    if (!(w > 0 && h > 0)) return null;
    const dpr = Number(j?.dpr) > 0 ? Number(j?.dpr) : 1;
    return { w, h, dpr, portrait: j?.portrait !== false };
  } catch {
    return null;
  }
}
/** UNICO punto in cui si registra la forma dello schermo del cliente. */
function applicaGuestViewport(vp: GuestViewport) {
  set({ guestViewport: vp });
  // scrive SOLO la finestra esterna: l'anteprima è un lettore, mai un autore
  // (altrimenti due contesti si sovrascriverebbero a vicenda).
  if (typeof window === "undefined" || inAnteprimaDispositivo()) return;
  try {
    localStorage.setItem(GUEST_VP_KEY, JSON.stringify(vp));
  } catch {
    /* rispecchio: se non si può scrivere, pazienza */
  }
}
if (typeof window !== "undefined" && inAnteprimaDispositivo()) {
  const vp0 = leggiGuestVpRispecchiato();
  if (vp0) S.guestViewport = vp0; // prima del primo render: niente 16/9 di passaggio
  window.addEventListener("storage", (e) => {
    if (e.key !== GUEST_VP_KEY) return;
    const v = leggiGuestVpRispecchiato();
    if (!v) return;
    const c = S.guestViewport;
    if (c && c.w === v.w && c.h === v.h && c.dpr === v.dpr) return;
    set({ guestViewport: v });
  });
}

// ── MESH: una connessione per ogni altro partecipante ─────────────────────
let localStream: MediaStream | null = null;
const peers = new Map<string, RTCPeerConnection>();
const remoteStreams = new Map<string, MediaStream>();
const pendingIce = new Map<string, RTCIceCandidateInit[]>();
const lastSeen = new Map<string, number>();
/** pid → istante del PRIMO hello (serve a scartare i segnaposto "connessione…" eterni). */
const firstSeen = new Map<string, number>();
/** pid → da quando la RTCPeerConnection è in stato failed/closed/disconnected. */
const badSince = new Map<string, number>();
let chan: ReturnType<typeof supabase.channel> | null = null;
let helloTimer: ReturnType<typeof setInterval> | null = null;
let gcTimer: ReturnType<typeof setInterval> | null = null;
let rosterTimer: ReturnType<typeof setInterval> | null = null;
let recorder: MediaRecorder | null = null;
/** ── CHIUDERE DAVVERO, NON CAMBIARE PARTE ─────────────────────────────────
 *  Da quando la registrazione si taglia in parti (vedi `toggleRecording`),
 *  `recorder.stop()` da solo NON vuol più dire «finito»: è anche il modo in
 *  cui una parte si chiude per lasciare posto alla successiva. Chi vuole
 *  davvero finire passa da qui, che alza la bandierina e poi ferma.
 *  ⚠️ Senza, premere stop avrebbe archiviato l'ultima parte e riaperto subito
 *   una registrazione nuova: le camere restano accese e nessuno capisce
 *   perché il pallino rosso non si spegne. */
let chiudiRegistrazione: (() => void) | null = null;
/*  ⚠️ IL SECCHIO DEI PEZZI NON È PIÙ UNO SOLO PER TUTTI. Stava qui, a livello
    di modulo, e ogni avvio lo svuotava: fermare una registrazione non è
    istantaneo — gli ultimi pezzi arrivano un momento DOPO, in `onstop` — e se
    nel frattempo ne partiva un'altra (succede da sola all'ingresso di un
    ospite) la nuova svuotava il secchio della vecchia, che chiudeva un file
    senza niente dentro. Era la «Registrazione vuota». Adesso ogni
    registrazione tiene i suoi pezzi nella propria chiusura, e nessun'altra
    può toccarli (vedi `startRecordingWith`). */
let recognition: any = null;
let vad: { ctx: AudioContext; raf: number; src: MediaStreamAudioSourceNode } | null = null;
const streamSubs = new Set<() => void>();
const emitStreams = () => streamSubs.forEach((f) => f());
const spokenSubs = new Set<(text: string) => void>();
// I browser mobili bloccano l'autoplay CON audio finché non c'è un gesto utente:
// il primo tap riattiva l'audio di TUTTI i video remoti (fix "no audio sul guest").
let unmuteHooked = false;
function hookUnmute() {
  if (unmuteHooked || typeof document === "undefined") return;
  unmuteHooked = true;
  const h = () => {
    document.querySelectorAll("video").forEach((v: any) => {
      if (!v.dataset || v.dataset.keepmuted !== "1") {
        v.muted = false;
        v.play?.().catch(() => {});
      }
    });
  };
  document.addEventListener("pointerdown", h, true);
}
/** Registra un handler per il testo pronunciato dal presentatore (teleprompter). */
export function onSpoken(cb: (text: string) => void): () => void {
  spokenSubs.add(cb);
  return () => {
    spokenSubs.delete(cb);
  };
}

const FALLBACK_ICE: RTCIceServer[] = [
  { urls: ["stun:stun.cloudflare.com:3478", "stun:stun.l.google.com:19302"] },
];
// ICE servers cache: prefetched UNA volta all'apertura media così makePeer resta
// SINCRONO. Bug reale: makePeer era async (await fetch dentro) e faceva peers.set
// SOLO dopo l'await → due hello ravvicinati creavano DUE RTCPeerConnection e DUE
// offerte per lo stesso pid (glare/duplicato) e la negoziazione non si chiudeva mai.
let cachedIce: RTCIceServer[] = FALLBACK_ICE;
/** Quando sono state prese le credenziali TURN attuali. Servono a sapere se
 *  sono vecchie: quelle di Cloudflare SCADONO, e una riconnessione tentata con
 *  credenziali scadute si vede solo come schermo nero. */
let iceFetchedAt = 0;
/** ── ⚠️ SENZA TURN LA CHIAMATA SEMBRA FUNZIONARE, POI MUORE ────────────────
 *  Se questa chiamata fallisce si resta sui soli STUN: sulla stessa rete Wi-Fi
 *  va tutto bene — ed è per questo che il guasto non si vede provando in
 *  ufficio — ma fra due reti diverse (laptop + telefono in 4G) il media non
 *  passa, o passa per qualche secondo e poi si ferma appena il percorso
 *  diretto cade. Un fallimento silenzioso qui è il modo più rapido per
 *  cercare il problema dalla parte sbagliata: adesso si riprova e, se proprio
 *  non si riesce, resta scritto in console. */
async function prefetchIce(forza = false): Promise<void> {
  //  Le credenziali durano a lungo, ma non per sempre: dopo mezz'ora si
  //  richiedono comunque, così una riconnessione non parte con roba scaduta.
  if (!forza && cachedIce !== FALLBACK_ICE && Date.now() - iceFetchedAt < 30 * 60_000) return;
  for (let tentativo = 0; tentativo < 2; tentativo++) {
    try {
      const j = await (await fetch("/api/public/turn", { cache: "no-store" })).json();
      if (Array.isArray(j.iceServers) && j.iceServers.length) {
        cachedIce = j.iceServers;
        iceFetchedAt = Date.now();
        if (!j.hasTurn)
          console.warn("[ICE] nessun TURN configurato: la chiamata reggerà solo sulla stessa rete");
        return;
      }
    } catch {
      /* si riprova una volta sola */
    }
  }
  console.error(
    "[ICE] credenziali TURN non ottenute: si va di soli STUN, la chiamata può cadere fra reti diverse",
  );
}

/** L'indirizzo di una stanza Meetly, vecchio nome compreso: i link
 *  /videochiamata/… già in mano ai clienti rimandano al nuovo percorso, ma il
 *  riconoscimento deve valere anche nell'istante prima del rimando.
 *  Ripetuto qui e non importato da live.ts di proposito: live.ts importa questo
 *  file, e un anello fra i due moduli romperebbe l'avvio della pagina. */
const STANZA_RE = /^\/(?:meetly|videochiamata)\/([^/?#]+)/;

/** Il codice della consulenza dall'indirizzo: /meetly/kfr-mbqd-tzp
 *  oppure ?watch=kfr-mbqd-tzp (forma vecchia, ancora valida). */
function watchIdDaIndirizzo(): string | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search).get("watch");
  if (q) return q;
  const m = STANZA_RE.exec(window.location.pathname);
  return m ? decodeURIComponent(m[1]) : null;
}

const isViewer = () => S.role === "viewer";

// ── OSPITE: ingresso "appiccicoso" ────────────────────────────────────────
//  Una volta che l'ospite è entrato (nome inserito) NON deve MAI tornare alla
//  schermata d'attesa o al gate del nome per il resto della sessione: solo un
//  kick/ban o la chiusura esplicita della chiamata dal presentatore possono
//  farlo uscire (e hanno le loro schermate dedicate).
//  BUG STORICO: qualsiasi scheda del presentatore che riceve l'`hello` risponde
//  con broadcastState(); se quella scheda non aveva `sessionLive` (es. ricaricata,
//  oppure seconda scheda che ha solo adottato il codice sessione) mandava
//  sessionLive:false e l'ospite rimbalzava in attesa → loop infinito.
let guestSticky = false;
/** ── ⚠️ IL CANALE VALE PIÙ DEL SERVER, QUANDO PARLA ───────────────────────
 *  Segnalazione del committente: «l'utente fa entra ed esci».
 *  Il cliente veniva rimandato in attesa quando il server diceva che il
 *  battito del consulente era scaduto — anche mentre il consulente era lì, sul
 *  canale, a mandare la sua presenza. Succede quando il battito finisce su una
 *  riga diversa da quella che il cliente legge: basta un codice sessione
 *  disallineato fra le due parti, e il cliente vede sparire una consulenza che
 *  sta succedendo davanti ai suoi occhi.
 *  Qui si segna QUANDO si è sentito il consulente sul canale. Se lo si è
 *  sentito da poco, il verdetto del server non lo butta fuori: un messaggio
 *  arrivato adesso è una prova più forte di un battito che manca. */
let presentatoreVistoIl = 0;
const presentatoreVistoOra = () => {
  presentatoreVistoIl = Date.now();
};
const PRESENTATORE_APPENA_VISTO_MS = 20_000;
export function guestStickyOn() {
  return guestSticky;
}
const send = (event: string, payload: any) => chan?.send({ type: "broadcast", event, payload });
//  CAUSA REALE DEL "LAMPEGGIO" DELL'OSPITE: una scheda presentatore che NON è in
//  diretta (seconda scheda, scheda ricaricata, pagina rimasta aperta) rispondeva
//  comunque a ogni `hello` con un callstate `active:false / sessionLive:false`.
//  L'ospite lo trattava come autorevole → teardownMedia() → roster svuotato e
//  schermata cambiata; subito dopo arrivava il callstate VERO (`active:true`) →
//  riapertura media → nuovo hello → nuova risposta della scheda fantasma → loop.
//  Da qui in poi: SOLO una scheda realmente in diretta trasmette lo stato.
// ── REGISTRO DIAGNOSTICO ────────────────────────────────────────────────────
//  Tutto ciò che il programma scrive in console viene conservato qui, insieme
//  agli eventi della chiamata. Serve a capire cosa è successo su un dispositivo
//  che non si può ispezionare — il telefono del cliente, tipicamente.
export interface LogRow {
  t: number;
  lvl: string;
  msg: string;
}
const LOG_MAX = 500;
const logRows: LogRow[] = [];
const logSubs = new Set<() => void>();
let logHooked = false;
export function dlog(msg: string, lvl = "app") {
  logRows.push({ t: Date.now(), lvl, msg: String(msg).slice(0, 500) });
  if (logRows.length > LOG_MAX) logRows.splice(0, logRows.length - LOG_MAX);
  logSubs.forEach((f) => {
    try {
      f();
    } catch {
      /* */
    }
  });
}
function hookConsole() {
  if (logHooked || typeof console === "undefined") return;
  logHooked = true;
  (["log", "warn", "error"] as const).forEach((k) => {
    const orig = console[k].bind(console);
    console[k] = (...a: unknown[]) => {
      try {
        const line = a
          .map((x) =>
            typeof x === "string"
              ? x
              : (() => {
                  try {
                    return JSON.stringify(x);
                  } catch {
                    return String(x);
                  }
                })(),
          )
          .join(" ");
        if (/^\[(CALL|GUEST|HOST|PEER|CAM|MIC|SCROLL|REC|SLIDE|QUOTE|SCHERMO|APP)\]/.test(line))
          dlog(line, k);
      } catch {
        /* */
      }
      orig(...a);
    };
  });
}
export function useDebugLog(): LogRow[] {
  hookConsole();
  const [, bump] = useState(0);
  useEffect(() => {
    const f = () => bump((n) => n + 1);
    logSubs.add(f);
    return () => {
      logSubs.delete(f);
    };
  }, []);
  return logRows;
}
/** Fotografia dello stato: la prima cosa da guardare quando qualcosa non torna. */
export function debugSnapshot(): string {
  const st = S;
  return [
    `ruolo=${st.role} modalità=${st.mode} attiva=${st.active} sessioneViva=${st.sessionLive} entrato=${st.joined}`,
    `codiceSessione=${st.sessionId} mioPid=${st.myPid} nome=${st.myName} presentatore=${st.presenterName}`,
    `camera=${st.camOn} microfono=${st.micOn} condivisione=${st.sharing} focus=${st.focusPid} contentCam=${st.contentCam}`,
    `connessioni=${peers.size} flussiRemoti=${remoteStreams.size} partecipanti=${st.roster.length} inAttesa=${st.knocks.length}`,
    `puòTrasmettereStato=${canBroadcastState()} indirizzo=${typeof location !== "undefined" ? location.pathname + location.search : "?"}`,
  ].join("\n");
}

const canBroadcastState = () => S.role !== "host" || S.sessionLive || S.active;

/*  ── ⚠️ CHE COSA VEDE IL CLIENTE LO DICE SOLO CHI L'HA DECISO ─────────────
 *
 *  Segnalazione del committente: «se metto videochiamata si bugga: sull'ospite
 *  continua a mostrare il contenuto anche se metto videochiamata».
 *
 *  Il consulente ha quasi sempre DUE schede aperte sulla stessa consulenza —
 *  il Meetly di là e il preventivo di qua, e da oggi ci si arriva anche con un
 *  clic solo («Apri il suo»). Tutte e due sono padrone di casa, tutte e due
 *  raccontano al cliente lo stato della chiamata, e ognuna ha la PROPRIA idea
 *  di che cosa mostrargli: quella che non ha mai scelto niente è rimasta al
 *  valore di partenza, che è «contenuti».
 *  Quindi: premi «Videochiamata» di là, il cliente passa alle facce, e un
 *  istante dopo l'altra scheda — rispondendo al saluto dell'ospite, che arriva
 *  ogni tre secondi — gli rimanda «contenuti». Da fuori è un programma che si
 *  bugga; dentro sono due schede che si contraddicono.
 *
 *  La regola: il MODO lo comunica solo la scheda che l'ha davvero scelto —
 *  perché ha avviato la chiamata o perché ci hai premuto sopra un pulsante.
 *  Le altre continuano a dire tutto il resto (la chiamata è viva, chi è il
 *  consulente, la qualità) e tacciono sull'unica cosa che non sanno.
 *  ⚠️ NON si risolve spegnendo la seconda scheda: quella che «non conduce» è
 *   spesso proprio quella dove stai lavorando, e deve poter parlare al cliente
 *   (è lei che gli manda il preventivo). Qui non si toglie la voce a nessuno:
 *   si toglie a chi non sa UNA frase sola.
 *  ⚠️ E una scheda che si ricarica torna a non saperlo: giusto così, perché il
 *   suo `mode` è tornato al valore di partenza. Il cliente resta dov'è finché
 *   qualcuno decide davvero. */
let modoScelto = false;

const broadcastState = () => {
  if (!canBroadcastState()) {
    console.log(
      `[HOST] callstate SOPPRESSA (questa scheda non risulta in diretta) — modalità ${S.mode} NON comunicata al cliente`,
    );
    return;
  }
  /*  ⚠️ E NON BASTA AVER SCELTO: BISOGNA ESSERE NELLA CHIAMATA. ──────────
      Misurato sul sito vero, ascoltando il canale di una consulenza in corso:
      ogni quindici secondi arrivava una `callstate` con
      `active: false, mode: "content"`. Viene da `riprendiConsulenzaAperta` —
      la scheda del consulente che si riprende la consulenza aperta e racconta
      il suo stato — e quella scheda NON è quella in chiamata: il suo `mode` è
      solo il valore con cui è partita.
      Quindi il modo si ripete solo da chi è dentro la chiamata. La SCELTA
      esplicita non passa di qui: `hostSetMode` manda anche l'evento `mode`,
      che arriva sempre, anche dalla scheda del preventivo.
      ⚠️ Le due regole (questa e quella del cliente, che scarta il modo da una
       callstate `active:false`) fanno lo stesso lavoro dai due lati apposta:
       una scheda vecchia continua a sbagliare finché non viene ricaricata, e
       il cliente deve essere difeso lo stesso. */
  const diciloIo = modoScelto && S.active;
  send("callstate", {
    active: S.active,
    primary: S.primary,
    presenterName: S.presenterName,
    contentCam: S.contentCam,
    sessionLive: S.sessionLive,
    ...(diciloIo ? { mode: S.mode, focusPid: S.focusPid } : {}),
  });
};

/** L'host apre/chiude la sessione (schermata d'attesa per il guest finché è false). */
export function setSessionLive(v: boolean) {
  if (S.role !== "host") return;
  set({ sessionLive: v });
  //  Consulenza aperta = ci si annuncia, anche senza videochiamata: vedi il
  //  cartello in `guestEnterApproved`.
  if (v) startPresence();
  // `ended` = UNICO segnale che riporta l'ospite in attesa (chiusura esplicita)
  send("callstate", {
    active: S.active,
    primary: S.primary,
    presenterName: S.presenterName,
    contentCam: S.contentCam,
    sessionLive: v,
    ended: !v,
    //  Stessa regola di `broadcastState`: il modo lo ripete solo chi l'ha
    //  scelto ED è dentro la chiamata.
    ...(modoScelto && S.active ? { mode: S.mode, focusPid: S.focusPid } : {}),
  });
  // sessione legata a QUESTA chiamata: alla chiusura il codice viene invalidato
  const p = readStoredPresenter();
  const body = v
    ? {
        live: true,
        code: readLiveId(),
        presenterId: p?.id ?? "",
        presenterName: S.presenterName || p?.name || "",
        startedAt: new Date().toISOString(),
      }
    : //  ⚠️ Anche chiudendo si dice QUALE consulenza si chiude: senza codice si
      //   spegneva la riga condivisa, cioè anche quella del collega che stava
      //   ancora trasmettendo.
      { live: false, code: readLiveId() };
  fetch("/api/presenter/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}
/** Letture dirette da localStorage (niente import da live.ts/presenter.ts → evita cicli). */
function readLiveId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("hg_live_session");
}
function readStoredPresenter(): { id: string; name: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const o = JSON.parse(localStorage.getItem("hg_presenter") || "null");
    return o && o.id ? o : null;
  } catch {
    return null;
  }
}
const genPid = () => Math.random().toString(36).slice(2, 10);
// ── MODERAZIONE ───────────────────────────────────────────────────────────
//  Il pid cambia ad ogni ricarica: per bloccare davvero qualcuno serve un id di
//  DISPOSITIVO persistente, salvato nel localStorage dell'ospite e inviato in
//  ogni "hello". L'elenco dei bloccati sta sul server (sopravvive ai reload).
const DEVICE_KEY = "hg_guest_device";
export function myDeviceId(): string {
  if (typeof localStorage === "undefined") return "";
  try {
    let v = localStorage.getItem(DEVICE_KEY);
    if (!v) {
      v = crypto?.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(DEVICE_KEY, v);
    }
    return v;
  } catch {
    return "";
  }
}
/** pid → id dispositivo (lato presentatore, ricavato dai messaggi "hello"). */
const deviceOf = new Map<string, string>();
const blockedSet = () => new Set(S.blocked.map((b) => b.id));
/** Presentatore: carica l'elenco bloccati dal server. */
export async function loadBlocked() {
  try {
    const j = await fetch("/api/presenter/blocked").then((r) => r.json());
    set({ blocked: Array.isArray(j?.list) ? (j.list as BlockedDevice[]) : [] });
  } catch {
    /* */
  }
}
async function saveBlocked(action: "block" | "unblock", id: string, name?: string) {
  try {
    const j = await fetch("/api/presenter/blocked", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id, name }),
    }).then((r) => r.json());
    if (Array.isArray(j?.list)) set({ blocked: j.list as BlockedDevice[] });
  } catch {
    /* */
  }
}
/** Rimuove SUBITO un ospite dalla conferenza (kick). */
export function kickGuest(pid: string, why: "removed" | "blocked" = "removed") {
  if (S.role !== "host") return;
  const dev = deviceOf.get(pid) || "";
  send("kick", { to: pid, dev, why });
  removePeer(pid, "kick");
}
/** Kick + blocco del DISPOSITIVO: con lo stesso link non potrà più rientrare. */
export async function blockGuest(pid: string) {
  if (S.role !== "host") return;
  const g = S.roster.find((r) => r.pid === pid);
  const dev = deviceOf.get(pid) || "";
  kickGuest(pid, "blocked");
  if (dev) await saveBlocked("block", dev, g?.name || "Ospite");
}
export async function unblockDevice(id: string) {
  if (S.role === "host") await saveBlocked("unblock", id);
}
/** OSPITE: verifica all'ingresso se il proprio dispositivo è bloccato. */
export async function checkBlockedOnJoin() {
  if (S.role !== "viewer") return false;
  const me = myDeviceId();
  if (!me) return false;
  try {
    const j = await fetch("/api/presenter/blocked").then((r) => r.json());
    const list = Array.isArray(j?.list) ? (j.list as BlockedDevice[]) : [];
    if (list.some((b) => b.id === me)) {
      set({ kicked: "blocked" });
      teardownMedia();
      return true;
    }
  } catch {
    /* */
  }
  return false;
}

// Il nome annunciato: per l'HOST non deve MAI essere vuoto (altrimenti il guest lo
// registra in roster come "Ospite" e quel nome finisce nel badge "Solo tu").
function helloName(): string {
  if (S.role === "host") return S.myName || S.presenterName || "Presentatore";
  return S.myName || "";
}
// PARTECIPANTI FANTASMA — CAUSA PRINCIPALE: qualunque scheda agganciata al canale
// (link aperto e mai confermato, anteprima, iframe, seconda scheda del presentatore)
// rispondeva all'`hello` altrui con un proprio `hello` e finiva in lista. Da qui in
// poi l'ospite si annuncia SOLO dopo essere davvero entrato (viewerJoin → joined)
// e dichiara `joined:true`: chi non lo dichiara NON viene mai elencato.
//  `req:true` = "rispondimi": chi lo riceve rimanda SEMPRE il proprio hello (con
//  req:false, quindi senza innescare ping-pong). Serve dopo ogni (ri)sottoscrizione
//  del canale: il presentatore conosce già il pid dell'ospite e senza questa
//  richiesta non si riannuncerebbe mai → l'ospite resterebbe con il roster vuoto
//  ("In attesa degli altri…") pur avendo il presentatore dall'altra parte.
function sendHello(req = false) {
  if (!S.myPid) return;
  if (isViewer() && !(S.joined && guestSticky)) return; // non è ancora entrato: niente presenza
  // `dev` = id DISPOSITIVO stabile. Lo manda anche il PRESENTATORE: se ricarica la
  // pagina il suo pid cambia, e senza identità stabile l'ospite si ritrovava DUE
  // voci "presentatore" (la vecchia non scade mai: il GC non rimuove gli host).
  /*  ⚠️ IL GETTONE SI RILEGGE DALLA SCHEDA, NON DALLA VARIABILE. Misurato sul
      canale della stanza vera: il cliente annunciava `persona: ""` ogni tre
      secondi. Dopo una ricarica l'ingresso si ripristina senza passare per la
      porta (`restoreGuestEntry`), quindi questa variabile è vuota anche quando
      il nome è ancora in memoria — e il pannello del consulente scriveva
      «acceso, ma lui non è dentro» di una persona che era collegata. */
  /*  ⚠️ E DICE ANCHE SE STA RISPETTANDO LA PRECEDENZA (`suo`). È l'unico modo
      che ha il consulente di sapere se quel dispositivo la conosce: la
      modalità la rifiuta il cliente, non il server, quindi una scheda aperta
      da prima di un aggiornamento continua a cambiare schermata e da fuori
      sembra che la regola non funzioni. Vedi `statoDelloSchermo`. */
  send("hello", {
    pid: S.myPid,
    name: helloName(),
    role: S.role,
    camOn: S.camOn,
    joined: true,
    req,
    dev: myDeviceId(),
    vp: myViewport(),
    persona: miaPersonaDi(S.sessionId) || gettoneInMemoria(),
    suo: restaSulMioPreventivo(),
  });
}

/** PRESENTATORE → elenco AUTOREVOLE dei partecipanti (sé stesso + ospiti).
 *  L'ospite lo usa per riconciliare la propria lista: nessuna voce può
 *  sopravvivere solo da un lato (tile fantasma "connessione…"). */
function broadcastRoster() {
  if (isViewer() || !S.myPid || !canBroadcastState()) return;
  const list = S.roster
    .filter((r) => r.role === "viewer")
    .map((r) => ({ pid: r.pid, name: r.name, role: "viewer" as Role, camOn: r.camOn }));
  list.push({ pid: S.myPid, name: helloName(), role: "host" as Role, camOn: S.camOn });
  send("roster", { from: S.myPid, list });
}

/** Il MIO viewport (l'ospite lo allega a ogni hello → il presentatore adatta l'anteprima). */
function myViewport(): GuestViewport | null {
  if (typeof window === "undefined") return null;
  const w = Math.round(window.innerWidth || document.documentElement.clientWidth || 0);
  const h = Math.round(window.innerHeight || document.documentElement.clientHeight || 0);
  if (!w || !h) return null;
  return { w, h, dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100, portrait: h >= w };
}
// L'ospite ri-annuncia subito il proprio viewport quando ruota o ridimensiona
// (throttle ~1s): il presentatore vede l'anteprima cambiare con lui.
if (typeof window !== "undefined") {
  let vpT = 0;
  const onVp = () => {
    if (!isViewer() || !S.myPid) return;
    const now = Date.now();
    if (now - vpT < 1000) return;
    vpT = now;
    sendHello(false);
  };
  window.addEventListener("resize", onVp);
  window.addEventListener("orientationchange", onVp);
}

function diag(s: string) {
  set({ diag: s });
}

// ── candidati ICE bufferizzati PER-PEER finché non c'è remoteDescription ───
async function addIce(pid: string, c: RTCIceCandidateInit) {
  const p = peers.get(pid);
  if (p && p.remoteDescription && p.remoteDescription.type) {
    try {
      await p.addIceCandidate(new RTCIceCandidate(c));
    } catch {
      /* */
    }
  } else {
    const q = pendingIce.get(pid) || [];
    q.push(c);
    pendingIce.set(pid, q);
  }
}
/** ── CHI IL CONSULENTE HA GIÀ AUTORIZZATO, CONSULENZA PER CONSULENZA ───────
 *  Serve a non far ribussare chi ricarica la pagina o cambia schermata: il suo
 *  via libera si riapre in silenzio.
 *
 *  ⚠️ ERA UN ELENCO SOLO PER TUTTE LE CONSULENZE, e questa scheda ne fa tante
 *   di fila. Il cliente delle nove, riaprendo il suo link mentre il consulente
 *   sta facendo la consulenza delle undici, veniva riconosciuto come «già
 *   ammesso» ed entrava da solo — dentro l'appuntamento di un'altra persona,
 *   senza che nessuno avesse accettato niente. Un via libera vale per la
 *   stanza in cui è stato dato, e per nessun'altra. */
const ammessiPerStanza = new Map<string, Set<string>>();
function ammessiDiQui(): Set<string> {
  const stanza = String(S.sessionId || "");
  let elenco = ammessiPerStanza.get(stanza);
  if (!elenco) {
    elenco = new Set<string>();
    ammessiPerStanza.set(stanza, elenco);
  }
  return elenco;
}

/** ── RICHIEDI DI NUOVO CAMERA E MICROFONO A QUESTA PERSONA ─────────────────
 *  Non impone uno stato — quello lo fa `setGuestDevice`, e se lo stato
 *  combacia non succede niente: chiede di riaprire quello che manca e, se il
 *  browser dell'ospite non lo concede senza un suo tocco, gli fa comparire la
 *  notifica con il pulsante per autorizzare (vedi il gestore `chiedimedia`). */
export function chiediMediaOspite(pid: string, cosa: { cam?: boolean; mic?: boolean } = {}) {
  if (S.role !== "host" || !pid) return;
  const cam = cosa.cam !== false;
  const mic = cosa.mic !== false;
  console.log(
    `[HOST] richiedo di nuovo ${[cam && "camera", mic && "microfono"].filter(Boolean).join(" e ")} a ${pid}`,
  );
  send("chiedimedia", { to: pid, cam, mic });
}

/** Accende o spegne camera/microfono di un partecipante, a distanza.
 *  Utile quando il cliente non trova i comandi o ha un microfono che disturba. */
export function setGuestDevice(pid: string, what: "cam" | "mic", on: boolean) {
  if (S.role !== "host" || !pid) return;
  send("force", { to: pid, [what]: on });
  console.log(
    `[HOST] ${what === "cam" ? "camera" : "microfono"} di ${pid} → ${on ? "acceso" : "spento"}`,
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   IL DIARIO DEI SUONI — SOLO SUL DISPOSITIVO DEL CLIENTE
   ───────────────────────────────────────────────────────────────────────────
   Segnalazione del committente: «l'utente quando sta dentro sente bip bip
   bip» — il cliente, mentre è già dentro, in continuazione ogni pochi secondi.

   Su quel telefono non c'è una console da aprire e la consulenza è vera: di
   quel momento, finora, non restava niente. Qui si contano i suoni che partono
   DAVVERO e ogni venti secondi se ne lascia detta una riga sola nel diario del
   cliente (api.presenter.errors, che è aperto in scrittura proprio perché la
   segnalazione parte da un dispositivo senza credenziali).

   ⚠️ SOLO DAL CLIENTE E SOLO DA DENTRO: sul computer del consulente i suoni
    sono quelli che preme lui, e non è di quelli che si parla.
   ⚠️ POCHE RIGHE E POI BASTA: il diario tiene le ultime 80 voci, ed è lì che
    finiscono anche gli errori veri. Una sonda che scrive per mezz'ora li
    spingerebbe fuori tutti — che è il contrario di quello che serve.
   ⚠️ NIENTE DI PRIVATO: nomi di suoni e numeri.
   ═══════════════════════════════════════════════════════════════════════════ */
const SUONI_OGNI_MS = 20_000;
/** Sotto questa soglia non è «bip bip bip»: è la vita normale di una pagina. */
const SUONI_MINIMI = 3;
/** Quante righe al massimo per caricamento di pagina: è una sonda, non un
 *  guardiano. */
const SUONI_MAX_RIGHE = 10;
let suoniContati: Conteggi = {};
let suoniDaQuando = 0;
let suoniScritte = 0;
let suoniTimer: number | null = null;

/** Un suono è partito su questo dispositivo. Lo chiama la spia di `shop/sfx`
 *  per i suoni nostri, e il lettore della voce remota quando deve riprendere. */
export function contaSuono(nome: string) {
  if (typeof window === "undefined" || !isViewer()) return;
  conta(suoniContati, nome);
  if (suoniTimer != null) return;
  suoniDaQuando = Date.now();
  suoniTimer = window.setInterval(() => {
    const secondi = (Date.now() - suoniDaQuando) / 1000;
    const totale = quanti(suoniContati);
    const riga = riassunto(suoniContati, secondi);
    //  ⚠️ I conteggi si azzerano SEMPRE, anche quando la riga non si scrive:
    //   se restassero, la prima riga scritta parlerebbe di mezz'ora fa.
    suoniContati = {};
    suoniDaQuando = Date.now();
    if (!riga || !S.joined || totale < SUONI_MINIMI || suoniScritte >= SUONI_MAX_RIGHE) return;
    suoniScritte += 1;
    //  Non si aspetta la risposta e non si guarda: un diario non deve mai
    //  disturbare una consulenza.
    void fetch("/api/presenter/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg: riga,
        name: S.myName || "Cliente",
        page: typeof location !== "undefined" ? location.pathname : "",
        ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
      }),
    }).catch(() => {
      /* il diario è un di più */
    });
  }, SUONI_OGNI_MS);
}
if (typeof window !== "undefined") setSpiaSuoni(contaSuono);

/** ACCETTA l'ingresso di chi ha bussato. */
export function admitGuest(pid: string, devNoto = "") {
  const k = S.knocks.find((x) => x.pid === pid);
  //  ⚠️ Si segna la CHIAVE, non solo il dispositivo: su un telefono che non ci
  //   lascia scrivere niente (navigazione privata) il dispositivo è stringa
  //   vuota, segnare il solo dispositivo non segnava nessuno, e la bussata
  //   successiva — quattro secondi dopo — risultava di uno mai visto. Da lì la
  //   campana ogni quattro secondi, anche sul telefono del cliente.
  //  ⚠️ `devNoto` non è un di più: chi entra dalla porta aperta non passa
  //   dall'elenco, quindi qui `k` è vuoto e senza il dispositivo si
  //   segnerebbe il pid — e la bussata successiva, che il dispositivo ce
  //   l'ha, risulterebbe di uno mai visto (campana, e avviso, ogni quattro
  //   secondi).
  const dev = k?.dev || devNoto;
  const chiave = chiaveBussata(dev, k?.pid ?? pid);
  if (chiave) ammessiDiQui().add(chiave);
  /*  ── ⚠️ IL VIA LIBERA PORTA ANCHE IL DISPOSITIVO ────────────────────────
      Segnalazione del committente: «li accetto e continua a dirgli sei in
      attesa, come se non avessi mai accettato».
      Il pid è di una PAGINA: cambia a ogni ricaricamento del cliente. Questo
      elenco può tenerne uno vecchio — arrivato sul canale, o rimasto da prima
      — e allora il via libera era indirizzato a una pagina che non esiste
      più: il cliente lo scartava («non è per me») e il server lo scriveva su
      una riga di nessuno. Col dispositivo il messaggio arriva alla PERSONA,
      qualunque pagina abbia aperto adesso. */
  send("admit", { to: pid, ...(dev ? { dev } : {}) });
  //  …e nella riga della consulenza, che il cliente rilegge anche quando il
  //  canale non gli ha portato niente (vedi `decidiSulServer`).
  decidiSulServer(pid, "ammesso", dev);
  sfx.joined(); // lo stesso accordo che sente lui: siete collegati
  set({ knocks: S.knocks.filter((x) => x.pid !== pid) });
}
/** RIFIUTA l'ingresso di chi ha bussato. */
export function denyGuest(pid: string) {
  //  Anche il no va alla persona, non alla pagina: vedi `admitGuest`.
  const dev = S.knocks.find((x) => x.pid === pid)?.dev || "";
  send("deny", { to: pid, reason: "refused", ...(dev ? { dev } : {}) });
  decidiSulServer(pid, "rifiutato", dev);
  set({ knocks: S.knocks.filter((x) => x.pid !== pid) });
}

/** ── LA PORTA LASCIATA APERTA ──────────────────────────────────────────────
 *
 *  Richiesta del committente: «fai entrare da solo chi è in elenco» — e, alla
 *  domanda se valesse solo per l'elenco: «possono entrare anche se non sono in
 *  elenco». Quindi: aperta vuol dire aperta.
 *
 *  Serve quando il gruppo arriva scaglionato: si sta già parlando con il
 *  primo, gli altri due bussano, e ogni bussata è un pulsante da cercare
 *  mentre si guarda in camera.
 *
 *  ⚠️ CHI ENTRA SENZA ESSERE ATTESO LASCIA UN AVVISO. È il prezzo di una porta
 *   aperta davvero: il link inoltrato a un amico entra come gli altri. Il
 *   consulente lo vede scritto, con «mandalo fuori» accanto — non dopo, quando
 *   se ne accorge da solo guardando i riquadri.
 *  ⚠️ LA SCELTA VALE PER QUESTA CONSULENZA, non per sempre: si ricorda per il
 *   codice della stanza, così una ricarica non richiude la porta in faccia a
 *   chi sta bussando, ma la consulenza di domani riparte chiusa. */
const PORTA_KEY = "hg_porta_aperta";

export function portaApertaSalvata(code: string | null | undefined): boolean {
  try {
    return localStorage.getItem(`${PORTA_KEY}:${String(code || "")}`) === "1";
  } catch {
    return false;
  }
}

export function setPortaAperta(aperta: boolean) {
  if (S.role !== "host") return;
  set({ portaAperta: aperta });
  try {
    localStorage.setItem(`${PORTA_KEY}:${String(S.sessionId || "")}`, aperta ? "1" : "0");
  } catch {
    /* memoria negata */
  }
  console.log(`[HOST] porta ${aperta ? "aperta" : "chiusa"}`);
  //  Chi era già alla porta entra adesso: aprirla e lasciare fuori chi ha
  //  bussato un secondo prima non avrebbe senso per nessuno dei due.
  if (aperta) for (const k of S.knocks.slice()) entraDallaPortaAperta(k);
}

/** Fa entrare senza chiedere, e — se non era atteso — lascia l'avviso. */
function entraDallaPortaAperta(k: { pid: string; name: string; dev?: string; atteso?: boolean }) {
  console.log(`[HOST] porta aperta: entra ${k.name}${k.atteso ? "" : " (non era fra gli attesi)"}`);
  admitGuest(k.pid, k.dev || "");
  if (!k.atteso) segnaEntrataLibera(k.pid, k.name);
}

/** L'avviso «è entrato uno che non aspettavi». Uno per persona. */
export function segnaEntrataLibera(pid: string, nome: string) {
  if (S.entrateLibere.some((e) => e.pid === pid)) return;
  set({ entrateLibere: [...S.entrateLibere, { pid, nome: nome || "Ospite", at: Date.now() }] });
}
/** «Va bene così»: l'avviso sparisce, la persona resta dentro. */
export function scartaEntrataLibera(pid: string) {
  set({ entrateLibere: S.entrateLibere.filter((e) => e.pid !== pid) });
}
/** «Mandalo fuori»: esce subito, e l'avviso con lui. */
export function mandaFuori(pid: string) {
  kickGuest(pid, "removed");
  scartaEntrataLibera(pid);
}

/** Una proposta di connessione per volta, per ciascun interlocutore. */
const offerQueue = new Map<string, Promise<void>>();

async function flushIce(pid: string) {
  const p = peers.get(pid);
  if (!p) return;
  const q = pendingIce.get(pid) || [];
  pendingIce.set(pid, []);
  for (const c of q) {
    try {
      await p.addIceCandidate(new RTCIceCandidate(c));
    } catch {
      /* */
    }
  }
}

function anyConnected() {
  for (const p of peers.values()) if (p.connectionState === "connected") return true;
  return false;
}

/** Parametri dell'encoder video in uscita.
 *  - degradationPreference "maintain-framerate": davanti a carico/banda l'encoder
 *    abbassa la RISOLUZIONE, non la fluidità (era il crollo a ~9fps lato ospite).
 *  - maxBitrate mai sotto una soglia sensata per la risoluzione scelta: un tetto
 *    troppo basso costringe comunque l'encoder a buttare fotogrammi.
 *  - contentHint "motion" sulla traccia effettivamente inviata. */
function tuneVideoSenders() {
  const q = QUALITY[S.myQuality] || QUALITY.med;
  /*  ── ⚠️ QUANTE COPIE DEL MIO VIDEO STANNO PARTENDO ────────────────────
      Segnalazione del committente: «se trasmettono più persone insieme va
      lento a scatti, sia a me che all'altro». Qui ogni interlocutore riceve
      la SUA copia (rete a maglia): due interlocutori sono due video
      codificati e due volte la banda. Il tetto però si calcolava come se
      ciascuno avesse la linea tutta per sé — l'85% di quello che regge, a
      testa: con due si chiedeva il 170% della linea. Da lì i pacchetti persi
      e l'immagine che si impunta, da entrambe le parti.
      Adesso la linea si SPARTE, e da tre in su si manda anche un'immagine
      più piccola: in maglia è la CPU a cedere per prima. */
  const riceventi = Math.max(
    1,
    [...peers.values()].filter((pc) =>
      pc.getSenders().some((s) => s.track?.kind === "video" && s.track.readyState === "live"),
    ).length,
  );
  const scala = scalaMesh(riceventi);
  const fr = fotogrammiMesh(q.fr, riceventi);
  if (riceventi > 1 && riceventi !== meshDetto) {
    meshDetto = riceventi;
    console.log(
      `[CAM] ${riceventi} interlocutori ricevono il video → linea spartita, immagine ridotta di ${scala}× a ${fr}fps`,
    );
  }
  /*  ⚠️ Il listino della CAMERA è più basso di quello dello SCHERMO a parità
      di risoluzione: vedi `listinoVideo`. È ciò che permette a due consulenti
      di stare entrambi su «Alta» sulla stessa linea. */
  const listino = listinoVideo(q.br, S.sharing);
  for (const [pid, pc] of peers) {
    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (!sender) continue;
    /*  ⚠️ «motion» su una condivisione schermo è la richiesta sbagliata: dice
        al codificatore di sacrificare la NITIDEZZA per tenere i fotogrammi, e
        su un testo vuol dire lettere che sbavano. Una pagina ferma piena di
        scritte vuole «detail»; un viso che parla vuole «motion». */
    try {
      if (sender.track) (sender.track as any).contentHint = S.sharing ? "detail" : "motion";
    } catch {
      /* */
    }
    try {
      const prm = sender.getParameters();
      prm.encodings = prm.encodings && prm.encodings.length ? prm.encodings : [{}];
      /** ── ⚠️ IL TETTO SEGUE LA LINEA, NON IL LISTINO ────────────────────
       *  Su «Alta» si chiedevano 2,5 Mbit al secondo comunque, anche a una
       *  linea che non li ha. Il risultato non è un video più bello: è un
       *  encoder che spinge oltre quello che passa, pacchetti persi a raffica
       *  e — DALL'ALTRA PARTE — un'immagine che si impunta. Chi presenta non
       *  se ne accorge, perché la sua anteprima è locale e scorre liscia: è
       *  esattamente il difetto segnalato («il cliente mi vede a scatti»).
       *  Qui il tetto è il minimo fra quello scelto e l'85% di quello che la
       *  connessione dichiara di reggere adesso. Sotto i 350 kbit non si
       *  scende: meglio un'immagine povera che nessuna immagine.
       *  ⚠️ Si RIALZA da solo appena la linea torna: è un tetto, non una
       *   punizione — la misura si rifà ogni dieci secondi.
       */
      const disponibile = bandaSu.get(pid) || 0;
      //  ⚠️ «Pulita» = la sonda non misura perdite su quello che mandiamo e
      //   l'encoder non si dichiara limitato. Solo allora si risale in fretta
      //   (vedi PASSO_PULITO in shop/banda): è la differenza fra tre secondi e
      //   venticinque per tornare all'immagine piena dopo un singhiozzo.
      //   Finché la linea non è stata misurata (`linea` ancora nullo) NON è
      //   pulita: è sconosciuta, e sono due cose diverse.
      const pulita = !!S.linea && S.linea.persiSu <= 0 && S.linea.limite !== "rete";
      const tetto = tettoInvio({
        listino,
        disponibile,
        riceventi,
        precedente: tettoPrec.get(pid) || 0,
        pulita,
      });
      //  Si parla solo quando il tetto CAMBIA davvero: la sonda gira ogni due
      //  secondi e mezzo, e una riga a ogni giro seppellirebbe i messaggi che
      //  servono a capire una chiamata andata male.
      const prima = tettoPrec.get(pid) || 0;
      if (Math.abs(tetto - prima) > 50_000) {
        console.log(
          `[CAM] tetto banda → ${pid}: linea ${Math.round(disponibile / 1000)}kbit su ${riceventi} interlocutori, invio limitato a ${Math.round(tetto / 1000)}kbit (listino ${Math.round(listino / 1000)}${S.sharing ? " schermo" : " camera"})`,
        );
      }
      tettoPrec.set(pid, tetto);
      //  Due motivi per rimpicciolire l'immagine, e vale il più severo: le
      //  copie che partono da qui (CPU) e la banda che resta (rete).
      const scalaQui = Math.max(scala, scalaPerTetto(tetto, listino));
      prm.encodings[0].maxBitrate = tetto;
      prm.encodings[0].maxFramerate = fr;
      prm.encodings[0].scaleResolutionDownBy = scalaQui;
      prm.encodings[0].active = true;
      (prm as any).degradationPreference = "maintain-framerate";
      sender.setParameters(prm).catch(() => {
        /* */
      });
    } catch {
      /* */
    }
  }
}

// SINCRONO (usa cachedIce): garantisce peers.set immediato → niente doppioni.
function makePeer(pid: string): RTCPeerConnection {
  const existing = peers.get(pid);
  if (existing) return existing; // mai due connessioni per lo stesso pid
  console.log("[PEER] create", pid);
  const p = new RTCPeerConnection({ iceServers: cachedIce });
  peers.set(pid, p); // set PRIMA di qualsiasi await del chiamante (anti-glare/duplicati)
  if (localStream) localStream.getTracks().forEach((t) => p.addTrack(t, localStream!));
  // parametri encoder appena il sender esiste (e di nuovo a connessione stabilita)
  try {
    tuneVideoSenders();
  } catch {
    /* */
  }
  p.onicecandidate = (e) => {
    if (e.candidate) send("ice", { from: S.myPid, to: pid, c: e.candidate });
  };
  p.ontrack = (e) => {
    const s = e.streams && e.streams[0] ? e.streams[0] : new MediaStream([e.track]);
    remoteStreams.set(pid, s);
    emitStreams();
    console.log("[PEER] track", pid, e.track.kind);
    /*  ⚠️ SE SI STA REGISTRANDO, QUESTA VOCE CI DEVE ENTRARE SUBITO. La
        registrazione parte all'ingresso dell'ospite, cioè secondi PRIMA che
        arrivi questa traccia: senza questa riga la sua voce resta fuori per
        tutta la consulenza (la rete ogni tre secondi la prenderebbe lo
        stesso, ma intanto si perde quello che ha detto). */
    if (e.track.kind === "audio") collegaVoceAlRegistratore(new MediaStream([e.track]), pid);
    // ── DIAGNOSI "CAMERA NERA A INTERMITTENZA" ────────────────────────────
    //  Una traccia che il browser mette temporaneamente in silenzio (`muted`)
    //  dà esattamente qualche secondo di nero che poi rientra da solo. Finora
    //  non lo registrava nessuno: senza questa riga la causa resta invisibile.
    try {
      e.track.onmute = () =>
        console.warn(
          `[CAM] traccia ${e.track.kind} da ${pid} SOSPESA dal browser (probabile nero temporaneo)`,
        );
      e.track.onunmute = () => console.log(`[CAM] traccia ${e.track.kind} da ${pid} ripresa`);
      e.track.onended = () => console.warn(`[CAM] traccia ${e.track.kind} da ${pid} TERMINATA`);
    } catch {
      /* */
    }
  };
  p.onconnectionstatechange = () => {
    const st = p.connectionState;
    console.log("[PEER] connectionState", pid, st);
    if (st === "connected") {
      try {
        tuneVideoSenders();
      } catch {
        /* */
      }
    }
    set({ connected: anyConnected() });
    diag(anyConnected() ? "Connesso ✓" : `Conn:${st}`);
    if (st === "connected") {
      badSince.delete(pid);
      startRecognition();
      annullaRipresa(pid);
    }
    if (st === "failed") chiediRipresa(pid, 0);
    /* ── ⚠️ «disconnected» NON SI PUÒ PIÙ IGNORARE ─────────────────────────
       Segnalazione del committente: «dopo 5 secondi dalla chiamata si è
       bloccata, schermo nero e non ci sentivamo più».
       Qui c'era scritto che `disconnected` è transitorio e si recupera da
       solo. È vero per un buco di rete di un secondo; NON è vero quando il
       percorso diretto cade per davvero — cambio di cella, Wi-Fi che passa a
       4G, NAT che chiude la porta. In quel caso il browser resta
       «disconnected» a lungo prima di dichiarare `failed` (e a volte non ci
       arriva mai, perché non ha altre coppie da provare): fino ad allora
       nessuno faceva niente, e quello che si vede è esattamente uno schermo
       nero muto che non torna più.
       Adesso si aspetta una breve grazia — quella sì, per i buchi veri di un
       secondo — e poi si riprova davvero. */
    if (st === "disconnected") chiediRipresa(pid, GRAZIA_DISCONNESSO);
  };
  p.oniceconnectionstatechange = () => {
    const ice = p.iceConnectionState;
    console.log("[PEER] iceConnectionState", pid, ice);
    if (ice === "connected" || ice === "completed") annullaRipresa(pid);
    if (ice === "failed") chiediRipresa(pid, 0);
    if (ice === "disconnected") chiediRipresa(pid, GRAZIA_DISCONNESSO);
  };
  return p;
}

/** true se dal peer sta arrivando davvero del media (traccia remota viva). */
function hasLiveMedia(pid: string): boolean {
  const s = remoteStreams.get(pid);
  if (!s) return false;
  return s.getTracks().some((t) => t.readyState === "live");
}
/** true se il peer è sano: connesso oppure sta ricevendo media. Non va MAI chiuso. */
function peerIsHealthy(pid: string): boolean {
  const p = peers.get(pid);
  if (p && p.connectionState === "connected") return true;
  return hasLiveMedia(pid);
}

// cooldown ICE-restart: max 1 ogni 15s per peer (evita loop di ri-negoziazione)
const ICE_RESTART_COOLDOWN = 15_000;
const lastIceRestart = new Map<string, number>();

/** ── QUANTO SI ASPETTA PRIMA DI RIPROVARE ─────────────────────────────────
 *  Un buco di rete di un secondo si richiude da solo, e riprovare subito
 *  butterebbe via una connessione che stava per tornare. Cinque secondi sono
 *  la distanza fra «è solo un singhiozzo» e «è caduta»: oltre, chi guarda lo
 *  schermo ha già capito che qualcosa non va. */
const GRAZIA_DISCONNESSO = 5_000;
const ripresaTimer = new Map<string, ReturnType<typeof setTimeout>>();

function annullaRipresa(pid: string) {
  const t = ripresaTimer.get(pid);
  if (t) {
    clearTimeout(t);
    ripresaTimer.delete(pid);
  }
}

/** Riprova la connessione con questo peer fra `attesa` ms, se nel frattempo
 *  non è tornata su da sola.
 *  ⚠️ CHI RIPARA NON È SEMPRE CHI SE NE ACCORGE. L'ICE-restart lo può fare
 *   solo un lato (quello con il pid minore, per non incrociare due proposte):
 *   se a cadere è la rete dell'ALTRO, quel lato non vede niente e nessuno
 *   ripara. Per questo chi non può offrire CHIEDE, e l'altro esegue. */
function chiediRipresa(pid: string, attesa: number, ancheSeConnessa = false) {
  const p = peers.get(pid);
  if (!p || p.connectionState === "closed") return;
  annullaRipresa(pid);
  ripresaTimer.set(
    pid,
    setTimeout(
      () => {
        ripresaTimer.delete(pid);
        const pc = peers.get(pid);
        if (!pc) return;
        const st = pc.connectionState;
        if (st === "closed") return;
        //  ⚠️ «connected» DI SOLITO vuol dire che è tornata su da sola, e ripararla
        //   sarebbe un danno. Ma esiste un caso in cui mente: la connessione
        //   risulta connessa e non passa più un byte (vedi `silenzioDa` nella
        //   sonda). Lì è proprio il momento di muoversi, ed è chi chiama a dire
        //   che sa quello che sta facendo.
        if (st === "connected" && !ancheSeConnessa) return;
        //  Sul lato che non può offrire si passa da `reoffer(..., true)` dell'altro:
        //  il messaggio «riprova» supera la guardia dello stato connesso.
        if (S.myPid < pid) void reoffer(pid, ancheSeConnessa);
        else send("riprova", { from: S.myPid, to: pid });
      },
      Math.max(0, attesa),
    ),
  );
}

/** ── QUANDO LA CONNESSIONE DICE «CONNESSO» E NON PASSA NIENTE ──────────────
 *
 *  Richiesta del committente: «devi fare che non perde più connessione».
 *
 *  Le cadute vere le prende già `onconnectionstatechange`: «failed» ripara
 *  subito, «disconnected» dopo cinque secondi di grazia. Resta fuori il guasto
 *  peggiore, quello che in consulenza si vede più spesso: l'immagine si blocca
 *  e NESSUN evento arriva. La connessione risulta «connected», le tracce
 *  risultano «live», e il programma è convinto che vada tutto bene mentre il
 *  cliente guarda un fermo immagine. Succede quando la rete cambia sotto i
 *  piedi (Wi-Fi che passa al 4G, il portatile che si risveglia, il router che
 *  si riavvia): il percorso ICE è morto ma il browser se ne accorge solo dopo
 *  decine di secondi — a volte mai, se il traffico in uscita continua.
 *
 *  ⚠️ L'UNICA PROVA CHE LA CONNESSIONE È VIVA SONO I BYTE DI MEDIA CHE
 *   ARRIVANO. Non lo stato, non `readyState`, e nemmeno i byte della
 *   connessione: quelli crescono comunque, perché STUN e RTCP tengono aperta la
 *   strada anche quando il video è morto (misurato: vedi il commento dentro la
 *   sonda). Qui si guardano i byte di `inbound-rtp`, e si segna da quando sono
 *   fermi. Otto secondi di silenzio su una connessione «connessa» non sono un
 *   singhiozzo: sono una connessione morta che non lo sa.
 *  ⚠️ IL MUTO NON È SILENZIO. Provato con camera e microfono spenti come li
 *   spegne questa applicazione (`enabled = false`): i pacchetti continuano ad
 *   arrivare — silenzio e fotogrammi neri sono pur sempre pacchetti — e
 *   l'allarme non scatta. Se un giorno si passasse a `replaceTrack(null)` per
 *   spegnere, questa misura cambierebbe e questo controllo andrebbe rifatto.
 *  ⚠️ E CHI NON HA MAI MANDATO NIENTE NON SI GIUDICA (`prec.byte > 0`): un
 *   interlocutore entrato senza camera né microfono avrebbe zero byte per
 *   sempre, e si passerebbe la consulenza a rinegoziare una connessione sana.
 *  ⚠️ OTTO SECONDI E NON DUE. Un solo campionamento vuoto capita per mille
 *   motivi innocenti (la sonda arriva un attimo prima dei pacchetti, un
 *   fotogramma chiave in ritardo). Riparare a ogni sussulto vorrebbe dire
 *   rinegoziare in continuazione, che è proprio il modo di non collegarsi mai.
 *  ⚠️ E IL FRENO DEFINITIVO RESTA IL COOLDOWN dell'ICE-restart (15 s per
 *   interlocutore): anche se questa misura sbagliasse, non può innescare un
 *   ciclo. */
const SILENZIO_MAX_MS = 8_000;
const silenzioDa = new Map<string, { byte: number; da: number }>();

// ri-offerta con ICE-restart quando la connessione fallisce (solo l'offerer deterministico)
async function reoffer(pid: string, chiestaDalPeer = false) {
  const p = peers.get(pid);
  if (!p) return;
  const cs = p.connectionState;
  // MAI ri-negoziare un peer ancora in corso di negoziazione o chiuso.
  //  ⚠️ «connected» di solito si salta — ma NON quando è l'altro a chiedere:
  //   da questo lato la connessione può risultare buona mentre dall'altro non
  //   arriva più niente, ed è proprio il caso in cui qualcuno deve muoversi.
  //   Il freno contro i cicli resta il cooldown qui sotto, non questa riga.
  if (
    cs === "connecting" ||
    cs === "new" ||
    cs === "closed" ||
    (cs === "connected" && !chiestaDalPeer)
  ) {
    console.log("[PEER] ice-restart SKIP (state=" + cs + ")", pid);
    return;
  }
  const now = Date.now(),
    prev = lastIceRestart.get(pid) || 0;
  if (now - prev < ICE_RESTART_COOLDOWN) {
    console.log("[PEER] ice-restart SKIP (cooldown)", pid);
    return;
  }
  lastIceRestart.set(pid, now);
  console.log("[PEER] ice-restart", pid, chiestaDalPeer ? "(chiesto dall'altro)" : "");
  /* ── ⚠️ SI RIPARTE CON CREDENZIALI TURN FRESCHE ──────────────────────────
     I server ICE si scelgono quando la connessione NASCE e restano quelli per
     sempre: un ICE-restart con le credenziali prese all'apertura della pagina
     rifà tutto il giro con le stesse chiavi, e quelle di Cloudflare SCADONO.
     Una chiamata lunga che cade e prova a riprendersi si ritrovava senza
     relay proprio nel momento in cui il relay era l'unica strada rimasta —
     cioè un ICE-restart che non poteva funzionare, e uno schermo nero che non
     tornava più. `setConfiguration` è l'unico modo di cambiarli su una
     connessione già aperta. */
  await prefetchIce();
  try {
    p.setConfiguration?.({ iceServers: cachedIce });
  } catch {
    /* browser vecchio: si riprova con i vecchi server */
  }
  try {
    (p as any).restartIce?.();
  } catch {
    /* */
  }
  //  ⚠️ L'offerta si DICHIARA come ripresa: dall'altra parte c'è una guardia
  //   che scarta le offerte quando la connessione le risulta già buona — ed è
  //   giusta per le offerte normali, ma su una ripresa era la riga che faceva
  //   fallire proprio il caso per cui la ripresa esiste (vedi il gestore
  //   dell'evento "offer").
  try {
    const o = await p.createOffer({ iceRestart: true } as any);
    await p.setLocalDescription(o);
    send("offer", { from: S.myPid, to: pid, sdp: p.localDescription, restart: true });
  } catch {
    /* */
  }
}

// regola deterministica anti-glare: offre solo il pid lessicograficamente minore
async function maybeInitiate(pid: string) {
  if (!localStream || !(S.myPid < pid)) return;
  let p = peers.get(pid);
  if (!p) {
    p = makePeer(pid);
    const o = await p.createOffer();
    await p.setLocalDescription(o);
    send("offer", { from: S.myPid, to: pid, sdp: p.localDescription });
  } else if (
    !peerIsHealthy(pid) &&
    p.connectionState !== "connecting" &&
    p.localDescription &&
    !p.currentRemoteDescription
  ) {
    // re-invia SOLO se l'answer NON è ancora arrivato (late joiner / offerta persa).
    // Se l'answer c'è già, un resend re-inneschererebbe la negoziazione ogni 3s
    // e la connessione non si stabilirebbe mai (causa reale schermo nero).
    send("offer", { from: S.myPid, to: pid, sdp: p.localDescription });
  }
}

// L'ospite ha ricevuto almeno una `callstate` dal presentatore (cosa sta mostrando).
// Usato SOLO dalla schermata di caricamento post-ingresso: non influenza mai joined/sessionLive.
let guestSawState = false;
// La PAGINA di contenuti ha applicato lo stato del presentatore (indice slide +
// cfg, url del sito, snapshot del preventivo). Alzato da guestContentSeen().
let guestPageApplied = false;
// PRONTEZZA LATO SERVER — indipendente dalla pagina. Con il gate ospite la pagina
// dei contenuti NON è montata mentre si carica (vedi __root.tsx: niente <Outlet>),
// quindi `guestPageApplied` non arriverebbe mai. La prontezza si legge dallo stato
// AUTOREVOLE sul server: /api/presenter/curpage (+ /api/presenter/quotestate sul
// preventivo). Appena risponde, l'ospite può montare i contenuti già popolati.
let guestServerSeen = false;
let guestPollTimer: ReturnType<typeof setInterval> | null = null;
function stopGuestReadinessPoll() {
  if (guestPollTimer) {
    clearInterval(guestPollTimer);
    guestPollTimer = null;
  }
}
function startGuestReadinessPoll() {
  if (typeof window === "undefined" || guestPollTimer || guestServerSeen) return;
  const wantQuote = /^\/preventivo/.test(window.location.pathname);
  const tick = async () => {
    try {
      //  ⚠️ Col codice della PROPRIA consulenza: le righe del server sono una
      //   per consulenza (shop/chiave-sessione), e chiederle senza codice
      //   vorrebbe dire leggere quella condivisa — cioè lo stato di un collega
      //   che sta trasmettendo nello stesso momento.
      const mio = encodeURIComponent(S.sessionId || watchIdDaIndirizzo() || "");
      const pg = await fetch(`/api/presenter/curpage?sess=${mio}`, { cache: "no-store" }).then(
        (r) => r.json(),
      );
      const qs = wantQuote
        ? await fetch(`/api/presenter/quotestate?sess=${mio}`, { cache: "no-store" }).then((r) =>
            r.json(),
          )
        : {};
      // basta che il server abbia RISPOSTO con uno stato valido: lo snapshot del
      // preventivo può essere null (il presentatore lo sta ancora configurando).
      if (pg?.path && qs && typeof qs === "object") {
        guestServerSeen = true;
        stopGuestReadinessPoll();
        console.log("[GUEST] stato server pronto → contenuti montabili");
        set({}); // sveglia gli osservatori (velo/gate)
      }
    } catch {
      /* riprovo al prossimo giro */
    }
  };
  void tick();
  guestPollTimer = setInterval(tick, 600);
}

/** Un nome "vero" (non vuoto e non il segnaposto generico "Ospite"). */
function isRealName(n?: string | null): boolean {
  const v = (n || "").trim();
  return !!v && v.toLowerCase() !== "ospite";
}

function upsertRoster(
  pid: string,
  name: string,
  role: Role,
  camOn: boolean,
  chiEra?: { nomeVero?: string; leadId?: string; suo?: boolean },
) {
  // il segnaposto del presentatore e la propria voce non entrano MAI nello stato:
  // vivono solo come tile calcolata (altrimenti diventano tile fantasma).
  if (!pid || pid === HOST_PLACEHOLDER_PID || pid === S.myPid) return;
  const list = S.roster.slice();
  const i = list.findIndex((r) => r.pid === pid);
  //  Il nome vero, una volta saputo, non si perde: gli annunci successivi
  //  portano solo quello digitato, e la riga non deve tornare indietro.
  const vero = chiEra?.nomeVero || (i >= 0 ? list[i].nomeVero : undefined);
  const lead = chiEra?.leadId || (i >= 0 ? list[i].leadId : undefined);
  //  ⚠️ `suo` NON si conserva come il nome: se l'annuncio non lo porta (il
  //   roster di un altro ospite, una versione vecchia) si tiene quello che
  //   c'era, ma un annuncio che lo porta vale sempre — anche `false`.
  const dice = chiEra && "suo" in chiEra ? chiEra.suo === true : i >= 0 ? list[i].suo : undefined;
  const voce: Participant = {
    pid,
    name,
    role,
    camOn,
    ...(vero ? { nomeVero: vero } : {}),
    ...(lead ? { leadId: lead } : {}),
    ...(dice === undefined ? {} : { suo: dice }),
  };
  if (i >= 0) {
    if (
      list[i].name === name &&
      list[i].role === role &&
      list[i].camOn === camOn &&
      list[i].nomeVero === voce.nomeVero &&
      list[i].leadId === voce.leadId &&
      list[i].suo === voce.suo
    )
      return;
    list[i] = voce;
  } else list.push(voce);
  const patch: Partial<State> = { roster: list };
  const host = list.find((r) => r.role === "host");
  const firstGuest = list.find((r) => r.role === "viewer");
  // Il viewer ricava il nome del consulente dal roster, ma SOLO se è un nome vero:
  // un hello senza nome diventa "Ospite" (default) e non deve mai sovrascrivere il
  // presenterName ricevuto via callstate (bug: "Solo tu" mostrava "Ospite").
  if (host && isRealName(host.name)) patch.presenterName = host.name;
  if (S.role === "host" && firstGuest) patch.guestName = firstGuest.nomeVero || firstGuest.name; // {NOME} teleprompter
  set(patch);
  // primo ospite entrato → registrazione automatica (se la cattura è già pronta)
  if (S.role === "host" && firstGuest) maybeAutoStartRecording();
}

/** Il gettone che ogni ospite ha annunciato entrando (vedi `hello`). */
const gettoneDelPid = new Map<string, string>();

/** ── ⚠️ CHI HA SALUTATO DI RECENTE, ANCHE SE NON È PIÙ IN ELENCO ──────────
 *  Bug misurato in locale, con pannello e cliente aperti insieme: il cliente
 *  entra, il pannello dice «in linea», e poco dopo torna a dire «non entrato»
 *  — con lui ancora lì, sul suo preventivo.
 *  La causa NON è nostra: quando una scheda resta in secondo piano più di
 *  qualche minuto, Chrome le strozza i tempi (un giro al minuto invece di uno
 *  ogni tre secondi). Il cliente continua a esserci — il filo del canale non
 *  si tocca — ma i suoi «sono qui» arrivano rari, e il collettore dei
 *  fantasmi (che aspetta dieci secondi) lo dichiara uscito. E il cliente in
 *  secondo piano è la normalità: guarda il telefono, risponde a un messaggio,
 *  mette la finestra dietro a quella del consulente.
 *  Perciò il PANNELLO non si fida dell'elenco dei riquadri, che serve ai
 *  media e deve restare severo: si ricorda quando ciascuno ha salutato per
 *  l'ultima volta, e considera presente chi si è fatto sentire nell'ultimo
 *  minuto e mezzo. Chi chiude davvero la scheda manda `bye`, e sparisce
 *  subito. */
const SALUTO_VALE_MS = 90_000;
const salutoDelPid = new Map<string, { at: number; leadId: string }>();

/** Gli ospiti che hanno salutato di recente e che l'elenco dei riquadri non
 *  ha più (vedi il cartello sopra). */
function ospitiSalutatiDiRecente(): { leadId?: string }[] {
  const ora = Date.now();
  const out: { leadId?: string }[] = [];
  for (const [pid, v] of [...salutoDelPid]) {
    if (ora - v.at > SALUTO_VALE_MS) {
      salutoDelPid.delete(pid);
      continue;
    }
    if (S.roster.some((r) => r.pid === pid)) continue; // già in elenco: non si conta due volte
    out.push(v.leadId ? { leadId: v.leadId } : {});
  }
  return out;
}

/** L'elenco degli attesi è appena arrivato: le righe già in elenco che non
 *  avevano una scheda la ricevono adesso. */
function ribattezzaConGliAttesi() {
  if (isViewer()) return;
  for (const r of S.roster) {
    if (r.role !== "viewer" || r.leadId) continue;
    const g = gettoneDelPid.get(r.pid);
    const a = g ? S.attesi.find((x) => x.gettone === g) : null;
    if (!a) continue;
    console.log("[HOST] riconosciuto in ritardo:", r.name, "→", a.nome);
    upsertRoster(r.pid, r.name, r.role, r.camOn, { nomeVero: a.nome, leadId: a.leadId });
  }
}

function removePeer(pid: string, why = "unspecified") {
  const p = peers.get(pid);
  console.log(
    "[PEER] close",
    pid,
    "reason=" + why,
    "state=" + (p?.connectionState || "no-pc"),
    "media=" + hasLiveMedia(pid),
  );
  if (p) {
    try {
      p.close();
    } catch {
      /* */
    }
  }
  peers.delete(pid);
  remoteStreams.delete(pid);
  pendingIce.delete(pid);
  lastSeen.delete(pid);
  firstSeen.delete(pid);
  badSince.delete(pid);
  deviceOf.delete(pid);
  lastIceRestart.delete(pid);
  gettoneDelPid.delete(pid);
  //  Il timer di ripresa muore col peer: acceso su una connessione chiusa
  //  proverebbe a riparare qualcosa che non esiste più.
  annullaRipresa(pid);
  set({ roster: S.roster.filter((r) => r.pid !== pid), connected: anyConnected() });
  emitStreams();
}

/** BUG PARTECIPANTI FANTASMA — azzera COMPLETAMENTE la presenza.
 *  Va chiamato all'avvio/chiusura chiamata e a ogni cambio di sessione: una nuova
 *  sessione non deve MAI ereditare i partecipanti di quella precedente. */
function resetRoster() {
  peers.forEach((p) => {
    try {
      p.close();
    } catch {
      /* */
    }
  });
  peers.clear();
  remoteStreams.clear();
  pendingIce.clear();
  lastSeen.clear();
  firstSeen.clear();
  badSince.clear();
  deviceOf.clear();
  lastIceRestart.clear();
  ripresaTimer.forEach((t) => clearTimeout(t));
  ripresaTimer.clear();
  set({ roster: [], connected: false, focusPid: null, activeSpeakerPid: null });
  emitStreams();
}

// Soglie del garbage collector della presenza (ms).
/** Ultimo verdetto AUTOREVOLE del server: il presentatore è in chiamata? */
let srvCallActive = true;
/** Il server ha risposto almeno una volta sulla sessione: serve a distinguere
 *  «non c'è nessuna chiamata» da «non lo so ancora». Vedi `guestVeilActive`. */
let srvSessioneLetta = false;
export function setServerCallActive(v: boolean) {
  srvCallActive = v;
  srvSessioneLetta = true;
}
/*  ── ⚠️ QUI C'ERANO I QUATTRO TAGLI CHE FACEVANO LAMPEGGIARE UN CLIENTE ──
    `STALE_MS` (nessun saluto da 10s), `NO_PEER_MS` (nessuna connessione dopo
    12s), `NEVER_MS` (mai arrivata a «collegato» dopo 45s) e `BAD_PEER_MS`.
    Al cliente con la camera spenta capitavano tutti insieme, ed era lì —
    vedi il cartello in `gcRoster` e la regola provata in
    `shop/resta-in-lista`, che adesso decide al posto loro.
    `BAD_PEER_MS` vive ancora là dentro, come `GUASTO_MS`: solo `failed` conta
    come filo morto, e con pazienza — `disconnected` è uno stato TRANSITORIO
    normale in WebRTC, e chiudere su quello dopo 10s era la causa vera del
    ciclo «cade e si riconnette ogni dieci secondi». */
const GHOST_MS = 15_000; // voce senza peer / senza media e senza hello da 15s → fantasma
const HOST_GONE_MS = 10_000; // (ospite) presentatore senza hello da 10s + peer chiuso/fallito → uscito

/** OSPITE — IL PRESENTATORE NON È PIÙ IN CHIAMATA → schermata d'attesa brandizzata.
 *  Vale sia per il verdetto AUTOREVOLE del server (battito `callActive` scaduto,
 *  con la sua isteresi) sia per il segnale LOCALE rapido (peer chiuso/fallito +
 *  nessun hello da >10s). Smonta media e peer in modo pulito, ma NON chiede di
 *  nuovo il nome: `joined` resta (ingresso sticky) così al ritorno del
 *  presentatore ("Riprendi"/"Videochiamata") l'ospite riparte da solo. */
function guestBackToWaiting(why: string) {
  if (S.role !== "viewer" || S.kicked) return;
  if (!S.sessionLive && !S.active && !localStream && !peers.size) return; // già in attesa
  /*  ── ⚠️ NON SI TORNA IN ATTESA MENTRE LO SI STA SENTENDO ──────────────
      Segnalazione del committente: «a un certo punto al cliente si chiude la
      scheda del preventivo e gli dice che si sta per connettere, ma continua
      a sentirmi».
      È il quadro esatto di questa funzione chiamata a torto: la schermata
      d'attesa copre tutto mentre la voce continua ad arrivare, perché il
      verdetto che la fa scattare è un BATTITO sul server, e il battito è un
      timer del browser — in una scheda lasciata in secondo piano i browser lo
      rallentano a uno al minuto, e il server dopo 25 secondi dichiarava la
      consulenza non più viva. Il presentatore, intanto, stava parlando.
      Una connessione audio/video viva con il presentatore è la prova più forte
      che esista: batte qualunque battito mancante. Se c'è, qui non si esce —
      e quando il presentatore se ne va davvero la connessione cade da sola,
      che è il segnale che questa funzione deve aspettare. */
  if (anyConnected()) {
    console.log("[GUEST] richiesta attesa IGNORATA: la connessione col presentatore è viva —", why);
    return;
  }
  console.log("[GUEST] → schermata d'attesa:", why);
  teardownMedia({ keepJoined: true }); // peer chiusi, camera/mic rilasciati, roster pulito
  //  ⚠️ la MODALITÀ non si tocca: è una scelta del presentatore (Contenuti+PiP o
  //  Videochiamata). Azzerandola qui, un rientro dopo un'interruzione riportava
  //  il cliente in "Videochiamata" pur avendo tu attivo "Contenuti + PiP".
  set({ sessionLive: false, active: false, focusPid: null });
}

/** OSPITE — il presentatore è tornato: riapre presenza e media senza richiedere il nome. */
function guestResumeCall() {
  if (S.role !== "viewer" || S.kicked || !S.joined) return;
  console.log("[GUEST] presentatore di nuovo in chiamata → riprendo presenza/media");
  sendHello(true);
  void viewerEnsureMedia();
}

/** Un solo passaggio di raccolta: rimuove ogni voce non più viva.
 *  REGOLA: resta in lista SOLO chi ha un hello recente E (una connessione viva
 *  oppure è arrivato da poco). Chi non ha né peer né hello sparisce subito. */
function gcRoster() {
  const now = Date.now();
  for (const r of S.roster.slice()) {
    // L'OSPITE non rimuove il presentatore CONNESSO dalla propria lista (batte il
    // ciclo di presenza solo mentre ha i media aperti → il GC lo faceva sparire
    // pur essendo dall'altra parte). Ma una voce host MAI diventata reale non può
    // restare per sempre: era la sorgente della TILE FANTASMA "connessione…" che
    // solo l'ospite vedeva. Scade se non ha alcun peer o non ha mai prodotto media.
    if (isViewer() && r.role === "host") {
      const pcH = peers.get(r.pid);
      const csH = pcH?.connectionState;
      const firstH = firstSeen.get(r.pid) || now;
      const seenH = lastSeen.get(r.pid) || 0;
      // ── IL PRESENTATORE È USCITO (scheda chiusa / rete caduta) ────────────
      //  BUG STORICO: qui si usciva subito con `continue` se `peerIsHealthy`.
      //  Ma su una traccia REMOTA `readyState` resta "live" anche quando l'altro
      //  lato non c'è più (il browser la marca solo `muted`): il presentatore
      //  restava per sempre in lista come tile "camera spenta" senza nome, e
      //  l'ospite non tornava mai alla schermata d'attesa.
      //  Segnale locale RAPIDO (richiesto): nessun `hello` da >10s **e**
      //  connessione chiusa/fallita. `disconnected` è transitorio → non conta:
      //  in quel caso decide il battito autorevole del server (~25s).
      const helloDead = seenH > 0 && now - seenH > HOST_GONE_MS && now - firstH > HOST_GONE_MS;
      const pcDead = !pcH || csH === "closed" || csH === "failed";
      // ── IL SEGNALE LOCALE NON PUÒ CONTRADDIRE IL SERVER ───────────────────
      //  VERIFICATO CON UNA PROVA REALE: se il cliente non riesce ad aprire
      //  camera e microfono (permesso non ancora dato, nessun dispositivo, un
      //  telefono lento), nessuna connessione si forma. Questo segnale leggeva
      //  quell'assenza come "il presentatore se n'è andato" e riportava il
      //  cliente in attesa — mentre tu eri lì. Da quel rientro nasceva anche la
      //  modalità che tornava a "Videochiamata".
      //  Ora il segnale locale può solo ANTICIPARE il verdetto del server, mai
      //  contraddirlo: se il server dice che sei ancora in chiamata, non scatta.
      if (helloDead && pcDead && srvCallActive) {
        console.log(
          "[GUEST] connessione assente ma il server dice che il presentatore è in chiamata → NON esco",
        );
      }
      if (helloDead && pcDead && !srvCallActive) {
        removePeer(r.pid, "presentatore-uscito(no-hello>10s + pc " + (csH || "assente") + ")");
        guestBackToWaiting("presentatore non più in chiamata (segnale locale)");
        continue;
      }
      if (peerIsHealthy(r.pid)) {
        badSince.delete(r.pid);
        continue;
      }
      if (
        now - firstH > GHOST_MS &&
        (!pcH || (!remoteStreams.get(r.pid) && now - seenH > GHOST_MS))
      ) {
        removePeer(r.pid, "host-fantasma>15s");
        continue;
      }
      continue;
    }
    /*  ── ⚠️ UN RIQUADRO NON SI TOGLIE A CHI STA DICENDO «CI SONO» ───────
        Segnalazione del committente, con due fotografie a quattro secondi di
        distanza: il riquadro del cliente c'è, non c'è, torna. «Continuamente
        mi scollega la camera dell'utente e la rimette».
        Qui si toglieva per tre motivi che al suo cliente capitavano tutti
        insieme: nessun saluto da 10s (ma i saluti li manda la SUA scheda, e
        una scheda in secondo piano il browser la rallenta o la ferma —
        nella fotografia le finestre sono due, affiancate), nessuna
        connessione dopo 12s, connessione mai arrivata a «collegato» dopo 45.
        Con la camera spenta non arriva nessun flusso, quindi la connessione
        resta a «connessione…» e quei tagli scattano su una persona che è lì.
        La regola sta in `shop/resta-in-lista`, dov'è provata. Qui restano
        soltanto le conseguenze: riprovare il filo, o toglierlo. */
    const pc = peers.get(r.pid);
    const cs = pc?.connectionState;
    if (cs === "failed") {
      if (!badSince.has(r.pid)) badSince.set(r.pid, now);
    } else if (cs === "connected") badSince.delete(r.pid);
    const verdetto = verdettoSuOspite({
      adesso: now,
      ultimoSaluto: lastSeen.get(r.pid) || 0,
      stato: (cs as "connected" | undefined) ?? "assente",
      haMedia: peerIsHealthy(r.pid),
      guastoDa: badSince.get(r.pid) || 0,
      //  ⚠️ Da quando è comparso: nei primi secondi la connessione si sta
      //   creando e non si tocca (vedi `GRAZIA_AVVIO_MS`). È il minuto di
      //   «camera spenta e senza audio» misurato dal committente.
      primaVolta: firstSeen.get(r.pid) || 0,
    });
    if (verdetto === "resta") {
      if (peerIsHealthy(r.pid)) badSince.delete(r.pid);
      continue;
    }
    if (verdetto === "riprova") {
      //  L'ICE-restart lo fa uno solo dei due (il pid più piccolo), e ha un suo
      //  tempo di attesa dentro `reoffer`: qui non si accelera niente.
      if (S.myPid < r.pid) {
        reoffer(r.pid);
        badSince.set(r.pid, now);
      }
      continue;
    }
    removePeer(
      r.pid,
      "non saluta più da " + Math.round((now - (lastSeen.get(r.pid) || now)) / 1000) + "s",
    );
  }
}

/** "Pulisci lista" — via di fuga manuale: tiene SOLO chi ha una connessione viva. */
export function purgeRoster() {
  for (const r of S.roster.slice()) {
    if (peerIsHealthy(r.pid)) continue;
    const cs = peers.get(r.pid)?.connectionState;
    if (cs !== "connected" && cs !== "connecting" && cs !== "new")
      removePeer(r.pid, "purge-manuale");
  }
  gcRoster();
}

/** Il GC della presenza gira SEMPRE finché il canale è agganciato (non solo durante
 *  la chiamata): era proprio questo il buco che lasciava i fantasmi in lista. */
function startRosterGC() {
  if (!gcTimer) gcTimer = setInterval(gcRoster, 3000);
}
function stopRosterGC() {
  if (gcTimer) {
    clearInterval(gcTimer);
    gcTimer = null;
  }
}

/** L'ospite avvisa di essere uscito quando chiude/ricarica la scheda. */
let leaveHooked = false;
function hookLeave() {
  if (leaveHooked || typeof window === "undefined") return;
  leaveHooked = true;
  const bye = () => {
    try {
      if (S.myPid) send("bye", { pid: S.myPid });
    } catch {
      /* */
    }
  };
  window.addEventListener("pagehide", bye);
  window.addEventListener("beforeunload", bye);
  // scheda nascosta: NON esco (cambio tab su mobile è normale), ma i timer vengono
  // rallentati dal browser → un ultimo hello tiene viva la voce ancora qualche secondo
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) sendHello(true);
  });
}

/** ── SI SCENDE LA SCALA FINCHÉ UNA RICHIESTA RIESCE ───────────────────────
 *  Perché esista, e in che ordine si scende, sta in shop/apertura-camera. Qui
 *  c'è solo il giro: si prova, si dimentica quello che non c'è più, e si scrive
 *  a chi sta lavorando che cosa si è perso per strada.
 *  ⚠️ L'ULTIMO ERRORE SI RILANCIA: chi chiama distingue «sono in chiamata senza
 *   camera» da «non è partito niente», e le due cose non si dicono uguali. */
async function apriMedia(p: {
  video: MediaTrackConstraints | false;
  audio: MediaTrackConstraints | boolean;
}): Promise<MediaStream> {
  const scala = tentativiMedia({
    video: p.video,
    audio: p.audio,
    camId: getCamDeviceId(),
    micId: getMicDeviceId(),
  });
  let ultimo: unknown = null;
  for (const t of scala) {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: t.video,
        audio: t.audio,
      } as MediaStreamConstraints);
      scordaDispositivi(t.scorda);
      const nota = esitoApertura({ rinuncia: t.rinuncia, errore: ultimo });
      if (nota) {
        console.warn("[MEDIA] aperti con una rinuncia:", t.rinuncia, nota);
        set({ mediaAvviso: nota, diag: nota });
      } else if (S.mediaAvviso) set({ mediaAvviso: null });
      return s;
    } catch (e) {
      ultimo = e;
      console.warn(`[MEDIA] tentativo fallito (rinuncia: ${t.rinuncia})`, e);
    }
  }
  set({ mediaAvviso: spiegaErroreMedia(ultimo) });
  throw ultimo;
}
/** I dispositivi scelti a mano che si sono rivelati inesistenti: si buttano,
 *  altrimenti alla prossima apertura si ricomincia da capo con l'errore. */
function scordaDispositivi(quali: Tentativo["scorda"]) {
  for (const q of quali) {
    try {
      localStorage.removeItem(q === "camera" ? CAM_DEV_KEY : MIC_DEV_KEY);
    } catch {
      /* */
    }
    console.warn(`[MEDIA] dimenticata la ${q} scelta a mano: non è più collegata`);
  }
}

async function openMedia(): Promise<MediaStream> {
  await prefetchIce(); // popola cachedIce PRIMA di creare qualsiasi peer (makePeer resta sincrono)
  // RISOLUZIONE RICHIESTA ESPLICITAMENTE. Con `video: true` il browser sceglie il
  // default della camera (spesso 640×480, a volte 320×240): quella è la
  // risoluzione con cui nasceva la tela del compositor di sfocatura → immagine
  // "molto spixellata" in uscita, mentre in ENTRATA arrivava un 720p perfetto.
  const s = await apriMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } },
    audio: S.role === "host" ? micAudioConstraints(false) : true,
  });
  localStream = s;
  emitStreams();
  // ── LE CONNESSIONI NATE PRIMA DEI MEDIA VANNO RIPARATE ────────────────────
  //  Le tracce si agganciano a una connessione nel momento in cui questa nasce.
  //  Da quando la chiamata si avvia PRIMA di aprire camera e microfono (per non
  //  restare bloccati sul permesso), le connessioni possono nascere vuote: né
  //  tu vedi lui, né lui vede te. Qui, appena i media esistono, si ripara.
  //  Il controllo è a fine funzione (dopo la catena del microfono), vedi sotto.
  // camOn/micOn riflettono l'INTENZIONE (camera viva) da SUBITO: se restasse un
  // vecchio `camOn: false` durante il caricamento del modello di sfocatura, gli
  // hello di risposta e l'anteprima locale mostrerebbero il segnaposto "camera
  // spenta" a intermittenza nei primi secondi (flicker on/off all'avvio).
  set({ camOn: true, micOn: true });
  // PRESENTATORE: si aggancia il misuratore + la soglia. La traccia inviata
  // resta quella del dispositivo, quindi `out === rawA` e lo scambio non serve:
  // il confronto resta come rete di sicurezza, non come percorso previsto.
  if (S.role === "host") {
    const rawA = s.getAudioTracks()[0];
    if (rawA) {
      const out = buildMicChain(rawA);
      if (out !== rawA) {
        s.removeTrack(rawA);
        s.addTrack(out);
        emitStreams();
      }
    }
  }
  // ora che le tracce definitive esistono: ripara le connessioni nate vuote
  setTimeout(() => attachLocalMediaToPeers("media aperti"), 0);
  //  ⚠️ E se si stava già registrando (succede sempre: la registrazione parte
  //   all'ingresso dell'ospite, i media si aprono dopo), la mia voce entra
  //   adesso — con la traccia DEFINITIVA, quella uscita dalla catena del
  //   microfono qui sopra.
  collegaVoceAlRegistratore(s, "io");
  // sfocatura sfondo ricordata dalla chiamata precedente → applicata subito
  if (S.role === "host" && S.blurOn) {
    const raw = s.getVideoTracks()[0];
    if (raw) {
      const out = await startBlurPipeline(raw); // ritorna SOLO quando la pipeline produce fotogrammi composti
      if (out && out !== raw) {
        console.log("[CAM] avvio: camera semplice → sfocata (swap unico, pipeline pronta)");
        s.removeTrack(raw);
        s.addTrack(out);
        emitStreams();
      }
    }
  }
  // ora che ho i media, mi collego a chi è già presente + mi riannuncio
  // (con richiesta di risposta: se l'altro lato mi conosce già devo comunque
  //  ricevere il suo hello, altrimenti resto senza presentatore in lista)
  sendHello(true);
  S.roster.forEach((r) => maybeInitiate(r.pid));
  return s;
}

// presenza: annuncio periodico + raccolta dei peer scomparsi
function startPresence() {
  stopPresence();
  sendHello();
  helloTimer = setInterval(sendHello, 3000);
  // il presentatore pubblica la lista autorevole ogni 5s (l'ospite riconcilia)
  if (!isViewer() && !rosterTimer) rosterTimer = setInterval(broadcastRoster, 5000);
  startRosterGC();
}
function stopPresence() {
  if (helloTimer) {
    clearInterval(helloTimer);
    helloTimer = null;
  }
  if (rosterTimer) {
    clearInterval(rosterTimer);
    rosterTimer = null;
  }
  // il GC NON si ferma: deve continuare a ripulire anche fuori dalla chiamata
}

// ── UN SOLO CONTESTO AUDIO ─────────────────────────────────────────────────
//  PERCHÉ LA VOCE SI ROVINAVA E NON TORNAVA PIÙ. Ogni funzione audio apriva un
//  AudioContext suo: rilevamento della voce, misuratore di chi parla, anelli
//  dei partecipanti, catena del microfono, traccia silenziosa, suoni
//  dell'interfaccia, registrazione. Sette contesti, e ognuno è un thread audio
//  in tempo reale con la sua latenza e il suo costo. Cambiando schermata o
//  mostrando un video se ne aggiungevano altri, il thread audio del browser
//  andava in saturazione e la voce cominciava a spezzettarsi.
//  Il punto peggiore è che non tornava indietro: i contesti restavano aperti
//  anche a carico finito, e nemmeno un ricaricamento della pagina del cliente
//  poteva sistemarlo, perché il degrado era su CHI PARLA, non su chi ascolta.
//  Ora il contesto è UNO SOLO, condiviso: si crea alla prima necessità, non si
//  chiude mai, e si limita a essere risvegliato se il browser lo sospende.
let sharedCtx: AudioContext | null = null;
export function audioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    //  Un contesto CHIUSO non si può resuscitare: se ne trova uno chiuso — per
    //  un errore nostro o perché il sistema l'ha terminato — se ne apre uno
    //  nuovo, altrimenti da quel momento in poi resterebbe tutto muto.
    if (sharedCtx && (sharedCtx.state as string) === "closed") {
      console.warn("[AUDIO] contesto condiviso chiuso → ne apro uno nuovo");
      sharedCtx = null;
      try {
        delete (window as any).__hgAudioCtx;
      } catch {
        (window as any).__hgAudioCtx = undefined;
      }
    }
    if (!sharedCtx) {
      const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!Ctx) return null;
      // se i suoni dell'interfaccia ne hanno già aperto uno, si riusa quello
      const gia = (window as any).__hgAudioCtx as AudioContext | undefined;
      const valido = gia && (gia.state as string) !== "closed" ? gia : undefined;
      sharedCtx = valido || new Ctx();
      (window as any).__hgAudioCtx = sharedCtx;
      console.log("[AUDIO] contesto condiviso", valido ? "riusato" : "creato");
    }
    const c = sharedCtx as AudioContext;
    if (c.state === "suspended") {
      void c.resume().catch(() => {
        /* */
      });
      svegliaAlPrimoGesto(c);
    }
    return c;
  } catch {
    return null;
  }
}

/*  ── ⚠️ UN CONTESTO SOSPESO SI SVEGLIA SOLO CON UN GESTO ───────────────────
    `resume()` su una pagina che nessuno ha ancora toccato non fa niente, e la
    sua promessa può non risolversi mai. Finché il contesto resta sospeso la
    sua destinazione non produce campioni: la registrazione ne muore (0 byte
    contro 117.019 — la misura sta in shop/registrazione), e i suoni
    dell'interfaccia non si sentono.
    Il caso vero è una scheda RICARICATA: la consulenza si riprende da sola,
    entra l'ospite, la registrazione parte da sola, e da quel caricamento
    nessuno ha ancora cliccato niente. Da qui in poi il primo tocco qualsiasi
    — un clic, un tasto — lo risveglia, e le registrazioni che partono dopo
    hanno la voce.
    ⚠️ IN ASCOLTO UNA VOLTA SOLA: l'ascolto si stacca appena il contesto è in
     funzione, altrimenti resterebbero attaccati a `window` per sempre tre
     ascolti per ogni chiamata a `audioCtx()` (che sono centinaia). */
let staccaSveglia: (() => void) | null = null;
const GESTI = ["pointerdown", "keydown", "touchstart"] as const;
function svegliaAlPrimoGesto(c: AudioContext) {
  if (staccaSveglia || typeof window === "undefined") return;
  const tocco = () => {
    void c.resume().catch(() => {
      /* */
    });
    //  Lo stato non cambia nell'istante stesso: si guarda un attimo dopo, e se
    //  è in funzione non serve più stare in ascolto.
    window.setTimeout(() => {
      if ((c.state as string) === "running") staccaSveglia?.();
    }, 120);
  };
  staccaSveglia = () => {
    staccaSveglia = null;
    GESTI.forEach((e) => window.removeEventListener(e, tocco, true));
    console.log("[AUDIO] contesto condiviso risvegliato da un tocco");
  };
  GESTI.forEach((e) => window.addEventListener(e, tocco, true));
}

// ── auto-duck: rileva la voce del presentatore sul suo microfono ──────────
function startVAD(stream: MediaStream) {
  stopVAD();
  try {
    const ctx = audioCtx();
    if (!ctx) return;
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    let speaking = false;
    let quietSince = 0;
    const loop = () => {
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      const now = performance.now();
      if (rms > 0.045) {
        quietSince = now;
        if (!speaking) {
          speaking = true;
          setSpeaking(true);
          send("speaking", { v: true });
        }
      } else if (speaking && now - quietSince > 250) {
        speaking = false;
        setSpeaking(false);
        send("speaking", { v: false });
      }
      vad!.raf = requestAnimationFrame(loop);
    };
    vad = { ctx, src, raf: requestAnimationFrame(loop) };
  } catch {
    /* no audio ctx */
  }
}
function stopVAD() {
  // il contesto è condiviso: si stacca il nodo, non si chiude nulla
  if (vad) {
    cancelAnimationFrame(vad.raf);
    try {
      vad.src.disconnect();
    } catch {
      /* */
    }
    vad = null;
  }
  setSpeaking(false);
}

// ── Feature 4 — ACTIVE SPEAKER: livello audio per-stream (mic locale + remoti) ──
//  Sceglie il pid più "forte" sopra soglia e lo trasmette; il guest mostra quel
//  partecipante in un PiP. Best-effort via WebAudio AnalyserNode.
let asCtx: AudioContext | null = null;
let asRaf = 0;
// ── PERCHÉ DOPO QUALCHE MINUTO LA VOCE DIVENTAVA ROBOTICA ───────────────────
//  Per sapere CHI sta parlando si costruisce un piccolo misuratore su ogni
//  flusso audio. La costruzione veniva rifatta a ritmo fisso — una volta al
//  secondo — e i misuratori vecchi venivano solo dimenticati, non smontati:
//  restavano agganciati al motore audio del browser. Con due partecipanti sono
//  due nuovi agganci al secondo, cioè circa 600 dopo cinque minuti, tutti
//  serviti dal thread audio in tempo reale. Quando quel thread non ce la fa più,
//  TUTTO l'audio del programma si spezzetta: la voce che invii e quella che
//  ricevi. E non si riprende, perché nulla veniva mai rilasciato.
//  Rimedio: il misuratore si costruisce UNA volta per traccia e si smonta quando
//  quella traccia sparisce davvero. Costo costante, qualunque sia la durata.
interface Meter {
  src: MediaStreamAudioSourceNode;
  an: AnalyserNode;
  track: MediaStreamTrack;
}
const asNodes = new Map<string, Meter>();
let asLast = "";
function buildAnalyser(ctx: AudioContext, stream: MediaStream): Meter | null {
  try {
    const track = stream.getAudioTracks()[0];
    if (!track) return null;
    const src = ctx.createMediaStreamSource(stream);
    const an = ctx.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    return { src, an, track };
  } catch {
    return null;
  }
}
function disposeMeter(m: Meter | undefined) {
  if (!m) return;
  try {
    m.src.disconnect();
  } catch {
    /* */
  }
  try {
    m.an.disconnect();
  } catch {
    /* */
  }
}
/** Aggiorna i misuratori SOLO dove la traccia è cambiata: nessuna ricostruzione inutile. */
function syncMeters(ctx: AudioContext, map: Map<string, Meter>) {
  const want = new Map<string, MediaStream>();
  if (localStream && S.myPid) want.set(S.myPid, localStream);
  remoteStreams.forEach((st, pid) => want.set(pid, st));
  // via i misuratori di chi non c'è più
  for (const [pid, m] of [...map]) {
    if (!want.has(pid)) {
      disposeMeter(m);
      map.delete(pid);
    }
  }
  // aggiungi/aggiorna solo se la TRACCIA è diversa (una rinegoziazione la cambia
  // pur lasciando lo stesso partecipante)
  want.forEach((stream, pid) => {
    const track = stream.getAudioTracks()[0];
    const cur = map.get(pid);
    if (cur && track && cur.track === track) return; // già a posto: non si tocca
    if (cur) {
      disposeMeter(cur);
      map.delete(pid);
    }
    if (!track) return;
    const m = buildAnalyser(ctx, stream);
    if (m) map.set(pid, m);
  });
}
function startActiveSpeaker() {
  stopActiveSpeaker();
  try {
    const ctx = audioCtx();
    if (!ctx) return;
    asCtx = ctx;
    const rebuild = () => syncMeters(ctx, asNodes);
    rebuild();
    /*  ── ⚠️ NON PIÙ SESSANTA DECISIONI AL SECONDO ────────────────────────
        Qui si decideva chi parla a OGNI fotogramma, e senza esitazione: il
        più forte dell'istante prendeva la scena e partiva un messaggio sul
        canale. In una conversazione vera il «più forte» cambia di continuo —
        due voci che si accavallano, un respiro, una sedia — e il risultato lo
        vedeva il cliente: la camerina cambiava faccia decine di volte al
        secondo (una camera che si spegne e si riaccende), il riquadro passava
        da due cerchi a uno (una camera che si allarga e si stringe) e il
        blocco, cambiando altezza, faceva saltare il cerchio su e giù.
        Le tre regole che tolgono lo sfarfallio — margine, attesa, rilascio
        lento — stanno in shop/oratore, dove si possono mettere alla prova
        senza un microfono. Qui resta la misura.
        ⚠️ E si misura ogni ~150 ms invece che a ogni fotogramma: la voce umana
         non cambia padrone otto volte in un decimo di secondo, e sono otto
         misurazioni su nove risparmiate a un portatile che sta già
         codificando due video. */
    let stato = statoOratoreVuoto();
    let ultimaMisura = 0;
    let ultimoAggancio = 0;
    //  Il buffer si alloca UNA volta: allocarne uno per partecipante a ogni
    //  fotogramma vuol dire spazzatura da raccogliere in piena chiamata.
    let buf = new Uint8Array(2048);
    const loop = () => {
      const ora = Date.now();
      if (ora - ultimoAggancio >= 500) {
        ultimoAggancio = ora;
        rebuild();
      }
      if (ora - ultimaMisura >= 150) {
        ultimaMisura = ora;
        const misure: Misura[] = [];
        asNodes.forEach((m, pid) => {
          const an = m.an;
          if (buf.length !== an.fftSize) buf = new Uint8Array(an.fftSize);
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) {
            const v = (buf[i] - 128) / 128;
            sum += v * v;
          }
          misure.push({ pid, rms: Math.sqrt(sum / buf.length) });
        });
        const dopo = passoOratore(stato, misure, ora);
        //  ⚠️ Si parla SOLO quando la scena cambia davvero: prima partiva un
        //   messaggio a ogni cambio del più forte, cioè una raffica.
        if (dopo.attuale !== stato.attuale) {
          asLast = dopo.attuale;
          set({ activeSpeakerPid: dopo.attuale || null });
          send("activespeaker", { pid: dopo.attuale });
        }
        stato = dopo;
      }
      asRaf = requestAnimationFrame(loop);
    };
    asRaf = requestAnimationFrame(loop);
  } catch {
    // fallback: nessuna rilevazione → mostra la camera del presentatore come PiP
    const fb = S.myPid;
    asLast = fb;
    set({ activeSpeakerPid: fb });
    send("activespeaker", { pid: fb });
  }
}
// ── CHI STA PARLANDO: ALONE SULLA CAMERA (come su Zoom) ────────────────────
//  Calcolato IN LOCALE da ogni dispositivo sui flussi che già possiede (il
//  proprio microfono e quelli che riceve): nessun messaggio in più sul canale,
//  nessun ritardo di rete, e funziona identico sul presentatore e sull'ospite.
//  Soglia con isteresi + coda di 400ms: l'alone non lampeggia fra una parola e
//  l'altra.
let spkCtx: AudioContext | null = null;
let spkTimer = 0;
const spkNodes = new Map<string, Meter>();
const spkUntil = new Map<string, number>();
export function startSpeakingRings() {
  stopSpeakingRings();
  try {
    const ctx = audioCtx();
    if (!ctx) return;
    spkCtx = ctx;
    let tick = 0;
    const rebuild = () => syncMeters(ctx, spkNodes);
    rebuild();
    spkTimer = window.setInterval(() => {
      if (ctx.state !== "running") {
        void ctx.resume().catch(() => {});
      }
      if (++tick % 10 === 0) rebuild(); // ~1s: aggancia nuovi flussi
      const now = Date.now();
      spkNodes.forEach((m, pid) => {
        // il mio microfono spento non deve mai illuminarsi
        if (pid === S.myPid && !S.micOn) return;
        const an = m.an;
        const buf = new Uint8Array(an.fftSize);
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        const on = spkUntil.has(pid) && (spkUntil.get(pid) || 0) > now;
        if (rms > (on ? 0.022 : 0.038)) spkUntil.set(pid, now + 400); // isteresi + coda
      });
      const live = [...spkUntil.entries()]
        .filter(([, t]) => t > now)
        .map(([pid]) => pid)
        .sort();
      const prev = [...S.speakingPids].sort();
      if (live.join("|") !== prev.join("|")) set({ speakingPids: live });
    }, 100);
  } catch {
    /* niente WebAudio: si resta senza alone, nulla si rompe */
  }
}
export function stopSpeakingRings() {
  if (spkTimer) {
    clearInterval(spkTimer);
    spkTimer = 0;
  }
  spkNodes.forEach(disposeMeter);
  spkNodes.clear();
  spkUntil.clear();
  //  NON si chiude: è il contesto condiviso di tutta l'applicazione (voce,
  //  suoni, chi sta parlando). Chiuderlo è definitivo e lascia muto tutto.
  spkCtx = null;
  if (S.speakingPids.length) set({ speakingPids: [] });
}

function stopActiveSpeaker() {
  if (asRaf) cancelAnimationFrame(asRaf);
  asRaf = 0;
  asNodes.forEach(disposeMeter);
  asNodes.clear();
  asCtx = null;
  asLast = ""; // contesto condiviso: non si chiude
}

// ── trascrizione live (Web Speech) ────────────────────────────────────────
let recWanted = false;
/** Avvia il riconoscimento vocale se non già attivo (per trascrizione e teleprompter). */
export function ensureRecognition() {
  recWanted = true;
  startRecognition();
}
function startRecognition() {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR || recognition) return;
  recWanted = true;
  try {
    const r = new SR();
    r.lang = "it-IT";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = String(res[0].transcript).trim();
        if (!text) continue;
        if (res.isFinal) {
          const line: TransLine = { who: S.role || "host", text, t: Date.now() };
          set({ transcript: [...S.transcript, line] });
          send("transcript", line);
          if (S.role === "host") spokenSubs.forEach((f) => f(text)); // teleprompter (parole confermate)
        } else {
          interim += " " + text;
        }
      }
      // risultati intermedi → avanzamento fluido del teleprompter (solo host)
      if (interim.trim() && S.role === "host") spokenSubs.forEach((f) => f(interim));
    };
    r.onend = () => {
      if (recWanted) {
        try {
          r.start();
        } catch {
          /* */
        }
      }
    };
    r.onerror = () => {
      /* es. no-speech: onend riavvia */
    };
    r.start();
    recognition = r;
  } catch {
    /* non supportato */
  }
}
function stopRecognition() {
  recWanted = false;
  if (recognition) {
    try {
      recognition.onend = null;
      recognition.stop();
    } catch {
      /* */
    }
    recognition = null;
  }
}

// ── CONSUMO DATI: misura i byte scambiati dalla videochiamata ──────────────
//  Ogni 10s leggo pc.getStats() di OGNI RTCPeerConnection e sommo i DELTA di
//  bytesSent/bytesReceived (i contatori sono cumulativi per connessione, quindi
//  tengo l'ultimo valore per pid: se un peer esce smette semplicemente di
//  contribuire). Il totale della sessione viene salvato sul server ogni 60s
//  (sicurezza, se il browser viene chiuso di colpo) e alla fine della chiamata.
//  NOTA: sola lettura delle statistiche — nessun impatto su segnalazione/ICE.
interface UsageSession {
  id: string;
  startedAt: number;
  sent: number;
  recv: number;
  last: Map<string, { sent: number; recv: number }>;
  maxGuests: number;
}
let usage: UsageSession | null = null;
// campionamenti consecutivi in cui l'encoder si è dichiarato limitato dalla CPU
let cpuLimited = 0;
const cpuRelief = 1; // riduzione di risoluzione attualmente applicata (1 = nessuna)
/** ── QUANTA BANDA IN SALITA C'È DAVVERO, PER INTERLOCUTORE ────────────────
 *  ⚠️ Misurata sulla connessione viva (`availableOutgoingBitrate` della coppia
 *   di candidati scelta), non stimata: è l'unico numero che sa quanto passa
 *   sulla linea di CHI STA PRESENTANDO in questo momento. */
const bandaSu = new Map<string, number>();
/** L'ultimo tetto applicato per interlocutore: serve a salire a piccoli passi
 *  (vedi shop/banda.ts) e a non ripetere in console lo stesso numero. */
const tettoPrec = new Map<string, number>();
/** Quanti interlocutori si è detto l'ultima volta in console. */
let meshDetto = 0;
/** ── I CONTATORI DI PRIMA, PER MISURARE LE PERDITE IN ENTRATA ─────────────
 *  ⚠️ `inbound-rtp` non ha `fractionLost`: ha due contatori che salgono da
 *   inizio chiamata (`packetsLost`, `packetsReceived`). Il loro rapporto
 *   assoluto NON serve a niente: dopo mezz'ora di consulenza pulita, trenta
 *   pacchetti persi nei primi secondi restano lì a dire «tutto bene» anche
 *   mentre l'immagine si sta sbriciolando adesso. Quello che conta è quanto si
 *   è perso NEGLI ULTIMI DUE SECONDI E MEZZO, cioè la differenza — e per farla
 *   bisogna ricordarsi il giro prima. (In salita non serve: `remote-inbound-rtp`
 *   porta già `fractionLost`, che è per sua natura una frazione recente.) */
const persiPrima = new Map<string, { persi: number; presi: number }>();
let usageTimer: ReturnType<typeof setInterval> | null = null;
let usageSaveTimer: ReturnType<typeof setInterval> | null = null;
let bandaTimer: ReturnType<typeof setInterval> | null = null;

/** ── LA SONDA VELOCE DELLA LINEA ───────────────────────────────────────────
 *  ⚠️ Il tetto di invio si rifaceva ogni DIECI SECONDI, insieme al conteggio
 *   del traffico. Dieci secondi sono un'eternità di video che si impunta
 *   prima che il programma se ne accorga — ed è esattamente quello che si
 *   vede quando due trasmissioni partono insieme e si dividono la stessa
 *   linea: la banda crolla in un istante, il tetto la rincorre con comodo.
 *  Questa gira ogni due secondi e mezzo, legge SOLO quanto regge la linea e
 *  rimette i tetti. Niente conteggi, niente righe in console: il lavoro
 *  pesante resta a `sampleUsage`. */
async function sondaBanda() {
  if (!peers.size) {
    persiPrima.clear();
    silenzioDa.clear();
    if (S.linea) set({ linea: null });
    return;
  }
  const jobs: { pid: string; req: Promise<RTCStatsReport> }[] = [];
  for (const [pid, pc] of peers) {
    try {
      jobs.push({ pid, req: pc.getStats() });
    } catch {
      /* peer già chiuso */
    }
  }
  let peggiore = 0,
    ponte = false,
    limite: "cpu" | "rete" | "" = "";
  //  ⚠️ Di ritardo e perdite si tiene il PEGGIO fra gli interlocutori, non la
  //   media: in una consulenza a tre, una media dice «tutto discreto» mentre
  //   uno dei due non vede niente. Chi presenta deve accorgersi di quello che
  //   sta male, non della temperatura dell'ospedale.
  let rttMax = 0,
    suMax = 0,
    giuMax = 0;
  for (const { pid, req } of jobs) {
    try {
      const stats = await req;
      //  I candidati si leggono per id: la coppia scelta dice SOLO l'id, e
      //  senza risolverlo non si sa se il video passa diretto o da un ponte.
      const locali = new Map<string, any>();
      stats.forEach((r: any) => {
        if (r.type === "local-candidate") locali.set(r.id, r);
      });
      let persi = 0,
        presi = 0,
        byteGiu = 0;
      stats.forEach((r: any) => {
        if (r.type === "candidate-pair" && (r.nominated || r.state === "succeeded")) {
          const disp = Number(r.availableOutgoingBitrate) || 0;
          if (disp > 0) {
            bandaSu.set(pid, disp);
            peggiore = peggiore === 0 ? disp : Math.min(peggiore, disp);
          }
          const loc = locali.get(String(r.localCandidateId));
          if (loc && String(loc.candidateType) === "relay") ponte = true;
          //  `currentRoundTripTime` è in SECONDI e su alcuni browser manca nei
          //  primi campionamenti: si ripiega sulla media, meglio di zero.
          const giro =
            Number(r.currentRoundTripTime) ||
            Number(r.totalRoundTripTime) / (Number(r.responsesReceived) || 1) ||
            0;
          if (giro > 0) rttMax = Math.max(rttMax, giro * 1000);
        } else if (r.type === "outbound-rtp" && !r.isRemote && r.kind === "video") {
          const why = String(r.qualityLimitationReason || "none");
          if (why === "cpu") limite = "cpu";
          else if (why === "bandwidth" && limite !== "cpu") limite = "rete";
        } else if (r.type === "remote-inbound-rtp") {
          //  Questo rapporto lo scrive L'ALTRO su quello che gli mandiamo: è
          //  l'unica misura di come sta il percorso VERSO di lui. `fractionLost`
          //  arriva in ottavi di 256 come da protocollo, già normalizzato dal
          //  browser in frazione 0–1.
          const f = Number(r.fractionLost) || 0;
          if (f > 0) suMax = Math.max(suMax, f);
          //  ⚠️ E il ritardo si prende anche da qui, quando la coppia di
          //   candidati non lo dice. Misurato: su una connessione appena aperta
          //   — e su parecchi percorsi passati dal relay —
          //   `currentRoundTripTime` resta a zero, mentre questo (che arriva dai
          //   rapporti RTCP dell'altro) c'è. Senza questo ripiego il «ritardo»
          //   risultava zero proprio nei casi in cui serve leggerlo.
          const giroRtcp = Number(r.roundTripTime) || 0;
          if (giroRtcp > 0) rttMax = Math.max(rttMax, giroRtcp * 1000);
        } else if (r.type === "inbound-rtp" && !r.isRemote) {
          persi += Number(r.packetsLost) || 0;
          presi += Number(r.packetsReceived) || 0;
          //  ⚠️ I byte del SOLO media, non quelli della connessione. MISURATO:
          //   `candidate-pair.bytesReceived` continua a crescere anche quando
          //   non arriva un fotogramma — sono i controlli STUN e i rapporti
          //   RTCP che tengono aperta la strada. Con quel contatore il
          //   controllo del silenzio qui sotto non sarebbe scattato MAI
          //   (provato: tracce fermate, byte della coppia sempre in salita).
          //   Questi invece si fermano di colpo, ed è quello che serve sapere.
          byteGiu += Number(r.bytesReceived) || 0;
        }
      });
      //  La differenza dal giro prima (vedi `persiPrima`). Se i contatori sono
      //  tornati indietro — riconnessione, traccia rifatta — si ricomincia da
      //  capo invece di produrre una perdita negativa o enorme.
      const pre = persiPrima.get(pid);
      persiPrima.set(pid, { persi, presi });
      if (pre && persi >= pre.persi && presi >= pre.presi) {
        const dp = persi - pre.persi,
          dr = presi - pre.presi;
        //  Con pochissimi pacchetti nell'intervallo la frazione è rumore puro
        //  (1 perso su 3 = «33% di perdita»): sotto le 50 unità non si giudica.
        if (dp + dr >= 50) giuMax = Math.max(giuMax, dp / (dp + dr));
      }
      //  ── IL CONTROLLO DEL SILENZIO (vedi SILENZIO_MAX_MS) ────────────────
      const pc = peers.get(pid);
      const adesso = Date.now();
      const prec = silenzioDa.get(pid);
      if (!prec || byteGiu > prec.byte) {
        //  Arrivano byte: la connessione è viva, e il cronometro riparte.
        silenzioDa.set(pid, { byte: byteGiu, da: adesso });
      } else if (
        pc?.connectionState === "connected" &&
        prec.byte > 0 &&
        adesso - prec.da >= SILENZIO_MAX_MS
      ) {
        //  Connessa e muta da troppo: si ripara SUBITO, senza grazia. La grazia
        //  serve ai singhiozzi, e questi otto secondi l'hanno già fatta.
        console.log(
          `[PEER] silenzio ${Math.round((adesso - prec.da) / 1000)}s su connessione «connected» → riparo`,
          pid,
        );
        silenzioDa.set(pid, { byte: byteGiu, da: adesso }); // una volta per volta
        chiediRipresa(pid, 0, true);
      }
    } catch {
      /* connessione chiusa mentre si misurava */
    }
  }
  const kbit = Math.round(peggiore / 1000);
  const rttMs = Math.round(rttMax);
  const persiSu = Math.round(suMax * 1000) / 1000;
  const persiGiu = Math.round(giuMax * 1000) / 1000;
  const prima = S.linea;
  //  Si riscrive solo se cambia qualcosa di visibile: questa sonda gira ogni
  //  due secondi e mezzo, e un aggiornamento a ogni giro farebbe ridisegnare
  //  la barra durante tutta la consulenza per niente.
  //  ⚠️ Le soglie di indifferenza sono più piccole delle soglie del giudizio
  //   (shop/diagnosi-linea): se qui si ignorasse un cambio da 0 a 2,5% di
  //   perdita, il verdetto resterebbe «linea a posto» mentre la perdita sale.
  const diverso =
    !prima ||
    Math.abs(prima.kbit - kbit) > 100 ||
    prima.ponte !== ponte ||
    prima.limite !== limite ||
    Math.abs(prima.rttMs - rttMs) > 40 ||
    Math.abs(prima.persiSu - persiSu) > 0.005 ||
    Math.abs(prima.persiGiu - persiGiu) > 0.005;
  if (diverso) set({ linea: { kbit, ponte, limite, rttMs, persiSu, persiGiu } });
  try {
    tuneVideoSenders();
  } catch {
    /* */
  }
}

async function sampleUsage() {
  const u = usage;
  if (!u) return;
  // getStats() viene invocata SUBITO su tutti i peer (prima di qualsiasi await):
  // così l'ultimo campionamento a fine chiamata parte prima della chiusura.
  const jobs: { pid: string; req: Promise<RTCStatsReport> }[] = [];
  for (const [pid, pc] of peers) {
    try {
      jobs.push({ pid, req: pc.getStats() });
    } catch {
      /* peer già chiuso */
    }
  }
  for (const { pid, req } of jobs) {
    let sent = 0,
      recv = 0;
    try {
      const stats = await req;
      let pairSent = 0,
        pairRecv = 0,
        rtpSent = 0,
        rtpRecv = 0;
      stats.forEach((r: any) => {
        if (r.type === "candidate-pair" && (r.nominated || r.state === "succeeded")) {
          pairSent += Number(r.bytesSent) || 0;
          pairRecv += Number(r.bytesReceived) || 0;
          const disp = Number(r.availableOutgoingBitrate) || 0;
          if (disp > 0) bandaSu.set(pid, disp);
        } else if (r.type === "outbound-rtp" && !r.isRemote) {
          rtpSent += Number(r.bytesSent) || 0;
          // ── SONDA FLUIDITÀ (nessuna getStats aggiuntiva: stesso report) ──
          //  `qualityLimitationReason` dice CHI sta limitando il video:
          //   · "cpu"       → il computer del presentatore non ce la fa;
          //   · "bandwidth" → la rete;
          //   · "none"      → l'encoder è libero (scatti altrove: rendering/decoder).
          //  Senza questo dato ogni intervento sulla fluidità è a tentoni.
          if (r.kind === "video") {
            const why = String(r.qualityLimitationReason || "none");
            console.log(
              `[CAM] uscita → ${pid}: ${Math.round(Number(r.framesPerSecond) || 0)}fps ${r.frameWidth || "?"}×${r.frameHeight || "?"} limite=${why} codificati=${Number(r.framesEncoded) || 0} keyframe=${Number(r.keyFramesEncoded) || 0} richiesteRinvio=${Number(r.nackCount) || 0}`,
            );
            cpuLimited = why === "cpu" ? cpuLimited + 1 : 0;
          }
        } else if (r.type === "inbound-rtp" && !r.isRemote) {
          rtpRecv += Number(r.bytesReceived) || 0;
          if (r.kind === "video") {
            // `congelamenti` che avanza durante l'evento = il decoder è fermo in
            // attesa di un fotogramma chiave (problema di rete/keyframe);
            // se invece è tutto fermo qui ma l'uscita è regolare, è trasporto.
            console.log(
              `[CAM] entrata ← ${pid}: ${Math.round(Number(r.framesPerSecond) || 0)}fps ${r.frameWidth || "?"}×${r.frameHeight || "?"} persi=${Number(r.framesDropped) || 0} congelamenti=${Number(r.freezeCount) || 0} (${Math.round((Number(r.totalFreezesDuration) || 0) * 10) / 10}s) decodificati=${Number(r.framesDecoded) || 0} richiesteKeyframe=${Number(r.pliCount) || 0}`,
            );
          }
        }
      });
      // preferisco il candidate-pair (include overhead reale); fallback su RTP
      sent = pairSent || rtpSent;
      recv = pairRecv || rtpRecv;
    } catch {
      continue;
    }
    const prev = u.last.get(pid) || { sent: 0, recv: 0 };
    u.sent += sent >= prev.sent ? sent - prev.sent : sent; // reset contatore → riparto
    u.recv += recv >= prev.recv ? recv - prev.recv : recv;
    u.last.set(pid, { sent, recv });
  }
  const g = S.roster.filter((r) => r.role === "viewer").length;
  if (g > u.maxGuests) u.maxGuests = g;

  // ── LA VOCE ARRIVA DAVVERO? ───────────────────────────────────────────────
  //  Controllo esplicito: ogni connessione deve avere una traccia audio VIVA in
  //  uscita. Se manca o è finita, la si riaggancia da quella locale. Senza questo
  //  la voce poteva sparire in silenzio, senza alcun errore da nessuna parte.
  const mine = localStream?.getAudioTracks().find((t) => t.readyState === "live") || null;
  //  ⚠️ …ma MAI contro la volontà di chi ha appena premuto "muto": questo
  //   controllo riaggancia la traccia locale alle connessioni, e durante il
  //   muto (che stacca il microfono una connessione alla volta) rimetteva in
  //   onda il microfono appena staccato. Vedi `micVuole`.
  if (mine && S.micOn && !micMutoVoluto()) {
    for (const [pid, pc] of peers) {
      const snd = pc.getSenders().find((x) => x.track?.kind === "audio");
      if (!snd) continue; // gestito da attachLocalMediaToPeers
      if (!snd.track || snd.track.readyState !== "live" || snd.track !== mine) {
        console.warn("[MIC] traccia audio in uscita non allineata su", pid, "→ riaggancio");
        try {
          await snd.replaceTrack(mine);
        } catch {
          /* */
        }
      }
    }
  }

  // ── VALVOLA DI SFOGO CPU ───────────────────────────────────────────────────
  //  "maintain-framerate" dice all'encoder di sacrificare la RISOLUZIONE per
  //  tenere i fotogrammi, ma se la CPU è satura l'encoder non riesce comunque a
  //  scendere abbastanza in fretta e l'ospite vede gli scatti. Se l'encoder si
  //  dichiara limitato dalla CPU per due campionamenti di fila, riduciamo noi la
  //  risoluzione inviata (1.5×): la fluidità è sempre più importante della
  //  definizione in una consulenza. Appena la CPU respira si torna a piena
  //  risoluzione. Se il limite NON è "cpu" qui non cambia nulla.
  // ── VALVOLA CPU RIMOSSA ───────────────────────────────────────────────────
  //  Riduceva la risoluzione inviata quando l'encoder si dichiarava limitato
  //  dalla CPU, ma poteva restare incastrata in quello stato: bastava che un
  //  campionamento non riportasse il video in uscita perché non tornasse mai a
  //  piena risoluzione. Effetto: immagine perennemente più povera.
  //  L'encoder ha già "maintain-framerate": sa gestire da solo il degrado, e in
  //  modo reversibile. Qui resta solo la MISURA, che dice se il limite è la CPU
  //  o la rete: è quella l'informazione che serve.
  void cpuLimited;

  //  ⚠️ Rimisurata la linea, si rimettono i tetti: è qui che il numero appena
  //   raccolto diventa un video che non si impunta. Vedi tuneVideoSenders.
  try {
    tuneVideoSenders();
  } catch {
    /* */
  }
}

async function saveUsage(final = false) {
  const u = usage;
  if (!u) return;
  if (!final && u.sent + u.recv <= 0) return; // niente da salvare ancora
  const p = readStoredPresenter();
  try {
    await fetch("/api/presenter/usage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: u.id,
        presenterId: p?.id ?? "",
        presenterName: S.presenterName || p?.name || "",
        date: new Date(u.startedAt).toISOString(),
        sessionCode: readLiveId() || "",
        bytesSent: Math.round(u.sent),
        bytesReceived: Math.round(u.recv),
        durationSec: Math.round((Date.now() - u.startedAt) / 1000),
        guests: u.maxGuests,
      }),
    });
    try {
      window.dispatchEvent(new Event("hg-usage-updated"));
    } catch {
      /* */
    }
  } catch {
    /* offline: riproverò al prossimo giro */
  }
}

function startUsageTracking() {
  if (usage) return;
  usage = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    startedAt: Date.now(),
    sent: 0,
    recv: 0,
    last: new Map(),
    maxGuests: 0,
  };
  usageTimer = setInterval(() => {
    void sampleUsage();
  }, 10000);
  usageSaveTimer = setInterval(() => {
    void saveUsage();
  }, 60000);
  //  La linea si rimisura quattro volte più spesso del conteggio: è il tempo
  //  che passa fra "la banda è crollata" e "il video smette di impuntarsi".
  bandaTimer = setInterval(() => {
    void sondaBanda();
  }, 2500);
}
function stopUsageTracking() {
  if (usageTimer) {
    clearInterval(usageTimer);
    usageTimer = null;
  }
  if (usageSaveTimer) {
    clearInterval(usageSaveTimer);
    usageSaveTimer = null;
  }
  if (bandaTimer) {
    clearInterval(bandaTimer);
    bandaTimer = null;
  }
  tettoPrec.clear();
  meshDetto = 0;
  if (!usage) return;
  // stacco subito la sessione corrente (una nuova chiamata può ripartire da zero)
  void (async () => {
    await sampleUsage();
    await saveUsage(true);
  })().finally(() => {
    usage = null;
  });
}

// ── registrazione (webm) — registra la VISTA DEL CLIENTE ───────────────────
//  Il presentatore condivide lo schermo/tab che mostra la presentazione (ciò
//  che vede il cliente), poi mixiamo: audio del display + mic locale + audio
//  di TUTTI i partecipanti remoti (voce dei presenti). Video = display track.
let recDisplay: MediaStream | null = null;
/*  ── ⚠️ IL CONTESTO AUDIO DELLA REGISTRAZIONE NON È SUO ────────────────────
    Era un `new AudioContext()` fatto qui a ogni avvio, e nasceva SOSPESO ogni
    volta che la registrazione partiva da sola (all'ingresso di un ospite: non
    c'è nessun gesto della persona in quell'istante). Un contesto sospeso non
    produce campioni, la traccia audio nel miscuglio resta viva e immobile, e
    il registratore aspetta quell'audio senza consegnare nemmeno il video: 0
    byte. È la causa — misurata — della terza segnalazione «continua a non
    registrare» (0 byte contro 117.019, vedi shop/registrazione).
    Adesso si usa il contesto CONDIVISO dell'applicazione, che vive per tutta
    la sessione e che un tocco qualsiasi risveglia (`svegliaAlPrimoGesto`).
    ⚠️ QUINDI NON SI CHIUDE A FINE REGISTRAZIONE: chiuderlo spegnerebbe anche i
     suoni dell'interfaccia e il rilevatore di voce, per sempre. Si staccano
     solo i nodi che ha aggiunto la registrazione (`sganciaAudioRegistrazione`).
     Il contesto si chiude solo se è stato questo file a crearlo di riserva. */
let recCtx: AudioContext | null = null;
let recCtxMio = false;
let recNodi: AudioNode[] = [];
let recSorgenti: { stop: () => void }[] = [];
/** Stacca dal contesto i nodi di questa registrazione (e chiude il contesto
 *  solo se era di riserva, creato qui). Va chiamata su OGNI uscita. */
/*  ── IL BANCO DI MISSAGGIO RESTA APERTO FINCHÉ SI REGISTRA ────────────────
    Segnalazione del committente: «registra le consulenze ma non l'audio degli
    ospiti». Il miscuglio si componeva una volta sola, all'avvio — e la
    registrazione parte DA SOLA quando l'ospite entra, cioè qualche secondo
    PRIMA che la sua voce arrivi (la connessione fra i due dispositivi deve
    finire di negoziare). Risultato: per tutta la consulenza si registrava il
    solo consulente.
    Adesso il banco resta aperto: ogni voce che compare — l'ospite che si
    collega, il microfono acceso a metà strada, il secondo ospite — ci si
    attacca mentre la registrazione va avanti. La regola di quali attaccare
    sta in shop/registrazione (`vociDaCollegare`). */
let recBanco: {
  ctx: AudioContext;
  dest: MediaStreamAudioDestinationNode;
  tracce: Set<string>;
} | null = null;
/** Un controllo ogni tanto: è la rete che prende le voci arrivate per strade
 *  che non passano da `ontrack` (lo scambio di traccia del microfono, una
 *  connessione rifatta). */
let recRicucitura: number | null = null;

/** Attacca al registratore le voci di questo flusso che non ci sono già.
 *  Torna quante ne ha attaccate. Si può chiamare sempre: se non si sta
 *  registrando non fa niente. */
export function collegaVoceAlRegistratore(s: MediaStream | null | undefined, chi = ""): number {
  const banco = recBanco;
  if (!banco || !s) return 0;
  let quante = 0;
  for (const t of vociDaCollegare(s.getAudioTracks(), banco.tracce)) {
    const a = t as unknown as MediaStreamTrack;
    try {
      const src = banco.ctx.createMediaStreamSource(new MediaStream([a]));
      const g = banco.ctx.createGain();
      g.gain.value = 1;
      src.connect(g);
      g.connect(banco.dest);
      recNodi.push(src, g);
      banco.tracce.add(a.id);
      //  Se quella traccia finisce la si dimentica: così il microfono spento e
      //  riacceso — che è una traccia NUOVA — rientra nella registrazione.
      try {
        a.addEventListener("ended", () => banco.tracce.delete(a.id));
      } catch {
        /* */
      }
      quante += 1;
    } catch {
      /* una voce che non si attacca non ferma le altre */
    }
  }
  if (quante)
    annota(`voce in registrazione${chi ? ` · ${chi}` : ""} · sorgenti ora ${banco.tracce.size}`);
  return quante;
}

/** Tutte le voci che ci sono adesso: la mia e quella di ognuno. */
function ricuciVociDelRegistratore() {
  if (!recBanco) return;
  collegaVoceAlRegistratore(localStream, "io");
  remoteStreams.forEach((s, pid) => collegaVoceAlRegistratore(s, pid));
}

function sganciaAudioRegistrazione() {
  recBanco = null;
  if (recRicucitura != null) {
    clearInterval(recRicucitura);
    recRicucitura = null;
  }
  recSorgenti.forEach((s) => {
    try {
      s.stop();
    } catch {
      /* */
    }
  });
  recSorgenti = [];
  recNodi.forEach((nodo) => {
    try {
      nodo.disconnect();
    } catch {
      /* */
    }
  });
  recNodi = [];
  const c = recCtx;
  recCtx = null;
  if (c && recCtxMio)
    void c.close().catch(() => {
      /* */
    });
  recCtxMio = false;
}
/** ⚠️ `resume()` PUÒ NON RISOLVERSI MAI su una pagina mai toccata: si aspetta
 *  al massimo un attimo e poi si GUARDA lo stato, che è l'unica cosa che conta
 *  (vedi `audioRegistrabile` in shop/registrazione). */
async function contestoInFunzione(c: AudioContext, entro = 800): Promise<boolean> {
  if (audioRegistrabile(c.state as string)) return true;
  try {
    await Promise.race([c.resume(), new Promise((ok) => window.setTimeout(ok, entro))]);
  } catch {
    /* */
  }
  return audioRegistrabile(c.state as string);
}
// compositor canvas della registrazione (niente condivisione schermo)
let recCanvas: HTMLCanvasElement | null = null;
/*  ⚠️ QUI C'ERANO `recRaf` e `recBattito`, le due maniglie del disegno. Erano
    anche il modo in cui il guasto si nascondeva: la maniglia era UNA e le
    catene di disegno diventavano centinaia, quindi fermando la registrazione
    se ne fermava una sola e le altre continuavano a disegnare per tutto il
    tempo che la scheda restava aperta. Adesso le maniglie le tiene il motore
    (shop/tela-registrazione), che ne ammette una sola per costruzione. */
/** Il flusso della tela, per poter CHIEDERE un fotogramma a ogni disegno. */
let recFlusso: MediaStream | null = null;
let recVideos: Map<string, HTMLVideoElement> | null = null;
// sceglie un mimeType REALMENTE supportato dal browser (Safari non supporta video/webm →
// il costruttore lanciava e la registrazione non partiva mai: bug reale item F).
function pickRecMime(): string {
  /*  ── ⚠️ SI REGISTRA IN UN FORMATO CHE SI POSSA ANCHE GUARDARE ─────────
      Segnalazione del committente: «registra 2 secondi e poi si blocca».
      Il file c'era ed era intero — il diario lo dice: «fine · 100s · pezzi 98
      · 25116 KB» — ma era `video/webm;codecs=vp9`, e Safari il WebM non lo
      sa leggere: parte il primo pezzo, poi l'immagine si ferma. Registrare in
      un formato che chi registra non può riaprire è come non registrare.
      Perciò prima l'MP4 con H.264, che si apre dappertutto — Safari,
      QuickTime, Chrome, il lettore del gestionale, il telefono di un cliente.
      Il WebM resta come ripiego per i browser che l'MP4 non lo sanno ancora
      SCRIVERE (Chrome lo scrive dalla 126, Safari da anni). */
  const cand = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=h264,opus",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported) {
    for (const m of cand) {
      if (MediaRecorder.isTypeSupported(m)) return m;
    }
  }
  return "";
}
let recStartedAt = 0;

// ── ARCHIVIAZIONE DELLA REGISTRAZIONE ──────────────────────────────────────
//  La catena ha tre anelli e ognuno può rompersi da solo:
//    1. permesso di scrittura a termine   → /api/presenter/upload-url
//    2. file dal browser DIRITTO all'archivio (mai dal Worker)
//    3. scheda nell'elenco del CRM        → /api/presenter/recordings
//  Il guasto peggiore era il terzo: il video finiva davvero nella Storage ma la
//  scheda non veniva creata, quindi in "Registrazioni" non compariva NULLA e
//  nessuno diceva perché. Adesso ogni anello riferisce il proprio motivo, e chi
//  si ferma può essere ripreso da dove si è fermato — senza rifare la consulenza.

/** Esito di un anello: l'indirizzo ottenuto, oppure il MOTIVO vero del rifiuto.
 *  Prima si tornava `null` e il motivo moriva nella console del browser: il
 *  consulente leggeva "errore" e il file finiva nei Download senza spiegazioni. */
interface Esito {
  url?: string;
  motivo?: string;
}

/** Oltre questa taglia il passaggio dal Worker è inutile: riceve il file INTERO
 *  in memoria e muore a metà. Un'ora di consulenza sta molto sopra. */
const SOGLIA_WORKER = 8 * 1024 * 1024;

/** Il motivo leggibile di una risposta andata male, qualunque forma abbia il
 *  corpo: il server può rispondere `reason`, `error`, oppure niente del tutto. */
function motivoRisposta(stato: number, corpo: unknown): string {
  //  Il corpo arriva dalla rete: non do per scontato che sia un oggetto.
  const o = (corpo && typeof corpo === "object" ? corpo : {}) as Record<string, unknown>;
  const detto =
    typeof o.reason === "string" ? o.reason : typeof o.error === "string" ? o.error : "";
  if (stato === 401)
    return "sessione del presentatore assente o scaduta: riapri il tuo link (o rientra col PIN dal cancello) e riprova";
  if (stato === 413) return detto || "file troppo grande per l'archivio";
  return detto || (stato ? `il server ha risposto ${stato}` : "nessuna risposta dal server");
}

/** Ultima spiaggia: se l'archivio non è raggiungibile, la registrazione non si
 *  perde — la si scarica sul computer del consulente, che decide dopo. */
function salvaInLocale(blob: Blob, filename: string) {
  try {
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 30000);
  } catch {
    /* */
  }
}

/** ANELLO 1+2 — permesso a termine e file DIRITTO alla Storage.
 *  Il file NON passa dal nostro server: una consulenza di mezz'ora pesa decine —
 *  a volte centinaia — di megabyte, e il Worker li riceveva tutti in memoria
 *  superando il proprio limite. Questa è la strada vera, non un ripiego. */
/** ── ⚠️ UNA LINEA LENTA NON È UN ERRORE: È UNA LINEA LENTA ────────────────
 *  Osservato dal vivo: 10 MB di registrazione, connessione a 0,15 Mbit, e la
 *  richiesta muore a metà con «Failed to fetch» — che al consulente non dice
 *  niente e sembra un guasto del programma. Un tentativo solo, su una rete
 *  così, è una scommessa persa in partenza.
 *  Si riprova tre volte, aspettando un po' di più ogni volta, e ogni volta con
 *  un permesso NUOVO: quello di prima può aver lasciato un file a metà, e
 *  riusarlo darebbe «esiste già» al posto del motivo vero.
 */
const TENTATIVI = 3;
const respiro = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function caricaDiretto(blob: Blob, filename: string): Promise<Esito> {
  let ultimo: Esito = { motivo: "caricamento non tentato" };
  for (let i = 0; i < TENTATIVI; i += 1) {
    if (i) await respiro(1500 * i);
    ultimo = await unTentativoDiretto(blob, filename);
    if (ultimo.url) return ultimo;
    //  ⚠️ Si insiste SOLO sui guasti di rete: se l'archivio ha detto di no —
    //   file troppo grande, permesso negato — riprovare è tempo buttato e
    //   nasconde il motivo vero dietro tre attese.
    if (!/interrotto|Failed to fetch|network|connessione/i.test(ultimo.motivo || "")) return ultimo;
    console.warn(`[REC] tentativo ${i + 1} di ${TENTATIVI} non riuscito:`, ultimo.motivo);
  }
  const mbFile = Math.max(1, Math.round(blob.size / (1024 * 1024)));
  //  ⚠️ Il motivo dice la SUA causa e non solo il sintomo: chi legge deve
  //   capire che il programma ha fatto il suo, e che il file è al sicuro.
  return {
    motivo:
      `la connessione non ha retto il caricamento (${mbFile} MB, ${TENTATIVI} tentativi):` +
      " prova di nuovo da una rete più stabile — il video non è perduto",
  };
}

async function unTentativoDiretto(blob: Blob, filename: string): Promise<Esito> {
  let stato = 0;
  try {
    const r = await fetch("/api/presenter/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      //  La sessione vive in un cookie HttpOnly: same-origin lo manda già, ma
      //  scritto qui nessuno lo toglie per sbaglio il giorno che tocca il file.
      credentials: "same-origin",
      // la taglia serve al server per dire SUBITO se supera il limite dell'archivio
      body: JSON.stringify({ filename, size: blob.size }),
    });
    stato = r.status;
    const p = (await r.json().catch(() => null)) as {
      ok?: boolean;
      bucket?: string;
      path?: string;
      token?: string;
      url?: string;
    } | null;
    if (!r.ok || !p?.ok || !p.token || !p.path) return { motivo: motivoRisposta(stato, p) };

    const { error } = await supabase.storage
      .from(p.bucket || "presenter-videos")
      .uploadToSignedUrl(p.path, p.token, blob, { contentType: blob.type || "video/webm" });
    if (error) return { motivo: `archivio: ${error.message}` };
    if (!p.url) return { motivo: "l'archivio non ha restituito l'indirizzo del file" };
    return { url: String(p.url) };
  } catch (e) {
    return { motivo: `caricamento interrotto: ${(e as Error)?.message || "connessione persa"}` };
  }
}

/** Rete di sicurezza per i file PICCOLI: passa dal Worker. Sopra la soglia non
 *  viene nemmeno tentata, perché lì fallisce sempre e nasconde il motivo vero. */
async function caricaDalServer(blob: Blob, filename: string): Promise<Esito> {
  try {
    const fd = new FormData();
    fd.append("file", new File([blob], filename, { type: blob.type || "video/webm" }));
    const r = await fetch("/api/presenter/upload", {
      method: "POST",
      credentials: "same-origin",
      body: fd,
    });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; url?: string } | null;
    if (!r.ok || !j?.ok || !j.url) return { motivo: motivoRisposta(r.status, j) };
    return { url: String(j.url) };
  } catch (e) {
    return {
      motivo: `caricamento dal server interrotto: ${(e as Error)?.message || "connessione persa"}`,
    };
  }
}

/** ANELLO 3 — la scheda nell'elenco. Senza questa il video esiste nella Storage
 *  ma in "Registrazioni" non compare: è esattamente il caso che sembrava un
 *  caricamento fallito e non lo era. */
/** ── CHI SI AVEVA DAVANTI ──────────────────────────────────────────────────
 *  Il cliente della consulenza in corso, scritto dal CRM nel momento in cui la
 *  stanza è stata aperta (`hg_lead_corrente`, vedi crm/MeetGiornalieri).
 *  ⚠️ È QUESTO IL FILO CHE MANCAVA. La registrazione veniva legata SOLO al
 *   numero dell'ultimo preventivo creato in questo browser: in una consulenza
 *   senza preventivo — che sono tante — non restava nessun legame, e dal CRM
 *   quel video non lo raggiungeva più nessuno (vedi crm/registrazioni-del-lead). */
function clienteDellaConsulenza(): { id: string; nome: string } {
  if (typeof window === "undefined") return { id: "", nome: "" };
  try {
    const g = JSON.parse(localStorage.getItem("hg_lead_corrente") || "null") as {
      id?: string;
      nome?: string;
      cognome?: string;
    } | null;
    if (!g?.id) return { id: "", nome: "" };
    return { id: String(g.id), nome: [g.nome, g.cognome].filter(Boolean).join(" ").trim() };
  } catch {
    return { id: "", nome: "" };
  }
}

async function registraInArchivio(url: string, duration: number): Promise<Esito> {
  try {
    const p = readStoredPresenter();
    //  L'elenco dei presenti arriva dagli altri dispositivi: se per qualsiasi
    //  motivo non è un elenco, il nome dell'ospite si può perdere — la scheda no.
    const presenti = Array.isArray(S.roster) ? S.roster : [];
    const cliente = clienteDellaConsulenza();
    //  ⚠️ Il nome del CRM vale più di quello scritto dall'ospite: in consulenza
    //   il cliente digita quello che gli pare («Gg», il nome del figlio), e
    //   nell'elenco delle registrazioni ci si deve ritrovare fra un mese.
    const guest =
      cliente.nome || presenti.find((r) => r?.role === "viewer")?.name || S.guestName || "";
    const r = await fetch("/api/presenter/recordings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        presenterId: p?.id ?? "",
        presenterName: S.presenterName || p?.name || "",
        url,
        date: new Date().toISOString(),
        duration,
        guestName: guest,
        // il preventivo aperto in questa consulenza: lega il video al LEAD
        quoteRef: getQuoteRef(),
        //  …e il cliente stesso, che c'è anche quando il preventivo non si fa.
        leadId: cliente.id,
      }),
    });
    const j = (await r.json().catch(() => null)) as { ok?: boolean } | null;
    if (!r.ok || !j?.ok) return { motivo: motivoRisposta(r.status, j) };
    return { url };
  } catch (e) {
    return { motivo: `scheda non salvata: ${(e as Error)?.message || "connessione persa"}` };
  }
}

/** Una registrazione che non è (ancora) arrivata in archivio.
 *  `url` valorizzato = il file è già nella Storage e manca solo la scheda:
 *  riprovare NON ricarica i megabyte, rifà solo l'ultimo passo. */
interface RegInSospeso {
  blob: Blob | null;
  filename: string;
  duration: number;
  url: string;
  scaricata: boolean;
}
let regInSospeso: RegInSospeso | null = null;

/** Chiude la catena partendo da dove si era fermata. "" = archiviata. */
async function archivia(p: RegInSospeso): Promise<string> {
  if (!p.url) {
    if (!p.blob) return "il file della registrazione non è più in memoria";
    const diretto = await caricaDiretto(p.blob, p.filename);
    const motivoDiretto = diretto.motivo || "caricamento non riuscito";
    if (diretto.url) p.url = diretto.url;
    else if (p.blob.size > SOGLIA_WORKER) return motivoDiretto;
    else {
      const viaServer = await caricaDalServer(p.blob, p.filename);
      if (!viaServer.url)
        return `${motivoDiretto} (anche dal server: ${viaServer.motivo || "rifiutato"})`;
      p.url = viaServer.url;
    }
  }
  const scheda = await registraInArchivio(p.url, p.duration);
  return scheda.url ? "" : scheda.motivo || "scheda non salvata";
}

/** Riprova l'archiviazione della registrazione rimasta in sospeso.
 *  "" = riuscita. Esportata perché il pulsante dell'avviso la richiama, e
 *  perché è la risposta alla domanda "devo rifare la consulenza?": no. */
export async function riprovaArchiviazione(): Promise<string> {
  const p = regInSospeso;
  if (!p) return "";
  const motivo = await archivia(p);
  if (!motivo) {
    regInSospeso = null;
    archiviata(p.url);
  }
  return motivo;
}
/** C'è una registrazione non ancora archiviata? (usata dall'avviso di uscita) */
export function haRegistrazioneInSospeso(): boolean {
  return !!regInSospeso;
}

function archiviata(url: string) {
  console.log("[REC] registrazione archiviata", url);
  // l'archivio (Impostazioni → Registrazioni) si aggiorna da solo
  try {
    window.dispatchEvent(new Event("hg-recordings-updated"));
  } catch {
    /* */
  }
}

async function uploadRecording(
  blob: Blob,
  filename: string,
  duration: number,
  vuota: { titolo: string; motivo: string } = {
    titolo: "Registrazione vuota",
    motivo: "il registratore non ha prodotto alcun dato: non c'è file da archiviare.",
  },
) {
  //  Un blob vuoto vuol dire che il registratore non ha prodotto nulla:
  //  archiviarlo creerebbe una scheda che apre un video rotto.
  //  ⚠️ E si dice QUALE delle tre cose è successa — non c'era niente da
  //   registrare, è durata un istante, o il registratore si è fermato per
  //   conto suo: sono rimedi diversi (vedi shop/registrazione).
  if (!blob || !blob.size) {
    console.warn("[REC] file vuoto:", vuota.titolo, "·", vuota.motivo);
    avvisoRegistrazione({ ...vuota, tono: "ambra" });
    return;
  }
  console.log("[REC] carico in archivio", filename, Math.round(blob.size / 1024) + "KB");
  const p: RegInSospeso = { blob, filename, duration, url: "", scaricata: false };
  const motivo = await archivia(p);
  if (!motivo) {
    archiviata(p.url);
    return;
  }

  //  ── IL RIPIEGO NON È MAI SILENZIOSO ──────────────────────────────────────
  //  Se il file non è nemmeno salito, lo mettiamo nei Download: una consulenza
  //  non si perde MAI. Se invece è già nella Storage (manca solo la scheda) NON
  //  si scarica niente: il video è al sicuro, riprovare costa una richiesta.
  regInSospeso = p;
  if (!p.url) {
    salvaInLocale(blob, filename);
    p.scaricata = true;
  }
  console.warn("[REC] archiviazione non riuscita:", motivo);
  avvisoRegistrazione({
    titolo: p.url ? "Video caricato, ma non è nell'elenco" : "Registrazione non archiviata",
    motivo,
    dettaglio: p.scaricata
      ? `Una copia è già nei tuoi Download: ${filename}. Riprova qui sotto: se va a buon fine finisce in archivio e la copia locale puoi cancellarla.`
      : "Il video è già nell'archivio: manca solo la scheda che lo mostra in Registrazioni. Riprova qui sotto — non devi rifare la consulenza.",
    tono: "ambra",
    riprova: true,
  });
}

// ── L'AVVISO ──────────────────────────────────────────────────────────────
//  Costruito in DOM e non in React: nasce quando la consulenza si sta già
//  chiudendo, cioè quando l'albero della chiamata può essere smontato da un
//  momento all'altro. Un avviso che sparisce insieme alla schermata non avvisa
//  nessuno, e una registrazione finita nei Download e mai risalita è lavoro perso.
let avvisoEl: HTMLDivElement | null = null;

function avvisoRegistrazione(o: {
  titolo: string;
  motivo: string;
  dettaglio?: string;
  tono: "ambra" | "emerald";
  riprova?: boolean;
}): HTMLDivElement | null {
  if (typeof document === "undefined") return null;
  try {
    avvisoEl?.remove();
    const bordo =
      o.tono === "emerald"
        ? "border-emerald-400/40 bg-[#04140d]/95"
        : "border-amber-400/40 bg-[#1a1406]/95";
    const el = document.createElement("div");
    avvisoEl = el;
    el.className = `fixed bottom-4 left-1/2 z-[140] w-[min(94vw,460px)] -translate-x-1/2 rounded-xl border ${bordo} p-3 text-white shadow-2xl backdrop-blur print:hidden`;

    const titolo = document.createElement("div");
    titolo.className = `text-[13px] font-semibold ${o.tono === "emerald" ? "text-emerald-300" : "text-amber-300"}`;
    titolo.textContent = o.titolo;

    //  IL MOTIVO VERO, quello del server: è l'unica cosa che permette di capire
    //  se serve rifare il PIN, alzare un limite o solo riprovare fra un minuto.
    const motivo = document.createElement("div");
    motivo.className = "mt-1 text-[12px] leading-snug text-white/80";
    motivo.textContent = o.motivo;

    el.append(titolo, motivo);

    if (o.dettaglio) {
      const d = document.createElement("div");
      d.className = "mt-1 text-[11px] leading-snug text-white/50";
      d.textContent = o.dettaglio;
      el.append(d);
    }

    const barra = document.createElement("div");
    barra.className = "mt-2.5 flex items-center gap-2";

    if (o.riprova) {
      const btn = document.createElement("button");
      btn.className =
        "flex-1 rounded-lg bg-amber-500/90 py-2 text-[12px] font-semibold text-[#1a1406] hover:brightness-110 disabled:opacity-60";
      btn.textContent = "Riprova a salvare in archivio";
      btn.onclick = async () => {
        btn.disabled = true;
        btn.textContent = "Sto riprovando…";
        const err = await riprovaArchiviazione();
        if (!err) {
          //  Conferma verde e poi via da sola: il consulente deve VEDERE che è
          //  finita bene, non restare col dubbio davanti a un avviso muto.
          const ok = avvisoRegistrazione({
            titolo: "Registrazione archiviata",
            motivo:
              "La trovi in Impostazioni → Registrazioni, legata al LEAD di questa consulenza.",
            tono: "emerald",
          });
          setTimeout(() => {
            if (ok && avvisoEl === ok) {
              ok.remove();
              avvisoEl = null;
            }
          }, 8000);
          return;
        }
        motivo.textContent = err;
        btn.disabled = false;
        btn.textContent = "Riprova a salvare in archivio";
      };
      barra.append(btn);

      // il salvataggio locale a richiesta: se non è ancora stato scaricato
      if (!regInSospeso?.scaricata && regInSospeso?.blob) {
        const dl = document.createElement("button");
        dl.className =
          "rounded-lg border border-white/20 px-3 py-2 text-[12px] font-medium text-white/80 hover:bg-white/10";
        dl.textContent = "Scarica";
        dl.onclick = () => {
          const p = regInSospeso;
          if (p?.blob) {
            salvaInLocale(p.blob, p.filename);
            p.scaricata = true;
          }
          dl.remove();
        };
        barra.append(dl);
      }
    }

    const chiudi = document.createElement("button");
    chiudi.className =
      "rounded-lg px-2 py-2 text-[12px] text-white/45 hover:bg-white/10 hover:text-white";
    chiudi.textContent = "Chiudi";
    chiudi.onclick = () => {
      el.remove();
      if (avvisoEl === el) avvisoEl = null;
    };
    barra.append(chiudi);

    el.append(barra);
    document.body.append(el);
    return el;
  } catch {
    /* l'avviso non deve mai diventare esso stesso il guasto */
  }
  return null;
}

//  Chiudere la scheda con una registrazione ancora in sospeso è il modo più
//  facile di perdere il lavoro di un'ora: il browser chiede conferma.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", (e) => {
    if (!regInSospeso) return;
    e.preventDefault();
    e.returnValue = "";
  });
}

/** Compositor locale della registrazione: disegna le tile dei partecipanti su un
 *  canvas offscreen (niente getDisplayMedia → nessun popup di condivisione schermo,
 *  la registrazione parte con UN click). */
let motoreTela: MotoreDiDisegno | null = null;

function startRecCompositor(): MediaStream {
  const canvas = document.createElement("canvas");
  canvas.width = 1280;
  canvas.height = 720;
  const ctx2d = canvas.getContext("2d")!;
  recCanvas = canvas;

  const videos = new Map<string, HTMLVideoElement>();
  const attach = (key: string, stream: MediaStream) => {
    let v = videos.get(key);
    if (v && v.srcObject === stream) return v;
    v = document.createElement("video");
    v.muted = true;
    v.autoplay = true;
    (v as any).playsInline = true;
    v.srcObject = stream;
    v.play().catch(() => {});
    videos.set(key, v);
    return v;
  };
  const drawCover = (v: HTMLVideoElement, x: number, y: number, w: number, h: number) => {
    const vw = v.videoWidth,
      vh = v.videoHeight;
    ctx2d.fillStyle = "#0a1428";
    ctx2d.fillRect(x, y, w, h);
    if (!vw || !vh) return;
    const s = Math.max(w / vw, h / vh);
    const dw = vw * s,
      dh = vh * s;
    ctx2d.save();
    ctx2d.beginPath();
    ctx2d.rect(x, y, w, h);
    ctx2d.clip();
    ctx2d.drawImage(v, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx2d.restore();
  };
  /*  ── ⚠️ LA TELA DEVE CONTINUARE A PRODURRE FOTOGRAMMI ANCHE DI NASCOSTO ──
      Segnalazione del committente: «continua a non registrare», dopo che il
      primo rimedio (il filo di silenzio) aveva sbloccato il caso misurato qui.
      La seconda cosa che può fermare tutto è questa: il disegno girava SOLO su
      `requestAnimationFrame`, che il browser SOSPENDE quando la scheda non è
      quella davanti — e il consulente passa al CRM, a WhatsApp, alla posta di
      continuo mentre la consulenza va avanti. Con la tela ferma, la cattura
      non produce fotogrammi; e un registratore che aspetta il video che gli è
      stato promesso non consegna niente (è la stessa trappola dell'audio).
      Adesso il disegno ha DUE motori: `requestAnimationFrame` quando la scheda
      è davanti (fluido) e un orologio ogni 250 ms che non si ferma mai — i
      timer continuano anche in secondo piano, rallentati, e un fotogramma al
      secondo è più che sufficiente per una consulenza registrata.
      ⚠️ E il fotogramma si CHIEDE, non si spera: `captureStream(0)` non cattura
       da sola, consegna solo quando si chiama `requestFrame()`. Così il flusso
       dipende dal nostro disegno e non da quanto il browser ha voglia di
       catturare una tela che non si vede. */
  /*  ⚠️ QUESTA FUNZIONE DISEGNA E BASTA. Prima accodava anche il fotogramma
      successivo, e siccome veniva chiamata ANCHE dall'orologio ogni 250 ms,
      ogni giro dell'orologio faceva nascere una catena nuova che si
      rialimentava da sola — quattro al secondo, per sempre, e la variabile
      ricordava solo l'ultima. Vedi il cartello in shop/tela-registrazione: è
      la causa del «Chrome dice non risponde». */
  const frame = () => {
    const tiles: HTMLVideoElement[] = [];
    if (localStream && localStream.getVideoTracks().length)
      tiles.push(attach("local", localStream));
    remoteStreams.forEach((s, pid) => {
      if (s.getVideoTracks().length) tiles.push(attach(pid, s));
    });
    ctx2d.fillStyle = "#050f24";
    ctx2d.fillRect(0, 0, canvas.width, canvas.height);
    if (!tiles.length) return;
    const cols = Math.ceil(Math.sqrt(tiles.length));
    const rows = Math.ceil(tiles.length / cols);
    const gap = 6;
    const tw = (canvas.width - gap * (cols + 1)) / cols;
    const th = (canvas.height - gap * (rows + 1)) / rows;
    tiles.forEach((v, k) => {
      const c = k % cols,
        r = Math.floor(k / cols);
      drawCover(v, gap + c * (tw + gap), gap + r * (th + gap), tw, th);
    });
  };
  const flusso = canvas.captureStream(0);
  recFlusso = flusso;
  const traccia = flusso.getVideoTracks()[0] as
    | (MediaStreamTrack & { requestFrame?: () => void })
    | undefined;
  //  Un fotogramma si consegna DOPO averlo disegnato: `captureStream(0)` non
  //  cattura da sola, consegna solo quando gliela si chiede.
  const consegna = () => {
    try {
      traccia?.requestFrame?.();
    } catch {
      /* */
    }
  };
  /*  ── UNA CATENA SOLA, E UN OROLOGIO CHE DISEGNA SENZA ACCODARE ──────────
      Le due sorgenti di disegno restano (il browser sospende
      `requestAnimationFrame` quando la scheda non è davanti, e la
      registrazione non deve fermarsi mentre il consulente passa al CRM), ma
      chi le mette in fila adesso è un pezzo solo, che si può provare senza
      aprire un browser. Vedi shop/tela-registrazione. */
  motoreTela?.ferma();
  motoreTela = avviaTela(
    () => {
      staFacendo("registrazione");
      frame();
      consegna();
      staFacendo("fermo");
    },
    {
      rAF: (cb) => requestAnimationFrame(cb),
      annullaRAF: (id) => cancelAnimationFrame(id),
      ogni: (cb, ms) => window.setInterval(cb, ms),
      fermaOgni: (id) => clearInterval(id),
    },
    250,
  );
  recVideos = videos;
  return flusso;
}
function stopRecCompositor() {
  motoreTela?.ferma();
  motoreTela = null;
  recFlusso = null;
  recVideos?.forEach((v) => {
    try {
      v.pause();
      v.srcObject = null;
    } catch {
      /* */
    }
  });
  recVideos = null;
  recCanvas = null;
}

/** ── QUELLO CHE IL CONSULENTE HA DAVANTI ───────────────────────────────────
 *  Chiede la condivisione dello schermo: è l'unico modo — imposto dai browser,
 *  non aggirabile — per registrare quello che il consulente MOSTRA e FA, e non
 *  soltanto le camere composte su una tela.
 *
 *  ⚠️ SI PREFERISCE LO SCHERMO INTERO, non più solo questa scheda. Richiesta
 *   del committente: «deve registrare tutta la schermata del presentatore,
 *   cosa mostra, cosa fa, se va su settings». Con la sola scheda, tutto ciò
 *   che sta fuori dal browser non entrava nel video. La scelta finale resta
 *   comunque sua, nella finestra del browser: qui si dice solo che cosa
 *   proporre per primo.
 *  ⚠️ `systemAudio: "include"` porta dentro anche l'audio di quello che mostra
 *   (un video, una clip): le voci arrivano comunque dal miscuglio. */
async function catturaSchermo(): Promise<MediaStream | null> {
  const gdm = (navigator.mediaDevices as any)?.getDisplayMedia;
  if (typeof gdm !== "function") return null;
  const call = (opts: any) =>
    (navigator.mediaDevices as any).getDisplayMedia(opts) as Promise<MediaStream>;
  try {
    return await call({
      video: { displaySurface: "monitor", frameRate: { ideal: 30 } },
      audio: true,
      selfBrowserSurface: "include",
      systemAudio: "include",
    });
  } catch (e: any) {
    if (e && (e.name === "NotAllowedError" || e.name === "AbortError")) return null; // l'utente ha annullato
    try {
      return await call({ video: true, audio: true });
    } catch {
      return null;
    } // opzioni non supportate
  }
}

// ── registrazione AUTOMATICA ───────────────────────────────────────────────
//  getDisplayMedia() esige un gesto utente: NON possiamo chiamarlo quando entra
//  l'ospite. Lo chiediamo quindi UNA volta al click su "Videochiamata"
//  (confirmStart) e teniamo lo stream in memoria SENZA registrare; la
//  registrazione parte da sola all'ingresso del primo ospite e si ferma alla
//  chiusura della chiamata.
let keptDisplay: MediaStream | null = null;
let autoRecStarted = false;

/*  ⚠️ «VIVA» VUOL DIRE CHE C'È ANCORA L'IMMAGINE. Guardava una traccia
    qualsiasi: interrotta la condivisione restava viva quella audio del
    sistema, la cattura risultava buona e si registrava un nero. La regola sta
    in shop/registrazione, con il perché per esteso. */
const displayAlive = (s: MediaStream | null) => catturaUsabile(s?.getTracks() ?? []);

/** Rilascia la cattura schermo tenuta da parte (senza toccare la registrazione in corso). */
function releaseKeptDisplay() {
  if (keptDisplay && keptDisplay !== recDisplay)
    keptDisplay.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* */
      }
    });
  keptDisplay = null;
  if (S.autoRecArmed) set({ autoRecArmed: false });
}

/** Chiede la cattura schermo DENTRO il gesto utente e la conserva per la
 *  registrazione automatica. Se l'utente annulla: nessun auto-rec, il tasto REC
 *  manuale continua a funzionare. */
export async function armAutoRecording(): Promise<boolean> {
  if (S.role !== "host") return false;
  if (typeof MediaRecorder === "undefined") return false;
  if (displayAlive(keptDisplay)) return true;
  autoRecStarted = false;
  const display = await catturaSchermo();
  if (!display) {
    set({ autoRecArmed: false });
    return false;
  }
  keptDisplay = display;
  display.getVideoTracks()[0]?.addEventListener("ended", () => {
    // "Interrompi condivisione": chiudo la registrazione e libero tutto
    fermaRegistratore();
    releaseKeptDisplay();
  });
  set({ autoRecArmed: true });
  return true;
}

/** Avvia la registrazione automatica all'ingresso del PRIMO ospite — SEMPRE e
 *  SENZA alcuna conferma del presentatore.
 *  · Se la cattura schermo è stata concessa all'avvio (armAutoRecording) si
 *    registra lo SCHERMO reale: massima fedeltà.
 *  · Altrimenti (picker annullato, non supportato, errore) si registra comunque
 *    usando il COMPOSITOR canvas interno (tile dei partecipanti) + audio di tutti:
 *    nessun popup, nessun click. Il presentatore può sempre premere REC per
 *    passare alla cattura schermo completa. */
function maybeAutoStartRecording() {
  if (S.role !== "host" || recorder || autoRecStarted) return;
  if (typeof MediaRecorder === "undefined") return;
  /*  ── ⚠️ NON SI REGISTRA UNA CHIAMATA CHE NON C'È ──────────────────────
      Chiudendo la consulenza si ferma il registratore e si rimette a zero il
      segno `autoRecStarted`. Ma gli ospiti restano nell'elenco ancora
      qualche secondo (i loro annunci arrivano dopo), e il loro «sono qui»
      faceva ripartire una registrazione a chiamata finita: una registrazione
      fantasma, e — finché i pezzi stavano in un secchio solo — anche il
      motivo per cui quella appena fermata si chiudeva VUOTA. */
  if (!S.active) return;
  if (!S.roster.some((r) => r.role === "viewer")) return;
  autoRecStarted = true;
  const display = displayAlive(keptDisplay) ? keptDisplay : null; // null → fallback camere
  /*  ⚠️ E SE SI RIPIEGA SULLE CAMERE, LO SI DICE. Una registrazione che
      contiene metà di quello che è successo non deve sembrare completa: il
      committente se n'è accorto riaprendo il file, cioè troppo tardi. */
  if (!display) {
    avvisoRegistrazione({
      titolo: "Sto registrando solo le camere",
      motivo:
        "la condivisione dello schermo non è stata concessa, quindi quello che mostri non entra nel video.",
      dettaglio:
        "Per registrare anche lo schermo: ferma e ripremi REC, e scegli lo schermo nella finestra del browser. La consulenza continua comunque.",
      tono: "ambra",
    });
  }
  void startRecordingWith(display, true);
}

/** Ferma la registrazione (se attiva) e rilascia la cattura schermo tenuta da parte. */
function stopAutoRecording() {
  fermaRegistratore();
  autoRecStarted = false;
  releaseKeptDisplay();
}

/** ── ⚠️ LA SESSIONE SI CONTROLLA PRIMA DI REGISTRARE, NON DOPO ────────────
 *  Segnalazione del committente: «quando stoppo la registrazione dice che non
 *  riesce a salvare».
 *  Il caricamento in archivio vuole la sessione da presentatore (il cookie del
 *  PIN). Finora la si scopriva assente SOLO alla fine: si registrava per
 *  quaranta minuti e poi, al momento di salvare, arrivava «sessione assente o
 *  scaduta». Il file non si perde — finisce nei Download e si può riprovare —
 *  ma è la notizia peggiore nel momento peggiore, e si dà quando non si può
 *  più fare niente.
 *  Adesso si chiede prima: se manca, lo si dice quando rientrare col PIN costa
 *  dieci secondi e non ci sono quaranta minuti in bilico.
 *  ⚠️ NON BLOCCA. Se la verifica non riesce per un problema di rete, si
 *   registra lo stesso: perdere una consulenza perché un controllo non ha
 *   risposto sarebbe peggio del guasto che sta prevenendo. */
async function sessioneProntaPerArchiviare(): Promise<boolean> {
  try {
    const r = await fetch("/api/presenter/upload-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      //  Taglia zero: si chiede solo «mi conosci?», non un permesso di
      //  caricamento — il server risponde sull'autenticazione prima di
      //  guardare qualunque limite.
      body: JSON.stringify({ filename: "controllo-sessione.webm", size: 0 }),
    });
    const p = (await r.json().catch(() => null)) as { error?: string } | null;
    return !(r.status === 401 || p?.error === "auth");
  } catch {
    return true; // rete incerta: non si ferma una consulenza per un dubbio
  }
}

/** ── LA SCATOLA NERA DEL REGISTRATORE ─────────────────────────────────────
 *  Il guasto succede in consulenza, sul computer del consulente, e di quel
 *  momento non resta niente: le righe di console se ne vanno con la scheda, e
 *  a chi ha un cliente davanti non si chiede di aprire gli strumenti da
 *  sviluppatore. Qui si lascia detto cosa è successo (vedi
 *  api.presenter.diario): conteggi e durate, mai contenuti.
 *  ⚠️ NON SI ASPETTA E NON SI DISTURBA: se il diario non si scrive, la
 *   consulenza va avanti come se niente fosse. */
function annota(testo: string) {
  try {
    console.log("[REC]", testo);
    void fetch("/api/presenter/diario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ voce: testo }),
    }).catch(() => {});
  } catch {
    /* mai in mezzo a una consulenza */
  }
}

/** ── IL DIARIO DELLA SFOCATURA ────────────────────────────────────────────
 *  Segnalazione del committente: «non funziona la sfocatura anche se la
 *  attivo» — pulsante acceso, immagine identica.
 *  ⚠️ NON SI INDOVINA DUE VOLTE. Con la registrazione la risposta è arrivata
 *   dal diario sul server («fine · 358s · 245010 KB»), non da un ragionamento:
 *   qui il consulente lavora su Safari, io non posso aprirgli la console, e
 *   ogni ipotesi costa un giro di prove a lui. Quindi la sfocatura scrive
 *   dove arriva e dove si ferma, e la riga la leggo io dal server.
 *  ⚠️ E NON SI SCRIVE UNA RIGA PER FOTOGRAMMA: solo i passaggi (accensione,
 *   esito, primo fotogramma, modello pronto, fallimenti). */
function annotaSfocatura(testo: string) {
  try {
    console.log("[BLUR]", testo);
    void fetch("/api/presenter/diario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ voce: `sfocatura · ${testo}` }),
    }).catch(() => {});
  } catch {
    /* mai in mezzo a una consulenza */
  }
}

/** Ferma il registratore chiedendogli PRIMA quello che ha in pancia.
 *  ⚠️ Senza `requestData()` una registrazione fermata entro il primo secondo
 *   (il passo del `timeslice`) si chiudeva senza aver consegnato niente: file
 *   vuoto e nessuna spiegazione. */
function fermaRegistratore() {
  if (!recorder) return;
  //  ⚠️ PRIMA si dichiara che è la fine, poi si ferma: l'ordine conta, perché
  //   `onstop` legge la bandierina per sapere se archiviare e chiudere oppure
  //   archiviare e riaprire la parte successiva.
  chiudiRegistrazione?.();
  try {
    if (recorder.state === "recording") recorder.requestData();
  } catch {
    /* */
  }
  try {
    recorder.stop();
  } catch {
    /* */
  }
}

async function toggleRecording() {
  if (recorder) {
    fermaRegistratore();
    return;
  }
  if (typeof MediaRecorder === "undefined") {
    alert("La registrazione non è supportata da questo browser.");
    return;
  }
  /*  ── ⚠️ IL PERMESSO DI SUONARE VALE SOLO DENTRO IL GESTO ──────────────
      Segnalazione del committente, con l'avviso sotto gli occhi: «Si sta
      registrando senza audio», e lui il clic l'aveva appena fatto — su REC.
      Nel diario del registratore la riga lo conferma: «sorgenti audio 0 ·
      contesto suspended».
      Il motivo è una regola dei browser: `resume()` risveglia l'audio solo se
      viene chiamato DENTRO il gesto dell'utente, e il gesto scade al primo
      `await`. Questa funzione, prima di arrivare al contesto, aspettava la
      risposta del server sulla sessione: da lì in poi, per Safari, non era
      più un clic — era codice qualunque, e il risveglio non veniva concesso.
      Perciò si chiede QUI, prima di qualunque attesa: la prima riga che gira
      dopo il tocco su REC. Niente await davanti, o non serve a niente. */
  try {
    const c = audioCtx();
    if (c && (c.state as string) === "suspended")
      void c.resume().catch(() => {
        /* */
      });
  } catch {
    /* un browser senza audio registra il video */
  }
  /*  ── ⚠️ E LO SCHERMO SI CHIEDE QUI, PER LO STESSO IDENTICO MOTIVO ────
      `getDisplayMedia` è un'altra delle cose che il browser concede solo
      DENTRO il gesto. Era chiesto più sotto, dopo aver aspettato la risposta
      del server sulla sessione: a quel punto il gesto era scaduto, il permesso
      veniva negato senza nemmeno mostrare la finestra di scelta, e si
      ripiegava sulle camere. È il «registra solo la camera del presentatore»
      segnalato dal committente: non una scelta del programma, un permesso
      chiesto un istante troppo tardi. */
  const schermoChiesto: Promise<MediaStream | null> = displayAlive(keptDisplay)
    ? Promise.resolve(keptDisplay)
    : catturaSchermo();
  if (!(await sessioneProntaPerArchiviare())) {
    avvisoRegistrazione({
      titolo: "Prima rientra col PIN",
      motivo:
        "La tua sessione da presentatore è scaduta: registrando adesso, alla fine l'archivio rifiuterebbe il file.",
      dettaglio:
        "Riapri il tuo link (o rientra dal cancello col PIN) e ripremi Registra: ci vogliono dieci secondi, e li spendi adesso invece di scoprirlo fra mezz'ora.",
      tono: "ambra",
    });
    return;
  }
  //  La finestra di scelta è partita prima di tutto: qui si raccoglie la
  //  risposta, che nel frattempo l'utente ha dato (o annullato).
  const display = await schermoChiesto;
  if (!display) {
    alert(
      "Registrazione annullata: per registrare quello che mostri devi scegliere lo schermo (o questa scheda) nella finestra di condivisione.",
    );
    return;
  }
  keptDisplay = display;
  await startRecordingWith(display);
}

/** display = null → registrazione delle sole CAMERE via compositor (zero prompt). */
async function startRecordingWith(display: MediaStream | null, auto = false) {
  if (recorder) return;
  recDisplay = display;
  try {
    const mix = new MediaStream();
    // video = la SCHEDA reale (identica a quella trasmessa al cliente).
    // Senza cattura schermo (o senza traccia video) uso il compositor canvas.
    let composed: MediaStream | null = null;
    /*  ── ⚠️ LA CATTURA SCHERMO SI USA SOLO SE È ANCORA VIVA ──────────────
        `display` può esserci ed essere morto: quando si preme «Interrompi
        condivisione» la traccia VIDEO finisce, ma quella audio del sistema
        resta viva — e il controllo di prima («una traccia qualsiasi è viva»)
        la dichiarava buona. Si finiva a registrare un fermo immagine nero,
        che è peggio di ripiegare sulle camere perché sembra riuscita. */
    const dvt = display?.getVideoTracks()[0];
    const usaSchermo = catturaUsabile(display?.getTracks() ?? []);
    if (dvt && usaSchermo) {
      mix.addTrack(dvt);
      dvt.addEventListener("ended", () => fermaRegistratore()); // "Interrompi condivisione"
    } else {
      composed = startRecCompositor();
      const vt = composed.getVideoTracks()[0];
      if (vt) mix.addTrack(vt);
    }
    // mix audio: audio della scheda + mic locale + audio di TUTTI i partecipanti remoti
    /*  Il contesto condiviso: è quello che un tocco qualsiasi nella pagina
        risveglia. Uno tutto nostro solo se non ce n'è (browser senza audio). */
    const ctx = audioCtx() || new (window.AudioContext || (window as any).webkitAudioContext)();
    recCtx = ctx;
    recCtxMio = ctx !== sharedCtx;
    const audioVivo = await contestoInFunzione(ctx);
    const dest = ctx.createMediaStreamDestination();
    recNodi.push(dest);
    /*  ── ⚠️ IL FILO DI SILENZIO: SENZA, NON SI REGISTRA NIENTE ───────────
        Segnalazione del committente: «Registrazione vuota — il registratore
        non ha prodotto alcun dato», e poi l'avviso nuovo: «sono passati alcuni
        secondi e non ha ancora prodotto niente», con il tempo che correva
        (00:27) in modalità CAMERE.
        Misurato in questo stesso browser, replicando il percorso CAMERE —
        tela 1280×720 disegnata a ogni fotogramma, tracce tutte vive,
        AudioContext in funzione, sette secondi:
            nessuna sorgente audio collegata → 0 pezzi, 0 byte
            una sorgente collegata           → 98.632 byte
        Non è il video a mancare: il registratore ASPETTA l'audio che gli
        abbiamo promesso (la traccia c'è, nel miscuglio) e che non arriva mai,
        e finché aspetta non consegna NEMMENO il video. La destinazione di un
        AudioContext senza niente collegato non produce buffer: una traccia
        viva e perfettamente immobile.
        È il caso normale di una consulenza che comincia: camera e microfono
        del consulente ancora chiusi, l'ospite che sta entrando e non parla,
        nessun audio di scheda. Cioè proprio i primi minuti, quelli che si
        registrano sempre.
        Qui si collega una sorgente costante a volume ZERO: inudibile, non
        cambia una virgola di quello che si sente, e tiene il flusso audio in
        movimento. Le voci vere si aggiungono sopra quando arrivano.
        ⚠️ SI COLLEGA SEMPRE, anche quando una voce c'è: le sorgenti possono
         finire nel mezzo (il microfono si chiude, l'ospite esce) e la
         registrazione non deve fermarsi con loro.
        ⚠️ `createConstantSource` non c'è su qualche browser vecchio: lì si usa
         un oscillatore con il volume a zero, che ha lo stesso effetto. */
    let sorgentiAudio = 0;
    if (audioVivo) {
      try {
        const zitto = ctx.createGain();
        zitto.gain.value = 0;
        zitto.connect(dest);
        recNodi.push(zitto);
        if (typeof ctx.createConstantSource === "function") {
          const filo = ctx.createConstantSource();
          filo.offset.value = 0;
          filo.connect(zitto);
          filo.start();
          recNodi.push(filo);
          recSorgenti.push(filo);
        } else {
          const filo = ctx.createOscillator();
          filo.connect(zitto);
          filo.start();
          recNodi.push(filo);
          recSorgenti.push(filo);
        }
        sorgentiAudio += 1;
      } catch (e) {
        console.warn(
          "[REC] filo di silenzio non collegato: la registrazione potrebbe restare vuota",
          e,
        );
      }
      /*  ⚠️ IL BANCO SI APRE PRIMA DI ATTACCARE LA PRIMA VOCE, e resta aperto
          per tutta la registrazione: le voci che arrivano dopo — l'ospite che
          finisce di collegarsi, il microfono acceso a metà consulenza — si
          attaccano da sé (vedi `collegaVoceAlRegistratore`). */
      recBanco = { ctx, dest, tracce: new Set<string>() };
      sorgentiAudio += collegaVoceAlRegistratore(display, "scheda"); // musica, video del caso
      sorgentiAudio += collegaVoceAlRegistratore(localStream, "io"); // il mio microfono
      remoteStreams.forEach((s, pid) => {
        sorgentiAudio += collegaVoceAlRegistratore(s, pid);
      });
      dest.stream.getAudioTracks().forEach((t) => mix.addTrack(t));
      //  La rete di sicurezza: ogni tre secondi si guarda se è comparsa una
      //  voce che non è passata da `ontrack`.
      if (recRicucitura != null) clearInterval(recRicucitura);
      recRicucitura = window.setInterval(ricuciVociDelRegistratore, 3000);
    } else {
      /*  ── ⚠️ CONTESTO SOSPESO: SI REGISTRA MUTO, NON VUOTO ──────────────
          Una traccia audio che nessuno alimenta non rallenta la
          registrazione: la ANNULLA (0 byte, video compreso). Se il contesto
          non è in funzione l'audio si lascia fuori dal miscuglio e il video
          si salva. Muto è un danno; vuoto è la consulenza persa.
          Succede su una scheda in cui non si è ancora toccato niente: il
          primo clic risveglia il contesto (`svegliaAlPrimoGesto`) e la
          registrazione successiva ha la voce. Per questa si dice subito,
          mentre la consulenza è in corso e si può ripremere REC. */
      console.warn("[REC] contesto audio", ctx.state, "→ registro il solo video");
      avvisoRegistrazione({
        titolo: "Si sta registrando senza audio",
        motivo:
          "il browser tiene l'audio di questa scheda in pausa perché dal caricamento della pagina non è stato toccato niente.",
        dettaglio:
          "Il video viene registrato. Per avere anche la voce: fai un clic qui nella pagina, poi ferma e ripremi REC — la consulenza continua comunque.",
        tono: "ambra",
      });
    }
    //  ⚠️ La promessa non mantenuta: una traccia audio che nessuno alimenta
    //   blocca tutto il registratore (vedi shop/registrazione). Col filo di
    //   silenzio qui sopra non può succedere: se succede lo si scrive, perché
    //   vorrebbe dire che il filo non si è collegato.
    if (
      rischioStallo({ tracceAudio: mix.getAudioTracks().length, sorgentiCollegate: sorgentiAudio })
    )
      console.error(
        "[REC] miscuglio a rischio: traccia audio senza nessuna sorgente — la registrazione resterà vuota",
      );
    //  ── ⚠️ C'È QUALCOSA DA REGISTRARE? ──────────────────────────────────
    //   Un miscuglio senza nemmeno una traccia viva dà un file vuoto, e lo dà
    //   quaranta minuti dopo. Meglio non partire e dirlo subito, quando si può
    //   ancora accendere un microfono.
    const cera = cÈQualcosaDaRegistrare(mix.getTracks());
    if (!cera) {
      const { titolo, motivo } = perchéVuota({ cera: false, secondi: 0 });
      console.warn("[REC] non parto:", motivo);
      stopRecCompositor();
      sganciaAudioRegistrazione();
      recDisplay = null;
      if (!auto) avvisoRegistrazione({ titolo, motivo, tono: "ambra" });
      return;
    }
    /*  ⚠️ I PEZZI DI QUESTA REGISTRAZIONE, E DI NESSUN'ALTRA. Vedi la nota su
        `recChunks` in testa al file: un secchio condiviso faceva chiudere a
        vuoto la registrazione precedente. */
    let pezzi: BlobPart[] = [];
    const mime = pickRecMime();
    /*  ══════════════════════════════════════════════════════════════════════
        PERCHÉ LA REGISTRAZIONE NON SI SALVAVA — E NON ERA UN GUASTO
        ──────────────────────────────────────────────────────────────────────
        Segnalazione del committente: «ora la registrazione non funziona,
        quando si stoppa non si salva».

        ⚠️ MISURATO, NON DEDOTTO. Il diario del registratore (rotta
         `presenter/diario`) ha la riga esatta di quella consulenza:
           «fine · 358s · pezzi 353 · 245010 KB»
         Duecentoquarantacinque MEGABYTE per sei minuti — cioè ~5,5 Mbit/s,
         la qualità che il browser sceglie da sé quando nessuno gliela dice.
         E l'archivio (Supabase Storage di questo progetto) accetta al massimo
         50 MB per file: l'ho verificato provando ad alzare il tetto del
         secchio e vedendo dove si ferma — 50 MB esatti, è il limite del
         progetto, non del secchio. Il rifiuto arrivava a caricamento FINITO,
         dopo aver spinto 245 MB su per la rete.
         Il registratore funzionava benissimo: era il file a non poter entrare.

        DUE RIMEDI, E SERVONO TUTTI E DUE.
        1. Si registra a una qualità dichiarata (~1,2 Mbit/s): la stessa
           consulenza pesa un quinto, e si vede bene lo stesso — è una
           videochiamata, non un film.
        2. Si taglia in PARTI: quando la parte in corso si avvicina al tetto,
           si chiude, si archivia SUBITO e se ne apre un'altra senza fermare
           niente. Una consulenza di un'ora non dipende più da un tetto che
           non possiamo alzare da qui.
        ⚠️ E il tetto adesso il server lo conosce (il secchio dichiara 50 MB),
         quindi se una parte dovesse comunque eccedere lo dice PRIMA di
         caricare, invece che alla fine.
        ══════════════════════════════════════════════════════════════════════ */
    /*  ⚠️ DUE QUALITÀ, PERCHÉ SONO DUE COSE DIVERSE. Le camere sono volti che
        si muovono poco: 1,2 Mbit/s bastano. Lo schermo invece ha del TESTO —
        un preventivo, le impostazioni, un listino — e sotto una certa soglia
        il testo si impasta e la registrazione non serve più a niente.
        Il tetto non è il peso: è un TETTO. Uno schermo quasi fermo consuma
        molto meno di così, perché comprimere due fotogrammi uguali costa
        quasi zero — paga solo quando succede qualcosa, che è esattamente
        quando vogliamo vedere bene. */
    const QUALITA = {
      videoBitsPerSecond: usaSchermo ? 2_500_000 : 1_200_000,
      audioBitsPerSecond: 96_000,
    };
    /** Sopra questo peso la parte in corso si chiude e se ne apre un'altra.
     *  Sta sotto il tetto vero (50 MB) con margine: il conteggio dei pezzi
     *  arriva a scatti di un secondo, e l'ultimo pezzo non deve far sforare. */
    const SOGLIA_PARTE = 40 * 1024 * 1024;

    let numeroParte = 1;
    let pesoParte = 0;
    let inizioParte = Date.now();
    //  «Il consulente ha premuto stop»: distingue la fine di una PARTE dalla
    //  fine della registrazione. Senza, chiudere una parte spegnerebbe le
    //  camere e il compositore in mezzo alla consulenza.
    let finePerDavvero = false;
    chiudiRegistrazione = () => {
      finePerDavvero = true;
    };

    const nomeDellaParte = (n: number, ext: string) => {
      const t = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      //  Il nome del file porta quello del software: nella cartella Download
      //  di chi la riceve una registrazione anonima non si riconosce più.
      return n === 1 && finePerDavvero ? `meetly-${t}.${ext}` : `meetly-${t}-parte${n}.${ext}`;
    };

    const nuovoRegistratore = (): MediaRecorder => {
      const r = mime
        ? new MediaRecorder(mix, { mimeType: mime, ...QUALITA })
        : new MediaRecorder(mix, QUALITA);
      r.ondataavailable = (e) => {
        if (!e.data || !e.data.size) return;
        pezzi.push(e.data);
        pesoParte += e.data.size;
        /*  ⚠️ Il taglio si decide QUI, sul peso vero, non su un orologio: la
            stessa consulenza pesa il doppio se si condivide lo schermo con un
            video in movimento, e un taglio «ogni cinque minuti» sforerebbe
            lo stesso. */
        if (
          !finePerDavvero &&
          pesoParte >= SOGLIA_PARTE &&
          recorder === r &&
          r.state === "recording"
        ) {
          console.log(
            `[REC] parte ${numeroParte} arrivata a ${Math.round(pesoParte / (1024 * 1024))} MB: la chiudo e ne apro un'altra`,
          );
          try {
            r.stop();
          } catch {
            /* la chiusura arriva comunque da onstop */
          }
        }
      };
      //  Un errore del registratore non deve restare nella console: è l'unica
      //  spiegazione che avrà chi si ritrova senza il video.
      r.onerror = (e) =>
        console.error(
          "[REC] errore del registratore",
          (e as unknown as { error?: unknown })?.error,
        );
      r.onstop = () => {
        if (spia) {
          clearTimeout(spia);
          spia = null;
        }
        const type = r.mimeType || mime || "video/webm";
        const ext = type.includes("mp4") ? "mp4" : "webm";
        const blob = new Blob(pezzi, { type });
        const durataParte = Math.round((Date.now() - inizioParte) / 1000);
        const quanti = pezzi.length;
        const fname = nomeDellaParte(numeroParte, ext);
        //  Il secchio si svuota PRIMA di ripartire: i pezzi della parte
        //  appena chiusa non devono finire dentro la prossima.
        pezzi = [];
        pesoParte = 0;

        if (finePerDavvero) {
          // ── NIENTE DOWNLOAD AUTOMATICO ────────────────────────────────
          //  Chiudere una consulenza faceva partire da solo lo scaricamento
          //  del video: file pesanti nella cartella Download, a ogni
          //  chiamata, senza che nessuno li avesse chiesti. La registrazione
          //  va SOLO in archivio (Impostazioni → Registrazioni).
          recorder = null;
          set({ recording: false, recScreen: false });
          const durata = Math.round((Date.now() - avviataIl) / 1000);
          annota(
            `fine · ${durata}s · parti ${numeroParte} · pezzi ${quanti} · ${Math.round(blob.size / 1024)} KB`,
          );
          uploadRecording(blob, fname, durataParte, perchéVuota({ cera, secondi: durata }));
          stopRecCompositor();
          composed?.getTracks().forEach((t) => t.stop());
          recDisplay?.getTracks().forEach((t) => t.stop());
          recDisplay = null;
          if (keptDisplay && !displayAlive(keptDisplay)) {
            keptDisplay = null;
            set({ autoRecArmed: false });
          }
          sganciaAudioRegistrazione();
          return;
        }

        /*  ── SI CAMBIA PARTE, NON SI SMETTE ────────────────────────────
            Si archivia quella appena chiusa e si riparte nello stesso
            istante: le camere, il compositore e l'audio restano collegati,
            quindi il buco fra una parte e l'altra è quello di una riga di
            codice, non di una riconnessione. */
        annota(
          `parte ${numeroParte} chiusa · ${durataParte}s · ${Math.round(blob.size / 1024)} KB · continuo`,
        );
        uploadRecording(blob, fname, durataParte);
        numeroParte += 1;
        inizioParte = Date.now();
        const prossimo = nuovoRegistratore();
        recorder = prossimo;
        try {
          prossimo.start(1000);
        } catch (e) {
          console.error("[REC] la parte successiva non è partita", e);
          recorder = null;
          set({ recording: false, recScreen: false });
          avvisoRegistrazione({
            titolo: "La registrazione si è fermata",
            motivo:
              "la parte precedente è stata archiviata, ma non è stato possibile aprirne una nuova.",
            dettaglio:
              "Quello che hai registrato fino a qui è al sicuro in Registrazioni. Puoi ripremere REC per continuare.",
            tono: "ambra",
          });
        }
      };
      return r;
    };

    const rec = nuovoRegistratore();
    const avviataIl = Date.now();
    recStartedAt = avviataIl;
    inizioParte = avviataIl;
    annota(
      `avvio ${usaSchermo ? "SCHERMO" : "CAMERE"} · tracce ${mix
        .getTracks()
        .map((t) => `${t.kind}:${t.readyState}${t.muted ? "(muta)" : ""}`)
        .join(" ")}` +
        ` · sorgenti audio ${sorgentiAudio} · contesto ${ctx.state}${recCtxMio ? " (di riserva)" : ""} · formato ${mime || "di serie"}` +
        ` · qualità ${Math.round(QUALITA.videoBitsPerSecond / 1000)} kbit/s · parti da ${Math.round(SOGLIA_PARTE / (1024 * 1024))} MB` +
        ` · scheda ${typeof document !== "undefined" ? document.visibilityState : "?"}`,
    );
    rec.start(1000);
    recorder = rec;
    set({ recording: true, recScreen: !!usaSchermo }); // timeslice → dataavailable periodico
    /*  ── LA SPIA DEL PRIMO PEZZO ──────────────────────────────────────────
        Se dopo qualche secondo non è arrivato NIENTE, qualcosa non va — e lo
        si dice adesso, che la consulenza è in corso e si può rimediare, non
        alla fine davanti a un file vuoto. */
    let spia: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      spia = null;
      if (pezzi.length || recorder !== rec) return;
      annota(
        `NIENTE dopo ${ATTESA_PRIMO_PEZZO_MS} ms · tracce ${mix
          .getTracks()
          .map((t) => `${t.kind}:${t.readyState}`)
          .join(" ")} · scheda ${typeof document !== "undefined" ? document.visibilityState : "?"}`,
      );
      avvisoRegistrazione({
        titolo: "La registrazione non sta scrivendo",
        motivo: "sono passati alcuni secondi e il registratore non ha ancora prodotto niente.",
        dettaglio:
          "Se stai registrando lo schermo, controlla di non aver interrotto la condivisione. Puoi fermare e ripremere REC: la consulenza continua comunque.",
        tono: "ambra",
      });
    }, ATTESA_PRIMO_PEZZO_MS);
  } catch {
    stopRecCompositor();
    recDisplay?.getTracks().forEach((t) => t.stop());
    recDisplay = null;
    sganciaAudioRegistrazione();
    set({ recording: false, recScreen: false });
    // in automatico non disturbo il presentatore con un alert durante la consulenza
    if (!auto) alert("Impossibile avviare la registrazione su questo browser.");
  }
}
/** Secondi trascorsi dall'inizio della registrazione (0 se non attiva). */
export function recElapsed(): number {
  return recorder ? Math.max(0, Math.round((Date.now() - recStartedAt) / 1000)) : 0;
}

// ── PDF trascrizione (finestra di stampa → salva come PDF) ────────────────
export function exportTranscriptPDF(scope: "both" | "me") {
  const meRole = S.role || "host";
  const rows = S.transcript.filter((l) => scope === "both" || l.who === meRole);
  const nameOf = (w: Role) =>
    w === "host" ? S.presenterName || "Presentatore" : S.guestName || "Cliente";
  const brand = getComputedStyle(document.documentElement).getPropertyValue("--brand") || "#3b6fe0";
  const fmt = (t: number) =>
    new Date(t).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  const body = rows
    .map(
      (l) => `
    <div class="row ${l.who}">
      <div class="meta"><span class="who">${nameOf(l.who)}</span><span class="time">${fmt(l.t)}</span></div>
      <div class="bubble">${l.text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] as string)}</div>
    </div>`,
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Trascrizione della consulenza — Meetly</title>
  <style>
    *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;margin:0;color:#0e1726;background:#fff;padding:32px}
    h1{font-size:20px;margin:0 0 2px} .sub{color:#64748b;font-size:12px;margin-bottom:20px}
    .row{margin:0 0 12px;max-width:78%} .row.host{margin-right:auto} .row.viewer{margin-left:auto;text-align:right}
    .meta{font-size:10px;color:#94a3b8;margin:0 4px 3px;display:flex;gap:8px} .row.viewer .meta{justify-content:flex-end}
    .who{font-weight:700;color:oklch(0.55 0.19 252)} .bubble{display:inline-block;padding:9px 13px;border-radius:14px;font-size:13px;line-height:1.45;background:#f1f5f9}
    .row.host .bubble{background:#eef2ff;border-bottom-left-radius:4px} .row.viewer .bubble{background:oklch(0.65 0.19 252);color:#fff;border-bottom-right-radius:4px}
    @media print{body{padding:16px}}
  </style></head><body>
    <h1>Trascrizione della consulenza — Hair Genius Labs</h1>
    <div class="sub">${scope === "both" ? "Conversazione completa" : "Solo i tuoi interventi"} · ${new Date().toLocaleString("it-IT")} · ${rows.length} interventi</div>
    ${body || '<p style="color:#94a3b8">Nessun intervento registrato.</p>'}
    <script>window.onload=()=>{setTimeout(()=>window.print(),300)}<\/script>
  </body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

// ── ciclo di segnalazione ─────────────────────────────────────────────────
function attachChannel(sessionId: string) {
  if (chan) {
    supabase.removeChannel(chan);
    chan = null;
  }
  resetRoster(); // sessione nuova → nessun partecipante ereditato dalla precedente
  startRosterGC(); // il collettore dei fantasmi vive quanto il canale
  hookLeave(); // uscita pulita alla chiusura/ricarica della scheda
  const ch = supabase.channel(`qcall-${sessionId}`, { config: { broadcast: { self: false } } });
  ch.on("broadcast", { event: "callstate" }, ({ payload }: any) => {
    if (!isViewer()) return;
    //  Il presentatore ha appena parlato su QUESTO canale: vedi
    //  `presentatoreVistoIl`. Vale più di un battito che manca sul server.
    presentatoreVistoOra();
    const cambiaModo = !S.active || payload.active === true;
    const changed =
      cambiaModo &&
      ((payload.mode && payload.mode !== S.mode) ||
        (payload.focusPid !== undefined && payload.focusPid !== S.focusPid));
    // SOLO una chiusura esplicita (`ended`) riporta l'ospite in attesa. Ogni altra
    // callstate può ALZARE sessionLive ma non abbassarlo mai (vedi guestSticky).
    const ended = payload.ended === true;
    guestSawState = !ended; // lo stato del presentatore è arrivato (sblocca la schermata di caricamento)
    const nextLive = ended ? false : S.sessionLive || payload.sessionLive === true;
    // `active` è MONOTONA quanto `sessionLive`: solo una chiusura esplicita la
    // abbassa. Senza questo, un callstate `active:false` (scheda presentatore non
    // in diretta, oppure un vecchio messaggio in coda) spegneva i media dell'ospite
    // e ne svuotava il roster ~1 volta al secondo → schermate che si alternano.
    const nextActive = ended ? false : S.active || payload.active === true;
    if (nextLive !== S.sessionLive)
      console.log(
        "[GUEST] sessionLive",
        S.sessionLive,
        "→",
        nextLive,
        ended ? "(chiamata chiusa dal presentatore)" : "(callstate dal presentatore)",
      );
    if (nextActive !== S.active) console.log("[GUEST] active", S.active, "→", nextActive);
    if (payload.active === false && !ended && S.active)
      console.log("[GUEST] callstate active:false IGNORATA (nessuna chiusura esplicita)");
    if (ended) {
      guestSticky = false;
      console.log("[GUEST] joined → false (chiusura sessione)");
    }
    /*  ── ⚠️ CHI NON È NELLA CHIAMATA NON DECIDE COSA VEDI ────────────────
        Misurato, non dedotto: con l'ospite in videochiamata ho mandato UNA
        callstate con `mode: "content"` e `active: false` — cioè esattamente
        quello che manda una seconda scheda del consulente rispondendo al
        saluto dell'ospite — e l'ospite è tornato sui contenuti in un secondo.
        Dall'altra parte sembra che «metto videochiamata e non funziona».
        Il rimedio sta anche di qua, e non solo sulla scheda che sbaglia: una
        `callstate` che dichiara di NON essere in chiamata può dire tutto il
        resto (la sessione è viva, chi è il consulente, le camerine) ma non
        può spostare quello che il cliente ha davanti.
        ⚠️ La SCELTA esplicita continua a passare sempre: `hostSetMode` manda
         anche l'evento `mode`, che non passa di qui e non è toccato.
        ⚠️ E vale solo quando l'ospite è già in chiamata: prima, quando non ha
         ancora niente da perdere, la callstate resta la strada buona per
         portargli la modalità iniziale. */
    //  Stessa precedenza di sopra, sull'altra strada: vedi shop/mio-preventivo.
    const modoAmmesso = !restaSulMioPreventivo() && (!S.active || payload.active === true);
    if (!modoAmmesso && payload.mode && payload.mode !== S.mode) {
      console.log(
        `[GUEST] modalità ${payload.mode} IGNORATA: arriva da una scheda che non è in chiamata`,
      );
    }
    set({
      active: nextActive,
      mode: (modoAmmesso && payload.mode) || S.mode,
      primary: payload.primary || S.primary,
      // solo un nome VERO sovrascrive quello già noto (mai "" né "Ospite")
      presenterName: isRealName(payload.presenterName)
        ? String(payload.presenterName).trim()
        : S.presenterName,
      sessionLive: nextLive,
      focusPid: modoAmmesso && payload.focusPid !== undefined ? payload.focusPid : S.focusPid,
      contentCam: payload.contentCam ? { ...S.contentCam, ...payload.contentCam } : S.contentCam,
    });
    if (changed) resetGuestZoom(); // cambio schermata → zoom del guest azzerato
    // l'ospite era entrato col solo nome (condivisione contenuti): ora la chiamata
    // parte davvero → apro camera/microfono senza richiedergli di nuovo il nome
    if (nextActive) viewerEnsureMedia();
    //  Il cliente aveva già dato nome e permessi durante l'attesa: la
    //  consulenza è appena partita e bussa da solo. Vedi `viewerPrepara`.
    if (nextLive) bussaSePronto();
    // SOLO la chiusura esplicita smonta i media. Prima bastava un `active:false`
    // qualsiasi: azzerava peer + roster (e quindi faceva sparire il presentatore).
    if (ended) teardownMedia({ keepJoined: false });
  });
  /*  ── ⚠️ LA PAGINA VIAGGIA SUL CANALE, NON A FORZA DI DOMANDE ───────────
      Il cliente chiedeva al server «che pagina guardi?» ogni 1,2 secondi: la
      voce più grossa delle 7.200 richieste l'ora misurate il giorno in cui il
      sito si è fermato per i limiti del piano. Adesso il consulente lo DICE
      quando cambia schermata — che è anche più svelto di prima — e il giro
      resta solo come rete di sicurezza, più lento. */
  ch.on("broadcast", { event: "pagina" }, ({ payload }: any) => {
    if (!isViewer()) return;
    paginaDalCanale(String(payload?.path || ""));
  });
  /*  «Ho toccato un interruttore»: il cliente va a rileggere SUBITO invece di
      aspettare il giro lento. Una richiesta quando succede qualcosa, invece di
      una ogni due secondi perché potrebbe succedere. */
  ch.on("broadcast", { event: "regia" }, () => {
    if (isViewer()) void guardaLaStanza();
  });
  ch.on("broadcast", { event: "mode" }, ({ payload }: any) => {
    if (!isViewer()) return;
    /*  ⚠️ IL SUO PREVENTIVO VINCE: se è acceso per questa persona, la
        modalità scelta dal consulente non la sposta. È la richiesta del
        committente, ed è anche l'unica difesa che funziona mentre lui passa
        alle facce per parlare con un altro del gruppo. */
    if (restaSulMioPreventivo()) {
      console.log(`[GUEST] modalità ${payload?.v} ignorata: sto sul mio preventivo`);
      return;
    }
    const changed =
      payload.v !== S.mode || (payload.focusPid !== undefined && payload.focusPid !== S.focusPid);
    console.log(`[GUEST] modalità ricevuta: ${payload.v} (era ${S.mode})`);
    set({
      mode: payload.v,
      focusPid: payload.focusPid !== undefined ? payload.focusPid : S.focusPid,
    });
    // ogni CAMBIO SCHERMATA azzera lo zoom del guest → torna adattato al suo display
    if (changed) resetGuestZoom();
  });
  // Feature 4 — il guest riceve il pid di chi parla (PiP che segue l'oratore)
  ch.on("broadcast", { event: "activespeaker" }, ({ payload }: any) => {
    if (isViewer()) set({ activeSpeakerPid: payload.pid || null });
  });
  // PiP CONDIVISA — la posizione viaggia nei DUE sensi: la sposta il presentatore
  // (sul suo "specchio") o l'ospite (col dito) e l'altro lato la applica subito.
  //  MISURA DELLA PiP — stessa logica della posizione: la decide uno dei due e
  //  vale per entrambi, ma espressa in frazione di schermo (vedi pipFrazione).
  ch.on("broadcast", { event: "pipsize" }, ({ payload }: any) => {
    if (!payload || payload.from === S.myPid) return;
    const f = Number(payload.f);
    if (!Number.isFinite(f) || f <= 0 || f > 1) return;
    setPipFrazione(f, { broadcast: false });
  });
  ch.on("broadcast", { event: "pippos" }, ({ payload }: any) => {
    if (!payload || payload.from === S.myPid) return;
    const x = Number(payload.x),
      y = Number(payload.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    setPipPos({ x, y }, { broadcast: false });
  });
  // ── RESILIENZA OSPITE ────────────────────────────────────────────────────
  //  L'ospite non mostra MAI una schermata tecnica: quando un render fallisce
  //  copre tutto con la schermata di attesa brandizzata, si ri-monta da solo e
  //  avvisa il presentatore con `guesterror`. Il presentatore vede un badge
  //  discreto con "Ricarica" che manda `reload` a quel dispositivo.
  ch.on("broadcast", { event: "guesterror" }, ({ payload }: any) => {
    if (isViewer() || !payload) return;
    const msg = String(payload.msg || "Errore sconosciuto").slice(0, 300);
    console.warn("[HOST] errore sul dispositivo del cliente:", msg, payload.stack || "");
    set({
      guestError: {
        msg,
        at: Date.now(),
        from: String(payload.from || ""),
        name: String(payload.name || "Cliente"),
      },
    });
  });
  ch.on("broadcast", { event: "reload" }, ({ payload }: any) => {
    if (!isViewer()) return;
    const to = payload?.to;
    if (to && to !== S.myPid) return;
    console.log("[GUEST] ricarica richiesta dal presentatore");
    try {
      window.location.reload();
    } catch {
      /* */
    }
  });
  // Feature 5 — chat privata 1:1: consegno solo al destinatario indirizzato
  ch.on("broadcast", { event: "chat" }, ({ payload }: any) => {
    if (payload && payload.to === S.myPid) set({ chat: [...S.chat, payload as ChatMsg] });
  });
  ch.on("broadcast", { event: "primary" }, ({ payload }: any) => {
    if (isViewer()) set({ primary: payload.v });
  });
  ch.on("broadcast", { event: "contentcam" }, ({ payload }: any) => {
    if (isViewer()) set({ contentCam: { ...S.contentCam, ...payload } });
  });
  ch.on("broadcast", { event: "clientchose" }, ({ payload }: any) => {
    if (!isViewer()) set({ clientChose: payload.v, primary: payload.v });
  });
  ch.on("broadcast", { event: "speaking" }, ({ payload }: any) => {
    if (isViewer()) setSpeaking(!!payload.v);
  });
  // NB: lo zoom dell'anteprima dispositivo NON viene più applicato al guest: il suo
  // schermo deve sempre adattarsi al proprio display (niente zoom ereditato/appiccicato).
  ch.on("broadcast", { event: "viewzoom" }, () => {
    if (isViewer() && typeof document !== "undefined") {
      try {
        (document.documentElement.style as any).zoom = "";
        (document.body.style as any).zoom = "";
      } catch {
        /* */
      }
    }
  });
  // (E) reset zoom del browser del guest: best-effort (ricalibra il viewport + azzera lo zoom CSS)
  ch.on("broadcast", { event: "resetzoom" }, () => {
    if (isViewer()) resetGuestZoom();
  });
  ch.on("broadcast", { event: "quality" }, ({ payload }: any) => {
    if (isViewer()) {
      set({ myQuality: payload.level });
      applyQualityLocal(payload.level);
    }
  });
  ch.on("broadcast", { event: "transcript" }, ({ payload }: any) => {
    set({ transcript: [...S.transcript, payload as TransLine] });
  });

  // ── MESH: presenza + segnalazione indirizzata (to/from) ─────────────────
  ch.on("broadcast", { event: "hello" }, ({ payload }: any) => {
    const pid = String(payload?.pid || "");
    if (!pid || pid === S.myPid) return;
    const role: Role = payload?.role === "host" ? "host" : "viewer";
    if (isViewer() && role === "host") presentatoreVistoOra();
    // ROSTER AUTORITATIVO (anti-fantasmi):
    //  · un ospite entra in lista SOLO se dichiara di essere entrato davvero (joined)
    //  · il presentatore NON elenca altre schede presentatore (seconda scheda, anteprima)
    if (role === "viewer" && payload?.joined !== true) return;
    if (!isViewer() && role === "host") return;
    // NB: l'ospite NON filtra mai il presentatore: la regola qui sopra vale solo
    // lato host (una scheda presentatore non elenca le altre schede presentatore).
    // Una scheda presentatore NON in diretta non partecipa affatto alla presenza:
    // non elenca ospiti e soprattutto non risponde (era la sorgente dei fantasmi).
    if (!isViewer() && !canBroadcastState()) return;
    // MODERAZIONE: dispositivo bloccato → kick immediato, nessun ingresso
    const dev = String(payload?.dev || "");
    if (dev) deviceOf.set(pid, dev);
    /*  ── ⚠️ L'AVVISO SPARISCE QUANDO IL CLIENTE È TORNATO ─────────────────
        Il riquadro «Problema sul dispositivo del cliente» restava a schermo
        anche dopo che il cliente era rientrato da solo: il consulente vedeva
        un allarme per un guasto già passato, e l'unico modo di toglierlo era
        chiuderlo a mano — davanti al cliente. Chi si riannuncia sta bene per
        definizione: il suo avviso si chiude da sé. */
    if (!isViewer() && S.guestError) {
      const suo = S.guestError.from === pid || (!!dev && deviceOf.get(S.guestError.from) === dev);
      if (suo) {
        console.log("[BAR] il cliente è rientrato → tolgo l'avviso di errore");
        set({ guestError: null });
      }
    }
    if (!isViewer() && dev && blockedSet().has(dev)) {
      send("kick", { to: pid, dev, why: "blocked" });
      removePeer(pid, "blocked");
      return;
    }
    // DEDUPE per DISPOSITIVO: se lo stesso ospite rientra (reload → pid nuovo) la
    // vecchia voce viene SOSTITUITA, non affiancata (niente doppioni in lista).
    //  DEDUPE STRETTO: una sola voce per dispositivo, il pid vecchio viene sempre buttato.
    //  ATTENZIONE: si sostituisce SOLO una voce vecchia NON sana. Un peer connesso
    //  (o che sta ricevendo media) non va mai chiuso: il presentatore può avere più
    //  schede/contesti con lo stesso `dev` e pid diversi, e chiuderlo a ogni hello
    //  (ogni 3s) produceva il ciclo connetti/disconnetti.
    if (dev)
      for (const [p2, d2] of Array.from(deviceOf.entries())) {
        if (p2 === pid || d2 !== dev) continue;
        if (peerIsHealthy(p2)) {
          console.log("[PEER] dedupe-dev SKIP (peer sano)", p2);
          continue;
        }
        removePeer(p2, "dedupe-dev");
      }
    // DEDUPE del PRESENTATORE (lato ospite): il presentatore è UNO. Un hello host
    // con un pid nuovo SOSTITUISCE la voce precedente (e ne chiude il peer), non se
    // le affianca — altrimenti dopo un reload del presentatore l'ospite lo vedeva
    // due volte (uno connesso, uno eternamente in "connessione…").
    if (isViewer() && role === "host") {
      // Si sostituisce SOLO se è davvero lo STESSO dispositivo (stesso `dev`) e la
      // voce vecchia non è viva. Mai chiudere il presentatore connesso: era la
      // seconda causa del loop connetti/disconnetti (hello ogni 3s).
      for (const r of S.roster) {
        if (r.role !== "host" || r.pid === pid) continue;
        if (peerIsHealthy(r.pid)) {
          console.log("[PEER] dedupe-host SKIP (peer sano)", r.pid);
          continue;
        }
        // Voce host NON sana: si rimuove SEMPRE, anche se il `dev` è diverso
        // (presentatore rientrato da un altro browser/contesto). Tenerla creava
        // la terza tile fantasma eternamente in "connessione…" lato ospite.
        console.log(
          "[GUEST] presentatore sostituito:",
          r.pid,
          "→",
          pid,
          deviceOf.get(r.pid) === dev ? "(stesso dev)" : "(dev diverso)",
        );
        removePeer(r.pid, "dedupe-host");
      }
    }
    const known = S.roster.some((r) => r.pid === pid);
    lastSeen.set(pid, Date.now());
    if (!firstSeen.has(pid)) firstSeen.set(pid, Date.now());
    /*  ── SUL RIQUADRO, IL NOME DELLA SCHEDA ────────────────────────────
        Chi è entrato scegliendo il proprio nome si annuncia con il gettone
        della sua scheda: qui diventa «Anna Verdi» sul riquadro del
        consulente. Agli altri clienti continua ad arrivare `name`, che è
        nome e iniziale (vedi `broadcastRoster`). */
    /*  ⚠️ IL GETTONE SI RICORDA ANCHE SE ORA NON DICE NIENTE. L'annuncio
        dell'ospite arriva in un istante; l'elenco degli attesi lo legge il
        consulente con una chiamata al server, e a volte arriva DOPO. In quel
        caso qui non si trovava nessuno e la riga restava senza scheda per
        tutta la consulenza: il pannello del gruppo scriveva «acceso, ma lui
        non è dentro» di una persona che era collegata. Ora il gettone resta
        da parte e `ribattezzaConGliAttesi` chiude il conto appena l'elenco
        arriva. */
    if (!isViewer() && role === "viewer" && payload?.persona)
      gettoneDelPid.set(pid, String(payload.persona));
    if (!isViewer() && role === "viewer") {
      const g = String(payload?.persona || "") || gettoneDelPid.get(pid) || "";
      const a = g ? S.attesi.find((x) => x.gettone === g) : null;
      salutoDelPid.set(pid, { at: Date.now(), leadId: a?.leadId || "" });
    }
    const chiEra =
      !isViewer() && role === "viewer"
        ? (S.attesi.find((a) => a.gettone === String(payload?.persona || "")) ?? null)
        : null;
    upsertRoster(
      pid,
      payload.name || "Ospite",
      role,
      payload.camOn !== false,
      //  ⚠️ `suo` è l'ULTIMA parola del cliente, non un valore da conservare:
      //   cambia ogni volta che il consulente accende o spegne l'interruttore.
      {
        ...(chiEra ? { nomeVero: chiEra.nome, leadId: chiEra.leadId } : {}),
        ...(role === "viewer" ? { suo: payload?.suo === true } : {}),
      },
    );
    /*  ── PRESENTATORE: LE DIMENSIONI REALI DELLO SCHERMO DELL'OSPITE ─────
        ⚠️ DI UN OSPITE SOLO, quello di riferimento (vedi `shop/ospiti`).
        Serve all'anteprima «come lo vede lui», e la misura arrivava da
        CHIUNQUE: con due ospiti — uno al telefono in verticale, uno al
        computer — se la riscrivevano a vicenda a ogni annuncio, e la cornice
        dell'anteprima cambiava forma da sola mentre si parlava. Ora la manda
        solo chi la anteprima sta davvero rappresentando; le misure degli altri
        si ignorano, non si mediano: una media fra un telefono e un monitor è
        una forma che non esiste su nessuno dei due schermi. */
    const rifVp = pidDiRiferimento(S.roster, { focusPid: S.focusPid });
    if (
      !isViewer() &&
      role === "viewer" &&
      (!rifVp || rifVp === pid) &&
      payload?.vp &&
      Number(payload.vp.w) > 0 &&
      Number(payload.vp.h) > 0
    ) {
      const vp: GuestViewport = {
        w: Math.round(Number(payload.vp.w)),
        h: Math.round(Number(payload.vp.h)),
        dpr: Number(payload.vp.dpr) || 1,
        portrait: payload.vp.portrait !== false,
      };
      const cur = S.guestViewport;
      if (!cur || cur.w !== vp.w || cur.h !== vp.h || cur.dpr !== vp.dpr) {
        console.log(
          `[VIEWPORT] cliente ${vp.w}×${vp.h} @${vp.dpr}x ${vp.portrait ? "verticale" : "orizzontale"}`,
        );
        applicaGuestViewport(vp);
      }
    }
    // mi riannuncio al nuovo arrivato, oppure a chi lo chiede esplicitamente
    // (ri-sottoscrizione: il pid è già noto ma l'altro lato ha il roster vuoto)
    if (!known || payload?.req === true) sendHello(false);
    if (!isViewer() && (!known || payload?.req === true)) {
      broadcastState();
      broadcastRoster();
    } // il guest riceve subito mode/primary/contentCam + lista autorevole
    maybeInitiate(pid);
  });
  ch.on("broadcast", { event: "bye" }, ({ payload }: any) => {
    //  Chiudere la scheda è un'uscita vera: si dimentica subito il saluto.
    if (payload?.pid) salutoDelPid.delete(String(payload.pid));
    if (!payload?.pid) return;
    removePeer(payload.pid, "bye");
    // se ad uscire è il PRESENTATORE, l'ospite torna subito in attesa: niente
    // più attesa dei 10s di silenzio né camera "spenta" appesa.
    if (payload.role === "host" && isViewer())
      guestBackToWaiting("il presentatore ha chiuso la videochiamata");
  });
  // ── LISTA AUTOREVOLE DEI PARTECIPANTI (anti tile fantasma) ─────────────
  //  Il presentatore è l'UNICA fonte di verità sulla presenza: ogni ~5s manda
  //  l'elenco completo (sé stesso + gli ospiti). L'ospite RICONCILIA la propria
  //  lista: tutto ciò che non compare lì sparisce. Così una voce morta non può
  //  più sopravvivere solo da un lato.
  ch.on("broadcast", { event: "roster" }, ({ payload }: any) => {
    if (!isViewer()) return;
    const from = String(payload?.from || "");
    const list: any[] = Array.isArray(payload?.list) ? payload.list : [];
    if (!from || !list.length) return;
    const ok = new Set<string>(list.map((x) => String(x?.pid || "")));
    if (!ok.has(from)) ok.add(from);
    const keepHost = bestHost(S)?.pid || null;
    for (const r of S.roster.slice()) {
      if (ok.has(r.pid)) continue;
      // non si tocca MAI il presentatore con cui sono davvero in chiamata
      // (lista arrivata da un'altra scheda presentatore / broadcast in ritardo)
      if (r.role === "host" && r.pid === keepHost && peerIsHealthy(r.pid)) continue;
      removePeer(r.pid, "roster-autorevole");
    }
    // la mia stessa voce non deve mai comparire tra "gli altri"
    if (S.myPid && S.roster.some((r) => r.pid === S.myPid)) removePeer(S.myPid, "self-in-roster");
    for (const x of list) {
      const p = String(x?.pid || "");
      if (!p || p === S.myPid) continue;
      if (!S.roster.some((r) => r.pid === p)) continue; // solo aggiornamento nomi/camera
      lastSeen.set(p, Date.now());
      upsertRoster(
        p,
        String(x?.name || "Ospite"),
        x?.role === "host" ? "host" : "viewer",
        x?.camOn !== false,
      );
    }
  });
  // MODERAZIONE — l'ospite indirizzato esce subito e NON rientra da solo
  ch.on("broadcast", { event: "kick" }, ({ payload }: any) => {
    if (!isViewer()) return;
    const mine = payload?.to === S.myPid || (payload?.dev && payload.dev === myDeviceId());
    if (!mine) return;
    set({ kicked: payload?.why === "blocked" ? "blocked" : "removed" });
    teardownMedia();
  });
  // ── PERCHÉ USCIVA "Failed to set local answer sdp: no pending remote description" ──
  //  All'ingresso dell'ospite le proposte di connessione arrivano anche a raffica
  //  (riannuncio dopo la sottoscrizione, ritentativi, più contesti). Questo
  //  gestore era ASINCRONO e senza serializzazione: due proposte ravvicinate si
  //  sovrapponevano e la seconda azzerava lo stato mentre la prima stava ancora
  //  preparando la risposta. A quel punto la risposta non aveva più una proposta
  //  a cui riferirsi e la promessa veniva rifiutata: nessuna conseguenza pratica
  //  (la connessione si stabiliva comunque al tentativo successivo), ma essendo
  //  un rifiuto non gestito faceva scattare la segnalazione verso di te.
  //  Ora: una proposta per volta per ciascun interlocutore, si risponde solo se
  //  la connessione è davvero in attesa di risposta, ed eventuali errori vengono
  //  registrati in console senza allarmare nessuno.
  ch.on("broadcast", { event: "offer" }, ({ payload }: any) => {
    if (payload?.to !== S.myPid || !localStream) return; // serve prima il consenso ai media
    const from = String(payload.from);
    const prev = offerQueue.get(from) || Promise.resolve();
    const next = prev.then(async () => {
      let p = peers.get(from);
      /* ── ⚠️ UNA RIPRESA NON SI SCARTA MAI ────────────────────────────────
         Questa guardia evita di ri-negoziare una connessione che va già bene.
         Ma quando cade la rete di UNO SOLO dei due, l'altro continua a
         leggersi «connected» per un bel po': scartando qui l'offerta di
         ripresa, l'unico tentativo di riparazione moriva in silenzio proprio
         nel caso in cui serviva. Una ripresa arriva dichiarata (`restart`) e
         passa sempre. */
      if (p && p.connectionState === "connected" && !payload?.restart) return;
      if (!p) p = makePeer(from);
      try {
        await p.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await flushIce(from);
        // ⚠️ NIENTE GUARDIE SEVERE SULLO STATO: una versione precedente
        //  rispondeva SOLO se lo stato era esattamente "in attesa di risposta" e
        //  altrimenti saltava del tutto la risposta. In alcune sequenze (proposte
        //  incrociate, riconnessioni) quello stato risulta diverso pur essendo
        //  la risposta ancora necessaria: il risultato era che nessuno rispondeva
        //  e le camere non si vedevano più, da nessuna delle due parti.
        //  Si risponde sempre; se il browser rifiuta, l'errore viene registrato e
        //  il tentativo successivo ci riprova. Lo scopo (non far comparire avvisi
        //  per un rifiuto innocuo) è garantito dal try/catch, non dalle guardie.
        const a = await p.createAnswer();
        await p.setLocalDescription(a);
        send("answer", { from: S.myPid, to: from, sdp: a });
      } catch (e) {
        console.warn(
          "[PEER] proposta di connessione scartata (si ritenta al prossimo giro)",
          from,
          e,
        );
      }
    });
    offerQueue.set(
      from,
      next.catch(() => {
        /* la coda non deve mai rompersi */
      }),
    );
  });
  ch.on("broadcast", { event: "answer" }, async ({ payload }: any) => {
    if (payload?.to !== S.myPid) return;
    const p = peers.get(String(payload.from));
    if (!p || p.signalingState === "stable") return;
    try {
      await p.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      await flushIce(String(payload.from));
    } catch {
      /* */
    }
  });
  // ── SALA D'ATTESA ────────────────────────────────────────────────────────
  ch.on("broadcast", { event: "knock" }, ({ payload }: any) => {
    if (S.role !== "host" || !payload?.pid) return;
    const dev = String(payload.dev || "");
    /*  ── IL NOME DELLA SCHEDA VINCE SU QUELLO DIGITATO ─────────────────
        Chi è entrato scegliendo il proprio nome porta con sé il gettone
        della sua scheda: al consulente si scrive «Anna Verdi», non «anna».
        Se il gettone non è di questa stanza — link inoltrato, gettone
        vecchio — resta quello che ha scritto lui, e `atteso` è falso. */
    const atteso = S.attesi.find((a) => a.gettone === String(payload.persona || "")) ?? null;
    const name = atteso?.nome || String(payload.name || "Cliente");
    /*  ── ⚠️ CHI STA BUSSANDO, E L'HO GIÀ SENTITO? ──────────────────────
        Segnalazione del committente: «gli ospiti sentono un campanello ogni 5
        secondi». Chi aspetta ribussa da solo ogni quattro secondi — serve,
        perché il consulente può arrivare dopo di lui — e qui si decide se è
        una persona nuova (campana) o sempre la stessa (silenzio).
        Il riconoscimento stava in due `if` scritti qui, tutti e due basati sul
        codice del dispositivo: quando quel codice manca — iPhone in
        navigazione privata, archiviazione del sito bloccata — non riconoscevano
        più nessuno, e ogni bussata risultava nuova. La regola adesso sta in
        `shop/bussata`, si prova, e sa cavarsela anche senza dispositivo. */
    const esito = esitoBussata({
      dev,
      pid: payload.pid,
      bloccati: blockedSet(),
      ammessi: ammessiDiQui(),
      inAttesa: S.knocks,
    });
    if (esito === "bloccato") {
      send("deny", { to: payload.pid, reason: "blocked" });
      return;
    }
    // già autorizzato in questa consulenza (ricarica pagina, cambio schermata):
    // non si chiede due volte il permesso per la stessa persona
    if (esito === "giaAmmesso") {
      send("admit", { to: payload.pid, ...(dev ? { dev } : {}) });
      decidiSulServer(String(payload.pid), "ammesso", dev);
      return;
    }
    const list = S.knocks.slice();
    const i = list.findIndex((k) => (dev && k.dev === dev) || k.pid === payload.pid);
    const entry = {
      pid: String(payload.pid),
      name,
      dev,
      at: i >= 0 ? list[i].at : Date.now(),
      atteso: !!atteso,
      ...(atteso ? { leadId: atteso.leadId } : {}),
    };
    /*  ── LA PORTA APERTA RISPONDE PRIMA DEL CONSULENTE ─────────────────
        Nessuna campana e nessun riquadro: entra e basta. L'avviso, se non
        era atteso, lo lascia `entraDallaPortaAperta`. */
    if (S.portaAperta) {
      entraDallaPortaAperta(entry);
      return;
    }
    if (esito === "giaInAttesa") {
      //  Si aggiorna la riga (il nome può essere cambiato) e si tace.
      if (i >= 0) list[i] = entry;
      else list.push(entry);
      set({ knocks: list });
      return;
    }
    if (i >= 0) list[i] = entry;
    //  Nuovo arrivo → campana d'ingresso, volume pieno. ⚠️ Ma solo dove la
    //  richiesta si può anche vedere e accettare (vedi KnockPopup): una
    //  campana sopra il gestionale, senza niente da premere, è un allarme che
    //  non si può spegnere.
    else {
      list.push(entry);
      //  ⚠️ E la campana suona ANCHE sul gestionale: adesso lì la richiesta si
      //   vede (in piccolo), quindi il suono non è più un allarme senza
      //   pulsante — è l'unica cosa che fa alzare gli occhi dallo schermo.
      sfx.knock();
    }
    set({ knocks: list });
  });
  // ── IL PRESENTATORE COMANDA CAMERA E MICROFONO DEL CLIENTE ───────────────
  ch.on("broadcast", { event: "force" }, ({ payload }: any) => {
    if (!isViewer() || payload?.to !== S.myPid) return;
    if (typeof payload.cam === "boolean") {
      /*  ⚠️ SI IMPONE UNO STATO, NON SI INVERTE QUELLO DI ADESSO. Qui c'era
          `toggleCam()`, che è un interruttore: il comando diceva «spenta» e
          l'interruttore faceva «l'opposto di come sta». Finché i due valori
          combaciano non si nota, ma i messaggi di canale arrivano anche
          doppi (riannunci, riconnessioni) e mentre la camera si sta aprendo
          `camOn` non è ancora quello definitivo — e in quei casi il comando
          ACCENDEVA la camera che si voleva spegnere. Con la richiesta scritta
          per esteso, due comandi identici di fila non fanno danno. */
      if (payload.cam !== S.camOn) {
        console.log("[GUEST] camera", payload.cam ? "accesa" : "spenta", "dal presentatore");
        if (S.sharing) {
          set({ camOn: payload.cam });
          sendHello();
        } else if (payload.cam) {
          /*  ── ⚠️ RIACCENDERE PUÒ NON RIUSCIRE, E VA DETTO ─────────────────
              `camAcquire()` è `getUserMedia`: il browser la concede solo se il
              permesso è ancora valido, la camera è libera e — su iPhone —
              spesso solo dopo un tocco della persona. Un comando arrivato dal
              canale non è un tocco. Prima il fallimento veniva inghiottito in
              silenzio (vedi il `catch` di camAcquire): il presentatore premeva
              «accendi», non accadeva nulla, e la conclusione era che il comando
              non funzionasse. È la segnalazione da cui nasce questa riga.
              Ora: se non riesce, l'ospite vede la richiesta con un pulsante (il
              suo dito è ciò che mancava) e il presentatore riceve l'esito. */
          void (async () => {
            const riuscita = await camAcquire();
            set({ camChiestaDalConsulente: !riuscita });
            send("camesito", { from: S.myPid, ok: riuscita });
          })();
        } else void camRelease();
      } else if (payload.cam) {
        //  Già accesa: si conferma, così un avviso rimasto appeso dall'altra
        //  parte si chiude invece di restare lì a dire il falso.
        set({ camChiestaDalConsulente: false });
        send("camesito", { from: S.myPid, ok: true });
      }
      //  Il perché resta scritto: serve alle righe che lo spiegano all'ospite.
      if (S.camSpentaDalConsulente !== !payload.cam) set({ camSpentaDalConsulente: !payload.cam });
      if (!payload.cam && S.camChiestaDalConsulente) set({ camChiestaDalConsulente: false });
    }
    if (typeof payload.mic === "boolean" && payload.mic !== S.micOn) {
      console.log("[GUEST] microfono", payload.mic ? "acceso" : "spento", "dal presentatore");
      setMicOn(payload.mic);
    }
  });
  /*  ── «RIDAMMI IL PERMESSO DI CAMERA E MICROFONO» ────────────────────────
      Richiesta del committente: «quando mi arriva il messaggio che la camera
      dell'utente è spenta, ci sia un pulsante sopra la sua schermata per
      inviare di nuovo la richiesta di accedere a camera e microfono, e
      all'utente arriva di nuovo la notifica dove può autorizzare».

      ⚠️ PERCHÉ NON BASTAVA «ACCENDI LA SUA CAMERA». Quel comando impone uno
       stato, e se lo stato combacia non fa NIENTE: all'ospite che risulta
       già con la camera accesa — mentre il consulente guarda un riquadro
       nero — non compariva nulla da toccare. E il microfono non si poteva
       chiedere affatto. Questa richiesta non impone niente: prova ad aprire
       quello che manca e, se il browser non la lascia fare (è la regola su
       iPhone: ci vuole un dito), mette la notizia davanti all'ospite con il
       pulsante che gliela fa autorizzare.
      ⚠️ SI CHIEDE SOLO QUELLO CHE MANCA: quello che è già aperto non si
       tocca, o si spegnerebbe la camera di chi ce l'ha accesa per rifarla
       accendere a mano. */
  ch.on("broadcast", { event: "chiedimedia" }, ({ payload }: any) => {
    if (!isViewer() || payload?.to !== S.myPid) return;
    const vuoleCam = payload?.cam !== false;
    const vuoleMic = payload?.mic !== false;
    console.log(
      "[GUEST] il consulente richiede",
      vuoleCam ? "camera" : "",
      vuoleMic ? "microfono" : "",
    );
    void (async () => {
      let okCam = true;
      if (vuoleCam) {
        const viva = (localStream?.getVideoTracks() ?? []).some(
          (t) => !isPlaceholder(t) && t.readyState === "live",
        );
        okCam = viva ? true : await camAcquire();
        set({ camChiestaDalConsulente: !okCam, camSpentaDalConsulente: false });
      }
      let okMic = true;
      if (vuoleMic) {
        const vivo = (localStream?.getAudioTracks() ?? []).some(
          (t) => !isPlaceholder(t) && t.readyState === "live" && t.enabled,
        );
        okMic = vivo ? true : await micAcquire();
        if (okMic) setMicOn(true);
        set({ micChiestoDalConsulente: !okMic });
      }
      //  L'esito torna indietro con lo stesso messaggio di sempre: dall'altra
      //  parte c'è già chi lo ascolta e sa che cosa farne.
      send("camesito", { from: S.myPid, ok: okCam && okMic });
    })();
  });
  /*  ── «GIRA LA CAMERA» ARRIVATO DAL CONSULENTE ──────────────────────────
      Il dispositivo dell'ospite fa esattamente quello che farebbe lui
      premendo il pulsante: nessun permesso nuovo da chiedere — la camera è
      già aperta — quindi questo comando riesce anche su iPhone, dove
      accendere una camera spenta vuole un dito.
      ⚠️ SE NON C'È UN'ALTRA CAMERA L'ESITO TORNA INDIETRO: il consulente deve
       sapere che non succede niente perché quel telefono ne ha una sola, non
       perché il comando è rotto. */
  ch.on("broadcast", { event: "giracam" }, ({ payload }: any) => {
    if (!isViewer() || payload?.to !== S.myPid) return;
    void (async () => {
      const e = await giraCamera();
      send("giroesito", { from: S.myPid, ok: e.ok, motivo: e.motivo || "" });
    })();
  });
  /*  L'esito, dalla parte del consulente: si dice soltanto quando è andata
      male, perché quando è andata bene si VEDE — l'immagine cambia. */
  ch.on("broadcast", { event: "giroesito" }, ({ payload }: any) => {
    if (isViewer()) return;
    if (payload?.ok) return;
    const motivo = String(payload?.motivo || "non si è girata");
    console.log("[HOST] la camera dell'ospite non si è girata:", motivo);
    avvisoRegistrazione({
      titolo: "La sua camera non si è girata",
      motivo,
      dettaglio: "Puoi chiedergli di girare il telefono, oppure usare la camera che ha già aperta.",
      tono: "ambra",
    });
  });
  /* ── L'ESITO DEL COMANDO SULLA CAMERA, DI RITORNO ────────────────────────
     Serve a una cosa sola: distinguere «non funziona» da «il suo browser non
     ce l'ha lasciata aprire». Sono due problemi con due rimedi diversi, e
     senza questo messaggio somigliavano allo stesso. */
  ch.on("broadcast", { event: "camesito" }, ({ payload }: any) => {
    if (isViewer()) return;
    const from = String(payload?.from || "");
    if (!from) return;
    if (payload?.ok) {
      if (S.camNegata?.pid === from) set({ camNegata: null });
      return;
    }
    console.log(
      "[HOST] la camera di",
      from,
      "non si è aperta: permesso, camera occupata, o serve un tocco sul suo schermo",
    );
    set({ camNegata: { pid: from, at: Date.now() } });
  });
  /*  ⚠️ «È PER ME» SI DECIDE ANCHE DAL DISPOSITIVO. Il pid è di una pagina:
      se il cliente ha ricaricato mentre il consulente premeva «fai entrare»,
      il via libera porta il pid di prima — e con il solo confronto sul pid
      veniva buttato via, lasciandolo in sala d'attesa con il permesso già
      dato. È la stessa regola che vale da sempre per «mandalo fuori». */
  const perMe = (payload: any): boolean =>
    payload?.to === S.myPid || (!!payload?.dev && payload.dev === myDeviceId());
  ch.on("broadcast", { event: "admit" }, ({ payload }: any) => {
    if (!isViewer() || !perMe(payload)) return;
    void guestEnterApproved();
  });
  ch.on("broadcast", { event: "deny" }, ({ payload }: any) => {
    if (!isViewer() || !perMe(payload)) return;
    if (knockTimer) {
      clearInterval(knockTimer);
      knockTimer = 0;
    }
    set({ knocking: false, refused: true, joined: false });
    console.log("[GUEST] ingresso rifiutato dal presentatore");
  });
  ch.on("broadcast", { event: "ice" }, ({ payload }: any) => {
    if (payload?.to === S.myPid) addIce(String(payload.from), payload.c);
  });
  /* ── «DA TE NON ARRIVA PIÙ NIENTE» ───────────────────────────────────────
     Lo manda chi si accorge che la connessione è caduta ma non può ripararla:
     l'ICE-restart lo fa un lato solo (quello col pid minore, per non incrociare
     due proposte), e se a cadere è la rete dell'altro quel lato non vede niente.
     Senza questo messaggio la riparazione dipendeva da CHI dei due era caduto:
     metà delle volte non arrivava nessuno. */
  ch.on("broadcast", { event: "riprova" }, ({ payload }: any) => {
    if (payload?.to !== S.myPid) return;
    const from = String(payload.from || "");
    if (!from || !(S.myPid < from)) return; // offre sempre e solo il pid minore
    console.log("[PEER] ripresa chiesta da", from);
    void reoffer(from, true);
  });
  ch.subscribe((st) => {
    if (st !== "SUBSCRIBED") return;
    console.log("[GUEST] canale SOTTOSCRITTO", {
      sessionId,
      role: S.role,
      joined: S.joined,
      pid: S.myPid,
    });
    // dopo OGNI (ri)sottoscrizione l'ospite si riannuncia CHIEDENDO risposta:
    // il presentatore rimanda hello + callstate → il roster si ripopola subito.
    if (isViewer()) {
      if (S.joined) sendHello(true);
    } else broadcastState();
  });
  chan = ch;
  // ── DA QUI I SUONI PARTONO ANCHE VERSO IL CLIENTE ────────────────────────
  //  Solo il consulente annuncia: sul dispositivo del cliente il ponte resta
  //  staccato, così un suono non può rimbalzare avanti e indietro.
  /*  ⚠️ OGGI DALL'ALTRA PARTE NON ASCOLTA NESSUNO, ed è bene saperlo prima di
      cercare un suono di troppo sul telefono del cliente: l'evento `sfx` parte
      di qui ma in questo file non c'è nessun `ch.on("broadcast", { event:
      "sfx" })`, e `suonaRemoto` (shop/sfx) non viene mai chiamato. Quindi il
      cliente sente SOLO i suoni della propria pagina.
      Non è una dimenticanza da riparare di corsa: finché si sta cercando da
      dove viene un suono ripetuto sul suo dispositivo, aggiungerne una
      sorgente intera vorrebbe dire cambiare due cose insieme. Per collegarlo
      basta un ascoltatore che chiami `suonaRemoto(payload.n, payload.a)` sul
      solo lato cliente. */
  setSfxBridge(
    isViewer()
      ? null
      : (nome: string, arg?: string) => {
          try {
            ch.send({ type: "broadcast", event: "sfx", payload: { n: nome, a: arg } });
          } catch {
            /* */
          }
        },
  );
}

function teardownMedia(opts?: { keepJoined?: boolean }) {
  stopSpeakingRings();
  const keepJoined = !!opts?.keepJoined && S.role === "viewer" && guestSticky;
  stopUsageTracking(); // salva il consumo dati PRIMA di chiudere le connessioni
  stopPresence();
  stopRecognition();
  stopVAD();
  stopActiveSpeaker();
  //  ⚠️ Anche qui la fine è una fine: senza la bandierina la registrazione
  //   si sarebbe riaperta da sola mentre la consulenza si chiude.
  if (recorder) {
    chiudiRegistrazione?.();
    try {
      recorder.stop();
    } catch {
      /* */
    }
  }
  autoRecStarted = false;
  releaseKeptDisplay();
  peers.forEach((p) => {
    try {
      p.close();
    } catch {
      /* */
    }
  });
  peers.clear();
  remoteStreams.clear();
  pendingIce.clear();
  lastSeen.clear();
  firstSeen.clear();
  badSince.clear();
  deviceOf.clear();
  lastIceRestart.clear();
  stopBlurPipeline(); // canvas + traccia sorgente della sfocatura
  stopMicPipeline(); // grafo audio (soglia di attivazione) + sorgente microfono
  releasePlaceholders(); // tracce segnaposto (nero/silenzio)
  if (micIdleTimer) {
    clearTimeout(micIdleTimer);
    micIdleTimer = null;
  }
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
  emitStreams();
  if (!keepJoined && S.joined) console.log("[GUEST] joined → false (teardown)");
  if (!keepJoined) {
    guestSticky = false;
    guestSawState = false;
    guestLoadedOnce = false;
    guestPageApplied = false;
    guestJoinAt = 0;
    guestServerSeen = false;
    stopGuestReadinessPoll();
  }
  set({
    joined: keepJoined ? S.joined : false,
    connected: false,
    sharing: false,
    recording: false,
    recScreen: false,
    autoRecArmed: false,
    diag: "",
    roster: [],
    focusPid: null,
    speakerPip: false,
    activeSpeakerPid: null,
  });
}

// ── API pubbliche ─────────────────────────────────────────────────────────
/** ── ⚠️ CHI TIENE ALTA LA PRECEDENZA DEL SUO PREVENTIVO ───────────────────
 *  Qui, nel motore, e NON in un componente: vedi il cartello in
 *  shop/mio-preventivo. Gira finché questa scheda è un ospite in una stanza,
 *  attraverso i veli, i cambi di pagina e le riconnessioni — cioè esattamente
 *  i momenti in cui la versione precedente si smontava e lasciava il cliente
 *  in mano al giro che lo fa seguire.
 *  Fa tre cose, in ordine: capisce chi è questo cliente (adottando il nome se
 *  la stanza aspetta una persona sola), legge la regia, e alza o abbassa la
 *  bandierina. Nient'altro: dove portarlo lo decide chi disegna. */
let vigilanza: ReturnType<typeof setInterval> | null = null;
let cambioVisibilitaLegato = false;
let vigilanzaDi = "";
let attesiVisti: { gettone: string; nome: string }[] | null = null;

/** Il consulente ha appena cambiato schermata e l'ha detto sul canale: si
 *  applica subito, senza aspettare il giro. */
function paginaDalCanale(path: string) {
  const code = S.sessionId;
  if (!code || S.role !== "viewer" || !path) return;
  const prima = statoStanzaOra(code);
  pubblicaStatoStanza({
    code,
    path,
    suo: prima?.suo ?? false,
    regia: prima?.regia ?? null,
    gruppo: prima?.gruppo ?? false,
  });
}

async function guardaLaStanza() {
  const code = S.sessionId;
  if (!code || S.role !== "viewer") {
    segnaMioPreventivo(false);
    return;
  }
  try {
    /*  ── ⚠️ CHI SONO ME L'HA DETTO IL LINK ────────────────────────────
        Segnalazione del committente: «quando invio il link alle 3 persone
        della consulenza deve generare un link univoco per ogni persona,
        perché ora mette a tutti lo stesso nome».
        Il link adesso porta il gettone di chi lo riceve (`?chi=…`): si prende
        da lì, una volta, e da quel momento questa scheda SA chi è — senza
        toccare nessun nome alla porta, e anche se in stanza si aspettano in
        tre, cioè proprio il caso in cui non si può indovinare.
        ⚠️ NON SOVRASCRIVE una scelta già fatta su questa scheda: chi ha già
         toccato il proprio nome ha deciso, e un link inoltrato non deve
         cambiargli identità sotto le mani. */
    const dalLink = typeof window !== "undefined" ? gettoneDalLink(window.location.search) : "";
    if (dalLink && !miaPersonaDi(code)) {
      tieniInMemoria(dalLink);
      ricordaPersona(code, dalLink);
      console.log("[OSPITE] riconosciuto dal link:", dalLink);
    }
    let mio = miaPersonaDi(code);
    if (!mio) {
      //  Chi sono, se non l'ho mai detto: una stanza che aspetta una persona
      //  sola non lascia dubbi (vedi `personaDaAdottare`).
      /*  ⚠️ UN ELENCO VUOTO NON SI TIENE IN MEMORIA. Lo si teneva, e con una
          consulenza aperta mandando il link l'elenco è vuoto PROPRIO
          all'inizio: il cliente lo leggeva una volta, si teneva il vuoto per
          sempre e non si riconosceva mai più — nemmeno dopo che il consulente
          l'aveva registrato. Solo una risposta piena è una risposta
          definitiva. */
      if (!attesiVisti || !attesiVisti.length) {
        const j = await fetch(`/api/public/attesi?sess=${encodeURIComponent(code)}`).then((r) =>
          r.json(),
        );
        attesiVisti = j?.ok && Array.isArray(j.attesi) ? j.attesi : [];
      }
      const da = personaDaAdottare("", attesiVisti);
      if (da) {
        adottaPersona(code, da);
        mio = da;
      }
    }
    const j = await fetch(
      `/api/presenter/curpage?sess=${encodeURIComponent(code)}${mio ? `&persona=${encodeURIComponent(mio)}` : ""}`,
      { cache: "no-store" },
    ).then((r) => r.json());
    if (S.sessionId !== code || S.role !== "viewer") return; // cambiata stanza mentre si leggeva
    /*  ⚠️ CHI DECIDE È IL SERVER (`paginaDiQuestoCliente`): qui non si
        ricalcola la precedenza dalla regia, se no tornerebbero due verità —
        ed è la verità del server quella che funziona anche col cliente che non
        sa il proprio nome. */
    const suo = j?.suo === true;
    pubblicaStatoStanza({
      code,
      path: String(j?.path || ""),
      suo,
      regia: j?.regia ? leggiRegia(JSON.stringify(j.regia)) : null,
      gruppo: j?.gruppo === true,
    });
    segnaMioPreventivo(suo);
    /*  Acceso: la modalità torna ai contenuti — se no le facce a schermo pieno
        gli coprirebbero il preventivo. Anche questo sta qui e non in una
        schermata: quando il velo è alzato non c'è nessuna schermata a farlo, e
        il cliente si ritrovava le facce sopra il suo preventivo. */
    if (suo && S.mode !== "content") set({ mode: "content" });
  } catch {
    /*  ⚠️ LA RETE CHE MANCA NON SPEGNE LA PRECEDENZA. Spegnerla qui vorrebbe
        dire che a ogni buco di rete il cliente viene portato via da dove sta
        scrivendo. Si tiene l'ultima risposta buona e si riprova. */
  }
}

/*  ── ⚠️ E OGNI TANTO SI GUARDA SE È RIMASTA A IERI ─────────────────────────
    Vedi il cartello in shop/versione-vecchia: la regola che tiene il cliente
    sul suo preventivo quando il consulente passa alle facce vive QUI, sul suo
    dispositivo — e una scheda aperta prima di un aggiornamento non ce l'ha.
    ⚠️ Mai mentre la videochiamata è in corso: una ricarica lì dentro costa
     qualche secondo di schermo nero, e il consulente ha comunque il pulsante
     per farlo di proposito («Aggiorna il suo schermo»). Qui si rimedia al caso
     tranquillo — il cliente che sta compilando — che è quello che conta. */
/*  ── ⚠️ L'APPLICAZIONE MISURA I PROPRI BLOCCHI ────────────────────────────
    Segnalazione del committente: «va troppo lento, Chrome dice non risponde».
    Da fuori non si indovina: la stessa pagina, aperta e ferma sul sito vero,
    non blocca il thread nemmeno per un millisecondo. Il blocco nasce nella
    sessione VERA — con i dati veri, la camera accesa, la registrazione in
    corso — e lì l'unico che può misurarlo è il programma stesso.
    Costa un osservatore del browser, che gira per conto suo. Vedi
    shop/lentezza: il «che cosa stava facendo» arriva dalle briciole. */
/*  ⚠️ IL MOTORE SI PRESENTA AI PEZZI CHE NON LO IMPORTANO. `shop/live` non
    importa più questo file (se lo facesse, il CRM si porterebbe dietro 254 kB
    di videochiamata: vedi shop/link-ospite): quando il motore c'è, gli lascia
    il filo per annunciare la pagina e per azzerare lo zoom del cliente. */
if (typeof window !== "undefined") {
  registraAnnuncioPagina((path) => annunciaPagina(path));
  registraAzzeraZoom(() => resetOwnZoom());
}

if (typeof window !== "undefined") {
  try {
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (!segnaBlocco(e.duration, performance.now() / 1000)) continue;
        if (e.duration >= 1000)
          console.warn(`[LENTO] bloccato ${Math.round(e.duration)}ms mentre: ${cosaSta()}`);
      }
    }).observe({ type: "longtask", buffered: true });
    //  Una riga da chiedere alla console quando «va lento», senza strumenti.
    (window as unknown as { hgLentezza?: () => string }).hgLentezza = () => inParole();
  } catch {
    /* browser senza osservatore: si resta senza misura, non senza applicazione */
  }
}

const RICARICA_KEY = "hg_ricaricate_per";
/** L'impronta della pubblicazione vista su ogni pagina (vedi `versioneVecchia`). */
const improntaVista = new Map<string, string>();

async function guardaSeSonoVecchio() {
  if (typeof window === "undefined" || S.role !== "viewer" || S.active) return;
  const dove = window.location.pathname;
  try {
    const html = await fetch(dove + window.location.search, { cache: "no-store" }).then((r) =>
      r.ok ? r.text() : "",
    );
    const adesso = improntaDeiProgrammi(programmiDellaPagina(html));
    if (!adesso) return;
    const vista = improntaVista.get(dove) || "";
    //  Prima volta su questa pagina: si prende nota e basta.
    if (!vista) {
      improntaVista.set(dove, adesso);
      return;
    }
    let gia: string[] = [];
    try {
      gia = JSON.parse(sessionStorage.getItem(RICARICA_KEY) || "[]");
    } catch {
      /* */
    }
    const nuova = versioneVecchia({ adesso, vista, giaRicaricate: gia });
    if (!nuova) {
      improntaVista.set(dove, adesso);
      return;
    }
    console.log(
      "[GUEST] pubblicata una versione nuova mentre questa scheda era aperta: mi aggiorno (una volta sola)",
    );
    try {
      sessionStorage.setItem(RICARICA_KEY, JSON.stringify([...gia, nuova].slice(-8)));
    } catch {
      /* */
    }
    window.location.reload();
  } catch {
    /* rete assente: si riprova al prossimo giro */
  }
}

/** Accende o spegne il guardiano. Lo chiama `configureCall`: un ospite in una
 *  stanza ce l'ha sempre, il consulente mai. */
/*  Appena la precedenza cambia, il cliente lo ANNUNCIA: il pannello del
    consulente deve dire la verità entro un istante, non al prossimo giro. */
let lodiceGiaAscoltato = false;
function annunciaLaPrecedenza() {
  if (lodiceGiaAscoltato) return;
  lodiceGiaAscoltato = true;
  ascoltaMioPreventivo(() => {
    if (S.role === "viewer" && S.joined) sendHello();
  });
}

//  Il filo per dire «ho cambiato la regia» (shop/annuncio-regia): lo tiene il
//  motore, che è l'unico ad avere in mano il canale della stanza.
if (typeof window !== "undefined") {
  registraAnnuncioRegia(() => {
    if (S.role === "host") send("regia", { at: Date.now() });
  });
}

function vigilaSulMioPreventivo(code: string, ospite: boolean) {
  if (ospite) annunciaLaPrecedenza();
  if (ospite && vigilanzaDi === code && vigilanza) return;
  if (vigilanza) {
    clearInterval(vigilanza);
    vigilanza = null;
  }
  vigilanzaDi = ospite ? code : "";
  attesiVisti = null; // stanza nuova = elenco nuovo
  dimenticaStatoStanza(); // …e stato nuovo: non si eredita quello di prima
  if (!ospite) {
    segnaMioPreventivo(false);
    return;
  }
  void guardaLaStanza(); // subito: dopo una ricarica non si aspetta il giro
  /*  ── ⚠️ IL RITMO: DUE SECONDI DAVANTI, DIECI DI NASCOSTO ────────────────
      Questo è l'unico giro rimasto al cliente, ed è una RETE DI SICUREZZA:
      le due cose che devono arrivare subito — il cambio di schermata e il
      tocco di un interruttore — viaggiano sul canale della stanza (`pagina` e
      `regia`) e si applicano all'istante, più in fretta di qualunque giro.
      Quindi qui si va piano: cinque secondi con la scheda davanti, quindici
      quando il cliente guarda altrove (appena torna, si guarda subito).
      ⚠️ Ogni giro è una richiesta che si paga: erano 1,2 s per la pagina più
       2 s per la regia più 3 s dalla pagina del preventivo — tre domande per
       cose lette dalla stessa riga. Vedi shop/stato-stanza. */
  let giri = 0;
  const battito = () => {
    void guardaLaStanza();
    //  ⚠️ Ogni 30 giri: chiedere la propria pagina è un viaggio in più, e una
    //   versione nuova non esce due volte al minuto.
    if (++giri % 30 === 0) void guardaSeSonoVecchio();
  };
  const ritmo = () => (typeof document !== "undefined" && document.hidden ? 15_000 : 5000);
  let ritmoOra = ritmo();
  vigilanza = setInterval(battito, ritmoOra);
  if (typeof document !== "undefined" && !cambioVisibilitaLegato) {
    cambioVisibilitaLegato = true;
    document.addEventListener("visibilitychange", () => {
      if (!vigilanza || !vigilanzaDi) return;
      const nuovo = ritmo();
      if (nuovo === ritmoOra) return;
      ritmoOra = nuovo;
      clearInterval(vigilanza);
      vigilanza = setInterval(battito, ritmoOra);
      if (!document.hidden) battito(); // tornato davanti: si guarda subito
    });
  }
}

export function configureCall(sessionId: string, role: Role) {
  // IDEMPOTENTE: se il codice sessione non è CAMBIATO non si ricrea nulla.
  // Ogni re-attach distruggeva peer + roster (resetRoster) e, col polling ogni
  // 2s, bastava a far "cambiare schermata da sola" all'ospite.
  if (S.sessionId === sessionId && S.role === role && chan) return;
  console.log("[GUEST] configureCall", {
    da: S.sessionId,
    a: sessionId,
    role,
    canaleGiaAperto: !!chan,
  });
  /*  ── ⚠️ LE BUSSATE DELLA STANZA DI PRIMA NON SI PORTANO DIETRO ─────────
      Segnalazione del committente: «anche cambiando link continua a dirgli
      sei in attesa». L'elenco di chi bussa restava quello della consulenza
      precedente, e le sue righe portano i pid di ALLORA: premere «fai
      entrare» su una di quelle mandava il via libera a una pagina che non
      esiste più, in una stanza che non è più questa — e il cliente, che nel
      frattempo bussava qui, non riceveva niente. Cambiata stanza, l'elenco
      riparte: chi sta aspettando ribussa da solo ogni quattro secondi. */
  const cambioStanza = !!S.sessionId && S.sessionId !== sessionId;
  set({ sessionId, role, myPid: S.myPid || genPid(), ...(cambioStanza ? { knocks: [] } : {}) });
  attachChannel(sessionId);
  //  La precedenza del suo preventivo vive quanto la scheda, non quanto una
  //  schermata (shop/mio-preventivo).
  vigilaSulMioPreventivo(sessionId, role === "viewer");
  if (role === "host") {
    /*  ⚠️ E SI METTE SUBITO IN ASCOLTO DEL PRIMO TOCCO. L'ascolto che
        risveglia l'audio (`svegliaAlPrimoGesto`) nasce solo quando qualcuno
        chiede il contesto: se nessuno lo chiede, il primo clic del consulente
        passa senza svegliare niente e la registrazione premuta più tardi esce
        muta. Chiamarlo qui, all'apertura della consulenza, vuol dire che
        QUALUNQUE tocco successivo — non solo quello su REC — riporta l'audio
        in funzione. */
    try {
      audioCtx();
    } catch {
      /* browser senza audio: si registra il video */
    }
    void loadBlocked();
    void loadAudioPrefs(); // bloccati + preferenze audio del presentatore
    //  La porta di QUESTA stanza com'era lasciata: una ricarica non deve
    //  richiuderla in faccia a chi sta bussando.
    set({ portaAperta: portaApertaSalvata(sessionId) });
  } else {
    void checkBlockedOnJoin(); // ospite bloccato → schermata dedicata
    // ingresso già concesso in questa scheda? si rientra da soli
    const prev = restoreGuestEntry(sessionId);
    if (prev && !S.joined && !S.kicked) {
      console.log("[GUEST] ingresso ripristinato dopo ricaricamento:", prev.name);
      guestSticky = true;
      set({ myName: prev.name, joined: true, knocking: false, refused: false, sessionLive: true });
      void viewerEnsureMedia();
      sendHello(true);
    }
  }
}

/** Avvia la chiamata. Se il presentatore è già loggato (selezione + PIN) parte SUBITO
 *  col suo nome: nessuna richiesta del nome. Chiede il nome solo se non è loggato. */
/** ── LA CONSULENZA RIPARTE CON UN CODICE NUOVO ─────────────────────────────
 *  Da usare quando il codice sessione cambia MENTRE la chiamata è in corso
 *  ("Ricomincia"). Non si poteva usare `requestStart`: esce alla prima riga se
 *  la chiamata è già attiva, quindi la sessione sul server restava annunciata
 *  col codice VECCHIO — con battito fresco, per giunta. Da lì i due difetti
 *  osservati: chi riceveva il link NUOVO veniva respinto ("invito non attivo")
 *  e chi aveva quello VECCHIO passava, ma su un canale dove non trasmetteva
 *  più nessuno — schermo fermo, "non risponde". */
export function republishSession() {
  if (S.role !== "host") return;
  const codice = readLiveId();
  if (!codice) return;
  S.sessionId = codice;
  setSessionLive(true); // POST {live:true, code: NUOVO} + callstate sul canale nuovo
  broadcastState();
  console.log("[HOST] sessione ripubblicata col codice", codice);
}

export function requestStart() {
  // ── PERCHÉ "VIDEOCHIAMATA" A VOLTE NON PARTIVA ────────────────────────────
  //  Il pulsante fa due cose di fila: crea la sessione e avvia la chiamata.
  //  Ma il motore diventa "presentatore" solo quando si accorge del nuovo codice
  //  di sessione, e quell'avviso può arrivare un istante DOPO il clic. In quel
  //  caso qui si usciva in silenzio — nessun errore, nessuna schermata: il
  //  pulsante sembrava semplicemente non funzionare.
  //  Ora, se il codice sessione c'è ma il ruolo non è ancora impostato, lo si
  //  imposta qui e si prosegue.
  if (S.active) return;
  if (S.role !== "host") {
    const id = readLiveId();
    if (!id) {
      console.warn("[CALL] avvio ignorato: nessun codice sessione disponibile");
      return;
    }
    console.log("[CALL] ruolo presentatore non ancora impostato → lo imposto ora e avvio");
    configureCall(id, "host");
  }
  const p = getPresenter();
  if (p?.name) {
    confirmStart(p.name);
    return;
  }
  set({ pendingStart: true });
}
export function cancelStart() {
  set({ pendingStart: false });
}
/** Conferma il nome del presentatore e avvia la chiamata. */
/** RIPRESA AUTOMATICA dopo un ricaricamento della pagina.
 *  Lo stato della chiamata vive in memoria: qualunque ricaricamento — anche uno
 *  legittimo, come quello che scatta quando è stata pubblicata una versione più
 *  recente mentre stavi cambiando schermata — lo azzerava, e uscivi dalla
 *  chiamata portandoti dietro anche il cliente. La sessione però vive sul
 *  SERVER: se risulta ancora attiva, la chiamata si riprende da sola, senza
 *  chiedere di nuovo nulla (i permessi sono già stati concessi a questo sito).
 *  Non si riarma la registrazione: quella richiede un gesto e non deve mai
 *  aprire finestre da sola. */
export async function resumeCallSilently(presenterName: string) {
  if (S.role !== "host" || S.active) return;
  const name = presenterName.trim() || S.presenterName || "Consulente";
  console.log("[CALL] ripresa automatica dopo ricaricamento");
  //  Avviare la chiamata È una scelta: si parte dalle facce.
  modoScelto = true;
  set({
    pendingStart: false,
    active: true,
    presenterName: name,
    myName: name,
    mode: "call",
    focusPid: null,
  });
  setSessionLive(true);
  broadcastState();
  try {
    const s = await openMedia();
    startVAD(s);
    startPresence();
    startSpeakingRings();
    startUsageTracking();
  } catch (e) {
    console.warn("[CALL] ripresa senza camera/microfono", e);
    set({ diag: "Camera o microfono non disponibili: sei in sola visione." });
  }
}

export async function confirmStart(presenterName: string) {
  if (S.role !== "host") return;
  const name = presenterName.trim() || "Consulente";
  // La chiamata parte in modalità VIDEOCHIAMATA ("call"): il guest riceve subito la
  // griglia delle camere. Poi il presentatore sceglie cosa trasmettere (Solo tu / Solo lui / contenuti).
  // ── PRIMA SI AVVIA LA CHIAMATA, POI SI ARMA LA REGISTRAZIONE ──────────────
  //  Qui la prima cosa era la richiesta di condivisione schermo per la
  //  registrazione automatica. Finché quella finestra restava aperta — o se
  //  veniva annullata — la chiamata NON risultava ancora avviata: premevi
  //  "Videochiamata" e non succedeva niente di visibile. Ora la consulenza parte
  //  subito e la registrazione si arma dopo, come funzione accessoria che non
  //  può più impedire l'avvio.
  /*  ── ⚠️ IL PERMESSO DI REGISTRARE LO SCHERMO SI CHIEDE ADESSO, MA NON SI
         ASPETTA ────────────────────────────────────────────────────────────
      Due vincoli che sembravano incompatibili, e per mesi ha vinto uno solo.
      · `getDisplayMedia` lo concede il browser soltanto DENTRO il gesto, e il
        gesto scade al primo `await`. Chiedendolo in fondo a questa funzione —
        dopo la camera, dopo la rete — veniva negato senza nemmeno mostrare la
        finestra di scelta: da lì il «registra solo la camera del
        presentatore» segnalato dal committente.
      · Ma ASPETTARE quella finestra blocca l'avvio: premi «Videochiamata» e
        non succede niente finché non scegli. Era il motivo per cui l'avevamo
        spostato in fondo.
      La via d'uscita è non scegliere: la richiesta parte QUI, nella prima riga
      utile del gesto, e non la si aspetta. La consulenza si avvia subito sotto
      la finestra di scelta; la risposta si raccoglie in fondo. */
  const armatura = armAutoRecording().catch((e) => {
    console.warn("[REC] registrazione non armata", e);
    return false;
  });
  resetRoster(); // chiamata nuova → lista partecipanti pulita (niente fantasmi della precedente)
  /*  ⚠️ E ANCHE LA REGIA DEI PREVENTIVI RIPARTE PULITA. Segnalazione del
      committente: «parte già da attivo». La regia vive nella stanza, e la
      stanza di un appuntamento è la stessa per tutta la giornata: gli
      interruttori accesi la volta prima erano ancora lì. Avviare la
      consulenza li spegne — non cancella niente, quello che avevano
      compilato resta nella loro stanza e torna appena li riaccendi. */
  void cambiaRegia(readLiveId(), { azzera: true });
  //  ⚠️ Questa è la scheda che CONDUCE: da qui in poi è lei a dire al cliente
  //   che cosa vede, e le altre schede del consulente tacciono su quel punto
  //   (vedi il cartello su `modoScelto`). Il modo NON si tocca — quello resta
  //   il cartello qui sotto — si dichiara solo chi ha il diritto di dirlo.
  modoScelto = true;
  //  LA MODALITÀ SCELTA NON SI TOCCA. Questa riga la riportava a "call" a ogni
  //  ripresa — e la ripresa scatta da sola ogni 5 secondi se la scheda perde
  //  per un istante lo stato attivo. Da fuori sembrava che scorrendo la pagina
  //  la vista tornasse alla videochiamata: in realtà era il ripristino.
  set({
    pendingStart: false,
    active: true,
    presenterName: name,
    myName: name,
    focusPid: S.focusPid,
  });
  setSessionLive(true); // apre la sessione: il guest esce dalla schermata d'attesa
  broadcastState();
  try {
    const s = await openMedia();
    startVAD(s);
    startPresence();
    startSpeakingRings();
    startUsageTracking(); // misura MB consumati da questa chiamata
  } catch (e) {
    //  ⚠️ NON si annulla più la chiamata: senza camera si resta in sola visione
    //  (il cliente vede comunque i contenuti). Prima un permesso negato mandava
    //  tutto indietro e sembrava che il pulsante non funzionasse.
    console.warn("[CALL] camera/microfono non disponibili: proseguo in sola visione", e);
    set({ diag: "Camera o microfono non disponibili: sei in sola visione." });
  }
  //  La risposta alla finestra di scelta, partita in cima: accessoria, mai
  //  bloccante — se l'ha annullata si registrano comunque le camere.
  if (!(await armatura))
    console.warn("[REC] niente cattura schermo: la registrazione automatica userà le camere");
}

/** Il guest inserisce il PROPRIO nome e abilita camera/mic. */
// ── AUDIO SBLOCCATO UNA VOLTA SOLA, ALL'INGRESSO ──────────────────────────
//  I browser consentono di riprodurre audio solo dopo un gesto dell'utente.
//  Finora quel gesto veniva chiesto DI NUOVO al momento del video ("tocca per
//  attivare l'audio"): fastidioso e fuori luogo durante una consulenza.
//  Il tocco su "Entra" È un gesto valido: qui lo si sfrutta per sbloccare la
//  riproduzione audio per tutta la sessione (contesto audio avviato + una
//  riproduzione silenziosa). Da quel momento ogni video parte con l'audio senza
//  chiedere più nulla, e a decidere se il cliente deve sentirlo sei tu.
let audioUnlocked = false;
export function unlockAudioPlayback() {
  if (audioUnlocked || typeof window === "undefined") return;
  audioUnlocked = true;
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      ctx.resume?.().catch(() => {
        /* */
      });
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0; // silenzioso: serve solo a "aprire" l'audio
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.03);
    }
  } catch {
    /* */
  }
  try {
    const a = document.createElement("audio");
    a.muted = true;
    (a as any).playsInline = true;
    a.src = "data:audio/mp4;base64,AAAAHGZ0eXBNNEEgAAAAAE00QSBtcDQyaXNvbQAAAAhmcmVl";
    a.play()
      .then(() => {
        a.pause();
      })
      .catch(() => {
        /* */
      });
  } catch {
    /* */
  }
  console.log("[GUEST] audio sbloccato all'ingresso: nessuna altra conferma verrà chiesta");
}

/** ── ⚠️ PREPARARSI PRIMA, ENTRARE SUBITO ──────────────────────────────────
 *
 *  Segnalazione del committente: «l'ingresso è troppo lento, lo vorrei
 *  istantaneo».
 *
 *  Non era una sensazione. Il cliente che apriva il link prima dell'avvio
 *  vedeva una schermata sola — «la tua videoconsulenza sta per iniziare» — e
 *  non poteva fare NIENTE. Tutto il suo lavoro cominciava dopo:
 *    1. accorgersi che la schermata è cambiata;
 *    2. scrivere il nome;
 *    3. leggere e accettare la richiesta di camera e microfono del browser;
 *    4. bussare e aspettare che il consulente lo faccia entrare;
 *    5. aspettare che la connessione si stabilisca.
 *  I punti 2 e 3 sono i più lenti di tutti — sono umani — e stavano DOPO
 *  l'avvio, con il consulente fermo davanti allo schermo ad aspettare.
 *
 *  Qui si spostano PRIMA. Il cliente scrive il nome e dà i permessi mentre
 *  aspetta; all'avvio bussa da solo, con la camera già accesa e i canali già
 *  aperti. Restano solo i punti 4 e 5, che sono istantanei.
 *
 *  ⚠️ Non entra da solo: BUSSA da solo. La sala d'attesa resta, e a farlo
 *   entrare è sempre il consulente — cambia solo quanto tempo ci mette il
 *   cliente ad arrivare alla porta. */
/** Il cliente si era preparato e la consulenza è appena partita: bussa da
 *  solo, senza aspettare che si accorga del cambio di schermata. */
export function bussaSePronto() {
  if (S.role !== "viewer" || S.kicked || S.joined || S.knocking) return;
  if (!S.pronto || !S.sessionLive) return;
  console.log("[GUEST] era pronto: busso da solo");
  void viewerJoin(S.myName || "Ospite");
}

/** ── DOPO UN «NON ORA», SI PUÒ BUSSARE DI NUOVO ────────────────────────────
 *  La schermata del rifiuto dice «riprova fra poco con lo stesso link», e fino
 *  a ieri era una frase e basta: riaprendo il link il server rispondeva di
 *  nuovo «rifiutato» per mezz'ora (vedi `RIFIUTO_TTL_MS` in shop/sala-attesa)
 *  e il consulente non vedeva nessuna richiesta. Adesso il rifiuto dura due
 *  minuti, e da qui si bussa di nuovo senza nemmeno ricaricare la pagina.
 *  ⚠️ LO PREME UNA PERSONA. Ribussare da soli vorrebbe dire una campana al
 *   consulente ogni due minuti, all'infinito, da parte di chi ha appena
 *   ricevuto un «non ora». */
export function bussaDiNuovo() {
  if (S.role !== "viewer" || S.kicked) return;
  console.log("[GUEST] busso di nuovo dopo il rifiuto");
  set({ refused: false });
  void viewerJoin(S.myName || "Ospite", miaPersona);
}

export async function viewerPrepara(name: string, persona = "") {
  if (persona) {
    tieniInMemoria(persona);
    ricordaPersona(S.sessionId, persona);
  }
  if (S.role !== "viewer" || S.kicked) return;
  const nm = name.trim() || "Ospite";
  set({ myName: nm, pronto: true });
  //  Il nome resta scritto: se ricarica la pagina durante l'attesa non deve
  //  riscriverlo, e la preparazione non va persa.
  try {
    sessionStorage.setItem(
      "hg_guest_pronto",
      JSON.stringify({ code: S.sessionId || "", name: nm }),
    );
  } catch {
    /* */
  }
  //  I due lavori lenti, fatti adesso: il permesso del browser e i server di
  //  passaggio della connessione. Se il permesso viene negato non è un
  //  errore: si entrerà lo stesso, senza camera.
  void prefetchIce();
  /*  ── ⚠️ SI CHIEDE IL PERMESSO, NON SI ACCENDE LA CAMERA ────────────────
      Qui si potrebbe aprire direttamente i media e tenerli pronti. Non si fa:
      vorrebbe dire lasciare la spia della camera accesa su una persona che
      sta solo aspettando, davanti a una schermata che non le mostra
      nemmeno sé stessa. Si chiede il permesso e si spegne subito: il
      permesso resta dato, e all'avvio la camera si apre senza chiedere
      niente — che è tutto il tempo che si voleva risparmiare. */
  try {
    const prova = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    prova.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        /* */
      }
    });
  } catch (e) {
    console.warn(
      "[GUEST] camera e microfono non concessi in preparazione (si entrerà lo stesso)",
      e,
    );
  }
  //  La consulenza potrebbe essersi avviata proprio mentre dava i permessi.
  if (S.sessionLive && !S.joined) void viewerJoin(nm);
}

/** Il nome dato in preparazione, se questa scheda ne ha uno per questa stanza. */
export function nomePreparato(code: string | null): string {
  try {
    const j = JSON.parse(sessionStorage.getItem("hg_guest_pronto") || "null") as {
      code?: string;
      name?: string;
    } | null;
    return j && (!j.code || !code || j.code === code) ? String(j.name || "") : "";
  } catch {
    return "";
  }
}

/** Il gettone della persona scelta all'ingresso (crm/fascia-consulenza), se
 *  questa consulenza aveva un elenco di attesi. Viaggia con ogni bussata: è
 *  quello che fa scrivere al consulente il nome della SCHEDA invece di quello
 *  digitato al volo. */
const miaPersona = "";

/** ── IL GETTONE È IN shop/gettone-cliente ─────────────────────────────────
 *  Stava qui dentro, e per leggerlo `shop/live` doveva importare tutto il
 *  motore: siccome il CRM importa `shop/live` (per fare il link di un
 *  preventivo), aprire il CRM voleva dire scaricare e interpretare 254 kB di
 *  videochiamata per due righe di `sessionStorage`. Misurato. Le funzioni sono
 *  le stesse — `miaPersonaDi`, `ricordaPersona` — solo in un posto che non si
 *  porta dietro niente. Vedi shop/link-ospite.
 *  ⚠️ `miaPersona` (il gettone tenuto in memoria per la durata della scheda)
 *   si legge con `gettoneInMemoria()` e si scrive con `tieniInMemoria()`. */

/** ── SI ADOTTA IL NOME DELLA STANZA ───────────────────────────────────────
 *  Il cliente è entrato senza gettone (link inoltrato, nome digitato, oppure
 *  l'elenco degli attesi è arrivato dopo di lui) ma la stanza aspetta UNA
 *  persona sola: quella persona è lui. Vedi `personaDaAdottare`.
 *  ⚠️ Si RIANNUNCIA subito (`sendHello`): il consulente aveva già la sua riga
 *   in elenco senza scheda collegata, ed è quella riga che fa scrivere al
 *   pannello «acceso, ma lui non è dentro». */
export function adottaPersona(code: string | null | undefined, g: string) {
  if (!g || gettoneInMemoria()) return;
  tieniInMemoria(g);
  ricordaPersona(code, g);
  console.log("[GUEST] una persona sola attesa in questa stanza: sono io", g);
  if (S.joined) sendHello();
}

/** ── CHI È QUESTO CLIENTE, PRENDENDO TUTTO QUELLO CHE C'È ─────────────────
 *  Nell'ordine: quello che ha dichiarato alla porta (memoria della scheda) e,
 *  se non c'è, quello che il SERVER gli ha messo nell'indirizzo portandolo sul
 *  suo preventivo (vedi `paginaDiQuestoCliente`). Il secondo caso è il cliente
 *  che non si è mai ricaricato, o che è arrivato da un link inoltrato: senza
 *  questa riga arriverebbe sulla pagina giusta ma nella stanza del preventivo
 *  comune — vuota — mentre il consulente lavora nella sua.
 *  ⚠️ Il gettone non è una chiave: dice «quale preventivo di questa stanza», e
 *   alla porta chiunque poteva già toccare il nome di chiunque. */
export function gettoneDiQuestoCliente(code: string | null | undefined): string {
  const mio = miaPersonaDi(code);
  if (mio) return mio;
  if (typeof window === "undefined") return "";
  const grezzo = new URLSearchParams(window.location.search).get("persona") || "";
  const g = grezzo
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 16);
  if (!g) return "";
  adottaPersona(code, g);
  return g;
}

export async function viewerJoin(name: string, persona = "") {
  if (persona) {
    tieniInMemoria(persona);
    ricordaPersona(S.sessionId, persona);
  }
  console.log("[GUEST] viewerJoin start", {
    role: S.role,
    active: S.active,
    kicked: S.kicked,
    name,
  });
  if (S.role !== "viewer" || S.kicked) {
    console.warn("[GUEST] viewerJoin ignorato (ruolo/kick)");
    return;
  }
  // ── L'INGRESSO NON DIPENDE MAI DAI MEDIA ────────────────────────────────
  //  Prima si entra (joined = true → il gate si apre e i contenuti compaiono),
  //  POI si prova ad aprire camera/microfono. Se getUserMedia viene negato,
  //  fallisce o resta appeso (permessi mai risolti, nessun device, iOS in
  //  background) l'ospite NON deve restare intrappolato sulla schermata nome:
  //  era esattamente questo il blocco (await openMedia() prima di joined).
  guestSticky = true; // da qui in poi NIENTE può rimandarlo in attesa/gate nome
  unlockAudioPlayback(); // il tocco su "Entra" è l'unico gesto che serve (vedi sotto)
  primeSfx();
  const nm = name.trim() || "Ospite";
  // ── SI BUSSA, NON SI ENTRA ───────────────────────────────────────────────
  //  L'ingresso lo autorizza il presentatore: fino ad allora il cliente resta
  //  sulla sala d'attesa e non vede alcun contenuto.
  set({ myName: nm, sessionLive: true, knocking: true, refused: false });
  /*  ── SI BUSSA DA DUE PARTI ──────────────────────────────────────────────
      Segnalazione del committente: «quando una persona entra rimane in attesa
      e non entra mai».
      Sul canale (istantaneo, quando il filo c'è) e sul server (qualche secondo,
      ma non cade). Se una delle due strade tace, il cliente entra lo stesso —
      prima bastava che tacesse quella per lasciarlo fuori per sempre. */
  const bussaOra = () => {
    send("knock", { pid: S.myPid, name: S.myName || nm, dev: myDeviceId(), persona: miaPersona });
    void bussaSulServer().then((stato) => {
      if (S.joined || S.refused || !S.knocking) return;
      //  ⚠️ «sconosciuto» non è un rifiuto: vuol dire che di noi non si sa
      //   ancora niente, e si continua a bussare.
      if (stato === "ammesso") {
        console.log("[GUEST] via libera trovato sul server (il canale non l'aveva portato)");
        void guestEnterApproved();
      } else if (stato === "rifiutato") {
        if (knockTimer) {
          clearInterval(knockTimer);
          knockTimer = 0;
        }
        set({ knocking: false, refused: true, joined: false });
      }
    });
  };
  bussaOra();
  knockTimer = window.setInterval(() => {
    if (S.joined || S.refused || !S.knocking) {
      if (knockTimer) {
        clearInterval(knockTimer);
        knockTimer = 0;
      }
      return;
    }
    bussaOra(); // il presentatore potrebbe essere arrivato dopo
  }, 4000);
  return;
}

/** Suono discreto quando qualcuno bussa: due note brevi, generate al volo
 *  (nessun file da caricare, nessuna dipendenza). Serve ad accorgersi che il
 *  cliente è in sala d'attesa anche guardando altrove. */

const GUEST_SESSION_KEY = "hg_guest_session";
/** ── L'INGRESSO DEL CLIENTE SOPRAVVIVE A UN RICARICAMENTO ──────────────────
 *  Finora "sono entrato" viveva solo in memoria: qualunque ricaricamento della
 *  pagina — un cambio di schermata andato storto, una versione appena
 *  pubblicata, un errore recuperato — riportava il cliente alla richiesta del
 *  nome o alla sala d'attesa. Dal suo punto di vista: era stato scollegato.
 *  Ora l'ingresso viene ricordato per la durata della scheda e ripristinato da
 *  solo, senza chiedergli di nuovo il nome né di ribussare. */
function rememberGuestEntry() {
  try {
    sessionStorage.setItem(
      GUEST_SESSION_KEY,
      JSON.stringify({
        code: S.sessionId || "",
        name: S.myName || "",
        at: Date.now(),
      }),
    );
  } catch {
    /* */
  }
}
function restoreGuestEntry(code: string): { name: string } | null {
  try {
    const raw = sessionStorage.getItem(GUEST_SESSION_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw) as { code?: string; name?: string; at?: number };
    if (!j?.code || j.code !== code) return null; // altra consulenza
    if (!j.at || Date.now() - j.at > 6 * 60 * 60 * 1000) return null; // troppo vecchia
    return { name: String(j.name || "Ospite") };
  } catch {
    return null;
  }
}
export function forgetGuestEntry() {
  try {
    sessionStorage.removeItem(GUEST_SESSION_KEY);
  } catch {
    /* */
  }
}

let knockTimer = 0;
/** Il presentatore ha autorizzato: da qui in poi è l'ingresso vero. */
async function guestEnterApproved() {
  if (knockTimer) {
    clearInterval(knockTimer);
    knockTimer = 0;
  }
  if (S.joined) return;
  set({ joined: true, knocking: false, refused: false, sessionLive: true });
  guestSticky = true;
  rememberGuestEntry(); // così un ricaricamento non lo butta fuori
  sfx.joined(); // "sei dentro": l'accordo lo dice senza guardare
  console.log("[GUEST] ingresso AUTORIZZATO dal presentatore");
  /*  ── ⚠️ «SONO QUI» NON DIPENDE DALLA CAMERA ─────────────────────────────
      Bug trovato provandolo in locale, con il pannello aperto: il cliente
      entra, viene ammesso, e il pannello del consulente continua a dire «non
      entrato». Nel registro del consulente la riga era una sola:
          [PEER] close 2tn90etq reason=no-hello
      L'annuncio periodico («sono ancora qui», ogni 3 s) partiva solo dentro
      `startPresence()`, che veniva chiamata SOLO dopo aver aperto camera e
      microfono. Ma in una consulenza che condivide contenuti la camera non si
      apre affatto (`if (!S.active) return`, la riga qui sotto), e allora il
      cliente salutava una volta sola: dopo dieci secondi il consulente lo
      buttava fuori dall'elenco come fantasma.
      Da lì tutto quello che il committente ha visto: «Daniele Francesco
      Ferlazzo · non ancora» mentre Daniele era collegato e guardava, e il
      pannello che non offriva nemmeno il rimedio.
      Annunciarsi è una cosa che si fa perché si è ENTRATI, non perché si ha
      una camera: e siccome si può essere in consulenza senza camera (permesso
      negato, telefono senza camera, sola visione) deve stare prima di tutto
      il resto. */
  startPresence();
  if (!S.active) return; // solo contenuti condivisi: i media si apriranno all'avvio chiamata
  try {
    await openMedia();
    attachLocalMediaToPeers("ingresso autorizzato");
    startSpeakingRings();
    console.log("[GUEST] media ok (camera/microfono attivi)");
  } catch (e) {
    console.warn("[GUEST] media NON disponibili: resto in sola visione", e);
    set({ diag: "Camera/microfono non disponibili: sei in sola visione." });
  }
}
/** Apre camera/mic per un ospite già entrato (col solo nome) quando la chiamata parte. */
async function viewerEnsureMedia() {
  if (S.role !== "viewer" || S.kicked || !S.joined || localStream) return;
  //  ⚠️ Anche qui l'annuncio viene PRIMA dei media, e resta anche se i media
  //   non si aprono: vedi il cartello in `guestEnterApproved`. Con la camera
  //   negata questa riga era l'unica differenza fra «in linea» e «non
  //   entrato» sul pannello del consulente.
  startPresence();
  try {
    await openMedia();
    attachLocalMediaToPeers("chiamata avviata");
    startSpeakingRings();
    console.log("[GUEST] media aperti all'avvio chiamata");
  } catch (e) {
    console.warn("[GUEST] media non disponibili", e);
  }
}

export function endCall() {
  stopAutoRecording(); // chiusura chiamata → registrazione finalizzata e schermo rilasciato
  // `role` nel congedo: l'ospite deve capire SUBITO che se n'è andato il
  // presentatore (non un altro partecipante) e tornare alla schermata d'attesa,
  // invece di restare in una chiamata senza nessuno dall'altra parte.
  send("bye", { pid: S.myPid, role: S.role });
  if (S.role === "host") {
    setSessionLive(false); // → callstate con `ended: true` (l'ospite torna in attesa)
    set({ active: false });
  }
  // ── PERCHÉ L'OSPITE CI METTEVA ~30 SECONDI ────────────────────────────────
  //  I messaggi di chiusura vengono messi in coda sul canale realtime, ma
  //  `teardownMedia()` partiva NELLO STESSO ISTANTE e smontava tutto prima che
  //  la coda venisse svuotata: l'annuncio non partiva. All'ospite non restava
  //  che accorgersene dal server — e a chiamata avviata lui interroga il server
  //  ogni 16 secondi, con in più tre letture di conferma. Da lì i ~30 secondi.
  //  Ora si lascia il tempo di partire (e si ripete l'annuncio una seconda
  //  volta, per sicurezza), POI si smonta.
  if (S.role === "host") {
    window.setTimeout(() => {
      try {
        send("callstate", { active: false, sessionLive: false, ended: true });
      } catch {
        /* */
      }
    }, 120);
  }
  window.setTimeout(() => teardownMedia(), 320);
}

// ── BATTITO DELLA CHIAMATA (giudice: il SERVER) ───────────────────────────
//  Finché il presentatore è davvero in videochiamata aggiorna `hb` sul server.
//  Se la scheda viene chiusa senza premere Termina il battito si ferma: la
//  sessione resta solo "riprendibile" e l'ospite torna in attesa (regola chiara).
let hbTimer: ReturnType<typeof setInterval> | null = null;
function pushHeartbeat() {
  /*  ── ⚠️ IL BATTITO DICE «CI SONO», NON «SONO IN VIDEOCHIAMATA» ─────────
      Segnalazione del committente: «l'utente non riesce a entrare, fa entra
      ed esci; accetto più volte e non va».
      Era questa riga. Il battito partiva solo con la VIDEOCHIAMATA attiva —
      ma una consulenza comincia quasi sempre prima, con i contenuti
      condivisi e la chiamata non ancora avviata. In quei minuti il battito
      non partiva, dopo 25 secondi il server dichiarava la sessione non più
      viva, e il cliente — che era entrato — veniva rimandato alla schermata
      d'attesa. Lui ribussava, tu accettavi, e dopo mezzo minuto usciva di
      nuovo: «entra ed esci».
      Il battito adesso vale per tutta la sessione aperta, e dice a parte se
      la videochiamata è attiva: sono due informazioni diverse, e tenerle
      insieme faceva sparire il cliente. */
  if (S.role !== "host" || !S.sessionLive) return;
  fetch("/api/presenter/session", {
    //  Il battito è di QUESTA consulenza: senza codice teneva viva la riga
    //  condivisa e lasciava credere viva la sessione di un altro.
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hbOnly: true, code: S.sessionId || readLiveId(), inChiamata: S.active }),
  }).catch(() => {});
}
if (typeof window !== "undefined" && !hbTimer) hbTimer = setInterval(pushHeartbeat, 8000);
/*  ── ⚠️ E QUANDO LA SCHEDA TORNA DAVANTI, SI BATTE SUBITO ──────────────────
    In una scheda nascosta i browser rallentano `setInterval` fino a uno al
    minuto: il battito che qui sopra è di otto secondi diventa di sessanta, e
    il cliente — dall'altra parte — si vedeva comparire la schermata d'attesa
    mentre stava parlando con te. Succede tutte le volte che si passa a
    un'altra scheda per guardare il CRM o per scrivere su WhatsApp.
    Due mezze misure, insieme: il battito parte SUBITO quando la scheda torna
    davanti (così il ritardo non si somma al primo intervallo), e il server
    aspetta più a lungo prima di dichiarare morta una consulenza (vedi
    HB_MAX_MS in routes/api.presenter.session). Nessuna delle due da sola
    basta: la prima non copre i minuti in secondo piano, la seconda non
    accorcia il rientro. */
if (typeof document !== "undefined")
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pushHeartbeat();
  });

/** ── LA SALA D'ATTESA PASSA ANCHE DAL SERVER ──────────────────────────────
 *
 *  Segnalazione del committente: «quando una persona entra rimane in attesa e
 *  non entra mai».
 *
 *  La porta d'ingresso — «busso», «ti faccio entrare» — viaggiava SOLO sul
 *  canale in tempo reale, e l'elenco di chi aspetta viveva SOLO nella memoria
 *  della scheda del consulente. Basta che uno dei due capi di quel filo non
 *  risponda e il cliente resta fuori senza che nessuno lo sappia: il canale che
 *  non si apre (rete mobile, wifi che chiude i websocket), il telefono che
 *  mette in pausa la scheda, la pagina del consulente ricaricata — e con lei
 *  l'elenco — oppure il consulente che sta su un'altra pagina.
 *
 *  Adesso le stesse due mosse passano anche per il server (shop/sala-attesa):
 *  il canale resta la via veloce, questa è quella che non cade. Chi bussa si
 *  scrive; il consulente legge; la decisione si scrive nella stessa riga e il
 *  cliente la rilegge. Qualche secondo invece di un istante, ma succede.
 *
 *  ⚠️ NON SOSTITUISCE IL CANALE, GLI STA ACCANTO: quando il filo c'è, tutto
 *   avviene in tempo reale come prima e questo giro non fa che confermare.
 *  ⚠️ TUTTO IDEMPOTENTE: bussare due volte è bussare; far entrare due volte è
 *   far entrare. Le due strade si sovrappongono di continuo e non devono
 *   potersi dare fastidio. */
/*  ⚠️ OTTO SECONDI, NON QUATTRO. Questo giro è la RETE DI SICUREZZA: quando il
    filo c'è, la bussata arriva sul canale all'istante e il cliente entra
    subito. Quattro secondi volevano dire 900 richieste l'ora su OGNI scheda
    del consulente aperta tutto il giorno, per una stanza in cui quasi sempre
    non bussa nessuno — ed è una delle voci che il 27/09/2026 hanno portato il
    sito a sbattere contro il tetto giornaliero del piano («Error 1027»).
    ⚠️ Se un giorno il canale dovesse tacere, il peggio che può succedere è
     che chi bussa aspetti qualche secondo in più: il cliente ribussa da solo,
     e tutto è idempotente. */
const SALA_OGNI_MS = 8000;

/** Il cliente si annuncia (o richiede com'è andata). Torna lo stato deciso dal
 *  consulente, «sconosciuto» se di lui non si sa ancora niente. */
async function bussaSulServer(): Promise<StatoAttesa | "sconosciuto" | ""> {
  const sess = S.sessionId;
  if (!sess || !S.myPid) return "";
  try {
    const r = await fetch("/api/public/sala-attesa", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sess,
        pid: S.myPid,
        nome: S.myName || "Ospite",
        dev: myDeviceId(),
        persona: miaPersona,
      }),
    });
    const j = (await r.json()) as { ok?: boolean; stato?: string };
    return j?.ok ? ((j.stato as StatoAttesa) ?? "sconosciuto") : "";
  } catch {
    //  Rete assente: si riproverà fra quattro secondi. Il canale intanto fa la
    //  sua parte, ed è questo il senso di avere due strade.
    return "";
  }
}

/** Il consulente scrive la decisione dove il cliente può leggerla anche se il
 *  canale non gliel'ha portata. Non si aspetta la risposta: il via libera sul
 *  canale è già partito. */
function decidiSulServer(pid: string, stato: StatoAttesa, dev = "", ritenta = true) {
  const sess = S.sessionId;
  if (!sess || (!pid && !dev)) return;
  void fetch("/api/presenter/sala-attesa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    //  ⚠️ Il dispositivo posa la decisione sulla PERSONA: il pid può essere
    //   quello di una pagina che il cliente ha già ricaricato (vedi `decidi`).
    body: JSON.stringify({ sess, pid, stato, ...(dev ? { dev } : {}) }),
  })
    /*  ── ⚠️ E SI GUARDA SE È ANDATA ────────────────────────────────────────
        Era una scrittura buttata via: nessuno leggeva la risposta. Se falliva
        — rete che fa i capricci, sessione del consulente scaduta (401) — il
        via libera non arrivava al server, il riquadro spariva dall'elenco e il
        consulente restava convinto di aver fatto entrare qualcuno che invece
        era ancora alla porta. Un secondo tentativo dopo due secondi copre il
        caso vero (una richiesta sfortunata); se fallisce anche quello resta
        scritto in chiaro nella console, e il giro della sala d'attesa
        continua a rimandarlo da sé ogni otto secondi. */
    .then((r) => {
      if (r.ok || !ritenta) {
        if (!r.ok)
          console.error("[HOST] la decisione non è arrivata al server:", r.status, pid, stato);
        return;
      }
      window.setTimeout(() => decidiSulServer(pid, stato, dev, false), 2000);
    })
    .catch(() => {
      if (ritenta) window.setTimeout(() => decidiSulServer(pid, stato, dev, false), 2000);
    });
}

/** ── IL CONSULENTE LEGGE CHI STA ASPETTANDO ───────────────────────────────
 *  Gira finché questa scheda è padrona di casa. Aggiunge alle bussate SOLO chi
 *  non c'è già: la riga del server e il canale portano le stesse persone, e
 *  l'elenco a schermo non deve sdoppiarsi.
 *  ⚠️ CHI È GIÀ STATO FATTO ENTRARE NON TORNA IN ELENCO: se il suo via libera
 *   si è perso per strada glielo si rimanda, in silenzio. */
let salaInCorso = false;
async function leggiSalaDAttesa() {
  //  ⚠️ SOLO A CONSULENZA APERTA: senza, questa lettura girerebbe ogni quattro
  //   secondi su ogni scheda del consulente per tutta la giornata, per una
  //   stanza in cui nessuno può bussare (il cliente entra in sala d'attesa solo
  //   se la consulenza è viva). Se la scheda si è appena ricaricata e non lo sa
  //   ancora, se ne accorge in pochi secondi (riprendiConsulenzaAperta) e chi
  //   aspetta ribussa comunque ogni quattro secondi.
  if (S.role !== "host" || !S.sessionLive || salaInCorso) return;
  const sess = S.sessionId;
  if (!sess) return;
  salaInCorso = true;
  staFacendo("giro della sala d'attesa");
  try {
    const r = await fetch(`/api/presenter/sala-attesa?sess=${encodeURIComponent(sess)}`);
    if (!r.ok) return;
    const j = (await r.json()) as {
      ok?: boolean;
      attesa?: {
        pid: string;
        nome: string;
        dev?: string;
        at: number;
        atteso?: boolean;
        leadId?: string;
      }[];
      attesi?: { gettone: string; nome: string; leadId: string }[];
    };
    if (!j?.ok || !Array.isArray(j.attesa) || S.role !== "host") return;
    //  Chi era atteso in questa stanza: serve al canale, che arriva prima di
    //  questa lettura e da solo saprebbe solo il nome digitato.
    if (Array.isArray(j.attesi) && firmaDegliAttesi(j.attesi) !== firmaDegliAttesi(S.attesi)) {
      set({ attesi: j.attesi });
      ribattezzaConGliAttesi();
    }
    const nuove = S.knocks.slice();
    let cambiato = false;
    for (const p of j.attesa) {
      const pid = String(p.pid || "");
      if (!pid) continue;
      const dev = String(p.dev || "");
      //  Già ammesso qui dentro: il via libera non è arrivato a destinazione.
      //  Si rimanda, e non lo si rimette in elenco.
      if (ammessiDiQui().has(chiaveBussata(dev, pid))) {
        //  ⚠️ Anche qui il dispositivo: è il rimando del via libera a chi non
        //   l'ha ricevuto, e senza di quello ricade nello stesso guasto che
        //   sta rimediando (vedi `admitGuest`).
        send("admit", { to: pid, ...(dev ? { dev } : {}) });
        decidiSulServer(pid, "ammesso", dev);
        continue;
      }
      const voce = {
        pid,
        name: String(p.nome || "Ospite"),
        dev,
        at: Number(p.at) || Date.now(),
        atteso: !!p.atteso,
        ...(p.leadId ? { leadId: String(p.leadId) } : {}),
      };
      const i = nuove.findIndex((k) => k.pid === pid || (dev && k.dev === dev));
      if (i >= 0) {
        /*  ── IL NOME VERO ARRIVA DI QUI ─────────────────────────────────
            Sul canale la bussata può portare un gettone che questa scheda
            non aveva ancora (elenco letto dopo, o pagina ricaricata): lì il
            nome resta quello digitato. Questa lettura sa chi è davvero, e
            corregge la riga invece di saltarla. */
        /*  ── ⚠️ E ARRIVA ANCHE IL PID DI ADESSO ────────────────────────
            Segnalazione del committente: «li accetto e continua a dirgli sei
            in attesa». Questa riga teneva il pid vecchio: il cliente aveva
            ricaricato (pid nuovo, stesso dispositivo) e il consulente
            premeva «fai entrare» su una pagina che non c'era più. Il pid che
            arriva di qui è il più fresco che esista — l'ha scritto il
            cliente stesso pochi secondi fa, nella riga della stanza. */
        if (
          nuove[i].pid !== pid ||
          nuove[i].name !== voce.name ||
          nuove[i].atteso !== voce.atteso
        ) {
          nuove[i] = {
            ...nuove[i],
            pid,
            name: voce.name,
            atteso: voce.atteso,
            ...(voce.leadId ? { leadId: voce.leadId } : {}),
          };
          cambiato = true;
        }
        continue;
      }
      //  Porta aperta: entra senza passare dall'elenco, anche se la sua
      //  bussata è arrivata solo dal server (canale muto).
      if (S.portaAperta) {
        entraDallaPortaAperta(voce);
        continue;
      }
      nuove.push(voce);
      cambiato = true;
      console.log("[HOST] bussata arrivata dal server (canale muto?):", pid, voce.name);
      sfx.knock();
    }
    if (cambiato) set({ knocks: nuove });
  } catch {
    /* rete: si riprova al giro dopo */
  } finally {
    salaInCorso = false;
    //  La briciola si toglie: se restasse, un blocco successivo verrebbe
    //  attribuito a un lavoro che è già finito. Vedi shop/lentezza.
    staFacendo("fermo");
  }
}
if (typeof window !== "undefined")
  setInterval(() => {
    void leggiSalaDAttesa();
  }, SALA_OGNI_MS);

/** ── MI RIPRENDO LA CONSULENZA CHE È ANCORA MIA ────────────────────────────
 *
 *  Segnalazione del committente: «quando entrano le persone non li ammette».
 *
 *  Il battito qui sopra parte solo a sessione aperta (`S.sessionLive`), e quella
 *  variabile muore a ogni caricamento di pagina — una ricarica, un link aperto
 *  sopra, un aggiornamento pubblicato — mentre sul server la riga della
 *  consulenza resta `live: true`. Dopo settanta secondi il server la dichiarava
 *  morta, e il cliente che apriva il suo link restava su «In attesa che il
 *  consulente avvii la sessione»: non gli si negava l'ingresso, non poteva
 *  nemmeno BUSSARE. (Misurato: battito fermo alle 19:01:51, ore 19:08, la riga
 *  ancora `live: true` e `callActive: false`.)
 *
 *  Qui la postazione se ne accorge e riapre la stanza da sola: la regola di
 *  quando si può fare — è mia? è di poco fa? — sta in shop/consulenza-aperta e
 *  si prova senza browser.
 *
 *  ⚠️ NON SI AVVIA NIENTE: si riaccende la sessione (la porta) e si ribatte. La
 *   videochiamata la avvia una persona, e PresenterBar lo fa da sé quando il
 *   server dice `inChiamata`.
 *  ⚠️ UN TENTATIVO OGNI DIECI SECONDI, e mai due insieme: questo giro parte
 *   dall'orologio che ricontrolla la diretta ogni due secondi, e senza freno
 *   sarebbero trenta richieste al minuto per una risposta che non cambia. */
let ripresaInCorso = false;
let ripresaUltimoTentativo = 0;
/** Letture di fila in cui il server ha detto «questa consulenza non è viva».
 *  Serve a non chiudere per un buco di rete: vedi `siChiudeLaConsulenza`. */
let chiusureDiFila = 0;

/** ── LA CONSULENZA È FINITA ALTROVE ───────────────────────────────────────
 *  La chiude chi la chiude — magari da un'altra scheda, o dal telefono — e
 *  questa deve accorgersene: se no resta a mostrare il pannello del gruppo col
 *  nome del cliente dentro, che è la segnalazione «c'è sempre questo aperto
 *  anche se non ho Meetly aperto». Vedi il cartello di `siChiudeLaConsulenza`. */
let ultimoControlloChiusura = 0;
async function controllaSeChiusaAltrove() {
  if (S.role !== "host" || !S.sessionLive) {
    chiusureDiFila = 0;
    return;
  }
  const codice = S.sessionId || readLiveId();
  if (!codice) return;
  /*  ⚠️ OGNI QUINDICI SECONDI, NON OGNI GIRO. Chi chiama questa funzione gira
      ogni due secondi: chiedere al server a quel ritmo sarebbe 1.800 richieste
      l'ora per ogni scheda del consulente aperta, cioè il contrario di quello
      che si è appena fatto (vedi shop/stato-stanza, il fermo per i limiti del
      piano). Con due letture negative di fila il pannello sparisce entro
      mezzo minuto, che per una consulenza già chiusa va benissimo. */
  const ora = Date.now();
  if (ora - ultimoControlloChiusura < 15_000) return;
  ultimoControlloChiusura = ora;
  try {
    const r = await fetch(`/api/presenter/session?sess=${encodeURIComponent(codice)}`, {
      cache: "no-store",
    });
    const j = (await r.json()) as RigaConsulenza;
    chiusureDiFila = j?.live === true ? 0 : chiusureDiFila + 1;
    if (!siChiudeLaConsulenza({ riga: j, mioCodice: codice, negativeDiFila: chiusureDiFila }))
      return;
    console.log("[HOST] la consulenza non è più aperta sul server: chiudo anche qui");
    chiusureDiFila = 0;
    set({ sessionLive: false });
  } catch {
    /* rete: non si conclude niente, si riprova al giro dopo */
  }
}

async function riprendiConsulenzaAperta() {
  if (S.role !== "host" || S.sessionLive) {
    void controllaSeChiusaAltrove();
    return;
  }
  const codice = S.sessionId || readLiveId();
  if (!codice) return;
  const ora = Date.now();
  if (ripresaInCorso || ora - ripresaUltimoTentativo < 10_000) return;
  ripresaInCorso = true;
  ripresaUltimoTentativo = ora;
  try {
    const r = await fetch(`/api/presenter/session?sess=${encodeURIComponent(codice)}`);
    const j = (await r.json()) as RigaConsulenza & { presenterName?: string };
    const io = readStoredPresenter();
    if (
      !siRiprendeLaConsulenza({
        riga: j,
        mioCodice: codice,
        ioSono: io?.id,
        giaAperta: S.sessionLive,
      })
    )
      return;
    console.log("[HOST] questa consulenza è ancora aperta sul server → me la riprendo:", codice);
    set({
      sessionLive: true,
      //  Il nome è quello che il cliente vede scritto: si tiene quello che
      //  c'è, e solo se manca si prende dalla riga del server.
      presenterName: S.presenterName || String(j.presenterName || "") || io?.name || "",
    });
    pushHeartbeat(); // il battito riparte subito: il cliente può entrare
    broadcastState();
    /*  ⚠️ E ANCHE IL CONSULENTE SI ANNUNCIA, senza aspettare la
        videochiamata. È lo stesso difetto visto dall'altro lato (vedi il
        cartello in `guestEnterApproved`): finché l'annuncio periodico partiva
        solo con i media, in una consulenza di soli contenuti nessuno dei due
        lati si annunciava — il cliente spariva dall'elenco del consulente, e
        il consulente dall'elenco del cliente («host-fantasma», nel registro
        del cliente, misurato in locale). */
    startPresence();
  } catch {
    /* rete: si riprova al giro dopo */
  } finally {
    ripresaInCorso = false;
  }
}

/** ── IL FARO: «QUESTA SCHEDA STA MOSTRANDO LA CONSULENZA» ──────────────────
 *  Serve a decidere dove compare «fai entrare»: vedi shop/dove-si-ammette.
 *  Il nome della scheda sta nella memoria DI SCHEDA, così sopravvive alle
 *  ricariche — altrimenti una scheda non riconoscerebbe il faro che aveva
 *  accesso lei stessa un istante prima. */
const NOME_SCHEDA_KEY = "hg_scheda";
function nomeDiQuestaScheda(): string {
  if (typeof sessionStorage === "undefined") return "";
  try {
    let v = sessionStorage.getItem(NOME_SCHEDA_KEY);
    if (!v) {
      v = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem(NOME_SCHEDA_KEY, v);
    }
    return v;
  } catch {
    return "";
  }
}
/** Il canale su cui le schede si dicono chi sta mostrando la consulenza, e
 *  l'ultimo annuncio sentito. Niente `localStorage`: il faro si ripete ogni due
 *  secondi, e da lì avrebbe svegliato ogni due secondi tutti gli ascoltatori di
 *  `storage` del CRM, che non guardano di quale chiave si tratta. */
let canaleFaro: BroadcastChannel | null = null;
let faroSentito: string | null = null;
function apriCanaleFaro(): BroadcastChannel | null {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (!canaleFaro) {
    try {
      canaleFaro = new BroadcastChannel(CANALE_FARO);
      canaleFaro.onmessage = (e) => {
        if (typeof e.data === "string") faroSentito = e.data;
      };
    } catch {
      canaleFaro = null;
    }
  }
  return canaleFaro;
}
/** Accende il faro se questa è una schermata di consulenza. Non si spegne a
 *  mano: scade da solo dopo sei secondi, ed è il motivo per cui scade — una
 *  scheda chiusa di colpo non farebbe in tempo a dirlo. */
function aggiornaFaro() {
  if (typeof window === "undefined") return;
  const c = apriCanaleFaro();
  if (!c) return;
  const scheda = nomeDiQuestaScheda();
  if (!scheda) return;
  const codice = S.sessionId || readLiveId() || "";
  if (!(S.role === "host" && !!codice && quiSiConduce(window.location.pathname))) return;
  try {
    c.postMessage(faroDaScrivere({ scheda, code: codice }));
  } catch {
    /* canale chiuso */
  }
}
if (typeof window !== "undefined") setInterval(aggiornaFaro, 2000);

/** ── SI PUÒ FAR ENTRARE QUALCUNO DA QUI? ───────────────────────────────────
 *  Sulle schermate della consulenza sempre; altrove solo se non la sta
 *  guardando un'altra scheda (vedi shop/dove-si-ammette).
 *  La campana segue la stessa risposta: suonare dove non c'è niente da premere
 *  è un allarme che non si può spegnere. */
function ammissioniQui(): boolean {
  if (typeof window === "undefined") return true;
  apriCanaleFaro(); // ascoltare è metà della risposta
  return siAmmetteQui({
    paginaDellaConsulenza: quiSiConduce(window.location.pathname),
    grezzo: faroSentito,
    miaScheda: nomeDiQuestaScheda(),
    codice: S.sessionId || readLiveId(),
  });
}

/** ── RIPARARE APPENA SI TORNA, SENZA ASPETTARE CHE IL BROWSER SE NE ACCORGA ─
 *
 *  Sempre sulla richiesta «devi fare che non perde più connessione».
 *
 *  Ci sono tre momenti in cui si SA che le connessioni possono essere morte, e
 *  il browser lo scopre solo molto dopo:
 *   · la rete è tornata (`online`) — fra il Wi-Fi che cade e il 4G che prende,
 *     o il treno che esce dal tunnel: i percorsi ICE di prima non esistono più;
 *   · la scheda torna davanti — in secondo piano i browser congelano i timer,
 *     e una scheda risvegliata dopo dieci minuti può avere connessioni morte
 *     senza un solo evento;
 *   · la pagina torna dalla cache di navigazione (`pageshow` con `persisted`),
 *     cioè il classico «indietro» del telefono, che sospende tutto.
 *
 *  ⚠️ NON SI CHIUDE E RIFÀ NIENTE. Si chiede una ripresa per gli interlocutori
 *   che NON risultano sani; per gli altri non si muove nulla, perché una
 *   connessione buona rinegoziata è mezzo secondo di schermo nero regalato.
 *   La `true` in coda serve al caso peggiore: «connected» che in realtà è morta
 *   (vedi SILENZIO_MAX_MS), che è proprio quello che lascia il risveglio.
 *  ⚠️ E si batte subito: se il cliente ci ha creduti morti mentre la rete era
 *   giù, la sua schermata d'attesa si chiude appena il battito riparte. */
function riparaLeConnessioni(perche: string) {
  if (!peers.size) return;
  console.log(`[PEER] controllo di ripresa (${perche}) su ${peers.size} interlocutori`);
  for (const [pid, pc] of peers) {
    if (pc.connectionState === "closed") continue;
    const sano = pc.connectionState === "connected" && hasLiveMedia(pid);
    //  Il silenzio non lo si può misurare qui — servono le statistiche, e la
    //  sonda gira ogni due secondi e mezzo: quella lo farà. Qui si interviene
    //  su quello che si vede subito, cioè lo stato.
    if (!sano) chiediRipresa(pid, 0, true);
  }
  pushHeartbeat();
}
if (typeof window !== "undefined") {
  window.addEventListener("online", () => riparaLeConnessioni("rete tornata"));
  window.addEventListener("pageshow", (e: any) => {
    if (e?.persisted) riparaLeConnessioni("pagina ripresa dalla cache");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") riparaLeConnessioni("scheda tornata davanti");
  });
}

/** L'host riflette lo zoom dell'anteprima mobile/tablet sul dispositivo del guest. */
export function setViewZoom(z: number) {
  if (S.role === "host") send("viewzoom", { z });
}

/** (E) L'host chiede al guest di azzerare lo zoom pinch/browser. */
export function requestResetGuestZoom() {
  if (S.role === "host") send("resetzoom", {});
}
/** Azzera lo zoom sul PROPRIO dispositivo (usato dal guest a ogni cambio schermata/pagina). */
export function resetOwnZoom() {
  if (S.role === "viewer") resetGuestZoom();
}

/** Il guest ha ricevuto contenuti dal presentatore (slide/preventivo/sito):
 *  esce dalla schermata d'attesa anche se non è stata avviata una videochiamata. */
export function guestContentSeen() {
  // la pagina ha RICEVUTO E APPLICATO lo stato del presentatore: solo ora il velo
  // di caricamento può cadere (prima si vedevano le slide "sbagliate" a lampo).
  guestPageApplied = true;
  // NB: ricevere contenuti NON apre più la sessione. Se il presentatore non è in
  // videochiamata (o la sessione è solo "riprendibile") l'ospite resta sulla
  // schermata d'attesa brandizzata: è la regola richiesta.
  if (S.role === "viewer") set({}); // sveglia gli osservatori (velo/gate)
}
/** (E) Best-effort sul guest: ricalibra il <meta viewport> e azzera lo zoom CSS.
 *  LIMITE: nessuna API standard resetta il pinch-zoom visuale; il toggle di
 *  maximum-scale funziona su molti browser mobili (Android) ma iOS Safari lo ignora. */
const VIEWPORT_BASE = "width=device-width, initial-scale=1";
/** Ripulisce OGNI residuo di scala sul documento (vecchia feature "viewzoom",
 *  zoom CSS, transform: scale su html/body) e garantisce UN SOLO <meta viewport>
 *  a scala 1 adattato al dispositivo. Chiamata all'apertura di ogni pagina ospite:
 *  senza questo il guest poteva partire "pinch-zoomato". */
export function ensureGuestViewport() {
  if (typeof document === "undefined") return;
  const clear = (el: HTMLElement | null) => {
    if (!el) return;
    try {
      (el.style as any).zoom = "";
      if (el.style.transform && /scale/i.test(el.style.transform)) {
        el.style.transform = "";
        el.style.transformOrigin = "";
      }
      (el.style as any).minWidth = "";
    } catch {
      /* */
    }
  };
  clear(document.documentElement);
  clear(document.body);
  try {
    const metas = Array.from(
      document.querySelectorAll('meta[name="viewport"]'),
    ) as HTMLMetaElement[];
    // più di un meta viewport = il browser applica l'ULTIMO: ne tengo uno solo
    metas.slice(1).forEach((m) => m.remove());
    let meta = metas[0] || null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      document.head.appendChild(meta);
    }
    meta.setAttribute(
      "content",
      `${VIEWPORT_BASE}, maximum-scale=5, user-scalable=1, viewport-fit=cover`,
    );
  } catch {
    /* */
  }
}
function resetGuestZoom() {
  if (typeof document === "undefined") return;
  ensureGuestViewport();
  try {
    (document.documentElement.style as any).zoom = "";
    (document.body.style as any).zoom = "";
  } catch {
    /* */
  }
  try {
    let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "viewport";
      document.head.appendChild(meta);
    }
    const base = VIEWPORT_BASE;
    // forza la ricalibrazione: blocca a scala 1, poi ripristina il pinch libero
    meta.setAttribute("content", `${base}, maximum-scale=1, user-scalable=0`);
    setTimeout(() => {
      meta!.setAttribute("content", `${base}, maximum-scale=5, user-scalable=1`);
    }, 350);
  } catch {
    /* */
  }
}

// applica qualità (risoluzione/frame-rate/bitrate) alla PROPRIA traccia video in uscita
async function applyQualityLocal(level: Quality) {
  const q = QUALITY[level];
  // con la sfocatura attiva i vincoli vanno sulla CAMERA sorgente (la traccia in
  // uscita è quella del canvas e non accetta constraints)
  // ⚠️ width E height: con la sola altezza alcune camere restano su un formato
  // basso e la tela del compositor finiva per RISCALARE verso l'alto (spixellato).
  try {
    await (blurRaw || localStream?.getVideoTracks()[0])?.applyConstraints({
      width: { ideal: q.w },
      height: { ideal: q.h },
      frameRate: { ideal: q.fr, max: q.fr },
    });
  } catch {
    /* */
  }
  tuneVideoSenders();
}
/** Cambia la qualità della TUA trasmissione (camera/schermo). */
export function setMyQuality(level: Quality) {
  set({ myQuality: level });
  applyQualityLocal(level);
}
/** L'host chiede al cliente di cambiare la qualità della SUA camera. */
export function setGuestQuality(level: Quality) {
  if (S.role !== "host") return;
  set({ guestQuality: level });
  send("quality", { level });
}

// ══════════════════════════════════════════════════════════════════════════
//  RILASCIO REALE DI CAMERA E MICROFONO
//  `track.enabled = false` NON libera il dispositivo: la spia della camera resta
//  accesa e il microfono resta occupato dalla scheda. Qui le tracce vengono
//  davvero fermate (`stop()`) e al loro posto entra un SEGNAPOSTO (video nero /
//  audio silenzioso) così il sender del peer conserva la sua traccia e, quando si
//  riaccende, basta un `replaceTrack` — MAI una rinegoziazione.
// ══════════════════════════════════════════════════════════════════════════
let blackTrack: MediaStreamTrack | null = null;
let silentCtx: AudioContext | null = null;
let silentTrack: MediaStreamTrack | null = null;

function getBlackTrack(): MediaStreamTrack | null {
  if (blackTrack && blackTrack.readyState === "live") return blackTrack;
  try {
    const c = document.createElement("canvas");
    c.width = 640;
    c.height = 360;
    const g = c.getContext("2d");
    if (g) {
      g.fillStyle = "#0b1730";
      g.fillRect(0, 0, c.width, c.height);
    }
    blackTrack = (c as any).captureStream(1).getVideoTracks()[0] || null;
  } catch {
    blackTrack = null;
  }
  return blackTrack;
}
function getSilentTrack(): MediaStreamTrack | null {
  if (silentTrack && silentTrack.readyState === "live") return silentTrack;
  try {
    silentCtx = silentCtx || audioCtx();
    if (!silentCtx) return null;
    const dst = silentCtx.createMediaStreamDestination(); // nessuna sorgente collegata = silenzio
    silentTrack = dst.stream.getAudioTracks()[0] || null;
  } catch {
    silentTrack = null;
  }
  return silentTrack;
}
function isPlaceholder(t: MediaStreamTrack | null | undefined) {
  return !!t && (t === blackTrack || t === silentTrack);
}
function releasePlaceholders() {
  try {
    blackTrack?.stop();
  } catch {
    /* */
  }
  blackTrack = null;
  try {
    silentTrack?.stop();
  } catch {
    /* */
  }
  silentTrack = null;
  //  Stesso motivo: se è quello condiviso, chiuderlo spegne l'audio di tutti.
  if (silentCtx && silentCtx !== sharedCtx) {
    try {
      void silentCtx.close();
    } catch {
      /* */
    }
  }
  silentCtx = null;
}

// sostituisce la traccia video/audio in USCITA verso TUTTI i peer del mesh
// ── PERCHÉ LA CAMERA DEL CLIENTE SI VEDEVA NERA ─────────────────────────────
//  Le tracce vengono agganciate a una connessione NEL MOMENTO in cui la
//  connessione viene creata (`makePeer`: `if (localStream) …addTrack`).
//  Con la sala d'attesa, il cliente ora apre camera e microfono DOPO essere stato
//  autorizzato — ma la connessione con il presentatore può essere già nata prima,
//  quando lui non aveva ancora alcuna traccia. Quella connessione resta senza
//  posto per il video: `replaceTrack` non ha nulla da sostituire, e dall'altra
//  parte si vede nero.
//  Rimedio: appena i media sono pronti si controlla ogni connessione; quelle
//  senza posto per il video vengono ricostruite dal normale giro di saluti, che
//  questa volta le crea CON le tracce.
function attachLocalMediaToPeers(reason: string) {
  if (!localStream) return;
  const missing: string[] = [];
  for (const [pid, pc] of peers) {
    const kinds = new Set(
      pc
        .getSenders()
        .map((s) => s.track?.kind)
        .filter(Boolean) as string[],
    );
    const wantV = localStream.getVideoTracks().length > 0;
    const wantA = localStream.getAudioTracks().length > 0;
    if ((wantV && !kinds.has("video")) || (wantA && !kinds.has("audio"))) missing.push(pid);
  }
  if (!missing.length) return;
  console.warn(
    `[PEER] ${missing.length} connessione/i senza posto per i media (${reason}) → le ricostruisco`,
  );
  missing.forEach((pid) => removePeer(pid, "media aperti dopo la connessione"));
  sendHello(true); // richiede il giro di saluti: le connessioni rinascono con le tracce
}

async function replaceVideoTrackAll(track: MediaStreamTrack | null, reason = "non specificato") {
  console.log(
    `[CAM] traccia video in uscita sostituita — motivo: ${reason}`,
    track ? `(${track.label || track.kind}, readyState=${track.readyState})` : "(null)",
  );
  for (const pc of peers.values()) {
    const s = pc.getSenders().find((s) => s.track?.kind === "video");
    if (s) {
      try {
        await s.replaceTrack(track);
      } catch {
        /* */
      }
    }
  }
  tuneVideoSenders();
}
async function replaceAudioTrackAll(track: MediaStreamTrack | null) {
  for (const pc of peers.values()) {
    const s = pc.getSenders().find((s) => s.track?.kind === "audio");
    if (s) {
      try {
        await s.replaceTrack(track);
      } catch {
        /* */
      }
    }
  }
}
/** Sostituisce la traccia locale del tipo indicato SENZA fermare quella vecchia. */
function setLocalTrack(kind: "video" | "audio", t: MediaStreamTrack | null) {
  if (!localStream) localStream = new MediaStream();
  (kind === "video" ? localStream.getVideoTracks() : localStream.getAudioTracks()).forEach((x) =>
    localStream!.removeTrack(x),
  );
  if (t) localStream.addTrack(t);
  emitStreams();
}

// ── SFOCATURA SFONDO (presentatore) ───────────────────────────────────────
//  1) se il browser espone il vincolo nativo `backgroundBlur` (vera segmentazione
//     di piattaforma) lo usa: sfondo sfocato, persona nitida, zero costi;
//  2) altrimenti pipeline a canvas SENZA nuove dipendenze: sfocatura morbida di
//     TUTTA l'inquadratura ("sfoca inquadratura").
const BLUR_KEY = "hg_blur_on",
  BLUR_LVL_KEY = "hg_blur_level";
/** Si sta lavorando su un Mac? Serve solo per un consiglio, mai per una
 *  decisione: la sfocatura di sistema (Effetti video → Ritratto) è gratis e
 *  migliore della nostra, e vale la pena dirlo a chi ce l'ha. */
const suMac = (): boolean =>
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || "");
// RAGGIO DI SFOCATURA (in pixel a PIENA risoluzione). Valori DETERMINISTICI:
// nessun percorso di codice li altera a runtime. Il degrado sui dispositivi lenti
// abbassa SOLO la cadenza di segmentazione, mai l'aspetto.
//   1 = "Leggera" · 2 = "Media" · 3 = "Forte" · 4 = "Massima"
/*  ⚠️ QUATTRO GRADINI, E IL QUARTO È NUOVO. Richiesta del committente: «fai
    che posso regolare l'intensità di sfocatura dello sfondo». I tre che
    c'erano arrivavano a 22 px, che su una stanza illuminata si legge ancora:
    36 px toglie del tutto la lettura della stanza dietro. Sono pixel a piena
    risoluzione e non cambiano il costo — la sfocatura si fa comunque su una
    tela da 426 px e il raggio viene riscalato. */
const BLUR_PX: Record<number, number> = { 1: 6, 2: 12, 3: 22, 4: 36 };
/** Il nome di ogni gradino, uno solo per tutta l'applicazione. */
export const NOMI_SFOCATURA: Record<number, string> = {
  1: "Leggera",
  2: "Media",
  3: "Forte",
  4: "Massima",
};
let blurRaw: MediaStreamTrack | null = null; // traccia CAMERA sorgente
let blurOut: MediaStreamTrack | null = null; // traccia sfocata in uscita
let blurVideo: HTMLVideoElement | null = null;
let blurTimer = 0;
let blurNative = false;
let blurSegOn = false; // segmentazione vera attiva su questa pipeline

// ── SEGMENTAZIONE PERSONA (MediaPipe Tasks Vision · Selfie Segmenter, Apache-2.0) ──
//  Caricamento PIGRO: il pacchetto e il modello arrivano solo quando la sfocatura
//  viene accesa davvero (nessun peso sul primo caricamento della pagina).
//  I file WASM/modello vengono dalla CDN ufficiale: se è bloccata → fallback.
const SEG_WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
/*  ── ⚠️ IL MODELLO PESAVA 16,4 MB, ED ERA TUTTA LÌ LA DIFFERENZA ─────────
    Segnalazione del committente: «lo sfondo sfocato quando lo attivo non
    funziona; e quando funzionava era imperfetto e rallentava la chiamata,
    forse quello che usavi era troppo pesante».
    Aveva ragione, e si misura: il modello che si scaricava — selfie
    MULTICLASSE 256×256 in float32 — pesa 16.371.837 byte (misurato con una
    richiesta alla CDN di Google, non a memoria). Ogni accensione della
    sfocatura aspettava quel download PRIMA di cambiare qualcosa sullo
    schermo, senza limite di tempo: su una rete normale sono decine di
    secondi in cui il pulsante è acceso e non succede niente. Dal di fuori:
    «non funziona». E una rete float32 a 256×256 costa a ogni inferenza
    molto più di quanto serva per dire dove finisce una persona.
    Il modello binario (persona/sfondo) in float16 pesa 249.537 byte: SESSANTA
    volte meno, e l'inferenza è una frazione. I contorni sono un filo meno
    precisi sui capelli — per quello c'è il filtro guidato qui sotto, che li
    riaggancia ai bordi veri — ma una sfocatura che parte subito e non
    rallenta la chiamata vale più di una ciocca disegnata meglio. */
const SEG_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
// Freschezza massima della maschera: oltre, la persona nitida svanisce e resta
// solo lo sfondo sfocato (mai sfondo nitido, nemmeno per un fotogramma).
// MOLTO tollerante: una singola inferenza lenta (GPU occupata, tab in background)
// non deve far svanire la persona. Meglio una sagoma leggermente "vecchia" che un
// lampeggio. Sotto questa soglia il fotogramma persona resta composito a piena
// opacità; oltre, si dissolve MOLTO lentamente (segmenter davvero morto).
const MASK_FRESH_MS = 1500;
const MASK_FADE_MS = 2000;
// CADENZA DELLA RETE: la segmentazione NON gira a ogni fotogramma. Compositare
// ogni fotogramma con l'ultima maschera (riuso della maschera) è esattamente ciò
// che fanno Meet/Zoom: la maschera invecchia di poche decine di ms — invisibile —
// mentre il costo CPU/GPU crolla e l'encoder riceve fotogrammi regolari.
const SEG_PERIOD_MS = 66; // ≈15 Hz
const SEG_SLOW_PERIOD_MS = 100; // ≈10 Hz sui dispositivi lenti
const SEG_INPUT = 256; // input della rete: 256×256 (compositing a piena risoluzione)
let segmenter: any = null;
let segLoading: Promise<any> | null = null;
let segMulti = false; // true = modello multiclasse attivo
/** true se l'ultima accensione della sfocatura usa la segmentazione (persona nitida). */
export function isBlurSegmented(): boolean {
  return blurSegOn || blurNative;
}
async function loadSegmenter(): Promise<any> {
  if (segmenter) return segmenter;
  if (!segLoading) {
    segLoading = (async () => {
      const vision: any = await import("@mediapipe/tasks-vision");
      const files = await vision.FilesetResolver.forVisionTasks(SEG_WASM_CDN);
      const make = (url: string) =>
        vision.ImageSegmenter.createFromOptions(files, {
          baseOptions: { modelAssetPath: url, delegate: "GPU" },
          runningMode: "VIDEO",
          // MASCHERA DI CONFIDENZA (float 0..1) invece della categoryMask 0/255:
          // dà una rampa morbida sui bordi (capelli, spalle) → niente scalettature.
          outputConfidenceMasks: true,
          outputCategoryMask: true, // fallback se il runtime non fornisce le confidenze
        });
      segMulti = false;
      const t0 = performance.now();
      segmenter = await make(SEG_MODEL_URL);
      console.log(
        `[BLUR] modello persona pronto in ${Math.round(performance.now() - t0)} ms (binario, 250 KB)`,
      );
      return segmenter;
    })().catch(() => null);
  }
  return segLoading;
}

// ── FILTRO GUIDATO (guided filter, O(n)) ──────────────────────────────────
//  Rende la maschera "consapevole dei bordi": l'alfa viene rifinita usando come
//  guida la LUMINANZA dell'immagine, così si aggancia ai contorni veri (dita,
//  ciocche di capelli, profilo delle spalle) invece di restare una macchia
//  morbida. Tutto a risoluzione ridotta (256×256) → costo di pochi ms.
type GuidedBufs = {
  n: number;
  mI: Float32Array;
  mP: Float32Array;
  cII: Float32Array;
  cIP: Float32Array;
  A: Float32Array;
  B: Float32Array;
  T: Float32Array;
  S: Float32Array;
};
function guidedBufs(n: number): GuidedBufs {
  return {
    n,
    mI: new Float32Array(n),
    mP: new Float32Array(n),
    cII: new Float32Array(n),
    cIP: new Float32Array(n),
    A: new Float32Array(n),
    B: new Float32Array(n),
    T: new Float32Array(n),
    S: new Float32Array(n),
  };
}
/** media mobile separabile (box filter) raggio r, src→dst usando tmp come appoggio */
function boxBlur(
  src: Float32Array,
  dst: Float32Array,
  tmp: Float32Array,
  W: number,
  H: number,
  r: number,
) {
  const d = 2 * r + 1;
  for (let y = 0; y < H; y++) {
    const o = y * W;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[o + Math.min(W - 1, Math.max(0, x))];
    for (let x = 0; x < W; x++) {
      tmp[o + x] = acc / d;
      acc += src[o + Math.min(W - 1, x + r + 1)] - src[o + Math.min(W - 1, Math.max(0, x - r))];
    }
  }
  for (let x = 0; x < W; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
    for (let y = 0; y < H; y++) {
      dst[y * W + x] = acc / d;
      acc +=
        tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.min(H - 1, Math.max(0, y - r)) * W + x];
    }
  }
}
/** q = guidedFilter(I guida, p alfa) — risultato scritto in p. */
function guidedFilter(
  I: Float32Array,
  p: Float32Array,
  W: number,
  H: number,
  r: number,
  eps: number,
  g: GuidedBufs,
) {
  const n = W * H,
    { mI, mP, cII, cIP, A, B, T, S } = g;
  boxBlur(I, mI, T, W, H, r);
  boxBlur(p, mP, T, W, H, r);
  for (let i = 0; i < n; i++) S[i] = I[i] * I[i];
  boxBlur(S, cII, T, W, H, r);
  for (let i = 0; i < n; i++) S[i] = I[i] * p[i];
  boxBlur(S, cIP, T, W, H, r);
  for (let i = 0; i < n; i++) {
    const varI = cII[i] - mI[i] * mI[i];
    const covIp = cIP[i] - mI[i] * mP[i];
    const a = covIp / (varI + eps);
    A[i] = a;
    B[i] = mP[i] - a * mI[i];
  }
  boxBlur(A, S, T, W, H, r); // mean_a → S
  boxBlur(B, mP, T, W, H, r); // mean_b → mP
  for (let i = 0; i < n; i++) {
    const q = S[i] * I[i] + mP[i];
    p[i] = q < 0 ? 0 : q > 1 ? 1 : q;
  }
}

// ── POLARITÀ DELLA MASCHERA: decisa UNA VOLTA e poi BLOCCATA ───────────────
//  BUG REALE ("la sfocatura sparisce quando mi muovo"): la polarità veniva
//  ricalcolata a OGNI fotogramma confrontando centro e angoli. Appena la persona
//  si spostava dal centro l'euristica si ribaltava, la maschera si invertiva e la
//  sfocatura sembrava sparire finché non si spegneva/riaccendeva.
//  Ora: voto di maggioranza sui primi fotogrammi (più regioni campione), poi LOCK.
const POL_VOTE_FRAMES = 12;
type Polarity = { votes: number; frames: number; locked: boolean; personIsHigh: boolean };
const newPolarity = (): Polarity => ({ votes: 0, frames: 0, locked: false, personIsHigh: true });
/** Media dei valori (0..1) di una regione rettangolare della maschera. */
function maskRegionMean(
  a: Float32Array,
  mw: number,
  mh: number,
  fx0: number,
  fy0: number,
  fx1: number,
  fy1: number,
): number {
  const x0 = Math.max(0, (mw * fx0) | 0),
    x1 = Math.min(mw, Math.max(1, (mw * fx1) | 0));
  const y0 = Math.max(0, (mh * fy0) | 0),
    y1 = Math.min(mh, Math.max(1, (mh * fy1) | 0));
  let s = 0,
    n = 0;
  for (let y = y0; y < y1; y += 2)
    for (let x = x0; x < x1; x += 2) {
      s += a[y * mw + x];
      n++;
    }
  return n ? s / n : 0;
}
/** Un voto: "i valori ALTI sono la persona?" — centro (busto/volto) contro una
 *  cintura di regioni di bordo (angoli + fasce laterali), molto più stabile del
 *  solo confronto centro/2 angoli. */
function votePersonIsHigh(a: Float32Array, mw: number, mh: number): boolean {
  const centre =
    (maskRegionMean(a, mw, mh, 0.35, 0.25, 0.65, 0.75) +
      maskRegionMean(a, mw, mh, 0.3, 0.55, 0.7, 0.95)) /
    2;
  const border =
    (maskRegionMean(a, mw, mh, 0.0, 0.0, 0.12, 0.12) +
      maskRegionMean(a, mw, mh, 0.88, 0.0, 1.0, 0.12) +
      maskRegionMean(a, mw, mh, 0.0, 0.0, 0.06, 1.0) +
      maskRegionMean(a, mw, mh, 0.94, 0.0, 1.0, 1.0) +
      maskRegionMean(a, mw, mh, 0.0, 0.0, 1.0, 0.06)) /
    5;
  return centre >= border;
}

async function startBlurPipeline(raw: MediaStreamTrack): Promise<MediaStreamTrack | null> {
  // IDEMPOTENTE: se la pipeline è GIÀ attiva sulla stessa sorgente non si
  // ricostruisce nulla (ogni riavvio = camera che "lampeggia" off→on).
  if (blurRaw === raw && blurOut && blurOut.readyState === "live" && (blurTimer || blurNative)) {
    console.log(
      "[CAM] pipeline sfocatura già attiva sulla stessa sorgente → riuso (nessun riavvio)",
    );
    return blurOut;
  }
  stopBlurPipelineTrack();
  /*  ── ⚠️ LA SFOCATURA «DI SISTEMA» VA VERIFICATA, NON CHIESTA ───────────
      Segnalazione del committente: «non funziona la sfocatura anche se la
      attivo» — pulsante acceso, immagine identica, su Safari.
      Ed è questa la riga: Safari DICHIARA di conoscere il vincolo
      `backgroundBlur`, perché su Mac la sfocatura esiste davvero — ma la
      governa il sistema (Centro di Controllo → Effetti video), non la pagina.
      La richiesta veniva accettata senza errori, noi restituivamo la camera
      così com'era dicendo «fatto», e sullo schermo non cambiava niente:
      nessun errore da nessuna parte, e nessun modo di accorgersene.
      Adesso si CONTROLLA l'esito nelle impostazioni vere della traccia: se il
      sistema non l'ha davvero accesa si prosegue con la nostra pipeline a
      tela, che funziona ovunque. Chiedere non è ottenere. */
  try {
    const sup: any = (navigator.mediaDevices as any).getSupportedConstraints?.() || {};
    if (sup.backgroundBlur) {
      try {
        await (raw as any).applyConstraints({ backgroundBlur: true });
      } catch {
        /* il sistema può rifiutare */
      }
      const acceso = (raw.getSettings?.() as any)?.backgroundBlur === true;
      annotaSfocatura(`vincolo di sistema disponibile · acceso davvero: ${acceso}`);
      if (acceso) {
        blurNative = true;
        blurRaw = raw;
        blurOut = raw;
        return raw;
      }
      //  Dichiarato ma non acceso: si va avanti con la tela. E non si lascia
      //  in giro una richiesta a metà sulla camera.
      try {
        await (raw as any).applyConstraints({ backgroundBlur: false });
      } catch {
        /* */
      }
    }
  } catch {
    blurNative = false;
  }
  try {
    const st: any = raw.getSettings?.() || {};
    // TELA FINALE ALLA RISOLUZIONE NATIVA DELLA CAMERA (mai ridotta): è questa la
    // risoluzione che viene poi codificata e inviata. Solo l'input della rete
    // (256²) e la tela di appoggio dello sfondo sfocato (~426px) restano ridotti.
    // (la camera è ora aperta a 1280×720: vedi openMedia/camAcquire).
    const w = Math.max(160, st.width || 1280),
      h = Math.max(120, st.height || 720);
    console.log("[CAM] compositor sfocatura: tela finale", w + "×" + h, "(nativa camera)");
    const v = document.createElement("video");
    v.srcObject = new MediaStream([raw]);
    v.muted = true;
    (v as any).playsInline = true;
    /*  ⚠️ IL VIDEO STA NEL DOCUMENTO, ANCHE SE NON SI VEDE. Un <video> mai
        attaccato alla pagina, su WebKit, può non decodificare: `drawImage`
        allora copia un fotogramma vuoto e la tela resta nera — indistinguibile
        da «la sfocatura non funziona». Fuori campo (1 px, trasparente) ma
        RENDERIZZATO: `display:none` lo rimetterebbe a dormire. */
    v.style.cssText =
      "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
    v.setAttribute("aria-hidden", "true");
    try {
      document.body.appendChild(v);
    } catch {
      /* */
    }
    try {
      await v.play();
    } catch (e) {
      annotaSfocatura(`il video sorgente non parte: ${(e as Error)?.name || e}`);
    }
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const g = c.getContext("2d");
    if (!g) return null;
    // SFONDO SFOCATO A RISOLUZIONE RIDOTTA: il costo di `filter: blur()` cresce con
    // l'AREA. Sfocare 1280×720 a 30fps è la voce di spesa numero uno del compositor
    // (ed è ciò che affamava l'encoder → video a scatti). La sfocatura viene fatta su
    // una tela di ~426px di larghezza e poi RISCALATA: visivamente identica (è già
    // sfocata) ma ~9× più economica.
    const BW = Math.max(160, Math.min(w, 426)),
      BH = Math.max(1, Math.round((BW * h) / w));
    const bc = document.createElement("canvas");
    bc.width = BW;
    bc.height = BH;
    const bg = bc.getContext("2d");
    // ── LA "SCIA" DELLO SFONDO ────────────────────────────────────────────
    //  Lo sfondo sfocato veniva ricavato dal fotogramma ATTUALE — che contiene
    //  anche te. Sfocandolo, dietro la tua sagoma nitida restava una tua copia
    //  sfocata: muovendoti, quella copia ti seguiva con un attimo di ritardo.
    //  È la scia.
    //  Ora si tiene una LASTRA dello sfondo: il fotogramma attuale vi viene
    //  copiato sopra SOLO fuori dalla persona, quindi dietro di te resta l'ultimo
    //  sfondo vero visto lì — mai una tua copia. Costa due disegni in più su una
    //  tela piccola (426px al massimo): cadenza e risoluzione della
    //  trasmissione restano identiche.
    const plc = document.createElement("canvas");
    plc.width = BW;
    plc.height = BH;
    const plg = plc.getContext("2d");
    const scc = document.createElement("canvas");
    scc.width = BW;
    scc.height = BH; // ritaglio di servizio
    const scg = scc.getContext("2d");
    let lastraPronta = false;
    // tele di appoggio: persona nitida ritagliata + maschera (piccola) + maschera fusa nel tempo
    const pc = document.createElement("canvas");
    pc.width = w;
    pc.height = h;
    const pg = pc.getContext("2d");
    // maschera già ingrandita e sfumata a piena risoluzione: si prepara UNA volta
    // per ogni maschera nuova, così il ritaglio per fotogramma costa due sole
    // copie e nessun filtro (vedi buildPerson)
    const mfc = document.createElement("canvas");
    mfc.width = w;
    mfc.height = h;
    const mfg = mfc.getContext("2d");
    // MASCHERE IN SPAZIO FOTOGRAMMA (non più 256×256): la rete lavora su un
    // RITAGLIO attorno alla persona, il risultato viene rimappato qui dentro.
    const FMW = Math.min(512, w),
      FMH = Math.max(1, Math.round((FMW * h) / w));
    const mc = document.createElement("canvas");
    mc.width = FMW;
    mc.height = FMH; // maschera del fotogramma
    const mg = mc.getContext("2d");
    const ac = document.createElement("canvas");
    ac.width = FMW;
    ac.height = FMH; // maschera fusa nel tempo
    const ag = ac.getContext("2d");
    const ec = document.createElement("canvas");
    ec.width = FMW;
    ec.height = FMH; // sagoma EROSA (vedi buildMask)
    const eg = ec.getContext("2d");
    const nc = document.createElement("canvas");
    nc.width = FMW;
    nc.height = FMH; // il NEGATIVO della sagoma
    const ng = nc.getContext("2d");
    const dc = document.createElement("canvas");
    dc.width = FMW;
    dc.height = FMH; // il negativo ALLARGATO
    const dg = dc.getContext("2d");
    const qc = document.createElement("canvas");
    qc.width = FMW;
    qc.height = FMH; // maschera precedente
    const qg = qc.getContext("2d");
    const rc = document.createElement("canvas");
    rc.width = SEG_INPUT;
    rc.height = SEG_INPUT; // maschera del RITAGLIO
    const rg = rc.getContext("2d");
    const sc = document.createElement("canvas");
    sc.width = SEG_INPUT;
    sc.height = SEG_INPUT; // input ridotto
    const sg = sc.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | null;
    // CADENZA: si segue la camera (30fps se la fornisce). 24 fissi erano sotto la
    // cadenza reale della sorgente → micro-scatti costanti in uscita.
    const fps = Math.min(30, Math.max(15, Math.round(Number(st.frameRate) || 30)));
    const pol = newPolarity();
    let prevArr: Float32Array | null = null; // maschera precedente (stima del movimento)
    let goodMask = false; // esiste almeno una maschera valida da riusare
    let maskAt = 0; // quando è stata prodotta la maschera attuale
    let segSlow = false; // dispositivo lento → sfoco di più (mai sfondo nitido)
    // buffer riutilizzabili (nessuna allocazione per fotogramma)
    const N = SEG_INPUT * SEG_INPUT;
    const guide = new Float32Array(N); // luminanza del ritaglio (guida del filtro)
    const pbuf = new Float32Array(N); // alfa da rifinire
    const gbuf = guidedBufs(N);
    const rimg = new ImageData(SEG_INPUT, SEG_INPUT);
    {
      const d0 = rimg.data;
      for (let i = 0; i < d0.length; i += 4) {
        d0[i] = 255;
        d0[i + 1] = 255;
        d0[i + 2] = 255;
      }
    }
    const abuf = new Float32Array(N); // maschera normalizzata (riusato, zero allocazioni)
    let guideOk = false; // la guida del filtro è stata letta per QUESTO fotogramma
    // RITAGLIO (ROI) attorno alla persona: la rete ha input fisso 256×256, quindi
    // ritagliare intorno al soggetto MOLTIPLICA i pixel utili sulla persona (dita,
    // capelli). Parte dal fotogramma intero e insegue la sagoma con isteresi.
    let roi = { x: 0, y: 0, w, h };
    let pendRoi = { ...roi }; // ritaglio del fotogramma in volo
    let roiInit = false;
    // ── COMPENSAZIONE DEL MOVIMENTO ─────────────────────────────────────────
    //  La maschera descrive DOVE ERA la persona 100-150 ms fa (periodo di
    //  segmentazione + tempo di inferenza). Applicandola ai pixel di ADESSO, sul
    //  bordo che avanza taglia dentro il soggetto e su quello che arretra lascia
    //  una fettina di sfondo NITIDA attaccata alla sagoma: è la causa principale
    //  del "contorno impreciso quando mi muovo", e nessuna sfumatura può
    //  correggerla perché è un errore di POSIZIONE, non di forma.
    //  Rimedio: si stima la velocità del centro della persona fra le ultime due
    //  maschere e si sposta la sagoma di conseguenza al momento del compositing.
    let cen: { x: number; y: number; t: number } | null = null;
    let prevCen: { x: number; y: number; t: number } | null = null;

    /*  ── ⚠️ LA SFOCATURA NON ASPETTA PIÙ IL MODELLO ────────────────────────
        Qui c'era `await loadSegmenter()`: finché il modello non era arrivato,
        questa funzione non tornava, la traccia non veniva sostituita e sullo
        schermo NON CAMBIAVA NIENTE. Col modello da 16 MB volevano dire decine
        di secondi col pulsante acceso e nessun effetto — la segnalazione del
        committente, parola per parola: «quando lo attivo non funziona». E se
        la rete non ce la faceva, non tornava mai.
        Adesso la sfocatura parte SUBITO in modalità piena (costa due disegni
        su una tela da 426 px, la può fare qualunque macchina) e la persona
        torna nitida da sola appena il modello è pronto: il ciclo di disegno
        guarda `seg` a ogni fotogramma, quindi non serve riavviare niente.
        ⚠️ E c'è un tempo massimo: dopo di quello si smette di aspettare e si
         DICE che si resta sulla sfocatura piena, invece di lasciare il
         consulente a chiedersi se ha funzionato. */
    const pezziPronti = !!pg && !!mg && !!ag && !!sg && !!qg && !!rg;
    let seg: any = null;
    blurSegOn = false;
    set({ blurSeg: false });
    void (async () => {
      const ATTESA_MODELLO_MS = 20_000;
      const arrivato = await Promise.race([
        loadSegmenter(),
        new Promise<null>((ok) => setTimeout(() => ok(null), ATTESA_MODELLO_MS)),
      ]);
      if (blurVideo !== v) return; // sfocatura già spenta nel frattempo
      if (!arrivato || !pezziPronti) {
        console.warn("[BLUR] niente riconoscimento persona: resto sulla sfocatura piena");
        avvisoRegistrazione({
          titolo: "Sfocatura senza riconoscimento persona",
          motivo: "il modello che distingue la persona dallo sfondo non è arrivato.",
          /*  ⚠️ E SI DICE LA STRADA CHE NON COSTA NIENTE. Su un Mac recente la
               sfocatura la sa fare il SISTEMA, in hardware: Centro di
               Controllo → Effetti video → Ritratto, mentre la camera è in
               uso. È più bella della nostra e non toglie un fotogramma alla
               chiamata, perché non gira dentro il browser. */
          dettaglio: suMac()
            ? "L'inquadratura resta sfocata tutta e la videochiamata continua normalmente. Sul Mac c'è di meglio e non costa niente: Centro di Controllo → Effetti video → Ritratto (mentre la camera è accesa)."
            : "L'inquadratura resta sfocata tutta: la videochiamata continua normalmente. Riprova fra poco — il modello si scarica una volta sola.",
          tono: "ambra",
        });
        return;
      }
      seg = arrivato;
      blurSegOn = true;
      set({ blurSeg: true });
      console.log("[BLUR] riconoscimento persona attivo: da adesso resti nitido");
    })();

    let busy = false,
      frame = 0,
      lastTs = -1,
      segAt = 0;
    let ultimaOpacita = 0; // con quanta opacità è stata composta la persona (0 = non c'è)
    const pipeStart = performance.now(); // warmup: primi secondi con tolleranza maschera più ampia
    let segSlowUntil = 0; // isteresi APPICCICOSA del percorso lento (niente oscillazioni)
    /*  ══════════════════════════════════════════════════════════════════════
        LO SFONDO È QUELLO DI ADESSO. LA LASTRA SERVE SOLO DIETRO DI TE
        ──────────────────────────────────────────────────────────────────────
        Terza segnalazione sullo stesso punto, e la fotografia non lasciava
        scampo: una fascia chiara attaccata ai capelli, tutt'intorno alla
        testa. Ho provato a stringere la sagoma, poi ad allargare il buco,
        poi ad allargarlo meglio: rimediavo sempre allo stesso errore invece
        di toglierlo.

        ⚠️ L'ERRORE ERA LA LASTRA COME SFONDO. La lastra è lo sfondo tenuto da
         parte, aggiornato solo dove NON ci sei: serve a una cosa sola —
         evitare che dietro la tua sagoma nitida compaia una tua copia
         sfocata (la «scia»). Ma usandola per TUTTO il fotogramma, ogni pixel
         che la maschera sbaglia — e ne sbaglia sempre, arriva da 256 px e ha
         un decimo di secondo di ritardo — diventa sfondo CONSERVATO: una
         striscia di un altro momento, che resta lì finché non ti sposti.
         Attorno alla testa, dove c'è il soffitto chiaro, è la fascia bianca.

        Adesso i due mestieri sono separati:
         · FUORI da te lo sfondo è il fotogramma di ADESSO, sfocato. Vivo:
           non può essere vecchio, quindi non può fare aloni né cerchi.
         · DENTRO la tua sagoma — l'unico posto dove servirebbe la tua copia,
           cioè dove nasce la scia — ci va la lastra.
        Il confine fra i due sta SOTTO di te, coperto dalla persona nitida
        che viene disegnata sopra: un errore di maschera lì non si vede,
        perché lì non si guarda lo sfondo.
        ⚠️ Il buco nella lastra resta ALLARGATO di qualche pixel (nove disegni
         spostati): così la lastra non si mangia mai il tuo contorno. È la
         stessa idea di prima, ma adesso un suo errore non finisce in faccia
         a nessuno.
        ══════════════════════════════════════════════════════════════════════ */
    const drawBackground = (px: number) => {
      // leggero over-scan: senza, il blur lascia un alone trasparente sui bordi
      const k = 1 + (px * 3) / Math.max(w, h);
      //  Raggio RISCALATO sulla tela ridotta: `px` è espresso a piena
      //  risoluzione, qui si sfoca su BW×BH e poi si riscala a w×h.
      const sp = Math.max(0.5, (px * BW) / w);
      const dw = BW * k,
        dh = BH * k;
      const cx = (BW - dw) / 2,
        cy = (BH - dh) / 2;
      if (!bg) {
        g.filter = `blur(${px}px)`;
        const dwF = w * k,
          dhF = h * k;
        g.drawImage(v, (w - dwF) / 2, (h - dhF) / 2, dwF, dhF);
        g.filter = "none";
        return;
      }
      // 1) LO SFONDO VIVO: il fotogramma di adesso, sfocato. Sempre, anche
      //    senza maschera — è il ripiego che funziona ovunque.
      bg.globalCompositeOperation = "source-over";
      bg.filter = `blur(${sp}px)`;
      bg.drawImage(v, cx, cy, dw, dh);
      bg.filter = "none";

      if (goodMask && mfc.width && plg && scg) {
        const { dx: mdx, dy: mdy } = motionOffset();
        const ox = (mdx * BW) / w,
          oy = (mdy * BH) / h;
        //  ⚠️ Più largo di prima: la sagoma adesso è EROSA, quindi il buco
        //   deve recuperare quei pixel E aggiungere il suo margine, se no la
        //   lastra tornerebbe a mangiarsi il contorno della persona.
        const D = Math.max(3, Math.round(BW / 60)); // ~7 px su 426 → ~21 su 1280
        // 2) la lastra si aggiorna dove c'è sfondo VERO: fotogramma attuale
        //    meno la tua sagoma, ingrossata di qualche pixel.
        scg.globalCompositeOperation = "source-over";
        scg.clearRect(0, 0, BW, BH);
        scg.drawImage(v, 0, 0, BW, BH);
        scg.globalCompositeOperation = "destination-out";
        for (const [ax, ay] of [
          [0, 0],
          [D, 0],
          [-D, 0],
          [0, D],
          [0, -D],
          [D, D],
          [-D, -D],
          [D, -D],
          [-D, D],
        ])
          scg.drawImage(mfc, 0, 0, mfc.width, mfc.height, ox + ax, oy + ay, BW, BH);
        scg.globalCompositeOperation = "source-over";
        if (!lastraPronta) {
          plg.drawImage(v, 0, 0, BW, BH);
          lastraPronta = true;
        }
        plg.drawImage(scc, 0, 0);

        // 3) e la lastra sfocata va SOLO dietro di te: si ritaglia con la tua
        //    sagoma (non ingrossata) e si posa sopra lo sfondo vivo.
        scg.globalCompositeOperation = "source-over";
        scg.clearRect(0, 0, BW, BH);
        scg.filter = `blur(${sp}px)`;
        scg.drawImage(plc, cx, cy, dw, dh);
        scg.filter = "none";
        scg.globalCompositeOperation = "destination-in";
        scg.drawImage(mfc, 0, 0, mfc.width, mfc.height, ox, oy, BW, BH);
        scg.globalCompositeOperation = "source-over";
        bg.drawImage(scc, 0, 0);
      }

      g.filter = "none";
      g.imageSmoothingEnabled = true;
      g.drawImage(bc, 0, 0, BW, BH, 0, 0, w, h); // upscale: costo trascurabile
    };
    /*  ⚠️ PIUMA DA 1 A 3 PIXEL (su 1280). Con un solo pixel il passaggio fra
        te e lo sfondo è una riga netta: qualunque imprecisione della maschera
        — e ce n'è sempre, la sagoma arriva da 256 px e ha un decimo di secondo
        — si legge come un CONTORNO disegnato. Tre pixel di sfumatura non si
        vedono come morbidezza, ma nascondono l'errore invece di sottolinearlo.
        Non si esagera: sfumare tanto era ciò che «mangiava» le spalle. */
    const FEATHER = Math.max(2, Math.round(Math.max(w, h) / 420));
    // La "persona ritagliata" (pc) cambia SOLO quando arriva una maschera nuova:
    // ricostruirla a ogni fotogramma significava 2 blit a piena risoluzione + un
    // filtro blur in più per fotogramma, sprecati. Ora si ricostruisce a cadenza di
    // segmentazione e il compositing per fotogramma è UN solo drawImage.
    let personDirty = false;
    /** Prepara la maschera a piena risoluzione (ingrandita + sfumata).
     *  Si esegue SOLO all'arrivo di una maschera nuova (~15 volte al secondo):
     *  l'ingrandimento e la sfumatura del bordo sono la parte costosa e non
     *  hanno motivo di essere rifatti per ogni fotogramma. */
    /*  ══════════════════════════════════════════════════════════════════════
        LA SAGOMA SI STRINGE DI QUALCHE PIXEL — MISURATO SU UN BANCO DI PROVA
        ──────────────────────────────────────────────────────────────────────
        Quarta segnalazione sulla stessa fascia chiara attorno alla testa.
        Le prime tre volte ho ragionato e sbagliato. Questa volta ho costruito
        un banco: una scena finta (soffitto chiaro, parete, mensola), una
        persona finta, e una maschera con l'errore che decido io — più stretta
        o più larga del soggetto, con il ritardo che voglio. Poi ho guardato.

        ⚠️ IL RISULTATO, senza interpretazioni:
         · maschera più LARGA del soggetto → un anello CHIARO e NITIDO attorno
           alla testa. È la fotografia del committente, identica: la sagoma si
           porta dietro una fettina di parete e di soffitto, che viene
           disegnata NITIDA sopra lo sfondo sfocato.
         · la stessa maschera, ERODENDO la sagoma di pochi pixel → l'anello
           sparisce. Senza erosione ricompare. Acceso e spento due volte.

        E si capisce anche perché la maschera è più larga: il modello leggero
        tiene il beneficio del dubbio sui capelli, cioè li allarga.

        Erodere costa poco e non toglie niente: si perdono due o tre pixel di
        contorno, che la sfumatura del bordo rende invisibili. Un anello
        bianco attorno alla testa si vede da un metro.
        ⚠️ L'erosione si fa QUI, sulla maschera piccola (512 px), non sul
         fotogramma: otto disegni su una tela piccola, una volta per maschera
         nuova (~15 al secondo), invece di otto a piena risoluzione.
        ══════════════════════════════════════════════════════════════════════ */
    /** Di quanti pixel si stringe la sagoma, sulla maschera piccola.
     *  ~4 px su 512 → ~10 px sul fotogramma da 1280: la misura che sul banco
     *  toglie l'anello con la maschera larga 8 px (e ne avanza). */
    const EROSIONE = Math.max(2, Math.round(FMW / 128));
    const buildMask = () => {
      personDirty = false;
      if (!mfg || !ac.width || !goodMask) return;
      /*  1) la sagoma si stringe.
          ⚠️ E NON RIPETENDO `destination-in`, che è quello che avevo fatto e
           che ha CANCELLATO LA PERSONA sullo schermo del committente. Quel
           modo interseca moltiplicando le opacità: la maschera vera non è
           piena, all'interno vale spesso 0,7 — e 0,7 moltiplicato nove volte
           fa 0,04. La persona diventava trasparente e restava solo lo sfondo
           sfocato: «continua ad essere così».
           L'ho visto sul banco solo dopo aver reso SFUMATA anche la maschera
           finta: con una sagoma piena il difetto non si manifesta, ed è il
           motivo per cui la prima misura mi aveva detto che andava bene. Una
           prova che non somiglia alla realtà misura un'altra cosa.
          Il modo giusto è per COMPLEMENTO: si prende il negativo della
          sagoma, lo si allarga (unione di copie spostate) e lo si SOTTRAE.
          Dentro la persona il negativo vale zero, e sottrarre zero non tocca
          niente: l'opacità dell'interno resta esattamente quella che era. */
      let sorgente: HTMLCanvasElement = ac;
      if (eg && ng && dg) {
        const E = EROSIONE;
        ng.globalCompositeOperation = "source-over";
        ng.clearRect(0, 0, FMW, FMH);
        ng.fillStyle = "#fff";
        ng.fillRect(0, 0, FMW, FMH);
        ng.globalCompositeOperation = "destination-out";
        ng.drawImage(ac, 0, 0); // nc = negativo della sagoma
        ng.globalCompositeOperation = "source-over";
        dg.globalCompositeOperation = "source-over";
        dg.clearRect(0, 0, FMW, FMH);
        for (const [ax, ay] of [
          [0, 0],
          [E, 0],
          [-E, 0],
          [0, E],
          [0, -E],
          [E, E],
          [-E, -E],
          [E, -E],
          [-E, E],
        ])
          dg.drawImage(nc, ax, ay); // dc = negativo ALLARGATO (unione)
        eg.globalCompositeOperation = "source-over";
        eg.clearRect(0, 0, FMW, FMH);
        eg.drawImage(ac, 0, 0);
        eg.globalCompositeOperation = "destination-out";
        eg.drawImage(dc, 0, 0); // ec = sagoma − negativo allargato
        eg.globalCompositeOperation = "source-over";
        sorgente = ec;
      }
      //  2) e poi si ingrandisce al fotogramma, con il bordo sfumato.
      mfg.globalCompositeOperation = "source-over";
      mfg.clearRect(0, 0, w, h);
      mfg.imageSmoothingEnabled = true;
      (mfg as any).imageSmoothingQuality = "high";
      mfg.filter = `blur(${FEATHER}px)`;
      mfg.drawImage(sorgente, 0, 0, FMW, FMH, 0, 0, w, h);
      mfg.filter = "none";
    };
    // ── CAUSA DELLA "SCIA" QUANDO CI SI MUOVE ────────────────────────────────
    //  La persona veniva incollata prendendo il fotogramma CATTURATO AL MOMENTO
    //  DELLA SEGMENTAZIONE, e questo strato veniva ricostruito solo all'arrivo
    //  di una maschera nuova. Lo sfondo sfocato, invece, era sempre quello
    //  ATTUALE. Risultato: per alcuni centesimi di secondo il soggetto restava
    //  fermo in una posizione già abbandonata sopra uno sfondo aggiornato —
    //  cioè un fantasma di sé stesso che seguiva il movimento: la scia.
    //  Ora la persona viene ritagliata dal fotogramma ATTUALE ad OGNI fotogramma
    //  (due copie, nessun filtro: la maschera sfumata è già pronta). La maschera
    //  resta quella dell'ultima segmentazione, quindi può essere indietro di
    //  qualche millesimo sul bordo, ma i PIXEL sono sempre quelli di adesso:
    //  niente più fantasmi. Cadenza e risoluzione della trasmissione invariate.
    /** Spostamento stimato della persona fra l'istante della maschera e ADESSO. */
    const motionOffset = (): { dx: number; dy: number } => {
      if (!cen || !prevCen) return { dx: 0, dy: 0 };
      const dt = cen.t - prevCen.t;
      if (dt <= 8 || dt > 400) return { dx: 0, dy: 0 }; // misura inaffidabile
      const vx = (cen.x - prevCen.x) / dt,
        vy = (cen.y - prevCen.y) / dt; // px/ms
      const age = Math.min(200, performance.now() - cen.t); // quanto è vecchia la maschera
      const cap = Math.max(8, Math.min(w, h) * 0.06); // mai spostamenti assurdi
      return {
        dx: Math.max(-cap, Math.min(cap, vx * age)),
        dy: Math.max(-cap, Math.min(cap, vy * age)),
      };
    };
    const buildPerson = () => {
      if (!pg || !ac.width || !goodMask) return;
      if (personDirty) buildMask();
      pg.globalCompositeOperation = "source-over";
      pg.clearRect(0, 0, w, h);
      pg.drawImage(v, 0, 0, w, h); // fotogramma ATTUALE
      pg.globalCompositeOperation = "destination-in";
      // La maschera viene spostata di quanto la persona si è mossa da quando è
      // stata calcolata. Si sposta LA MASCHERA e non i pixel: così il soggetto
      // resta esattamente dov'è nella realtà (nessun disallineamento con lo
      // sfondo) e il ritaglio lo insegue invece di restare indietro.
      const { dx, dy } = motionOffset();
      pg.drawImage(mfc, dx, dy); // maschera già pronta
      pg.globalCompositeOperation = "source-over";
    };
    const compositePerson = (alpha: number) => {
      if (!pg || !goodMask || alpha <= 0.01) return;
      buildPerson();
      g.globalAlpha = alpha; // <1 solo se la maschera è vecchia
      g.drawImage(pc, 0, 0);
      g.globalAlpha = 1;
    };

    const renderFrame = () => {
      // dispositivo lento → sfoco di PIÙ (mai meno): il degrado non deve mai
      // tradursi in sfondo nitido.
      // RAGGIO ESATTO scelto dal presentatore: nessuna correzione automatica.
      // (Il degrado su dispositivo lento agisce solo su SEG_SLOW_PERIOD_MS.)
      const px = BLUR_PX[S.blurLevel] || BLUR_PX[2];
      try {
        drawBackground(px);
        //  ⚠️ Si conta PRIMA dell'uscita: in sfocatura piena i fotogrammi si
        //   disegnano eccome, e `frame` è la prova che la tela sta lavorando —
        //   la usa la partenza atomica e la usa il controllo di salute qui
        //   sotto. Contandolo dopo, «zero fotogrammi» voleva dire «il modello
        //   non è ancora pronto», che è un'altra cosa.
        frame++;
        if (!blurSegOn || !seg) return; // fallback: sfocatura piena
        // CADENZA DI SEGMENTAZIONE DISACCOPPIATA DAL COMPOSITING (come fa Meet):
        // la rete gira a ~15Hz (10Hz su dispositivi lenti) mentre OGNI fotogramma
        // viene compositato con l'ULTIMA maschera. Prima girava a pieno ritmo:
        // 30 inferenze/s + getImageData + guided filter sforavano il budget di
        // fotogramma e affamavano l'encoder → il video "a scatti".
        const nowMs = performance.now();
        const doSeg = !busy && nowMs - segAt >= (segSlow ? SEG_SLOW_PERIOD_MS : SEG_PERIOD_MS);
        if (doSeg) {
          segAt = nowMs;
          const t0 = nowMs;
          const ts = Math.max(lastTs + 1, Math.round(t0));
          lastTs = ts;
          busy = true;
          pendRoi = { ...roi }; // ritaglio di QUESTO fotogramma
          // ritaglio attorno alla persona → più pixel utili sul soggetto
          sg!.drawImage(v, pendRoi.x, pendRoi.y, pendRoi.w, pendRoi.h, 0, 0, SEG_INPUT, SEG_INPUT);
          // guida del filtro: luminanza del ritaglio (stessa griglia della maschera).
          // Su dispositivi lenti si SALTA del tutto (getImageData forza un flush della
          // GPU: è una delle poche operazioni davvero bloccanti del ciclo).
          guideOk = false;
          if (!segSlow) {
            try {
              const gi = sg!.getImageData(0, 0, SEG_INPUT, SEG_INPUT).data;
              for (let i = 0, j = 0; i < N; i++, j += 4)
                guide[i] = (0.299 * gi[j] + 0.587 * gi[j + 1] + 0.114 * gi[j + 2]) / 255;
              guideOk = true;
            } catch {
              /* canvas "tainted": si prosegue senza rifinitura */
            }
          }
          seg.segmentForVideo(sc, ts, (res: any) => {
            try {
              // Preferisco la maschera di CONFIDENZA (float 0..1): bordi morbidi.
              // Se manca (runtime vecchio) ricado sulla categoryMask normalizzata.
              const cms: any[] = Array.isArray(res?.confidenceMasks) ? res.confidenceMasks : [];
              // MULTICLASSE: la classe 0 è lo SFONDO → persona = 1 − confidenza(sfondo).
              // Nessuna ambiguità di polarità e contorni molto più netti.
              const cm = segMulti ? cms[0] || null : cms.length >= 2 ? cms[1] : cms[0] || null;
              const km = cm ? null : res?.categoryMask;
              const m = cm || km;
              if (m && mg && ag && qg && rg) {
                const mw = m.width,
                  mh = m.height;
                let a: Float32Array;
                if (cm) {
                  const src = cm.getAsFloat32Array();
                  if (segMulti) {
                    a = abuf.length === src.length ? abuf : new Float32Array(src.length);
                    for (let i = 0; i < src.length; i++) a[i] = 1 - src[i];
                  } else a = src;
                } else {
                  const u = km.getAsUint8Array();
                  a = abuf.length === u.length ? abuf : new Float32Array(u.length);
                  // multiclasse: qualunque classe ≠ 0 è persona · binario: valore ≠ 0
                  for (let i = 0; i < u.length; i++) a[i] = u[i] ? 1 : 0;
                }
                if (segMulti) {
                  pol.locked = true;
                  pol.personIsHigh = true;
                }
                // 1) POLARITÀ: votata sui primi fotogrammi, poi BLOCCATA per sempre
                if (!pol.locked) {
                  pol.frames++;
                  if (votePersonIsHigh(a, mw, mh)) pol.votes++;
                  pol.personIsHigh = pol.votes * 2 >= pol.frames;
                  if (pol.frames >= POL_VOTE_FRAMES) {
                    pol.locked = true;
                    console.log(
                      "[BLUR] polarità maschera BLOCCATA:",
                      pol.personIsHigh ? "valori alti = persona" : "valori alti = sfondo",
                      `(${pol.votes}/${pol.frames} voti, ${cm ? "confidence mask" : "category mask"})`,
                    );
                  }
                }
                const hi = pol.personIsHigh;
                if (mw * mh !== N) {
                  res?.close?.();
                  busy = false;
                  return;
                } // formato inatteso
                // 2) polarità applicata + copia nel buffer di lavoro
                if (a !== pbuf || !hi) {
                  for (let i = 0; i < N; i++) pbuf[i] = hi ? a[i] : 1 - a[i];
                }
                // 3) RIFINITURA AI BORDI (filtro guidato sulla luminanza del ritaglio):
                //    l'alfa si aggancia ai contorni VERI dell'immagine → si aprono gli
                //    spazi tra le dita e i capelli smettono di essere una macchia.
                if (guideOk) guidedFilter(guide, pbuf, mw, mh, 3, 1e-4, gbuf);
                // 4) rampa STRETTA (smoothstep) con lieve bias conservativo: la
                //    transizione cade appena DENTRO il soggetto (nessun anello di
                //    sfondo nitido) senza mangiare spalle e braccia.
                /*  ⚠️ ALZATA DA 0,42–0,62. La soglia decide dove passa il
                     confine: più bassa, la sagoma è LARGA e attorno a te
                     resta un anello di sfondo NITIDO — l'altra metà del
                     «bordo» segnalato. Questi valori erano tarati sul
                     modello multiclasse; il modello leggero (250 KB) dà una
                     confidenza distribuita diversamente, e con la vecchia
                     soglia taglia largo. Alzandola il confine cade appena
                     dentro il soggetto: si perde mezzo pixel di spalla, si
                     guadagna uno sfondo senza contorni. */
                /*  ⚠️ TORNATA GENEROSA (era 0,50–0,72, e prima ancora
                     0,55–0,80): stringere la sagoma con la SOGLIA è un modo
                     indiretto e imprevedibile — dipende da come il modello
                     distribuisce la confidenza, che cambia da un modello
                     all'altro. Adesso la sagoma si stringe con la geometria,
                     di un numero di pixel che ho misurato (vedi buildMask), e
                     la soglia torna a fare il suo mestiere: dire dov'è il
                     confine, non spostarlo. */
                const LO = 0.42,
                  HI = 0.62,
                  INV = 1 / (HI - LO);
                const d = rimg.data;
                let sum = 0,
                  bx0 = mw,
                  by0 = mh,
                  bx1 = -1,
                  by1 = -1;
                for (let y = 0; y < mh; y++) {
                  const r = y * mw;
                  for (let x = 0; x < mw; x++) {
                    const i = r + x;
                    let t = (pbuf[i] - LO) * INV;
                    t = t < 0 ? 0 : t > 1 ? 1 : t;
                    const s = t * t * (3 - 2 * t);
                    sum += s;
                    if (s > 0.5) {
                      if (x < bx0) bx0 = x;
                      if (x > bx1) bx1 = x;
                      if (y < by0) by0 = y;
                      if (y > by1) by1 = y;
                    }
                    const j = i * 4;
                    d[j + 3] = (s * 255) | 0; // RGB già a 255 (riempiti una volta alla creazione)
                  }
                }
                // 5) MASCHERA DEGENERE: fotogramma scartato, resta l'ultima buona
                //    (nessun "lampo") e il ritaglio torna al fotogramma intero.
                const cover = sum / N;
                if (cover < 0.01 || bx1 < 0) {
                  roi = { x: 0, y: 0, w, h };
                  res?.close?.();
                  busy = false;
                  return;
                }
                if (goodMask && cover > 0.995) {
                  roi = { x: 0, y: 0, w, h };
                  res?.close?.();
                  busy = false;
                  return;
                }
                rg.putImageData(rimg, 0, 0);
                // 6) RIMAPPATURA del ritaglio nello spazio FOTOGRAMMA
                const kx = FMW / w,
                  ky = FMH / h;
                mg.clearRect(0, 0, FMW, FMH); // fuori dal ritaglio = sfondo
                mg.imageSmoothingEnabled = true;
                (mg as any).imageSmoothingQuality = "high";
                mg.drawImage(rc, pendRoi.x * kx, pendRoi.y * ky, pendRoi.w * kx, pendRoi.h * ky);
                // 7) NUOVO RITAGLIO: riquadro della persona + 22% di margine, quadrato
                //    (l'input della rete è 1:1 → niente deformazione), con isteresi.
                {
                  const sx = pendRoi.w / mw,
                    sy = pendRoi.h / mh;
                  const touch = bx0 <= 1 || by0 <= 1 || bx1 >= mw - 2 || by1 >= mh - 2;
                  const pad = touch ? 0.45 : 0.22; // se tocca il bordo, allargo di più
                  const fx0 = pendRoi.x + bx0 * sx,
                    fx1 = pendRoi.x + (bx1 + 1) * sx;
                  const fy0 = pendRoi.y + by0 * sy,
                    fy1 = pendRoi.y + (by1 + 1) * sy;
                  const cx = (fx0 + fx1) / 2,
                    cy = (fy0 + fy1) / 2;
                  let side = Math.max(fx1 - fx0, fy1 - fy0) * (1 + pad);
                  side = Math.max(Math.min(w, h) * 0.4, Math.min(side, Math.min(w, h)));
                  const tx = Math.max(0, Math.min(w - side, cx - side / 2));
                  const ty = Math.max(0, Math.min(h - side, cy - side / 2));
                  // ISTERESI ASIMMETRICA: il ritaglio si ALLARGA subito e si
                  // stringe piano. Tutto ciò che resta fuori dal ritaglio viene
                  // trattato come sfondo, quindi un braccio che esce veniva
                  // sfocato con un taglio perfettamente DRITTO — l'artefatto più
                  // vistoso possibile su un contorno. Meglio un ritaglio un po'
                  // largo per qualche fotogramma che una fetta di persona persa.
                  const kGrow = roiInit ? 0.35 : 1;
                  const k = !roiInit ? 1 : side > roi.w || touch ? 1 : kGrow;
                  roi = {
                    x: roi.x + (tx - roi.x) * k,
                    y: roi.y + (ty - roi.y) * k,
                    w: roi.w + (side - roi.w) * k,
                    h: roi.h + (side - roi.h) * k,
                  };
                  // centro della persona in spazio fotogramma + istante: serve a
                  // compensare il movimento fra una maschera e l'altra (vedi sotto)
                  prevCen = cen;
                  cen = { x: cx, y: cy, t: performance.now() };
                  roiInit = true;
                }
                // 5) FUSIONE TEMPORALE ADATTIVA: appena c'è movimento uso SOLO la
                //    maschera nuova (peso 1.0): fondere con la vecchia significa
                //    tenere in vita la sagoma nella posizione ABBANDONATA → scie.
                //    La fusione resta solo a scena ferma (anti-sfarfallio).
                let motion = 1;
                if (prevArr && prevArr.length === a.length) {
                  let diff = 0,
                    n = 0;
                  for (let i = 0; i < a.length; i += 8) {
                    diff += Math.abs(a[i] - prevArr[i]);
                    n++;
                  }
                  motion = n ? diff / n : 1;
                } else prevArr = new Float32Array(a.length);
                prevArr.set(a);
                const wNew = motion > 0.004 ? 1 : Math.min(1, 0.6 + motion * 100);
                if (!goodMask || wNew >= 0.999) {
                  ag.globalCompositeOperation = "copy";
                  ag.globalAlpha = 1;
                  ag.drawImage(mc, 0, 0);
                } else {
                  ag.globalCompositeOperation = "copy";
                  ag.globalAlpha = 1 - wNew;
                  ag.drawImage(qc, 0, 0);
                  ag.globalCompositeOperation = "lighter";
                  ag.globalAlpha = wNew;
                  ag.drawImage(mc, 0, 0);
                }
                ag.globalCompositeOperation = "source-over";
                ag.globalAlpha = 1;
                maskAt = performance.now();
                // memoria del fotogramma fuso (la fusione deve poter anche CALARE:
                // con il vecchio source-over la maschera poteva solo crescere → scie)
                qg.globalCompositeOperation = "copy";
                qg.globalAlpha = 1;
                qg.drawImage(ac, 0, 0);
                qg.globalCompositeOperation = "source-over";
                goodMask = true;
                personDirty = true; // pc va ricostruito: maschera/fotogramma nuovi
              }
              res?.close?.();
            } catch (e) {
              console.warn(
                "[BLUR] fotogramma di segmentazione scartato (tengo l'ultima maschera)",
                e,
              );
            }
            busy = false;
            // percorso lento APPICCICOSO: una volta rilevato resta tale per 10s,
            // così la valvola a fotogrammi alternati non oscilla (freeze periodici)
            if (performance.now() - t0 > 45) {
              segSlow = true;
              segSlowUntil = performance.now() + 10000;
            } else if (segSlow && performance.now() > segSlowUntil) segSlow = false;
          });
        }
        // FAIL-SAFE: se la maschera è VECCHIA (stallo del segmenter) la persona
        // nitida svanisce dolcemente e resta lo sfondo TUTTO SFOCATO. Mai il
        // contrario: non si compone mai un fotogramma nitido "fuori posto".
        let alpha = 0;
        if (goodMask) {
          const age = performance.now() - maskAt;
          // WARMUP: nei primi secondi (GPU/delegate che si scalda) le maschere
          // arrivano lente; con la soglia normale la persona svaniva/riappariva
          // a ripetizione = "camera che si accende e spegne" all'avvio.
          const fresh = performance.now() - pipeStart < 6000 ? 3000 : MASK_FRESH_MS;
          // maschera vecchia → si TIENE l'ultimo fotogramma persona compositato
          // (nessun lampeggio). La dissolvenza parte solo dopo `fresh` e dura
          // MASK_FADE_MS: in pratica solo se la segmentazione è morta davvero.
          alpha = age <= fresh ? 1 : Math.max(0, 1 - (age - fresh) / MASK_FADE_MS);
        }
        ultimaOpacita = alpha;
        compositePerson(alpha);
      } catch {
        /* */
      }
    };
    blurVideo = v;
    blurRaw = raw;
    // stessa diagnosi sulla camera SORGENTE: se è il sistema a sospenderla
    // (altra app che la prende, risparmio energetico) il nero nasce qui
    try {
      raw.onmute = () => console.warn("[CAM] camera locale SOSPESA dal sistema (nero in uscita)");
      raw.onunmute = () => console.log("[CAM] camera locale ripresa");
    } catch {
      /* */
    }
    // ── MOTORE DEL COMPOSITOR ────────────────────────────────────────────
    //  requestVideoFrameCallback sul VIDEO sorgente (un tick per ogni fotogramma
    //  della camera) + WATCHDOG setInterval: se il flusso rVFC si blocca
    //  (>400ms senza fotogrammi, es. tab occlusa/throttling in "Contenuti+PiP")
    //  il watchdog continua a disegnare → la traccia in uscita NON si congela.
    let lastDraw = performance.now();
    let stallLogged = false;
    let drawing = false;
    // misura reale della cadenza in uscita (finestre di 2s) → visibile in console
    let fpsCount = 0,
      fpsAt = performance.now();
    const tick = () => {
      if (drawing) return; // niente rientri (watchdog vs rVFC)
      drawing = true;
      lastDraw = performance.now();
      staFacendo("camera (sfocatura)");
      try {
        renderFrame();
      } finally {
        drawing = false;
        staFacendo("fermo");
      }
      fpsCount++;
      const now = performance.now();
      if (now - fpsAt >= 2000) {
        console.log("[CAM] fps out:", Math.round((fpsCount * 1000) / (now - fpsAt)));
        fpsCount = 0;
        fpsAt = now;
      }
    };
    const useRVFC = typeof (v as any).requestVideoFrameCallback === "function";
    if (useRVFC) {
      const pump = () => {
        if (blurVideo !== v) return;
        tick();
        try {
          (v as any).requestVideoFrameCallback(pump);
        } catch {
          /* */
        }
      };
      try {
        (v as any).requestVideoFrameCallback(pump);
      } catch {
        /* */
      }
    }
    // METRONOMO: gira SEMPRE al ritmo dei fotogrammi. Se rVFC rallenta (finestra
    // coperta, throttling, segmentazione pesante) la tela continua comunque a
    // essere ridisegnata a `fps` → la traccia in uscita non scende mai a scatti.
    blurTimer = window.setInterval(
      () => {
        if (blurVideo !== v) return;
        const gap = performance.now() - lastDraw;
        if (!useRVFC || gap > (1000 / fps) * 0.9) {
          if (useRVFC && gap > 500 && !stallLogged) {
            console.warn(
              `[CAM] compositor sfocatura in STALLO (${Math.round(gap)}ms senza fotogrammi) → watchdog attivo`,
            );
            stallLogged = true;
          }
          tick();
        } else if (stallLogged) {
          console.log("[CAM] compositor sfocatura ripreso (fotogrammi regolari)");
          stallLogged = false;
        }
      },
      Math.round(1000 / fps),
    );
    // CADENZA IN USCITA — campionamento AUTOMATICO della tela a `fps`.
    //  captureStream(0)+requestFrame() consegnava UN solo fotogramma per tick del
    //  compositor: se rVFC veniva rallentato (tab non in primo piano, finestra
    //  coperta, segmentazione pesante) la traccia in uscita scendeva davvero a
    //  ~9fps — mentre in ENTRATA tutto restava fluido, esattamente il sintomo.
    //  Con captureStream(fps) il campionamento è indipendente dal nostro ciclo:
    //  al massimo un fotogramma viene duplicato, mai la cadenza che crolla.
    let cs: MediaStream | null = null;
    let comeCatturata = `captureStream(${fps})`;
    try {
      cs = (c as any).captureStream(fps);
    } catch {
      cs = null;
    }
    /*  ⚠️ SAFARI: `captureStream(fps)` con l'argomento non sempre consegna una
        traccia. Senza argomento la tela si campiona da sé a ogni disegno, che
        per noi va bene lo stesso — il metronomo qui sopra disegna comunque a
        cadenza fissa. Un ripiego di due righe invece di una sfocatura che non
        parte e non dice perché. */
    if (!cs?.getVideoTracks?.().length) {
      try {
        cs = (c as any).captureStream?.();
        comeCatturata = "captureStream()";
      } catch {
        cs = null;
      }
    }
    const ot = cs?.getVideoTracks?.()[0] || null;
    if (!ot)
      annotaSfocatura(
        `la tela non produce una traccia (${comeCatturata} · ${typeof (c as any).captureStream}) · ${navigator.userAgent.slice(0, 80)}`,
      );
    console.log("[CAM] compositor: campionamento tela a", fps, "fps (captureStream)");
    blurOut = ot;
    if (blurOut) {
      try {
        (blurOut as any).contentHint = "motion";
      } catch {
        /* */
      }
      // il sender può già esistere (riaccensione sfocatura): riapplica i parametri
      try {
        tuneVideoSenders();
      } catch {
        /* */
      }
    }
    // ── PARTENZA ATOMICA ─────────────────────────────────────────────────
    //  La traccia composita esce SOLO quando contiene già la PERSONA (prima
    //  maschera valida): fino ad allora resta visibile la camera semplice.
    //  Prima: swap immediato → sfondo tutto sfocato SENZA persona per i primi
    //  fotogrammi = camera che sembra spegnersi e riaccendersi.
    /*  ⚠️ SI ASPETTA IL PRIMO FOTOGRAMMA, NON LA PRIMA MASCHERA. Aspettare la
        maschera voleva dire aspettare il modello, ed è proprio l'attesa che
        faceva sembrare la sfocatura rotta. Un fotogramma composito c'è dopo
        una manciata di millisecondi — ed è già sfocato: nessuno vede la
        camera «spegnersi e riaccendersi», che era il motivo di questa attesa. */
    if (blurOut) {
      const w0 = performance.now();
      await new Promise<void>((resolve) => {
        const iv = window.setInterval(() => {
          if (frame > 0 || blurVideo !== v || performance.now() - w0 > 1200) {
            clearInterval(iv);
            resolve();
          }
        }, 30);
      });
      console.log(`[CAM] pipeline sfocatura in onda dopo ${Math.round(performance.now() - w0)}ms`);
      /*  ── ⚠️ E DUE SECONDI DOPO SI CONTROLLA CHE STIA DAVVERO USCENDO ────
          Una traccia «live» non vuol dire che ci passino fotogrammi: su
          Safari la tela può consegnare una traccia che resta muta, e da fuori
          è identico a «la sfocatura non funziona». Meglio saperlo qui, e
          scriverlo, che farlo scoprire al consulente davanti al cliente. */
      window.setTimeout(() => {
        if (blurVideo !== v) return;
        const t = blurOut;
        annotaSfocatura(
          `dopo 2s · fotogrammi disegnati ${frame} · traccia ${t ? `${t.readyState}${(t as any).muted ? " MUTA" : ""}` : "assente"}` +
            ` · riconoscimento persona ${blurSegOn ? "attivo" : "no"}` +
            /*  ⚠️ E SOPRATTUTTO: la persona viene DAVVERO disegnata nitida?
              «Riconoscimento attivo» diceva solo che il modello c'era. Il
              committente aveva la persona sfocata insieme allo sfondo e il
              diario rispondeva «attivo»: mancava la domanda che conta. */
            ` · sagoma valida ${goodMask ? "sì" : "NO"} · opacità persona ${ultimaOpacita.toFixed(2)} · ${comeCatturata}`,
        );
      }, 2000);
    }
    return blurOut;
  } catch {
    return null;
  }
}
/** Ferma la pipeline e RESTITUISCE la traccia camera sorgente (non la ferma). */
function stopBlurPipelineTrack(): MediaStreamTrack | null {
  const raw = blurRaw;
  if (blurTimer) {
    clearInterval(blurTimer);
    blurTimer = 0;
  }
  if (blurVideo) {
    try {
      blurVideo.pause();
      blurVideo.srcObject = null;
      blurVideo.remove();
    } catch {
      /* */
    }
    blurVideo = null;
  }
  if (blurOut && blurOut !== raw) {
    try {
      blurOut.stop();
    } catch {
      /* */
    }
  }
  if (blurNative && raw) {
    try {
      (raw as any).applyConstraints({ backgroundBlur: false });
    } catch {
      /* */
    }
  }
  blurNative = false;
  blurOut = null;
  blurRaw = null;
  if (blurSegOn) {
    blurSegOn = false;
    set({ blurSeg: false });
  }
  return raw;
}
/** Ferma la pipeline E rilascia la camera sorgente (chiusura chiamata). */
function stopBlurPipeline() {
  const raw = stopBlurPipelineTrack();
  if (raw) {
    try {
      raw.stop();
    } catch {
      /* */
    }
  }
}

/** ON/OFF della sfocatura sfondo del presentatore (scelta ricordata). */
export async function setBlurEnabled(on: boolean) {
  if (S.blurOn === on) return;
  set({ blurOn: on });
  try {
    localStorage.setItem(BLUR_KEY, on ? "1" : "0");
  } catch {
    /* */
  }
  /*  ⚠️ QUESTE USCITE LASCIAVANO IL PULSANTE ACCESO E BASTA. Il committente
      lo premeva, restava illuminato e l'immagine non cambiava: da fuori «non
      funziona», e nessun modo di sapere a quale riga si era fermato. Adesso
      ognuna lo dice, e nel caso in cui la sfocatura NON può partire il
      pulsante torna spento: uno stato che mente è peggio di un guasto. */
  if (S.sharing || !S.camOn || !localStream) {
    annotaSfocatura(
      `accensione rimandata (schermo condiviso: ${!!S.sharing} · camera accesa: ${!!S.camOn} · flusso locale: ${!!localStream})`,
    );
    return; // si applicherà al ritorno sulla camera
  }
  if (on) {
    const raw =
      localStream.getVideoTracks().find((t) => !isPlaceholder(t) && t.readyState === "live") ||
      null;
    if (!raw) {
      annotaSfocatura(
        `nessuna camera viva da sfocare (tracce video: ${localStream.getVideoTracks().length})`,
      );
      set({ blurOn: false });
      avvisoRegistrazione({
        titolo: "Sfocatura non avviata",
        motivo: "in questo momento non c'è una camera viva da sfocare.",
        dettaglio: "Accendi la camera e riprova: la sfocatura si applica a quella.",
        tono: "ambra",
      });
      return;
    }
    const t0 = performance.now();
    const out = await startBlurPipeline(raw);
    if (!out) {
      annotaSfocatura(
        `la pipeline non è partita dopo ${Math.round(performance.now() - t0)} ms · ${navigator.userAgent.slice(0, 80)}`,
      );
      set({ blurOn: false });
      avvisoRegistrazione({
        titolo: "Sfocatura non disponibile qui",
        motivo: "questo browser non lascia riprendere la tela su cui si compone lo sfondo sfocato.",
        dettaglio: suMac()
          ? "Sul Mac c'è di meglio e non costa niente: Centro di Controllo → Effetti video → Ritratto, mentre la camera è accesa."
          : "Prova con Chrome, oppure usa la sfocatura del sistema se il tuo computer ce l'ha.",
        tono: "ambra",
      });
      return;
    }
    annotaSfocatura(
      `accesa in ${Math.round(performance.now() - t0)} ms · nativa: ${blurNative} · traccia nuova: ${out !== raw} · stato: ${out.readyState}`,
    );
    if (out !== raw) {
      await replaceVideoTrackAll(out, "sfocatura ATTIVATA");
      setLocalTrack("video", out);
    }
  } else {
    const raw = stopBlurPipelineTrack();
    if (raw && raw.readyState === "live") {
      await replaceVideoTrackAll(raw, "sfocatura DISATTIVATA");
      setLocalTrack("video", raw);
    } else await camAcquire(); // sorgente persa → riapro la camera pulita
  }
}
/** Intensità della sfocatura: 1 molto leggera · 2 leggera · 3 normale (ricordata). */
export function setBlurLevel(n: 1 | 2 | 3 | 4) {
  set({ blurLevel: n });
  try {
    localStorage.setItem(BLUR_LVL_KEY, String(n));
  } catch {
    /* */
  }
}

// ── SPECCHIATURA DELLA PROPRIA IMMAGINE ───────────────────────────────────
//  Un interruttore di sola VISIONE: ribalta a specchio come mi vedo io, qui.
//  Non tocca la traccia che parte verso gli altri — nessun `replaceTrack`,
//  nessuna rinegoziazione: è una trasformazione del solo riquadro a schermo.
//  Chi mi guarda continua a vedermi dritto, e le scritte restano leggibili.
/** Accende/spegne lo specchio della propria camera (ricordato sul dispositivo). */
export function setSpecchio(on: boolean) {
  set({ specchio: on });
  try {
    localStorage.setItem(SPECCHIO_KEY, on ? "1" : "0");
  } catch {
    /* */
  }
}
/** true se QUESTO riquadro va mostrato specchiato: solo la propria camera, e
 *  mai lo schermo condiviso — lì il rovescio renderebbe illeggibile ogni testo. */
function specchiaTile(t: { isLocal: boolean }): boolean {
  return t.isLocal && S.specchio && !(S.role === "host" && S.sharing);
}

// ── camera ────────────────────────────────────────────────────────────────
let camBusy = false;
/** Riapre la camera (con eventuale sfocatura) e la instrada ai peer via replaceTrack. */
async function camAcquire(): Promise<boolean> {
  if (camBusy) return false;
  camBusy = true;
  try {
    const q = QUALITY[S.myQuality];
    const s = await apriMedia({
      video: {
        width: { ideal: q.w },
        height: { ideal: q.h },
        frameRate: { ideal: q.fr, max: q.fr },
      },
      audio: false,
    });
    let track = s.getVideoTracks()[0];
    if (!track) return false;
    if (S.blurOn) {
      const out = await startBlurPipeline(track);
      if (out) track = out;
    }
    await replaceVideoTrackAll(track, "camera riaccesa");
    const old = localStream?.getVideoTracks() || [];
    setLocalTrack("video", track);
    old.forEach((t) => {
      if (!isPlaceholder(t) && t !== track && t !== blurRaw) {
        try {
          t.stop();
        } catch {
          /* */
        }
      }
    });
    set({ camOn: true });
    sendHello();
    return true;
  } catch {
    set({ camOn: false });
    sendHello();
    return false;
  } finally {
    camBusy = false;
  }
}
/** Spegne la camera RILASCIANDO il dispositivo (spia OFF): al suo posto un segnaposto nero. */
async function camRelease() {
  if (camBusy) return;
  camBusy = true;
  try {
    const raw = stopBlurPipelineTrack(); // ferma canvas, tiene la sorgente
    const old = localStream?.getVideoTracks() || [];
    const ph = getBlackTrack();
    await replaceVideoTrackAll(ph, "camera spenta → segnaposto nero"); // il sender resta vivo → niente rinegoziazione
    setLocalTrack("video", ph);
    [...old, raw].forEach((t) => {
      if (t && !isPlaceholder(t)) {
        try {
          t.stop();
        } catch {
          /* */
        }
      }
    }); // device LIBERO
    set({ camOn: false });
    sendHello();
  } finally {
    camBusy = false;
  }
}
export function toggleCam() {
  if (S.sharing) {
    set({ camOn: !S.camOn });
    sendHello();
    return;
  } // in condivisione non c'è camera aperta
  if (S.camOn) void camRelease();
  else void camAcquire();
}

// ══════════════════════════════════════════════════════════════════════════
//  AUDIO DEL MICROFONO — soppressione rumore + SOGLIA DI ATTIVAZIONE (noise gate)
//
//  ── PERCHÉ L'AUDIO SI DISTORCEVA DOPO I PRIMI SECONDI ─────────────────────
//  Fino a ieri ai partecipanti NON andava il microfono: andava una traccia
//  RICOSTRUITA da Web Audio (sorgente → GainNode → MediaStreamDestination).
//  Tre guasti nascevano da lì, e tutti e tre si vedono solo dopo un po':
//   1) la cancellazione d'eco del browser è tarata sulla traccia del
//      DISPOSITIVO; mandandone un'altra il legame si allenta, l'eco rientra e
//      in qualche secondo diventa un rimbombo crescente ("distorsione");
//   2) il volume della voce era pilotato da un setInterval a 30 ms sul thread
//      principale — lo stesso thread dei compositor di sfocatura, condivisione
//      e registrazione. Appena parte la condivisione (o la scheda passa in
//      secondo piano, dove il browser porta i timer a 1 al secondo e poi a 1
//      al minuto) il guadagno resta congelato: parole tagliate, voce mozzata;
//   3) l'AudioContext condiviso nasce alla frequenza del dispositivo d'USCITA:
//      cuffie Bluetooth agganciate a metà chiamata → ricampionamento continuo
//      di tutto ciò che passa dalla catena.
//
//  ── COM'È FATTA ORA ───────────────────────────────────────────────────────
//  Ai partecipanti va SEMPRE la traccia del dispositivo, con soppressione
//  rumore, controllo guadagno e cancellazione d'eco fatti DAL BROWSER (sono
//  coerenti fra loro, cosa che una catena scritta a mano non può garantire).
//     microfono ──┬── traccia INVIATA ── replaceTrack sui sender (TRASMISSIONE)
//                 └── doppione clone() ── AnalyserNode (RMS → dBFS, solo misura)
//  Il misuratore lavora su un DOPPIONE della traccia, non su quella inviata: la
//  soglia spegne l'inviata, e una traccia spenta consegna silenzio anche
//  all'analizzatore — misurandola, la soglia si chiuderebbe a chiave (vedi
//  `micMeterTrack`).
//  Web Audio resta, ma FUORI dal percorso della voce: serve al misuratore di
//  livello, che continua a funzionare identico. Se il contesto si sospende o
//  ricampiona, ne risente il misuratore — mai la voce.
//  La soglia di attivazione si applica con `track.enabled`, che è il modo
//  NATIVO di far tacere un microfono: non tocca il segnale, non rompe la
//  cancellazione d'eco, non produce scatti da rampa interrotta.
//  Nessuna rinegoziazione: si sostituisce solo la traccia del sender audio.
// ══════════════════════════════════════════════════════════════════════════
function normAudio(a: any): AudioPrefs {
  const db = Number(a?.gateDb);
  const p = a?.preset;
  return {
    ns: typeof a?.ns === "boolean" ? a.ns : AUDIO_DEFAULT.ns,
    gate: typeof a?.gate === "boolean" ? a.gate : AUDIO_DEFAULT.gate,
    gateDb: isFinite(db) ? Math.max(-80, Math.min(0, db)) : AUDIO_DEFAULT.gateDb,
    preset:
      p === "consigliata" || p === "rumoroso" || p === "sensibile" || p === "custom"
        ? p
        : AUDIO_DEFAULT.preset,
  };
}
/** Vincoli getUserMedia dell'audio secondo le preferenze.
 *  NB: `echoCancellation` resta SEMPRE attivo — spegnerlo provocherebbe eco/larsen
 *  in una videochiamata con altoparlanti; il toggle governa rumore + guadagno. */
// ── QUALE MICROFONO, QUALE CAMERA ───────────────────────────────────────────
//  Il browser sceglie da solo il primo dispositivo che trova, e quasi mai è
//  quello giusto: si finisce a parlare nel microfono del portatile con le
//  cuffie in testa, o a trasmettere dalla webcam sbagliata. La scelta resta
//  salvata su questo dispositivo, così vale anche per le consulenze dopo.
const MIC_DEV_KEY = "hg_mic_device";
const CAM_DEV_KEY = "hg_cam_device";
const leggiDev = (k: string) => {
  try {
    return localStorage.getItem(k) || "";
  } catch {
    return "";
  }
};
export function getMicDeviceId(): string {
  return leggiDev(MIC_DEV_KEY);
}
export function getCamDeviceId(): string {
  return leggiDev(CAM_DEV_KEY);
}
/** Elenco dei dispositivi disponibili. I nomi arrivano solo DOPO che il permesso
 *  è stato dato: prima il browser li tiene nascosti. */
export async function elencaDispositivi(): Promise<{
  mic: MediaDeviceInfo[];
  cam: MediaDeviceInfo[];
}> {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    return {
      mic: all.filter((d) => d.kind === "audioinput"),
      cam: all.filter((d) => d.kind === "videoinput"),
    };
  } catch {
    return { mic: [], cam: [] };
  }
}
/** Cambia microfono: si riapre la catena sul dispositivo scelto e la voce
 *  riparte da lì, senza interrompere la chiamata. */
export async function setMicDevice(id: string) {
  try {
    localStorage.setItem(MIC_DEV_KEY, id);
  } catch {
    /* */
  }
  if (S.micOn) {
    await micRelease();
    await micAcquire();
  }
}
/** Cambia camera: stessa cosa per l'immagine. */
export async function setCamDevice(id: string) {
  try {
    localStorage.setItem(CAM_DEV_KEY, id);
  } catch {
    /* */
  }
  if (S.camOn) {
    await camRelease();
    await camAcquire();
  }
}

/** ── GIRA LA CAMERA: DAVANTI ⇄ DIETRO ─────────────────────────────────────
 *
 *  Richiesta del committente: «aggiungi un pulsante su Meetly per ruotare la
 *  videocamera agli ospiti o anche a me presentatore».
 *
 *  In una consulenza sui capelli la richiesta più frequente è «fammi vedere
 *  dietro», e con la camera frontale non si può: il cliente dovrebbe girarsi
 *  di spalle e perdere lo schermo. Finora la camera si poteva solo SCEGLIERE
 *  da un elenco, nelle impostazioni, e solo la propria.
 *
 *  Qui non si apre niente di nuovo: si sceglie l'altra camera e si passa per
 *  la strada di sempre (`setCamDevice` → `camRelease` + `camAcquire`), quella
 *  che sa già rimettere la sfocatura e sostituire la traccia a chi ti guarda
 *  senza interrompere la chiamata.
 *  ⚠️ QUALE SIA «L'ALTRA» LO DECIDE UNA REGOLA PROVATA (shop/gira-camera): si
 *   legge il nome del dispositivo, e se non c'è si passa alla camera dopo.
 *  ⚠️ CON UNA CAMERA SOLA NON SI GIRA, E SI DICE: un pulsante che non fa
 *   niente quando lo premi è peggio di un pulsante spento. */
export async function giraCamera(): Promise<{ ok: boolean; motivo?: string }> {
  try {
    const { cam } = await elencaDispositivi();
    const camere = cam.map((d) => ({ id: d.deviceId, nome: d.label }));
    if (!siPuoGirare(camere)) return { ok: false, motivo: "questo dispositivo ha una camera sola" };
    const prima = getCamDeviceId();
    const prossima = prossimaCamera({ camere, attuale: prima });
    if (!prossima) return { ok: false, motivo: "non c'è un'altra camera da usare" };
    /*  ⚠️ CON LA CAMERA SPENTA NON SI GIRA NIENTE A SCHERMO: la scelta si
        ricorda (si aprirà quella nuova) ma l'immagine non cambia, e chi ha
        premuto deve sapere perché — se no sembra che il pulsante non
        funzioni. */
    if (!S.camOn) {
      await setCamDevice(prossima);
      return { ok: false, motivo: "la camera è spenta: accendila e si aprirà quella nuova" };
    }
    await setCamDevice(prossima);
    /*  ⚠️ SE L'ALTRA NON SI APRE SI TORNA INDIETRO, SUBITO. Girare vuol dire
        chiudere una camera e aprirne un'altra: se la seconda non si apre (il
        browser la rifiuta, un'altra applicazione la tiene, su iPhone capita)
        si resterebbe al BUIO — che è molto peggio del non aver girato. */
    if (!S.camOn) {
      await setCamDevice(prima);
      return {
        ok: false,
        motivo: "il browser non ha aperto l'altra camera: ho rimesso quella di prima",
      };
    }
    console.log("[CAM] camera girata →", camere.find((c) => c.id === prossima)?.nome || prossima);
    return { ok: true };
  } catch (e) {
    console.warn("[CAM] la camera non si è girata", e);
    return { ok: false, motivo: "il browser non ha lasciato cambiare camera" };
  }
}

/** Gira la camera di un ospite, da qui. Il suo dispositivo fa la stessa cosa
 *  che farebbe lui premendo il pulsante, e risponde com'è andata. */
export function giraCameraOspite(pid: string) {
  if (S.role !== "host" || !pid) return;
  console.log("[HOST] chiedo di girare la camera a", pid);
  send("giracam", { to: pid });
}

function micAudioConstraints(conScelto = true): MediaTrackConstraints {
  const on = S.audio.ns;
  //  ⚠️ `conScelto: false` serve alla scala dei tentativi (shop/apertura-camera),
  //   che il dispositivo scelto a mano lo aggiunge — e lo toglie — da sé.
  const dev = conScelto ? getMicDeviceId() : "";
  return {
    noiseSuppression: on,
    autoGainControl: on,
    echoCancellation: true,
    ...(dev ? { deviceId: { exact: dev } } : {}),
  } as MediaTrackConstraints;
}

let micRaw: MediaStreamTrack | null = null; // traccia GREZZA del dispositivo: è quella INVIATA
// ── PERCHÉ IL MISURATORE MISURA UN DOPPIONE ────────────────────────────────
//  La soglia chiude con `micRaw.enabled = false`. Una traccia disattivata non
//  smette di esistere: consegna SILENZIO a tutti i suoi destinatari, e fra
//  quelli c'è anche l'analizzatore di Web Audio. Misurando la traccia inviata,
//  il primo istante di silenzio la chiudeva, la chiusura azzerava la misura, e
//  con la misura a −100 dB la porta non poteva PIÙ RIAPRIRE: consulente muto
//  per il resto della chiamata, senza errori e senza spie. La soglia si
//  autochiudeva a chiave.
//  Rimedio: si misura un DOPPIONE della traccia (`clone()`), che condivide lo
//  stesso dispositivo e la stessa elaborazione del browser ma ha un `enabled`
//  tutto suo. La soglia spegne l'originale; il doppione continua a sentire la
//  voce e sa quando riaprire. Il doppione non viene inviato a nessuno.
let micMeterTrack: MediaStreamTrack | null = null;
let micCtx: AudioContext | null = null;
let micSrcNode: MediaStreamAudioSourceNode | null = null;
let micAnalyser: AnalyserNode | null = null;
let micOut: MediaStreamTrack | null = null; // traccia inviata: è SEMPRE micRaw (vedi sopra)
let micMeterTimer = 0;
let micBuf: Float32Array | null = null;
let micLevelDb = -100;
let micGateOpen = false;
let micGateHoldUntil = 0;
let micLastTick = 0; // quando ha girato l'ultima volta il misuratore
let micGateOpenUntil = 0; // finestra in cui la soglia NON può chiudere (vedi sotto)
let micGateAbbandonata = false; // soglia rinunciata per questa sessione di microfono
let micUserMuted = false; // muto/push-to-talk deciso dall'UTENTE: batte la soglia
// ── PROVA DI VITA DEL MISURATORE ───────────────────────────────────────────
//  La soglia è l'unica cosa capace di azzerare la voce, e si fida ciecamente
//  del misuratore. Se il misuratore non vedesse nulla — doppione che non
//  consegna campioni, contesto in uno stato strano, differenza fra browser —
//  leggerebbe silenzio assoluto per sempre e la porta non riaprirebbe mai più.
//  Quindi la soglia non entra in funzione finché il misuratore non ha
//  dimostrato ALMENO UNA VOLTA di sentire qualcosa. Finché tace davvero non c'è
//  nulla da tagliare, e al primo suono la prova arriva da sola.
let micMeterVivo = false;
let gateSilentSince = 0; // da quando c'è voce ma la porta resta chiusa
// ── I NUMERI DELLA SOGLIA, E PERCHÉ ─────────────────────────────────────────
//  APERTURA: immediata. `enabled = true` non ha rampa da percorrere, quindi la
//  prima sillaba non parte più in dissolvenza (prima costava 150 ms di rampa).
//  TENUTA prima di chiudere: 700 ms. Erano 400 ms di tenuta + 250 ms di rampa
//  di rilascio ≈ 650 ms di coda reale; senza rampa quella coda sparirebbe e le
//  code di frase verrebbero troncate di netto, quindi la si riporta nella
//  tenuta. Copre anche le pause dentro la frase.
//  ISTERESI: 8 dB più in basso per chiudere (GATE_HYSTERESIS_DB, vedi sotto):
//  una volta aperta la porta resta aperta per tutta la frase.
const GATE_HOLD_MS = 700;
//  GARANZIA DI APERTURA: la soglia può chiudere solo se il misuratore è
//  ATTENDIBILE. Appena la catena si (ri)costruisce, o quando il misuratore ha
//  saltato dei giri, si resta aperti a prescindere dal livello. Il modo di
//  fallire diventa "passa un po' di rumore di stanza" invece di "il cliente
//  non ti sente": in una consulenza il secondo costa la vendita.
const GATE_GRACE_MS = 1500; // dopo ogni ricostruzione della catena
const GATE_STARVE_MS = 400; // tick più lento di così ⇒ misura non attendibile
const GATE_STARVE_OPEN_MS = 3000; // …e allora si resta aperti per 3 s

/** Livello d'ingresso corrente in dBFS (−100 = silenzio). Per il misuratore. */
export function getMicLevelDb(): number {
  return micLevelDb;
}
/** true se in questo istante la soglia sta lasciando passare la voce. */
export function isMicGateOpen(): boolean {
  return !S.audio.gate || micGateOpen;
}
/** true se la catena audio è viva (microfono realmente aperto). */
export function isMicPipelineLive(): boolean {
  return !!micRaw && micRaw.readyState === "live";
}

/** La soglia decide solo se richiesta, non abbandonata, con la scheda in primo
 *  piano e fuori dalla finestra di garanzia. In tutti gli altri casi la voce
 *  passa e il misuratore si limita a misurare. */
function gateAttiva(): boolean {
  if (!S.audio.gate || micGateAbbandonata || !micMeterVivo) return false;
  // ── SCHEDA NASCOSTA = SOGLIA DISINSERITA ──────────────────────────────────
  //  È la situazione normale del presentatore: condivide le slide e passa a
  //  un'altra finestra. Lì il browser porta i timer a 1 al secondo e, dopo 5
  //  minuti, a 1 al minuto: il misuratore smette di poter decidere. Se la
  //  soglia fosse chiusa in quel momento resterebbe chiusa — muti mentre si
  //  parla, e senza guardare lo schermo non c'è modo di accorgersene.
  if (typeof document !== "undefined" && document.hidden) return false;
  return Date.now() >= micGateOpenUntil;
}
/** UNICO punto che tocca `enabled` della traccia inviata.
 *  Il muto dell'utente (pulsante / push-to-talk) ha SEMPRE la precedenza sulla
 *  soglia: la soglia può solo togliere audio a chi sta trasmettendo, mai
 *  rimettere in onda chi si è messo in muto. */
function applyMicEnabled() {
  const t = micRaw;
  if (!t || t.readyState !== "live") return;
  const vuoi = !micUserMuted && (!gateAttiva() || micGateOpen);
  if (t.enabled !== vuoi) {
    try {
      t.enabled = vuoi;
    } catch {
      /* */
    }
  }
}
/** Tiene la soglia aperta per `ms`: si usa quando la misura non è attendibile
 *  (catena appena costruita, misuratore in ritardo, contesto audio fermo). */
function garantisciApertura(ms: number, motivo?: string) {
  const ora = Date.now();
  //  Si avvisa solo all'INGRESSO nella garanzia: un thread principale carico
  //  ripete questa chiamata a ogni tick e riempirebbe la console di rumore,
  //  seppellendo i messaggi che servono davvero a capire una chiamata andata male.
  if (motivo && ora >= micGateOpenUntil) console.warn(`[MIC] soglia tenuta APERTA (${motivo})`);
  if (ora + ms > micGateOpenUntil) micGateOpenUntil = ora + ms;
  micGateOpen = true;
  gateSilentSince = 0;
  applyMicEnabled();
}
/** Rinuncia alla soglia fino alla prossima ricostruzione della catena: si usa
 *  quando il misuratore non è più affidabile e non può quindi RIAPRIRE.
 *  Non tocca le preferenze dell'utente: `S.audio.gate` resta com'è e la soglia
 *  torna in funzione al prossimo riacquisto del microfono. */
function abbandonaSoglia(motivo: string) {
  if (!micGateAbbandonata)
    console.warn(`[MIC] soglia di attivazione abbandonata (${motivo}) → la voce passa comunque`);
  micGateAbbandonata = true;
  micGateOpen = true;
  gateSilentSince = 0;
  applyMicEnabled();
}
// ── VOCE "ROBOTICA / A SCATTI" CHE NON SI RISOLVEVA ─────────────────────────
//  Due guasti producono esattamente quel sintomo, e nessuno dei due si ripara
//  da solo:
//
//  1) CONTESTO AUDIO SOSPESO. Il browser sospende l'AudioContext (finestra
//     coperta, cambio di dispositivo audio, risparmio energetico). Da sospeso
//     l'analizzatore non produce più campioni: il misuratore si ferma e la
//     soglia resterebbe congelata nello stato in cui si trovava — se era
//     chiusa, il cliente non sente più nulla e non se ne accorge nessuno.
//     → sorveglianza ogni secondo: se il contesto non è "running" lo si riavvia
//     e nel frattempo la soglia viene tenuta APERTA. Se non riparte, la soglia
//     viene abbandonata per il resto della chiamata: la voce passa comunque.
//     NB: da quando ai partecipanti va la traccia del dispositivo, un contesto
//     sospeso non può più deformare l'audio trasmesso — al massimo spegne il
//     misuratore. È la ragione per cui questo guasto non è più critico.
//
//  2) SOGLIA CHE SFARFALLA. Apertura e chiusura usavano la STESSA soglia: con la
//     voce che le sta sopra di poco, la porta sbatteva decine di volte al
//     secondo tagliando le sillabe — l'effetto "robotico".
//     → ora chiude 8 dB PIÙ IN BASSO di dove apre, così una volta aperta resta
//     aperta per tutta la frase.
const GATE_HYSTERESIS_DB = 8;
let micCtxBadSince = 0;
async function micWatchdog() {
  //  Prima di tutto: il microfono VERO sta ancora producendo? Un dispositivo
  //  sospeso non emette sempre l'evento, quindi lo si verifica comunque —
  //  riusando questo timer, che gira già una volta al secondo.
  if (S.micOn && micRaw && (micRaw.readyState !== "live" || micRaw.muted)) {
    micRecuperaSeMorto("controllo periodico");
    return;
  }
  //  Il doppione che alimenta il misuratore è morto ma il microfono no: senza
  //  misura la soglia non potrebbe più riaprire, quindi si rinuncia subito.
  if (micMeterTrack && micMeterTrack.readyState !== "live" && !micGateAbbandonata)
    abbandonaSoglia("misuratore senza sorgente");
  if (!micCtx) return;
  if (micCtx.state === "running") {
    micCtxBadSince = 0;
    return;
  }
  if (!micCtxBadSince) {
    micCtxBadSince = Date.now();
    console.warn("[MIC] contesto audio non attivo:", micCtx.state, "→ riavvio");
  }
  //  Contesto fermo = misuratore fermo: finché non riparte la soglia non deve
  //  poter chiudere, o si resterebbe muti senza accorgersene.
  garantisciApertura(5000);
  try {
    await micCtx.resume();
  } catch {
    /* */
  }
  if ((micCtx.state as string) === "running") {
    console.log("[MIC] contesto audio ripristinato");
    micCtxBadSince = 0;
    return;
  }
  // non si riprende: si rinuncia alla soglia (la voce del dispositivo passa già così com'è)
  if (Date.now() - micCtxBadSince > 2500 && micRaw && micRaw.readyState === "live") {
    micCtxBadSince = 0;
    abbandonaSoglia("contesto audio irrecuperabile");
  }
}

function startMicMeter() {
  if (micMeterTimer) {
    clearInterval(micMeterTimer);
    micMeterTimer = 0;
  }
  let ticks = 0;
  micLastTick = 0;
  micMeterTimer = window.setInterval(() => {
    const now = Date.now();
    const dt = micLastTick ? now - micLastTick : 0;
    micLastTick = now;
    if (++ticks % 33 === 0) void micWatchdog(); // ~1s
    if (!micAnalyser || !micBuf) return;
    try {
      micAnalyser.getFloatTimeDomainData(micBuf as any);
    } catch {
      return;
    }
    let sum = 0;
    for (let i = 0; i < micBuf.length; i++) sum += micBuf[i] * micBuf[i];
    const rms = Math.sqrt(sum / micBuf.length);
    micLevelDb = rms > 1e-7 ? Math.max(-100, 20 * Math.log10(rms)) : -100;
    //  Prima lettura sopra il fondo scala = il misuratore vede davvero (vedi
    //  `micMeterVivo`): solo da qui in poi la soglia può chiudere la voce.
    if (!micMeterVivo && micLevelDb > -95) micMeterVivo = true;
    // ── IL MISURATORE È IN RITARDO? ALLORA NON DECIDE ────────────────────────
    //  Questo timer gira sul thread principale, lo stesso dei compositor di
    //  sfocatura/condivisione/registrazione, e il browser lo rallenta a 1 Hz
    //  (poi a 1 al minuto) quando la scheda non è visibile. Un tick arrivato
    //  molto in ritardo descrive un passato lontano: usarlo per chiudere la
    //  soglia significa tagliare la voce alla cieca. Meglio restare aperti.
    if (S.audio.gate && dt > GATE_STARVE_MS)
      garantisciApertura(GATE_STARVE_OPEN_MS, `misuratore in ritardo di ${dt} ms`);
    //  Soglia spenta dalle preferenze, abbandonata o in finestra di garanzia:
    //  qui il misuratore MISURA soltanto, e la voce passa.
    if (!gateAttiva()) {
      micGateOpen = true;
      gateSilentSince = 0;
      applyMicEnabled();
      return;
    }
    /*  ── ⚠️ MENTRE PARLA L'ALTRO SERVE UNA VOCE VICINA ──────────────────
        La sua voce esce dai nostri altoparlanti e rientra nel nostro
        microfono: per la soglia quell'eco è «voce», la porta si apriva e gli
        rimandavamo indietro la sua stessa voce in ritardo. Vedi
        shop/soglia-voce. */
    const altriParlano = S.speakingPids.some((p) => p && p !== S.myPid);
    const openAt = sogliaApertura(S.audio.gateDb, altriParlano);
    const closeAt = S.audio.gateDb - GATE_HYSTERESIS_DB; // …e chiude più in basso
    if (micLevelDb >= (micGateOpen ? closeAt : openAt)) {
      micGateHoldUntil = now + GATE_HOLD_MS;
      gateSilentSince = 0;
      micGateOpen = true; // apertura immediata: nessuna rampa da percorrere
    } else if (micGateOpen && now > micGateHoldUntil) {
      micGateOpen = false;
    }
    // ── VALVOLA DI SICUREZZA: LA VOCE NON PUÒ RESTARE MUTA ───────────────────
    //  La soglia anti-rumore è l'unico punto in grado di azzerare completamente
    //  la voce in uscita. Se il livello impostato è troppo alto per il microfono
    //  in uso — o se il microfono ha un guadagno basso — la porta non si apre
    //  MAI e il cliente non sente nulla, senza alcun segnale del perché.
    //  Qui: se c'è del suono reale in ingresso ma la porta è rimasta chiusa per
    //  più di 3 secondi, la soglia viene disattivata e la voce passa comunque.
    //  Meglio un po' di rumore di fondo che una consulenza muta.
    if (valvolaPuoSpegnere({ livelloDb: micLevelDb, gateAperta: micGateOpen, altriParlano })) {
      if (!gateSilentSince) gateSilentSince = now;
      else if (now - gateSilentSince > 3000) {
        gateSilentSince = 0;
        console.warn(
          `[MIC] c'è voce (${Math.round(micLevelDb)} dB) ma la soglia (${S.audio.gateDb} dB) non si apre → soglia DISATTIVATA per non restare muti`,
        );
        micGateOpen = true;
        setAudioPrefs({ gate: false });
      }
    } else if (micGateOpen) gateSilentSince = 0;
    applyMicEnabled(); // unico punto che tocca `enabled`: sempre in coda al calcolo
  }, 30);
}

/** Smonta il grafo audio. `keepRaw` conserva la traccia sorgente del dispositivo. */
function stopMicPipeline(opts?: { keepRaw?: boolean }) {
  if (micMeterTimer) {
    clearInterval(micMeterTimer);
    micMeterTimer = 0;
  }
  try {
    micSrcNode?.disconnect();
  } catch {
    /* */
  }
  try {
    micAnalyser?.disconnect();
  } catch {
    /* */
  }
  //  `micOut` è la traccia del dispositivo: la ferma (o la conserva) il blocco
  //  `keepRaw` più sotto. Il confronto resta a difesa di eventuali tracce
  //  sintetizzate residue di una versione precedente della catena.
  if (micOut && micOut !== micRaw) {
    try {
      micOut.stop();
    } catch {
      /* */
    }
  }
  //  Il doppione del misuratore si ferma SEMPRE, anche con `keepRaw`: è una
  //  traccia viva sullo stesso dispositivo, e dimenticarla accesa terrebbe
  //  occupato il microfono (spia di sistema compresa) dopo il rilascio.
  //  Chi ricostruisce la catena ne crea subito uno nuovo dalla traccia grezza.
  if (micMeterTrack) {
    try {
      micMeterTrack.stop();
    } catch {
      /* */
    }
    micMeterTrack = null;
  }
  //  ── SI SPEGNE IL MISURATORE, NON IL MICROFONO ────────────────────────────
  //  Da quando la soglia agisce su `enabled`, una traccia conservata potrebbe
  //  restare disattivata per sempre: senza misuratore nessuno la riaprirebbe.
  //  Chi resta vivo torna a trasmettere — salvo il muto voluto dall'utente.
  if (opts?.keepRaw && micRaw && micRaw.readyState === "live" && !micUserMuted && !micRaw.enabled) {
    try {
      micRaw.enabled = true;
    } catch {
      /* */
    }
  }
  // ── IL CONTESTO AUDIO NON SI CHIUDE ─────────────────────────────────────
  //  Qui c'era `micCtx.close()`. Ma quel contesto NON è del microfono: è
  //  QUELLO CONDIVISO da tutta l'applicazione (voce, suoni, rilevamento di chi
  //  parla) — condiviso apposta, perché aprirne uno per ciascuno faceva
  //  degradare l'audio fino a farlo sembrare robotico.
  //  Chiuderlo è definitivo: un contesto chiuso non si riapre. Bastava
  //  spegnere e riaccendere il microfono una volta — o cambiare una
  //  preferenza audio — e da lì in poi la catena della voce non si poteva più
  //  costruire: si ripiegava sul microfono grezzo, i suoni sparivano e il
  //  rilevamento di chi parla smetteva di funzionare, per tutta la sessione.
  //  Si staccano i nodi (già fatto sopra) e basta: il contesto resta vivo.
  micCtx = null;
  micSrcNode = null;
  micAnalyser = null;
  micOut = null;
  micBuf = null;
  micLevelDb = -100;
  micGateOpen = false;
  micGateHoldUntil = 0;
  micGateOpenUntil = 0;
  micLastTick = 0;
  micGateAbbandonata = false;
  micMeterVivo = false;
  //  Si sganciano i guardiani prima di fermare la traccia: fermarla scatena
  //  `ended`, che altrimenti farebbe ripartire il microfono che stiamo chiudendo.
  if (micRaw) {
    micRaw.onended = null;
    micRaw.onmute = null;
    micRaw.onunmute = null;
  }
  if (!opts?.keepRaw) {
    if (micRaw) {
      try {
        micRaw.stop();
      } catch {
        /* */
      }
    }
    micRaw = null;
  }
}

// ── IL MICROFONO PUÒ MORIRE SENZA CHE NESSUNO LO SAPPIA ────────────────────
//  Il microfono vero può sparire senza dirlo — cuffie Bluetooth che si
//  agganciano, jack inserito, uscita audio cambiata dal sistema, un'altra
//  applicazione che se lo prende in esclusiva. Quando ai peer si mandava
//  l'uscita della catena Web Audio, quell'uscita restava "viva" PER SEMPRE:
//  il consulente trasmetteva un segnale perfettamente valido di puro silenzio,
//  nessun errore, nessuna spia. È il difetto per cui "non si sente il
//  presentatore". Ora ai peer va la traccia del dispositivo, che almeno
//  dichiara il proprio stato — ma `ended`/`mute` non arrivano sempre, quindi
//  la sorveglianza resta su tre fronti: gli eventi della traccia, il cambio di
//  dispositivi del sistema, e un controllo ogni secondo.
let micGuardOn = false;
/** Riapre il microfono se la sorgente vera non sta più producendo nulla. */
function micRecuperaSeMorto(motivo: string) {
  if (!S.micOn || micBusy) return;
  if (micRaw && micRaw.readyState === "live" && !micRaw.muted) return;
  console.warn(`[MIC] sorgente non più attiva (${motivo}) → riapro il microfono`);
  void micAcquire();
}
function armaSorveglianzaMic() {
  if (micGuardOn || typeof navigator === "undefined") return;
  micGuardOn = true;
  try {
    navigator.mediaDevices?.addEventListener?.("devicechange", () =>
      micRecuperaSeMorto("cambio dispositivi"),
    );
  } catch {
    /* */
  }
  //  La soglia si disinserisce da sola quando la scheda non è visibile (vedi
  //  `gateAttiva`). Qui serve solo far valere subito la cosa sulla traccia,
  //  senza aspettare un tick che in quel momento potrebbe non arrivare mai;
  //  al ritorno in primo piano si lascia riassestare la misura prima che la
  //  soglia possa di nuovo chiudere.
  try {
    document.addEventListener("visibilitychange", () => {
      micLastTick = 0;
      if (document.hidden) {
        micGateOpen = true;
        gateSilentSince = 0;
        applyMicEnabled();
        return;
      }
      garantisciApertura(GATE_GRACE_MS);
    });
  } catch {
    /* */
  }
}

/** Aggancia il misuratore alla traccia del dispositivo e restituisce LA STESSA
 *  traccia, che è quella che va ai partecipanti. Web Audio non sta più nel
 *  percorso della voce: è una presa laterale (vedi l'intestazione di sezione). */
function buildMicChain(raw: MediaStreamTrack): MediaStreamTrack {
  stopMicPipeline({ keepRaw: true });
  micRaw = raw;
  micOut = raw;
  //  Si riparte APERTI, non chiusi: alla prima parola dopo un riacquisto o un
  //  cambio microfono non si perde la sillaba iniziale aspettando il misuratore.
  garantisciApertura(GATE_GRACE_MS);
  //  `ended` = dispositivo scomparso · `mute` = dispositivo sospeso dal sistema
  //  (è il caso delle cuffie che si agganciano: la traccia resta "viva" ma non
  //  produce più nulla, ed è quello che nessun controllo vedeva).
  raw.onended = () => micRecuperaSeMorto("traccia terminata");
  raw.onmute = () => micRecuperaSeMorto("traccia sospesa");
  raw.onunmute = () => console.log("[MIC] sorgente tornata attiva");
  armaSorveglianzaMic();
  try {
    micCtx = audioCtx();
    if (!micCtx) throw new Error("audio non disponibile");
    try {
      void micCtx!.resume?.();
    } catch {
      /* */
    }
    //  Si misura il DOPPIONE, non la traccia inviata (vedi `micMeterTrack`):
    //  altrimenti la prima chiusura della soglia accecherebbe il misuratore e
    //  la porta non potrebbe più riaprire.
    let senzaDoppione = false;
    let sorgenteMisura: MediaStreamTrack = raw;
    try {
      const dup = raw.clone();
      dup.enabled = true; // indipendente dall'originale: la soglia non lo tocca mai
      micMeterTrack = dup;
      sorgenteMisura = dup;
    } catch {
      //  Duplicazione non riuscita: si può ancora MISURARE la traccia inviata,
      //  ma non si può più CHIUDERLA senza restare ciechi → soglia rinunciata
      //  (più in basso, a misuratore avviato). La voce passa comunque.
      micMeterTrack = null;
      senzaDoppione = true;
    }
    micSrcNode = micCtx!.createMediaStreamSource(new MediaStream([sorgenteMisura]));
    micAnalyser = micCtx!.createAnalyser();
    micAnalyser.fftSize = 1024;
    micAnalyser.smoothingTimeConstant = 0.1;
    micBuf = new Float32Array(micAnalyser.fftSize);
    //  RAMO LATERALE: l'analizzatore non è collegato a nulla a valle, quindi
    //  non c'è alcun percorso da Web Audio verso i partecipanti. Nemmeno una
    //  frequenza di campionamento sbagliata o un contesto sospeso possono
    //  toccare la voce trasmessa: al massimo fermano il misuratore.
    micSrcNode.connect(micAnalyser);
    startMicMeter();
    if (senzaDoppione) abbandonaSoglia("impossibile duplicare la traccia per il misuratore");
    return raw;
  } catch {
    //  Web Audio non disponibile: niente misuratore e quindi niente soglia (che
    //  senza misura non potrebbe mai riaprire), ma la voce parte comunque — è
    //  già la traccia del dispositivo.
    stopMicPipeline({ keepRaw: true });
    micRaw = raw;
    micOut = raw;
    abbandonaSoglia("Web Audio non disponibile");
    return raw;
  }
}

// ── persistenza preferenze audio (server per-presentatore + specchio locale) ──
let audioSaveTimer: ReturnType<typeof setTimeout> | null = null;
function queueSaveAudioPrefs() {
  const p = readStoredPresenter();
  if (!p?.id) return;
  if (audioSaveTimer) clearTimeout(audioSaveTimer);
  audioSaveTimer = setTimeout(() => {
    audioSaveTimer = null;
    fetch("/api/presenter/prefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presenterId: p.id, audio: S.audio }),
    }).catch(() => {});
  }, 600);
}
/** Carica le preferenze audio del presentatore loggato (fallback: default). */
export async function loadAudioPrefs(): Promise<void> {
  const p = readStoredPresenter();
  if (!p?.id) return;
  try {
    const r = await fetch(`/api/presenter/prefs?presenterId=${encodeURIComponent(p.id)}`);
    const j = await r.json();
    if (!j?.audio) return; // nessuna preferenza salvata → resta il default
    const next = normAudio(j.audio);
    set({ audio: next });
    try {
      localStorage.setItem(AUDIO_KEY, JSON.stringify(next));
    } catch {
      /* */
    }
    await applyAudioPrefsLive(true);
  } catch {
    /* offline → vale lo specchio locale */
  }
}
/** Modifica una preferenza audio: stato + specchio locale + salvataggio (debounce) + effetto live. */
export function setAudioPrefs(p: Partial<AudioPrefs>) {
  const next = normAudio({ ...S.audio, ...p });
  const nsChanged = next.ns !== S.audio.ns;
  set({ audio: next });
  try {
    localStorage.setItem(AUDIO_KEY, JSON.stringify(next));
  } catch {
    /* */
  }
  queueSaveAudioPrefs();
  void applyAudioPrefsLive(nsChanged);
}
/** Applica le preferenze al microfono già aperto (nessuna rinegoziazione). */
async function applyAudioPrefsLive(nsChanged: boolean) {
  const cur = localStream?.getAudioTracks()[0] || null;
  const live = !!cur && !isPlaceholder(cur) && cur.readyState === "live";
  if (!live) return; // microfono rilasciato → si applica al riacquisto
  if (!micRaw || micRaw.readyState !== "live") {
    await micAcquire();
    return;
  }
  if (nsChanged) {
    try {
      await micRaw.applyConstraints(micAudioConstraints());
    } catch {
      await micAcquire();
      return;
    } // il browser non applica a caldo → riacquisto
  }
  // ── NIENTE RICOSTRUZIONE SE NON SERVE ──────────────────────────────────────
  //  `gate` e `gateDb` li rilegge il misuratore da `S.audio` a ogni giro: non
  //  c'è nulla da ricostruire. Rifare la catena qui era pesante e arrivava nel
  //  momento peggiore: il cursore della soglia manda un `setAudioPrefs` a ogni
  //  scatto — e il pannello invita esplicitamente a regolarlo MENTRE si parla —
  //  e la valvola di sicurezza lo chiama da DENTRO il tick del misuratore, che
  //  così azzerava il proprio timer mentre stava girando.
  //  Si concede solo una finestra di apertura: dopo un cambio di preferenza la
  //  voce passa comunque per un attimo, poi la soglia riprende a decidere.
  if (!nsChanged && micRaw === cur && micAnalyser && micMeterTimer) {
    garantisciApertura(GATE_GRACE_MS);
    return;
  }
  //  Il muto voluto dall'utente vive in `micUserMuted`, non nello stato della
  //  traccia: `enabled` ora lo muove anche la soglia, quindi leggerlo qui
  //  significherebbe congelare un muto che l'utente non ha mai chiesto.
  const out = buildMicChain(micRaw);
  if (out !== cur) {
    // oggi out === cur: la traccia è la stessa
    await replaceAudioTrackAll(out);
    setLocalTrack("audio", out);
  }
  applyMicEnabled();
}

// ── microfono ─────────────────────────────────────────────────────────────
let micBusy = false;
let micIdleTimer: ReturnType<typeof setTimeout> | null = null;
async function micAcquire(): Promise<boolean> {
  if (micBusy) return false;
  micBusy = true;
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: micAudioConstraints() });
    const raw = s.getAudioTracks()[0];
    if (!raw) return false;
    stopMicPipeline(); // misuratore precedente + vecchia sorgente
    micUserMuted = false; // aprire il microfono È la volontà di parlare
    const track = buildMicChain(raw); // misuratore + soglia sulla traccia del device
    await replaceAudioTrackAll(track);
    const old = localStream?.getAudioTracks() || [];
    setLocalTrack("audio", track);
    old.forEach((t) => {
      if (!isPlaceholder(t) && t !== track && t !== raw) {
        try {
          t.stop();
        } catch {
          /* */
        }
      }
    });
    set({ micOn: true });
    return true;
  } catch {
    set({ micOn: false });
    return false;
  } finally {
    micBusy = false;
  }
}
/** Spegne il microfono RILASCIANDO il dispositivo: al suo posto una traccia silenziosa. */
async function micRelease() {
  if (micBusy) return;
  micBusy = true;
  try {
    const old = localStream?.getAudioTracks() || [];
    const ph = getSilentTrack();
    await replaceAudioTrackAll(ph);
    setLocalTrack("audio", ph);
    stopMicPipeline(); // misuratore Web Audio + sorgente: dispositivo LIBERO
    old.forEach((t) => {
      if (!isPlaceholder(t)) {
        try {
          t.stop();
        } catch {
          /* */
        }
      }
    });
    micUserMuted = false; // niente traccia da tenere muta: al riacquisto si parte a trasmettere
    set({ micOn: false });
  } finally {
    micBusy = false;
  }
}
/*  ── ⚠️ IL MUTO NON SI PERDE, E NON ASPETTA ───────────────────────────────
    Segnalazione del committente: «quando muto il microfono, non si muta».
    Due modi in cui poteva succedere, e capitavano proprio all'inizio della
    chiamata, che è quando si preme quel pulsante:

     1. LA RICHIESTA VENIVA BUTTATA VIA. `micAcquire`/`micRelease` si
        proteggono con `micBusy`, e chi trovava la catena occupata usciva
        SENZA fare niente e senza lasciare traccia: premere "muto" mentre il
        microfono si stava ancora aprendo (getUserMedia dura un paio di
        secondi) non muteva nulla — e il pulsante restava com'era.
     2. IL MUTO ARRIVAVA TARDI. `micRelease` spegne davvero solo dopo aver
        sostituito la traccia su OGNI connessione, una alla volta. In quella
        finestra la voce usciva ancora, e il sorvegliante della voce (vedi
        "LA VOCE ARRIVA DAVVERO?") poteva perfino riagganciare il microfono
        appena staccato.

    Adesso c'è un'INTENZIONE, che nessuno può perdere: si registra cosa vuole
    l'utente, la voce si taglia all'istante sulla traccia che sta uscendo, e il
    lavoro pesante (rilascio del dispositivo, sostituzione delle tracce) viene
    svolto appena la catena si libera. Se nel frattempo l'utente cambia idea,
    vale l'ultima intenzione. */
let micVuole: boolean | null = null; // intenzione in attesa: true = acceso, false = muto
/** true se l'utente ha chiesto il muto e il lavoro non è ancora finito. */
function micMutoVoluto(): boolean {
  return micVuole === false || micUserMuted;
}
/** Taglia la voce ADESSO sulla traccia che sta uscendo, senza aspettare
 *  niente: chi preme "muto" non deve farsi sentire un istante di più. */
function zittisciSubito() {
  micUserMuted = true;
  for (const t of [micRaw, localStream?.getAudioTracks()[0] || null]) {
    if (t && !isPlaceholder(t) && t.readyState === "live" && t.enabled) {
      try {
        t.enabled = false;
      } catch {
        /* */
      }
    }
  }
  if (S.micOn) set({ micOn: false });
}
/** Porta il microfono nello stato voluto appena la catena è libera.
 *  Il ciclo rilegge l'intenzione a ogni giro: se l'utente ha premuto due
 *  volte mentre si lavorava, conta l'ultima. */
async function micApplicaIntento() {
  while (micVuole !== null && !micBusy) {
    const vuoi = micVuole;
    micVuole = null;
    if (vuoi) await micAcquire();
    else await micRelease();
  }
}
export function toggleMic() {
  if (micIdleTimer) {
    clearTimeout(micIdleTimer);
    micIdleTimer = null;
  }
  const acceso = micVuole ?? S.micOn;
  micVuole = !acceso;
  if (!micVuole) zittisciSubito();
  void micApplicaIntento();
}
/** Push-to-talk (keydown = on, keyup = off): via RAPIDA con `enabled`, così un tasto
 *  tenuto premuto trasmette SUBITO. Dopo ~5s di silenzio il device viene comunque
 *  rilasciato davvero (spia/occupazione del microfono liberate). */
const MIC_IDLE_RELEASE_MS = 5000;
export function setMicOn(on: boolean) {
  //  Anche qui si registra l'intenzione: push-to-talk e comando del
  //  presentatore passano di qui, e devono valere quanto il pulsante.
  micVuole = null;
  const t = localStream?.getAudioTracks()[0] || null;
  const real = !!t && !isPlaceholder(t) && t.readyState === "live";
  if (on) {
    if (micIdleTimer) {
      clearTimeout(micIdleTimer);
      micIdleTimer = null;
    }
    micUserMuted = false;
    //  Si trasmette SUBITO e si concede una finestra di apertura: il tasto è
    //  appena stato premuto, il misuratore non ha ancora visto la voce e senza
    //  questa garanzia la soglia taglierebbe la prima sillaba.
    if (real) {
      if (!t!.enabled) t!.enabled = true;
      garantisciApertura(GATE_GRACE_MS);
      if (!S.micOn) set({ micOn: true });
      return;
    }
    void micAcquire(); // device già rilasciato → riacquisto (unica attesa possibile)
    return;
  }
  micUserMuted = true; // il muto dell'utente batte la soglia: nessun tick lo riaprirà
  if (real) t!.enabled = false;
  if (S.micOn) set({ micOn: false });
  if (micIdleTimer) clearTimeout(micIdleTimer);
  micIdleTimer = setTimeout(() => {
    micIdleTimer = null;
    if (!S.micOn) void micRelease();
  }, MIC_IDLE_RELEASE_MS);
}

// ── CONDIVISIONE SCHERMO CON INQUADRATURA ──────────────────────────────────
//  Lo schermo di un computer è largo; il telefono del cliente è alto. Inviando
//  lo schermo così com'è, sul suo dispositivo diventa una striscia minuscola in
//  mezzo a due bande nere. Qui lo schermo viene RI-INQUADRATO nella forma del
//  suo dispositivo: si riempie il quadro e si taglia il superfluo ai lati,
//  centrando il contenuto. La forma si sceglie dalla barra: automatica (quella
//  reale del cliente collegato), telefono, tablet o computer.
export type ShareShape = "auto" | "mobile" | "tablet" | "desktop";
let shareShape: ShareShape = "auto";
let shareCanvas: HTMLCanvasElement | null = null;
let shareVideo: HTMLVideoElement | null = null;
let shareTimer = 0;
let shareSrcTrack: MediaStreamTrack | null = null;
let sharePrevMode: Mode = "call";
let sharePrevFocus: string | null = null;

const SHAPE_RATIO: Record<Exclude<ShareShape, "auto">, number> = {
  mobile: 390 / 844,
  tablet: 834 / 1112,
  desktop: 16 / 9,
};
function targetRatio(): number | null {
  if (shareShape !== "auto") return SHAPE_RATIO[shareShape];
  const g = S.guestViewport;
  return g && g.w > 0 && g.h > 0 ? g.w / g.h : null; // nessun ospite: nessun ritaglio
}

function stopShareFraming() {
  if (shareTimer) {
    clearInterval(shareTimer);
    shareTimer = 0;
  }
  if (shareVideo) {
    try {
      shareVideo.pause();
      shareVideo.srcObject = null;
    } catch {
      /* */
    }
    shareVideo = null;
  }
  shareCanvas = null;
  shareSrcTrack = null;
}

/** Riquadra la traccia dello schermo nella forma del dispositivo del cliente. */
function frameShareTrack(src: MediaStreamTrack): MediaStreamTrack {
  const ratio = targetRatio();
  if (!ratio || typeof document === "undefined") return src; // niente da adattare
  const st = src.getSettings?.() || {};
  const sw = Number(st.width) || 1280,
    sh = Number(st.height) || 720;
  if (Math.abs(sw / sh - ratio) < 0.05) return src; // forma già giusta
  try {
    // altezza fissa, larghezza dedotta dalla forma → nessun ridimensionamento inutile
    const H = Math.min(1280, Math.max(480, sh));
    const W = Math.round(H * ratio);
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const g = c.getContext("2d", { alpha: false });
    if (!g) return src;
    const v = document.createElement("video");
    v.muted = true;
    (v as any).playsInline = true;
    v.srcObject = new MediaStream([src]);
    void v.play().catch(() => {
      /* */
    });
    const draw = () => {
      const vw = v.videoWidth || sw,
        vh = v.videoHeight || sh;
      if (!vw || !vh) return;
      // RIEMPI e taglia (come "cover"): niente bande nere sul suo schermo
      const scale = Math.max(W / vw, H / vh);
      const dw = vw * scale,
        dh = vh * scale;
      // ── IL TAGLIO IN ALTEZZA PARTE DALL'ALTO, MAI DAL CENTRO ─────────────
      //  Col cliente in ORIZZONTALE la forma richiesta è larga e bassa: per
      //  riempirla si perde altezza. Centrando il ritaglio se ne perdeva metà
      //  sopra e metà sotto — e quello che sta sopra è la TESTA di chi si vede
      //  nella pagina condivisa (oltre all'intestazione di ogni schermata).
      //  Ancorando in alto si rinuncia solo al fondo: si perde il petto, mai
      //  la faccia. Il taglio in LARGHEZZA resta centrato, lì il soggetto sta
      //  in mezzo.
      g.drawImage(v, (W - dw) / 2, 0, dw, dh);
    };
    shareCanvas = c;
    shareVideo = v;
    shareSrcTrack = src;
    shareTimer = window.setInterval(draw, 1000 / 30);
    const out = (c as any).captureStream(30).getVideoTracks()[0] as MediaStreamTrack;
    try {
      (out as any).contentHint = "detail";
    } catch {
      /* */
    }
    console.log(`[SCHERMO] inquadratura ${W}×${H} (forma ${shareShape}) da sorgente ${sw}×${sh}`);
    return out || src;
  } catch {
    return src;
  }
}

/** Il consulente ha cambiato schermata: lo dice sul canale, così il cliente
 *  non deve aspettare il prossimo giro. Vedi `paginaDalCanale`. */
export function annunciaPagina(path: string) {
  if (S.role !== "host" || !path) return;
  try {
    send("pagina", { path });
  } catch {
    /* il giro di sicurezza ci arriva comunque */
  }
}

/** Cambia la forma dell'inquadratura, anche a condivisione già avviata. */
export async function setShareShape(v: ShareShape) {
  shareShape = v;
  set({ shareShape: v });
  try {
    localStorage.setItem("hg_share_shape", v);
  } catch {
    /* */
  }
  if (!S.sharing || !shareSrcTrack) return;
  const src = shareSrcTrack;
  stopShareFraming();
  const out = frameShareTrack(src);
  shareSrcTrack = src;
  await replaceVideoTrackAll(out, "forma inquadratura cambiata");
  setLocalTrack("video", out);
}

export async function shareScreen() {
  try {
    if (S.sharing) {
      const scr = localStream?.getVideoTracks() || [];
      const src = shareSrcTrack;
      stopShareFraming();
      if (src) {
        try {
          src.stop();
        } catch {
          /* */
        }
      }
      set({ sharing: false });
      // ripristino della vista precedente alla condivisione
      hostSetMode(sharePrevMode, sharePrevFocus);
      if (S.camOn) {
        const ok = await camAcquire();
        if (!ok) {
          const ph = getBlackTrack();
          await replaceVideoTrackAll(ph, "fine condivisione, camera non riacquisita → segnaposto");
          setLocalTrack("video", ph);
        }
      } else {
        const ph = getBlackTrack();
        await replaceVideoTrackAll(ph, "fine condivisione, camera spenta → segnaposto");
        setLocalTrack("video", ph);
      }
      scr.forEach((t) => {
        try {
          t.stop();
        } catch {
          /* */
        }
      }); // schermo rilasciato DOPO lo switch
      if (S.speakerPip) hostSetSpeakerPip(false); // niente condivisione → stop PiP "chi parla"
    } else {
      const prevMode = S.mode,
        prevFocus = S.focusPid;
      const disp = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30 } },
      });
      const srcTrack = disp.getVideoTracks()[0];
      const raw = stopBlurPipelineTrack(); // la sfocatura non si applica allo schermo
      const track = frameShareTrack(srcTrack); // adattata alla forma del dispositivo del cliente
      await replaceVideoTrackAll(track, "condivisione schermo avviata");
      const old = localStream?.getVideoTracks() || [];
      setLocalTrack("video", track);
      [...old, raw].forEach((t) => {
        if (t && t !== track && t !== srcTrack && !isPlaceholder(t)) {
          try {
            t.stop();
          } catch {
            /* */
          }
        }
      }); // camera LIBERA durante la condivisione
      srcTrack.onended = () => {
        stopShareFraming();
        void shareScreen();
      };
      // ── LO SCHERMO OCCUPA TUTTO IL DISPOSITIVO DEL CLIENTE ────────────────
      //  Condividere lo schermo e lasciarlo come una tile fra le altre non ha
      //  senso: quello che stai mostrando È il contenuto. Si passa quindi in
      //  primo piano automatico sulla tua immagine, con la camera del cliente
      //  in piccolo. Alla fine della condivisione si torna com'era.
      sharePrevMode = prevMode;
      sharePrevFocus = prevFocus;
      hostSetMode("call", S.myPid);
      set({ sharing: true });
    }
  } catch {
    /* annullato */
  }
}

/** L'host sceglie COSA vede il guest sul suo dispositivo.
 *  focusPid (Feature 3): in "client" indica QUALE ospite mostrare a schermo intero agli altri. */
/** Dimensioni dello schermo di chi sta guardando, comunicate anche da chi NON è
 *  in videochiamata (link solo preventivo): l'anteprima del presentatore si
 *  adatta al dispositivo vero anche senza camere accese. */
export function reportGuestViewport(w: number, h: number, dpr = 1) {
  if (S.role === "viewer") return;
  if (!(w > 0 && h > 0)) return;
  const cur = S.guestViewport;
  if (cur && cur.w === Math.round(w) && cur.h === Math.round(h) && cur.dpr === dpr) return;
  console.log(`[VIEWPORT] cliente (solo preventivo) ${Math.round(w)}×${Math.round(h)} @${dpr}x`);
  applicaGuestViewport({ w: Math.round(w), h: Math.round(h), dpr, portrait: h >= w });
}

/** true quando quello che il presentatore ha sullo schermo NON deve arrivare al
 *  cliente: in videochiamata si guardano in faccia, non si spia la sua pagina. */
export function mirrorsPage(): boolean {
  return S.role === "host" ? S.mode !== "call" : true;
}

export function hostSetMode(v: Mode, focusPid?: string | null) {
  if (S.role !== "host") return;
  //  Da qui in poi questa scheda sa che cosa deve vedere il cliente, e può
  //  dirlo (vedi il cartello su `modoScelto`).
  modoScelto = true;
  const fp = focusPid !== undefined ? focusPid : v === "client" ? S.focusPid : null;
  if (S.mode === v && S.focusPid === fp) return;
  console.log(`[HOST] modalità → ${v} (focus=${fp ?? "nessuno"})`);
  set({ mode: v, focusPid: fp ?? null });
  // Feature 3 (fix "Solo lui") — push DOPPIO e authoritative: l'evento "mode" +
  // lo stato completo (callstate) così mode E focusPid arrivano insieme al guest anche
  // se il singolo broadcast "mode" viene perso (prima il guest restava su "presenter").
  send("mode", { v, focusPid: fp ?? null });
  broadcastState();
}
/** Feature 4 — l'host attiva/disattiva il PiP "camera piccola in base a chi parla" (durante screen-share). */
export function hostSetSpeakerPip(on: boolean) {
  if (S.role !== "host") return;
  set({ speakerPip: on });
  if (on) startActiveSpeaker();
  else {
    stopActiveSpeaker();
    set({ activeSpeakerPid: null });
    send("activespeaker", { pid: "" });
  }
}
// ── PiP CONDIVISA: posizione unica per presentatore e ospite ──────────────
//  Coordinate NORMALIZZATE 0..1 sull'AREA LIBERA (viewport meno la dimensione
//  della PiP e meno il chrome fisso): così la stessa coppia di numeri indica la
//  stessa posizione relativa su un desktop 1920×1080 e su un telefono, e la PiP
//  non può mai finire fuori dai bordi né sopra le barre del presentatore.
const PIP_KEY = "hg_pip_pos";
const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
function readPipPos(): { x: number; y: number } {
  try {
    const j = JSON.parse(sessionStorage.getItem(PIP_KEY) || "null");
    if (j && typeof j.x === "number" && typeof j.y === "number")
      return { x: clamp01(j.x), y: clamp01(j.y) };
  } catch {
    /* */
  }
  return { ...S.pipPos };
}
let pipSentAt = 0;
/** Sposta la PiP e (di default) la sincronizza con l'altro lato.
 *  `live` = trascinamento in corso → invio limitato a ~10/s; al rilascio si
 *  manda comunque la posizione finale (nessuna posizione persa). */
export function setPipPos(
  p: { x: number; y: number },
  opts?: { live?: boolean; broadcast?: boolean },
) {
  const v = { x: clamp01(p.x), y: clamp01(p.y) };
  if (v.x === S.pipPos.x && v.y === S.pipPos.y && opts?.live) return;
  set({ pipPos: v });
  try {
    sessionStorage.setItem(PIP_KEY, JSON.stringify(v));
  } catch {
    /* */
  }
  if (opts?.broadcast === false) return;
  const now = Date.now();
  if (opts?.live && now - pipSentAt < 100) return; // throttle ~10 invii/s
  pipSentAt = now;
  send("pippos", { ...v, from: S.myPid });
}

/** ── LA MISURA DELLA PiP, CONDIVISA ─────────────────────────────────────────
 *  Chiamata quando il gesto di ridimensionamento FINISCE (non durante: durante
 *  arrivano decine di eventi al secondo e il riquadro dell'altro scatterebbe).
 *  Si manda la frazione di larghezza dello schermo di chi l'ha decisa; chi la
 *  riceve la moltiplica per la PROPRIA larghezza. */
export function setPipFrazione(frazione: number, opts?: { broadcast?: boolean }) {
  const f = Number(frazione);
  if (!Number.isFinite(f) || f <= 0 || f > 1) return;
  set({ pipFrazione: f });
  if (opts?.broadcast === false) return;
  send("pipsize", { f, from: S.myPid });
}

// ── RESILIENZA OSPITE: segnalazione errori + comando di ricarica ──────────
/** OSPITE → PRESENTATORE: "sul mio dispositivo un pezzo di interfaccia è andato
 *  in errore". L'ospite continua a vedere solo la schermata brandizzata. */
let lastErrSent = 0;
export function reportGuestError(msg: string, stack?: string) {
  /*  ── ⚠️ NON TUTTO QUELLO CHE ESPLODE NEL BROWSER DEL CLIENTE È NOSTRO ──
      Il riquadro arancione «Problema sul dispositivo del cliente» che il
      committente si è visto in mezzo alla consulenza veniva da un'ESTENSIONE
      installata nel browser del cliente (lo stack nel diario lo dice per
      esteso: `chrome-extension://…/executors/200.js`), che inciampa da sola
      ogni minuto. Ricaricare il dispositivo del cliente non poteva servire a
      niente, e intanto il consulente credeva di avere una consulenza rotta.
      Resta nella console di chi lo genera; al consulente non arriva. */
  if (!erroreDaMostrare(msg, stack)) {
    console.warn(
      "[GUEST][ERR] non è nostro (estensione del browser o script di un'altra origine):",
      msg,
    );
    return;
  }
  const now = Date.now();
  if (now - lastErrSent < 3000) return; // niente raffiche se l'errore si ripete
  lastErrSent = now;
  console.error(
    "[GUEST][ERR]",
    msg,
    "\n[GUEST][ERR] componentStack:",
    stack || "(non disponibile)",
  );
  if (S.role !== "viewer") return;
  send("guesterror", {
    msg: String(msg || "").slice(0, 300),
    stack: String(stack || "").slice(0, 1500),
    from: S.myPid,
    name: S.myName || "Cliente",
  });
  // DIARIO PERSISTENTE: l'avviso a schermo sparisce, questo resta. Così un
  // problema si può analizzare con calma anche a consulenza finita.
  try {
    fetch("/api/presenter/errors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg,
        stack: stack || "",
        name: S.myName || "Cliente",
        page: typeof location !== "undefined" ? location.pathname : "",
        ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
      }),
    }).catch(() => {
      /* */
    });
  } catch {
    /* */
  }
}
/** OSPITE — dopo un errore: ri-chiede al presentatore TUTTO lo stato corrente
 *  (callstate, roster, indice slide, snapshot preventivo…) così il ri-montaggio
 *  riparte allineato invece che dalla schermata iniziale. */
export function requestPresenterState() {
  if (S.role !== "viewer") return;
  try {
    sendHello(true);
  } catch {
    /* */
  }
  try {
    send("hello", {
      pid: S.myPid,
      name: helloName(),
      role: S.role,
      camOn: S.camOn,
      joined: true,
      req: true,
      dev: myDeviceId(),
      vp: myViewport(),
    });
  } catch {
    /* */
  }
}
/** PRESENTATORE — chiede al dispositivo del cliente di ricaricare la pagina. */
export function reloadGuest(pid?: string) {
  if (S.role !== "host") return;
  send("reload", { to: pid || null });
  set({ guestError: null });
}
/** PRESENTATORE — nasconde il badge di errore senza ricaricare nulla. */
export function dismissGuestError() {
  if (S.guestError) set({ guestError: null });
}

/** Feature 5 — invia un messaggio privato 1:1 al pid indicato (tiene una copia locale per il mittente). */
export function sendChat(to: string, text: string) {
  const t = text.trim();
  if (!t || !to) return;
  const msg: ChatMsg = {
    from: S.myPid,
    fromName: S.myName || (S.role === "host" ? "Presentatore" : "Ospite"),
    to,
    text: t,
    t: Date.now(),
  };
  set({ chat: [...S.chat, msg] });
  send("chat", msg);
}

/** Feature 4 — l'host regola le camere piccole (PiP) mostrate al guest durante i contenuti. */
export function hostSetContentCam(patch: Partial<ContentCam>) {
  if (S.role !== "host") return;
  const cc = { ...S.contentCam, ...patch };
  set({ contentCam: cc });
  send("contentcam", cc);
}
/** ── SCHERMO PIENO, SOLO PER SÉ ───────────────────────────────────────────
 *  Richiesta del committente: «aggiungi un pulsante per mettere la
 *  videochiamata a schermo intero o toglierlo, per me».
 *
 *  ⚠️ È UNA COSA LOCALE, e deve restarlo: lo schermo pieno lo decide il
 *   browser di chi lo preme e non viaggia sul canale. Mandarlo all'altro lato
 *   vorrebbe dire prendere il controllo dello schermo di un cliente — cosa che
 *   il suo browser rifiuterebbe comunque, perché lo schermo pieno si può
 *   chiedere solo dentro un gesto dell'utente.
 *  ⚠️ E LO STATO SI LEGGE DAL BROWSER, non da un interruttore nostro: si esce
 *   anche con Esc, e un interruttore che se lo scorda resterebbe acceso su una
 *   pagina che a schermo pieno non è più — cioè un tasto che non spegne. */
function useSchermoPieno(bersaglio?: { current: HTMLElement | null }): {
  pieno: boolean;
  commuta: () => void;
} {
  const [pieno, setPieno] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const agg = () => setPieno(!!document.fullscreenElement);
    agg();
    document.addEventListener("fullscreenchange", agg);
    return () => document.removeEventListener("fullscreenchange", agg);
  }, []);
  /*  ── ⚠️ SI INGRANDISCE QUELLO CHE IL PULSANTE PROMETTE ──────────────────
      Segnalazione del committente: «il pulsante schermo intero non fa schermo
      intero, si riferisce alla videocamera».
      Aveva ragione due volte. Il cartellino diceva «metti la VIDEOCHIAMATA a
      schermo intero» e il codice chiedeva lo schermo pieno per la PAGINA
      INTERA: il browser nasconde le sue barre e tutto resta grande uguale —
      le camere continuano a stare nella loro colonna stretta. Cioè il
      pulsante faceva una cosa diversa da quella scritta sopra, ed è il tipo
      di comando che si preme una volta e poi non si tocca più.
      Adesso ingrandisce IL RIQUADRO DELLE CAMERE. Se quel riquadro non c'è
      (camere chiuse, nessuno in chiamata) ripiega sulla pagina intera, che è
      comunque quello che il pulsante lascia intendere. */
  const commuta = useCallback(() => {
    if (typeof document === "undefined") return;
    try {
      if (document.fullscreenElement) {
        void document.exitFullscreen();
        return;
      }
      const el = bersaglio?.current ?? document.documentElement;
      void el.requestFullscreen?.();
    } catch {
      //  Qualche browser lo nega (iframe senza permesso, iPhone): non è un
      //  guasto da annunciare, semplicemente non succede niente.
    }
  }, [bersaglio]);
  return { pieno, commuta };
}

/** Il cliente sceglie (tap) quale camera ingrandire — SOLO in modalità "call". */
export function viewerTogglePrimary() {
  if (S.role !== "viewer" || S.mode !== "call") return; // in "content" il PiP è bloccato sul consulente
  const v: Primary = S.primary === "presenter" ? "client" : "presenter";
  set({ primary: v });
  send("clientchose", { v });
}

export function useCall(): State {
  const [, f] = useState(0);
  useEffect(() => {
    const cb = () => f((x) => x + 1);
    subs.add(cb);
    return () => {
      subs.delete(cb);
    };
  }, []);
  return S;
}

/** Monta il layer globale e configura sessione/ruolo. Da inserire una sola
 *  volta nel <Root>. Non fa nulla finché non c'è una sessione live o ?watch=. */
/** true se la pagina è aperta con un link ospite (/meetly/CODICE o ?watch=) fuori dagli iframe di anteprima. */
export function isGuestLink(): boolean {
  if (typeof window === "undefined") return false;
  const p = new URLSearchParams(window.location.search);
  if (p.get("embed") === "1" || window.self !== window.top) return false;
  return !!p.get("watch") || STANZA_RE.test(window.location.pathname);
}

/** GATE OSPITE — true finché il guest NON può ancora vedere i contenuti.
 *  Ordine obbligatorio: attesa brandizzata → nome → contenuti.
 *  Usato anche dal <Root> per non far comparire NULLA della pagina sotto. */
export function guestGateBlocked(st: State = S): boolean {
  if (typeof window === "undefined") return false;
  if (!isGuestLink()) return false; // presentatore / iframe anteprima: mai bloccato
  if (st.kicked) return true; // rimosso/bloccato: mai contenuti
  if (st.role !== "viewer") return true; // motore non ancora configurato → attesa
  // Velo di caricamento: la pagina sotto non deve dipingere NULLA (slide, sito,
  // preventivo). Calcolato al volo — non si legge `st.guestVeil`, che viene
  // scritto da un useEffect e quindi arriverebbe un render DOPO (un fotogramma
  // di contenuti visibile). `st.guestVeil` resta come fallback/telemetria.
  if (guestVeilActive(st) || st.guestVeil) return true;
  return !st.sessionLive || !st.joined; // attesa oppure nome non ancora inserito
}
export function useGuestGate(): boolean {
  const st = useCall();
  return guestGateBlocked(st);
}

/** CODICE DI CANALE DELL'OSPITE — unica fonte di verità.
 *  Da usare in TUTTE le pagine di contenuto al posto del `?watch=` grezzo: se il
 *  presentatore rigenera la sessione (Termina → Videochiamata, oppure "Nuova"),
 *  l'ospite col link vecchio verrebbe altrimenti lasciato su un canale morto e
 *  smetterebbe di ricevere media, scorrimento e link — pur restando in
 *  videochiamata, perché quel motore il codice lo adottava già.
 *  Il codice viene adottato in UN solo punto (il poll di CallMount) e qui viene
 *  semplicemente osservato: nessun polling aggiuntivo per pagina, nessun rischio
 *  che due pagine adottino in istanti diversi facendo sbattere i canali. */
export function useGuestChannel(watch: string | null): string | null {
  const st = useCall();
  if (!watch) return null;
  return st.guestCode || watch;
}

export function CallMount() {
  //  ── ⚠️ DENTRO LA CORNICE DI UN WEBINAR IL MOTORE STA ZITTO ──────────────
  //   La sala di un webinar apre le pagine dei contenuti con `?watch=`, per
  //   metterle in modalità cliente. Effetto collaterale: questo motore le
  //   riconosceva come una CONSULENZA e ci disegnava sopra la sua camerina —
  //   quella con il nome del consulente — e la sua schermata d'attesa. In una
  //   sala da webinar quella camera è già mostrata dalla pagina che contiene
  //   la cornice, quindi si vedevano due volte, una dentro l'altra e
  //   schiacciata in un terzo di schermo.
  //   Qui il motore si spegne: la cornice mostra i CONTENUTI e basta.
  const dentroUnWebinar =
    typeof window !== "undefined" && !!new URLSearchParams(window.location.search).get("webinar");

  const [ready, setReady] = useState(false);
  // PiP condivisa: riprendo l'ultima posizione della sessione (solo locale, niente server)
  useEffect(() => {
    setPipPos(readPipPos(), { broadcast: false });
  }, []);
  // OSPITE: qualunque errore NON catturato (handler async, promise, listener)
  // viene comunque segnalato al presentatore con il suo stack. Il cliente non
  // vede nulla: al massimo la schermata di attesa del confine di errore.
  useEffect(() => {
    if (!isGuestLink()) return;
    // ── UN PEZZO DELL'APPLICAZIONE NON SI CARICA PIÙ ─────────────────────
    //  Ogni pubblicazione rinomina i pezzi di codice. Un cliente che ha aperto
    //  la pagina PRIMA e poi cambia schermata chiede un pezzo che non esiste
    //  più: fin qui arrivava fino alla schermata d'errore, con l'attimo di
    //  buio e la consulenza che sembrava cadere. Vite avvisa PRIMA che il
    //  fallimento diventi un errore: si ricarica subito, una volta sola.
    const onPreload = (e: Event) => {
      try {
        if (sessionStorage.getItem("hg_stale_reload") === "1") return;
        sessionStorage.setItem("hg_stale_reload", "1");
      } catch {
        /* */
      }
      reportGuestError(
        "Pezzo dell'app non disponibile (versione aggiornata): ricarico",
        String((e as unknown as { payload?: Error }).payload?.message || ""),
      );
      console.warn("[APP] pezzo mancante dopo una pubblicazione: ricarico subito");
      try {
        window.location.reload();
      } catch {
        /* */
      }
    };
    window.addEventListener("vite:preloadError", onPreload as EventListener);
    const onErr = (e: ErrorEvent) =>
      reportGuestError(
        `${e.message}`,
        // `Script error.` senza dettagli = errore di uno script servito da un'altra
        // origine. Quando c'è l'oggetto errore vero si prende da lì lo stack.
        `${(e.error as Error | undefined)?.stack || ""}${e.filename ? ` @ ${e.filename}:${e.lineno || 0}` : ""}`.trim(),
      );
    const onRej = (e: PromiseRejectionEvent) =>
      reportGuestError(
        `Promise non gestita: ${String((e.reason as Error)?.message || e.reason || "")}`,
        String((e.reason as Error)?.stack || ""),
      );
    window.addEventListener("error", onErr);
    window.addEventListener("unhandledrejection", onRej);
    return () => {
      window.removeEventListener("error", onErr);
      window.removeEventListener("unhandledrejection", onRej);
      window.removeEventListener("vite:preloadError", onPreload as EventListener);
    };
  }, []);
  // OSPITE: garantisce viewport a scala 1 (niente pagina "pinch-zoomata" all'apertura)
  useEffect(() => {
    if (!isGuestLink()) return;
    ensureGuestViewport();
    const t1 = window.setTimeout(ensureGuestViewport, 300);
    const t2 = window.setTimeout(ensureGuestViewport, 1500);
    window.addEventListener("orientationchange", ensureGuestViewport);
    window.addEventListener("pageshow", ensureGuestViewport);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener("orientationchange", ensureGuestViewport);
      window.removeEventListener("pageshow", ensureGuestViewport);
    };
  }, []);
  // codice canale EFFETTIVO dell'ospite: parte dal ?watch= del link ma ADOTTA il
  // codice della sessione attiva se il presentatore l'ha rigenerato (link "vecchio"
  // di pochi minuti → deve continuare a funzionare, non "link sbagliato").
  const guestCodeRef = useRef<string | null>(
    typeof window === "undefined" ? null : watchIdDaIndirizzo(),
  );
  const pollBusy = useRef(false);
  const lastPoll = useRef(0);
  const srvActive = useRef(false); // ultima risposta autorevole del server
  const offCount = useRef(0); // letture consecutive "nessuna chiamata attiva"
  useEffect(() => {
    const apply = () => {
      const params = new URLSearchParams(window.location.search);
      // dentro l'iframe di anteprima dispositivo (embed=1) NON avviare un secondo motore chiamata
      if (params.get("embed") === "1" || window.self !== window.top) {
        setReady(false);
        return;
      }
      const watch = watchIdDaIndirizzo();
      const liveId = localStorage.getItem("hg_live_session");
      if (watch) {
        if (!guestCodeRef.current) guestCodeRef.current = watch;
        configureCall(guestCodeRef.current, "viewer");
        // UNA sola richiesta alla volta: due poll sovrapposti potevano adottare
        // codici diversi a distanza di millisecondi → canale ricreato in continuazione.
        // …ma una fetch che non si risolve MAI (rete mobile che scompare) lasciava
        // `pollBusy` bloccato a true per sempre: da lì in poi l'ospite non
        // interrogava più il server e restava congelato sull'ultima schermata.
        if (pollBusy.current && Date.now() - lastPoll.current < 15000) {
          setReady(true);
          return;
        }
        // A CHIAMATA AVVIATA il poll rallenta da 2s a ~16s: una fetch + parse JSON
        // ogni 2 secondi sul thread principale dell'ospite è lavoro inutile che si
        // somma alla decodifica video (micro-scatti). Serve solo finché l'ospite
        // non è entrato: da lì in poi è pura ridondanza.
        if (
          S.joined &&
          S.sessionLive &&
          srvActive.current &&
          Date.now() - lastPoll.current < 16000
        ) {
          setReady(true);
          return;
        }
        lastPoll.current = Date.now();
        pollBusy.current = true;
        // il guest controlla se la sessione è stata avviata (altrimenti vede l'attesa).
        fetch(
          `/api/presenter/session?sess=${encodeURIComponent(S.sessionId || watchIdDaIndirizzo() || "")}`,
        )
          .then((r) => r.json())
          .then((j) => {
            if (S.role !== "viewer") return;
            /*  ── ⚠️ QUESTO APPUNTAMENTO È STATO SPOSTATO ──────────────────
              Il consulente ha cambiato giorno alla consulenza: si è coniato
              un codice nuovo, perché l'anteprima di un link mandato su
              WhatsApp non viene mai riletta e resterebbe con la data vecchia
              scritta sopra (vedi crm/spostamento-meet.ts).
              Il cliente però apre il link che ha in mano, che è quello di
              prima: senza questa riga aspetterebbe in una stanza dove non
              entrerà nessuno, mentre il consulente trasmette nell'altra.
              ⚠️ Non mentre è in chiamata: se la stanza è viva ci si resta,
               qualunque cosa dica l'archivio. Portare via qualcuno da una
               consulenza in corso è peggio di un link vecchio.
              ⚠️ `replace`: l'indirizzo vecchio non deve restare nella
               cronologia, o il tasto «indietro» ci riporta dentro. */
            const rinvio = typeof j.rinvio === "string" ? j.rinvio.trim() : "";
            if (rinvio && rinvio !== guestCodeRef.current && !S.sessionLive && !S.joined) {
              if (!rinviatoUnaVolta) {
                rinviatoUnaVolta = true;
                console.log("[GUEST] appuntamento spostato: questa stanza è diventata", rinvio);
                try {
                  window.location.replace(`/meetly/${encodeURIComponent(rinvio)}`);
                } catch {
                  /* */
                }
              }
              pollBusy.current = false;
              return;
            }
            // ── OGNI CONSULENZA È UNIVOCA ─────────────────────────────────
            //  Il codice del link identifica UNA consulenza, e solo quella.
            //  Prima, se il presentatore ne apriva una nuova, l'ospite col link
            //  VECCHIO adottava il codice nuovo e si intrufolava nella consulenza
            //  di un'altra persona. Ora non si adotta più nulla: se la sessione
            //  viva ha un codice diverso dal proprio, questa consulenza è finita e
            //  si resta sulla schermata d'attesa. Un link nuovo = una persona nuova.
            const liveCode = typeof j.code === "string" && j.code ? String(j.code) : null;
            const mine = !!liveCode && liveCode === guestCodeRef.current;
            if (j.live && liveCode && !mine) {
              if (!sessionSupersededLogged) {
                sessionSupersededLogged = true;
                console.log(
                  "[GUEST] questa consulenza è stata sostituita da una nuova (codice",
                  liveCode,
                  "≠ mio",
                  guestCodeRef.current,
                  ") → resto in attesa",
                );
              }
              if (S.sessionLive)
                guestBackToWaiting(
                  "il presentatore ha avviato una NUOVA consulenza con un altro link",
                );
              if (!S.superseded) set({ superseded: true });
              srvActive.current = false;
              offCount.current = 0;
              pollBusy.current = false;
              return;
            }
            // sessionLive è MONOTONA: solo la chiusura esplicita del presentatore
            // (callstate ended) può riportare l'ospite in attesa. Mai il polling.
            // ── GIUDICE UNICO: lo stato AUTOREVOLE del server ──────────────────
            //  `callActive` = sessione aperta E presentatore realmente in chiamata
            //  (battito fresco). Se è false la sessione è solo "riprendibile" → attesa.
            //  Isteresi: servono 3 letture negative consecutive (~6s) prima di
            //  riportare l'ospite in attesa → nessun rimbalzo su stati transitori,
            //  e i broadcast delle schede "fantasma" restano ignorati come prima.
            const callActive = !!j.callActive && mine;
            if (S.superseded) set({ superseded: false });
            srvActive.current = callActive;
            setServerCallActive(callActive); // il segnale locale non può più contraddirlo
            if (callActive) {
              offCount.current = 0;
              if (!S.sessionLive) {
                console.log("[GUEST] sessionLive false → true (chiamata attiva sul server)");
                set({ sessionLive: true });
                bussaSePronto(); // si era preparato prima: entra senza toccare niente
                // il presentatore è RITORNATO: se l'ospite era già entrato riprende
                // da solo (presenza + camera/mic), senza richiedere il nome.
                if (S.joined) guestResumeCall();
              }
            } else if (j.live === false) {
              // ── CHIUSURA ESPLICITA: NESSUNA ATTESA ────────────────────────────
              //  `live:false` è scritto sul server dal presentatore nell'istante in
              //  cui chiude la chiamata: non è un battito mancante, è una volontà
              //  dichiarata. Applicare anche qui l'isteresi delle 3 letture
              //  significava tenere il cliente sul preventivo per ~30 secondi dopo
              //  che te n'eri già andato. Qui si torna in attesa SUBITO.
              offCount.current = 0;
              if (S.sessionLive) guestBackToWaiting("il presentatore ha chiuso la sessione");
            } else {
              offCount.current += 1;
              //  ⚠️ …ma non mentre il consulente sta parlando sul canale: vedi
              //   `presentatoreVistoIl`. È la differenza fra «se n'è andato» e
              //   «il server sta leggendo la riga sbagliata».
              const appenaSentito = Date.now() - presentatoreVistoIl < PRESENTATORE_APPENA_VISTO_MS;
              if (appenaSentito && S.sessionLive) {
                console.log(
                  "[GUEST] battito scaduto sul server, ma il presentatore è sul canale → resto dentro",
                );
                offCount.current = 0;
              } else if (offCount.current >= 3 && S.sessionLive) {
                // GIUDICE AUTOREVOLE: battito scaduto → il presentatore non è più in
                // chiamata (ha chiuso la scheda, è caduta la rete…). L'ospite torna
                // all'attesa brandizzata con media/peer smontati (mai una tile morta).
                guestBackToWaiting(
                  "battito del presentatore scaduto sul server (callActive=false ×3)",
                );
              }
            }
          })
          .catch((e) => {
            console.log("[GUEST] poll sessione fallito (ignoro, nessun rimbalzo)", e);
          })
          .finally(() => {
            pollBusy.current = false;
          });
      } else if (liveId) {
        configureCall(liveId, "host");
        //  ── ⚠️ LA CONSULENZA È ANCORA APERTA? ALLORA È ANCORA MIA ──────────
        //   Questa scheda può essere appena stata caricata mentre una consulenza
        //   era in corso (una ricarica, il CRM aperto sopra, un aggiornamento
        //   pubblicato): sul server la riga è viva, qui dentro no, e il battito
        //   si ferma. Da lì il cliente non riesce più nemmeno a bussare — era il
        //   guasto «quando entrano le persone non li ammette».
        void riprendiConsulenzaAperta();
        aggiornaFaro();
      }
      setReady(true);
    };
    apply();
    const onStorage = (e: StorageEvent) => {
      if (e.key === "hg_live_session") apply();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("hg-live-change", apply); // nuovo codice sessione nella stessa scheda
    const iv = setInterval(apply, 2000); // aggancia quando parte la diretta nella stessa scheda
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("hg-live-change", apply);
      clearInterval(iv);
    };
  }, []);
  // Ospite: mentre il motore chiamata si configura mostra SUBITO la schermata
  // d'attesa brandizzata (niente lampo di slide prima del prompt del nome).
  //  ⚠️ Prima di qualunque altra cosa: dentro la cornice di un webinar questo
  //   motore non disegna niente. Vedi la nota in testa.
  if (dentroUnWebinar) return null;
  if (!ready) return isGuestLink() ? <WaitingScreen /> : null;
  return <CallLayer />;
}
function useStreams() {
  const [, f] = useState(0);
  useEffect(() => {
    const cb = () => f((x) => x + 1);
    streamSubs.add(cb);
    return () => {
      streamSubs.delete(cb);
    };
  }, []);
  return { localStream };
}

// ── (D) WAKE LOCK — tiene sveglio lo schermo durante la chiamata ───────────
//  I wake lock cadono quando la scheda passa in background → ri-acquisisco su
//  visibilitychange. Guardia per i browser senza l'API (es. iOS < 16.4).
let wakeSentinel: any = null;
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !(navigator as any).wakeLock) return;
    let cancelled = false;
    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible" || wakeSentinel) return;
      try {
        wakeSentinel = await (navigator as any).wakeLock.request("screen");
        wakeSentinel.addEventListener?.("release", () => {
          wakeSentinel = null;
        });
      } catch {
        /* negato/non supportato */
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      try {
        wakeSentinel?.release?.();
      } catch {
        /* */
      }
      wakeSentinel = null;
    };
  }, [active]);
}

// ════════════════════════════════════════════════════════════════════════
//  OVERLAY (renderizzato nel Root, sopra ogni pagina)
// ════════════════════════════════════════════════════════════════════════
/** ── L'AUDIO NON DIPENDE DA COSA SI VEDE ────────────────────────────────────
 *  L'audio degli altri partecipanti usciva dagli stessi elementi che mostrano le
 *  loro immagini. In "Contenuti + PiP" quelle immagini non sono più a schermo —
 *  c'è la pagina condivisa e una piccola anteprima — quindi l'elemento che
 *  portava la voce spariva insieme all'immagine: il cliente smetteva di sentirti.
 *  Qui ogni flusso remoto ha un lettore audio DEDICATO, invisibile e sempre
 *  presente finché la chiamata è attiva, qualunque cosa si stia mostrando. */
function RemoteAudio({ st }: { st: State }) {
  const [pids, setPids] = useState<string[]>([]);
  useEffect(() => {
    /*  ── ⚠️ SI RIDISEGNA SOLO SE È CAMBIATO DAVVERO ────────────────────────
        Qui c'era `setPids([...remoteStreams.keys()])`: un array NUOVO ogni
        secondo, anche quando le voci in chiamata sono le stesse da mezz'ora.
        Per React un array nuovo è uno stato nuovo, quindi questo pezzo — e con
        lui OGNI lettore audio della chiamata — si ridisegnava una volta al
        secondo, per sempre, sul telefono del cliente. Vedi `RemoteAudioOne`
        qui sotto per che cosa succedeva a ogni giro. */
    const upd = () =>
      setPids((prima) => {
        const ora = [...remoteStreams.keys()];
        return prima.length === ora.length && prima.every((p, i) => p === ora[i]) ? prima : ora;
      });
    upd();
    const iv = setInterval(upd, 1000);
    return () => clearInterval(iv);
  }, []);
  if (!st.active && !st.sessionLive) return null;
  return (
    <div aria-hidden style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      {pids.map((pid) => (
        <RemoteAudioOne key={pid} pid={pid} />
      ))}
    </div>
  );
}
/** ── IL LETTORE DELLA VOCE CHE ARRIVA ──────────────────────────────────────
 *
 *  Segnalazione del committente: «l'utente quando sta dentro sente bip bip
 *  bip» — il CLIENTE, mentre è già dentro, in continuazione ogni pochi secondi.
 *
 *  ⚠️ QUESTO EFFETTO NON AVEVA L'ELENCO DELLE DIPENDENZE, e non era un
 *   dettaglio di stile: senza quell'elenco riparte dopo OGNI disegno, e il
 *   pezzo sopra si ridisegnava una volta al secondo (array nuovo a ogni giro).
 *   Risultato, sul dispositivo del cliente e per tutta la consulenza: una
 *   `play()` al secondo su un altoparlante che sta già suonando, più la
 *   riscrittura di `srcObject`, `muted` e `volume` sullo stesso lettore. È il
 *   genere di cosa che su un telefono si sente — uno scatto a ogni ripresa —
 *   e non si vede da nessuna parte.
 *
 *  Adesso: si aggancia una volta per persona, si tocca il lettore SOLO quando
 *  c'è qualcosa da cambiare, e la ripresa ogni due secondi resta — ma è una
 *  rete di sicurezza per le sospensioni del telefono, non il modo normale di
 *  funzionare.
 *  ⚠️ `remoteStreams` è una mappa fuori da React: un flusso può essere
 *   sostituito senza che nessun disegno lo annunci. Per questo il controllo
 *   del flusso sta DENTRO la ripresa periodica, che è l'unica cosa che guarda
 *   anche quando non si ridisegna niente. */
function RemoteAudioOne({ pid }: { pid: string }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    a.muted = false;
    a.volume = 1;
    const aggancia = () => {
      const s = remoteStreams.get(pid) || null;
      //  Solo se è cambiato: riassegnare lo stesso flusso riavvia il lettore.
      if (a.srcObject !== s) a.srcObject = s;
      //  Solo se è fermo: `play()` su chi sta già suonando non serve a nessuno.
      if (a.paused) {
        contaSuono("audio-ripreso");
        a.play().catch(() => {
          /* sbloccato dal gesto d'ingresso */
        });
      }
    };
    aggancia();
    const iv = setInterval(aggancia, 2000); // ripresa dopo sospensioni
    return () => clearInterval(iv);
  }, [pid]);
  return <audio ref={ref} autoPlay playsInline data-hg-remote-audio={pid} />;
}

/** ── PANNELLO DI DIAGNOSTICA ────────────────────────────────────────────────
 *  Si apre toccando 3 volte l'angolo in basso a sinistra (funziona anche sul
 *  telefono del cliente, dove non c'è una console da guardare). Mostra lo stato
 *  della chiamata e l'ultimo storico degli eventi, con un pulsante per copiare
 *  tutto e inviarlo. */
export function DebugPanel() {
  const rows = useDebugLog();
  const [open, setOpen] = useState(false);
  const taps = useRef<number[]>([]);
  useEffect(() => {
    try {
      if (new URLSearchParams(location.search).get("debug") === "1") setOpen(true);
    } catch {
      /* */
    }
    const onTap = (e: PointerEvent) => {
      if (e.clientY < window.innerHeight - 90 || e.clientX > 90) return; // solo angolo basso-sinistra
      const now = Date.now();
      taps.current = [...taps.current.filter((t) => now - t < 1200), now];
      if (taps.current.length >= 3) {
        taps.current = [];
        setOpen((v) => !v);
      }
    };
    window.addEventListener("pointerdown", onTap, true);
    return () => window.removeEventListener("pointerdown", onTap, true);
  }, []);
  if (!open) return null;
  const text = `${debugSnapshot()}\n\n${rows.map((r) => `${new Date(r.t).toLocaleTimeString("it-IT")} ${r.lvl.toUpperCase()} ${r.msg}`).join("\n")}`;
  return (
    <div
      data-hg-noptr
      className="fixed inset-x-2 bottom-2 z-[300] max-h-[70vh] overflow-hidden rounded-2xl border border-amber-400/50 bg-[#0a1020] text-white shadow-2xl print:hidden"
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <AlertTriangle className="h-4 w-4 text-amber-300" />
        <span className="text-[12px] font-semibold">Diagnostica</span>
        <button
          onClick={() => copyLink(text, "Copiato")}
          className="ml-auto rounded-lg border border-white/20 bg-white/10 px-2 py-1 text-[11px] font-medium hover:bg-white/20"
        >
          Copia tutto
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg border border-white/20 bg-white/5 px-2 py-1 text-[11px]"
        >
          Chiudi
        </button>
      </div>
      <pre className="max-h-[28vh] overflow-auto whitespace-pre-wrap border-b border-white/10 bg-black/30 px-3 py-2 text-[10px] leading-relaxed text-emerald-200">
        {debugSnapshot()}
      </pre>
      <div className="max-h-[36vh] overflow-auto px-3 py-2 text-[10px] leading-relaxed">
        {rows.length === 0 ? (
          <p className="text-white/40">Nessun evento registrato.</p>
        ) : (
          rows
            .slice(-160)
            .reverse()
            .map((r, i) => (
              <div
                key={i}
                className={
                  r.lvl === "error"
                    ? "text-red-300"
                    : r.lvl === "warn"
                      ? "text-amber-200"
                      : "text-white/70"
                }
              >
                <span className="text-white/35">{new Date(r.t).toLocaleTimeString("it-IT")}</span>{" "}
                {r.msg}
              </div>
            ))
        )}
      </div>
    </div>
  );
}

function VideoEl({
  stream,
  muted,
  className,
  onClick,
  mirror,
  onRatio,
}: {
  stream: MediaStream | null;
  muted: boolean;
  className: string;
  onClick?: () => void;
  /** ribalta a specchio SOLO la resa a schermo (vedi `specchiaTile`) */
  mirror?: boolean;
  /** ── PROPORZIONI VERE DELL'IMMAGINE ────────────────────────────────────
   *  Le legge chi disegna il riquadro, per dargli la stessa forma del flusso.
   *  Si prendono da `videoWidth/videoHeight` dell'elemento e non da
   *  `getSettings()`: quest'ultimo dà le misure di CATTURA, che su telefono
   *  restano orizzontali anche quando l'immagine è verticale — ed è proprio il
   *  caso in cui il riquadro veniva fuori della forma sbagliata. */
  onRatio?: (r: number) => void;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  // attacca lo stream e forza il play; se l'autoplay con audio è blottato dal browser
  // riproviamo in muto così l'immagine si vede comunque (fix "camera del guest non appare")
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.dataset.keepmuted = muted ? "1" : "0"; // le tile locali restano mute (niente eco); i remoti no
    // SOLO se cambia davvero l'identità dello stream: riassegnare `srcObject` con
    // lo stesso MediaStream fa ripartire la pipeline video del browser = lampeggio.
    const swapped = v.srcObject !== stream;
    if (swapped) v.srcObject = stream;
    if (!stream) return;
    if (!swapped && !v.paused) return; // già in riproduzione: non toccarlo
    // ── SU iPHONE SI PARTE SEMPRE IN MUTO ─────────────────────────────────
    //  Safari rifiuta la riproduzione automatica di un video con audio, e per
    //  tutto il tempo in cui il video resta fermo ci disegna sopra il suo
    //  pulsante di riproduzione: è l'icona "play" che compariva sulla camera.
    //  Partendo in muto la riproduzione non viene mai rifiutata, quindi quel
    //  pulsante non compare; l'audio si riaccende subito dopo.
    v.muted = true;
    const p = v.play?.();
    const riaccendi = () => {
      if (!muted) {
        v.muted = false;
        hookUnmute();
      }
    };
    if (p && typeof p.then === "function")
      p.then(riaccendi).catch(() => {
        v.muted = true;
        v.play?.().catch(() => {});
        if (!muted) hookUnmute();
      });
    else riaccendi();
  }, [stream, muted]);
  // ── UN VIDEO FERMO SI PORTA DIETRO IL PULSANTE "PLAY" ────────────────────
  //  È l'icona che compariva appena si apriva la chiamata, su telefono, tablet
  //  e computer: non la disegna l'applicazione, la disegna il browser sopra
  //  ogni <video> che non sta riproducendo. Nasconderla con un foglio di stile
  //  funziona a metà — cambia da browser a browser, e su iOS torna a ogni
  //  aggiornamento del sistema. L'unico rimedio che vale ovunque è non lasciare
  //  MAI il video in pausa: se qualcosa lo ferma (rientro dallo sfondo, cambio
  //  di traccia, riproduzione automatica negata) riparte da solo, in muto.
  const riprendi = useCallback(() => {
    const v = ref.current;
    if (!v || !v.srcObject || !v.paused) return;
    const era = v.muted;
    v.muted = true; // in muto nessun browser rifiuta
    const p = v.play?.();
    if (p && typeof p.then === "function") {
      p.then(() => {
        if (!era) {
          v.muted = false;
          hookUnmute();
        }
      })
        //  Se la riproduzione viene negata si rimette com'era: lasciandolo muto,
        //  React non lo rimetterebbe più a posto da solo (la sua proprietà non è
        //  cambiata) e quel riquadro resterebbe senza audio per tutta la chiamata.
        .catch(() => {
          v.muted = era;
        });
    }
  }, []);
  useEffect(() => {
    //  iOS mette in pausa i video quando l'utente esce dalla pagina o risponde
    //  a una telefonata: al rientro trovava la camera ferma col pulsante sopra.
    const onVis = () => {
      if (document.visibilityState === "visible") riprendi();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, [riprendi]);
  // ── L'ICONA "PLAY" NON DEVE ESISTERE, NEMMENO PER UN ISTANTE ─────────────
  //  I telefoni disegnano il proprio simbolo di riproduzione sopra un video
  //  fermo, e alcuni lo fanno anche NELL'ISTANTE in cui parte: un cerchio col
  //  triangolo che compare e svanisce, esattamente come quando si tocca play su
  //  un filmato. Nasconderlo con un foglio di stile non basta — è disegnato dal
  //  sistema, con nomi che cambiano da browser a browser e da versione a
  //  versione, e su iOS ritorna a ogni aggiornamento.
  //  Qui si toglie il problema all'origine: il video resta INVISIBILE finché la
  //  riproduzione non è davvero avviata, e compare in dissolvenza subito dopo.
  //  Quel simbolo, se c'è, accade mentre il video non si vede: sullo schermo
  //  non ne arriva niente. Il ritardo è di mezzo secondo scarso e in chiamata
  //  non si percepisce — al suo posto si vede lo sfondo della cornice.
  const [pronto, setPronto] = useState(false);
  const prontoT = useRef(0);
  const mostra = useCallback(() => {
    if (prontoT.current) return;
    prontoT.current = window.setTimeout(() => {
      prontoT.current = 0;
      setPronto(true);
    }, 260);
  }, []);
  useEffect(() => {
    //  Cambia il flusso (camera accesa, schermo condiviso, rientro): si torna
    //  nascosti finché anche il nuovo non sta davvero riproducendo.
    setPronto(false);
    if (prontoT.current) {
      clearTimeout(prontoT.current);
      prontoT.current = 0;
    }
    return () => {
      if (prontoT.current) {
        clearTimeout(prontoT.current);
        prontoT.current = 0;
      }
    };
  }, [stream]);
  //  Le proporzioni arrivano con i metadati e possono CAMBIARE in corsa: il
  //  telefono ruotato, la qualità che scende, la camera cambiata. Ogni volta si
  //  riavvisa chi disegna il riquadro, così la cornice segue l'immagine.
  const misura = useCallback(() => {
    const v = ref.current;
    if (!v || !onRatio) return;
    const w = v.videoWidth,
      h = v.videoHeight;
    if (w > 0 && h > 0) onRatio(w / h);
  }, [onRatio]);
  useEffect(() => {
    const v = ref.current;
    if (!v || !onRatio) return;
    misura();
    //  `resize` sul <video> scatta quando cambiano le dimensioni del flusso:
    //  è il segnale giusto, e non costa nulla (nessun polling).
    v.addEventListener("resize", misura);
    return () => v.removeEventListener("resize", misura);
  }, [stream, misura, onRatio]);
  //  Senza flusso non si disegna proprio nessun elemento video: un <video>
  //  vuoto è l'altra fonte di quell'icona, e non ha niente da mostrare.
  if (!stream) return null;
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      controls={false}
      disablePictureInPicture
      {...({ "webkit-playsinline": "true", "x5-playsinline": "true" } as Record<string, string>)}
      onPause={riprendi}
      onLoadedMetadata={() => {
        riprendi();
        misura();
      }}
      onCanPlay={riprendi}
      onStalled={riprendi}
      onPlaying={mostra}
      onTimeUpdate={mostra}
      style={{
        opacity: pronto ? 1 : 0,
        transition: "opacity .2s ease-out",
        transform: mirror ? "scaleX(-1)" : undefined,
      }}
      onClick={onClick}
      className={className}
    />
  );
}

// ── MESH: griglia dei partecipanti (colonna verticale, celle uguali) ──────
interface Tile {
  pid: string;
  name: string;
  role: Role;
  stream: MediaStream | null;
  camOn: boolean;
  isLocal: boolean;
  muted: boolean;
}

// costruisce un singolo Tile da un pid (self o roster) — riuso per fullscreen/PiP
function tileForPid(
  st: State,
  ls: MediaStream | null,
  pid: string | null | undefined,
): Tile | null {
  if (!pid) return null;
  if (pid === st.myPid)
    return {
      pid,
      name: st.myName || "Tu",
      role: st.role || "viewer",
      stream: ls,
      camOn: st.camOn,
      isLocal: true,
      muted: true,
    };
  const r = st.roster.find((x) => x.pid === pid);
  if (!r) return null;
  return {
    pid,
    name: r.name,
    role: r.role,
    stream: remoteStreams.get(pid) || null,
    camOn: r.camOn,
    isLocal: false,
    muted: true,
  };
}

/** Nome del PRESENTATORE da mostrare (badge/filigrana): callstate → roster host →
 *  fallback neutro. Non restituisce mai "Ospite" né il nome dell'utente locale. */
function presenterDisplayName(st: State): string {
  // Sul GUEST il nome del presentatore non può MAI coincidere col proprio nome:
  // se ci coincide è un residuo sbagliato (hello senza nome → "Ospite") e va scartato.
  const mine = (st.role === "viewer" ? st.myName || "" : "").trim().toLowerCase();
  const ok = (n?: string | null) => {
    const v = (n || "").trim();
    return isRealName(v) && (!mine || v.toLowerCase() !== mine);
  };
  if (ok(st.presenterName)) return st.presenterName.trim();
  const host = st.roster.find((r) => r.role === "host");
  if (host && ok(host.name)) return host.name.trim();
  const anyHost = st.roster.find((r) => r.role === "host" && isRealName(r.name));
  if (anyHost) return anyHost.name.trim();
  return "Presentatore";
}

// Feature 1 — badge branding SOLO per il presentatore: BrandLogo + nome insieme,
// padding verticale generoso. Visibile ovunque compaia la tile dell'host (host + guest).
// Posizione: IN BASSO A SINISTRA (uguale su schermo presentatore e su ogni ospite).
function PresenterBadge({ name, compact }: { name?: string; compact?: boolean }) {
  const st = useCall();
  name =
    isRealName(name) && name!.trim().toLowerCase() !== (st.myName || "").trim().toLowerCase()
      ? name!.trim()
      : presenterDisplayName(st);
  return (
    <div
      className={`absolute bottom-2 left-2 z-10 inline-flex items-center gap-2 rounded-lg bg-black/75 ring-1 ring-white/10 ${compact ? "px-1.5 py-1" : "px-2.5 py-2"}`}
    >
      <BrandLogo className={compact ? "h-3.5 w-auto" : "h-5 w-auto"} />
      {name && (
        <span
          className={`border-l border-white/20 pl-2 font-semibold leading-none text-white/90 ${compact ? "text-[9px]" : "text-[11px]"}`}
        >
          {name}
        </span>
      )}
    </div>
  );
}

// Placeholder BRANDATO per camera spenta / assente: navy + motivo (griglia + glow),
// BrandLogo SOLO per il presentatore, icona VideoOff e "<nome> ha la camera spenta".
function CamOffPlaceholder({
  name,
  isHost,
  connecting,
  compact,
}: {
  name: string;
  isHost: boolean;
  connecting?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="bg-brandfill absolute inset-0 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-brand/10 blur-3xl" />
      <div
        className={`absolute inset-0 flex flex-col items-center justify-center text-center ${compact ? "gap-1 px-1" : "gap-2 px-3"}`}
      >
        {isHost && (
          <BrandLogo className={compact ? "h-3.5 w-auto opacity-90" : "h-6 w-auto opacity-90"} />
        )}
        <VideoOff className={`text-white/40 ${compact ? "h-3.5 w-3.5" : "h-5 w-5"}`} />
        <div
          className={`font-medium leading-tight text-white/70 ${compact ? "text-[9px]" : "text-xs"}`}
        >
          <span className="font-semibold text-white/90">{name}</span>
          {compact ? "" : " ha la camera spenta"}
        </div>
        {connecting && !compact && <div className="text-[10px] text-white/35">connessione…</div>}
      </div>
    </div>
  );
}
// costruisce i tile: locale in cima, poi ospiti, presentatore in fondo
/** Voce del PRESENTATORE per l'ospite: quella reale del roster oppure, finché il
 *  suo `hello` non è ancora arrivato, un SEGNAPOSTO. L'ospite non deve mai vedere
 *  "In attesa degli altri…" quando la sessione è viva: il presentatore c'è, al
 *  massimo non è ancora arrivato il suo flusso ("connessione…"/"camera spenta"). */
const HOST_PLACEHOLDER_PID = "host-pending";
/** LA voce del presentatore nel roster: se per un attimo ce ne fossero due
 *  (reload del presentatore → pid nuovo) vince quella con il flusso/peer vivo e,
 *  a parità, la più recente. Non se ne rende MAI più di una. */
function bestHost(st: State): State["roster"][number] | null {
  const hosts = st.roster.filter((r) => r.role === "host" && r.pid !== HOST_PLACEHOLDER_PID);
  if (!hosts.length) return null;
  const score = (p: string) =>
    (remoteStreams.get(p)?.getVideoTracks().length ? 4 : 0) +
    (remoteStreams.has(p) ? 2 : 0) +
    (peers.get(p)?.connectionState === "connected" ? 1 : 0);
  return hosts
    .slice()
    .sort(
      (a, b) =>
        score(b.pid) - score(a.pid) || (lastSeen.get(b.pid) || 0) - (lastSeen.get(a.pid) || 0),
    )[0];
}
function viewerHostEntry(
  st: State,
): { pid: string; name: string; role: Role; camOn: boolean } | null {
  const real = bestHost(st);
  if (real) return real;
  if (st.role !== "viewer" || !st.sessionLive) return null;
  return { pid: HOST_PLACEHOLDER_PID, name: presenterDisplayName(st), role: "host", camOn: false };
}
function buildTiles(st: State, ls: MediaStream | null, includeLocal = true): Tile[] {
  const tiles: Tile[] = [];
  if (includeLocal)
    tiles.push({
      pid: st.myPid || "me",
      name: st.myName || (st.role === "host" ? st.presenterName || "Tu" : "Tu"),
      role: st.role || "viewer",
      stream: ls,
      camOn: st.camOn,
      isLocal: true,
      muted: true,
    });
  // UNA SOLA TILE PRESENTATORE, sempre. Se per qualsiasi motivo il roster
  // contenesse più voci host (reload del presentatore, hello con pid nuovo),
  // se ne tiene UNA: quella con un flusso remoto vivo, poi con un peer vivo,
  // poi la più recente. Le altre non vengono renderizzate.
  const keepHost = bestHost(st)?.pid || null;
  // MAI la propria voce tra "gli altri" (si conterebbe due volte: tile locale +
  // voce di roster eternamente in "connessione…") e mai il segnaposto host se
  // esiste una voce host reale.
  const roster = st.roster.filter(
    (r) =>
      r.pid !== st.myPid &&
      r.pid !== HOST_PLACEHOLDER_PID &&
      (r.role !== "host" || r.pid === keepHost),
  );
  // ospite senza il presentatore in lista → segnaposto (mai la schermata "solo tu").
  // MAI insieme a una voce host reale: il segnaposto è solo un ripiego.
  if (st.role === "viewer" && !keepHost) {
    const ph = viewerHostEntry(st);
    if (ph) roster.push(ph as State["roster"][number]);
  }
  const others = roster.sort((a, b) => (a.role === "host" ? 1 : 0) - (b.role === "host" ? 1 : 0));
  for (const r of others)
    tiles.push({
      //  ⚠️ `nomeVero` solo dal lato del consulente: nel roster di un ospite
      //   quel campo non arriva nemmeno, ma la regola si scrive lo stesso —
      //   è la stessa funzione che disegna i riquadri di tutti e due.
      pid: r.pid,
      name: (st.role === "host" && r.nomeVero) || r.name,
      role: r.role,
      stream: remoteStreams.get(r.pid) || null,
      camOn: r.camOn,
      isLocal: false,
      muted: true,
    });
  return tiles;
}
// contenuto interno di una tile (video + placeholder + badge) — riusato
// dalla griglia normale e dalla variante flex-wrap del pannello presentatore (B).
/* ═══════════════════════════════════════════════════════════════════════════
   IL MENU CHE SI APRE TENENDO PREMUTO SULLA CAMERA
   ───────────────────────────────────────────────────────────────────────────
   Richiesta del committente: «tenendo premuto sulla camera di un utente si
   apre un menu piccolo dove ci sono le opzioni: espellere, bloccare, mutare,
   disattivare camera ecc.».

   I comandi c'erano già tutti, ma dentro il pannello «Partecipanti» che si
   apre da un'iconcina: per spegnere il microfono di chi sta parlando bisogna
   aprire un elenco, trovarci dentro il nome giusto e premere lì — mentre il
   cliente guarda. Qui invece si tiene premuto SULLA FACCIA della persona:
   non c'è nessun nome da cercare, perché la persona è quella che stai
   guardando.

   ⚠️ SI APRE IN TRE MODI, e non è un capriccio: dito tenuto premuto (telefono
    e tablet), tasto destro (l'abitudine di chi sta al computer) e pressione
    lunga col mouse. Un menu che si apre in un modo solo, su un programma che
    gira su tre dispositivi diversi, è un menu che due persone su tre non
    trovano.
   ⚠️ E NON DEVE SCATTARE SU UN TOCCO NORMALE: mezzo secondo di pressione, e
    basta muovere il dito perché si annulli. Toccare una camera resta toccare
    una camera.
   ═══════════════════════════════════════════════════════════════════════════ */
function MenuSullaCamera({
  t,
  at,
  onClose,
}: {
  t: Tile;
  at: { x: number; y: number };
  onClose: () => void;
}) {
  const st = useCall();
  const [, ridisegna] = useState(0);
  useEffect(() => ascoltaMuti(() => ridisegna((n) => n + 1)), []);
  const muto = eMuto(t.pid);
  const soloLui = st.mode === "client" && st.focusPid === t.pid;

  const Riga = ({
    icona,
    testo,
    onClick,
    rosso,
  }: {
    icona: ReactNode;
    testo: string;
    onClick: () => void;
    rosso?: boolean;
  }) => (
    <button
      type="button"
      onClick={() => {
        onClick();
        onClose();
      }}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition ${
        rosso ? "text-red-200 hover:bg-red-500/20" : "text-white/85 hover:bg-white/10"
      }`}
    >
      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center opacity-80">
        {icona}
      </span>
      <span className="min-w-0 flex-1 truncate">{testo}</span>
    </button>
  );

  return (
    <PeoplePopover at={at} onClose={onClose}>
      <div
        data-hg-noptr
        className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wide text-white/45"
      >
        {t.name || "Cliente"}
      </div>
      <Riga
        icona={soloLui ? <Users className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
        testo={soloLui ? "Torna a tutte le camere" : "Solo lui a schermo"}
        onClick={() => (soloLui ? hostSetMode("call") : hostSetMode("client", t.pid))}
      />
      <Riga
        icona={t.camOn ? <VideoOff className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
        testo={t.camOn ? "Spegni la sua camera" : "Accendi la sua camera"}
        onClick={() => setGuestDevice(t.pid, "cam", !t.camOn)}
      />
      <Riga
        icona={muto ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
        testo={muto ? "Riattiva il suo microfono" : "Muta il suo microfono"}
        onClick={() => {
          const ora = scambiaMuto(t.pid);
          setGuestDevice(t.pid, "mic", !ora);
        }}
      />
      {/*  ── ⚠️ «FAMMI VEDERE DIETRO» ─────────────────────────────────────
           Richiesta del committente: «aggiungi un pulsante per ruotare la
           videocamera agli ospiti». È la richiesta che si fa in ogni
           consulenza: con la camera frontale il cliente dovrebbe girarsi di
           spalle e perdere lo schermo.
           ⚠️ Non chiede nessun permesso nuovo — la camera è già aperta —
            quindi riesce anche su iPhone, dove ACCENDERE una camera spenta
            vuole il suo dito. Se il suo telefono ha una camera sola, l'esito
            torna indietro e lo dice. */}
      <Riga
        icona={<SwitchCamera className="h-3.5 w-3.5" />}
        testo="Gira la sua camera (davanti/dietro)"
        onClick={() => giraCameraOspite(t.pid)}
      />
      {/*  ── ⚠️ RICHIEDERE DI NUOVO I PERMESSI ───────────────────────────
           Richiesta del committente: «fai che posso inviare a mano nuovamente
           richiesta di accedere camera e microfono».
           Le due righe qui sopra ACCENDONO e SPENGONO, che è un'altra cosa: se
           il cliente ha chiuso l'avviso per sbaglio, o ha dato il permesso al
           browser DOPO, non c'è più niente sul suo schermo da toccare e
           dall'altra parte non succede nulla. Questa rimanda la richiesta
           com'era la prima volta, senza dover spegnere e riaccendere. */}
      <Riga
        icona={<Video className="h-3.5 w-3.5" />}
        testo="Richiedi di nuovo camera e microfono"
        //  ⚠️ `chiediMediaOspite`, non due «accendi»: quello impone uno stato e
        //   a chi RISULTA già acceso non fa comparire niente da toccare. Vedi
        //   il gestore `chiedimedia`.
        onClick={() => chiediMediaOspite(t.pid)}
      />
      <Riga
        icona={<RefreshCw className="h-3.5 w-3.5" />}
        testo="Aggiorna il suo schermo"
        onClick={() => reloadGuest(t.pid)}
      />
      <div className="my-1 border-t border-white/10" />
      {/*  ⚠️ Le due che non si disfano restano in fondo e separate: qui si sta
           premendo su una faccia, non scegliendo da un elenco, e un dito che
           scivola non deve poter buttare fuori un cliente. */}
      <Riga
        rosso
        icona={<UserX className="h-3.5 w-3.5" />}
        testo="Rimuovi dalla consulenza"
        onClick={() => {
          if (confirm(`Rimuovere ${t.name} dalla consulenza?`)) kickGuest(t.pid);
        }}
      />
      <Riga
        rosso
        icona={<Ban className="h-3.5 w-3.5" />}
        testo="Blocca: non potrà rientrare"
        onClick={() => {
          if (
            confirm(`Bloccare ${t.name}? Verrà rimosso e non potrà più rientrare con questo link.`)
          )
            void blockGuest(t.pid);
        }}
      />
    </PeoplePopover>
  );
}

/** ── IL PULSANTE SULLA FACCIA DI CHI HA LA CAMERA SPENTA ───────────────────
 *
 *  Richiesta del committente: «quando mi arriva il messaggio che la camera
 *  dell'utente è spenta, ci sia un pulsante SOPRA LA SUA SCHERMATA per inviare
 *  di nuovo la richiesta di accedere a camera e microfono, e all'utente arriva
 *  di nuovo la notifica dove può autorizzare».
 *
 *  La richiesta si poteva già rimandare da due posti: l'avviso in fondo allo
 *  schermo e il menu che si apre tenendo premuto. Tutti e due vanno cercati, e
 *  il secondo bisogna sapere che esiste. Qui sta dove si sta già guardando: sul
 *  riquadro nero della persona che non si vede.
 *
 *  ⚠️ COMPARE SOLO SUL RIQUADRO DI CHI HA LA CAMERA SPENTA, e solo al
 *   consulente: sopra una faccia che si vede non serve a niente, e un ospite
 *   sulle camere degli altri non comanda niente.
 *  ⚠️ DICE CHE È PARTITA. Premere e non vedere accadere niente — perché il
 *   permesso ora lo deve dare l'altra persona, e ci mette il tempo che ci
 *   mette — è indistinguibile da un pulsante rotto: è il modo in cui è stato
 *   segnalato il comando della camera, la prima volta. */
function ChiediMediaSullaCamera({ t }: { t: Tile }) {
  const [inviata, setInviata] = useState(false);
  useEffect(() => {
    if (!inviata) return;
    const id = setTimeout(() => setInviata(false), 4000);
    return () => clearTimeout(id);
  }, [inviata]);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        chiediMediaOspite(t.pid);
        setInviata(true);
      }}
      title={`Chiedi a ${t.name} di attivare camera e microfono: gli comparirà la richiesta sul suo schermo`}
      //  ⚠️ Sopra la targhetta del nome (`bottom-1 left-1`), non accanto: su
      //   un riquadro stretto si sovrapporrebbero e non si leggerebbe nessuna
      //   delle due.
      className={`absolute bottom-7 left-1/2 z-[2] flex max-w-[94%] -translate-x-1/2 items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold backdrop-blur transition ${
        inviata
          ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100"
          : "border-brand/50 bg-brand/25 text-white hover:bg-brand/40"
      }`}
    >
      {inviata ? <Check className="h-3 w-3 shrink-0" /> : <Video className="h-3 w-3 shrink-0" />}
      <span className="truncate">
        {inviata ? "Richiesta inviata" : "Chiedi camera e microfono"}
      </span>
    </button>
  );
}

function ParticipantTileInner({
  t,
  onRatio,
  riempi,
}: {
  t: Tile;
  onRatio?: (r: number) => void;
  riempi?: boolean;
}) {
  const st = useCall();
  const showVideo = t.camOn && !!t.stream;
  const isHost = t.role === "host";
  // tile del presentatore (vista di un altro partecipante): nome sempre risolto
  const label = isHost && !t.isLocal ? presenterDisplayName(st) : t.name;
  /*  ── LA PRESSIONE LUNGA ───────────────────────────────────────────────
      Mezzo secondo fermi su una camera e si apre il menu dei comandi su quella
      persona. Vale solo per il consulente e solo sulle camere ALTRUI: sulla
      propria non c'è niente da comandare a distanza, e un ospite sulle camere
      degli altri non comanda niente.
      ⚠️ Il tocco normale non deve cambiare: il tempo si annulla appena il dito
       si alza o si muove (`onPointerMove` con una soglia, perché un dito
       fermo si muove sempre di un paio di punti). */
  const comandabile = st.role === "host" && !t.isLocal && !isHost && !!t.pid;
  const [menuQui, setMenuQui] = useState<{ x: number; y: number } | null>(null);
  const attesaMenu = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partenza = useRef<{ x: number; y: number } | null>(null);
  const fermaAttesa = () => {
    if (attesaMenu.current) {
      clearTimeout(attesaMenu.current);
      attesaMenu.current = null;
    }
  };
  useEffect(() => fermaAttesa, []);
  const apriMenu = (x: number, y: number) => {
    //  Il menu è largo 288 e alto ~260: non deve uscire dallo schermo, se no
    //  metà comandi non si raggiungono (misurato su un telefono stretto).
    const l = typeof window !== "undefined" ? window.innerWidth : 1024;
    const a = typeof window !== "undefined" ? window.innerHeight : 768;
    setMenuQui({ x: Math.max(8, Math.min(x, l - 296)), y: Math.max(8, Math.min(y, a - 300)) });
  };
  const giuSullaCamera = (e: React.PointerEvent) => {
    if (!comandabile || e.button === 2) return;
    partenza.current = { x: e.clientX, y: e.clientY };
    fermaAttesa();
    attesaMenu.current = setTimeout(() => {
      attesaMenu.current = null;
      apriMenu(e.clientX, e.clientY);
    }, 500);
  };
  const mossoSullaCamera = (e: React.PointerEvent) => {
    if (!attesaMenu.current || !partenza.current) return;
    if (
      Math.abs(e.clientX - partenza.current.x) > 10 ||
      Math.abs(e.clientY - partenza.current.y) > 10
    )
      fermaAttesa();
  };
  return (
    <>
      {/* ── L'IMMAGINE NON SI TAGLIA MAI ────────────────────────────────
          `object-contain`: il riquadro ha già la forma del flusso (vedi
          ParticipantTile), quindi di norma non avanza nulla; se per un istante
          le due forme non coincidono — metadati non ancora arrivati, camera
          appena ruotata — si vede un bordo di sfondo neutro invece di perdere
          mezza inquadratura. Prima era `object-cover`, ed è il motivo per cui
          da una camera 16:9 dentro un riquadro quadrato spariva quasi metà
          larghezza. */}
      {/*  ⚠️ …TRANNE NELLA CELLA QUADRATA, dove l'immagine la riempie
           (`object-cover`) e si perde quello che avanza: è la richiesta
           «quadrato, e che occupi più spazio possibile», ed è quello che fa
           ogni applicazione di videochiamata. Il perché per esteso, e dove
           invece l'immagine resta intera, sta in shop/griglia-camere. */}
      <VideoEl
        stream={t.stream}
        muted={t.muted}
        mirror={specchiaTile(t)}
        onRatio={onRatio}
        className={`h-full w-full ${riempi ? "object-cover" : "object-contain"} ${showVideo ? "" : "opacity-0"}`}
      />
      {!showVideo && (
        <CamOffPlaceholder name={label} isHost={isHost} connecting={!t.stream && !t.isLocal} />
      )}
      {/* Feature 1 — presentatore: UNICO badge = BrandLogo + nome (padded); ospite: solo nome.
          Feature 2 — la MIA tile (locale) mostra sempre "Tu", mai il nome digitato. */}
      {/* Il PRESENTATORE non vede il proprio badge logo+nome sulla PROPRIA camera:
          la filigrana resta visibile agli OSPITI sulla tile del presentatore. */}
      {isHost && !t.isLocal ? (
        <PresenterBadge name={label} />
      ) : (
        <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">
          {t.isLocal ? "Tu" : t.name}
        </div>
      )}
      {/* ── SPEGNI LA CAMERA DI QUESTA PERSONA, DA QUI ───────────────────
          Richiesta del committente: «aggiungi opzione per spegnere la camera
          dell'ospite». Il comando esisteva — dentro il pannello
          «Partecipanti», che si apre da un'iconcina — e infatti non si
          trovava. Il posto giusto è questo: sopra la faccia della persona di
          cui si sta parlando, così non c'è nessun elenco da leggere per
          capire quale delle tre camere si sta spegnendo.
          ⚠️ Solo il presentatore lo vede (`role === "host"`): la stessa tile
           la disegnano anche gli ospiti, che sulle camere altrui non comandano
           niente. */}
      {/*  ── E TENENDO PREMUTO, TUTTO IL RESTO ───────────────────────────
           L'iconcina qui sotto fa la cosa più frequente in un colpo; il menu
           (`MenuSullaCamera`) porta le altre — solo lui a schermo, microfono,
           aggiorna il suo schermo, rimuovi, blocca — senza aggiungere altre
           iconcine sopra la faccia della persona. */}
      {comandabile && (
        //  Un velo trasparente che raccoglie la pressione: sta SOTTO i pulsanti
        //  (che hanno la loro z) e non cambia niente di quello che si vede.
        <div
          className="absolute inset-0"
          onPointerDown={giuSullaCamera}
          onPointerUp={fermaAttesa}
          onPointerLeave={fermaAttesa}
          onPointerCancel={fermaAttesa}
          onPointerMove={mossoSullaCamera}
          onContextMenu={(e) => {
            e.preventDefault();
            apriMenu(e.clientX, e.clientY);
          }}
        />
      )}
      {menuQui && <MenuSullaCamera t={t} at={menuQui} onClose={() => setMenuQui(null)} />}
      {st.role === "host" && !t.isLocal && !isHost && !!t.pid && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setGuestDevice(t.pid, "cam", !t.camOn);
          }}
          title={t.camOn ? `Spegni la camera di ${t.name}` : `Riaccendi la camera di ${t.name}`}
          className={`absolute right-1 top-1 rounded-md border p-1 backdrop-blur transition ${
            t.camOn
              ? "border-white/20 bg-black/50 text-white/70 hover:bg-black/80 hover:text-white"
              : "border-red-400/50 bg-red-500/30 text-red-100 hover:bg-red-500/50"
          }`}
        >
          {t.camOn ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}
        </button>
      )}
      {comandabile && !t.camOn && <ChiediMediaSullaCamera t={t} />}
    </>
  );
}
/** Proporzioni di partenza finché il flusso non dice le sue: quelle di quasi
 *  tutte le webcam. Serve solo per il primo istante, poi arriva la misura vera. */
const AR_DEFAULT = 16 / 9;
/** Limiti di buon senso: un valore assurdo (flusso rotto, misura a metà) non
 *  deve poter generare un riquadro a striscia. */
const clampAr = (r: number) =>
  Number.isFinite(r) && r > 0 ? Math.min(2.4, Math.max(0.42, r)) : AR_DEFAULT;

function ParticipantTile({
  t,
  fill,
  onAr,
  quadrato,
}: {
  t: Tile;
  fill?: boolean;
  onAr?: (r: number) => void;
  quadrato?: boolean;
}) {
  // ── IL RIQUADRO PRENDE LA FORMA DELLA CAMERA ───────────────────────────
  //  Prima il riquadro era QUADRATO per scelta e l'immagine veniva ritagliata
  //  per riempirlo (`object-cover`): da una camera 16:9 spariva quasi metà
  //  larghezza, e su un tablet in orizzontale — dove il quadrato era anche più
  //  alto dello spazio disponibile — si vedeva solo una fetta della persona.
  //  Ora è il contrario: il riquadro assume le proporzioni del flusso e diventa
  //  il PIÙ GRANDE rettangolo di quella forma che entra nella cella. Così
  //  l'immagine è sempre intera, su ogni formato, e non resta nemmeno la
  //  banda nera attorno — perché la cornice combacia con l'immagine.
  const [ar, setAr] = useState(AR_DEFAULT);
  //  La misura serve anche alla griglia, per decidere come disporre le celle:
  //  la si passa su per un riferimento, così cambiare disposizione non
  //  ricrea la funzione e non fa ripartire l'ascolto sul flusso video.
  const suAr = useRef(onAr);
  suAr.current = onAr;
  const onRatio = useCallback((r: number) => {
    const n = clampAr(r);
    suAr.current?.(n);
    setAr((old) => (Math.abs(n - old) < 0.01 ? old : n)); // ridisegna solo se cambia davvero
  }, []);
  const inner = <ParticipantTileInner t={t} onRatio={onRatio} riempi={quadrato} />;
  // ALONE DI CHI PARLA: bordo brand + bagliore, identico sul presentatore e
  // sull'ospite (ognuno lo calcola dai flussi che ha già: nessun ritardo).
  const st = useCall();
  const talking = !!t.pid && st.speakingPids.includes(t.pid);
  const ring = talking
    ? "border-brand shadow-[0_0_0_3px_rgba(59,130,246,.45),0_0_22px_4px_rgba(59,130,246,.35)]"
    : "border-white/10";
  const box = `relative overflow-hidden rounded-2xl border bg-brandfill transition-shadow duration-150 ${ring}`;
  //  ── CELLA QUADRATA: il riquadro È la cella ──────────────────────────────
  //   La misura l'ha già decisa la griglia (shop/griglia-camere): qui non si
  //   calcola niente, si riempie. È la differenza con il ramo qui sotto, dove
  //   invece è il riquadro a doversi ritagliare lo spazio dalla cella.
  if (quadrato) return <div className={`${box} h-full w-full`}>{inner}</div>;
  if (fill) {
    //  Container query: la cella dichiara di essere un contenitore MISURABILE e
    //  il riquadro si dimensiona su entrambi i lati — larghezza piena se la
    //  cella è alta abbastanza, altrimenti altezza piena. È l'unico modo per
    //  non sforare mai: nessuna delle due misure può superare la cella.
    return (
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden"
        style={{ containerType: "size" }}
      >
        {/* larghezza = la minore fra "tutta la cella" e "quella che spetta a
            questa altezza"; altezza uguale ma al contrario. Le due misure
            usano le unità del contenitore (cqw/cqh): niente calcoli annidati,
            così la regola resta leggibile e senza sorprese fra browser. */}
        <div
          className={box}
          style={{
            width: `min(100cqw, ${(100 * ar).toFixed(2)}cqh)`,
            height: `min(100cqh, ${(100 / ar).toFixed(2)}cqw)`,
          }}
        >
          {inner}
        </div>
      </div>
    );
  }
  //  Fuori dalla griglia a tutto schermo (dock e pannelli piccoli) l'altezza la
  //  detta il contenuto: larghezza piena, altezza dalle proporzioni, e comunque
  //  mai più alto dello spazio che ha.
  return (
    <div
      className={`${box} min-h-0 w-full`}
      style={{ aspectRatio: ar.toFixed(4), maxHeight: "100%" }}
    >
      {inner}
    </div>
  );
}
/** Lo spazio fra una camera e l'altra. Uno solo, perché la griglia lo usa per
 *  disegnare e il calcolo del lato per contare: due numeri diversi vorrebbero
 *  dire quadrati che sbordano di qualche punto. */
const GAP_CAMERE = 6;

/** Misura REALE dell'area disponibile (non della finestra): la griglia si
 *  ridispone anche quando a cambiare è solo il pannello che la contiene —
 *  teleprompter aperto, dock ridimensionato, tastiera del telefono aperta. */
function useAreaBox() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const leggi = () => {
      //  ⚠️ L'area è quella DENTRO i margini: la griglia dispone le camere lì,
      //   e misurando il riquadro esterno i quadrati risulterebbero più grandi
      //   dello spazio vero — cioè uno sborderebbe.
      const cs = typeof getComputedStyle === "function" ? getComputedStyle(el) : null;
      const meno = (a?: string, b?: string) =>
        (parseFloat(a || "0") || 0) + (parseFloat(b || "0") || 0);
      const w = el.clientWidth - meno(cs?.paddingLeft, cs?.paddingRight);
      const h = el.clientHeight - meno(cs?.paddingTop, cs?.paddingBottom);
      setBox((old) =>
        Math.abs(old.w - w) < 1 && Math.abs(old.h - h) < 1
          ? old
          : { w: Math.max(0, w), h: Math.max(0, h) },
      );
    };
    leggi();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(leggi) : null;
    ro?.observe(el);
    //  La rotazione del tablet non sempre fa scattare il ResizeObserver in
    //  tempo (iOS misura ancora il vecchio orientamento): si rilegge anche dopo.
    const orient = () => {
      leggi();
      window.setTimeout(leggi, 250);
    };
    window.addEventListener("orientationchange", orient);
    return () => {
      ro?.disconnect();
      window.removeEventListener("orientationchange", orient);
    };
  }, []);
  return { ref, ...box };
}
// fill = griglia a TUTTO SCHERMO: celle QUADRATE e tutte uguali, grandi quanto
// l'area MISURATA consente (vedi shop/griglia-camere). Telefono in verticale →
// due quadrati impilati che riempiono l'altezza; monitor largo → due quadrati
// affiancati che riempiono la larghezza. Fuori dal «fill» (pannelli piccoli)
// resta la griglia bilanciata, dove ogni riquadro prende la forma della sua
// camera e l'immagine non si taglia.
function ParticipantsGrid({
  tiles,
  className,
  fill,
  variant,
}: {
  tiles: Tile[];
  className?: string;
  fill?: boolean;
  variant?: "wrap";
}) {
  const area = useAreaBox();
  // (B) PANNELLO PRESENTATORE — le camere saturano lo spazio disponibile. flex-wrap:
  // quando lo spazio orizzontale si stringe (o ci sono più camere) le tile vanno a
  // capo su una seconda riga, tutte della stessa altezza.
  if (variant === "wrap") {
    return (
      <div
        className={className}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: GAP_CAMERE,
          width: "100%",
          height: "100%",
          alignContent: "center",
          justifyContent: "center",
          overflow: "auto",
        }}
      >
        {tiles.map((t) => (
          <div
            key={t.isLocal ? "local" : t.pid}
            className="flex flex-1 basis-[180px] items-center justify-center"
            style={{ minWidth: 160, maxHeight: "100%" }}
          >
            {/* niente più gabbia quadrata: il riquadro prende la forma della camera */}
            <ParticipantTile t={t} />
          </div>
        ))}
      </div>
    );
  }
  const n = Math.max(tiles.length, 1);
  //  ── A TUTTO SCHERMO: QUADRATI, TUTTI UGUALI, PIÙ GRANDI CHE SI PUÒ ──────
  //   Quante colonne, quante righe e che lato lo decide shop/griglia-camere
  //   dall'area MISURATA (non dalla larghezza della finestra: il pannello del
  //   presentatore è una colonna stretta dentro una finestra larga).
  //   ⚠️ Finché la misura non c'è (primo disegno) le celle si allargano da
  //    sole: `lato = 0` vuol dire «non lo so ancora», non «zero punti».
  if (fill) {
    const q = disposizioneQuadrata(n, area.w, area.h, GAP_CAMERE);
    const misura = q.lato > 0 ? `${q.lato.toFixed(1)}px` : "minmax(0, 1fr)";
    const stileQ: React.CSSProperties = {
      display: "grid",
      gridTemplateColumns: `repeat(${q.colonne}, ${misura})`,
      gridTemplateRows: `repeat(${q.righe}, ${misura})`,
      gap: GAP_CAMERE,
      //  I quadrati stanno in mezzo all'area: quello che avanza si divide in
      //  parti uguali attorno, invece di ammucchiarsi tutto da un lato.
      alignContent: "center",
      justifyContent: "center",
      height: "100%",
      width: "100%",
      overflow: "hidden",
    };
    return (
      <div ref={area.ref} className={className} style={stileQ} data-rows={q.righe}>
        {tiles.map((t) => (
          <ParticipantTile key={t.isLocal ? "local" : t.pid} t={t} quadrato />
        ))}
      </div>
    );
  }
  const cols =
    n <= 1
      ? 1
      : n === 2
        ? 2
        : n === 3
          ? 3
          : n === 4
            ? 2
            : n <= 6
              ? 3
              : n <= 9
                ? 3
                : Math.ceil(Math.sqrt(n));
  const rows = Math.ceil(n / cols);
  const style: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridAutoRows: "min-content",
    gap: GAP_CAMERE,
    alignContent: "center",
    justifyContent: "center",
  };
  return (
    <div ref={area.ref} className={className} style={style} data-rows={rows}>
      {tiles.map((t) => (
        <ParticipantTile key={t.isLocal ? "local" : t.pid} t={t} />
      ))}
    </div>
  );
}
// Feature 5 — filigrana logo + nome presentatore (badge pulito, poco arrotondato, leggibile
// sul video). Come PresenterBadge: SEMPRE in basso a sinistra.
//  Il nome è SEMPRE quello del presentatore: viene risolto QUI dallo stato globale
//  (callstate → roster host → "Presentatore"), così nessun chiamante può passare
//  per sbaglio il nome dell'utente locale o il segnaposto "Ospite".
function LogoWatermark({ name }: { name?: string }) {
  const st = useCall();
  const shown =
    isRealName(name) && name!.trim().toLowerCase() !== (st.myName || "").trim().toLowerCase()
      ? name!.trim()
      : presenterDisplayName(st);
  return (
    <div className="absolute bottom-3 left-3 z-[94] inline-flex items-center gap-2 rounded-lg bg-black/75 px-2.5 py-1.5 ring-1 ring-white/10">
      <BrandLogo className="h-5 w-auto" />
      {shown && (
        <span className="border-l border-white/20 pl-2 text-[11px] font-semibold leading-none text-white/90">
          {shown}
        </span>
      )}
    </div>
  );
}

// ── QUANTO È GRANDE LA CAMERA PICCOLA (PiP) ───────────────────────────────
//  Posizione E misura viaggiano fra i due dispositivi: quello che il
//  consulente vede nel suo specchio è la camerina COM'È sul telefono del
//  cliente, e allargandola di qua si allarga di là.
//
//  ── ⚠️ IL METRO È LO SCHERMO DEL CLIENTE, NON QUELLO DI CHI GUARDA ───────
//  Prima la misura era locale e viaggiava solo come FRAZIONE di finestra: il
//  cliente sceglieva 110px sui suoi 390 (il 28%), e sul monitor del consulente
//  quel 28% diventava un cerchio da 420px. Proporzionalmente uguale, di fatto
//  un'altra cosa — e lo specchio serve proprio a vedere quanto è grande DA
//  LORO. Adesso i due lati fanno il conto sullo stesso metro (`base`): le
//  dimensioni reali del dispositivo del cliente. 28% di 390 fa 110 punti su
//  tutti e due gli schermi, e il numero torna indietro identico quando è il
//  consulente a trascinare.
//  ⚠️ Senza un cliente collegato non c'è metro comune: si torna alla finestra
//   locale, che è l'unica cosa vera in quel momento.
//  (La misura si ricorda in localStorage, la posizione in sessionStorage: è
//   roba della singola consulenza.)
const PIP_SIZE_KEY = "hg_pip_w";
/** Misura scelta a mano e ancora valida per questo schermo, oppure null.
 *  DIFESA: in memoria può esserci qualsiasi cosa (vecchia versione, altro
 *  dispositivo, valore manomesso): tutto ciò che non è un numero dentro i
 *  limiti viene ignorato e si torna al predefinito. */
function pipLarghezzaSalvata(base?: SchermoBase): number | null {
  if (typeof window === "undefined") return null;
  try {
    const n = Number(localStorage.getItem(PIP_SIZE_KEY));
    const { min, max } = pipLimiti(base);
    if (Number.isFinite(n) && n >= min && n <= max) return Math.round(n);
  } catch {
    /* memoria non leggibile: vale il predefinito */
  }
  return null;
}
/** Larghezza della PiP + gesto per cambiarla. Funziona col dito: l'angolo si
 *  trascina per la misura esatta, un tocco secco passa alla misura successiva. */
function usePipSize(base?: SchermoBase) {
  //  La misura decisa dall'altro lato: quando arriva, vince sulla locale.
  //  È l'unico modo perché "allargo io e si allarga anche a lui" funzioni.
  const frazioneCondivisa = useCall().pipFrazione;
  //  ⚠️ Il metro comune: le dimensioni del dispositivo del cliente quando si
  //   sanno, altrimenti la finestra di qui. Vedi il blocco sopra.
  const metro = base && base.w > 0 ? base : schermoLocale();
  const metroW = metro.w;
  //  Misura giusta GIÀ AL PRIMO DISEGNO: la PiP compare direttamente della
  //  dimensione ricordata, senza il salto da un valore neutro (la PiP non
  //  viene mai resa lato server — appare solo a chiamata avviata).
  /** ── ⚠️ LO SPECCHIO NON PARTE DALLA MISURA DI CHI GUARDA ──────────────
   *  `base` c'è solo nello specchio del consulente, e lì la misura NON è sua:
   *  è quella del cliente. Leggendo `hg_pip_w` — la larghezza che il
   *  consulente si è scelto sul monitor — il cerchio partiva da 240 punti e
   *  buoni, cioè enorme: era la sua camerina, non quella del cliente. Nello
   *  specchio vale solo la misura predefinita del dispositivo di là, finché
   *  non arriva quella vera dalla frazione condivisa. */
  const [w, setW] = useState<number>(() =>
    base ? pipLarghezzaDefault(base) : (pipLarghezzaSalvata() ?? pipLarghezzaDefault()),
  );
  //  true = l'utente ha scelto una misura sua → la finestra che cambia non
  //  deve più sovrascriverla (solo ricondurla dentro i limiti).
  const scelto = useRef(false);
  /*  ── ⚠️ LA SCELTA SI LEGGE UNA VOLTA SOLA ──────────────────────────────
      Questa riga stava dentro l'effetto qui sotto, che si rifà a ogni
      cambio di larghezza. Su un telefono la barra degli indirizzi che
      compare e sparisce È un cambio di larghezza: a ogni scorrimento il
      programma si dimenticava che una misura era stata scelta e rimetteva
      quella predefinita — la camerina tornava da sola com'era, e la misura
      arrivata dal consulente durava il tempo di uno scorrimento. */
  useEffect(() => {
    scelto.current = !base && pipLarghezzaSalvata() !== null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    //  Rotazione del dispositivo / finestra ridimensionata: se la misura non
    //  è stata scelta a mano si ricalcola quella giusta per il nuovo schermo.
    const suRid = () =>
      setW((v) => (scelto.current ? Math.min(v, pipLimiti(base).max) : pipLarghezzaDefault(base)));
    window.addEventListener("resize", suRid);
    window.addEventListener("orientationchange", suRid);
    return () => {
      window.removeEventListener("resize", suRid);
      window.removeEventListener("orientationchange", suRid);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metroW]);

  //  ── ARRIVA UNA MISURA DALL'ALTRO LATO ───────────────────────────────────
  //   La frazione si riconverte nei pixel di QUESTO schermo e si tiene dentro
  //   i limiti locali: su un telefono la stessa quota non può diventare un
  //   riquadro che copre il contenuto. Non si scrive in memoria — è una scelta
  //   dell'altro per questa consulenza, non una preferenza di chi guarda.
  useEffect(() => {
    if (!Number.isFinite(frazioneCondivisa as number) || !frazioneCondivisa) return;
    scelto.current = true;
    //  ⚠️ Sul METRO COMUNE, non su `window.innerWidth`: è la riga che fa
    //   arrivare al consulente la stessa camerina che ha in mano il cliente,
    //   e non una sua versione gonfiata dal monitor. Vedi pip-misure.ts.
    setW(misuraDaFrazione(frazioneCondivisa as number, metro));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frazioneCondivisa, metroW]);
  /** Applica subito una misura (schermo). Il valore viene sempre ricondotto
   *  dentro i limiti: nessun trascinamento può far uscire la PiP di scena. */
  const applica = useCallback(
    (n: number) => {
      const { min, max } = pipLimiti(base);
      const v = Math.round(Math.min(max, Math.max(min, Number.isFinite(n) ? n : min)));
      scelto.current = true;
      setW(v);
      return v;
    },
    [metroW],
  );
  //  La scrittura in memoria avviene SOLO a gesto finito: durante il
  //  trascinamento arrivano decine di eventi al secondo e localStorage è una
  //  scrittura sincrona — scrivere a ogni movimento farebbe scattare la PiP.
  /** Quando si è detta l'ultima misura all'altro lato: durante il
   *  trascinamento si manda al massimo otto volte al secondo. */
  const ultimoInvio = useRef(0);
  const ricorda = useCallback(
    (v: number, opts?: { vivo?: boolean }) => {
      /*  ⚠️ IN MEMORIA VA SOLO LA PROPRIA MISURA. Nello specchio del
        consulente il numero è quello del CLIENTE: scrivendolo qui, la
        camerina del consulente ereditava la misura pensata per un telefono
        (o viceversa). La memoria è una preferenza di chi guarda. */
      if (!base && !opts?.vivo) {
        try {
          localStorage.setItem(PIP_SIZE_KEY, String(v));
        } catch {
          /* niente memoria: vale per questa sessione */
        }
      }
      if (metroW <= 0) return;
      /*  ── ⚠️ LA MISURA SI DICE MENTRE SI TRASCINA, NON SOLO ALLA FINE ─────
        Segnalazione del committente: «cambio la misura della camerina e sul
        dispositivo del cliente non risponde».
        Si mandava solo a gesto FINITO, e per due motivi non bastava:
         · mentre trascini guardi l'altro schermo e non succede niente —
           sembra rotto, e si smette di provare prima di lasciare il dito;
         · se il gesto non finisce con un "dito alzato" (sul telefono il
           browser lo ANNULLA spesso: uno scorrimento, una notifica, il dito
           che esce dallo schermo) la misura non partiva MAI.
        Ora parte anche durante, al massimo otto volte al secondo — abbastanza
        per vederla muoversi di là, abbastanza poco da non intasare il canale. */
      const ora = Date.now();
      if (opts?.vivo) {
        if (ora - ultimoInvio.current < 125) return;
      }
      ultimoInvio.current = ora;
      //  La misura viaggia come frazione del METRO COMUNE, così torna
      //  dall'altra parte esattamente com'è qui.
      setPipFrazione(frazioneDaMisura(v, metro));
    },
    [metroW, base],
  );
  //  Trascinamento dell'angolo. La larghezza si calcola dallo spostamento del
  //  dito rispetto al punto in cui è partito: non serve misurare il riquadro,
  //  quindi non c'è nessuno scatto al primo movimento.
  const gesto = useRef<{
    x0: number;
    w0: number;
    t0: number;
    ultima: number;
    mosso: boolean;
  } | null>(null);
  /** A che punto è il giro delle misure: avanza a ogni tocco. Vedi il perché
   *  nel gestore del tocco qui sotto. */
  const passo = useRef(0);
  const maniglia = {
    onPointerDown: (e: React.PointerEvent) => {
      //  Fermato qui: altrimenti il riquadro comincerebbe anche a SPOSTARSI
      //  (il contenitore ascolta gli stessi eventi per il trascinamento).
      e.stopPropagation();
      gesto.current = { x0: e.clientX, w0: w, t0: Date.now(), ultima: w, mosso: false };
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      const g = gesto.current;
      if (!g) return;
      e.stopPropagation();
      const dx = e.clientX - g.x0;
      //  Sotto i 4px è tremolio del dito, non un trascinamento: serve a
      //  distinguere il TOCCO (che cambia misura) dal TRASCINAMENTO.
      if (Math.abs(dx) > 4) g.mosso = true;
      if (g.mosso) {
        g.ultima = applica(g.w0 + dx);
        ricorda(g.ultima, { vivo: true });
      }
    },
    onPointerUp: (e: React.PointerEvent) => {
      const g = gesto.current;
      if (!g) return;
      e.stopPropagation();
      gesto.current = null;
      //  Tocco secco (nessuno spostamento): passa alla misura successiva fra
      //  piccola, consigliata e grande. È la scorciatoia per chi non ha voglia
      //  di trascinare, ed è il gesto naturale sul telefono.
      if (!g.mosso && Date.now() - g.t0 < 600) {
        /*  ── ⚠️ SI GIRA PER POSIZIONE, NON PER SOMIGLIANZA ────────────────
            Qui si cercava la misura attuale dentro l'elenco e si prendeva la
            successiva. Ma le misure vengono tenute dentro gli estremi, e su
            uno schermo stretto il tetto ne schiaccia due sullo stesso numero:
            la ricerca trovava sempre la PRIMA delle due, il «successivo» era
            l'altra — identica — e il cerchio non cambiava più di un pixel.
            È il «si allarga ma poi non si stringe più» segnalato dal
            committente: da grande non si tornava più indietro.
            Adesso il giro lo tiene un contatore: ogni tocco avanza di uno,
            qualunque cosa dicano i numeri. I doppioni li toglie `pipMisure`,
            così il giro ha sempre un effetto visibile. */
        const m = pipMisure(base);
        const vicina = m.findIndex((x) => Math.abs(x - w) < 12);
        //  Se la misura attuale è una delle note si riparte da lì (il tocco
        //  dopo un trascinamento deve comportarsi come ci si aspetta); se non
        //  lo è, si riparte dall'inizio del giro.
        const da = vicina >= 0 ? vicina : passo.current;
        passo.current = (da + 1) % m.length;
        ricorda(applica(m[passo.current]));
        return;
      }
      ricorda(g.ultima);
    },
    //  ⚠️ Gesto ANNULLATO dal browser (succede spesso col dito): la misura
    //   raggiunta va comunque tenuta e detta all'altro lato. Buttarla via
    //   significava un trascinamento che non lasciava traccia da nessuna parte.
    onPointerCancel: () => {
      const g = gesto.current;
      gesto.current = null;
      if (g && g.mosso) ricorda(g.ultima);
    },
  };
  return { w, maniglia };
}

// Feature 4 — PiP piccola e spostabile mostrata al guest durante i contenuti
//  (mai griglia a schermo intero in modalità "content"). Prima tile = principale.
function ContentPip({
  tiles,
  inset,
  mirror,
  base,
}: {
  tiles: Tile[];
  inset?: { top?: number; bottom?: number };
  mirror?: boolean;
  /** lo schermo su cui si misura: per lo specchio del consulente è il
   *  dispositivo del cliente, così la camerina è grande com'è da lui. */
  base?: SchermoBase;
}) {
  const st = useCall();
  const list = Array.isArray(tiles) ? tiles.filter(Boolean) : [];
  // posizione CONDIVISA col presentatore (0..1): trascinandola si sposta anche di là
  const { ref, style, handlers } = usePipPlacement(inset);
  // misura LOCALE, regolabile dai due lati e ricordata (vedi usePipSize)
  const { w, maniglia } = usePipSize(base);
  const pName = presenterDisplayName(st);
  return (
    //  ── ⚠️ TONDA, NON RETTANGOLARE ──────────────────────────────────────
    //   Il contenitore non disegna più niente: niente bordo, niente fondo,
    //   niente imbottitura. Erano quelli a fare la scatola attorno alle
    //   camerine — e la scatola resta visibile anche se dentro arrotondi le
    //   camere. Adesso ogni camerina è un cerchio a sé, col suo anello e la
    //   sua ombra, e fra le due non c'è nessun rettangolo.
    <div
      ref={ref}
      style={{ ...style, width: w }}
      className="fixed z-[94] touch-none cursor-move select-none"
      title={
        mirror
          ? "Anteprima della camera piccola come la vede il cliente — trascinala per spostarla anche sul suo schermo"
          : undefined
      }
      {...handlers}
    >
      {mirror && (
        //  ⚠️ La targhetta ha un fondo suo: senza la scatola attorno, una
        //   scritta trasparente sopra il contenuto non si leggerebbe più.
        <div className="mx-auto mb-1 flex w-fit items-center justify-center gap-1 whitespace-nowrap rounded-full bg-black/70 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-brand backdrop-blur">
          <Move className="h-2.5 w-2.5" /> come la vede il cliente
        </div>
      )}
      <div className="flex flex-col items-center gap-2">
        {list.map((t) => (
          <PipTile
            key={t.isLocal ? "local" : t.pid}
            t={t}
            mirror={mirror}
            nomePlaceholder={t.role === "host" && !t.isLocal ? pName : t.name}
          />
        ))}
      </div>
      {/* ── ANGOLO PER REGOLARE LA MISURA ────────────────────────────────
          Si trascina (dito o mouse) per la misura esatta; un tocco secco
          passa alla successiva fra piccola, consigliata e grande.
          L'area sensibile (28px) è molto più larga del segno disegnato: col
          dito serve almeno mezzo centimetro, altrimenti si finisce per
          spostare il riquadro invece di ridimensionarlo. */}
      {/*  ⚠️ Sul BORDO del cerchio, non nell'angolo del riquadro: con le
           camerine tonde l'angolo in basso a destra è aria, e una maniglia
           che galleggia nel vuoto non si capisce a cosa appartenga. */}
      <div
        {...maniglia}
        data-hg-noptr
        title="Trascina per ridimensionare la camera · tocca per cambiare misura"
        className="absolute bottom-[4%] right-[4%] z-20 flex h-7 w-7 cursor-nwse-resize touch-none items-center justify-center rounded-full bg-black/60 backdrop-blur"
      >
        <svg
          viewBox="0 0 10 10"
          aria-hidden
          className="h-3.5 w-3.5 text-white/85 drop-shadow-[0_1px_2px_rgba(0,0,0,.9)]"
        >
          <path
            d="M9 1 1 9M9 5 5 9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

/** Una camerina della PiP: un CERCHIO.
 *  ── ⚠️ TONDA, E QUINDI RITAGLIATA ────────────────────────────────────────
 *  Le altre camerine seguono le proporzioni del flusso per non tagliare la
 *  faccia. Un cerchio invece è quadrato per forza, e allora si riempie
 *  (`object-cover`) invece di rimpicciolire: dentro un tondo, un video 16:9
 *  «contenuto» diventa una striscia in mezzo a due mezzelune vuote — cioè un
 *  rettangolo disegnato dentro un cerchio, il contrario di quello che serve.
 *  Con `cover` si perdono i lati, che in un mezzo busto sono sfondo.
 *  ⚠️ Il nome sta DENTRO, in basso e centrato: in un cerchio l'angolo in basso
 *   a sinistra non esiste — una targhetta lì viene tagliata a metà.
 *  ⚠️ `mirror` vuol dire "anteprima di ciò che vede il cliente" (cambia solo
 *   il colore dell'anello); la specchiatura dell'IMMAGINE è `specchiaTile`. */
function PipTile({
  t,
  nomePlaceholder,
  mirror,
}: {
  t: Tile;
  nomePlaceholder: string;
  mirror?: boolean;
}) {
  const showVideo = t.camOn && !!t.stream;
  return (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-full bg-brandfill shadow-2xl shadow-black/50 ring-2 ${
        mirror ? "ring-brand/60" : "ring-white/25"
      }`}
    >
      <VideoEl
        stream={t.stream}
        muted={t.muted}
        mirror={specchiaTile(t)}
        className={`h-full w-full object-cover ${showVideo ? "" : "opacity-0"}`}
      />
      {/* ── ⚠️ NIENTE NOME SULLA CAMERA ACCESA ───────────────────────────
            Dentro un cerchio grande come una moneta la targhetta col nome
            copriva il mento di chi parla, e su un fondo che cambia in
            continuazione non si leggeva comunque. In due, poi, non serve a
            niente: si sa benissimo chi è l'altro.
           ⚠️ Resta solo a camera SPENTA, dove non c'è un viso a dire chi c'è
            dietro — lì è l'unica cosa che distingue un cerchio nero da un
            altro cerchio nero. */}
      {!showVideo && <CamOffPlaceholder name={nomePlaceholder} isHost={false} compact />}
    </div>
  );
}

/** PRESENTATORE — "specchio" della PiP del cliente durante i contenuti.
 *  Mostra le STESSE camere che il cliente sta vedendo, nella STESSA posizione
 *  relativa, ed è trascinabile: spostandola qui si sposta anche sul telefono del
 *  cliente (e viceversa). QUALE camera appare resta deciso dai toggle esistenti
 *  ("mostra la mia" / "cliente" / camera di chi parla): qui non si cambia nulla. */
/** Il dispositivo che ha in mano un cliente, quando non lo sappiamo ancora.
 *  ⚠️ Un telefono, perché è quello che ha in mano un cliente in nove casi su
 *   dieci — e sbagliando per difetto viene un cerchio piccolo, che è un
 *   fastidio; sbagliando per eccesso viene mezzo schermo coperto. */
const TELEFONO_TIPO = { w: 390, h: 844 };

function ContentPipMirror({ st, ls, barH }: { st: State; ls: MediaStream | null; barH: number }) {
  if (st.mode !== "content") return null;
  /** ⚠️ Il metro è il DISPOSITIVO DEL CLIENTE: lo specchio deve dire quanto è
   *  grande la camerina da lui, non quanto sarebbe grande qui. Senza cliente
   *  collegato non c'è metro comune e vale la finestra locale. */
  /** ⚠️ E se il dispositivo del cliente non si sa ancora — collegamento appena
   *  aperto, o cliente non ancora entrato — si assume un TELEFONO, non la
   *  finestra di qui: lo specchio racconta lo schermo di là, e prendere a
   *  metro il monitor del consulente è il modo esatto in cui veniva fuori un
   *  cerchio da mezzo schermo. Appena la forma vera arriva, la misura si
   *  corregge da sola. */
  const metro = st.guestViewport && st.guestViewport.w > 0 ? st.guestViewport : TELEFONO_TIPO;
  const meTile: Tile = {
    pid: S.myPid || "me",
    name: st.presenterName || "Tu",
    role: "host",
    stream: ls,
    camOn: st.camOn,
    isLocal: true,
    muted: true,
  };
  //  ⚠️ QUALE cliente, quando sono più di uno: lo stesso di cui si prende la
  //   forma dello schermo (vedi `shop/ospiti`). Prima si prendeva il primo che
  //   capitava nell'elenco — cioè l'ordine di arrivo, un dettaglio che chi
  //   guarda non vede — e la camerina poteva mostrare una persona dentro la
  //   cornice di un'altra.
  const rifPid = pidDiRiferimento(st.roster, { focusPid: st.focusPid });
  const guest = (st.roster || []).find((r) => r.pid === rifPid) || null;
  const guestTile: Tile | null = guest
    ? {
        pid: guest.pid,
        name: guest.name,
        role: "viewer",
        stream: remoteStreams.get(guest.pid) || null,
        camOn: guest.camOn,
        isLocal: false,
        muted: true,
      }
    : null;
  // priorità identica al cliente: la camera di "chi parla" batte i toggle
  if (st.activeSpeakerPid) {
    const as = tileForPid(st, ls, st.activeSpeakerPid);
    if (as)
      return (
        <ContentPip
          tiles={[{ ...as, muted: true }]}
          inset={{ top: barH, bottom: 90 }}
          mirror
          base={metro}
        />
      );
  }
  const cc = st.contentCam || { showMine: true, showGuest: false, which: "me" as const };
  const pip: Tile[] = [];
  if (cc.showMine) pip.push(meTile);
  if (cc.showGuest && guestTile) pip.push(guestTile);
  if (pip.length === 2 && cc.which === "guest") pip.reverse();
  if (!pip.length) return null;
  return <ContentPip tiles={pip} inset={{ top: barH, bottom: 90 }} mirror base={metro} />;
}

// ── SFONDO NEUTRO BRANDIZZATO ─────────────────────────────────────────────
//  Nelle viste "solo camere" (call / presenter / client) il contenuto della pagina
//  sottostante (preventivo, slide, sito) NON deve trasparire dietro le camere.
//  Questo layer copre TUTTO il viewport con il navy profondo dell'app (stile
//  bg-blueprint) + griglia sottile e glow: coerente con il resto dell'interfaccia.
function NeutralBackdrop() {
  return (
    <div className="bg-brandfill fixed inset-0 z-[90] overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-6 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
    </div>
  );
}

// ── L'AREA CHE SI VEDE DAVVERO (non quella che il browser dichiara) ───────
//  Un livello `fixed inset-0` è grande quanto il viewport di LAYOUT, che sul
//  telefono e sul tablet è PIÙ GRANDE della parte visibile: le barre del
//  browser (indirizzo in alto su Android, barra compatta su iOS) stanno SOPRA
//  quel livello e coprono ciò che ci finisce sotto. In VERTICALE la striscia
//  nascosta è sottile e non si nota; in ORIZZONTALE lo schermo è alto poco più
//  di quelle barre, così la fetta coperta diventa una porzione grossa
//  dell'inquadratura — ed è la fetta in cui sta la testa.
//  Qui si misura l'area REALMENTE visibile (`visualViewport`) e la si usa come
//  cornice delle camere: nessun pixel di camera finisce più sotto una barra.
//  Durante il pinch-zoom (scale > 1) NON si segue nulla: il riquadro deve
//  restare fermo mentre l'utente ingrandisce con le dita.
type BoxVisibile = { top: number; left: number; width: number; height: number } | null;
function leggiAreaVisibile(): BoxVisibile {
  if (typeof window === "undefined") return null;
  const vv = window.visualViewport;
  if (!vv || !(vv.width > 0) || !(vv.height > 0)) return null;
  if ((vv.scale || 1) > 1.01) return null; // l'utente sta ingrandendo: non toccare nulla
  return {
    top: Math.round(vv.offsetTop || 0),
    left: Math.round(vv.offsetLeft || 0),
    width: Math.round(vv.width),
    height: Math.round(vv.height),
  };
}
function useAreaVisibile(): React.CSSProperties {
  //  Primo disegno (anche lato server) senza misure: resta il classico
  //  `inset-0`. La misura vera arriva subito dopo, dall'effetto.
  const [b, setB] = useState<BoxVisibile>(null);
  useEffect(() => {
    const uguali = (a: BoxVisibile, x: BoxVisibile) =>
      (!a && !x) ||
      (!!a &&
        !!x &&
        a.top === x.top &&
        a.left === x.left &&
        a.width === x.width &&
        a.height === x.height);
    const agg = () =>
      setB((old) => {
        const n = leggiAreaVisibile();
        return uguali(old, n) ? old : n;
      });
    agg();
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    vv?.addEventListener("resize", agg);
    vv?.addEventListener("scroll", agg);
    window.addEventListener("resize", agg);
    window.addEventListener("orientationchange", agg);
    //  iOS al cambio di orientamento misura ancora il vecchio schermo: si
    //  rilegge dopo un attimo (stesso rimedio già usato da `useAreaBox`).
    const t = window.setTimeout(agg, 300);
    return () => {
      vv?.removeEventListener("resize", agg);
      vv?.removeEventListener("scroll", agg);
      window.removeEventListener("resize", agg);
      window.removeEventListener("orientationchange", agg);
      clearTimeout(t);
    };
  }, []);
  return b
    ? { top: b.top, left: b.left, width: b.width, height: b.height, right: "auto", bottom: "auto" }
    : {};
}
/** Livello a tutto schermo che copre l'AREA VISIBILE invece del viewport
 *  dichiarato. Componente a sé perché l'hook deve stare SOPRA i return
 *  anticipati di chi lo usa (React conta gli hook per posizione). */
function StratoVisibile({ className, children }: { className?: string; children?: ReactNode }) {
  const vis = useAreaVisibile();
  return (
    <div className={`fixed inset-0 ${className || ""}`} style={vis}>
      {children}
    </div>
  );
}

// Feature 2/3 — una singola camera a TUTTO SCHERMO (presentatore o ospite scelto).
// showLogo attiva il branding presentatore (LogoWatermark + BrandLogo nel placeholder).
/** ── LOGO E NOME DENTRO L'INQUADRATURA ──────────────────────────────────────
 *  A tutto schermo l'immagine è "adattata" (object-contain): resta dello spazio
 *  vuoto sopra e sotto, o ai lati. Il badge era piazzato sull'angolo dello
 *  SCHERMO, quindi finiva su quello spazio vuoto, fuori dall'inquadratura.
 *  Qui si calcola il rettangolo REALE occupato dall'immagine — dalle proporzioni
 *  del flusso e dalle dimensioni del contenitore — e il badge ci si appoggia
 *  dentro, in basso a sinistra, come su una vera sovrimpressione televisiva. */
function InFrameBadge({ stream, name }: { stream: MediaStream | null; name?: string }) {
  const box = useRef<HTMLDivElement | null>(null);
  const [pad, setPad] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  useEffect(() => {
    const calc = () => {
      const el = box.current;
      if (!el) return;
      const track = stream?.getVideoTracks?.()[0];
      const st = track?.getSettings?.() || {};
      const vw = Number(st.width) || 16,
        vh = Number(st.height) || 9;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const scale = Math.min(r.width / vw, r.height / vh);
      setPad({
        x: Math.max(0, (r.width - vw * scale) / 2),
        y: Math.max(0, (r.height - vh * scale) / 2),
      });
    };
    calc();
    const iv = setInterval(calc, 1000); // la risoluzione può cambiare in corsa
    window.addEventListener("resize", calc);
    return () => {
      clearInterval(iv);
      window.removeEventListener("resize", calc);
    };
  }, [stream]);
  return (
    <div ref={box} className="pointer-events-none absolute inset-0">
      <div
        className="absolute inline-flex items-center gap-2 rounded-lg bg-black/75 px-2.5 py-2 ring-1 ring-white/10"
        style={{ left: pad.x + 12, bottom: pad.y + 12 }}
      >
        <BrandLogo className="h-5 w-auto" />
        {name && (
          <span className="border-l border-white/20 pl-2 text-[11px] font-semibold leading-none text-white/90">
            {name}
          </span>
        )}
      </div>
    </div>
  );
}

function FullscreenTile({
  t,
  showLogo,
  presenterName,
  waiting,
}: {
  t: Tile | null;
  showLogo: boolean;
  presenterName?: string;
  waiting?: string;
}) {
  const showVideo = !!t && t.camOn && !!t.stream;
  return (
    //  L'inquadratura vive nell'area VISIBILE: in orizzontale le barre del
    //  browser non possono più coprirne una fetta (vedi `useAreaVisibile`).
    <StratoVisibile className="bg-brandfill z-[92] flex flex-col">
      {t ? (
        <div className="relative min-h-0 flex-1">
          {/* Feature 3 — camera singola a tutto schermo: NESSUNO zoom di default → object-contain
              (adatta al display del telefono, niente ritaglio/over-zoom). L'utente può comunque
              fare pinch-zoom manuale. Vale per ogni orientamento: girando il tablet cambia la
              banda di sfondo attorno, non l'inquadratura. */}
          <VideoEl
            stream={t.stream}
            muted={t.muted}
            mirror={specchiaTile(t)}
            className={`h-full w-full object-contain ${showVideo ? "" : "opacity-0"}`}
          />
          {!showVideo && (
            <CamOffPlaceholder
              name={t.name}
              isHost={t.role === "host"}
              connecting={!t.stream && !t.isLocal}
            />
          )}
          {/* Feature 5 — il badge logo+nome del presentatore è già reso UNA sola volta in
              basso a sinistra (LogoWatermark): qui mostro il nome solo se NON c'è. */}
          {showLogo ? (
            <InFrameBadge stream={t.stream} name={presenterName} />
          ) : (
            <div className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
              <span>{t.name}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-white/50">
          {waiting || "In attesa…"}
        </div>
      )}
    </StratoVisibile>
  );
}

// ── Pulsante REGISTRA: pallino rosso pulsante + cronometro mm:ss / h:mm:ss ──
function fmtRec(s: number) {
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}
function RecButton({
  recording,
  armed,
  screen,
}: {
  recording: boolean;
  armed?: boolean;
  screen?: boolean;
}) {
  const [el, setEl] = useState(0);
  useEffect(() => {
    if (!recording) {
      setEl(0);
      return;
    }
    setEl(recElapsed());
    const iv = setInterval(() => setEl(recElapsed()), 1000);
    return () => clearInterval(iv);
  }, [recording]);
  return (
    <button
      onClick={() => toggleRecording()}
      title={
        recording
          ? screen
            ? "Registrazione schermo in corso — clicca per fermarla"
            : "Registrazione camere (senza schermo) in corso — clicca per fermarla e riavviarla con la cattura schermo"
          : armed
            ? "Registrazione automatica ARMATA: partirà da sola appena entra il cliente (clicca per iniziare subito)"
            : "La registrazione partirà DA SOLA all'ingresso del cliente (camere). Clicca per registrare lo schermo: seleziona QUESTA SCHEDA con l'audio."
      }
      className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 ${recording ? "border-red-500/60 bg-red-500/15 text-red-200" : armed ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200" : "border-white/12 bg-white/5"}`}
    >
      {recording ? (
        <>
          <span className="relative flex h-4 w-4 items-center justify-center">
            <span className="absolute inline-flex h-4 w-4 animate-ping rounded-full bg-red-500/60" />
            <span className="absolute inline-flex h-4 w-4 rounded-full border border-red-400/70" />
            <span className="relative inline-flex h-2 w-2 animate-pulse rounded-full bg-red-500" />
          </span>
          <span className="text-[11px] font-semibold tabular-nums">{fmtRec(el)}</span>
          <span className="text-[9px] font-bold uppercase tracking-wide text-red-300/90">
            {screen ? "Schermo" : "Camere"}
          </span>
          <Square className="h-3.5 w-3.5" />
        </>
      ) : (
        <>
          <span className="relative flex h-4 w-4 items-center justify-center">
            <Disc3 className={`h-4 w-4 ${armed ? "text-emerald-300" : "text-white/70"}`} />
            <span
              className={`absolute h-1.5 w-1.5 rounded-full ${armed ? "bg-emerald-400" : "bg-red-500"}`}
            />
          </span>
          {armed && <span className="text-[10px] font-semibold uppercase tracking-wide">Auto</span>}
        </>
      )}
    </button>
  );
}

// ── PiP CONDIVISA E SINCRONIZZATA — collocazione + trascinamento ──────────
//  La posizione vive in `S.pipPos` (0..1 dell'area libera) ed è la STESSA sui due
//  dispositivi. Qui la si converte in pixel LOCALI tenendo conto di:
//   · la dimensione reale della PiP (misurata) → non esce mai dai bordi;
//   · il chrome fisso locale (`inset`) → sul presentatore non copre mai la barra
//     della chiamata in alto né i comandi in basso; sull'ospite è solo un margine.
function usePipPlacement(inset?: { top?: number; bottom?: number; left?: number; right?: number }) {
  const st = useCall();
  const ref = useRef<HTMLDivElement | null>(null);
  const [, tick] = useState(0);
  const dragging = useRef(false);
  const grab = useRef({ dx: 0, dy: 0 });
  const pad = 6;
  const box = () => {
    const W = typeof window === "undefined" ? 360 : window.innerWidth;
    const H = typeof window === "undefined" ? 640 : window.innerHeight;
    const w = ref.current?.offsetWidth || 112;
    const h = ref.current?.offsetHeight || 130;
    // ── LE BARRE DEL BROWSER SONO SPAZIO OCCUPATO ─────────────────────────
    //  In orizzontale su telefono e tablet le barre stanno SOPRA i livelli
    //  fissi: una PiP appoggiata al bordo ci finisce sotto e sparisce a metà.
    //  Le strisce coperte (sopra e sotto) si ricavano dall'area visibile e si
    //  sommano ai margini. I conti restano nelle coordinate del viewport di
    //  layout, le stesse di `clientX/clientY`: il trascinamento non cambia.
    const vis = leggiAreaVisibile();
    const coperteSopra = vis ? Math.max(0, vis.top) : 0;
    const coperteSotto = vis ? Math.max(0, H - (vis.top + vis.height)) : 0;
    const top = pad + (inset?.top || 0) + coperteSopra,
      bottom = pad + (inset?.bottom || 0) + coperteSotto;
    const left = pad + (inset?.left || 0),
      right = pad + (inset?.right || 0);
    return {
      W,
      H,
      w,
      h,
      top,
      bottom,
      left,
      right,
      freeX: Math.max(1, W - w - left - right),
      freeY: Math.max(1, H - h - top - bottom),
    };
  };
  // ridimensionamento/rotazione: ricalcolo (la frazione resta, i pixel no)
  useEffect(() => {
    const on = () => tick((n) => n + 1);
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    window.visualViewport?.addEventListener("resize", on);
    //  La PiP ora si RIDIMENSIONA: cambiando misura cambiano anche i pixel
    //  liberi attorno. Senza questo, dopo un ridimensionamento la posizione
    //  restava calcolata sulla misura vecchia (riquadro fuori dal bordo).
    const ro = typeof ResizeObserver !== "undefined" && ref.current ? new ResizeObserver(on) : null;
    if (ro && ref.current) ro.observe(ref.current);
    const t = window.setTimeout(on, 60); // prima misura reale dell'elemento
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
      window.visualViewport?.removeEventListener("resize", on);
      ro?.disconnect();
      clearTimeout(t);
    };
  }, []);
  const b = box();
  // DIFESA: `pipPos` arriva anche da messaggi remoti/sessionStorage. Se per
  // qualsiasi motivo mancasse (payload vecchio, stato parziale) leggere `.x`
  // farebbe crashare TUTTO l'albero dell'ospite: qui si ricade sul default.
  const pp =
    st.pipPos && Number.isFinite(st.pipPos.x) && Number.isFinite(st.pipPos.y)
      ? st.pipPos
      : { x: 0.03, y: 0.03 };
  const style: React.CSSProperties = {
    left: Math.round(b.left + pp.x * b.freeX),
    top: Math.round(b.top + pp.y * b.freeY),
  };
  const fromPointer = (e: React.PointerEvent) => {
    const c = box();
    return {
      x: (e.clientX - grab.current.dx - c.left) / c.freeX,
      y: (e.clientY - grab.current.dy - c.top) / c.freeY,
    };
  };
  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      const r = ref.current?.getBoundingClientRect();
      grab.current = {
        dx: e.clientX - (r?.left ?? e.clientX),
        dy: e.clientY - (r?.top ?? e.clientY),
      };
      dragging.current = true;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {
        /* */
      }
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (dragging.current) setPipPos(fromPointer(e), { live: true });
    },
    onPointerUp: (e: React.PointerEvent) => {
      if (!dragging.current) return;
      dragging.current = false;
      setPipPos(fromPointer(e)); // invio FINALE al rilascio: nessuna posizione persa
    },
    onPointerCancel: () => {
      dragging.current = false;
    },
  };
  return { ref, style, handlers };
}

// PiP spostabile
function useDrag(initial: { x: number; y: number }) {
  const [pos, setPos] = useState(initial);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    setPos({
      x: Math.max(6, e.clientX - drag.current.dx),
      y: Math.max(6, e.clientY - drag.current.dy),
    });
  };
  const onUp = () => {
    drag.current = null;
  };
  return { pos, handlers: { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp } };
}

type GuestView = "none" | "host" | "waiting" | "gate" | "connecting" | "call" | "kicked";
/** Traccia OGNI cambio di schermata dell'ospite con il motivo: se qualcosa
 *  "lampeggia" si vede subito quale condizione oscilla. */
function useGuestViewLog(view: GuestView, st: State, connecting: boolean) {
  const prev = useRef<GuestView | null>(null);
  useEffect(() => {
    if (prev.current === view) return;
    if (st.role === "viewer" || isGuestLink()) {
      console.log("[GUEST] vista", prev.current ?? "—", "→", view, {
        sessionId: st.sessionId,
        role: st.role,
        sessionLive: st.sessionLive,
        joined: st.joined,
        active: st.active,
        connecting,
        kicked: st.kicked || "",
        roster: st.roster.length,
        host: st.roster.some((r) => r.role === "host"),
        streams: remoteStreams.size,
        mode: st.mode,
      });
    }
    prev.current = view;
  });
}

export function CallLayer() {
  //  Stessa ragione di `CallMount`: dentro la cornice di un webinar questo
  //  strato non deve disegnare niente.
  const dentroUnWebinar =
    typeof window !== "undefined" && !!new URLSearchParams(window.location.search).get("webinar");
  const st = useCall();
  const { localStream: ls } = useStreams();
  // (D) schermo sveglio quando la sessione è viva: host in chiamata o guest unito
  const keepAwake =
    (st.role === "host" && st.active) || (st.role === "viewer" && (st.joined || st.active));
  useWakeLock(keepAwake);
  // schermata di caricamento brandizzata subito dopo l'ingresso dell'ospite
  const connecting = useGuestConnecting(st);
  // UNICA sorgente di verità per la schermata mostrata all'ospite + traccia di
  // ogni transizione (debug da telefono: cerca "[GUEST] vista").
  const view: GuestView =
    !st.sessionId || !st.role
      ? isGuestLink()
        ? "waiting"
        : "none"
      : st.role !== "viewer"
        ? "host"
        : st.kicked
          ? "kicked"
          : !st.sessionLive
            ? "waiting"
            : !st.joined
              ? "gate"
              : connecting
                ? "connecting"
                : "call";
  useGuestViewLog(view, st, connecting);

  // link ospite ma motore non ancora configurato: MAI mostrare i contenuti sotto
  if (dentroUnWebinar) return null;
  if (!st.sessionId || !st.role) return isGuestLink() ? <WaitingScreen /> : null;
  // guest: finché il presentatore non avvia, mostra la schermata d'attesa (stile Meet)
  if (st.role === "viewer" && st.kicked) return <KickedScreen blocked={st.kicked === "blocked"} />;
  if (st.role === "viewer" && !st.sessionLive) return <WaitingScreen />;
  // GATE OBBLIGATORIO: nessun contenuto prima che l'ospite abbia inserito il nome.
  // Vale SEMPRE, anche se la videochiamata non è ancora "active" (il presentatore
  // può stare condividendo solo slide/preventivo/sito): prima il nome, poi i contenuti.
  // SALA D'ATTESA: ha bussato, aspetta il consenso del presentatore.
  if (st.role === "viewer" && st.refused) return <GuestRefused />;
  if (st.role === "viewer" && st.knocking && !st.joined) return <GuestKnocking st={st} />;
  if (st.role === "viewer" && !st.joined) return <GuestJoinGate st={st} />;
  // Entrato ma non ancora collegato: pagina di caricamento (mai i contenuti "a lampo").
  // È solo un velo visivo: `joined`/`sessionLive` restano intatti (stickiness rispettata).
  if (st.role === "viewer" && connecting) return <ConnectingScreen />;
  if (st.role === "viewer")
    return (
      <GuestSafe tag="overlay">
        <RemoteAudio st={st} />
        {/*  ⚠️ PRIMA DI TUTTO IL RESTO, e sotto i comandi: è il velo che
             impedisce lo schermo nero a chi è appena stato fatto entrare.
             Vedi `DentroInAttesaDiContenuti` e shop/stanza-ancora-vuota. */}
        {stanzaAncoraVuota({
          entrato: st.joined,
          flussiRemoti: remoteStreams.size,
          percorso: typeof window !== "undefined" ? window.location.pathname : "",
        }) && <DentroInAttesaDiContenuti nome={st.myName} />}
        <DebugPanel />
        <MioPreventivoInPrimoPiano st={st} />
        <ViewerOverlay st={st} ls={ls} />
        <AvvisoCameraSpenta st={st} />
        <AvvisoMiaCamera st={st} />
        <GuestChat st={st} />
        {st.joined && st.active && st.camOn && <TastoGiraCamera fluttuante />}
      </GuestSafe>
    );
  return (
    <>
      <RemoteAudio st={st} />
      <DebugPanel />
      {st.pendingStart && <StartModal />}
      {st.active && <HostOverlay st={st} ls={ls} />}
      <KnockPopup st={st} />
      <AvvisiIngresso st={st} />
      <PlanciaDelGruppo st={st} />
      <AvvisoDoppiaScheda st={st} />
      {st.guestError && <GuestErrorBadge st={st} />}
      <AvvisoCameraNegata st={st} />
      <AvvisoMiaCamera st={st} />
    </>
  );
}

/** ── LA PLANCIA DEL GRUPPO, DOVE SERVE ────────────────────────────────────
 *
 *  Sta qui — nell'unico pezzo di programma che è aperto in TUTTE le pagine del
 *  consulente — e non dentro la pagina del preventivo, per la stessa ragione
 *  per cui ci sta la richiesta d'ingresso: mentre parla con tre persone il
 *  consulente passa dal Meetly al preventivo al gestionale, e i comandi del
 *  gruppo non possono vivere su una pagina sola.
 *
 *  ⚠️ SULLA PAGINA DEL PREVENTIVO NON SI RADDOPPIA: là la plancia c'è già, e
 *   quella sa anche che cosa sta guardando (è la pagina che si specchia). Qui
 *   compare dappertutto TRANNE che lì.
 *  ⚠️ E non compare mai senza un gruppo: gli agganci stessi non partono se non
 *   c'è un codice di consulenza (vedi `useAttesiDelConsulente`). */
/** ── ⚠️ DUE SCHEDE SULLA STESSA CONSULENZA: IL CLIENTE RICEVE ORDINI
 *      CONTRADDITTORI ────────────────────────────────────────────────────
 *
 *  Ascoltato sul canale di una consulenza vera, nello stesso decimo di
 *  secondo:
 *      callstate  active:false  mode:"content"   ← una scheda
 *      callstate  active:true   mode:"call"      ← l'altra
 *  Tutte e due rispondevano al saluto dell'ospite (che arriva ogni tre
 *  secondi), e il cliente applicava l'ultima arrivata: da fuori, una
 *  videochiamata che «torna da sola ai contenuti» ogni tre secondi.
 *
 *  Il codice di oggi non lo fa più — una scheda che non è in chiamata non
 *  ripete la modalità — ma una scheda APERTA PRIMA di una pubblicazione
 *  continua a far girare quello di ieri, e nessun aggiornamento la
 *  raggiunge finché non viene ricaricata. Quindi la cosa utile non è solo
 *  impedirlo: è DIRLO a chi ha le schede aperte, che è l'unico che può
 *  chiuderne una.
 *  Il faro fra le schede (shop/dove-si-ammette) sa già rispondere alla
 *  domanda «qualcun altro sta mostrando questa consulenza?»: qui serve
 *  esattamente quello. */
function AvvisoDoppiaScheda({ st }: { st: State }) {
  const [altra, setAltra] = useState(false);
  useEffect(() => {
    const guarda = () => {
      apriCanaleFaro();
      setAltra(
        unAltraSchermataLaMostra({
          grezzo: faroSentito,
          miaScheda: nomeDiQuestaScheda(),
          codice: st.sessionId || readLiveId(),
        }),
      );
    };
    guarda();
    const iv = setInterval(guarda, 3000);
    return () => clearInterval(iv);
  }, [st.sessionId]);
  //  Si dice solo a chi conduce: è la scheda davanti a cui sei, ed è l'unica
  //  in cui l'avviso non è a sua volta un doppione.
  if (st.role !== "host" || !st.active || !altra) return null;
  return (
    <div
      data-hg-noptr
      data-hg-sempre
      className="fixed bottom-2 left-1/2 z-[152] w-[min(94vw,420px)] -translate-x-1/2 rounded-xl border border-amber-400/45 bg-[#1a1405]/96 px-3 py-2 text-[11.5px] leading-snug text-amber-100 shadow-2xl backdrop-blur print:hidden"
    >
      <b className="font-semibold text-white">Questa consulenza è aperta in un'altra scheda.</b>{" "}
      Chiudila: due schede danno al cliente ordini diversi su cosa vedere, e la sua videochiamata
      può tornare da sola ai contenuti.
    </div>
  );
}

/** ── L'OSPITE CHE HA IL PROPRIO PREVENTIVO ACCESO ────────────────────────
 *  Richiesta del committente: «quando il suo preventivo è acceso, qualsiasi
 *  cosa attivo — videocamera, contenuti — all'utente deve rimanere il suo
 *  preventivo; se lo spengo mostrerà quello che sto condividendo io».
 *  Qui c'è l'unico posto che lo decide: si legge la regia (la stessa riga che
 *  governa il pannello del consulente) e si alza la precedenza. Da lì in poi
 *  `shop/mio-preventivo` risponde «resta dove sei» a chi porta in giro il
 *  cliente — la modalità (qui sotto) e la pagina (shop/live, `useLiveNav`).
 *  ⚠️ Gira nel motore della chiamata, non nella pagina del preventivo:
 *   quando il cliente è sui media la pagina del preventivo non è nemmeno
 *   montata, e nessuno saprebbe che il suo è stato acceso. */
function MioPreventivoInPrimoPiano({ st }: { st: State }) {
  const navigate = useNavigate();
  /*  ⚠️ NON LEGGE LA REGIA: la legge il motore (`vigilaSulMioPreventivo`), che
      non si smonta mai. Questo pezzo fa solo la parte che richiede una pagina
      viva — portarlo sul suo preventivo — e la fa anche appena si monta, se
      nel frattempo la precedenza si è alzata dietro un velo. */
  const [acceso, setAcceso] = useState(restaSulMioPreventivo);
  useEffect(() => ascoltaMioPreventivo(setAcceso), []);
  useEffect(() => {
    if (!acceso) {
      //  Tornato a seguire il consulente: gli si chiede subito dov'è, invece
      //  di aspettare il prossimo giro (`req: true` = «rispondimi»).
      if (st.joined) sendHello(true);
      return;
    }
    if (typeof window !== "undefined" && !/^\/preventivo/.test(window.location.pathname)) {
      console.log("[GUEST] il mio preventivo è acceso: vado sulla sua pagina");
      /*  ── ⚠️ IL `watch` NON È UN ORNAMENTO DELL'INDIRIZZO ─────────────────
          È l'unica cosa che dice alla pagina del preventivo «questo è un
          cliente che guarda» (vedi `codiceDaIndirizzo`). Senza, /preventivo
          si apre come la pagina DEL CONSULENTE: il motore della chiamata si
          riconfigura come padrone di casa e l'ospite smette di essere un
          ospite. Trovato provandolo, non leggendolo. */
      void navigate({ to: "/preventivo", search: { watch: st.sessionId || "" } as any });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceso, st.joined]);
  return null;
}

/*  ── DOV'ERO PRIMA DI APRIRE UN PREVENTIVO ────────────────────────────────
    Segnalazione del committente: spegnendo «lo vede lui», la pagina del
    preventivo resta a schermo — sua e del cliente — e sembra che
    l'interruttore non faccia niente. Giusto: accenderlo PORTA tutti sul
    preventivo, spegnerlo non riportava indietro nessuno.
    Qui si ricorda la schermata da cui si è partiti — i media, le slide, un
    link — e ci si torna. Il cliente segue da sé, perché seguire la schermata
    del consulente è come funziona da sempre.
    ⚠️ Si ricorda SOLO se si partiva da un'altra pagina: chi era già sul
     preventivo non deve essere spostato da nessuna parte. */
let paginaPrimaDelPreventivo: string | null = null;

/*  ── CHI HO GIÀ VISTO DENTRO, IN QUESTA STANZA ─────────────────────────────
    Serve a togliere dal pannello chi se n'è andato (shop/chi-e-ancora-dentro):
    la differenza fra «non è ancora arrivato» e «c'era e adesso non c'è più»
    sta tutta in questa memoria.
    ⚠️ SOPRAVVIVE A UNA RICARICA. La scheda del consulente si ricarica — e la
     consulenza si riprende da sola: senza scrivere da qualche parte, dopo la
     ricarica chi se n'era andato tornerebbe a occupare il pannello come se
     dovesse ancora arrivare.
    ⚠️ RESTA SU QUESTO DISPOSITIVO: è un'impressione di questa postazione, non
     un fatto della consulenza. Sull'archivio non si tocca niente (il perché
     sta nel cartello del modulo). */
const VISTI_KEY = "hg_visti_dentro";
function leggiVisti(code: string | null): MemoriaPresenze {
  if (typeof window === "undefined" || !code) return {};
  try {
    const v = JSON.parse(localStorage.getItem(`${VISTI_KEY}:${code}`) || "{}");
    return v && typeof v === "object" ? (v as MemoriaPresenze) : {};
  } catch {
    return {};
  }
}
function scriviVisti(code: string | null, m: MemoriaPresenze) {
  if (typeof window === "undefined" || !code) return;
  try {
    localStorage.setItem(`${VISTI_KEY}:${code}`, JSON.stringify(m));
  } catch {
    /* memoria negata */
  }
}

function PlanciaDelGruppo({ st }: { st: State }) {
  const navigate = useNavigate();
  /*  ⚠️ MAI DENTRO L'ANTEPRIMA DISPOSITIVO. Con l'anteprima accesa la pagina
      del preventivo gira dentro un iframe, e lì dentro questo programma è
      montato una seconda volta: senza questa riga la plancia comparirebbe
      disegnata dentro la cornicetta del telefono, in mezzo a quello che vede
      il cliente. (Trovato provando, non ragionando.) */
  const inAnteprima =
    typeof window !== "undefined" &&
    (window.self !== window.top ||
      new URLSearchParams(window.location.search).get("embed") === "1");
  /*  ── ⚠️ SOLO A CONSULENZA APERTA, E QUI AVEVO SBAGLIATO ───────────────
      Segnalazione del committente, con la schermata sotto gli occhi: la
      plancia era aperta sul GESTIONALE, senza nessun Meetly in corso, con
      dentro il nome di un cliente — «non capisco dove lo prende».
      Lo prendeva da `readLiveId()`, cioè dal codice dell'ULTIMA consulenza,
      che resta scritto in memoria per sempre (serve al pulsante «Rientra»).
      Da lì la plancia leggeva gli attesi di quella stanza e li mostrava per
      tutta la giornata, davanti a chi stava facendo tutt'altro.
      La domanda giusta non è «qual è l'ultima stanza» ma «ce n'è una aperta
      ADESSO»: `sessionLive` è quella risposta, e la rimette in piedi da sola
      anche dopo una ricarica (riprendiConsulenzaAperta). */
  //  Solo dentro Meetly, mai sul gestionale (vedi il cartello in KnockPopup).
  const inConsulenza = useQuiSiConduce();
  const consulenzaViva = (st.sessionLive || st.active) && inConsulenza;
  //  Siamo sulla pagina dove la consulenza si CONDUCE (Meetly)? Lì il
  //  pannello parte rannicchiato.
  const inMeetly =
    typeof window !== "undefined" && /^\/(meetly|presenta)/.test(window.location.pathname);
  const codice =
    st.role === "host" && !inAnteprima && consulenzaViva ? st.sessionId || readLiveId() : null;
  const [giroAttesiLetto, setGiroAttesiLetto] = useState(0);
  const attesiVeri = useAttesiDelConsulente(codice, giroAttesiLetto);
  /*  ── ⚠️ CHI È COLLEGATO VALE QUANTO CHI ERA IN AGENDA ─────────────────
      Segnalazione del committente, in piena consulenza: «manca tutta la regia
      del preventivo». Spariva tutto il pannello, e il motivo era che questa
      stanza non aveva nessun ATTESO — nessuna riga di appuntamento — perché
      il cliente era entrato dal link scrivendo il suo nome alla porta.
      Adesso, se non c'è nessun atteso, le persone del pannello sono quelle
      collegate: il loro preventivo è quello comune (vedi `personeDelPannello`). */
  const ospitiOra = st.roster.filter((r) => r.role === "viewer");
  /*  ── ⚠️ E CHI ENTRA DAL LINK DIVENTA UNA PERSONA DELLA STANZA ─────────
      Seconda metà della stessa segnalazione: «metto "il suo lo compila lui" e
      appena passo alla videochiamata lui vede le facce». Non era
      l'interruttore: quel cliente non aveva un GETTONE, e senza gettone non ha
      una stanza di preventivo sua — quindi la precedenza («il suo preventivo
      vince su tutto») non aveva niente da difendere e ogni mossa del
      consulente se lo portava dietro.
      Registrandolo qui, una volta, ha un gettone come chi era in agenda: il
      server gli risponde «vai sul TUO preventivo» e il suo dispositivo smette
      di seguire le modalità. Lui si riconosce da solo al giro dopo
      (`personaDaAdottare`), perché in stanza risulta attesa UNA persona. */
  const registrato = useRef("");
  useEffect(() => {
    if (!codice || attesiVeri.length > 0 || ospitiOra.length === 0) return;
    const nome = String(ospitiOra[0]?.nomeVero || ospitiOra[0]?.name || "").trim();
    const firma = `${codice}|${ospitiOra[0]?.pid || ""}`;
    if (registrato.current === firma) return; // una volta per ospite, non a ogni disegno
    registrato.current = firma;
    void fetch("/api/presenter/atteso-ospite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sess: codice, nome, dev: ospitiOra[0]?.pid || "" }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && j.aggiunto) setGiroAttesiLetto((n) => n + 1);
      })
      .catch(() => {
        registrato.current = ""; /* rete: si riprova */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codice, attesiVeri.length, ospitiOra.length]);
  /*  ── CHI C'È ADESSO, E QUANTI NON SI SANNO RICONOSCERE ───────────────
      `chiEInLinea` deduce: se in stanza è attesa UNA persona sola, l'ospite
      che non ha annunciato il suo gettone è lei. Per scrivere «in linea»
      sulla riga va benissimo; per dire «questa persona se n'è andata» no —
      basterebbe che entrasse qualcun altro senza nome perché un fantasma
      risultasse presente per sempre. Perciò si contano anche gli IGNOTI, e
      finché ce n'è uno non si toglie nessuno (vedi chi-e-ancora-dentro). */
  const salutati = ospitiSalutatiDiRecente();
  const presenti = chiEInLinea({ attesi: attesiVeri, ospiti: [...ospitiOra, ...salutati] });
  const ignoti = [...ospitiOra, ...salutati].filter((r) => !String(r.leadId || "").trim()).length;
  const [visti, setVisti] = useState<MemoriaPresenze>({});
  useEffect(() => {
    setVisti(leggiVisti(codice));
  }, [codice]);
  const firmaPresenti = presenti.join("|");
  useEffect(() => {
    if (!codice) return;
    setVisti((m) => {
      const n = segnaChiCÈ(m, firmaPresenti ? firmaPresenti.split("|") : []);
      if (n !== m) scriviVisti(codice, n);
      return n;
    });
  }, [codice, firmaPresenti]);
  /*  Una riga se ne va per SCADENZA, cioè senza che si muova nient'altro: se
      non si ridisegna ogni tanto, il fantasma resta a schermo finché non
      succede qualcos'altro. Un giro ogni quindici secondi, e solo a
      consulenza aperta. */
  const [, batti] = useState(0);
  useEffect(() => {
    if (!codice) return;
    const iv = setInterval(() => batti((n) => n + 1), 15_000);
    return () => clearInterval(iv);
  }, [codice]);
  /*  ── ⚠️ CHI SE N'È ANDATO ESCE DAL PANNELLO ───────────────────────────
      Segnalazione del committente: «se l'utente non c'è più in consulenza
      deve essere rimosso anche dalla lista». Si filtra PRIMA di comporre le
      righe: così, se se n'è andato l'unico atteso e intanto è entrato
      qualcun altro dal link, il pannello mostra chi c'è davvero invece di
      restare appeso al nome di chi ha chiuso (vedi `personeDelPannello`). */
  const attesiDentro = ancoraDentro(attesiVeri, { memoria: visti, inLinea: presenti, ignoti });
  const attesi = personeDelPannello({ attesi: attesiDentro, ospiti: ospitiOra });
  const { regia } = useRegiaGruppo(codice, attesi.length >= 1);
  if (inAnteprima || !consulenzaViva) return null;
  //  Chi è collegato adesso: lo sa questa scheda, che conduce la
  //  videochiamata (il riquadro di ciascuno porta la sua scheda CRM).
  //  ⚠️ Seconda uscita di sicurezza: se non stai più guardando il preventivo
  //   di nessuno, non stai preparando niente di nascosto. (La prima è in
  //   `AvvisoPreparazione`: fuori dalla pagina del preventivo.)
  const ospiti = ospitiOra;
  /*  ⚠️ ANCHE CHI NON SI È PRESENTATO È DENTRO. Fotografia del committente:
      «Daniele Francesco Ferlazzo · non ancora» mentre Daniele era collegato e
      guardava la videochiamata. Il riconoscimento passa dal gettone che
      annuncia il cliente, e una scheda aperta da prima di un aggiornamento non
      lo manda: la sua riga restava senza nome, il pannello diceva «non è
      dentro» — e non offriva nemmeno il pulsante per aggiornargli lo schermo,
      che è esattamente quello che gli serviva. Vedi `chiEInLinea`. */
  const inLinea = chiEInLinea({ attesi: attesiDentro, ospiti: [...ospiti, ...salutati] });
  //  Chi DICHIARA di stare sul proprio preventivo: è l'unica prova che quel
  //  dispositivo conosce la precedenza (vedi `statoDelloSchermo`). Qui NON si
  //  deduce niente: una conferma dedotta non è una conferma.
  const conferma = ospiti.filter((r) => r.leadId && r.suo).map((r) => String(r.leadId));
  return (
    <PlanciaGruppo
      code={codice}
      regia={regia}
      attesi={attesi}
      inLinea={inLinea}
      conferma={conferma}
      /*  ⚠️ Si ricarica la scheda di QUELLA persona, non di tutti: `reload`
          con un destinatario lo capiscono anche le versioni vecchie — è
          proprio a loro che serve. */
      aggiornaSchermo={(leadId) => {
        //  ⚠️ E si ricarica anche la scheda di chi NON si è presentato, quando
        //   è l'unico che può essere: è proprio quella da aggiornare.
        const chi =
          ospiti.find((r) => r.leadId === leadId) ??
          (attesi.length === 1 ? ospiti.find((r) => !r.leadId) : undefined);
        if (!chi) return;
        console.log("[HOST] aggiorno lo schermo di", chi.nomeVero || chi.name);
        reloadGuest(chi.pid);
      }}
      //  In Meetly parte chiusa: lì lo schermo è delle facce (vedi PlanciaGruppo).
      compatta={inMeetly}
      /*  Aprire il preventivo di qualcuno lo apre a tutti: la videochiamata
          passa ai contenuti — se no il cliente continua a vedere le facce — e
          il consulente va sulla pagina del preventivo, che è quella che il
          cliente segue (api.presenter.curpage). */
      /*  ── APRIRE SUL MIO SCHERMO, CON O SENZA PORTARCI LUI ──────────────
          `inPrivato` è vero quando il suo preventivo è SPENTO per lui: in quel
          caso tu ci vai e i clienti restano fermi dove sono (shop/live:
          `preparoInPrivato`). È il «glielo preparo e poi glielo mostro» che
          prima non si poteva fare, perché il cliente segue sempre la pagina
          dove sei tu. */
      /*  ── PORTARE TUTTI SUL PREVENTIVO ─────────────────────────────────
          Accendere «Il suo» per una persona vuol dire due cose insieme: il
          suo preventivo compare sul SUO schermo (lo decide il server, vedi
          `paginaDiQuestoCliente`) e io vado sulla pagina del preventivo, che
          è dove lo vedo comporsi.
          ⚠️ La pagina si scrive A MANO qui e non con `setPresenterPage`
           (shop/live) perché live.ts importa già questo file: chiamarla da
           qui chiuderebbe un anello fra i due moduli. «/preventivo» è un
           percorso nudo, quindi passa intatto per le stesse regole.
          ⚠️ E si scrive SUBITO, senza aspettare il giro della barra: la
           segnalazione da cui nasce questa riga era «al cliente mostra quello
           che condivido su media anche se attivo la sua scheda». */
      apriIlPreventivo={() => {
        if (typeof window !== "undefined" && !/^\/preventivo/.test(window.location.pathname)) {
          paginaPrimaDelPreventivo = window.location.pathname + window.location.search;
        }
        if (st.active && st.mode === "call") hostSetMode("content");
        void fetch("/api/presenter/curpage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: "/preventivo", sess: codice || "" }),
        }).catch(() => {
          /* la barra la riscrive comunque fra un secondo e mezzo */
        });
        if (typeof window !== "undefined" && !/^\/preventivo/.test(window.location.pathname)) {
          void navigate({ to: "/preventivo" });
        }
      }}
      /*  Spegnendo «Il suo»: si torna alla schermata da cui si era partiti. Se
          non si era partiti da nessuna parte (eri già sul preventivo) non si
          sposta niente. */
      tornaIndietro={() => {
        const dove = paginaPrimaDelPreventivo;
        paginaPrimaDelPreventivo = null;
        if (!dove || typeof window === "undefined") return;
        if (window.location.pathname + window.location.search === dove) return;
        console.log("[HOST] preventivo spento: torno a", dove);
        void navigate({ to: dove });
      }}
    />
  );
}

/** ── OSPITE: «LA TUA CAMERA L'HA SPENTA IL CONSULENTE» ─────────────────────
 *
 *  L'ospite non ha comandi propri in questa applicazione: camera e microfono
 *  glieli governa il presentatore. Quando gli spegne la camera, dal suo posto
 *  si vede solo la propria immagine sparire — e la conclusione naturale è «mi
 *  si è rotta la camera» oppure «è caduta la linea», due cose che portano il
 *  cliente a smanettare o a uscire nel mezzo di una consulenza.
 *
 *  Qui c'è scritto cos'è successo, e c'è il modo di rimediare: la camera è la
 *  sua, e se vuole farsi vedere deve poterlo fare. Il presentatore la può
 *  rispegnere quando vuole — è un pannello di comando, non una serratura.
 *
 *  ⚠️ Sta FUORI da `ViewerOverlay`: quella, quando si presentano contenuti,
 *   esce prima restituendo la sola camerina (o niente affatto), e l'avviso non
 *   comparirebbe proprio nel caso più comune — consulenza con il preventivo a
 *   schermo. Montato qui vale in tutte le schermate.
 *  ⚠️ E si mostra solo se la camera è DAVVERO spenta: quando torna accesa la
 *   riga sparisce da sé, anche se l'ha riaccesa il presentatore. */
function AvvisoCameraSpenta({ st }: { st: State }) {
  const quale = avvisoCameraOspite({
    camOn: st.camOn,
    micOn: st.micOn,
    joined: st.joined,
    spentaDalConsulente: st.camSpentaDalConsulente,
    chiestaDalConsulente: st.camChiestaDalConsulente,
    micChiestoDalConsulente: st.micChiestoDalConsulente,
  });
  if (quale === "niente") return null;
  //  Che cosa sta chiedendo il consulente, in questo preciso avviso.
  const vuoleCamera = quale === "chiesta-dal-consulente" || quale === "chiesti-camera-e-microfono";
  const vuoleMicrofono = quale === "chiesto-microfono" || quale === "chiesti-camera-e-microfono";
  const chiesta = vuoleCamera || vuoleMicrofono;
  const cosa =
    vuoleCamera && vuoleMicrofono
      ? "camera e microfono"
      : vuoleCamera
        ? "la camera"
        : "il microfono";
  /*  ⚠️ IL TOCCO È IL PUNTO. Quando il consulente chiede di accendere e il
      browser dell'ospite non gliel'ha lasciata aprire, l'unica cosa che manca è
      un gesto suo: `getUserMedia` chiamata da un clic riesce dove la stessa
      chiamata partita da un messaggio di canale viene rifiutata. Questo
      pulsante è quel gesto — non è un ripiego, è il rimedio. */
  const accendi = () => {
    set({
      camSpentaDalConsulente: false,
      camChiestaDalConsulente: false,
      micChiestoDalConsulente: false,
    });
    void (async () => {
      //  ⚠️ SI APRE SOLO QUELLO CHE È STATO CHIESTO: toccare il microfono di
      //   chi ce l'ha già aperto, per rifarglielo aprire, è un modo di
      //   togliere la voce proprio mentre la persona sta parlando.
      const cam = vuoleCamera ? await camAcquire() : true;
      const mic = vuoleMicrofono ? await micAcquire() : true;
      if (vuoleMicrofono && mic) setMicOn(true);
      //  Se nemmeno col tocco si apre, il problema è il permesso o un'altra
      //  applicazione che tiene il dispositivo: la richiesta resta in piedi, e
      //  il presentatore lo sa (non insiste con un comando che non può riuscire).
      if (!cam) set({ camChiestaDalConsulente: true });
      if (!mic) set({ micChiestoDalConsulente: true });
      send("camesito", { from: S.myPid, ok: cam && mic });
    })();
  };
  return (
    <div
      className={`fixed bottom-4 left-1/2 z-[126] w-[min(92vw,380px)] -translate-x-1/2 rounded-xl border p-3 text-white shadow-2xl backdrop-blur print:hidden ${chiesta ? "border-brand/50 bg-[#0b1a38]/95" : "border-white/15 bg-[#0e1116]/95"}`}
    >
      <div className="flex items-start gap-2">
        {chiesta ? (
          <Video className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        ) : (
          <VideoOff className="mt-0.5 h-4 w-4 shrink-0 text-white/60" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold">
            {chiesta ? `Il consulente ti chiede di attivare ${cosa}` : "La tua camera è spenta"}
          </div>
          <div className="mt-0.5 text-[11px] leading-snug text-white/60">
            {chiesta
              ? `Il tuo telefono chiede il permesso a te, non a lui: tocca qui sotto e ${vuoleCamera && vuoleMicrofono ? "si attivano" : "si attiva"}.`
              : "L'ha spenta il consulente. Continui a sentirlo e a vedere quello che ti mostra: se preferisci farti vedere, puoi riaccenderla."}
          </div>
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={accendi}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-[12px] font-semibold hover:brightness-110 ${chiesta ? "bg-brand text-white" : "bg-white/90 text-[#0e1116]"}`}
        >
          {vuoleMicrofono && !vuoleCamera ? (
            <Mic className="h-3.5 w-3.5" />
          ) : (
            <Video className="h-3.5 w-3.5" />
          )}
          {chiesta ? `Attiva ${cosa}` : "Riaccendi la camera"}
        </button>
        <button
          onClick={() =>
            set({
              camSpentaDalConsulente: false,
              camChiestaDalConsulente: false,
              micChiestoDalConsulente: false,
            })
          }
          title="Nascondi questo avviso"
          className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[12px] font-medium text-white/60 hover:bg-white/10 hover:text-white"
        >
          {chiesta ? "Non ora" : "Va bene"}
        </button>
      </div>
    </div>
  );
}

/** ── PRESENTATORE: «LA SUA CAMERA NON SI È APERTA» ─────────────────────────
 *  L'altra metà della stessa correzione. Premere «accendi» e non vedere
 *  accadere niente era indistinguibile da un comando rotto — ed è così che è
 *  stato segnalato. Qui c'è scritto che il comando è arrivato, che il browser
 *  dell'ospite non ha aperto la camera, e che la richiesta è ora sul SUO
 *  schermo: non serve ripremere. */
function AvvisoCameraNegata({ st }: { st: State }) {
  const n = st.camNegata;
  if (!n) return null;
  const chi = st.roster.find((r) => r.pid === n.pid);
  //  Se quell'ospite non c'è più (uscito, rimosso) l'avviso non ha più oggetto.
  if (!chi) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[125] w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-amber-400/40 bg-[#1a1406]/95 p-3 text-white shadow-2xl backdrop-blur print:hidden">
      <div className="flex items-start gap-2">
        <VideoOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold">La camera di {chi.name} non si è aperta</div>
          <div className="mt-0.5 text-[11px] leading-snug text-white/60">
            Il comando è arrivato: è il suo browser che non l'ha aperta — permesso da dare, camera
            occupata da un'altra applicazione, o serve un tocco suo. Gli è comparso il pulsante sul
            suo schermo. Puoi rimandargli la richiesta da qui o dal pulsante sul suo riquadro.
          </div>
          {/*  ── ⚠️ E LA RICHIESTA SI PUÒ RIMANDARE ───────────────────────
               Richiesta del committente: «fai che posso inviare a mano
               nuovamente richiesta di accedere camera e microfono».
               Qui c'era scritto «non serve ripremere», ed era vero solo in
               teoria: se il cliente ha chiuso l'avviso per sbaglio, o ha dato
               il permesso DOPO, dall'altra parte non succede più niente e
               l'unico modo di rimetterglielo davanti era farglielo dire a
               voce. Un pulsante costa un messaggio sul canale e toglie una
               telefonata. */}
          <button
            type="button"
            onClick={() => {
              chiediMediaOspite(n.pid);
              //  L'avviso si chiude: se fallisce di nuovo torna da sé con
              //  l'esito nuovo, e lasciarlo lì direbbe una cosa vecchia.
              set({ camNegata: null });
            }}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-400/15 px-2.5 py-1.5 text-[11.5px] font-semibold text-amber-50 transition hover:bg-amber-400/25"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Richiedi di nuovo camera e microfono
          </button>
        </div>
        <button
          onClick={() => set({ camNegata: null })}
          title="Nascondi"
          className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
/** ── «LA MIA CAMERA NON SI È APERTA», SCRITTO ─────────────────────────────
 *
 *  Segnalazione del committente: «la camera del presentatore sul dispositivo
 *  dell'ospite non funziona più».
 *
 *  Quando `getUserMedia` fallisce non succede NIENTE che si veda: ci si trova
 *  addosso il rettangolo «hai la camera spenta» — lo stesso che si vede quando
 *  la si è spenta apposta — e dall'altra parte il cliente vede un consulente
 *  senza faccia. Con due cause diverse che portano alla stessa immagine, non
 *  c'è modo di capire se rimediare e come.
 *
 *  Qui c'è scritto che cosa è successo e c'è il pulsante per riprovare.
 *  ⚠️ IL PULSANTE NON È UN DOPPIONE DELL'INTERRUTTORE: `getUserMedia` chiamata
 *   da un CLIC riesce dove la stessa chiamata partita da sola viene rifiutata
 *   (permesso appena concesso, iPhone che vuole un gesto). È lo stesso motivo
 *   per cui esiste il pulsante dell'ospite in `AvvisoCameraSpenta`.
 *  ⚠️ Sta più in alto dell'avviso dell'ospite (bottom-20): i due possono
 *   comparire insieme, e uno sopra l'altro se ne leggerebbe solo uno. */
function AvvisoMiaCamera({ st }: { st: State }) {
  const testo = st.mediaAvviso;
  const [inCorso, setInCorso] = useState(false);
  if (!testo) return null;
  const riprova = () => {
    setInCorso(true);
    void (async () => {
      const ok = await camAcquire();
      setInCorso(false);
      if (ok) set({ mediaAvviso: null });
    })();
  };
  return (
    <div className="fixed bottom-20 left-1/2 z-[127] w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-amber-400/40 bg-[#1a1406]/95 p-3 text-white shadow-2xl backdrop-blur print:hidden">
      <div className="flex items-start gap-2">
        <VideoOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold">La tua camera non si è aperta</div>
          <div className="mt-0.5 text-[11px] leading-snug text-white/65">{testo}</div>
        </div>
        <button
          onClick={() => set({ mediaAvviso: null })}
          title="Nascondi"
          className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <button
        onClick={riprova}
        disabled={inCorso}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500/90 py-1.5 text-[12px] font-semibold text-[#1a1406] transition hover:brightness-110 disabled:opacity-60"
      >
        <Video className="h-3.5 w-3.5" /> {inCorso ? "Ci provo…" : "Riprova ad accendere la camera"}
      </button>
    </div>
  );
}

// ── PRESENTATORE — avviso DISCRETO: il dispositivo del cliente ha avuto un
//    problema di interfaccia (il cliente vede solo la schermata di attesa).
function GuestErrorBadge({ st }: { st: State }) {
  const e = st.guestError;
  if (!e) return null;
  return (
    <div className="fixed bottom-4 left-1/2 z-[125] w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-amber-400/40 bg-[#1a1406]/95 p-3 text-white shadow-2xl backdrop-blur print:hidden">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold">Problema sul dispositivo del cliente</div>
          <div className="mt-0.5 truncate text-[10px] text-white/50" title={e.msg}>
            {e.msg}
          </div>
          <div className="mt-0.5 text-[10px] text-white/40">
            Il cliente vede la schermata di attesa: si sta già riprendendo da solo.
          </div>
        </div>
        <button
          onClick={() => dismissGuestError()}
          title="Nascondi"
          className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <button
        onClick={() => reloadGuest(e.from || undefined)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500/90 py-1.5 text-[12px] font-semibold text-[#1a1406] hover:brightness-110"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Ricarica il dispositivo del cliente
      </button>
    </div>
  );
}

// ── Guest: rimosso / bloccato dal presentatore ────────────────────────────
function KickedScreen({ blocked }: { blocked: boolean }) {
  return (
    <div className="fixed inset-0 z-[130] flex flex-col items-center justify-center gap-6 overflow-hidden bg-brandfill px-6 text-center text-white">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-red-500/10 blur-3xl" />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <BrandLogo className="h-9 w-auto" />
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-red-400/30 bg-red-500/10 text-red-300">
          {blocked ? <Ban className="h-7 w-7" /> : <UserX className="h-7 w-7" />}
        </span>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {blocked ? "Accesso non consentito" : "Sei stato rimosso dalla consulenza"}
          </h1>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-white/55">
            {blocked
              ? "Il consulente ha bloccato l'accesso a questa videoconsulenza da questo dispositivo. Se pensi si tratti di un errore, contatta il tuo consulente."
              : "La sessione è terminata per te: il consulente ti ha rimosso dalla conferenza. Puoi chiudere questa pagina."}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── IL NOME DEL SOFTWARE ──────────────────────────────────────────────────
//  Sotto il logo dello studio, in piccolo. Al cliente che aspetta serve sapere
//  DOVE si trova — è la stessa rassicurazione che dà il nome scritto sulla
//  porta di una sala d'attesa — non un marchio urlato: il titolo resta la frase
//  che gli parla, questo è solo un'etichetta.
function MarchioMeetly() {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-[0.42em] text-white/35">
      Meetly
    </span>
  );
}

// ── Guest: schermata d'attesa prima dell'avvio (stile videoconsulenza) ────
export function WaitingScreen() {
  //  ── QUANDO L'INVITO NON È PIÙ QUELLO GIUSTO ─────────────────────────────
  //   Sul server risulta una consulenza viva, ma con un altro codice: questo
  //   invito appartiene a una sessione precedente. Restare su "sta per
  //   iniziare" era la cosa peggiore da fare — il cliente aspetta una cosa che
  //   non arriverà mai, e non ha modo di saperlo. Glielo diciamo, e gli diciamo
  //   anche cosa fare.
  const st = useCall();
  const { superseded, pronto } = st;
  /*  ── ⚠️ ASPETTARE NON È NON FARE NIENTE ────────────────────────────────
      Segnalazione del committente: «l'ingresso è troppo lento, lo vorrei
      istantaneo». Qui c'era solo una frase e un pallino che pulsa: il cliente
      poteva soltanto guardare. Nome e permessi — le due cose lente, perché
      sono umane — cominciavano DOPO l'avvio, col consulente già davanti allo
      schermo ad aspettarlo.
      Adesso si fanno adesso, mentre non c'è niente da aspettare. All'avvio il
      cliente bussa da solo, con la camera già accesa. */
  const [nome, setNome] = useState(() => nomePreparato(st.sessionId));
  const [inCorso, setInCorso] = useState(false);
  /*  ── E QUI IL NOME NON SI CHIEDE NEMMENO ───────────────────────────────
      Richiesta del committente: «nome e cognome si mettono in automatico se
      l'utente è registrato in quel link».
      Questa è la schermata su cui il cliente arriva PRIMA che il consulente
      avvii — cioè quasi sempre la prima cosa che vede. Se la stanza sa chi
      aspetta, il campo del nome non ha ragione di esistere: una persona sola
      è già riconosciuta, in più si sceglie con un tocco.
      ⚠️ Il pulsante resta, e non è una dimenticanza: camera, microfono e
       audio su iPhone si aprono SOLO dopo un gesto della persona. Quel tocco
       è il gesto — ed è anche il motivo per cui qui non si entra da soli. */
  const attesi = useAttesi(st.sessionId);
  const [scriviIoIlNome, setScriviIoIlNome] = useState(false);
  const [persona, setPersona] = useState("");
  useEffect(() => {
    if (attesi && attesi.length === 1 && !nome.trim()) {
      setNome(attesi[0].nome);
      setPersona(attesi[0].gettone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attesi]);
  const preparati = async (chi?: { nome: string; gettone: string }) => {
    const n = (chi?.nome ?? nome).trim();
    if (!n || inCorso) return;
    if (chi) {
      setNome(chi.nome);
      setPersona(chi.gettone);
    }
    setInCorso(true);
    try {
      await viewerPrepara(n, chi?.gettone || persona);
    } finally {
      setInCorso(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-6 overflow-hidden bg-brandfill px-6 text-center text-white">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-8 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <BrandLogo className="h-9 w-auto" />
          <MarchioMeetly />
        </div>
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand/40" />
          <span className="absolute inset-2 rounded-full bg-brand/20" />
          <span className="h-3.5 w-3.5 rounded-full bg-brand" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {superseded
              ? "Questo invito non è più attivo"
              : "La tua videoconsulenza sta per iniziare"}
          </h1>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-white/55">
            {superseded
              ? "La consulenza è ripartita con un invito nuovo. Scrivi al tuo consulente e chiedi il link aggiornato: da questo non riusciamo a farti entrare."
              : pronto
                ? "Sei pronto: appena il consulente avvia, entri da solo. Puoi restare su questa pagina."
                : "Intanto preparati qui sotto: quando il consulente avvia, entri subito senza fare altro."}
          </p>
        </div>

        {/* ── PREPARATI MENTRE ASPETTI ─────────────────────────────────────
            Le due cose lente dell'ingresso — scrivere il nome e dare il
            permesso a camera e microfono — si fanno qui, quando non c'è
            nessuno che aspetta dall'altra parte. */}
        {!superseded &&
          (pronto ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-[13px] font-medium text-emerald-200">
              <ShieldCheck className="h-4 w-4 flex-shrink-0" />
              Tutto pronto, {st.myName || "ci siamo"}
            </div>
          ) : (
            <div className="w-full max-w-xs space-y-2 text-left">
              {/* ── CHI SEI? LA STESSA DOMANDA DELLA PORTA ──────────────────
                  Questa schermata e GuestJoinGate sono i due punti in cui il
                  cliente dice chi è, e devono comportarsi allo stesso modo:
                  una persona sola è già riconosciuta, due o più scelgono con
                  un tocco, nessuna scrive il nome come si è sempre fatto. */}
              {attesi && attesi.length >= 2 && !scriviIoIlNome ? (
                <>
                  <span className="mb-1 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/70">
                    <User className="h-3.5 w-3.5 text-brand" /> Chi sei?
                  </span>
                  {attesi.map((a) => (
                    <button
                      key={a.gettone}
                      type="button"
                      disabled={inCorso}
                      onClick={() => void preparati(a)}
                      className="flex w-full items-center gap-3 rounded-2xl border-2 border-brand/40 bg-white/[0.06] px-4 py-3 text-left text-[15px] font-semibold text-white transition hover:border-brand hover:bg-brand/15 disabled:opacity-40"
                    >
                      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand/20 text-[14px] font-bold text-brand">
                        {a.nome.trim().charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{a.nome}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setScriviIoIlNome(true)}
                    className="text-[12.5px] text-white/45 underline decoration-white/20 underline-offset-2 hover:text-white/75"
                  >
                    Non sono nessuno di questi
                  </button>
                </>
              ) : (
                <>
                  {attesi && attesi.length === 1 && !scriviIoIlNome ? (
                    /*  ── UNA SOLA PERSONA ATTESA: IL NOME NON SI CHIEDE ──
                        Lo sa già la stanza. Resta il tocco, e quel tocco non
                        è un residuo: camera, microfono e audio su iPhone si
                        aprono SOLO dopo un gesto della persona. */
                    <div className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2.5 text-[13px] font-medium text-white">
                      <User className="h-4 w-4 flex-shrink-0 text-brand" />
                      <span className="min-w-0 flex-1 truncate">Sei {attesi[0].nome}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setScriviIoIlNome(true);
                          setNome("");
                          setPersona("");
                        }}
                        className="flex-shrink-0 text-[11.5px] text-white/50 underline decoration-white/25 underline-offset-2 hover:text-white"
                      >
                        non sono io
                      </button>
                    </div>
                  ) : (
                    <label className="block">
                      <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/70">
                        <User className="h-3.5 w-3.5 text-brand" /> Scrivi qui il tuo nome
                      </span>
                      <input
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && void preparati()}
                        placeholder="Il tuo nome"
                        //  ≥16px: sotto, iOS ingrandisce la pagina da solo quando il
                        //  campo prende il fuoco.
                        style={{ fontSize: 16 }}
                        className="w-full rounded-xl border border-white/20 bg-white/[0.06] px-3 py-2.5 text-white placeholder:text-white/30 focus:border-brand focus:outline-none"
                      />
                    </label>
                  )}
                  <button
                    type="button"
                    onClick={() => void preparati()}
                    disabled={!nome.trim() || inCorso}
                    className="w-full rounded-xl bg-brand px-4 py-2.5 text-[14px] font-semibold text-white transition disabled:opacity-40"
                  >
                    {inCorso ? "Un istante…" : "Preparati a entrare"}
                  </button>
                </>
              )}
              <p className="text-[11px] leading-snug text-white/40">
                Il browser ti chiederà camera e microfono: sono quelli della videoconsulenza.
              </p>
            </div>
          ))}
        <span className="mt-1 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-white/50">
          <span
            className={`h-2 w-2 rounded-full ${superseded ? "bg-rose-400" : "animate-pulse bg-amber-400"}`}
          />{" "}
          {superseded ? "Invito da aggiornare" : "In attesa di avvio"}
        </span>
        <p className="text-[11px] text-white/35">
          {superseded
            ? "Nessun dato è andato perso: il tuo preventivo resta dov'è."
            : "In attesa che il consulente avvii la sessione"}
        </p>
      </div>
    </div>
  );
}

// ── Guest: caricamento subito dopo l'ingresso (nome + camera/mic) ─────────
//  Evita che i contenuti del presentatore "lampeggino" mentre la connessione
//  si sta ancora stabilendo: pagina brandizzata statica + indicatore animato.
/** ── SEI DENTRO, MA NON C'È ANCORA NIENTE DA VEDERE ───────────────────────
 *
 *  Segnalazione del committente: «quando le persone entrano io accetto e loro
 *  non riescono a entrare».
 *
 *  Provato dal browser l'8/10/2026 su una stanza finta: l'ingresso funziona —
 *  il via libera si scrive sulla riga della persona col suo dispositivo, la
 *  pagina lo legge, il registro dice «ingresso AUTORIZZATO dal presentatore» —
 *  e subito dopo il corpo della pagina era questo e basta:
 *      <div id="hg-outlet"><div class="bg-blueprint min-h-screen"></div></div>
 *  Niente parole, niente logo, niente video. La persona È DENTRO e vede il
 *  nero. Dalla sua parte si dice in un modo solo: «non riesco a entrare».
 *
 *  La stanza non disegna i contenuti: li disegna la pagina che il cliente
 *  SEGUE (`useLiveNav`). Finché il consulente non ha messo niente a schermo —
 *  e quando accetta qualcuno, quasi sempre, non l'ha ancora fatto — non c'è
 *  nessuna pagina da seguire e del consulente non arriva ancora nessun video.
 *
 *  ⚠️ QUESTA SCHERMATA NON ASPETTA NIENTE E NON CHIUDE NIENTE: se ne va da
 *   sola nell'istante in cui arriva un video o una pagina (vedi
 *   shop/stanza-ancora-vuota). Nessuno stato, nessun pulsante, niente che possa
 *   restare incastrato — che è il motivo per cui non può diventare lei il nuovo
 *   modo di non entrare.
 *  ⚠️ E STA SOTTO I COMANDI, non sopra: chi è entrato deve poter usare
 *   microfono, camera e chat mentre aspetta. Per questo `z-[60]`, sotto
 *   l'overlay dell'ospite, e non `z-[121]` come il velo di caricamento. */
function DentroInAttesaDiContenuti({ nome }: { nome?: string }) {
  const chi = String(nome || "")
    .trim()
    .split(/\s+/)[0];
  /*  ── ⚠️ E SE RESTA QUI, LO SCRIVE ───────────────────────────────────────
      Questa schermata nasce da una diagnosi che NON ho potuto provare sui
      clienti veri: lo schermo vuoto l'ho visto in una stanza di prova, e in
      archivio non c'è modo di sapere se è successo anche a loro — la riga
      della pagina corrente conserva solo l'ULTIMA modifica, quindi «messa
      dopo» e «messa subito e poi cambiata» si leggono uguali.
      Allora lo chiede al cliente stesso: se dopo mezzo minuto è ancora qui —
      entrato, senza video e senza una pagina — lascia una riga nel diario.
      Alla prossima consulenza si LEGGE, invece di dedurre.
      ⚠️ UNA RIGA SOLA, e solo se resta davvero: chi ci passa due secondi
       mentre il consulente sta condividendo non scrive niente, e un diario che
       si riempie a ogni ingresso normale non lo guarda più nessuno. */
  useEffect(() => {
    const t = window.setTimeout(() => {
      void fetch("/api/presenter/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          msg: "INGRESSO · entrato da 30s e non c'è ancora niente da vedere (nessun video, nessuna pagina)",
          name: String(nome || "Cliente"),
          page: typeof location !== "undefined" ? location.pathname : "",
          ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
        }),
      }).catch(() => {
        /* il diario è un di più: non deve disturbare una consulenza */
      });
    }, 30_000);
    return () => window.clearTimeout(t);
  }, [nome]);
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 overflow-hidden bg-brandfill px-6 text-center text-white"
      //  Non intercetta i tocchi: i comandi della chiamata stanno sopra e
      //  devono restare premibili.
      style={{ pointerEvents: "none" }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
      <div className="relative z-10 flex flex-col items-center gap-5">
        <BrandLogo className="h-9 w-auto" />
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-400/40">
          <Check className="h-6 w-6 text-emerald-400" />
        </span>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {chi ? `Sei dentro, ${chi}` : "Sei dentro"}
          </h1>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-white/60">
            Il consulente ti ha fatto entrare. Resta su questa pagina: appena condivide lo schermo o
            accende la camera, lo vedi comparire qui — non devi fare altro.
          </p>
        </div>
        <span className="mt-1 inline-flex items-center gap-1.5" aria-hidden>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand" />
        </span>
      </div>
    </div>
  );
}

export function ConnectingScreen() {
  return (
    <div className="fixed inset-0 z-[121] flex flex-col items-center justify-center gap-6 overflow-hidden bg-brandfill px-6 text-center text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.10]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 right-8 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <BrandLogo className="h-9 w-auto" />
        <span className="h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-brand" />
        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Caricamento in corso…
          </h1>
          <p className="mx-auto max-w-sm text-sm leading-relaxed text-white/55">
            Ti stiamo collegando alla consulenza. Ancora qualche istante: la schermata si aprirà da
            sola.
          </p>
        </div>
        <span className="mt-1 inline-flex items-center gap-1.5" aria-hidden>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand" />
        </span>
      </div>
    </div>
  );
}

// ── RETE DI SICUREZZA DELL'OSPITE ────────────────────────────────────────
//  Qualunque errore di render sotto questo confine NON deve mai diventare una
//  schermata tecnica ("Qualcosa è andato storto / Riprova"): il cliente vede la
//  solita attesa brandizzata, il sotto-albero viene ri-montato da zero dopo ~1s
//  (con una `key` nuova) e si ri-chiede al presentatore lo stato corrente.
//  In parallelo il presentatore riceve `guesterror` e vede il badge "Ricarica".
class GuestErrorBoundary extends Component<
  { children: ReactNode; tag?: string },
  { failed: Error | null; nonce: number }
> {
  timer: ReturnType<typeof setTimeout> | null = null;
  constructor(p: { children: ReactNode; tag?: string }) {
    super(p);
    this.state = { failed: null, nonce: 0 };
  }
  static getDerivedStateFromError(err: Error) {
    return { failed: err || new Error("render") };
  }
  componentDidCatch(err: Error, info: { componentStack?: string | null }) {
    const where = this.props.tag ? ` [${this.props.tag}]` : "";
    // SEMPRE tracciato sul dispositivo, con lo stack dei componenti: è l'unico
    // modo per capire da un telefono quale pezzo è esploso.
    console.error(
      `[GUEST][ERR]${where}`,
      err,
      "\n[GUEST][ERR] componentStack:",
      info?.componentStack || "(non disponibile)",
    );
    if (!isGuest()) return; // presentatore: l'errore risale come sempre
    reportGuestError(
      `${err?.name || "Error"}: ${err?.message || String(err)}${where}`,
      info?.componentStack || "",
    );
    if (this.timer) clearTimeout(this.timer);
    // AUTO-RIPRISTINO: dopo ~1s ri-monto l'albero con una key nuova (stato dei
    // componenti azzerato) e ri-chiedo al presentatore lo stato corrente.
    this.timer = setTimeout(() => {
      try {
        requestPresenterState();
      } catch {
        /* */
      }
      this.setState((s) => ({ failed: null, nonce: s.nonce + 1 }));
    }, 1000);
  }
  componentWillUnmount() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
  render() {
    if (this.state.failed) {
      // fuori dal link ospite il confine è TRASPARENTE: l'errore torna a
      // propagarsi (il presentatore deve vedere i propri errori veri).
      if (!isGuest()) throw this.state.failed;
      return <WaitingScreen />;
    }
    return <Fragment key={this.state.nonce}>{this.props.children}</Fragment>;
  }
}
/** true se questo browser sta guardando come OSPITE (link ?watch= o ruolo viewer). */
function isGuest(): boolean {
  try {
    return S.role === "viewer" || isGuestLink();
  } catch {
    return false;
  }
}
/** Confine da usare attorno a QUALSIASI contenuto mostrato all'ospite.
 *  Struttura identica su server e client (nessun nodo DOM aggiunto): sul
 *  presentatore si limita a rilanciare l'errore. */
export function GuestSafe({ children, tag }: { children: ReactNode; tag?: string }) {
  return <GuestErrorBoundary tag={tag}>{children}</GuestErrorBoundary>;
}

/** true finché l'ospite non è pronto a vedere ciò che il presentatore mostra.
 *  Non blocca MAI in modo permanente: timeout di sicurezza a 7s. */
const GUEST_LOADING_MS = 7000;
/** Quanto si aspetta la risposta del consulente prima di mostrare comunque la
 *  stanza. Un attimo: vedi il cartello in `guestVeilActive`. */
const ATTESA_CONSULENTE_MS = 1500;
/** ISTERESI: appena l'ospite ha visto i contenuti UNA volta, la schermata di
 *  caricamento non torna più per il resto della sessione. Senza questo, ogni
 *  oscillazione di `remoteStreams`/`st.active` rimetteva il velo → schermate che
 *  si alternano. Si azzera solo con un teardown vero (fine sessione). */
let guestLoadedOnce = false;
/** true se questa PAGINA è una pagina di CONTENUTI: l'ospite non deve vederla
 *  finché il presentatore non le ha mandato lo stato (indice slide / cfg / url)
 *  e la pagina non l'ha APPLICATO (guestContentSeen). Altrimenti il mazzo
 *  comparirebbe alla slide sbagliata o senza configurazione. */
function isGuestContentPage(): boolean {
  if (typeof window === "undefined") return false;
  // ⚠️ `presenta` (la sezione MEDIA) mancava da questo elenco: era rimasta
  //  indietro quando la sezione è stata creata. Conseguenza esatta osservata —
  //  l'ospite portato su Media non veniva riconosciuto come "su una pagina di
  //  contenuti", quindi restava sotto il velo "Caricamento in corso…" in attesa
  //  di un segnale che su quella pagina non arriva. La pagina Media non veniva
  //  mai montata, non si iscriveva al canale e NESSUN media poteva raggiungerlo:
  //  qualunque cosa condividessi, lui non vedeva niente.
  //  `meetly` (e il vecchio `videochiamata`) NON vanno incluse: sono la sala
  //  d'attesa, lì il velo è corretto.
  return /^\/(slide|web|preventivo|presenta)/.test(window.location.pathname);
}
/** Istante in cui l'ospite ha inserito il nome (0 = non ancora).
 *  È una variabile di MODULO, non uno state: se dipendesse da un useEffect, al
 *  PRIMO render dopo l'ingresso varrebbe ancora null → il velo risultava "già
 *  sceso" e l'isteresi lo spegneva per sempre (bug: il preventivo compariva
 *  subito, senza schermata di caricamento). */
let guestJoinAt = 0;
/** log una sola volta quando la consulenza viene sostituita da una nuova */
let sessionSupersededLogged = false;
/** Il rinvio verso la stanza nuova si segue UNA volta sola: la pagina si sta
 *  già ricaricando, e un secondo giro di risposta non deve farlo due volte. */
let rinviatoUnaVolta = false;

/** VELO DI CARICAMENTO OSPITE — unica sorgente di verità, sincrona e senza
 *  dipendenze dall'ordine di render. Usata sia dalla schermata (CallLayer) sia
 *  dal gate CSS globale (guestGateBlocked → classe .hg-guest-gated), così la
 *  pagina sotto non dipinge MAI mentre il velo è su, su OGNI rotta.
 *  Il velo cade solo quando: lo stato del presentatore per la pagina corrente è
 *  ARRIVATO ed è stato APPLICATO **e** (se la chiamata è attiva) il media è
 *  stabilito. Timeout di sicurezza + isteresi "mai più indietro" invariati. */
/*  ── ⚠️ IL VELO DEVE DIRE CHE COSA ASPETTA ────────────────────────────────
    Segnalazione del committente: «ci mette troppo tempo a sbloccarsi la
    pagina quando l'utente entra». Misurato in laboratorio: sette secondi
    tondi, cioè ESATTAMENTE il tempo di sicurezza — il velo non cadeva perché
    una condizione era soddisfatta, ma perché scadeva il tempo. Sapere QUALE
    condizione non si soddisfa è tutta la differenza fra correggere e
    indovinare, e finora quel motivo non usciva da nessuna parte. */
let motivoVeloDetto = "";
let motivoVeloPrecedente = "";
function tracciaVelo(motivo: string) {
  if (motivo === motivoVeloDetto) return;
  if (motivoVeloDetto) motivoVeloPrecedente = motivoVeloDetto;
  motivoVeloDetto = motivo;
  const da = guestJoinAt ? Math.round(Date.now() - guestJoinAt) : 0;
  console.log(
    motivo ? `[VELO] +${da}ms aspetto: ${motivo}` : `[VELO] +${da}ms giù: contenuti visibili`,
  );
}

function guestVeilActive(st: State): boolean {
  if (typeof window === "undefined") return false;
  const joined = st.role === "viewer" && st.joined && !st.kicked;
  if (!joined) return false;
  if (guestJoinAt === 0) guestJoinAt = Date.now();
  if (guestLoadedOnce) return false; // già entrato: mai più il velo
  if (Date.now() - guestJoinAt >= GUEST_LOADING_MS) {
    // fallback: mai bloccati
    guestLoadedOnce = true;
    tracciaVelo("");
    console.warn(
      `[VELO] caduto per SCADENZA (${GUEST_LOADING_MS}ms): nessuna condizione soddisfatta — ultimo motivo: ${motivoVeloPrecedente}`,
    );
    return false;
  }
  // 1) pagina di CONTENUTI (slide / web / preventivo): la pagina NON è montata
  //    mentre carichiamo, quindi la prontezza si legge dal SERVER (curpage +
  //    quotestate). `guestPageApplied` resta valido come scorciatoia se la
  //    pagina era già montata e ha applicato lo stato via realtime.
  if (isGuestContentPage() && !(guestServerSeen || guestPageApplied)) {
    startGuestReadinessPoll();
    tracciaVelo("lo stato dal server (curpage/quotestate)");
    return true;
  }
  // 2) nessuna pagina di contenuti: basta la callstate del presentatore.
  /*  ── ⚠️ IL CONSULENTE SI ASPETTA UN ATTIMO, NON SETTE SECONDI ──────────
      Segnalazione del committente: «ci mette troppo tempo a sbloccarsi la
      pagina quando l'utente entra». Misurato in laboratorio, con la spia qui
      sopra: sette secondi tondi, cioè il tempo di SCADENZA, e il motivo
      scritto una riga sotto — «aspetto: una callstate dal consulente».
      Quella callstate la manda la scheda del consulente rispondendo al saluto
      del cliente. Ma se in quel momento lui sta guardando il CRM, o la posta,
      o qualunque altra scheda, la sua Meetly è in secondo piano: Chrome le
      strozza i tempi e può addirittura congelarla, e la risposta non parte.
      Il cliente resta davanti a «Caricamento in corso…» per sette secondi
      buoni — ed è il primo istante della consulenza, quello in cui si è
      deciso se il servizio funziona.
      Adesso il consulente si aspetta un attimo e non di più: dopo, la stanza
      si mostra comunque. Non si perde niente — quello che la callstate porta
      (modalità, camerine) arriva appena la scheda si sveglia, e le regole qui
      sotto continuano a valere per la videochiamata vera. */
  /*  ⚠️ E NEMMENO L'ATTIMO, SE NON C'È NIENTE DA ASPETTARE: quando il server
      ha già detto che NESSUNA videochiamata è in corso (è il caso normale —
      il cliente entra e si guarda il preventivo), la callstate del consulente
      non porterebbe niente che cambi quello che si vede adesso. */
  const nessunaChiamata = srvSessioneLetta && !srvCallActive;
  if (!isGuestContentPage() && !guestSawState && !nessunaChiamata && !guestServerSeen) {
    /*  ⚠️ …E INTANTO SI CHIEDE AL SERVER. Questa riga mancava, ed è la
        seconda metà del rimedio: il giro che legge lo stato dal server
        (`startGuestReadinessPoll`) veniva avviato SOLO sulle pagine di
        contenuti. Su /meetly nessuno lo avviava, quindi l'unica speranza era
        la risposta del consulente — e se la sua scheda era in secondo piano
        non arrivava. Adesso si chiede anche qui: appena il server risponde
        (poche centinaia di millisecondi) si sa tutto quello che serve. */
    startGuestReadinessPoll();
    if (Date.now() - guestJoinAt < ATTESA_CONSULENTE_MS) {
      tracciaVelo("una callstate dal consulente (o la risposta del server)");
      return true;
    }
  }
  // 3) chiamata attiva: attendo anche il primo flusso remoto / la connessione.
  if (st.active && !(remoteStreams.size > 0 || st.connected)) {
    tracciaVelo("il primo flusso della chiamata");
    return true;
  }
  // 4) ── MODALITÀ VIDEOCHIAMATA: SI ASPETTANO LE CAMERE ────────────────────
  //  Se hai scelto "Videochiamata" (non "Contenuti + PiP"), la prima cosa che il
  //  cliente deve vedere sono le camere — non la schermata dei contenuti che
  //  sta sotto. Finora il velo cadeva appena arrivava un qualsiasi segnale: per
  //  un istante compariva la pagina delle slide, e solo dopo si apriva la
  //  videochiamata. Ora, in questa modalità, il velo resta finché non ci sono
  //  DAVVERO le immagini: quella che riceve e la propria.
  if (st.active && st.mode === "call") {
    const remoteVideo = [...remoteStreams.values()].some((ms) =>
      ms.getVideoTracks().some((t) => t.readyState === "live"),
    );
    const mineReady =
      !st.camOn ||
      !!localStream?.getVideoTracks().some((t) => t.readyState === "live" && !isPlaceholder(t));
    if (!remoteVideo || !mineReady) {
      tracciaVelo(!remoteVideo ? "l'immagine del consulente" : "la mia camera");
      return true;
    }
  }
  guestLoadedOnce = true; // isteresi: non si torna indietro
  tracciaVelo("");
  return false;
}

function useGuestConnecting(st: State): boolean {
  const [, tick] = useState(0);
  const joined = st.role === "viewer" && st.joined && !st.kicked;
  useEffect(() => {
    if (!joined) return;
    const i = setInterval(() => tick((x) => x + 1), 300);
    const t = setTimeout(() => tick((x) => x + 1), GUEST_LOADING_MS + 50);
    return () => {
      clearInterval(i);
      clearTimeout(t);
    };
  }, [joined]);
  const raw = guestVeilActive(st);
  // il velo è anche il GATE dei contenuti: finché è su, la pagina sotto non dipinge
  useEffect(() => {
    if (S.guestVeil !== raw) set({ guestVeil: raw });
  }, [raw]);
  return raw;
}

// ── modal nomi prima di avviare la chiamata ───────────────────────────────
function StartModal() {
  // il nome arriva dal presentatore loggato (selezione + PIN); resta modificabile
  const [pn, setPn] = useState(() => readStoredPresenter()?.name || "");
  return (
    <div className="fixed inset-0 z-[97] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-white/12 bg-[#0a1428] p-5 text-white shadow-2xl">
        <div className="mb-3 flex items-center gap-2">
          <PhoneCall className="h-5 w-5 text-brand" />
          <span className="font-semibold">Avvia videochiamata</span>
        </div>
        <label className="mb-1 block text-[11px] text-white/50">Il tuo nome (presentatore)</label>
        <input
          autoFocus
          value={pn}
          onChange={(e) => setPn(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirmStart(pn)}
          placeholder="Es. Marco Rossi"
          className="mb-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm"
        />
        <p className="mb-2 text-[11px] text-white/40">
          Ogni ospite inserirà il proprio nome al momento dell'ingresso. Fino a ~6 partecipanti.
        </p>
        <p className="mb-4 rounded-lg border border-white/10 bg-white/5 p-2 text-[11px] leading-relaxed text-white/55">
          Subito dopo il browser chiederà di condividere <b>questa scheda</b>: serve alla{" "}
          <b>registrazione automatica</b> della consulenza, che partirà da sola appena entra il
          cliente e si fermerà a fine chiamata. Se annulli, potrai comunque registrare col tasto
          REC.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => cancelStart()}
            className="flex-1 rounded-lg border border-white/15 bg-white/5 py-2 text-sm text-white/80 hover:bg-white/10"
          >
            Annulla
          </button>
          <button
            onClick={() => confirmStart(pn)}
            className="flex-1 rounded-lg bg-brand py-2 text-sm font-semibold hover:brightness-110"
          >
            Avvia
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CLIENTE: UI brandizzata, griglia multi-partecipante ────────────────────
/** GATE — schermata OBBLIGATORIA con il nome dell'ospite: copre TUTTA la pagina
 *  (qualunque essa sia: slide, preventivo, sito) finché il nome non è confermato.
 *  Fondo completamente opaco: nessun contenuto può trasparire. */
/** SALA D'ATTESA — il cliente ha bussato e aspetta il tuo consenso. */
function GuestKnocking({ st }: { st: State }) {
  return (
    <div className="fixed inset-0 z-[130] flex flex-col items-center justify-center gap-6 overflow-hidden bg-brandfill px-6 text-center text-white">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-brand/10 blur-3xl" />
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6">
        <BrandLogo className="h-8 w-auto" />
        <div className="relative flex h-28 w-28 items-center justify-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand/25" />
          <span className="absolute inset-3 rounded-full bg-brand/20 blur-md" />
          <span
            className="absolute inset-0 rounded-full border-2 border-brand/40 border-t-brand animate-spin"
            style={{ animationDuration: "2.4s" }}
          />
          <ShieldCheck className="relative h-11 w-11 text-brand" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Sei in sala d'attesa</h1>
          <p className="text-sm leading-relaxed text-white/60">
            {st.presenterName ? (
              <>
                Abbiamo avvisato <b className="text-white/85">{st.presenterName}</b> del tuo arrivo.
              </>
            ) : (
              <>Abbiamo avvisato il consulente del tuo arrivo.</>
            )}{" "}
            La consulenza si aprirà da sola appena ti fa entrare.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left">
          {[
            { icon: Check, label: "Collegamento verificato", done: true },
            {
              icon: User,
              label: st.myName ? `Ti presenti come ${st.myName}` : "Nome inviato",
              done: true,
            },
            { icon: Clock3, label: "In attesa del consulente", done: false },
          ].map((r, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${r.done ? "bg-emerald-500/20 text-emerald-300" : "bg-brand/20 text-brand"}`}
              >
                <r.icon className={`h-4 w-4 ${r.done ? "" : "animate-pulse"}`} />
              </span>
              <span className={r.done ? "text-white/75" : "font-medium text-white"}>{r.label}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-white/35">
          Resta pure su questa pagina: non serve fare altro.
        </p>
      </div>
    </div>
  );
}

/** Ingresso rifiutato: messaggio garbato, nessun dettaglio tecnico. */
function GuestRefused() {
  /*  Il pulsante compare dopo qualche secondo: subito dopo un «non ora» non
      serve a niente, e averlo sotto le dita nell'istante del rifiuto invita a
      premerlo dieci volte. */
  const [sipuo, setSipuo] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSipuo(true), 8000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="fixed inset-0 z-[130] flex flex-col items-center justify-center gap-5 bg-brandfill px-6 text-center text-white">
      <BrandLogo className="h-8 w-auto" />
      <div className="rounded-full bg-white/10 p-5">
        <Clock3 className="h-10 w-10 text-white/70" />
      </div>
      <h1 className="text-xl font-semibold">Non è il momento giusto</h1>
      <p className="max-w-xs text-sm text-white/60">
        Il consulente è occupato in un'altra consulenza. Puoi riprovare fra qualche minuto, oppure
        attendere che ti ricontatti.
      </p>
      {sipuo && (
        <button
          type="button"
          onClick={() => bussaDiNuovo()}
          className="rounded-xl bg-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/25"
        >
          Bussa di nuovo
        </button>
      )}
    </div>
  );
}

/** POPUP DEL PRESENTATORE — chi bussa, con accetta/rifiuta. */
function KnockPopup({ st }: { st: State }) {
  /*  ── ⚠️ DOVE COMPARE, E DOVE NO ─────────────────────────────────────────
      Due segnalazioni opposte, e la seconda è arrivata perché la prima era
      stata sistemata male.
      «Quando un cliente entra su Meetly la richiesta esce anche sul CRM: deve
      uscire solo sul Meetly del consulente che sta facendo il Meetly» → si
      mostrava solo sulle pagine della consulenza.
      «Quando entrano le persone non li ammette» → perché il consulente, mentre
      aspetta il cliente, sta NEL CRM: gli apre la scheda, controlla il numero,
      lo chiama. La richiesta compariva su una pagina che in quel momento non
      era davanti a nessuno.
      La domanda giusta non era «che pagina è», era «la sta guardando qualcun
      altro?»: se un'altra scheda sta mostrando questa consulenza il riquadro va
      là e qui non serve; se non la sta mostrando nessuno va dove c'è il
      consulente, gestionale compreso. La regola, col faro che le schede si
      scambiano, sta in shop/dove-si-ammette.
      ⚠️ Si ricontrolla a orologio: l'indirizzo della pagina e il faro delle
       altre schede cambiano senza che React ne sappia niente. */
  const [, battito] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => battito((n) => n + 1), 1500);
    return () => clearInterval(iv);
  }, []);
  /*  ── ⚠️ FUORI DA MEETLY NON ESCE NIENTE, ED È UN DIETROFRONT ──────────
      Richiesta del committente, oggi: «il preventivo di chi è in consulenza,
      anche il pulsante per accettare, non devono mai uscire sul CRM, ma solo
      dentro la piattaforma Meetly».
      Prima la regola era un'altra — e l'aveva chiesta lui: la richiesta
      andava DOVE C'È IL CONSULENTE, gestionale compreso, perché mentre
      aspetta il cliente sta nel CRM e una richiesta che nessuno vede è un
      cliente che resta alla porta. Adesso la scelta è l'opposta, ed è sua:
      il gestionale resta il gestionale.
      ⚠️ QUELLO CHE SI PERDE, detto chiaro: se il cliente bussa mentre sei nel
       CRM, sul gestionale non compare più niente — resta il campanello, che
       è un suono e non un riquadro, e serve a farti cambiare scheda. Chi non
       vuole nemmeno quel passaggio ha «porta aperta», che li fa entrare da
       soli (vedi `setPortaAperta`). */
  const inConsulenza = useQuiSiConduce();
  /*  ── A PORTA APERTA IL RIQUADRO RESTA ───────────────────────────────────
      Un interruttore che si vede solo quando qualcuno sta bussando è un
      interruttore che non si può più spegnere: quando la porta è aperta non
      bussa più nessuno. Con l'elenco vuoto resta la sola striscia con
      l'interruttore, che dice anche che la porta è aperta. */
  if (!inConsulenza) return null;
  if (st.role !== "host" || (!st.knocks.length && !st.portaAperta)) return null;
  if (!st.knocks.length)
    return (
      <div
        data-hg-noptr
        className="fixed bottom-3 left-1/2 z-[150] w-[min(94vw,380px)] -translate-x-1/2 print:hidden"
      >
        <InterruttorePorta st={st} />
      </div>
    );
  /*  ── ⚠️ NON SI NASCONDE PIÙ: SI RIMPICCIOLISCE ──────────────────────────
      Segnalazione del committente: «quando una persona entra rimane in attesa
      e non entra mai».
      Qui la richiesta veniva TOLTA quando un'altra scheda stava mostrando la
      consulenza: l'idea era non mettere un riquadro grosso sopra il
      gestionale. Ma se il consulente in quel momento sta guardando proprio il
      gestionale — e il Meetly è aperto dietro, in un'altra finestra — la
      richiesta non la vede nessuno, e il cliente resta alla porta finché non
      si ricorda di cambiare scheda.
      Adesso la richiesta c'è SEMPRE. Dove la consulenza si conduce resta il
      riquadro grande; altrove diventa una striscia stretta in basso, che si
      legge e si preme senza coprire niente. Una richiesta piccola è un
      compromesso; una richiesta invisibile è un cliente perso. */
  const compatto = !ammissioniQui();
  if (compatto)
    return (
      <div
        data-hg-noptr
        className="fixed bottom-3 left-1/2 z-[150] w-[min(94vw,380px)] -translate-x-1/2 print:hidden"
      >
        <div className="flex items-center gap-2 rounded-xl border border-brand/40 bg-[#0b1a38]/97 px-3 py-2 shadow-2xl shadow-black/50 backdrop-blur">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
          </span>
          <span className="min-w-0 flex-1 truncate text-[12px] text-white/85">
            {st.knocks.length === 1 ? (
              <>
                <b className="font-semibold text-white">{st.knocks[0].name}</b> aspetta di entrare
              </>
            ) : (
              <>
                <b className="font-semibold text-white">{st.knocks.length} persone</b> aspettano di
                entrare
              </>
            )}
          </span>
          <button
            onClick={() => {
              for (const k of st.knocks.slice()) admitGuest(k.pid);
            }}
            className="shrink-0 rounded-lg bg-brand px-2.5 py-1.5 text-[11.5px] font-semibold text-white hover:brightness-110"
          >
            Fai entrare
          </button>
        </div>
        <div className="mt-1.5">
          <InterruttorePorta st={st} />
        </div>
      </div>
    );
  /*  ── QUANDO ASPETTANO IN PIÙ DI UNO ──────────────────────────────────────
      Richiesta del committente: «fai che possono entrare anche 3 ospiti o
      più». Bussare in tre si poteva già — la sala d'attesa è una lista — ma le
      richieste si impilavano tutte, una sopra l'altra: con quattro persone la
      pila copriva lo schermo proprio mentre si cercava il pulsante per farle
      entrare. Se ne mostrano tre, le altre si contano, e c'è un pulsante per
      farli entrare tutti insieme — che con un gruppo che arriva allo stesso
      momento è l'unico modo di non passare mezzo minuto a cliccare.
      ⚠️ Le richieste NON scadono e non si perdono: chi resta fuori dalle tre
       ribussa ogni quattro secondi ed è comunque nella lista. */
  const VISIBILI = 3;
  const inCoda = st.knocks.slice(0, VISIBILI);
  const restanti = st.knocks.length - inCoda.length;
  return (
    <div
      data-hg-noptr
      className="fixed bottom-20 left-1/2 z-[150] w-[min(94vw,420px)] -translate-x-1/2 space-y-2 print:hidden"
    >
      {st.knocks.length >= 2 && (
        <div className="flex items-center gap-2 rounded-xl border border-brand/40 bg-[#0b1a38]/95 px-3 py-2 shadow-2xl">
          <span className="min-w-0 flex-1 text-[11px] text-white/70">
            <b className="text-white">{st.knocks.length} persone</b> aspettano di entrare
            {restanti > 0 && (
              <span className="text-white/45">
                {" "}
                · {restanti} non {restanti === 1 ? "è" : "sono"} in elenco qui sotto
              </span>
            )}
          </span>
          <button
            onClick={() => {
              for (const k of st.knocks.slice()) admitGuest(k.pid);
            }}
            className="shrink-0 rounded-lg bg-brand px-2.5 py-1.5 text-[11px] font-semibold text-white hover:brightness-110"
          >
            Fai entrare tutti
          </button>
        </div>
      )}
      {inCoda.map((k) => (
        <div
          key={k.pid}
          className="overflow-hidden rounded-2xl border border-brand/40 bg-[#0b1a38] shadow-2xl shadow-black/60 ring-1 ring-black/30"
        >
          <div className="flex items-center gap-3 px-4 pt-4">
            <span className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand/20 text-base font-bold text-brand">
              <span className="absolute inset-0 animate-ping rounded-full bg-brand/20" />
              <span className="relative">{(k.name || "?").trim().charAt(0).toUpperCase()}</span>
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold text-white">{k.name}</p>
              {/*  ── ERA ATTESO, O È ARRIVATO DA UN LINK INOLTRATO? ──────
                   È la sola cosa che il consulente non può dedurre dal nome,
                   ed è quella che cambia la risposta. */}
              <p
                className={`text-[11px] ${k.atteso ? "text-emerald-300/80" : "text-amber-300/80"}`}
              >
                {k.atteso ? "era atteso in questa consulenza" : "non era fra gli attesi"}
              </p>
            </div>
          </div>
          <div className="flex gap-2 p-3">
            <button
              onClick={() => denyGuest(k.pid)}
              className="flex-1 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-semibold text-white/80 hover:bg-white/10"
            >
              Non ora
            </button>
            <button
              onClick={() => admitGuest(k.pid)}
              className="flex-[1.6] rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 hover:brightness-110"
            >
              Fai entrare
            </button>
          </div>
        </div>
      ))}
      <InterruttorePorta st={st} />
    </div>
  );
}

/** ── «FAI ENTRARE DA SOLO CHI BUSSA» ───────────────────────────────────────
 *  Richiesta del committente, e la sua precisazione: «possono entrare anche se
 *  non sono in elenco». Un interruttore solo, scritto per quello che fa
 *  davvero — non «ammissione automatica degli attesi», che prometterebbe un
 *  filtro che non c'è. */
function InterruttorePorta({ st }: { st: State }) {
  if (st.role !== "host") return null;
  return (
    <button
      type="button"
      onClick={() => setPortaAperta(!st.portaAperta)}
      className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[11.5px] shadow-2xl transition ${
        st.portaAperta
          ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-100"
          : "border-white/12 bg-[#0b1a38]/95 text-white/70 hover:border-white/25"
      }`}
    >
      <span
        className={`flex h-5 w-9 flex-shrink-0 items-center rounded-full p-0.5 transition ${st.portaAperta ? "bg-emerald-400/80" : "bg-white/15"}`}
      >
        <span
          className={`h-4 w-4 rounded-full bg-white transition ${st.portaAperta ? "translate-x-4" : ""}`}
        />
      </span>
      <span className="min-w-0 flex-1">
        <b className="font-semibold">Porta aperta</b>
        <span className="block text-[10.5px] leading-snug opacity-70">
          {st.portaAperta
            ? "chi bussa entra da solo, anche se non è in elenco"
            : "ogni ingresso lo autorizzi tu"}
        </span>
      </span>
    </button>
  );
}

/** ── È ENTRATO UNO CHE NON ASPETTAVI ───────────────────────────────────────
 *  Il prezzo della porta aperta, pagato a viso aperto: chi entra senza essere
 *  fra gli attesi lo si viene a sapere subito, con il pulsante per mandarlo
 *  fuori già lì. Senza questo, la porta aperta sarebbe una porta di cui non si
 *  sa più chi è passato.
 *  ⚠️ L'AVVISO NON SPARISCE DA SOLO: è l'unica traccia di un ingresso che
 *   nessuno ha autorizzato. Lo toglie il consulente, dicendo «va bene». */
function AvvisiIngresso({ st }: { st: State }) {
  //  Come per le richieste d'ingresso: sul gestionale non esce niente
  //  (vedi il cartello in KnockPopup).
  const inConsulenza = useQuiSiConduce();
  if (!inConsulenza || st.role !== "host" || !st.entrateLibere.length) return null;
  return (
    <div
      data-hg-noptr
      className="fixed left-3 top-3 z-[151] w-[min(92vw,320px)] space-y-2 print:hidden"
    >
      {st.entrateLibere.map((e) => (
        <div
          key={e.pid}
          className="rounded-xl border border-amber-400/40 bg-[#1a1405]/95 p-3 shadow-2xl shadow-black/50 backdrop-blur"
        >
          <p className="text-[12.5px] leading-snug text-amber-100">
            <b className="font-semibold text-white">{e.nome}</b> è entrato dalla porta aperta e non
            era fra gli attesi.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => mandaFuori(e.pid)}
              className="flex-1 rounded-lg border border-rose-400/40 bg-rose-500/15 px-2.5 py-1.5 text-[11.5px] font-semibold text-rose-100 hover:bg-rose-500/25"
            >
              Mandalo fuori
            </button>
            <button
              onClick={() => scartaEntrataLibera(e.pid)}
              className="flex-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11.5px] font-semibold text-white/80 hover:bg-white/10"
            >
              Va bene
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** ── CHI È ATTESO IN QUESTA STANZA ────────────────────────────────────────
 *  Richieste del committente: «nome e cognome si mettono in automatico se
 *  l'utente è registrato in quel link, e quindi avvia la richiesta di accesso
 *  da solo» e, per gli slot con più persone, «tutti e 3 hanno accesso».
 *
 *  Tre situazioni, e una sola schermata che le distingue:
 *   · UNA persona attesa → si entra da soli, senza chiedere niente;
 *   · DUE O PIÙ → i nomi già scritti, un tocco: nessuno digita niente;
 *   · NESSUNA (link aperto senza appuntamento, o inoltrato a un amico) → si
 *     scrive il nome, esattamente come si è sempre fatto.
 *
 *  ⚠️ IL TOCCO NON SPARISCE DEL TUTTO, E NON PUÒ. Camera, microfono e audio
 *   su iPhone si aprono solo dopo un gesto della persona: l'ingresso parte da
 *   solo, il resto si sblocca al primo tocco (c'è già il pulsante «Attiva
 *   l'audio» per quando il browser lo blocca). */
function useAttesi(code: string | null) {
  const [attesi, setAttesi] = useState<{ gettone: string; nome: string }[] | null>(null);
  useEffect(() => {
    if (!code) return;
    let vivo = true;
    fetch(`/api/public/attesi?sess=${encodeURIComponent(code)}`)
      .then((r) => r.json())
      .then((j) => {
        if (vivo) setAttesi(j?.ok && Array.isArray(j.attesi) ? j.attesi : []);
      })
      //  Se non si riesce a sapere chi è atteso si torna alla richiesta del
      //  nome: mai una porta chiusa perché una comodità non ha risposto.
      .catch(() => {
        if (vivo) setAttesi([]);
      });
    return () => {
      vivo = false;
    };
  }, [code]);
  return attesi;
}

function GuestJoinGate({ st }: { st: State }) {
  const [gn, setGn] = useState("");
  const attesi = useAttesi(st.sessionId);
  const [scriviIoIlNome, setScriviIoIlNome] = useState(false);
  const daSolo = useRef(false);
  //  Una persona sola: entra lei, senza che nessuno tocchi niente.
  useEffect(() => {
    if (!attesi || attesi.length !== 1 || daSolo.current || st.joined || st.knocking) return;
    daSolo.current = true;
    console.log("[GUEST] atteso riconosciuto dal link:", attesi[0].nome);
    void viewerJoin(attesi[0].nome, attesi[0].gettone);
  }, [attesi, st.joined, st.knocking]);
  // iOS Safari ingrandisce (pinch) la pagina quando prende il fuoco un campo con
  // font < 16px: qui il font è 16px e su touch NON usiamo autoFocus → niente zoom.
  const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  const go = () => {
    console.log("[GUEST] click ingresso", gn);
    void viewerJoin(gn);
  };
  return (
    <div className="fixed inset-0 z-[130] flex flex-col items-center justify-center gap-5 overflow-hidden bg-brandfill px-6 text-center text-white">
      <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
      <div className="relative z-10 flex w-full flex-col items-center gap-5">
        <div className="flex flex-col items-center gap-2">
          <BrandLogo className="h-8 w-auto" />
          <MarchioMeetly />
        </div>
        <div className="rounded-full bg-brand/15 p-5">
          <PhoneCall className="h-12 w-12 text-brand" />
        </div>
        <div className="text-xl font-semibold">
          {attesi && attesi.length >= 2 && !scriviIoIlNome
            ? "Chi sei?"
            : st.active
              ? "Videochiamata in arrivo"
              : "La tua videoconsulenza è pronta"}
        </div>
        <p className="max-w-xs text-sm text-white/60">
          {attesi && attesi.length >= 2 && !scriviIoIlNome
            ? "Tocca il tuo nome: il consulente vi aspetta insieme."
            : attesi && attesi.length === 1
              ? "Un istante: ti stiamo annunciando al consulente."
              : st.active
                ? "Inserisci il tuo nome, poi abilita camera e microfono per unirti."
                : "Inserisci il tuo nome per entrare nella consulenza."}
        </p>

        {/* ── IN PIÙ PERSONE: SI SCEGLIE, NON SI SCRIVE ─────────────────
            Un tocco invece della tastiera, e il consulente riceve il nome
            della scheda invece di «marco» minuscolo o «io». Chi non è in
            elenco — il link inoltrato a un amico — scrive il suo, sotto. */}
        {attesi && attesi.length >= 2 && !scriviIoIlNome && (
          <div className="flex w-full max-w-xs flex-col gap-2">
            {attesi.map((a) => (
              <button
                key={a.gettone}
                type="button"
                onClick={() => {
                  console.log("[GUEST] sono", a.nome);
                  void viewerJoin(a.nome, a.gettone);
                }}
                className="flex items-center gap-3 rounded-2xl border-2 border-brand/40 bg-white/[0.06] px-4 py-3.5 text-left text-[15px] font-semibold text-white transition hover:border-brand hover:bg-brand/15"
              >
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand/20 text-[15px] font-bold text-brand">
                  {a.nome.trim().charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1 truncate">{a.nome}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setScriviIoIlNome(true)}
              className="mt-1 text-[12.5px] text-white/45 underline decoration-white/20 underline-offset-2 hover:text-white/75"
            >
              Non sono nessuno di questi
            </button>
          </div>
        )}

        {/* Una persona sola: sta già entrando, non c'è niente da toccare. */}
        {attesi && attesi.length === 1 && (
          <div className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-4 py-2.5 text-[13px] font-medium text-white">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand/60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-brand" />
            </span>
            {attesi[0].nome}
          </div>
        )}
        {/* ── IL CAMPO DEVE SEMBRARE UN CAMPO ────────────────────────────
            Prima era un rettangolo scuro col testo centrato in grigio chiaro,
            senza etichetta e senza cursore visibile su touch: molti non
            capivano che ci si dovesse scrivere e premevano subito il pulsante.
            Ora ha un'etichetta sopra, un'icona dentro, il bordo acceso del
            brand e un contorno che pulsa finché resta vuoto — e il pulsante
            resta spento finché il nome non c'è, così l'unica strada aperta è
            quella giusta. */}
        <label
          className="w-full max-w-xs text-left"
          //  Nascosto — non tolto — quando la stanza sa già chi aspetta: chi
          //  preme «non sono nessuno di questi» lo ritrova senza che la
          //  schermata si ricostruisca sotto le dita.
          hidden={!!attesi && attesi.length > 0 && !scriviIoIlNome}
        >
          <span className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-white/70">
            <User className="h-3.5 w-3.5 text-brand" /> Scrivi qui il tuo nome
          </span>
          <span className="relative block">
            <input
              autoFocus={!touch}
              value={gn}
              onChange={(e) => setGn(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && go()}
              placeholder="es. Marco"
              aria-label="Il tuo nome"
              autoComplete="given-name"
              enterKeyHint="go"
              style={{ fontSize: 16 }} // ≥16px: evita l'auto-zoom di iOS Safari
              className={`w-full rounded-xl border-2 bg-white/[0.07] px-4 py-3.5 text-white placeholder:text-white/35 focus:outline-none ${
                gn.trim() ? "border-emerald-400/60" : "hg-pulse-border border-brand"
              }`}
            />
            {gn.trim() && (
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-emerald-300">
                <Check className="h-4 w-4" />
              </span>
            )}
          </span>
          <span className="mt-1.5 block text-[11.5px] text-white/45">
            {gn.trim()
              ? "Perfetto, puoi entrare."
              : "Serve al consulente per riconoscerti quando entri."}
          </span>
        </label>
        <button
          onClick={go}
          disabled={!gn.trim()}
          hidden={!!attesi && attesi.length > 0 && !scriviIoIlNome}
          className="rounded-2xl bg-brand px-7 py-3.5 text-base font-semibold shadow-lg shadow-brand/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {st.active ? "Abilita camera e microfono" : "Entra"}
        </button>
      </div>
    </div>
  );
}

function ViewerOverlay({ st, ls }: { st: State; ls: MediaStream | null }) {
  /*  ── ⚠️ LA PRECEDENZA VALE ANCHE SULLA MODALITÀ GIÀ IN CORSO ──────────
      Fotografia del committente, le due schermate affiancate: sul pannello
      «Il suo — lo compila lui» acceso, e il cliente con le facce a tutto
      schermo sopra il suo preventivo. Il suo indirizzo ERA quello giusto
      (/preventivo): la pagina sotto c'era, ma questo velo la copriva.
      Il rifiuto delle modalità in arrivo esisteva già (`handleMode`) e
      funziona; quello che mancava è che la modalità ACCESA PRIMA restava
      accesa — accendere il suo preventivo non la spegneva. Qui si guarda la
      precedenza, non solo quello che ha detto il consulente.
      ⚠️ Gancio PRIMA di ogni uscita anticipata: vedi `proveDegliHook`. */
  const [suoPreventivo, setSuoPreventivo] = useState(restaSulMioPreventivo);
  useEffect(() => ascoltaMioPreventivo(setSuoPreventivo), []);
  if (!st.active) return null;

  // tile: locale (cliente) in cima, altri ospiti, presentatore in fondo
  const tiles = buildTiles(st, ls, true);
  // presentatore: voce reale del roster o segnaposto (mai "assente")
  const hostP = viewerHostEntry(st);
  //  «Sta mostrando qualcosa sotto» — e quando il cliente ha il suo preventivo
  //  acceso è sempre vero: sotto c'è il suo preventivo, e le camere restano
  //  piccole in un angolo invece di coprirlo.
  const presenting = st.mode === "content" || suoPreventivo;

  // Feature 4 — PiP che segue chi parla (durante screen-share): overlay su ogni vista
  //  ⚠️ SOLO durante la condivisione schermo, e solo se il presentatore l'ha
  //  acceso: senza questa condizione, in "Contenuti + PiP" bastava che qualcuno
  //  parlasse perché la camera prendesse il posto della PiP configurata e
  //  finisse davanti alla scheda che il cliente stava leggendo.
  const asTile =
    st.sharing && st.speakerPip && st.activeSpeakerPid
      ? tileForPid(st, ls, st.activeSpeakerPid)
      : null;
  const asPip = asTile ? <ContentPip tiles={[asTile]} /> : null;

  // ── PRESENTAZIONE (content): NON dividere lo schermo in griglia. Il guest vede i
  //    CONTENUTI della pagina + al massimo una piccola PiP camera decisa dal presentatore.
  if (presenting) {
    if (asPip) return asPip; // chi parla ha la priorità sul PiP configurato
    const cc = st.contentCam || { showMine: true, showGuest: false, which: "me" as const };
    const presenterStream = hostP ? remoteStreams.get(hostP.pid) || null : null;
    const mineTile: Tile = {
      pid: "host-cam",
      name: st.presenterName || "Presentatore",
      role: "host",
      stream: presenterStream,
      camOn: hostP?.camOn ?? true,
      isLocal: false,
      muted: false,
    };
    const guestTile: Tile = {
      pid: "me",
      name: st.myName || "Tu",
      role: "viewer",
      stream: ls,
      camOn: st.camOn,
      isLocal: true,
      muted: true,
    };
    const pip: Tile[] = [];
    if (cc.showMine) pip.push(mineTile);
    if (cc.showGuest) pip.push(guestTile);
    // "which" = quale è la principale (più grande) quando sono attive entrambe
    if (pip.length === 2 && cc.which === "guest") pip.reverse();
    if (pip.length === 0) return null; // nessuna camera → solo contenuti, schermo pulito
    return <ContentPip tiles={pip} />;
  }

  // ── Feature 2 — "Solo tu" (presenter): il guest vede SOLO la camera del presentatore ──
  if (st.mode === "presenter") {
    // Il nome mostrato accanto al logo è SEMPRE quello del presentatore (mai "Ospite",
    // mai il nome dell'utente locale): lo forzo anche sulla tile (placeholder camera spenta).
    const pName = presenterDisplayName(st);
    const base = hostP ? tileForPid(st, ls, hostP.pid) : null;
    // segnaposto: il presentatore c'è ma il suo hello/flusso non è ancora arrivato
    const t: Tile | null = base
      ? { ...base, name: pName, role: "host" }
      : hostP
        ? {
            pid: hostP.pid,
            name: pName,
            role: "host",
            stream: null,
            camOn: false,
            isLocal: false,
            muted: false,
          }
        : null;
    return (
      <>
        <NeutralBackdrop />
        <FullscreenTile
          t={t}
          showLogo
          presenterName={pName}
          waiting="Il presentatore sta arrivando…"
        />
        {asPip}
      </>
    );
  }

  // ── Feature 3 — "Solo lui" (client): l'ospite scelto (focusPid) a tutto schermo su OGNI
  //    dispositivo. In 1:1 il focus è l'unico ospite → quel guest vede la PROPRIA camera
  //    (bug fix C: prima il focalizzato vedeva il presentatore → identico a "Solo tu").
  if (st.mode === "client") {
    // Feature 3 (fix "Solo lui") — mostro SOLO la camera dell'ospite focalizzato, su OGNI
    // dispositivo. Priorità: focusPid (broadcast dall'host) → se è il MIO pid uso la camera
    // locale, altrimenti remoteStreams.get(focusPid). MAI il presentatore come fallback
    // (era il bug: senza pid valido ricadeva su hostP e restava identico a "Solo tu").
    const showPid =
      st.focusPid || st.myPid || st.roster.find((r) => r.role === "viewer")?.pid || null;
    const base = tileForPid(st, ls, showPid);
    const showLogo = base?.role === "host"; // branding solo se, per qualche motivo, mostro il presentatore
    // "Solo lui": l'etichetta è il NOME dell'ospite focalizzato (anche quando è la mia
    // camera locale, dove tileForPid restituirebbe "Tu").
    const t: Tile | null = base
      ? {
          ...base,
          name:
            base.role === "host"
              ? presenterDisplayName(st)
              : base.isLocal
                ? st.myName || base.name
                : base.name,
        }
      : null;
    return (
      <>
        <NeutralBackdrop />
        <FullscreenTile
          t={t}
          showLogo={!!showLogo}
          presenterName={presenterDisplayName(st)}
          waiting="In attesa della camera dell'ospite…"
        />
        {asPip}
      </>
    );
  }

  // ── VIDEOCHIAMATA PURA (call): griglia a tutto schermo + filigrana logo ──────────
  return (
    <>
      <NeutralBackdrop />
      {/* Le camere stanno nell'area VISIBILE: in orizzontale, su telefono e
        tablet, le barre del browser non ne coprono più una fetta.
        Il margine è più stretto sugli schermi piccoli (dove in orizzontale
        l'altezza è pochissima): ogni pixel tolto al bordo è volto in più. */}
      <StratoVisibile className="bg-brandfill z-[92] flex flex-col">
        {/* Feature 5 — nessun LogoWatermark qui: il badge logo+nome del presentatore è
          già reso UNA volta sulla sua tile (PresenterBadge) dalla griglia */}
        {/*  Il margine è minimo sul telefono: ogni punto tolto al bordo è faccia
           in più, ed è metà della richiesta «che occupi più spazio possibile». */}
        <ParticipantsGrid tiles={tiles} fill className="min-h-0 flex-1 p-1 sm:p-3" />
        {tiles.length <= 1 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white/50">
            In attesa degli altri…
            {st.diag && <span className="ml-2 font-mono text-[11px]">{st.diag}</span>}
          </div>
        )}
        {asPip}
      </StratoVisibile>
    </>
  );
}

// ── PUSH-TO-TALK (presentatore) ───────────────────────────────────────────
//  Tasto J. Con PTT spento è un semplice interruttore del microfono; con PTT
//  acceso il mic è muto e si apre SOLO mentre il tasto resta premuto.
//  - l'auto-ripetizione della tastiera (e.repeat) viene ignorata
//  - la scorciatoia è disattivata mentre si scrive (input/textarea/contenteditable)
//  - se la finestra perde il fuoco con J premuto il mic torna muto (niente "mic aperto")
const PTT_KEY = "hg_ptt";
function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || typeof el.tagName !== "string") return false;
  const tag = el.tagName.toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
}
function usePushToTalk(ptt: boolean, setTalking: (v: boolean) => void) {
  const first = useRef(true);
  // all'accensione/spegnimento del PTT allinea subito lo stato del microfono
  useEffect(() => {
    try {
      localStorage.setItem(PTT_KEY, ptt ? "1" : "0");
    } catch {
      /* */
    }
    setTalking(false);
    if (ptt)
      setMicOn(false); // PTT attivo → di base MUTO
    else if (!first.current) setMicOn(true); // PTT disattivato dall'utente → mic riaperto
    first.current = false; // al primo giro non tocco un mic già impostato
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ptt]);

  useEffect(() => {
    // ⇧J = microfono (o push-to-talk tenendo premuto) · ⇧K = camera.
    // Con Shift premuto e.key diventa maiuscolo: uso e.code (tasto FISICO), così
    // il keyup viene riconosciuto anche se Shift viene rilasciato per primo.
    const noMod = (e: KeyboardEvent) => !e.metaKey && !e.ctrlKey && !e.altKey;
    const isJ = (e: KeyboardEvent) => e.code === "KeyJ" && noMod(e);
    const isK = (e: KeyboardEvent) => e.code === "KeyK" && noMod(e);
    let jHeld = false;
    const onDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (isK(e) && e.shiftKey) {
        if (e.repeat) {
          e.preventDefault();
          return;
        }
        e.preventDefault();
        toggleCam();
        return;
      }
      if (!isJ(e) || !e.shiftKey) return;
      if (e.repeat) {
        e.preventDefault();
        return;
      } // auto-ripetizione: ignorata
      e.preventDefault();
      if (!ptt) {
        toggleMic();
        return;
      } // PTT OFF → interruttore
      jHeld = true;
      setTalking(true);
      setMicOn(true); // PTT ON → apri finché premuto
    };
    const onUp = (e: KeyboardEvent) => {
      if (!isJ(e)) return; // NB: senza controllo su Shift
      if (!ptt || !jHeld) return;
      e.preventDefault();
      jHeld = false;
      setTalking(false);
      setMicOn(false);
    };
    const release = () => {
      jHeld = false;
      if (ptt) {
        setTalking(false);
        setMicOn(false);
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", release);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", release);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ptt]);
}

// ── PRESENTATORE: barra comandi in ALTO + preview camera flottante/agganciata ─
/** Siamo su una pagina dove la consulenza si CONDUCE (non sul gestionale)?
 *  Si rilegge a orologio: l'indirizzo cambia senza passare da questo stato, e
 *  da questa risposta dipende se la videochiamata si prende tutto lo schermo. */
function useQuiSiConduce(): boolean {
  const [qui, setQui] = useState(() =>
    typeof window === "undefined" ? false : quiSiConduce(window.location.pathname),
  );
  useEffect(() => {
    const agg = () => setQui(quiSiConduce(window.location.pathname));
    agg();
    const iv = setInterval(agg, 1000);
    window.addEventListener("popstate", agg);
    return () => {
      clearInterval(iv);
      window.removeEventListener("popstate", agg);
    };
  }, []);
  return qui;
}

function HostOverlay({ st, ls }: { st: State; ls: MediaStream | null }) {
  //  Lo schermo pieno del PROPRIO browser: locale, non viaggia sul canale.
  /*  Il riquadro delle camere: è quello che «Schermo intero» deve ingrandire
      (vedi `useSchermoPieno`). Lo portano tutte e tre le vesti in cui le
      camere possono trovarsi — a tutta pagina, nella colonna a destra,
      nella finestrella staccata — così il pulsante funziona sempre. */
  const riquadroCamere = useRef<HTMLDivElement | null>(null);
  const schermo = useSchermoPieno(riquadroCamere);
  const { pos, handlers } = useDrag({
    x: 20,
    y: typeof window !== "undefined" ? Math.max(120, window.innerHeight - 300) : 320,
  });
  const [dl, setDl] = useState(false);
  const [piu, setPiu] = useState(false); // menu "Altri strumenti"
  const [tele, setTele] = useState(false);
  const [size, setSize] = useState(280); // larghezza preview flottante
  const [showMine, setShowMine] = useState(true); // includi anche la MIA camera nella griglia
  const [camClosed, setCamClosed] = useState(false);
  const [dockH, setDockH] = useState(200); // altezza griglia agganciata nel teleprompter
  const [rightW, setRightW] = useState(() =>
    typeof window !== "undefined" ? Math.min(420, Math.round(window.innerWidth * 0.32)) : 360,
  ); // larghezza dock destro (teleprompter chiuso)
  const [undocked, setUndocked] = useState(false); // camera estratta dal teleprompter → finestra flottante
  /*  ── ⚠️ LA VIDEOCHIAMATA SI PRENDE TUTTO, FINCHÉ NON MOSTRI ALTRO ───────
      Richiesta del committente: «sulla scheda del presentatore, in
      videochiamata, sia a schermo pieno finché non attivo un media o altro».
      Quando non stai mostrando niente, l'unica cosa che conta sullo schermo
      sono le facce — e stavano in una colonna larga un terzo, con accanto una
      libreria di media che in quel momento non serve. Appena mostri qualcosa
      (premi «Contenuti», oppure «Mostra» su un media, che fa la stessa cosa)
      la modalità non è più «call» e le camere tornano da parte, dove servono
      per controllare come stai venendo.
      ⚠️ SOLO DOVE LA CONSULENZA SI CONDUCE: sul gestionale no. Lì il
       presentatore sta lavorando su altro — la scheda del cliente, l'agenda —
       e coprirglielo con le camere sarebbe come togliergli la scrivania.
      ⚠️ E C'È SEMPRE LA VIA D'USCITA: «riduci a lato» rimette la colonna e
       scopre la pagina, senza toccare nulla di quello che vede il cliente. */
  const [lato, setLato] = useState(false);
  const inConsulenza = useQuiSiConduce();
  useEffect(() => {
    setLato(false);
  }, [st.mode]); // cambio modalità = si riparte dalla regola
  // PIN — partecipanti "appuntati": se almeno uno è pinnato il pannello camere del
  // PRESENTATORE mostra SOLO quelli. Scelta LOCALE: non viene mai inviata agli ospiti.
  const [pinned, setPinned] = useState<string[]>([]);
  const togglePin = (pid: string) =>
    setPinned((p) => (p.includes(pid) ? p.filter((x) => x !== pid) : [...p, pid]));
  // POPUP PARTECIPANTI dall'icona "persone" nell'header del pannello camere.
  // Renderizzato in portale (fuori dai contenitori che tagliano) con z-index alto.
  const [peoplePop, setPeoplePop] = useState<{ x: number; y: number } | null>(null);
  const openPeoplePop = (el: HTMLElement) => {
    if (peoplePop) {
      setPeoplePop(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const W = typeof window !== "undefined" ? window.innerWidth : 900;
    setPeoplePop({ x: Math.max(8, Math.min(r.right - 288, W - 296)), y: r.bottom + 6 });
  };
  const [pickTarget, setPickTarget] = useState(false); // Feature 3 — popup scelta ospite per "Solo lui"
  // ── PUSH-TO-TALK (tasto J) ───────────────────────────────────────────────
  //  OFF: J = interruttore mic (come cliccare il pulsante).
  //  ON : mic MUTO di base, tenendo premuto J si trasmette; al rilascio torna muto.
  const [ptt, setPtt] = useState(() => {
    try {
      return localStorage.getItem(PTT_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [talking, setTalking] = useState(false); // J tenuto premuto (solo con PTT attivo)
  usePushToTalk(ptt, setTalking);
  const [chatPeer, setChatPeer] = useState<string | null>(null); // Feature 5 — ospite con cui chatto
  const barRef = useRef<HTMLDivElement | null>(null);
  const [barH, setBarH] = useState(60); // altezza REALE della barra comandi in alto
  // ── MENU AUDIO DEL MICROFONO (pressione lunga / freccetta / tasto destro) ──
  const micWrapRef = useRef<HTMLDivElement | null>(null);
  const [audioMenu, setAudioMenu] = useState<{ x: number; y: number } | null>(null);
  const [sfoMenu, setSfoMenu] = useState(false); // quanto sfocare lo sfondo
  const [camMenu, setCamMenu] = useState<{ x: number; y: number } | null>(null);
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpFired = useRef(false);
  const openAudioMenu = () => {
    const r = micWrapRef.current?.getBoundingClientRect();
    setAudioMenu({
      x: r ? Math.min(r.left, (typeof window !== "undefined" ? window.innerWidth : 800) - 312) : 16,
      y: r ? r.bottom + 8 : 72,
    });
  };
  const micDown = () => {
    lpFired.current = false;
    if (lpTimer.current) clearTimeout(lpTimer.current);
    lpTimer.current = setTimeout(() => {
      lpTimer.current = null;
      lpFired.current = true;
      openAudioMenu();
    }, 450);
  };
  const micUp = () => {
    if (lpTimer.current) {
      clearTimeout(lpTimer.current);
      lpTimer.current = null;
    }
  };
  useEffect(
    () => () => {
      if (lpTimer.current) clearTimeout(lpTimer.current);
    },
    [],
  );

  const guests = st.roster.filter((r) => r.role === "viewer");
  // Feature 3 — riusabile: se >1 ospite chiedi QUALE; se ==1 usa quello; se 0 nessuno
  const chooseClient = () => {
    if (guests.length <= 1) hostSetMode("client", guests[0]?.pid || null);
    else setPickTarget(true);
  };

  // la barra è in ALTO (sotto l'header nav): riserva spazio in cima alla pagina
  useEffect(() => {
    if (typeof document === "undefined") return;
    const set = () => {
      const h = barRef.current?.offsetHeight || 60;
      document.body.style.paddingTop = h + "px";
      //  ⚠️ E LA SI PUBBLICA, perché non è solo un fatto di questa barra: il
      //   pannello dei preventivi deve stare ATTACCATO sotto di lei, e prima
      //   stava a un'altezza scritta a mano (80px) che con la barra su due
      //   righe gli finiva sopra i comandi.
      document.documentElement.style.setProperty("--hg-barra-alta", h + "px");
      setBarH(h); // serve alla PiP "specchio": non deve mai finire sotto la barra
    };
    set();
    const ro =
      typeof ResizeObserver !== "undefined" && barRef.current ? new ResizeObserver(set) : null;
    if (ro && barRef.current) ro.observe(barRef.current);
    /*  ⚠️ ANCHE QUANDO CAMBIA LA FINESTRA, NON SOLO LA BARRA. Girando il
        telefono — o aprendo la finestra dopo che la pagina è nata in una
        scheda in secondo piano, dove misura zero — la barra si ridispone su
        più righe o su meno, e da questa altezza dipende dove COMINCIA la
        videochiamata a tutta pagina: con una misura vecchia il pannello
        resta schiacciato in fondo. Due riletture ritardate perché iOS, subito
        dopo la rotazione, risponde ancora con le misure di prima. */
    const dopo = () => {
      set();
      window.setTimeout(set, 120);
      window.setTimeout(set, 400);
    };
    window.addEventListener("resize", dopo);
    window.addEventListener("orientationchange", dopo);
    return () => {
      document.body.style.paddingTop = "";
      ro?.disconnect();
      window.removeEventListener("resize", dopo);
      window.removeEventListener("orientationchange", dopo);
    };
  }, [tele, camClosed, st.mode]);
  if (!st.active) return null;

  //  Videochiamata «pulita»: nessun contenuto in onda, nessuno schermo
  //  condiviso, il teleprompter chiuso e la camera non chiusa a mano.
  const chiamataPiena =
    st.mode === "call" && !st.sharing && !tele && !camClosed && !lato && inConsulenza;

  const guestCam: "me" | "lui" | "screen" = st.sharing
    ? "screen"
    : st.mode === "client"
      ? "lui"
      : st.mode === "call"
        ? st.primary === "presenter"
          ? "me"
          : "lui"
        : "me";

  // griglia di TUTTI i partecipanti (io opzionale via "showMine")
  const tiles = buildTiles(st, ls, showMine);
  const allTiles = buildTiles(st, ls, true);

  // contenuto della preview (riusato: flottante o agganciato al teleprompter)
  const renderCam = (h?: number, fill?: boolean) => {
    // PIN — "spotlight + strip": il partecipante fissato va GRANDE in alto, tutti
    // gli altri restano visibili più piccoli sotto, divisi equamente. Nessun pin →
    // griglia paritaria come prima. Scelta LOCALE del presentatore.
    const pinnedTiles = allTiles.filter((t) => pinned.includes(t.pid));
    const stripTiles = pinnedTiles.length ? allTiles.filter((t) => !pinned.includes(t.pid)) : [];
    const gridTiles = tiles;
    // (7) con teleprompter CHIUSO: camere IMPILATE in verticale (1 sopra, 1 sotto,
    // quadrati 1:1) in TUTTE le modalità. Con teleprompter aperto resta il flex-wrap.
    const stackVertical = !tele;
    if (pinnedTiles.length)
      return (
        <div
          className={`bg-brandfill relative ${fill ? "h-full" : h ? "" : "aspect-video"}`}
          style={h ? { height: h } : undefined}
        >
          <div className="absolute inset-0 flex flex-col gap-1 p-1">
            <div className="min-h-0 flex-[3]">
              <ParticipantsGrid tiles={pinnedTiles} fill className="h-full w-full" />
            </div>
            {stripTiles.length > 0 && (
              <div className="flex min-h-0 flex-1 gap-1">
                {stripTiles.map((t) => (
                  <div key={t.isLocal ? "local" : t.pid} className="min-w-0 flex-1">
                    <ParticipantsGrid tiles={[t]} fill className="h-full w-full" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    return (
      <div
        className={`bg-brandfill relative ${fill ? "h-full" : h ? "" : "aspect-video"}`}
        style={h ? { height: h } : undefined}
      >
        {/* Feature 5 — niente LogoWatermark: il badge del presentatore è già sulla sua tile (PresenterBadge) */}
        {/* (B) camere del pannello presentatore: flex-wrap, 1:1, saturano lo spazio disponibile */}
        <ParticipantsGrid
          tiles={gridTiles}
          fill
          variant={stackVertical ? undefined : "wrap"}
          className="absolute inset-0 p-1"
        />
        {gridTiles.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/45">
            In attesa…
          </div>
        )}
      </div>
    );
  };
  // opts: drag=trascinabile · pullOut=estrai dal teleprompter · redock=riaggancia · size=controlli larghezza flottante
  const camHeader = (
    opts: {
      drag?: boolean;
      pullOut?: boolean;
      redock?: boolean;
      size?: boolean;
      riduci?: boolean;
    } = {},
  ) => (
    <div
      className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold text-white/70 ${opts.drag ? "cursor-move" : ""}`}
      {...(opts.drag ? handlers : {})}
    >
      <span
        className={`h-2 w-2 rounded-full ${st.connected ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`}
      />
      <span className="truncate">
        {st.connected ? `In chiamata · ${st.roster.length + 1}` : st.diag || "Connessione…"}
      </span>
      <button
        onClick={(e) => openPeoplePop(e.currentTarget)}
        title="Partecipanti (fissa in evidenza · rimuovi · blocca)"
        className={`ml-auto rounded p-0.5 hover:bg-white/10 ${peoplePop || pinned.length ? "text-brand" : ""}`}
      >
        <Users className="h-3 w-3" />
      </button>
      {opts.pullOut && (
        <button
          onClick={() => setUndocked(true)}
          title="Estrai camera (finestra libera)"
          className="rounded p-0.5 hover:bg-white/10"
        >
          <ExternalLink className="h-3 w-3" />
        </button>
      )}
      {opts.redock && (
        <button
          onClick={() => setUndocked(false)}
          title="Riaggancia al teleprompter"
          className="rounded p-0.5 text-brand hover:bg-white/10"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
      {opts.size && (
        <>
          <button
            onClick={() => setSize((s) => Math.max(150, s - 40))}
            className="rounded p-0.5 hover:bg-white/10"
          >
            <Minus className="h-3 w-3" />
          </button>
          <button
            onClick={() => setSize((s) => Math.min(720, s + 40))}
            className="rounded p-0.5 hover:bg-white/10"
          >
            <Plus className="h-3 w-3" />
          </button>
        </>
      )}
      {opts.riduci && (
        <button
          onClick={() => setLato(true)}
          title="Riduci a lato: le camere tornano nella colonna e rivedi la pagina (il cliente non vede nessun cambiamento)"
          className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-white/10"
        >
          <Minimize2 className="h-3 w-3" />
          <span className="hidden sm:inline">Riduci a lato</span>
        </button>
      )}
      <button
        onClick={() => setCamClosed(true)}
        title="Chiudi le camere (le riapri dalla linguetta «Camere» sul bordo destro)"
        className="rounded p-0.5 hover:bg-white/10"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );

  // preview agganciata SOPRA il teleprompter (quando aperto e NON estratta), altezza regolabile
  const dockedCam =
    tele && !camClosed && !undocked ? (
      <div className="border-b border-white/10 bg-[#081226]">
        {camHeader({ pullOut: true })}
        {renderCam(dockH)}
        <ResizeHandle
          onResize={(_, dy) => setDockH((h) => Math.max(110, Math.min(500, h + dy)))}
          className="h-2 w-full cursor-ns-resize bg-white/10 hover:bg-brand/40"
        />
      </div>
    ) : null;

  // finestra flottante (usata quando la camera è estratta durante il teleprompter)
  const reserved =
    tele && typeof window !== "undefined" ? Math.min(window.innerWidth * 0.5, 560) : 0;
  const maxX = typeof window !== "undefined" ? window.innerWidth - reserved - size - 8 : pos.x;
  const px = Math.max(6, Math.min(pos.x, maxX));

  return (
    <>
      {tele && <TeleprompterOverlay onClose={() => setTele(false)} topSlot={dockedCam} />}

      {/* VIDEOCHIAMATA E BASTA: le camere si prendono la pagina (vedi `lato`) */}
      {chiamataPiena && (
        <div
          ref={riquadroCamere}
          style={{ top: barH }}
          className="fixed inset-x-0 bottom-0 z-[93] flex flex-col border-t border-white/10 bg-[#0a0f1c]/97 text-white backdrop-blur-md"
        >
          {camHeader({ riduci: true })}
          <div className="min-h-0 flex-1">{renderCam(undefined, true)}</div>
        </div>
      )}

      {/*  ── ⚠️ CHIUSA NON VUOL DIRE PERSA ───────────────────────────────
           Segnalazione del committente: «quando chiudo il pannello laterale
           della camera non c'è più modo di riaprirlo».
           Vero: la crocetta lo faceva sparire e il pulsante per riaverlo
           esisteva soltanto in fondo al menu «Strumenti», scritto «Camera» —
           cioè in un posto dove uno lo trova solo se già sa che c'è. Un
           comando che nasconde qualcosa deve lasciare a vista il modo di
           riprenderselo: qui resta una linguetta attaccata al bordo, nello
           stesso punto in cui il pannello stava.
           ⚠️ Vale anche col teleprompter aperto: lì la camera è agganciata
            sopra il copione, e chiudendola sparisce allo stesso modo. */}
      {camClosed && (
        <button
          type="button"
          onClick={() => setCamClosed(false)}
          title="Riapri le camere"
          /*  ⚠️ A METÀ ALTEZZA, NON IN CIMA: in alto a destra ci sono già la
              plancia «Cosa vede il cliente» e la barra, e una linguetta
              nascosta sotto un altro pannello sarebbe di nuovo un comando che
              non si trova. */
          className="fixed right-0 top-1/2 z-[94] flex -translate-y-1/2 items-center gap-1.5 rounded-l-xl border border-r-0 border-white/15 bg-[#0a0f1c]/95 py-3 pl-2.5 pr-2 text-[11px] font-semibold text-white/80 shadow-2xl backdrop-blur transition hover:bg-[#12203c] hover:text-white print:hidden"
        >
          <Video className="h-3.5 w-3.5 text-brand" />
          <span>Camere</span>
        </button>
      )}

      {/* FEATURE 4 — teleprompter CHIUSO: camera agganciata a DESTRA, altezza piena */}
      {!tele && !camClosed && !chiamataPiena && (
        <RightCameraDock
          riquadro={riquadroCamere}
          width={rightW}
          onResize={(dx) =>
            setRightW((w) =>
              Math.max(
                220,
                Math.min(typeof window !== "undefined" ? window.innerWidth - 220 : 700, w - dx),
              ),
            )
          }
        >
          {camHeader()}
          <div className="min-h-0 flex-1">{renderCam(undefined, true)}</div>
        </RightCameraDock>
      )}

      {/* FEATURE 5 — teleprompter APERTO + camera ESTRATTA: finestra flottante in basso */}
      {tele && !camClosed && undocked && (
        <div
          ref={riquadroCamere}
          style={{ left: px, top: pos.y, width: size }}
          className="fixed z-[97] touch-none overflow-hidden rounded-2xl border border-white/12 bg-[#081226]/95 shadow-2xl shadow-black/60 backdrop-blur"
        >
          {camHeader({ drag: true, redock: true, size: true })}
          {renderCam()}
          <ResizeHandle
            onResize={(dx) => setSize((s) => Math.max(150, Math.min(760, s + dx)))}
            className="absolute bottom-0 right-0 z-10 h-5 w-5 cursor-nwse-resize rounded-tl-md bg-white/25 hover:bg-brand/60"
          />
        </div>
      )}

      {/* PiP CONDIVISA — "specchio" della camera piccola che vede il cliente, nella
         stessa posizione relativa e trascinabile (si sposta anche da lui). */}
      <ContentPipMirror st={st} ls={ls} barH={barH} />

      {/* BARRA COMANDI IN ALTO (sotto l'header) — due righe IMPILATE a tutta larghezza:
         sopra il PRESENTATORE, sotto il CLIENTE, separate da un filo sottile. */}
      <div
        ref={barRef}
        style={{ top: 0, right: "var(--tp-right, 0px)" }}
        className="fixed left-0 z-[55] border-b border-white/10 bg-[#060e20]/97 px-2 py-1 text-white shadow-[0_8px_30px_rgba(0,0,0,.5)] backdrop-blur print:hidden"
      >
        <div className="flex w-full flex-col">
          {/* RIGA 2 — CLIENTE (sotto il presentatore, larghezza piena) — layout invariato:
             resta nel contenitore centrato max-w-6xl esattamente come prima. */}
          <div className="order-2 mx-auto mt-1 flex w-full min-w-0 max-w-6xl flex-col gap-1 border-t border-white/10 pt-1">
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand/90">
              <Users className="h-3 w-3" /> Sullo schermo di {st.guestName || "chi ti guarda"}
              <span className="flex items-center gap-1 font-normal normal-case tracking-normal text-white/45">
                in questo momento:{" "}
                <FgChk on={guestCam === "me"} icon={User} title="La tua camera" />
                <FgChk on={guestCam === "lui"} icon={Video} title="La sua camera" />
                <FgChk on={guestCam === "screen"} icon={MonitorUp} title="Il tuo schermo" />
              </span>
              <span className="ml-auto flex items-center gap-1">
                <ComandoCamereOspiti st={st} />
                <QSel value={st.guestQuality} onChange={setGuestQuality} />
              </span>
            </div>
            {/* ── COSA VEDE IL CLIENTE ──────────────────────────────────
                Quattro pulsanti sciolti sembravano quattro azioni diverse. Sono
                invece quattro stati della stessa cosa — che cosa c'è sul suo
                schermo in questo momento — quindi vanno in un selettore unico,
                dove è evidente che uno solo può essere attivo. */}
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-0.5 rounded-xl border border-white/12 bg-white/[0.04] p-0.5">
                <ModeBtn
                  active={st.mode === "content"}
                  onClick={() => hostSetMode("content")}
                  icon={Layout}
                  label="Contenuti"
                />
                <ModeBtn
                  active={st.mode === "call"}
                  onClick={() => hostSetMode("call")}
                  icon={Users}
                  label="Videochiamata"
                />
                <ModeBtn
                  active={st.mode === "presenter"}
                  onClick={() => hostSetMode("presenter")}
                  icon={User}
                  label="Solo io"
                />
                <div className="relative">
                  <ModeBtn
                    active={st.mode === "client"}
                    onClick={chooseClient}
                    icon={Video}
                    label={
                      st.mode === "client" && st.focusPid
                        ? `Solo ${guests.find((g) => g.pid === st.focusPid)?.name || "il cliente"}`
                        : "Solo il cliente"
                    }
                  />
                  {pickTarget && (
                    <div className="absolute left-0 top-full z-[99] mt-1 w-52 rounded-xl border border-white/12 bg-[#0b1730] p-1.5 shadow-2xl">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/45">
                        Mostra a schermo intero
                      </div>
                      {guests.map((g) => (
                        <button
                          key={g.pid}
                          onClick={() => {
                            hostSetMode("client", g.pid);
                            setPickTarget(false);
                          }}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] hover:bg-white/10 ${st.focusPid === g.pid ? "text-brand" : "text-white/85"}`}
                        >
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/20 text-brand">
                            <User className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1 truncate">{g.name}</span>
                          {st.focusPid === g.pid && <Check className="h-3.5 w-3.5" />}
                        </button>
                      ))}
                      <button
                        onClick={() => setPickTarget(false)}
                        className="mt-0.5 w-full rounded-lg px-2 py-1 text-left text-[11px] text-white/40 hover:bg-white/10"
                      >
                        Annulla
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {/* ── ⚠️ SCHERMO PIENO, SOLO PER TE ─────────────────────────
                  Richiesta del committente. Sta ACCANTO al selettore di cosa
                  vede il cliente e non dentro: quelli decidono che cosa c'è
                  sul SUO schermo, questo ingrandisce il TUO — e un pulsante
                  che sembra della stessa famiglia si preme credendo di
                  cambiare qualcosa anche di là.
                  L'etichetta dice per chi è, perché è la sola domanda che uno
                  si fa prima di premerlo davanti a un cliente. */}
              <button
                type="button"
                onClick={() => {
                  /*  ⚠️ SE LE CAMERE SONO CHIUSE, PRIMA SI RIAPRONO. Senza,
                      il riquadro da ingrandire non esiste e il pulsante
                      ingrandirebbe la pagina: di nuovo una cosa diversa da
                      quella scritta sopra. Il riquadro compare nello stesso
                      giro, quindi lo schermo pieno si chiede subito dopo —
                      sempre dentro il tocco, che è l'unico momento in cui il
                      browser lo concede. */
                  if (camClosed) {
                    setCamClosed(false);
                    setTimeout(() => schermo.commuta(), 0);
                    return;
                  }
                  schermo.commuta();
                }}
                title={
                  schermo.pieno
                    ? "Esci dallo schermo intero (vale solo per te)"
                    : "Ingrandisce le camere a tutto schermo: vale solo per te, il cliente non vede nessun cambiamento"
                }
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/[0.04] px-2 py-1.5 text-[10.5px] font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                {schermo.pieno ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{schermo.pieno ? "Esci" : "Camere grandi"}</span>
                <span className="text-white/35">· solo per te</span>
              </button>
              {/* Feature 3 — rimosso il toggle "grande io/lui": in "call" tutti i partecipanti
                 sono resi in griglia equa a tutto schermo (nessuna camera principale) */}
              {/* Feature 4 — mentre trasmetti i contenuti: quali camere piccole (PiP) vede il cliente */}
              {st.mode === "content" && (
                <div className="flex flex-wrap items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-1 py-0.5">
                  <span className="text-[9.5px] font-medium uppercase tracking-wide text-white/40">
                    Camerine
                  </span>
                  <button
                    onClick={() => hostSetContentCam({ showMine: !st.contentCam.showMine })}
                    title="Mostra la tua camera in piccolo sullo schermo del cliente"
                    className={`rounded px-2 py-1 text-[10.5px] font-medium ${st.contentCam.showMine ? "bg-brand text-white" : "text-white/70 hover:bg-white/10"}`}
                  >
                    la mia
                  </button>
                  <button
                    onClick={() => hostSetContentCam({ showGuest: !st.contentCam.showGuest })}
                    title="Mostra anche la camera del cliente sul suo schermo"
                    className={`rounded px-2 py-1 text-[10.5px] font-medium ${st.contentCam.showGuest ? "bg-brand text-white" : "text-white/70 hover:bg-white/10"}`}
                  >
                    del cliente
                  </button>
                  {/* Spegne le due camerine con un colpo solo: durante una
                      presentazione capita spesso di volere lo schermo pulito, e
                      farlo in due clic è un clic di troppo davanti al cliente. */}
                  {(st.contentCam.showMine || st.contentCam.showGuest) && (
                    <button
                      onClick={() => hostSetContentCam({ showMine: false, showGuest: false })}
                      title="Togli entrambe le camere: il cliente vede solo i contenuti"
                      className="ml-0.5 rounded p-1 text-white/50 transition hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGA 1 — TU (PRESENTATORE), in cima, a larghezza piena e ALLINEATA A SINISTRA
             (stesso ordine interno di prima, solo ancorata al bordo sinistro della barra) */}
          <div className="relative order-1 flex w-full min-w-0 flex-col items-start gap-1">
            <div className="flex w-full items-center justify-start gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
              <User className="h-3 w-3" /> Il tuo dispositivo <SpiaLinea linea={st.linea} />{" "}
              <span className="ml-auto">
                <QSel value={st.myQuality} onChange={setMyQuality} />
              </span>
            </div>
            {/* ── "IL CLIENTE NON TI SENTE" ────────────────────────────────
                Il microfono chiuso si vedeva solo dall'icona rossa, e in una
                barra piena di icone rosse e blu non salta all'occhio: si
                continua a parlare per minuti senza che dall'altra parte arrivi
                nulla. Con il push-to-talk attivo è ancora più facile — è muto
                di suo, e si apre solo tenendo premuto un tasto.
                Qui è scritto, e si rimedia da qui. */}
            {st.active && !st.micOn && !talking && (
              <div className="flex w-full items-center gap-2 rounded-lg border border-amber-400/45 bg-amber-500/15 px-2 py-1.5 text-[11px] font-medium leading-tight text-amber-100">
                <MicOff className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="min-w-0 flex-1">
                  {ptt
                    ? "Il cliente non ti sente: tieni premuto ⇧J mentre parli."
                    : "Il cliente non ti sente: il microfono è spento."}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (ptt) setPtt(false);
                    else toggleMic();
                  }}
                  className="flex-shrink-0 rounded-md border border-amber-300/50 bg-amber-400/20 px-2 py-1 text-[10.5px] font-semibold text-white transition hover:bg-amber-400/30"
                >
                  {ptt ? "Tieni aperto" : "Riapri"}
                </button>
              </div>
            )}
            {/* ── QUANDO LAGGA DAVVERO, LA COLPA SCRITTA PER ESTESO ────────
                La pastiglia accanto a «Il tuo dispositivo» dice CHI, ma la
                riga che dice cosa fare sta nel suggerimento del mouse — e
                nessuno passa il mouse sopra una pastiglia mentre parla con un
                cliente. Quando il guasto è grave la frase si apre qui, con lo
                stesso aspetto dell'avviso «il cliente non ti sente», che è il
                posto dove si guarda quando qualcosa non va. */}
            {st.active && <AvvisoLinea linea={st.linea} />}
            <div className="flex w-full flex-wrap items-center justify-start gap-1">
              {/* ── CAMERA: acceso/spento + scelta del dispositivo ─────────
                  La freccetta apre lo stesso tipo di pannello del microfono:
                  scegliere DA QUALE camera trasmettere è una cosa che serve
                  spesso quanto regolare il rumore, e prima non c'era. */}
              <div
                className="flex items-stretch overflow-hidden rounded-lg border transition-colors"
                style={{ borderColor: st.camOn ? "rgba(255,255,255,.12)" : "rgba(239,68,68,.4)" }}
              >
                <button
                  onClick={toggleCam}
                  title={
                    st.camOn ? "Camera attiva (scorciatoia: ⇧K)" : "Camera spenta (scorciatoia: ⇧K)"
                  }
                  className={`flex items-center gap-1 rounded-l-lg px-2 py-1.5 transition-colors ${st.camOn ? "bg-white/5" : "bg-red-500/10 text-red-300"}`}
                >
                  {st.camOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                </button>
                <button
                  onClick={(e) => {
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setCamMenu(
                      camMenu
                        ? null
                        : {
                            x: Math.max(8, Math.min(window.innerWidth - 310, r.left - 120)),
                            y: Math.max(8, r.top - 240),
                          },
                    );
                  }}
                  title="Impostazioni camera: quale camera usare e come ti vedi (specchio)"
                  className={`flex items-center rounded-r-lg border-l border-white/10 px-1 py-1.5 text-white/60 hover:bg-white/10 ${camMenu ? "bg-brand/30 text-white" : ""}`}
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              {camMenu && <CamMenu at={camMenu} onClose={() => setCamMenu(null)} />}
              {/*  ⚠️ IN CHIARO, NON DENTRO UN PANNELLO: «ancora non vedo il
                   pulsante per girare la camera». Stava dietro la freccetta
                   qui sopra, e nessuno apre un pannello mentre parla con un
                   cliente. */}
              <TastoGiraCamera />
              {/* Microfono — click breve = accendi/spegni · PRESSIONE LUNGA (o freccetta /
                 tasto destro) = menu audio: soppressione rumore + soglia di attivazione */}
              <div
                ref={micWrapRef}
                className="flex items-stretch overflow-hidden rounded-lg border transition-colors"
                style={{
                  borderColor: talking
                    ? "rgba(52,211,153,.9)"
                    : st.micOn
                      ? "rgba(255,255,255,.12)"
                      : "rgba(239,68,68,.4)",
                }}
              >
                <button
                  onPointerDown={micDown}
                  onPointerUp={micUp}
                  onPointerLeave={micUp}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    openAudioMenu();
                  }}
                  onClick={() => {
                    if (lpFired.current) {
                      lpFired.current = false;
                      return;
                    }
                    toggleMic();
                  }}
                  title={
                    ptt
                      ? "Push to talk attivo: tieni premuto ⇧J per parlare · tieni premuto il pulsante per le impostazioni audio"
                      : "Microfono (⇧J) · tieni premuto per le impostazioni audio"
                  }
                  className={`flex items-center gap-1 rounded-l-lg px-2 py-1.5 transition-colors ${
                    talking
                      ? "bg-emerald-500/30 text-white"
                      : st.micOn
                        ? "bg-white/5"
                        : "bg-red-500/10 text-red-300"
                  }`}
                >
                  {st.micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                  {talking && (
                    <span className="text-[10px] font-semibold uppercase tracking-wide">
                      in trasmissione
                    </span>
                  )}
                </button>
                <button
                  onClick={() => (audioMenu ? setAudioMenu(null) : openAudioMenu())}
                  title="Impostazioni audio (soppressione rumore, soglia di attivazione)"
                  className={`flex items-center rounded-r-lg border-l border-white/10 px-1 py-1.5 text-white/60 hover:bg-white/10 ${audioMenu ? "bg-brand/30 text-white" : ""}`}
                >
                  <ChevronDown className="h-3 w-3" />
                </button>
              </div>
              {audioMenu && <AudioMenu st={st} at={audioMenu} onClose={() => setAudioMenu(null)} />}
              <button
                onClick={() => shareScreen()}
                title="Trasmetti schermo"
                className={`rounded-lg border px-2 py-1.5 ${st.sharing ? "border-brand bg-brand/25 text-white" : "border-white/12 bg-white/5"}`}
              >
                <MonitorUp className="h-4 w-4" />
              </button>
              {/* interruzione esplicita: si torna alla videochiamata */}
              {st.sharing && (
                <button
                  onClick={() => void shareScreen()}
                  title="Interrompi la condivisione e torna alla videochiamata"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-400/50 bg-red-500/20 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-500/30"
                >
                  <MonitorUp className="h-3.5 w-3.5" /> Interrompi
                </button>
              )}
              {/* forma dell'inquadratura: lo schermo largo viene riquadrato per il
                  dispositivo del cliente, così non vede una striscia fra due bande nere */}
              {st.sharing && (
                <div
                  data-hg-noptr
                  className="flex items-center gap-0.5 rounded-lg border border-white/12 bg-white/5 p-0.5"
                >
                  {(
                    [
                      {
                        k: "auto",
                        icon: MonitorSmartphone,
                        t: st.guestViewport
                          ? `Come il cliente (${st.guestViewport.w}×${st.guestViewport.h})`
                          : "Come il cliente",
                      },
                      { k: "mobile", icon: Smartphone, t: "Telefono" },
                      { k: "tablet", icon: Tablet, t: "Tablet" },
                      { k: "desktop", icon: Monitor, t: "Computer" },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.k}
                      onClick={() => void setShareShape(o.k)}
                      title={o.t}
                      className={`rounded px-1.5 py-1 ${st.shareShape === o.k ? "bg-brand text-white" : "text-white/60 hover:bg-white/10"}`}
                    >
                      <o.icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              )}
              {/*  ── ⚠️ LA SFOCATURA TORNA IN BARRA ────────────────────────
                   Segnalazione del committente: «non trovo più l'opzione per
                   attivare la sfocatura dello sfondo».
                   Il comando c'è ed è dentro «Strumenti» — l'ho verificato
                   anche nel pezzo pubblicato, che contiene la scritta «Sfondo
                   sfocato» — ma un comando che si usa UNA VOLTA, all'inizio,
                   prima di farsi vedere, non può stare dietro a un menu: se
                   per trovarlo devi aprire un cassetto e leggere, mentre il
                   cliente ti guarda, è come se non ci fosse. Qui sta accanto
                   alla camera, che è la cosa di cui parla, e si accende con
                   un colpo. L'intensità resta in «Strumenti»: quella la
                   scegli una volta e non la tocchi più. */}
              {/*  ⚠️ E L'INTENSITÀ STA ACCANTO ALL'INTERRUTTORE, non dentro un
                   menu: richiesta del committente subito dopo aver ritrovato
                   il pulsante — «fai che posso regolare l'intensità». È la
                   stessa lezione di prima: un comando che si cerca mentre il
                   cliente ti guarda deve stare dove guardi, non dietro a una
                   voce da leggere. La freccetta apre i quattro gradini, come
                   fanno già camera e microfono qui di fianco. */}
              <div className="relative flex items-center">
                <div
                  data-hg-noptr
                  className={`flex items-center rounded-lg border ${st.blurOn ? "border-brand bg-brand/25 text-white" : "border-white/12 bg-white/5 text-white/70"}`}
                >
                  <button
                    onClick={() => void setBlurEnabled(!st.blurOn)}
                    title={
                      !st.blurOn
                        ? "Sfoca lo sfondo (tu resti nitido, lo sfondo si sfoca per il cliente)"
                        : st.blurSeg
                          ? `Sfondo sfocato ATTIVO (${NOMI_SFOCATURA[st.blurLevel].toLowerCase()}) con riconoscimento persona — clicca per spegnere`
                          : "Sfondo sfocato ATTIVO: sfocatura piena (il riconoscimento persona sta arrivando o non è disponibile) — clicca per spegnere"
                    }
                    className="flex items-center gap-1 rounded-l-lg px-2 py-1.5"
                  >
                    <Sparkles className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setSfoMenu((v) => !v)}
                    title="Quanto sfocare lo sfondo"
                    className={`flex items-center rounded-r-lg border-l px-1 py-1.5 ${st.blurOn ? "border-white/20" : "border-white/10"} ${sfoMenu ? "bg-brand/40 text-white" : "opacity-70 hover:opacity-100"}`}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>
                {sfoMenu && (
                  <>
                    <div className="fixed inset-0 z-[54]" onClick={() => setSfoMenu(false)} />
                    <div className="absolute left-0 top-full z-[56] mt-1.5 w-[210px] rounded-xl border border-white/15 bg-[#0b1730] p-1.5 shadow-2xl">
                      <div className="px-2 py-1 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/35">
                        Quanto sfocare
                      </div>
                      {([1, 2, 3, 4] as const).map((n) => (
                        <button
                          key={n}
                          onClick={() => {
                            setBlurLevel(n);
                            //  Regolare l'intensità è anche il modo più naturale
                            //  di accenderla: se è spenta, si accende.
                            if (!st.blurOn) void setBlurEnabled(true);
                            setSfoMenu(false);
                          }}
                          className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[11.5px] ${st.blurLevel === n ? "bg-brand/30 text-white" : "text-white/75 hover:bg-white/10"}`}
                        >
                          <span
                            className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                            style={{ background: "#7aa2ff", filter: `blur(${n * 0.9}px)` }}
                          />
                          {NOMI_SFOCATURA[n]}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <RecButton recording={st.recording} armed={st.autoRecArmed} screen={st.recScreen} />
              {/* ── ALTRI STRUMENTI ─────────────────────────────────────
                  Otto comandi in fila hanno tutti lo stesso peso visivo, e
                  durante una consulenza si cerca quello giusto guardandoli a
                  uno a uno. In barra restano camera, microfono, condivisione e
                  registrazione — quello che si usa davvero mentre parli. Il
                  resto sta qui dentro, con il nome scritto per esteso. */}
              <div className="relative">
                <button
                  onClick={() => setPiu((v) => !v)}
                  title="Altri strumenti"
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                    piu
                      ? "border-brand bg-brand/25 text-white"
                      : "border-white/12 bg-white/5 text-white/75 hover:bg-white/10"
                  }`}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Strumenti
                  <ChevronDown
                    className={`h-3 w-3 opacity-60 transition-transform ${piu ? "rotate-180" : ""}`}
                  />
                </button>
                {piu && (
                  <>
                    <div className="fixed inset-0 z-[54]" onClick={() => setPiu(false)} />
                    <div className="absolute left-0 top-full z-[56] mt-1.5 w-[260px] rounded-xl border border-white/15 bg-[#0b1730] p-1.5 shadow-2xl">
                      <div className="px-2 py-1 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-white/35">
                        Altri strumenti
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {/* Toggle PUSH-TO-TALK (memorizzato in localStorage) */}
                        <button
                          onClick={() => setPtt((v) => !v)}
                          title={
                            ptt
                              ? "Attivo: il microfono resta chiuso e si apre solo tenendo premuto ⇧J"
                              : "Attivalo per parlare solo mentre tieni premuto ⇧J"
                          }
                          className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-medium ${ptt ? "border-brand bg-brand/25 text-white" : "border-white/12 bg-white/5 text-white/70"}`}
                        >
                          <Mic className="h-3.5 w-3.5" /> Premi per parlare
                          <kbd className="ml-0.5 rounded border border-white/20 bg-white/10 px-1 text-[9px] leading-4">
                            ⇧J
                          </kbd>
                        </button>
                        {/* SFOCATURA SFONDO — un click ON/OFF + intensità (ricordata) */}
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => void setBlurEnabled(!st.blurOn)}
                            title={
                              !st.blurOn
                                ? "Sfoca sfondo (tu resti nitido, lo sfondo si sfoca per il cliente)"
                                : st.blurSeg
                                  ? "Sfoca sfondo: ATTIVA con riconoscimento persona (tu resti nitido) — clicca per disattivare"
                                  : "Sfoca sfondo: ATTIVA in modalità semplice — il riconoscimento persona non è disponibile (modello non caricato: rete/CDN bloccata), viene sfocata tutta l'inquadratura"
                            }
                            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-medium ${st.blurOn ? "border-brand bg-brand/25 text-white" : "border-white/12 bg-white/5 text-white/70"}`}
                          >
                            <Sparkles className="h-4 w-4" /> Sfondo sfocato
                          </button>
                          {st.blurOn && (
                            <div className="flex items-center gap-0.5 rounded-md border border-white/10 bg-white/[0.03] px-1 py-0.5">
                              {([1, 2, 3, 4] as const).map((n) => (
                                <button
                                  key={n}
                                  onClick={() => setBlurLevel(n)}
                                  title={`Sfocatura ${NOMI_SFOCATURA[n].toLowerCase()}`}
                                  className={`rounded px-1.5 py-1 text-[10px] font-medium ${st.blurLevel === n ? "bg-brand text-white" : "text-white/70 hover:bg-white/10"}`}
                                >
                                  {NOMI_SFOCATURA[n]}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* Feature 4/Bug 5 — toggle ON/OFF "camera di chi parla": attivo mentre condividi lo
                 schermo E durante le presentazioni di contenuti (mode "content"), guida il PiP del guest */}
                        {(st.sharing || st.mode === "content") && (
                          <button
                            onClick={() => hostSetSpeakerPip(!st.speakerPip)}
                            title={
                              st.speakerPip
                                ? "Attivo: la camerina del cliente segue chi sta parlando"
                                : "La camerina del cliente segue automaticamente chi parla"
                            }
                            className={`flex items-center gap-1 rounded-lg border px-2 py-1.5 text-[10px] font-medium ${st.speakerPip ? "border-brand bg-brand/25 text-white" : "border-white/12 bg-white/5"}`}
                          >
                            <Mic className="h-3.5 w-3.5" /> Segui chi parla
                          </button>
                        )}
                        <div className="relative">
                          <button
                            onClick={() => setDl((v) => !v)}
                            title="Scarica trascrizione PDF"
                            className="rounded-lg border border-white/12 bg-white/5 px-2 py-1.5"
                          >
                            <FileDown className="h-4 w-4" />
                          </button>
                          {dl && (
                            <div className="absolute top-full right-0 mt-1 w-48 rounded-lg border border-white/12 bg-[#0b1730] p-1 shadow-xl">
                              <button
                                onClick={() => {
                                  exportTranscriptPDF("both");
                                  setDl(false);
                                }}
                                className="block w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-white/10"
                              >
                                PDF — conversazione completa
                              </button>
                              <button
                                onClick={() => {
                                  exportTranscriptPDF("me");
                                  setDl(false);
                                }}
                                className="block w-full rounded px-2 py-1.5 text-left text-[11px] hover:bg-white/10"
                              >
                                PDF — solo le tue parole
                              </button>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => setTele((v) => !v)}
                          title="Teleprompter"
                          className={`rounded-lg border px-2 py-1.5 ${tele ? "border-brand bg-brand/25 text-white" : "border-white/12 bg-white/5"}`}
                        >
                          <ScrollText className="h-4 w-4" />
                        </button>
                        {/* Feature 5 — chat privata con un ospite (roster) */}
                        {st.roster.length >= 1 && (
                          <HostChat
                            st={st}
                            peerPid={chatPeer}
                            onPick={setChatPeer}
                            pinned={pinned}
                            onTogglePin={togglePin}
                          />
                        )}
                        {camClosed && (
                          <button
                            onClick={() => setCamClosed(false)}
                            title="Mostra camera"
                            className="rounded-lg border border-white/12 bg-white/5 px-2 py-1.5 text-[10px]"
                          >
                            Camera
                          </button>
                        )}{" "}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* "Termina" resta SOLO nella barra presentatore in basso (niente doppione qui) */}
            </div>
          </div>
        </div>
      </div>
      {/* POPUP PARTECIPANTI (icona persone nell'header camere) — in portale */}
      {peoplePop && (
        <PeoplePopover at={peoplePop} onClose={() => setPeoplePop(null)}>
          <ParticipantsPanel
            st={st}
            pinned={pinned}
            onTogglePin={togglePin}
            footer={
              <button
                onClick={() => setShowMine((v) => !v)}
                className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-white/10 px-2 py-1.5 text-[11px] text-white/60 hover:bg-white/5"
              >
                <Users className={`h-3.5 w-3.5 ${showMine ? "text-brand" : ""}`} />
                {showMine
                  ? "Nascondi la mia camera dalla griglia"
                  : "Mostra la mia camera nella griglia"}
              </button>
            }
          />
        </PeoplePopover>
      )}
    </>
  );
}

// Contenitore del popup Partecipanti: portale sul body, z-index altissimo,
// chiusura con clic fuori o Esc. Stile coerente con gli altri popover presentatore.
function PeoplePopover({
  at,
  onClose,
  children,
}: {
  at: { x: number; y: number };
  onClose: () => void;
  children: React.ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const t = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={boxRef}
      style={{ position: "fixed", left: at.x, top: at.y, width: 288 }}
      className="z-[2147483000] max-h-[70vh] overflow-y-auto rounded-xl border border-white/12 bg-[#0b1730] p-1.5 text-white shadow-2xl"
    >
      {children}
    </div>,
    document.body,
  );
}

// ── MENU AUDIO DEL MICROFONO (stile Zoom) ─────────────────────────────────
//  Renderizzato in PORTALE sul body: nessun contenitore può ritagliarlo.
//  Contiene: soppressione rumore, soglia di attivazione con misuratore live e
//  preset rapidi. Ogni modifica è immediata e viene salvata per il presentatore.
const dbToPct = (db: number) => Math.max(0, Math.min(100, ((db + 80) / 80) * 100)); // scala −80…0 dBFS

/** ── SCEGLI IL DISPOSITIVO ──────────────────────────────────────────────────
 *  Elenco a tendina dei microfoni (o delle camere) collegati. Sta dentro lo
 *  stesso pannello delle altre impostazioni, con lo stesso aspetto: una riga
 *  per dispositivo, quello in uso segnato con la spunta.
 *  I nomi compaiono solo dopo che il permesso è stato dato — prima il browser
 *  li tiene nascosti — e per questo l'elenco si rilegge a ogni apertura. */
function SceltaDispositivo({
  tipo,
  valore,
  onScegli,
}: {
  tipo: "mic" | "cam";
  valore: string;
  onScegli: (id: string) => void;
}) {
  const [lista, setLista] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    let vivo = true;
    const carica = () => {
      void elencaDispositivi().then((d) => {
        if (vivo) setLista(tipo === "mic" ? d.mic : d.cam);
      });
    };
    carica();
    //  Cuffie collegate o staccate mentre il pannello è aperto: l'elenco segue.
    try {
      navigator.mediaDevices?.addEventListener?.("devicechange", carica);
    } catch {
      /* */
    }
    return () => {
      vivo = false;
      try {
        navigator.mediaDevices?.removeEventListener?.("devicechange", carica);
      } catch {
        /* */
      }
    };
  }, [tipo]);
  const etichetta = (d: MediaDeviceInfo, i: number) =>
    d.label || (tipo === "mic" ? `Microfono ${i + 1}` : `Camera ${i + 1}`);
  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
      <div className="mb-1.5 flex items-center gap-2">
        {tipo === "mic" ? (
          <Mic className="h-3.5 w-3.5 text-brand" />
        ) : (
          <Video className="h-3.5 w-3.5 text-brand" />
        )}
        <div className="text-[12px] font-semibold">{tipo === "mic" ? "Microfono" : "Camera"}</div>
      </div>
      <div className="max-h-40 space-y-1 overflow-y-auto">
        <button
          onClick={() => onScegli("")}
          className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[11.5px] transition ${
            !valore
              ? "border-brand bg-brand/20 text-white"
              : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/10"
          }`}
        >
          <span className="min-w-0 flex-1 truncate">Predefinito del sistema</span>
          {!valore && <Check className="h-3.5 w-3.5 shrink-0 text-brand" />}
        </button>
        {lista.map((d, i) => (
          <button
            key={d.deviceId || i}
            onClick={() => onScegli(d.deviceId)}
            className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[11.5px] transition ${
              valore === d.deviceId
                ? "border-brand bg-brand/20 text-white"
                : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/10"
            }`}
          >
            <span className="min-w-0 flex-1 truncate">{etichetta(d, i)}</span>
            {valore === d.deviceId && <Check className="h-3.5 w-3.5 shrink-0 text-brand" />}
          </button>
        ))}
        {!lista.length && (
          <p className="px-1 py-1 text-[10.5px] leading-snug text-white/40">
            Nessun dispositivo rilevato. I nomi compaiono dopo aver dato il permesso.
          </p>
        )}
      </div>
    </div>
  );
}

/** ── LE CAMERE DI QUESTO DISPOSITIVO ──────────────────────────────────────
 *  ⚠️ SI RILEGGE QUANDO CAMBIANO: una webcam attaccata (o il permesso dato un
 *   momento dopo, che è quando compaiono i NOMI) non deve lasciare il pulsante
 *   spento per tutta la consulenza. */
function useCamereDelDispositivo(): { id: string; nome?: string }[] {
  const [camere, setCamere] = useState<{ id: string; nome?: string }[]>([]);
  useEffect(() => {
    let vivo = true;
    const leggi = () =>
      void elencaDispositivi().then(({ cam }) => {
        if (vivo) setCamere(cam.map((d) => ({ id: d.deviceId, nome: d.label })));
      });
    leggi();
    const md = typeof navigator !== "undefined" ? navigator.mediaDevices : null;
    try {
      md?.addEventListener?.("devicechange", leggi);
    } catch {
      /* */
    }
    return () => {
      vivo = false;
      try {
        md?.removeEventListener?.("devicechange", leggi);
      } catch {
        /* */
      }
    };
  }, []);
  return camere;
}

/** ── IL TASTO «GIRA LA CAMERA», IN CHIARO ─────────────────────────────────
 *
 *  Segnalazione del committente: «ancora non vedo il pulsante per girare la
 *  camera». Era vero: stava SOLO dentro il pannello delle impostazioni della
 *  camera, dietro una freccetta che nessuno apre mentre ha un cliente davanti.
 *  Un comando che esiste ma non si vede è un comando che non c'è.
 *
 *  Adesso è un tasto come gli altri: nella barra, accanto a camera e
 *  microfono, e sullo schermo dell'ospite come tasto tondo in basso a
 *  sinistra — perché anche lui deve poter girare la sua camera da solo
 *  («fammi vedere dietro» lo fa chi tiene il telefono).
 *
 *  ⚠️ COMPARE SOLO SE C'È DAVVERO UN'ALTRA CAMERA. Su un computer fisso con
 *   una webcam sola sarebbe un tasto che non fa niente: nella barra resta
 *   spento con il perché scritto (chi lo cerca lo trova), sullo schermo
 *   dell'ospite non compare affatto — lì ogni pixel coperto è la faccia del
 *   cliente. */
function TastoGiraCamera({ fluttuante }: { fluttuante?: boolean }) {
  const camere = useCamereDelDispositivo();
  const [giro, setGiro] = useState(false);
  const [guaio, setGuaio] = useState("");
  const sipuo = siPuoGirare(camere);
  if (fluttuante && !sipuo) return null;
  const premi = () => {
    if (giro) return;
    setGiro(true);
    setGuaio("");
    void giraCamera().then((e) => {
      setGiro(false);
      setGuaio(e.ok ? "" : e.motivo || "non si è girata");
    });
  };
  const titolo = sipuo
    ? "Gira la camera: passa da quella davanti a quella dietro"
    : "Questo dispositivo ha una camera sola: non c'è niente da girare";
  if (fluttuante)
    return (
      <>
        <button
          type="button"
          onClick={premi}
          title={titolo}
          className="fixed bottom-4 left-4 z-[98] flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[#0b1730]/90 text-white shadow-2xl shadow-black/40 backdrop-blur transition hover:bg-[#0b1730] active:scale-95"
        >
          <SwitchCamera className={`h-6 w-6 ${giro ? "animate-pulse" : ""}`} />
        </button>
        {guaio && (
          <p className="fixed bottom-20 left-4 z-[98] max-w-[60vw] rounded-lg border border-amber-400/40 bg-[#1a1406]/95 px-2.5 py-1.5 text-[11px] leading-snug text-amber-100 shadow-xl">
            {guaio}
          </p>
        )}
      </>
    );
  return (
    <button
      type="button"
      onClick={premi}
      disabled={!sipuo || giro}
      title={guaio || titolo}
      className={`rounded-lg border px-2 py-1.5 transition-colors ${
        guaio
          ? "border-amber-400/50 bg-amber-500/15 text-amber-200"
          : sipuo
            ? "border-white/12 bg-white/5 text-white hover:bg-white/10"
            : "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/30"
      }`}
    >
      <SwitchCamera className={`h-4 w-4 ${giro ? "animate-pulse" : ""}`} />
    </button>
  );
}

/** ── IL PULSANTE «GIRA LA CAMERA» ─────────────────────────────────────────
 *  Un tocco: passa all'altra camera del dispositivo (davanti ⇄ dietro). Con
 *  una camera sola resta spento e scrive perché, invece di non fare niente. */
function GiraLaMiaCamera({
  camere,
  onGirata,
}: {
  camere: { id: string; nome?: string }[];
  onGirata?: (id: string) => void;
}) {
  const [giro, setGiro] = useState(false);
  const [guaio, setGuaio] = useState("");
  const sipuo = siPuoGirare(camere);
  return (
    <div className="mb-2">
      <button
        type="button"
        disabled={!sipuo || giro}
        onClick={() => {
          setGiro(true);
          setGuaio("");
          void giraCamera().then((e) => {
            setGiro(false);
            if (e.ok) onGirata?.(getCamDeviceId());
            else setGuaio(e.motivo || "non si è girata");
          });
        }}
        className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-[12.5px] font-semibold transition ${
          sipuo
            ? "border-brand/40 bg-brand/15 text-white hover:bg-brand/25"
            : "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/40"
        }`}
      >
        <SwitchCamera className={`h-4 w-4 shrink-0 ${giro ? "animate-pulse" : ""}`} />
        <span className="min-w-0 flex-1">
          Gira la camera
          <span className="block text-[10.5px] font-normal text-white/50">
            {sipuo
              ? "Passa all'altra camera del dispositivo: davanti ⇄ dietro."
              : "Questo dispositivo ha una camera sola: non c'è niente da girare."}
          </span>
        </span>
      </button>
      {guaio && <p className="mt-1 px-0.5 text-[10.5px] leading-snug text-amber-300/90">{guaio}</p>}
    </div>
  );
}

/** Pannello della camera: scelta del dispositivo e sfocatura, allo stesso posto
 *  in cui per il microfono ci sono soglia e soppressione del rumore. */
function CamMenu({ at, onClose }: { at: { x: number; y: number }; onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [dev, setDev] = useState(getCamDeviceId());
  //  Quante camere ci sono davvero: serve a sapere se «gira» ha senso.
  const [camere, setCamere] = useState<{ id: string; nome?: string }[]>([]);
  useEffect(() => {
    let vivo = true;
    void elencaDispositivi().then(({ cam }) => {
      if (vivo) setCamere(cam.map((d) => ({ id: d.deviceId, nome: d.label })));
    });
    return () => {
      vivo = false;
    };
  }, []);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={boxRef}
      style={{ left: at.x, top: at.y }}
      className="fixed z-[140] w-[300px] rounded-2xl border border-white/12 bg-[#0b1730] p-3 text-white shadow-2xl shadow-black/60"
    >
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-white/55">
        <Video className="h-3.5 w-3.5" /> Impostazioni camera
        <button
          onClick={onClose}
          className="ml-auto rounded p-0.5 text-white/40 hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {/*  ── ⚠️ GIRARE LA CAMERA È UN TOCCO, NON UN ELENCO ────────────────
           Richiesta del committente: «fai che posso ruotarla, ora non c'è».
           Scegliere il dispositivo da una tendina c'era già, ma su un telefono
           — e con un cliente davanti — nessuno apre una tendina per passare
           alla camera di dietro. Il pulsante sta in cima, prima dell'elenco,
           perché è la cosa che si fa; l'elenco resta per il caso raro (due
           webcam su un computer fisso).
           ⚠️ Con una camera sola il pulsante è SPENTO e dice perché. */}
      <GiraLaMiaCamera camere={camere} onGirata={setDev} />
      <SceltaDispositivo
        tipo="cam"
        valore={dev}
        onScegli={(id) => {
          setDev(id);
          void setCamDevice(id);
        }}
      />
      <p className="mt-2 px-0.5 text-[10.5px] leading-snug text-white/40">
        Il cambio è immediato: chi ti guarda vede la camera nuova senza uscire dalla consulenza.
      </p>
      <SpecchioSwitch />
    </div>,
    document.body,
  );
}

/** ── SPECCHIA LA MIA IMMAGINE ─────────────────────────────────────────────
 *  Interruttore di sola visione, ricordato su questo dispositivo. Sta nelle
 *  impostazioni della camera perché è lì che si va quando qualcosa nella
 *  propria inquadratura non torna. Il testo dice l'unica cosa che conta
 *  davvero: NON cambia come ti vedono gli altri. */
function SpecchioSwitch() {
  const st = useCall();
  const on = st.specchio;
  return (
    <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
      <button
        type="button"
        onClick={() => setSpecchio(!on)}
        role="switch"
        aria-checked={on}
        title={
          on
            ? "Ora ti vedi come allo specchio. Clicca per vederti come ti vedono gli altri."
            : "Ora ti vedi come ti vedono gli altri. Clicca per vederti come allo specchio."
        }
        className="flex w-full items-center gap-2.5 text-left"
      >
        <FlipHorizontal className={`h-4 w-4 shrink-0 ${on ? "text-brand" : "text-white/45"}`} />
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] font-semibold leading-tight">
            Specchia la mia immagine
          </span>
          <span className="block text-[10.5px] leading-snug text-white/45">
            {on ? "Ti vedi come allo specchio" : "Ti vedi come ti vedono gli altri"}
          </span>
        </span>
        {/* interruttore: acceso/spento leggibile anche senza colore, dalla posizione */}
        <span
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-brand" : "bg-white/15"}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[1.125rem]" : "left-0.5"}`}
          />
        </span>
      </button>
      <p className="mt-1.5 text-[10.5px] leading-snug text-white/40">
        Riguarda solo il tuo schermo: chi ti guarda continua a vederti dritto, così le scritte che
        mostri in camera restano leggibili.
      </p>
    </div>
  );
}

function AudioMenu({
  st,
  at,
  onClose,
}: {
  st: State;
  at: { x: number; y: number };
  onClose: () => void;
}) {
  const a = st.audio;
  const [lvl, setLvl] = useState(-100);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  // misuratore live: 20 letture/s, sufficienti a "vedere" la voce senza pesare
  useEffect(() => {
    // 10 letture/s e aggiornamento SOLO al cambio reale: 20 setState/s durante la
    // chiamata rirenderizzavano il pannello e potevano rallentare il compositor.
    const id = setInterval(() => {
      const v = Math.round(getMicLevelDb());
      setLvl((old) => (Math.round(old) === v ? old : v));
      setOpen((old) => {
        const n = isMicGateOpen();
        return old === n ? old : n;
      });
    }, 100);
    return () => clearInterval(id);
  }, []);
  // chiusura: clic fuori o Esc
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);
  if (typeof document === "undefined") return null;

  const live = isMicPipelineLive();
  const preset = (p: Exclude<AudioPreset, "custom">) =>
    setAudioPrefs({ preset: p, gateDb: AUDIO_PRESET_DB[p], gate: true });

  return createPortal(
    <div
      ref={boxRef}
      style={{ left: at.x, top: at.y }}
      className="fixed z-[140] w-[300px] rounded-2xl border border-white/12 bg-[#0b1730] p-3 text-white shadow-2xl shadow-black/60"
    >
      <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-white/55">
        <SlidersHorizontal className="h-3.5 w-3.5" /> Impostazioni audio
        <button
          onClick={onClose}
          className="ml-auto rounded p-0.5 text-white/40 hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <SceltaDispositivo
        tipo="mic"
        valore={getMicDeviceId()}
        onScegli={(id) => {
          void setMicDevice(id);
        }}
      />

      {/* Soppressione rumore di fondo */}
      <button
        onClick={() => setAudioPrefs({ ns: !a.ns })}
        className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-left hover:bg-white/[0.08]"
      >
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold">Soppressione rumore di fondo</div>
          <div className="text-[10px] leading-tight text-white/45">
            Filtro del browser: ventole, tastiera, brusio
          </div>
        </div>
        <span
          className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${a.ns ? "bg-brand" : "bg-white/15"}`}
        >
          <span
            className={`h-4 w-4 rounded-full bg-white transition-transform ${a.ns ? "translate-x-4" : ""}`}
          />
        </span>
      </button>

      {/* Soglia di attivazione */}
      <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold">Soglia di attivazione</div>
            <div className="text-[10px] leading-tight text-white/45">
              Sotto questo livello il microfono resta chiuso
            </div>
          </div>
          <button
            onClick={() => setAudioPrefs({ gate: !a.gate })}
            className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${a.gate ? "bg-brand" : "bg-white/15"}`}
          >
            <span
              className={`h-4 w-4 rounded-full bg-white transition-transform ${a.gate ? "translate-x-4" : ""}`}
            />
          </button>
        </div>

        {/* misuratore live con la soglia marcata */}
        <div className="relative mt-2.5 h-3 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10">
          <div
            className={`h-full transition-[width] duration-75 ${open ? "bg-emerald-400" : "bg-white/30"}`}
            style={{ width: `${dbToPct(lvl)}%` }}
          />
          {a.gate && (
            <div
              className="absolute top-0 h-full w-[2px] bg-amber-300"
              style={{ left: `${dbToPct(a.gateDb)}%` }}
            />
          )}
        </div>
        <div className="mt-1 flex items-center justify-between text-[9px] text-white/40">
          <span>−80 dB</span>
          <span
            className={live ? (open ? "text-emerald-300" : "text-white/50") : "text-amber-300/80"}
          >
            {live ? (open ? "in trasmissione" : "silenzio") : "microfono chiuso"}
          </span>
          <span>0 dB</span>
        </div>

        <input
          type="range"
          min={-60}
          max={-20}
          step={1}
          value={a.gateDb}
          disabled={!a.gate}
          onChange={(e) => setAudioPrefs({ gateDb: Number(e.target.value), preset: "custom" })}
          className="mt-2 w-full accent-[#f59e0b] disabled:opacity-40"
        />
        <div className="text-center text-[10px] font-semibold text-white/70">{a.gateDb} dB</div>

        <div className="mt-2 grid grid-cols-3 gap-1">
          {(
            [
              ["consigliata", "Consigliata"],
              ["rumoroso", "Ambiente rumoroso"],
              ["sensibile", "Sensibile"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => preset(k)}
              className={`rounded-lg px-1 py-1.5 text-[9.5px] font-medium leading-tight ${a.preset === k ? "bg-brand text-white" : "bg-white/5 text-white/65 hover:bg-white/10"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 text-[9.5px] leading-tight text-white/35">
        Parla normalmente e regola la soglia finché la barra supera il segno giallo solo quando
        parli.
      </div>
    </div>,
    document.body,
  );
}

// FEATURE 4 — camera agganciata a destra a tutta altezza (teleprompter chiuso).
// Riserva lo spazio a destra come fa il teleprompter (--tp-right + padding-right).
function RightCameraDock({
  width,
  onResize,
  children,
  riquadro,
}: {
  width: number;
  onResize: (dx: number) => void;
  children: ReactNode;
  riquadro?: { current: HTMLDivElement | null };
}) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const w = width + "px";
    document.documentElement.style.setProperty("--tp-right", w);
    document.body.style.transition = "padding-right .2s";
    document.body.style.paddingRight = w;
    return () => {
      document.documentElement.style.removeProperty("--tp-right");
      document.body.style.paddingRight = "";
    };
  }, [width]);
  return (
    <div
      ref={riquadro}
      style={{ width }}
      className="fixed right-0 top-0 z-[93] flex h-screen flex-col border-l border-white/10 bg-[#0a0f1c]/97 text-white shadow-2xl backdrop-blur-md"
    >
      {children}
      <ResizeHandle
        onResize={(dx) => onResize(dx)}
        className="absolute left-0 top-0 z-10 h-full w-2 cursor-ew-resize bg-white/10 hover:bg-brand/40"
      />
    </div>
  );
}

function ResizeHandle({
  onResize,
  className,
}: {
  onResize: (dx: number, dy: number) => void;
  className: string;
}) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      onPointerDown={(e) => {
        e.stopPropagation();
        start.current = { x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        onResize(e.clientX - start.current.x, e.clientY - start.current.y);
        start.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerUp={() => {
        start.current = null;
      }}
      className={`touch-none ${className}`}
    />
  );
}

/** ── COM'È MESSA LA LINEA, IN DUE PAROLE ───────────────────────────────────
 *  Il programma misurava già tutto questo, ma finiva solo in console — e
 *  davanti a una consulenza che si impunta nessuno apre la console. Qui sta
 *  accanto alla qualità, dove si prende la decisione.
 *
 *  Le soglie non sono estetica: 1,6 Mbit è quello che chiede una camera in
 *  «Alta» (vedi `listinoVideo`). Sopra il doppio ci stanno comode DUE
 *  trasmissioni insieme — è la risposta alla domanda «possiamo stare
 *  entrambi su Alta?», scritta mentre la si fa. */
function SpiaLinea({ linea }: { linea: State["linea"] }) {
  if (!linea || linea.kbit <= 0) return null;
  const mbit = linea.kbit / 1000;
  const larga = mbit >= 3.4; // due volte una camera in Alta, col respiro
  const stretta = mbit < 1.6; // non regge nemmeno una camera in Alta
  const colore = stretta ? "text-red-300" : larga ? "text-emerald-300/90" : "text-amber-300/90";
  const perche = stretta
    ? "La linea non regge una camera in Alta: metti Media, o passa al cavo."
    : larga
      ? "C'è banda per due trasmissioni in Alta insieme."
      : "Basta per una trasmissione in Alta; in due conviene Media.";
  const limite =
    linea.limite === "cpu"
      ? " · a frenare è il computer, non la linea (prova a spegnere lo sfondo sfocato)"
      : linea.limite === "rete"
        ? " · a frenare è la rete"
        : "";
  //  ⚠️ DI CHI È LA COLPA, DETTO IN CHIARO. Il giudizio non si scrive qui: sta
  //   in `shop/diagnosi-linea`, che è codice puro e provato riga per riga. Qui
  //   si disegna soltanto quello che ha deciso — e si disegna SOLO se ha
  //   trovato qualcosa: quando la linea è a posto la spia resta quella di
  //   prima, perché un avviso sempre accesso è un avviso che non si legge.
  const d = diagnosiLinea(linea);
  const accusa = d.chi === "nessuno" ? null : d;
  const tintaAccusa =
    d.tono === "grave"
      ? "border-red-400/40 bg-red-500/15 text-red-200"
      : "border-amber-400/35 bg-amber-500/12 text-amber-200";
  const numeri = [
    `salita ${mbit.toFixed(1)} Mbit/s`,
    linea.rttMs > 0 ? `ritardo ${linea.rttMs} ms` : "",
    linea.persiSu > 0 ? `persi in salita ${percento(linea.persiSu)}` : "",
    linea.persiGiu > 0 ? `persi in discesa ${percento(linea.persiGiu)}` : "",
    linea.ponte ? "passa da un ponte" : "collegamento diretto",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <span
        title={`Salita misurata adesso: ${mbit.toFixed(1)} Mbit al secondo. ${perche}${limite}${linea.ponte ? " · il video passa da un server d'appoggio: se puoi, cambia rete." : ""}`}
        className={`inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[9.5px] font-semibold normal-case tracking-normal tabular-nums ${colore}`}
      >
        <Activity className="h-3 w-3" />
        {mbit.toFixed(1)} Mb
        {linea.ponte && <span className="text-white/45">· ponte</span>}
      </span>
      {accusa && (
        <span
          title={`${accusa.cosa}\n\nMisure di adesso: ${numeri}.`}
          className={`inline-flex max-w-[16rem] items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-[9.5px] font-semibold normal-case tracking-normal ${tintaAccusa}`}
        >
          <AlertTriangle className="h-3 w-3 shrink-0" />
          {accusa.titolo}
        </span>
      )}
    </>
  );
}
/** ── L'AVVISO LARGO: CHI STA RALLENTANDO E COSA FARE ───────────────────────
 *  Si apre SOLO sui guasti gravi (vedi `tono` in shop/diagnosi-linea): un
 *  avviso che sta sempre aperto occupa la barra e non lo si legge più. Le
 *  situazioni da «attenzione» restano nella pastiglia. */
function AvvisoLinea({ linea }: { linea: State["linea"] }) {
  if (!linea || linea.kbit <= 0) return null;
  const d = diagnosiLinea(linea);
  if (d.tono !== "grave") return null;
  return (
    <div className="flex w-full items-center gap-2 rounded-lg border border-red-400/45 bg-red-500/15 px-2 py-1.5 text-[11px] font-medium leading-tight text-red-50">
      <Activity className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="min-w-0 flex-1">
        <b>{d.titolo}.</b> {d.cosa}
      </span>
    </div>
  );
}
/** ── ACCENDI E SPEGNI LA CAMERA DEGLI OSPITI, DALLA BARRA ──────────────────
 *
 *  Segnalazione del committente: «fai che posso attivare e disattivare la
 *  camera degli ospiti».
 *
 *  Il comando esisteva, ma viveva dentro il pannello «Partecipanti», che si
 *  apre da un'iconcina in un angolo: in consulenza non lo si trovava, e un
 *  comando che non si trova è un comando che non c'è. Questo sta nella riga
 *  della barra che parla dello schermo del cliente — accanto alla qualità, cioè
 *  dove si prendono le decisioni su di lui — ed è sempre in vista.
 *
 *  ⚠️ UNO O TANTI SONO DUE COSE DIVERSE. Con un ospite solo il pulsante è
 *   l'interruttore della SUA camera, e dice il suo nome: nessun dubbio su chi
 *   si sta spegnendo. Da due in su diventa l'interruttore di TUTTE — con tre
 *   ospiti spegnerle una per una sono tre clic davanti al cliente — e per la
 *   singola restano il pulsante sul suo riquadro e il pannello Partecipanti.
 *  ⚠️ E DICE COME STANNO: «2 di 3 accese» è l'informazione che manca quando si
 *   guarda una griglia di riquadri neri e non si sa se è la camera spenta o la
 *   connessione caduta. */
function ComandoCamereOspiti({ st }: { st: State }) {
  const ospiti = ospitiDi(st.roster);
  if (!ospiti.length) return null;
  const c = statoCamereOspiti(st.roster);
  const uno = ospiti.length === 1 ? ospiti[0] : null;
  const accendi = c.prossimaAzione; // true = il pulsante ACCENDE
  const premi = () => {
    for (const g of ospiti) setGuestDevice(g.pid, "cam", accendi);
  };
  const titolo = uno
    ? accendi
      ? `Accendi la camera di ${uno.name}`
      : `Spegni la camera di ${uno.name}`
    : accendi
      ? "Accendi la camera di tutti gli ospiti"
      : "Spegni la camera di tutti gli ospiti";
  return (
    <button
      onClick={premi}
      title={titolo}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9.5px] font-semibold normal-case tracking-normal ${
        accendi
          ? "border-red-400/45 bg-red-500/20 text-red-200 hover:bg-red-500/30"
          : "border-white/15 bg-white/[0.06] text-white/75 hover:bg-white/12 hover:text-white"
      }`}
    >
      {accendi ? <VideoOff className="h-3 w-3" /> : <Video className="h-3 w-3" />}
      {uno ? (accendi ? "Camera spenta" : "Camera accesa") : `Camere ${c.accese}/${c.quanti}`}
    </button>
  );
}
function QSel({ value, onChange }: { value: Quality; onChange: (v: Quality) => void }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-md border border-white/10 bg-white/[0.03] px-1 normal-case">
      <span className="text-[8px] text-white/40">qualità</span>
      {(["low", "med", "high"] as const).map((l) => (
        <button
          key={l}
          onClick={() => onChange(l)}
          className={`rounded px-1 py-0.5 text-[9px] font-bold ${value === l ? "bg-brand text-white" : "text-white/60 hover:bg-white/10"}`}
        >
          {l === "low" ? "B" : l === "med" ? "M" : "A"}
        </button>
      ))}
    </span>
  );
}

function FgChk({ on, icon: Icon, title }: { on: boolean; icon: any; title: string }) {
  return (
    <span
      title={title}
      className={`relative inline-flex rounded p-0.5 ${on ? "bg-brand/25 text-brand" : "text-white/30"}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {on && (
        <Check className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 text-white" />
      )}
    </span>
  );
}

function Ctrl({
  on,
  onClick,
  A,
  B,
  title,
}: {
  on: boolean;
  onClick: () => void;
  A: any;
  B: any;
  title?: string;
}) {
  const I = on ? A : B;
  return (
    <button
      onClick={onClick}
      title={title}
      className={`rounded-lg border px-2 py-1.5 ${on ? "border-white/12 bg-white/5" : "border-red-500/40 bg-red-500/10 text-red-300"}`}
    >
      <I className="h-4 w-4" />
    </button>
  );
}

function ModeBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: any;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-medium ${active ? "bg-brand text-white" : "bg-white/5 text-white/70 hover:bg-white/10"}`}
    >
      <Icon className="h-3 w-3 flex-shrink-0" /> <span className="truncate">{label}</span>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════
//  Feature 5 — CHAT PRIVATA 1:1 (over canale qcall)
// ════════════════════════════════════════════════════════════════════════
const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;
const firstUrl = (s: string) => {
  const m = s.match(URL_RE);
  return m ? m[0] : null;
};

// icona flottante in basso a destra con badge non letti (guest quando la chat è chiusa)
function ChatBubbleIcon({ unread, onClick }: { unread: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Chat"
      className="fixed bottom-4 right-4 z-[98] flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-2xl shadow-brand/40 hover:brightness-110"
    >
      <MessageCircle className="h-6 w-6" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-[#050f24]">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

// finestra chat modern, on-brand: bolle mittente a destra / destinatario a sinistra
function ChatWindow({
  st,
  peerPid,
  peerName,
  onClose,
}: {
  st: State;
  peerPid: string;
  peerName: string;
  onClose: () => void;
}) {
  const [txt, setTxt] = useState("");
  const [toast, setToast] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const msgs = st.chat
    .filter(
      (m) => (m.from === peerPid && m.to === st.myPid) || (m.to === peerPid && m.from === st.myPid),
    )
    .sort((a, b) => a.t - b.t);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs.length]);
  const submit = () => {
    const v = txt.trim();
    if (!v) return;
    sendChat(peerPid, v);
    setTxt("");
  };
  const copy = (text: string) => copyLink(firstUrl(text) || text, "Link copiato");
  const fmt = (t: number) =>
    new Date(t).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="fixed bottom-4 right-4 z-[99] flex h-[70vh] max-h-[560px] w-[min(92vw,360px)] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0a1428] text-white shadow-2xl shadow-black/60 backdrop-blur">
      <div className="flex items-center gap-2 border-b border-white/10 bg-[#081226] px-3 py-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/20 text-brand">
          <User className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{peerName}</div>
          <div className="text-[10px] text-white/40">Chat privata</div>
        </div>
        <button
          onClick={onClose}
          className="ml-auto rounded-lg p-1.5 text-white/60 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 space-y-2 overflow-y-auto px-3 py-3"
        style={{ scrollbarWidth: "thin" }}
      >
        {msgs.length === 0 && (
          <div className="mt-6 text-center text-xs text-white/35">
            Nessun messaggio. Scrivi qualcosa per iniziare.
          </div>
        )}
        {msgs.map((m, i) => {
          const mine = m.from === st.myPid;
          const url = firstUrl(m.text);
          return (
            <div key={i} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[82%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${mine ? "rounded-br-md bg-brand text-white" : "rounded-bl-md bg-white/[0.08] text-white/90"}`}
              >
                <span className="whitespace-pre-wrap break-words">{m.text}</span>
                {url && (
                  <button
                    onClick={() => copy(m.text)}
                    className={`mt-1.5 flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${mine ? "bg-white/20 hover:bg-white/30" : "bg-brand/25 text-brand hover:bg-brand/35"}`}
                  >
                    <Copy className="h-3 w-3" /> Copia link
                  </button>
                )}
              </div>
              <span className="mt-0.5 px-1 text-[9px] text-white/30">{fmt(m.t)}</span>
            </div>
          );
        })}
      </div>
      {toast && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-3 py-1.5 text-[11px] font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-white/10 bg-[#081226] px-2.5 py-2">
        <input
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Scrivi un messaggio…"
          className="flex-1 rounded-xl border border-white/12 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-white/30"
        />
        <button
          onClick={submit}
          disabled={!txt.trim()}
          className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white hover:brightness-110 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// GUEST: apre in popup all'arrivo di un messaggio; chiusa → icona flottante con badge
function GuestChat({ st }: { st: State }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(0);
  const incoming = st.chat.filter((m) => m.to === st.myPid);
  const hostP = bestHost(st);
  const peerPid = incoming.length ? incoming[incoming.length - 1].from : hostP?.pid || "";
  const peerName = st.presenterName || hostP?.name || "Presentatore";
  useEffect(() => {
    if (incoming.length > seen && !open) setOpen(true);
  }, [incoming.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) setSeen(incoming.length);
  }, [open, incoming.length]);
  // Feature 1 — nessuna icona/bolla chat finché il guest non ha ricevuto ALMENO un
  // messaggio dal presentatore. Alla prima ricezione il popup si apre da solo; una
  // volta chiuso collassa nella bolla (che ora esiste perché c'è già un messaggio).
  if (!st.joined || incoming.length === 0 || !peerPid) return null;
  const unread = Math.max(0, incoming.length - seen);
  if (!open) return <ChatBubbleIcon unread={unread} onClick={() => setOpen(true)} />;
  return (
    <ChatWindow st={st} peerPid={peerPid} peerName={peerName} onClose={() => setOpen(false)} />
  );
}

// PIN — pulsante fissa/sblocca partecipante (solo lato presentatore, mai inviato agli ospiti)
function PinBtn({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={
        on
          ? "Non fissare più questo partecipante"
          : "Fissa: mostra solo lui nel tuo pannello camere"
      }
      className={`shrink-0 rounded-lg border p-1.5 ${on ? "border-brand bg-brand/25 text-brand" : "border-white/12 bg-white/5 text-white/50 hover:text-white"}`}
    >
      {on ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
    </button>
  );
}

// PARTECIPANTI — corpo UNICO del popup (usato sia dalla barra host sia
// dall'icona "persone" nell'header del pannello camere). Una sola logica:
// pin/unpin · rimuovi · blocca · sblocca (+ chat privata quando disponibile).
function ParticipantsPanel({
  st,
  pinned,
  onTogglePin,
  onPickChat,
  unreadFrom,
  footer,
}: {
  st: State;
  pinned: string[];
  onTogglePin: (pid: string) => void;
  onPickChat?: (pid: string) => void;
  unreadFrom?: (pid: string) => number;
  footer?: React.ReactNode;
}) {
  const guests = st.roster.filter((r) => r.role === "viewer");
  /*  Lo stato del microfono altrui non viaggia nel roster: ce lo ricordiamo
      noi, se no il pulsante non è un interruttore ma un bottone che spegne due
      volte.
      ⚠️ LA MEMORIA È UNA SOLA, in `shop/ospiti-muti`: gli stessi comandi
       stanno adesso anche nel menu che si apre tenendo premuto sulla camera, e
       due memorie separate vorrebbero dire due interruttori che si
       contraddicono — muti dalla camera, e qui resta scritto «Microfono». */
  const [, ridisegnaMuti] = useState(0);
  useEffect(() => ascoltaMuti(() => ridisegnaMuti((n) => n + 1)), []);
  //  Chi è uscito dalla stanza esce anche dall'elenco dei silenziati.
  useEffect(() => {
    soloQuestiRestano(guests.map((g) => g.pid));
  }, [guests]);
  const toggleGuestMic = (pid: string) => {
    const ora = scambiaMuto(pid);
    setGuestDevice(pid, "mic", !ora);
  };
  //  ── TUTTE LE CAMERE IN UN COLPO, E IL CONTO DELLA LINEA ─────────────────
  //   Con tre o quattro ospiti spegnere le camere una per una sono tre o
  //   quattro clic davanti al cliente. E la linea non si moltiplica: la tua
  //   camera parte una volta per ciascuno, quindi il conto va detto prima —
  //   vedi `shop/ospiti`, dove sta la regola (e dove si prova).
  const camere = statoCamereOspiti(st.roster);
  const consiglio = consiglioPerTantiOspiti(camere.quanti, st.linea?.kbit || 0);
  const camereDiTutti = (on: boolean) => {
    for (const g of ospitiDi(st.roster)) setGuestDevice(g.pid, "cam", on);
  };
  return (
    <>
      <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white/45">
        Partecipanti
        {camere.quanti > 0 && (
          <span className="rounded bg-white/10 px-1 text-[9px] text-white/60">
            {camere.quanti} {camere.quanti === 1 ? "ospite" : "ospiti"}
          </span>
        )}
        {/* via di fuga manuale contro i fantasmi: tiene solo chi è davvero connesso */}
        <button
          onClick={() => purgeRoster()}
          title="Pulisci lista: rimuove le voci senza connessione attiva"
          className="ml-auto flex items-center gap-1 rounded-md border border-white/12 bg-white/5 px-1.5 py-1 text-[9px] font-semibold normal-case text-white/60 hover:bg-white/10 hover:text-white"
        >
          <Brush className="h-3 w-3" /> Pulisci lista
        </button>
      </div>
      {/* Un solo interruttore per tutte: compare da due ospiti in su, perché
          con uno solo il pulsante sulla sua riga fa già esattamente questo. */}
      {camere.quanti >= 2 && (
        <div className="mx-1 mb-1 flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-1.5 py-1">
          <span className="text-[10px] text-white/45">Camere degli ospiti</span>
          <button
            onClick={() => camereDiTutti(camere.prossimaAzione)}
            title={
              camere.prossimaAzione
                ? "Riaccendi la camera di tutti gli ospiti"
                : "Spegni la camera di tutti gli ospiti"
            }
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-1.5 py-1 text-[10px] font-semibold text-white/80 hover:bg-white/10"
          >
            {camere.prossimaAzione ? (
              <>
                <Video className="h-3 w-3" /> Accendi tutte
              </>
            ) : (
              <>
                <VideoOff className="h-3 w-3" /> Spegni tutte
              </>
            )}
          </button>
        </div>
      )}
      {/* Il conto della linea divisa: non è un allarme, è l'aritmetica che non
          si può fare a mente mentre si parla. */}
      {consiglio && (
        <div
          className={`mx-1 mb-1 rounded-lg border px-2 py-1.5 text-[10px] leading-snug ${
            consiglio.grave
              ? "border-amber-400/40 bg-amber-500/12 text-amber-100"
              : "border-white/10 bg-white/[0.03] text-white/55"
          }`}
        >
          {consiglio.testo}
        </div>
      )}
      {/* riga: io (il presentatore) — solo pin, nessuna chat con me stesso */}
      <div className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px]">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/20 text-brand">
          <User className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-white/85">Tu</span>
        <PinBtn on={pinned.includes(st.myPid)} onClick={() => onTogglePin(st.myPid)} />
      </div>
      {guests.length === 0 && (
        <div className="px-2 py-2 text-[11px] leading-snug text-white/40">
          Nessun ospite collegato.
          {/* Non è un dettaglio tecnico: è la risposta alla domanda «come ne
              faccio entrare tre?», e il posto dove viene in mente di cercarla
              è questo elenco vuoto. */}
          <span className="mt-1 block text-white/30">
            Lo stesso link della consulenza vale per più persone: mandalo a tutte. Bussano una per
            una e le fai entrare tu.
          </span>
        </div>
      )}
      {guests.map((g) => {
        const u = unreadFrom ? unreadFrom(g.pid) : 0;
        return (
          <div key={g.pid} className="rounded-lg px-1 py-1 hover:bg-white/5">
            <div className="flex w-full items-center gap-2">
              {onPickChat ? (
                <button
                  onClick={() => onPickChat(g.pid)}
                  title="Chat privata"
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left text-[12px]"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/20 text-brand">
                    <User className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{g.name}</span>
                  {u > 0 && (
                    <span className="rounded-full bg-red-500 px-1.5 text-[9px] font-bold text-white">
                      {u}
                    </span>
                  )}
                  <MessageCircle className="h-3.5 w-3.5 text-white/40" />
                </button>
              ) : (
                <div className="flex min-w-0 flex-1 items-center gap-2 px-1 py-1 text-[12px]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/20 text-brand">
                    <User className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{g.name}</span>
                </div>
              )}
              <PinBtn on={pinned.includes(g.pid)} onClick={() => onTogglePin(g.pid)} />
            </div>
            {/* ── COMANDI SUL CLIENTE, CON ETICHETTE ────────────────────────
                Erano icone minute in mezzo alle altre e non si trovavano.
                Ora sono pulsanti con scritta, su una riga dedicata. */}
            <div className="mt-0.5 flex flex-wrap items-center gap-1 pl-8">
              <button
                onClick={() => setGuestDevice(g.pid, "cam", !g.camOn)}
                title={g.camOn ? `Spegni la camera di ${g.name}` : `Accendi la camera di ${g.name}`}
                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-medium ${g.camOn ? "border-white/15 bg-white/5 text-white/75 hover:bg-white/10" : "border-red-400/40 bg-red-500/20 text-red-200"}`}
              >
                {g.camOn ? <Video className="h-3 w-3" /> : <VideoOff className="h-3 w-3" />}{" "}
                {g.camOn ? "Camera on" : "Camera off"}
              </button>
              {/*  «Fammi vedere dietro»: passa all'altra camera del suo
                   telefono. Non chiede permessi nuovi — la camera è già
                   aperta — quindi riesce anche su iPhone. */}
              <button
                onClick={() => giraCameraOspite(g.pid)}
                title={`Gira la camera di ${g.name}: passa da quella davanti a quella dietro`}
                className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-1.5 py-1 text-[10px] font-medium text-white/75 hover:bg-white/10"
              >
                <SwitchCamera className="h-3 w-3" /> Gira camera
              </button>
              <button
                onClick={() => toggleGuestMic(g.pid)}
                title={
                  eMuto(g.pid)
                    ? `Riaccendi il microfono di ${g.name}`
                    : `Spegni il microfono di ${g.name}`
                }
                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-medium ${eMuto(g.pid) ? "border-red-400/40 bg-red-500/20 text-red-200" : "border-white/15 bg-white/5 text-white/75 hover:bg-white/10"}`}
              >
                {eMuto(g.pid) ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}{" "}
                {eMuto(g.pid) ? "Muto" : "Microfono"}
              </button>
              <button
                onClick={() => {
                  if (confirm(`Rimuovere ${g.name} dalla consulenza?`)) kickGuest(g.pid);
                }}
                title="Rimuovi dalla consulenza"
                className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-1.5 py-1 text-[10px] font-medium text-white/70 hover:bg-red-500/20 hover:text-red-200"
              >
                <UserX className="h-3 w-3" /> Rimuovi
              </button>
              <button
                onClick={() => {
                  if (
                    confirm(
                      `Bloccare ${g.name}? Verrà rimosso e non potrà più rientrare con questo link.`,
                    )
                  )
                    void blockGuest(g.pid);
                }}
                title="Blocca: rimuove e impedisce il rientro"
                className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-1.5 py-1 text-[10px] font-medium text-white/70 hover:bg-red-500/20 hover:text-red-200"
              >
                <Ban className="h-3 w-3" /> Blocca
              </button>
            </div>
          </div>
        );
      })}
      {/* elenco BLOCCATI con sblocco */}
      {st.blocked.length > 0 && (
        <>
          <div className="mt-1 border-t border-white/10 px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-white/45">
            Bloccati
          </div>
          {st.blocked.map((b) => (
            <div
              key={b.id}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] hover:bg-white/5"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-500/15 text-red-300">
                <Ban className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-white/75">
                {b.name}
                <span className="ml-1 text-[10px] text-white/35">#{b.id.slice(0, 6)}</span>
              </span>
              <button
                onClick={() => void unblockDevice(b.id)}
                title="Sblocca: potrà rientrare con il link"
                className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-1.5 py-1 text-[10px] text-white/75 hover:bg-white/10"
              >
                <ShieldOff className="h-3 w-3" /> Sblocca
              </button>
            </div>
          ))}
        </>
      )}
      {pinned.length > 0 && (
        <div className="px-2 py-1 text-[10px] text-white/40">
          Chi è fissato è mostrato in grande, gli altri più piccoli sotto (solo sul tuo schermo).
        </div>
      )}
      {footer}
    </>
  );
}

// HOST: lista roster per avviare una chat privata con un ospite specifico.
//  La conversazione vive in un PANNELLO richiudibile (come per il guest): chiudendolo
//  collassa in una bolla flottante che lo riapre con TUTTA la cronologia intatta
//  (la cronologia sta in S.chat, quindi non si perde mai).
function HostChat({
  st,
  peerPid,
  onPick,
  pinned,
  onTogglePin,
}: {
  st: State;
  peerPid: string | null;
  onPick: (pid: string | null) => void;
  pinned: string[];
  onTogglePin: (pid: string) => void;
}) {
  const [rosterOpen, setRosterOpen] = useState(false);
  const [open, setOpen] = useState(true); // pannello aperto / collassato in bolla
  const [seen, setSeen] = useState(0); // messaggi già visti dell'ospite corrente
  const guests = st.roster.filter((r) => r.role === "viewer");
  const unreadFrom = (pid: string) =>
    st.chat.filter((m) => m.from === pid && m.to === st.myPid).length;
  const totalUnread = guests.reduce((n, g) => n + (g.pid === peerPid ? 0 : unreadFrom(g.pid)), 0);
  const peer = guests.find((g) => g.pid === peerPid);
  const peerIncoming = peerPid ? unreadFrom(peerPid) : 0;
  // cambio interlocutore → riapro il pannello; pannello aperto → azzero i non letti
  useEffect(() => {
    if (peerPid) setOpen(true);
  }, [peerPid]);
  useEffect(() => {
    if (open) setSeen(peerIncoming);
  }, [open, peerIncoming]);
  // un nuovo messaggio in arrivo dall'ospite corrente riapre il pannello collassato
  useEffect(() => {
    if (peerPid && peerIncoming > seen) setOpen(true);
  }, [peerIncoming]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      {/* pulsante LISTA PARTECIPANTI (pin + chat privata) nella barra host */}
      <button
        onClick={() => setRosterOpen((v) => !v)}
        title="Partecipanti (fissa in evidenza / chat privata)"
        className={`relative rounded-lg border px-2 py-1.5 ${rosterOpen || peerPid || pinned.length ? "border-brand bg-brand/25 text-white" : "border-white/12 bg-white/5"}`}
      >
        <Users className="h-4 w-4" />
        {totalUnread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>
      {rosterOpen && (
        <div className="absolute top-full right-0 z-[99] mt-1 w-72 rounded-xl border border-white/12 bg-[#0b1730] p-1.5 shadow-2xl">
          <ParticipantsPanel
            st={st}
            pinned={pinned}
            onTogglePin={onTogglePin}
            unreadFrom={unreadFrom}
            onPickChat={(pid) => {
              onPick(pid);
              setOpen(true);
              setRosterOpen(false);
            }}
          />
        </div>
      )}
      {peerPid && open && (
        <ChatWindow
          st={st}
          peerPid={peerPid}
          peerName={peer?.name || "Ospite"}
          onClose={() => setOpen(false)}
        />
      )}
      {peerPid && !open && (
        <ChatBubbleIcon unread={Math.max(0, peerIncoming - seen)} onClick={() => setOpen(true)} />
      )}
    </>
  );
}

// ── TELEPROMPTER: metà schermo sinistra, avanza con le parole lette ────────
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

// Formatta lo script per la lettura: frasi separate, righe brevi (max ~6 parole),
// a capo dopo la punteggiatura. Facilita la lettura a colpo d'occhio.
function formatScript(t: string): string {
  const clean = t
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
  if (!clean) return "";
  const sentences = clean.split(/(?<=[.!?…])\s+/);
  const out: string[] = [];
  for (const s of sentences) {
    const clauses = s.split(/(?<=[,;:])\s+/); // spezza anche alle pause deboli
    for (const c of clauses) {
      const w = c.split(" ").filter(Boolean);
      for (let i = 0; i < w.length; i += 6) out.push(w.slice(i, i + 6).join(" "));
    }
    out.push(""); // riga vuota tra le frasi
  }
  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
interface TScript {
  id: string;
  name: string;
  body: string;
}
const uid = () => "s" + Math.random().toString(36).slice(2, 8);
function loadScripts(): TScript[] {
  if (typeof window === "undefined") return [];
  try {
    const a = JSON.parse(localStorage.getItem("hg_tp_scripts") || "[]");
    if (Array.isArray(a) && a.length) return a;
  } catch {
    /* */
  }
  const legacy = localStorage.getItem("hg_teleprompter");
  return [
    {
      id: uid(),
      name: "Script 1",
      body:
        legacy ||
        "Ciao {NOME}, benvenuto! Sono {PRESENTATORE} e oggi ti mostro la soluzione più adatta a te.",
    },
  ];
}
function loadVars(): { key: string; val: string }[] {
  if (typeof window === "undefined") return [];
  try {
    const a = JSON.parse(localStorage.getItem("hg_tp_vars") || "[]");
    if (Array.isArray(a)) return a;
  } catch {
    /* */
  }
  return [];
}

function TeleprompterOverlay({ onClose, topSlot }: { onClose: () => void; topSlot?: ReactNode }) {
  const st = useCall();
  const [scripts, setScripts] = useState<TScript[]>(loadScripts);
  const [curId, setCurId] = useState<string>(
    () => (typeof window !== "undefined" && localStorage.getItem("hg_tp_current")) || "",
  );
  const [vars, setVars] = useState<{ key: string; val: string }[]>(loadVars);
  const [editing, setEditing] = useState(false);
  const [showVars, setShowVars] = useState(false);
  const [font, setFont] = useState(30);
  const [idx, setIdx] = useState(0);
  const defaultW = () =>
    typeof window !== "undefined" ? Math.min(560, Math.round(window.innerWidth * 0.5)) : 480;
  const [tpW, setTpW] = useState(defaultW); // larghezza (NON persistita: reset al refresh)
  const curRef = useRef<HTMLSpanElement | null>(null);

  const cur = scripts.find((s) => s.id === curId) || scripts[0];
  useEffect(() => {
    if (cur && cur.id !== curId) setCurId(cur.id);
  }, [cur, curId]);
  useEffect(() => {
    localStorage.setItem("hg_tp_scripts", JSON.stringify(scripts));
  }, [scripts]);
  useEffect(() => {
    localStorage.setItem("hg_tp_vars", JSON.stringify(vars));
  }, [vars]);
  useEffect(() => {
    if (cur) localStorage.setItem("hg_tp_current", cur.id);
  }, [cur]);
  // avvia il riconoscimento vocale finché il teleprompter è aperto
  useEffect(() => {
    ensureRecognition();
    return () => {
      if (!S.active) stopRecognition();
    };
  }, []);
  // SPLIT REALE: spinge tutto il gestionale nell'altra metà (non lo copre)
  useEffect(() => {
    if (typeof document === "undefined") return;
    const w = tpW + "px";
    // variabile globale: TUTTE le barre fisse si restringono nello spazio rimanente
    document.documentElement.style.setProperty("--tp-right", w);
    document.body.style.transition = "padding-right .2s";
    document.body.style.paddingRight = w;
    return () => {
      document.documentElement.style.removeProperty("--tp-right");
      document.body.style.paddingRight = "";
    };
  }, [tpW]);
  useEffect(() => {
    setIdx(0);
  }, [curId, editing]);

  // placeholder → valori dinamici
  const map: Record<string, string> = {
    NOME: st.guestName || "",
    PRESENTATORE: st.presenterName || "",
    GUEST: st.guestName || "",
  };
  vars.forEach((v) => {
    if (v.key.trim()) map[v.key.trim().toUpperCase()] = v.val;
  });
  const body = cur?.body || "";
  const rendered = body.replace(/\{(\w+)\}/g, (m, k: string) =>
    k.toUpperCase() in map ? map[k.toUpperCase()] : m,
  );
  const words = rendered.split(/(\s+)/);
  // token = solo parole reali, in ordine; idx è l'indice nella lista dei token
  const tokens = words.filter((w) => /\S/.test(w)).map((w) => norm(w)[0] || "");
  const totalWords = tokens.length;

  useEffect(() => {
    if (editing) return;
    return onSpoken((text) => {
      // salta parole troppo corte (e, il, la, un…) che matcherebbero ovunque
      const spoken = norm(text).filter((w) => w.length >= 3);
      setIdx((c) => {
        let p = c;
        const WIN = 5; // finestra di ricerca ristretta → niente salti lontani
        for (const sw of spoken) {
          for (let k = p; k < Math.min(p + WIN, tokens.length); k++) {
            const tw = tokens[k];
            if (!tw || tw.length < 3) continue;
            const exact = tw === sw;
            const fuzzy =
              sw.length >= 4 && tw.length >= 4 && (tw.startsWith(sw) || sw.startsWith(tw));
            if (exact || fuzzy) {
              p = k + 1;
              break;
            }
          }
        }
        return Math.min(p, totalWords);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, rendered]);
  useEffect(() => {
    curRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [idx]);

  const updateBody = (v: string) =>
    setScripts((a) => a.map((s) => (s.id === cur!.id ? { ...s, body: v } : s)));
  const updateName = (v: string) =>
    setScripts((a) => a.map((s) => (s.id === cur!.id ? { ...s, name: v } : s)));
  const addScript = () => {
    const s = { id: uid(), name: `Script ${scripts.length + 1}`, body: "" };
    setScripts((a) => [...a, s]);
    setCurId(s.id);
    setEditing(true);
  };
  const delScript = () => {
    if (!cur || scripts.length <= 1) return;
    setScripts((a) => a.filter((s) => s.id !== cur.id));
    setCurId(scripts.find((s) => s.id !== cur.id)!.id);
  };

  return (
    <div
      style={{ width: tpW }}
      className="fixed right-0 top-0 z-[96] flex h-screen flex-col border-l border-white/10 bg-[#0a0f1c]/97 text-white shadow-2xl backdrop-blur-md"
    >
      {/* maniglia: trascina il bordo sinistro per allargare/stringere in larghezza */}
      <ResizeHandle
        onResize={(dx) =>
          setTpW((w) =>
            Math.max(
              300,
              Math.min(typeof window !== "undefined" ? window.innerWidth - 200 : 1200, w - dx),
            ),
          )
        }
        className="absolute left-0 top-0 z-20 h-full w-2 cursor-ew-resize bg-white/10 hover:bg-brand/50"
      />
      <div className="flex flex-nowrap items-center gap-1 overflow-x-auto border-b border-white/10 px-2 py-1.5 pl-3">
        <ScrollText className="h-4 w-4 shrink-0 text-brand" />
        <select
          value={cur?.id}
          onChange={(e) => setCurId(e.target.value)}
          className="w-[92px] shrink-0 rounded border border-white/12 bg-[#0a0f1c] px-1.5 py-1 text-[11px]"
        >
          {scripts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <button
          onClick={addScript}
          title="Nuovo script"
          className="shrink-0 rounded border border-white/12 bg-white/5 p-1"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={delScript}
          title="Elimina script"
          className="shrink-0 rounded border border-white/12 bg-white/5 p-1 disabled:opacity-30"
          disabled={scripts.length <= 1}
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            onClick={() => setFont((f) => Math.max(18, f - 2))}
            className="shrink-0 rounded border border-white/12 bg-white/5 p-1"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="w-5 shrink-0 text-center text-[10px] text-white/50">{font}</span>
          <button
            onClick={() => setFont((f) => Math.min(60, f + 2))}
            className="shrink-0 rounded border border-white/12 bg-white/5 p-1"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <span className="mx-0.5 h-4 w-px shrink-0 bg-white/15" />
          <button
            onClick={() => setTpW((w) => Math.max(300, w - 60))}
            title="Restringi teleprompter"
            className="shrink-0 rounded border border-white/12 bg-white/5 px-1.5 py-1 text-[11px]"
          >
            ◧
          </button>
          <button
            onClick={() =>
              setTpW((w) =>
                Math.min(typeof window !== "undefined" ? window.innerWidth - 220 : 900, w + 60),
              )
            }
            title="Allarga teleprompter"
            className="shrink-0 rounded border border-white/12 bg-white/5 px-1.5 py-1 text-[11px]"
          >
            ◨
          </button>
          <span className="mx-0.5 h-4 w-px bg-white/15" />
          <button
            onClick={() => setShowVars((v) => !v)}
            title="Placeholder"
            className={`shrink-0 rounded border px-1.5 py-1 text-[11px] ${showVars ? "border-brand bg-brand/20" : "border-white/12 bg-white/5"}`}
          >
            {"{ }"}
          </button>
          <button
            onClick={() => cur && updateBody(formatScript(body))}
            title="Formatta per la lettura (a capo automatici)"
            className="shrink-0 rounded border border-white/12 bg-white/5 px-1.5 py-1 text-[11px]"
          >
            ¶
          </button>
          <button
            onClick={() => setEditing((e) => !e)}
            title={editing ? "Leggi" : "Modifica"}
            className="shrink-0 rounded border border-white/12 bg-white/5 px-1.5 py-1 text-[11px] font-medium"
          >
            {editing ? "▶" : "✎"}
          </button>
          <button
            onClick={() => {
              setIdx(0);
              setTpW(defaultW());
              setFont(30);
            }}
            title="Reset (posizione, larghezza, testo)"
            className="shrink-0 rounded border border-white/12 bg-white/5 px-1.5 py-1 text-[11px]"
          >
            ↺
          </button>
          <button onClick={onClose} className="rounded border border-white/12 bg-white/5 p-1">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {topSlot}

      {showVars && (
        <div className="border-b border-white/10 bg-white/[0.02] px-3 py-2 text-[11px]">
          <div className="mb-1 text-white/50">
            Placeholder disponibili: <code className="text-brand">{"{NOME}"}</code>,{" "}
            <code className="text-brand">{"{PRESENTATORE}"}</code>. Aggiungine altri:
          </div>
          {vars.map((v, i) => (
            <div key={i} className="mb-1 flex items-center gap-1">
              <span className="text-white/40">{"{"}</span>
              <input
                value={v.key}
                onChange={(e) =>
                  setVars((a) =>
                    a.map((x, j) => (j === i ? { ...x, key: e.target.value.toUpperCase() } : x)),
                  )
                }
                placeholder="CHIAVE"
                className="w-24 rounded border border-white/12 bg-white/5 px-1.5 py-0.5 uppercase"
              />
              <span className="text-white/40">{"}"} =</span>
              <input
                value={v.val}
                onChange={(e) =>
                  setVars((a) => a.map((x, j) => (j === i ? { ...x, val: e.target.value } : x)))
                }
                placeholder="valore"
                className="flex-1 rounded border border-white/12 bg-white/5 px-1.5 py-0.5"
              />
              <button
                onClick={() => setVars((a) => a.filter((_, j) => j !== i))}
                className="rounded border border-white/12 bg-white/5 p-1"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() => setVars((a) => [...a, { key: "", val: "" }])}
            className="mt-1 rounded border border-white/12 bg-white/5 px-2 py-0.5"
          >
            + placeholder
          </button>
        </div>
      )}

      {editing ? (
        <div className="flex flex-1 flex-col gap-2 p-3">
          <input
            value={cur?.name || ""}
            onChange={(e) => updateName(e.target.value)}
            placeholder="Nome script"
            className="rounded-lg border border-white/12 bg-white/5 px-3 py-2 text-sm font-medium"
          />
          <textarea
            value={body}
            onChange={(e) => updateBody(e.target.value)}
            placeholder="Scrivi lo script. Usa {NOME} per il nome del cliente, {PRESENTATORE} per il tuo. Premi 'Leggi' per iniziare: le parole si evidenziano mentre le leggi ad alta voce."
            className="flex-1 resize-none rounded-lg border border-white/12 bg-white/[0.03] p-3 text-[15px] leading-relaxed outline-none placeholder:text-white/25"
          />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
          <div
            className="mx-auto max-w-[34rem] px-7 py-[42vh] text-center font-medium tracking-[0.01em] text-[#eef2fb]"
            style={{ fontSize: font, lineHeight: 1.8 }}
          >
            {(() => {
              let wc = -1;
              return words.map((w, i) => {
                if (!/\S/.test(w)) return <span key={i}>{w}</span>;
                wc++;
                const myIdx = wc;
                const done = wc < idx;
                const isCur = wc === idx;
                return (
                  <span
                    key={i}
                    ref={isCur ? curRef : undefined}
                    onClick={() => setIdx(myIdx)}
                    title="Clicca per riprendere da qui"
                    className={`cursor-pointer ${done ? "text-white/30 transition-colors" : isCur ? "rounded-md bg-brand/25 px-0.5 text-white shadow-[0_0_0_1px] shadow-brand/40 transition-colors" : "text-[#eef2fb] hover:text-brand transition-colors"}`}
                  >
                    {w}
                  </span>
                );
              });
            })()}
            {!body.trim() && (
              <div className="text-white/30">Script vuoto. Premi “Modifica” e scrivi il testo.</div>
            )}
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-white/10 px-3 py-1.5 text-[10px] text-white/40">
        <span>{totalWords ? Math.round((idx / totalWords) * 100) : 0}% letto</span>
        <div className="h-1 flex-1 overflow-hidden rounded bg-white/10">
          <div
            className="h-full bg-brand transition-all"
            style={{ width: `${totalWords ? (idx / totalWords) * 100 : 0}%` }}
          />
        </div>
        <span>parla per far scorrere ▸</span>
      </div>
    </div>
  );
}
