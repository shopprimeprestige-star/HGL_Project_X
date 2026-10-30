/** ── CHI NON HA CONFERMATO, E LA CONSULENZA È OGGI ─────────────────────────
 *
 *  Idea 2 della commessa 2026-10-30 (approvata dal titolare). In «Da fare
 *  oggi» il lead con appuntamento fissato o rifissato, consulenza di oggi e
 *  nessuna conferma deve salire IN CIMA, con scritto per cosa: è la telefonata
 *  che salva una consulenza che altrimenti salta.
 *
 *  Funzione pura, come `costruisciRighe`: stessa scheda, stessa ora, stesso
 *  risultato. Niente React, niente orologio letto da dentro.
 *
 *  ── QUANDO COMPARE ────────────────────────────────────────────────────────
 *   · consulenza del pomeriggio e della sera (dalle 14:00): dalle 12:00;
 *   · consulenza prima delle 14:00: dalle 2 ore e mezza prima (alle 9:00 si
 *     comincia alle 6:30 — a quell'ora nessuno chiama, ma la riga c'è già
 *     quando si apre il CRM);
 *   · quando l'ora della consulenza è passata esce: telefonare dopo non serve,
 *     di quella consulenza si occupa la pagina Oggi con i suoi esiti.
 *  ── QUANDO ESCE DA SOLA ───────────────────────────────────────────────────
 *  La conferma si legge con `statoConferma` (promemoria/conferma), la stessa
 *  della targhetta in «Oggi»: se il cliente risponde SÌ, o la setter lo segna
 *  a voce, la riga sparisce al ricalcolo successivo. Se lo stato cambia
 *  (annullato, concluso…) non è più un appuntamento e la riga non si forma.
 *
 *  ⚠️ L'ORA È QUELLA DI ROMA, MAI QUELLA DEL SERVER NÉ DEL BROWSER: si legge
 *   con `aRoma` (promemoria/formati), che usa `Intl` e quindi segue da sé il
 *   cambio dell'ora legale. Si confrontano orologi di Roma fra loro, come fa
 *   `statoConferma`.
 *  ⚠️ «NESSUNA CONFERMA» NON È SOLO «NON CONFERMATO»: sono tutti i casi che non
 *   sono «confermato», compreso «nessuno» (promemoria mai partito, scheda
 *   vecchia) e «inviato» (attesa della risposta). Per chi deve chiamare conta
 *   una cosa sola: il cliente non ha detto di esserci.
 *  ───────────────────────────────────────────────────────────────────────── */
import { eAppuntamento, type LeadData } from "../types";
import { statoConferma } from "../promemoria/conferma";
import { aRoma, oraNormale } from "../promemoria/formati";

/** Dalle 14:00 la consulenza è «del pomeriggio»: l'avviso parte a mezzogiorno. */
export const POMERIGGIO_DALLE_MIN = 14 * 60;
export const AVVISO_POMERIGGIO_MIN = 12 * 60;
/** Per le consulenze prima delle 14:00: 2 ore e mezza di anticipo. */
export const AVVISO_ANTICIPO_MIN = 150;

export interface SenzaConferma {
  /** L'ora della consulenza, «15:30». */
  ora: string;
  /** La frase della riga: «Non ha confermato · consulenza alle 15:30». */
  etichetta: string;
}

/** Da che ora di Roma (minuti dalla mezzanotte) la riga deve comparire. */
export function avvisoDalle(minutiConsulenza: number): number {
  return minutiConsulenza >= POMERIGGIO_DALLE_MIN
    ? AVVISO_POMERIGGIO_MIN
    : Math.max(0, minutiConsulenza - AVVISO_ANTICIPO_MIN);
}

/** `null` = niente da mostrare (non è un appuntamento, non è oggi, è troppo
 *  presto, è già passato, o ha confermato). */
export function senzaConfermaOggi(
  d: Partial<LeadData> | undefined,
  adesso: Date,
): SenzaConferma | null {
  if (!d || !eAppuntamento(d.stato)) return null;
  //  Senza un'ora leggibile non c'è una soglia da applicare: la riga non si
  //  forma. Meglio una riga in meno che un avviso a un'ora inventata.
  const ora = oraNormale(d.oraMeeting);
  if (!ora) return null;
  const adessoRoma = aRoma(adesso);
  if (String(d.dataMeeting ?? "") !== adessoRoma.giorno) return null;
  const [h, m] = ora.split(":").map(Number);
  const minutiConsulenza = h * 60 + m;
  if (adessoRoma.minuti >= minutiConsulenza) return null;
  if (adessoRoma.minuti < avvisoDalle(minutiConsulenza)) return null;
  if (statoConferma(d, adesso).tipo === "confermato") return null;
  return { ora, etichetta: `Non ha confermato · consulenza alle ${ora}` };
}
