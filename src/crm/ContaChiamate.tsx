/** ── IL CONTATORE SULLA CORNETTA (31/10/2026) ───────────────────────────────
 *  `useSegnaChiamata` conta un tocco sulla scheda (vedi crm/chiamate);
 *  `BadgeChiamate` è il tondino nell'angolo della cornetta: il tasto che lo
 *  contiene deve essere `relative`. Con 0 non si vede.
 *  ───────────────────────────────────────────────────────────────────────── */
import { useCallback } from "react";
import { useCRM } from "./CRMContext";
import { chiamateDi, frasiChiamate, patchChiamata } from "./chiamate";
import type { Lead } from "./types";
import { cn } from "@/lib/utils";

export function useSegnaChiamata() {
  const { updateLead } = useCRM();
  return useCallback(
    (lead: Lead | null | undefined) => {
      if (!lead?.id) return;
      //  Non si aspetta: il tocco apre il telefono subito.
      //  Una funzione: si compone sulla scheda riletta, così due tocchi di
      //  fila (o due telefoni) contano due.
      void updateLead(lead.id, (d) => patchChiamata(d));
    },
    [updateLead],
  );
}

export function BadgeChiamate({
  lead,
  className,
}: {
  lead: Lead | null | undefined;
  className?: string;
}) {
  const n = chiamateDi(lead?.data);
  if (n === 0) return null;
  return (
    <span
      aria-label={frasiChiamate(n)}
      title={frasiChiamate(n)}
      className={cn(
        "pointer-events-none absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-700 px-1 t-etichetta font-semibold leading-none tabular-nums text-white ring-2 ring-card",
        className,
      )}
    >
      {n > 99 ? "99+" : n}
    </span>
  );
}
