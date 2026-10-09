// Helper condivisi per analisi del funnel LP.
// Estratti da lp-performance.ts e lp-creative-funnel.ts per evitare duplicazione.
//
// Mapping step (FunnelStep emesso dal client, step = next+1):
//  1 = calendar visibile
//  2 = portatore (Sei già portatore?)
//  3 = disagio (livello disagio)
//  4 = urgenza
//  5 = contact form visualizzato
//  6 = thankyou (lead inviato)

export interface MinimalLpEvent {
  event_name: string;
  step: number | null;
}

/** Ritorna true se in QUALSIASI evento della sessione lo step (FunnelStep o
 *  StepView) è ≥ del livello richiesto. */
export function reachedStep(events: MinimalLpEvent[], step: number): boolean {
  return events.some(
    (e) =>
      (e.event_name === "FunnelStep" || e.event_name === "StepView") &&
      (e.step ?? -1) >= step,
  );
}

/** Lead inviato (evento standard Meta CAPI compatibile). */
export function isLead(events: MinimalLpEvent[]): boolean {
  return events.some((e) => e.event_name === "Lead");
}

/** Step massimo raggiunto nella sessione (0 se nessuno). Utile per
 *  classificare il "drop step" della creativa. */
export function maxStepReached(events: MinimalLpEvent[]): number {
  let max = 0;
  for (const e of events) {
    if (e.event_name === "FunnelStep" || e.event_name === "StepView") {
      const s = e.step ?? -1;
      if (s > max) max = s;
    }
  }
  if (isLead(events)) max = Math.max(max, 6);
  return max;
}
