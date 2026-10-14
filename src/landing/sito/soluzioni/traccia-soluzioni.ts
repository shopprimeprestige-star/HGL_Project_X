/** Gli eventi della pagina /soluzioni. Nell'anteprima del CRM (`?anteprima=<codice>` nell'indirizzo) NON parte niente:
 *  né pixel né tracciamento, perché gli eventi portano l'indirizzo della pagina e il codice finirebbe a Meta e nei log,
 *  e i numeri del titolare non devono sporcare le visite. */
import { tracciaSoluzioni as spedisci, type NomeEventoSoluzioni } from "./ponte";

export function inAnteprima(): boolean {
  try {
    return typeof window !== "undefined" && new URLSearchParams(window.location.search).has("anteprima");
  } catch {
    return false;
  }
}

export function tracciaSoluzioni(nome: NomeEventoSoluzioni, dettagli: Record<string, unknown> = {}): void {
  if (inAnteprima()) return;
  spedisci(nome, dettagli);
}
