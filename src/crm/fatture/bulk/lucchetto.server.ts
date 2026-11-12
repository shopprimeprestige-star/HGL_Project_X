/** ── FATTURE BULK · LUCCHETTI CON SCADENZA (lucchetto.server.ts) ──
 *  SEGNAPOSTO di T0: i tipi e le firme ci sono, i corpi lanciano «da fare».
 *  Lo riempie T7. Lucchetto di emissione, reclamo di lettura e emittente del lotto:
 *  lo stesso schema (inserimento che fallisce se esiste + compare-and-swap alla
 *  scadenza) con chiave e durata parametriche. Non si tocca `dati-fattura.server.ts`. */

const daFare = (compito: string): never => {
  throw new Error(`da fare (${compito})`);
};

/** Le sole operazioni che servono, iniettate: si prova con un finto in memoria. */
export interface PortaLucchetto {
  /** Scrive solo se la chiave non esiste. true = scritta. */
  creaSeAssente: (key: string, value: string) => Promise<boolean>;
  leggi: (key: string) => Promise<string | null>;
  /** Compare-and-swap: sostituisce solo se il valore è ancora `atteso`. true = sostituita. */
  sostituisciSe: (key: string, atteso: string, nuovo: string) => Promise<boolean>;
  /** Cancella solo se il valore è ancora `atteso`. */
  eliminaSe: (key: string, atteso: string) => Promise<boolean>;
}

export type EsitoPresa = { ok: true } | { ok: false; scadeFraMs: number };

export function prendi(porta: PortaLucchetto, chiave: string, proprietario: string, durataMs: number, adesso: number): Promise<EsitoPresa> {
  return daFare("T7 prendi");
}

/** Rinnova la scadenza solo se il proprietario è lo stesso. */
export function rinnova(porta: PortaLucchetto, chiave: string, proprietario: string, durataMs: number, adesso: number): Promise<EsitoPresa> {
  return daFare("T7 rinnova");
}

/** Rilascia solo il proprio: se nel frattempo l'ha preso un altro, non toglie niente. */
export function rilascia(porta: PortaLucchetto, chiave: string, proprietario: string): Promise<void> {
  return daFare("T7 rilascia");
}

/** «Prendi il controllo»: si prende anche se vivo e azzera il «precedente» dell'emittente (D14). */
export function prendiIlControllo(porta: PortaLucchetto, chiave: string, proprietario: string, durataMs: number, adesso: number): Promise<void> {
  return daFare("T7 prendiIlControllo");
}
