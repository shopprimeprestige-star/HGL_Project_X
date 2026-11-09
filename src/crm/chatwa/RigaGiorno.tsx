/** ── LA FILA DEI GIORNI, SOTTO OGNI FILTRO ACCESO (09/11/2026) ───────────────────────────────────
 *  Richiesta del titolare: dentro un filtro, vedere solo quelli di oggi, di domani, eccetera.
 *  Tutti · Ieri · Oggi · Domani · Questa settimana · Prossima settimana, un interruttore a segmenti come
 *  la «Data» di Ricontatti ma che scorre di lato (sul telefono col dito): sei voci non stanno in 375 px,
 *  e la PAGINA non deve scorrere, solo la fila. Uno acceso alla volta; ritoccare quello acceso torna a
 *  «Tutti». Il numero su ogni voce lo calcola la pagina (`conta`, la stessa funzione dell'elenco).
 *  Telefono: il segmento è alto 32 px a vista e 44 di tocco (l'area si allunga dentro la fila, che ha
 *  il suo respiro: nella fila che scorre quello che esce viene tagliato). Quale data guarda: giorno.ts. */
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { FUOCO } from "./PannelloFiltri";
import { SEGMENTI_GIORNO, type GiornoChat } from "./giorno";

interface Props {
  valore: GiornoChat;
  /** Quante chat entrerebbero toccando quel segmento. */
  conta: (giorno: GiornoChat) => number;
  onCambia: (giorno: GiornoChat) => void;
  /** A parole, quale data guarda il filtro («il giorno del ricontatto»): sta nel tooltip e per chi legge. */
  data: string;
}

export function RigaGiorno({ valore, conta, onCambia, data }: Props) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3 md:px-2" title={`Conta ${data}`}>
      <CalendarDays aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      {/*  La fila che scorre: la barra non si vede, il resto della pagina sta fermo (`min-w-0`). */}
      <div className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div
          role="group"
          aria-label="Giorno"
          aria-description={`Conta ${data}`}
          className="inline-flex w-max gap-0.5 rounded-lg bg-muted p-0.5"
        >
          {SEGMENTI_GIORNO.map((x) => {
            const acceso = valore === x.v;
            return (
              <button
                key={x.v || "tutti"}
                type="button"
                aria-pressed={acceso}
                onClick={() => onCambia(acceso ? "" : x.v)}
                className={cn(
                  "t-nota relative flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 font-medium transition-colors after:absolute after:inset-x-0 after:-inset-y-1.5 lg:pointer-fine:h-7 lg:pointer-fine:after:hidden",
                  acceso
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground hover:bg-background",
                  FUOCO,
                )}
              >
                {x.nome}
                <span
                  className={cn(
                    "tabular-nums",
                    acceso ? "text-primary-foreground/80" : "text-muted-foreground",
                  )}
                >
                  {conta(x.v)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
