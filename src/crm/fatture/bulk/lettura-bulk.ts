/** ── FATTURE BULK · LETTURA DEL GRUPPO (lettura-bulk.ts) ──
 *  SEGNAPOSTO di T0: i tipi e le firme ci sono, i corpi lanciano «da fare».
 *  Lo riempie T1 (PIANO §5); il file è suo e di nessun altro.
 *  Prompt inglese, parametri della richiesta (D12), normalizzazione. Non una terza copia di normalizzaDocumento. */
import type { LetturaFile } from "./tipi";

const daFare = (compito: string): never => {
  throw new Error(`da fare (${compito})`);
};

/** Il testo di istruzioni all'AI per un gruppo di immagini (T1). */
export const PROMPT_GRUPPO = "";
/** Il modello: stesso di api.crm.documento e dati-fattura.server (terza costante, con rimando). */
export const MODELLO_AI = "";
/** `max_tokens`, ragionamento spento/limitato e `provider.data_collection: "deny"` (D12). */
export const PARAMETRI_RICHIESTA: Record<string, unknown> = {};

/** Esito della lettura di un gruppo: una voce per immagine, oppure un errore (es. `troncata`). */
export type RisultatoLettura = { ok: true; letture: LetturaFile[] } | { ok: false; codice: "troncata" | "illeggibile" };

/** Legge la risposta dell'AI per `n` immagini; le mancanti diventano `altro` vuoto. */
export function leggiRispostaGruppo(testo: string, n: number, fineRisposta?: string): RisultatoLettura {
  return daFare("T1 leggiRispostaGruppo");
}

/** Una voce della risposta → `LetturaFile` ripulita (CF, CAP, provincia, importi, cognome del pagante, telefono a 9 cifre). */
export function normalizzaLetturaFile(voce: Record<string, unknown>): LetturaFile {
  return daFare("T1 normalizzaLetturaFile");
}
