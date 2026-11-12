/** ── FATTURE BULK · L'AZIONE `emetti-riga` (emissione.server.ts) ──
 *  SEGNAPOSTO di T0: i tipi e le firme ci sono, i corpi lanciano «da fare».
 *  Lo riempie T12 (dopo T7, T9, T10). File separato da bulk.server.ts per non
 *  riaprirlo. Stesse regole: porte iniettate, importabile senza ambiente. */
import type { PorteBulk } from "./bulk.server";
import type { RispostaEmettiRiga } from "./tipi";

const daFare = (compito: string): never => {
  throw new Error(`da fare (${compito})`);
};

/** Emittente → lucchetto → impostazioni (firma) → riga e file → `valutaRiga` → `cercaPerOrigine` →
 *  `emettiProtettoSu` → `emessa` → svuota dati → cancella file → chiude il lotto → rilascia (T12). */
export function emettiRiga(
  porte: PorteBulk,
  richiesta: { lotto: string; idRiga: string; emittente: string },
): Promise<RispostaEmettiRiga> {
  return daFare("T12 emettiRiga");
}
