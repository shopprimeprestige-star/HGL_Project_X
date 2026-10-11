/** ── WEBINAR — LA SALA, COME LA VEDE CHI GUARDA ─────────────────────────────
 *  /webinar/kfr-mbqd-tzp
 *
 *  Gemella di `meetly_.$code`, e volutamente separata da lei: là c'è una
 *  consulenza a due, qui una sala. Non condividono una riga di codice, così
 *  nessuna modifica al webinar può arrivare a toccare le consulenze.
 *
 *  ── PERCHÉ SI ENTRA CON UN PULSANTE ───────────────────────────────────────
 *  Non è una schermata di cortesia: i browser rifiutano di far partire un video
 *  CON AUDIO se l'utente non ha toccato niente. Senza quel pulsante il webinar
 *  comincerebbe muto per tutti, e cinquecento persone penserebbero che è rotto
 *  invece di cercare l'icona dell'altoparlante.
 *
 *  ── IL SALOTTO ───────────────────────────────────────────────────────────
 *  Chi guarda può chiedere la parola. Se il presentatore lo fa salire, il suo
 *  browser apre il microfono (e la camera, se è stato fatto salire in video) e
 *  comincia a pubblicare come fa il relatore: da quel momento tutti lo sentono,
 *  e i suoi messaggi in chat si accendono di verde con scritto «ora in live».
 *  È la sola forma di prova sociale che questo programma sa produrre — quella
 *  vera, fatta di gente vera che parla.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, CornerDownRight, Hand, Loader2, Mic, MicOff, Pin, Radio, Send, ShieldBan, Users, Video, VideoOff, CalendarX, MessageCircle, MessageSquare, MessageSquareOff, Volume2, WifiOff, X, RotateCw, BellRing } from "lucide-react";
import { soloLUltima, aggiungiTracce, guarda, salgoSulPalco, sorvegliaVoce, statoDiretta, type Visione } from "@/webinar/sfu";
import { ChatSala, ElencoPalco } from "@/webinar/ChatSala";
import { useLarghezza } from "@/webinar/Anteprime";
import { attaccaFlusso, riaccendiAudio } from "@/webinar/attacca";
import { useMisura } from "@/webinar/misura";
import { CAMPIONI_AL_BUIO, cameraSpenta, guardaSeBuia, quandoRiguardare } from "@/webinar/camera-buia";
import { qualcunoAvanza } from "@/webinar/fotogrammi";
import { spiegaErroreMedia } from "@/webinar/errori-media";
import { statoSulPalco } from "@/webinar/stato-palco";
import { AVVISO_VECCHIA, useVersioneVecchia } from "@/webinar/versione";
import { numeroPerWhatsApp } from "@/webinar/iscrizione";
import { VERSIONE_SCHEDA } from "@/prova/versione-scheda";
import { regolaChat, vestitoDelTasto } from "@/webinar/regole-chat";
import { RITMO, ritmoDelGiro } from "@/webinar/ritmo";
import { Diario, GUASTI, apparecchio, type Codice } from "@/webinar/diario";
import { conRisposta } from "@/webinar/menzioni";
import { etichetta, frase, quantoManca, valore } from "@/webinar/conto-alla-rovescia";
import { scegliPersona, tagAperto, trovaPersone } from "@/webinar/tag-chat";
import { disponiPalco, riempimento, duello } from "@/webinar/palco-tetris";
import { FasciaRelatori, useLogoStudio, useTrascinabile } from "@/webinar/FasciaRelatori";

import { mioId, mioNome, salvaNome } from "@/webinar/io";
import {
  BATTITO_PRESENZA_MS, numeroDaMostrare,
  chiVaInOnda,
  type InPalco, type MessaggioChat, type RegiaPalco, type StatoPalco, type VistaWebinar,
} from "@/webinar/tipi";

/** ── ⚠️ QUELLO CHE SI VEDE NELLA CHAT, PRIMA DELLA PAGINA ─────────────────
 *  Il link del webinar si manda a decine di persone in una volta. Quello che
 *  decide se lo aprono non è questa pagina: è il riquadro nella chat.
 *  ⚠️ Il titolo dice CHE COSA È e QUANDO, in poche parole: chi scorre una
 *   chat legge tre parole, non una frase.
 *  ⚠️ E l'immagine è quella DI QUESTA SALA — titolo e orario dentro — non più
 *   la scheda della videoconsulenza, che era un'altra cosa con un'altra
 *   promessa. La disegna il browser del CRM quando si copia il link (vedi
 *   webinar/anteprima-link.ts): qui si dice solo dove sta. */
const OG_TITLE = "Sei dentro: webinar in diretta";
const OG_DESC = "Un tocco e sei nella sala. Dal browser, senza installare niente — e puoi fare domande in chat.";
/** ⚠️ Il numero in coda obbliga Facebook e WhatsApp a riscaricare: tengono in
 *  cache l'immagine per INDIRIZZO, e con un indirizzo identico continuano a
 *  mostrare i byte vecchi anche dopo aver riletto la pagina. */
const ogImmagine = (code: string) =>
  `https://hair-genius-hub.hair/api/og/anteprima/webinar/${encodeURIComponent(code)}.jpg?v=${VERSIONE_SCHEDA}`;

export const Route = createFileRoute("/webinar_/$code")({
  head: ({ params }) => ({
    meta: [
      { title: OG_TITLE },
      { name: "robots", content: "noindex" },
      { name: "description", content: OG_DESC },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Hair Genius Labs" },
      { property: "og:title", content: OG_TITLE },
      { property: "og:description", content: OG_DESC },
      { property: "og:image", content: ogImmagine(params.code) },
      //  ⚠️ `og:image:secure_url` è la forma che WhatsApp cerca per prima; e
      //   dichiarare il tipo gli evita di doverlo indovinare scaricando.
      { property: "og:image:secure_url", content: ogImmagine(params.code) },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:alt", content: "Il webinar di Hair Genius Labs" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "675" },
      //  ⚠️ Senza `twitter:card` alcuni lettori non ricadono su og:image e
      //   mostrano il link nudo: due righe che costano niente.
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: OG_TITLE },
      { name: "twitter:description", content: OG_DESC },
      { name: "twitter:image", content: ogImmagine(params.code) },
      { property: "og:locale", content: "it_IT" },
      { name: "theme-color", content: "#050f24" },
    ],
  }),
  component: SalaWebinar,
});



/** ── ⚠️ DA QUI IN SU IL PALCO E LA CHAT STANNO AFFIANCATI ──────────────────
 *  Erano 1024 punti, la soglia `lg` di Tailwind, e per una ragione sola: era
 *  quella già scritta. Ma una finestra di Chrome su un portatile è larga
 *  MILLE punti — l'ho misurata su una schermata vera — e a mille il programma
 *  la trattava da tablet: palco e chat impilati, il palco che si prende
 *  l'altezza e la chat spinta fuori. Da fuori si legge «su desktop la chat
 *  sparisce», ed era vero: quella È una finestra da desktop.
 *  A 900 punti restano 336 alla chat e 564 al palco — due colonne vere.
 *  ⚠️ Il numero sta QUI e non sparso nelle classi: la regola che decide se la
 *   chat si può chiudere deve usare la STESSA soglia del disegno, altrimenti
 *   c'è una fascia di schermi in cui una dice una cosa e l'altro fa l'opposto.
 *   È esattamente il difetto che questa costante chiude. */
const SOGLIA_DUE_COLONNE = "(min-width: 900px)";

type Fase = "cerco" | "attesa" | "pronto" | "collego" | "onda" | "finito" | "errore" | "rimossa";

function SalaWebinar() {
  const { code } = Route.useParams();

  /** ── ⚠️ QUESTA PAGINA È DENTRO LO SPECCHIO DELLA REGIA? ────────────────
   *  Chi conduce apre «Come la vedono» e questa stessa sala si disegna dentro
   *  un riquadro, alla misura di un telefono o di un tablet. Da lì:
   *   · NON si manda il battito, quindi non si conta come spettatore. Senza,
   *     ogni volta che chi conduce apre il pannello la sala guadagnerebbe una
   *     persona che non c'è — e il numero mostrato al pubblico è una cosa su
   *     cui non si scherza;
   *   · si entra da soli, senza chiedere il nome: chi sta guardando lo sa già
   *     chi è, e una casella del nome davanti all'anteprima è un passaggio in
   *     mezzo che nasconde proprio quello che si è venuti a vedere. */
  const specchio =
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("specchio");
  const [fase, setFase] = useState<Fase>("cerco");
  /** Ogni quanto rifare il giro della sala. Sta in un ref perché lo legge
   *  l'effetto che tiene aperta la diretta, e quell'effetto non deve ripartire
   *  quando il ritmo cambia — ripartire vuol dire riattaccare il video. */
  const ritmoRef = useRef<number>(RITMO.attesa);
  const [titolo, setTitolo] = useState("");
  const [problema, setProblema] = useState("");

  const [messaggi, setMessaggi] = useState<MessaggioChat[]>([]);
  const [fissato, setFissato] = useState<MessaggioChat | null>(null);
  const [palco, setPalco] = useState<InPalco[]>([]);
  const [presenti, setPresenti] = useState(0);
  const [inSala, setInSala] = useState(0);
  const [iscritti, setIscritti] = useState(0);
  const [soglia, setSoglia] = useState(0);

  const [nome, setNome] = useState(mioNome());
  //  Il nome mentre lo si sta scrivendo, prima di entrare: separato da `nome`,
  //  che vale solo quando è stato confermato.
  const [bozzaNome, setBozzaNome] = useState("");
  const daRegia = typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("daRegia") === "1";
  const [bozza, setBozza] = useState("");
  const [mioStato, setMioStato] = useState<StatoPalco | null>(null);
  const [mioMicrofono, setMioMicrofono] = useState(true);
  /** Con la camera o in sola voce: la scelta di CHI SALE, che resta anche
   *  quando la regia gli spegne la camera. Vedi `webinar/stato-palco`. */
  const sceltaConVideo = useRef(true);
  const [parlo, setParlo] = useState(false);
  const [elencoAperto, setElencoAperto] = useState(false);
  const [registrata, setRegistrata] = useState(false);
  //  Da che schermo sto guardando: decide quante camere stanno affiancate.
  const larghezza = useLarghezza();
  //  Chi conduce, e chi di loro sta parlando: la fascia in cima si divide fra
  //  loro e si allarga su chi ha la voce.
  const [relatori, setRelatori] = useState<
    { id: string; nome: string; sessionId: string; audio: string; video: string; parla: boolean; camera?: boolean }[]
  >([]);
  const logoStudio = useLogoStudio();
  const flussiRelatori = useRef<Map<string, MediaStream>>(new Map());
  //  Dove sta il riquadro dei relatori quando copre i contenuti. Si trascina, e
  //  la posizione resta anche fra una diretta e l'altra.
  //  Cosa ha deciso il presentatore che dobbiamo vedere, e — in «contenuti» —
  //  su quale pagina.
  const [vista, setVista] = useState<VistaWebinar>("camera");
  const [percorso, setPercorso] = useState("");
  //  La regia del presentatore: chi si vede e chi sta grande.
  const [regiaPalco, setRegiaPalco] = useState<RegiaPalco>({});
  const [coda, setCoda] = useState<string[]>([]);
  const [codaAperta, setCodaAperta] = useState(false);
  const [bandito, setBandito] = useState(false);

  //  ⚠️ Il flusso del relatore sta in uno STATO, non in un riferimento: la
  //   disposizione cambia (attesa → in onda, diretta ↔ chat, contenuti ↔
  //   camera) e a ogni cambio l'elemento video può rinascere. Con lo stato,
  //   ogni elemento nuovo si riaggancia da sé; con l'assegnazione al momento
  //   dell'arrivo restava vuoto — schermo nero, senza errori.
  const [flussoRelatore, setFlussoRelatore] = useState<MediaStream | null>(null);
  const visione = useRef<Visione | null>(null);
  const haAcconsentito = useRef(false);
  const io = useRef(mioId());
  const pass = useRef<string>("");
  const miaPubblicazione = useRef<{ chiudi: () => void } | null>(null);
  const mioMedia = useRef<MediaStream | null>(null);
  const smettiSorveglianza = useRef<(() => void) | null>(null);
  /** le tracce del palco già agganciate: senza, a ogni giro si richiederebbero
   *  di nuovo le stesse e la connessione si rinegozierebbe all'infinito */
  const agganciate = useRef<Set<string>>(new Set());
  const flussiPalco = useRef<Map<string, MediaStream>>(new Map());
  const [, ridisegna] = useState(0);

  // ══════════════════════════════════════════════════════════════════════
  //  MI COLLEGO
  // ══════════════════════════════════════════════════════════════════════
  /** ── IL DIARIO DI BORDO ─────────────────────────────────────────────────
   *  Registra ogni passo del collegamento e ogni guasto con un codice, lo
   *  mostra a chi guarda e lo manda allo studio. Vedi webinar/diario.ts per il
   *  perché — in due parole: «si vede nero» sono sei guasti diversi con lo
   *  stesso sintomo, e finora non c'era modo di sapere quale. */
  const diario = useRef(new Diario(Date.now()));
  const [guasto, setGuasto] = useState<Codice | null>(null);
  const spedito = useRef("");

  /** Segna un passo. Se porta un codice, lo mostra e manda il diario allo
   *  studio — una volta per codice, non a ogni giro del battito: cinquecento
   *  telefoni che ripetono lo stesso guasto ogni tre secondi sono un attacco
   *  al proprio server, non una diagnostica. */
  const annota = useCallback((passo: string, codice?: Codice, nota?: string) => {
    diario.current.segna(Date.now(), passo, codice, nota);
    if (!codice) return;
    setGuasto(codice);
    if (spedito.current === codice) return;
    spedito.current = codice;
    void fetch("/api/public/webinar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        azione: "diario", codice: code, guasto: codice,
        apparecchio: apparecchio(navigator.userAgent, window.innerWidth),
        righe: diario.current.tutte(),
      }),
    }).catch(() => { /* se non parte, resta comunque a schermo */ });
  }, [code]);

  const collega = useCallback(async () => {
    if (visione.current) return;
    setFase("collego");
    try {
      const s = await statoDiretta(code);
      if (!s.inOnda || !s.diretta) { setFase("attesa"); return; }
      const v = await guarda(code, { sessionId: s.diretta.sessionId }, (nomeTraccia, traccia) => {
        //  ⚠️ «audio-<id>»/«video-<id>» sono i RELATORI, «a-<id>»/«v-<id>» il
        //   palco, e «audio»/«video» secchi il primo relatore — quel nome
        //   esisteva prima che potessero essere in due, e non si può cambiare
        //   senza far sparire il video alle sale già aperte.
        const rel = /^(audio|video)-(.+)$/.exec(nomeTraccia);
        if (rel) {
          const chi = rel[2];
          let f = flussiRelatori.current.get(chi);
          if (!f) { f = new MediaStream(); flussiRelatori.current.set(chi, f); }
          //  ⚠️ UNA PER TIPO, la più recente: il perché sta in `webinar/sfu`.
          //   In breve: chi conduce si ricollega, arriva una traccia nuova e la
          //   vecchia restava dentro; l'elemento video disegna la PRIMA, e se
          //   in cima c'era quella di una sessione finita si vedeva nero.
          soloLUltima(f, traccia);
          ridisegna((n) => n + 1);
          return;
        }
        //  «a-xxx» e «v-xxx» sono le tracce di chi è salito sul palco: vanno
        //  in un flusso per persona, altrimenti quattro ospiti finirebbero
        //  tutti nello stesso riquadro.
        const m = /^([av])-(.+)$/.exec(nomeTraccia);
        if (!m) return;
        const chi = m[2];
        let f = flussiPalco.current.get(chi);
        if (!f) { f = new MediaStream(); flussiPalco.current.set(chi, f); }
        //  ⚠️ Stessa regola: un ospite che riprova a salire non deve lasciarsi
        //   dietro la traccia del tentativo di prima.
        soloLUltima(f, traccia);
        ridisegna((n) => n + 1);
      });
      visione.current = v;
      setFlussoRelatore(v.stream);
      annota(`collegato — ${v.stream.getVideoTracks().length} video, ${v.stream.getAudioTracks().length} audio`);
      //  ⚠️ ZERO TRACCE VIDEO SI SA GIÀ ADESSO, non fra sei secondi: il
      //   relatore è andato in onda senza camera, e aspettare i fotogrammi di
      //   un video che non esiste vuol dire sei secondi di nero senza motivo.
      if (v.stream.getVideoTracks().length === 0) annota("nessuna traccia video dal relatore", "W08");
      //  Una connessione che cade dopo essersi aperta è un guasto diverso da
      //  una che non si apre: la prima si vede solo di qui.
      v.pc.addEventListener("iceconnectionstatechange", () => {
        const st = v.pc.iceConnectionState;
        if (st === "failed") annota("connessione fallita", "W06", st);
        else if (st === "disconnected") annota("connessione caduta", "W07", st);
      });
      setFase("onda");
    } catch (e) {
      console.error("[WEBINAR] collegamento fallito:", e);
      //  ── ⚠️ QUALE guasto, non «un guasto» ──────────────────────────────
      //   Prima qui finivano insieme sei cose diverse — SFU non configurato,
      //   server giu', rete che blocca la videochiamata, trattativa fallita —
      //   e uscivano tutte con la stessa frase «riprova fra un attimo». Chi
      //   guarda riprovava all'infinito su un guasto che riprovare non
      //   risolve, e chi doveva correggere non sapeva da dove partire.
      const m = String((e as Error)?.message || e);
      const codice: Codice =
        /non è configurato|configurat/i.test(m) ? "W02"
        : /non è in corso|409/.test(m) ? "W04"
        : /50\d|502|503|504|fetch|network|Failed to fetch/i.test(m) ? "W03"
        : /candidat|ICE/i.test(m) ? "W06"
        : "W05";
      annota("collegamento fallito", codice, m);
      setProblema(`${GUASTI[codice].che}. ${GUASTI[codice].fai}`);
      setFase("errore");
    }
  }, [code, annota]);

  // ══════════════════════════════════════════════════════════════════════
  //  IL GIRO: com'è la sala adesso
  // ══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    let vivo = true;
    /** L'impronta dell'ultima risposta. ⚠️ Chiedere ogni secondo va bene;
     *  RIDISEGNARE ogni secondo no. Prima ogni giro rimetteva a posto relatori,
     *  palco, messaggi e presenti — array nuovi ogni volta, quindi per React
     *  tutto diverso — e l'intero albero della sala si ridisegnava una volta al
     *  secondo, riquadri video compresi. Insieme alla lettura dei pixel è
     *  quello che ha fatto andare a scatti la diretta.
     *  Nove giri su dieci la risposta è IDENTICA a quella di prima: in quel
     *  caso non c'è niente da rifare. */
    let impronta = "";
    const giro = async () => {
      const s = await statoDiretta(code);
      if (!vivo) return;
      //  ⚠️ NON si esce dal giro: si saltano solo i `setState`. Sotto c'è la
      //   richiesta del lasciapassare, che dipende da `pass.current` — una
      //   cosa NOSTRA che cambia anche quando la risposta del server è
      //   identica. Uscendo di qui, chi viene fatto salire potrebbe non
      //   chiederlo mai.
      const adesso = JSON.stringify(s);
      const uguale = adesso === impronta;
      impronta = adesso;
      if (!s.trovata) {
        annota("sala non trovata", "W01");
        //  ⚠️ NON è un errore della diretta, ed è per questo che ha una
        //   schermata sua (`SalaInesistente`, montata più in basso): chi arriva
        //   qui non ha un guasto da risolvere — ha un link vecchio. Mostrargli
        //   la chat, il codice del guasto e un tasto «Riprova» vuol dire
        //   proporgli tre cose che non servono e farlo sentire in colpa per un
        //   errore che non è suo.
        setFase("rimossa");
        return;
      }
      if (!uguale) {
      if (s.titolo) setTitolo(s.titolo);
      setRegistrata(!!s.registrando);
      if (s.vista) setVista(s.vista);
      if (typeof s.percorso === "string") setPercorso(s.percorso);
      setRegiaPalco(s.regia ?? {});
      if (typeof s.whatsapp === "string") setWhatsapp(s.whatsapp);
      if (s.iniziataIl) setIniziataIl(s.iniziataIl);
      if (typeof s.inizioPrevisto === "string") setInizioPrevisto(s.inizioPrevisto);
      setRelatori(s.relatori ?? []);
      setCoda(Array.isArray(s.coda) ? s.coda : []);
      if (typeof s.contatore === "string") setContatore(s.contatore as never);
      if (s.sala) {
        setMessaggi(s.sala.messaggi ?? []);
        setFissato(s.sala.fissato ?? null);
        setPalco(s.sala.palco ?? []);
        setPresenti(s.sala.presenti ?? 0);
        //  ⚠️ Due numeri diversi e nessuno dei due è di troppo: `presenti` è
        //   quello che la sala MOSTRA — può essere il totale dei passati o gli
        //   iscritti — e `inSalaAdesso` è quante persone ci sono davvero. Il
        //   primo si legge, il secondo decide come si dispone la pagina.
        setInSala(s.sala.inSalaAdesso ?? 0);
        setIscritti(s.sala.iscritti ?? 0);
        setSoglia(s.sala.sogliaVisibile ?? 0);
      }
      }

      //  ── ⚠️ IL LASCIAPASSARE SI CHIEDE SUBITO ──────────────────────────
      //   Il pass viaggia nella risposta al battito, che parte ogni venti
      //   secondi: chi veniva fatto salire restava fino a venti secondi senza
      //   che gli succedesse niente — nessuna richiesta di microfono, nessun
      //   segno. Dall'altra parte sembrava che il comando non avesse
      //   funzionato, e si ripremeva.
      //   Il giro della sala passa ogni tre secondi e SA se sono sul palco:
      //   appena mi ci vedo, chiedo il pass senza aspettare il battito.
      //  ── ⚠️ IL MIO STATO LO SA GIÀ QUESTO GIRO ──────────────────────────
      //   Veniva SOLO dal battito, che passa ogni VENTI secondi: il relatore ti
      //   dava la parola e per venti secondi non succedeva niente — nessuna
      //   finestra, nessun segno. Dall'altra parte sembrava che il comando non
      //   fosse passato, e lo si ripremeva.
      //   Ma la riga del palco arriva qui dentro ogni tre secondi e mezzo, e
      //   dice già che cosa mi è stato concesso: leggerla qui accorcia l'attesa
      //   da venti secondi a tre, senza una richiesta in più.
      //  ⚠️ Il battito resta e continua a comandare sul PASS, che di qui non
      //   passa: è un segreto e la risposta di questo giro sta in cache.
      const miaRiga = (s.sala?.palco ?? []).find((p) => p.spettatore === io.current);
      setMioStato((miaRiga?.stato as StatoPalco | undefined) ?? null);
      if (miaRiga && miaRiga.stato !== "attesa" && !pass.current) void battitoRef.current?.();

      if (s.inOnda) {
        if (haAcconsentito.current) { if (!visione.current) void collega(); }
        else setFase((f) => (f === "onda" || f === "collego" ? f : "pronto"));
      } else {
        if (visione.current) { visione.current.chiudi(); visione.current = null; setFlussoRelatore(null); }
        setFase((f) => (f === "finito" ? "finito" : f === "onda" ? "finito" : "attesa"));
      }
    };
    /** ── ⚠️ IL RITMO CAMBIA CON QUELLO CHE STA SUCCEDENDO ────────────────
     *  Era un numero fisso, e il perché di ognuno dei quattro sta in
     *  `webinar/ritmo`. Qui conta solo il come: un `setTimeout` che si
     *  riprogramma, non un `setInterval` — un intervallo non si può cambiare
     *  senza rifarlo, e rifarlo a ogni cambio di fase vuol dire un giro perso
     *  o due giri sovrapposti proprio nel momento in cui la diretta comincia.
     *  ⚠️ Il ritmo si rilegge da un ref e non dalle dipendenze dell'effetto:
     *   questo effetto apre la connessione video, e farlo ripartire a ogni
     *   cambio di fase vorrebbe dire riattaccare la diretta ogni volta. */
    let prossimo: ReturnType<typeof setTimeout> | null = null;
    const riprogramma = () => {
      if (!vivo) return;
      prossimo = setTimeout(async () => {
        await giro();
        riprogramma();
      }, ritmoRef.current);
    };
    void giro().then(riprogramma);

    //  ⚠️ Tornando sulla pagina si chiede SUBITO, senza aspettare il giro: chi
    //   riprende in mano il telefono dopo dieci minuti vuole vedere adesso
    //   dov'è arrivata la diretta, non fra otto secondi. È il rovescio del
    //   rallentamento: si può rallentare tanto proprio perché il ritorno è
    //   immediato.
    const alRitorno = () => {
      if (document.visibilityState !== "visible") return;
      if (prossimo) clearTimeout(prossimo);
      void giro().then(riprogramma);
    };
    document.addEventListener("visibilitychange", alRitorno);

    return () => {
      vivo = false;
      if (prossimo) clearTimeout(prossimo);
      document.removeEventListener("visibilitychange", alRitorno);
      visione.current?.chiudi();
      visione.current = null;
      setFlussoRelatore(null);
      miaPubblicazione.current?.chiudi();
      smettiSorveglianza.current?.();
      mioMedia.current?.getTracks().forEach((t2) => t2.stop());
    };
  }, [code, collega]);

  // ══════════════════════════════════════════════════════════════════════
  //  IL BATTITO: dice che ci sono, e riporta indietro il lasciapassare
  // ══════════════════════════════════════════════════════════════════════
  /** ── ⚠️ IL RITMO SI AGGIORNA DA SÉ, IN UN EFFETTO SUO ──────────────────
   *  Piccolo e separato apposta: quello che tiene aperta la diretta non deve
   *  ripartire quando cambia la fase, perché ripartire vuol dire chiudere e
   *  riaprire la connessione video. Qui si scrive solo un numero in un ref.
   *  ⚠️ Si ascolta anche il passaggio in secondo piano: senza, il ritmo
   *   resterebbe quello di quando la pagina è stata lasciata. */
  useEffect(() => {
    const aggiorna = () => {
      ritmoRef.current = ritmoDelGiro({
        fase,
        visibile: typeof document === "undefined" || document.visibilityState === "visible",
      });
    };
    aggiorna();
    if (typeof document === "undefined") return;
    document.addEventListener("visibilitychange", aggiorna);
    return () => document.removeEventListener("visibilitychange", aggiorna);
  }, [fase]);

  //  ⚠️ Il battito serve anche al giro della sala, che è definito prima: si
  //   passa da un riferimento invece che dalla funzione, o le due dipendenze
  //   si inseguirebbero e il giro si rifarebbe a ogni battito.
  const battitoRef = useRef<null | (() => Promise<void>)>(null);

  const battito = useCallback(async () => {
    //  ⚠️ Dallo specchio della regia non si batte: si guarderebbe una sala che
    //   conta una persona in più a ogni anteprima aperta.
    if (specchio) return;
    try {
      const r = await fetch("/api/public/webinar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          azione: "battito", codice: code, spettatore: io.current, nome: nome || "Ospite",
          //  Da che schermo sto guardando. Non è un dato personale: è la
          //  larghezza della finestra, e serve a chi presenta per non mostrare
          //  una tabella a una sala piena di telefoni.
          larghezza: window.innerWidth, altezza: window.innerHeight,
        }),
      }).then((x) => x.json());
      //  ⚠️ IL LASCIAPASSARE ARRIVA SOLO DI QUI. Nello stato generale non c'è,
      //   perché quella risposta sta in cache e finirebbe servita a tutti.
      //  ⚠️ Messo alla porta: si smette di chiedere e si dice perché. Senza,
      //   la pagina continuerebbe a battere contro un 403 e chi legge vedrebbe
      //   solo una sala che non si popola mai.
      if (r?.bandito) { setBandito(true); return; }
      if (r?.io?.pass) pass.current = String(r.io.pass);
      setMioStato((r?.io?.stato as StatoPalco) ?? null);
    } catch { /* si riprova al giro dopo */ }
  }, [code, nome]);

  useEffect(() => {
    battitoRef.current = battito;
    void battito();
    const t = setInterval(() => void battito(), BATTITO_PRESENZA_MS);
    return () => clearInterval(t);
  }, [battito]);

  //  Appena il presentatore alza o abbassa il mio microfono, lo eseguo.
  useEffect(() => {
    const mio = palco.find((p) => p.spettatore === io.current);
    if (!mio) return;
    setMioMicrofono(mio.microfono);
    const traccia = mioMedia.current?.getAudioTracks()[0];
    //  `enabled = false` non spegne il dispositivo (la spia resta accesa) ma
    //  smette di mandare suono, ed è quello che serve: chi conduce vuole poter
    //  richiudere e riaprire il microfono senza che il browser richieda ogni
    //  volta il permesso.
    if (traccia) traccia.enabled = mio.microfono;
  }, [palco]);

  // ══════════════════════════════════════════════════════════════════════
  //  SALGO SUL PALCO
  // ══════════════════════════════════════════════════════════════════════
  //  Con che cosa si sta pubblicando adesso: serve a riconoscere il passaggio
  //  da «solo voce» a «voce e video».
  const modoPubblicato = useRef<StatoPalco | null>(null);
  const [salendo, setSalendo] = useState(false);
  const [erroreSalita, setErroreSalita] = useState("");

  /** ── ⚠️ SI SALE CON UN TOCCO, NON DA SOLI ────────────────────────────────
   *  Prima camera e microfono si aprivano da un effetto, appena il presentatore
   *  dava la parola. Non funzionava, e su iPhone in particolare: Safari
   *  BLOCCA IN SILENZIO la richiesta di camera e microfono che non nasce da un
   *  gesto della persona. Nessun errore, nessuna finestra: semplicemente non
   *  succedeva niente, e il presentatore vedeva un ospite muto senza sapere
   *  perché.
   *  Adesso compare un pulsante: il tocco è il gesto che serve al browser, e
   *  intanto è anche la cosa giusta da fare — la camera di una persona non si
   *  accende senza che lei dica di sì.
   */
  /** @param volutoConVideo  che cosa ha SCELTO la persona. Assente = quello che
   *   le è stato concesso.
   *  ⚠️ SI PUÒ SEMPRE SCENDERE DI UN GRADINO, MAI SALIRE: chi è stato fatto
   *   salire in sola voce non può accendersi la camera da sé — quella è una
   *   decisione di chi conduce. Chi invece ha avuto il video può entrare col
   *   solo microfono, ed è giusto che possa: nessuno deve trovarsi la propria
   *   faccia in diretta davanti a duecento persone perché non ha visto il
   *   secondo pulsante. */
  const salgo = async (volutoConVideo?: boolean) => {
    if (!mioStato || mioStato === "attesa" || !pass.current) return;
    setSalendo(true);
    setErroreSalita("");
    //  ⚠️ Fuori dal `try`: serve anche nel `catch`, per dire la frase giusta a
    //   chi stava entrando in sola voce — sentirsi nominare la camera che non
    //   si è mai chiesta fa cercare un problema che non c'è.
    const conVideo = mioStato === "video" && volutoConVideo !== false;
    //  ⚠️ Quello che ho SCELTO io, che è diverso da quello che sto pubblicando
    //   adesso: se chi conduce mi spegne la camera, sto pubblicando solo voce
    //   ma la camera l'avevo. Le due frasi da dire sono diverse — «sei entrato
    //   senza camera» e «la camera l'ha chiusa chi conduce» — e senza questa
    //   distinzione la seconda non si può dire.
    if (volutoConVideo !== undefined) sceltaConVideo.current = volutoConVideo;
    try {
      //  ⚠️ Camera e microfono si chiedono INSIEME, in una richiesta sola: il
      //   browser mostra una finestra sola, e non si finisce col microfono
      //   acceso e la camera no perché la seconda domanda è arrivata dopo.
      /** ── ⚠️ SI CHIEDE COL GARBO, E SE VA MALE SI RICHIEDE SENZA PRETESE ──
       *  `frameRate: { max: 24 }` era una richiesta DURA: `max` e `min` non
       *  sono desideri, sono condizioni. Una camera che sa fare solo trenta
       *  fotogrammi al secondo — e sono tantissime — faceva fallire tutto con
       *  `OverconstrainedError`, e la sala rispondeva «controlla che non li
       *  stia usando un'altra applicazione»: una frase che manda a cercare un
       *  problema che non esiste. Adesso ogni numero è un `ideal`, cioè un
       *  desiderio che la camera può non esaudire.
       *  ⚠️ E SE ANCHE COSÌ NON VA, si riprova UNA volta chiedendo il minimo
       *   indispensabile. Non è una toppa: è la differenza fra «entra con una
       *   qualità un po' diversa» e «non entra». Non si riprova se il permesso
       *   è stato negato — lì riprovare vuol dire solo un secondo pop-up. */
      const chiedo = (preciso: boolean): MediaStreamConstraints => ({
        audio: preciso
          ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
          : true,
        ...(conVideo
          ? { video: preciso ? { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } } : true }
          : {}),
      });
      if (!navigator.mediaDevices?.getUserMedia) {
        throw Object.assign(new Error("getUserMedia non esiste"), { name: "SenzaSupporto" });
      }
      /** ── ⚠️ NON SI RESTA MAI FUORI PER COLPA DELLA CAMERA ──────────────
       *  Tre tentativi, e il terzo rinuncia al video invece che alla persona:
       *   1. come vorremmo (640×360, 24 fotogrammi «ideali»);
       *   2. senza pretese, `{audio: true, video: true}` — copre le camere che
       *      non reggono quello che chiediamo;
       *   3. SOLO VOCE. Perché il punto non è avere il video: è entrare. Una
       *      persona invitata a parlare che si trova davanti «non riesco ad
       *      aprire la camera» e nessuna via d'uscita, resta fuori — e
       *      dall'altra parte c'è una sala che aspetta lei.
       *  ⚠️ Il permesso NEGATO ferma tutto e non si riprova: lì un secondo
       *   tentativo vuol dire solo un secondo pop-up rifiutato, e la risposta
       *   l'ha già data la persona.
       *  ⚠️ Il salto alla sola voce si DICE. Entrare mutilati senza saperlo è
       *   peggio che non entrare: si parla convinti di essere inquadrati. */
      let stream: MediaStream;
      let ripiegoSuVoce = false;
      const bloccante = (n: string) =>
        n === "NotAllowedError" || n === "PermissionDeniedError" || n === "SenzaSupporto";

      /** ── ⚠️ IL CATCH DELLA CAMERA COPRE SOLO LA CAMERA ────────────────
       *  Prima ce n'era UNO solo, attorno a tutta la salita: camera, aggancio
       *  al server della diretta, sorveglianza del microfono. Qualunque cosa
       *  fallisse — anche il collegamento, che con la camera non c'entra
       *  niente — la persona leggeva «non riesco ad aprire camera e
       *  microfono», e siccome il nome di quell'errore non è uno di quelli
       *  della camera finiva nel ramo «non so cosa sia»: il codice C08
       *  segnalato da telefono. Diagnosi sbagliata a monte, non frase
       *  sbagliata a valle.
       *  Adesso ogni fase ha il suo, e ogni fase dice la sua verità. */
      try {
        try {
          stream = await navigator.mediaDevices.getUserMedia(chiedo(true));
        } catch (primo) {
          const nome = String((primo as Error)?.name);
          if (bloccante(nome)) throw primo;
          annota(`camera rifiutata (${nome}), riprovo senza pretese`, "W11");
          try {
            stream = await navigator.mediaDevices.getUserMedia(chiedo(false));
          } catch (secondo) {
            const nome2 = String((secondo as Error)?.name);
            if (bloccante(nome2) || !conVideo) throw secondo;
            annota(`niente da fare con la camera (${nome2}), entro con la sola voce`, "W11");
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            ripiegoSuVoce = true;
          }
        }
      } catch (eCamera) {
        const nome = String((eCamera as Error)?.name || "");
        const detto = String((eCamera as Error)?.message || "").slice(0, 60);
        const spiega = spiegaErroreMedia(nome, conVideo);
        annota(`camera/microfono: ${nome || "senza nome"} — ${detto}`, "W11");
        //  ⚠️ IL CODICE MUTO NON SERVE A NIENTE. Un codice che vuol dire «non
        //   so cosa sia» senza dire cosa non so lascia chi legge esattamente
        //   dove era prima — ed è successo: è tornato un C08 nudo, e non c'era
        //   modo di capire da cosa. Quindi quando non lo so gli attacco tutto
        //   quello che ho: il nome se c'è, e se non c'è nemmeno quello la frase
        //   dell'errore. Fra i due, qualcosa che si possa riferire c'è sempre.
        const traccia = nome || detto;
        //  ⚠️ SE LA PAGINA È VECCHIA LO SI DICE PRIMA DI TUTTO IL RESTO: è la
        //   spiegazione che comprende tutte le altre, e senza di lei si va a
        //   cercare la causa in un programma diverso da quello che sta
        //   girando. Con la pagina aggiornata questa riga non compare mai.
        setErroreSalita(
          (paginaVecchia ? `${AVVISO_VECCHIA} ` : "")
          + (spiega.codice === "C08" && traccia
            ? `${spiega.testo} (${spiega.codice} · ${traccia})`
            : `${spiega.testo} (${spiega.codice})`),
        );
        setSalendo(false);
        return;
      }

      //  Se si stava già pubblicando in sola voce, si chiude e si rifà: la
      //  camera non si aggiunge a una connessione aperta senza rinegoziarla.
      if (miaPubblicazione.current) {
        miaPubblicazione.current.chiudi();
        miaPubblicazione.current = null;
        smettiSorveglianza.current?.();
        smettiSorveglianza.current = null;
        mioMedia.current?.getTracks().forEach((t) => t.stop());
      }

      mioMedia.current = stream;
      //  ⚠️ Si sale per quello che si ha DAVVERO, non per quello che si voleva:
      //   dichiarare «con video» senza una traccia video vuol dire un riquadro
      //   nero col proprio nome sopra per tutta la sala.
      const conVideoVero = conVideo && !ripiegoSuVoce;
      const p = await salgoSulPalco(code, { spettatore: io.current, pass: pass.current, conVideo: conVideoVero }, stream);
      if (ripiegoSuVoce) {
        setErroreSalita("Sei entrato senza camera: per adesso ti sentono e basta.");
      }
      miaPubblicazione.current = p;
      modoPubblicato.current = mioStato;

      //  L'icona che si illumina: si misura il proprio microfono e si avvisa
      //  solo ai cambi, non a ogni fotogramma.
      smettiSorveglianza.current = sorvegliaVoce(stream, (sta) => {
        setParlo(sta);
        void fetch("/api/public/webinar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ azione: "parlo", codice: code, spettatore: io.current, pass: pass.current, parla: sta }),
        }).catch(() => { /* è solo un pallino */ });
      });
    } catch (e) {
      console.error("[WEBINAR] non riesco a salire sul palco:", e);
      //  ⚠️ Il motivo si DICE. «Permission denied» qui vuol dire una cosa sola,
      //   e senza scriverlo la persona resta a fissare un pulsante che non
      //   fa niente.
      //  ⚠️ QUI LA CAMERA SI È GIÀ APERTA: quello che è fallito è il
      //   collegamento alla diretta, ed è un'altra cosa. Dirgli «controlla la
      //   camera» lo manda a cercare un problema che non ha — ed è quello che
      //   succedeva, perché questo `catch` copriva anche il pezzo di sopra.
      const nome = String((e as Error)?.name || "");
      const dettaglio = String((e as Error)?.message || "").slice(0, 80);
      annota(`non riesco a mettermi in diretta: ${nome} ${dettaglio}`, "W12");
      setErroreSalita(
        `La camera è pronta, ma la diretta non parte. Riprova fra un momento. (C09${nome ? ` · ${nome}` : ""})`,
      );
    } finally {
      setSalendo(false);
    }
  };

  //  Chi è stato fatto salire ma non ha ancora toccato il pulsante: è lo stato
  //  in cui va mostrato l'invito.
  /** ── ⚠️ L'INVITO È PER SALIRE, NON PER RESTARE ─────────────────────────
   *  Diceva anche «stai già pubblicando ma in un modo diverso da quello che
   *  dice la regia», e quel secondo caso era sbagliato: succede tutte le volte
   *  che chi conduce SPEGNE la camera a qualcuno già sul palco — lo stato
   *  passa da «video» ad «audio» — e la persona si vedeva ricomparire davanti
   *  la finestra «È il tuo turno», come se dovesse salire di nuovo.
   *  Due danni insieme, tutti e due segnalati:
   *   · non leggeva mai il messaggio che spiega cosa è successo, perché sopra
   *     c'era la finestra;
   *   · finché non ripremeva, la sua pubblicazione restava quella di prima e
   *     la camera arrivava NERA a tutta la sala.
   *  Adesso l'invito è solo per chi non sta pubblicando affatto. Il cambio di
   *  modo lo esegue la sala da sola, qui sotto. */
  const invitatoAParlare = !!mioStato && mioStato !== "attesa" && !miaPubblicazione.current;

  //  Fatto scendere: si chiude tutto e si torna spettatori.
  /** ── ⚠️ LA REGIA CAMBIA IL MODO, LA SALA SI ADEGUA DA SOLA ─────────────
   *  Chi conduce spegne la camera a una persona già sul palco: il suo stato
   *  passa da «video» ad «audio», e quello che sta pubblicando va rifatto —
   *  altrimenti continua a mandare un video che la regia ha chiuso, e alla
   *  sala arriva un rettangolo nero. Prima si aspettava che fosse la persona a
   *  ripremere un tasto; ma quella persona sta parlando, e soprattutto non ha
   *  chiesto niente: il comando l'ha dato chi conduce.
   *  ⚠️ Il permesso è già stato dato, quindi non compare nessuna finestra: si
   *   riapre camera e microfono in silenzio e si ripubblica.
   *  ⚠️ Un ref segna il modo che si sta già rifacendo: senza, il giro
   *   successivo — che arriva prima che il nuovo modo sia pubblicato —
   *   ripartirebbe da capo, e si rifarebbe la salita all'infinito. */
  const stoAdeguando = useRef<string | null>(null);
  useEffect(() => {
    if (!mioStato || mioStato === "attesa") return;
    if (!miaPubblicazione.current) return;
    if (modoPubblicato.current === mioStato) { stoAdeguando.current = null; return; }
    if (stoAdeguando.current === mioStato) return;
    stoAdeguando.current = mioStato;
    void salgo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mioStato]);

  useEffect(() => {
    if (mioStato && mioStato !== "attesa") return;
    if (!miaPubblicazione.current) return;
    miaPubblicazione.current.chiudi();
    miaPubblicazione.current = null;
    modoPubblicato.current = null;
    smettiSorveglianza.current?.();
    smettiSorveglianza.current = null;
    mioMedia.current?.getTracks().forEach((t) => t.stop());
    mioMedia.current = null;
    setParlo(false);
  }, [mioStato]);

  // ══════════════════════════════════════════════════════════════════════
  //  AGGANCIO CHI È SALITO, senza rifare la connessione
  // ══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const v = visione.current;
    if (!v || fase !== "onda") return;
    const nuove: { sessionId: string; trackName: string }[] = [];
    //  Un secondo relatore che entra a metà diretta va agganciato come chi
    //  sale sul palco: senza, lo sentirebbe solo chi si è collegato dopo di lui.
    for (const r of relatori) {
      for (const t of [r.audio, r.video]) {
        const chiave = `${r.sessionId}/${t}`;
        if (agganciate.current.has(chiave)) continue;
        agganciate.current.add(chiave);
        nuove.push({ sessionId: r.sessionId, trackName: t });
      }
    }
    for (const p of palco) {
      if (p.spettatore === io.current) continue; // la propria voce non si riascolta: è larsen
      if (!p.sessionId) continue;
      for (const t of [p.tracciaAudio, p.tracciaVideo]) {
        if (!t) continue;
        const chiave = `${p.sessionId}/${t}`;
        if (agganciate.current.has(chiave)) continue;
        agganciate.current.add(chiave);
        nuove.push({ sessionId: p.sessionId, trackName: t });
      }
    }
    if (!nuove.length) return;
    void aggiungiTracce(code, v.sessionId, v.pc, nuove, v.registra).catch((e) => {
      //  Se non ci si riesce, si dimentica: al giro dopo ci si riprova invece
      //  di restare per sempre senza sentire chi ha preso la parola.
      nuove.forEach((n) => agganciate.current.delete(`${n.sessionId}/${n.trackName}`));
      console.error("[WEBINAR] non riesco ad agganciare chi è salito:", e);
    });
  }, [palco, fase, code, relatori]);

  // ══════════════════════════════════════════════════════════════════════
  const invia = async () => {
    const testo = bozza.trim();
    if (!testo) return;
    if (!nome.trim()) return;
    //  ⚠️ L'aggancio si compone QUI e si azzera subito: se restasse acceso, il
    //   messaggio dopo — che quasi sempre è rivolto alla sala — partirebbe
    //   ancora indirizzato alla stessa persona senza che nessuno lo abbia
    //   chiesto. Rispondere è un gesto singolo, non una modalità.
    const daSpedire = conRisposta(testo, rispondoA);
    setBozza("");
    setRispondoA(null);
    salvaNome(nome);
    try {
      await fetch("/api/public/webinar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ azione: "scrivi", codice: code, spettatore: io.current, nome, testo: daSpedire, pass: pass.current }),
      });
    } catch { setBozza(testo); setRispondoA(rispondoA); }
  };

  /** La finestrella che spiega cosa vuol dire partecipare. Si apre PRIMA di
   *  alzare la mano: chi preme «chiedi di partecipare» sta chiedendo di sapere
   *  cosa succede, non di finire in diretta al primo tocco. */
  const [chiedoLaParola, setChiedoLaParola] = useState(false);
  /** A chi sto rispondendo. `null` = a nessuno, che è il caso normale. */
  const [rispondoA, setRispondoA] = useState<{ id: string; nome: string } | null>(null);
  /** Il numero a cui scrivere quando la diretta è finita. Vuoto = il
   *  presentatore non ne ha impostato uno, e la schermata di chiusura resta
   *  quella semplice: meglio nessun invito che un invito a scrivere nel
   *  vuoto. */
  const [whatsapp, setWhatsapp] = useState("");
  /** Da quando è cominciata. Il dato arrivava già e non lo usava nessuno: chi
   *  entra a metà vuole sapere quanto si è perso — è la differenza fra
   *  «comincio da qui» e «forse è quasi finita». */
  const [iniziataIl, setIniziataIl] = useState<string | null>(null);
  /** Quando è previsto l'inizio. Vuoto = nessun conto alla rovescia, e la sala
   *  d'attesa resta quella semplice: meglio nessun numero che uno inventato. */
  const [inizioPrevisto, setInizioPrevisto] = useState("");
  /** Quale numero sta mostrando la sala: cambia la parola accanto, non il
   *  numero — che arriva già scelto dal server. */
  const [contatore, setContatore] = useState<"adesso" | "totale" | "iscritti" | "niente">("adesso");
  const [adesso, setAdesso] = useState(() => Date.now());
  useEffect(() => {
    if (fase !== "onda" || !iniziataIl) return;
    //  Ogni venti secondi: i minuti cambiano lentamente, e un contatore al
    //  secondo su una pagina che ha già un video in corso è lavoro sprecato.
    const t = setInterval(() => setAdesso(Date.now()), 20_000);
    return () => clearInterval(t);
  }, [fase, iniziataIl]);
  /** ── IL CONTO ALLA ROVESCIA ─────────────────────────────────────────────
   *  ⚠️ BATTE OGNI SECONDO SOLO IN ATTESA. Tenere un intervallo da un secondo
   *   acceso durante la diretta vuol dire ridisegnare la pagina sessanta volte
   *   al minuto mentre c'è un video in corso: su un telefono si sente, e si
   *   sente proprio dove non si può — sui fotogrammi.
   *   Appena si va in onda si spegne da sé. */
  const [tic, setTic] = useState(() => Date.now());
  const inAttesa = fase === "attesa" || fase === "cerco" || fase === "pronto";
  useEffect(() => {
    if (!inAttesa || !inizioPrevisto) return;
    const t = setInterval(() => setTic(Date.now()), 1000);
    return () => clearInterval(t);
  }, [inAttesa, inizioPrevisto]);
  const manca = inizioPrevisto ? quantoManca(inizioPrevisto, tic) : null;

  const minutiInOnda = iniziataIl
    ? Math.max(0, Math.floor((adesso - Date.parse(iniziataIl)) / 60_000))
    : null;

  /** ── QUANTO È LARGO IL PALCO DAVVERO ────────────────────────────────────
   *  ⚠️ NON la finestra. Sul computer la chat si prende ventuno rem sulla
   *   destra: calcolare la disposizione sulla larghezza della finestra vuol
   *   dire credere di avere trecentotrenta punti che non ci sono, e mettere in
   *   fila un riquadro in più di quanti ce ne stiano — che poi esce dal bordo.
   *  Si misura l'elemento, e lo si rimisura quando cambia: girare il telefono o
   *   aprire la tastiera cambia questo numero senza cambiare la finestra. */
  const palcoRef = useRef<HTMLDivElement | null>(null);
  const [larghezzaPalco, setLarghezzaPalco] = useState(0);
  useEffect(() => {
    const el = palcoRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const o = new ResizeObserver((v) => setLarghezzaPalco(Math.round(v[0]?.contentRect.width ?? 0)));
    o.observe(el);
    return () => o.disconnect();
  }, []);
  const campoChat = useRef<HTMLInputElement | null>(null);

  /** ── L'ELENCO CHE SI APRE SCRIVENDO «@» ─────────────────────────────────
   *  ⚠️ CHI SI PUÒ CITARE: chi è sul palco più chi ha scritto in chat. Non
   *   «tutti i presenti»: in una sala da duecento persone quell'elenco sarebbe
   *   inservibile, e per giunta la sala non conosce i nomi di chi non ha mai
   *   parlato — sa solo quanti sono. Si cita chi si è visto o letto, che è
   *   esattamente chi si vuole citare.
   *  ⚠️ Senza doppioni e senza sé stessi: rispondersi da soli non serve, e due
   *   righe uguali nell'elenco fanno premere quella sbagliata. */
  const [tag, setTag] = useState<{ inizio: number; cerca: string } | null>(null);
  const citabili = useMemo(() => {
    const visti = new Map<string, string>();
    for (const p of palco) if (p.spettatore !== io.current) visti.set(p.spettatore, p.nome || "Ospite");
    for (const m of messaggi) {
      if (m.spettatoreId && m.spettatoreId !== io.current) visti.set(m.spettatoreId, m.autore || "Ospite");
    }
    return [...visti].map(([id, nome]) => ({ id, nome }));
  }, [palco, messaggi]);
  const suggeriti = tag ? trovaPersone(citabili, tag.cerca) : [];

  /** Aggiorna testo e stato dell'elenco insieme: sono la stessa cosa vista da
   *  due parti, e tenerli separati fa restare l'elenco aperto su un testo che
   *  non lo giustifica più. */
  const scegli = (nome: string) => {
    if (!tag) return;
    const r = scegliPersona(bozza, tag, nome);
    setBozza(r.testo);
    setTag(null);
    //  Il cursore torna dove deve, dopo il nome: senza, riprendendo a scrivere
    //  si finisce a metà messaggio.
    requestAnimationFrame(() => {
      const el = campoChat.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(r.cursore, r.cursore);
    });
  };

  const scriviInChat = (testo: string, cursore: number) => {
    setBozza(testo);
    setTag(tagAperto(testo, cursore));
  };

  const alzaMano = async () => {
    setChiedoLaParola(false);
    salvaNome(nome);
    //  ── ⚠️ SI VEDE SUBITO, POI SI CONFERMA ────────────────────────────────
    //   Prima il tasto cambiava faccia solo al giro dopo: fino a tre secondi e
    //   mezzo in cui premevi e non succedeva niente, e la reazione naturale è
    //   premere di nuovo — cioè alzare la mano due volte.
    //   Qui lo stato si scrive a mano subito e il giro dopo lo conferma. Se la
    //   richiesta fallisce si torna indietro: meglio un tasto che si spegne
    //   dicendo che non è passata, che uno acceso su una fila in cui non sei.
    setMioStato("attesa");
    const ok = await fetch("/api/public/webinar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ azione: "mano", codice: code, spettatore: io.current, nome: nome || "Ospite" }),
    }).then((r) => r.ok).catch(() => false);
    if (!ok) setMioStato(null);
  };

  const scendi = async () => {
    await fetch("/api/public/webinar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ azione: "scendo", codice: code, spettatore: io.current, pass: pass.current }),
    }).catch(() => { /* si riprova */ });
    setMioStato(null);
  };

  const entra = () => { haAcconsentito.current = true; void collega(); };

  //  ⚠️ Dallo specchio si entra DA SOLI, appena la diretta risulta in corso:
  //   chi conduce ha aperto il pannello per vedere la sala, e un tasto «Entra
  //   e ascolta» in mezzo gli nasconde proprio quello che è venuto a guardare.
  //   Vale solo lì: a chi arriva davvero il tocco si chiede sempre, perché è
  //   quel tocco a sbloccare l'audio sul suo apparecchio.
  useEffect(() => {
    if (!specchio || fase !== "pronto") return;
    haAcconsentito.current = true;
    void collega();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specchio, fase]);
  const inFila = palco.some((p) => p.spettatore === io.current && p.stato === "attesa");
  //  Il proprio posto in fila, contando da 1. Zero = non si è in fila.
  const mioPosto = coda.indexOf(io.current) + 1;
  const suPalco = !!mioStato && mioStato !== "attesa";
  const numero = numeroDaMostrare({ presenti, sogliaVisibile: soglia });
  //  ⚠️ Non `suPalco`, che qui sopra vuol già dire «io ho la parola»: due
  //   nomi uguali per due cose diverse nello stesso componente.
  const chiHaLaParola = palco.filter((p) => p.stato !== "attesa" && p.sessionId);
  //  ⚠️ STESSA FUNZIONE DELLA CONSOLE. Se la sala calcolasse il montaggio per
  //   conto suo, il presentatore vedrebbe una cosa e gli spettatori un'altra —
  //   e se ne accorgerebbe solo riguardando la registrazione.
  const inScena = chiVaInOnda(regiaPalco, chiHaLaParola.map((p) => p.spettatore));
  /** ── ⚠️ PRIMA DI «ENTRA» NON SI VEDE NIENTE DELLA SALA ─────────────────
   *  Il difetto: chi apriva il link vedeva già i riquadri di chi era sul palco,
   *  col pallino del microfono acceso, mentre al centro c'era ancora scritto
   *  «Entra e ascolta». Due messaggi opposti sulla stessa schermata — «la
   *  diretta è in corso e la stai già vedendo» e «devi ancora entrare» — e chi
   *  guarda non sa più se ha già cominciato o no.
   *  La regola è una sola: finché non hai premuto Entra, della sala non c'è
   *  niente. Non è una preferenza estetica — quei riquadri arrivano dal giro di
   *  aggiornamento, che gira anche prima del collegamento, e mostrarli
   *  significa promettere un audio che ancora non può arrivare. */
  const entrato = fase === "onda";

  /** ── QUANTO SCHERMO C'È DAVVERO, TASTIERA COMPRESA ──────────────────────
   *  ⚠️ `100dvh` NON BASTA SUL TELEFONO. Tiene conto delle barre del browser
   *   ma NON della tastiera: aprendola, la pagina resta alta come prima e la
   *   riga per scrivere finisce sotto i tasti — cioè proprio mentre la stai
   *   usando. È il difetto classico delle chat sul telefono, e si risolve in
   *   un modo solo: chiedere al browser quanto spazio è rimasto VISIBILE.
   *  `visualViewport` è quel numero. Dove non esiste (browser vecchi) si resta
   *   su `100dvh`, che è il comportamento di prima e non peggiora niente. */
  const [altezzaUtile, setAltezzaUtile] = useState<number | null>(null);

  /** ── ⚠️ QUI C'ERA UNA REGOLA CHE FACEVA SPARIRE DELLE COSE, ED È VIA ───
   *  Con la tastiera aperta lo schermo si dimezza, e per far spazio nascondevo
   *  la fila degli ospiti. Sembrava ragionevole e non lo era: chi tocca il
   *  campo per scrivere vede mezza schermata svuotarsi: sembra che qualcosa si
   *  sia rotto, non che si stia facendo spazio. Segnalato dal committente due
   *  volte — prima sul video, poi sulla fila — e la seconda volta ho capito che
   *  il difetto non era COSA nascondevo, era che nascondevo.
   *  Adesso resta tutto e a stringersi è solo l'elenco dei messaggi, che è la
   *  cosa che si può accorciare senza che nessuno debba chiedersi dove sia
   *  finita: i messaggi si scorrono, gli altri elementi no.
   *  ⚠️ `visualViewport` (qui sotto) resta e fa il lavoro vero: tiene la riga
   *   per scrivere DENTRO lo spazio visibile, che era il problema di partenza —
   *   il campo sotto la tastiera. */
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    if (!vv) return;
    const misura = () => setAltezzaUtile(Math.round(vv.height));
    misura();
    vv.addEventListener("resize", misura);
    vv.addEventListener("scroll", misura);
    return () => {
      vv.removeEventListener("resize", misura);
      vv.removeEventListener("scroll", misura);
    };
  }, []);

  /** ── ⚠️ CHI È SUL PALCO, SÉ STESSI COMPRESI ────────────────────────────
   *  Qui ci si toglieva dall'elenco, «perché è larsen». Il larsen però non lo
   *  fa il RIQUADRO, lo fa l'AUDIO: basta che il proprio video sia muto, che è
   *  quello che si fa adesso. Togliersi dall'elenco costava tre cose, tutte
   *  segnalate:
   *   · chi partecipava vedeva una diretta DIVERSA da tutti gli altri — con un
   *     ospite solo, cioè sé stesso, il suo palco risultava vuoto e restava la
   *     sola camera di chi conduce;
   *   · non poteva sapere com'era montato: in primo piano o come gli altri, la
   *     cosa che si vuole sapere di più quando si sta parlando;
   *   · sul telefono spariva anche la fila degli ospiti, perché il conto degli
   *     ospiti partiva già scalato di uno.
   *  Chi la regia ha messo fuori campo continua a non vedersi: lì «fuori
   *  campo» vuol dire invisibile per tutti, compreso lui. */
  const altriSulPalco = chiHaLaParola.filter((p) => inScena.elenco.includes(p.spettatore));
  //  Il relatore scende dal riquadro grande quando la regia ha messo grande
  //  qualcun altro: è il momento in cui uno del pubblico ha la parola.
  const relatoreInPrimoPiano = !inScena.primoPiano || inScena.primoPiano === "io";

  //  ── ⚠️ SU TELEFONO NON CI STANNO INSIEME ────────────────────────────────
  //   Una slide e una chat sullo stesso schermo alto dodici centimetri danno
  //   due cose illeggibili invece di una leggibile: la slide tagliata a metà
  //   parola, e la chat ridotta a due righe. È esattamente quello che si
  //   vedeva.
  //   Si fa come ogni app di dirette: una alla volta, e si passa da una
  //   linguetta. Il pallino sulla chat dice quanti messaggi sono arrivati da
  //   quando la si è lasciata, così non serve tornarci a controllare.
  //   ⚠️ Su tablet e computer restano affiancate: lì lo spazio c'è davvero.
  //  ⚠️ QUI STAVA IL CONTATORE DEI MESSAGGI NON LETTI, e con lui la scheda
  //   «Chat» del telefono. Non servono più: la chat non si nasconde più dietro
  //   una scheda, quindi non c'è più un «da quando l'hai lasciata».

  /** ── IL VIDEO È PARTITO, MA MUTO ────────────────────────────────────────
   *  Non è una preferenza: è il browser che ha rifiutato il suono (vedi
   *  webinar/attacca). Non è la causa del nero che si vedeva — quella era la
   *  disposizione, ed è misurata nella nota qui sotto — ma è la strada per cui
   *  un nero SENZA SPIEGAZIONE poteva tornare: prima un `play()` rifiutato non
   *  lasciava niente a schermo e niente in mano a chi guardava.
   *  ⚠️ E SI DEVE VEDERE. Una diretta muta senza avviso si guarda credendo che
   *   il relatore non stia parlando — e la si abbandona pensando che sia rotta. */
  const [audioBloccato, setAudioBloccato] = useState(false);
  const elVideo = useRef<HTMLVideoElement | null>(null);

  /** ── PERCHÉ È NERO ──────────────────────────────────────────────────────
   *  ⚠️ È LA DOMANDA CHE PER TRE VOLTE NON HA AVUTO RISPOSTA. Un rettangolo
   *   nero può voler dire tre cose completamente diverse — il relatore ha
   *   spento la camera, i fotogrammi non arrivano, oppure sta arrivando tutto
   *   e ci vuole un istante — e chi guarda non ha modo di distinguerle. Le
   *   prime due si distinguono benissimo QUI, e non dirlo è stata la ragione
   *   per cui «si vede nero» è tornato tre volte senza che si potesse capire
   *   di che nero si trattasse.
   *  `null` = va tutto bene, non si mostra niente. */
  const [motivoNero, setMotivoNero] = useState<"camera-spenta" | "niente-fotogrammi" | null>(null);



  //  Il relatore che si sta guardando adesso (con un solo relatore è l'unico).
  const cameraDelRelatore = relatori.length === 1 ? relatori[0]?.camera !== false : true;

  /** Come si chiama chi conduce. Serve a dirlo per nome nell'invito a
   *  partecipare: «parla con Marco» è una persona, «parla con il relatore» è
   *  un ruolo — e a una persona si risponde più volentieri.
   *  ⚠️ Il ripiego non è vuoto: una sala aperta prima che i nomi viaggiassero
   *   direbbe «parla con» e basta. */
  const nomeRelatore = (relatori[0]?.nome || "").trim() || "chi conduce";

  /** Si può chiedere la parola adesso? Lo decide chi conduce (vedi
   *  RegiaPalco.maniAperte). Assente = ancora no. */
  const maniAperte = !!regiaPalco.maniAperte;

  /** ── COME SI INCASTRA IL PALCO ADESSO ───────────────────────────────────
   *  La regola sta in `webinar/palco-tetris`, la stessa che usa la console: se
   *  la sala calcolasse la sua, chi conduce vedrebbe una disposizione e il
   *  pubblico un'altra.
   *  ⚠️ Si misura sulla LARGHEZZA DELLA SALA e sull'altezza utile, non sulla
   *   finestra: sul computer la chat si prende 21rem, e calcolare sulla
   *   finestra intera vorrebbe dire credere di avere trecento punti che non ci
   *   sono. */
  /** ── ⚠️ IL FACCIA A FACCIA VINCE SU TUTTO IL RESTO DEL MONTAGGIO ───────
   *  Se chi conduce ha messo qualcuno alla pari, quello è il montaggio: niente
   *  primo piano, niente metà e metà. Sono comandi che dicono cose diverse
   *  sullo stesso spazio, e lasciarli sommare vorrebbe dire un terzo montaggio
   *  che nessuno ha scelto.
   *  ⚠️ Si controlla che sia DAVVERO sul palco: chi esce mentre è in faccia a
   *   faccia lascerebbe metà schermo a un quadrato nero, e la regia non se ne
   *   accorge perché dalla sua parte l'ha tolto lei. */
  const sfidante =
    (regiaPalco.facciaAFaccia
      ? altriSulPalco.find((p) => p.spettatore === regiaPalco.facciaAFaccia)
      : null)
    //  ⚠️ ANCHE IL PRIMO PIANO PORTA QUI. Erano due montaggi diversi per lo
    //   stesso gesto — «voglio vedere bene questa persona» — e quello vecchio
    //   metteva due rettangoli 16:9 uno sopra l'altro a tutta larghezza: due
    //   mezzibusti sdraiati con mezzo metro di soffitto sopra. Segnalato con la
    //   foto. Adesso c'è una forma sola per «io e un altro», e sono due
    //   quadrati alla pari.
    ?? (inScena.primoPiano && inScena.primoPiano !== "io"
      ? altriSulPalco.find((p) => p.spettatore === inScena.primoPiano)
      : null)
    ?? null;
  //  ⚠️ Nella fila stanno tutti tranne chi è già grande nel quadrato: il
  //   riferimento è lo SFIDANTE e non più «chi è in primo piano», perché
  //   adesso i due gesti portano allo stesso montaggio e chi sta grande è
  //   sempre lui. Filtrare sul vecchio avrebbe lasciato la stessa persona due
  //   volte a schermo, grande sopra e piccola sotto.
  const disposizione = disponiPalco({
    larghezza: larghezzaPalco,
    altezza: (altezzaUtile ?? 800) - 44,
    ospiti: altriSulPalco.length,
    //  ⚠️ «C'è qualcuno di grande» adesso vuol dire «c'è uno sfidante», non
    //   «c'è un primo piano»: i due gesti portano allo stesso montaggio, e
    //   sono le due misure — quanti restano nella fila e quanto è alta — a
    //   dipendere da questo. Con il vecchio riferimento, mettendo qualcuno
    //   alla pari dalla scheda persona, la fila avrebbe fatto spazio per una
    //   faccia che stava già grande sopra.
    inPrimoPiano: !!sfidante,
  });
  const ospitiPiccoli = altriSulPalco.filter((p) => p.spettatore !== sfidante?.spettatore);

  /** ── ⚠️ QUAL È IL FLUSSO DEL RELATORE, DAVVERO ──────────────────────────
   *  QUESTA È LA CAUSA DELLA CAMERA NERA, trovata collegandosi alla diretta
   *  vera: il riquadro grande mostrava `v.stream`, il flusso «principale» che
   *  `guarda()` restituisce — e quel flusso era VUOTO. Misurato in produzione:
   *  `videoWidth 0`, `getTracks()` di lunghezza ZERO.
   *
   *  Perché. `guarda()` mette nel flusso principale solo le tracce che si
   *  chiamano «audio» e «video» — i nomi di quando il relatore era per forza
   *  uno solo. Da quando i relatori possono essere più d'uno le tracce si
   *  chiamano «audio-<id>» e «video-<id>», e vanno in un flusso PER PERSONA:
   *  giusto per il salotto, ma con un relatore solo lasciava il riquadro
   *  grande legato a un flusso in cui non entrava mai niente.
   *  Nessun errore, nessun codice di guasto: la trattativa con l'SFU riesce, le
   *  tracce arrivano, e semplicemente vanno da un'altra parte.
   *
   *  Qui si guarda dove sono finite davvero: se c'è un relatore solo, il suo
   *  flusso è quello per persona; il flusso principale resta il ripiego per le
   *  sale aperte quando i nomi erano gli altri. */
  const flussoDelRelatore =
    (relatori.length === 1 ? flussiRelatori.current.get(relatori[0].id) : null) ?? flussoRelatore;

  /** ── I FOTOGRAMMI STANNO DAVVERO ARRIVANDO? ─────────────────────────────
   *  Non si guarda l'immagine — un video tutto nero e un video fermo sono lo
   *  stesso rettangolo — ma il CONTATORE dei fotogrammi decodificati della
   *  connessione. Se non si muove per qualche secondo mentre la camera del
   *  relatore risulta accesa, allora è un guasto, e va detto.
   *  ⚠️ La soglia è generosa di proposito: un paio di secondi senza fotogrammi
   *   capitano su una rete mobile che cambia cella, e una scritta d'allarme che
   *   lampeggia a ogni semaforo è peggio di nessuna scritta. */
  useEffect(() => {
    if (fase !== "onda") { setMotivoNero(null); return; }
    if (!cameraDelRelatore) { setMotivoNero("camera-spenta"); return; }
    let vivo = true;
    /** Quanti fotogrammi ha decodificato CIASCUN flusso al giro precedente.
     *  ⚠️ Uno per flusso e non un massimo solo: il perché — e il difetto che
     *   ne nasceva — sta in `webinar/fotogrammi`. In due parole: chi teneva il
     *   massimo prima o poi scende dal palco, e da quel momento il conto
     *   leggeva «fermo» per sempre sopra un video che si vedeva benissimo. */
    let ultimi: Record<string, number> = {};
    let fermoDa = 0;
    const t = setInterval(async () => {
      const pc = visione.current?.pc;
      if (!pc || !vivo) return;
      try {
        const adesso: Record<string, number> = {};
        (await pc.getStats()).forEach((s: Record<string, unknown>) => {
          if (s.type === "inbound-rtp" && s.kind === "video") {
            //  La chiave è quella della statistica: identifica il flusso e
            //  resta la stessa finché quel flusso esiste.
            adesso[String(s.id ?? s.ssrc ?? "")] = Number(s.framesDecoded) || 0;
          }
        });
        if (!vivo) return;
        //  ⚠️ NESSUNA STATISTICA VIDEO CONTA COME «NON ARRIVA», e non come
        //   «non lo so». È il caso del relatore andato in onda senza camera —
        //   il microfono c'è, il video non è mai stato pubblicato — e uscendo
        //   di qui in silenzio la sala resterebbe davanti al nero muto, che è
        //   esattamente il difetto che si sta chiudendo.
        if (qualcunoAvanza(ultimi, adesso)) { fermoDa = 0; setMotivoNero(null); }
        else fermoDa += 1;
        ultimi = adesso;
        if (fermoDa >= 3) setMotivoNero("niente-fotogrammi");
      } catch { /* le statistiche non sono un motivo per rompere la sala */ }
    }, 2000);
    return () => { vivo = false; clearInterval(t); };
  }, [fase, cameraDelRelatore]);

  // ══════════════════════════════════════════════════════════════════════
  //  ⚠️ IL NOME SI CHIEDE ALL'INGRESSO, PRIMA DI ENTRARE
  //  Era una casella dentro la chat, in fondo: chi arrivava si trovava una
  //  sala in cui non poteva scrivere e non capiva perché — la casella del
  //  nome era l'ultima cosa che si guarda, sotto tutti i messaggi degli
  //  altri.
  //  Chiedendolo qui, prima, si risolvono due cose insieme: si entra sapendo
  //  come ci si chiama, e la chat sotto è già pronta all'uso.
  //  ⚠️ E SI CHIEDE UNA VOLTA SOLA: chi c'è già stato lo ritrova e passa
  //   dritto. Rifare la domanda a ogni ingresso è il modo più veloce di
  //   perdere chi torna alla seconda diretta.
  // ══════════════════════════════════════════════════════════════════════
  /** ── ⚠️ QUELLO CHE HA SCELTO CHI GUARDA, SE HA SCELTO ─────────────────
   *  `null` finché non tocca niente, ed è diverso da «ha scelto aperta»: solo
   *  così le regole in `webinar/regole-chat` possono decidere il punto di
   *  partenza senza scavalcare una scelta che nessuno ha fatto.
   *  ⚠️ Sta QUI, sopra le uscite anticipate qui sotto: React conta gli hook a
   *   ogni disegno e pretende sempre lo stesso numero. Sotto un `return`, il
   *   giorno che qualcuno entra senza nome il conto cambia e la sala si spegne
   *   con «qualcosa si è rotto». */
  const [chatVoluta, setChatVoluta] = useState<boolean | null>(null);

  /** Chi si è già iscritto non deve rifarlo a ogni apertura del link — e sono
   *  parecchie: si apre per controllare l'ora, si riapre il giorno dopo. */
  const [giaIscritto, setGiaIscritto] = useState(false);
  useEffect(() => {
    try { setGiaIscritto(localStorage.getItem(`hg_iscritto_${code}`) === "1"); } catch { /* pazienza */ }
  }, [code]);

  /** ── ⚠️ QUESTA PAGINA STA GIRANDO L'ULTIMA VERSIONE? ───────────────────
   *  Il perché sta in `webinar/versione`. In breve: una scheda lasciata aperta
   *  continua a far girare i file di prima, e i suoi guasti sono quelli della
   *  versione vecchia — che si vanno a cercare nel programma di adesso, dove
   *  non ci sono. È successo con un codice C08 che nel programma pubblicato
   *  non può più esistere. */
  const paginaVecchia = useVersioneVecchia();

  /** ── ⚠️ SIAMO SU UNO SCHERMO LARGO? ────────────────────────────────────
   *  La soglia è la STESSA del disegno (`sala:` di Tailwind, 1024 punti): è lì
   *  che il palco e la chat smettono di impilarsi e diventano due colonne. Se
   *  qui ne usassi un'altra, ci sarebbe una fascia di schermi in cui la regola
   *  dice «c'è posto per tutte e due» e il disegno le impila lo stesso.
   *  ⚠️ Si riascolta: si gira un tablet, si trascina una finestra da un
   *   monitor all'altro, e la risposta cambia. */
  const [largo, setLargo] = useState(
    () => typeof window !== "undefined" && window.matchMedia(SOGLIA_DUE_COLONNE).matches,
  );
  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia(SOGLIA_DUE_COLONNE);
    const senti = () => setLargo(m.matches);
    senti();
    m.addEventListener("change", senti);
    return () => m.removeEventListener("change", senti);
  }, []);

  /** Lo spazio vero in cui stanno i due quadrati del faccia a faccia. Misurato
   *  e non dedotto: la chat si apre e si chiude, la fila degli ospiti compare
   *  e sparisce, e ognuna delle due cambia quanto resta. */
  const [duelloRif, spazioDuello] = useMisura<HTMLDivElement>();

  //  ⚠️ Nello specchio non si chiede il nome: chi guarda sa già chi è, e una
  //   casella davanti all'anteprima nasconde proprio quello che si è venuti a
  //   vedere.
  if (!bandito && !nome.trim() && !specchio) {
    return (
      <div className="bg-blueprint flex min-h-[100dvh] flex-col items-center justify-center px-5 text-white">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center">
          <p className="sala-etichetta flex items-center justify-center gap-2 text-white/40">
            <Radio className="h-3.5 w-3.5" /> Hair Genius Labs
          </p>
          <h1 className="mt-2 text-lg font-semibold leading-tight">{titolo || "Webinar"}</h1>
          <p className="mt-2 text-sm text-white/55">
            Come ti chiami? Serve solo per la chat e per quando chiedi la parola.
          </p>
          <input
            value={bozzaNome}
            onChange={(e) => setBozzaNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && bozzaNome.trim()) { salvaNome(bozzaNome); setNome(bozzaNome); } }}
            autoFocus
            placeholder="Il tuo nome"
            className="mt-4 w-full rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2.5 text-center text-base outline-none placeholder:text-white/30 focus:border-brand"
          />
          <button
            onClick={() => { if (bozzaNome.trim()) { salvaNome(bozzaNome); setNome(bozzaNome); } }}
            disabled={!bozzaNome.trim()}
            className="mt-3 w-full rounded-xl bg-brand px-5 py-2.5 text-base font-semibold text-white shadow-lg shadow-brand/30 transition hover:brightness-110 disabled:opacity-40"
          >
            Entra
          </button>
          {/*  Si dice PRIMA che non servono camera e microfono: è la domanda
              che si fa chiunque veda un modulo prima di una diretta. */}
          <p className="sala-piccolo mt-3 text-white/40">
            Camera e microfono non servono.
          </p>
        </div>
      </div>
    );
  }

  //  ⚠️ Messo alla porta: una schermata sola, senza chat e senza video. Non
  //   si lascia la pagina com'era con le cose che smettono di funzionare una
  //   per una — quello si legge come un guasto, e si riprova per venti minuti.
  if (bandito) {
    return (
      <div className="bg-blueprint flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center text-white">
        <ShieldBan className="h-8 w-8 text-white/30" />
        <p className="text-base font-medium">Non puoi partecipare a questa diretta</p>
        <p className="max-w-sm text-sm text-white/50">
          Se pensi che sia un errore, chiedi a chi ti ha mandato il link.
        </p>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  //  ⚠️ L'IMPAGINAZIONE, RIFATTA DA CAPO
  //
  //  Prima era una colonna sola che cambiava faccia a seconda di cosa c'era in
  //  onda, e con i contenuti diventava un guazzabuglio: la cornice, il video
  //  del relatore, i riquadri del palco e la chat si contendevano lo stesso
  //  spazio, e sul telefono finivano uno sopra l'altro.
  //
  //  Adesso la struttura è UNA SOLA e non cambia mai — quello che cambia è
  //  cosa ci sta dentro:
  //
  //     ┌──────────────── palco ────────────────┬── sala ──┐
  //     │  la cosa da guardare (a tutta area)   │  chat    │
  //     │  + le facce, piccole e spostabili     │  +       │
  //     ├───────────────────────────────────────┤  scrivi  │
  //     │  chi ha preso la parola (se c'è)      │          │
  //     └───────────────────────────────────────┴──────────┘
  //
  //  · TELEFONO — le due colonne si impilano: palco sopra a misura fissa,
  //    chat sotto che prende tutto il resto e scorre da sola. Il palco NON si
  //    allunga col contenuto, o la chat sparirebbe sotto la piega.
  //  · TABLET — uguale al telefono ma il palco è più alto: c'è spazio, e una
  //    slide su una striscia non si legge.
  //  · COMPUTER — due colonne affiancate, chat a destra a larghezza fissa.
  //
  //  ⚠️ E LA CHAT NON SPARISCE MAI. Era il difetto peggiore: mentre il
  //   relatore mostrava le slide, la chat veniva schiacciata fuori schermo —
  //   cioè proprio mentre serve, perché è lì che si fanno le domande su quello
  //   che si sta vedendo.
  // ══════════════════════════════════════════════════════════════════════
  const mostrandoContenuti = fase === "onda" && vista === "contenuti" && !!percorso;

  //  ⚠️ Un contenuto in onda batte anche il faccia a faccia: se stai mostrando
  //   una slide, la slide È la cosa da guardare — le due facce tornano appena
  //   la togli, senza che tu debba ricordarti di rimetterle.
  //  ⚠️ SOLO A DIRETTA COLLEGATA. Senza questo controllo i due quadrati si
  //   disegnavano anche PRIMA di entrare, al posto della schermata con «Entra
  //   e ascolta»: chi apriva il link mentre era in corso un dibattito restava
  //   fuori dalla diretta senza niente da premere. Trovato aprendo la sala da
  //   spettatore — e non ci sarebbe stato modo di accorgersene dal codice,
  //   perché il montaggio in sé era giusto.
  const inDuello = fase === "onda" && !!sfidante && !mostrandoContenuti;
  const duo = duello(spazioDuello.larghezza, spazioDuello.altezza);

  //  ⚠️ `inSala` e NON il numero mostrato in alto. Quello lì può essere il
  //   totale dei passati o gli iscritti, a seconda di come è impostata la sala:
  //   con «iscritti» valeva 240 in una stanza con dentro due persone, e la chat
  //   partiva chiusa come se ci fosse la folla. Qui serve quante persone ci
  //   sono ADESSO — è di loro che la chat si riempie.
  /** ── ⚠️ IL PROPRIO VIDEO NON TORNA INDIETRO DALLA DIRETTA ──────────────
   *  Chi sale sul palco manda la sua camera al server, che la gira agli altri
   *  — non a lui. Cercando il proprio flusso fra quelli ricevuti si trova
   *  sempre niente, e il risultato era che l'unica persona che non si vedeva
   *  era proprio quella che stava parlando: dall'altra parte tutti la
   *  guardavano e lei vedeva un rettangolo col suo nome sopra, senza modo di
   *  sapere se era inquadrata, se era al buio, se la camera era coperta.
   *  Il proprio video ce l'abbiamo già in casa: è quello che stiamo mandando. */
  const flussoDi = (chiave: string) =>
    chiave === io.current ? mioMedia.current : flussiPalco.current.get(chiave) || null;

  const chat = regolaChat({
    persone: inSala,
    contenuti: mostrandoContenuti,
    scelta: chatVoluta,
    largo,
  });
  const chatAperta = chat.aperta;


  //  ⚠️ ESCE PRIMA DI TUTTO IL RESTO. Non è una schermata «sopra» la sala: è
  //   al suo posto. Con la sala sotto resterebbero la chat, il contatore e la
  //   riga per scrivere — comandi per una stanza che non esiste.
  if (fase === "rimossa") return <SalaInesistente logo={logoStudio} />;

  /** ── ⚠️ IL TASTO «PARTECIPA», SCRITTO UNA VOLTA SOLA ───────────────────
   *  Compare in due punti diversi dell'intestazione — accanto al marchio sul
   *  telefono, in fondo alla riga sul computer — e sono DUE POSTI, non due
   *  tasti: scrivendolo due volte, il giorno che cambia il colore o la regola
   *  di quando si accende, cambia in uno solo. */
  /** ── ⚠️ APRI E CHIUDI LA CHAT ──────────────────────────────────────────
   *  Sta nell'intestazione e non dentro la chat: un comando per far ricomparire
   *  una cosa non può stare dentro la cosa scomparsa.
   *  ⚠️ Dice cosa SUCCEDE se lo premi, non come sta adesso: «Chat» quando è
   *   chiusa, «Chiudi» quando è aperta. Un tasto che descrive lo stato invece
   *   dell'effetto si legge al contrario una volta su due.
   *  ⚠️ E NON C'È SEMPRE: in una sala piccola la chat non si chiude, quindi il
   *   tasto sparisce del tutto invece di restare lì disabilitato. Un comando
   *   spento va comunque letto, capito e scartato ogni volta che l'occhio ci
   *   passa sopra. Chi decide è `regolaChat`. */
  const vestito = vestitoDelTasto(chatAperta);
  const tastoChat = fase === "onda" && chat.tasto ? (
    <button
      onClick={() => setChatVoluta(!chatAperta)}
      title={chatAperta ? "Nascondi la chat e allarga la diretta" : "Mostra la chat"}
      //  ⚠️ COLORE, ICONA E SCRITTA VENGONO TUTTI DA `vestitoDelTasto`, in
      //   `webinar/regole-chat`, dove la scelta è dichiarata a parole ed è
      //   sotto prova. Erano tre ternari sparsi qui dentro, e la combinazione
      //   si è ribaltata tre volte fra una richiesta e l'altra: per sapere
      //   com'era messa bisognava leggere una classe CSS lunga tre righe.
      //   Da un posto solo non può più succedere che due delle tre dicano una
      //   cosa e la terza un'altra.
      className={`sala-piccolo flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 font-semibold transition ${
        vestito.colore === "verde"
          ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
          : "border-white/20 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
      }`}
    >
      {vestito.icona === "pieno"
        ? <MessageSquare className="h-4 w-4" />
        : <MessageSquareOff className="h-4 w-4" />}
      {/*  ⚠️ LA PAROLA C'È SEMPRE, anche sul telefono. Da sola l'icona non si
            capiva: un fumetto barrato può voler dire «chat spenta», «non
            scrivere», «silenzia». Due parole tolgono il dubbio, e lo spazio per
            metterle si è trovato spostando altrove il contatore — che è
            un'informazione, mentre questi due sono gli unici comandi. */}
      <span>{vestito.scritta}</span>
    </button>
  ) : null;

  const tastoPartecipa = entrato && !suPalco && !invitatoAParlare ? (
    <button
      onClick={() => (inFila ? undefined : setChiedoLaParola(true))}
      disabled={inFila}
      title={
        inFila ? "Sei in fila per parlare"
        : maniAperte ? "Chiedi di partecipare alla diretta"
        : "Non è ancora il momento: tocca per sapere quando"
      }
      className={`sala-piccolo flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 font-bold text-white transition sm:px-4 ${
        inFila
          ? "bg-white/10 text-white/60"
          : maniAperte
            ? "tasto-partecipa bg-blue-500 shadow-lg shadow-blue-500/40 hover:bg-blue-400"
            : "bg-white/10 hover:bg-white/15"
      }`}
    >
      <Hand className="h-4 w-4 shrink-0" />
      <span>{inFila ? "In fila" : "Partecipa"}</span>
    </button>
  ) : null;

  return (
    /*  ── ⚠️ QUI C'ERA UN'ALTEZZA IMPOSTA A MANO, ED È VIA ──────────────────
        Misuravo lo spazio visibile con `visualViewport` e ci schiacciavo dentro
        tutta la pagina. Sulla carta risolveva il campo che finisce sotto la
        tastiera; in pratica, aprendo la tastiera, TUTTO si rimpiccioliva
        insieme — video e chat compresi — e chi tocca il campo per scrivere vede
        la schermata accartocciarsi. Segnalato due volte, e la seconda ho
        capito che il rimedio era peggio del male.
        `100dvh` e basta: il browser sa già portare in vista il campo che ha il
        cursore, e lo fa senza toccare niente di quello che c'è sopra. */
    <div className="bg-blueprint flex h-[100dvh] flex-col overflow-hidden text-white">
      {/* ══ L'INTESTAZIONE ═══════════════════════════════════════════════
            ⚠️ ERA UNA RIGA CHE DICEVA IL TITOLO E BASTA, e su tre schermi
             diversi diceva le stesse due cose. Qui invece ci sono le quattro
             informazioni che chi guarda cerca davvero, e ognuna risponde a una
             domanda che altrimenti si fa a voce in chat:
              · DI CHI È — il marchio: su un link arrivato per messaggio è
                l'unica cosa che dice che sei nel posto giusto;
              · SE È COMINCIATA — «in diretta» col pallino che pulsa, e da
                QUANTO: chi entra a metà vuole sapere se ha perso dieci minuti
                o un'ora, ed è la differenza fra restare e chiudere;
              · QUANTI SONO — una sala piena si guarda diversamente da una
                vuota;
              · SE SI REGISTRA — non è cortesia, è un obbligo: chi sta per
                parlare deve saperlo PRIMA.
            ⚠️ E «PARTECIPA» STA QUI. Era in fondo, accanto al campo della chat,
             dove si guarda solo quando si sta già scrivendo: l'unica azione
             che vale più di un messaggio stava nel posto in cui la si trova
             per ultima. Qui è in alto, ha un colore che non appartiene al
             resto della schermata, e passa un riflesso — perché in mezzo a
             pastiglie che si leggono e basta, una cosa da PREMERE deve
             sembrare diversa da una da leggere. */}
      {/*  ⚠️ DUE RIGHE SUL TELEFONO, UNA DA TABLET IN SU — ED È UNA SCELTA,
            non un ripiego. Su 375 punti, fra marchio, titolo, contatore e il
            tasto, allo stato restavano centodieci punti: «da 22 min» e «REC»
            venivano tagliati. Un avviso di registrazione tagliato è l'unica
            cosa qui dentro che non si può permettere — chi entra in una sala
            registrata deve saperlo PRIMA di parlare.
            Due righe di quarantanove punti l'una costano meno di
            un'informazione persa. */}
      {/* ══ L'INTESTAZIONE ═══════════════════════════════════════════════
            ⚠️ NIENTE TITOLO. C'era scritto «Webinar» accanto al marchio: è la
             parola che descrive la pagina a chi l'ha costruita, non a chi la
             guarda — quello sa benissimo di essere a un webinar, ce l'ha
             davanti. Occupava il posto migliore della schermata per non dire
             niente, e sul telefono costava una riga intera.
            Restano le cose che DICONO qualcosa: di chi è, che è in diretta, da
            quanto, se si registra, quanti sono, e l'unica cosa da premere.
            ⚠️ Tolto il titolo ci sta tutto su UNA riga anche sul telefono. */}
      {/* ══ L'INTESTAZIONE ═══════════════════════════════════════════════
            ⚠️ DUE RIGHE SUL TELEFONO E SUL TABLET, UNA SUL COMPUTER — ed è il
             prezzo di un marchio che si vede. Su 375 punti, con il logo grande
             abbastanza da riconoscersi, in una riga sola ci stanno il logo e il
             tasto e basta: lo stato e l'avviso di registrazione restavano
             fuori. Una riga in più costa trentotto punti; un marchio
             illeggibile costa il momento in cui chi apre il link capisce di
             essere nel posto giusto.
            ⚠️ La riga in alto porta le due cose che devono saltare all'occhio —
             DI CHI È e l'unica cosa da premere. Quella sotto le informazioni,
             che si leggono in un secondo momento. */}
      {/* ══ L'INTESTAZIONE ═══════════════════════════════════════════════
            Una riga sola, tre zone: chi è · come sta · cosa si può fare.
            ⚠️ IL MARCHIO NON DEVE SCHIACCIARE IL RESTO. A undici rem occupava
             il quaranta per cento della larghezza e mandava tutto il resto a
             capo: un marchio grande non si nota di più, si nota SOLO lui.
             Trentadue punti di altezza bastano a riconoscerlo, che è quello
             che deve fare. */}
      {/*  ⚠️ SUL TELEFONO NON CI STAVA. Misurato: marchio 112 + contatore 119
            + «Partecipa» 108, più tre spazi da 12, fa 387 punti su 375 — e il
            tasto più importante della pagina finiva tagliato a metà fuori
            dallo schermo. Meno spazio fra le voci e marchio più stretto solo
            sul telefono: 339, con trentasei punti di margine. */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 bg-white/[0.03] px-3 sm:h-16 sm:gap-3 sm:px-4">
        {logoStudio ? (
          <img
            src={logoStudio}
            alt=""
            className="h-7 w-auto max-w-[5.5rem] shrink-0 object-contain object-left sm:h-8 sm:max-w-[9rem]"
          />
        ) : (
          <span className="sala-etichetta shrink-0 text-white/70">Hair Genius</span>
        )}

        {/*  ── COME STA LA DIRETTA ──────────────────────────────────────
              ⚠️ Qui c'è SOLO lo stato quando NON è in onda: appena parte, il
               bollino passa sul video, dov'è il suo posto. Tenerne due —
               uno qui e uno lì — vorrebbe dire dire la stessa cosa due volte
               nella stessa schermata. */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/*  ⚠️ «IN ATTESA» SOLO SE SI ASPETTA DAVVERO. Diceva «in attesa»
                per ogni fase diversa da «onda», e in fase «pronto» — la
                diretta È cominciata, sei tu che non sei ancora entrato — la
                schermata si contraddiceva: l'intestazione diceva «in attesa» e
                due centimetri sotto un bollino rosso diceva «in diretta».
                Chi legge non sa a quale dei due credere, e in dubbio se ne va.
               Adesso qui c'è scritto qualcosa solo quando è quello che sta
               succedendo davvero: si aspetta, o è finita. */}
          {(fase === "attesa" || fase === "finito") && (
            <span className="sala-micro uppercase tracking-wide shrink-0 text-white/35">
              {fase === "finito" ? "conclusa" : "in attesa"}
            </span>
          )}
          {registrata && fase === "onda" && (
            <span className="sala-micro uppercase tracking-wide flex shrink-0 items-center gap-1.5 text-white/40">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              si registra
            </span>
          )}
        </div>

        {numero !== null && (
          <button
            onClick={() => setElencoAperto((v) => !v)}
            title={
              contatore === "totale" ? "Quante persone sono passate da questa diretta"
              : contatore === "iscritti" ? "Quante persone si sono iscritte"
              : "Chi c'è in sala adesso"
            }
            //  ⚠️ SUL TELEFONO NON STA QUI. Con le due scritte per esteso la
            //   riga non ci stava, e la scelta è fra un'informazione e due
            //   comandi: vince chi si preme. Il numero non sparisce — si
            //   sposta sopra il palco, dove lo mettono tutti quelli che
            //   trasmettono, e da tablet in su torna quassù.
            className="sala-piccolo hidden h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 font-semibold text-white/60 transition hover:bg-white/10 hover:text-white sm:flex"
          >
            <Users className="h-4 w-4" />
            <span className="tabular-nums">{numero}</span>
            {/*  ⚠️ LA PAROLA ACCANTO NON È DECORAZIONE. «148» da solo si legge
                  come «adesso ci sono 148 persone»: se quel numero è il totale
                  di chi è passato, il numero è vero ma la frase che si forma in
                  testa a chi legge è falsa — ed è esattamente la cosa che si
                  sta evitando. Da tablet in su c'è lo spazio per dirlo. */}
            {/*  ⚠️ LA PAROLA ACCANTO NON È DECORAZIONE. «148» da solo si legge
                  come «adesso ci sono 148 persone»: se quel numero è il totale
                  dei passati o degli iscritti, il numero è vero ma la frase che
                  si forma in testa a chi legge è falsa — ed è esattamente la
                  cosa che si sta evitando.
                 ⚠️ Sugli ISCRITTI la parola c'è SEMPRE, anche sul telefono: lì
                  il numero non ha niente a che vedere con chi è collegato
                  adesso, e senza l'etichetta si leggerebbe per quello che non
                  è. Sui «passate» resta una precisazione, e da tablet in su. */}
            {contatore === "iscritti" && <span className="sala-micro uppercase tracking-wide text-white/40">iscritti</span>}
            {contatore === "totale" && (
              <span className="sala-micro uppercase tracking-wide hidden text-white/40 sm:inline">passate</span>
            )}
          </button>
        )}

        {/*  ⚠️ Sta PRIMA dei due comandi, non in fondo: se la pagina è
              vecchia, quello che si preme dopo si comporta in un modo che non
              si può spiegare. */}
        {paginaVecchia && (
          <button
            onClick={() => window.location.reload()}
            title="Questa scheda sta girando una versione vecchia della sala"
            className="sala-piccolo flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-amber-400/50 bg-amber-400/15 px-2.5 font-semibold text-amber-200 transition hover:bg-amber-400/25"
          >
            <RotateCw className="h-4 w-4" />
            <span className="hidden sm:inline">Ricarica</span>
          </button>
        )}
        {tastoChat}
        {tastoPartecipa}
      </header>

      {daRegia && (
        <p className="sala-piccolo shrink-0 border-b border-white/10 bg-white/[0.03] px-3 py-2 text-white/50">
          Sei in sala come spettatore. Per condurre, entra col PIN da presentatore e riapri
          la regia.
        </p>
      )}

      {!!fissato && (
        <p className="flex shrink-0 items-start gap-2 border-b border-amber-400/25 bg-amber-400/10 px-3 py-2">
          <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
          <span className="sala-piccolo whitespace-pre-wrap text-amber-50">{fissato.testo}</span>
        </p>
      )}

      {elencoAperto && palco.length > 0 && (
        <div className="shrink-0 border-b border-white/10 px-2 py-1.5">
          <ElencoPalco palco={palco} />
        </div>
      )}

      {mioPosto > 0 && (
        <div className="shrink-0 border-b border-amber-400/25 bg-amber-400/10">
          <button onClick={() => setCodaAperta((v) => !v)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left">
            <Hand className="h-3.5 w-3.5 shrink-0 text-amber-300" />
            <span className="sala-piccolo min-w-0 flex-1 text-amber-50">
              {mioPosto === 1 ? "Sei il prossimo a parlare" : `Sei il ${mioPosto}º della fila`}
            </span>
            <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-amber-300 transition ${codaAperta ? "rotate-180" : ""}`} />
          </button>
          {codaAperta && (
            <div className="max-h-28 overflow-y-auto border-t border-amber-400/20 px-3 py-1.5">
              {coda.map((k, n) => (
                <p key={k} className={`sala-piccolo py-0.5 ${k === io.current ? "font-semibold text-amber-100" : "text-amber-200/50"}`}>
                  {n + 1}. {k === io.current ? "tu" : "un altro spettatore"}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── ⚠️ QUI C'ERANO DUE SCHEDE, «Diretta» e «Chat» ─────────────────
            Erano nate per non far scendere la chat sotto la piega, e hanno
            creato un difetto peggiore: la diretta da sola prendeva TUTTA
            l'altezza del telefono — 735 punti su 812 — e dentro ci finiva un
            video 16:9 alto duecento. Sopra e sotto restavano due bande nere che
            erano il settanta per cento dello schermo. Misurato, non supposto: è
            la ragione per cui su mobile «si vedeva nero».
           Adesso il video sta nel suo 16:9 e la chat prende quello che avanza,
           che è come guarda una diretta chiunque abbia un telefono in mano —
           e per giunta la chat è di nuovo sempre in vista, che era la richiesta
           di partenza. Le schede non servono più: non c'era niente da
           alternare, c'erano due cose che ci stanno insieme. */}
      {/* ══ IL CORPO: palco e sala ═══════════════════════════════════ */}
      <div className="flex min-h-0 flex-1 flex-col sala:flex-row">
        {/* ── IL PALCO ───────────────────────────────────────────────
            ⚠️ Altezza FISSA sul telefono e sul tablet, non «quanto serve»:
            se cresce col contenuto spinge la chat sotto la piega, ed era
            esattamente il difetto. Sul computer prende quello che avanza. */}
        {/*  ⚠️ SUL TELEFONO IL PALCO SPARISCE QUANDO SI LEGGE LA CHAT, e non
              si restringe: sono due schede, non due colonne. Sul computer c'è
              posto per tutte e due, e il palco si allarga solo quando la chat
              è chiusa.
             ⚠️ Con un contenuto in onda il palco prende TUTTA l'altezza anche
              sul telefono: una slide dentro una striscia 16:9 alta duecento
              punti non si legge, ed è metà del motivo per cui la chat si
              chiude da sola. */}
        <div
          ref={palcoRef}
          className={`${
            mostrandoContenuti
              ? chatAperta
                ? "hidden min-h-0 flex-1 sala:flex"
                : "flex min-h-0 flex-1"
              : "flex"
          //  ── ⚠️ IMPILATI, IL PALCO NON SI PRENDE TUTTO ────────────────
          //   Sotto i 1024 punti palco e chat si impilano, e il palco cresceva
          //   quanto voleva: su una finestra da 1000×650 — cioè un browser
          //   normale su un portatile, non un telefono — due riquadri
          //   affiancati riempivano l'altezza e alla chat restava ZERO. Da
          //   fuori la chat «spariva appena entrava la seconda persona»,
          //   perché è entrando in due che il palco diventa alto.
          //   Adesso, impilato, il palco si ferma al 55% e la chat ha sempre
          //   la sua metà. Sul computer a due colonne non si applica: lì lo
          //   spazio si divide in orizzontale e questo limite sarebbe solo
          //   altezza buttata.
          } w-full shrink-0 flex-col bg-black/30 ${
            mostrandoContenuti ? "" : "max-h-[55dvh] sala:max-h-none"
          //  ── ⚠️ E AFFIANCATI, IL PALCO DEVE POTER STRINGERSI ──────────
          //   `min-w-0` non è uno scrupolo: in una riga un riquadro flessibile
          //   parte con `min-width: auto`, cioè si RIFIUTA di scendere sotto la
          //   larghezza di quello che contiene. Dentro il palco ci sono i due
          //   quadrati del faccia a faccia, che hanno una misura in punti fissa:
          //   il palco si allargava per contenerli e spingeva la chat fuori
          //   dallo schermo — restava un dito di colonna oltre il bordo destro.
          //   Non era «la chat si chiude»: era «la chat viene spinta via», e le
          //   due cose si correggono in due punti diversi. Con `min-w-0` il
          //   palco cede, la chat tiene i suoi 21rem, e i quadrati si rifanno
          //   sulla misura nuova al giro dopo.
          //  ⚠️ `overflow-hidden` è la rete: se per un istante i quadrati sono
          //   ancora quelli di prima, escono dal palco e non dallo schermo.
          } sala:min-h-0 sala:w-auto sala:min-w-0 sala:flex-1 sala:shrink sala:overflow-hidden`}
        >
        {/* ── ⚠️ IL FACCIA A FACCIA PRENDE IL POSTO DELLA SCENA ──────────
              Non ci si aggiunge sopra: quando chi conduce mette due persone
              alla pari, quello È il montaggio. La forma la decide `duello` in
              `webinar/palco-tetris` — affiancati o impilati, quello che dà i
              quadrati più grandi — ed è la STESSA regola che usa la console,
              perché altrimenti chi conduce vedrebbe un dibattito e la sala un
              altro. */}
        {inDuello && !!sfidante && (
          <div ref={duelloRif} className="relative flex min-h-0 flex-1 items-center justify-center p-1.5">
            <div className={`flex gap-1.5 ${duo.orientamento === "fianco" ? "flex-row" : "flex-col"}`}>
              <QuadratoDuello
                lato={duo.lato}
                flusso={flussoDelRelatore}
                nome={nomeRelatore}
                parla={relatori.some((r) => r.parla)}
              />
              <QuadratoDuello
                lato={duo.lato}
                flusso={flussoDi(sfidante.spettatore)}
                nome={sfidante.nome}
                parla={sfidante.parla && sfidante.microfono}
                mio={sfidante.spettatore === io.current}
              />
            </div>
          </div>
        )}

        {!inDuello && (
        <>
        {/* ── ⚠️ IL RIQUADRO GRANDE HA LE SUE PROPORZIONI ────────────────
              Sul telefono e sul tablet è 16:9 e basta: cresceva fino a
              prendere tutta l'altezza dello schermo, e dentro ci finiva un
              video 16:9 — sopra e sotto restavano due bande nere che erano il
              settanta per cento della pagina. Sul computer prende invece
              l'altezza che avanza, perché lì accanto c'è la chat e lo spazio
              in verticale è quello giusto. */}
        {/* ── ⚠️ LA SCENA: METÀ E METÀ, O TUTTA A CHI CONDUCE ───────────────
              La regola sta in `webinar/palco-tetris` ed è la STESSA che usa la
              console: se la sala calcolasse la sua, chi conduce vedrebbe una
              disposizione e il pubblico un'altra.
              Quando c'è qualcuno in primo piano la scena si divide in due —
              affiancati se lo schermo è più largo che alto, uno sopra l'altro
              se è più alto che largo. Quando non c'è nessuno, chi conduce
              prende tutto: mezza schermata nera «per coerenza» è mezza
              schermata rubata alla persona che sta parlando.
             ⚠️ LA TRANSIZIONE NON È UN VEZZO: senza, aprendo la tastiera la
              fila sparisce di colpo e sembra che qualcosa si sia rotto — con un
              quarto di secondo si legge come «si sta facendo spazio». */}
        <div
          className={`relative w-full transition-all duration-300 ease-out sala:aspect-auto sala:min-h-0 sala:flex-1 ${
            //  ⚠️ Col contenuto in onda il palco NON è un 16:9 alto duecento
            //   punti: è la pagina. La chat si è spostata nella sua scheda
            //   apposta per lasciargli tutta l'altezza, e rimetterlo dentro
            //   una striscia vanificherebbe lo spostamento.
            //  ⚠️ IL LIMITE VA ANCHE QUI, e con il RITAGLIO. Metterlo solo sul
            //   palco non bastava: la scena è `aspect-video`, quindi la sua
            //   altezza la decide la LARGHEZZA — su una finestra da 1000 punti
            //   fa 562 — e senza `overflow-hidden` sforava dal palco limitato
            //   spingendo la chat fuori dallo schermo lo stesso. Il limite
            //   c'era, il ritaglio no: e da fuori si vede solo che la chat
            //   sparisce appena due riquadri vanno grandi.
            mostrandoContenuti ? "min-h-0 flex-1" : "aspect-video max-h-[55dvh] overflow-hidden sala:max-h-none"
          } ${
            disposizione.modo === "duo" && disposizione.orientamento === "fianco"
              ? "flex flex-row gap-1"
              : "flex flex-col gap-1"
          }`}
        >
        {/* ── ⚠️ IL NUMERO, SUL TELEFONO, STA SOPRA IL PALCO ──────────────
              Non è una decorazione spostata per far posto: è dove lo mette
              chiunque trasmetta qualcosa, sopra l'immagine e non in mezzo ai
              comandi. La parola accanto resta — «148» da solo si legge come
              «148 persone adesso», e se quel numero è il totale degli iscritti
              il numero è vero ma la frase che si forma in testa è falsa.
             ⚠️ Non si tocca: il comando per vedere chi c'è resta uno solo,
              quello dell'intestazione, che sul telefono non c'è. Un secondo
              tasto che apre la stessa cosa è una seconda strada da tenere in
              piedi per sempre. */}
        {numero !== null && (
          //  ⚠️ A DESTRA: a sinistra ci sta già il bollino «in diretta», e i
          //   due si sovrapponevano — il numero finiva sopra la parola che dice
          //   la cosa più importante della pagina.
          <span className="sala-micro pointer-events-none absolute right-2 top-2 z-20 flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-1 text-white/80 backdrop-blur-sm sm:hidden">
            <Users className="h-3 w-3" />
            <span className="tabular-nums font-semibold">{numero}</span>
            <span className="uppercase tracking-wide text-white/50">
              {contatore === "iscritti" ? "iscritti" : contatore === "totale" ? "passate" : "in sala"}
            </span>
          </span>
        )}
        <div className="relative mx-auto flex min-h-0 min-w-0 w-full flex-1 flex-col">
          {mostrandoContenuti ? (
            /*  ⚠️ `?watch=` mette la pagina in modalità CLIENTE: senza, la sala
                vedrebbe la schermata con cui TU scegli i media, invece di
                quello che hai scelto. `?webinar=` le fa seguire la sala. */
            <Proiettata
              chiave={percorso}
              sorgente={`${percorso}?watch=${encodeURIComponent(code)}&webinar=${encodeURIComponent(code)}`}
            />
          ) : relatori.length > 1 ? (
            <div className="h-full w-full p-1.5">
              <FasciaRelatori
                relatori={relatori.map((r) => ({
                  id: r.id, nome: r.nome,
                  stream: flussiRelatori.current.get(r.id) ?? null, parla: r.parla,
                }))}
                logo={logoStudio}
                soloChiParla={regiaPalco.soloChiParla}
                larghezza={larghezza}
              />
            </div>
          ) : (
            <>
              {/*  ⚠️ UN SOLO ELEMENTO VIDEO IN TUTTA LA PAGINA. Ce n'erano due
                  con lo STESSO riferimento — quello grande e quello piccolo —
                  e React ne collega uno solo: il flusso finiva su quello
                  nascosto, e la camera restava nera. Adesso è uno, e si sposta
                  di posto invece di essere duplicato. */}
              <video
                ref={(el) => {
                  elVideo.current = el;
                  attaccaFlusso(flussoDelRelatore, false, () => setAudioBloccato(true))(el);
                }}
                playsInline
                autoPlay
                //  ── ⚠️ NESSUN COMANDO: NON È UN VIDEO, È UNA DIRETTA ──────
                //   Qui c'era `controls`, e con quello comparivano play, pausa
                //   e la barra del tempo: chi entrava vedeva un lettore e
                //   restava a fissare il triangolo aspettando di doverlo
                //   premere. Una diretta non si mette in pausa e non si
                //   riavvolge — offrire quei comandi è dire una cosa falsa su
                //   cosa si sta guardando, e su una diretta la cosa peggiore è
                //   far credere a qualcuno di essere lui a doverla far partire.
                //  ⚠️ Toglierli NON lascia senza rimedio se il browser rifiuta
                //   il suono: per quello c'è il tasto «Tocca per sentire
                //   l'audio», che compare solo quando serve davvero.
                //  ⚠️ LE DUE CLASSI SCRITTE PER INTERO, e non composte con un
                //   template: Tailwind genera solo i nomi che TROVA nel
                //   sorgente, e `object-${...}` non è un nome — la classe non
                //   esisterebbe nel foglio di stile e il riquadro tornerebbe al
                //   comportamento predefinito senza che niente lo segnali.
                //  ⚠️ ANCORATO AI BORDI, non `h-full`. Una percentuale di
                //   altezza vuole un genitore con un'altezza DEFINITA: dentro
                //   una colonna flessibile non ce l'ha, e `h-full` si risolveva
                //   in «quanto serve» — cioè zero. Misurato: sul computer, con
                //   il relatore da solo, il video usciva 1104×0.
                //   Ancorato ai quattro lati prende la scatola del genitore
                //   qualunque altezza abbia, e non dipende più da come è stata
                //   ottenuta.
                className={`absolute inset-0 h-full w-full bg-black ${
                  riempimento("conduce", disposizione.modo) === "contain" ? "object-contain" : "object-cover"
                } ${fase === "onda" ? "" : "hidden"}`}
              />
              {/* ── ⚠️ IL BOLLINO E LA TARGHETTA, SOPRA L'IMMAGINE ─────────
                    Le due cose che una diretta deve dire sempre e che finora
                    stavano altrove: CHE è in diretta, e DI CHI è la faccia che
                    si sta guardando.
                   ⚠️ La targhetta è la stessa di Meetly — marchio, nome, fondo
                    sfumato dal basso — e non una versione nuova: chi passa
                    dalla consulenza al webinar deve riconoscere la stessa cosa,
                    e due targhette diverse per la stessa informazione sono due
                    cose da imparare invece di una.
                   ⚠️ `pointer-events-none`: sono etichette, non comandi. Senza,
                    coprirebbero il video e si toccherebbero per sbaglio
                    cercando di toccare qualcos'altro. */}
              {fase === "onda" && (
                <>
                  {/*  ⚠️ SI ADATTA AL RIQUADRO, non è una misura sola. Su un
                        video alto duecento punti il bollino pieno si prendeva
                        un quarto della larghezza: un bollino deve dire «è in
                        diretta» con la coda dell'occhio, non essere la prima
                        cosa che si guarda. Sul telefono resta il minimo che si
                        legge — pallino e parola, stretti — e da tablet in su
                        torna pieno, perché lì lo stesso ingombro non pesa. */}
                  <span className="sala-micro uppercase pointer-events-none absolute left-1.5 top-1.5 z-10 flex items-center gap-1 rounded bg-rose-600/90 px-1.5 py-0.5 tracking-tight text-white shadow-md backdrop-blur-sm sm:left-2.5 sm:top-2.5 sm:gap-1.5 sm:rounded-full sm:px-2.5 sm:py-1 sm:tracking-wide">
                    <span className="relative flex h-1 w-1 sm:h-1.5 sm:w-1.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                      <span className="relative inline-flex h-1 w-1 rounded-full bg-white sm:h-1.5 sm:w-1.5" />
                    </span>
                    in diretta
                  </span>

                  {/* ── ⚠️ LA TARGHETTA È QUELLA DI MEETLY, IDENTICA ──────────
                        Riquadro nero con l'anello chiaro, logo, un filetto
                        verticale, il nome. Non una sfumatura dal basso come
                        avevo fatto: quella era una targhetta NUOVA, e chi passa
                        dalla consulenza al webinar si ritrova due modi diversi
                        di dire la stessa cosa — cioè due cose da imparare
                        invece di una. La forma sta in `PresenterBadge`
                        (shop/call.tsx): qui si ricopia quella, misure comprese.
                       ⚠️ Il fondo NERO e non sfumato non è un vezzo: sopra
                        un'inquadratura chiara una sfumatura sparisce, e il nome
                        con lei. Un riquadro pieno si legge su qualunque
                        immagine ci finisca sotto. */}
                  {/*  ⚠️ PICCOLA SUL TELEFONO, ED È LA MISURA `compact` DI
                        MEETLY, non una inventata qui. Su un riquadro alto
                        duecento punti la targhetta grande si prendeva più di
                        metà larghezza del video: una targhetta deve dire di chi
                        è l'inquadratura, non coprirla. Meetly ha già le due
                        misure — normale e compatta — e la seconda esiste
                        esattamente per i riquadri piccoli.
                       Da tablet in su torna quella piena, perché lì lo stesso
                       ingombro è una frazione dello schermo. */}
                  <div className="pointer-events-none absolute bottom-1.5 left-1.5 z-10 inline-flex max-w-[58%] items-center gap-1.5 rounded-md bg-black/70 px-1.5 py-1 ring-1 ring-white/10 sm:bottom-2 sm:left-2 sm:gap-2 sm:rounded-lg sm:px-2.5 sm:py-2">
                    {!!logoStudio && (
                      <img
                        src={logoStudio}
                        alt=""
                        className="h-3 w-auto max-w-[3.5rem] shrink-0 object-contain sm:h-5 sm:max-w-[6rem]"
                      />
                    )}
                    <span className="sala-micro min-w-0 truncate border-l border-white/20 pl-1.5 text-white/85 sm:pl-2">
                      {nomeRelatore}
                    </span>
                  </div>
                </>
              )}

              {/*  ── IL TASTO CHE RIPRENDE L'AUDIO ──────────────────────────
                    Grande e al centro, non un'iconcina in un angolo: chi lo
                    deve premere non sa di doverlo premere, sta solo guardando
                    una diretta che sembra senza voce.
                   ⚠️ Sparisce SOLO se il suono torna davvero (`riaccendiAudio`
                    lo dice): toglierlo comunque vorrebbe dire togliere il
                    rimedio lasciando il problema. */}
              {/* ── IL CARTELLO CHE DICE CHE NERO È ─────────────────────
                    Non copre il video: sta sopra, ma il video sotto continua a
                    scorrere — se i fotogrammi tornano, la scritta sparisce da
                    sola e non c'è niente da chiudere.
                   ⚠️ Le due frasi sono diverse perché le due cose da fare sono
                    diverse: se la camera è spenta non c'è NIENTE da fare e va
                    detto, altrimenti si aspetta a vuoto; se i fotogrammi non
                    arrivano, riaprire il collegamento serve davvero. */}
              {fase === "onda" && motivoNero && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                  {motivoNero === "camera-spenta" ? (
                    /*  ⚠️ NON È UN GUASTO E NON DEVE SEMBRARLO. Era un'icona
                        grigia su nero, cioè la stessa faccia di un errore: chi
                        la vedeva pensava che la diretta si fosse rotta e
                        ricaricava. Qui c'è il marchio, il nome di chi sta
                        parlando e la frase che dice la cosa importante — che si
                        sente lo stesso. Sta sopra il video, non al suo posto:
                        appena la camera torna, sparisce da sola. */
                    <div className="flex flex-col items-center gap-2.5 sm:gap-3">
                      {/*  ⚠️ QUI IL MARCHIO NON CI VA, e ce l'avevo messo: sta
                          già nella targhetta due centimetri più sotto, dentro
                          lo stesso riquadro. Due volte lo stesso logo nella
                          stessa immagine non raddoppia il marchio — fa sembrare
                          che qualcosa si sia disegnato due volte. E su un
                          telefono, in un riquadro alto duecento punti, era
                          proprio lo spazio che mancava. */}
                      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] sm:h-16 sm:w-16">
                        <VideoOff className="h-6 w-6 text-white/45 sm:h-7 sm:w-7" />
                      </div>
                      <div>
                        <p className="sala-titolo">{nomeRelatore} sta parlando</p>
                        <p className="sala-piccolo mt-1 text-white/50">
                          Camera spenta. L&apos;audio c&apos;è.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <WifiOff className="h-7 w-7 text-amber-300/70" />
                      <p className="sala-testo font-semibold">{GUASTI.W08.che}</p>
                      <p className="sala-piccolo text-white/50">{GUASTI.W08.fai}</p>
                      {/*  ⚠️ IL CODICE SI VEDE. «Mi dà W08» è una informazione
                            che si può dire al telefono; «non si vede niente»
                            non lo è, ed è tutto quello che si poteva dire
                            prima. Piccolo e in fondo: serve quando serve, e
                            non spaventa nel frattempo. */}
                      <CodiceGuasto codice="W08" />
                    </>
                  )}
                </div>
              )}

              {fase === "onda" && audioBloccato && (
                <button
                  type="button"
                  onClick={() => {
                    void riaccendiAudio(elVideo.current).then((tornato) => {
                      if (tornato) setAudioBloccato(false);
                    });
                  }}
                  className="sala-piccolo absolute inset-x-0 bottom-14 z-20 mx-auto flex w-max items-center gap-2 rounded-full bg-blue-500 px-5 py-2.5 font-semibold text-white shadow-lg shadow-blue-500/40"
                >
                  <Volume2 className="h-4 w-4" /> Tocca per sentire l&apos;audio
                </button>
              )}
              {/* ══ GLI STATI DEL PALCO ═══════════════════════════════════
                    ⚠️ ERANO TESTO CHE GALLEGGIAVA IN UN VUOTO. In un riquadro
                     16:9 alto duecento punti, una riga di testo al centro e un
                     pulsantino sotto non sono una schermata: sono due cose
                     lasciate lì. E il testo era VERDE, che in questa sala vuol
                     dire «questa persona sta parlando» — usarlo per uno stato
                     svuota il significato che ha altrove.
                    Adesso ogni stato ha la stessa forma: un segno, un titolo,
                    una riga di spiegazione, e — se c'è qualcosa da fare — un
                    solo comando. Cambia il contenuto, non l'impaginazione: chi
                    passa da uno stato all'altro non deve rimparare dove
                    guardare. */}
              {fase !== "onda" && (
                <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-6 text-center">
                  {fase === "cerco" && <Loader2 className="h-6 w-6 animate-spin text-white/30" />}

                  {fase === "attesa" && <SalaDAttesa manca={manca} />}

                  {fase === "pronto" && (
                    <>
                      {/*  Il bollino è lo stesso della diretta, perché è la
                            stessa cosa: sta succedendo adesso. */}
                      <span className="sala-micro uppercase tracking-wide flex items-center gap-1.5 rounded-full bg-rose-600/90 px-2.5 py-1 text-white">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                        </span>
                        in diretta
                      </span>
                      <p className="sala-titolo">È già cominciata</p>
                      <button
                        onClick={entra}
                        className="sala-testo inline-flex items-center gap-2 rounded-xl bg-blue-500 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-500/40 transition hover:bg-blue-400"
                      >
                        <Volume2 className="h-4 w-4" /> Entra e ascolta
                      </button>
                    </>
                  )}

                  {fase === "collego" && (
                    <>
                      <Loader2 className="h-7 w-7 animate-spin text-white/40" />
                      <p className="sala-piccolo text-white/50">Ti collego alla diretta…</p>
                    </>
                  )}

                  {/*  ⚠️ La schermata di fine diretta sta FUORI da questo
                        riquadro, montata più in basso a tutto schermo: un
                        invito grande dentro un rettangolo alto duecento punti
                        non è grande. */}
                  {fase === "finito" && null}

                  {fase === "errore" && (
                    <>
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06]">
                        <WifiOff className="h-5 w-5 text-white/40" />
                      </div>
                      <p className="sala-piccolo max-w-xs text-white/60">{problema}</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { setProblema(""); setFase("cerco"); }}
                          className="sala-piccolo rounded-lg bg-white/10 px-4 py-2 font-semibold transition hover:bg-white/15"
                        >
                          Riprova
                        </button>
                        {guasto && <CodiceGuasto codice={guasto} />}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── LA FACCIA SOPRA I CONTENUTI ───────────────────────────
              ⚠️ È UNA BOLLA TONDA, senza nome, senza marchio, senza cornice:
               solo la faccia. Sopra una slide o un preventivo quel riquadro
               non è un partecipante da presentare — chi guarda sa già chi
               conduce, gliel'ha detto la sala — è il modo di non perdere di
               vista la persona mentre si guarda altro. Il cartellino col nome
               e il logo servivano da qualche altra parte, non qui: erano due
               righe di testo su ottanta punti di lato, cioè illeggibili e
               ingombranti insieme.
             ⚠️ SI SPOSTA. La posizione buona dipende da cosa c'è sotto — un
               titolo, una foto, una tabella — e quello cambia a ogni pagina.
               Fissarla in un angolo vuol dire che in un angolo, prima o poi,
               copre la cosa importante. Dove la si mette resta lì anche alla
               prossima diretta.
             ⚠️ LA MISURA SEGUE LO SCHERMO: un cerchio da centoquaranta punti
               è giusto sul computer e mangia un quarto di un telefono. Si
               calcola sul lato corto dello spazio vero, misurato — la stessa
               regola per tutti gli apparecchi, non tre casi scritti a mano. */}
        </div>

        {/*  ⚠️ QUI C'ERA «L'ALTRA METÀ»: un rettangolo 16:9 a tutta larghezza
              sotto quello di chi conduce. Con due persone che si parlano
              diventavano due mezzibusti sdraiati, uno sopra l'altro, con mezzo
              metro di soffitto sopra ciascuno — segnalato con la foto. Adesso
              «io e un altro» ha una forma sola, due quadrati alla pari, e la
              disegna il ramo del faccia a faccia qui sopra. */}
        </div>

        {/* ── ⚠️ GLI OSPITI STANNO SUL PALCO, NON NELLA CHAT ─────────────
              Prima i riquadri di chi aveva preso la parola stavano sopra la
              chat, in una colonna larga 21rem: una fila di francobolli in un
              angolo, mentre la persona che PARLA in quel momento è la cosa più
              importante dello schermo. È anche il contrario di come lo fanno
              tutte le piattaforme in cui si apre un salotto — l'ospite entra
              nella scena, accanto a chi conduce, e la chat resta la chat.
              Adesso è una striscia sotto il riquadro grande: alta abbastanza da
              riconoscere una faccia, bassa abbastanza da non rubare il posto a
              chi conduce, e con la stessa regola su tutti e tre gli schermi —
              cambia solo quanto è alta.
             ⚠️ E SI VEDE SOLO DOPO «ENTRA», come tutto il resto della sala. */}
        </>
        )}

        {/* ── ⚠️ COL CONTENUTO IN ONDA IL SALOTTO SPARISCE ────────────────
              Non si rimpicciolisce: sparisce. Quando mandi una slide, quella è
              la cosa da guardare — e una fila di facce sotto si prende
              centoquaranta punti di altezza su un telefono per mostrare
              miniature che nessuno sta guardando. Chi conduce resta comunque
              visibile, nella bolla tonda sopra il contenuto: è l'unica faccia
              che serve mentre si spiega qualcosa.
             ⚠️ Nessuno scende dal palco e nessuno viene zittito: continuano a
              sentirsi e a poter parlare. Torna tutto appena togli il
              contenuto, senza che tu debba rimetterlo a posto. */}
        {/*  ⚠️ RESTA MONTATA E SI CHIUDE IN ALTEZZA, non sparisce di colpo:
              smontandola i <video> degli ospiti muoiono e alla riapertura
              devono riagganciarsi da capo — mezzo secondo di riquadri neri ogni
              volta che si tocca il campo per scrivere. Così invece i flussi non
              si staccano mai. */}
        {entrato && !mostrandoContenuti && ospitiPiccoli.length > 0 && (
          <div
            style={{ height: disposizione.altezzaFila }}
            className="flex shrink-0 items-stretch gap-1.5 overflow-x-auto overflow-y-hidden border-t border-white/10 bg-black/40 p-1.5 transition-all duration-300 ease-out"
          >
            {/*  ⚠️ UNA RIGA SOLA CHE SCORRE, non una griglia che va a capo.
                  Con tre ospiti su un telefono la griglia faceva due righe
                  dentro una striscia di altezza fissa: i riquadri si
                  schiacciavano a trentasei punti e restava visibile solo la
                  targhetta col nome — tre barrette nere al posto di tre facce.
                  Una riga che scorre non si rompe mai, qualunque sia il numero
                  di ospiti, ed è la stessa cosa che fanno tutte le piattaforme
                  con la fila degli ospiti.
                 ⚠️ Chi la regia mette in primo piano viene PER PRIMO: su una
                  fila che scorre, «più importante» si dice con la posizione —
                  se restasse al suo posto potrebbe stare fuori schermo proprio
                  mentre è quello che conta. */}
            {ospitiPiccoli.map((p) => (
              <div key={p.spettatore} className="h-full shrink-0" style={{ aspectRatio: "16 / 9" }}>
                <RiquadroPalco persona={p} flusso={flussoDi(p.spettatore)} mio={p.spettatore === io.current} />
              </div>
            ))}

            {/*  ── ⚠️ QUANTI NON CI STANNO ────────────────────────────────
                  Una fila che finisce senza dire che continua sembra tutta lì,
                  e chi guarda non prova nemmeno a scorrere. Il numero è
                  l'unica cosa che glielo dice. */}
            {disposizione.fuori > 0 && (
              <div className="sala-piccolo flex h-full shrink-0 items-center justify-center rounded-xl bg-white/[0.06] px-3 font-semibold text-white/45">
                +{disposizione.fuori}
              </div>
            )}
          </div>
        )}
        </div>

        {/* ── LA SALA ───────────────────────────────────────────────── */}
        {/* ── ⚠️ LA CHAT HA UNA FACCIA SUA ───────────────────────────────
              Prima era una colonna senza inizio: gli stessi colori del palco,
              nessuna riga a dire dove finisce una cosa e comincia l'altra, e i
              messaggi che sembravano appoggiati sul video. Adesso ha un fondo
              suo, un filo di luce in cima e una testa che dice cos'è e quante
              persone ci sono — la stessa informazione che sul telefono è
              sparita dall'intestazione, qui ritrovata dove ha senso cercarla. */}
        <aside
          //  ── ⚠️ SUL COMPUTER LA CHAT LA TIENE APERTA IL CSS, NON IL CODICE
          //   `sala:flex` viene DOPO, quindi da 900 punti in su vince sempre su
          //   `hidden`. Non è una cintura in più per scrupolo: la regola «sul
          //   computer la chat non si chiude mai» era una decisione presa nel
          //   programma, e una decisione presa nel programma può sbagliarsi in
          //   dieci modi — uno stato non ancora calcolato al primo disegno, una
          //   soglia che non combacia con quella del disegno, una versione
          //   vecchia della pagina. Detta in CSS non può sbagliarsi: o lo
          //   schermo è largo 900 punti o non lo è.
          //  ⚠️ E il palco smette di essere `hidden` alla stessa soglia, per la
          //   stessa ragione: sotto sono due schede, sopra sono due colonne, e
          //   chi lo decide è la larghezza.
          className={`${chatAperta ? "flex" : "hidden"} min-h-0 flex-1 flex-col border-white/10 bg-[#07142c] sala:flex sala:w-[21rem] sala:flex-none sala:border-l`}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2.5">
            <MessageSquare className="h-4 w-4 shrink-0 text-white/40" />
            <span className="sala-piccolo font-semibold text-white/80">Chat della sala</span>
            {inSala > 0 && (
              <span className="sala-micro ml-auto flex items-center gap-1 rounded-full bg-white/[0.07] px-2 py-1 text-white/50">
                <Users className="h-3 w-3" />
                <span className="tabular-nums">{inSala}</span>
              </span>
            )}
            {/*  ⚠️ Il tasto per chiudere sta anche QUI, e non solo in alto:
                  quando la chat è aperta è questa la cosa che si sta
                  guardando, e cercare in cima alla pagina il modo di metterla
                  via è un viaggio. In alto resta perché da lì la si riapre —
                  e un comando per far tornare una cosa sparita non può stare
                  dentro la cosa sparita. */}
            {chat.tasto && fase === "onda" && (
              <button
                onClick={() => setChatVoluta(false)}
                title="Chiudi la chat e allarga la diretta"
                className="shrink-0 rounded-md p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* ── ⚠️ PRIMA CHE COMINCI, LA CHAT NON C'È ─────────────────────
                Non è disabilitata: è un'altra cosa. Un campo di testo spento
                con dentro «non puoi ancora scrivere» invita comunque a
                provarci, e chi ci prova pensa che si sia rotto qualcosa. Al
                suo posto c'è quello che in quel momento serve davvero sapere:
                che sta per cominciare, e fra quanto. */}
          {fase !== "onda" ? (
            <AttesaInChat manca={manca} fase={fase} giaCominciata={fase === "pronto"} />
          ) : (
          <>
          <ChatSala
            messaggi={messaggi}
            palco={palco}
            ioSpettatore={io.current}
            mioNome={nome}
            onRispondi={(a) => {
              setRispondoA(a);
              //  ⚠️ Il cursore va nel campo DA SUBITO: toccare «rispondi» e poi
              //   dover toccare anche il campo sono due gesti per una
              //   intenzione sola, e sul telefono il secondo si perde.
              campoChat.current?.focus();
            }}
            className="min-h-0 flex-1"
          />

          <div className="shrink-0 space-y-1.5 border-t border-white/10 p-2">
            {/* ── ⚠️ L'INVITO NON STA PIÙ QUI ─────────────────────────────
                Era un riquadro in fondo alla colonna, sopra la riga per
                scrivere: il momento in cui duecento persone aspettano che tu
                parli non può essere un avviso in un angolo, e sul telefono
                finiva sotto la tastiera. Adesso è una finestra al centro
                (`InvitoInDiretta`), montata più in basso. */}
            {/* ── ⚠️ COSA STA USCENDO DAVVERO ────────────────────────────
                  Diceva una cosa sola — «Sei in diretta. Ti sentono tutti.» —
                  e non era sempre vera: chi conduce può chiudere il microfono,
                  spegnere la camera o tutti e due, e la persona continuava a
                  leggere che la sentivano tutti. E parlava.
                 ⚠️ Il colore fa il lavoro prima delle parole: chi è sul palco
                  sta parlando davanti a duecento persone, non legge — guarda.
                  Verde esci tutto, ambra esci a metà, rosso non esci affatto.
                  Le frasi e il perché di ciascuna stanno in
                  `webinar/stato-palco`. */}
            {suPalco ? (() => {
              const s = statoSulPalco({
                microfono: mioMicrofono,
                camera: mioStato === "video",
                conCamera: sceltaConVideo.current,
              });
              const colori =
                s.tono === "verde" ? "border-emerald-400/30 bg-emerald-400/10"
                : s.tono === "ambra" ? "border-amber-400/40 bg-amber-400/10"
                : "border-rose-400/40 bg-rose-500/15";
              const iconaColore =
                s.tono === "verde" ? (parlo ? "scale-110 text-emerald-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]" : "text-emerald-400/70")
                : s.tono === "ambra" ? "text-amber-300"
                : "text-rose-300";
              const Icona = !mioMicrofono ? MicOff : mioStato === "video" ? Video : Mic;
              return (
                <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${colori}`}>
                  <Icona className={`h-4 w-4 shrink-0 ${iconaColore}`} />
                  <span className="sala-piccolo min-w-0 flex-1">
                    <b>{s.titolo}.</b> <span className="text-white/60">{s.spiega}</span>
                  </span>
                  <button onClick={() => void scendi()} className="sala-micro shrink-0 rounded-md bg-white/10 px-2 py-1.5 transition hover:bg-white/20">
                    Lascia
                  </button>
                </div>
              );
            })() : null}

            {/* ── ⚠️ UNA RIGA SOLA: MANO · CAMPO · INVIA ────────────────────
                  Erano due righe: «Chiedi di parlare» a tutta larghezza e sotto
                  il campo col tasto. Su un telefono con la tastiera aperta
                  restano meno di cinquecento punti di altezza, e due righe di
                  comandi si mangiavano la conversazione — mentre il gesto che
                  si fa mille volte è uno solo, scrivere.
                  Adesso la mano è un tasto accanto al campo: si vede sempre,
                  occupa un quarto dello spazio, e quando sei in fila diventa
                  ambra. La parola scritta resta sugli schermi larghi, dove lo
                  spazio c'è.
                 ⚠️ IL CAMPO È `text-base`, CIOÈ 16 PUNTI, E NON È ESTETICA:
                  sotto i 16 iOS INGRANDISCE la pagina appena tocchi il campo, e
                  da ingrandita è più larga dello schermo — il tasto «invia»
                  finisce fuori a destra e per premerlo bisogna scorrere. Era
                  esattamente il difetto segnalato, e il campo qui era
                  `text-sm`: quattordici. */}
            {/* ── ⚠️ A CHI STO RISPONDENDO, SOPRA IL CAMPO ─────────────────
                  Deve stare dove si sta guardando mentre si scrive. Un
                  indicatore altrove vuol dire mandare a Mario una risposta che
                  si credeva rivolta alla sala — e in una chat pubblica quel
                  genere di errore non si può ritirare. */}
            {!!rispondoA && (
              <div className="mb-2 flex items-center gap-2 rounded-xl bg-blue-500/15 px-3 py-2 ring-1 ring-blue-500/30">
                <CornerDownRight className="h-4 w-4 shrink-0 text-blue-300" />
                <span className="sala-piccolo min-w-0 flex-1 truncate">
                  Rispondi a <b>{rispondoA.nome}</b>
                </span>
                <button
                  onClick={() => setRispondoA(null)}
                  aria-label="Annulla la risposta"
                  className="shrink-0 rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* ── ⚠️ L'ELENCO DELLE PERSONE, SOPRA IL CAMPO ─────────────────
                  Si apre scrivendo «@». Sta SOPRA e non sotto: sul telefono
                  sotto il campo c'è la tastiera, e un elenco lì è un elenco che
                  non si vede.
                 ⚠️ Le regole di quando è aperto e di chi viene prima stanno in
                  `webinar/tag-chat`, con le prove: sono tutti casi limite —
                  uno spazio che chiude il tag, una chiocciola in mezzo a un
                  indirizzo di posta, chi comincia col pezzo scritto che deve
                  stare sopra chi lo contiene in mezzo. */}
            {!!tag && suggeriti.length > 0 && (
              <div className="mb-1.5 overflow-hidden rounded-xl border border-white/15 bg-[#0a1730] shadow-2xl">
                <p className="sala-micro uppercase tracking-wide border-b border-white/10 px-3 py-2 text-white/35">
                  Cita una persona
                </p>
                {suggeriti.map((p, n) => (
                  <button
                    key={p.id}
                    onClick={() => scegli(p.nome)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-white/10 ${
                      n === 0 ? "bg-white/[0.06]" : ""
                    }`}
                  >
                    <span className="sala-piccolo flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/25 font-bold text-white">
                      {(p.nome || "?").trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="sala-testo min-w-0 flex-1 truncate font-medium">{p.nome}</span>
                    {/*  Il primo si sceglie con Invio: dirlo evita di dover
                          togliere la mano dalla tastiera. */}
                    {n === 0 && (
                      <span className="sala-micro uppercase tracking-wide hidden shrink-0 rounded bg-white/10 px-1.5 py-1 text-white/35 sm:inline">
                        invio
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* ── ⚠️ LA RIGA PER SCRIVERE ───────────────────────────────────
                  Era un campo trasparente su fondo trasparente con un tasto
                  dello stesso colore accanto: non si capiva dove finisse uno e
                  cominciasse l'altro, e sul telefono si toccava il vuoto fra i
                  due. Adesso il campo ha un fondo suo e un bordo che si accende
                  quando ci scrivi dentro, e il tasto è pieno e staccato.
                 ⚠️ IL TASTO CAMBIA STATO A VISTA: spento finché non c'è niente
                  da mandare, acceso e leggermente più grande appena scrivi. È
                  l'unica animazione qui dentro e serve — dice che il messaggio
                  è pronto a partire, che è la domanda che ci si fa prima di
                  premere. */}
            {/* ── ⚠️ LA RIGA PER SCRIVERE ───────────────────────────────────
                  Era un campo trasparente con un tasto dello stesso colore
                  accanto: non si capiva dove finisse uno e cominciasse l'altro.
                  Adesso il campo ha un fondo suo, si accende scrivendoci
                  dentro, e il tasto è pieno e staccato.
                 ⚠️ QUARANTOTTO PUNTI DI ALTEZZA e non quarantadue: è la misura
                  sotto cui un bersaglio da toccare comincia a sbagliarsi, e
                  qui accanto ce ne sono tre attaccati — chiocciola, campo,
                  invio. */}
            <div className="flex items-center gap-2">
              {/* ── ⚠️ IL CAMPO È BIANCO ──────────────────────────────────────
                    Era bianco all'otto per cento su un fondo blu scuro: un
                    rettangolo appena più chiaro del resto, che a schermo si
                    leggeva come «una zona», non come «un posto dove si
                    scrive». Un campo di testo bianco lo riconosce chiunque
                    senza doverci pensare — ed è l'unica cosa in questa
                    schermata su cui si scrive.
                   ⚠️ Il testo dentro diventa scuro, ovviamente: bianco su
                    bianco è il modo più rapido di rendere invisibile quello che
                    uno sta digitando. */}
              <div
                className={`flex h-12 min-w-0 flex-1 items-center gap-1 rounded-2xl bg-white px-3 transition ${
                  bozza.trim() || tag ? "ring-2 ring-emerald-500" : "ring-1 ring-white/20"
                }`}
              >
                <input
                  ref={campoChat}
                  value={bozza}
                  onChange={(e) => scriviInChat(e.target.value, e.target.selectionStart ?? e.target.value.length)}
                  onKeyUp={(e) => {
                    const el = e.currentTarget;
                    setTag(tagAperto(el.value, el.selectionStart ?? el.value.length));
                  }}
                  onKeyDown={(e) => {
                    //  ⚠️ CON L'ELENCO APERTO, INVIO SCEGLIE IL PRIMO invece di
                    //   spedire: si sta scrivendo un nome, non un messaggio, e
                    //   spedire «@mar» a mezza sala è l'errore che non si
                    //   ritira.
                    if (tag && suggeriti.length && e.key === "Enter") {
                      e.preventDefault();
                      scegli(suggeriti[0].nome);
                      return;
                    }
                    if (tag && e.key === "Escape") { setTag(null); return; }
                    if (e.key === "Enter") void invia();
                  }}
                  placeholder={rispondoA ? `Rispondi a ${rispondoA.nome}…` : "Scrivi un messaggio…"}
                  aria-label="Scrivi alla sala"
                  enterKeyHint="send"
                  className="h-full min-w-0 flex-1 bg-transparent text-base text-[#0b1a33] outline-none placeholder:text-[#0b1a33]/40"
                />
                {/*  ⚠️ LA CHIOCCIOLA È UN TASTO, non solo un carattere da
                      digitare: su un telefono «@» sta nella seconda tastiera, e
                      una funzione che costringe a cambiare tastiera è una
                      funzione che non usa nessuno. */}
                <button
                  type="button"
                  onClick={() => {
                    const el = campoChat.current;
                    if (!el) return;
                    const pos = el.selectionStart ?? bozza.length;
                    const serve = pos > 0 && bozza[pos - 1] !== " " ? " @" : "@";
                    const nuovo = bozza.slice(0, pos) + serve + bozza.slice(pos);
                    scriviInChat(nuovo, pos + serve.length);
                    requestAnimationFrame(() => {
                      el.focus();
                      el.setSelectionRange(pos + serve.length, pos + serve.length);
                    });
                  }}
                  title="Cita una persona"
                  aria-label="Cita una persona"
                  className="sala-titolo flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-bold text-[#0b1a33]/35 transition hover:bg-black/10 hover:text-[#0b1a33]"
                >
                  @
                </button>
              </div>

              <button
                onClick={() => void invia()}
                disabled={!bozza.trim()}
                //  ⚠️ VERDE, E CON L'ICONA BIANCA PIENA. Il verde è l'unico
                //   colore che su questo fondo blu scuro non ha nessun vicino:
                //   il blu del tasto di prima era il colore del fondo un po'
                //   più chiaro, e a occhio si perdeva. Spento resta comunque
                //   leggibile — grigio chiaro su scuro, non bianco al
                //   venticinque per cento, che era la ragione per cui «non si
                //   capiva se si poteva premere».
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-all duration-200 ${
                  bozza.trim()
                    ? "scale-100 bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 hover:bg-emerald-400"
                    : "scale-95 bg-white/15 text-white/50"
                }`}
                aria-label="Invia"
              >
                <Send className="h-5 w-5" strokeWidth={2.5} />
              </button>
            </div>
          </div>
          </>
          )}
        </aside>
      </div>

      {/*  ⚠️ LA BOLLA STA QUI, FUORI DAL PALCO. Era dentro, e sul telefono
            aprendo la chat il palco si nasconde: spariva anche lei, cioè
            proprio nel momento in cui è l'unico modo di vedere ancora chi
            parla. Appesa alla pagina invece resta sopra tutto — sopra il
            contenuto e sopra la chat — che è quello che deve fare.
           ⚠️ Solo con un contenuto in onda: senza, chi conduce è già il
            riquadro grande, e una faccia sopra sé stessa non ha senso. */}
      {mostrandoContenuti && (
        <BollaRelatore
          flusso={flussoDelRelatore}
          //  ⚠️ Con la chat aperta scende. In alto a sinistra, a settantasei
          //   punti, la bolla si appoggia esattamente sulla testa della chat e
          //   copre la scritta «Chat della sala»: sul telefono l'ho vista
          //   nascondere il titolo dell'unica cosa aperta in quel momento.
          //   L'angolo resta l'angolo, ma sotto a quello che c'è già.
          sotto={chatAperta ? 140 : 76}
        />
      )}

      {/* ── ⚠️ LE DUE FINESTRE STANNO IN FONDO ALL'ALBERO, SOPRA TUTTO ─────
            Sono i due momenti in cui la sala smette di essere una sala e
            diventa una conversazione: quando chiedi di partecipare e quando ti
            danno la parola. Un avviso in un angolo non li regge — e sul
            telefono finiva sotto la tastiera. */}
      {/* ── ⚠️ LA DIRETTA È FINITA: LA SCHERMATA CHE VALE ─────────────────
            A tutto schermo, sopra tutto. È l'ultima cosa che vede chi ha
            appena passato un'ora ad ascoltare — l'unico momento in cui la
            distanza fra «mi interessa» e «scrivo» è più corta di un tocco. */}
      {/*  ⚠️ Anche questa a tutto schermo, sopra tutto: prima che cominci non
            c'è niente da guardare, e la sala sotto sarebbe una chat che non si
            può usare accanto a un riquadro nero. */}
      {fase === "attesa" && (
        <DirettaDaCominciare
          manca={manca}
          inSala={inSala}
          iscritti={iscritti}
          soglia={soglia}
          logo={logoStudio}
          codice={code}
          giaIscritto={giaIscritto}
          onIscritto={() => setGiaIscritto(true)}
        />
      )}

      {fase === "finito" && (
        <DirettaFinita
          nomeRelatore={nomeRelatore}
          numero={whatsapp}
          codice={code}
          spettatore={io.current}
        />
      )}

      {chiedoLaParola && (
        <ChiediDiPartecipare
          nomeRelatore={nomeRelatore}
          inCoda={coda.length}
          aperte={maniAperte}
          onConferma={() => void alzaMano()}
          onChiudi={() => setChiedoLaParola(false)}
        />
      )}

      {invitatoAParlare && (
        <InvitoInDiretta
          conVideo={mioStato === "video"}
          salendo={salendo}
          errore={erroreSalita}
          onEntra={(conVideo) => void salgo(conVideo)}
          onRifiuta={() => void scendi()}
        />
      )}
    </div>
  );
}

/** ── LA SALA D'ATTESA ──────────────────────────────────────────────────────
 *
 *  ⚠️ ERA UNA RIGA GRIGIA CHE DICEVA «Non è ancora cominciato», e quella riga
 *   faceva chiudere la scheda. Chi apre un link in anticipo ha una sola
 *   domanda — QUANTO MANCA — e non trovando la risposta se ne va, perché
 *   restare a fissare una schermata muta senza sapere se sono dieci minuti o
 *   tre giorni non lo fa nessuno.
 *
 *  Il conto alla rovescia è la risposta, e per questo è la cosa più grande
 *  della pagina. Le regole di cosa mostrare stanno in
 *  `webinar/conto-alla-rovescia` — non qui, perché sono piene di casi limite
 *  (le voci a zero in testa che spariscono, quelle in mezzo che restano, l'ora
 *  già passata che non conta all'insù) e vanno messe alla prova.
 *
 *  ⚠️ SENZA ORARIO NON SI INVENTA UN CONTO: resta l'attesa semplice. Un orario
 *   sbagliato a schermo fa andare via chi sarebbe rimasto — molto più di una
 *   schermata senza numeri.
 */
function SalaDAttesa({ manca }: { manca: ReturnType<typeof quantoManca> }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 px-6 text-center">
      {/*  ── L'ANELLO CHE PULSA ────────────────────────────────────────────
            Dice «è vivo, sta arrivando» senza scriverlo. Due cerchi sfasati:
            uno si allarga e sfuma, l'altro resta — è la stessa figura del
            pallino della diretta, ingrandita, così le due schermate si
            riconoscono come la stessa cosa in due momenti. */}
      <div className="relative flex h-16 w-16 items-center justify-center sm:h-20 sm:w-20">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/25" />
        <span className="absolute inline-flex h-12 w-12 rounded-full bg-amber-400/10 sm:h-16 sm:w-16" />
        <Radio className="relative h-7 w-7 text-amber-300 sm:h-8 sm:w-8" />
      </div>

      {manca && !manca.passato ? (
        <>
          <p className="sala-etichetta text-white/40">comincia fra</p>

          {/*  ── I NUMERI, GRANDI ──────────────────────────────────────────
                ⚠️ `tabular-nums` non è un vezzo: senza, ogni cifra ha una
                 larghezza sua e la riga intera si sposta a ogni secondo che
                 passa. Un conto alla rovescia che balla si guarda una volta e
                 poi si distoglie lo sguardo. */}
          <div className="flex items-start justify-center gap-3 sm:gap-5">
            {manca.voci.map((v) => (
              <div key={v} className="flex min-w-[3.2rem] flex-col items-center sm:min-w-[4.5rem]">
                <span className="sala-mega">{valore(manca, v)}</span>
                <span className="sala-micro uppercase tracking-wide mt-2 text-white/35">{etichetta(manca, v)}</span>
              </div>
            ))}
          </div>

          <p className="sala-piccolo max-w-xs text-white/50">{frase(manca)}</p>
        </>
      ) : (
        <>
          <p className="sala-titolo">
            {manca?.passato ? "Sta per cominciare" : "Non è ancora cominciata"}
          </p>
          <p className="sala-piccolo max-w-xs text-white/50">
            {manca?.passato
              ? frase(manca)
              //  ⚠️ Non promette più la chat: da quando la chat si apre solo a
              //   diretta cominciata, «intanto puoi già scrivere» era un invito
              //   a fare una cosa che non si può fare.
              : "Parte da sola: resta pure su questa pagina."}
          </p>
        </>
      )}
    </div>
  );
}

/** ── IL LINK NON PORTA PIÙ DA NESSUNA PARTE ───────────────────────────────
 *  ⚠️ NON È UNA SCHERMATA D'ERRORE, ed è tutta la differenza. Chi arriva qui
 *   non ha rotto niente e non ha niente da riparare: ha un link vecchio, o una
 *   diretta che è stata cancellata. Prima gli comparivano la chat, il
 *   contatore, un codice di guasto e un tasto «Riprova» — cioè quattro cose
 *   inutili e la sensazione di aver sbagliato qualcosa.
 *  Qui non c'è niente da fare e non si finge il contrario: si dice cosa è
 *  successo, si dice che non è colpa sua, e si dice l'unica cosa vera che può
 *  fare — chiedere il link a chi gliel'ha mandato. */
function SalaInesistente({ logo }: { logo: string }) {
  return (
    <div className="bg-blueprint flex min-h-[100dvh] flex-col items-center justify-center px-6 py-12 text-center text-white">
      {logo ? (
        <img src={logo} alt="" className="mb-8 h-8 w-auto max-w-[10rem] object-contain opacity-70" />
      ) : (
        <span className="sala-etichetta mb-8 flex items-center gap-2 text-white/40">
          <Radio className="h-4 w-4" /> Hair Genius Labs
        </span>
      )}

      {/*  Il cerchio grande e vuoto: dice «qui non c'è niente» senza il rosso
          dell'allarme, che qui sarebbe fuori luogo — non è successo niente di
          grave. */}
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
        <CalendarX className="h-8 w-8 text-white/30" />
      </div>

      <h1 className="sala-mega mt-7 max-w-md">
        Questa diretta non c&apos;è più
      </h1>
      <p className="sala-testo mt-3 max-w-sm text-white/55">
        Il link è di una diretta chiusa o annullata. Non hai sbagliato niente.
      </p>

      <div className="mt-8 max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4">
        <p className="sala-piccolo text-white/60">
          Se aspettavi questa diretta, chiedi il link nuovo a chi te l&apos;ha mandato.
        </p>
      </div>
    </div>
  );
}

/** ── QUANDO LA DIRETTA È FINITA ────────────────────────────────────────────
 *  ⚠️ NON È UNA SCHERMATA DI CORTESIA. Prima c'era «La diretta è terminata —
 *   grazie di essere stato con voi», e per chi aveva appena passato un'ora ad
 *   ascoltare era una porta chiusa in faccia: la sala si svuota e non resta
 *   niente da fare. È l'unico istante in cui una persona che si è appena fatta
 *   un'idea agisce, e buttarlo via è la cosa più costosa di tutta la diretta.
 *
 *  ⚠️ E SENZA NUMERO NON SI INVENTA NIENTE. Se il presentatore non ne ha
 *   impostato uno resta il ringraziamento e basta: un invito a scrivere che
 *   porta a un numero vuoto è peggio di nessun invito — fa premere e non
 *   succede niente, e quella è l'ultima impressione che rimane.
 *
 *  I TESTI. Corti, e nessuno promette qualcosa che non possiamo mantenere:
 *  non c'è «risposta immediata» né «offerta valida oggi». Quello che c'è è
 *  vero — si scrive alla persona che ha appena parlato, e si riparte da lì. */
/** ── L'ISCRIZIONE ─────────────────────────────────────────────────────────
 *  ⚠️ SI CHIEDE UNA COSA SOLA, IL NUMERO. Ogni campo in più è gente che se ne
 *   va: qui non si sta vendendo niente, si sta chiedendo il permesso di
 *   avvisare. Il nome è facoltativo e serve solo a non scrivere «Ciao,» a
 *   vuoto nel promemoria.
 *  ⚠️ E SI DICE ESATTAMENTE COSA ARRIVERÀ, prima di chiederlo: «due messaggi,
 *   e basta». Un numero lasciato senza sapere cosa ne farai è un numero che
 *   verrà bloccato al primo messaggio — e su WhatsApp un blocco non si toglie.
 *  ⚠️ Nessuna promessa di posti limitati e nessun conto alla rovescia finto:
 *   chi ci casca una volta non apre più il secondo messaggio.
 */
function Iscrizione({
  codice, manca, logo, giaIscritto, onIscritto,
}: {
  codice: string;
  manca: ReturnType<typeof quantoManca>;
  logo?: string;
  giaIscritto: boolean;
  onIscritto: () => void;
}) {
  const [nome, setNome] = useState("");
  const [numero, setNumero] = useState("");
  const [mando, setMando] = useState(false);
  const [errore, setErrore] = useState("");
  const conta = !!manca && !manca.passato;

  const iscrivi = async () => {
    setErrore("");
    //  ⚠️ Si controlla PRIMA di mandare, con la stessa regola del server: un
    //   viaggio di andata e ritorno per dire «il numero è storto» è mezzo
    //   secondo in cui la persona crede di aver finito.
    if (!numeroPerWhatsApp(numero)) {
      setErrore("Questo numero non è valido. Controllalo e riprova.");
      return;
    }
    setMando(true);
    try {
      const r = await fetch("/api/public/webinar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ azione: "iscrivimi", codice, nome, contatto: numero }),
      });
      if (!(await r.json())?.ok) throw new Error("no");
      //  Chi si è iscritto non deve rifarlo se ricarica la pagina.
      try { localStorage.setItem(`hg_iscritto_${codice}`, "1"); } catch { /* pazienza */ }
      onIscritto();
    } catch {
      setErrore("Non è stato salvato. Riprova fra un momento.");
    } finally {
      setMando(false);
    }
  };

  if (giaIscritto) {
    return (
      <div className="w-full max-w-sm rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.07] p-5 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-400/20">
          <BellRing className="h-5 w-5 text-emerald-300" />
        </div>
        <p className="sala-titolo">Ci sei</p>
        <p className="sala-piccolo mt-2 text-white/60">
          Ricevi un messaggio su WhatsApp quando si comincia. Puoi chiudere la pagina.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/12 bg-white/[0.04] p-5">
      {!!logo && <img src={logo} alt="" className="mx-auto mb-4 h-7 w-auto object-contain opacity-80" />}
      <p className="sala-titolo text-center">
        {conta ? "Iscriviti e ti avvisiamo" : "Iscriviti: ti avvisiamo quando si comincia"}
      </p>
      <p className="sala-piccolo mt-2 text-center text-white/55">
        Lascia il numero: ricevi un messaggio su WhatsApp quando si comincia.
        {/*  ⚠️ Quanti messaggi, detto prima. È l'unica cosa che una persona
              vuole sapere prima di lasciare il proprio numero. */}
        {" "}Due messaggi in tutto, e basta.
      </p>

      <div className="mt-4 space-y-2">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Il tuo nome (facoltativo)"
          className="sala-testo w-full rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-3 outline-none placeholder:text-white/30 focus:border-blue-400"
        />
        <input
          value={numero}
          onChange={(e) => setNumero(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void iscrivi()}
          //  ⚠️ `tel` e non `text`: sul telefono apre la tastiera dei numeri, e
          //   una tastiera sbagliata è il motivo più stupido per cui qualcuno
          //   abbandona un campo.
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="Il tuo numero WhatsApp"
          className="sala-testo w-full rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-3 outline-none placeholder:text-white/30 focus:border-blue-400"
        />
        <button
          onClick={() => void iscrivi()}
          disabled={mando || !numero.trim()}
          className="sala-testo flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-5 py-3.5 font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-400 disabled:opacity-50"
        >
          {mando ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
          {mando ? "Un attimo…" : "Avvisami"}
        </button>
      </div>

      {!!errore && <p className="sala-piccolo mt-3 rounded-xl bg-rose-500/15 px-3 py-2.5 text-rose-200">{errore}</p>}

      <p className="sala-micro mt-3 text-center text-white/30">
        Serve solo per avvisarti di questa diretta.
      </p>
    </div>
  );
}

/** ── PRIMA CHE COMINCI: LA SCHERMATA CHE VALE ─────────────────────────────
 *  ⚠️ A TUTTO SCHERMO, come quella di fine diretta, e per lo stesso motivo:
 *   sono i due momenti in cui non c'è niente da guardare, e quello che si
 *   scrive lì è tutto quello che c'è. Un anello che pulsa dentro un riquadro
 *   16:9 con la chat accanto diceva la stessa cosa in un decimo dello spazio,
 *   e chi apriva il link dieci minuti prima non trovava niente a cui
 *   appoggiarsi.
 *
 *  ⚠️ I DUE NUMERI SONO DUE COSE DIVERSE e la parola accanto lo dice:
 *   «in sala adesso» è chi ha già aperto il link, «iscritti» è chi ha detto
 *   che verrà. Scriverli senza etichetta vorrebbe dire lasciar leggere il
 *   secondo come il primo — che è un numero vero usato per dire una cosa
 *   falsa.
 *  ⚠️ E «in sala» rispetta la soglia impostata nella regia: una pagina che
 *   dice «2 in sala» a chi è arrivato per primo lavora contro chi conduce, e
 *   tacere non è mentire. Gli iscritti invece si dicono sempre: quello non è
 *   un numero che può fare brutta figura.
 */
function DirettaDaCominciare({
  manca, inSala, iscritti, soglia, logo, codice, giaIscritto, onIscritto,
}: {
  manca: ReturnType<typeof quantoManca>;
  inSala: number;
  iscritti: number;
  soglia: number;
  logo?: string;
  codice: string;
  giaIscritto: boolean;
  onIscritto: () => void;
}) {
  const conta = !!manca && !manca.passato;
  const mostraInSala = inSala > 0 && inSala >= Math.max(1, soglia);
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-y-auto bg-[#050f24] px-6 py-10 text-center">
      {!!logo && <img src={logo} alt="" className="mb-8 h-8 w-auto max-w-[10rem] object-contain opacity-80" />}

      {/*  Gli anelli che pulsano: dicono «è vivo, sta arrivando» senza
          scriverlo. È la stessa figura del pallino della diretta, ingrandita,
          così le due schermate si riconoscono come la stessa cosa in due
          momenti diversi. */}
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/20" />
        <span className="absolute inline-flex h-14 w-14 animate-pulse rounded-full bg-amber-400/15" />
        <span className="absolute inline-flex h-20 w-20 rounded-full ring-1 ring-amber-400/30" />
        <Radio className="relative h-8 w-8 text-amber-300" />
      </div>

      <h1 className="sala-mega mt-6">
        {conta ? "La diretta sta per cominciare" : manca?.passato ? "Sta per cominciare" : "Non è ancora cominciata"}
      </h1>
      <p className="sala-testo mt-3 max-w-md text-white/55">
        {conta
          ? frase(manca)
          : "Parte da sola: resta pure su questa pagina."}
      </p>

      {conta && (
        <>
          <p className="sala-etichetta mt-8 text-white/35">comincia fra</p>
          <div className="mt-3 flex items-start justify-center gap-2 sm:gap-3">
            {manca.voci.map((v) => (
              <div
                key={v}
                className="flex min-w-[4.2rem] flex-col items-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 sm:min-w-[5.5rem] sm:py-4"
              >
                {/*  ⚠️ `tabular-nums`: senza, ogni cifra ha una larghezza sua e
                      la riga si sposta a ogni secondo. Un conto alla rovescia
                      che balla si guarda una volta e poi si distoglie lo
                      sguardo. */}
                <span className="sala-mega tabular-nums leading-none">{valore(manca, v)}</span>
                <span className="sala-micro uppercase tracking-wide mt-2 text-white/35">{etichetta(manca, v)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {(mostraInSala || iscritti > 0) && (
        <div className="mt-9 flex w-full max-w-md items-stretch justify-center gap-2.5">
          {mostraInSala && (
            <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3.5">
              <span className="sala-titolo tabular-nums">{inSala}</span>
              <span className="sala-micro uppercase tracking-wide text-white/35">in sala adesso</span>
            </div>
          )}
          {iscritti > 0 && (
            <div className="flex flex-1 flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3.5">
              <span className="sala-titolo tabular-nums">{iscritti}</span>
              <span className="sala-micro uppercase tracking-wide text-white/35">iscritti</span>
            </div>
          )}
        </div>
      )}

      {/* ── ⚠️ QUI CI SONO I PUNTINI, E ADESSO C'È ANCHE L'ISCRIZIONE ────
            È il momento giusto e non ce n'è un altro: la persona ha aperto il
            link, ha visto che manca, e sta per chiudere la pagina. Se se ne va
            senza lasciare il numero, torna solo se si ricorda da sola — e non
            si ricorda. Chiederlo dopo, in sala, vorrebbe dire chiederlo a chi
            è già venuto: cioè a chi non serve avvisare. */}
      <div className="mt-8 flex w-full justify-center">
        <Iscrizione
          codice={codice}
          manca={manca}
          logo={logo}
          giaIscritto={giaIscritto}
          onIscritto={onIscritto}
        />
      </div>

      {/*  I tre puntini che scorrono: dicono «è vivo» a chi guarda la pagina da
          dieci minuti senza che cambi niente. */}
      <span className="mt-8 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/25"
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </span>
    </div>
  );
}

function DirettaFinita({
  nomeRelatore, numero, codice, spettatore,
}: { nomeRelatore: string; numero: string; codice: string; spettatore: string }) {
  const pulito = numero.replace(/[^\d]/g, "");
  const testo = encodeURIComponent(
    `Ciao, ho appena seguito la diretta e vorrei parlarne con te.`,
  );
  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center overflow-y-auto bg-[#050f24] px-6 py-10 text-center">
      {/*  Il cerchio grande e il segno di spunta: si legge da lontano che è
          finita bene, non che è caduta la linea. */}
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-400/15 ring-1 ring-emerald-400/30">
        <Radio className="h-7 w-7 text-emerald-300" />
      </div>

      <h1 className="sala-mega mt-6">
        La diretta è finita
      </h1>
      <p className="sala-testo mt-3 max-w-md text-white/55">
        Grazie di essere rimasto fino alla fine.
      </p>

      {pulito ? (
        <>
          <div className="mt-8 w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="sala-titolo">
              Il tuo caso non è come gli altri.
            </p>
            <p className="sala-piccolo mt-2 text-white/60">
              In diretta si parla per tutti. Scrivi a {nomeRelatore}: ti dice
              cosa si può fare nel tuo caso, senza impegno.
            </p>
            <a
              //  ⚠️ Si segna PRIMA di lasciare la pagina, e senza aspettare:
              //   toccando questo tasto si apre WhatsApp e questa pagina non sa
              //   più niente. `keepalive` dice al browser di mandare la
              //   richiesta anche se la scheda se ne va — senza, il gesto più
              //   importante della diretta sarebbe l'unico che non si conta.
              onClick={() => {
                void fetch("/api/public/webinar", {
                  method: "POST",
                  keepalive: true,
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ azione: "segna", codice, spettatore, cosa: "whatsapp" }),
                }).catch(() => { /* il tasto deve funzionare comunque */ });
              }}
              href={`https://wa.me/${pulito}?text=${testo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="sala-testo mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-4 font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400"
            >
              <MessageCircle className="h-5 w-5" />
              Scrivi su WhatsApp
            </a>
            {/*  ⚠️ SI DICE COSA SUCCEDE PREMENDO. Un tasto che apre
                un'applicazione senza averlo detto si legge come una trappola, e
                a quel punto non lo preme più nessuno. */}
            <p className="sala-piccolo mt-3 text-white/35">
              Si apre WhatsApp con il messaggio già scritto: puoi cambiarlo prima
              di inviarlo.
            </p>
          </div>
          <p className="sala-piccolo mt-6 max-w-md text-white/30">
            Puoi chiudere questa pagina quando vuoi.
          </p>
        </>
      ) : (
        <p className="sala-testo mt-6 text-white/45">Puoi chiudere questa pagina.</p>
      )}
    </div>
  );
}

/** ── LA FINESTRA: «VUOI PARLARE CON …?» ────────────────────────────────────
 *  ⚠️ SI APRE PRIMA DI ALZARE LA MANO, e non dopo. Chiedere di partecipare a
 *   una diretta è una cosa che spaventa: se al primo tocco ti ritrovi in fila
 *   senza sapere cosa comporta, la scheda si chiude. Qui si dice in tre righe
 *   che cosa succede davvero, e poi si sceglie.
 *  ⚠️ TUTTO QUELLO CHE C'È SCRITTO È VERO. La tentazione, su una schermata che
 *   deve convincere, è aggiungere una riga che spinge — «hai la precedenza»,
 *   «pochi posti». Non ce n'è nessuna: la fila è una fila e lo si dice, la
 *   camera è facoltativa ed è vero. Una promessa che il minuto dopo si scopre
 *   falsa costa molto più del clic che avrebbe fatto guadagnare. */
function ChiediDiPartecipare({
  nomeRelatore, inCoda, aperte, onConferma, onChiudi,
}: {
  nomeRelatore: string;
  inCoda: number;
  /** chi conduce ha aperto le richieste? Vedi RegiaPalco.maniAperte */
  aperte: boolean;
  onConferma: () => void;
  onChiudi: () => void;
}) {
  /* ── ⚠️ NON ANCORA È UNA PROMESSA, NON UN RIFIUTO ──────────────────────
      Chi tocca «Partecipa» prima dell'apertura sta facendo esattamente la cosa
      che vogliamo: si è fatto avanti. Rispondergli «non puoi» lo rimanda al
      silenzio e non torna. Qui gli si dice due cose vere: che il momento
      arriva, e chi glielo dirà — così smette di controllare il pulsante e
      torna ad ascoltare, che è dove lo vogliamo.
      Nessuna data e nessun «fra poco» preciso: non lo sappiamo, e una promessa
      sull'orologio che non si mantiene è peggio del silenzio. */
  if (!aperte) {
    return (
      <Velo onChiudi={onChiudi}>
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
          <Hand className="h-5 w-5 text-white/50" />
        </div>
        <h2 className="sala-titolo">Non è ancora il momento</h2>
        <p className="sala-piccolo mt-2 text-white/60">
          Le domande a voce si aprono più avanti. Questo tasto si accende da
          solo quando è il momento.
        </p>
        <p className="sala-piccolo mt-4 rounded-xl bg-white/[0.05] px-4 py-3 text-white/60">
          Intanto scrivi la domanda in chat: {nomeRelatore} le legge mentre
          parla, e spesso risponde da lì.
        </p>
        <button
          onClick={onChiudi}
          className="sala-testo mt-5 w-full rounded-xl bg-white/10 py-3.5 font-semibold text-white transition hover:bg-white/15"
        >
          Ho capito
        </button>
      </Velo>
    );
  }

  return (
    <Velo onChiudi={onChiudi}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand/20">
        <Hand className="h-5 w-5 text-brand" />
      </div>
      <h2 className="sala-titolo">Parla con {nomeRelatore}</h2>
      <p className="sala-piccolo mt-2 text-white/60">
        Fai la tua domanda a voce e ricevi una risposta sul tuo caso, non una
        risposta generica.
      </p>

      <ul className="mt-4 space-y-2.5 text-left">
        <Punto icona={Mic}>Entri in diretta con la voce. La camera è facoltativa: scegli tu.</Punto>
        <Punto icona={Users}>
          {inCoda > 0
            //  Il numero si dice com'è. Nasconderlo per non scoraggiare
            //  vorrebbe dire far aspettare qualcuno senza avergli detto
            //  quanto: è il modo di perderlo davvero.
            ? `Ci sono ${inCoda} ${inCoda === 1 ? "persona" : "persone"} prima di te: ti avvisiamo quando tocca a te.`
            : "Adesso non c'è nessuno in fila: tocca a te per prima."}
        </Punto>
        <Punto icona={Radio}>Puoi lasciare la diretta quando vuoi, con un tocco.</Punto>
      </ul>

      <button
        onClick={onConferma}
        className="sala-testo mt-5 w-full rounded-xl bg-blue-500 py-3.5 font-semibold text-white transition hover:bg-blue-400"
      >
        Alza la mano
      </button>
      <button onClick={onChiudi} className="sala-piccolo mt-2 w-full py-2.5 text-white/40 transition hover:text-white/70">
        Continuo a guardare
      </button>
    </Velo>
  );
}

/** ── LA FINESTRA: «TI HANNO DATO LA PAROLA» ────────────────────────────────
 *  ⚠️ IL TOCCO SERVE, non è una formalità: Safari blocca camera e microfono che
 *   non nascono da un gesto della persona. Ed è anche giusto — la camera di
 *   qualcuno non si accende perché l'ha deciso un altro.
 *  ⚠️ E SI PUÒ ENTRARE SOLO CON LA VOCE anche quando il video è stato
 *   concesso: nessuno deve trovarsi la propria faccia davanti a duecento
 *   persone perché non ha visto il secondo pulsante. */
function InvitoInDiretta({
  conVideo, salendo, errore, onEntra, onRifiuta,
}: {
  conVideo: boolean;
  salendo: boolean;
  errore: string;
  onEntra: (conVideo: boolean) => void;
  onRifiuta: () => void;
}) {
  return (
    <Velo>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-400/20">
        <Radio className="h-5 w-5 text-emerald-300" />
      </div>
      <h2 className="sala-titolo">È il tuo turno</h2>
      <p className="sala-piccolo mt-2 text-white/60">
        {conVideo
          ? "Hai la parola. Scegli come entrare: con la camera, o solo con la voce."
          : "Hai la parola. Appena tocchi, ti sentono tutti."}
      </p>

      {/* ── ⚠️ I TASTI HANNO UN DENTRO ─────────────────────────────────
            Avevano solo `py-3.5`: nessun margine a destra e a sinistra, così
            la scritta arrivava a filo del bordo e il tasto sembrava una barra
            con del testo appoggiato sopra. Adesso c'è `px-5`, l'icona sta in
            una casella sua di larghezza fissa — le due scritte partono
            allineate anche se sono lunghe diverse — e il testo può andare a
            capo senza uscire dal tasto. */}
      <div className="mt-5 flex w-full flex-col gap-2.5">
        {conVideo && (
          <button
            onClick={() => onEntra(true)}
            disabled={salendo}
            className="sala-testo flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-blue-500 px-5 py-3.5 font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 active:scale-[0.99] disabled:opacity-50"
          >
            <span className="flex w-5 shrink-0 justify-center">
              {salendo ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Video className="h-4.5 w-4.5" />}
            </span>
            <span className="text-balance">{salendo ? "Un attimo…" : "Entra con video e voce"}</span>
          </button>
        )}
        <button
          onClick={() => onEntra(false)}
          disabled={salendo}
          className={`sala-testo flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl px-5 py-3.5 font-semibold transition active:scale-[0.99] disabled:opacity-50 ${
            conVideo
              ? "border border-white/20 text-white hover:bg-white/10"
              : "bg-brand text-white shadow-lg shadow-black/25 hover:brightness-110"
          }`}
        >
          <span className="flex w-5 shrink-0 justify-center">
            {salendo && !conVideo ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Mic className="h-4.5 w-4.5" />}
          </span>
          <span className="text-balance">
            {conVideo ? "Entra solo con la voce" : salendo ? "Un attimo…" : "Attiva il microfono"}
          </span>
        </button>
      </div>

      {!!errore && (
        <p className="sala-piccolo mt-3 w-full rounded-xl bg-rose-500/15 px-4 py-2.5 text-rose-200">
          {errore}
        </p>
      )}

      <button
        onClick={onRifiuta}
        className="sala-piccolo mt-2.5 w-full rounded-lg px-5 py-2.5 text-white/45 transition hover:bg-white/5 hover:text-white/75"
      >
        Non adesso
      </button>
    </Velo>
  );
}

/** ── QUELLO CHE CHI CONDUCE MANDA IN ONDA ─────────────────────────────────
 *  La pagina si disegna sempre a 1280×720 e poi si rimpicciolisce tutta
 *  intera dentro il riquadro: il perché sta in `webinar/schermo`, con il caso
 *  del telefono che l'ha reso necessario.
 *  ⚠️ Il riquadro si MISURA. Dedurlo dalla finestra vorrebbe dire sbagliarlo
 *   ogni volta che compare la fila degli ospiti, si apre la tastiera o la chat
 *   si prende la sua colonna — cioè quasi sempre. */
function Proiettata({ chiave, sorgente }: { chiave: string; sorgente: string }) {
  return (
    /*  ── ⚠️ NESSUN FORMATO IMPOSTO: LA FORMA È QUELLA DELLO SPAZIO ─────────
        Qui c'era una proiezione: la pagina si disegnava sempre a 1280×720 e
        veniva rimpicciolita dentro il riquadro. Serviva a rimediare a un
        difetto che adesso non c'è più — il palco era una striscia 16:9 alta
        duecento punti, e una pagina da computer lì dentro usciva da tutte le
        parti. Da quando la chat si sposta nella sua scheda, il palco è alto
        quanto lo schermo: e allora imporre un 16:9 vuol dire due bande nere in
        verticale sul telefono e la pagina disegnata piccola per stare in una
        forma che nessuno le ha chiesto.
        Adesso il riquadro è largo e alto quanto lo spazio che c'è — 9:16 su un
        telefono in piedi, 4:3 su un tablet, 16:9 sul computer — e la pagina si
        dispone da sé, come fa in qualunque altra parte dell'applicazione. Il
        rimedio non serve più: il male era la striscia. */
    <iframe
      key={chiave}
      src={sorgente}
      title="Quello che viene mostrato in diretta"
      className="h-full w-full border-0 bg-white"
    />
  );
}

/** ── PRIMA CHE COMINCI, AL POSTO DELLA CHAT ───────────────────────────────
 *  ⚠️ NON È UNA CHAT SPENTA. Un campo di testo disabilitato con sopra un
 *   avviso invita comunque a provarci: si tocca, non succede niente, e la
 *   conclusione è «si è rotto». Qui la chat proprio non c'è ancora, e al suo
 *   posto c'è l'unica cosa che in quel momento si vuole sapere — che sta per
 *   cominciare, e fra quanto.
 *  ⚠️ Il conto alla rovescia è lo STESSO del palco (`quantoManca`), non un
 *   secondo conto: due orologi nella stessa pagina prima o poi segnano due ore
 *   diverse, e chi legge non sa a quale credere. Le voci che non servono più
 *   spariscono da sole — sotto l'ora non si scrivono i giorni.
 */
function AttesaInChat({
  manca, fase, giaCominciata,
}: { manca: ReturnType<typeof quantoManca>; fase: string; giaCominciata: boolean }) {
  //  ⚠️ «Sta per cominciare» NON si scrive quando è già cominciata. Succedeva:
  //   la pagina diceva «È già cominciata — entra e ascolta» e la colonna
  //   accanto, nello stesso istante, «sta per cominciare». Due frasi che si
  //   contraddicono a dieci centimetri l'una dall'altra, e chi legge non sa a
  //   quale credere. Prima di entrare la diretta c'è: manca solo il tocco.
  const conta = !giaCominciata && !!manca && !manca.passato;
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-5 text-center">
      {/*  Tre anelli sfasati attorno all'icona: la stessa figura del pallino
          della diretta, ingrandita, così le due schermate si riconoscono come
          la stessa cosa in due momenti diversi. */}
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/20" />
        <span className="absolute inline-flex h-14 w-14 animate-pulse rounded-full bg-amber-400/15" />
        <span className="absolute inline-flex h-20 w-20 rounded-full border border-amber-300/25" />
        <Radio className="relative h-8 w-8 text-amber-300" />
      </div>

      <div className="space-y-1.5">
        <p className="sala-titolo">
          {fase === "finito" ? "La diretta è finita"
            : giaCominciata ? "La chat ti aspetta"
            : conta ? "La diretta sta per partire"
            : "Sta per cominciare"}
        </p>
        <p className="sala-piccolo text-white/50">
          {fase === "finito" ? "La chat si chiude qui."
            : giaCominciata ? "Entra nella diretta per leggere e scrivere."
            : "La chat si apre quando comincia la diretta. Resta pure qui."}
        </p>
      </div>

      {conta && fase !== "finito" && (
        <>
          <p className="sala-etichetta text-white/35">comincia fra</p>
          <div className="flex items-start justify-center gap-2.5">
            {manca.voci.map((v) => (
              <div
                key={v}
                className="flex min-w-[3.4rem] flex-col items-center rounded-xl border border-white/10 bg-white/[0.04] px-2 py-2.5"
              >
                {/*  ⚠️ `tabular-nums`: senza, ogni cifra ha una larghezza sua e
                      la riga si sposta a ogni secondo. Un conto alla rovescia
                      che balla si guarda una volta e poi si distoglie lo
                      sguardo. */}
                <span className="sala-titolo tabular-nums">{valore(manca, v)}</span>
                <span className="sala-micro uppercase tracking-wide mt-1 text-white/35">{etichetta(manca, v)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/*  I tre puntini che scorrono: dicono «è vivo» a chi guarda la pagina da
          dieci minuti senza che cambi niente. */}
      {fase !== "finito" && !giaCominciata && (
        <span className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/30"
              style={{ animationDelay: `${i * 160}ms` }}
            />
          ))}
        </span>
      )}
    </div>
  );
}

/** ── LA BOLLA DI CHI CONDUCE ───────────────────────────────────────────────
 *  Solo la faccia, tonda, spostabile. Il perché sta dove viene disegnata.
 *
 *  ⚠️ IL FLUSSO ARRIVA GIÀ SCELTO DA FUORI, e non se lo ricava lei dall'elenco
 *   dei relatori. Era proprio quello il difetto della camera nera: l'elenco
 *   nasce solo quando i relatori sono DUE, e con uno solo la sua traccia sta
 *   nel flusso principale. Chiedendola all'elenco si otteneva niente — un
 *   riquadro nero — mentre il riquadro grande, che usava la strada giusta, la
 *   faccia ce l'aveva. Due strade per la stessa cosa, e una sbagliata.
 *
 *  ⚠️ Il video è attaccato con `attaccaFlusso` come tutti gli altri: era una
 *   copia a parte, e il giorno che quella ha imparato a ripiegare sul muto —
 *   senza cui il telefono resta nero — questa sarebbe rimasta indietro in
 *   silenzio.
 */
function BollaRelatore({ flusso, sotto }: { flusso: MediaStream | null; sotto: number }) {
  //  ⚠️ NASCE IN ALTO A SINISTRA, e quell'angolo lo tiene il CSS finché nessuno
  //   la sposta. I due numeri qui sotto servono solo da rete di sicurezza per
  //   il disegno sul server, dove non c'è nessuna finestra da misurare.
  const { box, pos, maniglia, scelta } = useTrascinabile("hg_webinar_bolla", { x: 16, y: 16 });
  const [misura, spazio] = useMisura<HTMLDivElement>();

  //  ⚠️ Sul LATO CORTO: su un telefono in piedi lo spazio è alto e stretto, e
  //   un cerchio calcolato sull'altezza uscirebbe dai bordi. Un quinto del lato
  //   corto, mai sotto ottantaquattro punti (sotto non si riconosce una faccia)
  //   e mai sopra centosessanta (sopra non è più un accessorio, è un secondo
  //   protagonista sopra la cosa da guardare).
  const corto = Math.min(spazio.larghezza || 0, spazio.altezza || 0);
  const lato = corto > 0 ? Math.round(Math.min(160, Math.max(84, corto * 0.2))) : 96;

  return (
    <div ref={misura} className="pointer-events-none absolute inset-0 z-30">
      <div
        ref={box}
        {...maniglia}
        title="Trascina per spostarla"
        style={{
          position: "fixed",
          //  ⚠️ Angolo finché nessuno ha scelto, punti da quando sceglie. Il
          //   perché sta in `useTrascinabile`: l'angolo calcolato in punti
          //   diventa (8, 8) — cioè sopra il marchio — tutte le volte che la
          //   finestra non è ancora misurata.
          //  ⚠️ SOTTO L'INTESTAZIONE, non incollata al bordo: a dodici punti
          //   dall'alto la bolla finisce sopra il marchio e sopra il bollino
          //   della diretta — è già successo, ed è la prima cosa che si nota
          //   perché copre le uniche due cose ferme della pagina. Settantadue
          //   punti sono l'altezza dell'intestazione più un respiro.
          ...(scelta ? { left: pos.x, top: pos.y } : { left: 12, top: sotto }),
          width: lato,
          height: lato,
        }}
        className="pointer-events-auto cursor-move touch-none overflow-hidden rounded-full border-2 border-white/25 bg-black shadow-2xl"
      >
        <video
          ref={attaccaFlusso(flusso, false)}
          playsInline
          autoPlay
          //  ⚠️ `cover` e non `contain`: in un cerchio le bande nere di un 16:9
          //   diventano due lune nere sopra e sotto la faccia.
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}

/** Il fondo scuro e la scheda al centro: uguale per le due finestre, così non
 *  possono divergere. Sul telefono sale dal basso e resta larga quanto lo
 *  schermo meno un margine — al centro esatto, con la tastiera chiusa, è dove
 *  il pollice arriva peggio. */
function Velo({ children, onChiudi }: { children: React.ReactNode; onChiudi?: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
      //  ⚠️ Si chiude toccando fuori SOLO dove ha senso: l'invito a entrare in
      //   diretta no, perché chiuderlo per sbaglio vuol dire far aspettare a
      //   vuoto duecento persone e chi conduce.
      onClick={onChiudi ? (e) => { if (e.target === e.currentTarget) onChiudi(); } : undefined}
    >
      <div className="w-full max-w-[22rem] rounded-2xl border border-white/12 bg-[#0a1730] p-5 text-center shadow-2xl">
        <div className="flex flex-col items-center">{children}</div>
      </div>
    </div>
  );
}

/** Una riga dell'elenco: icona a sinistra, testo a capo sotto di sé. */
function Punto({ icona: Icona, children }: { icona: typeof Mic; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <Icona className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
      <span className="sala-piccolo text-white/70">{children}</span>
    </li>
  );
}


/** ── ⚠️ «LA CAMERA C'È MA NON SI VEDE NIENTE» ──────────────────────────────
 *  Il perché e le soglie stanno in `webinar/camera-buia`. Qui c'è solo il
 *  campionamento: ogni due secondi si guarda il pixel più chiaro, si tengono
 *  gli ultimi tre, e si risponde alla domanda «vale la pena mostrare questo
 *  video?».
 *  ⚠️ Si smette di campionare quando non c'è niente da campionare: senza
 *   flusso il timer resterebbe acceso per tutta la diretta su ogni riquadro. */
function useCameraBuia(flusso: MediaStream | null) {
  const [buia, setBuia] = useState(false);
  const el = useRef<HTMLVideoElement | null>(null);
  const campioni = useRef<number[]>([]);

  //  ⚠️ Un `setTimeout` che si riprogramma, non un intervallo fisso: il ritmo
  //   cambia con la risposta — spesso finché non si sa o finché è buia, raro
  //   quando si sta vedendo qualcosa. Il perché sta in `webinar/camera-buia`,
  //   ed è la correzione della diretta che andava a scatti.
  useEffect(() => {
    campioni.current = [];
    setBuia(false);
    if (!flusso) return;
    let vivo = true;
    let prossimo: ReturnType<typeof setTimeout> | null = null;
    const giro = () => {
      if (!vivo) return;
      const v = el.current;
      let buiaOra = false;
      if (v) {
        const luce = guardaSeBuia(v);
        if (luce !== null) {
          campioni.current = [...campioni.current, luce].slice(-CAMPIONI_AL_BUIO);
          buiaOra = cameraSpenta(campioni.current);
          setBuia(buiaOra);
        }
      }
      prossimo = setTimeout(giro, quandoRiguardare({
        buia: buiaOra,
        deciso: campioni.current.length >= CAMPIONI_AL_BUIO,
        chiave: flusso.id || "",
      }));
    };
    prossimo = setTimeout(giro, 1200);
    return () => { vivo = false; if (prossimo) clearTimeout(prossimo); };
  }, [flusso]);

  return { el, buia };
}

/** ── UN QUADRATO DEL FACCIA A FACCIA ───────────────────────────────────────
 *  ⚠️ RIEMPIE, non conserva le proporzioni: una camera manda un 16:9 e la
 *   cella è un quadrato, quindi qualcosa si taglia per forza. Tagliare i lati
 *   di un'inquadratura vuol dire togliere sfondo; lasciare le bande nere vuol
 *   dire rimpicciolire la faccia in un dibattito, cioè proprio la cosa che si
 *   sta guardando. Si taglia.
 *  ⚠️ I due quadrati sono IDENTICI, e la parità è tutto il senso della cosa:
 *   in un dibattito il riquadro più piccolo ha già perso prima di parlare. Chi
 *   conduce non ha nessun contorno in più — solo il nome, come l'altro.
 */
function QuadratoDuello({
  lato, flusso, nome, parla, mio,
}: { lato: number; flusso: MediaStream | null; nome: string; parla?: boolean; mio?: boolean }) {
  const conVideo = !!flusso?.getVideoTracks().some((v) => v.enabled && v.readyState === "live");
  return (
    <div
      style={lato ? { width: lato, height: lato } : { width: "100%", aspectRatio: "1 / 1" }}
      className={`relative shrink-0 overflow-hidden rounded-2xl border-2 bg-black/60 transition ${
        parla ? "border-emerald-400/80" : "border-white/12"
      }`}
    >
      {conVideo ? (
        <video
          ref={attaccaFlusso(flusso, mio)}
          playsInline
          autoPlay
          className={`h-full w-full object-cover ${mio ? "-scale-x-100" : ""}`}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-white/[0.05]">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-xl font-semibold text-white/70">
            {(nome || "?").trim().charAt(0).toUpperCase()}
          </span>
          <audio ref={attaccaFlusso(flusso, mio)} autoPlay className="hidden" />
        </div>
      )}
      <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/85 to-transparent px-2.5 py-2">
        {parla && (
          <span className="relative flex h-1.5 w-1.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-300" />
          </span>
        )}
        <span className="sala-piccolo min-w-0 truncate font-semibold">{mio ? "Tu" : nome}</span>
      </span>
    </div>
  );
}

function RiquadroPalco({
  persona, flusso, grande, mio,
}: { persona: InPalco; flusso: MediaStream | null; grande?: boolean; mio?: boolean }) {
  //  ⚠️ Si guarda la TRACCIA, non solo lo stato dichiarato: uno fatto salire
  //   «con video» può non aver ancora acceso la camera, e in quel mezzo minuto
  //   un rettangolo nero col suo nome sopra si legge come un guasto.
  //  ⚠️ Non basta che la traccia sia viva: il perché sta in
  //   `webinar/camera-buia`. In breve, una traccia viva può portare fotogrammi
  //   tutti neri — l'ho misurata in sala — e il risultato era un rettangolo
  //   nero col nome sopra.
  const { el: rifVideo, buia } = useCameraBuia(flusso);
  const conVideo =
    !!flusso?.getVideoTracks().some((t) => t.enabled && t.readyState === "live") && !buia;

  return (
    /*  ⚠️ `grande` NON allarga più il riquadro: nella fila degli ospiti tutti
        hanno la stessa misura, e chi è in primo piano si riconosce dal
        contorno e dal fatto che sta per primo. Prima era `col-span-full`, che
        in una griglia voleva dire «prendi tutta la riga»: in una fila che
        scorre non vuol dire niente, e lasciarlo lì sarebbe stata una classe
        senza effetto che il prossimo che legge crede funzionante. */
    /*  ⚠️ IL PROPRIO RIQUADRO SI RICONOSCE DA LONTANO. Sul palco ci sono
        quattro facce piccole tutte uguali, e senza un segno la propria si
        cerca ogni volta — mentre si sta parlando davanti a duecento persone,
        cioè nel momento peggiore per mettersi a cercare. Un contorno chiaro e
        la parola «tu» al posto del nome: sono le due cose che si guardano per
        prime. */
    <div
      className={`relative h-full w-full overflow-hidden rounded-xl border bg-black/40 ${
        grande ? "ring-2 ring-brand" : ""
      } ${
        mio
          ? "border-sky-300 shadow-[0_0_0_2px_rgba(125,211,252,0.35)]"
          : persona.parla && persona.microfono
            ? "border-emerald-400/70"
            : "border-white/10"
      }`}
    >
      {/*  ⚠️ RIEMPIE LA CELLA, non impone un 16:9. Il riquadro adesso vive in
            una striscia di altezza fissa: chiedendo `aspect-video` la faccia
            sarebbe uscita dalla cella (più alta della striscia) e si sarebbe
            vista tagliata dal bordo invece che dall'inquadratura.
           Qui il ritaglio è VOLUTO e va bene: è un francobollo da cui si deve
           riconoscere una persona, non la scena principale — è quello che fanno
           tutte le piattaforme con le miniature degli ospiti. La regola opposta
           vale per il riquadro grande, che le proporzioni le deve rispettare. */}
      {/*  ⚠️ IL VIDEO RESTA MONTATO ANCHE QUANDO È BUIO, solo nascosto:
            smontandolo, il campionamento non avrebbe più niente da guardare e
            non si accorgerebbe MAI che la camera è tornata — chi copre
            l'obiettivo per un attimo resterebbe un avatar per tutta la
            diretta. */}
      {!!flusso && (
        <video
          //  ⚠️ Il proprio video va MUTO e SPECCHIATO. Muto perché altrimenti
          //   si sente la propria voce con mezzo secondo di ritardo, che è il
          //   modo più veloce di far smettere di parlare una persona.
          //   Specchiato perché è quello che fa uno specchio, ed è come tutte
          //   le videochiamate mostrano la propria immagine: senza, alzare la
          //   mano destra la fa muovere dalla parte sbagliata.
          ref={(v) => { rifVideo.current = v; attaccaFlusso(flusso, mio)(v); }}
          playsInline
          autoPlay
          className={`h-full w-full bg-black object-cover ${mio ? "-scale-x-100" : ""} ${
            conVideo ? "" : "invisible"
          }`}
        />
      )}

      {/*  ⚠️ L'iniziale COPRE il video invece di sostituirlo: sotto, il video
            continua a esistere e a essere campionato. È la stessa ragione per
            cui non lo si smonta.
           ⚠️ E vale per tutti e due i casi — chi è salito in sola voce e chi
            ha la camera che non porta niente: da fuori sono la stessa cosa, e
            due schermate diverse per la stessa cosa sono due schermate da
            mantenere. */}
      {!conVideo && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a1730]">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-sm font-semibold text-white/70">
            {(mio ? "Tu" : persona.nome || "?").trim().charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      {/*  ⚠️ Chi è salito in sola voce non ha niente da mostrare, ma la sua
            voce deve USCIRE: senza questo elemento la traccia arriva e non la
            sente nessuno. Sta fuori dal ramo del video apposta — se il video
            c'è ma è nero, l'audio deve continuare a sentirsi. */}
      {!!flusso && !flusso.getVideoTracks().length && (
        <audio ref={attaccaFlusso(flusso, mio)} autoPlay className="hidden" />
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5">
        {persona.microfono ? (
          <Mic className={`h-3 w-3 ${persona.parla ? "text-emerald-300 drop-shadow-[0_0_6px_rgba(52,211,153,0.9)]" : "text-white/50"}`} />
        ) : (
          <MicOff className="h-3 w-3 text-white/30" />
        )}
        <span className="sala-piccolo min-w-0 flex-1 truncate font-medium">
          {mio ? "Tu" : persona.nome}
        </span>
      </div>
    </div>
  );
}

/** ── IL CODICE DEL GUASTO, PICCOLO E IN FONDO ──────────────────────────────
 *  ⚠️ SERVE A CHI GUARDA, non a chi ha scritto il programma: «mi dà W06» è una
 *   informazione che si può dire al telefono a chi conduce, e «non si vede
 *   niente» non lo è — ed era tutto quello che si poteva dire prima.
 *  Si può toccare per copiarlo: chi lo legge da un telefono lo deve poi
 *  scrivere in chat, e ricopiare a mano quattro caratteri è il punto in cui si
 *  sbaglia o si lascia perdere. */
function CodiceGuasto({ codice }: { codice: string }) {
  const [copiato, setCopiato] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(codice).then(
          () => { setCopiato(true); setTimeout(() => setCopiato(false), 1500); },
          () => { /* senza permesso resta comunque leggibile a schermo */ },
        );
      }}
      className="sala-micro pointer-events-auto rounded-md bg-white/[0.06] px-2 py-1.5 font-mono normal-case tracking-normal text-white/40 transition hover:bg-white/10 hover:text-white/80"
    >
      {copiato ? "copiato" : `codice ${codice}`}
    </button>
  );
}
