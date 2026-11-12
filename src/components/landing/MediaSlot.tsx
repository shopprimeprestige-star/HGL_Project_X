import { PlaceholderBox } from "./PlaceholderBox";

type Props = {
  src: string;
  type: "image" | "video";
  alt?: string;
  caption?: string;
  light?: boolean;
  className?: string;
  // Opzioni per le pagine senza segnaposto (default = comportamento della home).
  /** true = senza file non disegna niente (invece del riquadro grigio). */
  nascondiSeVuoto?: boolean;
  /** Classe Tailwind della proporzione (es. "aspect-[4/5]") al posto del min-h fisso. */
  proporzione?: string;
  /** Foto in cima alla pagina: caricata subito, mai lazy. */
  priorita?: boolean;
};

const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i;
function detectType(src: string, fallback: "image" | "video"): "image" | "video" {
  if (VIDEO_EXT.test(src)) return "video";
  if (IMAGE_EXT.test(src)) return "image";
  return fallback;
}

export function MediaSlot({
  src,
  type,
  alt = "",
  caption,
  light = true,
  className = "",
  nascondiSeVuoto = false,
  proporzione,
  priorita = false,
}: Props) {
  if (!src && nascondiSeVuoto) return null;
  if (!src) {
    return (
      <PlaceholderBox
        variant={type}
        caption={caption}
        light={light}
        className={className}
        showCheck
      />
    );
  }
  const resolved = detectType(src, type);
  const wrap =
    "relative overflow-hidden rounded-md " +
    (proporzione ? proporzione + " " : "min-h-[360px] ") +
    (light ? "bg-light-grid" : "bg-blueprint-fine") +
    " " +
    className;
  if (resolved === "video") {
    return (
      <div className={wrap}>
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
    );
  }
  return (
    <div className={wrap}>
      <img
        src={src}
        alt={alt}
        loading={priorita ? "eager" : "lazy"}
        fetchPriority={priorita ? "high" : undefined}
        className="absolute inset-0 w-full h-full object-cover"
      />
    </div>
  );
}
