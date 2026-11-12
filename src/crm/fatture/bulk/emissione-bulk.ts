/** ── FATTURE BULK · EMISSIONE SICURA (emissione-bulk.ts) ──
 *  SEGNAPOSTO di T0: i tipi e le firme ci sono, i corpi lanciano «da fare».
 *  Lo riempie T7, DOPO T6 (che aggiunge `creaSeAssente` a ArchivioDb in archivio.ts:
 *  qui, quando c'è, si aggiunge anche al tipo `ArchivioProtetto`). Il file è suo.
 *  Porte iniettate (l'archivio), così si prova con un archivio finto in memoria. */
import type { ArchivioDb } from "../archivio";
import type { DatiAzienda, Fattura } from "../tipi";
import type { FattiSulleDate, Gravita, Motivo } from "./tipi";

const daFare = (compito: string): never => {
  throw new Error(`da fare (${compito})`);
};

/** ⚠️ UNA SOLA COSTANTE per la gravità della data anteriore all'ultima emessa (D1): se il
 *  commercialista la vuole bloccante, si cambia questa riga e basta. */
export const GRAVITA_DATA_ANTERIORE: Gravita = "conferma";

/** `archivioSu` più: lettura per chiave paginata (`gt key`, `limit 1000`), `leggiMolte(keys)`,
 *  `eliminaPerPrefisso` in una chiamata sola (con la stessa protezione di «_»). */
export interface ArchivioProtetto extends ArchivioDb {
  leggiPrefissoPerChiave: (prefisso: string) => Promise<{ key: string; value: string }[]>;
  leggiMolte: (chiavi: string[]) => Promise<{ key: string; value: string }[]>;
  eliminaPerPrefisso: (prefisso: string) => Promise<string | null>;
}

export function archivioProtettoSu(client: unknown): ArchivioProtetto {
  return daFare("T7 archivioProtettoSu");
}

export type EsitoEmissioneProtetta =
  | { ok: true; fattura: Fattura }
  | { ok: false; codice: "conflitto" | "scrittura_fallita" | "altra_origine"; errore: string };

/** Numera con `prossimoNumeroSu` (lettura paginata), scrive senza sovrascrivere, NON elimina bozze,
 *  una ripetizione su conflitto, poi rilegge la chiave e verifica `origineBulk` (D10). */
export function emettiProtettoSu(
  archivio: ArchivioProtetto,
  fattura: Fattura,
  azienda: DatiAzienda,
  data: string,
): Promise<EsitoEmissioneProtetta> {
  return daFare("T7 emettiProtettoSu");
}

/** La fattura già emessa per quella riga di quel lotto, se c'è (ripresa dopo risposta persa). */
export function cercaPerOrigine(emesse: Fattura[], lotto: string, idRiga: string): Fattura | null {
  return daFare("T7 cercaPerOrigine");
}

/** Per data di pagamento crescente, parità = ordine di caricamento (D2). Non muta l'input. */
export function ordineEmissione<T extends { numero: number; data: string }>(righe: T[]): T[] {
  return daFare("T7 ordineEmissione");
}

/** UNICO punto che decide cosa succede se la data è anteriore all'ultima emessa (D1). */
export function esitoOrdineDate(data: string, emesse: Fattura[]): Motivo | null {
  return daFare("T7 esitoOrdineDate");
}

export function fattiSulleDate(
  righe: { idRiga: string; data: string }[],
  emesse: Fattura[],
  azienda: DatiAzienda,
  oggi: string,
): FattiSulleDate {
  return daFare("T7 fattiSulleDate");
}

/** Dopo un esito: proseguire, saltare la riga o fermare il lotto (D2, D14: un salto di numero NON ferma). */
export function decidiDopoEsito(esito: EsitoEmissioneProtetta | { ok: false; codice: "non_emettibile" }): "prosegui" | "salta" | "ferma" {
  return daFare("T7 decidiDopoEsito");
}
