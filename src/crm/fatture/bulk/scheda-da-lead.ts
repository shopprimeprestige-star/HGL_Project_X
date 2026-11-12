/** ── FATTURE BULK · UNA SCHEDA DEL CRM NELLA FORMA DELL'ABBINAMENTO ────────
 *  Una sola funzione per browser (anteprima) e server (`emetti-riga`): se le due
 *  mappature differissero anche di uno spazio o di una maiuscola, l'anteprima e
 *  l'emissione abbinerebbero schede diverse alla stessa riga. Del telefono bastano
 *  le ultime 9 cifre. Pura: nessun accesso a database o a sessione. */
import type { SchedaPerAbbinamento } from "./tipi";

export function schedaDaLead(
  id: string,
  d: { nome?: unknown; cognome?: unknown; codiceFiscale?: unknown; telefono?: unknown },
): SchedaPerAbbinamento {
  return {
    id,
    nome: String(d.nome ?? ""),
    cognome: String(d.cognome ?? ""),
    codiceFiscale: String(d.codiceFiscale ?? ""),
    telefono: String(d.telefono ?? "")
      .replace(/\D/g, "")
      .slice(-9),
  };
}
