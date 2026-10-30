/** ── I SEGNI NELLA RIGA DELL'ELENCO: CONFERMA E FINESTRA IN SCADENZA ─────────
 *  Idee 1 e 7 approvate dal titolare (30/10/2026). Solo per i lead con
 *  l'appuntamento fissato o rifissato, e solo se non è passato.
 *  - CONFERMA: «✓ Confermato» (verde) se il cliente ha risposto sì, «Da
 *    confermare» (arancione) in tutti gli altri casi, anche se il promemoria
 *    non è ancora partito. Si vede dall'elenco chi va sentito, senza aprire la
 *    scheda. Il «sì» lo decide `statoConferma`, qui non si rifà.
 *  - FINESTRA IN SCADENZA: la finestra di 24 ore è ancora aperta ma chiude
 *    entro 4 ore: «chiude tra 2h 10m». Scopo: scrivere gratis prima che serva
 *    un modello a pagamento. Nel filtro «24h aperto» queste chat stanno in cima
 *    (`ordinaPerScadenza`), dalla scadenza più vicina.
 *  Puro, provato in prove/idee/righe.mjs.
 *  ───────────────────────────────────────────────────────────────────────── */
import { eAppuntamento, type LeadData } from "../types";
import { statoConferma } from "../promemoria/conferma";
import { minutiAlla, oraNormale } from "../promemoria/formati";

/** «Nei prossimi giorni»: oltre questa soglia il segno non serve ancora. */
export const GIORNI_SEGNO_CONFERMA = 7;
/** La finestra «in scadenza»: chiude entro tante ore. */
export const ORE_IN_SCADENZA = 4;

export interface SegnoConferma {
  tipo: "confermato" | "daConfermare";
  testo: string;
  titolo: string;
}

/** Il segno di conferma per la riga, o `null` (non è un appuntamento, è passato, è lontano). */
export function segnoConferma(
  dati: Partial<LeadData> | undefined | null,
  adesso: Date,
): SegnoConferma | null {
  if (!dati || !eAppuntamento(dati.stato)) return null;
  const giorno = String(dati.dataMeeting ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(giorno)) return null;
  //  Con l'ora illeggibile conta il giorno intero (come in `statoConferma`).
  const mancano = minutiAlla(giorno, oraNormale(dati.oraMeeting) ?? "23:59", adesso);
  if (mancano <= 0 || mancano > GIORNI_SEGNO_CONFERMA * 24 * 60) return null;
  return statoConferma(dati, adesso).tipo === "confermato"
    ? { tipo: "confermato", testo: "Confermato", titolo: "Il cliente ha confermato la consulenza" }
    : {
        tipo: "daConfermare",
        testo: "Da confermare",
        titolo: "Il cliente non ha ancora confermato la consulenza",
      };
}

export interface ScadenzaFinestra {
  /** Minuti alla chiusura (almeno 1). */
  minuti: number;
  /** «chiude tra 2h 10m», «chiude tra 45 min». */
  testo: string;
  titolo: string;
}

/** Quanto resta, corto: «2h 10m», «3h», «45 min». */
export function restaInBreve(minuti: number): string {
  const m = Math.max(1, Math.floor(minuti));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 ? `${h}h ${m % 60}m` : `${h}h`;
}

/** La scadenza in arrivo di una chat, o `null`: serve l'appuntamento fissato, la finestra
 *  aperta con la sua `scadeIl`, e la chiusura entro `ORE_IN_SCADENZA` ore. */
export function scadenzaFinestra(
  c: {
    lead?: { data?: { stato?: string | null } | null } | null;
    finestra?: { aperta: boolean; scadeIl?: string | null } | null;
  },
  adesso: number,
): ScadenzaFinestra | null {
  if (!eAppuntamento(c.lead?.data?.stato)) return null;
  if (!c.finestra?.aperta || !c.finestra.scadeIl) return null;
  const scade = Date.parse(c.finestra.scadeIl);
  if (!Number.isFinite(scade)) return null;
  const minuti = Math.ceil((scade - adesso) / 60_000);
  if (minuti <= 0 || minuti > ORE_IN_SCADENZA * 60) return null;
  return {
    minuti,
    testo: `chiude tra ${restaInBreve(minuti)}`,
    titolo: "Finestra di 24 ore in chiusura: scrivi ora, gratis, prima che serva un modello",
  };
}

/** Le chat in scadenza, dalla più vicina alla chiusura; le altre non ci sono. Non muta l'ingresso. */
export function ordinaPerScadenza<
  T extends {
    lead?: { data?: { stato?: string | null } | null } | null;
    finestra?: { aperta: boolean; scadeIl?: string | null } | null;
  },
>(righe: T[], adesso: number): T[] {
  return righe
    .map((c) => ({ c, s: scadenzaFinestra(c, adesso) }))
    .filter((x): x is { c: T; s: ScadenzaFinestra } => x.s !== null)
    .sort((a, b) => a.s.minuti - b.s.minuti)
    .map((x) => x.c);
}
