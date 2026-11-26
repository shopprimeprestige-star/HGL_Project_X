/** ── LA RICERCA DELLE CATEGORIE (scheda/RiquadroCategorie.ts) ─────────────────
 *  Commessa 2026-11-25-editor-prodotti, E6. Solo la regola, senza schermo: quali categorie restano in elenco quando si scrive nella ricerca.
 *  Senza maiuscole e senza accenti, così «cura» trova «Cura dei capelli» e «serum» trova «Sérum». Si prova in `prove/negozio/scheda-riquadri.mjs`. */
export type Categoria = { id: string; nome: string };

const semplice = (t: string) => t.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");

/** Le categorie il cui nome contiene la ricerca (vuota = tutte). L'ordine dell'elenco non cambia. */
export function filtraCategorie(elenco: readonly Categoria[], ricerca: string): Categoria[] {
  const q = semplice(ricerca.trim());
  return elenco.filter((k) => semplice(k.nome).includes(q));
}
