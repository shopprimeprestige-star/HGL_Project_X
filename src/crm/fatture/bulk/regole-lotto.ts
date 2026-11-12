/** ── FATTURE BULK · REGOLE DI LOTTO (regole-lotto.ts) ──
 *  SEGNAPOSTO di T0: i tipi e le firme ci sono, i corpi lanciano «da fare».
 *  Lo riempie T5 (PIANO §5); il file è suo e di nessun altro.
 *  Allineato a NOTE-FISCALI e VERIFICA-FISCALE: se il commercialista cambia qualcosa, si cambia qui e in da-importo-a-fattura.ts. */
import type { DatiAzienda, Fattura } from "../tipi";
import type { Motivo } from "./tipi";

const daFare = (compito: string): never => {
  throw new Error(`da fare (${compito})`);
};

/** R2-R4 e i bloccanti «CHI EMETTE» di `problemiXml`: se non vuoto con un `blocca`, il lotto non parte. */
export function controllaLotto(azienda: DatiAzienda): Motivo[] {
  return daFare("T5 controllaLotto");
}

/** Firma delle impostazioni: se cambia a metà lavoro l'emissione si ferma (R1). Nessun dato leggibile dentro. */
export function firmaImpostazioni(azienda: DatiAzienda): string {
  return daFare("T5 firmaImpostazioni");
}

export interface RigaRiepilogoCommercialista {
  numero: string;
  data: string;
  cliente: string;
  codiceFiscale: string;
  imponibile: number;
  iva: number;
  totale: number;
  modo: string;
  riferimento: string;
  /** Mese di competenza IVA (AAAA-MM) = mese del pagamento. */
  meseCompetenza: string;
  ultimoGiornoUtile: string;
}

export function righeRiepilogoCommercialista(fatture: Fattura[]): RigaRiepilogoCommercialista[] {
  return daFare("T5 righeRiepilogoCommercialista");
}
