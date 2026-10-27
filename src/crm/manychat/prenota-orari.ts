/** ── PRENOTA IN CHAT: GLI ORARI (stub del compito 0) ───────────────────────
 *  Lo riempie il compito T2 (PIANO.md). Firme definitive. */
import type { Consultant } from "../types";
import type {
  InputAncoraLibero,
  InputProponi,
  InputScegli,
  InputSlot,
  Proposta,
} from "./prenota-tipi";

/** I giorni civili di Roma da oggi a oggi+`giorniAvanti` (`AAAA-MM-GG`). */
export function giorniFinestra(_adesso: Date, _giorniAvanti: number): string[] {
  throw new Error("da fare");
}

/** Solo i consulenti attivi e approvati, nell'ordine di priorità (D6). */
export function consulentiPrenotabili(_consulenti: Consultant[]): Consultant[] {
  throw new Error("da fare");
}

/** Le ore (`HH:MM`) in cui UN consulente è `libero` quel giorno (D1). */
export function slotLiberiDelGiorno(_i: InputSlot): string[] {
  throw new Error("da fare");
}

export function proponi(_i: InputProponi): Proposta {
  throw new Error("da fare");
}

/** Il consulente per quello slot (Filippo, poi il primo libero), o `null`. */
export function scegliConsulente(_i: InputScegli): Consultant | null {
  throw new Error("da fare");
}

/** Lo slot è ancora libero per quel consulente? (dentro il lucchetto e dopo la scrittura) */
export function ancoraLibero(_i: InputAncoraLibero): boolean {
  throw new Error("da fare");
}
