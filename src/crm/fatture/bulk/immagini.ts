/** ── FATTURE BULK · IMMAGINI NEL BROWSER (immagini.ts) ──
 *  SEGNAPOSTO di T0: i tipi e le firme ci sono, i corpi lanciano «da fare».
 *  Lo riempie T8. Solo browser (canvas, crypto.subtle): si prova in T14 con
 *  Playwright; le parti pure (controllo formato/peso) possono avere prove loro.
 *  Un file alla volta, per non tenere 300 immagini in memoria. */

const daFare = (compito: string): never => {
  throw new Error(`da fare (${compito})`);
};

export type EsitoControlloFile = { ok: true } | { ok: false; motivo: string };

/** PNG/JPG/WebP, non vuoto, fino a 15 MB. */
export function controllaFile(file: { type: string; size: number }): EsitoControlloFile {
  return daFare("T8 controllaFile");
}

export interface ImmagineRidotta {
  /** JPEG, lato lungo al massimo 2000 px. */
  dataUrl: string;
  /** SHA-256 esadecimale dell'ORIGINALE. */
  impronta: string;
}

export function riduciImmagine(file: File): Promise<ImmagineRidotta> {
  return daFare("T8 riduciImmagine");
}
