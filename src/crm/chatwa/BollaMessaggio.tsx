import {
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  Check,
  CheckCheck,
  ChevronDown,
  Clock,
  ExternalLink,
  ImageIcon,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { FRASE_CONFERMA_INCERTO } from "../ponte/invio";
import { useCRM } from "@/crm/CRMContext";
import { corpoLeggibile } from "@/crm/testo-modello";
import { classificaTesto, type TestoClassificato } from "./media";
import { IconaMedia } from "./IconaMedia";
import { FoglioMedia, type ModoFoglio } from "./FoglioMedia";
import { VistaMediaPonte, type PropsVocalePonte } from "./MediaPonte";
import {
  ESCLUDI_PRESSIONE,
  apriFuori,
  mediaDelPonte,
  nuovoSoppressoreClick,
  useMediaPonte,
  type ScelteTimer,
} from "./usaMediaPonte";
import { useVisibile } from "./usaVisibile";
import {
  barreFinte,
  etichettaVelocita,
  quotaDaPunto,
  salvaVelocita,
  tempoVocale,
  velocitaDopo,
  velocitaSalvata,
} from "./stile";
import { eSpostamento, PRESSIONE_LUNGA_MS } from "./selezione";
import type { BollaProps } from "./tipi";

/** ── LA BOLLA ─────────────────────────────────────────────────────────────
 *  Commessa 2026-10-28, T9. Un messaggio, a forma di WhatsApp.
 *  ⚠️ Il testo in entrata lo scrive il cliente: un link diventa lettore, anteprima
 *   o collegamento SOLO se `classificaTesto` (D14, R8) lo riconosce, e nel DOM
 *   va sempre `url.href` che ne torna, mai la stringa grezza. Niente HTML dal
 *   testo: sempre un nodo di testo. */

/** L'ora del messaggio (sempre HH:MM: i giorni li separa la conversazione). */
function ora(d: string): string {
  const data = new Date(d);
  return Number.isNaN(data.getTime())
    ? ""
    : data.toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Rome",
      });
}

/** Il tipo che il browser deve saper riprodurre, dall'estensione del file (già controllata da media.ts). */
function mimeAudio(url: string): string {
  const est = new URL(url).pathname.split(".").pop()?.toLowerCase();
  if (est === "mp3") return "audio/mpeg";
  if (est === "m4a") return "audio/mp4";
  if (est === "aac") return "audio/aac";
  if (est === "amr") return "audio/amr";
  return "audio/ogg; codecs=opus"; // ogg, oga, opus
}

/** Collegamento a un file ospitato da ManyChat: nuova scheda, senza passare l'origine del CRM. */
function Collegamento({ url, testo }: { url: string; testo: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-11 md:min-h-8 items-center gap-1.5 font-medium underline underline-offset-2"
    >
      <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {testo}
    </a>
  );
}

/*  ── IL LETTORE DEI VOCALI, COME WHATSAPP (28/10/2026) ──────────────────
    Prima c'era l'audio nativo del browser, coi suoi comandi: brutto e, toccandolo, la chat
    saltava (i comandi nativi cambiano altezza caricando, e il tocco toglieva il
    fuoco alla casella: tastiera giù, area più alta, scorrimento). Ora:
     · tasto tondo play/pausa, forma d'onda finta trascinabile, tempo, 1×/1,5×/2×;
     · misure fisse in ogni stato (fermo, carica, suona, errore): niente salti;
     · i tocchi non prendono il fuoco (`preventDefault` sul pointerdown): la
       tastiera, se è su, resta su;
     · UN SOLO VOCALE ALLA VOLTA: chi parte ferma quello di prima (`vocaleInCorso`).
    Dal 30/10/2026 (richiesta del titolare): si vede la DURATA prima di premere play
    (`preload="metadata"`: il browser legge solo l'intestazione del file, non il vocale
    intero) e la velocità scelta (1× / 1,5× / 2×) resta salvata per i vocali dopo. */
let vocaleInCorso: HTMLAudioElement | null = null;
const BARRE = 28;

type StatoVocale = "fermo" | "carica" | "suona" | "errore";

/** Il vocale: lettore se il browser sa riprodurlo, altrimenti il link.
 *  ManyChat (solo in entrata): `url` è già l'indirizzo. Ponte (T8, 31/10/2026): non c'è un indirizzo da
 *  tenere in pagina, quindi `mime` e `seme` (il nome del file) sostituiscono ciò che prima si ricavava
 *  dall'estensione, `durataIniziale` viene dalla riga e `preparaUrl` scarica il vocale al PRIMO play
 *  (≤ 16 MiB → `blob:`); `scarica` è il ripiego se il browser non sa suonarlo (R6, OGG su iPhone). */
function Vocale({
  url,
  mime,
  seme,
  durataIniziale,
  preparaUrl,
  scarica,
}: {
  url?: string;
  mime?: string;
  seme?: string;
  durataIniziale?: number | null;
  preparaUrl?: PropsVocalePonte["preparaUrl"];
  scarica?: () => void;
}) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const traccia = useRef<HTMLDivElement | null>(null);
  const [riproducibile, setRiproducibile] = useState(true);
  const [stato, setStato] = useState<StatoVocale>("fermo");
  const [tempo, setTempo] = useState(0);
  const [durata, setDurata] = useState(durataIniziale ?? 0);
  const [velocita, setVelocita] = useState(1);
  //  Dopo il montaggio (non nel primo disegno, che può venire dal server).
  useEffect(() => setVelocita(velocitaSalvata()), []);
  const [partito, setPartito] = useState(false);
  const barre = useMemo(() => barreFinte(seme ?? url ?? "", BARRE), [seme, url]);
  const tipo = mime ?? (url ? mimeAudio(url) : "");

  useEffect(() => {
    // Safari iOS vecchi non suonano l'.ogg: lì resta solo il link (D14).
    if (tipo && document.createElement("audio").canPlayType(tipo) === "") setRiproducibile(false);
    const a = audio.current;
    return () => {
      if (a && vocaleInCorso === a) vocaleInCorso = null;
      a?.pause();
    };
  }, [tipo]);

  const suona = async () => {
    const a = audio.current;
    if (!a) return;
    if (!a.paused) {
      a.pause();
      return;
    }
    //  Vocale del ponte: ancora niente da suonare, si scarica ora (non prima: una chat con 40 vocali non li scarica).
    if (!a.getAttribute("src") && preparaUrl) {
      setPartito(true);
      setStato("carica");
      const u = await preparaUrl();
      if (!u || audio.current !== a) {
        setStato(u ? "fermo" : "errore");
        return;
      }
      a.src = u;
    }
    if (vocaleInCorso && vocaleInCorso !== a) vocaleInCorso.pause();
    vocaleInCorso = a;
    //  La velocità scelta su un altro vocale vale anche per questo.
    const v = velocitaSalvata();
    setVelocita(v);
    a.playbackRate = v;
    setPartito(true);
    if (a.readyState < 3) setStato("carica");
    a.play().catch((e: unknown) => {
      //  Un pause() arrivato prima che partisse non è un guasto.
      if ((e as { name?: string })?.name !== "AbortError") setStato("errore");
    });
  };

  const vaiA = (quota: number) => {
    const a = audio.current;
    if (!a || !(a.duration > 0) || !Number.isFinite(a.duration)) return;
    a.currentTime = quota * a.duration;
    setTempo(a.currentTime);
  };
  const daTocco = (x: number) => {
    const r = traccia.current?.getBoundingClientRect();
    if (r) vaiA(quotaDaPunto(x, r.left, r.width));
  };

  if (!riproducibile) {
    return (
      <div className="flex flex-col gap-1">
        <span className="inline-flex items-center gap-1.5">
          <IconaMedia tipo="audio" /> Vocale
        </span>
        {url ? (
          <Collegamento url={url} testo="Apri il vocale" />
        ) : (
          scarica && (
            <Button
              type="button"
              variant="outline"
              onClick={scarica}
              className="min-h-11 gap-1.5 self-start bg-white/70 text-[13px] md:min-h-8"
            >
              Scarica il vocale
            </Button>
          )
        )}
      </div>
    );
  }

  const quota = durata > 0 ? Math.min(1, tempo / durata) : 0;
  const colore = "bg-sky-600";
  return (
    <div className="flex w-[15.5rem] max-w-full items-center gap-2.5 py-0.5">
      <audio
        ref={audio}
        preload={url ? "metadata" : "none"}
        src={url}
        onLoadedMetadata={(e) => setDurata(e.currentTarget.duration)}
        onDurationChange={(e) => setDurata(e.currentTarget.duration)}
        onTimeUpdate={(e) => setTempo(e.currentTarget.currentTime)}
        onPlaying={() => setStato("suona")}
        onWaiting={() => setStato("carica")}
        onPause={() => setStato((s) => (s === "errore" ? s : "fermo"))}
        onEnded={(e) => {
          e.currentTarget.currentTime = 0;
          setTempo(0);
          setStato("fermo");
        }}
        onError={() => setStato("errore")}
        className="hidden"
      />
      <button
        type="button"
        onPointerDown={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => void suona()}
        //  Vocale del ponte: la pressione lunga sul tasto apre il foglio del media (gli altri tasti restano esclusi).
        data-media-pl={preparaUrl ? "" : undefined}
        aria-label={stato === "suona" ? "Metti in pausa il vocale" : "Ascolta il vocale"}
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          "bg-[#54656f] hover:bg-[#3b4a54]",
        )}
      >
        {stato === "carica" ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden />
        ) : stato === "suona" ? (
          <Pause className="h-[18px] w-[18px] fill-current" aria-hidden />
        ) : (
          <Play className="ml-0.5 h-[18px] w-[18px] fill-current" aria-hidden />
        )}
      </button>
      <div className="min-w-0 flex-1">
        {stato === "errore" ? (
          <p className="flex h-7 items-center gap-1.5 text-[13px] leading-tight">
            Vocale non disponibile ·{" "}
            {url ? (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2"
              >
                apri
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setStato("fermo")}
                className="font-medium underline underline-offset-2"
              >
                riprova
              </button>
            )}
          </p>
        ) : (
          <div
            ref={traccia}
            role="slider"
            tabIndex={0}
            aria-label="Posizione nel vocale"
            aria-valuemin={0}
            aria-valuemax={Number.isFinite(durata) ? Math.round(durata) : 0}
            aria-valuenow={Math.round(tempo)}
            aria-valuetext={`${tempoVocale(tempo)} di ${tempoVocale(durata)}`}
            //  `touch-none` solo qui: trascinare la barra non deve far scorrere la chat.
            className="relative flex h-7 cursor-pointer touch-none items-center justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onPointerDown={(e) => {
              e.preventDefault();
              e.currentTarget.setPointerCapture(e.pointerId);
              daTocco(e.clientX);
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) daTocco(e.clientX);
            }}
            onKeyDown={(e) => {
              const passo = e.key === "ArrowRight" ? 5 : e.key === "ArrowLeft" ? -5 : 0;
              if (!passo || !(durata > 0)) return;
              e.preventDefault();
              vaiA(Math.min(1, Math.max(0, (tempo + passo) / durata)));
            }}
          >
            {barre.map((h, i) => (
              <span
                key={i}
                aria-hidden
                style={{ height: `${Math.round(h * 100)}%` }}
                className={cn(
                  "w-[3px] shrink-0 rounded-full",
                  (i + 0.5) / BARRE <= quota ? colore : "bg-[#8696a0]/60",
                )}
              />
            ))}
            <span
              aria-hidden
              style={{ left: `calc(${quota * 100}% - 6px)` }}
              className={cn("absolute h-3 w-3 rounded-full shadow-sm", colore)}
            />
          </div>
        )}
        <div className="mt-0.5 flex h-5 items-center gap-2 text-[11px] tabular-nums text-[#54656f]">
          <span>{tempoVocale(partito ? tempo : durata)}</span>
          {partito && stato !== "errore" && (
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const v = velocitaDopo(velocita);
                setVelocita(v);
                salvaVelocita(v);
                if (audio.current) audio.current.playbackRate = v;
              }}
              aria-label={`Velocità ${etichettaVelocita(velocita)}, tocca per cambiarla`}
              className="min-w-9 rounded-full bg-black/10 px-1.5 text-[11px] font-semibold leading-5 text-[#3b4a54]"
            >
              {etichettaVelocita(velocita)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** La foto: non si carica da sola. L'`<img>` esiste solo dopo il tocco (D14, R8). */
function Foto({ url }: { url: string }) {
  const [vista, setVista] = useState(false);
  const [guasta, setGuasta] = useState(false);
  if (guasta) {
    return (
      <div className="flex flex-col gap-1">
        <span>Foto non disponibile: il link potrebbe essere scaduto.</span>
        <Collegamento url={url} testo="Prova ad aprirla" />
      </div>
    );
  }
  if (!vista) {
    return (
      <button
        type="button"
        onClick={() => setVista(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-md bg-black/[0.04] px-3 py-2 text-left font-medium hover:bg-black/[0.07]"
      >
        <ImageIcon className="h-4 w-4 shrink-0" aria-hidden />
        Foto · Tocca per vedere
      </button>
    );
  }
  return (
    <img
      src={url}
      alt="Foto inviata dal cliente"
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setGuasta(true)}
      className="-mx-1.5 -mt-0.5 max-h-80 max-w-[calc(100%+0.75rem)] rounded-md object-contain"
    />
  );
}

/*  ── L'ORA DENTRO LA BOLLA, COME WHATSAPP ──────────────────────────────
    L'ora (e le spunte) sta in basso a destra, sulla stessa riga dell'ultima
    parola se c'è posto: in fondo al testo c'è uno spazio vuoto largo quanto
    l'ora (`after:`), e l'ora è posata sopra quello spazio. Così una risposta
    breve occupa UNA riga, non due. */
const TESTO = "whitespace-pre-wrap break-words [overflow-wrap:anywhere]";
const SPAZIO_ORA = "after:inline-block after:h-3 after:content-['']";
const spazioOra = (fromMe: boolean) =>
  cn(SPAZIO_ORA, fromMe ? "after:w-[4.25rem]" : "after:w-[2.75rem]");

/** Il contenuto: solo i messaggi IN ENTRATA si interpretano; quelli scritti da noi sono sempre testo. */
function Contenuto({ messaggio: m, c }: BollaProps & { c: TestoClassificato | null }) {
  if (!c || c.tipo === "testo") {
    return <p className={cn(TESTO, spazioOra(false))}>{m.body}</p>;
  }
  if (c.tipo === "illeggibile") {
    return <p className={cn("italic text-[#54656f]", spazioOra(false))}>{c.etichetta}</p>;
  }
  const url = c.url;
  if (!url) return <p className={cn(TESTO, spazioOra(false))}>{m.body}</p>;
  if (c.tipo === "audio") return <Vocale url={url} />;
  if (c.tipo === "immagine") return <Foto url={url} />;
  const azione = {
    video: "Apri il video",
    documento: "Apri il documento",
    allegato: "Apri l'allegato",
  }[c.tipo];
  return (
    <div className="flex flex-col gap-0.5">
      <span className="inline-flex items-center gap-1.5">
        <IconaMedia tipo={c.tipo === "video" || c.tipo === "documento" ? c.tipo : "allegato"} />
        {c.etichetta}
      </span>
      <Collegamento url={url} testo={azione ?? "Apri"} />
    </div>
  );
}

/** ── IL MODELLO COME L'HA LETTO IL CLIENTE (28/10/2026, crm/testo-modello) ──
 *  Un nostro messaggio salvato come «[template:nome]» si mostra col testo vero;
 *  se è ricostruito dalla scheda lo si dice (data e ora potevano essere altre).
 *  Tutto il resto scritto da noi resta testo, mai interpretato. */
function ModelloLeggibile({
  messaggio: m,
  lead,
  consultants,
}: BollaProps & { consultants: { id: string; data: { nome?: string } }[] }) {
  const consulente = consultants.find((x) => x.id === lead?.data?.consulenteId)?.data.nome ?? null;
  const v = corpoLeggibile(m.body, lead?.data, consulente, lead?.id);
  return (
    <>
      <p className={cn(TESTO, !v.modello && spazioOra(true))}>{v.testo}</p>
      {/* Etichetta tecnica: discreta, sotto il testo, accanto all'ora. */}
      {v.modello && (
        <p
          className={cn("mt-0.5 text-[11px] leading-4 text-[#54656f]", spazioOra(true))}
          title={`Modello «${v.modello}»`}
        >
          {v.ricostruito ? "Modello · testo ricostruito dalla scheda" : "Modello"}
        </p>
      )}
    </>
  );
}

/*  ── LA BOLLA DELLA CODA: «SCRIVI DAL TELEFONO» (30/10/2026) ──────────────
    Commessa 2026-10-30-ponte-invio-manuale. Un messaggio messo in coda dal CRM
    e non ancora (o mai) arrivato come riga vera: stessa bolla verde delle
    nostre uscite, col suo stato scritto a parole (il significato non sta nel
    solo colore) e, se non è partito, il tasto «Riprova» da 44 px. Se l'esito è
    incerto il messaggio potrebbe essere già partito: prima di riprovare si
    chiede conferma, con la frase unica del piano. Il testo resta un nodo di
    testo, mai HTML. */

/** «Questo cliente…» → «questo cliente…»: la frase segue «Non inviato: ». */
const inMinuscolo = (frase: string) => frase.charAt(0).toLowerCase() + frase.slice(1);

/** Lo stato sotto il testo: in volo, oppure «Non inviato» col motivo e il riprova. */
function StatoCoda({ coda }: { coda: NonNullable<BollaProps["coda"]> }) {
  //  Per un invio incerto il tasto chiede prima conferma (il messaggio potrebbe essere già partito).
  const [chiedi, setChiedi] = useState(false);
  if (coda.fase === "in_attesa" || coda.fase === "in_invio") {
    return (
      <p
        role="status"
        className="mt-1 flex items-center gap-1.5 text-[12px] leading-4 text-[#54656f]"
      >
        <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
        In invio dal telefono…
      </p>
    );
  }
  if (coda.fase !== "non_inviato") return null;
  return (
    <div role="status" className="mt-1.5 flex flex-col gap-1.5 border-t border-black/10 pt-1.5">
      <p className="flex items-start gap-1.5 text-[12.5px] leading-snug text-rose-800">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {coda.incerto ? coda.frase : `Non inviato: ${inMinuscolo(coda.frase)}`}
      </p>
      {coda.puoRiprovare &&
        (chiedi ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-[12.5px] leading-snug">{FRASE_CONFERMA_INCERTO}</p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setChiedi(false);
                  coda.onRiprova();
                }}
                className="min-h-11 flex-1 gap-1.5 bg-white/70 text-[13px]"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Sì, riprova
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setChiedi(false)}
                className="min-h-11 flex-1 text-[13px]"
              >
                No
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => (coda.incerto ? setChiedi(true) : coda.onRiprova())}
            className="min-h-11 gap-1.5 self-start bg-white/70 text-[13px]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Riprova
          </Button>
        ))}
    </div>
  );
}

/** Una bolla di messaggio, stile WhatsApp: uscita verde chiaro, entrata bianca,
 *  angolo «a punta» solo sulla prima di una serie dello stesso lato (`attaccata`:
 *  la decide la conversazione, vedi `attaccataAllaPrecedente` in ./stile). */
function BollaBase({
  messaggio: m,
  lead,
  coda,
  attaccata = false,
  rispiega,
}: BollaProps & {
  attaccata?: boolean;
  /** «Rispiega con AI» (30/10/2026): se c'è, la bolla si può scegliere con la pressione lunga
   *  (telefono e mouse) o dal menu che compare al passaggio del mouse. `onInizia` accende la selezione. */
  rispiega?: { onInizia: () => void };
}) {
  const fromMe = m.direction === "outbound";
  //  Un media del ponte (foto, vocale, video, documento): vale in entrata e in uscita (dal telefono).
  const media = coda ? null : mediaDelPonte(m);
  /*  ── PRESSIONE LUNGA (30/10/2026; media 31/10/2026) ─────────────────────
      Come nelle righe dell'elenco (RigaChat): eventi del puntatore, si annulla se il dito
      scorre (`eSpostamento`), se lo si alza prima o se il browser prende il gesto
      (`pointercancel`). Un gesto solo: su un media del ponte apre il FOGLIO (Mostra · Timer ·
      Rispiega), altrimenti accende la selezione di «Rispiega con AI» come prima.
      Non parte da link, lettori, cursori e tasti (`ESCLUDI_PRESSIONE`), salvo i tasti del media
      marcati `data-media-pl`. Il click che il browser può generare dopo il rilascio si ignora per
      ~400 ms (`nuovoSoppressoreClick`), non con un flag che resta acceso: iOS spesso non lo manda.
      Sul telefono il testo non si seleziona a mano (come WhatsApp, dove la pressione lunga
      sceglie il messaggio): altrimenti iOS apre la sua selezione sopra la nostra. */
  const conPressione = !!rispiega || !!media;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partenza = useRef<{ x: number; y: number } | null>(null);
  const tocco = useRef(false);
  const [click] = useState(() => nuovoSoppressoreClick());
  const [foglio, setFoglio] = useState(false);
  const [erroreFoglio, setErroreFoglio] = useState<string | null>(null);
  const annullaPressione = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    partenza.current = null;
  };
  useEffect(() => annullaPressione, []);
  //  Caricamento pigro: finché la bolla non è stata in vista (o vicina) non si legge niente.
  const { ref: bollaRef, visibile } = useVisibile(!media);
  const g = useMediaPonte(media, m.created_at, visibile);
  const iniziaPressione = (e: PointerEvent<HTMLDivElement>) => {
    tocco.current = e.pointerType === "touch" || e.pointerType === "pen";
    click.inizia();
    if (!conPressione || (e.pointerType === "mouse" && e.button !== 0)) return;
    if ((e.target as HTMLElement).closest(ESCLUDI_PRESSIONE)) return;
    partenza.current = { x: e.clientX, y: e.clientY };
    timer.current = setTimeout(() => {
      timer.current = null;
      if (typeof navigator !== "undefined") navigator.vibrate?.(15);
      if (media) {
        click.scatta();
        setErroreFoglio(null);
        setFoglio(true);
      } else rispiega?.onInizia();
    }, PRESSIONE_LUNGA_MS);
  };
  const muoviPressione = (e: PointerEvent<HTMLDivElement>) => {
    const p = partenza.current;
    if (p && eSpostamento(e.clientX - p.x, e.clientY - p.y)) annullaPressione();
  };
  const finePressione = () => {
    annullaPressione();
    click.rilascia();
  };
  const { consultants } = useCRM();
  const c = fromMe ? null : classificaTesto(m.body ?? "");
  //  Finché il media è solo il testo («📷 Foto») l'ora sta accanto, come per ogni testo; con file,
  //  tasto, foto o errore sta sotto.
  const senzaFile = g.fase.fase === "verifica" || g.fase.fase === "nessuna";
  //  Testo (anche illeggibile o link non riconosciuto) e vocale: l'ora si posa sull'ultima riga.
  //  La bolla della coda ha lo stato sotto il testo: l'ora sta sotto lo stato (solo «inviato» la tiene sopra).
  const oraSopra = coda
    ? coda.fase === "inviato"
    : media
      ? senzaFile || (g.fase.fase === "pronta" && media.categoria === "audio" && !!g.riga?.id)
      : !c || c.tipo === "testo" || c.tipo === "illeggibile" || c.tipo === "audio" || !c.url;

  //  Che cosa offre il foglio, secondo la fase del media.
  const modoFoglio: ModoFoglio =
    g.fase.fase === "pronta" && g.riga?.id
      ? "pronta"
      : g.fase.fase === "nessuna" ||
          g.fase.fase === "senza_risposta" ||
          (g.fase.fase === "non_disponibile" && g.fase.riprova)
        ? "mostra"
        : "solo";
  const chiudiFoglio = () => setFoglio(false);
  const scegli = async (azione: () => Promise<boolean>) => {
    const ok = await azione();
    if (ok) chiudiFoglio();
    else setErroreFoglio("Non ci sono riuscito: riprova tra poco.");
  };
  return (
    <>
      <div
        ref={bollaRef}
        onPointerDown={conPressione ? iniziaPressione : undefined}
        onPointerMove={conPressione ? muoviPressione : undefined}
        onPointerUp={conPressione ? finePressione : undefined}
        onPointerLeave={conPressione ? finePressione : undefined}
        onPointerCancel={conPressione ? finePressione : undefined}
        onClickCapture={
          media
            ? (e) => {
                //  Il click che segue la pressione lunga non deve toccare play, scheda o riprova.
                if (click.blocca()) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              }
            : undefined
        }
        onContextMenu={
          conPressione
            ? (e) => {
                //  Il menu di sistema della pressione lunga (Android) non deve coprire il nostro.
                if (tocco.current) e.preventDefault();
              }
            : undefined
        }
        className={cn(
          "group/bolla relative min-w-0 max-w-[80%] rounded-lg px-2.5 pb-1.5 pt-1.5 md:max-w-[65%]",
          conPressione && "pointer-coarse:select-none pointer-coarse:[-webkit-touch-callout:none]",
          "text-[15px] leading-5 text-[#111b21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] md:text-[14px] md:leading-[19px]",
          attaccata ? "mt-0.5" : "mt-2.5 first:mt-0",
          fromMe
            ? cn("self-end bg-[#d9fdd3]", !attaccata && "rounded-tr-none")
            : cn("self-start bg-white", !attaccata && "rounded-tl-none"),
        )}
      >
        {coda ? (
          <>
            <p className={cn(TESTO, coda.fase === "inviato" && spazioOra(true))}>{coda.testo}</p>
            <StatoCoda coda={coda} />
          </>
        ) : media ? (
          <VistaMediaPonte
            media={media}
            g={g}
            inUscita={fromMe}
            segnaposto={<p className={cn(TESTO, spazioOra(fromMe))}>{m.body ?? ""}</p>}
            vocale={(p) => <Vocale {...p} />}
          />
        ) : fromMe ? (
          <ModelloLeggibile messaggio={m} lead={lead} consultants={consultants} />
        ) : (
          <Contenuto messaggio={m} c={c} />
        )}
        {(rispiega || media) && (
          <MenuFreccia
            fromMe={fromMe}
            // Su un media la freccia apre lo stesso foglio della pressione lunga.
            onFoglio={media ? () => (setErroreFoglio(null), setFoglio(true)) : undefined}
            rispiega={rispiega}
          />
        )}
        <div
          className={cn(
            "flex items-center justify-end gap-0.5 text-[11px] leading-4 tabular-nums text-[#54656f]",
            oraSopra ? "absolute bottom-1 right-2" : "-mb-0.5 mt-0.5",
          )}
        >
          <span>{ora(m.created_at)}</span>
          {coda?.fase === "inviato" && <Check className="h-4 w-4" aria-label="Inviato" />}
          {!coda && fromMe && m.status === "read" && (
            <CheckCheck className="h-4 w-4 text-sky-600" aria-label="Letto" />
          )}
          {!coda && fromMe && m.status === "delivered" && (
            <CheckCheck className="h-4 w-4" aria-label="Consegnato" />
          )}
          {!coda && fromMe && (m.status === "sent" || m.status === "queued") && (
            <Check className="h-4 w-4" aria-label="Inviato" />
          )}
          {!coda && fromMe && m.status === "failed" && (
            <AlertCircle
              className="h-4 w-4 text-rose-600"
              aria-label={m.error_message ? `Non inviato: ${m.error_message}` : "Non inviato"}
            />
          )}
        </div>
      </div>
      {/*  Il foglio sta FUORI dalla bolla: gli eventi del suo portale non risalgono alla pressione lunga. */}
      {media && (
        <FoglioMedia
          aperto={foglio}
          onApertoCambia={setFoglio}
          modo={modoFoglio}
          categoria={media.categoria}
          scadeIl={g.riga?.scade_il ?? null}
          errore={erroreFoglio}
          onMostra={(t: ScelteTimer) => {
            chiudiFoglio();
            void g.richiedi(t);
          }}
          onTimer={(t: ScelteTimer) => void scegli(() => g.impostaTimer(t))}
          onElimina={() => void scegli(() => g.elimina())}
          onApri={
            media.categoria === "documento" && g.riga?.id
              ? () => {
                  chiudiFoglio();
                  void apriFuori(g.riga?.id ?? "", "documento");
                }
              : undefined
          }
          onRispiega={
            rispiega
              ? () => {
                  chiudiFoglio();
                  //  Dopo la chiusura: la selezione sposta la bolla e il foglio non deve restare a metà.
                  setTimeout(rispiega.onInizia, 0);
                }
              : undefined
          }
        />
      )}
    </>
  );
}

/** La freccia in alto a destra, dal computer (al passaggio del mouse o con la tastiera; sul telefono
 *  c'è la pressione lunga, qui sarebbe un bersaglio invisibile). Su un media apre il foglio, altrimenti
 *  il menu con «Rispiega con AI». */
function MenuFreccia({
  fromMe,
  onFoglio,
  rispiega,
}: {
  fromMe: boolean;
  onFoglio?: () => void;
  rispiega?: { onInizia: () => void };
}) {
  const tasto = (
    <button
      type="button"
      aria-label={onFoglio ? "Azioni su questo file" : "Azioni su questo messaggio"}
      title={onFoglio ? "Azioni su questo file" : "Azioni su questo messaggio"}
      onClick={onFoglio}
      className={cn(
        "absolute right-1 top-1 z-10 grid h-6 w-6 place-items-center rounded-full pointer-coarse:hidden",
        "opacity-0 shadow-sm transition-opacity group-hover/bolla:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        fromMe ? "bg-[#d9fdd3] hover:bg-[#c9f2c2]" : "bg-white hover:bg-[#f0f2f5]",
      )}
    >
      <ChevronDown className="h-4 w-4 text-[#54656f]" aria-hidden />
    </button>
  );
  if (onFoglio || !rispiega) return tasto;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{tasto}</DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem className="gap-2" onSelect={rispiega.onInizia}>
          <Sparkles className="text-violet-600" aria-hidden /> Rispiega con AI
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** In memoria (p1-chat-veloce): scrivere nella casella non ridisegna le 500 bolle della chat aperta. */
export const BollaMessaggio = memo(BollaBase);
