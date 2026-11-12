/** ── FATTURE BULK · REGOLE DI RIGA (regole-riga.ts) ──
 *  SEGNAPOSTO di T0: i tipi e le firme ci sono, i corpi lanciano «da fare».
 *  Lo riempie T3 (PIANO §5); il file è suo e di nessun altro.
 *  Motivi e gravità. La data anteriore all'ultima emessa NON è qui: è esitoOrdineDate (T7). */
import type { CampiRiga, ContestoRiga, EsitoStato, Motivo } from "./tipi";

const daFare = (compito: string): never => {
  throw new Error(`da fare (${compito})`);
};

/** Tutti i motivi per cui la riga non è pronta (obbligatori, coerenza, soglie, date, modo, caratteri…). */
export function esaminaRiga(campi: CampiRiga, ctx: ContestoRiga): Motivo[] {
  return daFare("T3 esaminaRiga");
}

/** Stato visibile (`pronto` | `da_controllare` | `errore`) ed `emettibile`. `confermati` = codici accettati. */
export function statoDi(motivi: Motivo[], confermati: string[], rigaConfermata: boolean): EsitoStato {
  return daFare("T3 statoDi");
}
