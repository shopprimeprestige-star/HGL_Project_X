/** ── LA FRASE DEL GIRO ─────────────────────────────────────────────────────
 *
 *  Commessa 2026-10-28 «Lead importati semplice». Una frase e una barra sottile:
 *  «74 da chiamare oggi · 12 fatti». Sostituisce la scheda grande con «0 di 75
 *  fatti oggi».
 *  ⚠️ SI CHIAMA CON LA CODA INTERA, non con la fetta dei filtri: il 74 della
 *   frase è il numero di «Tutta la coda» (`fraseGiro`, avvisi-pagina).
 *  ─────────────────────────────────────────────────────────────────────────── */
import { fraseGiro } from "./avvisi-pagina";

export function FraseGiro({ daProvare, fatti }: { daProvare: number; fatti: number }) {
  const totale = Math.max(0, daProvare) + Math.max(0, fatti);
  const percento = totale > 0 ? Math.round((Math.max(0, fatti) / totale) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <p className="shrink-0 text-[14px] font-semibold tabular-nums text-foreground">
        {fraseGiro(daProvare, fatti)}
      </p>
      {totale > 0 && (
        <div
          className="h-1 min-w-8 flex-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={percento}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Avanzamento del giro di telefonate"
        >
          <div
            className="h-full rounded-full bg-foreground/70 transition-[width] duration-500"
            style={{ width: `${percento}%` }}
          />
        </div>
      )}
    </div>
  );
}
