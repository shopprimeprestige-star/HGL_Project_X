/** Mini-barra orizzontale del Lead Pain Score (disagio 0-10).
 *  Gradiente verde (basso) → ambra (medio) → rosso (alto).
 *  Usata in card lead (CRM/nuovi) e detail sheet per leggere il dolore a colpo d'occhio. */

interface DisagioBarProps {
  score: number | null | undefined;
  /** Mostra label "Disagio X/10" sopra la barra. Default false (la card spesso ha già il numero). */
  showLabel?: boolean;
  /** Spessore barra in px. Default 6. */
  height?: number;
  className?: string;
}

/** Colore della barra in base al valore 0-10. */
function colorFor(score: number): string {
  // 0-3 → verde (info), 4-6 → ambra (warning), 7-10 → rosso (destructive)
  if (score <= 3) return "bg-emerald-500";
  if (score <= 6) return "bg-amber-500";
  return "bg-rose-500";
}

export function DisagioBar({ score, showLabel = false, height = 6, className = "" }: DisagioBarProps) {
  const v = typeof score === "number" ? Math.max(0, Math.min(10, score)) : null;
  const pct = v != null ? (v / 10) * 100 : 0;
  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex items-center justify-between text-[10px] uppercase font-semibold opacity-80 mb-1">
          <span>Dolore</span>
          <span className="tabular-nums">{v != null ? `${v}/10` : "—"}</span>
        </div>
      )}
      <div
        className="w-full bg-muted rounded-full overflow-hidden"
        style={{ height }}
        title={v != null ? `Lead Pain Score: ${v}/10` : "Dolore non dichiarato"}
      >
        {v != null && (
          <div
            className={`h-full ${colorFor(v)} transition-all`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}
