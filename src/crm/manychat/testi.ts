/** ── LE VARIABILI DEI MODELLI ──────────────────────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat). SCHELETRO del compito 1: firme.
 *  Il compito 2 (Dev A) scrive i corpi; le prove stanno in
 *  `prove/manychat/regole.mjs` e `quando.mjs`.
 *
 *  Il testo dei messaggi NON si scrive qui: sono modelli approvati da Meta,
 *  dentro ManyChat. Il CRM riempie solo le variabili, che ManyChat legge dai
 *  campi del contatto (`crm_*`).
 *
 *  ⚠️ A ManyChat vanno solo il NOME (mai il cognome), il telefono e i
 *   parametri del modello: nessuna nota, nessun preventivo, nessun dato di
 *   salute. Una variabile vuota → `salta`: un modello col buco non parte.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { LeadData } from "../types";

/** I campi del contatto ManyChat che il CRM scrive (nome del campo → valore). */
export type CampiContatto = Record<string, string>;

export type CampiOSalta =
  | { tipo: "campi"; campi: CampiContatto }
  | { tipo: "salta"; motivo: string };

/** Promemoria 25': `crm_nome`, `crm_ora_meet`, `crm_link_meet`, `crm_consulente`. */
export function campiPromemoria(
  _d: Partial<LeadData>,
  _consulente: string | null | undefined,
): CampiOSalta {
  throw new Error("manychat/testi: campiPromemoria non è ancora scritta (compito 2)");
}

/** Ricontatto: `crm_nome`, `crm_consulente`. */
export function campiRicontatto(
  _d: Partial<LeadData>,
  _consulente: string | null | undefined,
): CampiOSalta {
  throw new Error("manychat/testi: campiRicontatto non è ancora scritta (compito 2)");
}

/** I tre campi che servono a riconoscere la risposta: `crm_lead_id`,
 *  `crm_invio_id`, `crm_telefono` (solo cifre). */
export function campiDiRiconoscimento(_i: {
  leadId?: string | null;
  invioId: string;
  telefono: string;
}): CampiContatto {
  throw new Error("manychat/testi: campiDiRiconoscimento non è ancora scritta (compito 2)");
}

/** `crm_v1…crm_v4` = SOLO i parametri del modello, nell'ordine in cui il
 *  modello li vuole. Più di quattro → errore, mai un parametro tagliato. */
export function campiPorta(_parametri: string[]): CampiContatto {
  throw new Error("manychat/testi: campiPorta non è ancora scritta (compito 2)");
}

/** Il numero per il riquadro: «+39 333 ••• 4567». Mai nei log. */
export function mascheraNumero(_cifre: string): string {
  throw new Error("manychat/testi: mascheraNumero non è ancora scritta (compito 2)");
}
