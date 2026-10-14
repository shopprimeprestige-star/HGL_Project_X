/** Le voci dei problemi, a tocco. Pezzo comune di pannello, box e pop-up.
 *  Etichetta intera («Tenuta: si stacca presto») nelle liste grandi; solo la
 *  parte prima dei due punti nei tasti compatti del box. Tocco mai sotto 44 px. */
import { Check } from "lucide-react";
import type { IdProblema } from "@/landing/testi-sito";

export interface VoceProblema {
  id: IdProblema;
  etichetta: string;
}

interface Props {
  voci: readonly VoceProblema[];
  onScegli: (id: IdProblema) => void;
  /** Solo se il tocco segna la voce senza procedere (il box): allora il tasto è «premuto». */
  scelta?: IdProblema | null;
  compatta?: boolean;
}

/** «Tenuta: si stacca presto» → ["Tenuta", "si stacca presto"]. */
function dividi(etichetta: string): [string, string] {
  const i = etichetta.indexOf(": ");
  return i < 0 ? [etichetta, ""] : [etichetta.slice(0, i), etichetta.slice(i + 2)];
}

export function VociProblema({ voci, onScegli, scelta, compatta = false }: Props) {
  return (
    <ul className={compatta ? "flex flex-wrap gap-2" : "grid gap-2 sm:grid-cols-2"}>
      {voci.map((v) => {
        const [testa, coda] = dividi(v.etichetta);
        const attiva = scelta === v.id;
        return (
          <li key={v.id} className={compatta ? "" : "contents"}>
            <button
              type="button"
              aria-label={v.etichetta}
              aria-pressed={compatta && scelta !== undefined ? attiva : undefined}
              onClick={() => onScegli(v.id)}
              className={
                compatta
                  ? `min-h-11 rounded-lg border px-3.5 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1a3a] ${
                      attiva
                        ? "border-brand bg-brand/20"
                        : "border-white/20 bg-white/[0.04] hover:border-white/40 hover:bg-white/10"
                    }`
                  : "flex min-h-[52px] w-full flex-col justify-center rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-left transition-colors hover:border-white/40 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1a3a]"
              }
            >
              {compatta ? (
                <span className="inline-flex items-center gap-1.5">
                  {attiva && <Check className="h-4 w-4 text-brand" aria-hidden="true" />}
                  {testa}
                </span>
              ) : (
                <>
                  <span className="text-[15px] font-semibold leading-tight text-white">{testa}</span>
                  {coda && <span className="text-[13px] leading-tight text-white/70">{coda}</span>}
                </>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
