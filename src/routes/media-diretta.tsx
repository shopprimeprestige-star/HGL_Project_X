/** ── /media-diretta?sess=CODICE — I MEDIA, COME LI STA MOSTRANDO IL CONSULENTE
 *
 *  Richiesta del committente: «crea la scheda media come è creata quella del
 *  preventivo, che posso controllarla da remoto con un link e scorrere il
 *  carosello al cliente; aggiungi un link solo per i media che posso
 *  condividere, come se stesse dentro».
 *
 *  ── LE TRE PAGINE DEI MEDIA, E PERCHÉ SONO TRE ───────────────────────────
 *   · `/presenta` è la postazione del consulente: la libreria, la scelta, lo
 *     zoom, il puntatore. Da lì si comanda.
 *   · `/media/CODICE` è la raccolta STATICA: nessuna consulenza dietro, il
 *     cliente la guarda quando vuole, anche fra tre giorni.
 *   · questa è la terza cosa, e mancava: la raccolta GUIDATA. Il cliente apre
 *     il link e vede quello che il consulente sta mostrando in questo momento —
 *     la foto che ha scelto, lo zoom che ha fatto, il dito che indica un
 *     dettaglio — senza videochiamata, senza camera, senza microfono, senza
 *     dover entrare in nessuna stanza. È il gemello del «link solo preventivo»,
 *     con la stessa forma (`?client=1&sess=CODICE`) e la stessa promessa: come
 *     se fosse qui accanto, ma solo per i media.
 *
 *  ── ⚠️ QUI NON SI COMANDA NIENTE, ED È IL PUNTO ──────────────────────────
 *  Nessun pulsante avanti/indietro, nessun controllo sul video: il carosello lo
 *  scorre il consulente. Due telecomandi sullo stesso schermo vogliono dire un
 *  cliente che cambia foto mentre il consulente sta spiegando quella di prima —
 *  cioè due consulenze diverse nello stesso momento.
 *  L'unica cosa che il cliente può fare è accendere l'audio, e solo perché il
 *  browser non lo lascia partire da solo (vedi sotto).
 *
 *  ⚠️ LO STATO SI CHIEDE ENTRANDO (`vhello`). Chi apre il link a metà
 *   consulenza non deve aspettare che il consulente cambi foto per vedere
 *   qualcosa: appena il canale è pronto si chiede cosa c'è in mostra, e la
 *   postazione risponde con il media, il tempo del video e lo zoom.
 *  ⚠️ IL PROTOCOLLO È QUELLO DI `/presenta`, non uno nuovo: stesso canale
 *   (`qvid-<codice>`) e stessi tre annunci (`video`, `mediazoom`, `pointer`).
 *   Inventarne un secondo vorrebbe dire una postazione che parla una lingua e
 *   una pagina che ne ascolta un'altra, e il giorno in cui una delle due cambia
 *   non se ne accorge nessuno finché non c'è un cliente davanti.
 *  ───────────────────────────────────────────────────────────────────────── */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandLogo } from "@/shop/BrandLogo";
import { MarchioSuMedia } from "@/media/marchio";
import { conPrimoFotogramma } from "@/media/galleria";
//  ⚠️ Questo link non mostra più soltanto i media: se il consulente passa al
//   preventivo, il cliente ci va dietro. La regola sta in un file suo e si
//   prova (vedi proveDelLinkCheSegue).
import { deveAndareSu } from "@/shop/segue-contenuto";
import { CameraDelConsulente } from "@/shop/CameraDelConsulente";

export const Route = createFileRoute("/media-diretta")({
  head: () => ({
    meta: [
      { title: "Te li mostro io — Hair Genius Labs" },
      {
        name: "description",
        content: "Le foto e i video della consulenza, mentre te li mostro.",
      },
      //  Un link personale mandato a una persona sola: non deve finire in un
      //  motore di ricerca. Stessa scelta della raccolta statica.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MediaDiretta,
});

type Genere = "image" | "video";

/** Quello che arriva dalla postazione a ogni annuncio. */
interface StatoMedia {
  url: string;
  kind: Genere;
  time: number;
  playing: boolean;
  rate: number;
  /** L'audio del video lo decide il consulente, non il cliente. */
  gaudio: boolean;
}

const VUOTO: StatoMedia = { url: "", kind: "image", time: 0, playing: false, rate: 1, gaudio: true };

function MediaDiretta() {
  const sess =
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("sess") || "").trim()
      : "";

  const [media, setMedia] = useState<StatoMedia>(VUOTO);
  const [zoom, setZoom] = useState({ scale: 1, tx: 0, ty: 0 });
  const [ptr, setPtr] = useState({ x: 0.5, y: 0.5, on: false });
  /** ── ⚠️ L'AUDIO NON PARTE DA SOLO, E NON È UN NOSTRO DIFETTO ───────────
   *  Il browser vieta la riproduzione con audio finché la persona non ha
   *  toccato la pagina: un video che parte muto senza dirlo sembra rotto, e il
   *  cliente pensa che la voce del consulente non arrivi. Quindi lo si dice, e
   *  si dà un pulsante — l'unico di questa pagina. */
  const [audioSbloccato, setAudioSbloccato] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const navigate = useNavigate();
  //  Il media in mostra letto da un riferimento: i gestori del canale nascono
  //  una volta sola e una variabile di stato catturata lì resterebbe ferma al
  //  primo disegno — ogni annuncio verrebbe trattato come «media nuovo» e la
  //  sincronizzazione del tempo del video ripartirebbe da capo.
  const oraRef = useRef<{ url: string; kind: Genere }>({ url: "", kind: "image" });
  oraRef.current = { url: media.url, kind: media.kind };
  const applicandoRef = useRef(false);

  /** Porta il video dove sta quello del consulente. Stesse regole della
   *  postazione: si salta solo su scarti evidenti, altrimenti le correzioni
   *  continue si vedono come scatti. */
  const sincronizza = (s: StatoMedia) => {
    const v = videoRef.current;
    if (!v) return;
    applicandoRef.current = true;
    if (Number.isFinite(s.rate) && s.rate > 0) v.playbackRate = s.rate;
    //  In riproduzione la posizione vera del consulente è un filo più avanti di
    //  quella annunciata: il tempo del viaggio.
    const t = (Number(s.time) || 0) + (s.playing ? 0.25 : 0);
    if (Math.abs(v.currentTime - t) > 1.2) {
      try {
        v.currentTime = t;
      } catch {
        /* il video non è ancora pronto: al prossimo annuncio */
      }
    }
    if (s.playing && v.paused) void v.play().catch(() => setAudioSbloccato(false));
    if (!s.playing && !v.paused) v.pause();
    applicandoRef.current = false;
  };

  useEffect(() => {
    if (!sess) return;
    const ch = supabase.channel(`qvid-${sess}`, { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "video" }, ({ payload }) => {
      const p = payload as Partial<StatoMedia>;
      const url = String(p.url || "");
      const kind: Genere = p.kind === "image" ? "image" : "video";
      const s: StatoMedia = {
        url,
        kind,
        time: Number(p.time) || 0,
        playing: !!p.playing,
        rate: Number(p.rate) || 1,
        gaudio: p.gaudio !== false,
      };
      const c = oraRef.current;
      //  Media nuovo: si cambia e basta, il tempo riparte con lui.
      if (url !== c.url || kind !== c.kind) {
        oraRef.current = { url, kind };
        setMedia(s);
        return;
      }
      setMedia(s);
      if (kind === "video") sincronizza(s);
    });
    ch.on("broadcast", { event: "mediazoom" }, ({ payload }) => {
      const p = payload as { scale?: number; tx?: number; ty?: number };
      setZoom({ scale: Number(p.scale) || 1, tx: Number(p.tx) || 0, ty: Number(p.ty) || 0 });
    });
    ch.on("broadcast", { event: "pointer" }, ({ payload }) => {
      const p = payload as { x?: number; y?: number; on?: boolean };
      setPtr({ x: Number(p.x) || 0, y: Number(p.y) || 0, on: !!p.on });
    });
    //  ⚠️ Appena il canale è pronto si CHIEDE cosa c'è in mostra: chi apre il
    //   link a metà consulenza non deve restare davanti a una schermata
    //   d'attesa finché il consulente non cambia foto.
    ch.subscribe((s) => {
      if (s === "SUBSCRIBED") ch.send({ type: "broadcast", event: "vhello", payload: {} });
    });
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sess]);

  /** ── ⚠️ E SE IL CONSULENTE PASSA AL PREVENTIVO ────────────────────────
   *  Richiesta del committente: «se sto condividendo solo il link dei media e
   *  clicco su preventivo, deve mostrare il preventivo».
   *  Prima questo link era una stanza sola: il cliente restava sulla foto
   *  mentre il consulente parlava del prezzo, e non se ne accorgeva nessuno
   *  dei due. Adesso si guarda la schermata registrata dalla postazione e, se
   *  è il preventivo, si va di là — portandosi dietro `client=1&sess=`, cioè
   *  restando lo stesso link e la stessa promessa: niente camera, niente
   *  microfono, nessuna stanza in cui entrare.
   *  ⚠️ Navigazione dentro l'applicazione, mai `window.location`: un
   *   ricaricamento vero butterebbe via il canale appena sottoscritto, e la
   *   pagina di là si ritroverebbe a ricominciare da capo. */
  useEffect(() => {
    if (!sess) return;
    let fermo = false;
    const guarda = () => {
      fetch(`/api/presenter/curpage?sess=${encodeURIComponent(sess)}`)
        .then((r) => r.json())
        .then((j) => {
          if (fermo) return;
          const dove = deveAndareSu(String(j?.path ?? ""), window.location.pathname);
          if (!dove) return;
          console.log("[MEDIA] il consulente è passato a", dove);
          //  ⚠️ `client` va passato come NUMERO: l'indirizzo lo scrive il
          //   router, e una stringa «1» gliela riscrive fra virgolette
          //   (`client=%221%22`) per non perderne il tipo. Il cliente
          //   arriverebbe con un parametro che non combacia, la pagina non lo
          //   riconoscerebbe più come cliente e gli si aprirebbe la schermata
          //   del consulente.
          void navigate({ to: dove, search: { client: 1, sess } as never });
        })
        .catch(() => { /* rete assente: si resta dove si è */ });
    };
    guarda();
    const iv = setInterval(guarda, 1500);
    return () => { fermo = true; clearInterval(iv); };
  }, [sess, navigate]);

  //  Quando arriva un video nuovo si riparte dal punto in cui è il consulente.
  useEffect(() => {
    if (media.kind === "video" && media.url) sincronizza(media);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.url]);

  const muto = !media.gaudio || !audioSbloccato;

  return (
    <div className="flex min-h-screen flex-col bg-[#050f24] text-white">
      <header className="flex items-center justify-between px-4 py-3">
        <BrandLogo className="h-6 w-auto" />
        {/*  Il pallino dice che non è una pagina ferma: quello che si vede lo
            sta scegliendo una persona, adesso. */}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Te li sto mostrando io
        </span>
      </header>

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-3 pb-4">
        {!sess ? (
          <Attesa
            titolo="Questo link non è completo"
            testo="Manca il codice della consulenza. Chiedi al tuo consulente di rimandartelo: il link giusto apre le foto senza chiedere nulla."
          />
        ) : !media.url ? (
          <Attesa
            titolo="Ci siamo quasi"
            testo="Appena il consulente apre la prima foto, la vedi qui. Resta pure su questa pagina."
          />
        ) : (
          <div className="relative h-full max-h-[78vh] w-full max-w-5xl">
            {/*  ⚠️ LO ZOOM È QUELLO DEL CONSULENTE: la stessa trasformazione
                che sta applicando lui sul suo schermo. Se il cliente potesse
                farne una sua, i due guarderebbero due punti diversi della
                stessa foto mentre uno dei due dice «qui». */}
            <div
              className="h-full w-full overflow-hidden rounded-2xl border border-white/10 bg-black"
              style={{ touchAction: "none" }}
            >
              <div
                className="h-full w-full transition-transform duration-150"
                style={{
                  transform: `translate(${zoom.tx}px, ${zoom.ty}px) scale(${zoom.scale})`,
                }}
              >
                {media.kind === "image" ? (
                  <img
                    src={media.url}
                    alt=""
                    className="h-full w-full object-contain"
                    draggable={false}
                  />
                ) : (
                  <video
                    ref={videoRef}
                    src={media.url}
                    poster={conPrimoFotogramma(media.url)}
                    playsInline
                    muted={muto}
                    //  Niente `controls`: il video lo comanda il consulente.
                    className="h-full w-full object-contain"
                    onPlay={() => {
                      if (!applicandoRef.current && !media.playing) videoRef.current?.pause();
                    }}
                  />
                )}
              </div>
            </div>
            <MarchioSuMedia />
            {/*  Il dito del consulente: indica un dettaglio mentre parla. */}
            {ptr.on && (
              <span
                className="pointer-events-none absolute z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand/70 shadow-lg"
                style={{ left: `${ptr.x * 100}%`, top: `${ptr.y * 100}%` }}
              />
            )}
            {media.kind === "video" && media.gaudio && !audioSbloccato && (
              <button
                type="button"
                onClick={() => {
                  setAudioSbloccato(true);
                  const v = videoRef.current;
                  if (v) {
                    v.muted = false;
                    void v.play().catch(() => {
                      /* resta muto: il consulente lo sente dire */
                    });
                  }
                }}
                className="absolute bottom-3 left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-black/70 px-4 py-2 text-[13px] font-medium text-white backdrop-blur"
              >
                <VolumeX className="h-4 w-4" /> Tocca per sentire l'audio
              </button>
            )}
            {media.kind === "video" && media.gaudio && audioSbloccato && (
              <span className="absolute bottom-3 left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-[11.5px] text-white/70">
                <Volume2 className="h-3.5 w-3.5" /> Audio acceso
              </span>
            )}
          </div>
        )}
      </main>

      {/*  ── LA FACCIA DEL CONSULENTE, SE LA ACCENDE ─────────────────────────
          Sta fuori dal <main> di proposito: non è uno dei media, è la persona
          che li sta mostrando. Compare solo quando il consulente accende la
          camera e sparisce quando la spegne; al cliente non viene chiesto
          niente — né camera, né microfono — ed è il motivo per cui questo link
          esiste (vedi shop/camera-link). */}
      <CameraDelConsulente sess={sess} />
    </div>
  );
}

function Attesa({ titolo, testo }: { titolo: string; testo: string }) {
  return (
    <div className="mx-auto max-w-sm text-center">
      <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-brand" />
      <p className="text-base font-semibold">{titolo}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-white/55">{testo}</p>
    </div>
  );
}
