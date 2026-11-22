/** ── FotoShop · VETRINA V1 · T74 ─────────────────────────────────────────────
 *  L'unico modo di disegnare una foto nello shop nuovo (D98): `<img>` con `alt`, `width`, `height`, `srcset`/`sizes` quando le
 *  misure sono tre, `lazy` salvo la `prima`. Le regole stanno in `src/shop/cms/vetrina-foto.ts` (provate senza browser).
 *  Lo sfondo mentre la foto arriva è `brand-velo-10`, mai grigio; se non carica resta visibile l'`alt` dentro il riquadro.
 *  Senza foto non disegna niente (`nascondiSeVuoto`, di norma): nessun riquadro per un media vuoto (SPEC 4.3). */
import { attributiImg, USI, type DatiFoto } from "@/shop/cms/vetrina-foto";

type Props = Omit<DatiFoto, "sviluppo"> & {
  /** Senza foto: `true` (di norma) niente nodo; `false` il solo riquadro di sfondo, per tenere il posto. */
  nascondiSeVuoto?: boolean;
  /** Classi del riquadro (larghezza, angoli: `rounded-full` per il ritratto…). */
  className?: string;
};

export function FotoShop({ nascondiSeVuoto = true, className = "", ...dati }: Props) {
  // In produzione un `alt` mancante non rompe la pagina (alt=""); in sviluppo lancia.
  const img = attributiImg({ ...dati, sviluppo: !import.meta.env.PROD });
  if (!img && nascondiSeVuoto) return null;
  const [a, b] = USI[dati.uso].prop;
  return (
    <span
      className={`relative block overflow-hidden bg-[var(--brand-velo-10)] ${className}`}
      style={{ aspectRatio: `${a} / ${b}` }}
      aria-hidden={img ? undefined : true}
    >
      {img && <img {...img} className="absolute inset-0 h-full w-full object-cover" />}
    </span>
  );
}
