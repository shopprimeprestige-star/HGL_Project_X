// ── /media/ACDE-F3HJ-KMN7 — LA RACCOLTA, COME LA VEDE IL CLIENTE ────────────
//  Un link statico: nessun accesso, nessuna consulenza dietro, nessun
//  consulente collegato. Si apre dal telefono, si scorre col dito, e basta.
//  È l'opposto della diretta (/presenta?watch=…), dove il consulente decide
//  cosa si vede in quel momento: qui il contenuto è già deciso, e il cliente lo
//  guarda quando vuole, anche fra tre giorni.
//
//  Il codice è la chiave: chi ce l'ha vede le foto. Per questo la pagina è
//  `noindex` — sono risultati di trapianti di clienti veri, non devono finire
//  in un motore di ricerca — e per questo il codice viene sorteggiato.
//
//  ⚠️ CHI GUARDA QUESTA PAGINA non ha fatto nessuna consulenza: ha ricevuto un
//  link su WhatsApp e sta decidendo se fidarsi. Spesso è la PRIMA cosa che vede
//  del marchio. Da qui tutto il resto: un titolo che dice subito cosa sta
//  guardando, comandi che si capiscono senza istruzioni, e niente che somigli a
//  un lettore rotto (un video nero, una foto tagliata, un logo che sparisce).
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Images, Play } from "lucide-react";
import { BrandLogo } from "@/shop/BrandLogo";
import { MarchioSuMedia } from "@/media/marchio";
import {
  codiceDaPercorso,
  conPrimoFotogramma,
  normalizzaVoci,
  type VoceGalleria,
} from "@/media/galleria";

// ── ANTEPRIMA DEL LINK ──────────────────────────────────────────────────────
//  Chi riceve il link su WhatsApp vede un riquadro prima ancora di aprirlo:
//  senza queste righe è quello generico del sito, e un riquadro anonimo su un
//  indirizzo che non si riconosce non lo apre nessuno. Si riusa il meccanismo
//  già in piedi per le altre pagine (/api/og/card), che serve anche l'immagine
//  caricata dalle impostazioni quando c'è.
//
//  Titolo e descrizione sono GENERICI di proposito: l'anteprima la vedono
//  tutti quelli a cui il messaggio viene inoltrato, e il titolo della raccolta
//  può contenere il nome di un cliente. Quello che è privato resta dentro.
/** ── ⚠️ TITOLO E DESCRIZIONE SONO GENERICI DI PROPOSITO ───────────────────
 *  L'anteprima la vede chiunque riceva il messaggio inoltrato, e il titolo
 *  della raccolta può contenere il nome di un cliente. Qui non c'è nessun
 *  nome: si dice CHE COSA c'è dentro, non DI CHI.
 *
 *  ⚠️ E si dice di che cosa sono i casi. Sull'anteprima del PREVENTIVO il nome
 *   del prodotto era stato tolto apposta (vedi shop/anteprima-preventivo), e la
 *   ragione era buona: chi riceve quel link ha appena finito la consulenza e sa
 *   già di che si parla. Qui è l'opposto — questa raccolta serve a CONVINCERE
 *   chi sta ancora decidendo, e un caso studio senza il nome del protocollo è
 *   una foto qualsiasi presa da internet. */
const T = "Casi reali, scelti per te";
//  ⚠️ UNA RIGA SOLA: chi legge un'anteprima le dà meno di mezzo secondo, e la
//   seconda riga in molti lettori non compare nemmeno.
//   L'invito a scorrere c'è, ma sta dentro la frase e non è un ordine:
//   «Clicca qui», a caratteri cubitali, fa sembrare pubblicità inoltrata un
//   link che una persona vera ha appena mandato — e toglie la fiducia che
//   questa raccolta esiste per costruire. Il gesto lo suggerisce l'immagine,
//   dove il carosello e la freccia si capiscono senza leggere niente.
//  ⚠️ IL TITOLO NON RIPETE QUELLO CHE DICE GIÀ LA FIGURA. Sull'immagine il
//   nome del protocollo è scritto grande: riscriverlo anche nel titolo
//   sprecherebbe l'unica riga in grassetto che il destinatario legge davvero,
//   per dirgli due volte la stessa cosa. Il titolo fa quello che la figura non
//   può fare — parlare a lui: «scelti per te». Il protocollo lo dice la riga
//   sotto, dove serve come credenziale e non come richiamo.
//  ⚠️ «Da sfogliare» e non «scorri»: dice lo stesso gesto e suona come una
//   cartella consegnata a mano invece che come un'istruzione. Su una raccolta
//   che deve sembrare riservata, il modo in cui si chiede è metà del messaggio.
const D = "Invisible Derm Protocol. Una raccolta privata, da sfogliare.";

/** ── ⚠️ PERCHÉ UN JPEG VERO E NON PIÙ `api/og/card` ───────────────────────
 *  Qui c'era `api/og/card?tipo=presentazione`, che disegna un'anteprima in
 *  SVG. Su Telegram e Slack si vedeva; su WhatsApp e iMessage — cioè
 *  esattamente dove questo link viene mandato — NO: quei lettori l'SVG non lo
 *  aprono, e mostravano il riquadro senza figura. Il limite è scritto nero su
 *  bianco in cima ad api.og.card, ma la pagina continuava a usarlo lo stesso.
 *
 *  Adesso è un JPEG 1200×630 disegnato con l'impianto grafico del sito —
 *  marchio, fondo di marca, il carosello con il triangolo del video — servito
 *  dal deposito pubblico. Nessun rimando da seguire, nessun formato da
 *  indovinare, `Content-Length` dichiarato: le tre cose per cui un lettore di
 *  anteprime rinuncia in silenzio.
 *
 *  ⚠️ PER CAMBIARE L'IMMAGINE si sovrascrive il file a questo stesso
 *   indirizzo (upsert nel deposito `anteprime`): l'indirizzo non cambia,
 *   quindi i link già mandati non si rompono. Cambiarlo qui invece vorrebbe
 *   dire un rilascio, e le anteprime già lette resterebbero quelle vecchie. */
/*  ⚠️ IL «?v=» NON È DECORATIVO, ed è l'unico modo di far mollare la presa a
    chi ha già letto questo link. I lettori di anteprime tengono in cache per
    settimane quello che hanno visto la prima volta — WhatsApp tiene anche i
    FALLIMENTI — e sostituire il file allo stesso indirizzo non li smuove:
    continuano a mostrare la figura vecchia, o il riquadro vuoto di quando
    l'anteprima era in SVG e non la leggevano.
    Cambiando questo numero cambia l'indirizzo, e per loro è un'immagine che
    non hanno mai visto.
    ⚠️ QUINDI: sostituire il file nel deposito basta per i link NUOVI; per
     quelli già mandati bisogna anche alzare questo numero di uno e rilasciare.
     Sono due cose diverse e conviene ricordarsele insieme. */
const IMG =
  "https://jrezhxbuetpfhvsrkrwo.supabase.co/storage/v1/object/public/anteprime/_contenuti.jpg?v=2";

export const Route = createFileRoute("/media/$codice")({
  head: () => ({
    meta: [
      { title: `${T} — Hair Genius Labs` },
      { name: "description", content: D },
      //  ⚠️ `nofollow` qui non proteggeva niente e per qualche lettore di
      //   anteprime è il segnale «lascia stare questa pagina»;
      //   `max-image-preview:large` dice esplicitamente il contrario. Stessa
      //   scelta, e stesso perché, di invito.$codice.
      { name: "robots", content: "noindex, follow, max-image-preview:large" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Hair Genius Labs" },
      { property: "og:title", content: T },
      { property: "og:description", content: D },
      { property: "og:image", content: IMG },
      //  ⚠️ `secure_url` è la forma che WhatsApp guarda per prima, e `type` gli
      //   evita di indovinare il formato scaricando il file: se indovina male
      //   non mostra niente e non lo dice a nessuno.
      { property: "og:image:secure_url", content: IMG },
      { property: "og:image:type", content: "image/jpeg" },
      {
        property: "og:image:alt",
        content: "Casi studio dell'Invisible Derm Protocol: foto e video",
      },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:locale", content: "it_IT" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: T },
      { name: "twitter:description", content: D },
      { name: "twitter:image", content: IMG },
      { name: "theme-color", content: "#050f24" },
    ],
  }),
  component: PaginaGalleria,
});

type Stato = "carico" | "ok" | "ko";

// ── IL TITOLO ───────────────────────────────────────────────────────────────
//  Il committente proponeva "alcuni nostri risultati". Resta il contenuto,
//  cambia la forma: "alcuni" è una scusa anticipata ("solo alcuni…") e chi
//  legge sta valutando se fidarsi, non se accontentarsi. "I nostri risultati"
//  dice in tre parole che cosa sta guardando e si ferma lì: nessuna promessa
//  ("garantiti", "definitivi"), nessun superlativo ("straordinari") — su una
//  pagina che deve costruire fiducia l'enfasi ottiene l'effetto opposto, e
//  quando si parla di trapianti diventa anche una promessa medica.
//  Il "sono una selezione" lo dice la riga sotto, con un numero, che è un
//  fatto e non un'attenuante.
const TITOLO = "I nostri risultati";

/** Rapporto usato finché il media non ha detto il suo: verticale, perché lo è
 *  la quasi totalità di quello che si carica (foto e video girati col telefono).
 *  Serve solo a dare alla cornice una misura reale PRIMA del caricamento: senza,
 *  la cornice avrebbe altezza zero, il media non verrebbe mai disegnato e quindi
 *  non caricherebbe mai — e resterebbe lì per sempre. */
const RAPPORTO_INIZIALE = 3 / 4;

/** Oltre questa soglia i puntini diventano una riga di trattini illeggibile e
 *  impossibile da centrare col pollice: si passa alla barra di avanzamento.
 *  Il numero non è estetico, è una misura: nella barra dei comandi i puntini
 *  stanno in mezzo a due frecce da 44px, e ogni puntino occupa 14px (32 quello
 *  attivo) più 4 di distanza. A otto la riga sta dentro anche a uno schermo da
 *  320px (iPhone SE), a dieci no: le frecce e i puntini si sovrappongono
 *  proprio sul telefono più stretto, cioè dove il pollice sbaglia già di suo. */
const MAX_PUNTINI = 8;

// ── MENO ANIMAZIONI, SE È STATO CHIESTO AL SISTEMA ──────────────────────────
//  Chi soffre di vertigini o chinetosi mette "riduci movimento" nelle
//  impostazioni del telefono. Qui non basta un @media nel foglio di stile:
//  metà delle animazioni di questa pagina sono decise in JavaScript (lo
//  scorrimento morbido del carosello), quindi la preferenza va letta e passata
//  in giro. Si parte da `false` e si legge dentro l'effetto: la pagina viene
//  costruita anche sul server, dove `matchMedia` non esiste.
function useMenoMovimento(): boolean {
  const [ridotto, setRidotto] = useState(false);
  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    } catch {
      return;
    }
    const aggiorna = () => setRidotto(mq.matches);
    aggiorna();
    //  Browser vecchi (Safari ≤ 13) conoscono solo addListener: se manca
    //  l'ascoltatore non si insiste, il valore letto una volta basta.
    try {
      mq.addEventListener("change", aggiorna);
      return () => mq.removeEventListener("change", aggiorna);
    } catch {
      return;
    }
  }, []);
  return ridotto;
}

// ── LA CORNICE PUÒ COMBACIARE COL MEDIA? ────────────────────────────────────
//  Per mettere il marchio nell'angolo DELLA FOTO (non dello schermo) e per
//  arrotondare gli angoli DELLA FOTO serve un riquadro grande esattamente
//  quanto il media disegnato. Con `object-contain` il riquadro dell'elemento è
//  più grande dell'immagine vera, e il logo finirebbe a mezz'aria.
//  La misura esatta la danno le unità di contenitore (cqw/cqh): un min() fra
//  larghezza disponibile e altezza disponibile per il rapporto del media è
//  la stessa matematica di `contain`, ma fatta dal foglio di stile.
//  ⚠️ Non esistono su iOS 15 (iPhone 7 e simili, ancora in giro). Lì la
//  dichiarazione verrebbe scartata, la cornice resterebbe senza misura e la
//  foto sparirebbe: si verifica il supporto e si torna al vecchio impianto
//  (media centrato, marchio nell'angolo dello schermo), che è brutto quanto
//  prima ma funziona. Una pagina di vendita non può mostrare il vuoto.
let supportoCornice: boolean | null = null;
function useCorniceEsatta(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (supportoCornice === null) {
      supportoCornice =
        typeof CSS !== "undefined" &&
        typeof CSS.supports === "function" &&
        CSS.supports("container-type", "size") &&
        CSS.supports("width", "min(100cqw, 100cqh)");
    }
    setOk(supportoCornice);
  }, []);
  return ok;
}

// ── UNA DIAPOSITIVA ─────────────────────────────────────────────────────────
//  Ogni media è un componente suo, e non un pezzo di JSX dentro il .map():
//  qui dentro servono degli stati (il rapporto del media, se il video è già
//  partito, se sta andando) e uno stato per diapositiva dentro il componente
//  della pagina significherebbe un hook per elemento di una lista di lunghezza
//  variabile — cioè il numero di hook che cambia da un render all'altro.
function Diapositiva({
  voce,
  rotta,
  segnalaRotta,
  primaDellaFila,
  menoMovimento,
  corniceEsatta,
}: {
  voce: VoceGalleria;
  rotta: boolean;
  segnalaRotta: () => void;
  primaDellaFila: boolean;
  menoMovimento: boolean;
  corniceEsatta: boolean;
}) {
  // Tutti gli stati in cima: sotto c'è più di un ritorno.
  const [rapporto, setRapporto] = useState(RAPPORTO_INIZIALE);
  const [caricato, setCaricato] = useState(false);
  const [avviato, setAvviato] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const rifVideo = useRef<HTMLVideoElement | null>(null);

  const memorizzaRapporto = useCallback((l: number, a: number) => {
    //  Un media che dichiara 0 (metadati incompleti, sorgente che non risponde)
    //  farebbe una cornice di altezza infinita: si tiene quella di partenza.
    if (!Number.isFinite(l) || !Number.isFinite(a) || l <= 0 || a <= 0) return;
    setRapporto(l / a);
  }, []);

  /** Il tocco sul pulsante centrale: il video parte QUI, mai da solo.
   *  L'audio si riaccende solo adesso — fino a un attimo fa l'elemento era muto
   *  perché stava facendo la parte della copertina, e un video che comincia a
   *  parlare da fermo sarebbe un lettore impazzito. */
  const avvia = useCallback(() => {
    const el = rifVideo.current;
    if (!el) return;
    el.muted = false;
    void el.play().catch(() => {
      //  Rifiutato (politiche del browser, sorgente non pronta): si riprova
      //  senza audio, che è comunque meglio di un pulsante che non fa niente.
      el.muted = true;
      void el.play().catch(() => {});
    });
  }, []);

  // ── IL MEDIA NON C'È PIÙ ──────────────────────────────────────────────────
  //  La raccolta conserva l'indirizzo, non il file: se il consulente cancella
  //  quel media dalla libreria il link continua a esistere, e senza questa
  //  schermata il cliente vedrebbe l'icona di immagine rotta del browser — che
  //  sembra un guasto suo. Il resto della raccolta resta guardabile.
  if (rotta) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 text-center">
        <Images className="h-7 w-7 text-white/25" />
        <span className="text-sm text-white/50">Questo contenuto non è più disponibile</span>
      </div>
    );
  }

  //  La cornice combacia col media, quindi qui dentro il media riempie tutto:
  //  `object-contain` non ha più niente da impaginare e non resta nessun bordo
  //  vuoto fra la foto e l'angolo arrotondato. Nel ripiego (niente unità di
  //  contenitore) si torna ai limiti massimi di sempre.
  const classeMedia = corniceEsatta
    ? "h-full w-full object-contain"
    : "max-h-full max-w-full rounded-2xl object-contain";
  //  Comparsa: una foto che appare di colpo mentre si sta ancora scorrendo
  //  sembra un caricamento andato male. Mezzo secondo di dissolvenza, e niente
  //  per chi ha chiesto meno movimento.
  const dissolvenza = menoMovimento
    ? ""
    : `transition-opacity duration-500 ${caricato ? "opacity-100" : "opacity-0"}`;

  const media =
    voce.kind === "image" ? (
      <img
        src={voce.url}
        alt={voce.nome}
        draggable={false}
        decoding="async"
        loading={primaDellaFila ? "eager" : "lazy"}
        onLoad={(e) => {
          memorizzaRapporto(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
          setCaricato(true);
        }}
        onError={segnalaRotta}
        className={`${classeMedia} ${dissolvenza}`}
      />
    ) : (
      <video
        ref={rifVideo}
        //  ── L'ANTEPRIMA DEL VIDEO ─────────────────────────────────────────
        //  Fermo sul primo fotogramma invece che nero: `#t=0.1` +
        //  preload="metadata". Stesso identico impianto della miniatura in
        //  /presenta, perché è quello che qui dentro è già dimostrato che
        //  funziona con lo Storage (richieste parziali).
        src={conPrimoFotogramma(voce.url)}
        preload="metadata"
        playsInline
        //  Muto SOLO finché fa la copertina: appena parte l'audio torna
        //  (vedi `avvia`), altrimenti si venderebbero video senza sonoro.
        muted={!avviato}
        //  I comandi compaiono quando servono. Prima non servono: c'è un
        //  pulsante grande in mezzo, e una barra di comandi su un video fermo
        //  è la cosa che fa scambiare l'anteprima per un lettore inceppato.
        controls={avviato}
        controlsList="nodownload"
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          memorizzaRapporto(el.videoWidth, el.videoHeight);
          setCaricato(true);
          //  Alcuni browser ignorano il frammento e restano sul fotogramma 0
          //  (spesso nero): una spinta esplicita al primo istante li allinea.
          if (el.currentTime < 0.05) {
            try {
              el.currentTime = 0.1;
            } catch {
              /* sorgente che non accetta il salto: si tiene il fotogramma 0 */
            }
          }
        }}
        //  ⚠️ RISVEGLIO IN EXTREMIS — il video non può restare trasparente.
        //  La dissolvenza tiene il media a opacità zero finché non si è
        //  presentato, e per un video "presentarsi" vuol dire `loadedmetadata`.
        //  Ma quell'evento può non arrivare MAI: con il risparmio energetico
        //  acceso (schermo giallo, batteria bassa — sul telefono di un cliente
        //  succede di continuo) iOS ignora `preload` e non scarica nulla finché
        //  non si tocca play. Senza queste due righe il cliente premeva play e
        //  sentiva l'audio di un video invisibile: il caso peggiore, perché
        //  sembra un sito rotto proprio nel momento in cui ha deciso di fidarsi.
        //  Appena c'è qualcosa da vedere — primi dati decodificati o
        //  riproduzione partita — il media si mostra.
        onLoadedData={() => setCaricato(true)}
        onPlay={() => {
          setCaricato(true);
          setAvviato(true);
          setInCorso(true);
        }}
        onPause={() => setInCorso(false)}
        onEnded={() => setInCorso(false)}
        onError={segnalaRotta}
        className={`${classeMedia} ${dissolvenza}`}
      />
    );

  //  Il segno che dice "è un video e si può far partire". Al centro, perché è
  //  l'unico punto che non finisce mai sotto i comandi; scuro e sfocato con un
  //  filo di bordo chiaro, perché deve restare leggibile sia su un fotogramma
  //  bianco (una sala) sia su uno nero (capelli, controluce).
  //  Sparisce mentre il video va e torna quando è in pausa: è anche il segnale
  //  che il video si è fermato perché il cliente è passato oltre.
  const pulsante = voce.kind !== "image" && !inCorso && (
    <button
      type="button"
      onClick={avvia}
      //  Etichetta neutra e non il nome della voce: quel nome è l'appunto
      //  interno del consulente (spesso "Media", a volte il nome di un
      //  cliente), quindi darebbe letture come "Riproduci il video Media" —
      //  o peggio, il nome di qualcun altro letto ad alta voce.
      aria-label="Riproduci il video"
      className={`absolute left-1/2 top-1/2 z-20 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/45 text-white shadow-[0_4px_24px_rgba(0,0,0,.55)] backdrop-blur-md ${
        menoMovimento
          ? ""
          : "transition duration-200 hover:scale-105 hover:bg-black/65 active:scale-95"
      }`}
    >
      <Play className="ml-0.5 h-7 w-7 fill-white/95" />
    </button>
  );

  //  Il marchio: su OGNI foto e su OGNI video, nell'angolo in basso a destra
  //  del media (non dello schermo). Sui video sta più in alto, fuori dalla
  //  fascia dei comandi.
  const marchio = (
    <MarchioSuMedia posizione={voce.kind === "image" ? "standard" : "sopraComandi"} />
  );

  if (!corniceEsatta) {
    //  Ripiego: nessuna cornice su misura, il media si impagina da sé e il
    //  marchio torna nell'angolo della diapositiva. Meno preciso, mai vuoto.
    return (
      <>
        {media}
        {pulsante}
        {marchio}
      </>
    );
  }

  return (
    <figure
      className="relative flex items-center justify-center overflow-hidden rounded-2xl bg-black/20 shadow-[0_10px_40px_rgba(0,0,0,.35)] ring-1 ring-white/10"
      style={{
        //  La stessa matematica di `contain`, ma fatta dal foglio di stile:
        //  la larghezza è la minore fra quella disponibile e quella che serve
        //  all'altezza disponibile — e l'altezza esce dal rapporto. Risultato:
        //  la cornice combacia col media al pixel, quindi l'angolo arrotondato
        //  smussa la foto senza ritagliarne un pezzo e il marchio è appoggiato
        //  davvero sulla foto.
        width: `min(100cqw, ${rapporto} * 100cqh)`,
        aspectRatio: `${rapporto}`,
        maxWidth: "100%",
        maxHeight: "100%",
        //  Il rapporto cambia una volta sola, quando il media si presenta:
        //  senza transizione la cornice fa uno scatto sotto gli occhi.
        transition: menoMovimento ? undefined : "width .35s ease, aspect-ratio .35s ease",
      }}
    >
      {media}
      {pulsante}
      {marchio}
    </figure>
  );
}

// ── DOVE SIAMO ARRIVATI ─────────────────────────────────────────────────────
//  Puntini finché si contano a colpo d'occhio; oltre, una barra che avanza.
//  Trenta puntini non dicono più "sei al terzo di otto", dicono solo "sono
//  tanti" — e sul telefono non se ne centra nemmeno uno col pollice.
function Indicatore({
  quante,
  indice,
  vaiA,
  menoMovimento,
}: {
  quante: number;
  indice: number;
  vaiA: (n: number) => void;
  menoMovimento: boolean;
}) {
  const morbido = menoMovimento ? "" : "transition-all duration-300 ease-out";
  if (quante > MAX_PUNTINI) {
    return (
      <div
        className="h-1.5 w-32 overflow-hidden rounded-full bg-white/15 sm:w-44"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={quante}
        aria-valuenow={indice + 1}
        aria-label="Avanzamento nella raccolta"
      >
        <div
          className={`h-full rounded-full bg-brand ${menoMovimento ? "" : "transition-transform duration-300 ease-out"}`}
          style={{ width: `${100 / quante}%`, transform: `translateX(${indice * 100}%)` }}
        />
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: quante }, (_, n) => (
        <button
          key={`punto-${n}`}
          type="button"
          onClick={() => vaiA(n)}
          aria-label={`Vai al contenuto ${n + 1}`}
          aria-current={n === indice}
          //  Il puntino si vede piccolo ma si preme grande: l'area cliccabile è
          //  alta e larga quanto un polpastrello, il segno dentro è discreto.
          className="flex h-8 items-center justify-center px-1"
        >
          <span
            className={`block h-1.5 rounded-full ${morbido} ${
              n === indice ? "w-6 bg-brand" : "w-1.5 bg-white/35 hover:bg-white/70"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

// ── UNA FRECCIA ─────────────────────────────────────────────────────────────
function Freccia({
  verso,
  onClick,
  disabilitata,
  className,
  style,
  menoMovimento,
}: {
  verso: "prima" | "dopo";
  onClick: () => void;
  disabilitata: boolean;
  className: string;
  /** Serve solo per i margini di sicurezza del dispositivo (`env(...)`), che
   *  non si scrivono in una utility senza rischiare che non venga generata. */
  style?: CSSProperties;
  menoMovimento: boolean;
}) {
  const Icona = verso === "prima" ? ChevronLeft : ChevronRight;
  //  ⚠️ Qui NON si scrive `flex`: chi chiama decide se la freccia si vede o no
  //  (ai lati sul computer, in basso sul telefono) e lo fa con hidden/flex. Due
  //  utility che decidono la stessa proprietà nella stessa stringa non si
  //  battono nell'ordine in cui sono scritte: vince quella generata per ultima
  //  nel foglio di stile, e ci si ritroverebbe con quattro frecce sul telefono.
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabilitata}
      style={style}
      aria-label={verso === "prima" ? "Contenuto precedente" : "Contenuto successivo"}
      className={`items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/85 backdrop-blur-md disabled:pointer-events-none disabled:opacity-25 ${
        menoMovimento
          ? ""
          : "transition duration-200 hover:scale-105 hover:bg-black/70 active:scale-95"
      } ${className}`}
    >
      <Icona className="h-5 w-5" />
    </button>
  );
}

function PaginaGalleria() {
  // ── TUTTI GLI STATI QUI SOPRA ─────────────────────────────────────────────
  //  Sotto ci sono tre schermate diverse (carico / non valido / carosello): un
  //  hook dichiarato dopo un return anticipato verrebbe contato solo in una
  //  parte dei render, e React perderebbe l'allineamento fra un render e
  //  l'altro. Si dichiara tutto prima, si sceglie cosa disegnare alla fine.
  const [stato, setStato] = useState<Stato>("carico");
  const [voci, setVoci] = useState<VoceGalleria[]>([]);
  const [indice, setIndice] = useState(0);
  //  UN MEDIA PUÒ MORIRE DOPO CHE IL LINK È PARTITO: si segna quale
  //  diapositiva non ha caricato (vedi Diapositiva).
  const [rotti, setRotti] = useState<Record<number, true>>({});
  //  La comparsa dell'intestazione, una volta sola all'apertura: la pagina si
  //  "posa" invece di apparire di scatto. Si accende dopo il primo disegno,
  //  altrimenti non c'è nessuno stato da cui animare.
  const [entrata, setEntrata] = useState(false);
  const menoMovimento = useMenoMovimento();
  const corniceEsatta = useCorniceEsatta();
  const pista = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);
  const quante = voci.length;

  useEffect(() => {
    //  Il codice si legge QUI e non durante il disegno: la pagina viene
    //  costruita anche sul server, dove `window` non esiste, e un valore che
    //  cambia fra il disegno del server e quello del browser fa ripartire la
    //  pagina da capo. Nell'effetto il browser c'è di sicuro.
    const c = codiceDaPercorso(window.location.pathname);
    //  Codice mal trascritto: non si chiede nemmeno al server, la risposta è
    //  già la schermata gentile.
    if (!c) {
      setStato("ko");
      return;
    }
    let vivo = true;
    fetch(`/api/public/galleria?codice=${encodeURIComponent(c)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!vivo) return;
        //  Quello che torna dalla rete non è ancora un elenco: si accetta solo
        //  ciò che si sa disegnare. Raccolta vuota = link non più valido.
        //  ⚠️ Il `titolo` della raccolta arriva ma NON si mostra: è il nome che
        //  il consulente ha dato al link e può contenere il nome di un cliente.
        const v = normalizzaVoci((j as { galleria?: { voci?: unknown } } | null)?.galleria?.voci);
        if (!v.length) {
          setStato("ko");
          return;
        }
        setVoci(v);
        setIndice(0);
        setRotti({});
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
    const t = setTimeout(() => setEntrata(true), 40);
    return () => clearTimeout(t);
  }, []);

  /** Porta il carosello su una posizione. Lo scorrimento resta quello nativo
   *  (è l'unico che sul telefono ha l'inerzia giusta): qui si sposta solo la
   *  barra, e `onScroll` aggiorna il contatore da solo. */
  const vaiA = useCallback(
    (n: number) => {
      const el = pista.current;
      if (!el || !el.clientWidth) return;
      const k = Math.max(0, Math.min(n, el.children.length - 1));
      try {
        //  Morbido, ma non per chi ha chiesto meno movimento: lì lo spostamento
        //  è secco e immediato.
        el.scrollTo({ left: k * el.clientWidth, behavior: menoMovimento ? "auto" : "smooth" });
      } catch {
        //  Browser che non conoscono le opzioni: meglio uno scatto secco che
        //  restare fermi.
        el.scrollLeft = k * el.clientWidth;
      }
      setIndice(k);
    },
    [menoMovimento],
  );

  //  Il contatore segue il dito, non il contrario: si legge la posizione della
  //  barra a ogni scorrimento, ma una volta per fotogramma — un evento di
  //  scroll arriva anche cento volte al secondo e ricalcolare a ogni colpo fa
  //  scattare l'animazione proprio mentre il cliente sta scorrendo.
  const alloScorrere = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const el = pista.current;
      if (!el || !el.clientWidth) return;
      const k = Math.round(el.scrollLeft / el.clientWidth);
      setIndice(Math.max(0, Math.min(k, el.children.length - 1)));
    });
  }, []);

  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    },
    [],
  );

  // Frecce della tastiera: su computer è il gesto che tutti provano per primo.
  useEffect(() => {
    if (stato !== "ok") return;
    const onTasto = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      //  ⚠️ QUANDO LE FRECCE NON SONO NOSTRE. Un video con i comandi, appena
      //  toccato, prende il fuoco: da quel momento le frecce servono a
      //  spostarsi di qualche secondo DENTRO il filmato, ed è quello che si
      //  aspetta chi vuole rivedere un passaggio. Intercettandole qui il
      //  cliente che prova a tornare indietro di cinque secondi si ritrova
      //  sulla foto successiva, e il video che stava guardando si mette in
      //  pausa. Se il fuoco è su un elemento che le frecce le usa già, si
      //  lascia perdere: il carosello si sposta comunque col dito, con le
      //  frecce a schermo e con i puntini.
      const dove = e.target as HTMLElement | null;
      const tag = dove?.tagName?.toLowerCase();
      if (
        tag === "video" ||
        tag === "audio" ||
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        dove?.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      vaiA(indice + (e.key === "ArrowRight" ? 1 : -1));
    };
    window.addEventListener("keydown", onTasto);
    return () => window.removeEventListener("keydown", onTasto);
  }, [stato, indice, vaiA]);

  //  Rotazione dello schermo o finestra ridimensionata: le diapositive sono
  //  larghe quanto la pista, quindi la posizione in pixel non vale più e ci si
  //  ritroverebbe fermi a metà fra due media.
  useEffect(() => {
    if (stato !== "ok") return;
    const onResize = () => {
      const el = pista.current;
      if (!el || !el.clientWidth) return;
      el.scrollLeft = indice * el.clientWidth;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [stato, indice]);

  //  Un video che resta in riproduzione mentre il cliente è già due foto più
  //  avanti continua a parlare da fuori campo: si mette in pausa tutto ciò che
  //  non è in vista.
  //  ⚠️ Si conta sulle DIAPOSITIVE, non sui video: `querySelectorAll("video")`
  //  numera solo i video, quindi in una raccolta [foto, video] il video è il
  //  numero 0 mentre la sua diapositiva è la numero 1. Con quel confronto si
  //  metteva in pausa proprio quello davanti agli occhi e si lasciava parlare
  //  quello fuori campo — cioè l'esatto contrario di quello che serve. Le
  //  diapositive invece sono numerate come `indice`, sempre.
  useEffect(() => {
    const el = pista.current;
    if (!el) return;
    Array.from(el.children).forEach((diapositiva, n) => {
      if (n === indice) return;
      diapositiva.querySelectorAll("video").forEach((v) => v.pause());
    });
  }, [indice, stato]);

  // ── SCHERMATA D'ATTESA ────────────────────────────────────────────────────
  if (stato === "carico") {
    return (
      <div className="bg-brandfill fixed inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
        <Images className="h-8 w-8 animate-pulse text-brand" />
        <span className="text-sm font-medium">Apro i contenuti…</span>
      </div>
    );
  }

  // ── LINK NON PIÙ VALIDO ───────────────────────────────────────────────────
  //  Mai una schermata tecnica, mai una pagina bianca: chi è arrivato qui ha
  //  fatto tutto giusto: ha toccato un link che gli è stato mandato. Gli si
  //  dice cosa è successo e cosa può fare, con il marchio davanti agli occhi.
  if (stato === "ko") {
    return (
      <div className="bg-brandfill fixed inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <BrandLogo className="h-8 w-auto" />
        <h1 className="text-lg font-semibold text-white">Questo link non è più valido</h1>
        <p className="max-w-sm text-sm leading-relaxed text-white/60">
          I contenuti che c'erano qui non sono più disponibili. Scrivi al tuo consulente: te ne
          manda uno nuovo in un attimo.
        </p>
      </div>
    );
  }

  // ── IL CAROSELLO ──────────────────────────────────────────────────────────
  //  Tre fasce in colonna — intestazione, media, comandi — invece di comandi
  //  appoggiati sopra il media: così niente si sovrappone a niente, la barra di
  //  un video non finisce mai sotto i puntini, e lo spazio che resta al media è
  //  esattamente quello che si vede.
  const comparsa = menoMovimento
    ? ""
    : `transition-all duration-500 ease-out ${entrata ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"}`;

  return (
    <div className="bg-brandfill fixed inset-0 flex flex-col overflow-hidden">
      {/* ── INTESTAZIONE ────────────────────────────────────────────────────
          Marchio, titolo, e quanti sono. Chi apre il link deve capire in un
          secondo di chi è la pagina e cosa ci troverà dentro. */}
      <header
        className={`flex flex-none flex-col items-center gap-1 px-4 pb-2 pt-4 text-center ${comparsa}`}
        //  La pagina occupa tutto lo schermo: su un telefono con la tacca il
        //  titolo finirebbe sotto l'orologio. Si prende il maggiore fra la
        //  distanza normale e quella dichiarata dal dispositivo.
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <BrandLogo className="h-5 w-auto" />
        <h1 className="text-base font-semibold tracking-tight text-white sm:text-lg">{TITOLO}</h1>
        <p className="text-[11px] text-white/55 sm:text-xs">
          {quante === 1
            ? "1 contenuto selezionato per te"
            : `${quante} contenuti selezionati per te`}
        </p>
      </header>

      {/* ── LA PISTA ────────────────────────────────────────────────────────
          Scorrimento nativo con aggancio, così sul telefono il dito ha
          l'inerzia e il "clic" a fine trascinamento a cui il cliente è
          abituato, e su computer funziona anche la rotella orizzontale.
          `overscroll-x-contain` evita che uno scorrimento oltre l'ultima foto
          faccia scattare il "torna indietro" del browser. */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={pista}
          onScroll={alloScorrere}
          className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain"
          style={{ scrollbarWidth: "none" }}
        >
          {voci.map((v, n) => (
            <div
              key={`${v.url}-${n}`}
              className="relative flex h-full w-full flex-none snap-center items-center justify-center px-3 py-1 sm:px-10 sm:py-2"
              //  La diapositiva fa da contenitore di misura: è da qui che la
              //  cornice legge quanto spazio ha (cqw/cqh), padding già tolto.
              style={corniceEsatta ? { containerType: "size" } : undefined}
            >
              <Diapositiva
                voce={v}
                rotta={!!rotti[n]}
                segnalaRotta={() => setRotti((r) => ({ ...r, [n]: true }))}
                primaDellaFila={n === 0}
                menoMovimento={menoMovimento}
                corniceEsatta={corniceEsatta}
              />
            </div>
          ))}
        </div>

        {/* Frecce grandi ai lati: su computer sono il gesto naturale, e a
            metà altezza non coprono né il titolo né i comandi del video.
            Sul telefono le stesse frecce stanno in basso, dove arriva il
            pollice (vedi la fascia dei comandi).
            ⚠️ Un telefono girato in orizzontale è largo più di 640px, quindi
            queste frecce ci COMPAIONO — e su un iPhone con la tacca la tacca
            sta proprio lì, a sinistra, sopra la freccia "indietro". Si prende
            il maggiore fra la distanza normale e quella dichiarata dal
            dispositivo: guardare un video di risultati in orizzontale è
            esattamente quello che fa chi si sta convincendo. */}
        {quante > 1 && (
          <>
            <Freccia
              verso="prima"
              onClick={() => vaiA(indice - 1)}
              disabilitata={indice === 0}
              menoMovimento={menoMovimento}
              className="absolute top-1/2 z-20 hidden -translate-y-1/2 p-3 sm:flex"
              style={{ left: "max(0.75rem, env(safe-area-inset-left))" }}
            />
            <Freccia
              verso="dopo"
              onClick={() => vaiA(indice + 1)}
              disabilitata={indice >= quante - 1}
              menoMovimento={menoMovimento}
              className="absolute top-1/2 z-20 hidden -translate-y-1/2 p-3 sm:flex"
              style={{ right: "max(0.75rem, env(safe-area-inset-right))" }}
            />
          </>
        )}
      </div>

      {/* ── I COMANDI ───────────────────────────────────────────────────────
          Frecce a portata di pollice, dove si è arrivati, e il conto in
          chiaro: tre informazioni sulla stessa riga, in fondo allo schermo,
          fuori dal media. */}
      {quante > 1 && (
        <div
          className="flex flex-none items-center justify-center gap-3 px-4 pb-5 pt-3 sm:gap-5"
          //  Sotto, la barra di sistema dell'iPhone: senza questo margine le
          //  frecce ci finiscono sopra e il pollice preme "torna alla schermata
          //  principale" invece della foto successiva.
          style={{ paddingBottom: "max(1.25rem, calc(env(safe-area-inset-bottom) + 0.5rem))" }}
        >
          <Freccia
            verso="prima"
            onClick={() => vaiA(indice - 1)}
            disabilitata={indice === 0}
            menoMovimento={menoMovimento}
            className="flex h-11 w-11 flex-none sm:hidden"
          />
          <div className="flex min-w-0 flex-col items-center gap-1.5">
            <Indicatore quante={quante} indice={indice} vaiA={vaiA} menoMovimento={menoMovimento} />
            <span className="text-[11px] font-medium tabular-nums text-white/55 sm:text-xs">
              {indice + 1} di {quante}
            </span>
          </div>
          <Freccia
            verso="dopo"
            onClick={() => vaiA(indice + 1)}
            disabilitata={indice >= quante - 1}
            menoMovimento={menoMovimento}
            className="flex h-11 w-11 flex-none sm:hidden"
          />
        </div>
      )}
    </div>
  );
}
