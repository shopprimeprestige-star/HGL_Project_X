/** ── QUANDO È CAMBIATO LO STATO ─────────────────────────────────────────────
 *
 *  Commessa 2026-10-25, compito T. Prove in `prove/manychat/stati.mjs`.
 *
 *  `conStatoDal(prima, dopo, adesso)`: se lo stato FINALE (`dopo.stato`) è
 *  diverso da quello di `prima`, restituisce `dopo` con `statoDal = adesso`
 *  (ISO); altrimenti `dopo` invariato. Il confronto è fra lo stato finale e
 *  quello di prima, non «la patch contiene `stato`»: LeadDialog salva il modulo
 *  intero con lo stato dentro, e `statoDal` si rinnoverebbe a ogni salvataggio.
 *  La usano `updateLead` (CRMContext, dopo `applyAutoStatus`) e
 *  `api.consulente.azione.ts`. Pura: non tocca né `prima` né `dopo`.
 *  È la data dell'«evento» per i messaggi che partono una volta per evento
 *  (`manychat/stati`). */
import type { LeadData } from "./types";

export function conStatoDal<T extends Partial<LeadData>>(
  prima: Partial<LeadData> | null | undefined,
  dopo: T,
  adesso: Date,
): T {
  if (String(prima?.stato ?? "") === String(dopo.stato ?? "")) return dopo;
  return { ...dopo, statoDal: adesso.toISOString() };
}
