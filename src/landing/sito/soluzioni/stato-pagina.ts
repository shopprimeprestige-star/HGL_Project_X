/** Che cosa sta succedendo sulla pagina `/soluzioni`, letto da chi deve farsi da parte:
 *  la barra in basso sparisce se un video gira o se il foglio del modulo è aperto.
 *  Un solo oggetto per volta, sostituito solo quando cambia qualcosa (serve a `useSyncExternalStore`). */
//  I ganci hanno nomi italiani fissati dal contratto («usa…», non «use…»): la regola non li riconosce, sono ganci veri.
/* eslint-disable react-hooks/rules-of-hooks */
import { useSyncExternalStore } from "react";

export interface StatoPagina {
  videoGira: boolean;
  foglioAperto: boolean;
}

const INIZIALE: StatoPagina = { videoGira: false, foglioAperto: false };
let stato = INIZIALE;
const ascoltatori = new Set<() => void>();

function cambia(parte: Partial<StatoPagina>) {
  const nuovo = { ...stato, ...parte };
  if (nuovo.videoGira === stato.videoGira && nuovo.foglioAperto === stato.foglioAperto) return;
  stato = nuovo;
  ascoltatori.forEach((a) => a());
}

export function segnaVideo(gira: boolean) {
  cambia({ videoGira: gira });
}

export function segnaFoglio(aperto: boolean) {
  cambia({ foglioAperto: aperto });
}

function iscriviti(a: () => void) {
  ascoltatori.add(a);
  return () => {
    ascoltatori.delete(a);
  };
}

/** Sul server lo stato è sempre quello iniziale: niente passa da una richiesta all'altra. */
export function usaStatoPagina(): StatoPagina {
  return useSyncExternalStore(
    iscriviti,
    () => stato,
    () => INIZIALE,
  );
}
