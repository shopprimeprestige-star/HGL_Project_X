/** ── CLIP MUTE IN LOOP, SOLO SE A SCHERMO ───────────────────────────────────
 *  Un gruppo di clip che partono e si fermano INSIEME quando il gruppo è almeno al 60% a schermo
 *  (la coppia del confronto, le quattro della vita di ogni giorno). Fino alla partenza si vede il
 *  primo fotogramma. Con `prefers-reduced-motion` o risparmio dati non partono mai: restano ferme
 *  e compaiono i comandi nativi per riprodurle a mano. */
import { useEffect, useRef, useState } from "react";

export type Clip = { src: string; alt: string; sopra?: React.ReactNode; sotto?: React.ReactNode };

type Props = {
  clips: Clip[];
  /** classi del contenitore (griglia o fila a scorrimento) */
  className?: string;
  /** classi di ogni clip (larghezza, aggancio) */
  classeClip?: string;
  /** nome del gruppo per i lettori di schermo */
  nome: string;
  /** il contenitore scorre di lato: serve la tastiera */
  scorre?: boolean;
};

export function ClipLoop({ clips, className = "", classeClip = "", nome, scorre = false }: Props) {
  const gruppo = useRef<HTMLDivElement>(null);
  const [fermo, setFermo] = useState(false);

  useEffect(() => {
    const el = gruppo.current;
    if (!el) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || conn?.saveData) {
      setFermo(true);
      return;
    }
    const video = () => Array.from(el.querySelectorAll("video"));
    const oss = new IntersectionObserver(
      ([v]) => {
        if (v.intersectionRatio >= 0.6) video().forEach((x) => void x.play().catch(() => {}));
        else video().forEach((x) => x.pause());
      },
      { threshold: [0, 0.6] },
    );
    oss.observe(el);
    return () => oss.disconnect();
  }, []);

  return (
    <div ref={gruppo} role="group" aria-label={nome} tabIndex={scorre ? 0 : undefined} className={className}>
      {clips.map((c, i) => (
        <figure key={i} className={classeClip}>
          {c.sopra}
          <video src={c.src} poster={c.src.startsWith("data:image") ? c.src : undefined} muted loop playsInline preload="metadata" controls={fermo} aria-label={c.alt} className="aspect-[3/4] w-full rounded-md bg-blueprint-fine object-cover" />
          {c.sotto}
        </figure>
      ))}
    </div>
  );
}
