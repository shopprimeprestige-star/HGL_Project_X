/** ── LA MODALITÀ TRASMISSIONE ───────────────────────────────────────────────
 *
 *  Un negozietto di stato tutto suo, minuscolo e volutamente FUORI da
 *  `shop/call.tsx`. Il motore della videoconsulenza non deve nemmeno sapere
 *  che il webinar esiste: quel file regge le consulenze che pagano l'azienda
 *  ed è stato sistemato una decina di volte su guasti reali. Aggiungerci
 *  dentro un secondo stato con regole diverse vuol dire rimettere in gioco
 *  tutte quelle correzioni per una funzione che con le consulenze non
 *  c'entra.
 *
 *  Qui dentro c'è una domanda sola: «questa trasmissione è una consulenza o
 *  un webinar?». Da quella risposta dipende cosa mostra la barra e se
 *  compare la console della sala.
 */
import { useSyncExternalStore } from "react";
import type { Onda } from "./sfu";
import type { RegiaPalco, VistaWebinar } from "./tipi";

export interface StatoModo {
  /** `null` = non si sta trasmettendo niente in webinar (consulenza o nulla) */
  sala: { codice: string; titolo: string; link: string } | null;
  /** la diretta vera e propria, quando è partita */
  onda: Onda | null;
  /** cosa stiamo mandando: la faccia, lo schermo, o tutti e due */
  sorgente: "camera" | "schermo" | "entrambi";
  /** il flusso in onda, per l'anteprima e per la registrazione */
  media: MediaStream | null;
  /** la console della sala è aperta */
  consoleAperta: boolean;
  /** ── ⚠️ QUESTE TRE COSE STANNO QUI E NON NELLA CONSOLE ──────────────────
   *  Ogni pagina del presentatore disegna la PROPRIA barra, quindi passando da
   *  «Media» a «Slide» la barra si smonta e si rimonta — e con lei la console,
   *  che perdeva tutto il suo stato locale. Effetto visibile: premevi «Slide»,
   *  la sala ci andava davvero, ma il pannello tornava a dire «Solo te» perché
   *  ripartiva dal valore iniziale.
   *  Qui invece vivono fuori da React e sopravvivono al cambio pagina. */
  vista: VistaWebinar;
  regiaPalco: RegiaPalco;
  /** il teleprompter è aperto */
  gobbo: boolean;
}

let S: StatoModo = {
  sala: null, onda: null, sorgente: "camera", media: null, consoleAperta: true,
  vista: "camera", regiaPalco: {}, gobbo: false,
};
const ascoltatori = new Set<() => void>();

export function impostaModo(p: Partial<StatoModo>): void {
  S = { ...S, ...p };
  ascoltatori.forEach((f) => f());
}

export const modoOra = (): StatoModo => S;

function iscrivi(f: () => void): () => void {
  ascoltatori.add(f);
  return () => ascoltatori.delete(f);
}

/** ⚠️ Il terzo argomento è la versione per il server: senza, il rendering
 *  lato server esplode («getSnapshot is not a function» in produzione e non in
 *  sviluppo, che è il modo peggiore di scoprirlo). */
export function useModo(): StatoModo {
  return useSyncExternalStore(iscrivi, modoOra, modoOra);
}

/** Si sta trasmettendo un webinar (anche solo scelto, non ancora in onda). */
export const inWebinar = () => !!S.sala;
