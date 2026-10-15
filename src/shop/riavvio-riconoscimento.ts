/** ── QUANDO AVVIARE E RIAVVIARE IL RICONOSCIMENTO VOCALE ───────────────────
 *
 *  Segnalazione del titolare (15/10/2026): «quando le persone entrano su
 *  Meetly sentono continuamente un suono ogni 2 secondi».
 *
 *  ── LA CAUSA ──────────────────────────────────────────────────────────────
 *  Il riconoscimento vocale (trascrizione e teleprompter) partiva per CHIUNQUE
 *  appena la connessione era `connected`, cliente compreso. Su telefono il
 *  browser fa un «bip» a OGNI avvio. Sul computer del consulente non suona, ed
 *  è per questo che nessuno se n'era accorto.
 *
 *  ── LA CURA: `deveRiconoscere` ────────────────────────────────────────────
 *  Sul telefono o tablet del CLIENTE il riconoscimento non parte proprio. Non
 *  basta limitare i riavvii: Chrome Android chiude il riconoscimento a ogni
 *  pausa di voce anche con `continuous`, quindi un cliente che parla avrebbe un
 *  bip dopo ogni frase. In più il riconoscimento chiede il microfono mentre la
 *  chiamata lo tiene già. Costo accettato: la voce del cliente da telefono non
 *  entra nel PDF «conversazione completa». Computer del cliente e consulente
 *  (anche da tablet, per il teleprompter) restano come prima.
 *
 *  ── LA RETE DI SICUREZZA: `dopoLaFine` ────────────────────────────────────
 *  NON è la cura: ferma un ciclo di riavvii immediati dove il riconoscimento
 *  parte comunque (consulente, cliente da computer).
 *  · errore fatale (permesso, microfono, lingua): non si riavvia;
 *  · fine NORMALE (ha sentito qualcosa, o è durata a lungo): si riavvia subito,
 *    come prima — il teleprompter non deve perdere parole;
 *  · fine BREVE senza aver sentito niente: attesa crescente (2 s, 4 s) e dopo
 *    tre di fila ci si ferma. Alla prossima connessione si riparte da capo.
 *  ⚠️ Funzioni pure: la prova (`prove/prove.mjs`) le guida senza browser. */

/** Telefono o tablet: puntatore «grossolano» (dito) o user agent mobile.
 *  Un iPad che si presenta come Mac ha comunque il puntatore grossolano. */
export function eUnTelefono(p: { puntatoreGrossolano: boolean; userAgent: string }): boolean {
  return p.puntatoreGrossolano || /android|iphone|ipad|ipod|mobile/i.test(p.userAgent || "");
}

/** Il riconoscimento parte su questo dispositivo? No solo per il cliente su
 *  telefono/tablet. Ruolo ancora ignoto = come prima (parte). */
export function deveRiconoscere(p: { ruolo: string | null | undefined; mobile: boolean }): boolean {
  return !(p.ruolo === "viewer" && p.mobile);
}

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
