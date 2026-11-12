/** ── FATTURE BULK · UNA COSA PER RICHIESTA (cambio-riga.ts) ────────────────
 *  Quello che il pannello della riga può mandare alla rotta `salva-riga`. La rotta
 *  rifiuta (400) una correzione o un cambio di scheda mandati insieme a una conferma
 *  o a uno scarto: chi conferma non ha visto l'effetto della correzione. Qui la regola è
 *  una funzione pura, provata (prove/fatture-bulk/interfaccia.mjs), e il pannello la
 *  chiama prima di ogni salvataggio. */
import type { CampiRiga } from "./tipi";

export type CambioRiga = {
  modifiche?: Partial<CampiRiga>;
  scheda?: string | null;
  confermaRiga?: boolean;
  confermaAvvisi?: string[];
  scarta?: boolean;
};

/** Quante cose diverse porta il cambio. Un campo vuoto (`modifiche: {}`, `confermaAvvisi: []`) non conta. */
export function coseDelCambio(c: CambioRiga): string[] {
  const dentro: string[] = [];
  if (c.modifiche && Object.keys(c.modifiche).length > 0) dentro.push("modifiche");
  if (c.scheda !== undefined) dentro.push("scheda");
  if (c.confermaRiga !== undefined) dentro.push("confermaRiga");
  if (c.confermaAvvisi && c.confermaAvvisi.length > 0) dentro.push("confermaAvvisi");
  if (c.scarta) dentro.push("scarta");
  return dentro;
}

/** `null` = va bene (al massimo una cosa); altrimenti la frase che spiega cosa non va. */
export function controllaCambio(c: CambioRiga): string | null {
  const cose = coseDelCambio(c);
  return cose.length > 1
    ? `Una sola cosa per richiesta (qui: ${cose.join(", ")}): correzioni, scheda, conferme e scarto vanno mandati separati.`
    : null;
}
