/** ── FATTURE BULK · LA FUNZIONE FISCALE ISOLATA (da-importo-a-fattura.ts) ──
 *  SEGNAPOSTO di T0: i tipi e le firme ci sono, i corpi lanciano «da fare».
 *  Lo riempie T5 (PIANO §5); il file è suo e di nessun altro.
 *  L'UNICO punto che trasforma «importo pagato + impostazioni» in fattura. */
import type { DatiAzienda, Fattura } from "../tipi";
import type { CampiRiga } from "./tipi";

const daFare = (compito: string): never => {
  throw new Error(`da fare (${compito})`);
};

export interface IngressoFatturaDaRiga {
  campi: CampiRiga;
  azienda: DatiAzienda;
  lotto: string;
  idRiga: string;
  descrizione: string;
  /** Scheda abbinata; null → `leadId` sintetico `bulk:<lotto>:<idRiga>`, mai vuoto (D5). */
  leadId: string | null;
  /** Numero provvisorio per la simulazione; il vero lo dà l'emissione. */
  numeroProvvisorio: number;
  /** Impronte dei file della riga (solo hash). */
  impronte: string[];
}

/** Una `Fattura` «unica», una riga, con `origineBulk`. Rifiuta acconto/saldo. */
export function fatturaDaRiga(i: IngressoFatturaDaRiga): Fattura {
  return daFare("T5 fatturaDaRiga");
}

/** Il totale che finirebbe nell'XML (dal testo di `costruisciXml`, senza toccare xml.ts): per l'avviso R10. */
export function totaleNelFile(f: Fattura, azienda: DatiAzienda): number {
  return daFare("T5 totaleNelFile");
}

/** Data + 12 giorni di calendario (stima, D1/D15). */
export function ultimoGiornoUtile(data: string): string {
  return daFare("T5 ultimoGiornoUtile");
}
