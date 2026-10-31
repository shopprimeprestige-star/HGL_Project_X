/** ── MEETLY · CLIENT SFU: SEGNAPOSTO DEL COMPITO T5 ───────────────────────────
 *  ⚠️ PROVVISORIO. Il modulo vero lo scrive T3 (commessa 2026-10-31-meetly-connessione,
 *  PIANO.md T3) e al momento dell'unione sostituisce questo file per intero.
 *  Esiste solo perché `call.tsx` (innesti di T5) importi qualcosa che compila:
 *  con l'interruttore su «mesh», di serie, `creaTrasportoSfu` non viene mai chiamata.
 *  `DepsSfu` è ciò che `call.tsx` passa oggi; se T3 sceglie altri nomi si
 *  aggiusta il solo punto di chiamata (`passaASfu`). */
import type { TrasportoSfu } from "@/shop/meetly-sfu-regole";

export interface DepsSfu {
  /** Codice stanza (quello del canale `qcall-<codice>`). */
  codice: string;
  /** Il mio pid. */
  pid: string;
  ruolo: "consulente" | "ospite";
  /** Credenziali della scheda per la verifica «ammesso» (solo ospite). */
  credenziali: () => { dev: string; segreto: string };
  /** Server ICE già presi dalla chiamata (`/api/public/turn`). */
  ice: () => RTCIceServer[];
  log: (m: string) => void;
}

export function creaTrasportoSfu(_deps: DepsSfu): TrasportoSfu {
  throw new Error("meetly-sfu: client non ancora disponibile (T3)");
}
