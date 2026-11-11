import { PhoneCall } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProssimoRicontatto } from "./prossimo-ricontatto";
import type { ChatItem } from "./tipi";
import { nomeChat } from "./RigaChat";

/** ── IL PROSSIMO RICONTATTO, INCOLLATO IN CIMA (11/11/2026) ─────────────────
 *  Gemella di BarraProssimoMeet: due righe, «Da richiamare alle 15:00 · Mirko» e sotto il cliente.
 *  Ambra, il colore del richiamo di oggi (`stileRichiamo`); rossa se l'ora è passata e lo stato non
 *  è cambiato, con la parola «passate» per chi non distingue i colori. Il tocco apre la chat.
 *  Le regole di quale chat sia stanno in prossimo-ricontatto.ts. */
export function BarraProssimoRicontatto({
  ricontatto,
  onApri,
}: {
  ricontatto: ProssimoRicontatto<ChatItem>;
  onApri: () => void;
}) {
  const cliente = nomeChat(ricontatto.chat);
  const { passato } = ricontatto;
  return (
    <div
      role="region"
      aria-label="Prossimo ricontatto"
      className={cn(
        "border-b",
        passato ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50",
      )}
    >
      <button
        type="button"
        onClick={onApri}
        title={`Apri la chat di ${cliente}`}
        className={cn(
          "flex min-h-11 w-full min-w-0 items-center gap-3 py-2 pl-3 pr-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset lg:pointer-fine:min-h-10 lg:pointer-fine:py-1.5",
          passato
            ? "hover:bg-red-100 focus-visible:ring-red-600"
            : "hover:bg-amber-100 focus-visible:ring-amber-600",
        )}
      >
        <PhoneCall
          aria-hidden="true"
          className={cn("h-5 w-5 shrink-0", passato ? "text-red-700" : "text-amber-700")}
        />
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              "block truncate text-[14px] font-semibold leading-5 md:text-[13px]",
              passato ? "text-red-950" : "text-amber-950",
            )}
          >
            {ricontatto.etichetta}
            {passato ? " · passate" : ""}
          </span>
          <span
            className={cn(
              "block truncate text-[13px] leading-[18px] md:text-[12px]",
              passato ? "text-red-800" : "text-amber-900",
            )}
          >
            {cliente}
          </span>
        </span>
      </button>
    </div>
  );
}
