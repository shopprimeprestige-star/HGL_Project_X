// ── LA FINESTRA DEL PERIODO, DETTA IN DATE ──────────────────────────────────
//  `creaFiltroPeriodo` (kpi-calcoli) restituisce un FILTRO, non due date: è
//  quello che serve per tagliare gli elenchi, ma non basta né per interrogare
//  il database (che vuole due estremi) né per SCRIVERE IN PAGINA su cosa si sta
//  guardando.
//
//  ── PERCHÉ IL PERIODO VA SCRITTO CON LE DATE ──────────────────────────────
//  «30 giorni» è una finestra mobile che parte dall'ora corrente: due persone
//  che guardano la stessa linguetta a due ore di distanza vedono due finestre
//  diverse, e nessuna delle due lo sa. Scritto «ultimi 30 giorni · 15 lug –
//  14 ago» il numero si può ripetere a voce, confrontare con il mese scorso e
//  incollare in un messaggio senza ambiguità.
//
//  ⚠️ QUI NON SI CALCOLA NESSUN KPI. Si ricavano gli estremi con LO STESSO
//  conteggio all'indietro del filtro, e ogni riga scaricata dal database viene
//  comunque fatta ripassare dal filtro vero: se le due cose divergessero
//  vincerebbe il filtro, cioè la regola condivisa con tutte le schede.

import type { Intervallo } from "@/crm/kpi-calcoli";
import { oggiIso } from "@/crm/ui";

export interface Estremi {
  /** Primo giorno della finestra, «AAAA-MM-GG». */
  da: string;
  /** Ultimo giorno della finestra, «AAAA-MM-GG». */
  a: string;
  /** Quanti giorni copre la finestra. `null` su «Tutto»: non è misurabile, e
   *  fingere un numero renderebbe calcolabile una copertura che non lo è. */
  giorni: number | null;
}

/** ── I CONFINI DELLA FINESTRA ──────────────────────────────────────────────
 *  «Tutto» non ha un inizio: si parte da una data abbastanza vecchia da
 *  contenere qualunque storico, senza inventare un limite. */
export function estremiPeriodo(intervallo: Intervallo): Estremi {
  const oggi = new Date();
  if (intervallo === "tutto") return { da: "2000-01-01", a: oggiIso(oggi), giorni: null };
  if (intervallo === "oggi") return { da: oggiIso(oggi), a: oggiIso(oggi), giorni: 1 };
  if (intervallo === "ieri") {
    const ieri = new Date(oggi);
    ieri.setDate(ieri.getDate() - 1);
    return { da: oggiIso(ieri), a: oggiIso(ieri), giorni: 1 };
  }
  const n = Number(intervallo);
  const da = new Date(oggi);
  da.setDate(da.getDate() - n);
  //  n+1 perché la finestra comprende sia il giorno di partenza sia oggi.
  return { da: oggiIso(da), a: oggiIso(oggi), giorni: n + 1 };
}

/** L'elenco dei giorni della finestra, uno per uno. Serve a distribuire una
 *  spesa che il fornitore dà solo come budget giornaliero e a trovare i giorni
 *  in cui non è stato registrato niente. */
export function giorniDellaFinestra(da: string, a: string): string[] {
  const out: string[] = [];
  const d = new Date(`${da}T00:00:00`);
  const fine = new Date(`${a}T00:00:00`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(fine.getTime())) return out;
  //  Tetto di sicurezza: senza, «Tutto» genererebbe novemila righe finte per
  //  una stima che su quel periodo non ha comunque senso.
  for (let i = 0; d <= fine && i < 400; i++) {
    out.push(oggiIso(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const FMT_GIORNO_CORTO = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" });

//  Il giorno della settimana non è decorazione: un lunedì a zero lead e un
//  sabato a zero lead sono due fatti diversi, e senza il nome del giorno si
//  finisce a contare sul calendario.
const FMT_GIORNO = new Intl.DateTimeFormat("it-IT", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** «mar 12 ago». Una data illeggibile si restituisce com'è: nell'archivio
 *  importato capita, ed è meglio vedere la stringa storta che «Invalid Date». */
export function giornoBreve(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : FMT_GIORNO.format(d);
}

/** «15 lug», senza il giorno della settimana: per gli estremi di un periodo il
 *  nome del giorno è rumore. */
export function giornoCorto(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : FMT_GIORNO_CORTO.format(d);
}

const NOME_INTERVALLO: Record<Intervallo, string> = {
  oggi: "oggi",
  ieri: "ieri",
  "3": "ultimi 3 giorni",
  "7": "ultimi 7 giorni",
  "15": "ultimi 15 giorni",
  "30": "ultimi 30 giorni",
  "60": "ultimi 60 giorni",
  "90": "ultimi 90 giorni",
  tutto: "tutto lo storico",
};

/** ── IL PERIODO SCRITTO PER ESTESO ─────────────────────────────────────────
 *  «ultimi 30 giorni · 15 lug – 14 ago». Su «Tutto» non ci sono estremi da
 *  scrivere: si dice che non c'è un taglio, invece di stampare una data del
 *  2000 che nessuno ha scelto. */
export function etichettaPeriodo(intervallo: Intervallo, estremi: Estremi): string {
  const nome = NOME_INTERVALLO[intervallo];
  if (intervallo === "tutto") return `${nome} · nessun taglio di data`;
  if (estremi.da === estremi.a) return `${nome} · ${giornoCorto(estremi.a)}`;
  return `${nome} · ${giornoCorto(estremi.da)} – ${giornoCorto(estremi.a)}`;
}
