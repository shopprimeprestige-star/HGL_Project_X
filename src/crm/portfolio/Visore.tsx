/** ── IL PORTAFOGLIO DEL CLIENTE — IL PULSANTE E LA FINESTRA ────────────────
 *
 *  COSA C'È QUI DENTRO
 *   · `SegnoMedia`    — il pulsante che sta SULLA RIGA, accanto al nome, con
 *                       dentro la miniatura dell'immagine principale e quanti
 *                       media ci sono. È l'unico modo di sapere dall'elenco che
 *                       quel cliente ha delle foto, senza aprire niente.
 *   · `FinestraMedia` — quello che si apre: si scorre, si carica, si sceglie la
 *                       principale, si elimina.
 *   · `CaroselloMedia`— la pista che scorre. Esportata perché la stessa cosa
 *                       serve anche alla sezione «Foto e video» della scheda
 *                       cliente, che è di un altro proprietario.
 *
 *  ⚠️ QUESTI SONO DATI PERSONALI, NON IMMAGINI QUALSIASI
 *  Sono teste, prima-e-dopo, a volte volti di clienti veri. Da qui discendono
 *  tre scelte che sembrano dettagli e non lo sono:
 *   1. il nome del file NON si mostra mai in grande e non si legge ad alta voce
 *      dai lettori di schermo come «riproduci il video Rossi-dopo-3-mesi»: è
 *      l'appunto interno del consulente e spessissimo è il nome di una persona.
 *      Le etichette di accessibilità dicono «foto 3 di 12», non il nome;
 *   2. il marchio sopra il media QUI NON SI METTE. Serve sulla pagina pubblica,
 *      dove il cliente non sa ancora di chi sia quella foto; dentro il CRM
 *      guarda solo chi lavora, e coprirebbe un pezzo di risultato proprio a chi
 *      lo deve valutare;
 *   3. eliminare una voce la toglie dalla scheda E cancella il file
 *      dall'archivio del centro (crm/portfolio/azioni → api.crm.media-elimina).
 *      Non si torna indietro, e infatti qui non c'è nessun «Annulla»: la
 *      conferma qui sotto è l'unica rete, e dice per intero cosa succede
 *      oltre — su foto di persone, «tolto dalla vista» e «cancellato» non
 *      possono essere la stessa parola.
 *
 *  ⚠️ IL CAROSELLO È IL SECONDO
 *  Il primo è in `src/routes/media.$codice.tsx`, ed è quello collaudato che
 *  vedono i clienti. Non è riusabile così com'è: le sue parti (`Diapositiva`,
 *  `Freccia`) sono funzioni locali non esportate e la pagina è saldata alla
 *  rotta. Estrarle era fuori dal perimetro di questo lavoro, quindi qui c'è una
 *  seconda pista, più corta, senza le cose che qui non servono (marchio,
 *  cornice al pixel con cqw/cqh, barra di avanzamento oltre gli otto puntini).
 *  Va detto in chiaro perché è un debito: al primo ritocco i due caroselli
 *  divergono. Quando `src/media/Carosello.tsx` esisterà, `CaroselloMedia` qui
 *  sotto si cancella e si importa quello — le proprietà sono già le stesse.
 *
 *  CHI SCRIVE I DATI: nessuno, qui. Questo file non parla né con Supabase né
 *  con lo Storage e non conosce la rotta di caricamento: legge con
 *  `portafoglioDi`/`principaleDi` e scrive solo passando da
 *  `useAzioniPortafoglio()` — le due cose stanno in crm/portfolio/dati.ts, che
 *  è l'unico punto in cui il portafoglio di un lead cambia. Se un giorno il
 *  bucket diventerà privato e gli indirizzi a scadenza (la via pulita descritta
 *  nel resoconto), qui dentro non c'è una riga da cambiare: gli url arrivano
 *  già pronti da lì.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Images,
  Loader2,
  Play,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { conPrimoFotogramma, type VoceGalleria } from "@/media/galleria";
import { Finestra, NotaFinestra } from "@/crm/ui/Finestra";
import type { Lead, MediaCliente } from "@/crm/types";
//  La lettura del portafoglio sta tutta in `dati.ts` e non qui: `principaleDi`
//  contiene le tre regole su QUALE foto va sul pulsante (scelta a mano se c'è
//  ed è ancora una foto, altrimenti la prima foto, mai un video), e riscriverne
//  anche solo una parte qui vorrebbe dire avere due risposte diverse alla
//  stessa domanda nello stesso schermo.
import { contaMedia, indiceDi, portafoglioDi, principaleDi } from "@/crm/portfolio/dati";
//  Le scritture stanno tutte di là: `azioni.ts` è l'unico posto che parla col
//  server e con lo Storage, e l'unico che chiama `updateLead`. Da qui si
//  chiedono i gesti e si leggono le loro risposte — mai si compone un
//  portafoglio a mano.
import { useAzioniPortafoglio } from "@/crm/portfolio/azioni";

/*  Il nome del cliente si ricompone qui invece di importare `nomeCompleto` da
    crm/InstallationScheduleDialog: quel file è il contenitore delle righe
    installazione, che a loro volta importeranno questo — e un anello fra i due
    moduli si paga con un import risolto a `undefined` in produzione, cioè una
    schermata bianca che in sviluppo non si vede. Due parole non valgono un
    ciclo. */
const nomeDi = (l: Lead) =>
  `${l.data.nome ?? ""} ${l.data.cognome ?? ""}`.trim() || "questo cliente";

/** Quante voci ci sono, detto in italiano. Il numero da solo su un pulsante
 *  ("3") va benissimo per l'occhio; per chi usa il lettore di schermo serve la
 *  frase intera, ed è l'unico posto in cui si scrive. */
const contaVoci = (n: number) => (n === 1 ? "1 contenuto" : `${n} contenuti`);

/** «Riduci movimento» chiesto alle impostazioni del sistema — chi soffre di
 *  vertigini o chinetosi lo mette una volta e vale per tutto. Non è un hook di
 *  proposito: qui serve solo dentro un gestore o un effetto, cioè dove il
 *  browser c'è di sicuro (questa pagina si costruisce anche sul server, e
 *  `matchMedia` là non esiste). Il foglio di stile da solo non basterebbe: lo
 *  scorrimento morbido del carosello lo decide JavaScript. */
const menoMovimento = () => {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   1. L'ANTEPRIMA DI UN MEDIA — la stessa in tre misure diverse
   ═════════════════════════════════════════════════════════════════════════ */

/** ⚠️ UN VIDEO NON È UN'IMMAGINE, E MESSO IN UN <img> È UN'IMMAGINE ROTTA.
 *  L'anteprima di un video si ottiene con l'elemento video vero, fermo sul
 *  primo fotogramma: `#t=0.1` + preload="metadata" (vedi il commento di
 *  `conPrimoFotogramma` in media/galleria). Il browser scarica solo i metadati,
 *  si ferma lì e disegna quel fotogramma come immagine ferma: nessun file
 *  generato, nessuna colonna in più. È lo stesso impianto della libreria del
 *  presentatore, che è già dimostrato funzionare con lo Storage.
 *
 *  `rotto` non è un dettaglio estetico: il portafoglio conserva l'indirizzo,
 *  non il file. Se il file non c'è più — perché lo spazio è stato ripulito, o
 *  perché l'indirizzo è cambiato — senza questo ripiego la riga mostrerebbe
 *  l'icona di immagine spezzata del browser, che si legge come «il CRM è
 *  rotto» e fa ricaricare la pagina. */
function Anteprima({
  voce,
  className,
  onRotto,
}: {
  voce: { url: string; kind: MediaCliente["kind"] };
  className?: string;
  onRotto?: () => void;
}) {
  const comune = cn("h-full w-full object-cover", className);
  if (voce.kind === "image") {
    return (
      <img
        src={voce.url}
        alt=""
        aria-hidden
        draggable={false}
        decoding="async"
        loading="lazy"
        onError={onRotto}
        className={comune}
      />
    );
  }
  return (
    <video
      src={conPrimoFotogramma(voce.url)}
      preload="metadata"
      muted
      playsInline
      //  Nessun `controls`: qui è una miniatura, non un lettore. I comandi su
      //  un riquadro da 24 pixel coprirebbero il fotogramma e basta.
      aria-hidden
      tabIndex={-1}
      onError={onRotto}
      className={comune}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. IL PULSANTE SULLA RIGA
   ═════════════════════════════════════════════════════════════════════════ */

/** ── IL SEGNO CHE APRE IL PORTAFOGLIO ─────────────────────────────────────
 *  Si monta accanto a `SegnoNote` e `SegnoDriver`, nella fila del nome, e
 *  segue le loro stesse regole: piccolo da vedere, grande da premere.
 *
 *  ⚠️ PERCHÉ SI DISEGNA ANCHE QUANDO NON C'È NIENTE (e la scelta è discutibile)
 *  Un pulsante che compare solo dove ci sono foto è più silenzioso, ma ha due
 *  difetti che su questo elenco pesano: dalla riga non si può caricare la PRIMA
 *  foto — cioè proprio il gesto che serve al primo giro — e le righe cambiano
 *  altezza a seconda che il cliente abbia o no dei media, il che fa ballare
 *  l'elenco mentre si scorre. Qui il riquadro c'è sempre e occupa sempre lo
 *  stesso spazio: pieno se c'è qualcosa, tratteggiato con un «+» se non c'è
 *  ancora niente. Vuoto NON vuol dire rotto, e infatti non è grigio spento: è
 *  un invito, con il suo verbo nel titolo ("Carica le prime foto").
 *  Se il committente lo trovasse rumoroso, la modifica è una riga: rimettere
 *  `if (!quante) return null` DOPO gli hook (mai prima: vedi qui sotto).
 *
 *  ⚠️ GLI HOOK STANNO TUTTI IN CIMA. Questo componente ha uno stato (la
 *  finestra aperta) e vive dentro un `.map()` di righe che si filtra e si
 *  riordina di continuo: un hook dichiarato dopo un ritorno anticipato verrebbe
 *  contato solo in una parte dei render e React perde l'allineamento (errore
 *  310 = schermata bianca, in questo CRM è già successo). */
export function SegnoMedia({ lead, className }: { lead: Lead; className?: string }) {
  const [aperta, setAperta] = useState(false);
  //  La finestra si costruisce solo dalla prima apertura, e da lì in poi resta
  //  montata: un elenco di installazioni sono anche duecento righe, e duecento
  //  finestre costruite per niente sono duecento portali Radix. Restando
  //  montata dopo la prima volta, un caricamento in corso NON si interrompe se
  //  si chiude la finestra per sbaglio.
  const [montata, setMontata] = useState(false);
  const [rotta, setRotta] = useState(false);
  const copertina = useMemo(() => principaleDi(lead), [lead]);
  const quante = useMemo(() => contaMedia(lead), [lead]);

  //  Cambiata la principale (o caricato un file nuovo), un errore precedente
  //  non vale più: si riprova a disegnare invece di restare per sempre sul
  //  ripiego.
  useEffect(() => setRotta(false), [copertina?.url]);

  //  ⚠️ TRE STATI, NON DUE. «Niente principale» NON vuol dire «niente media»:
  //  un portafoglio fatto di soli video non ha nessuna foto da mettere sul
  //  pulsante (regola 3 di portfolio/dati.ts), e trattarlo come vuoto direbbe
  //  «carica le prime» a chi ha appena caricato tre video — cioè darebbe del
  //  bugiardo al CRM proprio a chi ha lavorato.
  const vuoto = quante === 0;
  const soloVideo = !vuoto && !copertina;
  const nome = nomeDi(lead);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          //  La riga intera non è cliccabile, ma il nome accanto sì: fermare la
          //  propagazione costa nulla e protegge dal giorno in cui qualcuno
          //  renderà cliccabile tutta la riga.
          e.stopPropagation();
          setMontata(true);
          setAperta(true);
        }}
        aria-label={
          vuoto
            ? `Carica foto e video · ${nome}`
            : `Apri foto e video · ${contaVoci(quante)} · ${nome}`
        }
        title={
          vuoto
            ? "Nessuna foto: tocca per caricare le prime"
            : `Foto e video del cliente · ${contaVoci(quante)}`
        }
        className={cn(
          //  ⚠️ IL RITAGLIO STA SUL RIQUADRO INTERNO, NON QUI. Un
          //  `overflow-hidden` su questo elemento taglierebbe le due cose che
          //  sporgono di proposito: il pallino del conteggio (che sta
          //  sull'angolo) e soprattutto il bersaglio allargato qui sotto, che è
          //  invisibile e quindi si perderebbe senza che nessuno se ne accorga
          //  — resterebbe solo un quadratino da 24 pixel da centrare col dito.
          //  `group`: serve al velo del passaggio del mouse, che si accende sul
          //  pulsante intero e non sul solo pixel della miniatura.
          "group relative inline-flex shrink-0 items-center justify-center",
          //  24px: misurato sulla riga, non scelto a occhio. La fila del nome
          //  ospita icone da 14px, quindi QUALUNQUE miniatura fa crescere la
          //  riga; a 24 la crescita è di ~8px e resta uguale su tutte le righe
          //  (il riquadro c'è sempre), quindi l'elenco resta regolare. A 32 la
          //  riga cresceva di 16 e su una schermata da venti pose si perdeva
          //  una posa intera di visibilità.
          "h-6 w-6 rounded-md sm:h-7 sm:w-7",
          //  ── SI DEVE CAPIRE CHE SI APRE ───────────────────────────────────
          //  Tre segnali insieme, perché uno solo non basta su una miniatura
          //  piccola: il bordo (è un oggetto, non un pezzo di foto della
          //  pagina), il velo al passaggio del mouse (è un comando), il
          //  sollevamento in scala (è premibile). Sul telefono, dove il
          //  passaggio del mouse non esiste, restano bordo e ombra.
          "transition duration-150 hover:scale-110 active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900",
          //  Il bersaglio è più grande del segno: sulla riga si lavora anche in
          //  piedi col telefono in una mano, e un bersaglio da 24px si manca —
          //  mancandolo si tocca il nome e si apre la scheda del cliente.
          //  Stessa tecnica di SegnoNote: pseudo-elemento invisibile, che NON
          //  occupa spazio e quindi non allarga la riga.
          "before:absolute before:-inset-x-1 before:-inset-y-2 before:content-['']",
          className,
        )}
      >
        <span
          className={cn(
            "relative flex h-full w-full items-center justify-center overflow-hidden rounded-md ring-1",
            vuoto
              ? "border border-dashed border-slate-300 text-slate-400 ring-transparent group-hover:border-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600"
              : "bg-slate-900/5 shadow-sm ring-slate-300 group-hover:ring-slate-500",
          )}
        >
          {vuoto ? (
            //  Ancora niente: invito, non guasto. Il tratteggio e il «+» sono
            //  le due cose che in tutto il CRM vogliono dire «qui ci va
            //  qualcosa».
            <ImagePlus className="h-3.5 w-3.5" />
          ) : soloVideo ? (
            //  Ci sono solo video: nessuna foto da mettere sul pulsante (regola
            //  3 di portfolio/dati.ts). Un'icona onesta, mai il riquadro nero
            //  del primo fotogramma — un pulsante nero non dice a nessuno che
            //  dietro c'è qualcosa.
            <span className="flex h-full w-full items-center justify-center bg-slate-800">
              <Play className="h-3 w-3 fill-white/90 text-white" />
            </span>
          ) : rotta || !copertina ? (
            //  Il file non risponde più: meglio un riquadro onesto che
            //  l'immagine spezzata del browser, che si legge come «il CRM è
            //  rotto» e fa ricaricare la pagina.
            <Images className="h-3.5 w-3.5 text-slate-400" />
          ) : (
            <>
              <Anteprima voce={copertina} onRotto={() => setRotta(true)} />
              {/*  Un velo scuro appena accennato al passaggio del mouse: la
                  miniatura resta leggibile, ma nel momento in cui il mouse ci
                  passa sopra si comporta come un comando. */}
              <span className="pointer-events-none absolute inset-0 bg-slate-900/0 transition-colors group-hover:bg-slate-900/25" />
              {/*  Qui NON serve il triangolo del video: `principaleDi` non
                  restituisce mai un video, quindi quello che si vede è sempre
                  una foto vera. Il caso «ci sono solo video» è il ramo qui
                  sopra, che di triangolo ne ha uno. */}
            </>
          )}
        </span>
        {/*  QUANTI SONO — sull'angolo, non accanto: accanto sarebbe una seconda
            cosa da leggere in una fila già affollata (nome, badge oggi, spunta,
            note, driver). Compare da due in su: «1» su una miniatura che già si
            vede non aggiunge niente. */}
        {quante > 1 && (
          <span className="pointer-events-none absolute -bottom-1 -right-1 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-slate-900 px-[3px] text-[9px] font-semibold leading-none tabular-nums text-white ring-1 ring-white">
            {quante > 99 ? "99+" : quante}
          </span>
        )}
      </button>
      {/*  Si apre SULLA FOTO CHE SI È PREMUTA, non sulla prima: il pulsante
          mostra la principale, e aprire su qualcos'altro sarebbe come premere
          una miniatura e vederne un'altra. Quando la principale non c'è (solo
          video) si parte da capo, che è l'unica risposta sensata. */}
      {montata && (
        <FinestraMedia
          lead={lead}
          aperta={aperta}
          onCambio={setAperta}
          indiceIniziale={copertina ? Math.max(0, indiceDi(lead, copertina.id)) : 0}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. LA FINESTRA — si scorre, si carica, si sceglie, si elimina
   ═════════════════════════════════════════════════════════════════════════ */

/** Lo stato del caricamento in corso. Non è un booleano: cinque foto da telefono
 *  ci mettono un minuto buono, e «sta caricando» senza dire A CHE PUNTO è la
 *  ragione per cui si preme di nuovo il pulsante. */
type Coda = { totale: number; fatto: number; nome: string };

export function FinestraMedia({
  lead,
  aperta,
  onCambio,
  indiceIniziale,
}: {
  lead: Lead;
  aperta: boolean;
  onCambio: (v: boolean) => void;
  indiceIniziale?: number;
}) {
  const { carica, elimina, imponiPrincipale } = useAzioniPortafoglio();
  const [indice, setIndice] = useState(indiceIniziale ?? 0);
  const [coda, setCoda] = useState<Coda | null>(null);
  const [errori, setErrori] = useState<{ nome: string; motivo: string }[]>([]);
  /** L'id della voce per cui si sta chiedendo conferma di eliminazione. Uno
   *  stato e non una finestra dentro la finestra: due dialoghi Radix annidati
   *  si rubano il fuoco, e su una conferma è il momento peggiore. */
  const [daEliminare, setDaEliminare] = useState<string | null>(null);
  const rifFile = useRef<HTMLInputElement | null>(null);

  const info = portafoglioDi(lead);
  const voci = info.voci;
  const quante = voci.length;
  const corrente: MediaCliente | undefined = voci[indice];
  //  ⚠️ Qual è la principale lo chiede a `principaleDi` e NON a `copertinaId`:
  //  finché nessuno sceglie, il campo è vuoto ma sul pulsante della riga si
  //  vede comunque la prima foto (è il ripiego calcolato, regola 2 di
  //  portfolio/dati.ts). Leggendo il campo grezzo, la stella nella striscia
  //  sarebbe spenta su una foto che invece È quella che tutti vedono — e si
  //  finirebbe per «sceglierla» un'altra volta pensando di cambiarla.
  const principale = principaleDi(lead);
  const ePrincipale = !!corrente && principale?.id === corrente.id;

  /** ⚠️ IL LEAD DI CINQUE SECONDI FA NON VA BENE PER UN'ELIMINAZIONE.
   *  I comandi del piede (elimina, imposta come principale) partono da un
   *  click, e fra il render e il click possono passare minuti: quella foto può
   *  essere già stata tolta da un collega, o l'elenco può essersi allungato.
   *  Questo riferimento punta sempre all'ultima versione arrivata dal contesto,
   *  e le azioni lavorano su quella.
   *  ⚠️ NON BASTA INVECE PER IL CARICAMENTO DI PIÙ FILE, e per un motivo che
   *   non si vede: fra un file e il successivo React non ha ancora ridisegnato
   *   niente, quindi qui dentro c'è ancora il lead di partenza. Lì la catena si
   *   porta avanti a mano — il perché per esteso sta in `caricaTutti`. */
  const rifLead = useRef(lead);
  useEffect(() => {
    rifLead.current = lead;
  });

  //  ⚠️ La posizione di partenza si legge SOLO nel momento in cui la finestra
  //  si apre, e per questo passa da un riferimento invece che dalle dipendenze
  //  dell'effetto: chi chiama la calcola dalla principale, e la principale può
  //  cambiare mentre si sta guardando (basta sceglierne un'altra, o eliminare
  //  una foto). Con `indiceIniziale` fra le dipendenze, quel cambiamento
  //  riporterebbe il carosello all'inizio sotto gli occhi di chi stava
  //  scorrendo.
  const rifIniziale = useRef(indiceIniziale ?? 0);
  useEffect(() => {
    rifIniziale.current = indiceIniziale ?? 0;
  });

  //  Aprendo si riparte da dove è stato chiesto (la principale, di norma), e si
  //  puliscono gli errori del giro precedente: un messaggio rosso di ieri sulla
  //  finestra di oggi fa cercare un problema che non c'è.
  useEffect(() => {
    if (!aperta) return;
    setIndice(rifIniziale.current);
    setDaEliminare(null);
    setErrori([]);
  }, [aperta]);

  //  Eliminata l'ultima voce (o l'unica), l'indice punterebbe nel vuoto e la
  //  pista resterebbe bianca senza dire perché.
  useEffect(() => {
    setIndice((n) => Math.max(0, Math.min(n, quante - 1)));
  }, [quante]);

  //  Un solo punto in cui l'indice cambia, e non esce mai dall'elenco: le
  //  frecce, le miniature e lo scorrimento col dito passano tutti di qui.
  const vaiA = useCallback(
    (n: number) => setIndice(Math.max(0, Math.min(n, Math.max(0, quante - 1)))),
    [quante],
  );

  // ── LE FRECCE DELLA TASTIERA ──────────────────────────────────────────────
  //  Su computer è il primo gesto che si prova. Esc lo gestisce già la finestra
  //  (Radix), e chiudere mentre si sta chiedendo una conferma di eliminazione
  //  ANNULLA la conferma: non succede niente di distruttivo, che è la risposta
  //  giusta a un Esc premuto d'istinto.
  //  ⚠️ Se il fuoco è su un <video> le frecce NON sono nostre: servono a
  //  spostarsi dentro il filmato, ed è quello che si aspetta chi vuole rivedere
  //  un passaggio. Intercettandole, chi torna indietro di cinque secondi si
  //  ritroverebbe sulla foto successiva. Stessa regola della pagina pubblica.
  useEffect(() => {
    if (!aperta || quante < 2) return;
    const onTasto = (e: KeyboardEvent) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
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
      setIndice((n) => Math.max(0, Math.min(n + (e.key === "ArrowRight" ? 1 : -1), quante - 1)));
    };
    window.addEventListener("keydown", onTasto);
    return () => window.removeEventListener("keydown", onTasto);
  }, [aperta, quante]);

  // ── IL CARICAMENTO ────────────────────────────────────────────────────────
  //  Uno alla volta, non tutti insieme. Cinque video dal telefono in parallelo
  //  su una linea mobile si rallentano a vicenda e finiscono per scadere tutti
  //  insieme; in fila si vede avanzare il conteggio, e se uno fallisce gli
  //  altri sono già salvi.
  const caricaTutti = useCallback(
    async (scelti: File[]) => {
      if (!scelti.length) return;
      setErrori([]);
      const falliti: { nome: string; motivo: string }[] = [];
      /*  ── ⚠️ IL LEAD SI PORTA AVANTI A MANO, FILE DOPO FILE ────────────────
          Qui c'era il guasto più insidioso di tutto il portafoglio, e non dava
          nessun errore: caricando cinque foto ne restava UNA, l'ultima, e le
          altre quattro sparivano dalla scheda lasciando però il proprio file
          nello spazio pubblico del centro.
          Il motivo: ogni file aggiunge una voce, quindi il secondo deve
          ripartire dall'elenco lasciato dal primo — ma quell'elenco, un istante
          dopo la scrittura, NON è ancora nel `lead` che arriva dal contesto.
          `updateLead` chiama `setLeads` e ritorna subito (dopo quella riga, in
          CRMContext, non c'è nessun `await`), e React programma il ridisegno su
          un compito del browser mentre questo ciclo prosegue sulla coda delle
          promesse, che viene PRIMA: al secondo giro `rifLead.current` punta
          ancora al lead di partenza. Un riferimento «sempre aggiornato» qui non
          poteva funzionare, e il fatto che sembrasse funzionare è ciò che lo
          rendeva pericoloso.
          La catena quindi non passa da React: `carica` restituisce l'elenco che
          ha appena scritto e noi lo montiamo sul lead per il file successivo.
          `rifLead.current` serve ancora, ma solo per il PRIMO: è il lead vero
          nel momento in cui la persona ha premuto. */
      let base = rifLead.current;
      for (let i = 0; i < scelti.length; i++) {
        const file = scelti[i];
        setCoda({ totale: scelti.length, fatto: i, nome: file.name });
        //  La risposta si LEGGE: se il server dice perché ha rifiutato (tipo
        //  non ammesso, file troppo grande, sessione scaduta) quella frase
        //  arriva sotto gli occhi di chi ha premuto. «Errore» non è un
        //  messaggio: non dice se riprovare, se rimpicciolire o se rientrare.
        const esito = await carica(base, file);
        if (!esito.ok) {
          falliti.push({
            nome: file.name,
            motivo:
              esito.motivo?.trim() ||
              "Il server ha rifiutato il file senza dire perché. Riprova, e se succede ancora segnalalo.",
          });
          //  Un file rifiutato non ha cambiato l'elenco: si prosegue dallo
          //  stesso punto, così un HEIC in mezzo a cinque JPEG non porta via
          //  con sé quelli che l'hanno preceduto.
          continue;
        }
        if (esito.info) base = { ...base, data: { ...base.data, mediaCliente: esito.info } };
      }
      setCoda(null);
      setErrori(falliti);
      //  Chi carica vuole vedere quello che ha appena caricato: la finestra si
      //  sposta sull'ultima voce arrivata. Il conto si fa sull'elenco che
      //  abbiamo in mano e NON su `rifLead.current`, per la stessa ragione di
      //  sopra: là l'ultima voce non è ancora arrivata, e la finestra si
      //  fermerebbe sulla penultima.
      const dopo = portafoglioDi(base).voci.length;
      if (dopo > 0) setIndice(dopo - 1);
    },
    [carica],
  );

  const scegliFile = useCallback(() => rifFile.current?.click(), []);

  const inCorso = coda !== null;
  const nome = nomeDi(lead);

  /*  Le voci come le vuole il carosello. La conversione si fa QUI e non con
      `vociGalleria()` di portfolio/dati per un motivo preciso: quella passa da
      `normalizzaVoci`, che SCARTA le voci malformate — e una voce scartata
      sposta di uno tutti gli indici successivi. Il piede di questa finestra
      agisce sulla voce VISIBILE (`voci[indice]`): con gli indici sfalsati si
      imposterebbe come principale una foto e se ne eliminerebbe un'altra.
      Qui la corrispondenza è uno-a-uno per costruzione. */
  const perCarosello: VoceGalleria[] = useMemo(
    () => voci.map((v) => ({ url: v.url, kind: v.kind, nome: v.nome ?? "" })),
    [voci],
  );

  return (
    <Finestra
      aperta={aperta}
      onCambio={onCambio}
      titolo="Foto e video del cliente"
      contesto={quante ? `${nome} · ${contaVoci(quante)}` : `${nome} · ancora niente caricato`}
      icona={Images}
      larghezza="lg"
      senzaPadding
      azioni={
        daEliminare ? (
          // ── LA CONFERMA PRENDE IL POSTO DEI COMANDI ──────────────────────
          //  Non un secondo dialogo e non un `confirm()` del browser: la
          //  domanda compare dove stava il pulsante, così l'occhio non deve
          //  cercarla e il gesto sbagliato non ha dove nascondersi.
          <>
            <Button variant="outline" size="sm" onClick={() => setDaEliminare(null)}>
              Annulla
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                const id = daEliminare;
                setDaEliminare(null);
                void elimina(rifLead.current, id);
              }}
            >
              {/*  ⚠️ DICEVA «togli dalla scheda», ed era esatto finché il file
                   restava nell'archivio. Adesso lo cancella davvero e non c'è
                   più «Annulla» da nessuna parte: questa è l'ultima porta, e
                   deve dire quello che succede oltre. */}
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Sì, elimina per sempre
            </Button>
          </>
        ) : (
          <>
            {corrente && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDaEliminare(corrente.id)}
                disabled={inCorso}
                className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                title="Toglie questo contenuto dalla scheda del cliente"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Elimina
              </Button>
            )}
            {corrente && (
              //  ⚠️ Su un VIDEO il comando è spento, non nascosto, e il perché
              //  si legge passandoci sopra: nascondendolo sembrerebbe che su
              //  quel media non si possa fare niente, e chi ha appena caricato
              //  un video bello lo cercherebbe. La regola («sul pulsante ci va
              //  una foto») è una sola e sta in portfolio/dati.ts: qui non si
              //  ricopia, si spegne il pulsante che porterebbe a un rifiuto.
              <Button
                variant="outline"
                size="sm"
                onClick={() => void imponiPrincipale(rifLead.current, corrente.id)}
                disabled={ePrincipale || inCorso || corrente.kind !== "image"}
                title={
                  corrente.kind !== "image"
                    ? "Sul pulsante ci va una foto: di un video si vedrebbe solo il primo fotogramma, che quasi sempre è nero"
                    : ePrincipale
                      ? "È già l'immagine che si vede sul pulsante della riga"
                      : "Diventa l'immagine che si vede sul pulsante della riga"
                }
              >
                <Star
                  className={cn(
                    "mr-1.5 h-3.5 w-3.5",
                    ePrincipale && "fill-amber-400 text-amber-500",
                  )}
                />
                {ePrincipale ? "È la principale" : "Imposta come principale"}
              </Button>
            )}
            <Button size="sm" onClick={scegliFile} disabled={inCorso}>
              {inCorso ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="mr-1.5 h-3.5 w-3.5" />
              )}
              {inCorso ? "Sto caricando…" : "Carica foto o video"}
            </Button>
          </>
        )
      }
    >
      {/*  ⚠️ `accept` limita quello che il selettore propone, NON quello che
          arriva al server: chi vuole può scegliere «tutti i file». Il controllo
          vero sta nella rotta di caricamento, e il suo rifiuto si legge negli
          errori qui sotto.
          `image/*` sul telefono comprende anche gli HEIC di iPhone, che molti
          browser NON disegnano: se la rotta li rifiuta il motivo compare fra
          gli errori; se li accetta, la voce resta e mostra il ripiego «non
          disponibile» invece di un'immagine spezzata. */}
      <input
        ref={rifFile}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const scelti = Array.from(e.target.files ?? []);
          //  Il campo si azzera SUBITO: senza, riscegliere lo stesso file due
          //  volte di fila non emette nessun evento (il valore non cambia) e
          //  sembra che il pulsante si sia rotto.
          e.target.value = "";
          void caricaTutti(scelti);
        }}
      />

      {quante === 0 ? (
        // ── ANCORA NIENTE ─────────────────────────────────────────────────
        //  Non un vuoto muto: si dice cosa ci va e si mette il gesto sotto le
        //  dita. È anche l'unico punto da cui nasce il portafoglio di un
        //  cliente nuovo.
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white">
            <ImagePlus className="h-5 w-5 text-slate-400" />
          </span>
          <div>
            <p className="text-[13px] font-semibold text-slate-900">Nessuna foto e nessun video</p>
            <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
              Carica le foto e i video dell&apos;installazione: si scorrono come un carosello e
              quella che scegli come principale si vede sul pulsante della riga.
            </p>
          </div>
          <Button size="sm" onClick={scegliFile} disabled={inCorso}>
            {inCorso ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-3.5 w-3.5" />
            )}
            {inCorso ? "Sto caricando…" : "Carica i primi"}
          </Button>
        </div>
      ) : (
        <CaroselloMedia voci={perCarosello} indice={indice} onIndice={vaiA} />
      )}

      {/* ── SOTTO LA PISTA: le miniature, il caricamento, gli errori ──────── */}
      <div className="space-y-3 px-4 py-3 sm:px-5">
        {quante > 1 && (
          <StrisciaMiniature
            voci={voci}
            indice={indice}
            principaleId={principale?.id}
            onScegli={vaiA}
          />
        )}

        {/*  ── SI DEVE VEDERE CHE STA SALENDO ──────────────────────────────
            Cinque foto da telefono non sono istantanee. Senza una riga che
            dice a che punto è, il pulsante sembra non aver risposto e si preme
            di nuovo: il doppio caricamento è il modo più comune di ritrovarsi
            la stessa foto due volte in scheda. Qui c'è il conteggio (quante su
            quante), il nome del file in lavorazione e una barra che avanza. */}
        {coda && (
          <div
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-500" />
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-slate-900">
                {coda.totale === 1
                  ? "Sto caricando…"
                  : `Sto caricando ${coda.fatto + 1} di ${coda.totale}`}
              </span>
              {/*  La percentuale solo quando c'è più di un file: con uno solo
                  direbbe «0%» per tutto il tempo (la misura è a file finiti,
                  vedi qui sotto), e uno zero fermo si legge come «bloccato». */}
              {coda.totale > 1 && (
                <span className="shrink-0 text-[11px] tabular-nums text-slate-500">
                  {Math.round((coda.fatto / coda.totale) * 100)}%
                </span>
              )}
            </div>
            {/*  ⚠️ La barra avanza a FILE FINITI, non a byte spediti: il
                caricamento vero avviene dentro `carica()` e da qui non si
                vedono i suoi progressi. Con un file solo resterebbe quindi a
                zero per tutto il tempo e sembrerebbe bloccata: per questo,
                quando il file è uno, si mostra una barra indeterminata che si
                muove — dice «sto lavorando», che è l'unica cosa vera che
                sappiamo. */}
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-200">
              <div
                className={cn(
                  "h-full rounded-full bg-slate-900 transition-[width] duration-300",
                  coda.totale === 1 && "w-1/3 animate-pulse",
                )}
                style={
                  coda.totale === 1
                    ? undefined
                    : { width: `${Math.round((coda.fatto / coda.totale) * 100)}%` }
                }
              />
            </div>
            <p className="mt-1 truncate text-[11px] text-slate-500">{coda.nome}</p>
          </div>
        )}

        {/*  Gli errori si contano e si spiegano uno per uno: caricando cinque
            file può fallirne uno solo, e «alcuni file non sono stati caricati»
            costringerebbe a riprovarli tutti per capire quale. */}
        {errori.length > 0 && (
          <NotaFinestra tono="attenzione" icona={AlertTriangle}>
            <span className="font-semibold">
              {errori.length === 1
                ? "Un file non è stato caricato"
                : `${errori.length} file non sono stati caricati`}
            </span>
            <ul className="mt-1 space-y-0.5">
              {/*  ⚠️ La chiave è la POSIZIONE e non il nome del file: due file
                  con lo stesso nome capitano più spesso di quanto sembri
                  («IMG_0001.JPG» da due telefoni, «immagine.jpg» scelta da due
                  cartelle). Con il nome come chiave React ne disegnerebbe uno
                  solo, e sopra ci sarebbe scritto «2 file non sono stati
                  caricati»: il conteggio direbbe una cosa e l'elenco un'altra,
                  cioè proprio l'errore muto che questo riquadro esiste per
                  evitare. L'elenco non si riordina mai — si costruisce una
                  volta a fine caricamento — quindi la posizione è stabile. */}
              {errori.map((e, n) => (
                <li key={`${n}-${e.nome}`} className="leading-snug">
                  <span className="font-medium">{e.nome}</span> — {e.motivo}
                </li>
              ))}
            </ul>
          </NotaFinestra>
        )}

        {/*  La conferma di eliminazione ha il suo pulsante nel piede, ma la
            frase sta qui: nel piede ci sta una riga sola, e questa deve dire
            esattamente cosa succede — «sparisce dalla scheda», non «viene
            cancellata». Se un domani l'eliminazione porterà via anche il file
            dallo spazio di archiviazione, è QUESTA la frase da cambiare. */}
        {daEliminare && (
          /*  ⚠️ QUESTA NOTA DICEVA CHE IL LINK POTEVA CONTINUARE A
              FUNZIONARE, ed era vero: il file restava nell'archivio. Adesso
              viene cancellato, quindi la frase va cambiata insieme al
              comportamento — una nota che avverte di un difetto riparato
              insegna a diffidare di un gesto che ormai è pulito, ed è
              esattamente il modo in cui i messaggi smettono di essere letti. */
          <NotaFinestra tono="attenzione" icona={AlertTriangle}>
            Questo contenuto sparisce dalla scheda di {nome}, dal carosello e dall'archivio del
            centro: il file viene cancellato e il link smette di funzionare. Non si torna indietro.
          </NotaFinestra>
        )}
      </div>
    </Finestra>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. LA STRISCIA DELLE MINIATURE
   ═════════════════════════════════════════════════════════════════════════ */

/** Fa due mestieri insieme, ed è il motivo per cui c'è al posto dei puntini:
 *  dice dove siamo (come un indicatore) e permette di saltare a colpo sicuro
 *  sulla foto che si sta cercando — che con dodici scatti di una posa è la
 *  differenza fra scorrere e trovare. La stella segna la principale, così la
 *  scelta si vede senza aprire ogni voce. */
function StrisciaMiniature({
  voci,
  indice,
  principaleId,
  onScegli,
}: {
  voci: MediaCliente[];
  indice: number;
  /** L'id di quella che si vede sul pulsante della riga — CALCOLATO da
   *  `principaleDi`, non letto da `copertinaId`: finché nessuno ha scelto vale
   *  la prima foto, e la stella deve stare lì. */
  principaleId?: string;
  onScegli: (n: number) => void;
}) {
  const rifStriscia = useRef<HTMLDivElement | null>(null);

  //  Scorrendo con le frecce (o dopo un caricamento) la miniatura attiva può
  //  finire fuori campo: senza questo, la striscia direbbe «sei sulla prima»
  //  mentre la pista mostra la nona.
  useEffect(() => {
    const el = rifStriscia.current?.children[indice] as HTMLElement | undefined;
    el?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: menoMovimento() ? "auto" : "smooth",
    });
  }, [indice]);

  return (
    <div
      ref={rifStriscia}
      className="flex gap-1.5 overflow-x-auto overscroll-x-contain pb-1"
      style={{ scrollbarWidth: "thin" }}
    >
      {voci.map((v, n) => (
        <button
          key={v.id}
          type="button"
          onClick={() => onScegli(n)}
          aria-label={`Vai al contenuto ${n + 1} di ${voci.length}`}
          aria-current={n === indice}
          className={cn(
            "relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-slate-100 transition",
            "ring-1 ring-slate-200 hover:ring-slate-400",
            n === indice && "ring-2 ring-slate-900 hover:ring-slate-900",
          )}
        >
          <Anteprima voce={v} />
          {v.kind !== "image" && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Play className="h-3.5 w-3.5 fill-white/95 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,.8)]" />
            </span>
          )}
          {principaleId === v.id && (
            <span
              className="pointer-events-none absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-slate-900/70"
              title="È la principale"
            >
              <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. IL CAROSELLO
   ═════════════════════════════════════════════════════════════════════════ */

/** La pista che scorre. Le proprietà sono di proposito quelle previste per
 *  `src/media/Carosello.tsx`: il giorno in cui quel file esisterà, questa
 *  funzione si cancella e si cambia l'import (vedi il commento in cima).
 *
 *  L'indice è GOVERNATO DA FUORI perché il piede della finestra agisce sulla
 *  voce visibile: se il carosello se lo tenesse per sé, «imposta come
 *  principale» dovrebbe indovinare su cosa sta lavorando. */
export function CaroselloMedia({
  voci,
  indice,
  onIndice,
}: {
  voci: VoceGalleria[];
  indice: number;
  onIndice: (n: number) => void;
}) {
  const pista = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);
  const [rotti, setRotti] = useState<Record<string, true>>({});
  const quante = voci.length;

  //  Il contatore segue il dito: si legge la posizione della barra a ogni
  //  scorrimento, ma UNA VOLTA PER FOTOGRAMMA — un evento di scroll arriva
  //  anche cento volte al secondo, e ricalcolare a ogni colpo fa scattare
  //  l'animazione proprio mentre si sta scorrendo.
  const alloScorrere = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const el = pista.current;
      if (!el || !el.clientWidth) return;
      const k = Math.round(el.scrollLeft / el.clientWidth);
      onIndice(Math.max(0, Math.min(k, el.children.length - 1)));
    });
  }, [onIndice]);

  useEffect(
    () => () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    },
    [],
  );

  //  L'indice è cambiato da FUORI (frecce, tastiera, miniature, caricamento
  //  appena finito): si porta la pista dove deve stare. Se ci è già — cioè se
  //  il cambiamento arriva dal dito che sta scorrendo — non si tocca niente,
  //  altrimenti si combatterebbe con lo scorrimento in corso e il carosello
  //  rimbalzerebbe.
  useEffect(() => {
    const el = pista.current;
    if (!el || !el.clientWidth) return;
    const dovSiamo = Math.round(el.scrollLeft / el.clientWidth);
    if (dovSiamo === indice) return;
    try {
      el.scrollTo({
        left: indice * el.clientWidth,
        //  Morbido, ma non per chi ha chiesto meno movimento: lì lo spostamento
        //  è secco e immediato.
        behavior: menoMovimento() ? "auto" : "smooth",
      });
    } catch {
      //  Browser che non conoscono le opzioni: meglio uno scatto secco che
      //  restare fermi.
      el.scrollLeft = indice * el.clientWidth;
    }
  }, [indice, quante]);

  //  Un video che resta in riproduzione mentre si è già due foto più avanti
  //  continua a parlare da fuori campo.
  //  ⚠️ Si conta sulle DIAPOSITIVE, non sui video: `querySelectorAll("video")`
  //  numera solo i video, quindi in un elenco [foto, video] il video sarebbe il
  //  numero 0 mentre la sua diapositiva è la 1 — e si metterebbe in pausa
  //  proprio quello davanti agli occhi.
  useEffect(() => {
    const el = pista.current;
    if (!el) return;
    Array.from(el.children).forEach((diapositiva, n) => {
      if (n === indice) return;
      diapositiva.querySelectorAll("video").forEach((v) => v.pause());
    });
  }, [indice]);

  return (
    <div className="relative bg-slate-900">
      {/*  Altezza fissa e non «quanto è alto il media»: le voci si scorrono una
          dopo l'altra, e una pista che cambia altezza fra una foto orizzontale
          e un video verticale farebbe saltare in su e in giù tutto quello che
          sta sotto (miniature e comandi) a ogni scorrimento. In `dvh` perché su
          iOS `vh` conta anche la barra del browser che si nasconde: con `vh` la
          pista sporgeva sotto lo schermo. */}
      <div
        ref={pista}
        onScroll={alloScorrere}
        className="flex h-[42dvh] min-h-[220px] w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain sm:h-[54dvh]"
        style={{ scrollbarWidth: "none" }}
      >
        {voci.map((v, n) => (
          <div
            key={`${v.url}-${n}`}
            className="relative flex h-full w-full flex-none snap-center items-center justify-center p-2"
          >
            <Diapositiva
              voce={v}
              posizione={n}
              totale={quante}
              //  ⚠️ I media morti si segnano per INDIRIZZO e non per posizione:
              //  eliminando una voce in mezzo all'elenco tutte le successive
              //  scalano di uno, e un segno legato al numero passerebbe alla
              //  vicina — cioè una foto sana verrebbe dichiarata rotta.
              rotta={!!rotti[v.url]}
              segnalaRotta={() => setRotti((r) => ({ ...r, [v.url]: true }))}
              prima={n === 0}
            />
          </div>
        ))}
      </div>

      {/* Frecce ai lati: sul computer è il gesto che si prova per primo, e a
          metà altezza non coprono i comandi del video, che stanno in basso. */}
      {quante > 1 && (
        <>
          <Freccia
            verso="prima"
            onClick={() => onIndice(indice - 1)}
            spenta={indice === 0}
            className="left-2"
          />
          <Freccia
            verso="dopo"
            onClick={() => onIndice(indice + 1)}
            spenta={indice >= quante - 1}
            className="right-2"
          />
          {/*  Dove siamo, in cifre. Sopra la pista e non sotto: sotto ci sono
              già le miniature, e due indicatori attaccati si leggono peggio di
              uno. */}
          <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white/90 backdrop-blur-sm">
            {indice + 1} / {quante}
          </span>
        </>
      )}
    </div>
  );
}

function Freccia({
  verso,
  onClick,
  spenta,
  className,
}: {
  verso: "prima" | "dopo";
  onClick: () => void;
  spenta: boolean;
  className?: string;
}) {
  const Icona = verso === "prima" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={spenta}
      aria-label={verso === "prima" ? "Contenuto precedente" : "Contenuto successivo"}
      className={cn(
        "absolute top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full",
        "border border-white/15 bg-black/50 text-white/85 backdrop-blur-md transition",
        "hover:scale-105 hover:bg-black/70 active:scale-95",
        "disabled:pointer-events-none disabled:opacity-25",
        className,
      )}
    >
      <Icona className="h-5 w-5" />
    </button>
  );
}

/** Una diapositiva. È un componente suo e non un pezzo di JSX dentro il
 *  `.map()` perché qui servono degli stati (il video è partito? il media si è
 *  fatto vedere?), e uno stato per diapositiva dentro il componente della pista
 *  significherebbe un hook per elemento di una lista di lunghezza variabile —
 *  cioè il numero di hook che cambia da un render all'altro. */
function Diapositiva({
  voce,
  posizione,
  totale,
  rotta,
  segnalaRotta,
  prima,
}: {
  voce: VoceGalleria;
  posizione: number;
  totale: number;
  rotta: boolean;
  segnalaRotta: () => void;
  prima: boolean;
}) {
  const [avviato, setAvviato] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const rifVideo = useRef<HTMLVideoElement | null>(null);

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

  //  ── IL FILE NON C'È PIÙ ──────────────────────────────────────────────────
  //  Il portafoglio conserva l'indirizzo, non il file: se il file è stato tolto
  //  dallo spazio di archiviazione la voce resta e senza questa schermata si
  //  vedrebbe l'icona di immagine spezzata del browser. Il resto del carosello
  //  continua a funzionare.
  if (rotta) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 text-center">
        <Images className="h-7 w-7 text-white/25" />
        <span className="text-[12px] text-white/50">
          Questo file non si apre più: potrebbe essere stato rimosso dallo spazio di archiviazione.
        </span>
      </div>
    );
  }

  //  ⚠️ `object-contain` e MAI `object-cover`: un video verticale girato col
  //  telefono (che è la quasi totalità di quello che si carica) dentro un
  //  riquadro largo verrebbe tagliato a metà — e su un prima/dopo il taglio
  //  cade proprio sulla testa. Contenuto vuol dire bande nere ai lati, che è il
  //  prezzo giusto: si vede tutto e non si deforma niente.
  const classe = "max-h-full max-w-full object-contain";
  //  L'etichetta parla di posizione, non del nome del file: quel nome è
  //  l'appunto interno del consulente ed è spesso il nome di una persona.
  const etichetta = `${voce.kind === "image" ? "Foto" : "Video"} ${posizione + 1} di ${totale}`;

  if (voce.kind === "image") {
    return (
      <img
        src={voce.url}
        alt={etichetta}
        draggable={false}
        decoding="async"
        loading={prima ? "eager" : "lazy"}
        onError={segnalaRotta}
        className={classe}
      />
    );
  }

  return (
    <>
      <video
        ref={rifVideo}
        //  Fermo sul primo fotogramma invece che nero (`#t=0.1` +
        //  preload="metadata"): un video che si presenta come un rettangolo
        //  nero sembra rotto e non lo apre nessuno.
        src={conPrimoFotogramma(voce.url)}
        preload="metadata"
        playsInline
        //  Muto SOLO finché fa la copertina: l'audio torna al primo play (vedi
        //  `avvia`), altrimenti si guarderebbero video senza sonoro.
        muted={!avviato}
        //  I comandi compaiono quando servono: prima c'è un pulsante grande in
        //  mezzo, e una barra di comandi su un video fermo è la cosa che fa
        //  scambiare l'anteprima per un lettore inceppato.
        controls={avviato}
        controlsList="nodownload"
        aria-label={etichetta}
        onPlay={() => {
          setAvviato(true);
          setInCorso(true);
        }}
        onPause={() => setInCorso(false)}
        onEnded={() => setInCorso(false)}
        onError={segnalaRotta}
        className={classe}
      />
      {!inCorso && (
        <button
          type="button"
          onClick={avvia}
          aria-label={`Riproduci il ${etichetta.toLowerCase()}`}
          className="absolute left-1/2 top-1/2 z-20 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/45 text-white shadow-[0_4px_24px_rgba(0,0,0,.55)] backdrop-blur-md transition duration-200 hover:scale-105 hover:bg-black/65 active:scale-95"
        >
          <Play className="ml-0.5 h-6 w-6 fill-white/95" />
        </button>
      )}
    </>
  );
}
