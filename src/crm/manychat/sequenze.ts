/** ── LE DUE SEQUENZE: LEAD NUOVO E GIORNO DEL MEET ─────────────────────────
 *
 *  SCHELETRO del compito 0 (commessa 2026-10-25): solo tipi e firme. I corpi li
 *  scrive il compito Q (piano §5a, §5b, §8), con le prove in
 *  `prove/manychat/sequenze.mjs`.
 *
 *  Modulo PURO, stessa forma di `quando.ts`: l'orologio, i consulenti, il
 *  registro degli invii e i tetti arrivano da fuori (`ContestoQuando`).
 *  - `decidiLeadNuovi`: primo contatto (`n|tel9`) e richiamo a 24 h (`n24|tel9`).
 *  - `decidiGiornoMeet`: mattina (`o|tel9|…`) e ora esatta (`a|tel9|…`); il
 *    promemoria dei 25' resta in `decidiPromemoria`. */
import type { DecisioneQuando, ContestoQuando, SchedaQuando } from "./quando";

/** Cosa serve in più alle sequenze del lead nuovo. */
export interface ContestoLeadNuovi extends ContestoQuando {
  /** `controlli.fraseModulo.il`: da quando vale `consensoModulo`. `null` =
   *  nessuna data segnata, il consenso del modulo non vale per nessuno. */
  fraseModuloDal: string | null;
  /** `manychat_config.lead_nuovo_dal`: l'ultima accensione dell'interruttore. */
  leadNuovoDal: string | null;
  /** `manychat_giro.prossimo_ricontatto_dopo`: lo aspetta solo il richiamo. */
  prossimoDopo?: Date | null;
}

export interface ContestoGiornoMeet extends ContestoQuando {
  /** come sopra: il consenso del modulo vale solo da questa data */
  fraseModuloDal: string | null;
}

/** Quale dei due messaggi del lead nuovo. */
export type ExtraLeadNuovo = { quale: "primo_contatto" | "richiamo_24h"; tel9: string };
/** Quale dei due messaggi del giorno del meet, con l'inizio del meet. */
export type ExtraGiornoMeet = { quale: "meet_oggi" | "meet_adesso"; inizioMeet: Date };

export function decidiLeadNuovi(
  _schede: SchedaQuando[],
  _adesso: Date,
  _contesto: ContestoLeadNuovi,
): DecisioneQuando<ExtraLeadNuovo>[] {
  throw new Error("decidiLeadNuovi: da scrivere (compito Q)");
}

export function decidiGiornoMeet(
  _schede: SchedaQuando[],
  _adesso: Date,
  _contesto: ContestoGiornoMeet,
): DecisioneQuando<ExtraGiornoMeet>[] {
  throw new Error("decidiGiornoMeet: da scrivere (compito Q)");
}
