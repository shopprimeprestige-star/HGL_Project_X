/** ── «BOZZA AI PRONTA» SOPRA LA CASELLA (30/10/2026) ─────────────────────────
 *
 *  Il Mac ha già scritto una risposta per questa chat: si legge qui, «Usa» la
 *  mette nella casella (sotto a quello che c'è già, senza cancellarlo) e
 *  «Scarta» la toglie. Non parte mai da sola.
 *  ⚠️ Sul telefono tasti alti 44 px, come il resto della chat.
 *  ───────────────────────────────────────────────────────────────────────── */
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BozzaAiPronta({
  testo,
  onUsa,
  onScarta,
}: {
  testo: string;
  onUsa: () => void;
  onScarta: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Bozza AI pronta"
      className="border-t border-violet-200 bg-violet-50 px-3 py-2"
    >
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <Sparkles className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold leading-tight text-violet-900">
            Bozza AI pronta
          </div>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-foreground" title={testo}>
            {testo}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onScarta}
          className="h-11 shrink-0 text-muted-foreground md:h-8"
        >
          Scarta
        </Button>
        <Button
          size="sm"
          onClick={onUsa}
          className="h-11 shrink-0 bg-violet-600 text-white hover:bg-violet-700 md:h-8"
        >
          Usa
        </Button>
      </div>
    </div>
  );
}
