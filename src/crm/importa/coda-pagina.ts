/** ── LISTA E CODA: DUE INSIEMI, NON UNO ────────────────────────────────────
 *
 *  Commessa 2026-10-28 «Lead importati semplice». «Attesa WhatsApp» sta ancora
 *  aspettando la risposta: non va chiamato e non deve essere «il prossimo», ma
 *  deve restare visibile con la sua pillola. Quindi la pagina tiene due insiemi:
 *    LISTA  la regola di sempre (`inLista`, intatta, «Attesa WhatsApp»
 *           compreso): da qui nascono le righe dei filtri e i numeri delle pillole;
 *    CODA   la lista meno chi è «Attesa WhatsApp» e per cui non c'è nessun altro
 *           motivo di chiamare: quelli da chiamare adesso.
 *
 *  ⚠️ NON SI TOCCA `STATI_DA_CHIAMARE` (types.ts): lo usano KPI, Da fare,
 *   Ripesca, Doppioni e «Tutta la lista», che continuano a contare gli «Attesa
 *   WhatsApp». Cambia solo cosa questa pagina chiama «coda».
 *  ⚠️ RESTA IN CODA chi è «Attesa WhatsApp» ma ha chiesto lui una fascia ed è
 *   arrivata (motivo «suaOra»), o è un contatto di ritorno. Fuori coda è solo il
 *   motivo «ritento»: è l'unico in cui l'unica ragione di chiamare è che non ha
 *   risposto.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LeadLike, OpzioniChiamata } from "./chi-chiamare";
import { inLista, listaDaChiamare, motivoChiamata } from "./chi-chiamare";

/** È «Attesa WhatsApp» e per ora si aspetta soltanto? */
function soloInAttesa(l: LeadLike, adesso: Date, o?: OpzioniChiamata): boolean {
  return l.data?.stato === "attesa_whatsapp" && motivoChiamata(l, adesso, o).motivo === "ritento";
}

/** È da chiamare adesso? Vale la regola della lista, meno chi sta aspettando. */
export function eInCoda(l: LeadLike, adesso: Date, o?: OpzioniChiamata): boolean {
  return inLista(l, adesso, o) && !soloInAttesa(l, adesso, o);
}

/** La lista (già in ordine, come oggi) e la coda (la stessa lista senza chi
 *  aspetta). Ogni lead della coda è nella lista, nello stesso ordine. */
export function righePagina<L extends LeadLike>(
  leads: L[],
  adesso: Date,
  o?: OpzioniChiamata,
): { lista: L[]; coda: L[] } {
  const lista = listaDaChiamare(leads, adesso, o);
  return { lista, coda: lista.filter((l) => !soloInAttesa(l, adesso, o)) };
}

/** ── «TROVATO CON LA RICERCA, NON È IN CODA» ───────────────────────────────
 *  Oggi la fascia compare quando c'è un nome portato in testa e non è in coda.
 *  Con la pillola «Attesa WhatsApp» accesa, un nome cliccato nel «Poi» è fuori
 *  coda ma si vede (è nelle righe): dirgli «non è in coda» sarebbe una bugia.
 *  Fuori = portato in testa a mano AND non in coda AND non fra le righe che si
 *  vedono adesso. */
export function eFuoriCoda(
  forzato: string | null,
  idInCoda: ReadonlySet<string>,
  idVisibili: ReadonlySet<string>,
): boolean {
  return !!forzato && !idInCoda.has(forzato) && !idVisibili.has(forzato);
}
