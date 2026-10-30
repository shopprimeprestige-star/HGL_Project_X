import { ChevronRight, Video } from "lucide-react";
import type { ProssimoMeet } from "./prossimo-meet";
import type { ChatItem } from "./tipi";
import { nomeChat } from "./RigaChat";

/** ── IL PROSSIMO MEET, INCOLLATO IN CIMA (30/10/2026) ──────────────────────
 *  Richiesta del titolare: la chat del primo meet della giornata sempre in alto, in un colore suo,
 *  col nome di chi lo farà. Due righe sole (sul telefono ~54 px): «Meet alle 15:00 · Mirko» e sotto
 *  il cliente. Viola, il colore del meet; bordo e icona lo dicono, e la parola «Meet» lo
 *  dice anche a chi non distingue i colori. Niente righetta colorata a lato: è un segno da «avviso». Il tocco apre la chat. Sta nell'area che
 *  scorre con `sticky top-0`: non copre filtri e ricerca, che restano sopra fuori dallo scorrimento.
 *  Le regole di quale chat sia stanno in prossimo-meet.ts. */
export function BarraProssimoMeet({
  meet,
  onApri,
}: {
  meet: ProssimoMeet<ChatItem>;
  onApri: () => void;
}) {
  const cliente = nomeChat(meet.chat);
  return (
    <div
      role="region"
      aria-label="Prossimo meet"
      className="sticky top-0 z-10 border-b border-violet-300 bg-violet-50"
    >
      <button
        type="button"
        onClick={onApri}
        title={`Apri la chat di ${cliente}`}
        className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-600 lg:pointer-fine:min-h-10 lg:pointer-fine:py-1.5"
      >
        <Video aria-hidden="true" className="h-5 w-5 shrink-0 text-violet-700" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold leading-5 text-violet-950 md:text-[13px]">
            {meet.etichetta}
          </span>
          <span className="block truncate text-[13px] leading-[18px] text-violet-800 md:text-[12px]">
            {cliente}
          </span>
        </span>
        <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-violet-700" />
      </button>
    </div>
  );
}
