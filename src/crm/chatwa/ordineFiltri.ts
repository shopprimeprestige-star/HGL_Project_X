/** ── L'ORDINE DI «RICONTATTI» E «ATTESA ACCONTO», UN TASTO CHE LO INVERTE (28/11/2026) ──────────
 *  Richiesta del titolare: «sia attesa a conto che ricontatti fai che posso mettere il filtro che li
 *  ordina dal più vecchio al più nuovo o dal più nuovo al più vecchio. Basta cliccare e si imposta.»
 *
 *  · Un tasto solo a commutazione, visibile solo con uno dei due filtri acceso. Non è un filtro: non
 *    sta in `FiltriChat`, non conta sul tasto «Filtri», non si azzera con i filtri.
 *  · Quale data ordina (la stessa di oggi, nessuna query nuova):
 *      Ricontatti      l'ARRIVO del lead (`data.createdAt`, poi `created_at`): `ordinaRicontatti`.
 *                      I lead in priorità (puntina) restano in cima nei due versi.
 *      Attesa acconto  l'ULTIMO MESSAGGIO della chat, come ogni vista «Tutte»: `ordinaComeWhatsapp`.
 *  · Si parte da «nuovi» per tutti e due: chi non tocca niente vede l'ordine di sempre.
 *  · A pari data l'ordine non si rovescia (sort stabile); chi non ha data sta sempre in fondo.
 *  · La scelta si ricorda per ciascun filtro sul dispositivo (`useFiltriChat.ts`).
 *  Tutto puro: niente React, niente Supabase. Provato in prove/idee/ordine-filtri.mjs. */
import { VOCE_ATTESA_ACCONTO, eAcceso, type FiltriChat } from "./filtri";
import type { VersoOrdine } from "./ordineWhatsapp";

export type { VersoOrdine };

/** I due filtri che hanno il tasto. */
export type FiltroConOrdine = "ricontatti" | "acconto";

/** Il verso scelto per ciascun filtro. */
export type OrdineFiltri = Record<FiltroConOrdine, VersoOrdine>;

/** Prima del primo clic: l'ordine di sempre, dal più nuovo. */
export const ORDINE_DI_PARTENZA: OrdineFiltri = { ricontatti: "nuovi", acconto: "nuovi" };

/** Il testo sul tasto: dice l'ordine ATTUALE, non quello a cui si passerebbe. */
export const TESTO_VERSO: Record<VersoOrdine, string> = {
  nuovi: "Dal più nuovo",
  vecchi: "Dal più vecchio",
};

export const invertiVerso = (v: VersoOrdine): VersoOrdine => (v === "nuovi" ? "vecchi" : "nuovi");

/** Quale dei due filtri è acceso, o `null`: senza filtro (o con un altro) il tasto non compare. */
export function filtroConOrdine(f: FiltriChat): FiltroConOrdine | null {
  if (f.ricontatti) return "ricontatti";
  if (eAcceso(f, VOCE_ATTESA_ACCONTO.campo, VOCE_ATTESA_ACCONTO.valore)) return "acconto";
  return null;
}

/** Come si scrive nella memoria del dispositivo. */
export const scriviOrdine = (o: OrdineFiltri): string => JSON.stringify(o);

const eVerso = (v: unknown): v is VersoOrdine => v === "nuovi" || v === "vecchi";

/** Rilegge la scelta. Mai un errore: ciò che non si riconosce vale l'ordine di partenza, voce per voce. */
export function leggiOrdine(testo: string | null): OrdineFiltri {
  let o: Record<string, unknown> = {};
  try {
    const v: unknown = testo ? JSON.parse(testo) : {};
    if (v && typeof v === "object" && !Array.isArray(v)) o = v as Record<string, unknown>;
  } catch {
    /* testo rotto: si riparte da quello di oggi */
  }
  return {
    ricontatti: eVerso(o.ricontatti) ? o.ricontatti : ORDINE_DI_PARTENZA.ricontatti,
    acconto: eVerso(o.acconto) ? o.acconto : ORDINE_DI_PARTENZA.acconto,
  };
}
