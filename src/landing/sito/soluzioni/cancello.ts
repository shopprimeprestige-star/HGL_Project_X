/** ── IL CANCELLO DELLA PAGINA «TRE SOLUZIONI» ───────────────────────────────
 *  Una regola sola, pura, provata da sola (`prove/sito/soluzioni-regole.mjs`):
 *  la pagina va ai visitatori solo con il video del titolare, la sua copertina
 *  e la conferma che i sottotitoli sono impressi. Se manca anche una sola cosa,
 *  chi apre `/soluzioni` torna alla home (302). Il semaforo dell'editor del CRM
 *  usa le stesse due funzioni: due regole non possono contraddirsi.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LandingContent } from "@/landing/landing-content";

export type Mancante = "video" | "copertina" | "sottotitoli";

//  S1.0: scheletro che compila e tiene il cancello CHIUSO. La regola vera arriva in S1.1.
export function mancantiSoluzioni(_c: LandingContent, _origineStorage: string): Mancante[] {
  return ["video", "copertina", "sottotitoli"];
}

export function soluzioniPubblicabile(c: LandingContent, origineStorage: string): boolean {
  return mancantiSoluzioni(c, origineStorage).length === 0;
}

export function fraseSemaforo(_m: Mancante[]): string {
  return "";
}
