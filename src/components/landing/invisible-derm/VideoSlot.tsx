/** ── VIDEO CON COPERTINA: SI SCARICA SOLO AL TOCCO ──────────────────────────
 *  Prima del tocco c'è la copertina (`poster`, se c'è) con il titolo e il tasto Play;
 *  al tocco parte il video con i comandi nativi. Mai `autoplay` senza un tocco,
 *  e il file non si scarica prima (`preload="none"`). `muto` per test, posa e studio.
 *  Senza file non disegna niente. */
import { useState } from "react";
import { Play } from "lucide-react";

type Props = {
  src: string;
  poster?: string;
  /** descrizione per chi non vede (nome del tasto e del video) */
  alt: string;
  /** scritta vera sopra la copertina */
  titolo?: string;
  muto?: boolean;
  /** classi Tailwind della proporzione e della larghezza */
  className?: string;
};

export function VideoSlot({ src, poster, alt, titolo, muto = false, className = "aspect-[4/5]" }: Props) {
  const [avviato, setAvviato] = useState(false);
  if (!src) return null;
  return (
    <div className={`relative w-full overflow-hidden rounded-md bg-blueprint-fine ${className}`}>
      {avviato ? (
        <video src={src} poster={poster || undefined} controls autoPlay playsInline muted={muto} aria-label={alt} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <>
          {poster && <img src={poster} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />}
          <button
            type="button"
            onClick={() => setAvviato(true)}
            aria-label={`Guarda il video: ${titolo || alt}`}
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#081634]/40 px-4 text-center text-white focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-scuro">
              <Play className="h-7 w-7 translate-x-0.5" fill="currentColor" aria-hidden="true" />
            </span>
            {titolo && <span className="rounded-md bg-[#081634]/90 px-3 py-1.5 text-base font-semibold">{titolo}</span>}
          </button>
        </>
      )}
    </div>
  );
}
