/** ── QUANDO RIAVVIARE IL RICONOSCIMENTO VOCALE ─────────────────────────────
 *
 *  Segnalazione del titolare (15/10/2026): «quando le persone entrano su
 *  Meetly sentono continuamente un suono ogni 2 secondi».
 *
 *  ── LA CAUSA ──────────────────────────────────────────────────────────────
 *  Il riconoscimento vocale (trascrizione e teleprompter) parte per CHIUNQUE
 *  appena la connessione è `connected`, cliente compreso. Su telefono il
 *  browser fa un «bip» a ogni avvio, e `onend` riavviava subito, sempre: se
 *  il riconoscimento finisce all'istante (microfono già preso dalla chiamata,
 *  permesso negato, nessuna voce) il ciclo parte → bip → fine → parte → bip,
 *  uno ogni paio di secondi, per tutta la consulenza. Sul computer del
 *  consulente non suona, ed è per questo che nessuno se n'era accorto.
 *
 *  ── LA REGOLA ─────────────────────────────────────────────────────────────
 *  · errore fatale (permesso, microfono, lingua): non si riavvia;
 *  · fine NORMALE (ha sentito qualcosa, o è durata a lungo): si riavvia subito,
 *    come prima — il teleprompter non deve perdere parole;
 *  · fine BREVE senza aver sentito niente: si riprova con attesa crescente
 *    (2 s, 4 s) e dopo tre di seguito ci si ferma. Alla prossima connessione
 *    `startRecognition` riparte da capo.
 *  ⚠️ Funzione pura: la prova (`prove/prove.mjs`) la guida senza browser. */

/** Sotto questa durata, senza voce, la fine conta come «breve». */
export const SESSIONE_BREVE_MS = 10_000;
/** Fini brevi di fila dopo le quali ci si ferma. */
export const FINI_BREVI_MAX = 3;
/** Attesa dopo la prima fine breve; raddoppia a ogni successiva. */
export const ATTESA_BASE_MS = 2_000;

/** Errori che un riavvio non può guarire. */
export const ERRORI_FATALI = new Set([
  "not-allowed",
  "service-not-allowed",
  "audio-capture",
  "language-not-supported",
]);

export interface FineRiconoscimento {
  /** `event.error` dell'ultimo `onerror`, se c'è stato. */
  errore?: string | null;
  /** Quanto è durata la sessione appena finita. */
  durataMs: number;
  /** Ha prodotto almeno un risultato (anche provvisorio). */
  haSentito: boolean;
  /** Fini brevi consecutive fino a questa esclusa. */
  breviDiSeguito: number;
}

export interface Decisione {
  riavvia: boolean;
  dopoMs: number;
  breviDiSeguito: number;
}

export function dopoLaFine(f: FineRiconoscimento): Decisione {
  if (f.errore && ERRORI_FATALI.has(f.errore)) {
    return { riavvia: false, dopoMs: 0, breviDiSeguito: f.breviDiSeguito };
  }
  if (f.haSentito || f.durataMs >= SESSIONE_BREVE_MS) {
    return { riavvia: true, dopoMs: 0, breviDiSeguito: 0 };
  }
  const brevi = f.breviDiSeguito + 1;
  if (brevi >= FINI_BREVI_MAX) return { riavvia: false, dopoMs: 0, breviDiSeguito: brevi };
  return { riavvia: true, dopoMs: ATTESA_BASE_MS * 2 ** (brevi - 1), breviDiSeguito: brevi };
}
