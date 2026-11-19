/** ── LA PAGINA «E-COMMERCE»: PERIODO E INDIRIZZO (pagina.ts) ───────────────────
 *  Commessa 2026-11-17-crm-ecommerce, T11. Modulo PURO (niente React, niente rete): decide due cose che la Panoramica
 *  e la scheda Ordini devono leggere allo stesso modo, altrimenti «una cifra coincide con le righe» salta.
 *   1. Dal filtro del CRM (`DateRange`: «YYYY-MM-DD» o nulla) al `Periodo` di `conti.ts`. Stessa regola di
 *      `rangeBoundsAsDates`: solo «Da» = un giorno, solo «A» = un giorno (NON «fino a»).
 *   2. Cosa dice l'indirizzo: `?scheda=` (le schede esistenti in questo rilascio), `?stato=` (il clic su uno stato della
 *      Panoramica), `?ordine=` (per il dettaglio di T12). Ciò che non si riconosce si scarta. */
import { STATI_ORDINE } from "./ordine";
import type { Ordine, StatoOrdine } from "./ordine";
import type { Periodo } from "./conti";

/** Lo stesso formato di `DateRange` del filtro (non lo importo: quello è un file React). */
export interface IntervalloFiltro {
  from: string | null;
  to: string | null;
}

/** «€ 1.234,50»: gli ordini dello shop sono a pochi euro, i centesimi contano (l'`eur` del CRM li taglia). */
export const euro = (n: number): string =>
  `€ ${(Number.isFinite(n) ? n : 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Cosa si dice a chi non può far niente perché il database non è pronto (non è il consulente a dover trovare un file). */
export const AVVISO_MIGRAZIONE = "Chiedi a chi gestisce il database di applicare l'aggiornamento degli ordini.";

/** «Tutto»: nessuna data nel filtro. Lo si usa quando si apre l'elenco da una cifra «di sempre» (gli ordini fermi): con i 30 giorni
 *  di partenza la cifra e le righe non coinciderebbero. */
export const RANGE_TUTTO: IntervalloFiltro = { from: null, to: null };

/* Le schede di R2 sono due: «panoramica» (la partenza, indirizzo pulito) e «ordini». «Clienti» e «Da collegare» arrivano con
   R3/R4: finché non ci sono, un indirizzo che le chiede apre la Panoramica. */

export interface RicercaEcommerce {
  /** Assente = «panoramica»: l'indirizzo di partenza resta pulito. */
  scheda?: "ordini";
  stato?: StatoOrdine;
  ordine?: string;
}

const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Di partenza: gli ultimi 30 giorni, oggi compreso. È lo stesso intervallo del bottone «30g» del filtro, che così risulta acceso. */
export function rangeDiPartenza(adesso: Date, giorni = 30): IntervalloFiltro {
  const da = new Date(adesso.getFullYear(), adesso.getMonth(), adesso.getDate() - (giorni - 1));
  return { from: iso(da), to: iso(adesso) };
}

/** Dal filtro al periodo dei conti. Con almeno una data si traduce come `rangeBoundsAsDates`. Senza date («Tutto») NON si
 *  inventano date: si parte dal giorno del primo ordine (altrimenti l'andamento avrebbe migliaia di giorni vuoti) e si arriva
 *  a oggi, o all'ultimo ordine se è nel futuro, così nessun ordine resta fuori. Date illeggibili degli ordini si ignorano. */
export function periodoDaRange(
  range: IntervalloFiltro,
  ordini: Pick<Ordine, "creatoIl">[],
  adesso: Date,
): Periodo {
  if (range.from || range.to)
    return { da: (range.from || range.to) as string, a: (range.to || range.from) as string };
  const oggi = iso(adesso);
  let primo: string | null = null;
  let ultimo: string = oggi;
  for (const o of ordini) {
    const t = Date.parse(o.creatoIl);
    if (!Number.isFinite(t)) continue;
    const g = iso(new Date(t));
    if (primo === null || g < primo) primo = g;
    if (g > ultimo) ultimo = g;
  }
  return { da: primo ?? oggi, a: ultimo };
}

const TESTO_MAX = 100;

/** Dall'indirizzo ai parametri della pagina: chi scrive a mano un valore sbagliato trova la Panoramica, non un errore. */
export function leggiRicerca(raw: Record<string, unknown>): RicercaEcommerce {
  const r: RicercaEcommerce = {};
  if (raw.scheda === "ordini") r.scheda = "ordini";
  if (typeof raw.stato === "string" && (STATI_ORDINE as readonly string[]).includes(raw.stato))
    r.stato = raw.stato as StatoOrdine;
  if (typeof raw.ordine === "string" && raw.ordine.length > 0 && raw.ordine.length <= TESTO_MAX)
    r.ordine = raw.ordine;
  return r;
}
