/** ── LEAD DI OGGI E SPESA PER GIORNO · IL CALCOLO (30/10/2026) ──────────────
 *
 *  Dietro il tasto WhatsApp della chat: quanti lead sono arrivati ogni giorno,
 *  quanto si è speso in pubblicità, quanto costa un lead. Puro: niente database,
 *  niente React. Prove in `prove/spesa-lead.mjs`.
 *
 *  ⚠️ IL GIORNO È QUELLO DI ROMA. Il Worker gira in UTC e `createdAt` è un ISO in
 *   UTC: un lead arrivato alle 00:30 di Roma è del giorno prima per `slice(0,10)`.
 *   Qui si converte con `aRoma`, come per i costi WhatsApp.
 *  ⚠️ LA SPESA È QUELLA DEL REGISTRO KPI (`kpi/spesa`), con la stessa regola: se un
 *   giorno ha una registrazione a mano vince lei, altrimenti vale la spesa Meta
 *   sincronizzata. Sommarle conterebbe due volte la stessa giornata. La stima
 *   TikTok non c'è: non è una spesa inserita, e qui il costo per lead deve
 *   tornare con le cifre scritte dal titolare.
 *  ⚠️ «ARRIVATO OGGI» NON È «CARICATO OGGI». Una lista da file senza la data nel
 *   file ha `createdAt` = l'ora del caricamento: centinaia di vecchi contatti
 *   diventerebbero lead di oggi. Si scartano (arrivo sconosciuto). */
import type { AdSpending, LeadData } from "../types";
import { aRoma } from "../promemoria/formati";

export const GIORNI_ELENCO = 30;
export const PERIODI_TOTALE = [7, 30] as const;

const UN_GIORNO = /^\d{4}-\d{2}-\d{2}$/;

/** Il giorno di Roma (AAAA-MM-GG) in cui è arrivato il lead, o `null` se non si sa. */
export function giornoDiArrivo(d: Partial<LeadData> | null | undefined): string | null {
  if (!d || typeof d !== "object") return null;
  //  Dal foglio Google: l'ingresso nel CRM. Poi la lista da file, ma solo se la
  //  data viene dal file. Poi createdAt.
  const lista = d.listaOrigine;
  if (!d.origineIngresso?.il && lista && typeof lista === "object" && !lista.dataDalFile)
    return null;
  const grezzo = String(d.origineIngresso?.il || d.createdAt || "").trim();
  if (!grezzo) return null;
  if (UN_GIORNO.test(grezzo)) return grezzo;
  const t = Date.parse(grezzo);
  return Number.isFinite(t) ? aRoma(new Date(t)).giorno : null;
}

/** Gli ultimi `n` giorni di Roma, oggi per primo. */
export function giorniRecenti(adesso: Date, n = GIORNI_ELENCO): string[] {
  const [a, m, g] = aRoma(adesso).giorno.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < n; i++)
    out.push(new Date(Date.UTC(a, m - 1, g - i)).toISOString().slice(0, 10));
  return out;
}

/** Quanti lead sono arrivati in ciascuno dei giorni dati. */
export function leadPerGiorno(
  leads: { data?: Partial<LeadData> | null }[] | null | undefined,
  giorni: string[],
): Map<string, number> {
  const conto = new Map(giorni.map((g) => [g, 0]));
  for (const l of Array.isArray(leads) ? leads : []) {
    const g = giornoDiArrivo(l?.data);
    if (g && conto.has(g)) conto.set(g, (conto.get(g) ?? 0) + 1);
  }
  return conto;
}

export type OrigineSpesaGiorno = "mano" | "meta";

export interface SpesaGiorno {
  /** `null` = nessuna spesa registrata (diverso da 0). */
  euro: number | null;
  origine: OrigineSpesaGiorno | null;
  /** Quante registrazioni a mano ci sono quel giorno. */
  registrazioni: number;
}

const numero = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** La spesa di un giorno: a mano se c'è (somma delle registrazioni), altrimenti Meta. */
export function spesaDelGiorno(
  giorno: string,
  aMano: (AdSpending | null | undefined)[] | null | undefined,
  meta: Map<string, number>,
): SpesaGiorno {
  const righe = (Array.isArray(aMano) ? aMano : []).filter(
    (s) => String(s?.data?.data ?? "").slice(0, 10) === giorno,
  );
  if (righe.length > 0) {
    const euro = righe.reduce((t, s) => t + numero(s?.data?.importoSpeso), 0);
    return { euro, origine: "mano", registrazioni: righe.length };
  }
  const m = numero(meta.get(giorno));
  return m > 0
    ? { euro: m, origine: "meta", registrazioni: 0 }
    : { euro: null, origine: null, registrazioni: 0 };
}

/** Spesa ÷ lead. `null` (trattino) senza lead o senza spesa: mai Infinity, mai 0 finto. */
export function costoPerLead(spesa: number | null, lead: number): number | null {
  if (spesa === null || !Number.isFinite(spesa) || spesa <= 0) return null;
  if (!Number.isFinite(lead) || lead <= 0) return null;
  return spesa / lead;
}

export interface RigaGiorno extends SpesaGiorno {
  giorno: string;
  lead: number;
  costoLead: number | null;
}

export function righeGiorni({
  giorni,
  leads,
  aMano,
  meta,
}: {
  giorni: string[];
  leads: { data?: Partial<LeadData> | null }[] | null | undefined;
  aMano: (AdSpending | null | undefined)[] | null | undefined;
  meta: Map<string, number>;
}): RigaGiorno[] {
  const conto = leadPerGiorno(leads, giorni);
  return giorni.map((giorno) => {
    const lead = conto.get(giorno) ?? 0;
    const spesa = spesaDelGiorno(giorno, aMano, meta);
    return { giorno, lead, ...spesa, costoLead: costoPerLead(spesa.euro, lead) };
  });
}

export interface TotalePeriodo {
  lead: number;
  spesa: number;
  giorniConSpesa: number;
  /** I lead dei soli giorni con spesa: il costo si calcola su questi. */
  leadConSpesa: number;
  costoLead: number | null;
}

/** Il totale delle righe date. Il costo per lead divide per i lead dei giorni CON
 *  spesa: dividere per tutti darebbe un costo troppo basso se un giorno non è
 *  stato registrato. */
export function totale(righe: RigaGiorno[]): TotalePeriodo {
  let lead = 0;
  let spesa = 0;
  let giorniConSpesa = 0;
  let leadConSpesa = 0;
  for (const r of righe) {
    lead += r.lead;
    if (r.euro !== null && r.euro > 0) {
      spesa += r.euro;
      giorniConSpesa++;
      leadConSpesa += r.lead;
    }
  }
  return {
    lead,
    spesa,
    giorniConSpesa,
    leadConSpesa,
    costoLead: costoPerLead(spesa, leadConSpesa),
  };
}
