/** ── LA CASSA: LA CHIAVE DELLA PAGINA ORDINE E IL RIFERIMENTO (PURI) ────────
 *  Commessa 2026-11-20-shop-completo, R2 · T48 (PIANO-R2 D48; SPEC 8A n. 5). Nessun database, nessuna rete.
 *  · `chiaveOrdine(chiaveServizio, ordineId)` = base64url(HMAC-SHA256(k_ordine, id)), con `k_ordine = hmacHex(chiaveServizio, "hgl-ordine-v1")`.
 *    Non è casuale e non si conserva: l'email di conferma la RICALCOLA per mettere il link; su `shop_orders` sta solo `impronta(chiave)`.
 *  · `verificaChiave(chiave, hash)` confronta le impronte a TEMPO COSTANTE; con l'ordine inesistente (nessuna impronta) fa lo stesso lavoro
 *    contro un'impronta fittizia, così il tempo non dice se l'ordine esiste. Mai un'eccezione: qualunque cosa strana vale «no».
 *  · `nuovoRef`: «HG-» + 6 segni dell'alfabeto di Crockford (niente I, L, O, U: si dettano al telefono senza equivoci).
 *  ⚠️ Nessun log: né la chiave né l'id dell'ordine devono finire in un messaggio. */
import { sha256Hex } from "@/lib/tracciamento/hash";
import { hmacHex } from "@/lib/tracciamento/permesso";

/** Una delle tre etichette che separano le chiavi derivate dalla chiave di servizio (le altre: `hgl-eventi-v1`, `hgl-cassa-v1`). */
export const ETICHETTA_ORDINE = "hgl-ordine-v1";

const FORMA_CHIAVE = /^[A-Za-z0-9_-]{43}$/;
const FORMA_IMPRONTA = /^[0-9a-f]{64}$/;
/** Quello con cui si confronta quando l'ordine non c'è: non è l'impronta di niente. */
const IMPRONTA_FITTIZIA = "0".repeat(64);
/** L'alfabeto di Crockford: cifre e lettere senza I, L, O, U. 32 segni = 5 bit: nessuna distorsione con `& 31`. */
const ALFABETO = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export const FORMA_REF = /^HG-[0-9A-HJKMNP-TV-Z]{6}$/;

const pieno = (x: unknown): x is string => typeof x === "string" && x.length > 0;

/** Confronto che non si ferma al primo segno diverso (stessa durata qualunque sia la differenza, anche con lunghezze diverse). */
export function ugualiATempoCostante(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Esadecimale → base64url senza riempimento (43 segni per 32 byte). */
function inBase64Url(hex: string): string {
  let s = "";
  for (let i = 0; i < hex.length; i += 2)
    s += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** La chiave di un ordine. Lancia se manca la chiave di servizio o l'id (mai una chiave debole). */
export async function chiaveOrdine(chiaveServizio: unknown, ordineId: unknown): Promise<string> {
  if (!pieno(chiaveServizio)) throw new Error("chiave di servizio mancante");
  if (!pieno(ordineId)) throw new Error("ordine mancante");
  const kOrdine = await hmacHex(chiaveServizio, ETICHETTA_ORDINE);
  return inBase64Url(await hmacHex(kOrdine, ordineId));
}

/** L'impronta che si conserva su `shop_orders.chiave_pubblica_hash`: SHA-256 della chiave, esadecimale minuscolo. */
export function impronta(chiave: string): Promise<string> {
  return sha256Hex(chiave);
}

/** La chiave ricevuta corrisponde all'impronta salvata? `hash` assente o storto = ordine che non c'è: falso, ma dopo lo stesso lavoro. */
export async function verificaChiave(chiave: unknown, hash: unknown): Promise<boolean> {
  try {
    const c = typeof chiave === "string" && FORMA_CHIAVE.test(chiave) ? chiave : "";
    const reale = typeof hash === "string" && FORMA_IMPRONTA.test(hash);
    const uguale = ugualiATempoCostante(
      await impronta(c),
      reale ? (hash as string) : IMPRONTA_FITTIZIA,
    );
    return uguale && reale && c !== "";
  } catch {
    return false;
  }
}

/** Il riferimento dell'ordine, per esempio «HG-7K3M9Q». `random(n)` dà n byte casuali (di partenza `crypto`, nei Workers e nel browser). */
export function nuovoRef(
  random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n)),
): string {
  const b = random(6);
  if (!b || b.length < 6) throw new Error("casuale insufficiente");
  let ref = "HG-";
  for (let i = 0; i < 6; i++) ref += ALFABETO[b[i] & 31];
  return ref;
}

export const refValido = (x: unknown): x is string => typeof x === "string" && FORMA_REF.test(x);
