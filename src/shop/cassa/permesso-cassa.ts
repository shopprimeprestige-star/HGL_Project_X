/** ── LA CASSA: IL PERMESSO CON IL TEMPO MINIMO (PURO) ───────────────────────
 *  Commessa 2026-11-20-shop-completo, R2 · T48 (PIANO-R2 D49 punto a). Nessun database, nessuna rete.
 *  `GET /api/public/shop-cassa-permesso` emette un permesso; `POST /api/public/shop-cassa` lo chiede indietro. Il token porta
 *  l'ISTANTE DI EMISSIONE dentro il testo firmato: il tempo minimo (3 secondi, un bot che compila al volo non lo rispetta) lo legge il
 *  server dal token, non lo dichiara il client. Vale 30 minuti.
 *  Forma: «<istante in ms>.<firma esadecimale>», firmata con la chiave derivata dalla chiave di servizio con l'etichetta `hgl-cassa-v1`:
 *  un permesso degli eventi (R1, `hgl-eventi-v1`) non vale per la cassa e viceversa. Usa `hmacHex` di R1 senza modificarlo.
 *  ⚠️ È un ATTRITO, non un'autenticazione (chiunque può chiederlo): la difesa vera è il limite per indirizzo (`anti-spam.ts`). */
import { hmacHex } from "@/lib/tracciamento/permesso";
import { ugualiATempoCostante } from "./chiave-ordine";

export const ETICHETTA_CASSA = "hgl-cassa-v1";
/** Prima di questa età il permesso è «troppo presto»; oltre quella massima è «scaduto». Estremi inclusi. */
export const ETA_MINIMA_MS = 3000;
export const ETA_MASSIMA_MS = 30 * 60 * 1000;

export type EsitoPermessoCassa =
  | { ok: true }
  | { ok: false; motivo: "troppo_presto" | "scaduto" | "non_valido" };

const pieno = (x: unknown): x is string => typeof x === "string" && x.length > 0;
const chiaveCassa = (chiaveServizio: string) => hmacHex(chiaveServizio, ETICHETTA_CASSA);

/** Un permesso emesso a `adesso` (ms). Lancia se la chiave di servizio manca (il Worker risponde 503 e non emette). */
export async function emettiPermessoCassa(
  chiaveServizio: unknown,
  adesso: number,
): Promise<string> {
  if (!pieno(chiaveServizio)) throw new Error("chiave di servizio mancante");
  if (typeof adesso !== "number" || !Number.isFinite(adesso) || adesso < 0)
    throw new Error("istante non valido");
  const emesso = String(Math.floor(adesso));
  return `${emesso}.${await hmacHex(await chiaveCassa(chiaveServizio), emesso)}`;
}

/** Il permesso è firmato da noi e ha l'età giusta? Prima la firma, poi il tempo. Mai un'eccezione: qualunque cosa strana è `non_valido`. */
export async function verificaPermessoCassa(
  token: unknown,
  chiaveServizio: unknown,
  adesso: unknown,
  minimoMs: number = ETA_MINIMA_MS,
  massimoMs: number = ETA_MASSIMA_MS,
): Promise<EsitoPermessoCassa> {
  try {
    if (
      typeof token !== "string" ||
      !pieno(chiaveServizio) ||
      typeof adesso !== "number" ||
      !Number.isFinite(adesso)
    )
      return { ok: false, motivo: "non_valido" };
    const m = /^(\d{1,16})\.([0-9a-f]{64})$/.exec(token);
    if (!m) return { ok: false, motivo: "non_valido" };
    if (!ugualiATempoCostante(await hmacHex(await chiaveCassa(chiaveServizio), m[1]), m[2]))
      return { ok: false, motivo: "non_valido" };
    const eta = adesso - Number(m[1]); // un permesso «dal futuro» (orologi sfasati) ha età negativa: troppo presto
    if (eta < minimoMs) return { ok: false, motivo: "troppo_presto" };
    if (eta > massimoMs) return { ok: false, motivo: "scaduto" };
    return { ok: true };
  } catch {
    return { ok: false, motivo: "non_valido" };
  }
}
