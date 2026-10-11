/** ── LE LEVE FISCALI, IN PAGINA ────────────────────────────────────────────
 *
 *  Quello che si può fare per pagare meno, legalmente, calcolato sui numeri
 *  veri del periodo. Il contenuto — le norme, le stime, le controindicazioni —
 *  sta in `crm/contabilita-consigli`; qui si disegna.
 *
 *  ── ⚠️ CHIUSE DI DEFAULT, E CON LA REGOLA IN CIMA ─────────────────────────
 *  Un elenco di modi per spendere, aperto sotto il numero delle imposte, è un
 *  invito a spendere. La regola che viene prima di tutte — un costo abbassa le
 *  imposte del 27,9% e ti toglie il 100% dei soldi — sta scritta sopra
 *  l'elenco e non dentro una delle voci, perché vale per tutte.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useState } from "react";
import { ChevronDown, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";
import { Scheda, eur } from "./ui";
import { consigli, type Consiglio } from "./contabilita-consigli";
import type { Aliquote, ContoFiscale } from "./contabilita";

const TINTA: Record<Consiglio["forza"], string> = {
  alta: "bg-emerald-50 text-emerald-700 border-emerald-200",
  media: "bg-sky-50 text-sky-700 border-sky-200",
  bassa: "bg-slate-100 text-slate-600 border-slate-200",
};

export function LeveFiscali({
  conto,
  aliquote,
  mesiDelPeriodo,
}: {
  conto: ContoFiscale;
  aliquote: Aliquote;
  mesiDelPeriodo: number;
}) {
  const [aperto, setAperto] = useState<string | null>(null);
  const lista = consigli(conto, aliquote, { mesiDelPeriodo });

  return (
    <Scheda
      titolo="Come abbassare l'imponibile, legalmente"
      nota="Calcolato sui numeri di questo periodo. Ogni voce porta la sua norma e la sua controindicazione"
      icona={Lightbulb}
      senzaPadding
    >
      <p className="border-b border-border bg-amber-50/60 px-4 py-2.5 text-[12px] leading-relaxed text-amber-900">
        <strong>La regola che viene prima di tutte:</strong> un costo abbassa le imposte del 27,9% e
        ti toglie il 100% dei soldi. Non esiste nessuna spesa che convenga fare «per scaricarla» —
        comprare una cosa da 1.000 € che non serve fa risparmiare 279 € e ne fa uscire 1.000. Tutto
        quello che c&apos;è qui sotto vale a una condizione: che quella spesa ti servisse davvero.
      </p>
      <ul className="divide-y divide-border">
        {lista.map((c) => {
          const apertoQui = aperto === c.id;
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setAperto(apertoQui ? null : c.id)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50"
              >
                <span
                  className={cn(
                    "w-[52px] shrink-0 rounded border px-1.5 py-px text-center text-[10px] font-semibold uppercase tracking-wide",
                    TINTA[c.forza],
                  )}
                >
                  {c.forza}
                </span>
                <span className="min-w-0 flex-1 text-[13px] font-medium">{c.titolo}</span>
                {c.vale != null && c.vale > 0 && (
                  <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-emerald-700">
                    ≈ {eur(c.vale)}
                  </span>
                )}
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition",
                    apertoQui && "rotate-180",
                  )}
                />
              </button>
              {apertoQui && (
                <div className="space-y-1.5 border-t border-border bg-slate-50/60 px-4 py-3 text-[12.5px] leading-relaxed">
                  <p>{c.cosa}</p>
                  {c.conto && (
                    <p className="text-muted-foreground">
                      <strong>Il conto:</strong> {c.conto}.
                    </p>
                  )}
                  <p className="text-rose-800">
                    <strong>Attenzione:</strong> {c.attenzione}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground">{c.norma}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="border-t border-border px-4 py-2 text-[11.5px] leading-relaxed text-muted-foreground">
        Non sono consulenza fiscale e non sostituiscono lo studio: aliquote, soglie e crediti
        d&apos;imposta cambiano ogni anno con la legge di bilancio. Prima di muovere soldi su una di
        queste voci, fatti confermare che quel comma sia ancora in piedi quest&apos;anno.
      </p>
    </Scheda>
  );
}
