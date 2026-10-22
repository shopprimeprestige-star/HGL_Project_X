/** ── HA CONFERMATO O NO: QUELLO CHE VEDE LA SETTER IN «OGGI» ────────────────
 *
 *  Commessa 2026-10-22. Dalla scheda (`data.promemoria`) una sola risposta:
 *  nessuno (niente targhetta), confermato, inviato (attende, le prime 3 ore),
 *  non confermato con il perché in una frase.
 *
 *  ⚠️ VINCE IL PIÙ RECENTE fra il sì, la risposta diversa e lo STOP: «non
 *   posso» e poi «sì, va bene» è un sì; «sì» e poi «purtroppo non posso» no.
 *  ⚠️ UN SEGNO DI UN ALTRO ORARIO NON VALE: spostato l'appuntamento, finché il
 *   cron non manda la nuova conferma la targhetta tace invece di mostrare il
 *   sì dell'orario vecchio.
 *  ───────────────────────────────────────────────────────────────────────── */
import { eAppuntamento, type LeadData } from "../types";
import { chiaveAppuntamento, testoMotivo } from "./invio";
import { minutiAlla, oraNormale } from "./formati";

export const ATTESA_RISPOSTA_ORE = 3;
export const FINESTRA_DA_SENTIRE_ORE = 48;

export type StatoConferma =
  | { tipo: "nessuno" }
  | { tipo: "confermato"; via: "whatsapp" | "voce" }
  | { tipo: "inviato" }
  | { tipo: "nonConfermato"; nota: string };

/** Minuti all'appuntamento, `null` se non si legge. Con l'ora illeggibile
 *  conta il giorno intero. */
function mancanoA(d: Partial<LeadData>, adesso: Date): number | null {
  const giorno = String(d.dataMeeting ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(giorno)) return null;
  return minutiAlla(giorno, oraNormale(d.oraMeeting) ?? "23:59", adesso);
}

const tempo = (x?: string | null) => (x ? Date.parse(x) : -Infinity);

export function statoConferma(d: Partial<LeadData> | undefined, adesso: Date): StatoConferma {
  const nessuno = { tipo: "nessuno" } as const;
  const p = d?.promemoria;
  if (!d || !p || !p.stato || p.stato === "preesistente") return nessuno;
  if (!eAppuntamento(d.stato) || p.chiave !== chiaveAppuntamento(d)) return nessuno;
  const mancano = mancanoA(d, adesso);
  if (mancano === null || mancano <= 0) return nessuno;

  const si = tempo(p.confermatoIl);
  const altro = tempo(p.rispostaIl);
  const stop = tempo(p.stopIl);
  if (p.stopIl && stop >= si && stop >= altro)
    return { tipo: "nonConfermato", nota: "ha scritto STOP" };
  if (p.confermatoIl && si >= altro)
    return { tipo: "confermato", via: p.confermatoVia === "voce" ? "voce" : "whatsapp" };
  if (p.rispostaIl)
    return { tipo: "nonConfermato", nota: `ha risposto: “${p.rispostaTesto ?? ""}”` };

  if (p.stato === "in_invio") return { tipo: "inviato" };
  if (p.stato === "inviato") {
    const da = tempo(p.inviatoIl ?? p.invioIl);
    return adesso.getTime() - da >= ATTESA_RISPOSTA_ORE * 3600_000
      ? { tipo: "nonConfermato", nota: "non ha risposto" }
      : { tipo: "inviato" };
  }
  return { tipo: "nonConfermato", nota: testoMotivo(p.motivo ?? p.stato) };
}

/** Chi chiamare: non ha confermato, appuntamento nelle prossime 48 ore, dal
 *  più vicino. */
export function daSentire<T extends { id: string; data: Partial<LeadData> }>(
  leads: T[],
  adesso: Date,
): T[] {
  return leads
    .map((l) => ({ l, mancano: mancanoA(l.data, adesso) }))
    .filter(
      ({ l, mancano }) =>
        mancano !== null &&
        mancano > 0 &&
        mancano <= FINESTRA_DA_SENTIRE_ORE * 60 &&
        statoConferma(l.data, adesso).tipo === "nonConfermato",
    )
    .sort((a, b) => (a.mancano ?? 0) - (b.mancano ?? 0))
    .map(({ l }) => l);
}
