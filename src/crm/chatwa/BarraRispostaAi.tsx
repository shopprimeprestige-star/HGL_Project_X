/** ── LA BARRA DELLA RISPOSTA AI (29/10/2026) ─────────────────────────────────
 *
 *  Al posto della casella mentre si scelgono i messaggi: quanti ne sono
 *  scelti, un'indicazione facoltativa, «Scrivi la risposta» e lo stato del
 *  Mac. La risposta arriva nella casella, da rileggere: non parte da sola.
 *  ⚠️ Sul telefono tasti alti 44 px, come il resto della chat.
 *  ───────────────────────────────────────────────────────────────────────── */
import { Loader2, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_SCELTI } from "@/crm/risposte-ai/regole";
import type { RispostaAiApi } from "./useRispostaAi";

export function BarraRispostaAi({ ai }: { ai: RispostaAiApi }) {
  const n = ai.scelti.length;
  const attesa = ai.fase === "attesa";
  return (
    <div className="border-t border-border bg-card px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 shrink-0 text-violet-600" aria-hidden />
          <span className="min-w-0 flex-1 text-[13px] leading-tight text-foreground">
            {attesa ? (
              "Il Mac sta scrivendo la risposta…"
            ) : n === 0 ? (
              "Tocca i messaggi a cui rispondere"
            ) : (
              <>
                <strong className="font-semibold">{n}</strong>{" "}
                {n === 1 ? "messaggio scelto" : "messaggi scelti"}
                <span className="text-muted-foreground"> · massimo {MAX_SCELTI}</span>
              </>
            )}
          </span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 text-[11.5px]",
              ai.pc === false ? "text-amber-700" : "text-muted-foreground",
            )}
            title="Le risposte le scrive Claude sul Mac: deve essere acceso"
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                ai.pc === true
                  ? "bg-emerald-500"
                  : ai.pc === false
                    ? "bg-amber-500"
                    : "bg-muted-foreground/40",
              )}
              aria-hidden
            />
            {ai.pc === true ? "Mac acceso" : ai.pc === false ? "Mac spento" : "Mac: non so"}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-11 w-11 shrink-0 md:h-8 md:w-8"
            onClick={ai.chiudi}
            aria-label="Annulla la risposta AI"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {ai.pc === false && !attesa && (
          <p className="text-[12px] leading-snug text-amber-800">
            Il Mac non si sente da qualche minuto: la richiesta parte lo stesso e la risposta arriva
            se si riaccende entro 3 minuti, poi si annulla.
          </p>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={ai.indicazione}
            onChange={(e) => ai.setIndicazione(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && n > 0 && !attesa) void ai.scrivi();
            }}
            disabled={attesa}
            placeholder="Indicazione (facoltativa): più breve, proponi domani…"
            aria-label="Indicazione per la risposta"
            className="h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-[14px] md:h-9 md:text-[13px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          />
          <Button
            onClick={() => void ai.scrivi()}
            disabled={n === 0 || attesa}
            className="h-11 shrink-0 bg-violet-600 text-white hover:bg-violet-700 md:h-9"
          >
            {attesa ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{attesa ? "Scrivendo…" : "Scrivi la risposta"}</span>
            <span className="sm:hidden">{attesa ? "…" : "Scrivi"}</span>
          </Button>
        </div>
        {ai.errore && (
          <p role="alert" className="text-[12.5px] leading-snug text-rose-700">
            {ai.errore}
          </p>
        )}
      </div>
    </div>
  );
}
