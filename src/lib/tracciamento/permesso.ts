/*  ── IL PERMESSO A BREVE SCADENZA (modulo puro) ─────────────────────────────────
    Shop R1 · T24 · D16. Chi vuole mandare un evento al server chiede prima un permesso (10 minuti),
    firmato con HMAC-SHA256 con `crypto.subtle` (browser e Workers, nessun `Buffer`).

    ⚠️ È un ATTRITO, non un'autenticazione: chiunque può chiederlo. La difesa vera è nel mittente
       (solo nomi di navigazione, mai acquisti, indirizzo ricostruito) e nel limite di Cloudflare.
    ⚠️ La chiave non è un segreto nuovo: si DERIVA dalla chiave di servizio con un'etichetta fissa
       (`derivaChiave`). Chiave mancante = si lancia (il Worker risponde 503 e non invia).

    Forma del permesso: «<scadenza in ms>.<firma esadecimale>» (solo segni da indirizzo). */
import { esadecimale } from "./hash";

export const ETICHETTA_CHIAVE = "hgl-eventi-v1";
export const DURATA_PERMESSO_MS = 10 * 60 * 1000;

const chiaveValida = (k: unknown): k is string => typeof k === "string" && k.length > 0;

/** HMAC-SHA256 del messaggio con la chiave (testo), in esadecimale. Serve anche alla chiave d'anteprima (T07). */
export async function hmacHex(chiave: string, messaggio: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(chiave), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return esadecimale(await crypto.subtle.sign("HMAC", k, enc.encode(messaggio)));
}

/** La chiave dei permessi, derivata dalla chiave di servizio. Lancia se la chiave di servizio manca. */
export async function derivaChiave(chiaveDiServizio: string): Promise<string> {
  if (!chiaveValida(chiaveDiServizio)) throw new Error("chiave di servizio mancante");
  return hmacHex(chiaveDiServizio, ETICHETTA_CHIAVE);
}

/** Confronto che non si ferma al primo segno diverso (stessa durata qualunque sia la differenza). */
function uguali(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Un permesso che vale 10 minuti da `adesso` (ms). Lancia se la chiave manca. */
export async function emettiPermesso(chiaveSegreta: string, adesso: number): Promise<string> {
  if (!chiaveValida(chiaveSegreta)) throw new Error("chiave dei permessi mancante");
  const scadenza = String(Math.floor(adesso) + DURATA_PERMESSO_MS);
  return `${scadenza}.${await hmacHex(chiaveSegreta, scadenza)}`;
}

/** Il permesso è firmato con questa chiave e non è scaduto? Mai un'eccezione: qualunque cosa strana vale «no». */
export async function verificaPermesso(token: unknown, chiaveSegreta: unknown, adesso: unknown): Promise<boolean> {
  try {
    if (typeof token !== "string" || !chiaveValida(chiaveSegreta) || typeof adesso !== "number" || !Number.isFinite(adesso)) return false;
    const m = /^(\d{1,16})\.([0-9a-f]{64})$/.exec(token);
    if (!m) return false;
    if (adesso > Number(m[1])) return false;
    return uguali(await hmacHex(chiaveSegreta, m[1]), m[2]);
  } catch {
    return false;
  }
}
