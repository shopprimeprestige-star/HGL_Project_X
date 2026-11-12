/** ── FATTURE BULK · DOPPIONI E SCHEDE (doppioni-e-schede.ts) ──
 *  SEGNAPOSTO di T0: i tipi e le firme ci sono, i corpi lanciano «da fare».
 *  Lo riempie T4 (PIANO §5); il file è suo e di nessun altro.
 *  Funzioni pure che non mutano l'input. */
import type { CampiRiga, Motivo, SchedaPerAbbinamento } from "./tipi";
import type { Fattura } from "../tipi";

const daFare = (compito: string): never => {
  throw new Error(`da fare (${compito})`);
};

/** Quello che serve a cercare doppioni di una riga (T10 lo costruisce). */
export interface RigaPerDoppioni {
  idRiga: string;
  campi: CampiRiga;
  /** Impronte dei file; quella del pagamento è la decisiva. */
  improntaPagamento: string;
  riferimento: string;
}

export interface FontiDoppioni {
  emesse: Fattura[];
  bozze: Fattura[];
  altreRighe: RigaPerDoppioni[];
  /** Impronte dei pagamenti di altri lotti aperti. */
  altriLotti: string[];
}

export function trovaDoppioni(riga: RigaPerDoppioni, fonti: FontiDoppioni): Motivo[] {
  return daFare("T4 trovaDoppioni");
}

/** Le impronte dei pagamenti già fatturati o già caricati (anche da `origineBulk.impronte`). */
export function impronteGiaViste(fonti: FontiDoppioni): Set<string> {
  return daFare("T4 impronteGiaViste");
}

export interface AbbinamentoScheda {
  /** null = fattura senza scheda. */
  scheda: SchedaPerAbbinamento | null;
  motivi: Motivo[];
}

/** SPEC §5: CF, poi telefono + cognome, poi solo nome; omonimi = nessuna. */
export function abbinaScheda(campi: CampiRiga, telefono: string, schede: SchedaPerAbbinamento[]): AbbinamentoScheda {
  return daFare("T4 abbinaScheda");
}
