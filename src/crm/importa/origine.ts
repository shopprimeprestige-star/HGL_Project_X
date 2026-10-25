/** ── DA DOVE È ENTRATO UN LEAD ──────────────────────────────────────────────
 *
 *  SCHELETRO del compito 0 (commessa 2026-10-25): solo le firme. I corpi li
 *  scrive il compito U (piano §1a, §4), con le prove in `prove/sheets/origine.mjs`.
 *
 *  `origineDi(d)`: «Google Sheets · Lead HGL», «File · lista_12ott.csv» o
 *  «A mano». Una scheda vecchia, senza nessuno dei campi, vale «a mano».
 *  Pura. */
import type { LeadData } from "../types";

export type ViaOrigine = "google_sheets" | "file" | "a_mano";

export interface OrigineLead {
  via: ViaOrigine;
  /** il testo da mostrare, già pronto: «Google Sheets · Lead HGL» */
  etichetta: string;
}

export function origineDi(_d: Partial<LeadData> | null | undefined): OrigineLead {
  throw new Error("origineDi: da scrivere (compito U)");
}

/** Vero se la scheda è entrata dal foglio Google (`origineIngresso.via`). */
export function daGoogleSheets(_d: Partial<LeadData> | null | undefined): boolean {
  throw new Error("daGoogleSheets: da scrivere (compito U)");
}
