/** ── FATTURE BULK · RAGGRUPPAMENTO E RICOMPOSIZIONE (raggruppa.ts) ──
 *  SEGNAPOSTO di T0: i tipi e le firme ci sono, i corpi lanciano «da fare».
 *  Lo riempie T2 (PIANO §5); il file è suo e di nessun altro.
 *  Lavora sul solo tipo di ogni file, che sopravvive alla pulizia (D11b). */
import type { GruppoRicomposto, TipoFile } from "./tipi";

const daFare = (compito: string): never => {
  throw new Error(`da fare (${compito})`);
};

export type CriterioOrdine = "nome" | "data";

/** Ordine naturale dei nomi («Screenshot 2» prima di «Screenshot 10»), a parità la data del file. */
export function ordinaFile<T extends { nome: string; modificatoIl: number }>(file: T[], criterio: CriterioOrdine): T[] {
  return daFare("T2 ordinaFile");
}

export interface ConteggioGruppi {
  file: number;
  /** Terne complete. */
  gruppiCompleti: number;
  /** File che avanzano (n mod 3). */
  fileInPiu: number;
  /** Clienti previsti («300 file → 100 clienti»). */
  clienti: number;
  /** Più di MAX_FILE: da rifiutare. */
  oltreIlLimite: boolean;
}

export function contaGruppi(n: number): ConteggioGruppi {
  return daFare("T2 contaGruppi");
}

/** Ricompone i clienti dai tipi (nuovo cliente quando arriva un tipo già presente). */
export function ricomponi(file: { indice: number; tipo: TipoFile }[]): GruppoRicomposto[] {
  return daFare("T2 ricomponi");
}
