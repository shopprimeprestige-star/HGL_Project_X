/** Una foto della pagina `/soluzioni`: un `<img>` e basta, niente riquadri.
 *  - slot vuoto (`null`, o senza indirizzo) → non scrive niente nel DOM: mai un riquadro grigio, mai un cerchio vuoto;
 *  - `aspect-ratio` in CSS e `width`/`height` sull'elemento: zero salti mentre arriva (CLS);
 *  - nessuno sfondo: prima che arrivi si vede il colore della sezione, non un grigio.
 *  Sta qui e non in `MediaSlot` perché la home non deve poter cambiare (G1). */
import type { CSSProperties } from "react";

/** Uguale a `Slot` di `regole.ts` (S1): è strutturale, quindi i due si capiscono. */
export interface SlotFoto {
  src: string;
  poster: string;
  alt: string;
}

export type FormatoMedia = "16:9" | "9:16" | "4:5" | "4:3" | "3:2" | "1:1";

/** alta: ritratto della prima schermata (`fetchpriority="high"`, mai lazy) · subito: miniature, subito ma senza priorità · pigra: fuori dalla prima schermata. */
export type PrioritaFoto = "alta" | "subito" | "pigra";

export function Foto({
  slot,
  formato,
  larghezza,
  altezza,
  priorita = "subito",
  posizione,
  className,
}: {
  slot: SlotFoto | null;
  formato: FormatoMedia;
  larghezza: number;
  altezza: number;
  priorita?: PrioritaFoto;
  posizione?: string;
  className?: string;
}) {
  if (!slot || !slot.src) return null;
  const stile: CSSProperties = {
    aspectRatio: formato.replace(":", " / "),
    objectFit: "cover",
    ...(posizione ? { objectPosition: posizione } : {}),
  };
  return (
    <img
      src={slot.src}
      alt={slot.alt}
      width={larghezza}
      height={altezza}
      loading={priorita === "pigra" ? "lazy" : "eager"}
      decoding="async"
      {...(priorita === "alta" ? { fetchPriority: "high" as const } : {})}
      style={stile}
      className={className}
    />
  );
}
