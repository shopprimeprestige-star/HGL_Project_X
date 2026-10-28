/** ── LA RIGA DELLE PILLOLE DI STATO ────────────────────────────────────────
 *
 *  Commessa 2026-10-28 «Lead importati semplice». Una riga sola, nell'ordine in
 *  cui il lead cammina (crm/importa/pillole-stato), col numero accanto: quello
 *  che esce toccandola. Sul telefono scorre di lato e porta sempre in vista la
 *  pillola accesa. Una pillola a zero non si mostra, salvo l'accesa.
 *
 *  ⚠️ I NUMERI NON SI CONTANO QUI: arrivano da `opzioniFiltri` (le stesse
 *   funzioni che producono le righe), più i ritorni fuori lista per «Di ritorno».
 *  ⚠️ «Azzera» C'È SEMPRE CON UNA PILLOLA ACCESA: «Tutta la coda» a zero non si
 *   mostra, e senza questo tasto con la coda vuota non si tornerebbe indietro.
 *  ⚠️ Alte 44 px sul telefono, 32 sul computer.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { StatoFiltro } from "./filtri-lista";
import {
  NOME_STATO,
  SPIEGA_STATO,
  numeroPillola,
  pilloleAccese,
  pilloleDaMostrare,
  type PillolaId,
} from "./pillole-stato";

export function BarraPillole({
  scelto,
  statoOpzioni,
  ritorniFuoriLista,
  accesi,
  onTocca,
  onAzzera,
  disabilitato,
  filtra,
}: {
  /** Lo Stato dell'indirizzo, già tradotto (`conStatoCanonico`). */
  scelto?: StatoFiltro;
  /** `opzioniFiltri(...).stato`. */
  statoOpzioni: { valore: StatoFiltro; n: number }[];
  ritorniFuoriLista: number;
  /** Quanti filtri sono accesi in tutto (pillola compresa): serve a «Azzera». */
  accesi: number;
  onTocca: (id: PillolaId) => void;
  onAzzera: () => void;
  /** Durante un'operazione di gruppo: spente anche da tastiera. */
  disabilitato?: boolean;
  /** Il tasto «Filtra», a destra: lo disegna la pagina (apre un pannello). */
  filtra?: React.ReactNode;
}) {
  const n = (id: PillolaId) => numeroPillola(id, statoOpzioni, ritorniFuoriLista);
  const accese = pilloleAccese(scelto);
  const daMostrare = pilloleDaMostrare(n, scelto);
  //  La pillola accesa sempre in vista: sul telefono la riga scorre.
  const primaAccesa = useRef<HTMLButtonElement | null>(null);
  const chiave = accese.join("+");
  useEffect(() => {
    const el = primaAccesa.current;
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ inline: "center", block: "nearest" });
    }
  }, [chiave]);
  return (
    <div className="flex items-center gap-2" aria-disabled={disabilitato || undefined}>
      <div
        role="group"
        aria-label="Stato"
        className="-mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {daMostrare.map((id) => {
          const si = accese.includes(id);
          return (
            <button
              key={id}
              ref={si && id === accese[0] ? primaAccesa : undefined}
              type="button"
              aria-pressed={si}
              title={SPIEGA_STATO[id]}
              disabled={disabilitato}
              onClick={() => onTocca(id)}
              className={cn(
                "inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] transition md:h-8 md:px-3 md:text-[12.5px]",
                "disabled:cursor-not-allowed disabled:opacity-45",
                si
                  ? "border-foreground bg-foreground font-semibold text-background"
                  : "border-border bg-background font-medium text-foreground hover:border-foreground/40",
              )}
            >
              {NOME_STATO[id]}
              <span
                className={cn("tabular-nums", si ? "text-background/80" : "text-muted-foreground")}
              >
                {n(id)}
              </span>
            </button>
          );
        })}
      </div>
      {accesi > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabilitato}
          onClick={onAzzera}
          className="h-11 shrink-0 px-2.5 text-[12.5px] text-muted-foreground hover:text-foreground md:h-8"
          title="Toglie la pillola e tutti i filtri: si torna a «Tutta la coda»"
        >
          Azzera
        </Button>
      )}
      {filtra}
    </div>
  );
}
