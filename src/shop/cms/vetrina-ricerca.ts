/** ── VETRINA V1 · T77 · LA RICERCA (D79) ───────────────────────────────────────
 *  Funzioni pure sull'elenco LEGGERO che la pagina ha già in memoria (scaricato al primo fuoco sul campo): cerca per nome e per SKU,
 *  senza badare a maiuscole e accenti, da 2 caratteri in su. La tendina mostra i primi 5; la pagina `/shop/cerca?q=` li ha tutti.
 *  ⚠️ Lavora SOLO sull'elenco che riceve: il server manda solo prodotti pubblicati, quindi una bozza non può comparire.
 *  ⚠️ Nessuna espressione regolare costruita dal testo cercato: si confronta come testo, e un simbolo non rompe niente.
 *  Il testo cercato non va mai nell'indirizzo di una pagina diversa da `/shop/cerca` né negli eventi (lo decide `elenco.ts`).
 *  Criteri: V1-C4 (nome e SKU, 4 prodotti senza risultati), V1-C3 (una bozza non compare in ricerca). */
import type { ProdottoPubblico } from "./modello";

/** Da quanti caratteri (dopo aver tolto gli spazi in più) la ricerca parte. */
export const MIN_CARATTERI_RICERCA = 2;
/** Voci della tendina sotto il campo (V1-H3). */
export const MAX_SUGGERIMENTI = 5;
/** Prodotti suggeriti quando la ricerca non trova niente (V1-C4). */
export const QUANTI_NELLO_STATO_VUOTO = 4;

/** Quello che la ricerca legge di una card leggera: il nome e gli SKU delle varianti. Il resto della card passa com'è. */
export interface Cercabile {
  nome: string;
  skuVarianti: readonly string[];
}

/** Minuscolo, senza accenti, spazi singoli e nessuno agli estremi. */
const pulito = (testo: string): string =>
  testo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** Le card che contengono il testo nel nome o in uno SKU (ogni parola cercata deve esserci), prima chi ha il nome che comincia così,
 *  poi chi lo ha nel nome, poi chi lo ha solo nello SKU; a parità l'ordine dell'elenco. Meno di 2 caratteri, o non testo: nessun risultato. */
export function cercaNeiLeggeri<T extends Cercabile>(elenco: readonly T[], q: unknown): T[] {
  if (typeof q !== "string") return [];
  const testo = pulito(q);
  if (testo.length < MIN_CARATTERI_RICERCA) return [];
  const parole = testo.split(" ");
  const trovati: { card: T; rango: number; posto: number }[] = [];
  elenco.forEach((card, posto) => {
    const nome = pulito(card.nome);
    const sku = card.skuVarianti.map(pulito).join(" ");
    if (!parole.every((p) => nome.includes(p) || sku.includes(p))) return;
    trovati.push({ card, posto, rango: nome.startsWith(testo) ? 0 : parole.every((p) => nome.includes(p)) ? 1 : 2 });
  });
  return trovati.sort((a, b) => a.rango - b.rango || a.posto - b.posto).map((x) => x.card);
}

/** Le voci della tendina: i primi `max` risultati (5). Un limite che non è un intero >= 0 vale 5. */
export function suggerimenti<T>(risultati: readonly T[], max: number = MAX_SUGGERIMENTI): T[] {
  return risultati.slice(0, Number.isInteger(max) && max >= 0 ? max : MAX_SUGGERIMENTI);
}

/** Quello che serve per scegliere i prodotti dello stato vuoto: il tipo, se si compra e se qualche variante c'è. */
export type Suggeribile = Pick<ProdottoPubblico, "nome" | "tipo" | "acquistabile"> & { varianti: readonly { disponibile: boolean }[] };

/** I 4 prodotti dello stato vuoto (D79): solo patch che si possono comprare adesso (acquistabili, con almeno una variante disponibile),
 *  in ordine alfabetico di nome come la vetrina della home (D78). Meno di 4 patch: quelle che ci sono. */
export function quattroDallaVetrina<T extends Suggeribile>(elenco: readonly T[]): T[] {
  return elenco
    .filter((p) => p.tipo === "patch" && p.acquistabile && p.varianti.some((v) => v.disponibile))
    .sort((a, b) => a.nome.localeCompare(b.nome, "it", { sensitivity: "base" }))
    .slice(0, QUANTI_NELLO_STATO_VUOTO);
}
