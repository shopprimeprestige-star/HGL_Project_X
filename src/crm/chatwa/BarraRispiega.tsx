/** ── LA BARRA DI «RISPIEGA CON AI» (30/10/2026) ──────────────────────────────
 *
 *  Al posto della casella mentre si scelgono le bolle: quante sono scelte,
 *  «Rispiega con AI» e «Annulla». Il Mac scrive la nuova spiegazione e la mette
 *  nella casella come bozza: NON parte da sola, si rilegge e si invia a mano.
 *  ⚠️ Serve almeno una bolla NOSTRA (è quella da rispiegare): senza, il tasto è
 *   spento e una riga dice perché. Mentre il Mac scrive il tasto è bloccato
 *   (niente doppio clic); «Annulla» smette di aspettare.
 *  ⚠️ Sul telefono tasti alti 44 px, come il resto della chat. Esc annulla dal computer.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_RISPIEGA, controllaScelta, fraseControllo } from "@/crm/risposte-ai/rispiega";
import type { RispostaAiApi } from "./useRispostaAi";
import type { WaMessageRow } from "./tipi";

export function BarraRispiega({ ai, messaggi }: { ai: RispostaAiApi; messaggi: WaMessageRow[] }) {
  const n = ai.scelti.length;
  const attesa = ai.fase === "attesa";
  const controllo = controllaScelta(ai.scelti, messaggi);
  //  Una riga che dice cosa manca: solo se qualcosa è scelto o è stato tolto tutto, e mai insieme a un errore.
  const manca = !controllo.ok && !attesa && !ai.errore ? fraseControllo(controllo.motivo) : null;

  const { chiudi } = ai;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") chiudi();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [chiudi]);

  return (
    <div className="border-t border-border bg-card px-3 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" aria-hidden />
          <div className="min-w-0 flex-1 text-[13px] leading-snug">
            <p role="status" aria-live="polite" className="text-foreground">
              {attesa ? (
                <>
                  Sto scrivendo la nuova spiegazione…
                  <span className="text-muted-foreground">
                    {" "}
                    · {n} {n === 1 ? "bolla" : "bolle"}
                  </span>
                </>
              ) : (
                <>
                  <strong className="font-semibold tabular-nums">{n}</strong>{" "}
                  {n === 1 ? "bolla selezionata" : "bolle selezionate"}
                  <span
                    className={cn(n >= MAX_RISPIEGA ? "text-amber-700" : "text-muted-foreground")}
                  >
                    {" "}
                    · massimo {MAX_RISPIEGA}
                  </span>
                </>
              )}
            </p>
            {manca && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{manca}</p>}
            {ai.pc === false && !attesa && (
              <p className="mt-0.5 text-[12px] text-amber-800">
                Il Mac non si sente da qualche minuto: la richiesta parte lo stesso e la bozza
                arriva se si riaccende entro 3 minuti.
              </p>
            )}
            {ai.errore && (
              <p role="alert" className="mt-0.5 text-[12.5px] text-rose-700">
                {ai.errore}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 sm:shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={chiudi}
            className="h-11 flex-1 sm:flex-none md:h-9"
          >
            Annulla
          </Button>
          <Button
            type="button"
            onClick={() => void ai.scrivi()}
            disabled={!controllo.ok || attesa}
            aria-busy={attesa}
            className="h-11 flex-[2] bg-violet-600 text-white hover:bg-violet-700 sm:flex-none md:h-9"
          >
            {attesa ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="h-4 w-4" aria-hidden />
            )}
            {attesa ? "Sto scrivendo…" : "Rispiega con AI"}
          </Button>
        </div>
      </div>
    </div>
  );
}
