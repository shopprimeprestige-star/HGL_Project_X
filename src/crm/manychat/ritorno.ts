/** ── LA RISPOSTA CHE TORNA DA MANYCHAT ─────────────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat). SCHELETRO del compito 1: firme.
 *  Il compito U2 (Dev C) scrive i corpi e le prove in `prove/manychat/ritorno.mjs`.
 *
 *  Quando il cliente risponde, una External Request di ManyChat chiama la rotta
 *  `/api/public/manychat-risposta` con una chiave segreta nell'intestazione
 *  (`X-HGL-Token`) e un corpo così (PIANO §4.1):
 *    {"crm_invio_id":"…","crm_lead_id":"…","subscriber_id":"…",
 *     "telefono":"<telefono di sistema>","testo":"…"}
 *
 *  ⚠️ Il `telefono` vale SOLO dietro la chiave giusta.
 *  ⚠️ Il corpo si legge dallo stream e ci si ferma oltre 8 KB, senza fidarsi di
 *   `Content-Length`: chi lo manda è fuori dal CRM.
 *  ⚠️ Nei log mai il numero, il testo o il `subscriber_id`.
 *  ───────────────────────────────────────────────────────────────────────── */

/** Il corpo massimo che si legge, in byte. */
export const MAX_CORPO_BYTE = 8192;
/** Il testo della risposta si tiene al massimo così lungo. */
export const MAX_TESTO = 2000;

export interface CorpoRitorno {
  crmInvioId: string;
  crmLeadId: string;
  subscriberId: string;
  /** il telefono WhatsApp di sistema (cifre o con «+», come lo manda ManyChat) */
  telefono: string;
  testo: string;
}

/** Legge il corpo VERO, fermandosi oltre `max` byte. `troppoGrande` = oltre. */
export async function leggiCorpoLimitato(
  _stream: ReadableStream<Uint8Array> | null,
  _max: number = MAX_CORPO_BYTE,
): Promise<{ testo: string; troppoGrande: boolean }> {
  throw new Error("manychat/ritorno: leggiCorpoLimitato non è ancora scritta (compito U2)");
}

/** Dal JSON al corpo: tutto stringa, il testo tagliato a `MAX_TESTO`. `null` se
 *  non è un oggetto. */
export function leggiCorpo(_json: unknown): CorpoRitorno | null {
  throw new Error("manychat/ritorno: leggiCorpo non è ancora scritta (compito U2)");
}

/** Confronto esatto di due chiavi, a tempo costante e anche con lunghezze
 *  diverse (false). Una chiave assente o vuota non è mai uguale a niente. */
export function stessaChiave(
  _a: string | null | undefined,
  _b: string | null | undefined,
): boolean {
  throw new Error("manychat/ritorno: stessaChiave non è ancora scritta (compito U2)");
}

/** L'impronta della risposta (SHA-256 troncato di subscriber + testo + minuto):
 *  il flusso e la Default Reply che mandano la stessa risposta fanno UNA riga
 *  (`wa_message_id = 'mc-in:<impronta>'`). */
export async function impronta(
  _subscriberId: string,
  _testo: string,
  _minuto: string,
): Promise<string> {
  throw new Error("manychat/ritorno: impronta non è ancora scritta (compito U2)");
}

/** Un invio del registro, quanto serve ad abbinare la risposta. */
export interface InvioAbbinabile {
  id: string;
  leadId: string | null;
  /** solo cifre */
  telefono: string;
  subscriberId: string | null;
  /** ISO */
  prenotatoIl: string;
  stato: string;
}

export type Abbinamento =
  | { tipo: "invio"; invio: InvioAbbinabile }
  | { tipo: "ignorata"; motivo: "contatto_diverso" | "nessun_invio" };

/** Abbina la risposta a un invio: lo stesso `subscriber_id`; senza id, l'ultimo
 *  invio a quel telefono negli ultimi 7 giorni; altrimenti «ignorata». */
export function abbina(
  _corpo: CorpoRitorno,
  _invii: InvioAbbinabile[],
  _adesso: Date,
): Abbinamento {
  throw new Error("manychat/ritorno: abbina non è ancora scritta (compito U2)");
}
