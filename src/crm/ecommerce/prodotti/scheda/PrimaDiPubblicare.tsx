/** ── «PRIMA DI PUBBLICARE» (scheda/PrimaDiPubblicare.tsx) ─────────────────────
 *  Commessa 2026-11-25-editor-prodotti, E6 (SPEC §3.4). Il pannello di oggi, con le stesse frasi del server: l'elenco di ciò che manca
 *  (ogni voce ha «Vai», che porta al campo da sistemare) e, sotto, «Da sapere» (non ferma la pubblicazione). Dal computer è sempre aperto
 *  e resta in vista scorrendo; sul telefono è una riga che si apre, e dice già a parole quante cose mancano.
 *  Il tasto «Pubblica» NON è qui: è nella testata e nella barra, scritto nel guscio con le sue prove. Le frasi arrivano già pronte. */
import { CheckCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Voce } from "@/shop/cms/pubblicazione";
import { VoceLink } from "./pezzi";

/** «tutto a posto» / «manca 1 cosa» / «mancano 3 cose»: la riga che si legge anche con il pannello chiuso. */
const riassunto = (n: number) =>
  n === 0 ? "tutto a posto" : n === 1 ? "manca 1 cosa" : `mancano ${n} cose`;

export function PrimaDiPubblicare({
  bloccanti,
  informativi,
  vai,
  archiviato,
  vecchio,
  aperto,
  alterna,
}: {
  bloccanti: readonly Voce[];
  informativi: readonly Voce[];
  /** Porta al campo della voce (apre il riquadro e dà il focus): lo fa il guscio. */
  vai: (v: Voce) => void;
  archiviato: boolean;
  /** Il prodotto viene dal vecchio catalogo: prima va usato (frase di oggi). */
  vecchio: boolean;
  /** Solo sul telefono: il pannello è aperto o chiuso. Dal computer c'è sempre. */
  aperto: boolean;
  alterna: () => void;
}) {
  return (
    <aside
      aria-label="Prima di pubblicare"
      className="min-w-0 rounded-xl border border-border bg-card lg:sticky lg:top-3"
    >
      <button
        type="button"
        aria-expanded={aperto}
        aria-controls="prima-di-pubblicare"
        onClick={alterna}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-4 text-left text-[14px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
      >
        <span>Prima di pubblicare · {riassunto(bloccanti.length)}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none",
            aperto && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>
      <div
        id="prima-di-pubblicare"
        className={cn("flex flex-col gap-3 p-4", !aperto && "hidden lg:flex")}
      >
        <h2 className="hidden text-[14px] font-semibold lg:block">Prima di pubblicare</h2>
        {bloccanti.length === 0 ? (
          <p className="flex items-start gap-2 text-[13px] text-emerald-900">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {archiviato
              ? "Il prodotto è archiviato: rimettilo in bozza per pubblicarlo."
              : vecchio
                ? "Prima usa questo prodotto dal vecchio catalogo."
                : "Tutto a posto: puoi pubblicare."}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5" aria-label="Cose da sistemare">
            {bloccanti.map((v, k) => (
              <li key={`${v.campo}-${k}`}>
                <VoceLink voce={v} tono="blocco" vai={() => vai(v)} />
              </li>
            ))}
          </ul>
        )}
        {informativi.length > 0 && (
          <div className="flex flex-col gap-1.5 border-t border-border pt-3">
            <h3 className="text-[13px] font-semibold text-muted-foreground">
              Da sapere (non ferma la pubblicazione)
            </h3>
            <ul className="flex flex-col gap-1.5">
              {informativi.map((v, k) => (
                <li key={`${v.campo}-${k}`}>
                  <VoceLink voce={v} tono="info" vai={() => vai(v)} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}
