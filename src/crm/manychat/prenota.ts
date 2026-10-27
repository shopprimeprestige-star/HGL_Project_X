/** ── PRENOTA IN CHAT: L'ORCHESTRATORE (stub del compito 0) ─────────────────
 *  Lo riempie il compito T7 (PIANO.md). Firme definitive, stile `risposta.ts`. */
import type { PortePrenota, RichiestaPrenota, RispostaPrenota } from "./prenota-tipi";

export type StatoPrenota = 200 | 401 | 413 | 503;

export async function gestisciPrenota(
  _porte: PortePrenota,
  _r: RichiestaPrenota,
): Promise<{ stato: StatoPrenota; risposta: RispostaPrenota }> {
  throw new Error("da fare");
}

/** Dalla richiesta HTTP alla risposta HTTP: il corpo si legge SOLO dopo la chiave giusta. */
export async function gestisciRichiestaPrenota(
  _porte: PortePrenota,
  _i: { request: Request; segreto: string | undefined; adesso: Date },
): Promise<{ response: Response; esito?: string }> {
  throw new Error("da fare");
}
