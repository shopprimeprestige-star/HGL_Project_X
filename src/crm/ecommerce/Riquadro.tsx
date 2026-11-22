/** Un riquadro con titolo: la «pelle» delle schede Cassa e Spedizioni (stessa cornice, stessi spazi di «Apri lo shop»). */
import type { ReactNode } from "react";

export function Riquadro({
  id,
  titolo,
  chip,
  children,
}: {
  id: string;
  titolo: string;
  chip?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
        <h2 id={id} className="text-[15px] font-semibold tracking-tight">
          {titolo}
        </h2>
        {chip}
      </div>
      <div className="flex flex-col gap-3 px-4 pb-4 pt-2">{children}</div>
    </section>
  );
}
