import { createFileRoute , useNavigate } from "@tanstack/react-router";
import { sfx } from "@/shop/sfx";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveId, watchId as getWatch, useLiveNav } from "@/shop/live";
import { pubblicaContenuti, salaDallIndirizzo, salaDeiContenuti, salaDiRegiaDallIndirizzo } from "@/webinar/contenuti";
//  Pigra: il pacchetto della barra non deve finire in quello della pagina,
//  che la apre anche il cliente (vedi shop/BarraPresentatore).
import { BarraPresentatore as PresenterBar } from "@/shop/BarraPresentatore";
import { useConsultant } from "@/shop/consultant";
import { useZoomPan, ZoomControls } from "@/shop/zoompan";
import { useViewMode } from "@/shop/viewmode";
import { useCall, useGuestChannel, hostSetMode, reportGuestError } from "@/shop/call";
import { readPointerPref, writePointerPref, makePointerHysteresis } from "@/shop/pointer";
import { PointerDot } from "@/shop/PointerDot";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { MarchioSuMedia } from "@/media/marchio";
import { MAX_VOCI, type VoceGalleria } from "@/media/galleria";
import { Upload, Link2, Trash2, Play, Pencil, Video, Image as ImageIcon, Images, Volume2, Pointer, Check, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
//  Il link «solo i media» da mandare al cliente: apre la sessione al clic,
//  esattamente come quello del preventivo. La regola sta nel modulo, non qui.
import { linkMedia } from "@/shop/link-media";
import { copyLink } from "@/shop/copied";

export const Route = createFileRoute("/presenta")({
  head: () => ({ meta: [{ title: "Media — Hair Genius Labs" }, { name: "robots", content: "noindex" }] }),
  component: PresentaPage,
});

type Kind = "video" | "image";
interface Vid { name: string; url: string; kind?: Kind }

const IMG_RE = /\.(jpe?g|png|gif|webp|avif|bmp|svg|heic|heif)(\?|#|$)/i;
/** kind dedotto da mime (upload) o dall'estensione dell'URL (incolla). */
const kindOf = (url: string, mime?: string): Kind =>
  mime?.startsWith("image/") ? "image" : mime?.startsWith("video/") ? "video" : IMG_RE.test(url) ? "image" : "video";
/** retrocompat: voci salvate senza kind = video */
const vKind = (v: Vid): Kind => (v.kind === "image" ? "image" : "video");

// ── QUELLO CHE TORNA DALLA RETE NON È ANCORA UNA LISTA ──────────────────────
//  `setVideos(j.videos ?? [])` dà per scontato che il server risponda con un
//  array di oggetti fatti bene. Ma basta una risposta d'errore, un JSON vecchio
//  o una voce senza url perché lo stato diventi qualcosa su cui `.map()` esplode
//  — e la libreria sparisce IN CONSULENZA, davanti al cliente. Qui si accetta
//  solo ciò che si sa disegnare, e si dà un nome a chi non ce l'ha.
const listaValida = (x: unknown): Vid[] =>
  !Array.isArray(x)
    ? []
    : x
        .filter((v): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v))
        .filter((v) => typeof v.url === "string" && v.url.trim() !== "")
        .map((v) => ({
          url: String(v.url),
          name: typeof v.name === "string" && v.name.trim() ? v.name.trim() : "Media",
          kind: (v.kind === "image" ? "image" : "video") as Kind,
        }));

/** Quello che il server rimanda quando tocca la libreria: la lista intera e la
 *  firma del suo ordine. La `firma` la calcola SOLO lui — qui si riecheggia. */
type RispostaLibreria = { ok?: boolean; videos?: unknown; firma?: unknown; reason?: unknown };

// ── PERMUTARE, NON RISCRIVERE ───────────────────────────────────────────────
//  Stessa identica regola che applica il server quando riceve un riordino, e
//  serve anche qui per un caso solo: la risposta buona arriva mentre il
//  consulente ha già spostato un'altra riga. L'ordine a schermo è più recente
//  di quello appena salvato, e va rimesso SOPRA la lista vera invece di essere
//  cancellato da essa.
//   · un url che nella lista vera non c'è più → sparisce (l'ha cancellato
//     un'altra scheda, e farlo risorgere significherebbe miniature rotte
//     davanti al cliente);
//   · una voce della lista vera che l'ordine non nomina → resta, e resta IN
//     CIMA, perché l'unico modo in cui esiste una voce che qui non si conosce è
//     un caricamento appena avvenuto — e chi l'ha caricata la cerca in cima.
//  Conseguenza: l'insieme dei media non cambia mai, per costruzione.
const permutaSecondo = (vera: Vid[], ordine: string[]): Vid[] => {
  const perUrl = new Map(vera.map((v) => [v.url, v]));
  const visti = new Set<string>();
  const noti: Vid[] = [];
  for (const u of ordine) {
    const v = perUrl.get(u);
    if (v && !visti.has(u)) { visti.add(u); noti.push(v); }
  }
  return [...vera.filter((v) => !visti.has(v.url)), ...noti];
};

/** Quanto dura la "presa" del clic ripetuto sulla stessa freccia (vedi `presa`).
 *  ⚠️ Non è una soglia di reattività, è la durata di una PAUSA: portare una foto
 *  dal fondo alla cima sono venti clic, e in mezzo si parla col cliente, si
 *  guarda l'elenco, si respira. Con sette decimi di secondo la presa cadeva
 *  proprio lì — e cadere non si vede: il clic dopo spostava il vicino finito
 *  sotto il cursore, nella stessa direzione, cioè un elenco che si sfalsa senza
 *  che nessuno se ne accorga. Allungarla non costa quasi nulla, perché la presa
 *  muore comunque appena il puntatore si muove di sei pixel. */
const PRESA_MS = 1500;
/** Quanto si aspetta prima di salvare l'ordine: dieci frecce di fila devono
 *  restare UNA richiesta, non dieci. */
const ATTESA_ORDINE_MS = 600;

//  `useLayoutEffect` sul server non esiste e React lo dice con un avviso ad ogni
//  render: questa pagina è resa anche lato server. Sul client serve però quello
//  vero — il fuoco va rimesso PRIMA che il browser disegni, altrimenti si vede
//  saltare via.
const useEffettoDiLayout = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Il marchio sul media adesso vive in @/media/marchio: lo usano la diretta,
// questa anteprima e il carosello dei link statici, e devono essere la stessa
// cosa — stesso angolo, stesse distanze, stesso fondo.

// ── COPIARE UN TESTO, DAVVERO ───────────────────────────────────────────────
//  `navigator.clipboard` non c'è sempre: manca fuori dalle connessioni sicure e
//  certi browser lo rifiutano quando la copia arriva dopo un'attesa (qui in
//  mezzo c'è la chiamata che crea il link). Se fallisce si ripiega sul vecchio
//  metodo, e se fallisce anche quello si dice la verità a chi ha premuto invece
//  di far finta che sia andata: il link glielo si mette comunque sotto gli
//  occhi, da copiare a mano.
async function copiaNegliAppunti(testo: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(testo); return true; }
  } catch { /* si prova il ripiego */ }
  try {
    const ta = document.createElement("textarea");
    ta.value = testo;
    ta.setAttribute("readonly", "");
    // fuori dallo schermo ma NON nascosto: quello che non si disegna non si seleziona
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch { return false; }
}

/** Quanto va tenuto premuto. Sotto il mezzo secondo il gesto scatta per sbaglio
 *  a chi clicca lentamente; oltre i sei decimi sembra che non stia funzionando
 *  e si molla a metà. */
const SOGLIA_PRESSIONE_MS = 560;

// ── MINIATURA DEL VIDEO: IL PRIMO FOTOGRAMMA, SENZA GENERARE NULLA ──────────
//  Non si crea né si salva alcuna immagine: si disegna un <video> fermo con
//  preload="metadata" e si punta al primo istante con il frammento #t=0.1 —
//  i browser mostrano quel fotogramma come immagine ferma. Nessun file nuovo,
//  nessuna colonna, nessun costo di archiviazione. Funziona perché lo Storage
//  di Supabase (bucket 'presenter-videos') risponde alle richieste parziali:
//  senza Range il browser non potrebbe fermarsi al primo fotogramma.
//  Ferma per davvero: niente autoplay, niente loop, niente controlli, muto.
//  Se il file non è leggibile (URL esterno morto, formato non supportato) si
//  torna all'icona di prima: mai un rettangolo nero senza spiegazione.
const conPrimoFotogramma = (url: string) => `${url.split("#")[0]}#t=0.1`;

function MiniaturaVideo({ url }: { url: string }) {
  const [ko, setKo] = useState(false);
  const base = "h-9 w-12 flex-shrink-0 rounded-md border border-white/10";
  if (ko)
    return (
      <span className={`${base} flex items-center justify-center bg-white/5`}>
        <Video className="h-4 w-4 text-brand" />
      </span>
    );
  return (
    <span className={`${base} relative block overflow-hidden bg-black/40`}>
      <video
        src={conPrimoFotogramma(url)}
        preload="metadata"
        muted
        playsInline
        autoPlay={false}
        controls={false}
        disablePictureInPicture
        tabIndex={-1}
        aria-hidden
        onError={() => setKo(true)}
        // Alcuni browser ignorano il frammento e restano sul fotogramma 0
        // (spesso nero): una spinta esplicita al primo istante li allinea.
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          if (el.currentTime < 0.05) {
            try { el.currentTime = 0.1; } catch { /* sorgente che non accetta il seek: si tiene il fotogramma 0 */ }
          }
        }}
        className="pointer-events-none h-full w-full object-cover"
      />
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <Play className="h-3 w-3 fill-white/90 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,.85)]" />
      </span>
    </span>
  );
}

function PresentaPage() {
  const liveId = useLiveId();
  const watch = getWatch();
  // ── CANALE DELL'OSPITE: CODICE VIVO, NON QUELLO DEL LINK ──────────────────
  //  Se il presentatore rigenera la sessione (Termina → Videochiamata, o "Nuova"),
  //  il codice cambia. Il motore della videochiamata lo adottava già da solo — per
  //  questo il video continuava a funzionare — ma questa pagina restava agganciata
  //  al codice scritto nel link, cioè a un canale morto: niente media, niente
  //  scorrimento, niente link. Ora segue il codice adottato.
  const isViewer = !!watch;
  //  Dentro la REGIA questa pagina pubblica; dentro la cornice della SALA
  //  segue. Vedi `webinar/contenuti`.
  const salaDiRegia = typeof window === "undefined" ? "" : salaDiRegiaDallIndirizzo();
  const salaWebinar = typeof window === "undefined" ? "" : salaDallIndirizzo();
  const guestCode = useGuestChannel(isViewer ? watch : null);
  const sessionId = isViewer ? (guestCode || watch) : liveId;
  useLiveNav(!!liveId && !isViewer, watch);

  const navigate = useNavigate();
  const { consultant, ready } = useConsultant();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [current, setCurrent] = useState<string>("");
  const [currentKind, setCurrentKind] = useState<Kind>("video");
  const [videos, setVideos] = useState<Vid[]>([]);
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  // ── RINOMINA IN RIGA ──────────────────────────────────────────────────────
  //  Questi stati stanno QUI, insieme a tutti gli altri, e non più in basso
  //  vicino alla libreria: sotto c'è il `return` dello spettatore, e un hook
  //  dichiarato dopo un return anticipato viene contato solo in metà dei render.
  const [rinomino, setRinomino] = useState("");    // url della riga in modifica ("" = nessuna)
  const [nuovoNome, setNuovoNome] = useState("");
  const [salvandoNome, setSalvandoNome] = useState(false);
  //  Esc rimuove l'input dal DOM: il blur che ne segue NON deve salvare.
  const annullaRef = useRef(false);
  //  Il passaggio a sola lettura durante il salvataggio può far scattare un
  //  secondo blur: senza questa guardia partirebbe una seconda PATCH identica.
  const salvataggioRef = useRef(false);

  // ── LINK MEDIA STATICO ────────────────────────────────────────────────────
  //  Un link che porta con sé un elenco di media, da mandare e basta: nessuna
  //  consulenza dietro, nessun canale, nessuna sessione. Il cliente lo apre
  //  quando vuole e scorre.
  //
  //  ── PERCHÉ SI SPUNTA E NON SI TRASCINA ──────────────────────────────────
  //   Serviva un modo di dire "questi, in quest'ordine". Il trascinamento è la
  //   risposta istintiva, ma è la peggiore qui: la libreria si usa DURANTE la
  //   consulenza, spesso dal portatile con il trackpad, e trascinare righe
  //   davanti al cliente mentre si parla è esattamente il momento in cui si
  //   sbaglia bersaglio. Si spunta invece: un tocco per aggiungere, uno per
  //   togliere, e l'ORDINE è quello in cui si è spuntato — visibile come numero
  //   dentro la casella, quindi non è una regola da ricordare, si vede.
  //   In più regge il caso più frequente di tutti: un media solo, che si manda
  //   senza spuntare niente, tenendo premuto il suo pulsante.
  const [selezione, setSelezione] = useState<string[]>([]);  // url NELL'ORDINE di spunta
  const [premuto, setPremuto] = useState("");                // url della riga sotto pressione
  const [creandoLink, setCreandoLink] = useState(false);
  const timerPressione = useRef<ReturnType<typeof setTimeout> | null>(null);
  //  La pressione lunga finisce SEMPRE con un clic normale subito dopo (il
  //  browser lo manda comunque): senza questo, insieme al link partirebbe anche
  //  "Mostra", e il media in diretta cambierebbe sotto gli occhi del cliente.
  //  È un ORARIO e non un interruttore: se si molla il dito fuori dal pulsante
  //  il clic non arriva mai, e un interruttore rimasto acceso si mangerebbe il
  //  clic buono successivo (o il primo Invio da tastiera).
  const oraDelGesto = useRef(0);
  //  Il gesto scatta 560ms dopo, dentro un timer: quello che legge deve essere lo
  //  stato di ADESSO, non quello catturato quando il dito è sceso.
  const selezioneRef = useRef<string[]>([]);
  selezioneRef.current = selezione;
  const videosRef = useRef<Vid[]>([]);
  videosRef.current = videos;

  // ── RIORDINO DELLA LIBRERIA: DUE "DISPOSIZIONI", MAI MESCOLATE ────────────
  //  «Disposizione» qui vuol dire due cose diverse, e la feature esiste solo
  //  finché restano separate:
  //   (a) l'ordine della LIBRERIA — come il consulente si trova i media davanti
  //       mentre lavora. È l'ordine di questo array, e le frecce cambiano
  //       QUESTO;
  //   (b) l'ordine che il CLIENTE vedrà dentro il link — resta l'ordine delle
  //       SPUNTE (`selezione`), e il riordino non lo legge, non lo riordina e
  //       non lo rigenera. Mai.
  //  Se (a) riscrivesse (b) di nascosto, il consulente manderebbe un carosello
  //  diverso da quello che aveva costruito, e se ne accorgerebbe il cliente.
  //  L'unico ponte fra le due è il pulsante "Numera come li vedi": a senso
  //  unico, si attraversa solo premendolo, e si annulla.
  const [appenaMosso, setAppenaMosso] = useState("");                 // url con l'anello, per 400ms
  const [spiaOrdine, setSpiaOrdine] = useState<"" | "salvo" | "fatto">("");
  const [riordinoNegato, setRiordinoNegato] = useState(false);        // 403: si scopre UNA volta sola
  const [ordinePronto, setOrdinePronto] = useState(false);            // c'è una firma: si può salvare
  const [annuncioOrdine, setAnnuncioOrdine] = useState("");           // per chi ascolta la pagina
  //  La firma dell'ordine la calcola SOLO il server: qui si riecheggia e basta.
  //  Calcolarla da questa parte vorrebbe dire calcolarla sulla lista ottimistica
  //  — cioè un controllo che passa sempre, che è come non averlo.
  const firmaRef = useRef("");
  //  L'ultimo ordine che il server ha ACCETTATO: è il posto in cui si torna se
  //  la scrittura fallisce. Lasciare a schermo un ordine che il server non ha
  //  significa farlo cancellare, senza una parola, dalla prima risposta di
  //  rinomina o cancellazione — in mezzo alla consulenza.
  const ordineConfermatoRef = useRef<Vid[]>([]);
  const daSalvare = useRef(false);
  const timerOrdine = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerAnello = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timerSpia = useRef<ReturnType<typeof setTimeout> | null>(null);
  //  Le spedizioni si mettono in fila una dopo l'altra: due PUT in volo insieme
  //  arriverebbero in ordine qualunque, e vincerebbe il più lento.
  const catenaOrdine = useRef<Promise<boolean>>(Promise.resolve(true));
  const riordinoNegatoRef = useRef(false);
  //  ⚠️ LA PRESA. È l'unico difetto vero delle frecce: cliccato ▲ la riga sale,
  //  e sotto il cursore fermo compare la freccia del VICINO con cui si è
  //  scambiata. Un secondo clic sullo stesso pixel rimetterebbe tutto com'era —
  //  su e giù davanti al cliente. Finché il puntatore non si muove, clic
  //  ripetuti continuano a spostare LO STESSO media.
  const presa = useRef<{ url: string; dir: -1 | 1; t: number; x: number; y: number } | null>(null);
  //  Spostare un nodo nel DOM gli fa perdere il fuoco (Chrome e Safari), anche
  //  con la `key` giusta: va rimesso a mano, subito dopo, o si riordina una
  //  volta sola e poi si è a piedi.
  const frecciaRef = useRef(new Map<string, HTMLButtonElement>());
  const daRimettereAFuoco = useRef<{ url: string; dir: -1 | 1; daTastiera: boolean } | null>(null);
  // L'ospite NON deve più toccare nulla: il media parte da solo (muto se il
  // browser lo impone) e appare subito. `needTap` diventa un semplice avviso
  // discreto, mostrato SOLO se il browser ha davvero bloccato l'audio.
  const [needTap, setNeedTap] = useState(false);
  const [audioOn, setAudioOn] = useState(false);
  const [hostAudio, setHostAudio] = useState(false); // in diretta il video host è muto (audio pulito sul cliente)
  const [full, setFull] = useState(false);           // schermo intero del box media (presentatore)
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const applyingRef = useRef(false);
  const pendingRef = useRef<Record<string, unknown> | null>(null);

  // zoom/pan del presentatore, rispecchiato sull'ospite (stesso approccio delle slide)
  const zp = useZoomPan(!isViewer);
  const zoomRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const [gzoom, setGzoom] = useState<{ scale: number; tx: number; ty: number } | null>(null);

  // ── LO SPAZIO DELL'IMMAGINE HA LA FORMA DELLO SCHERMO DEL CLIENTE ─────────
  //  Il riquadro era fisso a 16:9, mentre sul telefono del cliente il media
  //  riempie tutto lo schermo (verticale). Quello che vedevi non era quello che
  //  vedeva lui: bordi e ritagli diversi. Ora il riquadro prende le proporzioni
  //  del dispositivo scelto nella barra in basso, e in "auto" quelle REALI del
  //  cliente collegato.
  const vm = useViewMode();
  const gvp = useCall().guestViewport;
  const previewRatio = (() => {
    if (vm.mode === "mobile") return 390 / 844;
    if (vm.mode === "tablet") return 834 / 1112;
    if (vm.mode === "auto" && gvp && gvp.w > 0 && gvp.h > 0) return gvp.w / gvp.h;
    return 16 / 9;
  })();

  const [pointerOn, setPointerOn] = useState(() => readPointerPref());
  const [ptr, setPtr] = useState({ x: 0.5, y: 0.5, on: false });
  const ptrTs = useRef(0);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // lista media (host) — ricaricata ad ogni mount: la libreria è persistente
  // firma d'ingresso della schermata
  //  ── NESSUN SUONO SENZA UN GESTO ─────────────────────────────────────────
  //   Qui la pagina suonava da sola ogni volta che veniva montata: non solo
  //   quando la aprivi tu, ma anche quando si rimontava per conto suo — una
  //   navigazione automatica, un rientro, un aggiornamento. Il suono del cambio
  //   schermata lo fa già il pulsante che premi: è quello il gesto.

  useEffect(() => {
    if (isViewer) return;
    fetch("/api/presenter/videos")
      .then((r) => r.json())
      .then((j: RispostaLibreria) => {
        const lista = listaValida(j?.videos);
        setVideos(lista);
        videosRef.current = lista;
        ordineConfermatoRef.current = lista;
        //  ⚠️ Senza firma il riordino non è salvabile in sicurezza: il server non
        //  potrebbe accorgersi che un'altra scheda ha cambiato la libreria, e si
        //  finirebbe per spostare una riga in un elenco che non è più quello.
        //  Quindi le frecce restano SPENTE finché una firma non arriva.
        if (typeof j?.firma === "string" && j.firma) { firmaRef.current = j.firma; setOrdinePronto(true); }
      })
      //  ⚠️ Qui il fallimento era muto (`.catch(() => {})`): la libreria restava
      //  vuota senza che nessuno lo dicesse, e davanti al cliente sembrava che i
      //  media fossero spariti.
      .catch(() => toast.error("Non sono riuscito a caricare la libreria. Ricarica la pagina."));
  }, [isViewer]);

  // gate consulente: solo il link magico (o lo spettatore) accede
  useEffect(() => {
        // ── MAI UN RICARICAMENTO COMPLETO ────────────────────────────────────
    //  Qui si usava `window.location.href`, che ricarica l'intera pagina. Lo
    //  stato della videochiamata vive in memoria: un ricaricamento la azzerava e
    //  faceva uscire ANCHE il cliente. E scattava a sorpresa, perché il
    //  riconoscimento del consulente si completa un istante dopo il montaggio.
    //  Ora si aspetta che il verdetto sia stabile e si cambia schermata senza
    //  ricaricare, così la chiamata resta viva.
    //  ── ⚠️ CHI NON È RICONOSCIUTO VA AL PIN, NON AL PREVENTIVO ───────────
    //   Terzo e ultimo anello del guasto segnalato dal committente: «Avvia
    //   consulenza» apriva questa pagina e dopo un attimo saltava sul modulo
    //   dei prezzi. Il salto era QUI: chi non risulta consulente veniva
    //   mandato al preventivo — che è una schermata di lavoro, non una porta,
    //   e soprattutto non chiede le credenziali. Quindi il rimbalzo non
    //   spiegava niente e non si poteva nemmeno rimediare: si finiva a
    //   guardare un preventivo vuoto con il cliente che aspettava nella
    //   stanza appena creata.
    //   La porta è /presentatore, che chiede il PIN e — fatto il PIN —
    //   riporta qui: il giro si chiude invece di finire nel posto sbagliato.
    if (ready && !consultant && !isViewer) { const t = setTimeout(() => navigate({ to: "/presentatore" }), 400); return () => clearTimeout(t); }
  }, [ready, consultant, isViewer, navigate]);
  const gated = ready && !consultant && !isViewer;

  // ── CHI PARLA È CHI HA QUALCOSA DA DIRE ───────────────────────────────────
  //  Prima trasmetteva solo il contesto che vinceva un "lock". Ma la pagina è
  //  montata due volte (la tua finestra e l'iframe dell'anteprima) e a vincere
  //  poteva essere quello SBAGLIATO — quello senza media scelto: da lì "tutto
  //  quello che metto su Media non lo mostra al cliente".
  //  Regola più semplice e senza modi di sbagliare: nessuno viene zittito, ma
  //  un contesto che NON ha un media selezionato non annuncia nulla. Così il
  //  lampeggio originale (uno diceva "immagine", l'altro "niente") non può
  //  ripresentarsi, e chi ha davvero il contenuto parla sempre.
  const send = (event: string, payload: Record<string, unknown>) => {
    //  ⚠️ Stesso aggancio di `slide.tsx`, e per la stessa ragione: questo è
    //   l'unico punto da cui passa OGNI cambiamento, quindi è l'unico da cui
    //   agganciarsi senza dimenticarne uno. Non fa niente fuori da un webinar.
    pubblicaContenuti(event, payload);
    return chanRef.current?.send({ type: "broadcast", event, payload });
  };

  // Decidi TU se il cliente deve sentire l'audio di questo video (viaggia con
  // ogni aggiornamento di stato, così vale anche per chi entra dopo).
  const [guestAudio, setGuestAudio] = useState(true);
  const guestAudioRef = useRef(true);
  guestAudioRef.current = guestAudio;

  // Il media in mostra letto da un REF: i gestori del canale non devono più
  // dipendere dallo stato di React (vedi il commento sull'effetto del canale).
  const curRef = useRef({ url: "", kind: "video" as Kind });
  curRef.current = { url: current, kind: currentKind };

  const snapshot = () => {
    const v = videoRef.current;
    const c = curRef.current;
    return { url: c.url, kind: c.kind, time: v?.currentTime ?? 0, playing: v ? !v.paused : false, rate: v?.playbackRate ?? 1, gaudio: guestAudioRef.current };
  };

  // canale live (host trasmette / viewer riceve) sullo stesso session id
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase.channel(`qvid-${sessionId}`, { config: { broadcast: { self: false } } });
    if (isViewer) {
      ch.on("broadcast", { event: "video" }, ({ payload }) => applyVideo(payload as Record<string, unknown>));
      ch.on("broadcast", { event: "mediazoom" }, ({ payload }) => {
        const p = payload as { scale?: number; tx?: number; ty?: number };
        setGzoom({ scale: Number(p.scale) || 1, tx: Number(p.tx) || 0, ty: Number(p.ty) || 0 });
      });
      ch.on("broadcast", { event: "pointer" }, ({ payload }) => {
        const p = payload as { x?: number; y?: number; on?: boolean };
        setPtr({ x: Number(p.x) || 0, y: Number(p.y) || 0, on: !!p.on });
      });
      ch.subscribe((s) => { if (s === "SUBSCRIBED") ch.send({ type: "broadcast", event: "vhello", payload: {} }); });
    } else {
      // risponde SOLO il contesto che ha davvero un media in mostra
      ch.on("broadcast", { event: "vhello" }, () => {
        if (!curRef.current.url) return;
        send("video", snapshot()); send("mediazoom", { ...zoomRef.current });
      });
      // appena il canale è pronto, se un media è già in mostra lo si annuncia:
      // un ospite che arriva dopo non resta mai davanti allo schermo d'attesa
      ch.subscribe((st) => {
        if (st !== "SUBSCRIBED" || !curRef.current.url) return;
        ch.send({ type: "broadcast", event: "video", payload: snapshot() });
        ch.send({ type: "broadcast", event: "mediazoom", payload: { ...zoomRef.current } });
      });
    }
    chanRef.current = ch;
    return () => { supabase.removeChannel(ch); chanRef.current = null; };
    // ── PERCHÉ "MOSTRA" NON ARRIVAVA AL CLIENTE ────────────────────────────
    //  Le dipendenze includevano `current`/`currentKind`: cliccando "Mostra" lo
    //  stato cambiava, quindi questo effetto SMONTAVA il canale e ne creava uno
    //  nuovo — proprio nell'istante in cui l'annuncio doveva partire. L'annuncio
    //  veniva emesso ~60ms dopo, su un canale non ancora iscritto: perso.
    //  Ora il canale si crea UNA volta per sessione e i gestori leggono il media
    //  da un ref, così non serve più ricrearlo ad ogni cambio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isViewer]);

  /* ── ⚠️ IL CLIENTE RICHIEDE FINCHÉ NON GLI ARRIVA ──────────────────────
     L'ospite chiede «cosa stai mostrando?» (`vhello`) UNA volta sola, appena
     il canale è pronto. Ma il momento in cui si iscrive e il momento in cui il
     consulente sceglie il media non sono lo stesso: se la domanda parte prima
     che ci sia qualcosa da mostrare, la risposta non arriva mai — e da lì in
     poi il cliente resta sulla schermata d'attesa per sempre, senza che
     nessuno dei due capisca perché. Basta un annuncio perso per strada per
     ottenere lo stesso risultato.
     Qui la domanda si ripete finché un media non c'è: è un messaggio di
     nulla ogni tre secondi, e si spegne da solo appena arriva qualcosa. */
  useEffect(() => {
    if (!isViewer || current) return;
    const chiedi = () => {
      try {
        chanRef.current?.send({ type: "broadcast", event: "vhello", payload: {} });
      } catch {
        /* canale non ancora pronto: si riprova al giro dopo */
      }
    };
    const iv = setInterval(chiedi, 3000);
    return () => clearInterval(iv);
  }, [isViewer, current]);

  // host: ri-annuncio periodico del media in mostra (anti-drift per i video e
  // rete di sicurezza se un annuncio si perde per strada)
  useEffect(() => {
    if (isViewer || !liveId) return;
    const t = setInterval(() => {
      if (!curRef.current.url) return;
      const v = videoRef.current;
      // anche in PAUSA: se un onPause si perde, senza questo non verrebbe mai ripetuto
      void v; send("video", snapshot());
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewer, liveId, current]);

  // host: ogni cambio di zoom/pan viene rispecchiato sull'ospite (foto E video)
  useEffect(() => {
    if (isViewer) return;
    zoomRef.current = { scale: zp.scale, tx: zp.tx, ty: zp.ty };
    if (!current) return;                        // niente media qui: non parlo
    send("mediazoom", { ...zoomRef.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewer, zp.scale, zp.tx, zp.ty]);

  // viewer: applica lo stato ricevuto (memorizza l'ultimo e lo riapplica al loadeddata)
  // ── ⚠️ DENTRO UN WEBINAR ────────────────────────────────────────────────
  //  In regia si PUBBLICA quello che si mostra; dentro la cornice della sala
  //  si SEGUE. Senza queste due, la sala vedeva la schermata con cui si
  //  scelgono i media invece del media scelto — cioè il pannello di lavoro del
  //  relatore proiettato a duecento persone.
  useEffect(() => {
    if (!salaDiRegia) return;
    salaDeiContenuti(salaDiRegia);
    return () => salaDeiContenuti("");
  }, [salaDiRegia]);

  useEffect(() => {
    if (!salaWebinar) return;
    let vivo = true;
    let ultimo = "";
    const giro = async () => {
      try {
        const r = await fetch(`/api/public/webinar?codice=${encodeURIComponent(salaWebinar)}`);
        const j = await r.json();
        const c = j?.contenuti as Record<string, any> | null | undefined;
        if (!vivo || !c?.video) return;
        //  Solo quando è cambiato: riapplicare lo stesso media due volte al
        //  secondo farebbe ripartire il video da capo a ogni giro.
        const impronta = JSON.stringify(c.video);
        if (impronta === ultimo) return;
        ultimo = impronta;
        applyVideo(c.video as Record<string, unknown>);
      } catch { /* si riprova al giro dopo */ }
    };
    /** ── ⚠️ IL GIRO DEI CONTENUTI, SVELTO MA NON SEMPRE ──────────────────
     *  Erano due secondi fissi. Il ritardo che si vede in sala è la SOMMA di
     *  tre attese — l'accorpamento di chi manda, questo giro, e la cache del
     *  bordo — e faceva tre secondi e mezzo nel caso peggiore: cambiavi slide
     *  e la sala restava sulla precedente mentre già ne parlavi.
     *  ⚠️ Settecento millisecondi si possono chiedere perché questa risposta è
     *   la STESSA della sala e sta in cache al bordo un secondo: mille persone
     *   che la chiedono restano una lettura al secondo sotto.
     *  ⚠️ Con la pagina in secondo piano si rallenta di dieci volte: aggiornare
     *   una slide che nessuno sta guardando è la definizione di richiesta
     *   sprecata, e sono la maggioranza durante un'ora di diretta. */
    let prossimo: ReturnType<typeof setTimeout> | null = null;
    const riprogramma = () => {
      if (!vivo) return;
      const dietro = typeof document !== "undefined" && document.visibilityState !== "visible";
      prossimo = setTimeout(async () => { await giro(); riprogramma(); }, dietro ? 7000 : 700);
    };
    void giro().then(riprogramma);
    //  Tornando sulla pagina si chiede SUBITO: chi riprende in mano il telefono
    //  vuole vedere la slide di adesso, non fra sette secondi.
    const alRitorno = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;
      if (prossimo) clearTimeout(prossimo);
      void giro().then(riprogramma);
    };
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", alRitorno);
    return () => {
      vivo = false;
      if (prossimo) clearTimeout(prossimo);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", alRitorno);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salaWebinar]);

  const applyVideo = (s: Record<string, unknown>) => {
    pendingRef.current = s;
    if ("gaudio" in s) setAudioOn(!!s.gaudio);   // lo decide il presentatore
    const url = String(s.url || "");
    const kind: Kind = s.kind === "image" ? "image" : "video";
    // confronto sul REF, non sullo stato: il gestore vive in un canale creato una
    // sola volta, quindi una variabile di stato catturata qui resterebbe ferma al
    // primo render (e ogni annuncio verrebbe trattato come "media nuovo",
    // azzerando la sincronizzazione del tempo dei video).
    const c = curRef.current;
    if (url !== c.url || kind !== c.kind) {
      curRef.current = { url, kind };   // subito, non al prossimo render: due annunci
      setCurrent(url); setCurrentKind(kind);  // ravvicinati non devono valere entrambi "media nuovo"
      return;
    }
    if (kind === "video") syncTo(s);
  };
  const syncTo = (s: Record<string, unknown> | null) => {
    const v = videoRef.current; if (!v || !s) return;
    applyingRef.current = true;
    if (typeof s.rate === "number") v.playbackRate = s.rate;
    const playing = !!s.playing;
    // compensazione latenza: se in play, la posizione reale dell'host è un filo avanti
    const time = (Number(s.time) || 0) + (playing ? 0.25 : 0);
    // seek SOLO su desincronizzazioni evidenti (evita gli scatti da correzioni continue)
    if (Math.abs(v.currentTime - time) > 1.2) { try { v.currentTime = time; } catch { /* not ready */ } }
    if (playing && v.paused) {
      // ── QUI IL "PLAY" DEL PRESENTATORE MORIVA IN SILENZIO ──────────────────
      //  Il rifiuto del browser veniva ingoiato da un catch vuoto. Se il video
      //  dell'ospite non è muto, la riproduzione automatica è VIETATA senza un
      //  suo gesto: la promessa veniva rifiutata e non succedeva più niente.
      //  Ora si riprova SUBITO in muto — così il video parte comunque — e
      //  compare il pulsante per attivare l'audio.
      v.play().catch(() => {
        v.muted = true;
        v.play().catch(() => {});
        setNeedTap(true);
      });
    }
    if (!playing && !v.paused) v.pause();
    setTimeout(() => { applyingRef.current = false; }, 150);
  };

  // host: eventi del player → broadcast
  const onPlay = () => { if (!isViewer && !applyingRef.current) send("video", { ...snapshot(), playing: true }); };
  const onPause = () => { if (!isViewer && !applyingRef.current) send("video", { ...snapshot(), playing: false }); };
  const onSeeked = () => { if (!isViewer && !applyingRef.current) send("video", snapshot()); };

  const pickMedia = (v: Vid) => {
    const kind = vKind(v);
    setCurrent(v.url); setCurrentKind(kind); zp.reset();
    /* ── ⚠️ MOSTRARE UN MEDIA VUOL DIRE FAR GUARDARE IL CONTENUTO ──────────
       Segnalazione del committente: «quando condivido un media il cliente non
       lo vede, continua a vedere me».
       Ed era vero, e non c'entrava il media: la videochiamata ha delle
       modalità — griglia, «solo io», contenuti — e QUESTO tasto non ne toccava
       nessuna. Se la chiamata era rimasta su «solo io» (o sulla griglia), il
       cliente aveva la camera del consulente a tutto schermo e il media gli
       finiva DIETRO: si intravedeva sì e no l'angolo del riquadro, che è il
       «quadratino bianco» che si vedeva.
       Premere «Mostra» è già la decisione di far guardare il contenuto: dirlo
       due volte — prima cambia modalità, poi scegli il media — è una scelta
       che nessuno ricorda di fare, e quando la dimentichi non te ne accorgi
       perché dal tuo schermo il media si vede benissimo.
       ⚠️ `hostSetMode` non fa niente a chi non è il presentatore di una
        chiamata viva: fuori da una consulenza questa riga è inerte. */
    if (!isViewer) hostSetMode("content");
    //  ── SI SALE A VEDERE CIÒ CHE SI È APPENA SCELTO ────────────────────────
    //   La libreria sta sotto il riquadro: scegliendo un media dal fondo
    //   dell'elenco, quello che il cliente sta già vedendo restava fuori
    //   schermo. Si andava a naso — o si scorreva su a mano davanti al cliente,
    //   che vede il consulente armeggiare invece di parlare.
    //   Ritardato di un giro: il riquadro deve prima prendere le proporzioni
    //   del media nuovo, altrimenti si scorre verso una misura che sta per
    //   cambiare e ci si ferma nel punto sbagliato.
    requestAnimationFrame(() => {
      const el = boxRef.current;
      if (!el) return;
      try {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch {
        //  Browser che non conoscono le opzioni: meglio uno scatto secco che
        //  restare dove si era.
        el.scrollIntoView();
      }
    });
    // Il cliente non deve cliccare nulla: la foto compare subito, il video PARTE
    // da solo (playing: true) sia qui che sul suo dispositivo.
    const playing = kind === "video";
    setTimeout(() => {
      if (playing) videoRef.current?.play().catch(() => {});
      send("video", { ...snapshot(), url: v.url, kind, time: 0, playing, rate: 1 });
      send("mediazoom", { scale: 1, tx: 0, ty: 0 });
    }, 60);
  };

  /** ── ⚠️ AVANTI E INDIETRO SENZA TORNARE OGNI VOLTA NELLA LIBRERIA ──────
   *  Richiesta del committente: «nella sezione media ci sia un pulsante per
   *  passare alla foto successiva o precedente senza che clicco Mostra ogni
   *  volta».
   *  Per cambiare foto bisognava scendere nell'elenco, ritrovare la riga giusta
   *  e premere «Mostra»: con venti media, e il cliente che guarda, sono tre
   *  gesti e due secondi di silenzio per ogni foto — moltiplicati per tutta la
   *  consulenza. Le due frecce fanno la stessa identica cosa (`pickMedia`, cioè
   *  anche il passaggio alla modalità contenuti e l'annuncio al cliente), ma
   *  sul media accanto a quello in mostra.
   *  ⚠️ L'ordine è quello della LIBRERIA, cioè quello che il consulente vede e
   *   riordina con le frecce delle righe: un secondo ordine tutto suo vorrebbe
   *   dire un «successivo» che non è quello scritto sotto.
   *  ⚠️ NON GIRA IN TONDO. Arrivato in fondo il tasto si spegne invece di
   *   ripartire dalla prima: in consulenza si scorre una sequenza, e tornare
   *   all'inizio senza accorgersene vuol dire rimostrare al cliente una foto
   *   già vista credendo di averne trovata una nuova. Il contatore «3 di 12»
   *   lo dice a colpo d'occhio. */
  const indiceInMostra = current ? videos.findIndex((v) => v.url === current) : -1;
  const vaiAlMedia = (passo: 1 | -1) => {
    if (!videos.length) return;
    //  Senza niente in mostra, «avanti» apre il primo e «indietro» l'ultimo:
    //  è la cosa che ci si aspetta premendo una freccia su una libreria ferma.
    const i = indiceInMostra < 0 ? (passo === 1 ? 0 : videos.length - 1) : indiceInMostra + passo;
    const v = videos[i];
    if (v) pickMedia(v);
  };

  const addUrl = async () => {
    const url = urlInput.trim(); if (!url) return;
    const kind = kindOf(url);
    //  Prima si scarica l'ordine in sospeso: la risposta qui sotto porta la lista
    //  intera e cancellerebbe lo spostamento appena fatto.
    if (!(await scaricaOrdine())) avvisaOrdinePerso();
    try {
      const r = await fetch("/api/presenter/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: kind === "image" ? "Foto" : "Video", url, kind }) });
      const j = (await r.json().catch(() => null)) as RispostaLibreria | null;
      if (!r.ok || !j?.ok) { toast.error("Non sono riuscito ad aggiungere il media. Riprova."); return; }
      adottaLista(j); setUrlInput(""); toast.success(kind === "image" ? "Foto aggiunta" : "Video aggiunto");
    } catch {
      toast.error("Non sono riuscito ad aggiungere il media. Riprova.");
    }
  };
  const removeVid = async (url: string) => {
    if (!(await scaricaOrdine())) avvisaOrdinePerso();
    try {
      const r = await fetch(`/api/presenter/videos?url=${encodeURIComponent(url)}`, { method: "DELETE" });
      const j = (await r.json().catch(() => null)) as RispostaLibreria | null;
      if (!r.ok || !j?.ok) { toast.error("Non sono riuscito a rimuovere il media. Riprova."); return; }
      adottaLista(j);
      //  Un media cancellato non può restare dentro un link ancora da generare:
      //  finirebbe nella raccolta come indirizzo morto.
      setSelezione((s) => s.filter((u) => u !== url));
    } catch {
      toast.error("Non sono riuscito a rimuovere il media. Riprova.");
    }
  };

  // ── LA RACCOLTA E IL SUO LINK ─────────────────────────────────────────────
  //  ⚠️ DIVIETO, e non è una raccomandazione: questo numero è un'IDENTITÀ, non
  //  una posizione in elenco. Nasce da `selezione`, cioè dall'ordine in cui si è
  //  spuntato, e per questo il numero 3 viaggia attaccato alla sua foto ovunque
  //  la si sposti nella libreria. Derivarlo dall'indice di libreria — che è la
  //  cosa che verrà in mente a chiunque veda le frecce qui accanto — è l'unica
  //  strada che fa partire al cliente un carosello diverso da quello costruito.
  const posizioneIn = (url: string) => selezione.indexOf(url) + 1;   // 0 = non spuntato
  const alternaSpunta = (url: string) =>
    setSelezione((s) => (s.includes(url) ? s.filter((u) => u !== url) : s.length >= MAX_VOCI ? s : [...s, url]));

  //  ── SPUNTARE UN BLOCCO INTERO: MAIUSC + CLIC ────────────────────────────
  //   Una libreria di trenta foto si spunta una per una, trenta clic. Maiusc e
  //   clic prende tutto ciò che sta fra l'ultima spuntata e questa — è il gesto
  //   che chiunque conosce dagli elenchi di file, quindi non va spiegato.
  //   L'ANCORA è l'ULTIMA spuntata, non la prima: dopo un blocco si continua da
  //   dove si è arrivati, che è il modo in cui si lavora davvero.
  //   L'ordine di aggiunta conta — è quello con cui il cliente li vedrà nel
  //   carosello — quindi il blocco si aggiunge nell'ordine in cui compare
  //   nell'elenco, e i già spuntati NON si ripetono né cambiano posto.
  const ultimaSpuntata = useRef<string | null>(null);

  const spuntaFinoA = (url: string) => {
    const elenco = videos.map((v) => v.url);
    const ancora = ultimaSpuntata.current;
    const da = ancora ? elenco.indexOf(ancora) : -1;
    const a = elenco.indexOf(url);
    //  Senza un'ancora valida (prima spunta, o media cancellato nel frattempo)
    //  Maiusc+clic vale come un clic normale: meglio un gesto che fa poco di
    //  uno che seleziona mezza libreria per sbaglio.
    if (da < 0 || a < 0) {
      ultimaSpuntata.current = url;
      alternaSpunta(url);
      return;
    }
    const blocco = elenco.slice(Math.min(da, a), Math.max(da, a) + 1);
    setSelezione((s) => {
      const fuori = blocco.filter((u) => !s.includes(u));
      //  Il limite non si sfonda: si prende quanto ci sta e si dice quanti sono
      //  rimasti fuori, invece di troncare in silenzio.
      const spazio = MAX_VOCI - s.length;
      if (spazio <= 0) {
        toast.error(`Il link tiene al massimo ${MAX_VOCI} media.`);
        return s;
      }
      if (fuori.length > spazio) {
        toast.warning(`Aggiunti ${spazio} media: il link ne tiene al massimo ${MAX_VOCI}.`);
      }
      return [...s, ...fuori.slice(0, spazio)];
    });
    ultimaSpuntata.current = url;
  };

  const spunta = (url: string, conMaiusc: boolean) => {
    if (conMaiusc) return spuntaFinoA(url);
    ultimaSpuntata.current = url;
    alternaSpunta(url);
  };

  // ══ RIORDINARE LA LIBRERIA ═════════════════════════════════════════════════
  //
  //  ── PERCHÉ DUE FRECCE E NON UN TRASCINAMENTO ────────────────────────────
  //   Il commento poco più su ("perché si spunta e non si trascina") non è stato
  //   superato: vale parola per parola anche qui. La libreria si usa DURANTE la
  //   consulenza, spesso dal trackpad, davanti al cliente.
  //   E c'è una ragione tecnica in più, che allora non era in gioco: il
  //   `pointerdown` che farebbe partire un trascinamento è LO STESSO che arma la
  //   pressione lunga di "Mostra", ogni uscita dal bersaglio chiama
  //   `fermaPressione`, e il `touch-action: none` che protegge quella pressione
  //   dallo scorrimento vive SOLO su quel pulsante. Un trascinamento qui non
  //   sarebbe una funzione in più: sarebbe la fine di quella che c'è già.
  //   Con due frecce ogni disposizione è comunque raggiungibile, un clic per
  //   passo, da mouse, da dito e da tastiera.
  //
  //  ── ⚠️ LA CONVIVENZA COL GESTO DEL LINK, PER CHI PASSA DI QUI FRA SEI MESI ─
  //   Le frecce ascoltano SOLO `onClick`. Niente `onPointerDown`, niente
  //   `onPointerUp/Leave/Cancel`, niente `touchAction: "none"`, nessun timer,
  //   nessuna durata da azzeccare. Da questo discende tutto il resto:
  //    · il puntatore è UNO: se è premuto su "Mostra" non può nascere un clic su
  //      una freccia, quindi non esiste la sequenza in cui l'elenco si muove
  //      sotto un dito premuto (è esattamente la proprietà che un trascinamento
  //      avrebbe distrutto per costruzione);
  //    · se il dito parte da "Mostra" e scivola su una freccia, il
  //      `pointerleave` di "Mostra" spegne il timer come ha sempre fatto e il
  //      clic atterra sulla freccia: sposta la riga e basta, nessun link;
  //    · `oraDelGesto` NON viene toccato da qui — né azzerato né alzato. Il
  //      riordino non entra nella finestra dei 900ms e non può mangiarsi il
  //      clic buono successivo su "Mostra";
  //    · niente `touchAction: "none"` sulle frecce: lì serve a impedire che un
  //      dito FERMO venga letto come scorrimento, qui produrrebbe solo una
  //      libreria che sul telefono non si scorre più.
  //   Le frecce stanno inoltre all'estremità SINISTRA della riga, lontane da
  //   "Mostra" e dal cestino: a sinistra sbagliare bersaglio costa una spunta,
  //   revocabile e invisibile al cliente; a destra costa un cambio di media
  //   davanti al cliente, o una cancellazione.

  /** Adotta la lista che arriva dal server come verità: elenco, firma, punto di
   *  ritorno. Ogni risposta che porta `videos` porta anche la firma dell'ordine,
   *  e vanno prese INSIEME — una firma vecchia fa nascere già rifiutato il
   *  riordino successivo. */
  const adottaLista = (j: RispostaLibreria | null) => {
    const vera = listaValida(j?.videos);
    ordineConfermatoRef.current = vera;
    if (typeof j?.firma === "string" && j.firma) { firmaRef.current = j.firma; setOrdinePronto(true); }
    //  ⚠️ QUI UNO SPOSTAMENTO SI PERDEVA, IN SILENZIO, ED È IL MOTIVO PER CUI
    //  questa riga non è più un semplice `setVideos`. Quello che arriva è la
    //  verità sull'INSIEME dei media, non sull'ordine più recente: se il
    //  consulente ha mosso una riga mentre questa risposta era per strada,
    //  scriverla e basta gliela fa tornare indietro da sola, senza una parola.
    //  E il caso non è di laboratorio, è a un clic di distanza: si sta
    //  rinominando una riga e si clicca la freccia di un'altra. Quel clic fa
    //  partire PRIMA il salvataggio del nome (è il blur, che arriva col tasto
    //  premuto) e POI lo spostamento; `scaricaOrdine` era già passato, quindi
    //  la risposta della rinomina torna dopo e si porta via la freccia appena
    //  premuta. Si rimette allora l'ordine a schermo SOPRA la lista vera, con
    //  la stessa regola del server: l'insieme resta quello di `vera` — chi è
    //  stato cancellato altrove non risorge, chi è appena nato compare — e
    //  cambia solo la fila. Il punto di ritorno resta `vera`, perché è l'ultimo
    //  ordine che il server ha davvero accettato.
    const mostrata = daSalvare.current ? permutaSecondo(vera, videosRef.current.map((v) => v.url)) : vera;
    setVideos(mostrata);
    videosRef.current = mostrata;
    presa.current = null;   // la lista è cambiata sotto: la presa non ha più senso
    return mostrata;
  };

  /** UNA spedizione dell'ordine. Non solleva mai: torna `false` quando l'ordine
   *  a schermo è stato riportato a quello salvato (cioè quando lo spostamento
   *  del consulente è andato perso, e va detto). Con `zitto` le parole le dice
   *  il chiamante, per non impilare due toast sullo stesso gesto. */
  const spedisciOrdine = async (zitto: boolean): Promise<boolean> => {
    if (!daSalvare.current || riordinoNegatoRef.current || !firmaRef.current) return true;
    const tentato = videosRef.current;
    const ordine = tentato.map((v) => v.url);
    daSalvare.current = false;
    setSpiaOrdine("salvo");

    /** Torna all'ultimo ordine che il server ha accettato. */
    const indietro = (motivo: string, conRiprova: boolean) => {
      const salvato = ordineConfermatoRef.current;
      setVideos(salvato);
      videosRef.current = salvato;
      presa.current = null;
      //  L'ancora di Maiusc+clic si azzera SOLO qui e nel 409, cioè quando la
      //  lista SALTA tutta insieme. Dopo uno spostamento di una posizione no:
      //  l'ancora resta a un passo da dov'era e il blocco resta quello che si
      //  vede — azzerarla ogni volta costerebbe un clic in più per un pericolo
      //  che questo gesto non produce.
      ultimaSpuntata.current = null;
      if (timerOrdine.current) { clearTimeout(timerOrdine.current); timerOrdine.current = null; }
      daSalvare.current = false;
      setSpiaOrdine("");
      if (zitto) return;
      toast.error(motivo, conRiprova ? {
        //  "Riprova" rispedisce lo STESSO ordine, con la stessa firma (il server
        //  non l'ha accettato, quindi non è cambiata).
        action: {
          label: "Riprova",
          onClick: () => {
            setVideos(tentato);
            videosRef.current = tentato;
            daSalvare.current = true;
            catenaOrdine.current = catenaOrdine.current.then(() => spedisciOrdine(false), () => spedisciOrdine(false));
          },
        },
      } : undefined);
    };

    try {
      const r = await fetch("/api/presenter/videos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        //  ⚠️ SOLO URL, MAI OGGETTI. Il server non deve imparare da questo corpo
        //  che COS'È un media: legge la sua lista e la permuta. Così una voce che
        //  qui non si conosce non può essere creata (una scheda aperta da ieri
        //  farebbe risorgere i media cancellati nel frattempo, spesso con il file
        //  già rimosso dallo Storage: miniature rotte davanti al cliente) e una
        //  voce che qui non si nomina non può essere distrutta. In più il
        //  riordino non diventa una quarta via per rinominare o cambiare url,
        //  scavalcando i controlli della rinomina.
        body: JSON.stringify({ ordine, firma: firmaRef.current }),
      });
      const j = (await r.json().catch(() => null)) as RispostaLibreria | null;

      if (r.ok && j?.ok) {
        const vera = listaValida(j.videos);
        if (typeof j.firma === "string" && j.firma) { firmaRef.current = j.firma; setOrdinePronto(true); }
        ordineConfermatoRef.current = vera;
        //  Se nel frattempo il consulente ha spostato ancora, l'ordine a schermo
        //  è più recente di quello appena salvato: si rimette il suo SOPRA la
        //  lista vera, invece di fargli sparire sotto gli occhi l'ultimo
        //  spostamento appena fatto.
        const mostrata = daSalvare.current ? permutaSecondo(vera, videosRef.current.map((v) => v.url)) : vera;
        setVideos(mostrata);
        videosRef.current = mostrata;
        setSpiaOrdine("fatto");
        if (timerSpia.current) clearTimeout(timerSpia.current);
        timerSpia.current = setTimeout(() => setSpiaOrdine(""), 1500);
        //  Se c'è ancora qualcosa da salvare l'attesa l'ha già armata il clic che
        //  l'ha prodotto: ri-armarla qui la farebbe ripartire da capo ad ogni
        //  risposta, cioè allontanare il salvataggio proprio mentre il consulente
        //  continua a lavorare. Si programma solo se nessuno l'ha già fatto.
        if (daSalvare.current && !timerOrdine.current) programmaSalvataggio();
        return true;
      }

      if (r.status === 401 || r.status === 403) {
        //  Il diritto di scrivere sulla libreria non è per tutti: lo si scopre
        //  una volta sola, non ad ogni clic davanti al cliente.
        riordinoNegatoRef.current = true;
        setRiordinoNegato(true);
        indietro("Il tuo accesso non permette di cambiare la libreria: serve l'accesso pieno.", false);
        return false;
      }

      if (r.status === 409) {
        //  Un'altra scheda ha cambiato la libreria. L'operazione non è fallita:
        //  è che lo spostamento riguardava un elenco che non c'è più. Si adotta
        //  quello vero — mentire qui vorrebbe dire mettere la riga in un posto
        //  diverso da quello che il consulente stava guardando.
        const vera = adottaLista(j);
        setSelezione((s) => s.filter((u) => vera.some((v) => v.url === u)));
        ultimaSpuntata.current = null;
        if (timerOrdine.current) { clearTimeout(timerOrdine.current); timerOrdine.current = null; }
        setSpiaOrdine("");
        //  ⚠️ `daSalvare` NON si spegne qui, e la differenza si vede in un caso
        //  solo — ma è un caso che lascia il consulente con una bugia sotto gli
        //  occhi. Se ha spostato ancora MENTRE questa richiesta era per strada,
        //  quello spostamento è appena rimasto a schermo (glielo tiene
        //  `adottaLista`) e non è nel database: spegnendo la bandiera resterebbe
        //  lì, visibile e non salvato, fino a sparire al prossimo ricaricamento
        //  senza che nessuno abbia detto niente. Adesso però una firma buona c'è
        //  — è quella appena arrivata col rifiuto — quindi si risalva.
        if (daSalvare.current) programmaSalvataggio();
        //  La frase non promette quale dei due casi sia toccato — lo spostamento
        //  rifiutato si è perso, quello fatto DOPO è ancora lì e si sta
        //  risalvando — perché una frase che sceglie per lui sarebbe giusta metà
        //  delle volte. Dice invece l'unica cosa vera in entrambi: guarda
        //  l'elenco adesso.
        if (!zitto) toast.warning("La libreria è cambiata da un'altra scheda: ho ricaricato l'elenco aggiornato — controlla la disposizione, lo spostamento potrebbe essere da rifare.");
        return false;
      }

      if (j?.reason === "troppe_voci") {
        indietro("La libreria è troppo lunga per essere riordinata: sono più di 300 media.", false);
        return false;
      }
      indietro("Non sono riuscito a salvare la disposizione della libreria.", true);
      return false;
    } catch {
      indietro("Non sono riuscito a salvare la disposizione della libreria.", true);
      return false;
    }
  };

  /** Mette una spedizione in coda a quella eventualmente in volo. Chi arriva e
   *  non trova niente da salvare esce subito: così "una in volo, una in attesa"
   *  è una conseguenza, non una contabilità da tenere. */
  const accodaOrdine = (zitto: boolean) => {
    catenaOrdine.current = catenaOrdine.current.then(() => spedisciOrdine(zitto), () => spedisciOrdine(zitto));
    return catenaOrdine.current;
  };

  /** Salvataggio ritardato: chi sposta tre volte di fila la stessa foto fa UNA
   *  richiesta, non tre. */
  const programmaSalvataggio = () => {
    if (timerOrdine.current) clearTimeout(timerOrdine.current);
    timerOrdine.current = setTimeout(() => { timerOrdine.current = null; void accodaOrdine(false); }, ATTESA_ORDINE_MS);
  };

  //  ⚠️ REGOLA NON OVVIA E OBBLIGATORIA: il salvataggio in sospeso si scarica
  //  PRIMA di qualunque altra scrittura sulla libreria. Aggiunta, caricamento,
  //  rinomina e cancellazione rispondono con la LISTA INTERA e qui la si ingoia:
  //  se il riordino fosse ancora dentro l'attesa, il server risponderebbe con
  //  l'ordine vecchio e lo spostamento appena fatto sparirebbe senza un errore.
  const scaricaOrdine = async (): Promise<boolean> => {
    if (timerOrdine.current) { clearTimeout(timerOrdine.current); timerOrdine.current = null; }
    return await accodaOrdine(true);
  };
  /** Se lo scarico fallisce l'altra operazione procede lo stesso — è più urgente
   *  — ma non in silenzio: l'ordine a schermo è appena tornato indietro e chi
   *  guarda deve sapere perché. */
  const avvisaOrdinePerso = () =>
    //  ⚠️ "tornata a quella salvata" era vero solo per metà dei casi: quando il
    //  rifiuto è un 409 l'elenco non torna indietro, viene SOSTITUITO con quello
    //  vero del server. Un avviso che descrive male ciò che si vede a schermo è
    //  peggio di nessun avviso, perché il consulente cerca uno spostamento che
    //  non è dove la frase gli dice di guardare.
    toast.warning("Non sono riuscito a salvare la disposizione della libreria: l'elenco è tornato a quello del server. Proseguo con l'operazione.");

  /** Sposta un media di UNA posizione. L'ordine dell'array È l'ordine a schermo:
   *  non c'è nessun altro posto in cui scriverlo. */
  const spostaMedia = (url: string, dir: -1 | 1, daTastiera: boolean): boolean => {
    if (riordinoNegato || !ordinePronto) return false;
    const prev = videosRef.current;
    const i = prev.findIndex((v) => v.url === url);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= prev.length) return false;   // agli estremi non si fa nulla, e non si chiede nulla
    const next = prev.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setVideos(next);
    //  ⚠️ Il ref si scrive A MANO e SUBITO, non lo si lascia al riallineamento
    //  del prossimo render: (i) due clic nello stesso fotogramma devono
    //  comporsi invece di annullarsi, (ii) il timer della pressione lunga legge
    //  `videosRef` per costruire il link, e non deve mai lavorare sulla lista
    //  vecchia.
    videosRef.current = next;
    daSalvare.current = true;
    daRimettereAFuoco.current = { url, dir, daTastiera };
    setAppenaMosso(url);
    if (timerAnello.current) clearTimeout(timerAnello.current);
    timerAnello.current = setTimeout(() => setAppenaMosso(""), 400);
    setAnnuncioOrdine(`“${prev[i].name}” in posizione ${j + 1} di ${next.length}.`);
    programmaSalvataggio();
    return true;
  };

  /** Il clic su una freccia. Qui vive la "presa": finché il puntatore non si
   *  muove, i clic successivi seguono il media, non il pixel. */
  const cliccaFreccia = (v: Vid, dir: -1 | 1, e: React.MouseEvent) => {
    //  `detail === 0` = attivazione da tastiera (Invio/Spazio): lì il fuoco è già
    //  sull'elemento giusto, la presa non serve e non va nemmeno consultata.
    const daTastiera = e.detail === 0;
    const p = presa.current;
    const puoAncora = (u: string) => {
      const i = videosRef.current.findIndex((x) => x.url === u);
      return i >= 0 && i + dir >= 0 && i + dir < videosRef.current.length;
    };
    //  Se il media "in presa" è ormai arrivato in fondo, la presa non deve
    //  ingoiare il clic: si torna alla riga che è stata premuta davvero.
    const bersaglio = !daTastiera && p && p.dir === dir && Date.now() - p.t < PRESA_MS && puoAncora(p.url) ? p.url : v.url;
    const mosso = spostaMedia(bersaglio, dir, daTastiera);
    //  ⚠️ Col mouse il fuoco si rimette solo se c'era DAVVERO. Safari (e il Mac
    //  in generale) non dà il fuoco a un pulsante cliccato: darglielo noi
    //  significa che la barra spaziatrice smette di scorrere l'elenco e sposta
    //  un media — un comando che parte da solo, in consulenza, senza un gesto.
    if (mosso && !daTastiera && document.activeElement !== e.currentTarget) daRimettereAFuoco.current = null;
    if (!daTastiera && mosso) presa.current = { url: bersaglio, dir, t: Date.now(), x: e.clientX, y: e.clientY };
  };

  //  Rimettere il fuoco dove era, prima che il browser disegni: senza, si
  //  riordina un passo e poi si è a piedi, perché il pulsante premuto è stato
  //  spostato nel DOM e il fuoco è finito sul <body>.
  useEffettoDiLayout(() => {
    const r = daRimettereAFuoco.current;
    if (!r) return;
    daRimettereAFuoco.current = null;
    const suo = frecciaRef.current.get(`${r.dir}:${r.url}`);
    //  Se il media ha raggiunto l'estremo la sua freccia è spenta: il fuoco va
    //  alla freccia opposta della STESSA riga, che è dov'è finito l'occhio.
    const scelto = suo && !suo.disabled ? suo : frecciaRef.current.get(`${-r.dir}:${r.url}`);
    if (!scelto || scelto.disabled) return;
    //  ⚠️ Col mouse la pagina non deve muoversi da sola: lo scorrimento
    //  appartiene a "Mostra", e due scorrimenti che si accavallano davanti al
    //  cliente fanno perdere il segno. Da tastiera invece il fuoco DEVE essere
    //  visibile, quindi si lascia che la pagina lo segua.
    scelto.focus(r.daTastiera ? undefined : { preventScroll: true });
  }, [videos]);

  //  Timer del riordino: se si cambia schermata mentre uno è vivo, scriverebbe
  //  su un componente che non c'è più. E se resta un ordine non ancora salvato
  //  parte subito, con `keepalive`, perché la richiesta sopravviva alla pagina.
  //  Nessun `beforeunload`: una finestra "sei sicuro?" per due frecce, no.
  useEffect(() => () => {
    if (timerOrdine.current) clearTimeout(timerOrdine.current);
    if (timerAnello.current) clearTimeout(timerAnello.current);
    if (timerSpia.current) clearTimeout(timerSpia.current);
    if (!daSalvare.current || !firmaRef.current || riordinoNegatoRef.current) return;
    try {
      void fetch("/api/presenter/videos", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ ordine: videosRef.current.map((v) => v.url), firma: firmaRef.current }),
      }).catch(() => {});
      //  Qui un errore non è più dicibile a nessuno: la schermata sta sparendo.
      //  È l'unico posto del file in cui un fallimento resta muto, e resta muto
      //  perché non c'è più nessuno a cui parlare.
    } catch { /* la pagina se ne sta andando */ }
  }, []);

  // ── L'UNICO PONTE VERSO L'ORDINE DEL CLIENTE ──────────────────────────────
  //  Riscrive le SPUNTE seguendo l'ordine in cui i media si vedono adesso nella
  //  libreria: stessi url, stesso insieme, solo permutati — nessuno entra,
  //  nessuno esce. Non ha inverso e non deve averlo: l'ordine delle spunte non
  //  riscrive mai la libreria, e nulla di automatico collega le due cose.
  const ordineSpunteDiverso = (() => {
    if (selezione.length < 2) return false;
    const perLibreria = videos.map((v) => v.url).filter((u) => selezione.includes(u));
    return perLibreria.length === selezione.length && perLibreria.some((u, i) => u !== selezione[i]);
  })();
  const numeraComeLibreria = () => {
    const prima = selezione;
    const inLibreria = videos.map((v) => v.url).filter((u) => prima.includes(u));
    //  Un media spuntato ma non più in libreria non va perso qui: lo toglie la
    //  cancellazione, non un pulsante che dichiara di rinumerare.
    const fuoriLibreria = prima.filter((u) => !inLibreria.includes(u));
    setSelezione([...inLibreria, ...fuoriLibreria]);
    toast.success("Link rinumerato nell'ordine della libreria", {
      action: { label: "Annulla", onClick: () => setSelezione(prima) },
    });
  };

  /** Crea la raccolta e ne copia il link. Se ci sono media spuntati il link è
   *  quello: l'elenco spuntato, nell'ordine in cui è stato spuntato. Se non c'è
   *  nessuna spunta, il link contiene il solo media da cui è partito il gesto. */
  const generaLink = async (uno?: Vid) => {
    if (creandoLink) return;
    const spuntati = selezioneRef.current
      .map((u) => videosRef.current.find((v) => v.url === u))
      .filter((v): v is Vid => !!v);
    const scelti = spuntati.length ? spuntati : uno ? [uno] : [];
    if (!scelti.length) { toast.error("Spunta prima i media da mettere nel link."); return; }

    setCreandoLink(true);
    try {
      const r = await fetch("/api/presenter/gallerie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          voci: scelti.map((v): VoceGalleria => ({ url: v.url, kind: vKind(v), nome: v.name })),
        }),
      });
      const j = (await r.json().catch(() => null)) as { ok?: boolean; url?: unknown; reason?: unknown } | null;
      if (!r.ok || !j?.ok || typeof j.url !== "string") {
        toast.error(typeof j?.reason === "string" ? j.reason : "Non sono riuscito a creare il link. Riprova.");
        return;
      }
      const link = j.url;
      const quanti = scelti.length === 1 ? "1 media" : `${scelti.length} media`;
      //  Deve essere chiaro COSA si è copiato: quanti media, e il link sotto
      //  gli occhi. Un "copiato!" da solo lascia il dubbio, e il dubbio si
      //  risolve incollando in chat per controllare — davanti al cliente.
      if (await copiaNegliAppunti(link)) toast.success(`Link copiato — ${quanti}`, { description: link });
      else toast.warning(`Link pronto — ${quanti}`, {
        description: link,
        action: { label: "Copia", onClick: () => { void copiaNegliAppunti(link); } },
      });
      // conferma anche al dito, dove c'è (telefono): il gesto lungo ha bisogno di una fine
      try { if ("vibrate" in navigator) navigator.vibrate(18); } catch { /* non tutti ce l'hanno */ }
    } catch {
      toast.error("Non sono riuscito a creare il link. Riprova.");
    } finally {
      setCreandoLink(false);
    }
  };

  // ── IL GESTO: TIENI PREMUTO ───────────────────────────────────────────────
  //  Tre cose lo rendono comodo invece che insopportabile, e sono tutte qui:
  //   · il clic normale non deve scattare insieme (vedi `oraDelGesto`);
  //   · sul telefono non deve uscire il menù di sistema né partire lo
  //     scorrimento della pagina (touch-action + contextmenu, sul pulsante);
  //   · mentre si tiene premuto si deve VEDERE che sta succedendo (il pulsante
  //     si riempie), altrimenti non si sa se funziona e si molla a metà.
  const iniziaPressione = (v: Vid) => {
    fermaPressione();
    oraDelGesto.current = 0;
    setPremuto(v.url);
    timerPressione.current = setTimeout(() => {
      timerPressione.current = null;
      oraDelGesto.current = Date.now();
      setPremuto("");
      void generaLink(v);
    }, SOGLIA_PRESSIONE_MS);
  };
  /** Dito/mouse sollevato, uscito dal pulsante o gesto annullato dal sistema:
   *  il riempimento torna a zero e il clic normale resta valido. */
  const fermaPressione = () => {
    if (timerPressione.current) { clearTimeout(timerPressione.current); timerPressione.current = null; }
    //  ⚠️ Se il gesto è GIÀ scattato, la finestra di guardia si conta DAL
    //  RILASCIO e non dallo scatto. Il clic arriva quando si alza il dito, e
    //  chi tiene premuto due secondi — cioè quasi tutti, per essere sicuri che
    //  abbia preso — lo alzava fuori dalla finestra: partiva il link E il clic
    //  normale, e il media in diretta cambiava sotto gli occhi del cliente.
    //  Resta un ORARIO e non un interruttore: se si molla il dito fuori dal
    //  pulsante il clic non arriva mai, e un interruttore rimasto acceso si
    //  mangerebbe il clic buono successivo.
    if (oraDelGesto.current) oraDelGesto.current = Date.now();
    setPremuto("");
  };
  //  Se si cambia schermata mentre si tiene premuto, il timer resterebbe vivo e
  //  scriverebbe su un componente che non c'è più.
  useEffect(() => () => { if (timerPressione.current) clearTimeout(timerPressione.current); }, []);

  // ── RINOMINA: APRI / ANNULLA / CONFERMA ───────────────────────────────────
  const apriRinomina = (v: Vid) => { annullaRef.current = false; setRinomino(v.url); setNuovoNome(v.name); };
  const chiudiRinomina = () => { setRinomino(""); setNuovoNome(""); };
  const confermaRinomina = async (v: Vid) => {
    if (annullaRef.current || salvataggioRef.current) return;   // Esc, oppure salvataggio già in corso
    const nome = nuovoNome.trim();
    // Nome vuoto: si tiene quello di prima. Lo si dice, altrimenti sembra che
    // il nome sia stato cancellato e poi ricomparso da solo.
    if (!nome) { chiudiRinomina(); toast.error("Nome vuoto: ho tenuto quello di prima."); return; }
    if (nome === v.name) { chiudiRinomina(); return; }          // nulla da salvare, nessuna chiamata
    salvataggioRef.current = true; setSalvandoNome(true);
    //  Anche la rinomina risponde con la lista intera: l'ordine in sospeso va
    //  scaricato prima, o lo spostamento appena fatto se ne va senza un errore.
    if (!(await scaricaOrdine())) avvisaOrdinePerso();
    try {
      const r = await fetch("/api/presenter/videos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: v.url, name: nome }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        // Se il media non c'è più (cancellato da un'altra scheda) il server
        // rimanda l'elenco vero: meglio allinearsi che restare a discutere con
        // una riga che non esiste.
        if (j && "videos" in j) { adottaLista(j as RispostaLibreria); chiudiRinomina(); }
        // Altrimenti la riga resta aperta: il consulente vede il testo che
        // aveva scritto e può riprovare senza doverlo ribattere.
        toast.error("Non sono riuscito a rinominare. Riprova.");
        return;
      }
      adottaLista(j as RispostaLibreria);
      chiudiRinomina();
      toast.success(`Rinominato in “${nome}”`);
    } catch {
      toast.error("Non sono riuscito a rinominare. Riprova.");
    } finally {
      salvataggioRef.current = false; setSalvandoNome(false);
    }
  };
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    //  Come sopra: la risposta che aggiunge il media porta con sé la lista
    //  intera, quindi l'ordine in sospeso va messo al sicuro prima.
    if (!(await scaricaOrdine())) avvisaOrdinePerso();
    try {
      const fd = new FormData(); fd.append("file", f);
      const j = await (await fetch("/api/presenter/upload", { method: "POST", body: fd })).json();
      if (j.ok) {
        const kind = kindOf(j.url || f.name, f.type);
        const rl = await fetch("/api/presenter/videos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: f.name, url: j.url, kind }) });
        const jl = (await rl.json().catch(() => null)) as RispostaLibreria | null;
        //  ⚠️ QUESTA RISPOSTA VA GUARDATA PRIMA DI ADOTTARLA, ed era l'unica
        //  delle quattro che non lo faceva. Se la sessione è scaduta il server
        //  risponde 401 con `{ok:false}` e nessun `videos`: adottarla significa
        //  scrivere a schermo una libreria VUOTA — tutti i media spariscono in
        //  mezzo alla consulenza — e per giunta dire "Foto caricata".
        //  Il file sullo Storage però c'è davvero, quindi la frase giusta non è
        //  "upload fallito": è caricato, non è entrato in elenco.
        if (!rl.ok || !jl?.ok) toast.error("File caricato, ma non sono riuscito ad aggiungerlo alla libreria. Ricarica la pagina e riprova.");
        else { adottaLista(jl); toast.success(kind === "image" ? "Foto caricata" : "Video caricato"); }
      } else toast.error("Upload fallito: " + (j.reason || "errore"));
    } catch { toast.error("Upload fallito"); }
    setUploading(false); e.target.value = "";
  };

  // viewer: mantiene volume al massimo quando l'audio è attivo
  useEffect(() => {
    const v = videoRef.current; if (!v || !isViewer) return;
    v.muted = !audioOn;
    if (audioOn) v.volume = 1;
  }, [audioOn, current, isViewer]);

  const enterAudio = () => {
    setNeedTap(false); setAudioOn(true);
    const v = videoRef.current;
    if (v) { v.muted = false; v.volume = 1; v.play().catch(() => {}); } // sblocca l'audio su un video già in play (muto)
    send("vhello", {}); // richiedi stato corrente
    setTimeout(() => syncTo(pendingRef.current), 250);
  };

  // OSPITE: tentativo AUTOMATICO di riproduzione con audio, senza chiedergli nulla.
  // I permessi (camera/microfono) sono già stati concessi entrando in chiamata: nella
  // stragrande maggioranza dei casi il browser consente anche l'audio. Solo se lo
  // blocca davvero mostriamo un piccolo avviso (non più una schermata a tutto schermo).
  useEffect(() => {
    if (!isViewer || !current || currentKind !== "video") return;
    const v = videoRef.current; if (!v) return;
    let cancelled = false;
    // L'audio è già stato sbloccato quando il cliente è entrato in consulenza:
    // qui non si chiede più nulla, si applica solo la scelta del presentatore.
    v.volume = 1;
    // rispetta lo stato voluto dal presentatore: se il video era in PAUSA non
    // deve partire da solo per poi essere rimesso in pausa un istante dopo
    const want = pendingRef.current ? !!pendingRef.current.playing : true;
    if (!want) { v.pause(); return () => { cancelled = true; }; }
    v.muted = !audioOn;
    v.play().then(() => { if (!cancelled) setNeedTap(false); })
      .catch(() => {
        if (cancelled) return;
        v.muted = true;                 // ripiego estremo: parte comunque, muto
        v.play().catch(() => {});
        setNeedTap(true);
      });
    return () => { cancelled = true; };
  }, [isViewer, current, currentKind, audioOn]);

  // ── dito del presentatore sul media (attivo di default, spegnibile) ───────
  const ptrOffRef = useRef(() => {});
  ptrOffRef.current = () => { setPtr((p) => (p.on ? { ...p, on: false } : p)); send("pointer", { x: 0.5, y: 0.5, on: false }); };
  const ptrGate = useRef(makePointerHysteresis(() => ptrOffRef.current()));
  const togglePointer = () => setPointerOn((v) => {
    const nv = !v; writePointerPref(nv);
    if (!nv) { ptrGate.current.forceHide(); ptrOffRef.current(); }
    else ptrGate.current.reset();
    return nv;
  });
  const onPtrMove = (e: React.PointerEvent) => {
    if (ptrGate.current.over(e.target)) return;
    const el = boxRef.current; if (!el) return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    setPtr({ x, y, on: true });
    const now = performance.now(); if (now - ptrTs.current > 70) { ptrTs.current = now; send("pointer", { x, y, on: true }); }
  };

  // ── IL MEDIA SI VEDE INTERO, NEL SUO FORMATO ──────────────────────────────
  //  Qui prima si riempiva sempre l'inquadratura ("cover"), per non lasciare
  //  bande ai lati di una foto verticale dentro una cornice orizzontale. Il
  //  ragionamento era comprensibile ma il risultato no: quello che si mostra
  //  sono RISULTATI DI TRAPIANTI, e riempire una cornice 16:9 con una foto 9:16
  //  significa tagliarla sopra e sotto — cioè mostrare al cliente mezza testa.
  //  Su desktop, dove la cornice è larga, il taglio era enorme.
  //
  //  Adesso il media si vede INTERO ("contain"), nel formato in cui è stato
  //  girato.
  //
  //  E ciò che resta attorno NON è nero. Le bande nere sono la resa di un
  //  lettore video, non di una presentazione: dicono al cliente che manca
  //  qualcosa. Attorno c'è lo sfondo di marca (.bg-brandfill: blu notte con la
  //  trama a griglia e i due aloni), che è lo stesso di tutta la schermata —
  //  così la foto sembra appoggiata sulla presentazione invece che incastrata
  //  in una cornice troppo grande.
  //
  //  In pratica: questo contenitore resta TRASPARENTE, perché è quello che si
  //  ingrandisce con lo zoom. Lo sfondo lo mette il livello esterno, che non
  //  si trasforma — altrimenti ingrandendo si ingrandirebbe anche la trama.
  //
  //  Vale per immagini e video, dal lato del cliente e dal lato del consulente:
  //  se i due vedessero ritagli diversi, "guardi qui in alto" indicherebbe due
  //  punti diversi.
  // ─────────── SPETTATORE ───────────
  if (isViewer) {
    // zoom/pan rispecchiato dal presentatore, applicato al media dell'ospite
    const gStyle: React.CSSProperties = gzoom
      ? { transform: `translate(${gzoom.tx}px, ${gzoom.ty}px) scale(${gzoom.scale})`, transformOrigin: "center center", transition: "transform .12s" }
      : {};
    return (
      <div className="bg-brandfill fixed inset-0 z-0 flex items-center justify-center overflow-hidden">
        {/*  ⚠️ QUI C'ERA UNA FASCIA BLU: «Diretta — stai vedendo la
              presentazione in tempo reale». Tolta. In una diretta lo si sa già
              — c'è scritto due volte nell'intestazione della sala — e su un
              riquadro alto duecento punti quella riga si prendeva un decimo di
              quello che c'era da guardare per dire una cosa che nessuno stava
              chiedendo. */}
        <div className="flex h-full w-full items-center justify-center" style={gStyle}>
          {currentKind === "image" ? (
            <img src={current || undefined} alt="" className="h-full w-full object-contain" draggable={false} style={{ pointerEvents: "none" }} />
          ) : (
            <video ref={videoRef} src={current || undefined} playsInline autoPlay muted={!audioOn} data-keepmuted="1"
              onError={() => reportGuestError(`Media non riproducibile sul dispositivo del cliente: ${current}`)}
              onLoadedData={() => syncTo(pendingRef.current)} onCanPlay={() => syncTo(pendingRef.current)}
              className="h-full w-full object-contain" style={{ pointerEvents: "none" }} />
          )}
        </div>
        {/* Marchio sul media: sta FUORI dal livello con `gStyle` (quello che si
            trasforma con lo zoom del presentatore), così resta ancorato
            all'angolo dello schermo del cliente anche quando il media viene
            ingrandito o trascinato. Solo con un media in mostra: sulla
            schermata d'attesa non c'è nulla da marchiare. */}
        {!!current && <MarchioSuMedia />}
        {/* dito del presentatore, animato a 60fps fra le posizioni ricevute */}
        <PointerDot target={ptr} />
        {/* Nessun media ancora scelto: schermata d'attesa brandizzata, MAI un
            pulsante da toccare (il cliente non deve fare nulla). */}
        {!current && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-white/70">
            <Images className="h-9 w-9 text-brand" />
            <span className="text-sm font-medium">Un attimo, sto preparando il contenuto…</span>
          </div>
        )}
        {/* Avviso discreto solo se il browser ha davvero bloccato l'audio */}
        {needTap && current && currentKind === "video" && (
          <button onClick={enterAudio}
            className="fixed inset-x-0 bottom-6 z-30 mx-auto flex w-max items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-xl">
            <Volume2 className="h-4 w-4" /> Attiva l'audio
          </button>
        )}
        <Toaster />
      </div>
    );
  }

  // ─────────── PRESENTATORE ───────────
  if (gated) return <div className="bg-blueprint min-h-screen" />;
  const boxWrap = full ? "fixed inset-0 z-[140] flex items-center justify-center bg-blueprint p-3 sm:p-6" : "";
  const mediaBox = (
    <div className={boxWrap || undefined}>
      <div ref={(el) => { boxRef.current = el; zp.attachHost(el); }}
        // stesse proporzioni dello schermo del cliente — vale per FOTO e VIDEO
        style={full ? undefined : { aspectRatio: String(previewRatio), maxHeight: "62vh", width: "auto", maxWidth: "100%" }}
        className={`relative mb-2 mx-auto flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-brandfill ${zp.zoomed ? "cursor-grab touch-none active:cursor-grabbing" : ""} ${full ? "mb-0 h-[86vh] max-h-[86vh] w-auto max-w-[96vw]" : ""}`}
        onWheel={zp.onWheel}
        onPointerDown={zp.panHandlers.onPointerDown}
        onPointerMove={(e) => { zp.panHandlers.onPointerMove(e); if (pointerOn) onPtrMove(e); }}
        onPointerUp={zp.panHandlers.onPointerUp}
        onPointerLeave={() => { zp.panHandlers.onPointerUp(); if (pointerOn) { ptrGate.current.forceHide(); ptrOffRef.current(); ptrGate.current.reset(); } }}>
        {current ? (
          <div className="flex h-full w-full items-center justify-center" style={zp.style}>
            {currentKind === "image" ? (
              <img src={current} alt="" className="h-full w-full object-contain" draggable={false} />
            ) : (
              <video ref={videoRef} src={current} controls playsInline muted={!!liveId && !hostAudio} data-keepmuted="1"
                className="h-full w-full object-contain"
                // Clic sul video = pausa / ripresa (come su YouTube), rispecchiato
                // sull'ospite dagli eventi onPlay/onPause. Si ignora la fascia
                // bassa dove stanno i comandi nativi, altrimenti ogni clic sulla
                // barra farebbe anche play/pausa.
                onClick={(e) => {
                  const v = videoRef.current; if (!v) return;
                  const r = (e.currentTarget as HTMLVideoElement).getBoundingClientRect();
                  if (e.clientY > r.bottom - 44) return;
                  if (v.paused) v.play().catch(() => {}); else v.pause();
                }}
                onPlay={onPlay} onPause={onPause} onSeeked={onSeeked} onRateChange={onSeeked} />
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 text-white/40"><Images className="h-6 w-6" /> Seleziona un media da mostrare</div>
        )}
        {/* Stesso marchio, stesso angolo, stesse distanze dell'ospite: se
            l'anteprima non lo mostrasse (o lo mostrasse altrove) il consulente
            non saprebbe cosa sta davvero vedendo il cliente. Anche qui è fuori
            dal livello con `zp.style`, quindi non si ingrandisce con lo zoom. */}
        {!!current && <MarchioSuMedia />}
        {/* anche il presentatore vede il proprio dito, così sa cosa sta indicando */}
        {pointerOn && <PointerDot target={ptr} />}
        {current && <ZoomControls zp={zp} onFull={() => setFull((f) => !f)} full={full} pointerOn={pointerOn} onTogglePointer={togglePointer} />}
      </div>
      {/* ── ⚠️ LE DUE FRECCE, SOTTO IL RIQUADRO ──────────────────────────────
          Richiesta del committente: passare alla foto successiva o precedente
          senza tornare ogni volta nell'elenco a premere «Mostra».
          Stanno QUI e non dentro il riquadro: sopra il media coprirebbero
          proprio quello che il cliente sta guardando, e in mezzo allo zoom si
          premerebbero per sbaglio trascinando. Sotto, larghe, e con in mezzo il
          punto in cui si è — «3 di 12» — che è l'unica cosa che dice quanto
          manca alla fine.
          ⚠️ Non compaiono con un media solo: due frecce spente sono un comando
           che non si capisce a cosa serva. */}
      {!isViewer && videos.length > 1 && (
        <div className="mb-2 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => vaiAlMedia(-1)}
            disabled={indiceInMostra <= 0}
            title="Mostra il media precedente della libreria"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[12.5px] font-medium text-white/85 transition enabled:hover:bg-white/10 disabled:opacity-35"
          >
            <ChevronLeft className="h-4 w-4" /> Precedente
          </button>
          <span className="min-w-[5.5rem] text-center text-[12px] tabular-nums text-white/55">
            {indiceInMostra >= 0 ? `${indiceInMostra + 1} di ${videos.length}` : `${videos.length} media`}
          </span>
          <button
            type="button"
            onClick={() => vaiAlMedia(1)}
            disabled={indiceInMostra >= videos.length - 1}
            title="Mostra il media successivo della libreria"
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-[12.5px] font-medium text-white/85 transition enabled:hover:bg-white/10 disabled:opacity-35"
          >
            Successivo <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-blueprint min-h-screen text-white">
      <PresenterBar page="presenta" />
      <main className="mx-auto w-full max-w-6xl px-4 py-6">
        {mediaBox}
        {!!liveId && current && currentKind === "video" && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-brand/25 bg-brand/[0.06] px-3 py-2 text-xs text-white/70">
            <Volume2 className="h-4 w-4 text-brand" />
            <span>In diretta l'audio arriva <b className="text-white">pulito e forte sul telefono del cliente</b>. Il tuo video è in muto per non sovrapporsi all'audio della chiamata.</span>
            <button type="button"
              onClick={() => { const n = !guestAudio; setGuestAudio(n); guestAudioRef.current = n; send("video", { ...snapshot(), gaudio: n }); }}
              className={`ml-auto rounded-lg border px-2.5 py-1 font-medium ${guestAudio ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200" : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"}`}>
              {guestAudio ? "Audio al cliente: ATTIVO" : "Audio al cliente: muto"}
            </button>
            <button type="button" onClick={() => setHostAudio((a) => !a)}
              className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 font-medium text-white/80 hover:bg-white/10">
              {hostAudio ? "Silenzia qui" : "Ascolta anche tu"}
            </button>
          </div>
        )}

        {/* ── ⚠️ IL LINK «SOLO I MEDIA» ─────────────────────────────────────
            Richiesta del committente: «aggiungi un link solo per i media che
            posso condividere, come se stesse dentro».
            Fin qui per far vedere una foto a qualcuno bisognava portarlo dentro
            la videochiamata — camera, microfono, una stanza in cui entrare —
            oppure mandargli la raccolta statica, che però non la guida
            nessuno: lui scorre da solo e tu non sai cosa sta guardando.
            Questo è il gemello del «link preventivo»: il cliente apre e vede
            quello che stai mostrando TU, con il tuo zoom e il tuo dito, senza
            entrare da nessuna parte.
            ⚠️ Sta SOPRA la libreria, non dentro il menu dei link della barra:
             è il gesto che si fa PRIMA di cominciare a mostrare, e chi apre
             questa pagina è venuto qui per i media. */}
        {!isViewer && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-white/70">
            <Images className="h-4 w-4 flex-shrink-0 text-brand" />
            <span>
              Il cliente non deve entrare in videochiamata per vedere le foto:{" "}
              <b className="text-white">mandagli questo link</b> e gli scorri tu il carosello,
              con lo zoom e il dito che stai usando adesso.
            </span>
            <button
              type="button"
              onClick={() =>
                copyLink(linkMedia(), "Link dei media copiato — il cliente vedrà quello che mostri tu")
              }
              title="Copia il link che mostra al cliente, in diretta, i media che stai mostrando. Niente camera, niente microfono, nessuna stanza in cui entrare."
              className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/15 px-2.5 py-1.5 font-medium text-white transition hover:bg-brand/25"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Link solo media
            </button>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* libreria */}
          <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold">Libreria media</h2>
              {/* La spia del salvataggio dell'ordine: testo e basta, nessuna
                  rotellina. E soprattutto NESSUN pulsante spento mentre salva —
                  un comando che si spegne per due decimi di secondo, in
                  consulenza, si clicca due volte e non si capisce perché la
                  seconda non ha preso. */}
              {spiaOrdine && (
                <span className="text-[11px] text-white/40">{spiaOrdine === "salvo" ? "Salvo…" : "Ordine salvato"}</span>
              )}
            </div>
            {/* Il gesto c'è (nome cliccabile + matita) ma va detto una volta:
                nessuno prova a cliccare un nome se non sa che si può. */}
            <p className="mt-1 text-[11px] text-white/40">Clicca il nome (o la matita) per rinominare — <b className="text-white/60">Invio</b> conferma, <b className="text-white/60">Esc</b> annulla.</p>
            {/* Il gesto della pressione lunga non si scopre da solo: va scritto
                una volta, qui, dove si guarda comunque. Su telefono il
                suggerimento al passaggio del mouse non esiste, quindi questa
                riga è l'unico posto in cui il gesto viene detto. */}
            <p className="mb-3 mt-1 text-[11px] text-white/40">
              Spunta i media (l'ordine è quello delle spunte) e <b className="text-white/60">tieni premuto “Mostra”</b> per creare e copiare un link da mandare al cliente.
            </p>
            {/* ⚠️ L'unico posto in cui i due significati di "disposizione"
                vengono distinti A PAROLE, e serve: nessuna icona al mondo può
                dire quello che una funzione NON fa. Con un media solo non c'è
                niente da riordinare e la riga sarebbe rumore. */}
            {videos.length >= 2 && (
              <p className="mb-3 -mt-2 text-[11px] text-white/40">
                {/* ⚠️ Quando le frecce sono spente questa riga NON deve promettere
                    un gesto che non funziona: un comando morto senza motivo si
                    legge come un guasto, e il motivo non può stare in un `title`
                    perché i pulsanti spenti non ricevono il puntatore e il
                    suggerimento non compare mai. Il toast lo dice una volta, e
                    chi non l'ha visto resterebbe senza spiegazione per l'intera
                    consulenza: qui la spiegazione resta sotto gli occhi. */}
                {riordinoNegato ? (
                  <>Le frecce a sinistra sono <b className="text-white/60">spente</b>: il tuo accesso non permette di cambiare l'ordine della libreria.</>
                ) : !ordinePronto ? (
                  <>Le frecce a sinistra sono <b className="text-white/60">spente</b> finché la libreria non ha finito di caricare — se restano così, ricarica la pagina.</>
                ) : (
                  <>Le frecce a sinistra cambiano l'ordine della <b className="text-white/60">libreria</b>. L'ordine con cui il cliente vedrà i media resta quello delle <b className="text-white/60">spunte</b>.</>
                )}
              </p>
            )}

            {selezione.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand/30 bg-brand/[0.07] px-3 py-2 text-xs text-white/75">
                <Link2 className="h-4 w-4 flex-shrink-0 text-brand" />
                <span>
                  <b className="text-white">{selezione.length}</b> media nel link, nell'ordine in cui li hai spuntati.
                </span>
                {/* Il gesto lungo non si fa con la tastiera e non si fa con lo
                    schermo letto ad alta voce: qui c'è la stessa azione, in un
                    pulsante normale. */}
                <button type="button" disabled={creandoLink} onClick={() => void generaLink()}
                  className="ml-auto inline-flex items-center gap-1 rounded-lg border border-brand bg-brand/15 px-2.5 py-1 font-medium text-white hover:bg-brand/25 disabled:opacity-50">
                  <Check className="h-3.5 w-3.5" /> {creandoLink ? "Creo il link…" : "Crea e copia il link"}
                </button>
                <button type="button" onClick={() => setSelezione([])}
                  className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 font-medium text-white/70 hover:bg-white/10">
                  Svuota
                </button>
                {/* Il ponte fra le due disposizioni, e si attraversa solo
                    premendolo. Stesso peso di "Svuota" e MAI il colore di
                    marca: la memoria muscolare di "Crea e copia il link" non si
                    sposta. Compare solo quando i due ordini differiscono
                    davvero, altrimenti è un pulsante che non fa niente. */}
                {/* ⚠️ Il nome dice COSA CAMBIA, non che gesto è. È l'unico
                    comando dell'intera funzione che tocca l'ordine del CLIENTE:
                    "Numera come li vedi" suonava come una sistemata ai numeri
                    davanti a sé, cioè innocua, e in chiamata il nome è l'unica
                    cosa che si legge — il `title` lo vede solo chi si ferma ad
                    aspettarlo, e chi si ferma ad aspettarlo non è in consulenza. */}
                {ordineSpunteDiverso && (
                  <button type="button" onClick={numeraComeLibreria}
                    title="Rinumera i media spuntati nell'ordine in cui li vedi nella libreria: cambia l'ordine che vedrà il cliente"
                    className="rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 font-medium text-white/70 hover:bg-white/10">
                    Rinumera il link come la libreria
                  </button>
                )}
              </div>
            )}
            {videos.length === 0 ? (
              <p className="text-sm text-white/45">Nessun media. Aggiungi una foto o un video da URL o caricalo.</p>
            ) : (
              <div
                className="space-y-2"
                //  La presa cade appena il puntatore si MUOVE davvero: un
                //  `pointermove` con le stesse coordinate (i browser ne mandano
                //  quando il contenuto scorre sotto il cursore fermo) non conta,
                //  ed è per questo che si confrontano i pixel e non gli eventi.
                onPointerMove={(e) => {
                  const p = presa.current;
                  if (p && (Math.abs(e.clientX - p.x) > 6 || Math.abs(e.clientY - p.y) > 6)) presa.current = null;
                }}
                //  Un clic che non è su una freccia chiude la presa: si sta
                //  facendo altro. In fase di CATTURA, così arriva prima del clic
                //  sulla freccia e non gli porta via la presa che gli serve.
                onClickCapture={(e) => {
                  if (!(e.target as HTMLElement).closest?.("[data-freccia]")) presa.current = null;
                }}
              >
                {videos.map((v, i) => {
                  const k = vKind(v);
                  const inModifica = rinomino === v.url;
                  const pos = posizioneIn(v.url);
                  //  Le frecce si spengono se manca la firma (non si potrebbe
                  //  salvare in sicurezza), se il server ha già detto di no, e
                  //  ⚠️ sulla riga che si sta rinominando: lì spostare il nodo
                  //  toglierebbe il fuoco all'<input> e farebbe scattare il blur
                  //  — cioè un salvataggio del nome che nessuno ha chiesto.
                  const frecceSpente = !ordinePronto || riordinoNegato || inModifica;
                  return (
                    <div key={v.url} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${appenaMosso === v.url ? "ring-1 ring-brand " : ""}${pos > 0 ? "border-brand/60 bg-brand/[0.07]" : current === v.url ? "border-brand bg-brand/10" : "border-white/10 bg-white/[0.02]"}`}>
                      {/* La casella porta il NUMERO invece della spunta: è
                          l'ordine in cui il cliente vedrà i media, e scritto
                          così non è una regola da ricordare, si legge. */}
                      <button type="button" role="checkbox" aria-checked={pos > 0}
                        onClick={(e) => spunta(v.url, e.shiftKey)}
                        title={
                          pos > 0
                            ? `Nel link, posizione ${pos} · Maiusc+clic per spuntare fino a qui`
                            : "Aggiungi al link condivisibile · Maiusc+clic per spuntare un blocco"
                        }
                        aria-label={pos > 0 ? `${v.name}: nel link in posizione ${pos}` : `Aggiungi ${v.name} al link condivisibile`}
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border text-[11px] font-bold transition ${pos > 0 ? "border-brand bg-brand text-white" : "border-white/25 text-white/30 hover:border-white/50 hover:bg-white/5 hover:text-white/70"}`}>
                        {pos > 0 ? pos : "+"}
                      </button>
                      {/* ── LE FRECCE: L'ORDINE DELLA LIBRERIA ─────────────
                          Solo `onClick`. Nessun gestore di puntatore, nessun
                          `touch-action`, nessun timer: è quello che le fa
                          convivere con la pressione lunga di "Mostra" (il
                          perché è scritto per esteso accanto a `spostaMedia`).
                          Con UN media solo non si disegnano affatto: due frecce
                          entrambe spente sono un comando rotto. Estremi spenti:
                          è anche l'unica spiegazione di cui il gesto ha bisogno,
                          si legge dall'elenco senza pensarci. */}
                      {videos.length >= 2 && (
                        //  ⚠️ MISURA DEL BERSAGLIO. Le sagome restano da 12px —
                        //  il peso visivo è quello giusto, la cosa più leggera
                        //  della riga — ma l'area cliccabile no: 16×16 si sbaglia
                        //  col trackpad, e qui sbagliare di otto pixel a sinistra
                        //  vuol dire premere la casella del numero, cioè cambiare
                        //  l'ordine che vedrà il CLIENTE mentre si credeva di
                        //  cambiare il proprio. 24×18 ciascuna, cioè 36px in
                        //  colonna: esattamente l'altezza della miniatura, quindi
                        //  la riga NON cresce (era e resta la regola).
                        <div className="flex flex-shrink-0 flex-col">
                          <button
                            type="button"
                            data-freccia
                            ref={(el) => { if (el) frecciaRef.current.set(`-1:${v.url}`, el); else frecciaRef.current.delete(`-1:${v.url}`); }}
                            onClick={(e) => cliccaFreccia(v, -1, e)}
                            disabled={i === 0 || frecceSpente}
                            //  Il suggerimento dice SEMPRE quale delle due
                            //  disposizioni si sta toccando: la riga in cima alla
                            //  libreria si legge una volta sola, questo si rilegge
                            //  ogni volta che la mano si ferma sul pulsante.
                            title={inModifica ? "Finisci di rinominare" : "Sposta su nella libreria — non cambia l'ordine del link"}
                            aria-label={`Sposta ${v.name} su nella libreria — dalla posizione ${i + 1} alla ${i}; l'ordine del link non cambia`}
                            className="flex h-[18px] w-6 items-center justify-center rounded text-white/35 hover:bg-white/10 hover:text-brand disabled:opacity-40">
                            <ChevronUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            data-freccia
                            ref={(el) => { if (el) frecciaRef.current.set(`1:${v.url}`, el); else frecciaRef.current.delete(`1:${v.url}`); }}
                            onClick={(e) => cliccaFreccia(v, 1, e)}
                            disabled={i === videos.length - 1 || frecceSpente}
                            title={inModifica ? "Finisci di rinominare" : "Sposta giù nella libreria — non cambia l'ordine del link"}
                            aria-label={`Sposta ${v.name} giù nella libreria — dalla posizione ${i + 1} alla ${i + 2}; l'ordine del link non cambia`}
                            //  ⚠️ `disabled:opacity-20` su un testo già a white/35
                            //  faceva il 7% di bianco su fondo scuro: la freccia
                            //  spenta SPARIVA, e con lei l'unica spiegazione che
                            //  il gesto ha (la prima riga senza ▲, l'ultima senza
                            //  ▼). Restava una colonna con una freccia sola, che
                            //  si legge come un disegno rotto, non come un limite.
                            className="flex h-[18px] w-6 items-center justify-center rounded text-white/35 hover:bg-white/10 hover:text-brand disabled:opacity-40">
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      {k === "image" ? (
                        <img src={v.url} alt="" className="h-9 w-12 flex-shrink-0 rounded-md border border-white/10 object-cover" draggable={false} />
                      ) : (
                        // stesse misure e stesso ritaglio della miniatura foto:
                        // in elenco le due colonne devono allinearsi
                        <MiniaturaVideo url={v.url} />
                      )}
                      {inModifica ? (
                        <input
                          autoFocus
                          value={nuovoNome}
                          readOnly={salvandoNome}
                          onChange={(e) => setNuovoNome(e.target.value)}
                          onFocus={(e) => e.currentTarget.select()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); void confermaRinomina(v); }
                            else if (e.key === "Escape") { e.preventDefault(); annullaRef.current = true; chiudiRinomina(); }
                          }}
                          // Chi clicca altrove si aspetta di aver salvato, non di
                          // aver perso quello che ha scritto: il blur conferma.
                          onBlur={() => void confermaRinomina(v)}
                          maxLength={120}
                          placeholder="Nome del media"
                          aria-label="Nuovo nome del media"
                          className={`min-w-0 flex-1 rounded-md border border-brand bg-black/40 px-2 py-1 text-sm text-white outline-none placeholder:text-white/35 ${salvandoNome ? "opacity-60" : ""}`}
                        />
                      ) : (
                        <button type="button" onClick={() => apriRinomina(v)} title="Rinomina" className="min-w-0 flex-1 truncate text-left text-sm hover:text-brand">
                          {v.name}
                        </button>
                      )}
                      <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${k === "image" ? "bg-white/10 text-white/70" : "bg-brand/20 text-brand"}`}>
                        {k === "image" ? <ImageIcon className="h-3 w-3" /> : <Video className="h-3 w-3" />}{k === "image" ? "Foto" : "Video"}
                      </span>
                      {!inModifica && (
                        <button type="button" onClick={() => apriRinomina(v)} title="Rinomina" aria-label="Rinomina" className="rounded-md border border-white/10 p-1.5 text-white/60 hover:bg-white/10 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button>
                      )}
                      {/* ── MOSTRA / TIENI PREMUTO PER IL LINK ─────────────
                          Un tocco: il media va in mostra (quello che il pulsante
                          ha sempre fatto). Tenuto premuto: nasce il link e
                          finisce negli appunti. */}
                      <div className="group relative flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            //  Il clic che arriva SUBITO DOPO la pressione lunga
                            //  non è un clic: è la coda del gesto. Si scarta solo
                            //  se è arrivato davvero subito — un secondo dopo è
                            //  di nuovo un clic vero, e deve mostrare il media.
                            if (Date.now() - oraDelGesto.current < 900) { oraDelGesto.current = 0; return; }
                            pickMedia(v);
                          }}
                          onPointerDown={(e) => { if (e.button > 0) return; iniziaPressione(v); }}
                          onPointerUp={fermaPressione}
                          onPointerLeave={fermaPressione}
                          onPointerCancel={fermaPressione}
                          //  Su telefono la pressione lunga apre il menù di
                          //  sistema ("copia link", "salva immagine") e il gesto
                          //  muore lì: qui lo si toglie di mezzo.
                          onContextMenu={(e) => e.preventDefault()}
                          //  `touch-action: none` impedisce che il dito fermo sul
                          //  pulsante venga letto come inizio di scorrimento: senza,
                          //  il browser annulla il puntatore a metà pressione.
                          //  (Il preventDefault sul pointerdown NO: toglierebbe
                          //  anche il clic normale, che qui serve ancora.)
                          style={{ touchAction: "none", WebkitTouchCallout: "none", WebkitUserSelect: "none", userSelect: "none" }}
                          //  Niente `title`: il suggerimento disegnato qui sotto
                          //  dice già la stessa frase, e i due comparirebbero
                          //  insieme (uno sopra il pulsante, uno sotto il
                          //  cursore) proprio mentre si sta per premere.
                          aria-label={`Mostra ${v.name} — tieni premuto per creare e copiare il link`}
                          className="relative inline-flex select-none items-center gap-1 overflow-hidden rounded-md border border-brand bg-brand/10 px-2.5 py-1 text-xs font-medium hover:bg-brand/20"
                        >
                          {/* Il segnale mentre si tiene premuto: il pulsante si
                              riempie da sinistra e arriva a fondo esattamente
                              quando il gesto scatta. Senza, non si sa se sta
                              funzionando e si molla a metà. */}
                          <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 bg-brand"
                            style={{ width: premuto === v.url ? "100%" : "0%", transition: premuto === v.url ? `width ${SOGLIA_PRESSIONE_MS}ms linear` : "none" }} />
                          <Play className="relative h-3 w-3" />
                          <span className="relative">Mostra</span>
                        </button>
                        {/* Il suggerimento al passaggio del mouse: solo dove un
                            mouse c'è (su telefono comparirebbe al tocco, coprendo
                            proprio la riga che si sta usando). */}
                        <span className="pointer-events-none absolute bottom-full right-0 z-30 mb-1.5 hidden whitespace-nowrap rounded-md border border-white/15 bg-black/90 px-2 py-1 text-[11px] font-normal text-white/85 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 sm:block">
                          Tieni premuto per copiare il link
                        </span>
                      </div>
                      <button onClick={() => removeVid(v.url)} className="rounded-md border border-white/10 p-1.5 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Chi non vede l'elenco deve comunque sapere DOVE è finito il media
                che ha appena spostato: senza questa riga il riordino da tastiera
                è un gesto al buio. */}
            <div aria-live="polite" className="sr-only">{annuncioOrdine}</div>
          </section>

          {/* aggiungi */}
          <section className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="mb-3 text-sm font-semibold">Aggiungi media</h2>
            <label className="mb-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-white/25 bg-white/[0.03] px-3 py-4 text-sm text-white/70 transition hover:bg-white/5">
              <Upload className="h-4 w-4" /> {uploading ? "Caricamento…" : "Carica una foto o un video"}
              <input type="file" accept="video/*,image/*" onChange={onFile} className="hidden" disabled={uploading} />
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/40" />
                <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="Incolla URL foto o video…"
                  className="w-full rounded-lg border border-white/20 bg-white/[0.06] py-2.5 pl-8 pr-3 text-sm text-white placeholder:text-white/40 focus:border-brand focus:outline-none" />
              </div>
              <button onClick={addUrl} className="rounded-lg border border-brand bg-brand/10 px-3 text-sm font-medium hover:bg-brand/20">Aggiungi</button>
            </div>
            <p className="mt-2 text-[11px] text-white/40">Gli upload passano dal server: usa file non troppo grandi (o incolla un URL da CDN). I media restano salvati anche dopo la chiamata. La gestione di “Casi & Risultati” è ora nelle <b>Slide</b> (⚙).</p>
          </section>
        </div>
      </main>
      <Toaster />
    </div>
  );
}
