/** ── «COM'È ANDATA?»: L'ESITO DEL RICONTATTO (31/10/2026) ───────────────────────────────────────
 *  Si apre dalla pastiglia dell'esito sulla riga, in «Ricontatti». La scelta È il salvataggio (come
 *  «Cambia stato»): niente tasto «Salva», in fondo solo la via d'uscita. Sul telefono è un foglio dal
 *  basso con tasti alti 44 px. Gli esiti e i loro nomi stanno in ricontatti.ts. */
import { Check, MessageCircleQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Finestra } from "@/crm/ui/Finestra";
import { cn } from "@/lib/utils";
import { ESITI_RICONTATTO, type EsitoRicontatto } from "./ricontatti";

export function FinestraEsito({
  aperta,
  onChiudi,
  esito,
  contesto,
  onScegli,
}: {
  aperta: boolean;
  onChiudi: () => void;
  /** L'esito di adesso, o `null`. */
  esito: EsitoRicontatto | null;
  /** Una riga: di chi si parla. */
  contesto?: string;
  /** `null` = «Nessun esito» (lo toglie). */
  onScegli: (e: EsitoRicontatto | null) => void;
}) {
  const voce = (acceso: boolean) =>
    cn(
      "t-corpo flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 text-left font-medium transition-colors",
      acceso
        ? "border-primary bg-primary/10 text-foreground"
        : "border-slate-200 bg-white text-slate-900 hover:bg-slate-100",
      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
    );
  return (
    <Finestra
      aperta={aperta}
      onCambio={(v) => !v && onChiudi()}
      titolo="Com'è andata?"
      icona={MessageCircleQuestion}
      contesto={contesto}
      larghezza="sm"
      azioni={
        <Button variant="outline" onClick={onChiudi} className="min-h-11 lg:pointer-fine:min-h-9">
          Annulla
        </Button>
      }
    >
      <ul className="flex flex-col gap-2">
        {ESITI_RICONTATTO.map((e) => (
          <li key={e.v}>
            <button
              type="button"
              aria-pressed={esito === e.v}
              onClick={() => onScegli(e.v)}
              className={voce(esito === e.v)}
            >
              <span className="min-w-0 flex-1">{e.titolo}</span>
              {esito === e.v && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            aria-pressed={esito === null}
            onClick={() => onScegli(null)}
            className={voce(esito === null)}
          >
            <span className="min-w-0 flex-1">Nessun esito</span>
            {esito === null && <Check aria-hidden="true" className="h-4 w-4 shrink-0" />}
          </button>
        </li>
      </ul>
    </Finestra>
  );
}
