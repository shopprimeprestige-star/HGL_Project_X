/** ── FATTURE BULK · LA CODA DELLA LETTURA (coda.ts) ──
 *  SEGNAPOSTO di T0: i tipi e le firme ci sono, i corpi lanciano «da fare».
 *  Lo riempie T8. Pura: tempi e attese iniettati, nessun `setTimeout` diretto.
 *  3 in parallelo, UN solo livello di ripetizioni (2 s e 5 s su rete/429/5xx/timeout,
 *  mai su troncata, credito, 4xx), freno a 5 fallimenti di fila, annullabile. */
import type { CodiceErrore } from "./tipi";

const daFare = (compito: string): never => {
  throw new Error(`da fare (${compito})`);
};

export interface OpzioniCoda<T, R> {
  elementi: T[];
  /** Lavora un elemento; lancia un `ErroreCoda` per i fallimenti. */
  esegui: (elemento: T, tentativo: number) => Promise<R>;
  attendi: (ms: number) => Promise<void>;
  inParallelo?: number;
  segnale?: AbortSignal;
  /** Notifica ogni elemento finito (bene o male), nell'ordine in cui finiscono. */
  perOgnuno?: (indice: number, esito: { ok: true; valore: R } | { ok: false; codice: CodiceErrore }) => void;
}

export interface RisultatoCoda<R> {
  /** Nell'ordine degli elementi, indipendente da chi finisce prima. `undefined` = non fatto. */
  esiti: ({ ok: true; valore: R } | { ok: false; codice: CodiceErrore } | undefined)[];
  /** Fermata dal freno o dall'annullamento. */
  fermataPer?: "freno" | "annullata";
  codiceFreno?: CodiceErrore;
}

export function eseguiCoda<T, R>(opzioni: OpzioniCoda<T, R>): Promise<RisultatoCoda<R>> {
  return daFare("T8 eseguiCoda");
}
