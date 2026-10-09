/** ── IL CANALE DI SISTEMA: DOVE ESCE DAVVERO LA NOTIFICA ───────────────────
 *
 *  IL GUASTO CHE QUESTO FILE RIPARA
 *  Il motore sapeva benissimo COSA notificare, e lo mostrava con
 *  `new Notification(...)`. Su un computer funziona. Su un telefono no, e in due
 *  modi diversi:
 *    · Chrome per Android: `new Notification(...)` LANCIA un errore. Il motore
 *      lo intercettava e restituiva `false`, quindi l'avviso finiva nella
 *      campanella e sulla scrivania non compariva mai niente;
 *    · Safari su iPhone: l'oggetto `Notification` NON ESISTE finché il sito non
 *      è stato aggiunto alla schermata Home. Prima di quel gesto il permesso non
 *      si può nemmeno chiedere.
 *  In entrambi i casi la strada obbligata è `registration.showNotification()`,
 *  cioè passare dal service worker (`public/sw.js`).
 *
 *  LE DUE STRADE, IN QUEST'ORDINE
 *   1. IL SERVICE WORKER. Funziona su telefono e su computer, e — differenza
 *      che conta — la notifica sopravvive alla scheda che l'ha generata.
 *   2. `new Notification`. La riserva per il computer, quando il worker non è
 *      ancora pronto (primo caricamento) o non si è potuto registrare.
 *  Se non passa nessuna delle due si restituisce `false`, e chi chiama mette
 *  l'avviso in coda: è quello che rende possibile riceverlo più tardi invece di
 *  perderlo.
 *
 *  ⚠️ QUELLO CHE QUESTO FILE NON PUÒ FARE
 *  Gli avvisi nascono da un calcolo che gira NELLA PAGINA. Se il CRM è chiuso,
 *  o il telefono è bloccato da un po', quel calcolo non gira e non parte
 *  nessuna notifica. Per riceverle a telefono chiuso servirebbe un invio dal
 *  server (web push con chiavi VAPID): non c'è, e la pagina Notifiche lo dice
 *  a chiare lettere invece di lasciarlo credere.
 *  ───────────────────────────────────────────────────────────────────────── */

export const PERCORSO_SW = "/sw.js";
export const PERCORSO_MANIFEST = "/manifest.webmanifest";
export const ICONA_NOTIFICA = "/icone/hg-192.png";

/** Deve combaciare con la costante omonima in `public/sw.js`. */
const CANALE = "hg-notifiche";

/* ── 1. COSA SA FARE QUESTO DISPOSITIVO ──────────────────────────────────── */

export function supportaServiceWorker(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    // Un service worker si registra solo su HTTPS (o su localhost). In sviluppo
    // su un IP di rete locale non parte: è un limite del browser, non un guasto.
    (window.isSecureContext ?? window.location.protocol === "https:")
  );
}

/** Il CRM è aperto come APPLICAZIONE (aggiunto alla schermata Home) e non come
 *  scheda del browser. Su iPhone è la differenza fra ricevere le notifiche e
 *  non poterle nemmeno chiedere. */
export function inApp(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.("(display-mode: standalone)")?.matches === true;
}

export function suTelefono(): boolean {
  if (typeof window === "undefined") return false;
  // Il puntatore grossolano senza possibilità di passare sopra è il modo più
  // affidabile di riconoscere un dito: la stringa dello user agent mente da
  // vent'anni, questo no.
  return window.matchMedia?.("(pointer: coarse) and (hover: none)")?.matches === true;
}

/** iPhone e iPad. Serve perché la regola "va aggiunto alla schermata Home" è
 *  una regola di Apple, non di tutti i telefoni: su Android le notifiche
 *  arrivano anche da una scheda normale, e mostrare lì l'istruzione
 *  dell'iPhone manderebbe l'utente a fare un giro inutile. */
export function suApple(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  const iPadOs = /Macintosh/.test(ua) && (window.navigator.maxTouchPoints ?? 0) > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOs;
}

/** Su questo dispositivo il CRM va aggiunto alla schermata Home PRIMA che le
 *  notifiche possano funzionare? Vero solo su Apple fuori dall'applicazione:
 *  è l'unico caso in cui è un vero prerequisito, e l'unico in cui vale la pena
 *  occupare spazio a schermo per dirlo. */
export function serveInstallazione(): boolean {
  return suApple() && !inApp();
}

/** Vale la pena consigliare l'installazione (non è obbligatoria, ma su un
 *  telefono una scheda del browser viene chiusa e con lei muoiono gli avvisi). */
export function convieneInstallare(): boolean {
  return suTelefono() && !inApp();
}

/* ── 2. LA REGISTRAZIONE ─────────────────────────────────────────────────── */

let registrazione: ServiceWorkerRegistration | null = null;
let inRegistrazione: Promise<ServiceWorkerRegistration | null> | null = null;

/** Il manifesto e le icone messi nel documento da qui, e non nella rotta radice,
 *  per una ragione precisa: questo sito è ANCHE il sito pubblico. Dichiarare
 *  l'applicazione a tutti i visitatori significherebbe proporre a un potenziale
 *  cliente di installarsi il CRM. Così invece l'applicazione esiste solo per chi
 *  ha aperto il CRM, che è esattamente chi la deve avere. */
function dichiaraApplicazione(): void {
  if (typeof document === "undefined") return;
  const testa = document.head;
  if (!testa) return;

  const aggiungiLink = (rel: string, href: string, extra?: Record<string, string>) => {
    if (document.querySelector(`link[rel="${rel}"][href="${href}"]`)) return;
    const l = document.createElement("link");
    l.rel = rel;
    l.href = href;
    if (extra) for (const [k, v] of Object.entries(extra)) l.setAttribute(k, v);
    testa.appendChild(l);
  };
  const aggiungiMeta = (name: string, content: string) => {
    if (document.querySelector(`meta[name="${name}"]`)) return;
    const m = document.createElement("meta");
    m.name = name;
    m.content = content;
    testa.appendChild(m);
  };

  aggiungiLink("manifest", PERCORSO_MANIFEST);
  // iOS ignora il manifesto per l'icona della schermata Home: vuole la sua.
  aggiungiLink("apple-touch-icon", "/icone/hg-192.png", { sizes: "192x192" });
  aggiungiMeta("apple-mobile-web-app-capable", "yes");
  aggiungiMeta("apple-mobile-web-app-title", "CRM");
  aggiungiMeta("mobile-web-app-capable", "yes");
  aggiungiMeta("theme-color", "#0C1F44");
}

/** Registra il service worker e dichiara l'applicazione. Si può chiamare quante
 *  volte si vuole: il lavoro vero lo fa una volta sola. */
export function preparaCanaleSistema(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (inRegistrazione) return inRegistrazione;

  dichiaraApplicazione();

  if (!supportaServiceWorker()) {
    inRegistrazione = Promise.resolve(null);
    return inRegistrazione;
  }

  inRegistrazione = navigator.serviceWorker
    .register(PERCORSO_SW, { scope: "/" })
    .then(async (reg) => {
      registrazione = reg;
      // `register` torna appena il file è stato preso in carico, ma un worker
      // che sta ancora installandosi non sa mostrare niente. `ready` aspetta
      // quello ATTIVO: senza, la prima notifica della sessione veniva chiesta a
      // un worker che non era ancora al suo posto e non compariva.
      try {
        registrazione = await navigator.serviceWorker.ready;
      } catch {
        /* resta quella di `register`: meglio di niente */
      }
      return registrazione;
    })
    .catch(() => {
      // Registrazione negata (contesto non sicuro, impostazioni restrittive):
      // sul computer resta la strada di `new Notification`, sul telefono no. Non
      // è un errore da mostrare: lo stato a schermo lo dice già.
      inRegistrazione = null;
      return null;
    });

  return inRegistrazione;
}

/* ── 3. MOSTRARE ─────────────────────────────────────────────────────────── */

/** I dati che viaggiano CON la notifica. Devono bastare da soli: quando l'utente
 *  tocca l'avviso, la scheda che l'ha generato può essere chiusa da un pezzo, e
 *  l'unica cosa rimasta è questo oggetto. */
export interface DatiNotifica {
  /** La riga di storico da segnare aperta. */
  idStorico?: string;
  leadId?: string;
  destinazione: string;
  quantita?: number;
  chiave?: string;
}

export interface OpzioniNotifica {
  corpo: string;
  tag: string;
  /** Resta finché non la si guarda. Solo per le cose che non si possono perdere. */
  insistente?: boolean;
  dati: DatiNotifica;
}

/** ── PERCHÉ IL SUONO DEL SISTEMA A VOLTE SÌ E A VOLTE NO ───────────────────
 *  Il CRM fa il suono da sé, con due livelli distinti (promemoria / urgente):
 *  lasciar suonare anche il sistema operativo darebbe un doppio "din" e i due
 *  livelli non si distinguerebbero più. Per questo la notifica è `silent`.
 *
 *  Con UNA eccezione, ed è quella che sul telefono fa la differenza fra sentire
 *  e non sentire: quando il CRM è in secondo piano su un telefono, il sistema
 *  operativo SOSPENDE l'audio della pagina. Lì il suono non lo facciamo noi, non
 *  lo fa nessuno, e l'avviso arriva muto in mezzo agli altri. In quel caso —
 *  e solo in quello — si lascia suonare il sistema.
 *  ───────────────────────────────────────────────────────────────────────── */
function silenziosa(): boolean {
  if (typeof document === "undefined") return true;
  const nascosta = document.visibilityState !== "visible";
  return !(suTelefono() && nascosta);
}

function opzioniBrowser(o: OpzioniNotifica): NotificationOptions {
  return {
    body: o.corpo,
    icon: ICONA_NOTIFICA,
    badge: ICONA_NOTIFICA,
    // `tag` = chiave dell'evento: lo stesso avviso sostituisce il precedente
    // invece di impilarsi.
    tag: o.tag,
    silent: silenziosa(),
    requireInteraction: o.insistente === true,
    data: o.dati,
  };
}

/** Mostra la notifica sulla strada migliore disponibile.
 *  `true` = è partita davvero. `false` = chi chiama la metta in coda. */
export function mostraNotificaSistema(titolo: string, o: OpzioniNotifica): boolean {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window) || window.Notification.permission !== "granted") return false;

  const opzioni = opzioniBrowser(o);

  // 1. IL SERVICE WORKER. L'unica strada che un telefono accetta, e l'unica in
  //    cui la notifica sopravvive alla chiusura della scheda.
  const reg = registrazione;
  if (reg) {
    try {
      // Volutamente senza `await`: la decisione "arrivata o in coda" è sincrona.
      // Con il permesso concesso e il worker attivo questa promessa non fallisce
      // per ragioni che possiamo prevedere; se fallisce lo si scrive e basta,
      // perché l'avviso è comunque nella campanella.
      void reg.showNotification(titolo, opzioni).catch((e: unknown) => {
        console.warn("[notifiche] il service worker non ha mostrato l'avviso:", e);
      });
      return true;
    } catch {
      /* si prova la strada del browser qui sotto */
    }
  }

  // 2. LA RISERVA DEL COMPUTER. Sul telefono questa riga LANCIA: è previsto, ed
  //    è il motivo per cui il punto 1 esiste.
  try {
    const n = new Notification(titolo, opzioni);
    n.onclick = () => {
      annunciaClicLocale(o.dati);
      n.close();
    };
    tieniViva(n);
    return true;
  } catch {
    return false;
  }
}

/** ── PERCHÉ SI TENGONO DA PARTE ───────────────────────────────────────────
 *  Una `Notification` creata e non referenziata può essere portata via dal
 *  raccoglitore di memoria mentre è ancora a schermo: il riquadro resta, il clic
 *  non arriva più a nessuno. Si tiene un riferimento finché non si chiude. */
const vive: Notification[] = [];
function tieniViva(n: Notification): void {
  vive.push(n);
  n.onclose = () => {
    const i = vive.indexOf(n);
    if (i >= 0) vive.splice(i, 1);
  };
}

/* ── 4. IL CLIC CHE TORNA INDIETRO ───────────────────────────────────────── */

type Ascoltatore = (dati: DatiNotifica) => void;
const ascoltatori = new Set<Ascoltatore>();

function annunciaClicLocale(dati: DatiNotifica): void {
  ascoltatori.forEach((f) => {
    try {
      f(dati);
    } catch (e) {
      console.warn("[notifiche] apertura fallita", e);
    }
  });
}

let ascoltoInstallato = false;

/** Il clic su una notifica del service worker NON esegue nessun `onclick` della
 *  pagina: il worker manda un messaggio, e la pagina — che ha il router in mano
 *  — decide dove andare. Qui si raccolgono quei messaggi. */
export function ascoltaClicNotifica(f: Ascoltatore): () => void {
  ascoltatori.add(f);

  if (!ascoltoInstallato && typeof navigator !== "undefined" && "serviceWorker" in navigator) {
    ascoltoInstallato = true;
    navigator.serviceWorker.addEventListener("message", (e: MessageEvent) => {
      const m = e.data as { canale?: string; tipo?: string; dati?: DatiNotifica } | null;
      if (!m || m.canale !== CANALE || m.tipo !== "clic" || !m.dati) return;
      annunciaClicLocale(m.dati);
    });
  }

  return () => {
    ascoltatori.delete(f);
  };
}

/* ── 5. LA PROVA ─────────────────────────────────────────────────────────── */

/** Una notifica vera, adesso, sulla stessa strada di quelle vere. Provare con
 *  `new Notification` mentre gli avvisi veri passano dal worker vorrebbe dire
 *  provare una cosa diversa da quella che si usa: su telefono la prova
 *  fallirebbe sempre e il CRM sembrerebbe rotto quando non lo è. */
export function notificaDiProva(titolo: string, corpo: string): boolean {
  const partita = mostraNotificaSistema(titolo, {
    corpo,
    // Un tag fisso: premere "Prova" tre volte non lascia tre riquadri.
    tag: "hg-crm-prova",
    dati: { destinazione: "/CRM/notifiche" },
  });
  if (!partita) return false;

  // Una prova non deve restare sullo schermo come un avviso vero.
  window.setTimeout(() => {
    void chiudiPerTag("hg-crm-prova");
  }, 6_000);
  return true;
}

/** Chiude le notifiche con quel `tag` su ENTRAMBE le strade. Solo la prima non
 *  basterebbe: quando la prova esce dalla riserva del computer
 *  (`new Notification`) il worker non la conosce, `getNotifications` non la
 *  restituisce e il riquadro della prova resterebbe a schermo come un avviso
 *  vero. */
async function chiudiPerTag(tag: string): Promise<void> {
  // 1. Quelle del service worker.
  const reg = registrazione;
  if (reg) {
    try {
      const aperte = await reg.getNotifications({ tag });
      aperte.forEach((n) => n.close());
    } catch {
      /* già chiuse dall'utente, o il browser non espone l'elenco */
    }
  }
  // 2. Quelle create dalla pagina: le abbiamo in mano noi.
  [...vive].forEach((n) => {
    if (n.tag === tag) n.close();
  });
}
