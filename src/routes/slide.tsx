import { createFileRoute , useNavigate } from "@tanstack/react-router";
import { sfx } from "@/shop/sfx";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { guardataDaUnaSala, useLiveId, watchId as getWatch, useLiveNav } from "@/shop/live";
import { pubblicaContenuti, salaDallIndirizzo, salaDeiContenuti, salaDiRegiaDallIndirizzo } from "@/webinar/contenuti";
//  Pigra: il pacchetto della barra non deve finire in quello della pagina,
//  che la apre anche il cliente (vedi shop/BarraPresentatore).
import { BarraPresentatore as PresenterBar } from "@/shop/BarraPresentatore";
import { BrandLogo } from "@/shop/BrandLogo";
import { DeviceFrame } from "@/shop/DeviceFrame";
import { CasesManager, type Caso } from "@/shop/CasesManager";
import { useConsultant } from "@/shop/consultant";
import { resetOwnZoom, guestContentSeen, WaitingScreen, useGuestChannel } from "@/shop/call";
import { promoDeadline, formatDeadline, patentDateLabel } from "@/shop/quote-menu";

/** Anno in cui abbiamo cominciato: la "storia" si racconta con una data
 *  verificabile, non con un conteggio di persone che nessuno può controllare. */
const ANNO_INIZIO = 2021;
import { useZoomPan, ZoomControls } from "@/shop/zoompan";
import { readPointerPref, writePointerPref, makePointerHysteresis } from "@/shop/pointer";
import { PointerDot } from "@/shop/PointerDot";
import { readAnchor, applyAnchor, logOut, scrollContext, type ScrollAnchor } from "@/shop/scrollsync";
import { Toaster } from "@/components/ui/sonner";
import {
  ChevronLeft, ChevronRight, Radio, Fingerprint, Layers, ShieldCheck, ScanFace,
  Sparkles, CalendarClock, BadgeCheck, Flame, Quote, Wand2, TrendingUp, HeartHandshake, ArrowRight,
  Settings2, Volume2, MoveHorizontal, MapPin, Star, Trash2,
  Pencil, RotateCcw, SplitSquareHorizontal, ChevronUp, ChevronDown, Pointer, ExternalLink,
} from "lucide-react";

// set fisso di icone selezionabili nell'editor inline delle slide (Feature 6)
type LucideIconT = typeof Fingerprint;
const SLIDE_ICONS: Record<string, LucideIconT> = {
  Fingerprint, ScanFace, Layers, ShieldCheck, Sparkles, CalendarClock, BadgeCheck,
  Flame, Quote, Wand2, TrendingUp, HeartHandshake, ArrowRight, Star,
};
type SlideOverride = { eyebrow?: string; title?: string; sub?: string; big?: string; icon?: string };
// slide personalizzate: template + campi necessari (retrocompat con {id,eyebrow,title,sub})
type SlideTemplate = "text" | "statement" | "bullet";
type CustomBullet = { icon?: string; t?: string; d?: string };
type CustomSlide = { id: string; template?: SlideTemplate; eyebrow?: string; title?: string; sub?: string; big?: string; icon?: string; bullets?: CustomBullet[]; footnote?: string };

export const Route = createFileRoute("/slide")({
  head: () => {
    const T = "Come funziona, spiegato bene";
    const D = "Tre strade per rimettere i capelli. Le vediamo insieme, senza fretta.";
    const IMG = "https://tanstack-start-app.shop-primeprestige.workers.dev/api/og/card?tipo=presentazione";
    return {
      meta: [
        { title: "Presentazione — Hair Genius Labs" },
        { name: "robots", content: "noindex" },
        { name: "description", content: D },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "Hair Genius Labs" },
        { property: "og:title", content: T },
        { property: "og:description", content: D },
        { property: "og:image", content: IMG },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: IMG },
        { name: "theme-color", content: "#050f24" },
      ],
    };
  },
  component: () => <DeviceFrame><SlidePage /></DeviceFrame>,
});

type LucideIcon = typeof Fingerprint;
/** Barra di confronto: una riga, un'etichetta, una percentuale piena.
 *  Serve dove le parole non bastano — un rapporto si capisce guardandolo. */
interface SlideBar { label: string; pct: number; note?: string; tone?: "brand" | "muted" }

interface Slide {
  eyebrow: string; title: React.ReactNode; sub?: string; big?: string; icon?: LucideIcon;
  bars?: SlideBar[];
  /** Fonte consultabile: si apre SOPRA la slide, sul dispositivo di entrambi.
   *  Serve a mostrare da dove viene un'affermazione mentre la si dice, invece
   *  di chiedere al cliente di fidarsi. Passando alla slide dopo si chiude. */
  fonte?: { label: string; url: string };
  bullets?: { icon: LucideIcon; t: string; d?: string }[]; footnote?: string; accent?: boolean;
  caso?: Caso;
  // "Mostra separati": il caso prima/dopo diventa DUE slide distinte del mazzo
  only?: "before" | "after";
}

const SLIDES: Slide[] = [
  // ── SCRITTE PER ESSERE LETTE AD ALTA VOCE ────────────────────────────────
  //  Ogni riga è una frase intera, con il ritmo del parlato: il consulente può
  //  leggerla così com'è e il cliente capisce, senza che nessuno debba
  //  aggiungere niente. Niente etichette telegrafiche ("Standard — incluso"),
  //  che a voce suonano come un listino letto male.
  //  Nessun prezzo: un numero su una slide chiude il discorso, il cliente
  //  smette di ascoltare e comincia a fare i conti. I prezzi stanno nel
  //  preventivo, dove ogni voce ha accanto il motivo per cui esiste.
  { eyebrow: "Come lavoriamo", title: <>Oggi facciamo chiarezza. <span className="text-brand">Poi decidi tu.</span></>, big: "Tre strade", sub: "Esistono tre modi di rimettere i capelli. Li guardiamo tutti e tre con calma, e alla fine saprai qual è il tuo.", icon: Fingerprint, accent: true },

  { eyebrow: "Le tre strade", title: <>Sono tre, e sono <span className="text-brand">molto diverse.</span></>, bullets: [
    { icon: MapPin, t: "Il trapianto", d: "Sono i tuoi capelli e ricrescono davvero. Ma servono mesi di attesa." },
    { icon: Layers, t: "La patch cutanea", d: "È il sistema classico del settore: arriva già fatta, uguale per tutti." },
    { icon: Fingerprint, t: "L'Invisible Derm Protocol", d: "È il nostro brevetto: viene costruito su di te, pezzo per pezzo." },
  ], footnote: "Una sola di queste tre è quella giusta per il tuo caso. Nei prossimi minuti capiamo quale." },

  // ── IL TRAPIANTO, DETTO PER INTERO ───────────────────────────────────────
  //  Prima quello che ottiene davvero: se il pregio non è dichiarato con
  //  onestà, tutto il resto suona come una stroncatura interessata.
  { eyebrow: "Trapianto", title: <>Che cos'è, <span className="text-brand">in concreto.</span></>, bullets: [
    { icon: MapPin, t: "Un intervento chirurgico", d: "Si prelevano i tuoi capelli dalla nuca e si reimpiantano dove mancano." },
    { icon: ScanFace, t: "Uno a uno, con le tecniche FUE e DHI", d: "Non si aggiungono capelli: si spostano quelli che hai già." },
    { icon: CalendarClock, t: "Cinque giorni, una volta sola", d: "Poi il risultato cresce da sé, nell'arco di mesi." },
  ], footnote: "È l'unica delle tre strade in cui i capelli sono tuoi e ricrescono davvero." },

  { eyebrow: "Il trapianto · cosa ottieni", title: <>Sono i tuoi capelli. <span className="text-brand">Per sempre.</span></>, bullets: [
    { icon: Sparkles, t: "Ricrescono davvero", d: "Escono dalla tua pelle: nessuno potrà mai accorgersene, perché non c'è nulla da accorgersi." },
    { icon: ShieldCheck, t: "Non c'è manutenzione", d: "Niente rifissaggi, niente appuntamenti fissi in calendario." },
    { icon: HeartHandshake, t: "Si fa una volta", d: "Cinque giorni, e poi la questione è chiusa." },
  ], footnote: "Quando le condizioni ci sono, è la strada migliore. Il punto è capire se ci sono." },

  //  Poi i limiti reali. Non esagerati: sono quelli che un chirurgo serio
  //  dice in visita, e che il cliente scoprirebbe comunque — meglio da noi.
  { eyebrow: "Il trapianto · cosa comporta", title: <>Non dipende <span className="text-brand">solo dalla volontà.</span></>, bullets: [
    { icon: ScanFace, t: "Serve una zona donatrice", d: "I capelli si spostano, non si creano. Se dietro non ce n'è abbastanza, la copertura piena non è possibile." },
    { icon: CalendarClock, t: "Otto-dodici mesi di attesa", d: "E nelle prime settimane cadono anche quelli appena messi: si chiama shock loss, è normale ma va accettato." },
    { icon: Flame, t: "La calvizie va avanti lo stesso", d: "Il trapianto non ferma la caduta dei capelli intorno: spesso servono altre sedute negli anni." },
  ], footnote: "E raramente basta da solo: quasi sempre si accompagna a terapie di mantenimento, sedute di PRP, a volte tricopigmentazione per simulare la densità che manca." },

  { eyebrow: "Il trapianto · a distanza di anni", title: <>Può ricadere. <span className="text-brand">Anche dopo due anni.</span></>, bullets: [
    { icon: Flame, t: "I capelli intorno continuano a cadere", d: "Il trapianto non cura la calvizie: sposta capelli, non la ferma." },
    { icon: ScanFace, t: "Si aprono buchi accanto al trapiantato", d: "Ed è il motivo per cui a distanza di anni servono altre sedute." },
    { icon: CalendarClock, t: "Serve mantenimento continuo", d: "Terapie, PRP, controlli: per tenere quello che c'era prima, non quello trapiantato." },
  ], footnote: "Chiedi sempre alla clinica quale percentuale dei loro casi torna per una seconda seduta, e a distanza di quanto tempo. È il dato che conta.",
    fonte: { label: "Cosa dice la società internazionale di settore", url: "https://ishrs.org/patients/" } },

  { eyebrow: "Il trapianto · il dopo", title: <>Le settimane <span className="text-brand">dopo l'intervento.</span></>, bullets: [
    { icon: Layers, t: "Crosticine e gonfiore", d: "Per i primi giorni si vede che hai fatto qualcosa. Si dorme a pancia in su." },
    { icon: ShieldCheck, t: "Niente sport, mare e sole", d: "Per settimane. Nessuna palestra, nessuna piscina, cappello obbligato." },
    { icon: MapPin, t: "I controlli sono a distanza", d: "L'intervento si fa lì, ma i mesi dopo li passi qui." },
  ], footnote: "Nessuna di queste cose è drammatica. Sommate, però, sono un anno della tua vita." },

  // ── L'INFOLTIMENTO NON CHIRURGICO ────────────────────────────────────────
  { eyebrow: "L'altra via", title: <>L'infoltimento <span className="text-brand">non chirurgico.</span></>, bullets: [
    { icon: Layers, t: "Non si tocca la pelle", d: "Nessun taglio, nessun ago, nessuna anestesia: si appoggia sopra." },
    { icon: CalendarClock, t: "Si installa in meno di due ore", d: "In studio, una volta sola. Esci con i capelli." },
    { icon: ScanFace, t: "Il risultato è quello del primo giorno", d: "Non deve crescere: quello che vedi uscendo è quello che resta." },
  ], footnote: "È la strada per chi non può o non vuole aspettare mesi, e per chi non ha una zona donatrice sufficiente." },

  { eyebrow: "La domanda che fanno tutti", title: <>Rovina i capelli <span className="text-brand">che ho ancora?</span></>, big: "No", sub: "E non è un'opinione: è come funziona la pelle. Il capello non prende nutrimento dall'aria, lo prende dal sangue — dalla papilla dermica, sotto la cute. Coprire la superficie non toglie nulla al bulbo.", icon: ShieldCheck, accent: true,
    fonte: { label: "Come si nutre il capello — fonte scientifica", url: "https://www.ncbi.nlm.nih.gov/books/NBK499948/" } },

  { eyebrow: "Il vero rischio, detto per intero", title: <>Il problema non è coprire. <span className="text-brand">È tirare.</span></>, bullets: [
    { icon: ShieldCheck, t: "La cute non respira dall'esterno", d: "L'ossigeno alla pelle arriva dal circolo sanguigno: il mito del soffocamento non ha base fisiologica." },
    { icon: Flame, t: "Quello che danneggia è la trazione", d: "Un fissaggio troppo teso, tirato per mesi, può indebolire i capelli sotto: si chiama alopecia da trazione." },
    { icon: BadgeCheck, t: "Per questo il rifissaggio è regolare", d: "Si stacca, si pulisce la cute, si rimette senza tensione. È lì che si evita il problema." },
  ], footnote: "Chi ti dice che «non c'è nessun rischio» ti sta raccontando una cosa comoda. Il rischio esiste e si evita così.",
    fonte: { label: "Alopecia da trazione — fonte scientifica", url: "https://www.ncbi.nlm.nih.gov/books/NBK470434/" } },

  { eyebrow: "La materia prima", title: <>Sono capelli veri. <span className="text-brand">Non fibra sintetica.</span></>, bullets: [
    { icon: Sparkles, t: "Capello umano al cento per cento", d: "Nei due impianti. Col trapianto invece sono i tuoi, spostati da dietro." },
    { icon: Layers, t: "Europeo oppure indiano", d: "Il primo è più sottile, il secondo più corposo: scegliamo quello uguale al tuo." },
    { icon: Wand2, t: "Vergine oppure trattato", d: "Il vergine tiene il colore più a lungo, il trattato lo porta in qualsiasi tonalità." },
  ], footnote: "La lunghezza che forniamo è di quindici centimetri." },

  { eyebrow: "Quello che non cambia mai", title: <>La base è la stessa <span className="text-brand">in tutti i casi.</span></>, big: "0,03 micron", sub: "Tre centesimi di millimetro. È identica in tutti i casi: al tatto e alla vista si comporta allo stesso modo. Su questo non c'è nulla da scegliere.", icon: Layers, accent: true },

  { eyebrow: "La vita di tutti i giorni", title: <>Puoi fare tutto. <span className="text-brand">E intendo tutto.</span></>, big: "Mare, palestra, immersioni", sub: "Ti asciughi col phon, sudi in palestra, vai al mare, resti sott'acqua a lungo. Non esiste una lista di cose da evitare.", icon: ShieldCheck, accent: true },

  { eyebrow: "La manutenzione", title: <>Ogni due o quattro settimane <span className="text-brand">si rifissa.</span></>, bullets: [
    { icon: CalendarClock, t: "Non dipende dal prodotto che scegli", d: "Dipende da una cosa sola: quanto è acido il tuo sudore." },
    { icon: Flame, t: "Più il sudore è acido, più spesso", d: "Chi ha il sudore acido sta sui quindici giorni, gli altri arrivano tranquillamente a trenta." },
    { icon: ScanFace, t: "Puoi capirlo da solo, stasera", d: "Guarda quanto in fretta senti l'odore sotto le ascelle: più è veloce, più il tuo sudore è acido." },
  ], footnote: "Vale per tutte e tre le strade: su questo non cambia niente." },

  // ── PARETO: il perno del discorso ────────────────────────────────────────
  //  Una legge che il cliente conosce già, applicata al suo problema. Le due
  //  barre dicono in un colpo d'occhio quello che tre paragrafi non direbbero.
  { eyebrow: "La legge dell'80/20", title: <>L'ottanta per cento è uguale. <span className="text-brand">Decide il venti.</span></>, bars: [
    { label: "L'80% — quello che è uguale per tutti", pct: 80, note: "Tipo di capello · base in poliuretano o lace · cerotto capillare con capelli innestati · tecnica di applicazione · colle e biadesivi.", tone: "muted" },
    { label: "Il 20% — quello che decide il risultato", pct: 20, note: "Tipo di innesto · attaccatura sulla tua morfologia e sulla tua età · densità divisa per zone · direzione dei capelli ricostruita dal vertice." },
  ], footnote: "L'ottanta per cento del lavoro lo fa chiunque. È quel venti per cento che si vede o non si vede." },

  { eyebrow: "Dentro quel venti per cento", title: <>Quattro cose. <span className="text-brand">Nessuna si vede da sola.</span></>, bullets: [
    { icon: ScanFace, t: "L'attaccatura", d: "Disegnata sulla forma del tuo viso e sulla tua età: a vent'anni non è la stessa che a cinquanta." },
    { icon: Layers, t: "La densità per zone", d: "Non uniforme: più rada davanti, più piena dietro. Come cresce davvero." },
    { icon: Wand2, t: "La direzione", d: "Ricostruita dal vertice, seguendo la mappa con cui i capelli escono dalla testa." },
  ], footnote: "E il tipo di innesto, che decide quanto tutto questo resiste nel tempo." },

  { eyebrow: "Il risultato", title: <>Una cosa sola non basta. <span className="text-brand">La somma sì.</span></>, big: "Invisibile", sub: "Attaccatura, resistenza, tecnica e misure su di te. Messe insieme fanno un impianto che non si vede. Toglierne una basta per farlo notare.", icon: Sparkles, accent: true },

  { eyebrow: "Patch Cutanea", title: <>Che cos'è, <span className="text-brand">in concreto.</span></>, bullets: [
    { icon: Layers, t: "Un cerotto capillare", d: "Una base sottilissima con dentro capelli veri, innestati uno a uno." },
    { icon: Fingerprint, t: "Base in poliuretano o lace", d: "Il poliuretano si fonde meglio con la pelle, il lace lascia respirare di più." },
    { icon: Wand2, t: "Si applica con colle e biadesivi", d: "Nessun intervento, nessun ago: si posiziona e tiene." },
  ], footnote: "È la struttura di base di qualunque impianto: da qui partono tutti." },

  { eyebrow: "La patch · cosa ottieni", title: <>Risultato oggi, <span className="text-brand">senza aspettare.</span></>, bullets: [
    { icon: CalendarClock, t: "Esci con i capelli", d: "Nessuna attesa di mesi: il cambiamento lo vedi lo stesso giorno." },
    { icon: BadgeCheck, t: "Nessuna condizione da rispettare", d: "Non serve una zona donatrice, non serve essere un caso adatto." },
    { icon: HeartHandshake, t: "Si può tornare indietro", d: "Non è un intervento: se cambi idea, si toglie." },
  ], footnote: "Esiste dagli anni Novanta ed è collaudato. Fa quello per cui è nato." },

  { eyebrow: "La patch · cosa comporta", title: <>Arriva già fatta. <span className="text-brand">Uguale per tutti.</span></>, bullets: [
    { icon: ScanFace, t: "L'attaccatura è di serie", d: "Non è disegnata sul tuo viso: è la stessa linea che riceve chiunque altro." },
    { icon: Layers, t: "Le misure sono standard", d: "Il tuo cranio no. Quello che avanza si adatta come si può." },
    { icon: Wand2, t: "Personalizzi colore e taglio", d: "Sul resto non c'è niente da decidere." },
  ], footnote: "Da lontano funziona. È da vicino che si nota la differenza." },

  { eyebrow: "La patch cutanea", title: <>Quanto puoi <span className="text-brand">decidere tu.</span></>, bars: [
    { label: "Quanto è personalizzabile", pct: 20, note: "Puoi scegliere il colore e il taglio. Base e attaccatura arrivano già fatte.", tone: "muted" },
  ], footnote: "Esiste dagli anni Novanta ed è collaudato. Fa quello per cui è nato, e si ferma lì." },

  { eyebrow: "Invisible Derm Protocol", title: <>Che cos'è, <span className="text-brand">in concreto.</span></>, bullets: [
    { icon: Fingerprint, t: "La stessa struttura di base", d: "Capelli veri su base sottilissima: l'ottanta per cento di partenza è identico." },
    { icon: ScanFace, t: "Il venti per cento rifatto da capo", d: "Attaccatura, densità per zone, direzione e tipo di innesto: decisi sul tuo caso." },
    { icon: Sparkles, t: "Il bordo sparisce nella pelle", d: "Non c'è una linea dove finisce la base e comincia la fronte." },
  ], footnote: "Stessa materia prima. Lavorazione completamente diversa." },

  { eyebrow: "L'Invisible Derm Protocol", title: <>Costruito su di te. <span className="text-brand">Da zero.</span></>, bars: [
    { label: "Quanto puoi decidere tu", pct: 100, note: "Attaccatura, resistenza, colore, densità, direzione di crescita: ogni cosa viene decisa sul tuo caso." },
  ], footnote: "L'attaccatura è fusa alla pelle: non si sente nemmeno passandoci sopra la mano." },

  { eyebrow: "Perché cambia tutto", title: <>Nessuna attesa. <span className="text-brand">Nessuna condizione.</span></>, bullets: [
    { icon: CalendarClock, t: "Il risultato è oggi", d: "Non fra otto mesi, e senza passare da crosticine, gonfiore e mesi di attese." },
    { icon: ScanFace, t: "Non serve essere un caso adatto", d: "Non dipende da quanti capelli hai dietro: funziona comunque." },
    { icon: Fingerprint, t: "Regge lo sguardo ravvicinato", d: "Anche a pochi centimetri. Anche passandoci la mano sopra." },
  ], footnote: "È l'unica delle tre in cui la densità la decidi tu, invece di prendere quella che avanza." },

  { eyebrow: "La domanda da farsi", title: <>Chi ti guarda, <span className="text-brand">da quanto vicino lo fa?</span></>, sub: "Se le persone ti guardano da un metro, la patch cutanea ti basta. Se invece c'è chi ti vede la mattina appena sveglio, allora no.", icon: ScanFace, accent: true },

  { eyebrow: "Quanto dura", title: <>Tre innesti diversi. <span className="text-brand">Cambia solo la durata.</span></>, bullets: [
    { icon: Layers, t: "L'innesto standard", d: "È incluso e dura quello che deve durare." },
    { icon: TrendingUp, t: "L'innesto bilanciato", d: "Ha un ancoraggio singolo: tiene una via di mezzo." },
    { icon: ShieldCheck, t: "L'innesto rinforzato", d: "Ha il doppio ancoraggio e di norma dura il doppio." },
  ], footnote: "Aspetto e naturalezza restano identici in tutti e tre: cambia soltanto ogni quanto va rifatto." },

  { eyebrow: "Se qualcosa va storto", title: <>Non resti mai <span className="text-brand">con un problema in mano.</span></>, big: "Fino a tre volte l'anno", sub: "Lo rigeneriamo e torna come il primo giorno. Se non è recuperabile ne costruiamo uno nuovo su di te. Sempre alle stesse condizioni, per tutto il tempo in cui lavoreremo insieme.", icon: HeartHandshake, accent: true },

// ── DA QUANTO, E DA QUANDO ───────────────────────────────────────────
  //  Niente conteggio di persone: un numero tondo e alto non si può
  //  verificare, e chi ascolta lo sconta. Le due date invece sono
  //  controllabili e dicono la stessa cosa in modo più forte — una è la
  //  storia, l'altra è il fatto che il prodotto migliore è recente.
  { eyebrow: "Da quanto lo facciamo", title: <>Dal <span className="text-brand">{ANNO_INIZIO}</span>, su un solo mestiere.</>, big: `${new Date().getFullYear() - ANNO_INIZIO} anni su questo e basta`, sub: "Non facciamo altro. Ogni caso passato è il motivo per cui oggi riusciamo a dirti in anticipo cosa aspettarti dal tuo.", icon: TrendingUp, accent: true },

  { eyebrow: "Da quando esiste", title: <>L'Invisible Derm Protocol <span className="text-brand">è recente.</span></>, big: patentDateLabel(), sub: "Non esisteva fino a pochi mesi fa: è la versione più avanzata di quello che abbiamo imparato in tutti questi anni.", icon: Sparkles, accent: true },

  { eyebrow: "Le prove", title: <>Non devi crederci <span className="text-brand">sulla parola.</span></>, big: "Prima e dopo", sub: "Queste sono persone vere, non fotografie di repertorio. Guarda l'attaccatura da vicino: è lì che si capisce se un lavoro è fatto bene.", icon: Quote },
];




// slide finali costruite con i numeri configurabili (social proof, garanzia, offerta, urgenza)
function tailSlides(stats: Record<string, string>): Slide[] {
  const deadline = formatDeadline(promoDeadline());
  return [
    // Mostrare l'alternativa che NON si sta vendendo è ciò che rende credibile
    // tutto il resto — e chi non è adatto all'impianto trova comunque una via.
    { eyebrow: "Il trapianto", title: <>E se volessi <span className="text-brand">i tuoi, per sempre?</span></>, bullets: [
      { icon: MapPin, t: "Cinque giorni a Istanbul", d: "Nella clinica con cui lavoriamo, seguito da noi dall'inizio alla fine." },
      { icon: HeartHandshake, t: "L'hotel è incluso, per due persone", d: "Il volo invece resta a carico tuo." },
      { icon: CalendarClock, t: "La ricrescita richiede otto-dodici mesi", d: "Serve pazienza: il risultato non si vede subito." },
    ], footnote: "Te ne parliamo perché esiste, non perché te lo stiamo consigliando: dipende da com'è il tuo caso." },

    { eyebrow: "Su misura", title: <>Quello che <span className="text-brand">disegniamo su di te.</span></>, bullets: [
      { icon: ScanFace, t: "L'attaccatura e la densità", d: "La linea la disegniamo sul tuo viso, e la quantità di capelli la calibriamo sulla tua età." },
      { icon: Wand2, t: "Il colore e il movimento", d: "Il colore lo legge il software dalle tue foto: non è una stima a occhio." },
      { icon: Sparkles, t: "La simulazione, prima di produrre", d: "Vedi come starà su di te prima che l'impianto venga costruito." },
    ], footnote: "L'installazione la facciamo in studio, in meno di due ore." },

    { eyebrow: "Se non ti convince", title: <>Il rischio <span className="text-brand">resta nostro.</span></>, big: "Si rifà", sub: stats.guarantee || "Se guardandoti allo specchio l'attaccatura non ti convince, la rifacciamo. Deve piacere a te, non a noi.", icon: HeartHandshake, accent: true },

    { eyebrow: "Una possibilità in più", title: <>C'è chi accetta di <span className="text-brand">raccontare il risultato.</span></>, bullets: [
      { icon: BadgeCheck, t: "Una breve testimonianza", d: "Registrata a lavoro finito, quando il risultato lo hai già davanti." },
      { icon: HeartHandshake, t: "Condizioni diverse", d: "Con chi sceglie di farlo lavoriamo a condizioni dedicate." },
      { icon: Star, t: `${stats.spotsLeft || "9"} casi su ${stats.spotsTotal || "12"}`, d: "Sono quelli che seguiamo così in questo periodo." },
    ], footnote: "È una possibilità, non una condizione: senza cambia soltanto questo.", accent: true },

    // Chiusura: il preventivo non è un prezzo, è l'elenco delle scelte fatte.
    { eyebrow: "Adesso", title: <>Non un foglio già fatto. <span className="text-brand">Un elenco di scelte.</span></>, big: "Componibile", sub: "Lo costruiamo insieme, una voce alla volta: tieni quello che ha senso per te, togli quello che non ne ha. Alla fine ci arrivi tu.", icon: ArrowRight, accent: true },

    { eyebrow: "Quando te la senti", title: <>Si parte <span className="text-brand">dalla progettazione.</span></>, big: "Il resto alla consegna", sub: "Con l'acconto teniamo il tuo posto e cominciamo a progettare il tuo impianto. Il resto lo sistemi il giorno in cui lo ricevi.", icon: Sparkles, accent: true },
  ];
}


// ── SCROLL SYNC — helper condivisi presentatore/ospite ────────────────────
//  Un SOLO scroller su entrambi i lati: l'elemento marcato data-hg-scroll="slide"
//  (il <main> con l'area contenuto). La pagina non scorre mai (h-screen +
//  overflow-hidden sul wrapper) → niente ambiguità window/body/main.
const slideScroller = (): HTMLElement | null =>
  (typeof document === "undefined" ? null : (document.querySelector('[data-hg-scroll="slide"]') as HTMLElement | null));
const scrollRange = (el: Element | null | undefined): number =>
  el ? el.scrollHeight - el.clientHeight : 0;
// diagnostica esplicita: dice ESATTAMENTE cosa può scorrere in questa pagina
function logScrollCandidates(tag: string) {
  if (typeof document === "undefined") return;
  const de = (document.scrollingElement || document.documentElement) as HTMLElement;
  const rows: Record<string, unknown>[] = [];
  const push = (name: string, el: Element | null, top: number) => {
    if (!el) { rows.push({ el: name, assente: true }); return; }
    rows.push({ el: name, scrollTop: Math.round(top), scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, scrollabile: el.scrollHeight - el.clientHeight > 4 });
  };
  push("window/scrollingElement", de, window.scrollY || de.scrollTop);
  push("body", document.body, document.body.scrollTop);
  const sc = slideScroller();
  push('[data-hg-scroll="slide"]', sc, sc?.scrollTop ?? 0);
  console.log(`[SCROLL] contesto: ${scrollContext()}`);
  console.log("[SLIDE] scroll candidates", tag, "iframe:", typeof window !== "undefined" && window.self !== window.top, rows);
}

function SlidePage() {
  const liveId = useLiveId();
  const watch = getWatch();
  const isViewer = !!watch;
  // l'ospite segue il codice della sessione ATTIVA (se diverso da quello del link).
  // Fonte UNICA: il codice adottato dal motore della chiamata. Prima questa pagina
  // aveva un proprio poll ogni 3s: quattro pagine con quattro poller e guardie
  // diverse potevano adottare in istanti diversi e far sbattere i canali.
  const guestCode = useGuestChannel(isViewer ? watch : null);
  const sessionId = isViewer ? (guestCode || watch) : liveId;
  useLiveNav(!!liveId && !isViewer, watch);
  const [gotState, setGotState] = useState(!isViewer); // ospite: contenuto svelato solo a stato ricevuto

  const navigate = useNavigate();
  const { consultant, ready } = useConsultant();
  const [i, setI] = useState(0);
  const [cases, setCases] = useState<Caso[]>([]);
  const [stats, setStats] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState(50);
  const [caseFull, setCaseFull] = useState(false); // Feature 2 — schermo intero media caso (broadcast)
  /** Fonte aperta sopra la slide (rispecchiata sul cliente). */
  const [fonte, setFonte] = useState<string | null>(null);
  const fonteRef = useRef<string | null>(null);
  fonteRef.current = fonte;
  /** Apre la fonte su entrambi i dispositivi. */
  const apriFonte = (url: string) => { setFonte(url); send("fonte", { url }); };
  const [audioOn, setAudioOn] = useState(false);
  const [needTap, setNeedTap] = useState(false);
  const [manage, setManage] = useState(false);
  const [manageCases, setManageCases] = useState(false);
  const [pointerOn, setPointerOn] = useState(() => readPointerPref()); // puntatore/dito: ATTIVO di default, preferenza persistita
  const [ptr, setPtr] = useState<{ x: number; y: number; on: boolean }>({ x: 0.5, y: 0.5, on: false });
  const ptrTs = useRef(0);
  const mainRef = useRef<HTMLElement | null>(null);
  const [cfg, setCfg] = useState<{ disabled: string[]; custom: CustomSlide[]; overrides: Record<string, SlideOverride>; order: string[]; caseOpts: Record<string, { split?: boolean }> }>({ disabled: [], custom: [], overrides: {}, order: [], caseOpts: {} });
  // salva la config E la propaga subito all'ospite: il mazzo (numero e ordine
  // delle slide, casi "separati") deve restare IDENTICO sui due lati.
  const saveCfg = (next: typeof cfg) => {
    setCfg(next);
    fetch("/api/presenter/slidecfg", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }).catch(() => {});
    sendRef.current?.("cfg", { cfg: next });
  };
  const sendRef = useRef<((e: string, p: Record<string, unknown>) => unknown) | null>(null);
  const [editKey, setEditKey] = useState<string | null>(null); // slide in modifica (Feature 6)
  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const iRef = useRef(0); iRef.current = i;
  const cfgRef = useRef(cfg); cfgRef.current = cfg;
  const revRef = useRef(50); revRef.current = reveal;
  const fullRef = useRef(false); fullRef.current = caseFull;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const applyingRef = useRef(false);
  const pendingVidRef = useRef<Record<string, unknown> | null>(null);
  // Zoom/pan dei media rispecchiato sull'ospite ("mediazoom" sul canale qslide-*)
  const [gzoom, setGzoom] = useState<{ i: number; scale: number; tx: number; ty: number } | null>(null);
  const zoomRef = useRef({ scale: 1, tx: 0, ty: 0 });
  const zoomTs = useRef(0);
  const zoomTimer = useRef<number | null>(null);

  // slide composte con CHIAVE stabile: fisse → Numeri → CASI → resto → custom.
  // Le disattivate (cfg.disabled) sono filtrate; presentatore e cliente usano la
  // stessa config → stessi indici. Le custom si aggiungono in fondo.
  const tail = tailSlides(stats);
  // Feature 6 — applica gli override (testi/icona) alle slide fisse
  const applyOv = (base: Slide, key: string): Slide => {
    const o = cfg.overrides?.[key]; if (!o) return base;
    return { ...base,
      eyebrow: o.eyebrow ?? base.eyebrow,
      title: (o.title && o.title.trim()) ? o.title : base.title,
      sub: o.sub ?? base.sub,
      big: o.big ?? base.big,
      icon: (o.icon && SLIDE_ICONS[o.icon]) ? SLIDE_ICONS[o.icon] : base.icon,
    };
  };
  const keyedRaw: { s: Slide; key: string; label: string }[] = [
    ...SLIDES.map((s, idx) => ({ s: applyOv(s, `s${idx}`), key: `s${idx}`, label: typeof s.eyebrow === "string" ? s.eyebrow : `Slide ${idx + 1}` })),
    { s: applyOv(tail[0], "t0"), key: "t0", label: "I numeri" },
    // I casi con "Mostra separati" attivo occupano DUE slide consecutive del mazzo
    // (prima → dopo). Il calcolo è identico su presentatore e ospite perché entrambi
    // partono dalla stessa cfg.caseOpts → stessi indici, sync garantita.
    ...cases.flatMap((c, idx) => {
      const nm = c.name || `Caso ${idx + 1}`;
      if (c.kind === "photos" && cfg.caseOpts?.[c.id]?.split) {
        return [
          { s: { eyebrow: "Prima", title: <></>, caso: c, only: "before" } as Slide, key: `c${idx}a`, label: `Prima: ${nm}` },
          { s: { eyebrow: "Dopo", title: <></>, caso: c, only: "after" } as Slide, key: `c${idx}b`, label: `Dopo: ${nm}` },
        ];
      }
      return [{ s: { eyebrow: c.kind === "video" ? "Video testimonianza" : "Prima / Dopo", title: <></>, caso: c } as Slide, key: `c${idx}`, label: (c.kind === "video" ? "Video: " : "Prima/Dopo: ") + nm }];
    }),
    ...tail.slice(1).map((s, idx) => ({ s: applyOv(s, `t${idx + 1}`), key: `t${idx + 1}`, label: typeof s.eyebrow === "string" ? s.eyebrow : `Extra ${idx + 1}` })),
    ...(cfg.custom || []).map((cu) => ({ s: customToSlide(cu), key: `x${cu.id}`, label: `★ ${cu.title || cu.eyebrow || "Personalizzata"}` })),
  ];
  // Feature B — riordino: le chiavi presenti in cfg.order vengono prima (in quell'ordine),
  // le altre mantengono la posizione naturale relativa in coda. Stesso calcolo su host+viewer.
  const order = cfg.order || [];
  const orderRank = (k: string) => { const idx = order.indexOf(k); return idx < 0 ? Infinity : idx; };
  const keyed = keyedRaw
    .map((x, idx) => ({ x, idx }))
    .sort((a, b) => { const ra = orderRank(a.x.key), rb = orderRank(b.x.key); return ra !== rb ? ra - rb : a.idx - b.idx; })
    .map((o) => o.x);
  // sposta una slide su/giù: semina l'order dalla sequenza attuale completa, poi scambia i vicini
  const moveSlide = (key: string, dir: -1 | 1) => {
    const seq = keyed.map((x) => x.key);
    const i0 = seq.indexOf(key); const j0 = i0 + dir;
    if (i0 < 0 || j0 < 0 || j0 >= seq.length) return;
    [seq[i0], seq[j0]] = [seq[j0], seq[i0]];
    saveCfg({ ...cfg, order: seq });
  };
  const visible = keyed.filter((x) => !cfg.disabled.includes(x.key));
  const allSlides: Slide[] = visible.map((x) => x.s);
  const clampI = Math.max(0, Math.min(allSlides.length - 1, i));
  const s = allSlides[clampI];
  const caso = s?.caso;

  // carica casi + numeri (host + viewer per avere le stesse slide)
  // firma d'ingresso della schermata
  //  ── NESSUN SUONO SENZA UN GESTO ─────────────────────────────────────────
  //   Qui la pagina suonava da sola ogni volta che veniva montata: non solo
  //   quando la aprivi tu, ma anche quando si rimontava per conto suo — una
  //   navigazione automatica, un rientro, un aggiornamento. Il suono del cambio
  //   schermata lo fa già il pulsante che premi: è quello il gesto.

  useEffect(() => {
    fetch("/api/presenter/cases").then((r) => r.json()).then((j) => setCases(j.cases ?? [])).catch(() => {});
    fetch("/api/presenter/stats").then((r) => r.json()).then((j) => setStats(j.stats ?? {})).catch(() => {});
    fetch("/api/presenter/slidecfg").then((r) => r.json()).then((j) => setCfg({ disabled: j.disabled ?? [], custom: j.custom ?? [], overrides: j.overrides ?? {}, order: j.order ?? [], caseOpts: j.caseOpts ?? {} })).catch(() => {});
  }, []);

  // gate consulente: solo chi ha il link magico (o lo spettatore della diretta) accede
  useEffect(() => {
        // ── MAI UN RICARICAMENTO COMPLETO ────────────────────────────────────
    //  Qui si usava `window.location.href`, che ricarica l'intera pagina. Lo
    //  stato della videochiamata vive in memoria: un ricaricamento la azzerava e
    //  faceva uscire ANCHE il cliente. E scattava a sorpresa, perché il
    //  riconoscimento del consulente si completa un istante dopo il montaggio.
    //  Ora si aspetta che il verdetto sia stabile e si cambia schermata senza
    //  ricaricare, così la chiamata resta viva.
    if (ready && !consultant && !isViewer) { const t = setTimeout(() => navigate({ to: "/preventivo" }), 400); return () => clearTimeout(t); }
  }, [ready, consultant, isViewer, navigate]);
  const gated = ready && !consultant && !isViewer;

  // ── ⚠️ DENTRO LA CORNICE DI UN WEBINAR ──────────────────────────────────
  //  Questa stessa pagina, aperta dentro la sala di un webinar, non può usare
  //  il canale in tempo reale: cinquecento spettatori su quel canale sono lo
  //  stesso muro per cui il video non poteva restare in mesh. Legge invece lo
  //  stato della sala, che viaggia su HTTP con una cache di pochi secondi.
  //  Il prezzo è qualche secondo di ritardo sul cambio slide; il guadagno è
  //  che lo vedono tutti invece di nessuno.
  //  ⚠️ Dentro la REGIA questa pagina pubblica invece di seguire: la
  //   dichiarazione la fa lei stessa, perché è un contesto suo — la console
  //   sta nella finestra di sopra e il suo negozietto di stato qui non arriva.
  const salaDiRegia = typeof window === "undefined" ? "" : salaDiRegiaDallIndirizzo();
  useEffect(() => {
    if (!salaDiRegia) return;
    salaDeiContenuti(salaDiRegia);
    return () => salaDeiContenuti("");
  }, [salaDiRegia]);

  const salaWebinar = typeof window === "undefined" ? "" : salaDallIndirizzo();
  useEffect(() => {
    if (!salaWebinar) return;
    let vivo = true;
    let ultimo = "";
    const giro = async () => {
      try {
        const r = await fetch(`/api/public/webinar?codice=${encodeURIComponent(salaWebinar)}`);
        const j = await r.json();
        const c = j?.contenuti;
        if (!vivo || !c) return;
        //  Si applica solo quando è CAMBIATO qualcosa: rifare gli stessi
        //  aggiornamenti due volte al secondo farebbe ripartire l'animazione
        //  della slide a ogni giro.
        const impronta = JSON.stringify(c);
        if (impronta === ultimo) return;
        ultimo = impronta;
        const s = c as Record<string, any>;
        if (s.slide && Number.isFinite(Number(s.slide.i))) {
          setI(Number(s.slide.i) || 0);
          setReveal(50);
          setCaseFull(false);
        }
        if (s.reveal && Number.isFinite(Number(s.reveal.pos))) setReveal(Number(s.reveal.pos) || 50);
        if (s.fonte) setFonte((s.fonte.url as string) || null);
        if (s.casefull) setCaseFull(!!s.casefull.on);
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
  }, [salaWebinar]);

  const chanIdRef = useRef<string | null>(null);
  const send = (event: string, payload: Record<string, unknown>) => {
    if (event === "slide" || event === "scroll") console.log("[SLIDE] →", event, "canale:", chanIdRef.current, payload);
    //  ── ⚠️ LA SALA DEL WEBINAR SEGUE DA QUI ───────────────────────────────
    //   Questo è l'imbuto da cui passa OGNI cambiamento di stato delle slide,
    //   ed è il solo punto in cui agganciarsi: metterlo su ciascuno dei nove
    //   eventi avrebbe voluto dire dimenticarne uno, e quell'uno sarebbe stato
    //   quello che in diretta non si aggiorna.
    //   ⚠️ E NON TOCCA LA CONSULENZA: `pubblicaContenuti` non fa niente finché
    //    una sala non è dichiarata in onda e in modalità contenuti — cioè
    //    sempre, tranne durante un webinar.
    pubblicaContenuti(event, payload);
    return chanRef.current?.send({ type: "broadcast", event, payload });
  };
  sendRef.current = send;
  const videoSnap = () => { const v = videoRef.current; return { i: iRef.current, time: v?.currentTime ?? 0, playing: v ? !v.paused : false }; };
  // presentatore: invia lo zoom corrente (throttle ~10/s, ultimo valore garantito)
  const flushZoom = () => { zoomTs.current = Date.now(); sendRef.current?.("mediazoom", { i: iRef.current, ...zoomRef.current }); };
  const onMediaZoom = useCallback((z: { scale: number; tx: number; ty: number }) => {
    if (isViewer) return;
    zoomRef.current = z;
    const wait = 100 - (Date.now() - zoomTs.current);
    if (wait <= 0) { if (zoomTimer.current) { clearTimeout(zoomTimer.current); zoomTimer.current = null; } flushZoom(); return; }
    if (zoomTimer.current) return;
    zoomTimer.current = window.setTimeout(() => { zoomTimer.current = null; flushZoom(); }, wait);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewer]);

  const go = (n: number) => {
    if (isViewer) return;
    const next = Math.max(0, Math.min(allSlides.length - 1, n));
    if (next !== i) sfx.slide();          // la pagina che gira
    setI(next); setReveal(50); setCaseFull(false);
    // cambiando slide la fonte aperta si chiude: nessuna finestra dimenticata
    if (fonteRef.current) { setFonte(null); send("fonte", { url: null }); }
    send("slide", { i: next });
    // lo zoom locale del presentatore non si azzera cambiando slide: ri-annuncio
    // subito lo stato corrente col nuovo indice, così l'ospite resta allineato.
    send("mediazoom", { i: next, ...zoomRef.current });
  };

  //  Il sito si serve dal NOSTRO dominio (stesso ponte usato dalla schermata
  //  "Link"): è ciò che permette di mostrarlo dentro la pagina invece di
  //  aprire una scheda che il cliente non vedrebbe.
  const fonteOverlay = fonte ? (
    <div className="fixed inset-0 z-[140] flex flex-col bg-[#050f24]">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
        <ExternalLink className="h-4 w-4 text-brand" />
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-white/60">{fonte.replace(/^https?:\/\//, "")}</span>
        {!isViewer && (
          <button type="button" onClick={() => { setFonte(null); send("fonte", { url: null }); }}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-[12.5px] font-medium text-white/75 hover:bg-white/10">
            Chiudi
          </button>
        )}
      </div>
      <iframe title="Fonte" src={`/api/proxy?u=${encodeURIComponent(fonte)}`} className="min-h-0 flex-1 w-full border-0 bg-white" />
    </div>
  ) : null;

  // Feature 2 — schermo intero media caso: on/off + broadcast al cliente
  const toggleCaseFull = () => {
    if (isViewer) return;
    const on = !fullRef.current;
    setCaseFull(on);
    send("casefull", { i: iRef.current, on });
  };

  // canale live
  useEffect(() => {
    if (!sessionId) return;
    const chanId = `qslide-${sessionId}`;
    chanIdRef.current = chanId;
    const timers: number[] = [];
    console.log("[SLIDE] iscrizione canale", chanId, isViewer ? "(ospite)" : "(presentatore)");
    const ch = supabase.channel(chanId, { config: { broadcast: { self: false } } });
    if (isViewer) {
      ch.on("broadcast", { event: "slide" }, ({ payload }) => { console.log("[SLIDE] ←", "slide", "canale:", chanId, payload); guestContentSeen(); setGotState(true); setI(Number((payload as { i?: number }).i) || 0); setReveal(50); setCaseFull(false); setGzoom(null); resetOwnZoom(); });
      ch.on("broadcast", { event: "reveal" }, ({ payload }) => { const p = payload as { i?: number; pos?: number }; if (p.i === iRef.current) setReveal(Number(p.pos) || 50); });
      ch.on("broadcast", { event: "mediazoom" }, ({ payload }) => { const p = payload as { i?: number; scale?: number; tx?: number; ty?: number }; setGzoom({ i: Number(p.i) || 0, scale: Number(p.scale) || 1, tx: Number(p.tx) || 0, ty: Number(p.ty) || 0 }); });
      ch.on("broadcast", { event: "casefull" }, ({ payload }) => { const p = payload as { i?: number; on?: boolean }; if (p.i === iRef.current) setCaseFull(!!p.on); });
      ch.on("broadcast", { event: "casevideo" }, ({ payload }) => applyCaseVideo(payload as Record<string, unknown>));
      ch.on("broadcast", { event: "fonte" }, ({ payload }) => setFonte((payload as { url?: string | null }).url || null));
      // config del mazzo aggiornata dal presentatore (slide on/off, ordine,
      // testi, casi "separati"): l'ospite la applica → stessi indici.
      ch.on("broadcast", { event: "cfg" }, ({ payload }) => {
        const c = (payload as { cfg?: typeof cfg }).cfg;
        if (c) setCfg({ disabled: c.disabled ?? [], custom: c.custom ?? [], overrides: c.overrides ?? {}, order: c.order ?? [], caseOpts: c.caseOpts ?? {} });
      });
      ch.on("broadcast", { event: "pointer" }, ({ payload }) => { const p = payload as { x?: number; y?: number; on?: boolean }; setPtr({ x: Number(p.x) || 0, y: Number(p.y) || 0, on: !!p.on }); });
      // (F) scroll sync: il guest segue la frazione di scroll del presentatore.
      //  s = ratio 0..1 · win = true se il presentatore stava scrollando la PAGINA,
      //  false se stava scrollando il contenitore della slide (area contenuto).
      ch.on("broadcast", { event: "scroll" }, ({ payload }) => {
        console.log("[SLIDE] ←", "scroll", "canale:", chanId, payload);
        guestContentSeen(); setGotState(true);
        const p = payload as { s?: number; win?: boolean; a?: string; sub?: number };
        const r = Number(p.s);
        if (!Number.isFinite(r)) return; // guardia NaN
        const ratio = Math.max(0, Math.min(1, r));
        // 1) ANCORA DI CONTENUTO (indipendente dalla risoluzione): stesso blocco
        //    in cima allo schermo anche con viewport diversi.
        if (p.a) {
          const root = slideScroller() || mainRef.current;
          const target = applyAnchor(root, { a: p.a, sub: Number(p.sub) || 0 });
          if (target != null) return;
        }
        // 2) fallback storico a frazione 0..1
        // Applico al MIO scroller: prima quello marcato (uguale a quello del
        // presentatore), poi i fallback documento/body. La frazione 0..1 è
        // l'unico dato comune tra dispositivi di altezza diversa.
        const applyTo = (el: Element | null | undefined) => {
          if (!el) return false;
          const max = scrollRange(el);
          if (!(max > 4)) return false;
          el.scrollTop = ratio * max;
          return true;
        };
        const applyWindow = () => {
          const de = document.scrollingElement || document.documentElement;
          const max = scrollRange(de);
          if (!(max > 4)) return false;
          window.scrollTo(0, ratio * max);
          return true;
        };
        // 1) contenitore marcato  2) main (ref)  3) documento/finestra  4) body
        const ok = applyTo(slideScroller()) || applyTo(mainRef.current) || applyWindow() || applyTo(document.body);
        if (!ok) console.log("[SLIDE] scroll ricevuto ma nessun elemento scorrevole (il contenuto entra tutto nello schermo)", ratio);
      });
      // shello ripetuto: se il presentatore si iscrive DOPO l'ospite, il primo
      // saluto andrebbe perso e l'ospite resterebbe fermo alla slide 0.
      ch.subscribe((st) => {
        console.log("[SLIDE] stato canale ospite", chanId, st);
        if (st !== "SUBSCRIBED") return;
        const hello = () => ch.send({ type: "broadcast", event: "shello", payload: {} });
        hello();
        [400, 1200, 3000, 6000].forEach((ms) => { const t = window.setTimeout(hello, ms); timers.push(t); });
      });
    } else {
      const pushAll = (why: string) => {
        console.log("[SLIDE] ri-trasmissione stato (", why, ") canale:", chanId);
        send("cfg", { cfg: cfgRef.current }); // prima la config: definisce il mazzo
        send("slide", { i: iRef.current }); send("reveal", { i: iRef.current, pos: revRef.current });
        send("casefull", { i: iRef.current, on: fullRef.current });
        send("mediazoom", { i: iRef.current, ...zoomRef.current });
        if (videoRef.current) send("casevideo", videoSnap());
      };
      ch.on("broadcast", { event: "shello" }, () => pushAll("shello ospite"));
      ch.subscribe((st) => {
        console.log("[SLIDE] stato canale presentatore", chanId, st);
        // subito dopo l'iscrizione (anche dopo un CAMBIO codice sessione) ri-annuncia
        // lo stato: l'ospite già collegato non deve restare indietro.
        if (st === "SUBSCRIBED") [0, 800, 2500].forEach((ms) => { const t = window.setTimeout(() => pushAll("post-subscribe"), ms); timers.push(t); });
      });
    }
    chanRef.current = ch;
    return () => { timers.forEach((t) => clearTimeout(t)); supabase.removeChannel(ch); chanRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isViewer]);

  // tastiera (host)
  useEffect(() => {
    if (isViewer) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight") go(iRef.current + 1); if (e.key === "ArrowLeft") go(iRef.current - 1); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewer, allSlides.length]);

  // host: ping periodico del video caso
  useEffect(() => {
    if (isViewer || !liveId) return;
    const t = setInterval(() => { const v = videoRef.current; if (v && !v.paused) send("casevideo", videoSnap()); }, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewer, liveId, clampI]);

  // (F) host: trasmette lo scroll in tempo reale (throttle ~10/s) → il guest lo rispecchia.
  //  Ascolta in CAPTURE su document: intercetta sia lo scroll della pagina sia quello
  //  di un contenitore interno (l'area contenuto della slide, es. media a schermo intero).
  useEffect(() => {
    if (isViewer || !sessionId) return;
    // NON mi fido del target dell'evento: quando l'anteprima dispositivo è
    // mobile/tablet la pagina gira DENTRO un iframe (?embed=1) e a scorrere può
    // essere il documento dell'iframe, il <main> o il body. Leggo quindi ogni
    // volta la posizione dallo scroller EFFETTIVO e invio solo la frazione 0..1.
    const readRatio = (): { s: number; win: boolean } | null => {
      const el = slideScroller() || mainRef.current;
      if (el) { const max = scrollRange(el); if (max > 4) return { s: el.scrollTop / max, win: false }; }
      const de = (document.scrollingElement || document.documentElement) as HTMLElement;
      const maxD = scrollRange(de);
      if (maxD > 4) return { s: (window.scrollY || de.scrollTop) / maxD, win: true };
      const b = document.body;
      const maxB = scrollRange(b);
      if (maxB > 4) return { s: b.scrollTop / maxB, win: true };
      return null;
    };
    // diagnostica una tantum: dice se il presentatore ha DAVVERO qualcosa che scorre
    const diag = window.setTimeout(() => logScrollCandidates("presentatore (mount)"), 800);
    // Throttle ~6 invii/s: il rate-limit del realtime (10 eventi/s per client) era
    // saturato dai 10/s precedenti + puntatore/slide → i messaggi venivano scartati.
    const MIN_MS = 160;
    let lastSent = -1, lastT = 0, timer = 0;
    const tick = () => {
      const info = readRatio();
      if (!info || !Number.isFinite(info.s)) return;
      const s = Math.max(0, Math.min(1, info.s));
      if (Math.abs(s - lastSent) < 0.002) return; // nessun movimento reale
      const now = Date.now();
      const wait = MIN_MS - (now - lastT);
      if (wait > 0) { if (!timer) timer = window.setTimeout(() => { timer = 0; tick(); }, wait); return; }
      lastT = now; lastSent = s;
      const root = slideScroller() || mainRef.current;
      const a: ScrollAnchor | null = readAnchor(root);
      logOut("slide", a, root);
      send("scroll", { s, win: info.win, a: a?.a, sub: a?.sub });
    };
    const onScroll = () => tick();
    // capture su document = intercetta anche lo scroll dei contenitori interni
    // (gli eventi scroll degli elementi NON fanno bubbling, ma la fase di cattura sì)
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    // listener DIRETTO sullo scroller marcato (funziona anche dentro l'iframe ?embed=1)
    const main = slideScroller() || mainRef.current;
    main?.addEventListener("scroll", onScroll, { passive: true });
    // rete di sicurezza: se per qualche motivo nessun evento arriva (iframe,
    // scroll programmatico, momentum su touch) il polling sincronizza comunque.
    const iv = window.setInterval(tick, 300);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("scroll", onScroll);
      main?.removeEventListener("scroll", onScroll);
      clearTimeout(diag);
      clearInterval(iv);
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isViewer, sessionId]);

  const applyCaseVideo = (st: Record<string, unknown> | null) => {
    if (!st) return;
    pendingVidRef.current = st;
    if (Number(st.i) !== iRef.current) return;
    const v = videoRef.current; if (!v) return;
    applyingRef.current = true;
    const playing = !!st.playing;
    const time = (Number(st.time) || 0) + (playing ? 0.25 : 0);
    if (Math.abs(v.currentTime - time) > 1.2) { try { v.currentTime = time; } catch { /* not ready */ } }
    if (playing && v.paused) { if (!audioOn) setNeedTap(true); v.play().catch(() => {}); }
    if (!playing && !v.paused) v.pause();
    setTimeout(() => { applyingRef.current = false; }, 150);
  };
  const onVid = () => { if (!isViewer && !applyingRef.current) send("casevideo", videoSnap()); };

  const onRevealDrag = (pos: number) => { const p = Math.max(0, Math.min(100, pos)); setReveal(p); if (!isViewer) send("reveal", { i: iRef.current, pos: p }); };
  const togglePointer = () => setPointerOn((v) => { const nv = !v; writePointerPref(nv); if (!nv) { setPtr((p) => ({ ...p, on: false })); send("pointer", { i: iRef.current, x: 0.5, y: 0.5, on: false }); } return nv; });
  const ptrOff = () => { setPtr((p) => (p.on ? { ...p, on: false } : p)); send("pointer", { i: iRef.current, x: 0.5, y: 0.5, on: false }); };
  // isteresi anti-flicker del puntatore (spegne solo dopo ~150ms sui comandi)
  const ptrOffRef = useRef(ptrOff); ptrOffRef.current = ptrOff;
  const ptrGate = useRef(makePointerHysteresis(() => ptrOffRef.current()));

  // rete di sicurezza: se il presentatore non risponde, dopo qualche secondo
  // mostriamo comunque il contenuto invece di lasciare l'ospite in attesa infinita.
  useEffect(() => {
    if (!isViewer || gotState) return;
    const t = setTimeout(() => setGotState(true), 6000);
    return () => clearTimeout(t);
  }, [isViewer, gotState]);

  const enterAudio = () => { setNeedTap(false); setAudioOn(true); const v = videoRef.current; if (v) { v.muted = false; v.volume = 1; v.play().catch(() => {}); } };
  // dentro l'iframe dell'anteprima dispositivo: nessun chrome del presentatore
  const inEmbed = typeof window !== "undefined"
    && (new URLSearchParams(window.location.search).get("embed") === "1" || window.self !== window.top);

  if (gated) return <div className="bg-blueprint min-h-screen" />;

  return (
    // h-screen + overflow-hidden: la PAGINA non scorre mai (prima il solo
    // pb-[58px] su min-h-screen creava uno scroll fantasma di 58px sul
    // presentatore, mentre l'ospite non aveva NULLA di scorrevole).
    // L'unico scroller è <main data-hg-scroll="slide"> → identico sui due lati.
    // NB: `pb-[58px]` riserva lo spazio della PresenterBar fissa in basso. Dentro
    // l'iframe dell'anteprima dispositivo (embed=1) quella barra NON viene resa
    // (PresenterBar si nasconde da sola): riservarne lo spazio accorciava l'area
    // contenuto di 58px → l'anteprima "Cliente: WxH" non corrispondeva.
    <div className={`bg-blueprint flex h-screen h-dvh flex-col overflow-hidden text-white ${!isViewer && !inEmbed ? "pb-[58px]" : ""}`}>
      {fonteOverlay}
      {/*  ⚠️ Dentro la cornice di un webinar la fascia NON si mostra: la sala
          ha già la sua testata che dice che è una diretta, e questa sarebbe la
          seconda — su un telefono, due centimetri rubati alla cosa che si deve
          leggere. */}
      {isViewer && !salaWebinar ? (
        <div className="flex items-center justify-center gap-2 bg-brand px-4 py-1.5 text-center text-xs font-semibold text-white">
          <Radio className="h-3.5 w-3.5 animate-pulse" /> Diretta — presentazione in tempo reale
        </div>
      ) : (<PresenterBar page="slide" />)}

      <main ref={mainRef} data-hg-scroll="slide" className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-6 py-8"
        onPointerMove={!isViewer && pointerOn ? (e) => {
          // sopra un comando del PRESENTATORE (zoom, footer, barra: [data-hg-noptr])
          // il dito sparisce, con isteresi anti-sfarfallio (~150ms).
          if (ptrGate.current.over(e.target)) return;
          const el = mainRef.current; if (!el) return; const r = el.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
          setPtr({ x, y, on: true });
          const now = performance.now(); if (now - ptrTs.current > 70) { ptrTs.current = now; send("pointer", { i: iRef.current, x, y, on: true }); }
        } : undefined}
        onPointerLeave={!isViewer && pointerOn ? () => { setPtr((p) => ({ ...p, on: false })); send("pointer", { i: iRef.current, x: 0.5, y: 0.5, on: false }); } : undefined}>
        <div className="pointer-events-none absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />
        {/* dito animato a 60fps fra le posizioni ricevute (~10/s), visibile anche al presentatore */}
        <PointerDot target={ptr} />
        {/* m-auto (non items/justify-center): centra la slide quando c'è spazio, ma
            con contenuto più alto del contenitore i margini auto valgono 0 → niente
            overflow "in alto" irraggiungibile e lo scroll parte davvero da 0. */}
        <div data-hg-anchor="slide-contenuto" className="relative m-auto w-full max-w-4xl">
          {caso ? (
            <CaseSlide caso={caso} only={s?.only} reveal={reveal} onRevealDrag={isViewer ? undefined : onRevealDrag}
              videoRef={videoRef} isViewer={isViewer} live={!!liveId} audioOn={audioOn}
              full={caseFull} onToggleFull={isViewer ? undefined : toggleCaseFull}
              pointerOn={pointerOn} onTogglePointer={isViewer ? undefined : togglePointer}
              split={!!(caso.id && cfg.caseOpts?.[caso.id]?.split)}
              onToggleSplit={isViewer ? undefined : (on) => saveCfg({ ...cfg, caseOpts: { ...cfg.caseOpts, [caso.id]: { ...cfg.caseOpts?.[caso.id], split: on } } })}
              onVid={onVid} onLoaded={() => { if (isViewer) applyCaseVideo(pendingVidRef.current); }}
              onZoom={isViewer ? undefined : onMediaZoom} extZoom={isViewer && gzoom && gzoom.i === clampI ? gzoom : null} />
          ) : (
            <FixedSlide s={s} onFonte={isViewer ? undefined : apriFonte} />
          )}
        </div>
        {needTap && (
          <button onClick={enterAudio} className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/80 text-white">
            <Volume2 className="h-10 w-10 text-brand" />
            <span className="text-lg font-semibold">Tocca per attivare l'audio</span>
          </button>
        )}
      </main>

      <footer data-hg-noptr className="border-t border-white/10 bg-[#081634]/70 px-6 py-3">
        <div className="mx-auto flex max-w-4xl items-center gap-4">
          {!isViewer ? (
            <>
              <button onClick={() => go(clampI - 1)} disabled={clampI === 0} className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 transition hover:bg-white/10 disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button>
              <div className="flex flex-1 items-center gap-1">
                {allSlides.map((_, k) => <button key={k} onClick={() => go(k)} className={`h-1.5 flex-1 rounded-full transition ${k === clampI ? "bg-brand" : "bg-white/15 hover:bg-white/30"}`} />)}
              </div>
              <span className="text-sm tabular-nums text-white/50">{clampI + 1}/{allSlides.length}</span>
              <button onClick={togglePointer} title="Puntatore per indicare al cliente" className={`flex h-10 w-10 items-center justify-center rounded-full border ${pointerOn ? "border-brand bg-brand text-white" : "border-white/15 bg-white/5 hover:bg-white/10"}`}><Pointer className="h-4 w-4" /></button>
              <button onClick={() => setManage(true)} title="Gestisci casi" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 hover:bg-white/10"><Settings2 className="h-4 w-4" /></button>
              <button onClick={() => go(clampI + 1)} disabled={clampI === allSlides.length - 1} className="flex h-10 items-center gap-1.5 rounded-full bg-brand px-4 font-semibold transition hover:brightness-110 disabled:opacity-30">Avanti <ChevronRight className="h-5 w-5" /></button>
            </>
          ) : (
            <div className="mx-auto flex items-center gap-3 text-white/50">
              <BrandLogo className="h-5 w-auto" />
              <div className="flex items-center gap-1.5">{allSlides.map((_, k) => <span key={k} className={`h-1.5 w-5 rounded-full ${k === clampI ? "bg-brand" : "bg-white/15"}`} />)}</div>
            </div>
          )}
        </div>
      </footer>

      {manage && !isViewer && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm" onClick={() => setManage(false)}>
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#081226] p-4 text-white" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2"><Settings2 className="h-4 w-4 text-brand" /><h2 className="text-sm font-semibold">Impostazioni presentazione</h2>
              <button onClick={() => setManage(false)} className="ml-auto rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs">Chiudi ✕</button></div>

            <button onClick={() => setManageCases(true)} className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-brand bg-brand/10 px-3 py-2.5 text-sm font-medium hover:bg-brand/20">
              <Star className="h-4 w-4 text-brand" /> Gestisci Casi & Risultati {cases.length > 0 && `(${cases.length})`}
            </button>

            <h3 className="mb-2 text-[12px] font-semibold text-white/70">Slide — attiva/disattiva</h3>
            <div className="mb-4 space-y-1">
              {keyed.map((x, ri) => {
                const off = cfg.disabled.includes(x.key);
                return (
                  <div key={x.key} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[13px] ${off ? "border-white/10 bg-white/[0.02] text-white/40" : "border-white/10 bg-white/[0.04]"}`}>
                    <div className="flex flex-col">
                      <button onClick={() => moveSlide(x.key, -1)} disabled={ri === 0} title="Sposta su" className="rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-brand disabled:opacity-20"><ChevronUp className="h-3 w-3" /></button>
                      <button onClick={() => moveSlide(x.key, 1)} disabled={ri === keyed.length - 1} title="Sposta giù" className="rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-brand disabled:opacity-20"><ChevronDown className="h-3 w-3" /></button>
                    </div>
                    <span className="min-w-0 flex-1 truncate">{x.label}</span>
                    {(x.key.startsWith("s") || x.key.startsWith("t")) && <button onClick={() => setEditKey(x.key)} title="Modifica testi" className="rounded p-1 text-white/60 hover:bg-white/10 hover:text-brand"><Pencil className="h-3.5 w-3.5" /></button>}
                    {x.key.startsWith("x") && <button onClick={() => saveCfg({ ...cfg, custom: cfg.custom.filter((c) => `x${c.id}` !== x.key) })} className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>}
                    <button onClick={() => saveCfg({ ...cfg, disabled: off ? cfg.disabled.filter((k) => k !== x.key) : [...cfg.disabled, x.key] })}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium ${off ? "bg-white/10 text-white/60" : "bg-brand text-white"}`}>{off ? "Disattivata" : "Attiva"}</button>
                  </div>
                );
              })}
            </div>

            <h3 className="mb-2 text-[12px] font-semibold text-white/70">Aggiungi slide personalizzata</h3>
            <AddSlide onAdd={(cu) => saveCfg({ ...cfg, custom: [...cfg.custom, cu] })} />

            {/* Ripristina tutte le impostazioni slide ai valori di default */}
            <button onClick={() => { if (window.confirm("Ripristinare TUTTE le impostazioni delle slide (attiva/disattiva, ordine, testi, personalizzate, opzioni casi)? L'operazione non è reversibile.")) saveCfg({ disabled: [], custom: [], overrides: {}, order: [], caseOpts: {} }); }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/20">
              <RotateCcw className="h-4 w-4" /> Ripristina tutto
            </button>
          </div>
        </div>
      )}
      {manageCases && !isViewer && (
        <CasesManager cases={cases} setCases={setCases} onClose={() => setManageCases(false)}
          onAdded={() => { setManageCases(false); }} />
      )}
      {editKey && !isViewer && (() => {
        const base: Slide = editKey === "t0" ? tail[0]
          : editKey.startsWith("t") ? (tail[Number(editKey.slice(1))] || tail[0])
          : (SLIDES[Number(editKey.slice(1))] || SLIDES[0]);
        return <SlideEditor base={base} ov={cfg.overrides?.[editKey]} onClose={() => setEditKey(null)}
          onSave={(o) => { const next = { ...cfg, overrides: { ...cfg.overrides, [editKey]: o } }; if (!o || Object.keys(o).length === 0) delete next.overrides[editKey]; saveCfg(next); setEditKey(null); }} />;
      })()}
      {/* Ospite: schermata d'attesa brandizzata finché non arriva lo stato del
          presentatore → niente lampo di slide prima del setup. */}
      {/*  ⚠️ Due attese diverse per due cose diverse: il perché sta in
            `shop/live`, su `guardataDaUnaSala`. In breve: in un webinar
            l'attesa della videoconsulenza è una frase falsa col marchio
            sbagliato, e chi è appena entrato in diretta pensa di aver
            sbagliato link. */}
      {isViewer && !gotState && (guardataDaUnaSala() ? <AttesaDellaSala /> : <WaitingScreen />)}
      <Toaster />
    </div>
  );
}

// converte una slide personalizzata (con template) nel modello Slide renderizzabile da FixedSlide
function customToSlide(cu: CustomSlide): Slide {
  const Icon = (cu.icon && SLIDE_ICONS[cu.icon]) ? SLIDE_ICONS[cu.icon] : Sparkles;
  const eyebrow = cu.eyebrow || "Slide";
  const title = <>{cu.title || ""}</>;
  if (cu.template === "bullet") {
    return { eyebrow, title, accent: true, icon: cu.icon ? Icon : undefined, footnote: cu.footnote,
      bullets: (cu.bullets || []).filter((b) => (b.t || "").trim()).map((b) => ({ icon: (b.icon && SLIDE_ICONS[b.icon]) ? SLIDE_ICONS[b.icon] : ArrowRight, t: b.t || "", d: b.d })) };
  }
  if (cu.template === "statement") {
    return { eyebrow, title, big: cu.big, sub: cu.sub, icon: Icon, accent: true };
  }
  return { eyebrow, title, sub: cu.sub, icon: Icon, accent: true }; // "text" (default, retrocompat)
}

const TEMPLATES: { key: SlideTemplate; label: string; icon: LucideIcon }[] = [
  { key: "text", label: "Titolo + sottotitolo", icon: Quote },
  { key: "statement", label: "Big / Statement", icon: Sparkles },
  { key: "bullet", label: "Bullet point", icon: Layers },
];

// popover per scegliere un'icona (riusato da AddSlide su icona principale e bullet)
function IconPickerButton({ value, onChange, size = "h-16 w-16", accent, allowNone = true }: { value: string; onChange: (v: string) => void; size?: string; accent?: boolean; allowNone?: boolean }) {
  const [open, setOpen] = useState(false);
  const Icon = (value && SLIDE_ICONS[value]) ? SLIDE_ICONS[value] : null;
  const big = size.includes("16");
  return (
    <div className="relative inline-block">
      <button onClick={() => setOpen((v) => !v)} title="Cambia icona"
        className={`flex ${size} items-center justify-center rounded-2xl ring-2 ring-transparent transition hover:ring-brand/60 ${accent ? "bg-brand text-white" : "bg-white/[0.06] text-brand"}`}>
        {Icon ? <Icon className={big ? "h-8 w-8" : "h-5 w-5"} strokeWidth={1.6} /> : <span className="text-[9px] text-white/50">icona</span>}
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-20 mt-2 w-64 -translate-x-1/2 rounded-xl border border-white/15 bg-[#0b1730] p-2 shadow-2xl">
          <div className="flex flex-wrap gap-1.5">
            {allowNone && <button onClick={() => { onChange(""); setOpen(false); }} className={`flex h-9 w-9 items-center justify-center rounded-lg border text-[9px] ${!value ? "border-brand bg-brand/15 text-brand" : "border-white/15 bg-white/5 text-white/50"}`}>—</button>}
            {Object.entries(SLIDE_ICONS).map(([k, Ic]) => (
              <button key={k} onClick={() => { onChange(k); setOpen(false); }} title={k} className={`flex h-9 w-9 items-center justify-center rounded-lg border ${value === k ? "border-brand bg-brand/15 text-brand" : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"}`}><Ic className="h-4 w-4" /></button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Feature A — "Aggiungi slide": scelta template → ANTEPRIMA LIVE editabile in-place (niente form)
function AddSlide({ onAdd }: { onAdd: (cu: CustomSlide) => void }) {
  const sample = () => ({
    eyebrow: "Nuova sezione",
    title: "Titolo di esempio",
    sub: "Sottotitolo di esempio: clicca per modificare il testo.",
    big: "Frase forte",
    icon: "Sparkles",
    bullets: [
      { icon: "ScanFace", t: "Primo punto", d: "Breve descrizione." },
      { icon: "Layers", t: "Secondo punto", d: "Breve descrizione." },
      { icon: "ShieldCheck", t: "Terzo punto", d: "Breve descrizione." },
    ] as CustomBullet[],
    footnote: "Nota a piè di pagina (opzionale).",
  });
  const [template, setTemplate] = useState<SlideTemplate>("text");
  const [eyebrow, setEyebrow] = useState(sample().eyebrow);
  const [title, setTitle] = useState(sample().title);
  const [sub, setSub] = useState(sample().sub);
  const [big, setBig] = useState(sample().big);
  const [icon, setIcon] = useState(sample().icon);
  const [bullets, setBullets] = useState<CustomBullet[]>(sample().bullets);
  const [footnote, setFootnote] = useState(sample().footnote);
  const [nonce, setNonce] = useState(0); // forza il remount dell'anteprima (gli Editable si inizializzano solo al mount)
  const reset = () => { const s = sample(); setEyebrow(s.eyebrow); setTitle(s.title); setSub(s.sub); setBig(s.big); setIcon(s.icon); setBullets(s.bullets); setFootnote(s.footnote); setNonce((n) => n + 1); };
  const setB = (i: number, p: Partial<CustomBullet>) => setBullets((a) => a.map((b, j) => (j === i ? { ...b, ...p } : b)));
  const add = () => {
    if (!title.trim() && !eyebrow.trim()) return;
    const id = Math.random().toString(36).slice(2, 8);
    const base: CustomSlide = { id, template, eyebrow: eyebrow.trim(), title: title.trim() };
    if (template === "text") Object.assign(base, { sub: sub.trim(), icon });
    if (template === "statement") Object.assign(base, { big: big.trim(), sub: sub.trim(), icon });
    if (template === "bullet") Object.assign(base, { footnote: footnote.trim(), icon, bullets: bullets.filter((b) => (b.t || "").trim()).map((b) => ({ icon: b.icon, t: (b.t || "").trim(), d: (b.d || "").trim() })) });
    onAdd(base); reset();
  };
  const accent = true;
  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <style>{`.hg-editable:empty:before{content:attr(data-ph);color:rgba(255,255,255,.28);font-weight:400}`}</style>
      {/* scelta template */}
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATES.map((tp) => (
          <button key={tp.key} onClick={() => setTemplate(tp.key)} className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium ${template === tp.key ? "border-brand bg-brand/15 text-white" : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"}`}>
            <tp.icon className="h-3.5 w-3.5" /> {tp.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-white/40">Clicca i testi o l'icona per modificarli.</p>

      {/* ANTEPRIMA LIVE editabile */}
      <div className="rounded-xl border border-white/10 bg-blueprint px-4 py-6">
        <div key={nonce} className="mx-auto max-w-2xl text-center">
          <div className="mb-5 flex justify-center">
            <IconPickerButton value={icon} onChange={setIcon} accent={accent} />
          </div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-brand"><Editable value={eyebrow} onChange={setEyebrow} placeholder="Etichetta" /></p>
          <h1 className="mx-auto mt-3 max-w-2xl text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-4xl">
            <Editable value={title} onChange={setTitle} placeholder="Titolo" />
          </h1>
          {template === "statement" && <p className="mt-5 inline-block rounded-2xl border border-brand/40 bg-brand/10 px-5 py-2 text-lg font-bold text-brand sm:text-xl"><Editable value={big} onChange={setBig} placeholder="Frase forte" /></p>}
          {(template === "text" || template === "statement") && <p className="mx-auto mt-5 max-w-xl text-base text-white/70"><Editable value={sub} onChange={setSub} placeholder="Sottotitolo (opzionale)" /></p>}
          {template === "bullet" && (
            <div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-3">
              {bullets.map((b, i) => (
                <div key={i} className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left">
                  <div className="mb-2 flex items-center justify-between">
                    <IconPickerButton value={b.icon || ""} onChange={(v) => setB(i, { icon: v })} size="h-9 w-9" allowNone={false} />
                    {bullets.length > 1 && <button onClick={() => setBullets((a) => a.filter((_, j) => j !== i))} title="Rimuovi" className="rounded p-1 text-destructive hover:bg-destructive/10"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                  <p className="font-semibold"><Editable value={b.t || ""} onChange={(v) => setB(i, { t: v })} placeholder="Punto" /></p>
                  <p className="mt-1 text-sm text-white/55"><Editable value={b.d || ""} onChange={(v) => setB(i, { d: v })} placeholder="Descrizione" /></p>
                </div>
              ))}
            </div>
          )}
          {template === "bullet" && (
            <div className="mt-4">
              <button onClick={() => setBullets((a) => [...a, { icon: "", t: "Nuovo punto", d: "Breve descrizione." }])} className="rounded border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10">+ punto</button>
              <p className="mx-auto mt-5 max-w-lg text-sm text-white/45"><Editable value={footnote} onChange={setFootnote} placeholder="Nota a piè di pagina (opzionale)" /></p>
            </div>
          )}
        </div>
      </div>

      <button onClick={add} className="w-full rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:brightness-110">+ Aggiungi slide</button>
    </div>
  );
}

// campo editabile in-place (contentEditable): scrive nello stato senza resettare il cursore
function Editable({ value, onChange, className, placeholder }: { value: string; onChange: (v: string) => void; className?: string; placeholder?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  // inizializza il contenuto SOLO al mount → niente salti del cursore durante la digitazione
  useEffect(() => { if (ref.current) ref.current.textContent = value; /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  return (
    <span ref={ref} contentEditable suppressContentEditableWarning role="textbox" data-ph={placeholder || ""}
      onInput={(e) => onChange(e.currentTarget.textContent || "")}
      className={`hg-editable cursor-text rounded outline-none focus:ring-2 focus:ring-brand/60 hover:ring-1 hover:ring-white/25 ${className || ""}`} />
  );
}

// Feature 6 — editor inline "click-to-edit" DIRETTO sull'anteprima reale della slide (niente form)
/** ── L'ATTESA DENTRO UNA DIRETTA ───────────────────────────────────────────
 *  ⚠️ NON DICE NIENTE CHE NON SIA VERO. Chi guarda è già in diretta, gliel'ha
 *   già detto la sala: qui serve solo che non lampeggi il bianco e che si
 *   capisca che sta arrivando qualcosa. Nessun marchio di altre cose, nessuna
 *   promessa su cosa sta per succedere — chi conduce può ripensarci e mandare
 *   in onda altro un istante dopo.
 *  ⚠️ Fondo scuro come il palco della sala: la pagina bianca che compare per
 *   mezzo secondo dentro una diretta scura si legge come un guasto. */
function AttesaDellaSala() {
  return (
    <div className="bg-blueprint fixed inset-0 z-[120] flex flex-col items-center justify-center gap-3 text-white">
      <span className="relative flex h-10 w-10 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/60" />
      </span>
      <p className="text-[13px] text-white/50">Sto caricando…</p>
    </div>
  );
}

function SlideEditor({ base, ov, onClose, onSave }: { base: Slide; ov?: SlideOverride; onClose: () => void; onSave: (o: SlideOverride) => void }) {
  const baseTitle = typeof base.title === "string" ? base.title : "";
  const [eyebrow, setEyebrow] = useState(ov?.eyebrow ?? base.eyebrow ?? "");
  const [title, setTitle] = useState(ov?.title ?? baseTitle);
  const [sub, setSub] = useState(ov?.sub ?? base.sub ?? "");
  const [big, setBig] = useState(ov?.big ?? base.big ?? "");
  const [icon, setIcon] = useState<string>(ov?.icon ?? "");
  const [pick, setPick] = useState(false); // popover icona
  const Icon = (icon && SLIDE_ICONS[icon]) ? SLIDE_ICONS[icon] : base.icon;
  const hasBig = base.big !== undefined || big !== "";
  const save = () => {
    const o: SlideOverride = {};
    if (eyebrow.trim() && eyebrow !== base.eyebrow) o.eyebrow = eyebrow.trim();
    if (title.trim() && title !== baseTitle) o.title = title.trim();
    if (sub !== (base.sub ?? "")) o.sub = sub;
    if (big !== (base.big ?? "")) o.big = big;
    if (icon) o.icon = icon;
    onSave(o);
  };
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={onClose}>
      <style>{`.hg-editable:empty:before{content:attr(data-ph);color:rgba(255,255,255,.28);font-weight:400}`}</style>
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#081226] text-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
          <Pencil className="h-4 w-4 text-brand" /><h2 className="text-sm font-semibold">Modifica sull'anteprima</h2>
          <span className="text-[11px] text-white/40">— clicca i testi o l'icona per modificarli</span>
          <button onClick={onClose} className="ml-auto rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs">Chiudi ✕</button>
        </div>

        {/* ANTEPRIMA REALE editabile in-place */}
        <div className="flex-1 overflow-y-auto bg-blueprint px-6 py-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="relative mx-auto mb-6 w-16">
              <button onClick={() => setPick((v) => !v)} title="Cambia icona" className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl ring-2 ring-transparent transition hover:ring-brand/60 ${base.accent ? "bg-brand text-white" : "bg-white/[0.06] text-brand"}`}>
                {Icon ? <Icon className="h-8 w-8" strokeWidth={1.6} /> : <span className="text-[10px] text-white/50">icona</span>}
              </button>
              {pick && (
                <div className="absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded-xl border border-white/15 bg-[#0b1730] p-2 shadow-2xl">
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => { setIcon(""); setPick(false); }} className={`flex h-9 w-9 items-center justify-center rounded-lg border text-[10px] ${!icon ? "border-brand bg-brand/15 text-brand" : "border-white/15 bg-white/5 text-white/50"}`}>orig</button>
                    {Object.entries(SLIDE_ICONS).map(([k, Ic]) => (
                      <button key={k} onClick={() => { setIcon(k); setPick(false); }} title={k} className={`flex h-9 w-9 items-center justify-center rounded-lg border ${icon === k ? "border-brand bg-brand/15 text-brand" : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10"}`}><Ic className="h-4 w-4" /></button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.3em] text-brand"><Editable value={eyebrow} onChange={setEyebrow} placeholder="Etichetta" /></p>
            <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
              <Editable value={title} onChange={setTitle} placeholder={baseTitle || "Titolo"} />
            </h1>
            {hasBig && <p className="mt-6 inline-block rounded-2xl border border-brand/40 bg-brand/10 px-5 py-2 text-xl font-bold text-brand sm:text-2xl"><Editable value={big} onChange={setBig} placeholder="Badge (opzionale)" /></p>}
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/70"><Editable value={sub} onChange={setSub} placeholder="Sottotitolo (opzionale)" /></p>
            {base.bullets && <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">{base.bullets.map((b, k) => (<div key={k} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left"><b.icon className="mb-2 h-6 w-6 text-brand" strokeWidth={1.6} /><p className="font-semibold">{b.t}</p>{b.d && <p className="mt-1 text-sm text-white/55">{b.d}</p>}</div>))}</div>}
            {base.footnote && <p className="mx-auto mt-8 max-w-lg text-sm text-white/45">{base.footnote}</p>}
          </div>
        </div>

        <div className="flex gap-2 border-t border-white/10 px-4 py-3">
          <button onClick={save} className="flex-1 rounded-lg bg-brand py-2 text-sm font-semibold hover:brightness-110">Salva</button>
          <button onClick={() => onSave({})} className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10">Ripristina</button>
        </div>
      </div>
    </div>
  );
}

function FixedSlide({ s, onFonte }: { s: Slide | undefined; onFonte?: (url: string) => void }) {
  // DIFESA: `s` è `allSlides[clampI]`. Se il mazzo è momentaneamente vuoto
  // (config appena ricevuta dal presentatore che disattiva tutto, casi non
  // ancora caricati) `s` è undefined: leggerne le proprietà faceva esplodere
  // l'intera pagina dell'ospite. Meglio una slide vuota.
  if (!s) return <div className="min-h-[40vh]" />;
  const Icon = s.icon;
  // ── COME ENTRA UNA SLIDE ──────────────────────────────────────────────────
  //  Gli elementi salgono uno dopo l'altro, a 70 ms di distanza: l'occhio
  //  segue l'ordine di lettura invece di trovarsi tutto addosso insieme.
  //  Dura in tutto meno di mezzo secondo — non è un effetto, è una guida.
  let t = 0;
  const dl = () => ({ animationDelay: `${(t += 70) - 70}ms` });
  return (
    <div className="relative text-center">
      {/* alone morbido dietro al titolo: dà profondità senza disegnare nulla */}
      <span aria-hidden className="hg-aurora pointer-events-none absolute -top-16 left-1/2 h-64 w-[28rem] -translate-x-1/2 rounded-full bg-brand/20 blur-3xl" />

      <div className="relative">
        {Icon && (
          <span className={`hg-rise mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-2xl ${
            s.accent ? "bg-gradient-to-br from-brand to-brand/70 text-white shadow-lg shadow-brand/30 ring-1 ring-white/20" : "border border-white/10 bg-white/[0.05] text-brand"
          }`} style={dl()}>
            <Icon className="h-8 w-8" strokeWidth={1.6} />
          </span>
        )}

        <p data-hg-anchor="slide-eyebrow" className="hg-rise text-[11px] font-semibold uppercase tracking-[0.32em] text-brand/90" style={dl()}>{s.eyebrow}</p>

        <h1 data-hg-anchor="slide-title" className="hg-rise mx-auto mt-4 max-w-3xl text-[2.1rem] font-extrabold leading-[1.06] tracking-[-0.02em] sm:text-[3.2rem]" style={dl()}>
          {s.title}
        </h1>

        {/* il dato che deve restare in testa: grande, senza cornice, con il filo
            di luce sotto — una cornice lo farebbe sembrare un'etichetta */}
        {s.big && (
          <p data-hg-anchor="slide-big" className="hg-rise relative mt-7 inline-block px-1 pb-2 text-2xl font-extrabold tracking-tight text-brand sm:text-3xl" style={dl()}>
            {s.big}
            <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] rounded-full bg-gradient-to-r from-transparent via-brand to-transparent" />
          </p>
        )}

        {s.sub && <p data-hg-anchor="slide-sub" className="hg-rise mx-auto mt-6 max-w-xl text-[1.05rem] leading-relaxed text-white/65 sm:text-lg" style={dl()}>{s.sub}</p>}

        {s.bars && (
          <div data-hg-anchor="slide-bars" className="mx-auto mt-9 w-full max-w-xl space-y-5 text-left">
            {s.bars.map((b, k) => (
              <div key={k} data-hg-anchor={`slide-bar-${k}`} className="hg-rise" style={dl()}>
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-semibold text-white">{b.label}</span>
                  <span className={`text-2xl font-extrabold tabular-nums ${b.tone === "muted" ? "text-white/35" : "text-brand"}`}>{b.pct}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  {/* la barra cresce all'ingresso: il rapporto si capisce mentre
                      si forma, non guardando due rettangoli fermi */}
                  <div className={`hg-grow h-full rounded-full ${b.tone === "muted" ? "bg-white/25" : "bg-gradient-to-r from-brand/70 to-brand"}`}
                    style={{ ["--w" as string]: `${Math.max(2, Math.min(100, b.pct))}%`, animationDelay: `${180 + k * 120}ms` }} />
                </div>
                {b.note && (
                  b.note.includes(" · ") ? (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {b.note.split(" · ").map((x, j) => (
                        <span key={j} className={`rounded-lg border px-2 py-1 text-[12px] leading-none ${
                          b.tone === "muted" ? "border-white/10 bg-white/[0.04] text-white/45" : "border-brand/30 bg-brand/10 text-brand"
                        }`}>{x.replace(/\.$/, "")}</span>
                      ))}
                    </div>
                  ) : <p className="mt-2 text-[13.5px] leading-snug text-white/45">{b.note}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {s.bullets && (
          <div data-hg-anchor="slide-bullets" className="mx-auto mt-9 grid max-w-3xl gap-3 text-left sm:grid-cols-3">
            {s.bullets.map((b, k) => (
              <div key={k} data-hg-anchor={`slide-bullet-${k}`}
                className="hg-rise hg-glass rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition duration-300 hover:-translate-y-0.5 hover:border-brand/30"
                style={dl()}>
                <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl border border-brand/25 bg-brand/10">
                  <b.icon className="h-4.5 w-4.5 text-brand" strokeWidth={1.7} />
                </span>
                <p className="text-[15px] font-semibold leading-snug text-white">{b.t}</p>
                {b.d && <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/50">{b.d}</p>}
              </div>
            ))}
          </div>
        )}

        {s.fonte && (
          <button type="button" onClick={() => onFonte?.(s.fonte!.url)}
            className="hg-rise mx-auto mt-7 flex items-center gap-2 rounded-xl border border-brand/35 bg-brand/10 px-4 py-2.5 text-[13px] font-semibold text-brand transition hover:bg-brand/20"
            style={dl()}>
            <ExternalLink className="h-3.5 w-3.5" /> {s.fonte.label}
          </button>
        )}

        {s.footnote && (
          <p data-hg-anchor="slide-footnote" className="hg-rise mx-auto mt-9 max-w-xl border-t border-white/[0.07] pt-5 text-[13.5px] leading-relaxed text-white/40" style={dl()}>
            {s.footnote}
          </p>
        )}
      </div>
    </div>
  );
}

function CaseCaption({ c }: { c: Caso }) {
  return (
    <div className="mt-5 text-center">
      <p className="text-2xl font-bold sm:text-3xl">{c.name || "Cliente"}{c.age && <span className="text-white/60">, {c.age} anni</span>}</p>
      {c.location && <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-white/60"><MapPin className="h-4 w-4 text-brand" /> {c.location}</p>}
    </div>
  );
}


function CaseSlide({ caso, only, reveal, onRevealDrag, videoRef, isViewer, live, audioOn, full, onToggleFull, pointerOn, onTogglePointer, split, onToggleSplit, onVid, onLoaded, onZoom, extZoom }: {
  caso: Caso; only?: "before" | "after"; reveal: number; onRevealDrag?: (p: number) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>; isViewer: boolean; live: boolean; audioOn: boolean;
  full: boolean; onToggleFull?: () => void; pointerOn?: boolean; onTogglePointer?: () => void;
  split: boolean; onToggleSplit?: (on: boolean) => void; // Feature 1 — vista separata prima/dopo, persistita per-caso
  onVid: () => void; onLoaded: () => void;
  // Zoom rispecchiato: il presentatore notifica lo stato (onZoom), l'ospite riceve
  // scale/tx/ty già pronti (extZoom) e li applica al SUO media — senza controlli.
  onZoom?: (z: { scale: number; tx: number; ty: number }) => void;
  extZoom?: { scale: number; tx: number; ty: number } | null;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const zp = useZoomPan(!isViewer); // zoom/pan e scorciatoie SOLO per il presentatore
  // presentatore → notifica ogni cambio di zoom/pan al genitore (che lo trasmette)
  useEffect(() => { if (!isViewer) onZoom?.({ scale: zp.scale, tx: zp.tx, ty: zp.ty }); }, [isViewer, zp.scale, zp.tx, zp.ty, onZoom]);
  // stile applicato al media: presentatore = zoom locale, ospite = zoom rispecchiato
  const mediaStyle: React.CSSProperties = isViewer
    ? (extZoom ? { transform: `translate(${extZoom.tx}px, ${extZoom.ty}px) scale(${extZoom.scale})`, transformOrigin: "center center", transition: "transform .12s" } : {})
    : zp.style;
  const zoomedNow = isViewer ? (extZoom ? extZoom.scale > 1 : false) : zp.zoomed;
  const setFromClientX = (clientX: number) => {
    const el = boxRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    onRevealDrag?.(((clientX - r.left) / r.width) * 100);
  };
  // Feature 2 — in schermo intero: overlay fisso a tutto viewport, stesso sfondo/texture (bg-blueprint)
  const wrap = full ? "fixed inset-0 z-[140] flex flex-col items-center justify-center overflow-auto bg-blueprint p-3 sm:p-6" : "";

  if (caso.kind === "photos") {
    // rendering: reveal=100 → si vede solo PRIMA; reveal=0 → solo DOPO
    // Con "only" siamo su una delle DUE slide separate del mazzo: niente slider,
    // una sola foto per slide (il presentatore passa con Avanti/Indietro).
    const canReveal = !!onRevealDrag && !zp.zoomed && !split && !only;
    const isBefore = only === "before";
    return (
      <div className={wrap || undefined}>
        {!full && (
          <p className="mb-3 text-center text-[12px] font-semibold uppercase tracking-[0.3em] text-brand">
            {only ? (isBefore ? "La prova · Prima" : "La prova · Dopo") : "La prova · Prima / Dopo"}
          </p>
        )}
        <div ref={(el) => { boxRef.current = el; zp.attachHost(el); }} className={`relative mx-auto aspect-[4/3] select-none overflow-hidden rounded-2xl border border-white/10 bg-brandfill ${zp.zoomed ? "cursor-grab touch-none active:cursor-grabbing" : ""} ${full ? "h-[84vh] max-h-[84vh] w-auto max-w-[96vw]" : "w-full max-w-2xl"}`}
          onWheel={!isViewer ? zp.onWheel : undefined}
          onDoubleClick={!isViewer ? zp.bump : undefined}
          onPointerDown={(e) => { if (zp.zoomed) { zp.panHandlers.onPointerDown(e); return; } if (canReveal) { dragging.current = true; setFromClientX(e.clientX); } }}
          onPointerMove={(e) => { if (zp.zoomed) { zp.panHandlers.onPointerMove(e); return; } if (dragging.current) setFromClientX(e.clientX); }}
          onPointerUp={(e) => { zp.panHandlers.onPointerUp(); dragging.current = false; void e; }}
          onPointerLeave={() => { zp.panHandlers.onPointerUp(); dragging.current = false; }}>
          <div className="absolute inset-0" style={mediaStyle}>
            {only ? (
              <>
                <img src={isBefore ? caso.beforeUrl : caso.afterUrl} alt={isBefore ? "Prima" : "Dopo"} className="absolute inset-0 h-full w-full object-cover" draggable={false} />
                <span className={`absolute left-3 top-3 rounded-md px-2 py-0.5 text-xs font-semibold ${isBefore ? "bg-black/60" : "bg-brand/80"}`}>{isBefore ? "PRIMA" : "DOPO"}</span>
              </>
            ) : (
              <>
                <img src={caso.afterUrl} alt="Dopo" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
                <div className="absolute inset-0 overflow-hidden" style={{ width: `${reveal}%` }}>
                  <img src={caso.beforeUrl} alt="Prima" className="absolute inset-0 h-full w-full max-w-none object-cover" style={{ width: boxRef.current ? boxRef.current.clientWidth : "100%" }} draggable={false} />
                  <span className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-0.5 text-xs font-semibold">PRIMA</span>
                </div>
                <span className="absolute right-3 top-3 rounded-md bg-brand/80 px-2 py-0.5 text-xs font-semibold">DOPO</span>
                {!zoomedNow && (
                  <div className="absolute inset-y-0 z-10 flex w-0.5 items-center bg-white/80" style={{ left: `${reveal}%` }}>
                    <span className="absolute left-1/2 flex h-9 w-9 -translate-x-1/2 items-center justify-center rounded-full border border-white/40 bg-white text-[#081634] shadow-lg"><MoveHorizontal className="h-4 w-4" /></span>
                  </div>
                )}
              </>
            )}
          </div>
          {!isViewer && <ZoomControls zp={zp} onFull={onToggleFull} full={full} pointerOn={pointerOn} onTogglePointer={onTogglePointer} />}
        </div>

        {/* Controlli presenter-only: "Mostra separati" trasforma il caso in DUE slide
            distinte del mazzo (prima → dopo); l'ospite segue col normale sync indice. */}
        {!isViewer && onToggleSplit && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <button onClick={() => onToggleSplit(!split)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium ${split ? "border-brand bg-brand/15 text-white" : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10"}`}>
              <SplitSquareHorizontal className="h-4 w-4" /> {split ? "Slide separate (Prima → Dopo)" : "Mostra separati"}
            </button>
          </div>
        )}
        {canReveal && !full && <p className="mt-2 text-center text-xs text-white/40">Trascina per svelare il "dopo" · Ctrl+scroll per ingrandire</p>}
        {!full && <CaseCaption c={caso} />}
      </div>
    );
  }

  // video testimonianza
  return (
    <div className={wrap || undefined}>
      {!full && <p className="mb-3 text-center text-[12px] font-semibold uppercase tracking-[0.3em] text-brand">Video testimonianza</p>}
      <div ref={(el) => { zp.attachHost(el); }} className={`relative mx-auto overflow-hidden rounded-2xl border border-white/10 bg-brandfill ${zp.zoomed ? "cursor-grab touch-none active:cursor-grabbing" : ""} ${full ? "max-h-[92vh] max-w-[96vw]" : "max-w-2xl"}`}
        onWheel={!isViewer ? zp.onWheel : undefined}
        onDoubleClick={!isViewer ? zp.bump : undefined}
        onPointerDown={!isViewer && zp.zoomed ? zp.panHandlers.onPointerDown : undefined}
        onPointerMove={!isViewer && zp.zoomed ? zp.panHandlers.onPointerMove : undefined}
        onPointerUp={!isViewer ? zp.panHandlers.onPointerUp : undefined}
        onPointerLeave={!isViewer ? zp.panHandlers.onPointerUp : undefined}>
        <video ref={videoRef} src={caso.videoUrl} playsInline
          controls={!isViewer && !zp.zoomed} autoPlay={isViewer} muted={isViewer ? !audioOn : (live)}
          onLoadedData={onLoaded} onCanPlay={onLoaded}
          onPlay={onVid} onPause={onVid} onSeeked={onVid} onRateChange={onVid}
          className={`mx-auto w-full object-contain ${full ? "max-h-[92vh]" : "max-h-[54vh]"}`} style={isViewer ? { pointerEvents: "none", ...mediaStyle } : mediaStyle} />
        {!isViewer && <ZoomControls zp={zp} onFull={onToggleFull} full={full} pointerOn={pointerOn} onTogglePointer={onTogglePointer} />}
      </div>
      {!isViewer && live && !full && <p className="mt-2 text-center text-xs text-white/45">L'audio arriva pulito sul telefono del cliente (il tuo video è in muto).</p>}
      {!full && <CaseCaption c={caso} />}
    </div>
  );
}
