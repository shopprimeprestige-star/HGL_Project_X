/** ── LA QUANTITÀ DEL PRODOTTO SEMPLICE: QUANDO SI SCRIVE (scheda/giacenza-puro.ts) ──
 *  Commessa 2026-11-25-editor-prodotti, E7 (correzioni). Niente React e niente rete. Tre regole che evitano movimenti non voluti nel registro:
 *  · il campo SEGUE il magazzino finché il titolare non lo tocca (se arriva un ordine e il magazzino passa da 10 a 7, il campo dice 7);
 *  · si scrive solo ciò che il titolare ha toccato dopo l'ultima lettura (un numero vecchio non diventa mai un movimento);
 *  · si scrive quando il fuoco esce da TUTTO il gruppo quantità + motivo, non appena si lascia la quantità: altrimenti passando al menu
 *    «Motivo» il movimento partirebbe col motivo proposto e «Reso» non si potrebbe più scegliere.
 *  Si prova in `prove/negozio/scheda-struttura.mjs`. */
import { cambioQuantita, type MotivoGiacenza } from "../semplice-puro";

/** Il testo del campo: quello scritto se lo si è toccato, altrimenti i pezzi che ci sono davvero (`letta` = l'ultima lettura). */
export const testoQuantita = (o: { letta: number; testo: string; toccata: boolean }): string =>
  o.toccata ? o.testo : String(o.letta);

/** Il movimento da registrare uscendo dal gruppo, o `null` se non c'è niente da scrivere (campo non toccato, uguale al magazzino, non un intero). */
export function movimentoDaScrivere(o: {
  letta: number;
  testo: string;
  toccata: boolean;
  /** Il motivo scelto a mano, o `null` = quello proposto dal verso (più pezzi = carico, meno = rettifica). */
  motivo: MotivoGiacenza | null;
}): { valore: number; motivo: MotivoGiacenza } | null {
  if (!o.toccata) return null;
  const e = cambioQuantita(o.letta, o.testo);
  if (!e.ok || e.differenza === 0) return null;
  return { valore: o.letta + e.differenza, motivo: o.motivo ?? e.motivo ?? "rettifica" };
}

/** Il fuoco è uscito dal gruppo? `prossimo` è dove va (`null` = fuori dalla pagina). Dentro il gruppo (quantità → motivo) non è uscito. */
export const fuocoEsceDalGruppo = (
  gruppo: { contains: (n: Node | null) => boolean },
  prossimo: Node | null,
): boolean => !gruppo.contains(prossimo);
