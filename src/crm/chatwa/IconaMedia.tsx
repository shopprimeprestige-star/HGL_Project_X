/** L'icona outline di un media (vocale, foto, video, documento), al posto delle
 *  emoji di prima (richiesta del titolare, 28/10/2026). Solo disegno. */
import { FileText, ImageIcon, Mic, Paperclip, Video } from "lucide-react";
import { cn } from "@/lib/utils";

const ICONE = {
  audio: Mic,
  immagine: ImageIcon,
  video: Video,
  documento: FileText,
  allegato: Paperclip,
} as const;

export function IconaMedia(p: { tipo: keyof typeof ICONE; className?: string }) {
  const Icona = ICONE[p.tipo];
  return <Icona aria-hidden="true" className={cn("inline h-3.5 w-3.5 shrink-0", p.className)} />;
}
