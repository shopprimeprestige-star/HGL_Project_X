/** ── LA CHIAVE DELL'ANTEPRIMA ───────────────────────────────────────────────
 *  Commessa 2026-11-20-shop-completo (T07, D31). Modulo PURO: usa solo `crypto.subtle` (browser e Workers).
 *
 *  Il titolare vede una bozza dal telefono, senza accedere: apre `/shop/prodotto/<slug>?anteprima=<chiave>`.
 *  La chiave è un HMAC-SHA256 di «scadenza.slug», valida 24 ore e SOLO per quello slug. Non si salva da nessuna parte.
 *
 *  ⚠️ Nessun segreto nuovo (come D16): la chiave si DERIVA dalla chiave di servizio con un'etichetta fissa.
 *   Chiave di servizio mancante = si lancia (chi emette risponde 503); chi verifica risponde «no».
 *  ⚠️ La firma si confronta con `crypto.subtle.verify`, che lo fa a tempo costante: mai con `===` sui testi.
 *  ⚠️ Chi riceve «sì» deve passare `anteprima: { slug }` a `costruisciPubblico`, e solo allora. Un «no» (scaduta,
 *   alterata, di un altro slug, mancante) deve dare la stessa risposta di un prodotto che non esiste. */
import { slugValido } from "./modello";

export const ETICHETTA_ANTEPRIMA = "hgl-anteprima-v1";
export const DURATA_ANTEPRIMA_MS = 24 * 60 * 60 * 1000;

const enc = new TextEncoder();
const piena = (x: unknown): x is string => typeof x === "string" && x.length > 0;
const esadecimale = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
const importa = (segreto: string, uso: "sign" | "verify") =>
  crypto.subtle.importKey("raw", enc.encode(segreto), { name: "HMAC", hash: "SHA-256" }, false, [uso]);

/** La chiave dell'anteprima, derivata dalla chiave di servizio con l'etichetta fissa. */
async function deriva(chiaveDiServizio: string): Promise<string> {
  return esadecimale(await crypto.subtle.sign("HMAC", await importa(chiaveDiServizio, "sign"), enc.encode(ETICHETTA_ANTEPRIMA)));
}

/** Una chiave d'anteprima per `slug` che vale 24 ore da `adesso` (ms): «<scadenza>.<firma>». Lancia se qualcosa manca o è storto. */
export async function emettiChiaveAnteprima(chiaveDiServizio: string, slug: string, adesso: number): Promise<string> {
  if (!piena(chiaveDiServizio)) throw new Error("chiave di servizio mancante");
  if (!slugValido(slug)) throw new Error("indirizzo del prodotto non valido");
  if (typeof adesso !== "number" || !Number.isFinite(adesso)) throw new Error("istante non valido");
  const scadenza = String(Math.floor(adesso) + DURATA_ANTEPRIMA_MS);
  const k = await importa(await deriva(chiaveDiServizio), "sign");
  return `${scadenza}.${esadecimale(await crypto.subtle.sign("HMAC", k, enc.encode(`${scadenza}.${slug}`)))}`;
}

/** La chiave è firmata per QUESTO slug e non è scaduta? Mai un'eccezione: qualunque cosa strana vale «no». */
export async function verificaChiaveAnteprima(chiaveDiServizio: unknown, slug: unknown, token: unknown, adesso: unknown): Promise<boolean> {
  try {
    if (!piena(chiaveDiServizio) || !slugValido(slug) || typeof token !== "string" || typeof adesso !== "number" || !Number.isFinite(adesso)) return false;
    const m = /^(\d{1,16})\.([0-9a-f]{64})$/.exec(token);
    if (!m || adesso > Number(m[1])) return false;
    const firma = Uint8Array.from(m[2].match(/../g) ?? [], (b) => parseInt(b, 16));
    return await crypto.subtle.verify("HMAC", await importa(await deriva(chiaveDiServizio), "verify"), firma, enc.encode(`${m[1]}.${slug}`));
  } catch {
    return false;
  }
}
