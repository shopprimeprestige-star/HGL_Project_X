/** ── QUANTE VOLTE LO ABBIAMO CHIAMATO (31/10/2026) ──────────────────────────
 *
 *  Richiesta del titolare: «ogni volta che si clicca sulla cornetta ci sia un
 *  contatore, per tutte le volte che si clicca. Così si sa quanti tentativi
 *  sono stati fatti e non si resetta mai, in qualsiasi stato».
 *  Il conto sta sulla scheda (`data.chiamate`): nessuno stato e nessuna regola
 *  lo azzera (`updateLead` fonde al primo livello, e questa chiave la scrive
 *  solo `patchChiamata`). Pure: prove in prove/prove.mjs.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LeadData } from "./types";

export interface ChiamateLead {
  /** i tocchi sulla cornetta, dal primo */
  volte: number;
  /** ISO del primo tocco */
  prima: string;
  /** ISO dell'ultimo tocco */
  ultima: string;
}

/** Quante volte si è toccata la cornetta per questa scheda (0 se mai). */
export function chiamateDi(d: Partial<LeadData> | null | undefined): number {
  const v = Number((d as { chiamate?: Partial<ChiamateLead> } | null | undefined)?.chiamate?.volte);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** Un tocco in più: il conto sale, la prima volta resta. */
export function patchChiamata(
  d: Partial<LeadData> | null | undefined,
  ora: Date = new Date(),
): { chiamate: ChiamateLead } {
  const prima = (d as { chiamate?: Partial<ChiamateLead> } | null | undefined)?.chiamate;
  const adesso = ora.toISOString();
  return {
    chiamate: {
      volte: chiamateDi(d) + 1,
      prima: typeof prima?.prima === "string" && prima.prima ? prima.prima : adesso,
      ultima: adesso,
    },
  };
}

/** «Chiamato 3 volte» per il title e chi usa lo screen reader. */
export const frasiChiamate = (n: number): string =>
  n === 0 ? "Mai chiamato" : n === 1 ? "Chiamato 1 volta" : `Chiamato ${n} volte`;
