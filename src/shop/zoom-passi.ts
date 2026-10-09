/** ── L'ARITMETICA DELLO ZOOM SUI MEDIA ─────────────────────────────────────
 *
 *  Sta fuori da `zoompan.tsx` per la stessa ragione di `pip-misure`: è
 *  aritmetica, e l'aritmetica si prova. Queste due funzioni decidono se lo
 *  zoom torna indietro, e quando sbagliano non si rompe niente in modo
 *  evidente — l'immagine resta "quasi" al 100% e continua a scorrere sotto il
 *  dito, che è il genere di difetto che resta lì per mesi.
 *
 *  ⚠️ IL GUASTO VERO, segnalato dal committente: «sui media quando faccio
 *   zoom non torna indietro, si bugga e continua a zoomare».
 *   1 + 0,4 − 0,4 non fa 1 in virgola mobile: restava 1,0000000000000002.
 *   Non si vedeva (la percentuale è arrotondata: 100%), ma per il programma la
 *   vista era ancora ingrandita — il trascinamento continuava a spostare
 *   l'immagine e il pulsante "torna al 100%" restava attivo senza aver nulla
 *   da fare.
 */

/** Ingrandimento minimo: 1 = l'immagine intera, non si va sotto. */
export const SCALA_MIN = 1;
/** Ingrandimento massimo: oltre cinque volte si vedono solo i pixel. */
export const SCALA_MAX = 5;

/** Riporta un ingrandimento dentro gli estremi, arrotondato al centesimo.
 *  ⚠️ Lo scatto a 1 è la correzione: sotto il centesimo di differenza
 *   l'immagine è intera, e deve risultarlo anche ai confronti. */
export function scalaLimitata(s: number): number {
  const n = Math.round((Number.isFinite(s) ? s : SCALA_MIN) * 100) / 100;
  if (n <= SCALA_MIN) return SCALA_MIN;
  return Math.min(SCALA_MAX, n);
}

/** Il doppio click: sale di un passo fino al massimo, poi torna giù.
 *
 *  ⚠️ IL VERSO LO DECIDE DOVE SI È, non l'ultimo doppio click. Il verso era
 *   una memoria a parte: arrivando al massimo con i pulsanti "+" quella
 *   memoria diceva ancora "sali", e il primo doppio click non faceva NIENTE —
 *   sembrava che lo zoom avesse smesso di rispondere.
 *
 *  Restituisce la nuova scala E il verso da ricordare per la volta dopo. */
export function passoDoppioClick(scala: number, verso: 1 | -1): { scala: number; verso: 1 | -1 } {
  const s = scalaLimitata(scala);
  const v: 1 | -1 = s >= SCALA_MAX ? -1 : s <= SCALA_MIN ? 1 : verso;
  const n = scalaLimitata(s + v);
  //  Anche il verso RICORDATO si rimette a posto appena si tocca un estremo:
  //  così la memoria non racconta mai una cosa diversa da dove si è finiti.
  const dopo: 1 | -1 = n >= SCALA_MAX ? -1 : n <= SCALA_MIN ? 1 : v;
  return { scala: n, verso: dopo };
}

/** true se l'immagine è davvero ingrandita (e quindi si può trascinare). */
export const ingrandita = (s: number): boolean => scalaLimitata(s) > SCALA_MIN;
