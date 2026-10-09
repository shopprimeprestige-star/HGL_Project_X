import { Database, AlertTriangle } from "lucide-react";

/** Badge "dati in cache (X minuti fa)" mostrato quando stiamo servendo
 *  dati dal cache server. Se isStale=true (Meta ha bloccato per rate limit
 *  e abbiamo servito stale-fallback), evidenziato in arancio. */
export function CacheStatusBadge({
  info,
}: {
  info: { cachedAt: number; isStale: boolean } | null;
}) {
  if (!info) return null;
  const ageMs = Date.now() - info.cachedAt;
  const ageMin = Math.floor(ageMs / 60000);
  // Mostra solo se i dati hanno almeno 1 minuto (sotto è "appena caricato")
  if (ageMin < 1 && !info.isStale) return null;

  const ageLabel =
    ageMin < 1 ? "meno di 1 min" :
    ageMin === 1 ? "1 min" :
    ageMin < 60 ? `${ageMin} min` :
    `${Math.floor(ageMin / 60)}h ${ageMin % 60}m`;

  if (info.isStale) {
    return (
      <span
        className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[11.5px] font-medium bg-amber-50 text-amber-800 border border-amber-200"
        title="Meta ha temporaneamente limitato le chiamate (rate limit). Stiamo mostrando l'ultima copia salvata fino al ripristino."
      >
        <AlertTriangle className="h-3 w-3" />
        Dati in cache (rate limit) · {ageLabel} fa
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md text-[11.5px] font-medium bg-secondary/60 text-muted-foreground border border-border"
      title={`Dati serviti dalla cache server. TTL: hierarchy 15 min, performance 5 min. Clicca 'Aggiorna' per forzare il refresh.`}
    >
      <Database className="h-3 w-3" />
      Cache · {ageLabel} fa
    </span>
  );
}
