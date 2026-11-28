/** ── IL TASTO CHE INVERTE L'ORDINE (28/11/2026) ───────────────────────────────────────────────
 *  Compare nella fila sotto i filtri solo con «Ricontatti» o «Attesa acconto» acceso (vedi
 *  ordineFiltri.ts). Un tasto a commutazione: testo e freccia dicono l'ordine ATTUALE («Dal più
 *  nuovo» ↓ · «Dal più vecchio» ↑), un tocco lo inverte. 44 px col dito, 32 dal mouse; il testo non
 *  si spezza e `ml-auto` lo porta a destra: se la fila va a capo (telefono) scende da solo, intero.
 *  Niente `aria-pressed`: il testo cambia con lo stato, e l'`aria-label` dice l'ordine e cosa farà. */
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { BORDO_TASTO, FUOCO } from "./PannelloFiltri";
import { TESTO_VERSO, invertiVerso, type VersoOrdine } from "./ordineFiltri";

interface Props {
  verso: VersoOrdine;
  onCambia: (verso: VersoOrdine) => void;
}

export function TastoOrdine({ verso, onCambia }: Props) {
  const Freccia = verso === "nuovi" ? ArrowDown : ArrowUp;
  const dopo = invertiVerso(verso);
  return (
    <button
      type="button"
      aria-label={`Ordine attuale: ${TESTO_VERSO[verso].toLowerCase()}. Tocca per ordinare ${TESTO_VERSO[dopo].toLowerCase()}`}
      onClick={() => onCambia(dopo)}
      className={cn(
        "t-nota ml-auto flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border bg-background px-2.5 font-medium text-foreground transition-colors hover:bg-muted lg:pointer-fine:h-8",
        BORDO_TASTO,
        FUOCO,
      )}
    >
      <Freccia aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      {TESTO_VERSO[verso]}
    </button>
  );
}
