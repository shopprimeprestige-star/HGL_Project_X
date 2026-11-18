/** ── IL NUMERETTO DELLA VOCE «E-commerce» (useOrdiniNuovi.ts) ──────────────────
 *  Commessa 2026-11-17-crm-ecommerce, T10. Quanti ordini sono «nuovo»: `?conta=1` all'apertura e ogni 60 s,
 *  mai a scheda nascosta. Tiene l'ultimo valore buono (un guasto non lo azzera: `null` solo finché non ha mai
 *  risposto, e `null` anche quando `attivo` è falso: il valore tenuto non esce). Nessun log. Con `attivo` falso — chi non vede la voce — non fa NESSUNA richiesta. */
import { useEffect, useState } from "react";
import { fetchCRM } from "@/crm/AuthContext";
import { avviaConta, porteBrowser } from "./client";

export function useOrdiniNuovi(attivo: boolean): number | null {
  const [nuovi, setNuovi] = useState<number | null>(null);
  useEffect(
    () => avviaConta({ attivo, fetch: fetchCRM, porte: porteBrowser(), alCambio: setNuovi }),
    [attivo],
  );
  return attivo ? nuovi : null;
}
