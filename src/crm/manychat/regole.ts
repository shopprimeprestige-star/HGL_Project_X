/** ── CHI PUÒ RICEVERE UN MESSAGGIO AUTOMATICO ──────────────────────────────
 *
 *  Commessa 2026-10-23 (WhatsApp con ManyChat). SCHELETRO del compito 1: ci
 *  sono solo le firme. Il compito 2 (Dev A) scrive i corpi e le prove in
 *  `prove/manychat/regole.mjs`. Finché non li scrive, chiamarle lancia un
 *  errore: meglio un guasto chiaro che una risposta inventata.
 *
 *  Modulo PURO: niente rete, niente orologio, niente database.
 *
 *  ── LE REGOLE (PIANO §0, §2a) ─────────────────────────────────────────────
 *   - consenso: vale «Ok a WhatsApp» messo sulla scheda (`data.okWhatsapp`) e,
 *     un giorno, la casella di un modulo (`data.consensoModulo.whatsapp`).
 *     Oggi nessun modulo la salva: all'accensione non parte nessun promemoria
 *     finché i consulenti non spuntano le schede.
 *   - «lead del consulente»: `consulenteId` di un consulente attivo con
 *     `faConsulente` vero (`mestieriDi`), NON in «Lead importati» (`eImportato`,
 *     spostata qui da CRM.trattative.tsx) e in stato `da_ricontattare`,
 *     `sta_valutando` o `fissa_meet_dopo`.
 *   - freno «mai due volte senza risposta»: PER TELEFONO. Si sblocca con una
 *     risposta, con un cambio a mano (`contattoWa.sbloccatoIl`) o col
 *     ripristino da STOP.
 *  ───────────────────────────────────────────────────────────────────────── */
import type { ContattoWa, Consultant, LeadData } from "../types";

/** Da dove viene il consenso. */
export type ViaConsenso = "scheda" | "modulo";

export interface Consenso {
  si: boolean;
  via: ViaConsenso | null;
  /** ISO di quando è stato dato, se si sa */
  il: string | null;
  /** chi l'ha messo sulla scheda (solo via «scheda») */
  da: string | null;
}

/** Il consenso WhatsApp di una scheda. */
export function consensoWhatsapp(_d: Partial<LeadData> | null | undefined): Consenso {
  throw new Error("manychat/regole: consensoWhatsapp non è ancora scritta (compito 2)");
}

/** «Lead importati» = `importato` vero e non ancora con consulenza fissata
 *  (data del meet + consulente). Era in CRM.trattative.tsx. */
export function eImportato(_l: { data: Partial<LeadData> }): boolean {
  throw new Error("manychat/regole: eImportato non è ancora scritta (compito 2)");
}

/** La scheda è di un consulente (non del setter, non importata) e in uno stato
 *  per cui si ricontatta. `consulenti` = quelli dell'installazione. */
export function eLeadDelConsulente(
  _l: { data: Partial<LeadData> },
  _consulenti: Pick<Consultant, "id" | "data">[],
): boolean {
  throw new Error("manychat/regole: eLeadDelConsulente non è ancora scritta (compito 2)");
}

/** Il telefono come lo vuole il registro: solo cifre col prefisso (riusa
 *  `numeroPerWhatsapp`). `null` se non è un numero a cui scrivere. */
export function numeroWa(_telefono?: string | null): string | null {
  throw new Error("manychat/regole: numeroWa non è ancora scritta (compito 2)");
}

/** Una riga del registro `manychat_invii`, quanto basta ai freni. */
export interface InvioPerFreno {
  /** solo cifre */
  telefono: string;
  tipo: "promemoria" | "ricontatto" | "conferma" | "chat" | "webinar" | "prova";
  stato: "prenotato" | "inviato" | "fallito" | "saltato" | "incerto";
  /** ISO */
  prenotatoIl: string;
  rispostaIl?: string | null;
  sbloccatoIl?: string | null;
}

/** Il freno «mai due volte senza risposta», per TELEFONO: `true` = l'ultimo
 *  messaggio automatico a quel numero non ha avuto risposta, il prossimo non
 *  parte. */
export function aspettaRisposta(
  _telefono: string,
  _invii: InvioPerFreno[],
  _contattoWa: ContattoWa | undefined,
): boolean {
  throw new Error("manychat/regole: aspettaRisposta non è ancora scritta (compito 2)");
}
