// ── Puntatore (dito) mostrato all'ospite ───────────────────────────────────
//  · ATTIVO DI DEFAULT: il presentatore apre la pagina e il cliente vede già il
//    dito seguire il movimento. Il tasto col dito lo spegne/riaccende e la
//    preferenza è persistita in localStorage.
//  · MAI sopra i comandi del presentatore (barra, impostazioni, zoom, footer,
//    chat, teleprompter…): il cliente non deve vedere il dito saltare sui
//    pulsanti mentre il presentatore li usa.
const KEY = "hg_pointer";

export function readPointerPref(): boolean {
  if (typeof localStorage === "undefined") return true;
  try { return localStorage.getItem(KEY) !== "0"; } catch { return true; }
}
export function writePointerPref(on: boolean) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch { /* */ }
}

/** Selettore dei SOLI comandi del presentatore: sopra questi il dito è nascosto.
 *  IMPORTANTE: qui NON vanno button/input/[role=button]/a generici. Il preventivo
 *  (e le slide) sono pieni di card-opzione, pulsanti e campi che fanno parte del
 *  CONTENUTO presentato: includendoli il puntatore risultava "sopra i comandi"
 *  quasi sempre e lampeggiava (on/off continuo) mentre il presentatore muoveva il
 *  mouse sul preventivo. Sono comandi solo gli elementi marcati esplicitamente
 *  `[data-hg-noptr]` (barra presentatore e suoi popup, modale impostazioni,
 *  controlli zoom, footer slide, overlay chiamata, chat, teleprompter) e i
 *  contenitori con classe `.hg-controls`. */
export const CONTROL_SELECTOR = "[data-hg-noptr], .hg-controls";

/** true se il puntatore si trova sopra un comando del presentatore. */
export function overControls(target: EventTarget | null): boolean {
  const el = target as Element | null;
  if (!el || typeof (el as Element).closest !== "function") return false;
  return !!el.closest(CONTROL_SELECTOR);
}

/** Ritardo (ms) prima di spegnere il dito quando si passa sopra i comandi:
 *  un passaggio rapido non deve produrre uno sfarfallio sul dispositivo ospite.
 *  Il ritorno sul contenuto riaccende SUBITO il puntatore. */
export const POINTER_OFF_DELAY = 150;

/** Isteresi anti-flicker: incapsula il ritardo di spegnimento.
 *  `over(target)` va chiamata a ogni pointermove; ritorna true se il dito deve
 *  essere considerato "sui comandi" ADESSO (cioè già spento). */
export function makePointerHysteresis(onHide: () => void) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let hidden = false;
  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
  return {
    /** true → il movimento va ignorato (dito già spento sui comandi) */
    over(target: EventTarget | null): boolean {
      if (overControls(target)) {
        if (!hidden && !timer) {
          timer = setTimeout(() => { timer = null; hidden = true; onHide(); }, POINTER_OFF_DELAY);
        }
        return hidden;
      }
      clear(); hidden = false;   // tornato sul contenuto: riprende subito
      return false;
    },
    /** spegnimento immediato (uscita dalla finestra, toggle off, unmount) */
    forceHide() { clear(); hidden = true; },
    reset() { clear(); hidden = false; },
  };
}
