import { Loader2, Send, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CasellaProps } from "./tipi";

/** L'avviso dei segnaposto rimasti + la casella di scrittura + il pulsante di invio. */
export function Casella({ api }: CasellaProps) {
  const { bozza, setBozza, residuiBozza, invia, inviando, stato } = api;
  const configurata = stato !== "configura";
  return (
    <>
      {residuiBozza.length > 0 && (
        <div className="px-3 pt-2 bg-card border-t border-border">
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11.5px] text-amber-800">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-px" />
            <span>
              <span className="font-semibold">{residuiBozza.join("  ")}</span> non verrà sostituito:
              arriverebbe scritto così al cliente. Scrivi il dato al posto del segnaposto.
            </span>
          </div>
        </div>
      )}
      <div
        className={cn(
          "px-3 py-2.5 bg-card flex items-end gap-2",
          residuiBozza.length === 0 && "border-t border-border",
        )}
      >
        <div className="flex-1">
          <textarea
            value={bozza}
            onChange={(e) => setBozza(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void invia();
              }
            }}
            placeholder={
              configurata
                ? "Scrivi un messaggio…"
                : "Configura WhatsApp in Impostazioni per inviare"
            }
            rows={Math.min(6, Math.max(1, bozza.split("\n").length))}
            className="w-full bg-background border border-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none text-[13px] leading-relaxed rounded-md px-3 py-2"
          />
        </div>
        <Button
          onClick={() => void invia()}
          size="icon"
          disabled={!bozza.trim() || inviando || !configurata}
          className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-full h-9 w-9 disabled:opacity-50"
        >
          {inviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </>
  );
}
