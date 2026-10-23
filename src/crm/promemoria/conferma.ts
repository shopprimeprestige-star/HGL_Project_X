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
import { aRoma, giornoParlato, minutiAlla, numeroPerWhatsapp, oraNormale } from "./formati";

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

/** Col canale ManyChat (commessa 2026-10-23) la conferma può fermarsi per il
 *  canale (flusso non collegato, ManyChat che rifiuta): la scheda non ha un
 *  messaggio partito ma la setter deve saperlo. */
export const FRASE_CANALE = "conferma non partita: WhatsApp in passaggio a ManyChat";
const FRASE_DA_COLLEGARE = "messaggio non partito: contatto ManyChat da collegare";

export function statoConferma(d: Partial<LeadData> | undefined, adesso: Date): StatoConferma {
  const nessuno = { tipo: "nessuno" } as const;
  const p = d?.promemoria;
  if (!d || !p) return nessuno;
  //  Segno tolto per il canale: la chiave c'è ancora, lo stato no. Vale solo
  //  per questo appuntamento (spostato, la chiave cambia e la targhetta tace).
  const perIlCanale = !p.stato && p.motivo === "canale";
  if (!perIlCanale && (!p.stato || p.stato === "preesistente")) return nessuno;
  if (!eAppuntamento(d.stato) || p.chiave !== chiaveAppuntamento(d)) return nessuno;
  const mancano = mancanoA(d, adesso);
  if (mancano === null || mancano <= 0) return nessuno;
  if (perIlCanale) return { tipo: "nonConfermato", nota: FRASE_CANALE };

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
  if (p.motivo === "da_collegare") return { tipo: "nonConfermato", nota: FRASE_DA_COLLEGARE };
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

/** «oggi 17:30», «domani 10:00», «sabato 24 ottobre 09:00». */
export function quandoDetto(d: Partial<LeadData>, adesso: Date): string {
  const giorno = String(d.dataMeeting ?? "");
  const ora = oraNormale(d.oraMeeting) ?? String(d.oraMeeting ?? "");
  const oggi = aRoma(adesso).giorno;
  const domani = aRoma(new Date(adesso.getTime() + 24 * 3600_000)).giorno;
  const g =
    giorno === oggi ? "oggi" : giorno === domani ? "domani" : (giornoParlato(giorno) ?? giorno);
  return `${g} ${ora}`.trim();
}

/** Il link del tasto Chiama: solo cifre (e il «+» davanti a un cellulare
 *  riconosciuto). Il telefono è testo libero: niente altro deve finire in un
 *  `href`. `null` = nessun tasto. */
export function linkChiamata(telefono?: string | null): string | null {
  const wa = numeroPerWhatsapp(telefono);
  if (wa) return `tel:+${wa}`;
  const cifre = String(telefono ?? "").replace(/\D/g, "");
  return cifre.length >= 6 ? `tel:${cifre}` : null;
}
