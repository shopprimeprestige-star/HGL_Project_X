/** ── QUANTE VOLTE LO ABBIAMO CHIAMATO (31/10/2026) ──────────────────────────
 *
 *  Richiesta del titolare: «ogni volta che si clicca sulla cornetta ci sia un
 *  contatore, per tutte le volte che si clicca. Così si sa quanti tentativi
 *  sono stati fatti».
 *  Il conto sta sulla scheda (`data.chiamate`) e lo scrive `patchChiamata`.
 *
 *  ⚠️ SI AZZERA UNA VOLTA SOLA, ENTRANDO IN APPUNTAMENTO (decisione del titolare,
 *   31/10/2026: «si azzera al fissato»). Quando la scheda passa a «Appuntamento
 *   fissato» o «rifissato» le `volte` tornano a 0 e quelle azzerate vanno in
 *   `totale`, così il numero di sempre non si perde (`totaleChiamateDi`). Così,
 *   se poi il cliente salta e finisce in «Da riprogrammare», il conto riparte
 *   pulito e non si porta dietro i tentativi fatti per fissare la prima volta.
 *   Non scatta in uscita, né da fissato a rifissato, né salvando il modulo di
 *   una scheda che è già un appuntamento: solo sull'ingresso.
 *   `patchAzzeraChiamate` è pura e va chiamata da OGNI punto che scrive uno
 *   stato verso l'appuntamento (updateLead, prenota-scheda, rotta del
 *   consulente): una prova (prove/idee/chiamate-azzera.mjs) legge il sorgente
 *   e fallisce se un file che lo scrive non la chiama.
 *  ⚠️ `chiamate` la scrivono solo il tocco sulla cornetta e il «torna
 *   indietro»: `updateLead` la toglie dalle modifiche dei moduli (`senzaChiamate`),
 *   che altrimenti riporterebbero indietro un conto vecchio.
 *  ───────────────────────────────────────────────────────────────────────── */
import { eAppuntamento, type LeadData } from "./types";

export interface ChiamateLead {
  /** i tocchi sulla cornetta, dal primo */
  volte: number;
  /** ISO del primo tocco */
  prima: string;
  /** ISO dell'ultimo tocco */
  ultima: string;
  /** le volte già azzerate (entrando in appuntamento), da sommare a `volte` per il totale di sempre */
  totale?: number;
  /** ISO dell'ultimo azzeramento */
  azzerateIl?: string;
}

const conto = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};
const contoDi = (d: Partial<LeadData> | null | undefined) =>
  (d as { chiamate?: Partial<ChiamateLead> } | null | undefined)?.chiamate;

/** Quante volte si è toccata la cornetta per questa scheda dall'ultimo azzeramento (0 se mai). */
export function chiamateDi(d: Partial<LeadData> | null | undefined): number {
  return conto(contoDi(d)?.volte);
}

/** Le chiamate di sempre: quelle già azzerate più quelle di adesso. */
export function totaleChiamateDi(d: Partial<LeadData> | null | undefined): number {
  return conto(contoDi(d)?.totale) + chiamateDi(d);
}

/** Un tocco in più: il conto sale, la prima volta resta. */
export function patchChiamata(
  d: Partial<LeadData> | null | undefined,
  ora: Date = new Date(),
): { chiamate: ChiamateLead } {
  const prima = contoDi(d);
  const adesso = ora.toISOString();
  return {
    chiamate: {
      //  ⚠️ `totale` e `azzerateIl` restano: il tocco sale sopra un conto azzerato, non lo riscrive.
      ...(prima?.totale !== undefined ? { totale: conto(prima.totale) } : {}),
      ...(typeof prima?.azzerateIl === "string" ? { azzerateIl: prima.azzerateIl } : {}),
      volte: chiamateDi(d) + 1,
      prima: typeof prima?.prima === "string" && prima.prima ? prima.prima : adesso,
      ultima: adesso,
    },
  };
}

/** «Chiamato 3 volte» per il title e chi usa lo screen reader. */
export const frasiChiamate = (n: number): string =>
  n === 0 ? "Mai chiamato" : n === 1 ? "Chiamato 1 volta" : `Chiamato ${n} volte`;

/** «Chiamato 1 volta (5 in tutto)»: il title del tondino. Il «in tutto» compare
 *  solo se il conto è stato azzerato almeno una volta. */
export function titoloChiamate(d: Partial<LeadData> | null | undefined): string {
  const n = chiamateDi(d);
  const tutto = totaleChiamateDi(d);
  return tutto > n ? `${frasiChiamate(n)} (${tutto} in tutto)` : frasiChiamate(n);
}

/** ── L'AZZERAMENTO ────────────────────────────────────────────────────────
 *  `prima` = la scheda com'era in archivio, `dopo` = com'è diventata (stato
 *  finale incluso). Vuota quando non c'è niente da scrivere: non è un ingresso
 *  in appuntamento, o non c'è nessun conto da portare a zero. */
export function patchAzzeraChiamate(
  prima: Partial<LeadData> | null | undefined,
  dopo: Partial<LeadData> | null | undefined,
  ora: Date = new Date(),
): { chiamate?: ChiamateLead } {
  if (!eAppuntamento(dopo?.stato) || eAppuntamento(prima?.stato)) return {};
  const volte = chiamateDi(dopo);
  if (volte === 0) return {};
  const c = contoDi(dopo) as ChiamateLead;
  return {
    chiamate: {
      ...c,
      volte: 0,
      totale: conto(c.totale) + volte,
      azzerateIl: ora.toISOString(),
    },
  };
}

/** La modifica di un modulo senza `chiamate`, salvo che chi salva sia chi la scrive davvero
 *  (il tocco sulla cornetta, il «torna indietro»). Un modulo aperto prima di una chiamata o
 *  di un azzeramento porta un conto vecchio: riscriverlo lo riporterebbe indietro. */
export function senzaChiamate<T extends object>(modifica: T, ammesse: boolean): T {
  if (ammesse || !("chiamate" in modifica)) return modifica;
  const { chiamate: _vecchio, ...resto } = modifica as T & { chiamate?: unknown };
  void _vecchio;
  return resto as T;
}
