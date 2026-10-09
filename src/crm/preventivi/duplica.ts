/** ── DUPLICARE UN PREVENTIVO ───────────────────────────────────────────────
 *
 *  Richiesta del committente: «fai che un preventivo posso duplicarlo dalla
 *  lista preventivi con un pulsante».
 *
 *  A COSA SERVE. Un preventivo scade. Quando il cliente si rifà vivo due
 *  settimane dopo, l'unica strada era rifare tutta la configurazione da capo —
 *  soluzione, personalizzazioni, quantità — con il rischio di dimenticarne una
 *  e di mandargli un prezzo diverso da quello che aveva letto. Duplicare fa
 *  nascere lo stesso documento con un numero nuovo e una scadenza nuova.
 *
 *  ── ⚠️ COSA SI COPIA E COSA NO, E PERCHÉ ─────────────────────────────────
 *  Si copia TUTTO quello che è l'offerta: a chi è intestata, la soluzione
 *  base, le voci, la quantità, il modo di analisi, lo sconto applicato e il
 *  totale. Quel documento deve poter essere riaperto e riletto identico.
 *
 *  NON si copiano quattro cose, e nessuna delle quattro è una dimenticanza:
 *   · il NUMERO (`quote_ref`) — lo assegna il server, e due documenti con lo
 *     stesso numero sarebbero lo stesso documento: il link del cliente, la
 *     causale del bonifico e la fattura puntano tutti lì;
 *   · la DATA DI CREAZIONE — la scadenza si calcola da quella (`promoDeadline`),
 *     e copiarla farebbe nascere un preventivo già scaduto, cioè esattamente
 *     il documento che si sta rifacendo;
 *   · lo STATO — il duplicato è «nuovo» anche se l'originale era confermato o
 *     perso: è una proposta che riparte, non la storia di quella vecchia;
 *   · il PERCORSO (`timeline_start`, `timeline_steps`) — le tappe spuntate
 *     sono di quella lavorazione lì. Portarsele dietro vorrebbe dire un
 *     preventivo appena nato che dice «selfie ricevuti, colore approvato».
 *
 *  ⚠️ NIENTE JSX E NIENTE RETE QUI DENTRO: questa funzione dice soltanto COSA
 *   scrivere. La scrittura la fa la pagina passando dalla rotta del server
 *   (api.public.quote-create), che è l'unica che sa assegnare un numero libero.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { RigaPreventivo } from "./dati";

/** La riga di partenza, più i campi che la tabella ha davvero ma che il tipo
 *  generato non dichiara (`base_system`, scritto dal configuratore). */
export type PreventivoDaCopiare = Partial<RigaPreventivo> & {
  base_system?: unknown;
  note?: string | null;
};

/** Quello che si scrive per far nascere la copia. Le chiavi sono i nomi delle
 *  colonne, perché è una riga di database e non un oggetto della pagina. */
export function rigaDuplicata(q: PreventivoDaCopiare): Record<string, unknown> {
  //  Si elencano i campi a mano invece di copiare l'oggetto e togliere: con
  //  `{...q}` una colonna nuova entrerebbe nella copia senza che nessuno abbia
  //  deciso che deve entrarci — e le colonne che NON vanno copiate sono
  //  proprio quelle che fanno danno (numero, data, stato, percorso).
  const riga: Record<string, unknown> = {
    nome: q.nome ?? "",
    cognome: q.cognome ?? null,
    email: q.email ?? "",
    telefono: q.telefono ?? "",
    eta: q.eta ?? null,
    grey_pct: q.grey_pct ?? null,
    color_code: q.color_code ?? null,
    problemi: q.problemi ?? null,
    note: q.note ?? null,
    base_choice: q.base_choice ?? null,
    upsells: q.upsells ?? [],
    qty: q.qty ?? 1,
    fitting_mode: q.fitting_mode ?? "remoto",
    discount_code: q.discount_code ?? null,
    discount_eur: Number(q.discount_eur) || 0,
    total: Number(q.total) || 0,
    //  ⚠️ Il duplicato riparte da capo: vedi l'intestazione.
    status: "nuovo",
  };
  //  `base_system` porta l'id della soluzione, ed è quello che permette di
  //  riaprire il duplicato esattamente com'era (shop/riapri-preventivo). Si
  //  scrive solo se c'è: una colonna messa a `undefined` non si scrive, ma una
  //  messa a `null` cancellerebbe l'informazione sulle righe che ce l'hanno.
  if (q.base_system) riga.base_system = q.base_system;
  return riga;
}

/** Il messaggio da dire dopo: dice che cosa è nato e che cosa NON si è portato
 *  dietro, perché il duplicato di un preventivo confermato che risulta «nuovo»
 *  non deve sembrare un errore. */
export function spiegazioneDuplicato(q: PreventivoDaCopiare): string {
  const pezzi = ["numero nuovo", "scadenza nuova"];
  if (q.status && q.status !== "nuovo") pezzi.push("stato «nuovo»");
  if (q.timeline_steps && Object.values(q.timeline_steps).some(Boolean))
    pezzi.push("percorso da rifare");
  return `Stessa offerta, ${pezzi.join(", ")}.`;
}
