/** ── L'AVVISO DELLA PAGINA E-COMMERCE (Avviso.tsx) ────────────────────────────
 *  Una riga che dice una cosa che chi legge le cifre deve sapere (tetto di lettura, righe non leggibili, database da
 *  aggiornare, importi fuori norma). Stesso aspetto degli avvisi di Fatture. `errore` è per ciò che è andato storto: lo
 *  legge anche chi usa la sintesi vocale, subito; gli altri aspettano la fine della frase in corso. */
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function Avviso({
  children,
  errore,
  azione,
}: {
  children: ReactNode;
  errore?: boolean;
  azione?: ReactNode;
}) {
  return (
    <div
      role={errore ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-start gap-2 rounded-lg border px-3 py-2 text-[12.5px] leading-snug",
        errore
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : "border-amber-200 bg-amber-50 text-amber-900",
      )}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1">{children}</p>
      {azione}
    </div>
  );
}
