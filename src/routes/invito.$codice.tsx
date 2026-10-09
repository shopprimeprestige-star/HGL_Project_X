// ── /invito/ACDE-F3HJ-KMN7 — L'APPUNTAMENTO, COME LO VEDE IL CLIENTE ────────
//  Il consulente fissa la consulenza e manda questo link. Il cliente lo apre
//  dal telefono, spesso giorni prima, e deve trovare QUATTRO risposte in dieci
//  secondi: quando · quanto dura · come funziona · chi incontro.
//  Tutto il resto della pagina è al servizio di quelle quattro righe.
//
//  ⚠️ NON È UNA PAGINA DI VENDITA. Chi la apre ha già detto di sì una volta:
//  non ci sono offerte, garanzie, numeri, "posti limitati" né inviti a fare
//  altro. Serve a far presentare qualcuno a un appuntamento, e ogni frase in
//  più è una ragione in più per chiudere la scheda.
//
//  ⚠️ IL CODICE È LA CHIAVE, quindi la pagina è `noindex` e mostra il solo nome
//  di battesimo: telefono, email, note e stato della trattativa non arrivano
//  nemmeno qui (vedi /api/public/invito, dove i campi sono scelti a mano).
//
//  Il linguaggio è quello della pagina pubblica più recente (media/$codice):
//  del "tu", frasi corte, e mai una schermata tecnica davanti a un cliente —
//  un link scaduto si spiega, non si mostra come errore.
import { createFileRoute } from "@tanstack/react-router";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ComponentType,
  type ReactNode,
} from "react";
import {
  BadgeEuro,
  Camera,
  CalendarClock,
  CircleCheck,
  Clock,
  FileText,
  Images,
  Layers,
  MessageCircle,
  MonitorSmartphone,
  Sparkles,
  Sprout,
  UserRound,
  Video,
} from "lucide-react";
import { BrandLogo } from "@/shop/BrandLogo";
import { codicePulito } from "@/media/galleria";
import { urlPubblico } from "@/lib/sito";
import {
  durataInParole,
  faseInvito,
  giorniDaOggiInvito,
  giornoPerEsteso,
  normalizzaInvito,
  quandoInParole,
  quantoMancaInParole,
  type DatiInvito,
  type FaseInvito,
} from "@/crm/invito";
//  ⚠️ NESSUN TESTO DI QUESTA PARTE SI SCRIVE QUI. Le stesse frasi le stampa il
//  biglietto 1920×1080 che il consulente allega al messaggio con il link: il
//  cliente li legge a due minuti di distanza, e se le due copie vivessero in due
//  file fra un mese direbbero due cose diverse sullo stesso prodotto. Qui si
//  decide solo COME si vedono.
import {
  FRASI,
  PASSI_CONSULENZA,
  PREZZO_DA_TESTO,
  SOLUZIONI,
  type ConcettoIcona,
  type Soluzione,
} from "@/crm/consulenza-contenuti";

// ── ANTEPRIMA DEL LINK ──────────────────────────────────────────────────────
//  Chi riceve il link su WhatsApp vede un riquadro prima ancora di aprirlo:
//  senza queste righe è quello generico del sito, e un riquadro anonimo su un
//  indirizzo che non si riconosce non lo apre nessuno. Si riusa il meccanismo
//  già in piedi per le altre pagine pubbliche (/api/og/card), come fa
//  media/$codice.
//
//  Titolo e descrizione sono GENERICI di proposito: l'anteprima resta visibile
//  a chiunque il messaggio venga inoltrato, e nel riquadro non deve comparire
//  il nome di nessuno né la data di un appuntamento.
const T = "Il tuo appuntamento";
const D = "Giorno, ora e come si svolge la consulenza. Non serve installare nulla.";
/** L'anteprima di QUESTO invito. L'indirizzo è fisso e decide al momento della
 *  richiesta: vedi api.og.anteprima per il perché non è il deposito diretto. */
const anteprimaDi = (codice: string) =>
  urlPubblico(`api/og/anteprima/invito/${encodeURIComponent(codice)}.jpg`);

export const Route = createFileRoute("/invito/$codice")({
  //  ── L'ANTEPRIMA È DI QUESTO LINK, NON DEL SITO ──────────────────────────
  //  L'indirizzo dell'immagine porta dentro il codice, quindi ogni invito ha
  //  la sua: il biglietto disegnato per quella persona, lo stesso che il
  //  consulente ha appena visto e mandato. Se non è ancora stato depositato,
  //  l'indirizzo risponde col marchio dello studio (vedi api.og.anteprima):
  //  mai un riquadro rotto.
  head: ({ params }) => ({
    meta: [
      { title: `${T} — Hair Genius Labs` },
      { name: "description", content: D },
      //  ⚠️ `noindex` resta: queste pagine non devono finire nei motori di
      //  ricerca, e il codice casuale è la sola chiave. Ma `nofollow` qui non
      //  proteggeva niente e per qualche lettore di anteprime è un segnale di
      //  «lascia stare questa pagina»; `max-image-preview:large` dice
      //  esplicitamente il contrario di quello che temevamo: anteprima grande,
      //  permessa.
      { name: "robots", content: "noindex, follow, max-image-preview:large" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Hair Genius Labs" },
      { property: "og:title", content: T },
      { property: "og:description", content: D },
      //  ⚠️ TRE PROPRIETÀ CHE SEMBRANO RIDONDANTI E NON LO SONO.
      //  `og:url` dice al lettore qual è l'indirizzo canonico di questa pagina:
      //  senza, alcuni non si fidano di quello che hanno appena scaricato e
      //  saltano l'anteprima invece di sbagliarla.
      //  `og:image:secure_url` è la forma che WhatsApp guarda per prima quando
      //  decide se un'immagine è servita in modo sicuro: è la stessa identica
      //  cosa di `og:image`, ma scritta dove lui la cerca.
      //  `og:image:type` gli evita di dover indovinare il formato scaricando il
      //  file: se indovina male, non mostra niente e non lo dice a nessuno.
      { property: "og:url", content: urlPubblico(`invito/${params.codice}`) },
      { property: "og:image", content: anteprimaDi(params.codice) },
      { property: "og:image:secure_url", content: anteprimaDi(params.codice) },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:alt", content: "Il biglietto del tuo appuntamento" },
      //  ⚠️ Le misure dichiarate devono essere quelle VERE del file: il
      //  biglietto è 16:9, e dichiarare 1200x630 (che è 1.91:1) fa disegnare a
      //  qualche lettore un riquadro della forma sbagliata, con due bande.
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "675" },
      { property: "og:locale", content: "it_IT" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: T },
      { name: "twitter:description", content: D },
      //  L'immagine va ripetuta anche in `twitter:*`: con `summary_large_image`
      //  e nessun `twitter:image` alcuni lettori non ricadono su `og:image` e
      //  mostrano il riquadro senza figura — cioè proprio l'anteprima anonima
      //  che queste righe esistono per evitare. Le altre pagine pubbliche la
      //  dichiarano (vedi media/$codice).
      { name: "twitter:image", content: anteprimaDi(params.codice) },
      { name: "theme-color", content: "#050f24" },
    ],
  }),
  component: PaginaInvito,
});

type Stato = "carico" | "ok" | "ko";

/** Il codice letto dall'indirizzo. Stesso impianto di `codiceDaPercorso`
 *  (media/galleria): si legge dal percorso, si tollerano minuscole e trattini,
 *  e un segno che non esiste nell'alfabeto NON si aggiusta — indovinare al
 *  posto del cliente vorrebbe dire aprirgli l'appuntamento di qualcun altro. */
const PERCORSO_RE = /\/invito\/([^/?#]+)/i;
function codiceDaIndirizzo(pathname: string): string {
  const m = PERCORSO_RE.exec(pathname || "");
  if (!m) return "";
  let grezzo = m[1];
  try {
    grezzo = decodeURIComponent(m[1]);
  } catch {
    /* percentuali storte: si prende com'è */
  }
  return codicePulito(grezzo);
}

/** Il conto alla rovescia si aggiorna da solo: mezzo minuto è abbastanza fitto
 *  perché "fra 3 minuti" diventi "è il momento" mentre il cliente guarda lo
 *  schermo, e abbastanza rado da non pesare niente su un telefono lasciato
 *  aperto sul comodino. */
const BATTITO_MS = 30_000;

// ── LA COMPARSA DELLE SEZIONI CHE STANNO SOTTO IL TAGLIO ────────────────────
//  Le fasce in alto entrano a scaletta all'apertura (`salita`, più sotto) e va
//  benissimo finché sono davanti agli occhi. Per quello che sta sotto il bordo
//  dello schermo quel meccanismo non funziona: l'animazione finirebbe mentre il
//  cliente sta ancora leggendo la data, e arrivato lì troverebbe solo il
//  risultato. Qui il movimento è LO STESSO di casa — `hg-rise`, stesso mezzo
//  secondo, stessa curva — ma parte quando la sezione entra davvero in vista.
//
//  ⚠️ CHI HA CHIESTO MENO MOVIMENTO NON DEVE NEMMENO PASSARE DALLO STATO
//  NASCOSTO. `hg-rise` si spegne da sola in CSS con "riduci movimento", ma
//  l'`opacity-0` che la precede no: senza l'animazione che la riaccende, la
//  sezione resterebbe invisibile per sempre. Stessa prudenza dove
//  `IntersectionObserver` non esiste e sul server, dove non c'è finestra da
//  osservare: nel dubbio si mostra, sempre.
function useComparsa<T extends HTMLElement>() {
  const rif = useRef<T | null>(null);
  const [entrata, setEntrata] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return true;
    return !!window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (entrata) return;
    const el = rif.current;
    if (!el) return;
    //  Un filo di margine negativo in basso: la sezione parte quando è entrata
    //  per davvero, non quando ne spunta il primo pixel dal bordo — altrimenti
    //  l'animazione si consuma fuori campo, che è il difetto da cui nasce
    //  questo hook.
    const osservatore = new IntersectionObserver(
      (voci) => {
        if (!voci.some((v) => v.isIntersecting)) return;
        setEntrata(true);
        //  Una volta sola: una sezione che si rianima a ogni passaggio è
        //  esattamente il movimento che questa pagina non vuole.
        osservatore.disconnect();
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
    osservatore.observe(el);
    return () => osservatore.disconnect();
  }, [entrata]);

  return { rif, entrata };
}

/** L'involucro di una fascia che entra quando la si raggiunge davvero.
 *  `ritardo` serve al caso in cui la fascia sia GIÀ sotto gli occhi
 *  all'apertura: lì l'osservatore scatta subito e il ritardo la rimette in fila
 *  con la scaletta delle fasce in alto, così la pagina si apre come un gesto
 *  solo. Raggiunta scorrendo, quei due decimi non li nota nessuno. */
function Fascia({
  ritardo = 0,
  className,
  children,
}: {
  ritardo?: number;
  className?: string;
  children: ReactNode;
}) {
  const { rif, entrata } = useComparsa<HTMLDivElement>();
  return (
    <div
      ref={rif}
      className={`${entrata ? "hg-rise" : "opacity-0"} ${className || ""}`}
      style={{ animationDelay: `${ritardo}ms` }}
    >
      {children}
    </div>
  );
}

// ── LE TRE SOLUZIONI ────────────────────────────────────────────────────────
//  L'icona non sta nel file dei contenuti perché è un fatto di disegno e non di
//  testo: qui è una lucide, sul biglietto è un tracciato Canvas fatto di archi.
//  Quello che i due lati devono condividere è il CONCETTO, ed è quello che
//  arriva da `ConcettoIcona`.
//  ⚠️ Nessuna icona da ambulatorio: un bisturi accanto al trapianto trasforma
//  un elenco rassicurante in un'ansia, ed è il contrario del mestiere di questa
//  pagina. Un germoglio dice "cresce", i livelli dicono "appoggiata sopra", e la
//  terza resta astratta perché astratto è l'unico modo onesto di disegnare un
//  protocollo che si mostra in videochiamata e non qui.
const ICONA_SOLUZIONE: Record<ConcettoIcona, ComponentType<{ className?: string }>> = {
  trapianto: Sprout,
  patch: Layers,
  protocollo: Sparkles,
};

/** Una delle tre soluzioni. Stessa forma per tutte e tre — nome, categoria,
 *  una riga di che cos'è, due punti — perché è la forma identica a rendere
 *  confrontabili tre cose diverse: appena una carta ha un vestito suo, l'occhio
 *  smette di paragonare e comincia a scegliere il riquadro più bello.
 *
 *  `acceso` distingue il protocollo della casa, e lo fa SOLO col colore: non
 *  con una taglia diversa, non con un'etichetta su un asse diverso dalle altre
 *  ("chirurgico o no" è la sola classificazione verificabile, e la patch e il
 *  protocollo condividono la stessa risposta). Un'etichetta inventata per il
 *  prodotto di punta sarebbe una classifica travestita da categoria. */
function CartaSoluzione({
  soluzione: s,
  acceso,
  className,
  style,
}: {
  soluzione: Soluzione;
  acceso: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const Icona = ICONA_SOLUZIONE[s.icona];
  return (
    <li
      className={`rounded-2xl border px-4 py-3.5 ${
        acceso
          ? "border-brand/40 bg-brand/[0.09] shadow-[0_10px_30px_rgba(56,110,220,.18)]"
          : "border-white/10 bg-white/[0.03]"
      } ${className || ""}`}
      style={style}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={`flex h-9 w-9 flex-none items-center justify-center rounded-xl border ${
            acceso
              ? "border-brand/40 bg-brand/15 text-brand"
              : "border-white/10 bg-white/[0.06] text-white/70"
          }`}
        >
          <Icona className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          {/*  Il nome e la categoria sulla stessa riga finché ci stanno: su uno
              schermo stretto la pastiglia scende sotto invece di stringere il
              nome, che è la parola che si deve leggere per prima. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-[15px] font-semibold leading-snug text-white">{s.nome}</h3>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase leading-none tracking-[0.12em] ${
                acceso ? "bg-brand text-brand-foreground" : "bg-white/[0.08] text-white/60"
              }`}
            >
              {s.categoria}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] leading-snug text-white/60">{s.sottotitolo}</p>
        </div>
      </div>
      {/*  I due punti rientrati sotto il testo e non sotto l'icona (36 di
          riquadro + 12 di stacco): incolonnati con il nome si leggono come
          "cose di questa soluzione", sotto l'icona come un elenco a parte. */}
      <ul className="mt-2.5 flex flex-col gap-1.5 pl-12">
        {s.punti.map((p) => (
          <li key={p} className="flex items-start gap-2 text-[12.5px] leading-snug text-white/75">
            <span
              aria-hidden
              className={`mt-[6px] h-1 w-1 flex-none rounded-full ${
                acceso ? "bg-brand" : "bg-white/35"
              }`}
            />
            {p}
          </li>
        ))}
      </ul>
    </li>
  );
}

/** Di cosa parliamo: le tre soluzioni, e sotto la soglia di prezzo.
 *  ⚠️ Questa sezione NON trasforma la pagina in una vendita. Chi la apre ha già
 *  detto di sì una volta: qui non c'è nessuna offerta e nessun invito a
 *  scegliere adesso, si dice solo che le strade sono tre e che si parte da una
 *  cifra alla portata — perché chi dà per scontato che roba del genere costi
 *  diecimila euro non si presenta, e non lo dice a nessuno. */
function Soluzioni() {
  const { rif, entrata } = useComparsa<HTMLElement>();
  //  Le tre carte entrano una dopo l'altra, come le fasce in alto: stessa
  //  animazione, stesso passo di settanta millesimi.
  const passo = (i: number): CSSProperties => ({ animationDelay: `${i * 70}ms` });
  return (
    <section ref={rif} className={entrata ? undefined : "opacity-0"}>
      <div className={entrata ? "hg-rise" : undefined} style={passo(0)}>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
          {FRASI.titoloSoluzioni}
        </h2>
        <p className="mt-1 text-[13px] leading-snug text-white/70">{FRASI.cosaE}</p>
      </div>

      <ul className="mt-3 flex flex-col gap-2.5">
        {SOLUZIONI.map((s, i) => (
          <CartaSoluzione
            key={s.chiave}
            soluzione={s}
            //  Il nostro è l'ultimo perché è quello su cui si chiude il
            //  discorso, non perché è il migliore: nessun numero "01 02 03",
            //  nessuna corona.
            acceso={s.chiave === "protocollo"}
            className={entrata ? "hg-rise" : undefined}
            style={passo(i + 1)}
          />
        ))}
      </ul>

      {/*  Il prezzo e il preventivo stanno nella stessa riga e non si separano
          mai: la soglia da sola somiglia a un listino, e un listino su una
          pagina di appuntamento è la promessa che il quinto passo giura di non
          fare. */}
      <div
        className={`mt-2.5 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 ${
          entrata ? "hg-rise" : ""
        }`}
        style={passo(SOLUZIONI.length + 1)}
      >
        <BadgeEuro className="mt-0.5 h-4 w-4 flex-none text-brand" aria-hidden />
        <p className="text-[13px] leading-relaxed text-white/70">
          {FRASI.prezzoDa}{" "}
          <span className="text-[15px] font-semibold text-white">{PREZZO_DA_TESTO}</span>.{" "}
          <span className="text-white/55">{FRASI.preventivoSuMisura}</span>
        </p>
      </div>
    </section>
  );
}

// ── UN PASSAGGIO DI "COME SI SVOLGE" ────────────────────────────────────────
//  Numero, icona, una riga di titolo e una di spiegazione. La stessa forma per
//  tutti e quattro: quando ogni passaggio ha un vestito suo, l'elenco si legge
//  come quattro cose diverse invece che come una sequenza.
function Passo({
  n,
  icona: Icona,
  titolo,
  testo,
}: {
  n: number;
  icona: ComponentType<{ className?: string }>;
  titolo: string;
  testo: string;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="relative flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-brand"
      >
        <Icona className="h-4 w-4" />
        {/*  Il numero appoggiato all'icona: dice che c'è un ORDINE senza
            rubare la riga al titolo del passaggio. */}
        <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold leading-none text-brand-foreground">
          {n}
        </span>
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-[14px] font-semibold leading-snug text-white">{titolo}</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-white/60">{testo}</p>
      </div>
    </li>
  );
}

/** L'icona di ogni passaggio, legata al NUMERO del passo e non alla sua
 *  posizione nell'elenco: il numero sta nel dato proprio perché si stampa, e un
 *  elenco riordinato per sbaglio non deve poter spostare anche i disegni.
 *  ⚠️ Chi non trovasse la sua ricade sul fumetto del dialogo: un passaggio
 *  aggiunto ai contenuti deve poter comparire subito, con un'icona generica,
 *  senza aspettare che qualcuno tocchi questo file. */
const ICONA_PASSO: Record<number, ComponentType<{ className?: string }>> = {
  1: MonitorSmartphone,
  2: Camera,
  3: MessageCircle,
  4: Images,
  5: FileText,
};

/** Il pulsante che porta dentro la consulenza.
 *  ⚠️ IL GIORNO STESSO È IL PROTAGONISTA DELLA PAGINA, PRIMA NO. Un tasto
 *  grande e acceso tre giorni prima fa entrare le persone in una stanza vuota,
 *  e chi trova la stanza vuota conclude che il link non funziona. */
function PulsanteEntra({ link, protagonista }: { link: string; protagonista: boolean }) {
  if (!link) return null;
  if (protagonista) {
    return (
      <a
        href={link}
        className="relative flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[16px] font-semibold text-brand-foreground shadow-[0_10px_30px_rgba(56,110,220,.35)] transition duration-200 hover:brightness-110 active:scale-[.99]"
      >
        {/*  L'anello che pulsa è già in casa (hg-pulse-ring) e si spegne da solo
            con "riduci movimento": nessun rimbalzo, solo un respiro. */}
        <span
          aria-hidden
          className="hg-pulse-ring pointer-events-none absolute inset-0 rounded-2xl ring-2 ring-brand/60"
        />
        <Video className="h-5 w-5" />
        Entra nella consulenza
      </a>
    );
  }
  return (
    <a
      href={link}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] text-[14px] font-semibold text-white/85 transition duration-200 hover:bg-white/[0.09]"
    >
      <Video className="h-4 w-4" />
      Apri la consulenza
    </a>
  );
}

/** Come si svolge: i passaggi nell'ordine in cui succedono. Non è un manuale,
 *  serve a togliere l'unica incertezza che resta dopo aver fissato — "e adesso
 *  cosa succede" — perché chi non se lo sente dire immagina il peggio, rimanda,
 *  e rimandare vuol dire non presentarsi.
 *
 *  ⚠️ Il passaggio delle foto e dei video di clienti veri è ANNUNCIATO qui e
 *  non mostrato: quelle sono facce di persone vere, che hanno dato il consenso
 *  per essere guardate dentro una chiamata da un consulente, non per viaggiare
 *  su una pagina che si apre con un link e si inoltra in un secondo. */
function ComeSiSvolge() {
  const { rif, entrata } = useComparsa<HTMLElement>();
  return (
    <section
      ref={rif}
      className={`rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 ${
        entrata ? "hg-rise" : "opacity-0"
      }`}
    >
      <h2 className="mb-3.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
        {FRASI.titoloPassi}
      </h2>
      <ol className="flex flex-col gap-3.5">
        {PASSI_CONSULENZA.map((p) => (
          <Passo
            key={p.n}
            n={p.n}
            icona={ICONA_PASSO[p.n] || MessageCircle}
            titolo={p.titolo}
            testo={p.testo}
          />
        ))}
      </ol>
    </section>
  );
}

/** Schermata piena, marchio davanti agli occhi: la usano l'attesa e il link
 *  scaduto. Chi è arrivato qui ha fatto tutto giusto — ha toccato un link che
 *  gli è stato mandato — e non deve vedere né una pagina bianca né un errore. */
function Schermata({ children }: { children: ReactNode }) {
  return (
    <div className="bg-brandfill fixed inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
      {children}
    </div>
  );
}

function PaginaInvito() {
  // ── TUTTI GLI STATI QUI SOPRA ─────────────────────────────────────────────
  //  Sotto ci sono tre schermate diverse (attesa / link scaduto / invito): un
  //  hook dichiarato dopo un return anticipato verrebbe contato solo in una
  //  parte dei render, e React perderebbe l'allineamento fra un render e
  //  l'altro. Si dichiara tutto prima, si sceglie cosa disegnare alla fine.
  const [stato, setStato] = useState<Stato>("carico");
  const [dati, setDati] = useState<DatiInvito | null>(null);
  //  L'adesso di partenza è quello del primo disegno; da lì lo aggiorna il
  //  battito. Non si legge durante il render (la pagina viene costruita anche
  //  sul server, e un valore diverso fra i due disegni la fa ripartire da capo).
  const [adesso, setAdesso] = useState(0);

  useEffect(() => {
    //  Il codice si legge QUI e non durante il disegno, per lo stesso motivo:
    //  sul server `window` non esiste.
    const c = codiceDaIndirizzo(window.location.pathname);
    setAdesso(Date.now());
    //  Codice trascritto male: non si chiede nemmeno al server, la risposta è
    //  già la schermata gentile.
    if (!c) {
      setStato("ko");
      return;
    }
    let vivo = true;
    fetch(`/api/public/invito?codice=${encodeURIComponent(c)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!vivo) return;
        const d = normalizzaInvito((j as { invito?: unknown } | null)?.invito);
        if (!d) {
          setStato("ko");
          return;
        }
        setDati(d);
        setStato("ok");
      })
      .catch(() => {
        if (vivo) setStato("ko");
      });
    return () => {
      vivo = false;
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setAdesso(Date.now()), BATTITO_MS);
    return () => clearInterval(t);
  }, []);

  // ── SCHERMATA D'ATTESA ────────────────────────────────────────────────────
  if (stato === "carico") {
    return (
      <Schermata>
        <CalendarClock className="h-8 w-8 animate-pulse text-brand" />
        <span className="text-sm font-medium text-white/70">Apro il tuo appuntamento…</span>
      </Schermata>
    );
  }

  // ── LINK NON PIÙ VALIDO ───────────────────────────────────────────────────
  if (stato === "ko" || !dati) {
    return (
      <Schermata>
        <BrandLogo className="h-8 w-auto" />
        <h1 className="text-lg font-semibold text-white">Questo link non è più valido</h1>
        {/*  ⚠️ "Scrivi al tuo consulente" da qui non si può fare: questa
            schermata non sa nemmeno di chi fosse l'appuntamento, quindi non ha
            un nome, un numero né un tasto da offrire. L'unico canale che esiste
            di sicuro è quello da cui il link è arrivato — e chi legge ha quel
            messaggio a un tocco di distanza. Vale la stessa regola di
            FRASI.disdettaEstesa: si nomina un gesto, non un principio. */}
        <p className="max-w-sm text-sm leading-relaxed text-white/60">
          L'appuntamento che c'era qui non è più disponibile. Rispondi al messaggio con cui ti è
          arrivato questo link: te ne mandiamo uno nuovo in un attimo.
        </p>
      </Schermata>
    );
  }

  // ── L'INVITO ──────────────────────────────────────────────────────────────
  const fase: FaseInvito = faseInvito(dati, adesso);
  const quando = quandoInParole(dati);
  const manca = quantoMancaInParole(dati, adesso);
  const giorni = giorniDaOggiInvito(dati.data);
  //  La data per esteso compare SOLO quando in cima c'è scritto "Oggi",
  //  "Domani" o "Ieri": altrove ripeterebbe parola per parola la riga sopra.
  const dataSotto = Math.abs(giorni) <= 1 ? giornoPerEsteso(dati) : "";
  const passato = fase === "passato";
  const protagonista = fase === "oggi" || fase === "adesso";

  /** La comparsa: le fasce salgono una dopo l'altra, una volta sola
   *  all'apertura. `hg-rise` è l'animazione di casa (styles.css) e si spegne da
   *  sola con "riduci movimento" — nessun rimbalzo, nessun ciclo continuo che
   *  distrae mentre si legge. */
  const salita = (ms: number) => ({ animationDelay: `${ms}ms` });

  return (
    <div className="bg-brandfill relative min-h-screen">
      {/*  Alone di marca dietro l'intestazione: respira lentissimo (hg-aurora),
          non si nota mai, e non intercetta nessun tocco. */}
      <div
        aria-hidden
        className="hg-aurora pointer-events-none absolute left-1/2 top-0 h-[280px] w-[520px] max-w-[140%] -translate-x-1/2 rounded-full bg-brand/25 blur-[90px]"
      />

      <div
        className="relative mx-auto flex w-full max-w-md flex-col gap-3.5 px-4 pb-10"
        //  Telefono con la tacca: senza questo il logo finisce sotto l'orologio.
        style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}
      >
        <header className="hg-rise flex justify-center pb-1" style={salita(0)}>
          <BrandLogo className="h-6 w-auto" />
        </header>

        {/* ── QUANDO ───────────────────────────────────────────────────────
            La risposta più grande della pagina, in parole. Se è oggi si
            scrive OGGI: è la richiesta esplicita del committente, ed è anche
            l'unica forma che non obbliga a controllare il calendario. */}
        <section
          className="hg-rise rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-5 text-center"
          style={salita(70)}
        >
          <p className="text-[12px] font-medium text-white/60">
            {dati.nome ? `Ciao ${dati.nome},` : "Ciao,"}
          </p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand">
            {passato ? "Appuntamento passato" : "La tua consulenza"}
          </p>
          <h1 className="mt-1.5 text-[28px] font-semibold leading-tight tracking-tight text-white sm:text-[34px]">
            {quando || "Giorno e ora da confermare"}
          </h1>
          {dataSotto && <p className="mt-1.5 text-[12.5px] text-white/55">{dataSotto}</p>}

          {/*  ── NIENTE CONTO ALLA ROVESCIA ALL'INDIETRO ──────────────────
              Passato l'orario (più la durata e mezz'ora di tolleranza) il
              conto sparisce e al suo posto c'è una frase che dice cosa fare.
              Un "-3 giorni" su una pagina di appuntamento è il difetto che si
              nota per primo e che toglie fiducia a tutto il resto. */}
          {passato ? (
            //  Stessa regola della disdetta: si nomina il canale che la persona
            //  ha già in mano, perché di questa pagina il consulente è un nome
            //  e nient'altro — e chi non è riuscito a esserci si sente in
            //  difetto, quindi la strada per rifarsi vivo dev'essere la più
            //  corta possibile.
            <p className="mx-auto mt-3 max-w-[19rem] text-[13px] leading-relaxed text-white/60">
              Se non siete riusciti a vedervi, rispondi al messaggio con cui ti è arrivato questo
              link: ne fissiamo un altro, senza problemi.
            </p>
          ) : manca ? (
            <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.06] px-3 py-1.5 text-[12.5px] font-semibold text-white/80">
              <Clock className="h-3.5 w-3.5 text-brand" />
              {manca}
            </span>
          ) : (
            //  Data o ora illeggibili sul lead: non si inventa un giorno, si
            //  dice che arriva la conferma. Capita sull'archivio importato, e
            //  una data inventata manderebbe qualcuno all'ora sbagliata.
            <p className="mx-auto mt-3 max-w-[19rem] text-[13px] leading-relaxed text-white/60">
              Il tuo consulente ti conferma giorno e ora a breve.
            </p>
          )}
        </section>

        {/*  Il giorno stesso il pulsante è la cosa più importante della
            pagina e sta qui, sopra tutto il resto. Prima del giorno scende in
            fondo (vedi sotto) e cambia peso. */}
        {protagonista && (
          <div className="hg-rise" style={salita(140)}>
            <PulsanteEntra link={dati.link} protagonista />
          </div>
        )}

        {/* ── DI COSA PARLIAMO ─────────────────────────────────────────────
            Subito dopo il nome, il quando e il pulsante: è la prima cosa che
            si incontra scorrendo, ed è l'unica parte della pagina che risponde
            alla domanda vera di chi ha fissato e adesso aspetta — "sì, ma cosa
            mi diranno?". Tutto ciò che c'era prima del taglio dello schermo è
            rimasto dov'era: questa sezione comincia sotto.
            ⚠️ Su un appuntamento passato sparisce come tutto il resto: un
            elenco di soluzioni a chi non si è presentato è pubblicità. */}
        {!passato && <Soluzioni />}

        {/* ── QUANTO DURA · CHI INCONTRI ───────────────────────────────────
            Le altre due risposte, una per riga, con l'icona a sinistra: si
            leggono con la coda dell'occhio senza dover finire la frase.
            ⚠️ Su un appuntamento già passato spariscono, insieme ai passaggi e
            alla riga sulle applicazioni: "dura circa 45 minuti" al passato non
            è un'informazione, è una pagina che non si è accorta di niente.
            Resta la sola frase che serve — scrivi al consulente. */}
        {!passato && (
          <Fascia
            //  Da quando sopra c'è "Di cosa parliamo" questa fascia sta quasi
            //  sempre sotto il bordo dello schermo: entra quando la si
            //  raggiunge, e mantiene il suo posto nella scaletta d'apertura per
            //  gli schermi alti dove invece si vede subito.
            ritardo={protagonista ? 210 : 140}
            className="divide-y divide-white/[0.07] rounded-2xl border border-white/10 bg-white/[0.03]"
          >
            <div className="flex items-center gap-3 px-4 py-3">
              <Clock className="h-4 w-4 flex-none text-brand" aria-hidden />
              <p className="text-[13.5px] text-white/85">
                Dura circa{" "}
                <span className="font-semibold text-white">{durataInParole(dati.durata)}</span>
              </p>
            </div>
            {dati.consulente && (
              <div className="flex items-center gap-3 px-4 py-3">
                <UserRound className="h-4 w-4 flex-none text-brand" aria-hidden />
                <p className="text-[13.5px] text-white/85">
                  Con <span className="font-semibold text-white">{dati.consulente}</span>, il tuo
                  consulente
                </p>
              </div>
            )}
            <div className="flex items-center gap-3 px-4 py-3">
              <MonitorSmartphone className="h-4 w-4 flex-none text-brand" aria-hidden />
              <p className="text-[13.5px] text-white/85">{FRASI.dove}</p>
            </div>
          </Fascia>
        )}

        {/*  ── LA DOMANDA CHE SI FANNO TUTTI ────────────────────────────────
            "Devo scaricare qualcosa?". Chi non se lo sente dire dà per
            scontato di sì, rimanda, e rimandare vuol dire non presentarsi. È
            la stessa frase che apre il messaggio WhatsApp del link, e qui ha
            una fascia sua perché venga letta e non scorsa. */}
        {!passato && (
          <Fascia ritardo={protagonista ? 280 : 210}>
            <p className="flex items-start gap-2.5 rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.07] px-4 py-3 text-[13px] leading-relaxed text-emerald-50/90">
              <CircleCheck className="mt-0.5 h-4 w-4 flex-none text-emerald-400" aria-hidden />
              <span>
                <span className="font-semibold">{FRASI.nienteDaScaricare}</span> Apri il link e sei
                già dentro.
              </span>
            </p>
          </Fascia>
        )}

        {/* ── COME SI SVOLGE ───────────────────────────────────────────────
            I passaggi nell'ordine in cui succedono, testi compresi, da
            `PASSI_CONSULENZA`: sono gli stessi che racconta il biglietto. */}
        {!passato && <ComeSiSvolge />}

        {/*  Prima del giorno il pulsante resta, ma secondario e in fondo: chi
            vuole controllare che il link funzioni lo trova, e nessuno ci
            arriva per sbaglio tre giorni prima. Passato l'appuntamento non c'è
            più: manderebbe qualcuno in una stanza vuota. */}
        {!protagonista && !passato && (
          <div className="hg-rise flex flex-col gap-2" style={salita(350)}>
            <PulsanteEntra link={dati.link} protagonista={false} />
            {dati.link && (
              <p className="text-center text-[11.5px] text-white/45">
                Il link è già attivo: puoi provarlo quando vuoi.
              </p>
            )}
          </div>
        )}

        {/*  Nessuna stanza collegata a questo appuntamento (capita sui contatti
            importati dal CRM precedente): meglio dirlo che lasciare una pagina
            senza pulsante e senza spiegazione. */}
        {!dati.link && !passato && (
          <p className="text-center text-[12px] leading-relaxed text-white/45">
            Il tuo consulente ti manda il link per collegarti poco prima dell'appuntamento.
          </p>
        )}

        {/*  ── SE NON RIESCI A ESSERCI ──────────────────────────────────────
            In fondo, sottovoce, e scritta come un favore che si chiede: non c'è
            nessuna penale e nessun termine di ore, perché sarebbe una
            condizione che nessuno ha mai concordato con il cliente. Chi non può
            venire e teme la sfuriata semplicemente sparisce, e un'ora bruciata
            in silenzio costa più di una spostata per tempo. */}
        {!passato && (
          <p className="text-center text-[12px] leading-relaxed text-white/45">
            {FRASI.disdettaEstesa}
          </p>
        )}

        <footer
          className="pt-2 text-center text-[11px] text-white/35"
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          Hair Genius Labs
        </footer>
      </div>
    </div>
  );
}
