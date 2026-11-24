/** Vero se il commit di partenza della prova (HEAD) contiene già `origin/main`: è una prova di unione, o la pubblicazione.
 *  Lì il diff da un commit vecchio contiene anche il lavoro di tutti gli altri e `routeTree.gen.ts` è rigenerato e committato:
 *  le prove «storiche» sul diff non hanno più senso. Sul ramo `shop-v1` (senza main dentro) restano tutte attive. */
import { execFileSync } from "node:child_process";

export function conMainDentro(radice) {
  try {
    execFileSync("git", ["-C", radice, "merge-base", "--is-ancestor", "origin/main", "HEAD"], { stdio: "ignore" });
    return true;
  } catch {
    return false; // shortcut: senza `origin/main` (clone senza remoto) non si può sapere: si resta severi, si cambia se serve
  }
}
