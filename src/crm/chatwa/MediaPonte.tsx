import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  FileText,
  ImageIcon,
  Loader2,
  Mic,
  Play,
  RotateCcw,
  Timer,
  Video as VideoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchCRM } from "@/crm/AuthContext";
import { cn } from "@/lib/utils";
import { tempoVocale } from "./stile";
import { useStatoPonte } from "./usaStatoPonte";
import {
  apriFuori,
  chiediUrl,
  formatoPeso,
  scadenzaInParole,
  useBlobMedia,
  type Categoria,
  type StatoBlob,
  type GanciMedia,
  type MediaDelPonte,
  type RigaMedia,
} from "./usaMediaPonte";

/** ── I MEDIA DEL PONTE, STATO PER STATO (commessa 2026-10-31-media-e-archiviazione, T8) ──
 *  Una bolla con un media del ponte (foto, vocale, video, documento) passa per questi aspetti,
 *  tutti alti almeno quanto un tasto (nessun salto quando cambiano):
 *   · verifica / nessuna riga / liberato: il testo di sempre («📷 Foto»), passato da fuori;
 *   · in arrivo: «Foto in arrivo» e «Ricontrolla»;
 *   · richiesto («Mostra»): «In arrivo dal telefono…»; dopo 90 s «Il Mac non ha risposto» + Riprova;
 *   · non disponibile: il motivo, con Riprova solo dove ha senso;
 *   · pronta: la foto (miniatura subito, poi la foto intera), il vocale col suo lettore, il video
 *     con miniatura e play, il documento come scheda.
 *  ⚠️ Niente HTML/SVG/XML inline, niente iframe/object/embed. Nome e didascalia sono nodi di testo.
 *  ⚠️ Nel DOM c'è solo ciò che è locale (`blob:`, miniatura `data:`). L'indirizzo firmato esiste solo
 *   per il video, assegnato per PROPRIETÀ (`video.src = …`), mai in un attributo scritto da React,
 *   mai in uno stato; la nuova firma all'errore riprende da `currentTime`.
 *  ⚠️ Pressione lunga: i tasti del media (play, scheda documento) portano `data-media-pl`; gli altri
 *   (Riprova, Ricontrolla) no e restano esclusi. Su iOS `select-none` e `-webkit-touch-callout:none`
 *   anche sulle immagini e sulla scheda. Niente `touch-action: none`: la chat deve scorrere. */

const ICONE: Record<Categoria, typeof ImageIcon> = {
  foto: ImageIcon,
  audio: Mic,
  video: VideoIcon,
  documento: FileText,
};
const NOME: Record<Categoria, string> = {
  foto: "Foto",
  audio: "Vocale",
  video: "Video",
  documento: "Documento",
};
const TASTO =
  "inline-flex min-h-11 items-center gap-2 rounded-md bg-black/[0.04] px-3 py-2 text-left font-medium";
/** iOS: niente menu «Salva immagine» né selezione sopra la pressione lunga. */
const SENZA_MENU =
  "select-none [-webkit-touch-callout:none] [-webkit-user-select:none] touch-manipulation";

/** Il riquadro di una foto o di un video: le dimensioni vere dalla riga, così nulla salta quando arriva il file. */
function riquadro(riga: RigaMedia, predefinito: number, larghezzaMax: number) {
  const l = riga.larghezza;
  const a = riga.altezza;
  const rapporto = l && a && l > 0 && a > 0 ? Math.min(2.5, Math.max(0.4, l / a)) : predefinito;
  return {
    width: Math.round(Math.min(larghezzaMax, 320 * rapporto)),
    aspectRatio: String(rapporto),
  };
}

const dataUrlMiniatura = (m: string) => `data:image/jpeg;base64,${m}`;

/** «Si elimina tra 1 h» sotto il media, se c'è un timer. */
function Scadenza({ riga }: { riga: RigaMedia }) {
  const frase = scadenzaInParole(riga.scade_il, Date.now());
  if (!frase) return null;
  return (
    <p className="mt-1 flex items-center gap-1 text-[11.5px] leading-4 text-[#54656f]">
      <Timer className="h-3 w-3 shrink-0" aria-hidden />
      {frase}
    </p>
  );
}

function Riprova({ onClick, etichetta = "Riprova" }: { onClick: () => void; etichetta?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className="min-h-11 gap-1.5 self-start bg-white/70 text-[13px]"
    >
      <RotateCcw className="h-4 w-4" aria-hidden />
      {etichetta}
    </Button>
  );
}

function Errore({ frase, onRiprova }: { frase: string; onRiprova?: () => void }) {
  return (
    <div role="status" className="flex flex-col items-start gap-1.5">
      <p className="flex items-start gap-1.5 text-[12.5px] leading-snug text-rose-800">
        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {frase}
      </p>
      {onRiprova && <Riprova onClick={onRiprova} />}
    </div>
  );
}

/** «In arrivo dal telefono…»; se il collegamento col telefono è fermo lo dice subito. */
function InArrivoDalTelefono({ onRiprova }: { onRiprova: () => void }) {
  const avviso = useStatoPonte();
  if (avviso.mostra && avviso.gravita === "grave")
    return (
      <Errore
        frase="Il collegamento con WhatsApp è fermo: controlla che il Mac sia acceso."
        onRiprova={onRiprova}
      />
    );
  return (
    <span role="status" aria-busy="true" className={cn(TASTO, "text-[#54656f]")}>
      <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
      In arrivo dal telefono…
    </span>
  );
}

// ── Foto ──────────────────────────────────────────────────────────────────

/** La foto nel suo riquadro (le dimensioni vere dalla riga: nulla salta quando arriva il file):
 *  prima la miniatura di WhatsApp, poi la foto intera da `blob:`; in errore la frase e Riprova. */
export function QuadroFoto({
  riga,
  stato,
  didascalia,
  inUscita,
  riprova,
  nonSiApre,
}: {
  riga: RigaMedia;
  stato: StatoBlob;
  didascalia: string;
  inUscita: boolean;
  riprova: () => void;
  nonSiApre: () => void;
}) {
  const sfondo = riga.miniatura ? dataUrlMiniatura(riga.miniatura) : null;
  const alt = inUscita ? "Foto inviata" : "Foto inviata dal cliente";
  return (
    <>
      <div
        style={riquadro(riga, 4 / 3, 288)}
        className={cn(
          "relative -mx-1.5 -mt-0.5 max-w-[calc(100%+0.75rem)] overflow-hidden rounded-md bg-black/[0.06]",
          SENZA_MENU,
        )}
      >
        {stato.fase === "vista" ? (
          <img
            src={stato.src}
            alt={alt}
            referrerPolicy="no-referrer"
            draggable={false}
            onError={nonSiApre}
            className={cn("h-full w-full object-cover", SENZA_MENU)}
          />
        ) : (
          sfondo && (
            <img
              src={sfondo}
              alt={alt}
              referrerPolicy="no-referrer"
              draggable={false}
              className={cn("h-full w-full scale-105 object-cover blur-[3px]", SENZA_MENU)}
            />
          )
        )}
        {stato.fase === "carico" && (
          <span
            role="status"
            aria-label="Carico la foto"
            className="absolute inset-0 grid place-items-center bg-black/10"
          >
            <Loader2 className="h-6 w-6 animate-spin text-white drop-shadow" aria-hidden />
          </span>
        )}
        {stato.fase === "errore" && (
          <div className="absolute inset-0 grid place-items-center bg-white/85 p-2">
            <Errore frase={stato.frase} onRiprova={stato.riprova ? riprova : undefined} />
          </div>
        )}
      </div>
      {didascalia && (
        <p className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          {didascalia}
        </p>
      )}
    </>
  );
}

function FotoPronta({
  riga,
  didascalia,
  inUscita,
  segnaPerso,
}: {
  riga: RigaMedia;
  didascalia: string;
  inUscita: boolean;
  segnaPerso: () => void;
}) {
  //  Automatico: la foto parte da sola (≤ 3 scarichi insieme, con cache); la bolla è già in vista.
  const b = useBlobMedia(riga.id, "foto", true, segnaPerso);
  return (
    <QuadroFoto
      riga={riga}
      stato={b.stato}
      didascalia={didascalia}
      inUscita={inUscita}
      riprova={() => void b.carica()}
      nonSiApre={b.nonSiApre}
    />
  );
}

// ── Video ─────────────────────────────────────────────────────────────────

function VideoPronto({
  riga,
  didascalia,
  segnaPerso,
}: {
  riga: RigaMedia;
  didascalia: string;
  segnaPerso: () => void;
}) {
  const [attivo, setAttivo] = useState(false);
  const [pronto, setPronto] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement | null>(null);
  const rifirmato = useRef(false);
  const id = riga.id;
  const sfondo = riga.miniatura ? dataUrlMiniatura(riga.miniatura) : undefined;

  /** Chiede l'indirizzo (30 minuti) e lo dà al video per proprietà; `da` = secondi da cui riprendere. */
  const carica = useCallback(
    async (da: number) => {
      const el = video.current;
      if (!el || !id) return;
      const u = await chiediUrl(id, "video", "video", { chiedi: fetchCRM });
      if (!u.ok) {
        if (u.perso) segnaPerso();
        setErrore(u.frase);
        setAttivo(false);
        return;
      }
      el.src = u.url;
      if (da > 0)
        el.addEventListener(
          "loadedmetadata",
          () => {
            el.currentTime = da;
          },
          { once: true },
        );
      void el.play().catch(() => undefined);
    },
    [id, segnaPerso],
  );

  useEffect(() => {
    if (attivo) void carica(0);
  }, [attivo, carica]);

  const riquadroVideo = riquadro(riga, 16 / 9, 288);
  const dati = [riga.durata_s ? tempoVocale(riga.durata_s) : "", formatoPeso(riga.byte)]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <div
        style={riquadroVideo}
        className={cn(
          "relative -mx-1.5 -mt-0.5 max-w-[calc(100%+0.75rem)] overflow-hidden rounded-md bg-black",
          SENZA_MENU,
        )}
      >
        {attivo ? (
          <>
            <video
              ref={video}
              controls
              playsInline
              preload="metadata"
              poster={sfondo}
              onLoadedMetadata={() => setPronto(true)}
              onError={(e) => {
                //  Un solo rinnovo dell'indirizzo (pausa lunga = link scaduto), poi si smette.
                if (!rifirmato.current) {
                  rifirmato.current = true;
                  void carica(e.currentTarget.currentTime);
                } else {
                  setErrore("Non riesco a riprodurre il video.");
                  setAttivo(false);
                }
              }}
              className="h-full w-full bg-black object-contain"
            />
            {!pronto && (
              <span
                role="status"
                aria-label="Carico il video"
                className="pointer-events-none absolute inset-0 grid place-items-center"
              >
                <Loader2 className="h-7 w-7 animate-spin text-white drop-shadow" aria-hidden />
              </span>
            )}
          </>
        ) : (
          <button
            type="button"
            data-media-pl
            onClick={() => {
              rifirmato.current = false;
              setErrore(null);
              setPronto(false);
              setAttivo(true);
            }}
            aria-label={`Guarda il video${dati ? ` (${dati})` : ""}`}
            className={cn(
              "group absolute inset-0 grid place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              SENZA_MENU,
            )}
          >
            {sfondo && (
              <img
                src={sfondo}
                alt=""
                draggable={false}
                className={cn("absolute inset-0 h-full w-full object-cover opacity-90", SENZA_MENU)}
              />
            )}
            <span className="relative grid h-12 w-12 place-items-center rounded-full bg-black/55 text-white transition-colors group-hover:bg-black/70">
              <Play className="ml-0.5 h-6 w-6 fill-current" aria-hidden />
            </span>
            {dati && (
              <span className="absolute bottom-1.5 left-1.5 rounded bg-black/55 px-1.5 text-[11px] leading-5 tabular-nums text-white">
                {dati}
              </span>
            )}
          </button>
        )}
      </div>
      {errore && (
        <div className="mt-1.5">
          <Errore frase={errore} />
        </div>
      )}
      {didascalia && (
        <p className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
          {didascalia}
        </p>
      )}
    </>
  );
}

// ── Documento ─────────────────────────────────────────────────────────────

const TIPI_DOCUMENTO: Record<string, string> = {
  pdf: "PDF",
  docx: "Word",
  xlsx: "Excel",
  pptx: "PowerPoint",
};
const estensione = (s: string | null) =>
  /\.([a-z0-9]{2,5})$/i.exec(s ?? "")?.[1]?.toLowerCase() ?? "";

function DocumentoPronto({ riga }: { riga: RigaMedia }) {
  const [stato, setStato] = useState<"idle" | "carico" | { errore: string }>("idle");
  const tipo =
    TIPI_DOCUMENTO[estensione(riga.nome)] ?? TIPI_DOCUMENTO[estensione(riga.id)] ?? "Documento";
  const riga2 = [tipo, formatoPeso(riga.byte)].filter(Boolean).join(" · ");
  const apri = () => {
    if (!riga.id || stato === "carico") return;
    setStato("carico");
    //  `window.open` parte DENTRO questo gesto (prima di ogni attesa): vedi `apriFuori`.
    void apriFuori(riga.id, "documento").then((e) => setStato(e.ok ? "idle" : { errore: e.frase }));
  };
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        data-media-pl
        onClick={apri}
        aria-busy={stato === "carico"}
        className={cn(
          "-mx-1.5 -mt-0.5 flex min-h-14 w-64 max-w-[calc(100%+0.75rem)] items-center gap-2.5 rounded-md bg-black/[0.05] p-2 text-left hover:bg-black/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          SENZA_MENU,
        )}
      >
        {riga.miniatura ? (
          <img
            src={dataUrlMiniatura(riga.miniatura)}
            alt=""
            draggable={false}
            className={cn("h-11 w-9 shrink-0 rounded-sm bg-white object-cover", SENZA_MENU)}
          />
        ) : (
          <span className="grid h-11 w-9 shrink-0 place-items-center rounded-sm bg-white/70 text-[#54656f]">
            {stato === "carico" ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <FileText className="h-5 w-5" aria-hidden />
            )}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 break-words text-[14px] font-medium leading-[18px] [overflow-wrap:anywhere]">
            {riga.nome ?? "Documento"}
          </span>
          <span className="mt-0.5 block text-[12px] leading-4 text-[#54656f]">{riga2}</span>
        </span>
      </button>
      {typeof stato === "object" && <Errore frase={stato.errore} />}
    </div>
  );
}

// ── Vocale ────────────────────────────────────────────────────────────────

/** Ciò che il lettore del vocale (in BollaMessaggio) riceve per un vocale del ponte. */
export interface PropsVocalePonte {
  mime: string;
  /** Il nome del file: dà la forma d'onda (un `blob:` non ha estensione né seme). */
  seme: string;
  durataIniziale: number | null;
  /** Scarica il vocale (al primo play) e dà la `blob:` locale; `null` se non riesce. */
  preparaUrl: () => Promise<string | null>;
  /** Se il browser non sa suonarlo: «Scarica il vocale» in una nuova scheda. */
  scarica: () => void;
}

const MIME_PER_ESTENSIONE: Record<string, string> = {
  ogg: "audio/ogg; codecs=opus",
  oga: "audio/ogg; codecs=opus",
  opus: "audio/ogg; codecs=opus",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  mp3: "audio/mpeg",
  mpeg: "audio/mpeg",
  aac: "audio/aac",
  amr: "audio/amr",
};

function VocalePronto({
  riga,
  vocale,
  segnaPerso,
}: {
  riga: RigaMedia;
  vocale: (p: PropsVocalePonte) => ReactNode;
  segnaPerso: () => void;
}) {
  const b = useBlobMedia(riga.id, "audio", false, segnaPerso);
  const id = riga.id ?? "";
  return (
    <>
      {vocale({
        mime: MIME_PER_ESTENSIONE[estensione(id)] ?? "audio/ogg; codecs=opus",
        seme: id,
        durataIniziale: riga.durata_s,
        preparaUrl: b.carica,
        scarica: () => void apriFuori(id, "audio"),
      })}
    </>
  );
}

// ── La bolla ──────────────────────────────────────────────────────────────

export interface PropsVistaMedia {
  media: MediaDelPonte;
  g: Pick<GanciMedia, "fase" | "riga" | "richiedi" | "ricontrolla" | "segnaPerso">;
  /** Il testo di sempre («📷 Foto»), già disegnato con l'ora accanto, per le fasi senza file. */
  segnaposto: ReactNode;
  inUscita: boolean;
  /** Il lettore dei vocali di `BollaMessaggio` (non si copia). */
  vocale: (p: PropsVocalePonte) => ReactNode;
}

/** Il media di una bolla, nella fase in cui si trova. */
export function VistaMediaPonte({ media, g, segnaposto, inUscita, vocale }: PropsVistaMedia) {
  const { categoria } = media;
  const Icona = ICONE[categoria];
  const f = g.fase;
  switch (f.fase) {
    case "verifica":
    case "nessuna":
      return <>{segnaposto}</>;
    case "in_arrivo":
      return (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex min-h-11 items-center gap-2 font-medium text-[#54656f]">
            <Icona className="h-4 w-4 shrink-0" aria-hidden />
            {NOME[categoria]} in arrivo
          </span>
          <Button
            type="button"
            variant="ghost"
            onClick={g.ricontrolla}
            className="min-h-11 gap-1.5 px-2 text-[13px]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Ricontrolla
          </Button>
        </div>
      );
    case "richiesto":
      return <InArrivoDalTelefono onRiprova={() => void g.richiedi()} />;
    case "senza_risposta":
      return <Errore frase="Il Mac non ha risposto." onRiprova={() => void g.richiedi()} />;
    case "non_disponibile":
      return <Errore frase={f.frase} onRiprova={f.riprova ? () => void g.richiedi() : undefined} />;
    case "pronta": {
      const riga = g.riga;
      if (!riga?.id) return <>{segnaposto}</>; // percorso illeggibile: il testo di sempre
      return (
        <>
          {categoria === "foto" ? (
            <FotoPronta
              riga={riga}
              didascalia={media.didascalia}
              inUscita={inUscita}
              segnaPerso={g.segnaPerso}
            />
          ) : categoria === "audio" ? (
            <VocalePronto riga={riga} vocale={vocale} segnaPerso={g.segnaPerso} />
          ) : categoria === "video" ? (
            <VideoPronto riga={riga} didascalia={media.didascalia} segnaPerso={g.segnaPerso} />
          ) : (
            <DocumentoPronto riga={riga} />
          )}
          <Scadenza riga={riga} />
        </>
      );
    }
  }
}
