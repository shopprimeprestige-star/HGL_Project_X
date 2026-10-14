/** ── IL CODICE D'ANTEPRIMA DELLA PAGINA «TRE SOLUZIONI» · PURO ──────────────
 *  Il titolare vede la pagina dal CRM anche col cancello chiuso. La sessione del
 *  CRM è un'intestazione (`X-CRM-Sessione`), non un cookie: non può viaggiare in
 *  un indirizzo. Quindi l'API del CRM scrive in `app_config`, sotto la chiave
 *  `anteprima-soluzioni`, un codice breve e casuale che scade in 30 minuti, e
 *  `/soluzioni?anteprima=<codice>` lo confronta. Il valore salvato è un testo
 *  JSON (`app_config.value` è testo): { codice, scade }.
 *
 *  ⚠️ Il codice nasce da `crypto.getRandomValues`, MAI da `Math.random`: è una
 *  chiave, non un numero da lotteria. Se ce n'è già uno valido lo si riusa
 *  (titolare e collaboratore che guardano insieme non si annullano a vicenda).
 *  ───────────────────────────────────────────────────────────────────────── */

export const CHIAVE_ANTEPRIMA = "anteprima-soluzioni";
const DURATA_MINUTI = 30;
const FORMA_CODICE = /^[0-9a-f]{32}$/;

export interface CodiceAnteprima {
  codice: string;
  /** ISO 8601 */
  scade: string;
}

/** 16 byte sicuri → 32 caratteri esadecimali (128 bit). `riempi` si cambia solo nelle prove. */
export function nuovoCodice(
  adesso: Date = new Date(),
  riempi: (byte: Uint8Array) => Uint8Array = (b) => globalThis.crypto.getRandomValues(b),
): CodiceAnteprima {
  const byte = riempi(new Uint8Array(16));
  const codice = Array.from(byte, (b) => b.toString(16).padStart(2, "0")).join("");
  return { codice, scade: new Date(adesso.getTime() + DURATA_MINUTI * 60_000).toISOString() };
}

/** Il valore di `app_config`, comunque arrivi (testo JSON o già oggetto), se ha la forma giusta e non è scaduto. */
export function codiceDaRiusare(salvato: unknown, adesso: Date): CodiceAnteprima | null {
  let v = salvato;
  if (typeof v === "string") {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const { codice, scade } = v as { codice?: unknown; scade?: unknown };
  if (typeof codice !== "string" || !FORMA_CODICE.test(codice) || typeof scade !== "string") return null;
  const fine = Date.parse(scade);
  if (!Number.isFinite(fine) || fine <= adesso.getTime()) return null;
  return { codice, scade };
}

/** Il codice dato nell'indirizzo è quello salvato e non è scaduto. Il confronto non si ferma al primo carattere diverso. */
export function codiceValido(salvato: unknown, dato: unknown, adesso: Date): boolean {
  const buono = codiceDaRiusare(salvato, adesso);
  if (!buono || typeof dato !== "string" || dato.length !== buono.codice.length) return false;
  let diversi = 0;
  for (let i = 0; i < dato.length; i++) diversi |= dato.charCodeAt(i) ^ buono.codice.charCodeAt(i);
  return diversi === 0;
}
