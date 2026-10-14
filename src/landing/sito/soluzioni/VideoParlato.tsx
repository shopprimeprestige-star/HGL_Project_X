/** Il video del titolare nella spiegazione di Invisible Derm (4.3, «Il video del titolare»).
 *  - Mai autoplay: `preload="none"`, il primo tocco carica e avvia CON l'AUDIO (`playsInline`), poi compaiono i controlli nativi.
 *  - La copertina è UN solo `<button>` con l'etichetta del play; la pillola sta in basso a sinistra, mai sul volto,
 *    ed è HTML (non è nell'immagine). Alla fine il video torna alla copertina con «Riguarda».
 *  - Mentre gira la barra delle patch si fa da parte (`segnaVideo`); in pausa o alla fine torna.
 *  - La trascrizione (se c'è) è un `<details>`; è testo, React lo scrive già pulito. */
import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import { segnaVideo } from "./stato-pagina";
import { traccia } from "@/landing/sito/traccia";
import { Foto, type SlotFoto } from "./Foto";

export interface TestiVideoParlato {
  /** «Te lo spiego in 30 secondi» */
  pillola: string;
  /** «Riguarda» */
  riguarda: string;
  /** Etichetta del tasto play per i lettori di schermo */
  etichettaPlay: string;
  /** «Leggi il testo del video» */
  leggiTesto: string;
}

//  shortcut: i nomi degli eventi nuovi (`invisible_video_*`) entrano in `NomeEventoSito` con S1; finché S1 non è
//  unita il tipo non li conosce, e a runtime `traccia` scarta in silenzio i nomi fuori lista. Si toglie il cast dopo l'unione.
const spedisci = traccia as (nome: string, dettagli?: Record<string, unknown>) => void;
const VOCE = { voce: "invisibleVideo" } as const;

export function VideoParlato({
  slot,
  formato,
  testi,
  trascrizione,
  priorita = "pigra",
}: {
  slot: SlotFoto;
  formato: "4:5";
  testi: TestiVideoParlato;
  trascrizione: string | null;
  priorita?: "alta" | "subito" | "pigra";
}) {
  const rif = useRef<HTMLVideoElement>(null);
  const copertina = useRef<HTMLButtonElement>(null);
  //  Il fuoco segue il gesto: se era sulla copertina passa al video, e alla fine torna alla copertina (non va mai perso nel body).
  const riportaFuoco = useRef(false);
  //  copertina: si vede la poster · avvio: tocco fatto, il primo fotogramma non c'è ancora (la copertina resta, così non c'è un vuoto)
  //  · in-corso: video con controlli nativi · fine: di nuovo la copertina, con «Riguarda»
  const [fase, setFase] = useState<"copertina" | "avvio" | "in-corso" | "fine">("copertina");
  const visto = useRef({ play: false, meta: false });

  useEffect(() => {
    if (fase === "fine" && riportaFuoco.current) {
      riportaFuoco.current = false;
      copertina.current?.focus();
    }
  }, [fase]);

  //  Se la pagina cambia mentre il video gira, la barra non deve restare nascosta.
  useEffect(() => () => segnaVideo(false), []);

  function avvia() {
    const v = rif.current;
    if (!v) return;
    setFase("avvio");
    //  Dentro il gesto del tocco: Safari su iPhone vuole `play()` qui, non in un effetto.
    const promessa = v.play();
    if (promessa) {
      promessa.catch(() => {
        setFase("copertina");
        segnaVideo(false);
      });
    }
  }

  function alPlay() {
    segnaVideo(true);
    if (visto.current.play) return;
    visto.current.play = true;
    spedisci("invisible_video_play");
    spedisci("video_play", VOCE);
  }

  function alPlaying() {
    //  La copertina sta per sparire: se ha il fuoco, lo si dà al video prima che si smonti.
    if (copertina.current && document.activeElement === copertina.current)
      rif.current?.focus({ preventScroll: true });
    setFase("in-corso");
  }

  function alTempo() {
    const v = rif.current;
    if (!v || visto.current.meta || !v.duration || v.currentTime / v.duration < 0.5) return;
    visto.current.meta = true;
    spedisci("invisible_video_50");
    spedisci("video_50", VOCE);
  }

  function allaFine() {
    segnaVideo(false);
    spedisci("video_fine", VOCE);
    const v = rif.current;
    riportaFuoco.current = !!v && document.activeElement === v;
    if (v) v.currentTime = 0;
    setFase("fine");
  }

  const testo = trascrizione?.trim() ?? "";
  const copertinaVisibile = fase !== "in-corso";
  return (
    <div>
      <div className="sol-video" style={{ aspectRatio: formato.replace(":", " / ") }}>
        <video
          ref={rif}
          src={slot.src}
          preload="none"
          playsInline
          tabIndex={-1}
          controls={fase === "in-corso"}
          className="sol-video-file"
          onPlay={alPlay}
          onPlaying={alPlaying}
          onPause={() => segnaVideo(false)}
          onTimeUpdate={alTempo}
          onEnded={allaFine}
        />
        {copertinaVisibile && (
          <button
            ref={copertina}
            type="button"
            className="sol-copertina"
            aria-label={testi.etichettaPlay}
            onClick={avvia}
          >
            <Foto
              slot={{ src: slot.poster, poster: "", alt: slot.alt }}
              formato={formato}
              larghezza={481}
              altezza={601}
              priorita={priorita}
              className="sol-copertina-foto"
            />
            <span className="sol-pillola">
              <span className="sol-pillola-play" aria-hidden="true">
                <Play className="sol-pillola-triangolo" fill="currentColor" strokeWidth={0} />
              </span>
              <span>{fase === "fine" ? testi.riguarda : testi.pillola}</span>
            </span>
          </button>
        )}
      </div>
      {testo && (
        <details className="sol-trascrizione">
          <summary className="sol-link">{testi.leggiTesto}</summary>
          <p className="sol-testo sol-trascrizione-testo">{testo}</p>
        </details>
      )}
    </div>
  );
}
