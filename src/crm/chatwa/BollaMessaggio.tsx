import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  CheckCheck,
  ExternalLink,
  ImageIcon,
  Loader2,
  Pause,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCRM } from "@/crm/CRMContext";
import { corpoLeggibile } from "@/crm/testo-modello";
import { classificaTesto, type TestoClassificato } from "./media";
import { barreFinte, etichettaVelocita, quotaDaPunto, tempoVocale, velocitaDopo } from "./stile";
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
    Prima c'era l'`<audio controls>` del browser: brutto e, toccandolo, la chat
    saltava (i comandi nativi cambiano altezza caricando, e il tocco toglieva il
    fuoco alla casella: tastiera giù, area più alta, scorrimento). Ora:
     · tasto tondo play/pausa, forma d'onda finta trascinabile, tempo, 1×/1,5×/2×;
     · misure fisse in ogni stato (fermo, carica, suona, errore): niente salti;
     · i tocchi non prendono il fuoco (`preventDefault` sul pointerdown): la
       tastiera, se è su, resta su;
     · UN SOLO VOCALE ALLA VOLTA: chi parte ferma quello di prima (`vocaleInCorso`).
    ⚠️ Nessuna richiesta finché non si preme play (`preload="none"`, D14). */
let vocaleInCorso: HTMLAudioElement | null = null;
const BARRE = 28;

type StatoVocale = "fermo" | "carica" | "suona" | "errore";

/** Il vocale: lettore se il browser sa riprodurlo, altrimenti il link. */
/** (Solo in entrata: i nostri messaggi restano sempre testo.) */
function Vocale({ url }: { url: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const traccia = useRef<HTMLDivElement | null>(null);
  const [riproducibile, setRiproducibile] = useState(true);
  const [stato, setStato] = useState<StatoVocale>("fermo");
  const [tempo, setTempo] = useState(0);
  const [durata, setDurata] = useState(0);
  const [velocita, setVelocita] = useState(1);
  const [partito, setPartito] = useState(false);
  const barre = useMemo(() => barreFinte(url, BARRE), [url]);

  useEffect(() => {
    // Safari iOS vecchi non suonano l'.ogg: lì resta solo il link (D14).
    if (document.createElement("audio").canPlayType(mimeAudio(url)) === "") setRiproducibile(false);
    const a = audio.current;
    return () => {
      if (a && vocaleInCorso === a) vocaleInCorso = null;
      a?.pause();
    };
  }, [url]);

  const suona = () => {
    const a = audio.current;
    if (!a) return;
    if (!a.paused) {
      a.pause();
      return;
    }
    if (vocaleInCorso && vocaleInCorso !== a) vocaleInCorso.pause();
    vocaleInCorso = a;
    a.playbackRate = velocita;
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
        <span>🎤 Vocale</span>
        <Collegamento url={url} testo="Apri il vocale" />
      </div>
    );
  }

  const quota = durata > 0 ? Math.min(1, tempo / durata) : 0;
  const colore = "bg-sky-600";
  return (
    <div className="flex w-[15.5rem] max-w-full items-center gap-2.5 py-0.5">
      <audio
        ref={audio}
        preload="none"
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
        onClick={suona}
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
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline underline-offset-2"
            >
              apri
            </a>
          </p>
        ) : (
          <div
            ref={traccia}
            role="slider"
            tabIndex={0}
            aria-label="Posizione nel vocale"
            aria-valuemin={0}
            aria-valuemax={Math.round(durata) || 0}
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
        <div className="mt-0.5 flex h-5 items-center justify-between text-[11px] tabular-nums text-[#54656f]">
          <span>{tempoVocale(partito ? tempo : durata)}</span>
          {partito && stato !== "errore" && (
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                const v = velocitaDopo(velocita);
                setVelocita(v);
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
        className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-current/25 px-3 py-2 text-left font-medium"
      >
        <ImageIcon className="h-4 w-4 shrink-0" aria-hidden />
        📷 Foto · Tocca per vedere
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
      className="max-h-80 max-w-full rounded-lg object-contain"
    />
  );
}

/** Il contenuto: solo i messaggi IN ENTRATA si interpretano; quelli scritti da noi sono sempre testo. */
function Contenuto({ messaggio: m, c }: BollaProps & { c: TestoClassificato | null }) {
  if (!c || c.tipo === "testo") {
    return <p className="whitespace-pre-wrap break-words">{m.body}</p>;
  }
  if (c.tipo === "illeggibile") {
    return <p className="italic">{c.etichetta}</p>;
  }
  const url = c.url;
  if (!url) return <p className="whitespace-pre-wrap break-words">{m.body}</p>;
  if (c.tipo === "audio") return <Vocale url={url} />;
  if (c.tipo === "immagine") return <Foto url={url} />;
  const azione = {
    video: "Apri il video",
    documento: "Apri il documento",
    allegato: "Apri l'allegato",
  }[c.tipo];
  return (
    <div className="flex flex-col gap-0.5">
      <span>{c.etichetta}</span>
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
      <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{v.testo}</p>
      {v.modello && (
        <p className="mt-1 text-[11px] italic text-emerald-900/70" title={`Modello «${v.modello}»`}>
          {v.ricostruito ? "Modello · testo ricostruito dalla scheda" : "Modello"}
        </p>
      )}
    </>
  );
}

/** Una bolla di messaggio. */
export function BollaMessaggio({ messaggio: m, lead }: BollaProps) {
  const fromMe = m.direction === "outbound";
  const { consultants } = useCRM();
  const c = fromMe ? null : classificaTesto(m.body ?? "");
  const illeggibile = c?.tipo === "illeggibile";
  return (
    <div
      className={cn(
        "max-w-[85%] md:max-w-[75%] min-w-0 px-3 py-1.5 rounded-2xl text-[15px] md:text-[13px] leading-snug shadow-sm border",
        fromMe
          ? "self-end bg-emerald-100 text-emerald-950 border-emerald-200 rounded-br-sm"
          : illeggibile
            ? "self-start bg-muted text-muted-foreground border-border rounded-bl-sm"
            : "self-start bg-card text-foreground border-border rounded-bl-sm",
      )}
    >
      {fromMe ? (
        <ModelloLeggibile messaggio={m} lead={lead} consultants={consultants} />
      ) : (
        <Contenuto messaggio={m} c={c} />
      )}
      <div
        className={cn(
          "flex items-center justify-end gap-1 mt-0.5 text-[11px]",
          fromMe ? "text-emerald-900/80" : "text-muted-foreground",
        )}
      >
        <span>{ora(m.created_at)}</span>
        {fromMe && m.status === "read" && (
          <CheckCheck className="h-3.5 w-3.5 text-sky-600" aria-label="Letto" />
        )}
        {fromMe && m.status === "delivered" && (
          <CheckCheck className="h-3.5 w-3.5" aria-label="Consegnato" />
        )}
        {fromMe && (m.status === "sent" || m.status === "queued") && (
          <Check className="h-3.5 w-3.5" aria-label="Inviato" />
        )}
        {fromMe && m.status === "failed" && (
          <AlertCircle
            className="h-3.5 w-3.5 text-rose-600"
            aria-label={m.error_message ? `Non inviato: ${m.error_message}` : "Non inviato"}
          />
        )}
      </div>
    </div>
  );
}
