/** ── LA CASSA: ANTI-SPAM SENZA ACCOUNT NUOVI (PURO) ─────────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T48 (PIANO-R2 D49 punti b e c). Nessun database, nessuna rete, nessuna memoria condivisa:
 *  sui Workers un limite in memoria non regge (D16), quindi il conteggio sta nella tabella `shop_limiti` e si consuma con la funzione
 *  atomica `shop_limite_consuma(chiave, finestra_s, max)`. Qui stanno solo i pezzi puri: la chiave, i numeri, la trappola.
 *  · `improntaIndirizzo(ip, sale)`: l'indirizzo non si conserva né si registra mai in chiaro, solo questa impronta (HMAC con il sale);
 *  · `trappolaPiena(corpo)`: il campo `sito_web` è nascosto agli umani e deve restare vuoto; chi lo compila è un programma. La risposta
 *    a un corpo con la trappola piena è quella di un successo vuoto (mai un errore che la spieghi): lo decide il server, non questo file;
 *  · `LIMITI`: finestre e massimi, chiavi SEPARATE per uso (le riprove non consumano gli ordini). */
import { hmacHex } from "@/lib/tracciamento/permesso";

/** L'etichetta che deriva il sale dalla chiave di servizio (una delle etichette separate: eventi, ordine, cassa, limiti). */
export const ETICHETTA_LIMITI = "hgl-limite-v1";

export const LIMITI = {
  ordine: { finestraS: 3600, max: 10 },
  riprova: { finestraS: 3600, max: 10 },
  lettura: { finestraS: 3600, max: 60 },
  permesso: { finestraS: 3600, max: 30 },
} as const;
export type UsoLimite = keyof typeof LIMITI;

const pieno = (x: unknown): x is string => typeof x === "string" && x.length > 0;

/** Il sale delle impronte, derivato dalla chiave di servizio (nessun segreto nuovo da mettere nel Worker). Lancia se la chiave manca. */
export async function saleLimiti(chiaveServizio: unknown): Promise<string> {
  if (!pieno(chiaveServizio)) throw new Error("chiave di servizio mancante");
  return hmacHex(chiaveServizio, ETICHETTA_LIMITI);
}

/** L'impronta dell'indirizzo (esadecimale, 64 segni). Senza indirizzo (intestazione assente) tutti condividono l'impronta «sconosciuto»:
 *  il limite stringe sui casi strani, mai sui clienti che lo mandano. Senza sale lancia: l'impronta nuda di un IPv4 si ricava per tentativi. */
export async function improntaIndirizzo(ip: unknown, sale: unknown): Promise<string> {
  if (!pieno(sale)) throw new Error("sale mancante");
  const indirizzo =
    typeof ip === "string" && ip.trim() !== "" ? ip.trim().slice(0, 100) : "sconosciuto";
  return hmacHex(sale, indirizzo);
}

/** Il campo-trappola è stato compilato? Vuoto = assente, nullo, o testo di soli spazi; qualunque altro valore è un programma. */
export function trappolaPiena(corpo: unknown): boolean {
  if (typeof corpo !== "object" || corpo === null) return false;
  const v = (corpo as Record<string, unknown>).sito_web;
  if (v === undefined || v === null) return false;
  return typeof v === "string" ? v.trim() !== "" : true;
}

/** La chiave di `shop_limiti` per questo uso e questa impronta («ordine:<64 esadecimali>»). Lancia se l'uso è sconosciuto o l'impronta non è tale. */
export function chiaveLimite(uso: UsoLimite, improntaHex: string): string {
  if (typeof uso !== "string" || !Object.prototype.hasOwnProperty.call(LIMITI, uso))
    throw new Error("uso del limite sconosciuto");
  if (typeof improntaHex !== "string" || !/^[0-9a-f]{64}$/.test(improntaHex))
    throw new Error("impronta non valida");
  return `${uso}:${improntaHex}`;
}
