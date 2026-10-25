/** ── L'INGRESSO DEI LEAD DAL FOGLIO GOOGLE ─────────────────────────────────
 *
 *  SCHELETRO del compito 0 (commessa 2026-10-25): solo tipi e firme. I corpi li
 *  scrive il compito S (piano §2, §3, §8), con le prove in
 *  `prove/sheets/ingresso.mjs`.
 *
 *  Puro: niente rete, niente database. Le porte vere stanno in
 *  `sheets/porte.server.ts`, la rotta in `routes/api.public.sheets-ingresso.ts`.
 *  ⚠️ Mai nomi, numeri, testi o id del lead in risposta o nei log. */
import type { LeadData } from "../types";

/** Il corpo che manda lo script (versione 1, piano §2a). */
export interface RichiestaIngresso {
  versione: 1;
  foglio: { id: string; nome: string; scheda: string };
  /** la riga del foglio, intero ≥ 2 */
  riga: number;
  intestazioni: string[];
  /** stessa lunghezza di `intestazioni`, ogni cella ≤ 1000 caratteri */
  valori: string[];
}

/** Gli esiti che lo script scrive nella colonna «Inviato al CRM». */
export type EsitoIngresso = "nuovo" | "ritorno" | "gia_ricevuto" | "gia_presente" | "scartata";

/** Il tetto di righe al giorno (ora di Roma): lo stesso `300` di S1 in SQL
 *  (`TETTO_RIGHE_GIORNO`). */
export const TETTO_RIGHE_GIORNO = 300;

/** La scheda pronta da scrivere, o il motivo per cui la riga si scarta. */
export type SchedaDaRiga = { data: LeadData; chiave: string; tel9: string } | { scartata: string };

/** Le porte vere (o finte, nelle prove). Le firme esatte le definisce S. */
export interface PorteIngresso {
  /** l'utente dell'installazione (`manychat_config.user_id`), `null` se manca */
  utente(): Promise<string | null>;
  scrivi(i: {
    userId: string;
    chiave: string;
    tel9: string;
    metaId: string;
    foglio: string;
    riga: number;
    data: LeadData;
  }): Promise<{ esito: EsitoIngresso | "tetto"; leadId?: string; stato?: string }>;
  segnaRitorno(i: {
    userId: string;
    leadId: string;
    chiave: string;
    foglio: string;
  }): Promise<boolean>;
  chiudi(i: { userId: string; chiave: string; esito: EsitoIngresso }): Promise<boolean>;
}

/** Controlla la forma del JSON e i limiti (piano §2a). `null` = forma sbagliata. */
export function leggiRichiesta(_json: unknown): RichiestaIngresso | null {
  throw new Error("leggiRichiesta: da scrivere (compito S)");
}

/** Dalla riga del foglio alla scheda: `traduciRighe`, poi `conListaOrigine`,
 *  `origineIngresso`, `consensoModulo`, `stato: "da_contattare"`,
 *  `importato: true`, `consulenteId: null`. Asincrona perché la chiave `f:` usa
 *  `crypto.subtle` (SHA-256). */
export async function schedaDaRiga(_r: RichiestaIngresso, _adesso: Date): Promise<SchedaDaRiga> {
  throw new Error("schedaDaRiga: da scrivere (compito S)");
}

/** La chiave d'idempotenza: `m:<cifre dell'id Meta>` oppure `f:` + SHA-256
 *  (32 caratteri esadecimali). */
export async function chiaveIngresso(
  _d: Partial<LeadData>,
  _r: RichiestaIngresso,
): Promise<string> {
  throw new Error("chiaveIngresso: da scrivere (compito S)");
}

/** Dalla richiesta HTTP alla risposta HTTP, come `gestisciRichiesta` di
 *  ManyChat: prima il segreto e la chiave, POI il corpo. */
export async function gestisciIngresso(
  _porte: PorteIngresso,
  _i: { request: Request; segreto: string | undefined; adesso: Date },
): Promise<{ response: Response; esito?: string }> {
  throw new Error("gestisciIngresso: da scrivere (compito S)");
}
