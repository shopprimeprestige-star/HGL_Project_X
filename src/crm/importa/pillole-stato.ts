/** ── LE OTTO PILLOLE DELLO STATO ───────────────────────────────────────────
 *
 *  Commessa 2026-10-28 «Lead importati semplice». Una sola riga di pillole,
 *  nell'ordine in cui il lead cammina davvero:
 *    Tutta la coda → Da contattare → Attesa WhatsApp → Da chiamare →
 *    Non ha risposto → Richiamo concordato → Ci ricontatta lui → Di ritorno.
 *
 *  Qui c'è solo l'elenco, i nomi e quali pillole accendere per un valore del
 *  filtro Stato: chi sta in quale pillola lo decide `cadeNelloStato`
 *  (filtri-lista) e i numeri li conta `opzioniFiltri`, le stesse funzioni dei
 *  filtri. Una pillola non ha un conto suo: se ne avesse uno, prima o poi
 *  direbbe un numero e toccandola ne uscirebbe un altro.
 *
 *  ⚠️ NIENTE SI ROMPE: i valori vecchi dell'indirizzo (`nonRisponde`,
 *   `segreteria`, `ritentare`) diventano `nonRisposto` prima di arrivare alla
 *   pagina (`conStatoCanonico`); `promesse` resta com'è, perché serve al link
 *   dei richiami scaduti, e accende insieme «Richiamo concordato» e «Ci
 *   ricontatta lui».
 *  ⚠️ UNA PILLOLA A ZERO NON SI MOSTRA, salvo quella accesa (altrimenti non si
 *   potrebbe spegnere). La regola è `voceStatoAttiva` di reparti.ts.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { StatoFiltro } from "./filtri-lista";
import { voceStatoAttiva } from "./reparti";

export type PillolaId =
  | "tutti"
  | "mai"
  | "whatsapp"
  | "daChiamare"
  | "nonRisposto"
  | "richiamo"
  | "ciRicontatta"
  | "ritorno";

/** Le pillole, nell'ordine in cui si vedono. La prima è quella di partenza. */
export const PILLOLE: PillolaId[] = [
  "tutti",
  "mai",
  "whatsapp",
  "daChiamare",
  "nonRisposto",
  "richiamo",
  "ciRicontatta",
  "ritorno",
];

/** I nomi. «Tutta la coda» e solo lei dice «coda»: «Da chiamare» è il nome di uno
 *  stato, non l'idea di coda. I valori vecchi si leggono col nome della pillola
 *  in cui finiscono. */
export const NOME_STATO: Record<StatoFiltro, string> = {
  tutti: "Tutta la coda",
  mai: "Da contattare",
  whatsapp: "Attesa WhatsApp",
  daChiamare: "Da chiamare",
  nonRisposto: "Non ha risposto",
  nonRisponde: "Non ha risposto",
  segreteria: "Non ha risposto",
  ritentare: "Non ha risposto",
  richiamo: "Richiamo concordato",
  ciRicontatta: "Ci ricontatta lui",
  promesse: "Richiami",
  ritorno: "Di ritorno",
};

export const SPIEGA_STATO: Record<StatoFiltro, string> = {
  tutti: "Tutti quelli da chiamare adesso, nell'ordine di sempre",
  mai: "Il giro WhatsApp non li ha ancora scritti o il messaggio non è arrivato: si raggiungono solo al telefono",
  whatsapp:
    "Il primo messaggio è partito e aspettiamo. Dopo 10 ore senza risposta passano da soli a «Da chiamare». Non sono nella coda: chi ha già risposto in chat si segue in chat",
  daChiamare: "10 ore su WhatsApp senza risposta: adesso si telefona",
  nonRisposto:
    "Hanno squillato a vuoto o hai lasciato un messaggio in segreteria: dopo 15 minuti parte il WhatsApp «non l'ho trovata», poi si ritenta",
  nonRisponde: "Hanno squillato a vuoto o hai lasciato un messaggio in segreteria: si ritenta",
  segreteria: "Hanno squillato a vuoto o hai lasciato un messaggio in segreteria: si ritenta",
  ritentare: "Hanno squillato a vuoto o hai lasciato un messaggio in segreteria: si ritenta",
  richiamo: "Ci siamo dati un appuntamento telefonico e il giorno è arrivato",
  ciRicontatta: "Ha detto «vi faccio sapere io»: dal giorno detto lo richiamiamo noi",
  promesse: "Richiamo concordato e «ci ricontatta lui», quando il giorno è arrivato",
  ritorno: "Era già in archivio ed è ricomparso in una lista: va deciso",
};

/** Il valore dell'indirizzo come lo conosce la pagina oggi. I tre valori che le
 *  pillole hanno fuso diventano `nonRisposto`; tutti gli altri restano. */
export function statoCanonico(s?: StatoFiltro): StatoFiltro | undefined {
  if (s === "nonRisponde" || s === "segreteria" || s === "ritentare") return "nonRisposto";
  return s;
}

/** I filtri con lo Stato tradotto. Dà lo stesso oggetto se non c'è niente da
 *  tradurre (la pagina non deve ridisegnarsi per niente). */
export function conStatoCanonico<T extends { stato?: StatoFiltro }>(f: T): T {
  const c = statoCanonico(f.stato);
  return c === f.stato ? f : { ...f, stato: c };
}

/** Quali pillole sono accese per un valore dello Stato. Nessuno Stato = la prima.
 *  `promesse` (il link dei richiami scaduti) ne accende due. */
export function pilloleAccese(s?: StatoFiltro): PillolaId[] {
  const c = statoCanonico(s);
  if (!c || c === "tutti") return ["tutti"];
  if (c === "promesse") return ["richiamo", "ciRicontatta"];
  return [c as PillolaId];
}

/** Le pillole da disegnare, in ordine. `n(id)` = il numero che esce toccandola
 *  (`opzioniFiltri`). Una a zero sparisce, tranne l'accesa. Per «Di ritorno» `n`
 *  comprende anche i ritorni fuori dalla lista, così come la sua vecchia voce. */
export function pilloleDaMostrare(n: (id: PillolaId) => number, scelto?: StatoFiltro): PillolaId[] {
  const accese = pilloleAccese(scelto);
  return PILLOLE.filter((id) => {
    const quanti = n(id);
    return voceStatoAttiva(id, quanti, accese.includes(id) ? id : "", quanti);
  });
}
