/** ── «NO SHOW» E «DA SPOSTARE» SOTTO LA BARRA DEL MEET (31/10/2026) ──────────
 *  Richiesta del titolare: dal promemoria del primo meet, due pulsanti; cambiato lo stato il meet
 *  esce dalla barra e passa il successivo di oggi. Qui le regole pure (le due azioni e la frase di
 *  conferma); il disegno è AzioniMeet.tsx; il cambio di stato è `cambiaStatoLead` (useChatWa).
 *
 *  ── LA FRASE DI CONFERMA DICE SOLO QUEL CHE È VERO ──────────────────────
 *  Il messaggio automatico di «Cliente assente» e «Da riprogrammare» lo manda il server
 *  (manychat/stati.ts, `TABELLA_STATI`): a evento, NON PRIMA di `attesaMin` minuti dal cambio, solo
 *  se l'interruttore di quello stato è acceso, il cliente ha dato il consenso e non ha scritto STOP.
 *  Il client non può leggere interruttore, consenso e orari del giro: la frase dice quindi «se
 *  l'invio automatico è acceso» e «può partire», mai «partirà».
 *  «Da riprogrammare» con un ricontatto da oggi in poi è invece A DATA (`giornoADataDi`, la stessa
 *  regola del giro, applicata alla scheda come sarà dopo il cambio).
 *  Senza consulente (`chi: consulente`) nessun messaggio automatico: la frase dice solo lo stato. */
import type { LeadData, LeadStatus } from "../types";
import { giornoADataDi } from "../manychat/quando";
import { TABELLA_STATI } from "../manychat/stati";
import { giornoParlato } from "../promemoria/formati";

/** Dopo quanto la conferma si richiude da sola. */
export const CHIUSURA_MS = 8000;

export interface AzioneMeet {
  stato: Extract<LeadStatus, "no_show" | "da_spostare">;
  /** Il testo del pulsante (le parole del titolare). */
  etichetta: string;
}

export const AZIONI_MEET: readonly AzioneMeet[] = [
  { stato: "no_show", etichetta: "No show" },
  { stato: "da_spostare", etichetta: "Da spostare" },
];

/** Come lo stato si chiama a schermo (lo stesso nome del menu stato e della scheda). */
const NOME_STATO: Record<AzioneMeet["stato"], string> = {
  no_show: "Cliente assente",
  da_spostare: "Da riprogrammare",
};

/** Il messaggio di cui si parla, per nome, nella frase. */
const MESSAGGIO: Record<AzioneMeet["stato"], string> = {
  no_show: "«cliente assente»",
  da_spostare: "per riprogrammare",
};

/** La frase di conferma di `stato` per la scheda `dati`. `oggi` è «AAAA-MM-GG» di Roma. Stringa vuota
 *  se `stato` non è una delle due azioni. */
export function fraseConferma(
  stato: LeadStatus | string,
  dati: Partial<LeadData>,
  oggi: string,
  adesso: Date = new Date(),
): string {
  if (stato !== "no_show" && stato !== "da_spostare") return "";
  const nome = String(dati.nome ?? "").trim() || "il cliente";
  const testa = `Segno ${nome} come «${NOME_STATO[stato]}».`;
  const riga = TABELLA_STATI[stato];
  //  Nessun consulente, nessuna riga: nessun messaggio automatico, quindi niente da dire.
  if (!riga || !dati.consulenteId) return testa;
  //  Come sarà la scheda dopo il cambio: `statoDal` = adesso (lo scrive `conStatoDal`).
  const giorno =
    stato === "da_spostare"
      ? giornoADataDi({ ...dati, statoDal: adesso.toISOString() }, oggi)
      : null;
  const quando = giorno
    ? `C'è già un ricontatto per ${giornoParlato(giorno) ?? giorno}: il messaggio può partire quel giorno`
    : `Il messaggio ${MESSAGGIO[stato]} può partire non prima di ${riga.attesaMin ?? 0} minuti`;
  return `${testa} ${quando}, se l'invio automatico è acceso.`;
}
