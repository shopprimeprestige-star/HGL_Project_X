/** ── CHI TOCCA ADESSO ──────────────────────────────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat). SCHELETRO del compito 1: firme
 *  e costanti. Il compito 2 (Dev A) scrive i corpi e le prove in
 *  `prove/manychat/quando.mjs`. Chiamare una funzione non ancora scritta lancia
 *  un errore.
 *
 *  Modulo PURO: l'orologio e il numero a caso arrivano da fuori.
 *
 *  ── LE REGOLE (PIANO §2a, SPEC §6-7) ──────────────────────────────────────
 *   - promemoria: bersaglio −25' dal meet, si accetta da −30' a −15'; oltre →
 *     «saltato: giro in ritardo». Chiave `p|tel9|AAAA-MM-GGTHH:MM`. Al massimo 3
 *     promemoria per telefono e giorno di meet.
 *   - ricontatti: chiave `r|tel9|AAAA-MM-GG`; il giorno è `dataRicontatto` o
 *     quello di `callbackAt`; `oraRicontatto` facoltativa; dalle 9 alle 20 da
 *     lunedì a sabato, ora di Roma; recupero il giorno lavorativo dopo, UNA
 *     volta; mai una data precedente a `ultimaAccensione`. Due schede con lo
 *     stesso telefono fanno UNA voce.
 *   - ritmo fra due ricontatti: 27-33 minuti (numero casuale passato da fuori).
 *   - tetti: il minimo fra il valore del riquadro e le costanti qui sotto. Le
 *     costanti non si alzano da nessuna parte (né dal riquadro né dal browser).
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LeadData } from "../types";

/** Ricontatti al giorno. */
export const TETTO_RICONTATTI = 20;
/** Messaggi automatici in tutto al giorno (promemoria + ricontatti). */
export const TETTO_TOTALE = 40;
/** Ricontatti al giorno nei primi 7 giorni da `primaAccensione`. */
export const TETTO_PRIMA_SETTIMANA = 10;
/** Il ritmo fra due ricontatti, in minuti. */
export const RITMO_MIN = 27;
export const RITMO_MAX = 33;
/** Nessun nuovo invio a un telefono che ne ha avuto uno negli ultimi N secondi
 *  (le variabili `crm_*` stanno sul contatto: due invii vicini si pesterebbero). */
export const PAUSA_CONTATTO_S = 120;

/** Tre numeri: quanti messaggi, di che tipo, si possono mandare oggi. */
export interface Tetti {
  ricontatti: number;
  totale: number;
}

/** I tetti di oggi: il minimo fra il riquadro e le costanti (il riquadro a 500
 *  vale 20), con la prima settimana a 10 ricontatti. */
export function tettiDelGiorno(
  _riquadro: Partial<Tetti> | null | undefined,
  _primaAccensione: string | null | undefined,
  _adesso: Date,
): Tetti {
  throw new Error("manychat/quando: tettiDelGiorno non è ancora scritta (compito 2)");
}

/** Una scheda con il suo id, quanto serve a scegliere. */
export interface SchedaQuando {
  id: string;
  data: Partial<LeadData>;
}

export type DecisioneQuando<T> =
  | { tipo: "invia"; scheda: SchedaQuando; chiave: string; extra: T }
  | { tipo: "aspetta"; scheda: SchedaQuando; motivo: string }
  | { tipo: "salta"; scheda: SchedaQuando; motivo: string };

/** Quali promemoria toccano adesso (finestra −30'…−15' dal meet). */
export function decidiPromemoria(
  _schede: SchedaQuando[],
  _adesso: Date,
): DecisioneQuando<{ inizioMeet: Date }>[] {
  throw new Error("manychat/quando: decidiPromemoria non è ancora scritta (compito 2)");
}

/** La coda dei ricontatti di oggi, nell'ordine in cui toccano. */
export function codaRicontatti(
  _schede: SchedaQuando[],
  _adesso: Date,
  _ultimaAccensione: string | null | undefined,
): DecisioneQuando<{ giorno: string }>[] {
  throw new Error("manychat/quando: codaRicontatti non è ancora scritta (compito 2)");
}

/** Fra quanti minuti il prossimo ricontatto: 27-33. `caso` è un numero fra 0 e
 *  1 passato da fuori (`Math.random()` nelle porte vere, fisso nelle prove). */
export function intervalloRicontatto(_caso: number): number {
  throw new Error("manychat/quando: intervalloRicontatto non è ancora scritta (compito 2)");
}
