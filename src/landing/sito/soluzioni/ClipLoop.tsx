/** La clip della macro (4.3, «La clip della macro»): muta, in loop, e solo mentre si vede.
 *  - `muted loop playsInline preload="none"`, nessuna traccia audio nel file;
 *  - il file si dà al `<video>` quando la clip è a 200 px dallo schermo; parte a ≥ 50% a schermo e si ferma fuori;
 *  - il tasto play/pausa è sempre visibile, 44 px (WCAG 2.2.2); la scelta di chi tocca vince sul resto;
 *  - con «riduci movimento» non parte: si vede la copertina e il tasto dice «Fai partire il video»;
 *  - il `<video>` è `aria-hidden`: la descrizione sta in testo nascosto, la didascalia in `<figcaption>`. */
import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import type { SlotFoto } from "./Foto";
import { usaMovimentoRidotto } from "./movimento";

export function ClipLoop({
  slot,
  formato,
  descrizione,
  didascalia,
  etichette,
}: {
  slot: SlotFoto;
  formato: "4:5";
  descrizione: string;
  didascalia: string;
  /** ferma: il tasto mentre la clip gira («Metti in pausa il video») · riparti: il tasto da ferma («Fai partire il video») */
  etichette: { ferma: string; riparti: string };
}) {
  const ridotto = usaMovimentoRidotto();
  const riquadro = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [vicina, setVicina] = useState(false);
  const [gira, setGira] = useState(false);
  //  Cosa ha deciso chi guarda: "play" · "pausa" · null (decide la pagina). Un ref: non serve ridisegnare.
  const volonta = useRef<"play" | "pausa" | null>(null);
  const aSchermo = useRef(false);

  const dovrebbeGirare = () => volonta.current === "play" || (volonta.current === null && !ridotto);

  function sincronizza() {
    const v = video.current;
    if (!v || !vicina) return;
    if (aSchermo.current && dovrebbeGirare()) v.play().catch(() => {});
    else v.pause();
  }

  //  A 200 px dallo schermo il file viene dato al <video>.
  useEffect(() => {
    const el = riquadro.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const o = new IntersectionObserver(
      (voci) => {
        if (voci.some((x) => x.isIntersecting)) setVicina(true);
      },
      { rootMargin: "200px 0px" },
    );
    o.observe(el);
    return () => o.disconnect();
  }, []);

  //  Parte a ≥ 50% a schermo e si ferma quando esce.
  useEffect(() => {
    const el = riquadro.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const o = new IntersectionObserver(
      (voci) => {
        aSchermo.current = voci.some((x) => x.isIntersecting);
        sincronizza();
      },
      { threshold: 0.5 },
    );
    o.observe(el);
    return () => o.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vicina, ridotto]);

  function tocca() {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      volonta.current = "play";
      setVicina(true);
      v.play().catch(() => {});
    } else {
      volonta.current = "pausa";
      v.pause();
    }
  }

  return (
    <figure className="sol-clip-figura">
      <div ref={riquadro} className="sol-clip" style={{ aspectRatio: formato.replace(":", " / ") }}>
        <video
          ref={video}
          {...(vicina ? { src: slot.src } : {})}
          poster={slot.poster}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
          tabIndex={-1}
          className="sol-video-file"
          onPlay={() => setGira(true)}
          onPause={() => setGira(false)}
        />
        <button
          type="button"
          className="sol-media-tasto"
          aria-label={gira ? etichette.ferma : etichette.riparti}
          onClick={tocca}
        >
          {gira ? (
            <Pause aria-hidden="true" fill="currentColor" strokeWidth={0} />
          ) : (
            <Play aria-hidden="true" fill="currentColor" strokeWidth={0} />
          )}
        </button>
      </div>
      <span className="sr-only">{descrizione}</span>
      <figcaption className="sol-didascalia">{didascalia}</figcaption>
    </figure>
  );
}
