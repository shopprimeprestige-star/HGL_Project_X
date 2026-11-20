/*  ── NORMALIZZAZIONE E HASH DEI DATI PERSONALI (modulo puro) ───────────────────
    Shop R1 · T24 · D16. Meta e TikTok vogliono email e telefono normalizzati e con hash SHA-256:
    questo file li prepara. Funziona nel browser e nei Workers (`crypto.subtle`), senza `Buffer`.
    ⚠️ Nessun dato personale si manda in chiaro: chi chiama deve saltare i valori vuoti, non hasharli. */

/** I byte come esadecimale minuscolo. */
export function esadecimale(byte: ArrayBuffer): string {
  return Array.from(new Uint8Array(byte), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 del testo (UTF-8) in esadecimale minuscolo. */
export async function sha256Hex(testo: string): Promise<string> {
  return esadecimale(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(testo)));
}

/** Spazi e maiuscole via. Vuoto se non è testo o non somiglia a un'email (una chiocciola, qualcosa prima e dopo). */
export function normalizzaEmail(valore: unknown): string {
  if (typeof valore !== "string") return "";
  const e = valore.trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+$/.test(e) ? e : "";
}

/** Solo cifre, con il prefisso +39 se manca (formato internazionale, senza «+»). Vuoto se non è un numero plausibile (8-15 cifre).
 *  «+» o «00» davanti = numero già internazionale, si lascia com'è. */
export function normalizzaTelefono(valore: unknown): string {
  if (typeof valore !== "string") return "";
  const testo = valore.trim();
  let cifre = testo.replace(/\D/g, "");
  const internazionale = testo.startsWith("+") || cifre.startsWith("00");
  if (cifre.startsWith("00")) cifre = cifre.slice(2);
  // Senza prefisso internazionale: «39» davanti vale prefisso solo se il numero è lungo abbastanza (39 + almeno 9 cifre);
  // un cellulare di 10 cifre che comincia per 39 (es. 391…) è un numero italiano senza prefisso.
  if (!internazionale && !(cifre.startsWith("39") && cifre.length >= 11)) cifre = `39${cifre}`;
  return cifre.length >= 8 && cifre.length <= 15 ? cifre : "";
}
