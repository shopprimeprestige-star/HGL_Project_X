// Menu di controllo sticky del presentatore (solo consulente, ogni dispositivo).
// La diretta è SEMPRE attiva: mostra solo il link da copiare per il cliente.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  FileText,
  Images,
  Copy,
  Presentation,
  Scissors,
  Globe,
  PhoneCall,
  PhoneOff,
  Smartphone,
  Tablet,
  Monitor,
  MonitorSmartphone,
  LayoutGrid,
  Minus,
  Plus,
  Settings,
  Users,
  LogOut,
  Check,
  X,
  ChevronDown,
  FilePlus2,
  FolderClock,
  Video,
  VideoOff,
  RotateCcw,
} from "lucide-react";
import { BrandLogo } from "@/shop/BrandLogo";
import { PresenterSettingsHub } from "@/shop/PresenterSettingsHub";
import { QuotesPanel } from "@/shop/QuotesPanel";
import {
  useLiveId,
  startLive,
  newLiveId,
  setPresenterPage,
  adoptLiveId,
  getLiveId,
  indirizzoPreventivo,
  pulisciSessioneDallIndirizzo,
  inStanzaConsulenza,
} from "@/shop/live";
import { useConsultant, usePresenterLink, useSessionePresentatore } from "@/shop/consultant";
import { urlPubblico, urlStanza } from "@/lib/sito";
import { depositaAnteprimaStanza } from "./anteprima-stanza";
import { usePresenter, getPresenter, setPresenter, clearPresenter, type Presenter } from "@/shop/presenter";
import { PresenterGate } from "@/shop/PresenterGate";
import { useCall, requestStart, endCall, resumeCallSilently, republishSession } from "@/shop/call";
import { ConsoleSala, PopupTrasmissione } from "@/webinar/DaMeetly";
import { useViewMode, setMode, setZoom } from "@/shop/viewmode";
import { toast } from "sonner";
import { copyLink } from "@/shop/copied";
import { linkPreventivo, sessionePreventivo } from "@/shop/quote-link";
//  Il gemello per i media: stessa idea, stessa sessione aperta al clic.
import { linkMedia, sessioneMedia } from "@/shop/link-media";
//  La camera sui link «solo una cosa»: il consulente si accende, chi ha il
//  link lo vede in un angolo. Niente stanza, niente permessi al cliente.
import { accendiCameraLink, spegniCameraLink, useCameraLink } from "@/shop/camera-link";
import { AnteprimaCameraLink } from "@/shop/AnteprimaCameraLink";
import { depositaAnteprimaPreventivo } from "@/shop/anteprima-preventivo";
import { getQuoteRef, setQuoteRef, useQuoteRef } from "@/shop/quote-ref";
import { type Bozza, bozzaDisponibile, quandoBozza, eliminaBozza } from "@/shop/bozza";
import { sfx, primeSfx } from "@/shop/sfx";
//  Chi è in consulenza, per il menu «nuovo preventivo per…» (compare solo
//  quando le persone sono più d'una: vedi PlanciaGruppo).
import { useAttesiDelConsulente } from "@/shop/PlanciaGruppo";
import { cambiaRegia } from "@/shop/regia-gruppo";

/** Chiude un pannello aperto con il tasto Esc. Un menu si chiude toccando
 *  fuori — e ci pensa il velo trasparente sotto — ma da tastiera la via
 *  d'uscita è Esc: senza, chi lavora col portatile resta col menu aperto e
 *  deve andare a cercare il vuoto col mouse.
 *  La funzione di chiusura sta in un riferimento: così l'ascoltatore si
 *  registra UNA volta all'apertura e non a ogni ridisegno della barra. */
function useEsc(attivo: boolean, chiudi: () => void) {
  const cb = useRef(chiudi);
  cb.current = chiudi;
  useEffect(() => {
    if (!attivo || typeof document === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cb.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [attivo]);
}

type Page = "preventivo" | "presenta" | "slide" | "web" | "capelli";
function pageFromPath(p: string): Page {
  if (p.startsWith("/slide")) return "slide";
  if (p.startsWith("/presenta")) return "presenta";
  if (p.startsWith("/web")) return "web";
  if (p.startsWith("/prova-capelli")) return "capelli";
  return "preventivo";
}

export function PresenterBar({ page }: { page?: Page }) {
  const [env, setEnv] = useState(false);
  const liveId = useLiveId();
  /*  Chi è in consulenza: serve al menu «nuovo preventivo per…».
      ⚠️ STA QUI, IN ALTO, E NON ACCANTO A DOVE SERVE: più sotto questo
       componente può uscire prima (`return null`), e un aggancio sotto
       un'uscita anticipata cambia il numero di agganci fra un giro e
       l'altro — React si ferma, e la barra del consulente sparisce tutta.
       È successo davvero, oggi. */
  const { consultant } = useConsultant();
  const call = useCall();
  /*  ⚠️ SOLO A CONSULENZA APERTA. `liveId` è l'ULTIMA consulenza e resta
      scritto in memoria per sempre (serve al «Rientra»): senza questa
      condizione il menu del preventivo avrebbe offerto «Nuovo per Antonio»
      per tutta la giornata, sul gestionale, senza nessuno in linea. È lo
      stesso errore che ha fatto comparire la plancia dove non doveva. */
  const attesiQui = useAttesiDelConsulente(call.sessionLive || call.active ? liveId : null);
  //  Camera sui link «solo preventivo» / «solo media» (niente videochiamata).
  const cam = useCameraLink();
  const vm = useViewMode();
  const gvp = useCall().guestViewport; // viewport reale del cliente collegato
  const navigate = useNavigate();
  const [cur, setCur] = useState<Page>("preventivo");
  const [copyMenu, setCopyMenu] = useState(false);
  //  La scelta fra consulenza e webinar. Vive qui e non nel motore della
  //  chiamata: è una domanda dell'interfaccia, non dello stato della sessione.
  const [sceltaTrasmissione, setSceltaTrasmissione] = useState(false);
  const [quoteMenu, setQuoteMenu] = useState(false); // Preventivo → nuovo / attivi
  const [quotesPanel, setQuotesPanel] = useState(false);
  const [hub, setHub] = useState(false); // hub Impostazioni presentatore
  const [hubTab, setHubTab] = useState<"presentatori" | undefined>(undefined);
  const presenter = usePresenter(); // presentatore loggato (nome + PIN)
  const [gateDone, setGateDone] = useState(false);
  // menu "cambio presentatore" dal logo
  const [presMenu, setPresMenu] = useState(false);
  const [presList, setPresList] = useState<Presenter[]>([]);
  const [pinFor, setPinFor] = useState<Presenter | null>(null); // presentatore in attesa di PIN
  const [pin, setPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [resumable, setResumable] = useState(false); // sessione attiva sul server da riprendere
  /** Consulenza viva sul server con un codice diverso dal nostro: si può
   *  rientrare, ma solo su richiesta esplicita. */
  const [diversa, setDiversa] = useState<{ code: string; chi: string } | null>(null);
  /** Numero del preventivo su cui stiamo lavorando. Si aggiorna DA SOLO: prima
   *  veniva letto una volta sola, mentre la barra si disegnava, e la barra non
   *  si ridisegna quando crei un preventivo — così il link copiato restava
   *  senza il numero, o con quello del cliente di prima.
   *  Sta quassù con gli altri: sotto ci sono uscite anticipate, e un hook
   *  dichiarato dopo un'uscita fa fallire il disegno dell'intera pagina. */
  const quoteRef = useQuoteRef();
  /** Lavoro lasciato a metà in questa consulenza (per la voce "Recupera"). */
  const [bozzaViva, setBozzaViva] = useState<Bozza | null>(null);
  /** Chiusura del menu del logo: azzera anche la richiesta di PIN a metà,
   *  altrimenti riaprendolo si ritrova il campo di prima già acceso. */
  const chiudiPresMenu = () => {
    setPresMenu(false);
    setPinFor(null);
    setPin("");
  };
  //  Esc chiude i menu della barra. Sta QUI, sopra le uscite anticipate: un
  //  hook dichiarato dopo un `return` fa fallire il disegno dell'intera pagina.
  useEsc(presMenu, chiudiPresMenu);
  useEsc(copyMenu, () => setCopyMenu(false));
  useEsc(quoteMenu, () => setQuoteMenu(false));

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    // La barra è solo per il consulente; nascosta al cliente/spettatore e negli iframe di anteprima.
    const hide =
      !!p.get("watch") ||
      inStanzaConsulenza(window.location.pathname) ||
      p.get("client") === "1" ||
      p.get("embed") === "1" ||
      window.self !== window.top;
    setEnv(!hide);
    setCur(page || pageFromPath(window.location.pathname));
  }, [page]);

  /*  ── ⚠️ LA SCHERMATA SI REGISTRA DOVE SEI, NON SOLO SE CLICCHI ─────────
      Segnalazione del committente: «apro Meetly, va in automatico sul
      preventivo; poi vado su Media e il cliente resta sul preventivo».

      La pagina condivisa si scriveva in DUE soli momenti: premendo un
      pulsante di questa barra, e all'avvio di una diretta. Tutti gli altri
      modi di arrivare su una schermata — l'indirizzo scritto a mano, un
      segnalibro, il tasto indietro, e soprattutto la consulenza aperta dal
      CRM (che imposta il codice e porta sul preventivo senza passare da qui)
      — non registravano niente. Il server non sapeva dove fosse il
      consulente, rispondeva col suo ripiego, e il cliente finiva sul
      preventivo e ci restava: da lì «rimane su preventivo» qualunque cosa
      facessi, perché nessuno aveva mai scritto il contrario.

      Adesso la schermata si registra da sé a ogni cambio di indirizzo,
      finché una consulenza è viva. `setPresenterPage` continua a rifiutare
      tutto ciò che non è fatto per essere guardato da un cliente (il CRM, il
      cancello dei presentatori): stando lì, il cliente resta semplicemente
      sull'ultima schermata buona. */
  const indirizzoDetto = useRef("");
  useEffect(() => {
    if (!env || !consultant || !liveId || typeof window === "undefined") return;
    const dillo = () => {
      const ora = window.location.pathname + window.location.search;
      if (ora === indirizzoDetto.current) return;
      indirizzoDetto.current = ora;
      setPresenterPage(ora);
    };
    dillo();
    //  Il tasto indietro/avanti non cambia componente: senza questo, tornando
    //  indietro il cliente resterebbe sulla schermata di prima.
    window.addEventListener("popstate", dillo);
    const iv = setInterval(dillo, 1500);
    return () => { window.removeEventListener("popstate", dillo); clearInterval(iv); };
  }, [env, consultant, liveId, cur]);

  /*  ── ⚠️ ARRIVATO DA «AVVIA CONSULENZA»: SI TRASMETTE SUBITO ────────────
      Richiesta del committente: «quando clicco avvia, si apre direttamente la
      consulenza e avvia la trasmissione su quel link».
      Il biglietto lo lascia `avviaConsulenza` (crm/MeetGiornalieri) prima di
      aprire questa scheda. Vale UNA volta e per UNA stanza:
       · si consuma subito, prima ancora di avviare, così un ricaricamento non
         fa ripartire niente;
       · deve parlare della stanza che questa postazione ha davvero in mano,
         altrimenti si trasmetterebbe su una consulenza sbagliata;
       · scade dopo due minuti: una scheda riaperta domani non deve mettersi a
         trasmettere da sola.
      Serve il consulente collegato: senza nome la chiamata chiederebbe «chi
      sei» con una finestra, che è esattamente il gesto in più da togliere. */
  useEffect(() => {
    if (!env || !consultant || !liveId || !presenter?.name || call.active || call.pendingStart) return;
    let biglietto: { code?: string; at?: number } | null = null;
    try { biglietto = JSON.parse(localStorage.getItem("hg_avvia_subito") || "null"); } catch { /* */ }
    if (!biglietto?.code || biglietto.code !== liveId) return;
    if (!biglietto.at || Date.now() - biglietto.at > 2 * 60_000) {
      try { localStorage.removeItem("hg_avvia_subito"); } catch { /* */ }
      return;
    }
    try { localStorage.removeItem("hg_avvia_subito"); } catch { /* */ }
    console.log("[BAR] arrivato da «Avvia consulenza» → avvio la trasmissione su", liveId);
    requestStart();
  }, [env, consultant, liveId, presenter?.name, call.active, call.pendingStart]);

  // RIPRESA SESSIONE: la sessione vive sul SERVER. All'apertura (anche da un altro
  // browser/dispositivo) il presentatore recupera il codice della chiamata ancora
  // attiva → stessa sessione, e il link dell'ospite resta valido.
  /*  ── ⚠️ CHI TRASMETTE LO DICE IL SERVER, NON IL BROWSER ─────────────────
      Segnalazione del committente: «condivido il link da un consulente e
      l'ospite entra sempre su Filippo Cona».
      Il nome annunciato al cliente — quello sulla targhetta in videochiamata,
      quello scritto nella sessione, quello che il cliente si porta via — si
      leggeva da `hg_presenter`, cioè da una scelta fatta UNA VOLTA su QUESTO
      browser e rimasta lì. Ma chi ha digitato il PIN lo sa il SERVER, che ha
      aperto la sessione. Se i due non coincidono — computer condiviso,
      postazione usata prima da un collega, sessione ripresa altrove — vince
      il browser, e ogni cliente di chiunque si ritrovava davanti il nome di
      chi era passato di lì per ultimo.
      Adesso comanda il server: all'apertura si chiede «chi sono?» e il nome
      salvato qui si allinea. Una sessione aperta col solo codice consulente
      non ha un nome di persona (`id` vuoto) e non sovrascrive niente: lì
      decide il cancello dei presentatori, come prima. */
  useEffect(() => {
    if (!env || !consultant) return;
    let stop = false;
    fetch("/api/presenter/consultant")
      .then((r) => r.json())
      .then((j) => {
        if (stop || !j?.ok) return;
        const chi = j.presenter as { id?: string; name?: string } | null;
        if (!chi?.id || !chi?.name) return;   // sessione senza persona: non si tocca niente
        const qui = getPresenter();
        if (qui && qui.id === chi.id && qui.name === chi.name) return;
        console.warn(
          `[BAR] questo browser diceva «${qui?.name || "nessuno"}», ma chi è collegato è «${chi.name}» → vale il server`,
        );
        setPresenter({ id: chi.id, name: chi.name });
      })
      .catch(() => { /* offline: resta la scelta locale, il cancello farà il resto */ });
    return () => { stop = true; };
  }, [env, consultant]);

  // ── UN PRESENTATORE CANCELLATO NON DEVE RESTARE IN GIRO ───────────────────
  //  Il nome scelto resta salvato su QUESTO dispositivo. Se quel presentatore
  //  viene poi rinominato o eliminato dalle impostazioni, qui resterebbe il
  //  vecchio nome — e sarebbe quello annunciato al cliente in videochiamata.
  //  All'avvio si controlla che esista ancora davvero.
  useEffect(() => {
    if (!env || !consultant || !presenter) return;
    let stop = false;
    fetch("/api/presenter/presenters")
      .then((r) => r.json())
      .then((j) => {
        if (stop) return;
        const list = (j.presenters as Presenter[]) ?? [];
        if (!list.length) return; // nessuno configurato: si lascia com'è
        if (!list.some((x) => x.id === presenter.id)) {
          console.warn(
            "[BAR] presentatore non più configurato:",
            presenter.name,
            "→ si richiede di riselezionarlo",
          );
          clearPresenter();
          setGateDone(false);
        }
      })
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [env, consultant, presenter]);

  useEffect(() => {
    if (!env || !consultant) return;
    let stop = false;
    const p = new URLSearchParams(window.location.search).get("session");
    //  Il codice scritto nell'indirizzo vince su quello del server, ma il
    //  controllo NON si ferma qui: fermandolo, una pagina ricaricata durante
    //  una chiamata non si riagganciava più da sola — restava senza "Rientra"
    //  e senza ripresa automatica, con il cliente ancora dentro.
    //  Il codice arrivato nel link vale UNA volta: si adotta e si toglie
    //  dall'indirizzo. Restandoci, ogni ricaricamento lo avrebbe riapplicato —
    //  riportando la postazione su una consulenza vecchia mentre quella viva
    //  era un'altra, con il cliente fermo sulla schermata d'attesa.
    if (p) {
      adoptLiveId(p);
      pulisciSessioneDallIndirizzo();
    }
    /*  ── SI CHIEDE DELLA PROPRIA CONSULENZA, NON DI «UNA QUALSIASI» ──────
        Qui si leggeva la sessione senza dire quale: il server ne teneva una
        per tutti, così due consulenti in diretta nello stesso momento si
        rubavano il codice a vicenda. Adesso si chiede la riga del PROPRIO
        codice; la riga storica si guarda solo per ritrovare una consulenza
        propria lasciata aperta su un altro computer, e vale soltanto se porta
        il nome di chi sta usando questa postazione. */
    const leggi = (u: string) => fetch(u).then((r) => r.json()).catch(() => null);
    const check = async () => {
      const mioCodice = getLiveId();
      const mioJ = mioCodice
        ? await leggi(`/api/presenter/session?sess=${encodeURIComponent(mioCodice)}`)
        : null;
      if (stop) return;
      let altrove = null as null | Record<string, unknown>;
      if (!mioJ?.live) {
        const seg = await leggi("/api/presenter/session");
        if (stop) return;
        //  ⚠️ Solo se è MIA: senza questo controllo la postazione appena
        //   aperta adottava la consulenza del collega che stava trasmettendo.
        if (seg?.live && seg?.code && presenter?.id && seg.presenterId === presenter.id) altrove = seg;
      }
      const j = (mioJ?.live ? mioJ : altrove) as Record<string, any> | null;
      try {
          if (j?.live && j?.code) {
            // ── DUE POSTAZIONI, DUE CONSULENZE ─────────────────────────────────
            //  Una postazione adotta il codice del server SOLO se non ha già
            //  una consulenza sua: se sto conducendo una chiamata, quella resta
            //  mia. Chi non ha nulla in corso continua a poter riprendere la
            //  sessione da un altro computer, che è il motivo per cui l'adozione
            //  esiste.
            const mio = getLiveId();
            /*  ── ⚠️ IL CANALE NON CAMBIA SOTTO CHI STA BUSSANDO ─────────────
                Segnalazione del committente: «l'utente non riesce a entrare,
                accetto più volte e non va».
                Adottare un codice vuol dire CAMBIARE CANALE. «Occupato» era
                solo «sono in videochiamata»: ma un cliente che bussa arriva
                quasi sempre PRIMA che la chiamata sia attiva — è tutto il
                senso della sala d'attesa. Bastava che il server rispondesse
                con un codice diverso (una sessione vecchia di questa stessa
                postazione) perché la postazione ci saltasse sopra: il popup
                di chi bussava restava a schermo, ma «Accetta» mandava il via
                libera in una stanza dove quel cliente non c'era. Lui
                continuava a bussare, tu continuavi ad accettare, e non
                succedeva niente.
                Adesso è occupata anche quando c'è qualcuno alla porta o in
                casa: si cambia stanza solo quando non si sta ricevendo. */
            const occupato =
              call.active ||
              call.pendingStart ||
              call.sessionLive ||
              call.knocks.length > 0 ||
              call.roster.some((r) => r.role === "viewer");
            if (!occupato && (!mio || mio === j.code)) adoptLiveId(j.code);
            else if (mio && mio !== j.code) {
              console.log(
                `[BAR] sessione del server (${j.code}) ignorata: questa postazione ha la sua (${mio})`,
              );
            }
            setResumable(!occupato && (!mio || mio === j.code));
            // ── QUANDO IL SERVER E QUESTA POSTAZIONE NON SONO D'ACCORDO ─────────
            //  C'è una MIA videochiamata viva (battito fresco) con un codice
            //  diverso da quello di questa postazione: l'ho aperta altrove. Non
            //  la si adotta di nascosto — sarebbe di nuovo il difetto delle due
            //  postazioni sullo stesso canale — ma neanche si può far finta di
            //  niente: è lo stato in cui il link che copi punta a un canale
            //  morto, e il cliente resta fermo su "si sta per avviare" mentre tu
            //  vedi la consulenza avviata.
            //  Si mostra un pulsante che lo dice, e sei tu a decidere di rientrare.
            setDiversa(
              !occupato && !!mio && mio !== j.code && !!j.inChiamata
                ? { code: j.code as string, chi: (j.presenterName as string) || "" }
                : null,
            );
            // ── LA CHIAMATA NON DEVE MORIRE PER UN RICARICAMENTO ────────────────
            //  Se il server dice che la videochiamata è ANCORA IN CORSO (battito
            //  fresco) ma questa scheda non la sta più mostrando, vuol dire che la
            //  pagina è stata ricaricata: si riprende da sola, senza farti premere
            //  nulla e senza far uscire il cliente. Solo però se la sessione del
            //  server è davvero la NOSTRA: altrimenti si ruberebbe quella altrui.
            /*  ⚠️ Qui vale `inChiamata`, non `callActive`. Da quando il
                battito dice «la postazione è viva» anche a videochiamata NON
                avviata (vedi `pushHeartbeat`), `callActive` è vero pure
                mentre si condividono soltanto contenuti: usarlo qui avrebbe
                fatto partire da sola una videochiamata che nessuno aveva
                avviato. */
            if (j.inChiamata && !call.active && getLiveId() === j.code && presenter?.name)
              void resumeCallSilently(presenter.name);
          } else {
            setResumable(false);
            setDiversa(null);
            if (!getLiveId()) startLive();
          } // nessuna → nuova diretta
      } catch {
          if (!stop && !getLiveId()) startLive();
      }
    };
    void check();
    //  ⚠️ Venti secondi, non cinque: questa è la domanda «c'è una consulenza
    //   da riprendere?», che cambia quando la cambi tu. A cinque secondi erano
    //   720 richieste l'ora per una risposta che resta identica tutto il
    //   giorno (vedi il cartello di SALA_OGNI_MS in shop/call).
    const iv = setInterval(() => void check(), 20_000);
    return () => {
      stop = true;
      clearInterval(iv);
    };
  }, [env, consultant, presenter?.id]);
  // la barra è fissa in BASSO: riserva spazio in fondo alla pagina
  useEffect(() => {
    if (!env || !consultant || typeof document === "undefined") return;
    document.body.style.paddingBottom = "60px";
    return () => {
      document.body.style.paddingBottom = "";
    };
  }, [env, consultant]);

  /** Sta coniando il codice della consulenza per l'anteprima capelli.
   *  ⚠️ QUESTO `useState` STA QUI E NON ACCANTO ALLA SUA FUNZIONE, ed è il
   *   motivo per cui esiste il cartello qui sotto: messo là, veniva chiamato
   *   solo nei giri in cui il componente arrivava in fondo, e la barra moriva
   *   con «Qualcosa si è rotto» nell'istante in cui il presentatore entrava.
   *   L'ho fatto, il cartello lo diceva, ed era la seconda volta su questo
   *   file. La funzione che lo usa può stare dove vuole: è il CONTEGGIO degli
   *   hook che deve essere sempre lo stesso. */
  const [coniando, setConiando] = useState(false);

  // ── TUTTI GLI HOOK STANNO SOPRA QUESTA RIGA ──────────────────────────────
  //  Da qui in giù il componente può uscire prima (return null, oppure il
  //  cancello di accesso). Un hook messo sotto viene chiamato in certi giri e
  //  non in altri: React conta gli hook per posizione, e al primo giro in cui
  //  il conto cambia — cioè NON APPENA IL PRESENTATORE ENTRA — la barra muore
  //  con "Something went wrong". È già successo una volta su questo file.
  //
  //  Il link del presentatore: il codice consulente non sta più nel pacchetto
  //  inviato al browser, lo consegna il server a sessione verificata.
  const presenterBase = usePresenterLink();
  //  Se il presentatore è ricordato qui ma il server non lo conosce, il cookie
  //  non c'è: si torna al cancello per un PIN, una volta sola. È l'unico modo
  //  di riavere una sessione valida, e senza di essa preventivi e registrazioni
  //  non si salvano.
  const sessione = useSessionePresentatore();

  if (!env || !consultant) return null;
  // prima di tutto: selezione presentatore + PIN (se ne esistono di configurati)
  if ((!presenter || sessione === "assente") && !gateDone)
    return <PresenterGate onDone={() => setGateDone(true)} />;

  // apre/chiude il menu presentatori dal logo (ricarica l'elenco a ogni apertura)
  const togglePresMenu = () => {
    setPresMenu((v) => {
      const next = !v;
      if (next) {
        setPinFor(null);
        setPin("");
        fetch("/api/presenter/presenters")
          .then((r) => r.json())
          .then((j) => setPresList((j.presenters as Presenter[]) ?? []))
          .catch(() => {});
      }
      return next;
    });
  };
  // login con PIN → cambio del presentatore attivo
  const doLogin = async () => {
    if (!pinFor || pin.length < 4 || pinBusy) return;
    setPinBusy(true);
    try {
      const j = await fetch("/api/presenter/presenters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login", id: pinFor.id, pin }),
      }).then((r) => r.json());
      if (!j?.ok) {
        toast.error("PIN errato");
        setPin("");
        return;
      }
      setPresenter(j.presenter as Presenter);
      toast.success(`Presentatore: ${(j.presenter as Presenter).name}`);
      setPresMenu(false);
      setPinFor(null);
      setPin("");
    } catch {
      toast.error("Errore di rete");
    } finally {
      setPinBusy(false);
    }
  };
  const switchPresenter = () => {
    clearPresenter();
    setGateDone(false);
    setPresMenu(false);
    setPinFor(null);
    setPin("");
  };
  const origin = window.location.origin;
  // Link del CLIENTE = link della VIDEOCONSULENZA, non del preventivo: finché
  // non avvii, lui vede la schermata "la videoconsulenza si sta per avviare";
  // appena presenti qualcosa, ci arriva da solo seguendoti.
  //  Porta il nome del software (Meetly): è la prima cosa che il cliente legge
  //  nel messaggio, e un indirizzo con un nome si riconosce. Forma leggibile e
  //  dettabile al telefono; /videochiamata/… e `?watch=` restano validi per i
  //  link già mandati, ma non se ne generano più.
  //  Dominio pubblico, non quello da cui è aperta la pagina: è il link che il
  //  cliente riceve su WhatsApp (vedi lib/sito).
  const liveUrl = liveId ? urlStanza(liveId) : "";
  // link presentatore: include il CODICE della sessione → aperto su un altro browser
  // riprende la stessa consulenza (e l'ospite mantiene il suo link).
  const presenterUrl = presenterBase
    ? `${presenterBase}${liveId ? `&session=${encodeURIComponent(liveId)}` : ""}`
    : "";
  // ── LINK SOLO PREVENTIVO ─────────────────────────────────────────────────
  //  Nessuna videochiamata, nessuna richiesta di camera o microfono: si apre
  //  direttamente la pagina del preventivo. Se un preventivo è già stato creato
  //  il link porta con sé il suo numero, così il cliente vede ESATTAMENTE quel
  //  preventivo invece del configuratore vuoto.
  //  Il link è LEGATO A QUESTA CONSULENZA (`sess`): il cliente compila il
  //  preventivo in tempo reale con te, ma senza videochiamata e senza che gli
  //  venga chiesto nulla — né camera, né microfono, né di entrare in una
  //  chiamata. Chiudendo la consulenza il codice cambia, quindi il link
  //  precedente non è più valido: ogni consulenza ha il suo.
  /** Link SOLO PREVENTIVO: ha il suo pulsante dedicato nella barra, sempre
   *  disponibile anche senza videochiamata. */
  //  Il link porta un codice di sessione SUO, registrato sul server e valido
  //  finché non premi "Ricomincia" — non quello della videochiamata, che si
  //  azzera appena la chiamata finisce (ed era il motivo per cui il cliente si
  //  vedeva scritto "non è più attivo" pochi minuti dopo averlo ricevuto).
  //  Serve solo per mostrarlo: quello che si copia si costruisce al clic, con
  //  `linkPreventivo`, perché è lì che la sessione va aperta.
  //  Anche questo lo riceve il cliente: dominio pubblico.
  const quoteUrl = urlPubblico(
    `preventivo?client=1${liveId ? `&sess=${liveId}` : ""}${quoteRef ? `&id=${encodeURIComponent(quoteRef)}` : ""}`,
  );
  /** ── COPIA IL LINK E APRE LA CONSULENZA ─────────────────────────────────
   *  Prima di tutto crea la sessione, se non c'è: senza videochiamata non ne
   *  esisteva nessuna, quindi il link partiva senza codice e il cliente apriva
   *  una pagina che non seguiva nessuno. Ora il codice nasce qui, il consulente
   *  comincia a trasmettere su quel canale, e il server lo registra insieme al
   *  numero del preventivo — così quel link resta legato a questa consulenza. */
  /** ── SOTTO QUALE CODICE VA DEPOSITATA L'ANTEPRIMA ─────────────────────────
   *  Il link del preventivo ha due forme, e l'anteprima si cerca sotto il
   *  codice che sta NELL'INDIRIZZO:
   *   · con un preventivo fatto l'indirizzo porta `id=IDXXXXX` → si deposita
   *     sotto quel numero, con il totale, e la scheda è quella del preventivo;
   *   · senza, porta solo `sess=<codice>` → si deposita sotto la sessione,
   *     senza totale, e la scheda è quella «lo costruiamo insieme».
   *  ⚠️ Il totale vero non lo conosce questa barra: quando c'è un preventivo lo
   *  riscriverà la pagina del preventivo, che ce l'ha in mano. Qui si prepara
   *  comunque qualcosa, perché il link parte adesso e l'anteprima si legge una
   *  volta sola. */
  /** Chi c'è in consulenza adesso: lo scrive il CRM avviando la consulenza. */
  const leggiLeadCorrente = (): { nome?: string; cognome?: string } | null => {
    try {
      const g = localStorage.getItem("hg_lead_corrente");
      return g ? (JSON.parse(g) as { nome?: string; cognome?: string }) : null;
    } catch {
      return null;
    }
  };

  const anteprimaDelLinkPreventivo = async (ref: string) => {
    //  ⚠️ QUANDO IL PREVENTIVO ESISTE, QUI NON SI TOCCA NIENTE.
    //  Questa barra non conosce il totale: depositando sotto il numero del
    //  preventivo scriverebbe la scheda «da costruire» SOPRA quella con la
    //  cifra — cioè cancellerebbe il lavoro fatto, e per giunta proprio nel
    //  momento in cui il consulente sta mandando il link al cliente.
    //  L'immagine del preventivo confermato la scrive la pagina del preventivo,
    //  che il totale ce l'ha in mano.
    if (ref) return;
    const lead = leggiLeadCorrente();
    if (!lead?.nome && !lead?.cognome) return;
    await depositaAnteprimaPreventivo({
      ref: sessionePreventivo(null),
      nome: lead.nome || "",
      cognome: lead.cognome || "",
      //  Nessun totale: è esattamente ciò che fa scegliere la seconda scheda.
      totale: 0,
      base: "",
      quantita: 1,
    });
  };

  const copiaLinkPreventivo = (chiudiMenu = false) => {
    //  Il numero si rilegge ADESSO, non da quello che la barra aveva in mano
    //  quando si è disegnata: fra i due momenti può esserci un preventivo nuovo.
    const ref = getQuoteRef();
    const url = linkPreventivo(ref || null);
    //  L'indirizzo di QUESTA pagina si allinea al link appena copiato: stessa
    //  sessione, stesso preventivo. Da qui in poi un ricaricamento — tuo o di
    //  un secondo schermo — ti riporta esattamente dove sei adesso.
    indirizzoPreventivo(ref || undefined);
    //  Se la consulenza viva sul server è un'altra, il link che stai per mandare
    //  punta a un canale dove non trasmette nessuno: il cliente resterebbe fermo
    //  sulla schermata d'attesa. Meglio dirlo adesso che scoprirlo da lui.
    copyLink(
      url,
      diversa
        ? "Copiato — ma prima premi «Rientra nella consulenza in corso»"
        : ref
          ? `Link del preventivo ${ref} copiato`
          : "Link del preventivo copiato",
    );
    //  ── L'ANTEPRIMA DI QUESTO LINK, SUBITO ────────────────────────────────
    //   Due schede diverse, perché sono due momenti diversi:
    //    · c'è già un preventivo → l'anteprima porta il totale, ed è quella che
    //      il cliente si aspetta quando riapre una cosa decisa insieme;
    //    · non c'è ancora niente → l'anteprima dice che lo si costruisce
    //      insieme. Qui non si conosce nessun totale, e mandarne uno finto
    //      sarebbe peggio che non mandare l'immagine.
    //   La distinzione la fa il numero del preventivo, che è l'unico dato che
    //   sa davvero se esiste. `depositaAnteprimaPreventivo` sceglie da sé la
    //   grafica in base al totale: qui basta non inventarlo.
    void anteprimaDelLinkPreventivo(ref);
    if (chiudiMenu) setCopyMenu(false);
  };
  const copy = (t: string, label: string) => copyLink(t, `${label} copiato`);

  const go = (href: string) => {
    primeSfx();
    sfx.mode();
    if (liveId) setPresenterPage(href);
    setCur(pageFromPath(href));
    /** ── ⚠️ LA PARTE DOPO IL «?» VA PASSATA A PARTE ─────────────────────
     *  `navigate({ to })` tratta tutto come PERCORSO: un indirizzo con la
     *  domanda dentro ci arrivava intero, la pagina si apriva senza i suoi
     *  parametri, e da lì l'anteprima capelli non sapeva più di essere dentro
     *  una consulenza — quindi niente barra in fondo. Finché i quattro
     *  pulsanti erano percorsi secchi il difetto non si vedeva; è comparso
     *  col primo indirizzo che porta qualcosa con sé. */
    const [percorso, domanda] = href.split("?");
    const ricerca = domanda
      ? Object.fromEntries(new URLSearchParams(domanda).entries())
      : undefined;
    navigate({ to: percorso as any, ...(ricerca ? { search: ricerca as never } : {}) });
  };
  /** ── ⚠️ LA PROVA CAPELLI DENTRO LA CONSULENZA ───────────────────────────
   *  Il cliente non ha un codice, e chiedergli di scriverne uno mentre siete
   *  in videochiamata è ridicolo. La scorciatoia facile — «se c'è il parametro
   *  giusto lascia passare» — la può scrivere chiunque nella barra degli
   *  indirizzi, e da lì la prova capelli è gratis per tutta internet a dieci
   *  centesimi a immagine pagati da noi.
   *  Quindi si conia un codice VERO per questa consulenza, una volta sola, e
   *  lo si mette nell'indirizzo: il cliente lo segue senza accorgersene, e la
   *  spesa si vede accanto agli altri codici.
   *  ⚠️ Se il codice non arriva si va lo stesso: il cliente si troverà davanti
   *   la richiesta del codice, che è brutto ma è meglio di un pulsante che non
   *   fa niente e lascia il relatore fermo davanti a una persona che aspetta. */
  const apriCapelli = async () => {
    setConiando(true);
    try {
      const j = await fetch("/api/presenter/prova-codice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        //  ⚠️ Il codice è del CONSULENTE, non della singola consulenza: si
        //   conia una volta e resta il suo. Il codice della chiamata viaggia
        //   lo stesso, ma serve solo a legare l'anteprima a QUELLA consulenza
        //   nell'indirizzo.
        body: JSON.stringify({ live: getLiveId() || "", consulente: presenter?.name || presenter?.id || "" }),
      }).then((r) => r.json()).catch(() => null);
      /** ── ⚠️ NELL'INDIRIZZO CI VA IL CODICE DELLA CONSULENZA ────────────
       *  Senza, tutte le anteprime capelli di tutte le consulenze hanno lo
       *  stesso indirizzo: non si sa più quale sia di chi, il cliente che
       *  riapre il link ieri finisce nella prova di oggi, e la barra del
       *  presentatore non ha modo di sapere che è ancora dentro QUELLA
       *  chiamata. `meet` è il filo che tiene insieme le due cose. */
      const live = getLiveId();
      const pezzi = [
        ...(live ? [`meet=${encodeURIComponent(live)}`] : []),
        ...(j?.codice ? [`c=${encodeURIComponent(j.codice)}`] : []),
      ];
      go(pezzi.length ? `/prova-capelli?${pezzi.join("&")}` : "/prova-capelli");
    } finally {
      setConiando(false);
    }
  };

  // ── NUOVO PREVENTIVO ───────────────────────────────────────────────────────
  //  Riporta al configuratore vuoto SENZA ricaricare la pagina: un ricaricamento
  //  in videochiamata interromperebbe la diretta. Il segnale viaggia in due modi
  //  perché la pagina del preventivo può non essere ancora montata: un evento
  //  per chi è già lì, un flag per chi ci sta arrivando adesso.
  /*  ── PER CHI È QUESTO PREVENTIVO NUOVO ─────────────────────────────────
      Richiesta del committente: «quando clicco nuovo preventivo posso
      selezionare se pubblico o di uno degli utenti che è dentro. Questo solo
      se è multi persona, oppure se è singolo rimane come prima».
      Con una persona sola il menu non cambia di una riga: si preme «Nuovo
      preventivo» e si riparte da zero, come sempre. */
  const nuovoPreventivo = (chi?: { gettone: string; nome: string }) => {
    setQuoteMenu(false);
    /*  La scelta si scrive nella regia PRIMA di svuotare il configuratore, e
        viaggia anche con l'evento: la pagina la applica subito, senza
        aspettare che rilegga la regia (vedi `apertoSubito` in preventivo).
        ⚠️ La penna nasce «insieme»: un preventivo che apri TU per una
         persona lo stai per compilare tu, ma resta il suo — e lui deve
         poterci mettere le mani senza chiedere. Dalla plancia si cambia. */
    /*  ⚠️ NON SI ACCENDE PER LUI. Richiesta del committente: «fai che di
        default l'opzione il suo preventivo è spenta». Qui si apre il suo
        preventivo SUL TUO schermo e basta: lo prepari, e quando è pronto lo
        accendi dalla plancia. Prima questo pulsante glielo accendeva subito
        e il cliente vedeva un configuratore vuoto comparire dal nulla.
        ⚠️ E ADESSO VALE SEMPRE, non solo in più di uno: «quando clicco nuovo
         preventivo, quel preventivo non è di nessuno degli utenti, ma è di
         tutti». Senza persona, `aperto: ""` vuol dire esattamente questo —
         il preventivo della consulenza, che chi ti segue vede comporsi in
         diretta e non può toccare (vedi `cosaVede`). Prima la riga girava
         solo in gruppo, e con un cliente solo restava aperto quello di
         prima. */
    void cambiaRegia(liveId, chi ? { aperto: chi.gettone } : { aperto: "" });
    try { localStorage.setItem("hg_new_quote_chi", chi ? chi.gettone : ""); } catch { /* */ }
    // ── OGNI PREVENTIVO NUOVO APRE UNA SESSIONE SUA ─────────────────────────
    //  Anche senza videochiamata: è il codice che lega il link mandato al
    //  cliente a QUESTA composizione. Senza, il link non aveva nulla a cui
    //  agganciarsi e il cliente non vedeva il preventivo formarsi.
    sessionePreventivo();
    indirizzoPreventivo(null); // consulenza sì, preventivo no: si riparte in bianco
    try {
      sessionStorage.setItem("hg_new_quote", "1");
      setQuoteRef(null); // il link non punta più al cliente di prima
      // In anteprima dispositivo la pagina del preventivo vive dentro una
      // cornice separata: un evento non la raggiunge, una scrittura qui sì.
      localStorage.setItem("hg_new_quote_at", String(Date.now()));
    } catch {
      /* */
    }
    if (cur !== "preventivo") go("/preventivo");
    //  "" = il preventivo della consulenza, un gettone = quello di quella
    //  persona. Si dice SEMPRE per chi è, anche con un cliente solo: adesso
    //  anche lui ha una stanza sua, e «nuovo» deve poter aprire l'una o
    //  l'altra senza ambiguità.
    window.dispatchEvent(new CustomEvent("hg:new-quote", { detail: { chi: chi?.gettone ?? "" } }));
  };
  const NavBtn = ({
    href,
    active,
    icon: Icon,
    label,
  }: {
    href: string;
    active: boolean;
    icon: typeof FileText;
    label: string;
  }) => (
    <button
      type="button"
      onClick={() => go(href)}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${active ? "bg-brand text-white" : "text-white/70 hover:bg-white/10"}`}
    >
      <Icon className="h-4 w-4" /> <span className="hidden xs:inline sm:inline">{label}</span>
    </button>
  );

  return (
    <>
      {/*  Come ti vede il cliente mentre la camera è accesa: sta in basso a
          sinistra, dalla parte opposta dei comandi, e si spegne da lì. */}
      <AnteprimaCameraLink />
      <div
        data-hg-noptr
        style={{ right: "var(--tp-right, 0px)" }}
        className="fixed bottom-0 left-0 z-[60] flex flex-nowrap items-center gap-2.5 overflow-x-auto border-t border-white/10 bg-[#050f24]/97 px-3 py-2 backdrop-blur print:hidden"
      >
        {/* Impostazioni: all'estremità, dove stanno per convenzione i comandi di
          sistema — lontano dai comandi della consulenza, che si usano di continuo. */}
        <button
          type="button"
          onClick={() => {
            setHubTab(undefined);
            setHub(true);
          }}
          title="Impostazioni"
          className="shrink-0 rounded-lg border border-white/12 bg-white/5 p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <Settings className="h-4 w-4" />
        </button>

        {/* ── CHI SEI, E DOVE PUOI ANDARE ───────────────────────────────────
          Il nome del presentatore era nascosto dentro il suggerimento del logo:
          per sapere con quale account stavi lavorando bisognava passarci sopra
          col mouse. Ed è l'informazione che finisce annunciata al cliente.
          Il logo è anche il comando che apre il menu: da lì si va al CRM o si
          cambia consulente — le due uscite da questa schermata. Ha bordo e
          fondo suoi, altrimenti sembrava solo un marchio stampato sulla barra. */}
        <button
          type="button"
          onClick={togglePresMenu}
          title="Menu: apri il CRM oppure cambia consulente"
          aria-haspopup="menu"
          aria-expanded={presMenu}
          className={`mr-1 flex min-h-[40px] shrink-0 items-center gap-2 rounded-xl border px-2 py-1 transition ${
            presMenu
              ? "border-white/25 bg-white/10"
              : "border-white/12 bg-white/[0.04] hover:bg-white/10"
          }`}
        >
          <BrandLogo className="h-6 w-auto" />
          {presenter?.name && (
            <span className="hidden max-w-[9rem] truncate text-[12px] font-medium text-white/70 lg:inline">
              {presenter.name}
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-white/50 transition-transform ${presMenu ? "rotate-180" : ""}`}
          />
        </button>

        {/* ── LA CHIAMATA IN CORSO ──────────────────────────────────────────
          Il link da mandare e il pulsante per chiudere riguardano la CHIAMATA,
          non la schermata che stai mostrando: stavano in fondo a destra, in
          mezzo alle azioni del preventivo, e per chiudere si attraversava tutta
          la barra. Ora stanno qui, accanto al logo, e compaiono solo quando una
          consulenza è davvero aperta. */}
        {(call.active || resumable) && (
          <div className="flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <span className="ml-1 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-300/80">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,.9)]" />
              {call.active ? "In corso" : "Aperta"}
            </span>
            {/* ── IL CODICE DI QUESTA CONSULENZA ──────────────────────────────
              Come nelle riunioni: ogni consulenza ha il suo, si legge e si
              detta al telefono. Un clic lo copia insieme all'indirizzo. */}
            {liveId && (
              <button
                type="button"
                onClick={() => {
                  copyLink(liveUrl, "Link della consulenza copiato");
                  //  ⚠️ L'anteprima di QUESTO link si prepara adesso: è il momento
                  //  in cui il consulente sta per mandarlo, e il cliente lo apre
                  //  pochi secondi dopo. Prepararla altrove — nel CRM, come si
                  //  faceva — voleva dire prepararla in un posto che, mandando il
                  //  link da qui, nessuno attraversa. Non aspetta e non parla: il
                  //  gesto chiesto era copiare, e quello è già riuscito.
                  void depositaAnteprimaStanza(liveId || "");
                }}
                title={`Codice di questa consulenza: ${liveId} — clic per copiare l'indirizzo completo`}
                className="hidden items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 font-mono text-[11px] tracking-tight text-white/70 transition hover:bg-white/10 hover:text-white md:inline-flex"
              >
                {liveId}
              </button>
            )}
            <button
              type="button"
              onClick={() => setCopyMenu((v) => !v)}
              title="Copia il link della videoconsulenza da mandare al cliente"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              <Copy className="h-3.5 w-3.5" />{" "}
              <span className="hidden lg:inline">Link chiamata</span>
              <ChevronDown
                className={`h-3 w-3 opacity-60 transition-transform ${copyMenu ? "rotate-180" : ""}`}
              />
            </button>
            {call.active && (
              <button
                type="button"
                onClick={() => endCall()}
                aria-label="Chiudi la consulenza"
                title="Chiudi la consulenza: il link del cliente smette di funzionare"
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500 text-white shadow-sm shadow-red-500/30 transition hover:brightness-110"
              >
                <PhoneOff className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {/* ── RICOMINCIA ────────────────────────────────────────────────────
          Genera un codice sessione nuovo e dimentica il preventivo corrente.
          Chi aveva i link precedenti non entra più: è quello che serve quando
          si passa da un cliente all'altro senza chiudere e riaprire tutto.
          ⚠️ È l'UNICO punto in cui il codice cambia di propria iniziativa.
          "Avvia consulenza" riusa quello corrente: prima ne generava uno nuovo,
          e così il link appena mandato al cliente moriva nell'istante in cui
          premevi Avvia — il cliente bussava a una porta che non esisteva più. */}
        <button
          type="button"
          onClick={() => {
            if (
              !window.confirm(
                "Vuoi iniziare una consulenza nuova?\n\nI link mandati fino a ora smetteranno di funzionare.",
              )
            )
              return;
            setQuoteRef(null);
            const vecchio = getLiveId();
            const nuovo = newLiveId();
            indirizzoPreventivo(null);
            //  `wipe` chiude anche i link dei singoli preventivi: ognuno ha la sua
            //  sessione, e il solo codice nuovo li avrebbe lasciati tutti aperti.
            //  `keepalive` perché fra un istante la pagina si ricarica: senza,
            //  il browser potrebbe annullare queste richieste a metà strada e la
            //  sessione nuova non verrebbe mai registrata.
            fetch("/api/presenter/quote-session", {
              method: "POST",
              keepalive: true,
              headers: { "Content-Type": "application/json" },
              //  `precedente` dice QUALI link spegnere: quelli mandati con il
              //  codice di prima, cioè i miei. Senza, si spegnevano quelli di
              //  tutti i consulenti.
              body: JSON.stringify({ code: nuovo, wipe: true, precedente: vecchio || "" }),
            }).catch(() => {});
            // ── LA SESSIONE SUL SERVER VA ALLINEATA SUBITO ────────────────────
            //  Il cliente che apre un link chiede al server quale sia la sessione
            //  viva e si sposta su QUELLA. Se qui restava annunciato il codice
            //  vecchio, il cliente col link NUOVO veniva dirottato su un canale
            //  dove il presentatore non c'era più: bussava e non lo sentiva
            //  nessuno, per quante volte ricaricasse.
            //  In chiamata: si riparte col codice nuovo, che riscrive la sessione.
            //  Fuori dalla chiamata: la sessione vecchia si chiude, così nessuno
            //  viene più dirottato.
            //  In chiamata NON basta requestStart: esce subito perché la chiamata
            //  è già attiva, e il server continuerebbe ad annunciare il codice
            //  vecchio. Qui la sessione va riscritta esplicitamente.
            //  Prima si chiude QUELLA DI PRIMA, poi semmai si riapre la nuova:
            //  in quest'ordine la riga storica resta col codice giusto.
            //  ⚠️ Si dice sempre QUALE consulenza si chiude. Senza codice si
            //   spegneva la riga condivisa — cioè anche la consulenza del
            //   collega che in quel momento stava trasmettendo.
            if (vecchio)
              fetch("/api/presenter/session", {
                method: "POST",
                keepalive: true,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ live: false, code: vecchio }),
              }).catch(() => {});
            if (call.active) republishSession();
            window.dispatchEvent(new CustomEvent("hg:new-quote"));
            eliminaBozza(); // consulenza nuova = nessun lavoro da riprendere
            toast.success("Consulenza nuova: i link precedenti non sono più validi");
            // ── LA PAGINA SI RIFÀ DA SOLA ───────────────────────────────────
            //  Una consulenza nuova è una pagina nuova: restavano a schermo il
            //  preventivo di prima, le schede aperte e le scelte fatte, e per
            //  ripulire bisognava ricaricare a mano. Qui si ricarica da sé, sullo
            //  stesso indirizzo ma pulito dai parametri.
            //  Il mezzo secondo di attesa serve a far uscire i messaggi appena
            //  inviati sul canale e a far leggere l'avviso.
            window.setTimeout(() => {
              try {
                window.location.replace(window.location.pathname);
              } catch {
                window.location.reload();
              }
            }, 550);
          }}
          title="Ricomincia da capo: nuovo codice sessione, nuovo preventivo, i link precedenti scadono"
          className="shrink-0 rounded-lg border border-white/12 bg-white/5 p-2 text-white/55 transition hover:bg-white/10 hover:text-white"
        >
          <RotateCcw className="h-4 w-4" />
        </button>

        {/* ── COSA STAI MOSTRANDO ───────────────────────────────────────────
          Quattro schermate, una sola attiva: stesso selettore unico della barra
          in alto, così i due comandi si leggono con la stessa grammatica. */}
        <div className="flex shrink-0 items-center gap-0.5 rounded-xl border border-white/10 bg-white/[0.03] p-1">
          <NavBtn href="/slide" active={cur === "slide"} icon={Presentation} label="Slide" />
          {/* Preventivo apre la scelta fra partire da zero e riprenderne uno */}
          {/* ── IL CRM NON STA PIÙ QUI ────────────────────────────────────────
            Questo gruppo risponde a UNA domanda sola — cosa sto mostrando al
            cliente — e il CRM non è una schermata da mostrare: è un altro
            posto dove andare. Ora sta nel menu del logo, insieme al cambio di
            consulente, che è l'altra cosa che ti porta fuori da qui. */}
          <button
            type="button"
            onClick={() => {
              setBozzaViva(bozzaDisponibile(getLiveId()));
              setQuoteMenu((v) => !v);
            }}
            aria-haspopup="menu"
            aria-expanded={quoteMenu}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${cur === "preventivo" ? "bg-brand text-white shadow-sm shadow-brand/30" : "text-white/70 hover:bg-white/10"}`}
          >
            <FileText className="h-4 w-4" />{" "}
            <span className="hidden xs:inline sm:inline">Preventivo</span>
            <ChevronDown
              className={`h-3 w-3 opacity-70 transition-transform ${quoteMenu ? "rotate-180" : ""}`}
            />
          </button>
          <NavBtn href="/presenta" active={cur === "presenta"} icon={Images} label="Media" />
          <NavBtn href="/web" active={cur === "web"} icon={Globe} label="Link" />
          {/*  ⚠️ Non è un `NavBtn` come gli altri perché prima di andarci c'è
              da coniare il codice della consulenza: un `href` secco porterebbe
              il cliente su una pagina che gli chiede un codice che non ha. */}
          <button
            type="button"
            onClick={() => void apriCapelli()}
            disabled={coniando}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${cur === "capelli" ? "bg-brand text-white shadow-sm shadow-brand/30" : "text-white/70 hover:bg-white/10"} disabled:opacity-50`}
          >
            <Scissors className="h-4 w-4" />
            {/*  ⚠️ «Anteprima capelli» e non «Capelli»: questa barra la legge
                chi conduce davanti a un cliente, e le altre voci dicono cosa
                si mostra — Slide, Preventivo, Media, Link. Una parola sola e
                generica accanto a quelle sembra un pulsante di prova. */}
            <span className="hidden xs:inline sm:inline">Anteprima capelli</span>
          </button>
        </div>

        {/* ── COME LO VEDE LUI ──────────────────────────────────────────────
          Formato e ingrandimento sono due facce della stessa domanda — su che
          schermo sto guardando — e stavano in due gruppi identici, uno accanto
          all'altro, senza dire a cosa servissero. Ora sono un blocco solo con
          il suo nome sopra, e la misura reale del cliente è il primo pulsante:
          è quella che si vuole quasi sempre. */}
        {/*  ⚠️ Da `sm` e non da `md`: su una finestra affiancata a un'altra —
            cioè come si lavora davvero durante una consulenza — i comandi
            dell'anteprima sparivano del tutto. */}
        <div className="hidden shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-white/[0.03] px-1.5 py-1 sm:flex">
          <span className="mr-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/30">
            Anteprima
          </span>
          {gvp ? (
            <button
              type="button"
              onClick={() => {
                setMode("auto");
                toast.success(`Anteprima adattata al cliente: ${gvp.w}×${gvp.h}`);
              }}
              title={`Usa le misure reali dello schermo del cliente (${gvp.w}×${gvp.h})`}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2 py-1 text-[11px] font-medium tabular-nums transition ${
                vm.mode === "auto"
                  ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-100"
                  : "border-emerald-400/25 bg-emerald-500/[0.08] text-emerald-200/80 hover:bg-emerald-500/20"
              }`}
            >
              <MonitorSmartphone className="h-3.5 w-3.5" /> {gvp.w}×{gvp.h}
              {vm.mode === "auto" ? " ✓" : ""}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                sfx.mode();
                setMode("auto");
              }}
              title="Nessuno collegato: si userà la misura del cliente appena entra"
              className={`rounded-lg p-1.5 transition ${vm.mode === "auto" ? "bg-brand text-white" : "text-white/60 hover:bg-white/10"}`}
            >
              <MonitorSmartphone className="h-4 w-4" />
            </button>
          )}
          <span className="mx-0.5 h-4 w-px bg-white/10" />
          {(
            [
              ["mobile", Smartphone, "Telefono"],
              ["tablet", Tablet, "Tablet"],
              ["desktop", Monitor, "Computer"],
              //  ⚠️ Tutte e tre insieme: gli errori di impaginazione stanno nel
              //   confronto, non nel singolo dispositivo guardato da solo.
              ["tutte", LayoutGrid, "Tutte le schermate"],
            ] as const
          ).map(([m, Icon, t]) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                sfx.mode();
                setMode(m);
              }}
              title={t}
              className={`rounded-lg p-1.5 transition ${vm.mode === m ? "bg-brand text-white" : "text-white/60 hover:bg-white/10"}`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
          {vm.mode !== "desktop" && (
            <>
              <span className="mx-0.5 h-4 w-px bg-white/10" />
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setZoom(vm.zoom - 0.1)}
                  title="Rimpicciolisci"
                  className="rounded-l-lg px-1.5 py-1 text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-9 text-center text-[11px] font-medium tabular-nums text-white/75">
                  {Math.round(vm.zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom(vm.zoom + 0.1)}
                  title="Ingrandisci"
                  className="rounded-r-lg px-1.5 py-1 text-white/60 hover:bg-white/10 hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── AZIONI ────────────────────────────────────────────────────────
          Una gerarchia sola: a destra di tutto sta l'azione principale — aprire
          o chiudere la consulenza — e prima di lei le cose che si copiano. Le
          impostazioni tornano a essere un'icona: si aprono una volta al giorno,
          non meritano lo stesso spazio di "Videochiamata". */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {/* ── LINK DEL PREVENTIVO, SEMPRE A PORTATA ──────────────────────────
            Prima stava dentro il menu "Copia link", che compare solo a
            videochiamata avviata: per mandare un preventivo su WhatsApp
            bisognava aprire una chiamata che non serviva a nessuno. Ora è un
            pulsante suo, sempre disponibile, che copia e basta. */}
          {/* Fuori dalla consulenza è il link che serve più spesso, quindi sta in
            barra. Durante una chiamata i link diventano due e vanno letti
            insieme: lì il posto giusto è il menu, accanto agli altri. */}
          {/* ── ⚠️ IL LINK DEI MEDIA STA DOVE SI CERCANO I LINK ─────────────
            Segnalazione del committente: «non trovo dove copiare il link».
            C'era, ma solo dentro la pagina Media, sotto l'anteprima: chi cerca
            un link da mandare guarda QUI, nella barra, dove c'è già quello del
            preventivo. Due posti sarebbero stati meglio di uno, e uno solo —
            quello sbagliato — è come non averlo.
            Compare sulla pagina Media e basta: sulle slide o sul preventivo
            sarebbe un tasto che manda a vedere una libreria che non si sta
            guardando. */}
          {page === "presenta" && !(call.active || resumable) && (
            <button
              type="button"
              onClick={() =>
                copyLink(
                  linkMedia(),
                  "Link dei media copiato — il cliente vedrà quello che mostri tu",
                )
              }
              title="Copia il link che mostra al cliente, in diretta, i media che stai mostrando. Niente camera, niente microfono, nessuna stanza in cui entrare."
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-2.5 py-2 text-[12px] font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <Images className="h-3.5 w-3.5 text-sky-300" />{" "}
              <span className="hidden lg:inline">Link media</span>
            </button>
          )}
          {/* ── ⚠️ LA CAMERA ANCHE SENZA VIDEOCHIAMATA ─────────────────────
            Richiesta del committente: «fai che posso attivare e disattivare
            anche la mia camera anche su questi link». Il cliente che ha aperto
            il link — del preventivo o dei media — vede la faccia del consulente
            in un angolo, e continua a non dover entrare da nessuna parte: a lui
            non viene chiesta né camera né microfono (shop/camera-link).
            Compare solo FUORI dalla consulenza vera: dentro la videochiamata la
            camera ce l'ha già la chiamata, e due comandi per la stessa camera
            vogliono dire uno dei due che dice il falso. */}
          {!(call.active || resumable) && (
            <button
              type="button"
              onClick={async () => {
                if (cam.accesa) {
                  spegniCameraLink();
                  toast("Camera spenta: il cliente non ti vede più");
                  return;
                }
                const ok = await accendiCameraLink(sessioneMedia());
                if (ok)
                  toast.success(
                    "Camera accesa: chi ha aperto il tuo link ti vede in un angolo",
                  );
                else
                  toast.error(
                    "Il browser non mi dà la camera: controlla il permesso e riprova",
                  );
              }}
              disabled={cam.occupata}
              title={
                cam.accesa
                  ? "Spegni la camera: chi ha il link smette di vederti"
                  : "Accendi la camera: chi ha aperto il tuo link ti vede in un angolo, senza entrare in nessuna stanza"
              }
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[12px] font-medium transition disabled:opacity-60 ${
                cam.accesa
                  ? "border-rose-400/40 bg-rose-500/15 text-rose-100 hover:bg-rose-500/25"
                  : "border-white/12 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              {cam.accesa ? (
                <VideoOff className="h-3.5 w-3.5" />
              ) : (
                <Video className="h-3.5 w-3.5 text-indigo-300" />
              )}{" "}
              <span className="hidden lg:inline">
                {cam.accesa ? "Spegni camera" : "La mia camera"}
              </span>
            </button>
          )}
          {!(call.active || resumable) && (
            <button
              type="button"
              onClick={() => copiaLinkPreventivo()}
              title="Copia il link del preventivo da mandare al cliente — non serve la videochiamata"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-2.5 py-2 text-[12px] font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              <FileText className="h-3.5 w-3.5 text-emerald-300" />{" "}
              <span className="hidden lg:inline">Link preventivo</span>
            </button>
          )}
          {/* il link ospite esiste SOLO durante una chiamata avviata (scade alla chiusura) */}
          {!call.active && resumable ? (
            // sessione ancora aperta sul server (riaperta da un altro browser): RIPRENDI
            // senza generare un nuovo codice → il link dell'ospite resta lo stesso.
            <>
              <button
                type="button"
                onClick={() => {
                  indirizzoPreventivo(getQuoteRef() || undefined);
                  requestStart();
                }}
                title="Rientra nella consulenza già aperta: il link del cliente resta lo stesso"
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-[#052e16] shadow-lg shadow-emerald-500/25 transition hover:brightness-110"
              >
                <PhoneCall className="h-4 w-4" /> Rientra
              </button>
              {/* nuova sessione: rigenera il codice (il link precedente scade) e avvia */}
              <button
                type="button"
                onClick={() => {
                  newLiveId();
                  indirizzoPreventivo(null);
                  requestStart();
                }}
                title="Nuova consulenza con un link nuovo: chi ha il precedente non entrerà più"
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-2.5 py-2 text-[12px] font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />{" "}
                <span className="hidden lg:inline">Nuovo cliente</span>
              </button>
            </>
          ) : !call.active && diversa ? (
            <button
              type="button"
              onClick={() => {
                adoptLiveId(diversa.code);
                indirizzoPreventivo(getQuoteRef() || undefined);
                requestStart();
              }}
              title={`Sul server risulta una videoconsulenza in corso${diversa.chi ? ` di ${diversa.chi}` : ""} con un codice diverso da quello di questa postazione. Rientrando userai il link che il cliente ha già.`}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-[#3b2400] shadow-lg shadow-amber-500/25 transition hover:brightness-110"
            >
              <PhoneCall className="h-4 w-4" /> Rientra nella consulenza in corso
            </button>
          ) : !call.active ? (
            /*  ── ⚠️ QUESTO PULSANTE ORA CHIEDE COSA STAI PER FARE ────────────
                Prima avviava la consulenza e basta. Adesso apre una scelta,
                perché da qui partono DUE cose diverse: la consulenza a due e
                un webinar in una sala.
                ⚠️ IL RAMO «CONSULENZA» È IDENTICO A PRIMA, riga per riga: le
                 stesse tre istruzioni, nello stesso ordine. Non è pigrizia, è
                 la garanzia che la cosa che fa i soldi non sia cambiata di un
                 millimetro per far posto a quella nuova.
                ⚠️ E GLI ALTRI TRE PULSANTI QUI SOPRA — «Rientra», «Nuovo
                 cliente», «Rientra nella consulenza in corso» — NON sono stati
                 toccati: rientrare in una consulenza già aperta non è un
                 momento in cui si sceglie fra due mestieri, è un momento in cui
                 il cliente sta già aspettando. */
            <button
              type="button"
              onClick={() => setSceltaTrasmissione(true)}
              title="Scegli se aprire una consulenza o condurre un webinar"
              className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:brightness-110"
            >
              <PhoneCall className="h-4 w-4" /> Avvia trasmissione
            </button>
          ) : // la chiusura vive accanto al logo, insieme al link della chiamata
          null}
        </div>
      </div>

      {/* ── LA SCELTA E LA CONSOLE DELLA SALA ────────────────────────────
        Stanno QUI, fuori dalla barra, per la stessa ragione dei menu qui
        sotto: la barra ha `backdrop-blur`, e un elemento con quella proprietà
        diventa il riferimento di tutto ciò che sta dentro — un `fixed`
        annidato verrebbe ritagliato ai suoi due centimetri di altezza invece
        di galleggiare sulla pagina.
        Il codice di tutti e due vive in `webinar/DaMeetly`: da questo file
        passa solo il permesso di comparire. */}
      <PopupTrasmissione
        aperto={sceltaTrasmissione}
        chiudi={() => setSceltaTrasmissione(false)}
        suConsulenza={() => {
          //  ⚠️ LE STESSE TRE ISTRUZIONI DI PRIMA, nello stesso ordine. La
          //   sessione esiste PRIMA che la chiamata parta: il link del cliente
          //   è già valido nell'istante in cui premi.
          if (!getLiveId()) startLive();
          indirizzoPreventivo(getQuoteRef() || undefined);
          requestStart();
        }}
      />
      {/*  Il nome serve al teleprompter per riempire «{PRESENTATORE}»: un
          copione letto ad alta voce con dentro il segnaposto è la figuraccia
          classica. */}
      <ConsoleSala
        nomePresentatore={call.presenterName || "Hair Genius Labs"}
        //  ⚠️ La navigazione la passa questa barra, che il router ce l'ha gia'.
        //   Dentro la console un hook del router che alza senza contesto non
        //   sbianca il webinar: sbianca l'interfaccia delle consulenze.
        naviga={(percorso) => { void navigate({ to: percorso as never }); }}
      />

      {/* popup FUORI dalla barra: la barra ha backdrop-blur → conterrebbe/ritaglierebbe i fixed */}
      {copyMenu && (
        <>
          <div className="fixed inset-0 z-[199]" onClick={() => setCopyMenu(false)} />
          <div
            data-hg-noptr
            className="fixed bottom-14 left-3 z-[200] w-[290px] overflow-hidden rounded-2xl border border-white/15 bg-[#0b1730] shadow-2xl ring-1 ring-black/50"
          >
            {/* ── I TRE LINK ────────────────────────────────────────────────
              Erano tre righe uguali con una didascalia in gergo ("apre la
              diretta (guest)"): per sceglierne uno bisognava già sapere come
              funziona. Ora ognuno dice A CHI si manda e COSA succede a chi lo
              apre, con un'icona che li distingue prima ancora di leggere. */}
            <div className="border-b border-white/10 px-3.5 py-2.5">
              <p className="text-[13px] font-semibold text-white">Condividi la consulenza</p>
              <p className="mt-0.5 text-[11px] leading-snug text-white/45">
                Scegli cosa deve aprirsi a chi riceve il link.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                copyLink(
                  liveUrl,
                  diversa
                    ? "Copiato — ma prima premi «Rientra nella consulenza in corso»"
                    : "Link per il cliente copiato",
                );
                void depositaAnteprimaStanza(liveId || "");
                setCopyMenu(false);
              }}
              className="group flex w-full items-start gap-2.5 px-3.5 py-3 text-left transition hover:bg-white/[0.06]"
            >
              <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-brand/35 bg-brand/15 text-brand">
                <Video className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-white">Per il cliente</span>
                <span className="block text-[11px] leading-snug text-white/45">
                  Entra in videochiamata con te. Vale solo per questa consulenza.
                </span>
              </span>
              <Copy className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-white/25 transition group-hover:text-white/70" />
            </button>
            <button
              type="button"
              onClick={() => copiaLinkPreventivo(true)}
              className="group flex w-full items-start gap-2.5 border-t border-white/[0.07] px-3.5 py-3 text-left transition hover:bg-white/[0.06]"
            >
              <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-400/35 bg-emerald-500/15 text-emerald-300">
                <FileText className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-white">
                  Solo il preventivo
                </span>
                <span className="block text-[11px] leading-snug text-white/45">
                  {quoteRef
                    ? `Apre il preventivo ${quoteRef}. Nessuna camera, nessun microfono.`
                    : "Apre la pagina del preventivo. Nessuna camera, nessun microfono."}
                </span>
              </span>
              <Copy className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-white/25 transition group-hover:text-white/70" />
            </button>
            {/* ── ⚠️ E I MEDIA, CHE SONO L'ALTRA METÀ DELLA CONSULENZA ────
                Richiesta del committente. Accanto al preventivo perché sono la
                stessa cosa vista da due lati: due modi di far vedere qualcosa a
                chi non vuole — o non può — entrare in videochiamata. */}
            <button
              type="button"
              onClick={() => {
                copyLink(
                  linkMedia(),
                  "Link dei media copiato — il cliente vedrà quello che mostri tu",
                );
                setCopyMenu(false);
              }}
              className="group flex w-full items-start gap-2.5 border-t border-white/[0.07] px-3.5 py-3 text-left transition hover:bg-white/[0.06]"
            >
              <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-sky-400/35 bg-sky-500/15 text-sky-300">
                <Images className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-white">Solo i media</span>
                <span className="block text-[11px] leading-snug text-white/45">
                  Vede le foto e i video che mostri tu, con il tuo zoom. Il carosello lo scorri tu.
                </span>
              </span>
              <Copy className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-white/25 transition group-hover:text-white/70" />
            </button>
            <button
              type="button"
              onClick={() => {
                copy(presenterUrl, "Link per un collega");
                setCopyMenu(false);
              }}
              className="group flex w-full items-start gap-2.5 border-t border-white/[0.07] px-3.5 py-3 text-left transition hover:bg-white/[0.06]"
            >
              <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/[0.07] text-white/70">
                <Users className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-white">Per un collega</span>
                <span className="block text-[11px] leading-snug text-white/45">
                  Conduce la stessa consulenza da un altro computer.
                </span>
              </span>
              <Copy className="mt-1 h-3.5 w-3.5 flex-shrink-0 text-white/25 transition group-hover:text-white/70" />
            </button>
          </div>
        </>
      )}
      {/* menu PREVENTIVO: nuovo oppure ripresa di uno già creato */}
      {quoteMenu && (
        <>
          <div className="fixed inset-0 z-[199]" onClick={() => setQuoteMenu(false)} />
          <div
            data-hg-noptr
            className="fixed bottom-14 left-3 z-[200] w-64 overflow-hidden rounded-xl border border-white/25 bg-[#17294a] shadow-2xl ring-1 ring-black/40"
          >
            <div className="border-b border-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">
              Preventivo
            </div>
            <button
              type="button"
              onClick={() => nuovoPreventivo()}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-white hover:bg-brand/25"
            >
              <FilePlus2 className="h-4 w-4 text-brand" />
              <span>
                <span className="font-semibold">Nuovo preventivo della consulenza</span>
                {/*  Non è di nessuno dei collegati: è quello che costruisci tu,
                     e chi è su «Segue me» lo vede comporsi mentre lo spieghi. */}
                <span className="block text-[10px] text-white/55">
                  configuratore vuoto: lo vedono in diretta quelli che ti seguono, solo da guardare
                </span>
              </span>
            </button>
            {/* ── …OPPURE DI UNA DELLE PERSONE CHE SONO DENTRO ──────────────
                Scegliere un nome apre il suo preventivo (lo vede solo lui) e
                mette la penna «insieme»: lo cominci tu, può toccarlo anche lui.
                ⚠️ Compariva solo in più di uno, e non ha più senso: da quando
                 anche il cliente solo ha una stanza sua, «nuovo per lui» è
                 l'altra metà del mestiere — «nuovo della consulenza» lo
                 costruisci tu e lo guardano, «nuovo per lui» lo compila lui. */}
            {attesiQui.length >= 1 &&
              attesiQui.map((p) => (
                <button
                  key={p.gettone}
                  type="button"
                  onClick={() => nuovoPreventivo(p)}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-white hover:bg-brand/25"
                >
                  <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-brand/25 text-[9px] font-bold text-brand">
                    {p.nome.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">Nuovo per {p.nome}</span>
                    <span className="block text-[10px] text-white/55">
                      lo prepari tu: lui lo vede quando lo accendi
                    </span>
                  </span>
                </button>
              ))}
            {/* ── RIPRENDI LA BOZZA ────────────────────────────────────────
              Compare solo se c'è davvero del lavoro lasciato a metà in QUESTA
              consulenza. Sta qui, e non solo dentro la pagina del preventivo,
              perché il momento in cui serve è quando sei altrove — su Media,
              sulle slide, su un sito — e vuoi tornare al punto in cui eri. */}
            {bozzaViva && (
              <button
                type="button"
                onClick={() => {
                  setQuoteMenu(false);
                  //  Il contrassegno viene letto dalla pagina appena si monta:
                  //  è ciò che fa funzionare il recupero anche arrivando da
                  //  un'altra schermata, dove l'evento partirebbe troppo presto.
                  try {
                    sessionStorage.setItem("hg_recupera_bozza", "1");
                  } catch {
                    /* */
                  }
                  if (cur !== "preventivo") go("/preventivo");
                  window.dispatchEvent(new CustomEvent("hg:riprendi-bozza"));
                }}
                className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2.5 text-left text-[13px] text-white hover:bg-brand/25"
              >
                <RotateCcw className="h-4 w-4 text-amber-300" />
                <span>
                  <span className="font-semibold">Recupera preventivo</span>
                  <span className="block text-[10px] text-white/55">
                    riprendi da dove eri
                    {bozzaViva.profile?.nome ? ` — ${bozzaViva.profile.nome}` : ""}
                    {quandoBozza(bozzaViva.at) ? `, ${quandoBozza(bozzaViva.at)}` : ""}
                  </span>
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setQuoteMenu(false);
                setQuotesPanel(true);
              }}
              className="flex w-full items-center gap-2 border-t border-white/10 px-3 py-2.5 text-left text-[13px] text-white hover:bg-brand/25"
            >
              <FolderClock className="h-4 w-4 text-emerald-300" />
              <span>
                <span className="font-semibold">Preventivi attivi</span>
                <span className="block text-[10px] text-white/55">
                  cerca, riapri, modifica, riapri le condizioni
                </span>
              </span>
            </button>
          </div>
        </>
      )}
      {quotesPanel && <QuotesPanel onClose={() => setQuotesPanel(false)} />}
      {/* ── MENU DEL LOGO ──────────────────────────────────────────────────
        Sta FUORI dalla barra: la barra ha backdrop-blur e un elemento sfocato
        contiene (e quindi ritaglia) i figli in posizione fissa.
        Si apre VERSO L'ALTO — la barra è in basso — perché è ancorato al
        bordo inferiore: crescendo, cresce in su. Con molti consulenti
        configurati non può comunque superare lo schermo: scorre.
        Voci alte almeno 40px: si toccano col pollice, non col mouse.
        Non si usa il menu a tendina di src/components/ui: dentro c'è un campo
        PIN, e quel componente sposta il fuoco e intercetta la digitazione. */}
      {presMenu && (
        <>
          <div className="fixed inset-0 z-[199]" onClick={chiudiPresMenu} />
          <div
            data-hg-noptr
            role="menu"
            aria-label="Menu del consulente"
            className="fixed bottom-14 left-3 z-[200] max-h-[calc(100vh-5rem)] w-64 overflow-y-auto rounded-xl border border-white/25 bg-[#17294a] shadow-2xl ring-1 ring-black/40"
          >
            <div className="border-b border-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/50">
              Consulente
            </div>
            {/* attivo */}
            <div className="flex min-h-[40px] items-center gap-2 bg-brand/20 px-3 py-2.5 text-[13px] text-white">
              <Check className="h-4 w-4 text-brand" />
              <span>
                <span className="font-semibold">{presenter?.name ?? "Nessuno"}</span>
                <span className="block text-[10px] text-white/55">
                  attivo su questo dispositivo
                </span>
              </span>
            </div>

            {/* ── APRI IL CRM ─────────────────────────────────────────────
              Trattative, appuntamenti e installazioni stanno lì. Si apre in
              una scheda NUOVA: una consulenza in corso non va interrotta —
              lasciare questa pagina chiuderebbe la videochiamata. */}
            <a
              href="/CRM"
              target="_blank"
              rel="noopener"
              role="menuitem"
              onClick={() => setPresMenu(false)}
              className="flex min-h-[44px] w-full items-center gap-2 border-t border-white/10 px-3 py-2.5 text-left text-[13px] text-white hover:bg-brand/25"
            >
              <Users className="h-4 w-4 shrink-0 text-brand" />
              <span>
                <span className="font-semibold">Apri il CRM</span>
                <span className="block text-[10px] text-white/55">
                  trattative, appuntamenti, installazioni — in una scheda nuova
                </span>
              </span>
            </a>

            {pinFor ? (
              // richiesta PIN del presentatore scelto
              <div className="border-t border-white/10 px-3 py-2.5">
                <div className="mb-1.5 flex items-center gap-2 text-[12px] text-white/80">
                  <Users className="h-3.5 w-3.5 text-brand" /> PIN di <strong>{pinFor.name}</strong>
                  <button
                    type="button"
                    onClick={() => {
                      setPinFor(null);
                      setPin("");
                    }}
                    className="ml-auto rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    value={pin}
                    inputMode="numeric"
                    maxLength={4}
                    autoFocus
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void doLogin();
                    }}
                    placeholder="0000"
                    className="w-24 rounded-lg border border-white/15 bg-white/5 px-2 py-1.5 text-center text-sm tracking-[0.3em] text-white placeholder:text-white/30 focus:border-brand focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void doLogin()}
                    disabled={pin.length < 4 || pinBusy}
                    className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white hover:brightness-110 disabled:opacity-50"
                  >
                    {pinBusy ? "…" : "Entra"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* altri consulenti configurati: un tocco e chiede il PIN */}
                {presList
                  .filter((p) => p.id !== presenter?.id)
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setPinFor(p);
                        setPin("");
                      }}
                      className="flex min-h-[44px] w-full items-center gap-2 border-t border-white/10 px-3 py-2.5 text-left text-[13px] text-white hover:bg-brand/25"
                    >
                      <Users className="h-4 w-4 shrink-0 text-brand" />
                      <span>
                        <span className="font-semibold">{p.name}</span>
                        <span className="block text-[10px] text-white/55">
                          passa a questo consulente (PIN)
                        </span>
                      </span>
                    </button>
                  ))}
                {presList.filter((p) => p.id !== presenter?.id).length === 0 && (
                  <div className="border-t border-white/10 px-3 py-2 text-[11px] text-white/45">
                    Nessun altro consulente configurato.
                  </div>
                )}
                {/* Cambio di identità: la funzione è quella già usata dalla barra
                  (torna alla schermata di scelta con PIN), non una sua copia. */}
                <button
                  type="button"
                  role="menuitem"
                  onClick={switchPresenter}
                  className="flex min-h-[44px] w-full items-center gap-2 border-t border-white/10 px-3 py-2.5 text-left text-[13px] text-white hover:bg-brand/25"
                >
                  <LogOut className="h-4 w-4 shrink-0 text-brand" />
                  <span>
                    <span className="font-semibold">Cambia consulente</span>
                    <span className="block text-[10px] text-white/55">
                      torna alla schermata di scelta
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setPresMenu(false);
                    setHubTab("presentatori");
                    setHub(true);
                  }}
                  className="flex min-h-[44px] w-full items-center gap-2 border-t border-white/10 px-3 py-2.5 text-left text-[13px] text-white hover:bg-brand/25"
                >
                  <Settings className="h-4 w-4 shrink-0 text-brand" />
                  <span>
                    <span className="font-semibold">Gestisci consulenti</span>
                    <span className="block text-[10px] text-white/55">
                      Impostazioni → Presentatori
                    </span>
                  </span>
                </button>
              </>
            )}
          </div>
        </>
      )}
      {hub && (
        <PresenterSettingsHub
          initialTab={hubTab}
          onClose={() => {
            setHub(false);
            setHubTab(undefined);
          }}
        />
      )}
    </>
  );
}
