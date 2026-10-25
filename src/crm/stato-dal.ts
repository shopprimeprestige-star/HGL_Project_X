/** ── QUANDO È CAMBIATO LO STATO ─────────────────────────────────────────────
 *
 *  SCHELETRO del compito 0 (commessa 2026-10-25): solo la firma. Il corpo lo
 *  scrive il compito T (piano §1a, §8), con le sue prove in
 *  `prove/manychat/stati.mjs`.
 *
 *  `conStatoDal(prima, dopo, adesso)`: se lo stato FINALE (`dopo.stato`) è
 *  diverso da quello di `prima`, restituisce `dopo` con `statoDal = adesso`
 *  (ISO); altrimenti `dopo` invariato. Il confronto è fra lo stato finale e
 *  quello di prima, non «la patch contiene `stato`»: LeadDialog salva il modulo
 *  intero con lo stato dentro, e `statoDal` si rinnoverebbe a ogni salvataggio.
 *  La usano `updateLead` (CRMContext, dopo `applyAutoStatus`) e
 *  `api.consulente.azione.ts`. Pura: non tocca né `prima` né `dopo`. */
import type { LeadData } from "./types";

export function conStatoDal<T extends Partial<LeadData>>(
  _prima: Partial<LeadData> | null | undefined,
  _dopo: T,
  _adesso: Date,
): T {
  throw new Error("conStatoDal: da scrivere (compito T)");
}
