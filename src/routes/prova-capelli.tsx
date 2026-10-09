/** ── LA PROVA CAPELLI ──────────────────────────────────────────────────────
 *
 *  Una persona carica la sua foto, sceglie un taglio, se vuole anche il colore,
 *  e si vede con i capelli. Sta su un indirizzo suo e non è agganciata a
 *  nessuno store: è una pagina da provare, non ancora un pezzo del sito.
 *
 *  ── ⚠️ PERCHÉ È UN PERCORSO A PASSI E NON UN MODULO SOLO ─────────────────
 *  Foto, taglio e colore in un'unica schermata vogliono dire tre decisioni
 *  insieme davanti a un tasto solo, e la prima delle tre è caricare una foto
 *  della propria faccia — la cosa che costa di più a chi arriva. Un passo per
 *  volta: si carica la foto e si vede subito, si sceglie il taglio e si è già
 *  dentro. Chi arriva al terzo passo ha già investito, e il colore lo sceglie.
 *
 *  ── ⚠️ IL COLORE È IL TERZO PASSO, NON IL SECONDO ────────────────────────
 *  Ed è già deciso quando ci si arriva: «come la mia barba» è selezionato in
 *  partenza e va bene per quasi tutti. Chiedere il colore prima del taglio
 *  vuol dire chiedere una cosa che la persona non sa, prima di quella che sa.
 *
 *  ── ⚠️ E LA FOTO NON ESCE DA QUI SE NON PER TORNARE INDIETRO ─────────────
 *  Si rimpicciolisce nel browser prima di partire (l'originale a piena
 *  risoluzione non parte mai), il servitore non la salva, e il risultato vive
 *  in questa scheda. Sta scritto anche in pagina, perché è la prima domanda
 *  che si fa chiunque prima di mandare la propria faccia a un sito.
 */
import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";

/** ── ⚠️ LA BARRA DEL PRESENTATORE, QUANDO SI ARRIVA DA MEETLY ─────────────
 *  Aprendo l'anteprima capelli durante una consulenza sparivano tutti i
 *  comandi: questa è una pagina a sé, e la barra — che sta su ogni altra
 *  schermata di Meetly — qui non c'era. Chi conduce si ritrovava senza
 *  microfono, senza il tasto per tornare al preventivo e senza il modo di
 *  chiudere la chiamata, con un cliente davanti.
 *  ⚠️ Si carica SOLO se nell'indirizzo c'è il codice della consulenza: è una
 *   pagina pubblica, aperta da telefoni qualunque, e trascinarsi dietro tutto
 *   il peso della regia per ogni visitatore sarebbe un secondo di attesa
 *   regalato a chi non la userà mai. (La barra si nasconde da sola a chi non è
 *   il presentatore: questo è un risparmio, non un controllo di accesso.) */
const BarraPresentatore = lazy(() =>
  import("@/shop/PresenterBar").then((m) => ({ default: m.PresenterBar })),
);
import {
  ArrowLeft, Camera, Check, Download, Images, Loader2, MessageCircle, Palette, Plus, RotateCw, Scissors, Sparkles, Trash2, TriangleAlert, Upload, X,
} from "lucide-react";
import {
  compostoPieno, famigliaDelComposto, GRUPPI, nomeComposto, ripulisci, vociPer, type Composto,
} from "@/prova/composto";
import {
  LATERALI_COME_IL_TAGLIO, lateraliPer, trovaLaterale,
} from "@/prova/laterali";
import { taglioPiuVicino } from "@/prova/somiglianza";
import {
  BASE_CHIARA, chiarezzaDi, COLORE_DA_FOTO, COLORI, FAMIGLIE, TAGLI,
  type ChiaveColore, type ChiaveTaglio, type Taglio,
} from "@/prova/tagli";
import { AvatarSuMisura, CiocCa, DisegnoTaglio } from "@/prova/Illustrazioni";
import { Fotocamera } from "@/prova/Fotocamera";
import { RiquadroCarica } from "@/prova/RiquadroCarica";
import { Apertura, BarraAlta, Passi, type PassoProva } from "@/prova/Testata";
import { useLiveId, useLiveNav, watchId as leggiWatch } from "@/shop/live";
import { useGuestChannel } from "@/shop/call";
import { supabase } from "@/integrations/supabase/client";
import { applyAnchor, applyRatio, readAnchor } from "@/shop/scrollsync";
import { DeviceFrame } from "@/shop/DeviceFrame";
import { daApplicare, deveGenerare, firmaStato, passoDaMostrare, type Ruolo } from "@/prova/specchio";
import { getPresenter } from "@/shop/presenter";
import { caricaLogo, conFiligrana } from "@/prova/filigrana";
import { useLogoStudio } from "@/webinar/FasciaRelatori";
import { formaValida, leggibile, PROVE_COMPRESE } from "@/prova/codici";
import { VERSIONE_SCHEDA } from "@/prova/versione-scheda";
import { alPezzo, inEuro, PACCHETTI, risparmio } from "@/prova/pacchetti";
import { ESEMPI_NOTA, NOTA_MASSIMA, ritocchiPer } from "@/prova/ritocchi";

/** ── ⚠️ QUELLO CHE SI VEDE NELLA CHAT, PRIMA DELLA PAGINA ─────────────────
 *  Questo link parte quasi sempre da WhatsApp e quasi sempre a freddo: chi lo
 *  riceve non ha chiesto niente, e il riquadro nella chat è tutto quello che
 *  ha per decidere. Prima non c'era proprio: arrivava l'indirizzo nudo.
 *  ⚠️ Il titolo è un invito, non una descrizione — «Guardati con i capelli» si
 *   capisce in tre parole; «Prova i capelli — Hair Genius Labs» comincia col
 *   verbo sbagliato e finisce col nostro nome, che a chi legge non serve.
 *  ⚠️ E la riga sotto dice subito dove finisce la foto: è la prima domanda che
 *   si fa chiunque prima di mandare la propria faccia a un sito.
 *  L'immagine la disegna il browser del CRM (vedi prova/anteprima-link.ts). */
const T = "Guardati con i capelli";
const D = "Una foto, scegli il taglio e ti vedi subito. Il viso non si tocca — e la foto resta sul tuo telefono.";
/** ⚠️ Il numero in coda NON è un vezzo: Facebook e WhatsApp tengono in cache
 *  l'immagine per INDIRIZZO. Rifare la scheda senza cambiare indirizzo non
 *  serve a niente — «scrape again» rilegge la pagina, ritrova lo stesso
 *  `og:image` e continua a mostrare i byte vecchi. Vedi prova/versione-scheda. */
const OG_IMMAGINE = `https://hair-genius-hub.hair/api/og/anteprima/capelli/generale.jpg?v=${VERSIONE_SCHEDA}`;

/** La voce scelta di un gruppo. ⚠️ `Composto` ha campi noti ma i gruppi si
 *  scorrono per chiave: senza questo passaggio servirebbe un `any`, e un `any`
 *  qui vorrebbe dire che un gruppo scritto male non lo scopre nessuno. */
const scelta = (c: Composto, gruppo: string): string =>
  String((c as Record<string, unknown>)[gruppo] ?? "");

export const Route = createFileRoute("/prova-capelli")({
  head: () => ({
    meta: [
      { title: T },
      { name: "description", content: D },
      //  ⚠️ Non è ancora una pagina pubblica: finché è una prova non deve
      //   comparire su Google né essere indicizzata per sbaglio.
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: T },
      { property: "og:description", content: D },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Hair Genius Labs" },
      { property: "og:image", content: OG_IMMAGINE },
      //  ⚠️ `og:image:secure_url` è la forma che WhatsApp cerca per prima; e
      //   dichiarare il tipo gli evita di doverlo indovinare scaricando.
      { property: "og:image:secure_url", content: OG_IMMAGINE },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:alt", content: "Guardati con i capelli" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "675" },
      { property: "og:locale", content: "it_IT" },
      //  ⚠️ Senza `twitter:card` alcuni lettori non ricadono su og:image e
      //   mostrano il link nudo: due righe che costano niente.
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: T },
      { name: "twitter:description", content: D },
      { name: "twitter:image", content: OG_IMMAGINE },
      { name: "theme-color", content: "#050f24" },
    ],
  }),
  /** ── ⚠️ LA PAGINA SI ADATTA ALLO SCHERMO DEL CLIENTE ──────────────────
   *  `DeviceFrame` è la cornice che le altre schermate della consulenza hanno
   *  da sempre: al consulente mostra la pagina nella forma ESATTA del
   *  dispositivo collegato — un telefono resta un telefono anche su un
   *  monitor da ventisette pollici. Qui mancava, e si vedeva: lui guardava una
   *  pagina larga, il cliente una stretta, e le due schermate non avevano più
   *  niente in comune — né l'aspetto né il punto in cui si era arrivati.
   *  ⚠️ Non tocca nessun altro: si annulla da sola per chi non è il consulente,
   *   per chi guarda, dentro la cornice stessa e su un telefono vero. */
  component: () => (
    <DeviceFrame>
      <Pagina />
    </DeviceFrame>
  ),
});

/** ⚠️ «codice» è il primo passo e non compare nella barra dei passi: quella
 *  racconta la PROVA, e il codice è la porta di casa — una porta non è una
 *  tappa del percorso, è quello che c'è prima. */
type Passo = "codice" | "foto" | "taglio" | "colore" | "risultato" | "compra";

/** ── LA FOTO SI RIMPICCIOLISCE QUI ─────────────────────────────────────────
 *  ⚠️ 1024 punti sul lato lungo. Non è un'ottimizzazione: una foto di telefono
 *   da dodici mega parte in base64 (che pesa un terzo in più), impiega dieci
 *   secondi sulla rete di casa e viene comunque ridotta dal modello. Ridurla
 *   qui vuol dire che l'originale a piena risoluzione non lascia mai il
 *   telefono. */
async function rimpicciolisci(file: File, lato = 1024): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scala = Math.min(1, lato / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scala);
  const h = Math.round(bitmap.height * scala);
  const tela = document.createElement("canvas");
  tela.width = w;
  tela.height = h;
  const ctx = tela.getContext("2d");
  if (!ctx) throw new Error("Il browser non riesce a leggere la foto");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  return tela.toDataURL("image/jpeg", 0.88);
}

/** Chi sta provando: serve solo al tetto giornaliero, non dice chi è la
 *  persona. Resta nel suo browser. */
function ioStesso(): string {
  try {
    let v = localStorage.getItem("hg_prova_capelli");
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem("hg_prova_capelli", v);
    }
    return v;
  } catch {
    return "";
  }
}

/** ── L'INTESTAZIONE DI UN PASSO ────────────────────────────────────────────
 *  Era ricopiata tre volte con tre misure leggermente diverse, e si vedeva:
 *  passando da un passo all'altro il titolo saltava di due pixel. Una sola
 *  forma vuol dire che la pagina sta ferma mentre cambia il contenuto — che è
 *  quello che la fa sembrare fatta bene.
 *  ⚠️ Il tasto per tornare indietro è a DESTRA e non a sinistra: sul telefono
 *   il pollice sta lì, e a sinistra c'è già il gesto «indietro» del sistema. */
function Intestazione({
  titolo, sotto, anteprima, indietro, onIndietro,
}: {
  titolo: string;
  sotto: string;
  anteprima?: string;
  indietro?: string;
  onIndietro?: () => void;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      {!!anteprima && (
        <img
          src={anteprima}
          alt=""
          className="h-14 w-14 shrink-0 rounded-2xl border border-white/10 object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold tracking-tight">{titolo}</h2>
        <p className="text-sm text-white/45">{sotto}</p>
      </div>
      {!!indietro && (
        <button
          onClick={onIndietro}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.04] px-3.5 text-sm text-white/60 transition hover:border-white/25 hover:text-white/90"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> {indietro}
        </button>
      )}
    </div>
  );
}

function Pagina() {
  const [passo, setPasso] = useState<Passo>("codice");
  /** ── IL CODICE, E QUELLO CHE PORTA CON SÉ ────────────────────────────────
   *  ⚠️ Resta nel browser: chi torna il giorno dopo non deve andare a
   *   ripescarlo nella chat, e chi ci ripensa dopo cinque minuti nemmeno. È
   *   un codice di prova, non una password — il rischio di lasciarlo lì è
   *   nessuno, il fastidio di richiederlo ogni volta è quello che fa chiudere
   *   la pagina. */
  const [codice, setCodice] = useState(() => {
    try { return localStorage.getItem("hg_codice_prova") || ""; } catch { return ""; }
  });
  const [scritto, setScritto] = useState("");
  const [controllo, setControllo] = useState(false);
  const [suoNome, setSuoNome] = useState({ nome: "", cognome: "", email: "", telefono: "" });
  const [puoComprare, setPuoComprare] = useState(false);
  /** ⚠️ Chi ha un codice admin vede in più il riquadro per aggiungere un
   *  taglio. Agli altri non deve nemmeno comparire: un tasto che si preme e
   *  risponde «non puoi» è peggio di un tasto che non c'è. */
  const [admin, setAdmin] = useState(false);
  /** ── ARCHIVIARE LE PROVE SULLA SCHEDA DI UN CLIENTE ─────────────────────
   *  Solo per chi ha un codice admin: il codice è dello studio, non di una
   *  persona, quindi le prove non hanno una scheda dove andare da sole. Si
   *  sceglie il cliente e ci vanno tutte; poi spariscono da qui, perché stanno
   *  altrove — e la fila resta pulita per il cliente dopo. */
  const [leadDelCodice, setLeadDelCodice] = useState("");
  const [cercaLead, setCercaLead] = useState("");
  const [leadTrovati, setLeadTrovati] = useState<Array<{ id: string; nome: string; cognome: string; coda: string }>>([]);
  const [invio, setInvio] = useState(false);
  const [inviate, setInviate] = useState(0);
  /** Chi ha comprato un pacchetto scarica l'immagine pulita: è il primo dei
   *  vantaggi, e l'unico che si capisce senza spiegazioni. */
  const [senzaFiligrana, setSenzaFiligrana] = useState(false);

  /** Il catalogo vero: quelli scritti nel codice più quelli aggiunti dopo.
   *  Si parte da quelli statici così la griglia non è mai vuota, nemmeno per
   *  l'istante in cui la richiesta è ancora in volo. */
  const [catalogo, setCatalogo] = useState<Array<Taglio & { immagine?: string }>>(
    () => TAGLI.map((x) => ({ ...x, immagine: `/tagli/${x.chiave}.jpg` })),
  );
  const [aggiungo, setAggiungo] = useState(false);
  /** Il taglio appena creato, in attesa di un sì o di un no. ⚠️ Finché sta
   *  qui NON è in vetrina: lo vede solo chi l'ha caricato. */
  const [appenaFatto, setAppenaFatto] = useState<(Taglio & { immagine?: string }) | null>(null);
  /** ── TUTTE LE PROVE DI QUESTA SESSIONE ───────────────────────────────────
   *  ⚠️ NON SI BUTTA NIENTE FINCHÉ LA SCHEDA È APERTA. Prima ogni prova nuova
   *   cancellava la precedente: si provavano tre tagli e per confrontarli
   *   bisognava ricordarseli, cioè non confrontarli affatto — e la scelta si
   *   fa proprio confrontando. Restano qui, in fila, e si tocca per rivederle.
   *  ⚠️ Vivono in memoria e basta: chiudendo la scheda spariscono, ed è
   *   giusto — sono facce di persone, e non devono restare nel browser di un
   *   telefono che magari è quello del negozio. Chi le vuole tenere le salva
   *   sulla scheda del cliente, che è un posto dichiarato. */
  const [anteprime, setAnteprime] = useState<Array<{
    /** ⚠️ L'id serve per CANCELLARE: senza, si può togliere una prova dallo
     *  schermo ma non dall'archivio, e alla ricarica torna. */
    id?: string;
    immagine: string; taglio: string; colore: string; nome: string; salvata?: boolean;
  }>>([]);
  /** L'album in modalità scelta: le prove spuntate da buttare via. */
  const [scelte, setScelte] = useState<string[]>([]);
  const [scegliendo, setScegliendo] = useState(false);
  /** La conferma prima di cancellare: quante se ne stanno per buttare. */
  const [confermaElimina, setConfermaElimina] = useState<string[] | null>(null);
  const [elimino, setElimino] = useState(false);
  const [salvo, setSalvo] = useState(false);
  /** L'album aperto a schermo: tutte le prove fatte con questo codice. */
  const [album, setAlbum] = useState(false);
  /** Quale foto dell'album si sta guardando grande. */
  const [inRisalto, setInRisalto] = useState("");
  /** ── LA BARBA ────────────────────────────────────────────────────────────
   *  ⚠️ SPENTA DI SUO. Chi carica una foto vuole vedersi con i capelli:
   *   ritrovarsi una barba che non ha mai avuto non è una sorpresa gradita, è
   *   un risultato sbagliato — e per giunta distrae da quello che stava
   *   guardando. Succedeva da solo, perché il modello copia la barba dalla
   *   foto di riferimento. Adesso la si chiede, una volta, al momento giusto. */
  const [barba, setBarba] = useState(false);
  /** Il taglio scelto in attesa della risposta sulla barba. */
  /** Il popup dei ritocchi: la chiave del taglio toccato, oppure `__foto`
   *  quando il taglio arriva da una fotografia caricata (che di chiave non ne
   *  ha una). Vuoto = chiuso. */
  const [chiedoBarba, setChiedoBarba] = useState<ChiaveTaglio | "__foto" | "">("");
  const [foto, setFoto] = useState("");
  const [taglio, setTaglio] = useState<ChiaveTaglio | "">("");
  const [colore, setColore] = useState<ChiaveColore | typeof COLORE_DA_FOTO>("come_barba");
  /** ── QUANTI BIANCHI E QUANTI GRIGI ──────────────────────────────────────
   *  Due numeri e non uno: il bianco puro fa luce, il grigio medio smorza, e
   *  una testa vera ne ha quantità diverse. Con un cursore solo esce sempre lo
   *  stesso «brizzolato» da fotografia di repertorio, che non somiglia a
   *  nessuno — men che meno alla persona che si sta guardando.
   *  ⚠️ Partono da zero: chi non ci pensa ottiene i capelli pieni del colore
   *   scelto, che è quello che si aspetta chiunque non abbia chiesto altro. */
  /** Le fotografie dei colori, per codice dell'anello. ⚠️ Dove non c'è la
   *  fotografia resta la tinta piena: la griglia non ha buchi, e si possono
   *  generare uno alla volta. */
  const [campioni, setCampioni] = useState<Record<string, string>>({});
  const [bianchi, setBianchi] = useState(0);
  const [grigi, setGrigi] = useState(0);
  /** La seconda foto: quella da cui prendere SOLO il colore. */
  const [fotoColore, setFotoColore] = useState("");
  /** ⚠️ SEMPRE VERO, e non è una scorciatoia: questa pagina la aprono i
   *  clienti di un centro tricologico. Chiedere «sei calvo?» a chi è arrivato
   *  qui proprio per quello è una domanda che fa male e a cui la risposta la
   *  sappiamo già. Chiedere al modello di far NASCERE i capelli dalla pelle
   *  funziona anche su una testa che ce li ha: l'attaccatura viene comunque
   *  ricostruita, e viene meglio. */
  const calvo = true;
  /** La fotocamera guidata, a tutto schermo. */
  const [fotocamera, setFotocamera] = useState(false);
  /** Il codice della consulenza da cui si è arrivati, quando c'è. */
  const [daMeetly, setDaMeetly] = useState("");
  /** ── LO SPECCHIO: LE DUE SCHERMATE FANNO LA STESSA COSA ─────────────────
   *  Il cliente ha il telefono (e la faccia), il consulente ha il mestiere.
   *  Quello che tocca uno lo vede l'altro: il taglio, il colore, il passo, il
   *  risultato. Senza, il consulente deve dettare al telefono «no, quello
   *  sotto» — che è la cosa che una videoconsulenza dovrebbe togliere di
   *  mezzo. Vedi src/prova/specchio.ts per le regole. */
  const [stanza, setStanza] = useState("");
  /** L'altro sta generando: si mostra la stessa attesa da tutte e due le parti. */
  const [altroCarica, setAltroCarica] = useState(false);
  /** Quante volte è stato chiesto «genera» in questa consulenza. */
  const [generaChiesto, setGeneraChiesto] = useState(0);
  const firmaMandata = useRef("");
  const versioneApplicata = useRef(0);
  const generaEseguito = useRef(0);
  /** ── ⚠️ IL CLIENTE DEVE SEGUIRE, COME SU OGNI ALTRA SCHERMATA ────────────
   *  Aprendo l'anteprima capelli in consulenza «si buggava»: questa pagina non
   *  partecipava alla navigazione condivisa, quindi il cliente restava fermo
   *  sul preventivo mentre chi conduce era altrove — e la consulenza si
   *  spezzava in due schermi che mostravano cose diverse.
   *  `useLiveNav` è la stessa funzione che usano slide, media e link: chi
   *  guarda chiede al server quale pagina sta mostrando il consulente e ci va.
   *  ⚠️ Vale SOLO per chi guarda (`watch`): sul presentatore farebbe seguire
   *   la pagina a sé stesso. */
  const watch = typeof window === "undefined" ? null : leggiWatch();
  useLiveNav(false, watch);
  /** Numero e messaggio per scrivere allo studio dal risultato. */
  const [contatto, setContatto] = useState<{ numero: string; messaggio: string }>({ numero: "", messaggio: "" });
  /** ── ⚠️ IL DISCLAIMER, PRIMA DI COMINCIARE ──────────────────────────────
   *  Non è burocrazia: è la differenza fra un cliente contento e uno deluso.
   *  Chi vede l'anteprima crede di vedere il risultato, e il risultato vero è
   *  un'altra cosa — migliore, ma decisa da un professionista con lui davanti.
   *  Dirlo dopo, quando è già rimasto male, non serve più a niente. */
  const [avvisoIniziale, setAvvisoIniziale] = useState(false);
  const [esito, setEsito] = useState("");
  const [carico, setCarico] = useState(false);
  const [errore, setErrore] = useState("");
  const [dettaglio, setDettaglio] = useState("");
  const [pronto, setPronto] = useState<boolean | null>(null);
  const [restano, setRestano] = useState<number | null>(null);
  /** Il pacchetto che si sta comprando, e come sta andando il pagamento. */
  const [pacchetto, setPacchetto] = useState(PACCHETTI[1].chiave);
  const [pago, setPago] = useState(false);
  const [tornato, setTornato] = useState<{ ok: boolean; testo: string } | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  const inputColore = useRef<HTMLInputElement | null>(null);
  const inputTaglio = useRef<HTMLInputElement | null>(null);
  const inputNuovo = useRef<HTMLInputElement | null>(null);
  const barbaChiesta = useRef(false);
  const logoStudio = useLogoStudio();
  /** La foto del taglio da copiare, quando non lo si sceglie dall'elenco. */
  const [fotoTaglio, setFotoTaglio] = useState("");
  /** ── IL TAGLIO COMPOSTO ─────────────────────────────────────────────────
   *  La terza strada, accanto all'elenco e alla fotografia: `bozza` è quello
   *  che si sta componendo dentro il pannello, `suMisura` quello confermato.
   *  ⚠️ Due stati e non uno: con uno solo, aprire il pannello e chiuderlo
   *   senza confermare cambierebbe il taglio che si sta per generare. */
  const [suMisura, setSuMisura] = useState<Composto | null>(null);
  const [componi, setComponi] = useState(false);
  const [bozza, setBozza] = useState<Composto>({ laterali: LATERALI_COME_IL_TAGLIO });
  /** I laterali del taglio scelto dall'elenco: «quello, ma sfumato più basso».
   *  ⚠️ Si azzerano quando si cambia taglio, come i ritocchi: appartengono a
   *   QUESTO taglio, e per giunta potrebbero non valere più per la sua
   *   famiglia (la sfumatura alta su un lungo). */
  const [laterali, setLaterali] = useState(LATERALI_COME_IL_TAGLIO);
  const [pelle, setPelle] = useState(false);
  /** ── I RITOCCHI AL TAGLIO SCELTO ────────────────────────────────────────
   *  «Quello, ma più corto ai lati» è la frase che dice chiunque si sieda su
   *  una poltrona da barbiere: qui diventa una spunta. Vedi prova/ritocchi. */
  const [ritocchi, setRitocchi] = useState<string[]>([]);
  const [nota, setNota] = useState("");
  /** La nota è chiusa finché non serve: una casella vuota chiede di scrivere,
   *  e chi non ha niente da scrivere si sente in difetto. */
  const [notaAperta, setNotaAperta] = useState(false);

  //  ⚠️ Si chiede SUBITO se il servizio è configurato: far scegliere una foto,
  //   un taglio e un colore per poi dire «manca la chiave» è tre minuti di una
  //   persona buttati, e succede sempre alla prima prova dopo un rilascio.
  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/public/prova-capelli");
        const j = await r.json();
        setPronto(!!j?.ok);
        if (!j?.ok && j?.errore) setErrore(String(j.errore));
      } catch {
        setPronto(false);
      }
    })();
  }, []);

  /** ── SI CONTROLLA IL CODICE PRIMA DI CHIEDERE LA FOTO ────────────────────
   *  ⚠️ Scoprire che il codice è finito DOPO aver caricato la propria faccia,
   *   scelto il taglio e il colore è il modo migliore di far chiudere la
   *   pagina — e di farsi ricordare male. */
  const controllaCodice = useCallback(async (c: string, silenzioso = false) => {
    if (!formaValida(c)) {
      if (!silenzioso) setErrore("Il codice è di otto caratteri: controlla di averlo copiato tutto.");
      return false;
    }
    setControllo(true);
    setErrore("");
    try {
      const r = await fetch(`/api/public/prova-capelli?codice=${encodeURIComponent(c)}`);
      const j = await r.json();
      setPuoComprare(!!j?.puoComprare);
      setAdmin(!!j?.admin);
      setLeadDelCodice(String(j?.leadId || ""));
      setSenzaFiligrana(!!j?.senzaFiligrana);
      setSuoNome({
        nome: String(j?.nome || ""), cognome: String(j?.cognome || ""),
        email: String(j?.email || ""), telefono: String(j?.telefono || ""),
      });
      if (typeof j?.restano === "number") setRestano(j.restano);
      if (!j?.ok) {
        //  Le prove finite non sono un errore da schermata rossa: sono il
        //  momento in cui si compra. Si va dritti lì.
        if (j?.puoComprare) { setCodice(c); setPasso("compra"); return true; }
        if (!silenzioso) setErrore(String(j?.errore || "Questo codice non funziona."));
        return false;
      }
      setCodice(c);
      try { localStorage.setItem("hg_codice_prova", c); } catch { /* pazienza */ }
      /** ── ⚠️ IL LISTINO NON SI MOSTRA ALL'INGRESSO ────────────────────
       *  Ci stava, e all'ingresso era la cosa sbagliata: la prima schermata
       *  di una persona che non ha ancora visto NIENTE era un prezzo. Chi
       *  arriva così non compra — non sa nemmeno se funziona — e intanto ha
       *  già capito che qui gli si vuole vendere qualcosa.
       *  Adesso all'ingresso c'è solo l'avviso su cosa è questa anteprima
       *  (che serve a chi comincia), e il listino compare da solo quando le
       *  tre prove finiscono: lì è una risposta a una domanda che si è già
       *  fatto — «e adesso?» — invece di un'offerta a chi non ha chiesto. */
      if (!j?.admin && !j?.senzaFiligrana) {
        try {
          const visto = localStorage.getItem(`hg_avviso_${c}`);
          if (!visto) {
            setAvvisoIniziale(true);
            localStorage.setItem(`hg_avviso_${c}`, "1");
          }
        } catch {
          setAvvisoIniziale(true);
        }
      }
      setPasso("foto");
      return true;
    } catch {
      if (!silenzioso) setErrore("Non riesco a controllare il codice. Riprova fra un momento.");
      return false;
    } finally {
      setControllo(false);
    }
  }, []);

  //  ⚠️ Il codice salvato si ricontrolla SEMPRE all'apertura: nel frattempo può
  //   essere stato bloccato, o le prove possono essere finite su un altro
  //   telefono. Fidarsi di quello che c'è nel browser vorrebbe dire far
  //   caricare una foto per poi dire di no.
  useEffect(() => {
    if (codice) void controllaCodice(codice, true);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/public/prova-capelli?azione=campioni");
        const j = await r.json();
        if (j?.campioni && typeof j.campioni === "object") setCampioni(j.campioni);
      } catch { /* restano le tinte piene */ }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/public/prova-capelli?azione=contatto");
        const j = await r.json();
        setContatto({ numero: String(j?.numero || ""), messaggio: String(j?.messaggio || "") });
      } catch { /* niente tasto WhatsApp */ }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const r = await fetch("/api/public/prova-capelli?azione=catalogo");
        const j = await r.json();
        if (Array.isArray(j?.tagli) && j.tagli.length) setCatalogo(j.tagli);
      } catch { /* restano quelli scritti nel codice */ }
    })();
  }, []);

  /** ── AGGIUNGERE UN TAGLIO, DA UNA FOTO ───────────────────────────────────
   *  ⚠️ Ci vuole un minuto abbondante: due generazioni vere una dopo l'altra.
   *   Il tasto lo dice PRIMA di partire, perché un minuto senza sapere che
   *   sarà un minuto è un minuto in cui si ricarica la pagina. */
  const aggiungiTaglio = async (f?: File | null) => {
    if (!f) return;
    setAggiungo(true);
    setErrore("");
    try {
      const r = await fetch("/api/public/prova-taglio-nuovo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codice, foto: await rimpicciolisci(f, 900) }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(String(j?.errore || "non riuscito"));
      //  ⚠️ NON si mette in griglia e non si sceglie da solo: prima lo si
      //   GUARDA. Una generazione su cinque esce storta, e infilarla in
      //   vetrina senza uno sguardo vuol dire che la storta la trova un
      //   cliente. Si apre l'anteprima, e da lì si decide.
      setAppenaFatto(j.taglio);
    } catch (e) {
      setErrore(`Non sono riuscito ad aggiungerlo: ${String((e as Error).message || e)}`);
    } finally {
      setAggiungo(false);
    }
  };

  /** Sì o no sul taglio appena creato. `conferma` lo manda in vetrina per
   *  tutti; `togli` lo cancella e lo dimentica. */
  const decidi = async (azione: "conferma" | "togli") => {
    if (!appenaFatto) return;
    try {
      await fetch("/api/public/prova-taglio-nuovo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codice, azione, chiave: appenaFatto.chiave }),
      });
      if (azione === "conferma") {
        setCatalogo((v) => [...v, appenaFatto]);
        setTaglio(appenaFatto.chiave as ChiaveTaglio);
      }
    } catch { /* si riprova dal gestionale */ }
    finally { setAppenaFatto(null); }
  };

  //  ── SI TORNA DAL PAGAMENTO ──────────────────────────────────────────────
  //  ⚠️ L'accredito lo decide il server chiedendo a SumUp, non questo ritorno:
  //   qui si chiede soltanto «com'è andata». Vedi api.public.prova-acquisto.
  //  ⚠️ Il codice della prova può arrivare NELL'INDIRIZZO — è così che ci
  //   entra il cliente quando il presentatore gli mostra l'anteprima durante
  //   una consulenza: lui non ha nessun codice da scrivere, e chiederglielo in
  //   videochiamata sarebbe ridicolo.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    /** ── ⚠️ LA BARRA SI MOSTRA ANCHE SENZA `meet` ────────────────────────
     *  Bastava che un parametro si perdesse per strada — ed è successo: la
     *  navigazione della barra passava l'indirizzo intero come percorso e la
     *  domanda spariva — perché chi conduce si ritrovasse senza comandi in
     *  mezzo a una consulenza. Adesso la condizione è due volte: il parametro
     *  OPPURE un presentatore già entrato su questo dispositivo, che è una
     *  lettura di localStorage e non costa niente.
     *  ⚠️ Non è un controllo d'accesso: la barra si nasconde da sola a chi non
     *   ha una sessione valida. Serve solo a non caricare il peso della regia
     *   sul telefono di un cliente qualunque. */
    /** ── ⚠️ LA BARRA DELLA REGIA SOLO A CHI STA CONDUCENDO DAVVERO ──────
     *  Prima bastava che su questo dispositivo fosse rimasto salvato un
     *  presentatore — e nel negozio è sempre così — perché la barra si
     *  montasse anche sul LINK DEL CLIENTE. E la barra, quando la sessione
     *  sul server non c'è più, non si limita a nascondersi: copre la pagina
     *  con la richiesta del PIN. Risultato: al cliente che apriva il suo link
     *  veniva chiesto di accedere come presentatore, e la prova non
     *  cominciava nemmeno.
     *  Adesso servono DUE cose insieme: il codice della consulenza
     *  nell'indirizzo (che il link del cliente non ha) e un presentatore su
     *  questo dispositivo. Chi guarda (`watch`) è escluso comunque. */
    const meet = p.get("meet") || "";
    setDaMeetly(meet && getPresenter() ? meet : "");
    setStanza(meet);
    const dallIndirizzo = p.get("c") || "";
    /** ── ⚠️ CHI HA IL CODICE NELL'INDIRIZZO NON DEVE VEDERSELO CHIEDERE ───
     *  Visto in una consulenza vera: la pagina si apre con il codice scritto
     *  nel link e mostra lo stesso «Inserisci il tuo codice». Non era il
     *  codice: era la rete che aveva fatto cadere la richiesta di controllo, e
     *  il ripiego silenzioso è la schermata d'ingresso — cioè, davanti a un
     *  cliente, un programma che sembra non funzionare.
     *  Si riprova due volte, distanziate: su una linea che vacilla la seconda
     *  passa quasi sempre. */
    if (dallIndirizzo && formaValida(dallIndirizzo)) {
      void (async () => {
        if (await controllaCodice(dallIndirizzo, true)) return;
        await new Promise((r) => setTimeout(r, 1200));
        if (await controllaCodice(dallIndirizzo, true)) return;
        await new Promise((r) => setTimeout(r, 3000));
        void controllaCodice(dallIndirizzo, true);
      })();
    }
  }, [controllaCodice]);

  /** ── SI RIAPRE LA PROVA CHE STAVI GUARDANDO ─────────────────────────────
   *  ⚠️ Un ricaricamento non deve costare una prova. Prima bastava tirare giù
   *   la pagina col dito, o che il telefono la scaricasse per fare spazio, e
   *   il risultato spariva: l'unico modo di riaverlo era rifarlo — cioè
   *   pagarlo due volte. Adesso l'immagine sta su Storage e l'indirizzo dice
   *   quale: si riapre e c'è. */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("p");
    if (!p) return;
    void (async () => {
      try {
        const r = await fetch(`/api/public/prova-capelli?anteprima=${encodeURIComponent(p)}`);
        const j = await r.json();
        if (!j?.ok || !j.anteprima) return;
        setEsito(String(j.anteprima.immagine));
        setPasso("risultato");
      } catch { /* si resta all'inizio */ }
    })();
  }, []);

  //  E la galleria: tutte le prove di questo codice, non solo quelle di
  //  questa scheda. ⚠️ Si chiede DOPO aver validato il codice, altrimenti si
  //  chiederebbero le anteprime di un codice che non esiste.
  useEffect(() => {
    if (!codice || !formaValida(codice)) return;
    void (async () => {
      try {
        const r = await fetch(
          `/api/public/prova-capelli?anteprime=${encodeURIComponent(codice)}`
          + (stanza ? `&meet=${encodeURIComponent(stanza)}` : ""),
        );
        const j = await r.json();
        if (!Array.isArray(j?.anteprime)) return;
        //  ⚠️ Il nome si cerca nel catalogo: quello che il server tiene è la
        //   CHIAVE — `wavy_con_frangia` — e stampata così sotto una fotografia
        //   sembra un pezzo di codice sfuggito. Se la chiave non si trova più
        //   (un taglio tolto dalla vetrina) si rimettono almeno gli spazi e la
        //   maiuscola, che è sempre meglio di un trattino basso.
        const leggibileTaglio = (chiave: string) => {
          const trovato = catalogo.find((x) => x.chiave === chiave)?.nome;
          if (trovato) return trovato;
          const pulito = String(chiave || "").replace(/_/g, " ").trim();
          return pulito ? pulito.charAt(0).toUpperCase() + pulito.slice(1) : "Prova";
        };
        setAnteprime(j.anteprime.map((a: { id?: string; immagine: string; taglio: string; colore: string }) => ({
          id: a.id,
          immagine: a.immagine,
          taglio: a.taglio,
          colore: a.colore,
          nome: leggibileTaglio(a.taglio),
        })));
      } catch { /* la galleria resta con quelle di questa sessione */ }
    })();
  }, [codice, catalogo, stanza]);

  useEffect(() => {
    const ordine = new URLSearchParams(window.location.search).get("ordine");
    if (!ordine) return;
    void (async () => {
      try {
        const r = await fetch(`/api/public/prova-acquisto?ordine=${encodeURIComponent(ordine)}`);
        const j = await r.json();
        if (j?.stato === "pagato") {
          setTornato({ ok: true, testo: `Fatto: ${j.prove} prove aggiunte al tuo codice.` });
          if (codice) void controllaCodice(codice, true);
        } else {
          setTornato({ ok: false, testo: "Il pagamento non risulta ancora arrivato. Se l'hai completato, riprova fra un minuto." });
        }
      } catch {
        setTornato({ ok: false, testo: "Non riesco a controllare il pagamento." });
      } finally {
        //  Si toglie il parametro dall'indirizzo: ricaricando la pagina non si
        //  deve rifare il giro, e soprattutto non si deve leggere due volte un
        //  messaggio di conferma.
        window.history.replaceState({}, "", window.location.pathname);
      }
    })();
  }, []);

  const compra = async () => {
    setPago(true);
    setErrore("");
    try {
      const r = await fetch("/api/public/prova-acquisto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codice, pacchetto, ...suoNome }),
      });
      const j = await r.json();
      if (!j?.ok || !j.dove) throw new Error(String(j?.errore || "non riesco ad aprire il pagamento"));
      window.location.href = String(j.dove);
    } catch (e) {
      setErrore(String((e as Error).message || e));
      setPago(false);
    }
  };

  const prendiFoto = async (f?: File | null) => {
    if (!f) return;
    setErrore("");
    setDettaglio("");
    try {
      const piccola = await rimpicciolisci(f);
      setFoto(piccola);
      setEsito("");
      setPasso("taglio");
    } catch (e) {
      setErrore(`Non riesco a leggere questa foto: ${String((e as Error).message || e)}`);
    }
  };

  /** ⚠️ La seconda foto NON fa avanzare il percorso e non sostituisce la
   *  prima: sceglie soltanto il colore. Confonderle vorrebbe dire generare la
   *  faccia sbagliata, ed è l'unico errore qui che non si può spiegare a chi
   *  guarda il risultato. */
  const prendiFotoColore = async (f?: File | null) => {
    if (!f) return;
    setErrore("");
    try {
      //  Più piccola dell'altra: da qui si prende un colore, non un viso, e
      //  512 punti bastano ad avere il tono giusto pesando un quarto.
      const piccola = await rimpicciolisci(f, 512);
      setFotoColore(piccola);
      setColore(COLORE_DA_FOTO);
    } catch (e) {
      setErrore(`Non riesco a leggere questa foto: ${String((e as Error).message || e)}`);
    }
  };

  /** ⚠️ Come per il colore: questa foto NON sostituisce la prima. Da qui si
   *  prende soltanto la forma del taglio — e la faccia che verrà fuori resta
   *  quella di chi sta provando. */
  const prendiFotoTaglio = async (f?: File | null) => {
    if (!f) return;
    setErrore("");
    try {
      const piccola = await rimpicciolisci(f, 768);
      setFotoTaglio(piccola);
      setTaglio("");
      //  ⚠️ Le tre strade si escludono: una fotografia caricata mentre c'era
      //   un taglio composto lascerebbe due tagli in ballo, e a generare si
      //   userebbe quello che capita.
      setSuMisura(null);
      setLaterali(LATERALI_COME_IL_TAGLIO);
      setPelle(false);
      //  ⚠️ Anche qui si passa dal popup dei ritocchi: chi porta una fotografia
      //   ha in testa il taglio ancora più di chi ne tocca uno nostro — è il
      //   suo — e «quello, ma più corto ai lati» vale identico. La famiglia
      //   però non si sa: si offrono i ritocchi larghi (vedi ritocchiPer).
      setRitocchi([]);
      setNota("");
      setNotaAperta(false);
      setChiedoBarba("__foto");
    } catch (e) {
      setErrore(`Non riesco a leggere questa foto: ${String((e as Error).message || e)}`);
    }
  };

  /** ── BUTTARE VIA LE PROVE SCELTE ────────────────────────────────────────
   *  ⚠️ PRIMA IL SERVER, POI LO SCHERMO. Togliendole subito dalla fila e
   *   cancellandole dopo, un errore di rete lascerebbe la persona convinta di
   *   aver buttato via delle fotografie che invece sono ancora lì — ed è il
   *   tipo di bugia che si scopre alla ricarica successiva.
   *  ⚠️ Le prove di questa sessione che non hanno ancora un id (rarissimo:
   *   l'archivio non ha risposto) si tolgono comunque dallo schermo: sullo
   *   schermo ci sono, e il gesto deve funzionare.
   */
  const eliminaProve = useCallback(async (immagini: string[]) => {
    const insieme = new Set(immagini);
    if (!insieme.size) return;
    setElimino(true);
    try {
      const ids = anteprime
        .filter((a) => insieme.has(a.immagine) && a.id)
        .map((a) => a.id as string);
      if (ids.length && codice) {
        const r = await fetch("/api/public/prova-capelli?azione=elimina", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codice, ids }),
        });
        const j = await r.json();
        if (!j?.ok) {
          setErrore(String(j?.errore || "Non sono riuscito a cancellarle."));
          return;
        }
      }
      setAnteprime((v) => v.filter((a) => !insieme.has(a.immagine)));
      setScelte((v) => v.filter((x) => !insieme.has(x)));
      //  ⚠️ Se quella che si guardava è fra le cancellate, lo schermo deve
      //   smettere di mostrarla: altrimenti resta grande una fotografia che
      //   non esiste più, e il tasto «salva sulla scheda» la salverebbe.
      if (insieme.has(inRisalto)) setInRisalto("");
      if (insieme.has(esito)) { setEsito(""); setPasso("taglio"); }
    } catch (e) {
      setErrore(`Non sono riuscito a cancellarle: ${String((e as Error).message || e)}`);
    } finally {
      setElimino(false);
      setConfermaElimina(null);
    }
  }, [anteprime, codice, inRisalto, esito]);

  /** Il riquadro del catalogo, letto come file da allegare.
   *  ⚠️ Non lancia: se l'immagine non si lascia leggere — indirizzo esterno
   *   senza permessi, rete che cade — si torna stringa vuota e la prova parte
   *   come prima, descritta a parole. Un difetto qui non deve impedire una
   *   generazione. */
  const leggiImmagineTaglio = async (chiave: string): Promise<string> => {
    const url = catalogo.find((x) => x.chiave === chiave)?.immagine || `/tagli/${chiave}.jpg`;
    try {
      const r = await fetch(url);
      if (!r.ok) return "";
      const blob = await r.blob();
      if (!blob.type.startsWith("image/") || blob.size > 2 * 1024 * 1024) return "";
      return await new Promise<string>((si) => {
        const lettore = new FileReader();
        lettore.onload = () => si(String(lettore.result || ""));
        lettore.onerror = () => si("");
        lettore.readAsDataURL(blob);
      });
    } catch { return ""; }
  };

  const genera = useCallback(async () => {
    //  Serve la persona, e poi O un taglio dell'elenco O la foto di un taglio.
    if (!foto || (!taglio && !fotoTaglio && !suMisura)) return;
    const immagineCatalogo = !fotoTaglio && taglio ? await leggiImmagineTaglio(taglio) : "";
    /** ── ⚠️ AL TAGLIO COMPOSTO SI ALLEGA UN ESEMPIO VERO ──────────────────
     *  DIFETTO VISTO CON GLI OCCHI: i tagli composti uscivano come parrucche.
     *  Quelli del catalogo no — e la differenza non è il testo, è che loro
     *  hanno accanto una FOTOGRAFIA di capelli veri. Le parole dicono le
     *  misure, una fotografia dice come stanno i capelli su una testa: quanto
     *  volume hanno, quanto cranio si vede sotto, come si sfilacciano i bordi.
     *  Qui si cerca il taglio del catalogo più somigliante e si manda la sua
     *  foto come esempio di REALISMO — non come taglio da copiare, e il testo
     *  lo dice tre volte. */
    const esempio = suMisura && !fotoTaglio && !taglio ? taglioPiuVicino(suMisura) : "";
    const immagineEsempio = esempio ? await leggiImmagineTaglio(esempio) : "";
    setCarico(true);
    setErrore("");
    setDettaglio("");
    setPasso("risultato");
    try {
      const r = await fetch("/api/public/prova-capelli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          //  ⚠️ Il codice della consulenza viaggia con la prova: «le tue foto»
          //   di un Meetly deve contenere quel Meetly e basta.
          ...(stanza ? { meet: stanza } : {}),
          bianchi, grigi,
          foto,
          taglio,
          colore,
          calvo,
          barba,
          chi: ioStesso(),
          codice,
          ...(colore === COLORE_DA_FOTO ? { fotoColore } : {}),
          ritocchi, nota,
          //  ⚠️ Il taglio composto e i laterali viaggiano SEMPRE: i laterali
          //   valgono anche per un taglio dell'elenco, ed è la richiesta che
          //   si fa più spesso di tutte davanti a uno specchio.
          ...(suMisura ? { composto: suMisura } : {}),
          ...(suMisura?.laterali && suMisura.laterali !== LATERALI_COME_IL_TAGLIO
            ? { laterali: suMisura.laterali, pelle: !!suMisura.pelle }
            : laterali && laterali !== LATERALI_COME_IL_TAGLIO
              ? { laterali, pelle }
              : {}),
          //  ⚠️ Il taglio del catalogo si manda anche COME IMMAGINE: di un
          //   taglio nostro al modello arrivava solo una frase, e le parole
          //   descrivono mentre una fotografia vincola. Era la ragione per cui
          //   un taglio caricato dalla persona veniva replicato meglio del
          //   nostro. Se l'immagine non si riesce a leggere si va avanti come
          //   prima: meglio una prova un po' meno fedele che nessuna prova.
          ...(fotoTaglio
            ? { fotoTaglio, taglioDaFoto: true }
            : immagineCatalogo
              ? { fotoTaglio: immagineCatalogo, taglioDaFoto: true, dalCatalogo: true }
              : immagineEsempio
                ? { fotoTaglio: immagineEsempio, esempioReale: true }
                : {}),
        }),
      });
      const j = await r.json();
      if (!j?.ok || !j.immagine) {
        //  ⚠️ «Prove finite» non è un guasto: è il momento della vendita, e
        //   mostrarlo come un errore rosso lo sciupa.
        if (j?.puoComprare) { setPuoComprare(true); setPasso("compra"); return; }
        if (j?.serveCodice) { setPasso("codice"); setErrore(String(j?.errore || "")); return; }
        setErrore(String(j?.errore || "Non è andata a buon fine."));
        setDettaglio(String(j?.dettaglio || ""));
        return;
      }
      /** ── ⚠️ LA FILIGRANA SI METTE SUBITO, NON AL DOWNLOAD ────────────
       *  Questa immagine si salva anche con un dito premuto sopra, o con uno
       *  screenshot: mettere il marchio solo nel file scaricato vorrebbe dire
       *  non metterlo quasi mai. Si stende su quella che si VEDE, che è la
       *  stessa che gira poi su WhatsApp.
       *  ⚠️ Chi ha pagato la vede pulita, ed è il vantaggio che ha comprato. */
      const grezza = String(j.immagine);
      /** ⚠️ L'etichetta dice il taglio e il colore VERI di questa prova, presi
       *   da quello che la persona ha scelto: scriverli a mano voleva dire
       *   scriverli sbagliati la prima volta che si aggiunge un taglio. */
      const nomeTaglio = suMisura
        ? nomeComposto(suMisura)
        : fotoTaglio
          ? "Il taglio della tua foto"
          : catalogo.find((x) => x.chiave === taglio)?.nome || "";
      const suo = COLORI.find((c) => c.chiave === colore);
      const bella = senzaFiligrana
        ? grezza
        : await conFiligrana(grezza, {
          testo: "HAIR GENIUS LABS",
          logo: await caricaLogo(logoStudio),
          taglio: nomeTaglio,
          colore: colore === COLORE_DA_FOTO ? "Colore della tua foto" : suo?.nome || "",
          campione: suo?.campione || "",
        });
      setEsito(bella);
      //  ⚠️ In CIMA: l'ultima è quella che si sta guardando, e in una fila
      //   orizzontale su un telefono si vede solo la prima.
      //  ⚠️ L'id nell'indirizzo, SENZA ricaricare: chi torna indietro col
      //   tasto del browser ritrova la prova di prima invece di uscire dalla
      //   pagina, e chi ricarica ritrova questa.
      /** ── ⚠️ NELL'INDIRIZZO CI VANNO TUTTI E DUE ──────────────────────
       *  Il codice e la prova. Con il solo `p` bastava che il browser
       *  perdesse la memoria — una scheda in incognito, un telefono che
       *  pulisce, un link mandato a sé stessi — perché la pagina si riaprisse
       *  chiedendo di nuovo il codice davanti a una prova già pagata.
       *  Adesso l'indirizzo è autosufficiente: chi ce l'ha vede la sua prova
       *  e ha il suo codice, da qualunque telefono. */
      try {
        const u = new URL(window.location.href);
        if (j.id) u.searchParams.set("p", String(j.id));
        if (codice) u.searchParams.set("c", codice);
        window.history.replaceState({}, "", u.toString());
      } catch { /* pazienza */ }
      setAnteprime((v) => [{
        id: j.id ? String(j.id) : undefined,
        immagine: bella,
        taglio: String(taglio || ""),
        colore: String(colore || ""),
        nome: suMisura
          ? nomeComposto(suMisura)
          : catalogo.find((x) => x.chiave === taglio)?.nome || "Il taglio della tua foto",
      }, ...v].slice(0, 30));
      if (typeof j.restano === "number") setRestano(j.restano);
    } catch (e) {
      setErrore(`Qualcosa si è interrotto: ${String((e as Error).message || e)}`);
    } finally {
      setCarico(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foto, taglio, colore, calvo, barba, fotoColore, fotoTaglio, codice, senzaFiligrana, logoStudio, ritocchi, nota, catalogo, suMisura, laterali, pelle]);

  /** ⚠️ SALVARE È DIVENTATO AUTOMATICO: ogni prova finisce da sola sulla
   *  scheda del cliente, quando il codice è collegato a un lead. Questo tasto
   *  resta per i codici NON collegati — e per chi vuole essere sicuro — ma non
   *  è più un lavoro chiesto alla persona: è una conferma.
   *  ⚠️ E non fallisce più su un'immagine già salvata: da quando ogni prova
   *   vive su Storage, qui arriva un indirizzo e non un file, e il controllo
   *   scritto per l'altra forma rispondeva sempre «Immagine non valida». */
  const salvaSuScheda = async () => {
    if (!esito || salvo) return;
    setSalvo(true);
    try {
      const r = await fetch("/api/public/prova-anteprima", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codice, immagine: esito, taglio,
          colore: COLORI.find((c) => c.chiave === colore)?.nome || "",
        }),
      });
      if (!(await r.json())?.ok) throw new Error("non salvata");
      setAnteprime((v) => v.map((a, i) => (i === 0 ? { ...a, salvata: true } : a)));
    } catch {
      setErrore("Non sono riuscito a salvarla sulla scheda.");
    } finally {
      setSalvo(false);
    }
  };

  /** ── LO SPECCHIO, IL GIRO DI RETE ──────────────────────────────────────
   *  Due effetti soli: uno racconta quello che sto facendo, l'altro chiede
   *  cosa sta facendo l'altro. Le decisioni — se applicare, quale passo si può
   *  mostrare, chi genera davvero — stanno in `@/prova/specchio`, dove si
   *  possono provare senza aprire un browser.
   *  ⚠️ Il ruolo non è un dettaglio: chi guarda (`watch`) è il cliente col
   *   telefono, l'altro è il consulente. Da questo dipende chi paga la
   *   generazione. */
  const ruolo: Ruolo = watch ? "ospite" : "guida";
  const firmaQui = firmaStato({
    passo, taglio, colore, barba, esito, carico, genera: generaChiesto,
  });

  useEffect(() => {
    if (!stanza) return;
    if (firmaQui === firmaMandata.current) return;
    firmaMandata.current = firmaQui;
    void fetch("/api/presenter/prova-specchio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      //  `keepalive`: l'ultimo stato deve partire anche se si sta chiudendo.
      keepalive: true,
      body: JSON.stringify({
        meet: stanza,
        stato: { passo, taglio, colore, barba, esito, carico, genera: generaChiesto, da: ruolo },
      }),
    }).catch(() => { /* si riprova al prossimo cambiamento */ });
  }, [stanza, firmaQui, passo, taglio, colore, barba, esito, carico, generaChiesto, ruolo]);

  useEffect(() => {
    if (!stanza) return;
    let fermo = false;
    const giro = async () => {
      try {
        const r = await fetch(`/api/presenter/prova-specchio?meet=${encodeURIComponent(stanza)}`);
        const j = await r.json();
        const remoto = j?.stato;
        if (fermo || !remoto) return;
        //  L'attesa dell'altro si mostra sempre, anche quando il resto non
        //  cambia: è l'unica cosa che spiega perché non succede niente.
        setAltroCarica(remoto.da !== ruolo && !!remoto.carico);
        if (!daApplicare(remoto, {
          ruolo,
          ultimaVersione: versioneApplicata.current,
          firmaLocale: firmaMandata.current,
        })) return;
        versioneApplicata.current = Number(remoto.v || 0);

        setTaglio(String(remoto.taglio || "") as ChiaveTaglio);
        //  ⚠️ Il colore preso da una FOTO non si sovrascrive con quello che
        //   arriva dall'altra parte: la fotografia resta su questo
        //   dispositivo, quindi una chiave qualunque arrivata da fuori
        //   cancellerebbe la scelta senza poterla rimpiazzare — e la prova
        //   uscirebbe con un colore che nessuno ha chiesto.
        if (colore !== COLORE_DA_FOTO) {
          setColore(String(remoto.colore || "come_barba") as ChiaveColore);
        }
        setBarba(!!remoto.barba);
        if (remoto.esito) setEsito(String(remoto.esito));
        setPasso(passoDaMostrare(String(remoto.passo || ""), {
          ruolo,
          haEsito: !!remoto.esito || !!esito,
          haFoto: !!foto,
        }) as typeof passo);

        /** ── ⚠️ IL «GENERA» LO ESEGUE SOLO IL TELEFONO ────────────────────
         *  La foto è là. Se generasse anche il consulente partirebbero due
         *  immagini per un gesto solo, e si pagherebbero tutte e due. */
        const chiesto = Number(remoto.genera || 0);
        if (chiesto > generaEseguito.current) {
          generaEseguito.current = chiesto;
          setGeneraChiesto(chiesto); // ⚠️ così non si rimanda indietro un numero più basso
          if (deveGenerare(ruolo, !!foto)) void genera();
        }
      } catch { /* la rete di un telefono cade: si riprova fra un secondo */ }
    };
    void giro();
    const iv = setInterval(() => void giro(), 1200);
    return () => { fermo = true; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stanza, ruolo, foto, esito, genera, colore]);

  /** ── LO SCORRIMENTO, NEI DUE SENSI ─────────────────────────────────────
   *  ⚠️ Sulle altre schermate lo scorrimento va in una direzione sola: il
   *   consulente accompagna, il cliente segue. Qui no, e per una ragione di
   *   mestiere: la vetrina dei tagli la guarda il CLIENTE, e se il consulente
   *   non vede dove è arrivato non può dirgli niente di utile. Quindi vale nei
   *   due sensi — chi muove il dito porta l'altro con sé.
   *  ⚠️ E in pixel non si trasferisce: la stessa vetrina è alta 900 punti sul
   *   portatile e 2500 sul telefono. Si dice QUALE blocco sta in cima
   *   (`data-hg-anchor`), e l'altro ci porta quello. La frazione resta come
   *   ripiego per le schermate senza ancore.
   */
  const liveId = useLiveId();
  const codiceOspite = useGuestChannel(watch ? watch : null);
  const sessione = watch ? (codiceOspite || watch) : (liveId || stanza);
  /** ⚠️ Fino a quando NON si racconta il proprio scorrimento: quello che si è
   *   appena applicato è dell'altro, e rimandarglielo indietro fa rimbalzare
   *   le due pagine su e giù senza fermarsi mai. */
  const zittoFino = useRef(0);
  const canale = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!sessione || !stanza) return;
    const ch = supabase.channel(`qcapelli-${sessione}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "scorri" }, ({ payload }) => {
      const p = payload as { s?: number; a?: string; sub?: number; da?: string };
      //  L'eco di sé stessi non si applica: si tornerebbe indietro da soli.
      if (!p || p.da === ruolo) return;
      zittoFino.current = Date.now() + 500;
      if (p.a && applyAnchor(null, { a: p.a, sub: Number(p.sub) || 0 }) != null) return;
      applyRatio(null, Number(p.s) || 0);
    });
    ch.subscribe();
    canale.current = ch;
    return () => { supabase.removeChannel(ch); canale.current = null; };
  }, [sessione, stanza, ruolo]);

  useEffect(() => {
    if (!sessione || !stanza) return;
    let ultimo = 0, disegno = 0;
    const manda = () => {
      ultimo = Date.now();
      if (ultimo < zittoFino.current) return;   // sto seguendo l'altro: sto zitto
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const a = readAnchor(null);
      canale.current?.send({
        type: "broadcast",
        event: "scorri",
        payload: { s: window.scrollY / max, a: a?.a, sub: a?.sub, da: ruolo },
      });
    };
    //  ⚠️ Non a ogni pixel: uno scorrimento col dito genera decine di eventi al
    //   secondo, e su un telefono in videochiamata ognuno toglie un fotogramma
    //   al video. Uno ogni 50 millesimi basta e avanza.
    const alTocco = () => {
      const ora = Date.now();
      if (ora - ultimo < 50) { cancelAnimationFrame(disegno); disegno = requestAnimationFrame(manda); return; }
      manda();
    };
    window.addEventListener("scroll", alTocco, { passive: true });
    return () => { window.removeEventListener("scroll", alTocco); cancelAnimationFrame(disegno); };
  }, [sessione, stanza, ruolo]);

  /** ── ⚠️ IL CONSULENTE PREME, IL TELEFONO GENERA ────────────────────────
   *  Il consulente non ha la foto del cliente — e non deve averla. Quando
   *  preme «guardati», quello che parte non è una generazione: è una richiesta
   *  che arriva sul telefono di chi la foto ce l'ha. */
  const generaOChiedi = () => {
    if (foto) { void genera(); return; }
    if (stanza && ruolo === "guida") setGeneraChiesto((n) => n + 1);
  };

  /** Cerca la scheda a cui mandarle. ⚠️ Si passa il codice: la rotta è
   *  pubblica e risponde solo a un codice admin — vedi api.public.prova-anteprima. */
  const cercaSchede = async (q: string) => {
    setCercaLead(q);
    if (q.trim().length < 2) { setLeadTrovati([]); return; }
    try {
      const r = await fetch(
        `/api/public/prova-anteprima?cerca=${encodeURIComponent(q)}&codice=${encodeURIComponent(codice)}`,
      );
      const j = await r.json();
      setLeadTrovati(Array.isArray(j?.lead) ? j.lead : []);
    } catch { setLeadTrovati([]); }
  };

  /** Le manda tutte, e le toglie da qui: sono archiviate, non perse. */
  const inviaAllaScheda = async (leadId: string) => {
    if (invio) return;
    setInvio(true);
    try {
      const r = await fetch("/api/public/prova-anteprima", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codice, azione: "invia", ...(stanza ? { meet: stanza } : {}), ...(leadId ? { leadId } : {}),
        }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(String(j?.errore || "non inviate"));
      setInviate(Number(j.quante || 0));
      //  ⚠️ Spariscono dalla pagina appena partono: se restassero, chi lavora
      //   non saprebbe più quali ha già archiviato e quali no — e le manderebbe
      //   due volte, alla persona sbagliata.
      setAnteprime([]);
      setLeadTrovati([]);
      setCercaLead("");
      if (leadId) setLeadDelCodice(leadId);
    } catch (e) {
      setErrore(`Non sono riuscito a mandarle sulla scheda: ${String((e as Error).message || e)}`);
    } finally {
      setInvio(false);
    }
  };

  const scarica = () => {
    if (!esito) return;
    const a = document.createElement("a");
    a.href = esito;
    a.download = "prova-capelli.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="min-h-[100dvh] bg-[#050f24] text-white">
      {/* ── ⚠️ LA BARRA STA FUORI DAL CONTENITORE ────────────────────────
            Era dentro la colonna larga 48rem e si vedeva: un rettangolo
            piccolo appoggiato in mezzo allo schermo, con due bordi in aria ai
            lati. Una barra di testata TOCCA i bordi — è quello che la fa
            leggere come la testata del programma e non come un altro riquadro
            del contenuto. */}
      <BarraAlta logo={logoStudio} restano={restano} passo={passo} />

      {/*  ⚠️ Spazio in fondo quando si è dentro una consulenza: la barra del
          presentatore è fissa in basso e senza questo margine copre l'ultimo
          tasto della pagina — che è sempre quello che serve. */}
      <div className={`mx-auto w-full max-w-3xl px-4 ${daMeetly ? "pb-28" : "pb-8"}`}>
        {/* ── LA TESTATA ─────────────────────────────────────────────────
              ⚠️ Il marchio non sta più nella colonna del contenuto ma in una
               BARRA che resta in alto anche scorrendo: mettere due cose su due
               piani diversi è la separazione più forte che esista, e le prime
               due versioni le tenevano sullo stesso piano — per questo
               continuavano a sembrare la stessa cosa.
              ⚠️ E il numero delle prove è salito nella barra: è l'unica cosa
               che serve in ogni passo, e lì si vede anche a metà della griglia
               dei tagli — che è dove uno si chiede «ne provo un altro?». */}
        <header className="mb-8 pt-8" data-hg-anchor="testata">
          <Apertura
            titolo="Guardati con i capelli"
            sotto="Una foto, un taglio, e vedi il risultato sul tuo viso. Il viso non si tocca: cambiano solo i capelli."
          />
          {passo !== "codice" && passo !== "compra" && (
            <div className="mt-8">
              <Passi
                passo={passo}
                admin={admin}
                haFoto={!!foto}
                guida={!!stanza && ruolo === "guida"}
                vai={(p) => setPasso(p)}
              />
            </div>
          )}
        </header>

        {!!tornato && (
          <p className={`mb-5 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm ${
            tornato.ok
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
              : "border-amber-400/30 bg-amber-400/10 text-amber-100"}`}>
            {tornato.ok ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{tornato.testo}</span>
          </p>
        )}

        {/* ══ IL BENVENUTO ════════════════════════════════════════════════
              ⚠️ Dice tre cose e in quest'ordine: quante prove hai, cosa ci
               fai, e cosa succede quando finiscono. La terza è la parte
               promozionale, ed è dichiarata — «promozione» scritto sopra i
               prezzi — perché una réclame travestita da avviso di sistema la
               si riconosce lo stesso, e l'unica cosa che ottiene è farti
               perdere la fiducia sul resto.
              ⚠️ E il tasto grosso è CONTINUARE, non comprare: chi non ha
               ancora visto una sola prova non compra, e mettergli davanti il
               pagamento come unica strada larga lo fa chiudere e basta. Si
               vende dopo, quando ha visto che funziona — e infatti il
               pacchetto ricompare da solo quando le prove finiscono. */}
        {/* ══ ANCHE LA BARBA? ═════════════════════════════════════════════
              ⚠️ Si chiede QUI, appena scelto il taglio, e non nella schermata
               della foto: lì sarebbe una domanda su una cosa che non si sta
               ancora immaginando. Subito dopo aver scelto un taglio, invece,
               la persona sta già guardando una faccia — la propria — e la
               domanda cade nel momento in cui ha senso.
              ⚠️ Due risposte, nessuna delle due scomoda: «solo i capelli» è
               la prima e la più larga, perché è quella giusta per quasi tutti
               ed è quella che il programma fa di suo. */}
        {/* ══ RIFINISCI IL TAGLIO ═════════════════════════════════════════
              ⚠️ SEMPLICE, non completo. La prima versione aveva sette righe
               con la loro descrizione, una casella di testo aperta, quattro
               esempi e due tasti: tutto vero, tutto utile, e insieme un modulo
               da compilare — davanti a una persona che voleva solo vedersi con
               i capelli. Qui le modifiche sono pastiglie da toccare, la nota
               sta chiusa dietro una riga (la apre chi ne ha bisogno) e il
               tasto è uno solo.
              ⚠️ Si apre anche per una foto di taglio caricata: lì la famiglia
               non si sa, e si offrono i ritocchi larghi. */}
        {!!chiedoBarba && (
          <div className="fixed inset-0 z-[118] flex items-end justify-center overflow-y-auto bg-black/85 p-3 backdrop-blur-sm sm:items-center sm:p-6">
            <div
              className="hg-bordo-vivo my-auto w-full max-w-md rounded-3xl p-5"
              style={{ ["--hg-fondo" as string]: "#0b1224" }}
            >
              <div className="flex items-center gap-3">
                <img
                  src={
                    chiedoBarba === "__foto"
                      ? fotoTaglio
                      : catalogo.find((x) => x.chiave === chiedoBarba)?.immagine || `/tagli/${chiedoBarba}.jpg`
                  }
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-2xl border border-white/12 object-cover"
                />
                <div className="min-w-0">
                  <h2 className="truncate text-[17px] font-semibold leading-tight">
                    {chiedoBarba === "__foto"
                      ? "Il taglio della tua foto"
                      : catalogo.find((x) => x.chiave === chiedoBarba)?.nome || "Il taglio"}
                  </h2>
                  <p className="mt-0.5 text-[12.5px] text-white/45">Vuoi ritoccarlo? È facoltativo.</p>
                </div>
              </div>

              {/* ── LE MODIFICHE, COME PASTIGLIE ───────────────────────────
                    ⚠️ Una riga per voce con la sua spiegazione sotto era
                     corretta e lunga: sette paragrafi da leggere per una cosa
                     che si sceglie a colpo d'occhio. Le pastiglie si leggono
                     tutte insieme, e quello che fanno lo dice il nome. */}
              <div className="mt-4 flex flex-wrap gap-2">
                {ritocchiPer(
                  chiedoBarba === "__foto"
                    ? ""
                    : catalogo.find((x) => x.chiave === chiedoBarba)?.famiglia,
                ).map((rt) => {
                  const preso = ritocchi.includes(rt.chiave);
                  return (
                    <button
                      key={rt.chiave}
                      title={rt.nota}
                      onClick={() => setRitocchi((v) => (
                        v.includes(rt.chiave) ? v.filter((x) => x !== rt.chiave) : [...v, rt.chiave]
                      ))}
                      className={`flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13.5px] font-medium transition ${
                        preso
                          ? "border-blue-400/70 bg-blue-500/20 text-white"
                          : "border-white/12 bg-white/[0.04] text-white/65 hover:border-white/30 hover:text-white"
                      }`}
                    >
                      {preso && <Check className="h-3.5 w-3.5 text-blue-300" />}
                      {rt.nome}
                    </button>
                  );
                })}
              </div>

              {/* ── I LATERALI, UNA SOLA ───────────────────────────────────
                    ⚠️ A scelta singola e non a spunta come i ritocchi: i
                     laterali sono uno, e «bassa» e «alta» insieme sarebbero
                     due ordini che si contraddicono. È anche il motivo per cui
                     stanno in una riga loro invece che mescolati sopra. */}
              <div className="mt-4">
                <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  I laterali
                </p>
                <div className="flex flex-wrap gap-2">
                  {lateraliPer(
                    chiedoBarba === "__foto"
                      ? ""
                      : catalogo.find((x) => x.chiave === chiedoBarba)?.famiglia,
                  ).map((l) => {
                    const preso = laterali === l.chiave;
                    return (
                      <button
                        key={l.chiave}
                        title={l.nota}
                        onClick={() => { setLaterali(l.chiave); if (!l.sfumatura) setPelle(false); }}
                        className={`rounded-full border px-3.5 py-2 text-[13.5px] font-medium transition ${
                          preso
                            ? "border-blue-400/70 bg-blue-500/20 text-white"
                            : "border-white/12 bg-white/[0.04] text-white/65 hover:border-white/30 hover:text-white"
                        }`}
                      >
                        {l.nome}
                      </button>
                    );
                  })}
                </div>
                {/*  ⚠️ «Fino alla pelle» è l'INTENSITÀ, non il punto: si
                    combina con bassa, media e alta, e su chi non ha sfumatura
                    non vuol dire niente — perciò compare solo lì. */}
                {!!trovaLaterale(laterali)?.sfumatura && (
                  <button
                    onClick={() => setPelle((v) => !v)}
                    className="mt-2.5 flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-left transition hover:border-white/25"
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                      pelle ? "border-blue-400 bg-blue-500" : "border-white/25"
                    }`}>
                      {pelle && <Check className="h-3.5 w-3.5 text-white" />}
                    </span>
                    <span className="text-[13.5px] text-white/75">Sfumatura fino alla pelle</span>
                  </button>
                )}
              </div>

              {/* ── LA NOTA, CHIUSA FINCHÉ NON SERVE ───────────────────────
                    ⚠️ Aperta era la cosa più grande del popup e la meno usata:
                     una casella di testo vuota chiede di scrivere, e chi non
                     ha niente da scrivere si sente in difetto. */}
              {!notaAperta ? (
                <button
                  onClick={() => setNotaAperta(true)}
                  className="mt-3.5 flex items-center gap-1.5 text-[13px] font-medium text-blue-300 transition hover:text-blue-200"
                >
                  <Plus className="h-3.5 w-3.5" /> Aggiungi una nota
                </button>
              ) : (
                <div className="mt-3.5">
                  <input
                    autoFocus
                    value={nota}
                    onChange={(e) => setNota(e.target.value.slice(0, NOTA_MASSIMA))}
                    placeholder="Es. un po' più corto sulla nuca"
                    className="w-full rounded-xl border border-white/12 bg-black/25 px-3.5 py-2.5 text-[14px] outline-none transition placeholder:text-white/25 focus:border-blue-400/50"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {ESEMPI_NOTA.map((e) => (
                      <button
                        key={e}
                        onClick={() => setNota(e)}
                        className="rounded-full border border-white/10 px-2.5 py-1 text-[11.5px] text-white/45 transition hover:border-blue-400/40 hover:text-white/80"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── LA BARBA, UNA RIGA SOLA ────────────────────────────────── */}
              <button
                onClick={() => setBarba((v) => !v)}
                className="mt-4 flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-left transition hover:border-white/25"
              >
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                  barba ? "border-blue-400 bg-blue-500" : "border-white/25"
                }`}>
                  {barba && <Check className="h-3.5 w-3.5 text-white" />}
                </span>
                <span className="text-[13.5px] text-white/75">Prova anche la barba</span>
              </button>

              <button
                onClick={() => {
                  if (chiedoBarba !== "__foto") setTaglio(chiedoBarba as ChiaveTaglio);
                  setChiedoBarba("");
                  setPasso("colore");
                }}
                className="hg-shine mt-4 w-full rounded-xl bg-blue-500 py-3.5 font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-400"
              >
                {ritocchi.length || nota.trim() ? "Continua con i ritocchi" : "Continua"}
              </button>
              <p className="mt-2.5 text-center text-[11.5px] text-white/30">
                Sono ritocchi: il taglio resta quello. Per cambiarlo, scegline un altro.
              </p>
            </div>
          </div>
        )}

        {/* ══ COMPONI IL TUO TAGLIO ═══════════════════════════════════════
              ⚠️ UNA VOCE PER RIGA, NON UNA LISTA DELLA SPESA. Ogni riga
               risponde a una domanda sola e ammette una risposta sola: due
               risposte alla stessa domanda sono due ordini che si
               contraddicono, e il modello ne inventa un terzo.
              ⚠️ E il tasto resta spento finché non ci sono lunghezza e
               capello: senza quei due non c'è un taglio, c'è un elenco di
               dettagli attorno al niente — e il buco il modello lo riempie
               con i capelli che la persona ha già, che è il difetto per cui
               questa pagina esiste. */}
        {componi && (
          <div className="fixed inset-0 z-[119] flex items-end justify-center overflow-y-auto bg-black/85 p-3 backdrop-blur-sm sm:items-center sm:p-6">
            <div
              className="hg-bordo-vivo my-auto w-full max-w-lg rounded-3xl p-5"
              style={{ ["--hg-fondo" as string]: "#0b1224" }}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 via-blue-500/15 to-cyan-400/20 ring-1 ring-white/10">
                  <AvatarSuMisura className="h-full w-full p-0.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[17px] font-semibold leading-tight">Componi il tuo taglio</h2>
                  <p className="mt-0.5 text-[12.5px] text-white/45">Una scelta per riga. Le prime due servono.</p>
                </div>
                <button
                  onClick={() => setComponi(false)}
                  className="shrink-0 rounded-full border border-white/12 p-2 text-white/50 transition hover:border-white/30 hover:text-white"
                  aria-label="Chiudi"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {GRUPPI.map((g) => (
                <div key={g.chiave} className="mt-4">
                  <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    {g.nome}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {vociPer(g.chiave, bozza).map((v) => {
                      const preso = scelta(bozza, g.chiave) === v.chiave;
                      return (
                        <button
                          key={v.chiave}
                          title={v.nota}
                          //  ⚠️ Si ripulisce a ogni tocco: cambiando la
                          //   lunghezza, un ciuffo che non ci sta più deve
                          //   sparire dalla scelta e non restare spuntato in
                          //   una riga che non lo mostra nemmeno.
                          onClick={() => setBozza((b) => ripulisci({ ...b, [g.chiave]: v.chiave }))}
                          className={`rounded-full border px-3.5 py-2 text-[13.5px] font-medium transition ${
                            preso
                              ? "border-blue-400/70 bg-blue-500/20 text-white"
                              : "border-white/12 bg-white/[0.04] text-white/65 hover:border-white/30 hover:text-white"
                          }`}
                        >
                          {v.nome}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* ── I LATERALI ─────────────────────────────────────────────
                    ⚠️ Qui la famiglia non c'è — il taglio non esiste ancora —
                     e si offrono i laterali larghi: nel dubbio il meno
                     specifico, mai il più rischioso. */}
              <div className="mt-4">
                <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-white/40">
                  I laterali
                </p>
                <div className="flex flex-wrap gap-2">
                  {lateraliPer(famigliaDelComposto(bozza)).map((l) => {
                    const preso = (bozza.laterali || LATERALI_COME_IL_TAGLIO) === l.chiave;
                    return (
                      <button
                        key={l.chiave}
                        title={l.nota}
                        onClick={() => setBozza((b) => ({
                          ...b,
                          laterali: l.chiave,
                          ...(l.sfumatura ? {} : { pelle: false }),
                        }))}
                        className={`rounded-full border px-3.5 py-2 text-[13.5px] font-medium transition ${
                          preso
                            ? "border-blue-400/70 bg-blue-500/20 text-white"
                            : "border-white/12 bg-white/[0.04] text-white/65 hover:border-white/30 hover:text-white"
                        }`}
                      >
                        {l.chiave === LATERALI_COME_IL_TAGLIO ? "Naturali" : l.nome}
                      </button>
                    );
                  })}
                </div>
                {!!trovaLaterale(bozza.laterali || "")?.sfumatura && (
                  <button
                    onClick={() => setBozza((b) => ({ ...b, pelle: !b.pelle }))}
                    className="mt-2.5 flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-left transition hover:border-white/25"
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${
                      bozza.pelle ? "border-blue-400 bg-blue-500" : "border-white/25"
                    }`}>
                      {bozza.pelle && <Check className="h-3.5 w-3.5 text-white" />}
                    </span>
                    <span className="text-[13.5px] text-white/75">Sfumatura fino alla pelle</span>
                  </button>
                )}
              </div>

              <button
                disabled={!compostoPieno(bozza)}
                onClick={() => {
                  setSuMisura(bozza);
                  setTaglio("");
                  setFotoTaglio("");
                  //  ⚠️ I ritocchi sono di un ALTRO taglio: tenerli qui vorrebbe
                  //   dire mandare al modello una modifica a una cosa che non
                  //   esiste più.
                  setRitocchi([]);
                  setNota("");
                  setNotaAperta(false);
                  setLaterali(LATERALI_COME_IL_TAGLIO);
                  setPelle(false);
                  setComponi(false);
                  setPasso("colore");
                }}
                className="hg-shine mt-5 w-full rounded-xl bg-blue-500 py-3.5 font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-400 disabled:opacity-40 disabled:shadow-none"
              >
                {compostoPieno(bozza) ? `Continua con «${nomeComposto(bozza)}»` : "Scegli lunghezza e capello"}
              </button>
              <p className="mt-2.5 text-center text-[11.5px] text-white/30">
                Puoi tornare qui e cambiarlo quando vuoi.
              </p>
            </div>
          </div>
        )}

        {/* ══ LE TUE FOTO ═════════════════════════════════════════════════
              ⚠️ Il pulsante sta IN CIMA e c'è solo se ci sono davvero delle
               prove: è il posto dove una persona torna, e in fondo alla pagina
               non lo troverebbe mai. Le tre miniature sovrapposte dicono cosa
               c'è dentro senza una parola — un'icona da sola non lo direbbe.
              ⚠️ E il numero è dentro il tasto: «le mie foto» non dice se ce ne
               sono due o venti, e la differenza cambia se lo si preme. */}
        {anteprime.length > 0 && passo !== "codice" && (
          <button
            onClick={() => setAlbum(true)}
            className="hg-vetro hg-lucido group mb-5 flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-white/25"
          >
            <span className="flex -space-x-3">
              {anteprime.slice(0, 3).map((a, i) => (
                <img
                  key={`${a.immagine.slice(-16)}-${i}`}
                  src={a.immagine}
                  alt=""
                  className="h-10 w-10 rounded-xl border-2 border-[#0b1224] object-cover transition-transform duration-300 group-hover:translate-x-0"
                  style={{ zIndex: 3 - i }}
                />
              ))}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">Le tue foto</span>
              <span className="block text-[12px] text-white/45">
                {anteprime.length} {anteprime.length === 1 ? "prova fatta" : "prove fatte"} — toccale per rivederle
              </span>
            </span>
            <Images className="h-4 w-4 shrink-0 text-white/35 transition-transform duration-300 group-hover:scale-110 group-hover:text-blue-200" />
          </button>
        )}

        {album && (
          <div
            className="fixed inset-0 z-[125] flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm"
            onClick={() => { setAlbum(false); setInRisalto(""); }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="hg-vetro-forte w-full max-w-2xl rounded-3xl p-5"
            >
              <div className="mb-4 flex items-center gap-2">
                <Images className="h-4 w-4 text-blue-300" />
                <p className="min-w-0 flex-1 font-semibold">
                  {scegliendo
                    ? scelte.length ? `${scelte.length} ${scelte.length === 1 ? "scelta" : "scelte"}` : "Tocca quelle da buttare"
                    : "Le tue foto"}
                </p>
                {/* ── ⚠️ «SCEGLI» INVECE DI UNA ✕ SU OGNI RIQUADRO ────────
                      Una crocetta su ognuna, dentro una griglia che si scorre
                      col dito, si preme per sbaglio — e quello che si cancella
                      per sbaglio qui è la fotografia di una persona. In
                      modalità scelta invece il primo tocco spunta e basta, e
                      il gesto che cancella è uno solo, dichiarato, in fondo. */}
                {anteprime.length > 0 && !inRisalto && (
                  <button
                    onClick={() => { setScegliendo((v) => !v); setScelte([]); }}
                    className={`rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold transition ${
                      scegliendo
                        ? "text-white/70 hover:bg-white/10"
                        : "text-blue-300 hover:bg-blue-500/10"
                    }`}
                  >
                    {scegliendo ? "Annulla" : "Scegli"}
                  </button>
                )}
                <button
                  onClick={() => { setAlbum(false); setScegliendo(false); setScelte([]); }}
                  className="rounded-lg p-1.5 text-white/50 transition hover:bg-white/10"
                  aria-label="Chiudi"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* ── LA BARRA DELLA SCELTA ────────────────────────────────── */}
              {scegliendo && !inRisalto && (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setScelte(
                      scelte.length === anteprime.length ? [] : anteprime.map((a) => a.immagine),
                    )}
                    className="rounded-xl border border-white/12 px-3.5 py-2 text-[13px] font-medium text-white/70 transition hover:border-white/30 hover:text-white"
                  >
                    {scelte.length === anteprime.length ? "Nessuna" : "Tutte"}
                  </button>
                  <button
                    disabled={!scelte.length}
                    onClick={() => setConfermaElimina(scelte)}
                    className="flex items-center gap-1.5 rounded-xl bg-red-500/90 px-3.5 py-2 text-[13px] font-semibold text-white transition hover:bg-red-500 disabled:opacity-35"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Elimina{scelte.length ? ` (${scelte.length})` : ""}
                  </button>
                </div>
              )}

              {/* ── LA CONFERMA ──────────────────────────────────────────────
                    ⚠️ Si chiede, e si dice il numero. Cancellare non si
                     disfa, e la differenza fra una prova e dodici la persona
                     la deve vedere PRIMA, non dopo. */}
              {!!confermaElimina && (
                <div className="mb-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-3.5">
                  <p className="text-[13.5px] font-semibold">
                    {confermaElimina.length === 1
                      ? "Butto via questa prova?"
                      : `Butto via ${confermaElimina.length} prove?`}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-white/55">Non si torna indietro.</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      disabled={elimino}
                      onClick={() => void eliminaProve(confermaElimina)}
                      className="flex items-center gap-1.5 rounded-xl bg-red-500 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-red-400 disabled:opacity-50"
                    >
                      {elimino ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      {elimino ? "Sto cancellando…" : "Sì, elimina"}
                    </button>
                    <button
                      disabled={elimino}
                      onClick={() => setConfermaElimina(null)}
                      className="rounded-xl border border-white/12 px-4 py-2 text-[13px] font-semibold text-white/70 transition hover:border-white/30 hover:text-white"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              )}
              {/* ── ⚠️ IL CLIC INGRANDISCE, NON CHIUDE ────────────────────
                    Prima toccare una foto chiudeva l'album e la portava nella
                    pagina: si perdevano di vista tutte le altre proprio nel
                    momento in cui si stava confrontando. Adesso quella toccata
                    va grande lì dentro, con le altre in fila sotto — e da lì si
                    decide se tenerla o guardarne un'altra. */}
              {inRisalto ? (
                <div>
                  <img
                    src={inRisalto}
                    alt=""
                    className="mx-auto max-h-[60vh] w-auto rounded-2xl border border-white/10"
                  />
                  <p className="mt-2 text-center text-sm font-semibold">
                    {anteprime.find((a) => a.immagine === inRisalto)?.nome}
                  </p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                    <button
                      onClick={() => { setEsito(inRisalto); setPasso("risultato"); setAlbum(false); setInRisalto(""); }}
                      className="hg-shine rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-400"
                    >
                      Guardala grande
                    </button>
                    <button
                      onClick={() => setInRisalto("")}
                      className="rounded-xl border border-white/12 px-5 py-2.5 text-sm font-semibold text-white/70 transition hover:border-white/25 hover:text-white"
                    >
                      Torna a tutte
                    </button>
                    {/*  ⚠️ Una sola si butta da QUI, dove la si sta guardando
                        grande: è l'unico punto in cui si è sicuri di quale
                        fotografia si sta cancellando. */}
                    <button
                      onClick={() => setConfermaElimina([inRisalto])}
                      className="flex items-center gap-1.5 rounded-xl border border-red-400/30 px-5 py-2.5 text-sm font-semibold text-red-200 transition hover:border-red-400/60 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Elimina
                    </button>
                  </div>
                  {/*  Le altre restano sotto, piccole: è quello che permette di
                      saltare da una all'altra senza tornare indietro ogni
                      volta. */}
                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                    {anteprime.map((a, i) => (
                      <button
                        key={`${a.immagine.slice(-16)}-${i}`}
                        onClick={() => setInRisalto(a.immagine)}
                        className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border transition ${
                          inRisalto === a.immagine
                            ? "border-blue-400 ring-2 ring-blue-400/40"
                            : "border-white/12 hover:border-white/30"
                        }`}
                      >
                        <img src={a.immagine} alt={a.nome} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {anteprime.map((a, i) => {
                    const presa = scelte.includes(a.immagine);
                    return (
                      <button
                        key={`${a.immagine.slice(-16)}-${i}`}
                        onClick={() => (scegliendo
                          ? setScelte((v) => (presa
                            ? v.filter((x) => x !== a.immagine)
                            : [...v, a.immagine]))
                          : setInRisalto(a.immagine))}
                        className={`hg-lucido relative overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 ${
                          presa ? "border-blue-400 ring-2 ring-blue-400/40" : "border-white/10 hover:border-white/30"
                        }`}
                      >
                        <img
                          src={a.immagine}
                          alt={a.nome}
                          loading="lazy"
                          className={`aspect-square w-full object-cover transition ${presa ? "opacity-70" : ""}`}
                        />
                        {scegliendo && (
                          <span className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border transition ${
                            presa ? "border-blue-300 bg-blue-500" : "border-white/50 bg-black/40"
                          }`}>
                            {presa && <Check className="h-3.5 w-3.5 text-white" />}
                          </span>
                        )}
                        <span className="block truncate px-2.5 py-2 text-[12px] font-medium">{a.nome}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ COS'È QUESTA ANTEPRIMA, E COSA NON È ════════════════════════
              ⚠️ Va detto PRIMA, non dopo. Chi guarda un'anteprima crede di
               vedere il risultato: se scopre solo alla consegna che il taglio
               vero lo decide un professionista con lui davanti, quella
               scoperta la vive come una promessa non mantenuta — anche quando
               il risultato è più bello. Detto prima, invece, è esattamente il
               contrario: diventa il motivo per venire. */}
        {avvisoIniziale && (
          <div className="fixed inset-0 z-[115] flex items-end justify-center overflow-y-auto bg-black/85 p-3 backdrop-blur-sm sm:items-center sm:p-6">
            <div
              className="hg-bordo-vivo w-full max-w-lg rounded-3xl p-5 sm:p-6"
              style={{ ["--hg-fondo" as string]: "#0b1224" }}
            >
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/15">
                <Sparkles className="h-5 w-5 text-blue-300" />
              </span>
              <h2 className="mt-4 text-center text-lg font-semibold leading-tight">
                Questa è un&apos;anteprima. Dal vivo viene meglio.
              </h2>
              <div className="mt-4 space-y-2.5 text-[13px] leading-relaxed text-white/60">
                <p>
                  Serve a farti vedere <span className="font-semibold text-white/85">come ti sta</span> un
                  taglio prima di sceglierlo. Il risultato vero, dopo l&apos;installazione, è più
                  bello e più naturale di quello che vedi qui.
                </p>
                <p>
                  Il taglio lo fa un <span className="font-semibold text-white/85">parrucchiere
                  professionista</span>, e si decide insieme sul momento guardando il tuo viso: quello
                  che scegli qui è il punto di partenza, non un contratto.
                </p>
                <p>
                  Anche il <span className="font-semibold text-white/85">colore</span> si sceglie
                  insieme. Se hai richieste particolari ce le dici; altrimenti lo determiniamo noi
                  sui tuoi capelli laterali, così si confonde con i tuoi.
                </p>
              </div>
              <button
                onClick={() => setAvvisoIniziale(false)}
                className="hg-shine mt-5 w-full rounded-xl bg-blue-500 py-3.5 font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-400"
              >
                Ho capito, cominciamo
              </button>
            </div>
          </div>
        )}



        {fotocamera && (
          <Fotocamera
            onChiudi={() => setFotocamera(false)}
            onScattata={(dataUrl) => {
              setFotocamera(false);
              setFoto(dataUrl);
              setEsito("");
              setPasso("taglio");
            }}
          />
        )}

        {/* ══ IL TAGLIO APPENA CREATO, DA GUARDARE ════════════════════════
              ⚠️ Copre tutto il resto apposta: è una decisione da prendere
               adesso, e lasciarla in un angolo della pagina vuol dire trovarsi
               fra un mese venti tagli in bozza che nessuno ha mai guardato. */}
        {!!appenaFatto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm">
            <div
              className="hg-bordo-vivo w-full max-w-sm rounded-2xl p-4"
              style={{ ["--hg-fondo" as string]: "#0b1224" }}
            >
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-300">
                come è venuto
              </p>
              <img
                src={appenaFatto.immagine}
                alt={appenaFatto.nome}
                className="mt-3 w-full rounded-xl border border-white/10"
              />
              <p className="mt-3 text-center text-lg font-semibold">{appenaFatto.nome}</p>
              <p className="mt-1 text-center text-sm text-white/45">{appenaFatto.descrizione}</p>
              <div className="mt-4 flex gap-2.5">
                {/*  ⚠️ «Buttalo» a sinistra e più smorto, «tienilo» a destra e
                    acceso: il gesto che costa denaro (rifare) deve essere il
                    più difficile da premere per sbaglio. */}
                <button
                  onClick={() => void decidi("togli")}
                  className="flex-1 rounded-xl border border-white/12 px-4 py-3 text-sm font-semibold text-white/60 transition hover:border-rose-400/40 hover:text-rose-200"
                >
                  Buttalo
                </button>
                <button
                  onClick={() => void decidi("conferma")}
                  className="hg-shine flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400"
                >
                  <Check className="h-4 w-4" /> Mettilo in vetrina
                </button>
              </div>
              <p className="mt-3 text-center text-[11px] text-white/30">
                Finché non lo metti in vetrina lo vedi solo tu.
              </p>
            </div>
          </div>
        )}

        {/* ══ 0. IL CODICE ════════════════════════════════════════════════ */}
        {passo === "codice" && (
          <div className="mx-auto max-w-md">
            {/*  ⚠️ Il riquadro del codice è l'UNICA cosa a schermo: qualunque
                altra cosa qui è una distrazione davanti a una porta chiusa. */}
            <div className="hg-bordo-vivo rounded-2xl p-6 text-center" style={{ ["--hg-fondo" as string]: "#0b1224" }}>
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
                <Sparkles className="h-5 w-5 text-blue-300" />
              </span>
              <h2 className="mt-4 text-lg font-semibold">Inserisci il tuo codice</h2>
              <p className="mt-2 text-sm text-white/55">
                È il codice che ti abbiamo mandato su WhatsApp. Dentro ci sono{" "}
                <span className="font-semibold text-white/80">{PROVE_COMPRESE} prove comprese</span>.
              </p>
              <input
                value={scritto}
                onChange={(e) => setScritto(leggibile(e.target.value))}
                onKeyDown={(e) => { if (e.key === "Enter") void controllaCodice(scritto); }}
                //  ⚠️ Tastiera testuale e maiuscole automatiche spente: il
                //   correttore del telefono trasforma i codici in parole.
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                placeholder="ABCD-1234"
                className="mt-5 w-full rounded-xl border border-white/15 bg-white/[0.06] px-4 py-3.5 text-center font-mono text-lg tracking-[0.2em] outline-none placeholder:text-white/25 focus:border-blue-400"
              />
              <button
                onClick={() => void controllaCodice(scritto)}
                disabled={controllo || !scritto.trim()}
                className="hg-shine mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 py-3.5 font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-400 disabled:opacity-40"
              >
                {controllo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Entra
              </button>
              {!!errore && (
                <p className="mt-3 rounded-xl bg-rose-500/15 px-3 py-2.5 text-sm text-rose-200">{errore}</p>
              )}
              <p className="mt-4 text-[12px] text-white/35">
                Non ce l'hai? Scrivici su WhatsApp e te lo mandiamo subito.
              </p>
            </div>
          </div>
        )}

        {/* ══ 5. LE PROVE SONO FINITE ═════════════════════════════════════ */}
        {passo === "compra" && (
          <div className="mx-auto max-w-2xl">
            <div className="text-center">
              <h2 className="text-xl font-semibold sm:text-2xl">Hai finito le prove comprese</h2>
              {/*  ⚠️ Si dice cosa si è già ottenuto prima di chiedere soldi:
                  «hai finito» da solo è una porta in faccia, «hai visto come
                  stai» è il motivo per continuare. */}
              <p className="mx-auto mt-2 max-w-lg text-sm text-white/55">
                Hai visto come stai con {PROVE_COMPRESE} tagli. Se vuoi provarne altri — e vedere
                anche i colori sul tuo viso — aggiungi prove al tuo codice: restano lì, senza
                scadenza.
              </p>
            </div>

            {/* ── ⚠️ COSA SI COMPRA, PRIMA DI QUANTO COSTA ──────────────────
                  Un listino senza vantaggi vende solo a chi aveva già deciso.
                  Le tre righe qui sotto sono le tre cose che cambiano davvero
                  quando si paga, e la prima è quella che si vede a occhio:
                  l'immagine senza filigrana, da mandare a chi si vuole. */}
            <ul className="mx-auto mt-6 grid max-w-lg gap-2 text-left sm:grid-cols-3">
              {[
                ["Foto senza filigrana", "Pulite, da mandare a chi vuoi"],
                ["Tutti i tagli e i colori", "Anche le sfumature e i lunghi"],
                ["Restano sul tuo codice", "Senza scadenza, quando vuoi"],
              ].map(([titolo, sotto]) => (
                <li key={titolo} className="flex items-start gap-2 hg-vetro rounded-xl px-3 py-2.5">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold leading-tight">{titolo}</span>
                    <span className="block text-[12px] leading-snug text-white/45">{sotto}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {PACCHETTI.map((p) => {
                const scelto = pacchetto === p.chiave;
                const sconto = risparmio(p);
                return (
                  <button
                    key={p.chiave}
                    onClick={() => setPacchetto(p.chiave)}
                    className={`relative rounded-2xl border p-4 text-left transition ${
                      scelto ? "border-blue-400 bg-blue-500/10" : "border-white/10 bg-white/[0.03] hover:border-white/25"
                    }`}
                  >
                    {p.consigliato && (
                      <span className="hg-shine absolute -top-2.5 left-4 rounded-full bg-blue-500 px-2.5 py-0.5 text-[11px] font-semibold text-white">
                        il più scelto
                      </span>
                    )}
                    <p className="text-[13px] font-semibold text-white/70">{p.nome}</p>
                    <p className="mt-1 text-2xl font-semibold tabular-nums">{inEuro(p.centesimi)}</p>
                    <p className="mt-0.5 text-[12px] text-white/45">{alPezzo(p)}</p>
                    {sconto > 0 && (
                      <p className="mt-1 inline-block rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                        risparmi il {sconto}%
                      </p>
                    )}
                    <p className="mt-2 text-[12px] leading-snug text-white/50">{p.gancio}</p>
                  </button>
                );
              })}
            </div>

            {/*  ⚠️ I quattro campi sono precompilati quando il codice è già
                collegato a una persona: un modulo già pieno si conferma, uno
                vuoto si abbandona. */}
            <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
              <input value={suoNome.nome} onChange={(e) => setSuoNome({ ...suoNome, nome: e.target.value })}
                placeholder="Nome" autoComplete="given-name"
                className="rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-3 text-sm outline-none placeholder:text-white/30 focus:border-blue-400" />
              <input value={suoNome.cognome} onChange={(e) => setSuoNome({ ...suoNome, cognome: e.target.value })}
                placeholder="Cognome" autoComplete="family-name"
                className="rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-3 text-sm outline-none placeholder:text-white/30 focus:border-blue-400" />
              <input value={suoNome.email} onChange={(e) => setSuoNome({ ...suoNome, email: e.target.value })}
                placeholder="Email" type="email" autoComplete="email" inputMode="email"
                className="rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-3 text-sm outline-none placeholder:text-white/30 focus:border-blue-400" />
              <input value={suoNome.telefono} onChange={(e) => setSuoNome({ ...suoNome, telefono: e.target.value })}
                placeholder="Numero di telefono" type="tel" autoComplete="tel" inputMode="tel"
                className="rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-3 text-sm outline-none placeholder:text-white/30 focus:border-blue-400" />
            </div>

            <button
              onClick={() => void compra()}
              disabled={pago}
              className="hg-shine mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 py-4 font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-400 disabled:opacity-40"
            >
              {pago ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Aggiungi le prove — {inEuro(PACCHETTI.find((p) => p.chiave === pacchetto)?.centesimi ?? 0)}
            </button>
            {!!errore && <p className="mt-3 rounded-xl bg-rose-500/15 px-3 py-2.5 text-sm text-rose-200">{errore}</p>}
            <p className="mt-3 text-center text-[12px] text-white/35">
              Pagamento sicuro con carta. Le prove restano sul tuo codice, senza scadenza.
            </p>
          </div>
        )}

        {pronto === false && (
          <p className="mb-5 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Il servizio non è configurato: {errore || "manca la chiave sul server."}</span>
          </p>
        )}

        {/* ══ 1. LA FOTO ══════════════════════════════════════════════════ */}
        {passo === "foto" && (
          <div className="hg-vetro hg-lucido rounded-3xl p-5 sm:p-7">
            <p className="text-lg font-semibold">La tua foto</p>
            <p className="mt-1.5 text-sm text-white/50">
              Serve un viso di fronte, in primo piano. Ti guido io mentre la fai.
            </p>

            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void prendiFoto(e.target.files?.[0])}
            />

            {/* ── ⚠️ DUE STRADE, E SI CAPISCE QUAL È QUALE ────────────────────
                  «Scatta o scegli una foto» le mescolava in un tasto solo: chi
                  lo premeva non sapeva cosa sarebbe successo, e sul computer
                  si apriva il disco quando voleva la fotocamera. Adesso una
                  cosa per tasto, e quello grosso è quello che serve — perché
                  la foto migliore è quella fatta adesso, guidata. */}
            <div className="mt-5 space-y-2.5">
              <button
                onClick={() => setFotocamera(true)}
                className="hg-shine hg-alone group flex w-full items-center gap-3.5 rounded-2xl bg-blue-500 px-5 py-4 text-left font-semibold text-white transition hover:bg-blue-400"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Camera className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-base">Scatta la foto adesso</span>
                  <span className="block text-[13px] font-normal text-white/70">
                    Ti mostro dove mettere il viso, passo per passo
                  </span>
                </span>
              </button>

              <button
                onClick={() => input.current?.click()}
                className="flex w-full items-center gap-3.5 rounded-2xl border border-white/12 bg-white/[0.03] px-5 py-4 text-left font-semibold text-white/85 transition hover:border-white/25 hover:bg-white/[0.07]"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/12">
                  <Upload className="h-5 w-5 text-white/60" />
                </span>
                <span className="min-w-0">
                  <span className="block text-base">Scegli dalla galleria</span>
                  <span className="block text-[13px] font-normal text-white/45">
                    Una che hai già, con il viso di fronte
                  </span>
                </span>
              </button>
            </div>

            {/*  ⚠️ LA CASELLA «SONO CALVO» NON C'È PIÙ, e non è una
                semplificazione: questa pagina la aprono i clienti di un centro
                tricologico. Chiedere «sei calvo?» a chi è arrivato qui proprio
                per quello è una domanda che fa male e a cui la risposta la
                sappiamo già. Si dà per scontato — vedi `calvo: true` — e i
                capelli si costruiscono sempre dalla pelle, che sulle teste con
                i capelli funziona lo stesso. */}
            <p className="mt-4 text-xs text-white/30">
              La foto non viene salvata: serve solo per creare l&apos;anteprima e resta su questo
              dispositivo.
            </p>
            {!!errore && (
              <p className="mt-3 rounded-xl bg-rose-500/15 px-4 py-2.5 text-sm text-rose-200">{errore}</p>
            )}
          </div>
        )}

        {/* ── ⚠️ CHI VENDE NON DEVE CARICARE LA PROPRIA FACCIA ─────────────
              Il riquadro per aggiungere un taglio stava dentro il passo del
              TAGLIO, cioè dopo aver caricato una foto personale e sotto
              trentacinque riquadri: per curare la vetrina bisognava fingere di
              essere un cliente. Adesso sta qui, sul primo schermo, e si vede
              appena si entra con un codice admin. */}
            {/* ── ⚠️ AGGIUNGERE UN TAGLIO ALLA VETRINA ───────────────────────
              Si vede solo con un codice admin: agli altri non compare
              proprio. Un tasto che si preme e risponde «non puoi» è
              peggio di un tasto che non c'è.
             ⚠️ E dice PRIMA che ci vuole un minuto: sono due generazioni
              vere una dopo l'altra, e un minuto senza sapere che sarà un
              minuto è un minuto in cui si ricarica la pagina — e si paga
              due volte. */}
        {admin && passo === "foto" && (
          <div className="mb-5">
            {/*  ⚠️ Stesso stampo degli altri due riquadri che chiedono una
                foto: chi amministra impara un gesto solo e lo ritrova uguale
                nei tre punti in cui serve. Cambia l'icona, non la forma. */}
            <input
              ref={inputNuovo}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void aggiungiTaglio(e.target.files?.[0])}
            />
            <RiquadroCarica
              icona={Plus}
              titolo={aggiungo ? "Sto creando il taglio…" : "Aggiungi un taglio al catalogo"}
              sotto={aggiungo
                ? "Leggo la foto, gli do un nome e lo riproduco sul nostro modello. Un minuto."
                : "Carica una foto: gli do un nome da solo e te lo faccio vedere prima della vetrina."}
              occupato={aggiungo}
              onClick={() => inputNuovo.current?.click()}
            />
          </div>
        )}


        {/* ══ 2. IL TAGLIO ════════════════════════════════════════════════ */}
        {passo === "taglio" && (
          <div>
            <Intestazione
              titolo="Scegli il taglio"
              sotto="Il colore lo scegli dopo — o lo prendo dalla tua barba."
              anteprima={foto}
              indietro="Foto"
              onIndietro={() => setPasso("foto")}
            />

            {/* ── ⚠️ SI GUARDA, NON SI LEGGE ─────────────────────────────
                  «Medio mosso» vuol dire una cosa diversa per ognuno, e una
                  sagoma disegnata dice la forma ma non dice come VIENE.
                  Queste sono fotografie: la stessa persona, la stessa luce, lo
                  stesso colore, otto tagli. Cambia una cosa sola da un riquadro
                  all'altro — ed è quella che si sta scegliendo.
                 ⚠️ Le facce non esistono: sono generate una volta sola (vedi
                  prove/genera-esempi.mjs) e servite come file. Una foto vera
                  presa da internet sarebbe la testa di qualcuno, dentro il sito
                  di un centro tricologico, accanto a «guardati così».
                 ⚠️ E se un file manca, al suo posto torna il disegno invece di
                  un riquadro rotto: succede finché non sono state generate
                  tutte, ed è meglio di un buco. */}
            {/* ── ⚠️ «PORTAMI LA TUA FOTO» STA PRIMA DELLA VETRINA ───────────
                  È la richiesta più naturale davanti a una prova capelli —
                  «voglio questo qui» — e stava in fondo, sotto trentacinque
                  riquadri: chi ci arrivava l'aveva già scartata per stanchezza.
                  Le due strade sono pari, e questa si vede per prima perché è
                  quella che nessuno si aspetta. */}
            <input
              ref={inputTaglio}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void prendiFotoTaglio(e.target.files?.[0])}
            />
            <div className="mb-5">
              <RiquadroCarica
                icona={Scissors}
                titolo={fotoTaglio ? "Il taglio della tua foto" : "Hai una foto del taglio che vuoi?"}
                sotto={fotoTaglio
                  ? "Tocca per cambiarla. Si copia la forma, non il colore e non il viso."
                  : "Caricala e la riproduco su di te. Il colore lo scegli dopo."}
                anteprima={fotoTaglio}
                attivo={!!fotoTaglio}
                onClick={() => inputTaglio.current?.click()}
                //  ⚠️ Si azzera anche il campo del file: senza, ricaricando la
                //   STESSA fotografia il browser non scatta nessun evento —
                //   il valore non è cambiato — e sembrerebbe che il tasto non
                //   funzioni.
                onRimuovi={() => {
                  setFotoTaglio("");
                  if (inputTaglio.current) inputTaglio.current.value = "";
                }}
              />
            </div>

            {/* ── ⚠️ IL TAGLIO SU MISURA, E SI VEDE CHE È UN'ALTRA COSA ─────
                  In una griglia di trentacinque fotografie di teste vere, un
                  riquadro «creane uno tu» disegnato come gli altri si legge
                  come il trentaseiesimo taglio. Qui l'avatar — sfera, luce,
                  cursori accanto — dice prima delle parole che lì dentro si
                  COSTRUISCE invece di scegliere. Sta sopra la griglia perché è
                  la strada che nessuno si aspetta, e sotto trentacinque
                  riquadri l'avrebbero già scartata per stanchezza. */}
            <button
              onClick={() => {
                setBozza(suMisura || { laterali: LATERALI_COME_IL_TAGLIO });
                setComponi(true);
              }}
              className={`group mb-5 flex w-full items-center gap-4 rounded-2xl p-3.5 text-left transition ${
                suMisura
                  ? "hg-bordo-vivo hg-alone"
                  : "hg-vetro hg-lucido hover:-translate-y-0.5 hover:border-white/25"
              }`}
              style={suMisura ? ({ ["--hg-fondo" as string]: "#0b1224" }) : undefined}
            >
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 via-blue-500/15 to-cyan-400/20 ring-1 ring-white/10">
                <AvatarSuMisura className="h-full w-full p-1" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-[15.5px] font-semibold">
                    {suMisura ? "Il tuo taglio su misura" : "Creane uno tu"}
                  </span>
                  <span className="rounded-full border border-violet-300/40 bg-violet-400/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-violet-100">
                    su misura
                  </span>
                </span>
                <span className="mt-1 block text-[13px] leading-snug text-white/50">
                  {suMisura
                    ? nomeComposto(suMisura)
                    : "Lunghezza, capello, ciuffo, direzione e laterali: lo componi tu."}
                </span>
              </span>
              {suMisura
                ? <Check className="h-5 w-5 shrink-0 text-blue-300" />
                : <Plus className="h-5 w-5 shrink-0 text-white/35 transition group-hover:text-white/70" />}
            </button>

            {/* ── ⚠️ VENTITRÉ RIQUADRI VOGLIONO DELLE FAMIGLIE ──────────────
                  Tutti in fila sarebbero un muro: chi cerca «qualcosa di
                  mosso» dovrebbe guardarli uno per uno fino a trovarlo. I
                  gruppi sono le parole con cui la gente li chiede davvero —
                  corto, sfumato, mosso, riccio, lungo — e la riga sotto al
                  titolo dice a chi sta bene quella famiglia, che è la domanda
                  vera dietro alla scelta. */}
            <div className="space-y-6">
              {FAMIGLIE.map((f) => (
                //  ⚠️ UN'ANCORA PER FAMIGLIA. Lo scorrimento fra due schermi
                //   diversi non si trasferisce in pixel — la stessa vetrina è
                //   alta 900px sul portatile e 2500 sul telefono — ma dicendo
                //   QUALE blocco sta in cima. Senza queste, le due schermate
                //   si allineano a occhio e derivano di centinaia di pixel.
                <div key={f.chiave} data-hg-anchor={`famiglia-${f.chiave}`}>
                  <div className="mb-3 flex items-center gap-3">
                    <h3 className="shrink-0 text-[13px] font-semibold uppercase tracking-[0.14em] text-white/70">
                      {f.nome}
                    </h3>
                    {/*  Il filetto che sfuma: separa senza tagliare la pagina
                        in fette, che è quello che fa una riga piena. */}
                    <span className="h-px flex-1 bg-gradient-to-r from-white/20 to-transparent" />
                    <p className="hidden shrink-0 text-[12px] text-white/35 sm:block">{f.nota}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {catalogo.filter((x) => x.famiglia === f.chiave).map((t) => (
                      <button
                        key={t.chiave}
                        onClick={() => {
                          setTaglio(t.chiave);
                          setFotoTaglio("");
                          setSuMisura(null);
                          setLaterali(LATERALI_COME_IL_TAGLIO);
                          setPelle(false);
                          /** ── ⚠️ SI RIAPRE A OGNI TAGLIO, E I RITOCCHI SI
                           *   AZZERANO ────────────────────────────────────
                           *  Prima si chiedeva una volta per sessione, e per
                           *  la sola barba aveva senso. Adesso lì dentro ci
                           *  sono i ritocchi, che appartengono a QUESTO
                           *  taglio: tenendoli, scegliendone un altro
                           *  resterebbero spuntati senza che nessuno li veda
                           *  — e per giunta potrebbero non valere più per la
                           *  sua famiglia (la riga di lato su un rasato).
                           *  La barba invece resta come l'hai scelta: quella
                           *  è una preferenza tua, non del taglio. */
                          setRitocchi([]);
                          setNota("");
                          setNotaAperta(false);
                          setChiedoBarba(t.chiave);
                        }}
                        title={t.descrizione}
                        className={`group relative overflow-hidden rounded-2xl text-left transition ${
                          taglio === t.chiave
                            ? "hg-bordo-vivo hg-alone"
                            : "hg-vetro hg-lucido hover:-translate-y-0.5 hover:border-white/25"
                        }`}
                        style={taglio === t.chiave ? ({ ["--hg-fondo" as string]: "#0b1224" }) : undefined}
                      >
                        <span className="relative block aspect-square bg-white/[0.04]">
                          <DisegnoTaglio
                            taglio={t.chiave}
                            className="absolute inset-0 h-full w-full p-4 text-white/25"
                          />
                          <img
                            src={t.immagine || `/tagli/${t.chiave}.jpg`}
                            alt={t.nome}
                            //  ⚠️ `lazy` + misure dichiarate: senza width e
                            //   height il browser non sa quanto spazio tenere e
                            //   ricalcola tutta la griglia a ogni fotografia
                            //   che arriva — trentacinque scatti di layout, che
                            //   è metà della lentezza che si vedeva.
                            loading="lazy"
                            decoding="async"
                            width={380}
                            height={380}
                            className="absolute inset-0 h-full w-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = "none"; }}
                          />
                          {/*  ⚠️ La spunta dice «questo» meglio di qualunque
                              bordo: su un telefono, in una griglia di trenta
                              riquadri, il bordo scelto si confonde col riflesso
                              della fotografia sotto. */}
                          {taglio === t.chiave && (
                            <span className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 shadow-lg shadow-blue-500/40">
                              <Check className="h-3.5 w-3.5 text-white" />
                            </span>
                          )}
                          {/*  La sfumatura sotto: senza, il nome bianco finisce
                              su una maglietta chiara e non si legge più. */}
                          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-2 pt-6">
                            <span className="block text-center text-sm font-semibold leading-tight text-white">
                              {t.nome}
                            </span>
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {/* ══ 3. IL COLORE ════════════════════════════════════════════════ */}
        {passo === "colore" && (
          <div>
            <Intestazione
              titolo="Il colore"
              sotto="Se non scegli, prendo lo stesso colore della tua barba."
              indietro="Taglio"
              onIndietro={() => setPasso("taglio")}
            />

            {/*  ⚠️ Il taglio scelto si vede ANCHE QUI, tinto del colore che si
                sta guardando: le due scelte vanno insieme, e vederle una alla
                volta obbliga a tornare indietro per capire come stanno. */}
            {(!!taglio || !!fotoTaglio || !!suMisura) && (
              <div
                className="hg-bordo-vivo mb-5 flex items-center gap-3.5 rounded-2xl p-3"
                style={{ ["--hg-fondo" as string]: "#0b1224" }}
              >
                {/*  ⚠️ Un taglio composto non ha una fotografia: al suo posto
                    l'avatar, che è lo stesso segno del riquadro da cui è
                    uscito — e non un riquadro rotto. */}
                {suMisura ? (
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/25 via-blue-500/15 to-cyan-400/20 ring-1 ring-white/10">
                    <AvatarSuMisura className="h-full w-full p-0.5" />
                  </span>
                ) : (
                  <img
                    src={fotoTaglio || catalogo.find((x) => x.chiave === taglio)?.immagine || `/tagli/${taglio}.jpg`}
                    alt=""
                    className="h-16 w-16 shrink-0 rounded-xl border border-white/10 object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {suMisura
                      ? nomeComposto(suMisura)
                      : fotoTaglio ? "Il taglio della tua foto" : catalogo.find((x) => x.chiave === taglio)?.nome}
                  </p>
                  <p className="flex items-center gap-2 text-sm text-white/50">
                    {colore === COLORE_DA_FOTO ? (
                      "Colore preso dalla tua foto"
                    ) : (
                      <>
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-white/25"
                          style={{ background: COLORI.find((c) => c.chiave === colore)?.campione || "transparent" }}
                        />
                        {COLORI.find((c) => c.chiave === colore)?.nome}
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/*  ⚠️ La spunta c'è anche qui, perché la domanda si fa una volta
                sola e chi cambia idea deve poterlo fare senza tornare
                indietro a rifare la scelta del taglio. */}
            <label className="mb-4 flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-3">
              <input
                type="checkbox"
                checked={barba}
                onChange={(e) => setBarba(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-blue-500"
              />
              <span className="text-sm">
                <span className="block font-medium">Prova anche la barba</span>
                <span className="mt-0.5 block text-[12px] text-white/40">
                  Spenta: la tua barba resta com&apos;è e cambiano solo i capelli.
                </span>
              </span>
            </label>

            {/* ── ⚠️ ANCHE QUI LA FOTO VIENE PRIMA DELL'ELENCO ───────────────
                  Chi è calvo da dieci anni non sa più dire di che colore li
                  aveva, ma una foto di allora ce l'ha. Dopo diciannove
                  campioni non ci arriva più; prima, è la strada più facile
                  che esista. */}
            <input
              ref={inputColore}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void prendiFotoColore(e.target.files?.[0])}
            />
            {/* ── ⚠️ IL RIQUADRO NON PUÒ DIRE UNA COSA E FARNE UN'ALTRA ──────
                  DIFETTO VISTO, E COSTATO UNA GENERAZIONE SBAGLIATA: caricata
                  la foto del colore e poi toccata una pastiglia qui sotto, la
                  scelta passava alla pastiglia — ma questo riquadro continuava
                  a dire «Colore preso da questa foto», con la sua miniatura e
                  la spunta verde. Due cose sembravano scelte insieme, e quella
                  che comandava era l'altra.
                  Adesso la foto resta caricata (si può riprendere con un
                  tocco) ma il titolo dice la verità su chi comanda adesso. */}
            <div className="mb-4">
              <RiquadroCarica
                icona={Palette}
                titolo={
                  colore === COLORE_DA_FOTO
                    ? "Colore preso da questa foto"
                    : fotoColore
                      ? "Foto caricata — tocca per usare il suo colore"
                      : "Hai una foto col colore che vuoi?"
                }
                sotto={
                  colore === COLORE_DA_FOTO
                    ? "Si prende solo il colore, nient'altro. Tocca per cambiare foto."
                    : fotoColore
                      ? "Adesso comanda il colore scelto qui sotto."
                      : "Una tua di quando avevi i capelli, o una che ti piace."
                }
                anteprima={fotoColore}
                attivo={colore === COLORE_DA_FOTO}
                //  ⚠️ Con una foto già caricata il tocco RIPRENDE quel colore
                //   invece di riaprire il selettore di file: dopo aver toccato
                //   una pastiglia per sbaglio, tornare indietro deve costare un
                //   tocco solo — non ricaricare la stessa fotografia.
                onClick={() => {
                  if (fotoColore && colore !== COLORE_DA_FOTO) { setColore(COLORE_DA_FOTO); return; }
                  inputColore.current?.click();
                }}
                //  ⚠️ Togliendola si torna al colore della barba, non al nulla:
                //   «da_foto» senza la foto è una richiesta che il servitore
                //   rifiuterebbe, e la persona si ritroverebbe bloccata su un
                //   passo che sembrava a posto.
                onRimuovi={() => {
                  setFotoColore("");
                  if (colore === COLORE_DA_FOTO) setColore("come_barba");
                  if (inputColore.current) inputColore.current.value = "";
                }}
              />
            </div>

            {/* ── ⚠️ UNA RIGA SOLA CHE DICE COSA USCIRÀ ──────────────────────
                  Fra un riquadro con la miniatura, diciannove pastiglie e due
                  cursori, «quale colore ho scelto» smetteva di essere ovvio.
                  Questa riga non aggiunge una scelta: ripete quella fatta, in
                  parole, dove si guarda prima di premere. */}
            <p className="mb-3 flex items-center gap-2 rounded-xl border border-blue-400/20 bg-blue-500/[0.07] px-3.5 py-2.5 text-[13px] text-white/75">
              <Check className="h-4 w-4 shrink-0 text-blue-300" />
              <span>
                Colore che verrà usato:{" "}
                <b className="font-semibold text-white">
                  {colore === COLORE_DA_FOTO
                    ? "quello della tua foto"
                    : colore === "come_barba"
                      ? "come la tua barba"
                      : COLORI.find((c) => c.chiave === colore)?.nome || ""}
                </b>
                {bianchi + grigi > 0 && `, con ${bianchi}% bianchi e ${grigi}% grigi`}
              </span>
            </p>

            {/* ── ⚠️ IL CAMPIONE, IL NOME E IL CODICE ────────────────────────
                  «Castano chiaro» e «castano dorato» sono due parole che non
                  si distinguono: il campione fa vedere la differenza e il
                  codice la fissa — è quello che si può ripetere al telefono e
                  ritrovare identico la volta dopo. */}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {COLORI.map((c) => (
                <button
                  key={c.chiave}
                  onClick={() => {
                    setColore(c.chiave);
                    //  ⚠️ I cursori seguono la tinta scelta: `1B30` è il nero
                    //   naturale col 30% di grigio, e lasciarli a zero
                    //   mostrerebbe un campione grigio accanto a due cursori
                    //   che dicono «nessun grigio». Chi vuole, li sposta.
                    setBianchi(0);
                    setGrigi(c.grigi ?? 0);
                  }}
                  className={`relative rounded-2xl border p-2.5 text-center transition ${
                    colore === c.chiave
                      ? "border-blue-400/70 bg-blue-500/10 hg-alone"
                      : "hg-vetro hg-lucido hover:-translate-y-0.5 hover:border-white/25"
                  }`}
                >
                  {colore === c.chiave && (
                    <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500">
                      <Check className="h-3 w-3 text-white" />
                    </span>
                  )}
                  {c.codice && campioni[c.codice] ? (
                    //  ⚠️ La fotografia si mostra GRANDE e quadrata: un colore
                    //   di capelli in un francobollo non si distingue da quello
                    //   accanto — ed è esattamente il motivo per cui l'anello
                    //   vero ha le ciocche lunghe un palmo.
                    <img
                      src={campioni[c.codice]}
                      alt={c.nome}
                      loading="lazy"
                      className="mx-auto aspect-square w-full rounded-xl object-cover"
                    />
                  ) : c.campione ? (
                    <CiocCa colore={c.campione} className="mx-auto h-11 w-11 drop-shadow-lg" />
                  ) : (
                    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/[0.06]">
                      <Sparkles className="h-4 w-4 text-white/60" />
                    </span>
                  )}
                  <span className="mt-1.5 block text-[12px] font-medium leading-tight">{c.nome}</span>
                  {/*  ⚠️ Sotto il campione va il CODICE DELL'ANELLO, non il
                      valore esadecimale: è quello che il consulente detta al
                      telefono e quello che finisce sull'ordine. Il numero
                      esadecimale non lo cerca nessuno. */}
                  <span className="mt-0.5 block font-mono text-[10px] uppercase text-white/30">
                    {c.codice || "dalla barba"}
                  </span>
                </button>
              ))}
            </div>

            {/* ── ⚠️ QUANTI BIANCHI, QUANTI GRIGI ────────────────────────────
                  Si chiede DOPO il colore e non prima: prima è una domanda
                  senza senso — «quanto grigio su cosa?» — e dopo è la
                  rifinitura naturale di una scelta appena fatta.
                  ⚠️ Due cursori e non uno: il bianco puro fa luce, il grigio
                   medio smorza, e una testa vera ne ha quantità diverse. Con
                   un numero solo esce sempre lo stesso brizzolato da
                   fotografia di repertorio.
                  ⚠️ Partono da zero, cioè «capelli pieni»: chi non ci pensa
                   ottiene quello che si aspetta senza dover decidere niente. */}
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[13px] font-semibold">Hai capelli bianchi o grigi?</p>
              <p className="mt-1 text-[12.5px] leading-snug text-white/45">
                Lascia a zero per capelli pieni del colore scelto. Sposta i cursori per rimettere
                la canizie che hai davvero: si mescola ciocca per ciocca, più fitta alle tempie.
              </p>

              {([
                ["Bianchi", bianchi, setBianchi, "#e9edf5"],
                ["Grigi", grigi, setGrigi, "#9aa4b5"],
              ] as const).map(([nome, valore, cambia, tinta]) => (
                <div key={nome} className="mt-3.5">
                  <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                    <span className="flex items-center gap-2 font-medium text-white/80">
                      <span className="h-3 w-3 rounded-full" style={{ background: tinta }} />
                      {nome}
                    </span>
                    <span className="font-mono tabular-nums text-white/60">{valore}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={valore}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      //  ⚠️ Insieme non possono superare il cento: il resto è
                      //   il colore scelto, e una somma oltre cento vorrebbe
                      //   dire chiedere al modello una cosa impossibile — che
                      //   lui risolve a modo suo, cioè male.
                      const altro = nome === "Bianchi" ? grigi : bianchi;
                      const messo = Math.min(v, 100 - altro);
                      cambia(messo);
                    }}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/12 accent-blue-500"
                  />
                </div>
              ))}

              {/* ── ⚠️ SU UNA BASE CHIARA IL GRIGIO QUASI NON SI VEDE ────────
                    DIFETTO SEGNALATO: biondo con il 30% di bianchi e il 30% di
                    grigi, ed è uscito un colore senza senso. Non era il
                    programma: è la fisica: su una testa bionda i capelli
                    bianchi non si distinguono, e chiedere il 60% di canizie
                    vuol dire chiedere una cosa che non esiste. Ora l'immagine
                    la si costruisce come tono più freddo (vedi righeCanizie) e
                    qui si dice perché — prima di premere, non dopo. */}
              {bianchi + grigi > 40 && chiarezzaDi(COLORI.find((c) => c.chiave === colore)?.campione || "") > BASE_CHIARA && (
                <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/25 bg-amber-500/10 px-3 py-2.5 text-[12px] leading-snug text-amber-100/80">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Su un colore così chiaro i capelli bianchi quasi non si distinguono: verrà una
                  chioma chiara e più fredda, non una testa grigia. Per vedere la canizie, scegli
                  una base più scura.
                </p>
              )}
              {bianchi + grigi > 0 && (
                <p className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[12px] text-white/55">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-blue-300" />
                  {100 - bianchi - grigi}% del colore scelto, {bianchi}% bianchi, {grigi}% grigi.
                </p>
              )}
            </div>


            <button
              onClick={generaOChiedi}
              //  ⚠️ IL DIFETTO: il tasto restava spento dopo aver caricato la
              //   foto di un taglio. Aspettava una chiave dell'elenco, che in
              //   quel caso non c'è — e chi aveva appena caricato la sua foto
              //   si trovava davanti un tasto grigio senza nessuna spiegazione,
              //   con l'unica strada rimasta quella di tornare indietro e
              //   scegliere dal catalogo, cioè buttare via quello che aveva
              //   appena fatto. Le vie per arrivare qui sono DUE, e il
              //   controllo deve conoscerle tutte e due.
              disabled={(!taglio && !fotoTaglio && !suMisura) || pronto === false}
              className="hg-shine hg-alone mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 py-4 text-[15px] font-semibold text-white transition hover:bg-blue-400 disabled:opacity-40 disabled:shadow-none"
            >
              <Sparkles className="h-4 w-4" /> Guardami con questi capelli
            </button>
          </div>
        )}

        {/* ══ 4. IL RISULTATO ═════════════════════════════════════════════ */}
        {passo === "risultato" && (
          <div>
            {(carico || altroCarica) && (
              //  ⚠️ SI DICE QUANTO DURA. Trenta secondi davanti a una rotellina
              //   muta sono trenta secondi in cui si chiude la pagina.
              <div className="hg-shine flex flex-col items-center gap-4 hg-vetro rounded-3xl px-6 py-14 text-center">
                {/*  ⚠️ Il riquadro dell'attesa è l'UNICO posto dove il riflesso
                    che passa serve davvero a qualcosa: dice «sta succedendo»
                    anche nei secondi in cui non cambia niente, che sono quelli
                    in cui si ricarica la pagina. */}
                <span className="relative flex h-16 w-16 items-center justify-center">
                  <span className="absolute inset-0 animate-ping rounded-full bg-blue-400/15" />
                  <span className="absolute inset-2 rounded-full border border-blue-300/25" />
                  <Loader2 className="h-7 w-7 animate-spin text-blue-300" />
                </span>
                <p className="text-lg font-semibold">Ci sto lavorando</p>
                <p className="max-w-xs text-sm text-white/45">
                  Una ventina di secondi. Resta su questa pagina: il risultato compare qui.
                </p>
              </div>
            )}

            {!carico && !altroCarica && !!errore && (
              <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 p-5 text-center">
                <TriangleAlert className="mx-auto h-7 w-7 text-rose-300" />
                <p className="mt-3 font-semibold">{errore}</p>
                {!!dettaglio && <p className="mt-2 text-sm text-rose-200/70">{dettaglio}</p>}
                <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                  <button
                    onClick={generaOChiedi}
                    className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 font-semibold transition hover:bg-white/15"
                  >
                    <RotateCw className="h-4 w-4" /> Riprova
                  </button>
                  <button
                    onClick={() => setPasso("foto")}
                    className="rounded-xl border border-white/15 px-5 py-3 font-semibold text-white/70 transition hover:bg-white/[0.06]"
                  >
                    Cambia foto
                  </button>
                </div>
              </div>
            )}

            {!carico && !altroCarica && !!esito && (
              <div>
                {/*  ⚠️ PRIMA E DOPO, AFFIANCATI E DELLA STESSA MISURA. Il
                    risultato da solo non dice niente: quello che convince è il
                    confronto, ed è anche l'unico modo onesto di mostrarlo —
                    chi guarda vede da sé cosa è cambiato e cosa no. */}
                {/* ── ⚠️ IL «PRIMA» C'È SOLO SE C'È DAVVERO ─────────────────
                      Riaprendo il link di una prova, la foto di partenza non
                      esiste più: sta solo nella memoria del browser di quel
                      momento, e non la salviamo da nessuna parte — è la
                      promessa scritta sulla prima schermata, e vale più di un
                      riquadro affiancato.
                     ⚠️ Prima il riquadro si disegnava lo stesso, con
                      l'immagine rotta e la scritta «La tua foto» al posto suo:
                      sembrava che si fosse persa qualcosa per un guasto. Se non
                      c'è, il risultato si prende tutto lo spazio — che per
                      giunta è il modo migliore di guardarlo. */}
                <div className={`grid gap-2.5 ${foto ? "sm:grid-cols-2" : ""}`}>
                  {!!foto && (
                    <figure className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                      <img src={foto} alt="La tua foto" className="w-full object-cover" />
                      <figcaption className="px-3 py-2 text-center text-xs uppercase tracking-wide text-white/40">
                        Prima
                      </figcaption>
                    </figure>
                  )}
                  <figure
                    className="hg-bordo-vivo overflow-hidden rounded-2xl shadow-xl shadow-blue-500/20"
                    style={{ ["--hg-fondo" as string]: "#0b1224" }}
                  >
                    <img src={esito} alt="Con il taglio scelto" className="w-full object-cover" />
                    <figcaption className="px-3 py-2 text-center text-xs uppercase tracking-wide text-blue-200/80">
                      Dopo
                      {/*  ⚠️ Sotto al «dopo» si scrive COSA si sta guardando:
                          dopo tre prove di fila non ci si ricorda più quale
                          taglio fosse questo, e senza il nome non lo si può
                          nemmeno chiedere al telefono. */}
                      {!!taglio && (
                        <span className="mt-0.5 block text-[11px] normal-case tracking-normal text-white/40">
                          {catalogo.find((x) => x.chiave === taglio)?.nome}
                          {colore !== "come_barba" && colore !== COLORE_DA_FOTO
                            ? ` · ${COLORI.find((c) => c.chiave === colore)?.nome}`
                            : ""}
                        </span>
                      )}
                    </figcaption>
                  </figure>
                </div>

                {/* ── ⚠️ LE PROVE DI PRIMA RESTANO QUI ─────────────────────
                      Si tocca una e torna a schermo. È l'unica cosa che
                      permette di CONFRONTARE, ed è confrontando che si sceglie
                      — con una sola immagine alla volta si sceglie l'ultima. */}
                {anteprime.length > 1 && (
                  <div className="mt-4">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/35">
                      le tue prove
                    </p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {anteprime.map((a, i) => (
                        <button
                          key={`${a.immagine.slice(-24)}-${i}`}
                          onClick={() => setEsito(a.immagine)}
                          title={a.nome}
                          className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border transition ${
                            esito === a.immagine ? "border-blue-400 ring-2 ring-blue-400/40" : "border-white/12 hover:border-white/30"
                          }`}
                        >
                          <img src={a.immagine} alt={a.nome} className="h-full w-full object-cover" />
                          {a.salvata && (
                            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                              <Check className="h-2.5 w-2.5 text-white" />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                  <button
                    onClick={() => void salvaSuScheda()}
                    disabled={salvo || anteprime[0]?.salvata}
                    className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-3 font-semibold text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-50"
                  >
                    {salvo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {anteprime[0]?.salvata ? "Salvata sulla scheda" : "Salva sulla scheda"}
                  </button>
                  {/* ── ⚠️ SCRIVICI: È IL GESTO CHE VALE ─────────────────────
                        Il resto della pagina serve a portare qui. Il messaggio
                        è già scritto — chi deve inventarsi cosa dire non
                        scrive — e nomina il taglio che sta guardando, così
                        dall'altra parte si sa subito di cosa si parla senza
                        chiedere «quale?».
                       ⚠️ Compare solo se il numero è stato impostato: un tasto
                        WhatsApp che apre una chat vuota è peggio di nessun
                        tasto. */}
                  {!!contatto.numero && (
                    <a
                      href={`https://wa.me/${contatto.numero.replace(/[^\d]/g, "")}?text=${encodeURIComponent(
                        `${contatto.messaggio || "Ciao! Ho provato l'anteprima capelli sul vostro sito e mi piacerebbe un taglio come quello della simulazione. Posso avere informazioni?"}${
                          taglio ? `\n\nIl taglio che ho provato: ${catalogo.find((x) => x.chiave === taglio)?.nome || ""}` : ""
                        }${
                          colore && colore !== "come_barba"
                            ? `\nColore: ${COLORI.find((c) => c.chiave === colore)?.nome || ""}`
                            : ""
                        }`,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hg-shine flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-white shadow-lg shadow-emerald-500/25 transition hover:bg-emerald-400"
                    >
                      <MessageCircle className="h-4 w-4" /> Scrivici su WhatsApp
                    </a>
                  )}
                  <button
                    onClick={scarica}
                    className="hg-shine flex items-center gap-2 rounded-xl bg-blue-500 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-500/25 transition hover:bg-blue-400"
                  >
                    <Download className="h-4 w-4" /> Scarica
                  </button>
                  <button
                    onClick={() => setPasso("taglio")}
                    className="flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-5 py-3 font-semibold text-white/80 transition hover:border-white/25 hover:bg-white/[0.08]"
                  >
                    <Scissors className="h-4 w-4" /> Prova un altro taglio
                  </button>
                  <button
                    onClick={() => setPasso("colore")}
                    className="rounded-xl border border-white/12 bg-white/[0.04] px-5 py-3 font-semibold text-white/80 transition hover:border-white/25 hover:bg-white/[0.08]"
                  >
                    Cambia colore
                  </button>
                </div>

                {!foto && (
                  //  ⚠️ Si dice PERCHÉ manca, e si dice che è voluto: «la tua
                  //   foto non la conserviamo» letto qui vale più di dieci
                  //   righe di informativa, perché arriva nel momento in cui
                  //   uno se ne accorge.
                  <p className="mt-3 text-center text-[12px] text-white/35">
                    La foto di partenza non la conserviamo: resta solo sul tuo telefono, e riaprendo
                    questo link vedi il risultato.
                  </p>
                )}
                {!senzaFiligrana && (
                  //  ⚠️ Non è una scritta di servizio: è il posto in cui la
                  //   filigrana smette di essere un fastidio e diventa un
                  //   motivo per comprare. Si dice dove si vede, cioè sotto
                  //   l'immagine che ce l'ha.
                  <p className="mt-3 text-center text-[12px] text-white/40">
                    Con un pacchetto la scarichi{" "}
                    <button onClick={() => setPasso("compra")} className="font-semibold text-blue-300 underline underline-offset-2">
                      senza filigrana
                    </button>
                    .
                  </p>
                )}
                {/* ── ⚠️ L'ARCHIVIO DI CHI LAVORA, IN FONDO E NON IN MEZZO ──
                      Sta all'ultimo posto della pagina perché non è un gesto
                      del cliente: è quello che fa l'operatore quando la prova
                      è finita e la persona si è alzata dalla poltrona. In
                      mezzo ai tasti del cliente — WhatsApp, scarica — sarebbe
                      un comando dello studio in mano a chi non deve premerlo.
                     ⚠️ Solo con codice admin: al cliente normale le prove
                      finiscono già da sole sulla sua scheda. */}
                {admin && anteprime.length > 0 && (
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      <Images className="h-3.5 w-3.5 text-blue-300" /> solo per lo studio
                    </p>
                    <p className="mt-1.5 text-[13px] leading-snug text-white/55">
                      {anteprime.length === 1 ? "C'è una prova" : `Ci sono ${anteprime.length} prove`} in questa
                      sessione. Mandale sulla scheda del cliente: da lì le ritrovi fra un mese, e qui spariscono.
                    </p>

                    {leadDelCodice ? (
                      //  Il codice è già legato a una scheda: niente da
                      //  cercare, si preme e vanno.
                      <button
                        onClick={() => void inviaAllaScheda("")}
                        disabled={invio}
                        className="hg-shine mt-3 flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-50"
                      >
                        {invio ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Manda tutte sulla scheda
                        {!!(suoNome.nome || suoNome.cognome) && ` di ${suoNome.nome} ${suoNome.cognome}`.trimEnd()}
                      </button>
                    ) : (
                      <div className="mt-3">
                        {/*  ⚠️ Si cerca per nome, cognome, email o telefono: chi
                            è al banco ha davanti la persona e in mano il suo
                            numero, ed è quello che digiterà. */}
                        <input
                          value={cercaLead}
                          onChange={(e) => void cercaSchede(e.target.value)}
                          placeholder="Cerca il cliente: nome, email o telefono"
                          className="w-full rounded-xl border border-white/12 bg-black/25 px-3.5 py-2.5 text-sm outline-none transition placeholder:text-white/25 focus:border-blue-400/50"
                        />
                        {leadTrovati.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            {leadTrovati.map((l) => (
                              <button
                                key={l.id}
                                onClick={() => void inviaAllaScheda(l.id)}
                                disabled={invio}
                                className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-left text-sm transition hover:border-blue-400/40 hover:bg-blue-500/10 disabled:opacity-50"
                              >
                                <span className="min-w-0 truncate font-medium">
                                  {`${l.nome} ${l.cognome}`.trim() || "Senza nome"}
                                  {!!l.coda && <span className="text-white/35"> · ···{l.coda}</span>}
                                </span>
                                <span className="shrink-0 text-[12px] font-semibold text-blue-300">manda qui</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {cercaLead.trim().length >= 2 && leadTrovati.length === 0 && (
                          <p className="mt-2 text-[12px] text-white/35">Nessuna scheda con questo nome.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {inviate > 0 && (
                  <p className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2.5 text-[13px] font-medium text-emerald-200">
                    <Check className="h-4 w-4" />
                    {inviate === 1 ? "Prova archiviata" : `${inviate} prove archiviate`} sulla scheda del cliente.
                  </p>
                )}

                <p className="mt-3 text-center text-xs text-white/30">
                  Anteprima generata al computer: serve a farsi un'idea, non è una fotografia.
                  {restano !== null && restano >= 0
                    && ` Ti ${restano === 1 ? "resta" : "restano"} ${restano} ${restano === 1 ? "prova" : "prove"} sul tuo codice.`}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── ⚠️ LA BARRA DEL PRESENTATORE ERA IMPORTATA E MAI MESSA IN PAGINA ──
            Il pezzo che la carica sta in cima da settimane, con tanto di
            spiegazione — e nessuno l'ha mai disegnata. Perciò aprire
            l'anteprima capelli durante una consulenza toglieva TUTTI i
            comandi: microfono, ritorno al preventivo, chiusura chiamata. Il
            margine in fondo per farle spazio c'era già: si riservava un posto
            a una cosa che non arrivava mai.
           ⚠️ Non a chi guarda (`watch`): al cliente questa barra chiederebbe
            il PIN del presentatore, ed è l'ultima cosa che deve vedere. Come
            sul preventivo, dove la barra si monta solo se non sei né lo
            spettatore né il cliente. */}
      {!!daMeetly && !watch && (
        <Suspense fallback={null}>
          <BarraPresentatore page="capelli" />
        </Suspense>
      )}
    </div>
  );
}
